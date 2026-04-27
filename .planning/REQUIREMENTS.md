# Requirements — Milestone v1.1 Distribution

> Active requirements for v1.1. Validated requirements from v1.0 are archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.

## Goal

Ship cross-platform installers (Windows / macOS / Linux) via GitHub Releases with auto-update, so the app can be distributed to testers without `git clone` or Node.js toolchain.

## v1.1 Requirements

### DIST — Cross-platform installer build

- [ ] **DIST-01**: User can build a Windows `.exe` installer (NSIS) locally via an npm script.
- [ ] **DIST-02**: User can build a macOS `.dmg` installer locally via an npm script (arm64 minimum; universal optional).
- [ ] **DIST-03**: CI builds a Linux `.AppImage` on tag pushes (user cannot test locally — CI is the only verification surface).
- [ ] **DIST-04**: macOS `.dmg` is signed ad-hoc (no Apple Developer ID); first-launch instructions documented for testers.
- [ ] **DIST-05**: Windows `.exe` is unsigned; SmartScreen "Run anyway" bypass documented for testers.
- [ ] **DIST-06**: Native dependencies (`sharp` libvips binaries) are correctly bundled in all three installers and the installed app can perform a successful Optimize Assets export.
- [ ] **DIST-07**: Installer file names and embedded version metadata derive from `package.json` `version` field and match the git tag that produced them.

### CI — GitHub Actions build pipeline

- [ ] **CI-01**: Pushing a git tag matching `v*.*.*` (e.g. `v1.1.0`) automatically triggers the release-build workflow.
- [ ] **CI-02**: The workflow builds Windows, macOS, and Linux installers in parallel jobs.
- [ ] **CI-03**: The workflow runs the full vitest suite before producing installer artifacts; test failure aborts the release.
- [ ] **CI-04**: Successful jobs upload installer artifacts to a draft GitHub Release for the triggering tag.
- [ ] **CI-05**: A failed platform build prevents publication of the release (no partial / missing-asset releases).
- [ ] **CI-06**: The workflow can also be invoked manually (`workflow_dispatch`) for off-tag dry runs.

### REL — Release distribution channel

- [ ] **REL-01**: Each published GitHub Release has installer assets attached for Windows, macOS, and Linux.
- [ ] **REL-02**: Each release body follows a documented release-notes template (summary / new in this version / known issues / install instructions link).
- [ ] **REL-03**: Repo root contains `INSTALL.md` with per-OS install steps, including Gatekeeper bypass (macOS) and SmartScreen bypass (Windows) walkthroughs.
- [ ] **REL-04**: A non-developer tester can download the appropriate installer from a GitHub Release page, install it, and launch the app — with no `git`, no Node.js, no build step.

### UPD — Auto-update

- [ ] **UPD-01**: On startup, the app checks the GitHub Releases feed for a newer published version (non-blocking, background).
- [ ] **UPD-02**: User can manually trigger an update check via a menu item (e.g. Help → Check for Updates).
- [ ] **UPD-03**: When an update is available, the app prompts the user with version + release-notes summary and an opt-in download.
- [ ] **UPD-04**: After download, the app prompts the user to restart and apply the update; "Later" defers without nagging on next startup.
- [ ] **UPD-05**: Auto-update degrades gracefully when offline or when GitHub is unreachable — no crash, no error dialog, no nag loop.
- [ ] **UPD-06**: Auto-update works on macOS and Linux. **Windows note:** electron-updater historically requires code-signed builds on Windows; if unsigned auto-update proves infeasible, ship Windows users a "manual update" path (notify of new release, link to download page) and document the gap.

### TEL — Crash + error reporting

> Vendor neutral; Sentry is the recommended default but the specific provider is locked at plan-phase. Goal: when a tester says "it broke," we have the stack trace, app version, and OS — not just the screenshot.

