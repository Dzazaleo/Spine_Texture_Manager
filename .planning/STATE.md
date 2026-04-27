---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Distribution
status: unknown
last_updated: "2026-04-27T17:42:25.051Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 5
  percent: 45
---

# State

## Current milestone

v1.1 — Distribution

## Current phase

Phase 11 — CI release pipeline (GitHub Actions → draft Release). Plan 11-01 complete (1 of 2 plans closed); Plan 11-02 (live verification: tag-push + workflow_dispatch dry run + atomicity audit + REL-04 install smoke) pending.

## Current plan

11-02-PLAN.md — Live verification of the CI release pipeline. Will exercise the `release.yml` authored in Plan 01 by pushing `v1.1.0-rc1` and capturing `gh` CLI evidence for falsifiable acceptance criteria 1–8.

## Last completed

Plan 11-01 (CI file-authoring wave) — 2026-04-27. Three atomic commits land the entire Phase-11 file-authoring contract:

1. `69c8cc1` chore — package.json `build:mac`/`build:win`/`build:linux` scripts now end with `--publish never` (Pitfall 1 / GH_TOKEN auto-publish defense; `build:dry` untouched).
2. `eb8a904` feat — `.github/release-template.md` (27 lines, 4 REL-02 `##` sections + Tag footer; envsubst placeholders `${VERSION}` / `${TAG}` / `${INSTALL_DOC_LINK}`; three platform install bullets with macOS Gatekeeper "Open Anyway", Windows SmartScreen "Run anyway", Linux `chmod +x` + `libfuse2t64`).
3. `c253eb6` feat — `.github/workflows/release.yml` (150 lines, 5 jobs: test ⇒ 3 parallel builds ⇒ atomic publish; 5 SHA-pinned third-party actions; tag↔package.json version guard with `::error::` annotations; `if-no-files-found: error` × 3 + `fail_on_unmatched_files: true` × 1 for CI-05 atomicity; `--publish never` belt-and-braces in build invocations; `CSC_IDENTITY_AUTO_DISCOVERY: false` on macOS for Pitfall 7; envsubst-rendered release body with VERSION/TAG/INSTALL_DOC_LINK env vars; `prerelease: contains(github.ref_name, '-')` auto-flags `-rc1`).

Acceptance verification: all positive-presence greps PASS (5 jobs, 5 SHA pins, 3 build invocations with `--publish never`, 4 `cache: 'npm'`, 4 `npm ci`, 3 `if-no-files-found: error`, 3 `retention-days: 14`, 1 `fail_on_unmatched_files: true`, 1 envsubst step, 1 publish-job push-only if-gate, etc.); all anti-pattern greps return 0 (no `GH_TOKEN`/`GITHUB_TOKEN`, no `apt install libfuse2`, no `actions/cache@.*electron-builder`, no signing keys, no `latest.yml`, no Sentry/source-map upload, no floating `@v4`/`@main` versions, 0 tabs). 331 vitest tests still pass; `npm run typecheck` reveals a pre-existing unrelated failure in `scripts/probe-per-anim.ts` deferred per SCOPE BOUNDARY (logged to `.planning/phases/11-…/deferred-items.md`).

Plan 11-02 (live verification) is now unblocked: depends only on these three commits being on `main` and on `v1.1.0-rc1` being pushable.

Prior: Plan 10-03 (Installer smoke test, macOS) — 2026-04-27. Built v1.1.0-rc1 .dmg via `npm run build:mac`; live shell assertions proved DIST-04 (Signature=adhoc), DIST-06 static (sharp-darwin-arm64 + sharp-libvips-darwin-arm64 in app.asar.unpacked), DIST-07 (Info.plist CFBundleShortVersionString = 1.1.0-rc1 + matching filename). User approved manual Optimize Assets smoke against TWO fixtures (SIMPLE_TEST + Girl); non-zero PNGs + .atlas in both runs.

Prior milestone: v1.0 (MVP) closed 2026-04-26. 12 phases, 62 plans, 331 vitest passing. Tag `v1.0`. See `.planning/MILESTONES.md`. v1.0 phase directories archived to `.planning/milestones/v1.0-phases/`.

## Next action

`/gsd-execute-phase 11` continues with Plan 11-02 — live verification: push `v1.1.0-rc1`, observe workflow run, capture `gh release view` JSON evidence for VALIDATION.md falsifiable criteria 1–8, run `workflow_dispatch` dry run from `main`, perform verbal/static atomicity audit, REL-04 non-developer install smoke.

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

## Last session

2026-04-27 — Plan 11-01 (CI file-authoring wave) executed. Three atomic commits (69c8cc1 chore package.json `--publish never`; eb8a904 feat .github/release-template.md; c253eb6 feat .github/workflows/release.yml). CI-01..CI-06 and REL-01/REL-02 marked complete in REQUIREMENTS.md (file authoring; live behavioral verification via Plan 11-02). 331 vitest tests still green. Pre-existing typecheck failure in scripts/probe-per-anim.ts logged to deferred-items.md per SCOPE BOUNDARY (unrelated to Phase 11 contract). Phase 11 now 1/2 plans complete; Plan 11-02 live-verification pending.

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

**Active Phase:** 11 (CI release pipeline (GitHub Actions → draft Release)) — 1/2 plans complete — Plan 11-01 closed 2026-04-27T11:31:02Z (file-authoring wave: greenfield .github/workflows/release.yml + .github/release-template.md + package.json `--publish never` bake-in; three atomic commits 69c8cc1, eb8a904, c253eb6; CI-01..CI-06, REL-01, REL-02 file-level closed); Plan 11-02 (live verification: tag-push of v1.1.0-rc1, gh-CLI evidence capture, workflow_dispatch dry run, atomicity audit, REL-04 install smoke) pending.

**Closed Phase:** 10 (Installer build) — 3/3 plans complete — 2026-04-27T10:08:45Z. Plan 10-01 (build-foundation: version 1.1.0-rc1 + per-platform npm scripts), Plan 10-02 (3-platform electron-builder.yml with mac.identity:'-' + asarUnpack sharp/@img), Plan 10-03 (live macOS .dmg + shell assertions + 10-SMOKE-TEST.md recipe + user-approved manual Optimize Assets smoke). Phase 10 contract DIST-01..DIST-07 closed; cross-platform live verification (Windows EXE, Linux AppImage) handed to Phase 11 CI.

**Planned Phase:** 12 (auto-update-tester-install-docs) — 6 plans — 2026-04-27T17:42:25.046Z
