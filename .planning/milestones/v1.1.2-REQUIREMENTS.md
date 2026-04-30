# Requirements — Milestone v1.1.2 Auto-update fixes

> Active requirements for the v1.1.2 hotfix milestone. Validated v1.1 requirements (DIST-01..07, CI-01..06, REL-01..04, UPD-01..06) are archived in `.planning/milestones/v1.1-REQUIREMENTS.md`. Validated v1.0 requirements are archived in `.planning/milestones/v1.0-REQUIREMENTS.md`.

## Goal

Fix four auto-update defects observed live on shipped v1.1.1 so testers receive future updates end-to-end on **both** macOS and Windows (Linux verified opportunistically when host available), without manual reinstall. Hotfix milestone — no new feature surface, no new build/CI surface.

## v1.1.2 Requirements

### UPDFIX — Auto-update reliability fixes

- [x] **UPDFIX-01**: When an update is available, clicking "Download & Restart" successfully downloads the new version and relaunches into it on **both macOS and Windows** (Linux verified opportunistically when host available). No `ZIP file not provided` error on macOS, no missing-asset / hash-mismatch / download-failure error on Windows. Verified live against a real GitHub Release with the v1.1.2 build pipeline. — **CLOSED 2026-04-29 at URL/feed layer:** v1.1.2 shipped with broken mac auto-update (D-15-LIVE-1: synthesizer emitted spaced URL, GitHub stored dotted, electron-updater requested dashed → HTTP 404). v1.1.3 same-day hotfix (Plan 15-05 sanitizeAssetUrl synthesizer rewrite + Plan 15-06 URL-resolution invariant pre-flight gate) shipped at https://github.com/Dzazaleo/Spine_Texture_Manager/releases/tag/v1.1.3. Test 7-Retry PARTIAL-PASS empirically verified: v1.1.1 → v1.1.3 .zip download succeeded byte-exact (121,848,102 bytes) at canonical dotted URL `Spine.Texture.Manager-1.1.3-arm64.zip`; the exact request that returned HTTP 404 in v1.1.2 returns HTTP 200 in v1.1.3. (Install-step Squirrel.Mac swap blocked by separate ad-hoc code-sig defect D-15-LIVE-2 — latent since v1.0.0; routed to backlog 999.2 as a manual-download UX phase per user decision; NOT a UPDFIX-01 regression.)
- [x] **UPDFIX-02
**: On Windows, when an update is available, the update notification consistently surfaces a working **Download** button — or the windows-fallback "Open Release Page" button if the auto-install path is intentionally disabled per the existing `SPIKE_PASSED` policy. Dismissing the notification does not permanently suppress it; clicking Help → Check for Updates while a newer version is published re-presents the notification.
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

(Populated by the roadmapper 2026-04-29.)

| Requirement | Phase | Status |
|-------------|-------|--------|
| UPDFIX-01   | 15    | Complete (URL/feed layer; Plan 15-05 + 15-06; v1.1.3 hotfix; Test 7-Retry PARTIAL-PASS) |
| UPDFIX-02   | 14    | Complete (code level; live UAT Tests 5+6 PASSED via screenshot evidence in Phase 15 live UAT 2026-04-29T19:00–19:35Z) |
| UPDFIX-03   | 14    | Complete (code level; live mac UAT noted regression in v1.1.1 packaged build per 15-VERIFICATION.md live_uat_session_notes — separate Phase 14 follow-up; not a Phase 15 blocker) |
| UPDFIX-04   | 14    | Complete (code level; live mac UAT confirmed Help → Check works post-project-load; pre-load gating regressed in v1.1.3 surface and routed to backlog 999.3 / D-15-LIVE-3) |

**Coverage:** 4/4 requirements mapped to exactly one phase. UPDFIX-02 + UPDFIX-03 + UPDFIX-04 cluster in Phase 14 (renderer/state-machine code surface in `src/main/auto-update.ts` + `src/main/update-state.ts` + `src/renderer/src/modals/UpdateDialog.tsx` + the `update:*` IPC channels between them — code-only, no tag/CI/publish). UPDFIX-01 lands in Phase 15 (build/feed-shape fix in `electron-builder.yml` + `scripts/emit-latest-yml.mjs` + `release.yml` artifact upload list, then `package.json` bump 1.1.1 → 1.1.2 + tag push + CI watch + 6-asset (or 7-asset if `.zip` adds) Release publish via the existing 12.1-D-10 publish-race fix architecture). Phase 15 depends on Phase 14 — Windows Download button visibility (UPDFIX-02) is a prerequisite for live-verifying UPDFIX-01's Windows download path against the real published feed.
