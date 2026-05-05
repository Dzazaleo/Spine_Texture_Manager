/**
 * Phase 4 Plan 01 — Tests for src/core/overrides.ts + src/renderer/src/lib/overrides-view.ts (D-75, D-79, D-82, D-84).
 *
 * Peak-anchored override semantics (2026-05-05 redesign):
 *   - applyOverride takes (percent, peakScale); effective scale =
 *     (clampedPct / 100) × peakScale.
 *   - The percent represents the target effective scale as a fraction of PEAK
 *     DEMAND (100% = peak demand = sharpest possible export without
 *     oversampling). Peak is invariant of source PNG dims, making overrides
 *     idempotent across re-optimize/reload cycles.
 *   - Supersedes the prior "% of source dimensions" semantics (Phase 4
 *     Plan 03 gap-fix B, 2026-04-24) which broke under round-trip
 *     re-optimization (compounding shrinkage).
 *
 * Behavior gates:
 *   - D-79 clampOverride — silent integer-rounded clamp into [1, 100];
 *     non-finite → 1; 0/-5 → 1; 200 → 100; 49.6 → 50 (Math.round).
 *   - applyOverride — returns effectiveScale = (clampOverride(percent) / 100) × peakScale.
 *   - D-84 applyOverride — sets clamped flag iff the RAW input exceeded 100;
 *     effectiveScale uses the clamped 100 value, but the badge still
 *     renders. Predicate is strictly `> 100` so exactly 100 is NOT clamped.
 *
 * Hygiene gates (N2.3 by construction + D-75):
 *   - No node:fs / node:path / node:child_process / node:net / node:http imports.
 *   - No sharp import.
 *   - No spine-core runtime import — the module works on primitives only.
 *   - No React / react-dom import.
 *   - Both exports present in the canonical module.
 *
 * Layer 3 option-1 parity gate:
 *   - Canonical + renderer copy return byte-identical results across 12
 *     sampled clampOverride inputs and 10 sampled applyOverride percents.
 *   - Both files have zero imports.
 *   - Both files share the same Number.isFinite guard signature on
 *     clampOverride and the same `> 100` predicate signature on
 *     applyOverride — the two functions cannot drift silently.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { clampOverride, applyOverride } from '../../src/core/overrides.js';
import {
  clampOverride as clampView,
  applyOverride as applyView,
} from '../../src/renderer/src/lib/overrides-view.js';

const CORE_SRC = path.resolve('src/core/overrides.ts');
const VIEW_SRC = path.resolve('src/renderer/src/lib/overrides-view.ts');

describe('clampOverride (D-79)', () => {
  it('D-79: passes 200 through (peak-anchored: values >100 are meaningful, target dims between peak and source ceiling)', () => {
    // 2026-05-05 redesign: under peak-anchored semantics, override % can
    // exceed 100 to target dims above peak demand. The actual per-row
    // ceiling (effScale ≤ min(1.0, sourceRatio)) is enforced downstream;
    // this function only enforces integer storage + a sane upper bound.
    expect(clampOverride(200)).toBe(200);
  });

  it('D-79: passes 50 through unchanged (mid-range integer)', () => {
    expect(clampOverride(50)).toBe(50);
  });

  it('D-79: clamps 0 → 1 (lower bound)', () => {
    expect(clampOverride(0)).toBe(1);
  });

  it('D-79: clamps -5 → 1 (lower bound; negative input)', () => {
    expect(clampOverride(-5)).toBe(1);
  });

  it('D-79: NaN → 1 (Number.isFinite guard)', () => {
    expect(clampOverride(NaN)).toBe(1);
  });

  it('D-79: Infinity → 1 (Number.isFinite guard)', () => {
    expect(clampOverride(Infinity)).toBe(1);
  });

  it('D-79 (2026-05-05): 49.6 → 49.6 (2-decimal precision preserved, was integer-only)', () => {
    expect(clampOverride(49.6)).toBe(49.6);
  });

  it('D-79 (2026-05-05): 145.47 → 145.47 (preserves cap-binding precision)', () => {
    expect(clampOverride(145.47)).toBe(145.47);
  });

  it('D-79 (2026-05-05): 145.475 → 145.48 (rounds half-up at the centi-percent)', () => {
    expect(clampOverride(145.475)).toBe(145.48);
  });

  it('D-79: 100 → 100 (mid-range, no longer the upper bound)', () => {
    expect(clampOverride(100)).toBe(100);
  });

  it('D-79: 999 → 999 (new sane upper bound — way more than any rig will need)', () => {
    expect(clampOverride(999)).toBe(999);
  });

  it('D-79: clamps 1500 → 999 (silent upper-bound clamp at sane sentinel)', () => {
    expect(clampOverride(1500)).toBe(999);
  });

  it('D-79: 1 → 1 (lower bound exact)', () => {
    expect(clampOverride(1)).toBe(1);
  });
});

describe('applyOverride (peak-anchored — percent of peak demand)', () => {
  it('applyOverride(50, 0.495) → effectiveScale = 0.2475 (50% of peak)', () => {
    const result = applyOverride(50, 0.495);
    expect(result.effectiveScale).toBeCloseTo(0.2475, 5);
    expect(result.clamped).toBe(false);
  });

  it('applyOverride(100, 0.495) → effectiveScale = 0.495 (100% of peak === peakScale)', () => {
    // Idempotent invariant: 100% override produces the same effScale as no override.
    const result = applyOverride(100, 0.495);
    expect(result.effectiveScale).toBeCloseTo(0.495, 5);
    expect(result.clamped).toBe(false);
  });

  it('D-84: applyOverride(200, 0.5) → effectiveScale = 1.0; clamped flag TRUE (raw > 100 still sets the flag)', () => {
    // 2026-05-05 redesign: clampOverride no longer clips at 100; 200 passes
    // through. effectiveScale = (200/100) × 0.5 = 1.0 (canonical-relative).
    // The downscale-only ≤ 1.0 clamp + sourceRatio cap fire downstream in
    // buildExportPlan / computeExportDims — applyOverride itself is pure math.
    // The `clamped` flag retains its `raw > 100` predicate as a "user typed
    // beyond peak demand" signal for the existing visual badge.
    const result = applyOverride(200, 0.5);
    expect(result.effectiveScale).toBeCloseTo(1.0, 5);
    expect(result.clamped).toBe(true);
  });

  it('applyOverride(30, 0.8) → effectiveScale = 0.24 (30% of peak)', () => {
    const result = applyOverride(30, 0.8);
    expect(result.effectiveScale).toBeCloseTo(0.24, 5);
    expect(result.clamped).toBe(false);
  });

  it('D-84: applyOverride(100, 0.7) → clamped FALSE (predicate is strictly > 100)', () => {
    const result = applyOverride(100, 0.7);
    expect(result.effectiveScale).toBeCloseTo(0.7, 5);
    expect(result.clamped).toBe(false);
  });

  it('D-84: applyOverride(101, 0.6) → clamped TRUE (raw input exceeded 100 by 1); effectiveScale uses 101%', () => {
    const result = applyOverride(101, 0.6);
    // 2026-05-05: 101 passes through clampOverride; effectiveScale = (101/100) × 0.6 = 0.606.
    // Downstream ≤ 1.0 clamp may apply (here 0.606 < 1, no clamp fires).
    expect(result.effectiveScale).toBeCloseTo(0.606, 5);
    expect(result.clamped).toBe(true);
  });

  it('applyOverride(1, 0.5) → effectiveScale = 0.005 (lower bound × peak)', () => {
    const result = applyOverride(1, 0.5);
    expect(result.effectiveScale).toBeCloseTo(0.005, 5);
    expect(result.clamped).toBe(false);
  });

  it('applyOverride(0, 0.5) → effectiveScale = 0.005 (zero clamps to 1% of peak)', () => {
    const result = applyOverride(0, 0.5);
    expect(result.effectiveScale).toBeCloseTo(0.005, 5);
    expect(result.clamped).toBe(false);
  });

  it('peakScale > 1.0: applyOverride(50, 5.0) → effectiveScale = 2.5 (canonical clamp applied downstream)', () => {
    // applyOverride itself does NOT clamp at canonical max — it returns the raw
    // (pct/100) × peakScale value. The ≤ 1.0 ceiling is the responsibility of
    // buildExportPlan / computeExportDims (downscale-only invariant). This
    // matches the Phase 6 layering: pure math here, policy clamp in the export
    // pipeline where actualSource cap math also lives.
    const result = applyOverride(50, 5.0);
    expect(result.effectiveScale).toBeCloseTo(2.5, 5);
    expect(result.clamped).toBe(false);
  });
});

describe('overrides — module hygiene (N2.3 by construction, D-75)', () => {
  const src = readFileSync(CORE_SRC, 'utf8');

  it('N2.3: no node:fs / node:path / node:child_process / node:net / node:http imports', () => {
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  });

  it('N2.3: no sharp import', () => {
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });

  it('D-75: no spine-core runtime import (pure primitives only)', () => {
    expect(src).not.toMatch(/from ['"]@esotericsoftware\/spine-core['"]/);
  });

  it('D-75: no React / react-dom import', () => {
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-dom['"]/);
  });

  it('exports clampOverride and applyOverride by name', () => {
    expect(src).toMatch(/export\s+function\s+clampOverride/);
    expect(src).toMatch(/export\s+function\s+applyOverride/);
  });
});

describe('core ↔ renderer parity (Layer 3 option-1 invariant)', () => {
  const coreText = readFileSync(CORE_SRC, 'utf8');
  const viewText = readFileSync(VIEW_SRC, 'utf8');

  it('renderer view reports the same clampOverride result across 12 sampled inputs', () => {
    const inputs = [200, 100, 99, 50, 1, 0, -5, NaN, Infinity, 49.6, 50.4, 150.7];
    for (const x of inputs) {
      expect(clampView(x)).toBe(clampOverride(x));
    }
  });

  it('renderer view reports the same applyOverride result across 10 sampled (percent, peakScale) pairs', () => {
    const cases: [number, number][] = [
      [50, 0.495],
      [200, 0.5],
      [100, 0.7],
      [101, 0.6],
      [30, 0.8],
      [0, 0.5],
      [1, 0.5],
      [99, 0.495],
      [75, 1.0],
      [25, 0.36],
    ];
    for (const [pct, peak] of cases) {
      const expected = applyOverride(pct, peak);
      const actual = applyView(pct, peak);
      expect(actual.effectiveScale).toBeCloseTo(expected.effectiveScale, 5);
      expect(actual.clamped).toBe(expected.clamped);
    }
  });

  it('both files have zero imports (Layer 3 discipline)', () => {
    expect(coreText).not.toMatch(/^import\s/m);
    expect(coreText).not.toMatch(/from\s+['"]/);
    expect(viewText).not.toMatch(/^import\s/m);
    expect(viewText).not.toMatch(/from\s+['"]/);
  });

  it('both files contain the same Number.isFinite guard signature for clampOverride', () => {
    const guard = /if\s*\(\s*!Number\.isFinite\(percent\)\s*\)\s*return\s+1;/;
    expect(coreText).toMatch(guard);
    expect(viewText).toMatch(guard);
  });

  it('both files contain the same > 100 clamped predicate for applyOverride', () => {
    const predicate = /const\s+clamped\s*=\s*overridePercent\s*>\s*100;/;
    expect(coreText).toMatch(predicate);
    expect(viewText).toMatch(predicate);
  });
});
