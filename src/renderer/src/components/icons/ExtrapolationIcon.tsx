/**
 * Extrapolation icon — marks the Peak W×H cell when the Spine rig demands
 * resolution above canonical (`peakScale > 1`). The export pipeline caps
 * at canonical, so the icon signals "rig wants more than the source can
 * provide; export capped at canonical." Hover tooltip on the parent cell
 * surfaces the exact ratio.
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
}

export function ExtrapolationIcon({ className }: ExtrapolationIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* Vertical shaft */}
      <path d="M10 16 L10 4" />
      {/* Arrowhead */}
      <path d="M5 9 L10 4 L15 9" />
    </svg>
  );
}
