---
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
plan: "01"
subsystem: core-types
tags: [types, pure-function, tdd, phase24, panel-semantics, orphaned-files]
dependency_graph:
  requires: []
  provides:
    - OrphanedFile type in src/shared/types.ts
    - findOrphanedFiles pure helper in src/core/usage.ts
    - AtlasNotFoundError toggle tip in src/core/errors.ts
  affects:
    - src/main/summary.ts (stub orphanedFiles: [] until Plan 02)
    - src/core/export.ts (D-109 exclusion cleared; Plan 02 rewires)
    - src/core/atlas-preview.ts (same)
    - src/renderer/src/lib/export-view.ts (same)
    - src/renderer/src/lib/atlas-preview-view.ts (same)
    - tests (all findUnusedAttachments references updated)
tech_stack:
  added: []
  patterns:
    - Pure set-difference helper (findOrphanedFiles: one-liner filter)
    - TDD RED/GREEN cycle (test first, then implementation)
    - Rule 3 cascading fix (7 downstream files updated for compilation)
key_files:
  created: []
  modified:
    - src/shared/types.ts
    - src/core/usage.ts
    - src/core/errors.ts
    - src/main/summary.ts
    - src/core/export.ts
    - src/core/atlas-preview.ts
    - src/renderer/src/lib/export-view.ts
    - src/renderer/src/lib/atlas-preview-view.ts
    - tests/core/usage.spec.ts
    - tests/core/atlas-preview.spec.ts
    - tests/core/export.spec.ts
    - tests/core/loader-atlas-less.spec.ts
    - tests/core/loader-dims-mismatch.spec.ts
    - tests/core/summary.spec.ts
decisions:
  - "D-109 exclusion set cleared to [] in export.ts + atlas-preview.ts (Plan 02 rewires with new semantics)"
  - "summary.ts uses orphanedFiles: [] stub until Plan 02 adds fs.readdirSync I/O"
  - "Downstream test files updated to use orphanedFiles: [] instead of findUnusedAttachments calls"
metrics:
  duration_seconds: 848
  completed_date: "2026-05-04"
  tasks_completed: 3
  files_changed: 14
---

# Phase 24 Plan 01: Type Foundation and Pure Core Logic Summary

**One-liner:** OrphanedFile type + findOrphanedFiles pure helper replacing the Phase 5 UnusedAttachment/findUnusedAttachments contract; AtlasNotFoundError gains images-folder toggle tip.

## What Was Built

### Task 1: Replace UnusedAttachment with OrphanedFile in shared/types.ts (60d69c1)

Removed the Phase 5 `UnusedAttachment` interface (8 fields, attachment-visibility semantics) and replaced it with the Phase 24 `OrphanedFile` interface (2 fields: `filename: string` + `bytesOnDisk: number`). Renamed `SkeletonSummary.unusedAttachments` to `orphanedFiles?: OrphanedFile[]`. Updated the JSDoc comment on `skippedAttachments` for consistency.

### Task 2: Replace findUnusedAttachments with findOrphanedFiles (TDD RED + GREEN)

**RED (1e6c8b2):** Rewrote `tests/core/usage.spec.ts` to test `findOrphanedFiles` with 5 pure behavior cases (empty inputs, all used, one orphan, mixed, all orphaned). Module hygiene + export surface checks updated. 6 tests fail as expected.

**GREEN (e54f298):** Replaced `src/core/usage.ts` (183 lines of Phase 5 algorithm) with a 27-line file containing only `findOrphanedFiles`. Zero I/O, zero node: imports (CLAUDE.md #5 preserved). All 8 usage tests pass.

**Cascading fixes (Rule 3):** Removing `findUnusedAttachments` broke 7 downstream files. Fixed:
- `src/main/summary.ts`: removed `findUnusedAttachments` call; added `orphanedFiles: []` stub
- `src/core/export.ts` + `atlas-preview.ts`: cleared `summary.unusedAttachments` exclusion loops
- `src/renderer/src/lib/export-view.ts` + `atlas-preview-view.ts`: same
- 5 test files: removed `findUnusedAttachments` imports; updated mock objects to `orphanedFiles: []`

### Task 3: Update AtlasNotFoundError message (1d1d727)

Added the toggle tip sentence to `AtlasNotFoundError`: `or enable the "Use Images Folder as Source" toggle in the toolbar and reload`. Class name, `.name`, `searchedPath`, `skeletonPath` fields unchanged.

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — Blocking)

