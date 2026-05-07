/**
 * Phase 6 Plan 03 — renderer-side inline copy of the canonical
 * export-plan builder (D-108..D-111).
 *
 * Layer 3 resolution (inline duplicate — option 1 from 04-PATTERNS.md
 * §"Shared Patterns / Layer 3"; Phase 4 D-75 precedent at
 * src/renderer/src/lib/overrides-view.ts). The tests/arch.spec.ts grep
 * forbids any renderer file from taking a dependency on the pure-TS
 * math tree. Because AppShell.tsx (Plan 06-06) builds the plan from
 * local summary + overrides Map BEFORE invoking startExport, the
 * renderer gets its own byte-identical copy here instead of crossing
 * the boundary.
 *
 * Gap-Fix #1 (2026-04-25 human-verify Step 1) — DOWNSCALE-ONLY INVARIANT:
 *   effectiveScale is clamped to ≤ 1.0 after the override/peakScale resolution
 *   and BEFORE the dedup keep-max comparison. Per the user-locked Phase 6
 *   export sizing memory: source dimensions are the ceiling — even if the
 *   sampler computes a peakScale of 15× (e.g. an attachment dramatically
 *   zoomed in animation), the exported output is never larger than the
 *   source PNG. Images can only be reduced, never extrapolated.
 *
 * Gap-Fix Round 5 (2026-04-25) — CEIL + CEIL-THOUSANDTH (D-110 amendment):
 *   effectiveScale is rounded UP to nearest thousandth via `safeScale`
 *   (display lower-bound), and output dims use `Math.ceil(sourceDim ×
 *   effectiveScale)` (per-axis peak guaranteed). Aspect ratio preserved
 *   (uniform scale; ceil per-axis; sub-pixel deviation only).
 *
 * Parity contract: the exported function bodies in this file are
 * byte-identical to the canonical source module. If you modify one,
 * modify the other in the same commit. A parity describe block in
 * tests/core/export.spec.ts asserts sameness on representative inputs
 * plus signature greps against both file contents.
 *
 * Imports: type-only from '../../../shared/types.js' (erased at compile
 * time, allowed under the Layer 3 gate); runtime applyOverride from
 * the renderer's own overrides-view.ts copy — NEVER from
 * '../../../core/overrides.js' (would trip arch.spec.ts:25 grep).
 *
 * Callers (within the renderer tree only):
 *   - src/renderer/src/components/AppShell.tsx (Plan 06-06) — toolbar
 *     button click handler invokes buildExportPlan(summary, overrides)
 *     to produce the structured-clone-safe plan that gets passed to
 *     window.api.startExport(plan, outDir).
 */
import type {
  DisplayRow,
  ExportPlan,
  ExportRow,
  SkeletonSummary,
} from '../../../shared/types.js';
import { applyOverride, clampOverride } from './overrides-view.js';

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
 * from src/core/export.ts to preserve the parity contract.
 */
export function safeScale(s: number): number {
  return Math.ceil(s * 1000) / 1000;
}

/**
 * Gap-Fix Round 5 (2026-04-25) — single source of truth for "what dims will
 * this row export at" used by BOTH the panel "Peak W×H" column AND the
 * OptimizeDialog pre-flight list. Folds the override resolution + downscale
 * clamp + ceil-thousandth + per-axis ceil into one pure helper so the panel
 * never drifts from the optimize dialog.
 *
 * Inputs:
 *   - sourceW/sourceH: from DisplayRow (atlas-orig dims)
 *   - peakScale:       from DisplayRow (sampler-computed)
 *   - override:        integer percent if user set one, else undefined
 *
 * Output:
 *   - effScale: clamped ≤ 1.0, ceil-thousandth (matches scaleLabel display
 *     and matches buildExportPlan's internal effScale field exactly)
 *   - outW, outH: Math.ceil(sourceDim × effScale) (matches the export math)
 *
 * Pure — no React, no DOM. Renderer-side helper (src/renderer/src/lib/);
 * the canonical core copy of this logic lives inside buildExportPlan in
 * both src/core/export.ts and the renderer view copy above.
 */
