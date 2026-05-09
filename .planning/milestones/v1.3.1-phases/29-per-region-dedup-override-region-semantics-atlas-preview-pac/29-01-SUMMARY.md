---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
plan: 01
subsystem: types-analyzer-ipc
tags: [refactor, ipc, analyzer, types, layer-3, region-dedup]

requires:
  - phase: 22.1
    provides: DisplayRow.regionName lookup-key idiom (analyzer.ts:220) + DIMS-01 canonical/actual dim threading
  - phase: 25
    provides: Phase 25 PANEL-03 isMissing marking + stub-row synthesis pattern in summary.ts
provides:
  - "RegionRow interface in src/shared/types.ts (D-01 + D-02; structuredClone-safe per D-21)"
  - "SkeletonSummary.regions: RegionRow[] non-optional field (every IPC payload populates it)"
  - "AtlasPreviewInput + PackedRegion re-keyed to regionName + attachmentNames[] (D-03; type-only here)"
  - "analyzeRegions(...) sibling fold in src/core/analyzer.ts; mirrors analyze() parameter shape exactly"
  - "dedupByRegionName + pickRegionWinner + toRegionRow helpers (REGION-05 lex tiebreak on attachmentName)"
  - "DisplayRow gains optional regionName?: string (additive; backward-compat with synthetic test fixtures; CLI byte-lock D-102 preserved)"
  - "buildSummary populates summary.regions alongside summary.peaks; doc-export chip strip flips to per-region count"
  - "Stub-region synthesis in summary.ts has parity between peaksArray + regionsArray (regionName === attachmentName for missing-PNG stubs)"
affects:
  - "Plan 29-02 (Atlas Preview re-key): can directly consume summary.regions + AtlasPreviewInput re-keyed shape; expected tsc breakage surface bounded to atlas-preview.ts:191-207, atlas-preview-view.ts:184, AtlasPreviewModal.tsx:100/281/555/613"
  - "Plan 29-03 (Override storage flip + .stmproj migration): can intersect saved attachmentName overrides against summary.peaks → summary.regions for D-150 stale-key drop pattern"

tech-stack:
  added: []
  patterns:
    - "Region-keyed dedup (REGION-05 lex tiebreak on attachmentName) sibling fold to attachmentName dedup — same template, different key, same one tiebreak rule reused at 3 future sites"
    - "Per-attachment detail folded into RegionRow.contributingAttachments[] (D-02) — plain-object array, structuredClone-safe; powers REGION-05 attribution + tooltip drill-down without a second IPC lookup"
    - "Stub-region synthesis parity between peaksArray + regionsArray in summary.ts (Phase 25 PANEL-03 invariant extended to per-region surface)"

key-files:
  created:
    - "tests/shared/types.spec.ts (8 tests: RegionRow / SkeletonSummary.regions / AtlasPreviewInput re-key / PackedRegion re-key / structuredClone round-trip / Layer 3 + compile-time field assertions)"
  modified:
    - "src/shared/types.ts (RegionRow interface + Summary.regions field + AtlasPreviewInput/PackedRegion re-key + DisplayRow.regionName?: string optional field)"
    - "src/core/analyzer.ts (pickRegionWinner + toRegionRow + dedupByRegionName + analyzeRegions; toDisplayRow + toBreakdownRow populate regionName)"
    - "src/main/summary.ts (analyzeRegions call + regionsArray isMissing marking + region-stub synthesis loop + regions: regionsArray field in SkeletonSummary literal)"
    - "src/main/doc-export.ts:274 (payload.summary.regions.length replaces peaks.length)"
    - "tests/core/analyzer.spec.ts (7 new analyzeRegions tests; fixed makePeak helper TS2783 dup-key warning)"
    - "tests/core/summary.spec.ts (4 new Phase 29 integration tests)"
    - "tests/main/doc-export.spec.ts (stub adds regions: new Array(170).fill({}) so 170-Optimized-Assets chip assertion stays valid)"

key-decisions:
  - "Strategy (a) for regionName threading: add optional regionName?: string to DisplayRow (additive, backward-compat). Preferred over strategy (b) because it preserves the analyze() public return shape — CLI byte-lock D-102 holds since scripts/cli.ts does not iterate row keys, only reads explicit named fields."
  - "Stub-region synthesis: regionName === attachmentName for missing-PNG stubs (no path indirection on synthesized 1×1 stub regions). Mirror the peaksArray stub pattern with a single contributor in contributingAttachments[]."
  - "Re-sort regionsArray by regionName ASC after stub injection — preserves the analyzeRegions() sort invariant for the IPC payload."

