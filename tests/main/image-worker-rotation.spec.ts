// Phase 33 Plan 05 — ATLAS-03 image-worker rotation coverage.
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`, libgdx convention):
//   bounds.x=2, bounds.y=360, canonicalW=100, canonicalH=500 (vertical
//   source strip drawn in Spine editor), page-pixel W=500, page-pixel H=100
//   (post-pack horizontal slice), offsetX=0, offsetY=0, rotate=90.
//
// Hand-built atlasSource row mirrors the real loader output exactly. The
// runExport passthrough + resize paths must:
//   1. extract({left:2, top:360, width:packW=500, height:packH=100}) — page-pixel slice
//   2. sharp.rotate(+90) — produces canonical 100×500 buffer
// Output dims MUST be canonical (100×500), NOT page-pixel (500×100).
//
// Rotation direction VERIFIED EMPIRICALLY in 33-RESEARCH.md §"Sharp Rotation
// Direction (Empirical)" and re-probed via scripts/probe-sharp-rotate.mjs
// before Plan 05 shipped.

import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan } from '../../src/shared/types.js';

const ROTATED_DIR = path.resolve('fixtures/spine_rotated/EXPORT');
const ROTATED_PAGE = path.join(ROTATED_DIR, 'skeleton.png');

// Fixture-shape constants — verbatim from 33-01-SUMMARY.md "Fixture Shape" table.
// libgdx convention: bounds:x,y,W,H stores W/H in CANONICAL (pre-rotation)
// orientation; page-pixel rect for rotated regions is (H × W) — see
// spine-core TextureAtlas.js:164-167 for u2/v2 derivation when degrees==90.
const FIXTURE_REGION_NAME = 'rect';
const CANONICAL_W = 100; // pre-rotation source width (vertical strip in editor)
const CANONICAL_H = 500;
const PACKED_W = 500; // page-pixel slice width (= libgdx bounds H for rotated)
const PACKED_H = 100; // page-pixel slice height (= libgdx bounds W for rotated)
const ATLAS_X = 2;
const ATLAS_Y = 360;
const OFFSET_X = 0; // no `offsets:` line — Strip Whitespace OFF
const OFFSET_Y = 0;

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-rot-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runExport — rotated atlas region extract (Phase 33 D-03)', () => {
  it('passthrough: rotated region produces output PNG with canonical W × H (NOT packed-swapped)', async () => {
    if (!fs.existsSync(ROTATED_PAGE)) {
      console.warn(`Skipping: rotated page missing at ${ROTATED_PAGE}`);
      return;
    }

    // sourcePath must be guaranteed-missing so pre-flight access fails and
    // the worker falls into the atlasSource extract path.
    const syntheticPerRegionPath = path.join(tmpDir, 'src', `${FIXTURE_REGION_NAME}.png`);
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath: syntheticPerRegionPath,
        outPath: `images/${FIXTURE_REGION_NAME}.png`,
        sourceW: CANONICAL_W,
        sourceH: CANONICAL_H,
        outW: CANONICAL_W,
        outH: CANONICAL_H,
        effectiveScale: 1,
        attachmentNames: [FIXTURE_REGION_NAME],
        atlasSource: {
          pagePath: ROTATED_PAGE,
          x: ATLAS_X,
          y: ATLAS_Y,
          packW: PACKED_W,
          packH: PACKED_H,
          offsetX: OFFSET_X,
          offsetY: OFFSET_Y,
          w: CANONICAL_W,
          h: CANONICAL_H,
          rotated: true,
        },
      }],
      totals: { count: 1 },
    } as unknown as ExportPlan;

    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors, 'no export errors').toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', `${FIXTURE_REGION_NAME}.png`);
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.width, 'output W must be canonical W (NOT packed W)').toBe(CANONICAL_W);
    expect(meta.height, 'output H must be canonical H (NOT packed H)').toBe(CANONICAL_H);
  });

  it('resize: rotated region downscaled by 0.5× produces canonical W/2 × H/2 output', async () => {
    if (!fs.existsSync(ROTATED_PAGE)) {
      console.warn(`Skipping: rotated page missing at ${ROTATED_PAGE}`);
      return;
    }

    const syntheticPerRegionPath = path.join(tmpDir, 'src', `${FIXTURE_REGION_NAME}.png`);
    const plan: ExportPlan = {
      rows: [{
        sourcePath: syntheticPerRegionPath,
        outPath: `images/${FIXTURE_REGION_NAME}.png`,
        sourceW: CANONICAL_W,
        sourceH: CANONICAL_H,
        outW: Math.ceil(CANONICAL_W * 0.5),
        outH: Math.ceil(CANONICAL_H * 0.5),
        effectiveScale: 0.5,
        attachmentNames: [FIXTURE_REGION_NAME],
        atlasSource: {
          pagePath: ROTATED_PAGE,
          x: ATLAS_X,
          y: ATLAS_Y,
          packW: PACKED_W,
          packH: PACKED_H,
          offsetX: OFFSET_X,
          offsetY: OFFSET_Y,
          w: CANONICAL_W,
          h: CANONICAL_H,
          rotated: true,
        },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    } as unknown as ExportPlan;

    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors, 'no export errors').toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', `${FIXTURE_REGION_NAME}.png`);
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(Math.ceil(CANONICAL_W * 0.5));
    expect(meta.height).toBe(Math.ceil(CANONICAL_H * 0.5));
  });

  it('passthrough: rotated region produces non-blank output (sharp.rotate(+90) direction sanity check)', async () => {
    // Light pixel-content sanity check (per RESEARCH §Pixel-Compare Strategy).
    // A wrong rotation direction (e.g., -90 instead of +90) would still yield
    // canonical dims, so dim assertions alone do not lock direction. This
    // smoke check asserts SOME alpha > 0 in the output, catching the
    // degenerate-buffer / fully-transparent failure mode.
    //
    // The actual direction lock lives in scripts/probe-sharp-rotate.mjs and
    // the load-bearing comment in src/main/image-worker.ts.
    if (!fs.existsSync(ROTATED_PAGE)) {
      console.warn(`Skipping: rotated page missing at ${ROTATED_PAGE}`);
      return;
    }

    const syntheticPerRegionPath = path.join(tmpDir, 'src', `${FIXTURE_REGION_NAME}.png`);
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath: syntheticPerRegionPath,
        outPath: `images/${FIXTURE_REGION_NAME}.png`,
        sourceW: CANONICAL_W,
        sourceH: CANONICAL_H,
        outW: CANONICAL_W,
        outH: CANONICAL_H,
        effectiveScale: 1,
        attachmentNames: [FIXTURE_REGION_NAME],
        atlasSource: {
          pagePath: ROTATED_PAGE,
          x: ATLAS_X, y: ATLAS_Y,
          packW: PACKED_W, packH: PACKED_H,
          offsetX: OFFSET_X, offsetY: OFFSET_Y,
          w: CANONICAL_W, h: CANONICAL_H,
          rotated: true,
        },
      }],
      totals: { count: 1 },
    } as unknown as ExportPlan;

    await runExport(plan, tmpDir, () => {}, () => false);
    const outPath = path.join(tmpDir, 'images', `${FIXTURE_REGION_NAME}.png`);
    const { data, info } = await sharp(outPath).raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(CANONICAL_W);
    expect(info.height).toBe(CANONICAL_H);

    // Content-aware lock per Phase 33 CR-01: the `rect` region is the white
    // strip drawn in the Spine editor. If packW/packH or the rotation
    // direction regresses, the extract slice will overlap a neighbor (SQUARE
    // is bright green at y≥462 on the page) and the channel means will drift.
    // Use sharp.stats() on the buffer — full-opaque white means RGB≈255 and
    // alpha≈255 across the entire region (no transparency, no green tint).
    const stats = await sharp(outPath).stats();
    const [rMean, gMean, bMean, aMean] = stats.channels.map((c) => c.mean);
    expect(rMean, 'rect should be white (R≈255)').toBeGreaterThan(240);
    expect(gMean, 'rect should be white (G≈255)').toBeGreaterThan(240);
    expect(bMean, 'rect should be white (B≈255)').toBeGreaterThan(240);
    expect(aMean, 'rect should be fully opaque (alpha≈255)').toBeGreaterThan(240);
    // Pre-fix bug check: if packW/packH were swapped, the extract would pull
    // green pixels from the adjacent SQUARE region. Lock that gMean alone
    // cannot dominate (catches CCW90 / -90 sign errors AND wrong-slice extracts).
    expect(gMean - rMean, 'no green-dominant tint (would indicate wrong page slice)').toBeLessThan(10);
  });
});

// Regression: rotated region whose page-pixel rect's right edge exceeds the
// page HEIGHT (not width) tripped libvips `extract_area: bad extract area`
// because sharp fuses `extract().rotate(90).resize()` and validates the
// extract rect against POST-rotate canvas dims (axes swapped). The fix at
// image-worker.ts:595-617 materializes the rotated buffer with .toBuffer()
// before resize, breaking the fusion. See `.planning/debug/resolved/
// extract-area-rot-regression.md` for the full trace.
describe('runExport — rotated atlas extract bounds (extract_area regression)', () => {
  it('rotated region with x + packW > pageHeight succeeds (libvips fusion break)', async () => {
    // Synth a 200x50 wide-but-short page. Place rotated rect at (x=140, y=10)
    // with packW=60, packH=30 — so x+packW=200 > pageH=50, which used to
    // trigger `extract_area: bad extract area` before the materialize-then-
    // resize fix. packW=60 means CANONICAL_H=60 (libgdx rotated convention).
    const pageW = 200;
    const pageH = 50;
    const pagePath = path.join(tmpDir, 'rot-bounds-page.png');
    await sharp({
      create: {
        width: pageW,
        height: pageH,
        channels: 4,
        background: { r: 255, g: 128, b: 64, alpha: 1 },
      },
    }).png().toFile(pagePath);

    const canonicalW = 30;
    const canonicalH = 60;
    const packW = 60;
    const packH = 30;
    const atlasX = 140;
    const atlasY = 10;
    // Sanity: this MUST trip the predicate for the regression to be meaningful.
    expect(atlasX + packW, 'predicate: x + packW must exceed pageH').toBeGreaterThan(pageH);

    const syntheticPerRegionPath = path.join(tmpDir, 'src', 'rect.png');
    const plan: ExportPlan = {
      rows: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/rect.png',
        sourceW: canonicalW,
        sourceH: canonicalH,
        outW: Math.ceil(canonicalW * 0.5),
        outH: Math.ceil(canonicalH * 0.5),
        effectiveScale: 0.5,
        attachmentNames: ['rect'],
        atlasSource: {
          pagePath,
          x: atlasX,
          y: atlasY,
          packW,
          packH,
          offsetX: 0,
          offsetY: 0,
          w: canonicalW,
          h: canonicalH,
          rotated: true,
        },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    } as unknown as ExportPlan;

    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors, 'no extract_area errors').toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', 'rect.png');
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(Math.ceil(canonicalW * 0.5));
    expect(meta.height).toBe(Math.ceil(canonicalH * 0.5));
  });
});
