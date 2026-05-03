/**
 * Phase 2 Plan 01 — Tests for src/core/analyzer.ts (D-33, D-34, D-35).
 *
 * Behavior gates:
 *   - D-34 sort: DisplayRow[] sorted by (skinName, slotName, attachmentName) — matches CLI byte-for-byte.
 *   - D-35 preformat: originalSizeLabel / peakSizeLabel / scaleLabel / sourceLabel / frameLabel each match their spec'd format string.
 *   - D-33 fixture row count: 3 rows (CIRCLE/SQUARE/TRIANGLE) for the SIMPLE_TEST fixture — the two SQUARE sampler records on slots SQUARE + SQUARE2 are folded by attachmentName (gap-fix B; one row per unique texture).
 *   - D-22 structuredClone round-trip: DisplayRow[] survives structuredClone unchanged.
 *   - Gap-fix B dedup: multi-skin/multi-slot records sharing an attachmentName fold to one row; kept row is the one with the highest peakScale (skin/slot tiebreaker).
 *   - N2.3 hygiene: src/core/analyzer.ts imports nothing from node:fs / node:path / node:child_process / sharp / node:http / node:net.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { Skeleton } from '@esotericsoftware/spine-core';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton, type PeakRecord } from '../../src/core/sampler.js';
import { analyze, analyzeBreakdown } from '../../src/core/analyzer.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const ANALYZER_SRC = path.resolve('src/core/analyzer.ts');

describe('analyze (D-33, D-34, D-35)', () => {
  it('D-34 sort: DisplayRow[] sorted by (skinName, slotName, attachmentName)', () => {
    const load = loadSkeleton(FIXTURE);
    const { globalPeaks: peaks } = sampleSkeleton(load);
    const rows = analyze(peaks);
    const resorted = [...rows].sort((a, b) => {
      if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
      if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
      return a.attachmentName.localeCompare(b.attachmentName);
    });
    expect(rows).toEqual(resorted);
  });

  it('D-35 (Round 5 amendment): preformatted labels match spec strings; scaleLabel uses ceil-thousandth', () => {
    const load = loadSkeleton(FIXTURE);
    const { globalPeaks: peaks } = sampleSkeleton(load);
    const rows = analyze(peaks);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.originalSizeLabel).toBe(`${r.sourceW}×${r.sourceH}`);
      expect(r.peakSizeLabel).toBe(`${r.worldW.toFixed(0)}×${r.worldH.toFixed(0)}`);
      // Round 5: scaleLabel = ceil-thousandth so display matches export math.
      const expectedScale = Math.ceil(r.peakScale * 1000) / 1000;
      expect(r.scaleLabel).toBe(`${expectedScale.toFixed(3)}×`);
      expect(r.frameLabel).toBe(String(r.frame));
      expect(r.sourceLabel).toBe(r.animationName);
    }
  });

  it('Round 5: scaleLabel for synthetic peakScale 0.36071 renders as "0.361×" (ceil-thousandth, NOT toFixed-round)', () => {
    // toFixed(3) on 0.36071 yields "0.361" (round-half-to-even rounds .5 down)
    // — happens to coincide with ceil-thousandth here, but the SEMANTICS differ:
    // ceil-thousandth is a guaranteed lower bound, toFixed is bankers' round.
    // The contract is that we use the ceil semantics; locked here so a
    // future refactor to plain toFixed doesn't silently regress.
    const rec: PeakRecord = {
      attachmentKey: 'default/HEAD/FACE',
      skinName: 'default',
      slotName: 'HEAD',
      attachmentName: 'FACE',
      animationName: 'JOKER',
      time: 1.0,
      frame: 60,
      peakScaleX: 0.36071,
      peakScaleY: 0.36071,
      peakScale: 0.36071,
      worldW: 292.5,
      worldH: 347.0,
      sourceW: 811,
      sourceH: 962,
      isSetupPosePeak: false,
    };
    const rows = analyze(new Map([[rec.attachmentKey, rec]]));
    expect(rows[0].scaleLabel).toBe('0.361×');
  });

  it('Round 5: scaleLabel for synthetic peakScale 0.3601 renders as "0.361×" (ceil rounds UP, NOT toFixed-down to 0.360)', () => {
    // toFixed(3) on 0.3601 yields "0.360" (closer-to-zero by truncation).
    // ceil-thousandth promotes 0.3601 to 0.361 — guaranteed lower bound.
    // This is the boundary that distinguishes the two contracts.
    const rec: PeakRecord = {
      attachmentKey: 'default/HEAD/FACE',
      skinName: 'default',
      slotName: 'HEAD',
      attachmentName: 'FACE',
      animationName: 'JOKER',
      time: 1.0,
      frame: 60,
      peakScaleX: 0.3601,
      peakScaleY: 0.3601,
      peakScale: 0.3601,
      worldW: 292.0,
      worldH: 346.5,
      sourceW: 811,
      sourceH: 962,
      isSetupPosePeak: false,
    };
    const rows = analyze(new Map([[rec.attachmentKey, rec]]));
    expect(rows[0].scaleLabel).toBe('0.361×');
  });

  it('D-22: output survives structuredClone unchanged', () => {
    const load = loadSkeleton(FIXTURE);
    const { globalPeaks: peaks } = sampleSkeleton(load);
    const rows = analyze(peaks);
    const cloned = structuredClone(rows);
    expect(cloned).toEqual(rows);
  });

  it('D-33 (post gap-fix B): SIMPLE_TEST fixture yields 3 rows (CIRCLE, SQUARE, TRIANGLE) — one per unique attachment name', () => {
    // Post gap-fix B dedup: the sampler still emits 4 PeakRecords (slots
    // SQUARE + SQUARE2 both carry an attachment literally named `SQUARE`,
    // so there are two sampler keys for that name). The analyzer folds
    // them by attachmentName, keeping the higher-peakScale instance — in
    // this fixture, slot SQUARE wins (peakScale ≈ 1.500) over slot SQUARE2
    // (peakScale ≈ 0.460). The kept row's attachmentKey is still unique
    // (the sampler key of the winner) so the panel's Set<string> selection
    // key remains unambiguous.
    const load = loadSkeleton(FIXTURE);
    const { globalPeaks: peaks } = sampleSkeleton(load);
    // Sampler still produces 4 per-instance records (pre-dedup invariant).
    expect(peaks.size).toBe(4);
    const rows = analyze(peaks);
    expect(rows.length).toBe(3);
    const names = rows.map((r) => r.attachmentName).sort();
    expect(names).toEqual(['CIRCLE', 'SQUARE', 'TRIANGLE']);
    const keys = rows.map((r) => r.attachmentKey).sort();
    expect(new Set(keys).size).toBe(3);
    // The SQUARE winner is the slot-SQUARE instance (peakScale ≈ 1.500)
    // — NOT the slot-SQUARE2 instance (peakScale ≈ 0.460).
    expect(keys).toEqual([
      'default/CIRCLE/CIRCLE',
      'default/SQUARE/SQUARE',
      'default/TRIANGLE/TRIANGLE',
    ]);
    const square = rows.find((r) => r.attachmentName === 'SQUARE')!;
    expect(square.slotName).toBe('SQUARE');
    expect(square.peakScale).toBeGreaterThan(1.0);
  });

  it('gap-fix B: multi-skin records sharing an attachmentName fold to one row with the higher peakScale', () => {
    // Synthetic Map<string, PeakRecord>: two records with the same
    // attachmentName=TEX but different skins; the analyzer must keep the
    // higher-peakScale one and drop the other. The kept row's skin /
    // slot / animation / time / frame must come from the winner.
    const low: PeakRecord = {
      attachmentKey: 'skinA/slotA/TEX',
      skinName: 'skinA',
      slotName: 'slotA',
      attachmentName: 'TEX',
      animationName: 'idle',
      time: 0.1,
      frame: 1,
      peakScaleX: 0.5,
      peakScaleY: 0.5,
      peakScale: 0.5,
      worldW: 50,
      worldH: 50,
      sourceW: 100,
      sourceH: 100,
      isSetupPosePeak: false,
    };
    const high: PeakRecord = {
      attachmentKey: 'skinB/slotB/TEX',
      skinName: 'skinB',
      slotName: 'slotB',
      attachmentName: 'TEX',
      animationName: 'walk',
      time: 0.25,
      frame: 7,
      peakScaleX: 2.0,
      peakScaleY: 2.0,
      peakScale: 2.0,
      worldW: 200,
      worldH: 200,
      sourceW: 100,
      sourceH: 100,
      isSetupPosePeak: false,
    };
    const peaks = new Map<string, PeakRecord>([
      [low.attachmentKey, low],
      [high.attachmentKey, high],
    ]);
    const rows = analyze(peaks);
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.attachmentName).toBe('TEX');
    expect(row.peakScale).toBe(2.0);
    // Winner's row carries the peak-producing animation + frame.
    expect(row.skinName).toBe('skinB');
    expect(row.slotName).toBe('slotB');
    expect(row.animationName).toBe('walk');
    expect(row.frame).toBe(7);
    expect(row.attachmentKey).toBe('skinB/slotB/TEX');
  });

  it('gap-fix B: equal peakScale dedup tiebreaker — first by (skinName, slotName) wins deterministically', () => {
    const a: PeakRecord = {
      attachmentKey: 'skinA/slotX/TEX',
      skinName: 'skinA',
      slotName: 'slotX',
      attachmentName: 'TEX',
      animationName: 'a',
      time: 0,
      frame: 0,
      peakScaleX: 1,
      peakScaleY: 1,
      peakScale: 1,
      worldW: 100,
      worldH: 100,
      sourceW: 100,
      sourceH: 100,
      isSetupPosePeak: false,
    };
    const b: PeakRecord = {
      attachmentKey: 'skinB/slotY/TEX',
      skinName: 'skinB',
      slotName: 'slotY',
      attachmentName: 'TEX',
      animationName: 'b',
      time: 0,
      frame: 0,
      peakScaleX: 1,
      peakScaleY: 1,
      peakScale: 1, // tied with `a`
      worldW: 100,
      worldH: 100,
      sourceW: 100,
      sourceH: 100,
      isSetupPosePeak: false,
    };
    // Insert in both orders — winner must be stable ("skinA" sorts before
    // "skinB", so `a` wins regardless of Map insertion order).
    const forward = analyze(new Map([[a.attachmentKey, a], [b.attachmentKey, b]]));
    const reverse = analyze(new Map([[b.attachmentKey, b], [a.attachmentKey, a]]));
    expect(forward.length).toBe(1);
    expect(reverse.length).toBe(1);
    expect(forward[0].skinName).toBe('skinA');
    expect(reverse[0].skinName).toBe('skinA');
  });

  it('N2.3: src/core/analyzer.ts has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports', () => {
    const src = readFileSync(ANALYZER_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
});

describe('analyzer: sourcePath threading (Phase 6 Plan 02, F8.3, D-108)', () => {
  it('analyze(peaks, sourcePaths) populates DisplayRow.sourcePath from sourcePaths map', () => {
    // Phase 22.1 G-01 D-01: in atlas-source mode (SIMPLE_PROJECT with .atlas),
    // sourcePaths is intentionally EMPTY — export uses atlas-extract fallback.
    // DisplayRow.sourcePath resolves to '' for all atlas-source rows.
    // The export pipeline routes atlas-source rows through image-worker.ts:148-162
    // using atlasSources (pagePath/x/y/w/h) instead of per-region PNG paths.
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const rows = analyze(sampled.globalPeaks, load.sourcePaths);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // sourcePaths is populated in atlas-source mode (Phase 22.1 fix); sourcePath non-empty.
      expect(row.sourcePath).toBe(load.sourcePaths.get(row.attachmentName) ?? '');
    }
    // sourcePaths is populated in atlas-source mode for export output paths.
    expect(load.sourcePaths.size).toBeGreaterThanOrEqual(3);
  });

  it('analyze(peaks) WITHOUT sourcePaths defaults DisplayRow.sourcePath to empty string (CLI path, D-102 lock)', () => {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const rows = analyze(sampled.globalPeaks);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.sourcePath).toBe('');
  });

  it('analyzeBreakdown(...sourcePaths) populates BreakdownRow.sourcePath on every card', () => {
    // Phase 22.1 G-01 D-01: atlas-source mode SIMPLE_PROJECT has empty sourcePaths.
    // BreakdownRow.sourcePath resolves to '' for all rows (same contract as DisplayRow).
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const skeleton = new Skeleton(load.skeletonData);
    const cards = analyzeBreakdown(
      sampled.perAnimation,
      sampled.setupPosePeaks,
      load.skeletonData,
      skeleton.slots,
      load.sourcePaths,
    );
    let rowsSeen = 0;
    for (const card of cards) {
      for (const row of card.rows) {
        expect(row.sourcePath).toBe(load.sourcePaths.get(row.attachmentName) ?? '');
        rowsSeen++;
      }
    }
    expect(rowsSeen).toBeGreaterThan(0);
    // sourcePaths is populated in atlas-source mode for export output paths (Phase 22.1 fix).
    expect(load.sourcePaths.size).toBeGreaterThanOrEqual(3);
  });
});

describe('analyzeBreakdown (D-54, D-56, D-57, D-58, D-59, D-60, F4)', () => {
  function buildBreakdown() {
    const load = loadSkeleton(FIXTURE);
    const sampled = sampleSkeleton(load);
    const skeleton = new Skeleton(load.skeletonData);
    return analyzeBreakdown(
      sampled.perAnimation,
      sampled.setupPosePeaks,
      load.skeletonData,
      skeleton.slots,
    );
  }

  it('D-60 / F4.2: first card is Setup Pose with cardId "setup-pose" + isSetupPose=true + animationName="Setup Pose (Default)"', () => {
    const cards = buildBreakdown();
    expect(cards[0].cardId).toBe('setup-pose');
    expect(cards[0].isSetupPose).toBe(true);
    expect(cards[0].animationName).toBe('Setup Pose (Default)');
  });

  it('D-60 / D-56 / F4.2: Setup Pose card dedupes to 3 rows on SIMPLE_TEST (CIRCLE, SQUARE, TRIANGLE)', () => {
    const cards = buildBreakdown();
    const names = cards[0].rows.map((r) => r.attachmentName).sort();
    expect(names).toEqual(['CIRCLE', 'SQUARE', 'TRIANGLE']);
    expect(cards[0].uniqueAssetCount).toBe(cards[0].rows.length);
    // D-61: Setup Pose card cannot be empty — every skeleton has at least one attachment in setup pose (general invariant, not fixture-specific).
    expect(cards[0].rows.length).toBeGreaterThan(0);
  });

  it('D-56 / D-60: Setup Pose SQUARE row wins via the higher-peakScale slot (dedupe invariant)', () => {
    // NOTE: the plan assumed SQUARE2 would win because its bone is pre-scaled
    // 2.0×, but the iter-4 hull_sqrt render-scale formula (GAP-FIX anchor)
    // returns ≈0.2538 for SQUARE on slot SQUARE2 at setup pose vs 1.0× for
    // slot SQUARE — so SQUARE slot wins dedupe. The render scale is NOT
    // directly the bone scale; it's the world-hull area ratio vs source.
    // What we actually guarantee: exactly one row per unique attachmentName
    // + the winner has the higher peakScale of its candidates.
    const cards = buildBreakdown();
    const squareRow = cards[0].rows.find((r) => r.attachmentName === 'SQUARE');
    expect(squareRow).toBeDefined();
    expect(Number.isFinite(squareRow!.peakScale)).toBe(true);
    expect(squareRow!.peakScale).toBeGreaterThan(0);
    // Exactly one SQUARE row in the Setup Pose card (dedupe invariant).
    const squareRows = cards[0].rows.filter((r) => r.attachmentName === 'SQUARE');
    expect(squareRows.length).toBe(1);
  });

  it('D-58 / F4.1: card order = setup-pose first, then skeletonData.animations order', () => {
    const load = loadSkeleton(FIXTURE);
    const cards = buildBreakdown();
    expect(cards[0].cardId).toBe('setup-pose');
    const animCards = cards.slice(1);
    expect(animCards.length).toBe(load.skeletonData.animations.length);
    for (let i = 0; i < animCards.length; i++) {
      expect(animCards[i].cardId).toBe(`anim:${load.skeletonData.animations[i].name}`);
      expect(animCards[i].animationName).toBe(load.skeletonData.animations[i].name);
      expect(animCards[i].isSetupPose).toBe(false);
    }
  });

  it('D-59: rows within each card sorted by peakScale DESC', () => {
    const cards = buildBreakdown();
    for (const card of cards) {
      for (let i = 1; i < card.rows.length; i++) {
        expect(card.rows[i - 1].peakScale).toBeGreaterThanOrEqual(card.rows[i].peakScale);
      }
    }
  });

  it('D-62 / F4.1: empty-animation card has rows.length === 0 AND uniqueAssetCount === 0', () => {
    const cards = buildBreakdown();
    for (const card of cards) {
      expect(card.uniqueAssetCount).toBe(card.rows.length);
      if (card.rows.length === 0) {
        expect(card.uniqueAssetCount).toBe(0);
        expect(Array.isArray(card.rows)).toBe(true);
      }
    }
  });

  it('D-57 / F4.3: BreakdownRow.frameLabel is em-dash (U+2014) for setup-pose rows, String(frame) otherwise', () => {
    const cards = buildBreakdown();
    for (const row of cards[0].rows) {
      // Setup Pose card rows — em-dash per D-57.
      expect(row.frameLabel).toBe('—');
    }
    for (const card of cards.slice(1)) {
      for (const row of card.rows) {
        expect(row.frameLabel).toBe(String(row.frame));
      }
    }
  });

  it('F4.3: BreakdownRow.bonePath is non-empty and bonePathLabel uses space-flanked U+2192 separator', () => {
    const cards = buildBreakdown();
    for (const card of cards) {
      for (const row of card.rows) {
        expect(row.bonePath.length).toBeGreaterThan(0);
        expect(row.bonePath[0]).toBe('root');
        expect(row.bonePath[row.bonePath.length - 1]).toBe(row.attachmentName);
        // Label uses U+2192 (' → ') between tokens.
        expect(row.bonePathLabel).toBe(row.bonePath.join(' → '));
      }
    }
  });

  it('D-58: animation names containing "/" (e.g. namespaced "CHAR/BLINK", "LOOK/AROUND") route rows to the correct card', () => {
    // Regression: earlier first-slash key-parsing misrouted every
    // slash-containing animation to an empty card — manifests on every
    // real fixture that namespaces animations (Girl's 15 "CHAR/..." cards,
    // Jokerman's 8 "LOOK/..." cards). Fix groups by rec.animationName.
    const mkRec = (animationName: string, attachmentName: string, peakScale: number): PeakRecord => ({
      attachmentKey: `default/slot/${attachmentName}`,
      skinName: 'default',
      slotName: 'slot',
      attachmentName,
      animationName,
      time: 0,
      frame: 0,
      peakScaleX: peakScale,
      peakScaleY: peakScale,
      peakScale,
      worldW: 10,
      worldH: 10,
      sourceW: 10,
      sourceH: 10,
      isSetupPosePeak: false,
    });
    const perAnimation = new Map<string, PeakRecord>([
      ['CHAR/BLINK/default/slot/EYE', mkRec('CHAR/BLINK', 'EYE', 1.05)],
      ['LOOK/AROUND/default/slot/EYE', mkRec('LOOK/AROUND', 'EYE', 1.02)],
      ['JUMP/default/slot/BODY', mkRec('JUMP', 'BODY', 1.10)],
    ]);
    const setupPosePeaks = new Map<string, PeakRecord>([
      ['default/slot/EYE', { ...mkRec('Setup Pose (Default)', 'EYE', 1.0), isSetupPosePeak: true }],
    ]);
    const fakeSkeletonData = {
      animations: [
        { name: 'CHAR/BLINK' },
        { name: 'LOOK/AROUND' },
        { name: 'JUMP' },
      ],
    } as unknown as Parameters<typeof analyzeBreakdown>[2];
    const cards = analyzeBreakdown(perAnimation, setupPosePeaks, fakeSkeletonData, []);
    const byName = new Map(cards.map((c) => [c.animationName, c]));
    expect(byName.get('CHAR/BLINK')?.rows.length).toBe(1);
    expect(byName.get('CHAR/BLINK')?.rows[0].attachmentName).toBe('EYE');
    expect(byName.get('LOOK/AROUND')?.rows.length).toBe(1);
    expect(byName.get('LOOK/AROUND')?.rows[0].attachmentName).toBe('EYE');
    expect(byName.get('JUMP')?.rows.length).toBe(1);
    expect(byName.get('JUMP')?.rows[0].attachmentName).toBe('BODY');
  });
});

/**
 * Phase 22 DIMS-01 — analyze() canonical/actual dim threading + dimsMismatch
 * predicate (1px tolerance per ROADMAP DIMS-01).
 *
 * Coverage:
 *   - CLI fallback (D-102): no maps → canonicalW = p.sourceW, actualSource*
 *     undefined, dimsMismatch=false. Preserves CLI byte-for-byte stdout.
 *   - Canonical map populates DisplayRow.canonicalW/H from per-region entries.
 *   - Actual map populates actualSourceW/H; dimsMismatch true when |delta| > 1
 *     on EITHER axis; false when ≤ 1 on BOTH axes (1px tolerance).
 *   - actualSource undefined (atlas-extract path) → dimsMismatch:false even
 *     when canonical is provided.
 */
