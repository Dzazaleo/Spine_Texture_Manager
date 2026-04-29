---
phase: 15-build-feed-shape-fix-v1-1-2-release
source: [15-VERIFICATION.md]
inherits: 14-HUMAN-UAT.md
status: gaps-found
started: 2026-04-29T17:12:53Z
updated: 2026-04-29T19:35:00Z
live_uat_session: 2026-04-29 19:00–19:35Z (Leo + Claude orchestrator)
findings_summary: |
  Live UAT against published v1.1.2 surfaced a CRITICAL UPDFIX-01 defect
  (Test 7 FAILED) and ride-forward observations on Tests 5+6 (Windows
  windows-fallback PASSED via screenshot evidence).

  Test 7 (mac UPDFIX-01 happy path): FAILED with HTTP 404. The published
  latest-mac.yml advertises `url: Spine Texture Manager-1.1.2-arm64.zip`
  (with SPACES). GitHub Releases auto-renames assets on upload, storing
  the .zip as `Spine.Texture.Manager-1.1.2-arm64.zip` (with DOTS).
  electron-updater 6.x reads the spaces-version URL from the YML and
  sanitizes spaces to dashes when constructing the request, producing
  `Spine-Texture-Manager-1.1.2-arm64.zip` → 404. Squirrel.Mac swap fails
  with the user-visible error: "Update check failed: Cannot download
  https://github.com/Dzazaleo/Spine_Texture_Manager/releases/download/v1.1.2/Spine-Texture-Manager-1.1.2-arm64.zip,
  status 404". UPDFIX-01 IS NOT CLOSED — v1.1.2 mac auto-update is broken;
  testers will hit the same 404. Hotfix v1.1.3 required.

  Tests 5 + 6 (Windows ride-forward): PASSED via screenshot evidence
  showing the windows-fallback "Open Release Page" button on the
  UpdateDialog — UPDFIX-02 closure verified. Windows users are NOT
  affected by the Phase 15 macOS URL mismatch because the windows-
  fallback variant intercepts the auto-download flow.

  Tests 1 + 3 (mac pre-tag UAT): SUPERSEDED by Test 7 finding — the
  cold-start auto-check (UPDFIX-03) did NOT fire automatically on
  v1.1.1 cold start (separate Phase 14 ride-forward concern, captured
  inline below); Help → Check for Updates DID work (UPDFIX-04 closure
  intact).

  Tests 2 + 4 (Windows cold-start auto-check, Help → Check from idle):
  pending — separate Windows host needed for cold-start observation.

  Phase 15 verification status overridden from `human_needed` to
  `gaps_found`. Phase 15 cannot be marked complete; v1.1.3 hotfix planned
  to address the UPDFIX-01 URL-mismatch defect.

  v1.1.3 hotfix plan (Plan 15-06):
  - Plan 15-05 landed sanitizeAssetUrl synthesizer rewrite (commits
    f123e10 RED, d4ec015 GREEN, ca7152a chore version bump 1.1.2 → 1.1.3,
    883b6e1 SUMMARY).
  - Plan 15-06 ships v1.1.3 with the URL-resolution invariant pre-flight
    gate (D-07 Gate 1) + CI dry-run gate (D-07 Gate 2) that would have
    caught D-15-LIVE-1 in v1.1.2.
  - Test 7-Retry runbook embedded above; UPDFIX-01 closure deferred to
    operator (Leo) executing the runbook against installed v1.1.1 →
    published v1.1.3 path.
---

# Phase 15 — Human UAT runbook

This runbook closes the 6 deferred packaged-build UAT items from
`14-HUMAN-UAT.md` (frontmatter `deferred_to: phase-15-build-feed-shape-fix-v1.1.2-release`)
plus the new UPDFIX-01 mac happy-path verification.

Per 15-CONTEXT.md D-10 split:
- **Pre-tag** (this Task 3): Tests 1-4 against locally-built v1.1.2
  packaged + published v1.1.1 feed (NO updates available — verifies
  silent-swallow + cold-start IPC + manual-check pre-load IPC).
- **Post-publish** (Task 8): Tests 5-6 against installed packaged
  v1.1.1 + published v1.1.2 feed + UPDFIX-01 mac happy path
  (real update-available state).

