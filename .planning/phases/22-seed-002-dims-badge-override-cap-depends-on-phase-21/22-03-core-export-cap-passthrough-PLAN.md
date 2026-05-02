---
phase: 22-seed-002-dims-badge-override-cap-depends-on-phase-21
plan: 03
type: execute
wave: 2
depends_on: [01]
files_modified:
  - src/core/export.ts
  - tests/core/export.spec.ts
autonomous: true
requirements: [DIMS-03, DIMS-04]
must_haves:
  truths:
    - "buildExportPlan computes sourceLimit = min(actualSourceW/canonicalW, actualSourceH/canonicalH) when dimsMismatch && actualSource defined; Infinity otherwise"
    - "cappedEffScale = min(downscaleClampedScale, sourceLimit) — uniform single multiplier (NEVER per-axis)"
    - "isCapped = cappedEffScale < downscaleClampedScale (the cap binds — output IS actualSource by construction)"
    - "peakAlreadyAtOrBelowSource = downscaleClampedScale ≤ sourceLimit (user already over-reduced past peakScale)"
    - "isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource) — D-04 REVISED generous formula"
    - "Aspect ratio invariant: cap is single multiplier from min(...) over both axes; ceil(actualSourceW × cappedEffScale) === actualSourceW AND ceil(actualSourceH × cappedEffScale) === actualSourceH hold trivially when isCapped"
    - "Passthrough rows partition into plan.passthroughCopies[]; non-passthrough rows stay in plan.rows[]"
    - "Passthrough ExportRow entries carry row.actualSourceW + row.actualSourceH (mirrored from DisplayRow) for OptimizeDialog 'already optimized' label rendering in 22-05"
    - "totals.count = rows.length + passthroughCopies.length"
    - "Override % stays % of canonical JSON dims (D-02); cap clamps transparently when override pushes effScale above sourceRatio"
  artifacts:
    - path: src/core/export.ts
      contains: "sourceLimit"
    - path: src/core/export.ts
      contains: "passthroughCopies"
    - path: src/core/export.ts
      contains: "actualSourceW"
    - path: tests/core/export.spec.ts
      contains: "DIMS-03"
    - path: tests/core/export.spec.ts
      contains: "DIMS-04"
  key_links:
    - from: src/core/export.ts buildExportPlan
    - from: cap formula
      to: actualSourceW / canonicalW
      via: "Math.min over both axes; only when dimsMismatch && actualSource defined"
      pattern: "Math\\.min\\([^)]*actualSourceW\\s*\\/\\s*canonicalW"
    - from: passthrough partition
      to: dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)
      via: "predicate gate before push to passthroughCopies vs rows"
      pattern: "isCapped\\s*\\|\\|\\s*peakAlreadyAtOrBelowSource"
    - from: ExportRow.actualSourceW (passthrough rows)
      to: DisplayRow.actualSourceW
      via: "spread from acc.row when constructing passthrough ExportRow"
      pattern: "actualSourceW:\\s*acc\\.row\\.actualSourceW"
---

<objective>
Extend `buildExportPlan` in `src/core/export.ts` with the D-03 cap formula + D-04 REVISED passthrough partition. Add a `passthroughCopies: ExportRow[]` array to the returned `ExportPlan`. Tests in `tests/core/export.spec.ts` cover DIMS-03 cap math (uniform single multiplier; aspect ratio preserved) + DIMS-04 passthrough partition (generous threshold per D-04 REVISED).

**D-04 REVISED (2026-05-02 post-research)** — generous passthrough formula. Read this carefully — it OVERRIDES the original strict-ceil-equality wording:

```typescript
// Per D-04 REVISED:
const sourceRatio = actualSourceW !== undefined && actualSourceH !== undefined
  ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)  // uniform — pick more constraining axis (aspect ratio respected)
  : Infinity;

const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);  // existing Phase 6 Round 1 clamp
const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);

const isCapped = downscaleClampedScale > sourceRatio;                 // cap binds — output equals actualSource by construction
const peakAlreadyAtOrBelowSource = downscaleClampedScale <= sourceRatio;  // user over-reduced past peakScale

// isPassthrough = ANY drifted row where Optimize would NOT produce a strictly smaller image than what's on disk
const isPassthrough = row.dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource);
```

**Aspect ratio invariant (locked memory `project_phase6_default_scaling.md`):** cap is uniform — single multiplier from `min(...)` over both axes. Per-axis caps are FORBIDDEN; they distort aspect ratio and break Spine UV sampling.

