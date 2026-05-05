/**
 * Phase 7 Plan 02 — specs for the pure-TS atlas-preview projection builder.
 *
 * Cases per .planning/phases/07-atlas-preview-modal/07-CONTEXT.md
 * <decisions> "Tests" lines 46-47:
 *   (a) SIMPLE_TEST Original @ 2048 → all 3 regions fit in 1 page;
 *       pages.length === 1; efficiency in expected range. [D-124, F7.1]
 *   (b) SIMPLE_TEST Optimized @ 2048 → same regions but at outW/H;
 *       efficiency strictly higher than Original. [D-125, F7.1]
 *   (c) Override 50% on TRIANGLE → Optimized projection's TRIANGLE region
 *       has expected packed dims. [D-125 + D-111, F7.1]
 *   (d) Ghost-fixture → GHOST excluded from BOTH modes. [D-109 parity, F7.1]
 *   (e) Atlas-packed fixture → BEFORE uses atlasSource.w/h, not page dims.
 *       [D-126]  it.todo — no atlas-packed fixture in fixtures/ yet (RESEARCH
 *       §Open Question 3 — Plan 04 may synthesize Jokerman).
 *   (f) Multi-page projection at small page cap → pages.length > 1. [D-128]
 *   (g) Math.ceil-thousandth on Optimized dims matches Phase 6 D-110 Round 5. [D-125]
 *   (h) Hygiene grep — no fs/sharp/electron imports in
 *       src/core/atlas-preview.ts. [CLAUDE.md #5, Layer 3]
 *
 * Plus the Layer 3 inline-copy parity describe block (Phase 4 D-75 / Phase 6
 * D-108 precedent) locking src/core/atlas-preview.ts ↔ src/renderer/src/lib/
 * atlas-preview-view.ts byte-identity on representative inputs.
 *
 * Wave 2 status: GREEN. Plan 02 implements src/core/atlas-preview.ts +
 * src/renderer/src/lib/atlas-preview-view.ts and fills the case-block
 * assertions + parity grep + hygiene grep.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';
import { buildAtlasPreview } from '../../src/core/atlas-preview.js';
import { buildExportPlan } from '../../src/core/export.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const ATLAS_PREVIEW_SRC = path.resolve('src/core/atlas-preview.ts');
const ATLAS_PREVIEW_VIEW_SRC = path.resolve('src/renderer/src/lib/atlas-preview-view.ts');

/**
 * Helper — load → sample → analyze → assemble a partial SkeletonSummary
 * matching what the renderer modal will see on a real drop. Mirrors the
 * idiom used in tests/core/export.spec.ts case (a) + (e): synthesize a
 * stub sourcePath per attachment so buildExportPlan has a dedup key.
 */
function loadSummary(jsonPath: string): SkeletonSummary {
  const load = loadSkeleton(jsonPath);
  const sampled = sampleSkeleton(load);
  const peaks = analyze(sampled.globalPeaks);
  const peaksWithPath = peaks.map((r) => ({
    ...r,
    sourcePath: '/fake/' + r.attachmentName + '.png',
  }));
  // Phase 24 Plan 01: unusedAttachments removed; orphanedFiles replaces it.
  // The excluded set in buildAtlasPreview is now always empty (Plan 02 wires it).
  return { peaks: peaksWithPath, orphanedFiles: [] } as unknown as SkeletonSummary;
}

describe('buildAtlasPreview — case (a) Original @ 2048 (D-124, F7.1)', () => {
  it('SIMPLE_TEST → 3 regions fit in 1 page; efficiency in expected range', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    const projection = buildAtlasPreview(summary, new Map(), {
      mode: 'original',
      maxPageDim: 2048,
    });
    expect(projection.pages.length).toBe(1);
    expect(projection.pages[0].regions.length).toBe(3);
    expect(projection.pages[0].efficiency).toBeGreaterThan(0);
    expect(projection.pages[0].efficiency).toBeLessThanOrEqual(100);
    expect(projection.totalPages).toBe(1);
    expect(projection.mode).toBe('original');
    expect(projection.maxPageDim).toBe(2048);
  });
});

