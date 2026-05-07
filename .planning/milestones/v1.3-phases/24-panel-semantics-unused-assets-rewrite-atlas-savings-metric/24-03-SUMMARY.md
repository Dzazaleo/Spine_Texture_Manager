---
phase: 24
plan: "03"
subsystem: renderer/panels
tags: [component, panel, unused-assets, tdd, rtl]
dependency_graph:
  requires: ["24-01"]
  provides: ["UnusedAssetsPanel component (PANEL-02)"]
  affects: ["src/renderer/src/panels/UnusedAssetsPanel.tsx", "tests/renderer/unused-assets-panel.spec.tsx"]
tech_stack:
  added: []
  patterns: ["RTL + jsdom behavior spec", "collapsible panel with SearchBar filter", "useState(true) expanded-by-default", "useMemo filter before early-return guard"]
key_files:
  created:
    - src/renderer/src/panels/UnusedAssetsPanel.tsx
    - tests/renderer/unused-assets-panel.spec.tsx
  modified: []
decisions:
  - "useMemo placed before early-return null guard to satisfy React Rules of Hooks"
  - "Test (d) singular check uses panel.textContent matcher instead of getByText regex — text split across child span elements prevents cross-boundary regex matching"
  - "dangerouslySetInnerHTML appears 0 times in component code; comment in file header documents XSS mitigation (T-24-03-01)"
metrics:
  duration: "~4 minutes"
  completed: "2026-05-04"
  tasks_completed: 1
  files_changed: 2
---

# Phase 24 Plan 03: UnusedAssetsPanel Component Summary

**One-liner:** Collapsible orphaned-PNG panel with SearchBar filter, formatBytes header bytes display, and font-mono table — structural clone of MissingAttachmentsPanel adapted for OrphanedFile[] data.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| RED | Create failing RTL tests for UnusedAssetsPanel | 92ba863 | tests/renderer/unused-assets-panel.spec.tsx |
| GREEN | Implement UnusedAssetsPanel + fix test (d) | facab33 | src/renderer/src/panels/UnusedAssetsPanel.tsx, tests/renderer/unused-assets-panel.spec.tsx |

## What Was Built

`src/renderer/src/panels/UnusedAssetsPanel.tsx` — new component implementing PANEL-02 (D-06/D-07):

- Returns `null` when `orphanedFiles.length === 0` (panel hidden, no empty-state placeholder)
- Expanded by default when N > 0 (`useState(true)`) per D-06
- Header: danger strip + count + plural + ` · {formatBytes(totalBytes)}` per UI-SPEC copywriting contract
- `role="alert"` + `aria-label="Orphaned image files"` per ARIA contract
- Collapsible toggle button: "Hide details" / "Show details" + `aria-expanded`
- `<SearchBar>` filter with `placeholder="Filter by filename…"` — substring match on filename
- `(no matches)` empty-filter state in centered `<td colSpan={2}>`
- Table: Filename + Size on Disk columns (font-mono text-sm per UI-SPEC typography)
- XSS mitigated: filenames rendered as React text children only, never `dangerouslySetInnerHTML` (T-24-03-01)

`tests/renderer/unused-assets-panel.spec.tsx` — 9 RTL behavior gates:
- (a) null-when-empty
- (b) role/aria-label
- (c) expanded-by-default
- (d) singular header
- (e) plural header
- (f) bytes display
- (g) collapse/expand toggle
- (h) table rows with formatted sizes
- (i) search filter with (no matches) state

## TDD Gate Compliance

- RED gate commit: `92ba863` (`test(24-03): add failing RTL tests for UnusedAssetsPanel (RED)`)
- GREEN gate commit: `facab33` (`feat(24-03): implement UnusedAssetsPanel component (GREEN)`)
- REFACTOR: not needed — component is clean on first pass

## Test Results

741 tests pass (up from 732 before this plan). The 3 pre-existing failures (sampler-worker-girl wall-time, build-scripts version check, atlas-preview-modal dblclick) are unrelated to Plan 24-03.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Moved useMemo before early-return guard (Rules of Hooks)**
- **Found during:** GREEN implementation
- **Issue:** Plan's code snippet placed `useMemo` after `if (orphanedFiles.length === 0) return null`, violating React's Rules of Hooks (conditional hook call).
- **Fix:** Moved all computed values (`count`, `plural`, `totalBytes`, `filteredOrphans`) before the early-return guard. Hooks are now unconditionally called.
- **Files modified:** src/renderer/src/panels/UnusedAssetsPanel.tsx
- **Commit:** facab33

**2. [Rule 1 - Bug] Fixed RTL test (d) — singular header text cross-element mismatch**
- **Found during:** GREEN verification (first test run)
- **Issue:** Test used `getByText(/1 orphaned file[^s]/i)` but text "1 orphaned file" is split across nested `<span>` elements; `getByText` cannot match across element boundaries.
- **Fix:** Changed to `panel.textContent.match(...)` on the `role="alert"` container, which aggregates all descendant text nodes.
- **Files modified:** tests/renderer/unused-assets-panel.spec.tsx
- **Commit:** facab33

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Component renders user-supplied filenames as React text children — XSS mitigated by React's automatic text escaping per T-24-03-01 threat register.

## Known Stubs

None. Component is fully functional. AppShell wiring is Plan 24-04's responsibility (per plan objective: "no AppShell wiring yet").

## Self-Check

- [x] `src/renderer/src/panels/UnusedAssetsPanel.tsx` exists
- [x] `export function UnusedAssetsPanel` present (1 occurrence)
- [x] `return null` guard present (1 occurrence)
- [x] `useState(true)` present (1 occurrence)
- [x] No `dangerouslySetInnerHTML` in component logic (only in comment)
- [x] `tests/renderer/unused-assets-panel.spec.tsx` exists with 9 test cases
- [x] RED commit `92ba863` exists in git log
- [x] GREEN commit `facab33` exists in git log
- [x] 741 tests pass (full suite)

## Self-Check: PASSED
