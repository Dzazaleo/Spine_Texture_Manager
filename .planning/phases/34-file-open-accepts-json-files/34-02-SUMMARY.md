---
phase: 34-file-open-accepts-json-files
plan: 02
subsystem: renderer
tags: [electron, react, ipc, dialog, dirty-guard, discriminated-union, typescript, useeffect]

# Dependency graph
requires:
  - phase: 34
    plan: 01
    provides: OpenDialogResponse three-arm envelope + openProjectPicker + loadSkeletonFromPath preload bridges + 'project:open-dialog' IPC channel
  - phase: 08.1
    provides: handleBeforeDrop ref-bridge (D-163) — supports 'json' | 'stmproj' kinds; null ref ⇒ true (no guard when AppShell unmounted)
  - phase: 08.2
    provides: onMenuOpen/onMenuOpenRecent/onMenuSave/onMenuSaveAs menu subscriptions (D-175 + D-183) — the useEffect block at App.tsx:317; only the onMenuOpen body changes
  - phase: 08
    provides: handleProjectLoad recovery-aware OpenResponse landing (D-161 + D-162); openProjectFromPath preload bridge (UNCHANGED, reused by project arm)
  - phase: 01
    provides: handleLoad LoadResponse landing → status:'loaded'
provides:
  - Rewired onMenuOpen handler implementing the D-05 + D-06 two-IPC-step contract (picker → branch by kind → dirty-guard → load).
  - Resolution of Plan 01's intentional App.tsx tsc compile break (orphan `window.api.openProject()` callsite).
  - Cancel-from-picker as a true no-op in the menu File→Open flow (D-05 explicit improvement over Phase 08.2 D-183).
affects:
  - 34-03 (Wave 3 — fixes the renderer save-load.spec.tsx mocks whose surface still references the deleted `api.openProject`; depends on this rewire landing first to validate the live runtime behavior).

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Renderer-side discriminated-union dispatch: `result.kind === 'cancelled' | 'project' | 'skeleton'` drives both the dirty-guard `dropKind` and the load-IPC selection in a single handler — exhaustive without a switch."
    - "Dirty-guard-after-picker (D-05) — the SaveQuitDialog only mounts when the user has actually chosen a file. Cancelling the OS native picker is now indistinguishable from never opening it."
    - "Mirror the onMenuOpenRecent shape (Phase 08.2:325-330) — picker/load split + basename derivation via `path.split(/[\\\\/]/).pop()` keeps menu Open's structural shape identical to its analog."

key-files:
  created: []
  modified:
    - src/renderer/src/App.tsx (onMenuOpen body — 23-line rewrite within the existing useEffect at line 317; cleanup `unsubOpen()` preserved; all other subscriptions UNCHANGED)
    - .planning/phases/34-file-open-accepts-json-files/deferred-items.md (new — records out-of-scope tsc TS6133 discovery in tests/main/image-worker-rotation.spec.ts)

key-decisions:
  - "Renderer dispatch is exhaustive on the three-arm envelope: cancelled → early return (no guard, no toast, no state change); project → handleProjectLoad; skeleton → handleLoad. No switch statement — a single `if/else if/else` mirrors the analog onMenuOpenRecent shape. The compile-time exhaustiveness check sits at the discriminated union, not at runtime."
  - "Basename derivation lives in the renderer (`result.path.split(/[\\\\/]/).pop() ?? result.path`) rather than the picker handler. Two reasons: (1) it's the identical pattern already in onMenuOpenRecent (line 329), and (2) keeping it renderer-side leaves the OpenDialogResponse envelope minimal (path-only), which preserves the symmetric shape with the existing openProjectFromPath / loadSkeletonFromPath IPC arg lists (also path-only)."
  - "`dropKind` derivation uses ternary on `result.kind === 'project'` rather than a separate type-guard. The Phase 8.1 D-163 ref-bridge accepts `'json' | 'stmproj'`; the mapping (project→stmproj, skeleton→json) is a stable invariant that doesn't need its own helper."
  - "No new useState / useRef / useEffect added — the rewire stays inside the existing menu-subscription useEffect at line 317. The handler's closures (handleBeforeDrop, handleLoad, handleProjectLoad) are all `useCallback`-wrapped with empty deps, so the effect dep-array is UNCHANGED."

