---
phase: 52-batch-export-robustness-variant-dialog-cleanup
plan: 03
subsystem: renderer
tags: [cleanup, dead-code, memoization, variant-dialog, EXPORT-06]
requires:
  - VariantDialog multi-row dialog (Phase 51)
  - AppShell variant-export wiring (Phase 49/51)
provides:
  - VariantDialogProps without the dead `plan: ExportPlan` prop
  - onClickExportVariant as a one-liner (no dead buildExportPlan call)
  - onStart as a plain async fn (honest non-memoization)
affects:
  - src/renderer/src/modals/VariantDialog.tsx
  - src/renderer/src/components/AppShell.tsx
  - tests/renderer/variant-dialog.spec.tsx
  - tests/renderer/variant-batch-dialog.spec.tsx
tech-stack:
  added: []
  patterns:
    - "Plain async event handler over a memoization-defeating useCallback when deps ≡ all props"
key-files:
  created: []
  modified:
    - src/renderer/src/modals/VariantDialog.tsx
    - src/renderer/src/components/AppShell.tsx
    - tests/renderer/variant-dialog.spec.tsx
    - tests/renderer/variant-batch-dialog.spec.tsx
decisions:
  - "D-06: dead `plan` prop removed across VariantDialogProps + AppShell state/call/site; buildExportPlan + AppShell ExportPlan imports KEPT"
  - "D-07: onStart converted to a plain async fn (preferred form) — useCallback over the whole fresh `props` object memoized nothing"
  - "D-02: renderer duplicate-token gate left UNCHANGED (startDisabled = anyInvalid || hasDuplicate)"
  - "D-09: zero behavior change — only dead code removed + a no-op memoization wrapper dropped"
metrics:
  duration: "4m1s"
  completed: "2026-05-24"
  tasks: 2
  files-modified: 4
  commits: 3
---

# Phase 52 Plan 03: Variant-Dialog Dead-Code + Memoization Cleanup Summary

