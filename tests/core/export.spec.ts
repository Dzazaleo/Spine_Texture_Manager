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
  it('SIMPLE_TEST → 3 ExportRows with effective scale = peakScale, dims = Math.ceil(sourceW × effScale) (Round 5 ceil)', () => {
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
    // Post-Plan 02-03 dedup-by-attachmentName: 3 unique names
    // (CIRCLE, SQUARE, TRIANGLE — the two SQUARE-named attachments fold into one).
    expect(plan.rows.length).toBe(3);
    for (const row of plan.rows) {
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
    expect(plan.rows.length).toBe(1);
    const row = plan.rows[0];
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
    expect(plan.rows.length).toBe(1);
    const row = plan.rows[0];
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
    expect(plan.rows[0].effectiveScale).toBeCloseTo(1.0, 6);
    expect(plan.rows[0].outW).toBe(200);
    expect(plan.rows[0].outH).toBe(200);
  });

  it('Gap-Fix #1 dedup interaction: two attachments share source PNG with peaks 0.8 and 5.0 → both clamp to 1.0; kept dims = sourceW (NOT 5×)', () => {
    // The clamp must run BEFORE the dedup keep-max comparison. Otherwise
    // the dedup would promote the 5.0-row to "winner" and emit an upscaled
    // ExportRow. With the clamp running first, max(0.8, 1.0) = 1.0 → outW
    // = sourceW.
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
    expect(plan.rows.length).toBe(1);
    expect(plan.rows[0].effectiveScale).toBeCloseTo(1.0, 6);
    expect(plan.rows[0].outW).toBe(100);
    expect(plan.rows[0].outH).toBe(100);
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
    // Both must agree on the clamped output dims (NOT 150).
    expect(corePlan.rows[0].outW).toBe(100);
    expect(corePlan.rows[0].outH).toBe(100);
    expect(viewPlan.rows[0].outW).toBe(100);
    expect(viewPlan.rows[0].outH).toBe(100);
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

  it('Phase 22 D-04 REVISED isPassthrough predicate in BOTH files', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /isCapped\s*\|\|\s*peakAlreadyAtOrBelowSource/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });

  it('Phase 22 behavioral parity: drifted row produces IDENTICAL passthroughCopies in both files', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;
    // canonical 1628×1908, actual 811×962, peakScale 0.7 — cap binds (X axis).
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
    expect(viewPlan.passthroughCopies).toEqual(corePlan.passthroughCopies);
    expect(viewPlan.rows).toEqual(corePlan.rows);
    expect(viewPlan.totals).toEqual(corePlan.totals);
  });

  it('Phase 22 behavioral parity: peakAlreadyAtOrBelowSource branch produces IDENTICAL output in both files', async () => {
    const viewModule = await import('../../src/renderer/src/lib/export-view.js');
    const buildExportPlanView = viewModule.buildExportPlan;
    // peakScale 0.3 ≤ sourceRatio (0.498) → peakAlreadyAtOrBelowSource branch.
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
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.7);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
    const row = plan.passthroughCopies[0];
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
    const summary = makeDriftedSummary(1000, 800, 500, 480, 0.9);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.passthroughCopies).toHaveLength(1);
    const row = plan.passthroughCopies[0];
    expect(row.outW).toBe(500);
    expect(row.outH).toBe(400); // NOT 480 — uniform cap from min over both axes
    expect(row.effectiveScale).toBeCloseTo(0.5, 6);
  });

  it('DIMS-04 generous threshold (isCapped branch): peakScale > sourceRatio → passthrough', () => {
    // peakScale 0.8 > sourceRatio 0.498 → isCapped=true → passthrough.
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.8);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
  });

  it('DIMS-04 generous threshold (peakAlreadyAtOrBelowSource branch): peakScale ≤ sourceRatio → passthrough (DIMS-05 enabler)', () => {
    // peakScale 0.3 ≤ sourceRatio 0.498 → peakAlreadyAtOrBelowSource=true → passthrough.
    // NOTE: this branch catches DIMS-05 — repeated Optimize on already-optimized
    // files where the user's actual on-disk PNG is already at-or-below what
    // we'd produce without the cap.
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.3);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
  });

  it('DIMS-04 binding-axis ceil-equality redundant guard holds when isCapped (D-04 REVISED test contract)', () => {
    // Per D-04 REVISED: redundant proof that the cap formula is correct on
    // the BINDING axis (the more constraining of W/H). The non-binding axis
    // ceils to ≤ actualSource (may be 1px less due to uniform cap; this is
    // the acknowledged 1px aspect-ratio noise edge case).
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.9);
    const plan = buildExportPlan(summary, new Map());
    const row = plan.passthroughCopies[0];
    // Binding axis (X here, since 811/1628 < 962/1908): ceil(canonicalW × cappedEffScale) === actualSourceW.
    expect(Math.ceil(1628 * row.effectiveScale)).toBe(811);
    // Non-binding axis: ceil(canonicalH × cappedEffScale) ≤ actualSourceH (allowed 1px slack).
    expect(Math.ceil(1908 * row.effectiveScale)).toBeLessThanOrEqual(962);
    expect(Math.ceil(1908 * row.effectiveScale)).toBe(951); // ceil(950.49) — uniform cap result
  });

  it('D-02 override interaction: 100% override on drifted row → cap clamps transparently → passthrough', () => {
    // canonical 1628×1908, actual 811×962. Override 100% → applyOverride yields
    // effectiveScale = 1.0 → downscaleClampedScale = min(safeScale(1.0)=1, 1) = 1.
    // sourceRatio = 0.498; cappedEffScale = min(1, 0.498) = 0.498 (cap binds).
    // Row falls into passthrough; output is on-disk dims (binding axis), NOT
    // 1.0× canonical. Override honored as best-effort but never extrapolates
    // beyond actualSource (D-02 invariant).
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.5, 'OVERRIDE_DRIFTED');
    const plan = buildExportPlan(summary, new Map([['OVERRIDE_DRIFTED', 100]]));
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.rows).toHaveLength(0);
    expect(plan.passthroughCopies[0].outW).toBe(811); // binding-axis cap, not canonicalW
  });

  it('atlas-extract path no cap: actualSourceW undefined → row in plan.rows[]', () => {
    // dimsMismatch:false, actualSourceW:undefined → sourceRatio=Infinity → no cap, no passthrough.
    const summary = makeNonDriftedSummary(1000, 1000, 0.7);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(1);
    expect(plan.passthroughCopies).toHaveLength(0);
  });

  it('totals.count === rows.length + passthroughCopies.length (mixed plan)', () => {
    // Mixed plan: 1 drifted (passthrough) + 2 non-drifted (rows).
    const summary = {
      peaks: [
        // Drifted — passthrough
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
        // Non-drifted (no actualSource)
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
        // Non-drifted matching dims (dimsMismatch:false)
        {
          attachmentKey: 'default/SLOT/C',
          attachmentName: 'C',
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
    expect(plan.rows).toHaveLength(2);
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.totals.count).toBe(plan.rows.length + plan.passthroughCopies.length);
    expect(plan.totals.count).toBe(3);
  });

  it('passthroughCopies sorted deterministically by sourcePath localeCompare', () => {
    // 3 drifted rows with shuffled sourcePaths.
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
    const paths = plan.passthroughCopies.map((r) => r.sourcePath);
    const sorted = [...paths].sort((a, b) => a.localeCompare(b));
    expect(paths).toEqual(sorted);
    expect(paths).toEqual(['/fake/A.png', '/fake/M.png', '/fake/Z.png']);
  });

  it('CHECKER FIX 2026-05-02 — passthrough ExportRow carries actualSourceW + actualSourceH from DisplayRow', () => {
    // Drifted row passthrough: row carries both actualSource fields so OptimizeDialog
    // can render "811×962 (already optimized)" instead of "1628×1908 (already optimized)".
    const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.9);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.passthroughCopies).toHaveLength(1);
    expect(plan.passthroughCopies[0].actualSourceW).toBe(811);
    expect(plan.passthroughCopies[0].actualSourceH).toBe(962);
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
