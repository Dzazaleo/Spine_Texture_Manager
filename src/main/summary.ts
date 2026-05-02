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
import type { SkeletonSummary } from '../shared/types.js';
import { analyze, analyzeBreakdown } from '../core/analyzer.js';
import { findUnusedAttachments } from '../core/usage.js';
import * as fs from 'node:fs';

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

  // Phase 21 Plan 21-10 G-02 — set of attachment names whose PNG was missing
  // in atlas-less mode (from Plan 21-09's LoadResult.skippedAttachments).
  // peaks / animationBreakdown.rows / unusedAttachments are filtered to
  // exclude these; the missing attachments are surfaced ONLY via
  // SkeletonSummary.skippedAttachments below, which the renderer's
  // MissingAttachmentsPanel reads. LoadResult.skippedAttachments is
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
  const peaksArrayRaw = analyze(sampled.globalPeaks, load.sourcePaths, load.atlasSources);
  // Phase 21 Plan 21-10 G-02 — drop stub-region attachments from the regular
  // Global panel; they surface only via skippedAttachments below.
  const peaksArray = peaksArrayRaw.filter((p) => !skippedNames.has(p.attachmentName));

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
  );
  // Phase 21 Plan 21-10 G-02 — filter each animation card's rows to drop
  // stub-region attachments. uniqueAssetCount is recomputed to match
  // (rows.length is the contractual source of truth; D-58/AnimationBreakdown
  // docblock at src/shared/types.ts:150-152). isSetupPose / animationName /
  // cardId pass through unchanged.
  const animationBreakdown = animationBreakdownRaw.map((card) => {
    const filteredRows = card.rows.filter((r) => !skippedNames.has(r.attachmentName));
    return {
      ...card,
      rows: filteredRows,
      uniqueAssetCount: filteredRows.length,
    };
  });

  // Phase 5 Plan 02 — F6.1 unused-attachment detection. Pure projection per
  // D-35 / D-101: the core module owns the algorithm; summary.ts just
  // threads the result into the IPC payload.
  //
  // Phase 19 UI-04 (D-13) — augment each row with on-disk byte size for the
  // MB-savings callout. Layer 3 invariant: this happens here in summary.ts
  // (which is allowed to do file I/O) AFTER core/usage.ts returns its raw
  // rows; core/usage.ts stays 100% untouched. The interface field
  // `bytesOnDisk?: number` is optional (Plan 19-01), so core's existing
  // construction satisfies the contract; summary.ts is the SOLE writer.
  // fs.statSync is synchronous to match summary.ts' existing sync shape —
  // total cost is one stat per unused row (~µs each), well below the
  // sampler work upstream. When the path is missing OR resolves to a
  // shared atlas page (atlas-packed projects per D-15), bytesOnDisk = 0 —
  // the renderer suppresses the MB suffix and falls back to count-only
  // copy via the `(u.bytesOnDisk ?? 0)` reader.
  const rawUnused = findUnusedAttachments(load, sampled);
  // Phase 21 Plan 21-10 G-02 — drop skipped-PNG attachments from the
  // unused-attachments list. Different semantic from "unused" (skipped means
  // PNG missing in atlas-less mode; unused means never rendered) — skipped
  // attachments are surfaced separately via skippedAttachments below.
  const unusedAttachments = rawUnused
    .filter((u) => !skippedNames.has(u.attachmentName))
    .map((u) => {
      const path = load.sourcePaths.get(u.attachmentName);
      let bytesOnDisk = 0;
      if (path !== undefined) {
        try {
          bytesOnDisk = fs.statSync(path).size;
        } catch {
          // ENOENT / EACCES / atlas-page resolves elsewhere — D-15: treat as 0
          // (no MB suffix in renderer callout). Silent — recent.json-style
          // non-critical UX state (D-177 carry-over rationale).
          bytesOnDisk = 0;
        }
      }
      return { ...u, bytesOnDisk };
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
    unusedAttachments,
    /**
     * Phase 21 Plan 21-10 G-02 — surface skipped-PNG attachments to the
     * renderer (MissingAttachmentsPanel). Always-present array (defaulted
     * to [] when LoadResult.skippedAttachments is undefined per Plan 21-09
     * ISSUE-007 OPTIONAL field). peaks / animationBreakdown.rows /
     * unusedAttachments above are pre-filtered by skippedNames so stub-
     * region attachments do NOT double-count into the regular panels.
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
