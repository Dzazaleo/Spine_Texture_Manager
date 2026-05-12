---
phase: 35-region-keyed-export-plan
plan: 02
subsystem: renderer-export-view
tags: [layer-3-parity, region-keyed-dedup, buildExportPlan, RegionRow, atomic-commit, plan-checker-warning-1-fix]

requires:
  - phase: 35-01-buildExportPlan-region-iteration
    provides: src/core/export.ts:buildExportPlan iterating summary.regions; SkeletonSummary.regions populated end-to-end; synthRegionsFromPeaks test helper landed in tests/core/export.spec.ts
  - phase: 06-03-pure-ts-export-plan-builder
    provides: parity contract between src/core/export.ts and src/renderer/src/lib/export-view.ts (byte-identical buildExportPlan bodies + regex signature greps in tests/core/export.spec.ts:801-877)
  - phase: 04-D-75-renderer-inline-duplicate
    provides: Layer 3 inline-duplicate pattern (renderer cannot import src/core/*; gets its own byte-identical copy of pure-TS math)

provides:
  - src/renderer/src/lib/export-view.ts:buildExportPlan iterates summary.regions byte-identically with the core copy (RegionRow loop variable; contributingAttachments accumulator)
  - parity regex `overrideSig` in tests/core/export.spec.ts updated row.peakScale → region.peakScale in lockstep with both source files (single atomic commit; no transient broken-main state)
  - Wave 1 ordering signal CLEARED — the parity test that 35-01 deliberately left failing now passes
  - end-to-end region-keyed export plan: from analyzer.ts → SkeletonSummary.regions → buildExportPlan (both copies) → ExportPlan rows

affects: [phase-35-03, phase-35-04, AppShell.onOptimizeAssets, OptimizeDialog row count display]

tech-stack:
  added: []
  patterns:
    - "Same-commit lockstep landing (plan-checker WARNING 1 fix): source migration + test-side parity-regex update committed together so the test suite is green on every commit boundary. Avoids the transient broken-main window between two consecutive commits."
    - "Byte-identical buildExportPlan body across src/core/export.ts and src/renderer/src/lib/export-view.ts (Layer 3 inline-duplicate per Phase 4 D-75 / Phase 6 D-108): renderer copy reuses the same Acc shape, dedup-by-sourcePath Map, override resolution, safeScale + ≤1.0 clamp, sourceRatio cap, keep-max replace, emit-loop partition, sort — only the import block + 4 'Mirrors src/core/export.ts verbatim' reminder comments + the renderer-only computeExportDims helper differ."

key-files:
  created: []
  modified:
    - src/renderer/src/lib/export-view.ts — buildExportPlan loop variable swap (`row` → `region`); Acc.row: DisplayRow → RegionRow type; `attachmentNames` sourced from `region.contributingAttachments[].attachmentName` (insert + merge branches); `RegionRow` added to type-only imports; `DisplayRow` dropped from imports (only docblock-comment references remain in `relativeOutPath` + `computeExportDims` docblocks, allowed per the plan's "historical-comment-divergence-OK" rule); Phase 35 marker comment added before the for-loop. `computeExportDims` (lines 154-251) untouched.
    - tests/core/export.spec.ts — `overrideSig` regex literal updated `row.peakScale` → `region.peakScale` to match both files post-migration (line 838). Added 3-line Phase 35 explanatory block comment above the regex.

key-decisions:
  - "Drop DisplayRow from the type-only import (mirror plan 01's core decision): after the body migration, DisplayRow is referenced ONLY in 4 docblock comments inside relativeOutPath + computeExportDims. Comments don't need the type import; tsc would warn 'DisplayRow declared but never used' if we kept it. The renderer copy must follow plan 01's import-shape decision so the parity contract's import-block delta stays minimal and predictable."
  - "Leave docblock-comment DisplayRow mentions as-is: the plan instructs `DO NOT 'normalize' the comment layer. The function body must match; the docblock/comment layer is allowed to differ historically.` Lines 100/142/143/161/398 of export-view.ts retain their DisplayRow comment references because (a) they're inside `relativeOutPath`/`computeExportDims` (both outside the buildExportPlan body in the renderer copy) and (b) the plan explicitly forbids touching `computeExportDims`. Mirror reminder comments (`Mirrors src/core/export.ts verbatim`) preserved exactly."
  - "Add the Phase 35 marker comment before the for-loop (mirror core): plan 01 added a 3-line comment at core line 187-189 explaining the iteration-source swap. Mirroring it in the renderer copy keeps the social-contract layer in sync and signals to future readers that the renderer mirrors the core."
  - "Single atomic commit landing both files (plan-checker WARNING 1 fix): the plan's explicit `files_modified: [export-view.ts, export.spec.ts]` lockstep contract. Splitting into two commits would leave the renderer's buildExportPlan and the parity-regex test out of sync between commit boundaries (intermediate state: renderer body matches core post-migration shape, but the parity regex still asserts `row.peakScale` — fails the parity describe block). Single commit eliminates the window."

patterns-established:
  - "Renderer-copy iteration-source mirror pattern: when the canonical pure-TS file in src/core/* changes its summary-field iteration source, mirror the change byte-identically in the matching src/renderer/src/lib/* copy in the same commit (or the next commit, with the parity-regex test update bundled together). The Layer 3 inline-duplicate is maintained via this lockstep discipline."
  - "Parity-regex update is part of the source change: when a parity regex in tests/core/export.spec.ts hard-codes loop-variable names (e.g. `row.peakScale`), the regex MUST be updated in the same commit as the source-side variable rename, never as a separate cleanup. This plan's same-commit shape (per WARNING 1 fix) is the locked pattern for future renamings."

requirements-completed: [DEDUP-05]

duration: ~10min
completed: 2026-05-12
---

# Phase 35 Plan 02: export-view.ts parity mirror Summary

**Mirrored Plan 35-01's buildExportPlan region-iteration change byte-identically into `src/renderer/src/lib/export-view.ts` and updated the parity-regex assertion in `tests/core/export.spec.ts` in lockstep — single atomic commit per plan-checker WARNING 1. Layer 3 inline-duplicate invariant preserved; Wave 1 ordering signal CLEARED.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-12T12:50Z
- **Completed:** 2026-05-12T12:57Z
- **Tasks:** 1 (single atomic task per the plan's lockstep contract)
- **Files modified:** 2 (`src/renderer/src/lib/export-view.ts` + `tests/core/export.spec.ts`)

## Accomplishments

- `src/renderer/src/lib/export-view.ts:buildExportPlan` now iterates `summary.regions: RegionRow[]` byte-identically with `src/core/export.ts:buildExportPlan` (loop variable `row` → `region`; `Acc.row` type `DisplayRow` → `RegionRow`; `attachmentNames` sourced from `region.contributingAttachments[].attachmentName` in both the insert branch and the merge branch).
- Type-only import block in export-view.ts updated: `RegionRow` added; `DisplayRow` dropped (no longer used as a type post-migration; only referenced in 4 docblock comments inside `relativeOutPath` + `computeExportDims`, which the plan explicitly preserves as historical comment-layer divergence).
- The Phase 29 D-04 `overrideKey` line, the destructure of `actualSourceW/H, canonicalW/H`, the `prev` lookup, the keep-max replace branch, and the contributor-union merge branch all renamed `row` → `region` byte-identically with plan 01.
- Phase 35 marker comment (3 lines explaining the iteration-source swap) added immediately before the `for (const region of summary.regions)` loop — mirrors the same comment plan 01 added in core at lines 187-189.
- All 4 `Mirrors src/core/export.ts verbatim (hygiene test enforces parity).` reminder comments preserved exactly. `computeExportDims` (renderer-only export helper, lines 154-251) untouched.
- `tests/core/export.spec.ts:838` parity regex `overrideSig` updated from `row.peakScale` to `region.peakScale` to match both files post-migration. Added 3-line Phase 35 explanatory block comment above the regex documenting the lockstep update.
- Wave 1 ordering signal documented in 35-01-SUMMARY.md ("the parity grep test at line ~835 will fail until plan 02 mirrors the change byte-identically") is now CLEARED — full `npm test` shows the parity describe block passes on both files.

## Task Commits

1. **Task 1: Mirror plan 01's changes into export-view.ts AND update the parity-regex assertion (single atomic commit per WARNING 1 fix)** — `5e3df17` (feat)

## Files Created/Modified

- `src/renderer/src/lib/export-view.ts` — type imports (`RegionRow` added, `DisplayRow` removed); `Acc.row` field type swapped; for-loop iteration source swapped (`summary.peaks` → `summary.regions`); loop-local variable renamed throughout (`row` → `region`); insert-branch `attachmentNames` sourced from `region.contributingAttachments.map(c => c.attachmentName)`; merge-branch iterates `region.contributingAttachments` to union contributors. Total: +20/-13 lines inside `buildExportPlan`. `computeExportDims` and `relativeOutPath` and `safeScale` all byte-identical with pre-edit.
- `tests/core/export.spec.ts` — `overrideSig` regex updated `row.peakScale` → `region.peakScale` (line 838); 3-line Phase 35 explanatory block comment added above the regex. Total: +5/-1 lines inside the parity describe block.

## Decisions Made

1. **Drop DisplayRow from the type-only import** — mirrors plan 01's core decision. After the body migration, `DisplayRow` is referenced ONLY in docblock comments. Keeping it in the import would trigger TS6133 (declared but never used) under strict noUnusedLocals. The plan's import-shape decision rule ("mirror what plan 01 did") makes this unambiguous.
2. **Add the Phase 35 marker comment before the for-loop in the renderer copy** — plan 01 added a 3-line marker at core line 187-189; mirroring it keeps the comment layer in sync and signals the lockstep mirror relationship to future readers.
3. **Leave docblock-comment DisplayRow mentions inside `relativeOutPath`/`computeExportDims` as-is** — per the plan's explicit "historical-comment-divergence is OK; do NOT normalize the comment layer" rule. The function body must match; comments are allowed to differ.
4. **Atomic same-commit landing** — per the plan-checker WARNING 1 fix. The renderer source migration would otherwise leave the parity regex matching `row.peakScale` against a renderer-side `region.peakScale`, failing the parity describe block on every commit between renderer-edit and regex-edit. Single commit eliminates the window.

## Deviations from Plan

None — the plan executed exactly as written. The two parts (Part A: renderer mirror; Part B: parity regex update) landed together in the same `git commit` invocation as the plan's lockstep contract requires.

## Issues Encountered

### Expected — Wave 1 ordering signal CLEARED

Plan 35-01's SUMMARY documented the deliberate post-plan-01 failure:

> the parity grep test at line ~835 (`/applyOverride\(overridePct,\s*row\.peakScale\)\.effectiveScale/`) FAILS post-migration ... Plan 35-02 mirrors the iteration-source change byte-identically ... The failure clears the moment that plan lands.

Post-plan-02: full `npm test` shows `tests/core/export.spec.ts` (72 tests) ALL pass, including:
- `both files share the same Math.ceil uniform sizing pattern + peak-anchored override signature` (the previously-failing parity test)
- `renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs` (the runtime-equality parity test)
- All hygiene grep tests, all fold-key signature tests, all bufferSig + bufferCapped + safetyBufferPercent + safeScale signature tests

### Pre-existing failures (not caused by this plan)

Same two failures plan 35-01 documented carry forward (verified unchanged shape):
- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — pre-existing fixture-missing failure (`fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` not in repo; tracked in `.planning/debug/skins-optimize-undercount.md` per project memory)
- `tests/main/sampler-worker-girl.spec.ts` — pre-existing environmental failure (warm-up returns 'error' instead of 'complete')

Both failures pre-date plan 35-01 by multiple commits; neither was introduced or worsened by 35-02.

## User Setup Required

None — pure-TS code edit + test-regex edit. No IPC, schema, or environment dependencies.

## Verification

All acceptance criteria from the plan pass:

| Check | Expected | Actual |
|-------|----------|--------|
| `grep -c "for (const region of summary.regions)" src/renderer/src/lib/export-view.ts` | ≥ 1 | **1** ✓ |
| `grep -E "for \(const (row\|peak) of summary\.peaks\)" src/renderer/src/lib/export-view.ts` | 0 | **0** ✓ |
| `grep -c "region.contributingAttachments" src/renderer/src/lib/export-view.ts` | ≥ 1 | **2** ✓ |
| `grep -E "from ['\"][^'\"]*\/core\/" src/renderer/src/lib/export-view.ts` | 0 | **0** ✓ |
| `grep -c "from './overrides-view.js'" src/renderer/src/lib/export-view.ts` | 1 | **1** ✓ |
| `grep -c "RegionRow" src/renderer/src/lib/export-view.ts` | ≥ 1 | **5** ✓ |
| `grep -c "export function computeExportDims" src/renderer/src/lib/export-view.ts` | 1 | **1** ✓ |
| `grep -cF 'region\.peakScale' tests/core/export.spec.ts` | > 0 | **1** ✓ |
| Structural diff filter (`Mirrors src/core/export.ts verbatim` or blank/comment-only lines) | zero non-comment lines | **zero non-comment lines** ✓ |
| `npm test` — full suite | parity tests pass | **1037 passed; 2 pre-existing failures unrelated** ✓ |
| `git log -1 --stat` — both files in one commit | both listed | **export-view.ts + export.spec.ts** ✓ |

## Next Phase Readiness

- **Plan 35-03 (atlas-preview consumer audit)** can now land — both buildExportPlan copies emit region-keyed ExportRows so AtlasPreview optimized-mode tile expansion will see the full 160-region surface in multi-skin atlas-source fixtures (closing the JOKERMAN_SPINE undercount).
- **Plan 35-04 (regression tests on multi-skin fixture)** can pick up next — the integration test for `fixtures/SKINS/JOKERMAN_SPINE.json` (160 regions → 160 ExportRows) becomes meaningful only after both 35-01 + 35-02 land (which they now have).

The Layer 3 inline-duplicate invariant is preserved: `tests/arch.spec.ts:19-34` grep continues to find zero `from '...core/...'` patterns in any renderer file; the parity describe block in `tests/core/export.spec.ts:801-877` finds matching signature patterns in both `src/core/export.ts` and `src/renderer/src/lib/export-view.ts`; the runtime-equality parity test dynamic-imports the renderer copy and finds byte-identical ExportPlan output on representative inputs.

---

## Self-Check: PASSED

Verification (per `<self_check>` in agents/gsd-executor.md):

**1. Files exist:**
- `src/renderer/src/lib/export-view.ts` ✓ FOUND (HEAD)
- `tests/core/export.spec.ts` ✓ FOUND (HEAD)
- `.planning/phases/35-region-keyed-export-plan/35-02-SUMMARY.md` ✓ FOUND (this file)

**2. Commits exist:**
- `5e3df17` (feat 35-02) ✓ FOUND in git log

**3. Atomic commit verification:**
- `git log -1 --stat` lists BOTH `src/renderer/src/lib/export-view.ts` AND `tests/core/export.spec.ts` in commit `5e3df17` ✓

*Phase: 35-region-keyed-export-plan*
*Plan: 02-export-view-parity-mirror*
*Completed: 2026-05-12*
