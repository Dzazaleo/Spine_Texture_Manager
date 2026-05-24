# Phase 52 — Deferred / Out-of-Scope Items

Discovered during plan 52-04 execution (2026-05-24). Out of scope for 52-04 (test-only
plan locking the dup-skip / orphan-cleanup / token-equivalence behaviors). NOT fixed.

## Pre-existing full-suite failures (environmental — missing local-only fixtures)

The full `npx vitest run` in this worktree shows 2 failing test files. BOTH are
byte-identical to the base commit `a8835a8` (`git diff --stat a8835a8 HEAD` on each is
empty) and have NO relationship to the 52-04 changes (which touched only
`tests/main/variant-token-equivalence.spec.ts`, `tests/main/variant-batch-faithful.spec.ts`,
and `tsconfig.node.json`). Both fail because their fixtures are not present in this
worktree (local-only / gitignored painted-PNG fixtures, per the project convention that
only json+atlas fixtures are committed):

1. `tests/main/sampler-worker-girl.spec.ts` — wall-time gate on `fixtures/Girl/`; the
   warm-up run errors because `fixtures/Girl/` does not exist in this worktree.
2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — throws
   `SkeletonJsonNotFoundError` for `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`,
   which is absent in this worktree.

**Disposition:** out of scope (SCOPE BOUNDARY — failures in unrelated files not caused by
this task's changes). Not fixed, not investigated further. Likely resolve on the main
checkout where the local fixtures exist; the orchestrator/verifier should confirm against
a checkout that has the full fixture set. The 52-04 target specs + both typechecks are
fully green.
