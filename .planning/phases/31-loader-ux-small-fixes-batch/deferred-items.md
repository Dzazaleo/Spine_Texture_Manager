# Phase 31 — Deferred items (out of scope)

Pre-existing typecheck errors observed on the base branch (`f9a8b87`) at the
start of plan 31-03 execution. These are NOT introduced by Phase 31 work and
are out of scope per the executor scope boundary. Stashing my Plan 31-03
changes and re-running `npm run typecheck` confirmed both errors exist on
the unmodified base.

## tsconfig.node.json typecheck errors (pre-existing)

| File | Line(s) | Error |
|------|---------|-------|
| `tests/core/analyzer.spec.ts` | 647, 654 | TS2345/TS2339 — `pageName` field referenced on a Map value type that lacks it; `rotated` field expected on an object that lacks it. Looks like a stale test against an updated analyzer interface. |
| `tests/core/project-file-loader-mode-heal.spec.ts` | 16 | TS2459 — `ProjectFileV1` declared in `src/core/project-file.ts` but not exported. Test imports a non-public type. |

Owner: surface to the orchestrator / verifier when phase 31 closes; either fix in a separate phase or as a quick task.
