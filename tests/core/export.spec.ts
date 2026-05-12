/**
 * Phase 6 Plan 03 — specs for the pure-TS export-plan builder.
 *
 * Cases per .planning/phases/06-optimize-assets-image-export/06-CONTEXT.md
 * <decisions> "Tests" lines 33-37 (updated by Round 5 ceil/ceil-thousandth):
 *   (a) SIMPLE_TEST → 3 ExportRows (post-Plan-02-03 dedup-by-attachmentName:
 *       CIRCLE / SQUARE / TRIANGLE) with effective scale = peakScale, dims =
 *       Math.ceil(sourceW × effectiveScale). [D-108, D-110 Round 5, D-111]
 *   (b) Override 50% on TRIANGLE → out dims = Math.ceil(sourceW × 0.5).
 *       [D-111, D-110 Round 5]
 *   (c) Override 200% on SQUARE → applyOverride clamps to 100% → out dims =
 *       sourceW × 1.0 = source. [D-111, Phase 4 D-91]
 *   (d) Two attachments share the same atlas region with different peaks →
 *       ExportRow.outW = Math.ceil(sourceW × max(peaks)). [D-108, D-110 Round 5]
 *   (e) Ghost fixture → ExportPlan.rows excludes GHOST; ExportPlan.excludedUnused
 *       includes 'GHOST'. [D-109]
 *   (f) Math.ceil sizing semantics fixture cases. [D-110 Round 5]
 *   (g) Hygiene grep — no fs/sharp/spine-core runtime imports in
 *       src/core/export.ts. [CLAUDE.md #5, Layer 3]
 *
 * Round 5 (2026-04-25) added a "Round 5 ceil + ceil-thousandth" describe
 * block locking the JOKER/FACE 0.36071 / 0.36128 boundary cases + the
 * ceil-thousandth lower-bound property (see in-file describe block).
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze, analyzeRegions } from '../../src/core/analyzer.js';
// Phase 24 Plan 01: findUnusedAttachments removed; orphanedFiles replaces it.
// RED import — Plan 06-03 introduces buildExportPlan in src/core/export.ts.
import { buildExportPlan } from '../../src/core/export.js';
// Plan 06-02 introduces these types in src/shared/types.ts.
import type { ExportPlan, RegionRow, SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const FIXTURE_EXPORT = path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json');
const EXPORT_SRC = path.resolve('src/core/export.ts');

/**
 * Phase 35 BLOCKER 1 backfill — synthesize a `regions: RegionRow[]` array from
 * the same `peaks: [...]` literals the test cases construct. Groups peaks by
 * `regionName ?? attachmentName` (matches the loader's lookup-key idiom);
 * picks the winning contributor by max-peakScale with source-order tiebreak;
 * carries every group member into `contributingAttachments[]`.
 *
 * This keeps the test-side backfill mechanical: each Category B literal in
 * this file gains `regions: synthRegionsFromPeaks(peaks)` alongside its
 * existing `peaks: [...]` field. For Category A (real-fixture) sites, prefer
 * the canonical `analyzeRegions(sampled.globalPeaks, sourcePaths)` helper
 * (mirrors atlas-preview.spec.ts:56-77).
 *
 * Phase 35 source-migration (Task 1) makes buildExportPlan iterate
 * summary.regions; the pre-migration test suite still passes because the
 * synthesized regions[] mirrors the peaks[] shape — single-skin synthetic
 * fixtures have one RegionRow per unique regionName, and SIMPLE_PROJECT
 * fixtures have regionName === attachmentName so cardinality is preserved.
 *
 * The helper is intentionally local to this file (not exported into core/) —
 * tests-only synthesis idiom; the real producer is analyzer.ts:analyzeRegions.
 *
 * WR-03 (2026-05-12) — DOCUMENTED DIVERGENCES from production semantics.
 * This helper is APPROXIMATE, not faithful, to `pickRegionWinner` +
 * `toRegionRow` in src/core/analyzer.ts. The divergences below have not
 * bitten any existing test (≈30 call sites), and replacing this helper with
 * a thin wrapper around `analyzeRegions` would cascade input-shape changes
 * across every call site — too invasive for a review-fix pass. If a future
 * test needs faithful semantics, prefer Category A (`analyzeRegions`) over
 * extending this helper. The three documented divergences:
 *
 *   1. WINNER TIEBREAK on equal peakScale (line 78-80). This helper uses
 *      strict `>` so the FIRST source-order contributor wins on a tie.
 *      Production `pickRegionWinner` (analyzer.ts:268-273) breaks ties by
 *      LEX-ASC `attachmentName`. The two coincide in every current test
 *      because each test's peak literal order also happens to be lex-ASC,
 *      but a future test that reorders peaks could pass against this
 *      helper while failing in production.
 *
 *   2. CONTRIBUTOR DEDUP (line 121-130 below). This helper does NOT dedupe
 *      bucket entries by `attachmentName` — every peak emits its own
 *      `contributingAttachments[]` row. Production `toRegionRow`
 *      (analyzer.ts:295-302) dedupes via `seen.has(r.attachmentName)` to
 *      handle one attachmentName bound to multiple slots. A synthetic peak
 *      list with that shape would emit duplicates here but unique rows
 *      from production.
 *
 *   3. FIELD-DEFAULT MASKING (line 87-89 below). `slotName ?? 'TEST_SLOT'`
 *      and `animationName ?? 'PATH'` paper over missing fields with
 *      literals that bear no relationship to production output. Downstream
 *      consumers that depend on real slot/animation names will silently
 *      pass against this helper.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function synthRegionsFromPeaks(peaks: ReadonlyArray<any>): RegionRow[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = new Map<string, any[]>();
  for (const p of peaks) {
    const key = (p.regionName ?? p.attachmentName) as string;
    const bucket = groups.get(key);
    if (bucket) bucket.push(p);
    else groups.set(key, [p]);
  }
  const out: RegionRow[] = [];
  for (const [regionName, bucket] of groups) {
    // Pick winner: max peakScale, source-order tiebreak.
    let winner = bucket[0];
    for (let i = 1; i < bucket.length; i++) {
      if (bucket[i].peakScale > winner.peakScale) winner = bucket[i];
    }
    const canonicalW = winner.canonicalW ?? winner.sourceW;
    const canonicalH = winner.canonicalH ?? winner.sourceH;
    const region: RegionRow = {
      regionName,
      attachmentName: winner.attachmentName,
      skinName: winner.skinName ?? 'default',
      slotName: winner.slotName ?? 'TEST_SLOT',
      animationName: winner.animationName ?? 'PATH',
      time: winner.time ?? 0,
      frame: winner.frame ?? 0,
      peakScale: winner.peakScale,
      peakScaleX: winner.peakScaleX ?? winner.peakScale,
      peakScaleY: winner.peakScaleY ?? winner.peakScale,
      worldW: winner.worldW ?? canonicalW * winner.peakScale,
      worldH: winner.worldH ?? canonicalH * winner.peakScale,
      sourceW: winner.sourceW,
      sourceH: winner.sourceH,
      isSetupPosePeak: winner.isSetupPosePeak ?? false,
      sourcePath: winner.sourcePath,
      canonicalW,
      canonicalH,
      actualSourceW: winner.actualSourceW,
      actualSourceH: winner.actualSourceH,
      dimsMismatch: winner.dimsMismatch ?? false,
      ...(winner.atlasSource ? { atlasSource: winner.atlasSource } : {}),
      originalSizeLabel: '',
      peakSizeLabel: '',
      scaleLabel: '',
      sourceLabel: '',
      frameLabel: '',
      contributingAttachments: bucket.map((p) => ({
        attachmentName: p.attachmentName,
        skinName: p.skinName ?? 'default',
        slotName: p.slotName ?? 'TEST_SLOT',
        peakScale: p.peakScale,
        animationName: p.animationName ?? 'PATH',
        time: p.time ?? 0,
        frame: p.frame ?? 0,
        isSetupPosePeak: p.isSetupPosePeak ?? false,
      })),
    };
    out.push(region);
  }
  return out;
}

/**
 * Phase 35 BLOCKER 1 backfill — canonical analyzer-driven regions for Category A
 * (real-fixture-driven) summaries. Mirrors atlas-preview.spec.ts:56-77 exactly.
 * Sites that call `loadSkeleton(...) → sampleSkeleton(...) → analyze(...)` use
 * this helper to populate summary.regions identically to how the renderer
 * receives it on a real drop.
 */
function regionsFromSampled(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sampled: { globalPeaks: Map<string, any> },
): RegionRow[] {
  const sourcePaths = new Map<string, string>();
  for (const p of sampled.globalPeaks.values()) {
    const regionName = p.regionName ?? p.attachmentName;
    sourcePaths.set(regionName, '/fake/' + regionName + '.png');
  }
  return analyzeRegions(sampled.globalPeaks, sourcePaths);
}


describe('buildExportPlan — case (a) baseline (D-108, D-110, D-111)', () => {
  it('SIMPLE_TEST → 3 ExportRows (rows + passthroughCopies combined) with dims = Math.ceil(sourceW × effScale) (Round 5 ceil)', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    // Plan 06-02 will add `sourcePath: string` to DisplayRow; until then we
    // synthesize a stub path so the export builder has a dedup key.
    // Phase 35: also populate regions[] via analyzeRegions (mirrors
    // atlas-preview.spec.ts:56-77) so buildExportPlan can iterate
    // summary.regions post-migration without TypeError.
    const summary: Pick<SkeletonSummary, 'peaks' | 'regions' | 'orphanedFiles'> = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
      })),
      regions: regionsFromSampled(sampled),
      orphanedFiles: [], // Phase 24 Plan 01: unused field replaced
    };
    const plan: ExportPlan = buildExportPlan(summary as SkeletonSummary, new Map());
    // Phase 22.1 D-06: rows with outW===sourceW (e.g. TRIANGLE with peakScale≥1.0)
    // go to passthroughCopies[]; others stay in rows[]. Total must be 3.
    // Post-Plan 02-03 dedup-by-attachmentName: 3 unique names
    // (CIRCLE, SQUARE, TRIANGLE — the two SQUARE-named attachments fold into one).
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBe(3);
    for (const row of allRows) {
      // Round 5: outW = Math.ceil(sourceW × effScale) so output dim is never
      // below the per-axis peak demand. effectiveScale is also ceil-thousandth
      // (display lower-bound) but that is internal to the builder.
      const expectedW = Math.ceil(row.sourceW * row.effectiveScale);
      const expectedH = Math.ceil(row.sourceH * row.effectiveScale);
      expect(row.outW).toBe(expectedW);
      expect(row.outH).toBe(expectedH);
    }
  });
});

describe('buildExportPlan — case (b) peak-anchored override on TRIANGLE (D-111)', () => {
  it('25% override on TRIANGLE (peakScale ≈ 2.0): effScale = 0.25 × peakScale clamped ≤ 1 → out dims < source', () => {
    // Peak-anchored semantics (2026-05-05): override % means "% of peak demand".
    // TRIANGLE has peakScale ≈ 2.0 in the SIMPLE_TEST fixture (zoomed-in animation),
    // so any override ≥ 50% yields effScale ≥ 1.0 and clamps to the canonical
    // ceiling (passthrough). 25% override → effScale = 0.25 × 2.0 = 0.5 →
    // outW = ceil(sourceW × 0.5), which escapes the clamp and routes to rows[].
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    // Phase 35: populate regions[] via analyzeRegions for the post-migration
    // iteration source.
    const summary: Pick<SkeletonSummary, 'peaks' | 'regions' | 'orphanedFiles'> = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
      })),
      regions: regionsFromSampled(sampled),
      orphanedFiles: [], // Phase 24 Plan 01: unused field replaced
    };
    const overrides = new Map<string, number>([['TRIANGLE', 25]]);
    const plan: ExportPlan = buildExportPlan(summary as SkeletonSummary, overrides);
    const triRow = plan.rows.find((r) => r.attachmentNames.includes('TRIANGLE'));
    expect(triRow).toBeDefined();
    if (triRow) {
      // peakScale ≈ 2.0 × 25% = ≈ 0.5 (within safeScale ceil-thousandth tolerance).
      // effScale lands on the safeScale-rounded value of 0.25 × peakScale.
      const triPeak = peaks.find((p) => p.attachmentName === 'TRIANGLE')!.peakScale;
      const expectedEff = Math.min(Math.ceil(0.25 * triPeak * 1000) / 1000, 1);
      expect(triRow.effectiveScale).toBeCloseTo(expectedEff, 6);
      expect(triRow.outW).toBe(Math.ceil(triRow.sourceW * expectedEff));
      expect(triRow.outH).toBe(Math.ceil(triRow.sourceH * expectedEff));
    }
  });
});

