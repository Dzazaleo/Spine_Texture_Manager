---
phase: 35-region-keyed-export-plan
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/export.ts
autonomous: true
requirements: [DEDUP-04]
must_haves:
  truths:
    - "`buildExportPlan` in src/core/export.ts iterates `summary.regions` (RegionRow[]) instead of `summary.peaks`"
    - "Override resolution per region is still keyed by `regionName` (Phase 29 D-04 preserved)"
    - "For an N-region summary that shares K < N attachment names, `buildExportPlan` returns plan.rows + plan.passthroughCopies totaling N (not K)"
    - "Existing single-skin fixtures (SIMPLE_PROJECT, Rotated, atlas-less) produce identical export plans (no behavior change on non-indirected inputs)"
    - "`Acc.attachmentNames` is populated from `region.contributingAttachments[].attachmentName` (the per-region contributor list)"
  artifacts:
    - path: "src/core/export.ts"
      provides: "buildExportPlan iterating summary.regions"
      contains: "for (const region of summary.regions)"
  key_links:
    - from: "src/core/export.ts:buildExportPlan"
      to: "summary.regions (RegionRow[])"
      via: "for-of loop"
      pattern: "for\\s*\\(\\s*const\\s+region\\s+of\\s+summary\\.regions"
    - from: "src/core/export.ts:buildExportPlan"
      to: "overrides Map"
      via: "overrides.get(region.regionName ?? region.attachmentName)"
      pattern: "overrides\\.get\\(region\\.regionName"
---

<objective>
Migrate `src/core/export.ts:buildExportPlan` to iterate `summary.regions` (RegionRow[]) instead of `summary.peaks` (DisplayRow[]). The function body is otherwise structurally identical — same dedup-by-sourcePath, same override resolution by regionName, same canonical/cap/clamp math, same emit shape. This closes the multi-skin atlas-source undercount: 160 atlas regions that collapse to 23 attachment-name-deduped peaks now produce 160 ExportRows.

Purpose: Completes the Phase 29 "per-region dedup across all 4 surfaces" contract. The Optimize Assets modal header and the Atlas Preview optimized-mode tile expansion both feed transitively from buildExportPlan; once this function emits one row per region, both surfaces show 160 (the correct count for fixtures/SKINS/JOKERMAN_SPINE.json) instead of 23.

Output: Updated `src/core/export.ts` whose `buildExportPlan` loop variable is `region` of type RegionRow, iterating `summary.regions`. No new exports, no signature change, no IPC change.
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

# Existing test patterns to follow for the regression test in plan 04
@tests/core/export.spec.ts

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
</interfaces>
</context>

<tasks>

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
**Edit src/core/export.ts:buildExportPlan ONLY. Do NOT touch export-view.ts in this task — plan 02 mirrors this byte-identically.**

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
- DO NOT touch the `safeScale` helper or `relativeOutPath` helper. They are byte-identical in both files and have no dependency on the iteration source.
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
    - `npm test -- export.spec.ts` exits 0 (no existing assertion regresses; SIMPLE_PROJECT fixtures continue producing identical export plans because regionName === attachmentName and contributingAttachments.length === 1 for non-indirected fixtures, so the migration is observationally equivalent on those inputs)
    - `npm test -- atlas-preview.spec.ts` exits 0 (atlas-preview consumes buildExportPlan via export-view.ts; this task only touches the core copy, so the renderer-driven preview tests should still match — the parity test will fail until plan 02 lands, which is expected and documented in plan 02's acceptance criteria)
    - File compiles: `npx tsc --noEmit -p tsconfig.json` exits 0 (or the project's standard typecheck script; verify via `npm run` script list if tsc invocation differs)
  </acceptance_criteria>
  <done>
    src/core/export.ts:buildExportPlan iterates `summary.regions`; override key, dedup map, math chain, emit-loop, and conditional-spread emit shape are all preserved verbatim. existing export.spec.ts tests pass (single-skin fixtures unchanged); atlas-preview.spec.ts parity test deliberately fails until plan 02 lands.
  </done>
</task>

</tasks>

<verification>
After this task lands, plan 02 (renderer parity mirror) MUST land in the same wave before any release / commit-tag boundary. The parity test in tests/core/export.spec.ts:665+ guards the lockstep contract; running `npm test -- export.spec.ts` between plan 01 and plan 02 will fail on the parity describe block (expected — that failure is the wave 1 ordering signal).

Manual smoke (developer-only — not in CI; deferred to plan 03 acceptance):
- npm run dev → File > Open → fixtures/SKINS/JOKERMAN_SPINE.json → Optimize Assets button → modal header reads "Optimize Assets — 160 images" (or "— 160 images → {outDir}" if outDir was set in a prior run).
</verification>

<success_criteria>
- src/core/export.ts:buildExportPlan iterates summary.regions (verifiable by grep)
- All existing export.spec.ts assertions pass (single-skin fixtures unchanged)
- The Acc.attachmentNames accumulator is sourced from RegionRow.contributingAttachments[].attachmentName
- The override resolution path still reads `overrides.get(region.regionName ?? region.attachmentName)` — Phase 29 D-04 preserved
- Layer 3 hygiene preserved (no DOM, no node:* imports, no sharp, no electron, no spine-core runtime)
</success_criteria>

<output>
After completion, create `.planning/phases/35-region-keyed-export-plan/35-01-SUMMARY.md`
</output>