**1. [Rule 3 - Blocking] Cascading break from removing findUnusedAttachments**
- **Found during:** Task 2 GREEN phase
- **Issue:** Removing `findUnusedAttachments` from `src/core/usage.ts` caused `TypeError: findUnusedAttachments is not a function` in 7 files that imported or called it
- **Fix:** Updated all downstream files to remove the import and use `orphanedFiles: []` in mocks; cleared `summary.unusedAttachments` exclusion blocks in export.ts, atlas-preview.ts and their renderer copies; updated D-109 test expectations to match Phase 24 behavior
- **Files modified:** `src/main/summary.ts`, `src/core/export.ts`, `src/core/atlas-preview.ts`, `src/renderer/src/lib/export-view.ts`, `src/renderer/src/lib/atlas-preview-view.ts`, `tests/core/atlas-preview.spec.ts`, `tests/core/export.spec.ts`, `tests/core/loader-atlas-less.spec.ts`, `tests/core/loader-dims-mismatch.spec.ts`, `tests/core/summary.spec.ts`
- **Commits:** e54f298

**2. [Rule 1 - Bug] Comment in usage.ts triggered grep verification false positive**
- **Found during:** Post-task verification
- **Issue:** Comment "Replaces the old findUnusedAttachments..." caused `grep -c "findUnusedAttachments" src/core/usage.ts` to return 1 (plan expects 0)
- **Fix:** Reworded comment to avoid the exact string
- **Commit:** 9ee380f

### Behavioral Changes (Phase 24 design consequence)

The D-109 exclusion behavior has changed: `buildExportPlan` and `buildAtlasPreview` previously excluded attachments in `unusedAttachments` (never-rendered attachments). With Phase 24, the exclusion set is always empty — GHOST and similar never-rendered attachments are no longer excluded from the export plan via this mechanism. They remain absent from the plan because they are never in `summary.peaks` (the sampler never saw them with alpha > 0). Plan 02 will wire a new exclusion surface if needed.

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `orphanedFiles: []` | `src/main/summary.ts:125` | Plan 02 adds fs.readdirSync images/ + fs.statSync per PNG |

## Self-Check

### Created files exist:
- `.planning/phases/24-panel-semantics-unused-assets-rewrite-atlas-savings-metric/24-01-SUMMARY.md` ✓

### Commits exist:
- 60d69c1 — Task 1: UnusedAttachment → OrphanedFile
- 1e6c8b2 — Task 2 RED: failing tests
- e54f298 — Task 2 GREEN: implementation + cascade fixes
- 1d1d727 — Task 3: AtlasNotFoundError toggle tip
- 9ee380f — refactor: comment cleanup

### Verification checks:
1. `grep -c "export interface OrphanedFile" src/shared/types.ts` → 1 ✓
2. `grep -c "UnusedAttachment" src/shared/types.ts` → 0 ✓
3. `grep -c "unusedAttachments" src/shared/types.ts` → 0 ✓
4. `grep -c "export function findOrphanedFiles" src/core/usage.ts` → 1 ✓
5. `grep -c "findUnusedAttachments" src/core/usage.ts` → 0 ✓
6. `grep -c "node:fs\|node:path" src/core/usage.ts` → 0 ✓
7. `grep -c "Use Images Folder as Source" src/core/errors.ts` → 1 ✓
8. `npm run test` → 3 failed | 63 passed (3 pre-existing failures, no regressions) ✓

## Self-Check: PASSED
