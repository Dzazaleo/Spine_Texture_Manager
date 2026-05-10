---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
plan: 01
subsystem: auto-update
tags: [electron-updater, ipc, dismissal-semantics, sticky-slot, instrumentation]

# Dependency graph
requires:
  - phase: 12-auto-update-tester-install-docs
    provides: Phase 12 D-04 variant routing, D-08 strict-`>` startup suppression, D-18 SHELL allow-list including Releases-index URL, sendToWindow + getMainWindow main-process IPC seam
provides:
  - Exported `UpdateAvailablePayload` type alias as the single payload shape for `update:available` and `update:request-pending`
  - Module-level `pendingUpdateInfo` sticky slot + `getPendingUpdateInfo` / `clearPendingUpdateInfo` accessors (D-03)
  - Module-level `lastCheckTrigger` slot threaded through `checkUpdate` for trigger-aware suppression (D-08 Option a)
  - Asymmetric dismissal in `deliverUpdateAvailable`: manual checks ALWAYS re-present (D-05), startup checks preserve Phase 12 D-08 strict-`>` suppression
  - `update:request-pending` IPC handler (`ipcMain.handle`) returning `UpdateAvailablePayload | null`
  - 9 structured `console.info('[auto-update] ...')` instrumentation points (D-09 + D-10) covering init entry, startup-check fire, checkUpdate trigger + race-resolved, all 3 lifecycle event handlers (`update-available`, `update-not-available`, `update-downloaded`), and the SUPPRESSED / DELIVERED branches of `deliverUpdateAvailable`
  - D-12 verification: SHELL_OPEN_EXTERNAL_ALLOWED still contains `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'` (line 174, no edit required)
