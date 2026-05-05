---
gsd_debug_version: 1.0
slug: export-fails-new-folder
status: resolved
trigger: "when user is prompted to chose the export location, IF he has to create a new folder first, then select it, the Export always fails. Only after clicking Start (again) and the folder is now pre-selected, the export succeeds"
created: 2026-05-05
updated: 2026-05-05
---

# Debug session: export-fails-new-folder

## Trigger (verbatim)

> when user is prompted to chose the export location, IF he has to create a new folder first, then select it, the Export always fails. Only after clicking Start (again) and the folder is now pre-selected, the export succeeds

## Symptoms

- **Expected:** Export to a freshly-created folder should succeed on the first Start click.
- **Actual:** Export fails on the first attempt with "0 succeeded, 77 failed in 0.0s" when the user creates a new folder inside the picker and then selects it. Clicking Start a second time (folder is now pre-selected) succeeds.
- **Error mode:** "0 succeeded, N failed in 0.0s" — the **0.0s** total elapsed indicates the failure is happening before any actual IO can run; failure is structural, not per-file.
- **Timeline:** Always. Pre-existing — never worked with the new-folder-then-select flow. Introduced by Phase 23 (`feat(23-01): implement deferred-picker optimize flow`, commit `c389020`).
- **Repro:**
  1. Load a project, open Optimize Assets dialog.
  2. Click Start.
  3. In the macOS folder picker, click "New Folder", name it, hit Create.
  4. Select the newly-created folder, click "Open"/"Choose".
  5. → Export fails: "0 succeeded, N failed in 0.0s".
  6. Click Start again. Folder is now pre-selected in the picker.
  7. Click Open/Choose. → Export succeeds.
- **Flow affected:** Optimize Assets dialog (PNG export). Same regression also affects the dialog when invoked from a fresh session where `lastOutDir = null`, regardless of new-folder vs existing-folder pick — the picked path simply does not survive to `startExport` on the first click.

## Current Focus

- hypothesis: **CONFIRMED — Stale-closure on `props.outDir` in `OptimizeDialog.onStart`**. After Phase 23 deferred the OS folder picker from toolbar-click into the Start button (inside `onConfirmStart`), the `onStart` callback at `src/renderer/src/modals/OptimizeDialog.tsx:172-232` reads `props.outDir` AFTER awaiting `props.onConfirmStart()`. The await yields long enough for the parent (AppShell) to commit a `setExportDialogState({ ...prev, outDir: pickedDir })` state update — but the running `onStart` invocation is closed over its render-N `props` reference (per `useCallback(..., [props])` semantics), so the post-await read at line 204 returns the **render-N value**, not the post-pick value. On the first click, render-N's `outDir` is whatever was passed at dialog mount (`lastOutDir`, which is `null` on a fresh session), so `window.api.startExport(plan, null, overwrite)` is invoked. On the second click, the dialog has already re-rendered with `outDir = pickedDir`, so render-N+1's closure reads the correct path and the export succeeds.
- next_action: ROOT CAUSE FOUND — fix is to thread the freshly-picked path through `onConfirmStart`'s return value (or stash it in a ref) so `onStart` does not need to re-read `props.outDir` after the await.

## Evidence

- timestamp: 2026-05-05T00:00:00Z
  source: src/renderer/src/modals/OptimizeDialog.tsx:172-232
  finding: |
    `onStart` is `useCallback(async () => { ... await props.onConfirmStart(); ... await window.api.startExport(props.plan, props.outDir, overwrite); ... }, [props])`. The `props.outDir` read at line 204 happens AFTER an `await` that gives the parent time to call `setExportDialogState(...)`. The closure captured by useCallback is bound to render-N's `props` parameter; the post-await read therefore sees render-N's `outDir`, not the latest committed state.

- timestamp: 2026-05-05T00:00:00Z
  source: src/renderer/src/components/AppShell.tsx:513-516, 538-577
  finding: |
    `onClickOptimize` mounts the dialog with `outDir: lastOutDir` (line 515). On a fresh session `lastOutDir = null` (seeded from `initialProject?.lastOutDir ?? null` at line 283-284). `onConfirmStart` runs the picker AT START TIME, then writes the picked path into both `setExportDialogState((prev) => ({ ...prev, outDir: pickedDir }))` (line 557) and `setLastOutDir(pickedDir)` (line 558). The picker's chosen path lives in the parent's local `pickedDir` variable — but that value is NOT returned to the dialog. The dialog re-reads `props.outDir`, hitting the stale closure.

