---
phase: 23-optimize-flow-defer-folder-picker
plan: 01
subsystem: renderer/optimize-flow
tags: [ux, optimize, deferred-picker, lastOutDir, AppShell, OptimizeDialog]
dependency_graph:
  requires: []
  provides: [OPT-01, OPT-02]
  affects:
    - src/renderer/src/components/AppShell.tsx
    - src/renderer/src/modals/OptimizeDialog.tsx
tech_stack:
  added: []
  patterns:
    - useState lazy initializer seeded from initialProject (established pattern)
    - silent fire-and-forget IPC (void window.api.*) for lastOutDir auto-save
    - functional setExportDialogState update inside async callback
    - source-grep regression tests via readFile (established in app-shell-output-picker.spec.tsx)
key_files:
  created:
    - tests/renderer/appshell-optimize-flow.spec.tsx
  modified:
    - src/renderer/src/components/AppShell.tsx
    - src/renderer/src/modals/OptimizeDialog.tsx
decisions:
  - "outDir widened to string|null in both exportDialogState and OptimizeDialogProps — dialog can mount before picker runs"
  - "pickOutputDir refactored to accept explicit startPath param — pre-fills at lastOutDir or skeletonDir"
  - "onClickOptimize no longer calls picker — opens dialog immediately (OPT-01)"
  - "onConfirmStart runs picker before probe — cancel returns proceed:false, stays pre-flight (D-05)"
  - "lastOutDir state slot seeded from initialProject?.lastOutDir — closes D-147 documented deferral from Phase 9"
  - "onRunEnd silently persists lastOutDir via fire-and-forget saveProject when currentProjectPath != null (D-07/D-08)"
  - "ConflictDialog re-pick call site updated to pass startPath (Rule 1 auto-fix — TypeScript error from pickOutputDir signature change)"
metrics:
  duration: "7m 18s"
  completed: "2026-05-03T22:04:54Z"
  tasks_completed: 2
  files_modified: 3
---

# Phase 23 Plan 01: Deferred-Picker Optimize Flow Summary

Rewired the Optimize Assets toolbar button so OptimizeDialog opens immediately on click (OPT-01) and the OS folder picker is deferred to the Start button inside the dialog (OPT-02). Users can now review the pre-flight summary before committing to an output folder; cancelling the picker returns to pre-flight rather than dismissing the dialog. `lastOutDir` is silently persisted to `.stmproj` after each export.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests for deferred-picker flow | 56b60a0 | tests/renderer/appshell-optimize-flow.spec.tsx |
| 1+2 (GREEN) | AppShell.tsx + OptimizeDialog.tsx implementation | c389020 | AppShell.tsx, OptimizeDialog.tsx, test fixes |

## What Was Built

### AppShell.tsx — Five Edit Sites

**Edit A — exportDialogState type widening:**
`outDir: string` → `outDir: string | null` so the dialog can mount before a picker result is available.

**Edit B — lastOutDir state slot + pickOutputDir refactor + onClickOptimize:**
- New `useState<string | null>` seeded from `initialProject?.lastOutDir ?? null` (line 280)
- `pickOutputDir` refactored to accept explicit `startPath: string` parameter
- `onClickOptimize` no longer calls the picker — builds plan then sets `exportDialogState({ plan, outDir: lastOutDir })`

**Edit C — onConfirmStart runs picker before probe:**
- Derives `startPath = lastOutDir ?? skeletonDir` (D-04)
- Opens picker via `pickOutputDir(startPath)`
- Picker cancel → `{ proceed: false }` → dialog stays in pre-flight (D-05)
- On confirmed folder: updates `exportDialogState.outDir` + `lastOutDir` before conflict probe

**Edit D — buildSessionState + onRunEnd:**
- `lastOutDir: null` hardcode (the D-147 deferral from Phase 9) replaced with `lastOutDir` state slot
- `lastOutDir` added to `buildSessionState` dependency array
- `onRunEnd` gains silent fire-and-forget `saveProject(buildSessionState(), currentProjectPath)` guarded by `currentProjectPath !== null` (D-07/D-08)

