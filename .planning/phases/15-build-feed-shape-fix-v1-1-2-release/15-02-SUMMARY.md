---
phase: 15-build-feed-shape-fix-v1-1-2-release
plan: 02
subsystem: build-publish
tags: [synthesizer, dual-installer, latest-yml-feed, electron-updater, macos-zip, tdd]

# Dependency graph
requires:
  - phase: 12.1-installer-auto-update-live-verification
    provides: "12.1-D-10 post-build synthesizer (`scripts/emit-latest-yml.mjs`) + `electron-builder.yml` `publish: null` + 11 vitest schema-correctness tests — the architecture Plan 15-02 EXTENDS"
provides:
  - "scripts/emit-latest-yml.mjs PLATFORM_MAP.mac auto-detects BOTH .dmg + .zip (D-03) — synthesizer emits 2-entry files[] with .zip first per D-02"
  - "Legacy top-level path/sha512 mirror files[0] (the .zip on mac) — older electron-updater clients read the .zip when scanning top-level fields"
  - "End-anchored regex `/\\.zip$/i` naturally excludes `.zip.blockmap` (RESEARCH §A3 mechanical confirmation; locked in as a vitest regression gate via dual-installer fixture writing a `.zip.blockmap` + `files[].url.includes('.blockmap') === false` assertion)"
  - "Win + linux paths byte-identical to v1.1.1 single-installer single-entry feed (DIST-* / CI-* / REL-* contracts preserved)"
  - "4 new vitest assertions across 2 describe blocks tagged `Phase 15 D-04`: dual-installer mac happy path (3 tests, 11 assertions) + .dmg-only fail-fast (1 test)"
affects:
  - "Plan 15-03 (release.yml CI artifact glob extension) — the synthesizer now expects + emits the .zip; CI must upload it"
  - "Plan 15-04 (D-07 pre-flight gate + tag push + publish wave) — D-07 gate 1 verifies live latest-mac.yml has 2-entry files[] with valid sha512 byte-for-byte against built binaries"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 15 dual-extension synthesizer pattern: PLATFORM_MAP entries support `extRegexes: RegExp[]` (multi-installer per platform) OR `extRegex: RegExp` (single-installer); `emitYaml` normalizes via `cfg.extRegexes ?? [cfg.extRegex]` nullish-coalesce → uniform N-entry pipeline"
    - "End-anchored extension regex as regression gate: vitest fixture writes a deliberately-confounding `.zip.blockmap` alongside `.zip` + asserts files[] excludes blockmap — locks the `$` anchor in `/\\.zip$/i` against future weakening"

key-files:
  created: []
  modified:
    - "scripts/emit-latest-yml.mjs — PLATFORM_MAP.mac extended to dual-extension; findInstaller renamed to findInstallers (RegExp[] → string[]); emitYaml builds N-entry files[]; legacy top-level path/sha512 mirror files[0]; header comment block extended with Phase 15 D-03 paragraph"
    - "tests/integration/emit-latest-yml.spec.ts — single-mac fixture extended to write .zip alongside .dmg; existing 5 single-mac assertions tightened to find-by-extension shape (forward-compat); 4 new tests added (3 dual-installer happy path + 1 .dmg-only fail-fast); test count grew from 11 → 15"

key-decisions:
  - "Find-by-extension shape for forward-compat: existing single-mac assertions use `files.find(f => f.url.endsWith('.dmg'))` instead of `files[0].url === '...dmg'` — survives future ordering changes to PLATFORM_MAP.mac.extRegexes without re-touching test code"
  - "Keep .zip.blockmap untouched in production code: end-anchored `/\\.zip$/i` already excludes it correctly; no special-case logic needed (RESEARCH §A3 verified mechanically); regression gate locked via vitest fixture instead of code"
  - "Drop unused `fixtureZipSize` declaration (Rule 1 typecheck fix): the GREEN edits introduced parallel scaffolding for both .dmg and .zip, but no assertion uses the .zip's byte size directly — find-by-extension assertions cover the .dmg side only, and the dual-installer describe block has its own `dualZipSize` for the .zip side"

