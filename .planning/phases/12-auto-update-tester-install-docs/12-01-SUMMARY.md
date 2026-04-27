---
phase: 12-auto-update-tester-install-docs
plan: 01
subsystem: infra
tags: [electron-updater, auto-update, aria-modal, ipc, atomic-json-persistence, semver, github-releases]

# Dependency graph
requires:
  - phase: 12-auto-update-tester-install-docs
    provides: "Plan 12-02 — electron-updater@^6.8.3 runtime dep installed; electron-builder.yml publish: github so app-update.yml bakes into bundled resources/; release.yml 3-OS test matrix + per-platform latest*.yml feed publication wired into draft GitHub Releases"
provides:
  - "src/main/auto-update.ts orchestrator (initAutoUpdater, checkUpdate, downloadUpdate, quitAndInstallUpdate, dismissUpdate) wrapping electron-updater 6.8.3 with autoDownload=false / autoInstallOnAppQuit=false / allowPrerelease=true"
  - "src/main/update-state.ts atomic JSON persistence at app.getPath('userData')/update-state.json (D-08 dismissedUpdateVersion + spikeOutcome fields; .tmp + fs.rename Pattern B; recent.ts byte-for-byte template)"
  - "src/renderer/src/modals/UpdateDialog.tsx hand-rolled ARIA modal cloning HelpDialog scaffold (D-05); state machine available → downloading → downloaded; D-09 plain-text Summary extraction; D-04 windows-fallback variant rendering"
  - "5 new IPC channels: update:check-now (invoke), update:download (invoke), update:quit-and-install (invoke), update:dismiss (send), update:open-release-page (send); 4 main→renderer one-way sends: update:available, update:none, update:downloaded, update:error; menu:check-for-updates-clicked"
  - "Help → Check for Updates menu item (UPD-02) at src/main/index.ts beside existing Documentation item; Help submenu pattern preserved"
  - "Boot wiring: setTimeout(initAutoUpdater, 0) inside app.whenReady().then() AFTER applyMenu — orchestrator's internal 3.5s STARTUP_CHECK_DELAY_MS schedules the silent check (UPD-01)"
  - "GITHUB_RELEASES_INDEX_URL added to SHELL_OPEN_EXTERNAL_ALLOWED in src/main/ipc.ts (D-09 + D-18 option b — single stable allow-list entry, no per-tag pattern matching at trust boundary)"
  - "Windows-portability test fixes (51d12cb): tests/arch.spec.ts and tests/core/project-file.spec.ts cross-platform path-separator handling — D-22 matrix expansion surfaced these as pre-existing latent bugs"
  - "Manual-fallback variant ships LIVE on Windows by default (SPIKE_PASSED=process.platform!=='win32'); full auto-update path ships LIVE on macOS/Linux"
