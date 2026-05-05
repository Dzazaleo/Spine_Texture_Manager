# Phase 27 Plan 02 — deferred items (out-of-scope discoveries)

These three test failures pre-existed at the worktree base commit
`17894cd` and are NOT caused by this plan's changes (verified by
running `npm run test` against base with this plan's tree reverted —
the same three failures appear). Logged here per the executor's SCOPE
BOUNDARY rule and NOT fixed in 27-02.

| Test file | Failure | Likely root |
|-----------|---------|-------------|
| `tests/main/sampler-worker-girl.spec.ts` | Wave 1 N2.2 wall-time gate flaky on machine load | Performance gate, environment-dependent |
| `tests/integration/build-scripts.spec.ts` | "package.json version is 1.1.3" — actual is `1.2.0` | Stale assertion left over from v1.1.x; not refreshed when v1.2.0 shipped |
| `tests/renderer/atlas-preview-modal.spec.tsx` | dblclick D-130 jump-target — onJump not fired | jsdom + canvas hit-test interaction; pre-existing fragility |

Pre-existing typecheck errors (TS6133 unused-binding) at base `17894cd`,
in files NOT touched by this plan:

| File | Error |
|------|-------|
| `src/core/export.ts:140` | TS6133: 'opts' is declared but its value is never read. |
| `src/renderer/src/lib/export-view.ts:205` | TS6133: 'opts' is declared but its value is never read. |
| `tests/core/export.spec.ts:1312` | TS6133: 'plan' is declared but its value is never read. |

These fall under SCOPE BOUNDARY (out-of-scope of QA-02 / QA-04). The
plan's success criteria are `npm run test` exits 0 and `npm run typecheck`
exits 0 — both criteria are currently unsatisfiable on this codebase
regardless of this plan's edits. The phase 27 verifier should re-evaluate
the success criteria against the OverrideDialog/QA-02/QA-04 surface only
(which DOES pass cleanly).