**ConflictDialog re-pick (Rule 1 auto-fix):**
`onConflictPickDifferent` called `pickOutputDir()` with no argument after signature change. Fixed to pass `lastOutDir ?? skeletonDir` as startPath, and added `lastOutDir` to its dependency array.

### OptimizeDialog.tsx — Three Edit Sites

**Prop type widening:** `outDir: string | null` in `OptimizeDialogProps`

**Null guard on onOpenOutputFolder:** `if (props.outDir !== null)` wraps the `window.api.openOutputFolder` call

**Conditional headerTitle pre-flight branch:**
- `outDir === null`: `"Optimize Assets — N images"` (D-01)
- `outDir !== null`: `"Optimize Assets — N images → /path"` (D-02)
- in-progress branch unchanged (outDir non-null by construction when export starts)

### Test File

`tests/renderer/appshell-optimize-flow.spec.tsx` (new, 8 tests):
- D-01: pre-flight header shows N images (no path) when outDir is null
- D-02: pre-flight header shows N images → /path when outDir is set
- Null guard: openOutputFolder not called on mount when outDir is null
- Source-grep gates: onClickOptimize has no pickOutputDirectory call, lastOutDir state slot exists, onConfirmStart calls pickOutputDir before probeExportConflicts, buildSessionState has no null hardcode, onRunEnd has saveProject call

## Test Results

- New Phase 23 tests: 8/8 pass
- Existing optimize tests: 18/18 pass (optimize-dialog-passthrough.spec.tsx, optimize-dialog-passthrough-rows.spec.tsx, app-shell-output-picker.spec.tsx)
- Full suite: 735 + 8 = 743 pass (3 pre-existing failures unrelated to Phase 23: build-scripts version check, sampler-worker-girl wall-time, atlas-preview-modal dblclick)
- TypeScript: `npx tsc --noEmit` exits 0

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed ConflictDialog re-pick call site for new pickOutputDir signature**
- **Found during:** Task 1 implementation (TypeScript type error)
- **Issue:** `onConflictPickDifferent` called `pickOutputDir()` with no arguments after the function signature was changed to require `startPath: string`. This would be a TypeScript compile error.
- **Fix:** Added `startPath = lastOutDir ?? skeletonDir` derivation before the call; updated dependency array to include `lastOutDir`. The logic mirrors the `onConfirmStart` approach (D-04).
- **Files modified:** `src/renderer/src/components/AppShell.tsx` (same file, same commit)

**2. [Rule 2 - Test Assertion Fix] Corrected D-01 test to target header text not row arrows**
- **Found during:** GREEN test run — `→` appears in row body dims display (`699 × 699 → 350 × 350`)
- **Fix:** Changed `queryByText(/→/)` to `expect(headerEl.textContent).not.toMatch(/→.*\//)` — checks the header element specifically for a path-arrow pattern
- **Files modified:** `tests/renderer/appshell-optimize-flow.spec.tsx`

**3. [Rule 2 - Test Assertion Fix] Source-grep uses raw source to avoid false-positive on `/*` in line comments**
- **Found during:** GREEN test run — block comment regex `/\/\*[\s\S]*?\*\//` matched `/*` inside a `//` comment (`// renderer NEVER imports from src/core/* per arch.spec.ts gate`) creating a false block-comment span that wiped the target code
- **Fix:** Changed `onClickOptimize` source-grep test to use raw `src` (not `codeOnly`) for the `setExportDialogState` pattern; all other source-grep tests already used raw `src`
- **Files modified:** `tests/renderer/appshell-optimize-flow.spec.tsx`

## Known Stubs

None — all behavior is fully wired. `lastOutDir` flows from initialProject seed → state slot → buildSessionState → saveProject payload.

## Threat Surface Scan

No new threat surface. All changes are in renderer (AppShell.tsx, OptimizeDialog.tsx). The IPC channels used (`pickOutputDirectory`, `saveProject`, `probeExportConflicts`) already existed and are covered by the threat model in the PLAN.md (T-23-01 through T-23-05 — all accepted or mitigated with no new mitigations required beyond the schema validation already in place).

## Self-Check: PASSED
