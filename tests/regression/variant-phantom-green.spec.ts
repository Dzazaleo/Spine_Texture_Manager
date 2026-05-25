/**
 * Phase 54 — Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix).
 *
 * Synthetic-row regression suite locking the D-01/D-02/D-03 contract + the
 * chip≡rows savings invariant, WITHOUT committing any fixture dir (so no
 * SAFE-01 denylist change is required, memory
 * feedback_new_committed_fixtures_need_safe01_denylist does NOT apply here).
 *
 * The bug: a reopened variant's geometry JSON is source-based (width/height ×
 * s) while its PNGs are peak-based (ceil(canonicalW × s·peakScale)). For art
 * drawn smaller than it renders (peakScale > 1) the two disagree, so the
 * DISPLAY path computed Peak = ceil(canonical × min(peakScale, 1)) < actualSource
 * and tinted the cell green — false savings. The fix computes the displayed
 * Peak demand as min(canonical × peakScale, actualSource) (peakDemandW/H) and
 * tints on the two rendered integers.
 *
 * Wave 0 RED: the peakDemand* assertions FAIL until Task 2 lands peakDemandW/H
 * on computeExportDims. That is the intended, correct Wave-0 RED.
 *
 * This is a node-program spec importing ONLY src/renderer/src/lib + src/shared
 * — both are in the tsconfig.node.json include globs. Importing a renderer
 * component module would trip TS6307 (Pitfall 4). The `rowState` extraction to
 * `lib/row-state.ts` is precisely what makes the tint predicate importable here.
 *
 * Regression table R1–R8 (54-RESEARCH §5 / 54-VALIDATION) + chip≡rows + D-03.
 */
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { computeExportDims } from '../../src/renderer/src/lib/export-view.js';
import { enrichWithEffective } from '../../src/renderer/src/lib/enrich-overrides.js';
import { rowState } from '../../src/renderer/src/lib/row-state.js';
import type { RegionRow } from '../../src/shared/types.js';

/**
 * Build a minimal valid RegionRow with all required fields, overridden by
 * `partial` last. Precedent: the synth-row helpers in tests/core/export.spec.ts.
 * Per-case the caller sets sourceW/sourceH = actualSourceW/H (the variant PNG
 * dims) and peakScaleX = peakScaleY = peakScale.
 */
function makeRow(partial: Partial<RegionRow>): RegionRow {
  const base: RegionRow = {
    regionName: 'R',
    attachmentName: 'R',
    skinName: 'default',
    slotName: 'SLOT',
    animationName: 'anim',
    time: 0,
    frame: 0,
    peakScale: 1,
    peakScaleX: 1,
    peakScaleY: 1,
    worldW: 0,
    worldH: 0,
    sourceW: 0,
    sourceH: 0,
    isSetupPosePeak: false,
    sourcePath: '/images/R.png',
    canonicalW: 0,
    canonicalH: 0,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: '',
    peakSizeLabel: '',
    scaleLabel: '',
    sourceLabel: '',
    frameLabel: '',
    contributingAttachments: [],
  };
  return { ...base, ...partial };
}

