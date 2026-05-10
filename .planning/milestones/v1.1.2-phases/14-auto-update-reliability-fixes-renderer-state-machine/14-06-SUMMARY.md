---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
plan: 06
subsystem: infra
tags: [electron-updater, ipc, sticky-slot, gap-closure, regression-test]

# Dependency graph
requires:
  - phase: 14-auto-update-reliability-fixes-renderer-state-machine
    provides: clearPendingUpdateInfo export + sticky pendingUpdateInfo slot in src/main/auto-update.ts (Plan 14-01); update:download / update:dismiss IPC handlers (Phase 12 Plan 01); existing 11-test regression spec at tests/main/auto-update-dismissal.spec.ts (Plan 14-04)
provides:
  - Two production callers of clearPendingUpdateInfo() — one in update:download, one in update:dismiss — closing the dangling JSDoc contract at src/main/auto-update.ts:111-115
  - Two new regression assertions ((14-l)/(14-m)) locking the IPC-handler-driven slot-clear behavior so future remount paths cannot regress silently
  - Code-level closure of gap WR-01 from 14-VERIFICATION.md and G-1 from 14-HUMAN-UAT.md
affects: [phase-15-release, future-hmr-strictmode-remount-paths]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-delegation in-process slot clear at the IPC trust boundary (Option A from 14-REVIEW.md WR-01) — keeps renderer ignorant of main's module state and centralizes cleanup at the IPC seam rather than coupling persistence functions to in-memory slot lifecycle"

key-files:
  created: []
  modified:
    - src/main/ipc.ts (lines 684-723 — both update:download and update:dismiss handlers extended with destructured clearPendingUpdateInfo import + synchronous pre-delegation call + Phase 14 Plan 06 attribution comment blocks)
    - tests/main/auto-update-dismissal.spec.ts (file header coverage count 11→13 at lines 32-46; new (14-l) and (14-m) it() cases appended to the "Phase 14 D-03 update:request-pending sticky slot" describe block at lines 340-399)

key-decisions:
  - "Option A from 14-REVIEW.md WR-01 chosen — clear the slot in the IPC handlers (centralized at the trust boundary), not inside dismissUpdate/downloadUpdate themselves (which would couple persistence to in-memory slot lifecycle)"
  - "Trust-boundary string guard on update:dismiss preserved verbatim — clearPendingUpdateInfo lives INSIDE the IIFE, after the typeof-string guard short-circuits malformed input"
  - "Order in update:dismiss: clearPendingUpdateInfo (sync, cannot throw) BEFORE await dismissUpdate (async disk write that COULD throw) — even on persistence failure the in-memory slot is correctly empty"
  - "Test coverage mirrors the IPC handler shape in-process — (14-l)/(14-m) call clearPendingUpdateInfo() then dismissUpdate/downloadUpdate, asserting the COMBINED sequence empties the slot. The IPC layer itself is exercised by tests/main/ipc.spec.ts; this spec only locks the combined-behavior contract"

patterns-established:
  - "Phase 14 Plan 06 attribution comment blocks at both new IPC handler call sites — matches the inline-comment-density convention at src/main/ipc.ts:664-679 and gives future code archaeology a direct line to this plan + WR-01"

requirements-completed: [UPDFIX-02]

# Metrics
duration: ~5min
completed: 2026-04-29
---

# Phase 14 Plan 06: WR-01 Gap Closure — IPC Sticky-Slot Cleanup Summary

**Two production callers of clearPendingUpdateInfo() wired into update:download + update:dismiss IPC handlers + two regression assertions ((14-l)/(14-m)) lock the new behavior, closing gap WR-01 from 14-VERIFICATION.md.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-29T13:04:43Z
- **Completed:** 2026-04-29T13:09:00Z
- **Tasks:** 3 (Task 1: wire IPC handlers; Task 2: add regression tests; Task 3: full Phase 14 regression net)
- **Files modified:** 2 (`src/main/ipc.ts`, `tests/main/auto-update-dismissal.spec.ts`)

