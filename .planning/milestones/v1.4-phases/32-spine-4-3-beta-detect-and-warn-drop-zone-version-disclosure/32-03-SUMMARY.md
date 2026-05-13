---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
plan: 03
subsystem: tests
tags: [tests, fixture, loader, integration, spine-4.3, compat-01]

# Dependency graph
requires:
  - phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
    plan: 01
    provides: checkSpineVersion strict-cut at 4.3+; checkSpine43Schema predicate; SpineVersionUnsupportedError COMPAT-01 message branch; loadSkeleton wires both predicates BEFORE atlas resolution
  - phase: 12-ci-release-pipeline-github-actions-draft-release
    provides: SPINE_3_8_TEST fixture shape precedent (synthetic JSON + atlas + 1x1 PNG); F3 describe block + existence-sentinels block in loader-version-guard.spec.ts
provides:
  - SPINE_4_3_TEST regression fixture (in-repo, committed, NOT gitignored)
  - End-to-end fixture-driven loadSkeleton(FIXTURE_43) rejection coverage
  - Belt-and-suspenders SPINE_4_3_TEST.json with BOTH detection signals (semver >= 4.3 AND non-empty top-level `constraints` array)
  - Existence sentinels for the 4.3 fixture (5 new it() cases) — shape-locks the fixture so future drift is caught
affects:
  - SEED-003 (Spine 4.3 compatibility) — end-to-end coverage now in place; the user's gitignored real-world `fixtures/test_4.3/jokerman/` and `fixtures/test_4.3/girl/` rigs are no longer the only repro path

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthetic-fixture-with-real-atlas-and-PNG (SPINE_3_8_TEST precedent extended forward to 4.3)"
    - "Belt-and-suspenders fixture: a single JSON exercising BOTH semver and schema predicates simultaneously; the test asserts 'rejection happened' without disambiguating which predicate fired"
    - "Predicate-fires-before-atlas-resolution invariant verified by absence of the atlas page PNG (atlas references SPINE_4_3_TEST.png; only images/SQUARE.png is on disk; tests still pass = correct)"

key-files:
  created:
    - fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json
    - fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas
    - fixtures/SPINE_4_3_TEST/images/SQUARE.png
  modified:
    - tests/core/loader-version-guard.spec.ts

key-decisions:
  - "Fixture content uses skeleton.spine = '4.3.91-beta' (semver branch) AND a non-empty constraints[] array containing one ik entry (schema branch) per CONTEXT D-06 belt-and-suspenders policy"
  - "PNG is a byte-for-byte copy of fixtures/SPINE_3_8_TEST/images/SQUARE.png (74 bytes, 1x1 RGBA non-interlaced stub) — known-good asset, predicate fires before atlas resolution so the PNG is never decoded"
  - "Atlas page filename swapped from SPINE_3_8_TEST.png to SPINE_4_3_TEST.png — purely cosmetic since atlas resolution is unreachable; keeps the fixture self-consistent"
  - "Existing 3.8 + 4.2 assertions in loader-version-guard.spec.ts kept byte-stable — additive-only edit (no rewriting of existing tests)"

patterns-established:
  - "fixtures/SPINE_4_3_TEST/ — committed regression fixture pattern for 4.3-shape rejection; SEED-003 §'Reproduction Fixtures' acknowledges this is the only CI-eligible path because the user's real-world rigs are gitignored as proprietary"
  - "Phase 32 COMPAT-01 describe block in loader-version-guard.spec.ts — the additive sibling to the existing F3 (Phase 12) block; the two coexist and assert non-overlapping branch reachability"

requirements-completed: [COMPAT-01]

# Metrics
duration: ~3min
completed: 2026-05-10
---

# Phase 32 Plan 03: SPINE_4_3_TEST Fixture + End-to-End Loader Rejection Coverage Summary

