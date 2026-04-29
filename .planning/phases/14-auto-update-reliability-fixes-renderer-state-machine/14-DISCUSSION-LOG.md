# Phase 14: Auto-update reliability fixes (renderer + state machine) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-29
**Phase:** 14-auto-update-reliability-fixes-renderer-state-machine
**Areas discussed:** UPDFIX-04 fix architecture, UPDFIX-02 dismissal semantics, UPDFIX-03 startup auto-check diagnosis, Verification strategy, UPDFIX-02 Windows variant routing

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| UPDFIX-04 fix architecture (renderer-subscription race) | Pre-load manual-check silence — root cause hypothesis + fix shape | ✓ |
| UPDFIX-02 dismissal semantics on manual checks | Should manual check always re-present even with dismissedUpdateVersion match? | ✓ |
| UPDFIX-03 startup auto-check regression diagnosis | Why did UPD-01 regress in v1.1.1 on both OSes? | ✓ |
| Verification strategy without a publish round | How to verify Phase 14 fixes when no tag/CI/publish allowed? | ✓ |

**User's choice:** All four — multi-select.
**Notes:** UPDFIX-02 Windows variant routing was framed as automatically in scope; treated as a fifth implicit area and deep-dived after the four.

---

## Area 1 — UPDFIX-04 fix architecture

### Q1: Where should the update:* IPC subscriptions live so they're active before any project loads?

| Option | Description | Selected |
|--------|-------------|----------|
| Lift to App.tsx (mounts unconditionally) (Recommended) | Move 5 update IPC useEffect from AppShell up to App.tsx. UpdateDialog becomes sibling of DropZone in App.tsx render tree. | ✓ |
| New <UpdateController/> component mounted in App.tsx | Headless component owning updateState + subscriptions + UpdateDialog mount. | |
| Main-side event buffering with renderer-ready handshake | Main buffers events, replays on renderer 'subscribed' IPC. | |
| Eager subscribe in preload (collect events into buffer until renderer ready) | Preload listens, pushes to JS array, renderer drains on mount. | |

**User's choice:** Lift to App.tsx (Recommended).
**Notes:** Cleanest root-cause fix; smallest behavioral surprise; concentrates structural change in one render-tree edit.

### Q2: What should happen when main fires update:available BEFORE the renderer's subscription effect has run?

| Option | Description | Selected |
|--------|-------------|----------|
| Renderer asks main to re-deliver pending events on mount (Recommended) | Add invoke channel update:request-pending. Main keeps single sticky slot. | ✓ |
| Main waits for did-finish-load before sending update:* events | Subscribes to webContents.once('did-finish-load') gate. | |
| Tolerate the race — startup detection too fast is unlikely | Keep send-and-forget after lifting subscriptions. | |

**User's choice:** Renderer asks main to re-deliver pending events on mount (Recommended).
**Notes:** Bounded state main-side (one slot, last-write-wins). Solves both "startup-check too fast" and "user clicks from idle" paths.

### Q3: What does main's "pending" slot hold — just update:available payloads, or all four event types?

| Option | Description | Selected |
|--------|-------------|----------|
| Only update:available is sticky; others are ephemeral (Recommended) | Sticky overwrites on newer version, clears on dismiss/download. update:none/error/downloaded ephemeral. | ✓ |
| All update:* events buffered until renderer drains | Bounded queue (last N events). | |
| Sticky update:available + last-resolved status (none / error) | Two slots. Renderer can render 'last check N min ago, no update'. | |

**User's choice:** Only update:available is sticky; others are ephemeral (Recommended).
**Notes:** Matches user mental model — "is there an update?" is persistent fact; "check failed" is transient event.

### Q4: Should manual Help → Check for Updates from idle (no project) work the same way as from a loaded project?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — identical behavior in both states (Recommended) | Menu IPC fires regardless. UpdateDialog mounts above DropZone idle message. | ✓ |
| Disable Check for Updates menu item until a project loads | Out of scope per UPDFIX-04 wording. | |

