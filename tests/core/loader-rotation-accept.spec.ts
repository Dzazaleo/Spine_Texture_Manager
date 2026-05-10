// Phase 33 Wave 1 RED scaffold — skipped placeholders. Bodies filled in by:
//   - Plan 03 (lockstep removal) for no-stale-rotation-error
//   - Plan 04 (D-01 + ATLAS-01/02 tests) for loader-rotation-accept + bounds-rotation-aabb
//   - Plan 05 (image-worker + ATLAS-03 tests) for export-rotation-dims + image-worker-rotation
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`):
//   bounds.x=2, bounds.y=360, packedW=100, packedH=500,
//   canonicalW=500, canonicalH=100, offsetX=0, offsetY=0, rotate=90.

import { describe, it } from 'vitest';
import * as path from 'node:path';

const ROTATED_FIXTURE = path.resolve('fixtures/spine_rotated/EXPORT/skeleton.json');

describe.skip('loader — accepts rotated atlas regions (ATLAS-01)', () => {
  // ROTATED_FIXTURE referenced once to keep the import non-dead-code.
  void ROTATED_FIXTURE;

  it.todo('loadSkeleton resolves without throwing on rotate:true regions');
  it.todo('at least one atlasSources entry has rotated=true');
});
