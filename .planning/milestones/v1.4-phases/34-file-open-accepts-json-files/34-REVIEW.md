---
phase: 34-file-open-accepts-json-files
review_date: 2026-05-11
depth: standard
status: issues_found
files_reviewed: 10
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
---

# Phase 34 Code Review — File→Open accepts .json files

**Reviewed:** 2026-05-11
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Wave 1–3 introduces a clean two-IPC-step picker contract (`project:open-dialog` → dispatch by `kind` → load) with the legacy single-shot channel and method physically removed. The new `handleOpenDialog` is small, correctly returns the three-arm envelope, and the renderer dispatches exhaustively. Tests cover picker shape, registration, and the renderer dispatch matrix.

The shipped code, however, contains **one user-reachable correctness bug** that is not covered by any test in the submitted set: the unified picker normalises case for routing but the downstream load validators still do byte-for-byte case-sensitive suffix checks. A user picking `RIG.STMPROJ` or `SKEL.JSON` (reachable on macOS APFS case-insensitive volumes and via Windows file-name field paste — exactly the residual vector D-03 documents) sees the picker route correctly, then the dispatched load IPC reject with a generic `kind: 'Unknown'` envelope. There are also two smaller defects around state-machine UX and React deps.

---

## Critical Issues

### CR-01: Picker routes uppercase `.STMPROJ` / `.JSON` correctly but downstream load handlers reject them (case-sensitivity mismatch)

**Files:**
- `src/main/project-io.ts:330-337` (correct, case-insensitive)
- `src/main/project-io.ts:367` (case-sensitive, rejects `.STMPROJ`)
- `src/main/ipc.ts:425` (case-sensitive, rejects `.JSON`)

**Issue:** `handleOpenDialog` lowercases the picked path before suffix matching, and `tests/main/project-io.spec.ts:462-477` explicitly locks the contract that `RIG.STMPROJ` routes to `{ kind: 'project' }` and `SKEL.JSON` routes to `{ kind: 'skeleton' }`. The renderer then dispatches:
- `kind: 'project'` → `window.api.openProjectFromPath(result.path)` → `handleProjectOpenFromPath` validates with `!absolutePath.endsWith('.stmproj')` (case-sensitive). `RIG.STMPROJ` fails, returns `{ ok: false, error: { kind: 'Unknown', message: 'absolutePath must be a non-empty .stmproj path' } }`.
- `kind: 'skeleton'` → `window.api.loadSkeletonFromPath(result.path)` → `handleSkeletonLoad` validates with `!jsonPath.endsWith('.json')` (case-sensitive). `SKEL.JSON` fails the same way.

Vectors that reach this:
1. macOS APFS / HFS+ case-insensitive volumes preserve filename case as the user typed it. A file named `MyRig.STMPROJ` opens normally and `result.filePaths[0]` carries the uppercased suffix verbatim.
2. Windows file-name field paste — the very residual vector that D-03 cites as the rationale for the picker's "defense-in-depth" fallthrough.
3. Cross-OS file transfer where the source filesystem preserved uppercase.

The user sees a generic `kind: 'Unknown'` error rather than the project loading. The picker handler comment at `project-io.ts:334-337` claims `handleProjectOpenFromPath`'s validator "emits a typed error envelope downstream" — but `kind: 'Unknown'` is the *generic* envelope, not the typed one, and the user sees the validator's terse string `"absolutePath must be a non-empty .stmproj path"`, which is internal-API phrasing.

**Fix:** Make the load validators case-insensitive to match the picker contract.

```typescript
// src/main/ipc.ts:425
if (typeof jsonPath !== 'string' || jsonPath.length === 0 || !jsonPath.toLowerCase().endsWith('.json')) {

// src/main/project-io.ts:367
if (
  typeof absolutePath !== 'string' ||
  absolutePath.length === 0 ||
  !absolutePath.toLowerCase().endsWith('.stmproj')
) {
```

