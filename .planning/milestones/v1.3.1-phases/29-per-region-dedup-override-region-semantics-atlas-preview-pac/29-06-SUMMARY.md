---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
plan: 06
subsystem: core
tags: [bugfix, analyzer, region-dedup, contributor-count, gap-closure, WR-01]

# Dependency graph
requires:
  - phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac/01..04
    provides: analyzeRegions + RegionRow.contributingAttachments[] surface
  - phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac/05
    provides: regionName-keyed selection handoff (CR-01) — independent surface
provides:
  - "toRegionRow Set-based dedup of contributingAttachments[] by attachmentName"
  - "Lock against slot-fan-out re-introduction (===3 exact-count assertion + lex-sorted name array equality)"
  - "Visible UX contract: `(used by N attachments)` panel indicator + AtlasPreviewModal tooltip count UNIQUE attachmentNames"
affects: [phase-30, future-rigs-with-multi-slot-attachment-bindings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Set-based dedup chained into existing lex-sort filter"
    - "First-after-lex-sort pick rule (matches REGION-05 lex-tiebreak semantics)"

key-files:
  created: []
  modified:
    - src/core/analyzer.ts
    - tests/core/analyzer.spec.ts
    - tests/regression/path-indirection.spec.ts

key-decisions:
  - "Dedup lives in toRegionRow (Layer 3 boundary), NOT in dedupByRegionName upstream — preserves bucket information for other consumers"
  - "First-after-lex-sort picks the kept entry's slotName (deterministic; matches REGION-05 lex-tiebreak)"
  - "SIMPLE_PROJECT analyzeRegions Test 1 assertion updated from `square.contributingAttachments.length === 2` to `=== 1` (Rule 3 deviation: plan claim of `dedup is a no-op in every existing test` was incorrect — SQUARE attachment binds to two slots SQUARE + SQUARE2 with the same attachmentName)"

patterns-established:
  - "WR-01 dedup at toRegionRow: bucket-fold preserves full per-slot trail; per-region UI surface deduplicates by attachmentName"
  - "Exact-count regression assertions on path-indirection fixtures: catch both directions of regression (slot-fan-out re-introduction AND over-aggressive collapse)"

requirements-completed: [REGION-01, REGION-02]

# Metrics
duration: ~6min
completed: 2026-05-07
---

# Phase 29 Plan 06: Per-region contributingAttachments dedup (WR-01) Summary

**Set-based dedup of `RegionRow.contributingAttachments[]` by attachmentName at the `toRegionRow` boundary so `(used by N attachments)` UI surfaces count unique attachmentNames, not slot-binding fan-out.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-07T22:36:00Z (approx)
- **Completed:** 2026-05-07T22:42:00Z (approx)
- **Tasks:** 2 (both auto, Task 1 with TDD RED→GREEN sub-cycle)
- **Files modified:** 3

## Accomplishments
- Closed gap **WR-01** from 29-VERIFICATION.md: `analyzeRegions` now feeds the renderer mirror + AtlasPreviewModal a per-region `contributingAttachments[]` array containing exactly one entry per unique attachmentName (slot-binding fan-out collapses).
- 2 phase requirements re-closed: **REGION-01** (`(used by N attachments)` indicator displays unique-attachmentName count) + **REGION-02** (`used by N attachments` tooltip mirrors the panel via the same array).
- Added 2 new analyzer unit tests + 1 tightened regression assertion that lock the dedup contract against future regressions in **both** directions (slot-fan-out re-introduction → would push count to 4; over-aggressive collapse → would drop count to 1).

## Root Cause (29-VERIFICATION.md gap.reason quoted)

> `analyzeRegions` operates on the FULL `globalPeaks` Map (not the attachmentName-deduped output of `analyze()`), so when one attachmentName binds to multiple slots — e.g. Chicken-Min's `5/7` binding to slots `7`, `8`, `VOLUME_7`, `VOLUME_8` (4 PeakRecords with identical `attachmentName + regionName`, differing only in `slotName`) — `toRegionRow` maps each bucket member 1:1 into `contributingAttachments[]` with no dedup, producing duplicate contributor entries.

The visible defect: GlobalMaxRenderPanel's `(used by N attachments)` indicator + AtlasPreviewModal's `used by N attachments` tooltip line both reported inflated counts on rigs where any attachmentName binds to multiple slots. The pre-fix regression test at `tests/regression/path-indirection.spec.ts:60-69` (`>= 2` + `toContain` assertions) did not catch this because all three structural checks still passed when the array had 4 entries (3 unique + 1 duplicate).

## Fix Shape

### `src/core/analyzer.ts` — `toRegionRow` (lines 277-298 area)

```diff
 function toRegionRow(
   regionName: string,
   winner: DisplayRow,
   bucket: readonly DisplayRow[],
 ): RegionRow {
-  const sortedBucket = [...bucket].sort((a, b) =>
-    a.attachmentName.localeCompare(b.attachmentName),
-  );
+  // WR-01 / Phase 29 Plan 29-06 — dedup contributors by attachmentName.
+  // ... (full JSDoc comment block)
+  const seen = new Set<string>();
+  const sortedBucket = [...bucket]
+    .sort((a, b) => a.attachmentName.localeCompare(b.attachmentName))
+    .filter((r) => {
+      if (seen.has(r.attachmentName)) return false;
+      seen.add(r.attachmentName);
+      return true;
+    });
   const contributingAttachments = sortedBucket.map((r) => ({...}));
```

The rest of `toRegionRow` (the `return { regionName, ... }` literal at lines 295-327) is unchanged — only the `sortedBucket` construction gains the `.filter()` step.

### `tests/core/analyzer.spec.ts` — 2 new it() blocks inside the `analyzeRegions` describe

1. **WR-01 dedup case:** Two PeakRecords sharing `attachmentName='5/7' + regionName='5/7'` differing in `slotName` (VOLUME_7 vs VOLUME_8) → `regions[0].contributingAttachments.length === 1`. Locks the WR-01 fix at the unit-test boundary.
2. **WR-01 no-op-on-uniqueness:** Three distinct attachmentNames ('5/5/5/7/7', '5/5/7/7', '5/7') all on `regionName='5/7'` → `regions[0].contributingAttachments.length === 3` with exact lex-sorted name equality. Locks the no-op invariant against a future refactor that incorrectly dedups by `slotName` instead of `attachmentName`.

Both blocks live INSIDE the existing `describe('analyzeRegions (Phase 29 D-01 + D-02 + REGION-05)', ...)` block, after Test 6 ("output sorted by regionName ASC") and before the "Layer 3 invariant" test, so they reuse the existing `makePeak` helper.

### `tests/regression/path-indirection.spec.ts` — REGION-01 detail tightened

```diff
-it('REGION-01 detail: regionName "5/7" exists with 2+ contributingAttachments', () => {
-  ...
-  expect(r!.contributingAttachments.length).toBeGreaterThanOrEqual(2);
+it('REGION-01 detail: regionName "5/7" exists with exactly 3 unique contributingAttachments (Plan 29-06 / WR-01 lock)', () => {
+  ...
+  expect(r!.contributingAttachments.length).toBe(3);
+  ...
+  // Post-29-06: names array contains EXACTLY these three (no duplicates).
+  expect([...names].sort()).toEqual(['5/5/5/7/7', '5/5/7/7', '5/7']);
```

Pre-29-06 the dedup-less path produced 4 entries on Chicken-Min's `5/7` region (slots 7, 8, VOLUME_7, VOLUME_8); post-29-06 it produces 3 (5/5/5/7/7, 5/5/7/7, 5/7). Locking the exact count + lex-sorted name array equality catches both regression directions.

## Why the Dedup Lives in `toRegionRow` and Not `dedupByRegionName`

`dedupByRegionName` (lines 341-358) folds DisplayRows by `regionName` into `groups: Map<string, DisplayRow[]>`. The bucket may contain attachmentName-duplicates (different slots) — that is the SOURCE of the WR-01 defect. The fold itself is correct (groups by regionName); the defect is downstream when `toRegionRow` turns the bucket into the array. Doing the dedup at the `dedupByRegionName` layer would lose information the sampler/loader needs for downstream uses (the bucket is preserved across the fold). The right boundary is `toRegionRow`, where the per-region view is being constructed for the renderer/UI surface.

## Why First-After-Lex-Sort Is the Correct Pick Rule

- `pickRegionWinner` (analyzer.ts:160-174 area) already runs at the `dedupByRegionName` bucket-fold level and selects the highest-`peakScale` contributor as the row's WINNER (the row's top-level `peakScale`, `peakScaleX/Y`, `worldW/H`, `attachmentName`, `skinName`, `slotName`, `animationName`, `time`, `frame`, etc. all come from the winner). The `contributingAttachments[]` array is the FULL per-(slot,skin,attachment) trail; downstream consumers only display `attachmentName + peakScale` per contributor, so picking the first occurrence after lex-sort gives a deterministic, peakScale-correct representative entry for each unique attachmentName.
- The pre-existing analyzeRegions Test 5 ("RegionRow scalar fields = winner peak fields") locks the winner-selection invariant separately from `contributingAttachments[]` composition, so the dedup change does not affect that contract.

