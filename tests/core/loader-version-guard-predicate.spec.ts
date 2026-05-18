/**
 * Phase 12 Plan 05 (D-21) — F3 Spine version guard.
 *
 * Task 2 RED → GREEN: `checkSpineVersion` predicate unit tests.
 *
 * The predicate lives in `src/core/loader.ts` and is exported (Task 2 GREEN
 * adds the export) so the predicate's seven decision cases can be exercised
 * independently of fixture loading. Cases:
 *   1. accepts 4.2.x   (the contracted minimum)
 *   2. rejects 4.3+    (Phase 32 strict-cut, COMPAT-01)
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
import { checkSpineVersion, resolveRuntimeTag } from '../../src/core/loader.js';
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

    it('rejects 4.3.0 (Phase 32 strict-cut at 4.3+)', () => {
      expect(() => checkSpineVersion('4.3.0', SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpineVersion('4.3.0', SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.3.0');
        expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
      }
    });

    it('rejects 4.3.91-beta (the typical 4.3-beta semver shape)', () => {
      expect(() => checkSpineVersion('4.3.91-beta', SKEL)).toThrow(SpineVersionUnsupportedError);
      try {
        checkSpineVersion('4.3.91-beta', SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.3.91-beta');
      }
    });

    it('rejects 5.0.0 (no Spine 5 yet; reject pending future support phase)', () => {
      expect(() => checkSpineVersion('5.0.0', SKEL)).toThrow(SpineVersionUnsupportedError);
    });
  });
});

/**
 * Phase 44 (DISP-01/02/03, D-06/07/08/09) — the dispatch resolver.
 *
 * `resolveRuntimeTag` is a NEW composed function (it does NOT replace
 * `checkSpineVersion`/`checkSpine43Schema` — those keep their existing
 * standalone-predicate contract above). It is the loader's version
 * dispatcher: token-primary band classification (D-06/07, suffix-tolerant
 * D-07), the split-out ≥4.4 reject arm (D-09, Pitfall 2 — NOT folded), and
 * the asymmetric positive-shape contradiction cross-check (D-08, Pitfall 3 —
 * positive-shape ONLY, never absence-based).
 *
 * Routing truth-table (RESEARCH [VERIFIED] real-fixture inspection):
 *   4.3.01 + constraints[]            → '4.3'
 *   4.2-from-4.3.01 + transform/path  → '4.2'  (D-07 suffix-tolerant; ORCL-02 4.2 leg)
 *   4.2.43 + transform               → '4.2'  (existing 4.2 golden — regression-safe)
 *   4.3.91-beta + constraints[]      → '4.3'  (was reject; now routes)
 */
describe('resolveRuntimeTag (Phase 44 / DISP-01/02/03 / D-06/07/08/09)', () => {
  describe('positive routing (returns a RuntimeTag)', () => {
    it("resolveRuntimeTag('4.2.43', {transform:[]}, P) === '4.2' (existing 4.2 golden shape)", () => {
      expect(resolveRuntimeTag('4.2.43', { transform: [] }, SKEL)).toBe('4.2');
    });

    it("resolveRuntimeTag('4.3.01', {constraints:[]}, P) === '4.3' (the 4.3 leg)", () => {
      expect(resolveRuntimeTag('4.3.01', { constraints: [] }, SKEL)).toBe('4.3');
    });

    it("resolveRuntimeTag('4.2-from-4.3.01', {transform:[],path:[]}, P) === '4.2' (D-07 suffix-tolerant; LOAD-BEARING for ORCL-02 4.2 leg)", () => {
      expect(
        resolveRuntimeTag('4.2-from-4.3.01', { transform: [], path: [] }, SKEL),
      ).toBe('4.2');
    });

    it("resolveRuntimeTag('4.3.73-beta', {constraints:[]}, P) === '4.3' (D-09 beta band, D-07 suffix-tolerant)", () => {
      expect(resolveRuntimeTag('4.3.73-beta', { constraints: [] }, SKEL)).toBe('4.3');
    });

    it("resolveRuntimeTag('4.3.0', {}, P) === '4.3' (D-08: constraint-less 4.3 is VALID — NOT a contradiction)", () => {
      expect(resolveRuntimeTag('4.3.0', {}, SKEL)).toBe('4.3');
    });
  });

  describe('preserved version-band rejects (throws SpineVersionUnsupportedError)', () => {
    it("resolveRuntimeTag('4.4.0', anyJson, P) THROWS (D-09 NEW ≥4.4 arm)", () => {
      expect(() => resolveRuntimeTag('4.4.0', {}, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
      try {
        resolveRuntimeTag('4.4.0', {}, SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('4.4.0');
        expect((err as SpineVersionUnsupportedError).skeletonPath).toBe(SKEL);
      }
    });

    it("resolveRuntimeTag('5.0.0', anyJson, P) THROWS (D-09 ≥5)", () => {
      expect(() => resolveRuntimeTag('5.0.0', {}, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
    });

    it("resolveRuntimeTag('4.1.99', anyJson, P) THROWS (PRESERVED <4.2 — Phase 12 F3)", () => {
      expect(() => resolveRuntimeTag('4.1.99', {}, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
    });

    it("resolveRuntimeTag('3.8.99', anyJson, P) THROWS (PRESERVED <4.2)", () => {
      expect(() => resolveRuntimeTag('3.8.99', {}, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
    });

    it("resolveRuntimeTag(null, anyJson, P) THROWS ('unknown') (PRESERVED)", () => {
      expect(() => resolveRuntimeTag(null, {}, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
      try {
        resolveRuntimeTag(null, {}, SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe('unknown');
      }
    });

    it("resolveRuntimeTag('not-a-version', anyJson, P) THROWS (PRESERVED malformed)", () => {
      expect(() => resolveRuntimeTag('not-a-version', {}, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
      try {
        resolveRuntimeTag('not-a-version', {}, SKEL);
      } catch (err) {
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe(
          'not-a-version',
        );
      }
    });
  });

  describe('D-08 asymmetric positive-shape contradiction (throws)', () => {
    it("resolveRuntimeTag('4.2.43', {constraints:[]}, P) THROWS (token=4.2 + top-level constraints[] → reject)", () => {
      expect(() => resolveRuntimeTag('4.2.43', { constraints: [] }, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
      try {
        resolveRuntimeTag('4.2.43', { constraints: [] }, SKEL);
      } catch (err) {
        // The '4.3-schema' sentinel is reused so errors.ts (Task 2) gives it
        // the contradiction wording.
        expect((err as SpineVersionUnsupportedError).detectedVersion).toBe(
          '4.3-schema',
        );
      }
    });

    it("resolveRuntimeTag('4.3.01', {ik:[]}, P) THROWS (token=4.3 + legacy top-level array → reject)", () => {
      expect(() => resolveRuntimeTag('4.3.01', { ik: [] }, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
    });

    it("resolveRuntimeTag('4.3.01', {transform:[]}, P) THROWS (token=4.3 + legacy transform → reject)", () => {
      expect(() => resolveRuntimeTag('4.3.01', { transform: [] }, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
    });

    it("resolveRuntimeTag('4.3.01', {path:[]}, P) THROWS (token=4.3 + legacy path → reject)", () => {
      expect(() => resolveRuntimeTag('4.3.01', { path: [] }, SKEL)).toThrow(
        SpineVersionUnsupportedError,
      );
    });
  });
});
