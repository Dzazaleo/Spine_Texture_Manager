---
id: SEED-002
status: dormant
planted: 2026-04-25
planted_during: Milestone 1 / Phase 6 (optimize-assets-image-export) close-out
trigger_when: when source PNG dims may differ from JSON canonical region dims (e.g. user manually pre-reduced source images, or overwrote source folder during a previous Optimize Assets run); or when a user reports "the app keeps trying to optimize already-optimized images"
scope: Medium
proposed_phase: 6.2
depends_on: SEED-001 (shares PNG header reader infrastructure)
---

# SEED-002: Dims-badge + override-math cap (canonical vs source mismatch)

## Why This Matters

Two scenarios surface canonical-vs-source dimension drift:

**Scenario A — user pre-reduced their source images manually.** Animator
exported original-size source PNGs from Spine, then ran them through Photoshop
or a separate optimizer to shrink. Now the source images on disk are smaller
than the dims declared in the atlas (or in the synthesized atlas from
SEED-001's atlas-less loader path). Loading the project: app shows the JSON
canonical dims as "source" (e.g. 1628×1908) but the actual PNG on disk is
811×962. If the user then runs Optimize Assets, the math computes peakScale
against the canonical dims and produces output dims that may UPSCALE the
actual source PNG — violating the locked memory's "never extrapolate" rule.

**Scenario B — Phase 6 ConflictDialog "Overwrite all" was used.** User runs
Optimize once → overwrites source images with optimized versions →
re-loads same project. Now the source PNGs on disk are smaller than the
canonical dims, identical to Scenario A. If user runs Optimize again, the
app would try to re-reduce already-reduced images, producing strictly
worse output (double Lanczos resampling).

**The fix:** read the actual source PNG dims (via SEED-001's PNG header
reader) and compare against the JSON canonical dims. When they differ:
- Surface a badge in BOTH the Global panel AND Animation Breakdown panel
  on affected rows
- Cap the export effective scale: `effectiveScale = min(peakScale, sourceW /
  canonicalW, sourceH / canonicalH)` so the output is never larger than
  the actual source PNG. If the actual source PNG is already at or below
  the peak demand, the row should report "no optimization needed (1.000×)"
  and skip the export entirely.

User confirmed this scope on 2026-04-25 during Phase 6 verification:
> "Same badge/warning about source dims and json canonical dims differing
>  must be issued. App must do the math to determine how images must be
>  optimized in order to guarantee that images already in correct size
>  are not touched and images that still need to be reduced, are reduced
>  only the correct amount to reach target peak dims."

## When to Surface

**Trigger:** any of:
- SEED-001 (atlas-less mode) is being planned — they share the PNG header
  reader; planning together may be efficient (but user explicitly chose
  separate sequencing, see Notes)
- User reports a bug like "I optimized this project and now it looks
  worse" or "after optimize the panel shows weird dimensions"
- A milestone scope that includes "asset hygiene", "import validation",
  "post-Phase-6 export quality"

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches any of:
- "optimization round-trip safety", "source vs canonical dims", "import
  validation badges", "post-Phase-6 polish"

## Scope Estimate

**Medium** — sized as a phase (Phase 6.2). Depends on SEED-001 having
landed first (PNG header reader available).

Concrete deliverables:
- Read actual source PNG dims via the SEED-001 PNG header reader
  (`src/core/png-header.ts`) per region
- Extend `DisplayRow` (in `src/core/types.ts`) with `actualSourceW` and
  `actualSourceH` fields (populated by loader; undefined when not
  applicable, e.g. atlas-extract path)
- Compute `dimsMismatch: boolean` on `DisplayRow` when actualSourceW/H
  differ from sourceW/H by more than a tolerance (1px for rounding)
- Add badge UI to GlobalMaxRenderPanel and AnimationBreakdownPanel:
  small icon + tooltip explaining "Source PNG (811×962) is smaller than
  canonical region dims (1628×1908). Optimize will cap at source size."
- Update `buildExportPlan` in `src/core/export.ts`:
  ```typescript
  const sourceLimit = Math.min(actualSourceW / sourceW, actualSourceH / sourceH);
  const cappedEffScale = Math.min(effScale, sourceLimit);
  ```
  When `cappedEffScale === sourceLimit < effScale`, the export is
  capped — log clearly in the OptimizeDialog file list
- New row state: "already-optimized" — when actualSourceW × cappedEffScale
  rounds to actualSourceW (no actual reduction needed), skip the row from
  the export entirely and surface in `excludedAlreadyOptimized[]`
- Tests: round-trip a json+images project where source PNGs are smaller
  than canonical → load → verify dimsMismatch flag → buildExportPlan caps
  scales correctly → re-running Optimize on already-optimized images
  produces zero exports

Locked invariants still apply:
- Aspect-preservation (uniform single-scale; ceil applied per axis)
- D-110 ceil + ceil-thousandth scale display
- Phase 6 round-trip safety: never upscale beyond source dims

## Breadcrumbs

Related code:
- `src/core/loader.ts` — would gain PNG header reads per region (using
  SEED-001's reader)
- `src/core/types.ts:115-132` — DisplayRow definition (gains actualSourceW/H,
  dimsMismatch)
- `src/core/export.ts:117-135` — `safeScale` + ceil math (gains the
  source-cap step)
- `src/renderer/src/lib/export-view.ts` — byte-identical renderer copy
  (gets the cap math too; computeExportDims helper extended)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — Round 5 already has
  hover tooltip on Peak W×H column (extend with badge for dims mismatch)
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — same
- `src/renderer/src/modals/OptimizeDialog.tsx` — pre-flight file list
  needs an "already-optimized — skipped" indicator analogous to the
  Round 1 `excludedUnused` muted note

Related decisions:
- Phase 6 locked memory `project_phase6_default_scaling.md` — aspect
  preservation; never extrapolate. SEED-002 honors both: cap is a
  uniform reduction (not per-axis), and "never upscale beyond source"
  is the literal cap semantics
- Phase 6 D-109 — `excludedUnused[]` precedent for the
  `excludedAlreadyOptimized[]` field
- Phase 6 Gap-Fix Round 1 — clamp `effectiveScale ≤ 1.0` (this seed
  extends the clamp to also respect actual source PNG dims)

Related artifacts:
- `.planning/phases/06-optimize-assets-image-export/06-07-GAP-FIX-SUMMARY.md`
  Round 1 (where the clamp at 1.0 was added; Round 5 added ceil-thousandth)

## Notes

User explicitly chose to sequence 6.1 first, then 6.2 (2026-04-25 during
Phase 6 verification). SEED-001 must land before SEED-002 — the PNG header
reader is the shared dependency.

When promoting SEED-002 to a phase, verify SEED-001 has landed; if not,
either bundle (raises 6.1 scope) or block 6.2 on 6.1 completion.

Open question for the planning conversation: should "already-optimized"
rows be HIDDEN from the optimize dialog file list entirely, or shown
with a strikethrough/muted treatment? Default recommendation: shown muted
(parity with `excludedUnused` UX) so the user understands WHY their
re-export of a project produces fewer rows than the panel suggested.
