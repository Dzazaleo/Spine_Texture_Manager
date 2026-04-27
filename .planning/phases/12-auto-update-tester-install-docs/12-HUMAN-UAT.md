---
status: partial
phase: 12-auto-update-tester-install-docs
source: [12-VERIFICATION.md]
started: 2026-04-27T23:45:00Z
updated: 2026-04-27T23:45:00Z
---

## Current Test

[awaiting human testing — all 9 items blocked on phase 12.1 producing a publishable v1.1.0-rc2 with full 3-OS artifact set + feed files; the natural capture/observation moment lives in 12.1's tester rounds]

## Tests

### 1. macOS auto-update happy path (UPD-01..UPD-04, ROADMAP SC #1)
expected: Install v1.1.0 .dmg → publish v1.1.1 → relaunch v1.1.0 → modal appears with v1.1.1 release-notes Summary → click Download+Restart → app relaunches into v1.1.1; declining (Later) does not re-prompt on next startup
result: [pending]

### 2. Linux auto-update happy path (UPD-01..UPD-04, AppImage variant, ROADMAP SC #1)
expected: Same as macOS but via AppImage; latest-linux.yml feed drives detection
result: [pending]

### 3. Help → Check for Updates with no newer version (UPD-02, ROADMAP SC #2)
expected: Launch latest installed version → Help → Check for Updates → "You're up to date" message via UpdateDialog state='none' (D-05 — no native alert())
result: [pending]

### 4. Offline graceful (UPD-05, ROADMAP SC #3)
expected: Disconnect network → launch app → no error dialog, no crash, normal startup to load screen; DevTools console shows the swallow log only
result: [pending]

### 5. Windows manual-fallback notice (UPD-06, ROADMAP SC #4 — manual-fallback path)
expected: On Windows install (SPIKE_PASSED=false on win32), when the GitHub feed serves a newer release: UpdateDialog opens in 'windows-fallback' variant — version label + 'Open Release Page' button → clicks open https://github.com/Dzazaleo/Spine_Texture_Manager/releases externally; non-blocking, no nag loop, no modal interruption
result: [pending]

### 6. Gatekeeper "Open Anyway" first-launch on macOS (REL-03, ROADMAP SC #5)
expected: Download fresh .dmg on macOS → double-click → Gatekeeper dialog → right-click → Open → "Open Anyway" click → app launches; capture screenshot for INSTALL.md
result: [pending]

### 7. SmartScreen "More info → Run anyway" on Windows (REL-03, ROADMAP SC #5)
expected: Download fresh .exe on Windows 11 → run → SmartScreen dialog → More info → Run anyway → NSIS installer launches; capture screenshot for INSTALL.md
result: [pending]

### 8. libfuse2t64 error on Ubuntu 24.04 (REL-03, ROADMAP SC #5)
expected: Run AppImage on fresh Ubuntu 24.04 (no libfuse2t64 installed) → observe "dlopen(): error loading libfuse.so.2"; INSTALL.md paragraph wording matches actual error
result: [pending]

### 9. INSTALL.md 4 link surfaces — eyeballed verification (REL-03 / D-16)
expected: (1) Future tag push: GitHub release-template renders ${INSTALL_DOC_LINK} as https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md after envsubst; (2) README "Installing" section visible on github.com repo page; (3) In-app Help → Installation Guide… opens INSTALL.md externally via system browser; (4) HelpDialog "Install instructions" section link opens same URL
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

(none yet — all items are pending live verification, deferred naturally to phase 12.1's tester rounds)
