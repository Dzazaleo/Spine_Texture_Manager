---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Distribution
status: unknown
last_updated: "2026-04-27T20:48:28.220Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 7
  percent: 64
---

# State

## Current milestone

v1.1 — Distribution

## Current phase

Phase 12 — auto-update + tester install docs. Wave 1 (Plan 12-02 — CI delivery surface for electron-updater) complete. Wave 2 partially complete: Plan 12-01 (auto-update wiring) closed 2026-04-27 with the BLOCKING Task 6 Windows-unsigned spike DEFERRED to a proposed phase 12.1; manual-fallback variant ships LIVE on Windows by default. Plans 12-03 (F1), 12-04 (F2), 12-05 (F3), 12-06 (INSTALL.md) remain. Phase 11 (CI release pipeline) closed 2/2 plans.

## Current plan

12-03-PLAN.md (Wave 2) — F1 atlas-image URL Windows fix at AtlasPreviewModal.tsx:116 via pathToFileURL bridge. The 404'd URL `app-image://localhostc/` is the smoking gun (extra trailing `c` from drive-letter `C:` glued onto `localhost`). Audit all renderer sites that construct `app-image://` URLs.

## Last completed

Plan 12-01 (Wave 2 — auto-update wiring with Windows-spike runbook) — 2026-04-27. 8 atomic task commits + 2 follow-ups + 1 spike-outcome docs commit close out the runtime auto-update path. UPD-01..UPD-05 marked complete in REQUIREMENTS.md (UPD-06 closed earlier by Plan 12-02 at the file-authoring level; live-runtime UPD-06 spike runbook deferred to phase 12.1).

**Tasks 1-5 (TDD code-producing tasks):**

1. `f208478` test — failing tests for update-state.ts atomic persistence (Task 1 RED)
2. `6566cb4` feat — implement update-state.ts atomic JSON persistence (D-08) (Task 1 GREEN)
3. `b92f1a1` test — failing tests for auto-update.ts orchestrator (Task 2 RED)
4. `de974fb` feat — implement auto-update.ts orchestrator (UPD-01..UPD-06) (Task 2 GREEN)
5. `7dce8b6` test — failing tests for UpdateDialog ARIA modal (Task 3 RED)
6. `0f4047f` feat — implement UpdateDialog ARIA modal (D-05 + D-09 + D-04) (Task 3 GREEN)
7. `1d9cf73` feat — wire IPC channels + preload bridges + allow-list URL (Task 4)
8. `09f9369` feat — wire boot init + Help menu + AppShell update subscriptions (Task 5)

**Task 6 spike attempt + cleanup:**

9. `51d12cb` fix — make arch + project-file tests Windows-portable (D-22 matrix surfaced these as real Windows path-separator bugs; arch.spec carve-out came from Task 4)
10. `44bd03b` chore — defer Windows-spike to 12.1; revert GH_TOKEN env + rc2 bump (cleanup of partial spike attempt)
11. `f31d494` docs — record spike outcome as DEFERRED to phase 12.1 (appended SPIKE OUTCOME block to 12-RESEARCH.md per runbook contract)

**Live runtime status:** macOS/Linux installed builds run the full auto-update path (download + apply + relaunch) against any future v1.1.0-rc2-or-newer release with `latest-mac.yml`/`latest-linux.yml` feed files. Windows installed builds run the manual-fallback variant (D-03): when a newer release exists in the GitHub feed, the windows-fallback variant of UpdateDialog opens — version label + button that opens GitHub Releases index page externally via `window.api.openExternalUrl()`. SPIKE_PASSED constant in `src/main/auto-update.ts` line 92 = `process.platform !== 'win32'` (default unchanged); flipping to full auto-update on Windows in 12.1 is a one-line constant change, not a refactor (D-04 cohesive code surface).

