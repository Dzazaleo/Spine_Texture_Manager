---
phase: 35-region-keyed-export-plan
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/export.ts
  - tests/core/export.spec.ts
autonomous: true
requirements: [DEDUP-04]
must_haves:
  truths:
    - "`buildExportPlan` in src/core/export.ts iterates `summary.regions` (RegionRow[]) instead of `summary.peaks`"
    - "Override resolution per region is still keyed by `regionName` (Phase 29 D-04 preserved)"
    - "For an N-region summary that shares K < N attachment names, `buildExportPlan` returns plan.rows + plan.passthroughCopies totaling N (not K)"
    - "Existing single-skin fixtures (SIMPLE_PROJECT, Rotated, atlas-less) produce identical export plans (no behavior change on non-indirected inputs)"
    - "`Acc.attachmentNames` is populated from `region.contributingAttachments[].attachmentName` (the per-region contributor list)"
    - "Every existing synthetic-summary literal in tests/core/export.spec.ts carries a sibling `regions: RegionRow[]` field mirroring its `peaks: [...]` shape — so the migrated buildExportPlan can iterate `summary.regions` without `TypeError: Cannot read properties of undefined (reading 'Symbol.iterator')`"
  artifacts:
    - path: "src/core/export.ts"
      provides: "buildExportPlan iterating summary.regions"
      contains: "for (const region of summary.regions)"
    - path: "tests/core/export.spec.ts"
      provides: "Every `as unknown as SkeletonSummary` cast now constructs `regions: RegionRow[]` alongside `peaks: [...]` (BLOCKER 1 backfill)"
      contains: "regions:"
  key_links:
    - from: "src/core/export.ts:buildExportPlan"
      to: "summary.regions (RegionRow[])"
      via: "for-of loop"
      pattern: "for\\s*\\(\\s*const\\s+region\\s+of\\s+summary\\.regions"
    - from: "src/core/export.ts:buildExportPlan"
      to: "overrides Map"
      via: "overrides.get(region.regionName ?? region.attachmentName)"
      pattern: "overrides\\.get\\(region\\.regionName"
    - from: "tests/core/export.spec.ts (every synthetic summary literal)"
      to: "src/core/export.ts:buildExportPlan iteration source"
      via: "regions: RegionRow[] field mirrored from peaks: [...]"
      pattern: "regions:\\s*\\["
---

<objective>
Migrate `src/core/export.ts:buildExportPlan` to iterate `summary.regions` (RegionRow[]) instead of `summary.peaks` (DisplayRow[]) AND in the SAME commit backfill the `regions: RegionRow[]` field into every synthetic-summary literal in tests/core/export.spec.ts. The function body of buildExportPlan is otherwise structurally identical — same dedup-by-sourcePath, same override resolution by regionName, same canonical/cap/clamp math, same emit shape. This closes the multi-skin atlas-source undercount: 160 atlas regions that collapse to 23 attachment-name-deduped peaks now produce 160 ExportRows.

Purpose: Completes the Phase 29 "per-region dedup across all 4 surfaces" contract. The Optimize Assets modal header and the Atlas Preview optimized-mode tile expansion both feed transitively from buildExportPlan; once this function emits one row per region, both surfaces show 160 (the correct count for fixtures/SKINS/JOKERMAN_SPINE.json) instead of 23.

**Why the test-file backfill ships atomically with the source change (BLOCKER 1 from plan-checker review):** tests/core/export.spec.ts has 36 synthetic-summary literals shaped `{ peaks: [...], orphanedFiles: [] } as unknown as SkeletonSummary` — zero of them populate `regions`. After the iteration-source swap in step 2 below, `for (const region of summary.regions)` throws `TypeError: Cannot read properties of undefined (reading 'Symbol.iterator')` on every existing test. Truth #4 ("Existing single-skin fixtures … produce identical export plans") is unfalsifiable without the backfill. The backfill is therefore Task 0 of this plan (runs BEFORE the source migration in Task 1) and lands in the same commit boundary.

