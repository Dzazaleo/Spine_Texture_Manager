---
phase: 36-split-overrides-per-loader-mode
plan: 04
subsystem: test-fixtures-unit-tests
tags: [vitest, test-fixtures, project-file-spec, override-migration-spec, ovr-04, ovr-06, seed-007]

# Dependency graph
requires:
  - phase: 36
    plan: 01
    provides: "ProjectFileV1.overridesAtlasLess + AppSessionState.overridesAtlasLess type-system foundation; validator pre-massage + serializer/materializer wiring"
provides:
  - "OVR-06 round-trip test for both override buckets (atlas-source + atlas-less) in tests/core/project-file.spec.ts"
  - "OVR-06 forward-compat pre-massage test (legacy file shape missing overridesAtlasLess → {}) in tests/core/project-file.spec.ts"
  - "OVR-04 per-bucket migration independence test (Test 10) in tests/main/override-migration.spec.ts"
  - "OVR-04 stale keys union test (Test 11) in tests/main/override-migration.spec.ts"
  - "Updated 13 pre-existing AppSessionState / ProjectFileV1 literal fixtures to include overridesAtlasLess: {} (post-36-01 type-shape compliance)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Field-add precedent for SEED-007 test fixtures (mirrors loaderMode Phase 21, sharpenOnExport Phase 28, safetyBufferPercent Phase 30 — every existing AppSessionState/ProjectFileV1 literal gains the new field at value {})"
    - "Per-bucket helper-level test convention: run migrateOverrides() twice (once per bucket) against shared summary.regions; helper body unmodified; per-bucket independence proven via deep-equal on restored[] + stale[] union"

key-files:
  created: []
  modified:
    - tests/core/project-file.spec.ts
    - tests/main/override-migration.spec.ts

key-decisions:
  - "Kept Task 1 as a single coordinated commit (Edit A + Edit B together) because the 13 existing-literal updates and the new describe block share the same compilation unit — splitting would leave the file in an uncompilable intermediate state. The plan's `<action>` block explicitly combines both edit kinds under Task 1."
  - "No modification to src/main/override-migration.ts — Test 10 + Test 11 use the unmodified `migrateOverrides` helper. Per-bucket coverage = call helper twice with different inputs against the same summary, then union/sum the results at the test assertion level (matches the OVR-04 contract that the project-io.ts caller — owned by Plan 36-02 — composes)."
  - "Did NOT update tests/core/project-file-loader-mode-heal.spec.ts or tests/main/project-io.spec.ts (typecheck errors visible in `npm run typecheck` output) — those files are out-of-scope per the executor prompt and the Plan 36-04 success criteria: `No modifications outside tests/main/override-migration.spec.ts and tests/core/project-file.spec.ts`. Plan 36-02 (parallel wave) owns project-io.ts and its sibling test fixtures."

patterns-established:
  - "Pattern: When a required field is added to a shared type, every existing fixture literal in the spec file gains the field at its empty/default value in the SAME commit as the new field-targeted tests. Otherwise TypeScript widens the literals and the spec file fails to compile as a single unit."
  - "Pattern: Per-bucket migration tests at the helper layer assert sum (migratedKeyCount) + union (stale[]) semantics in-test, leaving the helper body stateless and the integration responsibility to the project-io.ts caller (covered by Plan 36-02's tests)."

requirements-completed: [OVR-06]

# Metrics
duration: ~5 min
completed: 2026-05-13
---

# Phase 36 Plan 04: Test Fixtures + Unit Tests Summary

