---
phase: 16-macos-auto-update-manual-download-ux
verified: 2026-04-30T11:13:00Z
status: passed
score: 5/5
must_haves_total: 5
must_haves_verified: 5
requirements: [UPDFIX-05]
overrides_applied: 0
human_verification_resolved: 2026-04-30T11:25:00Z
human_verification_method: "dev-mode synthetic injection via temporary __triggerUpdateForUAT hook in App.tsx (applied + reverted in working tree, never committed). User confirmed both items PASS on macOS (darwin) — see 16-HUMAN-UAT.md for transcript."
human_verification:
  - test: "UpdateDialog renders [Open Release Page] button on manual-download variant"
    result: PASS
    verified_via: "dev-mode synthetic injection — `npm run dev` + `window.__triggerUpdateForUAT('manual-download')` in renderer DevTools console"
  - test: "Clicking [Open Release Page] on macOS launches default browser at /releases/tag/v{version}"
    result: PASS
    verified_via: "dev-mode synthetic injection — clicking the button in the synthetic-event dialog opened default browser at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0"
future_uat:
  - test: "Re-verify items 1+2 against a packaged + installed macOS build receiving a real GitHub Releases feed event when v1.2.0 ships"
    why: "Synthetic injection covers the renderer + IPC + shell.openExternal path. The upstream electron-updater → autoUpdater.on('update-available') handler is covered by unit tests but not yet by live UAT against a real release. This is out of Phase 16 scope (package.json bump + tag + CI run + GitHub Release publish are deferred to the v1.2.0 ship round)."
---

# Phase 16: macOS auto-update manual-download UX Verification Report

**Phase Goal:** Replace Squirrel.Mac in-process update swap on macOS with the existing windows-fallback UpdateDialog variant pattern — open the GitHub Releases page in the user's browser instead of attempting a code-signature-validated swap that fails on ad-hoc-signed builds. Closes D-15-LIVE-2 empirically observed during Phase 15 v1.1.3 Test 7-Retry round 3 (2026-04-29).

