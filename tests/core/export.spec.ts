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
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';
import { findUnusedAttachments } from '../../src/core/usage.js';
// RED import — Plan 06-03 introduces buildExportPlan in src/core/export.ts.
import { buildExportPlan } from '../../src/core/export.js';
// Plan 06-02 introduces these types in src/shared/types.ts.
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const FIXTURE_EXPORT = path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json');
const EXPORT_SRC = path.resolve('src/core/export.ts');

describe('buildExportPlan — case (a) baseline (D-108, D-110, D-111)', () => {
  it('SIMPLE_TEST → 3 ExportRows (rows + passthroughCopies combined) with dims = Math.ceil(sourceW × effScale) (Round 5 ceil)', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    // Plan 06-02 will add `sourcePath: string` to DisplayRow; until then we
    // synthesize a stub path so the export builder has a dedup key.
    const summary: Pick<SkeletonSummary, 'peaks' | 'unusedAttachments'> = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + r.attachmentName + '.png',
      })),
      unusedAttachments: findUnusedAttachments(load, sampled),
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

describe('buildExportPlan — case (b) override 50% on TRIANGLE (D-111)', () => {
  it('override 50% → out dims = Math.ceil(sourceW × 0.5) (Round 5 ceil)', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const summary: Pick<SkeletonSummary, 'peaks' | 'unusedAttachments'> = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + r.attachmentName + '.png',
      })),
      unusedAttachments: findUnusedAttachments(load, sampled),
    };
    const overrides = new Map<string, number>([['TRIANGLE', 50]]);
    const plan: ExportPlan = buildExportPlan(summary as SkeletonSummary, overrides);
    const triRow = plan.rows.find((r) => r.attachmentNames.includes('TRIANGLE'));
    expect(triRow).toBeDefined();
    if (triRow) {
      // 0.5 × 1000 = 500 → ceil = 500 → /1000 = 0.5; clamp ≤ 1 unchanged.
      expect(triRow.effectiveScale).toBeCloseTo(0.5, 6);
      expect(triRow.outW).toBe(Math.ceil(triRow.sourceW * 0.5));
      expect(triRow.outH).toBe(Math.ceil(triRow.sourceH * 0.5));
    }
  });
});

describe('buildExportPlan — case (c) override 200% on SQUARE clamps (D-111, Phase 4 D-91)', () => {
  it('override 200% → applyOverride clamps to 100% → out dims = source dims', () => {
    // Synthetic SkeletonSummary — sidesteps fixture variability so the test
    // locks the clamp contract precisely.
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const overrides = new Map<string, number>([['SQUARE', 200]]);
    const plan: ExportPlan = buildExportPlan(summary, overrides);
    // Phase 22.1 D-06: 200% override clamps to 100% → effectiveScale=1.0 → outW=sourceW=1000 → passthroughCopies.
    expect(plan.rows.length).toBe(0);
    expect(plan.passthroughCopies.length).toBe(1);
    const row = plan.passthroughCopies[0];
    // Phase 4 D-91 + clampOverride: 200 clamps to 100 → effectiveScale = 1.0
    expect(row.effectiveScale).toBeCloseTo(1.0, 6);
    expect(row.outW).toBe(1000);
    expect(row.outH).toBe(1000);
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
            w: 1746,
            h: 1918,
            rotated: false,
          },
        },
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows.length).toBe(1);
    expect(plan.rows[0].atlasSource).toEqual({
      pagePath: '/fake/JOKERMAN_SPINE.png',
      x: 778,
      y: 2,
      w: 1746,
      h: 1918,
      rotated: false,
    });
  });

  it('ExportRow.atlasSource is undefined when DisplayRow has no atlasSource', () => {
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows[0].atlasSource).toBeUndefined();
  });
});