## Source-level Evidence

```
$ grep -n "new Set<string>()" src/core/analyzer.ts
290:  const seen = new Set<string>();

$ grep -n "if (seen.has(r.attachmentName)) return false" src/core/analyzer.ts
294:      if (seen.has(r.attachmentName)) return false;

$ grep -n "WR-01 / Phase 29 Plan 29-06" src/core/analyzer.ts
282:  // WR-01 / Phase 29 Plan 29-06 — dedup contributors by attachmentName.

$ grep -c "WR-01 / Phase 29 Plan 29-06" tests/core/analyzer.spec.ts
2

$ grep -n "contributingAttachments.length).toBe(3)" tests/regression/path-indirection.spec.ts
73:    expect(r!.contributingAttachments.length).toBe(3);

$ grep -n "contributingAttachments.length).toBeGreaterThanOrEqual(2)" tests/regression/path-indirection.spec.ts
(0 hits — the loose assertion is replaced)
```

## Behavior-level Evidence

- `npx vitest run tests/core/analyzer.spec.ts` → all 41 tests pass (2 new WR-01 tests + 39 pre-existing including the modified Test 1).
- `npx vitest run tests/regression/path-indirection.spec.ts` → all 9 tests pass (the tightened REGION-01 detail asserts exactly 3 contributors on Chicken-Min).
- `npm run test` → 871 tests pass / 1 failure / 11 skipped / 2 todo. The 1 failure is a pre-existing gitignored-fixture issue (`tests/main/sampler-worker-girl.spec.ts`) already documented in `.planning/phases/29-.../deferred-items.md`; another file (`tests/core/sampler-skin-defined-unbound-attachment.spec.ts`) shows the same fixture-availability issue and is also already deferred.
- `npx tsc --noEmit` → 0 errors.

