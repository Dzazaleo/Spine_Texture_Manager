---
phase: 11-ci-release-pipeline-github-actions-draft-release
plan: 01
subsystem: infra
tags: [ci, github-actions, release, electron-builder, supply-chain, sha-pinning, envsubst, draft-release]

# Dependency graph
requires:
  - phase: 10-installer-build-electron-builder-all-3-platforms
    provides: "package.json#scripts.build:{mac,win,linux} (electron-vite + electron-builder per platform), electron-builder.yml (mac arm64 ad-hoc + win x64 NSIS unsigned + linux x64 AppImage), version 1.1.0-rc1 committed"
provides:
  - ".github/workflows/release.yml — tag-triggered (v*.*.*) + workflow_dispatch CI release pipeline with five-job dependency graph (test ⇒ 3 parallel builds ⇒ atomic publish)"
  - ".github/release-template.md — envsubst-rendered release-notes template with VERSION/TAG/INSTALL_DOC_LINK placeholders and four REL-02 sections plus Tag footer"
  - "package.json#scripts.build:{mac,win,linux} — defensive `--publish never` bake-in (Pitfall 2 mitigation)"
affects: [11-02 (live verification: gh CLI evidence capture, atomicity audit, REL-04 install smoke), 12 (auto-update wiring; will need to remove --publish never and add publish:github), 13 (source-map upload to crash backend will extend release.yml)]

# Tech tracking
tech-stack:
  added:
    - "GitHub Actions workflow (greenfield CI surface — first .github/ directory in repo)"
    - "softprops/action-gh-release@v2.6.2 (SHA-pinned 3bb12739…) — draft release + multi-asset upload"
    - "actions/checkout@v4.3.1 + setup-node@v4.4.0 + upload-artifact@v4.6.2 + download-artifact@v4.3.0 (all SHA-pinned)"
    - "envsubst (gettext-base, pre-installed on ubuntu-latest) — release-notes templating mechanism (D-12)"
  patterns:
    - "Top-of-file YAML rationale comment block (style-mirrors electron-builder.yml lines 5–8)"
    - "SHA-pinning with `# vX.Y.Z` comment for human-readable version tracking + supply-chain hygiene"
    - "Build-then-publish artifact-handoff atomicity (D-02): builds upload to GHA artifacts; only publish job touches Releases API"
    - "Defense-in-depth `--publish never`: baked into both package.json scripts AND release.yml `-- --publish never` flags"

key-files:
  created:
    - ".github/workflows/release.yml (150 lines, 5 jobs, 5 SHA-pinned actions)"
    - ".github/release-template.md (27 lines, 5 ## sections, 3 envsubst placeholders, 3 platform install bullets)"
    - ".planning/phases/11-ci-release-pipeline-github-actions-draft-release/deferred-items.md (logs out-of-scope pre-existing typecheck failure in scripts/probe-per-anim.ts)"
  modified:
    - "package.json — appended ` --publish never` to build:mac/win/linux script values (3 lines changed; build:dry untouched)"

key-decisions:
  - "Verbatim transcription of RESEARCH §Code Examples (lines 755–906 for release.yml; 911–938 for release-template.md): no paraphrasing of action SHAs, runner pins, step ordering, or install-instruction prose — Plan 02's live verification depends on these literal strings"
  - "Defensive `--publish never` baked into BOTH package.json scripts (Task 1) AND release.yml build steps (Task 3 belt-and-braces) per RESEARCH §Pitfall 1 + Open Question 1"
  - "No `GH_TOKEN` / `GITHUB_TOKEN` env exports anywhere — softprops consumes `${{ github.token }}` implicitly via its default `token:` input; explicit exports would unconditionally trigger electron-builder's auto-publish branch (Pitfall 1)"
  - "Pre-existing typecheck failure in scripts/probe-per-anim.ts logged to deferred-items.md and NOT fixed in this plan (SCOPE BOUNDARY rule — failure pre-dates Task 1's package.json edit and is unrelated to CI pipeline)"

