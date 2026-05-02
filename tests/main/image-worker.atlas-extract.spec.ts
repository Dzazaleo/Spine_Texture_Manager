/**
 * Phase 6 Gap-Fix #2 (2026-04-25 human-verify Step 1) — Atlas-extract
 * integration test for runExport.
 *
 * No mocks. Uses fixtures/Jokerman/ — an atlas-packed Spine project where
 * per-region source PNGs do NOT exist on disk; only the atlas page PNGs
 * (JOKERMAN_SPINE.png + _2 + _3) ship with the .atlas. This test verifies
 * the runExport atlas-extract fallback round-trips correctly:
 *   1. Pre-flight access fails on the synthetic per-region path (no
 *      images/ folder under fixtures/Jokerman/).
 *   2. atlasSource fallback fires; sharp.extract({left,top,width,height})
 *      crops the region from the atlas page.
 *   3. sharp.resize produces the requested outW × outH.
 *   4. Output PNG is valid and alpha is preserved (N3.1).
 *
 * Sister files:
 *   - tests/main/image-worker.spec.ts: vi.mock unit cases (a)-(f).
 *   - tests/main/image-worker.integration.spec.ts: per-region path
 *     (CIRCLE.png from fixtures/EXPORT_PROJECT/) — proves the existing
 *     pipeline still works.
 *
 * This file complements the integration spec by exercising the new
 * atlas-extract branch end-to-end with real libvips bytes.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

const JOKERMAN_DIR = path.resolve('fixtures/Jokerman');
const JOKERMAN_PAGE_1 = path.join(JOKERMAN_DIR, 'JOKERMAN_SPINE.png');

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-atlas-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('runExport — Gap-Fix #2 atlas-extract integration (Jokerman fixture)', () => {
  it('AVATAR/L_EYE 171×171 atlas-extract → output PNG with correct dims and alpha preserved', async () => {
    // Skip cleanly if the atlas page is missing in this checkout.
    if (!fs.existsSync(JOKERMAN_PAGE_1)) {
      console.warn(`Skipping: atlas page missing at ${JOKERMAN_PAGE_1}`);
      return;
    }

    // From JOKERMAN_SPINE.atlas: AVATAR/L_EYE bounds:1032,3235,171,171
    // on JOKERMAN_SPINE.png. We synthesize the ExportPlan that the loader
    // + analyzer + buildExportPlan would have produced for this region.
    const syntheticPerRegionPath = path.join(JOKERMAN_DIR, 'images', 'AVATAR', 'L_EYE.png');
    expect(
      fs.existsSync(syntheticPerRegionPath),
      `precondition: per-region PNG must NOT exist (atlas-only fixture): ${syntheticPerRegionPath}`,
    ).toBe(false);

    const plan: ExportPlan = {
      rows: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/AVATAR/L_EYE.png',
        sourceW: 171,
        sourceH: 171,
        outW: 86, // ~ half the source — verifies resize ran
        outH: 86,
        effectiveScale: 0.5,
        attachmentNames: ['AVATAR/L_EYE'],
        atlasSource: {
          pagePath: JOKERMAN_PAGE_1,
          x: 1032,
          y: 3235,
          w: 171,
          h: 171,
          rotated: false,
        },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);

    // Summary contract.
    expect(summary.successes).toBe(1);
    expect(summary.errors).toEqual([]);
    expect(summary.cancelled).toBe(false);

    // Progress event success.
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('success');

    // Output file exists and matches requested dims.
    const outPath = path.join(tmpDir, 'images', 'AVATAR', 'L_EYE.png');
    expect(fs.existsSync(outPath)).toBe(true);
    const meta = await sharp(outPath).metadata();
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(86);
    expect(meta.height).toBe(86);
    // N3.1: alpha preserved through extract → resize → PNG-out.
    expect(meta.hasAlpha).toBe(true);

    // D-121 atomic write: tmp file should NOT remain after rename.
    expect(fs.existsSync(outPath + '.tmp')).toBe(false);
  });

  it('rotated atlas region → emits "rotated-region-unsupported" rather than silent corruption', async () => {
    // Synthesize a rotated atlasSource (no real rotated region exists in
    // the in-repo fixtures; the loader unconditionally sets rotated:false
    // for them — see tests/core/loader.spec.ts no-rotated-regions invariant).
    // We construct the row by hand to exercise the runExport refusal path.
    if (!fs.existsSync(JOKERMAN_PAGE_1)) {
      console.warn(`Skipping: atlas page missing at ${JOKERMAN_PAGE_1}`);
      return;
    }
    const syntheticPerRegionPath = path.join(JOKERMAN_DIR, 'images', 'SYNTHETIC_ROTATED.png');

    const plan: ExportPlan = {
      rows: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/SYNTHETIC_ROTATED.png',
        sourceW: 100,
        sourceH: 100,
        outW: 50,
        outH: 50,
        effectiveScale: 0.5,
        attachmentNames: ['SYNTHETIC_ROTATED'],
        atlasSource: {
          pagePath: JOKERMAN_PAGE_1,
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          rotated: true,
        },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);

    expect(summary.successes).toBe(0);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].kind).toBe('rotated-region-unsupported');
    expect(events.length).toBe(1);
    expect(events[0].status).toBe('error');
    expect(events[0].error?.kind).toBe('rotated-region-unsupported');

    // No partial output file should have been written.
    const outPath = path.join(tmpDir, 'images', 'SYNTHETIC_ROTATED.png');
    expect(fs.existsSync(outPath)).toBe(false);
    expect(fs.existsSync(outPath + '.tmp')).toBe(false);
  });

  it('atlas page missing AND per-region PNG missing → "missing-source" against the page path', async () => {
    // Both the per-region path and the atlas page path point to non-existent
    // files. The pre-flight should surface 'missing-source' against the
    // PAGE path so the user knows which atlas asset is missing — surfacing
    // the synthetic per-region path would mislead users into looking for a
    // file that was never supposed to exist.
    const plan: ExportPlan = {
      rows: [{
        sourcePath: '/nonexistent/per-region.png',
        outPath: 'images/MISSING.png',
        sourceW: 100,
        sourceH: 100,
        outW: 50,
        outH: 50,
        effectiveScale: 0.5,
        attachmentNames: ['MISSING'],
        atlasSource: {
          pagePath: '/nonexistent/atlas-page.png',
          x: 0,
          y: 0,
          w: 100,
          h: 100,
          rotated: false,
        },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    };

    const events: ExportProgressEvent[] = [];
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(summary.successes).toBe(0);
    expect(summary.errors.length).toBe(1);
    expect(summary.errors[0].kind).toBe('missing-source');
    // Error path should point at the ATLAS PAGE, not the synthetic per-region path.
    expect(summary.errors[0].path).toBe('/nonexistent/atlas-page.png');
  });
});