**User's choice:** Yes — identical behavior in both states (Recommended).
**Notes:** UPDFIX-04 wording explicitly requires this.

---

## Area 2 — UPDFIX-02 dismissal semantics

### Q1: When user clicks Help → Check for Updates and the latest version equals dismissedUpdateVersion, should the UpdateDialog re-present?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — manual always re-presents; startup respects dismissal (Recommended) | Asymmetric: dismissed = "don't nag on launch" not "pretend no update." | ✓ |
| Yes for both, but only when newer than dismissed | Same > comparison rule for both paths. | |
| Never — dismissedUpdateVersion suppresses both paths | Symmetric semantics. | |

**User's choice:** Yes — manual always re-presents; startup respects dismissal (Recommended).
**Notes:** Matches STATE.md §Open questions recommended interpretation. UPDFIX-02 wording requires this on Windows.

### Q2: If the user clicks Later from a manual-check-driven re-present, should that update dismissedUpdateVersion?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — always persist on Later, regardless of trigger (Recommended) | Trigger-agnostic write. Idempotent. | ✓ |
| No — manual-check Later is ephemeral (in-memory only) | Persistence only on startup-check Later clicks. | |

**User's choice:** Yes — always persist on Later, regardless of trigger (Recommended).
**Notes:** Simplest invariant; minimal-state philosophy.

### Q3: Should the windows-fallback variant share the same manual-check re-present semantics?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — identical semantics across variants (Recommended) | windows-fallback Later persists like auto-update's. Manual-check on Windows always re-presents. | ✓ |
| windows-fallback is sticky differently | Distinct semantics for manual-fallback path. | |

**User's choice:** Yes — identical semantics across variants (Recommended).
**Notes:** UPDFIX-02 explicitly demands this for Windows.

---

## Area 3 — UPDFIX-03 startup auto-check regression diagnosis

### Q1: What's the diagnostic approach for UPDFIX-03 (startup check not firing on either OS in shipped v1.1.1)?

| Option | Description | Selected |
|--------|-------------|----------|
| Add structured DevTools console logs at every step + reproduce locally with packaged dev build (Recommended) | Instrument initAutoUpdater entry/exit, setTimeout fire, checkForUpdates resolve/reject, autoUpdater event receipt. | ✓ |
| Defensive fix without diagnosis — assume Area 1 lift solves UPDFIX-03 too | Skip diagnosis; ship Area 1 fix; verify in Phase 15 rc round. | |
| Both — Area 1 lift PLUS instrumentation logs to confirm + future-proof | Ship Area 1 architectural fix AND add diagnostic console logs. | |

**User's choice:** Add structured DevTools console logs (Recommended).
**Notes:** Effectively combines with Area 1 lift; instrumentation rules out alternative root causes (initAutoUpdater never called / setTimeout not firing / autoUpdater rejecting silently).

### Q2: Which startup-check failure modes should planner explicitly instrument with console logs?

| Option | Description | Selected |
|--------|-------------|----------|
| initAutoUpdater entry + setTimeout fire | Single log line at entry + inside setTimeout callback. | (Other) |
| checkForUpdates resolve/reject + Promise.race timeout outcome | Distinguishes 'network rejected' from 'timeout' from 'success no update'. | (Other) |
| autoUpdater event handlers (update-available / update-not-available / update-downloaded / error) | Confirms which event electron-updater actually emits. | (Other) |
| deliverUpdateAvailable dismissed-version compare branch | Confirms D-08 suppression isn't accidentally swallowing the prompt. | (Other) |

**User's choice:** "You decide" — Claude's discretion.
**Notes:** Planner picks final shape and log message format; constraint: structured (parseable: `[auto-update] <event>: <key=value>...`), not free-form.

---

## Area 4 — Verification strategy

### Q1: How do we verify Phase 14 fixes work before Phase 15 publishes a real v1.1.2 rc?

