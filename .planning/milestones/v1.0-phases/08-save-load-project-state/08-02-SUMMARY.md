---
phase: 08-save-load-project-state
plan: 02
subsystem: pure-ts-project-file-schema-module
tags: [phase-8, wave-2, core, project-file, validator, migration, path-helpers, layer-3]
dependency_graph:
  requires:
    - "src/shared/types.ts (ProjectFileV1 / AppSessionState / SkeletonSummary — Plan 01)"
    - "tests/core/project-file.spec.ts (Plan 01 RED stubs — drives every export)"
    - "src/core/overrides.ts (module-shape analog — header docblock + zero-import discipline)"
    - "src/main/ipc.ts:92-112 validateExportPlan (validator idiom)"
    - "tests/arch.spec.ts (Phase 8 Layer 3 block from Plan 01 — graceful-skip activates here)"
  provides:
    - "src/core/project-file.ts (pure-TS schema validator + migration + serialize/materialize + path helpers)"
    - "validateProjectFile (discriminated envelope with kinds invalid-shape | unknown-version | newer-version)"
    - "migrate (forward-only ladder; v1 passthrough)"
    - "serializeProjectFile (AppSessionState + path → ProjectFileV1; relativizes paths)"
    - "materializeProjectFile (ProjectFileV1 + path → PartialMaterialized; absolutizes paths)"
    - "PartialMaterialized type (Plan 03 enriches with summary + staleOverrideKeys)"
    - "relativizePath / absolutizePath (Pitfall 4 cross-volume codified)"
  affects:
    - "Plan 03 (Wave 3 — main/project-io.ts consumes serialize/validate/migrate/materialize chain)"
    - "Plan 04 (Wave 4 — renderer flattens overrides Map → Record before saveProject IPC)"
tech_stack:
  added: []
  patterns:
    - "Hand-rolled validator (D-156 — mirrors validateExportPlan)"
    - "Discriminated envelope for validation result (mirrors LoadResponse / SaveResponse pattern)"
    - "Forward-only migration ladder (Pattern 5; switch on version, throws on unsupported)"
    - "Cross-volume root-difference detection for relativizePath (Pitfall 4)"
    - "Layer 3 invariant — only node:path + type imports allowed"
    - "Reserved-slot pattern (`documentation: object`) for forward-compat (D-148)"
key_files:
  created:
    - "src/core/project-file.ts (386 lines, 6 exports + V_LATEST + ValidateResult + PartialMaterialized)"
  modified:
    - "tests/core/project-file.spec.ts (1 line — Rule 3 optional-chain on summary access)"
decisions:
  - "PartialMaterialized declares `summary` as OPTIONAL — kept the Layer 3 pure-TS invariant (no I/O for SkeletonSummary). Plan 03 fills `summary` after running the loader + sampler. Trade-off: Plan 01's shape-lock test had to switch from `back.summary.skeletonPath` to `back.summary?.skeletonPath` (Rule 3 - Blocking deviation, see below)."
  - "PartialMaterialized DOES carry `projectFilePath` — pure-TS can fill it from the input arg, and AppShell needs it to persist `currentProjectPath` without re-threading the arg through the IPC envelope."
  - "validateProjectFile gates 'newer-version' BEFORE any field interpretation (D-151) — prevents reading fields whose meaning may have changed in v2."
  - "overrides values rejected on `Number.isFinite` failure — JSON.stringify silently emits `null` for NaN/Infinity, which would round-trip-corrupt the data; defensive check at the boundary."
  - "documentation slot validated as opaque `object` (any non-array, non-null object passes) per D-148 — non-empty docs survive validate→materialize untouched."
metrics:
  completed_date: "2026-04-26"
  tasks_completed: 1
  files_created: 1
  files_modified: 1
  commits: 1
  test_count_delta:
    before_pass: 246
    before_fail: 2
    before_test_files_failed: 3
    after_pass: 259
    after_fail: 2
    after_test_files_failed: 2
    net_pass_delta: 13
    net_fail_delta: 0
---

# Phase 8 Plan 02: Pure-TS Project-File Schema Module Summary

**One-liner:** `src/core/project-file.ts` shipped as a pure-TS Layer-3 module — hand-rolled validator (D-156) with discriminated envelope, forward-only migration ladder (D-151 newer-version gate), serialize/materialize round-trip with cross-volume-aware path helpers (Pitfall 4); all 12 Plan 01 RED specs in `tests/core/project-file.spec.ts` flipped GREEN and the Phase 8 arch.spec hygiene block now activates.

## Files Created / Modified

### Created (1)

