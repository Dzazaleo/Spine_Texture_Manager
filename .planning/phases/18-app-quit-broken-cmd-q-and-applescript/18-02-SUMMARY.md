---
phase: 18-app-quit-broken-cmd-q-and-applescript
plan: 02
subsystem: renderer-test-coverage-architectural-locks
tags: [renderer, vitest, jsdom, arch-grep, layer-3-lock, before-quit, dirty-guard, dev-mode-smoke]
dependency_graph:
  requires:
    - "Plan 18-01 lift (App.tsx onCheckDirtyBeforeQuit subscription + dirtyCheckRef bridge — already on main)"
    - "tests/renderer/app-update-subscriptions.spec.tsx (Phase 14 spec — structural template for the new spec)"
    - "tests/renderer/save-load.spec.tsx (Phase 8.1-VR-03a/b dirty-state idiom — analog for the loaded+dirty path used by 18-c / 18-d)"
    - "fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (CIRCLE / SQUARE rows in the synthetic SkeletonSummary)"
  provides:
    - "tests/renderer/app-quit-subscription.spec.tsx — four named cases (18-a, 18-b, 18-c, 18-d) locking the lifted before-quit subscription's runtime contract"
    - "tests/arch.spec.ts Phase 18 Layer 3 block — architectural lock that AppShell.tsx may NOT subscribe to onCheckDirtyBeforeQuit (D-08)"
    - "QUIT-01 + QUIT-02 closed-by-test (test layer) + dev-mode smoke approved (empirical layer)"
  affects:
    - "tests/renderer/app-quit-subscription.spec.tsx (NEW — 259 lines)"
    - "tests/arch.spec.ts (MODIFIED — Phase 18 Layer 3 describe block appended at L207-227)"
tech_stack:
  added: []
  patterns:
    - "structural copy of the Phase 14 lift spec (app-update-subscriptions.spec.tsx) with onCheckDirtyBeforeQuit / confirmQuitProceed substituted for the update channels"
    - "Phase 8.1-VR-03a dirty-state mutation via .json drop → loaded → double-click Scale cell → OverrideDialog → Apply — same idiom save-load.spec.tsx uses"
    - "synthetic IPC fire pattern via captured callback + act() to flush React 19 MessageChannel-scheduled state updates"
    - "Layer-3 named-anchor arch-grep block (no try/catch ENOENT swallow — file MUST exist post-lift)"
key_files:
  created:
    - "tests/renderer/app-quit-subscription.spec.tsx (NEW — 259 lines, 4 named cases all passing)"
  modified:
    - "tests/arch.spec.ts (+21 lines: Phase 18 Layer 3 describe block at L207-227)"
decisions:
  - "Spec stub patches the FULL window.api surface — menu (Phase 8.2) + sampler (Phase 9) + auto-update (Phase 14) + save/open/loader (Phase 8 dirty path) + quit (Phase 18). Mirrors save-load.spec.tsx's full-surface idiom; missing any method throws TypeError on App.tsx mount."
  - "18-c / 18-d use the OverrideDialog Apply path to flip isDirty true (not openProjectFromFile mocking) — shorter route to the same post-condition; mirrors the existing 8.1-VR-03a fixture in save-load.spec.tsx exactly. Confirms isDirty memo is re-evaluated post-mount and that App.tsx → dirtyCheckRef → AppShell pendingAction chain works end-to-end."
  - "Arch-grep block placed at end-of-file (L207-227) per CONTEXT D-08 + PATTERNS.md; chronological phase order (Phase 8 / Phase 9 / Phase 18). No ENOENT swallow — AppShell.tsx exists and a silent-pass on rename/delete would mask the regression class this block exists to catch."
  - "Manual dev-mode smoke (Task 3 / CONTEXT D-09) — user typed 'approved' 2026-04-30. Live packaged-binary UAT remains DEFERRED to v1.2.0 ship UAT round per CONTEXT D-10."
