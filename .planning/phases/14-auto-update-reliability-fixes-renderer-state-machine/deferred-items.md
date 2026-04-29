# Phase 14 — Deferred Items (out-of-scope discoveries during execution)

Items discovered during Phase 14 execution that fall outside the scope boundary
of the plan that found them. Logged here per the GSD execute-plan
SCOPE_BOUNDARY rule (do not auto-fix issues unrelated to the current task's
changes; do not let pre-existing failures block plan progress).

## Pre-existing test failures observed at worktree base commit `9031c92`

### sampler-worker-girl.spec.ts — warmup run reports `error` instead of `complete`

**Discovered independently during:** Plans 14-01 (main-side) and 14-02 (preload bridge).

**File:** `tests/main/sampler-worker-girl.spec.ts:38`

**Symptom:**
```
expect(warmup.type, 'warm-up run must complete (not error/cancelled)').toBe('complete')
Expected: "complete"
Received: "error"
```

Warm-up run on `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` resolves with
`type='error'` instead of `'complete'`.

**Verification it pre-exists:** Both 14-01 and 14-02 executors verified by
stashing their respective in-progress changes and re-running the spec at base
commit `9031c92` — same failure reproduces. Confirms pre-existing, not a
regression introduced by either plan.

**Why both plans saw it without scope overlap:**
- Plan 14-01 modifies `src/main/auto-update.ts` + `src/main/ipc.ts`. Neither
  is reachable from the sampler-worker test (which exercises
  `src/core/sampler-worker.ts` + the worker-thread harness on a Girl fixture).
- Plan 14-02 modifies `src/preload/index.ts` + (Rule 3 auto-fix)
  `src/shared/types.ts`. Zero overlap with the sampler subsystem.

**Disposition:** OUT-OF-SCOPE for Phase 14 (auto-update reliability fixes
only). Belongs to a separate sampler-engine investigation. Carry to a future
bug-fix plan or v1.2 hardening pass — does not block Phase 14 plans.

**Owner:** Sampler subsystem maintainer.

**Impact on Phase 14 verification:**
- 14-01 own specs: `tests/main/auto-update.spec.ts` (28/28) +
  `tests/main/ipc.spec.ts` (16/16) — all green.
- 14-02 own spec: `tests/preload/request-pending-update.spec.ts` (7/7) — all green.
- `npx tsc --noEmit -p tsconfig.json` — exits 0.
- Whole suite: 457 passed / 1 failed / 2 skipped / 2 todo — the 1 failure is
  this pre-existing sampler-worker-girl issue, NOT a regression introduced
  by Phase 14 work.
