/**
 * Phase 4 Plan 01 — Tests for src/core/overrides.ts + src/renderer/src/lib/overrides-view.ts (D-75, D-79, D-82, D-84).
 *
 * Behavior gates:
 *   - D-79 clampOverride — silent integer-rounded clamp into [1, 100];
 *     non-finite → 1; 0/-5 → 1; 200 → 100; 49.6 → 50 (Math.round).
 *   - D-82 applyOverride — returns effectiveScale = peakScale * clamped / 100.
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
 *     sampled clampOverride inputs and 10 sampled applyOverride pairs.
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
  it('D-79: clamps 200 → 100 (silent source-max clamp, F5.2)', () => {
    expect(clampOverride(200)).toBe(100);
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

  it('D-78/D-79: 49.6 → 50 (Math.round applied BEFORE clamp; integer-only storage)', () => {
    expect(clampOverride(49.6)).toBe(50);
  });

  it('D-79: 100 → 100 (upper bound — predicate is strictly > 100)', () => {
    expect(clampOverride(100)).toBe(100);
  });

  it('D-79: 1 → 1 (lower bound exact)', () => {
    expect(clampOverride(1)).toBe(1);
  });
});

describe('applyOverride (D-82, D-84)', () => {
  it('D-82: applyOverride(1.78, 50) → { effectiveScale: 0.89, clamped: false }', () => {
    const result = applyOverride(1.78, 50);
    expect(result.effectiveScale).toBeCloseTo(0.89, 5);
    expect(result.clamped).toBe(false);
  });

  it('D-84: applyOverride(1.78, 200) → effectiveScale uses clamped 100; clamped flag TRUE', () => {
    const result = applyOverride(1.78, 200);
    // effectiveScale = 1.78 × clampOverride(200)/100 = 1.78 × 100/100 = 1.78
    expect(result.effectiveScale).toBeCloseTo(1.78, 5);
    expect(result.clamped).toBe(true);
  });

  it('D-82: applyOverride(0.6, 50) → { effectiveScale: 0.3, clamped: false }', () => {
    const result = applyOverride(0.6, 50);
    expect(result.effectiveScale).toBeCloseTo(0.3, 5);
    expect(result.clamped).toBe(false);
  });

  it('D-84: applyOverride(2.0, 100) → clamped FALSE (predicate is strictly > 100)', () => {
    const result = applyOverride(2.0, 100);
    expect(result.effectiveScale).toBeCloseTo(2.0, 5);
    expect(result.clamped).toBe(false);
  });

  it('D-84: applyOverride(2.0, 101) → clamped TRUE (raw input exceeded 100 by 1)', () => {
    const result = applyOverride(2.0, 101);
    // effectiveScale = 2.0 × clampOverride(101)/100 = 2.0 × 100/100 = 2.0
    expect(result.effectiveScale).toBeCloseTo(2.0, 5);
    expect(result.clamped).toBe(true);
  });

  it('D-82: applyOverride(0, 50) → { effectiveScale: 0, clamped: false } (zero peak scale edge)', () => {
    const result = applyOverride(0, 50);
    expect(result.effectiveScale).toBeCloseTo(0, 5);
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

  it('renderer view reports the same applyOverride result across 10 sampled (peak, percent) pairs', () => {
    const pairs: Array<[number, number]> = [
      [1.78, 50],
      [1.78, 200],
      [1.78, 100],
      [1.78, 101],
      [0.6, 50],
      [0, 50],
      [1, 1],
      [1, 100],
      [2.5, 75],
      [3.14, 99],
    ];
    for (const [peak, pct] of pairs) {
      const expected = applyOverride(peak, pct);
      const actual = applyView(peak, pct);
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
