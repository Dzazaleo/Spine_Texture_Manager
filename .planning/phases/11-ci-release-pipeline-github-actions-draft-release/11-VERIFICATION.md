---
phase: 11-ci-release-pipeline-github-actions-draft-release
verified: 2026-04-27T00:00:00Z
status: passed
score: 17/17 must-haves verified (5 ROADMAP success criteria + 8 Plan-01 truths + 8 Plan-02 truths; deduplicated where overlapping; Linux REL-04 runtime smoke explicitly deferred to Phase 12 per phase acceptance criteria)
overrides_applied: 0
re_verification:
  is_re_verification: false
deferred:
  - truth: "Linux x64 AppImage runtime install smoke (REL-04 per-OS coverage, third platform)"
    addressed_in: "Phase 12"
    evidence: "Phase 11 Plan 02 Task 5 acceptance criteria explicitly permit Linux deferral when maintainer lacks Linux host AND user explicitly defers (both conditions documented met in 11-LIVE-VERIFICATION.md). Phase 12 ROADMAP success criterion #5 owns INSTALL.md (REL-03) and tester distribution begins there. CI-side artifact production (Linux AppImage built, attached to draft release at 138 MB with correct filename) is verified by Phase 11 falsifiable criterion #5. Three Windows-runtime findings spilled to 11-WIN-FINDINGS.md are explicitly Phase 12 prereqs (atlas viewer URL bug, file-picker UX, Spine 3.8 safeguard) — none are CI release-pipeline bugs."
  - truth: "Optional code-review polish items (envsubst allowlist, concurrency group key, engines.node tightening, --publish never redundancy cleanup, build:dry consistency, SHA version-comment uniformity, ubuntu-version asymmetry note, AppImage filename literal in template)"
    addressed_in: "Phase 12+ (or follow-up maintenance — not blocking)"
    evidence: "11-REVIEW.md flagged 0 critical, 3 warnings, 5 info. The reviewer explicitly stated 'no blockers — pipeline is live-verified green.' All warnings are quality/robustness improvements; none affects falsifiable closure conditions."
---

# Phase 11: CI release pipeline (GitHub Actions → draft Release) — Verification Report

**Phase Goal (from ROADMAP.md):** Pushing a `v*.*.*` tag triggers a GitHub Actions workflow that runs the full test suite then builds Windows, macOS, and Linux installers in parallel jobs and attaches all three assets to a draft GitHub Release for that tag — establishing the user-facing distribution channel and providing the only verification surface for the Linux build.

**Verified:** 2026-04-27
**Status:** **passed**
**Re-verification:** No — initial verification.

---

## Goal Achievement

