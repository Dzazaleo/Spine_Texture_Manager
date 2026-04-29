---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
reviewed: 2026-04-29T11:02:55Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/main/auto-update.ts
  - src/main/ipc.ts
  - src/preload/index.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/AppShell.tsx
  - src/shared/types.ts
  - tests/integration/auto-update-shell-allow-list.spec.ts
  - tests/main/auto-update-dismissal.spec.ts
  - tests/main/auto-update.spec.ts
  - tests/main/ipc.spec.ts
  - tests/preload/request-pending-update.spec.ts
  - tests/renderer/app-update-subscriptions.spec.tsx
  - tests/renderer/save-load.spec.tsx
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 14: Code Review Report

**Reviewed:** 2026-04-29T11:02:55Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 14 hardens the auto-update path with three concerns: a sticky `pendingUpdateInfo` slot for late-mount renderers (D-03), an asymmetric dismissal rule that lets manual checks re-present suppressed versions (D-05), and a renderer-side lift of update subscriptions from `AppShell` to `App.tsx` so they survive every `AppState` branch (Plan 03). The change is well-scoped, well-instrumented (9 structured `console.info` lines, comprehensive test coverage at all four layers), and the core IPC/preload/renderer wiring is correct.

The most consequential issue is a **dangling contract**: `clearPendingUpdateInfo` is exported, tested, and documented as "called by the renderer-side dismiss/download paths (Plan 03)" — but no caller exists in the production code. This means the sticky slot is never emptied during a session, which (combined with the unconditional `requestPendingUpdate()` invoke on `App` mount) can re-deliver an already-dismissed dialog if `App` re-mounts (HMR, React StrictMode dev cycle, or a future test/UAT path). Two smaller correctness concerns relate to `lastCheckTrigger` lifetime and `compareSemver`'s pre-release tag handling. None are critical; the v1.1.2 hotfix scope can ship as-is for the first cold-start use case the phase targets.

## Critical Issues

_(None.)_

## Warnings

### WR-01: `clearPendingUpdateInfo` is exported but never called — sticky slot is never cleared during a session

**File:** `src/main/auto-update.ts:323` (declaration), `src/main/ipc.ts:684-700` (dismiss/download handlers do not call it)
**Issue:** The module-level docblock at `src/main/auto-update.ts:111-115` states the slot is "Cleared on user dismiss/download trigger (renderer drives via the existing `update:dismiss` IPC + Phase 14 Plan 03 download-click handler that calls clearPendingUpdateInfo())". The function is also covered by tests (`tests/main/auto-update.spec.ts:400-407`, `tests/main/auto-update-dismissal.spec.ts:315-322`). However, `grep -rn "clearPendingUpdateInfo" src/` finds **only** the declaration and one comment — no caller in `ipc.ts`, `App.tsx`, or `AppShell.tsx`.

Concrete consequence: after the user clicks "Later" or "Download + Restart", `pendingUpdateInfo` retains the payload. If `App.tsx` re-mounts during the session (HMR, React StrictMode dev cycle, future UAT test path that unmounts and remounts the root), the `requestPendingUpdate()` call at `src/renderer/src/App.tsx:410-420` re-hydrates `updateState.open = true` and the dialog reappears for the version the user already dismissed. In production cold-start usage the slot is rebuilt on every launch (per "in-memory only for v1.1.2 hotfix scope" at `auto-update.ts:115`), so the user-visible regression is bounded to dev/HMR paths today — but the missing cleanup contract is a latent footgun once any in-session remount path lands (e.g. a future "Reset session" affordance).

The dismiss-version persistence at `dismissUpdate()` (line 291-300) only writes `dismissedUpdateVersion` to disk; it does NOT empty the in-memory slot. The asymmetric rule (D-05) means the slot also stays populated when a *manual* check re-presents a dismissed version — so after the user dismisses again, the slot still holds the payload.

