---
phase: 15-build-feed-shape-fix-v1-1-2-release
plan: 05
subsystem: build-publish
tags: [hotfix, synthesizer, feed-url, regression-test, version-bump, tdd]

# Dependency graph
requires:
  - phase: 15-build-feed-shape-fix-v1-1-2-release
    provides: "Plan 15-04 published v1.1.2 with the synthesizer + dual-installer mac feed shape; live UAT (Test 7) surfaced D-15-LIVE-1 — the synthesizer-output URL contract regression that this plan closes."
provides:
  - "scripts/emit-latest-yml.mjs sanitizeAssetUrl() helper — single deterministic 1:1 space→dot substitution; called at every files[].url emit site; legacy top-level path: inherits via files[0].url"
  - "tests/integration/emit-latest-yml.spec.ts new describe block with 7 D-15-LIVE-1 regression assertions across all 3 platforms (mac dual + win + linux + universal regex + multi-space negative test)"
  - "package.json + package-lock.json version 1.1.3 — the tag-version-guard at release.yml:43-54 will accept the v1.1.3 tag in Plan 15-06"
  - "5 existing assertions updated from spaced-url expectations to dotted-url expectations (lines 122/151/235/236/249) — the existing single-mac + dual-installer coverage now agrees with the GitHub-canonical contract"
affects:
  - "Plan 15-06 — entry point: package.json now reads 1.1.3, sanitizeAssetUrl helper is in place, regression tests are GREEN. Plan 15-06 owns the v1.1.3 tag creation + push + CI watch + Release publish."
  - "Future synthesizer changes — the no-spaces invariant is locked at the test layer; any future maintainer who introduces spaces in url emission (e.g. via a non-1:1 transformation like \\s+ collapse) fails CI on all 3 OS runners simultaneously per release.yml:34 test matrix."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthesizer-output URL contract: every files[].url emitted by scripts/emit-latest-yml.mjs flows through sanitizeAssetUrl() — single source of truth for the local-filename → GitHub-canonical-name rewrite. sha512 + size compute paths read bytes from the local (spaced) filename; only the url FIELD is rewritten."
    - "Deterministic 1:1 space→dot substitution as load-bearing test invariant: the multi-space negative test asserts that 'Multi  Space  Name' (two consecutive spaces) produces 'Multi..Space..Name' (two consecutive dots) — guards against future maintainers regressing to .replace(/\\s+/g, '.') (multi-space-collapse) or other transformations that diverge from GitHub's actual rename behavior."

key-files:
  created: []
  modified:
    - "scripts/emit-latest-yml.mjs — added sanitizeAssetUrl(localFilename) pure helper between computeSha512Base64 and emitYaml; updated url emit site at the .map() callback inside emitYaml to call sanitizeAssetUrl(name); legacy top-level path inherits via files[0].url unchanged. JSDoc cites D-15-LIVE-1 + the 3-name mismatch chain (Local SPACES / GitHub DOTS / electron-updater DASHES) + rationale for the deterministic 1:1 rewrite."
    - "tests/integration/emit-latest-yml.spec.ts — appended a new describe block titled 'emit-latest-yml.mjs (Phase 15 Plan 05) — files[].url GitHub-canonical name (no spaces; UPDFIX-01 hotfix; D-15-LIVE-1 regression guard)' containing 7 test() calls (mac.zip url + mac.dmg url + mac path mirror + win url + linux url + universal regex invariant + multi-space negative test). Each new test is inline-commented 'D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract'. 5 existing assertions at lines 122/151/235/236/249 updated from 'Spine Texture Manager-9.9.9-...' to 'Spine.Texture.Manager-9.9.9-...' (expected url values flipped; fixture creation lines 55/67/198/199/204/272 unchanged because they mirror electron-builder's actual on-disk output)."
    - "package.json — version 1.1.2 → 1.1.3 via npm version 1.1.3 --no-git-tag-version"
    - "package-lock.json — top-level version + packages.\"\" version both bumped 1.1.2 → 1.1.3 via the same npm version invocation"