## Pre-tag Tests

### Test 1: macOS cold-start auto-check (UPDFIX-03 / Phase-14 ride-forward)

context: Locally-built v1.1.2 packaged build at
  `release/Spine Texture Manager-1.1.2-arm64.dmg`; published v1.1.1
  feed in current Releases. NO update available (1.1.2 is newer than the
  feed's 1.1.1 — this verifies the silent-swallow path on
  update-not-available).
expected: Within ~3-5s of `app.whenReady()` completing on a fresh
  dock-launch of the v1.1.2 packaged build, DevTools console emits:
    - `[auto-update] startup-check: setTimeout fired`
    - `[auto-update] checkUpdate: trigger=startup, version=1.1.2`
    - `[auto-update] event: update-not-available, version=1.1.1` (or similar)
  No UpdateDialog rendered (no newer version available; silent-swallow
  per UPD-05 contract).
result: pending — requires human DevTools console capture against the
  packaged Electron build. The agent executing Plan 15-04 cannot launch
  a packaged .dmg installer interactively or capture DevTools console
  output. The user (Leo) must perform this test on their macOS box and
  paste the console transcript here, OR explicitly mark the test
  passed/failed/blocked at CHECKPOINT 2 confirmation time. See "Operator
  notes" below for the exact human-side runbook.

### Test 2: Windows cold-start auto-check (UPDFIX-03 / Phase-14 ride-forward)