## Accomplishments

- Closed gap WR-01 from 14-VERIFICATION.md at the code level — `clearPendingUpdateInfo()` now has 2 production callers in `src/main/ipc.ts` (was 0; the function was exported and tested but never invoked from production code)
- Closed gap G-1 from 14-HUMAN-UAT.md (same gap, same fix)
- The JSDoc at `src/main/auto-update.ts:111-115` (which named "the existing `update:dismiss` IPC + Phase 14 Plan 03 download-click handler" as the clearance path) is now accurate — both call sites named in the JSDoc exist in production
- Closed Plan 14-03 must-have truth #11 — "Clicking 'Later' in UpdateDialog calls window.api.dismissUpdate(version) AND clears the sticky slot via the new IPC (defense-in-depth)"
- Added 2 new regression assertions so the wiring cannot silently regress in future plans
- Full Phase 14 regression net stays green at 75/75 across 6 spec files (was 73 baseline; +2 from this plan)
- Both typechecks (`tsconfig.json` + `tsconfig.web.json`) exit 0 — no type drift from the destructured-import additions

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire clearPendingUpdateInfo() into the update:download and update:dismiss IPC handlers** — `01ce40f` (fix)
2. **Task 2: Extend tests/main/auto-update-dismissal.spec.ts with two regression assertions** — `6aaee2f` (test)
3. **Task 3: Run full Phase 14 regression net + typecheck** — verification-only, no commit (75/75 + 2 typechecks all green)

## Files Created/Modified

- `src/main/ipc.ts` (modified, +28 / -2 lines) — `update:download` handler at lines 684-697 now destructures `{ downloadUpdate, clearPendingUpdateInfo }` and synchronously invokes `clearPendingUpdateInfo()` before `return downloadUpdate()`; `update:dismiss` handler at lines 698-723 now destructures `{ dismissUpdate, clearPendingUpdateInfo }` inside the IIFE and synchronously invokes `clearPendingUpdateInfo()` before `await dismissUpdate(version)`. Trust-boundary string guard at line 699 preserved verbatim. Two `Phase 14 Plan 06` attribution comment blocks added (lines 685-694 + lines 701-714).
- `tests/main/auto-update-dismissal.spec.ts` (modified, +63 / -1 lines) — file header coverage count updated from 11 → 13 at line 32 with the two new entries listed under the D-03 sticky-slot describe block (lines 42-43); new `(14-l)` IPC-dismiss-path test at lines 340-372 and new `(14-m)` IPC-download-path test at lines 374-399. Both new tests reuse the existing `vi.hoisted` + `vi.mock` + `fireEvent` + `beforeEach` scaffold verbatim — no scaffold changes.

## Closure Verification (Task 3)

- `grep -rn "clearPendingUpdateInfo" src/`: **7 lines total** (acceptance bar was `>= 4`)
  - `src/main/auto-update.ts:113` — pre-existing JSDoc reference (unchanged)
  - `src/main/auto-update.ts:323` — pre-existing function declaration (unchanged)
  - `src/main/ipc.ts:694` — NEW: destructured import in `update:download` handler
  - `src/main/ipc.ts:695` — NEW: synchronous call site in `update:download` handler
  - `src/main/ipc.ts:706` — NEW: comment-block reference inside `update:dismiss` IIFE
  - `src/main/ipc.ts:716` — NEW: destructured import in `update:dismiss` handler
  - `src/main/ipc.ts:717` — NEW: synchronous call site in `update:dismiss` handler
- `grep -rn "clearPendingUpdateInfo" src/main/ipc.ts`: **5 lines** (acceptance bar was `>= 4`)
- `grep -c "clearPendingUpdateInfo();" src/main/ipc.ts`: **2** (both call sites use the no-args call form)
- `grep -c "Phase 14 Plan 06" src/main/ipc.ts`: **2** (both new comment blocks attribute the change for future code archaeology)

## Test Suite Status