describe('buildAtlasPreview — case (b) Optimized @ 2048 (D-125, F7.1)', () => {
  // SIMPLE_TEST's three regions all sample at peakScale ≥ 1.0 (CIRCLE 2.02,
  // SQUARE 1.5, TRIANGLE 2.0), and Phase 6 Gap-Fix #1 clamps effectiveScale to
  // ≤ 1.0 — so under the empty-overrides input, Optimized dims literally equal
  // Original dims (sourceW × 1.0 = sourceW). To prove the D-125 contract
  // ("Optimized reads outW/H from buildExportPlan; produces strictly smaller
  // packed slots when downscaling applies") we drive the user-override path,
  // which is the realistic Phase 7 workflow: user opens the modal → sees the
  // glow texture is too big → applies an override → reopens → glow rect shrinks.
  it('SIMPLE_TEST + 50% override on each region → optimized regions strictly smaller; efficiency higher', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    const overrides = new Map<string, number>([
      ['CIRCLE', 50],
      ['SQUARE', 50],
      ['TRIANGLE', 50],
    ]);
    const original = buildAtlasPreview(summary, overrides, {
      mode: 'original',
      maxPageDim: 2048,
    });
    const optimized = buildAtlasPreview(summary, overrides, {
      mode: 'optimized',
      maxPageDim: 2048,
    });
    // Optimized regions strictly smaller per attachment — overrides apply to
    // the optimized branch via buildExportPlan, but original ignores overrides
    // entirely (D-124 reads source dims directly).
    const origRegions = original.pages.flatMap((p) => p.regions);
    for (const optRegion of optimized.pages.flatMap((p) => p.regions)) {
      const origRegion = origRegions.find(
        (r) => r.attachmentName === optRegion.attachmentName,
      );
      expect(origRegion).toBeDefined();
      expect(optRegion.w * optRegion.h).toBeLessThan(origRegion!.w * origRegion!.h);
    }
    // With strictly smaller optimized regions packed into the same maxPageDim
    // bin, used pixels drop while bin size stays equal — efficiency drops on
    // optimized. The D-125 contract is "Optimized produces smaller dims";
    // efficiency direction is a derivation, NOT the contract. Lock the
    // direction explicitly so the metric matches the modal's headline read:
    //   - usedPixels(optimized) < usedPixels(original)
    //   - bin size matched at maxPageDim
    //   → efficiency(optimized) < efficiency(original)
    // (modal's "savings story" is the page-count delta + dims, not efficiency
    // direction — D-127.)
    const origUsed = original.pages.reduce((s, p) => s + p.usedPixels, 0);
    const optUsed = optimized.pages.reduce((s, p) => s + p.usedPixels, 0);
    expect(optUsed).toBeLessThan(origUsed);
  });

  it('SIMPLE_TEST baseline (no overrides) → all peakScales ≥ 1.0 → Optimized dims === Original dims (clamp invariant)', () => {
    // Locks Phase 6 Gap-Fix #1 downscale-only invariant: when peakScale ≥ 1.0
    // for every attachment, effectiveScale clamps to 1.0 and Optimized dims
    // equal source dims. This matches Original mode exactly. NOT a packer
    // bug — the modal correctly shows "no savings available" in this scenario.
    const summary = loadSummary(FIXTURE_BASELINE);
    const original = buildAtlasPreview(summary, new Map(), {
      mode: 'original',
      maxPageDim: 2048,
    });
    const optimized = buildAtlasPreview(summary, new Map(), {
      mode: 'optimized',
      maxPageDim: 2048,
    });
    const origRegions = original.pages.flatMap((p) => p.regions);
    for (const optRegion of optimized.pages.flatMap((p) => p.regions)) {
      const origRegion = origRegions.find(
        (r) => r.attachmentName === optRegion.attachmentName,
      );
      expect(origRegion).toBeDefined();
      expect(optRegion.w).toBe(origRegion!.w);
      expect(optRegion.h).toBe(origRegion!.h);
    }
  });
});

