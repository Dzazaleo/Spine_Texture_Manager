---
status: partial
phase: 16-macos-auto-update-manual-download-ux
source: [16-VERIFICATION.md]
started: 2026-04-30T11:14:00Z
updated: 2026-04-30T11:14:00Z
---

## Current Test

[awaiting human testing on packaged macOS build]

## Tests

### 1. Packaged macOS build shows 'Open Release Page' button when newer release available
expected: On macOS, when v1.2.0 (or any newer release) is published, the installed app's UpdateDialog opens with [Open Release Page] + [Later] buttons (NOT [Download + Restart]). No Squirrel.Mac swap is attempted; no `~/Library/Caches/com.spine.texture-manager.ShipIt/` activity; no code-signature mismatch error in DevTools console.
result: [pending]
why_human: Observable only on a packaged + installed macOS build receiving a real GitHub Releases feed event — code review and unit tests prove the routing logic is correct, but live UAT confirmation must wait for the v1.2.0 ship round. The Phase 16 PR explicitly defers package.json bump + tag + CI run + GitHub Release publish to a separate downstream task.

### 2. Clicking 'Open Release Page' on macOS launches default browser at /releases/tag/v{version}
expected: Browser opens at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0 (the per-release URL — Phase 16 D-04). User sees the .dmg / .exe / .AppImage assets directly. No errors in main DevTools console.
result: [pending]
why_human: Requires `shell.openExternal` invocation on a real macOS host — vitest cannot exercise the actual browser launch. Code path proves URL flows through SHELL_OPEN_EXTERNAL_ALLOWED guarded by `isReleasesUrl` helper (9 unit tests cover the URL shape contract).

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
