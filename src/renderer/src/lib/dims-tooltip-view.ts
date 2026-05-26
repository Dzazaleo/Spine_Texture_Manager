/**
 * Phase 22.1 G-01 D-02 + G-02 D-04 + G-03 — shared helpers for the
 * dims-mismatch badge tooltip. Sibling-symmetric (Phase 19 D-06):
 * GlobalMaxRenderPanel.tsx and AnimationBreakdownPanel.tsx both consume
 * these via the shared DimsBadge component (src/renderer/src/components/DimsBadge.tsx).
 *
 * Pure TypeScript (no React, no DOM) — Layer 3 invariant honored.
 * CLAUDE.md fact #5: core/ is pure TypeScript, no DOM. This file lives
 * in renderer/lib but is equally pure (no React, no DOM, no electron).
 *
 * REVISION 1 (Warning 1 fix): `effectiveScale` is an explicit parameter on
 * deriveIsCapped, NOT a row field. The canonical DisplayRow at
 * src/shared/types.ts:54 carries `peakScale` only — the override-resolved
 * `effectiveScale` lives on the panel-local EnrichedRow type at
 * src/renderer/src/panels/GlobalMaxRenderPanel.tsx:100-106. The panel
 * passes its enriched value when calling.
 */
import type { DisplayRow } from '../../../shared/types.js';

type LoaderMode = 'auto' | 'atlas-less';

/**
 * G-01 D-02 + G-03 — mode-aware + cap-binding-aware tooltip text.
 *
 * @param row        DisplayRow with at least actualSourceW/H + canonicalW/H populated.
 * @param loaderMode 'auto' resolves to atlas-source variant; 'atlas-less' to PNG-source variant.
 * @param isCapped   When true, append the cap suffix; when false, return only the first sentence.
 */
/**
 * Phase 54 follow-up (2026-05-26) — round dimension values to 2 decimals and
 * strip trailing zeros so the tooltip reads "211" instead of "211.00" and
 * "49.4" instead of "49.400000000000006" (IEEE-754 noise from variant
 * source-scaled canonicals like canonical_master × s for s = 0.1). Integers
 * stay integers (no ".00" suffix); fractional values round at 2 decimals.
 */
function fmtDim(n: number): string {
  return Number(n.toFixed(2)).toString();
}

export function buildDimsTooltipText(
  row: Pick<DisplayRow, 'actualSourceW' | 'actualSourceH' | 'canonicalW' | 'canonicalH'>,
  loaderMode: LoaderMode,
  isCapped: boolean,
): string {
  const isAtlasSource = loaderMode === 'auto';
  const srcW = row.actualSourceW !== undefined ? fmtDim(row.actualSourceW) : 'undefined';
  const srcH = row.actualSourceH !== undefined ? fmtDim(row.actualSourceH) : 'undefined';
  const canW = fmtDim(row.canonicalW);
  const canH = fmtDim(row.canonicalH);
  const firstSentence = isAtlasSource
    ? `Atlas region declares ${srcW}×${srcH} but canonical is ${canW}×${canH}.`
    : `Source PNG (${srcW}×${srcH}) is smaller than canonical region dims (${canW}×${canH}).`;
  if (!isCapped) return firstSentence;
  const secondSentence = isAtlasSource
    ? `Optimize will cap at on-disk size.`
    : `Optimize will cap at source size.`;
  return `${firstSentence}\n${secondSentence}`;
}

/**
 * G-03 — derive isCapped from the row's effective scale vs source ratio.
 *
 * REVISION 1 (Warning 1 fix): `effectiveScale` is an EXPLICIT parameter, not
 * a row field. The Pick<DisplayRow, ...> deliberately does NOT include
 * `effectiveScale` — that field does not exist on the canonical DisplayRow
 * type. Caller (DimsBadge.tsx) reads its panel-local enriched effectiveScale
 * and passes it explicitly.
 *
 * Reactive: when override toggles effectiveScale past or below the cap,
 * the second sentence appears/disappears on the next render — because the
 * panel re-enriches and re-passes effectiveScale on each render.
 *
 * @param row             DisplayRow with cap-relevant dims (NOT effectiveScale).
 * @param effectiveScale  Override-resolved effective scale (caller supplies).
 */
export function deriveIsCapped(
  row: Pick<DisplayRow, 'dimsMismatch' | 'actualSourceW' | 'actualSourceH' | 'canonicalW' | 'canonicalH'>,
  effectiveScale: number,
): boolean {
  if (
    !row.dimsMismatch ||
    row.actualSourceW === undefined ||
    row.actualSourceH === undefined ||
    row.canonicalW <= 0 ||
    row.canonicalH <= 0
  ) {
    return false;
  }
  const sourceRatio = Math.min(row.actualSourceW / row.canonicalW, row.actualSourceH / row.canonicalH);
  const downscaleClampedScale = Math.min(effectiveScale, 1);
  return downscaleClampedScale > sourceRatio;
}