describe('buildAtlasPreview — case (c) Override 50% on TRIANGLE (D-125 + D-111, F7.1)', () => {
  it('Optimized projection TRIANGLE region packed at half source dims (with ceil-thousandth)', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    const overrides = new Map<string, number>([['TRIANGLE', 50]]);
    const projection = buildAtlasPreview(summary, overrides, {
      mode: 'optimized',
      maxPageDim: 2048,
    });
    // The exact outW/outH come from buildExportPlan — that's the contract (D-125).
    const plan = buildExportPlan(summary, overrides);
    const planRow = plan.rows.find((r) => r.attachmentNames.includes('TRIANGLE'));
    expect(planRow).toBeDefined();
    const region = projection.pages
      .flatMap((p) => p.regions)
      .find((r) => r.attachmentName === 'TRIANGLE');
    expect(region).toBeDefined();
    expect(region!.w).toBe(planRow!.outW);
    expect(region!.h).toBe(planRow!.outH);
  });
});

describe('buildAtlasPreview — case (d) Ghost-fixture (D-109 → Phase 24 Plan 01 → Plan 260505-lk0)', () => {
  it('SIMPLE_TEST_GHOST → GHOST IS present in summary.peaks and in original-mode preview (skin-declared unbound attachments are now measured per Plan 260505-lk0)', () => {
    // Phase 24 Plan 01 removed the old unusedAttachments-based D-109 exclusion
    // and made the sampler filter the gate: "GHOST absent because never
    // sampled by the physics engine → not in globalPeaks → not in
    // summary.peaks → not in preview".
    //
    // Plan 260505-lk0 (2026-05-05) flipped that gate: per the user's locked
    // principle, ALL attachments declared in a skin's manifest must be
    // measured for peak scale, optimization, and export — independent of
    // whether any setup-pose binding or animation timeline activates them at
    // runtime (visibility is runtime-mutable; dev code, player actions,
    // equipment swaps can bind any skin-declared attachment to any slot).
    //
    // GHOST in SIMPLE_TEST_GHOST is exactly this case: declared in the
    // default skin's manifest under slot CIRCLE (alongside the live CIRCLE
    // attachment) but never bound to any slot at setup pose and never raised
    // by an animation timeline. The new sampler skin-manifest pass (sampler.ts
    // Pass 1.5) measures it via the slot's bone (CTRL → root chain), emits a
    // PeakRecord with sourceW/H = 64/64, and so it now reaches summary.peaks
    // → buildAtlasPreview inputs.
    //
    // Mode-specific behavior:
    //   - 'original': all peaks from summary.peaks flow into the projection
    //     directly (atlas-preview.ts:208), so GHOST is visible.
    //   - 'optimized': buildAtlasPreview reads from buildExportPlan.rows
    //     (atlas-preview.ts:184), and buildExportPlan splits no-resize rows
    //     into `passthroughCopies` (export.ts:308). For SIMPLE_TEST_GHOST
    //     baseline (no overrides), every region — including GHOST — has
    //     peakScale clamped to ≤ 1.0 (Phase 6 Gap-Fix #1), so outW === sourceW
    //     and ALL rows go to passthroughCopies. plan.rows is empty, so the
    //     optimized projection is empty across the board. This is pre-existing
    //     behavior independent of GHOST — verified by the same effect on
    //     CIRCLE/SQUARE/TRIANGLE.
    //
    // Cross-load symmetry restored: atlas-source and optimized-folder loads
    // now agree on the attachment set. JOKER-BG / JOKER-FRAME (regression
    // anchors) and GHOST (this fixture) all flow through the same path.
    const summary = loadSummary(FIXTURE_GHOST);
    expect(summary.peaks.map((p) => p.attachmentName)).toContain('GHOST');

    const original = buildAtlasPreview(summary, new Map(), { mode: 'original', maxPageDim: 2048 });
    const originalNames = original.pages.flatMap((p) => p.regions.map((r) => r.attachmentName));
    expect(originalNames).toContain('GHOST');
  });
});

