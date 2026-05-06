# Phase 28 Deferred Items

## Pre-existing test failures (NOT introduced by Plan 28-01)

### `tests/main/sampler-worker-girl.spec.ts` — flaky wall-time gate

**Status:** Pre-existing on the Plan 28-01 base commit (`6f599063`).
**Verified:** 2026-05-06. Confirmed by `git stash` + re-running the test on
the baseline — same failure appears with no Plan 28-01 changes applied.

**Symptom:**
```
sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl)
> fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms
AssertionError: warm-up run must complete (not error/cancel):
expected 'error' to be 'complete'
```

**Why deferred:** Worktree-environment-specific. The fixture loads in the
warm-up run inside the worktree's reduced node_modules graph; the failure is
a `'error'` (not the timing assertion). Out of Plan 28-01 scope (no
sharpenOnExport plumbing touches the sampler worker or fixtures/Girl).

**Action:** Surface to the orchestrator after merge so a follow-up phase can
diagnose. Plan 28-02 / 28-03 may be unaffected since they target image-worker
not sampler-worker.

---

## Pre-existing TypeScript errors in OptimizeDialog.tsx

**Status:** Pre-existing on the Plan 28-01 base commit (`6f599063`).
Re-verified 2026-05-06 by `git stash` + re-running `tsc --noEmit -p
tsconfig.web.json`.

**Symptom:**
```
src/renderer/src/modals/OptimizeDialog.tsx(225,7): error TS2345: Argument
  of type 'string | null' is not assignable to parameter of type 'string'.
src/renderer/src/modals/OptimizeDialog.tsx(242,13): error TS2322: Type
  'string | null' is not assignable to type 'string'.
src/renderer/src/modals/OptimizeDialog.tsx(246,9): error TS2322: Type
  'string | null' is not assignable to type 'string'.
```

**Root cause:** `resolvedOutDir` is typed `string | null` but
`window.api.startExport`'s `outDir` param + `ExportSummary.path` /
`outputDir` fields are typed `string` (not nullable). The dialog's
`startExport` call already passes `null` here in the legacy code path —
the runtime accepts it (preload coerces) but tsc rejects.

**Why deferred:** Out of Plan 28-01 scope. Adding `sharpenOnExport` as
the 4th arg does not introduce these errors and does not exacerbate
them — they stay at exactly 3 occurrences before and after the Plan
28-01 changes.

**Action:** A follow-up phase or Plan 28-02 can either tighten the
`startExport` signature to accept `string | null` (matches runtime)
or add an early-return when `resolvedOutDir === null` in the dialog.

---

## Pre-existing TS6133 in AppShell.tsx — `onClickOpen` declared but never read

**Status:** Pre-existing on the Plan 28-01 base commit (`6f599063`).
Verified by checking out the base copy of AppShell.tsx and running tsc.

**Symptom:**
```
src/renderer/src/components/AppShell.tsx(1083,9): error TS6133:
  'onClickOpen' is declared but its value is never read.
```

**Root cause:** `onClickOpen` is defined as a useCallback but its only
caller in the JSX was removed by an earlier phase. The function still
references state (currentProjectPath, samplingInFlight, etc.) so the
unused warning is the only TS surface.

**Why deferred:** Out of Plan 28-01 scope. Adding the sharpenOnExportLocal
lifecycle does not touch this declaration. Removing dead code is a
separate cleanup task.

---

## Pre-existing renderer test failures in `tests/renderer/save-load.spec.tsx`

**Status:** Pre-existing on the Plan 28-01 base commit (`6f599063`).
Verified by `git stash` + re-running the test on the baseline — 2
failures appear identical with no Plan 28-01 changes applied.

**Symptom:** 2 tests fail in `save-load.spec.tsx`; `screen.getByRole('button',
{ name: /^Open$/i })` does not find the toolbar Open button (UI fixture
mismatch unrelated to sharpenOnExport plumbing).

**Why deferred:** Out of Plan 28-01 scope. The toolbar Open button selector
is not affected by sharpenOnExport plumbing. The Optimize dialog's tests
(if any) for the new checkbox should be covered by Plan 28-02 / 28-03.

**Action:** Surface to verifier for orchestrator triage. May require a
fixture refresh in a follow-up cleanup phase.

---

## Full pre-existing test-suite baseline (verified 2026-05-06)

Verified by `git checkout <base> -- src/` + `npm run test`. The following
4 test files contain pre-existing failures unrelated to Plan 28-01:

1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` —
   skin-declared but never-bound attachments regression. Sampler
   visibility invariant scope (see locked memory).
2. `tests/integration/build-scripts.spec.ts` — Phase 15 RESEARCH gate;
   `package.json version is 1.1.3` mismatch (current version 1.2+).
   Stale fixture or regression check.
3. `tests/renderer/save-load.spec.tsx` — 2 failures around the toolbar
   Open button selector (already documented above).
4. `tests/main/sampler-worker-girl.spec.ts` — wall-time / warmup
   completion gate (already documented above).

**Total pre-existing failures:** 5 individual tests across 4 files.
Plan 28-01 does NOT introduce any new test failures and does NOT
change the failure count of any of the above.


