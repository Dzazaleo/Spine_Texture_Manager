/**
 * Phase 6 Plan 03 — Pure-TS export-plan builder (D-108..D-111).
 *
 * Folds SkeletonSummary.peaks (DisplayRow[]) + Phase 4 overrides Map +
 * Phase 5 unusedAttachments list into a deduped ExportRow[] keyed by
 * source PNG path (D-108).
 *
 * Algorithm:
 *   1. Build excluded set from summary.unusedAttachments (D-109; bypassable
 *      via opts.includeUnused for future Settings toggle).
 *   2. Walk summary.peaks: skip rows whose attachmentName is excluded.
 *      For each survivor compute effectiveScale (D-111: applyOverride or
 *      peakScale fallback) and clamp to ≤1.0 (Gap-Fix #1 — see below);
 *      group by sourcePath; per group keep the row with the highest
 *      effectiveScale and union all attachmentNames.
 *   3. Emit ExportRow per group with outW/outH = Math.round(sourceW ×
 *      effectiveScale) (D-110 uniform — anisotropic export breaks Spine UV
 *      sampling; locked memory). outPath is RELATIVE — 'images/' +
 *      regionName + '.png' — image-worker.ts joins with outDir at write
 *      time (image-worker is allowed to import node:path).
 *   4. Sort by sourcePath (deterministic output across runs).
 *
 * Gap-Fix #1 (2026-04-25 human-verify Step 1) — DOWNSCALE-ONLY INVARIANT:
 *   effectiveScale is clamped to ≤ 1.0 after the override/peakScale resolution
 *   and BEFORE the dedup keep-max comparison. Per the user-locked Phase 6
 *   export sizing memory: source dimensions are the ceiling — even if the
 *   sampler computes a peakScale of 15× (e.g. an attachment dramatically
 *   zoomed in animation), the exported output is never larger than the
 *   source PNG. Images can only be reduced, never extrapolated. Anisotropic
 *   export breaks Spine UV sampling AND upscaling fabricates pixels libvips
 *   never had — both are forbidden here.
 *
 * Gap-Fix Round 5 (2026-04-25) — CEIL + CEIL-THOUSANDTH (D-110 amendment):
 *   Two refinements to the sizing math, both motivated by a 1-pixel
 *   under-allocation surfaced when JOKER/FACE peakScale = 0.36071 produced
 *   a 347-pixel-tall output (Math.round(962 × 0.36071) = 347) while the
 *   per-axis peak demanded ≥ 347.99 pixels:
 *     1. effectiveScale is rounded UP to the nearest thousandth via
 *        `Math.ceil(s * 1000) / 1000`. The displayed `0.361×` becomes a
 *        guaranteed lower bound — a user reading the panel and applying
 *        36.1% in Photoshop never produces a smaller image than the app
 *        exports. Applied AFTER override/peakScale resolution and BEFORE
 *        the ≤ 1.0 clamp (so the clamp still binds after rounding up).
 *     2. Output dims use `Math.ceil(sourceDim × effectiveScale)` instead
 *        of `Math.round(...)`. Math.round can drop a pixel when the
 *        fractional product is < .5 (962 × 0.36071 = 346.99 → round = 347),
 *        leaving the export below the per-axis peak demand. Math.ceil
 *        guarantees output dim ≥ per-axis peak demand on both axes.
 *   D-110 invariant unchanged: same effectiveScale on both axes preserves
 *   aspect ratio. Sub-pixel deviation only — Lanczos3 unaffected.
 *
 * Layer 3 hygiene: NO imports of node:fs, node:path, sharp, electron, or
 * @esotericsoftware/spine-core (runtime). Type-only imports from
 * '../shared/types.js' and a runtime import of './overrides.js' are the
 * only allowed dependencies. Enforced by tests/core/export.spec.ts hygiene
 * grep block + tests/arch.spec.ts Layer 3 gate (Plan 06-01).
 *
 * Callers:
 *   - src/main/ipc.ts handleStartExport receives an already-built ExportPlan
 *     from the renderer (Plan 06-05) — main does NOT call this function.
 *   - src/renderer/src/lib/export-view.ts is the byte-identical renderer
 *     copy; AppShell.tsx calls it from the toolbar click handler (Plan 06-06).
 */
