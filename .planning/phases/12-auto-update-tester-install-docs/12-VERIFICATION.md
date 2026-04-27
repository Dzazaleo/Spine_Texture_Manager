---
phase: 12-auto-update-tester-install-docs
verified: 2026-04-27T23:42:00Z
status: human_needed
score: 5/5 ROADMAP success criteria verified (with contracted-fallback notes)
overrides_applied: 0
re_verification: null  # Initial verification — no prior VERIFICATION.md
human_verification:
  - test: "macOS auto-update happy path (UPD-01..UPD-04, ROADMAP SC #1)"
    expected: "Install v1.1.0 .dmg → publish v1.1.1 → relaunch v1.1.0 → modal appears with v1.1.1 release-notes Summary → click Download+Restart → app relaunches into v1.1.1; declining (Later) does not re-prompt on next startup"
    why_human: "Requires real CI publish of a newer release with latest-mac.yml feed file AND a packaged .dmg installed on real macOS — not synthesizable in vitest. Currently blocked by deferred CI publish-race (rc2 was never published with full artifact set; phase 12.1 owns the publish-race fix)."
  - test: "Linux auto-update happy path (UPD-01..UPD-04, AppImage variant, ROADMAP SC #1)"
    expected: "Same as macOS but via AppImage; latest-linux.yml feed drives detection"
    why_human: "Same constraints as macOS; runtime against real GitHub feed with packaged AppImage install"
  - test: "Help → Check for Updates with no newer version (UPD-02, ROADMAP SC #2)"
    expected: "Launch latest installed version → Help → Check for Updates → 'You're up to date' message via UpdateDialog state='none' (D-05 — no native alert())"
    why_human: "Real-time GitHub feed query; vitest spec covers IPC bridging and renderer state-machine but the live menu-click loop requires a packaged install"
  - test: "Offline graceful (UPD-05, ROADMAP SC #3)"
    expected: "Disconnect network → launch app → no error dialog, no crash, normal startup to load screen; DevTools console shows the swallow log only"
    why_human: "Network manipulation outside vitest scope; spec covers Promise.race + try/catch in mocks but the silent-swallow contract needs eyeballed verification"
  - test: "Windows manual-fallback notice (UPD-06, ROADMAP SC #4 — manual-fallback path)"
    expected: "On Windows install (SPIKE_PASSED=false on win32), when the GitHub feed serves a newer release: UpdateDialog opens in 'windows-fallback' variant — version label + 'Open Release Page' button → clicks open https://github.com/Dzazaleo/Spine_Texture_Manager/releases externally; non-blocking, no nag loop, no modal interruption"
    why_human: "Per CONTEXT D-04 the manual-fallback variant ships LIVE on Windows by default (the contracted UPD-06 fallback behavior); live verification is part of phase 12.1 once a publishable rc2 exists. Vitest covers the variant routing logic and IPC payload shape, but the end-to-end on a packaged .exe requires a real install."
  - test: "Gatekeeper 'Open Anyway' first-launch on macOS (REL-03, ROADMAP SC #5)"
    expected: "Download fresh .dmg on macOS → double-click → Gatekeeper dialog → right-click → Open → 'Open Anyway' click → app launches; capture screenshot for INSTALL.md"
    why_human: "Tester papercut surface; INSTALL.md walkthrough text exists today; screenshot capture deferred to phase 12.1 per deferred-items.md (1×1 placeholder PNGs ship today, real captures land during first real tester install on rc2)"
  - test: "SmartScreen 'More info → Run anyway' on Windows (REL-03, ROADMAP SC #5)"
    expected: "Download fresh .exe on Windows 11 → run → SmartScreen dialog → More info → Run anyway → NSIS installer launches; capture screenshot for INSTALL.md"
    why_human: "Same as macOS Gatekeeper item; requires packaged Windows installer (currently blocked by deferred CI publish-race; phase 12.1 work)"
  - test: "libfuse2t64 error on Ubuntu 24.04 (REL-03, ROADMAP SC #5)"
    expected: "Run AppImage on fresh Ubuntu 24.04 (no libfuse2t64 installed) → observe 'dlopen(): error loading libfuse.so.2'; INSTALL.md paragraph wording matches actual error"
    why_human: "OS-version-specific behavior; INSTALL.md text-functional today (libfuse2t64 paragraph per D-15) — verification is exact-error-string match"
  - test: "INSTALL.md 4 link surfaces — eyeballed verification (REL-03 / D-16)"
    expected: "(1) Future tag push: GitHub release-template renders ${INSTALL_DOC_LINK} as https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md after envsubst; (2) README 'Installing' section visible on github.com repo page; (3) In-app Help → Installation Guide… opens INSTALL.md externally via system browser; (4) HelpDialog 'Install instructions' section link opens same URL"
    why_human: "Surfaces 1 + 2 are render-time on github.com — manual eyeball check; surface 1 specifically requires the next CI tag-push (gated on phase 12.1 publish-race fix). Surfaces 3 + 4 covered by tests/integration/install-md.spec.ts URL-consistency assertion AND tests/renderer/help-dialog.spec.tsx but the actual click → external browser open requires a packaged install"
