---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/types.ts
  - src/core/types.ts
  - src/core/analyzer.ts
  - src/core/loader.ts
  - src/main/summary.ts
  - tests/core/analyzer.spec.ts
  - tests/core/summary.spec.ts
  - tests/core/ipc.spec.ts
  - tests/renderer/global-max-virtualization.spec.tsx
  - tests/renderer/anim-breakdown-virtualization.spec.tsx
autonomous: true
requirements: [DIMS-01, DIMS-04]
must_haves:
  truths:
    - "DisplayRow carries five new fields: canonicalW, canonicalH, actualSourceW, actualSourceH, dimsMismatch"
    - "ExportRow carries two NEW OPTIONAL fields: actualSourceW?, actualSourceH? (passthrough-only; undefined for non-drifted rows)"
    - "ExportPlan carries a passthroughCopies: ExportRow[] field parallel to excludedUnused"
    - "LoadResult carries canonicalDimsByRegion + actualDimsByRegion maps"
    - "loader.ts return literal carries empty-Map placeholders for canonicalDimsByRegion + actualDimsByRegion (Plan 22-02 replaces with populated walks)"
    - "All existing DisplayRow consumers compile-clean after additive cascade"
    - "analyze() and analyzeBreakdown() accept two new optional ReadonlyMap parameters"
    - "CLI byte-for-byte preservation: when canonical/actual maps absent, canonicalW=p.sourceW fallback, dimsMismatch=false"
  artifacts:
    - path: src/shared/types.ts
      contains: "canonicalW: number"
    - path: src/shared/types.ts
      contains: "passthroughCopies: ExportRow[]"
    - path: src/shared/types.ts
      contains: "actualSourceW?: number"
    - path: src/core/types.ts
      contains: "canonicalDimsByRegion"
    - path: src/core/loader.ts
      contains: "canonicalDimsByRegion: new Map()"
    - path: src/core/analyzer.ts
      contains: "dimsMismatch"
  key_links:
    - from: src/core/analyzer.ts
      to: DisplayRow.dimsMismatch
      via: "computed in toDisplayRow from |actualSourceW - canonicalW| > 1 OR |actualSourceH - canonicalH| > 1"
      pattern: "Math\\.abs.*-.*>\\s*1"
    - from: src/main/summary.ts
      to: src/core/analyzer.ts
      via: "threads load.canonicalDimsByRegion + load.actualDimsByRegion as new analyze() args"
      pattern: "analyze\\(.*canonicalDimsByRegion"
    - from: src/core/loader.ts return literal
      to: LoadResult.canonicalDimsByRegion + actualDimsByRegion
      via: "empty-Map placeholders so npx tsc --noEmit passes at end of 22-01; populated by Plan 22-02 Task 1 Step 4"
      pattern: "canonicalDimsByRegion:\\s*new Map\\(\\)"
---

<objective>
Type cascade — extend `DisplayRow` (shared/types.ts), `LoadResult` (core/types.ts), `ExportRow` + `ExportPlan` (shared/types.ts) with the new fields Phase 22 needs. Wire `canonicalW/H` + `actualSourceW/H` + `dimsMismatch` through the analyzer + summary plumbing. Add empty-Map placeholders to the `loader.ts` return literal so the typecheck gate at end of this plan passes (Plan 22-02 replaces them with populated walks). Audit and fix every existing DisplayRow / ExportPlan / ExportRow / LoadResult consumer (test fixtures, mocks, panels) for compile cleanliness.

Per D-01: JSON skin attachment width/height is the unified canonical dims source. The new `canonicalW/H` fields are populated from a parsedJson skin walk in 22-02; this plan only establishes the type contracts + analyzer wiring + empty-Map placeholders so 22-01's typecheck gate passes.

Per RESEARCH R1: TypeScript surfaces every literal-fixture consumer at compile-time. This plan's job is to spend Wave 1's first task on the type cascade alone — fix every consumer before the loader landing in 22-02.

Per RESEARCH R5 + Pattern §"CLI byte-for-byte preservation": when `canonicalDimsByRegion` is undefined or has no entry (CLI path; D-102 byte-for-byte lock), fall back to `canonicalW = p.sourceW`, `canonicalH = p.sourceH`, `actualSource* = undefined`, `dimsMismatch = false`. This preserves the existing CLI semantics where every row has canonical = source.

