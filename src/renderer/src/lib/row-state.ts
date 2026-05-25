/**
 * Phase 54 — pure RowState tint decision, extracted from the Global Max Render
 * panel so the regression spec can import it as a node-program test module
 * (avoids the TS6307 renderer-test landmine, memory
 * feedback_renderer_ts_helper_test_breaks_typecheck_node). Zero React/DOM
 * imports and no math-tree dependency (Layer-3 pure; node-included via the
 * tsconfig.node.json `src/renderer/src/lib` glob).
 *
 * D-03 contract: both args are the EXACT integers rendered in the two cells —
 * peakDisplayW := row.peakDemandW (the Peak cell); sourceW :=
 * row.actualSourceW ?? row.sourceW (the numeric form of originalSizeLabel, the
 * Source cell, from the analyzer). Pure integer compare, no epsilon
 * (D-03 + Deferred).
 *
 * A row is tinted green ('under') ONLY when the displayed integer Peak
 * dimension is strictly smaller than the displayed integer Source dimension;
 * equal integers => 'atLimit' (yellow, no green). This is what kills the
 * Phase-54 phantom-green readout on reopened variants.
 */
export type RowState = 'under' | 'atLimit' | 'unused' | 'neutral' | 'missing';

export function rowState(
  peakDisplayW: number,
  sourceW: number,
  isUnused: boolean,
  isMissing?: boolean,
): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakDisplayW < sourceW) return 'under';
  if (peakDisplayW === sourceW) return 'atLimit';
  return 'neutral';
}