(Apply the same to `handleProjectReloadWithSkeleton` line 700/706 and `handleProjectResample` line 933 for symmetry, since `handleLocateSkeleton`'s native filter also lower-cases.) Add a test in `tests/renderer/save-load.spec.tsx` (or a new main-side spec) that drives `RIG.STMPROJ` through `handleOpenDialog` → `handleProjectOpenFromPath` and asserts `ok: true`.

---

## Warnings

### WR-01: Menu Open does not transition AppState to `loading` — no "Loading {file}…" feedback for picker-driven opens

**File:** `src/renderer/src/App.tsx:318-346`

**Issue:** The drag-drop path threads through `onLoadStart` / `onProjectDropStart` which set `state.status = 'loading'`, surfacing the existing `Loading {state.fileName}…` UI hint. The new picker path skips this entirely — after `openProjectPicker` resolves and the dirty-guard clears, the renderer awaits `openProjectFromPath` / `loadSkeletonFromPath` (which can take multi-second on sampler-bound rigs) with the AppState unchanged. The user sees no visible state transition between picker dismissal and AppShell remount.

This is a regression vs. the drop-path UX, and inconsistent with the AppState machine that explicitly carries a `loading` variant for exactly this purpose (`App.tsx:36`).

**Fix:**

```typescript
const proceed = await handleBeforeDrop(fileName, dropKind);
if (!proceed) return;

handleLoadStart(fileName); // surface "Loading fileName…"

if (result.kind === 'project') {
  const resp = await window.api.openProjectFromPath(result.path);
  handleProjectLoad(resp, fileName);
} else {
  const resp = await window.api.loadSkeletonFromPath(result.path);
  handleLoad(resp, fileName);
}
```

The same fix should be applied to `unsubOpenRecent` (line 349-354) which has the same defect.

### WR-02: `handleLoad` is referenced inside the menu-open effect but missing from the deps array

**File:** `src/renderer/src/App.tsx:345, 415`

**Issue:** The `useEffect` at line 317 uses `handleLoad` inside `unsubOpen` (line 345) but its deps array is `[handleBeforeDrop, handleProjectLoad]`. `handleLoad` is `useCallback(..., [])` and therefore stable, so the bug is dormant today, but:
- The `react-hooks/exhaustive-deps` lint rule will flag this on any future refactor.
- If anyone later changes `handleLoad` to depend on state (likely if the loading-state fix in WR-01 is added incorrectly), the menu Open would capture a stale closure and skeleton arm loads would route to a stale handler.

**Fix:** Add `handleLoad` to the deps array.

```typescript
}, [handleBeforeDrop, handleProjectLoad, handleLoad]);
```

### WR-03: `handleOpenDialog` picker missing `dontAddToRecent` property — pollutes Windows recent-docs

**File:** `src/main/project-io.ts:317-321`

**Issue:** `handlePickOutputDirectory` (`ipc.ts:497`) explicitly sets `'dontAddToRecent'` in its properties array with the rationale "Windows — don't pollute recent docs". The same Windows-specific pollution applies to every File→Open invocation: the OS-level recent-docs list (separate from the app's own `recent.json`) would gain an entry for every picker open. The legacy `handleProjectOpen` (now deleted) did not have this either, but Phase 34 is a natural opportunity to add the option to a fresh handler. Not strictly correctness, but inconsistent with the export-picker precedent in the same codebase.

**Fix:**

```typescript
const options: Electron.OpenDialogOptions = {
  title: 'Open Spine Project or Skeleton',
  properties: ['openFile', 'dontAddToRecent'],
  filters: [{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }],
};
```

### WR-04: Defense-in-depth fallthrough for unknown suffixes produces a user-hostile error envelope

**File:** `src/main/project-io.ts:334-337`

**Issue:** When the picker yields a path with neither `.stmproj` nor `.json` suffix (vector: Windows file-name field paste of an arbitrary path), the handler defaults to `{ kind: 'project', path }` and lets `handleProjectOpenFromPath` reject it. But the rejection message is the generic `"absolutePath must be a non-empty .stmproj path"` with `kind: 'Unknown'` — same generic envelope as for genuinely unknown errors. Users get no signal that their picked-file extension was the problem.

A typed `'UnsupportedFileExtension'` error kind at the picker level (or a clearer message string), surfaced to the renderer for explicit "Please pick a .stmproj or .json file" UI, would be more user-respectful than routing to a downstream validator that wasn't designed for this case. This is a deliberate D-03 decision in the plan, but worth flagging as a UX wart: the same picker-time check could produce a typed envelope with negligible cost.

**Fix:** Optional — add a fourth arm to `OpenDialogResponse`:

```typescript
export type OpenDialogResponse =
  | { kind: 'project'; path: string }
  | { kind: 'skeleton'; path: string }
  | { kind: 'cancelled' }
  | { kind: 'unsupported'; path: string };
```

Then in `handleOpenDialog`, after the `.json` check, also test for `.stmproj`; if neither matches, return `{ kind: 'unsupported', path }`. Renderer mounts a toast/banner explaining accepted formats.

---

## Info

### IN-01: `handleOpenDialog` comment misleads about defense-in-depth target

**File:** `src/main/project-io.ts:334-337`

**Issue:** Comment claims `handleProjectOpenFromPath`'s validator "emits a typed error envelope downstream". It actually emits the `kind: 'Unknown'` envelope (the generic catch-all arm). "Typed" suggests a kind-specific envelope like `ProjectFileParseError` — this is not what happens.

**Fix:** Either change the comment to "...emits an error envelope downstream" (drop "typed"), or implement the proper typed kind (WR-04).

### IN-02: Duplicate test cases for the same picker behavior

**File:** `tests/main/project-io.spec.ts:406-489` vs `tests/main/project-io.spec.ts:501-559`

**Issue:** Two `describe` blocks (`Phase 34 D-01/D-02/D-03 — handleOpenDialog (picker-only, three-arm envelope)` and `handleOpenDialog (Phase 34 D-01..D-03)`) assert near-identical contracts: cancel arm, project arm, skeleton arm, unknown-suffix arm, filter shape. The second block's comment acknowledges this is a "requirement-named gate" for traceability, but the duplication doubles maintenance cost without adding behavioral coverage. If the picker's cancel handling changes, six tests need updating instead of three.

**Fix:** Either consolidate into one describe block keyed by the OPEN-0x labels, or have the requirement-gate block import from the implementation-gate block and re-assert via `it.each`.

### IN-03: Type narrowing comment claims exhaustiveness without compile-time guarantee

**File:** `src/renderer/src/App.tsx:339-346`

**Issue:** The `if (result.kind === 'project') ... else { /* result.kind === 'skeleton' (exhaustive — only three arms exist). */ }` block relies on a comment for exhaustiveness. The `'cancelled'` arm is caught at line 325, so by line 339 `result.kind` is `'project' | 'skeleton'` — TypeScript narrows correctly. But if a future phase adds a fourth arm (e.g., the `'unsupported'` arm from WR-04), the `else` branch silently treats it as `'skeleton'` because there is no exhaustiveness check (no `never` assertion).

**Fix:**

```typescript
if (result.kind === 'project') {
  const resp = await window.api.openProjectFromPath(result.path);
  handleProjectLoad(resp, fileName);
} else if (result.kind === 'skeleton') {
  const resp = await window.api.loadSkeletonFromPath(result.path);
  handleLoad(resp, fileName);
} else {
  const _exhaustive: never = result;
  void _exhaustive;
}
```

---

**Files reviewed:**
- `src/main/ipc.ts`
- `src/main/project-io.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`
- `src/shared/types.ts`
- `tests/main/ipc.spec.ts`
- `tests/main/project-io.spec.ts`
- `tests/preload/open-project-picker.spec.ts`
- `tests/renderer/save-load.spec.tsx`
- `tests/shared/types.spec.ts`
