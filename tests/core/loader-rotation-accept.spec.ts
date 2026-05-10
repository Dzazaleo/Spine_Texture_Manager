// Phase 33 Plan 04 — ATLAS-01: loader accepts rotated atlas regions.
//
// Wave 1 RED scaffold (Plan 02) → Wave 3 active body (this file).
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`):
//   bounds.x=2, bounds.y=360, packedW=100, packedH=500,
//   canonicalW=500, canonicalH=100, offsetX=0, offsetY=0, rotate=90.
//
// The fixture contains exactly ONE rotated region (`rect`); the other three
// regions (CIRCLE, SQUARE, TRIANGLE) are unrotated. The count assertion
// locks the fixture shape — if the user reshuffles the fixture and the count
// changes, update both this literal AND 33-01-SUMMARY.md's Fixture Shape table.

import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const ROTATED_FIXTURE = path.resolve('fixtures/spine_rotated/EXPORT/skeleton.json');

describe('loader — accepts rotated atlas regions (ATLAS-01)', () => {
  it('loadSkeleton resolves without throwing on rotate:true regions', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    expect(r.skeletonData).toBeDefined();
    expect(r.atlas).toBeDefined();
    expect(r.atlasPath).not.toBeNull();
  });

  it('at least one atlasSources entry has rotated=true (fixture has a packer-rotated region)', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    const rotatedRegions = [...r.atlasSources.entries()].filter(
      ([, s]) => s.rotated,
    );
    expect(
      rotatedRegions.length,
      'fixture must contain at least one rotated region (packer threshold met)',
    ).toBeGreaterThanOrEqual(1);
    // Lock the exact count to the fixture shape (per CONTEXT §Claude's Discretion).
    // Reference: 33-01-SUMMARY.md "Fixture Shape" table — single `rect` region.
    expect(rotatedRegions.length).toBe(1);
  });
});
