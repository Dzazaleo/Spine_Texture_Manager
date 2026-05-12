/**
 * Regression — debug-fix spine-sequence-undercount (2026-05-08).
 *
 * Spine 4.2 sequence attachments declare `sequence: { count, start, digits }`
 * inside a region/mesh/linkedmesh entry. Before the fix:
 *
 *   1. ATLAS-LESS hard-fail — `synthetic-atlas.walkSyntheticRegionPaths`
 *      registered ONE region path per sequence basePath. spine-ts's
 *      AtlasAttachmentLoader.loadSequence then asked for N composed paths
 *      and threw `Region not found in atlas: PARTICLES_1/00 (sequence: PARTICLES_1/)`.
 *
 *   2. ATLAS-SOURCE silent undercount — sampler keyed PeakRecords by
 *      `${skin}/${slot}/${attachment.name}` where `attachment.name` is the
 *      basePath constant across all 30 frames. All 30 frames collapsed into
 *      ONE PeakRecord; downstream Source Dimensions panel + Optimize dialog
 *      saw only 1 frame per sequence.
 *
 * Option C fix (locked):
 *   - synthetic-atlas now enumerates N composed frame paths.
 *   - sampler measures bone-driven world scale ONCE in the hot loop, then
 *     a post-pass walks `attachment.sequence.regions[]` and fans each base-
 *     path-keyed record into N per-frame records (each carrying its own
 *     regionName + sourceW/H from the per-frame TextureRegion).
 *   - downstream dedup paths (analyzer by attachmentName, export by sourcePath)
 *     naturally yield one row per frame because the fanned PeakRecord's
 *     attachmentName === per-frame regionName === per-frame sourcePath suffix.
 *
 * Fixture: fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json
 *   - 4 sequence-bearing slots in default skin (PARTICLES_1-0..3) declaring
 *     `sequence: { count: 30, start: 0, digits: 2 }` with basePath PARTICLES_1/
 *   - 6 more slots (PARTICLES_2-0..5) with basePath PARTICLES_2/
 *   - 30 PNGs each at images_unpacked/PARTICLES_{1,2}/00.png..29.png
 *   - Note: a fixture-local symlink `images -> images_unpacked` exists so the
 *     atlas-less branch (which hardcodes `images/`) finds the per-frame PNGs.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze, analyzeRegions } from '../../src/core/analyzer.js';
import { buildExportPlan } from '../../src/core/export.js';
import {
  synthesizeAtlasText,
  composeSequenceFramePath,
} from '../../src/core/synthetic-atlas.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

const TEST_03_JSON = path.resolve(
  'fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json',
);
const TEST_03_ATLAS = path.resolve(
  'fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.atlas',
);
const TEST_03_IMAGES_DIR = path.resolve(
  'fixtures/MON_FILES/EXPORT/TEST_03/4.2/images_unpacked',
);

// Skip the entire suite if the fixture isn't present (TEST_03 is
// user-supplied; some clones may not have it).
const FIXTURE_PRESENT =
  fs.existsSync(TEST_03_JSON) &&
  fs.existsSync(TEST_03_ATLAS) &&
  fs.existsSync(TEST_03_IMAGES_DIR);

const describeOrSkip = FIXTURE_PRESENT ? describe : describe.skip;

describe('composeSequenceFramePath (Sequence.getPath verbatim parity)', () => {
  it('matches spine-ts Sequence.js:61-68 — basePath + (start+i).padStart(digits, "0")', () => {
    // PARTICLES_1/ count=30 start=0 digits=2 → PARTICLES_1/00..29
    expect(composeSequenceFramePath('PARTICLES_1/', 0, 0, 2)).toBe('PARTICLES_1/00');
    expect(composeSequenceFramePath('PARTICLES_1/', 9, 0, 2)).toBe('PARTICLES_1/09');
    expect(composeSequenceFramePath('PARTICLES_1/', 29, 0, 2)).toBe('PARTICLES_1/29');
    // start=1 + digits=4 (Spine editor default for digit-padded names)
    expect(composeSequenceFramePath('FX_', 0, 1, 4)).toBe('FX_0001');
    expect(composeSequenceFramePath('FX_', 99, 1, 4)).toBe('FX_0100');
    // digits=0 → no padding
    expect(composeSequenceFramePath('FX_', 5, 1, 0)).toBe('FX_6');
  });
});

describeOrSkip('synthetic-atlas walker — sequence expansion (atlas-less)', () => {
  it('walkSyntheticRegionPaths via synthesizeAtlasText: registers all 30 PARTICLES_1/00..29 + 30 PARTICLES_2/00..29 (60 sequence regions total)', () => {
    const parsedJson = JSON.parse(fs.readFileSync(TEST_03_JSON, 'utf8'));
    const synth = synthesizeAtlasText(parsedJson, TEST_03_IMAGES_DIR, TEST_03_JSON);
    // Per-frame region names should appear in pngPathsByRegionName.
    for (let i = 0; i < 30; i++) {
      const frameSuffix = i.toString().padStart(2, '0');
      const p1 = `PARTICLES_1/${frameSuffix}`;
      const p2 = `PARTICLES_2/${frameSuffix}`;
      expect(synth.pngPathsByRegionName.has(p1), p1).toBe(true);
      expect(synth.pngPathsByRegionName.has(p2), p2).toBe(true);
      // Dim entry present (each PNG IHDR was readable).
      expect(synth.dimsByRegionName.has(p1), `${p1} dims`).toBe(true);
      expect(synth.dimsByRegionName.has(p2), `${p2} dims`).toBe(true);
    }
    // Pre-fix the basePath itself was registered; post-fix it must NOT be —
    // the fan-out replaces it with N composed paths.
    expect(synth.pngPathsByRegionName.has('PARTICLES_1/'), 'no basePath leaks').toBe(false);
    expect(synth.pngPathsByRegionName.has('PARTICLES_2/'), 'no basePath leaks').toBe(false);
  });
});

describeOrSkip('atlas-source mode — sequence fan-out via TEST_03.atlas', () => {
  it('loadSkeleton + sampleSkeleton produces 30 PeakRecord entries per sequence (PARTICLES_1/, PARTICLES_2/)', () => {
    const load = loadSkeleton(TEST_03_JSON, { atlasPath: TEST_03_ATLAS });
    expect(load.atlasPath).toBe(TEST_03_ATLAS);
    // Atlas regions cover all 30 frames per sequence (verified via grep in
    // debug session). sourceDims should mirror — at least 60 sequence entries.
    let p1Count = 0;
    let p2Count = 0;
    for (const name of load.sourceDims.keys()) {
      if (name.startsWith('PARTICLES_1/')) p1Count++;
      if (name.startsWith('PARTICLES_2/')) p2Count++;
    }
    expect(p1Count).toBe(30);
    expect(p2Count).toBe(30);

    const sampled = sampleSkeleton(load);

    // Pre-fix the sampler folded all 30 frames into ONE globalPeaks entry
    // per (skin, slot, sequence-mesh) — basePath-keyed. Post-fix the post-
    // pass deletes the basePath entry and inserts N per-frame entries keyed
    // by `${skin}/${slot}/${perFrameRegionName}`.
    let p1FannedKeys = 0;
    let p2FannedKeys = 0;
    let basePathKeys = 0;
    for (const key of sampled.globalPeaks.keys()) {
      if (/PARTICLES_1\/\d{2}$/.test(key)) p1FannedKeys++;
      if (/PARTICLES_2\/\d{2}$/.test(key)) p2FannedKeys++;
      if (key.endsWith('/PARTICLES_1/') || key.endsWith('/PARTICLES_2/')) {
        basePathKeys++;
      }
    }
    // 4 slots binding PARTICLES_1/ × 30 frames = 120 fanned keys.
    expect(p1FannedKeys).toBeGreaterThanOrEqual(30);
    // 6 slots binding PARTICLES_2/ × 30 frames = 180 fanned keys.
    expect(p2FannedKeys).toBeGreaterThanOrEqual(30);
    // No basePath leaks.
    expect(basePathKeys).toBe(0);

    // Each fanned record should carry per-frame regionName + sourceW/H.
    for (const [, rec] of sampled.globalPeaks) {
      if (/^PARTICLES_[12]\/\d{2}$/.test(rec.attachmentName)) {
        expect(rec.regionName).toBe(rec.attachmentName);
        expect(rec.sourceW).toBeGreaterThan(0);
        expect(rec.sourceH).toBeGreaterThan(0);
      }
    }
  });

  it('analyze() yields one DisplayRow per frame (≥30 PARTICLES_1 frames + ≥30 PARTICLES_2 frames)', () => {
    const load = loadSkeleton(TEST_03_JSON, { atlasPath: TEST_03_ATLAS });
    const sampled = sampleSkeleton(load);
    const rows = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const p1Rows = rows.filter((r) => /^PARTICLES_1\/\d{2}$/.test(r.attachmentName));
    const p2Rows = rows.filter((r) => /^PARTICLES_2\/\d{2}$/.test(r.attachmentName));
    expect(p1Rows.length).toBe(30);
    expect(p2Rows.length).toBe(30);
    // Every per-frame row references the per-frame PNG via sourcePath.
    for (const row of [...p1Rows, ...p2Rows]) {
      expect(row.sourcePath).toMatch(/PARTICLES_[12]\/\d{2}\.png$/);
    }
  });

  it('analyzeRegions() yields one RegionRow per frame (region-keyed view)', () => {
    const load = loadSkeleton(TEST_03_JSON, { atlasPath: TEST_03_ATLAS });
    const sampled = sampleSkeleton(load);
    const regions = analyzeRegions(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const p1Regions = regions.filter((r) => /^PARTICLES_1\/\d{2}$/.test(r.regionName));
    const p2Regions = regions.filter((r) => /^PARTICLES_2\/\d{2}$/.test(r.regionName));
    expect(p1Regions.length).toBe(30);
    expect(p2Regions.length).toBe(30);
  });

  it('buildExportPlan() emits ≥30 ExportRows per sequence (one per frame, distinct sourcePaths)', () => {
    const load = loadSkeleton(TEST_03_JSON, { atlasPath: TEST_03_ATLAS });
    const sampled = sampleSkeleton(load);
    const peaks = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    // Phase 35: buildExportPlan iterates summary.regions (RegionRow[]).
    const regions = analyzeRegions(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const summary: Pick<SkeletonSummary, 'peaks' | 'regions' | 'orphanedFiles'> = {
      peaks,
      regions,
      orphanedFiles: [],
    };
    const plan: ExportPlan = buildExportPlan(summary as SkeletonSummary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    const p1ExportRows = allRows.filter((r) => /PARTICLES_1\/\d{2}\.png$/.test(r.sourcePath));
    const p2ExportRows = allRows.filter((r) => /PARTICLES_2\/\d{2}\.png$/.test(r.sourcePath));
    expect(p1ExportRows.length).toBe(30);
    expect(p2ExportRows.length).toBe(30);
    // sourcePaths are distinct (one per frame).
    const distinctP1 = new Set(p1ExportRows.map((r) => r.sourcePath));
    expect(distinctP1.size).toBe(30);
  });
});

describeOrSkip('atlas-less mode — sequence fan-out via fixture-local images symlink', () => {
  it('loadSkeleton (atlas-less) does NOT throw "Region not found in atlas: PARTICLES_1/00" — the synthesizer registers all 30 sequence regions', () => {
    // The atlas-less hard-fail pre-fix was at AtlasAttachmentLoader.loadSequence
    // (spine-core), thrown verbatim:
    //   `Region not found in atlas: PARTICLES_1/00 (sequence: PARTICLES_1/)`
    // Post-fix synthetic-atlas registers all 30 frame paths so the lookup
    // succeeds for every i ∈ [0, 30).
    let caught: unknown = null;
    try {
      loadSkeleton(TEST_03_JSON, { loaderMode: 'atlas-less' });
    } catch (e) {
      caught = e;
    }
    expect(caught, `unexpected throw: ${(caught as Error)?.message ?? ''}`).toBeNull();
  });

  it('round-trip atlas-less load → sample → analyze → buildExportPlan emits ≥30 ExportRows per sequence', () => {
    const load = loadSkeleton(TEST_03_JSON, { loaderMode: 'atlas-less' });
    expect(load.atlasPath).toBeNull();

    const sampled = sampleSkeleton(load);
    const peaks = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    // Phase 35: buildExportPlan iterates summary.regions (RegionRow[]).
    const regions = analyzeRegions(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,
      load.actualDimsByRegion,
    );
    const summary: Pick<SkeletonSummary, 'peaks' | 'regions' | 'orphanedFiles'> = {
      peaks,
      regions,
      orphanedFiles: [],
    };
    const plan: ExportPlan = buildExportPlan(summary as SkeletonSummary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    const p1Rows = allRows.filter((r) => /PARTICLES_1\/\d{2}\.png$/.test(r.sourcePath));
    const p2Rows = allRows.filter((r) => /PARTICLES_2\/\d{2}\.png$/.test(r.sourcePath));
    expect(p1Rows.length).toBe(30);
    expect(p2Rows.length).toBe(30);
  });
});