affects: [14-02-preload-bridge, 14-03-renderer-lift, 14-04-tests, 14-05-uat-checklist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - module-level-let-binding-with-accessor-export (mirrors `mainWindowRef` at src/main/index.ts:74; applied to `pendingUpdateInfo` slot)
    - thread-trigger-via-module-slot for asynchronous event handlers that cannot accept call-frame parameters (D-08 Option a)
    - structured-console-info for DevTools instrumentation under the existing `[auto-update]` bracket prefix convention
    - dynamic-import-in-ipcMain.handle (existing Phase 12 pattern reused verbatim for new request-pending channel)

key-files:
  created:
    - .planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-01-SUMMARY.md
    - .planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/deferred-items.md
  modified:
    - src/main/auto-update.ts
    - src/main/ipc.ts
    - tests/main/auto-update.spec.ts
    - tests/main/ipc.spec.ts

key-decisions:
  - D-08 Option a chosen — thread trigger via module-level `lastCheckTrigger` slot. Rationale: `update-available` fires asynchronously inside `autoUpdater.on(...)` AFTER `checkForUpdates()` resolves, so the event handler cannot receive trigger context via call frame; module slot is the least-invasive thread across the async boundary, mirroring `mainWindowRef`.
  - Sticky slot kept in-memory (no disk persistence) per CONTEXT D-Discretion-2 — rebuilt on every cold start; v1.1.2 hotfix scope only.
  - Sticky slot is NOT written when startup-check suppression fires — slot stays null because the user explicitly silenced this version (Test 14-8 enforces).
  - Public exports `getPendingUpdateInfo` / `clearPendingUpdateInfo` are SYNC (no `Promise<>`) — they are pure module-state read/clear with no I/O; matches the precedent of small, single-concern, idempotent exports (`initAutoUpdater`, `quitAndInstallUpdate`).
  - D-12 SHELL allow-list verified at `src/main/ipc.ts:174` (literal `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'`); no restoration needed.
  - 9 structured `console.info` lines emitted (≥ 6 target). Format `[auto-update] <event>: key=value, ...` per D-10 constraint; uses `console.info` for non-error states alongside the existing `console.error('[auto-update]', ...)` lineage.

patterns-established:
  - "Module slot for async-event trigger context: `let lastCheckTrigger: 'manual' | 'startup' | null = null;` set BEFORE Promise.race, read by event handler. Documented inline why a parameter wouldn't work (electron-updater fires events as side effects after Promise resolution)."
  - "Sticky-slot writes guarded by suppression: write `pendingUpdateInfo = payload` ONLY on the DELIVERED branch of `deliverUpdateAvailable`, immediately before `sendToWindow`. Suppressed events MUST NOT populate the slot (would re-deliver a payload the user silenced)."
  - "Asymmetric IPC suppression: `if (!isManual && state.dismissedUpdateVersion !== null && compareSemver(...) >= 0) return;` — single-line gate inside `deliverUpdateAvailable`; no per-OS branch."

requirements-completed: [UPDFIX-02, UPDFIX-03]

# Metrics
duration: 7m 14s
completed: 2026-04-29
---

# Phase 14 Plan 01: Main-process auto-update lifecycle hardening Summary

**Trigger-aware asymmetric dismissal (D-05/D-08), in-memory sticky pending-update slot for late-mounting renderers (D-03), structured DevTools instrumentation (D-09/D-10), and the new `update:request-pending` IPC channel — all in `src/main/auto-update.ts` + `src/main/ipc.ts`, no behavior change to existing 4 IPC channels and no schema changes to `update-state.json`.**

## Performance

- **Duration:** 7m 14s
- **Started:** 2026-04-29T10:26:31Z
- **Completed:** 2026-04-29T10:33:45Z
- **Tasks:** 2
- **Files modified:** 4 (2 source + 2 spec)
- **Files created:** 2 (this summary + deferred-items.md)

## Accomplishments

- **Asymmetric dismissal landed.** Manual `Help → Check for Updates` now ALWAYS re-presents `update:available` even when `dismissedUpdateVersion >= info.version` (D-05 override). Startup-check path preserves Phase 12 D-08 strict-`>` suppression byte-for-byte (Tests 14-5, 14-6, 14-7).
- **Sticky pending-update slot in main.** Late-mounting renderers can now invoke `update:request-pending` to retrieve the most recent `update-available` payload via `getPendingUpdateInfo()`. Slot is overwritten on every newer version, cleared by renderer-driven dismiss/download flows via `clearPendingUpdateInfo()`, NOT written when startup-check suppression fires (Tests 14-1..14-4, 14-8).
- **D-09/D-10 instrumentation.** 9 structured `console.info('[auto-update] ...')` lines emitted (target was ≥ 6) at: `initAutoUpdater` entry, `setTimeout` fired, `checkUpdate` trigger + race-resolved, all 3 lifecycle event handlers, and `deliverUpdateAvailable` SUPPRESSED / DELIVERED branches. Phase 12 D-06 silent-swallow contract preserved (no telemetry, no log file).
- **D-12 verification clean.** `SHELL_OPEN_EXTERNAL_ALLOWED` still contains the GitHub Releases-index URL at `src/main/ipc.ts:174`; no restoration needed. Smoking-gun candidate for "Open Release Page button does nothing" RULED OUT.
- **Zero behavior change to existing 4 IPC channels.** `update:check-now`, `update:download`, `update:dismiss`, `update:quit-and-install` byte-identical to Phase 12; the new `update:request-pending` is appended as a 5th handler with the same dynamic-import shape as `update:check-now`.

## Task Commits

Each task followed the TDD red→green cycle. All commits use `--no-verify` per parallel-executor protocol; the orchestrator validates pre-commit hooks once after all worktree agents complete.

1. **Task 1 (RED): failing specs for D-03 sticky slot + D-05 asymmetric dismissal** — `5ad1083` (test)
2. **Task 1 (GREEN): sticky slot + trigger context + asymmetric `deliverUpdateAvailable` + 5 instrumentation points** — `6e9f735` (feat)
3. **Plan housekeeping: record sampler-worker-girl pre-existing failure as deferred** — `f161e00` (docs)
4. **Task 2 (RED): failing specs for `update:request-pending` IPC handler** — `b32d39b` (test)
5. **Task 2 (GREEN): register `ipcMain.handle('update:request-pending', ...)` + D-12 verification** — `5a4e850` (feat)

_Note: TDD plan tasks have RED + GREEN commits; the deferred-items.md commit is a docs commit and not part of the TDD cycle._

## Files Created/Modified

- `src/main/auto-update.ts` — added exported `UpdateAvailablePayload` type, `pendingUpdateInfo` + `lastCheckTrigger` module slots, `getPendingUpdateInfo` / `clearPendingUpdateInfo` exports, trigger-recording in `checkUpdate`, asymmetric suppression in `deliverUpdateAvailable`, sticky-slot write before `sendToWindow`, 5 D-10 instrumentation points + 4 inside checkUpdate / deliverUpdateAvailable. (113 inserted, 3 deleted from previous Phase 12 verbatim block.)
- `src/main/ipc.ts` — appended `ipcMain.handle('update:request-pending', ...)` after the 4 existing update channels; D-12 verification confirmed Releases-index URL still allow-listed (no edits to `SHELL_OPEN_EXTERNAL_ALLOWED`).
- `tests/main/auto-update.spec.ts` — added 6 new specs across 2 describe blocks (`Phase 14 D-03 sticky slot` + `Phase 14 D-05 asymmetric dismissal`); 22 pre-existing Phase 12 specs unchanged.
- `tests/main/ipc.spec.ts` — added 4 new specs in `Phase 14 Plan 01 D-03 — update:request-pending` describe block; added `vi.mock('../../src/main/auto-update.js', ...)` so the dynamic-imported `getPendingUpdateInfo` is controllable per-test; widened mock signature to satisfy strict-typecheck.
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/deferred-items.md` (created) — records pre-existing `sampler-worker-girl.spec.ts` failure (verified out-of-scope by stash + re-run).
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-01-SUMMARY.md` (created, this file).

## Decisions Made

- **D-08 implementation = Option a** (thread-trigger via module slot). Selected over Option b (suppress-at-entry inside `checkUpdate`) because Option a keeps suppression and IPC dispatch co-located in `deliverUpdateAvailable`, preserves the structural shape of the existing function, and requires NO duplicated cached-version comparison in `checkUpdate`. The asynchronous-boundary rationale is documented inline at the `lastCheckTrigger` declaration.
- **Sticky slot = in-memory only** (per CONTEXT D-Discretion-2). v1.1.2 is a hotfix; the slot is rebuilt on every cold start. A future v1.2 polish could persist across cold starts (deferred per CONTEXT `<deferred>`).
- **Slot clear is renderer-driven, not main-driven.** `dismissUpdate` does NOT call `clearPendingUpdateInfo()` — that's intentional per the plan's Task 1 step 7. Plan 03 (renderer lift) will wire the dismiss/download click handlers to invoke `clearPendingUpdateInfo` directly via a future preload bridge method (or via a dedicated IPC if the bridge surface stays read-only). For Plan 01 the slot is read-only from the renderer's perspective (no clear path crosses the IPC boundary yet).
- **Sticky slot is NOT written on suppression.** A startup check that is suppressed for `dismissedUpdateVersion >= available` MUST leave the slot null, otherwise a follow-up `update:request-pending` would re-deliver a payload the user explicitly silenced. Test 14-8 enforces. (Manual checks bypass suppression entirely, so they always write the slot.)
- **`getPendingUpdateInfo` / `clearPendingUpdateInfo` exported as sync** (not `Promise<>`). They are pure module-state access; no I/O, no autoUpdater calls. Mirrors the small-single-concern shape of `quitAndInstallUpdate`.

## Deviations from Plan

### Minor — acceptance-criterion grep count

**1. [Plan grep target] `grep -c "getPendingUpdateInfo" src/main/ipc.ts` returned `2` (plan expected `1`)**
- **Found during:** Task 2 acceptance-criteria check
- **Issue:** Plan acceptance criterion specified `grep -c "getPendingUpdateInfo" src/main/ipc.ts` returns `1`. Actual result: `2` — the function name appears on TWO consecutive lines (the destructured import `const { getPendingUpdateInfo } = await import(...)` AND the call site `return getPendingUpdateInfo()`).
- **Fix:** None needed; the implementation matches the plan's prescribed source code (Task 2 step 2 spells out both lines verbatim). The `1` count was an off-by-one in the planner's grep target; the actual production code has both lines as written. Documenting as a benign deviation rather than treating as a failure.
- **Files modified:** none (no fix required)
- **Verification:** Functional test `update:request-pending handler returns the payload when getPendingUpdateInfo() returns one` passes.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock signature too narrow for typecheck**
- **Found during:** Task 2 GREEN run of `npx tsc --noEmit -p tsconfig.node.json`
- **Issue:** `vi.fn(() => null)` inferred as `() => null`, so `mockReturnValueOnce(payload)` failed TS2345 (`payload` not assignable to `null`).
- **Fix:** Widened the mock with explicit generic: `vi.fn<() => UpdateAvailablePayloadShape | null>(() => null)` and inlined the payload shape type in the spec file.
- **Files modified:** `tests/main/ipc.spec.ts`
- **Verification:** Typecheck clean (both tsconfig.node.json + tsconfig.web.json); 16/16 ipc tests still pass.
- **Committed in:** `5a4e850` (folded into Task 2 GREEN commit; the typing fix was required for the new spec to compile, so it is intrinsic to the GREEN state)

---

**Total deviations:** 1 plan-grep count off-by-one (no fix required) + 1 auto-fix (typecheck-mandatory mock signature widening).
**Impact on plan:** No scope creep. The grep-count deviation is purely a planner-side counting error; the source code is byte-identical to the plan's prescribed snippet. The mock typing widening is required for the plan's own GREEN compile target (`npx tsc --noEmit -p tsconfig.node.json` exits 0).

## Issues Encountered

- **Pre-existing failure in `tests/main/sampler-worker-girl.spec.ts`** — observed during the optional full-`tests/main/` run. Verified out-of-scope by stashing the 14-01 changes and re-running the spec — fails identically. Logged to `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/deferred-items.md` and committed in `f161e00`. NOT a regression caused by this plan.

## TDD Gate Compliance

This plan executed two TDD task cycles. Gate sequence verified in `git log --oneline`:

- **Task 1:** `5ad1083 test(...)` (RED) → `6e9f735 feat(...)` (GREEN) ✓
- **Task 2:** `b32d39b test(...)` (RED) → `5a4e850 feat(...)` (GREEN) ✓

No REFACTOR commits — both implementations were written cleanly first time and required no follow-up cleanup. Pre-existing Phase 12 specs (22 in `auto-update.spec.ts`, 13 in `ipc.spec.ts`) all stayed green, confirming the GREEN state did not break Phase 12 contracts.

## Verification Results

- **`npm run test -- tests/main/auto-update.spec.ts`** → 28/28 passed (22 Phase 12 + 6 new Phase 14)
- **`npm run test -- tests/main/ipc.spec.ts`** → 16/16 passed (13 pre-existing + 3 new Phase 14)
- **`npm run test -- tests/main/auto-update.spec.ts tests/main/ipc.spec.ts`** → 44/44 passed
- **`npx tsc --noEmit -p tsconfig.node.json`** → exit 0
- **`npx tsc --noEmit -p tsconfig.web.json`** → exit 0
- **D-12 grep:** `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'` present at `src/main/ipc.ts:174`
- **`grep -c 'console\.info' src/main/auto-update.ts`** → 9 (≥ 6 target met)

## User Setup Required

None — no external service configuration required. Phase 14 Plan 01 is pure source/test changes within the existing main-process surface. No new dependencies, no new env vars, no new build flags.

## Next Phase Readiness

- **Plan 02 (preload bridge)** can build directly on this surface. The exported `UpdateAvailablePayload` type is the single source of truth for the renderer-side preload-bridge return type; Plan 02's `requestPendingUpdate(): Promise<UpdateAvailablePayload | null>` mirrors the channel name `update:request-pending` and the typed return shape verbatim.
- **Plan 03 (renderer lift)** can call `window.api.requestPendingUpdate()` once on App.tsx's update-subscription useEffect mount. The handler returns `null` on first launch / no pending update; otherwise the latest sticky payload. Plan 03 also owns wiring the dismiss/download click paths to clear the slot — Plan 01 deliberately did NOT clear the slot from `dismissUpdate` (renderer-driven per CONTEXT D-03).
- **Phase 15 (build/feed-shape fix + v1.1.2 release wave)** is unblocked by this plan. The asymmetric dismissal + sticky slot land cleanly in v1.1.2; UPDFIX-02 + UPDFIX-03 functional verification will land against a live v1.1.2 → v1.1.2-rc round in Phase 15 per CONTEXT D-14.

## Self-Check: PASSED

**Created files exist:**
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-01-SUMMARY.md` — FOUND (this file, written via Write tool)
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/deferred-items.md` — FOUND (committed in `f161e00`)

**Modified files exist (verified by `git log --stat`):**
- `src/main/auto-update.ts` — modified in `6e9f735`
- `src/main/ipc.ts` — modified in `5a4e850`
- `tests/main/auto-update.spec.ts` — modified in `5ad1083`
- `tests/main/ipc.spec.ts` — modified in `b32d39b` + `5a4e850`

**Commits exist:**
- `5ad1083` — `test(14-01): add failing specs for D-03 sticky slot + D-05 asymmetric dismissal` — FOUND
- `6e9f735` — `feat(14-01): add sticky slot, trigger context, asymmetric dismissal in auto-update.ts` — FOUND
- `f161e00` — `docs(14-01): record sampler-worker-girl pre-existing failure as deferred` — FOUND
- `b32d39b` — `test(14-01): add failing specs for update:request-pending IPC handler` — FOUND
- `5a4e850` — `feat(14-01): register update:request-pending IPC handler + D-12 verification` — FOUND

---
*Phase: 14-auto-update-reliability-fixes-renderer-state-machine*
*Plan: 01*
*Completed: 2026-04-29*
