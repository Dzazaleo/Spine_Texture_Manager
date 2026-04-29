---
phase: 14
slug: auto-update-reliability-fixes-renderer-state-machine
status: reconstructed
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-29
---

# Phase 14 — Validation Strategy

> Reconstructed from artifacts (no pre-existing VALIDATION.md). All 6 plans executed with `tdd="true"`; all 75 Phase 14 spec assertions are automated and green. The 6 live-OS UAT items are by-design Manual-Only (Phase 14 is code-only per ROADMAP contract; Phase 15 owns live release verification).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.5 |
| **Config file** | `vitest.config.ts` |
| **Environments** | `jsdom` for renderer specs (`tests/renderer/*.spec.tsx`); `node` for main / integration / preload specs |
| **Quick run command** | `npx vitest run tests/main/auto-update-dismissal.spec.ts tests/renderer/app-update-subscriptions.spec.tsx tests/integration/auto-update-shell-allow-list.spec.ts tests/preload/request-pending-update.spec.ts tests/main/auto-update.spec.ts tests/main/ipc.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime (Phase 14 spec set)** | ~730 ms (6 files / 75 tests) |

---

## Sampling Rate

- **After every task commit:** Run the file under change (e.g. `npx vitest run tests/main/auto-update-dismissal.spec.ts`)
- **After every plan wave:** Run the Phase 14 spec set above (~730 ms)
- **Before `/gsd-verify-work`:** Full suite (`npm run test`) must be green
- **Max feedback latency:** ~1 second for the Phase 14 set; ~10 s for the full suite

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|----------|-----------|-------------------|-------------|--------|
| 14-01-01 | 01 | 1 | UPDFIX-02, UPDFIX-03 | T-14-01-01..06 | Sticky `pendingUpdateInfo` slot + `lastCheckTrigger` thread + asymmetric `deliverUpdateAvailable` + 9 `console.info` instrumentation points | unit | `npx vitest run tests/main/auto-update.spec.ts tests/main/auto-update-dismissal.spec.ts` | ✅ | ✅ green (28 + 13) |
| 14-01-02 | 01 | 1 | UPDFIX-03 | T-14-01-07 | `update:request-pending` IPC handler + D-12 SHELL allow-list URL preserved | unit | `npx vitest run tests/main/ipc.spec.ts` | ✅ | ✅ green (16) |
| 14-02-01 | 02 | 1 | UPDFIX-03, UPDFIX-04 | T-14-02-01..04 | `window.api.requestPendingUpdate` one-shot invoke bridge + 9 existing bridges byte-unchanged | unit (source-grep contract) | `npx vitest run tests/preload/request-pending-update.spec.ts` | ✅ | ✅ green (7) |
| 14-03-01 | 03 | 2 | UPDFIX-02, UPDFIX-03, UPDFIX-04 | T-14-03-01..05 | Lift updateState + manualCheckPendingRef + 5-channel useEffect + UpdateDialog mount + late-mount sticky-slot fetch into App.tsx | integration (renderer) | `npx vitest run tests/renderer/app-update-subscriptions.spec.tsx` | ✅ | ✅ green (7) |
| 14-03-02 | 03 | 2 | UPDFIX-02, UPDFIX-03, UPDFIX-04 | T-14-03-01..05 | Remove update-related code from AppShell.tsx; preserve `onMenuInstallationGuide` 1-channel useEffect | integration (renderer regression) | `npx vitest run tests/renderer/save-load.spec.tsx tests/renderer/help-dialog.spec.tsx tests/renderer/update-dialog.spec.tsx tests/renderer/app-shell-output-picker.spec.tsx` | ✅ | ✅ green (50+) |
| 14-04-01 | 04 | 3 | UPDFIX-02, UPDFIX-03, UPDFIX-04 | T-14-04-01..04 | Greenfield `tests/main/auto-update-dismissal.spec.ts` covering D-05 asymmetric / D-06 trigger-agnostic Later / D-07 windows-fallback / D-03 sticky slot / D-10 logging | unit | `npx vitest run tests/main/auto-update-dismissal.spec.ts` | ✅ | ✅ green (13 incl. (14-l)/(14-m) from 14-06) |
| 14-04-02 | 04 | 3 | UPDFIX-02, UPDFIX-03, UPDFIX-04 | T-14-04-01..04 | Greenfield `tests/renderer/app-update-subscriptions.spec.tsx` exercising App.tsx lift + late-mount hydration + idle-state UpdateDialog | integration (renderer) | `npx vitest run tests/renderer/app-update-subscriptions.spec.tsx` | ✅ | ✅ green (7) |
| 14-05-01 | 05 | 3 | UPDFIX-02 | T-14-05-01..04 | Greenfield URL-consistency integration spec (App.tsx ↔ ipc.ts SHELL allow-list ↔ auto-update.ts GITHUB_RELEASES_INDEX_URL byte-for-byte) | integration (source-grep) | `npx vitest run tests/integration/auto-update-shell-allow-list.spec.ts` | ✅ | ✅ green (4) |
| 14-05-02 | 05 | 3 | UPDFIX-02, UPDFIX-03, UPDFIX-04 | — | Whole-suite regression check + must-have grep-verify (no new test files) | verification | `npm run test && npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.web.json` | n/a | ✅ green |
| 14-06-01 | 06 | (gap-closure) | UPDFIX-02 | T-14-06-01 | Wire `clearPendingUpdateInfo()` into `update:download` + `update:dismiss` IPC handlers (closes WR-01 dangling contract) | unit (regression in 14-06-02) | `npx vitest run tests/main/auto-update-dismissal.spec.ts tests/main/ipc.spec.ts` | ✅ | ✅ green |
| 14-06-02 | 06 | (gap-closure) | UPDFIX-02 | T-14-06-01 | (14-l) IPC dismiss path empties slot + (14-m) IPC download path empties slot — regression assertions | unit | `npx vitest run tests/main/auto-update-dismissal.spec.ts` | ✅ | ✅ green (13/13) |
| 14-06-03 | 06 | (gap-closure) | UPDFIX-02, UPDFIX-03, UPDFIX-04 | — | Full Phase 14 regression net (75 tests / 6 files) + dual typecheck | verification | (Quick run command above) `&& npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.web.json` | n/a | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No Wave 0 setup was needed — Phase 14 inherited the Phase 12 vitest scaffold (`vi.hoisted` + `vi.mock` for main specs; `Object.defineProperty(window, 'api', ...)` idiom for renderer specs; `tests/integration/install-md.spec.ts` URL-consistency pattern reused for `auto-update-shell-allow-list.spec.ts`).

---

## Manual-Only Verifications

These items are Manual-Only **by design**: Phase 14 is code-only per the ROADMAP contract, and packaged-build flows on real macOS/Windows hosts cannot run under vitest jsdom. They are exhaustively documented in `14-HUMAN-UAT.md` and `14-VERIFICATION.md` `human_verification:`. Phase 15 owns live release verification.

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| 1 | macOS cold-start auto-check fires within ~3-5 s on dock launch; UpdateDialog auto-mounts when newer version published | UPDFIX-03 / SC-3 (mac) | Requires packaged macOS build + real GitHub Releases feed; vitest jsdom cannot exercise the 3.5 s setTimeout + IPC + DOM end-to-end | Launch packaged v1.1.1 .dmg via Dock; open DevTools (Cmd-Opt-I); within ~5 s expect log sequence `[auto-update] initAutoUpdater: entry` → `startup-check: setTimeout fired` → `checkUpdate: trigger=startup, version=1.1.1` → `event: update-available`/`update-not-available`. Network failures silently swallowed. |
| 2 | Windows cold-start auto-check fires within ~3-5 s; UpdateDialog auto-mounts with `variant='windows-fallback'` (SPIKE_PASSED=false on win32) showing 'Open Release Page' | UPDFIX-03 / SC-3 (win) | Platform-gated `SPIKE_PASSED = process.platform !== 'win32'` branch only runs on a real Windows host | Same as item 1 but on a Windows box with the v1.1.1 NSIS build. Confirm `windows-fallback` variant in DOM and that the 'Open Release Page' button is visible. |
| 3 | macOS Help → Check for Updates from idle (no project loaded) returns visible feedback within ~10 s | UPDFIX-04 / SC-1 | OS-level Help menu interaction in idle state — vitest cannot click an OS menu (App.tsx subscription registration in idle IS unit-tested by `app-update-subscriptions.spec.tsx` (14-i)) | Launch packaged macOS build; do NOT load any `.json`/`.stmproj`; click `Help → Check for Updates` immediately. Within ~10 s UpdateDialog mounts with one of: 'Update available', "You're up to date", or graceful offline error. |
| 4 | Windows Help → Check for Updates from idle behaves identically to macOS (feedback ≤ 10 s; no silent swallow; no project-load gate) | UPDFIX-04 / SC-2 | Same rationale as item 3 — real OS menu interaction | Same as item 3 on a Windows host. |
| 5 | Windows manual re-check after Later dismissal re-presents (D-05 asymmetric override); next cold-start auto-check does NOT re-present (D-08 startup suppression preserved) | UPDFIX-02 / SC-5 | Real persistence + real autoUpdater event firing + real OS restart cycle. Asymmetric rule IS unit-tested ((14-a)); persistence-across-restart half is live-UAT only | Packaged Windows v1.1.1 with newer version published. Open UpdateDialog; click 'Later' (writes `dismissedUpdateVersion` to `update-state.json`). Click `Help → Check for Updates` again — UpdateDialog re-presents. Restart app — next cold-start does NOT re-present same dismissed version. |
| 6 | Windows UpdateDialog 'Open Release Page' button opens `https://github.com/Dzazaleo/Spine_Texture_Manager/releases` in system browser via `shell.openExternal` | UPDFIX-02 / SC-4 | `shell.openExternal` is OS-mediated; URL-consistency IS integration-tested ([auto-update-shell-allow-list.spec.ts](tests/integration/auto-update-shell-allow-list.spec.ts)) but the actual click-through requires a packaged build | Packaged Windows v1.1.1 with newer version published. UpdateDialog opens with 'Open Release Page' button (SPIKE_PASSED=false branch). Click it → system browser opens at the canonical Releases URL. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify (12 task entries; 10 with command, 2 verification-only)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no Wave 0 needed — existing infrastructure suffices)
- [x] No watch-mode flags (all commands use `vitest run`, not `vitest`)
- [x] Feedback latency < ~1 s for Phase 14 spec set; < ~10 s for full suite
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** reconstructed 2026-04-29 from artifacts; all 75 Phase 14 spec assertions green; 6 Manual-Only items appropriately deferred to Phase 15 live release wave per ROADMAP contract.
