/**
 * Phase 26.2 D-06/D-07 — Canonical stroke-style warning triangle icon.
 *
 * Single source of truth for the warning-triangle SVG used in:
 *   - MissingAttachmentsPanel header (alert bar)
 *   - UnusedAssetsPanel header (alert bar)
 *   - GlobalMaxRenderPanel missing-row cell (table)
 *   - AnimationBreakdownPanel missing-row cell (table)
 *
 * Path data is locked by D-06 (no per-site divergence). The exclamation
 * dot is rendered as a small filled circle (D-06a) with element-local
 * fill="currentColor" to override the SVG-level fill="none" cleanly.
 *
 * Color: inherits from currentColor — caller's surrounding span (e.g.
 * text-danger) sets the color. The className prop is optional; callers
 * pass w-4 h-4 per Phase 26.2 D-05 (no upsize at any of the 4 sites —
 * layout-shift constraint inside table cells and alert-bar headers).
 *
 * Attributes follow the Phase 26.1 D-12 / Phase 26.2 D-04 stroke standard.
 */
export interface WarningTriangleIconProps {
  className?: string;
}

export function WarningTriangleIcon({ className }: WarningTriangleIconProps) {
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
      <path d="M10 3 L17 16 H3 Z" />
      <path d="M10 8 V12" />
      <circle cx="10" cy="14.5" r="0.5" fill="currentColor" />
    </svg>
  );
}