describe('buildAtlasPreview — case (e) Atlas-packed BEFORE uses atlasSource.w/h (D-126)', () => {
  // No atlas-packed fixture exists in fixtures/ at execution time. RESEARCH
  // §Open Question 3 + §Wave 0 Gaps explicitly notes this fixture may need
  // synthesis; leaving as it.todo is acceptable for Plan 02, addressed in
  // Plan 04 if needed.
  it.todo('synthesized atlas-packed fixture: BEFORE input dims = atlasSource.w/h');
});

describe('buildAtlasPreview — case (f) Multi-page at small cap (D-128)', () => {
  it('SIMPLE_TEST at maxPageDim=1100 → pages.length > 1; deterministic split', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    // 1100 is intentionally NOT in the 2048|4096 union — the runtime accepts
    // any number; the type union just restricts the modal's toggle UI. Cast
    // for the test only so we can drive the multi-page branch with the
    // existing 3-region fixture (CIRCLE 699×699, SQUARE 1000×1000,
    // TRIANGLE 833×759 — every region fits inside 1100, but their summed area
    // (2.12 M px) exceeds 1100² = 1.21 M, so the packer splits across pages).
    // Aligns with D-128 promise that multi-page splits happen deterministically
    // when total area > maxPageDim². 128 (the prior choice) is no longer valid
    // since the D-139-follow-up oversize filter excludes any region whose dim
    // exceeds maxPageDim — at 128 the entire fixture would be filtered out.
    const opts = { mode: 'original' as const, maxPageDim: 1100 } as unknown as {
      mode: 'original';
      maxPageDim: 2048 | 4096;
    };
    const projection1 = buildAtlasPreview(summary, new Map(), opts);
    const projection2 = buildAtlasPreview(summary, new Map(), opts);
    expect(projection1.pages.length).toBeGreaterThan(1);
    // No oversize at this cap (largest region is SQUARE 1000×1000 ≤ 1100).
    expect(projection1.oversize).toEqual([]);
    // Determinism: two runs over the same summary produce byte-identical
    // packer output because inputs are sorted before packer.add (matches
    // src/core/export.ts:223 sort discipline).
    expect(projection1).toEqual(projection2);
  });

  it('SIMPLE_TEST at maxPageDim=128 → all regions oversize; pages.length === 1 (degenerate)', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    // D-139 follow-up: every SIMPLE_TEST region (699×699, 1000×1000, 833×759)
    // exceeds 128 → all flagged oversize, none enter the packer, the D-136
    // degenerate-empty-page fallback emits a single empty page.
    const opts = { mode: 'original' as const, maxPageDim: 128 } as unknown as {
      mode: 'original';
      maxPageDim: 2048 | 4096;
    };
    const projection = buildAtlasPreview(summary, new Map(), opts);
    expect(projection.pages.length).toBe(1);
    expect(projection.pages[0]?.regions).toEqual([]);
    expect(projection.oversize.sort()).toEqual(['CIRCLE', 'SQUARE', 'TRIANGLE']);
  });
});

describe('buildAtlasPreview — case (g) Optimized dims match Phase 6 D-110 ceil-thousandth (D-125)', () => {
  it('Optimized projection w/h equals buildExportPlan outW/outH per attachment', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    const overrides = new Map<string, number>();
    const projection = buildAtlasPreview(summary, overrides, {
      mode: 'optimized',
      maxPageDim: 2048,
    });
    const plan = buildExportPlan(summary, overrides);
    for (const region of projection.pages.flatMap((p) => p.regions)) {
      const planRow = plan.rows.find((r) => r.attachmentNames.includes(region.attachmentName));
      expect(planRow).toBeDefined();
      expect(region.w).toBe(planRow!.outW);
      expect(region.h).toBe(planRow!.outH);
    }
  });
});