**Committed `fixtures/SPINE_4_3_TEST/` regression fixture (synthetic JSON + atlas + 1x1 PNG mirroring SPINE_3_8_TEST shape) and added a 6-case fixture-driven describe block to `tests/core/loader-version-guard.spec.ts`, locking the end-to-end `loadSkeleton -> checkSpineVersion / checkSpine43Schema -> SpineVersionUnsupportedError` path against regression.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-10T15:29:20Z
- **Completed:** 2026-05-10T15:32:20Z
- **Tasks:** 2
- **Files created:** 3 (fixture JSON + atlas + PNG)
- **Files modified:** 1 (loader-version-guard.spec.ts)

## Accomplishments

- New `fixtures/SPINE_4_3_TEST/` directory committed in-repo with three files mirroring the SPINE_3_8_TEST precedent:
  - `SPINE_4_3_TEST.json` (328 bytes) — synthetic minimal Spine 4.3-shape skeleton with both detection signals: `skeleton.spine = "4.3.91-beta"` + a top-level `constraints: [...]` array carrying one `ik` entry.
  - `SPINE_4_3_TEST.atlas` (170 bytes) — single 1x1 SQUARE region; page filename `SPINE_4_3_TEST.png`; `rotate: false` (matches SPINE_3_8_TEST.atlas verbatim with the cosmetic page-name swap).
  - `images/SQUARE.png` (74 bytes) — byte-for-byte copy of `fixtures/SPINE_3_8_TEST/images/SQUARE.png`. Verified by `cmp` exit-0.
- Extended `tests/core/loader-version-guard.spec.ts` additively (existing 3.8 + 4.2 assertions byte-stable):
  - New `FIXTURE_43` path constant alongside `FIXTURE_38` + `FIXTURE_42`.
  - New `describe('Phase 32 COMPAT-01: Spine version guard rejects 4.3 fixtures (semver + schema)')` block with **6 assertions**: typed-error rejection; SpineLoaderError-extension catchability; COMPAT-01 message-content (4 substrings: 'This app currently supports Spine v4.2', 'Re-export from your 4.3 editor as Version 4.2', 'supported downgrade', 'try again'); legacy pre-4.2 wording non-leak; `skeletonPath` carry-through; 4.2 happy-path regression-belt.
  - Extended existing `describe('F3: fixture file existence sentinels')` block with **5 new SPINE_4_3_TEST sentinels**: JSON path existence, atlas path existence, PNG file presence under the dir, magic `4.3.91-beta` semver string, and top-level `constraints` array shape.
  - File-level docblock updated with the Phase 32 COMPAT-01 extension paragraph.
- Verified the predicate-fires-before-atlas-resolution invariant: the atlas page filename references `SPINE_4_3_TEST.png` which does NOT exist on disk (only `images/SQUARE.png` does). The tests still pass — proof that `loadSkeleton` rejects via `checkSpineVersion` or `checkSpine43Schema` before atlas resolution would have been attempted.
- Layer-3 invariant preserved (`tests/arch.spec.ts` 12 cases green) — all fixture additions are under `fixtures/`, not `src/core/`; no DOM, Electron, or sharp imports added.

## Test Counts

| File | Status | Cases (new / total) |
|------|--------|---------------------|
| `tests/core/loader-version-guard.spec.ts` (modified) | green | +11 / 21 (was 10) |
| `tests/core/loader-version-guard-predicate.spec.ts` (unchanged) | green | byte-stable |
| `tests/core/loader-43-schema-guard-predicate.spec.ts` (unchanged) | green | byte-stable |
| `tests/core/errors-version.spec.ts` (unchanged) | green | byte-stable |
| `tests/core/loader.spec.ts` (unchanged) | green | byte-stable |
| `tests/arch.spec.ts` (unchanged) | green | byte-stable (Layer-3 invariant intact) |

**Aggregate (focused related suite):** `npm test -- tests/core/loader-version-guard.spec.ts tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-43-schema-guard-predicate.spec.ts tests/core/errors-version.spec.ts tests/core/loader.spec.ts tests/arch.spec.ts --run` -> **88 passed (88)**.

**Aggregate (single file):** `npm test -- tests/core/loader-version-guard.spec.ts --run` -> **21 passed (21)**.

