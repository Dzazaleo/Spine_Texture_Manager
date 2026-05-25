---
phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
reviewed: 2026-05-25T17:50:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/renderer/src/lib/row-state.ts
  - src/renderer/src/lib/export-view.ts
  - src/renderer/src/lib/enrich-overrides.ts
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - src/renderer/src/components/icons/ExtrapolationIcon.tsx
  - src/renderer/src/components/AppShell.tsx
  - tests/regression/variant-phantom-green.spec.ts
  - tests/renderer/extrapolation-icon-tooltip.spec.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 54: Code Review Report

**Reviewed:** 2026-05-25T17:50:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 54 is a renderer-side, display-only read-model fix for the "phantom green
savings" bug on reopened peakScale>1 variants. I reviewed all 9 changed files
adversarially and independently verified the load-bearing invariants this phase
was supposed to preserve.

What checks out (verified, not taken on faith):
- **Export path is frozen.** The diff adds only `peakDemandW/H` to
  `computeExportDims`; `outW/outH/effScale/displayScale/peakDisplayW/H` are
  byte-identical in the return literal. `tests/core/export.spec.ts` is green
  (77/77), confirming the parity contract with `src/core/export.ts` is intact.
  No exported-byte change.
- **`safeScale()` retained** in the new `peakDemandW/H` formula
  (`export-view.ts:305-306`) — the mandatory operation is present.
- **rowState** is a pure integer compare with no epsilon (`row-state.ts:30-31`),
  matching the D-03 deliberate-design contract.
- **Tooltip copy** `Spine rig peak: ${row.peakScale.toFixed(2)}× source` is
  byte-identical across GlobalMaxRenderPanel, AnimationBreakdownPanel, the icon
  docblock, and the tooltip spec; old "export capped at canonical" copy is gone
  from all four (grep-confirmed 0 residue).
- **Both typechecks pass** (`typecheck:node` and `typecheck:web` exit 0);
  regression spec 10/10, tooltip spec 9/9 green. No TS6307 landmine from the
  `row-state.ts` extraction.

The three WARNING findings below are genuine quality/consistency defects. Two of
them (WR-01, WR-02) were explicitly acknowledged as out-of-scope in the phase
plan, so they are documented deferrals rather than execution mistakes — but they
are real defects that ship in this code and the team should know they exist and
were not closed.

## Warnings

### WR-01: Peak column sorts on a different value than it displays

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:247` (display at `:553`)
**Issue:** The "Peak W×H" cell now renders `row.peakDemandW × row.peakDemandH`
(`:553`), but the column's sort comparator still reads `peakDisplayW`
(`case 'worldW'` → `return a.peakDisplayW - b.peakDisplayW;`, `:247`). For
reopened peakScale>1 variants the two diverge: `peakDisplayW` is clamped at
`min(canonical, sourceRatio)` (e.g. GRAND 209) while the displayed
`peakDemandW` is capped at `actualSource` (e.g. 247). The user clicks the Peak
header and the rows reorder by numbers that are NOT the ones shown in the cells —
a classic "sort doesn't match what I see" defect. Before this phase the column
displayed and sorted on the same field (`peakDisplayW`); this phase introduced
the divergence.
After this change `peakDisplayW` is referenced ONLY by the sort comparator —
nowhere visible — which makes the inconsistency easy to miss in future edits.
**Note:** The phase plan (54-01-PLAN.md:388) explicitly declared this
"acceptable and out of scope," so this is a documented deferral, not an execution
error. Flagging because it is still a live UX defect.
**Fix:** Sort on the displayed value:
```ts
case 'worldW':
  // Sort the Peak column on the value the cell actually renders (Phase 54
  // moved the cell onto peakDemandW; keep sort in lockstep).
  return a.peakDemandW - b.peakDemandW;