| Option | Description | Selected |
|--------|-------------|----------|
| Locally with packaged dev build + the live v1.1.1 feed (Recommended) | Verify "You're up to date" + manual-check pre-load paths. update-available defers to Phase 15. | ✓ |
| Locally with packaged dev build BUMPED to 1.1.0 + the live v1.1.1 feed | Temporarily set package.json to 1.1.0 in non-committed build. Reproduce update-detection path. | |
| Defer ALL live verification to Phase 15 rc round; ship Phase 14 on code-review only | Static review + vitest only. | |
| Both option 1 + option 2 | Run BOTH local verifications. | |

**User's choice:** Locally with packaged dev build + the live v1.1.1 feed (Recommended).
**Notes:** Verifies "You're up to date" + manual-check pre-load (UPDFIX-04) + startup auto-check fires (UPDFIX-03). update-available path defers to Phase 15.

### Q2: Should Phase 14 add vitest coverage for the new IPC channel + lifted subscriptions?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — vitest for dismissal-semantics state machine + IPC subscription unit tests (Recommended) | tests/main/auto-update-dismissal.spec.ts + tests/renderer/app-update-subscriptions.spec.tsx. | ✓ |
| vitest only for the dismissal-semantics logic; manual UAT for the lift | Test deterministic part; UAT structural part. | |
| No — manual UAT only; new tests are scope creep for a hotfix | Phase 14 ships fast. | |

**User's choice:** Yes — vitest for dismissal-semantics state machine + IPC subscription unit tests (Recommended).
**Notes:** Locks regression gate. Existing `tests/main/auto-update*.spec.ts` (Phase 12) + `tests/renderer/app-shell-*.spec.tsx` are the precedent.

---

## Area 5 (implicit) — UPDFIX-02 Windows variant routing

### Q1: On Windows the notification "appears once with no Download button." What's Phase 14's investigation/fix scope for this?

| Option | Description | Selected |
|--------|-------------|----------|
| Investigate why no actionable button surfaces; fix windows-fallback Open Release Page reliably (Recommended) | Diagnose then fix; keep SPIKE_PASSED=false. | ✓ |
| Flip SPIKE_PASSED=true on win32 — enable auto-update path on Windows | Phase 12 D-02 spike has never run; rejected. | |
| Both: fix the missing-button bug AND flip SPIKE_PASSED=true | Combines a fix with an unverified architecture change. | |

**User's choice:** Investigate why no actionable button surfaces (Recommended).
**Notes:** Keep SPIKE_PASSED=false on win32 per Phase 12 D-02 strict-spike bar.

### Q2: Should Phase 14 also re-verify that "Open Release Page" actually opens GitHub Releases via SHELL_OPEN_EXTERNAL_ALLOWED?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — grep + log + manual-click verify the allow-list still passes the Releases-index URL (Recommended) | Cheap to verify. | ✓ |
| Skip — trust Phase 12 wired it correctly; focus on dialog state machine | Risk: planner spends time on dialog state machine when bug is allow-list. | |

**User's choice:** Yes — grep + log + manual-click verify (Recommended).

---

## Claude's Discretion

- Specific log points + log message format for D-10 instrumentation.
- Implementation shape of the asymmetric rule (thread trigger context vs suppress at checkUpdate entry).
- Test file naming and exact assertion list for D-15.
- update:request-pending payload shape (full vs slimmed).
- Whether main's sticky slot lives in `auto-update.ts` (module-level let) or `update-state.ts` (atomic JSON).

## Deferred Ideas

- Windows auto-update spike (Phase 12 D-02 strict-spike bar) — could revisit in Phase 15 rc round if Windows host available.
- Sticky slot persistence to disk — future v1.2 polish.
- Telemetry / Sentry / structured event reporting — still descoped.
- Phase 13.1 live UAT carry-forwards — separately tracked, NOT part of v1.1.2.
