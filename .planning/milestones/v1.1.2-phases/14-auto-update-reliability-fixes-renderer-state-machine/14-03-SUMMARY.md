---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
plan: 03
subsystem: auto-update / renderer state machine
tags: [renderer, react, electron, auto-update, updfix-02, updfix-03, updfix-04, app-shell-lift]
requirements: [UPDFIX-02, UPDFIX-03, UPDFIX-04]
dependency_graph:
  requires:
    - "Plan 14-01: main-process sticky pendingUpdateInfo slot + asymmetric dismissal + update:request-pending IPC handler"
    - "Plan 14-02: window.api.requestPendingUpdate() preload bridge"
  provides:
    - "App.tsx as sole owner of update-related renderer state (updateState slot + manualCheckPendingRef + 5-channel subscription useEffect + UpdateDialog mount)"
    - "Late-mount sticky-slot recovery wired into App.tsx's update-subscription useEffect (single-shot window.api.requestPendingUpdate() call after subscribers attach)"
    - "AppShell.tsx update-related code REMOVED — only the install-guide menu subscriber remains in a now-1-channel useEffect"
  affects:
    - "Plan 14-04: app-update-subscriptions.spec.tsx will mount <App /> and exercise the lifted subscriptions end-to-end"
    - "Plan 14-05: UAT checklist scenarios for UPDFIX-02 / UPDFIX-03 / UPDFIX-04 now have a renderer subscriber on every AppState branch"
tech_stack:
  added: []
  patterns:
    - "Top-level useEffect in App.tsx for IPC subscriptions that must run on every AppState branch (precedent: existing notifyMenuState useEffect at App.tsx:281-293)"
    - "Render-tree sibling overlay for modal dialogs that visibly outrank AppState-branch content (UpdateDialog rendered inside DropZone after the 6 branch blocks)"
    - "void Promise wrapper for one-shot async IPC inside useEffect body (avoids the useEffect-async-fn anti-pattern)"
    - "Single-IPC useEffect for unrelated menu subscribers (AppShell's now-1-channel install-guide useEffect)"
key_files:
  created:
    - ".planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-03-SUMMARY.md"
  modified:
    - "src/renderer/src/App.tsx (+170 lines: 1 import, ~30-line state block, ~110-line useEffect, ~30-line UpdateDialog JSX)"
    - "src/renderer/src/components/AppShell.tsx (-114 net: 1 import removed, ~28-line state block removed, modalOpen dep+expression updated, 5-channel useEffect collapsed to 1-channel, ~38-line UpdateDialog JSX removed)"
    - "tests/renderer/save-load.spec.tsx (+5 lines: requestPendingUpdate stub on the api fixture — Rule 3 auto-fix)"
key_decisions:
  - "Lifted state lives in App.tsx, NOT in a Context or a separate hook. App.tsx is already a 562-line component owning AppState; adding the 5-field updateState slot and the 5-channel useEffect alongside the existing notifyMenuState/menu-event useEffects keeps update-related state co-located with the other always-mounted top-level state. A Context wrapper would add indirection without solving any problem (only one consumer — UpdateDialog — exists)."
  - "void Promise hydration guard, not setState-on-cleanup. The `void window.api.requestPendingUpdate().then(...)` runs inside the useEffect body but does NOT capture the cleanup function for cancellation — cancelling on unmount is unnecessary because App.tsx is the root component and only unmounts at app teardown. If a stale resolve fires after unmount in a hypothetical test scenario, React's StrictMode warning would be the signal; production code has no risk."
  - "AppShell's install-guide useEffect kept as a 1-channel block (per Plan 12-06 D-16.3 contract). The single subscription deserves its own useEffect because it has its own JSDoc + cleanup. Inlining into another existing useEffect would break the Plan 12-06 attribution and require renaming the cleanup."
  - "modalOpen derivation drops the explicit updateState.open term (and its dep). The dialog still aria-modal-suppresses the File menu via the 08.2 D-184 OS-level contract — no behavior loss. The explicit term was 'parallel-list cosmetic' per the Phase 12 attribution and is now simply unavailable in AppShell's scope."
  - "Rule 3 auto-fix applied to tests/renderer/save-load.spec.tsx — added requestPendingUpdate to the api stub. Without this stub, the App.tsx mount in 8.1-VR-03a / 8.1-VR-03b / 8.1-VR-01 / 8.2-MENU-01..05 throws 'window.api.requestPendingUpdate is not a function' on the first useEffect commit. The plan's acceptance criterion explicitly required the existing 4 onUpdate stubs to keep working — extending the stub list with the new bridge is intrinsic to satisfying that criterion."
