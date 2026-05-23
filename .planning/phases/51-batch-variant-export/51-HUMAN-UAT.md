---
status: passed
phase: 51-batch-variant-export
source: [51-VERIFICATION.md]
started: 2026-05-23T15:18:00Z
updated: 2026-05-23T15:40:00Z
approved_by: user
approved_at: 2026-05-23
---

## Current Test

[complete — both items passed live 2026-05-23]

## Tests

### 1. Live in-app batch run (multi-scale fan-out + one picker, D-12)
expected: Open Export Variant on a real loaded project, add a second scale row (e.g. 0.36 + 0.57), pick ONE parent folder, click Export Variants. Exactly two sibling folders `{NAME}@0.57x/` and `{NAME}@0.36x/` are written under the picked parent; the complete state shows "2 of 2 exported" with one row per folder; only one folder picker appeared (D-12).
result: passed — live-confirmed with a 3-scale batch (0.5 / 0.46 / 0.57) on CHJWC_SYMBOLS; one picker, per-folder result rows shown, "2 of 3 exported" aggregate.

### 2. Live continue-on-error + Cancel UX (D-07 / D-09)
expected: In a 3-scale batch, trigger one variant to fail (e.g. re-export into an existing folder with overwrite off), and separately click Cancel mid-batch. The failed variant shows ✗ with its reason while the others land; clicking Cancel after the first variant records the remaining scales as ⊘ skipped (the in-flight variant finishes intact).
result: passed — `CHJWC_SYMBOLS@0.5x/` correctly showed `✗ Refusing to overwrite existing file:` with the full path while `@0.46x` (346 files) and `@0.57x` (346 files) both landed; aggregate "2 of 3 exported".

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Follow-up UX observations (non-blocking — user-flagged for later, v1.8 candidates)

These do NOT affect the EXPORT-04 success criteria (both passed). Captured for a future polish pass:

1. **No progress bar during a batch run.** The "variant N of M" infrastructure exists (`onVariantBatchProgress`) but there is no visual progress bar like the Optimize Assets dialog — especially wanted when several exports run in sequence. (Relates to code-review WR-05: the Cancel affordance has no in-flight feedback.)
2. **Dialog footer buttons overflow the modal.** When the content grows (more scale rows, or per-folder error rows with reasons), the bottom-right action buttons (Close / Open output folder) get pushed outside the dialog box — the modal body needs an internal scroll region so the footer stays pinned. (Layout-fragility class — see `project_layout_fragility_root_min_h_screen`.)

## Gaps
