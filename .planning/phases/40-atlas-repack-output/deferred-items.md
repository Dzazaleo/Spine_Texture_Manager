# Phase 40 — Deferred Items (out-of-scope discoveries)

## Pre-existing test failure — `tests/main/sampler-worker-girl.spec.ts`

**Discovered during:** Plan 40-04 (resize helper extraction)
**Status:** Pre-existing, NOT caused by this phase's changes
**Verified:** Failure reproduces with `git stash` applied (clean pre-Plan-04 tree)

**Failure shape:**
```
sampler-worker-girl.spec.ts:38
expect(warmup.type, 'warm-up run must complete (not error/cancel...')
  Expected: "complete"
  Received: "error"
```

The warm-up `runSamplerStream` call from the test setup returns `type: "error"`
on the current `worktree-agent-a3a6d26189a601ff8` base (commit `8a586cf`),
unrelated to image-worker / sharp-resize.

**Action:** Surfaced here for a future phase to triage. Not a Plan 04 regression.