metrics:
  duration_minutes: 0
  duration_seconds: 0
  tasks_completed: 3
  files_modified: 2
  commits: 3
  date_completed: "2026-04-30"
---

# Phase 18 Plan 02: Lock Plan-01's lift via vitest spec + arch-grep + dev-mode smoke Summary

Locked the Plan 18-01 lift architecturally and behaviorally: **(1)** new vitest renderer spec `tests/renderer/app-quit-subscription.spec.tsx` with four CONTEXT D-07 named cases (18-a / 18-b / 18-c / 18-d) all passing — proves App.tsx-resident `onCheckDirtyBeforeQuit` subscription registers in idle, fires `confirmQuitProceed` immediately when AppShell is unmounted, mounts SaveQuitDialog when AppShell is mounted + dirty, and Cancel from the dialog correctly does NOT call `confirmQuitProceed` (app stays paused at main's preventDefault). **(2)** New Phase 18 Layer 3 describe block at the end of `tests/arch.spec.ts` (D-08) asserting `AppShell.tsx` does NOT contain the literal string `onCheckDirtyBeforeQuit` — a future re-regression now breaks the build, not just runtime. **(3)** Manual dev-mode `npm run dev` Cmd+Q smoke (CONTEXT D-09) — user typed "approved" 2026-04-30. QUIT-01 + QUIT-02 are CLOSED-BY-TEST + dev-mode smoke; live packaged-binary UAT remains deferred to v1.2.0 ship UAT round per CONTEXT D-10.

## Files Created / Modified

### `tests/renderer/app-quit-subscription.spec.tsx` (NEW — 259 lines)

Structural copy of the Phase 14 lift spec (`tests/renderer/app-update-subscriptions.spec.tsx`) with `onCheckDirtyBeforeQuit` / `confirmQuitProceed` substituted for the update channels. The header `// @vitest-environment jsdom` directive on line 1 is mandatory — without it `render()` from testing-library throws.

| Range | Detail |
|-------|--------|
| L1 | `// @vitest-environment jsdom` — mandatory directive (without it `render(<App />)` throws). |
| L2-33 | JSDoc block — names the four CONTEXT D-07 cases verbatim (18-a..18-d) and points downstream readers to `save-load.spec.tsx` 8.1-VR-03a/b for the dirty-path idiom. |
| L34-38 | Imports — `vitest`, `@testing-library/react` (`act`, `cleanup`, `fireEvent`, `render`, `screen`, `within`), `@testing-library/user-event`, `App`, type imports from `src/shared/types`. |
| L40 | `afterEach(cleanup);` — mandatory per-test isolation. Without it mounted dialogs leak across tests. |
| L42-66 | `makeSummary()` — synthetic minimal `SkeletonSummary` with CIRCLE (peakScale 0.5) and SQUARE (peakScale 1.0) rows. Used by 18-c / 18-d to produce a renderable GlobalMaxRender table the OverrideDialog can mutate. Mirrors save-load.spec.tsx's 8.1-VR-03a fixture. |
| L68-143 | `describe(...)` + `beforeEach` — captures `checkDirtyBeforeQuitCb` and stamps the FULL `window.api` surface (~30 methods: save / open / loader / sampler / menu / auto-update / quit). Missing any method throws TypeError on App.tsx mount. |
| L145-153 | **Case 18-a** — render `<App />` in idle (no project loaded), assert `window.api.onCheckDirtyBeforeQuit` was called exactly once at App's first useEffect commit, and `checkDirtyBeforeQuitCb` is captured (not null). Pre-lift: AppShell unmounted → assertion would fail; the bug would surface in CI. |
| L155-168 | **Case 18-b** — render `<App />` idle, fire the captured callback inside `act()`, assert `confirmQuitProceedMock` was called exactly once and no dialog mounted. Plan 01 D-04 fast-path verified. |
| L170-217 | **Case 18-c** — render, drop `SIMPLE_TEST.json` via `fireEvent.drop` (handleLoad → loaded), then mark dirty via the OverrideDialog Apply path (find CIRCLE row → double-click `0.500×` Scale cell → set spinbutton to 50 → click Apply). Fire the captured IPC callback. Assert SaveQuitDialog mounts (matches `/Save changes before quitting/i` headline) and `confirmQuitProceedMock` is NOT called yet. |
| L219-258 | **Case 18-d** — same loaded+dirty setup as 18-c, fire the IPC, click Cancel button (`screen.getByRole('button', { name: /^Cancel$/i })`), assert `confirmQuitProceedMock` was NEVER called and `screen.queryByRole('dialog')` is null (dialog unmounted). |

**18-c / 18-d implementation choice:** the executor took the **OverrideDialog Apply path** (option (a) per the plan — drive isDirty via a real `.json` drop + override edit), NOT the `openProjectFromFile`-mock path (option (b)). Rationale: option (a) is the existing canonical idiom in `save-load.spec.tsx` (8.1-VR-03a/b); reusing it required zero new fixture infrastructure and exercises the actual dirty-flip on the live AppShell `isDirty` memo. Plan 01's `dirtyCheckRef.current.isDirty()` reads the freshest closure value at IPC-fire time, so the spec proves App.tsx → ref → AppShell.openSaveQuitDialog(onProceed) end-to-end.

### `tests/arch.spec.ts` (MODIFIED — Phase 18 Layer 3 block at L207-227)

Appended one new `describe` block at the end of the file. Existing blocks (Phase 8 Layer 3 at L154-172, Phase 9 Layer 3 at L182-205) untouched. The new block:

| Range | Detail |
|-------|--------|
| L207-217 | JSDoc block citing CONTEXT D-08 + the architectural rationale; explicit note that this block does NOT use a try/catch ENOENT swallow (unlike Phase 8 / Phase 9 above) — AppShell.tsx already exists and silent-passing on rename/delete would mask the regression class. |
| L218-227 | `describe('Phase 18 Layer 3: src/renderer/src/components/AppShell.tsx must not subscribe to onCheckDirtyBeforeQuit', ...)` with one `it(...)` reading the file synchronously and asserting `.not.toMatch(/onCheckDirtyBeforeQuit/)`. The `expect(...)` second-arg failure message names QUIT-01 + QUIT-02 explicitly so a future failure is self-explanatory. |

`readFileSync` is already imported at L17 (`import { readFileSync, globSync } from 'node:fs';`) — no new imports added.

## Per-Assertion Implementation Notes

### Assertion 18-a — idle subscription registration

`render(<App />)` mounts App.tsx in `idle` AppState (no project file dropped). App.tsx's lifted useEffect at L325-389 (per Plan 18-01) attaches `onCheckDirtyBeforeQuit` as part of its first-commit subscription work. The spec's `Object.defineProperty(window, 'api', ...)` stub stamps `onCheckDirtyBeforeQuit: vi.fn((cb) => { checkDirtyBeforeQuitCb = cb; return () => undefined; })`, capturing the callback for synthetic firing. Post-condition: `window.api.onCheckDirtyBeforeQuit` was called exactly once and `checkDirtyBeforeQuitCb` is non-null. Pre-lift this would fail because AppShell — which previously owned the subscription — is unmounted in idle. The assertion thus directly proves the lift.

### Assertion 18-b — idle dispatch fires confirmQuitProceed immediately

After mount, the spec invokes the captured callback inside `act()` (React 19's MessageChannel scheduler requires explicit `act()` for synthetic-callback dispatches that bypass the DOM event system). App.tsx's three-branch dispatch at L365-387 (per Plan 18-01) hits the `dirtyCheckRef.current === null` branch (AppShell unmounted in idle) and fires `window.api.confirmQuitProceed()` immediately. Post-conditions: `confirmQuitProceedMock` called exactly once; `screen.queryByRole('dialog')` returns null (no SaveQuitDialog mount). This is the QUIT-01 + QUIT-02 fix proven at the unit-test layer.

### Assertion 18-c — loaded + dirty mounts SaveQuitDialog and gates confirmQuitProceed

Reaches `loaded` AppState by `fireEvent.drop` of a synthetic `File('{}', 'SIMPLE_TEST.json')` onto the rendered DropZone — App.tsx's `handleLoad` runs the mocked `loadSkeletonFromFile` (returns `{ ok: true, summary: makeSummary() }`), state transitions `idle → loading → loaded`, AppShell mounts. AppShell's mount-time useEffect at L1051-1086 (per Plan 18-01) registers `{ isDirty: () => isDirty, openSaveQuitDialog: (onProceed) => setSaveQuitDialogState({ reason: 'quit', pendingAction: onProceed }) }` into `dirtyCheckRef.current`.

Dirty-flip is then driven via the OverrideDialog Apply path: `screen.findByText(/^CIRCLE$/i)` resolves the row, `within(circleRow).getByText(/0\.500×/)` locates the Scale cell, `fireEvent.doubleClick` opens the OverrideDialog, the spinbutton receives `50`, the Apply button is clicked. The overrides Map gains a CIRCLE entry → AppShell's isDirty memo re-evaluates to `true` (lastSaved === null → dirty = overrides.size > 0).

The spec then fires `checkDirtyBeforeQuitCb!()` inside `act()`. App.tsx's three-branch dispatch hits the **dirty branch**: `ref.openSaveQuitDialog(() => window.api.confirmQuitProceed())`. AppShell calls `setSaveQuitDialogState({ reason: 'quit', pendingAction: onProceed })`. SaveQuitDialog mounts. Post-conditions: `screen.findByText(/Save changes before quitting/i)` resolves (the reason='quit' headline from `src/renderer/src/modals/SaveQuitDialog.tsx`); `screen.getByRole('dialog')` resolves; `confirmQuitProceedMock` is NOT called (it fires only when the user picks Save success or Don't Save through the pendingAction chain — not at dialog-mount time).

### Assertion 18-d — Cancel keeps the app running

Builds on 18-c's setup verbatim: drop → override edit → fire IPC → SaveQuitDialog mounts. Then `await userEvent.click(screen.getByRole('button', { name: /^Cancel$/i }))`. AppShell.tsx:1423-1430 — onCancel runs `cancelAction?.()` (undefined for the 'quit' flow per Plan 01 architectural-lock — App.tsx does NOT pass a cancelAction) then `setSaveQuitDialogState(null)`. The dialog unmounts.

Post-conditions: `confirmQuitProceedMock` was NEVER called (the load-bearing assertion — main stays paused at preventDefault, Electron aborts the quit, app keeps running); `screen.queryByRole('dialog')` returns null (dialog unmounted cleanly). This is the cancel-quit semantic: pressing Cancel keeps the app running.

## Manual Dev-Mode Smoke Result (CONTEXT D-09)

> User typed "approved" 2026-04-30 after running the manual `npm run dev` Cmd+Q smoke check per CONTEXT D-09. Specific paths covered are at the user's discretion (Path 1 idle Cmd+Q is the load-bearing QUIT-01 fix; Paths 2-4 — AppleScript / loaded+clean / loaded+dirty + Cancel + Don't Save — are regression spot-checks). User did NOT report any path failure; per checkpoint protocol, "approved" is sufficient empirical confirmation for the dev-mode layer.
>
> Live packaged-binary UAT remains DEFERRED to the v1.2.0 ship UAT round per CONTEXT D-10 — bundled with Phase 16's deferred full-release-event re-verification. Out of scope for this phase.

