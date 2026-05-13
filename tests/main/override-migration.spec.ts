/**
 * Phase 29 D-06 — `migrateOverrides` helper unit tests.
 *
 * 9 behaviors locked from 29-03-PLAN.md §tasks/Task 1/<behavior>:
 *
 *   1. No migration needed — all keys already region-keyed (or non-indirected).
 *   2. Migration on a single-contributor case (regionName === attachmentName).
 *   3. Path-indirected single-attachment override migrates to regionName.
 *   4. Two contributor keys → lex-smallest contributor wins.
 *  4b. Three contributor keys, scrambled insertion order → lex-smallest still wins.
 *   5. Orphan key → drops into `stale[]`.
 *   6. Mixed Case A region key + Case B contributor key for SAME region →
 *      Case A wins regardless of `Object.entries` iteration order
 *      (falsifying-regression gate for the single-pass-iteration-order defect).
 *   7. Per-key value validation — non-finite / non-number entries silently skipped.
 *   8. Iteration-order independence sentinel — every multi-entry test runs twice
 *      (natural order + reversed) and produces identical output.
 *   9. (helper-internal) factored helper used by all three project-io.ts seams —
 *      tested at unit level here; integration coverage continues at the
 *      handleProjectOpenFromPath / handleProjectResample tests in
 *      tests/main/project-io.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import { migrateOverrides } from '../../src/main/override-migration.js';
import type { DisplayRow, RegionRow, SkeletonSummary } from '../../src/shared/types.js';

// ---------------------------------------------------------------------------
// Test helpers — synthesize a minimal SkeletonSummary whose `regions` carry
// the (attachmentName → regionName) mapping the helper reads. `peaks` is
// retained for legacy fixture readability but the helper no longer reads it
// (the debug `multi-skin-override-stale-on-reload` fix moved sourcing to
// summary.regions for comprehensive multi-skin coverage). Other
// SkeletonSummary fields are filled with defensive defaults.
// ---------------------------------------------------------------------------

function makePeak(attachmentName: string, regionName?: string): DisplayRow {
  return {
    attachmentKey: `default/SLOT/${attachmentName}`,
    skinName: 'default',
    slotName: 'SLOT',
    attachmentName,
    animationName: 'PATH',
    time: 0,
    frame: 0,
    peakScale: 1,
    peakScaleX: 1,
    peakScaleY: 1,
    worldW: 100,
    worldH: 100,
    sourceW: 100,
    sourceH: 100,
    isSetupPosePeak: false,
    originalSizeLabel: '100×100',
    peakSizeLabel: '100×100',
    scaleLabel: '1.000×',
    sourceLabel: 'images/test.png',
    frameLabel: '0',
    sourcePath: '/fake/test.png',
    canonicalW: 100,
    canonicalH: 100,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    regionName: regionName ?? attachmentName,
  };
}

/**
 * Derive a minimal `regions` array from `peaks`. One RegionRow per unique
 * regionName, with every peak sharing that regionName folded into
 * contributingAttachments[]. Mirrors src/main/summary.ts' skin-manifest pass
 * shape closely enough for migrateOverrides' read path. Fields the helper
 * doesn't read are stubbed with defaults.
 */
