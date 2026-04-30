# Phase 18: Cmd+Q + AppleScript quit broken on macOS — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore `Cmd+Q` (and AppleScript `tell application "Spine Texture Manager" to quit`) as working app-termination paths on macOS, while preserving the Phase 8/8.1 dirty-guard SaveQuitDialog contract and not regressing Windows/Linux quit behavior. Closes QUIT-01 + QUIT-02.

The phase is a renderer-architecture lift (mirrors Phase 14 commit `802a76e` which closed UPDFIX-02..04) — NOT a new feature, NOT a main-process rewrite, NOT a packaging fix.

</domain>

<root_cause>
## Empirically-Confirmed Root Cause

User confirmed during discuss-phase (2026-04-30): **the bug only manifests when no project/JSON is loaded**. This validates the structural hypothesis end-to-end:

1. `before-quit` listener at [src/main/index.ts:123-136](src/main/index.ts#L123-L136) calls `event.preventDefault()`, then sends `project:check-dirty-before-quit` to the first BrowserWindow.
2. The ONLY listener for that IPC channel lives at [src/renderer/src/components/AppShell.tsx:786-800](src/renderer/src/components/AppShell.tsx#L786-L800).
3. AppShell mounts ONLY when AppState is `loaded` or `projectLoaded` (i.e. a project is loaded).
4. In `idle` / `error` / `projectLoadFailed` AppState, AppShell is unmounted → no listener → main stays paused at `preventDefault()` → quit silently no-ops.
5. Window-close-X works in the same idle state because main's `before-quit` listener hits the `if (!win || win.isDestroyed())` fast-path at [src/main/index.ts:127-134](src/main/index.ts#L127-L134) (the X destroys the window first), sets `isQuitting=true`, and lets quit through via `setTimeout(() => app.quit(), 0)`.

This is the same architectural class of bug that Phase 17 originally targeted (UPDFIX-06 — `onMenuCheckForUpdates` was inside AppShell) but was already fixed by Phase 14's commit `802a76e` lifting `onMenuCheckForUpdates` from AppShell to App.tsx. The Phase 14 lift fixed update menu wiring; the same lift applied to `onCheckDirtyBeforeQuit` fixes the quit path.

</root_cause>

<decisions>
## Implementation Decisions

### Fix Architecture

- **D-01:** Lift the `onCheckDirtyBeforeQuit` subscription from `AppShell.tsx:786` to `App.tsx`'s top-level `useEffect`. This is the canonical Phase 14 lift pattern (commit `802a76e`); it places the subscription at the always-mounted root so it runs regardless of AppState.
- **D-02:** Use a **ref-bridge** to forward the dirty-check from App.tsx to AppShell when AppShell is mounted. Add a new `dirtyCheckRef: { current: (() => boolean) | null }` in App.tsx alongside the existing `appShellMenuRef` and `beforeDropRef`. AppShell registers `dirtyCheckRef.current = () => isDirty` in a mount/unmount useEffect; nulls on unmount. Identical structural shape to existing refs at [App.tsx:242-245](src/renderer/src/App.tsx#L242-L245). Zero re-renders, no project-state ownership change.
- **D-03:** Preserve the **SaveQuitDialog flow verbatim** when AppShell IS mounted AND `isDirty === true`. Phase 8 contract is LOCKED — `setSaveQuitDialogState({ reason: 'quit', pendingAction: () => window.api.confirmQuitProceed() })` must continue to fire on dirty-state quit, with Cancel keeping the app running, Save success / Don't Save calling `confirmQuitProceed` via the existing `pendingAction` chain.
- **D-04:** When AppShell is NOT mounted (ref is null — `idle` / `error` / `projectLoadFailed`), App.tsx fires `window.api.confirmQuitProceed()` immediately on receipt of `project:check-dirty-before-quit`. No round-trip, no dialog — there is no project to save. This is the QUIT-01 + QUIT-02 fix.
- **D-05:** When AppShell IS mounted AND `isDirty === false`, App.tsx also fires `confirmQuitProceed()` immediately (same fast-path as D-04). No SaveQuitDialog needed for clean state. Matches the existing AppShell.tsx:788-790 logic verbatim, just lifted up.
- **D-06:** **No main-process changes**. The existing `before-quit` listener at `src/main/index.ts:123-144` already handles every flow correctly given a working renderer listener — the destroyed-window fast-path, the `isQuitting` re-entry guard, and the load-bearing setTimeout (Pitfall 1) all stay verbatim.

### Test Coverage

- **D-07:** Create `tests/renderer/app-quit-subscription.spec.tsx` modeled directly on `tests/renderer/app-update-subscriptions.spec.tsx` (Phase 14 spec). Four assertions:
  1. **(18-a)** App.tsx mounted in `idle` AppState (no project loaded) registers `onCheckDirtyBeforeQuit`.
  2. **(18-b)** Firing `onCheckDirtyBeforeQuit` while idle → `window.api.confirmQuitProceed()` called; SaveQuitDialog does NOT mount.
  3. **(18-c)** Firing `onCheckDirtyBeforeQuit` while loaded + `isDirty === true` → SaveQuitDialog DOES mount; `confirmQuitProceed()` is NOT called yet.
  4. **(18-d)** Cancel-from-SaveQuitDialog → `confirmQuitProceed()` is NOT called (app stays paused at main's preventDefault, which is the correct cancel-quit semantic).
- **D-08:** Extend `tests/arch.spec.ts` with a **grep arch-test** asserting that `src/renderer/src/components/AppShell.tsx` does NOT contain the literal string `onCheckDirtyBeforeQuit`. Mirrors the existing Layer-3 platform-anti-pattern grep documented at [src/main/index.ts:23-24](src/main/index.ts#L23-L24). Locks the lift architecturally — a future re-regression breaks the build, not just runtime.

### UAT Validation Cadence

- **D-09:** Within this phase, **dev-mode validation only**. Vitest renderer spec (D-07) + arch-grep (D-08) close QUIT-01 + QUIT-02 by-test. Plus a brief manual smoke check via `npm run dev`: launch with no project, press Cmd+Q from drop-zone, verify clean exit. Follows Phase 16 (UPDFIX-05) + Phase 17 (UPDFIX-06) precedent.
- **D-10:** Live packaged-binary UAT (Cmd+Q + AppleScript on installed `.dmg`, including loaded+dirty SaveQuitDialog interaction) is **deferred to the v1.2.0 ship UAT round**, alongside Phase 16's deferred full-release-event re-verification. No standalone packaged-build UAT for this phase.

### Pre-mount Race

- **D-11:** **Accept the narrow pre-mount race.** Document inline in App.tsx's lift `useEffect` comment. Rationale captured in `<deferred>` below. The escalation path (main-side ~2s timeout fallback in `before-quit`) is preserved as a deferred idea if the race ever surfaces in UAT.

### Claude's Discretion

The planner / executor have flexibility in:
- Exact ref name (`dirtyCheckRef` vs `quitDirtyCheckRef` vs alternative naming) — keep consistent with existing `appShellMenuRef` / `beforeDropRef` style.
- Whether to colocate D-01's useEffect with the existing menu-subscription useEffect at [App.tsx:277-306](src/renderer/src/App.tsx#L277-L306) or split into its own block. Preference: split — separate concern (quit) from menu-routing concern; mirrors how Phase 14 added a separate update-subscription useEffect rather than folding into menu wiring.
- Phrasing of inline comments documenting D-11's accepted race window.
- Whether to add an explicit `dirtyCheckRef.current = null` cleanup in AppShell unmount (recommended — same null-safety contract as `mainWindowRef = null` in main on window 'closed').

### Folded Todos

None — no pending todos matched this phase via `gsd-sdk query todo.match-phase`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before producing PLAN.md.**

### Source-of-truth files (must read end-to-end)
- [src/main/index.ts](src/main/index.ts) — `before-quit` listener (lines 39-144), `confirm-quit-proceed` handler (138-144), `window-all-closed` (485-491). NO main-process changes in this phase, but understanding the existing flow is mandatory.
- [src/renderer/src/App.tsx](src/renderer/src/App.tsx) — lift target. Lines 240-306 contain the established ref-bridge + lifted-subscription pattern (`appShellMenuRef`, `onMenuOpen`/`onMenuSave` lift). The new useEffect for `onCheckDirtyBeforeQuit` belongs in this file.
- [src/renderer/src/components/AppShell.tsx](src/renderer/src/components/AppShell.tsx) — lift source. Lines 580-590 show the `isDirty` `useMemo`; lines 786-800 contain the listener to be lifted (deletion target). The `useMemo` STAYS in AppShell — only the IPC subscription lifts.
- [src/preload/index.ts](src/preload/index.ts) — `onCheckDirtyBeforeQuit` + `confirmQuitProceed` bridges. NO preload changes; the existing surface is correct.

### Coverage analog (must read before writing the new spec)
- [tests/renderer/app-update-subscriptions.spec.tsx](tests/renderer/app-update-subscriptions.spec.tsx) — Phase 14 spec that locks the analogous lift. Same Object.defineProperty(window, 'api', ...) idiom, same App-level mount + synthetic-event-fire pattern. Tests 14-i, 14-l in this file are the closest analogs to Phase 18's 18-a, 18-b.
- [tests/arch.spec.ts](tests/arch.spec.ts) — Layer-3 boundary test. Extension point for D-08 grep assertion.

### Decision-history references (read for context)
- [.planning/STATE.md](.planning/STATE.md) — Phase 17 skip rationale (close-by-test precedent for this phase's validation cadence).
- [.planning/PROJECT.md](.planning/PROJECT.md) — current milestone v1.2 scope; Phase 18's place in execution order.
- [.planning/REQUIREMENTS.md](.planning/REQUIREMENTS.md) — QUIT-01 + QUIT-02 acceptance criteria.
- [.planning/ROADMAP.md](.planning/ROADMAP.md) — Phase 18 background, severity, success criteria (4 items).

### Implementation pattern reference (the canonical lift)
- Phase 14 commit `802a76e` — the renderer-lift commit that established this pattern. `git show 802a76e` to see the structural diff. Phase 18 applies the identical shape to a different IPC subscription.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Ref-bridge pattern** ([App.tsx:242-245](src/renderer/src/App.tsx#L242-L245), [App.tsx:472](src/renderer/src/App.tsx#L472)) — `appShellMenuRef`, `beforeDropRef`. New `dirtyCheckRef` follows identical declaration + AppShell-side registration shape. Zero new infrastructure required.
- **Lifted-subscription useEffect pattern** ([App.tsx:277-306](src/renderer/src/App.tsx#L277-L306)) — established by Phase 8.2 (menu lifts) and extended by Phase 14 (update-subscription lifts). New `onCheckDirtyBeforeQuit` useEffect parallels this verbatim.
- **isDirty memo** ([AppShell.tsx:580-590](src/renderer/src/components/AppShell.tsx#L580-L590)) — already wired to Phase 8 dirty-guard. Stays in AppShell; only its consumer-listener lifts. AppShell registers `dirtyCheckRef.current = () => isDirty` in a useEffect with `[isDirty]` dependency to keep the closure fresh.
- **Spec scaffold** ([tests/renderer/app-update-subscriptions.spec.tsx](tests/renderer/app-update-subscriptions.spec.tsx)) — Object.defineProperty window.api stub + render(<App/>) + synthetic event-fire pattern. New spec is a structural copy with `onCheckDirtyBeforeQuit` / `confirmQuitProceed` substituted for the update channels.
- **SaveQuitDialog** ([src/renderer/src/modals/SaveQuitDialog.tsx](src/renderer/src/modals/SaveQuitDialog.tsx)) — verbatim reuse. No props/API change.

### Established Patterns
- **Cross-platform no-branching constraint** (CLAUDE.md, [src/main/index.ts:16-21](src/main/index.ts#L16-L21)) — D-23 / D-27 forbid `process.platform` branches. The lift is non-branching by construction; preserves Win/Linux behavior automatically (Cmd+Q is macOS-specific accelerator, but the IPC flow is identical on every platform; existing File→Quit / Alt+F4 / window-close-X paths on Win/Linux already work and stay unchanged).
- **Pitfall 1 (re-entry guard)** at [src/main/index.ts:39-43](src/main/index.ts#L39-L43) — `isQuitting` flag + load-bearing `setTimeout(..., 0)` deferral. Untouched in this phase.
- **Pitfall 9 / 15 (listener identity preservation)** ([src/preload/index.ts](src/preload/index.ts)) — preload returns the unsubscribe closure capturing the wrapped const. The new App.tsx useEffect MUST return the unsubscribe in cleanup; vitest spec asserts this implicitly (re-mount without leaks).
- **Layer-3 grep arch tests** ([src/main/index.ts:23-24](src/main/index.ts#L23-L24), [tests/arch.spec.ts](tests/arch.spec.ts)) — established convention: forbidden patterns are caught by greps in `tests/arch.spec.ts`. D-08's new grep assertion fits this pattern exactly.

### Integration Points
- New useEffect attaches to App.tsx around line 308+ (after the existing menu-subscription useEffect). Placement preference: separate from menu-subscription useEffect for separation-of-concerns; can share the same dependency array shape.
- AppShell registers into `dirtyCheckRef` via a small `useEffect(() => { dirtyCheckRef.current = () => isDirty; return () => { dirtyCheckRef.current = null; }; }, [isDirty]);` near the existing isDirty memo at AppShell.tsx:580-590, with the ref passed down as a prop from App.tsx (parallel to `onBeforeDropRef={beforeDropRef}` at App.tsx:472 / 488).
- Old AppShell.tsx:786-800 useEffect block is deleted entirely.
- Layer-3 arch test extension is a single new grep block in tests/arch.spec.ts.

</code_context>

<specifics>
## Specific Ideas

- **The fix is not a "fix the menu" or "add role:'quit'" patch.** ROADMAP.md's bullet wording mentions "Wire missing `role: 'quit'` on the menu item, or fix `before-quit` handler swallowing the event" — both are orthogonal and likely WRONG diagnoses given the empirical evidence:
  - The macOS appMenu (`{ role: 'appMenu' }` at [src/main/index.ts:204](src/main/index.ts#L204)) already includes Quit with `role: 'quit'` automatically.
  - `before-quit` handler is NOT swallowing the event — it's correctly preventing default and waiting for renderer confirmation that never arrives.
  - The actual cause is the renderer-side dead listener.
- **Phase 14 commit `802a76e` is the canonical reference implementation.** Researcher and planner should read this commit's diff structurally — the new useEffect shape, ref-bridge declaration, and spec organization mirror it 1:1 (with `onCheckDirtyBeforeQuit` substituted for `onMenuCheckForUpdates`).
- **Empirical evidence reproduces this in dev mode**: `npm run dev` → don't drop a project → Cmd+Q → app no-ops. This is the smoke test for D-09's manual dev-mode check.

</specifics>

<deferred>
## Deferred Ideas

- **Main-side timeout fallback for `before-quit`** (escalation path for D-11). If the pre-mount race surfaces in UAT, add a ~2s timer in [src/main/index.ts:123](src/main/index.ts#L123) — if `confirm-quit-proceed` doesn't arrive in time, treat as no-listener, set `isQuitting=true`, call `app.quit()` via setTimeout. ~15 LOC + 1 timer. Belt-and-braces against future regressions of the same architectural class. Not implemented this phase because: (a) arch-grep test (D-08) covers the regression class structurally; (b) the empirical bug is fully closed by the lift; (c) the pre-mount race window is bounded by ~500ms React hydration during app boot — a user pressing Cmd+Q in that window is theoretical.
- **Live packaged `.dmg` UAT for QUIT-01 + QUIT-02** (escalation path for D-10). Build a real macOS installer, install, perform Phase 15-style manual UAT — Cmd+Q from idle, Cmd+Q from loaded+clean, Cmd+Q from loaded+dirty, AppleScript quit from idle and loaded. Deferred to v1.2.0 ship UAT round, alongside Phase 16's deferred full-release-event re-verification.
- **Sticky-slot stash analog** (Phase 14 D-03 pattern for late-mount recovery). Considered and rejected for this phase: the analogous `before-quit` flow can only fire in response to user input AFTER the window has rendered, so there's no "fired before subscription mounted" payload to recover. Different problem class than Phase 14's update-available payload.

</deferred>

---

*Phase: 18-app-quit-broken-cmd-q-and-applescript*
*Context gathered: 2026-04-30*
