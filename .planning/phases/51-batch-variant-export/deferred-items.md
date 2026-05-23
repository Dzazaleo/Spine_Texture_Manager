# Phase 51 — Deferred / Out-of-Scope Items

Discovered during execution of 51-01-PLAN.md. These are NOT caused by this plan's
changes and are NOT fixed here (SCOPE BOUNDARY — failures in unrelated files).

## Out-of-scope `npm run test` failures (missing gitignored fixtures)

Two test files fail in this worktree because their fixtures are local-only /
gitignored and did not carry into the fresh worktree checkout. Neither file is
touched by plan 51-01 (which modifies only `variant-export.ts`, `ipc.ts`,
`preload/index.ts`, `types.ts`, and adds `variant-batch-faithful.spec.ts`).

1. `tests/main/sampler-worker-girl.spec.ts`
   - Failure: warm-up run errors — `fixtures/Girl/` is absent.
   - Cause: `fixtures/Girl/` is a local-only / gitignored fixture (per the
     documented "gitignored fixtures + platform/OS divergence; local green ≠ CI
     green" pattern). Not committed → absent in the fresh worktree.

2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`
   - Failure: `SkeletonJsonNotFoundError` for
     `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`.
   - Cause: the test's OWN header comment (line 70) states
     `fixtures/SAMPLER_ALPHA_ZERO/` is gitignored (proprietary Joker rig). Absent
     in the fresh worktree by design.

Both are environmental (missing local fixtures), pre-existing, and orthogonal to
the batch-export engine. The relevant batch + Phase-49 + typecheck gates are all
green (see 51-01-SUMMARY.md). No action taken per the SCOPE BOUNDARY rule.

## Re-observed during 51-02 (2026-05-23)

The SAME two failures recur in the 51-02 worktree (same absent gitignored
fixtures). 51-02 touches only renderer + preload + types + renderer tests
(`VariantDialog.tsx`, `variant-scale-derive.ts`, `AppShell.tsx`,
`preload/index.ts`, `types.ts`, the variant `.spec.tsx`/`.spec.ts` tests) — none
of the two failing files. The full suite is otherwise green
(1482 passed / 1 failed [the Girl warm-up] / 24 skipped + 2 todo; the second
failure is a FAILED SUITE = the SAMPLER_ALPHA_ZERO import). typecheck:node +
typecheck:web + arch.spec.ts + all four variant specs are green. No action taken
per the SCOPE BOUNDARY rule.