**Spike-defer root cause:** electron-builder 26.x's `--publish never` CLI flag does NOT prevent per-artifact `PublishManager.artifactCreatedWithoutExplicitPublishConfig` from constructing GitHub publishers and uploading individual artifacts when `publish: github` is set in YAML (Plan 12-02 D-11/D-12). Two failure modes observed across 3 CI runs on 2026-04-27 (25017095851 / 25017351602 / 25017624868): (a) no GH_TOKEN → publisher constructor throws "GitHub Personal Access Token is not set" before any artifact builds; (b) GH_TOKEN provided → publisher constructor succeeds but auto-uploads race against atomic `softprops/action-gh-release` publish step (HTTP 422 on parallel asset name conflict). Phase 12.1 will pick a fix architecture (3 options enumerated in `deferred-items.md`), validate locally, run a fresh tag-push CI, then execute the Spike Runbook for real.

Acceptance verification: 377/377 vitest passing post-cleanup; `git status` clean; `package.json` version is `1.1.0-rc1`; SPIKE_PASSED unchanged.

Prior: Plan 12-02 (CI delivery surface for electron-updater) — 2026-04-27. Three atomic commits land the entire CI delivery surface contract for auto-update:

1. `a533c21` chore — `package.json` adds `electron-updater@^6.8.3` to `dependencies` (NOT devDependencies — runtime-consumed). `package-lock.json` locks 8 transitive packages, 0 vulnerabilities. Build scripts (`build:mac`/`build:win`/`build:linux`) untouched: `--publish never` suffix preserved per Phase 11 D-01 (defense-in-depth).
2. `7d9330d` chore — `electron-builder.yml` `publish` block flipped from `null` → `{ provider: github, owner: Dzazaleo, repo: Spine_Texture_Manager, releaseType: release }`. Enables electron-builder to bake `app-update.yml` into bundled `resources/` at build time, mitigating the "app-update.yml is missing" runtime error (RESEARCH §Common Pitfalls — GH issues #8620 + #2667). All other YAML blocks untouched. Comment block above `publish:` rewritten to document the new contract.
3. `6a8a125` ci — `.github/workflows/release.yml` four hunks: (a) `test` job → matrix over `[ubuntu-latest, windows-2022, macos-14]` with `fail-fast: true` preserving CI-05 atomicity (D-22, D-23); (b) tag-version-guard step gated to Linux leg (`matrix.os == 'ubuntu-latest'`) with explicit `shell: bash` for cross-OS bash on Windows; (c) all 3 per-platform `actions/upload-artifact@v4` steps now use multi-line block-scalar `path:` to upload `latest*.yml` alongside installer (`release/*.dmg + release/latest-mac.yml`, `release/*.exe + release/latest.yml`, `release/*.AppImage + release/latest-linux.yml`); (d) `publish` job's `softprops/action-gh-release@v2.6.2` `files:` extended with `assets/latest.yml`, `assets/latest-mac.yml`, `assets/latest-linux.yml` — draft Release now ships 6 assets (3 installers + 3 feed files). All 14 SHA-pinned `uses:` references unchanged (Phase 11 D-22 supply-chain hygiene preserved).

Acceptance verification: all positive-presence greps PASS (matrix array, `fail-fast: true`, 3× `release/latest`, 3× `assets/latest`, `shell: bash`, gate clause `matrix.os == 'ubuntu-latest'`, 3× `if-no-files-found: error`, 3× `retention-days: 14`, 14 SHA-pinned actions); YAML parses via js-yaml; `npm run test` 331/331 vitest passing; `npm run typecheck:web` clean. Pre-existing `scripts/probe-per-anim.ts` typecheck failure carried forward unchanged via `.planning/phases/12-…/deferred-items.md` per SCOPE BOUNDARY (identical to Phase 11 deferred entry; survives `git stash` revert).

REL-06 (UPD-06) marked complete in REQUIREMENTS.md — the CI delivery surface that satisfies the auto-update path's pre-conditions is now live (matrix-OS validation happens on next CI tag push, likely 12-01's spike rc2).

