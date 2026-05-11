---
status: partial
phase: 34-file-open-accepts-json-files
source: [34-VERIFICATION.md]
started: 2026-05-11T21:25:00Z
updated: 2026-05-11T21:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. macOS — File → Open dialog accepts both .stmproj and .json in a single unified filter
expected: Click File → Open (or press Cmd+O). OS picker opens with title 'Open Spine Project or Skeleton'. Both .stmproj and .json files appear selectable in one filter labelled 'Spine Project or Skeleton'. No dropdown to operate.
result: [pending]

### 2. Windows — same dialog test on Windows
expected: Same as above but with Windows file picker. Single dropdown entry 'Spine Project or Skeleton (*.stmproj; *.json)'.
result: [pending]

### 3. Atlas-source .json menu open produces same summary as drag-drop
expected: With no project loaded, File → Open, pick fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json. App lands status:'loaded'. Global panel + Animation Breakdown identical to drag-dropping the same file. Atlas-source mode auto-selected (sibling .atlas detected).
result: [pending]

### 4. Atlas-less .json menu open via sibling images/ folder
expected: With no project loaded, File → Open, pick a .json from a folder with no .atlas but a sibling images/ folder (e.g., fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH_NON_ESSENTIAL/). App lands status:'loaded', atlas-less mode auto-selected via synthesizer fall-through (D-05). Identical to drag-drop.
result: [pending]

### 5. Cmd+O / Ctrl+O accelerator parity with menu click
expected: With app focused and no project loaded, press Cmd+O (macOS) / Ctrl+O (Windows). Same picker opens, same dispatch happens, identical behavior to clicking File → Open menu item.
result: [pending]

### 6. Uppercase-suffix file (e.g., MyRig.STMPROJ or Skel.JSON) opens successfully
expected: Pick a file with uppercase extension. App loads it without error.
note: REVIEW.md CR-01 documents this currently fails — picker is case-insensitive (project-io.ts:330) but downstream load validators (project-io.ts:367, ipc.ts:425) reject case-sensitively. Not strictly required by any OPEN-0x requirement; flagged for triage decision (accept as bug-fix in Phase 34 or defer).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
