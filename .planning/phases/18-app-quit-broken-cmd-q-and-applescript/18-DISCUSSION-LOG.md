# Phase 18: Cmd+Q + AppleScript quit broken on macOS — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 18-app-quit-broken-cmd-q-and-applescript
**Areas discussed:** Fix architecture, Test coverage shape, UAT validation cadence, Pre-mount race hardening

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Fix architecture | Lift-only vs. lift + main-side timeout fallback | ✓ |
| Test coverage shape | Renderer spec / + main-process spec / + integration | ✓ |
| UAT validation cadence | Dev-mode only vs. dev + AppleScript vs. packaged .dmg | ✓ |
| Pre-mount race hardening | Worth fixing now or accept the narrow window? | ✓ |

**User selected all four.**

---

## Fix Architecture

### Q1: Fix architecture for the dirty-guard quit listener

| Option | Description | Selected |
|--------|-------------|----------|
| Lift only | Move subscription from AppShell.tsx:786 to App.tsx; ref-bridge for isDirty; mirrors Phase 14 commit 802a76e exactly | ✓ (Claude's discretion) |
| Lift + main timeout | Same lift plus ~2s timer in main's before-quit; defense-in-depth | |
| Lift + retire IPC for idle | App.tsx checks AppState before round-trip; functionally equivalent to "Lift only" with ref-null fast-path | |

**User's choice:** "you decide" + key empirical disclosure: *"this quit bug seems to happen only when the app has no json or project loaded"*
**Notes:** User's empirical observation confirms the root-cause hypothesis end-to-end (idle-state-only manifestation = AppShell-mounted-only listener). Claude's discretion: Lift only, since ref-null fast-path inherently covers the idle case without needing a separate "retire IPC for idle" branch or magic-number timeout. Pre-mount race is handled separately in Area 4.

### Q2: How should App.tsx access AppShell's isDirty when forwarding the dirty-check?

| Option | Description | Selected |
|--------|-------------|----------|
| Ref-bridge (recommended) | New dirtyCheckRef paralleling appShellMenuRef + onBeforeDropRef; AppShell registers `() => isDirty` on mount, nulls on unmount | ✓ |
| Lift isDirty state up | Move isDirty useMemo + dependencies to App.tsx | |
| Imperative IPC handler in AppShell | New IPC channel for App.tsx to ask AppShell | |

**User's choice:** Ref-bridge (recommended)
**Notes:** Matches existing patterns; zero ownership change to project state.

### Q3: When AppShell IS mounted and isDirty === true, what should happen on Cmd+Q?

| Option | Description | Selected |
|--------|-------------|----------|
| Preserve current SaveQuitDialog flow | Identical to Phase 8 contract: dialog with Save/Don't Save/Cancel | ✓ |
| Same dialog but clarify Cancel UX | Investigate second-Cmd+Q-after-Cancel behavior | |

**User's choice:** Preserve current SaveQuitDialog flow
**Notes:** Phase 8/8.1 dirty-guard contract is LOCKED.

---

## Test Coverage Shape

### Q1: Regression test shape for the lift

| Option | Description | Selected |
|--------|-------------|----------|
| Renderer spec only (Phase 17 precedent) | New tests/renderer/app-quit-subscription.spec.tsx with 4 assertions | ✓ (Claude's discretion) |
| Renderer spec + main-process spec | Plus tests/main/before-quit-flow.spec.ts | |
| Renderer + main + integration | Plus end-to-end vitest spec | |

**User's choice:** "you decide"
**Notes:** Phase 17 close-by-test precedent for UPDFIX-06 used renderer-spec-only and was sufficient. Adding main-process spec is ~80 LOC of mock setup for marginal benefit; main-process flow is unchanged and already covered by Phase 8 dirty-guard tests. Renderer spec only.

### Q2: Should the spec assert text-anchor invariants to prevent silent re-regression?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — grep arch-test for AppShell | Extend tests/arch.spec.ts: AppShell.tsx must not contain literal `onCheckDirtyBeforeQuit` | ✓ (Claude's discretion) |
| No — runtime spec is enough | Rely solely on the renderer spec failing on regression | |

**User's choice:** "you decide"
**Notes:** Layer-3 grep arch tests are an established convention (see src/main/index.ts:23-24). ~5 LOC, locks the architectural lift so a future re-regression breaks the build, not just runtime. Cheap belt-and-braces.

---

## UAT Validation Cadence

### Q1: How should QUIT-01 / QUIT-02 be validated for this phase?

| Option | Description | Selected |
|--------|-------------|----------|
| Dev-mode only (Phase 16 precedent) | Vitest renderer spec + arch grep close by-test + brief `npm run dev` smoke check | ✓ |
| Dev-mode + dev AppleScript check | Plus one manual dev-mode `osascript` test | |
| Build packaged macOS .dmg + live UAT | Phase 15-style packaged-binary manual UAT | |

**User's choice:** Dev-mode only (Phase 16 precedent)
**Notes:** Mirrors the precedent set by Phases 16 (UPDFIX-05) and 17 (UPDFIX-06). Live packaged-binary verification deferred to v1.2.0 ship UAT round.

---

## Pre-mount Race Hardening

### Q1: Pre-mount race — what happens if Cmd+Q fires before App.tsx mounts its useEffect?

| Option | Description | Selected |
|--------|-------------|----------|
| Add main-side timeout fallback | ~2s timer in main; ~15 LOC + 1 timer | |
| Sticky-slot stash (Phase 14 D-03 analog) | New IPC channel + main-side state slot for late-mount recovery | |
| Accept the narrow window | Document inline; minimal patch | ✓ (Claude's discretion) |

**User's choice:** "you decide"
**Notes:** Window is bounded by ~500ms React hydration during app boot; outside that, the listener is always live. Arch-grep test (D-08) covers the architectural regression class. Empirical bug fully closed by the lift. CLAUDE.md guidance favors minimal patches over speculative hardening. Escalation path (main-side timeout) preserved as deferred idea.

---

## Claude's Discretion

The planner / executor have flexibility on:
- Exact ref name (`dirtyCheckRef` recommended; `quitDirtyCheckRef` acceptable).
- Whether to colocate the new useEffect with the existing menu-subscription useEffect at App.tsx:277-306 or split into its own block (split recommended).
- Phrasing of inline comments documenting D-11's accepted race window.
- Whether to add explicit `dirtyCheckRef.current = null` cleanup in AppShell unmount (recommended).

## Deferred Ideas

- Main-side timeout fallback for `before-quit` (escalation path if pre-mount race surfaces in UAT).
- Live packaged `.dmg` UAT for QUIT-01 + QUIT-02 (deferred to v1.2.0 ship UAT round, alongside Phase 16's full-release-event re-verification).
- Sticky-slot stash analog (rejected — different problem class than Phase 14's update-available payload).
