---
phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
plan: 01
subsystem: ui
tags: [react, renderer, read-model, variant-export, peak-demand, tooltip, vitest]

# Dependency graph
requires:
  - phase: 49-single-scale-variant-export
    provides: the variant export pipeline (source-based geometry × s + peak-based PNGs) whose dimension disagreement produced the phantom green on reopen
  - phase: 48-core-scale-bake-module-regression-oracle
    provides: scale-bake.ts (source-based variant geometry — the ×s side of the mismatch)
provides:
  - "computeExportDims now returns peakDemandW/H = min(ceil(canonicalW × safeScale(peakScale × overrideFrac)), actualSource) — the TRUE render demand for DISPLAY (export dims byte-unchanged)"
  - "pure rowState/RowState extracted to src/renderer/src/lib/row-state.ts (node-included, Layer-3) — importable by node-program specs"
  - "Global Max panel Peak cell + both tint call sites consume peakDemandW (D-01/D-03); savings chip rebased onto per-row render demand (chip ≡ Σ rows)"
  - "ExtrapolationIcon tooltip reworded to 'Spine rig peak: {x}× source' across both panels + icon docblock + the tooltip spec"
affects: [variant-export, read-model-display, doc-export-space-savings-card]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Display render-demand vs export-dim split: peakDemandW/H (display, no ≤1 clamp) lives alongside peakDisplayW/H (export-dim, retained); export path FROZEN"
    - "Pure-helper extraction to lib/*.ts so a node-program .spec.ts can import a former panel-local predicate (TS6307 avoidance)"
    - "Coupled-string single-source reword: one tooltip template applied byte-identically across both panels + icon docblock + every spec assertion"

key-files:
  created:
    - src/renderer/src/lib/row-state.ts
    - tests/regression/variant-phantom-green.spec.ts
  modified:
    - src/renderer/src/lib/export-view.ts
    - src/renderer/src/lib/enrich-overrides.ts
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx
    - src/renderer/src/components/icons/ExtrapolationIcon.tsx
    - src/renderer/src/components/AppShell.tsx
    - tests/renderer/extrapolation-icon-tooltip.spec.tsx

key-decisions:
  - "D-01: Peak cell shows min(canonical × peakScale, actualSource) — drop ONLY the ≤1.0 canonical clamp, keep safeScale (Pitfall 1); reopened peakScale>1 variant reads Peak == Source ⇒ no phantom green"
  - "D-02: math is universal (no variant detection); master peakScale<1 + NECK-repack drift rows are display-unchanged (peakDemand === peakDisplay) and keep their correct green"
  - "D-03: rowState compares the two displayed integers with a pure integer compare, no epsilon; equal => atLimit (yellow), strictly-smaller Peak => under (green)"
  - "savingsPctMemo rebased onto enrichWithEffective per-row peakDemand (chip ≡ Σ rows); INTENTIONALLY diverges from OptimizeDialog's export-plan % (documented)"
  - "Tooltip copy 'Spine rig peak: {x}× source' chosen ONCE; applied byte-identically to both panels + icon docblock + spec (sibling-symmetry; old '— export capped at canonical' gone everywhere)"
  - "doc-export Space Savings card: value source unchanged (savingsPctMemo); ACCEPTED AS-IS under existing Space Savings/Estimated Reduction labels"

patterns-established:
  - "Display-only read-model fix: change what the panel renders + tints + sums without touching any exported byte (buildExportPlan/outW/outH FROZEN; src/core/ untouched)"
  - "Synthetic-row regression spec (no committed fixture ⇒ no SAFE-01 denylist change) importing only src/renderer/src/lib/** + src/shared as a node-program .spec.ts"

requirements-completed: [D-01, D-02, D-03]

# Metrics
duration: 8min
completed: 2026-05-25
---

# Phase 54 Plan 01: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) Summary

**Killed the false-positive green "savings" readout on reopened peakScale>1 variants by adding a display-only render-demand pair (peakDemandW/H = min(canonical × peakScale, actualSource)) to computeExportDims, wiring the Peak cell + tint + savings chip onto it, and rewording the now-misleading extrapolation tooltip — with zero exported-byte change and src/core/ untouched.**

## Performance

- **Duration:** ~8 min (commits 17:37 → 17:42 BST)
- **Started:** 2026-05-25T17:36:00Z (approx)
- **Completed:** 2026-05-25T17:42:00Z (approx)
- **Tasks:** 3 (TDD: test → feat → feat)
- **Files modified:** 9 (2 created, 7 modified) — +410 / −90

