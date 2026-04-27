# Phase 11 — Deferred Items

Out-of-scope discoveries during Phase 11 execution. Logged here per SCOPE BOUNDARY rule
(do not auto-fix issues unrelated to current task's changes).

## Pre-existing typecheck failure in `scripts/probe-per-anim.ts`

**Discovered:** Plan 11-01, Task 1 verification (`npm run typecheck`)
**Status:** Pre-existing (reproduced with `git stash` of Task 1's `package.json` edit — error survives revert).
**Symptom:**
```
scripts/probe-per-anim.ts(14,31): error TS2339: Property 'values' does not exist on type 'SamplerOutput'.
```
**Why deferred:** The error is in a developer probe script (`scripts/probe-per-anim.ts`),
not in any file Plan 11-01 modifies. Plan 11-01 only touches `package.json` script values,
`.github/workflows/release.yml`, and `.github/release-template.md` — none affect TS source.
The failure is unrelated to the `--publish never` script bake-in. Fixing it would mix
unrelated cleanup into the CI-release commit history.

**Disposition:** Triage in a future maintenance plan. Does NOT block Phase 11 closure
(the workflow's `test` job runs `npm run typecheck` against `tsconfig.node.json` /
`tsconfig.web.json` against actual source — `scripts/` is a separate probe surface).

**Note:** The `npm run test` (vitest) suite is fully green (331 passing) — this is the
correctness gate the workflow's `test` job actually enforces.
