---
status: partial
phase: 51-batch-variant-export
source: [51-VERIFICATION.md]
started: 2026-05-23T15:18:00Z
updated: 2026-05-23T15:18:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live in-app batch run (multi-scale fan-out + one picker, D-12)
expected: Open Export Variant on a real loaded project, add a second scale row (e.g. 0.36 + 0.57), pick ONE parent folder, click Export Variants. Exactly two sibling folders `{NAME}@0.57x/` and `{NAME}@0.36x/` are written under the picked parent; the complete state shows "2 of 2 exported" with one row per folder; only one folder picker appeared (D-12).
result: [pending]

### 2. Live continue-on-error + Cancel UX (D-07 / D-09)
expected: In a 3-scale batch, trigger one variant to fail (e.g. re-export into an existing folder with overwrite off), and separately click Cancel mid-batch. The failed variant shows ✗ with its reason while the others land; clicking Cancel after the first variant records the remaining scales as ⊘ skipped (the in-flight variant finishes intact). (Note: WR-05 — the Cancel button gives no in-flight feedback before the first progress event; confirm the perceived behavior is acceptable.)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
