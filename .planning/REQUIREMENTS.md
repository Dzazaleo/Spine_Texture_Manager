# Requirements — Milestone v1.1 Distribution

> Active requirements for v1.1. Validated requirements from v1.0 are archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.

## Goal

Ship cross-platform installers (Windows / macOS / Linux) via GitHub Releases with auto-update, so the app can be distributed to testers without `git clone` or Node.js toolchain.

## v1.1 Requirements

### DIST — Cross-platform installer build

- [x] **DIST-01**: User can build a Windows `.exe` installer (NSIS) locally via an npm script.
- [x] **DIST-02**: User can build a macOS `.dmg` installer locally via an npm script (arm64 minimum; universal optional).
- [x] **DIST-03**: CI builds a Linux `.AppImage` on tag pushes (user cannot test locally — CI is the only verification surface).
- [x] **DIST-04**: macOS `.dmg` is signed ad-hoc (no Apple Developer ID); first-launch instructions documented for testers.
- [x] **DIST-05**: Windows `.exe` is unsigned; SmartScreen "Run anyway" bypass documented for testers.
- [x] **DIST-06**: Native dependencies (`sharp` libvips binaries) are correctly bundled in all three installers and the installed app can perform a successful Optimize Assets export.
- [x] **DIST-07**: Installer file names and embedded version metadata derive from `package.json` `version` field and match the git tag that produced them.

### CI — GitHub Actions build pipeline

- [x] **CI-01
**: Pushing a git tag matching `v*.*.*` (e.g. `v1.1.0`) automatically triggers the release-build workflow.
- [x] **CI-02
**: The workflow builds Windows, macOS, and Linux installers in parallel jobs.
- [x] **CI-03
**: The workflow runs the full vitest suite before producing installer artifacts; test failure aborts the release.
- [x] **CI-04
**: Successful jobs upload installer artifacts to a draft GitHub Release for the triggering tag.
- [x] **CI-05
**: A failed platform build prevents publication of the release (no partial / missing-asset releases).
- [x] **CI-06
**: The workflow can also be invoked manually (`workflow_dispatch`) for off-tag dry runs.

### REL — Release distribution channel

- [x] **REL-01
**: Each published GitHub Release has installer assets attached for Windows, macOS, and Linux.
- [x] **REL-02
**: Each release body follows a documented release-notes template (summary / new in this version / known issues / install instructions link).
- [ ] **REL-03**: Repo root contains `INSTALL.md` with per-OS install steps, including Gatekeeper bypass (macOS) and SmartScreen bypass (Windows) walkthroughs.
- [x] **REL-04
**: A non-developer tester can download the appropriate installer from a GitHub Release page, install it, and launch the app — with no `git`, no Node.js, no build step.

### UPD — Auto-update