Per checker revision (2026-05-02): `actualSourceW?` + `actualSourceH?` are added as OPTIONAL fields on ExportRow so the OptimizeDialog passthrough render in 22-05 can label muted "already optimized" rows with the actual on-disk dims (e.g. 811×962) rather than canonical dims (e.g. 1628×1908). Optional because non-drifted rows have no actualSource — undefined is the default; matches DisplayRow optionality. Actual population of these ExportRow fields lands in Plan 22-03 Task 1 Step 5 (and mirrored in Plan 22-04 export-view.ts).

Purpose: All downstream plans (loader, export, panels, image-worker) read these types. Landing the contracts FIRST means TypeScript surfaces every consumer that needs adjustment in a single Wave-1 commit, not scattered across waves.

Output: Type-only changes + analyzer wiring + loader.ts empty-Map placeholders + every DisplayRow / LoadResult / ExportRow / ExportPlan consumer compile-clean. Vitest baseline still 630/630 passing.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-CONTEXT.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-VALIDATION.md

<interfaces>
<!-- Types being extended. Executor should use these as the contract. -->

DisplayRow extension (src/shared/types.ts:54-117) — APPEND after existing `atlasSource?:`:
```typescript
/**
 * Phase 22 DIMS-01 — Canonical region dims from JSON skin attachments.
 * Always populated for region/mesh attachments (every 4.2 JSON skin
 * attachment carries width/height per SkeletonJson.js:379-380, 410-411).
 * Source of truth for "what the rig was authored against" — NOT what's
 * on disk. CLI fallback (no canonical map): canonicalW = p.sourceW.
 */
canonicalW: number;
canonicalH: number;

/**
 * Phase 22 DIMS-01 — Actual on-disk PNG dims from IHDR byte parse
 * (Phase 21's readPngDims). Undefined when the per-region PNG is absent
 * (atlas-extract path on Jokerman-style atlas-only projects). When
 * present, dimsMismatch compares against canonicalW/H with 1px tolerance.
 */
actualSourceW: number | undefined;
actualSourceH: number | undefined;

/**
 * Phase 22 DIMS-01 — true when actualSource differs from canonical by
 * more than 1px on EITHER axis. Always false when actualSourceW/H are
 * undefined (atlas-extract path).
 */
dimsMismatch: boolean;
```

ExportRow extension (src/shared/types.ts ExportRow interface) — APPEND TWO OPTIONAL FIELDS after the existing fields:
```typescript
/**
 * Phase 22 DIMS-04 — actual on-disk PNG dims (only set on passthrough rows
 * where dimsMismatch is true and the cap binds). Mirrors DisplayRow.actualSource{W,H}.
 * Optional because non-drifted rows have no actualSource — undefined is the default.
 *
 * Consumed by OptimizeDialog (Plan 22-05 Task 2 Step 1) to label muted "already
 * optimized" rows with the actual on-disk dims (e.g. 811×962) rather than canonical
 * dims (e.g. 1628×1908). The dialog renders:
 *   {row.actualSourceW ?? row.sourceW}×{row.actualSourceH ?? row.sourceH}
 * The ?? fallback is defensive (covers the rare case where actualSourceW is
 * undefined despite being a passthrough row).
 *
 * Population happens in Plan 22-03 Task 1 Step 5 (buildExportPlan) and is
 * mirrored byte-identically in Plan 22-04 export-view.ts.
 */
actualSourceW?: number;
actualSourceH?: number;
```

ExportPlan extension (src/shared/types.ts:269-273) — APPEND `passthroughCopies` parallel to `excludedUnused`:
```typescript
export interface ExportPlan {
  rows: ExportRow[];
  excludedUnused: string[];
  /**
   * Phase 22 DIMS-04 — Rows where the export cap fired AND/OR peakScale
   * already at-or-below source ratio (D-04 REVISED generous formula:
   * isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)).
   * These rows produce zero net change if Lanczos'd; image-worker writes
   * them via fs.promises.copyFile (D-03 byte-copy). OptimizeDialog renders
   * them with muted treatment + "COPY" indicator.
   */
  passthroughCopies: ExportRow[];
  totals: { count: number };
}
```

LoadResult extension (src/core/types.ts:55-154) — APPEND two new map fields:
```typescript
/**
 * Phase 22 DIMS-01 — Per-region canonical dims from JSON skin attachments.
 * Always populated; empty Map for malformed JSON (defensive). CLI fallback
 * not needed here — analyzer reads via optional param.
 */
canonicalDimsByRegion: Map<string, { canonicalW: number; canonicalH: number }>;
/**
 * Phase 22 DIMS-01 — Per-region ACTUAL source PNG dims from PNG IHDR
 * reads. Populated only when the per-region PNG resolves on disk
 * (atlas-less mode AND canonical-atlas-with-images mode). Empty in
 * atlas-only mode (Jokerman-style projects with only atlas-page PNGs).
 */
actualDimsByRegion: Map<string, { actualSourceW: number; actualSourceH: number }>;
```

