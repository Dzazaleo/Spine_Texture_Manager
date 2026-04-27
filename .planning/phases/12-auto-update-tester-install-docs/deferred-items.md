# Phase 12 — Deferred Items

Out-of-scope discoveries during Phase 12 execution. Logged here per SCOPE BOUNDARY rule
(do not auto-fix issues unrelated to current task's changes).

## Pre-existing typecheck failure in `scripts/probe-per-anim.ts` (carried forward from Phase 11)

**Discovered:** Plan 12-02, Task 1 verification (`npm run typecheck`)
**Status:** Pre-existing (reproduced with `git stash` of Task 1's `package.json` edit — error survives revert).
**Symptom:**
```
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
```
**Why deferred:** Identical surface to the Phase 11 deferred-items entry; the probe script
predates Phase 11 and is unrelated to anything Phase 12 touches. The `electron-updater@6.8.3`
install resolves cleanly (no new TS diagnostics introduced); fixing the probe script would
mix unrelated cleanup into a CI-release-pipeline plan.

**Disposition:** Triage in a future maintenance plan. Does NOT block Phase 12 closure
(the workflow's `test` job runs `npm run typecheck` against `tsconfig.node.json` /
`tsconfig.web.json` against actual source — `scripts/` is a separate probe surface).

**Note:** The `npm run test` (vitest) suite is fully green (331 passing) — this is the
correctness gate the workflow's `test` job actually enforces.
