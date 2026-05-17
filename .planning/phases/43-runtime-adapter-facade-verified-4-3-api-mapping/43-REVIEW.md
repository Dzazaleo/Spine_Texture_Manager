---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - electron.vite.config.ts
  - src/core/runtime/runtime.ts
  - tests/main/sampler-worker.spec.ts
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 43: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the three files changed by Phase 43 gap-closure plan 43-06 (closes
GAP-43-PROD-SEAM). Scope-excluded items (LOCKED prod-arm `require` strings,
the `eslint-disable`, the `rollupOptions.input` adapter entries, the §4
bounded-exception, the pre-existing MixBlend failures) were verified as
out-of-scope and are not reported.

**The core fix is correct.** I traced the built artifacts to confirm: the
worker entry (`out/main/sampler-worker.cjs`) requires
`./chunks/sampler-C9iw47Gq.cjs`, whose `pickRuntime` body emits
`require("../runtime-42.cjs")`; resolved relative to `out/main/chunks/` that
lands on the real emitted `out/main/runtime-42.cjs`. Path arithmetic
(`chunks/` + `../runtime-42.cjs` → `out/main/runtime-42.cjs`) is sound, and
Rollup correctly constant-folded `loader.ts:250`'s hard-coded
`pickRuntime('4.2')` so the `'4.3'` arm and its `@esotericsoftware/spine-core`
graph are genuinely tree-shaken out of the worker chunk (ARCHITECTURE §4 lazy
single-copy verified empirically: `runtime-42.cjs` has 0
`@esotericsoftware/spine-core` literals, `runtime-43.cjs` has 0
`spine-core-42` adapter literals). The `electron.vite.config.ts` change is
correct and matches the mandated build-order item.

The findings below are genuine NEW quality/robustness defects introduced by
the rewritten spawn-smoke test in `tests/main/sampler-worker.spec.ts`, plus
one durable-coupling concern in `runtime.ts` and minor quality items. No
blockers — the production behavior is correct; the issues degrade test
reliability and CI robustness.

## Warnings

### WR-01: Spawned worker process is leaked on every non-resolving / error path of the spawn-smoke test

**File:** `tests/main/sampler-worker.spec.ts:198-243`
**Issue:** `new Worker(WORKER_BUNDLE, ...)` is created at line 198. The worker
is only terminated at line 240 — *after* all four `expect(...)` assertions
(lines 227-238). If any of those assertions throws (e.g.
`finalMsg.type` is `'error'` so `expect(finalMsg.type).toBe('complete')`
fails, or the `cannotFindRuntime` assertion fails — which is the *exact*
regression this test exists to catch), `await worker.terminate()` is never
reached and the spawned Node worker thread is orphaned for the remainder of
the vitest process. The built worker also calls `process.exit(0)`
(`out/main/sampler-worker.cjs`) on completion, but on the failure paths the
worker may still be running its 120 Hz sample loop. There is no
`try/finally`. The pre-43-06 version had the same shape, but 43-06 newly
*hardens this into the primary regression gate* whose assertions are now
*expected to fail RED on a pre-fix bundle* — making the leak path the common
case during a regression, not an edge case.
**Fix:** Wrap the body in `try/finally` so the worker is always torn down:
```ts
const worker = new Worker(WORKER_BUNDLE, { workerData: { ... } });
try {
  const finalMsg = await new Promise(...);
  // ... assertions ...
} finally {
  await worker.terminate();
}
```

### WR-02: `worker.on('error')` rejection bypasses the GAP-43-PROD-SEAM negative falsifier — the regression can slip through as a generic reject