**Verified:** 2026-04-30T11:13:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth                                                                                                                                                                | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | On macOS, UpdateDialog opens in `manual-download` variant — user sees "Open Release Page" button rather than "Download & Relaunch"                                   | VERIFIED   | `src/main/auto-update.ts:123` `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`; routing at `src/main/auto-update.ts:493-496` evaluates `'manual-download'` for darwin (no spike override path on macOS — D-02). `src/renderer/src/modals/UpdateDialog.tsx:212-219` renders `Open Release Page` button under `variant === 'manual-download'` branch. Test `tests/main/auto-update-dismissal.spec.ts:241-271` mocks `process.platform = 'darwin'` and asserts payload `variant: 'manual-download'`.            |
| 2   | Clicking "Open Release Page" launches GitHub Releases page in browser via SHELL_OPEN_EXTERNAL_ALLOWED — no code-signature swap, no Squirrel.Mac error                | VERIFIED   | `src/renderer/src/App.tsx:571-581` `onOpenReleasePage` invokes `window.api.openExternalUrl(updateState.fullReleaseUrl)`. `src/main/ipc.ts:721-739` `shell:open-external` handler: `if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url) && !isReleasesUrl(url)) return;` then `shell.openExternal(url)`. `isReleasesUrl` at `ipc.ts:223-252` enforces https + `parsed.hostname === 'github.com'` + structural pathname match. 13 tests at `tests/integration/auto-update-shell-allow-list.spec.ts` lock the contract.              |
| 3   | Variant rename `windows-fallback` → `manual-download` propagates consistently across auto-update.ts, ipc.ts, UpdateDialog.tsx, INSTALL.md, Help dialog, vitest specs | VERIFIED   | `grep -rn "windows-fallback" src/` returns 0 matches across all 6 src files. UpdateDialog.tsx has 9 `manual-download` references (1 type export at line 73 + 5 conditional branches at lines 127, 198, 212, 231, 250, 260, 279 + 3 comments). `tests/integration/no-windows-fallback-literal.spec.ts:51-118` provides a recursive regression-gate scan that fails CI on any future reintroduction. INSTALL.md `## After installation: auto-update` (lines 137-141) describes manual-download flow for macOS+Windows.   |
| 4   | Windows behavior unchanged — opens `manual-download` variant under renamed symbol; Phase 12 D-04 + Phase 14 D-13 contracts preserved                                 | VERIFIED   | `src/main/auto-update.ts:493-496` retains the Windows runtime escape hatch (`spikeRuntimePass = state.spikeOutcome === 'pass'`) under D-02. Without spike promotion, Windows evaluates `IN_PROCESS_AUTO_UPDATE_OK || (process.platform === 'win32' && spikeRuntimePass)` = `false || (true && false)` = false → routes to `'manual-download'`. With spike promotion, the same Windows host can be promoted to `'auto-update'` at runtime via `update-state.json` — Phase 14 D-13 escape hatch verbatim.              |
| 5   | INSTALL.md + in-app HelpDialog text describe macOS update flow as "open the GitHub Releases page in your browser, download .dmg, replace the app" — no in-app auto-update copy on macOS | VERIFIED   | `INSTALL.md:139-141` reads: "On Linux, accepting an update downloads the new version and prompts you to restart. On macOS and Windows, the app shows a non-blocking notice with a button to open the Releases page — download the new installer manually and run it (re-triggering the first-launch Gatekeeper / SmartScreen step)." HelpDialog re-verified per D-06 — 0 matches for `update`, `auto-update`, `squirrel`, `windows-fallback`, `manual-download`, `Check for Updates` in `src/renderer/src/modals/HelpDialog.tsx`. UpdateDialog (the actual dialog launched by Help → Check for Updates) carries the manual-download variant per truth 1. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact                                                  | Expected                                                  | Status      | Details                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------- | --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/main/auto-update.ts`                                 | Renamed gate + `manual-download` variant + per-release URL | VERIFIED   | Line 123 `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`; line 54 `variant: 'auto-update' \| 'manual-download'`; line 507 `fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v${info.version}'`. SPIKE_PASSED count = 0 in src/.                                                                          |
| `src/main/ipc.ts`                                         | `isReleasesUrl` helper + extended allow-list              | VERIFIED   | Line 162-184 `SHELL_OPEN_EXTERNAL_ALLOWED` Set retained (Phase 14 backward-compat). Line 223-252 `export function isReleasesUrl` (URL-parse + hostname-equals + pathname-prefix). Line 732 `if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url) && !isReleasesUrl(url)) return;` integrates the structural fallback.                                          |
| `src/preload/index.ts`                                    | contextBridge variant type renamed                        | VERIFIED   | Lines 437, 459, 468 — all 3 variant literals are `'auto-update' \| 'manual-download'`. Wave-1 boundary clean.                                                                                                                                                                                                                                       |
| `src/renderer/src/App.tsx`                                | Variant narrowing + `fullReleaseUrl` flow                 | VERIFIED   | `updateState` type extended with `fullReleaseUrl: string` (line 95). Subscribers at lines 374, 431 use `payload.variant === 'manual-download' ? 'manual-download' : 'auto-update'`. Lines 393, 409 set `fullReleaseUrl: ''` for state='none' branches. Line 579 `window.api.openExternalUrl(updateState.fullReleaseUrl)` flows the runtime URL.   |
| `src/renderer/src/modals/UpdateDialog.tsx`                | `UpdateDialogVariant` literal + 5 conditional branches    | VERIFIED   | Line 73 `UpdateDialogVariant = 'auto-update' \| 'manual-download'`. Branches at lines 127, 198, 212, 231, 250, 260, 279 — all reference `'manual-download'`. Open Release Page button at line 219 in `variant === 'manual-download'` branch. No body/state-machine changes.                                                                       |
| `src/shared/types.ts`                                     | Shared variant type literal                               | VERIFIED   | Lines 918, 945, 963 all use `'auto-update' \| 'manual-download'`. Comment at 918 updated to match the type.                                                                                                                                                                                                                                       |
| `INSTALL.md`                                              | Auto-update section rewrite                               | VERIFIED   | Lines 137-141 — Linux owns in-process sentence; macOS+Windows share manual-download paragraph. `auto-update-capable` conditional dropped. `Open the Releases page` + `Gatekeeper / SmartScreen` re-trigger note present.                                                                                                                          |
| `tests/integration/no-windows-fallback-literal.spec.ts`   | Regression gate recursive-scan spec                       | VERIFIED   | New file, 118 lines. Two specs: `(16-r1)` broad substring scan + `(16-r2)` typed-literal exact match. Both pass against the Phase-16-clean tree. Catches future regressions to lowercase `windows-fallback` literal anywhere under src/.                                                                                                          |
| `src/renderer/src/modals/HelpDialog.tsx`                  | No-op surface (D-06 confirmed)                            | VERIFIED   | grep returns 0 matches for `update`, `auto-update`, `squirrel`, `windows-fallback`, `manual-download`, `Check for Updates`. CONTEXT.md D-06 re-verification confirmed; no edit was required.                                                                                                                                                      |

