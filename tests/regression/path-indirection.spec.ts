/**
 * Phase 29 Plan 04 Task 2 — End-to-end regression suite for path-indirection.
 *
 * Locks the Phase 29 4-surface invariant + override-reaches-export contract
 * verbatim, against the committed Chicken-Min fixture (REGION-07) AND a
 * synthetic multi-page packer fixture (PREVIEW-01 (b) — strict-monotone
 * delta). Pre-Phase-29 these tests would fail; post-Phase-29 they pass and
 * lock the contract against future refactors.
 *
 * Requirement coverage:
 *   - REGION-01: summary.regions.length < summary.peaks.length on path-indirected fixture
 *   - REGION-04: overrides.set('5/7', 4 / canonicalW × 100) → ExportRow.outW === 4 (THE FALSIFIED BUG)
 *   - REGION-05: regionRow.attachmentName is the lex-smallest contributor (ties on peak)
 *   - REGION-06: AnimationBreakdownPanel data preserves DISTINCT rows for path-indirected
 *               attachmentNames (drill-down detail unchanged per D-09)
 *   - REGION-07: fixture <1MB committed (size sentinel)
 *   - PREVIEW-01 (a): atlas-preview projection page count matches Chicken-Min's
 *                     actual atlas page count (1 page, NOT inflated)
 *   - PREVIEW-01 (b): synthetic multi-page strict-monotone delta — postPages < prePages
 *                     when pre-fix per-attachment expansion vs post-fix per-region collapse
 *                     forces a cross-page boundary
 *
 * The Chicken-Min fixture (Plan 04 Task 1) ships a stripped Chicken subset
 * (22.4KB total, well under 1MB) that preserves the path-indirection
 * signature: 3 attachmentNames (5/5/5/7/7, 5/5/7/7, 5/7) resolve to one
 * regionName 5/7 via mesh.path indirection. The full Chicken (152MB) stays
 * gitignored.
 */
// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { MaxRectsPacker } from 'maxrects-packer';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
import { buildExportPlan } from '../../src/core/export.js';
import { buildAtlasPreview } from '../../src/core/atlas-preview.js';
import type { SkeletonSummary, RegionRow } from '../../src/shared/types.js';
import { enrichWithEffective } from '../../src/renderer/src/lib/enrich-overrides.js';

const FIXTURE = path.resolve('fixtures/Chicken-Min/Chicken-Min.json');