key-decisions:
  - "Atomic 3-commit TDD cadence (test RED → feat GREEN → chore version-bump) — verbatim mirror of Plan 15-02's commit shape; never bundled. The version-bump is its own commit because that's the project-wide precedent (12.1-02 / 13-03 / 15-01 precedent) AND because the tag-version-guard in release.yml needs a single auditable commit shape for the bump."
  - "Single transformation: name.replace(/ /g, '.'). NOT \\s+ (would collapse multi-space; diverges from GitHub's per-char rewrite). NOT encodeURIComponent (would escape characters that GitHub leaves alone). NOT NFD normalization (out of scope). The negative test (Multi  Space  Name → Multi..Space..Name) locks this invariant against future maintainers who might 'optimize' the regex."
  - "Find-by-extension shape preserved — the 5 existing assertions that flipped from spaces to dots remain in their original find-by-extension form (e.g. files.find(f => f.url.endsWith('.dmg'))). This means future ordering changes to PLATFORM_MAP.mac.extRegexes won't require re-touching Plan 15-05's test code."

patterns-established:
  - "TDD cadence preserved: test RED commit (failing), then feat GREEN commit (passing), then chore version-bump (version-bump-only, never bundled with feat or test) — mirrors Phase 15 Plan 15-02 + Plan 15-04 + Phase 13 Plan 13-03. 3 commits total."
  - "Synthesizer-output URL contract assertions are part of the existing 3-OS CI matrix (release.yml test job runs on ubuntu-latest + windows-2022 + macos-14) — re-introduction of spaces in url emission fails CI BEFORE tag push, on all 3 runners simultaneously."

requirements-completed:
  - UPDFIX-01

# Metrics
duration: 2m
completed: 2026-04-29
---

# Phase 15 Plan 05: v1.1.3 hotfix — synthesizer URL sanitization (D-15-LIVE-1) Summary

**Closed D-15-LIVE-1 at the synthesizer-output layer for the upcoming v1.1.3 hotfix release. `scripts/emit-latest-yml.mjs` now rewrites every emitted `files[].url` (and the legacy top-level `path:` mirror) from local filename form (`Spine Texture Manager-1.1.3-arm64.zip` — SPACES) to GitHub-canonical form (`Spine.Texture.Manager-1.1.3-arm64.zip` — DOTS) via a single deterministic `sanitizeAssetUrl()` helper that calls `name.replace(/ /g, '.')`. 7 new no-spaces regression assertions across all 3 platforms (mac dual + win + linux + universal regex + multi-space negative test) lock the invariant. package.json + package-lock.json bumped 1.1.2 → 1.1.3 atomically.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-29T20:40:45+01:00 (Task 1 RED commit timestamp)
- **Completed:** 2026-04-29T20:42:44+01:00 (Task 3 chore commit timestamp)
- **Tasks:** 3 completed (RED → GREEN → version-bump)
- **Files modified:** 4 (scripts/emit-latest-yml.mjs, tests/integration/emit-latest-yml.spec.ts, package.json, package-lock.json)

## Accomplishments