- [ ] **UPD-01**: On startup, the app checks the GitHub Releases feed for a newer published version (non-blocking, background).
- [ ] **UPD-02**: User can manually trigger an update check via a menu item (e.g. Help → Check for Updates).
- [ ] **UPD-03**: When an update is available, the app prompts the user with version + release-notes summary and an opt-in download.
- [ ] **UPD-04**: After download, the app prompts the user to restart and apply the update; "Later" defers without nagging on next startup.
- [ ] **UPD-05**: Auto-update degrades gracefully when offline or when GitHub is unreachable — no crash, no error dialog, no nag loop.
- [x] **UPD-06
**: Auto-update works on macOS and Linux. **Windows note:** electron-updater historically requires code-signed builds on Windows; if unsigned auto-update proves infeasible, ship Windows users a "manual update" path (notify of new release, link to download page) and document the gap.

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
| DIST-01 | Phase 10 | Complete (config: Plan 10-02 YAML; live verification deferred to Phase 11 CI Windows job) |
| DIST-02 | Phase 10 | Complete (Plan 10-03 — live macOS .dmg produced from `npm run build:mac`) |
| DIST-03 | Phase 10 | Complete (config: Plan 10-02 YAML linux: block; live verification deferred to Phase 11 CI Linux job) |
| DIST-04 | Phase 10 | Complete (Plan 10-03 — `codesign -dv` Signature=adhoc on live .app) |
| DIST-05 | Phase 10 | Complete (config: Plan 10-02 — no `certificateFile` keys ⇒ unsigned; live `signtool verify` deferred to Phase 11 CI Windows job) |
| DIST-06 | Phase 10 | Complete (Plan 10-03 — static: sharp + libvips in app.asar.unpacked; dynamic: user-approved Optimize Assets smoke against SIMPLE_TEST + Girl fixtures, both produced non-zero PNGs + .atlas) |
| DIST-07 | Phase 10 | Complete (Plan 10-03 — filename + Info.plist CFBundleShortVersionString = 1.1.0-rc1) |
| CI-01   | Phase 11 | Complete (Plan 11-02 — live tag push of v1.1.0-rc1 fired workflow run 24994332338 within 3 s of push; criterion #1) |
| CI-02   | Phase 11 | Complete (Plan 11-02 — run 24994332338 build-{mac,win,linux} all share startedAt 2026-04-27T12:14:29Z, concurrent on macos-14 / windows-2022 / ubuntu-22.04; criterion #2) |
| CI-03   | Phase 11 | Complete (Plan 11-02 — run 24994332338 test.completedAt 12:14:27Z precedes min(build-*.startedAt) 12:14:29Z by 2 s; vitest gates builds; criterion #2 partial + criterion #3) |
| CI-04   | Phase 11 | Complete (Plan 11-02 — run 24994332338 produced draft release v1.1.0-rc1 via SHA-pinned softprops/action-gh-release@v2.6.2; gh release view returns isDraft true with 3 assets; criterion #4) |
| CI-05   | Phase 11 | Complete (Plan 11-02 — atomicity proven on TWO failed runs: 24993716580 (test failed) and 24994071839 (all 3 builds failed) both correctly skipped publish, gh release list returned []; static audit confirms publish.needs/if + if-no-files-found:error×3 + fail_on_unmatched_files:true; criteria #5 + #8) |
| CI-06   | Phase 11 | Complete (Plan 11-02 — workflow_dispatch run 24994622845 produced 3 artifacts on the run summary, publish skipped, no new draft release; criterion #7) |
| REL-01  | Phase 11 | Complete (Plan 11-02 — gh release view v1.1.0-rc1 shows 3 assets sorted: .dmg arm64 / .exe x64 / .AppImage x86_64, all containing 1.1.0-rc1 literal; criterion #5) |
| REL-02  | Phase 11 | Complete (Plan 11-02 — body has all 4 REL-02 sections + Tag footer (5 ## headings), 0 unrendered ${VERSION}/${TAG}/${INSTALL_DOC_LINK} placeholders, v1.1.0-rc1 literal × 3; envsubst rendered cleanly; criterion #6) |
| REL-03  | Phase 12 | Pending (INSTALL.md authoring is Phase 12 territory; some content already drafted in .github/release-template.md install-bullets) |
| REL-04  | Phase 11 | Complete-with-deferrals (Plan 11-02 — macOS install + launch + Optimize Assets verified; Windows install + launch + Optimize Assets verified on Spine 4.2 input (153/153 in 10.7s); 3 pre-existing Windows runtime findings spilled to Phase 12 via 11-WIN-FINDINGS.md; Linux smoke explicitly deferred to Phase 12 tester rounds with rationale) |
| UPD-01  | Phase 12 | Pending |
| UPD-02  | Phase 12 | Pending |
| UPD-03  | Phase 12 | Pending |
| UPD-04  | Phase 12 | Pending |
| UPD-05  | Phase 12 | Pending |
| UPD-06  | Phase 12 | Complete (Plan 12-02 — CI delivery surface for electron-updater: feed publication + electron-builder publish:github + 3-OS test matrix; runtime auto-update via Plan 12-01) |
| TEL-01  | Phase 13 | Pending |
| TEL-02  | Phase 13 | Pending |
| TEL-03  | Phase 13 | Pending |
| TEL-04  | Phase 13 | Pending |
| TEL-05  | Phase 13 | Pending |
| TEL-06  | Phase 13 | Pending |
| TEL-07  | Phase 13 | Pending |

**Coverage**: 30/30 requirements mapped (DIST 7 → P10, CI 6 + REL 3 → P11, UPD 6 + REL 1 → P12, TEL 7 → P13). No orphans, no double-mappings.

---

*Last updated: 2026-04-27 — Phase 12 Plan 02 closed (UPD-06): CI delivery surface for electron-updater landed — electron-updater@^6.8.3 runtime dep, electron-builder.yml publish flipped to GitHub provider, release.yml test job expanded to 3-OS matrix with fail-fast, per-platform latest*.yml feed publication wired into draft GitHub Releases. Plan 12-01 (auto-update runtime wiring) and remaining Phase 12 plans pending.*