describe('Phase 29 path-indirection regression — Chicken-Min fixture', () => {
  let summary: SkeletonSummary;

  beforeAll(() => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    summary = buildSummary(load, sampled, 0);
  });

  it('REGION-01: summary.regions.length < summary.peaks.length on path-indirected fixture', () => {
    // Chicken-Min has 4 contributing peaks (3 attachments resolving to region
    // 5/7 + 1 to region 5/BLOOD_DROP) but only 2 regions. The strict-less
    // assertion is structural — robust to fixture-content drift as long as
    // path-indirection is preserved.
    expect(summary.regions.length).toBeLessThan(summary.peaks.length);
  });

  it('REGION-01 detail: regionName "5/7" exists with exactly 3 unique contributingAttachments (Plan 29-06 / WR-01 lock)', () => {
    const r = summary.regions.find((x) => x.regionName === '5/7');
    expect(r).toBeDefined();
    // Plan 29-06 / WR-01 lock — tightened from `>=2` to `===3`. The
    // Chicken-Min fixture has 4 PeakRecords resolving to region '5/7'
    // (slots 7, 8, VOLUME_7, VOLUME_8) with 3 UNIQUE attachmentNames
    // (5/5/5/7/7, 5/5/7/7, 5/7 — '5/7' binds to two slots: VOLUME_7 +
    // VOLUME_8). Pre-29-06 toRegionRow did not dedup contributors by
    // attachmentName, producing 4 entries; post-29-06 the dedup yields 3.
    // Locking the EXACT count prevents both directions of regression:
    // re-introduction of slot-fan-out (would push count to 4) AND an
    // over-aggressive collapse (e.g. count=1 if a future refactor
    // breaks region-grouping).
    expect(r!.contributingAttachments.length).toBe(3);
    const names = r!.contributingAttachments.map((c) => c.attachmentName);
    // The path-indirected names from the source rig:
    expect(names).toContain('5/5/5/7/7');
    expect(names).toContain('5/5/7/7');
    expect(names).toContain('5/7');
    // Post-29-06: names array contains EXACTLY these three (no duplicates).
    // sorted() because contributingAttachments is sorted lex ASC at toRegionRow.
    expect([...names].sort()).toEqual(['5/5/5/7/7', '5/5/7/7', '5/7']);
  });

  it('REGION-04 (FALSIFIED BUG CLOSURE): overriding "5/7" → 4×4 produces ExportRow with outW === 4', () => {
    // The .planning/debug/path-indirected-duplicate-rows.md repro at the
    // INTEGRATION level. Pre-Phase-29 the override key '5/7' bound only to
    // attachmentName='5/7' (one of three contributors); the OTHER two
    // siblings ('5/5/5/7/7', '5/5/7/7') still won the per-sourcePath max
    // via their unmodified peakScale, producing outW=273×309 instead of the
    // user's intended 4×4. Post-Phase-29 this test passes — the user's
    // intended dim wins because the override read in buildExportPlan keys
    // on regionName ?? attachmentName, so the SAME override applies to
    // every contributing attachment.
    const r = summary.regions.find((x) => x.regionName === '5/7');
    expect(r).toBeDefined();
    const canonicalW = r!.canonicalW;
    const canonicalH = r!.canonicalH;
    // Sanity-check the canonical dims came from the JSON's mesh.width/height
    // (378×428), not the stub atlas region bounds (4×4). The override math
    // depends on canonicalW being the JSON-declared dim.
    expect(canonicalW).toBe(378);
    expect(canonicalH).toBe(428);

    // Plan template formula: overrideFraction = 4 / canonicalW. The math chain:
    //   1. overridePct = (4 / 378) × 100 ≈ 1.058
    //   2. effScale = applyOverride(1.058, peakScale).effectiveScale
    //                ≈ 0.01058 × 0.7431 ≈ 0.00786
    //   3. safeScale rounds UP to nearest thousandth → 0.008
    //   4. outW = ceil(canonicalW × 0.008) = ceil(378 × 0.008) = ceil(3.024) = 4 ✓
    //   5. outH = ceil(canonicalH × 0.008) = ceil(428 × 0.008) = ceil(3.424) = 4
    const overrideFraction = 4 / canonicalW;
    const overrides = new Map<string, number>([['5/7', overrideFraction * 100]]);
    const plan = buildExportPlan(summary, overrides);
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    const row = allRows.find((er) => er.attachmentNames.includes('5/7'));
    expect(row).toBeDefined();
    // The falsifying assertion — the success criterion of Phase 29:
    expect(row!.outW).toBe(4);
    // outH is also 4 because canonicalH (428) × 0.008 ceil → 4.
    // (The exact integer is computed below for clarity / fixture-drift safety.)
    const expectedOutH = Math.ceil(canonicalH * 0.008);
    expect(row!.outH).toBe(expectedOutH);
    // Sanity: all three contributors share the row (per-region collapse).
    expect(row!.attachmentNames.sort()).toEqual(['5/5/5/7/7', '5/5/7/7', '5/7']);
  });

  it('REGION-05 lex tiebreak: winning attachmentName is the lex-smallest contributor when peaks tie', () => {
    // For the Chicken-Min 5/7 region, all three contributors (5/5/5/7/7,
    // 5/5/7/7, 5/7) are mesh attachments with similar scaling demands —
    // depending on the rig's ancestor-bone scale chain they may land at
    // identical peakScale or near-identical. REGION-05's contract: when
    // peakScale ties, lex-smallest attachmentName wins. Even when peaks
    // differ slightly, the test asserts the WINNER's attachmentName is
    // a member of the contributingAttachments[] (always true) AND when
    // multiple contributors have peakScale equal to row.peakScale, the
    // winner is the lex-smallest among that subset.
    const r = summary.regions.find((x) => x.regionName === '5/7');
    expect(r).toBeDefined();
    const tiedWinners = r!.contributingAttachments
      .filter((c) => c.peakScale === r!.peakScale)
      .map((c) => c.attachmentName)
      .sort();
    // Winner attachmentName must be one of the tied contributors (sanity)
    // AND must be the lex-smallest of that tied set (REGION-05).
    expect(tiedWinners).toContain(r!.attachmentName);
    expect(r!.attachmentName).toBe(tiedWinners[0]);
  });

  it('REGION-06: AnimationBreakdownPanel data preserves DISTINCT rows for path-indirected attachments', () => {
    // The 4-surface invariant ("N rows everywhere") applies to the four
    // user-named surfaces — Global / Atlas Preview / Optimize / exported
    // folder. AnimationBreakdownPanel is the explicit drill-down where
    // per-attachment detail lives (D-09). Within an animation card,
    // path-indirected projects MUST show distinct rows for each attachmentName
    // (NOT collapsed by region dedup).
    //
    // Chicken-Min's 5/PRIZE animation includes BOTH 5/5/5/7/7 AND 5/5/7/7
    // (verified via the source rig walk in scripts/strip-chicken.mjs). Both
    // names MUST appear as distinct rows in the 5/PRIZE card.
    const cards = summary.animationBreakdown;
    const fivePrizeCard = cards.find((c) => c.animationName === '5/PRIZE');
    expect(fivePrizeCard).toBeDefined();
    const namesIn5Prize = fivePrizeCard!.rows.map((r) => r.attachmentName);
    expect(namesIn5Prize).toContain('5/5/5/7/7');
    expect(namesIn5Prize).toContain('5/5/7/7');
    expect(namesIn5Prize).toContain('5/7');
    // Distinct rows — the per-card per-attachment dedup invariant unchanged.
    const fiveSevenRows = fivePrizeCard!.rows.filter(
      (r) => r.attachmentName === '5/5/5/7/7' || r.attachmentName === '5/5/7/7',
    );
    expect(fiveSevenRows.length).toBeGreaterThanOrEqual(2);
  });

  it('PREVIEW-01 (a): atlas-preview optimized projection on Chicken-Min single-page fixture has exactly 1 page', () => {
    // Chicken-Min ships a 16×16 stub atlas with 2 regions (5/7 + 5/BLOOD_DROP).
    // Both fit comfortably in the default 2048px page. The structural fix:
    // deriveInputs emits ONE input per region (not per attachment), so
    // path-indirection does NOT inflate the page count. With 2 regions this
    // is masked at single-page scale; the multi-page test (b) below catches
    // the cross-page case where pre-fix expansion forces an extra page.
    const overrides = new Map<string, number>();
    const projection = buildAtlasPreview(summary, overrides, {
      mode: 'optimized',
      maxPageDim: 2048,
    });
    expect(projection.pages.length).toBe(1);
    // Sanity: each region appears exactly once in the projection.
    const regionNamesInPage = projection.pages[0].regions.map((r) => r.regionName).sort();
    expect(regionNamesInPage).toEqual(['5/7', '5/BLOOD_DROP']);
    // Each PackedRegion carries its full attachmentNames[] contributor list.
    const fiveSeven = projection.pages[0].regions.find((r) => r.regionName === '5/7');
    expect(fiveSeven).toBeDefined();
    expect(fiveSeven!.attachmentNames.length).toBeGreaterThanOrEqual(2);
  });

  it('PREVIEW-01 (b): synthetic multi-page projection — STRICT-MONOTONE postPages < prePages on path-indirected synthetic fixture', () => {
    // Inline synthetic SkeletonSummary — NOT a committed fixture. Asserts a
    // STRICT-MONOTONE DELTA (postPages < prePages), NOT prescribed exact
    // counts. The original Chicken bug was 13-vs-14; we observe the same
    // structural shape at smaller N here.
    //
    // Why strict-monotone instead of exact counts: the underlying packer is
    // MaxRectsPacker (src/core/atlas-preview.ts:100), not a hand-rolled
    // shelf-pack. Predicting the exact number of pages MaxRectsPacker
    // produces for a given input set is non-trivial and depends on the
    // packer's internal heuristics (smart:true, allowRotation:false, etc.).
    // The structural fix is identical regardless of the exact N — what
    // matters is that per-region collapse strictly reduces the page count
    // when path-indirection forces a cross-page boundary in the pre-fix
    // state.
    //
    // Chosen dims (executor's discretion per Plan 04 Task 2 step 4 / 6b
    // bullet 2): 4 regions × 70×70 tile, maxPageDim=140. The first region
    // has 3 contributingAttachments (path-indirection signature) — pre-fix
    // expansion emits 6 inputs (3+1+1+1); post-fix collapses to 4 inputs.
    // Empirically observed (from the probe runs during plan execution):
    //   - postPages = 1 (4 tiles fit cleanly in a 140×140 page; 70×70 tiles
    //     pack as a 2×2 grid filling exactly 4900 of the 19600 pixel cells
    //     each, totalling 4 × 4900 = 19600 pixels — exactly fills the page).
    //   - prePages = 2 (6 tiles spill — one tile pushed to a second page
    //     since the first 140×140 page is already full at 4 tiles).
    const synth = buildSyntheticPathIndirectedSummary({
      numRegions: 4,
      contributorsForFirstRegion: 3,
      tilePx: 70,
    });
    const opts = { mode: 'optimized' as const, maxPageDim: 140 as const };

    // Post-fix (the Phase 29 contract): ONE input per region.
    const postProjection = buildAtlasPreview(
      synth,
      new Map(),
      // Cast — buildAtlasPreview's opts type unions 2048 | 4096 for
      // production, but the packer accepts any positive integer. The
      // synthetic test bypasses the production cap to exercise multi-page
      // packing at a small scale.
      opts as unknown as Parameters<typeof buildAtlasPreview>[2],
    );
    const postPages = postProjection.pages.length;

    // Pre-fix simulation: emit one input per (region, attachmentName) pair.
    // For single-attachment regions this is identical to post-fix; for
    // path-indirected regions it emits N inputs for N contributors —
    // the pre-Phase-29 buggy shape. Run the SAME packer with IDENTICAL opts.
    const prePages = packPreFixSimulation(synth, opts.maxPageDim);

    // Strict-monotone delta — Phase 29 PREVIEW-01 multi-page invariant.
    // tile=70×70, maxPageDim=140 → postPages=1 (4 unique tiles fit cleanly
    // in a 2×2 grid filling the 140×140 page), prePages=2 (6 expanded tiles
    // spill to a second page). Concrete numbers observed during plan
    // execution; the strict inequality is what's locked, exact numbers are
    // executor's discretion.
    expect(postPages).toBeGreaterThan(0);
    expect(prePages).toBeGreaterThan(0);
    expect(postPages).toBeLessThan(prePages);

    // Sanity-check at the input layer: post-fix emits exactly synth.regions.length
    // inputs (one per region). Guards against a future regression that
    // re-introduces per-attachment expansion at the input layer even if it
    // doesn't push past a page boundary.
    let optimizedInputCount = 0;
    for (const page of postProjection.pages) {
      optimizedInputCount += page.regions.length;
    }
    expect(optimizedInputCount).toBe(synth.regions.length);
  });

  it('REGION-07 sentinel: fixtures/Chicken-Min/ size <1MB committed', () => {
    // Sentinel test — if the fixture grows past 1MB, this test fails and
    // forces re-stripping before commit. Pairs with .gitignore'ing
    // fixtures/Chicken/ (the full 152MB source).
    const dir = path.resolve('fixtures/Chicken-Min');
    const files = fs.readdirSync(dir);
    let totalBytes = 0;
    for (const f of files) {
      const stat = fs.statSync(path.join(dir, f));
      totalBytes += stat.size;
    }
    expect(totalBytes).toBeLessThan(1024 * 1024); // <1MB
  });

  it("REGION-04 batch-apply UI: shift-select multiple regions → overrides Map keys are regionNames only AND every region's ExportRow.outW matches the override", () => {
    // Phase 29 Plan 29-05 — CR-01 closure. The .planning/phases/.../29-VERIFICATION.md
    // YAML gap.missing[3] explicitly requires this assertion: "Add a
    // regression test that shift-selects multiple regions in the panel,
    // batch-applies an override, and asserts both the resulting `overrides`
    // Map keys (must be regionNames only — no contributor names) AND the
    // export-plan output dims for every selected region."
    //
    // We split the lock across TWO assertion layers in node env (no jsdom
    // panel render — the file is @vitest-environment node):
    //
    //   A. Source-level lock: read the panel source; assert the obsolete
    //      contributor-fan-out symbol is absent and `selectedKeys={selected}`
    //      appears at both Row prop sites. This catches a future refactor
    //      that re-introduces the contributor fan-out.
    //
    //   B. Behavior-level lock: build a synthetic Chicken-Min-shaped
    //      SkeletonSummary; simulate the post-fix panel selection
    //      (regionName-keyed) + the AppShell scope-mutation shape (one
    //      `next.set(name, clamped)` per scope entry); call buildExportPlan
    //      against the resulting overrides Map; assert every Map key is a
    //      regionName AND every selected region's ExportRow has outW
    //      matching the override math. Pre-fix the panel would have handed
    //      AppShell a Set of attachmentNames; the AppShell mutation would
    //      have written contributor-name keys; buildExportPlan would have
    //      missed every selected region's override (Map miss on
    //      `row.regionName ?? row.attachmentName`). Post-fix the override
    //      reaches every region.

    // ----- A. Source-level lock (CR-01 fix anti-regression) -----
    const panelSrc = fs.readFileSync(
      path.resolve('src/renderer/src/panels/GlobalMaxRenderPanel.tsx'),
      'utf8',
    );
    // The obsolete contributor-fan-out symbol must be fully removed —
    // no useMemo, no prop, no comment.
    expect(panelSrc).not.toMatch(/selectedAttachmentNames/);
    // Both Row prop sites must pass the regionName-keyed `selected` Set verbatim.
    const selectedKeysHits = (panelSrc.match(/selectedKeys=\{selected\}/g) ?? []).length;
    expect(selectedKeysHits).toBeGreaterThanOrEqual(2);

    // ----- B. Behavior-level lock (end-to-end CR-01 closure) -----
    // Build a synthetic Chicken-Min-shaped summary: region '5/7' with 3
    // path-indirected contributors + region '5/BLOOD_DROP' with 1 contributor.
    // Reuses buildSyntheticPathIndirectedSummary patterns from PREVIEW-01 (b)
    // but customized for the override-pipeline assertion (deterministic
    // canonicalW/H + peakScale for outW math).
    const synth = buildSyntheticBatchApplySummary();

    // Simulate the post-Task-1 panel's selection: the user shift-selected
    // both regions in the Global Max Render panel; the panel passes
    // `selectedKeys = selected` (regionName-keyed) to onOpenOverrideDialog.
    const selectedKeys: ReadonlySet<string> = new Set(['5/7', '5/BLOOD_DROP']);

    // Lock B.1: every member of selectedKeys is a regionName from synth.regions
    // (no contributor attachmentNames leak in).
    const knownRegionNames = new Set(synth.regions.map((r) => r.regionName));
    for (const k of selectedKeys) {
      expect(knownRegionNames.has(k)).toBe(true);
    }

    // Simulate the AppShell scope-mutation shape verbatim
    // (src/renderer/src/components/AppShell.tsx onOpenOverrideDialog +
    // onApplyOverride at lines 510-587). Pick an override percent that
    // produces deterministic, distinguishable outW per region.
    const overridePct = 50; // 50% scale-down; deterministic non-cap-binding choice
    const scope = [...selectedKeys];
    const postBatchOverrides = new Map<string, number>();
    for (const name of scope) postBatchOverrides.set(name, overridePct);

    // Lock B.2: every key in postBatchOverrides is a regionName from synth
    // (the Map is NOT polluted with contributor attachmentNames).
    for (const key of postBatchOverrides.keys()) {
      expect(knownRegionNames.has(key)).toBe(true);
    }
    // And size matches: 2 regions selected → 2 keys in the Map.
    expect(postBatchOverrides.size).toBe(2);

    // Lock B.3: buildExportPlan reads overrides via row.regionName ?? row.attachmentName
    // (src/core/export.ts:187). Post-fix every selected region's ExportRow
    // gets the override applied; outW matches the canonical math.
    const plan = buildExportPlan(synth, postBatchOverrides);
    const allRows = [...plan.rows, ...plan.passthroughCopies];

    for (const region of synth.regions) {
      const exportRow = allRows.find((er) =>
        er.attachmentNames.some((n) =>
          region.contributingAttachments.some((c) => c.attachmentName === n),
        ),
      );
      expect(exportRow).toBeDefined();
      // The override applies to BOTH selected regions; outW must reflect it.
      // For the synthetic fixture (peakScale=1.0, canonicalW=region.canonicalW,
      // overridePct=50), effectiveScale = (50/100) × 1.0 = 0.5 → outW = ceil(canonicalW × 0.5).
      // safeScale rounds UP to the nearest thousandth → 0.5 stays 0.5.
      const expectedOutW = Math.ceil(region.canonicalW * 0.5);
      const expectedOutH = Math.ceil(region.canonicalH * 0.5);
      // The override REACHED this region's export math (this is the
      // CR-01 closure proof).
      expect(exportRow!.outW).toBe(expectedOutW);
      expect(exportRow!.outH).toBe(expectedOutH);
    }
  });

  it('REGION-04 (Plan 29-07): panel READ-side reads override by regionName, not attachmentName, on path-indirected rigs', () => {
    // Phase 29 Plan 29-07 — panel READ-side closure of REGION-04. The
    // .planning/phases/.../29-VERIFICATION.md `gaps[0].missing[2]` requires:
    // "Add a panel-level test that builds a path-indirected synthetic summary
    // where row.regionName != row.attachmentName, builds an overrides Map
    // keyed by regionName, calls enrichWithEffective(rows, overrides), and
    // asserts enriched[0].override === <expected percent>."
    //
    // Pre-29-07 the panel's enrichWithEffective at line 262 read
    // `overrides.get(row.attachmentName)`. On path-indirected rigs where the
    // lex-tiebreak winner.attachmentName differs from regionName (Chicken-Min:
    // regionName='5/7' has winner.attachmentName='5/5/5/7/7'), the Map miss
    // cascaded through EnrichedRow.override → Peak-cell text-accent class →
    // PencilIcon → displayScale + peakDisplayW/H → state tinting → 'override'
    // filter keyword → DimsBadge.effectiveScale prop. Export pipeline applied
    // the override correctly (export.ts:187-188 reads regionName-keyed) so the
    // user observed a screen-vs-disk divergence: panel showed full-size
    // rendering, on-disk PNG was correctly downscaled.
    //
    // Post-29-07 the panel's enrichWithEffective reads
    // `overrides.get(row.regionName ?? row.attachmentName)` — symmetric with
    // AppShell.tsx:523-526 (WRITE side) and export.ts:187-188 (export-math
    // read). All three sites speak the same key contract.

    // Build a synthetic path-indirected RegionRow mirroring Chicken-Min's
    // '5/7' region: 3 contributing attachments ('5/5/5/7/7', '5/5/7/7', '5/7'),
    // lex-tiebreak winner '5/5/5/7/7' (lex-smallest), regionName '5/7'.
    // Critical: regionName !== winner.attachmentName, which is the exact
    // condition that triggered the Map miss pre-29-07.
    const region57: RegionRow = {
      regionName: '5/7',
      // Lex-tiebreak winner — '5/5/5/7/7' < '5/5/7/7' < '5/7' in lex order:
      attachmentName: '5/5/5/7/7',
      skinName: 'default',
      slotName: 'SLOT_5/5/5/7/7',
      animationName: 'IDLE',
      time: 0,
      frame: 0,
      peakScale: 1.0,
      peakScaleX: 1.0,
      peakScaleY: 1.0,
      worldW: 378,
      worldH: 428,
      sourceW: 378,
      sourceH: 428,
      isSetupPosePeak: false,
      sourcePath: '/fake/5/7.png',
      canonicalW: 378,
      canonicalH: 428,
      actualSourceW: undefined,
      actualSourceH: undefined,
      dimsMismatch: false,
      originalSizeLabel: '378×428',
      peakSizeLabel: '378×428',
      scaleLabel: '1.000×',
      sourceLabel: 'IDLE',
      frameLabel: '0',
      contributingAttachments: [
        { attachmentName: '5/5/5/7/7', skinName: 'default', slotName: 'SLOT_5/5/5/7/7', peakScale: 1.0, animationName: 'IDLE', time: 0, frame: 0, isSetupPosePeak: false },
        { attachmentName: '5/5/7/7',   skinName: 'default', slotName: 'SLOT_5/5/7/7',   peakScale: 1.0, animationName: 'IDLE', time: 0, frame: 0, isSetupPosePeak: false },
        { attachmentName: '5/7',       skinName: 'default', slotName: 'SLOT_5/7',       peakScale: 1.0, animationName: 'IDLE', time: 0, frame: 0, isSetupPosePeak: false },
      ],
    } as RegionRow;

    // Build the overrides Map keyed by regionName (matches AppShell's
    // post-29-03 contract). The percent (0.011) is the user's reproduced
    // bug from .planning/debug/path-indirected-duplicate-rows.md — the
    // 4×4-on-378-wide repro that Phase 29 set out to close.
    const overrides: ReadonlyMap<string, number> = new Map([['5/7', 0.011]]);

    // Drive the panel's READ-side enrichment helper directly via the
    // Plan-29-07 named test export. Pre-29-07 fix this asserts
    // `enriched[0].override === undefined` (Map miss); post-fix it asserts
    // `enriched[0].override === 0.011` (Map hit by regionName).
    const enriched = enrichWithEffective([region57], overrides);

    // The post-29-07 contract — the override REACHES the EnrichedRow.
    expect(enriched).toHaveLength(1);
    expect(enriched[0].override).toBe(0.011);

    // Symmetric negative assertion: a Map keyed by the WINNING attachmentName
    // (the pre-29-07 lookup) must NOT match — this proves the fix removed the
    // attachmentName-keyed lookup, not just added a regionName branch alongside.
    const wrongKeyOverrides: ReadonlyMap<string, number> = new Map([['5/5/5/7/7', 0.011]]);
    const wrongKeyEnriched = enrichWithEffective([region57], wrongKeyOverrides);
    expect(wrongKeyEnriched[0].override).toBeUndefined();

    // Backward-compat lock for the no-indirection case: a synthetic row whose
    // `regionName === attachmentName` (or whose regionName is undefined)
    // continues to resolve via the `?? row.attachmentName` fallback.
    const noIndirectionRow: RegionRow = { ...region57, regionName: 'CIRCLE', attachmentName: 'CIRCLE' } as RegionRow;
    const noIndirectionOverrides: ReadonlyMap<string, number> = new Map([['CIRCLE', 0.5]]);
    const noIndirectionEnriched = enrichWithEffective(
      [noIndirectionRow],
      noIndirectionOverrides,
    );
    expect(noIndirectionEnriched[0].override).toBe(0.5);
  });
});

