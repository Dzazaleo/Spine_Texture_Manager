---
phase: 49-single-scale-variant-export
plan: 01
subsystem: api
tags: [variant-export, ipc, electron, scale-bake, export-plan, typed-error, atomic-write]

# Dependency graph
requires:
  - phase: 48-core-scale-bake-module-regression-oracle
    provides: "src/core/scale-bake.ts bake(json, s) — the pure JSON→JSON similarity bake (geometry producer, clones first, direction-agnostic D-09)"
  - phase: 06-optimize-assets-image-export
    provides: "buildExportPlan + runExport + runRepack export pipeline (reused UNCHANGED), the shared written-Set rollback idiom, deriveProjectName {NAME}-keyed naming"
provides:
  - "src/core/scale-summary-peaks.ts — pure scaleSummaryPeaks(summary, s) clone-and-scale helper (peak-only A1)"
  - "VariantScaleError typed error (D-08 edge guard, src/core/errors.ts)"
  - "src/main/skeleton-json-writer.ts — first-ever atomic skeleton-JSON writer (throws, no indent, registers paths first)"
  - "src/main/variant-export.ts — handleExportVariant orchestration + formatScaleToken canonical scale-token helper"
  - "variant:export IPC channel + Api.exportVariant type + window.api.exportVariant preload binding"
  - "Three Wave-0 tests: V1 sizing, V2 source-immutable, V5 scale guard"
affects: [49-02-renderer-variant-dialog, 49-03-package-layout-faithfulness-oracle]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Edge-only direction guard: bake() stays direction-agnostic (D-09); the s>=1 reject lives at the main export edge (handleExportVariant), never in core"
    - "Peak-only summary scaling (A1): scaleSummaryPeaks multiplies only peakScale/X/Y on a structuredClone; dims stay at master size so buildExportPlan is reused UNCHANGED"
    - "Write-JSON-first under one rollback Set: the baked variant JSON is written FIRST inside the shared try and registered in the same written Set as the textures, so a later texture throw rolls it back"
    - "{NAME}@{s}x/ folder carries the scale token; inner basenames stay clean {NAME}.* via deriveProjectName off summary.skeletonPath (no scale-suffix)"

key-files:
  created:
    - "src/core/scale-summary-peaks.ts"
    - "src/main/skeleton-json-writer.ts"
    - "src/main/variant-export.ts"
    - "tests/core/variant-sizing.spec.ts"
    - "tests/main/variant-source-immutable.spec.ts"
    - "tests/main/variant-scale-guard.spec.ts"
  modified:
    - "src/core/errors.ts"
    - "src/main/ipc.ts"
    - "src/shared/types.ts"
    - "src/preload/index.ts"

key-decisions:
  - "VariantScaleError extends Error (not SpineLoaderError) per the plan's verbatim spec — it is an export-edge concern, not a loader error; surfaced under kind:'Unknown' with the typed .message (no new KNOWN_KINDS arm added this phase)"
  - "handleExportVariant trailing args (effectiveOverrides, safetyBufferPercent) carry safe defaults (new Map(), 0) so the 8-arg test calls AND the 10-arg IPC call both compile"
  - "AtlasOpts imported from ./repack-worker.js (there is no named AtlasOpts export in types.ts; the Api.exportVariant signature inlines the literal shape to match startExport)"

patterns-established:
  - "Edge-only direction guard (bake stays direction-agnostic; the reject is main-side)"
  - "Peak-only summary scaling for variant sizing (A1)"
  - "Write-baked-JSON-first under a single shared rollback Set"

requirements-completed: [EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05]

# Metrics
duration: ~17min
completed: 2026-05-22
---

# Phase 49 Plan 01: Single-Scale Variant Export Engine + IPC Seam Summary