affects: [12-1, 12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "electron-updater opt-in lifecycle: autoDownload=false + autoInstallOnAppQuit=false + autoUpdater.on('update-available' | 'update-downloaded' | 'update-not-available' | 'error') bridged to renderer via getMainWindow().webContents.send (mirrors src/main/ipc.ts:511 export:progress)"
    - "Promise.race([checkForUpdates(), timeout(10s)]) bounded-network-wait pattern; mode-aware error handling (manual mode → IPC bridge; startup mode → silent-swallow per UPD-05)"
    - "setTimeout(quitAndInstall, 0) deferral so IPC ack returns to renderer before app exits — Pattern H idiom (src/main/index.ts:131-137 project:confirm-quit-proceed precedent)"
    - "D-08 strict-> semver suppression: compareSemver strips pre-release/build suffix for numeric tuple compare; falls through to exact-string equality check; conservative bias on suffix-only mismatch (any string mismatch with equal numeric tuple resolves as 'available is newer')"
    - "Per-platform variant routing under one cohesive code surface (D-04): Windows branch chooses auto-update OR windows-fallback at runtime based on (build-time SPIKE_PASSED constant) || (runtime spikeOutcome === 'pass' read from update-state.json) — flipping branches is a config change, not a refactor"
    - "ARIA modal state machine in UpdateDialog: state ∈ { available, downloading, downloaded, none } drives button enablement; variant ∈ { auto-update, windows-fallback } drives layout (modal vs notice + Open Release Page button)"

key-files:
  created:
    - "src/main/auto-update.ts (electron-updater orchestrator, ~405 lines)"
    - "src/main/update-state.ts (atomic JSON persistence)"
    - "src/renderer/src/modals/UpdateDialog.tsx (ARIA modal + windows-fallback variant)"
    - "tests/main/auto-update.spec.ts (mocked electron-updater event-to-IPC bridge tests)"
    - "tests/main/update-state.spec.ts (atomic-write + validate-version-FIRST + silent-swallow tests)"
    - "tests/renderer/update-dialog.spec.tsx (ARIA scaffold + state machine + button-callback tests)"
    - ".planning/phases/12-auto-update-tester-install-docs/12-01-SUMMARY.md (this file)"
  modified:
    - "src/main/index.ts (boot init wiring + Help → Check for Updates menu item)"
    - "src/main/ipc.ts (5 new IPC handlers + GITHUB_RELEASES_INDEX_URL added to SHELL_OPEN_EXTERNAL_ALLOWED)"
    - "src/preload/index.ts (preload bridges for update:* IPC channels)"
    - "src/preload/index.d.ts (window.api type augmentations)"
    - "src/renderer/src/components/AppShell.tsx (subscribes to onUpdate* events; mounts UpdateDialog)"
    - "src/shared/types.ts (UpdateInfo IPC payload types)"
    - "tests/arch.spec.ts (Windows-portability fix — path-separator handling)"
    - "tests/core/project-file.spec.ts (Windows-portability fix — path-separator handling)"
    - ".planning/phases/12-auto-update-tester-install-docs/12-RESEARCH.md (appended SPIKE OUTCOME block per runbook contract)"
    - ".planning/phases/12-auto-update-tester-install-docs/deferred-items.md (added 'CI tag-push will fail until electron-builder auto-publish race is resolved' entry)"

key-decisions:
  - "Spike DEFERRED to phase 12.1 — not run; ship the manual-fallback variant by default on Windows (SPIKE_PASSED=process.platform!=='win32'). Decision made by user with full context after 3 live CI runs on 2026-04-27 (25017095851 / 25017351602 / 25017624868) all failed at the electron-builder publish race; spike runbook step 5 (install rc2 on Windows) never reached"
  - "Both Windows branches (auto-update + windows-fallback) ship together under one cohesive code surface per D-04. Flipping branches in 12.1 (after the spike runs for real) is a one-line constant change in src/main/auto-update.ts, not a refactor"
  - "compareSemver strips pre-release/build suffix and biases conservatively on suffix-only mismatch — false positives (extra prompt) preferred over false negatives (missed prompt for newer version) per D-08 strict-> reading"
  - "GITHUB_RELEASES_INDEX_URL (Releases index page, not per-tag) added as single entry in SHELL_OPEN_EXTERNAL_ALLOWED — D-18 option (b) avoids regex at the trust boundary; user lands one click away from the specific release"
  - "Windows-portability test fixes (51d12cb) kept post-cleanup — these are real bugs surfaced by Plan 12-02's D-22 matrix expansion; arch.spec carve-out was added by this plan's Task 4 with a Windows path-separator bug"
  - "v1.1.0-rc2 tag/release/version-bump cleanup (44bd03b) — rc2 was a one-shot spike attempt that never produced a complete artifact set; reverted package.json to 1.1.0-rc1 + deleted polluted rc2 release + reverted GH_TOKEN env additions on the 3 build jobs"

patterns-established:
  - "Pattern: electron-updater opt-in orchestrator behind a single src/main/auto-update.ts module — main is sole source of truth; renderer subscribes via existing one-way IPC sends; never imports electron-updater"
  - "Pattern: per-platform variant routing under one cohesive code surface — both branches always implemented, runtime constant (build-time + runtime override) selects which one is exercised per platform. Reusable shape for any future feature with platform-conditional UX"
  - "Pattern: bounded-network-wait via Promise.race + setTimeout(reject, 10_000) — UPD-05 silent-swallow on startup; IPC bridge to renderer on manual mode. Reusable for any future external network call from main"
  - "Pattern: atomic JSON persistence (src/main/update-state.ts) cloning recent.ts byte-for-byte — validate-version-FIRST + .tmp + fs.rename + silent-swallow on read failure. Reusable for any future user-data settings file"

requirements-completed: [UPD-01, UPD-02, UPD-03, UPD-04, UPD-05]

# Metrics
duration: ~3h (Tasks 1-5 TDD across earlier session; close-out 2026-04-27)
completed: 2026-04-27
---

# Phase 12 Plan 01: Auto-update wiring (electron-updater orchestrator + ARIA modal + Windows manual-fallback) Summary

**electron-updater 6.8.3 wired into main with opt-in autoDownload/autoInstallOnAppQuit, 3.5s startup check + 10s timeout, hand-rolled ARIA UpdateDialog modal cloning HelpDialog scaffold, dedicated atomic JSON dismissedUpdateVersion store, Help → Check for Updates menu item, and BOTH Windows branches (auto-update + manual-fallback) shipping live under one cohesive code surface — manual-fallback variant ships by default on Windows; full auto-update path ships live on macOS/Linux; live UPD-06 spike runbook DEFERRED to phase 12.1 after CI publish-race surfaced.**

## Performance

- **Duration:** ~3h (Tasks 1-5 TDD execution across earlier session; close-out + cleanup + SUMMARY ~30min on 2026-04-27)
- **Started:** 2026-04-27 (Tasks 1-5 commits f208478..09f9369)
- **Completed:** 2026-04-27T21:37:35Z (this SUMMARY)
- **Tasks:** 5 of 6 complete (Task 6 spike deferred to phase 12.1)
- **Files created:** 7
- **Files modified:** 10

## Accomplishments

- **UPD-01 silent startup check** — `setTimeout(checkUpdate(false), 3500)` scheduled inside `initAutoUpdater()`; runs 3.5s after `app.whenReady()` resolves; 10s `Promise.race` timeout bounds the network wait; on rejection/timeout: silent-swallow (no error dialog, no crash, no nag — UPD-05).
- **UPD-02 manual check** — Help → Check for Updates menu item routes through `menu:check-for-updates-clicked` (main→renderer one-way) → renderer invokes `update:check-now` → `checkUpdate(true)`. Manual mode bridges errors to `update:error` IPC; renderer shows result either way (UpdateDialog OR "You're up to date" via the `update:none` send).
- **UPD-03 opt-in download** — `autoDownload=false` ensures the `Download + Restart` button click is the trigger. Download streams via `autoUpdater.downloadUpdate()` → `update-downloaded` event → renderer transitions UpdateDialog `state` from `available` → `downloaded`.
- **UPD-04 restart-or-Later** — `Restart` button invokes `update:quit-and-install` → `setTimeout(quitAndInstall(false, true), 0)` (Pattern H deferral so IPC ack returns first). `Later` button sends `update:dismiss` with the available version → atomic write to `update-state.json` `dismissedUpdateVersion`. D-08 strict-`>` semver compare in `deliverUpdateAvailable` suppresses re-prompts for the same/older version; a NEWER version re-fires the prompt.
- **UPD-05 offline graceful** — silent-swallow rule applied in startup mode at the orchestrator's `checkUpdate` try/catch + at `autoUpdater.on('error')` (logs to DevTools console only; no IPC, no dialog, no crash). Verified by the test suite's mocked offline scenario.
- **UPD-06 Windows-fallback variant** — `process.platform === 'win32' && !SPIKE_PASSED && !spikeRuntimePass` branch routes `update:available` payload's `variant` field to `'windows-fallback'`. UpdateDialog renders the manual-notice variant: version label + button that opens `GITHUB_RELEASES_INDEX_URL` externally via `window.api.openExternalUrl()` (allow-list defense at the trust boundary). Live behavior on Windows tester installs: when a newer release exists in the GitHub feed, the manual-fallback notice opens — satisfies UPD-06's contracted "manual update path: notify of new release, link to download page."
- **D-04 cohesive code surface** — both Windows branches (auto-update + windows-fallback) implemented together under `src/main/auto-update.ts` + `src/renderer/src/modals/UpdateDialog.tsx`; the spike outcome is a runtime branch (a one-line constant flip in 12.1, NOT a refactor).
- **D-09 plain-text release notes** — `extractSummary()` locates `## Summary` (case-insensitive) in `electron-updater`'s `releaseNotes` and strips HTML tags; rendered into a `<pre>` block (NO `dangerouslySetInnerHTML`, NO markdown rendering — HelpDialog precedent: zero XSS surface). "View full release notes" link opens `GITHUB_RELEASES_INDEX_URL` externally.
- **5 + 4 + 1 IPC channels** wired through preload bridges with type augmentations in `src/preload/index.d.ts` and `src/shared/types.ts`. No new external trust-boundary surface beyond the single `GITHUB_RELEASES_INDEX_URL` allow-list entry.
- **Windows-portability test fixes** — `tests/arch.spec.ts` and `tests/core/project-file.spec.ts` made cross-platform (path-separator handling). D-22 matrix expansion in Plan 12-02 surfaced these as pre-existing latent bugs that survived under macOS/Linux only.

## Task Commits

Each task was committed atomically per the plan's TDD contract (RED → GREEN per code-producing task):

### Tasks 1-5 (auto-update implementation, TDD)

1. **Task 1 RED: failing tests for update-state.ts atomic persistence** — `f208478` (test)
2. **Task 1 GREEN: implement update-state.ts atomic JSON persistence (D-08)** — `6566cb4` (feat)
3. **Task 2 RED: failing tests for auto-update.ts orchestrator** — `b92f1a1` (test)
4. **Task 2 GREEN: implement auto-update.ts orchestrator (UPD-01..UPD-06)** — `de974fb` (feat)
5. **Task 3 RED: failing tests for UpdateDialog ARIA modal** — `7dce8b6` (test)
6. **Task 3 GREEN: implement UpdateDialog ARIA modal (D-05 + D-09 + D-04)** — `0f4047f` (feat)
7. **Task 4: wire IPC channels + preload bridges + allow-list URL** — `1d9cf73` (feat)
8. **Task 5: wire boot init + Help menu + AppShell update subscriptions** — `09f9369` (feat)

### Post-Tasks-1-5 follow-ups (during deferred spike-attempt window)

9. **Make arch + project-file tests Windows-portable (D-22 matrix surfaced)** — `51d12cb` (fix) — real Windows bugs surfaced once the 3-OS matrix from Plan 12-02 ran; arch.spec carve-out came from this plan's Task 4, so the fix belongs here.
10. **Defer Windows-spike to 12.1; revert GH_TOKEN env + rc2 bump** — `44bd03b` (chore) — cleanup of the partial spike attempt: reverted `package.json` 1.1.0-rc2 → 1.1.0-rc1, deleted polluted v1.1.0-rc2 GitHub release + tag (local + origin), reverted `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` env additions on build-mac/build-win/build-linux jobs in `.github/workflows/release.yml`. Updated `deferred-items.md` with the full "CI tag-push will fail" entry explaining root cause and 12.1 disposition.

### Spike outcome record

11. **Record spike outcome as DEFERRED to phase 12.1** — `f31d494` (docs) — appended SPIKE OUTCOME block to `12-RESEARCH.md` §"Output of the spike" per the runbook contract:

    ```
    SPIKE OUTCOME (UPD-06 / D-01):
    - Result: DEFERRED to phase 12.1
    - Windows branch: manual fallback (D-03 variant active by default; SPIKE_PASSED=false on win32)
    - Evidence: 3 live CI runs on 2026-04-27 (25017095851 / 25017351602 / 25017624868) all failed at electron-builder publish race; spike runbook step 5 (install rc2 on Windows) never reached. See deferred-items.md "CI tag-push will fail..." entry for root cause and 12.1 disposition.
    - Date: 2026-04-27
    ```

**Plan metadata:** _final docs commit (this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md updates) lands as the closing commit for plan 12-01._

## Files Created/Modified

### Created (7)

- `src/main/auto-update.ts` — electron-updater orchestrator (~405 lines). Owns init, checkUpdate, downloadUpdate, quitAndInstallUpdate, dismissUpdate, sendToWindow, deliverUpdateAvailable, compareSemver, extractSummary. Layer 3 invariant: lives in `src/main/`, freely imports electron + electron-updater, NEVER imports from src/core or src/renderer.
- `src/main/update-state.ts` — atomic JSON persistence at `app.getPath('userData')/update-state.json`. Schema: `UpdateStateV1 = { version: 1; dismissedUpdateVersion: string | null; spikeOutcome: 'unknown' | 'pass' | 'fail' }`. Pattern B atomic write (.tmp + fs.rename); validate-version-FIRST + silent-swallow on read failure. recent.ts byte-for-byte template.
- `src/renderer/src/modals/UpdateDialog.tsx` — hand-rolled ARIA modal (role="dialog", aria-modal="true", focus trap, outer-overlay onClick = close, inner content stops propagation). State machine: available → downloading → downloaded; variant: auto-update (modal) | windows-fallback (notice with "Open Release Page" button → openExternalUrl(GITHUB_RELEASES_INDEX_URL)).
- `tests/main/auto-update.spec.ts` — mocked electron-updater event-to-IPC bridge tests; 10s timeout assertions; D-08 suppression behavior; manual-vs-startup mode error routing; D-04 variant routing on platform=win32 + SPIKE_PASSED=false.
- `tests/main/update-state.spec.ts` — atomic-write + validate-version-FIRST + silent-swallow tests; mirrors recent.spec.ts shape.
- `tests/renderer/update-dialog.spec.tsx` — ARIA scaffold tests + state machine tests + button-callback tests; covers both auto-update and windows-fallback variants.
- `.planning/phases/12-auto-update-tester-install-docs/12-01-SUMMARY.md` — this file.

### Modified (10)

- `src/main/index.ts` — boot wiring: `setTimeout(initAutoUpdater, 0)` inside `app.whenReady().then()` AFTER `applyMenu`. Help → Check for Updates menu item beside existing Documentation item; sends `menu:check-for-updates-clicked` one-way to renderer.
- `src/main/ipc.ts` — 5 new IPC handlers (`update:check-now` / `update:download` / `update:quit-and-install` / `update:dismiss` / `update:open-release-page`); `GITHUB_RELEASES_INDEX_URL` (`https://github.com/Dzazaleo/Spine_Texture_Manager/releases`) added to `SHELL_OPEN_EXTERNAL_ALLOWED` Set.
- `src/preload/index.ts` — preload bridges: `checkForUpdates()`, `downloadUpdate()`, `quitAndInstallUpdate()`, `dismissUpdate(version)`, `openReleasePage()`, `onUpdateAvailable(cb)`, `onUpdateNone(cb)`, `onUpdateDownloaded(cb)`, `onUpdateError(cb)`, `onMenuCheckForUpdates(cb)`.
- `src/preload/index.d.ts` — window.api type augmentations matching the bridges above.
- `src/renderer/src/components/AppShell.tsx` — subscribes to `onUpdate*` events; mounts `UpdateDialog`; `onMenuCheckForUpdates` handler invokes `window.api.checkForUpdates()`.
- `src/shared/types.ts` — `UpdateAvailablePayload` / `UpdateDownloadedPayload` / `UpdateErrorPayload` / `UpdateNonePayload` IPC types.
- `tests/arch.spec.ts` — Windows-portability fix (cross-platform path-separator handling). The arch.spec carve-out was added by this plan's Task 4; D-22 matrix expansion in Plan 12-02 surfaced the latent Windows bug.
- `tests/core/project-file.spec.ts` — Windows-portability fix (cross-platform path-separator handling).
- `.planning/phases/12-auto-update-tester-install-docs/12-RESEARCH.md` — appended SPIKE OUTCOME block per the runbook contract (records DEFERRED disposition + evidence + date).
- `.planning/phases/12-auto-update-tester-install-docs/deferred-items.md` — added "CI tag-push will fail until electron-builder auto-publish race is resolved (deferred to phase 12.1)" entry with full root cause, two failure modes observed, fix-architecture options for 12.1, and post-attempt cleanup list.

## Decisions Made

- **Spike DEFERRED to phase 12.1, not run.** User decided with full context after 3 live CI runs on 2026-04-27 (25017095851 / 25017351602 / 25017624868) all failed at the electron-builder publish race; spike runbook step 5 (install rc2 on Windows) was never reached. Resolution: ship the manual-fallback variant by default on Windows. The full auto-update path remains pre-wired and live-on-macOS/Linux; phase 12.1 will pick a publish-race fix architecture, validate locally, run a fresh tag-push CI, then execute the spike runbook for real.
- **Manual-fallback variant ships LIVE on Windows by default.** `SPIKE_PASSED = process.platform !== 'win32'` in `src/main/auto-update.ts` line 92 — left at default. Windows installed builds will check the GitHub feed; if a newer release exists, the manual-fallback notice opens (D-03) — satisfies UPD-06's contracted behavior, NOT a workaround.
- **Both Windows branches under one cohesive code surface (D-04).** Flipping the Windows branch from manual-fallback to auto-update in 12.1 (post-spike) is a one-line constant change in `src/main/auto-update.ts`, not a refactor. The `update-state.json` `spikeOutcome` field also allows runtime promotion via a settings file edit (useful for tester rounds).
- **D-08 strict-`>` semver suppression with conservative bias on suffix mismatch.** `compareSemver` strips pre-release/build suffix for the numeric tuple compare, then falls through to exact-string equality; any suffix-only mismatch with equal numeric tuple resolves as "available is newer" so we re-fire the prompt. False positives (extra prompt) preferred over false negatives (missed prompt for newer version).
- **GITHUB_RELEASES_INDEX_URL = single allow-list entry (D-18 option b).** Releases index page (`https://github.com/Dzazaleo/Spine_Texture_Manager/releases`) added as a single `SHELL_OPEN_EXTERNAL_ALLOWED` entry instead of per-tag URL pattern matching. Avoids regex at the trust boundary; user lands one click away from the specific release.
- **Windows-portability test fixes kept post-cleanup (51d12cb).** These are real bugs surfaced by Plan 12-02's D-22 matrix expansion (the arch.spec carve-out was added by this plan's Task 4 with a Windows path-separator bug). Belong with Plan 12-01 because Plan 12-01 introduced the carve-out.
- **rc2 cleanup kept post-revert (44bd03b).** v1.1.0-rc2 tag/release/version-bump were a one-shot spike attempt that never produced a complete artifact set. Reverting `package.json` to 1.1.0-rc1 + deleting the polluted v1.1.0-rc2 GitHub release + reverting `GH_TOKEN` env additions on the 3 build jobs leaves main in a clean, publishable state. v1.1.0-rc1 (Phase 11) remains the publishable artifact.