## Accomplishments
- **D-01 root-cause fix:** `computeExportDims` now returns `peakDemandW/H = min(Math.ceil(canonW × safeScale(rawPeakEff)), actualSource)` where `actualSrc = actualSourceW ?? canonW`. It differs from the retained `peakDisplayW/H` ONLY by removing the premature `min(…, 1)` canonical clamp — the exact operation that discarded the `peakScale>1` signal and produced the phantom green. For a reopened GRAND variant (canon 208.5, peakScale 1.182, actualSource 247) the Peak cell now reads `247×75` == Source ⇒ at-limit (yellow), not green.
- **D-02 universality:** no "is this a variant" detection. Master `peakScale<1` rows and NECK-repack drift rows are display-unchanged (`peakDemand === peakDisplay`, fuzz-proven) and keep their correct green — locked by spec cases R2/R2b/R3.
- **D-03 honest tint:** `rowState` (extracted to `lib/row-state.ts`) compares the two rendered integers (`row.peakDemandW` vs `row.actualSourceW ?? row.sourceW`) with a pure integer compare, no epsilon; equal integers => `atLimit`.
- **Chip ≡ rows:** `savingsPctMemo` rebased onto `enrichWithEffective` per-row render demand so the section chip is Σ per-row states by construction; for a reopened variant the chip drops from the phantom % to the genuine rounding residual.
- **Coupled tooltip reword:** picked `Spine rig peak: ${row.peakScale.toFixed(2)}× source` ONCE and applied it byte-identically to both panels + the icon docblock + every assertion in the existing jsdom tooltip spec — that spec stays GREEN (9/9) under the new copy and the old "— export capped at canonical" string is gone everywhere (0 occurrences across `src/renderer` + `tests/renderer`).
- **No export leak:** the export path is byte-identical (no `outW/outH/effScale/buildExportPlan` code line changed); `tests/core/export.spec.ts` green; `src/core/` untouched across the whole phase (Layer-3 pure; `tests/arch.spec.ts` green).

## Task Commits

TDD plan — RED then GREEN gates:

1. **Task 1 (Wave 0): extract rowState + author failing synthetic-row spec** — `fa4d620` (test) — RED gate (peakDemand assertions fail at runtime; typecheck green)
2. **Task 2: compute peakDemandW/H in computeExportDims + thread through enrich-overrides** — `8719e0b` (feat) — GREEN gate (D-01/drift/regression pass; export.spec byte-parity holds)
3. **Task 3: wire Peak cell + tint + savings chip + reword coupled tooltip** — `92f8f62` (feat) — full spec + tooltip spec green

**Plan metadata:** committed by the metadata step (SUMMARY + deferred-items).

## Files Created/Modified
- `src/renderer/src/lib/row-state.ts` (created) — pure `RowState` + `rowState` extracted verbatim; zero React/DOM/math-tree imports; node-included so the spec can import it
- `tests/regression/variant-phantom-green.spec.ts` (created) — synthetic-row suite locking R1–R8 (R2 split into R2/R2b) + chip≡rows + the D-03 tint unit; node-program `.spec.ts` importing only `src/renderer/src/lib/**` + `src/shared` (no fixture ⇒ no SAFE-01 change)
- `src/renderer/src/lib/export-view.ts` — `computeExportDims` return type + the `peakDemandW/H` math block; stale Peak-display docblock updated; export-dim math byte-unchanged
- `src/renderer/src/lib/enrich-overrides.ts` — `EnrichedRow` carries `peakDemandW/H`; destructure + spread thread them; stale docblock updated
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — local `rowState` deleted + imported; Peak cell + both call sites use `row.peakDemandW`; tooltip reworded
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — tooltip-copy ONLY (Peak cell + rowState deliberately unchanged — D-01/D-03 out of scope per CONTEXT)
- `src/renderer/src/components/icons/ExtrapolationIcon.tsx` — docblock prose updated to match the new copy (no mechanism change)
- `src/renderer/src/components/AppShell.tsx` — `enrichWithEffective` imported; `savingsPctMemo` rebased onto per-row render demand; intentional-divergence comment added (`buildExportPlan` import retained for the 3 remaining export call sites)
- `tests/renderer/extrapolation-icon-tooltip.spec.tsx` — rendered-text (2) + source-walk (2) + docblock assertions moved to the new copy; mechanism assertions untouched

## Decisions Made
- **doc-export "Space Savings" card disposition: ACCEPTED AS-IS.** The card reads `payload.exportPlanSavingsPct` (still `savingsPctMemo`, just rebased onto render demand). Labels are "Space Savings" / "Estimated Reduction"; the rebased figure ("pixels exceeding render demand") reads correctly under them — for healthy non-variant rigs it is essentially identical to before (peakScale≤1 rows are byte-identical), and for a reopened variant it now correctly reads ~0 rather than a misleading %. No label change, no value-source change, no second memo.
- **Tooltip copy chosen once:** `Spine rig peak: ${row.peakScale.toFixed(2)}× source` — neutral, accurate for both the demand-rebased global panel and the still-export-clamped breakdown panel.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Landed the peakDemandW/H type declaration + a Wave-0 runtime stub in Task 1 (not only Task 2)**
- **Found during:** Task 1 (authoring the RED spec)
- **Issue:** Task 1's two acceptance criteria are jointly satisfiable only if the new spec COMPILES (`typecheck:node`/`:web` exit 0) while being a RUNTIME RED (`vitest` exits non-zero). Reading `peakDemandW` off `computeExportDims`/`EnrichedRow` when the field does not exist is a TS2339 compile error, which would make `typecheck` fail — contradicting the acceptance criterion. The plan's action list nominally assigned the type declaration to Task 2.
- **Fix:** Added the `peakDemandW/H` type declarations to the `computeExportDims` return type + `EnrichedRow` in Task 1, with a runtime stub (`undefined as unknown as number`) so the fields are type-`number` but resolve to `undefined` at runtime ⇒ the demand assertions fail (correct RED) while typecheck is green. Task 2 then REPLACED the stub with the real math and updated the docblocks. Net effect at phase end is identical to the plan; only the task boundary of the type-stub shifted by one task.
- **Files modified:** `src/renderer/src/lib/export-view.ts`, `src/renderer/src/lib/enrich-overrides.ts`
- **Verification:** Task 1 `typecheck:node`/`:web` exit 0; `vitest` exits 1 (8 failed / 1 passed). Task 2 replaced the stub (`grep "undefined as unknown as number"` → 0) and D-01/drift/regression went green.
- **Committed in:** `fa4d620` (stub, Task 1) → `8719e0b` (real math, Task 2)