- timestamp: 2026-05-05T00:00:00Z
  source: src/main/ipc.ts:545-547
  finding: |
    Main-side validation: `if (typeof outDir !== 'string' || outDir.length === 0) return { ok: false, error: { kind: 'Unknown', message: 'outDir must be a non-empty string' } }`. A `null` outDir from the renderer is rejected with a single Unknown envelope BEFORE `runExport` is invoked. This explains the 0.0s elapsed and the row icons remaining ○ idle (no `export:progress` events fire because runExport never runs).

- timestamp: 2026-05-05T00:00:00Z
  source: src/renderer/src/modals/OptimizeDialog.tsx:207-228
  finding: |
    Failure-envelope handling: when `response.ok === false`, the dialog wraps the IPC error in a synthetic `setSummary({ successes: 0, errors: [{ kind: 'write-error', path: props.outDir, message: response.error.message }], outputDir: props.outDir, durationMs: 0, cancelled: false })`. So strictly speaking the caption renders `"0 succeeded, 1 failed in 0.0s"` — the user-reported "77 failed" is an over-count likely sourced from the row table (which shows N idle rows beneath the caption). The structural bug is the same regardless of whether the count reads as 1 or N.

- timestamp: 2026-05-05T00:00:00Z
  source: closure-semantics sanity check
  finding: |
    Verified the React stale-closure behaviour in a node sandbox: a callback created in render N that awaits between two reads of `props.someField` reads the render-N value on BOTH reads, even after a render N+1 has committed with a new `props.someField` value. This confirms the diagnosis.

- timestamp: 2026-05-05T00:00:00Z
  source: .planning/phases/23-optimize-flow-defer-folder-picker/23-REVIEW.md (IN-02)
  finding: |
    Phase 23 review explicitly acknowledged: "All Phase 23 AppShell tests are source-grep assertions — no runtime coverage of the deferred-picker flow." Human UAT was deferred per `human_needed` status in 23-VERIFICATION.md. The stale-closure regression is exactly the class of bug those missing render-level integration tests would have caught.

## Eliminated

- **H1 (path not yet flushed to FS):** ruled out — `dialog.showOpenDialog` returns AFTER the OS has created the folder. Even if the folder were absent, `mkdir(parent, { recursive: true })` in `image-worker.ts:409` would create it on demand. The 0.0s elapsed proves runExport never ran, so FS visibility is moot.
- **H3 (per-row pre-flight assertion):** ruled out — runExport's per-row pre-flight (`access(F_OK)` for overwrite check, `access(R_OK)` for source) would not fail on a fresh empty folder, and the overall path is only entered when outDir is a valid string. The IPC envelope rejects `null` upstream of runExport.
- **H4 (sandbox / permission):** ruled out — Electron's macOS dev build does not sandbox-restrict the user's home dir; the second click succeeds with the SAME folder, proving permissions are fine.

## Resolution

### Root cause

`OptimizeDialog.onStart` (`src/renderer/src/modals/OptimizeDialog.tsx:172-232`) reads `props.outDir` AFTER awaiting `props.onConfirmStart()`. The Phase 23 deferred-picker design picks the folder INSIDE `onConfirmStart` and pushes the result into AppShell state, but `onStart`'s `useCallback(..., [props])` closure was created with the render-N `props` reference; React closures do not refresh across an `await` boundary, so the post-await read of `props.outDir` returns the **dialog-mount-time value** (`null` on a fresh session, or the previous-session `lastOutDir`). The result is that `window.api.startExport(plan, null, overwrite)` runs on the first click, the IPC layer rejects with `kind: 'Unknown'`, and the dialog flips to a synthetic-error complete state in 0.0s. On the second click, the dialog has already re-rendered with the freshly-picked path, so the closure is no longer stale and the export succeeds.

The picker-side `pickedDir` IS correct — it just never reaches `startExport` on the first attempt because the dialog has no way to receive it back from the parent.

### Fix (recommended)

Thread the picked path back to `OptimizeDialog` through the `onConfirmStart` return value so `onStart` no longer depends on `props.outDir` after the await.

**Edit 1** — widen `OptimizeDialog`'s confirm-start contract:

```ts
// src/renderer/src/modals/OptimizeDialog.tsx (around line 79)
onConfirmStart?: () => Promise<{
  proceed: boolean;
  overwrite?: boolean;
  outDir?: string;  // NEW — the path chosen by the picker; supplied when proceed === true
}>;
```