```

### WR-02: AnimationBreakdownPanel still produces the phantom-green it was fixing

**File:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:836, 915, 960`
**Issue:** The phantom-green fix (display + tint on `peakDemandW`) was applied to
GlobalMaxRenderPanel only. The sibling AnimationBreakdownPanel still renders
`row.peakDisplayW × row.peakDisplayH` in the Peak cell (`:836`) and still tints
via `rowState(row.peakDisplayW, ...)` at both call sites (`:915`, `:960`). It
never even destructures `peakDemandW` from `computeExportDims` (`:226`). Result:
the exact reopened-variant row that now correctly shows yellow/at-limit on the
Global tab will still show false green on the Animation Breakdown tab — the same
two panels the project treats as sibling-symmetric now disagree on the same
underlying data. This phase introduced that asymmetry (pre-phase both panels used
`peakDisplayW`).
**Note:** 54-01-PLAN.md:340 and 54-CONTEXT explicitly scope the breakdown
panel's D-01/D-03 wiring OUT ("tooltip-copy ONLY"). So this is a documented,
intentional deferral. Flagging because the bug class the phase set out to kill
still ships in a user-facing surface, and the inter-panel inconsistency is a new
condition created by this phase.
**Fix:** Apply the same wiring symmetrically (mirrors the Global panel changes):
```ts
// enrichCardsWithEffective — destructure the demand pair
const { effScale, outW, outH, displayScale, peakDisplayW, peakDisplayH,
        peakDemandW, peakDemandH } = computeExportDims(...);
// carry peakDemandW/H onto EnrichedBreakdownRow, render them in the Peak cell,
// and pass row.peakDemandW into both rowState(...) call sites.
```

### WR-03: Savings chip silently changed dedup/scope semantics; stale prop name

**File:** `src/renderer/src/components/AppShell.tsx:1196-1210` (consumer at `:2789`)
**Issue:** `savingsPctMemo` was rebased from `buildExportPlan(...)` (which dedups
rows by `sourcePath` and excludes unused) to a raw iteration over
`effectiveSummary.regions` (one row per `regionName`, no sourcePath dedup). For a
path-indirected project where two regionNames share one source PNG, the chip now
double-counts that PNG's pixels in BOTH numerator and denominator. This was an
explicit research decision (chip ≡ Σ visible panel rows, and the panel iterates
`summary.regions` too), so the chip is internally consistent with the table — but
it now diverges from the export-plan figure in a second way (dedup) beyond the
intended demand-vs-export-out rebase, with no test asserting the dedup behavior.
Separately, the rebased value still flows into `DocumentationBuilderDialog` via
the prop `exportPlanSavingsPct` (`:2789`), which is now a misnomer — the value is
no longer export-plan-based. The HTML "Space Savings" card
(`src/main/doc-export.ts:425-434`) renders it under "Estimated Reduction." The
disposition was recorded as "ACCEPTED AS-IS" (54-01-SUMMARY.md:102), so this is
acknowledged, but the stale prop name will mislead the next maintainer.
**Fix:** Rename the prop to a basis-neutral name (e.g. `pixelSavingsPct` /
`renderDemandSavingsPct`) end-to-end (AppShell prop, DocumentationBuilderDialog,
doc-export payload field), and add a one-line regression assertion that two
regionNames sharing one `sourcePath` are counted as the chip intends (matching
the panel rows) so the dedup behavior is pinned, not incidental.

## Info

### IN-01: Chip denominator/cap source can disagree if drift exists without actualSource

**File:** `src/renderer/src/components/AppShell.tsx:1203-1206`
**Issue:** The chip uses `srcW = r.actualSourceW ?? r.sourceW` as the denominator,
while `peakDemandW` (numerator) is capped at `actualSourceW ?? canonicalW`
(`export-view.ts:303-305`). These agree only because the data contract guarantees
`sourceW === canonicalW` whenever `actualSourceW` is undefined (no-drift rows). If
a future loader change ever emitted a drifted row (`canonicalW ≠ sourceW`) with
`actualSourceW` left undefined, the numerator would be capped at `canonicalW`
while the denominator used `sourceW`, allowing `peakDemandW > srcW` → a single
row contributing negative savings → a negative or inflated chip %. Currently
unreachable, but the invariant is implicit and unguarded.
**Fix:** Use the same source basis the demand cap uses, or assert the invariant:
compute the per-row denominator as `r.actualSourceW ?? r.canonicalW ?? r.sourceW`
to match the cap, or `Math.max(0, ...)`-clamp each row's residual.

### IN-02: `peakDisplayW` is now dead-for-display in the Global panel

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:247`
**Issue:** After this phase, `EnrichedRow.peakDisplayW/H` is consumed in the
Global panel ONLY by the sort comparator (`:247`); it is no longer rendered or
tinted on. It remains a legitimate field (it is the export-dim Peak value and is
still used by AnimationBreakdownPanel), so it is not dead code globally — but its
sole Global-panel use being a hidden sort key is what makes WR-01 easy to
overlook. Resolving WR-01 (sort on `peakDemandW`) would leave `peakDisplayW`
entirely unreferenced in this file, at which point it could be dropped from the
Global panel's read path.
**Fix:** Tie this to WR-01; once the comparator moves to `peakDemandW`, drop the
unused `peakDisplayW` reference from this panel.

---

_Reviewed: 2026-05-25T17:50:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
