---
phase: 55-variant-export-sizes-to-peak-demand
plan: "01"
subsystem: export
tags: [export, variant, scale, clamp, math]

# Dependency graph
requires:
  - phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
    provides: computeExportDims display read-model (export-view.ts line 244 untouched)
  - phase: 49-variant-export-single-scale
    provides: buildExportPlan + scaleSummaryPeaks unchanged export pipeline
  - phase: 48-core-scale-bake-module-regression-oracle
    provides: scale-bake oracle (tests/scale-bake.spec.ts stays byte-identical)
provides:
  - "BuildExportPlanOptions.variantScale?: number in src/core/export.ts"
  - "1/vs clamp lift in export.ts (line ~285) and export-view.ts (line 435)"
  - "variantScale: s threading in src/main/variant-export.ts"
  - "Phase 55 T1/T2/T3 tests in tests/core/variant-sizing.spec.ts"
  - "Parity test in tests/core/export.spec.ts"
affects:
  - variant-export phases (any future variant sizing work)
  - export-view renderer parity tests

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Universal clamp: const vs = opts.variantScale ?? 1.0; Math.min(..., 1/vs) — no variant-detection branch (D-A/L-02)"

key-files:
  created:
    - .planning/phases/55-variant-export-sizes-to-peak-demand/55-01-SUMMARY.md
  modified:
    - src/core/export.ts
    - src/renderer/src/lib/export-view.ts
    - src/main/variant-export.ts
    - tests/core/variant-sizing.spec.ts
    - tests/core/export.spec.ts

key-decisions:
  - "D-A: Universal 1/vs clamp (no variant detection branch) — variantScale defaults 1.0 so master path is byte-identical by construction"
  - "D-B: Buffer ordering unchanged — raw -> bufferedScale -> safeScale -> clamp(1/vs) -> sourceRatio cap"
  - "D-C: sourceRatio is the tighter ceiling in dimsMismatch case (T3 proves it)"
  - "D-E: Phase 48 oracle (scale-bake.spec.ts) stays byte-identical green — bake untouched"
  - "D-F: extrapolationTooltip() in row-state.ts not touched"
  - "D-UI: ships skip-ui — computeExportDims in export-view.ts line 244 untouched (Phase 54 display read-model)"

patterns-established:
  - "TDD gate: RED (test commit 042005c) then GREEN (feat commit 9f8196c)"
  - "Parity test: both export.ts + export-view.ts must declare variantScale?: number — enforced in export.spec.ts"

requirements-completed:
  - D-A
  - D-B
  - D-C
  - D-D
  - D-E
  - D-F
  - D-UI
  - L-02

# Metrics
duration: 8min
completed: 2026-05-26
---

# Phase 55 Plan 01: Variant Export Sizes to Peak Demand Summary

**Universal `1/vs` clamp lift in `buildExportPlan` — variants at scale `s` now size outputs up to the master-source ceiling (`1/s × canonical`) satisfying peak demand, while master exports remain byte-identical by construction (`1/1.0 = 1`)**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-26T13:04:00Z
- **Completed:** 2026-05-26T13:12:00Z
- **Tasks:** 2 (TDD: RED gate + GREEN gate)
- **Files modified:** 5

## Accomplishments

- Added `variantScale?: number` field to `BuildExportPlanOptions` in both `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` (parity enforced by test)
- Hoisted `const vs = opts.variantScale ?? 1.0` before the for-loop in both files; changed `Math.min(safeScale(bufferedScale), 1)` to `Math.min(safeScale(bufferedScale), 1 / vs)` at the lift site
- Threaded `variantScale: s` into the `buildExportPlan` call in `src/main/variant-export.ts`
- Updated 2 existing tests in `variant-sizing.spec.ts` + added Phase 55 describe block (T1/T2/T3) + parity test in `export.spec.ts`
- Full suite: 1532 passed / 0 new failures (2 pre-existing unrelated failures); both typechecks clean

## Task Commits

1. **Task 1: RED gate** — `042005c` (test: failing tests — 1/s ceiling + variantScale parity)
2. **Task 2: GREEN gate** — `9f8196c` (feat: lift variant effScale clamp to 1/vs)

## Files Created/Modified

- `src/core/export.ts` — `variantScale?: number` in `BuildExportPlanOptions` + `const vs = opts.variantScale ?? 1.0` + `1/vs` clamp at lift site
- `src/renderer/src/lib/export-view.ts` — byte-identical mirror of the above; `computeExportDims` (line 244) untouched
- `src/main/variant-export.ts` — one line added: `variantScale: s` in `buildExportPlan` opts
- `tests/core/variant-sizing.spec.ts` — 2 formula updates + new Phase 55 describe block (T1/T2/T3)
- `tests/core/export.spec.ts` — new parity regex test for `variantScale?: number` in both files

## Decisions Made

- Universal form only: `const vs = opts.variantScale ?? 1.0` — no `if (variantScale !== 1)` branch (D-A/L-02)
- `vs` hoisted at function scope (not per-region) — it is a plan-level option, consistent with `bufferPct` placement
- JSDoc on `variantScale` is identical in both files (parity hygiene)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

Two pre-existing test failures were observed during `npm test` (not caused by this plan):
1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — missing fixture `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`; confirmed pre-existing by stash verification
2. `tests/main/sampler-worker-girl.spec.ts` — wall-time performance budget flap (contended environment); pre-existing

Neither failure is in scope for this plan.

## Known Stubs

None.

## Threat Flags

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced. `variantScale` crosses the IPC boundary in `variant-export.ts` but is already validated at line 96 (`!Number.isFinite(s) || s <= 0 || s >= 1` → `VariantScaleError`). All threats addressed in the plan's `<threat_model>` section (T-55-01 through T-55-04).

## Next Phase Readiness

- Phase 55-01 complete; no open blockers
- Variant exports at scale `s` now request up to `1/s × canonical` pixels from the source PNG, satisfying peak render demand
- Master export paths (no `variantScale` provided) are byte-identical by construction
- `55-VALIDATION.md` updated: `nyquist_compliant: true`, `wave_0_complete: true`

---
*Phase: 55-variant-export-sizes-to-peak-demand*
*Completed: 2026-05-26*
