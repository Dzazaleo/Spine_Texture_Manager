/**
 * Phase 1 Plan 02 — Pure projection from Phase 0 outputs to IPC-safe summary.
 *
 * `buildSummary` takes a `LoadResult` from `loadSkeleton()` and a peaks
 * `Map<string, PeakRecord>` from `sampleSkeleton()` (both Phase 0) and returns
 * a plain-JSON `SkeletonSummary` (D-21, D-22) ready to cross the IPC boundary
 * via Electron's Structured Clone algorithm.
 *
 * This module is:
 *   - Pure (no IO, no console, no side effects — enforced by spec).
 *   - Output-deterministic (peaks sorted by skin/slot/attachment — matches
 *     CLI output byte-for-byte per D-16; spec'd in summary.spec.ts).
 *   - structuredClone-safe (no Map, no Float32Array, no class instances —
 *     spec'd in summary.spec.ts).
 *
 * Consumed by `src/main/ipc.ts`. Not imported by the renderer — the renderer
 * sees only the `SkeletonSummary` object on the far side of IPC.
 */
import { Skeleton } from '@esotericsoftware/spine-core';
import type { LoadResult } from '../core/types.js';
import type { SamplerOutput } from '../core/sampler.js';
import type { DisplayRow, BreakdownRow, SkeletonSummary } from '../shared/types.js';
import { analyze, analyzeBreakdown } from '../core/analyzer.js';
import { findOrphanedFiles } from '../core/usage.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