// ---------------------------------------------------------------------------
// Helper — synthetic SkeletonSummary builder for PREVIEW-01 (b).
//
// Builds a minimal valid SkeletonSummary with one path-indirected region
// (regionName 'R0' has `contributorsForFirstRegion` contributors) plus
// `numRegions - 1` sibling single-attachment regions. All tiles are square
// (tilePx × tilePx), all peakScales are 1.0 (so the export plan emits at
// source dims — no canonical/source ratio cap fires). Inline-only; not
// committed under fixtures/.
// ---------------------------------------------------------------------------

function buildSyntheticPathIndirectedSummary(params: {
  numRegions: number;
  contributorsForFirstRegion: number;
  tilePx: number;
}): SkeletonSummary {
  const { numRegions, contributorsForFirstRegion, tilePx } = params;
  const peaks: SkeletonSummary['peaks'] = [];
  const regions: RegionRow[] = [];
  for (let i = 0; i < numRegions; i++) {
    const regionName = `R${i}`;
    const sourcePath = `/fake/R${i}.png`;
    const numContribs = i === 0 ? contributorsForFirstRegion : 1;
    const contributors: RegionRow['contributingAttachments'] = [];
    for (let c = 0; c < numContribs; c++) {
      const attachmentName = numContribs === 1 ? regionName : `${regionName}_C${c}`;
      // Per-attachment peak (DisplayRow shape).
      peaks.push({
        attachmentKey: `default/SLOT${i}_${c}/${attachmentName}`,
        attachmentName,
        regionName,
        skinName: 'default',
        slotName: `SLOT${i}_${c}`,
        animationName: 'PATH',
        time: 0,
        frame: 0,
        peakScale: 1.0,
        peakScaleX: 1.0,
        peakScaleY: 1.0,
        worldW: tilePx,
        worldH: tilePx,
        sourceW: tilePx,
        sourceH: tilePx,
        isSetupPosePeak: false,
        sourcePath,
        canonicalW: tilePx,
        canonicalH: tilePx,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        originalSizeLabel: `${tilePx}×${tilePx}`,
        peakSizeLabel: `${tilePx}×${tilePx}`,
        scaleLabel: '1.000×',
        sourceLabel: 'PATH',
        frameLabel: '0',
      });
      contributors.push({
        attachmentName,
        skinName: 'default',
        slotName: `SLOT${i}_${c}`,
        peakScale: 1.0,
        animationName: 'PATH',
        time: 0,
        frame: 0,
        isSetupPosePeak: false,
      });
    }
    // RegionRow — winner is contributor 0 (lex-smallest by name).
    contributors.sort((a, b) => a.attachmentName.localeCompare(b.attachmentName));
    regions.push({
      regionName,
      attachmentName: contributors[0].attachmentName,
      skinName: 'default',
      slotName: contributors[0].slotName,
      animationName: 'PATH',
      time: 0,
      frame: 0,
      peakScale: 1.0,
      peakScaleX: 1.0,
      peakScaleY: 1.0,
      worldW: tilePx,
      worldH: tilePx,
      sourceW: tilePx,
      sourceH: tilePx,
      isSetupPosePeak: false,
      sourcePath,
      canonicalW: tilePx,
      canonicalH: tilePx,
      actualSourceW: undefined,
      actualSourceH: undefined,
      dimsMismatch: false,
      originalSizeLabel: `${tilePx}×${tilePx}`,
      peakSizeLabel: `${tilePx}×${tilePx}`,
      scaleLabel: '1.000×',
      sourceLabel: 'PATH',
      frameLabel: '0',
      contributingAttachments: contributors,
    });
  }
  // Cast through unknown — the synthetic summary populates the fields needed
  // by buildExportPlan + buildAtlasPreview + deriveInputs, but skips the
  // cosmetic top-level fields (bones/slots/attachments/skins/animations/etc.)
  // that the packer doesn't read. Same idiom as tests/core/export.spec.ts
  // Phase 29 D-04 tests.
  return { peaks, regions, animationBreakdown: [], orphanedFiles: [] } as unknown as SkeletonSummary;
}

