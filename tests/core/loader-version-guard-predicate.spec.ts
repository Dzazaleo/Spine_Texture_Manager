/**
 * Phase 12 Plan 05 (D-21) — F3 Spine version guard.
 *
 * Task 2 RED → GREEN: `checkSpineVersion` predicate unit tests.
 *
 * The predicate lives in `src/core/loader.ts` and is exported (Task 2 GREEN
 * adds the export) so the predicate's seven decision cases can be exercised
 * independently of fixture loading. Cases:
 *   1. accepts 4.2.x   (the contracted minimum)
 *   2. accepts 4.3+    (lenient pass per CONTEXT Deferred)
 *   3. rejects 4.1.x   (just below the bar)
 *   4. rejects 3.8.x   (the F3 reproduction)
 *   5. rejects null    (pre-3.7 had no `skeleton.spine` field)
 *   6. rejects malformed strings
 *   7. rejects empty string
 *
 * Each rejection MUST carry a `SpineVersionUnsupportedError` with the
 * caller-provided `skeletonPath` and the SOURCE `version` argument as
 * `detectedVersion` (or 'unknown' for the null branch).
 *
 * Fixture-driven loadSkeleton tests live in tests/core/loader-version-guard.spec.ts
 * (Task 3); this file tests the predicate in isolation.
 */
import { describe, expect, it } from 'vitest';
import { checkSpineVersion } from '../../src/core/loader.js';
import { SpineVersionUnsupportedError } from '../../src/core/errors.js';

const SKEL = '/tmp/skel.json';

describe('checkSpineVersion (Phase 12 / Plan 05 / F3)', () => {
  describe('accepted versions (no throw)', () => {
    it('accepts 4.2.43 (the SIMPLE_PROJECT fixture version)', () => {
      expect(() => checkSpineVersion('4.2.43', SKEL)).not.toThrow();
    });

    it('accepts 4.2.0 (exact lower-bound)', () => {
      expect(() => checkSpineVersion('4.2.0', SKEL)).not.toThrow();
    });

    it('accepts 4.3.0 (lenient pass per CONTEXT Deferred — 4.3+ silent pass)', () => {
      expect(() => checkSpineVersion('4.3.0', SKEL)).not.toThrow();
    });

    it('accepts 5.0.0 (lenient on any future major)', () => {
      expect(() => checkSpineVersion('5.0.0', SKEL)).not.toThrow();
    });
  });

  describe('rejected versions (throws SpineVersionUnsupportedError)', () => {
    it('rejects 4.1.99 (just below the bar)', () => {
      expect(() => checkSpineVersion('4.1.99', SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpineVersion('4.1.99', SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.1.99');
        expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
      }
    });

    it('rejects 3.8.99 (the F3 reproduction version)', () => {
      expect(() => checkSpineVersion('3.8.99', SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpineVersion('3.8.99', SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('3.8.99');
      }
    });

    it("rejects null with detectedVersion === 'unknown' (pre-3.7 had no `skeleton.spine` field)", () => {
      expect(() => checkSpineVersion(null, SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpineVersion(null, SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('unknown');
      }
    });

    it("rejects malformed string ('not-a-version') and echoes it back", () => {
      expect(() => checkSpineVersion('not-a-version', SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpineVersion('not-a-version', SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('not-a-version');
      }
    });

    it("rejects empty string ('') as malformed", () => {
      expect(() => checkSpineVersion('', SKEL)).toThrow(SpineVersionUnsupportedError);
    });

    it('rejects 0.0.0', () => {
      expect(() => checkSpineVersion('0.0.0', SKEL)).toThrow(SpineVersionUnsupportedError);
    });

    it('rejects 1.0.0 (any major < 4)', () => {
      expect(() => checkSpineVersion('1.0.0', SKEL)).toThrow(SpineVersionUnsupportedError);
    });

    it('rejects single-component input ("4")', () => {
      // parts[1] = undefined → parseInt('', 10) = NaN → reject branch fires.
      expect(() => checkSpineVersion('4', SKEL)).toThrow(SpineVersionUnsupportedError);
    });
  });
});