patterns-established:
  - "TDD RED → GREEN → docs cadence preserved (matches Phase 14 04/05 + Phase 13 plans): 1 atomic test commit failing, 1 atomic feat+test commit passing, 1 atomic docs commit (header comment); 3 commits total, never bundled"
  - "Single-mac fixture extends in-place rather than splitting into two tempDirs: minimum diff to existing test scaffold; new dual-installer describe block uses its own `dualTempDir` for true dual-installer surface"

requirements-completed:
  - UPDFIX-01

# Metrics
duration: 6m
completed: 2026-04-29
---

# Phase 15 Plan 02: Build/feed shape fix v1.1.2 — Synthesizer dual-installer mac extension Summary

**Extended `scripts/emit-latest-yml.mjs` (the 12.1-D-10 post-build synthesizer) to handle the macOS dual-installer case — auto-detects both `.dmg` and `.zip` in `release/` on `--platform=mac`, emits a 2-entry `files[]` with `.zip` first per D-02, mirrors legacy top-level `path` / `sha512` to `files[0]` (the `.zip`) for older electron-updater clients. Win + linux paths byte-identical to v1.1.1.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-29T15:52:17Z
- **Completed:** 2026-04-29T15:57:51Z
- **Tasks:** 3 completed (RED → GREEN → docs)
- **Files modified:** 2 (`scripts/emit-latest-yml.mjs`, `tests/integration/emit-latest-yml.spec.ts`)

## Accomplishments

- **PLATFORM_MAP.mac dual-extension match landed** — `extRegexes: [/\.zip$/i, /\.dmg$/i]` (`.zip` first per D-02; cosmetic for MacUpdater 6.x download selection but load-bearing for the legacy top-level path/sha512 mirror)
- **`findInstaller` → `findInstallers` rename + `RegExp[]` accept** — returns `string[]` in same order as input; preserves fail-fast on missing OR multiple-of-any-kind matches
- **`emitYaml` normalizes single-regex (win/linux) vs array-of-regex (mac)** via `cfg.extRegexes ?? [cfg.extRegex]` nullish-coalesce; builds N-entry `files[]` (N=1 for win/linux; N=2 for mac); legacy top-level `path`/`sha512` mirror `files[0]`
- **Atomic write contract preserved** — `.tmp + fs.renameSync` Pattern-B unchanged
- **End-anchored regex `/\.zip$/i` regression gate locked** — vitest fixture writes a `.zip.blockmap` alongside `.zip` and asserts `files[]` excludes any entry with `.blockmap` in the URL (a future maintainer dropping the `$` anchor would surface a 3rd entry and fail the test)
- **4 new vitest assertions land at the synthesizer integration boundary** — 3 dual-installer happy path + 1 `.dmg`-only fail-fast tightening; existing 11 tests preserved (single-mac assertions tightened to find-by-extension shape for forward-compat; win/linux/error-handling unchanged)
- **Win + linux feed shape byte-identical to v1.1.1** — DIST-* / CI-* / REL-* contracts preserved on those platforms

## Task Commits

Each task was committed atomically with `--no-verify` per parallel-executor protocol:

1. **Task 1 (RED): TDD test additions** — `baf8b30` (`test`)
   - Added 2 new describe blocks tagged `Phase 15 D-04`: dual-installer mac happy path + .dmg-only fail-fast
   - 4 new tests, 14 new assertions (3 + 11 in dual-installer; 1 in fail-fast)
   - All 4 new tests fail RED (synthesizer still single-regex)
   - Existing 11 tests still pass
   - 1 file changed, 102 insertions

2. **Task 2 (GREEN): Synthesizer extension + test fixture extension** — `62577ac` (`feat`)
   - `scripts/emit-latest-yml.mjs`: PLATFORM_MAP.mac dual-extRegexes, findInstaller→findInstallers, emitYaml N-entry files[]
   - `tests/integration/emit-latest-yml.spec.ts`: existing single-mac fixture extended with .zip; 5 existing assertions tightened to find-by-extension or .zip-target (legacy mirror)
   - All 15 tests pass GREEN
   - 2 files changed, 102 insertions, 35 deletions

3. **Task 3 (docs): Synthesizer header comment update** — `3deaa4d` (`docs`)
   - Append a Phase 15 D-03 paragraph to the script's header JSDoc block (between Exit codes and the import block) explaining: mac dual-detection, root cause (.zip Squirrel.Mac swap), D-02 ordering + legacy mirror, win+linux byte-identical, end-anchored regex blockmap exclusion, 12.1-D-10 preservation
   - Pure comment-only edit; tests + typecheck still green
   - 1 file changed, 19 insertions