export function computeExportDims(
  sourceW: number,
  sourceH: number,
  peakScale: number,
  override: number | undefined,
  // Phase 22 DIMS-03 (Plan 22-04) — optional cap math params. When the
  // panel passes actualSourceW/H + dimsMismatch from the DisplayRow, this
  // helper applies the same uniform cap formula as buildExportPlan below
  // (Math.min over both axes; never per-axis — locked memory
  // project_phase6_default_scaling.md). When omitted (legacy 4-arg call
  // shape), sourceRatio = Infinity and the cap is inert. Back-compat is
  // preserved: existing 4-arg call sites get unchanged behavior.
  //
  // sourceW/sourceH params here ARE canonical (post-Phase-21 contract:
  // canonical-atlas + atlas-less paths satisfy sourceW === canonicalW). When
  // the cap binds (cappedEffScale === sourceRatio = actualSourceW/canonicalW),
  // Math.ceil(canonicalW × that) === actualSourceW by construction — the
  // legacy ceil formula yields actualSource at the cap edge.
  actualSourceW?: number,
  actualSourceH?: number,
  dimsMismatch?: boolean,
  // Phase 22.1 CR-001 fix — needed for override source-ratio adjustment.
  // Override % is relative to sourceW (= actualSourceW after 22.1-01), but
  // peakScale and effScale are relative to canonicalW. Convert override to
  // canonical-relative so outW = ceil(canonicalW × effScale) yields the
  // correct source-relative output. Mirrors buildExportPlan formula verbatim.
  // When omitted (legacy call sites), defaults to sourceW (ratio = 1.0, no
  // change — back-compat preserved).
  canonicalW?: number,
  canonicalH?: number,
): { effScale: number; outW: number; outH: number; displayScale: number; peakDisplayW: number; peakDisplayH: number } {
  // Match buildExportPlan's effScale derivation exactly:
  // 1. raw effScale = (override/100) × peakScale  OR  peakScale fallback
  //    (peak-anchored — 2026-05-05 redesign; see overrides.ts docblock).
  // 2. ceil-thousandth (display lower-bound)
  // 3. clamp to ≤ 1.0 (downscale-only invariant — never extrapolate)
  // 4. Phase 22 DIMS-03 cap — uniform multiplier from min(actualSource/canonical)
  const rawEffScale =
    override !== undefined
      ? applyOverride(override, peakScale).effectiveScale
      : peakScale;
  const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);
  // Phase 22 DIMS-03 cap — uniform multiplier from min over both axes when
  // dimsMismatch && actualSource defined; Infinity otherwise (cap inert).
  // Locked memory project_phase6_default_scaling.md: cap is single uniform
  // multiplier from min(...), NEVER per-axis (per-axis would distort aspect
  // ratio and break Spine UV sampling).
  const canonW = canonicalW ?? sourceW;
  const canonH = canonicalH ?? sourceH;
  const sourceRatio =
    dimsMismatch === true && actualSourceW !== undefined && actualSourceH !== undefined
      ? Math.min(actualSourceW / canonW, actualSourceH / canonH)
      : Infinity;
  const effScale = Math.min(downscaleClampedScale, sourceRatio);
  // Math.ceil per-axis matches the export-builder; preserves aspect within
  // sub-pixel tolerance.
  const outW = Math.ceil(canonW * effScale);
  const outH = Math.ceil(canonH * effScale);
  // Source-shrink display scale (2026-05-05 redesign): the Scale column
  // answers "how much will the source PNG be reduced to reach the export
  // size?" — the on-disk shrink ratio outW / sourceW. Examples:
  //   - Source 76, export 30 → 30/76 ≈ 0.395× ("export is 39.5% of source")
  //   - Source 153, export 153 → 1.000× (no reduction needed; already at peak)
  //   - 50% peak override on Source 76, peakScale 0.5 → outW = ceil(76 × 0.25)
  //     = 19 → 19/76 ≈ 0.250× ("export is 25% of source")
  // Uses actualSourceW when the loader detected a pre-optimized on-disk file
  // (actualSourceW < canonicalW); falls back to canonW when actualSource is
  // unavailable. After optimize+reload the row's actualSourceW IS the new
  // on-disk dim, so this number stays meaningful across reload cycles
  // (1.000× = "no further reduction will happen").
  const sourceWForRatio = actualSourceW ?? canonW;
  const displayScale = sourceWForRatio > 0 ? outW / sourceWForRatio : effScale;

  // Peak display dims (2026-05-05 redesign — invariant of source PNG dims):
  //   peakDisplayW/H = ceil(canonicalW × min(safeScale(peakScale × overrideFrac), 1, sourceRatio))
  // The Peak W×H column shows what the rig DEMANDS in world-space pixels
  // (canonicalW × peakScale, override-scaled), clamped at BOTH ceilings —
  // canonical (artist asset) AND sourceRatio (on-disk PNG limit). Neither
  // can be exceeded, so the column reflects the dims the export will
  // actually produce, not a theoretical demand the user can't reach.
  //
  // 2026-05-05 amendment — clamp at sourceRatio too: the prior version
  // clamped only at canonical, so a 200% override on a pre-optimized row
  // would show Peak above source dims (e.g. L_ARM source 438, canonical
  // 548, 200% override → Peak displayed 542 even though optimize would
  // cap the export at 438). Silent cap at source matches "never extrapolate
  // beyond on-disk PNG dims" and tells the truth about what gets written.
  const overrideFrac = override !== undefined ? clampOverride(override) / 100 : 1;
  const rawPeakEff = peakScale * overrideFrac;
  // sourceRatio same shape as the export path — uniform min across both
  // axes when dimsMismatch && actualSource defined; Infinity (cap inert)
  // for canonical-no-drift rows.
  const peakDisplayEff = Math.min(safeScale(rawPeakEff), 1, sourceRatio);
  const peakDisplayW = Math.ceil(canonW * peakDisplayEff);
  const peakDisplayH = Math.ceil(canonH * peakDisplayEff);

  return { effScale, outW, outH, displayScale, peakDisplayW, peakDisplayH };
}