Prior: Plan 11-02 (live verification of CI release pipeline) — closed prior to Phase 12 planning kickoff. v1.1.0-rc1 tag-push exercised the workflow; gh-CLI evidence captured for criteria 1–8; `workflow_dispatch` dry run + atomicity audit + REL-04 install smoke all signed off. Notable mid-plan adjustments: `electron-builder.yml` set to `publish: null` (commit `c0ac407`) to defeat electron-builder's auto-detect of GitHub provider from the git remote (which was breaking builds with "GitHub Personal Access Token is not set" before the build finished); CI-pipeline `.skipIf(CI)` applied to Girl wall-time test (`f00e232`). Phase 11 closed 2/2 plans.

Prior: Plan 11-01 (CI file-authoring wave) — 2026-04-27. Three atomic commits (69c8cc1, eb8a904, c253eb6) landed `release.yml` (150 lines, 5 jobs, 5 SHA-pinned actions), `release-template.md` (4 REL-02 sections, envsubst placeholders), and `package.json` `--publish never` bake-in.

Prior milestone: v1.0 (MVP) closed 2026-04-26. 12 phases, 62 plans, 331 vitest passing. Tag `v1.0`. See `.planning/MILESTONES.md`. v1.0 phase directories archived to `.planning/milestones/v1.0-phases/`.

## Next action

`/gsd-execute-phase 12` continues with Plan 12-03 (Wave 2, autonomous) — F1 atlas-image URL Windows fix at `src/renderer/src/modals/AtlasPreviewModal.tsx:116` via `pathToFileURL` bridge. The 404'd URL `app-image://localhostc/` is the smoking gun (extra trailing `c` from drive-letter `C:` glued onto `localhost`). Audit all renderer sites that construct `app-image://` URLs.

**DO NOT push tags until phase 12.1 lands the publish-race fix** — the workflow will fail and pollute releases. See `.planning/phases/12-auto-update-tester-install-docs/deferred-items.md` "CI tag-push will fail" entry.

## Open questions

- Phase 12.1 (proposed): Does unsigned-Windows `electron-updater` work end-to-end (Spike Runbook strict-bar three-step verification)? Plan 12-01 closed with the spike DEFERRED to 12.1 because the electron-builder 26.x publish race surfaced and required architectural choice. Manual-fallback variant ships LIVE on Windows by default in the meantime — a contracted UPD-06 fallback, not a workaround.
- Phase 13: Sentry vs. alternative crash-reporting vendor — locked at plan-phase 13.

## Decisions

(v1.0 decisions preserved in `.planning/PROJECT.md` "Key Decisions" table.)

v1.1 decisions to date:

