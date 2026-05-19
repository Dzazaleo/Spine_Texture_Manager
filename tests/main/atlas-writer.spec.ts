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
 *     / originalWidth / originalHeight (width/height inherited from
 *     TextureRegion base; degrees=90 when input had `rotate:true` per
 *     TextureAtlas.js:87-93; originalWidth/Height from offsets: line per
 *     TextureAtlas.js:88-100).
 *
 * Plan 02 type-coupling deviation note:
 *   `RepackPage` / `RepackedRegion` are imported from the SAME
 *   `../../src/main/atlas-writer.js` module that re-exports them locally
 *   pending Plan 02 merge (see atlas-writer.ts header). When Plan 02
 *   merges first, both this test and atlas-writer.ts switch their
 *   imports to `../../src/core/repack.js`.
 *
 * 2026-05-15 update (debug session `atlas-repack-output-bugs`):
 *   bounds: w/h are now PRE-rotation canonical (= origW/origH); `offsets:`
 *   is emitted UNCONDITIONALLY so spine-core does NOT auto-backfill
 *   originalWidth from region.width. Rotated-region tests assert the new
 *   semantics + verify originalWidth/Height round-trip through the parser.
 *
 * 2026-05-19 update (REPACK-12 — debug session
 * `atlas-rotation-neck-oversized`):
 *   `RepackedRegion` gained `origCanvasW/origCanvasH/offsetX/offsetY` (the
 *   SOURCE atlas's strip-whitespace metadata, scaled by the pixel-resize
 *   factor in repack-worker.ts). `buildAtlasText` now emits
 *   `offsets:offsetX,offsetY,origCanvasW,origCanvasH`. `makeRegion` defaults
 *   them to (origW, origH, 0, 0) so every PRE-EXISTING assertion still sees
 *   `offsets:0,0,origW,origH` — proving the back-compat (non-strip-
 *   whitespace) path is byte-identical. A dedicated round-trip test for the
 *   strip-whitespace rotated case is appended at the end of the file.
 */
import { describe, expect, it } from 'vitest';
import { TextureAtlas } from 'spine-core-42';
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
  origW?: number,
  origH?: number,
  // REPACK-12 (debug `atlas-rotation-neck-oversized`): the SOURCE atlas's
  // strip-whitespace logical canvas + trim offsets (scaled by the pixel-
  // resize factor upstream). DEFAULT to (origW, origH, 0, 0) — the
  // no-strip-whitespace identity that makes buildAtlasText emit the SAME
  // `offsets:0,0,origW,origH` line as the pre-REPACK-12 code, so every
  // pre-existing assertion in this file is unchanged.
  origCanvasW?: number,
  origCanvasH?: number,
  offsetX = 0,
  offsetY = 0,
): RepackedRegion {
  // For non-rotated regions, origW/origH default to w/h (no rotation swap).
  // For rotated regions, callers should pass explicit origW/origH (= the
  // pre-rotation canonical dims, which are SWAPPED relative to the
  // post-rotation page-rect w/h).
  const oW = origW ?? w;
  const oH = origH ?? h;
  return {
    regionName: name,
    pageIndex,
    x,
    y,
    w,
    h,
    origW: oW,
    origH: oH,
    // REPACK-12 back-compat default: logical canvas == canonical packed
    // (no strip-whitespace) + zero trim offsets ⇒ offsets:0,0,oW,oH.
    origCanvasW: origCanvasW ?? oW,
    origCanvasH: origCanvasH ?? oH,
    offsetX,
    offsetY,
    rotated,
  };
}

function makePage(pageIndex: number, width = 4096, height = 4096): RepackPage {
  return { pageIndex, width, height };
}

