---
phase: 15-build-feed-shape-fix-v1-1-2-release
source: [15-VERIFICATION.md]
inherits: 14-HUMAN-UAT.md
status: pending
started: 2026-04-29T17:12:53Z
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

(Filled by Task 8 after v1.1.2 publication.)

### Test 5: Windows manual re-check after Later dismissal (UPDFIX-02 / Phase-14 ride-forward)
[deferred to Task 8]

### Test 6: Windows UpdateDialog Open Release Page button visibility (UPDFIX-02 windows-fallback / Phase-14 ride-forward)
[deferred to Task 8]

### Test 7: UPDFIX-01 macOS happy path (NEW for Phase 15)
[deferred to Task 8]

## Summary

total: 7 (4 pre-tag + 3 post-publish)
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 2 (Tests 2, 4 — Windows host unavailable)
deferred: 3 (Tests 5, 6, 7 — post-publish, owned by Task 8)

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
