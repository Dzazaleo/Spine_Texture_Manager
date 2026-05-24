---
phase: 52-batch-export-robustness-variant-dialog-cleanup
plan: 02
subsystem: api
tags: [electron, ipc, input-validation, export, trust-boundary]

# Dependency graph
requires:
  - phase: 51-batch-variant-export
    provides: "variant:export + variant:exportBatch IPC channels; exportOneVariant step-2b safeBuffer canonical clamp (variant-export.ts:135-137)"
provides:
  - "Variant-channel safetyBufferPercent coercion unified to bare Number(...) at both IPC handlers"
  - "Documenting comment recording the deliberate coerce-and-clamp policy (distinct from export:start validate-and-reject) at both variant handlers"
affects: [phase-52-batch-export-robustness, EXPORT-06, variant-export, ipc-trust-boundary]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Trust-boundary coercion policy made explicit: variant channels coerce-and-clamp (single authority in the body) vs export:start validate-and-reject"

key-files:
  created: []
  modified:
    - "src/main/ipc.ts — dropped redundant `|| 0` at both variant handlers + documenting comment"

key-decisions:
  - "D-04: both variant handlers pass Number(safetyBufferPercent) (redundant `|| 0` dropped); single + batch kept byte-parallel"
  - "D-04: variant channels NOT converted to validate-and-reject — the body's Number.isFinite/clamp at variant-export.ts:135-137 is the single authority"
  - "D-09: happy path behavior-preserving — valid finite buffer behaves identically; clamp authority unchanged"

patterns-established:
  - "Pattern: document a deliberate coercion-policy divergence inline at the IPC boundary rather than refactoring to match the sibling channel"

requirements-completed: [EXPORT-06]

# Metrics
duration: 5min
completed: 2026-05-24
---

# Phase 52 Plan 02: Variant-Channel safetyBufferPercent Coercion Unification Summary

**Dropped the redundant `Number(safetyBufferPercent) || 0` at both variant IPC handlers (`variant:export`, `variant:exportBatch`) — passing the bare `Number(...)` and delegating to the single canonical clamp in `exportOneVariant` step 2b, with an inline comment documenting the deliberate coerce-and-clamp policy.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-24T09:18Z (approx)
- **Completed:** 2026-05-24T09:23:42Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Removed the dead/redundant `|| 0` boundary coercion at both variant handlers (`src/main/ipc.ts:1094` single, `:1132` batch) → now pass `Number(safetyBufferPercent)`.
- Added the verbatim D-04 documenting comment at BOTH handlers, recording why the variant channels coerce-and-clamp (single authority = `exportOneVariant` step-2b `Number.isFinite` guard at `variant-export.ts:135-137`) instead of validate-and-reject like `export:start` (`validateExportOpts`).
- Kept single + batch handlers byte-parallel (identical comment + identical bare-coercion form).
- Confirmed no validate-and-reject path was introduced (no `validateVariant*` function; handlers still call `handleExportVariant`/`handleExportVariantBatch` directly).
- Verified happy-path is byte-identical (D-09): the 12/12 faithfulness matrix in `variant-batch-faithful.spec.ts` stays green.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-04 — drop redundant `|| 0` + document coerce-and-clamp at BOTH variant handlers** - `28b2567` (fix)

## Files Created/Modified
- `src/main/ipc.ts` - Dropped `|| 0` at both variant handlers (lines ~1094 single / ~1132 batch); added the D-04 coerce-and-clamp documenting comment at both sites. No other lines touched.

## Decisions Made
None beyond the plan — followed D-04 / D-09 exactly. The documenting comment uses the verbatim CONTEXT/PATTERNS wording (the "coerce-and-clamp … single authority" sentence) plus the optional "redundant `|| 0`" sentence the plan permits.

## Deviations from Plan

None - plan executed exactly as written.

## Verification

All acceptance criteria and the `<verification>` block pass:

- `grep -c "Number(safetyBufferPercent) || 0" src/main/ipc.ts` → **0** (both `|| 0` removed)
- `grep -c "Number(safetyBufferPercent)," src/main/ipc.ts` → **2** (both handlers pass the bare coercion)
- `grep -c "coerce-and-clamp" src/main/ipc.ts` → **2** (documenting comment at both handlers)
- `grep -c "validate-and-reject" src/main/ipc.ts` → **2** (deliberate-divergence reference at both)
- `grep -c "validateVariant" src/main/ipc.ts` → **0** (no reject path added; handlers call `handleExportVariant`/`handleExportVariantBatch` directly)
- `npm run typecheck:node` → **exit 0** (clean)
- `npx vitest run tests/main/variant-batch-faithful.spec.ts` → **12/12 passed** (happy-path byte-identical, D-09)

## Threat Surface

No new threat surface. The change touches the already-documented renderer→main IPC trust boundary (plan threat T-52-03). Dropping the boundary `|| 0` does NOT weaken the boundary: the single canonical clamp in `exportOneVariant` step 2b (`Number.isFinite(x) ? Math.max(0, Math.min(25, Math.trunc(x))) : 0`, `variant-export.ts:135-137`) still coerces NaN/Infinity→0 and clamps to [0,25] before the value reaches `buildExportPlan`. A compromised renderer sending `safetyBufferPercent: 100000` is still clamped to 25; `NaN` is still coerced to 0. No threat flag.

## Known Stubs
None - this change removes a redundant coercion; no stubs, placeholders, or unwired data introduced.

## Issues Encountered
None. Both target lines were byte-identical, so each edit was disambiguated by anchoring on the surrounding unique handler context (`Number(s)` for the single handler; the `scales` `.map(Number).filter` line for the batch handler).

## Next Phase Readiness
- D-04 / WR-04 (SC#3) closed for this plan's scope.
- Other Phase-52 work items (D-01 dup continue-on-error, D-03 orphan-dir cleanup, D-05/D-06/D-07 cleanup, D-08 tests) are handled by sibling plans in this phase's waves.
- No blockers introduced.

## Self-Check: PASSED

- FOUND: `.planning/phases/52-batch-export-robustness-variant-dialog-cleanup/52-02-SUMMARY.md`
- FOUND: `src/main/ipc.ts` (modified)
- FOUND commit: `28b2567`

---
*Phase: 52-batch-export-robustness-variant-dialog-cleanup*
*Completed: 2026-05-24*
