---
phase: 25-missing-attachments-in-context-display
plan: 01
subsystem: ui
tags: [ipc, typescript, vitest, displayrow, buildSummary]

# Dependency graph
requires:
  - phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
    provides: LoadResult.skippedAttachments + stub-region synthesis (Plan 21-09 + Plan 21-10)
  - phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
    provides: DisplayRow.dimsMismatch + canonicalW/H fields (Plan 22-01)
provides:
  - DisplayRow.isMissing?: boolean field in IPC contract (src/shared/types.ts)
  - buildSummary marking contract: stub rows marked isMissing:true in peaksArray + animationBreakdown card rows (no filtering)
  - Phase 25 G-02 test suite: marking assertions + 3 new Phase 25 tests
affects:
  - 25-02 (renderer danger-indicator panels — reads isMissing from IPC payload)
  - Any consumer of DisplayRow or BreakdownRow (isMissing: undefined is backward-compatible)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Map+mark pattern: spread row + set isMissing: skippedNames.has(...) ? true : undefined (lean payload — no false sentinel)"
    - "Optional boolean as presence indicator: undefined === absent, true === present (no false needed)"

key-files:
  created: []
  modified:
    - src/shared/types.ts
    - src/main/summary.ts
    - tests/core/summary.spec.ts

key-decisions:
  - "isMissing: undefined (not false) for non-stub rows — keeps IPC payload lean and backward-compatible"
  - "Phase 25 reverses Phase 21 G-02 filter: stub rows now remain in peaks + animationBreakdown arrays visible to renderer"
  - "uniqueAssetCount equals rows.length including missing rows (not filtered count)"

patterns-established:
  - "Mark-not-filter: stub rows stay in arrays; renderer decides presentation via isMissing flag"

requirements-completed:
  - PANEL-03

# Metrics
duration: 12min
completed: 2026-05-04
---

# Phase 25 Plan 01: Missing Attachments In-Context Display — Data Layer Summary

**DisplayRow gains isMissing?: boolean; buildSummary replaces two stub-row .filter() calls with .map()+mark so both main panels receive stub rows with a danger flag instead of silently dropping them.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-04T14:44:00Z
- **Completed:** 2026-05-04T14:46:15Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3

## Accomplishments

- `DisplayRow.isMissing?: boolean` added with full JSDoc (Phase 25 context, BreakdownRow inherits automatically)
- `buildSummary` peaksArray line: `.filter()` → `.map()` with `isMissing: skippedNames.has(p.attachmentName) ? true : undefined`
- `buildSummary` animationBreakdown block: `filteredRows.filter()` → `rows.map()` + `uniqueAssetCount: rows.length`
- SkeletonSummary.skippedAttachments docblock updated from "filter contract / pre-filtered to EXCLUDE" to "Phase 25 marking contract"
- G-02 unit test renamed and assertions inverted (TRIANGLE present with isMissing: true, not absent)
- 3 new Phase 25 tests: structuredClone IPC-safe, undefined-not-false, uniqueAssetCount includes missing
- Full vitest suite: 0 regressions introduced (2 pre-existing failures in atlas-preview-modal + build-scripts are baseline noise)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add isMissing to DisplayRow and update SkeletonSummary docblock** — `aecb8ba` (feat)
2. **Task 2 RED: Revise G-02 tests to assert isMissing marking contract** — `f13f154` (test)
3. **Task 2 GREEN: Replace stub-row filters with isMissing marking in buildSummary** — `19be841` (feat)

**Plan metadata:** (docs commit follows)

_Note: TDD tasks have separate test (RED) and feat (GREEN) commits._

## Files Created/Modified

- `src/shared/types.ts` — Added `isMissing?: boolean` to DisplayRow interface; updated SkeletonSummary.skippedAttachments docblock to Phase 25 marking contract
- `src/main/summary.ts` — Replaced two .filter() sites with .map()+mark; updated Phase 21 comment blocks and inline docblock
- `tests/core/summary.spec.ts` — Revised G-02 unit test name + assertions; added 3 Phase 25 test cases

## Decisions Made

- `isMissing: undefined` (not `false`) for non-stub rows — lean IPC payload; `undefined === falsy` is backward-compatible with all existing consumers
- Reversed the Phase 21 G-02 filter contract at the data layer: stub rows now flow to both main panels (renderer Plan 25-02 handles danger indicator presentation)
- `uniqueAssetCount: rows.length` includes missing rows — the count reflects what the user sees in the panel header

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled clean after Task 1; all 15 summary.spec.ts tests passed after Task 2; 2 pre-existing test failures (atlas-preview-modal + build-scripts) confirmed as baseline noise from before this branch.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `DisplayRow.isMissing?: boolean` is in the IPC contract and flows through structuredClone cleanly
- `buildSummary` now delivers stub rows in both `peaks` and `animationBreakdown` with `isMissing: true`
- Plan 25-02 (renderer danger-indicator panels) can now read `isMissing` from the IPC payload and render red left-border accent + warning icon

---
*Phase: 25-missing-attachments-in-context-display*
*Completed: 2026-05-04*
