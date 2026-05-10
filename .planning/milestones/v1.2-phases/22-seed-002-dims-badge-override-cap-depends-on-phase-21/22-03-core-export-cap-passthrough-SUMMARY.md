---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 03
subsystem: export-math
tags: [typescript, export, cap-formula, passthrough, dims-mismatch, round-trip-safety, lanczos]

# Dependency graph
requires:
  - phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
    provides: "Plan 22-01 — DisplayRow.canonicalW/H/actualSourceW/H/dimsMismatch fields; ExportRow.actualSourceW?/actualSourceH? optional fields; ExportPlan.passthroughCopies: ExportRow[] field; analyzer + summary plumbing wiring canonical/actual maps through to DisplayRows"
provides:
  - "buildExportPlan cap formula: cappedEffScale = min(downscaleClampedScale, sourceRatio) where sourceRatio = min(actualSourceW/canonicalW, actualSourceH/canonicalH) when dimsMismatch && actualSource defined; Infinity otherwise"
  - "D-04 REVISED generous passthrough partition: isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource); partitions accumulator into rows[] vs passthroughCopies[]"
  - "Passthrough ExportRow propagation: actualSourceW + actualSourceH mirrored from DisplayRow onto passthrough rows (CHECKER FIX 2026-05-02) for OptimizeDialog 'already optimized' label rendering in Plan 22-05"
  - "totals.count = rows.length + passthroughCopies.length"
  - "Aspect-ratio-preserving uniform cap: single multiplier from min over both axes — locked memory project_phase6_default_scaling.md honored; per-axis caps forbidden"
  - "Phase 6 Round 1 + Round 5 invariants extended: effectiveScale ≤ min(1.0, actualSource/canonical) — never extrapolate; Math.ceil(sourceW × effScale) preserved for outW + outH"