- No paid signing certs in v1.1 (Apple Developer ID, Windows EV) — locked.
- Linux build verified via CI only (Phase 11); local Linux build is best-effort in Phase 10.
- Crash-reporting opt-out by default for tester builds (TEL-07); revisit before any public/store release.
- Phase 11 Plan 01: `.github/workflows/release.yml` (150 lines, 5 jobs, 5 SHA-pinned actions) + `.github/release-template.md` (envsubst-rendered, 4 REL-02 sections + Tag footer) + `package.json` build:mac/win/linux scripts now end with `--publish never` (defense-in-depth against Pitfall 1). Three atomic commits: 69c8cc1, eb8a904, c253eb6. 331 vitest tests still green; live workflow verification deferred to Plan 02.
- Phase 12 Plan 02: electron-updater@^6.8.3 added as runtime dependency (NOT devDep) — pinned to RESEARCH-VERIFIED latest stable on npm registry 2026-04-27. electron-builder.yml `publish` flipped from null → GitHub provider (owner=Dzazaleo, repo=Spine_Texture_Manager, releaseType=release) so app-update.yml bakes into bundled resources/ at build time. release.yml `test` job expanded to 3-OS matrix `[ubuntu-latest, windows-2022, macos-14]` with `fail-fast: true` preserving CI-05 atomicity. Per-platform upload-artifact steps now ship `latest*.yml` alongside installers via multi-line block-scalar `path:` glob. Publish-job `softprops/action-gh-release@v2.6.2` `files:` extended with 3 feed-file entries — draft Release ships 6 assets (3 installers + 3 feed files). Three atomic commits: a533c21, 7d9330d, 6a8a125. UPD-06 closed.
- Phase 12 Plan 01: electron-updater 6.8.3 wired into main via new `src/main/auto-update.ts` orchestrator (autoDownload=false / autoInstallOnAppQuit=false / allowPrerelease=true; 3.5s startup check; 10s Promise.race timeout; mode-aware error handling — manual mode IPC bridge / startup mode silent-swallow per UPD-05). Hand-rolled ARIA `UpdateDialog.tsx` modal cloning HelpDialog scaffold (D-05) — state machine available → downloading → downloaded; D-09 plain-text Summary extraction (zero XSS surface); D-04 windows-fallback variant. New `src/main/update-state.ts` atomic JSON persistence (recent.ts byte-for-byte template; D-08 dismissedUpdateVersion + spikeOutcome fields). 5 invoke + 4 send + 1 menu-routing IPC channels wired through preload bridges. Help → Check for Updates menu item beside existing Documentation item. `GITHUB_RELEASES_INDEX_URL` (`https://github.com/Dzazaleo/Spine_Texture_Manager/releases`) added as single allow-list entry to SHELL_OPEN_EXTERNAL_ALLOWED (D-18 option b). Both Windows branches (auto-update + windows-fallback) ship under one cohesive code surface per D-04: SPIKE_PASSED = `process.platform !== 'win32'` at `src/main/auto-update.ts` line 92 (default — Windows runs the manual-fallback variant LIVE by default; macOS/Linux always run the full auto-update path). UPD-01..UPD-05 closed in REQUIREMENTS.md.
- Phase 12 Plan 01 Task 6 (BLOCKING SPIKE) DEFERRED to phase 12.1 — user-decided after 3 CI runs on 2026-04-27 (25017095851 / 25017351602 / 25017624868) all failed at the electron-builder 26.x publish race (`--publish never` CLI does NOT prevent per-artifact GitHub publisher upload when `publish: github` in YAML). Cleanup: package.json reverted 1.1.0-rc2 → 1.1.0-rc1, v1.1.0-rc2 release + tag deleted local + origin, GH_TOKEN env additions reverted on the 3 build jobs in `.github/workflows/release.yml`. SPIKE OUTCOME block recorded in `12-RESEARCH.md` §"Output of the spike" per runbook contract. Manual-fallback variant ships LIVE on Windows — the contracted UPD-06 fallback behavior, NOT a workaround. Phase 12.1 will pick a publish-race fix architecture (3 options in `deferred-items.md`), validate locally, run fresh tag-push CI, then execute the Spike Runbook for real. Eight task commits (f208478, 6566cb4, b92f1a1, de974fb, 7dce8b6, 0f4047f, 1d9cf73, 09f9369) + 2 follow-ups (51d12cb Windows-portability test fixes from D-22 matrix surfaced bugs, 44bd03b spike-defer cleanup) + 1 docs commit (f31d494 SPIKE OUTCOME = DEFERRED). 377/377 vitest passing post-cleanup.
- Phase 12 deferred work surface (proposed phase 12.1): (a) electron-builder 26.x publish-race fix architecture decision, (b) live execution of Plan 12-01's Spike Runbook (UPD-06 / D-01 / D-02 strict-bar three-step verification on Windows test host with v1.1.0-rc1 → v1.1.0-rc2 detect/download/apply observation), (c) flipping SPIKE_PASSED to true unconditionally if Outcome A; leaving manual-fallback variant live on Windows otherwise. **DO NOT push tags until 12.1 lands the publish-race fix** — workflow will fail and pollute releases.

## Last session

