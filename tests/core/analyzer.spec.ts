/**
 * Phase 2 Plan 01 — Tests for src/core/analyzer.ts (D-33, D-34, D-35).
 *
 * Behavior gates:
 *   - D-34 sort: DisplayRow[] sorted by (skinName, slotName, attachmentName) — matches CLI byte-for-byte.
 *   - D-35 preformat: originalSizeLabel / peakSizeLabel / scaleLabel / sourceLabel / frameLabel each match their spec'd format string.
 *   - D-33 fixture row count: 4 rows (CIRCLE/SQUARE/SQUARE2/TRIANGLE) for the SIMPLE_TEST fixture.
 *   - D-22 structuredClone round-trip: DisplayRow[] survives structuredClone unchanged.
 *   - N2.3 hygiene: src/core/analyzer.ts imports nothing from node:fs / node:path / node:child_process / sharp / node:http / node:net.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
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

  it('D-33: SIMPLE_TEST fixture yields 4 rows (CIRCLE/SQUARE/SQUARE2/TRIANGLE)', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    expect(rows.length).toBe(4);
    const names = rows.map((r) => r.attachmentName).sort();
    expect(names).toEqual(['CIRCLE', 'SQUARE', 'SQUARE2', 'TRIANGLE']);
  });

  it('N2.3: src/core/analyzer.ts has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports', () => {
    const src = readFileSync(ANALYZER_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
});
