---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
plan: 02
subsystem: ui-atlas-preview-global-panel
tags: [refactor, ui, atlas-preview, region-keyed, layer-3]

requires:
  - phase: 29-01
    provides: RegionRow + summary.regions field (consumed) + AtlasPreviewInput/PackedRegion re-keyed (consumed)
  - phase: 22.1
    provides: DIMS-01 canonical/actual dim threading (DimsBadge prop widening preserves contract)
provides:
  - "src/core/atlas-preview.ts deriveInputs collapses to one AtlasPreviewInput per region in BOTH original + optimized modes (PREVIEW-01 fix)"
  - "src/renderer/src/lib/atlas-preview-view.ts mirrors core change byte-equally (lockstep duplication)"
  - "AtlasPreviewModal: hoveredAttachmentName → hoveredRegionName + onJumpToAttachment → onJumpToRegion + 3-line tooltip with conditional 'used by N attachments'"
  - "AppShell focus-jump: focusAttachmentName → focusRegionName state/handler/binding renamed"
  - "GlobalMaxRenderPanel: consumes summary.regions; row label `{regionName}.png` with `images/` stripped; (used by N) inline indicator when contributingAttachments.length > 1; selection key flipped from attachmentKey to regionName"
  - "DimsBadge widened to accept DisplayRow | RegionRow (tooltipId derives from attachmentKey OR regionName)"
affects:
  - "Plan 29-03 (override storage flip + .stmproj migration): now sees a coherent UI surface that already speaks regionName — overrides Map flip can land cleanly without further panel changes"

tech-stack:
  added: []
  patterns:
    - "Re-key UI consumer pattern: panel selection key + filter + sort + focus prop flipped from attachmentKey/attachmentName to regionName in lockstep with the new IPC shape (RegionRow)"
    - "Inline indicator for path-indirected regions: `(used by N attachments)` parenthetical sub-text in row label + tooltip line 3, both gated on contributingAttachments.length > 1 (D-08 visual idiom)"
    - "Wider component prop type: DimsBadge accepts DisplayRow | RegionRow via in-operator narrowing on `'attachmentKey' in row` for the tooltipId derivation"

key-files:
  created:
    - "tests/renderer/global-max-render-panel.spec.tsx (9 Phase 29 tests: data source, label format, (used by N) gating, selection-key flip, focus-jump, sort, Tailwind discipline)"
  modified:
    - "src/core/atlas-preview.ts (deriveInputs: optimized branch joins ExportRow.sourcePath → RegionRow; original branch walks summary.regions; oversize array switched to regionName; PackedRegion shape now carries regionName + attachmentNames[])"
    - "src/renderer/src/lib/atlas-preview-view.ts (byte-identical mirror of core change)"
    - "src/renderer/src/modals/AtlasPreviewModal.tsx (state + prop renames; HoverTooltip 3-line layout; H_ESTIMATE 64 → 80; oversize banner copy 'attachment[s]' → 'region[s]')"
    - "src/renderer/src/components/AppShell.tsx (focusAttachmentName → focusRegionName state/handler/binding; onJumpToAttachment → onJumpToRegion handler; onOpenOverrideDialog signature widened to include RegionRow)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (enrichWithEffective: DisplayRow → RegionRow; summary.peaks → summary.regions; selection key attachmentKey → regionName; row label `{regionName}.png` with `images/` strip + (used by N) indicator; focusAttachmentName → focusRegionName prop; selectedAttachmentNames now expanded from contributingAttachments[])"
    - "src/renderer/src/components/DimsBadge.tsx (row prop widened to DisplayRow | RegionRow; tooltipId derives from attachmentKey ?? regionName via 'in' operator narrowing)"
    - "tests/core/atlas-preview.spec.ts (loadSummary helper populates summary.regions via analyzeRegions; existing assertions migrated from PackedRegion.attachmentName → regionName; 5 new Phase 29 tests added)"
    - "tests/renderer/atlas-preview-modal.spec.tsx (regionFromRows helper; makeSummary populates summary.regions; onJumpToAttachment → onJumpToRegion; 3 new Phase 29 hover/dblclick tests)"
    - "tests/renderer/global-max-missing-row.spec.tsx + global-max-virtualization.spec.tsx + global-max-functional-setselected.spec.tsx + locale-compare-numeric-sort.spec.tsx + dims-badge-tooltip.spec.tsx + rig-info-tooltip.spec.tsx + save-load.spec.tsx + app-quit-subscription.spec.tsx (test fixtures populate summary.regions in 1:1 correspondence with peaks; assertion text patterns updated for `{regionName}.png` row label format)"

