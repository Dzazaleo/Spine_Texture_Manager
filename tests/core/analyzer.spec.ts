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
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton, type PeakRecord } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const ANALYZER_SRC = path.resolve('src/core/analyzer.ts');

describe('analyze (D-33, D-34, D-35)', () => {
  it('D-34 sort: DisplayRow[] sorted by (skinName, slotName, attachmentName)', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    const resorted = [...rows].sort((a, b) => {
      if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
      if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
      return a.attachmentName.localeCompare(b.attachmentName);
    });
    expect(rows).toEqual(resorted);
  });

  it('D-35: preformatted labels match spec strings', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) {
      expect(r.originalSizeLabel).toBe(`${r.sourceW}×${r.sourceH}`);
      expect(r.peakSizeLabel).toBe(`${r.worldW.toFixed(0)}×${r.worldH.toFixed(0)}`);
      expect(r.scaleLabel).toBe(`${r.peakScale.toFixed(3)}×`);
      expect(r.frameLabel).toBe(String(r.frame));
      expect(r.sourceLabel).toBe(r.animationName);
    }
  });

  it('D-22: output survives structuredClone unchanged', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
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
    const peaks = sampleSkeleton(load);
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
