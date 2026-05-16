/**
 * Phase 42 Plan 01 — SAFE-01 Task 1: canonical-JSON round-trip self-test
 * (the "Nyquist seam").
 *
 * Proves the canonical serializer is BYTE-DETERMINISTIC and surfaces every
 * silent-corruption float case (NaN / Infinity / -Infinity / -0) as a DISTINCT
 * STRING SENTINEL — never `null`/`0` — BEFORE it is trusted to gate `core/`
 * output (RESEARCH §Canonical-JSON "Round-trip self-test").
 *
 * Why string sentinels, not null: a silent-undersize regression producing a
 * non-finite peak would serialize as `"peakScale": null` under plain
 * JSON.stringify and read as "no data" — false-passing the exact gate SAFE-01
 * exists to catch. `"peakScale": "NaN"` in a git diff is unmissable.
 *
 * No baseline file is involved — this is a pure in-test synthetic fixture
 * (the determinism-self-test idiom from tests/main/repack.loose-parity.spec.ts;
 * REPO_ROOT idiom from repack.loose-parity.spec.ts:42-48, kept for convention
 * even though no path is needed here).
 */
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { canonicalize } from './canonical-json.js';

// Shared S1 — repo-root idiom (no path is actually needed; kept for the
// established convention so future path-bearing additions match the analog).
const REPO_ROOT = path.resolve(__dirname, '..', '..');
void REPO_ROOT;

describe('SAFE-01 canonical-json: deterministic serializer self-test (the Nyquist seam)', () => {
  // A synthetic SamplerOutput-shaped object exercising every dangerous case.
  const makeSynthetic = () => ({
    globalPeaks: new Map<string, unknown>([
      // keys deliberately OUT of sorted order to prove Map → sorted-key object
      [
        'Zskin/slot/att',
        { peakScale: Number.NaN, peakScaleX: Infinity, peakScaleY: -Infinity },
      ],
      [
        'Askin/slot/att',
        // nested object whose keys are out of order at depth — proves
        // RECURSIVE (not shallow) key sort
        { z: { b: 1, a: 2 }, time: 1e-9, frame: 0, negZero: -0 },
      ],
    ]),
    perAnimation: new Map<string, unknown>([
      ['anim/skin/slot/att', { peakScale: 1.123456789012345678 }],
    ]),
    setupPosePeaks: new Map<string, unknown>(),
  });

  it('is byte-stable across two successive canonicalize() calls (determinism)', () => {
    const a = canonicalize(makeSynthetic(), { schema: 'safe01/v1' });
    const b = canonicalize(makeSynthetic(), { schema: 'safe01/v1' });
    expect(a).toBe(b);
  });

  it('emits NaN as the string sentinel "NaN" (never null)', () => {
    const out = canonicalize(makeSynthetic(), {});
    expect(out).toContain('"peakScale": "NaN"');
    expect(out).not.toMatch(/"peakScale":\s*null/);
  });

  it('emits Infinity / -Infinity as string sentinels (never null)', () => {
    const out = canonicalize(makeSynthetic(), {});
    expect(out).toContain('"peakScaleX": "Infinity"');
    expect(out).toContain('"peakScaleY": "-Infinity"');
  });

  it('emits negative zero as the string sentinel "-0" (never 0)', () => {
    const out = canonicalize(makeSynthetic(), {});
    expect(out).toContain('"negZero": "-0"');
  });

  it('clamps finite floats to 15 significant digits (Number(x.toPrecision(15)))', () => {
    const out = canonicalize(makeSynthetic(), {});
    // 1.123456789012345678 → toPrecision(15) → 1.12345678901235
    expect(out).toContain('1.12345678901235');
    // the 1e-9 peak-latch epsilon must survive the clamp (far above 15-digit ambiguity)
    expect(out).toContain('1e-9');
  });

  it('sorts keys RECURSIVELY at every depth (not just top-level)', () => {
    const out = canonicalize(makeSynthetic(), {});
    const parsed = JSON.parse(out);
    // top-level _meta first, then the three maps
    expect(Object.keys(parsed)).toEqual([
      '_meta',
      'globalPeaks',
      'perAnimation',
      'setupPosePeaks',
    ]);
    // Map sorted by key: 'Askin/...' before 'Zskin/...'
    expect(Object.keys(parsed.globalPeaks)).toEqual([
      'Askin/slot/att',
      'Zskin/slot/att',
    ]);
    // nested object keys sorted at depth: { z: { b, a } } → z.{a,b}
    const nested = parsed.globalPeaks['Askin/slot/att'];
    expect(Object.keys(nested)).toEqual(['frame', 'negZero', 'time', 'z']);
    expect(Object.keys(nested.z)).toEqual(['a', 'b']);
  });

  it('places the _meta block FIRST and carries the supplied provenance', () => {
    const out = canonicalize(makeSynthetic(), {
      fixture: 'fixtures/X/Y.json',
      spineCoreVersion: '4.2.111',
    });
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed)[0]).toBe('_meta');
    expect(parsed._meta.fixture).toBe('fixtures/X/Y.json');
    expect(parsed._meta.spineCoreVersion).toBe('4.2.111');
  });
});