function deriveRegionsFromPeaks(peaks: DisplayRow[]): RegionRow[] {
  const byRegion = new Map<string, DisplayRow[]>();
  for (const p of peaks) {
    const key = p.regionName ?? p.attachmentName;
    const list = byRegion.get(key) ?? [];
    list.push(p);
    byRegion.set(key, list);
  }
  const regions: RegionRow[] = [];
  for (const [regionName, contributors] of byRegion) {
    const first = contributors[0];
    regions.push({
      regionName,
      attachmentName: first.attachmentName,
      skinName: first.skinName,
      slotName: first.slotName,
      animationName: first.animationName,
      time: first.time,
      frame: first.frame,
      peakScale: first.peakScale,
      peakScaleX: first.peakScaleX,
      peakScaleY: first.peakScaleY,
      worldW: first.worldW,
      worldH: first.worldH,
      sourceW: first.sourceW,
      sourceH: first.sourceH,
      isSetupPosePeak: first.isSetupPosePeak,
      sourcePath: first.sourcePath,
      canonicalW: first.canonicalW,
      canonicalH: first.canonicalH,
      actualSourceW: first.actualSourceW,
      actualSourceH: first.actualSourceH,
      dimsMismatch: first.dimsMismatch,
      originalSizeLabel: first.originalSizeLabel,
      peakSizeLabel: first.peakSizeLabel,
      scaleLabel: first.scaleLabel,
      sourceLabel: first.sourceLabel,
      frameLabel: first.frameLabel,
      contributingAttachments: contributors.map((c) => ({
        attachmentName: c.attachmentName,
        skinName: c.skinName,
        slotName: c.slotName,
        peakScale: c.peakScale,
        animationName: c.animationName,
        time: c.time,
        frame: c.frame,
        isSetupPosePeak: c.isSetupPosePeak,
      })),
    });
  }
  return regions;
}

function makeSummary(peaks: DisplayRow[], regions?: RegionRow[]): SkeletonSummary {
  return {
    skeletonPath: '/fake/skel.json',
    atlasPath: null,
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: peaks.length, byType: {} },
    skins: { count: 1, names: ['default'] },
    animations: { count: 1, names: ['PATH'] },
    events: { count: 0, names: [] },
    peaks,
    regions: regions ?? deriveRegionsFromPeaks(peaks),
    animationBreakdown: [],
    skippedAttachments: [],
    elapsedMs: 0,
    editorFps: 30,
  } as unknown as SkeletonSummary;
}

/**
 * Iteration-order-independence runner — Test 9's structural guard. Runs the
 * scenario twice: once with natural insertion order, once with reversed
 * insertion order. Asserts both produce the same `restored` (deep-equal),
 * the same `stale` (set-equal), and the same `migratedKeyCount`. This
 * catches the single-pass defect where Case B can clobber Case A based
 * purely on Object.entries traversal order.
 */