**Fix:** Either wire the cleanup in main (preferred — keeps the renderer ignorant of main's module state), or add an IPC channel and call it from the renderer.

Option A (main-side, smallest patch):

```ts
// src/main/ipc.ts — extend the dismiss/download/quit-and-install handlers.
ipcMain.handle('update:download', async () => {
  const { downloadUpdate, clearPendingUpdateInfo } = await import('./auto-update.js');
  clearPendingUpdateInfo();
  return downloadUpdate();
});
ipcMain.on('update:dismiss', (_evt, version) => {
  if (typeof version !== 'string' || version.length === 0) return;
  void (async () => {
    const { dismissUpdate, clearPendingUpdateInfo } = await import('./auto-update.js');
    clearPendingUpdateInfo();
    await dismissUpdate(version);
  })();
});
```

Option B (rely on `dismissUpdate`/`downloadUpdate` to clear internally):

```ts
// src/main/auto-update.ts — at the top of dismissUpdate and downloadUpdate.
export async function dismissUpdate(version: string): Promise<void> {
  pendingUpdateInfo = null; // Phase 14 D-03 — clear the sticky slot on dismiss.
  // ...existing body...
}
```

After landing the fix, add a regression case to `tests/main/auto-update-dismissal.spec.ts` asserting `getPendingUpdateInfo() === null` after `dismissUpdate('1.2.3')` runs.

---

### WR-02: `lastCheckTrigger` is sticky for the rest of the process lifetime — out-of-band `update-available` events get the wrong asymmetric routing

**File:** `src/main/auto-update.ts:131`, `src/main/auto-update.ts:215-247` (checkUpdate), `src/main/auto-update.ts:445-493` (deliverUpdateAvailable)
**Issue:** `lastCheckTrigger` is set at the top of every `checkUpdate()` call (line 223) and is **never reset to null** after the call resolves. The comment at lines 218-222 acknowledges this and argues "at most one check is in flight at a time (no internal concurrency)" — but that argument only covers the single-check-in-flight invariant, not the lifetime *between* checks.

Concrete scenario (rare but reachable): the user clicks Help → Check for Updates (manual) at minute 5, `update-available` fires and is delivered, then 30 minutes pass with no manual checks. At minute 35, electron-updater's autoUpdater emits an `update-available` event for some other reason (electron-updater's internal scheduler, a network-driven retry path, the unconditional `autoUpdater.on('error')` handler triggering a re-evaluation, etc.) — `lastCheckTrigger` is still `'manual'` from minute 5. The asymmetric rule at line 453 reads it as manual and skips suppression on a version the user already dismissed. The Phase 12 D-08 contract is silently violated.

Today's electron-updater 6.8.3 does not internally schedule re-checks (we set `autoDownload=false`), so this is theoretical. But the `let`-binding's "carry-forever" semantics is fragile — a future electron-updater bump or a follow-up phase that wires a periodic re-check would silently regress D-08.

**Fix:** Reset `lastCheckTrigger` to `null` at the end of `deliverUpdateAvailable` (after the IPC fires) so any subsequent out-of-band event correctly treats itself as the "null/startup" branch (preserve suppression):

```ts
// src/main/auto-update.ts — at the end of deliverUpdateAvailable, after sendToWindow.
sendToWindow('update:available', payload);

// Phase 14 D-08 — reset the trigger snapshot AFTER consumption so a subsequent
// out-of-band autoUpdater 'update-available' event (electron-updater scheduler,
// retry path, etc.) does NOT inherit the stale 'manual' value and silently
// override the Phase 12 D-08 suppression.
lastCheckTrigger = null;
```

Alternatively, snapshot the trigger inside the `update-available` event closure via a Promise-like context handoff so the slot's lifetime is bounded to a single `checkUpdate` call. The reset-after-deliver is simpler and matches the "consume once" intent.

---

### WR-03: `App.tsx` `onLater` only persists when `state !== 'none'` — but the asymmetric rule means a Later-after-manual-re-present is the most common dismiss path, and the persisted-version check at `version.length > 0` would already filter the "no version" case

**File:** `src/renderer/src/App.tsx:546-554`
**Issue:** The `onLater` handler:

```ts
onLater={() => {
  if (updateState.state !== 'none' && updateState.version.length > 0) {
    window.api.dismissUpdate(updateState.version);
  }
  setUpdateState((prev) => ({ ...prev, open: false }));
}}
```

The comment "Only persist when there's a real version to remember" is correct, but the **belt-and-braces double-check** (`state !== 'none' AND version.length > 0`) is redundant: the only path that mounts the dialog with `state === 'none'` is the manual-check `update:none` / `update:error` handler at lines 369-398, both of which set `version: payload.currentVersion` (real version) or `version: ''` (error case). The `version.length > 0` check alone would catch the error-no-version case AND the up-to-date case (since "currentVersion" being non-empty is itself the "Don't suppress me — I'm currently running this" signal).

More substantively: the `state === 'none'` exclusion silently skips persistence even on the legitimate "user dismissed an up-to-date dialog" path — which is fine — but couples renderer state-machine internals to the persistence decision in a way that obscures intent.

This is correctness-adjacent (not a bug today; both branches converge), but if a future phase adds a new dialog state (e.g. `state: 'partial'` for an in-progress download), the `state !== 'none'` branch silently includes it without re-evaluating whether persistence is appropriate.

**Fix:** Reduce to the version check alone, which is the actual contract:

```ts
onLater={() => {
  // D-08 — persist only when we have a real version to suppress. The
  // state='none' (up-to-date / error) paths set version='' or a benign
  // currentVersion; the empty-string branch already excludes the error
  // case. The currentVersion case writes harmlessly to disk if it slips
  // through — but the version.length>0 gate plus the 'available' state
  // being the only one that emits a real upgrade target is sufficient.
  if (updateState.version.length > 0 && updateState.state !== 'none') {
    window.api.dismissUpdate(updateState.version);
  }
  setUpdateState((prev) => ({ ...prev, open: false }));
}}
```

Or — if `state==='none'` is structurally impossible to coexist with a real `version`, keep one of the two checks and document why. The dual-gate pattern is a code-smell here; a single normalized gate is clearer.

## Info

### IN-01: `compareSemver` re-fires on a same-numeric-tuple downgrade (e.g. dismissed=`1.1.0`, available=`1.1.0-rc1`)

**File:** `src/main/auto-update.ts:349-373`
**Issue:** When numeric tuples are equal but strings differ, the function returns -1 ("available is newer"). The conservative bias is documented and intentional ("False positives here are acceptable (extra prompt) compared to false negatives"). However: if `dismissedUpdateVersion='1.1.0'` (final) and `info.version='1.1.0-rc1'` (older pre-release), the comparison is currently:
- numericA `[1,1,0]` === numericB `[1,1,0]` → tuples equal
- `a !== b` → return -1 (available newer)
- → suppression is NOT applied, `update:available` fires for a release the user has already installed/dismissed in its final form.

In practice GitHub Release feeds only stream forward (newer rc / final), so this is unreachable on the production update channel. It is detectable in tests / dev via a manual feed swap. The docblock acknowledges "if a more rigorous semver compare is needed later, swap to the `semver` npm package".

**Fix:** Optional — for v1.1.2 hotfix scope, leave as-is and revisit when prerelease handling becomes load-bearing. If swapping to the `semver` npm package (already a transitive dep), the comparison shrinks to `semver.gt(info.version, state.dismissedUpdateVersion)`.

### IN-02: 9 structured `console.info` lines fire unconditionally in production builds (no `app.isPackaged` guard)

**File:** `src/main/auto-update.ts:147, 162-164, 168-171, 175-178, 200, 224-226, 234-237, 459-463, 487-490`
**Issue:** The Phase 14 D-10 structured-log contract emits `console.info('[auto-update] ...')` at boot, startup-check fire, race resolve, the 3 event handlers, and the SUPPRESSED/DELIVERED branches. This is intentional per the plan, but the file's own header docblock (lines 18-19) flags "In production builds (`app.isPackaged`), consider reducing console verbosity — Phase 9 concern per RESEARCH Security Domain line 1065." The same precedent applies here: 9 lines per cold start + N lines per check is verbose for a packaged build, and the [auto-update] prefix is recognizable enough that the path is observable to anyone running the app from a terminal.