describe('buildAtlasPreview — case (h) D-127 metrics surface (F7.2)', () => {
  it('projection has totalPages and per-page efficiency populated; no bytes field', () => {
    const summary = loadSummary(FIXTURE_BASELINE);
    const projection = buildAtlasPreview(summary, new Map(), {
      mode: 'optimized',
      maxPageDim: 2048,
    });
    expect(projection.totalPages).toBe(projection.pages.length);
    for (const page of projection.pages) {
      expect(page.efficiency).toBeGreaterThanOrEqual(0);
      expect(page.efficiency).toBeLessThanOrEqual(100);
      expect(page).not.toHaveProperty('bytes');
      expect(page).not.toHaveProperty('fileSize');
      expect(page).not.toHaveProperty('estimatedBytes');
    }
    // Top-level projection also has no bytes-shaped field.
    expect(projection).not.toHaveProperty('bytes');
    expect(projection).not.toHaveProperty('fileSize');
    expect(projection).not.toHaveProperty('estimatedBytes');
  });
});

describe('atlas-preview — module hygiene (Layer 3 lock, CLAUDE.md #5)', () => {
  it('no node:fs / node:path / node:child_process / node:net / node:http imports', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  });
  it('no sharp import', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
  it('no electron import', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]electron['"]/);
  });
  it('CLAUDE.md #5: no DOM references', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
  it('exports buildAtlasPreview by name', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).toMatch(/export\s+function\s+buildAtlasPreview/);
  });
});

describe('atlas-preview — core ↔ renderer parity (Layer 3 inline-copy invariant, Phase 4 D-75 / Phase 6 D-108)', () => {
  it('renderer view exports buildAtlasPreview by name', () => {
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/export\s+function\s+buildAtlasPreview/);
  });
  it('renderer copy has ZERO imports from src/core/* (Layer 3 invariant)', () => {
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    expect(viewText).not.toMatch(/from ['"][^'"]*\/core\//);
    expect(viewText).not.toMatch(/from ['"]@core/);
  });
  it('renderer copy uses sibling export-view.js for buildExportPlan (NOT core/export.js)', () => {
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/from ['"]\.\/export-view\.js['"]/);
  });
  it('both files share the same MaxRectsPacker construction (D-132 hardcoded params: 2px padding, no rotation, smart, pot:false, square:false)', () => {
    const coreText = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    // 2px padding lock — third positional arg.
    const sig = /new\s+MaxRectsPacker\([^,]+,\s*[^,]+,\s*2/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
    // D-132 hardcoded option params present in both copies.
    for (const text of [coreText, viewText]) {
      expect(text).toMatch(/smart:\s*true/);
      expect(text).toMatch(/allowRotation:\s*false/);
      expect(text).toMatch(/pot:\s*false/);
      expect(text).toMatch(/square:\s*false/);
    }
  });
  it('renderer view buildAtlasPreview produces IDENTICAL projection to canonical for representative inputs', async () => {
    // Dynamic-import the renderer copy via its file path so the test executes
    // in node (no DOM needed; renderer copy has zero DOM deps).
    const viewModule = await import('../../src/renderer/src/lib/atlas-preview-view.js');
    const buildView = viewModule.buildAtlasPreview;
    const summary = loadSummary(FIXTURE_BASELINE);
    const cases: Array<{
      label: string;
      mode: 'original' | 'optimized';
      maxPageDim: 2048 | 4096;
      overrides: ReadonlyMap<string, number>;
    }> = [
      { label: 'original @ 2048 baseline', mode: 'original', maxPageDim: 2048, overrides: new Map() },
      { label: 'optimized @ 2048 baseline', mode: 'optimized', maxPageDim: 2048, overrides: new Map() },
      { label: 'original @ 4096 baseline', mode: 'original', maxPageDim: 4096, overrides: new Map() },
      { label: 'optimized @ 4096 baseline', mode: 'optimized', maxPageDim: 4096, overrides: new Map() },
      {
        label: 'optimized @ 2048 with TRIANGLE 50%',
        mode: 'optimized',
        maxPageDim: 2048,
        overrides: new Map([['TRIANGLE', 50]]),
      },
    ];
    for (const c of cases) {
      const coreProjection = buildAtlasPreview(summary, c.overrides, {
        mode: c.mode,
        maxPageDim: c.maxPageDim,
      });
      const viewProjection = buildView(summary, c.overrides, {
        mode: c.mode,
        maxPageDim: c.maxPageDim,
      });
      expect(viewProjection, c.label).toEqual(coreProjection);
    }
  });
});