## Deviations from Plan

### Structural deviation — Task 6 spike DEFERRED, not executed

**1. [Architectural escalation, user-decided] Task 6 (BLOCKING SPIKE) deferred to phase 12.1**
- **Found during:** Task 6 spike execution attempt (3 CI runs on 2026-04-27)
- **Issue:** With `electron-builder.yml publish: github` (Plan 12-02 D-11/D-12 wiring) + `--publish never` on the CLI (Plan 11 D-01 belt-and-braces), electron-builder 26.x's per-artifact `PublishManager.artifactCreatedWithoutExplicitPublishConfig` still constructs publishers and uploads individual artifacts during the parallel build jobs. Two failure modes observed across the 3 attempts: (a) no `GH_TOKEN` in build env → publisher constructor throws "GitHub Personal Access Token is not set" before any artifact is built; (b) `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` provided → publisher constructor succeeds but auto-uploads race against the atomic `softprops/action-gh-release` publish step, hitting HTTP 422 from GitHub on asset name conflict.
- **Fix:** DEFERRED to phase 12.1 per user decision. Cleanup performed: deleted polluted v1.1.0-rc2 release + tag (local + origin), reverted `package.json` to 1.1.0-rc1, reverted `GH_TOKEN` env additions on the 3 build jobs. Manual-fallback variant ships LIVE on Windows by default (SPIKE_PASSED=false on win32) — this is the contracted UPD-06 fallback behavior, not a workaround.
- **Files modified:** `package.json` (rc2 → rc1 revert), `.github/workflows/release.yml` (GH_TOKEN env reverted on build-mac/build-win/build-linux), `.planning/phases/12-auto-update-tester-install-docs/deferred-items.md` (full "CI tag-push will fail" entry added)
- **Verification:** 377/377 vitest passing post-cleanup; `git status` clean; v1.1.0-rc1 (Phase 11) remains the publishable artifact set
- **Committed in:** `44bd03b` (chore — defer Windows-spike to 12.1; revert GH_TOKEN env + rc2 bump) + `f31d494` (docs — record spike outcome as DEFERRED to phase 12.1)

