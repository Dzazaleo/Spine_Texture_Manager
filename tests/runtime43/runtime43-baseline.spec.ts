// tests/runtime43/runtime43-baseline.spec.ts
// Phase 43 Plan 05 — the 4.3 own-baseline SENTINEL + the A1 empirical proof.
//
// D-01: this baseline is a SEPARATE store (tests/runtime43/baselines/), NOT
// golden-shared with the frozen SAFE-01 corpus (tests/safe01/baselines/). It is
// a regression SENTINEL, NOT the phase-stop gate — only SAFE-02 (Plan 03) is
// the HARD exit gate. The baseline is captured FRESH in Phase 43 (D-01:
// "real-rig sampled, not smoke-only") and re-asserted strictly on every run.
//
// A1 (the single highest-risk assumption — PORT-03 4.3 rotated-region
// "verify-then-no-op", Assumptions Log A1, T-43-14): the rotate:90 regions
// (TRIANGLE, rect) in skeleton2.atlas are EMPIRICALLY validated against the
// same-session same-hash 4.2-sibling known-good (skeleton2_42.json, hash
// mFDzgNETPHo) within 1e-4. This is a REAL test, not a comment — it PROVES or
// FALSIFIES Approach A (the Plan-04 no-op) before it is trusted.
import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import * as path from 'node:path';
import { canonicalize } from '../safe01/canonical-json.js';
import {
  buildLoad43,
  loadSibling42,
  regionAABBsAtSetupPose,
  ROTATED_REGION_NAMES,
  sample,
} from './baseline-driver.js';
import type { AABB } from '../../src/core/types.js';

const BASE_DIR = path.resolve(__dirname, 'baselines');
const BASE_43 = path.resolve(BASE_DIR, 'skeleton2.json');

/** The frozen part — identical shape to SAFE-01 (`_meta` excluded as volatile
 *  provenance). Mirrors safe01-baseline.spec.ts:39-45 but for the SEPARATE
 *  4.3 store (D-01). */
function frozenPart(p: Record<string, unknown>) {
  return {
    globalPeaks: p.globalPeaks,
    perAnimation: p.perAnimation,
    setupPosePeaks: p.setupPosePeaks,
  };
}

/** 1e-4 — same-hash cross-runtime geometry tolerance (the A1 ground truth).
 *  DISTINCT from SAFE-02's strict byte-equal (Plan 03 owns that; unchanged). */
const A1_TOL = 1e-4;

function aabbClose(a: AABB, b: AABB, tol: number): boolean {
  return (
    Math.abs(a.minX - b.minX) <= tol &&
    Math.abs(a.minY - b.minY) <= tol &&
    Math.abs(a.maxX - b.maxX) <= tol &&
    Math.abs(a.maxY - b.maxY) <= tol
  );
}

describe('runtime-43 own-baseline (SENTINEL, NOT the phase-stop gate — D-01; SEPARATE store)', () => {
  it('4.3 skeleton2.json samples byte-stable vs its OWN committed 4.3 baseline (captured fresh in Phase 43)', () => {
    const built = buildLoad43();
    if (built == null) {
      expect(true).toBe(true);
      return;
    } // legit Wave-0 skip: 4.3 fixture absent

    // PORT-01: the 4.3 owner rig MUST sample through runtime-43 without throw,
    // exercising every API-mapped surface (Pose API, getOffsets, sequence
    // region meta, appliedPose bone scale).
    const output = sample(built.load);

    const json = canonicalize(output, {
      fixture: 'SIMPLE_PROJECT_43/skeleton2.json',
    });
    const live = JSON.parse(json) as Record<string, unknown>;

    if (!existsSync(BASE_43)) {
      // First capture (D-01 — captured in Phase 43, SEPARATE store, NOT
      // golden-shared with SAFE-01). frozenPart only (`_meta` is volatile
      // provenance — same exclusion as SAFE-01).
      mkdirSync(BASE_DIR, { recursive: true });
      writeFileSync(
        BASE_43,
        JSON.stringify(frozenPart(live), null, 2) + '\n',
        'utf8',
      );
    }

    const committed = JSON.parse(readFileSync(BASE_43, 'utf8')) as Record<
      string,
      unknown
    >;
    // Strict regression sentinel (NOT the SAFE-02 hard gate — D-01). Any drift
    // shows EXACTLY which `${skin}/${slot}/${attachment}` record moved.
    expect(frozenPart(live)).toEqual(frozenPart(committed));
  });

  it('A1: 4.3 rotated-region world geometry matches the 4.2-sibling known-good (PORT-03 Approach-A empirical proof)', () => {
    const pair43 = buildLoad43();
    const sibling42 = loadSibling42();
    if (pair43 == null || sibling42 == null) {
      expect(true).toBe(true);
      return;
    } // Wave-0 skip: 4.3 fixture or 4.2 sibling absent

    const filter = new Set<string>(ROTATED_REGION_NAMES);

    // 4.3 path: pickRuntime('4.3') + runtime-43 parse (Approach A no-op
    // applyRotatedRegionFix already applied by load43.ts/buildLoad43).
    const aabb43 = regionAABBsAtSetupPose(
      { rt: pair43.rt, skeletonData: pair43.load.skeletonData as never },
      filter,
    );
    // 4.2-sibling known-good: same-session same-hash geometry through the
    // byte-trusted runtime-42 path (NOT committed — read-only; D-05).
    const aabb42 = regionAABBsAtSetupPose(sibling42, filter);

    // Both rigs MUST surface the rotate:90 regions (a missing region would be
    // a silent classify-as-skip — Pitfall 2 — which this also catches).
    expect(
      [...aabb43.keys()].sort(),
      'the 4.3 path must produce world AABBs for the rotate:90 regions',
    ).toEqual([...ROTATED_REGION_NAMES].sort());
    expect([...aabb42.keys()].sort()).toEqual([...ROTATED_REGION_NAMES].sort());

    // The A1 ground truth: same-hash same-geometry rigs ⇒ the 4.3 native
    // Sequence.update→computeUVs rotated math (Approach A) must agree with the
    // 4.2 Phase-33 SWAP-form offset[] write within 1e-4. AGREE ⇒ Approach A
    // is empirically VALIDATED. DIVERGE ⇒ Approach A is FALSIFIED and the
    // Approach-B fallback (recompute into sequence.offsets[]) must be applied
    // in runtime-43.applyRotatedRegionFix and this test re-run (the plan is
    // autonomous:false precisely so a B change surfaces for human review).
    for (const name of ROTATED_REGION_NAMES) {
      const g43 = aabb43.get(name)!;
      const g42 = aabb42.get(name)!;
      expect(
        aabbClose(g43, g42, A1_TOL),
        `A1 rotated-region "${name}": 4.3 world AABB ` +
          `${JSON.stringify(g43)} diverges from the 4.2-sibling known-good ` +
          `${JSON.stringify(g42)} beyond ${A1_TOL}. Approach A (the Plan-04 ` +
          `no-op) is FALSIFIED — apply Approach B (recompute into ` +
          `sequence.offsets[i]) in runtime-43.applyRotatedRegionFix.`,
      ).toBe(true);
    }
  });
});