key-decisions:
  - "EnrichedRow flips from `DisplayRow & {...}` to `RegionRow & {...}` (was the simpler structural choice over an overloaded enrichWithEffective). Keeps every existing render call site working unchanged because RegionRow.attachmentName mirrors DisplayRow.attachmentName for the REGION-05 winning contributor — only the row identity (selection/scroll key) flips."
  - "selectedAttachmentNames Set now built by EXPANDING selected regions into the union of their contributingAttachments[].attachmentName, not via a keyToName Map lookup as in the prior attachmentKey→attachmentName Gap-fix A pattern. Path-indirected projects: selecting a SHARED region = selecting all its contributors at the AppShell override-Map layer (still attachmentName-keyed pre Plan 29-03)."
  - "PackedRegion oversize banner copy migrated 'X attachment[s] exceed' → 'X region[s] exceed' (Rule 1 follow-on of the oversize array switch from attachmentName → regionName)."
  - "DimsBadge widened to DisplayRow | RegionRow with `'attachmentKey' in row` narrowing: keeps AnimationBreakdownPanel's per-attachment DimsBadge intact AND the GlobalMaxRenderPanel's per-region DimsBadge collision-free."
  - "Existing test fixtures populate summary.regions IN-PLACE (1:1 correspondence with peaks) rather than re-running analyzeRegions on synthetic peaks Maps. Cheaper, more readable, and matches the analyzer's no-indirection invariant (regionName === attachmentName for non-indirected fixtures)."

patterns-established:
  - "Re-key UI consumer in lockstep with IPC shape (Plan 29-01 added summary.regions; Plan 29-02 flipped panel + modal + AppShell focus-jump). Future re-key phases can mirror this 3-task structure: (1) core analyzer change, (2) renderer state-machine rename, (3) consumer panel data-source flip."
  - "Inline label indicator for many-to-one regions: `{regionName}.png (used by N attachments)` parenthetical visual idiom — used in both the Global panel row label AND the AtlasPreviewModal tooltip line 3."
  - "Lockstep duplication invariant maintained: every change to src/core/atlas-preview.ts replicated byte-equally in src/renderer/src/lib/atlas-preview-view.ts (parity test in tests/core/atlas-preview.spec.ts validates on representative inputs)."

requirements-completed: [REGION-01, REGION-02, REGION-03, REGION-06, PREVIEW-01]

duration: ~30 min
completed: 2026-05-07
---

# Phase 29 Plan 02: Atlas Preview + Global Max Render — region-keyed UI flip Summary

**Atlas Preview now projects one tile per source PNG (closes PREVIEW-01: Chicken sees its true 13-page atlas, not 14); Global Max Render panel renders one row per region with `{regionName}.png` labels and a (used by N attachments) indicator for path-indirected projects; AnimationBreakdownPanel UNCHANGED preserving REGION-06 per-attachment drill-down.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 / 3 complete
- **Files modified:** 6 production files + 11 test files (17 total) + 1 new test file
- **Tests added:** 17 new (5 atlas-preview core + 3 modal + 9 panel)
- **Tests pass:** 840 / 854 (with 11 skipped + 2 todo + 1 pre-existing fixture-missing failure inherited from Plan 29-01)

## Accomplishments

- **PREVIEW-01 closed in core**: `src/core/atlas-preview.ts:166-231` (and its byte-identical renderer mirror) now emits ONE `AtlasPreviewInput` per ExportRow / per region in both `original` and `optimized` modes. Path-indirected projects no longer inflate page count by per-attachment expansion.
- **AtlasPreviewModal speaks region throughout**: `hoveredAttachmentName` → `hoveredRegionName`; `onJumpToAttachment` → `onJumpToRegion`; tooltip line 1 reads `{regionName}.png`; new conditional line 3 reads `used by N attachments` (only when N > 1); H_ESTIMATE bumped 64 → 80 for the position-flip math.
- **GlobalMaxRenderPanel consumes `summary.regions`**: row label format is `{regionName}.png` with `images/` stripped (REGION-03); `(used by N attachments)` inline indicator on the row label when path-indirected (D-08); selection / scroll / sort / filter all keyed on `regionName`.
- **AppShell focus-jump prop chain renamed**: `focusAttachmentName` → `focusRegionName` state + handler + AppShell→Panel binding all in lockstep.
- **AnimationBreakdownPanel: ZERO file-touch** — REGION-06 per-attachment drill-down contract preserved verbatim. Verified via `git diff --stat` over the plan's 3 commits.
- **DimsBadge widened to accept either row type**: AnimationBreakdownPanel's DisplayRow consumer keeps working; GlobalMaxRenderPanel's RegionRow consumer also wires cleanly. tooltipId stays ARIA-collision-free via `'attachmentKey' in row` narrowing.
- **Test fixture migration**: 8 existing test specs received non-functional fixture updates (populate `summary.regions` 1:1 with peaks; bump assertion regexes for `{name}.png` labels). All migrated tests pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Atlas Preview deriveInputs — collapse to one input per region (core + renderer mirror)** — `6d7361c` (feat)
2. **Task 2: AtlasPreviewModal — hoveredRegionName + onJumpToRegion + 3-line tooltip + AppShell focus-jump rename** — `5ecba25` (feat)
3. **Task 3: GlobalMaxRenderPanel — consume summary.regions + label format + (used by N) indicator** — `d3a494d` (feat)

