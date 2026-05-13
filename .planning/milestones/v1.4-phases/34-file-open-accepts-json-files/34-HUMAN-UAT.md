---
status: partial
phase: 34-file-open-accepts-json-files
source: [34-VERIFICATION.md]
started: 2026-05-11T21:25:00Z
updated: 2026-05-11T22:30:00Z
---

## Current Test

[only item 2 (Windows picker) remains pending — all macOS items passed including CR-01 re-test]

## Tests

### 1. macOS — File → Open dialog accepts both .stmproj and .json in a single unified filter
expected: Click File → Open (or press Cmd+O). OS picker opens with title 'Open Spine Project or Skeleton'. Both .stmproj and .json files appear selectable in one filter labelled 'Spine Project or Skeleton'. No dropdown to operate.
result: passed (2026-05-11)

### 2. Windows — same dialog test on Windows
expected: Same as above but with Windows file picker. Single dropdown entry 'Spine Project or Skeleton (*.stmproj; *.json)'.
result: [pending]

### 3. Atlas-source .json menu open produces same summary as drag-drop
expected: With no project loaded, File → Open, pick fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json. App lands status:'loaded'. Global panel + Animation Breakdown identical to drag-dropping the same file. Atlas-source mode auto-selected (sibling .atlas detected).
result: passed (2026-05-11)

### 4. Atlas-less .json menu open via sibling images/ folder
expected: With no project loaded, File → Open, pick a .json from a folder with no .atlas but a sibling images/ folder (e.g., fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/). App lands status:'loaded', atlas-less mode auto-selected via synthesizer fall-through (D-05). Identical to drag-drop.
result: passed (2026-05-11)

### 5. Cmd+O / Ctrl+O accelerator parity with menu click
expected: With app focused and no project loaded, press Cmd+O (macOS) / Ctrl+O (Windows). Same picker opens, same dispatch happens, identical behavior to clicking File → Open menu item.
result: passed (2026-05-11)

### 6. Uppercase-suffix file (e.g., MyRig.STMPROJ or Skel.JSON) opens successfully
expected: Pick a file with uppercase extension. App loads it without error.
note: REVIEW.md CR-01 originally documented this failed — picker was case-insensitive (project-io.ts:330) but downstream load validators (project-io.ts:367, ipc.ts:425) rejected case-sensitively. Fixed in commit `c1b32e4` (2026-05-11) — all load validators now lowercase suffix before `.endsWith()`. 7 new regression tests in `tests/main/project-io.spec.ts` + `tests/main/ipc.spec.ts` lock the contract. Needs human re-test on real uppercase file to confirm fix.
result: passed (2026-05-11 — human re-test confirms CR-01 fix; uppercase suffix file opens successfully on macOS)

## Summary

total: 6
passed: 5
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps

### Gap 1 — Uppercase-suffix file rejected by downstream load IPC (CR-01)
source_test: 6
severity: bug (correctness)
status: resolved
resolved_by: c1b32e4 fix(34): CR-01 case-insensitive suffix checks at load validators
review_ref: 34-REVIEW.md CR-01 → 34-REVIEW-FIX.md
fix_commits:
  - c1b32e4 — case-insensitive suffix checks at all 4 load validators + 7 new test cases
verification: 1056 tests pass post-fix (1049 → 1056); needs human re-test of original failing case on real uppercase file (Test 6 above)
