---
phase: 18-app-quit-broken-cmd-q-and-applescript
verified: 2026-04-30T13:36:00Z
status: passed
score: 5/5 must-haves verified (truths) + 4/4 ROADMAP success criteria + 8/8 Plan-01 SC + 8/8 Plan-02 SC
verdict: PASS
overrides_applied: 0
deferred:
  - truth: "Live packaged-binary UAT (.dmg installer Cmd+Q + AppleScript regression) for QUIT-01 + QUIT-02"
    addressed_in: "v1.2.0 ship UAT round"
    evidence: "CONTEXT D-10 explicitly defers live packaged-binary UAT to v1.2.0 ship UAT alongside Phase 16's deferred full-release-event re-verification. NOT a gap — explicit phase-scope deferral."
human_verification: []
---

# Phase 18: App quit broken — Cmd+Q + AppleScript Verification Report

**Phase Goal:** Restore `Cmd+Q` and AppleScript `tell application "Spine Texture Manager" to quit` as working app-termination paths on macOS while preserving the Phase 8 / 8.1 dirty-guard SaveQuitDialog contract and not regressing Windows / Linux quit behavior. Closes QUIT-01 + QUIT-02.

**Verified:** 2026-04-30T13:36:00Z
**Status:** PASS
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Plan 18-01 must_haves)

| #   | Truth                                                                                                                                                                            | Status     | Evidence                                                                                                                                                                                                                                                            |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Cmd+Q from idle (no project loaded) terminates the process — no more silent no-op.                                                                                               | ✓ VERIFIED | Vitest case `(18-a)` proves App.tsx-resident `onCheckDirtyBeforeQuit` registers in idle (PRE-LIFT this would fail because AppShell unmounted in idle); `(18-b)` proves firing the IPC in idle calls `confirmQuitProceed` and does NOT mount SaveQuitDialog. Plus user-approved dev-mode smoke (CONTEXT D-09, 2026-04-30). |
| 2   | AppleScript `tell application "Spine Texture Manager" to quit` terminates the process from idle (same code path).                                                              | ✓ VERIFIED | Same code path as Cmd+Q: AppleScript routes through main's `before-quit` handler at `src/main/index.ts:123-136`, which fires `project:check-dirty-before-quit` IPC. The lifted listener at `App.tsx:365-387` handles it identically regardless of which OS event triggered the quit. Verified by-test (18-a/18-b) + dev-mode smoke (D-09). |
| 3   | Cmd+Q from a loaded + clean session terminates immediately without showing SaveQuitDialog.                                                                                       | ✓ VERIFIED | App.tsx three-branch dispatch at L373-376 (D-05 fast-path): `if (!ref.isDirty()) { window.api.confirmQuitProceed(); return; }`. Dev-mode smoke regression spot-check covered this path per Plan 18-02 SUMMARY. |
| 4   | Cmd+Q from a loaded + dirty session mounts SaveQuitDialog with reason 'quit'; Cancel keeps the app running; Save success / Don't Save calls confirmQuitProceed().              | ✓ VERIFIED | Vitest case `(18-c)` proves SaveQuitDialog mounts on dirty quit and `confirmQuitProceed` is NOT called yet; case `(18-d)` proves Cancel does NOT call `confirmQuitProceed` (correct cancel-quit semantic — main stays paused at preventDefault). |
| 5   | `src/main/index.ts` and `src/preload/index.ts` are byte-identical to their pre-phase content (D-06 invariant).                                                                  | ✓ VERIFIED | `git diff cdeb0d4..HEAD -- src/main/index.ts src/preload/index.ts src/renderer/src/modals/SaveQuitDialog.tsx` returned EMPTY output — all three files byte-identical to base commit cdeb0d4 (`docs(18): commit planner artifacts before execute-phase`). |

**Score:** 5/5 truths verified

### ROADMAP Success Criteria

