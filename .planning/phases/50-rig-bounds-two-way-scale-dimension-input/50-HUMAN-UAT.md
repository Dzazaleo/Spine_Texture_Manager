---
status: passed
phase: 50-rig-bounds-two-way-scale-dimension-input
source: [50-VERIFICATION.md]
started: 2026-05-23T01:10:00Z
updated: 2026-05-23T01:20:00Z
approved_by: user
approved_at: 2026-05-23
---

## Current Test

[complete — user approved the visual control 2026-05-23; one interaction defect found and fixed, see Gaps]

## Tests

### 1. Enriched Scale-card visual + interaction UAT (4.2 + 4.3)
expected: Open a 4.2 AND a 4.3 project in `npm run dev`, open "Export Variant…", and read the enriched Scale card. The "Setup-pose size: W × H px" reference line shows a sane rig size for each runtime; the three coupled fields (Factor / Width / Height) are legible and aspect-locked; typing a factor visibly moves both px fields; typing a target Width (e.g. 512) makes Height follow aspect-locked and the typed value does not drift; typing a value ≥ bbox disables Export with the inline "scaled-down" hint; a geometry-less rig shows "unavailable (no textured geometry)" with the factor field still usable.
why_human: jsdom cannot compute Tailwind layout/spacing or visual legibility/feel. The headless layer V1–V12 proves the binding math, the dual-runtime bbox, the summary seam, Layer-3 purity, and the full two-way state machine; only the rendered visual control is human-only. Avoid the opened≠rendered trap — the criterion is the rendered, correctly-coupled control.
result: passed
notes: User ran `npm run dev` against 4.2 and 4.3 projects, opened "Export Variant…", and approved the rendered control — bbox reference line, the three coupled aspect-locked fields, factor↔px coupling, no-drift typed pixels, over-range Export-disable hint, and degenerate-rig graceful path all visually correct. ONE interaction defect found and FIXED (see Gap G-50-01) — the visual/coupling sign-off itself stands.

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

### G-50-01 — Width/Height focus steal on keystroke (FOUND in UAT, FIXED)
status: resolved
severity: usability (blocking-for-use of the px fields)
found: 2026-05-23 (manual UAT)
symptom: Typing a multi-digit value into the Width/Height fields was impractical — after the first digit, focus jumped to the Factor field, so each subsequent digit required a re-click.
root_cause: Shared hook `useFocusTrap` listed `onEscape` in its effect deps. VariantDialog derives `onEscape` from an inline `props.onClose` (AppShell `onClose={() => setVariantDialogState(null)}`), so every `onScaleChange`-driven parent re-render produced a fresh `onEscape` identity → the effect re-ran → its mount-time auto-focus (`initialTabbables[0].focus()`) yanked focus to the first tabbable (the Factor input). Latent since Phase 6; invisible in Phase 49 (Factor was the only field), exposed by Phase 50 adding Width/Height after it.
fix: `7fe4528` — read `onEscape` from a ref inside the keydown listener and drop it from the effect deps, making auto-focus genuinely mount-only (matches the hook's documented invariant). Benefits all 13 modals using the hook. Covered by regression test `tests/renderer/variant-twoway.spec.tsx` V13 (controlled harness reproduces AppShell's fresh-per-render onClose; asserts focus stays on Width across keystrokes). typecheck (node+web) clean; full suite 150 files / 1510 passed.