2026-04-27 — Plan 12-01 (Wave 2, auto-update wiring with Windows-spike runbook) closed. Tasks 1-5 (TDD: 6 RED+GREEN commits + 2 wiring commits — f208478, 6566cb4, b92f1a1, de974fb, 7dce8b6, 0f4047f, 1d9cf73, 09f9369) executed earlier in the session. Task 6 (BLOCKING SPIKE) attempted across 3 CI runs (25017095851 / 25017351602 / 25017624868) — all failed at the electron-builder 26.x publish race; user decided to DEFER spike to a proposed phase 12.1. Cleanup commits: 51d12cb (fix — Windows-portability tests; D-22 matrix surfaced real bugs in arch.spec carve-out from Task 4 + project-file.spec) + 44bd03b (chore — defer spike: package.json reverted to 1.1.0-rc1, polluted v1.1.0-rc2 release + tag deleted local + origin, GH_TOKEN env reverted on 3 build jobs, deferred-items.md "CI tag-push will fail" entry added) + f31d494 (docs — SPIKE OUTCOME block recorded in 12-RESEARCH.md per runbook contract: Result=DEFERRED to phase 12.1, Windows branch=manual fallback). Manual-fallback variant ships LIVE on Windows by default (SPIKE_PASSED=`process.platform !== 'win32'` unchanged at src/main/auto-update.ts:92); full auto-update path live on macOS/Linux. UPD-01..UPD-05 marked complete in REQUIREMENTS.md (UPD-06 was already closed by Plan 12-02 at the file-authoring level; live-runtime UPD-06 spike runbook deferred to phase 12.1). 377/377 vitest passing post-cleanup; `git status` clean. Phase 12 now 2/6 plans complete; Plans 12-03 / 12-04 / 12-05 / 12-06 still pending.

