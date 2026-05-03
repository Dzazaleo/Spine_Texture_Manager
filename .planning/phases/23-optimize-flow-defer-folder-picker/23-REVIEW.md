---
phase: 23-optimize-flow-defer-folder-picker
reviewed: 2026-05-03T12:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/OptimizeDialog.tsx
  - tests/renderer/appshell-optimize-flow.spec.tsx
findings:
  critical: 2
  warning: 2
  info: 2
  total: 6
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-03T12:00:00Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 23 defers the output-folder picker from toolbar-click to the Start button inside OptimizeDialog, introduces `lastOutDir` as a real AppShell state slot, and wires it into `buildSessionState`, `onConfirmStart`, and `onRunEnd`. The deferred-picker logic (OPT-01 / OPT-02) in `onClickOptimize` and `onConfirmStart` is structurally correct, and the source-grep regression gates in the test suite all pass against the actual source.

Two critical bugs were found: `mountOpenResponse` (the Cmd+O open path) does not restore `lastOutDir` from the materialized project, meaning the Phase 23 round-trip only works for the drag-drop path that remounts AppShell; and `DocumentationBuilderDialog` receives a hardcoded `lastOutDir={null}` instead of the live state slot, silently defeating the Phase 23 goal for the HTML-export picker. Two warnings and two info items follow.

---

## Critical Issues

### CR-01: `mountOpenResponse` does not call `setLastOutDir` — Cmd+O open path never restores `lastOutDir`

**File:** `src/renderer/src/components/AppShell.tsx:815-843`

**Issue:** `mountOpenResponse` is the single site that applies a `MaterializedProject` to AppShell state. It correctly restores `overrides`, `lastSaved`, `staleOverrideNotice`, `documentation`, `loaderMode`, and `currentProjectPath`. However it does **not** call `setLastOutDir`. `MaterializedProject` carries `lastOutDir` and the main-side `handleProjectOpenFromPath` populates it from the saved `.stmproj` (project-io.ts line 442). Because `mountOpenResponse` omits it, the Cmd+O open flow (`onClickOpen` → `mountOpenResponse`) always leaves `lastOutDir` at its stale in-memory value (or `null` for a fresh session) regardless of what was saved in the project file.

For comparison, `loaderMode` was correctly added to `mountOpenResponse` in Phase 21 (line 842). The `lastOutDir` slot was added in Phase 23 but the corresponding line in `mountOpenResponse` was missed.

The `lastOutDir` state IS correctly seeded for the drag-drop path: App.tsx remounts AppShell with `initialProject` on a drop, and the `useState` lazy initializer at line 281 reads `initialProject?.lastOutDir`. That path works. The Cmd+O path does not.

**Fix:**

```typescript
// In mountOpenResponse, after line 842 (setLoaderMode), add:
setLastOutDir(project.lastOutDir ?? null);
```

---

### CR-02: `DocumentationBuilderDialog` receives hardcoded `lastOutDir={null}` — Phase 23 state slot not threaded

**File:** `src/renderer/src/components/AppShell.tsx:1635`

**Issue:** Phase 23 promotes `lastOutDir` from a deferred `null` hardcode in `buildSessionState` to a real AppShell state slot (lines 277-282). It is correctly threaded into `buildSessionState` (line 651), `onClickOptimize` (line 512), `onConfirmStart` (line 545), and `onConflictPickDifferent` (line 614). However, the `DocumentationBuilderDialog` mount at line 1635 still passes `lastOutDir={null}` — the old hardcoded value.

`DocumentationBuilderDialog` uses `lastOutDir` to pre-fill the HTML-export folder picker: `null` falls back to the OS Documents folder (doc-export.ts line 89). After the user has exported to a specific output directory (which is now persisted in `lastOutDir`), the Documentation Builder's export picker will still open at Documents instead of the last-used folder. This is a direct regression from the Phase 23 goal.

**Fix:**

```tsx
// Line 1635 — change:
lastOutDir={null}
// to:
lastOutDir={lastOutDir}
```

---

## Warnings

### WR-01: `onConflictPickDifferent` updates `exportDialogState.outDir` but not `lastOutDir` — picker pre-fill is stale on next Start

