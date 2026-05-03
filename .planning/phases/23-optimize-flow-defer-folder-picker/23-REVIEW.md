---
phase: 23-optimize-flow-defer-folder-picker
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/OptimizeDialog.tsx
  - tests/renderer/appshell-optimize-flow.spec.tsx
findings:
  critical: 2
  warning: 3
  info: 2
  total: 7
status: issues_found
---

# Phase 23: Code Review Report

**Reviewed:** 2026-05-03
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 23 defers the output-folder picker from toolbar-click to the Start button inside OptimizeDialog, adds `lastOutDir` as a real AppShell state slot, and wires it into `buildSessionState` / `onRunEnd`. The deferred-picker logic (OPT-01 / OPT-02) is implemented correctly and the source-grep regression gates in the test suite all pass against the actual source.

Two critical bugs were found: a type safety violation in `OptimizeDialog`'s error-path that passes `string | null` where `string` is required (causes a TypeScript compile error and a runtime type mismatch), and a state-consistency bug in `onConflictPickDifferent` that mutates `lastOutDir` only in `onConfirmStart` but not in the re-pick branch, so the re-opened dialog shows a stale path. Three warnings and two info items are also recorded.

---

## Critical Issues

### CR-01: `props.outDir` (`string | null`) passed as `string` to `ExportError.path` and `ExportSummary.outputDir`

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:219-225`

**Issue:** When `startExport` fails (the error-path branch on lines 216-228), the synthetic `ExportSummary` is built using `props.outDir` for both `ExportError.path` and `ExportSummary.outputDir`. Both fields are typed `string` (non-nullable) in `src/shared/types.ts` (`ExportError.path: string` at line 370; `ExportSummary.outputDir: string` at line 398). `props.outDir` is `string | null` — the Phase 23 change deliberately allows `null` when no folder has been picked yet. Passing `null` here violates the type contract, and will cause a TypeScript compiler error under strict mode. At runtime it produces `outputDir: null` and `path: null` on the synthetic summary, which any downstream consumer that treats `outputDir` as a non-nullable string will mishandle (e.g., the "Open output folder" button calls `window.api.openOutputFolder(props.outDir)` — already guarded — but serialisation or logging code on the main side may not be).

**Fix:**

```typescript
// In OptimizeDialog.tsx onStart, replace the synthetic summary construction:
setSummary({
  successes: 0,
  errors: [
    {
      kind: 'write-error',
      path: props.outDir ?? '',          // ExportError.path is string, not string|null
      message: response.error.message,
    },
  ],
  outputDir: props.outDir ?? '',         // ExportSummary.outputDir is string, not string|null
  durationMs: 0,
  cancelled: false,
});
```

Note: the `Start` button is only enabled when `total > 0` (line 416), and `total` derives from both `plan.rows` and `plan.passthroughCopies`, so theoretically `outDir` should have been picked by the time the export fires. However, because `onConfirmStart` may return `{ proceed: true }` even when `outDir` is still null (e.g., the hard-reject probe branch on line 563 also returns `proceed: true, overwrite: false`), this path is reachable.

---

### CR-02: `onClickOptimize` uses raw `summary` prop instead of `effectiveSummary`, causing stale plan on resample

**File:** `src/renderer/src/components/AppShell.tsx:511`

**Issue:** `onClickOptimize` calls `buildExportPlan(summary, overrides)` using the raw `summary` prop. After a settings change that triggers a resample, `effectiveSummary` is the post-resample `SkeletonSummary` held in `localSummary`, while `summary` is the stale prop that App.tsx has not yet updated (App.tsx only updates when the resample IPC completes and it re-routes the skeleton). If the user opens the Optimize dialog immediately after a resample completes inside AppShell (before App.tsx re-mounts with new prop), the plan is built from the old peaks, and the export will process wrong dimensions. The comparison point is line 702 (`savingsPctMemo`) which correctly uses `effectiveSummary`. `onConflictPickDifferent` at line 622 has the same bug.

**Fix:**

```typescript
// Line 511 — change:
const plan = buildExportPlan(summary, overrides);
// to:
const plan = buildExportPlan(effectiveSummary, overrides);