Earlier 2026-04-27 — Plan 12-02 (Wave 1, CI delivery surface for electron-updater) executed. Three atomic commits (a533c21 chore electron-updater@^6.8.3 to dependencies; 7d9330d chore electron-builder.yml publish: null → GitHub provider; 6a8a125 ci release.yml 3-OS matrix + latest*.yml feed file uploads). UPD-06 marked complete in REQUIREMENTS.md (CI delivery surface; runtime auto-update behavior validation lives in Plan 12-01's spike). 331 vitest tests still green; `npm run typecheck:web` clean. Pre-existing `scripts/probe-per-anim.ts` typecheck failure carried forward unchanged via `.planning/phases/12-…/deferred-items.md` per SCOPE BOUNDARY (identical to Phase 11 deferred entry; survives `git stash` revert; out of Phase 12 scope). Phase 12 now 1/6 plans complete; Plan 12-01 (Wave 2) unblocked.

Earlier 2026-04-27 — Plan 11-02 (live verification of CI release pipeline) closed. v1.1.0-rc1 tag-push exercised the workflow; gh-CLI evidence captured for criteria 1–8; `workflow_dispatch` dry run + atomicity audit + REL-04 install smoke all signed off. Mid-plan adjustments: `electron-builder.yml` `publish: null` (commit c0ac407) defeats electron-builder auto-detect of GitHub provider; CI-pipeline `.skipIf(CI)` applied to Girl wall-time test (f00e232). Phase 11 closed 2/2 plans.

Earlier 2026-04-27 — Plan 11-01 (CI file-authoring wave) executed. Three atomic commits (69c8cc1 chore package.json `--publish never`; eb8a904 feat .github/release-template.md; c253eb6 feat .github/workflows/release.yml). CI-01..CI-06 and REL-01/REL-02 marked complete in REQUIREMENTS.md.

Earlier 2026-04-27 — Phase 10 closed. Plan 10-03 manual macOS Optimize Assets smoke approved by user (two-fixture verification; SIMPLE_TEST + Girl). DIST-01..DIST-07 marked complete in REQUIREMENTS.md (config-level for Win/Linux via Plan 10-02 YAML; live macOS via Plan 10-03; live Win + Linux deferred to Phase 11 CI). All 3 Phase 10 plans done. v1.1 Distribution roadmap landed (Phases 10–13 / 30 requirements / DIST/CI/REL/UPD/TEL).

## Links

- PROJECT.md: `.planning/PROJECT.md`
- ROADMAP.md: `.planning/ROADMAP.md`
- REQUIREMENTS.md: `.planning/REQUIREMENTS.md`
- v1.0 archive: `.planning/milestones/`

## Deferred Items

Carried from v1.0 milestone close (2026-04-26):

| Category | Item | Status | Disposition |
|----------|------|--------|-------------|
| debug | phase-0-scale-overshoot | investigating | Carried; not in v1.1 scope (sampling formula refinement) |
| todo | 2026-04-24-phase-4-code-review-follow-up (ui) | pending | Carried; not in v1.1 scope |
| seed | SEED-001-atlas-less-mode | dormant | Post-MVP by design |
| seed | SEED-002-dims-badge-override-cap | dormant | Post-MVP by design |
| uat_gap | Phase 07 07-HUMAN-UAT.md | signed-off | Stale flag (0 pending) |

## Accumulated Context

### Roadmap Evolution

v1.1 milestone started 2026-04-27 — Distribution. Phase numbering continues from v1.0 (last phase: 9; next phase starts at 10). Roadmap landed 2026-04-27 with Phases 10–13.

### v1.0 Roadmap Evolution (preserved)

- Phase 8.1 inserted after Phase 8 (2026-04-26): close Phase 8 verification gaps (locate-skeleton recovery reachability + new-skeleton dirty-guard).
- Phase 8.2 inserted after Phase 8.1 (2026-04-26): File-menu surface + Cmd+O accelerator gating fix; bundled with native File menu items.

**Active Phase:** 12 (auto-update-tester-install-docs) — 2/6 plans complete — Plan 12-01 closed 2026-04-27T21:38Z (Wave 2, auto-update wiring with Windows-spike runbook: electron-updater orchestrator + ARIA UpdateDialog modal + atomic update-state.ts + Help-menu Check-for-Updates + IPC wiring + boot init; eight task commits f208478..09f9369 + 2 follow-ups 51d12cb + 44bd03b + 1 spike-outcome docs commit f31d494; UPD-01..UPD-05 closed; Task 6 BLOCKING SPIKE DEFERRED to phase 12.1 due to electron-builder 26.x publish race; manual-fallback variant ships LIVE on Windows by default per D-04); Plan 12-02 closed 2026-04-27T19:27:13Z (Wave 1, CI delivery surface for electron-updater: electron-updater@^6.8.3 runtime dep, electron-builder.yml publish:github provider flip, release.yml 3-OS test matrix + latest*.yml feed publication; three atomic commits a533c21, 7d9330d, 6a8a125; UPD-06 closed); Plan 12-03 (F1 atlas-image URL fix on Windows), 12-04 (F2 file-picker UX fixes), 12-05 (F3 Spine 4.2 version guard), 12-06 (INSTALL.md authoring + linking surfaces) pending.

**Closed Phase:** 11 (CI release pipeline (GitHub Actions → draft Release)) — 2/2 plans complete. Plan 11-01 file-authoring wave (release.yml + release-template.md + package.json `--publish never` bake-in); Plan 11-02 live verification (v1.1.0-rc1 tag-push, gh-CLI evidence for criteria 1–8, workflow_dispatch dry run, atomicity audit, REL-04 install smoke); CI-01..CI-06 + REL-01/REL-02/REL-04 closed.

**Closed Phase:** 10 (Installer build) — 3/3 plans complete — 2026-04-27T10:08:45Z. Plan 10-01 (build-foundation: version 1.1.0-rc1 + per-platform npm scripts), Plan 10-02 (3-platform electron-builder.yml with mac.identity:'-' + asarUnpack sharp/@img), Plan 10-03 (live macOS .dmg + shell assertions + 10-SMOKE-TEST.md recipe + user-approved manual Optimize Assets smoke). Phase 10 contract DIST-01..DIST-07 closed; cross-platform live verification (Windows EXE, Linux AppImage) handed to Phase 11 CI.