analyze() signature extension (src/core/analyzer.ts:177-181):
```typescript
export function analyze(
  peaks: Map<string, PeakRecord>,
  sourcePaths?: ReadonlyMap<string, string>,
  atlasSources?: ReadonlyMap<string, NonNullable<DisplayRow['atlasSource']>>,
  canonicalDims?: ReadonlyMap<string, { canonicalW: number; canonicalH: number }>,
  actualDims?: ReadonlyMap<string, { actualSourceW: number; actualSourceH: number }>,
): DisplayRow[];
```

analyzeBreakdown() — same two new optional params appended (mirror analyze() signature).

dimsMismatch predicate (computed in toDisplayRow at src/core/analyzer.ts:87):
```typescript
const dimsMismatch = actualSourceW !== undefined && actualSourceH !== undefined &&
  (Math.abs(actualSourceW - canonicalW) > 1 || Math.abs(actualSourceH - canonicalH) > 1);
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend DisplayRow + ExportRow + ExportPlan in src/shared/types.ts; extend LoadResult in src/core/types.ts; add empty-Map placeholders to loader.ts return literal; audit DisplayRow / ExportRow / ExportPlan literal consumers</name>
  <read_first>
    - src/shared/types.ts (lines 54-117 DisplayRow; ExportRow interface; lines 269-273 ExportPlan)
    - src/core/types.ts (lines 55-154 LoadResult; lines 134-153 skippedAttachments? optional-field precedent)
    - src/core/loader.ts (line 497 return literal — target for Step 4.5 placeholders)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/shared/types.ts + § src/core/types.ts)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-01 Implementation > DisplayRow shape; § R1 DisplayRow consumers)
    - tests/core/analyzer.spec.ts (consumer audit — find any DisplayRow literal fixtures)
    - tests/core/summary.spec.ts (consumer audit)
    - tests/core/ipc.spec.ts (consumer audit)
    - tests/core/export.spec.ts (lines 42-441 case-(a)-(f) baseline summaries — DEEP audit; many makeSummary helpers build peaks → DisplayRows)
    - tests/renderer/global-max-virtualization.spec.tsx (lines 89-114 makeRow helper)
    - tests/renderer/anim-breakdown-virtualization.spec.tsx (sibling makeRow helper)
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx (BreakdownRow extends DisplayRow at types.ts:135)
  </read_first>
  <behavior>
    - Test 1: TypeScript compiler reports zero errors on `npx tsc --noEmit -p tsconfig.json` after the type extension + consumer fixes.
    - Test 2: TypeScript compiler reports zero errors on `npx tsc --noEmit -p tsconfig.web.json` (renderer-side check).
    - Test 3: All existing 630 vitest tests still pass — no behavioral change yet, only additive type fields.
    - Test 4: Greppable verify — `grep -c "canonicalW" src/shared/types.ts` returns ≥ 1; `grep -c "passthroughCopies" src/shared/types.ts` returns ≥ 1; `grep -c "canonicalDimsByRegion" src/core/types.ts` returns ≥ 1; `grep -F 'canonicalDimsByRegion: new Map()' src/core/loader.ts` returns 1.
  </behavior>
  <action>
    Step 1: Run audit grep BEFORE editing:
    ```bash
    grep -rn "DisplayRow\b" src/ tests/ --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts" | grep -v "extends DisplayRow"
    ```
    Capture the full list of consumers — each one needs verification. Also run:
    ```bash
    grep -rn "as DisplayRow\|: DisplayRow\b\|DisplayRow\[\]\|DisplayRow =" src/ tests/ --include="*.ts" --include="*.tsx"
    ```
    to find every literal/cast site.

    Step 2: Edit src/shared/types.ts — APPEND to DisplayRow interface (after `atlasSource?:` line 117):
    - `canonicalW: number;` (always-required per CONTEXT discretion + RESEARCH §3)
    - `canonicalH: number;`
    - `actualSourceW: number | undefined;` (optional per atlas-extract semantics)
    - `actualSourceH: number | undefined;`
    - `dimsMismatch: boolean;` (always-required; default false when no actualSource)

    Use docblock pattern from `bytesOnDisk?` (Phase 19 UI-04 at lines 195-211): multi-paragraph commentary citing CONTEXT D-01 + ROADMAP DIMS-01 + the 1px tolerance rule. Match the exact prose in the `<interfaces>` block above.

    Step 3: Edit src/shared/types.ts ExportRow interface — APPEND TWO OPTIONAL FIELDS after the existing fields:
    ```typescript
    actualSourceW?: number;
    actualSourceH?: number;
    ```
    Use the docblock from the `<interfaces>` block above (cites D-04 REVISED + downstream OptimizeDialog consumer in 22-05). Optional because non-drifted rows have no actualSource — undefined is the default; matches DisplayRow optionality.

    Step 4: Edit src/shared/types.ts ExportPlan (lines 269-273) — APPEND `passthroughCopies: ExportRow[];` parallel to `excludedUnused: string[];`. Use the exact docblock from the `<interfaces>` block above (cites D-04 REVISED + D-03).

    Step 4.5 (CHECKER FIX 2026-05-02): Edit src/core/loader.ts. Locate the return statement of loadSkeleton() at line 497 and add empty-Map placeholders to the LoadResult literal:

    ```typescript
    return {
      skeletonPath: path.resolve(skeletonPath),
      atlasPath: resolvedAtlasPath,
      skeletonData,
      atlas: atlas!,
      sourceDims,
      sourcePaths,
      atlasSources,
      editorFps,
      // Phase 22 DIMS-01 — empty-Map placeholders so npx tsc --noEmit passes at
      // the END of Plan 22-01. Plan 22-02 Task 1 Step 4 replaces these with
      // populated walks (parsedJson skin attachment width/height for canonical;
      // PNG IHDR reads via Phase 21's readPngDims for actual). Empty Maps yield
      // the same fallback behavior as undefined when threaded through analyze()
      // (sourceRatio=Infinity; canonicalW=p.sourceW; dimsMismatch=false) — so
      // CLI byte-for-byte preservation (D-102) holds at this checkpoint too.
      canonicalDimsByRegion: new Map(),
      actualDimsByRegion: new Map(),
      ...(skippedAttachments !== undefined ? { skippedAttachments } : {}),
    };
    ```

    This step exists ONLY so the npx tsc --noEmit gate at the end of this task passes — Plan 22-02 Task 1 Step 4 will replace these empty-Map placeholders with the populated walks. Do NOT mistake this for the actual feature implementation.

    Step 5: Edit src/core/types.ts LoadResult — APPEND `canonicalDimsByRegion: Map<string, { canonicalW: number; canonicalH: number }>;` and `actualDimsByRegion: Map<string, { actualSourceW: number; actualSourceH: number }>;`. Use the docblock from `<interfaces>` block above. Both ALWAYS-required (empty Maps in CLI / atlas-only paths).

    Step 6 (DEEP AUDIT — CHECKER FIX 2026-05-02): Audit DisplayRow literal consumers EXHAUSTIVELY. Run:
    ```bash
    grep -rn "sourceW:" tests/ --include="*.ts" --include="*.tsx"
    grep -rn "peakScale:" tests/ --include="*.ts" --include="*.tsx"
    ```
    to find every PeakRecord-shape literal that flows into DisplayRow construction. Iterate the audit until `npx tsc --noEmit` shows zero new errors. Pay special attention to `makeSummary()` helpers and case-(a) through case-(f) baselines spanning **tests/core/export.spec.ts:42-441** — that file alone has hundreds of lines of PeakRecord/DisplayRow/SkeletonSummary literals; missed sites surface as TS errors and consume revision budget.

    Expected sites + fix shape (add to every literal):
    ```typescript
    canonicalW: <existing sourceW>,
    canonicalH: <existing sourceH>,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    ```

    Sites likely affected:
    - `tests/core/analyzer.spec.ts` — direct DisplayRow construction.
    - `tests/core/summary.spec.ts` — same.
    - `tests/core/ipc.spec.ts` — same.
    - `tests/core/export.spec.ts` (CRITICAL — case-(a)-(f) shape lines 42-441; many makeSummary helpers; iterate until tsc clean).
    - `tests/renderer/global-max-virtualization.spec.tsx` makeRow helper (lines 89-114) — add the new fields. Defaults: canonicalW=64, canonicalH=64, actualSourceW=undefined, actualSourceH=undefined, dimsMismatch=false.
    - `tests/renderer/anim-breakdown-virtualization.spec.tsx` — same makeRow helper update.
    - `src/main/summary.ts` — only if it constructs DisplayRow literals; otherwise rides the analyzer cascade.

    Step 7: Audit ExportPlan + ExportRow literal consumers. Grep:
    ```bash
    grep -rn "ExportPlan" tests/ src/ --include="*.ts" --include="*.tsx"
    grep -rn "ExportRow" tests/ src/ --include="*.ts" --include="*.tsx"
    ```
    For every ExportPlan literal that omits `passthroughCopies`, add `passthroughCopies: []`. Common sites: tests/core/export.spec.ts (case-(a)-(f) baseline summaries — same file as Step 6), tests/main/image-worker.spec.ts mocked plans, tests/main/image-worker.integration.spec.ts real plan.

    NOTE on the new ExportRow optional fields: `actualSourceW?` + `actualSourceH?` are OPTIONAL — existing literals do NOT need to be updated. The fields default to `undefined` for non-drifted rows. This is intentional: matches DisplayRow optionality and avoids touching every single ExportRow literal in the codebase.

    Step 8: Audit LoadResult literal consumers. Grep:
    ```bash
    grep -rn "LoadResult" tests/ src/ --include="*.ts"
    ```
    For mocks/literals (rare — most tests call loadSkeleton directly which now returns the empty-Map placeholders from Step 4.5), add `canonicalDimsByRegion: new Map(), actualDimsByRegion: new Map()` to any explicit LoadResult literal.

    Step 9: Run typecheck:
    ```bash
    npx tsc --noEmit -p tsconfig.json
    npx tsc --noEmit -p tsconfig.web.json
    ```
    Iterate until zero errors. Expect to discover additional sites in tests/core/export.spec.ts during this iteration — that's the CHECKER-flagged makeSummary chain. Then run `npm run test` to confirm 630/630 still pass.

    Per RESEARCH §R1: TypeScript surfaces every site at type-check. Do NOT use `any` or `as unknown as` casts to silence errors — fix the literal at the consumer site.

    Per Pattern §"Optional-field cascade-safety pattern": use `?:` modifier ONLY for actualSourceW/H on DisplayRow (atlas-extract semantics) AND for actualSourceW/H on ExportRow (passthrough-only semantics). canonicalW/canonicalH/dimsMismatch are always-required (every row has canonical from JSON; CLI fallback in analyzer populates them).
  </action>
  <verify>
    <automated>npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p tsconfig.web.json && npx vitest run --reporter=basic 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "canonicalW: number" src/shared/types.ts` returns ≥ 1
    - `grep -c "actualSourceW: number | undefined" src/shared/types.ts` returns ≥ 1 (DisplayRow site)
    - `grep -c "actualSourceW?: number" src/shared/types.ts` returns ≥ 1 (NEW — ExportRow site, optional)
    - `grep -c "dimsMismatch: boolean" src/shared/types.ts` returns ≥ 1
    - `grep -c "passthroughCopies: ExportRow\[\]" src/shared/types.ts` returns ≥ 1
    - `grep -c "canonicalDimsByRegion" src/core/types.ts` returns ≥ 1
    - `grep -c "actualDimsByRegion" src/core/types.ts` returns ≥ 1
    - `grep -F 'canonicalDimsByRegion: new Map()' src/core/loader.ts` returns 1 hit (CHECKER FIX — empty-Map placeholder for typecheck gate)
    - `grep -F 'actualDimsByRegion: new Map()' src/core/loader.ts` returns 1 hit (CHECKER FIX — empty-Map placeholder for typecheck gate)
    - `npx tsc --noEmit -p tsconfig.json` exits 0
    - `npx tsc --noEmit -p tsconfig.web.json` exits 0
    - `npx vitest run` shows 630 passing (or matches existing baseline) — no regressions
    - Zero `any` or `as unknown as` casts introduced (verify: `git diff --stat` + `git diff src/ tests/ | grep -c "as unknown as DisplayRow\|: any\b"` returns 0 in lines added by this task)
  </acceptance_criteria>
  <done>Five new DisplayRow fields, two new optional ExportRow fields (actualSourceW? + actualSourceH?), passthroughCopies on ExportPlan, two new Maps on LoadResult, empty-Map placeholders in loader.ts return literal; every literal consumer compile-clean (especially tests/core/export.spec.ts case-(a)-(f) makeSummary chain); full vitest suite passes at existing baseline.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire canonical/actual dim Maps through analyzer + summary; CLI fallback preserves D-102 byte-for-byte</name>
  <read_first>
    - src/core/analyzer.ts (lines 87-125 toDisplayRow; lines 177-189 analyze() signature; line 267-274 analyzeBreakdown signature)
    - src/main/summary.ts (line 74 analyze() invocation; lines 85-92 analyzeBreakdown invocation)
    - src/shared/types.ts (DisplayRow as just-extended in Task 1)
    - src/core/types.ts (LoadResult as just-extended in Task 1)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-01 > Analyzer + summary plumbing; § R5 mesh attachment fallback; § Architectural Responsibility Map row 3)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/core/analyzer.ts; § src/main/summary.ts; § "CLI byte-for-byte preservation (Phase 5 D-102)")
    - scripts/cli.ts (verify CLI path calls analyze() with no canonical/actual maps; fallback active)
    - tests/core/analyzer.spec.ts (extend with new tests + verify CLI fallback path)
  </read_first>
  <behavior>
    - Test 1: When canonicalDims map is provided AND has an entry for attachmentName, DisplayRow.canonicalW === map.get(name).canonicalW.
    - Test 2: When canonicalDims map is undefined OR has no entry, DisplayRow.canonicalW === p.sourceW (CLI fallback per D-102).
    - Test 3: When actualDims map is provided AND has an entry, DisplayRow.actualSourceW === map.get(name).actualSourceW; dimsMismatch computed correctly.
    - Test 4: When actualDims map has no entry for attachmentName, DisplayRow.actualSourceW === undefined; dimsMismatch === false.
    - Test 5: dimsMismatch === true when |actualSource - canonical| > 1 on EITHER axis (per ROADMAP DIMS-01 wording).
    - Test 6: dimsMismatch === false when |actualSource - canonical| ≤ 1 on BOTH axes (1px tolerance).
    - Test 7: CLI integration — running `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` produces byte-identical stdout vs git baseline (D-102 preserved).
  </behavior>
  <action>
    Step 1: Edit src/core/analyzer.ts — extend `toDisplayRow()` signature (line 87) with four new optional params:
    ```typescript
    function toDisplayRow(
      p: PeakRecord,
      sourcePath: string = '',
      atlasSource?: DisplayRow['atlasSource'],
      canonicalW: number = p.sourceW,        // CLI fallback per D-102
      canonicalH: number = p.sourceH,        // CLI fallback per D-102
      actualSourceW?: number,
      actualSourceH?: number,
    ): DisplayRow {
      const dimsMismatch = actualSourceW !== undefined && actualSourceH !== undefined &&
        (Math.abs(actualSourceW - canonicalW) > 1 || Math.abs(actualSourceH - canonicalH) > 1);
      return {
        // ... 19 existing fields ...
        sourcePath,
        canonicalW,
        canonicalH,
        actualSourceW,
        actualSourceH,
        dimsMismatch,
        ...(atlasSource ? { atlasSource } : {}),
      };
    }
    ```
    The 1px tolerance is locked by ROADMAP DIMS-01 ("more than 1px on either axis").

    Step 2: Extend `analyze()` signature (line 177) — append two new optional ReadonlyMap params:
    ```typescript
    export function analyze(
      peaks: Map<string, PeakRecord>,
      sourcePaths?: ReadonlyMap<string, string>,
      atlasSources?: ReadonlyMap<string, NonNullable<DisplayRow['atlasSource']>>,
      canonicalDims?: ReadonlyMap<string, { canonicalW: number; canonicalH: number }>,
      actualDims?: ReadonlyMap<string, { actualSourceW: number; actualSourceH: number }>,
    ): DisplayRow[] {
      const allRows = [...peaks.values()].map((p) => {
        const cd = canonicalDims?.get(p.attachmentName);
        const ad = actualDims?.get(p.attachmentName);
        return toDisplayRow(
          p,
          sourcePaths?.get(p.attachmentName) ?? '',
          atlasSources?.get(p.attachmentName),
          cd?.canonicalW,                   // undefined when no entry → toDisplayRow uses p.sourceW
          cd?.canonicalH,
          ad?.actualSourceW,
          ad?.actualSourceH,
        );
      });
      return dedupByAttachmentName(allRows).sort(byCliContract);
    }
    ```

    Step 3: Mirror the same extension on `analyzeBreakdown()` (line 267) — append two more optional ReadonlyMap params; thread through to its toDisplayRow-equivalent (analyze the existing function shape — it likely has a similar map step).

    Step 4: Edit src/main/summary.ts — thread the new maps through:
    ```typescript
    const peaksArrayRaw = analyze(
      sampled.globalPeaks,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,           // NEW per DIMS-01
      load.actualDimsByRegion,              // NEW per DIMS-01
    );

    const animationBreakdownRaw = analyzeBreakdown(
      sampled.perAnimation,
      sampled.setupPosePeaks,
      load.skeletonData,
      skeleton.slots,
      load.sourcePaths,
      load.atlasSources,
      load.canonicalDimsByRegion,           // NEW per DIMS-01
      load.actualDimsByRegion,              // NEW per DIMS-01
    );
    ```

    Step 5: Audit CLI path. `scripts/cli.ts:162` (per phase-12 commit) calls `analyze(sampled.globalPeaks)` with no maps. After this task, that call path:
    - Receives `canonicalDims = undefined`
    - In toDisplayRow: `canonicalW = cd?.canonicalW` → undefined → `canonicalW: number = p.sourceW` default kicks in → canonicalW === p.sourceW (CLI fallback active).
    - actualSourceW/H stay undefined → dimsMismatch === false.
    - CLI stdout unchanged (D-102 byte-for-byte preserved).

    NOTE: After Plan 22-01 Task 1 Step 4.5, loadSkeleton() now returns `canonicalDimsByRegion: new Map()` + `actualDimsByRegion: new Map()`. An empty Map flowing through analyze() yields the same fallback behavior as undefined (`map.get(name)` returns undefined either way). CLI byte-for-byte preserved at this checkpoint too.

    Step 6: Add CLI byte-for-byte test in tests/core/analyzer.spec.ts (or extend an existing CLI-shape test). Verify shape:
    ```typescript
    it('CLI fallback (D-102): analyze() with no canonical/actual maps yields canonicalW === sourceW + dimsMismatch:false', () => {
      const peaks = new Map<string, PeakRecord>([
        ['SQUARE', { attachmentName: 'SQUARE', sourceW: 1000, sourceH: 1000, peakScale: 1.0, /* ... */ } as PeakRecord],
      ]);
      const rows = analyze(peaks);
      expect(rows[0].canonicalW).toBe(1000);
      expect(rows[0].canonicalH).toBe(1000);
      expect(rows[0].actualSourceW).toBeUndefined();
      expect(rows[0].actualSourceH).toBeUndefined();
      expect(rows[0].dimsMismatch).toBe(false);
    });
    ```

    Step 7: Add dimsMismatch predicate tests in tests/core/analyzer.spec.ts:
    ```typescript
    describe('analyze — DIMS-01 dimsMismatch predicate (1px tolerance)', () => {
      it('dimsMismatch:true when actualSourceW differs from canonicalW by > 1px', () => {
        const peaks = new Map<string, PeakRecord>([['R', mockPeak('R', 1628, 1908)]]);
        const canonical = new Map([['R', { canonicalW: 1628, canonicalH: 1908 }]]);
        const actual = new Map([['R', { actualSourceW: 811, actualSourceH: 962 }]]);
        const rows = analyze(peaks, undefined, undefined, canonical, actual);
        expect(rows[0].dimsMismatch).toBe(true);
        expect(rows[0].canonicalW).toBe(1628);
        expect(rows[0].actualSourceW).toBe(811);
      });
      it('dimsMismatch:false when |actualSource - canonical| <= 1 on BOTH axes (1px tolerance)', () => {
        // canonical 1000×1000, actual 1000×1001 → tolerance not exceeded
        const canonical = new Map([['R', { canonicalW: 1000, canonicalH: 1000 }]]);
        const actual = new Map([['R', { actualSourceW: 1000, actualSourceH: 1001 }]]);
        const rows = analyze(peaks, undefined, undefined, canonical, actual);
        expect(rows[0].dimsMismatch).toBe(false);
      });
      it('dimsMismatch:false when actualSource undefined (atlas-extract path)', () => {
        const canonical = new Map([['R', { canonicalW: 1000, canonicalH: 1000 }]]);
        const rows = analyze(peaks, undefined, undefined, canonical, undefined);
        expect(rows[0].dimsMismatch).toBe(false);
        expect(rows[0].actualSourceW).toBeUndefined();
      });
    });
    ```

    Step 8: Run `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json > /tmp/cli-after.txt && git stash && npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json > /tmp/cli-before.txt && git stash pop && diff /tmp/cli-before.txt /tmp/cli-after.txt` to verify D-102 byte-for-byte preservation. Diff must be empty (or only the unrelated header/timestamp lines if the CLI emits any).

    Note: load.canonicalDimsByRegion + load.actualDimsByRegion are populated in plan 22-02. For this task, summary.ts just threads them through (the empty Maps from Plan 22-01 Step 4.5 flow through analyze() with the same fallback behavior as undefined).
  </action>
  <verify>
    <automated>npx vitest run tests/core/analyzer.spec.ts tests/core/summary.spec.ts -t "DIMS-01" 2>&1 | tail -15 && npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "canonicalDims" src/core/analyzer.ts` returns ≥ 2 hits (signature + body)
    - `grep -n "dimsMismatch" src/core/analyzer.ts` returns ≥ 1 (predicate site)
    - `grep -E "canonicalDimsByRegion|actualDimsByRegion" src/main/summary.ts` returns ≥ 2 hits (analyze + analyzeBreakdown calls)
    - `grep -c "Math.abs.*>\s*1" src/core/analyzer.ts` returns ≥ 1 (1px tolerance predicate)
    - vitest tests in tests/core/analyzer.spec.ts under `DIMS-01` describe block all pass
    - CLI byte-for-byte: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` produces output unchanged from git baseline (verified via stash + diff procedure in Step 8)
    - Full suite: `npm run test` passes at baseline + ≥ 4 new DIMS-01 unit tests
  </acceptance_criteria>
  <done>analyzer.ts threads canonical/actual maps + computes dimsMismatch with 1px tolerance; summary.ts wires the maps through; CLI byte-for-byte D-102 preserved; new DIMS-01 unit tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| compile-time vs runtime | Type contracts from this task gate runtime correctness in 22-02..05; a missed cascade site silently breaks downstream consumers |