Output:
- Updated `src/core/export.ts` whose `buildExportPlan` loop variable is `region` of type RegionRow, iterating `summary.regions`. No new exports, no signature change, no IPC change.
- Updated `tests/core/export.spec.ts` whose every synthetic-summary literal now carries a `regions: RegionRow[]` array mirroring the `peaks: [...]` shape (per-`sourcePath` aggregation, `contributingAttachments` reflecting the multi-contributor sibling fold for line 2107-2196's shared-sourcePath case, and the `loadSummary`-style real-fixture cases at lines 49+, 85+, 458+, 755+, 1077+ using `analyzeRegions` to populate regions identically to the atlas-preview spec helper at tests/core/atlas-preview.spec.ts:56-77).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/debug/skins-optimize-undercount.md
@CLAUDE.md

# Both parity copies — executor MUST read both before touching either.
@src/core/export.ts
@src/renderer/src/lib/export-view.ts

# RegionRow shape + analyzeRegions producer
@src/shared/types.ts
@src/core/analyzer.ts

# THE test file that must be backfilled in lockstep + the canonical helper template
@tests/core/export.spec.ts
@tests/core/atlas-preview.spec.ts

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->
<!-- Executor uses these directly — no codebase exploration needed beyond the read_first list. -->

From src/shared/types.ts (line 216):
```typescript
export interface RegionRow {
  regionName: string;                        // Primary key — one row per unique regionName
  attachmentName: string;                    // Winning contributor's attachmentName (REGION-05 lex tiebreak)
  skinName: string;
  slotName: string;
  animationName: string;
  time: number;
  frame: number;
  peakScale: number;
  peakScaleX: number;
  peakScaleY: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  isSetupPosePeak: boolean;
  sourcePath: string;
  canonicalW: number;
  canonicalH: number;
  actualSourceW: number | undefined;
  actualSourceH: number | undefined;
  dimsMismatch: boolean;
  isMissing?: boolean;
  atlasSource?: { pagePath: string; x: number; y: number; packW: number; packH: number; offsetX: number; offsetY: number; w: number; h: number; rotated: boolean; };
  originalSizeLabel: string;
  peakSizeLabel: string;
  scaleLabel: string;
  sourceLabel: string;
  frameLabel: string;
  contributingAttachments: Array<{
    attachmentName: string;
    skinName: string;
    slotName: string;
    peakScale: number;
    animationName: string;
    time: number;
    frame: number;
    isSetupPosePeak: boolean;
  }>;
  isSequenceFrame?: boolean;
}
```

From src/shared/types.ts (line 787):
```typescript
// SkeletonSummary.regions: RegionRow[] — populated by analyzeRegions(),
// region-keyed dedup. One entry per unique regionName. Phase 29 D-01.
regions: RegionRow[];
```

**Key observation:** RegionRow carries every field buildExportPlan reads off the
current DisplayRow loop variable (peakScale, sourceW/H, canonicalW/H,
actualSourceW/H, dimsMismatch, sourcePath, atlasSource, attachmentName). The ONE
field that changes is the per-row contributors list: instead of appending
`row.attachmentName` to `acc.attachmentNames` (which would only ever add the
winning contributor for the iterated region), populate `acc.attachmentNames`
from `region.contributingAttachments.map(c => c.attachmentName)` so the
ExportRow's attachmentNames[] field carries the full per-region contributor set
(matches Phase 29 D-02 / D-03 contract used by atlas-preview-view.ts).

**Per-sourcePath dedup is still required:** two different regions can resolve
to the SAME sourcePath when the loader returns a shared physical PNG path for
two regionNames (rare in atlas-source — different regionNames typically map to
distinct sourcePaths — but the second-stage dedup must remain in place as
defense-in-depth and to preserve the keep-max-effScale contract). The dedup
key is `region.sourcePath`, identical to the current `row.sourcePath`.

**Canonical test-side helper (BLOCKER 1 backfill template) — from tests/core/atlas-preview.spec.ts:56-77:**
```typescript
function loadSummary(jsonPath: string): SkeletonSummary {
  const load = loadSkeleton(jsonPath);
  const sampled = sampleSkeleton(load);
  const peaks = analyze(sampled.globalPeaks);
  const peaksWithPath = peaks.map((r) => ({
    ...r,
    sourcePath: '/fake/' + (r.regionName ?? r.attachmentName) + '.png',
  }));
  const sourcePaths = new Map<string, string>();
  for (const p of sampled.globalPeaks.values()) {
    const regionName = p.regionName ?? p.attachmentName;
    sourcePaths.set(regionName, '/fake/' + regionName + '.png');
  }
  const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
  return { peaks: peaksWithPath, regions, orphanedFiles: [] } as unknown as SkeletonSummary;
}
```
This helper is the canonical pattern. The export.spec.ts already has 5 `loadSummary`-style
real-fixture helpers (cases (a), (b), (e/f), the `loadSkeleton` block at line 458,
and the case-around-line-1077 helper); these MUST be updated to also populate `regions`
via `analyzeRegions(...)` exactly like atlas-preview.spec.ts does. The 30+ inline
hand-built synthetic-summary literals MUST get a hand-built `regions: RegionRow[]`
array (see Task 0 step 2 below for the exact construction rule).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 0: Backfill `regions: RegionRow[]` into every synthetic-summary literal in tests/core/export.spec.ts (BLOCKER 1 fix — lands in the SAME commit as Task 1's source migration)</name>
  <files>tests/core/export.spec.ts</files>
  <read_first>
    - tests/core/export.spec.ts (read in full — every `as unknown as SkeletonSummary` cast on lines 49, 85, 116-136, 151-171, 189-209, 224-244, 262-299, 314-351, 370-402, 421-441, 458-463, 486-506, 523-543, 562-582, 755-760, 780-800, 866-891, 906-931, 1007-1030, 1044-1069, 1077-1082, 1181-1226, 1260-1305, 1356-1381, 1387-1412, 1537-1609, 1624-1693, 1711-1736, 1779-1804, 1822-1847, 1942-1967, 1979-2004, 2015-{later}, 2107-2196, 2210-2236, 2256-{later} must be touched; `grep -n "as unknown as SkeletonSummary" tests/core/export.spec.ts` enumerates the full set — 36 occurrences as of the plan-checker baseline)
    - tests/core/atlas-preview.spec.ts lines 56-77 (the canonical `loadSummary` helper template — use this EXACTLY for the 5 real-fixture call-sites in export.spec.ts)
    - src/shared/types.ts lines 216-293 (RegionRow interface — confirms which fields a synthetic RegionRow needs to carry)
    - src/core/analyzer.ts:398 (analyzeRegions signature: `(peaks, sourcePaths?, atlasSources?, canonicalDims?, actualDims?) => RegionRow[]`)
  </read_first>
  <action>
**This task RUNS BEFORE Task 1's source migration. The backfill plus the source migration land in the same commit. The commit boundary is enforced by this plan's `files_modified` frontmatter listing BOTH files.**

The synthetic summaries in tests/core/export.spec.ts fall into two categories — handle each according to its own rule:



**Category A — Real-fixture-driven summaries** (5 sites): lines ~49-55, ~85-91, ~458-463 (and the matching block near 755), ~1077-1082. These call `loadSkeleton(...) → sampleSkeleton(...) → analyze(sampled.globalPeaks)` and then synthesize `peaks: peaks.map((r) => ({ ...r, sourcePath: '/fake/' + r.attachmentName + '.png' }))`. They have NO `regions` field today.

**Backfill rule for Category A — mirror the atlas-preview.spec.ts loadSummary helper at lines 56-77 exactly:**

For EACH such site, after computing `peaks`, ALSO compute:
```typescript
const sourcePaths = new Map<string, string>();
for (const p of sampled.globalPeaks.values()) {
  const regionName = p.regionName ?? p.attachmentName;
  sourcePaths.set(regionName, '/fake/' + regionName + '.png');
}
const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
```

Add `analyze` AND `analyzeRegions` to the import line at the top of the file:
```typescript
import { analyze, analyzeRegions } from '../../src/core/analyzer.js';
```
(`analyze` is already imported; just add `analyzeRegions` to the same import list. Verify with `grep -n "from '../../src/core/analyzer.js'" tests/core/export.spec.ts` before editing.)

Then update each summary literal to include `regions`:
```typescript
const summary: Pick<SkeletonSummary, 'peaks' | 'regions' | 'orphanedFiles'> = {
  peaks: peaks.map((r) => ({ ...r, sourcePath: '/fake/' + r.attachmentName + '.png' })),
  regions,
  orphanedFiles: [],
};
```
For the `Pick<>` cases (lines 49, 85), widen the Pick to include `'regions'`. For the `as unknown as SkeletonSummary` cases at lines 458, 755, 1077, the cast already allows extra fields — just add `regions` to the object literal.

**Important — synthesized sourcePath consistency:** the test currently uses `'/fake/' + r.attachmentName + '.png'` for peaks; the atlas-preview helper uses `'/fake/' + regionName + '.png'` for both. For SIMPLE_PROJECT (regionName === attachmentName), the two strings are identical, so the test outcomes don't change. Use `'/fake/' + (r.regionName ?? r.attachmentName) + '.png'` for the `peaks.map` AND `sourcePaths.set` calls in Category A backfills to lock the equivalence on non-SIMPLE_PROJECT fixtures (defensive — currently zero non-SIMPLE_PROJECT real-fixture sites in export.spec.ts, but future-proofing).



**Category B — Hand-built synthetic summaries** (31 sites): every `peaks: [{ attachmentName: '...', regionName: '...', sourcePath: '...', peakScale: ..., sourceW: ..., sourceH: ..., canonicalW: ..., canonicalH: ..., ... }, ...]` literal. These are constructed inline, sometimes with one peak, sometimes with multiple (e.g. the path-indirected case at lines 2107-2196 has three contributors sharing one sourcePath).

**Backfill rule for Category B — construct a parallel `regions: RegionRow[]` array via deterministic aggregation of the `peaks` literal:**

For each synthetic-summary literal:

1. **Group `peaks` entries by `regionName` (falling back to `attachmentName` when `regionName` is absent — same fallback the loader uses).** Each group becomes ONE RegionRow.
2. **Within each group, pick the winning contributor** by Phase 29 D-01's max-peakScale rule (lexicographic regionName tiebreak doesn't apply here because all rows in a single group already share regionName). When multiple entries have the same max peakScale, pick the one that comes first in source order (deterministic test behavior).
3. **Construct the RegionRow** with these fields from the winning entry:
   - `regionName`: from the winning peak's `regionName ?? attachmentName`
   - `attachmentName`: from the winning peak's `attachmentName`
   - `skinName`, `slotName`, `animationName`, `time`, `frame`: from the winning peak (defaults to `'default'`, `'TEST_SLOT'`, `'PATH'`, `0`, `0` if unset)
   - `peakScale`, `peakScaleX`, `peakScaleY`: from the winning peak
   - `worldW`, `worldH`: from the winning peak
   - `sourceW`, `sourceH`: from the winning peak
   - `canonicalW`, `canonicalH`: from the winning peak (FALLBACK: `sourceW`/`sourceH` if not set — the buildExportPlan reads `region.canonicalW ?? region.sourceW`, so a missing `canonicalW` is tolerated, but populate it explicitly to match Phase 22 DIMS-01)
   - `actualSourceW`, `actualSourceH`: from the winning peak (default `undefined`)
   - `dimsMismatch`: from the winning peak (default `false`)
   - `sourcePath`: from the winning peak (groups within a synthetic summary CAN share sourcePath — see line 2107-2196 below — but each RegionRow carries the shared path; this is the data shape buildExportPlan expects)
   - `atlasSource`: from the winning peak (default omit; the field is optional)
   - `isSetupPosePeak`: from the winning peak (default `false`)
   - Preformatted label fields (`originalSizeLabel`, `peakSizeLabel`, `scaleLabel`, `sourceLabel`, `frameLabel`): set to `''` (buildExportPlan doesn't read them; an empty string is fine for type satisfaction)
   - `contributingAttachments`: an array of ALL members of the group, each shaped:
     ```typescript
     {
       attachmentName: p.attachmentName,
       skinName: p.skinName ?? 'default',
       slotName: p.slotName ?? 'TEST_SLOT',
       peakScale: p.peakScale,
       animationName: p.animationName ?? 'PATH',
       time: p.time ?? 0,
       frame: p.frame ?? 0,
       isSetupPosePeak: false,
     }
     ```

4. **For type satisfaction**, cast the `regions` array via `regions: [...] as unknown as RegionRow[]` if the test doesn't import RegionRow — but PREFER importing the type cleanly:
   ```typescript
   import type { ExportPlan, RegionRow, SkeletonSummary } from '../../src/shared/types.js';
   ```
   The import at line 35 already pulls in ExportPlan + SkeletonSummary; add RegionRow to that import. Verify the import covers all summary literals via grep after the edit.



**Specific high-fan-out site — the path-indirected case at lines 2107-2196 (BLOCKER 1 evidence):**

This case has THREE peaks all sharing `sourcePath: '/fake/images/5/7.png'` and `regionName: '5/7'` with distinct attachmentNames: `'5/5/5/7/7'`, `'5/5/7/7'`, `'5/7'`.

Construct ONE RegionRow for this case:
```typescript
const sharedRegion: RegionRow = {
  regionName: '5/7',
  attachmentName: '5/7',  // winning contributor (lex tiebreak among '5/5/5/7/7', '5/5/7/7', '5/7' → '5/7' wins on lex sort)
  skinName: 'default',
  slotName: 'SLOT3',     // matches the winning peak's slotName
  animationName: 'PATH',
  time: 0.5,
  frame: 30,
  peakScale: 1.0,
  peakScaleX: 1.0,
  peakScaleY: 1.0,
  worldW: canonicalW,
  worldH: canonicalH,
  sourceW: canonicalW,
  sourceH: canonicalH,
  canonicalW,
  canonicalH,
  actualSourceW: undefined,
  actualSourceH: undefined,
  dimsMismatch: false,
  sourcePath: sharedSourcePath,
  isSetupPosePeak: false,
  originalSizeLabel: '',
  peakSizeLabel: '',
  scaleLabel: '',
  sourceLabel: '',
  frameLabel: '',
  contributingAttachments: [
    { attachmentName: '5/5/5/7/7', skinName: 'default', slotName: 'SLOT1', peakScale: 1.0, animationName: 'PATH', time: 0.5, frame: 30, isSetupPosePeak: false },
    { attachmentName: '5/5/7/7',   skinName: 'default', slotName: 'SLOT2', peakScale: 1.0, animationName: 'PATH', time: 0.5, frame: 30, isSetupPosePeak: false },
    { attachmentName: '5/7',       skinName: 'default', slotName: 'SLOT3', peakScale: 1.0, animationName: 'PATH', time: 0.5, frame: 30, isSetupPosePeak: false },
  ],
};
const summary = {
  peaks: [...],  // unchanged
  regions: [sharedRegion],
  orphanedFiles: [],
} as unknown as SkeletonSummary;
```

The Test 5 assertion at line 2195 (`expect(row.attachmentNames.sort()).toEqual(['5/5/5/7/7', '5/5/7/7', '5/7'])`) MUST continue to pass post-backfill — the new buildExportPlan reads `region.contributingAttachments.map(c => c.attachmentName)` and the contributor list above contains exactly those three names.



**Pitfalls to avoid:**

- DO NOT delete or modify the existing `peaks: [...]` literals. Just ADD a `regions: [...]` field alongside. Pre-Phase-35 buildExportPlan reads peaks; post-Phase-35 reads regions; both fields coexist on SkeletonSummary (peaks is still used by other consumers like the Global panel renderer).
- DO NOT skip the path-indirected case at line 2107. Test 5's assertion only passes when the multi-contributor `contributingAttachments` array is built correctly.
- DO NOT change any existing assertions in the file. Only add the `regions` field to each summary literal. The expected outcome of every existing test is unchanged — Category B's hand-built summaries produce 1 region per unique regionName, the same cardinality as their peaks (because each synthetic literal either has one peak or shares the regionName across all peaks). Category A's real-fixture summaries already have regions.length === peaks.length on SIMPLE_PROJECT.
- DO NOT import from `src/main/*` or `node:fs` in this file beyond what's already imported. The existing `readFileSync` + `path` imports are tolerable; adding `analyzeRegions` from `src/core/analyzer.js` is the only new import.
- DO NOT update the Test 5b case at line 2198+ with multi-contributor regions — that test only has a SINGLE peak entry, so its `regions` array has length 1 with `contributingAttachments.length === 1`. Match the actual shape of the test's peaks data.

**Verification approach for this task (manual self-check, beyond the grep gates below):**

After the edit, run `npm test -- export.spec.ts` BEFORE Task 1 runs. The file should still compile (no TypeScript errors) and all existing tests should still PASS — because pre-Phase-35 buildExportPlan reads `summary.peaks`, not `summary.regions`. The new `regions` field is dormant data until Task 1 swaps the iteration source. This intermediate-state pass is the proof that Task 0 is non-destructive.
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      [ "$(grep -c 'regions:' tests/core/export.spec.ts)" -ge 30 ] &&
      grep -c "analyzeRegions" tests/core/export.spec.ts &&
      grep -c "contributingAttachments" tests/core/export.spec.ts &&
      npm test -- export.spec.ts 2>&1 | tail -20
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "regions:" tests/core/export.spec.ts` returns at least 30 (every synthetic-summary literal gained a `regions` field; some lines may match `regions: regions` shorthand for Category A — both count)
    - `grep -c "analyzeRegions" tests/core/export.spec.ts` returns at least 1 (Category A sites use the analyzer helper)
    - `grep -c "contributingAttachments" tests/core/export.spec.ts` returns at least 1 (Category B synthetic RegionRows carry contributor arrays)
    - `grep -c "as unknown as SkeletonSummary" tests/core/export.spec.ts` is unchanged from baseline (the casts remain; we only added a field inside the object literal)
    - The path-indirected Test 5 case at lines 2107-2196 has its `regions` array constructed with `contributingAttachments` containing all three of `['5/5/5/7/7', '5/5/7/7', '5/7']` — verify via `grep -A 30 "Test 5 — path-indirected" tests/core/export.spec.ts | grep -c "5/5/5/7/7"` ≥ 1
    - `npm test -- export.spec.ts` exits 0 (the backfill is dormant data — pre-Phase-35 buildExportPlan still reads `summary.peaks` and all assertions pass; this is the intermediate-state safety check)
    - No existing `peaks: [...]` literal is modified — verify via `git diff tests/core/export.spec.ts | grep '^-' | grep -v '^---' | grep -v "^- *}" | wc -l` is small (only minor reformatting like trailing-comma additions; no peak-data line deletions)
  </acceptance_criteria>
  <done>
    Every synthetic-summary literal in tests/core/export.spec.ts now carries a `regions: RegionRow[]` array mirroring its `peaks: [...]` shape. The path-indirected Test 5 case carries a 3-contributor `contributingAttachments` array. The pre-Phase-35 test suite still passes (the new `regions` field is dormant until Task 1 swaps the iteration source).
  </done>
</task>

<task type="auto">
  <name>Task 1: Migrate `buildExportPlan` to iterate `summary.regions` in src/core/export.ts</name>
  <files>src/core/export.ts</files>
  <read_first>
    - src/core/export.ts (read in full — the entire `buildExportPlan` function body must be understood before editing; the Acc interface, the dedup, the cap math, the emit-loop passthrough partition are all interlocked)
    - src/renderer/src/lib/export-view.ts (READ THIS TOO — it is the byte-identical parity sibling; understanding the parity contract is mandatory because plan 02 mirrors this exact change there)
    - src/shared/types.ts lines 216-293 (RegionRow definition) and line 787 (`regions: RegionRow[]` field on SkeletonSummary)
    - src/core/analyzer.ts (the `analyzeRegions` function that produces summary.regions; confirm RegionRow.contributingAttachments[].attachmentName is the per-region contributor list)
    - .planning/debug/skins-optimize-undercount.md (root-cause analysis — read the Resolution section verbatim; the fix described there IS this task)
  </read_first>
  <action>
**Edit src/core/export.ts:buildExportPlan ONLY. Do NOT touch export-view.ts in this task — plan 02 mirrors this byte-identically. Task 0 above has already backfilled tests/core/export.spec.ts so existing tests have a `regions` field on every synthetic summary — without Task 0, the verify command below throws `TypeError: Cannot read properties of undefined (reading 'Symbol.iterator')` on every existing test.**

Concrete transformation:

1. **Update the `Acc` interface type for `row`** (currently `DisplayRow`):
   - Change `row: DisplayRow;` to `row: RegionRow;`.
   - Add the `RegionRow` type to the type-only import line at the top of the file:
     ```typescript
     import type {
       DisplayRow,   // keep — referenced elsewhere if applicable; remove only if no longer used
       ExportPlan,
       ExportRow,
       RegionRow,    // ADD
       SkeletonSummary,
     } from '../shared/types.js';
     ```
     After the edit, run a grep to confirm whether `DisplayRow` is still referenced anywhere in the file. If not, drop it from the import. If still referenced (e.g. in a comment-cited type or another helper), keep it. Do not introduce an unused-import lint warning.

   **INFO 1 (docblock cleanup):** The file has a docblock at approximately line 117 that reads `Derive the relative output path from a DisplayRow's sourcePath`. Update it to `Derive the relative output path from a RegionRow's sourcePath`. After this edit, run `grep -c "DisplayRow" src/core/export.ts` — if the count is 0, drop `DisplayRow` from the type-only import (it becomes unused). If non-zero (other reference remains), leave it imported.

2. **Replace the iteration source** (current line 183):
   - Change: `for (const row of summary.peaks) {`
   - To:     `for (const region of summary.regions) {`
   - Rename ALL uses of `row` to `region` INSIDE the for-loop body (the variable name change is mechanical; the field reads stay the same because RegionRow carries every field DisplayRow had that this function uses).

3. **Update the excluded-check guard** (current line 184):
   - Currently: `if (excluded.has(row.attachmentName)) continue;`
   - The `excluded` set is always empty in this function today (Phase 24 Plan 01 documented this — `unusedAttachments` was removed from SkeletonSummary and the set is `new Set<string>()`). Two valid translations:
     - **(preferred — narrow change)** Keep the guard structurally similar: `if (excluded.has(region.attachmentName)) continue;` — uses the winning contributor's name. Functionally identical (excluded is empty) and preserves the docblock about Phase 24 Plan 02 wiring an exclusion surface in the future.
     - DO NOT widen this to check `region.contributingAttachments[].attachmentName` — that would be a semantic change Phase 35 does not authorize. Phase 24 Plan 02 (the future exclusion-surface wiring) is out of scope.

4. **Override key — preserve Phase 29 D-04 exactly** (current line 206):
   - Currently: `const overrideKey = row.regionName ?? row.attachmentName;`
   - After:     `const overrideKey = region.regionName ?? region.attachmentName;`
   - Behavior unchanged: RegionRow.regionName is ALWAYS defined (it's the primary key), so the `??` fallback never fires for real region inputs. The fallback is preserved for parity with the renderer copy and for synthetic test fixtures that may construct RegionRow-shaped objects with undefined regionName (defensive).

5. **Update `acc.attachmentNames` population — THIS IS THE ONE SEMANTIC CHANGE** (current lines 282 + 291-293):
   - Currently when inserting a new Acc:
     ```typescript
     attachmentNames: [row.attachmentName],
     ```
   - Change to:
     ```typescript
     attachmentNames: region.contributingAttachments.map((c) => c.attachmentName),
     ```
   - Currently when merging into an existing Acc (the `prev` branch, lines 291-293):
     ```typescript
     if (!prev.attachmentNames.includes(row.attachmentName)) {
       prev.attachmentNames.push(row.attachmentName);
     }
     ```
   - Change to:
     ```typescript
     for (const c of region.contributingAttachments) {
       if (!prev.attachmentNames.includes(c.attachmentName)) {
         prev.attachmentNames.push(c.attachmentName);
       }
     }
     ```
   - **Rationale:** Each RegionRow already aggregates all contributing attachments for its region (Phase 29 D-02). Two RegionRows sharing one sourcePath (rare but possible) merge their contributor sets via the existing `prev` branch. Single-skin fixtures where regionName === attachmentName and contributingAttachments.length === 1 produce identical attachmentNames[] arrays before and after this change — the regression assertion in plan 04 locks that property.

6. **All other lines in the loop body** (override resolution, applyOverride, bufferPct, safeScale clamp, sourceRatio cap, isCapped/bufferCapped flags, prev-vs-new branch, effScale keep-max comparison) **remain byte-identical** with `row` renamed to `region`. Verify by walking lines 183-294 of the current file and confirming every field read on `row` is a field that ALSO exists on RegionRow (it is — see the `<interfaces>` block in the plan context).

7. **The emit loop (lines 322-378) is unchanged.** It iterates `bySourcePath.values()` and reads `acc.row.*` — RegionRow has all the fields it needs (canonicalW, canonicalH, sourceW, sourceH, actualSourceW, actualSourceH, sourcePath, atlasSource). The conditional spreads for `atlasSource`, `actualSourceW/H` passthrough propagation, `isCapped`, `bufferCapped` ALL remain identical.

8. **Update inline comments inside the loop** to reflect the new iteration source:
   - The big Phase 29 D-04 comment block (lines ~186-205) currently says "Phase 29 D-04 — overrides Map keyed by regionName ... the for-loop over summary.peaks reads ...". Update the sentence "the for-loop over summary.peaks reads" to "the for-loop over summary.regions reads" — small clarification so future readers don't get confused.
   - Add a one-line top-of-loop comment: `// Phase 35 — iterate summary.regions (RegionRow[]) so per-region dedup is preserved end-to-end. summary.peaks is attachment-name-deduped and would collapse N skin-namespaced regions sharing one base name to one row.`
   - DO NOT add a verbose docblock at the file top. The existing docblock's references to `summary.peaks` (lines 11, 12) should be updated to `summary.regions` (two edits, same line; preserves the historical doc tone).

**Pitfalls to avoid:**

- DO NOT change the function signature. `buildExportPlan(summary: SkeletonSummary, overrides: ReadonlyMap<string, number>, opts?: BuildExportPlanOptions): ExportPlan` is unchanged; only the body is touched.
- DO NOT remove the per-sourcePath dedup. Even when 160 regions map 1-to-1 to 160 distinct sourcePaths (the SKINS fixture case), the dedup runs but is degenerate — each sourcePath is seen exactly once. The map's keep-max semantics still apply for the rare case of two regions sharing one sourcePath.
- DO NOT touch the `safeScale` helper or `relativeOutPath` helper. They are byte-identical in both files and have no dependency on the iteration source. (BUT — INFO 1 — the helper's docblock at ~line 117 changes from "DisplayRow's sourcePath" to "RegionRow's sourcePath"; that comment update is allowed.)
- DO NOT touch the `excluded` set. It stays `new Set<string>()` until Phase 24 Plan 02 (a different phase) wires it.
- DO NOT introduce a DOM, node:fs, node:path, sharp, electron, or @esotericsoftware/spine-core import. The Layer 3 hygiene test at tests/core/export.spec.ts:624-642 enforces this; any new import will break the hygiene block.
- DO NOT change the order of operations. The math chain is locked by Phase 30 CONTEXT D-09: rawEffScale → bufferedScale → safeScale → ≤ 1.0 clamp → sourceRatio cap → keep-max. The iteration source change is orthogonal to this chain.
  </action>
  <verify>
    <automated>
      cd /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager &&
      grep -c "for (const region of summary.regions)" src/core/export.ts &&
      ! grep -E "for \(const (row|peak) of summary\.peaks\)" src/core/export.ts &&
      npm test -- export.spec.ts 2>&1 | tail -30
    </automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "for (const region of summary.regions)" src/core/export.ts` returns at least 1 (the loop was migrated)
    - `grep -E "for \(const (row|peak) of summary\.peaks\)" src/core/export.ts` returns 0 matches (no old iteration source remains inside buildExportPlan)
    - `grep -c "region.contributingAttachments" src/core/export.ts` returns at least 1 (the attachmentNames accumulator is sourced from the per-region contributors)
    - `grep -c "RegionRow" src/core/export.ts` returns at least 1 (the type-only import was added)
    - `grep -c "overrides.get(region.regionName ?? region.attachmentName)" src/core/export.ts` returns 1 (override key preserved per Phase 29 D-04; identical shape, only the variable name changed)
    - `grep -c "const bySourcePath = new Map" src/core/export.ts` returns 1 (per-sourcePath dedup map still present — defense-in-depth dedup preserved)
    - `grep -E "node:fs|node:path|node:child_process|from ['\"]sharp['\"]|from ['\"]electron['\"]|@esotericsoftware/spine-core" src/core/export.ts` returns 0 matches (Layer 3 hygiene preserved)
    - `grep -c "DisplayRow's sourcePath" src/core/export.ts` returns 0 (INFO 1 docblock update landed — the docblock at ~line 117 now reads `RegionRow's sourcePath`)
    - `npm test -- export.spec.ts` exits 0 (no existing assertion regresses; Task 0 backfilled `regions` so existing single-skin synthetic summaries continue producing identical export plans — regionName === attachmentName and contributingAttachments.length === 1 for those fixtures, so the migration is observationally equivalent on those inputs)
    - `npm test -- atlas-preview.spec.ts` exits 0 (atlas-preview consumes buildExportPlan via export-view.ts; this task only touches the core copy, so the renderer-driven preview tests should still match — the parity test will fail until plan 02 lands, which is expected and documented in plan 02's acceptance criteria)
    - File compiles: `npx tsc --noEmit -p tsconfig.json` exits 0 (or the project's standard typecheck script; verify via `npm run` script list if tsc invocation differs)
  </acceptance_criteria>
  <done>
    src/core/export.ts:buildExportPlan iterates `summary.regions`; override key, dedup map, math chain, emit-loop, and conditional-spread emit shape are all preserved verbatim. Existing export.spec.ts tests pass (single-skin fixtures unchanged, courtesy of Task 0's regions backfill); atlas-preview.spec.ts parity test deliberately fails until plan 02 lands.
  </done>
</task>

</tasks>

<verification>
After both tasks land in the same commit, plan 02 (renderer parity mirror) MUST land before any release / commit-tag boundary. The parity test in tests/core/export.spec.ts:665+ guards the lockstep contract; running `npm test -- export.spec.ts` between this plan and plan 02 will fail on the parity describe block (expected — that failure is the wave 1 ordering signal).

Manual smoke (developer-only — not in CI; deferred to plan 03 acceptance):
- npm run dev → File > Open → fixtures/SKINS/JOKERMAN_SPINE.json → Optimize Assets button → modal header reads "Optimize Assets — 160 images" (or "— 160 images → {outDir}" if outDir was set in a prior run).
</verification>

<success_criteria>
- Task 0: every synthetic-summary literal in tests/core/export.spec.ts carries a `regions: RegionRow[]` field (verifiable by grep + by all existing tests passing in pre-migration state)
- Task 1: src/core/export.ts:buildExportPlan iterates summary.regions (verifiable by grep)
- All existing export.spec.ts assertions pass (single-skin fixtures unchanged)
- The Acc.attachmentNames accumulator is sourced from RegionRow.contributingAttachments[].attachmentName
- The override resolution path still reads `overrides.get(region.regionName ?? region.attachmentName)` — Phase 29 D-04 preserved
- Layer 3 hygiene preserved (no DOM, no node:* imports, no sharp, no electron, no spine-core runtime)
- INFO 1: helper docblock updated from `DisplayRow's sourcePath` → `RegionRow's sourcePath`; `DisplayRow` dropped from imports if no longer referenced
</success_criteria>

<output>
After completion, create `.planning/phases/35-region-keyed-export-plan/35-01-SUMMARY.md`
</output>
</content>
</invoke>