patterns-established:
  - "Renderer-side IPC dispatch on discriminated-union picker envelopes — apply this pattern whenever a new picker grows multi-arm support (e.g., import / export / locate flows that may need to accept multiple file types in a single dialog)."
  - "Dirty-guard-after-picker as a UX invariant for menu Open — once the picker is shown and cancelled, the renderer MUST NOT enter the guard flow. This is now the canonical pattern across menu Open and (after Plan 03 hardens the tests) drag-drop."

requirements-completed:
  - OPEN-02
  - OPEN-03
  - OPEN-04
  - OPEN-05

# Metrics
duration: 2min
completed: 2026-05-11
---

# Phase 34 Plan 02: File→Open accepts JSON files (Wave 2 — renderer rewire) Summary

**App.tsx `onMenuOpen` handler now consumes Plan 01's two-IPC-step contract (`openProjectPicker` → dispatch by `result.kind` → `loadSkeletonFromPath` / `openProjectFromPath`); menu File→Open accepts both `.stmproj` and `.json`, dirty-guard fires post-picker with the actual kind, cancel branch is a true no-op.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-11T19:59:35Z
- **Completed:** 2026-05-11T20:00:50Z
- **Tasks:** 1/1
- **Files modified:** 1 production (+ 1 phase-meta tracking file: deferred-items.md)

## Accomplishments

- The `unsubOpen` handler at `src/renderer/src/App.tsx:318` is rewritten to the canonical Phase 34 D-06 5-step flow: (1) call `window.api.openProjectPicker()`, (2) early-return on `kind === 'cancelled'` with zero side effects, (3) derive basename + `dropKind` from `result.path` + `result.kind`, (4) `await handleBeforeDrop(fileName, dropKind)` and early-return if the user cancels the SaveQuitDialog, (5) dispatch to the existing `handleProjectLoad` or `handleLoad` handler with the matched load-IPC.
- Plan 01's intentional App.tsx tsc compile break (the orphan `window.api.openProject()` call) is closed — `npx tsc --noEmit -p tsconfig.json` and `tsc -p tsconfig.web.json` both exit 0. `arch.spec.ts` passes 12/12 (Layer 3 unchanged — App.tsx never imported from `src/core/*`).
- All four other menu subscriptions in the same useEffect (`onMenuOpenRecent`, `onMenuSave`, `onMenuSaveAs`, `onMenuReloadProject`, `onMenuExport`, …) and the effect's dependency array are UNCHANGED, as required by the plan's `<behavior>` constraints.
- The Phase 8.1 D-163 ref-bridge (`handleBeforeDrop` / `beforeDropRef`), the Phase 8 `handleProjectLoad` / `handleLoad` callbacks, and the Phase 31 PLATFORM-01 advisory text at App.tsx:617 are all UNTOUCHED.

## Task Commits

Each task was committed atomically. Plan 34-02 has a single task with `tdd="true"`, but per the plan, the canonical RED gate IS Plan 01's intentional App.tsx tsc compile break (already committed in commits `7f73465` and `61d0e76` from Wave 1) — this plan delivers only the GREEN. No new test file is added; Plan 03 owns the mock-surface rewrite for `tests/renderer/save-load.spec.tsx`.

1. **Task 1 GREEN: rewire onMenuOpen to D-05 + D-06 two-IPC-step flow** — `9fa1d41` (feat)

**Plan metadata:** committed alongside this SUMMARY.md.

## Files Created/Modified

**Production:**
- `src/renderer/src/App.tsx` — rewrote the body of `window.api.onMenuOpen(async () => {...})` at lines 318-323. The new handler is 27 lines (vs. the previous 5-line body) and replaces a single `window.api.openProject()` call with the picker/dispatch/load 3-step flow. No imports added or removed. No other lines in App.tsx are modified.

**Phase tracking (not production):**
- `.planning/phases/34-file-open-accepts-json-files/deferred-items.md` — new file recording one out-of-scope discovery (see Deviations below).

## Decisions Made

All decisions in this plan reflect the plan's explicit `<behavior>` and `<action>` instructions verbatim. The plan provided the exact handler body to drop in; no executor discretion was applied to the implementation. The four key-decisions in the frontmatter capture WHY the plan chose those shapes (dispatch exhaustiveness, basename in renderer, ternary for dropKind, no new state slots) — provided here so downstream readers don't have to re-read the plan to understand the rationale.

## Deviations from Plan

### Deviations