### Auto-fixed Issues (during normal Tasks 1-5 execution)

**2. [Rule 1 - Bug] Windows path-separator bugs in arch + project-file tests (surfaced post-Tasks-1-5 by 12-02 matrix)**
- **Found during:** Plan 12-02's D-22 3-OS matrix expansion CI run (after Tasks 1-5 landed)
- **Issue:** `tests/arch.spec.ts` carve-out (added by this plan's Task 4 to allow `src/main/auto-update.ts` to import from `electron-updater`) was hardcoded to POSIX path separators; failed on Windows runner. `tests/core/project-file.spec.ts` had a related path-separator handling bug.
- **Fix:** Made both tests cross-platform — use `path.sep`/`path.posix.normalize` semantics or normalize-to-posix at compare time.
- **Files modified:** `tests/arch.spec.ts`, `tests/core/project-file.spec.ts`
- **Verification:** Both tests now pass on macOS locally (377/377 vitest); Windows verification deferred to next CI tag-push (12.1).
- **Committed in:** `51d12cb` (fix — make arch + project-file tests Windows-portable)

---

**Total deviations:** 1 architectural escalation (user-decided spike defer) + 1 auto-fixed Windows-portability bug.
**Impact on plan:** All 5 code-producing tasks (1-5) executed exactly as planned with TDD discipline preserved. Task 6 (the user-supervised spike) was attempted but deferred to phase 12.1 due to a previously-undetected electron-builder 26.x publish-race that requires architectural choice. Both Windows branches (auto-update + windows-fallback) ship together under one cohesive code surface per D-04 — flipping branches in 12.1 is a one-line constant change, not a refactor. Manual-fallback variant ships LIVE on Windows by default (the contracted UPD-06 fallback behavior).

## Issues Encountered

- **electron-builder 26.x publish race surfaced during spike attempt.** `--publish never` on the CLI does NOT prevent per-artifact GitHub publisher construction + upload when `publish: github` is in YAML. Two failure modes observed across 3 CI runs on 2026-04-27 (no-token publisher-constructor throw; with-token race-condition HTTP 422 on parallel uploads). Root cause + fix-architecture options documented in `deferred-items.md`. **Resolution:** spike deferred to phase 12.1; manual-fallback variant ships live on Windows by default (already wired per D-04 cohesive code surface).
- **Pre-existing typecheck failure in `scripts/probe-per-anim.ts` (carried from Phase 11).** Survives `git stash` of plan-12 changes; identical to Phase 11 deferred-items entry. Out of scope per SCOPE BOUNDARY rule. Logged in `deferred-items.md` (carried over from Plan 12-02). The `npm run test` (vitest) suite — the actual correctness gate enforced by CI — passes 377/377.

## User Setup Required

None for plan close-out — the auto-update flow on macOS/Linux works against any future v1.1.0-rc2-or-newer release with feed files. The Windows manual-fallback variant works against the same future release without additional configuration.

**Pre-condition for any of the three platforms to receive an update notification:** A v1.1.0-rc2-or-newer release with `latest.yml`/`latest-mac.yml`/`latest-linux.yml` feed files must exist on GitHub. Phase 12.1 will produce that release once the CI publish race is fixed.

## Post-Spike Windows-Branch Status (Live Runtime Behavior)

| Platform | Branch | Behavior |
|----------|--------|----------|
| **macOS** (installed builds) | Full auto-update | At startup (3.5s after whenReady), checks GitHub Releases feed via `latest-mac.yml`. If newer release exists with feed file: `update-available` event fires → `UpdateDialog` modal opens (Download + Restart / Later) per D-04/D-05/D-06. |
| **Linux** (installed builds) | Full auto-update | Same as macOS, via `latest-linux.yml`. |
| **Windows** (installed builds) | **Manual fallback (D-03)** | At startup, checks the same feed. If newer release exists: the `windows-fallback` variant of UpdateDialog opens — shows version label + "Open Release Page" button that opens `GITHUB_RELEASES_INDEX_URL` externally via `window.api.openExternalUrl()`. Satisfies UPD-06's contracted "manual update path: notify of new release, link to download page" — **the contracted fallback behavior, NOT a workaround**. |

The manual-fallback code remains live (not behind a feature flag) — it IS the production Windows behavior until phase 12.1's spike validates the auto-update path end-to-end. If 12.1's spike succeeds (Decision Matrix Outcome A), promoting Windows to the auto-update branch is a one-line constant flip in `src/main/auto-update.ts` (`SPIKE_PASSED = true` unconditionally). If 12.1's spike fails (Outcomes B/C/D), no code change required — the manual-fallback variant is already the Windows default.

## Next Phase Readiness

- **Plans 12-03 (F1 atlas-image URL fix on Windows), 12-04 (F2 file-picker UX fixes), 12-05 (F3 Spine 4.2 version guard), 12-06 (INSTALL.md authoring + linking surfaces) — all unblocked.** Phase 12-01 unblocks 12-06 specifically, which extends the same `SHELL_OPEN_EXTERNAL_ALLOWED` Set this plan extended (with the INSTALL.md URL).
- **Phase 12.1 (proposed)** — picks a fix architecture for the electron-builder 26.x publish race (3 options enumerated in `deferred-items.md`: static `app-update.yml` via `extraResources` + `publish: null` YAML revert; `--config.publish=null` CLI override; build-time afterPack hook), validates locally, runs a fresh tag-push CI, then executes the Spike Runbook for real (UPD-06 / D-01 / D-02 strict-bar three-step verification on Windows test host).
- **DO NOT push tags until phase 12.1 lands the publish-race fix** — the workflow will fail and pollute releases. Per the deferred-items.md entry, this is documented for any future agent/user encountering the repo state.

## TDD Gate Compliance

Tasks 1-3 are `tdd="true"` per plan; gate sequence verified in `git log`:

| Task | RED commit | GREEN commit | Gate sequence |
|------|------------|--------------|---------------|
| 1 (update-state.ts) | `f208478` (test) | `6566cb4` (feat) | RED → GREEN ✓ |
| 2 (auto-update.ts orchestrator) | `b92f1a1` (test) | `de974fb` (feat) | RED → GREEN ✓ |
| 3 (UpdateDialog ARIA modal) | `7dce8b6` (test) | `0f4047f` (feat) | RED → GREEN ✓ |

Tasks 4 (IPC wiring) and 5 (boot wiring) are `tdd="false"` per plan — pure wiring with no behavioral surface to test in isolation; their behavior is exercised through Tasks 1-3's tests via integration.

## Self-Check: PASSED

- FOUND: `src/main/auto-update.ts` (orchestrator, ~405 lines, SPIKE_PASSED at line 92 = `process.platform !== 'win32'`)
- FOUND: `src/main/update-state.ts` (atomic JSON persistence)
- FOUND: `src/renderer/src/modals/UpdateDialog.tsx` (ARIA modal + windows-fallback variant)
- FOUND: `tests/main/auto-update.spec.ts`
- FOUND: `tests/main/update-state.spec.ts`
- FOUND: `tests/renderer/update-dialog.spec.tsx`
- FOUND: `.planning/phases/12-auto-update-tester-install-docs/12-01-SUMMARY.md` (this file)
- FOUND: SPIKE OUTCOME block in `12-RESEARCH.md` §"Output of the spike" (lines 435-443)
- FOUND: "CI tag-push will fail" entry in `deferred-items.md`
- FOUND: commit `f208478` (Task 1 RED — test update-state)
- FOUND: commit `6566cb4` (Task 1 GREEN — feat update-state)
- FOUND: commit `b92f1a1` (Task 2 RED — test auto-update orchestrator)
- FOUND: commit `de974fb` (Task 2 GREEN — feat auto-update orchestrator)
- FOUND: commit `7dce8b6` (Task 3 RED — test UpdateDialog)
- FOUND: commit `0f4047f` (Task 3 GREEN — feat UpdateDialog)
- FOUND: commit `1d9cf73` (Task 4 — IPC wiring)
- FOUND: commit `09f9369` (Task 5 — boot + menu + AppShell wiring)
- FOUND: commit `51d12cb` (Windows-portability test fixes)
- FOUND: commit `44bd03b` (defer spike to 12.1; cleanup)
- FOUND: commit `f31d494` (record SPIKE OUTCOME as DEFERRED)
- VERIFIED: `npm run test` exits 0 with 377 passed | 1 skipped | 1 todo (Test Files 33 passed)
- VERIFIED: `git status` clean post-spike-cleanup
- VERIFIED: `package.json` version is `1.1.0-rc1` (rc2 reverted)

---
*Phase: 12-auto-update-tester-install-docs*
*Completed: 2026-04-27*