describe('buildExportPlan — case (e) ghost fixture (D-109)', () => {
  it('summary.unusedAttachments listing GHOST → ExportPlan.rows excludes GHOST; ExportPlan.excludedUnused includes "GHOST"', () => {
    const load = loadSkeleton(FIXTURE_GHOST);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const unused = findUnusedAttachments(load, sampled);
    expect(unused.some((u) => u.attachmentName === 'GHOST')).toBe(true);
    const summary = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + r.attachmentName + '.png',
      })),
      unusedAttachments: unused,
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.rows.find((r) => r.attachmentNames.includes('GHOST'))).toBeUndefined();
    expect(plan.excludedUnused).toContain('GHOST');
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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

  it('both files share the same Math.ceil uniform sizing pattern (Round 5 — ceil replaces round)', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /Math\.ceil\([^)]*sourceW\s*\*/;
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
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const unused = findUnusedAttachments(load, sampled);
    const summary = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + r.attachmentName + '.png',
      })),
      unusedAttachments: unused,
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

    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    // predicate has been replaced with the simpler `outW === acc.row.sourceW && outH === acc.row.sourceH`
    // evaluated in the emit loop (post-cap, post-override-resolution). Verify
    // the new predicate is present in both canonical + renderer copies.
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /isPassthrough\s*=\s*outW\s*===\s*acc\.row\.sourceW\s*&&\s*outH\s*===\s*acc\.row\.sourceH/;
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    return {
      peaks: [
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
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
  }

  // Helper: synthesize a non-drifted summary (no actualSource → no cap).
  function makeNonDriftedSummary(canonicalW: number, canonicalH: number, peakScale: number): SkeletonSummary {
    return {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(2);         // A (drifted resize) + B (normal resize)
    expect(plan.passthroughCopies).toHaveLength(1);  // C (full-size, no resize needed)
    expect(plan.totals.count).toBe(plan.rows.length + plan.passthroughCopies.length);
    expect(plan.totals.count).toBe(3);
  });

  it('rows[] sorted deterministically by sourcePath localeCompare (was: passthroughCopies sorted)', () => {
    // Phase 22.1 D-06: drifted rows (peakScale=0.9, sourceRatio=0.5, outW=500 ≠ 1000=sourceW)
    // now go to rows[] (resize), not passthroughCopies[]. Sort invariant still holds.
    const summary = {
      peaks: [
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
          actualSourceW: 500,
          actualSourceH: 500,
          dimsMismatch: true,
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
          actualSourceW: 500,
          actualSourceH: 500,
          dimsMismatch: true,
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
          actualSourceW: 500,
          actualSourceH: 500,
          dimsMismatch: true,
        },
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    // Phase 22.1 D-06: these drifted rows are now resize rows (outW=500 ≠ sourceW=1000).
    const paths = plan.rows.map((r) => r.sourcePath);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
    expect(paths).toEqual(['/fake/A.png', '/fake/M.png', '/fake/Z.png']);
    expect(plan.passthroughCopies).toHaveLength(0);
  });

  it('CHECKER FIX 2026-05-02 — passthrough ExportRow carries actualSourceW + actualSourceH from DisplayRow', () => {
    // Phase 22.1 D-06: passthrough now requires outW === sourceW.
    // Use unified model: sourceW=actualSourceW=811, peakScale=1.0 (full-size attach) →
    // effScale=1.0 → outW=811=sourceW → passthroughCopies.
    // actualSourceW/H are threaded to ExportRow for OptimizeDialog dim label.
    const summary = {
      peaks: [
        {
          attachmentKey: 'default/SLOT/UNIFIED_DRIFTED',
          attachmentName: 'UNIFIED_DRIFTED',
          skinName: 'default',
          slotName: 'SLOT',
          animationName: 'idle',
          time: 0,
          frame: 0,
          peakScale: 1.0,  // full-size → effScale=1.0 → outW=sourceW
          peakScaleX: 1.0,
          peakScaleY: 1.0,
          worldW: 811,
          worldH: 962,
          sourceW: 811,   // unified: sourceW === actualSourceW
          sourceH: 962,
          sourcePath: '/fake/UNIFIED.png',
          canonicalW: 1628,
          canonicalH: 1908,
          actualSourceW: 811,  // from atlas originalWidth (22.1-01 G-01)
          actualSourceH: 962,
          dimsMismatch: true,  // 811 ≠ 1628
        },
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    // peakScale=1.0 → effScale=min(1.0, sourceRatio=811/1628)=0.498 — wait, cap fires!
    // outW = ceil(811 × 0.498) = 404 ≠ 811. Hmm.
    // The cap fires because peakScale(1.0) > sourceRatio(811/1628≈0.498).
    // For a true passthrough in the unified model with drift, need peakScale ≤ sourceRatio.
    // With peakScale=0.4 < sourceRatio=0.498: effScale=0.4, outW=ceil(811×0.4)=325 ≠ 811.
    // → passthrough requires effScale=1.0 → requires sourceRatio=1.0 → no drift.
    //
    // For passthrough in drifted unified model: need sourceW=actualSourceW AND no cap firing.
    // Cap fires when peakScale > sourceRatio = actualSourceW/canonicalW.
    // If peakScale=5.0 (clamps to 1.0), cap fires. outW = ceil(811×sourceRatio) ≠ 811.
    //
    // Conclusion: with drifted unified shape, passthrough NEVER occurs because
    // outW = ceil(sourceW × sourceRatio) ≠ sourceW (sourceRatio < 1.0 for drifted rows).
    // passthrough ONLY occurs for non-drifted rows with peakScale≥1.0.
    //
    // Redesign: use non-drifted row with dimsMismatch=false + actualSource set
    // (covers the "actualSource fields carried to passthrough row" invariant).
    // Actually: passthrough rows have actualSourceW/H only when explicitly set.
    // The test was about OptimizeDialog seeing actual dims. Use G-04 TRIANGLE-style
    // but with actualSource set (simulating unified atlas-source mode, no drift).
    const nonDriftedSummary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    return {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    return {
      peaks: [
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
      ],
      unusedAttachments: [],
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

  it('G-07: 50% override on a drifted-but-unified passthrough row re-routes to rows[] as resize', () => {
    // Unified model: sourceW === actualSourceW === canonicalW = 1000.
    // No override: peakScale = 0.9 → effScale = 0.9 → outW = ceil(1000 × 0.9) = 900 ≠ 1000
    // Wait — with peakScale=0.9, outW would be 900 ≠ 1000, so it goes to rows[].
    // We need a case where WITHOUT override the row is passthrough:
    //   → peakScale >= 1.0 (clamps to 1.0) → outW = sourceW → passthrough
    //   → 50% override → outW = ceil(1000 × 0.5) = 500 ≠ 1000 → resize
    // Use peakScale=2.0 (clamps to 1.0) as the "no override → passthrough" baseline.
    //
    // Without override: effScale = min(safeScale(2.0), 1) = 1.0 → outW = 1000 = sourceW → passthrough.
    // With 50% override: applyOverride(50).effectiveScale = 0.5 → effScale = 0.5 → outW = 500 → resize.
    //
    // G-07 BLOCKER: the override takes the row OUT of passthroughCopies INTO rows[].
    const summary = makeDriftedSummaryUnified(1000, 1000, 2.0, 'BIGROW');

    // Baseline: no override → passthrough (peakScale 2.0 clamps to 1.0 → outW = sourceW).
    const planNoOverride = buildExportPlan(summary, new Map());
    expect(planNoOverride.passthroughCopies).toHaveLength(1);
    expect(planNoOverride.rows).toHaveLength(0);

    // 50% override → outW = 500 ≠ sourceW → re-routes to rows[].
    const plan50 = buildExportPlan(summary, new Map([['BIGROW', 50]]));
    expect(plan50.rows, 'G-07: 50% override must route to rows[]').toHaveLength(1);
    expect(plan50.passthroughCopies, 'G-07: 50% override must leave passthroughCopies empty').toHaveLength(0);
    const resizedRow = plan50.rows[0];
    expect(resizedRow.outW).toBe(Math.ceil(1000 * 0.5)); // 500
    expect(resizedRow.outH).toBe(Math.ceil(1000 * 0.5)); // 500
    expect(resizedRow.effectiveScale).toBeCloseTo(0.5, 6);
  });

  it('G-07: override that resolves to source-equal dims keeps row in passthroughCopies', () => {
    // peakScale 2.0 (clamps to 1.0). 100% override → applyOverride(100) = 1.0 → outW = 1000 = sourceW → passthrough.
    const summary = makeDriftedSummaryUnified(1000, 1000, 2.0, 'KEEPROW');
    const plan = buildExportPlan(summary, new Map([['KEEPROW', 100]]));
    expect(plan.passthroughCopies, 'G-07 reverse: 100% override keeps row in passthroughCopies').toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
    expect(plan.passthroughCopies[0].outW).toBe(1000);
    expect(plan.passthroughCopies[0].outH).toBe(1000);
  });

  it('G-07: override above source-ratio cap → cap clamps → passthrough preserved', () => {
    // Pre-unification scenario to test the cap math path:
    // canonical=1628, actual=811 → sourceRatio ≈ 0.498.
    // 100% override → downscaleClampedScale = 1.0 → cap clamps to 0.498 →
    // outW = ceil(1628 × 0.498) = 811 = actualSourceW (binding axis) = sourceW? No—
    // after 22.1-01 unified model: sourceW === actualSourceW = 811 (loader populates
    // sourceW from atlas region orig). So ceil(811 × 0.498) ≈ 404 ≠ 811.
    // To test the old "cap fires → passthrough" path, use dimsMismatch=true with
    // actualSourceW < sourceW (legacy shape before unification):
    // canonical/sourceW=1628, actual=811; peakScale=0.7.
    // WITHOUT override: sourceRatio=811/1628≈0.498; effScale=min(0.7,0.498)=0.498;
    //   outW=ceil(1628×0.498)=811=actualSourceW → is 811 === sourceW(1628)? NO → rows.
    // Hmm — the legacy shape has sourceW=canonicalW=1628, actualSourceW=811.
    // After restructure: outW=ceil(1628 × cappedEffScale).
    // The isPassthrough = (outW === sourceW AND outH === sourceH) uses sourceW=1628.
    // ceil(1628 × 0.498) = 811 ≠ 1628 → NOT passthrough.
    //
    // So the legacy drifted shape always goes to rows[] under the new predicate
    // (since outW = actualSourceW ≈ 811 ≠ sourceW = 1628).
    //
    // The real G-07 scenario is the UNIFIED model (sourceW=actualSourceW=811):
    // Then outW = ceil(811 × 1.0) = 811 = sourceW → passthrough.
    // Already covered by the 100% override test above.
    //
    // For explicit cap-fires scenario we use unified model with high peakScale:
    // sourceW = actualSourceW = 670, canonicalW = 670 (unified).
    // No override; peakScale 5.0 → clamps to 1.0 → outW = 670 = sourceW → passthrough.
    // With 100% override: same → passthrough. With 50%: outW=335 → resize.
    const summary = makeDriftedSummaryUnified(670, 670, 5.0, 'CAPROW');

    // Baseline (no override): passthrough.
    const planBase = buildExportPlan(summary, new Map());
    expect(planBase.passthroughCopies).toHaveLength(1);
    expect(planBase.rows).toHaveLength(0);

    // 100% override → passthrough preserved.
    const plan100 = buildExportPlan(summary, new Map([['CAPROW', 100]]));
    expect(plan100.passthroughCopies, 'G-07 cap+override: 100% override keeps passthrough').toHaveLength(1);
    expect(plan100.rows).toHaveLength(0);

    // 50% override → resize.
    const plan50 = buildExportPlan(summary, new Map([['CAPROW', 50]]));
    expect(plan50.rows, 'G-07 cap+override: 50% override routes to resize').toHaveLength(1);
    expect(plan50.passthroughCopies).toHaveLength(0);
  });

  it('G-07: isCapped field on ExportRow is set when cap fires (downscaleClampedScale > sourceRatio)', () => {
    // Legacy shape: canonical=1628, actual=811, peakScale=0.9 → cap fires.
    // sourceRatio = min(811/1628, 962/1908) ≈ 0.498. downscaleClampedScale=0.9 > 0.498 → isCapped=true.
    // Phase 22.1 D-06: outW=811 ≠ sourceW=1628 → row goes to rows[] (resize), not passthroughCopies.
    // G-07 D-07: isCapped field must be true on the row (whether it's resize or passthrough).
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
    const summary = {
      peaks: [
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
      ],
      unusedAttachments: [],
    } as unknown as SkeletonSummary;
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    // isCapped must be absent (undefined) when cap doesn't fire.
    expect(plan.rows[0].isCapped).toBeUndefined();
  });

  it('G-07: uniform-scale invariant: for every emitted row, outW/sourceW ratio ≈ outH/sourceH ratio', () => {
    // Locks the user-locked Phase 6 export sizing memory: uniform single-scale,
    // never per-axis. Both rows[] and passthroughCopies[] must honor this.
    const summaryDrifted = {
      peaks: [
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
      ],
      unusedAttachments: [],
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
