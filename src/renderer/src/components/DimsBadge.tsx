import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { DisplayRow } from '../../../shared/types.js';
import { buildDimsTooltipText, deriveIsCapped } from '../lib/dims-tooltip-view.js';

type LoaderMode = 'auto' | 'atlas-less';

/**
 * Phase 22.1 G-02 D-04 + G-01 D-02 + G-03 — dims-mismatch badge with
 * custom React-managed tooltip primitive. Replaces the native HTML `title`
 * attribute used in Phase 22 (which fires once-per-session due to the
 * combination of small hit area + virtualizer remount + browser idle-trigger).
 *
 * REVISION 1 (Warning 2 fix): extracted to its OWN component file from the
 * start — no inline-then-extract churn. Both panels (GlobalMaxRenderPanel +
 * AnimationBreakdownPanel) import this single component, enforcing Phase 19
 * D-06 sibling symmetry by single-file source-of-truth.
 *
 * Tooltip primitive shape mirrors the rig-info tooltip at
 * src/renderer/src/components/AppShell.tsx:1253-1289 (proven pattern).
 *
 * Layout invariant: tooltip uses position:fixed via createPortal so it
 * escapes any overflow:hidden ancestor (e.g. AnimationBreakdownPanel card
 * wrapper). Position computed from getBoundingClientRect on mouseEnter.
 *
 * Tailwind v4 literal-class discipline: all className strings are literal.
 * No template-string interpolation.
 */
export function DimsBadge({
  row,
  effectiveScale,
  loaderMode,
}: {
  row: DisplayRow;
  effectiveScale: number;
  loaderMode: LoaderMode;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; right: number } | null>(null);
  if (!row.dimsMismatch) return null;
  const isCapped = deriveIsCapped(row, effectiveScale);
  const tooltipText = buildDimsTooltipText(row, loaderMode, isCapped);
  // tooltipId must be unique per rendered DimsBadge instance to support
  // multiple badges on the same page without ARIA collision.
  const tooltipId = `dims-badge-tooltip-${row.attachmentKey}`;
  const ariaLabel =
    `Source dims differ from canonical: source ${row.actualSourceW}×${row.actualSourceH}, canonical ${row.canonicalW}×${row.canonicalH}` +
    (isCapped
      ? loaderMode === 'auto'
        ? ' — Optimize will cap at on-disk size.'
        : ' — Optimize will cap at source size.'
      : '');

  function handleMouseEnter() {
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }

  return (
    <div
      ref={hostRef}
      data-testid="dims-badge-host"
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setTooltipPos(null)}
    >
      <span
        aria-label={ariaLabel}
        aria-describedby={tooltipPos !== null ? tooltipId : undefined}
        className="inline-flex items-center justify-center w-4 h-4 ml-1 align-middle text-warning"
      >
        {/* Info-circle SVG preserved byte-for-byte from
            src/renderer/src/panels/GlobalMaxRenderPanel.tsx:454-463
            (Phase 22 DIMS-02 iconography — info-circle slot).
            Do NOT change viewBox, strokeWidth, or path data. */}
        <svg
          viewBox="0 0 16 16"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          className="w-4 h-4"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M8 5 v4 M8 11.5 v0.01" />
        </svg>
      </span>
      {tooltipPos !== null &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{ position: 'fixed', top: tooltipPos.top, right: tooltipPos.right }}
            className="z-[9999] bg-panel border border-border rounded-md p-2 text-xs font-mono text-fg whitespace-pre min-w-[260px] shadow-lg"
          >
            {tooltipText}
          </div>,
          document.body,
        )}
    </div>
  );
}