describe('buildAtlasText — REPACK-04 round-trip + field parity', () => {
  it('round-trip: emitted text parses cleanly via new TextureAtlas(text)', () => {
    const text = buildAtlasText({
      projectName: 'RT',
      pages: [makePage(0)],
      regions: [makeRegion('A', 0, 10, 20, 100, 100)],
    });
    const atlas = new TextureAtlas(text);
    expect(atlas.regions.length).toBe(1);
    expect(atlas.regions[0].name).toBe('A');
  });

  it('field parity: parsed region dims match the input RepackedRegion', () => {
    const text = buildAtlasText({
      projectName: 'FP',
      pages: [makePage(0)],
      regions: [makeRegion('SQUARE', 0, 5, 7, 64, 48)],
    });
    const atlas = new TextureAtlas(text);
    const r = atlas.regions[0];
    expect(r.name).toBe('SQUARE');
    expect(r.x).toBe(5);
    expect(r.y).toBe(7);
    expect(r.width).toBe(64);
    expect(r.height).toBe(48);
    // originalWidth/Height parsed from emitted offsets: line (NOT
    // auto-backfilled from region.width — we emit offsets unconditionally).
    expect(r.originalWidth).toBe(64);
    expect(r.originalHeight).toBe(48);
  });

  it('emits the locked whitespace style (key:value with no space after colon)', () => {
    const text = buildAtlasText({
      projectName: 'WS',
      pages: [makePage(0)],
      regions: [makeRegion('A', 0, 0, 0, 100, 100)],
    });
    expect(text).toContain('offsets:0,0,100,100');
    expect(text).not.toMatch(/^(size|filter|format|repeat|bounds|offsets|rotate): /m);
  });

  it('emits offsets: unconditionally for every region (non-rotated case)', () => {
    // Pre-fix: spine-core auto-backfilled originalWidth/Height from
    // region.width when no offsets: line is present (TextureAtlas.js:152-
    // 155). That fed post-rotation dims into the analyzer's actualSourceW/H
    // map → asymmetric sourceRatio → single-axis shrink on the Global tab.
    // We now emit offsets: for every region, even when there's no strip-
    // whitespace (offsets are 0,0 and originalW/H == bounds.W/H).
    const text = buildAtlasText({
      projectName: 'OF',
      pages: [makePage(0)],
      regions: [
        makeRegion('A', 0, 0, 0, 100, 100),
        makeRegion('B', 0, 110, 0, 200, 50),
        makeRegion('C', 0, 0, 110, 75, 80),
      ],
    });
    expect(text).toContain('offsets:0,0,100,100');
    expect(text).toContain('offsets:0,0,200,50');
    expect(text).toContain('offsets:0,0,75,80');
  });
});