**Edit 2** — read the chosen path from the decision in `onStart`:

```ts
// src/renderer/src/modals/OptimizeDialog.tsx onStart, around line 187-205
let overwrite = false;
let confirmedOutDir = props.outDir;  // fallback for legacy callers without onConfirmStart
if (props.onConfirmStart) {
  const decision = await props.onConfirmStart();
  if (!decision.proceed) return;
  overwrite = decision.overwrite === true;
  if (typeof decision.outDir === 'string') confirmedOutDir = decision.outDir;
}
if (confirmedOutDir === null) {
  // Defensive — should never occur if onConfirmStart returned proceed:true
  // for a non-skipped pick. Fall through to setSummary synthetic error.
}
setState('in-progress');
props.onRunStart?.();
const response = await window.api.startExport(
  props.plan,
  confirmedOutDir,        // ← was props.outDir
  overwrite,
);
// Synthetic error envelope (response.ok === false branch) should also use
// confirmedOutDir for `path` and `outputDir` instead of props.outDir.
```

**Edit 3** — return the picked path from AppShell's `onConfirmStart`:

```ts
// src/renderer/src/components/AppShell.tsx onConfirmStart, around line 549-576
const pickedDir = await pickOutputDir(startPath);
if (pickedDir === null) return { proceed: false };
setExportDialogState((prev) => (prev ? { ...prev, outDir: pickedDir } : null));
setLastOutDir(pickedDir);
const probeResult = await window.api.probeExportConflicts(plan, pickedDir);
if (!probeResult.ok) return { proceed: true, overwrite: false, outDir: pickedDir };
if (probeResult.conflicts.length === 0) return { proceed: true, overwrite: false, outDir: pickedDir };
return new Promise((resolve) => {
  pendingConfirmResolve.current = resolve;
  setConflictState({ conflicts: probeResult.conflicts });
});
// pendingConfirmResolve resolutions in onConflictOverwrite / onConflictCancel /
// onConflictPickDifferent must also include `outDir: pickedDir` (or omit when
// proceed:false). Use a ref or closure variable to thread pickedDir through.
```

The pendingConfirmResolve flow needs `pickedDir` available when ConflictDialog buttons resolve — easiest approach is to capture `pickedDir` in the closure of the `new Promise` and have the conflict-button handlers pull it from a ref or close over it:

```ts
return new Promise<{ proceed: boolean; overwrite?: boolean; outDir?: string }>((resolve) => {
  pendingConfirmResolve.current = (decision) =>
    resolve({ ...decision, outDir: decision.proceed ? pickedDir : undefined });
  setConflictState({ conflicts: probeResult.conflicts });
});
```

Adjust the `pendingConfirmResolve.current` ref type accordingly.

### Verification plan

1. Add a render-level integration test for the deferred-picker flow (closes Phase 23 IN-02 gap):
   - Mount AppShell with `lastOutDir = null`.
   - Mock `window.api.pickOutputDirectory` to return `/tmp/freshly-picked` (synchronously resolved Promise).
   - Mock `window.api.probeExportConflicts` to return `{ ok: true, conflicts: [] }`.
   - Spy on `window.api.startExport`.
   - Click Optimize → click Start.
   - Assert: `window.api.startExport` was called with `('/tmp/freshly-picked', overwrite=false)` — NOT `(null, ...)`.
2. Manual UAT (mirrors the original repro):
   - Fresh session (no .stmproj loaded; lastOutDir = null).
   - Optimize Assets → Start → New Folder → Create → Open.
   - Confirm export succeeds on the FIRST click, not the second.
3. Regression sweep:
   - Repeat with a saved .stmproj that has lastOutDir set (existing successful path) — confirm still works.
   - Cancel picker mid-flow — confirm dialog stays in pre-flight (D-05 unchanged).
   - Conflict-dialog "Overwrite all" path — confirm overwrite=true reaches startExport with the freshly-picked path.
   - Conflict-dialog "Pick different folder" — confirm the new path is used (currently relies on `setExportDialogState` re-render at line 626, which is structurally vulnerable to the same closure bug; fix should make this path also explicit).

### Specialist hint

react — TypeScript + React closure semantics review recommended. The fix touches `useCallback` dep arrays and async/await ordering across React state updates; an idiomatic React reviewer should sanity-check the proposed thread-through-return-value pattern vs. alternatives (a ref-based sentinel, or replacing the entire `onConfirmStart` contract with a parent-driven `startExport` call).
