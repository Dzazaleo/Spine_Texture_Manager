# Phase 14: Auto-update reliability fixes (renderer + state machine) - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix three live-observed regressions in the v1.1.1 auto-update lifecycle, scoped to the renderer subscription model + main-side state machine + dialog state machine + IPC channel surface. Code-only — **no `package.json` bump, no tag, no CI run, no GitHub Release publish.** Phase 15 owns the build/feed-shape fix (UPDFIX-01 macOS `.zip` artifact) AND the v1.1.2 release wave.

**In scope (this phase):**
- UPDFIX-02 — Windows UpdateDialog reliably surfaces a working actionable button (`Open Release Page` for windows-fallback variant per current `SPIKE_PASSED=false` policy) AND dismissed-version semantics work across startup vs manual checks per the asymmetric rule decided below.
- UPDFIX-03 — Cold-start auto-check fires on both macOS and Windows within ~3.5–5 s of `app.whenReady()`; UPD-05 silent-swallow contract preserved.
- UPDFIX-04 — Manual `Help → Check for Updates` returns visible feedback within ~10 s on macOS AND Windows BEFORE any project file is loaded.

**Out of scope (this phase, owned by Phase 15):**
- UPDFIX-01 macOS `ZIP file not provided` — root-cause is the build/feed shape (`.zip` artifact missing alongside `.dmg` per electron-updater 6.8.3 expectations), NOT the renderer or state machine.
- `package.json` 1.1.1 → 1.1.2 bump.
- Tag push, CI watch, Release publish.
- Flipping `SPIKE_PASSED=true` on win32 (Phase 12 D-02 strict-spike bar still un-met; the spike has never run live).

</domain>

<decisions>
## Implementation Decisions

### A. UPDFIX-04 fix architecture (renderer-subscription scope)

- **D-01 (root-cause confirmed during discuss-phase):** Manual `Help → Check for Updates` silence pre-load is **structural, not a timing race**. `App.tsx:303-340` mounts `<AppShell />` only when `state.status === 'loaded' || 'projectLoaded'`. The `update:*` IPC subscriptions live inside AppShell's useEffect at `src/renderer/src/components/AppShell.tsx:931-979`. In the `idle` state (no project loaded), AppShell is unmounted → zero subscribers to `update:available` / `update:none` / `update:error` → main fires events into the void. Same defect explains part of UPDFIX-03 (startup auto-check at 3.5 s fires before any project is loaded → no AppShell yet → event lost).

- **D-02:** **Lift the five `update:*` subscriptions from AppShell up to App.tsx.** The five are: `onUpdateAvailable`, `onUpdateDownloaded`, `onUpdateNone`, `onUpdateError`, `onMenuCheckForUpdates`. App.tsx renders unconditionally on every AppState branch (`idle` / `loading` / `loaded` / `projectLoaded` / `projectLoadFailed` / `error`), so subscriptions are live from first render. The `<UpdateDialog>` render itself moves to App.tsx as a sibling of `<DropZone>` and renders over whichever AppState branch is active. The `updateState` useState slot + `manualCheckPendingRef` move with the subscriptions. AppShell loses its update-related code entirely (cleaner — update concerns are app-global, not project-loaded-only).

- **D-03:** **Pending-event re-delivery on renderer mount** — add a new IPC channel `update:request-pending` (invoke). Main keeps a single sticky slot for the latest `update-available` payload (overwrites on newer version, clears on user dismiss / download trigger). Renderer calls `update:request-pending` once on mount in App.tsx's update-subscription useEffect; main returns the slot contents (or `null`). This handles the edge case where main fires `update-available` BEFORE the renderer's React effect commits (e.g., a 3.5 s startup check completing before React hydration finishes). `update:none` / `update:error` / `update:downloaded` are NOT buffered — they're ephemeral signals tied to a specific check; only `update:available` is sticky because it represents a persistent fact ("a newer version exists").