The roadmap defines 4 SCs in `### Phase 18` (`.planning/ROADMAP.md` L315-319):

| #   | Criterion                                                                                                                                                                                       | Status     | Evidence                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SC1 | macOS Cmd+Q terminates the process cleanly within ~1 s; app no longer keeps running silently. (QUIT-01)                                                                                          | ✓ VERIFIED | Vitest 18-a + 18-b lock the runtime contract. Empirical confirmation via dev-mode smoke (CONTEXT D-09, user typed "approved" 2026-04-30).                                                      |
| SC2 | macOS AppleScript quit terminates within ~1 s. (QUIT-02)                                                                                                                                          | ✓ VERIFIED | Same dispatch as Cmd+Q (main's `before-quit` is the funnel for both); covered by 18-a/18-b at the unit-test layer.                                                                              |
| SC3 | Dirty-guard SaveQuitDialog still fires on Cmd+Q with unsaved changes; quit is interruptible by Cancel / Save / Don't Save (no bypass).                                                           | ✓ VERIFIED | Vitest 18-c proves dialog mounts on dirty quit; 18-d proves Cancel does NOT call confirmQuitProceed (Phase 8 contract preserved). Plan 18-01's architectural-lock binds `openSaveQuitDialog` to `setSaveQuitDialogState({ reason: 'quit', pendingAction })` verbatim. |
| SC4 | Windows + Linux behavior unchanged — File→Quit / Alt+F4 / window-close continue to work; no platform regression.                                                                                  | ✓ VERIFIED | Lift is non-branching by construction (no `process.platform` check). The IPC flow is identical on every platform; existing Win/Linux quit paths route through the same `before-quit` listener and now hit a live App.tsx-resident renderer listener on every AppState. D-06 invariant means main + preload are byte-identical so no platform-specific behavior changed. |

### Required Artifacts

| Artifact                                              | Expected                                                                                                                                                                                          | Status     | Details                                                                                                                                                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/renderer/src/App.tsx`                             | dirtyCheckRef declaration (L263-266) + lifted onCheckDirtyBeforeQuit useEffect (L365-387) + dirtyCheckRef pass-through to BOTH AppShell mount sites                                              | ✓ VERIFIED | All three confirmed: `dirtyCheckRef = useRef<{...}>(null)` at L263; lifted useEffect at L365-387 with empty dep array `}, []);` at L387; `dirtyCheckRef={dirtyCheckRef}` at L555 + L572 (both AppShell mount sites). `grep -c onCheckDirtyBeforeQuit` = 1 (lifted); `grep -c "dirtyCheckRef={dirtyCheckRef}"` = 2. |
| `src/renderer/src/components/AppShell.tsx`             | dirtyCheckRef prop on AppShellProps + ref-registration useEffect; OLD listener at lines 780-800 deleted; D-08 lock — must NOT contain `onCheckDirtyBeforeQuit`                                  | ✓ VERIFIED | Prop signature at L133-136 (`MutableRefObject<{isDirty; openSaveQuitDialog}|null>`); destructure at L145; ref-registration useEffect at L1072-1086 with deps `[isDirty, dirtyCheckRef]` and unmount cleanup nulling the ref. `grep -c onCheckDirtyBeforeQuit` = 0 (D-08 lock satisfied). |
| `tests/renderer/app-quit-subscription.spec.tsx`        | NEW spec with FOUR named cases (18-a, 18-b, 18-c, 18-d) all passing                                                                                                                                | ✓ VERIFIED | File exists; all 4 named cases present at L145, 159, 178, 226 (spec greps). `npx vitest run tests/renderer/app-quit-subscription.spec.tsx` → `Tests 4 passed (4)` in 622ms. No `expect(true).toBe(true)` placeholder tautologies remain. |
| `tests/arch.spec.ts`                                   | Phase 18 Layer 3 describe block at end of file asserting AppShell.tsx does NOT contain `onCheckDirtyBeforeQuit` (D-08)                                                                            | ✓ VERIFIED | Block present at L207-227 (last describe in file, after Phase 8 / Phase 9 blocks per chronological convention). `npx vitest run tests/arch.spec.ts -t "Phase 18 Layer 3"` → `Tests 1 passed | 11 skipped (12)` (1 phase-18 test passed; 11 other arch describes skipped by `-t` filter). |
| `src/main/index.ts`, `src/preload/index.ts`, `SaveQuitDialog.tsx` | D-06 byte-identical to pre-phase                                                                                                                                                              | ✓ VERIFIED | `git diff cdeb0d4..HEAD --` for all three returns empty output.                                                                                                                                      |

### Key Link Verification

| From                                              | To                                       | Via                                                                            | Status   | Details                                                                                                                                                                              |
| ------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/renderer/src/App.tsx`                         | `window.api.onCheckDirtyBeforeQuit`      | useEffect at top level of App component (always-mounted root)                  | ✓ WIRED  | L365-387: `const unsub = window.api.onCheckDirtyBeforeQuit(() => {...})`; cleanup `return unsub;` (Pitfall 9/15 listener-identity). Empty dep array L387 (correct — deref is at IPC-fire time). |
| `src/renderer/src/App.tsx`                         | `src/renderer/src/components/AppShell.tsx` | dirtyCheckRef prop passed to BOTH AppShell mount sites                         | ✓ WIRED  | Two pass-through occurrences: L555 (`'loaded'` branch) + L572 (`'projectLoaded'` branch). `grep -c "dirtyCheckRef={dirtyCheckRef}"` = 2. |
| `src/renderer/src/components/AppShell.tsx`         | `App.tsx`'s `dirtyCheckRef.current`       | useEffect with `[isDirty, dirtyCheckRef]` deps; cleanup nulls ref               | ✓ WIRED  | L1072-1086: registers `{isDirty: () => isDirty, openSaveQuitDialog: (onProceed) => setSaveQuitDialogState({reason:'quit', pendingAction:onProceed})}`; cleanup returns `() => { dirtyCheckRef.current = null; }`. |
| `tests/renderer/app-quit-subscription.spec.tsx`    | `src/renderer/src/App.tsx`                | render(<App />) + Object.defineProperty window.api stub capturing the IPC callback | ✓ WIRED  | Spec captures the `onCheckDirtyBeforeQuit` registration (`vi.fn((cb) => { capturedCb = cb; ... })`); fires via `act(() => { capturedCb!(); })` synthetic dispatch. All 4 cases pass. |
| `tests/arch.spec.ts`                               | `src/renderer/src/components/AppShell.tsx` | readFileSync + `.not.toMatch(/onCheckDirtyBeforeQuit/)`                         | ✓ WIRED  | Block at L207-227 reads AppShell.tsx via `readFileSync` (no try/catch ENOENT swallow per CONTEXT D-08); assertion passes because Plan 18-01 deleted the literal. |