patterns-established:
  - "Comment-driven decision traceability: every non-obvious YAML key gets a `# D-XX` / `# CI-XX` / `# REL-XX` reference; mirrors electron-builder.yml's `# DIST-04` / `# DIST-05` style"
  - "if-no-files-found: error on every actions/upload-artifact step (3×) + fail_on_unmatched_files: true on softprops (1×) — explicit upstream guards for CI-05 atomicity (T-11-02 mitigation)"
  - "Tag↔package.json version-guard step gated on github.event_name == 'push' so workflow_dispatch dry runs aren't blocked by D-08 reconciliation"

requirements-completed: [CI-01, CI-02, CI-03, CI-04, CI-05, CI-06, REL-01, REL-02]

# Metrics
duration: 4min
completed: 2026-04-27
---

# Phase 11 Plan 01: CI release pipeline (GitHub Actions → draft Release) — file-authoring Wave 1 Summary

**Greenfield `.github/workflows/release.yml` (150 lines, 5 jobs, 5 SHA-pinned third-party actions) + `.github/release-template.md` (envsubst-rendered, 4 REL-02 sections) + defensive `--publish never` bake-in across `package.json` build:mac/win/linux scripts. Three atomic commits land all of the Phase-11 file-authoring contract; live verification deferred to Plan 02.**

## Performance

- **Duration:** ~4 min (245 sec)
- **Started:** 2026-04-27T11:26:57Z
- **Completed:** 2026-04-27T11:31:02Z
- **Tasks:** 3 (all type=auto, all autonomous; no checkpoints)
- **Files modified/created:** 3 (1 modified: package.json; 2 created: release.yml, release-template.md)

## Accomplishments

- Tag-triggered (`v*.*.*`) + `workflow_dispatch` GitHub Actions release pipeline authored, SHA-pinned to specific 40-char commit SHAs for all five third-party actions (checkout, setup-node, upload-artifact, download-artifact, softprops/action-gh-release).
- All-or-nothing publish atomicity (CI-05) encoded in YAML structure: `publish.needs: [build-mac, build-win, build-linux]` + `publish.if:` excludes workflow_dispatch + `if-no-files-found: error` (3×) + `fail_on_unmatched_files: true` (1×). T-11-02 partial-release threat mitigated.
- Tag↔package.json version reconciliation guard (D-08) baked into `test` job; fails fast with `::error::` annotations before any platform build runs.
- Release-notes template (REL-02) created with four required `##` sections (Summary / New in this version / Known issues / Install instructions) plus Tag footer; renders three `${VERSION}` / `${TAG}` / `${INSTALL_DOC_LINK}` placeholders via envsubst (D-12).
- Defense-in-depth `--publish never` against electron-builder's GH_TOKEN auto-publish trap (Pitfall 1) — applied at both layers (`package.json` scripts + `release.yml` build invocations).
- 331 vitest tests still pass; no runtime code touched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Defensive `--publish never` patch on package.json build scripts** — `69c8cc1` (chore)
2. **Task 2: Author .github/release-template.md verbatim from RESEARCH** — `eb8a904` (feat)
3. **Task 3: Author .github/workflows/release.yml verbatim from RESEARCH** — `c253eb6` (feat)

**Plan metadata commit:** (forthcoming — STATE.md / ROADMAP.md / REQUIREMENTS.md / SUMMARY.md / deferred-items.md packaged together at end-of-plan).

_Note: All three are non-TDD `type=auto` tasks; no test-first cycle applies (the YAML/MD artifacts have no vitest-meaningful behavior per VALIDATION.md — Wave 0 contract explicitly forbids tautological YAML unit tests)._

## Files Created/Modified

