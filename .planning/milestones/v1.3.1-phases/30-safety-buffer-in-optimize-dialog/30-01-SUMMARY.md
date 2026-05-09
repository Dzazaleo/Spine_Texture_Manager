---
phase: 30-safety-buffer-in-optimize-dialog
plan: 01
subsystem: persistence
tags: [stmproj, ipc, types, persistence, lifecycle, safety-buffer, additive-schema]

# Dependency graph
requires:
  - phase: 28-optional-output-sharpening
    provides: sharpenOnExport plumbing precedent (verbatim mirror across 4 layers)
  - phase: 22.1-isCapped
    provides: ExportRow per-row Boolean flag pattern (parallel for bufferCapped)
provides:
  - "Persistent safetyBufferPercent (integer 0-25) on ProjectFileV1 / AppSessionState / MaterializedProject"
  - "Optional safetyBufferPercent on ResampleArgs"
  - "Optional bufferCapped flag on ExportRow (populated by Plan 30-02)"
  - "AppShell safetyBufferPercentLocal state slot wired into isDirty + lastSaved + buildSessionState + both resample IPC paths"
  - "Validator pre-massage + range check (0-25 integer)"
  - "6 round-trip / forward-compat / schema-version golden tests"
affects: [Phase 30-02 export math, Phase 30-03 OptimizeDialog UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 28 four-layer plumbing mirror (types → validator/serializer/materializer → IPC envelope → AppShell lifecycle)"
    - "Defensive integer-and-range coerce at IPC boundaries (typeof number + Number.isInteger + 0..25)"
    - "Conditional spread on optional ExportRow flag (mirrors isCapped)"
    - "Resample post-completion narrow callback: { ...prev, samplingHz: samplingHzLocal } unchanged (Phase 28 precedent — buffer rides through ...prev)"

key-files:
  created:
    - .planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md
  modified:
    - src/shared/types.ts
    - src/core/project-file.ts
    - src/main/project-io.ts
    - src/renderer/src/components/AppShell.tsx
    - tests/core/project-file.spec.ts
    - tests/main/project-io.spec.ts

key-decisions:
  - "Apply Phase 28 sharpenOnExport plumbing as a verbatim mirror — only field-name + value-type swap (boolean → integer 0-25)"
  - "Validator pre-massage: missing field → 0; reject non-integer / out-of-range / non-numeric with 'invalid-shape' message mentioning safetyBufferPercent (D-03 + D-04)"
  - "Schema version stays at 1 — no bump for additive optional field (Phase 8 D-148 lock; reaffirmed by Phase 21 + Phase 28)"
  - "Both resample IPC payload sites thread safetyBufferPercent (runReload at line ~1008 + samplingHz-effect at line ~1430) — symmetric with Phase 28 sharpenOnExport"
  - "Resample post-completion narrow callbacks at lines 1012-1014 + 1443-1445 left byte-unchanged (samplingHz-only update; buffer rides through `{ ...prev }` spread)"
  - "ExportRow.bufferCapped declared optional + not populated in this plan; Plan 30-02 sets it via conditional spread"
  - "Field-name collision warning: Documentation.safetyBufferPercent (range 0-100, doc-builder metadata) is structurally distinct from the new project-root safetyBufferPercent (range 0-25, export math). Treated as independent fields"

patterns-established:
  - "Verbatim Phase 28 mirror: copy each layer's sharpenOnExport site and swap field name + value type"
  - "Defensive integer-and-range IPC coerce: typeof === 'number' && Number.isInteger && >= 0 && <= 25 → use ; else 0"

requirements-completed: [BUFFER-03]

# Metrics
duration: ~35min
completed: 2026-05-08
---

# Phase 30 Plan 01: Persistence Plumbing for safetyBufferPercent Summary

**Wired the project-level safety-buffer field end-to-end through the 4 plumbing layers (types → .stmproj validator/serializer/materializer → main IPC envelope → AppShell lifecycle), matching the Phase 28 sharpenOnExport precedent verbatim, with no behavioural change yet — Plan 30-02 inserts the export math and Plan 30-03 ships the UI.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-08T09:30Z (estimated)
- **Completed:** 2026-05-08T10:03:53Z
- **Tasks:** 5/5
- **Files modified:** 6 source + 1 doc (deferred-items.md)

## Accomplishments

- `safetyBufferPercent: number` (REQUIRED, integer 0-25) added to ProjectFileV1, AppSessionState, MaterializedProject; OPTIONAL on ResampleArgs.
- `bufferCapped?: boolean` declared on ExportRow (parallel to isCapped); populated by Plan 30-02.
- Validator pre-massages missing → 0 and rejects 5 distinct invalid shapes with `invalid-shape` error mentioning `safetyBufferPercent`.
- Round-trip identity proven: legacy v1.2/v1.3-era files load with buffer=0; freshly-saved files with buffer=5 reload as 5; double-save is byte-identical with `"safetyBufferPercent":5`.
- AppShell `safetyBufferPercentLocal` state slot is hydrated on Open, persisted on Save / Save-As, threaded through both resample IPC sites, fires `isDirty` on divergence from `lastSaved`, and is preserved across resample by the `{ ...prev, samplingHz }` callback (Phase 28 precedent).
- Schema version unchanged at `1` — additive-only per Phase 8 D-148.

## Task Commits

Each task was committed atomically:

1. **Task 1: Declare safetyBufferPercent + bufferCapped in shared/types.ts** - `73bb11e` (feat)
2. **Task 2: Three-touch persistence in core/project-file.ts** - `e7cf386` (feat)
3. **Task 3: Thread safetyBufferPercent through main IPC envelope** - `14084c3` (feat)
4. **Task 4: Wire safetyBufferPercentLocal lifecycle in AppShell** - `7f19682` (feat)
5. **Task 5: Add Phase 30 safetyBufferPercent round-trip tests** - `8569ae7` (test)

## Files Created/Modified

### Modified

- `src/shared/types.ts` (+42 lines): 5 type touches — ExportRow.bufferCapped (optional), ProjectFileV1 / AppSessionState / MaterializedProject (required), ResampleArgs (optional).
- `src/core/project-file.ts` (+34 lines): validator pre-massage + integer-range check (lines after sharpenOnExport block); serializer always-write; PartialMaterialized declaration; materializer `?? 0` fallback.
- `src/main/project-io.ts` (+30 lines): Open envelope direct pass-through; recovery-path defensive coerce + use; resample-path inline coerce. Loader call sites untouched.
- `src/renderer/src/components/AppShell.tsx` (+33 lines): state slot, lastSaved shape extension, isDirty memo + dep, buildSessionState + dep, mountOpenResponse seed + setter, BOTH resample IPC sites + runReload dep, Save / Save-As setLastSaved sites. Resample post-completion narrow callbacks at 1012-1014 + 1443-1445 byte-unchanged.
- `tests/core/project-file.spec.ts` (+149 lines): new `describe('Phase 30 — safetyBufferPercent (BUFFER-03)')` block with 6 tests; backfilled `safetyBufferPercent: 0` to 9 existing AppSessionState/ProjectFileV1 fixtures (Rule 3 fix — required field).
- `tests/main/project-io.spec.ts` (+3 lines): `safetyBufferPercent: 0` on baseState fixture (Rule 3 fix).

### Created

- `.planning/phases/30-safety-buffer-in-optimize-dialog/deferred-items.md`: documents pre-existing tsc errors and 2 pre-existing test failures confirmed unrelated to Phase 30.

## New Types / Field Counts

- 5 type touches in shared/types.ts:
  - `ExportRow.bufferCapped?: boolean` (1)
  - `ProjectFileV1.safetyBufferPercent: number` (1)
  - `AppSessionState.safetyBufferPercent: number` (1)
  - `MaterializedProject.safetyBufferPercent: number` (1)
  - `ResampleArgs.safetyBufferPercent?: number` (1)
- 3 IPC threading sites in src/main/project-io.ts:
  - Open path (`materialized.safetyBufferPercent`)
  - Recovery path (defensive integer-range coerce + use)
  - Resample path (inline integer-range coerce)
- AppShell touches (8 textual references): state slot, isDirty compare + dep, mountOpenResponse seed + hydrator, lastSaved shape + initial seed, buildSessionState ref + dep, runReload IPC payload + dep, samplingHz-effect IPC payload, Save / Save-As `setLastSaved` extensions.

## Test counts

- Before: 25 tests in tests/core/project-file.spec.ts; 1 pre-existing skin-defined-attachment failure + 1 pre-existing fixtures/Girl wall-time failure in the global suite.
- After: 31 tests in tests/core/project-file.spec.ts (+6 Phase 30 tests, 6/6 pass); 878 passing + 1 failing + 1 failed file in the global suite — same delta as baseline (zero new regressions; 2 pre-existing failures still present, documented in deferred-items.md).

## Layer 3 hygiene verification

```
$ grep -rn "from 'sharp'" src/core/
0 matches
$ grep -rn "from 'electron'" src/core/
0 matches
```

Layer 3 invariant preserved — no new imports of any kind in src/core/project-file.ts.

## Resample-callback byte-stability confirmation

```
$ grep -c "samplingHz: samplingHzLocal }" src/renderer/src/components/AppShell.tsx
2
```

Both `setLastSaved((prev) => prev !== null ? { ...prev, samplingHz: samplingHzLocal } : prev)` callbacks at lines 1012-1014 and 1443-1445 are byte-unchanged from pre-Phase-30. The buffer (and sharpen) field rides through `...prev` unchanged, matching the Phase 28 precedent: resample-completion callbacks update samplingHz only; persistence-tier fields are updated by Save / Save-As / Open.

## Schema version invariant

```
$ grep "version: 1" src/shared/types.ts
  version: 1;
$ grep -c "version: 2\|version: '1.1'" src/shared/types.ts
0
```

No schema bump for additive optional field — Phase 8 D-148 lock honored.

## Forward consumption (Plan 30-02 + Plan 30-03 prerequisites)

This plan establishes the persistence + lifecycle prereq for the next two plans:

- **Plan 30-02 (export math)** can now declare `BuildExportPlanOptions.safetyBufferPercent?: number`, consume it inside `buildExportPlan` (between `rawEffScale` and `downscaleClampedScale`), and populate `ExportRow.bufferCapped` via the conditional-spread pattern. The shared/types.ts surface is already in place.
- **Plan 30-03 (UI)** can now wire OptimizeDialog props `safetyBufferPercent: number` + `onSafetyBufferChange: (n: number) => void` in AppShell — the `safetyBufferPercentLocal` state slot and its setter exist and the `isDirty` integration is live; only the JSX prop pair and the dialog's controlled input remain.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] Pre-existing AppSessionState/ProjectFileV1 fixtures missing required field**
- **Found during:** Task 5 (running tsc on tsconfig.node.json after type changes)
- **Issue:** The new REQUIRED `safetyBufferPercent: number` field on AppSessionState / ProjectFileV1 broke 9 existing test fixtures in `tests/core/project-file.spec.ts` and 1 fixture in `tests/main/project-io.spec.ts` (TS2741 errors). Plan Task 5 only described adding the new describe block; it did not enumerate this propagation cost.
- **Fix:** Added `safetyBufferPercent: 0` to every existing fixture immediately after the matching `sharpenOnExport: ...` line (10 fixtures total). All existing tests still pass; 6 new Phase 30 tests added on top.
- **Files modified:** `tests/core/project-file.spec.ts`, `tests/main/project-io.spec.ts`
- **Commit:** `8569ae7`

**2. [Rule 2 — Missing critical functionality] Both resample IPC payload sites must thread the buffer**
- **Found during:** Task 4 (grep audit of `sharpenOnExport: sharpenOnExportLocal` showed TWO sites: line 1008 in `runReload` + line 1430 in samplingHz-effect resample). Plan Task 4 wording cited only "the resample IPC payload at ~line 1407".
- **Issue:** If only the samplingHz-effect site threaded `safetyBufferPercent`, the runReload (Reload Project) path would silently drop the user's buffer to 0 across resample.
- **Fix:** Threaded `safetyBufferPercent: safetyBufferPercentLocal` at BOTH sites — symmetric with Phase 28 sharpenOnExport. Added `safetyBufferPercentLocal` to runReload's deps array; left the samplingHz-effect's intentionally-narrow `[samplingHzLocal, loaderMode]` deps unchanged (per existing eslint-disable convention).
- **Files modified:** `src/renderer/src/components/AppShell.tsx`
- **Commit:** `7f19682`

### Out-of-scope discoveries (not fixed; logged to deferred-items.md)

- Pre-existing tsc errors in `tests/core/analyzer.spec.ts`, `tests/core/documentation.spec.ts`, `tests/core/project-file-loader-mode-heal.spec.ts` (unrelated subsystems; predate Phase 30).
- Pre-existing test failures in `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (missing fixture file) and `tests/main/sampler-worker-girl.spec.ts` (warm-up worker error). Verified pre-existing by stashing all Phase 30 edits and re-running the failing tests against the base commit.

## Self-Check: PASSED

- All 5 task commits exist on the worktree branch.
- All 6 modified source/test files contain expected `safetyBufferPercent` references.
- All acceptance criteria pass (with one regex caveat documented inline — multi-line state-slot literal verified via perl).
- All 31 project-file.spec.ts tests pass (25 prior + 6 new).
- Layer 3 invariant preserved (0 sharp/electron imports in src/core/).
- Schema version stays at `1`.
- Resample-completion callbacks byte-unchanged (still exactly 2 `samplingHz: samplingHzLocal }` literals).
- No new tsc errors introduced (errors limited to 3 pre-existing unrelated test files).
- No new test failures introduced (2 pre-existing failures predate Phase 30).