### Behavioral Spot-Checks

| Behavior                                                             | Command                                                                                              | Result                                                              | Status   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | -------- |
| Phase 18 spec (4 named cases) all pass                               | `npx vitest run tests/renderer/app-quit-subscription.spec.tsx`                                       | `Test Files 1 passed (1)` / `Tests 4 passed (4)` in 622ms           | ✓ PASS   |
| Phase 18 arch-grep block passes (and no regression in other arch tests) | `npx vitest run tests/arch.spec.ts -t "Phase 18 Layer 3"`                                            | `Tests 1 passed | 11 skipped (12)` (1 of 12 ran via `-t` filter; pass) | ✓ PASS   |
| Full vitest suite green                                              | `npm run test`                                                                                       | `Test Files 48 passed (48)` / `Tests 536 passed | 1 skipped | 2 todo (539)` in 3.38s | ✓ PASS   |
| D-06 main/preload/SaveQuitDialog byte-identical                      | `git diff cdeb0d4..HEAD -- src/main/index.ts src/preload/index.ts src/renderer/src/modals/SaveQuitDialog.tsx` | (empty output)                                                       | ✓ PASS   |
| Structural greps: App.tsx onCheckDirtyBeforeQuit count = 1            | `grep -c onCheckDirtyBeforeQuit src/renderer/src/App.tsx`                                            | `1`                                                                  | ✓ PASS   |
| Structural greps: AppShell.tsx onCheckDirtyBeforeQuit count = 0      | `grep -c onCheckDirtyBeforeQuit src/renderer/src/components/AppShell.tsx`                            | `0` (D-08 lock satisfied)                                            | ✓ PASS   |
| Structural greps: App.tsx dirtyCheckRef pass-through count = 2       | `grep -c "dirtyCheckRef={dirtyCheckRef}" src/renderer/src/App.tsx`                                   | `2` (loaded + projectLoaded branches)                                | ✓ PASS   |
| Empty dep array on lifted useEffect (CONTEXT D-11 / Pitfall 9-15)    | `grep -n "}, \[\]);" src/renderer/src/App.tsx`                                                       | Match at L387 (the lifted useEffect's closing line)                  | ✓ PASS   |
| TypeScript typecheck (full tree)                                     | `npm run typecheck`                                                                                  | `scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'` | ? PRE-EXISTING |

**Typecheck note:** The typecheck error in `scripts/probe-per-anim.ts` is **pre-existing on base commit cdeb0d4** (verified by checking out cdeb0d4 and re-running typecheck — same error reproduces). It is in a probe / dev-tool script, NOT in the renderer or core code Phase 18 modified. Out of Phase 18 scope per the same deviation rule that 18-01-SUMMARY applied to the unrelated `tests/main/sampler-worker-girl.spec.ts` flake. This pre-existing typecheck error is unrelated to QUIT-01 / QUIT-02 closure and does not invalidate Phase 18's verdict.

### Requirements Coverage

| Requirement | Source Plan       | Description                                                                                  | Status     | Evidence                                                                                                              |
| ----------- | ----------------- | -------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| QUIT-01     | 18-01 + 18-02     | Cmd+Q from anywhere terminates the process cleanly on macOS                                  | ✓ SATISFIED | Closed-by-test (vitest 18-a + 18-b) + arch-grep (D-08 lock at tests/arch.spec.ts:218) + dev-mode smoke approved 2026-04-30. Live packaged-binary UAT deferred to v1.2.0 ship round per CONTEXT D-10. |
| QUIT-02     | 18-01 + 18-02     | AppleScript `osascript -e 'tell application "Spine Texture Manager" to quit'` terminates    | ✓ SATISFIED | Same code path as QUIT-01 (both flow through main's `before-quit` → `project:check-dirty-before-quit` IPC). Closed-by-test + arch-grep + dev-mode smoke. Live UAT deferred per D-10. |

### Anti-Patterns Found

None. Per Plan 18-01 SUMMARY's auto-fix log:
- Auto-fix #1 (commit `162df15`): JSDoc comments that contained the literal `onCheckDirtyBeforeQuit` string were rewritten to use "before-quit IPC listener" / "before-quit IPC subscription" phrasing — required so the strict grep gates (count = 1 in App.tsx, count = 0 in AppShell.tsx) and the new arch-grep (Plan 18-02 D-08) all pass simultaneously.
- Auto-fix #2 (commit `162df15`): The Phase 14 spec `tests/renderer/app-update-subscriptions.spec.tsx` had its `Object.defineProperty(window, 'api', ...)` stub patched to include `onCheckDirtyBeforeQuit` and `confirmQuitProceed` mocks, since post-lift `App.tsx` subscribes to the quit channel on mount and the existing stub would have thrown TypeError on every Phase 14 test.

Both auto-fixes are properly scoped, documented in 18-01-SUMMARY, and within Plan-01's modify-files-list.

### Human Verification Required

None outstanding for Phase 18. The dev-mode empirical layer (CONTEXT D-09) was already exercised — user typed "approved" 2026-04-30 per Plan 18-02 SUMMARY. Live packaged-binary UAT (CONTEXT D-10) is explicitly deferred to v1.2.0 ship UAT round and is NOT a Phase 18 scope item.

### Deferred Items (NOT gaps)

| # | Item                                                                                                                                                       | Addressed In         | Evidence                                                                                                                                                                                  |
| - | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Live packaged-binary UAT (.dmg installer Cmd+Q + AppleScript regression — covers all 4 paths: idle / loaded+clean / loaded+dirty + Cancel / Don't Save) | v1.2.0 ship UAT round | CONTEXT D-10 explicitly defers live packaged-binary UAT to the v1.2.0 ship UAT round, alongside Phase 16's deferred full-release-event re-verification. Plan 18-02 SUMMARY confirms. NOT a gap — explicit phase-scope deferral, accepted by user 2026-04-30. |

### Gaps Summary

**No gaps.** All five Plan-01 must-have truths verified, all four ROADMAP Success Criteria satisfied, all artifacts and key links present and wired, all four named vitest cases pass, the arch-grep block locks the lift architecturally, the dev-mode smoke was approved by the user, and the D-06 invariant (main + preload + SaveQuitDialog byte-identical) holds. The single typecheck error in `scripts/probe-per-anim.ts` is pre-existing on base commit cdeb0d4 and unrelated to Phase 18 (probe / dev-tool script, not part of the lift surface). The single full-suite test failure mentioned in 18-01-SUMMARY (`tests/main/sampler-worker-girl.spec.ts`) is no longer present — current `npm run test` reports `Test Files 48 passed (48) / Tests 536 passed | 1 skipped | 2 todo (539)`.

QUIT-01 + QUIT-02 are CLOSED-BY-TEST + BY-ARCH-GREP + BY-DEV-MODE-SMOKE. Live packaged-binary UAT remains deferred to v1.2.0 ship UAT per CONTEXT D-10 — this is a known, accepted phase-scope boundary, not a verification failure.

---

## Phase Status

**VERDICT: PASS**

- **Vitest layer:** 4/4 named cases (18-a, 18-b, 18-c, 18-d) in `tests/renderer/app-quit-subscription.spec.tsx` pass. Full suite: 536/539 (1 skipped, 2 todo, 0 failures).
- **Arch-grep layer:** Phase 18 Layer 3 block (`tests/arch.spec.ts:207-227`) passes; AppShell.tsx is locked against re-introducing `onCheckDirtyBeforeQuit`.
- **Dev-mode empirical layer:** User typed "approved" 2026-04-30 after running `npm run dev` Cmd+Q smoke per CONTEXT D-09.
- **D-06 invariant:** main + preload + SaveQuitDialog byte-identical to base commit `cdeb0d4`.
- **Live packaged-binary UAT:** DEFERRED to v1.2.0 ship UAT round per CONTEXT D-10 (NOT a gap — explicit phase-scope deferral).

## Recommendation

Phase 18 is complete. Per `.planning/STATE.md` recommended execution order (`18 → 19 → 20 → 21 → 22`, with Phase 13.1 inserted opportunistically when a host becomes available), the natural next step is:

- **`/gsd-next`** — let the orchestrator pick the next phase, or
- **`/gsd-discuss-phase 19`** — Phase 19 (UI improvements UI-01..05) is next in line.

Phase 13.1 (Live UAT carry-forwards) remains host-availability gated — invoke `/gsd-discuss-phase 13.1` opportunistically if a Linux/macOS/Windows host becomes available.

---

_Verified: 2026-04-30T13:36:00Z_
_Verifier: Claude (gsd-verifier)_
