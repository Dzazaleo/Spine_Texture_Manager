/**
 * Phase 40 REPACK-04 + REPACK-06 + REPACK-09 — atlas-writer unit tests.
 *
 * Round-trip via spine-core's `TextureAtlas` parser proves our writer
 * emits text the production runtime can read. We test the API surface
 * the parser exposes (region count + names + dims + rotation), NOT
 * byte-identity of the round-tripped text — TextureAtlas.js:42-44
 * silently discards `format:` on parse (RESEARCH §Landmines #6), so
 * the parsed projection doesn't include it.
 *
 * Parser API spot-check (TextureAtlas.d.ts, verified against installed
 * 4.2.0):
 *   - new TextureAtlas(text: string) — single string argument; no
 *     TextureLoader callback required (matches usage in
 *     tests/core/synthetic-atlas.spec.ts:43, the in-repo precedent).
 *   - atlas.regions[i].name / x / y / width / height / degrees
 *     (width/height inherited from TextureRegion base; degrees=90
 *     when input had `rotate:true` per TextureAtlas.js:87-93).
 *
 * Plan 02 type-coupling deviation note:
 *   `RepackPage` / `RepackedRegion` are imported from the SAME
 *   `../../src/main/atlas-writer.js` module that re-exports them locally
 *   pending Plan 02 merge (see atlas-writer.ts header). When Plan 02
 *   merges first, both this test and atlas-writer.ts switch their
 *   imports to `../../src/core/repack.js`.
 */
import { describe, expect, it } from 'vitest';
import { TextureAtlas } from '@esotericsoftware/spine-core';
import {
  buildAtlasText,
  type RepackPage,
  type RepackedRegion,
} from '../../src/main/atlas-writer.js';

function makeRegion(
  name: string,
  pageIndex: number,
  x: number,
  y: number,
  w: number,
  h: number,
  rotated = false,
): RepackedRegion {
  return { regionName: name, pageIndex, x, y, w, h, rotated };
}

function makePage(pageIndex: number, width = 4096, height = 4096): RepackPage {
  return { pageIndex, width, height };
}

describe('buildAtlasText — REPACK-04 round-trip + field parity', () => {
  it('round-trip: emitted text parses cleanly via new TextureAtlas(text)', () => {
    const text = buildAtlasText({
      projectName: 'SIMPLE_TEST',
      pages: [makePage(0, 2048, 1024)],
      regions: [
        makeRegion('CIRCLE', 0, 10, 20, 699, 699),
        makeRegion('SQUARE', 0, 720, 20, 1000, 1000),
        makeRegion('TRIANGLE', 0, 10, 730, 833, 759),
      ],
    });
    // Parser accepts text-only construction (spine-core 4.2 confirmed via
    // TextureAtlas.d.ts:35); synthetic-atlas.spec.ts:43 is the in-repo
    // precedent.
    const atlas = new TextureAtlas(text);
    expect(atlas.regions.length).toBe(3);
    const names = atlas.regions.map((r) => r.name).sort();
    expect(names).toEqual(['CIRCLE', 'SQUARE', 'TRIANGLE']);
    // Page resolved with expected dims.
    expect(atlas.pages.length).toBe(1);
    expect(atlas.pages[0].name).toBe('SIMPLE_TEST.png');
    expect(atlas.pages[0].width).toBe(2048);
    expect(atlas.pages[0].height).toBe(1024);
  });

  it('field parity: parsed region dims match the input RepackedRegion', () => {
    const text = buildAtlasText({
      projectName: 'TEST',
      pages: [makePage(0, 1024, 1024)],
      regions: [makeRegion('A', 0, 100, 200, 300, 400)],
    });
    const atlas = new TextureAtlas(text);
    const a = atlas.regions.find((r) => r.name === 'A');
    expect(a).toBeDefined();
    // TextureAtlasRegion exposes x/y/width/height (TextureAtlas.d.ts:57-58
    // + TextureRegion.d.ts:57-58). Parser reads bounds:X,Y,W,H per
    // TextureAtlas.js:67-71.
    expect(a!.x).toBe(100);
    expect(a!.y).toBe(200);
    expect(a!.width).toBe(300);
    expect(a!.height).toBe(400);
    // degrees defaults to 0 when no rotate line is present (parser sets
    // explicitly only when rotate: is read; TextureAtlas.js:87-93).
    expect(a!.degrees).toBe(0);
  });

  it('emits the locked whitespace style (key:value with no space after colon)', () => {
    const text = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0, 512, 512)],
      regions: [makeRegion('R', 0, 0, 0, 100, 100)],
    });
    expect(text).toContain('size:512,512');
    expect(text).not.toContain('size: 512');
    expect(text).toContain('filter:Linear,Linear');
    expect(text).toContain('format:RGBA8888');
    expect(text).toContain('repeat:none');
    expect(text).toContain('bounds:0,0,100,100');
    // No space after any of the canonical colon-separated keys.
    expect(text).not.toMatch(/^(size|filter|format|repeat|bounds|rotate): /m);
  });
});