function expectIterationOrderIndependent(
  label: string,
  savedOverrides: Record<string, number>,
  summary: SkeletonSummary,
): { restored: Record<string, number>; stale: string[]; migratedKeyCount: number } {
  const natural = migrateOverrides(savedOverrides, summary);
  // Reverse the entries by reconstructing in reverse insertion order.
  const reversedEntries = Object.entries(savedOverrides).reverse();
  const reversed: Record<string, unknown> = {};
  for (const [k, v] of reversedEntries) reversed[k] = v;
  const reversedResult = migrateOverrides(reversed, summary);
  expect(reversedResult.restored, `[${label}] restored differs across iteration orders`).toEqual(
    natural.restored,
  );
  expect(
    new Set(reversedResult.stale),
    `[${label}] stale set differs across iteration orders`,
  ).toEqual(new Set(natural.stale));
  expect(
    reversedResult.migratedKeyCount,
    `[${label}] migratedKeyCount differs across iteration orders`,
  ).toBe(natural.migratedKeyCount);
  return natural;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migrateOverrides — Phase 29 D-06 (project-io.ts shared helper)', () => {
  it('Test 1: no migration needed (every attachmentName === regionName)', () => {
    const summary = makeSummary([
      makePeak('CIRCLE'),
      makePeak('SQUARE'),
      makePeak('TRIANGLE'),
    ]);
    const saved = { CIRCLE: 50, SQUARE: 75 };
    const result = expectIterationOrderIndependent('Test 1', saved, summary);
    expect(result.restored).toEqual({ CIRCLE: 50, SQUARE: 75 });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(0);
  });

  it('Test 2: single-contributor region — present-region branch wins, no migration counted', () => {
    // CIRCLE has one contributor with regionName === attachmentName ===
    // 'CIRCLE'. Saved override key 'CIRCLE' is BOTH a region name AND an
    // attachment name; Pass 1 (Case A) handles it as a regionName entry.
    const summary = makeSummary([makePeak('CIRCLE')]);
    const saved = { CIRCLE: 42 };
    const result = migrateOverrides(saved, summary);
    expect(result.restored).toEqual({ CIRCLE: 42 });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(0);
  });

  it("Test 3: path-indirected single-attachment override migrates ('5/5/7/7' → '5/7')", () => {
    // Region '5/7' has 3 contributing attachments. Saved override is keyed
    // by ONE contributor's attachmentName (mid-lex). Migration writes to
    // restored['5/7'] and counts 1 in migratedKeyCount.
    const summary = makeSummary([
      makePeak('5/5/5/7/7', '5/7'),
      makePeak('5/5/7/7', '5/7'),
      makePeak('5/7', '5/7'),
    ]);
    const saved = { '5/5/7/7': 25 };
    const result = migrateOverrides(saved, summary);
    expect(result.restored).toEqual({ '5/7': 25 });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(1);
  });

  it('Test 4: two contributor keys for same region — lex-smallest contributor wins', () => {
    // Region '5/7' has 2 contributors; saved overrides have BOTH contributor
    // keys, NO region key. Lex-smallest of {'5/5/5/7/7', '5/5/7/7'} is
    // '5/5/5/7/7' → its value (30) wins over '5/5/7/7' (40).
    const summary = makeSummary([
      makePeak('5/5/5/7/7', '5/7'),
      makePeak('5/5/7/7', '5/7'),
    ]);
    const saved = { '5/5/5/7/7': 30, '5/5/7/7': 40 };
    const result = expectIterationOrderIndependent('Test 4', saved, summary);
    expect(result.restored).toEqual({ '5/7': 30 });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(2);
  });

  it('Test 4b: three contributor keys (scrambled insertion order) — lex-smallest still wins', () => {
    // Region '5/7' has 3 contributors; saved overrides scrambled-insert all
    // three contributor keys. Lex-smallest of {'5/5/5/7/7', '5/5/7/7', '7/5/5'}
    // is '5/5/5/7/7' → its value (30) wins regardless of insertion order.
    const summary = makeSummary([
      makePeak('5/5/5/7/7', '5/7'),
      makePeak('5/5/7/7', '5/7'),
      makePeak('7/5/5', '5/7'),
    ]);
    const saved = { '5/5/7/7': 40, '7/5/5': 60, '5/5/5/7/7': 30 };
    const result = expectIterationOrderIndependent('Test 4b', saved, summary);
    expect(result.restored).toEqual({ '5/7': 30 });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(3);
  });

  it('Test 5: orphan key (no region, no attachment) drops to stale[]', () => {
    const summary = makeSummary([makePeak('CIRCLE')]);
    const saved = { NONEXISTENT: 50 };
    const result = migrateOverrides(saved, summary);
    expect(result.restored).toEqual({});
    expect(result.stale).toEqual(['NONEXISTENT']);
    expect(result.migratedKeyCount).toBe(0);
  });

  it('Test 6 (single-pass-defect falsifying gate): Case A wins over Case B regardless of insertion order', () => {
    // Region '5/7' has 3 contributors. Saved overrides have a region key
    // ('5/7' = 50) AND a contributor key ('5/5/5/7/7' = 30). The user's
    // deliberate v1.3.1+ region-key value MUST win over the v1.3-era stale
    // contributor — REGARDLESS of Object.entries iteration order.
    const summary = makeSummary([
      makePeak('5/5/5/7/7', '5/7'),
      makePeak('5/5/7/7', '5/7'),
      makePeak('5/7', '5/7'),
    ]);

    // Insertion order A: contributor first, region second.
    const savedA = { '5/5/5/7/7': 30, '5/7': 50 };
    const resA = migrateOverrides(savedA, summary);
    expect(resA.restored).toEqual({ '5/7': 50 });
    expect(resA.stale).toEqual([]);
    expect(resA.migratedKeyCount).toBe(1); // contributor consumed by Pass 2 dropped-because-Pass-1-won

    // Insertion order B: region first, contributor second.
    const savedB = { '5/7': 50, '5/5/5/7/7': 30 };
    const resB = migrateOverrides(savedB, summary);
    expect(resB.restored).toEqual({ '5/7': 50 });
    expect(resB.stale).toEqual([]);
    expect(resB.migratedKeyCount).toBe(1);

    // Both must produce identical results — that is the falsifying property.
    expect(resA).toEqual(resB);
  });

  it('Test 7: per-key value validation — non-numeric / NaN / Infinity silently skipped', () => {
    const summary = makeSummary([makePeak('CIRCLE'), makePeak('SQUARE')]);
    const saved = {
      CIRCLE: 'not-a-number' as unknown as number, // typeof !== 'number' — skipped
      SQUARE: NaN,                                  // !Number.isFinite — skipped
      TRI_OF_INFINITY: Infinity,                    // !Number.isFinite — skipped
    } as Record<string, number>;
    const result = migrateOverrides(saved, summary);
    expect(result.restored).toEqual({});
    expect(result.stale).toEqual([]); // bad values skipped, NEVER counted
    expect(result.migratedKeyCount).toBe(0);
  });

  it('Test 7b: per-key value validation preserves valid entries alongside invalid ones', () => {
    // Mix of one valid Case A entry and one bad-value entry on the same
    // region. The valid one survives; the bad one is silently skipped.
    const summary = makeSummary([makePeak('CIRCLE'), makePeak('SQUARE')]);
    const saved = {
      CIRCLE: 75,
      SQUARE: NaN as unknown as number,
    } as Record<string, number>;
    const result = migrateOverrides(saved, summary);
    expect(result.restored).toEqual({ CIRCLE: 75 });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(0);
  });

  it('Test 9 (multi-skin regression — debug skins-override-stale-on-reload): overrides on non-active-skin regions survive when summary.regions is comprehensive but summary.peaks is active-skin-only', () => {
    // The user's repro: a 7-skin rig where summary.peaks only contains the
    // active skin's contributors (BEACHMAN/*), but summary.regions is the
    // comprehensive skin-manifest pass and includes all skins' regions
    // (BEACHMAN/* AND AVATAR/* AND others). Saved overrides keyed by AVATAR/*
    // region names previously dropped to stale[] because migrateOverrides
    // sourced presentRegions from summary.peaks. The fix sources from
    // summary.regions; this test locks the contract.
    //
    // Concrete fixture: peaks = BEACHMAN-only; regions = BEACHMAN/CARDS_L_HAND_1
    // (with BEACHMAN as a contributing attachment) AND AVATAR/CARDS_L_HAND_1
    // (with NO peak — the skin isn't active so no peak ever fired, but the
    // region is declared in the skin manifest).
    const peaks: DisplayRow[] = [makePeak('CARDS_L_HAND_1', 'BEACHMAN/CARDS_L_HAND_1')];
    const regions: RegionRow[] = [
      ...deriveRegionsFromPeaks(peaks),
      // The smoking-gun region: present in summary.regions but NOT in
      // summary.peaks. Pre-fix, migrateOverrides has no knowledge of this
      // region and classifies a saved 'AVATAR/CARDS_L_HAND_1' override as
      // an orphan → stale[].
      {
        regionName: 'AVATAR/CARDS_L_HAND_1',
        attachmentName: 'CARDS_L_HAND_1',
        skinName: 'AVATAR',
        slotName: 'SLOT',
        animationName: 'setup-pose',
        time: 0,
        frame: 0,
        peakScale: 0,
        peakScaleX: 0,
        peakScaleY: 0,
        worldW: 0,
        worldH: 0,
        sourceW: 64,
        sourceH: 64,
        isSetupPosePeak: true,
        sourcePath: '/fake/avatar.png',
        canonicalW: 64,
        canonicalH: 64,
        actualSourceW: undefined,
        actualSourceH: undefined,
        dimsMismatch: false,
        originalSizeLabel: '64×64',
        peakSizeLabel: '0×0',
        scaleLabel: '0.000×',
        sourceLabel: 'AVATAR/CARDS_L_HAND_1',
        frameLabel: '0',
        contributingAttachments: [
          {
            attachmentName: 'CARDS_L_HAND_1',
            skinName: 'AVATAR',
            slotName: 'SLOT',
            peakScale: 0,
            animationName: 'setup-pose',
            time: 0,
            frame: 0,
            isSetupPosePeak: true,
          },
        ],
      },
    ];
    const summary = makeSummary(peaks, regions);

    // User's saved overrides include both an active-skin entry and a
    // non-active-skin entry. Pre-fix: the AVATAR/* entry drops to stale.
    // Post-fix: both restore cleanly.
    const saved = {
      'BEACHMAN/CARDS_L_HAND_1': 67,
      'AVATAR/CARDS_L_HAND_1': 67,
    };
    const result = migrateOverrides(saved, summary);
    expect(result.restored).toEqual({
      'BEACHMAN/CARDS_L_HAND_1': 67,
      'AVATAR/CARDS_L_HAND_1': 67,
    });
    expect(result.stale).toEqual([]);
    expect(result.migratedKeyCount).toBe(0);
  });

  it('Test 8: combined fixture — Case A + Case B + Case C all in one input', () => {
    // Three regions present:
    //   - 'CIRCLE': 1 contributor, no indirection.
    //   - '5/7': 3 contributors (path-indirected).
    //   - 'SQUARE': 1 contributor.
    // Saved input mixes:
    //   - 'CIRCLE': 50  → Case A (region key, 1 contributor)
    //   - '5/5/7/7': 25 → Case B contributor for '5/7'
    //   - '7/5/5': 80   → Case B contributor for ANOTHER region also called '5/7'
    //                     (same target — lex-smallest '5/5/7/7' wins between them)
    //   - 'GHOST': 99   → Case C orphan
    const summary = makeSummary([
      makePeak('CIRCLE'),
      makePeak('SQUARE'),
      makePeak('5/5/5/7/7', '5/7'),
      makePeak('5/5/7/7', '5/7'),
      makePeak('7/5/5', '5/7'),
    ]);
    const saved = {
      CIRCLE: 50,
      '5/5/7/7': 25,
      '7/5/5': 80,
      GHOST: 99,
    };
    const result = expectIterationOrderIndependent('Test 8', saved, summary);
    expect(result.restored).toEqual({ CIRCLE: 50, '5/7': 25 });
    expect(result.stale).toEqual(['GHOST']);
    expect(result.migratedKeyCount).toBe(2); // both '5/5/7/7' and '7/5/5' consumed
  });

  it('Test 10 (Phase 36 OVR-04): per-bucket migration runs independently against shared summary.regions', () => {
    // Atlas-source bucket has CIRCLE override; atlas-less bucket has SQUARE
    // override. Both regions exist in summary.regions. Per-bucket migration
    // produces identical results to running each in isolation.
    const summary = makeSummary([makePeak('CIRCLE'), makePeak('SQUARE')]);
    const aSrc = migrateOverrides({ CIRCLE: 75 }, summary);
    const aLess = migrateOverrides({ SQUARE: 50 }, summary);
    expect(aSrc.restored).toEqual({ CIRCLE: 75 });
    expect(aSrc.stale).toEqual([]);
    expect(aLess.restored).toEqual({ SQUARE: 50 });
    expect(aLess.stale).toEqual([]);
    // OVR-04 sum semantics:
    expect(aSrc.migratedKeyCount + aLess.migratedKeyCount).toBe(0);
    // OVR-04 union semantics:
    expect([...new Set([...aSrc.stale, ...aLess.stale])]).toEqual([]);
  });

  it('Test 11 (Phase 36 OVR-04): stale keys union across buckets (Case C orphans in both)', () => {
    const summary = makeSummary([makePeak('CIRCLE')]);
    const aSrc = migrateOverrides({ ORPHAN_A: 25 }, summary);
    const aLess = migrateOverrides({ ORPHAN_B: 50 }, summary);
    expect(aSrc.stale).toEqual(['ORPHAN_A']);
    expect(aLess.stale).toEqual(['ORPHAN_B']);
    const union = [...new Set([...aSrc.stale, ...aLess.stale])];
    expect(union.sort()).toEqual(['ORPHAN_A', 'ORPHAN_B']);
  });
});