---

# Phase 12: Auto-update + tester install docs — Verification Report

**Phase Goal:** "Auto-update + tester install docs — `electron-updater` wired to GitHub Releases feed (startup + on-demand check, restart-prompt UX, offline-graceful, Windows fallback path); `INSTALL.md` with Gatekeeper / SmartScreen bypasses."

**Verified:** 2026-04-27T23:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal is fully delivered at the **codebase level** for every must-have that can be verified programmatically. All 5 ROADMAP success criteria are wired in code, all 7 plans complete (12-01 through 12-06), all 8 expected requirement IDs accounted for, all 433 vitest tests pass on macOS dev host, and `npm run typecheck:web` is clean.

The status is `human_needed` rather than `passed` because **5 of 5 ROADMAP success criteria require live runtime observation** that is not synthesizable in vitest (real installer + real GitHub feed + real OS first-launch dialog). All such items are routed to the `human_verification` section above for tester-round verification. None of these gate the codebase deliverable.

The Windows-spike LIVE outcome (UPD-06 strict-bar three-step verification) is **explicitly deferred to phase 12.1** per CONTEXT D-04 and recorded in `12-RESEARCH.md` SPIKE OUTCOME block (Result: DEFERRED, evidence: 3 failed CI runs against electron-builder 26.x publish race). Per the prompt's instruction this is treated as a **CONTRACTED satisfying outcome**, not a gap — the manual-fallback variant ships LIVE on Windows by default (`SPIKE_PASSED = process.platform !== 'win32'` at `src/main/auto-update.ts:92`) and is the contracted UPD-06 fallback behavior.

INSTALL.md screenshots are 1×1 placeholder PNGs deferred to phase 12.1 per `deferred-items.md` "INSTALL.md screenshots deferred" entry. Per the prompt's instruction this is a **CONTRACTED partial satisfying outcome** for REL-03 — text content of INSTALL.md is exhaustive (139 lines, every step described in words), each per-OS section keeps both a markdown image reference (binary-swap-ready) AND an italic `_(Screenshot pending — capture during phase 12.1 ...)_` line. Treated as PASS, not gap.