## Zero-Touch Evidence

```
$ git diff --stat src/renderer/src/lib/atlas-preview-view.ts src/core/atlas-preview.ts src/main/summary.ts src/renderer/src/components/AppShell.tsx
(empty — analyzer downstream consumers transparently inherit the deduped array)
```

The renderer mirror (`atlas-preview-view.ts`), core sibling (`atlas-preview.ts`), summary builder (`summary.ts`), and AppShell are all zero-touch. The lockstep mirror invariant (D-15) is preserved — both files keep their existing `region.contributingAttachments.map(...)` logic; the data they consume just becomes correct.

## Test Count Delta

- **`tests/core/analyzer.spec.ts`:** +2 it() blocks (37 → 39 in the file, with 41 total reported tests because of duplicated test names registered at suite level — 2 new dedup tests inside the `analyzeRegions` describe).
- **`tests/regression/path-indirection.spec.ts`:** unchanged at 9 it() blocks (one block tightened in-place, count preserved).
- **Cumulative phase-29 delta after Plans 29-05 + 29-06:** ~60 new tests across the phase (29-05 added the bulk; 29-06 adds 2 unit tests + 1 tightened assertion).

## Task Commits

Each task was committed atomically:

1. **Task 1 RED:** `4da8ecb` — `test(29-06): add failing analyzer tests locking WR-01 dedup contract`
2. **Task 1 GREEN:** `a5b5ee9` — `fix(29-06): dedup contributingAttachments by attachmentName in toRegionRow (WR-01)`
3. **Task 2:** `ac18577` — `test(29-06): tighten REGION-01 detail assertion (>= 2 → === 3) for WR-01 lock`

