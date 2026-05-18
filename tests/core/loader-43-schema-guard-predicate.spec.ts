/**
 * Phase 32 — Spine 4.3-beta detect-and-warn (COMPAT-01).
 *
 * `checkSpine43Schema` predicate unit tests. The predicate lives in
 * `src/core/loader.ts` and is exported (Phase 32 / Plan 01 / Task 1) so
 * its decision cases can be exercised independently of fixture loading.
 *
 * The predicate's contract: throw `SpineVersionUnsupportedError` with
 * `detectedVersion = '4.3-schema'` when the parsed JSON is an object
 * with a top-level `constraints` array (CONTEXT D-05: even an empty
 * array triggers — presence of the field IS the 4.3-shape signal).
 *
 * Companion files (Phase 32 four-way coverage):
 *   - tests/core/loader-version-guard-predicate.spec.ts (semver-branch predicate)
 *   - tests/core/loader-version-guard.spec.ts (fixture-driven loadSkeleton — Plan 03)
 *   - tests/core/errors-version.spec.ts (SpineVersionUnsupportedError class shape)
 */
import { describe, expect, it } from 'vitest';
import { checkSpine43Schema, resolveRuntimeTag } from '../../src/core/loader.js';
import { SpineVersionUnsupportedError } from '../../src/core/errors.js';

const SKEL = '/tmp/skel.json';

describe('checkSpine43Schema (Phase 32 / Plan 01 / COMPAT-01)', () => {
  describe('accepted shapes (no throw)', () => {
    it('accepts {} (empty object — no constraints field)', () => {
      expect(() => checkSpine43Schema({}, SKEL)).not.toThrow();
    });

    it('accepts { foo: "bar" } (object with unrelated fields)', () => {
      expect(() => checkSpine43Schema({ foo: 'bar' }, SKEL)).not.toThrow();
    });

    it('accepts a typical 4.2 skeleton shape (skeleton + bones + slots + skins, NO constraints field)', () => {
      const parsed42 = {
        skeleton: { spine: '4.2.43' },
        bones: [{ name: 'root' }],
        slots: [],
        skins: [{ name: 'default', attachments: {} }],
      };
      expect(() => checkSpine43Schema(parsed42, SKEL)).not.toThrow();
    });

    it('accepts null (defensive — JSON.parse can yield null for "null" input)', () => {
      expect(() => checkSpine43Schema(null, SKEL)).not.toThrow();
    });

    it('accepts a non-object (string, number — defensive)', () => {
      expect(() => checkSpine43Schema('not an object', SKEL)).not.toThrow();
      expect(() => checkSpine43Schema(42, SKEL)).not.toThrow();
    });

    it('accepts { constraints: "not an array" } (constraints field present but wrong type — not the 4.3 shape)', () => {
      // Defense: the predicate only fires on array-typed `constraints`.
      // A string-typed `constraints` is malformed JSON, not a 4.3 marker.
      expect(() => checkSpine43Schema({ constraints: 'not an array' }, SKEL)).not.toThrow();
    });

    it('accepts { constraints: { type: "ik" } } (object-typed `constraints` — not an array)', () => {
      expect(() => checkSpine43Schema({ constraints: { type: 'ik' } }, SKEL)).not.toThrow();
    });
  });

  describe('rejected shapes (throws SpineVersionUnsupportedError)', () => {
    it('rejects { constraints: [] } (empty array — presence of the field IS the signal per CONTEXT D-05)', () => {
      expect(() => checkSpine43Schema({ constraints: [] }, SKEL)).toThrow(SpineVersionUnsupportedError);
    });

    it('rejects { constraints: [{ type: "ik", ... }] } (canonical 4.3 entry shape per SEED-003)', () => {
      const parsed43 = {
        constraints: [{ name: 'test_ik', type: 'ik', bones: ['root'], target: 'root' }],
      };
      expect(() => checkSpine43Schema(parsed43, SKEL)).toThrow(SpineVersionUnsupportedError);
    });

    it("Rejection error carries detectedVersion === '4.3-schema' (sentinel)", () => {
      expect(() => checkSpine43Schema({ constraints: [] }, SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpine43Schema({ constraints: [] }, SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.3-schema');
        expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
      }
    });

    it('rejects a full 4.3-shape skeleton object (skeleton + bones + slots + skins + constraints)', () => {
      const parsed43Full = {
        skeleton: { spine: '4.3.91-beta', x: 0, y: 0, width: 1, height: 1 },
        bones: [{ name: 'root' }],
        slots: [],
        skins: [{ name: 'default', attachments: {} }],
        constraints: [{ name: 'test_ik', type: 'ik', bones: ['root'], target: 'root' }],
      };
      expect(() => checkSpine43Schema(parsed43Full, SKEL)).toThrow(SpineVersionUnsupportedError);
    });
  });
});

/**
 * Phase 44 (D-08) — the repurposed `constraints[]` sniff as the
 * routing/contradiction SIGNAL inside `resolveRuntimeTag`.
 *
 * `checkSpine43Schema` itself is UNCHANGED (its standalone-predicate
 * contract above stays). `resolveRuntimeTag` re-derives the SAME
 * top-level-`constraints[]` sniff (D-08) as one half of an ASYMMETRIC,
 * POSITIVE-SHAPE-ONLY contradiction cross-check (Pitfall 3): a
 * `constraints[]`-shaped JSON stamped token=4.2 is the contradiction;
 * a constraint-LESS 4.3 rig is VALID (absence is NOT 4.2 evidence).
 */
describe('resolveRuntimeTag — D-08 asymmetric constraints[] contradiction signal', () => {
  it("token=4.2 + top-level constraints[] → throws (the repurposed checkSpine43Schema reject, '4.3-schema' sentinel)", () => {
    const full43Shape = {
      skeleton: { spine: '4.2.43' },
      bones: [{ name: 'root' }],
      constraints: [{ name: 'ik1', type: 'ik', bones: ['root'], target: 'root' }],
    };
    expect(() => resolveRuntimeTag('4.2.43', full43Shape, SKEL)).toThrow(
      SpineVersionUnsupportedError,
    );
    try {
      resolveRuntimeTag('4.2.43', full43Shape, SKEL);
    } catch (err) {
      expect((err as SpineVersionUnsupportedError).detectedVersion).toBe(
        '4.3-schema',
      );
    }
  });

  it("token=4.3 + NO constraints[] + NO legacy arrays → routes '4.3' (constraint-less 4.3 is VALID — D-08 Pitfall 3)", () => {
    expect(
      resolveRuntimeTag('4.3.01', { skeleton: { spine: '4.3.01' }, bones: [] }, SKEL),
    ).toBe('4.3');
  });

  it("token=4.3 + constraints[] (canonical 4.3) → routes '4.3' (constraints[] is the 4.3 marker, NOT a contradiction here)", () => {
    const canonical43 = {
      skeleton: { spine: '4.3.01' },
      constraints: [{ name: 'ik1', type: 'ik', bones: ['root'], target: 'root' }],
    };
    expect(resolveRuntimeTag('4.3.01', canonical43, SKEL)).toBe('4.3');
  });

  it("constraints field present but NOT an array (string) + token=4.2 → routes '4.2' (matches checkSpine43Schema's Array.isArray scope)", () => {
    expect(
      resolveRuntimeTag('4.2.43', { constraints: 'not an array' }, SKEL),
    ).toBe('4.2');
  });
});