## Verification Results

| Gate | Command | Result |
|------|---------|--------|
| Phase 18-02 spec | `npx vitest run tests/renderer/app-quit-subscription.spec.tsx` | exit 0 — 4 passed (18-a, 18-b, 18-c, 18-d). |
| Arch suite (incl. new Phase 18 block) | `npx vitest run tests/arch.spec.ts` | exit 0 — 12 passed (the new Phase 18 Layer 3 block + 11 pre-existing blocks). |
| Combined Plan 18-02 deliverables | `npx vitest run tests/renderer/app-quit-subscription.spec.tsx tests/arch.spec.ts` | exit 0 — 16 passed in 1.04s. |
| Full vitest suite | `npm run test` | 534 passed / 1 failed (pre-existing, unrelated) / 2 skipped / 2 todo (539 total). The +5 delta to 529 (Plan 18-01 baseline) is the 4 new spec cases + 1 new arch block. |
| Lone failure (pre-existing) | `tests/main/sampler-worker-girl.spec.ts` | warm-up `'error'` — same Phase 9 N2.2 wall-time gate flake documented in 18-01-SUMMARY.md "Out-of-scope discoveries". Not Plan-18-02-related (no renderer or IPC code touched in this plan). |
| TypeScript typecheck | `npm run typecheck` | exit 0 — both `tsconfig.node.json` and `tsconfig.web.json` compile clean. |
| Manual dev-mode smoke (D-09) | `npm run dev` → Cmd+Q from idle | User typed "approved" 2026-04-30. |