**Headless click-free variant export: bakes the s-scaled skeleton JSON, writes it to `{PARENT}/{NAME}@{s}x/`, and sizes textures at `s × master_peak` by reusing `buildExportPlan` + `runExport`/`runRepack` UNCHANGED — all under one rollback Set, source never modified, runtime-agnostic, never re-sampled.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-05-22T16:14:00Z (approx)
- **Completed:** 2026-05-22T16:21:48Z
- **Tasks:** 3
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- Pure Layer-3 `scaleSummaryPeaks(summary, s)` helper implementing the LOCKED peak-only interpretation A1 (multiplies only peakScale/X/Y on a structuredClone; leaves canonicalW/H + sourceW/H + actualSourceW/H at master size) — so `buildExportPlan` is reused UNCHANGED and the variant sizes textures at `s × master_peak` by pure arithmetic, never re-sampling (L-02).
- `VariantScaleError` typed error (D-08) — the edge guard that rejects `s >= 1` / NaN / `<= 0`; the GUARD CALL is main-side only, so core `bake()` stays direction-agnostic (Phase-48 D-09 preserved; `bake(json, 1.0)` still succeeds).
- `writeSkeletonJsonAtomic` — the FIRST-ever skeleton-JSON disk write in the app's history (L-03): atomic `.tmp`+`rename`, registers BOTH paths in the shared `written` Set BEFORE the write, THROWS on failure (so the orchestrator's catch sweeps it), NO JSON indent (drop-in faithfulness).
- `handleExportVariant` orchestration: D-08 guard → read source → `bake(s)` → derive `{NAME}@{s}x/` → write-baked-JSON-FIRST → `buildExportPlan(scaleSummaryPeaks(summary, s))` UNCHANGED → dispatch `runExport`/`runRepack` under ONE shared rollback Set; source never mutated; no spine-core import below `bake`; never re-samples.
- `formatScaleToken(s)` — the ONE canonical scale-token helper (`String(s)`, strips trailing zeros), declared + used here so Plan 03 references it by name.
- End-to-end IPC contract OWNED here: the `variant:export` channel + the `Api.exportVariant` TYPE + the `window.api.exportVariant` preload binding — so Plan 02 consumes the already-typed surface. `handleStartExport`/`export:start` are byte-untouched (D-04).
- Three Wave-0 tests green: V1 (s × master_peak exact, with + without overrides, no re-sampling), V2 (source sha256 byte-identical + bake-input unmutated), V5 (D-08 guard + core-stays-agnostic).

## Task Commits

Each task was committed atomically:

1. **Task 1: Pure scaleSummaryPeaks + VariantScaleError + V1/V5 tests** — `8f50b4b` (feat)
2. **Task 2: First-ever atomic skeleton-JSON writer + V2 source-immutability test** — `93ffe04` (feat)
3. **Task 3: handleExportVariant + variant:export IPC + Api type + preload binding** — `1c4941d` (feat)

_Note: V2/V5 tests were authored in Tasks 1-2 (RED until Task 3 wired the handler) — the documented TDD ordering; they went GREEN in Task 3._

## Files Created/Modified

- `src/core/scale-summary-peaks.ts` (created) — pure `scaleSummaryPeaks` peak-only A1 transform; Layer-3 safe (type-only import).
- `src/core/errors.ts` (modified) — added `VariantScaleError extends Error` (D-08 typed edge error).
- `src/main/skeleton-json-writer.ts` (created) — `writeSkeletonJsonAtomic`, the first-ever skeleton-JSON atomic writer.
- `src/main/variant-export.ts` (created) — `handleExportVariant` orchestration + `formatScaleToken` canonical helper.
- `src/main/ipc.ts` (modified) — added the `variant:export` channel registration + the `handleExportVariant` import + `SkeletonSummary` type import; `handleStartExport`/`export:start` byte-untouched (pure additions only).
- `src/shared/types.ts` (modified) — added the `Api.exportVariant` signature (pure addition).
- `src/preload/index.ts` (modified) — bound `window.api.exportVariant` (pure addition).
- `tests/core/variant-sizing.spec.ts` (created) — V1 sizing (synthetic fixture, no sampler).
- `tests/main/variant-source-immutable.spec.ts` (created) — V2 sha256 before/after + bake-input-unmutated.
- `tests/main/variant-scale-guard.spec.ts` (created) — V5 D-08 guard + core-agnostic.

## Decisions Made

