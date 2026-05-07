---
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
plan: "04"
subsystem: renderer
tags: [ui, panels, unused-assets, savings-metric, wave-3]
dependency_graph:
  requires: ["24-01", "24-02", "24-03"]
  provides: ["GlobalMaxRenderPanel savingsPct chip", "UnusedAssetsPanel in AppShell render tree"]
  affects: ["src/renderer/src/panels/GlobalMaxRenderPanel.tsx", "src/renderer/src/components/AppShell.tsx"]
tech_stack:
  added: []
  patterns: ["conditional chip rendering", "optional prop threading", "?? [] IPC fallback"]
key_files:
  created: []
  modified:
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
    - src/renderer/src/components/AppShell.tsx
decisions:
  - "savingsPct chip uses text-warning (not text-accent) per UI-SPEC color contract — informational metric, not interactive"
  - "orphanedFiles uses ?? [] fallback per established IPC optional field pattern"
  - "unusedNameSet.has() replaced with false (not removed from rowState signature) — rowState() still supports isUnused for future use"
  - "chip positioned between title and counter; counter retains ml-auto for right-alignment"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 2
---

# Phase 24 Plan 04: Wire GlobalMaxRenderPanel + AppShell — Phase 24 Integration Summary

**One-liner:** Removed old unused-attachment section from GlobalMaxRenderPanel and added savingsPct chip to its header; inserted UnusedAssetsPanel between GlobalMaxRenderPanel and AnimationBreakdownPanel in AppShell with savingsPct threading.

## What Was Built

### Task 1: GlobalMaxRenderPanel surgery (commit b4e2229)

Four removals + two additions to `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`:

**Removals:**
- `unusedAttachments` local variable (was `summary.unusedAttachments ?? []`)
- `unusedNameSet` useMemo block (Set of attachment names for O(1) lookup)
- `aggregateBytes` reduce expression (total bytes across unused rows)
- `filteredUnused` useMemo block (substring-filtered slice of unused rows)
- The full unused-attachment section JSX block (lines 856-907 in original — Chrome visible when non-empty, with table showing Attachment / Source Size / Defined In columns)
- Both `unusedNameSet.has(row.attachmentName)` call sites in rowState() (replaced with `false`)

**Additions:**
- `savingsPct?: number | null` prop in `GlobalMaxRenderPanelProps` interface (with full JSDoc rationale)
- `savingsPct` in function destructuring
- savingsPct chip in section header: `{savingsPct !== null && savingsPct !== undefined && savingsPct > 0 && (<span className="font-mono text-xs text-warning border border-border rounded-md px-2 py-1 flex-shrink-0">{savingsPct.toFixed(1)}% pixel savings</span>)}`

### Task 2: AppShell wiring (commit 36cc358)

Three additions to `src/renderer/src/components/AppShell.tsx`:

- Import: `import { UnusedAssetsPanel } from '../panels/UnusedAssetsPanel';`
- `savingsPct={savingsPctMemo}` added to `<GlobalMaxRenderPanel>` JSX prop list
- `<UnusedAssetsPanel orphanedFiles={effectiveSummary.orphanedFiles ?? []} />` inserted between GlobalMaxRenderPanel and AnimationBreakdownPanel (D-07 position); renders on both tabs (project-level concern)

## Verification Results

| Check | Expected | Actual | Status |
|-------|----------|--------|--------|
| Stale refs (unusedAttachments/unusedNameSet/aggregateBytes/filteredUnused) in GlobalMaxRenderPanel | 0 | 0 | PASS |
| savingsPct occurrences in GlobalMaxRenderPanel | >= 2 | 6 | PASS |
| pixel savings occurrences in GlobalMaxRenderPanel | 1 | 1 | PASS |
| UnusedAssetsPanel occurrences in AppShell | >= 2 | 2 | PASS |
| savingsPctMemo occurrences in AppShell | >= 2 | 3 | PASS |
| orphanedFiles occurrences in AppShell | 1 | 1 | PASS |
| TypeScript clean | 0 errors | 0 errors | PASS |
| Test suite | 0 new failures | 0 new failures | PASS |

**Pre-existing test failures (3):** build-scripts version check, sampler-worker wall-time gate, atlas-preview-modal dblclick — all unrelated to Phase 24 changes.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| Task 1 | b4e2229 | feat(24-04): remove unused-attachment section from GlobalMaxRenderPanel + add savingsPct chip |
| Task 2 | 36cc358 | feat(24-04): wire UnusedAssetsPanel + savingsPct into AppShell render tree |

## Deviations from Plan

None — plan executed exactly as written.

The UI-SPEC specified chip position between title and counter with counter retaining `ml-auto`. The plan description was slightly ambiguous ("insert chip BEFORE the ml-auto counter span") but the final layout matches the UI-SPEC layout (§Modified component, header layout 1-5): icon → title → chip → counter-with-ml-auto.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Files created/modified are renderer-only UI components. OrphanedFiles values are rendered as React text children only (no dangerouslySetInnerHTML) — T-24-04-01 (XSS) mitigated by React auto-escape. savingsPctMemo is computed locally from effectiveSummary — T-24-04-02 (Tampering) accepted per threat register.

## Known Stubs

None — all data paths are wired: savingsPctMemo flows from effectiveSummary → buildExportPlan → chip; orphanedFiles flows from effectiveSummary → UnusedAssetsPanel.

## Self-Check: PASSED

- [x] `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` exists and modified
- [x] `src/renderer/src/components/AppShell.tsx` exists and modified
- [x] Commit b4e2229 exists in git log
- [x] Commit 36cc358 exists in git log