**File:** `tests/main/sampler-worker.spec.ts:203-233`
**Issue:** The Promise rejects via `worker.on('error', (err) => reject(err))`
(line 211). The block's stated purpose (lines 215-220) is to assert the
SPECIFIC negative: a `{type:'error', message:/Cannot find module
.*runtime-4/}` *message event*. That negative falsifier (lines 221-233) only
runs if the Promise *resolves*. If the orphaned-require failure surfaces as a
worker thread `'error'` event (uncaught exception in the worker, not a
serialized `{type:'error'}` postMessage) instead of through
`runSamplerJob`'s catch → `serializeError`, the Promise rejects, the test
fails with a raw rejection, and the precise `cannotFindRuntime` assertion at
line 227 is never evaluated. The test comment claims the orphaned require
"surfaces (via runSamplerJob's catch → serializeError) as {type:'error'...}"
— but a `require()` failure during *module load of the worker chunk* (before
`runSamplerJob`'s try block is entered) would be an uncaught worker error,
not a caught/serialized one. The regression assertion has a blind spot
exactly where the regression is most likely to manifest.
**Fix:** Inspect the rejection reason for the runtime-4x signature before
re-throwing, so the specific regression is still named:
```ts
worker.on('error', (err) => {
  if (/Cannot find module .*runtime-4/.test(String(err?.message))) {
    reject(new Error(
      `GAP-43-PROD-SEAM REGRESSION (worker 'error' event): ${err.message}`));
  } else {
    reject(err);
  }
});
```

### WR-03: Heavy `electron-vite build` is run as a side-effect inside the test body, not in a `beforeAll` hook

**File:** `tests/main/sampler-worker.spec.ts:148-196`
**Issue:** `ensureFreshWorkerBundle()` runs `execFileSync('npx',
['electron-vite', 'build'], { timeout: 240_000 })` and is invoked from inside
the `it(...)` body at line 196. Consequences: (1) the 240 s build is counted
against the per-test 300 s budget, leaving only 60 s for spawn + sample +
terminate — a slower CI runner that takes >60 s to build-and-sample will fail
on timeout, not on the actual regression, producing a misleading red. (2) A
full bundler invocation as an undeclared test side-effect mutates `out/`
shared by every other spec in the run (e.g. the other `sampler-worker` cases
read `out/main/sampler-worker.cjs`); ordering-dependent flakiness if vitest
parallelizes specs touching `out/`. (3) `stdio: 'ignore'` discards build
diagnostics, so a genuine non-MixBlend build break is invisible — the
`catch {}` (lines 167-171) swallows *all* failures, then the existence check
reports a generic "not emitted" instead of the real compiler error.
**Fix:** Move the build into `beforeAll(async () => { ... }, 300_000)` so it
runs once with its own timeout budget, and capture stdout/stderr (e.g.
`stdio: 'pipe'`) so that on the "bundle not emitted" branch the actual build
output is included in the thrown error message for diagnosis.

### WR-04: Stale-bundle freshness guard uses a 5 s back-dated threshold that can false-PASS a stale bundle on a fast no-op rebuild

**File:** `tests/main/sampler-worker.spec.ts:182-190`
**Issue:** The freshness gate is `if (mtimeMs < t0 - 5_000) throw STALE`,
where `t0 = Date.now()` is captured *before* the build. The comment justifies
this as the GAP-43-PROD-SEAM evasion guard. But electron-vite/Rollup does not
guarantee it rewrites the output file when inputs are unchanged — if a prior
build already produced an up-to-date `sampler-worker.cjs` and the bundler
skips the write (or writes within microseconds of an incremental no-op), the
mtime can legitimately be from a *previous* run and still be `>= t0 - 5_000`
only by luck of timing. Conversely the `-5_000` slack means a bundle written
up to 5 s *before* the build started is accepted as "fresh." The guard keys
freshness off wall-clock proximity rather than off "this build wrote this
file," so it neither reliably catches a stale bundle nor reliably passes a
correctly-rebuilt one — it is a heuristic masquerading as a hard gate, in a
test whose entire stated value is being a non-evadable hard gate.
**Fix:** Delete the artifact before building and assert it was recreated,
which is deterministic regardless of bundler write-elision and clock skew:
```ts
rmSync(WORKER_BUNDLE, { force: true });
try { execFileSync('npx', ['electron-vite','build'], {...}); } catch {}
if (!existsSync(WORKER_BUNDLE)) throw new Error('GAP-43-PROD-SEAM gate: not re-emitted ...');
```

## Info

### IN-01: `pickRuntime` correctness now depends on an undocumented Rollup constant-folding contract

**File:** `src/core/runtime/runtime.ts:189-205`
**Issue:** The prod arm's lazy single-copy guarantee is only preserved because
Rollup constant-propagates the single hard-coded caller
(`loader.ts:250` → `pickRuntime('4.2')`) and tree-shakes the
`tag === '4.2' ? require('../runtime-42.cjs') : require('../runtime-43.cjs')`
ternary down to `require("../runtime-42.cjs")` (verified in
`out/main/chunks/sampler-C9iw47Gq.cjs`). This is correct *today*, but the
behavior silently depends on every `pickRuntime` caller passing a
statically-analyzable literal. The moment a future caller passes a dynamic
`tag` (e.g. derived from skeleton version detection in a later 4.3 phase),
the ternary stops folding, *both* `require('../runtime-4x.cjs')` literals
survive in the worker chunk, and — because each adapter `.cjs` bare-requires
its own spine-core copy — the §4 lazy single-copy invariant breaks with no
test catching it (the spawn-smoke only ever exercises the 4.2 path). The
extensive comment block documents the *path arithmetic* but not this
*constant-fold dependency*, which is the actual load-bearing assumption.
**Fix:** Add a one-line note to the prod-arm comment recording that
lazy-single-copy in the bundled worker depends on callers passing a
statically-foldable literal `tag`, and that a dynamic `tag` would co-bundle
both spine-core graphs — so a future 4.3 dynamic-pick phase must re-verify §4
(or split the require behind a dynamic-import boundary).

### IN-02: Unused-import / dead-symbol risk: `existsSync` retained alongside new `statSync`

**File:** `tests/main/sampler-worker.spec.ts:20`
**Issue:** Minor, but worth noting after the WR-04 fix: if the stale-bundle
guard is reworked to delete-then-rebuild, `statSync` becomes unused. As
written today both `existsSync` and `statSync` are used, so this is not a
current defect — flagged only so the importer is tidied if WR-04 is applied.
**Fix:** Re-check the import line after addressing WR-04; drop `statSync` if
the mtime check is removed.

### IN-03: `events` typed array in spawn-smoke includes a `percent?` field that is never asserted

**File:** `tests/main/sampler-worker.spec.ts:201, 237`
**Issue:** The `events` accumulator carries `percent?: number`, and the test
asserts `events.some((e) => e.type === 'progress')` (line 237) but never
checks the progress `percent` payload (the other `D-194` test at lines 73-90
does assert monotonic 0→100). Not a bug — the dedicated progress test covers
the percent contract — but the `percent?` field on this type is decorative
here and slightly overstates what the smoke test verifies. Low priority.
**Fix:** Either drop `percent?` from this block's local event type, or add a
brief comment that progress-payload assertions live in the D-194 progress
test (cross-reference) to prevent a future reader assuming this test guards
percent ordering.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
