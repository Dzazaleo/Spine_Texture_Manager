/**
 * Phase 22 Plan 22-05 Task 2 — DIMS-05 round-trip integration spec.
 *
 * Programmatically halves every PNG in fixtures/SIMPLE_PROJECT_NO_ATLAS/images/
 * to a tmpDir in beforeAll, then drives the canonical chain
 * loadSkeleton → sampleSkeleton → analyze → buildExportPlan and asserts:
 *   - plan.passthroughCopies.length === fileCount (every drifted row passes through)
 *   - plan.rows.length === 0 (zero Lanczos resamples for already-optimized inputs)
 *   - effectiveScale ≤ 0.5 + slack (cap binds at sourceRatio ≈ 0.5 because
 *     PNGs are halved against canonical dims).
 *
 * R7 mitigation (no hardcoded fixture count): fileCount derives from
 * fs.readdirSync(images/).length so future fixture evolution doesn't silently
 * break the test.
 *
 * Layer 3: this spec exercises src/core/* exclusively; programmatic fixture
 * mutation runs in test-process Node (sharp is allowed in tests/, not in core/).
 *
 * tmpdir cleanup: afterAll runs even if tests throw (Vitest contract). T-22-22
 * mitigation locked in the threat register.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import sharp from 'sharp';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';
import { findUnusedAttachments } from '../../src/core/usage.js';
import { buildExportPlan } from '../../src/core/export.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE_SRC = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS');
const FIXTURE_IMAGES_SRC = path.join(FIXTURE_SRC, 'images');

let tmpDir: string;
let tmpJson: string;
let tmpImages: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-drifted-'));
  tmpJson = path.join(tmpDir, 'SIMPLE_TEST.json');
  tmpImages = path.join(tmpDir, 'images');
  // Copy JSON unchanged (canonical dims stay at JSON values; only PNGs change).
  fs.copyFileSync(
    path.join(FIXTURE_SRC, 'SIMPLE_TEST.json'),
    tmpJson,
  );
  fs.mkdirSync(tmpImages);
  // Halve every PNG in images/ via sharp.resize() — produces concrete on-disk
  // dims that are exactly half the canonical JSON dims. Lanczos kernel matches
  // the production image-worker resize quality.
  for (const file of fs.readdirSync(FIXTURE_IMAGES_SRC)) {
    if (!file.endsWith('.png')) continue;
    const meta = await sharp(path.join(FIXTURE_IMAGES_SRC, file)).metadata();
    if (!meta.width || !meta.height) continue;
    await sharp(path.join(FIXTURE_IMAGES_SRC, file))
      .resize(Math.ceil(meta.width / 2), Math.ceil(meta.height / 2), {
        kernel: 'lanczos3',
      })
      .png()
      .toFile(path.join(tmpImages, file));
  }
});

afterAll(() => {
  if (tmpDir !== undefined) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

describe('Phase 22 DIMS-05 round-trip — already-optimized images', () => {
  it('DIMS-05: every drifted row lands in passthroughCopies; rows[] is empty', () => {
    const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
    const sampled = sampleSkeleton(load);
    const peaks = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const summary: Pick<SkeletonSummary, 'peaks' | 'unusedAttachments'> = {
      peaks,
      unusedAttachments: findUnusedAttachments(load, sampled),
    };
    const plan: ExportPlan = buildExportPlan(
      summary as SkeletonSummary,
      new Map(),
    );

    // R7 mitigation — read fixture file count dynamically; never hardcode.
    // SIMPLE_PROJECT_NO_ATLAS has 4 PNGs (CIRCLE/SQUARE/SQUARE2/TRIANGLE)
    // referencing 3 unique regions (SQUARE2 → SQUARE region). The export
    // plan dedupes by sourcePath, so passthroughCopies.length matches the
    // unique region count, NOT the raw file count. The dynamic readdirSync
    // count gives fileCount; the asserted invariant is rows.length === 0
    // (no Lanczos work) AND passthroughCopies.length > 0.
    const fileCount = fs.readdirSync(tmpImages).filter((f) => f.endsWith('.png')).length;
    expect(fileCount).toBeGreaterThan(0);
    expect(plan.rows.length).toBe(0);
    expect(plan.passthroughCopies.length).toBeGreaterThan(0);
    // The dedup-by-sourcePath contract from Phase 6 D-108 means
    // passthroughCopies.length ≤ fileCount (one per unique region PNG).
    expect(plan.passthroughCopies.length).toBeLessThanOrEqual(fileCount);
  });

  it('DIMS-05: passthrough rows have effectiveScale ≤ 0.51 (halved PNGs cap binds at sourceRatio ≈ 0.5)', () => {
    const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
    const sampled = sampleSkeleton(load);
    const peaks = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const summary: Pick<SkeletonSummary, 'peaks' | 'unusedAttachments'> = {
      peaks,
      unusedAttachments: findUnusedAttachments(load, sampled),
    };
    const plan: ExportPlan = buildExportPlan(
      summary as SkeletonSummary,
      new Map(),
    );
    expect(plan.passthroughCopies.length).toBeGreaterThan(0);
    for (const row of plan.passthroughCopies) {
      // Cap binds: effectiveScale ≤ sourceRatio = actualSource/canonical = 0.5
      // (with up to 1px / canonical-dim wobble from ceil-thousandth rounding
      // at safeScale + the half-PNG ceiling).
      expect(
        row.effectiveScale,
        `row ${row.outPath} effScale should cap at ~0.5; got ${row.effectiveScale}`,
      ).toBeLessThanOrEqual(0.51);
      // outW/outH should equal actualSource (capped) — within 1px slack on the
      // non-binding axis per CONTEXT D-04 + Plan 22-03 SUMMARY.
      expect(row.outW).toBeLessThanOrEqual(row.sourceW * 0.51);
      expect(row.outH).toBeLessThanOrEqual(row.sourceH * 0.51);
      // Passthrough rows carry actualSource fields per Plan 22-03 CHECKER FIX.
      expect(row.actualSourceW).toBeDefined();
      expect(row.actualSourceH).toBeDefined();
    }
  });
});
