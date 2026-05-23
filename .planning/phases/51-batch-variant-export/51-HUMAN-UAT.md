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

## Follow-up UX observations (user-flagged at UAT — RESOLVED 2026-05-23 in `1c68cb8`)

These did NOT affect the EXPORT-04 success criteria (both passed). The user flagged them at UAT and approved fixing them immediately; both are now done (commit `1c68cb8`, full suite 152 files / 1532 passed):

1. **No progress bar during a batch run.** ✅ FIXED — a pinned linear progress bar (OptimizeDialog idiom) now sits below the header during a run, driven by the existing `onVariantBatchProgress` markers; also fixed code-review WR-05 (Cancel now latches "Cancelling after current…" + disables, and is disabled on a 1-scale run / last variant / before the first event).
2. **Dialog footer buttons overflow the modal.** ✅ FIXED — the modal body is now a `flex-1 overflow-y-auto min-h-0` scroll region with the footer pinned (`shrink-0`), so Close / Open output folder stay inside the dialog when content grows.

Bundled in the same fix: WR-01 (reject a valid 0<s<1 scale whose 4dp token collapses to a degenerate `@0x`/`@1x` folder — main guard + renderer mirror + regression test) and IN-02 (factor input `max` 0.99 → 0.9999). Remaining `51-REVIEW.md` items (WR-02/WR-03/WR-04, IN-01/IN-03/IN-04) stay deferred to v1.8.

## Gaps
