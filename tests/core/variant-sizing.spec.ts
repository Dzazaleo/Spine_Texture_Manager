/**
 * Phase 49 Plan 01 — V1 (EXPORT-02) variant sizing.
 *
 * Proves the LOCKED peak-only interpretation A1 (cites D-07 + L-02):
 *   variant_peak = s × master_peak EXACT, with AND without overrides, and
 *   computed by ARITHMETIC (scaleSummaryPeaks + buildExportPlan UNCHANGED) —
 *   NEVER by re-sampling. By construction this test imports ONLY buildExportPlan
 *   + scaleSummaryPeaks (no sampler invocation anywhere in the sizing path) —
 *   the negative L-02 guard, enforced by the AC grep returning zero.
 *
 * scaleSummaryPeaks multiplies ONLY peakScale/peakScaleX/peakScaleY by s on a
 * structuredClone; canonicalW/H + sourceW/H stay at master size, so:
 *   - buildExportPlan's <=1.0 clamp acts on the SCALED demand (so for a row
 *     where the master is NOT clamped and NOT capped, variant.effectiveScale
 *     ≈ s × master.effectiveScale), and
 *   - the override path is LINEAR ((pct/100) × scaledPeak) — the variant's
 *     overridden row reflects (pct/100) × s × peak, NOT s × clamp((pct/100)×peak)
 *     where those differ.
 *
 * Synthetic fixture (no sampler) — mirrors tests/core/export.spec.ts Category-B
 * hand-built summaries. Peaks chosen so the no-override case has a sub-1.0 row
 * (proves a true s × peak, not a clamp coincidence) AND a >1.0 row (proves the
 * clamp acts on the scaled demand).
 */
import { describe, expect, it } from 'vitest';
import { buildExportPlan, safeScale } from '../../src/core/export.js';
import { scaleSummaryPeaks } from '../../src/core/scale-summary-peaks.js';
import type {
  ExportPlan,
  RegionRow,
  SkeletonSummary,
} from '../../src/shared/types.js';

const SKELETON_PATH = '/tmp/SIMPLE_TEST.json';

/** Build a synthetic RegionRow with a known peakScale + clean (no-mismatch) dims. */
function region(regionName: string, peakScale: number, dim = 1000): RegionRow {
  return {
    regionName,
    attachmentName: regionName,
    skinName: 'default',
    slotName: regionName + '_SLOT',
    animationName: 'idle',
    time: 0,
    frame: 0,
    peakScale,
    peakScaleX: peakScale,
    peakScaleY: peakScale,
    worldW: dim * peakScale,
    worldH: dim * peakScale,
    sourceW: dim,
    sourceH: dim,
    isSetupPosePeak: false,
    canonicalW: dim,
    canonicalH: dim,
    dimsMismatch: false,
    sourcePath: '/fake/' + regionName + '.png',
    contributingAttachments: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: regionName } as any,
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as RegionRow;
}

function buildSyntheticSummary(): SkeletonSummary {
  // SMALL: peak 0.40 (variant escapes clamp at any s<=1)
  // BIG:   peak 2.00 (master clamps to 1.0; variant 0.5× → 1.0; variant 0.25× < 1)
  const regions = [region('SMALL', 0.4), region('BIG', 2.0)];
  return {
    regions,
    peaks: [],
    orphanedFiles: [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as SkeletonSummary;
}

describe('scaleSummaryPeaks + buildExportPlan — V1 sizing (EXPORT-02, peak-only A1)', () => {
  it('no overrides: variant row demand = min(safeScale(s × master_peak), 1) (peak-only, no re-sample)', () => {
    const s = 0.5;
    const summary = buildSyntheticSummary();
    const variantPlan: ExportPlan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
      skeletonPath: SKELETON_PATH,
    });
    const variantRows = [...variantPlan.rows, ...variantPlan.passthroughCopies];
    expect(variantRows.length).toBe(2);

    let provedSubOne = 0;
    for (const vRow of variantRows) {
      // outW always = ceil(canonicalW × effScale) (export.spec.ts:207).
      expect(vRow.outW).toBe(Math.ceil(vRow.sourceW * vRow.effectiveScale));
      expect(vRow.outH).toBe(Math.ceil(vRow.sourceH * vRow.effectiveScale));

      // master_peak read from the UN-scaled summary (the source of truth) —
      // proves the variant's sizing is pure arithmetic on the existing peak.
      const master = summary.regions.find((r) =>
        vRow.attachmentNames.includes(r.regionName ?? r.attachmentName),
      )!;
      const expectedEff = Math.min(safeScale(s * master.peakScale), 1);
      expect(vRow.effectiveScale).toBeCloseTo(expectedEff, 5);
      if (expectedEff < 1) provedSubOne++;
    }
    // SMALL: 0.5 × 0.4 = 0.2 (< 1) — a genuine s × peak, not a clamp artifact.
    expect(provedSubOne, 'expected a sub-1.0 row proving true s × master_peak').toBeGreaterThan(0);
  });

  it('with override: variant overridden row = (pct/100) × s × peak (linear, not s × clamp((pct/100)×peak))', () => {
    const s = 0.5;
    const pct = 50;
    const summary = buildSyntheticSummary();

    // BIG peak 2.0: (50/100) × 0.5 × 2.0 = 0.5 (escapes clamp). The WRONG
    // interpretation s × clamp((pct/100)×peak) = 0.5 × clamp(1.0) = 0.5 too —
    // pick a region/pct where they DIVERGE. Use peak 2.0 with pct = 150:
    //   linear:  (150/100) × 0.5 × 2.0 = 1.5 → clamp 1.0
    //   wrong:   0.5 × clamp((150/100) × 2.0 = 3.0 → 1.0) = 0.5
    // Those differ (1.0 vs 0.5) — proving the linear-on-scaled-peak invariant.
    const regionName = 'BIG';
    const masterPeak = summary.regions.find((r) => r.regionName === regionName)!.peakScale;
    const overridePct = 150;

    const overrides = new Map<string, number>([[regionName, overridePct]]);
    const variantPlan: ExportPlan = buildExportPlan(
      scaleSummaryPeaks(summary, s),
      overrides,
      { skeletonPath: SKELETON_PATH },
    );
    const variantRows = [...variantPlan.rows, ...variantPlan.passthroughCopies];
    const vRow = variantRows.find((r) => r.attachmentNames.includes(regionName))!;
    expect(vRow, `no variant row for region ${regionName}`).toBeDefined();

    // applyOverride is LINEAR ((pct/100) × peakScale) and scaleSummaryPeaks
    // already multiplied the peak by s, so the variant resolves to
    // min(safeScale((pct/100) × s × peak), 1).
    const linearDemand = (overridePct / 100) * s * masterPeak; // 1.5
    const expectedEff = Math.min(safeScale(linearDemand), 1); // 1.0
    expect(vRow.effectiveScale).toBeCloseTo(expectedEff, 5);
    expect(vRow.outW).toBe(Math.ceil(vRow.sourceW * vRow.effectiveScale));
    expect(vRow.outH).toBe(Math.ceil(vRow.sourceH * vRow.effectiveScale));

    // NEGATIVE: prove this is NOT the s × clamp((pct/100)×peak) interpretation.
    const wrong = s * Math.min(safeScale((overridePct / 100) * masterPeak), 1); // 0.5 × 1.0 = 0.5
    expect(Math.abs(wrong - expectedEff)).toBeGreaterThan(1e-6);
    expect(vRow.effectiveScale).not.toBeCloseTo(wrong, 5);
  });
});
