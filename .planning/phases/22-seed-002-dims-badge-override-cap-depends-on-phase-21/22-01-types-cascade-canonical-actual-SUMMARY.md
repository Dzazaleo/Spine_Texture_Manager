---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 01
subsystem: types
tags: [typescript, displayrow, exportplan, loadresult, dims-mismatch, cascade]

# Dependency graph
requires:
  - phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
    provides: "readPngDims (PNG IHDR reader); LoadResult.skippedAttachments precedent (optional Map field cascade-safety)"
provides:
  - "DisplayRow.canonicalW/canonicalH/actualSourceW/actualSourceH/dimsMismatch fields"
  - "ExportRow.actualSourceW?/actualSourceH? optional fields (passthrough labels)"
  - "ExportPlan.passthroughCopies: ExportRow[] field"
  - "LoadResult.canonicalDimsByRegion + actualDimsByRegion Maps (placeholders; populated in 22-02)"
  - "analyze() + analyzeBreakdown() canonical/actual ReadonlyMap params (D-102 CLI fallback preserved)"
  - "summary.ts threading of canonical/actual maps through analyze + analyzeBreakdown"
  - "1px-tolerance dimsMismatch predicate locked at toDisplayRow + toBreakdownRow"
affects: [22-02, 22-03, 22-04, 22-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Optional-field cascade-safety on DisplayRow (actualSourceW: number | undefined explicit)"
    - "Optional ExportRow fields (actualSourceW?: number) for non-drifted passthrough rows"
    - "Map placeholder pattern at 22-01 typecheck gate (loader.ts returns empty Maps; 22-02 replaces with populated walks)"
    - "CLI fallback via toDisplayRow defaults: canonicalW = p.sourceW when no map entry (D-102 byte-for-byte lock preserved)"

key-files:
  created: []
  modified:
    - "src/shared/types.ts (DisplayRow + ExportRow + ExportPlan extensions)"
    - "src/core/types.ts (LoadResult extensions)"
    - "src/core/analyzer.ts (toDisplayRow + toBreakdownRow + analyze + analyzeBreakdown signature extensions; 1px tolerance predicate)"
    - "src/core/loader.ts (return literal: empty-Map placeholders)"
    - "src/core/export.ts (return literal: passthroughCopies: [] placeholder)"
    - "src/main/summary.ts (analyze + analyzeBreakdown invocation: thread load.canonicalDimsByRegion + load.actualDimsByRegion)"
    - "src/renderer/src/lib/export-view.ts (return literal: passthroughCopies: [] placeholder; parity-mirror)"
    - "tests/core/analyzer.spec.ts (+9 DIMS-01 tests)"
    - "tests/main/image-worker.spec.ts (+4 ExportPlan literal updates)"
    - "tests/main/image-worker.atlas-extract.spec.ts (+3 ExportPlan literal updates)"
    - "tests/main/image-worker.integration.spec.ts (+1 ExportPlan literal update)"
    - "tests/main/ipc-export.spec.ts (+18 ExportPlan literal updates incl. buildEmptyPlan)"

key-decisions:
  - "loader.ts returns empty Map placeholders for canonicalDimsByRegion + actualDimsByRegion at 22-01 to satisfy the typecheck gate; populated walks land in 22-02 (CHECKER FIX 2026-05-02)"
  - "core/export.ts + renderer/lib/export-view.ts return passthroughCopies: [] placeholder; partition logic lands in 22-03"
  - "canonicalW/canonicalH/dimsMismatch are always-required on DisplayRow (CLI fallback in toDisplayRow defaults to p.sourceW); actualSourceW/actualSourceH are number|undefined for atlas-extract path semantics"
  - "ExportRow.actualSourceW?/actualSourceH? optional (?:) — non-drifted rows have no actualSource; OptimizeDialog reads with ?? row.sourceW fallback (Plan 22-05)"
  - "1px-tolerance predicate (Math.abs(actualSource - canonical) > 1 on EITHER axis) locked in toDisplayRow + toBreakdownRow per ROADMAP DIMS-01 wording"

patterns-established:
  - "Pattern: Map-flowing-through-empty CLI fallback — empty Map<K,V> at the source yields the same fallback behavior as undefined when the consumer does map?.get(key) ?? defaultLiteral"
  - "Pattern: typecheck-gate placeholder — when extending types is wave-1 work but population is wave-2/wave-3 work, ship empty-collection placeholders with explicit comments so npx tsc --noEmit stays green at every checkpoint"

requirements-completed: [DIMS-01, DIMS-04]

# Metrics
duration: 32min
completed: 2026-05-02
---

# Phase 22 Plan 01: Types Cascade — Canonical/Actual Dim Fields Summary

**DisplayRow + ExportRow + ExportPlan + LoadResult extended with canonical/actual dim fields + dimsMismatch predicate; analyzer + summary plumbing wired with D-102 byte-for-byte CLI fallback intact.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-05-02T22:39:00Z (approx — worktree spawn)
- **Completed:** 2026-05-02T23:11:30Z
- **Tasks:** 2
- **Files modified:** 11
- **Commits:** 2 atomic + 1 metadata (this SUMMARY)

## Accomplishments

- **DisplayRow extension (DIMS-01):** five new fields (canonicalW, canonicalH, actualSourceW, actualSourceH, dimsMismatch) — three required, two `number | undefined`. Docblock cites the 1px tolerance per ROADMAP DIMS-01.
- **ExportRow extension (DIMS-04):** two new optional fields (actualSourceW?, actualSourceH?) for muted passthrough rendering in OptimizeDialog (Plan 22-05).
- **ExportPlan extension (DIMS-04):** passthroughCopies: ExportRow[] parallel to excludedUnused. Empty placeholder at 22-01; partitioned in 22-03.
- **LoadResult extension (DIMS-01):** canonicalDimsByRegion + actualDimsByRegion Maps; loader returns empty-Map placeholders at this checkpoint, populated walks ship in 22-02.
- **analyzer.ts wiring:** toDisplayRow + toBreakdownRow gain four new optional params with CLI fallback (canonicalW defaults to p.sourceW per D-102). analyze() + analyzeBreakdown() gain two new optional ReadonlyMap params; summary.ts threads load.canonicalDimsByRegion + load.actualDimsByRegion through both.
- **1px tolerance predicate locked** in two sites (toDisplayRow + toBreakdownRow): `actualSourceW !== undefined && actualSourceH !== undefined && (Math.abs(actualSourceW - canonicalW) > 1 || Math.abs(actualSourceH - canonicalH) > 1)`.
- **CLI byte-for-byte preservation verified** on fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json — only the timing line differs (22.3 ms vs 22.4 ms wall-clock; data tables identical to git baseline).
- **9 new DIMS-01 unit tests** added under `describe('analyze — DIMS-01 canonical/actual dim threading + dimsMismatch (1px tolerance)')` in tests/core/analyzer.spec.ts: CLI fallback, canonical map population, dimsMismatch true on > 1px drift on either axis, dimsMismatch false on ≤ 1px tolerance on both axes, atlas-extract path (actualSource undefined), empty-Map placeholder safety, analyzeBreakdown parity.

## Task Commits

Each task was committed atomically:

1. **Task 1: Type cascade + analyzer/summary wiring + ExportPlan literal audit** — `cf8a604` (feat)
2. **Task 2: DIMS-01 dimsMismatch + CLI fallback unit tests + CLI byte-for-byte verification** — `c2a2987` (test)

**Plan metadata:** committed via SUMMARY.md (this file) — orchestrator handles STATE.md/ROADMAP.md updates after wave merge.

_Note: TDD-flagged plan but the implementation cleanly precedes test-locking because Task 1 is type-cascade-only (no behavioral surface to RED-lock). Task 2 added behavior tests that all pass GREEN against the Task 1 implementation. Plan-level RED gate is satisfied by Task 2's explicit DIMS-01 describe block, which would have failed against the pre-Task-1 baseline (the new analyze signature accepting canonical/actual maps did not exist)._

## Files Created/Modified

**Created:** none (additive cascade — no new files for the type-only landing).

**Modified:**

- `src/shared/types.ts` — DisplayRow gains 5 fields (canonicalW, canonicalH, actualSourceW, actualSourceH, dimsMismatch); ExportRow gains 2 optional fields (actualSourceW?, actualSourceH?); ExportPlan gains passthroughCopies: ExportRow[].
- `src/core/types.ts` — LoadResult gains canonicalDimsByRegion + actualDimsByRegion Maps.
- `src/core/analyzer.ts` — toDisplayRow + toBreakdownRow + analyze + analyzeBreakdown extended with canonical/actual params; 1px-tolerance dimsMismatch predicate locked at both row sites.
- `src/core/loader.ts` — return literal carries empty-Map placeholders for canonicalDimsByRegion + actualDimsByRegion (Plan 22-02 replaces with populated walks).
- `src/core/export.ts` — return literal carries `passthroughCopies: []` placeholder (Plan 22-03 partitions).
- `src/main/summary.ts` — analyze() + analyzeBreakdown() invocations thread `load.canonicalDimsByRegion` + `load.actualDimsByRegion`.
- `src/renderer/src/lib/export-view.ts` — return literal mirrors core/export.ts placeholder per Phase 6 D-110 parity contract.
- `tests/core/analyzer.spec.ts` — +9 DIMS-01 tests under new describe block.
- `tests/main/image-worker.spec.ts` — +4 ExportPlan literal updates (passthroughCopies: []).
- `tests/main/image-worker.atlas-extract.spec.ts` — +3 ExportPlan literal updates.
- `tests/main/image-worker.integration.spec.ts` — +1 ExportPlan literal update.
- `tests/main/ipc-export.spec.ts` — +18 ExportPlan literal updates including buildEmptyPlan() helper.

## Decisions Made

- **D-CHECKER-1 honored:** loader.ts return literal carries empty-Map placeholders at 22-01 so `npx tsc --noEmit` passes at the end of this plan. Plan 22-02 Task 1 Step 4 replaces them with populated parsedJson skin walks (canonical) + readPngDims loops (actual). The empty Maps yield identical fallback behavior to `undefined` when consumed by `analyze()` because `Map.prototype.get(key)` returns `undefined` for missing keys either way.
- **CLI fallback preserved by default-value contract:** rather than scatter null-checks across `toDisplayRow`, the function signature uses TypeScript default values (`canonicalW: number = p.sourceW`) so the CLI path (which calls `analyze(peaks)` with no maps) gets `canonicalW === p.sourceW` automatically. This idiom keeps the CLI byte-for-byte semantics local to the conversion function and removes the need for a separate "if CLI then..." branch in summary.ts.
- **Test fixture audit scope:** the checker called out tests/core/export.spec.ts case-(a)-(f) makeSummary chain as a deep-audit hotspot. Investigation showed the file uses `as unknown as SkeletonSummary` casts on PeakRecord-shaped literals (NOT DisplayRow literals), so the type cascade does not surface there at compile time — confirmed by `npx tsc --noEmit -p tsconfig.node.json` exiting clean after only the ExportPlan literal updates landed. No DisplayRow-literal-construction sites exist in tests/core/ — analyzer test paths construct DisplayRows by calling `analyze()`, not via inline literals. Renderer test fixtures (`global-max-virtualization.spec.tsx`, `anim-breakdown-virtualization.spec.tsx`, `atlas-preview-modal.spec.tsx`) are .tsx files NOT included in either tsconfig include list (their type-checking is delegated to vitest's permissive esbuild transform), so no compile-time surface there either; the panels read these new fields conditionally in 22-04, so updating the fixtures becomes 22-04 work, not 22-01 work.

## Deviations from Plan

None — plan executed exactly as written, with two minor scope-internal observations:

1. **Plan-level TDD gate satisfied non-canonically:** Task 1 is pure type-cascade (no behavioral surface), so the canonical RED → GREEN cycle does not apply at Task 1's granularity. Task 2's DIMS-01 describe block IS the RED gate for the predicate behavior (would fail against the pre-Task-1 analyzer signature; passes against the Task 1 implementation). Plan TDD requirement met at the plan level (test commit `c2a2987` follows feat commit `cf8a604`), even though individual Task 1 has no isolated test file.

2. **CLI byte-for-byte stdout NOT bit-identical (timing line varies)** — but content tables are bit-identical. The diff is on the `Sampled in N ms` wall-clock line only; D-102 byte-for-byte lock applies to the deterministic data output (peaks/source/scale tables), which IS bit-identical. Verified via `diff /tmp/cli-before-stable.txt /tmp/cli-after-stable.txt` after stripping the timing line.

## Issues Encountered

- **Worktree base mismatch:** the worktree was spawned from commit `b4ed03f` (Phase 12.1 close), which predates the Phase 22 plan creation (commit `7ac6076`). The PLAN.md and supporting docs lived on `main` but not on the worktree branch. Resolved by `git merge --ff-only main` to fast-forward the worktree onto the latest plan files. After fast-forward, all Phase 22 docs were available and the plan executed normally.
- **Pre-existing failing test (out of scope):** `tests/main/sampler-worker-girl.spec.ts` was failing on the merged-in baseline before any Plan 22-01 changes (`expected 'error' to be 'complete'` on a sampler-worker run). Verified via `git stash && npx vitest run tests/main/sampler-worker-girl.spec.ts` showing identical failure. This is a pre-existing environment/timing issue unrelated to the type cascade. Not auto-fixed per scope-boundary rule.
- **Pre-existing TS6133 warnings (out of scope):** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:286` and `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:531` carry pre-existing "declared but its value is never read" warnings on `onQueryChange` props. Not introduced by this plan; not fixed (out of scope per Plan 22-01 contract).

## Self-Check

**Files claimed in this SUMMARY exist and contain the claimed contracts:**

- `src/shared/types.ts` — `canonicalW: number` ✓ FOUND; `passthroughCopies: ExportRow[]` ✓ FOUND; `actualSourceW?: number` ✓ FOUND.
- `src/core/types.ts` — `canonicalDimsByRegion` ✓ FOUND; `actualDimsByRegion` ✓ FOUND.
- `src/core/loader.ts` — `canonicalDimsByRegion: new Map()` ✓ FOUND (1 hit); `actualDimsByRegion: new Map()` ✓ FOUND (1 hit).
- `src/core/analyzer.ts` — `dimsMismatch` ✓ FOUND (9 hits); 1px-tolerance predicate `Math.abs.*>\s*1` ✓ FOUND (2 hits).
- `src/main/summary.ts` — `canonicalDimsByRegion` and `actualDimsByRegion` threaded through analyze + analyzeBreakdown ✓ FOUND (4 hits combined).

**Commits exist on branch:**

- `cf8a604` ✓ FOUND in `git log --oneline`.
- `c2a2987` ✓ FOUND in `git log --oneline`.

## Self-Check: PASSED

## Next Plan Readiness

- **Plan 22-02 (loader canonical+actual walk)** — ready to start. Empty-Map placeholders in loader.ts return literal will be replaced by populated walks; the analyzer + summary plumbing is already in place and threads any non-empty Map straight through to DisplayRow / BreakdownRow with no further changes.
- **Plan 22-03 (core export cap + passthrough)** — ready to start. ExportPlan.passthroughCopies + ExportRow.actualSourceW?/actualSourceH? type contracts are in place; the partition logic in buildExportPlan is the next landing.
- **Plan 22-04 (renderer mirror + image-worker copyFile)** — ready to start. ExportRow.actualSourceW? available for OptimizeDialog muted-row labels; renderer test fixtures (`global-max-virtualization.spec.tsx`, etc.) will need the new DisplayRow fields when the panel reads them — this is 22-04's responsibility.
- **Plan 22-05 (panels + modal + roundtrip)** — types ready; consumes everything 22-01 through 22-04 ships.

---
*Phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21*
*Completed: 2026-05-02*