**1. [Plan-text vs. acceptance-grep inconsistency — exact-handler-text wins] `result.kind === 'project'` appears 2× not 1×**
- **Found during:** Task 1 (verification step)
- **Issue:** The plan's `<acceptance_criteria>` asserts `grep -c "result.kind === 'project'" src/renderer/src/App.tsx` equals 1, but the plan's own exact handler text (lines 161-178 of the plan) contains TWO occurrences of `result.kind === 'project'`: one in the `dropKind` ternary (`result.kind === 'project' ? 'stmproj' : 'json'`), and one in the dispatch `if` branch (`if (result.kind === 'project')`). The actual count after the rewire is 2.
- **Fix:** None applied to the production code. The plan's `<action>` block explicitly instructs replacing the handler body "with this exact handler" — and the exact handler text contains 2 occurrences. Truth-criterion (the handler the plan wrote, which compiles + dispatches correctly) wins over the count-assertion (a plan-text-vs-grep mistake by the planner). All other 10 grep criteria pass exactly.
- **Files modified:** None (deviation is documentation-only).
- **Verification:** All other 10 acceptance-grep counts match the plan exactly; `tsc -p tsconfig.json` exits 0; `arch.spec.ts` 12/12.
- **Committed in:** Not applicable (no code change).

### Out-of-scope discoveries (logged, not fixed)

**Pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts:187`** — surfaced only via `npx tsc --build` (composite project full graph). The plan's specified verification command `npx tsc --noEmit -p tsconfig.json` exits 0; this lint-style unused-binding error lives in a Phase 33 rotation test, unrelated to Phase 34's renderer rewire. Logged to `.planning/phases/34-file-open-accepts-json-files/deferred-items.md` per executor scope-boundary rule.

## Issues Encountered

None. The TDD gate sequence is preserved (RED from Plan 01 → GREEN here), the per-commit HEAD-on-worktree-agent-branch assertion passed, no destructive git operations were used, and no files were unexpectedly deleted by the commit.

## User Setup Required

None — pure renderer-internal rewire. No external service configuration, no env vars, no manual database steps.

## Next Phase Readiness

- **Wave 3 (Plan 34-03) is unblocked.** Plan 03's stated job is to fix `tests/renderer/save-load.spec.tsx`'s mock surface, which still references the deleted `api.openProject` and the deleted `(menu)` placeholder fileName. The Wave 2 plan explicitly documents (in `<verification>`) that `npm test -- tests/renderer/save-load.spec.tsx --run` will fail in 8.2-MENU-03/04 after this plan lands and that Plan 03 fixes them — this expected failure is NOT a regression.
- **Threat model fully discharged.** All four T-34-02-* threats had `accept` dispositions; the rewire respects them: (T-34-02-01) renderer treats `result.kind` as authoritative — main is the source of truth, defense-in-depth lives at the unchanged `handleProjectOpenFromPath` / `handleSkeletonLoad` validators; (T-34-02-02) renderer never modifies `result.path` before re-passing; (T-34-02-03) basename derivation is pure string slicing, no fs/IPC; (T-34-02-04) no audit logging in scope.
- **Manual smoke (optional, not gating):** `npm run dev`, click File → Open or press Cmd+O, verify the OS native picker shows both `.stmproj` and `.json` in a single filter; verify cancelling the picker on a dirty session does NOT trigger SaveQuitDialog; verify picking a `.json` lands the skeleton-only `loaded` state and picking a `.stmproj` lands the `projectLoaded` state. Plan 03 will cover these programmatically once the mocks are updated.

## Self-Check

Verifying the claims in this SUMMARY against the actual repository state:

**Files exist:**
- `src/renderer/src/App.tsx` — present, modified (onMenuOpen body rewired; 27-line handler).
- `.planning/phases/34-file-open-accepts-json-files/deferred-items.md` — present, new (records out-of-scope tsc TS6133 discovery).
- `.planning/phases/34-file-open-accepts-json-files/34-02-SUMMARY.md` — present, this file.

**Commits exist:**
- `9fa1d41` — present (feat GREEN: rewire onMenuOpen to D-05 + D-06 two-IPC-step flow).

**Verification commands:**
- `npx tsc --noEmit -p tsconfig.json` — exits 0 (PASS).
- `npx tsc --noEmit -p tsconfig.web.json` — exits 0 (PASS).
- `npm test -- tests/arch.spec.ts --run` — 12/12 passed (PASS).
- 10 of 11 acceptance-grep counts match the plan; the 11th (`result.kind === 'project'` count) is a documented deviation where the plan's exact handler text contains 2 occurrences but the plan's acceptance assertion said 1 (plan-internal inconsistency — handler-text wins).

## Self-Check: PASSED

---
*Phase: 34-file-open-accepts-json-files*
*Completed: 2026-05-11*