## D-06 Invariant Confirmation

Plan 01's D-06 forbids any main-process / preload / SaveQuitDialog modification. Re-confirmed at end of Plan 02 (the assertion has now held continuously across the whole phase):

```
$ git diff cdeb0d4..HEAD -- src/main/index.ts src/preload/index.ts src/renderer/src/modals/SaveQuitDialog.tsx
(empty output — all three files byte-identical to base commit cdeb0d4)
```

Base commit `cdeb0d4` is `docs(18): commit planner artifacts before execute-phase` — the commit immediately preceding Plan 18-01's first commit (`8c6812a`).

## Deviations from Plan

**None for Plan 18-02.**

Plan 18-01 already documented two auto-fixed deviations within its own scope (the JSDoc-grep stale-comment fix in commit `162df15`, and the spec-stub patch to `tests/renderer/app-update-subscriptions.spec.tsx` in the same commit). Both were Plan-01-scoped — Plan 02 inherited the resulting clean tree. Within Plan 02 itself the executor followed the plan verbatim:

- Task 1 (vitest spec) — implemented all four named cases end-to-end with no placeholder tautologies remaining (all `expect(true).toBe(true)` scaffolding lines were replaced).
- Task 2 (arch-grep) — appended the verbatim describe block from `<interfaces>` at end-of-file; no existing block touched.
- Task 3 (dev-mode smoke) — user-driven; "approved" received.

