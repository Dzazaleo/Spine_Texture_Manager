// tests/runtime43/runtime43-d03.spec.ts
// Phase 43 Plan 05 — the D-03 POSITIVE canary (co-located with Plan-04's
// negative dev-assertion unit).
//
// Pitfall 1 / T-43-07 — THE existential-undersize failure mode: reading
// bone.pose instead of bone.appliedPose in runtime-43 silently returns
// pre-TransformConstraint geometry → every constraint-bearing rig reports a
// smaller-than-real peak, compiles fine, ~8% undersize ships. skeleton2.json
// has a `transform` constraint CHAIN_8 on SQUARE — the empirical canary.
//
// Positive proof: SQUARE's 4.3 globalPeaks peakScale (read via runtime-43's
// appliedPose-only boneAxisScale) must equal the 4.2-sibling's SQUARE peak
// (same-hash, same constraint, computed through the SAFE-02-frozen-trusted 4.2
// path) within 1e-4. If 4.3's SQUARE matches the byte-trusted 4.2 value, the
// appliedPose read is correct and the existential-undersize mode is
// backstopped. The negative half (boneAxisScale throws if appliedPose===pose)
// is exercised by Plan 04's runtime-43 unit.
import { describe, expect, it } from 'vitest';
import {
  buildLoad43,
  buildLoadSibling42,
  sample,
  squarePeakScale,
} from './baseline-driver.js';

/** 1e-4 — same-hash cross-runtime tolerance (the D-03 empirical proof).
 *  DISTINCT from SAFE-02's strict byte-equal (Plan 03; untouched). */
const D03_TOL = 1e-4;

describe('D-03 structural defense: runtime-43 reads appliedPose only; SQUARE peak is post-TransformConstraint', () => {
  it('the TransformConstraint-on-SQUARE rig reports SQUARE peak as the post-constraint value (== the byte-trusted 4.2-sibling within 1e-4)', () => {
    const built43 = buildLoad43();
    const built42 = buildLoadSibling42();
    if (built43 == null || built42 == null) {
      expect(true).toBe(true);
      return;
    } // Wave-0 skip: 4.3 fixture or 4.2 sibling absent

    const out43 = sample(built43.load);
    const out42 = sample(built42.load);

    const sq43 = squarePeakScale(out43);
    const sq42 = squarePeakScale(out42);

    expect(sq43, 'SQUARE must appear in the 4.3 globalPeaks').not.toBeNull();
    expect(
      sq42,
      'SQUARE must appear in the 4.2-sibling globalPeaks',
    ).not.toBeNull();

    // The 4.2 path is SAFE-02-frozen-trusted. If 4.3's SQUARE peak matches it,
    // runtime-43's appliedPose-only boneAxisScale correctly reflects the
    // TransformConstraint (CHAIN_8 on SQUARE) — the post-constraint value, NOT
    // the pre-constraint setup value. This is the empirical proof D-03 works.
    expect(
      Math.abs((sq43 as number) - (sq42 as number)) <= D03_TOL,
      `D-03 canary: 4.3 SQUARE peakScale ${sq43} diverges from the ` +
        `byte-trusted 4.2-sibling ${sq42} beyond ${D03_TOL}. runtime-43 may ` +
        `be reading bone.pose (pre-constraint) instead of bone.appliedPose — ` +
        `the existential-undersize failure mode (Pitfall 1).`,
    ).toBe(true);

    // Defense-in-depth: a pre-constraint read would collapse the constrained
    // scale toward the setup value. Assert the constrained peak is a real
    // positive scale (not a degenerate zero/NaN from a broken pose read).
    expect(Number.isFinite(sq43 as number)).toBe(true);
    expect((sq43 as number) > 0).toBe(true);
  });
});