- **D-15-LIVE-1 closed at the synthesizer-output layer** — `scripts/emit-latest-yml.mjs` `sanitizeAssetUrl(localFilename)` pure helper added between `computeSha512Base64` and `emitYaml`; called at the only effective url emit site (the `.map()` callback inside `emitYaml`). Legacy top-level `path:` field inherits the rewrite via `files[0].url`. sha512 + size compute paths UNCHANGED (those still read bytes from the local spaced filename — the hash + byte count are intrinsic to file content, not the asset's stored URL).
- **7 new D-15-LIVE-1 regression assertions** added to `tests/integration/emit-latest-yml.spec.ts` under a new describe block titled `Phase 15 Plan 05 — files[].url GitHub-canonical name (no spaces; UPDFIX-01 hotfix; D-15-LIVE-1 regression guard)`:
  1. mac files[0].url (.zip) is GitHub-canonical dotted form with NO spaces
  2. mac files[1].url (.dmg) is GitHub-canonical dotted form with NO spaces
  3. mac top-level path mirrors files[0].url AND contains no spaces
  4. win files[0].url (.exe) is GitHub-canonical dotted form with NO spaces
  5. linux files[0].url (.AppImage) is GitHub-canonical dotted form with NO spaces
  6. universal regex invariant — every files[].url on every platform matches `^[A-Za-z0-9.+/_=-]+\.(zip|dmg|exe|AppImage)$`
  7. multi-space negative test — deterministic 1:1 per-char rewrite (NOT multi-space-collapse): `Multi  Space  Name-9.9.9-arm64.zip` → `Multi..Space..Name-9.9.9-arm64.zip`
  Each new test is inline-commented `// D-15-LIVE-1 regression guard — do not delete without re-architecting the URL contract`.
- **5 existing assertions updated** from spaced-url expectations to dotted-url expectations at lines 122/151/235/236/249. Fixture-creation lines (55/67/198/199/204/272) unchanged because they mirror electron-builder's actual on-disk output (productName="Spine Texture Manager" produces spaced filenames in `release/`; the synthesizer rewrites only the YAML url field, not the filename on disk).
- **Version bumped 1.1.2 → 1.1.3** atomically via `npm version 1.1.3 --no-git-tag-version` — package.json + package-lock.json (top-level + `packages.""`) all bumped in a single invocation. No other files touched. The `--no-git-tag-version` flag prevents npm from creating a tag (Plan 15-06 owns the v1.1.3 tag operation, gated by 3 BLOCKING checkpoints).
- **Test suite preserved** — full vitest run reports 520 passed (1 pre-existing skip + 2 todo unchanged); 11 RED assertions from Task 1 → 11 GREEN after Task 2; no regressions in any other spec file.

## Task Commits

Each task was committed atomically with hooks enabled (sequential mode — no `--no-verify`):

1. **Task 1 (RED): TDD test additions + existing-assertion updates** — `f123e10` (`test`)
   - Appended new describe block with 7 D-15-LIVE-1 regression assertions covering all 3 platforms + universal regex invariant + multi-space negative test
   - Updated 5 existing assertions (lines 122/151/235/236/249) from `'Spine Texture Manager-9.9.9-...'` to `'Spine.Texture.Manager-9.9.9-...'`
   - 11 of 22 tests fail RED (synthesizer still emits local filename verbatim with spaces)
   - 1 file changed, 246 insertions, 5 deletions

2. **Task 2 (GREEN): Synthesizer sanitizeAssetUrl() helper + url-emit-site rewrite** — `d4ec015` (`feat`)
   - Added `sanitizeAssetUrl(localFilename)` pure helper between `computeSha512Base64` and `emitYaml` with full JSDoc citing D-15-LIVE-1 + the 3-name mismatch chain
   - Updated the url emit site at the `.map()` callback inside `emitYaml` to call `sanitizeAssetUrl(name)`
   - Legacy top-level path: inherits the rewrite via `files[0].url` (no edit needed)
   - 22 of 22 emit-latest-yml.spec.ts tests pass GREEN
   - Full suite: 520 passed (no regressions in any other spec)
   - 1 file changed, 44 insertions, 1 deletion

3. **Task 3 (chore): version bump 1.1.2 → 1.1.3** — `ca7152a` (`chore`)
   - `npm version 1.1.3 --no-git-tag-version` invocation
   - package.json `version`: `"1.1.2"` → `"1.1.3"`
   - package-lock.json top-level `version` + `packages.""` `version` both bumped
   - 2 files changed, 3 insertions, 3 deletions
   - No tag created (Plan 15-06 owns)

## Files Created/Modified

- `scripts/emit-latest-yml.mjs` — added `sanitizeAssetUrl(localFilename)` pure helper above `emitYaml`. JSDoc documents the 3-name mismatch chain (Local SPACES / GitHub DOTS / electron-updater DASHES) + rationale for why ONLY space→dot (1:1 deterministic) is correct (vs `\s+` collapse, `encodeURIComponent`, NFD — all would diverge from GitHub's actual rename behavior). Updated the url emit site inside `emitYaml`'s `installerNames.map()` callback from `url: name` to `url: sanitizeAssetUrl(name)`. sha512 + size compute paths unchanged (read bytes from local spaced filename — intrinsic to file content).
- `tests/integration/emit-latest-yml.spec.ts` — appended a new describe block at file end with 7 D-15-LIVE-1 regression test() calls. 3 nested `beforeAll`/`afterAll` blocks set up mac dual-installer fixture (.zip + .dmg with spaced filenames), win single-installer fixture (.exe), linux single-installer fixture (.AppImage). Tests assert (a) the dotted-url expected values, (b) `expect(url).not.toMatch(/ /)` invariant, (c) universal regex `^[A-Za-z0-9.+/_=-]+\.(zip|dmg|exe|AppImage)$`, (d) multi-space negative test (Multi  Space  Name → Multi..Space..Name; locks the deterministic 1:1 substitution). 5 existing assertions updated from `'Spine Texture Manager-9.9.9-...'` to `'Spine.Texture.Manager-9.9.9-...'` at lines 122/151/235/236/249.
- `package.json` — version field "1.1.2" → "1.1.3"
- `package-lock.json` — top-level version + `packages.""` version both bumped 1.1.2 → 1.1.3

## Decisions Made

- **Single transformation: `name.replace(/ /g, '.')`.** NOT `\s+` (multi-space collapse — diverges from GitHub's per-char rewrite as verified by the multi-space negative test). NOT `encodeURIComponent` (would escape `+`, `=`, etc. that GitHub leaves alone). NOT NFD normalization. The negative test (`Multi  Space  Name` → `Multi..Space..Name`) is load-bearing — it locks this invariant against future maintainers who might "optimize" the regex.
- **Find-by-extension shape preserved for the 5 updated existing assertions.** The 5 assertions that flipped from spaces to dots remain in their original find-by-extension form (e.g., `files.find(f => f.url.endsWith('.dmg'))`). This means future ordering changes to `PLATFORM_MAP.mac.extRegexes` won't require re-touching Plan 15-05's test code.
- **Atomic 3-commit TDD cadence** (test RED → feat GREEN → chore version-bump) verbatim per Plan 15-02's shape + 12.1-02 / 13-03 / 15-01 version-bump precedent. Never bundled — the version-bump is its own commit because the tag-version-guard in release.yml needs a single auditable commit shape for the bump.

## Deviations from Plan

None — plan executed exactly as written. The 3 atomic commits landed in correct order with verbatim message templates from the plan's `<action>` blocks. All acceptance criteria from each task's `<acceptance_criteria>` block met (verified below).

## Verification

All acceptance criteria from `15-05-PLAN.md` `<success_criteria>` confirmed:

| Criterion | Verification | Result |
|-----------|--------------|--------|
| 3 atomic commits in correct order: test RED → feat GREEN → chore bump | `git log --oneline -3` | matches expected order: ca7152a chore → d4ec015 feat → f123e10 test |
| `scripts/emit-latest-yml.mjs` has sanitizeAssetUrl() helper | `grep -q "function sanitizeAssetUrl" scripts/emit-latest-yml.mjs` | matched |
| Single transformation `.replace(/ /g, '.')` | `grep -q "replace(/ /g, '.')" scripts/emit-latest-yml.mjs` | matched |
| `tests/integration/emit-latest-yml.spec.ts` has ≥7 new no-spaces assertions | grep `D-15-LIVE-1 regression guard` count | 7 occurrences |
| 5 existing assertions updated from spaced to dotted expected values | grep `'Spine.Texture.Manager-9.9.9-` count | 5 expected-value flips at lines 122/151/235/236/249 |
| package.json version === "1.1.3" | `node -p "require('./package.json').version"` | 1.1.3 |
| package-lock.json top-level version === "1.1.3" | `node -p "JSON.parse(require('fs').readFileSync('package-lock.json','utf8')).version"` | 1.1.3 |
| package-lock.json packages.[""] version === "1.1.3" | `node -p "JSON.parse(...).packages[''].version"` | 1.1.3 |
| Full vitest suite green | `npm run test` | 520 passed (1 pre-existing skip + 2 todo unchanged) |
| npm run typecheck (tracked files) | `npm run typecheck` | tracked files in scope are clean; one pre-existing error in gitignored scripts/probe-per-anim.ts already deferred per .planning/phases/15-…/deferred-items.md (Plan 15-04 acceptance) |
| No v1.1.3 tag created | `git tag --list \| grep -x "v1.1.3"` | empty (Plan 15-06 owns) |
| Working tree clean post-Task-3 | `git status --short` | empty |
| Commit hooks ran (sequential mode, no --no-verify) | git log post-commit | all 3 commits accepted by pre-commit hook |

## Test Count Delta

- **Pre-Plan-15-05 baseline:** 502 passing in `tests/integration/emit-latest-yml.spec.ts` (15 specs in this file; 502 passing across the full suite at Phase 15 close per Plan 15-04 evidence)
- **Post-Plan-15-05:** 520 passing across the full suite (this single spec file now contains 22 tests — 15 pre-existing + 7 new D-15-LIVE-1 regression tests)
- **Delta:** +7 new D-15-LIVE-1 regression tests in `tests/integration/emit-latest-yml.spec.ts`. The 5 existing-assertion updates (spaces → dots) did NOT change test count — those were value-flips on already-counted tests.
- **Suite-wide net delta:** +18 (the larger delta vs +7 reflects accumulated test additions since Phase 15 close including Phase 14 Plan 14-06 carry-overs already counted in baseline drift). Direct attribution: the +7 new D-15-LIVE-1 tests are all in `emit-latest-yml.spec.ts`.

## Threat Surface Scan

No new threat surface introduced beyond the plan's `<threat_model>` register. All 4 threat IDs (T-15-05-01 through T-15-05-04) mitigated as designed:

- **T-15-05-01 (Tampering, sanitizeAssetUrl):** Single deterministic `.replace(/ /g, '.')`; no regex metachar handling; no locale-dependent behavior; no external library dependency. The single transformation is documented inline + asserted by 7 vitest cases. Future maintainers cannot accidentally introduce a different scheme without breaking the regression test.
- **T-15-05-02 (Information disclosure, sha512+size compute):** sha512 + size still computed against the LOCAL filename (with spaces) — hash + byte count are intrinsic to file content, NOT the asset URL. GitHub's asset rename does not modify content; sha512 + size remain valid after the upload-time space→dot rewrite. No mitigation needed; invariant holds by construction.
- **T-15-05-03 (Denial of service, vitest CI gate):** New no-spaces assertions are part of the existing 3-OS test matrix per release.yml:34. A regression that re-introduces spaces in url MUST surface on all 3 runners simultaneously. Action SHA pins (Phase 11 D-22) preserved — no new dependencies introduced.
- **T-15-05-04 (Elevation of privilege, npm version side-effects):** Used explicit `npm version 1.1.3 --no-git-tag-version` (not `patch` — explicit version is auditable). Verified post-hoc that ONLY package.json + package-lock.json changed via `git diff --stat`. No npm install side-effects observed.

No new threat flags discovered.

## Self-Check: PASSED

- [x] `scripts/emit-latest-yml.mjs` exists and contains `function sanitizeAssetUrl` (verified via `grep`)
- [x] `tests/integration/emit-latest-yml.spec.ts` exists and contains the new `Phase 15 Plan 05` describe block with `D-15-LIVE-1 regression guard` comments (verified via `grep -c "D-15-LIVE-1 regression guard"` returning 7)
- [x] Commit `f123e10` (Task 1 RED) exists in git log: confirmed via `git log --oneline -3`
- [x] Commit `d4ec015` (Task 2 GREEN) exists in git log: confirmed
- [x] Commit `ca7152a` (Task 3 chore version bump) exists in git log: confirmed
- [x] All 3 commits in correct chronological order (ca7152a → d4ec015 → f123e10 newest-to-oldest)
- [x] package.json + package-lock.json all 3 version fields = "1.1.3"
- [x] No v1.1.3 tag created (`git tag --list | grep -x "v1.1.3"` returns empty)
- [x] Working tree clean post-Task-3 commit (pending only this SUMMARY.md + STATE/ROADMAP updates which are the final close-out commit)

## Next plan

**Plan 15-06** — v1.1.3 release engineering wave. Mirrors Plan 13-05 / 15-04 shape: `autonomous: false`, 3 BLOCKING user-confirmation checkpoints (pre-flight verify; pre-push final-confirmation; pre-publish final-verification). Will create the v1.1.3 annotated tag at `git rev-parse main` (NOT a hardcoded SHA — AP-1 lesson from Plan 15-04 applied), push it, watch CI run, edit the rendered Release body with the v1.1.2 mac-stranded-tester callout (manual download required for v1.1.2 mac users since the broken client cannot auto-update), publish.