Not a security issue (no PII, no token leakage; only version strings + trigger context), and the lines are valuable for UAT. Worth flagging for the v1.2 polish pass.

**Fix:** Wrap each line in a `if (!app.isPackaged) { ... }` guard, OR introduce a single module-level `LOG_AUTO_UPDATE` boolean tied to a process-env flag. Defer to a follow-up phase.

### IN-03: `App.tsx` update-effect uses an empty dep array but reads `manualCheckPendingRef.current` inside callbacks — relies on the ref being stable across re-renders (it is, by useRef contract)

**File:** `src/renderer/src/App.tsx:356-429`
**Issue:** The lifted `useEffect` registers 5 subscribers and the `requestPendingUpdate()` invoke under `[]` deps. The 4 callbacks at lines 369-398 read `manualCheckPendingRef.current` — `useRef` guarantees the ref object identity is stable across re-renders, so this is correct. However, the `useEffect` body also references `setUpdateState` (4 occurrences) — React's `setState` setter is stable per the same hooks contract, so this is also correct. ESLint's `react-hooks/exhaustive-deps` rule will not flag either ref or setState, so the empty deps array is intentional and safe. No fix needed; flagging for reviewer clarity.

### IN-04: `ipc.ts` `update:request-pending` handler does a dynamic import on every invoke (one extra microtask per request) — cheap but not zero-cost, and the contract says "called ONCE on mount"

**File:** `src/main/ipc.ts:722-725`
**Issue:** The handler dynamic-imports `auto-update.js` per call (consistent with the surrounding `update:check-now` / `update:download` / `update:dismiss` / `update:quit-and-install` handlers, all of which use the same idiom for the load-time-cycle reason documented at lines 58-89). Once renderer-side `requestPendingUpdate()` is called more than once (e.g. a future UAT path that pulls the slot inside a manual check, or a renderer dev tool), each invoke pays an O(1) module-cache lookup. Negligible perf impact; flagging only because the comment at lines 717-721 emphasizes "Renderer App.tsx invokes ONCE on mount" — which is true today but a foot-gun if a future caller assumes `requestPendingUpdate()` is free.

**Fix:** Optional — hoist the dynamic import to `registerIpcHandlers` and capture the module in a local binding. Trade-off: re-introduces the load-time-cycle issue documented at lines 58-89, so leave as-is for now.

### IN-05: Test mock surface in `auto-update.spec.ts` and `auto-update-dismissal.spec.ts` does not validate that `process.platform` is `'darwin'`/`'linux'` for default cases — D-04 variant routing depends on `SPIKE_PASSED = process.platform !== 'win32'`

**File:** `tests/main/auto-update.spec.ts:1-358`, `tests/main/auto-update-dismissal.spec.ts:1-359`
**Issue:** The variant-routing assertions at line 169-173 (Phase 12) and 14-e (Phase 14) implicitly depend on the test runner's `process.platform` being `'darwin'` or `'linux'` (so `SPIKE_PASSED` is true). On a Windows CI runner — currently absent but planned for v1.2 — every `update:available` payload would have `variant: 'windows-fallback'` rather than `'auto-update'`, and the existing assertions on the un-variant'd `expect.objectContaining({ version: '1.2.3' })` would silently pass while the un-asserted variant field changed. The Phase 14-e test correctly mocks `process.platform === 'win32'` for the explicit windows-fallback case, but the default-case assertions don't fence the inverse.

**Fix:** Add a `it.skipIf(process.platform === 'win32')(...)` guard or explicit `process.platform` assertion on the default-platform tests, matching the precedent at `tests/main/ipc.spec.ts:302` for the POSIX-path test. Defer to v1.2 cross-platform CI work.

---

_Reviewed: 2026-04-29T11:02:55Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
