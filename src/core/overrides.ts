/**
 * Phase 4 Plan 01 — Pure-TS clamping math for user-supplied percentage overrides (D-75).
 *
 * Two named exports over raw number primitives: `clampOverride` snaps any
 * integer-rounded user input into [1, 100] (F5.2 source-max clamp — the app
 * does not allow upscaling beyond the source dimensions), and
 * `applyOverride` computes the effective scale directly from the clamped
 * percentage, flagging when the raw input exceeded 100 so the renderer can
 * surface a silent-clamp badge per D-84.
 *
 * Semantics superseded at human-verify 2026-04-24 (04-03 gap-fix B): the
 * override percent now represents the target effective scale as a fraction
 * of source dimensions (100% = source dimensions, the absolute maximum).
 * `applyOverride` no longer takes peak scale — effective scale is purely
 * `clampedPercent / 100`. Peak scale remains the floor-free default when no
 * override is present (resolved at the consumer site, not here). See
 * 04-03-SUMMARY.md §Deviations for the full rationale and user quotes.
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
 * Clamp a user-supplied percentage into the valid integer range [1, 100].
 *
 * D-79 contract:
 *   - Non-finite inputs (NaN, Infinity, -Infinity) → 1.
 *   - Non-integer inputs are rounded via Math.round BEFORE clamping.
 *   - Integer values < 1 → 1 (lower bound).
 *   - Integer values > 100 → 100 (F5.2 source-max clamp; silent clamp).
 *   - Otherwise, return the rounded integer unchanged.
 *
 * Silent clamping means the function never throws. Integer-only storage is
 * mandated by D-78 so the overrides map has a single canonical shape; the
 * renderer should pre-validate the input with the same function before
 * surfacing any feedback.
 */
export function clampOverride(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  const int = Math.round(percent);
  if (int < 1) return 1;
  if (int > 100) return 100;
  return int;
}

/**
 * Compute effective scale from an override percentage.
 *
 * Supersedes 2026-04-24 at human-verify: the percent represents the target
 * effective scale as a fraction of source dimensions (100% = source dims).
 * Peak scale is no longer part of the equation — consumers render
 * `peakScale` as the default when no override is set, then switch to
 * `applyOverride(percent).effectiveScale` when an override exists.
 *
 * Returns `{ effectiveScale, clamped }` where:
 *   - `effectiveScale = clampOverride(overridePercent) / 100`.
 *     The clamped percent is always used for the arithmetic, so callers
 *     never have to re-validate.
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
): { effectiveScale: number; clamped: boolean } {
  const clamped = overridePercent > 100;
  const safe = clampOverride(overridePercent);
  return { effectiveScale: safe / 100, clamped };
}