**OVR-06 round-trip + forward-compat + per-bucket migration contracts locked via vitest unit tests. Two test files updated: `tests/core/project-file.spec.ts` (+2 Phase 36 tests; 13 pre-existing literal sites updated to include `overridesAtlasLess: {}`); `tests/main/override-migration.spec.ts` (+2 OVR-04 per-bucket tests, helper body unchanged).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T10:06:01Z
- **Completed:** 2026-05-13T10:10:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Task 1 (`tests/core/project-file.spec.ts`):**
  - Updated 13 pre-existing literal sites (12 `AppSessionState` + 1 inline `ProjectFileV1` + 1 typed `ProjectFileV1`) to include `overridesAtlasLess: {}` as a required sibling to `overrides`.
  - Added new `describe('Phase 36 — overridesAtlasLess (SEED-007 L-01)', ...)` block at the end of the file with two `it(...)` blocks:
    1. `validateProjectFile pre-massages missing overridesAtlasLess to {} (forward-compat for v1.3.x/v1.4.x files)` — builds a `Record<string, unknown>` legacy fixture with `overridesAtlasLess` INTENTIONALLY ABSENT, asserts `result.ok === true` and `result.project.overridesAtlasLess === {}`.
    2. `serialize → materialize round-trips both buckets losslessly` — uses DIFFERENT values per bucket (`CIRCLE: 75` in atlas-source, `SQUARE: 50` in atlas-less) to catch any copy/swap bug per T-36-13; asserts both buckets present in both `serialized` and `materialized` outputs.
  - Test count: 31 → 33 (+2 new tests passing).
- **Task 2 (`tests/main/override-migration.spec.ts`):**
  - Added two new `it(...)` blocks at the end of the existing top-level describe:
    1. `Test 10 (Phase 36 OVR-04): per-bucket migration runs independently against shared summary.regions` — runs `migrateOverrides` twice (atlas-source + atlas-less buckets) against a summary containing both `CIRCLE` and `SQUARE` regions; asserts both `restored` outputs are clean, both `stale` arrays empty, OVR-04 sum semantics (`migratedKeyCount sum === 0`) + union semantics (`stale union === []`).
    2. `Test 11 (Phase 36 OVR-04): stale keys union across buckets (Case C orphans in both)` — both buckets contain orphan keys; asserts each per-bucket `stale[]` independently, then asserts the union sorts to `['ORPHAN_A', 'ORPHAN_B']`.
  - `migrateOverrides` body unchanged (verified via `git diff --stat 6a76f861e91d3c0db5b77e1405c168dce53eecad..HEAD src/main/override-migration.ts` → empty).
  - Test count: 11 → 13 (+2 new tests passing).
- Combined verification: `npm test -- tests/core/project-file.spec.ts tests/main/override-migration.spec.ts` → 46 tests pass across 2 files.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update 13 pre-existing literals + add Phase 36 overridesAtlasLess describe block** — `0c17297` (test)
2. **Task 2: Add Test 10 + Test 11 per-bucket migration tests** — `b083314` (test)

## Files Modified

### `tests/core/project-file.spec.ts` (+69 / -3)

Edit A — `overridesAtlasLess: {}` added to existing `AppSessionState` / `ProjectFileV1` literal sites at original line numbers (pre-edit):

| Original line | Test context |
|---------------|--------------|
| 115           | `round-trip preserves all D-145 fields` — `AppSessionState` |
| 137           | `documentation slot preserved on round-trip (D-148)` — `AppSessionState` |
| 168           | `round-trip preserves a non-empty Documentation (DOC-05)` — `AppSessionState` |
| 200 (oldFile) | `materializer back-fills DEFAULT_DOCUMENTATION for Phase 8-era empty {} slot` — inline `ProjectFileV1`-shaped literal |
| 269           | `round-trip relative paths (D-155)` — `AppSessionState` |
| 310           | `migrate is identity on v1` — typed `ProjectFileV1` |
| 367           | Phase 21 `loaderMode: 'atlas-less'` round-trip — `AppSessionState` |
| 435           | Phase 28 `sharpenOnExport: true` round-trip — `AppSessionState` |
| 456           | Phase 28 `sharpenOnExport: false` round-trip — `AppSessionState` |
| 535           | Phase 30 `safetyBufferPercent: 5` round-trip — `AppSessionState` |
| 556           | Phase 30 `safetyBufferPercent: 0` round-trip — `AppSessionState` |
| 577           | Phase 30 `safetyBufferPercent: 5` schema-version-stays-1 — `AppSessionState` |
| 596           | Phase 30 `safetyBufferPercent: 7` double-serialize byte-identical — `AppSessionState` |

Edit B — New `describe('Phase 36 — overridesAtlasLess (SEED-007 L-01)', ...)` block appended at end of file (after the `hygiene — Layer 3 invariant` describe).