export function buildSummary(
  load: LoadResult,
  sampled: SamplerOutput,
  elapsedMs: number,
): SkeletonSummary {
  const { skeletonData } = load;

  // Count attachments across skins + bucket by spine-core class name.
  // Walks `skin.attachments` — an array (per slot index) of `StringMap<Attachment>`
  // where `StringMap<T>` is spine-core's plain indexed-object alias
  // (`{ [key: string]: T }`, NOT a JS Map — see node_modules/@esotericsoftware/
  // spine-core/dist/Utils.d.ts:31). We use `Object.values` to enumerate the
  // attachments per slot regardless of key name.
  const byType: Record<string, number> = {};
  let attachmentCount = 0;
  for (const skin of skeletonData.skins) {
    for (const attachmentsPerSlot of skin.attachments) {
      if (attachmentsPerSlot === undefined || attachmentsPerSlot === null) continue;
      for (const attachment of Object.values(attachmentsPerSlot)) {
        attachmentCount++;
        const type = attachment.constructor.name;
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }

  // Phase 25 PANEL-03 — set of attachment names whose PNG was missing in
  // atlas-less mode (from Plan 21-09's LoadResult.skippedAttachments).
  // peaks / animationBreakdown.rows are marked with isMissing: true for
  // entries whose attachmentName matches a skipped name (NOT filtered out).
  // The missing attachments are also surfaced via SkeletonSummary.skippedAttachments
  // below, which MissingAttachmentsPanel reads. LoadResult.skippedAttachments is
  // OPTIONAL (Plan 21-09 ISSUE-007), hence the `?? []`.
  const skippedNames = new Set<string>(
    (load.skippedAttachments ?? []).map((s) => s.name),
  );

  // Fold + sort + preformat delegated to src/core/analyzer.ts (D-33, D-34, D-35).
  // Sort key (skinName, slotName, attachmentName) matches
  // `scripts/cli.ts` renderTable() byte-for-byte — analyzer owns the comparator.
  //
  // Phase 6 Plan 02 — thread load.sourcePaths into DisplayRow + BreakdownRow
  // so the export plan builder (Plan 06-03) can dedup by source PNG path
  // (D-108). load.sourcePaths is the loader's Map<regionName, absPath>.
  // Phase 6 Gap-Fix #2 — also thread load.atlasSources so atlas-packed
  // projects (e.g. fixtures/Jokerman/) can extract from the atlas page
  // when per-region PNGs don't exist.
  const peaksArrayRaw = analyze(
    sampled.globalPeaks,
    load.sourcePaths,
    load.atlasSources,
    // Phase 22 DIMS-01 — thread canonical/actual dim maps through. Plan 22-01
    // ships empty Map placeholders from loader.ts; Plan 22-02 replaces with
    // populated walks. Empty Maps yield the same fallback behavior as
    // undefined (canonicalW=p.sourceW; dimsMismatch=false) — CLI byte-for-byte
    // preserved (D-102) at this checkpoint.
    load.canonicalDimsByRegion,
    load.actualDimsByRegion,
  );
  // Phase 25 PANEL-03 — mark stub-region attachments with isMissing: true
  // instead of filtering them out. Rows remain visible in GlobalMaxRenderPanel
  // and AnimationBreakdownPanel with a danger indicator (renderer Plan 25-02).
  const peaksArray: (DisplayRow & { isMissing?: boolean })[] = peaksArrayRaw.map((p) => ({
    ...p,
    isMissing: skippedNames.has(p.attachmentName) ? true : undefined,
  }));

  // Phase 25 PANEL-03 gap-fix — synthesize stub DisplayRows for missing
  // attachments that the sampler never recorded. The sampler skips attachments
  // whose source dims are absent from the sourceDims map; synthetic-atlas.ts
  // intentionally does NOT add stub regions to dimsByRegionName
  // (T-21-09-04 mitigation), so stub attachments never reach globalPeaks.
  // The .map()+mark above can only mark rows that already exist — skipped
  // attachments produce nothing. We synthesize minimal rows here so both
  // GlobalMaxRenderPanel and AnimationBreakdownPanel can surface them with
  // the danger indicator from Plan 25-02.
  //
  // For each skipped name absent from peaksArray: walk skeletonData.skins to
  // find the first (skinName, slotName) that declares it. Use canonical dims
  // from load.canonicalDimsByRegion if available (sourceW=canonicalW; source
  // PNG was declared in the JSON). Falls back to 1×1 if not found (same as
  // the atlas stub dims). peakScale=0 (never sampled); isMissing=true.
  if (skippedNames.size > 0) {
    const presentNames = new Set(peaksArray.map((p) => p.attachmentName));
    for (const entry of (load.skippedAttachments ?? [])) {
      const { name: attachmentName } = entry;
      if (presentNames.has(attachmentName)) continue; // already in peaks (shouldn't happen, defensive)

      // Walk skins to find first occurrence (skinName + slotName).
      let skinName = 'default';
      let slotName = attachmentName; // fallback: use name as slotName
      for (const skin of skeletonData.skins) {
        let found = false;
        for (let slotIdx = 0; slotIdx < skin.attachments.length; slotIdx++) {
          const perSlot = skin.attachments[slotIdx];
          if (perSlot === undefined || perSlot === null) continue;
          if (Object.prototype.hasOwnProperty.call(perSlot, attachmentName)) {
            skinName = skin.name;
            // slotName from skeletonData.slots[slotIdx] if index is in range
            if (slotIdx < skeletonData.slots.length) {
              slotName = skeletonData.slots[slotIdx].name;
            }
            found = true;
            break;
          }
        }
        if (found) break;
      }

      const cd = load.canonicalDimsByRegion?.get(attachmentName);
      const canonicalW = cd?.canonicalW ?? 1;
      const canonicalH = cd?.canonicalH ?? 1;
      const SETUP_LABEL = 'Setup Pose (Default)';

      const stubRow: DisplayRow & { isMissing: true } = {
        attachmentKey: `${skinName}/${slotName}/${attachmentName}`,
        skinName,
        slotName,
        attachmentName,
        animationName: SETUP_LABEL,
        time: 0,
        frame: 0,
        peakScaleX: 0,
        peakScaleY: 0,
        peakScale: 0,
        worldW: 0,
        worldH: 0,
        sourceW: canonicalW,
        sourceH: canonicalH,
        isSetupPosePeak: true,
        originalSizeLabel: `${canonicalW}×${canonicalH}`,
        peakSizeLabel: '0×0',
        scaleLabel: '0.000×',
        sourceLabel: SETUP_LABEL,
        frameLabel: '—',
        sourcePath: '',
        canonicalW,
        canonicalH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isMissing: true,
      };
      peaksArray.push(stubRow);
      presentNames.add(attachmentName); // prevent duplicates if skippedAttachments has dupes
    }
  }

  // Phase 3 Plan 01 — fold the per-animation + setup-pose sampler maps into
  // AnimationBreakdown[] (F4.1/F4.2/F4.3). boneChainPath walks slot.bone.parent
  // so we materialize a Skeleton here — SkeletonData alone does not carry
  // Bone.parent wiring; spine-core's Skeleton constructor resolves it. Cheap
  // (<1 ms on SIMPLE_TEST), runs once per load.
  const skeleton = new Skeleton(load.skeletonData);
  const animationBreakdownRaw = analyzeBreakdown(
    sampled.perAnimation,
    sampled.setupPosePeaks,
    load.skeletonData,
    skeleton.slots,
    load.sourcePaths,
    load.atlasSources,
    // Phase 22 DIMS-01 — same canonical/actual dim threading as analyze() above.
    load.canonicalDimsByRegion,
    load.actualDimsByRegion,
  );
  // Phase 25 PANEL-03 — mark stub rows with isMissing: true instead of filtering.
  // Rows whose PNG was missing at load time remain visible in both main panels;
  // the 'missing' RowState variant in the renderer carries the danger signal.
  //
  // Gap-fix: also synthesize BreakdownRow stubs for missing attachments not in
  // any card's rows (same root cause as peaksArray gap-fix above — sampler skips
  // stub attachments so analyzeBreakdown never produces rows for them). The stubs
  // are injected into the setup-pose card only (first card, cardId='setup-pose'),
  // sorted to the end of the existing rows so existing sort-by-peakScale is
  // preserved for the non-missing rows.
  const animationBreakdown = animationBreakdownRaw.map((card) => {
    const rows: (BreakdownRow & { isMissing?: boolean })[] = card.rows.map((r) => ({
      ...r,
      isMissing: skippedNames.has(r.attachmentName) ? true : undefined,
    }));

    // Inject missing-attachment stubs into the setup-pose card.
    if (card.cardId === 'setup-pose' && skippedNames.size > 0) {
      const presentInCard = new Set(rows.map((r) => r.attachmentName));
      for (const entry of (load.skippedAttachments ?? [])) {
        const { name: attachmentName } = entry;
        if (presentInCard.has(attachmentName)) continue;

        // Find skin/slot (same walk as peaksArray stub synthesis above).
        let skinName = 'default';
        let slotName = attachmentName;
        for (const skin of skeletonData.skins) {
          let found = false;
          for (let slotIdx = 0; slotIdx < skin.attachments.length; slotIdx++) {
            const perSlot = skin.attachments[slotIdx];
            if (perSlot === undefined || perSlot === null) continue;
            if (Object.prototype.hasOwnProperty.call(perSlot, attachmentName)) {
              skinName = skin.name;
              if (slotIdx < skeletonData.slots.length) {
                slotName = skeletonData.slots[slotIdx].name;
              }
              found = true;
              break;
            }
          }
          if (found) break;
        }

        const cd = load.canonicalDimsByRegion?.get(attachmentName);
        const canonicalW = cd?.canonicalW ?? 1;
        const canonicalH = cd?.canonicalH ?? 1;
        const SETUP_LABEL = 'Setup Pose (Default)';

        const stubBreakdownRow: BreakdownRow & { isMissing: true } = {
          attachmentKey: `${skinName}/${slotName}/${attachmentName}`,
          skinName,
          slotName,
          attachmentName,
          animationName: SETUP_LABEL,
          time: 0,
          frame: 0,
          peakScaleX: 0,
          peakScaleY: 0,
          peakScale: 0,
          worldW: 0,
          worldH: 0,
          sourceW: canonicalW,
          sourceH: canonicalH,
          isSetupPosePeak: true,
          originalSizeLabel: `${canonicalW}×${canonicalH}`,
          peakSizeLabel: '0×0',
          scaleLabel: '0.000×',
          sourceLabel: SETUP_LABEL,
          frameLabel: '—',
          sourcePath: '',
          canonicalW,
          canonicalH,
          actualSourceW: undefined,
          actualSourceH: undefined,
          dimsMismatch: false,
          bonePath: [slotName, attachmentName],
          bonePathLabel: `${slotName} → ${attachmentName}`,
          isMissing: true,
        };
        rows.push(stubBreakdownRow);
        presentInCard.add(attachmentName);
      }
    }

    return {
      ...card,
      rows,
      uniqueAssetCount: rows.length,
    };
  });

  // Phase 24 PANEL-01 — orphaned file detection (D-01, D-02, D-05).
  // I/O layer: this is the ONLY place that touches fs.readdirSync / fs.statSync
  // for orphan detection. The pure helper src/core/usage.ts:findOrphanedFiles
  // receives pre-collected arrays and performs zero I/O (CLAUDE.md #5).
  const skeletonDir = path.dirname(load.skeletonPath);
  const imagesDir = path.join(skeletonDir, 'images');

  // Step 1 (D-02): read images/ folder → collect PNG basenames (no extension).
  let imagesFolderFiles: string[] = [];
  try {
    const entries = fs.readdirSync(imagesDir);
    imagesFolderFiles = entries
      .filter((e) => e.toLowerCase().endsWith('.png'))
      .map((e) => e.slice(0, -4)); // strip ".png"
  } catch {
    // images/ does not exist → no orphaned files → panel hidden (D-03).
    imagesFolderFiles = [];
  }

  // Step 2 (D-02): build in-use name set — depends on mode (D-03).
  const inUseNames = new Set<string>();
  if (load.atlasPath !== null) {
    // Atlas-mode: in-use = union of atlas region names (the manifest authority).
    for (const region of load.atlas!.regions) {
      inUseNames.add(region.name);
    }
  } else {
    // Atlas-less mode: in-use = textured attachment names from skins.
    // Non-textured filter proxy: load.sourceDims.get(name) !== undefined
    // (same proxy as old findUnusedAttachments:117 — BoundingBox/Path/Clipping/Point
    // have no sourceDims entry and are excluded; D-02 step 2 spec).
    for (const skin of load.skeletonData.skins) {
      for (const perSlot of skin.attachments) {
        if (perSlot === undefined || perSlot === null) continue;
        for (const attachmentName of Object.keys(perSlot)) {
          if (load.sourceDims.get(attachmentName) !== undefined) {
            inUseNames.add(attachmentName);
          }
        }
      }
    }
  }

  // Step 3 (D-02): orphaned = PNG filenames NOT in inUseNames.
  const orphanedBasenames = findOrphanedFiles(imagesFolderFiles, inUseNames);

  // Augment with on-disk byte size via fs.statSync (same pattern as the old
  // bytesOnDisk augmentation — summary.ts is the sole writer).
  const orphanedFiles = orphanedBasenames.map((filename) => {
    const pngPath = path.join(imagesDir, filename + '.png');
    let bytesOnDisk = 0;
    try {
      bytesOnDisk = fs.statSync(pngPath).size;
    } catch {
      // ENOENT / EACCES — treat as 0 (same silent pattern as old block).
      bytesOnDisk = 0;
    }
    return { filename, bytesOnDisk };
  });

  return {
    skeletonPath: load.skeletonPath,
    atlasPath: load.atlasPath,
    bones: {
      count: skeletonData.bones.length,
      names: skeletonData.bones.map((b) => b.name),
    },
    slots: { count: skeletonData.slots.length },
    attachments: { count: attachmentCount, byType },
    skins: {
      count: skeletonData.skins.length,
      names: skeletonData.skins.map((s) => s.name),
    },
    animations: {
      count: skeletonData.animations.length,
      names: skeletonData.animations.map((a) => a.name),
    },
    // Phase 20 D-09 — auto-discovery source for the documentation events
    // sub-section. Reads from spine-core SkeletonData.events: EventData[]
    // (verified in node_modules/@esotericsoftware/spine-core/dist/SkeletonData.d.ts:55-56).
    events: {
      count: skeletonData.events.length,
      names: skeletonData.events.map((e) => e.name),
    },
    peaks: peaksArray,
    animationBreakdown,
    orphanedFiles,
    /**
     * Phase 25 Plan 25-01 — surface skipped-PNG attachments to the
     * renderer (MissingAttachmentsPanel). Always-present array (defaulted
     * to [] when LoadResult.skippedAttachments is undefined per Plan 21-09
     * ISSUE-007 OPTIONAL field). peaks / animationBreakdown.rows are
     * marked with isMissing: true for stub-region attachments (Phase 25
     * marking contract) — they remain visible in both main panels.
     */
    skippedAttachments: load.skippedAttachments ?? [],
    elapsedMs,
    /**
     * Phase 9 Plan 06 — surface the loader's `editorFps` (from
     * `skeletonData.fps || 30`, see src/core/loader.ts:225-229) through the
     * summary so the renderer rig-info tooltip can display
     * `skeleton.fps: <N> (editor metadata — does not affect sampling)`. The
     * value is INFORMATIONAL — sampling rate is `samplingHz`, not `fps`
     * (CLAUDE.md fact #1).
     */
    editorFps: load.editorFps,
  };
}
