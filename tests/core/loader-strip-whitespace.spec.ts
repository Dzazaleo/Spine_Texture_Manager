/**
 * Strip-Whitespace atlas region handling — debug session
 * `.planning/debug/export-extract-area-bad-area.md` (2026-05-08).
 *
 * Locks the new atlasSources fields populated by the loader fix:
 *   - packW, packH: trimmed page bounds (region.width/height — what
 *     sharp.extract args must use).
 *   - offsetX, offsetY: libgdx bottom-left offset of the trimmed rect
 *     inside the orig canvas (region.offsetX/offsetY).
 *
 * Pre-fix the map only carried orig dims under (w, h); image-worker's
 * sharp.extract({width: w, height: h}) overshot the page PNG → libvips
 * "extract_area: bad extract area".
 *
 * Fixture: fixtures/spine_stripWS/EXPORT/ — minimal regression fixture.
 *   skeleton.atlas:
 *     skeleton.png (64×64)
 *     square: bounds:0,0,64,64 + offsets:218,218,500,500
 *
 * The fixture was authored by exporting a 500×500 source PNG (red 100×100
 * square centered in a transparent canvas) from Spine with Strip Whitespace
 * ON; Spine cropped the empty pixels and recorded the offset.
 */
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const STRIP_WS_FIXTURE = path.resolve('fixtures/spine_stripWS/EXPORT/skeleton.json');
const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');

describe('atlasSources — Strip-Whitespace region carries packW/packH/offsetX/offsetY', () => {
  it('Strip Whitespace ON: packW/packH match trimmed bounds; offsetX/offsetY non-zero; w/h = orig canvas', () => {
    const r = loadSkeleton(STRIP_WS_FIXTURE);
    const sq = r.atlasSources.get('square');
    expect(sq).toBeDefined();
    // Trimmed page rect — what sharp.extract must crop.
    expect(sq?.packW).toBe(64);
    expect(sq?.packH).toBe(64);
    // Orig canvas dims — what canonical/JSON math operates on.
    expect(sq?.w).toBe(500);
    expect(sq?.h).toBe(500);
    // libgdx bottom-left offset.
    expect(sq?.offsetX).toBe(218);
    expect(sq?.offsetY).toBe(218);
    // Page rect origin.
    expect(sq?.x).toBe(0);
    expect(sq?.y).toBe(0);
    expect(sq?.rotated).toBe(false);
  });

  it('atlas-less mode: packW/packH equal w/h; offsets are 0 (no Strip Whitespace concept)', () => {
    const r = loadSkeleton(ATLAS_LESS_FIXTURE);
    expect(r.atlasSources.size).toBeGreaterThan(0);
    for (const [, src] of r.atlasSources) {
      expect(src.packW).toBe(src.w);
      expect(src.packH).toBe(src.h);
      expect(src.offsetX).toBe(0);
      expect(src.offsetY).toBe(0);
    }
  });
});