import type {
  DisplayRow,
  ExportPlan,
  ExportRow,
  SkeletonSummary,
} from '../shared/types.js';
import { applyOverride } from './overrides.js';

export interface BuildExportPlanOptions {
  /** Default false (D-109). Future Settings toggle path. */
  includeUnused?: boolean;
}

/**
 * Build the deduped export plan from a SkeletonSummary + overrides Map.
 *
 * INVARIANT (Gap-Fix #1, user-locked Phase 6 export sizing memory):
 *   For every emitted ExportRow: `effectiveScale ≤ 1.0`. Source dimensions
 *   are the CEILING — exports may downscale (effectiveScale ∈ (0, 1]) but
 *   may NEVER upscale beyond the source PNG's pixel dimensions. A peakScale
 *   of 5× still produces outW=sourceW (clamped to 1.0). This is locked
 *   policy: anisotropic export breaks Spine UV sampling AND extrapolating
 *   pixels libvips never had degrades quality vs simply shipping the source.
 *
 * D-110 uniform sizing (Round 5 refinement):
 *   effectiveScale is rounded UP to the nearest thousandth (so the displayed
 *   `0.361×` is a guaranteed lower bound), then output dims are computed as
 *   `Math.ceil(sourceDim × effectiveScale)` (so the export is never below the
 *   per-axis peak demand). Same effectiveScale on both axes — aspect ratio
 *   preserved within sub-pixel tolerance.
 *
 * D-108 dedup: one ExportRow per unique sourcePath; the kept effectiveScale
 * is max(post-clamp) across all attachments referencing that source.
 *
 * D-109 unused exclusion: summary.unusedAttachments is subtracted by default
 * (opts.includeUnused defaults to false).
 */

/**
 * Derive the relative output path from a DisplayRow's sourcePath.
 *
 * sourcePath was constructed by `src/core/loader.ts` Plan 06-02 as
 * `path.resolve(<skeletonDir>/images/<regionName>.png)`. Splitting on
 * `/images/` (or the Windows `\images\` equivalent — handle both for
 * cross-platform safety despite Phase 6 being macOS-only at the build
 * layer) and taking the suffix yields `<regionName>.png` (with subfolders
 * preserved if regionName contained '/'). The image-worker (Plan 06-04)
 * joins this with the user's chosen outDir + 'images/' to produce the
 * absolute write path while preserving F8.3 layout.
 */
function relativeOutPath(sourcePath: string): string {
  // Normalize path separators for cross-platform safety. Pure-TS — no node:path.
  const normalized = sourcePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/images/');
  const regionPart = idx >= 0 ? normalized.slice(idx + '/images/'.length) : normalized.slice(normalized.lastIndexOf('/') + 1);
  return 'images/' + regionPart;
}

/**
 * Gap-Fix Round 5 (2026-04-25) — round effectiveScale UP to the nearest
 * thousandth. The displayed `0.361×` (in the panel Scale column, via
 * src/core/analyzer.ts) becomes a guaranteed lower bound: a user reading
 * the panel and applying 36.1% in Photoshop never produces a smaller image
 * than the app exports. Single source of truth so both the math (here) and
 * the display (analyzer.ts scaleLabel) round identically.
 *
 * Pure helper — no side effects, no dependencies. Mirrored byte-identically
 * in src/renderer/src/lib/export-view.ts to preserve the parity contract.
 */
export function safeScale(s: number): number {
  return Math.ceil(s * 1000) / 1000;
}

