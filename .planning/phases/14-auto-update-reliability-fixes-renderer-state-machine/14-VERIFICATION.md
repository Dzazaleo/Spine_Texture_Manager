---
phase: 14-auto-update-reliability-fixes-renderer-state-machine
verified: 2026-04-29T12:10:00Z
status: human_needed
score: 5/5 code-level truths verified; 5/5 ROADMAP success criteria require live OS testing
overrides_applied: 0
gaps:
  - truth: "Clicking 'Later' in UpdateDialog also clears the sticky pendingUpdateInfo slot (Plan 03 must-have truth #11)"
    status: failed
    reason: "Plan 03 frontmatter promised 'Clicking Later... AND clears the sticky slot via the new IPC (defense-in-depth)'. clearPendingUpdateInfo is exported, tested, and documented at src/main/auto-update.ts:111-115 as 'Cleared on user dismiss/download trigger (renderer drives via the existing update:dismiss IPC + Phase 14 Plan 03 download-click handler that calls clearPendingUpdateInfo())', but grep across src/ finds zero production callers. Cold-start path is unaffected (slot is in-memory only and rebuilt every launch per D-Discretion-2), so the user-visible regression is bounded to dev/HMR/StrictMode remount paths today — but the missing cleanup is a latent footgun once any in-session remount path lands."
    artifacts:
      - path: "src/renderer/src/App.tsx:546-554"
        issue: "onLater handler calls window.api.dismissUpdate(updateState.version) but does NOT invoke any clear-slot path"
      - path: "src/main/ipc.ts:684-700"
        issue: "update:download / update:dismiss handlers do not call clearPendingUpdateInfo before delegating"
      - path: "src/main/auto-update.ts:291-300"
        issue: "dismissUpdate persists dismissedUpdateVersion to disk but does NOT empty the in-memory pendingUpdateInfo slot"
    missing:
      - "Wire clearPendingUpdateInfo() into either the main-side update:dismiss / update:download handlers (Option A — preferred per REVIEW WR-01) OR call it internally at the top of dismissUpdate() / downloadUpdate() (Option B). Add a regression spec asserting getPendingUpdateInfo() === null after dismissUpdate('1.2.3')."