### Observable Truths (from ROADMAP Success Criteria + PLAN must_haves)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC-1 | macOS / Linux auto-update full lifecycle (detect + prompt + Summary + opt-in download + restart + Later-defers-without-nag) | VERIFIED (code) + needs_human (live) | `src/main/auto-update.ts` initAutoUpdater binds 4 events (`update-available`/`-not-available`/`-downloaded`/`error`), schedules `setTimeout(checkUpdate(false), 3500)` (UPD-01 line 153-155); `autoDownload=false` (UPD-03 line 113); `autoInstallOnAppQuit=false` (UPD-04 line 117); `compareSemver` strict-`>` suppression in `deliverUpdateAvailable` line 358-383 (D-08 dismissedUpdateVersion); `tests/main/auto-update.spec.ts` 20 tests pass; `tests/main/update-state.spec.ts` 10 tests pass; live macOS / Linux runtime gated on packaged installer + published rc2 feed (phase 12.1) |
| SC-2 | Help → Check for Updates: shows update dialog if available, "you're up to date" if not | VERIFIED (code) + needs_human (live) | Help submenu item `src/main/index.ts:290-292` "Check for Updates…" sends `menu:check-for-updates-clicked`; `src/renderer/src/components/AppShell.tsx:976` subscribes via `onMenuCheckForUpdates` → `window.api.checkForUpdates()` → `ipcMain.handle('update:check-now')` → `checkUpdate(true)` (manual mode); `update-not-available` event fires `update:none` IPC (line 128-130); `UpdateDialog state='none'` shows "You're up to date" headline (`UpdateDialog.tsx:115-119`); manual-mode error routing covered by `tests/main/auto-update.spec.ts` |
| SC-3 | Offline graceful — no error dialog, no crash, no nag | VERIFIED (code) | `Promise.race([checkForUpdates(), 10s timeout])` (UPD-05 line 168-184); startup-mode catch silent-swallows (only DevTools console.error); manual-mode catch fires `update:error` IPC; `tests/main/auto-update.spec.ts` covers mocked offline scenarios; live offline test routed to human verification |
| SC-4 | Windows: auto-update OR documented manual-fallback path (non-blocking notice → GitHub Releases page) | VERIFIED (code, manual-fallback variant) | `SPIKE_PASSED = process.platform !== 'win32'` line 92 → Windows defaults to `'windows-fallback'` variant per D-04; `deliverUpdateAvailable` routes payload to renderer with `variant: 'windows-fallback'` (line 372-375); `UpdateDialog.tsx` renders the Open Release Page button only when `variant === 'windows-fallback'` (line 210-227); URL is `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` (allow-list-validated at `src/main/ipc.ts:174`); spike runbook DEFERRED to phase 12.1 per CONTEXT D-04 — contracted satisfying outcome (manual-fallback ships LIVE on Windows today) |
| SC-5 | Repo root contains INSTALL.md with macOS Gatekeeper + Windows SmartScreen + Linux libfuse2 walkthroughs | VERIFIED (text) + needs_human (screenshots + live tester install) | `INSTALL.md` 139 lines at repo root; 3 per-OS sections (lines 15, 45, 75); macOS right-click → Open + "Open Anyway" walkthrough (line 24-31); Windows SmartScreen More info → Run anyway (line 52-66); Linux libfuse2 / libfuse2t64 caveat per D-15 (line 90-104); 4 markdown image references with italic "Screenshot pending" fallback lines (placeholder 1×1 PNGs ship today; real captures phase 12.1) |

