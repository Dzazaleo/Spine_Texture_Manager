// Phase 33 Wave 1 RED scaffold — skipped placeholders. Bodies filled in by Plan 04.
//
// 16-case bone-rotation × attachment-rotation matrix for the rotated RegionAttachment
// AABB invariant. See 33-RESEARCH.md §"Bone-Rotation Matrix Specifics (ATLAS-02)".
//
// Reference (from 33-01-SUMMARY.md, region `rect`):
//   canonicalW=500, canonicalH=100 (= packedH, packedW after libgdx CCW90 inversion).

import { describe, it } from 'vitest';

describe.skip('attachmentWorldAABB — rotated RegionAttachment matrix (ATLAS-02)', () => {
  // 16 cases planned: 8 bone-states × 2 attachment.rotation values (0, 30°)
  // See 33-RESEARCH.md §"Bone-Rotation Matrix Specifics (ATLAS-02)" for full matrix.
  it.todo('identity bone, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('identity bone, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 45°, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 45°, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 90°, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 90°, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 180°, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 180°, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot -45°, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot -45°, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone scale 2×0.5, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone scale 2×0.5, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone scale 0.5×2, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone scale 0.5×2, attRot=30: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 30° + scale 2×0.5, attRot=0: rotated AABB w×h matches unrotated reference');
  it.todo('bone rot 30° + scale 2×0.5, attRot=30: rotated AABB w×h matches unrotated reference');
});
