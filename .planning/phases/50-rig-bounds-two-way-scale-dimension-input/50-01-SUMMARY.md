---
phase: 50-rig-bounds-two-way-scale-dimension-input
plan: 01
subsystem: core
tags: [spine, bbox, setup-pose, dual-runtime, layer-3, geometry, scaleui]

# Dependency graph
requires:
  - phase: 47-runtime-adapter-facade
    provides: SpineRuntime adapter facade (load.runtime) + SkeletonSummary.runtimeTag additive-field precedent
  - phase: 49-single-scale-variant-export
    provides: the aggregateWorldAABB prototype + VariantDialog scale field 50-02 enriches
provides:
  - "src/core/setup-bounds.ts computeSetupPoseBounds(load): {w,h}|null — Layer-3-pure all-skins setup-pose AABB union via the dual-runtime adapter"
  - "SkeletonSummary.bbox: {w,h}|null additive field, computed once in summary.ts and ferried to the renderer over the existing summary handoff (no new IPC)"
affects: [50-02, two-way-scale-dimension-input, VariantDialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All-skins manifest union (sampler Pass-1.5) over the SpineRuntime adapter for a non-mutating setup-pose bbox"
    - "Degenerate measured===0 -> null guard so a non-finite -Infinity never crosses the structuredClone IPC ferry"

key-files:
  created:
    - src/core/setup-bounds.ts
  modified:
    - src/shared/types.ts
    - src/main/summary.ts
    - tests/core/setup-bounds.spec.ts
    - tests/main/summary.spec.ts
    - tests/arch.spec.ts
    - tests/core/documentation.spec.ts

key-decisions:
  - "Compute the bbox ourselves from runtime geometry; never read the untrusted editor skeleton.width/height header (D-05) — used only as the V3/V4 cross-check oracle (D-08)"
  - "All-skins manifest union at setup-pose bone transforms, not live setup-pose slot bindings (D-06) — avoids the eyes-only-setup trap"
  - "Materialize dual-runtime via load.runtime.makeSkeleton only, never a hardcoded Skeleton ctor (D-07 / REG-47-01)"
  - "Degenerate rig (zero textured attachments) returns null, never -Infinity (T-50-FIN / Pitfall 1) so structuredClone over IPC never breaks"

patterns-established:
  - "Pattern: generalize the proven aggregateWorldAABB body (slot-bindings -> all-skins manifest union) for a reusable Layer-3 reference-geometry function"
  - "Pattern: named per-phase Layer-3 purity anchor in arch.spec.ts (content-grep, range-free, ENOENT-tolerant)"

requirements-completed: [SCALEUI-02]

# Metrics
duration: 4min
completed: 2026-05-22
---

# Phase 50 Plan 01: Rig-Bounds Reference (SCALEUI-02) Summary

**Layer-3-pure `computeSetupPoseBounds` computes the rig's setup-pose all-skins world-AABB (W×H px) via the dual-runtime adapter and surfaces it as an additive `SkeletonSummary.bbox: {w,h}|null` — the reference axes the Wave-2 two-way scale↔dimension control reads.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-23T00:31:01 (local, +01:00)
- **Completed:** 2026-05-22T23:34:26Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 7 (1 created, 6 modified)

## Accomplishments

- New `src/core/setup-bounds.ts` (`computeSetupPoseBounds`, 89 lines): Layer-3-pure, dual-runtime, all-skins manifest union at setup-pose with a degenerate `measured===0 -> null` guard. Generalizes the proven `aggregateWorldAABB` body (swapping its slot-bindings inner loop for the sampler Pass-1.5 manifest union, D-06) and reuses `attachmentWorldAABB` (no re-implemented AABB math, CLAUDE.md #2).
- Additive `SkeletonSummary.bbox: {w,h}|null` threaded through `types.ts` (declared) + `summary.ts` (computed once via the already-bound `rt`, no second ctor) — mirrors the `runtimeTag` additive-field precedent, no new IPC channel.
- V1-V7 coverage GREEN: 4.2 finite, 4.3 finite + no cross-runtime crash, editor-header cross-check ~1% (D-08), all-skins envelope ≥ subset (D-06), degenerate→null (T-50-FIN), summary bbox finite-or-null + structuredClone-safe, and a named Layer-3 purity anchor.

## Task Commits

Each task was committed atomically (both TDD):

1. **Task 1: Wave-0 RED test scaffold (V1-V7)** - `5b42db0` (test)
2. **Task 2: implement computeSetupPoseBounds + SkeletonSummary.bbox seam (GREEN)** - `7ffb8d5` (feat)

_TDD gate compliance: `test(...)` RED commit precedes the `feat(...)` GREEN commit; RED was confirmed for the right reason (missing `computeSetupPoseBounds` module + missing `bbox` field, not a typo). No REFACTOR commit was needed — the GREEN implementation was already clean._

## Files Created/Modified

- `src/core/setup-bounds.ts` (created) - Layer-3-pure `computeSetupPoseBounds(load): {w,h}|null`; all-skins setup-pose AABB union via `load.runtime` adapter; degenerate→null guard.
- `src/shared/types.ts` (modified) - additive `SkeletonSummary.bbox: {w,h}|null` field after `runtimeTag`.
- `src/main/summary.ts` (modified) - import `computeSetupPoseBounds`; compute `bbox` once before the return via the already-bound `rt`; return it as a sibling to `runtimeTag`.
- `tests/core/setup-bounds.spec.ts` (created) - V1-V5: 4.2 finite, 4.3 finite no-crash, cross-check oracle, all-skins envelope, degenerate null.
- `tests/main/summary.spec.ts` (modified) - V6: bbox finite-or-null + structuredClone-safe + non-null on SIMPLE_TEST.
- `tests/arch.spec.ts` (modified) - V7: named Layer-3 purity anchor for `setup-bounds.ts` (content-grep, range-free, ENOENT-tolerant).
- `tests/core/documentation.spec.ts` (modified) - Rule-3 fix: added `bbox: null` to the strict-typed `SkeletonSummary` mock (the new required field).

## Decisions Made

None beyond the LOCKED plan decisions (D-05/D-06/D-07/D-08, T-50-FIN). Implementation followed the plan's `<interfaces>` + `<action>` blocks exactly:
- D-05: bbox computed from runtime geometry; editor `skeleton.width/height` read ONLY as the V3/V4 cross-check oracle (D-08), never the source.
- D-06: all-skins manifest union (sampler Pass-1.5 loop), not live slot bindings.
- D-07: dual-runtime via `load.runtime.makeSkeleton`, loud null-guard, no hardcoded ctor.
- T-50-FIN: degenerate `measured===0 -> null`, never `-Infinity`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `bbox: null` to the strict-typed SkeletonSummary mock in documentation.spec.ts**
- **Found during:** Task 2 (implement + `typecheck:node` gate)
- **Issue:** Adding the new REQUIRED `bbox` field to `SkeletonSummary` broke `tests/core/documentation.spec.ts:233`, a `makeSummary(): SkeletonSummary` helper returning a full literal cast — `typecheck:node` flagged `Property 'bbox' is missing`. This blocked the Task-2 verify gate.
- **Fix:** Added `bbox: null` to the mock with a comment matching the existing additive-field stub style. Also removed an unused `OpaqueSkeletonData` import from my own new `setup-bounds.spec.ts` (TS6196), surfaced by the same typecheck run.
- **Files modified:** tests/core/documentation.spec.ts, tests/core/setup-bounds.spec.ts
- **Verification:** `npm run typecheck:node` exits 0; full V1-V7 + documentation suites GREEN (51/51).
- **Committed in:** `7ffb8d5` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — Rule 3)
**Impact on plan:** The fix is the standard additive-required-field fallout; necessary for the typecheck gate. No scope creep — the change surface is exactly the 7 plan-named files. `typecheck:web` also clean (0 errors); the renderer SkeletonSummary mocks use partial/unknown casts and were unaffected.

## Issues Encountered

**Two pre-existing test failures in the wave-merge sweep — absent local fixtures, NOT a 50-01 regression.**
`npm run test` reported 1 failed / 1454 passed across 146 files. Both failures are unrelated to this plan:

| Spec | Failure | Missing fixture |
|------|---------|-----------------|
| `tests/main/sampler-worker-girl.spec.ts` | warm-up worker run returns `error` | `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (absent, not git-tracked) |
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `SkeletonJsonNotFoundError` at import (7 tests skipped) | `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` (absent, not git-tracked) |

These are IP-sensitive fixtures kept local-only (CLAUDE.md folder conventions; memory `project_rigs_committable_json_atlas_only_no_png`), absent from this fresh agent worktree. Neither failing spec references `setup-bounds`/`computeSetupPoseBounds`/`bbox`, and both spec files are byte-untouched by the 50-01 commits (`git diff bcfeebb..HEAD` = only the 7 plan files + the Rule-3 mock fix). Logged to `deferred-items.md` per the SCOPE BOUNDARY rule — not fixed (out of scope). The canonical tree / CI (with fixtures provisioned) is authoritative for these two specs.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **50-02 (Wave 2, SCALEUI-01, depends 50-01) is unblocked:** `summary.bbox` carries the reference axes; the Scale-card enrichment reads it with zero new IPC/props.
- No new fixture dir was committed (bbox math reads no PNG bytes; the degenerate case is constructed in-test via a stub runtime) — the SAFE-01 denylist landmine was pre-empted, no `SAFE01_EXCLUDED_PREFIXES` change needed.
- `npm run typecheck:node` + `npm run typecheck:web` clean; V1-V7 GREEN; full suite GREEN modulo the two absent-fixture pre-existing failures above (and the documented ~11 Phase-47-owned MixBlend renderer IMPORT failures, which did not surface here).

## Self-Check: PASSED

- FOUND: `src/core/setup-bounds.ts`
- FOUND: `tests/core/setup-bounds.spec.ts`
- FOUND: `.planning/phases/50-rig-bounds-two-way-scale-dimension-input/50-01-SUMMARY.md`
- FOUND commit: `5b42db0` (test RED)
- FOUND commit: `7ffb8d5` (feat GREEN)

---
*Phase: 50-rig-bounds-two-way-scale-dimension-input*
*Completed: 2026-05-22*
