# Phase 37 — Deferred Items (out-of-scope discoveries)

These were discovered while running `npm test` during Plan 37-02 execution but are NOT caused by Plan 37-02's changes. Logged per executor scope-boundary rule (only fix issues DIRECTLY caused by current task changes).

## Pre-existing test failures from missing local fixtures

Both failures reference gitignored fixture directories that do not exist in this worktree (created fresh from the base commit `56466bc`). Plan 37-02 did not touch these tests or fixtures.

### 1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`

- **Failure:** `SkeletonJsonNotFoundError: Spine skeleton JSON not found or not readable: fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`
- **Cause:** `fixtures/SAMPLER_ALPHA_ZERO/` is gitignored and not present in the worktree.
- **Plan 37-02 impact:** None — neither this fixture nor this test file was touched by Plan 37-02.

### 2. `tests/main/sampler-worker-girl.spec.ts`

- **Failure:** Warm-up run errors because `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` is missing.
- **Cause:** `fixtures/Girl/` is gitignored and not present in the worktree.
- **Plan 37-02 impact:** None — neither this fixture nor this test file was touched by Plan 37-02.

## Disposition

Both failures are infrastructure-only — they fail whenever the worktree does not have the large local fixtures hydrated. Re-running `npm test` on a developer host with the fixtures present is expected to pass these. They are not Phase 37 regressions.

## Plan 37-02 sampler test results

All 37 sampler tests in `tests/core/sampler.spec.ts` (the file Plan 37-02 modifies) pass; 1 pre-existing `EASING-CURVE STRETCH` skip is preserved. New `TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline` test passes with observed peak ratio 2.5x (BASELINE=0.4, INHERIT_DETACH=1.0).