describe('Phase 54 — variant reopen phantom-green-savings (synthetic rows)', () => {
  describe('D-01 — the bug: reopened variant peakScale>1 with actualSource>canonical', () => {
    it('R1: GRAND (canon 208.5, peakScale 1.182, actualSource 247) shows Peak == Source and is NOT green', () => {
      const { peakDemandW } = computeExportDims(
        247, 75, 1.182, undefined, 247, 75, true, 208.5, 63,
      );
      // The displayed Peak integer is the on-disk source dim — no phantom green.
      expect(peakDemandW).toBe(247);
      // D-03 tint: Peak == Source ⇒ atLimit (yellow), NOT 'under' (green).
      expect(rowState(peakDemandW, 247, false)).toBe('atLimit');
    });
  });

  describe('regression — master peakScale<1 genuine savings is display-unchanged', () => {
    it('R2: CROWN (canon 478.5, peakScale 0.44, actualSource 211) peakDemand === peakDisplay; green preserved', () => {
      const { peakDemandW, peakDisplayW } = computeExportDims(
        211, 211, 0.44, undefined, 211, 211, true, 478.5, 478.5,
      );
      // For peakScale ≤ 1 with actualSource ≥ canon-shrunk demand the demand
      // pair is byte-identical to the export-clamped display pair (fuzz-proven).
      expect(peakDemandW).toBe(peakDisplayW);
      // Genuine savings preserved: render demand strictly below the on-disk dim.
      expect(peakDemandW).toBeLessThan(211);
      expect(rowState(peakDemandW, 211, false)).toBe('under');
    });

    it('R4: master peakScale>1 with NO drift (canon 417, actualSource 417) — Peak == Source, atLimit', () => {
      const { peakDemandW } = computeExportDims(
        417, 417, 1.182, undefined, 417, 417, true, 417, 417,
      );
      expect(peakDemandW).toBe(417);
      expect(rowState(417, 417, false)).toBe('atLimit');
    });

    it('R5: clean peakScale == 1 (TRIANGLE canon 153, actualSource 153) — atLimit', () => {
      const { peakDemandW } = computeExportDims(
        153, 153, 1.0, undefined, 153, 153, false, 153, 153,
      );
      expect(peakDemandW).toBe(153);
      expect(rowState(peakDemandW, 153, false)).toBe('atLimit');
    });

    it('R7: rounding asymptote (canon 200, peakScale 0.998, actualSource 200) — atLimit, no green', () => {
      const { peakDemandW } = computeExportDims(
        200, 200, 0.998, undefined, 200, 200, true, 200, 200,
      );
      // safeScale(0.998) = 0.998 → ceil(200 × 0.998) = 200 → capped at source.
      expect(peakDemandW).toBe(200);
      expect(rowState(peakDemandW, 200, false)).toBe('atLimit');
    });
  });

  describe('drift — NECK-repack downscaled source stays green', () => {
    it('R3: NECK-repack (canon 100, peakScale 0.8, actualSource 120) — peakDemand < actualSource, under/green', () => {
      const { peakDemandW } = computeExportDims(
        120, 120, 0.8, undefined, 120, 120, true, 100, 100,
      );
      // ceil(100 × 0.8) = 80, capped at actualSource 120 ⇒ 80 < 120 ⇒ green.
      expect(peakDemandW).toBeLessThan(120);
      expect(rowState(peakDemandW, 120, false)).toBe('under');
    });
  });

  describe('override<100% on peakScale>1 still optimizes (green)', () => {
    it('R6: GRAND @ 50% override (canon 208.5, peakScale 1.182, actualSource 247) — peakDemand < 247, under/green', () => {
      const { peakDemandW } = computeExportDims(
        247, 75, 1.182, 50, 247, 75, true, 208.5, 63,
      );
      // overrideFrac 0.5 → rawPeakEff = 0.591 → ceil(208.5 × 0.591) = 124 < 247.
      expect(peakDemandW).toBeLessThan(247);
      expect(rowState(peakDemandW, 247, false)).toBe('under');
    });
  });

  describe('D-03 — tint compares the two displayed integers, no epsilon', () => {
    it('R8: rowState(N, N) === atLimit and rowState(N-1, N) === under for representative N', () => {
      const N = 247;
      expect(rowState(N, N, false)).toBe('atLimit');
      expect(rowState(N - 1, N, false)).toBe('under');
      // Strictly larger Peak than Source ⇒ neutral (no green, no yellow).
      expect(rowState(N + 1, N, false)).toBe('neutral');
    });
  });

  describe('savings — chip ≡ Σ per-row render demand', () => {
    it('the section savings-% equals the sum of per-row residuals; GRAND contributes 0', () => {
      // R1 GRAND: peakScale>1 reopened variant → atLimit (0 savings).
      const grand = makeRow({
        regionName: 'GRAND',
        attachmentName: 'GRAND',
        peakScale: 1.182,
        peakScaleX: 1.182,
        peakScaleY: 1.182,
        sourceW: 247,
        sourceH: 75,
        actualSourceW: 247,
        actualSourceH: 75,
        dimsMismatch: true,
        canonicalW: 208.5,
        canonicalH: 63,
      });
      // R3-style NECK-repack: peakScale<1, genuine green.
      const neck = makeRow({
        regionName: 'NECK',
        attachmentName: 'NECK',
        peakScale: 0.8,
        peakScaleX: 0.8,
        peakScaleY: 0.8,
        sourceW: 120,
        sourceH: 120,
        actualSourceW: 120,
        actualSourceH: 120,
        dimsMismatch: true,
        canonicalW: 100,
        canonicalH: 100,
      });

      const enriched = enrichWithEffective([grand, neck], new Map());
      expect(enriched.length).toBe(2);

      let sumSource = 0;
      let sumDemand = 0;
      for (const r of enriched) {
        const srcW = r.actualSourceW ?? r.sourceW;
        const srcH = r.actualSourceH ?? r.sourceH;
        sumSource += srcW * srcH;
        sumDemand += r.peakDemandW * r.peakDemandH;
      }
      const pct = (1 - sumDemand / sumSource) * 100;

      // (a) GRAND contributes 0 savings — its demand == its source.
      const grandRow = enriched.find((r) => r.regionName === 'GRAND')!;
      expect(grandRow.peakDemandW * grandRow.peakDemandH).toBe(247 * 75);

      // (b) The overall pct equals the sum of per-row residuals (chip ≡ Σ rows).
      const perRowResidual =
        sumSource <= 0 ? 0 : (1 - sumDemand / sumSource) * 100;
      expect(pct).toBeCloseTo(perRowResidual, 10);

      // The genuine residual comes ONLY from NECK; GRAND is at-limit, so the
      // chip is strictly below 100% but the phantom contribution is gone.
      const neckRow = enriched.find((r) => r.regionName === 'NECK')!;
      const neckDemand = neckRow.peakDemandW * neckRow.peakDemandH;
      const neckSource = (neckRow.actualSourceW ?? neckRow.sourceW) * (neckRow.actualSourceH ?? neckRow.sourceH);
      const grandSource = 247 * 75;
      const expectedPct = (1 - (neckDemand + grandSource) / (neckSource + grandSource)) * 100;
      expect(pct).toBeCloseTo(expectedPct, 10);
    });
  });
});
