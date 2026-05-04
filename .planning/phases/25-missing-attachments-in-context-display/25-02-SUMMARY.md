---
phase: 25-missing-attachments-in-context-display
plan: 02
subsystem: ui
tags: [renderer, panels, missing-attachments, vitest, typescript]

# Dependency graph
requires:
  - phase: 25-missing-attachments-in-context-display
    provides: DisplayRow.isMissing field + buildSummary marking (Plan 25-01)
provides:
  - Missing-attachment rows visible in Global Max Render Source panel with red left-border + ⚠ icon
  - Missing-attachment rows visible in Animation Breakdown panel (setup-pose card) with same indicators
  - 'missing' RowState variant in both panels; rowState() checks isMissing first
  - tests/renderer/global-max-missing-row.spec.tsx: 4 RTL tests gating PANEL-03 renderer behavior
affects:
  - GlobalMaxRenderPanel.tsx (6 sites changed)
  - AnimationBreakdownPanel.tsx (6 sites changed)
  - summary.ts (stub synthesis for sampler-skipped attachments)
  - MissingAttachmentsPanel.tsx (unchanged)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stub row synthesis in buildSummary: walk skeletonData.skins to find skin/slot, use canonicalDimsByRegion for source dims"
    - "rowState() priority: isMissing checked before isUnused before ratio comparisons"
    - "Literal Tailwind v4 class branches: state === 'missing' && 'bg-danger'"

key-files:
  created:
    - tests/renderer/global-max-missing-row.spec.tsx
  modified:
    - src/main/summary.ts
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx

key-decisions:
  - "Root cause was sampler skip: synthetic-atlas.ts intentionally excludes stub regions from dimsByRegionName; sampler's sd===undefined guard skips them; peaksArray gets no row to mark"
  - "Fix: synthesize stub DisplayRow/BreakdownRow in buildSummary for each skippedAttachment not already in peaks; use canonicalDimsByRegion dims + skeletonData.skins walk for skin/slot"
  - "Stub rows injected into setup-pose card only in animationBreakdown (no per-animation data available for never-sampled attachments)"
  - "Plan 25-02 6-site changes to both panels implemented alongside the data-layer fix in a single commit"

patterns-established:
  - "When synthesizing IPC rows for unsampled attachments: walk skeletonData.skins, use canonicalDimsByRegion, set peakScale=0 / worldW=0 / isMissing=true"

requirements-completed:
  - PANEL-03

# Metrics
duration: 25min
completed: 2026-05-04
---

# Phase 25 Plan 02: Missing Attachments In-Context Display — Renderer Summary

**Root cause found and fixed: stub regions are intentionally excluded from the sampler's sourceDims map, so the sampler never records them in globalPeaks, and Plan 25-01's .map()+mark approach had nothing to mark. The fix synthesizes stub DisplayRow/BreakdownRow entries in buildSummary for each skippedAttachment not already in peaks, and implements the Plan 25-02 'missing' RowState treatment in both panels.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-04T15:00:00Z
- **Completed:** 2026-05-04T15:25:00Z
- **Tasks:** 2 (data fix + renderer fix + tests)
- **Files modified:** 4

## Accomplishments

- **Root cause diagnosed**: `synthetic-atlas.ts` line 178–179 intentionally does NOT add stub regions to `dimsByRegionName`. The sampler's `sd === undefined` guard at `sampler.ts:311` then skips these attachments entirely. No PeakRecord is produced, so `analyze(globalPeaks)` never yields a row, and `peaksArray.map()` has nothing to mark with `isMissing`.

- **buildSummary fix** (`src/main/summary.ts`):
  - After marking `peaksArray`, synthesizes a minimal `DisplayRow` for each `skippedAttachment` not already present. Walks `skeletonData.skins` to find the first `(skinName, slotName)` that declares the attachment; uses `canonicalDimsByRegion` for source dims (falls back to 1×1). Sets `peakScale=0`, `worldW=0`, `isMissing=true`.
  - Same synthesis for `animationBreakdown` setup-pose card (`cardId='setup-pose'`): injects `BreakdownRow` stubs with `bonePath=[slotName, attachmentName]`.

- **GlobalMaxRenderPanel.tsx** (6 changes per Plan 25-02 spec):
  - `RowState` extended: `'under' | 'over' | 'unused' | 'neutral' | 'missing'`
  - `rowState()` signature: `(peakRatio, isUnused, isMissing?)` — isMissing checked first
  - Both call sites pass `row.isMissing`
  - Left-accent `<span>` clsx: `state === 'missing' && 'bg-danger'`
  - Name cell: `{row.isMissing && <span aria-label="Missing PNG">⚠</span>}` before `highlightMatch`
  - Ratio cell clsx: `state === 'missing' && 'bg-danger/10 text-danger'`

- **AnimationBreakdownPanel.tsx** (same 6 changes, symmetric)

- **tests/renderer/global-max-missing-row.spec.tsx** (new, 4 RTL tests):
  - Icon present for `isMissing: true` row
  - Icon absent for `isMissing: undefined` row
  - Single icon for one missing row among multiple rows
  - Non-missing low-scale row renders without icon (regression guard)

- **Full vitest suite**: 2 pre-existing failures baseline (atlas-preview-modal canvas + build-scripts version); 0 new failures introduced.

## Task Commits

1. **Fix + renderer + tests** — `d53c295` (fix)

## Files Created/Modified

- `src/main/summary.ts` — Added stub row synthesis in buildSummary for missing attachments not reached by sampler; added DisplayRow/BreakdownRow imports
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — 6-site Plan 25-02 changes: RowState 'missing', rowState() isMissing param, both call sites, left-accent clsx, name cell ⚠ icon, ratio cell clsx
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — Same 6 symmetric changes
- `tests/renderer/global-max-missing-row.spec.tsx` — Created; 4 Phase 25 RTL tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stub attachment rows absent from peaks due to sampler skip**
- **Found during:** Investigation of visual verification failure
- **Issue:** `synthetic-atlas.ts` intentionally excludes stub regions from `dimsByRegionName` (T-21-09-04 mitigation). The sampler's `sourceDims.get(regionName) === undefined` guard skips these attachments. `globalPeaks` never contains them. Plan 25-01's `.map()+mark` approach only works when rows already exist to mark — with stub attachments never sampled, `peaksArray` has no row for them.
- **Fix:** Synthesize stub `DisplayRow`/`BreakdownRow` entries in `buildSummary` for each `skippedAttachment` absent from the sampler output. Uses `skeletonData.skins` walk for skin/slot context and `canonicalDimsByRegion` for source dims.
- **Files modified:** `src/main/summary.ts`
- **Commit:** `d53c295`

## Known Stubs

None — stub rows for missing attachments are now synthesized with real canonical dims from the JSON and are surfaced with proper visual indicators. The rows are not functional for export (empty `sourcePath`, `peakScale=0`) but correctly signal the missing state to the user.

## Self-Check: PASSED

- `src/main/summary.ts` exists and has isMissing synthesis logic
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` contains `| 'missing'`, `if (isMissing) return 'missing'`, `state === 'missing' && 'bg-danger'`, `row.isMissing &&`
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` contains same patterns
- `tests/renderer/global-max-missing-row.spec.tsx` exists with 4 tests — all pass
- Commit `d53c295` exists in git log
- 2 pre-existing test failures, 0 new failures

---
*Phase: 25-missing-attachments-in-context-display*
*Completed: 2026-05-04*