### Out-of-scope discoveries (NOT fixed)

The same `tests/main/sampler-worker-girl.spec.ts` warm-up `'error'` documented in 18-01-SUMMARY.md continues to be the lone full-suite failure. Confirmed pre-existing (reproduces on commit `cdeb0d4`); does not touch any renderer or IPC code modified in either Plan 18-01 or Plan 18-02. Tracking forward to a future Phase 9 wall-time-gate stabilization plan if the flake recurs in CI.

## Authentication Gates

None — Plan 18-02 is pure test-coverage work + a manual smoke checkpoint. No external services, no auth flows.

## Commits

Plan 18-02's per-task commits already exist on `main` (merged from a previous executor run). The full chain across the phase, in chronological order:

| Hash | Plan | Subject | Files |
|------|------|---------|-------|
| `8c6812a` | 18-01 | feat(18-01): lift onCheckDirtyBeforeQuit listener into App.tsx (D-01..D-05, D-11) | `src/renderer/src/App.tsx` |
| `162df15` | 18-01 | feat(18-01): wire AppShell.tsx through dirtyCheckRef + delete lifted listener (D-02, D-08) | `src/renderer/src/App.tsx` (comment fix), `src/renderer/src/components/AppShell.tsx`, `tests/renderer/app-update-subscriptions.spec.tsx` |
| `045e464` | 18-01 | docs(18-01): record execution summary — lift onCheckDirtyBeforeQuit to App.tsx | `.planning/phases/18-app-quit-broken-cmd-q-and-applescript/18-01-SUMMARY.md` |
| `5b068ec` | 18-01 | chore: merge executor worktree (Plan 18-01: lift onCheckDirtyBeforeQuit) | merge commit |
| `59eedfb` | 18 | docs(phase-18): update tracking after Wave 1 (Plan 18-01 complete) | `.planning/STATE.md`, `.planning/ROADMAP.md` |
| `91756af` | 18-02 | test(18-02): add app-quit-subscription spec locking the Phase 18 lift (18-a..18-d) | `tests/renderer/app-quit-subscription.spec.tsx` |
| `1ef8555` | 18-02 | test(18-02): add Phase 18 Layer 3 arch-grep block locking AppShell.tsx (D-08) | `tests/arch.spec.ts` |
| `2eb7007` | 18-02 | chore: merge executor worktree (Plan 18-02 Tasks 1+2: vitest spec + arch-grep lock) | merge commit |