- **VariantScaleError extends `Error`, not `SpineLoaderError`** — per the plan's verbatim body. It is an export-edge concern (not a loader failure); the IPC envelope surfaces it under `kind:'Unknown'` with the typed `.message` (the renderer displays `.message`). No new `KNOWN_KINDS` arm was added this phase (the PATTERNS divergence flag permits either; the message is the user-facing artifact).
- **Trailing handler args carry safe defaults** (`effectiveOverrides = new Map()`, `safetyBufferPercent = 0`) so the 8-arg test calls and the 10-arg IPC call both compile (plan step 3f).
- **`AtlasOpts` imported from `./repack-worker.js`** (STATE.md non-blocking note) — there is no named `AtlasOpts` export in `types.ts`; the `Api.exportVariant` signature inlines the literal shape exactly as `startExport` does.
- **V1 sizing test uses a synthetic hand-built summary** (no `loadSkeleton`/`sampleSkeleton`) — required so the L-02 acceptance grep (`sampleSkeleton|runSamplerInWorker|runSamplerJob` == 0) holds; this also makes the test fast and proves sizing is pure arithmetic. The V2/V5 main-side tests still use the real fixture via `buildSummary` (no sampler-string AC there).

## Deviations from Plan

None requiring deviation rules — the plan executed as written. Two minor in-plan adjustments worth recording:

1. **V1 sizing test was made fully synthetic (no sampler).** The plan suggested reusing `tests/core/export.spec.ts`'s Category-A real-fixture build (which calls `sampleSkeleton`), but that would violate Task 1's own acceptance criterion `grep -cE "sampleSkeleton|runSamplerInWorker|runSamplerJob" tests/core/variant-sizing.spec.ts` returns `0` (the L-02 no-re-sample guard). Resolved by using export.spec.ts's Category-B synthetic-summary idiom instead — fixture-shaped peaks (SMALL 0.4, BIG 2.0) chosen so the no-override case has a genuine sub-1.0 row (proves true `s × peak`) and the override case diverges from the wrong `s × clamp(...)` interpretation. This is a faithful realization of the plan's intent, not a scope change.

## Issues Encountered

- **`pct` unused-binding typecheck error** (Task 3f): the V1 override test had a leftover `const pct = 50;` after I switched to `overridePct = 150` to make the two interpretations diverge. `tsc --noEmit -p tsconfig.node.json` caught it; removed the dead binding. Both typechecks then clean.

## Deferred Issues (out of scope — pre-existing, NOT regressions)

Two test files fail in the full suite due to **missing proprietary fixtures**, verified IDENTICAL on the pristine base commit `6b08e94` (stash + checkout round-trip):

- `tests/main/sampler-worker-girl.spec.ts` — needs `fixtures/Girl/` (ABSENT, local-only/gitignored proprietary rig).
- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — needs `fixtures/SAMPLER_ALPHA_ZERO/` (gitignored proprietary Joker rig, per its own file comment).

Neither touches any code changed by this plan (zero sampler code in my diff). The ~11 `tests/renderer/*` MixBlend IMPORT failures noted in the plan's `<verification>` (Phase-47-owned) did not appear in this run's failures.

## Verification

- `npx vitest run tests/core/variant-sizing.spec.ts tests/main/variant-source-immutable.spec.ts tests/main/variant-scale-guard.spec.ts` — **all green** (V1, V2, V5; 11 tests).
- `npx vitest run tests/arch.spec.ts` — **green** (the new `scale-summary-peaks.ts` is Layer-3 pure; the fs writer is in `main/`).
- `npm run typecheck:node` — **0 errors**.
- `npm run typecheck:web` — **0 errors** (the typed `const api: Api` preload literal + the renderer surface compile against `Api.exportVariant`).
- `git diff src/main/ipc.ts` / `src/shared/types.ts` / `src/preload/index.ts` — **pure additions only** (no removed lines; `handleStartExport`/`export:start` byte-untouched, D-04).

## Next Phase Readiness

- The `window.api.exportVariant` surface is fully typed — Plan 02 (renderer "Export Variant…" dialog) consumes it directly with no further IPC/preload work.
- `formatScaleToken` is exported by name from `src/main/variant-export.ts` — Plan 03 (package-layout / faithfulness oracle) references it by name as planned.
- The full export pipeline (`buildExportPlan` + `runExport`/`runRepack`) is reused unchanged; Plan 03's dual-runtime × dual-mode matrix can drive `handleExportVariant` directly.

## Self-Check: PASSED

- All 6 created files + the SUMMARY exist on disk.
- All 4 modified files exist.
- All 3 task commit hashes (`8f50b4b`, `93ffe04`, `1c4941d`) found in git history.

---
*Phase: 49-single-scale-variant-export*
*Completed: 2026-05-22*