The Phase 11 goal is fully achieved. Live evidence (cross-checked against the GitHub Actions API independently of `11-LIVE-VERIFICATION.md`'s claims) confirms:

- A real `v1.1.0-rc1` tag push fired a real GitHub Actions workflow run (24994332338) that ran the test job, then built `.dmg`, `.exe`, and `.AppImage` installers concurrently on macos-14 / windows-2022 / ubuntu-22.04, then published a draft GitHub Release with all three installers attached and an envsubst-rendered release body.
- The atomicity guarantee (no partial-asset publication) is proven empirically by **two failed runs** (24993716580 — test job failed; 24994071839 — all three build jobs failed) where `publish` was correctly skipped via the `needs:` chain and `gh release list` returned empty after each. This is stronger evidence than a static audit alone.
- The `workflow_dispatch` dry-run path (24994622845) executes the full build matrix on `main` while skipping `publish`, confirming the `if: github.event_name == 'push' && startsWith(github.ref, 'refs/tags/v')` gate works.

### Observable Truths

ROADMAP success criteria are the canonical contract; PLAN must-haves add operational detail. Both sets are deduplicated below.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | (SC1) Pushing tag `v1.1.0-rc1` triggers a workflow that runs vitest, then builds Win/mac/Linux in parallel jobs, and publishes a draft GitHub Release with three installer assets attached | ✓ VERIFIED | Run **24994332338** (commit `c0ac407`, event `push`) — independently confirmed via `gh api repos/Dzazaleo/Spine_Texture_Manager/actions/runs/24994332338` returning `{conclusion: success, event: push, head_sha: c0ac407…}`. Job sequencing (also re-confirmed via gh API): test 12:13:35Z→12:14:27Z; build-{mac,win,linux} all started 12:14:29Z (concurrent); publish 12:16:55Z→12:17:19Z. Draft release `v1.1.0-rc1` exists with `isDraft: true`, `isPrerelease: true`, three assets totaling 372 MB (arm64.dmg / x64.exe / x86_64.AppImage). |
| 2 | (SC2) `workflow_dispatch` manual trigger on `main` runs the same pipeline as a dry run; does not produce a published release; artifacts available as workflow artifacts | ✓ VERIFIED | Run **24994622845** (commit `d6db749`, event `workflow_dispatch`) — independently confirmed. Job conclusions: test/build-mac/build-win/build-linux all `success`; publish `skipped`. Three GHA artifacts uploaded (installer-mac 125 MB, installer-win 108 MB, installer-linux 138 MB); no new draft release created (`gh release list` returned only the prior `v1.1.0-rc1` from criterion 1). |
| 3 | (SC3) Vitest failure aborts before installer builds; no draft release created | ✓ VERIFIED | Run **24993716580** (commit `24d17a3`, event `push`) — `gh api` confirms `conclusion: failure`. The `tests/main/sampler-worker-girl.spec.ts` warmup-error blocked the `test` job; downstream build + publish jobs all skipped via `needs:` chain; `gh release list` returned `[]`. This is exactly the SC3 contract working as designed (and surfaced a real Phase 9 design gap that the workflow correctly caught — see fix-forward below). |
| 4 | (SC4) Platform build failure prevents partial-asset publication (all-or-nothing atomicity) | ✓ VERIFIED | Run **24994071839** (commit `f00e232`, event `push`) — `gh api` confirms `conclusion: failure`. Test job succeeded, but **all three** platform builds failed simultaneously on the electron-builder publisher auto-detect trap (Pitfall 1 design gap). Publish job correctly skipped; no draft release created. The empirical evidence from this failure mode is stronger than the verbal/static audit alone — atomicity-by-construction is proven, not just asserted. |
| 5 | (SC5) Draft release body follows documented template; non-developer tester can install on their OS without git/Node toolchain | ✓ VERIFIED (with one explicit deferral) | Body audit: 5 H2 sections rendered (`Summary`, `New in this version`, `Known issues`, `Install instructions`, `Tag`); 0 unrendered `${VERSION}/${TAG}/${INSTALL_DOC_LINK}` placeholders; `v1.1.0-rc1` literal appears 3× (header, install bullet, Tag footer). Per-OS install smoke: macOS arm64 PASS (Optimize Assets succeeded; CFBundleShortVersionString=1.1.0-rc1; Signature=adhoc); Windows x64 PASS (Optimize Assets 153/153 in 10.7s on Spine 4.2 fixture); Linux x64 explicitly deferred to Phase 12 tester rounds per acceptance-criteria allowance (no Linux host; CI-side artifact production verified by criterion #5). |
| 6 | Workflow run begins within 30 s of tag push (criterion #1 from VALIDATION.md) | ✓ VERIFIED | Run 24994332338 queued at 12:13:32Z, 3 s after the 12:13:29Z push. Far within the 30 s budget. |
| 7 | Test job runs vitest BEFORE any installer build job is scheduled (CI-03) | ✓ VERIFIED | `test.completedAt: 2026-04-27T12:14:27Z` precedes `min(build-*.startedAt): 2026-04-27T12:14:29Z` by 2 s. The `needs: test` clause on each build job is enforced at the GHA scheduler level. |
| 8 | Three platform builds start concurrently after `test` succeeds | ✓ VERIFIED | All three build jobs share `startedAt: 2026-04-27T12:14:29Z`. Concurrent execution on three distinct runner images (macos-14, windows-2022, ubuntu-22.04). |
| 9 | If any build fails, publish is skipped and no draft release is created (T-11-02 mitigation) | ✓ VERIFIED EMPIRICALLY | Two failed runs (24993716580, 24994071839) provide positive empirical proof. Static audit (Task 4 of Plan 02) confirms `publish.needs: [build-mac, build-win, build-linux]` (line 113), `if-no-files-found: error` (3 occurrences: lines 71, 90, 109), `fail_on_unmatched_files: true` (line 146 inside SHA-pinned softprops step at line 139). |
| 10 | On successful tag-push run, draft GitHub Release is created with three installer assets attached | ✓ VERIFIED | `gh release view v1.1.0-rc1` independently confirmed: `isDraft: true`, three assets — `Spine.Texture.Manager-1.1.0-rc1-arm64.dmg` (125 MB), `…-x64.exe` (108 MB), `…-x86_64.AppImage` (138 MB), all matching the documented filename pattern. |
| 11 | Release body has the four documented sections rendered with no remaining `${VERSION}/${TAG}/${INSTALL_DOC_LINK}` placeholders (REL-02) | ✓ VERIFIED | `grep -cE '^## (Summary\|New in this version\|Known issues\|Install instructions\|Tag)$'` = 5 (4 REL-02 sections + Tag footer). `grep -cE '\$\{(VERSION\|TAG\|INSTALL_DOC_LINK)\}'` = 0. envsubst rendered cleanly. |
| 12 | On `workflow_dispatch` from main, test+build jobs run but publish is skipped (no release) | ✓ VERIFIED | Run 24994622845 confirms publish.conclusion=skipped, three artifacts on run summary, `gh release list` shows only v1.1.0-rc1 (from criterion 1) — no new draft created. |
| 13 | `build:mac/win/linux` scripts in package.json carry `--publish never` (Pitfall 2 defense) | ✓ VERIFIED | `grep -cE '"build:(mac\|win\|linux)".*--publish never' package.json` = 3. Build scripts confirmed: `electron-builder --mac dmg --publish never`, `--win nsis --publish never`, `--linux AppImage --publish never`. |
| 14 | Atomicity audit (verbal/static): `publish.needs` lists all 3 builds, `publish.if` excludes workflow_dispatch, `if-no-files-found: error` ×3, `fail_on_unmatched_files: true` ×1 | ✓ VERIFIED | Independent re-greps of `.github/workflows/release.yml`: `if-no-files-found: error` count = 3 ✓; `fail_on_unmatched_files: true` count = 1 ✓; `GH_TOKEN/GITHUB_TOKEN` count = 0 ✓; `npm run build:(mac\|win\|linux) -- --publish never` matches = 3 ✓; all 5 SHA-pinned action hashes present once each ✓. |
| 15 | Maintainer can download installers from the release page and install on each OS without git/Node (REL-04) | ✓ VERIFIED-WITH-DEFERRAL | macOS PASS (file exists in /Applications, Optimize Assets succeeded); Windows PASS (153/153 attachments succeeded in 10.7s on Spine 4.2 input); Linux DEFERRED per explicit acceptance allowance to Phase 12 tester rounds. The 3 Windows-runtime findings (F1 atlas viewer 404 with `localhostc/`, F2 file-picker UX, F3 Spine 3.8 safeguard) are app-runtime/UX issues unrelated to the CI release pipeline contract — appropriately spilled to 11-WIN-FINDINGS.md as Phase 12 prereqs. |
| 16 | Two collateral fix-forward changes are appropriately scoped, well-rationalized, and don't introduce new issues | ✓ VERIFIED | `f00e232` applies `it.skipIf(process.env.CI)` to the Girl wall-time test, with the spec file's existing header (lines 8, 23–26) explicitly authorizing this from CONTEXT.md when `fixtures/Girl/` is gitignored. Narrow, single-line change. `c0ac407` adds `publish: null` to `electron-builder.yml` with a 7-line comment block citing the Pitfall 1 root cause and forward-referencing Phase 12 replacement. Both changes are minimal, justified by the live runs that surfaced them, and pass the code review (11-REVIEW.md positive notes). |
| 17 | All 9 phase requirement IDs (CI-01..CI-06, REL-01, REL-02, REL-04) are marked Complete in REQUIREMENTS.md with Phase 11 traceability references | ✓ VERIFIED | Independent grep of `.planning/REQUIREMENTS.md` lines 99–108 confirms each ID has a Phase 11 row with run-id-bearing evidence. CI-01 cites run 24994332338 fired within 3 s; CI-02 cites concurrent startedAt 12:14:29Z; CI-03 cites test.completedAt precedes min(build-*.startedAt); CI-04 cites SHA-pinned softprops draft creation; CI-05 cites the two empirical failed-run proofs; CI-06 cites the workflow_dispatch run; REL-01 cites the three-asset list; REL-02 cites the body audit; REL-04 cites macOS PASS + Windows PASS + Linux explicit deferral. |

**Score:** 17/17 truths verified. One explicit deferral (Linux REL-04 runtime smoke) is permitted by Phase 11 acceptance criteria and addressed in Phase 12; not a gap.

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Linux x64 AppImage runtime install smoke (REL-04 third-platform coverage) | Phase 12 | (a) Plan 02 Task 5 acceptance criteria L560–561: "Acceptable to defer Linux smoke to Phase 12 tester rounds IF the maintainer lacks a Linux host AND the user explicitly chooses to defer; the deferral and rationale must be documented in this section." Both conditions documented met. (b) Phase 12 ROADMAP SC5: "The repo root contains an `INSTALL.md` that walks a non-developer through download → install → first launch on each of the three OSes" — Phase 12 owns tester distribution + INSTALL.md (REL-03) and is where Linux smoke logically lands. (c) CI-side Linux artifact production already verified by criterion #5 (138 MB AppImage attached, correct filename). |
| 2 | F1: Windows atlas viewer 404 on `app-image://localhostc/` | Phase 12 | Documented in 11-WIN-FINDINGS.md as "Phase 12 prerequisite" because Atlas Preview is referenced in REL-03 (INSTALL.md tester surface). Path-concatenation bug pre-dates Phase 11; surfaced by the first-ever Windows install. |
| 3 | F2: Windows file-picker UX confusion (default folder name "images") | Phase 12 | Documented in 11-WIN-FINDINGS.md as "Phase 12 polish." Workaround works (153/153 succeeded in 10.7s); first-run UX needs Windows-aware redesign before tester rounds. |
| 4 | F3: No safeguard for Spine 3.8 rigs (silent-failure) | Phase 12 (or 9.x retroactive polish) | Documented in 11-WIN-FINDINGS.md. CLAUDE.md already documents 4.2+ requirement; runtime guard missing. Should land before tester rounds. |
| 5 | Code review warnings + info items (envsubst allowlist, concurrency group, engines.node, --publish never redundancy, build:dry, SHA version comments, ubuntu asymmetry, AppImage filename literal) | Phase 12+ / maintenance | 11-REVIEW.md explicitly states "no blockers — pipeline is live-verified green." Quality/robustness improvements, not falsifiable-criteria gaps. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/release.yml` | Tag-triggered + workflow_dispatch CI release pipeline; ≥130 lines; `name: release` present | ✓ VERIFIED | 150 lines; 5 jobs declared (test/build-mac/build-win/build-linux/publish); all 5 SHA-pinned actions present; `name: release` line 12; structure matches Plan-01 acceptance criteria. |
| `.github/release-template.md` | envsubst-rendered template; ≥25 lines; `## Summary` present; 3 placeholders | ✓ VERIFIED | 27 lines; 5 H2 sections (Summary/New in this version/Known issues/Install instructions/Tag); 4 placeholder occurrences (`${VERSION}` ×2, `${TAG}` ×1, `${INSTALL_DOC_LINK}` ×1). |
| `package.json` | `build:mac/win/linux` scripts carry `--publish never` (Pitfall 2 defense) | ✓ VERIFIED | All three scripts confirmed verbatim; version unchanged at `1.1.0-rc1`; `build:dry` correctly untouched (uses `--dir`). |
| `electron-builder.yml` | `publish: null` block (collateral fix-forward c0ac407) | ✓ VERIFIED | Line 16: `publish: null` present, with 7-line comment block citing Pitfall 1 root cause. |
| `tests/main/sampler-worker-girl.spec.ts` | `.skipIf(env.CI)` applied (collateral fix-forward f00e232) | ✓ VERIFIED | Line 27: `it.skipIf(process.env.CI)(` present; spec header (line 8) cites CONTEXT.md authorization for this exact change. |
| `.planning/phases/11-…/11-LIVE-VERIFICATION.md` | Captured gh CLI output for all 8 falsifiable criteria + REL-04 smoke; ≥50 lines | ✓ VERIFIED | 422 lines; all 4 cited run IDs (24993716580, 24994071839, 24994332338, 24994622845) independently confirmed via `gh api`; all gh CLI captures match the actual API responses. |
| `.planning/phases/11-…/11-WIN-FINDINGS.md` | Three Windows runtime findings deferred to Phase 12 with severity + reproduction + suggested fix | ✓ VERIFIED | 134 lines; F1/F2/F3 each have severity, symptoms, hypothesis, reproduction, suggested fix, phase placement. Cross-cutting note recommends `windows-2022` test runner for Phase 12. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `release.yml#publish.needs` | `[build-mac, build-win, build-linux]` | GHA needs: graph | ✓ WIRED | Line 113. Independently confirmed empirically: publish started at 12:16:55Z, after slowest build (build-win) finished at 12:16:52Z. |
| `release.yml#publish` | `release-template.md` | envsubst step | ✓ WIRED | Line 136: `envsubst < .github/release-template.md > release-body.md`. Live verification: body output has 0 unrendered placeholders. |
| `release.yml#publish` | softprops/action-gh-release@2.6.2 | SHA-pinned draft + multi-asset upload | ✓ WIRED | Line 139: `softprops/action-gh-release@3bb12739c298aeb8a4eeaf626c5b8d85266b0e65  # v2.6.2`. Live: produced 3-asset draft release. |
| `release.yml#test` | `package.json#scripts.test` | npm run test | ✓ WIRED | Line 51: `- run: npm run test`. Live: test job ran for 52 s (12:13:35Z → 12:14:27Z). |
| `release.yml#build-{mac,win,linux}` | `package.json#scripts.build:{mac,win,linux}` | `npm run build:<os> -- --publish never` | ✓ WIRED | Lines 64, 85, 104. Belt-and-braces with package.json bake-in. Live: all 3 build jobs produced their respective installer files. |
| `git tag v1.1.0-rc1 push` | GHA workflow run | `git push origin v1.1.0-rc1` | ✓ WIRED | Run 24994332338 queued 3 s after push. Empirical confirmation. |
| Workflow publish job | GitHub Releases draft v1.1.0-rc1 | softprops + ${{ github.token }} | ✓ WIRED | `gh release view v1.1.0-rc1` confirms presence with 3 assets. |
| Maintainer (manual) | v1.1.0-rc1 installer downloads → install per-OS | gh release download + install per release-template instructions | ✓ WIRED (mac/win); deferred (linux) | macOS Optimize Assets PASS; Windows Optimize Assets 153/153 PASS; Linux DEFERRED to Phase 12. |

### Data-Flow Trace (Level 4)

This phase's artifacts are CI workflow YAML and a markdown template — they don't render dynamic UI data. The "data flow" is the workflow's runtime job graph, which has been verified empirically through live runs (the strongest possible evidence). The traditional Level 4 (state → render) check does not apply.

| Artifact | "Data" Source | Source Produces Real Data | Status |
|----------|--------------|---------------------------|--------|
| `release.yml` test job → vitest | `package.json#scripts.test` → `vitest run` over `tests/` | YES — 331 tests passing (production); skipped Girl-fixture test deliberately | ✓ FLOWING |
| `release.yml` build-{os} → installer | `electron-builder` over `out/` | YES — 3 installers (.dmg / .exe / .AppImage) attached to draft release with non-zero sizes | ✓ FLOWING |
| `release.yml` publish → release body | `envsubst` over `release-template.md` with `VERSION/TAG/INSTALL_DOC_LINK` env | YES — body rendered with all 3 placeholders substituted; 0 unrendered remain | ✓ FLOWING |
| `release.yml` publish → release assets | `softprops/action-gh-release@v2.6.2` consuming `assets/*.{dmg,exe,AppImage}` | YES — 3 assets attached to draft, sizes match build-job artifact sizes within ~30 bytes (commit-SHA embedding only difference) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Workflow file is valid YAML & syntactically parseable by GHA | `gh api repos/Dzazaleo/Spine_Texture_Manager/actions/workflows --jq '.workflows[] \| select(.name=="release")'` | Workflow registered & runnable | ✓ PASS |
| Cited canonical run actually exists & succeeded | `gh api repos/Dzazaleo/Spine_Texture_Manager/actions/runs/24994332338 --jq '.conclusion, .head_sha, .event'` | `success c0ac407… push` | ✓ PASS |
| Cited workflow_dispatch run actually exists & matches stated commit/event | `gh api repos/Dzazaleo/Spine_Texture_Manager/actions/runs/24994622845 --jq '.conclusion, .head_sha, .event'` | `success d6db74… workflow_dispatch` | ✓ PASS |
| Cited failed run #1 (Girl test) actually failed | `gh api repos/Dzazaleo/Spine_Texture_Manager/actions/runs/24993716580 --jq '.conclusion'` | `failure` | ✓ PASS |
| Cited failed run #2 (publisher auto-detect) actually failed | `gh api repos/Dzazaleo/Spine_Texture_Manager/actions/runs/24994071839 --jq '.conclusion'` | `failure` | ✓ PASS |
| Draft release v1.1.0-rc1 exists with 3 assets | `gh release view v1.1.0-rc1 --json isDraft,assets` | `isDraft: true; 3 assets` | ✓ PASS |
| Atomicity grep #1 (`publish.needs` lists 3 builds) | `grep -nE '^    needs:.*build-mac.*build-win.*build-linux' .github/workflows/release.yml` | line 113 match | ✓ PASS |
| Atomicity grep #2 (`if-no-files-found: error` ×3) | `grep -c 'if-no-files-found: error' .github/workflows/release.yml` | `3` | ✓ PASS |
| Atomicity grep #3 (`fail_on_unmatched_files: true` ×1) | `grep -c 'fail_on_unmatched_files: true' .github/workflows/release.yml` | `1` | ✓ PASS |
| Atomicity grep #4 (`GH_TOKEN/GITHUB_TOKEN` absent) | `grep -c 'GH_TOKEN\|GITHUB_TOKEN' .github/workflows/release.yml` | `0` | ✓ PASS |
| package.json `--publish never` bake-in (Pitfall 2 defense) | `grep -cE '"build:(mac\|win\|linux)".*--publish never' package.json` | `3` | ✓ PASS |
| electron-builder.yml `publish: null` (collateral fix c0ac407) | `grep -n '^publish:' electron-builder.yml` | `16:publish: null` | ✓ PASS |
| sampler-worker-girl.spec.ts `.skipIf(env.CI)` (collateral fix f00e232) | `grep -n 'skipIf(process.env.CI)' tests/main/sampler-worker-girl.spec.ts` | `27: it.skipIf(process.env.CI)(` | ✓ PASS |
| Re-verify SC1 job sequencing on canonical run | `gh api repos/Dzazaleo/.../runs/24994332338/jobs --jq '[.jobs[] \| {name, conclusion, started_at, completed_at}]'` | test 12:13:35→12:14:27 success; build-{mac,linux,win} all start 12:14:29 success; publish 12:16:55→12:17:19 success | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CI-01 | 11-01, 11-02 | Pushing a git tag matching `v*.*.*` automatically triggers the release-build workflow | ✓ SATISFIED | Run 24994332338 (event=push) fired 3 s after `git push origin v1.1.0-rc1`; REQUIREMENTS.md L99 marks Complete with run-id reference |
| CI-02 | 11-01, 11-02 | The workflow builds Windows, macOS, and Linux installers in parallel jobs | ✓ SATISFIED | All 3 builds share `started_at: 12:14:29Z` on macos-14/windows-2022/ubuntu-22.04 (concurrent); REQUIREMENTS.md L100 confirms |
| CI-03 | 11-01, 11-02 | The workflow runs vitest BEFORE installer artifacts; test failure aborts release | ✓ SATISFIED | `test.completed_at: 12:14:27Z` precedes `min(build-*.started_at): 12:14:29Z`; failed run 24993716580 empirically proves test failure aborts builds |
| CI-04 | 11-01, 11-02 | Successful jobs upload installer artifacts to a draft GitHub Release for the triggering tag | ✓ SATISFIED | Draft release `v1.1.0-rc1` exists with `isDraft: true` and 3 installer assets attached |
| CI-05 | 11-01, 11-02 | A failed platform build prevents publication of the release (no partial / missing-asset releases) | ✓ SATISFIED | Failed run 24994071839 (all 3 builds failed) → publish skipped → `gh release list` returned `[]`. Plus static audit: `if-no-files-found: error` ×3 + `fail_on_unmatched_files: true` ×1 + `publish.needs: [build-mac, build-win, build-linux]` |
| CI-06 | 11-01, 11-02 | The workflow can also be invoked manually (`workflow_dispatch`) for off-tag dry runs | ✓ SATISFIED | Run 24994622845 (event=workflow_dispatch) on main: 4 jobs green, publish skipped, 3 artifacts uploaded, no new draft release |
| REL-01 | 11-01, 11-02 | Each published GitHub Release has installer assets attached for Windows, macOS, and Linux | ✓ SATISFIED | Draft v1.1.0-rc1 has exactly 3 assets — `…-arm64.dmg`, `…-x64.exe`, `…-x86_64.AppImage` — all containing `1.1.0-rc1` literal |
| REL-02 | 11-01, 11-02 | Each release body follows a documented release-notes template (summary / new / known / install) | ✓ SATISFIED | Body has all 4 REL-02 H2 sections + Tag footer (5 H2 total); 0 unrendered envsubst placeholders; `v1.1.0-rc1` literal × 3 |
| REL-04 | 11-02 | A non-developer tester can download installer from a Release page, install on their OS without git/Node | ✓ SATISFIED-WITH-DEFERRAL | macOS PASS (`.dmg` → /Applications, Optimize Assets succeeded, version 1.1.0-rc1, Signature=adhoc); Windows PASS (NSIS install, Optimize Assets 153/153 in 10.7s on Spine 4.2 input); Linux DEFERRED to Phase 12 tester rounds per acceptance-criteria allowance |

**Orphaned requirements check:** REQUIREMENTS.md maps exactly CI-01..CI-06, REL-01, REL-02, REL-04 to Phase 11 (rows 99–108). The PLAN frontmatter for both 11-01 and 11-02 declares the same 9 IDs. **No orphans.** REL-03 is correctly mapped to Phase 12 (where INSTALL.md authoring lives) and is **not** a Phase 11 obligation; the release-template's inline first-launch instructions are the v1.1 stand-in (D-13) until INSTALL.md lands.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | All anti-pattern greps return 0 hits | — | — |

Verified absent (independent re-grep, not just trusting Plan 01 summary):
- `GH_TOKEN` literal in workflow → 0 (Pitfall 1 / T-11-01 mitigation)
- `GITHUB_TOKEN` literal in workflow → 0
- `apt install libfuse2` in workflow → absent (D-17)
- `actions/cache@*electron-builder*` in workflow → absent (D-15 — Phase 12 concern)
- Signing keys (`certificateFile`, `CSC_LINK`, `APPLE_ID`, `notarize`) → absent (no signing in v1.1)
- `latest.yml`/`latest-mac.yml` references → absent (Phase 12 territory)
- Sentry / source-map upload references → absent (Phase 13 territory)
- Floating action versions (`@v4`/`@main`/`@master`) → absent (all 5 actions SHA-pinned)
- TODO/FIXME/PLACEHOLDER in committed phase files → absent (verified with grep)

### Human Verification Required

(Empty — phase is closed. Maintainer has already performed and signed off on macOS + Windows install smokes. Linux REL-04 runtime smoke is explicitly DEFERRED to Phase 12 tester rounds per phase acceptance criteria; deferral is recorded in `deferred:` frontmatter, not as a pending human-verification item.)

### Gaps Summary

**No gaps.** Phase 11 fully satisfies its goal:

- The 5 ROADMAP success criteria are each backed by either an empirically green live run (SC1, SC2, SC5 macOS/Windows), an empirically failed live run that exhibits the contract-by-failure (SC3, SC4), or an explicit acceptance-criteria-permitted deferral with documented rationale (SC5 Linux).
- All 9 phase requirement IDs (CI-01..CI-06, REL-01, REL-02, REL-04) are marked Complete in REQUIREMENTS.md with concrete run-id-bearing evidence.
- All 8 falsifiable acceptance criteria from VALIDATION.md are closed in 11-LIVE-VERIFICATION.md, and the cited run IDs/SHAs/events were independently re-confirmed against the GitHub API at verification time (not trusting the captured doc alone).
- The two collateral fix-forward commits (`f00e232` skipIf, `c0ac407` publish:null) are appropriately scoped, well-rationalized, surfaced exclusively by the live-verification gate (which is its purpose), and don't introduce new issues.
- The 3 Windows-runtime findings (F1/F2/F3) correctly belong in Phase 12 — they are app/UX bugs unrelated to the CI release pipeline contract and are documented as Phase 12 prereqs.
- Code review (11-REVIEW.md) found 0 critical issues, 3 warnings, 5 info — all quality/robustness improvements, none affect falsifiable closure conditions.

**Honesty check on the live evidence (per verification-overrides discipline):**

- "Tag-push run 24994332338 succeeded" — independently confirmed via `gh api .../runs/24994332338` returning `conclusion: success, head_sha: c0ac407…, event: push`.
- "workflow_dispatch run 24994622845 succeeded with publish skipped" — independently confirmed; jobs API returned the 5-row sequence with publish=skipped.
- "Two failed runs proved atomicity-by-construction empirically" — both 24993716580 and 24994071839 independently confirmed as `conclusion: failure`; the captured JSON in 11-LIVE-VERIFICATION.md matches actual API output.
- "Linux deferred per acceptance-criteria allowance" — Plan 02 Task 5 acceptance criteria explicitly state "Acceptable to defer Linux smoke to Phase 12 tester rounds IF the maintainer lacks a Linux host AND the user explicitly chooses to defer; the deferral and rationale must be documented." Both conditions met and documented in 11-LIVE-VERIFICATION.md L406–410.
- "Three Windows findings belong in Phase 12, not Phase 11" — Phase 11's contract is "CI release pipeline → draft Release with 3 platform installers." All three findings (atlas viewer URL handling, file-picker UX, Spine 3.8 detection) are pre-existing app-runtime bugs that surfaced because Phase 11 produced the first-ever Windows install. They are NOT pipeline bugs — Phase 11's pipeline produced a correct `.exe`, and the app's primary workflow (Optimize Assets) works correctly on supported (4.2) input. The findings are Phase 12 prereqs because Phase 12 owns tester distribution + INSTALL.md.

Phase 11 is closed. Ready to proceed to Phase 12 (auto-update + tester install docs).

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
