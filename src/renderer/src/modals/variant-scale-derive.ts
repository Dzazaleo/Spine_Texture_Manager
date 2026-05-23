/**
 * Phase 50 Plan 02 — SCALEUI-01 pure derivation helpers for the two-way
 * scale↔dimension VariantDialog control.
 *
 * These three helpers convert between the canonical scale factor `s` (the single
 * source of truth the Phase-49 export path consumes — D-02) and per-axis pixel
 * targets, given a reference axis length (the setup-pose bbox width or height
 * delivered by 50-01 on `SkeletonSummary.bbox`).
 *
 * LAYER-3 INVARIANT (CLAUDE.md Fact #5, tests/arch.spec.ts:20): this file is
 * RENDERER-LOCAL. It must NOT import from `core/` and must NOT import the
 * Node-only `formatScaleToken` from `src/main/variant-export.ts`. `displayFactor`
 * mirrors that helper's `Number(s.toFixed(4))` normalization (D-03) but is copied
 * inline here precisely to honor the renderer-↛-core/main boundary — the 1-liner
 * is byte-identical to the canonical token math.
 *
 * D-03 ("what you type is what you get"): `scaleFromPx` is the EXACT quotient
 * `px / axis` — NO snapping to nice factors. The canonical `s` itself is NEVER
 * rounded; only the *display* of the factor is rounded (via `displayFactor`) and
 * only the *display* of pixels is rounded (via `pxFromScale`). Display rounding
 * is never fed back into `s`, so the edited axis suffers no round-trip drift.
 */

/** Display the per-axis pixel target derived from `s` (whole pixels, D-03). */
export const pxFromScale = (s: number, axis: number): number =>
  Math.round(s * axis);

/**
 * Derive the canonical `s` from a typed pixel target. EXACT — no snapping to
 * nice factors (D-03). Callers MUST guard `axis > 0` before invoking (a
 * degenerate `axis === 0` would yield Infinity/NaN — RESEARCH §Security V5 /
 * threat T-50-FIN).
 */
export const scaleFromPx = (px: number, axis: number): number => px / axis;

/**
 * Display the factor `s` rounded to 4 decimals (== `formatScaleToken` math, D-03).
 * Operates on the display only — never rounds the stored `s`.
 */
export const displayFactor = (s: number): number => Number(s.toFixed(4));

/**
 * Phase 51 D-10 — the renderer-local @{s}x folder token. Byte-identical to main's
 * formatScaleToken (`String(Number(s.toFixed(4)))`, src/main/variant-export.ts:57)
 * but kept renderer-local (Layer-3 — the renderer must NOT import the Node-only
 * variant-export module). Used for the per-row folder hint AND the duplicate-token
 * dedup gate so both share ONE source of truth.
 */
export const tokenFor = (s: number): string => String(displayFactor(s));