affects: [22-04, 22-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cap-then-partition pattern: insert sourceRatio cap step between safeScale + ≤1 clamp and dedup keep-max; partition accumulator into two arrays at emit time (mirrors Phase 6 D-109 excludedUnused parallel-array shape)"
    - "Local destructure for grep-friendly cap formula: `const { actualSourceW, actualSourceH, canonicalW, canonicalH } = row` so the cap predicate `Math.min(actualSourceW / canonicalW, ...)` matches the must_have grep pattern (cleaner than `row.actualSourceW / row.canonicalW`)"
    - "Conditional spread for passthrough actualSource propagation: `...(acc.isPassthrough && actualSourceW !== undefined && actualSourceH !== undefined ? { actualSourceW, actualSourceH } : {})` — mirrors atlasSource conditional spread already established in Phase 6"

key-files:
  created: []
  modified:
    - "src/core/export.ts (Acc interface gains isPassthrough; cap step inserted between Phase 6 Round 1 clamp and dedup; emit-rows partitions into rows[] + passthroughCopies[]; CHECKER FIX actualSource propagation onto passthrough ExportRow entries; totals.count sum of both arrays)"
    - "tests/core/export.spec.ts (+12 DIMS-03/04 unit tests under new describe block 'buildExportPlan — DIMS-03 cap formula + DIMS-04 passthrough partition (Phase 22)')"

key-decisions:
  - "Test math corrected from PLAN.md 22-03 worked example: outH=951 (NOT 962) for canonical 1628×1908 / actual 811×962 with peakScale=0.7 — uniform cap means non-binding axis ceils to ≤ actualSource (1px slack acknowledged in CONTEXT D-04). Plan's outH=962 expectation was algebraically incorrect for the binding-X-axis case."
  - "Test redundant-guard assertion corrected: PLAN's assertion `Math.ceil(actualSourceW × cappedEffScale) === actualSourceW` is mathematically wrong (yields 405 for 811 × 0.498). Correct formulation: BINDING-axis ceil-equality holds — `Math.ceil(canonicalW × cappedEffScale) === actualSourceW` (since cappedEffScale === actualSourceW/canonicalW exactly when X is binding). Non-binding axis: `Math.ceil(canonicalH × cappedEffScale) ≤ actualSourceH`."
  - "Local destructure of row.{actualSourceW,actualSourceH,canonicalW,canonicalH} adopted to satisfy must_have grep pattern `Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW` — cleaner read at the cap-formula site too."
  - "Output dim formula uses legacy `Math.ceil(sourceW × effScale)` shape per PLAN.md Step 5 'no branch needed' guidance: at the binding-cap edge cappedEffScale === sourceRatio exactly, so ceil(canonicalW × that) === actualSourceW by construction. The non-binding axis takes uniform-cap slack (up to 1px less than actualSource on Y axis) — this is the acknowledged aspect-ratio-noise edge case."
  - "Renderer mirror NOT touched in this plan per PLAN.md 'DO NOT touch src/renderer/src/lib/export-view.ts in this task — that's Plan 22-04's parity-mirror scope'. Parity test in tests/core/export.spec.ts:635 still passes because it runs SIMPLE_TEST without canonical/actual maps → DisplayRows have dimsMismatch:false → no cap path exercised → both copies produce identical output."

patterns-established:
  - "Pattern: Cap-then-partition — bound effectiveScale by min(downscaleClampedScale, sourceRatio), then partition rows by an isPassthrough flag at emit time. Accumulator carries the flag through dedup keep-max (when two attachments share a sourcePath, the higher post-cap effScale wins; isPassthrough is propagated from the winning row)."
  - "Pattern: Conditional ExportRow field spread — passthrough-only fields (actualSourceW/H) spread via `...(acc.isPassthrough && defined ? {...} : {})` mirror the existing atlasSource conditional pattern. Renderer parity (Plan 22-04) mirrors byte-identically. OptimizeDialog (Plan 22-05) reads with `row.actualSourceW ?? row.sourceW` fallback."

requirements-completed: [DIMS-03, DIMS-04]

# Metrics
duration: 18min
completed: 2026-05-03
---

# Phase 22 Plan 03: Core Export Cap + Passthrough Partition Summary

**buildExportPlan extended with D-03 uniform cap (sourceRatio = min over both axes) + D-04 REVISED generous passthrough partition (isCapped || peakAlreadyAtOrBelowSource) + actualSource propagation onto passthrough ExportRow entries.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-03T00:15:00Z (approx — worktree spawn)
- **Completed:** 2026-05-03T00:32:00Z
- **Tasks:** 1 (TDD-flagged: RED → GREEN, no REFACTOR needed)
- **Files modified:** 2
- **Commits:** 2 atomic (test + feat) + 1 metadata (this SUMMARY)

## Accomplishments

- **DIMS-03 cap formula landed in `buildExportPlan`:** uniform multiplier from `Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)` when `dimsMismatch && actualSource defined`; `Infinity` otherwise. Cap binds via `cappedEffScale = Math.min(downscaleClampedScale, sourceRatio)`. Locked memory `project_phase6_default_scaling.md` honored — single uniform multiplier from min over both axes, NOT per-axis.
- **D-04 REVISED generous passthrough partition:** `isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)`. Catches both binding-cap rows (output IS actualSource on the binding axis by construction) AND DIMS-05 already-optimized rows (peakScale ≤ sourceRatio: user already over-reduced past peakScale; further Lanczos would not produce a strictly smaller image).
- **CHECKER FIX 2026-05-02 — passthrough actualSource propagation:** passthrough ExportRow entries carry `actualSourceW + actualSourceH` mirrored from DisplayRow via conditional spread. Plan 22-05 OptimizeDialog will render the "already optimized" label with concrete on-disk dims (e.g. 811×962) instead of canonical dims (e.g. 1628×1908). Non-passthrough rows skip the spread — fields stay undefined.
- **Acc interface extended with `isPassthrough: boolean`** — propagated through dedup keep-max (when two attachments share a sourcePath, the higher post-cap effScale wins, with its isPassthrough flag).
- **Emit-rows partitions into `rows[]` + `passthroughCopies[]`** — both sorted deterministically by `sourcePath.localeCompare`.
- **totals.count = rows.length + passthroughCopies.length** — preserves the Phase 6 D-110 totals contract while reflecting the new partition.
- **12 new DIMS-03/04 unit tests** added under `describe('buildExportPlan — DIMS-03 cap formula + DIMS-04 passthrough partition (Phase 22)')` covering: cap fires (binding axis = actualSource exactly), cap does NOT fire on non-drifted, aspect-ratio invariant (uniform cap NOT per-axis), D-04 generous threshold (both `isCapped` and `peakAlreadyAtOrBelowSource` branches), binding-axis ceil-equality redundant guard, D-02 override-cap interaction (transparent clamp; never extrapolates beyond actualSource), atlas-extract path (no cap when actualSource undefined), totals.count partition, deterministic ordering, and CHECKER FIX actualSource propagation (both passthrough has them set, non-passthrough has them undefined).
- **Layer 3 invariant preserved:** zero new `node:fs|node:path|sharp|electron|spine-core` runtime imports in `src/core/export.ts`. Cap math is pure projection on existing DisplayRow fields; no new I/O.
- **Phase 6 Round 1 + Round 5 invariants extended cleanly:** Round 1 clamped `effectiveScale ≤ 1.0` (never upscale beyond canonical). Phase 22 extends to `effectiveScale ≤ min(1.0, actualSource/canonical)` (also never upscale beyond what's actually on disk). One coherent invariant — never upscale. Round 5 `Math.ceil(sourceW × effScale)` preserved for outW and outH (Phase 6 sub-pixel-safe sizing intact).
- **All 41/41 tests pass in tests/core/export.spec.ts** (29 baseline + 12 new). 649/650 across the broader suite (1 pre-existing failure on `tests/main/sampler-worker-girl.spec.ts` documented in 22-01 SUMMARY as out-of-scope environment issue).

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: Add failing DIMS-03 cap + DIMS-04 passthrough partition tests** — `fd5067e` (test)
2. **Task 1 GREEN: Implement DIMS-03 cap formula + DIMS-04 passthrough partition in buildExportPlan** — `54abc72` (feat)

**Plan metadata:** committed via SUMMARY.md (this file) — orchestrator handles STATE.md/ROADMAP.md updates after wave merge.

_Note: TDD-flagged plan; RED gate (test commit `fd5067e`) failed against the pre-Task-1 baseline (cap formula did not exist; passthroughCopies was empty placeholder). GREEN gate (feat commit `54abc72`) flips all 12 new tests green. No REFACTOR commit — implementation is clean as written; no extraction or simplification opportunity warranted a separate commit._

## Files Created/Modified

**Created:** none (additive cap-step + partition — no new files).

**Modified:**

- `src/core/export.ts` (lines 152-237) — `Acc` interface gains `isPassthrough`; cap step inserted between `Math.min(safeScale(rawEffScale), 1)` and dedup keep-max; `peakAlreadyAtOrBelowSource` predicate covers DIMS-05 enabler branch; emit-rows loop partitions into `rows[]` + `passthroughCopies[]`; CHECKER FIX conditional spread propagates `actualSourceW/H` onto passthrough rows; both arrays sorted by sourcePath localeCompare; `totals.count` sum of both lengths.
- `tests/core/export.spec.ts` (lines 706-1090, +384 lines) — new describe block `'buildExportPlan — DIMS-03 cap formula + DIMS-04 passthrough partition (Phase 22)'` with 12 tests covering cap formula, partition, aspect-ratio invariant, override interaction, propagation invariant, deterministic ordering. Two helpers added: `makeDriftedSummary` + `makeNonDriftedSummary`.

## Decisions Made

- **D-CHECKER-22-03 honored:** passthrough ExportRow entries carry `actualSourceW + actualSourceH` from DisplayRow. The CHECKER FIX wording in PLAN.md Step 5 was followed precisely — guarded conditional spread, mirrored atlasSource pattern. Plan 22-04 will mirror byte-identically in `src/renderer/src/lib/export-view.ts`. Plan 22-05 OptimizeDialog will read with `row.actualSourceW ?? row.sourceW` fallback.
- **Local destructure for grep-friendly cap formula:** the must_have pattern `Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW` requires no qualifier between the slash and `canonicalW`. Initial implementation used `row.actualSourceW / row.canonicalW` (qualified field access) which failed the regex even though semantically correct. Refactored to `const { actualSourceW, actualSourceH, canonicalW, canonicalH } = row;` then `Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)` — clean read AND grep-pattern compliance.
- **Output dim formula NO-BRANCH per PLAN.md Step 5:** the legacy `Math.ceil(sourceW × effScale)` shape handles BOTH binding-cap and non-binding-cap cases without a conditional. Mathematical proof: when `cappedEffScale === sourceRatio = actualSourceW/canonicalW` (binding X axis), `ceil(canonicalW × cappedEffScale) = ceil(actualSourceW) = actualSourceW` exactly. Non-binding Y axis: `ceil(canonicalH × cappedEffScale) ≤ actualSourceH` (uniform cap; up to 1px slack on the non-binding axis — acknowledged in CONTEXT D-04 as the wasteful 1px aspect-ratio noise edge case).
- **REFACTOR step skipped (TDD plan-level):** RED → GREEN landed cleanly; the implementation is idiomatic (mirrors existing dedup + atlasSource conditional-spread patterns at the same call site). Refactor for refactor's sake violates "no superfluous commits" — skipped intentionally.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test expectations corrected for outH on binding-X-axis cap test**

- **Found during:** Task 1 RED (writing initial DIMS-03 cap test)
- **Issue:** PLAN.md Test 1 expected `plan.passthroughCopies[0].outH === 962` for canonical 1628×1908 / actual 811×962 / peakScale 0.7. This is mathematically incorrect: the cap is uniform on the binding (X) axis with `cappedEffScale = sourceRatio = 811/1628 ≈ 0.49816`. `Math.ceil(1908 × 0.49816) = Math.ceil(950.49) = 951`, NOT 962. The Y axis is non-binding under uniform cap; `outH = 962` would only hold under per-axis caps (which are forbidden per locked memory `project_phase6_default_scaling.md`).
- **Fix:** Wrote tests asserting `outH === 951` for the binding-X-axis case (canonical 1628×1908 / actual 811×962). Added explicit comment explaining the binding-axis-equals-actualSource invariant and the non-binding-axis ceil ≤ actualSource invariant. The aspect-ratio test (canonical 1000×800 / actual 500×480) was already correct in PLAN: `outH === 400` (NOT 480) since X is binding and Y takes uniform-cap reduction.
- **Files modified:** `tests/core/export.spec.ts` (Test 1 expectations).
- **Verification:** All 12 tests GREEN against the GREEN-gate implementation. The implementation produces the mathematically correct values; the test expectations now match.
- **Committed in:** `fd5067e` (RED commit — tests as written reflect correct math from the start).

**2. [Rule 1 - Bug] Test 6 redundant-guard assertion corrected to binding-axis form**

- **Found during:** Task 1 RED (writing the D-04 ceil-equality guard test)
- **Issue:** PLAN.md Test 6 asserted `Math.ceil(actualSourceW × cappedEffScale) === actualSourceW` AND same for H. This is algebraically wrong: for `actualSourceW = 811` and `cappedEffScale = 0.49816`, `811 × 0.49816 = 404.0`, `ceil = 405 ≠ 811`. The "trivial" ceil-equality holds on the BINDING axis between `canonicalW` and `actualSourceW`, NOT on `actualSourceW × cappedEffScale`.
- **Fix:** Test 6 asserts the correct invariant: `Math.ceil(canonicalW × cappedEffScale) === actualSourceW` for the binding axis (X here, since `811/1628 < 962/1908`), and `Math.ceil(canonicalH × cappedEffScale) ≤ actualSourceH` for the non-binding axis (Y here). Documented inline that the non-binding axis takes up to 1px slack.
- **Files modified:** `tests/core/export.spec.ts` (Test 6 expectations).
- **Verification:** Test passes; the formula `Math.ceil(canonicalW × sourceRatio) === actualSourceW` holds by construction since `sourceRatio = actualSourceW/canonicalW` exactly when X is binding (canonicalW × actualSourceW/canonicalW = actualSourceW; ceil of integer = integer).
- **Committed in:** `fd5067e` (RED commit).

**3. [Rule 3 - Blocking] Local destructure refactor of cap-formula to satisfy grep pattern**

- **Found during:** Task 1 GREEN (post-implementation verification grep)
- **Issue:** Initial implementation used `Math.min(row.actualSourceW / row.canonicalW, row.actualSourceH / row.canonicalH)` (qualified field access). The PLAN must_have pattern `Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW` requires no `row.` qualifier between the slash and `canonicalW` (the `\\s*/\\s*` clause forbids the `row.` text). Implementation was semantically correct but failed the gsd-verify-work grep gate.
- **Fix:** Refactored to local destructure `const { actualSourceW, actualSourceH, canonicalW, canonicalH } = row;` immediately before the cap formula. Cap reads cleanly as `Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)` — matches must_have pattern AND reads more clearly.
- **Files modified:** `src/core/export.ts` (cap-formula site only — peakAlreadyAtOrBelowSource updated to use the local `actualSourceW` for consistency).
- **Verification:** All 41 tests pass; typecheck clean; must_have grep pattern matches.
- **Committed in:** `54abc72` (GREEN commit; refactor folded into the same commit since it's the same logical landing).

---

**Total deviations:** 3 auto-fixed (2 Rule 1 — bugs in PLAN.md test math; 1 Rule 3 — blocking grep pattern requirement)
**Impact on plan:** All deviations are corrections to PLAN.md text artifacts (test expected values + grep-pattern-friendly destructure). No scope creep. No behavior change beyond what PLAN.md specified — implementation matches PLAN's intent (uniform cap, generous passthrough partition, CHECKER FIX propagation); only the test assertions and the local destructure idiom differ. The cap formula's mathematical correctness is preserved (and proven by the 12 new tests).

## Issues Encountered

- **Pre-existing failing test (out of scope per scope-boundary rule):** `tests/main/sampler-worker-girl.spec.ts` continues to fail (`expected 'error' to be 'complete'` on a sampler-worker run on Girl fixture). Documented in 22-01 SUMMARY as out-of-scope environment/timing issue. Not auto-fixed; not introduced by this plan; isolated to a single test in a different layer (sampler-worker integration).

## TDD Gate Compliance

Plan-level TDD gate sequence verified in git log:

1. **RED commit:** `fd5067e` — `test(22-03): add failing DIMS-03 cap + DIMS-04 passthrough partition tests` ✓
2. **GREEN commit:** `54abc72` — `feat(22-03): implement DIMS-03 cap formula + DIMS-04 passthrough partition in buildExportPlan` ✓
3. **REFACTOR commit:** none — intentionally skipped (no extraction or simplification opportunity beyond what was folded into GREEN).

RED → GREEN sequence intact. The 9 failing tests at RED gate (3 passing tests covered the no-cap branches that worked against the placeholder `passthroughCopies: []` already shipped in 22-01) flipped to all 12 GREEN at the implementation commit.

## Self-Check

**Files claimed in this SUMMARY exist and contain the claimed contracts:**

- `src/core/export.ts` — `sourceRatio` ✓ FOUND (8 hits); `isPassthrough` ✓ FOUND (10 hits); `peakAlreadyAtOrBelowSource` ✓ FOUND (4 hits); cap formula `Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)` ✓ FOUND; passthrough partition predicate `isCapped || peakAlreadyAtOrBelowSource` ✓ FOUND; CHECKER FIX `actualSourceW: acc.row.actualSourceW` ✓ FOUND; `passthroughCopies` ✓ FOUND (6 hits — declaration + push + sort + return + 2 docblock); Layer 3 invariant — zero forbidden imports ✓.
- `tests/core/export.spec.ts` — `DIMS-03` ✓ FOUND in describe block; `DIMS-04` ✓ FOUND in describe block; 12 new test cases under the describe block.

**Commits exist on branch:**

- `fd5067e` ✓ FOUND in `git log --oneline`.
- `54abc72` ✓ FOUND in `git log --oneline`.

**Acceptance criteria from PLAN.md:**

- `grep -c "sourceRatio" src/core/export.ts` ≥ 2: ✓ (8)
- `grep -c "isPassthrough" src/core/export.ts` ≥ 2: ✓ (10)
- `grep -c "peakAlreadyAtOrBelowSource" src/core/export.ts` ≥ 1: ✓ (4)
- `grep -E "Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW" src/core/export.ts` ≥ 1: ✓ (1)
- `grep -c "passthroughCopies" src/core/export.ts` ≥ 3: ✓ (6)
- `grep -E "actualSourceW:\\s*acc\\.row\\.actualSourceW" src/core/export.ts` ≥ 1: ✓ (1)
- `grep -E "^import.*from.*sharp|^import.*from.*electron" src/core/export.ts` returns 0: ✓ (0)
- 11+ new DIMS-03/04 tests under the describe block all pass: ✓ (12 tests, all green)
- Aspect ratio test passes (outW=500 AND outH=400 for canonical 1000×800 / actual 500×480): ✓
- Test 5 (peakAlreadyAtOrBelowSource branch) passes: ✓
- Test 7 (D-02 override interaction) passes: ✓
- Tests 11 + 12 (CHECKER FIX propagation) pass: ✓
- All existing case-(a)-(f) tests still pass: ✓ (29/29 baseline GREEN)
- Full suite green except pre-existing sampler-worker-girl.spec.ts failure (documented out-of-scope)

**Caveat on PLAN's `Math.ceil(sourceW × …)` count requirement:** PLAN's grep `Math\\.ceil\\([^)]*sourceW\\s*\\*` returns 1 (only outW uses sourceW; outH uses sourceH). PLAN's "≥ 2" was a typo or expected matches across both sourceW and sourceH; semantically the Round 5 invariant (Math.ceil for both outW + outH) is preserved (line 262 + 263 of src/core/export.ts).

## Self-Check: PASSED

## Next Plan Readiness

- **Plan 22-04 (renderer mirror + image-worker copyFile)** — ready to start. The cap step + partition + CHECKER FIX propagation in `src/core/export.ts` is the canonical implementation; Plan 22-04 mirrors byte-identically into `src/renderer/src/lib/export-view.ts` and adds the `fs.promises.copyFile` branch in `src/main/image-worker.ts` for `passthroughCopies[]` rows. Parity test in tests/core/export.spec.ts:635 already gates the byte-identical contract.
- **Plan 22-05 (panels + modal + roundtrip)** — types ready; ExportRow.actualSourceW + actualSourceH propagation lands here, OptimizeDialog (Plan 22-05 Task 2 Step 1) consumes via `row.actualSourceW ?? row.sourceW` fallback to render concrete on-disk dims for "already optimized" labels.

---
*Phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21*
*Completed: 2026-05-03*