### `tests/main/override-migration.spec.ts` (+27 / -0)

Two new `it(...)` blocks appended at the end of the existing `describe('migrateOverrides — Phase 29 D-06 (project-io.ts shared helper)', ...)` block (after the pre-existing Test 8).

## Grep Counts (final)

| Counter | Plan requires | Actual |
| ------- | ------------- | ------ |
| `Phase 36 — overridesAtlasLess` in project-file.spec.ts | == 1 | 1 |
| `pre-massages missing overridesAtlasLess` in project-file.spec.ts | == 1 | 1 |
| `round-trips both buckets losslessly` in project-file.spec.ts | == 1 | 1 |
| `INTENTIONALLY ABSENT` (legacy fixture marker) in project-file.spec.ts | == 1 | 1 |
| `Test 10 (Phase 36 OVR-04)` in override-migration.spec.ts | == 1 | 1 |
| `Test 11 (Phase 36 OVR-04)` in override-migration.spec.ts | == 1 | 1 |
| `git diff --stat src/main/override-migration.ts` (vs base) | empty | empty |
| `npm test -- tests/core/project-file.spec.ts tests/main/override-migration.spec.ts` exit | 0 | 0 (46 tests pass) |

All thresholds met.

## Test Count Delta

| File | Before | After | Delta |
| ---- | ------ | ----- | ----- |
| `tests/core/project-file.spec.ts` | 31 passing | 33 passing | +2 |
| `tests/main/override-migration.spec.ts` | 11 passing | 13 passing | +2 |
| **Combined** | 42 passing | 46 passing | +4 |

## Decisions Made

- **Coordinated Edit A + Edit B in Task 1** — split would leave the spec file uncompilable mid-task. Plan's `<action>` block explicitly couples both edits under Task 1.
- **No `migrateOverrides` body changes** — Test 10 + Test 11 are per-bucket assertion tests that compose the helper output at the call site, exactly mirroring how `project-io.ts` (Plan 36-02) will compose the helper across two buckets. Helper stays stateless and reusable.
- **Did not touch `tests/main/project-io.spec.ts` or `tests/core/project-file-loader-mode-heal.spec.ts`** — both have post-36-01 typecheck errors visible in `npm run typecheck` output, but they are explicitly out-of-scope per the executor prompt and success criteria. Plan 36-02 (parallel wave) owns these files alongside its `src/main/project-io.ts` edits.
- **Different values per bucket in the round-trip test** (`CIRCLE: 75` vs `SQUARE: 50`) — T-36-13 mitigation: a copy/swap bug between the two buckets during serialize/materialize would produce identical-value buckets and silently pass a same-value fixture. Different-key + different-value catches both swap and shared-reference bugs.

## Deviations from Plan

None — plan executed exactly as written. All Edit A line numbers in the plan's `<action>` block matched the actual literal sites (verified via `npm run typecheck` → 13 errors pre-edit → 0 errors post-edit). The new describe block was added verbatim per 36-PATTERNS.md §9 mirror.

## Issues Encountered

