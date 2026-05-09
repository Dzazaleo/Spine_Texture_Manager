# Phase 29 — deferred items (out-of-scope failures observed during plan execution)

Logged per the GSD executor SCOPE BOUNDARY rule: failures unrelated to the
task at hand are tracked here, NOT auto-fixed.

## Plan 29-05 execution discovery (2026-05-07)

The full `npm run test` run after Task 1 + Task 2 surfaced two failures that
pre-exist the plan (verified by stashing all 29-05 changes and re-running
the offending specs — they fail identically without 29-05 modifications):

### 1. `tests/main/sampler-worker-girl.spec.ts`

```
sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl) >
fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms ...
AssertionError: warm-up run must complete (not error/cancel):
expected 'error' to be 'complete'
```

Root cause: warm-up run errored at the worker layer (not a wall-time
breach). Fixture `fixtures/Girl/...` is gitignored (full Chicken/Girl rigs
not committed); the worker errors on missing fixture data. Out of 29-05
scope (panel selection handoff fix, not sampler/worker plumbing).

### 2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`

```
sampler — skin-declared but never-bound attachments are measured
(regression for silent-discard at sampler.ts:285)
loadSkeleton src/core/loader.ts:154:11
```

Root cause: loadSkeleton fails before the test body runs. Likely a
fixture-availability or loader-config issue unrelated to 29-05. Out of
scope.

Both failures persist on the worktree base commit (`c35b9d3`). They are
NOT introduced by Plan 29-05 and should be triaged in a separate
backlog item.
