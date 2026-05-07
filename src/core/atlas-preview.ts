/**
 * Phase 7 Plan 02 — Pure-TS atlas-preview projection builder (D-124..D-132 + D-136 + D-137).
 *
 * Folds SkeletonSummary.peaks (DisplayRow[]) + Phase 4 overrides Map +
 * Phase 5 unusedAttachments list into AtlasPreviewInput[] (per the chosen
 * mode), runs maxrects-packer with hardcoded params, and emits the per-page
 * AtlasPreviewProjection.
 *
 * Algorithm:
 *   1. Build excluded set from summary.unusedAttachments (D-109 parity —
 *      same exclusion as buildExportPlan).
 *   2. Derive AtlasPreviewInput[] per mode:
 *      - 'original': dims = atlasSource.w/h (atlas-packed) or sourceW/H
 *        (per-region PNG) — D-124 + D-126.
 *      - 'optimized': dims = ExportRow.outW/outH from buildExportPlan —
 *        D-125 single-source-of-truth with Phase 6.
 *   3. Sort inputs by sourcePath then attachmentName (deterministic packer
 *      output across two runs over the same SkeletonSummary; mirrors
 *      src/core/export.ts:223).
 *   4. Construct MaxRectsPacker(maxPageDim, maxPageDim, 2, { smart: true,
 *      allowRotation: false, pot: false, square: false, border: 0 }) —
 *      D-132 hardcoded params + RESEARCH Recommendation A (tight-fit bin
 *      sizing for honest efficiency calc).
 *   5. packer.add(packW, packH, input) per region; fold packer.bins[] into
 *      AtlasPage[] with per-page efficiency = sum(rect.w × rect.h) /
 *      (bin.width × bin.height) × 100.
 *   6. D-136 degenerate input → emit at least one empty page so the modal
 *      always has something to render.
 *
 * Layer 3 hygiene (CLAUDE.md rule #5): NO imports of node:fs, node:path,
 * sharp, electron, @esotericsoftware/spine-core (runtime), or DOM types.
 * Type-only imports from '../shared/types.js' and runtime imports of
 * './export.js' (for buildExportPlan reuse) + 'maxrects-packer' (verified
 * browser-safe by RESEARCH tarball audit) are the only allowed dependencies.
 * Enforced by tests/core/atlas-preview.spec.ts hygiene grep block +
 * tests/arch.spec.ts Layer 3 gate (auto-scans src/core/**).
 *
 * Callers:
 *   - src/renderer/src/lib/atlas-preview-view.ts is the byte-identical
 *     renderer copy (Phase 4 D-75 / Phase 6 D-108 inline-copy precedent).
 *     AtlasPreviewModal.tsx (Plan 04) calls it on mount + on every
 *     toggle/pager change.
 */
import type {
  AtlasPage,
  AtlasPreviewInput,
  AtlasPreviewProjection,
  PackedRegion,
  SkeletonSummary,
} from '../shared/types.js';
import { buildExportPlan } from './export.js';
import { MaxRectsPacker } from 'maxrects-packer';

/**
 * Build the per-page atlas-preview projection for the chosen mode + page-dim cap.
 *
 * @param summary  SkeletonSummary with peaks (DisplayRow[]) + unusedAttachments.
 * @param overrides Map<attachmentName, percent> — same shape AppShell owns.
 * @param opts     mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096.
 * @returns AtlasPreviewProjection — structuredClone-safe (Phase 1 D-21).
 */
export function buildAtlasPreview(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts: { mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096 },
): AtlasPreviewProjection {
  // Phase 24 Plan 01: unusedAttachments removed from SkeletonSummary.
  // The excluded set is now always empty — D-109 semantics are superseded by
  // Phase 24's orphanedFiles concept. Plan 02 will wire the new exclusion.
  const excluded = new Set<string>();

  // 2. Derive AtlasPreviewInput[] per mode.
  const allInputs: AtlasPreviewInput[] = deriveInputs(summary, overrides, opts.mode, excluded);

  // 2a. D-139 follow-up: filter inputs whose packed dims exceed maxPageDim on
  // either axis. The packer would otherwise expand the bin past the cap to fit
  // them — masking a real export failure and producing a misleading preview.
  // Phase 29 D-03: oversize is collected as regionName (one tile per region;
  // inp.attachmentNames carries the contributors). Renders to "X regions
  // exceed the Ypx atlas" banner copy.
  const oversize: string[] = [];
  const inputs: AtlasPreviewInput[] = [];
  for (const inp of allInputs) {
    if (inp.packW > opts.maxPageDim || inp.packH > opts.maxPageDim) {
      oversize.push(inp.regionName);
    } else {
      inputs.push(inp);
    }
  }
  oversize.sort();

  // 3. Determinism: sort by sourcePath then regionName so two runs over the
  //    same summary produce byte-identical packer output (matches src/core/export.ts:223).
  inputs.sort((a, b) => {
    const cmp = a.sourcePath.localeCompare(b.sourcePath);
    return cmp !== 0 ? cmp : a.regionName.localeCompare(b.regionName);
  });

  // 4. D-132 hardcoded packer params + RESEARCH Recommendation A (pot:false, square:false).
  const packer = new MaxRectsPacker(opts.maxPageDim, opts.maxPageDim, 2, {
    smart: true,
    allowRotation: false,
    pot: false,        // tight-fit bin sizing (RESEARCH Pitfall 7)
    square: false,     // tight-fit bin sizing (RESEARCH Pitfall 7)
    border: 0,
  });
  for (const inp of inputs) {
    packer.add(inp.packW, inp.packH, inp);
  }

  // 5. Fold packer.bins[] → AtlasPage[] with per-page efficiency.
  const pages: AtlasPage[] = packer.bins.map((bin, pageIndex) => {
    const regions: PackedRegion[] = bin.rects.map((r) => {
      const inp = (r as unknown as { data: AtlasPreviewInput }).data;
      return {
        regionName: inp.regionName,
        attachmentNames: inp.attachmentNames,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        sourcePath: inp.sourcePath,
        ...(inp.atlasSource ? { atlasSource: inp.atlasSource } : {}),
      };
    });
    const usedPixels = regions.reduce((sum, reg) => sum + reg.w * reg.h, 0);
    const totalPixels = bin.width * bin.height;
    const efficiency = totalPixels > 0 ? (usedPixels / totalPixels) * 100 : 0;
    return {
      pageIndex,
      width: bin.width,
      height: bin.height,
      regions,
      usedPixels,
      totalPixels,
      efficiency,
    };
  });

  // 6. D-136: degenerate empty input → emit at least one page.
  if (pages.length === 0) {
    pages.push({
      pageIndex: 0,
      width: 0,
      height: 0,
      regions: [],
      usedPixels: 0,
      totalPixels: 0,
      efficiency: 0,
    });
  }

  return {
    mode: opts.mode,
    maxPageDim: opts.maxPageDim,
    pages,
    totalPages: pages.length,
    oversize,
  };
}

