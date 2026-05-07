/**
 * Extrapolation icon — marks the Peak W×H cell when the Spine rig demands
 * resolution above canonical (`peakScale > 1`). The export pipeline caps
 * at canonical, so the icon signals "rig wants more than the source can
 * provide; export capped at canonical."
 *
 * Tooltip: the `title` prop renders as an SVG `<title>` child element
 * (not a wrapper-span title attribute) — this is the canonical SVG
 * tooltip approach and reliably wins over the parent cell's HTML title
 * attribute when the cursor is over the icon. Without this pattern, the
 * cell's `<td title="…">` would always take precedence on hover.
 *
 * When `title` is provided, the icon also gets a `role="img"` +
 * `aria-label` so screen readers announce it; without `title` the icon
 * stays `aria-hidden` (decorative).
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
export interface ExtrapolationIconProps {
  className?: string;
  title?: string;
}

export function ExtrapolationIcon({ className, title }: ExtrapolationIconProps) {
  return (
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
      {title !== undefined && <title>{title}</title>}
      {/* Vertical shaft */}
      <path d="M10 16 L10 4" />
      {/* Arrowhead */}
      <path d="M5 9 L10 4 L15 9" />
    </svg>
  );
}