| CLI vs IPC paths | CLI calls analyze() with no maps; IPC calls analyze() with maps from loadSkeleton; both paths must coexist without data corruption |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-22-01 | Tampering | DisplayRow consumer fixtures | mitigate | TypeScript compile gate (Step 9) catches every literal omission; zero `any` casts allowed (acceptance criterion); checker-flagged deep audit on tests/core/export.spec.ts case-(a)-(f) makeSummary chain |
| T-22-02 | Information disclosure | CLI byte-for-byte stdout | mitigate | Step 8 stash/diff gate proves no CLI regression; D-102 lock honored |
| T-22-03 | Denial of service | Memory growth from large `canonicalDimsByRegion` Maps | accept | Map keyed by region name (≤ ~1000 entries on largest known projects); negligible footprint |
| T-22-04 | Repudiation | dimsMismatch false-positive on rounding noise | mitigate | 1px tolerance from ROADMAP DIMS-01 + test coverage in Step 7 |
| T-22-05 | Tampering | loader.ts return literal missing canonicalDimsByRegion + actualDimsByRegion before Plan 22-02 lands | mitigate | Plan 22-01 Task 1 Step 4.5 adds empty-Map placeholders so npx tsc --noEmit passes at end of 22-01 (CHECKER FIX 2026-05-02) |
</threat_model>

