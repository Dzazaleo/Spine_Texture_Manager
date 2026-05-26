/**
 * Phase 22.1 Plan 04 Task 1 — Pure-function helper unit tests for
 * dims-tooltip-view.ts (G-02 D-04 + G-03 cap-binding-aware + G-01 D-02 mode-aware).
 *
 * TDD RED (wave 4 RED) — these tests drive the creation of
 * src/renderer/src/lib/dims-tooltip-view.ts.
 *
 * Test axes covered:
 *   - mode (atlas-source 'auto' vs atlas-less 'atlas-less')
 *   - cap-binding (isCapped true vs false)
 *   - explicit effectiveScale parameter (Warning 1 fix — no row.effectiveScale)
 *   - undefined-guard (dimsMismatch:false + undefined actualSource)
 */
import { describe, it, expect } from 'vitest';
import { buildDimsTooltipText, deriveIsCapped } from '../../src/renderer/src/lib/dims-tooltip-view';

const baseDims = {
  actualSourceW: 670,
  actualSourceH: 670,
  canonicalW: 1000,
  canonicalH: 1000,
};
const baseCapRow = {
  ...baseDims,
  dimsMismatch: true,
};

describe('buildDimsTooltipText', () => {
  it('atlas-source variant, no cap → first sentence only', () => {
    expect(buildDimsTooltipText(baseDims, 'auto', false))
      .toBe('Atlas region declares 670×670 but canonical is 1000×1000.');
  });
  it('atlas-source variant, capped → first sentence + on-disk cap suffix', () => {
    expect(buildDimsTooltipText(baseDims, 'auto', true))
      .toBe('Atlas region declares 670×670 but canonical is 1000×1000.\nOptimize will cap at on-disk size.');
  });
  it('atlas-less variant, no cap → first sentence only', () => {
    expect(buildDimsTooltipText(baseDims, 'atlas-less', false))
      .toBe('Source PNG (670×670) is smaller than canonical region dims (1000×1000).');
  });
  it('atlas-less variant, capped → first sentence + source cap suffix', () => {
    expect(buildDimsTooltipText(baseDims, 'atlas-less', true))
      .toBe('Source PNG (670×670) is smaller than canonical region dims (1000×1000).\nOptimize will cap at source size.');
  });

  // Phase 54 follow-up (2026-05-26) — canonical values are stored as floats
  // and variant projects produce IEEE-754 noise (canonical_master × s, e.g.
  // 494 × 0.1 = 49.400000000000006). Round to 2 decimals; integers stay
  // integers (no ".00" suffix).
  it('rounds float canonical dims to 2 decimals, strips trailing zeros', () => {
    expect(buildDimsTooltipText(
      { actualSourceW: 54, actualSourceH: 233, canonicalW: 49.400000000000006, canonicalH: 214.9 },
      'auto',
      false,
    )).toBe('Atlas region declares 54×233 but canonical is 49.4×214.9.');
  });
  it('integer canonicals do NOT gain a .00 suffix', () => {
    expect(buildDimsTooltipText(
      { actualSourceW: 25, actualSourceH: 91, canonicalW: 211, canonicalH: 766 },
      'auto',
      false,
    )).toBe('Atlas region declares 25×91 but canonical is 211×766.');
  });
});

describe('deriveIsCapped (effectiveScale is explicit, second positional param — Warning 1 fix)', () => {
  it('natural cap binds — effectiveScale=1.0 against 670/1000 source-ratio', () => {
    expect(deriveIsCapped(baseCapRow, 1.0)).toBe(true);
  });
  it('override below source-ratio — effectiveScale=0.5 against 670/1000 → cap NOT binding', () => {
    expect(deriveIsCapped(baseCapRow, 0.5)).toBe(false);
  });
  it('guards undefined actualSourceW → returns false', () => {
    expect(deriveIsCapped(
      { dimsMismatch: false, actualSourceW: undefined, actualSourceH: undefined, canonicalW: 1000, canonicalH: 1000 },
      1.0,
    )).toBe(false);
  });
});