describe('buildAtlasText — REPACK-06 rotation invariants', () => {
  it('no rotate when off: with all regions rotated=false, no `rotate:` line in output', () => {
    const text = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0)],
      regions: [
        makeRegion('A', 0, 0, 0, 100, 100, false),
        makeRegion('B', 0, 110, 0, 100, 100, false),
      ],
    });
    // No rotate-prefixed line anywhere in the output.
    expect(text).not.toMatch(/^rotate:/m);
    expect(text).not.toContain('rotate:true');
    expect(text).not.toContain('rotate:false');
    // Round-trip: parser sees degrees=0 for both regions.
    const atlas = new TextureAtlas(text);
    for (const r of atlas.regions) {
      expect(r.degrees).toBe(0);
    }
  });

  it('rotated round-trip: rotated=true emits rotate:true with post-rotation bounds', () => {
    // Input simulates packer's post-rotation dims: a 200×900 source that
    // the packer rotated 90° on-page → bounds carry w=900, h=200 (matches
    // maxrects-packer .d.ts:97-98 + RESEARCH §Landmines #3).
    const text = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0)],
      regions: [makeRegion('ROTATED', 0, 50, 60, 900, 200, true)],
    });
    expect(text).toContain('rotate:true');
    expect(text).toContain('bounds:50,60,900,200');
    // Round-trip through spine-core's parser.
    const atlas = new TextureAtlas(text);
    expect(atlas.regions.length).toBe(1);
    const r = atlas.regions[0];
    // TextureAtlas.js:87-93 normalises rotate:true to degrees=90.
    expect(r.degrees).toBe(90);
    // Post-rotation dims survive the round-trip on the bounds slot.
    expect(r.x).toBe(50);
    expect(r.y).toBe(60);
    expect(r.width).toBe(900);
    expect(r.height).toBe(200);
  });
});

describe('buildAtlasText — REPACK-09 dim-scaling propagation', () => {
  it('changing region dims (buffer dim scaling) propagates verbatim to bounds: lines', () => {
    const base = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0)],
      regions: [makeRegion('A', 0, 0, 0, 100, 100)],
    });
    const buffered = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0)],
      regions: [makeRegion('A', 0, 0, 0, 110, 110)], // +10% buffer simulation
    });
    expect(base).toContain('bounds:0,0,100,100');
    expect(buffered).toContain('bounds:0,0,110,110');
    expect(base).not.toBe(buffered);
  });
});

describe('buildAtlasText — REPACK-05 page naming + multi-page format', () => {
  it('page naming: page 0 → {name}.png; page 1 → {name}_2.png; page 2 → {name}_3.png', () => {
    const text = buildAtlasText({
      projectName: 'MULTI',
      pages: [makePage(0), makePage(1), makePage(2)],
      regions: [
        makeRegion('A', 0, 0, 0, 100, 100),
        makeRegion('B', 1, 0, 0, 100, 100),
        makeRegion('C', 2, 0, 0, 100, 100),
      ],
    });
    // Page 0 → bare name (start of file, no leading newline).
    expect(text.startsWith('MULTI.png\n')).toBe(true);
    // Pages 1+2 use 1-based suffix (REPACK-05 locked convention).
    expect(text).toContain('\nMULTI_2.png\n');
    expect(text).toContain('\nMULTI_3.png\n');
    // No `_1.png` (we never emit that suffix — page 0 has no suffix).
    expect(text).not.toContain('MULTI_1.png');
    // Round-trip: parser sees 3 pages with the canonical names.
    const atlas = new TextureAtlas(text);
    expect(atlas.pages.length).toBe(3);
    expect(atlas.pages.map((p) => p.name)).toEqual([
      'MULTI.png',
      'MULTI_2.png',
      'MULTI_3.png',
    ]);
  });

  it('exactly one blank line between adjacent pages; none inside a page (no trailing newline)', () => {
    const text = buildAtlasText({
      projectName: 'M',
      pages: [makePage(0), makePage(1)],
      regions: [
        makeRegion('A', 0, 0, 0, 100, 100),
        makeRegion('B', 0, 110, 0, 100, 100),
        makeRegion('C', 1, 0, 0, 100, 100),
      ],
    });
    // Count blank lines (lines that are empty after split on \n).
    const blankCount = text.split('\n').filter((l) => l === '').length;
    expect(blankCount).toBe(1);
    // No trailing newline → split won't add a trailing empty.
    expect(text.endsWith('\n')).toBe(false);
    // Sanity: parser reads both pages (would fail if a blank landed inside
    // a page block — TextureAtlas.js:113-130 resets page=null on blank).
    const atlas = new TextureAtlas(text);
    expect(atlas.pages.length).toBe(2);
    expect(atlas.regions.length).toBe(3);
  });

  it('single-page output has zero blank lines and no trailing newline', () => {
    const text = buildAtlasText({
      projectName: 'SOLO',
      pages: [makePage(0)],
      regions: [makeRegion('A', 0, 0, 0, 100, 100)],
    });
    const blankCount = text.split('\n').filter((l) => l === '').length;
    expect(blankCount).toBe(0);
    expect(text.endsWith('\n')).toBe(false);
  });
});

describe('buildAtlasText — defensive checks (RESEARCH §Landmines #5)', () => {
  it('throws when projectName contains a colon', () => {
    expect(() =>
      buildAtlasText({
        projectName: 'bad:name',
        pages: [makePage(0)],
        regions: [makeRegion('A', 0, 0, 0, 100, 100)],
      }),
    ).toThrow(/must not contain.*':'/);
  });
});
