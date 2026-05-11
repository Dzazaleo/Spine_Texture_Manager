---
status: partial
phase: 34-file-open-accepts-json-files
source: [34-VERIFICATION.md]
started: 2026-05-11T21:25:00Z
updated: 2026-05-11T22:00:00Z
---

## Current Test

[item 2 (Windows picker) still pending]

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
note: REVIEW.md CR-01 documents this currently fails — picker is case-insensitive (project-io.ts:330) but downstream load validators (project-io.ts:367, ipc.ts:425) reject case-sensitively. Not strictly required by any OPEN-0x requirement; flagged for triage decision (accept as bug-fix in Phase 34 or defer).
result: failed (2026-05-11) — confirms REVIEW.md CR-01 on macOS; awaiting triage decision

## Summary

total: 6
passed: 4
issues: 1
pending: 1
skipped: 0
blocked: 0

## Gaps

### Gap 1 — Uppercase-suffix file rejected by downstream load IPC (CR-01)
source_test: 6
severity: bug (correctness)
status: confirmed
review_ref: 34-REVIEW.md CR-01
locus:
  - src/main/project-io.ts:367 (handleProjectOpenFromPath case-sensitive `endsWith('.stmproj')`)
  - src/main/ipc.ts:425 (handleSkeletonLoad case-sensitive `endsWith('.json')`)
  - mirror also at src/main/project-io.ts:700/706 (handleProjectReloadWithSkeleton) and :933 (handleProjectResample)
trigger: macOS APFS case-insensitive volume holding a file named with uppercase suffix; picker routes correctly (case-insensitive at project-io.ts:330) but load IPC rejects with generic `kind: 'Unknown'`.
fix_recommended: Lowercase the suffix before the load-side `.endsWith()` checks (mirror what the picker does). Single-line fix per call-site.
open_0x_blocker: no — OPEN-01..05 mandate extension acceptance/routing, not case-insensitive load. Treating as separate correctness fix.
