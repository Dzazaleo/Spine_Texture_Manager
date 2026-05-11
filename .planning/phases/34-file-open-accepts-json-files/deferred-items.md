# Phase 34 Deferred Items

Out-of-scope discoveries logged during execution. Not fixed by Phase 34 plans.


## Plan 34-02 execution discoveries

- **Pre-existing TS6133 in `tests/main/image-worker-rotation.spec.ts:187`** — `'data' is declared but its value is never read.` Lives in a Phase 33 rotation test, unrelated to Phase 34's renderer onMenuOpen rewire. Plan 34-02's specified verification command (`npx tsc --noEmit -p tsconfig.json`) exits 0; the error only surfaces via `tsc --build` (composite project full graph). Out of scope per executor scope-boundary rule. To revisit independently of Phase 34.