**Score:** 5/5 ROADMAP success criteria verified at the codebase level (with 8 live-runtime items routed to `human_verification`).

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/main/auto-update.ts` | electron-updater orchestrator (init, checkUpdate, downloadUpdate, quitAndInstallUpdate, dismissUpdate); ≥100 lines | VERIFIED | 404 lines; exports 5 functions; SPIKE_PASSED constant at line 92; compareSemver + extractSummary + deliverUpdateAvailable + sendToWindow internals |
| `src/main/update-state.ts` | Atomic JSON persistence at app.getPath('userData')/update-state.json; ≥60 lines | VERIFIED | 179 lines; `loadUpdateState`, `setDismissedVersion`, `validateUpdateStateFile`, `writeUpdateStateFileAtomic` (.tmp + fs.rename Pattern B); `UpdateStateV1` schema with version/dismissedUpdateVersion/spikeOutcome fields |
| `src/renderer/src/modals/UpdateDialog.tsx` | ARIA modal with state machine (available → downloading → downloaded) + Windows-fallback variant; ≥120 lines | VERIFIED | 290 lines; state union type; variant union type; `headlineFor` exported; auto-update + windows-fallback variant rendering branches; D-09 plain-text Summary in `<pre>` block (no XSS surface) |
| `tests/main/auto-update.spec.ts` | Mocked electron-updater event-to-IPC bridge tests + 10s timeout assertions | VERIFIED | 20 test() blocks; passes |
| `tests/main/update-state.spec.ts` | Atomic-write + validate-version-FIRST + silent-swallow tests | VERIFIED | 10 test() blocks; passes |
| `tests/renderer/update-dialog.spec.tsx` | ARIA scaffold + state machine + button-callback tests | VERIFIED | 16 test() blocks; passes |
| `INSTALL.md` (repo root) | REL-03 cookbook with per-OS walkthroughs | VERIFIED (text) | 139 lines; 3 OS sections; libfuse2/libfuse2t64 caveat; auto-update + Reporting issues sections |
| `README.md` (repo root) | Project intro + Installing section pointing at INSTALL.md (D-16.2) | VERIFIED | 34 lines; ## Installing section line 5; relative `[INSTALL.md](INSTALL.md)` link |
| `docs/install-images/{4 PNGs}` | 4 screenshot placeholders (D-14) | VERIFIED (placeholders) | 4 × 67-byte 1×1 transparent RGBA PNGs; valid PNG headers; **deferred per CONTEXT to phase 12.1 — CONTRACTED partial satisfying outcome (text-first ships today, binary swap during 12.1 needs no doc edit)** |
| `tests/integration/install-md.spec.ts` | URL-consistency 4-surface gate | VERIFIED | 18 test() blocks; URL-byte-for-byte assertion across `src/main/ipc.ts` allow-list + `HelpDialog.tsx` constant + `AppShell.tsx` openExternalUrl arg + `.github/workflows/release.yml` env var |
| `fixtures/SPINE_3_8_TEST/` | F3 regression fixture (Spine 3.8.99-shaped JSON + atlas + PNG) | VERIFIED | 3 files: SPINE_3_8_TEST.json + SPINE_3_8_TEST.atlas + images/SQUARE.png |
| `electron-builder.yml` publish block | provider: github, owner, repo (Plan 12-02) | VERIFIED | Line 19-23; provider/owner/repo/releaseType=release; bundles app-update.yml into installer resources/ at build time |
| `.github/workflows/release.yml` matrix | test job runs on ubuntu-latest + windows-2022 + macos-14 (D-22) | VERIFIED | Line 33-34; fail-fast: true preserves CI-05 atomicity; tag-version-guard gated to ubuntu-latest leg |
| `.github/workflows/release.yml` publish | latest*.yml uploaded alongside installers (D-11/D-12) | VERIFIED | Line 159-165; 6 file globs (3 installers + 3 feed files) in softprops/action-gh-release@v2.6.2 files: input |
| `.github/release-template.md` | Single-link prune to INSTALL.md (D-17) | VERIFIED | Line 17 `See [INSTALL.md](${INSTALL_DOC_LINK})`; ## Install instructions heading preserved per REL-02 |
| `package.json` | electron-updater@^6.8.3 in dependencies | VERIFIED | Line 27 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `src/main/index.ts` boot | `src/main/auto-update.ts:initAutoUpdater` | `app.whenReady().then` AFTER `applyMenu` | WIRED | Line 428 `initAutoUpdater()` after `applyMenu(currentMenuState, mainWindowRef)` (line 419); orchestrator's internal STARTUP_CHECK_DELAY_MS=3500 schedules silent check (UPD-01) |
| `src/main/auto-update.ts` autoUpdater events | renderer (UpdateDialog mount via AppShell subscription) | `sendToWindow(channel, payload)` → `getMainWindow().webContents.send` → preload onUpdate* | WIRED | 4 IPC channels emitted from `auto-update.ts`: `update:available` (line 377), `update:none` (line 129), `update:downloaded` (line 133), `update:error` (line 148); AppShell subscribes via `window.api.onUpdate*` (lines 932-973) |
| Help → Check for Updates click | `src/main/auto-update.ts:checkUpdate(true)` | `menu:check-for-updates-clicked` → renderer `window.api.checkForUpdates()` → `ipcMain.handle('update:check-now')` | WIRED | Menu item at `src/main/index.ts:290-292`; AppShell subscriber at line 976; IPC handler at `src/main/ipc.ts:680-683` |
| Later button click | `update-state.json` | `ipcMain.on('update:dismiss')` → `setDismissedVersion` → atomic .tmp + rename | WIRED | `ipc.ts:688-694` (typeof string guard); `update-state.ts:175-179` writeUpdateStateFileAtomic |
| Restart button click | `autoUpdater.quitAndInstall(false, true)` | `ipcMain.on('update:quit-and-install')` → `quitAndInstallUpdate` → setTimeout(0) deferral | WIRED | `ipc.ts:695-700`; `auto-update.ts:217-221` (Pattern H deferral so IPC ack returns before quit) |
| Help → Installation Guide | INSTALL.md URL externally | `menu:installation-guide-clicked` → `window.api.openExternalUrl(INSTALL.md URL)` | WIRED | Menu item at `src/main/index.ts:301-303`; AppShell handler at line 987-989; URL `https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md`; allow-listed at `ipc.ts:183` |
| HelpDialog → INSTALL.md | INSTALL.md URL externally | `INSTALL_DOC_URL` constant → `openLink(INSTALL_DOC_URL)` curried button | WIRED | `HelpDialog.tsx:77` constant; line 137-145 button section between Section 1 and Section 2 |
| `electron-builder.yml` publish | `app-update.yml` baked into installer `resources/` | publish.provider=github at build time | WIRED | YAML block lines 19-23; runtime electron-updater reads from this; `--publish never` CLI suffix preserved as belt-and-braces |
| `.github/workflows/release.yml` publish | GitHub Releases | softprops/action-gh-release@v2.6.2 files: input | WIRED | Line 151-165; latest*.yml + installers uploaded atomically to draft release |
| AtlasPreviewModal → main pathToFileURL bridge (F1) | `app-image://localhost/<pathname>` URL | `window.api.pathToImageUrl(absolutePath).then(url => img.src = url)` | WIRED | `AtlasPreviewModal.tsx:143`; bridge at `src/preload/index.ts:518-519`; handler at `src/main/ipc.ts:734` with `{windows: true}` cross-platform hardening |
| `src/core/loader.ts` (F3) | hard-reject Spine < 4.2 | `checkSpineVersion` predicate before atlas resolution; `SpineVersionUnsupportedError` typed envelope | WIRED | loader.ts:112 predicate; insertion site lines 169-176; SerializableError 3rd arm with `detectedVersion` field; 5 forwarder branches (`ipc.ts`, `project-io.ts` × 3, `sampler-worker.ts`) |
| AppShell pickOutputDir (F2) | folder picker without `/images-optimized` suffix | `window.api.pickOutputDirectory(skeletonDir)` | WIRED | `AppShell.tsx:452` (was `defaultOutDir = skeletonDir + '/images-optimized'`); source-grep regression test at `tests/renderer/app-shell-output-picker.spec.tsx` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `UpdateDialog.tsx` | `updateState.{open,state,version,summary,variant}` | AppShell `setUpdateState` set by `onUpdateAvailable` / `onUpdateDownloaded` / `onUpdateNone` / `onUpdateError` IPC events from main | YES — main's `deliverUpdateAvailable` extracts real version + Summary from electron-updater's `UpdateInfo` payload (line 358-383); 4 IPC channels carry real data, not stubs | FLOWING (gated on real GitHub feed) |
| `update-state.json` persistence | `dismissedUpdateVersion`, `spikeOutcome` | `setDismissedVersion(version)` writes atomically; `loadUpdateState` reads + validates | YES — atomic .tmp + rename Pattern B; validate-version-FIRST + silent-swallow on read failure (mirrors recent.ts byte-for-byte) | FLOWING |
| `INSTALL.md` linking surfaces | `INSTALL_DOC_URL` literal | Hardcoded string in 4 source files (allow-list + HelpDialog constant + AppShell openExternalUrl arg + workflow env var); URL-consistency assertion at `tests/integration/install-md.spec.ts` | YES — same literal byte-for-byte across 4 surfaces; integration test gates drift | FLOWING |
| `docs/install-images/*.png` references | image src (markdown-rendered) | 4 1×1 placeholder PNGs (67 bytes each) + italic "Screenshot pending" fallback line | PARTIAL — placeholders ship today, real captures during phase 12.1 with first real tester install per CONTEXT (CONTRACTED partial satisfying outcome — flagged informational, NOT a gap) | STATIC (deferred-acceptable) |
| Release-template `${INSTALL_DOC_LINK}` | env-substituted URL in CI | `.github/workflows/release.yml:147` env var → `envsubst < .github/release-template.md > release-body.md` | YES — CI runs `envsubst` step (live-verification gated on next tag-push, blocked by deferred CI publish-race) | FLOWING (gated on next CI publish) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full vitest suite passes | `npm run test` | 433 passed, 1 skipped, 1 todo across 38 files in 2.92s | PASS |
| INSTALL.md exists at repo root | `wc -l INSTALL.md` | 139 lines | PASS |
| 4 INSTALL.md image placeholders exist with valid PNG magic bytes | `ls docs/install-images/*.png` + `tests/integration/install-md.spec.ts` PNG-magic-bytes assertions | 4 files, all 67 bytes, valid PNG headers | PASS |
| Per-OS sections present in INSTALL.md | `grep -E "^## (macOS\|Windows\|Linux)" INSTALL.md` | 3 matches | PASS |
| libfuse2t64 paragraph present | `grep "libfuse2t64" INSTALL.md` | 2 matches (Ubuntu 24.04 install + 22.04 contrast) | PASS |
| electron-updater dependency installed | `grep '"electron-updater"' package.json` | `"electron-updater": "^6.8.3"` | PASS |
| Release.yml matrix includes 3 OSes | `grep "os: \[" .github/workflows/release.yml` | `os: [ubuntu-latest, windows-2022, macos-14]` | PASS |
| Publish job uploads latest*.yml | `grep "latest" .github/workflows/release.yml` | 6 file globs incl. `assets/latest{,-mac,-linux}.yml` | PASS |
| electron-builder.yml has GitHub publish provider | `grep "provider: github" electron-builder.yml` | 1 match line 20 | PASS |
| Help submenu has both new items | `grep "label: '(Check for Updates\|Installation Guide)" src/main/index.ts` | 2 matches (lines 290 + 301) | PASS |
| AppShell subscribes to all 5 update IPC channels | `grep "onUpdate\|onMenuCheckForUpdates\|onMenuInstallationGuide" src/renderer/src/components/AppShell.tsx` | 6 matches (subscriptions + cleanup) | PASS |
| F1 fix: AtlasPreviewModal uses bridge, not concat | `grep "pathToImageUrl" src/renderer/src/modals/AtlasPreviewModal.tsx` | 1 call site at line 143; literal `app-image://localhost${...}` not present in code | PASS |
| F2 fix: AppShell drops `/images-optimized` suffix | `grep "/images-optimized" src/renderer/src/components/AppShell.tsx` | Only in doc-comments referencing the OLD bug; no code occurrences | PASS |
| F3 fix: loader.ts checkSpineVersion exported + insertion site | `grep "checkSpineVersion" src/core/loader.ts` | 4 matches (predicate def + 3 call sites) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| UPD-01 | 12-01-PLAN | On startup, app checks GitHub Releases feed for newer version (non-blocking, background) | SATISFIED | `setTimeout(checkUpdate(false), 3500)` inside `initAutoUpdater()` (`auto-update.ts:153-155`); silent-swallow per UPD-05 (line 184); `tests/main/auto-update.spec.ts` covers startup-mode mocked |
| UPD-02 | 12-01-PLAN | Manual update check via menu (Help → Check for Updates) | SATISFIED | Help submenu item at `src/main/index.ts:290-292`; routing through `menu:check-for-updates-clicked` → `update:check-now` IPC → `checkUpdate(true)`; "You're up to date" via `update:none` IPC + UpdateDialog state='none' |
| UPD-03 | 12-01-PLAN | Update-available prompt with version + Summary + opt-in download | SATISFIED | `autoDownload=false` (`auto-update.ts:113`); UpdateDialog "Download + Restart" button triggers `update:download` IPC → `downloadUpdate()`; D-09 plain-text Summary extraction; `tests/renderer/update-dialog.spec.tsx` covers state machine |
| UPD-04 | 12-01-PLAN | After download, prompt to restart; "Later" defers without nagging | SATISFIED | UpdateDialog state='downloaded' → Restart button fires `update:quit-and-install` → `setTimeout(quitAndInstall, 0)` Pattern H; Later persists `dismissedUpdateVersion` to update-state.json (D-08); `compareSemver` strict-`>` suppression in `deliverUpdateAvailable` |
| UPD-05 | 12-01-PLAN | Offline graceful — no error dialog, no crash, no nag | SATISFIED | `Promise.race([checkForUpdates(), 10s timeout])` (line 168-184); startup-mode catch silent-swallows; mocked-offline tests in `tests/main/auto-update.spec.ts` |
| UPD-06 | 12-01-PLAN + 12-02-PLAN | macOS/Linux auto-update OR documented Windows manual-fallback | SATISFIED (manual-fallback variant ships LIVE today; live spike runbook DEFERRED to phase 12.1 per CONTEXT D-04 — CONTRACTED satisfying outcome per prompt) | `SPIKE_PASSED = process.platform !== 'win32'` line 92 → Windows defaults to windows-fallback variant; `UpdateDialog.tsx:210-227` renders Open Release Page button; URL allow-listed at `ipc.ts:174`; CI delivery surface (latest*.yml feed + electron-builder publish: github) ships in 12-02 |
| REL-03 | 12-06-PLAN | INSTALL.md cookbook with macOS Gatekeeper + Windows SmartScreen + Linux libfuse walkthroughs | SATISFIED (text + 4 linking surfaces; screenshots are 1×1 placeholders deferred to phase 12.1 per CONTEXT — CONTRACTED partial satisfying outcome per prompt) | INSTALL.md 139 lines at repo root; 3 OS sections; libfuse2/libfuse2t64 caveat (D-15); 4 linking surfaces wired (D-16); release-template prune (D-17); allow-list extension (D-18); `tests/integration/install-md.spec.ts` 18 tests gate URL consistency |