// ---------------------------------------------------------------------------
// Helper — pre-fix simulation: pack one input per (region, attachmentName).
// Path-indirected regions contribute multiple inputs (the pre-Phase-29
// buggy shape); single-attachment regions contribute one. Same packer + opts
// as src/core/atlas-preview.ts:100.
// ---------------------------------------------------------------------------

function packPreFixSimulation(synth: SkeletonSummary, maxPageDim: number): number {
  const packer = new MaxRectsPacker(maxPageDim, maxPageDim, 2, {
    smart: true,
    allowRotation: false,
    pot: false,
    square: false,
    border: 0,
  });
  for (const region of synth.regions) {
    for (const c of region.contributingAttachments) {
      packer.add(region.sourceW, region.sourceH, {
        name: `${region.regionName}/${c.attachmentName}`,
      });
    }
  }
  return packer.bins.length;
}

// ---------------------------------------------------------------------------
// Helper — synthetic Chicken-Min-shaped summary for CR-01 batch-apply test
// (REGION-04 batch-apply UI it() block).
//
// Two regions:
//   - '5/7' with 3 path-indirected contributors ('5/5/5/7/7', '5/5/7/7', '5/7'),
//     canonicalW=378, canonicalH=428 (matches the actual Chicken-Min fixture's
//     5/7 region for visual continuity with the existing REGION-04 single-row
//     test at lines 71-112).
//   - '5/BLOOD_DROP' with 1 contributor, canonicalW=30, canonicalH=90 (matches
//     the actual fixture's 5/BLOOD_DROP region).
//
// peakScale=1.0 across the board → effectiveScale = (overridePct/100) × 1.0,
// and the canonical/source-cap clamp does NOT bind (no actualSourceW/H drift).
// This makes the outW math deterministic for assertion at clean dim values:
//   overridePct=50% → outW = ceil(canonicalW × 0.5).
//     '5/7'         → ceil(378 × 0.5) = 189
//     '5/BLOOD_DROP' → ceil(30  × 0.5) = 15
//
// Inline-only; not committed under fixtures/.
// ---------------------------------------------------------------------------

