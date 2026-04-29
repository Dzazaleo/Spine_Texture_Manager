# Requirements — Milestone v1.1.2 Auto-update fixes

> Active requirements for the v1.1.2 hotfix milestone. Validated v1.1 requirements (DIST-01..07, CI-01..06, REL-01..04, UPD-01..06) are archived in `.planning/milestones/v1.1-REQUIREMENTS.md`. Validated v1.0 requirements are archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.

## Goal

Fix four auto-update defects observed live on shipped v1.1.1 so testers receive future updates end-to-end on **both** macOS and Windows (Linux verified opportunistically when host available), without manual reinstall. Hotfix milestone — no new feature surface, no new build/CI surface.

## v1.1.2 Requirements

### UPDFIX — Auto-update reliability fixes

- [ ] **UPDFIX-01**: When an update is available, clicking "Download & Restart" successfully downloads the new version and relaunches into it on **both macOS and Windows** (Linux verified opportunistically when host available). No `ZIP file not provided` error on macOS, no missing-asset / hash-mismatch / download-failure error on Windows. Verified live against a real GitHub Release with the v1.1.2 build pipeline.
- [ ] **UPDFIX-02**: On Windows, when an update is available, the update notification consistently surfaces a working **Download** button — or the windows-fallback "Open Release Page" button if the auto-install path is intentionally disabled per the existing `SPIKE_PASSED` policy. Dismissing the notification does not permanently suppress it; clicking Help → Check for Updates while a newer version is published re-presents the notification.
- [ ] **UPDFIX-03**: The app automatically checks for updates shortly after every cold start on **both macOS and Windows** without any user action (UPD-01 regression in shipped v1.1.1). Network failures are silently swallowed (UPD-05 contract preserved); no error dialogs.
- [ ] **UPDFIX-04**: When the user clicks Help → Check for Updates **before** loading any `.json` / `.stmproj` project file, they receive feedback within ~10 s — either an "Update available" notification, a "You're up to date" notice, or a graceful offline message. No silent void waiting on a project load. Behavior identical on macOS and Windows.

## Out of Scope (v1.1.2)

- New auto-update features (delta updates, staged rollouts, custom update channels). Still deferred to v1.2+.
- Code-signing posture changes (Apple Developer ID, Windows EV cert). Still deferred per v1.1 scope notes; revisit after tester feedback.
- Phase 13.1 live UAT carry-forwards (Linux runbook execution + libfuse2 PNG capture; macOS/Windows v1.1.0 → v1.1.1 auto-update lifecycle observation; cosmetic Windows fix UX confirmation; Windows windows-fallback variant live observation). Separately tracked; pending host availability; not part of v1.1.2's fix surface.
- Telemetry / crash reporting (TEL-future). Still descoped; revisit at v1.2 if tester volume grows.
- Spine 4.3+ versioned loader adapters; atlas-less mode (SEED-001); dims-badge override-cap (SEED-002). Carried unchanged from prior milestones.
- UI improvements outside the UpdateDialog state machine. The dialog itself can be edited as needed by UPDFIX-02; broader UI work stays deferred to v1.2.

## Future Requirements (deferred)

Carried forward from v1.1 unchanged:

- **DIST-future**: Code-signed + notarized macOS distribution (Apple Developer ID).
- **DIST-future**: Code-signed Windows distribution (EV cert).
- **DIST-future**: Linux `.deb` / Flatpak / Snap targets if Linux user base materializes.
- **TEL-future**: Crash + error reporting (Sentry or equivalent). Originally TEL-01..TEL-07; descoped 2026-04-28. Reconsider at v1.2.
- **TEL-future**: Feature-usage analytics once tester base grows and a privacy posture is settled.

## Validated (Locked from Earlier Milestones)

- **v1.1 Distribution** (DIST-01..07, CI-01..06, REL-01..04, UPD-01..06) — all closed at code/docs level by Phases 10/11/12/12.1. v1.1.0 final shipped 2026-04-28; v1.1.1 patch shipped 2026-04-29. v1.1.2 fixes regressions in UPD-01..04 surfaces only; the locked DIST/CI/REL contracts are not relitigated. Full historical record in `.planning/milestones/v1.1-REQUIREMENTS.md`.
- **v1.0 MVP** — full requirements record in `.planning/milestones/v1.0-REQUIREMENTS.md`.

## Traceability

(Populated by the roadmapper.)

| Requirement | Phase | Status |
|-------------|-------|--------|
| UPDFIX-01   | TBD   | Pending |
| UPDFIX-02   | TBD   | Pending |
| UPDFIX-03   | TBD   | Pending |
| UPDFIX-04   | TBD   | Pending |
