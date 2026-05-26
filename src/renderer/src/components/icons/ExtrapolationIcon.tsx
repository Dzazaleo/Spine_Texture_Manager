/**
 * Extrapolation icon — marks the Peak W×H cell when the Spine rig demands
 * resolution above the drawn source size (`peakScale > 1`). Tooltip copy is
 * owned by `lib/row-state.ts → extrapolationTooltip(...)` (sibling-symmetric;
 * both panels call the same helper). When the rig demand exceeds the source,
 * the display path caps `peakDemandW/H` at `actualSource` (so the cell never
 * reports demand above what the texture physically is), and the tooltip
 * appends "— capped at source dims" so the hover text matches what the user
 * sees in the cell (Phase 54 follow-up 2026-05-26). The suffix is omitted
 * when the uncapped rig demand actually fits in source (peakScale > 1 with
 * significant canonical-vs-source drift), since claiming "capped" would lie.
 *
 * Tooltip mechanism (Phase 31 TOOLTIP-01 fix-shape c): React-managed
 * primitive — `createPortal` + `position:fixed` + `getBoundingClientRect`
 * on a host `<span>` wrapping the SVG. Mirrors the DimsBadge.tsx primitive
 * (Phase 22.1 G-02). Replaces the pre-Phase-31 SVG `<title>` mechanism,
 * which was beaten by the parent `<td title="…">` on hover (this is the
 * SECOND known regression of this surface — see CONTEXT.md D-D-02). Two
 * structural reasons the SVG-`<title>` mechanism was unreliable:
 *   1. Browser tooltip resolution can prefer an HTML `title=` ancestor over
 *      an SVG `<title>` child depending on Chromium version + the precise
 *      hovered subtree.
 *   2. With `fill="none"` + `pointer-events: visiblePainted` (default), the
 *      stroke-only icon has a tiny actual hit area; cursor inside the
 *      bounding box but outside the strokes falls through to the parent
 *      TD, whose HTML `title` then fires.
 * The React-managed primitive escapes both: the host span has a rectangular
 * hit area (full bounding box) and the tooltip is portaled to
 * `document.body`, so the ancestor-chain title-resolution race is
 * sidestepped entirely.
 *
 * Sibling-symmetry by construction (Phase 22.1 D-04 + Phase 26.2 D-06):
 * the change lives ENTIRELY inside this icon component. Both call sites —
 * `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx` — inherit
 * the new mechanism without per-site edits, so the next refactor that
 * touches one panel cannot silently desync them (the failure mode that
 * produced this regression in the first place).
 *
 * When `title` is provided, the icon also gets a `role="img"` +
 * `aria-label` so screen readers announce it; without `title` the icon
 * stays `aria-hidden` (decorative). The host span carries
 * `aria-describedby` pointing at the live tooltip element while the
 * tooltip is mounted, so SR users get the same content via the
 * accessibility tree.
 *
 * Same stroke discipline as PencilIcon / WarningTriangleIcon: viewBox
 * 20×20, stroke="currentColor", strokeWidth 1.5, round caps/joins, no
 * fill — the icon inherits its color from the surrounding text-* class
 * so it adopts the cell's at-limit / under / over tint without extra
 * styling.
 *
 * Geometry: a single upward arrow with a flat shaft and arrowhead at the
 * top — visually distinct from the diagonal pencil and from the warning
 * triangle. Two paths, both stroke-only.
 */
import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ExtrapolationIconProps {
  className?: string;
  title?: string;
}

export function ExtrapolationIcon({ className, title }: ExtrapolationIconProps) {
  const tooltipId = useId();
  const hostRef = useRef<HTMLSpanElement>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; right: number } | null>(null);

  function handleMouseEnter() {
    if (title === undefined) return;
    const rect = hostRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
  }

  function handleMouseLeave() {
    setTooltipPos(null);
  }

  return (
    <span
      ref={hostRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      aria-describedby={tooltipPos !== null ? tooltipId : undefined}
    >
      <svg
        viewBox="0 0 20 20"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className={className}
        role={title !== undefined ? 'img' : undefined}
        aria-label={title}
        aria-hidden={title === undefined ? true : undefined}
      >
        {/* Vertical shaft */}
        <path d="M10 16 L10 4" />
        {/* Arrowhead */}
        <path d="M5 9 L10 4 L15 9" />
      </svg>
      {tooltipPos !== null && title !== undefined &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{ position: 'fixed', top: tooltipPos.top, right: tooltipPos.right }}
            className="z-[9999] bg-panel border border-border rounded-md p-2 text-xs font-mono text-fg whitespace-pre min-w-[260px] shadow-lg"
          >
            {title}
          </div>,
          document.body,
        )}
    </span>
  );
}