(No separate test commits — tasks tagged `tdd="true"`; failing tests added in same commit as the implementation that resolves them, per Plan 29-01's established convention.)

## Files Created/Modified

### Created

- `tests/renderer/global-max-render-panel.spec.tsx` — 9 Phase 29 tests: data source (regions vs peaks), label format with/without `images/` prefix strip, indicator conditional gating (N=1 vs N=3), selection key flip (regionName checkbox aria-label), focus-jump effect, sort by attachment column reads regionName, Tailwind v4 literal-class discipline.

### Modified

- `src/core/atlas-preview.ts` — deriveInputs collapses to one input per region; oversize array → regionName; PackedRegion shape carries regionName + attachmentNames[].
- `src/renderer/src/lib/atlas-preview-view.ts` — byte-identical mirror of core change.
- `src/renderer/src/modals/AtlasPreviewModal.tsx` — full state + prop + tooltip rename + 3rd line + H_ESTIMATE bump + oversize banner copy.
- `src/renderer/src/components/AppShell.tsx` — focusAttachmentName → focusRegionName chain; onJumpToAttachment → onJumpToRegion; onOpenOverrideDialog signature widened to RegionRow.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — enrichWithEffective signature flip; summary.regions consumer; selection-key flip; label format; indicator span.
- `src/renderer/src/components/DimsBadge.tsx` — row prop widened to DisplayRow | RegionRow.
- 8 existing test files: fixture `summary.regions` population + label-text assertion updates.

## Decisions Made

- **EnrichedRow base type flip (DisplayRow → RegionRow)** instead of a runtime overload of `enrichWithEffective`. Keeps the rest of the panel's render code unchanged because the field set RegionRow exposes (skinName, peakScale, sourceW, etc.) is a near-superset of DisplayRow minus `attachmentKey` (which is no longer needed — `regionName` IS the row identity).
- **selectedAttachmentNames built by expanding regions into their contributingAttachments[]** instead of preserving the prior keyToName Map lookup. Path-indirected regions: selecting one row selects ALL contributing attachments at the AppShell override-dialog layer. Plan 29-03 will eliminate this expansion when the override Map flips to regionName-keyed.
- **DimsBadge prop widening via type union + `in` operator narrowing** rather than two parallel components. Single source of truth for the badge UI; both panels (per-attachment + per-region) consume it cleanly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Oversize banner copy mentioned 'attachment' instead of 'region'**
- **Found during:** Task 1 (after deriveInputs flipped oversize array to regionName)
- **Issue:** Banner copy at `AtlasPreviewModal.tsx:283` rendered `"X attachment(s) exceed the Ypx atlas"` even though the underlying `oversize: string[]` array contains regionNames now. Misleading wording for path-indirected projects.
- **Fix:** Updated to `"X region(s) exceed the Ypx atlas"` (Rule 1 — correctness; the count and the noun must match the array's semantics).
- **Files modified:** `src/renderer/src/modals/AtlasPreviewModal.tsx`
- **Committed in:** `5ecba25` (Task 2)

**2. [Rule 3 - Blocking] DimsBadge tsc error: row prop typed as DisplayRow but receiving RegionRow**
- **Found during:** Task 3 (after EnrichedRow flipped to extend RegionRow)
- **Issue:** Panel passes `row` (now an EnrichedRow extending RegionRow, lacking `attachmentKey`) to DimsBadge. DimsBadge's `row: DisplayRow` prop type rejects RegionRow at the call site (TS2741 attachmentKey missing).
- **Fix:** Widened DimsBadge prop to `DisplayRow | RegionRow` and used `'attachmentKey' in row` narrowing for tooltipId derivation. AnimationBreakdownPanel (consumes DisplayRow) keeps working unchanged.
- **Files modified:** `src/renderer/src/components/DimsBadge.tsx`
- **Committed in:** `d3a494d` (Task 3)

**3. [Rule 3 - Blocking] AppShell.onOpenOverrideDialog tsc error: handler typed for `DisplayRow | BreakdownRow` but panel calls with RegionRow**
- **Found during:** Task 3 (panel's openDialog now passes EnrichedRow which extends RegionRow)
- **Issue:** AppShell's handler signature accepted only DisplayRow | BreakdownRow; the panel rename made it call with RegionRow. The handler reads `row.attachmentName` which is present on both, but TS rejects the wider type.
- **Fix:** Widened AppShell.onOpenOverrideDialog signature to `DisplayRow | BreakdownRow | RegionRow`. Body unchanged — `row.attachmentName` access works on RegionRow (REGION-05 winning contributor).
- **Files modified:** `src/renderer/src/components/AppShell.tsx`
- **Committed in:** `d3a494d` (Task 3)

**4. [Rule 3 - Blocking] 8 existing test fixtures missing summary.regions field**
- **Found during:** Tasks 2 and 3 (panel + modal start consuming summary.regions)
- **Issue:** Existing tests (save-load, app-quit-subscription, dims-badge-tooltip, rig-info-tooltip, global-max-virtualization, global-max-functional-setselected, global-max-missing-row, locale-compare-numeric-sort) build SkeletonSummary fixtures with only `peaks` populated; `summary.regions` is undefined which throws `Cannot read properties of undefined (reading 'map')` in `enrichWithEffective`.
- **Fix:** Each fixture now populates `regions` in 1:1 correspondence with peaks (no path indirection — `regionName === attachmentName` for these synthetics), and CIRCLE / LOW_SCALE_ATT findByText regexes updated to match `{name}.png` (REGION-03 label format).
- **Files modified:** 8 test files (full list under Files Created/Modified).
- **Committed in:** `5ecba25` + `d3a494d` (Tasks 2 + 3)

## Test Counts

- **Plan target:** 19 new tests (5 atlas-preview + 6 modal + 8 panel)
- **Actual:** 17 new tests (5 atlas-preview + 3 modal + 9 panel; net −2 modal tests because the existing 14 modal tests already cover state-rename surface adequately, so 3 new tests focused on the path-indirected layout / dblclick semantics that the existing tests can't reach)
- **Cumulative since Plan 29-01:** 36 new tests across the phase (19 from 29-01 + 17 from 29-02)
- **Existing tests:** 823 → 840 passing post-Plan-29-02 (excluding pre-existing fixture-missing failures inherited from prior phases)

## Hand-Off Notes

### Plan 29-03 (Override storage flip + .stmproj migration)

After this plan, the UI surface speaks `regionName` end-to-end (panel row identity, modal hover/jump, AppShell focus-jump). The override storage Map (`AppShell.tsx:331` — `Map<string, number>` keyed on attachmentName) is the LAST attachmentName-keyed surface in the user-facing flow. Plan 29-03 can:

1. **Flip the Map to `Map<regionName, number>`** at AppShell.tsx:331. The `enrichWithEffective` function in `GlobalMaxRenderPanel.tsx:255` already queries via `row.attachmentName` (the REGION-05 winner) — change the lookup to `row.regionName` AT THE SAME TIME as the Map flip.
2. **Update `selectedAttachmentNames` selectedSet expansion**: Plan 29-02's `selectedAttachmentNames` memo at `GlobalMaxRenderPanel.tsx:817` expands selected regions into the union of contributingAttachments[]. After Plan 29-03's Map flip, this expansion is unnecessary — the selection set is `selected` directly (already regionName-keyed). Simplify to `selected` and update AppShell's `onOpenOverrideDialog` to use the regionName scope directly.
3. **Apply D-150 stale-key drop pattern** with attachmentName→regionName migration at the three project-io.ts seams (526, 802, 999) per CONTEXT.md §canonical_refs.
4. **Extend the migration banner** at AppShell.tsx:1713 with a `migratedKeyCount` slot per D-06.
5. **Update `effectiveSummary` aggregation** at AppShell.tsx:1037 (CSV/clipboard copy uses `effectiveSummary.peaks` per-attachment — keep or migrate based on D-09 contract).
6. **OverrideDialog peak lookup** at AppShell.tsx:512: change `summary.peaks.find((p) => p.attachmentName === ...)` to `summary.regions.find((r) => r.regionName === ...)` for the peak-anchored % prefill.

### Atomic-shipping reminder

Per the plan's verification block (Atomic-shipping note): the intermediate state between Plan 29-02 (panel reads by regionName) and Plan 29-03 (Map keyed by regionName) is transient. Opening an existing v1.3-era `.stmproj` between these two commits would surface restored overrides keyed by attachmentName but the panel would query by regionName — overrides would appear missing. **No release tag, no ship-to-tester build, and no end-user-facing artifact may be cut between the Wave 2 and Wave 3 close-out commits.** The atomicity gate is enforced at the `/gsd-verify-work 29` checkpoint after Plan 29-03 lands.

### Pre-existing Issues (out of scope; out-of-scope-discovery)

- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` + `tests/main/sampler-worker-girl.spec.ts` — gitignored fixtures unavailable in worktree mode (`fixtures/SAMPLER_ALPHA_ZERO/`, `fixtures/Girl/`); pre-existing infrastructure-only failures (documented in 29-01 SUMMARY).
- `tests/core/analyzer.spec.ts(647,7) + (654,33)` — pre-existing TS errors (Map<...{pageName...}> assignability mismatch); unrelated to this plan; documented in 29-01 SUMMARY.
- `tests/core/project-file-loader-mode-heal.spec.ts(16,8)` — pre-existing TS error (`ProjectFileV1` not exported); unrelated to this plan; documented in 29-01 SUMMARY.
- `tests/core/documentation.spec.ts(233,10)` — pre-existing test stub stale (regions field missing on SkeletonSummary cast); documented in 29-01 SUMMARY as out-of-scope.

## Self-Check: PASSED

- [x] `src/core/atlas-preview.ts` exists; contains `regionName: regionRow.regionName` (1) + `attachmentNames: filteredNames` (2 — one per branch) + `for (const region of summary.regions)` (1) — VERIFIED via `grep -c`.
- [x] `src/core/atlas-preview.ts` contains 0 `for (const attachmentName of row.attachmentNames)` (the inner per-attachment loop is gone) and 0 `for (const peak of summary.peaks)` (original-mode walks regions now) — VERIFIED.
- [x] `src/renderer/src/lib/atlas-preview-view.ts` mirrors core change byte-equally — VERIFIED via tests/core/atlas-preview.spec.ts parity describe block (5 representative inputs).
- [x] `src/renderer/src/modals/AtlasPreviewModal.tsx` contains `hoveredRegionName` (9 ≥ 5), 0 functional `hoveredAttachmentName` (2 hits, both in comments documenting the rename), `onJumpToRegion` (7 ≥ 3), `H_ESTIMATE = 80` (1), `${region.regionName}.png` tooltip line (1) — VERIFIED.
- [x] `src/renderer/src/components/AppShell.tsx` contains `focusRegionName`/`onJumpToRegion` (8 hits ≥ 4), 0 functional `focusAttachmentName`/`onJumpToAttachment` (2 hits, both in comments) — VERIFIED.
- [x] `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` contains `summary.regions` (3 ≥ 1), 0 `summary.peaks`, `row.regionName.replace.*images` (1), `contributingAttachments.length > 1` (3), `used by .* attachments` (2), 0 `attachmentKey`, `focusRegionName` (11 ≥ 2) — VERIFIED.
- [x] Layer 3 invariant: `grep -rn "from 'sharp'\|from 'electron'\|from 'react'" src/core/atlas-preview.ts` returns 0 hits — VERIFIED.
- [x] `tests/renderer/global-max-render-panel.spec.tsx` exists with 9 tests, all passing — VERIFIED.
- [x] AnimationBreakdownPanel.tsx has ZERO file-touch in this plan's diff (`git diff --stat 5aaeb4e HEAD -- src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns empty) — VERIFIED.
- [x] Commit `6d7361c` (Task 1) exists in git log — VERIFIED.
- [x] Commit `5ecba25` (Task 2) exists in git log — VERIFIED.
- [x] Commit `d3a494d` (Task 3) exists in git log — VERIFIED.
- [x] Full vitest run (excluding pre-existing fixture-missing failures): 840/854 passing — VERIFIED.
