# Phase 40 — deferred items (out-of-scope discoveries during execution)

Items logged here are pre-existing issues observed during execution of Phase 40
plans that are NOT in the plan's `files_modified` and were NOT caused by the
plan's changes. Per the executor scope-boundary rule, these are noted but not
fixed in-plan.

## During Plan 40-01 execution (2026-05-14)

### Pre-existing test failures (missing fixtures)

Two test files fail at the base commit `8a586cf` (verified before any 40-01
work) because their required fixtures are not present in this worktree:

- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`
  - Missing: `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`
  - All 7 tests skipped at suite-setup time
  - Likely human-fixture-only or gitignored heavy fixture

- `tests/main/sampler-worker-girl.spec.ts`
  - Missing: `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`
  - Warm-up sampler run returns `error` instead of `complete`
  - Wall-time gate cannot proceed without fixture

These failures pre-date Phase 40 and are unrelated to the atlas-field schema
changes in Plan 40-01.

### Pre-existing TypeScript lint error

- `tests/main/image-worker-rotation.spec.ts:187,13` — `error TS6133: 'data'
  is declared but its value is never read.`
- Pre-existing unused-binding warning; not introduced by Plan 40-01.

## During Plan 40-04 execution (2026-05-14)

### Pre-existing test failure — `tests/main/sampler-worker-girl.spec.ts` (re-observed)

**Failure shape:**
```
sampler-worker-girl.spec.ts:38
expect(warmup.type, 'warm-up run must complete (not error/cancel...')
  Expected: "complete"
  Received: "error"
```

Same root cause as the Plan 40-01 observation above (missing `fixtures/Girl/`
fixture). Verified pre-existing via `git stash` applied to clean pre-Plan-04
tree by the 40-04 executor.

**Action:** Surfaced for future triage. Not a Plan 04 regression.