export function buildExportPlan(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts?: BuildExportPlanOptions,
): ExportPlan {
  const includeUnused = opts?.includeUnused ?? false;

  // 1. Excluded set (D-109).
  const excluded = new Set<string>();
  if (!includeUnused && summary.unusedAttachments) {
    for (const u of summary.unusedAttachments) excluded.add(u.attachmentName);
  }

  // 2. Group by sourcePath; per group keep highest-effective-scale row +
  //    union attachmentNames (D-108).
  //
  // Phase 22.1 G-04 + G-07 D-06 — Acc no longer carries `isPassthrough`
  // (moved to emit loop where final outW/outH are known). Acc gains `isCapped`
  // (computed here from cap math; threaded to ExportRow.isCapped for
  // OptimizeDialog cap-binding signal per D-07).
  interface Acc {
    row: DisplayRow;
    effScale: number;
    isCapped: boolean;  // true when downscaleClampedScale > sourceRatio
    attachmentNames: string[];
  }
  const bySourcePath = new Map<string, Acc>();
  for (const row of summary.peaks) {
    if (excluded.has(row.attachmentName)) continue;
    if (!row.sourcePath) continue; // defensive — Plan 06-02 guarantees populated, but skip empty rather than emit a bad row.
    // D-111: override-via-applyOverride or fall back to peakScale.
    const overridePct = overrides.get(row.attachmentName);
    const rawEffScale =
      overridePct !== undefined
        ? applyOverride(overridePct).effectiveScale
        : row.peakScale;
    // Gap-Fix Round 5 (2026-04-25): round UP to nearest thousandth FIRST so
    // the displayed `0.361×` is a guaranteed lower bound the export math
    // also uses. THEN apply the Gap-Fix #1 (2026-04-25) clamp to ≤ 1.0
    // BEFORE the dedup keep-max comparison so two attachments sharing one
    // source PNG with peaks 0.8 and 5.0 both fold to 1.0 (the ceiling)
    // rather than the dedup accidentally promoting one to the source
    // ceiling and leaving the other reading the unclamped 5.0 value.
    // User-locked Phase 6 export sizing memory: source dims are the
    // ceiling, never extrapolate.
    const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);

    // Phase 22 DIMS-03 cap — uniform multiplier from min(actualSource/canonical)
    // on both axes when dimsMismatch && actualSource defined. Locked memory
    // project_phase6_default_scaling.md: cap is single uniform multiplier from
    // min(...), NEVER per-axis (per-axis would distort aspect ratio and break
    // Spine UV sampling). Honors "never extrapolate" by ALSO bounding
    // effectiveScale below actual source dims (Phase 6 Round 1 only bounded by
    // canonical; Phase 22 extends the same invariant to actualSource).
    //
    // Phase 22.1 G-04 + G-07 D-06 — partition decision moved to emit loop
    // (post-override resolution + post-cap). Phase 22 D-04 REVISED branch
    // `peakAlreadyAtOrBelowSource` deleted as vestigial: after 22.1-01's
    // unified actualSource model (sourceW === actualSourceW in BOTH modes),
    // sourceRatio === 1.0 in atlas-source mode and the cap is effectively
    // inert. The simple `isPassthrough = (outW === sourceW AND outH === sourceH)`
    // predicate in the emit loop IS the correct partition. Cap math KEPT
    // as defense-in-depth — preserves "outW ≤ sourceW always" regardless
    // of future loader edits. See CONTEXT D-06 + 22.1-01-SUMMARY.md §"Phase 22
    // Cap Math — Vestigiality Confirmation".
    const { actualSourceW, actualSourceH, canonicalW, canonicalH } = row;
    const sourceRatio =
      row.dimsMismatch && actualSourceW !== undefined && actualSourceH !== undefined
        ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
        : Infinity;
    const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);
    const isCapped = downscaleClampedScale > sourceRatio;

    const effScale = cappedEffScale;
    const prev = bySourcePath.get(row.sourcePath);
    if (prev === undefined) {
      bySourcePath.set(row.sourcePath, {
        row,
        effScale,
        isCapped,
        attachmentNames: [row.attachmentName],
      });
    } else {
      if (effScale > prev.effScale) {
        prev.row = row;
        prev.effScale = effScale;
        prev.isCapped = isCapped;
      }
      if (!prev.attachmentNames.includes(row.attachmentName)) {
        prev.attachmentNames.push(row.attachmentName);
      }
    }
  }

  // 3. Emit ExportRows. D-110: same effectiveScale on both axes.
  // Gap-Fix Round 5 (2026-04-25): Math.ceil instead of Math.round so the
  //    output dim is never below the per-axis peak demand. Math.round drops
  //    a pixel when sourceDim × effScale < .5 (e.g. 962 × 0.36071 = 346.99
  //    → round = 347, but the per-axis peak demanded ≥ 347.99). Aspect
  //    ratio is preserved within sub-pixel tolerance (uniform effScale
  //    across both axes; ceil applied per-axis).
  // Gap-Fix #2: thread atlasSource through from the winning DisplayRow so
  //    the image-worker can fall back to atlas-page extraction when the
  //    per-region PNG doesn't exist on disk.
  //
  // Phase 22.1 G-04 + G-07 D-06 — generalized passthrough predicate,
  // evaluated AFTER override resolution AND cap math. Covers:
  //   (a) TRIANGLE no-drift peakScale=1.0× → outW = sourceW → passthrough
  //   (b) drifted row, no override → cap binds → outW = sourceW → passthrough
  //   (c) drifted row, 50% override → outW < sourceW → resize
  //   (d) drifted row, 100% override → outW = sourceW → passthrough
  // After 22.1-01's unified model (sourceW === actualSourceW everywhere),
  // the Phase 22 cap math reduces to a no-op in atlas-source mode; this
  // predicate IS the partition.
  const rows: ExportRow[] = [];
  const passthroughCopies: ExportRow[] = [];
  for (const acc of bySourcePath.values()) {
    const outW = Math.ceil(acc.row.sourceW * acc.effScale);
    const outH = Math.ceil(acc.row.sourceH * acc.effScale);
    // G-04 + G-07 D-06 (Phase 22.1) — generalized passthrough predicate,
    // evaluated AFTER override resolution AND cap math.
    const isPassthrough = outW === acc.row.sourceW && outH === acc.row.sourceH;
    const exportRow: ExportRow = {
      sourcePath: acc.row.sourcePath,
      outPath: relativeOutPath(acc.row.sourcePath),
      sourceW: acc.row.sourceW,
      sourceH: acc.row.sourceH,
      outW,
      outH,
      effectiveScale: acc.effScale,
      attachmentNames: acc.attachmentNames.slice(),
      ...(acc.row.atlasSource ? { atlasSource: acc.row.atlasSource } : {}),
      // Phase 22 DIMS-04 (CHECKER FIX 2026-05-02) — propagate actualSourceW/H
      // onto passthrough rows so OptimizeDialog (Plan 22-05 Task 2 Step 1) can
      // render the "already optimized" label with concrete on-disk dims (e.g.
      // 811×962) instead of canonical dims (e.g. 1628×1908). Non-passthrough
      // rows skip the spread — fields stay undefined, matching the
      // "passthrough-only semantics" docblock on the optional ExportRow
      // fields. The conditional spread mirrors the existing atlasSource
      // pattern above. Plan 22-04 export-view.ts mirrors this byte-identically.
      ...(isPassthrough && acc.row.actualSourceW !== undefined && acc.row.actualSourceH !== undefined
        ? { actualSourceW: acc.row.actualSourceW, actualSourceH: acc.row.actualSourceH }
        : {}),
      // Phase 22.1 G-07 D-07 — cap-binding signal for OptimizeDialog row label.
      ...(acc.isCapped ? { isCapped: true } : {}),
    };
    if (isPassthrough) {
      passthroughCopies.push(exportRow);
    } else {
      rows.push(exportRow);
    }
  }

  // 4. Sort by sourcePath for deterministic output.
  rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  passthroughCopies.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  // excludedUnused: sorted, deduped (Set already dedups).
  const excludedUnused = [...excluded].sort((a, b) => a.localeCompare(b));

  return {
    rows,
    excludedUnused,
    passthroughCopies,
    totals: { count: rows.length + passthroughCopies.length },
  };
}