// Line 622 — same fix:
const plan = buildExportPlan(effectiveSummary, overrides);
```

Both `onClickOptimize` and `onConflictPickDifferent` deps arrays must also add `effectiveSummary` in place of `summary` where applicable.

---

## Warnings

### WR-01: `lastOutDir` not updated in `onConflictPickDifferent` after the user re-picks a folder

**File:** `src/renderer/src/components/AppShell.tsx:607-624`

**Issue:** When the user picks a different folder via `ConflictDialog`, `onConflictPickDifferent` stores the new `newOutDir` in `exportDialogState` (line 623) but does **not** call `setLastOutDir(newOutDir)`. This means `lastOutDir` is not persisted for the session: if the user cancels and reopens the Optimize dialog, the picker will pre-fill with the pre-conflict folder rather than the last-chosen one. More importantly, `buildSessionState` (line 651) reads `lastOutDir` — if a save happens after a conflict-resolved export, the persisted `lastOutDir` will be stale.

Contrast with `onConfirmStart` at line 555, which correctly calls `setLastOutDir(pickedDir)` immediately after picking.

**Fix:**

```typescript
// After line 623:
setExportDialogState({ plan, outDir: newOutDir });
setLastOutDir(newOutDir);                          // add this line
```

---

### WR-02: `onStart` useCallback in `OptimizeDialog` lists `[props]` as its dependency — overly broad, breaks `useFocusTrap` stability contract

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:232`

**Issue:** `onStart` is declared `useCallback(async () => { ... }, [props])`. The `props` object reference changes on every parent render (React creates a new object each call), so `onStart` is recreated on every parent render. The file's own comments (lines 246-253) describe the exact problem this causes: `useFocusTrap` lists `onEscape` in its dependency array, and the Enter-shortcut `keyDown` on line 277 captures `onStart` inline. A stale `onStart` in the keyDown handler is harmless (it closes over `state` which is the same stable state), but recreating `onStart` unnecessarily stresses the React reconciler and is internally inconsistent — `onCloseSafely` was explicitly narrowed from `[state, props]` to `[state, props.onClose]` to avoid this exact pattern (see lines 244-253). `onStart` reads `props.onConfirmStart`, `props.plan`, `props.outDir`, `props.onRunStart`, and `props.onRunEnd` — all of which are stable across renders in the common case.

**Fix:**

```typescript
// Replace the final }, [props]) with the explicit dep list:
}, [props.onConfirmStart, props.plan, props.outDir, props.onRunStart, props.onRunEnd]);
```

---

### WR-03: `DocumentationBuilderDialog` receives `lastOutDir={null}` hardcode instead of the live `lastOutDir` state slot

**File:** `src/renderer/src/components/AppShell.tsx:1635`

**Issue:** The Phase 23 change introduces `lastOutDir` as a real AppShell state slot (line 280) and correctly threads it into `buildSessionState`, `onClickOptimize`, `onConfirmStart`, and `onConflictPickDifferent`. However, the `DocumentationBuilderDialog` mount at line 1635 still passes `lastOutDir={null}` — a hardcoded `null`. `DocumentationBuilderDialog` uses this to pre-fill the HTML-export folder picker (`AppSessionState.lastOutDir; null falls back to OS Documents in main` per its prop JSDoc at types.ts). This means after the user selects an output folder during an Optimize export, the Documentation Builder's HTML-export picker will still default to the OS Documents folder instead of the last-chosen output directory — inconsistent UX.

**Fix:**

```tsx
// Line 1635 — change:
lastOutDir={null}
// to:
lastOutDir={lastOutDir}
```

---

## Info

### IN-01: `closeBothDialogs` is kept alive only via `void closeBothDialogs` — dead code that should be removed

**File:** `src/renderer/src/components/AppShell.tsx:576-629`

**Issue:** `closeBothDialogs` is defined at line 576 and kept from being tree-shaken by the `void closeBothDialogs` expression at line 629. The comment (lines 625-628) acknowledges this is intentional — the function is no longer wired to any handler because `onConflictCancel` is more specific. The `void` trick is a code smell: it preserves a dead callback purely to satisfy the type-checker and silences the "unused variable" lint rule. If `closeBothDialogs` is truly never intended to be called, it should be removed along with its comment.

**Fix:** Delete `closeBothDialogs` (lines 576-580) and its `void closeBothDialogs` expression (line 629) and update the comment block at lines 625-628 if needed.

---

### IN-02: Test suite has no render-level integration test for the deferred-picker flow (all Phase 23 tests are source-greps)

**File:** `tests/renderer/appshell-optimize-flow.spec.tsx:130-210`

**Issue:** The three render-level tests (D-01, D-02, null-guard) only exercise `OptimizeDialog` in isolation with `outDir` already set. The five "AppShell.tsx — Phase 23 source-grep gates" tests read the source file as a string and apply regex assertions — they verify the implementation was written correctly but do not exercise runtime behaviour (e.g., they cannot catch a bug where `setExportDialogState` is called with `{ plan, outDir: someOtherVar }` instead of `lastOutDir` if the variable name happens not to match the regex). Source-grep tests are fragile against refactors that preserve behaviour while renaming variables.

This is an observation about test coverage quality rather than a blocking bug. No immediate fix is required, but a future phase should add a render-level test for the full "click Optimize → dialog opens with outDir=null → click Start → picker fires" sequence using a mocked `window.api`.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