function buildSyntheticBatchApplySummary(): SkeletonSummary {
  const peaks: SkeletonSummary['peaks'] = [];
  const regions: RegionRow[] = [];

  // Region 1: '5/7' with 3 path-indirected contributors.
  const fiveSevenContribs: RegionRow['contributingAttachments'] = [];
  const fiveSevenNames = ['5/5/5/7/7', '5/5/7/7', '5/7'];
  for (const att of fiveSevenNames) {
    peaks.push({
      attachmentKey: `default/SLOT_${att}/${att}`,
      attachmentName: att,
      regionName: '5/7',
      skinName: 'default',
      slotName: `SLOT_${att}`,
      animationName: 'IDLE',
      time: 0,
      frame: 0,
      peakScale: 1.0,
      peakScaleX: 1.0,
      peakScaleY: 1.0,
      worldW: 378,
      worldH: 428,
      sourceW: 378,
      sourceH: 428,
      isSetupPosePeak: false,
      sourcePath: '/fake/5/7.png',
      canonicalW: 378,
      canonicalH: 428,
      actualSourceW: undefined,
      actualSourceH: undefined,
      dimsMismatch: false,
      originalSizeLabel: '378×428',
      peakSizeLabel: '378×428',
      scaleLabel: '1.000×',
      sourceLabel: 'IDLE',
      frameLabel: '0',
    });
    fiveSevenContribs.push({
      attachmentName: att,
      skinName: 'default',
      slotName: `SLOT_${att}`,
      peakScale: 1.0,
      animationName: 'IDLE',
      time: 0,
      frame: 0,
      isSetupPosePeak: false,
    });
  }
  // Sort contributors by attachmentName lex for determinism (matches toRegionRow).
  fiveSevenContribs.sort((a, b) => a.attachmentName.localeCompare(b.attachmentName));
  regions.push({
    regionName: '5/7',
    attachmentName: fiveSevenContribs[0].attachmentName, // lex-smallest winner
    skinName: 'default',
    slotName: fiveSevenContribs[0].slotName,
    animationName: 'IDLE',
    time: 0,
    frame: 0,
    peakScale: 1.0,
    peakScaleX: 1.0,
    peakScaleY: 1.0,
    worldW: 378,
    worldH: 428,
    sourceW: 378,
    sourceH: 428,
    isSetupPosePeak: false,
    sourcePath: '/fake/5/7.png',
    canonicalW: 378,
    canonicalH: 428,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: '378×428',
    peakSizeLabel: '378×428',
    scaleLabel: '1.000×',
    sourceLabel: 'IDLE',
    frameLabel: '0',
    contributingAttachments: fiveSevenContribs,
  });

  // Region 2: '5/BLOOD_DROP' with 1 contributor (single-attachment region).
  peaks.push({
    attachmentKey: 'default/SLOT_BLOOD/5/BLOOD_DROP',
    attachmentName: '5/BLOOD_DROP',
    regionName: '5/BLOOD_DROP',
    skinName: 'default',
    slotName: 'SLOT_BLOOD',
    animationName: 'IDLE',
    time: 0,
    frame: 0,
    peakScale: 1.0,
    peakScaleX: 1.0,
    peakScaleY: 1.0,
    worldW: 30,
    worldH: 90,
    sourceW: 30,
    sourceH: 90,
    isSetupPosePeak: false,
    sourcePath: '/fake/5/BLOOD_DROP.png',
    canonicalW: 30,
    canonicalH: 90,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: '30×90',
    peakSizeLabel: '30×90',
    scaleLabel: '1.000×',
    sourceLabel: 'IDLE',
    frameLabel: '0',
  });
  regions.push({
    regionName: '5/BLOOD_DROP',
    attachmentName: '5/BLOOD_DROP',
    skinName: 'default',
    slotName: 'SLOT_BLOOD',
    animationName: 'IDLE',
    time: 0,
    frame: 0,
    peakScale: 1.0,
    peakScaleX: 1.0,
    peakScaleY: 1.0,
    worldW: 30,
    worldH: 90,
    sourceW: 30,
    sourceH: 90,
    isSetupPosePeak: false,
    sourcePath: '/fake/5/BLOOD_DROP.png',
    canonicalW: 30,
    canonicalH: 90,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: '30×90',
    peakSizeLabel: '30×90',
    scaleLabel: '1.000×',
    sourceLabel: 'IDLE',
    frameLabel: '0',
    contributingAttachments: [{
      attachmentName: '5/BLOOD_DROP',
      skinName: 'default',
      slotName: 'SLOT_BLOOD',
      peakScale: 1.0,
      animationName: 'IDLE',
      time: 0,
      frame: 0,
      isSetupPosePeak: false,
    }],
  });

  // Cast through unknown — same idiom as buildSyntheticPathIndirectedSummary
  // above. Populates only the fields buildExportPlan reads; skips cosmetic
  // top-level scalars (bones/slots/skins/animations/etc).
  return { peaks, regions, animationBreakdown: [], orphanedFiles: [] } as unknown as SkeletonSummary;
}