### Key Link Verification

| From                                                           | To                                                                | Via                                                                              | Status     | Details                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/main/auto-update.ts deliverUpdateAvailable`               | `UpdateAvailablePayload` type                                     | variant field; `'auto-update' \| 'manual-download'`                              | WIRED      | `src/main/auto-update.ts:54` defines the type; `:493-496` constructs the literal; `:506` assigns into payload. Same byte-for-byte literal flows through preload + renderer.                                                                                                                                              |
| `src/main/auto-update.ts deliverUpdateAvailable`               | `src/main/ipc.ts shell:open-external`                             | fullReleaseUrl payload field → renderer → openExternalUrl IPC                    | WIRED      | `auto-update.ts:507` emits per-release URL; `App.tsx:375, 432` captures into `updateState.fullReleaseUrl`; `App.tsx:579` calls `openExternalUrl`; `ipc.ts:721-739` accepts via `isReleasesUrl` (Set.has fallback first, then structural check).                                                                            |
| `src/renderer/src/App.tsx onOpenReleasePage`                   | `src/main/ipc.ts shell:open-external`                             | `window.api.openExternalUrl(updateState.fullReleaseUrl)`                         | WIRED      | App.tsx:579 calls bridge with runtime URL (no hardcoded literal); ipc.ts:732 guards via `isReleasesUrl`. Test `(14-p)` at `tests/integration/auto-update-shell-allow-list.spec.ts:64-79` asserts the new contract: `expect(appTsx).toContain('openExternalUrl(updateState.fullReleaseUrl)')`.                              |
| `src/renderer/src/App.tsx update-state.variant`                | `src/renderer/src/modals/UpdateDialog.tsx variant prop`           | prop forwarding                                                                   | WIRED      | App.tsx feeds `updateState.variant` into the UpdateDialog component; UpdateDialog branches at lines 127, 198, 212, 231, 250, 260, 279 react on the manual-download literal.                                                                                                                                              |
| `tests/integration/no-windows-fallback-literal.spec.ts`        | recursive `src/` tree                                             | `walk()` + `readFileSync` + `content.includes('windows-fallback')`               | WIRED      | New spec at lines 36-117. Both `(16-r1)` and `(16-r2)` pass currently. Future commits introducing the lowercase literal anywhere under src/ will fail CI at this gate.                                                                                                                                                  |

### Data-Flow Trace (Level 4)

| Artifact                                              | Data Variable        | Source                                                          | Produces Real Data | Status   |
| ----------------------------------------------------- | -------------------- | --------------------------------------------------------------- | ------------------ | -------- |
| `src/renderer/src/modals/UpdateDialog.tsx`            | `variant` prop       | `App.tsx updateState.variant` populated from main IPC payload   | Yes                | FLOWING  |
| `src/renderer/src/App.tsx onOpenReleasePage`          | `updateState.fullReleaseUrl` | `payload.fullReleaseUrl` set in `onUpdateAvailable` + `requestPendingUpdate` from main `deliverUpdateAvailable` | Yes | FLOWING |
| `src/main/ipc.ts shell:open-external`                 | `url`                | renderer-supplied via `openExternalUrl` IPC                      | Yes                | FLOWING  |
| `src/main/auto-update.ts deliverUpdateAvailable`      | `info.version`       | electron-updater (parses published GitHub release tag)          | Yes (live)         | FLOWING  |

No hollow props. No disconnected data sources. The renderer no longer hardcodes `https://github.com/.../releases` — it forwards the live runtime URL from main.

