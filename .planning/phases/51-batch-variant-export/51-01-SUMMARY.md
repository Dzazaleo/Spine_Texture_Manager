---
phase: 51-batch-variant-export
plan: 01
subsystem: export
tags: [electron, ipc, variant-export, batch, spine, byte-identity, rollback]

# Dependency graph
requires:
  - phase: 49-variant-export
    provides: "handleExportVariant single-scale orchestrator (bake → plan → write-JSON-first → runExport/runRepack under a per-call written rollback Set), formatScaleToken canonical token helper, variantExportInFlight re-entrancy slot"
provides:
  - "handleExportVariantBatch — fan one master out to N scales in one run (EXPORT-04 SC#1); writes N {NAME}@{s}x/ sibling folders each byte-identical to the single-scale path output (SC#2 by construction)"
  - "exportOneVariant — the un-guarded single-variant body (extracted verbatim from handleExportVariant); each call mints its OWN written rollback Set (D-07 / Pitfall 4)"
  - "variant:exportBatch invoke channel + variant:cancelBatch one-way channel (+ preload bindings + Api types)"
  - "BatchVariantResult type (per-variant outcome: exported | exported-with-errors | failed | skipped)"
  - "variantBatchCancelRequested between-variants cancel flag (reset at batch start, D-09 / Pitfall 5) + setVariantBatchCancelRequested setter"
