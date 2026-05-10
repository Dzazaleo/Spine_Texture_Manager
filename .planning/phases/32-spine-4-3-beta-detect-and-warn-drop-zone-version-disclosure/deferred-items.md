# Phase 32 — Deferred Items (out-of-scope discoveries)

## tests/core/sampler-skin-defined-unbound-attachment.spec.ts — pre-existing fixture-absence failure

**Discovered during:** Plan 32-01 Task 2 verification (`npm test -- tests/core/ --run`).
**Status:** Pre-existing — NOT a Phase 32 regression.

The test imports a fixture at `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`, which is gitignored (CI skip pattern). git log shows commit `40a4f2c fix(ship-v1.3): skip sampler-skin-attachment test on CI (gitignored fixture)` — the test was already failing pre-Phase-32 and the v1.3 ship commit added a CI-skip mechanism. The 7 inner tests all skip cleanly, but the suite-loading throws `SkeletonJsonNotFoundError` because `loadSkeleton` is called at module top-level (or in `beforeAll`) BEFORE the skip-gate fires.

**Why deferred:** Out of Phase 32's scope (loader version-guard + drop-zone copy + SEED-006 plant). The failure exists with or without Phase 32 changes — verifiable by checking out the worktree base commit `6c2fd8e`.

**Owner:** v1.4 backlog (or future fixture restoration / suite-loading guard).
