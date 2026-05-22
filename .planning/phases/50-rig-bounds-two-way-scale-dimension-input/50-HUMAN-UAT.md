---
status: partial
phase: 50-rig-bounds-two-way-scale-dimension-input
source: [50-VERIFICATION.md]
started: 2026-05-23T01:10:00Z
updated: 2026-05-23T01:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Enriched Scale-card visual + interaction UAT (4.2 + 4.3)
expected: Open a 4.2 AND a 4.3 project in `npm run dev`, open "Export Variant…", and read the enriched Scale card. The "Setup-pose size: W × H px" reference line shows a sane rig size for each runtime; the three coupled fields (Factor / Width / Height) are legible and aspect-locked; typing a factor visibly moves both px fields; typing a target Width (e.g. 512) makes Height follow aspect-locked and the typed value does not drift; typing a value ≥ bbox disables Export with the inline "scaled-down" hint; a geometry-less rig shows "unavailable (no textured geometry)" with the factor field still usable.
why_human: jsdom cannot compute Tailwind layout/spacing or visual legibility/feel. The headless layer V1–V12 proves the binding math, the dual-runtime bbox, the summary seam, Layer-3 purity, and the full two-way state machine; only the rendered visual control is human-only. Avoid the opened≠rendered trap — the criterion is the rendered, correctly-coupled control.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
