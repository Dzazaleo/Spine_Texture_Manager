---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Distribution
status: unknown
last_updated: "2026-04-27T19:29:16.535Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 6
  percent: 55
---

# State

## Current milestone

v1.1 — Distribution

## Current phase

Phase 12 — auto-update + tester install docs. Wave 1 (Plan 12-02 — CI delivery surface for electron-updater) complete; Wave 2 (Plan 12-01 — auto-update wiring with Windows-spike runbook) now unblocked. Phase 11 (CI release pipeline) closed 2/2 plans.

## Current plan

12-01-PLAN.md (Wave 2) — auto-update wiring: `electron-updater` integration, `UpdateDialog.tsx` modal, Help → Check for Updates menu item, startup check + 10s hard timeout, "Later" persistence, Windows fallback path. Includes the spike outcome from `12-RESEARCH.md` so the path is locked before execution. Depends on 12-02 (now complete): runtime dependency installed + `latest*.yml` feed publication wired in CI + `app-update.yml` baked into bundled resources at build time.

## Last completed

Plan 12-02 (CI delivery surface for electron-updater) — 2026-04-27. Three atomic commits land the entire CI delivery surface contract for auto-update:

1. `a533c21` chore — `package.json` adds `electron-updater@^6.8.3` to `dependencies` (NOT devDependencies — runtime-consumed). `package-lock.json` locks 8 transitive packages, 0 vulnerabilities. Build scripts (`build:mac`/`build:win`/`build:linux`) untouched: `--publish never` suffix preserved per Phase 11 D-01 (defense-in-depth).
2. `7d9330d` chore — `electron-builder.yml` `publish` block flipped from `null` → `{ provider: github, owner: Dzazaleo, repo: Spine_Texture_Manager, releaseType: release }`. Enables electron-builder to bake `app-update.yml` into bundled `resources/` at build time, mitigating the "app-update.yml is missing" runtime error (RESEARCH §Common Pitfalls — GH issues #8620 + #2667). All other YAML blocks untouched. Comment block above `publish:` rewritten to document the new contract.
3. `6a8a125` ci — `.github/workflows/release.yml` four hunks: (a) `test` job → matrix over `[ubuntu-latest, windows-2022, macos-14]` with `fail-fast: true` preserving CI-05 atomicity (D-22, D-23); (b) tag-version-guard step gated to Linux leg (`matrix.os == 'ubuntu-latest'`) with explicit `shell: bash` for cross-OS bash on Windows; (c) all 3 per-platform `actions/upload-artifact@v4` steps now use multi-line block-scalar `path:` to upload `latest*.yml` alongside installer (`release/*.dmg + release/latest-mac.yml`, `release/*.exe + release/latest.yml`, `release/*.AppImage + release/latest-linux.yml`); (d) `publish` job's `softprops/action-gh-release@v2.6.2` `files:` extended with `assets/latest.yml`, `assets/latest-mac.yml`, `assets/latest-linux.yml` — draft Release now ships 6 assets (3 installers + 3 feed files). All 14 SHA-pinned `uses:` references unchanged (Phase 11 D-22 supply-chain hygiene preserved).

Acceptance verification: all positive-presence greps PASS (matrix array, `fail-fast: true`, 3× `release/latest`, 3× `assets/latest`, `shell: bash`, gate clause `matrix.os == 'ubuntu-latest'`, 3× `if-no-files-found: error`, 3× `retention-days: 14`, 14 SHA-pinned actions); YAML parses via js-yaml; `npm run test` 331/331 vitest passing; `npm run typecheck:web` clean. Pre-existing `scripts/probe-per-anim.ts` typecheck failure carried forward unchanged via `.planning/phases/12-…/deferred-items.md` per SCOPE BOUNDARY (identical to Phase 11 deferred entry; survives `git stash` revert).

REL-06 (UPD-06) marked complete in REQUIREMENTS.md — the CI delivery surface that satisfies the auto-update path's pre-conditions is now live (matrix-OS validation happens on next CI tag push, likely 12-01's spike rc2).

Prior: Plan 11-02 (live verification of CI release pipeline) — closed prior to Phase 12 planning kickoff. v1.1.0-rc1 tag-push exercised the workflow; gh-CLI evidence captured for criteria 1–8; `workflow_dispatch` dry run + atomicity audit + REL-04 install smoke all signed off. Notable mid-plan adjustments: `electron-builder.yml` set to `publish: null` (commit `c0ac407`) to defeat electron-builder's auto-detect of GitHub provider from the git remote (which was breaking builds with "GitHub Personal Access Token is not set" before the build finished); CI-pipeline `.skipIf(CI)` applied to Girl wall-time test (`f00e232`). Phase 11 closed 2/2 plans.

Prior: Plan 11-01 (CI file-authoring wave) — 2026-04-27. Three atomic commits (69c8cc1, eb8a904, c253eb6) landed `release.yml` (150 lines, 5 jobs, 5 SHA-pinned actions), `release-template.md` (4 REL-02 sections, envsubst placeholders), and `package.json` `--publish never` bake-in.

Prior milestone: v1.0 (MVP) closed 2026-04-26. 12 phases, 62 plans, 331 vitest passing. Tag `v1.0`. See `.planning/MILESTONES.md`. v1.0 phase directories archived to `.planning/milestones/v1.0-phases/`.

## Next action

