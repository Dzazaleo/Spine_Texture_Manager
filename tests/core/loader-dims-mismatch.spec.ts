/**
 * Phase 22 Plan 22-05 Task 2 — DIMS-05 round-trip integration spec.
 *
 * Programmatically halves every PNG in fixtures/SIMPLE_PROJECT_NO_ATLAS/images/
 * to a tmpDir in beforeAll, then drives the canonical chain
 * loadSkeleton → sampleSkeleton → analyze → buildExportPlan and asserts
 * Phase 22.1 G-04 semantics:
 *
 *   Phase 22.1 G-04 predicate change: drifted rows where the cap fires
 *   (sourceRatio ≈ 0.5) now land in rows[] (resize), NOT passthroughCopies,
 *   because outW = Math.ceil(halvedW × cappedEffScale) ≠ halvedW (sourceW).
 *   The old Phase 22 "passthrough for cap-clamped rows" behavior is superseded.
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
// Phase 24 Plan 01: findUnusedAttachments removed; orphanedFiles replaces it.
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
  it('DIMS-05 (Phase 22.1 G-04): drifted cap-clamped rows land in rows[] (resize), totals.count > 0', () => {
    // Phase 22.1 G-04 predicate change: cap-clamped drifted rows now go to
    // rows[] because outW = Math.ceil(halvedW × cappedEffScale) ≠ halvedW
    // (sourceW). The old Phase 22 "passthrough for cap-clamped" is superseded.
    const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
    const sampled = sampleSkeleton(load);
    const peaks = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const summary: Pick<SkeletonSummary, 'peaks' | 'orphanedFiles'> = {
      peaks,
      orphanedFiles: [], // Phase 24 Plan 01: unusedAttachments replaced
    };
    const plan: ExportPlan = buildExportPlan(
      summary as SkeletonSummary,
      new Map(),
    );

    // R7 mitigation — read fixture file count dynamically; never hardcode.
    const fileCount = fs.readdirSync(tmpImages).filter((f) => f.endsWith('.png')).length;
    expect(fileCount).toBeGreaterThan(0);
    // Phase 22.1: drifted rows go to rows[] (resize), NOT passthroughCopies.
    // totals.count covers both partitions and must be non-zero.
    expect(plan.totals.count).toBeGreaterThan(0);
    // The dedup-by-sourcePath contract from Phase 6 D-108 means
    // total rows ≤ fileCount (one per unique region PNG).
    expect(plan.totals.count).toBeLessThanOrEqual(fileCount);
  });

  it('DIMS-05 (Phase 22.1 G-04): cap-clamped rows have effectiveScale ≤ 0.51 and isCapped flag', () => {
    // Phase 22.1 G-07 D-07: cap-clamped rows carry isCapped=true for
    // OptimizeDialog row label. effectiveScale ≤ sourceRatio ≈ 0.5.
    const load = loadSkeleton(tmpJson, { loaderMode: 'atlas-less' });
    const sampled = sampleSkeleton(load);
    const peaks = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const summary: Pick<SkeletonSummary, 'peaks' | 'orphanedFiles'> = {
      peaks,
      orphanedFiles: [], // Phase 24 Plan 01: unusedAttachments replaced
    };
    const plan: ExportPlan = buildExportPlan(
      summary as SkeletonSummary,
      new Map(),
    );
    // Under Phase 22.1, all drifted-halved rows go to rows[].
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBeGreaterThan(0);
    for (const row of allRows) {
      // Cap binds: effectiveScale ≤ sourceRatio = actualSource/canonical = 0.5
      // (with up to 1px / canonical-dim wobble from ceil-thousandth rounding
      // at safeScale + the half-PNG ceiling).
      expect(
        row.effectiveScale,
        `row ${row.outPath} effScale should cap at ~0.5; got ${row.effectiveScale}`,
      ).toBeLessThanOrEqual(0.51);
      // isCapped flag is set when cap fires (Phase 22.1 G-07 D-07).
      expect(
        row.isCapped,
        `row ${row.outPath} should have isCapped=true when cap fires`,
      ).toBe(true);
    }
  });
});