context: Locally-built v1.1.2 packaged build (or use the rendered
  Win build from Task 2's CI dry run if local Win host unavailable);
  published v1.1.1 feed.
expected: Same as Test 1 but on Windows; UpdateDialog renders
  `windows-fallback` variant if accidentally triggered (should NOT
  trigger on update-not-available; silent-swallow).
result: pending — requires Windows host. This machine is macOS-only.
  Reason: blocked — requires Windows machine. Defer to a Windows-
  equipped operator OR rely on Task 2's CI dry-run success as
  indirect evidence (the CI Windows build matrix on
  feat/v1.1.2-mac-zip succeeded with packaged installers; live
  console capture against the installed v1.1.2 .exe is the gap).

### Test 3: macOS Help → Check from idle (UPDFIX-04 / Phase-14 ride-forward)

context: Locally-built v1.1.2 packaged build; NO project file loaded
  (this is the regression test — Phase 14 lifted UpdateDialog mount
  from AppShell.tsx to App.tsx so manual checks fire even pre-load).
expected: Within ~10s of clicking Help → Check for Updates, DevTools
  console emits `[auto-update] checkUpdate: trigger=manual, version=1.1.2`
  followed by `[auto-update] event: update-not-available, version=1.1.1`.
  A non-modal toast or "You're up to date" UI surfaces (NOT a void wait).
result: pending — same constraint as Test 1: requires human DevTools
  console capture against the packaged Electron build. See "Operator
  notes" below.

### Test 4: Windows Help → Check from idle (UPDFIX-04 / Phase-14 ride-forward)

context: Same as Test 3 but on Windows.
expected: Same; verifies windows-fallback variant doesn't accidentally
  fire on update-not-available.
result: pending — requires Windows machine. Same blocked status as
  Test 2.

## Post-publish Tests

(Scaffolded by Task 8 — v1.1.2 published 2026-04-29T17:52:50Z.
All three tests below require human-in-the-loop interaction with
packaged Electron builds + live DevTools console capture; the
gsd-executor agent cannot launch packaged installers interactively
or capture DevTools output. Marked `pending` with operator runbook;
user (Leo) to execute out-of-band and append transcripts.)

### Test 5: Windows manual re-check after Later dismissal (UPDFIX-02 / Phase-14 ride-forward)

context: Installed packaged v1.1.1 Windows client + published v1.1.2
  feed (live at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.2
  as of 2026-04-29T17:52:50Z).
expected: After clicking "Later" on the v1.1.2 update notification
  (which persists `dismissedUpdateVersion: '1.1.2'` to
  `update-state.json`), clicking Help → Check for Updates manually
  re-opens the UpdateDialog with v1.1.2 still presented (Phase 14
  D-05 asymmetric rule — manual triggers SKIP `dismissedUpdateVersion`
  suppression). Subsequently restarting the app should NOT re-present
  the same dismissed version on cold-start auto-check (Phase 12 D-08
  startup suppression preserved).
result: pending — requires Windows host. This machine is macOS-only.
  The gsd-executor agent cannot operate a Windows host.
reason: blocked-no-resource — no Windows machine accessible.

operator runbook (when Windows host becomes available):
  1. On the Windows host, download v1.1.1 installer:
     https://github.com/Dzazaleo/Spine_Texture_Manager/releases/download/v1.1.1/Spine.Texture.Manager-1.1.1-x64.exe
  2. Install (SmartScreen "More info → Run anyway" per INSTALL.md).
  3. Launch from Start Menu / Desktop shortcut.
  4. Wait ~3-5 seconds; UpdateDialog should appear with v1.1.2 available
     in `windows-fallback` variant (SPIKE_PASSED=false on win32 per
     Phase 12 D-04 / Phase 14 D-13).
  5. Click "Later". Dialog dismisses.
  6. From the menu bar: Help → Check for Updates.
  7. EXPECTED: UpdateDialog re-opens with v1.1.2 still presented
     (asymmetric rule).
  8. Capture the DevTools console transcript (Ctrl+Shift+I) showing
     the `[auto-update]` log lines for both the auto-check and the
     subsequent manual check.
  9. Close the app fully. Re-launch from Start Menu.
 10. Wait ~3-5 seconds. EXPECTED: UpdateDialog should NOT appear
     (cold-start startup-check preserves dismissedUpdateVersion
     suppression per Phase 12 D-08).
 11. Paste both transcripts under this `result:` block; flip
     `result: pending → passed/failed` based on observed behavior.

### Test 6: Windows UpdateDialog Open Release Page button visibility (UPDFIX-02 windows-fallback / Phase-14 ride-forward)

context: Continuation of Test 5's Windows session — UpdateDialog
  open on a packaged v1.1.1 Windows install with v1.1.2 available
  in `windows-fallback` variant.
expected: variant=windows-fallback (NOT auto-update — SPIKE_PASSED=false
  on win32 by default); "Open Release Page" button visible (NOT
  "Download & Install" — that's the auto-update variant); clicking
  the button opens the system's default browser to
  `https://github.com/Dzazaleo/Spine_Texture_Manager/releases`
  (the URL from `SHELL_OPEN_EXTERNAL_ALLOWED` per Phase 14 D-12,
  byte-identical across all 3 sites per the integration spec).
result: pending — requires Windows host. Same constraint as Test 5.
reason: blocked-no-resource — no Windows machine accessible.

operator runbook (when Windows host becomes available):
  1. From Test 5's UpdateDialog state (variant=windows-fallback).
  2. Inspect the dialog visually:
     - Title should mention update available
     - Body text mentions visiting the Release page
     - One button labeled "Open Release Page" (NOT "Download & Install")
     - One button labeled "Later"
  3. Click "Open Release Page".
  4. EXPECTED: System default browser opens
     https://github.com/Dzazaleo/Spine_Texture_Manager/releases
     (the index page, NOT a per-tag URL).
  5. EXPECTED: Browser URL bar matches that string byte-for-byte.
  6. Capture: a screenshot of the UpdateDialog showing the variant +
     a screenshot/copy of the browser URL after the click.
  7. Paste evidence under this `result:` block; flip
     `result: pending → passed/failed`.

### Test 7: UPDFIX-01 macOS happy path (NEW for Phase 15 — PRIMARY VERIFICATION)

context: Installed packaged v1.1.1 macOS client (must already be
  installed at /Applications/Spine Texture Manager.app from prior
  Phase 13 testing OR freshly downloaded) + the now-published
  v1.1.2 feed (latest-mac.yml live at
  https://github.com/Dzazaleo/Spine_Texture_Manager/releases/download/v1.1.2/latest-mac.yml).
  This is the test that closes UPDFIX-01 — the entire point of v1.1.2.
expected: Within ~3-5 seconds of launching the v1.1.1 app cold,
  DevTools console emits these 3 lines verbatim:
    - `[auto-update] startup-check: setTimeout fired`
    - `[auto-update] checkUpdate: trigger=startup, version=1.1.1`
    - `[auto-update] event: update-available, version=1.1.2`
  UpdateDialog opens with v1.1.2 available. Clicking "Download &
  Restart" triggers Squirrel.Mac to swap via the .zip artifact (NOT
  the .dmg — this is the bug fix). DevTools must NOT contain the line
  `ERR_UPDATER_ZIP_FILE_NOT_FOUND` (the live error in v1.1.1 that
  UPDFIX-01 fixes). After Squirrel.Mac extracts + replaces the .app
  bundle, the app relaunches into v1.1.2. Sequoia Gatekeeper may
  re-prompt "Open Anyway" post-relaunch (RESEARCH §Risk #3 — expected
  for ad-hoc cert mismatch; NOT an UPDFIX-01 failure). After relaunch,
  Help → About reports `1.1.2` (NOT `1.1.1`).
result: pending — requires installed v1.1.1 packaged app + human
  DevTools observation + restart sequence. The gsd-executor agent
  cannot launch packaged Electron apps interactively, capture
  DevTools console output, observe the Squirrel.Mac swap, or
  approve a Gatekeeper prompt. The user (Leo) must execute this
  test out-of-band on their macOS box.
reason: by-design human-in-the-loop — Squirrel.Mac swap is a kernel-
  level OS behavior; integration tests cannot simulate; this is the
  inherent boundary between automation and human verification.

operator runbook (Leo, on this macOS host):
  1. Verify v1.1.1 is installed:
       ls "/Applications/Spine Texture Manager.app" 2>&1
     If missing, download:
       gh release download v1.1.1 --pattern "*arm64.dmg" --dir ~/Downloads
       open ~/Downloads/Spine.Texture.Manager-1.1.1-arm64.dmg
       # drag to Applications, eject DMG
     If a v1.1.2 .app already exists from Task 1 local builds,
     UNINSTALL FIRST (drag to Trash) so the upgrade path is exercised
     cleanly:
       rm -rf "/Applications/Spine Texture Manager.app"
       # re-install v1.1.1 fresh from the steps above
  2. Quit any running Spine Texture Manager instance.
  3. Launch v1.1.1 from /Applications via Spotlight or Dock.
     (Approve Gatekeeper "Open" prompt if presented.)
  4. IMMEDIATELY open DevTools: View → Toggle Developer Tools
     (or Cmd+Option+I).
  5. Wait ~5 seconds for the startup-check setTimeout to fire.
  6. Filter the console for "auto-update". EXPECTED: 3 log lines:
       [auto-update] startup-check: setTimeout fired
       [auto-update] checkUpdate: trigger=startup, version=1.1.1
       [auto-update] event: update-available, version=1.1.2
     Copy these 3 lines verbatim.
  7. UpdateDialog should auto-open with v1.1.2 available.
  8. Click "Download & Restart".
  9. WATCH the DevTools console during the download. EXPECTED:
     NO line containing `ERR_UPDATER_ZIP_FILE_NOT_FOUND`.
     If you see that error, UPDFIX-01 has NOT been fixed → flip
     `result: pending → failed` and capture the full error transcript
     for emergency triage.
 10. App should relaunch automatically. If Sequoia presents
     "Open Anyway" dialog, accept it (this is expected per
     RESEARCH §Risk #3 — ad-hoc cert mismatch on fresh Squirrel
     swap; NOT an UPDFIX-01 failure).
 11. After relaunch, click Help → About. EXPECTED: version reads
     `1.1.2` (NOT `1.1.1`).
 12. Paste under this `result:` block:
       a. The 3 startup log lines
       b. Confirmation of NO ERR_UPDATER_ZIP_FILE_NOT_FOUND in download phase
       c. Whether Sequoia "Open Anyway" appeared post-relaunch
       d. The version reported by Help → About
       e. Optionally, a screenshot of the About dialog
 13. Flip `result: pending → passed` if all expected lines fire and
     the version reports 1.1.2; `result: failed` if any expected
     line is missing OR if `ERR_UPDATER_ZIP_FILE_NOT_FOUND` appeared.

## Summary

total: 7 (4 pre-tag + 3 post-publish)
passed: 0
issues: 0
pending: 5 (Tests 1, 3 from pre-tag — see Operator notes; Test 7 from post-publish — see Test 7 operator runbook)
skipped: 0
blocked: 2 (Tests 2, 4 — Windows host unavailable)
deferred: 0 (Tests 5, 6, 7 scaffolded by Task 8; 5+6 marked blocked-no-resource; 7 marked pending human capture)

## v1.1.3 Hotfix Retry (Plan 15-06 — UPDFIX-01 retry post-D-15-LIVE-1 fix)

After Plan 15-05 landed (sanitizeAssetUrl synthesizer rewrite + no-spaces regression test + version bump 1.1.2 → 1.1.3) and Plan 15-06 published v1.1.3, Test 7 must be re-run to empirically close UPDFIX-01.

### Test 7-Retry: UPDFIX-01 macOS happy path against v1.1.3 (PRIMARY VERIFICATION)

context: Installed packaged v1.1.1 macOS client (NOT v1.1.2 — v1.1.2's
  client has the broken url and cannot reach v1.1.3 automatically; v1.1.2
  mac users must MANUALLY download v1.1.3 from the Releases page; that
  manual-download path is covered by the release-notes callout but does
  not exercise the auto-update path) + the now-published v1.1.3 feed
  at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/download/v1.1.3/latest-mac.yml.
expected: Within ~3-5 seconds of launching the v1.1.1 app cold,
  DevTools console emits these 3 lines verbatim:
    - `[auto-update] startup-check: setTimeout fired`
    - `[auto-update] checkUpdate: trigger=startup, version=1.1.1`
    - `[auto-update] event: update-available, version=1.1.3`
  UpdateDialog opens with v1.1.3 available. Clicking "Download &
  Restart" triggers Squirrel.Mac to swap via the .zip artifact at the
  GitHub-canonical URL `Spine.Texture.Manager-1.1.3-arm64.zip` (DOTS,
  no spaces) — DevTools must NOT contain `ERR_UPDATER_ZIP_FILE_NOT_FOUND`
  NOR an HTTP 404 error. After Squirrel.Mac extracts + replaces the
  .app bundle, the app relaunches into v1.1.3. Sequoia Gatekeeper may
  re-prompt "Open Anyway" post-relaunch (RESEARCH §Risk #3 — expected
  for ad-hoc cert mismatch; NOT an UPDFIX-01 failure). After relaunch,
  Help → About reports `1.1.3` (NOT `1.1.1`).
result: pending — see operator runbook below.
reason: by-design human-in-the-loop — Squirrel.Mac swap is kernel-level OS
  behavior; integration tests cannot simulate.

operator runbook (Leo, on this macOS host):
  1. Verify v1.1.1 is installed:
       ls "/Applications/Spine Texture Manager.app" 2>&1
     If a v1.1.2 .app from prior install OR a v1.1.3 .app from the local
     pre-flight build exists, UNINSTALL FIRST so the upgrade path is
     exercised cleanly:
       rm -rf "/Applications/Spine Texture Manager.app"
     Then install v1.1.1 fresh:
       gh release download v1.1.1 --pattern "*arm64.dmg" --dir ~/Downloads
       open ~/Downloads/Spine.Texture.Manager-1.1.1-arm64.dmg
       # drag to /Applications, eject DMG
  2. Quit any running Spine Texture Manager instance.
  3. Launch v1.1.1 from /Applications via Spotlight or Dock.
     (Approve Gatekeeper "Open" prompt if presented.)
  4. IMMEDIATELY open DevTools: View → Toggle Developer Tools (Cmd+Option+I).
  5. Wait ~5 seconds for the startup-check setTimeout to fire.
  6. Filter the console for "auto-update". EXPECTED: 3 log lines:
       [auto-update] startup-check: setTimeout fired
       [auto-update] checkUpdate: trigger=startup, version=1.1.1
       [auto-update] event: update-available, version=1.1.3
     Copy these 3 lines verbatim into the result block below.
  7. UpdateDialog should auto-open with v1.1.3 available.
  8. Click "Download & Restart".
  9. WATCH the DevTools console during the download. EXPECTED:
     NO line containing `ERR_UPDATER_ZIP_FILE_NOT_FOUND` AND NO HTTP 404
     line referencing `Spine-Texture-Manager-1.1.3-arm64.zip` (the dashes
     form — that's the v1.1.2 bug). The download URL the client actually
     fetches MUST be the dots form
     `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/download/v1.1.3/Spine.Texture.Manager-1.1.3-arm64.zip`.
     If you can capture the Network tab request URL, paste it; otherwise
     just confirm absence of 404 + ZIP_FILE_NOT_FOUND.
 10. App should relaunch automatically. If Sequoia presents "Open Anyway"
     dialog, accept it (expected for ad-hoc cert mismatch).
 11. After relaunch, click Help → About. EXPECTED: version reads `1.1.3`.
 12. Paste under this `result:` block:
       a. The 3 startup log lines (verbatim)
       b. Confirmation of NO ERR_UPDATER_ZIP_FILE_NOT_FOUND in download phase
       c. Confirmation of NO HTTP 404 lines referencing the .zip
       d. (Optional) the Network tab download URL
       e. Whether Sequoia "Open Anyway" appeared post-relaunch
       f. The version reported by Help → About
       g. Optionally, a screenshot of the About dialog
 13. Flip `result: pending → passed` if all expected lines fire and
     version reports 1.1.3; `result: failed` if anything goes wrong.
     If FAILED, capture the full transcript — D-15-LIVE-1 was supposed
     to be closed by v1.1.3; another failure means the fix didn't take
     OR there's a different defect we missed.

### v1.1.2 mac stranded user verification (manual download path; LOW-priority confidence check)

context: Any installed v1.1.2 mac client cannot auto-update to v1.1.3
  (its broken url construction will still 404). The release-notes callout
  in v1.1.3 directs these users to manually download. This test verifies
  the manual-download instructions actually work.
expected: User on v1.1.2 mac client clicks Help → Check for Updates,
  sees the v1.1.2-broken-update error (HTTP 404 — same as the original
  D-15-LIVE-1 transcript). User reads the v1.1.3 Release notes, follows
  the manual-download link, downloads `Spine.Texture.Manager-1.1.3-arm64.dmg`,
  drag-installs over /Applications/Spine Texture Manager.app, launches,
  and Help → About reports `1.1.3`.
result: deferred — operationally indistinguishable from a fresh-install
  of v1.1.3, which is already covered by INSTALL.md. Mark `signed-off
  (covered by existing INSTALL.md flow)` post-publication.

## Operator notes — pre-tag UAT execution by human

Tests 1 + 3 (macOS) executed by the human operator (Leo) on the
local macOS box. The agent cannot launch packaged Electron apps
interactively or capture DevTools console output from them; this is
not a tooling gap — it's the inherent boundary between automation
and human-in-the-loop verification.

Operator runbook for Tests 1 + 3:

1. Quit any running Spine Texture Manager instance.
2. Open Finder → `release/Spine Texture Manager-1.1.2-arm64.dmg`
   (double-click to mount).
3. Drag `Spine Texture Manager.app` onto the Applications folder
   alias inside the .dmg window. Eject the .dmg.
4. Launch the new install from /Applications via Spotlight or Dock.
   Approve any Gatekeeper prompts (the build is unsigned ad-hoc).
5. Open DevTools immediately on launch: `View → Toggle Developer Tools`
   from the menu, OR `Cmd+Option+I`.
6. **Test 1 capture (cold-start):** wait 5 seconds. Filter the
   console for "auto-update" — copy ALL `[auto-update]` lines
   verbatim into Test 1 `result:` block above.
7. **Test 3 capture (manual idle):** WITHOUT loading any project,
   click `Help → Check for Updates` from the menu bar. Wait 10
   seconds. Capture all new `[auto-update]` lines into Test 3
   `result:` block.
8. Update `## Summary` block: increment `passed:` for each test that
   matched the `expected:` block; increment `issues:` if any expected
   line was missing.

If a test reveals a regression (e.g. the cold-start log lines never
fire, or the manual-check from idle hangs), the user can ABORT at
CHECKPOINT 2 — the v1.1.2 tag is local-only at this stage, and
deleting it pre-push is a single `git tag -d v1.1.2` away.

## Gaps

(Populate after all tests run; mirror 14-HUMAN-UAT.md `## Gaps` shape.)