`/gsd-execute-phase 12` continues with Plan 12-01 (Wave 2) — auto-update wiring: import `electron-updater` from new `src/main/auto-update.ts`, wire main-process orchestrator (event-source side), hand-rolled ARIA `UpdateDialog.tsx` modal cloning HelpDialog scaffold, Help → Check for Updates menu item, startup check 3.5s after `app.whenReady()` with 10s hard timeout, "Later" persistence via new `src/main/update-state.ts` (recent.ts byte-for-byte template), Windows fallback path per spike outcome. Recommended pre-tag: `npm run build:dry` and confirm `release/mac/Spine Texture Manager.app/Contents/Resources/app-update.yml` exists with `provider: github` + `repo: Spine_Texture_Manager` (RESEARCH Open Question 5; load-bearing pre-condition for 12-01's spike).

## Open questions

- Phase 12: Does unsigned-Windows `electron-updater` work end-to-end, or do we ship the documented manual-update fallback (UPD-06)? Spike during plan-phase 12.
- Phase 13: Sentry vs. alternative crash-reporting vendor — locked at plan-phase 13.

## Decisions

(v1.0 decisions preserved in `.planning/PROJECT.md` "Key Decisions" table.)

v1.1 decisions to date:

- No paid signing certs in v1.1 (Apple Developer ID, Windows EV) — locked.
- Linux build verified via CI only (Phase 11); local Linux build is best-effort in Phase 10.
- Crash-reporting opt-out by default for tester builds (TEL-07); revisit before any public/store release.
- Phase 11 Plan 01: `.github/workflows/release.yml` (150 lines, 5 jobs, 5 SHA-pinned actions) + `.github/release-template.md` (envsubst-rendered, 4 REL-02 sections + Tag footer) + `package.json` build:mac/win/linux scripts now end with `--publish never` (defense-in-depth against Pitfall 1). Three atomic commits: 69c8cc1, eb8a904, c253eb6. 331 vitest tests still green; live workflow verification deferred to Plan 02.
- Phase 12 Plan 02: electron-updater@^6.8.3 added as runtime dependency (NOT devDep) — pinned to RESEARCH-VERIFIED latest stable on npm registry 2026-04-27. electron-builder.yml `publish` flipped from null → GitHub provider (owner=Dzazaleo, repo=Spine_Texture_Manager, releaseType=release) so app-update.yml bakes into bundled resources/ at build time. release.yml `test` job expanded to 3-OS matrix `[ubuntu-latest, windows-2022, macos-14]` with `fail-fast: true` preserving CI-05 atomicity. Per-platform upload-artifact steps now ship `latest*.yml` alongside installers via multi-line block-scalar `path:` glob. Publish-job `softprops/action-gh-release@v2.6.2` `files:` extended with 3 feed-file entries — draft Release ships 6 assets (3 installers + 3 feed files). Three atomic commits: a533c21, 7d9330d, 6a8a125. UPD-06 closed.

## Last session

2026-04-27 — Plan 12-02 (Wave 1, CI delivery surface for electron-updater) executed. Three atomic commits (a533c21 chore electron-updater@^6.8.3 to dependencies; 7d9330d chore electron-builder.yml publish: null → GitHub provider; 6a8a125 ci release.yml 3-OS matrix + latest*.yml feed file uploads). UPD-06 marked complete in REQUIREMENTS.md (CI delivery surface; runtime auto-update behavior validation lives in Plan 12-01's spike). 331 vitest tests still green; `npm run typecheck:web` clean. Pre-existing `scripts/probe-per-anim.ts` typecheck failure carried forward unchanged via `.planning/phases/12-…/deferred-items.md` per SCOPE BOUNDARY (identical to Phase 11 deferred entry; survives `git stash` revert; out of Phase 12 scope). Phase 12 now 1/6 plans complete; Plan 12-01 (Wave 2) unblocked.

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

**Active Phase:** 12 (auto-update-tester-install-docs) — 1/6 plans complete — Plan 12-02 closed 2026-04-27T19:27:13Z (Wave 1, CI delivery surface for electron-updater: electron-updater@^6.8.3 runtime dep, electron-builder.yml publish:github provider flip, release.yml 3-OS test matrix + latest*.yml feed publication; three atomic commits a533c21, 7d9330d, 6a8a125; UPD-06 closed); Plan 12-01 (Wave 2, auto-update wiring with Windows-spike runbook), 12-03 (F1 atlas-image URL fix on Windows), 12-04 (F2 file-picker UX fixes), 12-05 (F3 Spine 4.2 version guard), 12-06 (INSTALL.md authoring + linking surfaces) pending.

**Closed Phase:** 11 (CI release pipeline (GitHub Actions → draft Release)) — 2/2 plans complete. Plan 11-01 file-authoring wave (release.yml + release-template.md + package.json `--publish never` bake-in); Plan 11-02 live verification (v1.1.0-rc1 tag-push, gh-CLI evidence for criteria 1–8, workflow_dispatch dry run, atomicity audit, REL-04 install smoke); CI-01..CI-06 + REL-01/REL-02/REL-04 closed.

**Closed Phase:** 10 (Installer build) — 3/3 plans complete — 2026-04-27T10:08:45Z. Plan 10-01 (build-foundation: version 1.1.0-rc1 + per-platform npm scripts), Plan 10-02 (3-platform electron-builder.yml with mac.identity:'-' + asarUnpack sharp/@img), Plan 10-03 (live macOS .dmg + shell assertions + 10-SMOKE-TEST.md recipe + user-approved manual Optimize Assets smoke). Phase 10 contract DIST-01..DIST-07 closed; cross-platform live verification (Windows EXE, Linux AppImage) handed to Phase 11 CI.