human_verification:
  - test: "macOS cold-start auto-check (UPDFIX-03 / ROADMAP SC-3 mac branch)"
    expected: "Within ~3-5s of `app.whenReady()` completing on a fresh dock-launch of a packaged v1.1.1 build, DevTools console emits `[auto-update] startup-check: setTimeout fired` followed by `[auto-update] checkUpdate: trigger=startup, version=1.1.1` and `[auto-update] event: update-available, version=...` (or update-not-available). When a newer published version exists, UpdateDialog auto-mounts; when not, no dialog (silent per UPD-05)."
    why_human: "Requires running a packaged macOS build against a real GitHub Releases feed; cannot be exercised in vitest jsdom. Phase 14 is code-only by design; live OS verification is the user's contract per ROADMAP success criteria 1-5."
  - test: "Windows cold-start auto-check (UPDFIX-03 / ROADMAP SC-3 win branch)"
    expected: "Same as the macOS cold-start case but on a Windows host; the [auto-update] structured log lines appear in DevTools, and when a newer published version exists, UpdateDialog auto-mounts with `variant='windows-fallback'` (since SPIKE_PASSED is `false` on win32 by default) showing the 'Open Release Page' button."
    why_human: "Requires running a packaged Windows build against a real GitHub Releases feed; the SPIKE_PASSED branch is platform-gated and cannot run under macOS-host vitest."
  - test: "macOS Help → Check for Updates from idle (UPDFIX-04 / ROADMAP SC-1)"
    expected: "Launch the packaged v1.1.1 macOS build, do NOT load any .json/.stmproj project, click Help → Check for Updates immediately. Within ~10s, UpdateDialog mounts with one of: 'Update available' (newer version published), 'You're up to date' (no newer version), or a graceful offline error. No silent void; no waiting on a project load."
    why_human: "Tests a UI flow + system menu interaction in idle state on a real OS — vitest can mount <App /> in idle but cannot click the OS-level Help menu. App.tsx subscription registration in idle state IS unit-tested (test 14-i in app-update-subscriptions.spec.tsx)."
  - test: "Windows Help → Check for Updates from idle (UPDFIX-04 / ROADMAP SC-2)"
    expected: "Same as the macOS Help → Check from-idle case but on a Windows host. Behavior should be identical (feedback within ~10s; no silent swallow; no project-load gate)."
    why_human: "Same rationale as the macOS variant — requires real OS menu + packaged-build integration."
  - test: "Windows manual re-check after Later dismissal (UPDFIX-02 / ROADMAP SC-5)"
    expected: "On a packaged Windows build with a newer version published: open UpdateDialog (cold-start auto-check or first manual check), click 'Later' (which persists dismissedUpdateVersion to update-state.json). Then click Help → Check for Updates AGAIN with the same newer version still published. UpdateDialog re-presents (D-05 asymmetric override for manual checks). Restart the app; the next cold-start auto-check should NOT re-present the same dismissed version (Phase 12 D-08 startup suppression preserved)."
    why_human: "End-to-end UAT requires real persistence + real autoUpdater event firing on a real Windows host. The asymmetric rule IS unit-tested (test 14-a in auto-update-dismissal.spec.ts), but the persistence-across-restart half requires a live build."
  - test: "Windows UpdateDialog Download / Open Release Page button visibility (UPDFIX-02 / ROADMAP SC-4)"
    expected: "On a packaged Windows v1.1.1 build with a newer version published, UpdateDialog opens deterministically with EITHER (a) a working 'Download' button when SPIKE_PASSED=true OR (b) a 'Open Release Page' button when SPIKE_PASSED=false. Clicking 'Open Release Page' opens https://github.com/Dzazaleo/Spine_Texture_Manager/releases in the system browser via shell.openExternal."
    why_human: "Variant routing IS unit-tested (test 14-e in auto-update-dismissal.spec.ts asserts payload variant tag); URL-allow-list consistency IS integration-tested (auto-update-shell-allow-list.spec.ts asserts byte-for-byte URL agreement at all 3 sites). But the actual 'button is visible AND clicking it opens the page' flow is a live-OS UAT step."
---

# Phase 14: Auto-update reliability fixes — Verification Report

**Phase Goal:** Restore reliable auto-update notification + check behavior on every cold start and on every manual `Help → Check for Updates` click on **both** macOS and Windows, regardless of whether a project file has been loaded yet, and ensure dismissing the notification does not permanently suppress it. Code-only phase touching the auto-update orchestrator + update-state persistence + UpdateDialog renderer + the IPC channels between them; no tag, no CI run, no publish (Phase 15 owns the live release surface).

**Verified:** 2026-04-29T12:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth (ROADMAP SC) | Status | Evidence |
| --- | ------------------ | ------ | -------- |
| 1   | macOS Help → Check from idle returns visible feedback within ~10s (UPDFIX-04) | ⚠️ CODE-WIRED, NEEDS HUMAN | App.tsx subscription useEffect runs unconditionally on every AppState branch (App.tsx:355-429); 5 onUpdate* + onMenuCheckForUpdates subscribers attach on first render in idle state (test 14-i in app-update-subscriptions.spec.tsx asserts; render(\<App />) in idle state registers all 5 subscriptions). Live macOS UAT required. |
| 2   | Windows Help → Check from idle behaves identically to macOS (UPDFIX-04) | ⚠️ CODE-WIRED, NEEDS HUMAN | Same code path as truth #1 (App.tsx is platform-agnostic); platform difference only at variant-routing tier (deliverUpdateAvailable). Live Windows UAT required. |
| 3   | Cold-start auto-check fires within ~3-5s on both macOS and Windows (UPDFIX-03) | ⚠️ CODE-WIRED, NEEDS HUMAN | initAutoUpdater schedules `setTimeout(..., STARTUP_CHECK_DELAY_MS=3500)` at auto-update.ts:199-202; checkUpdate(false) called inside; structured log `[auto-update] startup-check: setTimeout fired` + `[auto-update] checkUpdate: trigger=startup, ...` emitted. Renderer subscribers attached on App mount (App.tsx:355) BEFORE setTimeout fires AND requestPendingUpdate sticky-slot recovery covers the race window (App.tsx:410-420). Live OS UAT required. |
| 4   | Windows UpdateDialog opens with working Download or Open Release Page button (UPDFIX-02) | ⚠️ CODE-WIRED, NEEDS HUMAN | SPIKE_PASSED gate at auto-update.ts:104 sets `process.platform !== 'win32'` baseline; deliverUpdateAvailable at auto-update.ts:467-473 routes win32+!SPIKE_PASSED to 'windows-fallback'. App.tsx UpdateDialog mount at App.tsx:533-558 passes variant prop; onOpenReleasePage handler at App.tsx:555-557 calls window.api.openExternalUrl with the canonical Releases-index URL. URL-consistency integration spec (auto-update-shell-allow-list.spec.ts, 4/4 green) asserts byte-for-byte agreement across the 3 surfaces. Live Windows UAT required. |
| 5   | After Later dismissal, manual Help → Check re-presents the same version (UPDFIX-02) | ⚠️ CODE-WIRED, NEEDS HUMAN | deliverUpdateAvailable at auto-update.ts:445-493 reads `lastCheckTrigger` snapshot; `isManual` (trigger==='manual') skips the dismissedUpdateVersion suppression branch (asymmetric D-05 rule). Startup branch (trigger='startup'/null) preserves Phase 12 D-08 strict-> suppression verbatim. Tests 14-a / 14-b / 14-c in auto-update-dismissal.spec.ts cover all 3 cases (manual-override, startup-suppress, newer-version-fires). Live Windows UAT required for the persistence-across-restart half. |