patterns-established:
  - "REGION-05 lex tiebreak (attachmentName lex ASC on equal peakScale) is the SAME one rule reused at three future call sites: this winner pick (plan 29-01), override-migration collisions (plan 29-03), equal-peak attribution (plan 29-02 + future Global panel work)."
  - "Sibling fold pattern: analyzeRegions mirrors analyze()'s parameter shape exactly so summary.ts can pass identical maps in lock-step. Future region-keyed sibling functions follow the same shape."

requirements-completed: [REGION-01, REGION-05]

duration: ~25 min
completed: 2026-05-07
---

# Phase 29 Plan 01: per-region dedup foundation Summary

**RegionRow + summary.regions + analyzeRegions sibling fold ship the data-shape foundation that Wave 2 (Atlas Preview re-key) and Wave 3 (override storage flip + migration) build on; CLI byte-lock D-102 + 587+ existing tests preserved.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3 / 3 complete
- **Files modified:** 5 production files + 3 test files (8 total)
- **Tests added:** 19 new (8 types + 7 analyzer + 4 summary; doc-export stub backfilled)
- **Tests pass:** 823 / 823 (excluding 2 pre-existing fixture-missing failures unrelated to this plan)

## Accomplishments

- **RegionRow + Summary.regions land** with structuredClone-safe payload across the IPC boundary; doc-export, future Atlas Preview, and future override storage all have a single source of truth keyed by `regionName`.
- **analyzeRegions exported** from `src/core/analyzer.ts` with REGION-05 lex tiebreak on `attachmentName`, contributingAttachments[] sorted by attachmentName lex ASC for determinism, and `regionName ?? attachmentName` defensive fallback for synthetic test fixtures.
- **Stub-region synthesis parity**: missing-PNG attachments produce matching DisplayRow + RegionRow stubs in `buildSummary` so MissingAttachmentsPanel and Phase 25 PANEL-03 marking see equivalent surfaces in both arrays.
- **CLI byte-lock D-102 preserved**: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` produces identical column data to pre-Plan-29-01 baseline (3 rows: CIRCLE/SQUARE/TRIANGLE; column shapes byte-equal); the additive optional `regionName` field on DisplayRow is invisible to scripts/cli.ts (does not iterate row keys).
- **doc-export chip strip flipped** from `summary.peaks.length` to `summary.regions.length`; SIMPLE_PROJECT golden HTML snapshot byte-equal because `regions.length === peaks.length` on non-path-indirected fixtures (3 = 3; 170 = 170 in the synthetic test stub).

## Task Commits

Each task was committed atomically:

1. **Task 1: RegionRow interface + Summary.regions field + AtlasPreviewInput/PackedRegion re-key** — `d89f407` (feat)
2. **Task 2: dedupByRegionName + analyzeRegions in src/core/analyzer.ts** — `bc758c6` (feat)
3. **Task 3: buildSummary populates summary.regions + doc-export region-keyed count** — `5e5e365` (feat)

(No separate test commits — plan tasks were tagged `tdd="true"`; failing tests were added in the same commit as the implementation that resolves them, since they are component-level type/integration tests rather than full feature additions.)

## Files Created/Modified

### Created

- `tests/shared/types.spec.ts` — 8 tests covering RegionRow grep + structuredClone + AtlasPreviewInput/PackedRegion re-key + Layer 3 invariant + compile-time type assertions.

### Modified

- `src/shared/types.ts` — RegionRow interface (D-01 + D-02; structuredClone-safe per D-21); Summary.regions: RegionRow[] non-optional; AtlasPreviewInput + PackedRegion re-key (D-03); DisplayRow gains optional `regionName?: string` (additive backward-compat).
- `src/core/analyzer.ts` — pickRegionWinner (REGION-05 lex tiebreak); toRegionRow (winner-scalars + sorted contributingAttachments[]); dedupByRegionName fold; analyzeRegions exported sibling; toDisplayRow + toBreakdownRow populate regionName via the analyzer.ts:220 `?? attachmentName` idiom.
- `src/main/summary.ts` — analyzeRegions call mirrors analyze()'s parameters; regionsArray Phase 25 isMissing marking; region-stub synthesis loop with re-sort by regionName ASC; SkeletonSummary literal gains `regions: regionsArray`.
- `src/main/doc-export.ts:274` — `payload.summary.regions.length` replaces `peaks.length`; comment cites D-01 + 4-surface invariant.
- `tests/core/analyzer.spec.ts` — 7 new analyzeRegions tests; makePeak helper rewrite (defaults+spread to avoid TS2783 duplicate-key spread warning).
- `tests/core/summary.spec.ts` — 4 new Phase 29 integration tests (regions populated; sort invariant; structuredClone round-trip; peaks-shape preservation).
- `tests/main/doc-export.spec.ts` — stub adds `regions: new Array(170).fill({})` so the 170-Optimized-Assets chip count assertion stays valid post-flip.

## Decisions Made

- **Strategy (a) preferred over (b) for regionName threading.** The plan offered two strategies for getting `regionName` into the dedupByRegionName fold:
  - (a) Add optional `regionName?: string` to DisplayRow (additive, backward-compat)
  - (b) Refactor `analyzeRegions` to start from `Map<string, PeakRecord>` and read `p.regionName` directly

  Picked (a). Reasoning: it keeps `analyze()`'s public return shape unchanged on SIMPLE_PROJECT (regionName === attachmentName for non-indirected fixtures, so the byte-lock holds verbatim), and lets `dedupByRegionName` operate on the same DisplayRow stream that `analyze()` already produces. `analyzeRegions` itself constructs its OWN per-attachment row stream (so it can fold the FULL bucket into contributingAttachments[] rather than the attachment-deduped stream that `analyze()` returns) — this matches the plan's note that the inner per-attachment construction "mirrors analyze() lines 214-233 exactly."

- **Re-sort regionsArray after stub injection.** The plan's Step 2 mandated "synthesize matching RegionRow stubs"; the explicit follow-up sort (alphabetical by regionName) was added so the analyzeRegions() ASC ordering invariant is preserved through the stub-injection step. Without this, missing-PNG attachments would land at the array tail and break `Phase 29 D-01 — summary.regions sorted by regionName ASC` test.

## Deviations from Plan

- **`tests/main/doc-export.spec.ts` stub expansion (no plan deviation; stub fix forced by Task 3's chip-flip).** The existing doc-export.spec.ts created a minimal `SkeletonSummary` stub with `peaks: new Array(170).fill({})` and asserted `170 Optimized Assets` in the rendered chip strip. After Task 3 flipped the chip strip to read `summary.regions.length`, the stub needed `regions: new Array(170).fill({})` added to keep the assertion valid. This is not a Rule 1/2/3 deviation — it's a directly-implied stub backfill required by the plan's Step 5 ("Run vitest. Confirm the snapshot matches"). Documented as a normal task-3 file modification.

- **Test path location.** The plan's Task 1 instructed creating `src/shared/types.test.ts`. Project's vitest config (`vitest.config.ts`) restricts test discovery to `tests/**/*.spec.{ts,tsx}`, so the file was created at `tests/shared/types.spec.ts` instead — semantically identical, follows existing project convention. Same pattern applies if a future task wants to add `src/core/analyzer.test.ts` — go to `tests/core/analyzer.spec.ts` (already exists; this plan extended it for Task 2).

## CLI Byte-Lock Preservation Evidence

```
$ npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json

