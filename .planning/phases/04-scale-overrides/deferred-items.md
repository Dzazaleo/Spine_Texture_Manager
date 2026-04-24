# Phase 4 — Deferred Items (out-of-scope discoveries)

Items discovered during Phase 4 execution that are NOT caused by Phase 4 changes and are logged here for later attention rather than auto-fixed mid-plan.

## 1. Pre-existing tsc error in scripts/probe-per-anim.ts

**Discovered:** Plan 04-01, Task 1 verification.

**Symptom:**
```
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
```

**Provenance:** Confirmed pre-existing — the error reproduces on an unmodified working tree (git stash + re-typecheck shows the same error). The `SamplerOutput` shape evolved over phases 2 and 3 and this ad-hoc probe script was never updated. It is not imported by any executable code path (`npm run test` / `npm run cli` / `npm run build` all pass without touching it).

**Scope:** Out of scope for Phase 4. The Phase 4 plan does not modify the sampler and does not touch any ad-hoc scripts in the root `scripts/` directory besides `scripts/cli.ts`.

**Recommendation:** Either update `scripts/probe-per-anim.ts` to match the current `SamplerOutput` shape (a one-field rename) or delete it during Phase 5/6 cleanup. Not Phase 4's problem.