**Override % interaction (D-02):** override stays "% of canonical JSON dims". When the user's override pushes effScale above sourceRatio on a drifted row, the cap clamps transparently — the row falls into passthroughCopies. Override is honored as best-effort but never extrapolates beyond actualSource (correctness > fidelity to override input).

**Test guards:** assert `Math.ceil(actualSourceW × cappedEffScale) === actualSourceW` AND `Math.ceil(actualSourceH × cappedEffScale) === actualSourceH` — these hold TRIVIALLY when `isCapped` is true (cappedEffScale === sourceRatio = actualSourceW/canonicalW means ceil(canonicalW × that) = ceil(actualSourceW) = actualSourceW; similarly Y). They're redundant guards proving the cap formula is correct, NOT the threshold itself.

**Output dim shortcut (math-equivalent):** because `cappedEffScale === sourceRatio` when `isCapped`, `Math.ceil(canonicalW × cappedEffScale) === actualSourceW` BY CONSTRUCTION. Use the legacy `outW = Math.ceil(canonicalW * cappedEffScale)` shape — it produces actualSource at the binding-cap edge automatically. No branch needed.

**Passthrough actualSource propagation (CHECKER FIX 2026-05-02):** When constructing the ExportRow for a passthrough row, populate `actualSourceW + actualSourceH` from `acc.row.actualSourceW + acc.row.actualSourceH` (the new optional ExportRow fields landed in Plan 22-01 Task 1 Step 3). OptimizeDialog (Plan 22-05 Task 2 Step 1) consumes these fields to render the "already optimized" label with concrete on-disk dims (e.g. 811×962) instead of canonical dims (e.g. 1628×1908). Mirrored byte-identically in Plan 22-04 export-view.ts. Non-passthrough rows skip the spread (fields stay undefined; matches the "passthrough-only semantics" docblock).

Per RESEARCH §"Final cap formula (recommended for §5)": clean implementation just inserts cap step + partition predicate; ExportRow shape stays single-form (no `kind` discriminator on the row itself — passthroughCopies and rows are partitioned into two arrays per D-03).

Per CONTEXT.md `<scope_reduction_prohibition>`: this plan delivers D-04 REVISED generous passthrough, NOT a "v1 strict-ceil-equality" — D-04 was REVISED 2026-05-02 to fix the binding-cap edge case bug. Read 22-CONTEXT.md §"D-04 (REVISED 2026-05-02 post-research)" for the full story.

Purpose: This is the correctness core of Phase 22. The cap is the round-trip safety guarantee (DIMS-03); the passthrough partition is the round-trip safety check (DIMS-04 + DIMS-05 enabler). The byte-identical renderer mirror lands in 22-04.

Output: buildExportPlan emits ExportPlan with cap'd effective scales + passthroughCopies partition + actualSource propagation for passthrough rows. Vitest covers both axes of the cap, the aspect-ratio invariant, the D-04 REVISED generous threshold, the override-cap interaction, and the actualSource propagation invariant.
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
@.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-01-types-cascade-canonical-actual-SUMMARY.md

<interfaces>
<!-- Reusable helper (Phase 4 D-91 + Phase 6 Round 5) -->
From src/core/export.ts:
```typescript
export function safeScale(s: number): number {
  return Math.ceil(s * 1000) / 1000;  // ceil-thousandth single source of truth
}

// Existing buildExportPlan signature (lines 137-232):
export function buildExportPlan(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
): ExportPlan;
```

<!-- Existing applyOverride (Phase 4 D-91) -->
From src/core/overrides.ts:
```typescript
export function applyOverride(percent: number): { effectiveScale: number };
// percent → effectiveScale = percent / 100; clamped 0..1
```

<!-- DisplayRow fields used in this plan (added in 22-01) -->
row.canonicalW: number;
row.canonicalH: number;
row.actualSourceW: number | undefined;
row.actualSourceH: number | undefined;
row.dimsMismatch: boolean;
row.sourceW / row.sourceH: existing canonical-mode fields (post-Phase-21, sourceW/H ARE canonical when JSON skin walk populates).