### Behavioral Spot-Checks

| Behavior                                                                | Command                                                                                       | Result                              | Status |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- | ------ |
| Full vitest suite passes (47 files, 531 tests + 1 skipped + 2 todo)     | `npm test`                                                                                    | `Tests 531 passed | 1 skipped | 2 todo (534)` | PASS  |
| Phase 16 D-04 IPC allow-list helper covers 9 happy paths + threats      | `npm test -- tests/integration/auto-update-shell-allow-list.spec.ts` (subset of full run)      | 13 tests pass (4 Phase 14 + 9 Phase 16 D-04) | PASS  |
| Regression-gate scan finds zero `windows-fallback` literals under src/  | `tests/integration/no-windows-fallback-literal.spec.ts` (16-r1 + 16-r2)                       | Both specs pass                     | PASS  |
| Asymmetric-dismissal rule survives under macOS-darwin platform mock     | `(14-e)` test mocks `process.platform = 'darwin'`, asserts `variant: 'manual-download'`       | Test passes                         | PASS  |
| `grep -rn "'windows-fallback'" src/` returns no matches                 | shell grep                                                                                    | 0 matches                           | PASS  |
| `grep -rn "SPIKE_PASSED" src/` returns no matches                       | shell grep                                                                                    | 0 matches                           | PASS  |

### Requirements Coverage

| Requirement | Source Plan          | Description                                                                                                                                                                                              | Status     | Evidence                                                                                                                                                                                                                                                       |
| ----------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| UPDFIX-05   | All 6 plans          | macOS UpdateDialog opens in `manual-download` variant (not Squirrel.Mac swap); Open Release Page button launches GitHub Releases via SHELL_OPEN_EXTERNAL_ALLOWED; rename propagates everywhere; closes D-15-LIVE-2 | SATISFIED  | All 5 ROADMAP success criteria verified above. UPDFIX-05 closed at code level — live UAT confirmation deferred to v1.2.0 ship round (Phase 16 explicitly defers tag/CI/publish per CONTEXT.md `<domain>` Out of Scope).                                          |

REQUIREMENTS.md Phase 16 mapping shows UPDFIX-05 as the sole REQ for Phase 16. All 6 plans declare `requirements: [UPDFIX-05]` in frontmatter — no orphans, no missing claims. No requirements assigned to Phase 16 in REQUIREMENTS.md without a covering plan.

### Anti-Patterns Found