/**
 * Derive the per-mode input list. Excludes unused attachments (D-109 parity).
 * For 'optimized', delegates to buildExportPlan so atlas-preview's outW/outH
 * are byte-identical with Phase 6's export pipeline (D-125).
 * For 'original', reads sourceW/H from DisplayRow OR atlasSource.w/h for
 * atlas-packed regions (D-124 + D-126).
 */
function deriveInputs(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  mode: 'original' | 'optimized',
  excluded: Set<string>,
): AtlasPreviewInput[] {
  if (mode === 'optimized') {
    // D-125: outW/outH come from buildExportPlan — single source of truth with Phase 6.
    // buildExportPlan ALREADY excludes summary.unusedAttachments per D-109, but we
    // re-apply the filter here for symmetry with the 'original' branch.
    //
    // Phase 29 D-03 (PREVIEW-01): emit ONE AtlasPreviewInput per ExportRow
    // (region-keyed) instead of one per attachmentName. ExportRow.attachmentNames[]
    // is the per-region contributor list — we forward it as the input's
    // `attachmentNames` field for hit-test attribution. This makes atlas-preview
    // page count match the actual atlas page count for path-indirected projects
    // (Chicken: 13 pages, not 14).
    //
    // Why both rows + passthroughCopies: buildExportPlan splits scale=1.0× rows
    // (no-resize, byte-copy at export) into passthroughCopies. They still occupy
    // atlas space at their source dims — the user opens the optimized preview to
    // see total page count / efficiency, so dropping them would understate the
    // atlas size and hide images that ship unchanged.
    const plan = buildExportPlan(summary, overrides);
    const out: AtlasPreviewInput[] = [];
    for (const row of [...plan.rows, ...plan.passthroughCopies]) {
      // ExportRow is region-keyed via sourcePath. row.attachmentNames[] is the
      // contributor list — emit ONE input per row, not one per attachment.
      const filteredNames = row.attachmentNames.filter((n) => !excluded.has(n));
      if (filteredNames.length === 0) continue;
      // Look up regionName from summary.regions (Plan 29-01) via sourcePath join.
      // Defensive — should not happen post-29-01: every ExportRow.sourcePath
      // has a matching RegionRow.sourcePath.
      const regionRow = summary.regions.find((r) => r.sourcePath === row.sourcePath);
      if (!regionRow) continue;
      out.push({
        regionName: regionRow.regionName,
        attachmentNames: filteredNames,
        sourceW: regionRow.sourceW,
        sourceH: regionRow.sourceH,
        outW: row.outW,
        outH: row.outH,
        packW: row.outW,
        packH: row.outH,
        sourcePath: row.sourcePath,
        ...(row.atlasSource ? { atlasSource: row.atlasSource } : {}),
      });
    }
    return out;
  }

  // mode === 'original': walk summary.regions (Plan 29-01) for one-tile-per-region
  // symmetry with the optimized branch. Source dims come from the RegionRow
  // (D-124 + D-126: atlasSource.w/h for atlas-packed regions; sourceW/H otherwise).
  const out: AtlasPreviewInput[] = [];
  for (const region of summary.regions) {
    // Filter excluded — emit only when at least one contributing attachment is NOT excluded.
    const filteredNames = region.contributingAttachments
      .map((c) => c.attachmentName)
      .filter((n) => !excluded.has(n));
    if (filteredNames.length === 0) continue;
    const packW = region.atlasSource ? region.atlasSource.w : region.sourceW;
    const packH = region.atlasSource ? region.atlasSource.h : region.sourceH;
    out.push({
      regionName: region.regionName,
      attachmentNames: filteredNames,
      sourceW: region.sourceW,
      sourceH: region.sourceH,
      outW: packW,        // 'original' mode: output dims === source dims
      outH: packH,
      packW,
      packH,
      sourcePath: region.sourcePath,
      ...(region.atlasSource ? { atlasSource: region.atlasSource } : {}),
    });
  }
  return out;
}