**Score:** 5/5 truths code-wired; 5/5 truths require live OS UAT (per phase contract — code-only phase, Phase 15 owns live verification).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/main/auto-update.ts` | UpdateAvailablePayload type, pendingUpdateInfo + lastCheckTrigger module slots, getPendingUpdateInfo / clearPendingUpdateInfo exports, trigger-recording in checkUpdate, asymmetric suppression in deliverUpdateAvailable, sticky-slot write before sendToWindow, ≥6 console.info instrumentation points | ✓ VERIFIED | All 5 plan-frontmatter contains-checks pass; `grep -c console.info` returns 9 (target ≥6); typecheck clean |
| `src/main/ipc.ts` | update:request-pending handler registered via ipcMain.handle, dynamic-import pattern, calls getPendingUpdateInfo; SHELL_OPEN_EXTERNAL_ALLOWED still contains the Releases-index URL (D-12) | ✓ VERIFIED | Handler at ipc.ts:722-725 with verbatim plan shape; `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'` present at ipc.ts:174 (D-12 verified) |
| `src/preload/index.ts` | requestPendingUpdate one-shot invoke bridge; 4 existing one-shot + 5 existing subscription bridges byte-unchanged | ✓ VERIFIED | requestPendingUpdate at lines 434-439; checkForUpdates / downloadUpdate / dismissUpdate / quitAndInstallUpdate / 5 subscribers all preserved |
| `src/shared/types.ts` | Api interface entry for requestPendingUpdate (Rule 3 auto-fix) | ✓ VERIFIED | Inline payload type matches preload runtime block; typecheck clean across both tsconfigs |
| `src/renderer/src/App.tsx` | UpdateDialog import; updateState slot; manualCheckPendingRef; lifted 5-channel useEffect with requestPendingUpdate hydration; \<UpdateDialog\> JSX mount inside DropZone | ✓ VERIFIED | All 4 sub-artifacts present (lines 24, 80-101, 327-429, 533-558); \<UpdateDialog\> renders as sibling of 6 AppState branches |
| `src/renderer/src/components/AppShell.tsx` | UpdateDialog removed; updateState/manualCheckPendingRef removed; 5-channel useEffect collapsed to 1-channel (onMenuInstallationGuide); modalOpen derivation no longer references updateState.open | ✓ VERIFIED | `grep -c '<UpdateDialog' AppShell.tsx` = 0; `grep -c 'updateState' AppShell.tsx` = 0; `grep -c 'onMenuInstallationGuide' AppShell.tsx` = 1 (preserved) |
| `tests/main/auto-update-dismissal.spec.ts` | 11 assertions across 3 describe blocks (D-05 asymmetric, D-03 sticky slot, D-10 logging) | ✓ VERIFIED | File exists, 11/11 pass per `npx vitest run` |
| `tests/renderer/app-update-subscriptions.spec.tsx` | 7 assertions for App.tsx lift + late-mount hydration | ✓ VERIFIED | File exists, 7/7 pass per `npx vitest run` |
| `tests/integration/auto-update-shell-allow-list.spec.ts` | 4 assertions for URL consistency at App.tsx + ipc.ts + auto-update.ts | ✓ VERIFIED | File exists, 4/4 pass; byte-for-byte cross-check via regex extraction |
| `tests/preload/request-pending-update.spec.ts` | 7 assertions for the requestPendingUpdate preload bridge | ✓ VERIFIED | File exists, 7/7 pass |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| checkUpdate(triggeredManually) | lastCheckTrigger module slot | synchronous assignment BEFORE Promise.race | ✓ WIRED | auto-update.ts:223 `lastCheckTrigger = triggeredManually ? 'manual' : 'startup';` |
| deliverUpdateAvailable | lastCheckTrigger | snapshot at top; gates dismissedUpdateVersion compare | ✓ WIRED | auto-update.ts:452-453 `const triggerSnapshot = lastCheckTrigger; const isManual = triggerSnapshot === 'manual';` |
| deliverUpdateAvailable | pendingUpdateInfo | writes payload before sendToWindow | ✓ WIRED | auto-update.ts:485 `pendingUpdateInfo = payload;` immediately before sendToWindow |
| ipcMain.handle('update:request-pending') | getPendingUpdateInfo | dynamic import + return value | ✓ WIRED | ipc.ts:722-725 `const { getPendingUpdateInfo } = await import('./auto-update.js'); return getPendingUpdateInfo();` |
| window.api.requestPendingUpdate | ipcRenderer.invoke('update:request-pending') | single-line invoke wrapper | ✓ WIRED | preload/index.ts:439 |
| App.tsx update-subscription useEffect | window.api.onUpdateAvailable + onUpdateDownloaded + onUpdateNone + onUpdateError + onMenuCheckForUpdates | 5 unsubscribe-returning subscriber calls + cleanup | ✓ WIRED | App.tsx:357-405; cleanup function at lines 421-427 unsubscribes all 5 |
| App.tsx update-subscription useEffect | window.api.requestPendingUpdate | one-shot invoke after subscribers attach | ✓ WIRED | App.tsx:410-420; hydrates updateState if non-null |
| App.tsx render tree | \<UpdateDialog\> | rendered as sibling inside DropZone after the 6 branch blocks | ✓ WIRED | App.tsx:533-558 |
| App.tsx onMenuCheckForUpdates handler | manualCheckPendingRef.current = true; void window.api.checkForUpdates() | lifted verbatim from AppShell | ✓ WIRED | App.tsx:399-402 |
| App.tsx onLater handler | window.api.dismissUpdate(version) | direct call when state !== 'none' && version.length > 0 | ✓ WIRED | App.tsx:550-552 |
| App.tsx onOpenReleasePage | window.api.openExternalUrl('https://github.com/Dzazaleo/Spine_Texture_Manager/releases') | direct hardcoded literal | ✓ WIRED | App.tsx:555-557 (literal byte-equal to ipc.ts:174 + auto-update.ts:84-85) |
| **App.tsx onLater handler** | **window.api clear-slot path** | **defense-in-depth slot clear (Plan 03 must-have truth #11)** | **✗ NOT_WIRED** | **clearPendingUpdateInfo exported but no production caller in src/. See gap WR-01 below.** |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| App.tsx UpdateDialog mount | updateState.{open, state, version, summary, variant} | useState defaulted to {open:false, state:'available', ...}; populated by 5 IPC subscribers + requestPendingUpdate hydration | Yes — populated from autoUpdater event handlers via main-process IPC OR sticky slot | ✓ FLOWING |
| auto-update.ts deliverUpdateAvailable payload | UpdateAvailablePayload (version, summary, variant, fullReleaseUrl) | UpdateInfo from autoUpdater.on('update-available') + extractSummary + SPIKE_PASSED + GITHUB_RELEASES_INDEX_URL | Yes — real version from electron-updater feed; summary from electron-updater.releaseNotes | ✓ FLOWING |
| ipc.ts update:request-pending response | UpdateAvailablePayload \| null | getPendingUpdateInfo() reads pendingUpdateInfo module slot | Yes — slot populated by deliverUpdateAvailable on every delivered update:available event | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 14 spec suite | `npx vitest run tests/main/auto-update-dismissal.spec.ts tests/renderer/app-update-subscriptions.spec.tsx tests/integration/auto-update-shell-allow-list.spec.ts tests/preload/request-pending-update.spec.ts tests/main/auto-update.spec.ts tests/main/ipc.spec.ts` | 6 files / 73 tests passed in 525ms | ✓ PASS |
| Main + node typecheck | `npx tsc --noEmit -p tsconfig.json` | exit 0, no output | ✓ PASS |
| Renderer (web) typecheck | `npx tsc --noEmit -p tsconfig.web.json` | exit 0, no output | ✓ PASS |
| `console.info` instrumentation count | `grep -c console.info src/main/auto-update.ts` | 9 (target ≥6) | ✓ PASS |
| `[auto-update]` structured-log prefix count | `grep -c '\[auto-update\]' src/main/auto-update.ts` | 13 | ✓ PASS |
| D-12 SHELL allow-list verification | `grep -n "Spine_Texture_Manager/releases" src/main/ipc.ts` | line 174 present | ✓ PASS |
| AppShell update-code removal | `grep -c '<UpdateDialog' src/renderer/src/components/AppShell.tsx` | 0 | ✓ PASS |
| App.tsx UpdateDialog mount | `grep -c '<UpdateDialog' src/renderer/src/App.tsx` | 1 | ✓ PASS |
| Cold-start auto-check on packaged macOS build | manual launch + DevTools observation | not exercised — Phase 14 is code-only; Phase 15 owns live UAT | ? SKIP → human |
| Cold-start auto-check on packaged Windows build | manual launch + DevTools observation | not exercised — same rationale | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| UPDFIX-02 | 14-01, 14-03, 14-04, 14-05 | Windows: Download / Open Release Page button visible; dismissing does not permanently suppress; manual re-check re-presents | ✓ SATISFIED (code) / ? NEEDS HUMAN (live UAT) | Asymmetric dismissal rule wired (auto-update.ts:445-493); test 14-a..14-e cover all 5 main-side cases; URL-consistency gate covers Open Release Page CTA |
| UPDFIX-03 | 14-01, 14-02, 14-03, 14-04 | Cold-start auto-check fires automatically on both macOS and Windows | ✓ SATISFIED (code) / ? NEEDS HUMAN (live UAT) | initAutoUpdater 3.5s setTimeout (auto-update.ts:199-202); App.tsx subscriptions on every AppState branch; sticky-slot late-mount recovery (App.tsx:410-420); test 14-i + 14-j + 14-o |
| UPDFIX-04 | 14-02, 14-03, 14-04 | Manual Help → Check from idle (no project loaded) returns feedback within ~10s | ✓ SATISFIED (code) / ? NEEDS HUMAN (live UAT) | App.tsx is the always-mounted root; subscriptions register in idle state (test 14-i); manualCheckPendingRef ref pattern; menu-check chain (test 14-l) |

**Plan-declared coverage:** All 3 phase requirement IDs (UPDFIX-02, UPDFIX-03, UPDFIX-04) are claimed by at least one plan, AND each ID has automated test evidence in Plans 04-05 specs. No orphaned requirements detected (REQUIREMENTS.md maps UPDFIX-02/03/04 → Phase 14 exclusively; UPDFIX-01 is Phase 15).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/main/auto-update.ts | 311-325 | `clearPendingUpdateInfo` exported but no production caller in src/ | ⚠️ Warning | Dangling contract; documented as renderer-driven but Plan 03 never wired it. Latent risk for HMR/StrictMode/in-session remount; cold-start path unaffected. See gap below. |
| src/main/auto-update.ts | 131 | `lastCheckTrigger` is module-level let-binding; never reset to null after consumption | ℹ️ Info (REVIEW WR-02) | Theoretical risk if a future electron-updater bump fires out-of-band update-available events; no current trigger path. Phase 14 ships as-is; revisit in v1.2 polish. |
| src/main/auto-update.ts | 349-373 | `compareSemver` returns -1 on equal-numeric-tuple-different-string (e.g. dismissed='1.1.0', available='1.1.0-rc1') | ℹ️ Info (REVIEW IN-01) | Documented conservative bias; unreachable on production GitHub feed (only forward-streaming releases). Defer to swap-to-`semver` package in v1.2. |
| src/main/auto-update.ts | various | 9 console.info lines fire unconditionally in production builds (no `app.isPackaged` guard) | ℹ️ Info (REVIEW IN-02) | Intentional per Phase 14 D-10 instrumentation contract. Verbose but no PII / no security concern. Worth flagging for v1.2 polish. |
| src/renderer/src/App.tsx | 546-554 | `onLater` dual-gate `state !== 'none' && version.length > 0` is redundant in current state machine | ℹ️ Info (REVIEW WR-03) | Both branches converge today; future dialog-state additions could silently drift. Single normalized gate would be clearer. Phase 14 ships as-is. |

### Human Verification Required

**Six items require live OS testing on macOS and Windows packaged builds.** Phase 14 is explicitly code-only by ROADMAP contract; Phase 15 owns the live release wave and is the natural surface for these to land. Items 1-6 below correspond to ROADMAP Success Criteria 1-5 (with truth #4 split into two human checks because variant routing + URL-allow-list are independently observable):

#### 1. macOS cold-start auto-check (UPDFIX-03 / SC-3 mac)

**Test:** Launch a packaged v1.1.1 macOS build via dock click. Open DevTools (Cmd-Opt-I). Wait ~5s.
**Expected:** Console emits the structured log sequence: `[auto-update] initAutoUpdater: entry`, `[auto-update] startup-check: setTimeout fired`, `[auto-update] checkUpdate: trigger=startup, version=1.1.1`, `[auto-update] event: update-available, version=...` OR `[auto-update] event: update-not-available, currentVersion=1.1.1`. When a newer version is published, UpdateDialog auto-mounts. Network failures silently swallowed (no error dialog).
**Why human:** Requires running a packaged macOS build against a real GitHub Releases feed; vitest jsdom cannot exercise the autoUpdater 3.5s timer + IPC + DOM-presence end-to-end.

#### 2. Windows cold-start auto-check (UPDFIX-03 / SC-3 win)

**Test:** Same as item 1 but on a Windows host with a packaged v1.1.1 Windows build.
**Expected:** Same log sequence as item 1; UpdateDialog auto-mounts with `variant='windows-fallback'` (since `SPIKE_PASSED = process.platform !== 'win32'` is `false` on win32) showing the 'Open Release Page' button.
**Why human:** Platform-gated SPIKE_PASSED branch cannot be exercised on macOS-host vitest; requires real Windows host.

#### 3. macOS Help → Check from idle (UPDFIX-04 / SC-1)

**Test:** Launch packaged v1.1.1 macOS build. Do NOT load any .json/.stmproj project. Click `Help → Check for Updates` immediately.
**Expected:** Within ~10s, UpdateDialog mounts with one of: 'Update available' / 'You're up to date' / graceful offline error. App.tsx subscriptions register in idle state (verified by unit test 14-i).
**Why human:** UI flow + system menu interaction in idle state on a real OS — vitest cannot click the OS-level Help menu.

#### 4. Windows Help → Check from idle (UPDFIX-04 / SC-2)

**Test:** Same as item 3 but on a Windows host.
**Expected:** Identical behavior to macOS — feedback within ~10s; no silent swallow; no project-load gate.
**Why human:** Same rationale as item 3; requires real OS menu + packaged build integration.

#### 5. Windows manual re-check after Later dismissal (UPDFIX-02 / SC-5)

**Test:** Packaged Windows v1.1.1 build; ensure a newer version is published. Open UpdateDialog (cold-start auto-check or first manual check). Click 'Later' (persists `dismissedUpdateVersion` to update-state.json). Click `Help → Check for Updates` AGAIN with the same newer version still published.
**Expected:** UpdateDialog re-presents (D-05 asymmetric override for manual checks). Restart the app; the next cold-start auto-check should NOT re-present (D-08 startup suppression preserved). Asymmetric rule unit-tested (test 14-a) — but persistence-across-restart half is live-UAT only.
**Why human:** Real persistence + real autoUpdater event firing + real OS restart cycle.

#### 6. Windows UpdateDialog Download / Open Release Page button visibility (UPDFIX-02 / SC-4)

**Test:** Packaged Windows v1.1.1 build with a newer version published. UpdateDialog opens with EITHER (a) a working 'Download' button when SPIKE_PASSED=true OR (b) a 'Open Release Page' button when SPIKE_PASSED=false. Click 'Open Release Page'.
**Expected:** `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` opens in the system browser via shell.openExternal. URL-consistency unit-tested by integration spec; live click-through is human-only.
**Why human:** `shell.openExternal` is OS-mediated; requires real packaged build to invoke.

### Gaps Summary

**One Plan-frontmatter must-have failed:** Plan 03's truth #11 promised the onLater handler would "ALSO call a new clear-slot path" but Plan 03 never wired any production caller of `clearPendingUpdateInfo()`. The function is exported, documented, and unit-tested at `tests/main/auto-update.spec.ts:400-407` and `tests/main/auto-update-dismissal.spec.ts:315-322`, but `grep -rn "clearPendingUpdateInfo" src/` returns only the declaration and one comment.

**User-visible impact today:** Bounded to dev/HMR/StrictMode remount paths. The cold-start contract is unaffected because `pendingUpdateInfo` is in-memory only (rebuilt every launch per D-Discretion-2 in 14-CONTEXT.md). A user dismissing on production cold-start v1.1.2 will not see re-delivery on next launch unless the dismissedUpdateVersion semantics are also bypassed (which the asymmetric rule deliberately allows for manual re-checks — that's the desired UPDFIX-02 behavior, not a gap).

**Latent risk:** Once any in-session remount path lands (HMR in dev, a future "Reset session" affordance, React StrictMode dev cycle, a future test path that unmounts/remounts App.tsx), `requestPendingUpdate()` will re-deliver an already-dismissed payload because the slot was never emptied.

**Recommended fix (REVIEW WR-01 Option A — preferred):**

```ts
// src/main/ipc.ts — extend update:dismiss / update:download handlers.
ipcMain.handle('update:download', async () => {
  const { downloadUpdate, clearPendingUpdateInfo } = await import('./auto-update.js');
  clearPendingUpdateInfo();
  return downloadUpdate();
});
ipcMain.on('update:dismiss', (_evt, version) => {
  if (typeof version !== 'string' || version.length === 0) return;
  void (async () => {
    const { dismissUpdate, clearPendingUpdateInfo } = await import('./auto-update.js');
    clearPendingUpdateInfo();
    await dismissUpdate(version);
  })();
});
```

**Plus a regression test** in `tests/main/auto-update-dismissal.spec.ts`:

```ts
it('(14-t) clearPendingUpdateInfo is invoked when dismissUpdate runs', async () => {
  // ... set up sticky slot via update-available event ...
  await mod.dismissUpdate('1.2.3');
  expect(mod.getPendingUpdateInfo()).toBeNull();
});
```

**Decision rationale (per user prompt):** This gap is **not a v1.1.2 cold-start blocker** but **should be addressed before Phase 15 ships v1.1.2** so the dangling contract is closed BEFORE the live release surfaces it via any future remount path. The fix is ~10 LoC + 1 test; trivially small relative to Phase 15's UPDFIX-01 build/feed-shape work. Recommend: surface in Phase 15 plan as a prerequisite cleanup, OR open a small follow-up phase 14.1 if Phase 15's scope is locked.

**All ROADMAP success criteria are CODE-WIRED.** The 5 SC items in ROADMAP Phase 14 are observable at the code level (every line has an artifact + key link in the verification matrix above) AND have automated test coverage in the 18 new specs (auto-update-dismissal.spec.ts: 11 + app-update-subscriptions.spec.tsx: 7) plus the URL-consistency integration gate (4) plus the preload bridge spec (7) — totalling 29 new assertions for Phase 14 surfaces. Live OS UAT is a separate Phase 15 concern.

---

_Verified: 2026-04-29T12:10:00Z_
_Verifier: Claude (gsd-verifier)_
