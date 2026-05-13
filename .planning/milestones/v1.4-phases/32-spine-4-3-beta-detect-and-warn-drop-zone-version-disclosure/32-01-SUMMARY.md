---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
plan: 01
subsystem: core
tags: [core, loader, errors, tdd, spine-4.3, predicate, compat-01]

# Dependency graph
requires:
  - phase: 12-ci-release-pipeline-github-actions-draft-release
    provides: SpineVersionUnsupportedError class + checkSpineVersion predicate (F3 contract); pre-4.2 message verbatim contract
provides:
  - checkSpine43Schema predicate (exported) — detects top-level constraints array
  - checkSpineVersion strict-cut at 4.3+ (rejects major.minor >= 4.3 and major >= 5)
  - SpineVersionUnsupportedError constructor branched by detectedVersion ('4.3-schema' sentinel + semver >= 4.3 -> COMPAT-01 wording)
  - 4-way test coverage (semver-predicate-spec inverted; new schema-predicate-spec; errors-version COMPAT-01 branch assertions; pre-4.2 regression-belt)
affects:
  - 32-03-PLAN.md (fixture-driven loadSkeleton end-to-end test depends on this plan)
  - 32-02-PLAN.md (drop-zone v4.2 disclosure pairs with the new error message at runtime)
  - 32-04-PLAN.md (SEED-006 plant references this plan as the Option A landing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sentinel-string discriminator ('4.3-schema') threaded through typed-error constructor branch"
    - "Predicate-isolation testing — exported predicate exercised in isolation from fixture loading (mirrors Phase 12 F3 three-file split, extended to four-way)"

key-files:
  created:
    - tests/core/loader-43-schema-guard-predicate.spec.ts
  modified:
    - src/core/loader.ts
    - src/core/errors.ts
    - tests/core/loader-version-guard-predicate.spec.ts
    - tests/core/errors-version.spec.ts

key-decisions:
  - "Sentinel string '4.3-schema' as detectedVersion when schema-predicate fires — keeps SpineVersionUnsupportedError constructor signature byte-stable while allowing the constructor to branch the message (D-02, D-03)"
  - "Empty constraints[] array still rejects (CONTEXT D-05) — presence of the field IS the schema signal, not its contents"
  - "Strict-cut at 4.3+ in checkSpineVersion (D-01) — explicit reject branch with the actual semver passed as detectedVersion so the constructor's semver-parse branch fires"

patterns-established:
  - "4.3+ branch fires when detectedVersion === '4.3-schema' OR semver parses to major.minor >= 4.3 (or major >= 5) — both routes converge on the same COMPAT-01 message"
  - "Pre-4.2 branch byte-stable — covered by an explicit regression-belt assertion that the COMPAT-01 template MUST NOT leak into the legacy F3 message"

requirements-completed: [COMPAT-01]

# Metrics
duration: ~10min
completed: 2026-05-10
---

# Phase 32 Plan 01: Spine 4.3-beta Detect-and-Warn (Loader-Side) Summary

**Loader rejects honest 4.3 exports (semver `>= 4.3`) and 4.3-shape JSON (top-level `constraints` array) BEFORE `SkeletonJson.readSkeletonData` runs, surfacing the COMPAT-01 "Re-export as Version 4.2 (supported downgrade)" message instead of the misleading `IK Constraint not found:` symptom.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-10T16:18:00Z (approx)
- **Completed:** 2026-05-10T16:23:00Z (approx)
- **Tasks:** 2
- **Files modified:** 4 (2 src, 2 tests) + 1 created (new test file)

## Accomplishments

- New exported `checkSpine43Schema(parsedJson, skeletonPath)` predicate in `src/core/loader.ts` — detects top-level `constraints` array (4.3 unified-schema marker) and throws `SpineVersionUnsupportedError` with `detectedVersion = '4.3-schema'` sentinel. Defense-in-depth for 4.3 exports whose `skeleton.spine` field is missing or malformed.
- `checkSpineVersion` tightened to strict-cut at 4.3+ — rejects `major.minor >= 4.3` and any `major >= 5` with the actual semver string passed as `detectedVersion` (so the constructor's semver-parse branch fires).
- `SpineVersionUnsupportedError` constructor branched by `detectedVersion`. 4.3+ branch (sentinel OR semver >= 4.3) produces the COMPAT-01-locked wording: *"This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again."* Pre-4.2 branch preserved verbatim (Phase 12 F3 contract byte-stable).
- `loadSkeleton` wires the new predicate sequentially after the existing version-guard block and BEFORE atlas resolution + `SkeletonJson.readSkeletonData`.
- 4-way test coverage delivered: 11-case schema-predicate spec (NEW); 3 inverted lenient-on-4.3+ cases in version-guard predicate spec; 4 new errors-version cases (3 4.3+ branch + 1 pre-4.2 regression-belt that asserts the COMPAT-01 template MUST NOT leak into the pre-4.2 branch).
- Layer-3 invariant preserved (`tests/arch.spec.ts` 12 cases green) — no DOM, no Electron, no `sharp` imports added; pure object-inspection predicate using TypeScript narrowing.
- IPC envelope contract preserved — `.name`, constructor signature `(detectedVersion, skeletonPath)`, and `extends SpineLoaderError` unchanged.

## Predicate Signature & Sentinel

**Signature:** `export function checkSpine43Schema(parsedJson: unknown, skeletonPath: string): void`

**Sentinel string:** `'4.3-schema'` — passed as `detectedVersion` to the `SpineVersionUnsupportedError` constructor when the schema-predicate fires (no real semver is known at predicate time; the field exists for diagnostic readability and to drive constructor branching).

**Call site:** `src/core/loader.ts loadSkeleton`, immediately after the `checkSpineVersion(...)` block (~line 184 of the post-edit file) and BEFORE the Phase 22 DIMS-01 canonical-dims walk. Runs BEFORE atlas resolution and BEFORE `SkeletonJson.readSkeletonData`.

## COMPAT-01 Message (verbatim)

```
This app currently supports Spine v4.2. Re-export from your 4.3 editor as Version 4.2 (supported downgrade) and try again.
```

REQUIREMENTS.md L13 byte-locked. Fires for both routes:
- (a) `detectedVersion === '4.3-schema'` (schema-predicate sentinel)
- (b) `detectedVersion` semver parses to `major.minor >= 4.3` OR `major >= 5`

## Pre-4.2 Branch Byte-Stability

The legacy Phase 12 F3 message is preserved verbatim:

```
This file was exported from Spine ${detectedVersion}. Spine Texture Manager requires Spine 4.2 or later. Re-export from Spine 4.2 or later in the editor.
```

Covered by:
- `tests/core/errors-version.spec.ts` — existing `'3.8.99'` and `'unknown'` cases stay byte-stable; new `Pre-4.2 branch: '4.1.99' preserves the legacy F3 message verbatim` case explicitly asserts the COMPAT-01 template does NOT leak into this branch (`expect(err.message).not.toContain('supported downgrade')` + `not.toContain('your 4.3 editor')`).
- `tests/core/loader-version-guard.spec.ts` — existing 3.8.99 fixture rejection + 4.2 happy-path stay green (regression-belt across the predicate strict-cut).
- `tests/core/loader.spec.ts` — 22-case full loader spec green (4.2 fixture happy-path verified end-to-end).

## Test Counts

| File | Status | Cases (new / total) |
|------|--------|---------------------|
| `tests/core/loader-43-schema-guard-predicate.spec.ts` (NEW) | green | 11 / 11 |
| `tests/core/loader-version-guard-predicate.spec.ts` (modified) | green | +3 inverted (rejects 4.3.0 + rejects 4.3.91-beta + rejects 5.0.0); -2 removed (accepts 4.3.0 + accepts 5.0.0) |
| `tests/core/errors-version.spec.ts` (modified) | green | +4 (3 4.3+ branch + 1 pre-4.2 regression-belt) |
| `tests/core/loader-version-guard.spec.ts` (unchanged) | green | byte-stable |
| `tests/core/loader.spec.ts` (unchanged) | green | byte-stable |
| `tests/arch.spec.ts` (unchanged) | green | byte-stable (Layer-3 invariant intact) |

**Aggregate:** `npm test -- tests/core/errors-version.spec.ts tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-43-schema-guard-predicate.spec.ts --run` → 33 passed.

**Aggregate (Task 1 verification):** `npm test -- tests/core/errors-version.spec.ts tests/core/loader-version-guard.spec.ts tests/arch.spec.ts --run` → 27 passed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add `checkSpine43Schema` predicate + branch `SpineVersionUnsupportedError` constructor message + tighten `checkSpineVersion` to reject 4.3+** — `d3d7b23` (feat)
2. **Task 2: Invert "lenient on 4.3+" assertions; create new `loader-43-schema-guard-predicate.spec.ts`; add 4.3+ branch assertions to `errors-version.spec.ts`** — `b24eac6` (test)

## Files Created / Modified

**Created:**
- `tests/core/loader-43-schema-guard-predicate.spec.ts` — 11-case schema-predicate spec (7 accepted + 4 rejected; CONTEXT D-05 empty-array policy + sentinel-field assertion).
- `.planning/phases/32-…/deferred-items.md` — pre-existing out-of-scope failure (sampler-skin-defined-unbound-attachment.spec.ts fixture-absence; not Phase 32 work).

**Modified:**
- `src/core/loader.ts` — `checkSpineVersion` strict-cut at 4.3+; new exported `checkSpine43Schema` predicate; sequential call site in `loadSkeleton` between version guard and DIMS-01 walk. JSDoc rewritten to reflect Phase 32 strict-cut (D-01); old "Lenient on 4.3+ per CONTEXT.md Deferred…" comment removed.
- `src/core/errors.ts` — `SpineVersionUnsupportedError` constructor branched by `detectedVersion` (sentinel + semver routes to COMPAT-01 wording; pre-4.2 fall-through verbatim). JSDoc updated. `.name`, signature, inheritance unchanged.
- `tests/core/loader-version-guard-predicate.spec.ts` — inverted "accepts 4.3.0" + "accepts 5.0.0" cases (deleted from accepts block; added to rejected block as rejects 4.3.0 + rejects 4.3.91-beta + rejects 5.0.0 with field-readback). Docblock numbered case `2.` updated.
- `tests/core/errors-version.spec.ts` — describe block name updated `(Phase 12 / Plan 05 / F3)` → `(Phase 12 F3 + Phase 32 COMPAT-01)`; 4 new cases appended.

## Decisions Made

- **Sentinel string `'4.3-schema'`** — the schema-predicate has no real semver to thread through, but the constructor needs a discriminator for the message branch. A sentinel string keeps the constructor signature byte-stable (`detectedVersion: string`), avoids a third nullable field, and reads cleanly in stack traces and IPC envelope payloads. Decision locked in CONTEXT D-02.
- **Empty `constraints: []` array still rejects** — CONTEXT D-05 explicitly chose this: presence of the field IS the 4.3-shape signal, not its contents. The 4.2 schema does not use a top-level `constraints` field at all (it uses four legacy arrays: `ik`, `transform`, `path`, `physics`); a Spine 4.3 export with no IK constraints will still emit `constraints: []`, and we want to catch that.
- **Constructor branch uses `parts[0]` + `parts[1]` semver parse mirroring `checkSpineVersion`** — consistent with the loader's existing string-parse approach (no `semver` library import, Layer-3-clean). Handles `'4.3.91-beta'` correctly: `parseInt('4', 10)` and `parseInt('3', 10)` both succeed and `4 === 4 && 3 >= 3` fires the 4.3+ branch.
- **Inverted predicate cases moved (not deleted)** — the lenient `accepts 4.3.0` + `accepts 5.0.0` assertions were physically removed from the `accepts` describe block AND replaced with `rejects` mirrors in the rejection block. This preserves the four-way coverage shape (accepted + rejected branches both populated) and prevents future regressions where someone might re-add lenience.

## Deviations from Plan

None — plan executed exactly as written.

The auth gates protocol did not fire (this plan touches no external services). The deviation rules did not fire either — every change matched the PATTERNS.md and PLAN.md byte-locked excerpts. The pre-existing `sampler-skin-defined-unbound-attachment.spec.ts` failure (logged under `## Issues Encountered` and `deferred-items.md`) is OUT OF SCOPE per the SCOPE BOUNDARY rule (the failing test depends on a gitignored fixture that predates Phase 32).

## Issues Encountered

**Pre-existing fixture-absence failure in `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`** — surfaced when the verification step ran `npm test -- tests/core/ --run`. The test loads `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` which is gitignored (CI-skip pattern, see commit `40a4f2c fix(ship-v1.3): skip sampler-skin-attachment test on CI (gitignored fixture)`). The 7 inner tests all skip cleanly, but the suite-loading throws `SkeletonJsonNotFoundError` because `loadSkeleton` is invoked BEFORE the skip-gate fires. NOT a Phase 32 regression — verifiable against worktree base `6c2fd8e`. Logged in `deferred-items.md`. v1.4 backlog.

Build step `npm run build` — the TypeScript compile + Vite + Electron-Vite preload bundle steps all succeed. The trailing `electron-builder` packaging step fails because `node_modules/electron` is absent in the worktree (parent repo has full deps; the worktree was checked out without `npm install`). Not a code regression — TypeScript type-check is clean (`npx tsc --noEmit -p tsconfig.node.json` exits 0).

## User Setup Required

None — no external service configuration required for this plan.

## Next Phase Readiness

- **Plan 32-02 (drop-zone v4.2 disclosure)** — independent of this plan; no blockers.
- **Plan 32-03 (fixture-driven `loadSkeleton(FIXTURE_43)` end-to-end test)** — DEPENDS ON this plan landing first (its assertions exercise both the semver predicate strict-cut AND the schema predicate, and assert the COMPAT-01 wording from the constructor branch). The dependency edge is now satisfied — Plan 32-03 can execute on top of `b24eac6`.
- **Plan 32-04 (SEED-006 plant)** — last commit in the phase execute sequence per CONTEXT D-07.

## Self-Check: PASSED

Verified:
- `src/core/loader.ts` modifications present (FOUND).
- `src/core/errors.ts` modifications present (FOUND).
- `tests/core/loader-43-schema-guard-predicate.spec.ts` exists (FOUND).
- `tests/core/loader-version-guard-predicate.spec.ts` modifications present (FOUND).
- `tests/core/errors-version.spec.ts` modifications present (FOUND).
- Commit `d3d7b23` present in git log (FOUND).
- Commit `b24eac6` present in git log (FOUND).
- No stubs introduced (predicate is pure logic; no UI components or empty data flows).
- No new threat surface introduced (CONTEXT threat register T-32-01..05 all addressed via TypeScript narrowing in the predicate; no new IPC kinds, no network/DOM/fs additions).

---
*Phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure*
*Plan: 01*
*Completed: 2026-05-10*