export function buildExportPlan(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  _opts?: BuildExportPlanOptions,
): ExportPlan {
  // Phase 24 Plan 01: unusedAttachments removed from SkeletonSummary.
  // excluded set now always empty; Plan 02 wires new exclusion surface.
  // _opts (renamed from opts to satisfy noUnusedParameters) preserves
  // API backward-compat with the canonical core/export.ts signature.
  const excluded = new Set<string>();

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
    // Peak-anchored override semantics (2026-05-05 redesign): override %
    // means "% of peak demand". applyOverride(pct, peakScale) returns a
    // canonical-relative effectiveScale = (pct/100) × peakScale, so the
    // canonical-base formula outW = ceil(canonicalW × effScale) produces
    // the right output dims directly — no source-ratio adjustment needed.
    // 100% override === no-override (effScale === peakScale): export is
    // idempotent across re-optimize/reload cycles because peakScale is an
    // invariant world-space measurement, not source-PNG-relative.
    // Mirrors src/core/export.ts verbatim (hygiene test enforces parity).
    const overridePct = overrides.get(row.attachmentName);
    const rawEffScale =
      overridePct !== undefined
        ? applyOverride(overridePct, row.peakScale).effectiveScale
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
    // deleted as vestigial: after 22.1-01's
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
  //   (a) TRIANGLE no-drift peakScale=1.0× → outW = canonicalW = sourceW → passthrough
  //   (b) drifted row, no override → cap binds effScale to sourceRatio →
  //       outW = ceil(canonicalW × sourceRatio) = actualSourceW = sourceW → passthrough
  //   (c) drifted row, 50% override → rawEffScale adjusted to source-relative →
  //       outW = ceil(sourceW × 0.5) < sourceW → resize
  //   (d) drifted row, 100% override → cap binds → outW = sourceW → passthrough
  //
  // Bug A fix (Phase 22.1 post-UAT): outW computed from canonicalW, not sourceW.
  // Mirrors src/core/export.ts verbatim (hygiene test enforces parity).
  const rows: ExportRow[] = [];
  const passthroughCopies: ExportRow[] = [];
  for (const acc of bySourcePath.values()) {
    const outW = Math.ceil((acc.row.canonicalW ?? acc.row.sourceW) * acc.effScale);
    const outH = Math.ceil((acc.row.canonicalH ?? acc.row.sourceH) * acc.effScale);
    // G-04 + G-07 D-06 (Phase 22.1) — generalized passthrough predicate,
    // evaluated AFTER override resolution AND cap math.
    //
    // debug-fix scale-display-optimized-source: compare against actualSourceW when
    // it represents a pre-optimized on-disk file (actualSourceW < canonicalW, set by
    // the loader's pre-optimized detection). When the optimizer's computed outW already
    // equals the actual file on disk, no resize is needed — it's a byte-copy.
    // Falls back to sourceW (= canonicalW in canonical mode without pre-optimized PNGs)
    // when actualSourceW is absent or not smaller than canonical.
    // Mirrors src/core/export.ts verbatim (hygiene test enforces parity).
    const effectiveSourceW =
      acc.row.actualSourceW !== undefined && acc.row.actualSourceW < (acc.row.canonicalW ?? acc.row.sourceW)
        ? acc.row.actualSourceW
        : acc.row.sourceW;
    const effectiveSourceH =
      acc.row.actualSourceH !== undefined && acc.row.actualSourceH < (acc.row.canonicalH ?? acc.row.sourceH)
        ? acc.row.actualSourceH
        : acc.row.sourceH;
    const isPassthrough = outW === effectiveSourceW && outH === effectiveSourceH;
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
