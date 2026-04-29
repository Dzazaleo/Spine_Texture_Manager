---
phase: 12
slug: auto-update-tester-install-docs
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-27
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 12-RESEARCH.md §"Validation Architecture". Planner fills the Per-Task Verification Map after plans are written.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — see `vitest.config.ts` / `vitest.config.renderer.ts`) |
| **Config file** | `vitest.config.ts` (core/main), `vitest.config.renderer.ts` (renderer JSDOM) |
| **Quick run command** | `npm run test -- --run <file-glob>` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30–90 seconds locally; CI matrix runs 3× across `ubuntu-latest` + `windows-2022` + `macos-14` |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run <files-touched>`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite must be green on all three OS runners (CI matrix expansion D-22 enforces this)
- **Max feedback latency:** ~90 seconds local; ~3 minutes CI matrix

---

## Per-Task Verification Map

> Planner populates this table while writing 12-0X-PLAN.md files. Every UPD-* / REL-03 / F1 / F2 / F3 task lands in this table with an automated command OR a Manual-Only Verification entry below.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-XX | 01 | TBD | UPD-01..UPD-05 | — | electron-updater wired; "Later" persists; offline silent-swallow | unit + integration | `npm run test -- --run src/main/updater src/renderer/src/modals/UpdateDialog` | ❌ W0 | ⬜ pending |
| 12-02-XX | 02 | TBD | UPD-* (CI delivery) | — | `latest*.yml` published alongside installers; test matrix runs on 3 OSes | CI workflow assertion | `actionlint .github/workflows/release.yml && yamllint .github/workflows/release.yml` | ✅ existing | ⬜ pending |
| 12-03-XX | 03 | TBD | F1 (Phase 11 spillover) | — | atlas-image URL constructed via `pathToFileURL().pathname` (Windows-safe) | unit (renderer) | `npm run test -- --run src/renderer/src/modals/AtlasPreviewModal` | ❌ W0 | ⬜ pending |
| 12-04-XX | 04 | TBD | F2 (Phase 11 spillover) | — | folder picker uses `properties:['openDirectory','createDirectory']`; safeguard restored; overwrite-only warning | unit + integration | `npm run test -- --run src/main/ipc-pick src/renderer/src/screens/ExportScreen` | ❌ W0 | ⬜ pending |
| 12-05-XX | 05 | TBD | F3 (Phase 11 spillover) | — | `loader.ts` hard-rejects `skeleton.spine` < 4.2 with typed `SpineVersionUnsupportedError` | unit (core, fixture-driven) | `npm run test -- --run src/core/loader` | ✅ existing test file | ⬜ pending |
| 12-06-XX | 06 | TBD | REL-03 | — | INSTALL.md exists; per-OS sections present; libfuse2t64 paragraph present; all 4 link surfaces wire to it | grep + manual smoke | `grep -E "^## (macOS|Windows|Linux)" INSTALL.md && grep "libfuse2t64" INSTALL.md` | ❌ W0 | ⬜ pending |
| Spike | 01 | 1 | UPD-06 | — | Live observation of detect+download+apply on Windows-unsigned NSIS | manual | `gh release edit v1.1.0-rc1 --draft=false --prerelease=true && git tag v1.1.0-rc2 && git push origin v1.1.0-rc2` (user-supervised; runbook in 12-RESEARCH.md §Spike Runbook) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/main/updater.spec.ts` — stubs for UPD-01..UPD-05 (mock `electron-updater` `autoUpdater`, assert `update-available` / `update-downloaded` / `error` / `update-not-available` IPC bridges fire correctly; mock `dismissedUpdateVersion` persistence)
- [ ] `tests/renderer/UpdateDialog.spec.tsx` — stubs for UPD-03/UPD-04 (modal renders releaseNotes summary, Download+Restart and Later buttons, ARIA scaffold matches HelpDialog)
- [ ] `tests/renderer/AtlasPreviewModal.spec.tsx` (extend existing if present) — F1 regression test asserting URL construction works for Windows-style paths (`C:\Users\test\image.png` → no `localhostc/`)
- [ ] `tests/main/ipc-pick.spec.ts` — F2 stubs for picker properties + safeguard + overwrite-warning
- [ ] `tests/core/loader-version-guard.spec.ts` — F3 stub fed `fixtures/SPINE_3_8_TEST/` (or equivalent minimal 3.8-shaped JSON); asserts `SpineVersionUnsupportedError` thrown
- [ ] `fixtures/SPINE_3_8_TEST/SIMPLE_TEST.json` (or equivalent) — minimal Spine 3.8.x-shaped skeleton JSON for F3 fixture

*Existing infrastructure (vitest, fixture loader, modal scaffold tests, error-envelope tests) covers the rest — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Auto-update detect+download+apply on macOS | UPD-01..UPD-04 | Requires installing v1.1.0, publishing v1.1.1, and observing the prompt fire on relaunch — not synthesizable in vitest | Install v1.1.0 .dmg → publish v1.1.1 to GitHub Releases → relaunch v1.1.0 → observe modal → click Download+Restart → confirm app relaunches into v1.1.1 |
| Auto-update detect+download+apply on Linux (AppImage) | UPD-01..UPD-04 | Same as macOS — runtime against real GitHub feed | Same as macOS, AppImage variant |
| Auto-update detect+download+apply on Windows-unsigned (SPIKE) | UPD-06 | The strict 3-step bar (D-02) decides which code path ships live | Follow 12-RESEARCH.md §Spike Runbook step-by-step (gh release edit rc1 → push rc2 tag → install rc1 → observe) |
| Windows manual-fallback notice (if spike fails or partial-fails) | UPD-06 | Visual placement + dismissibility check | Force `process.platform === 'win32'` + spike-failure code path → relaunch → confirm non-blocking notice with "View Release" button → click → confirm GitHub Releases page opens externally |
| Offline graceful (UPD-05) | UPD-05 | Network manipulation outside vitest scope | Disconnect network → launch app → observe no error dialog, normal startup to load screen |
| Help → Check for Updates with no newer version | UPD-02 | Real-time GitHub feed query | Launch latest installed version → Help menu → Check for Updates → observe "You're up to date" copy |
| Gatekeeper "Open Anyway" first-launch on macOS | REL-03 | Tester papercut surface; INSTALL.md screenshot capture | Download fresh .dmg on macOS → double-click → observe Gatekeeper dialog → capture screenshot for INSTALL.md |
| SmartScreen "More info → Run anyway" on Windows | REL-03 | Tester papercut surface; INSTALL.md screenshot capture | Download fresh .exe on Windows 11 → run → observe SmartScreen dialog → capture screenshot |
| libfuse2t64 error on Ubuntu 24.04 | REL-03 | OS-version-specific behavior; INSTALL.md verification | Run AppImage on fresh Ubuntu 24.04 (no libfuse2t64 installed) → observe FUSE error → confirm INSTALL.md paragraph wording matches actual error |
| INSTALL.md link surfaces (4 of them) | REL-03 / D-16 | Each surface needs eyeballed verification | (1) GitHub release-template `${INSTALL_DOC_LINK}` renders correct URL after envsubst; (2) README "Installing" section visible on github.com repo page; (3) Help menu "Installation Guide…" item opens INSTALL.md externally; (4) HelpDialog INSTALL.md link visible and clickable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (6 test files + 1 fixture listed above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s local
- [ ] CI matrix (D-22) green on all 3 OSes
- [ ] Spike runbook executed under user supervision; outcome locked in 12-RESEARCH.md §Spike Runbook before 12-01 wave-2 commits
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
