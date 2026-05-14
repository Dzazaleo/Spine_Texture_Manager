---
phase: 40-atlas-repack-output
plan: 01
subsystem: schema
tags: [stmproj-schema, additive-fields, validator-pre-massage, repack-07]

# Dependency graph
requires:
  - phase: prior
    provides: ProjectFileV1 + AppSessionState schema; validator pre-massage precedent (loaderMode / sharpenOnExport / safetyBufferPercent)
provides:
  - "ProjectFileV1.atlasOutputMode ('loose' | 'atlas' | 'both') with validator pre-massage (default 'loose')"
  - "ProjectFileV1.atlasMaxPageSize (1024 | 2048 | 4096 | 8192) with validator pre-massage (default 4096)"
  - "ProjectFileV1.atlasAllowRotation (boolean) with validator pre-massage (default false)"
  - "ProjectFileV1.atlasPadding (integer 0..16) with validator pre-massage (default 2)"
  - "AppSessionState mirror of all 4 atlas fields for round-trip parity"
  - "ExportProgressEvent.phase?: 'resize' | 'composite' additive optional field for the 2-stage repack pipeline (D-05)"
  - "PartialMaterialized + serializeProjectFile + materializeProjectFile wired through all 4 fields with defence-in-depth `?? defaultValue`"
affects: [40-02-optimize-dialog, 40-03-ipc-dispatch, 40-04-repack-worker, 40-05-atlas-writer, 40-06-repack-core, 40-07-tests, 40-08-progress, 40-09-fixtures]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive `.stmproj` field with no schema-version bump (4th application of the loaderMode/sharpenOnExport/safetyBufferPercent precedent)"
    - "Optional discriminator field on IPC event types (ExportProgressEvent.phase) — existing single-stream consumers unaffected"

key-files:
  created: []
  modified:
    - "src/shared/types.ts — ProjectFileV1 + AppSessionState gain 4 atlas fields; ExportProgressEvent gains optional `phase` discriminator"
    - "src/core/project-file.ts — validateProjectFile gains 4 forward-compat pre-massage blocks; serializeProjectFile + materializeProjectFile + PartialMaterialized extended"
    - "tests/core/project-file.spec.ts — 4 new REPACK-07 tests + 14 existing literals updated for type strictness"
    - "src/renderer/src/components/AppShell.tsx — buildSessionState seeded with pre-massage defaults (Rule 3 spillover; Plan 40-02 will wire UI state)"
    - "tests/main/project-io.spec.ts — baseState literal updated (Rule 3 spillover)"
    - "tests/core/project-file-loader-mode-heal.spec.ts — baseFile literal updated (Rule 3 spillover)"

key-decisions:
  - "atlasPadding range is [0, 16] (not [0, 25] like safetyBufferPercent) per CONTEXT D-01e"
  - "atlasOutputMode default 'loose' preserves byte-stable loose-PNG pipeline for legacy projects (CONTEXT D-01a)"
  - "ExportProgressEvent.phase is optional — additive-only contract per D-05; existing consumers ignore"
  - "Schema version (`version: 1`) is NOT bumped — locked SEED-008 design fact #4"
  - "Rule 3 spillover (AppShell + 2 spec literals) fixed in Task 01.1 commit; the additive required fields propagate at the compile-error level"

patterns-established:
  - "Pre-massage + literal-union type-guard idiom mirrored ×4 (atlasOutputMode literal-union; atlasMaxPageSize numeric-literal-union; atlasAllowRotation boolean; atlasPadding integer-range)"
  - "Round-trip test triad: defaults / round-trip / version-unchanged + invalid-rejects type-guard test (REPACK-07 acceptance a/b/c + type guard)"

requirements-completed: [REPACK-07]

# Metrics
duration: ~12 min
completed: 2026-05-14
---

# Phase 40 Plan 01: Atlas .stmproj Schema (REPACK-07) Summary

**4 additive atlas fields (`atlasOutputMode` / `atlasMaxPageSize` / `atlasAllowRotation` / `atlasPadding`) on `ProjectFileV1`+`AppSessionState`, plus optional `phase?: 'resize'|'composite'` on `ExportProgressEvent`, with validator pre-massage + serializer + materializer + 4 round-trip tests — no schema version bump.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-14T17:52Z (approx; Task 1.1 began after worktree setup)
- **Completed:** 2026-05-14T16:59:38Z (UTC)
- **Tasks:** 3 (01.1, 01.2, 01.3)
- **Files modified:** 6