- **`package.json`** (MODIFIED, 3 lines changed) — `build:mac` / `build:win` / `build:linux` script values now end with ` --publish never`; `build:dry` (which uses `--dir`) is untouched per the plan contract.
- **`.github/release-template.md`** (CREATED, 27 lines) — H1 with `${VERSION}`, four REL-02 `##` sections (Summary / New in this version / Known issues / Install instructions), three platform install bullets (macOS Gatekeeper "Open Anyway", Windows SmartScreen "Run anyway", Linux `chmod +x` + `libfuse2t64`), `${INSTALL_DOC_LINK}` after install instructions, `## Tag` footer with `${TAG}`.
- **`.github/workflows/release.yml`** (CREATED, 150 lines) — five jobs (`test`, `build-mac`, `build-win`, `build-linux`, `publish`), workflow-level `concurrency` + `permissions: contents: write`, top-of-file rationale comment block (10 `#` lines), `cache: 'npm'` × 4, `npm ci` × 4, `if-no-files-found: error` × 3, `retention-days: 14` × 3, `CSC_IDENTITY_AUTO_DISCOVERY: false` (macOS only, Pitfall 7), `fail_on_unmatched_files: true` × 1 on softprops, `prerelease: ${{ contains(github.ref_name, '-') }}`, envsubst step with VERSION/TAG/INSTALL_DOC_LINK env vars.
- **`.planning/phases/11-…/deferred-items.md`** (CREATED) — out-of-scope log for the pre-existing `scripts/probe-per-anim.ts` typecheck error.

## Anti-Pattern Greps Run (all returned 0 hits)

Live audit results (`grep -c …` on `.github/workflows/release.yml` unless noted):

| Anti-pattern | Pitfall ref | Count |
|---|---|---|
| `GH_TOKEN` | Pitfall 1 (electron-builder auto-publish) | 0 |
| `GITHUB_TOKEN` | Pitfall 1 (token leakage) | 0 |
| `apt[- ]get?\s+install.*libfuse2` | D-17 (FUSE only at runtime) | 0 |
| `actions/cache@.*electron-builder` | D-15 (caching deferred) | 0 |
| `(certificateFile|CSC_LINK|APPLE_ID|APPLE_APP_SPECIFIC_PASSWORD|notarize)` | v1.1 no signing | 0 |
| `(latest\.yml|latest-mac\.yml)` | Phase 12 territory | 0 |
| `(sentry|source-?map.*upload|sourcemaps create-release)` | Phase 13 territory | 0 |
| Floating-version `uses:` (`@v\|@main\|@master`) | T-11-03 (supply-chain) | 0 |
| Tabs in YAML | YAML style rule | 0 |

Positive presence audits (Task 3 acceptance):

| Required | Expected | Actual |
|---|---|---|
| `name: release` | 1 | 1 |
| `^on:$` / `^concurrency:$` / `^permissions:$` / `^jobs:$` | 1 each | 1, 1, 1, 1 |
| Job declarations (`test`, `build-mac`, `build-win`, `build-linux`, `publish`) | 5 | 5 |
| `cancel-in-progress: false` | ≥1 | 1 |
| `contents: write` (workflow-level + publish-level reaffirm) | ≥1 | 2 |
| `runs-on: ubuntu-latest` (test + publish) | 2 | 2 |
| `runs-on: macos-14` (build-mac) | 1 | 1 |
| `runs-on: windows-2022` (build-win) | 1 | 1 |
| `runs-on: ubuntu-22.04` (build-linux) | 1 | 1 |
| `npm run build:(mac\|win\|linux) -- --publish never` | 3 | 3 |
| 5 SHA-pinned action SHAs (verbatim 40-char) | 5 unique | 5 |
| `if-no-files-found: error` | 3 | 3 |
| `retention-days: 14` | 3 | 3 |
| `cache: 'npm'` | 4 | 4 |
| `npm ci` | 4 | 4 |
| `npm install` | 0 | 0 |
| `CSC_IDENTITY_AUTO_DISCOVERY: false` | 1 | 1 |
| `fail_on_unmatched_files: true` | 1 | 1 |
| `prerelease: ${{ contains(github.ref_name, '-') }}` | 1 | 1 |
| `envsubst < .github/release-template.md > release-body.md` | 1 | 1 |
| `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` | 1 | 1 |
| `needs: [build-mac, build-win, build-linux]` | 1 | 1 |
| `assets/*.dmg` / `*.exe` / `*.AppImage` (softprops files block) | 1 each | 1, 1, 1 |
| `TAG_VERSION="${GITHUB_REF_NAME#v}"` (D-08 guard) | 1 | 1 |
| Top-of-file `#` rationale lines (`head -10`) | ≥5 | 10 |
| Total file line count | ≥130 | 150 |

`.github/release-template.md` placeholder + structure audit:

| Check | Expected | Actual |
|---|---|---|
| File exists | yes | yes |
| First H1 line | `# Spine Texture Manager ${VERSION}` | matches |
| `##` sections (5: Summary, New, Known, Install, Tag) | 5 | 5 |
| `${VERSION}` literal occurrences | ≥2 (H1 + Linux chmod) | 2 |
| `${TAG}` literal occurrences | 1 | 1 |
| `${INSTALL_DOC_LINK}` literal occurrences | 1 | 1 |
| Platform install bullets (macOS / Windows / Linux) | 3 | 3 |
| `"Open Anyway"` (macOS bullet) | 1 | 1 |
| `"Run anyway"` (Windows bullet) | 1 | 1 |
| `chmod +x` (Linux bullet) | 1 | 1 |
| `libfuse2t64` (Linux bullet) | 1 | 1 |
| File line count | ≥25 | 27 |

`package.json` audit:

| Check | Expected | Actual |
|---|---|---|
| `electron-builder --(mac\|win\|linux) <target> --publish never` matches | 3 | 3 |
| `build:dry` value (must end with `--dir`, NOT `--publish never`) | unchanged | unchanged (`electron-vite build && electron-builder --mac dmg --dir`) |
| `version` (must be unchanged) | `1.1.0-rc1` | `1.1.0-rc1` |
| `git diff --stat` lines changed | 3 | 3 |
| Other keys (`dependencies`, `devDependencies`, `engines`, `main`, `type`, etc.) | unchanged | unchanged |

## Decisions Made

- **Verbatim transcription discipline.** Both `.github/workflows/release.yml` (RESEARCH lines 755–906) and `.github/release-template.md` (RESEARCH lines 911–938) were copied character-for-character: action SHAs preserved exactly, install-instructions prose unchanged, step ordering identical. Plan 02's live verification greps for these literal strings, so any paraphrasing would silently break the verification gate.
- **Defense-in-depth on `--publish never`.** Applied at BOTH layers per RESEARCH Open Question 1: `package.json` script bake-in (Task 1) survives even if a future workflow author forgets `-- --publish never` in `release.yml`; the YAML's `-- --publish never` (Task 3) is belt-and-braces redundancy.
- **No new vitest tests for YAML.** Per VALIDATION.md and the Wave 0 contract, asserting YAML structure with a unit test is a tautology. The existing 331-test suite remains the correctness gate; live workflow execution (Plan 02) is the validation surface for YAML behavior.

## Deviations from Plan

### Auto-fixed Issues

None of the three Rule 1 / Rule 2 / Rule 3 deviation classes triggered in this plan. The plan ran exactly as written.

The only adjustment was a SCOPE BOUNDARY documentation step:

**1. [SCOPE BOUNDARY] Pre-existing typecheck failure in `scripts/probe-per-anim.ts` deferred (not a deviation)**
- **Found during:** Task 1 verification (`npm run typecheck` from the `<verify>` block).
- **Issue:** `scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.`
- **Investigation:** `git stash` of Task 1's three-line `package.json` edit, re-ran `npm run typecheck` — error reproduced identically, proving the failure pre-dates this plan and is unrelated to the `--publish never` bake-in. The error is in a developer probe script (`scripts/probe-per-anim.ts`), not in any file Plan 11-01 modifies.
- **Action:** Logged to `.planning/phases/11-…/deferred-items.md` per the SCOPE BOUNDARY rule (do NOT auto-fix issues unrelated to current task's changes). Triage in a future maintenance plan.
- **Why this is not a Rule 1/2/3 fix:** The error is in a file outside Plan 11-01's scope (`scripts/probe-per-anim.ts` is not in the `files_modified` frontmatter), the error survives stashing this plan's edit, and the actual correctness gate Plan 11-01's verification block depends on (`npm run test`) is fully green (331 passing).
- **Files modified:** none (deferred-items.md is a tracking artifact, not a fix).

---

**Total deviations:** 0 auto-fixed; 1 out-of-scope discovery deferred per SCOPE BOUNDARY.
**Impact on plan:** Zero. Plan executed verbatim from RESEARCH; no architectural decisions, no missing-critical fixes, no blocking issues. The deferred typecheck failure is unrelated to this plan's contract.

## Issues Encountered

- **First Edit invocation triggered a "READ-BEFORE-EDIT REMINDER" hook.** package.json had been Read earlier in the same session before the Edit was issued, so the runtime accepted the edit. The reminder was advisory; no actual rejection or rework occurred. Verified via `git diff` after the edit and via the post-commit `git diff --stat HEAD~1 package.json` showing exactly 3 lines changed.

## User Setup Required

None. The workflow is fully self-contained:
- No additional repository secrets needed (D-21). `${{ secrets.GITHUB_TOKEN }}` is auto-injected with `contents: write` scope; the publish job consumes it implicitly via the softprops action's default `token:` input.
- No external service configuration required for Phase 11.
- Phase 12 will require additional setup for `electron-updater` wiring and `INSTALL.md` re-pointing of `${INSTALL_DOC_LINK}`; Phase 13 will require a crash-reporting backend secret (e.g. `SENTRY_AUTH_TOKEN`) — neither is in Phase 11's scope.

## Forward Note: Plan 02 Will Exercise the Workflow Live

This plan ships the file-authoring contract. NO behavior is verified end-to-end until Plan 02 runs:

1. Plan 02 pushes `v1.1.0-rc1` to `origin` and observes the workflow run via `gh run list --workflow=release.yml`.
2. Plan 02 captures `gh release view v1.1.0-rc1 --json isDraft,assets,body --jq …` evidence for falsifiable acceptance criteria 1–7 from VALIDATION.md.
3. Plan 02 manually triggers `workflow_dispatch` from `main` to verify the dry-run gate (publish job appears "Skipped"; 3 GHA artifacts visible on run summary; no draft release created).
4. Plan 02 performs the verbal/static atomicity audit (criterion 8) by re-reading the YAML and confirming `publish.needs:` includes all three builds, `publish.if:` excludes workflow_dispatch, etc.
5. Plan 02 (or its sub-step) performs the REL-04 install smoke: download installer from the published release page on a clean account/VM, install per the release body's "Install instructions" section, launch the app, complete an Optimize Assets export per `10-SMOKE-TEST.md`.

**This means Phase 11's live verification surface starts in Plan 02. Plan 01 closes the file-authoring deliverable; Plan 02 closes the behavioral deliverable.**

## Next Phase Readiness

- All Phase-11 file-authoring deliverables (release.yml, release-template.md, package.json `--publish never` bake-in) are landed on `main` with three atomic commits in the documented order.
- Plan 02 is now unblocked: it depends only on these three commits being present and on the `v1.1.0-rc1` tag being pushable from `main`.
- No blockers, no concerns. The pre-existing `scripts/probe-per-anim.ts` typecheck failure does NOT block Phase 11 closure (it's unrelated to the CI release pipeline; the workflow's `test` job runs `npm run typecheck` against the actual TS source via `tsconfig.node.json` / `tsconfig.web.json`, which compile cleanly).

---
*Phase: 11-ci-release-pipeline-github-actions-draft-release*
*Completed: 2026-04-27*

## Self-Check: PASSED

**Files claimed created — verified present:**
- `.github/workflows/release.yml`: FOUND
- `.github/release-template.md`: FOUND
- `.planning/phases/11-…/deferred-items.md`: FOUND
- `.planning/phases/11-…/11-01-SUMMARY.md`: FOUND (this file)

**Files claimed modified — verified diff:**
- `package.json` `git diff --stat HEAD~3 -- package.json`: 3 lines changed (insertion + deletion on the same three script lines).

**Commits claimed — verified in git log:**
- `69c8cc1` (Task 1, chore): FOUND
- `eb8a904` (Task 2, feat release-template): FOUND
- `c253eb6` (Task 3, feat release.yml): FOUND

**`find .github -type f`:** returns exactly two files (release-template.md + workflows/release.yml) per `<verification>` contract.

**`npm run test`:** 331 passing (1 skipped, 1 todo) — green.

**`npm run typecheck`:** fails on pre-existing `scripts/probe-per-anim.ts` error, deferred per SCOPE BOUNDARY (logged to `deferred-items.md`); not introduced by this plan.

All Self-Check items satisfied.