<verification>
- TypeScript: `npx tsc --noEmit -p tsconfig.json` AND `npx tsc --noEmit -p tsconfig.web.json` both exit 0.
- Tests: `npm run test` shows baseline 630 + new DIMS-01 tests passing (~635 total).
- CLI parity: byte-for-byte stdout preserved on fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json.
- Greppable invariants: every contract field present in shared/types.ts and core/types.ts; predicate site present in analyzer.ts; empty-Map placeholders present in src/core/loader.ts.
- Zero `any` casts introduced (audit grep on diff).
</verification>

<success_criteria>
1. DisplayRow has canonicalW + canonicalH + actualSourceW + actualSourceH + dimsMismatch fields; ExportRow has actualSourceW? + actualSourceH? optional fields; ExportPlan has passthroughCopies; LoadResult has canonicalDimsByRegion + actualDimsByRegion. (DIMS-01 + DIMS-04 contract surface)
2. src/core/loader.ts return literal carries empty-Map placeholders for canonicalDimsByRegion + actualDimsByRegion (CHECKER FIX — 22-01 typecheck gate passes; 22-02 replaces with populated walks).
3. analyzer.ts populates dimsMismatch using the 1px-tolerance predicate; CLI fallback preserves canonicalW = p.sourceW when no map provided.
4. summary.ts threads load.canonicalDimsByRegion + load.actualDimsByRegion as new analyze()/analyzeBreakdown() args.
5. Every existing DisplayRow / ExportPlan / LoadResult literal consumer compiles cleanly with zero `any` workarounds — INCLUDING the checker-flagged tests/core/export.spec.ts case-(a)-(f) makeSummary chain.
6. CLI byte-for-byte stdout preserved on fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json (D-102).
7. Full vitest suite green (no regressions); ≥ 4 new DIMS-01 unit tests added.
</success_criteria>

<output>
After completion, create `.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-01-types-cascade-canonical-actual-SUMMARY.md`
</output>
