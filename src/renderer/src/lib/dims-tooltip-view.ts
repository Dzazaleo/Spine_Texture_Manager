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
export function buildDimsTooltipText(
  row: Pick<DisplayRow, 'actualSourceW' | 'actualSourceH' | 'canonicalW' | 'canonicalH'>,
  loaderMode: LoaderMode,
  isCapped: boolean,
): string {
  const isAtlasSource = loaderMode === 'auto';
  const firstSentence = isAtlasSource
    ? `Atlas region declares ${row.actualSourceW}×${row.actualSourceH} but canonical is ${row.canonicalW}×${row.canonicalH}.`
    : `Source PNG (${row.actualSourceW}×${row.actualSourceH}) is smaller than canonical region dims (${row.canonicalW}×${row.canonicalH}).`;
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
