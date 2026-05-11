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

  // UAT regression — libgdx atlas convention encodes `bounds:x,y,W,H` in
  // CANONICAL (pre-rotation) orientation. For rotated regions, the actual
  // page-pixel rectangle has (height × width) extent. spine-core uses this
  // at TextureAtlas.js:164-167 for u2/v2 derivation when degrees==90.
  // packW/packH MUST be the page-pixel dims (used as sharp.extract args);
  // w/h MUST be canonical (used as JSON / orig-canvas dims).
  //
  // Caught by HUMAN-UAT: Global panel correctly showed canonical 100×500 for
  // the `rect` region but Optimize Assets exported 500×100 (rotated) and
  // atlas-preview pulled green pixels from SQUARE — both consequences of
  // packW/packH being 100×500 (canonical) instead of 500×100 (page-pixel),
  // so sharp.extract pulled from the wrong page slice.
  it('rotated region: w/h carry canonical dims, packW/packH carry page-pixel dims', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    const rect = r.atlasSources.get('rect');
    expect(rect, "'rect' region must be present").toBeDefined();
    expect(rect!.rotated).toBe(true);
    // Canonical source rectangle is 100w × 500h (vertical, drawn in Spine editor).
    expect(rect!.w, 'canonical W').toBe(100);
    expect(rect!.h, 'canonical H').toBe(500);
    // Page-pixel rect (post-pack rotation): 500w × 100h horizontal slice.
    expect(rect!.packW, 'page-pixel W on page').toBe(500);
    expect(rect!.packH, 'page-pixel H on page').toBe(100);
    // Page-pixel rect MUST fit entirely inside the page (1839×1464 per fixture).
    expect(rect!.x + rect!.packW).toBeLessThanOrEqual(1839);
    expect(rect!.y + rect!.packH).toBeLessThanOrEqual(1464);
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
