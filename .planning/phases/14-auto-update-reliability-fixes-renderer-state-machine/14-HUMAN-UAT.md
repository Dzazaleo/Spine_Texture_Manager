---
status: partial
phase: 14-auto-update-reliability-fixes-renderer-state-machine
source: [14-VERIFICATION.md]
started: 2026-04-29T12:11:00Z
updated: 2026-04-29T12:11:00Z
---

## Current Test

[awaiting human testing — packaged builds land in Phase 15]

## Tests

### 1. macOS cold-start auto-check (UPDFIX-03 / ROADMAP SC-3 mac branch)
expected: Within ~3-5s of `app.whenReady()` completing on a fresh dock-launch of a packaged build, DevTools console emits `[auto-update] startup-check: setTimeout fired` followed by `[auto-update] checkUpdate: trigger=startup, version=1.1.1` and `[auto-update] event: update-available, version=...` (or update-not-available). When a newer published version exists, UpdateDialog auto-mounts; when not, no dialog (silent per UPD-05).
result: [pending]

### 2. Windows cold-start auto-check (UPDFIX-03 / ROADMAP SC-3 win branch)
expected: Same as the macOS cold-start case but on a Windows host; the `[auto-update]` structured log lines appear in DevTools, and when a newer published version exists, UpdateDialog auto-mounts with `variant='windows-fallback'` (since `SPIKE_PASSED` is `false` on win32 by default) showing the 'Open Release Page' button.
result: [pending]

### 3. macOS Help → Check for Updates from idle (UPDFIX-04 / ROADMAP SC-1)
expected: Launch the packaged macOS build, do NOT load any `.json`/`.stmproj` project, click Help → Check for Updates immediately. Within ~10s, UpdateDialog mounts with one of: 'Update available' (newer version published), 'You're up to date' (no newer version), or a graceful offline error. No silent void; no waiting on a project load.
result: [pending]

### 4. Windows Help → Check for Updates from idle (UPDFIX-04 / ROADMAP SC-2)
expected: Same as the macOS Help → Check from-idle case but on a Windows host. Behavior should be identical (feedback within ~10s; no silent swallow; no project-load gate).
result: [pending]

### 5. Windows manual re-check after Later dismissal (UPDFIX-02 / ROADMAP SC-5)
expected: On a packaged Windows build with a newer version published: open UpdateDialog (cold-start auto-check or first manual check), click 'Later' (which persists `dismissedUpdateVersion` to `update-state.json`). Then click Help → Check for Updates AGAIN with the same newer version still published. UpdateDialog re-presents (D-05 asymmetric override for manual checks). Restart the app; the next cold-start auto-check should NOT re-present the same dismissed version (Phase 12 D-08 startup suppression preserved).
result: [pending]

### 6. Windows UpdateDialog Download / Open Release Page button visibility (UPDFIX-02 / ROADMAP SC-4)
expected: On a packaged Windows build with a newer version published, UpdateDialog opens deterministically with EITHER (a) a working 'Download' button when `SPIKE_PASSED=true` OR (b) an 'Open Release Page' button when `SPIKE_PASSED=false`. Clicking 'Open Release Page' opens `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` in the system browser via `shell.openExternal`.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps

### G-1 — sticky slot cleanup missing in production (WR-01 from 14-REVIEW.md)

status: failed
source: 14-REVIEW.md WR-01 + 14-VERIFICATION.md frontmatter `gaps[0]`
truth: Plan 03 frontmatter must-have #11 — "Clicking 'Later' in UpdateDialog calls `window.api.dismissUpdate(version)` AND clears the sticky slot via the new IPC (defense-in-depth)."

reason:
`clearPendingUpdateInfo` is exported at `src/main/auto-update.ts:111-115` and tested
in `tests/main/auto-update.spec.ts`, but **no production caller invokes it**. Grep
across `src/` finds zero references outside the function definition itself and the
JSDoc comment. The `update:dismiss` and `update:download` IPC handlers in
`src/main/ipc.ts:684-700` do not call it; `App.tsx`'s `onLater` and `onDownload`
handlers do not invoke any clear-slot path either.

Cold-start path is unaffected: the slot is in-memory only and rebuilt every launch
per D-Discretion-2 (no persistence). Live impact today is **bounded to dev/HMR/
React StrictMode remount paths**.

Latent risk: any future in-session remount affordance (workspace switch, deep settings
reset, multi-window) would let an already-dismissed dialog resurface immediately
because the sticky slot still holds the payload.

remediation:
~10 LoC + 1 regression test (Option A from 14-REVIEW.md WR-01):
- `src/main/ipc.ts` — call `clearPendingUpdateInfo()` at the top of the `update:dismiss`
  and `update:download` ipcMain.handle bodies before delegating to existing functions.
- `tests/main/auto-update-dismissal.spec.ts` — add a regression assertion that after
  `update:dismiss` (or `update:download`) fires, `getPendingUpdateInfo()` returns
  `null`.

decision_pending:
The user must choose between three remediation paths before Phase 15 ships v1.1.2:
1. **Open Phase 14.1 (gap-closure)** via `/gsd-plan-phase 14 --gaps` — proper GSD
   gap-closure shape, surfaces in roadmap, atomic commit on top of phase 14.
2. **Roll into Phase 15** as a prerequisite plan in the build/feed-shape phase.
3. **Accept the dev-only risk** and defer indefinitely (NOT recommended — the cost
   of fixing now is ~10 LoC and the latent footgun compounds with every session
   feature added).