## Files Created/Modified

- `src/core/analyzer.ts` — `toRegionRow` gains a Set-based dedup filter on the lex-sorted bucket; existing `return { ... }` literal unchanged
- `tests/core/analyzer.spec.ts` — 2 new it() blocks added inside the `analyzeRegions` describe (after Test 6, before Layer 3 invariant); pre-existing Test 1 `square.contributingAttachments.length` assertion updated from 2 to 1 to reflect the new contract
- `tests/regression/path-indirection.spec.ts` — REGION-01 detail block tightened: `>=2` → `===3` + lex-sorted name array equality

## Decisions Made

- **Dedup at `toRegionRow`, not `dedupByRegionName`:** preserves bucket information for any future consumer that needs the full per-slot trail; the WR-01 contract is per-region UI surface only.
- **First-after-lex-sort pick rule:** matches REGION-05 lex-tiebreak semantics (already locked at the row-level winner pick); deterministic across Map iteration order.
- **Test 1 assertion update is unavoidable:** the plan's claim that "the dedup is a no-op in every existing test" was incorrect — SIMPLE_PROJECT's SQUARE attachment binds to TWO slots (SQUARE + SQUARE2) with the same attachmentName, which is exactly the WR-01 case. The new contract requires the assertion to be 1, not 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated SIMPLE_PROJECT analyzeRegions Test 1 to reflect new dedup contract**
- **Found during:** Task 1 GREEN phase (running `npx vitest run tests/core/analyzer.spec.ts` after the analyzer.ts fix).
- **Issue:** Plan stated "all 6 analyzeRegions tests still pass — the dedup is a no-op when bucket members have unique attachmentNames, which is the case in every existing test." This is false: SIMPLE_PROJECT's SQUARE attachment binds to two slots (SQUARE + SQUARE2) with the SAME attachmentName 'SQUARE', which is precisely the WR-01 case. After my fix, `square.contributingAttachments.length` drops from 2 to 1, breaking Test 1's pre-existing assertion `expect(square.contributingAttachments.length).toBe(2)`.
- **Fix:** Updated Test 1's assertion from `toBe(2)` to `toBe(1)` and rewrote the inline comments to reflect the new contract: `Phase 29 Plan 29-06 / WR-01 dedups contributingAttachments[] by attachmentName at the toRegionRow boundary, so the SQUARE region has ONE entry (slot fan-out collapses).` This aligns with the plan's `must_haves.truths`: "ONE entry for that attachmentName, not two".
- **Files modified:** `tests/core/analyzer.spec.ts` (Test 1 of analyzeRegions describe, lines 727-755 area)
- **Verification:** `npx vitest run tests/core/analyzer.spec.ts` → all 41 tests pass; `npx vitest run tests/regression/path-indirection.spec.ts` → all 9 tests pass.
- **Committed in:** `a5b5ee9` (Task 1 GREEN commit; the assertion update is part of the same fix because they are semantically inseparable — the analyzer.ts fix BREAKS the unmodified Test 1).

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue: existing test asserted the buggy pre-WR-01 behavior).