affects: [51-02-batch-variant-dialog, batch-export-renderer, variant-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Behavior-preserving extraction: split a guarded orchestrator into (un-guarded body fn + thin guard wrapper) so a batch loop can claim the re-entrancy slot ONCE and reuse the proven body verbatim — SC#2 byte-identity by construction"
    - "Per-iteration cooperative cancel via a module flag checked at the TOP of each loop iteration + reset at loop start (no stale-flag poison)"
    - "Continue-on-error: each unit owns its OWN rollback Set; the batch owns ONLY the results array (no batch-wide Set that could delete earlier landed work)"

key-files:
  created:
    - "tests/main/variant-batch-faithful.spec.ts"
  modified:
    - "src/main/variant-export.ts"
    - "src/shared/types.ts"
    - "src/main/ipc.ts"
    - "src/preload/index.ts"

key-decisions:
  - "exportOneVariant is the un-guarded body; handleExportVariant is the thin guard wrapper (signature unchanged → all Phase-49 tests + ipc.ts compile unchanged)"
  - "The wrapper now claims variantExportInFlight at the very TOP (before sync validation) instead of post-validation; safe because the finally releases on every path — external contract identical"
  - "Batch dedup defense: collide on the SAME normalized token → whole batch returns failed results (defense-in-depth behind the renderer's D-10 pre-flight)"
  - "SC#2 proof compares {NAME}.json + {NAME}.atlas bytes only, NOT rendered PNG bytes (sharp/libvips PNG encoding not guaranteed byte-stable across two composite passes — A1 caveat)"

patterns-established:
  - "Guarded-orchestrator → (un-guarded body + thin guard wrapper) refactor for batch reuse"
  - "Module-flag cooperative cancel: reset-at-start + check-at-top-of-iteration"
  - "Per-unit rollback Set (never a batch-wide Set) for continue-on-error atomicity"

requirements-completed: [EXPORT-04]

# Metrics
duration: ~25min
completed: 2026-05-23
---

# Phase 51 Plan 01: Batch Variant Export Engine Summary

**Main-side `handleExportVariantBatch` fans one master out to N scales in one run — looping the proven single-scale `exportOneVariant` body under one re-entrancy claim, with per-variant rollback (D-07), between-variants cancel (D-09), and byte-identity to the single-scale path proven across the 4.2/4.3 × atlas-source/atlas-less matrix (EXPORT-04).**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-23T13:48:00Z (approx)
- **Completed:** 2026-05-23T13:52:24Z
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- **Behavior-preserving extraction:** the entire `handleExportVariant` body (D-08 guard → read → bake → plan → collision guard → write-JSON-first → dispatch under its OWN `written` Set → merge) moved VERBATIM into a private un-guarded `exportOneVariant`; `handleExportVariant` is now a thin guard wrapper with an UNCHANGED exported signature — all 34 Phase-49 variant tests stay green.
- **`handleExportVariantBatch`** loops `exportOneVariant` per scale under ONE outer `variantExportInFlight` claim: continue-on-error (D-07, each variant's own rollback Set), between-variants cancel (D-09, flag checked at the top of each iteration), and a token-collision dedup defense (D-10 defense-in-depth). Returns `{ ok: true, results: BatchVariantResult[] }` — never throws across IPC.
- **IPC + preload + Api surface:** `variant:exportBatch` invoke channel (scales[] → finite-number-array coercion, Security V5) + `variant:cancelBatch` one-way channel; `exportVariantBatch`/`cancelVariantBatch` preload bindings; `Api.exportVariantBatch`/`Api.cancelVariantBatch` types; `BatchVariantResult` type.
- **The Wave-0 faithfulness proof** (`tests/main/variant-batch-faithful.spec.ts`, 12 tests): byte-identity (JSON + atlas) batch-vs-N×single over the dual-runtime × dual-mode matrix; forced-fail atlas batch rolls back every failed folder while returning a result per scale; stale-flag-reset + between-variants-skip cancel cases.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract exportOneVariant + handleExportVariantBatch + cancel flag + BatchVariantResult** - `ce08c7e` (refactor)
2. **Task 2: Wire variant:exportBatch + variant:cancelBatch IPC + preload + Api types** - `28f4d88` (feat)
3. **Task 3: Batch faithfulness/rollback/cancel proof** - `42ad810` (test)

_Note: Task 1 carries `tdd="true"` but its plan-defined verification is `typecheck:node` + the Phase-49 regression set (the behavioral proof is Task 3, the Wave-0 test). Task 1 is a behavior-preserving refactor; the byte-identity / rollback / cancel BEHAVIOR is RED→GREEN-proven by Task 3's new spec, which exercises Tasks 1+2 end-to-end. Committed as a single refactor commit per the plan's structure._

## Files Created/Modified
- `src/main/variant-export.ts` - Added `variantBatchCancelRequested` flag, extracted `exportOneVariant` (un-guarded body), rewrote `handleExportVariant` as the thin guard wrapper, added `handleExportVariantBatch` + `setVariantBatchCancelRequested`.
- `src/shared/types.ts` - Added `BatchVariantResult` type (after `ExportResponse`); added `Api.exportVariantBatch` + `Api.cancelVariantBatch` signatures.
- `src/main/ipc.ts` - Added `variant:exportBatch` invoke channel (scales[] finite coercion) + `variant:cancelBatch` one-way channel; imported `handleExportVariantBatch` + `setVariantBatchCancelRequested`.
- `src/preload/index.ts` - Added `exportVariantBatch` invoke binding + `cancelVariantBatch` one-way binding.
- `tests/main/variant-batch-faithful.spec.ts` - Wave-0 proof: byte-identity (matrix), continue-on-error (D-07), cancel (D-09).

## Decisions Made
- **Wrapper claims the slot at the TOP, not post-validation.** The pre-Phase-51 code claimed `variantExportInFlight` AFTER synchronous validation. Moving the claim to the very top of `handleExportVariant` is safe (the `finally` releases on every path, including the new sync early-returns) and keeps the external contract byte-identical. The plan explicitly sanctions this.
- **Dedup at the engine, not just the renderer.** `handleExportVariantBatch` rejects a whole batch whose two scales normalize to the same `formatScaleToken` (D-10 defense-in-depth behind the renderer pre-flight).
- **SC#2 evidence = JSON + atlas bytes, not PNG bytes** (A1 caveat — sharp/libvips PNG encoding is not byte-stable across separate composite passes). Per-region sizing faithfulness is already covered byte-faithfully by the Phase-49 suites this batch reuses verbatim.

## Deviations from Plan

None - plan executed exactly as written.

The only nuance worth recording (not a deviation): the Task-1 acceptance grep
`grep -v '^import' ... | grep -c 'spine-core...'` returns `1` instead of `0`. The
single match is the **pre-existing Phase-49 docblock prose** at
`variant-export.ts:20` (`* - L-04: the write path is runtime-agnostic (no
spine-core import below bake).`) — a COMMENT that DOCUMENTS the L-03/L-04
invariant, not an actual import. The grep target is too coarse (it matches
docblock words). The intent of the criterion is fully satisfied: `grep '^import'
... | grep -c 'spine'` returns `0` — there is genuinely no spine-core /
spine-webgl / @esotericsoftware import in the file. The batch is runtime-agnostic
below bake (L-03/L-04 hold).

## Issues Encountered

**Out-of-scope `npm run test` failures (missing gitignored fixtures) — NOT fixed (scope boundary).**
Two test files fail in this fresh worktree, neither touched by this plan:
- `tests/main/sampler-worker-girl.spec.ts` — needs `fixtures/Girl/` (local-only / gitignored, absent in the worktree).
- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — needs `fixtures/SAMPLER_ALPHA_ZERO/` (the test's own header, line 70, states it is gitignored — proprietary Joker rig).

These are the documented "gitignored fixtures → local green ≠ CI green" pattern.
They are environmental (missing local-only fixtures), pre-existing, and orthogonal
to the batch-export engine. Logged to
`.planning/phases/51-batch-variant-export/deferred-items.md`. No action taken per
the SCOPE BOUNDARY rule. The relevant gates are all green:
- `tests/main/variant-batch-faithful.spec.ts` — 12/12 pass (all four `-t` labels: byte-identity, matrix, continue-on-error, cancel).
- Phase-49 regression set (variant-scale-guard, variant-package-layout, variant-dropin-faithful, variant-source-immutable) — 34/34 pass.
- `npm run typecheck:node` — exit 0 (the `.ts`-renderer-glob landmine: this is a `tests/main/*.spec.ts` in the node program, NOT a renderer `.spec.tsx`).
- `npm run typecheck:web` — exit 0.

## Threat Flags

None — no new security surface beyond the planned `variant:exportBatch` /
`variant:cancelBatch` channels, both coerced at the trust boundary (Security V5,
mirroring the already-hardened `variant:export` ladder) and inheriting all
path-safety + buffer-clamp guards per variant because batch reuses
`exportOneVariant` verbatim.

## Next Phase Readiness
- The batch engine + its IPC surface are ready for Plan 51-02 (the renderer batch dialog: multi-row scale list, one parent pick, one overwrite, "variant N of M" progress via the `variant:batch-progress` marker, per-folder result list rendering the `BatchVariantResult[]`).
- `variant:batch-progress` is already emitted by the loop (consumed by 51-02's "variant N of M" prefix).
- No blockers.

## Self-Check: PASSED

- Created files verified on disk: `tests/main/variant-batch-faithful.spec.ts`, `51-01-SUMMARY.md`, `deferred-items.md`.
- Commits verified in git log: `ce08c7e` (Task 1), `28f4d88` (Task 2), `42ad810` (Task 3).
- Modified files verified in HEAD tree: `variant-export.ts`, `types.ts`, `ipc.ts`, `preload/index.ts`.

---
*Phase: 51-batch-variant-export*
*Completed: 2026-05-23*
