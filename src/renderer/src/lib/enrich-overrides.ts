import type { RegionRow } from '../../../shared/types.js';
import { computeExportDims } from './export-view.js';

/**
 * Phase 29 Plan 29-07 follow-up — extracted from GlobalMaxRenderPanel.tsx so
 * the regression test under tests/regression/ (typechecked by tsconfig.node.json,
 * which excludes .tsx + DOM) can import enrichWithEffective directly without
 * pulling the panel's DOM/JSX surface into node-tsc scope.
 *
 * Phase 29 D-01 (Plan 29-02 Task 3): EnrichedRow extends RegionRow (one row
 * per source PNG) instead of DisplayRow (one row per attachment). The
 * selection key is regionName; the shape preserves render-relevant scalars
 * so the panel render code works unchanged after the rename.
 */
export type EnrichedRow = RegionRow & {
  effectiveScale: number;
  effExportW: number;
  effExportH: number;
  displayScale: number;
  peakDisplayW: number;
  peakDisplayH: number;
  // Phase 54 D-01 — TRUE render demand for DISPLAY (NOT export). The Peak W×H
  // column + the savings chip read these (= min(canonicalW × peakScale,
  // actualSource)); outW/outH/effExportW/H remain the export dims. Type-declared
  // in Task 1; the value is computed by computeExportDims as of Task 2.
  peakDemandW: number;
  peakDemandH: number;
  override: number | undefined;
};

/**
 * Phase 4 Plan 03 + Round 5 (2026-04-25): enrich raw row[] with render-time
 * effective fields. Uses computeExportDims (single source of truth shared
 * with OptimizeDialog) so the panel's "Peak W×H" column shows EXPORT dims
 * — Math.ceil(sourceDim × ceil-thousandth-effScale, clamped ≤ source) —
 * instead of the world-AABB.
 *
 * Phase 29 D-04 (Plan 29-03 + 29-05 + 29-07): operates on RegionRow[] (one
 * row per source PNG / regionName). The override Map is regionName-keyed
 * end-to-end (AppShell.tsx WRITE side + export.ts READ side + this READ side
 * all speak the same `row.regionName ?? row.attachmentName` key contract).
 * The fallback covers synthetic test fixtures and the no-indirection legacy
 * case where regionName === attachmentName.
 */
export function enrichWithEffective(
  rows: readonly RegionRow[],
  overrides: ReadonlyMap<string, number>,
): EnrichedRow[] {
  return rows.map((row) => {
    const override = overrides.get(row.regionName ?? row.attachmentName);
    const { effScale, outW, outH, displayScale, peakDisplayW, peakDisplayH, peakDemandW, peakDemandH } =
      computeExportDims(
        row.sourceW,
        row.sourceH,
        row.peakScale,
        override,
        row.actualSourceW,
        row.actualSourceH,
        row.dimsMismatch,
        row.canonicalW,
        row.canonicalH,
      );
    return {
      ...row,
      effectiveScale: effScale,
      effExportW: outW,
      effExportH: outH,
      displayScale,
      peakDisplayW,
      peakDisplayH,
      peakDemandW,
      peakDemandH,
      override,
    };
  });
}
