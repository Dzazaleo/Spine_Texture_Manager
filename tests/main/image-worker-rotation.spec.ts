// Phase 33 Plan 05 — ATLAS-03 image-worker rotation coverage.
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`):
//   bounds.x=2, bounds.y=360, packW=100, packH=500,
//   canonicalW=500, canonicalH=100, offsetX=0, offsetY=0, rotate=90.
//
// Hand-built atlasSource row mirrors the fixture exactly. The runExport
// passthrough + resize paths must un-rotate the packed region to canonical
// orientation via sharp.rotate(+90) (direction VERIFIED EMPIRICALLY in
// 33-RESEARCH.md §"Sharp Rotation Direction (Empirical)" and re-probed
// per scripts/probe-sharp-rotate.mjs before Plan 05 shipped).

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
const FIXTURE_REGION_NAME = 'rect';
const CANONICAL_W = 500;
const CANONICAL_H = 100;
const PACKED_W = 100; // = CANONICAL_H (libgdx CCW90 swaps WH)
const PACKED_H = 500; // = CANONICAL_W
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
    let totalAlpha = 0;
    for (let i = 3; i < data.length; i += info.channels) {
      totalAlpha += data[i];
    }
    expect(totalAlpha, 'output must have some non-transparent pixels').toBeGreaterThan(0);
  });
});