<!-- ExportRow optional fields (added in 22-01 Task 1 Step 3) -->
ExportRow.actualSourceW?: number;     // populated on passthrough rows only
ExportRow.actualSourceH?: number;     // populated on passthrough rows only
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Insert D-03 cap formula + D-04 REVISED passthrough partition into buildExportPlan; emit plan.passthroughCopies; propagate actualSourceW/H onto passthrough ExportRow entries</name>
  <read_first>
    - src/core/export.ts (entire file — focus on lines 117-135 safeScale + ceil math; line 140 safeScale helper; lines 137-232 buildExportPlan)
    - src/core/overrides.ts (applyOverride contract; verify 0..100 semantics for override clamping)
    - src/shared/types.ts (DisplayRow + ExportRow + ExportPlan as extended in Plan 22-01 — confirm actualSourceW? + actualSourceH? present on ExportRow)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-CONTEXT.md (§ Decisions > D-04 REVISED — read the full revised wording carefully; § specifics > "Cap is uniform, not per-axis")
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-RESEARCH.md (§ DIMS-03 + DIMS-04 Implementation > Cap formula in buildExportPlan; § Item #3 RESOLVED > the cap formula derivation; § R6 D-04 strict-ceil-equality formula ambiguity — RESOLVED via D-04 REVISED in CONTEXT)
    - .planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-PATTERNS.md (§ src/core/export.ts > Existing accumulator + group loop, Existing emit-rows pattern, Apply to: partition into rows[]+passthroughCopies[])
    - tests/core/export.spec.ts (lines 42-441 — case (a)-(f) shape; lines 595-666 parity describe block — DO NOT touch in this task; that's 22-04's scope)
  </read_first>
  <behavior>
    - Test 1 (DIMS-03 cap fires): drifted row with peakScale=0.7, canonical=1628×1908, actualSource=811×962 → sourceRatio=min(811/1628, 962/1908)≈0.498 → cappedEffScale=0.498 (cap binds). assert plan.passthroughCopies[0].outW===811 (NOT 1140), outH===962. (Sourced from RESEARCH §Item #3 worked example.)
    - Test 2 (DIMS-03 cap does NOT fire when no drift): non-drifted row with dimsMismatch:false, canonical===actual → sourceLimit=Infinity, cappedEffScale=downscaleClampedScale (unchanged). assert plan.rows[0].effectiveScale matches legacy Phase 6 baseline.
    - Test 3 (aspect ratio invariant): drifted row where actualW/canonicalW=0.5 BUT actualH/canonicalH=0.6 → sourceLimit=min(0.5, 0.6)=0.5 (the more constraining X axis); assert outW===actualSourceW exactly AND outH ≤ actualSourceH (capped uniformly, NOT per-axis).
    - Test 4 (D-04 REVISED generous — isCapped branch): drifted row with peakScale > sourceRatio → isPassthrough=true → row.outPath in plan.passthroughCopies, NOT in plan.rows.
    - Test 5 (D-04 REVISED generous — peakAlreadyAtOrBelowSource branch): drifted row with peakScale < sourceRatio (user already heavily over-reduced past peakScale) → isPassthrough=true → row in passthroughCopies. CRITICAL: this is the branch that catches DIMS-05 (already-optimized images where the next Optimize would still produce strictly smaller output without the cap, but where user's actual on-disk PNG is already at-or-below what we'd produce).
    - Test 6 (D-04 ceil-equality redundant guard): when isCapped is true, assert `Math.ceil(actualSourceW * cappedEffScale) === actualSourceW` AND same for H — both hold trivially per D-04 REVISED test guard.
    - Test 7 (D-02 override interaction — cap clamps transparently): set override=100% on a drifted row (canonical=1628×1908, actual=811×962); raw effScale would be 1.0; cap fires (1.0 > 0.498); assert row in passthroughCopies AND outW===811, outH===962 (override honored as best-effort, never extrapolates beyond actualSource per D-02).
    - Test 8 (atlas-extract path no cap): non-drifted row with actualSourceW===undefined → sourceLimit=Infinity → cappedEffScale=downscaleClampedScale → row in plan.rows (NOT passthrough).
    - Test 9 (totals.count): plan.totals.count === plan.rows.length + plan.passthroughCopies.length.
    - Test 10 (deterministic ordering): plan.passthroughCopies sorted by sourcePath localeCompare; plan.rows sorted by sourcePath localeCompare.
    - Test 11 (CHECKER FIX — actualSource propagation): on a passthrough row, plan.passthroughCopies[0].actualSourceW === row.actualSourceW (e.g. 811) AND plan.passthroughCopies[0].actualSourceH === row.actualSourceH (e.g. 962); on a non-passthrough row, plan.rows[0].actualSourceW === undefined.
  </behavior>
  <action>
    Step 1: Edit src/core/export.ts buildExportPlan() (lines 137-232). Insert the cap step between the existing `safeScale + Math.min(..., 1)` clamp at line 176 and the dedup-keep-max at line 184.

    Step 2: Modify the Acc interface to carry isPassthrough (replaces the older isCapped-only design from RESEARCH; reflects D-04 REVISED):

    ```typescript
    interface Acc {
      row: DisplayRow;
      effScale: number;
      isPassthrough: boolean;     // Phase 22 D-04 REVISED — generous: isCapped || peakAlreadyAtOrBelowSource
      attachmentNames: string[];
    }
    ```

    Step 3: Inside the per-row loop body, replace the existing single-line `effScale = Math.min(safeScale(rawEffScale), 1);` with the cap step:

    ```typescript
    const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);

    // Phase 22 DIMS-03 cap — uniform multiplier from min(actualSource/canonical) on
    // both axes when dimsMismatch && actualSource defined. Locked memory
    // project_phase6_default_scaling.md: cap is single uniform multiplier from min(...) ,
    // NEVER per-axis. Honors "never extrapolate" by ALSO bounding effectiveScale below
    // actual source dims (Phase 6 Round 1 only bounded by canonical; Phase 22 extends
    // the same invariant to actualSource).
    const sourceRatio = (row.dimsMismatch && row.actualSourceW !== undefined && row.actualSourceH !== undefined)
      ? Math.min(row.actualSourceW / row.canonicalW, row.actualSourceH / row.canonicalH)
      : Infinity;
    const cappedEffScale = Math.min(downscaleClampedScale, sourceRatio);

    // Phase 22 D-04 REVISED — generous passthrough formula:
    //   isCapped = cap binds (downscaleClampedScale > sourceRatio); output IS actualSource
    //   peakAlreadyAtOrBelowSource = user already at or below source ratio (no further
    //     reduction warranted)
    //   isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)
    // Original strict-ceil-equality wording was mathematically wrong at the cap-binding
    // boundary; revised by user 2026-05-02 post-research to the generous formulation.
    const isCapped = downscaleClampedScale > sourceRatio;
    const peakAlreadyAtOrBelowSource = downscaleClampedScale <= sourceRatio && row.actualSourceW !== undefined;
    const isPassthrough = row.dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource);
    ```

    Step 4: Replace the existing accumulator update with:

    ```typescript
    const prev = bySourcePath.get(row.sourcePath);
    if (prev === undefined) {
      bySourcePath.set(row.sourcePath, {
        row,
        effScale: cappedEffScale,
        isPassthrough,
        attachmentNames: [row.attachmentName],
      });
    } else {
      if (cappedEffScale > prev.effScale) {
        prev.row = row;
        prev.effScale = cappedEffScale;
        prev.isPassthrough = isPassthrough;
      }
      if (!prev.attachmentNames.includes(row.attachmentName)) {
        prev.attachmentNames.push(row.attachmentName);
      }
    }
    ```

    Note: dedup-keep-max compares cappedEffScale (NOT raw); the row that wins is the one that demands the most after cap. If two attachments share a sourcePath and one is passthrough but the other isn't, the dedup picks the higher-effScale one — which by construction is NOT passthrough (if either had higher demand than sourceRatio, the cap would have trimmed it down). This preserves the existing dedup contract.

    Step 5: Replace the emit-rows loop (lines 205-220) with partitioning into rows[] + passthroughCopies[]. **CHECKER FIX 2026-05-02 — propagate actualSourceW/H onto passthrough ExportRow entries:**

    ```typescript
    const rows: ExportRow[] = [];
    const passthroughCopies: ExportRow[] = [];
    for (const acc of bySourcePath.values()) {
      // Phase 22 DIMS-03 — output dims when capped equal actualSource by construction
      // (cappedEffScale = sourceRatio = actualSourceW/canonicalW means
      // Math.ceil(canonicalW × that) === actualSourceW). The legacy formula
      // Math.ceil(sourceW × effScale) handles BOTH the binding-cap case AND the
      // non-binding-cap case correctly — no branch needed.
      const outW = Math.ceil(acc.row.sourceW * acc.effScale);
      const outH = Math.ceil(acc.row.sourceH * acc.effScale);

      const exportRow: ExportRow = {
        sourcePath: acc.row.sourcePath,
        outPath: relativeOutPath(acc.row.sourcePath),
        sourceW: acc.row.sourceW,
        sourceH: acc.row.sourceH,
        outW,
        outH,
        effectiveScale: acc.effScale,
        attachmentNames: acc.attachmentNames.slice(),
        ...(acc.row.atlasSource ? { atlasSource: acc.row.atlasSource } : {}),
        // Phase 22 DIMS-04 (CHECKER FIX 2026-05-02) — propagate actualSourceW/H onto
        // passthrough rows so OptimizeDialog (Plan 22-05 Task 2 Step 1) can render the
        // "already optimized" label with concrete on-disk dims (e.g. 811×962) instead
        // of canonical dims (e.g. 1628×1908). Non-passthrough rows skip the spread —
        // fields stay undefined, matching the "passthrough-only semantics" docblock
        // on the optional ExportRow fields. The conditional spread mirrors the
        // existing atlasSource pattern above.
        ...(acc.isPassthrough && acc.row.actualSourceW !== undefined && acc.row.actualSourceH !== undefined
          ? { actualSourceW: acc.row.actualSourceW, actualSourceH: acc.row.actualSourceH }
          : {}),
      };

      if (acc.isPassthrough) passthroughCopies.push(exportRow);
      else rows.push(exportRow);
    }

    rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
    passthroughCopies.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
    const excludedUnused = [...excluded].sort((a, b) => a.localeCompare(b));

    return {
      rows,
      excludedUnused,
      passthroughCopies,
      totals: { count: rows.length + passthroughCopies.length },
    };
    ```

    Note: `acc.row.sourceW` is the canonical width per Phase 21 contract (sourceW post-Phase-21 IS canonical when JSON skin walk populates). For Phase 22, `acc.row.sourceW === acc.row.canonicalW` on canonical-atlas + atlas-less paths. The legacy `Math.ceil(sourceW * effScale)` formula at the cap-binding edge yields actualSource by construction (proven in RESEARCH §Item #3 derivation).

    The `actualSourceW`/`actualSourceH` spread is GUARDED by `acc.isPassthrough && actualSourceW !== undefined && actualSourceH !== undefined` — the second clause is defensive (a passthrough row by definition has actualSource defined since `isPassthrough = dimsMismatch && (...)` and dimsMismatch requires both actualSource fields to be defined). Plan 22-04 export-view.ts will mirror this exact spread byte-identically.

    Step 6: Add new test cases to tests/core/export.spec.ts. Append a new describe block near the existing case-(a)-(f) shape:

    ```typescript
    describe('buildExportPlan — DIMS-03 cap formula + DIMS-04 passthrough partition (Phase 22)', () => {
      // Helper: build a summary with one drifted row, no overrides
      function makeDriftedSummary(canonicalW: number, canonicalH: number, actualW: number, actualH: number, peakScale: number): SkeletonSummary {
        // Adapt to existing makeSummary helper shape from case-(a)-(f)
        // Each peak row needs canonicalW, canonicalH, actualSourceW, actualSourceH, dimsMismatch fields
        // dimsMismatch computed via |actualW - canonicalW| > 1 || |actualH - canonicalH| > 1
      }

      it('DIMS-03 cap fires: drifted row outW === actualSourceW after cap binds', () => {
        // 1628×1908 canonical, 811×962 actual, peakScale 0.7
        const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.7);
        const plan = buildExportPlan(summary, new Map());
        // sourceRatio = min(811/1628=0.498, 962/1908=0.504) = 0.498
        // cappedEffScale = min(safeScale(0.7), 1, 0.498) = 0.498 (cap binds)
        expect(plan.passthroughCopies).toHaveLength(1);
        expect(plan.rows).toHaveLength(0);
        // outW = ceil(1628 × 0.498) = ceil(810.744) = 811 ✓ matches actualSourceW
        expect(plan.passthroughCopies[0].outW).toBe(811);
        expect(plan.passthroughCopies[0].outH).toBe(962);
        expect(plan.passthroughCopies[0].effectiveScale).toBeCloseTo(0.498, 3);
      });

      it('DIMS-03 cap does NOT fire when no drift: non-drifted row uses legacy formula', () => {
        // 1000×1000 canonical, no actualSource, peakScale 0.5
        const summary = makeNonDriftedSummary(1000, 1000, 0.5);
        const plan = buildExportPlan(summary, new Map());
        // sourceRatio = Infinity (dimsMismatch:false); cappedEffScale = 0.5
        expect(plan.rows).toHaveLength(1);
        expect(plan.passthroughCopies).toHaveLength(0);
        expect(plan.rows[0].outW).toBe(500);  // ceil(1000 × 0.5)
      });

      it('DIMS-03 aspect ratio invariant: cap is uniform single multiplier (NOT per-axis)', () => {
        // 1000×800 canonical, 500×480 actual (aspect ratios differ)
        // sourceRatio = min(500/1000=0.5, 480/800=0.6) = 0.5 (X axis more constraining)
        const summary = makeDriftedSummary(1000, 800, 500, 480, 0.9);
        const plan = buildExportPlan(summary, new Map());
        // cappedEffScale = 0.5 uniform; outW = ceil(1000 × 0.5) = 500; outH = ceil(800 × 0.5) = 400
        // outH = 400 != 480 (actualH) — uniform cap, NOT per-axis: aspect-ratio preserved
        expect(plan.passthroughCopies[0].outW).toBe(500);
        expect(plan.passthroughCopies[0].outH).toBe(400);  // NOT 480 — uniform cap
      });

      it('DIMS-04 generous threshold (isCapped branch): peakScale > sourceRatio → passthrough', () => {
        // peakScale 0.8 > sourceRatio 0.498 → isCapped=true → passthrough
        const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.8);
        const plan = buildExportPlan(summary, new Map());
        expect(plan.passthroughCopies).toHaveLength(1);
        expect(plan.rows).toHaveLength(0);
      });

      it('DIMS-04 generous threshold (peakAlreadyAtOrBelowSource branch): peakScale ≤ sourceRatio → passthrough', () => {
        // peakScale 0.3 ≤ sourceRatio 0.498 → peakAlreadyAtOrBelowSource=true → passthrough
        // NOTE: this is the DIMS-05 enabler — repeated Optimize on already-optimized files
        const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.3);
        const plan = buildExportPlan(summary, new Map());
        expect(plan.passthroughCopies).toHaveLength(1);
        expect(plan.rows).toHaveLength(0);
      });

      it('DIMS-04 ceil-equality redundant guard holds when isCapped (D-04 REVISED test contract)', () => {
        const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.9);
        const plan = buildExportPlan(summary, new Map());
        const row = plan.passthroughCopies[0];
        // D-04 REVISED test guards: redundant proof that the cap formula is correct
        expect(Math.ceil(811 * row.effectiveScale)).toBe(811);
        expect(Math.ceil(962 * row.effectiveScale)).toBe(962);
      });

      it('D-02 override interaction: 100% override on drifted row → cap clamps transparently → passthrough', () => {
        // Override 100% would normally produce effScale=1.0; cap forces it to sourceRatio=0.498
        const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.5);
        const plan = buildExportPlan(summary, new Map([['DRIFTED_ATTACH', 100]]));
        // adjust attachment name to match makeDriftedSummary
        expect(plan.passthroughCopies).toHaveLength(1);
        expect(plan.passthroughCopies[0].outW).toBe(811);  // never extrapolates beyond actualSource (D-02)
      });

      it('atlas-extract path no cap: actualSourceW undefined → row in plan.rows[]', () => {
        // Atlas-extract path: dimsMismatch:false, actualSourceW:undefined
        const summary = makeAtlasExtractSummary(1000, 1000, 0.7);
        const plan = buildExportPlan(summary, new Map());
        expect(plan.rows).toHaveLength(1);
        expect(plan.passthroughCopies).toHaveLength(0);
      });

      it('totals.count === rows.length + passthroughCopies.length', () => {
        // Mixed plan: 1 drifted (passthrough) + 2 non-drifted (rows)
        const summary = makeMixedSummary();
        const plan = buildExportPlan(summary, new Map());
        expect(plan.totals.count).toBe(plan.rows.length + plan.passthroughCopies.length);
      });

      it('passthroughCopies sorted deterministically by sourcePath localeCompare', () => {
        const summary = makeMultipleDriftedSummary();  // 3 drifted rows with shuffled sourcePaths
        const plan = buildExportPlan(summary, new Map());
        const paths = plan.passthroughCopies.map((r) => r.sourcePath);
        const sorted = [...paths].sort((a, b) => a.localeCompare(b));
        expect(paths).toEqual(sorted);
      });

      it('CHECKER FIX 2026-05-02 — passthrough ExportRow carries actualSourceW + actualSourceH from DisplayRow', () => {
        // Drifted row: canonical 1628×1908, actual 811×962. Passthrough row should
        // carry both actualSource fields so OptimizeDialog can render
        // "811×962 (already optimized)" instead of "1628×1908 (already optimized)".
        const summary = makeDriftedSummary(1628, 1908, 811, 962, 0.9);
        const plan = buildExportPlan(summary, new Map());
        expect(plan.passthroughCopies).toHaveLength(1);
        expect(plan.passthroughCopies[0].actualSourceW).toBe(811);
        expect(plan.passthroughCopies[0].actualSourceH).toBe(962);
      });

      it('CHECKER FIX 2026-05-02 — non-passthrough ExportRow has undefined actualSourceW + actualSourceH', () => {
        // Non-drifted row → not passthrough → actualSource fields stay undefined.
        const summary = makeNonDriftedSummary(1000, 1000, 0.5);
        const plan = buildExportPlan(summary, new Map());
        expect(plan.rows).toHaveLength(1);
        expect(plan.rows[0].actualSourceW).toBeUndefined();
        expect(plan.rows[0].actualSourceH).toBeUndefined();
      });
    });
    ```

    Adapt makeDriftedSummary / makeNonDriftedSummary / makeAtlasExtractSummary to whatever helper pattern exists in the case-(a)-(f) shape. The dimsMismatch flag is computed by analyzer (Plan 22-01 wired); for direct buildExportPlan tests, set it on the row literal.

    Step 7: Run `npm run test -- tests/core/export.spec.ts` to confirm new tests pass.

    DO NOT touch src/renderer/src/lib/export-view.ts in this task — that's Plan 22-04's parity-mirror scope. Touching both files in this plan would break the parity invariant before the parity tests are extended.
  </action>
  <verify>
    <automated>npx vitest run tests/core/export.spec.ts -t "DIMS-03|DIMS-04" 2>&1 | tail -25</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "sourceRatio" src/core/export.ts` returns ≥ 2 (declaration + use)
    - `grep -c "isPassthrough" src/core/export.ts` returns ≥ 2
    - `grep -c "peakAlreadyAtOrBelowSource" src/core/export.ts` returns ≥ 1
    - `grep -E "Math\\.min\\([^)]*actualSourceW\\s*/\\s*canonicalW" src/core/export.ts` returns ≥ 1 (cap formula present)
    - `grep -c "passthroughCopies" src/core/export.ts` returns ≥ 3 (declaration + push + return)
    - `grep -c "Math\\.ceil\\([^)]*sourceW\\s*\\*" src/core/export.ts` returns ≥ 2 (Phase 6 Round 5 ceil pattern preserved for outW, outH)
    - `grep -E "actualSourceW:\\s*acc\\.row\\.actualSourceW" src/core/export.ts` returns ≥ 1 (CHECKER FIX — passthrough propagation present)
    - `grep -E "^import.*from.*sharp|^import.*from.*electron" src/core/export.ts` returns 0 (Layer 3 invariant)
    - vitest tests in tests/core/export.spec.ts under `describe('buildExportPlan — DIMS-03 cap formula + DIMS-04 passthrough partition (Phase 22)')` all pass — at least 11 new tests (9 original + 2 CHECKER FIX propagation tests)
    - Aspect ratio test passes: outW===500 AND outH===400 for canonical 1000×800 / actual 500×480 (uniform cap, NOT per-axis)
    - Test 5 (peakAlreadyAtOrBelowSource branch) passes — DIMS-05 enabler
    - Test 7 (override interaction) passes — D-02 cap clamps transparently
    - Test 11 + Test 12 (CHECKER FIX propagation) pass: passthrough row has actualSource defined; non-passthrough row has actualSource undefined
    - All existing case-(a)-(f) tests in tests/core/export.spec.ts STILL pass (no regression on non-drifted rows)
    - Full suite: `npm run test` passes
  </acceptance_criteria>
  <done>buildExportPlan computes sourceRatio + cappedEffScale + isPassthrough per D-04 REVISED generous formula; emits plan.passthroughCopies with actualSourceW/H propagated for OptimizeDialog "already optimized" label rendering; aspect-ratio invariant preserved; ≥ 11 new DIMS-03/04 unit tests pass; existing case-(a)-(f) baseline unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| math correctness | Cap formula's correctness gates DIMS-05 round-trip safety; off-by-one or per-axis bug breaks UV sampling |
| override input | User-set override % (0..200) flows into rawEffScale → applyOverride → downscaleClampedScale |
| ExportRow → OptimizeDialog | actualSourceW/H propagation gates user-visible label correctness in 22-05; missed propagation shows misleading canonical dims |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-22-09 | Tampering | actualSourceW === 0 (corrupted/zero-byte PNG) | mitigate | Loader (22-02) skips zero-dim PNGs; export.ts sourceRatio = Infinity when actualSourceW undefined; defensive: if actualSourceW === 0 reaches export, sourceRatio === 0 → cappedEffScale === 0 → outW === 0 (caught by image-worker's existing NaN/zero-dim guard at step 3 of pipeline) |
| T-22-10 | Information disclosure | passthroughCopies array exposes which user files were over-reduced | accept | Same disclosure surface as plan.rows; no PII change |
| T-22-11 | Repudiation | Per-axis cap accidentally reintroduced | mitigate | Test 3 (aspect ratio invariant) asserts uniform single multiplier; locked memory `project_phase6_default_scaling.md` cited in source comments |
| T-22-12 | Tampering | Override % > 100 with cap interaction | mitigate | Test 7 (D-02 override interaction) covers 100% override on drifted row; applyOverride already clamps to 1.0 (Phase 4 D-91); cap then clamps to sourceRatio |
| T-22-13 | Denial of service | Float division by zero (canonicalW === 0) | mitigate | Loader (22-02) skips entries with width:0; defensive — if canonicalW === 0 reached export, division yields Infinity (handled by Math.min) — no NaN propagation |
| T-22-14 | Information disclosure | OptimizeDialog renders misleading canonical dims for passthrough rows | mitigate | CHECKER FIX 2026-05-02 — propagate row.actualSourceW + row.actualSourceH onto passthrough ExportRow (Step 5 spread); 22-05 dialog uses `row.actualSourceW ?? row.sourceW` fallback to render concrete on-disk dims |
</threat_model>

<verification>
- `grep -E "actualSourceW\\s*/\\s*canonicalW" src/core/export.ts` returns ≥ 1 (cap formula present).
- `grep -c "passthroughCopies" src/core/export.ts` ≥ 3.
- `grep "isPassthrough\\s*=" src/core/export.ts` shows the D-04 REVISED predicate (`isCapped || peakAlreadyAtOrBelowSource`).
- `grep -E "actualSourceW:\\s*acc\\.row\\.actualSourceW" src/core/export.ts` returns ≥ 1 (CHECKER FIX — passthrough actualSource propagation).
- vitest DIMS-03 + DIMS-04 describe block: ≥ 11 new tests passing (9 original + 2 CHECKER FIX propagation).
- Existing case-(a)-(f) tests: still passing (no regression).
- Layer 3 invariant: no sharp/electron/DOM imports added.
</verification>

<success_criteria>
1. Cap formula `Math.min(actualSourceW/canonicalW, actualSourceH/canonicalH)` present and uniform (single multiplier; NOT per-axis). Aspect ratio preserved at all times. (DIMS-03)
2. D-04 REVISED generous passthrough formula: `isPassthrough = dimsMismatch && (isCapped || peakAlreadyAtOrBelowSource)`. (DIMS-04)
3. Plan emits `passthroughCopies: ExportRow[]` partitioned from `rows: ExportRow[]`; totals.count = sum of both. (DIMS-04)
4. CHECKER FIX 2026-05-02 — passthrough ExportRow entries carry actualSourceW + actualSourceH (mirrored from DisplayRow); non-passthrough entries have these fields undefined. (DIMS-04 OptimizeDialog label correctness)
5. Override % clamps transparently: 100% override on drifted row falls into passthrough. (D-02 invariant honored)
6. Test guard assertions hold: `Math.ceil(actualSourceW × cappedEffScale) === actualSourceW` AND same for H — trivially when isCapped. (D-04 REVISED redundant guards)
7. Atlas-extract path (actualSourceW undefined) → no cap, no passthrough.
8. All existing case-(a)-(f) export tests still green.
9. Layer 3 invariant preserved on src/core/export.ts.
</success_criteria>

<output>
After completion, create `.planning/phases/22-seed-002-dims-badge-override-cap-depends-on-phase-21/22-03-core-export-cap-passthrough-SUMMARY.md`
</output>
