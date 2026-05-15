# Phase 41 — Deferred Items

Out-of-scope items discovered during plan execution. Per executor deviation rules, these are NOT fixed inside the plan that found them.

## DEF-41-01-01 — Worktree-isolated fixtures cause pre-existing test failures (Plan 01 discovery, 2026-05-15)

While running `npm test` (full suite) at the end of Plan 41-01 to confirm no regression, two pre-existing failures surfaced:

| Test File | Failure | Root cause |
|-----------|---------|------------|
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `SkeletonJsonNotFoundError: fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` | Fixture exists in main repo working tree (`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/SAMPLER_ALPHA_ZERO`) but is NOT in the worktree base commit `63e4a87` — local-only / gitignored asset, not part of the checked-in fixture set. |
| `tests/main/sampler-worker-girl.spec.ts` | warm-up run returns `'error'` instead of `'complete'` against `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` | Same root cause — `fixtures/Girl/` is in main working tree but not in the worktree base commit. |

**Why this is out of scope for Plan 41-01:** Plan 01 only touches `package.json`, `package-lock.json`, `src/shared/types.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, and a new test file under `tests/main/`. None of those changes affect the sampler core, the loader, or the missing fixtures. The failures reproduce against the base commit `63e4a87` before any plan changes land — they are not regressions introduced by this plan.

**Verification:** The plan's own scoped suite `npm test -- tests/main/viewer-asset-feed-ipc.spec.ts` runs 4/4 green. TypeScript compilation (`npx tsc --noEmit`) is clean.

**Resolution path:** Either (1) gitignore the affected specs in worktree mode, (2) commit the missing fixtures into the repo if they're meant to be shared, or (3) the orchestrator's merge-back protocol restores the missing fixtures from the main worktree before re-running the suite post-merge. This is a worktree-tooling concern, not a Phase 41 concern.