| File                       | LOC | Purpose                                                                                                                       |
| -------------------------- | --- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/core/project-file.ts` | 386 | Pure-TS module — 6 exports + `V_LATEST` + `ValidateResult` envelope + `PartialMaterialized` type. No fs / electron / sharp / DOM. |

### Modified (1)

| File                              | Change | Purpose                                                                                                                          |
| --------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `tests/core/project-file.spec.ts` | 1 line | Rule 3 — `back.summary.skeletonPath` → `back.summary?.skeletonPath`. `summary` is optional on PartialMaterialized (Plan 03 fills). |

## Six Exports

| Symbol                   | Type                          | One-line doc                                                                                                                                              |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `validateProjectFile`    | `(unknown) → ValidateResult`  | Hand-rolled type guard with discriminated envelope; gates 'newer-version' before field interpretation (D-151); finite-number guard on overrides values.   |
| `migrate`                | `(ProjectFile) → ProjectFileV1` | Forward-only ladder; v1 passthrough (reference equality preserved). Throws on unsupported version (caller must validate first).                          |
| `serializeProjectFile`   | `(AppSessionState, string) → ProjectFileV1` | Folds session state + dest path into v1 shape; relativizes path fields; stamps `documentation: {}` (D-148); shallow-clones overrides Record.            |
| `materializeProjectFile` | `(ProjectFileV1, string) → PartialMaterialized` | Inverse of serialize; absolutizes paths; defaults samplingHz to 120 (D-146); leaves `summary` undefined (Plan 03 fills after I/O); fills `projectFilePath`. |
| `relativizePath`         | `(string, string) → string`   | D-155 + Pitfall 4. Returns relative when same volume; falls back to absolute when `path.relative` returns absolute OR roots differ (cross-volume).        |
| `absolutizePath`         | `(string, string) → string`   | Inverse of relativizePath. Absolute input → verbatim. Relative input → `path.resolve(basedir, stored)`.                                                  |

Ancillary types exported alongside: `ValidateResult`, `PartialMaterialized`. Constant: `V_LATEST = 1` (private, but ladder is keyed off it).

## Test Names — RED → GREEN (12 cases, all match Plan 01 VALIDATION.md selectors)

### tests/core/project-file.spec.ts (12/12 GREEN)

- `validator rejects non-object input` — null, 42, 'foo' all rejected with kind 'invalid-shape'
- `validator rejects missing version` — `{skeletonPath, overrides, documentation}` (no version) → 'invalid-shape'
- `validator rejects missing skeletonPath` — `{version: 1, overrides, documentation}` → 'invalid-shape'
- `validator rejects wrong-type overrides` — `{overrides: {CIRCLE: 'not-a-number'}}` → 'invalid-shape'
- `validator accepts minimal v1 file` — required+optional-null fields → ok:true
- `validator accepts full v1 file` — every field populated → ok:true
- `newer version rejected (D-151)` — `version: 2` → 'newer-version' kind
- `round-trip preserves all D-145 fields` — serialize→materialize round-trip on a fully-populated state
- `documentation slot preserved on round-trip (D-148)` — empty doc + non-empty doc both survive validate
- `round-trip relative paths (D-155)` — same-dir skeletonPath stored relative; absolutizePath restores
- `cross-volume falls back to absolute (D-155 + Pitfall 4)` — relativizePath round-trip to /Volumes/Other restores identical absolute
- `migrate is identity on v1` — `migrate(file) === file` (reference equality)

### tests/arch.spec.ts (Phase 8 Layer 3 block now ACTIVATES)

- `src/core/project-file.ts does not import from electron` — file now exists; grep runs and confirms clean

### tests/core/project-file.spec.ts hygiene block (also GREEN)

- `does not import node:fs / node:fs/promises / sharp / electron` (T-08-LAYER) — readFileSync of CORE_SRC + 4 not.toMatch assertions all pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] PartialMaterialized must carry `projectFilePath` + optional `summary` to satisfy the Plan 01 shape-lock test**

- **Found during:** Task 1 verification (`npx tsc --noEmit -p tsconfig.node.json`)
- **Issue:** Plan 01 RED test at `tests/core/project-file.spec.ts:140` reads `back.summary.skeletonPath ?? back.projectFilePath` as a "shape lock — see Plan 02" assertion. The Plan 02 spec (lines 311-346) defined a `PartialMaterialized` shape that omits BOTH fields, which made the test fail TS2339 ("Property 'summary' / 'projectFilePath' does not exist"). Without one of:
    - adding the slots to the type, or
    - rewriting the test
  the GREEN gate cannot land.
- **Fix:** Two-part — (a) extended `PartialMaterialized` with `projectFilePath: string` (always present; pure-TS fills from input arg) and `summary?: SkeletonSummary` (optional; Plan 03 fills after running loader + sampler); (b) updated the test from `back.summary.skeletonPath` to `back.summary?.skeletonPath` (optional chain) — the test's intent ("one of these two fields is reachable via `??`") is preserved, while the strict-null-checks invariant stays intact. Documented in the type's docblock that Plan 03 fills `summary`.
- **Files modified:** `src/core/project-file.ts` (extended PartialMaterialized + materializeProjectFile populates projectFilePath); `tests/core/project-file.spec.ts` (1 character — added `?` to optional-chain).
- **Commit:** `b38258e` (folded into Task 1's commit)

## Acceptance Criteria Status

### Task 1 (`src/core/project-file.ts`) — 18/18 pass

| Check                                                                  | Status                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------- |
| File exists ≥ 150 lines                                                | 386 lines                                         |
| `validateProjectFile` exported                                         | 1                                                 |
| `migrate` exported                                                     | 1                                                 |
| `serializeProjectFile` exported                                        | 1                                                 |
| `materializeProjectFile` exported                                      | 1                                                 |
| `relativizePath` exported                                              | 1                                                 |
| `absolutizePath` exported                                              | 1                                                 |
| `newer-version` mention                                                | 6 (D-151 well-anchored)                           |
| `documentation` mention                                                | 9 (D-148 well-anchored)                           |
| `from 'node:fs(/promises)?'` import                                    | 0 (Layer 3)                                       |
| `from 'sharp'` import                                                  | 0 (Layer 3)                                       |
| `from 'electron'` import                                               | 0 (Layer 3 — Plan 01 arch block)                 |
| `from 'node:path'` import                                              | 1 (only allowed Node import)                      |
| vitest project-file.spec.ts                                            | 12/12 GREEN                                       |
| vitest arch.spec.ts (full)                                             | 11/11 GREEN incl. activated Phase 8 block         |
| `npx tsc --noEmit -p tsconfig.web.json`                                | exit 0 clean                                      |
| `npx tsc --noEmit -p tsconfig.node.json`                               | exit 0; only pre-existing scripts/probe-per-anim.ts TS2339 + expected Plan 03 RED TS2307 |
| `git diff --exit-code scripts/cli.ts` AND `src/core/sampler.ts`        | both empty (locks preserved)                      |

## Pre-existing Typecheck Warnings (Noted but Not Regressed)

- `scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.` — deferred per `.planning/phases/04-scale-overrides/deferred-items.md` and `.planning/phases/07-atlas-preview-modal/deferred-items.md`. Out of scope for Phase 8.
- `tests/main/project-io.spec.ts(14,8): error TS2307: Cannot find module '../../src/main/project-io.js'` — expected RED; Plan 03 lands the module (per Plan 01 SUMMARY).

## Locked Files (Byte-Identical Confirmation)

- `git diff --exit-code scripts/cli.ts` → empty (Phase 5 D-102 lock preserved)
- `git diff --exit-code src/core/sampler.ts` → empty (CLAUDE.md rule #3 lock preserved)

## Test Counts

| Suite              | Before (Plan 01 baseline) | After (this plan) | Delta                                                                                                  |
| ------------------ | ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------ |
| Total tests pass   | 246                       | 259               | **+13** (12 project-file.spec.ts cases activated + 1 arch.spec Phase 8 block fully evaluated)         |
| Total tests skipped | 1                         | 1                 | 0                                                                                                      |
| Total tests todo    | 1                         | 1                 | 0                                                                                                      |
| Total tests failed | 2                         | 2                 | 0 (same Plan 04 RED — Save button + Cmd+S; project-io still RED in suite-fail mode)                  |
| Test files failed  | 3                         | 2                 | **−1** (project-file.spec.ts went from RED suite-fail to all-GREEN)                                   |

**Existing green count not regressed.** All 246 prior tests still pass; +13 new GREEN tests added.

## Build Verification

- `npx tsc --noEmit -p tsconfig.web.json` → **exit 0** (clean)
- `npx tsc --noEmit -p tsconfig.node.json` → **exit 0** with only the pre-existing scripts/probe-per-anim.ts TS2339 + expected Plan 03 RED TS2307
- `npx electron-vite build` → **exit 0** (renderer 671 KB JS + 23.48 KB CSS — pure-TS schema lib does not affect renderer output; main bundle 41.86 KB unchanged in shape)

## Commit

| Hash      | Subject                                                                                       |
| --------- | --------------------------------------------------------------------------------------------- |
| `b38258e` | feat(08-02): implement src/core/project-file.ts (validator + migration + path helpers)       |

## Self-Check: PASSED

Commit exists:

- `b38258e` confirmed by `git log --oneline | grep b38258e`

Created file exists:

- `src/core/project-file.ts` confirmed by `ls -1 src/core/`

Modified file confirmed in commit:

- `tests/core/project-file.spec.ts` 1-line diff (`back.summary.skeletonPath` → `back.summary?.skeletonPath`)

Locked files unchanged:

- `git diff --exit-code scripts/cli.ts` → exit 0
- `git diff --exit-code src/core/sampler.ts` → exit 0

All 12 Plan 01 RED specs for project-file.spec.ts now GREEN; Phase 8 arch.spec block activated and passes.
