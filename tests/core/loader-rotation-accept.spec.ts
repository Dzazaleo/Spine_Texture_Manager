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

  // UAT regression — the spine-core fallback at TextureAtlas.js:152-155 sets
  // originalWidth/Height to packed dims when the atlas has no `offsets:` line.
  // For rotated regions this leaves canonical dims swapped (post-rotation).
  // loader.ts must detect the fallback and produce canonical W/H. This test
  // would have caught the original bug where the Global panel showed packed
  // 100×500 instead of canonical 500×100 for the `rect` region.
  it('rotated region surfaces canonical (unrotated) W/H, not packed dims', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    const rect = r.atlasSources.get('rect');
    expect(rect, "'rect' region must be present").toBeDefined();
    expect(rect!.rotated).toBe(true);
    // Fixture canonical source rectangle is 500w × 100h (per 33-01-SUMMARY).
    // Atlas packed dims are 100×500 (post-rotation). w/h MUST be canonical.
    expect(rect!.w, 'canonical W (unrotated)').toBe(500);
    expect(rect!.h, 'canonical H (unrotated)').toBe(100);
    // Packed dims (sharp.extract args) remain post-rotation.
    expect(rect!.packW, 'packed W on page').toBe(100);
    expect(rect!.packH, 'packed H on page').toBe(500);
  });

  it('unrotated regions still report identical w/h as packW/packH', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    for (const [name, s] of r.atlasSources) {
      if (s.rotated) continue;
      expect(s.w, `${name}: w == packW for unrotated`).toBe(s.packW);
      expect(s.h, `${name}: h == packH for unrotated`).toBe(s.packH);
    }
  });
});
