# Phase 31 — Deferred items (out of scope)

Items discovered during phase execution that are outside scope. Logged but not fixed in this phase.

---

## Pre-existing typecheck:node failures in tests/core/

Observed on the base branch (`f9a8b87` at start of Plan 31-03; `9224683` at start of Plan 31-04 Task 2). Verified by stashing local changes and re-running `npm run typecheck:node` — errors persist on unmodified base. They are NOT introduced by Phase 31 work; out of scope per the executor scope boundary.

| File | Line(s) | Error |
|------|---------|-------|
| `tests/core/analyzer.spec.ts` | 647, 654 | TS2345/TS2339 — `pageName` field referenced on a Map value type that lacks it; `rotated` field expected on an object that lacks it. |
| `tests/core/project-file-loader-mode-heal.spec.ts` | 16 | TS2459 — `ProjectFileV1` declared in `src/core/project-file.ts` but not exported. Test imports a non-public type. |

Likely root cause: a recent refactor renamed/restructured the analyzer's atlas-region map shape (`pageName` → `rotated`) and made `ProjectFileV1` non-exported, but the corresponding spec files were not updated. Should be addressed in a follow-up phase that owns the analyzer / project-file surface.

`npm run typecheck:web` (the contract that covers Phase 31's renderer changes) is clean.

## vitest pre-existing failures (not introduced by Phase 31)

| Spec | Status |
|------|--------|
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | Pre-existing failure on base — confirmed by `git stash && vitest run` against the unmodified base. Sampler is untouched by Phase 31. |
| `tests/main/sampler-worker-girl.spec.ts` | Pre-existing failure on base — wall-time gate is host-environment-dependent. |

Total: 2 failing test files / 1 failing test (worker-girl spec has a timing skip). Phase 31 changes do not affect either.

Owner: surface to the orchestrator / verifier when Phase 31 closes; either fix in a separate phase or as a quick task.
