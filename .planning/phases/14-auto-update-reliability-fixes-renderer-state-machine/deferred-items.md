# Phase 14 — Deferred Items (out-of-scope discoveries during execution)

Items discovered during Phase 14 execution that fall outside the scope boundary
of the plan that found them. Logged here per the GSD execute-plan
SCOPE_BOUNDARY rule (do not auto-fix issues unrelated to the current task's
changes; do not let pre-existing failures block plan progress).

## Pre-existing test failures observed at worktree base commit `9031c92`

### sampler-worker-girl.spec.ts — warmup run reports `error` instead of `complete`

**Discovered during:** Plan 14-02 (preload bridge addition).
**File:** `tests/main/sampler-worker-girl.spec.ts:38`
**Symptom:**
```
expect(warmup.type, 'warm-up run must complete (not error/cancelled)').toBe('complete')
Expected: "complete"
Received: "error"
```

**Verification it pre-exists:** Stashed Plan 14-02 changes, re-ran spec at base
commit `9031c92` — same failure. Therefore not caused by Plan 14-02's
preload bridge addition (preload changes have zero overlap with the sampler
subsystem; sampler is `src/core/sampler-worker.ts` + worker-thread harness).

**Disposition:** OUT-OF-SCOPE for Phase 14 (auto-update reliability fixes).
Belongs to a separate sampler-engine investigation. Carry to a future bug-fix
plan or v1.2 hardening pass — does not block Phase 14 plans.

**Impact on Phase 14:** None. Plan 14-02 verification covered:
- Plan-named specs: `tests/renderer/help-dialog.spec.tsx` (8/8) +
  `tests/renderer/save-load.spec.tsx` (8/8) — all green.
- Plan 14-02 own spec: `tests/preload/request-pending-update.spec.ts` (7/7)
  — all green.
- `npx tsc --noEmit -p tsconfig.json` — exits 0.
- Whole suite: 457 passed / 1 failed / 2 skipped / 2 todo — the 1 failure is
  this pre-existing sampler-worker-girl issue, NOT a regression introduced
  by Plan 14-02.