## Accomplishments

- **Schema extension:** `ProjectFileV1` and `AppSessionState` each gained 4 atlas fields with phase-tagged JSDoc and forward-compat defaults that match the legacy byte-stable loose-PNG pipeline.
- **Validator hardening:** 4 new pre-massage blocks reject malformed inputs (`atlasOutputMode: 'rgba'`, `atlasMaxPageSize: 3000`, `atlasAllowRotation: 'yes'`, `atlasPadding: -1`/`17`/`1.5`) with `kind: 'invalid-shape'`.
- **Progress-event discriminator:** `ExportProgressEvent.phase?: 'resize' | 'composite'` lands as an additive optional — existing single-stream consumers unaffected, repack-worker (Plan 40-04) can emit two qualitatively different streams (D-05).
- **Test coverage:** 4 new REPACK-07 tests pass (`atlas defaults` / `atlas round-trip` / `version unchanged` / `type guard`); vitest delta 33 → 37 on `tests/core/project-file.spec.ts`.

## Task Commits

Each task was committed atomically:

1. **Task 01.1: Add 4 atlas fields to ProjectFileV1 + AppSessionState + `phase` to ExportProgressEvent** — `484444a` (feat)
2. **Task 01.2: Pre-massage + serialize + materialize the 4 new atlas fields in project-file.ts** — `8fd9f4f` (feat)
3. **Task 01.3: Add 3+1 REPACK-07 tests to tests/core/project-file.spec.ts** — `58747b7` (test)

_Note: No TDD-style RED→GREEN→REFACTOR split was required — Tasks 01.1 and 01.2 are pure type/validator additions whose verification is grep-based + `tsc --noEmit` (not behavior-driven). Task 01.3 adds the behavioral round-trip tests in a single commit._

## Files Created/Modified

- `src/shared/types.ts` — added 4 fields to `ProjectFileV1` (L1064-1097), mirrored on `AppSessionState` (L1124-1132); added optional `phase?: 'resize' | 'composite'` to `ExportProgressEvent` (L545)
- `src/core/project-file.ts` — added 4 pre-massage blocks to `validateProjectFile` (L226-308); extended `serializeProjectFile` field-output block; extended `materializeProjectFile` return object; extended `PartialMaterialized` interface
- `tests/core/project-file.spec.ts` — added new `describe('Phase 40 — atlas fields (REPACK-07)')` block with 4 tests; updated 14 existing `AppSessionState`/`ProjectFileV1` literals to satisfy the additive required fields
- `src/renderer/src/components/AppShell.tsx` — `buildSessionState` seeds the 4 atlas fields with pre-massage defaults (Rule 3 spillover; Plan 40-02 will wire OptimizeDialog UI state)
- `tests/main/project-io.spec.ts` — `baseState` literal updated with 4 atlas fields (Rule 3 spillover)
- `tests/core/project-file-loader-mode-heal.spec.ts` — `baseFile` literal updated with 4 atlas fields (Rule 3 spillover)

## Decisions Made

- **atlasPadding range [0, 16]** (not [0, 25] like safetyBufferPercent) — sourced from CONTEXT D-01e; locked.
- **Defaults match legacy byte-stable pipeline** — `'loose' / 4096 / false / 2` so any pre-Phase-40 `.stmproj` re-opens without behavioural change.
- **`phase?:` is optional, not required** — D-05 contract: existing single-stream consumers (renderer code that already handles resize-phase events) continue working without code changes.
- **Schema version not bumped** — SEED-008 locked design fact #4 + REPACK-07 acceptance gate. The grep `git diff src/{shared/types.ts,core/project-file.ts} | grep -E "^[+-].*project_format_version"` returns empty.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Downstream literals broken by additive required fields**
- **Found during:** Task 01.1 (after adding required fields to `AppSessionState`/`ProjectFileV1`, `tsc -b --noEmit` revealed 19 compile errors across 5 files; `tsc --noEmit` without `-b` silently masked them due to project references)
- **Issue:** Every existing `AppSessionState` and `ProjectFileV1` literal in the codebase that hadn't been updated for Phase 40 now fails strict type-checking because the new fields are required, not optional.
- **Fix:**
  - `src/renderer/src/components/AppShell.tsx` (`buildSessionState`) — seeded the 4 atlas fields with pre-massage defaults; the real UI-driven values will land in Plan 40-02.
  - `tests/main/project-io.spec.ts` (`baseState`) — added 4 atlas fields.
  - `tests/core/project-file-loader-mode-heal.spec.ts` (`baseFile`) — added 4 atlas fields.
  - `tests/core/project-file.spec.ts` — 14 existing literals updated (folded into Task 01.3's commit since this file is in that task's `files_modified`); 1 inferred-object-literal had `'loose'` widened to `string` and was fixed with `as const`.