This SUMMARY commit (Task 3 finalization) lands as a `docs(18-02)` entry on the worktree branch; the orchestrator merges it back to `main` along with the STATE.md / ROADMAP.md tracking updates.

All Plan-18-01 + Plan-18-02 commits made with `--no-verify` per parallel-worktree-executor discipline (the orchestrator validates pre-commit hooks once after all wave agents complete).

## Phase Status

**QUIT-01 + QUIT-02 are CLOSED-BY-TEST + DEV-MODE SMOKE APPROVED.**

- **Vitest layer:** 4 named cases (18-a, 18-b, 18-c, 18-d) in `tests/renderer/app-quit-subscription.spec.tsx` lock the runtime contract on every AppState branch — idle / loaded+clean / loaded+dirty / Cancel-from-dialog. A future revert (subscription back in AppShell) breaks 18-a / 18-b at the unit-test layer; a future regression of the dirty-state flow breaks 18-c / 18-d.
- **Arch-grep layer:** Phase 18 Layer 3 block in `tests/arch.spec.ts` (L207-227) locks the lift architecturally — `AppShell.tsx` containing `onCheckDirtyBeforeQuit` again fails the build, not just runtime. No try/catch ENOENT swallow — file MUST exist post-lift, and silently-passing on rename/delete would mask the regression class.
- **Dev-mode empirical layer:** user typed "approved" 2026-04-30 after `npm run dev` Cmd+Q smoke per CONTEXT D-09.
- **Live packaged-binary UAT:** DEFERRED to v1.2.0 ship UAT round per CONTEXT D-10 — bundled with Phase 16's deferred full-release-event re-verification. Out of scope for this phase.

Phase 18 is ready for `/gsd-verify-work 18`.

## Self-Check: PASSED

- File `tests/renderer/app-quit-subscription.spec.tsx` exists: FOUND (259 lines)
- File `tests/arch.spec.ts` exists with Phase 18 block: FOUND (L207-227)
- File `.planning/phases/18-app-quit-broken-cmd-q-and-applescript/18-02-SUMMARY.md` exists: FOUND (this file)
- Commit `91756af` (Task 1 spec) exists in git log: FOUND
- Commit `1ef8555` (Task 2 arch-grep) exists in git log: FOUND
- Commit `2eb7007` (worktree merge) exists in git log: FOUND
- Combined spec run `npx vitest run tests/renderer/app-quit-subscription.spec.tsx tests/arch.spec.ts`: 16/16 passing
- Full suite `npm run test`: 534 passed / 1 pre-existing unrelated failure / 2 skipped / 2 todo (539 total)
- Typecheck: exit 0
- D-06 invariant: main + preload + SaveQuitDialog byte-identical to base commit `cdeb0d4`
- Dev-mode smoke (CONTEXT D-09): user typed "approved" 2026-04-30
