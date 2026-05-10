// Phase 33 Wave 1 RED scaffold — skipped placeholders. Bodies filled in by Plan 05.
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`):
//   bounds.x=2, bounds.y=360, packW=100, packH=500,
//   canonicalW=500, canonicalH=100, offsetX=0, offsetY=0, rotate=90.
//
// Hand-built atlasSource row will use: packW=100, packH=500, w=500, h=100,
// offsetX=0, offsetY=0, rotated=true.

import { describe, it } from 'vitest';
import * as path from 'node:path';

const ROTATED_PAGE = path.resolve('fixtures/spine_rotated/EXPORT/skeleton.png');

describe.skip('runExport — rotated atlas region extract (Phase 33 D-03)', () => {
  void ROTATED_PAGE;

  it.todo('passthrough: rotated region → output PNG canonical W×H (NOT packed-swapped)');
  it.todo('resize: rotated region → downscaled canonical W×H');
  it.todo(
    'passthrough: rotated region → pixel content matches unrotated reference (sharp.rotate(+90) direction lock)',
  );
});