| File                  | Line | Pattern                                                          | Severity | Impact                                                                                                                                                                                                                                                                                  |
| --------------------- | ---- | ---------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/main/ipc.ts`     | 171  | Stale comment: `AND the Windows-fallback "Open Release Page" button` | Info     | Capital-W `Windows-fallback` (mixed case) — comment-only, describes the button's purpose by historical name. Code path is correct; the regression-gate `(16-r1)` scan uses lowercase substring `windows-fallback` and passes. Pure documentation drift; no code or test impact. Worth a future cleanup but does NOT block goal achievement. |

The two CR-WR-01 + CR-WR-02 warnings from `16-REVIEW.md` are not Phase 16 scope blockers:
- WR-01 (optional `variant?` in preload type) — surfaced by code review; an optional field permits silent fail-open. Preload + Api do declare `variant?` (lines 437, 459, 468 + 945, 963), but main always populates the field, the runtime ternary in App.tsx defaults to `'auto-update'`, and the dismissal-gate test mocking darwin proves the `'manual-download'` literal flows correctly under the live routing. This is hardening (not goal achievement); appropriate for a follow-up plan.
- WR-02 (isReleasesUrl accepts URLs with userinfo / query / fragment) — code review hardening recommendation. The realistic threat ("phishing via authority confusion") requires a renderer compromise to forge the URL; main itself only emits the per-release URL shape (no userinfo, no query, no fragment). Defense-in-depth tightening, not a Phase 16 success-criteria gap.

No blocking anti-patterns. No console.log-only handlers. No empty implementations. No hardcoded empty data flowing to render. All five UpdateDialog button branches (Open Release Page, Download + Restart, Downloading…, Restart, Dismiss) are wired to actual handlers.

### Human Verification Required

Two items require live UAT on a packaged macOS build receiving a real GitHub Releases feed event. Phase 16 ships the code; live observation must wait for the v1.2.0 ship round (Phase 16 explicitly defers package.json bump + tag + CI + publish per CONTEXT.md `<domain>` Out of Scope).

#### 1. macOS shows manual-download dialog when newer release published

**Test:** Install a packaged ad-hoc-signed v1.2.0 (or any successor) on macOS while a newer release exists on the GitHub Releases feed. Wait for the 3.5s startup auto-check OR click Help → Check for Updates.

**Expected:** UpdateDialog renders with [Open Release Page] + [Later] buttons. NOT [Download + Restart]. No `~/Library/Caches/com.spine.texture-manager.ShipIt/` activity. No Squirrel.Mac code-signature mismatch error in DevTools console.

**Why human:** Observable only on a packaged + installed macOS build receiving a real GitHub Releases feed event. Code review and 531 unit tests prove the routing logic is correct, but the empirical macOS-host behavior is the load-bearing UAT (D-15-LIVE-2 was discovered at this exact step in Phase 15 Test 7-Retry round 3).

#### 2. Clicking "Open Release Page" launches default browser at /releases/tag/v{version}

**Test:** From the manual-download UpdateDialog on macOS, click "Open Release Page".

**Expected:** Default browser opens at `https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.2.0` (the per-release URL — Phase 16 D-04). User sees the .dmg / .exe / .AppImage assets directly. No errors in main DevTools console.

**Why human:** Requires `shell.openExternal` invocation on a real macOS host — vitest cannot exercise the actual browser launch. Code path proves URL flows through `SHELL_OPEN_EXTERNAL_ALLOWED` guarded by `isReleasesUrl` helper (9 unit tests cover the URL shape contract).

### Gaps Summary

No blocking gaps. All 5 ROADMAP success criteria pass goal-backward verification. The phase delivers exactly what its goal requires:

- Squirrel.Mac in-process swap is no longer attempted on macOS (gate constant is positive-form `IN_PROCESS_AUTO_UPDATE_OK = process.platform === 'linux'`; macOS has no escape hatch).
- The renamed `manual-download` variant flows end-to-end (main → preload → renderer → UpdateDialog), with 9 conditional branches and 1 type export updated, locked by the regression-gate spec.
- The IPC allow-list is structurally widened with a defended-in-depth helper (URL-parse + hostname-equals + pathname-prefix; threat model T-16-04-01..06 covered by 9 unit tests).
- INSTALL.md describes the new flow accurately. HelpDialog (the static documentation modal) was confirmed no-op per D-06 — UpdateDialog (the actual auto-update dialog) carries the renamed variant.
- Windows behavior is preserved verbatim (D-02 runtime escape hatch retained; default routing still goes to manual-download per Phase 14 D-13).

The only outstanding work is live UAT confirmation of items 1 and 2 in the Human Verification Required section above — those land in the eventual v1.2.0 ship round, NOT in Phase 16's deliverable.

A minor cleanup item is noted: a stale `Windows-fallback` (capital W) comment at `src/main/ipc.ts:171` describes the manual-download button by its old name. Pure documentation drift; no code or test impact; recommended to fold into the next auto-update-surface phase or a small docs-only follow-up.

---

_Verified: 2026-04-30T11:13:00Z_
_Verifier: Claude (gsd-verifier)_
