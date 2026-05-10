// Phase 33 Wave 1 RED scaffold — skipped placeholders. Bodies filled in by Plan 05.
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`):
//   canonicalW=500, canonicalH=100 — these are the dimensions buildExportPlan
//   must emit, NOT the packed (100,500) swap.

import { describe, it } from 'vitest';

describe.skip('buildExportPlan — rotated region canonical out dims (ATLAS-03)', () => {
  it.todo(
    'rotated row with canonicalW=500, canonicalH=100, peakScale=1.0 → outW=500, outH=100 (NOT 100×500 swapped)',
  );
  it.todo('rotated row preserves atlasSource.rotated=true through the plan');
});