- [ ] **TEL-01**: Unhandled exceptions in the main process are captured and sent to a crash-reporting backend (Sentry or equivalent) along with app version, OS + arch, and stack trace.
- [ ] **TEL-02**: Unhandled exceptions and unhandled promise rejections in the renderer process are captured and sent with the same metadata.
- [ ] **TEL-03**: Production source maps are uploaded to the crash-reporting backend during the CI release build so stack traces resolve to original TypeScript sources.
- [ ] **TEL-04**: Crash reports do **not** include user file paths, Spine project content, atlas image data, or any identifying user information beyond what's necessary to triage a bug.
- [ ] **TEL-05**: User can disable crash reporting in Settings (Edit → Preferences). When disabled, the crash-reporting client makes zero network requests.
- [ ] **TEL-06**: First launch shows a one-time consent prompt explaining what is and isn't collected, with Accept / Decline buttons. Decline sets the disabled state from TEL-05.
- [ ] **TEL-07**: Crash reporting is opt-out by default for tester builds (per user direction; revisit before any public/store release).

## Out of Scope (v1.1)

- Apple Developer ID code-signing + notarization ($99/yr; revisit after tester feedback).
- Windows EV code-signing certificate ($200–400/yr; revisit after tester feedback).
- Mac App Store, Microsoft Store, Snap Store, Flatpak distribution.
- Linux `.deb` / `.rpm` packages (AppImage only for v1.1).
- Custom telemetry / analytics beyond crash + error reporting (e.g. feature-usage tracking) — out of scope; only crash/exception capture per TEL-01..07.
- Delta updates / staged rollouts.
- UI improvements (deferred to v1.2 — should be informed by tester feedback).
- Documentation Builder feature (deferred to v1.2+).
- Spine 4.3+ versioned loader adapters (carried from v1.0 deferred list).
- Atlas-less mode (SEED-001) and dims-badge override-cap (SEED-002).
- Phase-0 scale-overshoot root-cause fix.

## Future Requirements (deferred)

- **DIST-future**: Code-signed + notarized macOS distribution (Apple Developer ID).
- **DIST-future**: Code-signed Windows distribution (EV cert).
- **TEL-future**: Feature-usage analytics (which panels / dialogs are used most) once tester base grows and a privacy posture is settled.
- **DIST-future**: Linux `.deb` / Flatpak / Snap targets if Linux user base materializes.

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DIST-01 | Phase 10 | Pending |
| DIST-02 | Phase 10 | Pending |
| DIST-03 | Phase 10 | Pending |
| DIST-04 | Phase 10 | Pending |
| DIST-05 | Phase 10 | Pending |
| DIST-06 | Phase 10 | Pending |
| DIST-07 | Phase 10 | Pending |
| CI-01   | Phase 11 | Pending |
| CI-02   | Phase 11 | Pending |
| CI-03   | Phase 11 | Pending |
| CI-04   | Phase 11 | Pending |
| CI-05   | Phase 11 | Pending |
| CI-06   | Phase 11 | Pending |
| REL-01  | Phase 11 | Pending |
| REL-02  | Phase 11 | Pending |
| REL-03  | Phase 12 | Pending |
| REL-04  | Phase 11 | Pending |
| UPD-01  | Phase 12 | Pending |
| UPD-02  | Phase 12 | Pending |
| UPD-03  | Phase 12 | Pending |
| UPD-04  | Phase 12 | Pending |
| UPD-05  | Phase 12 | Pending |
| UPD-06  | Phase 12 | Pending |
| TEL-01  | Phase 13 | Pending |
| TEL-02  | Phase 13 | Pending |
| TEL-03  | Phase 13 | Pending |
| TEL-04  | Phase 13 | Pending |
| TEL-05  | Phase 13 | Pending |
| TEL-06  | Phase 13 | Pending |
| TEL-07  | Phase 13 | Pending |

**Coverage**: 30/30 requirements mapped (DIST 7 → P10, CI 6 + REL 3 → P11, UPD 6 + REL 1 → P12, TEL 7 → P13). No orphans, no double-mappings.

---

*Last updated: 2026-04-27 — v1.1 milestone roadmap landed (Phases 10–13)*