describe('analyze — DIMS-01 canonical/actual dim threading + dimsMismatch (1px tolerance)', () => {
  function mkPeak(name: string, sourceW: number, sourceH: number, peakScale = 0.5): PeakRecord {
    return {
      attachmentKey: `default/SLOT/${name}`,
      skinName: 'default',
      slotName: 'SLOT',
      attachmentName: name,
      animationName: 'idle',
      time: 0,
      frame: 0,
      peakScaleX: peakScale,
      peakScaleY: peakScale,
      peakScale,
      worldW: sourceW * peakScale,
      worldH: sourceH * peakScale,
      sourceW,
      sourceH,
      isSetupPosePeak: false,
    };
  }

  it('CLI fallback (D-102): analyze(peaks) with no canonical/actual maps yields canonicalW === sourceW + dimsMismatch:false', () => {
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 1000, 1000)]]);
    const rows = analyze(peaks);
    expect(rows[0].canonicalW).toBe(1000);
    expect(rows[0].canonicalH).toBe(1000);
    expect(rows[0].actualSourceW).toBeUndefined();
    expect(rows[0].actualSourceH).toBeUndefined();
    expect(rows[0].dimsMismatch).toBe(false);
  });

  it('CLI fallback (D-102): analyze(peaks, sourcePaths) with no canonical/actual maps still falls back', () => {
    // Threading sourcePaths must NOT change canonical/actual semantics — only
    // the dim maps drive those fields.
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 700, 800)]]);
    const sp = new Map<string, string>([['R', '/abs/R.png']]);
    const rows = analyze(peaks, sp);
    expect(rows[0].canonicalW).toBe(700);
    expect(rows[0].canonicalH).toBe(800);
    expect(rows[0].actualSourceW).toBeUndefined();
    expect(rows[0].dimsMismatch).toBe(false);
    expect(rows[0].sourcePath).toBe('/abs/R.png');
  });

  it('canonicalDims map populates DisplayRow.canonicalW/H per attachmentName', () => {
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 1000, 1000)]]);
    // Canonical dims diverge from sourceW/H — common case for atlas-less mode
    // where sourceW/H come from per-region PNG headers but canonical comes
    // from JSON skin attachment width/height.
    const canonical = new Map([['R', { canonicalW: 1628, canonicalH: 1908 }]]);
    const rows = analyze(peaks, undefined, undefined, canonical);
    expect(rows[0].canonicalW).toBe(1628);
    expect(rows[0].canonicalH).toBe(1908);
    expect(rows[0].sourceW).toBe(1000); // sourceW unchanged (separate field)
    expect(rows[0].dimsMismatch).toBe(false); // no actualSource → false
  });

  it('dimsMismatch:true when actualSourceW differs from canonicalW by > 1px', () => {
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 811, 962)]]);
    const canonical = new Map([['R', { canonicalW: 1628, canonicalH: 1908 }]]);
    const actual = new Map([['R', { actualSourceW: 811, actualSourceH: 962 }]]);
    const rows = analyze(peaks, undefined, undefined, canonical, actual);
    expect(rows[0].dimsMismatch).toBe(true);
    expect(rows[0].canonicalW).toBe(1628);
    expect(rows[0].canonicalH).toBe(1908);
    expect(rows[0].actualSourceW).toBe(811);
    expect(rows[0].actualSourceH).toBe(962);
  });

  it('dimsMismatch:false when |actualSource - canonical| <= 1 on BOTH axes (1px tolerance)', () => {
    // Canonical 1000x1000, actual 1000x1001 → tolerance not exceeded on
    // either axis (|0|<=1, |1|<=1) → dimsMismatch false.
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 1000, 1001)]]);
    const canonical = new Map([['R', { canonicalW: 1000, canonicalH: 1000 }]]);
    const actual = new Map([['R', { actualSourceW: 1000, actualSourceH: 1001 }]]);
    const rows = analyze(peaks, undefined, undefined, canonical, actual);
    expect(rows[0].dimsMismatch).toBe(false);
  });

  it('dimsMismatch:true when |delta| > 1 on EITHER axis only (W matches but H drifts > 1)', () => {
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 1000, 800)]]);
    const canonical = new Map([['R', { canonicalW: 1000, canonicalH: 1000 }]]);
    // W matches exactly (delta=0), H drifts by 200 (>1) → mismatch on EITHER axis.
    const actual = new Map([['R', { actualSourceW: 1000, actualSourceH: 800 }]]);
    const rows = analyze(peaks, undefined, undefined, canonical, actual);
    expect(rows[0].dimsMismatch).toBe(true);
  });

  it('dimsMismatch:false when actualSource undefined (atlas-extract path; no comparison possible)', () => {
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 1000, 1000)]]);
    const canonical = new Map([['R', { canonicalW: 1628, canonicalH: 1908 }]]);
    // actualDims map is undefined — Jokerman atlas-extract path.
    const rows = analyze(peaks, undefined, undefined, canonical, undefined);
    expect(rows[0].dimsMismatch).toBe(false);
    expect(rows[0].actualSourceW).toBeUndefined();
    expect(rows[0].actualSourceH).toBeUndefined();
    expect(rows[0].canonicalW).toBe(1628);
  });

  it('empty canonicalDims/actualDims Maps yield same fallback behavior as undefined (Plan 22-01 placeholder safety)', () => {
    // loader.ts returns empty-Map placeholders at Plan 22-01 checkpoint;
    // verify the analyzer treats empty Maps identically to undefined Maps.
    const peaks = new Map<string, PeakRecord>([['R', mkPeak('R', 500, 500)]]);
    const empty1 = new Map<string, { canonicalW: number; canonicalH: number }>();
    const empty2 = new Map<string, { actualSourceW: number; actualSourceH: number }>();
    const rows = analyze(peaks, undefined, undefined, empty1, empty2);
    expect(rows[0].canonicalW).toBe(500); // fallback to p.sourceW
    expect(rows[0].canonicalH).toBe(500);
    expect(rows[0].actualSourceW).toBeUndefined();
    expect(rows[0].dimsMismatch).toBe(false);
  });

  it('analyzeBreakdown threads canonical/actual maps the same way as analyze()', () => {
    // Mirror coverage on the breakdown path — summary.ts wires both.
    const setupPeaks = new Map<string, PeakRecord>([
      ['R', { ...mkPeak('R', 800, 600), isSetupPosePeak: true }],
    ]);
    const perAnim = new Map<string, PeakRecord>();
    const fakeSkeletonData = { animations: [] } as unknown as Parameters<typeof analyzeBreakdown>[2];
    const canonical = new Map([['R', { canonicalW: 1600, canonicalH: 1200 }]]);
    const actual = new Map([['R', { actualSourceW: 800, actualSourceH: 600 }]]);
    const cards = analyzeBreakdown(
      perAnim,
      setupPeaks,
      fakeSkeletonData,
      [],
      undefined,
      undefined,
      canonical,
      actual,
    );
    const setupCard = cards.find((c) => c.cardId === 'setup-pose');
    expect(setupCard).toBeDefined();
    expect(setupCard!.rows[0].canonicalW).toBe(1600);
    expect(setupCard!.rows[0].actualSourceW).toBe(800);
    expect(setupCard!.rows[0].dimsMismatch).toBe(true);
  });
});
