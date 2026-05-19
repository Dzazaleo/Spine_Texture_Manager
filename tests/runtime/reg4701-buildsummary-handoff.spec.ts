/**
 * Phase 47 Plan 04 — T-A: the PERMANENT REG-47-01 cross-runtime-handoff
 * regression (the deleted `_dbg-` throwaway is now a git-tracked standing
 * guard).
 *
 * Background (debug `reg-47-01-43-load-reading-r`, Resolution
 * `repro_spec_disposition`): `src/main/buildSummary` historically
 * materialized the skeleton with a HARDCODED 4.2 `new Skeleton(load.
 * skeletonData)` (`summary.ts:19` import + `:300` ctor). For a 4.3 fixture
 * `load.skeletonData` is a spine-core@4.3.0 SkeletonData (the loader correctly
 * routed it via runtime-43), so the 4.2 `Slot` constructor's setup-pose called
 * `Color.setFromColor` on an `undefined` 4.3-shaped slot color and threw
 *   `TypeError: Cannot read properties of undefined (reading 'r')`
 *   at Color.setFromColor ← Slot.setToSetupPose ← new Slot ← new Skeleton
 *   ← buildSummary  src/main/summary.ts:300
 * The throw was swallowed by the loader catch and reformatted into the
 * `Unknown: …` toast (classifier fall-through), so the 4.3 project never
 * loaded. A Phase-43 RT-02 leaf-call-migration MISS: `sampleSkeleton` was
 * migrated to `load.runtime.makeSkeleton` (sampler.ts:140/169/430);
 * `buildSummary` was not. FIXED in `53e480c` (summary.ts now materializes via
 * `load.runtime.makeSkeleton` + `load.runtime.slots`).
 *
 * This spec is the permanent standing guard that the `53e480c` fix is never
 * reverted. The pre-existing Phase-44 D-11 test
 * (`tests/runtime/d13-43-load-smoke.spec.ts`) only asserted
 * `loadSkeleton(...)` does not throw — it never ran sampleSkeleton/
 * buildSummary, which is exactly why this escapee was invisible to the suite.
 * THIS spec drives the FULL `loadSkeleton → sampleSkeleton → buildSummary`
 * chain (the deleted throwaway's exact chain) so a regression cannot hide.
 *
 * Headless (node env — CLAUDE.md Fact #5): the loader → sampler → summary
 * chain is pure core/main, no DOM/WebGL. Analog:
 * `tests/runtime/d13-43-load-smoke.spec.ts` (the loader→chain idiom +
 * fixture-path resolution) + `tests/core/summary.spec.ts` (the
 * `loadSkeleton`/`sampleSkeleton`/`buildSummary` 3-symbol chain idiom).
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';

const REPO_ROOT = resolve(__dirname, '..', '..');

// 4.3 leg — the exact fixture that reproduced REG-47-01 (`spine: "4.3.01"`,
// loader routes it via runtime-43 → 4.3 SkeletonData).
const FIXTURE_43 = resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.json');
// 4.2 control — the established GL-alpha canary (`spine: "4.2.43"`, loader
// routes it via the 4.2 runtime → 4.2 SkeletonData).
const FIXTURE_42 = resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

/**
 * Drive the EXACT renderer cross-runtime chain the deleted `_dbg-` throwaway
 * drove: loadSkeleton → sampleSkeleton → buildSummary. Returns the summary so
 * callers can additionally assert the DV-1a `runtimeTag` field (a free,
 * valuable assertion — the same buildSummary path that threw pre-53e480c is
 * the one that now populates `runtimeTag`).
 */
function fullChain(fixturePath: string) {
  const load = loadSkeleton(fixturePath);
  const sampled = sampleSkeleton(load);
  return buildSummary(load, sampled, 0);
}

describe('Phase 47 T-A: REG-47-01 cross-runtime buildSummary handoff — permanent regression', () => {
  it("4.3 repro: full chain on skeleton2.json does NOT throw `reading 'r'` (the 53e480c fix is the standing guard)", () => {
    // Pre-53e480c this threw `TypeError: Cannot read properties of undefined
    // (reading 'r')` at Color.setFromColor ← … ← buildSummary summary.ts:300.
    // `.not.toThrow()` is the regression assertion; the explicit
    // `summary.runtimeTag === '4.3'` proves the chain ran end-to-end through
    // the 4.3 runtime (not merely "did not throw early").
    let summary: ReturnType<typeof fullChain> | undefined;
    expect(
      () => {
        summary = fullChain(FIXTURE_43);
      },
      "the 4.3 fixture must NOT throw the REG-47-01 `reading 'r'` symptom " +
        '(cross-runtime buildSummary handoff — 53e480c must never be reverted)',
    ).not.toThrow();

    expect(summary, 'buildSummary returned a SkeletonSummary for the 4.3 fixture').toBeTruthy();
    expect(
      summary?.runtimeTag,
      'the 4.3 fixture is materialized through the 4.3 runtime — DV-1a ' +
        'runtimeTag is populated by the same (fixed) buildSummary path',
    ).toBe('4.3');
  });

  it('4.2 control: full chain on SIMPLE_TEST.json succeeds and tags 4.2', () => {
    // The control proves the fix did not regress the 4.2 path (4.2
    // skeletonData → 4.2 adapter → the same spine-core-42 Skeleton).
    let summary: ReturnType<typeof fullChain> | undefined;
    expect(
      () => {
        summary = fullChain(FIXTURE_42);
      },
      'the 4.2 control must pass the same loadSkeleton→sampleSkeleton→' +
        'buildSummary chain unchanged',
    ).not.toThrow();

    expect(summary, 'buildSummary returned a SkeletonSummary for the 4.2 control').toBeTruthy();
    expect(
      summary?.runtimeTag,
      'the 4.2 control is materialized through the 4.2 runtime',
    ).toBe('4.2');
  });
});