describe('buildExportPlan — case (c) override 200% on SQUARE (peak-anchored, 2026-05-05)', () => {
  it('override 200% → effScale = 200% × peakScale (raw, no clip at 100); downstream ≤ 1.0 clamp guards canonical', () => {
    // 2026-05-05 redesign: clampOverride no longer clips at 100; values
    // above target dims between peak demand and the source ceiling. For
    // synthetic SQUARE with peakScale=0.4, 200% override yields effScale =
    // 2.0 × 0.4 = 0.8 (still ≤ 1, no canonical clamp). outW = 800 ≠ sourceW
    // → resize routes to plan.rows[].
    const peaks = [
      {
        attachmentKey: 'default/SQUARE/SQUARE',
        attachmentName: 'SQUARE',
        skinName: 'default',
        slotName: 'SQUARE',
        animationName: 'PATH',
        time: 0.5,
        frame: 30,
        peakScale: 0.4,
        peakScaleX: 0.4,
        peakScaleY: 0.4,
        worldW: 400,
        worldH: 400,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/SQUARE.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const overrides = new Map<string, number>([['SQUARE', 200]]);
    const plan: ExportPlan = buildExportPlan(summary, overrides);
    expect(plan.rows.length).toBe(1);
    expect(plan.passthroughCopies.length).toBe(0);
    const row = plan.rows[0];
    expect(row.effectiveScale).toBeCloseTo(0.8, 6);
    expect(row.outW).toBe(800);
    expect(row.outH).toBe(800);
  });

  it('override 300% on the same SQUARE (peakScale 0.4) → effScale = 1.0 (canonical clamp fires); outW = sourceW → passthrough', () => {
    // 300% × 0.4 = 1.2 → safeScale = 1.2 → ≤ 1 clamp fires → effScale = 1.0
    //   → outW = ceil(1000 × 1.0) = 1000 = sourceW → passthrough (byte-copy).
    const peaks = [
      {
        attachmentKey: 'default/SQUARE/SQUARE',
        attachmentName: 'SQUARE',
        skinName: 'default',
        slotName: 'SQUARE',
        animationName: 'PATH',
        time: 0.5,
        frame: 30,
        peakScale: 0.4,
        peakScaleX: 0.4,
        peakScaleY: 0.4,
        worldW: 400,
        worldH: 400,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/SQUARE.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map([['SQUARE', 300]]));
    expect(plan.passthroughCopies.length).toBe(1);
    expect(plan.rows.length).toBe(0);
    expect(plan.passthroughCopies[0].effectiveScale).toBeCloseTo(1.0, 6);
    expect(plan.passthroughCopies[0].outW).toBe(1000);
  });
});

describe('buildExportPlan — Gap-Fix #1 (2026-04-25) DOWNSCALE-ONLY invariant — effectiveScale clamped to ≤ 1.0', () => {
  it('peakScale 1.5 with no override → effectiveScale = 1.0; outW = sourceW (NOT 1.5×)', () => {
    // Locks the user-locked Phase 6 export sizing memory: source dims are the
    // ceiling, never extrapolate. Even when the sampler reports a peakScale > 1
    // (an attachment dramatically zoomed in animation), the exported output
    // is never larger than the source PNG.
    //
    // Phase 22.1 D-06: peakScale 1.5 clamps to 1.0 → outW = sourceW → passthroughCopies.
    const peaks = [
      {
        attachmentKey: 'default/SLOT/ZOOMED',
        attachmentName: 'ZOOMED',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'zoom_in',
        time: 0.5,
        frame: 30,
        peakScale: 1.5,
        peakScaleX: 1.5,
        peakScaleY: 1.5,
        worldW: 150,
        worldH: 150,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/ZOOMED.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    // Phase 22.1 D-06: outW=100=sourceW → passthroughCopies (NOT rows).
    expect(plan.passthroughCopies.length).toBe(1);
    expect(plan.rows.length).toBe(0);
    const row = plan.passthroughCopies[0];
    // Clamped to 1.0 — even though the sampler reported 1.5×.
    expect(row.effectiveScale).toBeCloseTo(1.0, 6);
    // outW must be sourceW (100), NOT Math.round(100 * 1.5) = 150.
    expect(row.outW).toBe(100);
    expect(row.outH).toBe(100);
  });

  it('peakScale 5.0 (extreme zoom) still clamps to 1.0 — never extrapolates', () => {
    const peaks = [
      {
        attachmentKey: 'default/SLOT/MEGAZOOM',
        attachmentName: 'MEGAZOOM',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'closeup',
        time: 1.0,
        frame: 60,
        peakScale: 5.0,
        peakScaleX: 5.0,
        peakScaleY: 5.0,
        worldW: 1000,
        worldH: 1000,
        sourceW: 200,
        sourceH: 200,
        sourcePath: '/fake/MEGAZOOM.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    // Phase 22.1 D-06: outW=200=sourceW → passthroughCopies.
    expect(plan.passthroughCopies.length).toBe(1);
    expect(plan.rows.length).toBe(0);
    expect(plan.passthroughCopies[0].effectiveScale).toBeCloseTo(1.0, 6);
    expect(plan.passthroughCopies[0].outW).toBe(200);
    expect(plan.passthroughCopies[0].outH).toBe(200);
  });

  it('Gap-Fix #1 dedup interaction: two attachments share source PNG with peaks 0.8 and 5.0 → both clamp to 1.0; kept dims = sourceW (NOT 5×)', () => {
    // The clamp must run BEFORE the dedup keep-max comparison. Otherwise
    // the dedup would promote the 5.0-row to "winner" and emit an upscaled
    // ExportRow. With the clamp running first, max(0.8, 1.0) = 1.0 → outW
    // = sourceW.
    //
    // Phase 22.1 D-06: outW=100=sourceW → passthroughCopies.
    const peaks = [
      {
        attachmentKey: 'default/SLOT/SMALL',
        attachmentName: 'SMALL',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.8,
        peakScaleX: 0.8,
        peakScaleY: 0.8,
        worldW: 80,
        worldH: 80,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/SHARED.png',
      },
      {
        attachmentKey: 'default/SLOT/BIG',
        attachmentName: 'BIG',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'zoom',
        time: 1,
        frame: 60,
        peakScale: 5.0,
        peakScaleX: 5.0,
        peakScaleY: 5.0,
        worldW: 500,
        worldH: 500,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/SHARED.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    // Phase 22.1 D-06: outW=100=sourceW → passthroughCopies (NOT rows).
    expect(plan.passthroughCopies.length).toBe(1);
    expect(plan.rows.length).toBe(0);
    expect(plan.passthroughCopies[0].effectiveScale).toBeCloseTo(1.0, 6);
    expect(plan.passthroughCopies[0].outW).toBe(100);
    expect(plan.passthroughCopies[0].outH).toBe(100);
  });
});

describe('buildExportPlan — case (d) two attachments share atlas region with different peaks (D-108)', () => {
  it('dedup by sourcePath uses max(peakScale) so the most-zoomed user wins', () => {
    // Two attachments — different names, same sourcePath. Different peaks.
    const peaks = [
      {
        attachmentKey: 'default/HEAD/FACE_A',
        attachmentName: 'FACE_A',
        skinName: 'default',
        slotName: 'HEAD',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 64,
        worldH: 64,
        sourceW: 128,
        sourceH: 128,
        sourcePath: '/fake/FACE.png',
      },
      {
        attachmentKey: 'default/HEAD/FACE_B',
        attachmentName: 'FACE_B',
        skinName: 'default',
        slotName: 'HEAD',
        animationName: 'zoom',
        time: 1,
        frame: 60,
        peakScale: 0.9,
        peakScaleX: 0.9,
        peakScaleY: 0.9,
        worldW: 115.2,
        worldH: 115.2,
        sourceW: 128,
        sourceH: 128,
        sourcePath: '/fake/FACE.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    // D-108: one ExportRow per unique sourcePath
    expect(plan.rows.length).toBe(1);
    const row = plan.rows[0];
    // Max of (0.5, 0.9) = 0.9 (ceil-thousandth of 0.9 is 0.9 exact).
    expect(row.effectiveScale).toBeCloseTo(0.9, 6);
    // Round 5: outW = Math.ceil(128 × 0.9) = ceil(115.2) = 116 (was 115 with round).
    expect(row.outW).toBe(Math.ceil(128 * 0.9));
    expect(row.outH).toBe(Math.ceil(128 * 0.9));
    // Both attachment names preserved for traceability
    expect(row.attachmentNames).toContain('FACE_A');
    expect(row.attachmentNames).toContain('FACE_B');
  });
});

describe('buildExportPlan — Gap-Fix #2 (2026-04-25) atlasSource pass-through', () => {
  it('ExportRow.atlasSource is populated when DisplayRow has atlasSource set', () => {
    const peaks = [
      {
        attachmentKey: 'default/SLOT/AVATAR_FACE',
        attachmentName: 'AVATAR/FACE',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 873,
        worldH: 959,
        sourceW: 1746,
        sourceH: 1918,
        sourcePath: '/fake/AVATAR/FACE.png',
        atlasSource: {
          pagePath: '/fake/JOKERMAN_SPINE.png',
          x: 778,
          y: 2,
          packW: 1746,
          packH: 1918,
          offsetX: 0,
          offsetY: 0,
          w: 1746,
          h: 1918,
          rotated: false,
        },
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows.length).toBe(1);
    expect(plan.rows[0].atlasSource).toEqual({
      pagePath: '/fake/JOKERMAN_SPINE.png',
      x: 778,
      y: 2,
      packW: 1746,
      packH: 1918,
      offsetX: 0,
      offsetY: 0,
      w: 1746,
      h: 1918,
      rotated: false,
    });
  });

  it('ExportRow.atlasSource is undefined when DisplayRow has no atlasSource', () => {
    const peaks = [
      {
        attachmentKey: 'default/SLOT/PER_REGION_PNG',
        attachmentName: 'PER_REGION_PNG',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 50,
        worldH: 50,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/PER_REGION_PNG.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows[0].atlasSource).toBeUndefined();
  });
});

describe('buildExportPlan — case (e) ghost fixture (Phase 24 Plan 01 update)', () => {
  it('GHOST absent from peaks (never sampled) → not in ExportPlan.rows; excludedUnused is empty (D-109 exclusion removed)', () => {
    // Phase 24 Plan 01: D-109 exclusion (unusedAttachments → excluded set) removed.
    // GHOST is absent from the export plan because it never appears in globalPeaks
    // (the sampler never rendered it with alpha > 0). The old mechanism excluded it
    // via unusedAttachments; the new behavior is that only sampled peaks appear.
    // excludedUnused is now always [] — Plan 02 will wire a new exclusion surface.
    const load = loadSkeleton(FIXTURE_GHOST);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    // Phase 35: populate regions[] alongside peaks for post-migration iteration.
    const summary = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
      })),
      regions: regionsFromSampled(sampled),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    // GHOST is not in peaks → not in rows (sampler filter is the gate now).
    expect(plan.rows.find((r) => r.attachmentNames.includes('GHOST'))).toBeUndefined();
    // excludedUnused is now always empty (D-109 via unusedAttachments removed).
    expect(plan.excludedUnused).toEqual([]);
  });
});

describe('buildExportPlan — case (f) Math.ceil sizing semantics (D-110, Round 5)', () => {
  it('Math.ceil(127.5) === 128, Math.ceil(127.001) === 128, Math.ceil(127) === 127 (JS spec)', () => {
    // Lock the JS Math.ceil contract Round 5 depends on. The export math
    // uses Math.ceil so any positive fractional product rounds UP — output
    // dim is never below the per-axis peak demand.
    expect(Math.ceil(127.5)).toBe(128);
    expect(Math.ceil(127.001)).toBe(128);
    expect(Math.ceil(127)).toBe(127);
    expect(Math.ceil(0.5)).toBe(1);
    expect(Math.ceil(0.001)).toBe(1);
  });

  it('synthetic peakScale yielding an exact .5 boundary ceils to 128 (255 × 0.5 = 127.5 → 128)', () => {
    const peaks = [
      {
        attachmentKey: 'default/SLOT/EVEN',
        attachmentName: 'EVEN',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 127.5,
        worldH: 127.5,
        sourceW: 255,
        sourceH: 255,
        sourcePath: '/fake/EVEN.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows[0].outW).toBe(128);
    expect(plan.rows[0].outH).toBe(128);
  });
});

describe('buildExportPlan — Round 5 ceil + ceil-thousandth (D-110 amendment)', () => {
  it('JOKER/FACE-style: source 811×962, peakScale 0.36071 → outW ≥ 293 AND outH ≥ 348 (ceil prevents per-axis under-allocation)', () => {
    // Reproduces the user-discovered 1-pixel under-allocation: under the
    // old Math.round contract, 962 × 0.36071 = 346.99 rounded to 347 — but
    // the per-axis peak demand was ≥ 347.99 px. Round 5 ceil-thousandth on
    // effScale (0.36071 → 0.361) plus Math.ceil per-axis guarantees:
    //   effScale = ceil(0.36071 × 1000) / 1000 = 361 / 1000 = 0.361
    //   outW = ceil(811 × 0.361) = ceil(292.771) = 293
    //   outH = ceil(962 × 0.361) = ceil(347.282) = 348
    const peaks = [
      {
        attachmentKey: 'default/HEAD/FACE',
        attachmentName: 'FACE',
        skinName: 'default',
        slotName: 'HEAD',
        animationName: 'JOKER',
        time: 1.0,
        frame: 60,
        peakScale: 0.36071,
        peakScaleX: 0.36071,
        peakScaleY: 0.36071,
        worldW: 292.5,
        worldH: 347.0,
        sourceW: 811,
        sourceH: 962,
        sourcePath: '/fake/FACE.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows.length).toBe(1);
    const row = plan.rows[0];
    // effScale rounded UP to nearest thousandth — display value matches.
    expect(row.effectiveScale).toBeCloseTo(0.361, 6);
    // Per-axis peak guaranteed: never below the demand even on under-.5
    // fractional products.
    expect(row.outW).toBe(293);
    expect(row.outH).toBe(348);
    expect(row.outW).toBeGreaterThanOrEqual(293);
    expect(row.outH).toBeGreaterThanOrEqual(348);
  });

  it('JOKER/FACE follow-up: source 811×962, peakScale 0.36128 → effScale 0.362, outW = ceil(811 × 0.362) = 294, outH = ceil(962 × 0.362) = 349', () => {
    // Verifies the 0.36128 boundary case — ceil-thousandth promotes 0.36128
    // to 0.362 (since 361.28 ceils to 362), driving outW one pixel up.
    // Aspect ratio preserved within sub-pixel tolerance.
    const peaks = [
      {
        attachmentKey: 'default/HEAD/FACE',
        attachmentName: 'FACE',
        skinName: 'default',
        slotName: 'HEAD',
        animationName: 'JOKER',
        time: 1.0,
        frame: 60,
        peakScale: 0.36128,
        peakScaleX: 0.36128,
        peakScaleY: 0.36128,
        worldW: 293.0,
        worldH: 347.5,
        sourceW: 811,
        sourceH: 962,
        sourcePath: '/fake/FACE.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    const row = plan.rows[0];
    expect(row.effectiveScale).toBeCloseTo(0.362, 6);
    expect(row.outW).toBe(294); // ceil(811 × 0.362) = ceil(293.582) = 294
    expect(row.outH).toBe(349); // ceil(962 × 0.362) = ceil(348.244) = 349
  });

  it('ceil-thousandth lower-bound: displayed scale always ≥ raw peakScale', () => {
    // Property test: for any peakScale in (0, 1], the ceil-thousandth value
    // must satisfy ceiled ≥ raw (with sub-thousandth tolerance for rounding).
    const samples = [0.001, 0.123, 0.36071, 0.36128, 0.5, 0.7777, 0.9999];
    for (const raw of samples) {
      const ceiled = Math.ceil(raw * 1000) / 1000;
      expect(ceiled).toBeGreaterThanOrEqual(raw);
      // Within one thousandth of the raw value (ceil tolerance).
      expect(ceiled - raw).toBeLessThan(0.001);
    }
  });
});

describe('buildExportPlan — EXPORT_PROJECT fixture sanity (Phase 6 fixture-build)', () => {
  it('loadSkeleton(EXPORT.json) → 4 atlas regions reachable through the export plan', () => {
    // This test verifies the Wave 0 fixture is wired correctly. Once
    // buildExportPlan exists, it should produce ExportRows from the 4
    // EXPORT_PROJECT regions (CIRCLE/SQUARE/SQUARE2/TRIANGLE).
    const load = loadSkeleton(FIXTURE_EXPORT);
    expect([...load.sourceDims.keys()].sort()).toEqual([
      'CIRCLE',
      'SQUARE',
      'SQUARE2',
      'TRIANGLE',
    ]);
    // Ensure the loader's reported dims match the on-disk PNG dims
    // (locks the fixture-build contract for downstream Plan 06-04 sharp tests).
    expect(load.sourceDims.get('CIRCLE')).toMatchObject({ w: 699, h: 699 });
    expect(load.sourceDims.get('SQUARE')).toMatchObject({ w: 1000, h: 1000 });
    expect(load.sourceDims.get('SQUARE2')).toMatchObject({ w: 250, h: 250 });
    expect(load.sourceDims.get('TRIANGLE')).toMatchObject({ w: 833, h: 759 });
  });
});

describe('export — module hygiene (N2.3, Phase 6 Layer 3 lock)', () => {
  it('N2.3: no node:fs / node:path / node:child_process / node:net / node:http imports', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  });
  it('Phase 6: no sharp import', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
  it('Phase 6: no @esotericsoftware/spine-core RUNTIME import (type-only OK)', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    // Type-only imports use `import type`; reject runtime `import {...} from '@eso...'` or `import * as`.
    expect(src).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+['"]@esotericsoftware\/spine-core['"]/m);
  });
  it('CLAUDE.md #5: no DOM references', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
  it('Plan 06-03: exports buildExportPlan by name', () => {
    const src = readFileSync(EXPORT_SRC, 'utf8');
    expect(src).toMatch(/export\s+function\s+buildExportPlan/);
  });
});

/**
 * Plan 06-03 Task 2 — parity describe block locking the canonical
 * src/core/export.ts ↔ renderer-side src/renderer/src/lib/export-view.ts
 * inline-copy invariant (Phase 4 D-75 precedent at
 * tests/core/overrides.spec.ts:155-194).
 *
 * The renderer cannot import src/core/* per the Layer 3 arch grep
 * (tests/arch.spec.ts:19-34); AppShell.tsx (Plan 06-06) needs to call
 * buildExportPlan client-side from local `summary` + `overrides` Map per
 * RESEARCH §Open Question 1 = Option A renderer-side build. The renderer
 * gets a byte-identical inline copy at src/renderer/src/lib/export-view.ts
 * — this block asserts the two copies stay locked.
 */
const VIEW_SRC = path.resolve('src/renderer/src/lib/export-view.ts');

describe('export — core ↔ renderer parity (Layer 3 inline-copy invariant)', () => {
  it('renderer view exports buildExportPlan by name', () => {
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/export\s+function\s+buildExportPlan/);
  });

  it('renderer copy has ZERO imports from src/core/* (Layer 3 invariant)', () => {
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    expect(viewText).not.toMatch(/from ['"][^'"]*\/core\/|from ['"]@core/);
  });

  it('renderer copy uses sibling overrides-view.js for applyOverride (NOT core/overrides.js)', () => {
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/from ['"]\.\/overrides-view\.js['"]/);
  });

  it('both files share the same fold-key signature', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /const\s+bySourcePath\s*=\s*new\s+Map/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });

  it('both files share the same Math.ceil uniform sizing pattern + peak-anchored override signature', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    // Bug A fix (Phase 22.1 post-UAT): outW = ceil((canonicalW ?? sourceW) × effScale).
    // Peak-anchored override (2026-05-05): rawEffScale = applyOverride(pct, peakScale).effectiveScale,
    // which already returns the canonical-relative value — no source-ratio adjustment needed.
    // Both files must match (hygiene).
    const ceilSig = /Math\.ceil\(\(acc\.row\.canonicalW \?\? acc\.row\.sourceW\)/;
    expect(coreText).toMatch(ceilSig);
    expect(viewText).toMatch(ceilSig);
    // Phase 35 — loop variable renamed `row` → `region` when buildExportPlan
    // migrated to iterate summary.regions (DEDUP-04/05/06). Regex updated in
    // lockstep with the source files (35-01 core, 35-02 renderer view).
    const overrideSig = /applyOverride\(overridePct,\s*region\.peakScale\)\.effectiveScale/;
    expect(coreText).toMatch(overrideSig);
    expect(viewText).toMatch(overrideSig);
  });

  it('Phase 30 BUFFER-01 — both files share the same buffer-multiply signature (D-09 step order)', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    // CONTEXT D-09 step 2: bufferedScale := buffer === 0 ? raw : raw × (1 + buffer/100).
    // Locked literal — D-07 no-op short-circuit is structurally enforced via this regex.
    // Either file diverging is a parity bug; tests/arch.spec.ts:19-34 keeps the renderer
    // from importing src/core/*, so any drift would be caught here only.
    const bufferSig = /bufferPct\s*===\s*0\s*\?\s*rawEffScale\s*:\s*rawEffScale\s*\*\s*\(1\s*\+\s*bufferPct\s*\/\s*100\)/;
    expect(coreText, 'src/core/export.ts must contain the buffer-multiply signature').toMatch(bufferSig);
    expect(viewText, 'src/renderer/src/lib/export-view.ts must contain the buffer-multiply signature').toMatch(bufferSig);
  });

  it('Phase 30 BUFFER-02 — both files share the same bufferCapped conditional-spread signature', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    // The flag is OPTIONAL on ExportRow (Plan 30-01); Plan 30-02 sets it via
    // a conditional spread parallel to the existing isCapped spread at line 321.
    // Mirror the isCapped pattern — same shape, distinct flag.
    const sig = /acc\.bufferCapped\s*\?\s*\{\s*bufferCapped:\s*true\s*\}/;
    expect(coreText, 'src/core/export.ts must spread bufferCapped conditionally').toMatch(sig);
    expect(viewText, 'src/renderer/src/lib/export-view.ts must spread bufferCapped conditionally').toMatch(sig);
  });

  it('Phase 30 BUFFER-01 — both files declare safetyBufferPercent on BuildExportPlanOptions (D-09)', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /safetyBufferPercent\?\s*:\s*number/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });

  it('both files export the safeScale helper (ceil-thousandth single source of truth, Round 5)', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /export\s+function\s+safeScale/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });

  it('renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs', async () => {
    // Dynamic-import the renderer copy via its file path so the test executes
    // in node (no DOM needed; renderer copy has zero DOM deps).
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;

    // Build a real summary from SIMPLE_TEST then synthesize sourcePath like
    // the case (a)-(e) tests above (Plan 06-02 D-101 path-only field).
    // Phase 35: populate regions[] for post-migration iteration source parity.
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const summary = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
      })),
      regions: regionsFromSampled(sampled),
      orphanedFiles: [], // Phase 24 Plan 01: unusedAttachments replaced
    } as unknown as SkeletonSummary;

    const cases: Array<[string, ReadonlyMap<string, number>]> = [
      ['no overrides (baseline)', new Map()],
      ['override 50% TRIANGLE', new Map([['TRIANGLE', 50]])],
      ['override 200% SQUARE (clamps to 100)', new Map([['SQUARE', 200]])],
      ['multiple overrides', new Map([['CIRCLE', 75], ['TRIANGLE', 30]])],
    ];
    for (const [label, ov] of cases) {
      const corePlan = buildExportPlan(summary, ov);
      const viewPlan = buildExportPlanView(summary, ov);
      expect(viewPlan, label).toEqual(corePlan);
    }
  });

  it('Gap-Fix #1 parity: peakScale 1.5 produces outW = sourceW in BOTH core and renderer copies', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;

    const peaks = [
      {
        attachmentKey: 'default/SLOT/ZOOMED',
        attachmentName: 'ZOOMED',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'zoom',
        time: 0,
        frame: 0,
        peakScale: 1.5,
        peakScaleX: 1.5,
        peakScaleY: 1.5,
        worldW: 150,
        worldH: 150,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/ZOOMED.png',
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const corePlan = buildExportPlan(summary, new Map());
    const viewPlan = buildExportPlanView(summary, new Map());
    expect(viewPlan).toEqual(corePlan);
    // Phase 22.1 D-06: peakScale 1.5 clamps to 1.0 → outW=100=sourceW → passthroughCopies.
    // Both core and renderer must agree.
    expect(corePlan.passthroughCopies[0].outW).toBe(100);
    expect(corePlan.passthroughCopies[0].outH).toBe(100);
    expect(viewPlan.passthroughCopies[0].outW).toBe(100);
    expect(viewPlan.passthroughCopies[0].outH).toBe(100);
  });

  // ----------------------------------------------------------------------
  // Phase 22 Plan 22-04 — parity assertions for the renderer mirror of the
  // DIMS-03 cap formula + DIMS-04 passthrough partition that landed in
  // src/core/export.ts via Plan 22-03. The cap math + partition body is
  // mirrored byte-for-byte into src/renderer/src/lib/export-view.ts; these
  // assertions lock the regex shape AND the behavioral output across both
  // files. Drift in either copy fails here.
  // ----------------------------------------------------------------------

  it('Phase 22 DIMS-03 cap formula present in BOTH files', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /Math\.min\([^)]*actualSourceW\s*\/\s*canonicalW/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });

  it('Phase 22 DIMS-04 passthrough partition present in BOTH files', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sigDecl = /const\s+passthroughCopies\s*:\s*ExportRow\[\]\s*=\s*\[\]/;
    const sigPush = /passthroughCopies\.push\(/;
    expect(coreText).toMatch(sigDecl);
    expect(viewText).toMatch(sigDecl);
    expect(coreText).toMatch(sigPush);
    expect(viewText).toMatch(sigPush);
  });

  it('Phase 22.1 G-04+G-07 isPassthrough predicate in BOTH files (post-restructure)', () => {
    // Phase 22.1 D-06 — the vestigial `isCapped || peakAlreadyAtOrBelowSource`
    // predicate has been replaced with a source-relative comparison:
    //   effectiveSourceW = actualSourceW when PNG < canonicalW, else sourceW
    //   isPassthrough = outW === effectiveSourceW && outH === effectiveSourceH
    // (debug-fix scale-display-optimized-source). Verify the new predicate is
    // present in both canonical + renderer copies.
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /isPassthrough\s*=\s*outW\s*===\s*effectiveSourceW\s*&&\s*outH\s*===\s*effectiveSourceH/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
    // Confirm vestigial predicate is deleted from both files.
    const deletedSig = /peakAlreadyAtOrBelowSource/;
    expect(coreText).not.toMatch(deletedSig);
    expect(viewText).not.toMatch(deletedSig);
  });

  it('Phase 22 behavioral parity: drifted row (cap fires) produces IDENTICAL output in both files', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;
    // Phase 22.1 D-06: drifted row with cap firing (peakScale=0.7, sourceRatio≈0.498)
    // now produces a RESIZE row (rows[]) not passthrough — outW=811 ≠ sourceW=1628.
    // The parity test still holds: both core and renderer produce IDENTICAL output.
    const peaks = [
      {
        attachmentKey: 'default/SLOT/DRIFTED',
        attachmentName: 'DRIFTED',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.7,
        peakScaleX: 0.7,
        peakScaleY: 0.7,
        worldW: 1140,
        worldH: 1336,
        sourceW: 1628,
        sourceH: 1908,
        sourcePath: '/fake/DRIFTED.png',
        canonicalW: 1628,
        canonicalH: 1908,
        actualSourceW: 811,
        actualSourceH: 962,
        dimsMismatch: true,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const corePlan = buildExportPlan(summary, new Map());
    const viewPlan = buildExportPlanView(summary, new Map());
    // Parity: both produce identical output (both now in rows[], not passthroughCopies).
    expect(viewPlan.passthroughCopies).toEqual(corePlan.passthroughCopies);
    expect(viewPlan.rows).toEqual(corePlan.rows);
    expect(viewPlan.totals).toEqual(corePlan.totals);
  });

  it('Phase 22.1 behavioral parity: peakScale < sourceRatio (drifted row) produces IDENTICAL output in both files', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;
    // Phase 22.1 D-06: peakScale=0.3 ≤ sourceRatio(0.498) — both core + renderer
    // now agree: outW=ceil(1628×0.3)=489 ≠ sourceW → rows[] (resize, not passthrough).
    const peaks = [
      {
        attachmentKey: 'default/SLOT/DRIFTED',
        attachmentName: 'DRIFTED',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.3,
        peakScaleX: 0.3,
        peakScaleY: 0.3,
        worldW: 488,
        worldH: 572,
        sourceW: 1628,
        sourceH: 1908,
        sourcePath: '/fake/DRIFTED.png',
        canonicalW: 1628,
        canonicalH: 1908,
        actualSourceW: 811,
        actualSourceH: 962,
        dimsMismatch: true,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const corePlan = buildExportPlan(summary, new Map());
    const viewPlan = buildExportPlanView(summary, new Map());
    expect(viewPlan.passthroughCopies).toEqual(corePlan.passthroughCopies);
    expect(viewPlan.rows).toEqual(corePlan.rows);
  });

  it('Phase 22 DIMS-03 computeExportDims surfaces cap math when actualSource defined', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const computeExportDims = viewModule.computeExportDims;
    // canonical 1628×1908, actual 811×962, peakScale 0.7, no override, dimsMismatch:true.
    // sourceRatio = min(811/1628, 962/1908) = 811/1628 ≈ 0.49816 (X binds).
    // effScale = min(safeScale(0.7)=0.7 → clamp 1 → 0.7, 0.49816) = 0.49816.
    // outW = ceil(1628 × 0.49816) = 811 (binding axis matches actualSourceW).
    // outH = ceil(1908 × 0.49816) = 951 (non-binding; uniform cap, ≤ actualSourceH).
    const result = computeExportDims(
      1628, 1908, 0.7, undefined,
      811, 962, true,
    );
    expect(result.outW).toBe(811);
    expect(result.outH).toBe(951);
    expect(result.effScale).toBeCloseTo(811 / 1628, 6);
  });

  it('Phase 22 DIMS-03 computeExportDims uncapped when dimsMismatch is false', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const computeExportDims = viewModule.computeExportDims;
    // dimsMismatch:false → sourceRatio = Infinity → cap inert → legacy formula.
    const result = computeExportDims(1000, 1000, 0.5, undefined, undefined, undefined, false);
    expect(result.outW).toBe(500);
    expect(result.outH).toBe(500);
    expect(result.effScale).toBeCloseTo(0.5, 6);
  });

  it('Phase 22 DIMS-03 computeExportDims back-compat: omitted Phase-22 args still work', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const computeExportDims = viewModule.computeExportDims;
    // Pre-Phase-22 call shape (4 args) — back-compat for any non-panel callers.
    const result = computeExportDims(1000, 1000, 0.5, undefined);
    expect(result.outW).toBe(500);
    expect(result.outH).toBe(500);
    expect(result.effScale).toBeCloseTo(0.5, 6);
  });
});

/**
 * Phase 30 Plan 30-02 — safety-buffer math (BUFFER-01..03).
 *
 * Locks the locked-by-CONTEXT D-09 step order:
 *   1. raw effScale  := overridePct ? applyOverride(...) : peakScale
 *   2. bufferedScale := buffer === 0 ? raw : raw × (1 + buffer/100)   [D-07 short-circuit]
 *   3. clampedScale  := Math.min(safeScale(bufferedScale), 1.0)
 *   4. cappedScale   := Math.min(clampedScale, sourceRatio)
 *   5. isCapped      := clampedScale > sourceRatio                    [unchanged]
 *   6. bufferCapped  := bufferPct > 0 && buffered > sourceRatio && safeScale(raw) <= sourceRatio  [NARROW per D-06]
 *
 * Coverage:
 *   T1 — D-07 no-op: buffer=0 byte-identical to omitted opts.
 *   T2 — Linear growth: buffer=5 produces safeScale(rawEff × 1.05).
 *   T3 — Canonical-1.0 clamp: bufferCapped does NOT fire on clean atlases (NARROW per D-06).
 *   T4 — Cap-binding: buffer pushes drifted row past sourceRatio → bufferCapped: true.
 *   T5 — Passthrough preserved: peakScale=1.0 + buffer=5 → still in passthroughCopies[].
 *   T6 — Per-region dedup × buffer order: buffer applies BEFORE dedup keep-max (Pitfall 4).
 *   T7 — Aspect-ratio invariant: buffer-induced cap stays uniform on both axes (D-91 + D-110).
 *   T8 — Chicken-Min path-indirection regression (Phase 29 × Phase 30).
 */
describe('buildExportPlan — Phase 30 BUFFER-01..03', () => {
  // Helper: synthesize a clean-atlas SkeletonSummary (no dimsMismatch → sourceRatio = Infinity).
  // canonicalW === sourceW by Phase 21 contract on canonical-atlas + atlas-less paths.
  function makeCleanSummary(
    canonicalDim: number,
    peakScale: number,
    name = 'CLEAN_ATTACH',
    sourcePath = `/fake/${name}.png`,
  ): SkeletonSummary {
    const peaks = [
      {
        attachmentKey: `default/SLOT/${name}`,
        attachmentName: name,
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalDim * peakScale,
        worldH: canonicalDim * peakScale,
        sourceW: canonicalDim,
        sourceH: canonicalDim,
        sourcePath,
        canonicalW: canonicalDim,
        canonicalH: canonicalDim,
        dimsMismatch: false,
      },
    ];
    return {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
  }

  // Helper: drifted-row SkeletonSummary. dimsMismatch=true → sourceRatio binds.
  function makeDriftedSummary(
    canonicalW: number,
    canonicalH: number,
    actualW: number,
    actualH: number,
    peakScale: number,
    name = 'DRIFTED_ATTACH',
    sourcePath = `/fake/${name}.png`,
  ): SkeletonSummary {
    const peaks = [
      {
        attachmentKey: `default/SLOT/${name}`,
        attachmentName: name,
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW * peakScale,
        worldH: canonicalH * peakScale,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath,
        canonicalW,
        canonicalH,
        actualSourceW: actualW,
        actualSourceH: actualH,
        dimsMismatch: true,
      },
    ];
    return {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
  }

  it('T1 D-07 no-op: safetyBufferPercent: 0 produces byte-identical output to undefined opts (SIMPLE_TEST)', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    // Phase 35: populate regions[] for post-migration iteration source.
    const summary = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
      })),
      regions: regionsFromSampled(sampled),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const planUndef = buildExportPlan(summary, new Map());
    const planZero = buildExportPlan(summary, new Map(), { safetyBufferPercent: 0 });
    // Deep-equal AND byte-equal serialization — locks the no-op contract per D-07.
    expect(planZero).toEqual(planUndef);
    expect(JSON.stringify(planZero)).toBe(JSON.stringify(planUndef));
  });

  it('T2 linear growth: 5% buffer on peakScale=0.5 yields safeScale(0.525) on a clean atlas (cap not bound)', () => {
    // Clean atlas (no dimsMismatch) → sourceRatio = Infinity → cap inert.
    // rawEff = 0.5; bufferedScale = 0.5 × 1.05 = 0.525 (already at thousandth boundary).
    // safeScale(0.525) = 0.525; downscaleClampedScale = min(0.525, 1) = 0.525.
    // outW = ceil(canonicalW × 0.525) = ceil(1000 × 0.525) = 525.
    const summary = makeCleanSummary(1000, 0.5, 'GROW');
    const plan = buildExportPlan(summary, new Map(), { safetyBufferPercent: 5 });
    // Row goes to rows[] (outW=525 ≠ sourceW=1000).
    expect(plan.rows.length).toBe(1);
    expect(plan.passthroughCopies.length).toBe(0);
    const r = plan.rows[0];
    expect(r.effectiveScale).toBeCloseTo(0.525, 6);
    expect(r.outW).toBe(525);
    expect(r.outH).toBe(525);
    // Narrow predicate: bufferCapped MUST be undefined (cap not bound on clean atlas).
    expect(r.bufferCapped).toBeUndefined();
    expect(r.isCapped).toBeUndefined();
  });

  it('T3 canonical-1.0 clamp: bufferCapped does NOT fire on clean atlas (NARROW predicate per D-06)', () => {
    // Clean atlas, peakScale=0.99 → buffered=0.99×1.05=1.0395 → clamped to 1.0 (canonical).
    // sourceRatio = Infinity (no dimsMismatch). NARROW predicate's
    // (bufferedScale > sourceRatio) condition is FALSE since Infinity beats anything.
    // → bufferCapped MUST be undefined; flag does NOT fire on canonical-only clamp.
    const summary = makeCleanSummary(1000, 0.99, 'NEAR_TOP');
    const plan = buildExportPlan(summary, new Map(), { safetyBufferPercent: 5 });
    // Both rows[] and passthroughCopies[] together must hold exactly 1 row.
    const all = [...plan.rows, ...plan.passthroughCopies];
    expect(all.length).toBe(1);
    const r = all[0];
    // effectiveScale clamps to 1.0 (canonical ceiling).
    expect(r.effectiveScale).toBe(1);
    expect(r.outW).toBe(1000);
    expect(r.outH).toBe(1000);
    // NARROW predicate: bufferCapped is silent on canonical-1.0 clamp.
    expect(r.bufferCapped).toBeUndefined();
  });

  it('T4 cap-binding: bufferCapped FIRES when buffer pushes a cap-eligible row past sourceRatio (NARROW predicate)', () => {
    // canonical 1000×1000, actual 700×700 → sourceRatio = 0.7.
    // peakScale = 0.6 (below sourceRatio). safeScale(0.6) = 0.6 ≤ 0.7 (raw not capped).
    // buffer = 25 → bufferedScale = 0.6 × 1.25 = 0.75 > sourceRatio = 0.7.
    // → bufferCapped fires (NARROW predicate satisfied). isCapped also fires
    //   because downscaleClampedScale = safeScale(0.75) = 0.75 > 0.7.
    // effScale = min(0.75, 0.7) = 0.7; outW = ceil(1000 × 0.7) = 700 = actualSourceW.
    // Phase 22.1 partition runs on FINAL outW vs effectiveSourceW (= actualSourceW
    // when actualSourceW < canonicalW): outW=700 === effectiveSourceW=700 →
    // passthroughCopies[]. The buffer cap silently lands at the source-dim edge
    // and the partition correctly classifies the byte-copy. The bufferCapped
    // flag still rides through (it's set on the Acc before the emit-loop partition).
    const summary = makeDriftedSummary(1000, 1000, 700, 700, 0.6, 'CAP_BIND');
    const plan = buildExportPlan(summary, new Map(), { safetyBufferPercent: 25 });
    const all = [...plan.rows, ...plan.passthroughCopies];
    expect(all.length).toBe(1);
    const r = all[0];
    expect(r.bufferCapped).toBe(true);
    expect(r.isCapped).toBe(true);
    expect(r.outW).toBe(700);
    expect(r.outH).toBe(700);
  });

  it('T5 passthrough preserved: peakScale=1.0 + buffer=5 → still in passthroughCopies[] (Pitfall 3)', () => {
    // Clean atlas TRIANGLE-style row at peak. rawEff=1.0; buffered=1.05; safeScale=1.05; clamp to 1.0.
    // No dimsMismatch → sourceRatio = Infinity. Cap inert. Final effScale = 1.0.
    // outW = ceil(1000 × 1.0) = 1000 = sourceW → row stays in passthroughCopies[]
    // (canonical clamp handles the buffer-induced overshoot; partition runs on
    // FINAL outW/outH at emit loop). bufferCapped is silent (NARROW; canonical only).
    const summary = makeCleanSummary(1000, 1.0, 'TRIANGLE_LIKE');
    const plan = buildExportPlan(summary, new Map(), { safetyBufferPercent: 5 });
    expect(plan.rows.length).toBe(0);
    expect(plan.passthroughCopies.length).toBe(1);
    const r = plan.passthroughCopies[0];
    expect(r.outW).toBe(1000);
    expect(r.outH).toBe(1000);
    expect(r.effectiveScale).toBe(1);
    expect(r.bufferCapped).toBeUndefined();
  });

  it('T6 per-region dedup × buffer ordering: buffer applies BEFORE keep-max compare (Pitfall 4)', () => {
    // Two attachments share /fake/SHARED.png. Raw effScales 0.6 and 0.8.
    // Buffer = 5 → buffered = 0.6 × 1.05 = 0.6300000000000001 (IEEE-754) and
    // 0.8 × 1.05 = 0.8400000000000001 (IEEE-754). After safeScale (ceil-thousandth):
    //   safeScale(0.6300000000000001) = ceil(630.0000000000001) / 1000 = 0.631
    //   safeScale(0.8400000000000001) = ceil(840.0000000000001) / 1000 = 0.841
    // Both ≤ 1. The ceil-thousandth lower-bound contract (Pitfall 1: D-07
    // is the no-op gate, NOT this code path — buffer > 0 here) intentionally
    // adds a sub-thousandth bump for IEEE-754 non-representable products.
    // Dedup keep-max picks 0.841 (the one with the larger raw, buffered).
    // Determinism: order of contributing attachments doesn't matter (max wins).
    const peaks = [
      {
        attachmentKey: 'default/A/SMALL',
        attachmentName: 'SMALL',
        regionName: 'SHARED',
        skinName: 'default',
        slotName: 'A',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.6,
        peakScaleX: 0.6,
        peakScaleY: 0.6,
        worldW: 600,
        worldH: 600,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/SHARED.png',
        canonicalW: 1000,
        canonicalH: 1000,
        dimsMismatch: false,
      },
      {
        attachmentKey: 'default/B/BIG',
        attachmentName: 'BIG',
        regionName: 'SHARED',
        skinName: 'default',
        slotName: 'B',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.8,
        peakScaleX: 0.8,
        peakScaleY: 0.8,
        worldW: 800,
        worldH: 800,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/SHARED.png',
        canonicalW: 1000,
        canonicalH: 1000,
        dimsMismatch: false,
      },
    ];
    const summary: SkeletonSummary = {
      peaks: peaks as unknown as SkeletonSummary['peaks'],
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map(), { safetyBufferPercent: 5 });
    // One deduped row from /fake/SHARED.png; winner = buffered max = 0.841 (post-safeScale).
    expect(plan.rows.length + plan.passthroughCopies.length).toBe(1);
    const r = (plan.rows[0] ?? plan.passthroughCopies[0]) as typeof plan.rows[number];
    expect(r.effectiveScale).toBe(0.841);
    // attachmentNames union both contributors.
    expect(r.attachmentNames.sort()).toEqual(['BIG', 'SMALL']);
    expect(r.outW).toBe(841);
    expect(r.outH).toBe(841);
  });

  it('T7 aspect-ratio invariant: buffer-induced cap is uniform on both axes (D-91 + Phase 6 D-110)', () => {
    // Non-square actualSource: canonical 1000×1000, actual 700×800.
    // sourceRatio = min(700/1000, 800/1000) = 0.7. peakScale=0.6, buffer=25.
    // bufferedScale = 0.75 > sourceRatio (0.7) → cap binds at 0.7.
    // Output dims: outW = ceil(1000 × 0.7) = 700; outH = ceil(1000 × 0.7) = 700.
    // BOTH axes use the SAME effScale (0.7); aspect of OUTPUT is 1:1 (canonical),
    // NOT 7:8 (per-axis would distort). This locks uniform-only under buffer.
    const summary = makeDriftedSummary(1000, 1000, 700, 800, 0.6, 'NONSQUARE');
    const plan = buildExportPlan(summary, new Map(), { safetyBufferPercent: 25 });
    expect(plan.rows.length).toBe(1);
    const r = plan.rows[0];
    expect(r.outW).toBe(700);
    expect(r.outH).toBe(700);
    expect(r.effectiveScale).toBeCloseTo(0.7, 6);
    expect(r.bufferCapped).toBe(true);
  });

  it('T8 lockstep parity: core and renderer mirror produce IDENTICAL ExportPlan under non-zero buffer', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;
    // Mix of clean + drifted; verify cross-file parity holds at buffer 5 and 25.
    const peaks = [
      {
        attachmentKey: 'default/A/CLEAN',
        attachmentName: 'CLEAN',
        skinName: 'default',
        slotName: 'A',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 500,
        worldH: 500,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/CLEAN.png',
        canonicalW: 1000,
        canonicalH: 1000,
        dimsMismatch: false,
      },
      {
        attachmentKey: 'default/B/DRIFT',
        attachmentName: 'DRIFT',
        skinName: 'default',
        slotName: 'B',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.6,
        peakScaleX: 0.6,
        peakScaleY: 0.6,
        worldW: 600,
        worldH: 600,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/DRIFT.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: 700,
        actualSourceH: 700,
        dimsMismatch: true,
      },
    ];
    const summary: SkeletonSummary = {
      peaks: peaks as unknown as SkeletonSummary['peaks'],
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    for (const buf of [5, 25]) {
      const corePlan = buildExportPlan(summary, new Map(), { safetyBufferPercent: buf });
      const viewPlan = buildExportPlanView(summary, new Map(), { safetyBufferPercent: buf });
      expect(viewPlan, `buffer=${buf}`).toEqual(corePlan);
    }
  });
});

/**
 * Phase 22 Plan 22-03 — DIMS-03 cap formula + DIMS-04 passthrough partition.
 *
 * The cap step inserts between the existing safeScale + ≤1 clamp and the
 * dedup keep-max comparison. The cap is uniform: a single multiplier from
 * Math.min(actualSourceW/canonicalW, actualSourceH/canonicalH) — NOT
 * per-axis. Locked memory `project_phase6_default_scaling.md` forbids
 * per-axis scaling (anisotropic export breaks Spine UV sampling).
 *
 * D-04 REVISED (2026-05-02 post-research) — generous passthrough formula:
 *   isCapped = downscaleClampedScale > sourceRatio (cap binds; output IS actualSource)
 *   peakAlreadyAtOrBelowSource = downscaleClampedScale <= sourceRatio
 *   isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)
 *
 * Test fixtures construct DisplayRow literals with sourceW === canonicalW
 * (Phase 21 contract: canonical-atlas + atlas-less paths satisfy this
 * equality). The legacy outW = Math.ceil(sourceW × effScale) formula in
 * buildExportPlan handles BOTH the binding-cap case AND the non-binding-cap
 * case correctly:
 *   - Binding axis (X if sourceRatio = actualSourceW/canonicalW): outW
 *     = Math.ceil(canonicalW × sourceRatio) = Math.ceil(actualSourceW)
 *     = actualSourceW exactly (since actualSourceW is integer).
 *   - Non-binding axis (Y if X is binding): outH = Math.ceil(canonicalH ×
 *     sourceRatio) ≤ actualSourceH (may be 1px less; this is the "wasteful
 *     1px aspect-ratio noise" edge case acknowledged in CONTEXT D-04).
 *
 * The passthrough output preserves aspect ratio uniformly — non-binding
 * axis can lose up to 1px on its way to passthrough's "already optimized"
 * indicator. The downstream image-worker copies bytes verbatim regardless.
 */
describe('buildExportPlan — DIMS-03 cap formula + DIMS-04 passthrough partition (Phase 22)', () => {
  // Helper: synthesize a drifted-row SkeletonSummary. canonicalW === sourceW
  // by Phase 21 contract on canonical-atlas + atlas-less paths.
  function makeDriftedSummary(
    canonicalW: number,
    canonicalH: number,
    actualW: number,
    actualH: number,
    peakScale: number,
    name = 'DRIFTED_ATTACH',
  ): SkeletonSummary {
    const peaks = [
      {
        attachmentKey: `default/SLOT/${name}`,
        attachmentName: name,
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW * peakScale,
        worldH: canonicalH * peakScale,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath: `/fake/${name}.png`,
        canonicalW,
        canonicalH,
        actualSourceW: actualW,
        actualSourceH: actualH,
        dimsMismatch: true,
      },
    ];
    return {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
  }

  // Helper: synthesize a non-drifted summary (no actualSource → no cap).
  function makeNonDriftedSummary(canonicalW: number, canonicalH: number, peakScale: number): SkeletonSummary {
    const peaks = [
      {
        attachmentKey: 'default/SLOT/CLEAN',
        attachmentName: 'CLEAN',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW * peakScale,
        worldH: canonicalH * peakScale,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath: '/fake/CLEAN.png',
        canonicalW,
        canonicalH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
    ];
    return {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
  }

  it('DIMS-03 cap fires: drifted row outW === actualSourceW after cap binds (binding axis)', () => {
    // canonical 1628×1908, actual 811×962, peakScale 0.7
    // sourceRatio = min(811/1628 ≈ 0.49816, 962/1908 ≈ 0.50419) = 0.49816 (X axis binds)
    // downscaleClampedScale = min(safeScale(0.7)=0.7, 1) = 0.7
    // cappedEffScale = min(0.7, 0.49816) = 0.49816 (cap binds)
    // outW = ceil(1628 × 0.49816) = ceil(811.000) = 811 (matches actualSourceW exactly — binding axis)
    // outH = ceil(1908 × 0.49816) = ceil(950.49) = 951 (NOT 962; Y is non-binding, uniform cap loses up to 1px)
    //
    // Phase 22.1 D-06: outW=811 ≠ sourceW=1628 → row goes to rows[] (resize), NOT passthroughCopies.
    // The new predicate `outW === sourceW` correctly identifies this as a resize operation.
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.7);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);  // Phase 22.1 D-06: resize, not passthrough
    expect(plan.passthroughCopies).toHaveLength(0);
    const row = plan.rows[0];
    expect(row.outW).toBe(811); // binding axis equals actualSourceW exactly
    expect(row.outH).toBe(951); // non-binding axis: ceil(1908 × sourceRatio) — uniform cap, NOT per-axis
    expect(row.effectiveScale).toBeCloseTo(811 / 1628, 6); // sourceRatio precisely
  });

  it('DIMS-03 cap does NOT fire when no drift: non-drifted row uses legacy formula', () => {
    // 1000×1000 canonical, no actualSource, peakScale 0.5
    // sourceRatio = Infinity (dimsMismatch:false); cappedEffScale = 0.5
    const summary = makeNonDriftedSummary(1000, 1000, 0.5);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    expect(plan.passthroughCopies).toHaveLength(0);
    expect(plan.rows[0].outW).toBe(500); // ceil(1000 × 0.5)
    expect(plan.rows[0].outH).toBe(500);
    expect(plan.rows[0].effectiveScale).toBeCloseTo(0.5, 6);
  });

  it('DIMS-03 aspect ratio invariant: cap is uniform single multiplier (NOT per-axis)', () => {
    // canonical 1000×800, actual 500×480 (aspect ratios differ — X drift 50%, Y drift 60%)
    // sourceRatio = min(500/1000=0.5, 480/800=0.6) = 0.5 (X axis is more constraining)
    // peakScale 0.9 → downscaleClampedScale = 0.9 → cappedEffScale = min(0.9, 0.5) = 0.5
    // outW = ceil(1000 × 0.5) = 500; outH = ceil(800 × 0.5) = 400
    // outH === 400 ≠ 480 (actualH) — uniform cap, NOT per-axis: aspect-ratio preserved.
    //
    // Phase 22.1 D-06: outW=500 ≠ sourceW=1000 → row goes to rows[] (resize), not passthrough.
    const summary = makeDriftedSummary(1000, 800, 500, 480, 0.9);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);  // Phase 22.1 D-06: resize, not passthrough
    expect(plan.passthroughCopies).toHaveLength(0);
    const row = plan.rows[0];
    expect(row.outW).toBe(500);
    expect(row.outH).toBe(400); // NOT 480 — uniform cap from min over both axes
    expect(row.effectiveScale).toBeCloseTo(0.5, 6);
  });

  it('DIMS-04 cap fires (isCapped branch): peakScale > sourceRatio → cap-clamped resize (Phase 22.1 D-06)', () => {
    // Phase 22.1 D-06: outW=811 ≠ sourceW=1628 → rows[] (resize), NOT passthroughCopies.
    // The old Phase 22 D-04 REVISED `dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)`
    // predicate has been superseded by the simpler `outW === sourceW` predicate.
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.8);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);   // Phase 22.1 D-06: resize
    expect(plan.passthroughCopies).toHaveLength(0);
    // outW is still cap-clamped to actualSourceW (binding axis cap math preserved).
    expect(plan.rows[0].outW).toBe(811);
    // isCapped flag is set on the row (D-07 cap-binding signal).
    expect(plan.rows[0].isCapped).toBe(true);
  });

  it('DIMS-04 peakScale ≤ sourceRatio (previously peakAlreadyAtOrBelowSource): produces resize (Phase 22.1 D-06)', () => {
    // Phase 22.1 D-06: peakScale 0.3 ≤ sourceRatio 0.498 → effScale=0.3 (cap is inert) →
    // outW = ceil(1628 × 0.3) = 489 ≠ sourceW=1628 → rows[] (resize).
    // The deleted `peakAlreadyAtOrBelowSource` branch previously sent this to passthrough;
    // the new predicate correctly identifies it as a resize.
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.3);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);  // Phase 22.1 D-06: resize, not passthrough
    expect(plan.passthroughCopies).toHaveLength(0);
    // outW = ceil(1628 × 0.3) = 489 (peakScale < sourceRatio → effScale = peakScale, no cap)
    expect(plan.rows[0].outW).toBe(Math.ceil(1628 * 0.3)); // 489
  });

  it('DIMS-04 binding-axis ceil-equality: cap formula correct on binding axis (defense-in-depth)', () => {
    // Cap math still runs as defense-in-depth (Phase 22.1 PATTERNS.md).
    // The binding axis (X) still ceils to actualSourceW by construction.
    // Row now goes to rows[] (resize) because outW=811 ≠ sourceW=1628.
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.9);
    const plan = buildExportPlan(summary, new Map());
    // Phase 22.1 D-06: now in rows[], not passthroughCopies.
    expect(plan.rows).toHaveLength(1);
    expect(plan.passthroughCopies).toHaveLength(0);
    const row = plan.rows[0];
    // Binding axis (X here, since 811/1628 < 962/1908): ceil(canonicalW × cappedEffScale) === actualSourceW.
    expect(Math.ceil(1628 * row.effectiveScale)).toBe(811);
    // Non-binding axis: ceil(canonicalH × cappedEffScale) ≤ actualSourceH (allowed 1px slack).
    expect(Math.ceil(1908 * row.effectiveScale)).toBeLessThanOrEqual(962);
    expect(Math.ceil(1908 * row.effectiveScale)).toBe(951); // ceil(950.49) — uniform cap result
  });

  it('D-02 override interaction: 100% override on drifted row → cap clamps → resize (Phase 22.1 D-06)', () => {
    // canonical 1628×1908, actual 811×962. Override 100% → applyOverride yields
    // effectiveScale = 1.0 → downscaleClampedScale = min(safeScale(1.0)=1, 1) = 1.
    // sourceRatio = 0.498; cappedEffScale = min(1, 0.498) = 0.498 (cap binds).
    // outW = ceil(1628 × 0.498) = 811 ≠ sourceW=1628 → rows[] (resize).
    // Phase 22.1 D-06: cap-clamped row goes to resize, NOT passthrough.
    // (In the unified model where sourceW=actualSourceW=811, this would be passthrough.)
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.5, 'OVERRIDE_DRIFTED');
    const plan = buildExportPlan(summary, new Map([['OVERRIDE_DRIFTED', 100]]));
    expect(plan.rows).toHaveLength(1);  // Phase 22.1 D-06: resize
    expect(plan.passthroughCopies).toHaveLength(0);
    expect(plan.rows[0].outW).toBe(811); // binding-axis cap, not canonicalW
  });

  it('atlas-extract path no cap: actualSourceW undefined → row in plan.rows[]', () => {
    // dimsMismatch:false, actualSourceW:undefined → sourceRatio=Infinity → no cap, no passthrough.
    const summary = makeNonDriftedSummary(1000, 1000, 0.7);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    expect(plan.passthroughCopies).toHaveLength(0);
  });

  it('totals.count === rows.length + passthroughCopies.length (mixed plan)', () => {
    // Phase 22.1 D-06: drifted row (A) now goes to rows[] (resize, not passthrough).
    // Non-drifted row B (peakScale=0.5 → outW=500 ≠ sourceW=1000): rows[].
    // Non-drifted row C (peakScale=1.0 → outW=1000 === sourceW=1000): passthroughCopies[].
    // Total: rows=2 (A + B), passthrough=1 (C).
    const peaks = [
      // Drifted — Phase 22.1: now resize (outW=811 ≠ sourceW=1628)
      {
        attachmentKey: 'default/SLOT/A',
        attachmentName: 'A',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.7,
        peakScaleX: 0.7,
        peakScaleY: 0.7,
        worldW: 1140,
        worldH: 1336,
        sourceW: 1628,
        sourceH: 1908,
        sourcePath: '/fake/A.png',
        canonicalW: 1628,
        canonicalH: 1908,
        actualSourceW: 811,
        actualSourceH: 962,
        dimsMismatch: true,
      },
      // Non-drifted (no actualSource), peakScale=0.5 → outW=500 ≠ 1000 → rows[]
      {
        attachmentKey: 'default/SLOT/B',
        attachmentName: 'B',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 500,
        worldH: 500,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/B.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
      // Non-drifted matching dims, peakScale=1.0 → outW=1000 === sourceW=1000 → passthroughCopies[]
      {
        attachmentKey: 'default/SLOT/C',
        attachmentName: 'C',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 1.0,
        peakScaleX: 1.0,
        peakScaleY: 1.0,
        worldW: 1000,
        worldH: 1000,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/C.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: 1000,
        actualSourceH: 1000,
        dimsMismatch: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(2);         // A (drifted resize) + B (normal resize)
    expect(plan.passthroughCopies).toHaveLength(1);  // C (full-size, no resize needed)
    expect(plan.totals.count).toBe(plan.rows.length + plan.passthroughCopies.length);
    expect(plan.totals.count).toBe(3);
  });

  it('rows[] sorted deterministically by sourcePath localeCompare (was: passthroughCopies sorted)', () => {
    // Rows with peakScale=0.9 and no drift (actualSourceW=canonicalW=sourceW=1000):
    // effScale = 0.9, outW = ceil(1000 * 0.9) = 900 ≠ 1000 = effectiveSourceW -> resize rows[].
    // debug-fix scale-display-optimized-source: actualSourceW must NOT be smaller than
    // canonicalW here, otherwise outW=500=effectiveSourceW=500 -> passthrough.
    // Sort invariant: rows[] are sorted by sourcePath.localeCompare().
    const peaks = [
      {
        attachmentKey: 'default/SLOT/Z',
        attachmentName: 'Z',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.9,
        peakScaleX: 0.9,
        peakScaleY: 0.9,
        worldW: 900,
        worldH: 900,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/Z.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: 1000,
        actualSourceH: 1000,
        dimsMismatch: false,
      },
      {
        attachmentKey: 'default/SLOT/A',
        attachmentName: 'A',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.9,
        peakScaleX: 0.9,
        peakScaleY: 0.9,
        worldW: 900,
        worldH: 900,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/A.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: 1000,
        actualSourceH: 1000,
        dimsMismatch: false,
      },
      {
        attachmentKey: 'default/SLOT/M',
        attachmentName: 'M',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.9,
        peakScaleX: 0.9,
        peakScaleY: 0.9,
        worldW: 900,
        worldH: 900,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/M.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: 1000,
        actualSourceH: 1000,
        dimsMismatch: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    // peakScale=0.9, no drift: outW = ceil(1000 * 0.9) = 900 ≠ 1000 -> resize rows[].
    const paths = plan.rows.map((r) => r.sourcePath);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
    expect(paths).toEqual(['/fake/A.png', '/fake/M.png', '/fake/Z.png']);
    expect(plan.passthroughCopies).toHaveLength(0);
  });

  it('CHECKER FIX 2026-05-02 — passthrough ExportRow carries actualSourceW + actualSourceH from DisplayRow', () => {
    // Phase 22.1 D-06: passthrough requires outW === sourceW (post-cap, post-override).
    // With drifted unified shape (sourceW < canonicalW), passthrough NEVER occurs
    // because outW = ceil(sourceW × sourceRatio) ≠ sourceW for sourceRatio < 1.0.
    // → Test the actualSource-threading invariant on a non-drifted row instead:
    // peakScale=1.0 + dimsMismatch=false → effScale=1.0 → outW=sourceW → passthrough,
    // and actualSource fields (when explicitly set) carry through to the passthrough row.
    const peaks = [
      {
        attachmentKey: 'default/SLOT/FULLSIZE',
        attachmentName: 'FULLSIZE',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 1.0,
        peakScaleX: 1.0,
        peakScaleY: 1.0,
        worldW: 811,
        worldH: 962,
        sourceW: 811,
        sourceH: 962,
        sourcePath: '/fake/FULLSIZE.png',
        canonicalW: 811,
        canonicalH: 962,
        actualSourceW: 811,  // same as sourceW and canonicalW (no drift)
        actualSourceH: 962,
        dimsMismatch: false,
      },
    ];
    const nonDriftedSummary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const planND = buildExportPlan(nonDriftedSummary, new Map());
    // Non-drifted, peakScale=1.0 → effScale=1.0 → outW=811=sourceW → passthrough.
    expect(planND.passthroughCopies).toHaveLength(1);
    // actualSourceW/H carried to passthrough row.
    expect(planND.passthroughCopies[0].actualSourceW).toBe(811);
    expect(planND.passthroughCopies[0].actualSourceH).toBe(962);
  });

  it('CHECKER FIX 2026-05-02 — non-passthrough ExportRow has undefined actualSourceW + actualSourceH', () => {
    // Non-drifted row → not passthrough → actualSource fields stay undefined.
    const summary = makeNonDriftedSummary(1000, 1000, 0.5);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    expect(plan.rows[0].actualSourceW).toBeUndefined();
    expect(plan.rows[0].actualSourceH).toBeUndefined();
  });
});

/**
 * Phase 22.1 Plan 22.1-03 — G-04 + G-07 partition restructure tests.
 *
 * G-04: Generalized passthrough predicate. Replace the Phase 22 D-04 REVISED
 *   `dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)` with the simpler
 *   `outW === sourceW AND outH === sourceH` (post-cap, post-override-resolution).
 *   Covers TRIANGLE-style no-op-resize rows (peakScale=1.0×, no drift) that
 *   Phase 22 D-04 REVISED missed (dimsMismatch:false → isPassthrough always false).
 *
 * G-07 BLOCKER: Override-aware passthrough re-routing. A row is passthrough
 *   only if `(outW === sourceW AND outH === sourceH) AFTER all overrides resolved`.
 *   Override on a drifted row that pushes effective scale BELOW source-ratio cap
 *   re-routes the row from `passthroughCopies[]` to `rows[]` (genuine Lanczos
 *   resize). Override that keeps row at source-equal dims keeps it in passthrough.
 *
 * These tests fail against the Phase 22 D-04 REVISED predicate and pass only
 * once the partition predicate is moved to the emit loop (post-cap, post-override).
 */
describe('buildExportPlan — G-04 + G-07 partition restructure (Phase 22.1)', () => {
  // Helper: synthesize a TRIANGLE-style row — no drift, peakScale=1.0, dimsMismatch false.
  // This row SHOULD be passthrough (outW === sourceW) but the Phase 22 D-04 REVISED
  // predicate misses it because dimsMismatch is false.
  function makeTriangleStyleSummary(sourceW: number, sourceH: number, peakScale: number): SkeletonSummary {
    const peaks = [
      {
        attachmentKey: 'default/SLOT/TRI',
        attachmentName: 'TRI',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: sourceW * peakScale,
        worldH: sourceH * peakScale,
        sourceW,
        sourceH,
        sourcePath: '/fake/TRI.png',
        canonicalW: sourceW,
        canonicalH: sourceH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
    ];
    return {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
  }

  // Helper: synthesize a drifted row where sourceW === actualSourceW (unified model).
  // After 22.1-01, sourceW IS actualSourceW in both modes; cap is effectively a no-op
  // (sourceRatio = 1.0) but we still synthesize the pre-unification shape to test
  // the predicate independently.
  function makeDriftedSummaryUnified(
    sourceW: number,
    sourceH: number,
    peakScale: number,
    name = 'DRIFT',
  ): SkeletonSummary {
    // Post-22.1-01 unified model: actualSourceW === sourceW. The cap math
    // becomes sourceRatio = min(sourceW/canonicalW, sourceH/canonicalH) = 1.0
    // (since canonicalW === sourceW). So cappedEffScale === downscaleClampedScale.
    // The simple predicate `outW === sourceW` is the correct partition.
    const peaks = [
      {
        attachmentKey: `default/SLOT/${name}`,
        attachmentName: name,
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: sourceW * peakScale,
        worldH: sourceH * peakScale,
        sourceW,
        sourceH,
        sourcePath: `/fake/${name}.png`,
        canonicalW: sourceW,
        canonicalH: sourceH,
        actualSourceW: sourceW,   // unified: actualSourceW === sourceW
        actualSourceH: sourceH,   // unified: actualSourceH === sourceH
        dimsMismatch: false,      // unified: no mismatch when actual === canonical
      },
    ];
    return {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
  }

  it('G-04: TRIANGLE peakScale=1.0 with no drift emits to passthroughCopies (NOT rows)', () => {
    // TRIANGLE-style: peakScale = 1.0, no dimsMismatch. After the restructure,
    // outW = ceil(sourceW × 1.0) = sourceW → isPassthrough = true → passthroughCopies.
    // Phase 22 D-04 REVISED MISSED this case (dimsMismatch:false → isPassthrough:false).
    const summary = makeTriangleStyleSummary(833, 759, 1.0);
    const plan = buildExportPlan(summary, new Map());
    // G-04: generalized predicate catches peakScale=1.0× no-drift row as passthrough.
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
    const row = plan.passthroughCopies[0];
    expect(row.outW).toBe(833); // ceil(833 × 1.0) === 833 === sourceW
    expect(row.outH).toBe(759);
    expect(row.effectiveScale).toBeCloseTo(1.0, 6);
  });

  it('G-04: peakScale < 1.0 non-drift row stays in rows[] (not passthrough)', () => {
    // peakScale = 0.5 → outW = ceil(833 × 0.5) = 417 ≠ 833 → NOT passthrough.
    const summary = makeTriangleStyleSummary(833, 759, 0.5);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    expect(plan.passthroughCopies).toHaveLength(0);
  });

  it('G-07: low-enough override on a clamped passthrough row re-routes to rows[] as resize', () => {
    // Unified model: sourceW === actualSourceW === canonicalW = 1000.
    // peak-anchored semantics (2026-05-05): override % means "% of peak demand".
    // Use peakScale=2.0 (clamps to canonical 1.0) as the baseline:
    //   - No override: effScale = min(safeScale(2.0), 1) = 1.0 → outW = 1000 = sourceW → passthrough.
    //   - 25% override: effScale = 0.25 × 2.0 = 0.5 → outW = 500 → resize (escapes the clamp).
    //   - (50% would yield 1.0, still clamped to passthrough — that's the cap edge.)
    // G-07 BLOCKER: the override takes the row OUT of passthroughCopies INTO rows[].
    const summary = makeDriftedSummaryUnified(1000, 1000, 2.0, 'BIGROW');

    // Baseline: no override → passthrough (peakScale 2.0 clamps to 1.0 → outW = sourceW).
    const planNoOverride = buildExportPlan(summary, new Map());
    expect(planNoOverride.passthroughCopies).toHaveLength(1);
    expect(planNoOverride.rows).toHaveLength(0);

    // 25% override → effScale = 0.25 × 2.0 = 0.5 → outW = 500 ≠ sourceW → re-routes to rows[].
    const plan25 = buildExportPlan(summary, new Map([['BIGROW', 25]]));
    expect(plan25.rows, 'G-07: 25% override must route to rows[]').toHaveLength(1);
    expect(plan25.passthroughCopies, 'G-07: 25% override must leave passthroughCopies empty').toHaveLength(0);
    const resizedRow = plan25.rows[0];
    expect(resizedRow.outW).toBe(Math.ceil(1000 * 0.5)); // 500
    expect(resizedRow.outH).toBe(Math.ceil(1000 * 0.5)); // 500
    expect(resizedRow.effectiveScale).toBeCloseTo(0.5, 6);
  });

  it('G-07: override that resolves to source-equal dims keeps row in passthroughCopies', () => {
    // peak-anchored: peakScale 2.0 with 100% override → effScale = 1.0 × 2.0 = 2.0 → safeScale = 2.0 →
    // clamped to 1.0 (canonical ceiling) → outW = ceil(1000 × 1.0) = 1000 = sourceW → passthrough.
    // 100% override is functionally equivalent to no-override under peak-anchored semantics.
    const summary = makeDriftedSummaryUnified(1000, 1000, 2.0, 'KEEPROW');
    const plan = buildExportPlan(summary, new Map([['KEEPROW', 100]]));
    expect(plan.passthroughCopies, 'G-07 reverse: 100% override keeps row in passthroughCopies').toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
    expect(plan.passthroughCopies[0].outW).toBe(1000);
    expect(plan.passthroughCopies[0].outH).toBe(1000);
  });

  it('G-07: override above peak-canonical cap → cap clamps → passthrough preserved', () => {
    // Peak-anchored semantics (2026-05-05): override % means "% of peak demand".
    // Unified model: sourceW = actualSourceW = canonicalW = 670.
    // peakScale = 5.0 (extreme zoom) — every override ≥ 20% yields effScale ≥ 1.0
    // and clamps to canonical (passthrough). Need an override < 20% to escape:
    //   - No override: effScale = min(safeScale(5.0), 1) = 1.0 → outW = 670 → passthrough.
    //   - 100% override: effScale = 1.0 × 5.0 = 5.0 → clamps to 1.0 → outW = 670 → passthrough.
    //   - 10% override: effScale = 0.10 × 5.0 = 0.5 → outW = 335 → resize.
    const summary = makeDriftedSummaryUnified(670, 670, 5.0, 'CAPROW');

    // Baseline (no override): passthrough.
    const planBase = buildExportPlan(summary, new Map());
    expect(planBase.passthroughCopies).toHaveLength(1);
    expect(planBase.rows).toHaveLength(0);

    // 100% override → passthrough preserved (clamps at canonical ceiling).
    const plan100 = buildExportPlan(summary, new Map([['CAPROW', 100]]));
    expect(plan100.passthroughCopies, 'G-07 cap+override: 100% override keeps passthrough').toHaveLength(1);
    expect(plan100.rows).toHaveLength(0);

    // 10% override → effScale = 0.5 → outW = 335 ≠ 670 → resize.
    const plan10 = buildExportPlan(summary, new Map([['CAPROW', 10]]));
    expect(plan10.rows, 'G-07 cap+override: 10% override routes to resize').toHaveLength(1);
    expect(plan10.passthroughCopies).toHaveLength(0);
  });

  it('G-07: isCapped field on ExportRow is set when cap fires (downscaleClampedScale > sourceRatio)', () => {
    // Legacy shape: canonical=1628, actual=811, peakScale=0.9 → cap fires.
    // sourceRatio = min(811/1628, 962/1908) ≈ 0.498. downscaleClampedScale=0.9 > 0.498 → isCapped=true.
    // Phase 22.1 D-06: outW=811 ≠ sourceW=1628 → row goes to rows[] (resize), not passthroughCopies.
    // G-07 D-07: isCapped field must be true on the row (whether it's resize or passthrough).
    const peaks = [
      {
        attachmentKey: 'default/SLOT/DRIFTED',
        attachmentName: 'DRIFTED',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.9,
        peakScaleX: 0.9,
        peakScaleY: 0.9,
        worldW: 1465,
        worldH: 1717,
        sourceW: 1628,
        sourceH: 1908,
        sourcePath: '/fake/DRIFTED.png',
        canonicalW: 1628,
        canonicalH: 1908,
        actualSourceW: 811,
        actualSourceH: 962,
        dimsMismatch: true,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    // Phase 22.1 D-06: cap fires but outW=811 ≠ sourceW=1628 → rows[] (resize).
    expect(plan.rows).toHaveLength(1);
    expect(plan.passthroughCopies).toHaveLength(0);
    // G-07 D-07: isCapped field must be true when cap fires (regardless of which array the row is in).
    expect(plan.rows[0].isCapped).toBe(true);
  });

  it('G-07: isCapped is absent/undefined when cap does NOT fire', () => {
    // Non-drifted row (dimsMismatch:false, no actualSource) → cap inert → isCapped undefined.
    const peaks = [
      {
        attachmentKey: 'default/SLOT/NODRIFT',
        attachmentName: 'NODRIFT',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 500,
        worldH: 500,
        sourceW: 1000,
        sourceH: 1000,
        sourcePath: '/fake/NODRIFT.png',
        canonicalW: 1000,
        canonicalH: 1000,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    // isCapped must be absent (undefined) when cap doesn't fire.
    expect(plan.rows[0].isCapped).toBeUndefined();
  });

  it('G-07: uniform-scale invariant: for every emitted row, outW/sourceW ratio ≈ outH/sourceH ratio', () => {
    // Locks the user-locked Phase 6 export sizing memory: uniform single-scale,
    // never per-axis. Both rows[] and passthroughCopies[] must honor this.
    const peaks = [
      {
        attachmentKey: 'default/SLOT/DRIFT_UNI',
        attachmentName: 'DRIFT_UNI',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: 0.9,
        peakScaleX: 0.9,
        peakScaleY: 0.9,
        worldW: 1465,
        worldH: 1717,
        sourceW: 1628,
        sourceH: 1908,
        sourcePath: '/fake/DRIFT_UNI.png',
        canonicalW: 1628,
        canonicalH: 1908,
        actualSourceW: 811,
        actualSourceH: 962,
        dimsMismatch: true,
      },
    ];
    const summaryDrifted = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const plan = buildExportPlan(summaryDrifted, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    for (const row of allRows) {
      // effectiveScale is the SAME for both axes (D-110 invariant).
      // outW = ceil(sourceW × effScale), outH = ceil(sourceH × effScale).
      // Both expressions use the same effScale → uniform scaling preserved.
      const ratioW = row.outW / row.sourceW;
      const ratioH = row.outH / row.sourceH;
      // Ratios must agree within sub-pixel ceil tolerance (at most 1px deviation
      // due to Math.ceil on different axis magnitudes).
      expect(Math.abs(ratioW - ratioH)).toBeLessThan(1 / Math.min(row.sourceW, row.sourceH) + 0.001);
    }
  });
});

/**
 * Phase 29 D-04 — overrides Map keyed by regionName (not attachmentName).
 *
 * Two regression cases lock the contract:
 *   - Test 5 (THE FALSIFIED BUG, .planning/debug/path-indirected-duplicate-rows.md
 *     2026-05-07): a path-indirected region '5/7' with 3 contributing
 *     attachments. User sets overrides.set('5/7', 4 / canonicalW × 100). The
 *     resulting ExportRow for that source PNG has outW === 4 (NOT 273 — the
 *     pre-flip per-region max ignored the override because the Map was keyed
 *     by attachmentName and the contributors '5/5/5/7/7' / '5/5/7/7' were
 *     non-overridden).
 *   - Test 6 (BACKWARD COMPAT, SIMPLE_PROJECT-shaped fixture without path
 *     indirection): a single-attachment region 'CIRCLE'. overrides.set('CIRCLE',
 *     0.5 × something) produces the same result before and after the flip,
 *     because regionName === attachmentName === 'CIRCLE'.
 *
 * Both tests use synthetic fixtures (3-region path-indirected for Test 5;
 * SIMPLE_PROJECT-style single-attachment for Test 6) — Plan 29-04 commits the
 * real Chicken-Min on-disk fixture and runs the same regression at the
 * integration level.
 */
describe('buildExportPlan — Phase 29 D-04 regionName-keyed override read', () => {
  it('Test 5 (FALSIFIED BUG CLOSURE): path-indirected `5/7 → 4` override produces ExportRow.outW === 4', () => {
    // The .planning/debug/path-indirected-duplicate-rows.md repro: source PNG
    // 5/7.png has 3 contributing attachments ('5/5/5/7/7', '5/5/7/7', '5/7'),
    // each with its own peakScale. Pre-Phase-29, an override on
    // attachmentName='5/7' attached to ONE of the three; the other two
    // siblings still won the per-sourcePath dedup max via their unmodified
    // peakScale, producing outW=273 instead of the user's intended 4×4.
    //
    // Post-Phase-29 (this test): overrides.set('5/7', tinyPercent) sets the
    // regionName-keyed entry; the for-loop over summary.peaks reads
    // `overrides.get(row.regionName ?? row.attachmentName)` for EVERY
    // contributing attachment, so each one gets the same override applied,
    // and the per-sourcePath max binds to the user's intended dim.
    const canonicalW = 378;
    const canonicalH = 428;
    // 4×4 from a 378×canonicalW source on peakScale=1.0. The math chain in
    // buildExportPlan is:
    //   1. effScale = applyOverride(pct, peakScale).effectiveScale = pct/100 × 1.0
    //   2. safeScale rounds UP to nearest thousandth (Round 5 ceil-thousandth).
    //   3. outW = ceil(canonicalW × effScale).
    // pct=1.0 → applyOverride gives 0.010 exactly → safeScale(0.010) = 0.010
    //          → outW = ceil(378 × 0.010) = ceil(3.78) = 4. ✓
    // (pct=1.1 would safeScale to 0.011 → outW = ceil(4.158) = 5; the
    // 1% boundary is what produces the user's intended 4-pixel result.)
    const peakScale = 1.0;
    const overridePct = 1.0;

    const sharedSourcePath = '/fake/images/5/7.png';
    const peaks = [
      // Contributor 1 — non-overridden peakScale 1.0
      {
        attachmentKey: 'default/SLOT1/5/5/5/7/7',
        attachmentName: '5/5/5/7/7',
        regionName: '5/7',
        skinName: 'default',
        slotName: 'SLOT1',
        animationName: 'PATH',
        time: 0.5,
        frame: 30,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW,
        worldH: canonicalH,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath: sharedSourcePath,
        canonicalW,
        canonicalH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
      // Contributor 2 — also non-overridden
      {
        attachmentKey: 'default/SLOT2/5/5/7/7',
        attachmentName: '5/5/7/7',
        regionName: '5/7',
        skinName: 'default',
        slotName: 'SLOT2',
        animationName: 'PATH',
        time: 0.5,
        frame: 30,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW,
        worldH: canonicalH,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath: sharedSourcePath,
        canonicalW,
        canonicalH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
      // Contributor 3 — winning attachmentName 5/7 (matches regionName)
      {
        attachmentKey: 'default/SLOT3/5/7',
        attachmentName: '5/7',
        regionName: '5/7',
        skinName: 'default',
        slotName: 'SLOT3',
        animationName: 'PATH',
        time: 0.5,
        frame: 30,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW,
        worldH: canonicalH,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath: sharedSourcePath,
        canonicalW,
        canonicalH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    // POST-FLIP: override is keyed by regionName.
    const overrides = new Map<string, number>([['5/7', overridePct]]);
    const plan = buildExportPlan(summary, overrides);
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBe(1);
    const row = allRows[0];
    // The falsifying assertion: outW === 4 (the user's intended ~1% override
    // wins). Pre-flip this would be ceil(378 × 1.0) = 378 (one of the
    // siblings winning the per-sourcePath max) — definitively NOT 4.
    expect(row.outW).toBe(4);
    expect(row.attachmentNames.sort()).toEqual(['5/5/5/7/7', '5/5/7/7', '5/7']);
  });

  it('Test 5b (negative case): pre-flip pattern (overrides keyed by attachmentName ONLY) does NOT bind under post-flip read', () => {
    // The complement of Test 5: if a v1.3-era saved override key '5/5/7/7'
    // (a contributor name, not the regionName) reaches buildExportPlan
    // unmigrated, it does NOT bind. The migration helper at the project-io.ts
    // seam translates the key BEFORE buildExportPlan runs (Plan 29-03 Task 1);
    // export.ts itself reads only the regionName side of the Map.
    const canonicalW = 378;
    const canonicalH = 428;
    const peakScale = 1.0;

    const sharedSourcePath = '/fake/images/5/7.png';
    const peaks = [
      {
        attachmentKey: 'default/SLOT/5/5/7/7',
        attachmentName: '5/5/7/7',
        regionName: '5/7',
        skinName: 'default',
        slotName: 'SLOT',
        animationName: 'PATH',
        time: 0,
        frame: 0,
        peakScale,
        peakScaleX: peakScale,
        peakScaleY: peakScale,
        worldW: canonicalW,
        worldH: canonicalH,
        sourceW: canonicalW,
        sourceH: canonicalH,
        sourcePath: sharedSourcePath,
        canonicalW,
        canonicalH,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    // BAD-INPUT: override keyed by attachmentName (the unmigrated v1.3-era
    // shape). Post-flip, export.ts reads `row.regionName ?? row.attachmentName`
    // — regionName is '5/7', so this key does NOT bind, and the row exports
    // at peakScale (== 1.0 → passthrough at sourceW).
    const overrides = new Map<string, number>([['5/5/7/7', 1]]);
    const plan = buildExportPlan(summary, overrides);
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBe(1);
    const row = allRows[0];
    // outW === sourceW → passthrough (no override bound).
    expect(row.outW).toBe(canonicalW);
  });

  it('Test 6 (BACKWARD COMPAT): SIMPLE_PROJECT-shape fixture (regionName === attachmentName) — CIRCLE 25% override unchanged', () => {
    // Pre-flip + post-flip produce the same result on non-indirected fixtures
    // because regionName === attachmentName. CIRCLE peakScale 0.8, override
    // 25% → effScale = 0.25 × 0.8 = 0.2 → outW = ceil(699 × 0.2) = 140.
    const peaks = [
      {
        attachmentKey: 'default/CIRCLE/CIRCLE',
        attachmentName: 'CIRCLE',
        regionName: 'CIRCLE', // matches attachmentName — non-indirected
        skinName: 'default',
        slotName: 'CIRCLE',
        animationName: 'PATH',
        time: 0.5,
        frame: 30,
        peakScale: 0.8,
        peakScaleX: 0.8,
        peakScaleY: 0.8,
        worldW: 559,
        worldH: 559,
        sourceW: 699,
        sourceH: 699,
        sourcePath: '/fake/CIRCLE.png',
        canonicalW: 699,
        canonicalH: 699,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const overrides = new Map<string, number>([['CIRCLE', 25]]);
    const plan = buildExportPlan(summary, overrides);
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBe(1);
    const row = allRows[0];
    // effScale = safeScale(0.25 × 0.8) = ceil(0.2 × 1000) / 1000 = 0.2
    expect(row.effectiveScale).toBeCloseTo(0.2, 6);
    expect(row.outW).toBe(Math.ceil(699 * 0.2)); // 140
    expect(row.outH).toBe(Math.ceil(699 * 0.2));
  });
});

describe('buildExportPlan — Phase 35 multi-skin region-keyed iteration (DEDUP-04/05)', () => {
  // These tests lock the Phase 35 fix: buildExportPlan iterates summary.regions
  // (region-keyed) instead of summary.peaks (attachment-name-deduped). Without
  // them, a future refactor could silently regress N regions sharing K < N
  // attachment names back to K ExportRows.
  //
  // Test 1 — synthetic multi-skin: 4 regions, 2 unique attachment names → 4 rows
  // Test 2 — synthetic per-region override: WARNING 3 explicit effScale binding
  // Test 3 — synthetic single-skin backward-compat (regionName === attachmentName)

  // Shared synthetic fixture for Tests 1 + 2 — 4 regions, 2 unique attachment
  // names (CARDS_L_HAND_1 and BODY), 4 skin-namespaced regionNames. Mirrors the
  // real-world SKINS fixture (AVATAR/BUSINESS variants sharing one base name).
  function makePhase35MultiSkinPeaks() {
    return [
      {
        attachmentKey: 'AVATAR/SLOT_CARDS/CARDS_L_HAND_1',
        attachmentName: 'CARDS_L_HAND_1',
        regionName: 'AVATAR/CARDS_L_HAND_1',
        skinName: 'AVATAR',
        slotName: 'SLOT_CARDS',
        animationName: 'TEST',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 50,
        worldH: 50,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/images/AVATAR/CARDS_L_HAND_1.png',
        canonicalW: 100,
        canonicalH: 100,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
      {
        attachmentKey: 'BUSINESS/SLOT_CARDS/CARDS_L_HAND_1',
        attachmentName: 'CARDS_L_HAND_1',
        regionName: 'BUSINESS/CARDS_L_HAND_1',
        skinName: 'BUSINESS',
        slotName: 'SLOT_CARDS',
        animationName: 'TEST',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 50,
        worldH: 50,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/images/BUSINESS/CARDS_L_HAND_1.png',
        canonicalW: 100,
        canonicalH: 100,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
      {
        attachmentKey: 'AVATAR/SLOT_BODY/BODY',
        attachmentName: 'BODY',
        regionName: 'AVATAR/BODY',
        skinName: 'AVATAR',
        slotName: 'SLOT_BODY',
        animationName: 'TEST',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 50,
        worldH: 50,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/images/AVATAR/BODY.png',
        canonicalW: 100,
        canonicalH: 100,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
      {
        attachmentKey: 'BUSINESS/SLOT_BODY/BODY',
        attachmentName: 'BODY',
        regionName: 'BUSINESS/BODY',
        skinName: 'BUSINESS',
        slotName: 'SLOT_BODY',
        animationName: 'TEST',
        time: 0,
        frame: 0,
        peakScale: 0.5,
        peakScaleX: 0.5,
        peakScaleY: 0.5,
        worldW: 50,
        worldH: 50,
        sourceW: 100,
        sourceH: 100,
        sourcePath: '/fake/images/BUSINESS/BODY.png',
        canonicalW: 100,
        canonicalH: 100,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
    ];
  }

  it('Test 1 — multi-skin: 4 regions sharing 2 unique attachment names → 4 ExportRows (NOT 2) (success criterion #1)', () => {
    // The pre-Phase-35 bug: buildExportPlan iterated summary.peaks (which is
    // attachment-name-deduped — would collapse 4 regions sharing 2 base
    // attachment names down to 2 DisplayRows), producing 2 ExportRows instead
    // of 4. Post-Phase-35 it iterates summary.regions and emits one ExportRow
    // per unique regionName.
    const peaks = makePhase35MultiSkinPeaks();
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const plan = buildExportPlan(summary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];

    // The cardinality lock: 4 region-keyed entries (not 2 attachment-name-deduped).
    expect(allRows.length).toBe(4);

    // Each region produces a distinct sourcePath.
    const sortedPaths = allRows.map((r) => r.sourcePath).sort();
    expect(sortedPaths).toEqual([
      '/fake/images/AVATAR/BODY.png',
      '/fake/images/AVATAR/CARDS_L_HAND_1.png',
      '/fake/images/BUSINESS/BODY.png',
      '/fake/images/BUSINESS/CARDS_L_HAND_1.png',
    ]);

    // Each ExportRow.attachmentNames is a length-1 array containing the matching
    // base attachmentName (CARDS_L_HAND_1 or BODY). Confirms the
    // `region.contributingAttachments.map(c => c.attachmentName)` accumulator
    // wired through correctly post-migration.
    for (const row of allRows) {
      expect(row.attachmentNames.length).toBe(1);
      if (row.sourcePath.endsWith('CARDS_L_HAND_1.png')) {
        expect(row.attachmentNames[0]).toBe('CARDS_L_HAND_1');
      } else {
        expect(row.attachmentNames[0]).toBe('BODY');
      }
    }
  });

  it('Test 2 — per-region override binds only the AVATAR variant via regionName key (Phase 29 D-04 preserved; WARNING 3 explicit-effScale)', () => {
    // WARNING 3 explicit effScale assertions: lock the override-per-region
    // binding at the math-chain level, not just at the outW level. If the
    // override were accidentally keyed by attachmentName ('CARDS_L_HAND_1'),
    // BOTH AVATAR + BUSINESS rows would carry the same effScale; keying by
    // regionName ('AVATAR/CARDS_L_HAND_1') means only the AVATAR variant
    // shifts to effScale 0.25 while the BUSINESS sibling stays at 0.5.
    const peaks = makePhase35MultiSkinPeaks();
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    // 50% override on the AVATAR variant only.
    const overrides = new Map<string, number>([
      ['AVATAR/CARDS_L_HAND_1', 50],
    ]);
    const plan = buildExportPlan(summary, overrides);
    const allRows = [...plan.rows, ...plan.passthroughCopies];

    // Cardinality unchanged — overrides don't change row count.
    expect(allRows.length).toBe(4);

    // 50% override × peakScale 0.5 = effScale 0.25 on AVATAR/CARDS_L_HAND_1.
    // safeScale(0.25) === 0.25 exactly (clean multiple of 1/1000).
    const avatarCards = allRows.find((r) =>
      r.sourcePath.endsWith('AVATAR/CARDS_L_HAND_1.png'),
    );
    expect(avatarCards).toBeDefined();
    expect(avatarCards!.effectiveScale).toBeCloseTo(0.25, 6);
    expect(avatarCards!.outW).toBe(25); // ceil(100 × 0.25) = 25
    expect(avatarCards!.outH).toBe(25);

    // BUSINESS/CARDS_L_HAND_1 — NOT in the overrides Map → effScale = peakScale = 0.5.
    const businessCards = allRows.find((r) =>
      r.sourcePath.endsWith('BUSINESS/CARDS_L_HAND_1.png'),
    );
    expect(businessCards).toBeDefined();
    expect(businessCards!.effectiveScale).toBeCloseTo(0.5, 6);
    expect(businessCards!.outW).toBe(50); // ceil(100 × 0.5) = 50
    expect(businessCards!.outH).toBe(50);

    // Falsifying property: distinct effScale values prove the override key is
    // regionName, not attachmentName. If keyed by attachmentName, BOTH
    // CARDS_L_HAND_1 rows would have the same effScale.
    expect(avatarCards!.effectiveScale).not.toBeCloseTo(
      businessCards!.effectiveScale,
      6,
    );

    // BODY rows untouched — no override on either regionName.
    const avatarBody = allRows.find((r) =>
      r.sourcePath.endsWith('AVATAR/BODY.png'),
    );
    const businessBody = allRows.find((r) =>
      r.sourcePath.endsWith('BUSINESS/BODY.png'),
    );
    expect(avatarBody!.effectiveScale).toBeCloseTo(0.5, 6);
    expect(businessBody!.effectiveScale).toBeCloseTo(0.5, 6);
  });

  it('Test 3 — backward-compat: single-skin synthetic (regionName === attachmentName, contributors.length === 1) → 3 ExportRows identical to pre-Phase-35 shape', () => {
    // SIMPLE_PROJECT-shaped synthetic input: 3 regions where regionName ===
    // attachmentName for each. Pre-Phase-35 and post-Phase-35 produce the same
    // output count + shape on non-indirected fixtures. Locks success criterion
    // #5: existing fixtures continue to produce identical export plans.
    const canonical = 200;
    const peak = 0.7;
    const peaks = [
      {
        attachmentKey: 'default/CIRCLE/CIRCLE',
        attachmentName: 'CIRCLE',
        regionName: 'CIRCLE',
        skinName: 'default',
        slotName: 'CIRCLE',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: peak,
        peakScaleX: peak,
        peakScaleY: peak,
        worldW: canonical * peak,
        worldH: canonical * peak,
        sourceW: canonical,
        sourceH: canonical,
        sourcePath: '/fake/CIRCLE.png',
        canonicalW: canonical,
        canonicalH: canonical,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
      {
        attachmentKey: 'default/SQUARE/SQUARE',
        attachmentName: 'SQUARE',
        regionName: 'SQUARE',
        skinName: 'default',
        slotName: 'SQUARE',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: peak,
        peakScaleX: peak,
        peakScaleY: peak,
        worldW: canonical * peak,
        worldH: canonical * peak,
        sourceW: canonical,
        sourceH: canonical,
        sourcePath: '/fake/SQUARE.png',
        canonicalW: canonical,
        canonicalH: canonical,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
      {
        attachmentKey: 'default/TRIANGLE/TRIANGLE',
        attachmentName: 'TRIANGLE',
        regionName: 'TRIANGLE',
        skinName: 'default',
        slotName: 'TRIANGLE',
        animationName: 'idle',
        time: 0,
        frame: 0,
        peakScale: peak,
        peakScaleX: peak,
        peakScaleY: peak,
        worldW: canonical * peak,
        worldH: canonical * peak,
        sourceW: canonical,
        sourceH: canonical,
        sourcePath: '/fake/TRIANGLE.png',
        canonicalW: canonical,
        canonicalH: canonical,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        isSetupPosePeak: false,
      },
    ];
    const summary = {
      peaks,
      regions: synthRegionsFromPeaks(peaks),
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const plan = buildExportPlan(summary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];

    // Single-skin cardinality matches both region count AND attachment count
    // (they're equal in non-indirected fixtures).
    expect(allRows.length).toBe(3);

    // attachmentNames must be a length-1 array matching the (regionName ===
    // attachmentName) for each row. This matches the pre-Phase-35 shape where
    // attachmentNames was `[row.attachmentName]`.
    const byPath = new Map(allRows.map((r) => [r.sourcePath, r] as const));
    expect(byPath.get('/fake/CIRCLE.png')!.attachmentNames).toEqual(['CIRCLE']);
    expect(byPath.get('/fake/SQUARE.png')!.attachmentNames).toEqual(['SQUARE']);
    expect(byPath.get('/fake/TRIANGLE.png')!.attachmentNames).toEqual(['TRIANGLE']);

    // outW = Math.ceil(200 × safeScale(0.7)) = ceil(200 × 0.7) = 140 each.
    // safeScale(0.7) === 0.7 exactly (clean multiple of 1/1000).
    for (const row of allRows) {
      expect(row.effectiveScale).toBeCloseTo(0.7, 6);
      expect(row.outW).toBe(140);
      expect(row.outH).toBe(140);
    }
  });

  it('Test 4 — fixtures/SKINS/JOKERMAN_SPINE.json (7 skins, 160 regions) → buildExportPlan returns 160 total entries (success criterion #1 from ROADMAP)', () => {
    // Defensive skip: this fixture lives in-tree at fixtures/SKINS/. If it's
    // somehow missing (CI shallow-clone misconfiguration, future gitignore
    // edit), skip with a clear message rather than failing opaquely.
    const jsonPath = path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json');
    if (!existsSync(jsonPath)) {
      console.warn(`Skipping: fixture missing at ${jsonPath}`);
      return;
    }

    // BLOCKER 2 fix — inline the EXACT helper from tests/core/atlas-preview.spec.ts:56-77.
    // DO NOT import `buildSummary` from src/main/summary.ts — that function:
    //   (a) imports node:fs and node:path (Layer 3 — main process only)
    //   (b) has the wrong signature: buildSummary(load, sampled, elapsedMs) — takes
    //       PRE-PROCESSED LoadResult + SamplerOutput, not a raw jsonPath.
    //   (c) is forbidden in tests/core/ by the strict layering convention.
    const load = loadSkeleton(jsonPath);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const peaksWithPath = peaks.map((r) => ({
      ...r,
      sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
    }));
    const sourcePaths = new Map<string, string>();
    for (const p of sampled.globalPeaks.values()) {
      const regionName = p.regionName ?? p.attachmentName;
      sourcePaths.set(regionName, '/fake/' + regionName + '.png');
    }
    const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
    const summary = {
      peaks: peaksWithPath,
      regions,
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    // Lock the pre-Phase-35 baseline that's already covered by Phase 29:
    // summary.regions.length === 160 (one row per unique regionName in the atlas).
    expect(summary.regions.length).toBe(160);

    // The Phase 35 contract: buildExportPlan produces ONE ExportRow per region.
    // Locks ROADMAP success criterion #1 (modal header 160; downstream of
    // plan.rows.length + plan.passthroughCopies.length).
    const plan = buildExportPlan(summary, new Map(), undefined);
    const totalRows = plan.rows.length + plan.passthroughCopies.length;
    expect(totalRows).toBe(160);

    // Spot-check: the skin-namespaced CARDS_L_HAND_1 regions all appear as
    // distinct ExportRows. This is success criterion #2 from the ROADMAP at the
    // ExportRow level (the OptimizeDialog body row list is downstream of this).
    const allSourcePaths = [...plan.rows, ...plan.passthroughCopies].map(
      (r) => r.sourcePath,
    );
    const cardsLHand1Paths = allSourcePaths.filter((p) =>
      p.includes('CARDS_L_HAND_1'),
    );
    // At minimum one per skin that declares this region. JOKERMAN_SPINE.atlas
    // has AVATAR/CARDS_L_HAND_1, BUSINESS/CARDS_L_HAND_1, IRONMAN/CARDS_L_HAND_1,
    // JOKER/CARDS_L_HAND_1 (4 skins declare it). Assert at least 4 ExportRows
    // mention CARDS_L_HAND_1 in their sourcePath.
    expect(cardsLHand1Paths.length).toBeGreaterThanOrEqual(4);
  });

  it('Test 5 — atlas-less fixture (BLOCKER 3 fix: loaderMode separation invariant) → buildExportPlan is mode-agnostic; row count === summary.regions.length', () => {
    // Atlas-less fixture per memory `project_strict_loadermode_separation.md`:
    // each region's image lives at a per-region disk path under images/, no .atlas
    // file. The buildExportPlan migration should be loaderMode-invariant — atlas-less
    // summaries also produce region-keyed plans now. This test codifies that
    // invariant in CI (previously only covered by manual UAT in Plan 03 Task 2 step 12).
    const jsonPath = path.resolve(
      'fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/MeshOnly_TEST.json',
    );
    if (!existsSync(jsonPath)) {
      console.warn(`Skipping: fixture missing at ${jsonPath}`);
      return;
    }

    // Inline loader helper (same as Test 4 — copy-paste, do NOT factor into a
    // shared helper this round; that's a future refactor and would expand this
    // plan's scope).
    const load = loadSkeleton(jsonPath);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const peaksWithPath = peaks.map((r) => ({
      ...r,
      sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
    }));
    const sourcePaths = new Map<string, string>();
    for (const p of sampled.globalPeaks.values()) {
      const regionName = p.regionName ?? p.attachmentName;
      sourcePaths.set(regionName, '/fake/' + regionName + '.png');
    }
    const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
    const summary = {
      peaks: peaksWithPath,
      regions,
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    // The contract: buildExportPlan emits one ExportRow per region regardless of
    // loader mode. Atlas-less summaries have regions populated by analyzeRegions
    // identically to atlas-source — the iteration source in buildExportPlan
    // doesn't branch on mode.
    const plan = buildExportPlan(summary, new Map(), undefined);
    const totalRows = plan.rows.length + plan.passthroughCopies.length;
    expect(totalRows).toBe(summary.regions.length);

    // Atlas-less fixtures don't share regions across attachments (each attachment
    // has its own per-region file path, no skin-namespacing collapsing happens
    // because there's no .atlas region table to namespace from). Each ExportRow's
    // attachmentNames array should be length 1.
    for (const row of [...plan.rows, ...plan.passthroughCopies]) {
      expect(row.attachmentNames.length).toBe(1);
    }
  });
});