**File:** `src/renderer/src/components/AppShell.tsx:607-624`

**Issue:** When the user resolves a conflict by picking a different folder, `onConflictPickDifferent` calls `setExportDialogState({ plan, outDir: newOutDir })` at line 623 but does not call `setLastOutDir(newOutDir)`. The OptimizeDialog header title correctly updates to show `newOutDir`. However, when the user then clicks Start again (re-entering the `onConfirmStart` pipeline), the picker is pre-filled using `lastOutDir` (line 545), not `exportDialogState.outDir`. Since `lastOutDir` was not updated, the picker opens with the previous value (or null), not the folder the user just picked in the conflict flow. The user must pick the same folder a second time.

Contrast with `onConfirmStart` at line 555 which correctly calls `setLastOutDir(pickedDir)` immediately after a successful pick.

**Fix:**

```typescript
// After line 623 in onConflictPickDifferent:
setExportDialogState({ plan, outDir: newOutDir });
setLastOutDir(newOutDir);   // keep lastOutDir in sync with the re-picked folder
```

---

### WR-02: Atlas Preview cross-nav button bypasses the in-progress close guard — can orphan a running export

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:390-399`

**Issue:** The footer-left "Atlas Preview" button (lines 390-399) calls `props.onClose()` directly, not through `onCloseSafely`. The `onCloseSafely` callback includes the T-06-16 guard at line 243: `if (state === 'in-progress') return;`. Calling `props.onClose()` directly bypasses that guard. A user who clicks "Atlas Preview" while an export is running will close the OptimizeDialog while `startExport` is still awaited in the background. The export continues silently on the main side; there is no longer any UI to surface progress, errors, or completion. The `onRunEnd` callback would still fire when `startExport` resolves (because `onStart` holds the closure), clearing `exportInFlight` in AppShell, but the user has no way to know the export finished or failed.

The button is disabled when `plan.rows.length === 0` but is otherwise always enabled, including during in-progress.

**Fix:** Add an additional disabled predicate for the in-progress state, or route the click through `onCloseSafely`:

```typescript
// Option A — disable during in-progress:
disabled={props.plan.rows.length === 0 || state === 'in-progress'}

// Option B — route through onCloseSafely (also prevents ESC bypass symmetrically):
onClick={() => {
  if (state === 'in-progress') return;
  props.onClose();
  props.onOpenAtlasPreview();
}}
```

---

## Info

### IN-01: `closeBothDialogs` is dead code preserved only by a `void` expression

**File:** `src/renderer/src/components/AppShell.tsx:576-629`

**Issue:** `closeBothDialogs` is defined at line 576 and explicitly kept alive by `void closeBothDialogs` at line 629. The comment at lines 625-628 acknowledges it is no longer wired to any handler — `onConflictCancel` replaced it as the Cancel path. The `void` trick suppresses the lint unused-variable warning without calling the function. This is dead code, and the associated comment block describing its JSDoc role adds noise without adding safety.

**Fix:** Delete `closeBothDialogs` (lines 576-580) and the `void closeBothDialogs` expression (line 629). Update or remove the comment block at lines 625-628.

---

### IN-02: All Phase 23 AppShell tests are source-grep assertions — no runtime coverage of the deferred-picker flow

**File:** `tests/renderer/appshell-optimize-flow.spec.tsx:130-210`

**Issue:** The five "AppShell.tsx — Phase 23 source-grep gates" tests read the source file as a string and apply regex assertions. They verify the implementation was written correctly but cannot catch runtime behavioural bugs — e.g., a stale closure in `onConfirmStart`, incorrect `lastOutDir` state after a conflict resolution, or the `mountOpenResponse` omission found in CR-01. Source-grep tests are also fragile against variable renames that preserve behaviour.

The three render-level tests (D-01, D-02, null-guard) exercise `OptimizeDialog` in isolation; none mount AppShell end-to-end.

No immediate fix is required; this is an observation about coverage quality. A future phase should add a render-level integration test for the full deferred-picker flow: click Optimize → dialog opens with `outDir=null` → click Start → `pickOutputDirectory` is called with correct `startPath` → dialog shows selected path.

---

_Reviewed: 2026-05-03T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