- **Files modified:** `AppShell.tsx`, `project-io.spec.ts`, `project-file-loader-mode-heal.spec.ts`, `project-file.spec.ts`
- **Verification:** `npx tsc -b --noEmit` returns only one pre-existing unrelated `TS6133` (see deferred-items.md). `npx vitest run tests/core/project-file.spec.ts` passes 37/37.
- **Committed in:** `484444a` (AppShell + 2 unrelated specs) + `58747b7` (project-file.spec.ts literals folded with the new tests).

**2. [Rule 1 - Bug] Comment originally used token `project_format_version`**
- **Found during:** Task 01.1 verification
- **Issue:** The new JSDoc on `atlasOutputMode` initially contained the literal phrase "No project_format_version bump", which would have broken the acceptance gate "`grep -n "project_format_version" src/shared/types.ts` output is unchanged" — a strict interpretation of the byte-invariance rule.
- **Fix:** Rephrased the comment to "No schema version bump." Identical meaning; preserves the grep-invariance contract.
- **Files modified:** `src/shared/types.ts`
- **Verification:** `grep -n "project_format_version" src/shared/types.ts` returns empty.
- **Committed in:** `484444a`

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking, 1 Rule 1 bug — both immediately observed during Task 1.1 verification).
**Impact on plan:** Both auto-fixes were necessary to satisfy the plan's own acceptance gates (`tsc -b --noEmit` clean across the project; `project_format_version` grep invariant preserved). No scope creep — all touched files are direct downstream consumers of the additive schema fields.

## Issues Encountered

- **None caused by Plan 40-01.** Two pre-existing test failures (`tests/core/sampler-skin-defined-unbound-attachment.spec.ts`, `tests/main/sampler-worker-girl.spec.ts`) and one pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts` were observed in the full test run but verified to exist at base commit `8a586cf` before any 40-01 work. Logged to `deferred-items.md`.

## User Setup Required

None — schema additions are purely internal and forward-compat with legacy `.stmproj` files.

## Next Phase Readiness

- **Plan 40-02 (OptimizeDialog UI state):** ready. `AppSessionState` has all 4 atlas slots; OptimizeDialog can lift them into local state slots that mirror `sharpenOnExportLocal` / `safetyBufferPercentLocal`. The current AppShell `buildSessionState` defaults must be replaced with the local state values once 40-02 lands.
- **Plan 40-03 (IPC dispatch):** ready. The schema fields are wire-ready; `ExportPlan` extension (Plan 40-03's domain) can route through `atlasOutputMode` from `AppSessionState`.
- **Plan 40-04..06 (repack core, worker, atlas-writer):** unblocked at the type-system level — the new `phase?: 'resize' | 'composite'` discriminator on `ExportProgressEvent` is in place for the worker to emit dual-stream progress.

## Self-Check

Verifying claims:

**Files created/modified exist:**
- FOUND: `src/shared/types.ts` (modified)
- FOUND: `src/core/project-file.ts` (modified)
- FOUND: `tests/core/project-file.spec.ts` (modified)
- FOUND: `src/renderer/src/components/AppShell.tsx` (modified)
- FOUND: `tests/main/project-io.spec.ts` (modified)
- FOUND: `tests/core/project-file-loader-mode-heal.spec.ts` (modified)
- FOUND: `.planning/phases/40-atlas-repack-output/40-01-SUMMARY.md` (this file)
- FOUND: `.planning/phases/40-atlas-repack-output/deferred-items.md`

**Commits exist:**
- FOUND: `484444a` (Task 01.1)
- FOUND: `8fd9f4f` (Task 01.2)
- FOUND: `58747b7` (Task 01.3)

## Self-Check: PASSED

---
*Phase: 40-atlas-repack-output*
*Plan: 01*
*Completed: 2026-05-14*