**No final metadata commit:** the orchestrator owns STATE.md / ROADMAP.md updates after the wave completes (parallel-executor protocol).

## Files Created/Modified

- `scripts/emit-latest-yml.mjs` — Phase 12.1 synthesizer extended for Phase 15 dual-installer mac case (D-03). PLATFORM_MAP.mac uses `extRegexes: [/\.zip$/i, /\.dmg$/i]`; PLATFORM_MAP.win + PLATFORM_MAP.linux byte-identical (single-regex preserved). `findInstaller` → `findInstallers`; accepts `RegExp[]`; returns `string[]` in same order as input regexes; preserves fail-fast on missing OR multiple-matches-of-any-regex. `emitYaml` normalizes single-regex ↔ array-of-regex via `cfg.extRegexes ?? [cfg.extRegex]` nullish-coalesce; builds N-entry `files[]`; legacy top-level `path`/`sha512` mirror `files[0]` (on mac, that's the .zip per D-02). Atomic write contract preserved (`.tmp` + `fs.renameSync`). Header comment block extended with Phase 15 D-03 paragraph.
- `tests/integration/emit-latest-yml.spec.ts` — Single-mac `beforeAll` extended to write a 4KB .zip fixture alongside the existing .dmg (independent random buffers, distinct sha512). 3 existing single-mac assertions converted to find-by-extension shape (`files.find(f => f.url.endsWith('.dmg'))`) for forward-compat with future PLATFORM_MAP.mac.extRegexes ordering. Legacy top-level path + sha512 assertions flipped to target the .zip (`files[0]` per D-02). Two new describe blocks appended tagged `Phase 15 D-04`: (a) dual-installer mac case with 3 tests + 11 assertions including the .zip.blockmap regression gate; (b) `.dmg`-only fail-fast tightening with 1 test. Test count grew 11 → 15.

## Decisions Made

- **Find-by-extension assertion shape (instead of `files[0]` indexing):** the existing single-mac tests were checking `files[0].url === '...dmg'`, but after Phase 15 D-02 the `.zip` is at `files[0]` and the `.dmg` is at `files[1]`. Rather than hard-code the new ordering, switched to `files.find(f => f.url.endsWith('.dmg'))` — survives future ordering changes without re-touching test code. The dual-installer describe block (Phase 15 D-04 tests) keeps strict `files[0]`/`files[1]` indexing because it's specifically testing the ordering contract.
- **Drop `fixtureZipSize` declaration (Rule 1 typecheck fix):** the GREEN edits introduced parallel scaffolding for the .zip's hash + size, but only the .zip's `sha512` is consumed by an existing assertion (the legacy top-level `sha512` mirror). The .zip's byte size is verified inside the dedicated dual-installer describe block via its own `dualZipSize` variable. Removing the unused declaration matches the find-by-extension simplification rather than padding tests with redundant `.zip` size assertions in the existing single-mac block.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Unused `fixtureZipSize` variable triggered TS6133 typecheck error**
- **Found during:** Task 2 GREEN (after running `npm run typecheck`)
- **Issue:** The plan's recommended Step 5 fixture extension introduced `fixtureZipSize` parallel to `fixtureZipSha512`, but the existing single-mac assertions (now find-by-extension) only reference the .dmg's size; the .zip's size was never consumed by any assertion in the existing describe block. TypeScript strict mode flagged it as unused (`error TS6133`).
- **Fix:** Removed `fixtureZipSize` declaration + its `statSync` assignment. Kept `fixtureZipSha512` because it IS consumed by the legacy top-level `sha512` mirror assertion (now mirrors `files[0]` = the .zip). The dual-installer describe block has its own `dualZipSize`/`dualDmgSize` for parallel-buffer verification.
- **Files modified:** `tests/integration/emit-latest-yml.spec.ts` (variable declaration block + `beforeAll` body)
- **Verification:** `npm run typecheck` exits 0 silently; 15/15 integration tests still pass.
- **Committed in:** `62577ac` (Task 2 GREEN; folded into the same atomic commit since it's part of the GREEN integration)

## Verification

All acceptance criteria from `15-02-PLAN.md` `<success_criteria>` confirmed:

| Criterion | Verification | Result |
|-----------|-------------|--------|
| PLATFORM_MAP.mac uses `extRegexes: [/\.zip$/i, /\.dmg$/i]` | `grep -E "extRegexes:\s*\[" scripts/emit-latest-yml.mjs` | matched: `mac:   { extRegexes: [/\.zip$/i, /\.dmg$/i], outName: 'latest-mac.yml'   },` |
| PLATFORM_MAP.win + PLATFORM_MAP.linux unchanged | `grep "extRegex:" scripts/emit-latest-yml.mjs` | win=`/\.exe$/i`, linux=`/\.AppImage$/i` (single-regex preserved) |
| `findInstaller` renamed to `findInstallers` | `grep -c "findInstaller\b" scripts/emit-latest-yml.mjs` | 0 (rename complete) |
| `findInstallers` is declared + called | `grep -c "findInstallers" scripts/emit-latest-yml.mjs` | 2 (declaration + caller) |
| 4 new tests under `Phase 15 D-04` describe blocks | `npm run test -- tests/integration/emit-latest-yml.spec.ts` | 4 Phase 15 D-04 entries, all pass |
| Existing 11 tests at lines 84-153 still pass | full vitest run | 15/15 in this spec, including all 11 originals |
| Full vitest suite green | `npm run test` | 497 passed (1 pre-existing flake in `tests/main/sampler-worker-girl.spec.ts` documented in `.planning/phases/14-…/deferred-items.md`) |
| `npm run typecheck` exits 0 | `npm run typecheck` | exits 0 silently |
| 3 atomic commits: test RED → feat GREEN → docs | `git log --oneline -3` | matches expected order |
| Atomic write contract preserved | `grep -c "\.tmp"` + `grep -c "renameSync"` | `.tmp` x 2, `renameSync` x 3 |

## Threat Surface Scan

No new threat surface introduced beyond the plan's `<threat_model>` register. All 6 threat IDs (T-15-02-01 through T-15-02-06) are mitigated as designed:

- **T-15-02-01 (sha512 mismatch):** `node:crypto.createHash('sha512').update(buf).digest('base64')` path preserved verbatim; new dual-installer test asserts `files[0].sha512 === createHash('sha512').update(zipBuf).digest('base64')` byte-for-byte.
- **T-15-02-02 (files[] entries collapse):** Independent random buffers (`randomBytes(4096)` × 2) + `expect(files[0].sha512).not.toBe(files[1].sha512)` assertion locks distinct hashes.
- **T-15-02-03 (.zip.blockmap regex match):** Verified mechanically — the dual-installer fixture writes a `.zip.blockmap` and asserts `files[]` excludes any entry with `.blockmap` in the URL; `/\.zip$/i` end-anchor correctness is locked as a vitest regression gate.
- **T-15-02-04 (fail-fast bypass on missing .zip):** New `Phase 15 D-04 — fail-fast when .zip missing on mac` describe block asserts the synth exits non-zero on `.dmg`-only release/ on mac.
- **T-15-02-05 (win+linux feed regression):** PLATFORM_MAP.win + PLATFORM_MAP.linux byte-identical (single-regex preserved); existing 11 tests at lines 84-153 still pass.
- **T-15-02-06 (test seam env var exposure):** `EMIT_LATEST_YML_REPO_ROOT_OVERRIDE` env var seam preserved; Plan 15-04 Task 5 owns CI log inspection.

No new threat flags discovered.

## Self-Check: PASSED

- [x] `scripts/emit-latest-yml.mjs` exists and contains `extRegexes: [/\.zip$/i, /\.dmg$/i]` (verified via `grep`)
- [x] `tests/integration/emit-latest-yml.spec.ts` exists and contains `Phase 15 D-04` describe blocks (verified via test run output)
- [x] Commit `baf8b30` (Task 1 RED) exists in git log: confirmed via `git log --oneline -4`
- [x] Commit `62577ac` (Task 2 GREEN) exists in git log: confirmed
- [x] Commit `3deaa4d` (Task 3 docs) exists in git log: confirmed
- [x] All 3 commits in correct chronological order: docs → feat → test (newest to oldest in `git log`)
- [x] Working tree clean post-Task-3 commit: `git status` shows no uncommitted changes (SUMMARY.md is the only change pending pre-commit)
