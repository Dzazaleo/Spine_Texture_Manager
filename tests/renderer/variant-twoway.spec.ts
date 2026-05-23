/**
 * Phase 50 Plan 02 — V8 pure-helper unit tests for the two-way scale↔dimension
 * derivation helpers (SCALEUI-01, D-03).
 *
 * No jsdom: these helpers have zero UI dependency. They go GREEN as soon as
 * `variant-scale-derive.ts` exists.
 *
 * The behaviour under test (D-03 "what you type is what you get"):
 *  - pxFromScale rounds the per-axis pixel target to whole pixels.
 *  - scaleFromPx is the EXACT quotient — NO snapping to nice factors (strict ===).
 *  - displayFactor rounds the *display* of the factor to 4 decimals
 *    (== formatScaleToken's `Number(s.toFixed(4))`), never the stored s.
 */
import { describe, expect, it } from 'vitest';
import {
  displayFactor,
  pxFromScale,
  scaleFromPx,
  tokenFor,
} from '../../src/renderer/src/modals/variant-scale-derive';

describe('variant-scale-derive — V8 pure derivation helpers (D-03)', () => {
  it('pxFromScale: derivation rounds the per-axis pixel target to whole pixels', () => {
    expect(pxFromScale(0.5, 2190)).toBe(1095);
    expect(pxFromScale(0.5, 1847)).toBe(924); // round(923.5) === 924
    // pxFromScale(s, axis) === Math.round(s*axis) for sampled inputs.
    const samples: Array<[number, number]> = [
      [0.25, 2190],
      [0.3333, 1847],
      [0.123456, 1000],
      [0.999, 512],
      [1.37, 2190],
    ];
    for (const [s, axis] of samples) {
      expect(pxFromScale(s, axis)).toBe(Math.round(s * axis));
    }
  });

  it('scaleFromPx: derivation is the EXACT quotient with no snapping (strict ===)', () => {
    // 512 / 2190 is NOT a "nice" factor; assert the exact IEEE-754 quotient,
    // NOT a rounded value (D-03: typed px honored exactly).
    expect(scaleFromPx(512, 2190)).toBe(512 / 2190);
    // Sanity: it is genuinely not a rounded/snapped value.
    expect(scaleFromPx(512, 2190)).not.toBe(0.23);
    expect(scaleFromPx(512, 2190)).not.toBe(0.234);
    // scaleFromPx(px, axis) === px / axis for sampled inputs.
    const samples: Array<[number, number]> = [
      [1095, 2190],
      [924, 1847],
      [3000, 2190], // over-range: s >= 1 allowed (D-04)
      [1, 7],
    ];
    for (const [px, axis] of samples) {
      expect(scaleFromPx(px, axis)).toBe(px / axis);
    }
  });

  it('displayFactor: derivation rounds the display to 4 decimals (== formatScaleToken)', () => {
    expect(displayFactor(0.123456)).toBe(0.1235);
    expect(displayFactor(0.5)).toBe(0.5);
    // displayFactor(s) === Number(s.toFixed(4)) for sampled inputs.
    const samples = [0.5, 0.23379, 512 / 2190, 1.37, 0.30000000000000004];
    for (const s of samples) {
      expect(displayFactor(s)).toBe(Number(s.toFixed(4)));
    }
  });

  it('tokenFor normalizes IEEE-754 drift to the canonical @{s}x token (D-10)', () => {
    expect(tokenFor(0.5)).toBe('0.5');
    expect(tokenFor(0.50001)).toBe('0.5');
    expect(tokenFor(0.5)).toBe(tokenFor(0.50001));
    expect(tokenFor(0.36)).toBe('0.36');
  });
});
