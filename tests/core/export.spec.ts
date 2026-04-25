/**
 * Phase 6 Plan 03 — RED specs for the pure-TS export-plan builder.
 *
 * Cases per .planning/phases/06-optimize-assets-image-export/06-CONTEXT.md
 * <decisions> "Tests" lines 33-37:
 *   (a) SIMPLE_TEST → 3 ExportRows (post-Plan-02-03 dedup-by-attachmentName:
 *       CIRCLE / SQUARE / TRIANGLE) with effective scale = peakScale, dims =
 *       Math.round(sourceW × peakScale). [D-108, D-110, D-111]
 *   (b) Override 50% on TRIANGLE → out dims = Math.round(sourceW × 0.5). [D-111]
 *   (c) Override 200% on SQUARE → applyOverride clamps to 100% → out dims =
 *       sourceW × 1.0 = source. [D-111, Phase 4 D-91]
 *   (d) Two attachments share the same atlas region with different peaks →
 *       ExportRow.outW = Math.round(sourceW × max(peaks)). [D-108]
 *   (e) Ghost fixture → ExportPlan.rows excludes GHOST; ExportPlan.excludedUnused
 *       includes 'GHOST'. [D-109]
 *   (f) Math.round(127.5) === 128 fixture case. [D-110]
 *   (g) Hygiene grep — no fs/sharp/spine-core runtime imports in
 *       src/core/export.ts. [CLAUDE.md #5, Layer 3]
 *
 * Wave 0 status: RED — buildExportPlan and the new ExportRow/ExportPlan
 * types do not yet exist. Plan 06-02 introduces the types; Plan 06-03
 * introduces the function. This file lands first so 06-03 can drive it
 * GREEN as a TDD-style RED→GREEN gate.
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
  it('SIMPLE_TEST → 3 ExportRows with effective scale = peakScale, dims = Math.round(sourceW × peakScale)', () => {
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
      const expectedW = Math.round(row.sourceW * row.effectiveScale);
      const expectedH = Math.round(row.sourceH * row.effectiveScale);
      expect(row.outW).toBe(expectedW);
      expect(row.outH).toBe(expectedH);
    }
  });
});

describe('buildExportPlan — case (b) override 50% on TRIANGLE (D-111)', () => {
  it('override 50% → out dims = Math.round(sourceW × 0.5)', () => {
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
      expect(triRow.effectiveScale).toBeCloseTo(0.5, 6);
      expect(triRow.outW).toBe(Math.round(triRow.sourceW * 0.5));
      expect(triRow.outH).toBe(Math.round(triRow.sourceH * 0.5));
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
    // Max of (0.5, 0.9) = 0.9
    expect(row.effectiveScale).toBeCloseTo(0.9, 6);
    expect(row.outW).toBe(Math.round(128 * 0.9));
    expect(row.outH).toBe(Math.round(128 * 0.9));
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

describe('buildExportPlan — case (f) Math.round half-rounding (D-110)', () => {
  it('Math.round(127.5) === 128 (round-half-away-from-zero JS spec)', () => {
    // Lock the JS Math.round contract Phase 6 depends on. This test passes
    // even before buildExportPlan exists — but stays in this file to keep
    // the contract co-located with the spec block that documents it.
    expect(Math.round(127.5)).toBe(128);
    expect(Math.round(127.4)).toBe(127);
    expect(Math.round(0.5)).toBe(1);
    // round-half-toward-positive-infinity for negatives. Math.round(-0.5)
    // returns -0 in V8 (per ECMA-262); use Object.is-tolerant equality so
    // -0 and +0 both satisfy "rounded to zero" for the D-110 contract intent.
    // outW/outH callers Math.round positive products only (sourceW/H >= 0,
    // effectiveScale > 0), so -0 is unreachable in production paths.
    expect(Math.abs(Math.round(-0.5))).toBe(0);
  });

  it('synthetic peakScale yielding an exact .5 boundary rounds up', () => {
    // 255 × 0.5 = 127.5 → 128
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

  it('both files share the same Math.round uniform sizing pattern', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /Math\.round\([^)]*sourceW\s*\*/;
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
});
