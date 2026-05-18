import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { handleRuntime } from '../../src/core/runtime/types.js';
import { SpineVersionUnsupportedError } from '../../src/core/errors.js';

// D-12 (Phase 45, UX-02): a PERMANENT in-suite anti-false-green
// sentinel. Rides the every-CI `npm run test` gate (NOT a CI grep,
// NOT a one-time check). Standing regression guard against a future
// re-plan silently re-introducing the 4.3 reject — see memory
// feedback_replan_can_silently_descope_roadmap_contract. The
// handleRuntime(...).toBe('4.3') assertion is the DISPATCH-TARGET
// proof: routing, not merely "did not throw".
const REPO_ROOT = resolve(__dirname, '..', '..');

// The four CONTEXT.md-named in-repo 4.3 positive-routing fixtures
// (committed in Phase 44; all in the SAFE-01 denylist, so for
// SLIDER/XTRA01/XTRA02 this guard is their only in-suite routing
// assertion — skeleton2.json is additionally covered by
// d13-43-load-smoke:223-258, redundant positive coverage is fine).
const FIXTURES_43 = [
  'fixtures/SIMPLE_PROJECT_43/skeleton2.json',
  'fixtures/SLIDER_4_3/SLIDER-01.json',
  'fixtures/XTRA01_4_3/XTRA-01.json',
  'fixtures/XTRA02_4_3/XTRA-02.json',
].map((f) => resolve(REPO_ROOT, f));

describe('D-12 standing guard: every in-repo 4.3 fixture ROUTES (never the old 4.3-reject)', () => {
  for (const fx of FIXTURES_43) {
    it(`${fx} routes to the 4.3 runtime and never throws SpineVersionUnsupportedError`, () => {
      let caught: unknown;
      try {
        loadSkeleton(fx);
      } catch (e) {
        caught = e;
      }
      // The OLD 4.3-reject envelope must NEVER appear for a 4.3 input.
      expect(caught).not.toBeInstanceOf(SpineVersionUnsupportedError);
      // Post-flip a 4.3 fixture must not throw at all.
      expect(() => loadSkeleton(fx)).not.toThrow();
      // Dispatch-target proof (load-bearing): the routed LoadResult's
      // opaque skeletonData handle is branded by the 4.3 runtime.
      expect(handleRuntime(loadSkeleton(fx).skeletonData)).toBe('4.3');
    });
  }
});