**No orphaned requirements.** REQUIREMENTS.md §UPD lists UPD-01..UPD-06 and §REL lists REL-03 — all 7 are accounted for in PLAN frontmatter (`12-01-PLAN.md` requirements: UPD-01..UPD-06; `12-02-PLAN.md` requirements: UPD-06; `12-06-PLAN.md` requirements: REL-03). Plans 12-03/12-04/12-05 declare empty `requirements: []` because F1/F2/F3 are CONTEXT-folded Phase 11 spillover items (no roadmap requirement ID per D-19/D-20/D-21).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/main/auto-update.ts` | 262-286 | `compareSemver` returns constant -1 when both versions have different pre-release suffixes with equal numeric tuple — would re-prompt on a downgrade or release-after-prerelease (per 12-REVIEW.md WR-01) | Warning | UX papercut: user dismissing rc2 then receiving rc1 from feed (or 1.0.0 after 1.0.0-rc1) re-fires the prompt. Documented as "false positives acceptable" but the actual symptom is more aggressive than the docstring states. NOT a blocker (D-08 strict-`>` semantics conservatively bias to extra prompts). Triage in a maintenance plan. |
| `src/main/auto-update.ts` | 128-130 | `update:none` event handler unconditionally fires; renderer filters by `manualCheckPendingRef`. Docstring at line 165-166 says "silent on startup" but implementation is "main always sends, renderer filters" (per 12-REVIEW.md WR-02) | Info | Not a bug — works correctly — but a maintenance trap if someone "fixes" the docstring vs the code. |
| `src/main/auto-update.ts` | 136-149 | `error` event handler fires unconditionally; in manual mode the catch block in `checkUpdate` ALSO fires `update:error` for the same logical failure (per 12-REVIEW.md WR-03). Renderer's `manualCheckPendingRef` consumes only the first event. | Info | Latent footgun in production against real electron-updater (mocks don't trigger the duplicate path). Race-prone if a second manual check is triggered before the first ack returns. Not blocking. |
| `INSTALL.md` | 27, 54, 60, 106 | 4 `![alt](docs/install-images/...)` markdown image references render as 1×1 black-pixel placeholders today | Info | Per CONTEXT — CONTRACTED partial satisfying outcome; deferred to phase 12.1 with binary-only swap (no doc edits). 12-REVIEW.md IN-06 suggests optionally wrapping in HTML comments until real captures land; not actioned today. |
| 4 source files | (per IN-02) | `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` literal duplicated 4 times across `auto-update.ts:73`, `ipc.ts:174`, `UpdateDialog.tsx:103`, `AppShell.tsx:1465` | Info | Drift risk on org/repo rename. Integration test only checks IPC allow-list presence, not byte-for-byte across all 4 sites. Cleanup candidate for a future maintenance plan. |
| `scripts/probe-per-anim.ts` | 14 | Pre-existing typecheck failure: `error TS2339: Property 'values' does not exist on type 'SamplerOutput'` | Info | Carried forward via `deferred-items.md` from Phase 11 per SCOPE BOUNDARY rule — survives `git stash`, identical to Phase 11 entry, out of Phase 12 scope. Vitest suite (the actual CI gate) passes 433/433. |

**No 🛑 Blockers.** All findings are Warnings (Info-level) — they are correctness/quality issues that the 12-REVIEW.md report enumerated and that the user is aware of for future polish. None gate the phase goal.

### Human Verification Required

See `human_verification` frontmatter array. 9 items routed for live tester-round verification:

1. **macOS auto-update happy path (UPD-01..UPD-04, ROADMAP SC #1)** — needs packaged .dmg + published rc2 with latest-mac.yml feed (phase 12.1).
2. **Linux auto-update happy path (AppImage)** — same constraints, latest-linux.yml feed.
3. **Help → Check for Updates with no newer version** — packaged install + GitHub feed.
4. **Offline graceful** — packaged install + network manipulation.
5. **Windows manual-fallback notice** — packaged .exe + GitHub feed; CONTRACTED Windows behavior per D-04.
6. **macOS Gatekeeper "Open Anyway" capture for INSTALL.md** — phase 12.1 first tester install.
7. **Windows SmartScreen "More info → Run anyway" capture for INSTALL.md** — phase 12.1.
8. **libfuse2t64 error on Ubuntu 24.04** — fresh OS install + AppImage.
9. **INSTALL.md 4 link surfaces — eyeball each** — surfaces 1+2 are GitHub render-time; surfaces 3+4 are in-app menu/dialog clicks.

### Gaps Summary

**No actionable gaps.** Every must-have (5 ROADMAP success criteria + all 7 requirement IDs + all PLAN must_haves across 12-01 through 12-06) is verified at the codebase level. Two specific items the prompt flagged as "treat as PASS, not gap" were verified accordingly:

1. **UPD-06 live runtime confirmation** — DEFERRED to phase 12.1 per CONTEXT D-04 SPIKE OUTCOME block in `12-RESEARCH.md`. The manual-fallback variant ships LIVE on Windows by default (`SPIKE_PASSED = process.platform !== 'win32'` at `src/main/auto-update.ts:92`); both paths exist under one cohesive code surface per D-04 — flipping the Windows branch in 12.1 (post-spike) is a one-line constant flip, not a refactor. Recorded SPIKE OUTCOME (lines 437-443 of 12-RESEARCH.md) documents 3 failed CI runs (25017095851 / 25017351602 / 25017624868) that surfaced the electron-builder 26.x publish race — runbook step 5 (install rc2 on Windows) was never reached. **Treated as CONTRACTED satisfying outcome.**

2. **INSTALL.md screenshots** — DEFERRED to phase 12.1 per `deferred-items.md` "INSTALL.md screenshots deferred" entry. 4 placeholder 1×1 PNGs (67 bytes each, valid PNG magic bytes) ship today; INSTALL.md text content is exhaustive (every step described in words); each per-OS section keeps both a markdown image reference (binary-swap-ready — replacement needs no doc edits) AND an italic `_(Screenshot pending — capture during phase 12.1 ...)_` line. **Treated as CONTRACTED partial satisfying outcome.**

**Test status confirmed:** 433/433 vitest passing across 38 files. `npm run typecheck:web` clean. Pre-existing `scripts/probe-per-anim.ts` typecheck failure carried forward via `deferred-items.md` per SCOPE BOUNDARY (identical to Phase 11's deferred entry) — not a Phase 12 gap.

The 9 human-verification items are live-runtime observations that cannot be synthesized in vitest (real installer + real GitHub feed + real OS first-launch dialogs). They do not represent unfinished code work — they represent the verification surface that is, by definition, post-deployment.

---

_Verified: 2026-04-27T23:42:00Z_
_Verifier: Claude (gsd-verifier)_
