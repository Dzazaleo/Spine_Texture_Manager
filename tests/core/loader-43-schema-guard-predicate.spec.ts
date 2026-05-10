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
import { checkSpine43Schema } from '../../src/core/loader.js';
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