- `tests/main/auto-update-dismissal.spec.ts`: 13/13 passing (was 11; +2 from `(14-l)` + `(14-m)`)
- Full Phase 14 regression net (6 spec files): 75/75 passing
  - `tests/main/auto-update-dismissal.spec.ts`: 13 (this plan + Plan 14-04)
  - `tests/renderer/app-update-subscriptions.spec.tsx`: 7 (Plan 14-04)
  - `tests/integration/auto-update-shell-allow-list.spec.ts`: 4 (Plan 14-05)
  - `tests/preload/request-pending-update.spec.ts`: 7 (Plan 14-02)
  - `tests/main/auto-update.spec.ts`: 28 (Phase 12 + Plan 14-01)
  - `tests/main/ipc.spec.ts`: 16 (existing — already mocks `clearPendingUpdateInfo: vi.fn()`, no test changes needed)
- `npx tsc --noEmit -p tsconfig.json`: PASS
- `npx tsc --noEmit -p tsconfig.web.json`: PASS

## Decisions Made

None new — followed plan as written. The plan itself encoded the Option A vs Option B decision from 14-REVIEW.md WR-01 (Option A chosen: clear in IPC handlers, NOT inside dismissUpdate/downloadUpdate). All implementation choices in this plan were prescribed verbatim by the plan's `<action>` blocks (exact diff shapes, exact comment text, exact test labels).

## Deviations from Plan

None — plan executed exactly as written. The plan was unusually detailed (Task 1 step 2/3 gave exact diff shapes including multi-line comment blocks), and all guidance was applied verbatim. No Rule 1/2/3 auto-fixes triggered. No Rule 4 architectural questions surfaced. No authentication gates encountered.

## Issues Encountered

None.

## Gap-Closure Note

**Gap WR-01 from `14-VERIFICATION.md` and G-1 from `14-HUMAN-UAT.md` are closed by this plan at the code level only.** The Phase 14 verification report itself is NOT amended by this plan — that's a separate `/gsd-verify-work 14` concern owned by the orchestrator. After this plan ships, rerunning `/gsd-verify-work 14` will regenerate the report with an empty `gaps` frontmatter (because the dangling-contract anti-pattern at `auto-update.ts:111-115` is gone — both call sites named in the JSDoc now exist in production).

The 6 LIVE-OS test items (1-6) in `14-HUMAN-UAT.md` are explicitly NOT addressed by this plan; they are deferred to Phase 15 by design (packaged-build flows on real macOS / Windows hosts).

## User Setup Required

None — no external service configuration required. This plan is a pure-code defensive cleanup with no infrastructure, no env vars, no dashboard work.

## Next Phase Readiness

- v1.1.2 release-engineering wave (Phase 15) is now unblocked — the WR-01 latent footgun is closed, so future in-session remount paths (HMR, React StrictMode dev cycle, vitest unmount paths, future "Reset session" affordance) will NOT re-hydrate `updateState` from a payload the user has already actioned.
- Phase 15's 6 packaged-build UAT items persisted in `14-HUMAN-UAT.md` will live-verify the end-to-end auto-update lifecycle on real macOS + Windows hosts. UPDFIX-01 (mac `.zip` artifact) remains the open code-level work for Phase 15.
- No regression to any of the 5 ROADMAP success criteria — all still code-wired per the original VERIFICATION matrix; this plan only added defense-in-depth slot clearing without altering the IPC delegation chain.

## Self-Check: PASSED

- `src/main/ipc.ts` modified (commit `01ce40f`): FOUND
- `tests/main/auto-update-dismissal.spec.ts` modified (commit `6aaee2f`): FOUND
- Commit `01ce40f` exists in git log: FOUND
- Commit `6aaee2f` exists in git log: FOUND
- 75/75 tests pass across 6 Phase 14 spec files: VERIFIED
- Both typechecks exit 0: VERIFIED
- `grep -rn "clearPendingUpdateInfo" src/` returns 7 lines (>= 4 acceptance bar): VERIFIED

---
*Phase: 14-auto-update-reliability-fixes-renderer-state-machine*
*Completed: 2026-04-29*
