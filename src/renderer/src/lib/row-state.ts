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

/**
 * Phase 54 follow-up (2026-05-26) — ExtrapolationIcon tooltip copy.
 *
 * The icon is gated on `row.peakScale > 1` (the rig's intrinsic world-space
 * peak demand ratio, measured against the source PNG by the sampler — not
 * touched by the display path). When the icon shows, the Peak cell may or
 * may not LOOK shorter than Source: the display path caps `peakDemand` at
 * `actualSource` so the cell never reports demand above what the texture
 * physically is. If the cap actually kicks in (uncapped demand
 * `ceil(canonical × peakScale)` exceeds source on either axis), the cell
 * reads Peak == Source even though the rig wants more — the dissonance the
 * 80×40 / 1.02× case exposed. The tooltip now acknowledges the cap so the
 * hover text and the visible cell stop fighting each other; when the
 * uncapped demand actually fits in source (peakScale > 1 with significant
 * drift), the suffix is omitted because saying "capped" would be a lie.
 *
 * Sibling-symmetric: both GlobalMaxRenderPanel and AnimationBreakdownPanel
 * call this helper so the copy can't drift (the existing
 * extrapolation-icon-tooltip.spec.tsx enforces symmetry by asserting both
 * panels call the helper rather than inlining the template).
 */
export function extrapolationTooltip(
  peakScale: number,
  canonicalW: number,
  canonicalH: number,
  srcW: number,
  srcH: number,
): string {
  const rigDemandW = Math.ceil(canonicalW * peakScale);
  const rigDemandH = Math.ceil(canonicalH * peakScale);
  const isCapped = rigDemandW > srcW || rigDemandH > srcH;
  const base = `Spine rig peak: ${peakScale.toFixed(2)}× source`;
  return isCapped ? `${base} — capped at source dims` : base;
}