**2. [Rule 1 - Bug] Corrected over-specified R2 spec assertion (CROWN)**
- **Found during:** Task 2 (running the GREEN gate)
- **Issue:** My Task-1 R2 case asserted `peakDemandW < 211` and `'under'` for CROWN (canon 478.5, peakScale 0.44, actualSource 211). The real demand math rounds up to exactly the source (`ceil(478.5 × 0.44) = 211`, capped at 211) ⇒ `atLimit`, not green. The plan's R2 contract is `peakDemandW === peakDisplayW` + "state preserved" (the D-02 display-unchanged guarantee), NOT strictly-under — my added assertions over-specified beyond the plan.
- **Fix:** Rewrote R2 to assert the real contract (`peakDemandW === peakDisplayW`, `peakDemandH === peakDisplayH`, and `rowState(peakDemandW) === rowState(peakDisplayW)` — state preserved). Added R2b (canon 478.5, peakScale 0.44, actualSource 478, no drift) to exercise the genuine-headroom green-preserved case the plan intended R2 to show.
- **Files modified:** `tests/regression/variant-phantom-green.spec.ts`
- **Verification:** Full spec 10/10 green; D-02 "display-unchanged" + "genuine green preserved" both covered.
- **Committed in:** `8719e0b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking — TDD type-stub boundary; 1 bug — over-specified test assertion)
**Impact on plan:** Both auto-fixes keep the phase faithful to D-01/D-02/D-03; the type-stub deviation is a pure task-boundary shift with identical phase-end state, and the R2 correction makes the spec assert the actual contract instead of an incorrect one. No scope creep; no exported-byte change; `src/core/` untouched.

## Issues Encountered
- **Full-suite (`npm run test`) has 2 PRE-EXISTING fixture-missing failures in this worktree** — `tests/main/sampler-worker-girl.spec.ts` (`fixtures/Girl/` gitignored, 152MB) and `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (`fixtures/SAMPLER_ALPHA_ZERO/` gitignored). Proven pre-existing by stashing ALL phase changes and re-running just those two files — they fail identically. Both are gitignored-fixture artifacts of the worktree environment, NOT a Phase-54 regression (this phase touches only renderer `lib/`/panels/AppShell/tests — zero `core/`/`main/`/sampler edits). Logged to `deferred-items.md`. The documented MixBlend renderer-import baseline did NOT appear in this run; `extrapolation-icon-tooltip.spec.tsx` is GREEN (9/9) under the new copy and is NOT part of that baseline (not green-washed).

## User Setup Required
None - no external service configuration required. (Owner-owned manual UAT is local-disk only: reopen the ARMAN/42 variant `.json` files and confirm GRAND/L_SKIRT no longer green + the section chip ≈ rounding residual; not jsdom-testable.)

## Known Stubs
None. The Task-1 Wave-0 stub (`undefined as unknown as number` in `computeExportDims`) was REPLACED by the real `peakDemandW/H` math in Task 2 (`grep` confirms 0 residue). No placeholder data flows to any UI cell.

## Next Phase Readiness
- The display read-model is corrected end-to-end (Peak cell, tint, savings chip) for all rigs (master + variant, atlas-source + atlas-less, 4.2 + 4.3) with no variant detection.
- No active milestone — Phase 54 is a post-v1.7-close standalone bugfix. After owner manual UAT, next is `/gsd-new-milestone` to scope v1.8.
- No blockers introduced. Export pipeline, bake, and OptimizeDialog are all byte-frozen.

## Self-Check: PASSED
- Created files exist: `src/renderer/src/lib/row-state.ts`, `tests/regression/variant-phantom-green.spec.ts`, `54-01-SUMMARY.md`, `deferred-items.md` — all FOUND.
- Task commits exist: `fa4d620` (test), `8719e0b` (feat), `92f8f62` (feat) — all FOUND.
- `src/core/` untouched across the phase (0 files); both typechecks exit 0; regression/tooltip/export/arch specs green.

---
*Phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving*
*Completed: 2026-05-25*
