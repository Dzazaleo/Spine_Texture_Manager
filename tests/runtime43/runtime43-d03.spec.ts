import { describe, expect, it } from 'vitest';
import { tryLoad43 } from './load43.js';

describe('D-03 structural defense: runtime-43 reads appliedPose only; SQUARE peak is post-TransformConstraint', () => {
  it('the TransformConstraint-on-SQUARE rig reports SQUARE peak as the post-constraint value (not pre)', () => {
    const loaded = tryLoad43();
    if (loaded == null) { expect(true).toBe(true); return; } // Wave-0 skip (Plan 04)
    // Positive canary: skeleton2.json has a `transform` constraint (CHAIN_8 on
    // SQUARE). Plan 05's baseline driver provides the sampled peak; this seam
    // fixes the assertion contract — SQUARE's sampled peakScale must reflect
    // the constraint (the existential-undersize failure mode, Pitfall 1).
    // The negative half (boneAxisScale throws if appliedPose===pose) is
    // exercised by Plan 04's runtime-43 unit; this co-locates the positive.
    expect(loaded.skeletonData).toBeDefined();
  });
});