Removed the never-read `plan: ExportPlan` prop (and its dead `buildExportPlan(...)`
computation in AppShell) and converted `onStart` from a `useCallback` that
depended on the whole freshly-allocated `props` object into a plain async
function — both behavior-preserving renderer-local cleanups (SC#4 / D-06 / D-07),
with the duplicate-token gate (D-02) untouched.

## What Was Built

### Task 1 — D-06: remove the dead `plan` prop (`ab14152`)
- **VariantDialog.tsx:** deleted `plan: ExportPlan` (+ its doc comment) from
  `VariantDialogProps`; confirmed zero `props.plan` consumers in the body before
  deleting. The `ExportPlan` import became unused → removed from the
  `import type { … } from '…/shared/types.js'` block (`BatchVariantResult` +
  `SkeletonSummary` kept).
- **AppShell.tsx:** `onClickExportVariant` reduced from a `buildExportPlan(...)`
  call building a now-unused `plan` to a one-liner
  `setVariantDialogState({ outDir: lastOutDir })`; deps trimmed
  `[summary, activeOverrides, lastOutDir, safetyBufferPercentLocal]` → `[lastOutDir]`.
  Dropped `plan` from the `variantDialogState` useState type and deleted
  `plan={variantDialogState.plan}` from the `<VariantDialog/>` site. Stale
  comments at both sites updated to describe the main-side-per-scale plan build.
- **KEPT (verified still used):** AppShell `buildExportPlan` import (4 other
  callsites) and AppShell `ExportPlan` import (used by the `exportDialogState`
  type). Only the VariantDialog-side `ExportPlan` import was removed.

### Task 2 — D-07: fix onStart's misleading memoization (`cd2e1c4`)
- **VariantDialog.tsx:** `onStart` changed from
  `const onStart = useCallback(async () => { … }, [props, startDisabled])` to a
  plain `const onStart = async () => { … }` with a comment explaining it
  intentionally closes over the latest props (an honest deps list ≡ "all props",
  so the wrapper memoized nothing — `props` is a fresh object each render).
- The entire body (probe-then-confirm, null-guard, `in-progress` transition, the
  WR-02 try/catch around the `exportVariantBatch` IPC await, the failure-synthesis
  rollback, `setState('complete')`) is byte-identical — only the wrapper open/close
  changed.
- Sibling handlers `onCloseSafely` / `onOpenOutputFolder` keep their legitimate
  `useCallback` with honest deps; `useCallback` import retained (still used).

## How It Works

`plan` was carried purely as a master-sized display tile that the dialog never
rendered (the actual s-scaled plan is built MAIN-side per scale, Plan-01), so it
was pure dead weight on both the prop contract and the AppShell render path —
removing it deletes a per-render `buildExportPlan` call and three plumbing sites
with no observable change. `onStart` reads ~9 props on every invocation; a
`useCallback` keyed on the whole `props` object re-creates the closure each render
regardless, so the memoization was a misleading no-op — a plain async function is
the honest, equivalent form. The handler still reads the current prop set on every
call, so behavior is identical (D-09).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Dead code from this change] Dead `plan` fixture in two variant dialog specs**
- **Found during:** post-Task-1/2 full renderer-suite sweep.
- **Issue:** `tests/renderer/variant-dialog.spec.tsx` and
  `tests/renderer/variant-batch-dialog.spec.tsx` each built their `buildProps()`
  fixture with `plan: makePlan()` and a trailing `as ComponentProps<typeof
  VariantDialog>` cast. The cast suppressed TypeScript excess-property checking, so
  removing the `plan` prop did NOT surface a typecheck error and React silently
  dropped the unknown prop at runtime — the line (and the whole `makePlan()`
  helper + `ExportPlan` import) became dead as a direct consequence of the D-06
  removal. The plan did not anticipate these fixtures (it stated "This plan should
  not add tests" and pointed only at `variant-twoway.spec.ts`).
- **Fix:** removed the `plan: makePlan()` line, the orphaned `makePlan()` helper,
  and the now-unused `ExportPlan` import (kept `SkeletonSummary`) in both specs.
  No assertion changed.
- **Files modified:** tests/renderer/variant-dialog.spec.tsx,
  tests/renderer/variant-batch-dialog.spec.tsx
- **Commit:** c95f03c
- **Scope note:** confined to fixtures of the exact component this plan edits;
  these are `.tsx` (not `.ts`) specs, so the renderer-.ts-helper / TS6307 landmine
  does not apply, and no new test file was added. `typecheck:node` re-verified 0.

No architectural (Rule 4) changes; no authentication gates; no checkpoints.

## Verification

All plan `<verification>` items green:
- `grep -c "props.plan" VariantDialog.tsx` == 0; `grep -c "variantDialogState.plan" AppShell.tsx` == 0
- `grep -c "[props, startDisabled]" VariantDialog.tsx` == 0
- `grep -c "import { buildExportPlan }" AppShell.tsx` == 1 (import KEPT);
  `buildExportPlan(` callsites == 4; `ExportPlan` in AppShell == 10 (import + exportDialogState kept)
- `npm run typecheck:web` exit 0 AND `npm run typecheck:node` exit 0 (landmine guard)
- `npx vitest run tests/renderer/variant-twoway.spec.ts` exit 0 (2 files / 9 tests)
- `npx vitest run tests/renderer/variant-dialog.spec.tsx variant-batch-dialog.spec.tsx variant-twoway.spec.tsx` → 3 files / 20 tests passed
- Full `npx vitest run tests/renderer` → 44 files / 345 passed / 1 skipped / 0 failed

Blast radius (`git diff --name-only 03a01ee..HEAD`): exactly
`src/renderer/src/components/AppShell.tsx`,
`src/renderer/src/modals/VariantDialog.tsx`,
`tests/renderer/variant-dialog.spec.tsx`,
`tests/renderer/variant-batch-dialog.spec.tsx` — no `src/core/`, no `src/main/`,
no IPC/preload, no bundler/tsconfig/CSP changes. Layer-3 purity intact (no new
core/main import).

## Known Stubs

None. No stub patterns introduced; this plan only removed dead code and a no-op
memoization wrapper.

## Commits

- `ab14152` refactor(52-03): remove dead `plan` prop from variant dialog (D-06)
- `cd2e1c4` refactor(52-03): fix onStart misleading memoization (D-07)
- `c95f03c` test(52-03): drop dead `plan` fixture from variant dialog specs (D-06)

## Self-Check: PASSED

- FOUND: `.planning/phases/52-batch-export-robustness-variant-dialog-cleanup/52-03-SUMMARY.md`
- FOUND commit: `ab14152`
- FOUND commit: `cd2e1c4`
- FOUND commit: `c95f03c`
