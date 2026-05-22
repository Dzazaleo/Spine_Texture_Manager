import type { SkeletonSummary } from '../shared/types.js';

/**
 * Phase 49 EXPORT-02 — produce an `s`-scaled copy of a SkeletonSummary so the
 * existing `buildExportPlan` sizes the variant's textures at `s × master_peak`.
 *
 * LOCKED interpretation A1 (peak-only — cites D-07 "variant row effectiveScale =
 * s × master effectiveScale" + "the existing <=1.0 clamp applies", and L-02
 * "variant_peak = s × master_peak exact; NEVER re-sample"):
 *   - scale ONLY peakScale / peakScaleX / peakScaleY by `s`
 *   - LEAVE canonicalW/H, sourceW/H, actualSourceW/H at MASTER size
 * so buildExportPlan's clamp acts on the SCALED demand and the source-ratio cap
 * binds at the same absolute pixel ceiling (you can never ship pixels the source
 * PNG never had, at any scale). buildExportPlan is then called UNCHANGED (D-07).
 *
 * Clone-first (mirrors src/core/scale-bake.ts:44,91): the live `summary` drives
 * the panels + the master Optimize flow — NEVER mutate it in place (Pitfall 3).
 *
 * This is a trivial pure transform with NO fs/sharp/spine-core — Layer-3 safe.
 */
export function scaleSummaryPeaks(summary: SkeletonSummary, s: number): SkeletonSummary {
  const c = structuredClone(summary);
  for (const r of c.regions) {
    r.peakScale *= s;
    r.peakScaleX *= s;
    r.peakScaleY *= s;
  }
  for (const p of c.peaks) {
    p.peakScale *= s;
    p.peakScaleX *= s;
    p.peakScaleY *= s;
  }
  return c;
}