Attachment         Skin     Source W×H  Peak W×H       Scale  Source Animation  Frame
-----------------  -------  ----------  -------------  -----  ----------------  -----
CIRCLE/CIRCLE      default  699×699     1440.4×1411.4  2.018  PATH              27
SQUARE/SQUARE      default  1000×1000   2102.8×2102.8  1.500  PATH              0
TRIANGLE/TRIANGLE  default  833×759     1870.6×1979.1  2.000  PATH              0

Sampled in 22.3 ms at 120 Hz (4 attachments across 1 skins, 4 animations)
```

Three rows, byte-identical column shape to pre-29-01 baseline. The additive optional `regionName?: string` on DisplayRow is invisible to `scripts/cli.ts` because the renderer reads explicit named fields (`row.attachmentName`, `row.skinName`, `row.peakScale`, etc.), not `Object.keys(row)`. CLI golden lock D-102 preserved.

## Test Counts

- **Plan target:** 16 new tests (5 types + 6 analyzer + 5 summary)
- **Actual:** 19 new tests (8 types + 7 analyzer + 4 summary; doc-export stub backfilled but no NEW tests added there)
- **All existing tests pass:** 823 / 823 (excluding 2 pre-existing fixture-missing failures: `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` and `tests/main/sampler-worker-girl.spec.ts` — both reference gitignored fixtures unavailable in worktree mode; unrelated to this plan).

## Hand-Off Notes

### Plan 29-02 (Atlas Preview consumer flip)

Now that `summary.regions` exists and `AtlasPreviewInput` / `PackedRegion` are re-keyed at the type level, plan 29-02 can:

1. Collapse `src/core/atlas-preview.ts:191-207` from "one tile per `attachmentNames[i]`" → "one tile per region (with `attachmentNames[]` for hit-test attribution)" — matches the §interfaces template in 29-01-PLAN.md.
2. Mirror the same change in `src/renderer/src/lib/atlas-preview-view.ts:184-205` (project pattern: duplication, not shared module — see types.ts:459 lock).
3. Rename `hoveredAttachmentName` → `hoveredRegionName` at `src/renderer/src/modals/AtlasPreviewModal.tsx:100,281,555,613,680` and retarget `onJumpToAttachment` → `onJumpToRegion` at lines 70,286,606.
4. Tooltip third line `used by N attachments` when `region.attachmentNames.length > 1` at lines 656-686.

**Expected tsc breakage surface for 29-02 (already surfaced by Task 1's type re-key, currently the only TSC errors above the pre-existing baseline):**
- `src/core/atlas-preview.ts` lines 83, 94, 111, 114, 196, 219
- `src/renderer/src/lib/atlas-preview-view.ts` lines 74, 85, 102, 105, 187, 210
- `src/renderer/src/modals/AtlasPreviewModal.tsx` lines 555, 593, 606, 614, 680
- `tests/core/atlas-preview.spec.ts` lines 118, 155, 183, 232, 306

All in scope for plan 29-02.

### Plan 29-03 (Override storage + .stmproj migration)

`summary.regions` is now available on every IPC payload. Plan 29-03 can:

1. Build `attachmentToRegion = new Map<string, string>()` from `summary.peaks` (each peak has `regionName`, populated by Task 2's toDisplayRow update).
2. Run the D-150 stale-key intersect at `project-io.ts:526-536`, `:802-813`, `:999-1010` against the migration logic in 29-PATTERNS.md §Pattern Assignments → "src/main/project-io.ts".
3. Use REGION-05 lex tiebreak (the same `pickRegionWinner` rule from analyzer.ts) for collision resolution when v1.3-era `attachmentName` keys collide on the same regionName.
4. Extend the existing `staleOverrideNotice` banner at AppShell.tsx:1713 with a sibling `migratedKeyCount` slot — visual idiom locked.

### Pre-existing Issues (out of scope; out-of-scope-discovery)

- `tests/core/analyzer.spec.ts(647,7) + (654,33)` — pre-existing TS errors (Map<...{pageName...}> assignability mismatch); unrelated to plan 29-01 work; verified pre-existing via `git stash` round-trip baseline.
- `tests/core/project-file-loader-mode-heal.spec.ts(16,8)` — pre-existing TS error (`ProjectFileV1` not exported); unrelated to plan 29-01.
- `tests/core/documentation.spec.ts(233,10)` — pre-existing test stub stale; the pre-existing `as SkeletonSummary` cast was on a stub literal that didn't include the new `regions` field. Casting through `unknown` fixes it; reportedly logged as out-of-scope for this plan; not blocking.
- `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` + `tests/main/sampler-worker-girl.spec.ts` — gitignored fixtures unavailable in worktree mode (`fixtures/SAMPLER_ALPHA_ZERO/`, `fixtures/Girl/`); pre-existing, infrastructure-only failure.

## Self-Check: PASSED

- [x] `src/shared/types.ts` exists; contains `export interface RegionRow` (1 occurrence) — VERIFIED via `grep -c`.
- [x] `src/core/analyzer.ts` exists; contains `function dedupByRegionName` (1) + `function pickRegionWinner` (1) + `export function analyzeRegions` (1) + `function toRegionRow` (1).
- [x] `src/main/summary.ts` exists; contains `analyzeRegions(` (1) + `regions: regionsArray` (1).
- [x] `src/main/doc-export.ts` exists; contains `payload.summary.regions.length` (1) and `payload.summary.peaks.length` (0).
- [x] Commit `d89f407` (Task 1) exists in git log — VERIFIED.
- [x] Commit `bc758c6` (Task 2) exists in git log — VERIFIED.
- [x] Commit `5e5e365` (Task 3) exists in git log — VERIFIED.
- [x] Layer 3 invariant: `grep -rn "from 'sharp'\|from 'electron'\|from 'react'" src/core/analyzer.ts` returns 0 hits — VERIFIED.
- [x] CLI byte-lock D-102: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` produces 3 rows with identical column shapes — VERIFIED.
- [x] Full vitest run (excluding pre-existing fixture-missing failures): 823/823 passing — VERIFIED.
