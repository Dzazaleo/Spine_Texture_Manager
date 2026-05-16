# Phase 42 — Deferred / Out-of-Scope Items

Logged by the Plan 42-01 executor per the SCOPE BOUNDARY rule. These are NOT
caused by Plan 42-01 (which adds only `tests/safe01/**` + a `.gitignore` rule).
Recorded for visibility; NOT fixed by this plan.

## Pre-existing local-only test failures (gitignored heavy-rig absence)

Both fail ONLY in this local worktree because the proprietary/licensed rigs they
drive are gitignored and absent here. They are `skipIf(process.env.CI)` /
`describe.skipIf(process.env.CI)` guarded and pass (skip) on a fresh CI clone or
for a developer who has the rigs locally. Confirmed pre-existing at the Plan
42-01 base commit (the `tests/safe01/` additions do not touch these files).

1. `tests/main/sampler-worker-girl.spec.ts`
   - Drives `fixtures/Girl/` (gitignored, .gitignore L22). `it.skipIf(process.env.CI)`.
   - Fails locally with fixture-ENOENT; out of Phase 42 scope.

2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`
   - Drives `fixtures/SAMPLER_ALPHA_ZERO/` (gitignored, .gitignore L36).
     `describe.skipIf(process.env.CI)` — beforeAll `loadSkeleton(FIXTURE)`
     ENOENT in a local worktree without the rig. 7 tests skipped on CI.
   - Fails locally with fixture-ENOENT; out of Phase 42 scope.

These two are exactly the D-08-R Option-A class of failure SAFE-01's two-tier
discovery is designed to NOT reproduce: the SAFE-01 enumeration + committed
baseline cover only the git-tracked redistributable subset.

## Pre-existing typecheck error (out of scope)

3. `tests/main/image-worker-rotation.spec.ts(190,13): error TS6133: 'data' is
   declared but its value is never read.`
   - VERIFIED present verbatim at the Plan 42-01 base commit
     `166523f4aaca5e002bf612bb7ae9d5b7c422d206` — predates this plan entirely.
   - File NOT modified by Plan 42-01 (last touched by unrelated commit 81707ac).
   - It is the ONLY `npm run typecheck` error and is in `tests/main/`, not in
     any `tests/safe01/` file. Out of Phase 42 scope; NOT fixed here.
   - SAFE-01 files (`tests/safe01/**`) are themselves typecheck-clean.