**Aggregate (full core suite):** `npm test -- tests/core/ --run` -> **441 passed | 17 skipped | 1 todo (459)**, with 1 pre-existing failure in `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (gitignored fixture absence — pre-dates Phase 32, already tracked in `deferred-items.md` and Plan 01 SUMMARY's "Issues Encountered"; out of scope per SCOPE BOUNDARY rule).

## Fixture Shape Verification

```
$ node -e 'const j = require("./fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json"); console.log("spine:", j.skeleton.spine); console.log("constraints array:", Array.isArray(j.constraints) && j.constraints.length === 1); console.log("constraint type:", j.constraints[0].type);'
spine: 4.3.91-beta
constraints array: true
constraint type: ik

$ head -1 fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas
SPINE_4_3_TEST.png

$ grep -c "rotate: false" fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas
1

$ cmp fixtures/SPINE_3_8_TEST/images/SQUARE.png fixtures/SPINE_4_3_TEST/images/SQUARE.png && echo "byte-identical"
byte-identical

$ wc -c < fixtures/SPINE_4_3_TEST/images/SQUARE.png
      74

$ git check-ignore fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json && echo "GITIGNORED" || echo "NOT gitignored"
NOT gitignored
```

## Predicate-Fires-Before-Atlas-Resolution Invariant

The fixture's atlas (`SPINE_4_3_TEST.atlas`) references `SPINE_4_3_TEST.png` on its first line — a file that does NOT exist on disk under `fixtures/SPINE_4_3_TEST/`. Only `images/SQUARE.png` exists.

If the loader's atlas-resolution pass had been reached during `loadSkeleton(FIXTURE_43)`, it would have failed with a different error class (`AtlasFileNotFoundError` or similar). Instead, the test passes with `SpineVersionUnsupportedError` — proof that the version-guard predicate (`checkSpineVersion` strict-cut OR `checkSpine43Schema`) fires first, exactly as designed in Plan 01's insertion site.

This is not a bug in the fixture — it is an intentional negative-space verification that the predicate ordering in `loadSkeleton` is correct.

## COMPAT-01 Message Substrings Asserted (REQUIREMENTS.md L13)

The `Rejection error message contains the COMPAT-01-locked wording` test asserts all four of:

1. `'This app currently supports Spine v4.2'`
2. `'Re-export from your 4.3 editor as Version 4.2'`
3. `'supported downgrade'`
4. `'try again'`

A separate test asserts the legacy pre-4.2 message *does not* leak into the 4.3+ branch:

- `not.toContain('Spine Texture Manager requires Spine 4.2 or later')`

This twin assertion (positive substrings + negative pre-4.2-leak) belt-and-suspenders the constructor branch from Plan 01 (`SpineVersionUnsupportedError` constructor branched by `detectedVersion === '4.3-schema'` sentinel OR semver >= 4.3).

## Task Commits

Each task committed atomically:

1. **Task 1: Create the SPINE_4_3_TEST fixture (JSON + atlas + 1x1 PNG)** — `ec26242` (test)
2. **Task 2: Add fixture-driven 4.3-rejection block to loader-version-guard.spec.ts** — `4d15996` (test)

## Files Created / Modified

**Created:**
- `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` (328 bytes) — synthetic 4.3-shape skeleton JSON with both detection signals.
- `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas` (170 bytes) — single 1x1 region atlas (predicate fires before resolution).
- `fixtures/SPINE_4_3_TEST/images/SQUARE.png` (74 bytes) — byte-for-byte copy of SPINE_3_8_TEST/images/SQUARE.png.

**Modified:**
- `tests/core/loader-version-guard.spec.ts` — `+99 -0` (one constant + one new describe block with 6 it() cases + 5 new it() cases extending existing existence-sentinels block + docblock paragraph). Existing F3 describe block is byte-stable. Test count grew from 10 to 21.

## Decisions Made

- **Belt-and-suspenders fixture shape (CONTEXT D-06).** The SPINE_4_3_TEST.json carries BOTH detection signals — `skeleton.spine = "4.3.91-beta"` (semver branch) AND a non-empty top-level `constraints[]` array (schema branch). The fixture-driven test asserts "rejection happened" without disambiguating which predicate fired — that's the job of the predicate-isolation specs already in place from Plan 01 (`loader-version-guard-predicate.spec.ts` and `loader-43-schema-guard-predicate.spec.ts`). This redundancy is intentional: if a future change accidentally weakens one predicate, the other still catches the fixture.
- **Atlas page filename swap is cosmetic.** `SPINE_4_3_TEST.atlas` line 1 reads `SPINE_4_3_TEST.png` (not `SPINE_3_8_TEST.png`) for self-consistency, but the file does not exist on disk because the predicate fires first. We get a free invariant check: if the predicate ever stops firing first, atlas resolution would fail with a different error class and the test would fail loudly.
- **PNG byte-for-byte copy from SPINE_3_8_TEST.** The existing 1x1 RGBA non-interlaced stub is a known-good asset already in the repo. Re-using it (instead of regenerating with sharp or pngjs) keeps the fixture deterministic across CI runs and platforms.
- **Test additions are purely additive.** Existing 3.8 describe block, existing 4.2 happy-path assertion at line ~88, and existing 3.8 existence-sentinels are byte-stable. The new 4.3 block is inserted between them in clear lexical position. No rewrites, no test merges.

## Deviations from Plan

None — plan executed exactly as written.

The deviation rules did not fire — every change matched the plan's byte-locked excerpts (PATTERNS.md fixture shape, action steps A-E, test verbatim insertions). Auth gates protocol did not fire (no external services touched). The pre-existing `sampler-skin-defined-unbound-attachment.spec.ts` failure surfaced in the broad `npm test -- tests/core/ --run` output is OUT OF SCOPE per the SCOPE BOUNDARY rule — it predates Phase 32 (commit `40a4f2c fix(ship-v1.3): skip sampler-skin-attachment test on CI (gitignored fixture)` in v1.3.1), is already tracked in `deferred-items.md` and Plan 01 SUMMARY's "Issues Encountered" section, and is not a Plan 03 regression.

## Issues Encountered

**Pre-existing fixture-absence failure in `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`** (same as Plan 01) — surfaces in `npm test -- tests/core/ --run` output. The test loads `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` which is gitignored. NOT a Plan 03 regression — verifiable against worktree base `b1d014f` (Wave 1) and against `6c2fd8e` (pre-Wave 1). Logged in `deferred-items.md`. v1.4 backlog.

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- **Plan 32-02 (drop-zone v4.2 disclosure)** — independent of this plan; runs in the same wave (Wave 2) per the phase plan; no blocker between 32-02 and 32-03.
- **Plan 32-04 (SEED-006 plant)** — last in the phase execute sequence per CONTEXT D-07; proceeds after both Wave 2 plans land on main.
- **End-to-end COMPAT-01 coverage** — now fully in place: predicate-isolation (Plan 01) + fixture-driven loadSkeleton end-to-end (this plan). Future drift in either the predicate or the constructor message branch is now caught by both layers of tests.

## Self-Check: PASSED

Verified:
- `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` exists (FOUND, 328 bytes).
- `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas` exists (FOUND, 170 bytes).
- `fixtures/SPINE_4_3_TEST/images/SQUARE.png` exists (FOUND, 74 bytes, byte-identical to SPINE_3_8_TEST/images/SQUARE.png).
- `tests/core/loader-version-guard.spec.ts` modifications present (FOUND): FIXTURE_43 constant (10 references); Phase 32 COMPAT-01 describe block (6 it() cases); 5 new it() cases extending existence-sentinels block.
- Commit `ec26242` present in git log (FOUND).
- Commit `4d15996` present in git log (FOUND).
- All 21/21 tests pass in `loader-version-guard.spec.ts`.
- All 88/88 tests pass across the focused related suite (loader-version-guard + 2 predicate specs + errors-version + loader + arch).
- No stubs introduced (test file is purely assertions; fixture is static synthetic data).
- No new threat surface introduced (fixture is committed static data per threat register T-32-09..12; no IPC, no network, no DOM).

---
*Phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure*
*Plan: 03*
*Completed: 2026-05-10*
