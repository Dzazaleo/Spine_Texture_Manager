/**
 * Phase 4 Plan 01 — renderer-side inline copy of the canonical
 * clamp + apply-override math (D-75).
 *
 * Layer 3 resolution (inline duplicate — option 1 from 04-PATTERNS.md
 * §"Shared Patterns / Layer 3"). The tests/arch.spec.ts grep at lines
 * 19-34 forbids any renderer file from taking a dependency on the
 * pure-TS math tree. Because every Phase 4 consumer of this math is under
 * src/renderer/ (AppShell's onApplyOverride callback, the Scale + Peak
 * cell render paths in both panels), the renderer gets its own
 * byte-identical copy here instead of crossing the boundary.
 *
 * Parity contract: the exported function bodies in this file are
 * byte-identical to the canonical source module. If you modify one,
 * modify the other in the same commit. A parity describe block in the
 * matching test module (in the tests tree, under the overrides spec
 * path) asserts sameness on 30+ sampled inputs plus signature greps
 * against both file contents, so any drift fails CI immediately.
 *
 * Zero imports. Pure primitives only. Same discipline as the canonical
 * copy: no React, no DOM types, no cross-package imports. The only
 * reason this file lives under the renderer tree rather than alongside
 * the other pure-TS math modules is that renderer code cannot reach the
 * core module through the Layer 3 arch gate.
 *
 * Callers (within the renderer tree only):
 *   - AppShell.tsx (Plan 04-02) — onApplyOverride stores only the clamped
 *     integer so the overrides map stays canonical.
 *   - GlobalMaxRenderPanel.tsx (Plan 04-02 + 04-03) — Scale + Peak W×H
 *     cell render paths compute the effective scale per row (D-82 + D-83).
 *   - AnimationBreakdownPanel.tsx (Plan 04-03) — Scale cell + Override
 *     Scale button (D-69 unlock).
 */

export function clampOverride(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  const int = Math.round(percent);
  if (int < 1) return 1;
  if (int > 100) return 100;
  return int;
}

export function applyOverride(
  overridePercent: number,
  peakScale: number,
): { effectiveScale: number; clamped: boolean } {
  const clamped = overridePercent > 100;
  const safe = clampOverride(overridePercent);
  return { effectiveScale: (safe / 100) * peakScale, clamped };
}
