---
status: resolved
phase: 16-macos-auto-update-manual-download-ux
source: [16-VERIFICATION.md]
started: 2026-04-30T11:14:00Z
updated: 2026-04-30T11:25:00Z
verified_via: dev-mode synthetic injection (temporary __triggerUpdateForUAT hook in App.tsx, applied + reverted in working tree, never committed)
---

## Current Test

[complete — both items passed via dev-mode synthetic injection]

## Tests

### 1. UpdateDialog renders [Open Release Page] button on manual-download variant
expected: When a `variant: 'manual-download'` update payload arrives, UpdateDialog opens with [Open Release Page] + [Later] buttons (NOT [Download + Restart]).
result: PASS
verified: 2026-04-30 — User ran `npm run dev` on macOS (darwin), opened renderer DevTools, called `window.__triggerUpdateForUAT('manual-download')` (temp dev hook), and confirmed the dialog rendered [Open Release Page] + [Later]. Synthetic payload: `version=1.2.0`, `fullReleaseUrl=https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0`.
why_human: Observable only on a real Electron renderer host — vitest's jsdom environment cannot exercise the actual layout/styling/click affordance. Synthetic injection is functionally equivalent to a real `update-available` event for the purpose of verifying the renderer rendering path.

### 2. Clicking [Open Release Page] on macOS launches default browser at /releases/tag/v{version}
expected: Browser opens at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0 (per-release URL — Phase 16 D-04). User sees the .dmg / .exe / .AppImage assets directly. No errors in DevTools console.
result: PASS
verified: 2026-04-30 — User clicked [Open Release Page] in the synthetic-event dialog. Default browser opened at the correct per-release URL. (GitHub returned 404 because v1.2.0 is not yet tagged — expected, the test is the URL launch, not the page content.) No errors in renderer DevTools console.
why_human: Requires `shell.openExternal` invocation on a real macOS host — vitest cannot exercise the actual browser launch.

### Observation (non-blocking)
The dialog does NOT auto-close after clicking [Open Release Page]. User confirmed this is desirable behavior — if the user closes the browser tab and needs to re-click, the dialog is still present.

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none — both items PASS)

## Future ship-round verification (out of phase scope)

When v1.2.0 is built + tagged + published, re-verify items 1+2 against a packaged + installed macOS build receiving a real GitHub Releases feed event (no synthetic injection). This will additionally exercise the upstream `electron-updater` → `autoUpdater.on('update-available')` event handler in `src/main/auto-update.ts`, which is already covered by unit tests but not yet by live UAT against a real release.
