/**
 * Phase 19 UI-04 — Format an on-disk byte count into the renderer's human-friendly
 * string per CONTEXT.md D-14. 1024-byte basis (binary IEC convention; matches
 * macOS/Linux `du` output). Targets the UI-04 verbatim shape `X.XX MB potential
 * savings` for typical project sizes; falls back through KB/B/GB at thresholds.
 *
 * Pure function — no DOM access. Zero imports. Layer 3 invariant: this file
 * lives in the renderer tree because the renderer never imports from src/core/*
 * (tests/arch.spec.ts grep gate). Mirrors the same "renderer-side inline copy"
 * discipline as src/renderer/src/lib/overrides-view.ts.
 *
 * Trailing zeros policy: keep them (e.g. `1.00 MB`, not `1 MB`). UI-04's
 * verbatim wording is `X.XX MB potential savings` — two decimals are part of
 * the visual contract, even when the figure is a round number.
 *
 * Callers (within the renderer tree only):
 *   - src/renderer/src/panels/GlobalMaxRenderPanel.tsx — unused-callout
 *     aggregate-bytes label per D-13/D-14/D-15.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const KB = bytes / 1024;
  if (KB < 1024) return `${Math.round(KB)} KB`;
  const MB = KB / 1024;
  if (MB < 1024) return `${MB.toFixed(2)} MB`;
  const GB = MB / 1024;
  return `${GB.toFixed(2)} GB`;
}