**Impact on plan:** No scope creep. The deviation was forced by the new dedup contract; the fix landed inside the same Task 1 GREEN commit so reviewers see the cause + effect together. The plan's claim about existing tests was an oversight; the SIMPLE_PROJECT SQUARE/SQUARE2 case is documented in the analyzeRegions Test 1 comments themselves: "SQUARE's attachmentName appears on TWO slots (SQUARE + SQUARE2)".

## Issues Encountered

- **Worktree path mismatch (recovered):** The first edit to `tests/core/analyzer.spec.ts` was unintentionally applied to the main-repo absolute path `/Users/leo/.../Spine_Texture_Manager/tests/core/...` instead of the worktree path `/Users/leo/.../Spine_Texture_Manager/.claude/worktrees/agent-a119e4d283507ee22/tests/core/...`. This was caught by `wc -l` showing 1025 lines on main vs 939 on worktree (and `grep -c "WR-01"` returning 0 on the worktree file). Reverted the main-repo edit via `git checkout -- tests/core/analyzer.spec.ts` from the main repo's pwd, then re-applied the Edit using the full worktree path. No commits were made on main; only the working-tree file was touched and reverted. The worktree edit landed cleanly afterward and showed up correctly in `git status` on the worktree branch.

## Hand-off Notes for `/gsd-verify-work 29` Re-verification

The verifier should confirm REGION-01 + REGION-02 closure end-to-end by reading:
1. The 2 new WR-01 it() blocks in `tests/core/analyzer.spec.ts` (post-Test 6, pre-Layer 3 invariant) — both assert the dedup contract directly.
2. The tightened REGION-01 detail block in `tests/regression/path-indirection.spec.ts:60-83` (post-tightening) — exact `===3` + lex-sorted name array equality on Chicken-Min.
3. The `must_haves.truths` block in `29-06-PLAN.md` — every clause maps directly to one of the 3 test surfaces above.
4. The Source-level Evidence section in this SUMMARY for the precise grep contracts.

Pre-29-06 the path-indirection regression suite would NOT have caught WR-01 (the `>= 2` + `toContain` assertions allowed 4 entries to pass); post-29-06 it catches both regression directions (slot-fan-out re-introduction AND over-aggressive collapse).

## Next Phase Readiness

- **Phase 29 close-out:** ALL 8 requirement IDs (REGION-01..07 + PREVIEW-01) verified end-to-end across plans 29-01..29-06. The path-indirection bug is fully closed at every layer:
  - **Analyzer dedup:** `RegionRow.contributingAttachments[]` deduped by attachmentName (Plan 29-06 / WR-01).
  - **Override Map keys:** keyed by `regionName ?? attachmentName` so a single override applies to every contributing attachment (Plans 29-01..29-04).
  - **Export math:** `buildExportPlan` + `applyOverride` consume the regionName-keyed override Map (Plans 29-02..29-04).
  - **Batch-apply UI handoff:** `selectedKeys` passed verbatim from GlobalMaxRenderPanel to AppShell (Plan 29-05 / CR-01).
  - **Contributor count display:** `(used by N attachments)` panel indicator + `used by N attachments` tooltip line both count unique attachmentNames (Plan 29-06 / WR-01 / REGION-01 + REGION-02).
- **No new blockers.** The 2 pre-existing fixture-availability failures (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/`) remain in `.planning/phases/29-.../deferred-items.md`.

## Self-Check: PASSED

Verified post-summary:
- `src/core/analyzer.ts` exists at expected path: FOUND (line 290 `new Set<string>()`)
- `tests/core/analyzer.spec.ts` exists at expected path: FOUND (2 hits on `WR-01 / Phase 29 Plan 29-06`)
- `tests/regression/path-indirection.spec.ts` exists at expected path: FOUND (line 73 `toBe(3)` + line 60 `Plan 29-06 / WR-01 lock`)
- Commit `4da8ecb` exists in `git log`: FOUND
- Commit `a5b5ee9` exists in `git log`: FOUND
- Commit `ac18577` exists in `git log`: FOUND

---
*Phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac*
*Completed: 2026-05-07*
