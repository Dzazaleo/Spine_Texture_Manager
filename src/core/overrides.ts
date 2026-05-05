/**
 * Phase 4 Plan 01 — Pure-TS clamping math for user-supplied percentage overrides (D-75).
 *
 * Two named exports over raw number primitives: `clampOverride` snaps any
 * integer-rounded user input into [1, 100], and `applyOverride` computes the
 * effective scale by anchoring the clamped percentage to the row's peak demand,
 * flagging when the raw input exceeded 100 so the renderer can surface a
 * silent-clamp badge per D-84.
 *
 * Peak-anchored override semantics (2026-05-05 redesign):
 *   The override percent represents the target effective scale as a fraction of
 *   PEAK DEMAND (100% = peak demand = sharpest possible export without
 *   oversampling; 50% = ship at half of peak demand to trade quality for bytes).
 *   Anchoring to peak (an invariant world-space measurement) instead of source
 *   PNG dims (a moving target that changes after each optimization pass) makes
 *   overrides idempotent across re-optimize/reload cycles: re-exporting an
 *   already-optimized project at the same override percent yields the same
 *   output dims, so reloads don't compound shrinkage. Supersedes the prior
 *   "% of source dimensions" semantics (Phase 4 Plan 03 gap-fix B,
 *   2026-04-24) which broke under the round-trip workflow demonstrated in
 *   the 2026-05-05 design exercise (Steps 1–3).
 *
 * The "never extrapolate beyond canonical source" invariant is preserved:
 *   effectiveScale is still clamped to ≤ 1.0 (canonical-relative) downstream
 *   in buildExportPlan / computeExportDims. The override range [1, 100] only
 *   allows downscaling from peak; users never request anything sharper than
 *   peak demand (which would be wasted texels Spine can't sample anyway).
 *
 * Pure, stateless, zero-I/O, zero-dep. No React, no DOM, no spine-core
 * runtime import — this file works on primitives only. CLAUDE.md rule #5
 * (core/ is pure TypeScript, no DOM) applies; the tests/core/overrides.spec.ts
 * N2.3 + D-75 hygiene block enforces the zero-import discipline by grep, and
 * the tests/arch.spec.ts Layer 3 defense scans the renderer for core imports
 * to keep this file unreachable from renderer code. The renderer receives its
 * own byte-identical copy at src/renderer/src/lib/overrides-view.ts; a parity
 * describe block in the spec file keeps the two copies locked together.
 *
 * Callers:
 *   - src/renderer/src/components/AppShell.tsx (Plan 04-02): clamp-on-Apply
 *     inside the override dialog callback, so the stored map only ever
 *     contains integers in [1, 100].
 *   - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (Plan 04-02 +
 *     04-03): render-time effective-scale computation for the Scale column
 *     and the Peak W×H column (D-82 + D-83).
 *   - src/renderer/src/panels/AnimationBreakdownPanel.tsx (Plan 04-03):
 *     same render-time use, via the D-69 Override Scale button unlock.
 *   - Future Phase 6 export pipeline: consumes peak scales + overrides map
 *     and produces per-texture resize ratios; calls applyOverride in a loop
 *     over atlas entries.
 *
 * Note on the renderer copy: Layer 3 (tests/arch.spec.ts) forbids any file
 * under src/renderer/ from importing src/core/**. Since every caller above
 * (except future Phase 6 export, which runs in main) sits under src/renderer/,
 * the renderer-side lib file exists as the single inline duplicate that lets
 * the renderer use the same math without crossing the boundary. Pattern
 * choice: Option 1 from 04-PATTERNS.md §"Shared Patterns / Layer 3".
 */

/**
 * Clamp a user-supplied percentage into the valid range [1, 999] at
 * 2-decimal precision.
 *
 * 2026-05-05 redesign — 2-decimal precision (was integer-only):
 *   The override-edit dialog prefills with the EFFECTIVE percent — what
 *   the row's peak is actually being forced to right now after the silent
 *   canonical/source clamps fire. When the cap binds at a non-integer
 *   percent (e.g. a row with sourceRatio/peakScale = 1.4547 caps at exactly
 *   145.47%), preserving that value in storage is what makes the prefill
 *   round-trip correctly. Integer-only would lose the cap-binding precision:
 *   round-storing 145.47 → 145 yields raw < cap on the next compute, so the
 *   cap stops binding and the user's "145.47" becomes a flat "145.00".
 *
 *   2-decimal precision is enough — no UI surface displays more than 2.
 *   Float-drift artifacts (e.g. 49.99 × 100 = 4999 in some JS engines vs
 *   4999.000…001 in others) are absorbed by Math.round on the centi-percent.
 *
 * Range: [1, 999]. 999 is an arbitrary "way more than any rig will ever
 * need" sentinel — far above any plausible per-row ceiling (effScale clamps
 * at min(1.0, sourceRatio) downstream).
 *
 * Contract:
 *   - Non-finite inputs (NaN, Infinity, -Infinity) → 1.
 *   - Inputs are rounded to the nearest 0.01 BEFORE clamping.
 *   - Values < 1 → 1 (lower bound).
 *   - Values > 999 → 999 (sane upper bound).
 *   - Otherwise, return the centi-rounded value unchanged.
 *
 * Silent clamping means the function never throws.
 */
export function clampOverride(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  const rounded = Math.round(percent * 100) / 100;
  if (rounded < 1) return 1;
  if (rounded > 999) return 999;
  return rounded;
}

/**
 * Compute effective scale from an override percentage anchored to peak demand.
 *
 * Peak-anchored semantics (2026-05-05 redesign):
 *   `effectiveScale = (clampOverride(overridePercent) / 100) * peakScale`.
 *   100% means "ship at peak demand" (sharpest export without oversampling);
 *   50% means "ship at half of peak demand"; etc. peakScale comes from the
 *   sampler — the canonical-relative ratio of world-space AABB to canonical
 *   source dims — and is invariant of the on-disk PNG size, so the same
 *   override percent yields the same export dims across re-optimize/reload
 *   cycles (idempotent).
 *
 * Returns `{ effectiveScale, clamped }` where:
 *   - `effectiveScale = (clampOverride(overridePercent) / 100) * peakScale`.
 *     The clamped percent is always used for the arithmetic, so callers
 *     never have to re-validate. Note: this is canonical-relative; the
 *     ≤ 1.0 ("never extrapolate beyond canonical") clamp is applied
 *     downstream in buildExportPlan / computeExportDims.
 *   - `clamped` is strictly `overridePercent > 100` (raw input, pre-clamp).
 *     Per D-84 the badge still renders when clamped === true even though
 *     the effective scale reflects the clamped 100 value — the UX surfaces
 *     the user's intent, not the storage value.
 *
 * The strict `> 100` predicate means exactly 100 is NOT clamped. Values
 * below 1 (which also get clamped by `clampOverride`) do not set the flag
 * because the UX for "user typed 0 or negative" is "assume typo → 1", not
 * "flag as over-max".
 */
export function applyOverride(
  overridePercent: number,
  peakScale: number,
): { effectiveScale: number; clamped: boolean } {
  const clamped = overridePercent > 100;
  const safe = clampOverride(overridePercent);
  return { effectiveScale: (safe / 100) * peakScale, clamped };
}
