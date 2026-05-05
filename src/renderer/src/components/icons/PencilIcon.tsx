/**
 * Pencil icon — marks the Peak W×H cell when the user has set an override
 * on that row. Distinct from the WarningTriangleIcon (which signals
 * source-vs-canonical dim mismatch) so the two semantics never visually
 * collide.
 *
 * Same stroke-style discipline as WarningTriangleIcon (Phase 26.2 D-04 +
 * D-12): viewBox 20×20, stroke="currentColor", strokeWidth 1.5,
 * strokeLinecap/strokeLinejoin="round", fill="none". Color comes from the
 * caller's surrounding text-* class (text-accent at the Peak cell) so the
 * icon always matches the cell's override-marked text color.
 *
 * Path geometry: a diagonal pencil running upper-right (eraser) to lower-
 * left (tip), with a single divider stroke where the eraser meets the
 * wood. Two paths, no fills — keeps the silhouette legible at the small
 * sizes (w-3.5 h-3.5) used in table cells.
 */
export interface PencilIconProps {
  className?: string;
}

export function PencilIcon({ className }: PencilIconProps) {
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
      {/* Pencil outline: eraser top → eraser corner → body → tip → close */}
      <path d="M13 3 L17 7 L8 16 L3 17 L4 12 Z" />
      {/* Eraser-wood divider stroke */}
      <path d="M11 5 L15 9" />
    </svg>
  );
}