- **D-04:** **Manual Check for Updates from idle works identically to from a loaded project.** Same modal scaffold, same outcomes (Update available / You're up to date / Update check failed). The `<UpdateDialog>` mounts above `<DropZone>` in idle; React's z-50 overlay covers the "Drop a JSON file" message until the user dismisses. UPDFIX-04 wording explicitly requires this: "BEFORE any `.json` / `.stmproj` is loaded, ... feedback within ~10 s."

### B. UPDFIX-02 dismissal semantics (manual vs startup checks)

- **D-05:** **Asymmetric semantics — manual check ALWAYS re-presents; startup check respects `dismissedUpdateVersion`.** The dismissed slot is a "don't nag me on launch" signal, not "pretend no update exists." When the user explicitly clicks `Help → Check for Updates`, they expect to see the result regardless of past Later clicks. UPDFIX-02 wording requires this on Windows ("clicking Help → Check for Updates while a newer version is published re-presents"); applying the same rule cross-platform is cleaner than a per-OS branch.

- **D-06:** **`Later` click ALWAYS persists `dismissedUpdateVersion` regardless of trigger.** Trigger-agnostic write: every Later click overwrites the disk slot. A user who clicks Later from a manual-check-driven re-present will still get the prompt suppressed on the next startup (unless a strictly newer version is published). Idempotent if they re-dismiss the same version.

- **D-07:** **`windows-fallback` variant follows identical manual-vs-startup semantics.** Open Release Page button surfaces on every manual check; respects `dismissedUpdateVersion` only on startup. UPDFIX-02 explicitly demands this for Windows.

- **D-08 (implementation note for planner):** main's `deliverUpdateAvailable(info)` currently runs unconditionally for both startup and manual checks. To implement the asymmetric rule, main needs to know the trigger context at the point of variant routing. Options for the planner: (a) thread a `trigger: 'startup' | 'manual'` flag through `checkUpdate(triggeredManually)` → stash on a module-level `lastCheckTrigger` slot before `autoUpdater.checkForUpdates()` resolves → consume in `deliverUpdateAvailable`. (b) Skip the `dismissedUpdateVersion` suppression in `deliverUpdateAvailable` entirely; instead apply suppression ONLY in the 3.5 s startup-check entry point (early-return if `dismissed >= cached_latest_known`). Planner picks; both shapes preserve D-08 from Phase 12.

### C. UPDFIX-03 startup auto-check regression diagnosis

- **D-09:** **Diagnose by instrumentation, ship Area A architectural fix, accept that one of those two solves it.** Add structured DevTools `console.log` (or `console.info`) entries at key points in `src/main/auto-update.ts` so any future regression of the same shape is observable at first failure. D-06 (Phase 12) already permits console output; this is consistent with the silent-swallow contract (no telemetry, no error dialog). The Area A subscription lift may be sufficient on its own (event was always firing, just no subscriber); the instrumentation confirms or rules out alternative root causes (initAutoUpdater never called / setTimeout not firing / autoUpdater rejecting silently / dismissedUpdateVersion suppression branch hit).

- **D-10 (specific log points = planner discretion):** Suggested coverage — initAutoUpdater entry; setTimeout callback fire; checkForUpdates resolve/reject + Promise.race timeout outcome; each `autoUpdater.on(...)` event handler entry; `deliverUpdateAvailable` dismissed-version compare result + chosen variant. Planner picks final shape and log message format; constraint is "structured" (parseable: `[auto-update] <event>: <key=value>...`) not free-form.

### D. UPDFIX-02 Windows variant routing — investigation scope

- **D-11:** **Diagnose why no actionable button surfaces on Windows; fix the windows-fallback variant to render Open Release Page reliably.** Current code: `SPIKE_PASSED = process.platform !== 'win32'` at `src/main/auto-update.ts:92` → on Windows, variant resolves to `'windows-fallback'` → `UpdateDialog.tsx:210-227` renders Open Release Page + Later. If the dialog is rendering with no actionable button, candidate root causes: (a) variant prop not making it through IPC (default fallback to `'auto-update'` in AppShell at line 938), (b) dialog state machine race (mount + immediate unmount), (c) the `update:available` event never reaches the renderer (Area A defect), (d) external-URL allow-list rejecting the click silently.

- **D-12:** **Re-verify `SHELL_OPEN_EXTERNAL_ALLOWED` still contains the GitHub Releases index URL** (`https://github.com/Dzazaleo/Spine_Texture_Manager/releases`). Phase 12 D-18 added it; Phase 13 may have inadvertently broken something. Cheap verification: grep `src/main/ipc.ts` for the literal URL string. If absent, that's the smoking gun for "Open Release Page button does nothing." Phase 14 must NOT rely on the entry being there — explicit re-verification only.

- **D-13:** **Keep `SPIKE_PASSED=false` on win32.** Phase 12 D-02 strict-spike bar (detect + download + apply + relaunch) has never run live on Windows; flipping blind risks silent UPD-04 failure for Windows testers. The auto-update path on Windows stays disabled in v1.1.2; Phase 15's rc round may revisit if the user wants to attempt the spike.

### E. Verification strategy (no publish round in this phase)

- **D-14:** **Local packaged dev build + live v1.1.1 feed.** `npm run build:mac` produces a `1.1.1-arm64.dmg` you install locally on the macOS dev host; same for Windows if a host is available. Installed version equals latest published version → use this to verify: (a) startup auto-check fires within ~3.5 s of launch (DevTools console log shows `checkForUpdates` resolves with `update-not-available`), (b) Help → Check for Updates from idle state (no project loaded) surfaces "You're up to date" modal within ~10 s, (c) Phase 14's lifted-subscription architecture works end-to-end. The update-available + Download button + Open Release Page paths CANNOT be live-verified here (no newer published version) — those defer to Phase 15 rc round against a real v1.1.2-rc1 feed.

- **D-15:** **Vitest coverage for the dismissal-semantics state machine + IPC subscription unit tests.** Test files (planner picks names, suggested):
  - `tests/main/auto-update-dismissal.spec.ts` — asserts asymmetric rule (manual check re-presents even with `dismissedUpdateVersion === info.version`; startup check suppresses); asserts Later click persists regardless of trigger; asserts windows-fallback variant follows same rule.
  - `tests/renderer/app-update-subscriptions.spec.tsx` — renders App.tsx in idle state, asserts `update:*` subscription effects ran (mock `window.api.onUpdateAvailable` etc., assert listeners attached); asserts `<UpdateDialog>` mounts on `update:available` event regardless of AppState.
  - Existing `tests/main/auto-update.spec.ts` (Phase 12) gets extended for the new `update:request-pending` handler.

### F. Folded Todos

None — none of the pending todos in `.planning/todos/pending/` cross-reference this phase's surface (auto-update is a v1.1 distribution feature; the regressions surfaced post-v1.1.1 ship and are tracked via UPDFIX-01..04 only).

### G. Claude's Discretion (planner-level)

- Specific log points + log message format for D-10 instrumentation (constraint: structured, console-only).
- Implementation shape of the asymmetric rule from D-08 (option a thread-trigger vs option b suppress-at-entry).
- Test file naming and exact assertion list for D-15 (constraint: covers all four UPDFIX requirements at unit level + matches existing `tests/main/` and `tests/renderer/` conventions).
- Whether `update:request-pending` returns the full `update-available` payload shape OR a slimmed `{ version, summary, variant, fullReleaseUrl } | null` (planner picks).
- Whether main's sticky slot lives in `auto-update.ts` (module-level let-binding) or in `update-state.ts` (atomic JSON persistence) — for v1.1.2 hotfix scope, in-memory module state is likely sufficient (slot is rebuilt on every cold start anyway).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 contract (this phase)

- `.planning/REQUIREMENTS.md` — UPDFIX-02, UPDFIX-03, UPDFIX-04 wording (UPDFIX-01 is Phase 15's surface).
- `.planning/ROADMAP.md` §"Phase 14: Auto-update reliability fixes (renderer + state machine)" — Goal + 5 Success Criteria + the "Open questions" block in `.planning/STATE.md` (the renderer-subscription-race vs main-side-event-ordering hypothesis was answered during discuss-phase: subscription is structurally absent, not a timing race).
- `.planning/STATE.md` §"Open questions" — three Phase 14 open questions (now answered by D-01..D-08 in this CONTEXT).

### Phase 12 lineage (locked decisions Phase 14 must preserve)

- `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-CONTEXT.md` — D-04 (Windows-fallback variant routing), D-05 (hand-rolled ARIA UpdateDialog scaffold), D-06 (3.5 s startup check + 10 s timeout + silent-swallow on startup), D-07 (manual check always shows feedback), D-08 (`dismissedUpdateVersion` strict-`>` suppression on subsequent **startup** checks), D-09 (release-notes Summary extraction + plain-text `<pre>`), D-18 (`SHELL_OPEN_EXTERNAL_ALLOWED` Releases-index URL pattern).
- `.planning/milestones/v1.1-phases/12-auto-update-tester-install-docs/12-RESEARCH.md` — electron-updater 6.8.3 anti-patterns + the `getMainWindow().webContents.send` pattern lineage.

### Phase 12.1 + Phase 13 lineage (carry-forward awareness)

- `.planning/milestones/v1.1-phases/12.1-installer-auto-update-live-verification/12.1-VERIFICATION.md` — 4 carry-forwards to v1.1.1 (rc → rc auto-update lifecycle bug — channel-name dot-form fix in CLAUDE.md `## Release tag conventions` is the v1.1.1 fix).
- `CLAUDE.md` §"Release tag conventions" — the `v1.2.0-rc.1` ✅ vs `v1.2.0-rc1` ❌ contract; relevant to Phase 15 (Phase 14 doesn't tag).

### Phase 14 surface files (greenfield + edits)

- `src/main/auto-update.ts:1-405` — orchestrator + variant routing + dismissal compare. Phase 14 edits: (a) add `update:request-pending` handler, (b) add module-level sticky slot for latest update-available, (c) thread trigger context through to `deliverUpdateAvailable` OR move suppression to checkUpdate entry (D-08 implementation choice), (d) add structured console logs (D-09 + D-10), (e) re-verify SHELL_OPEN_EXTERNAL_ALLOWED Releases-index URL still allow-listed (D-12).
- `src/main/update-state.ts:1-179` — atomic JSON store. Phase 14 likely UNCHANGED (sticky slot stays in-memory for v1.1.2 hotfix per D-Discretion-2 above); included as a ref because dismissedUpdateVersion semantics are read/written here.
- `src/main/ipc.ts:667-700` — `update:check-now`, `update:download`, `update:dismiss`, `update:quit-and-install` channels. Phase 14 adds: `update:request-pending` (ipcMain.handle, returns `UpdateAvailablePayload | null`).
- `src/main/ipc.ts:113-140` §`SHELL_OPEN_EXTERNAL_ALLOWED` — verify the Releases-index URL is still present (D-12).
- `src/main/index.ts:407-483` — `app.whenReady().then(...)` block. Phase 14: confirm `initAutoUpdater()` at line 475 still fires; instrument with structured console log per D-10.
- `src/preload/index.ts:410-475` — preload bridge for `update:*` channels. Phase 14 adds: `requestPendingUpdate(): Promise<UpdateAvailablePayload | null>` IPC bridge.
- `src/renderer/src/App.tsx:295-392` — render tree. Phase 14: lift `update:*` subscriptions + `updateState` + `<UpdateDialog>` from AppShell to App.tsx. Renders `<UpdateDialog>` as sibling of `<DropZone>` so it surfaces over every AppState branch (`idle` / `loading` / `loaded` / `projectLoaded` / `projectLoadFailed` / `error`).
- `src/renderer/src/components/AppShell.tsx:160-181, 904-989` — current home of `updateState` + `manualCheckPendingRef` + 5-channel useEffect. Phase 14: REMOVE these from AppShell entirely (lifted to App.tsx per D-02).
- `src/renderer/src/modals/UpdateDialog.tsx:1-291` — modal scaffold. Phase 14 likely UNCHANGED (variant routing + button rendering are correct; the bug per UPDFIX-02 is upstream — variant prop never arrives or event never reaches renderer per D-11 hypothesis). If diagnosis (D-11 root-cause) reveals a renderer-side bug, fix here.

### Test conventions (existing patterns Phase 14 mirrors)

- `tests/main/auto-update.spec.ts` (Phase 12) — main-side unit-test pattern for autoUpdater event handling.
- `tests/renderer/app-shell-*.spec.tsx` — renderer-side React Testing Library pattern; Phase 14's `app-update-subscriptions.spec.tsx` mirrors this shape.
- `tests/integration/install-md.spec.ts` (Phase 12 Plan 06) — URL-consistency regression-gate pattern; reuse for SHELL_OPEN_EXTERNAL_ALLOWED Releases-index URL gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `<UpdateDialog>` modal at `src/renderer/src/modals/UpdateDialog.tsx` — fully built, Phase 14 keeps it as-is (state machine: 'available' / 'downloading' / 'downloaded' / 'none'; variants: 'auto-update' / 'windows-fallback'). Phase 14 only changes WHERE it's rendered from (App.tsx, not AppShell).
- `loadUpdateState()` / `setDismissedVersion()` at `src/main/update-state.ts` — atomic JSON persistence is fine; Phase 14 doesn't change the persistence layer.
- `compareSemver()` at `src/main/auto-update.ts:262-286` — Phase 14 reuses for the asymmetric rule (D-05) without modification.
- `extractSummary()` at `src/main/auto-update.ts:308-338` — Phase 14 unchanged.
- `getMainWindow()` + `sendToWindow(channel, payload)` pattern at `src/main/auto-update.ts:395-404` — Phase 14 reuses; possibly extends with `getPendingUpdateInfo()` accessor for the new `update:request-pending` handler.

### Established Patterns

- **IPC channel naming:** `update:<verb-or-noun>` (existing: `update:check-now`, `update:download`, `update:dismiss`, `update:quit-and-install`, `update:available`, `update:downloaded`, `update:none`, `update:error`). Phase 14 adds `update:request-pending` matching this convention.
- **Preload bridge wrapping:** Pitfall 9 listener-identity preservation (wrapped const captured BEFORE `ipcRenderer.on` so removeListener targets same reference). Phase 14's request-pending bridge doesn't need this (one-shot invoke, no subscription); just `ipcRenderer.invoke('update:request-pending')`.
- **Trust-boundary string guards:** `typeof version === 'string'` check at IPC entry point (e.g. `src/main/ipc.ts:688-694` `update:dismiss` handler). Phase 14's new handler returns a typed payload; no inbound string args, so guard not needed at that site.
- **Module-level state in main/:** `mainWindowRef` at `src/main/index.ts:74` is the precedent for module-scoped lazy refs. Phase 14's sticky-slot for `pendingUpdateInfo` follows this shape.

### Integration Points

- **App.tsx ↔ main IPC seam:** `window.api.onUpdateAvailable / onUpdateDownloaded / onUpdateNone / onUpdateError / onMenuCheckForUpdates / checkForUpdates` — already exposed via `src/preload/index.ts:410-475`. Phase 14 adds: `window.api.requestPendingUpdate()`. No new contextBridge surface beyond that one method.
- **AppState branch coverage:** App.tsx's six AppState branches (`idle` / `loading` / `loaded` / `projectLoaded` / `projectLoadFailed` / `error`) all render through the same `<DropZone>`. Phase 14's `<UpdateDialog>` mounts as a sibling overlay (z-50) and works on every branch.
- **Menu → renderer signal flow:** `Help → Check for Updates` fires `menu:check-for-updates-clicked` (one-way IPC) → renderer calls `window.api.checkForUpdates()` (invoke) → main's `update:check-now` handler invokes `checkUpdate(true)`. Phase 14 keeps this chain intact; the hop just moves from AppShell to App.tsx.

</code_context>

<specifics>
## Specific Ideas

- **The "appears once with no Download button" Windows symptom is most likely the Area A subscription-lift defect.** Hypothesis chain: user manually clicks Help → Check for Updates → main's `update:available` fires → AppShell IS mounted (user has loaded a project at some point during the session) → renderer mounts `<UpdateDialog variant='windows-fallback'>` → Open Release Page button renders. So far so good. User clicks Later → `dismissedUpdateVersion` writes. User clicks Help → Check for Updates AGAIN → main's `deliverUpdateAvailable` checks `dismissedUpdateVersion >= info.version` → suppresses (current Phase 12 D-08 strict-`>` semantics treats `>=` as suppress) → renderer never sees the event → "no Download button reappears". D-05 asymmetric rule fixes this exact UX path.

- **The "no Download button" wording in the bug report likely conflates Open Release Page with Download.** UpdateDialog's windows-fallback branch renders Open Release Page (primary, bg-accent) + Later. There's no "Download" label on Windows. The user-perceived bug is "the actionable button to get the update isn't there on the second check" — which is exactly D-05's asymmetric-rule fix.

- **macOS UPDFIX-04 silence pre-load is the SAME defect as UPDFIX-03 startup-check silence.** Both are "main fires update event, no AppShell mounted, event lost." Area A fix solves both. The roadmap and STATE.md treat them as separate issues but they share root cause.

- **DevTools console-only logging is the Phase 12 D-06 contract; Phase 14 stays inside it.** No telemetry, no Sentry, no log file. The diagnostic signal stays "open DevTools, observe console" — same posture as v1.1.1.

</specifics>

<deferred>
## Deferred Ideas

- **Windows auto-update spike (Phase 12 D-02 strict-spike bar).** Live verification of detect + download + apply + relaunch on unsigned NSIS .exe Windows. Has never run; Phase 14 keeps `SPIKE_PASSED=false`. Could be revisited in Phase 15 rc round if user has a Windows host available; otherwise carry to v1.2.
- **Sticky slot persistence to disk.** Phase 14 keeps the `update:request-pending` slot in-memory (module-level let-binding in `auto-update.ts`). A future v1.2 polish could persist across cold starts so the user sees the same dialog they saw last session if they didn't dismiss/download. Out of scope for hotfix.
- **Telemetry / structured event reporting (TEL-future).** Still descoped per REQUIREMENTS.md.
- **Sentry / crash reporting.** Still descoped.
- **Windows EV cert / Apple Developer ID.** Still descoped per v1.1 / v1.1.1 / v1.1.2 scope notes.
- **Phase 13.1 live UAT carry-forwards** (Linux runbook + libfuse2 PNG + macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation). Separately tracked, NOT part of v1.1.2.

### Reviewed Todos (not folded)

None — no pending todos in `.planning/todos/pending/` cross-reference Phase 14's surface (auto-update reliability is a fresh post-v1.1.1 surface; existing pending todos are v1.0/v1.1 lineage with separate dispositions).

</deferred>

---

*Phase: 14-auto-update-reliability-fixes-renderer-state-machine*
*Context gathered: 2026-04-29*