metrics:
  duration: ~6m
  task_count: 2
  files_changed: 3
  commits: 2
  completed_date: "2026-04-29"
---

# Phase 14 Plan 03: Lift update subscriptions + UpdateDialog into App.tsx — Summary

**One-line:** Moves the 5-channel auto-update IPC subscription useEffect, the updateState/manualCheckPendingRef state slots, and the `<UpdateDialog>` JSX from AppShell into App.tsx (always-mounted root) — so subscribers run on every AppState branch (idle / loading / loaded / projectLoaded / projectLoadFailed / error) — AND wires the Plan 14-01 sticky-slot recovery via a one-shot `window.api.requestPendingUpdate()` call inside the lifted useEffect; closes UPDFIX-03 + UPDFIX-04 root cause and (combined with Plan 14-01's asymmetric dismissal) closes UPDFIX-02.

## Performance

- **Duration:** ~6 minutes
- **Tasks:** 2
- **Files modified:** 3 (2 source + 1 test fixture)
- **Files created:** 1 (this summary)

## Exact line ranges

### App.tsx — additions

| Range | What | Notes |
|-------|------|-------|
| `App.tsx:24` | `import { UpdateDialog, type UpdateDialogState, type UpdateDialogVariant }` | Inserted immediately after the `AppShell` import |
| `App.tsx:74-101` | `updateState` useState (5-field record) + `manualCheckPendingRef` useRef | Inserted before `handleLoadStart`. Lifted verbatim from AppShell.tsx:155-181 (pre-Phase-14) |
| `App.tsx:325-417` | Lifted 5-channel update-subscription useEffect + Phase 14 D-03 sticky-slot recovery call | Inserted after the existing `notifyMenuState` useEffect; the only diffs vs AppShell:931-979 (pre-Phase-14) are (a) `void window.api.requestPendingUpdate().then(...)` block at lines 410-420 added at end of subscriber attachment, (b) `unsubMenuInstall` removed (stays in AppShell) |
| `App.tsx:526-553` | `<UpdateDialog>` JSX mount | Inserted as sibling of the 6 AppState-branch blocks, after the `error` branch (line 506-516) and before `</DropZone>` (line 554). Lifted verbatim from AppShell.tsx:1442-1468 (pre-Phase-14) |

### AppShell.tsx — deletions / replacements

| Range (pre-edit) | What | Action |
|------------------|------|--------|
| `AppShell.tsx:61` | `import { UpdateDialog, type UpdateDialogState, type UpdateDialogVariant }` | DELETED |
| `AppShell.tsx:155-181` | `updateState` useState slot + `manualCheckPendingRef` useRef | DELETED; replaced by an attribution comment block (`AppShell.tsx:154-159` post-edit) explaining the lift |
| `AppShell.tsx:874` | `\|\| updateState.open` term in modalOpen derivation | DELETED; comment block at 849-854 (post-edit) explains the removal |
| `AppShell.tsx:880` | `updateState.open` in useEffect dep array | DELETED; dep array now `[dialogState, exportDialogState, atlasPreviewOpen, saveQuitDialogState, settingsOpen, helpOpen]` |
| `AppShell.tsx:909-998` | 5-channel update-subscription useEffect + install-guide subscriber | REPLACED by a 1-channel useEffect for `onMenuInstallationGuide` ONLY (post-edit: `AppShell.tsx:889-913`) |
| `AppShell.tsx:1430-1468` | `<UpdateDialog>` JSX mount + 12-line attribution comment | REPLACED by a 3-line attribution comment (post-edit: `AppShell.tsx:1346-1348`) |

### tests/renderer/save-load.spec.tsx — Rule 3 auto-fix

| Range | What | Why |
|-------|------|-----|
| `save-load.spec.tsx:113-117` | Add `requestPendingUpdate: vi.fn().mockResolvedValue(null)` to the api stub | Without this stub, App.tsx's lifted `void window.api.requestPendingUpdate().then(...)` line throws `is not a function` on the useEffect commit, failing 8 of 13 specs in this file. Mocked to resolve `null` (the common case — no pending update on test mount) |

## Confirmations

- ✅ `onMenuInstallationGuide` subscription remains in AppShell (post-edit `AppShell.tsx:908-910`) — confirmed via `grep -c 'onMenuInstallationGuide' src/renderer/src/components/AppShell.tsx` returns `1`.
- ✅ AppShell's `modalOpen` derivation no longer references `updateState.open` — confirmed via `grep -c 'updateState' src/renderer/src/components/AppShell.tsx` returns `0`.
- ✅ AppShell.tsx no longer references any of the 5 update channels — confirmed via 5 separate grep counts all returning `0`.
- ✅ App.tsx grep counts all match plan acceptance criteria except `window.api.requestPendingUpdate` (plan said `1`, actual is `2` because the literal appears in JSDoc at line 349 + actual call at line 410 — see Deviations below).

## Task Commits

1. **Task 1 (feat):** Lift update subscriptions + UpdateDialog mount into App.tsx — `802a76e`
2. **Task 2 (refactor):** Remove update-related code from AppShell.tsx + Rule 3 stub fixture fix — `d67b0ec`

Both commits use `--no-verify` per parallel-executor protocol; the orchestrator validates pre-commit hooks once after all worktree agents complete.

## TDD Gate Compliance

Both tasks were tagged `tdd="true"` in the plan, but the plan's `<done>` block on Task 1 explicitly defers functional test coverage to Plan 04: "The dialog will be functionally tested in Plan 04 via the renderer spec." No new test file is created in this plan; the verification surface is typecheck (`npx tsc --noEmit -p tsconfig.web.json`) + acceptance-criteria greps + the existing 8-spec renderer suite + tests/renderer/save-load.spec.tsx (which now consumes the lifted subscriptions transparently because it renders `<App />`).

Per the GSD TDD-gate rule (RED commit followed by GREEN commit), this plan therefore reports as **N/A — TDD-gate-deferred-to-Plan-04**. The Task 1 + Task 2 commits are pure code-only `feat` / `refactor` commits; their behavior assertion is the existing-suite-stays-green check (50/50 + 13/13 specs pass post-edit), which functionally satisfies the GREEN-without-RED gate when the RED gate lives in the next wave.

## Deviations from Plan

### Minor — acceptance-criterion grep count

**1. `grep -c "window.api.requestPendingUpdate" src/renderer/src/App.tsx` returned `2` (plan expected `1`)**

- **Found during:** Task 1 acceptance-criteria check.
- **Issue:** Plan acceptance criterion specified `grep -c "window.api.requestPendingUpdate" src/renderer/src/App.tsx` returns `1`. Actual result: `2` — the literal appears once in a JSDoc paragraph at line 349 ("invoke `window.api.requestPendingUpdate()` ONCE to recover from the late-mount race…") AND once in the actual call site at line 410 (`void window.api.requestPendingUpdate().then((payload) => { … })`). Both appearances are byte-identical to the plan's prescribed source code (Task 1 step 3 spells out both verbatim).
- **Fix:** None needed; the implementation matches the plan's prescribed source code. The `1` count was an off-by-one in the planner's grep target. Documenting as a benign deviation rather than treating as a failure — consistent with the same class of grep-count off-by-one already documented in 14-01-SUMMARY.md (`getPendingUpdateInfo` literal appearing on 2 lines in src/main/ipc.ts).
- **Files modified:** none (no fix required).
- **Verification:** Functional behavior is correct — the call resolves on mount, hydrates updateState if non-null, and the existing 50 renderer-specs + 13 save-load specs all stay green.

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Add `requestPendingUpdate` stub to tests/renderer/save-load.spec.tsx**

- **Found during:** Task 2 verification run of `npm run test -- tests/renderer/save-load.spec.tsx`.
- **Issue:** The plan's `files_modified` frontmatter for Task 2 listed only `src/renderer/src/components/AppShell.tsx`. Running the spec post-AppShell-edit produced 8 failures with `TypeError: window.api.requestPendingUpdate is not a function` thrown from `src/renderer/src/App.tsx:410:21` during React's commitHookEffectListMount — the lifted useEffect's `requestPendingUpdate` call had no stub on the test fixture's `window.api` shape (Plan 14-02 added the bridge to the production preload but the spec stub list pre-dated it).
- **Fix:** Added `requestPendingUpdate: vi.fn().mockResolvedValue(null)` to the `vi.stubGlobal('api', {...})` block at `tests/renderer/save-load.spec.tsx:113-117`. `null` is the "no pending update" return value — the common case for tests that don't exercise the late-mount-race path.
- **Files modified:** `tests/renderer/save-load.spec.tsx`.
- **Commit:** `d67b0ec` (bundled with the AppShell refactor commit, since the two edits must land atomically — splitting commits would leave the spec failing at an intermediate HEAD).
- **Verification:** post-fix, all 13 specs in save-load.spec.tsx pass; 8 plan-named renderer specs (50 cases) still pass.

---

**Total deviations:** 1 plan-grep count off-by-one (no fix required) + 1 Rule 3 auto-fix (test fixture extension required for the plan's own verification gate to exit 0). **Impact on plan:** No scope creep. The grep-count deviation is purely a planner-side counting error; the production source is byte-identical to the plan's prescribed snippet. The fixture extension is required for the plan's own acceptance criterion (`save-load.spec.tsx exits 0`).

## Issues Encountered

- **Pre-existing failure in `tests/main/sampler-worker-girl.spec.ts`** — known from Plan 14-01 / Plan 14-02; logged in `deferred-items.md`; NOT a regression of this plan.

## Verification Results

- **`npx tsc --noEmit -p tsconfig.web.json`** → exit 0 (after both Task 1 + Task 2)
- **`npm run test -- tests/renderer/save-load.spec.tsx`** → 13/13 passed
- **`npm run test -- tests/renderer/anim-breakdown-virtualization.spec.tsx tests/renderer/global-max-virtualization.spec.tsx tests/renderer/atlas-preview-modal.spec.tsx tests/renderer/help-dialog.spec.tsx tests/renderer/rig-info-tooltip.spec.tsx tests/renderer/settings-dialog.spec.tsx tests/renderer/app-shell-output-picker.spec.tsx tests/renderer/update-dialog.spec.tsx`** → 50/50 passed
- **App.tsx acceptance greps:** all 14 criteria pass (1 benign off-by-one on `window.api.requestPendingUpdate` count, documented above)
- **AppShell.tsx acceptance greps:** all 13 criteria pass exactly (`updateState` / `setUpdateState` / `manualCheckPendingRef` / 5 channel listeners / `import.*UpdateDialog` / `<UpdateDialog` all return `0`; `onMenuInstallationGuide` returns `1`; `INSTALL.md` returns `2`)
- **Post-commit deletion check:** no unintended file deletions across the 2 task commits.

## User Setup Required

None — pure source/test changes within the existing renderer surface. No new dependencies, env vars, build flags, or external service config.

## Next Phase Readiness

- **Plan 14-04 (renderer specs)** can now mount `<App />` directly to exercise the 5-channel subscription registration, the late-mount sticky-slot recovery, the `<UpdateDialog>` mount on idle, and the asymmetric-dismissal end-to-end flow. The `window.api` stub shape established in tests/renderer/save-load.spec.tsx (post-Rule-3-fix) is the canonical fixture pattern Plan 14-04 should mirror.
- **Plan 14-05 (UAT checklist)** scenarios for UPDFIX-02 (Windows manual check re-presents after Later) and UPDFIX-04 (manual Help → Check from idle returns visible feedback within 10s) now have a renderer subscriber on every AppState branch — the structural defect at the heart of both regressions is closed.

## Self-Check: PASSED

**Created files exist:**
- `.planning/phases/14-auto-update-reliability-fixes-renderer-state-machine/14-03-SUMMARY.md` — FOUND (this file)

**Modified files exist (verified by git diff):**
- `src/renderer/src/App.tsx` — modified in `802a76e`
- `src/renderer/src/components/AppShell.tsx` — modified in `d67b0ec`
- `tests/renderer/save-load.spec.tsx` — modified in `d67b0ec`

**Commits exist:**
- `802a76e` — `feat(14-03): lift update subscriptions + UpdateDialog mount into App.tsx` — FOUND
- `d67b0ec` — `refactor(14-03): remove update-related code from AppShell.tsx` — FOUND

---
*Phase: 14-auto-update-reliability-fixes-renderer-state-machine*
*Plan: 03*
*Completed: 2026-04-29*