describe('buildAtlasText — REPACK-06 rotation invariants', () => {
  it('no rotate when off: with all regions rotated=false, no `rotate:` line in output', () => {
    const text = buildAtlasText({
      projectName: 'NR',
      pages: [makePage(0)],
      regions: [
        makeRegion('A', 0, 0, 0, 100, 100),
        makeRegion('B', 0, 110, 0, 50, 50),
      ],
    });
    expect(text).not.toContain('rotate:true');
    expect(text).not.toMatch(/rotate:/);
  });

  it('rotated round-trip: rotate:true emits with PRE-rotation bounds + offsets', () => {
    // Input simulates packer's post-rotation dims: a 200×900 source that
    // the packer rotated 90° on-page. The packer's rect.width/height are
    // ALREADY swapped (maxrects-packer .d.ts:97-98 + RESEARCH §Landmines #3),
    // so post-rotation page-rect w=900, h=200. origW/origH carry the
    // PRE-rotation canonical dims (= the input RepackInput.packW/packH),
    // so origW=200, origH=900.
    //
    // 2026-05-15 corrected semantics (debug `atlas-repack-output-bugs`):
    // bounds: emits PRE-rotation (origW, origH), NOT post-rotation (w, h).
    // The libgdx-format convention (verified against Spine-exported
    // `fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas`) is that bounds:w/h are
    // canonical pre-rotation; the rotate flag tells the parser the page
    // bitmap is rotated 90° relative to canonical.
    const text = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0)],
      regions: [
        makeRegion(
          'ROTATED',
          0,
          50,
          60,
          900, // w (post-rotation page-rect width)
          200, // h (post-rotation page-rect height)
          true,
          200, // origW (pre-rotation canonical width)
          900, // origH (pre-rotation canonical height)
        ),
      ],
    });
    expect(text).toContain('rotate:true');
    // bounds: now carries PRE-rotation dims (origW, origH) per libgdx
    // convention. The previous (now-fixed) post-rotation emission produced
    // single-axis shrink on the Global tab by feeding the analyzer's
    // actualSourceW/H map post-rotation dims.
    expect(text).toContain('bounds:50,60,200,900');
    // offsets: carries the canonical canvas dims, emitted unconditionally
    // so spine-core does NOT auto-backfill originalWidth from region.width.
    expect(text).toContain('offsets:0,0,200,900');
    // Round-trip through spine-core's parser.
    const atlas = new TextureAtlas(text);
    expect(atlas.regions.length).toBe(1);
    const r = atlas.regions[0];
    // TextureAtlas.js:87-93 normalises rotate:true to degrees=90.
    expect(r.degrees).toBe(90);
    // bounds: round-trip — parser reads pre-rotation dims into width/height.
    expect(r.x).toBe(50);
    expect(r.y).toBe(60);
    expect(r.width).toBe(200);
    expect(r.height).toBe(900);
  });

  it('regression: parsed originalWidth/Height equal pre-rotation canonical dims', () => {
    // 2026-05-15 regression sentinel for debug session
    // `atlas-repack-output-bugs`. The bug was: rotated regions emitted
    // post-rotation bounds + omitted offsets, so spine-core auto-backfilled
    // originalWidth = region.width (= post-rotation w). Our analyzer then
    // read post-rotation dims into actualSourceW/H, asymmetric sourceRatio
    // produced single-axis shrink on the Global tab. The fix emits offsets:
    // pre-rotation unconditionally so originalWidth round-trips correctly.
    //
    // Test rect mirrors BEACHMAN/CARDS_L_HAND_1 from JOKERMAN_SPINE_ROT
    // (canonical 140×216, packer rotated 90° on-page → page-rect 216×140).
    const text = buildAtlasText({
      projectName: 'X',
      pages: [makePage(0)],
      regions: [
        makeRegion(
          'CARDS',
          0,
          100,
          200,
          216, // w (post-rotation page-rect)
          140, // h (post-rotation page-rect)
          true,
          140, // origW (canonical pre-rotation)
          216, // origH (canonical pre-rotation)
        ),
      ],
    });
    const atlas = new TextureAtlas(text);
    const r = atlas.regions.find((x) => x.name === 'CARDS');
    expect(r).toBeDefined();
    // The fix: originalWidth/Height equal pre-rotation canonical dims
    // regardless of rotation, because we emit offsets: explicitly. Before
    // the fix, both would have been post-rotation (216 / 140).
    expect(r!.originalWidth).toBe(140);
    expect(r!.originalHeight).toBe(216);
    expect(r!.degrees).toBe(90);
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

describe('buildAtlasText — REPACK-12 strip-whitespace metadata round-trip', () => {
  // Debug session `atlas-rotation-neck-oversized` (2026-05-19). When the
  // SOURCE atlas was Spine-exported WITH strip-whitespace, repack-worker.ts
  // forwards the source's logical canvas + trim offsets (scaled by the
  // pixel-resize factor) via RepackedRegion.origCanvasW/H + offsetX/Y. The
  // writer must emit them in the `offsets:` line so the runtime preserves
  // the source's original-to-packed PROPORTION (= render size). Dropping
  // them (pre-fix `offsets:0,0,packedW,packedH`) collapsed originalWidth
  // onto the trimmed+resized size → ~1.6× oversized NECK across all skins.

  it('back-compat: no strip-whitespace (origCanvas==orig, offsets 0) emits identical offsets:0,0 line', () => {
    // makeRegion defaults origCanvasW/H = origW/H and offsetX/Y = 0. This
    // is the no-strip-whitespace identity — the emitted offsets: line MUST
    // be byte-identical to the pre-REPACK-12 code (proves non-trimmed
    // atlases, incl. the REPACK-06 rotation byte-baseline, are unchanged).
    const nonRot = buildAtlasText({
      projectName: 'BC',
      pages: [makePage(0)],
      regions: [makeRegion('PLAIN', 0, 3, 4, 120, 90)],
    });
    expect(nonRot).toContain('bounds:3,4,120,90');
    expect(nonRot).toContain('offsets:0,0,120,90');

    const rot = buildAtlasText({
      projectName: 'BC',
      pages: [makePage(0)],
      regions: [
        makeRegion('PLAINROT', 0, 7, 8, 300, 100, true, 100, 300),
      ],
    });
    expect(rot).toContain('bounds:7,8,100,300');
    expect(rot).toContain('offsets:0,0,100,300');
    expect(rot).toContain('rotate:true');
  });

  it('rotated strip-whitespace region: offsets: carries scaled source logical size + trim offsets, round-trips through spine-core', () => {
    // Mirrors the JOKERMAN_SPINE_ROT NECK regression (debug session
    // `atlas-rotation-neck-oversized`). SOURCE atlas NECK (every skin):
    //   bounds:...,711,783  offsets:229,190,1148,1170  rotate:90
    //   (packed canonical 711×783; logical canvas 1148×1170; trim 229,190)
    // After the optimizer downscales by effScale≈0.53 the trimmed rect is
    // resized to outW×outH=609×621 and repack-worker.scaleSourceMeta scales
    // the source logical size + offsets by the same per-axis factor
    // (sx=609/711, sy=621/783) → origCanvasW/H≈983×928, offsets≈196,151.
    //
    // The render-size invariant the runtime preserves is
    //   originalWidth / packedWidth   (and the H analogue).
    // SOURCE:   1148/711 = 1.6146 ,  1170/783 = 1.4943
    // REWRITTEN: 983/609 = 1.6141 ,  928/621 = 1.4944   (≤0.1% drift —
    // integer-rounding noise) → NECK renders at the SAME relative size as
    // the correct source/atlas-less leg. The pre-fix bug emitted
    // offsets:0,0,609,621 → invariant 609/609 = 1.0 ≠ 1.6146 → ~1.6×
    // oversized (user's "grossly oversized neck" UAT report).
    const region: RepackedRegion = {
      regionName: 'AVATAR/NECK',
      pageIndex: 0,
      x: 1239,
      y: 1783,
      // post-rotation page-rect (packer swapped): canonical 609×621 rotated.
      w: 621,
      h: 609,
      // PRE-rotation canonical packed dims (= RepackInput.packW/H).
      origW: 609,
      origH: 621,
      // REPACK-12: scaled SOURCE logical canvas + trim offsets.
      origCanvasW: 983,
      origCanvasH: 928,
      offsetX: 196,
      offsetY: 151,
      rotated: true,
    };
    const text = buildAtlasText({
      projectName: 'JOKERMAN_SPINE_ROT',
      pages: [makePage(0)],
      regions: [region],
    });
    // bounds: PRE-rotation canonical packed dims (unchanged by REPACK-12).
    expect(text).toContain('bounds:1239,1783,609,621');
    // offsets: the scaled SOURCE strip-whitespace metadata (NOT 0,0,609,621).
    expect(text).toContain('offsets:196,151,983,928');
    expect(text).toContain('rotate:true');

    // Round-trip through the production spine-core parser.
    const atlas = new TextureAtlas(text);
    const r = atlas.regions.find((x) => x.name === 'AVATAR/NECK');
    expect(r).toBeDefined();
    expect(r!.degrees).toBe(90);
    // bounds: → width/height (pre-rotation canonical packed).
    expect(r!.width).toBe(609);
    expect(r!.height).toBe(621);
    // offsets: → originalWidth/Height (the scaled SOURCE logical canvas).
    expect(r!.originalWidth).toBe(983);
    expect(r!.originalHeight).toBe(928);

    // The load-bearing assertion: the render-size invariant
    // (originalWidth / packedWidth) is PRESERVED vs the SOURCE atlas
    // (1148/711 = 1.6146, 1170/783 = 1.4943) within integer-rounding
    // tolerance. This is what makes NECK render at the correct size; the
    // pre-fix bug collapsed it to 1.0 (offsets:0,0,packedW,packedH).
    const SRC_PROP_W = 1148 / 711; // 1.6146
    const SRC_PROP_H = 1170 / 783; // 1.4943
    const reW = r!.originalWidth / r!.width;
    const reH = r!.originalHeight / r!.height;
    expect(Math.abs(reW - SRC_PROP_W)).toBeLessThan(0.01);
    expect(Math.abs(reH - SRC_PROP_H)).toBeLessThan(0.01);
    // Sentinel against the regression: the broken value was exactly 1.0.
    expect(reW).toBeGreaterThan(1.5);
    expect(reH).toBeGreaterThan(1.4);
  });
});
