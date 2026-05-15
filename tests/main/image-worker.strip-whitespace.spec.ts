/**
 * Strip-Whitespace export pipeline regression — debug session
 * `.planning/debug/export-extract-area-bad-area.md` (2026-05-08).
 *
 * Pre-fix: runExport on a Strip-Whitespace atlas region threw libvips
 * "extract_area: bad extract area" because sharp.extract was called with
 * orig-canvas dims (500×500) against a trimmed 64×64 page PNG.
 *
 * Post-fix: extract uses packW/packH (trimmed bounds), then conditionally
 * extends back to the orig canvas via sharp.extend before resize. Result:
 * a properly sized PNG with the trimmed pixels positioned where Spine's
 * offsetX/offsetY says they belong inside the orig canvas.
 *
 * Fixture: fixtures/spine_stripWS/EXPORT/skeleton.png (64×64), region
 * `square` with offsets:218,218,500,500 — a red 100×100 square trimmed
 * from a 500×500 transparent canvas.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

const SW_DIR = path.resolve('fixtures/spine_stripWS/EXPORT');
const SW_PAGE = path.join(SW_DIR, 'skeleton.png');

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-sw-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runExport — Strip-Whitespace atlas-extract regression', () => {
  it('resize branch: 500×500 orig → 96×96 output (succeeds without "extract_area: bad extract area")', async () => {
    if (!fs.existsSync(SW_PAGE)) {
      console.warn(`Skipping: SW page missing at ${SW_PAGE}`);
      return;
    }

    // sourcePath must be guaranteed-missing so pre-flight access fails and
    // the worker falls into the atlasSource extract path. Putting it under
    // tmpDir (which is fresh per beforeEach) avoids cross-test pollution
    // that a fixtures/-relative path would suffer.
    const syntheticPerRegionPath = path.join(tmpDir, 'src', 'square.png');
    const plan: ExportPlan = {
      skeletonPath: '/proj/test.json',
      rows: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/square.png',
        sourceW: 500,
        sourceH: 500,
        outW: 96,
        outH: 96,
        effectiveScale: 0.192,
        attachmentNames: ['square'],
        atlasSource: {
          pagePath: SW_PAGE,
          x: 0,
          y: 0,
          packW: 64,
          packH: 64,
          offsetX: 218,
          offsetY: 218,
          w: 500,
          h: 500,
          rotated: false,
        },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(summary.errors).toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', 'square.png');
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(96);
    expect(meta.height).toBe(96);
    expect(meta.hasAlpha).toBe(true);
  });

  it('passthrough branch: SW region byte-emits the orig 500×500 canvas (trimmed pixels positioned at offset)', async () => {
    if (!fs.existsSync(SW_PAGE)) {
      console.warn(`Skipping: SW page missing at ${SW_PAGE}`);
      return;
    }

    // passthroughCopies row exercises image-worker.ts:273-302 (the byte-copy
    // / atlas-extract branch). The synthetic per-region path is under tmpDir
    // so it's guaranteed-missing; the worker falls through to atlasSource
    // extract → extend.
    const syntheticPerRegionPath = path.join(tmpDir, 'src', 'square.png');
    const plan: ExportPlan = {
      skeletonPath: '/proj/test.json',
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/square.png',
        sourceW: 500,
        sourceH: 500,
        outW: 500,
        outH: 500,
        effectiveScale: 1,
        attachmentNames: ['square'],
        atlasSource: {
          pagePath: SW_PAGE,
          x: 0,
          y: 0,
          packW: 64,
          packH: 64,
          offsetX: 218,
          offsetY: 218,
          w: 500,
          h: 500,
          rotated: false,
        },
      }],
      totals: { count: 1 },
    };

    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(summary.errors).toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', 'square.png');
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(500);

    // Spot-check pixels: corners must be transparent; the centre region
    // (where the trimmed 64×64 chunk lands at offset (218, 218 from bot-left
    // → 218 from top-left for the 64×64 chunk inset by (500-218-64)=218
    // from top) must contain opaque content.
    const raw = await sharp(outPath).raw().toBuffer({ resolveWithObject: true });
    const { data, info } = raw;
    const px = (x: number, y: number) => {
      const i = (y * info.width + x) * info.channels;
      return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] };
    };
    // Top-left corner of orig canvas: transparent (Strip-Whitespace background).
    expect(px(0, 0).a).toBe(0);
    expect(px(499, 0).a).toBe(0);
    expect(px(0, 499).a).toBe(0);
    expect(px(499, 499).a).toBe(0);
    // Centre (250, 250) lies inside the 64×64 trimmed chunk → opaque.
    expect(px(250, 250).a).toBeGreaterThan(0);
  });
});