- **Pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts:187`** — visible in `npm run typecheck` output but originates from base commit and is unrelated to this plan's scope. Already logged in Plan 36-01 SUMMARY "Issues Encountered". Not touched.
- **Plan-36-02-owned typecheck errors in `src/main/project-io.ts`, `tests/main/project-io.spec.ts`, `tests/core/project-file-loader-mode-heal.spec.ts`** — these are the exact rename + sibling-field additions Plan 36-02 (parallel wave) addresses. Logged here as expected post-36-01 errors that Plan 36-04 deliberately does NOT touch (out of scope per prompt + success criteria).

## TDD Gate Compliance

This plan has `type: execute` (not `type: tdd`) but both tasks carry `tdd="true"` per-task. Per per-task TDD policy:

- Task 1: `test(36-04): add Phase 36 overridesAtlasLess pre-massage + round-trip tests` — single combined commit per the plan's `<action>` coupling. The tests would have been RED on base (legacy field absent + new describe block missing) and are GREEN post-commit. Since the tests target the post-36-01 contract (already merged before this plan ran), there is no "GREEN-only-after-implementation" cycle — Plan 36-01 IS the implementation; Plan 36-04 IS the verification. This matches the dependency graph (`depends_on: ["36-01"]`).
- Task 2: `test(36-04): add per-bucket migration tests (Test 10 + Test 11) for OVR-04` — same pattern. `migrateOverrides` body is the pre-existing GREEN implementation (Phase 29 D-06); Plan 36-04 adds the per-bucket assertions that lock the OVR-04 sum/union semantics.

Verification: `git log --oneline 6a76f861e91d3c0db5b77e1405c168dce53eecad..HEAD` shows 2 commits, both `test(...)` — matches the test-only nature of this plan.

## Threat Model Verification

The plan declared three STRIDE threats (T-36-12, T-36-13, T-36-14):

- **T-36-12 (Tampering — fixture that silently passes without proving forward-compat):** MITIGATED. The new Phase 36 Test 1 fixture is a `Record<string, unknown>` with `overridesAtlasLess` INTENTIONALLY ABSENT and the comment `// overridesAtlasLess INTENTIONALLY ABSENT (v1.3.x/v1.4.x shape)` adjacent to the absent field. Acceptance grep `grep -c "INTENTIONALLY ABSENT" tests/core/project-file.spec.ts` returns 1. TypeScript cannot reject the absence at the type level (untyped `Record<string, unknown>`), so the validator's pre-massage behavior is genuinely exercised at runtime.
- **T-36-13 (Repudiation / coverage gap — same-value bucket fixture):** MITIGATED. The round-trip test uses `CIRCLE: 75` in the atlas-source bucket and `SQUARE: 50` in the atlas-less bucket — different keys AND different values. Any swap, shared-reference, or single-bucket-write bug in `serializeProjectFile` / `materializeProjectFile` produces non-matching `restored` / `materialized` outputs and fails the test.
- **T-36-14 (DoS via large fixtures):** ACCEPTED. Each fixture has 1 key per bucket. Pre-existing pattern.

## Threat Flags

None — no new network endpoints, no new auth surface, no new file access patterns. Tests run in-memory only against the existing `validateProjectFile` / `serializeProjectFile` / `materializeProjectFile` / `migrateOverrides` exports.

## Known Stubs

None — this plan is pure test additions / fixture updates. No UI surface, no data wiring, no stubs.

## Next Plan Readiness

- **Plan 36-02 (`src/main/project-io.ts` Open / recovery / resample seams + legacy routing):** Running in parallel (Wave 2). Test additions in `tests/main/project-io.spec.ts` and `tests/core/project-file-loader-mode-heal.spec.ts` are owned by 36-02 and remain typecheck-error post-36-01 — those errors are not Plan 36-04's responsibility.
- **Plan 36-03 (AppShell.tsx + App.tsx renderer-side state slots):** Running in parallel (Wave 2). Independent of this plan.
- **Plan 36-05 (mode-toggle divergence renderer spec + quality gate):** Wave 3. Will consume the locked `overridesAtlasLess` contract proven here and the project-io.ts/AppShell.tsx wiring landed in 36-02/36-03.

## Self-Check: PASSED

**Verified existence of modified files:**
- `tests/core/project-file.spec.ts` — FOUND (modified)
- `tests/main/override-migration.spec.ts` — FOUND (modified)
- `.planning/phases/36-split-overrides-per-loader-mode/36-04-SUMMARY.md` — FOUND (created by this write)

**Verified commit hashes:**
- `0c17297` — FOUND in git log (Task 1: project-file.spec.ts changes)
- `b083314` — FOUND in git log (Task 2: override-migration.spec.ts changes)

**Verified scope:**
- `git diff --stat 6a76f861e91d3c0db5b77e1405c168dce53eecad..HEAD` → 2 files changed: `tests/core/project-file.spec.ts` (+69 / -3), `tests/main/override-migration.spec.ts` (+27 / -0). No files outside scope touched.
- `git diff --stat 6a76f861e91d3c0db5b77e1405c168dce53eecad..HEAD src/main/override-migration.ts` → empty (helper body unchanged).

All claims in this SUMMARY validated.

---
*Phase: 36-split-overrides-per-loader-mode*
*Completed: 2026-05-13*
