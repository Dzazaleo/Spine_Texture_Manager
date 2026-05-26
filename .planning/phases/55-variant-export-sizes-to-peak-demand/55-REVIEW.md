---
phase: 55-variant-export-sizes-to-peak-demand
reviewed: 2026-05-26T12:12:17Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/core/export.ts
  - src/main/variant-export.ts
  - src/renderer/src/lib/export-view.ts
  - tests/core/export.spec.ts
  - tests/core/variant-sizing.spec.ts
findings:
  critical: 1
  warning: 2
  info: 2
  total: 5
status: issues_found
---

# Phase 55: Code Review Report

**Reviewed:** 2026-05-26T12:12:17Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 55 introduces a `variantScale` option (`vs`) to `buildExportPlan` / `BuildExportPlanOptions` that lifts the `effScale` ceiling from `1` to `1/vs`, allowing a variant at scale `s` to size its output textures up to the master-source pixel ceiling. The implementation lands correctly in both `src/core/export.ts` and its renderer mirror `src/renderer/src/lib/export-view.ts`, and the `variant-export.ts` orchestrator correctly threads `variantScale: s` through to the plan builder.

One critical defect was found: `computeExportDims` in `export-view.ts` — the function used by `enrichWithEffective` to drive the panel Peak column and savings chip — still hard-codes the `1.0` canonical ceiling rather than applying the `1/vs` ceiling. This means the panel display path will diverge from the export math for variant-scale previews. Two warnings address a `safetyBufferPercent + variantScale` interaction gap and a missing behavioral parity test. Two info items cover dead backup files and a test helper documentation gap.

## Critical Issues

### CR-01: `computeExportDims` ignores `variantScale` — display diverges from export for variant peak preview

**File:** `src/renderer/src/lib/export-view.ts:244`
**Issue:** `computeExportDims` clamps `downscaleClampedScale` at `1` (the master ceiling):
```ts
const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);
```
The `buildExportPlan` body in the same file (lines 419, 435) correctly uses `1 / vs`:
```ts
const vs = opts.variantScale ?? 1.0;
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1 / vs);
```
`computeExportDims` has no `variantScale` parameter at all. Every downstream consumer of `computeExportDims` — `enrichWithEffective` (called by the panel to render "Peak W×H", "Scale", and the green/amber/red savings chip) and the `AnimationBreakdownPanel` — will clamp variant `effScale` at `1.0` instead of `1/s`. This means:

- A variant row with `s=0.5`, `master peak 2.5` should show `effScale=1.25`, `outW=1250`. The panel will instead show `effScale=1.0`, `outW=1000` — a completely wrong "at source" display where the texture actually sizes to `1250`.
- The green/amber/red chip logic compares displayed Peak to displayed Source and will misclassify such rows, potentially showing false-green "savings" even when the variant output is at or above source.
- This is a display-vs-export divergence: the export produces the correct `1250` file (via `buildExportPlan` with `variantScale`), but the user reads `1000` in the UI. The parity contract ("display always agrees with export") is broken for any `peakScale > 1` attachment in a variant-scale preview.

**Fix:** Add an optional `variantScale` parameter to `computeExportDims` and thread it through to the clamp:
```ts
export function computeExportDims(
  sourceW: number,
  sourceH: number,
  peakScale: number,
  override: number | undefined,
  actualSourceW?: number,
  actualSourceH?: number,
  dimsMismatch?: boolean,
  canonicalW?: number,
  canonicalH?: number,
  variantScale?: number,          // Phase 55 — lift ceiling to 1/vs (default 1.0 = master)
): { /* unchanged */ } {
  // ...
  const vs = variantScale ?? 1.0;
  const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1 / vs);
  // ...
}
```
All existing call sites pass no `variantScale` argument and will default to `vs=1.0 → 1/vs=1.0`, preserving byte-identical master behavior. Only variant-preview call sites (panel + OptimizeDialog when rendering a variant summary) need to supply `variantScale`.

## Warnings

### WR-01: `safetyBufferPercent` + `variantScale` interaction is not tested — buffer could exceed `1/vs` ceiling silently

**File:** `tests/core/variant-sizing.spec.ts:148-206`
**Issue:** The Phase 55 test block (T1/T2/T3) exercises the `variantScale` ceiling only with `safetyBufferPercent` omitted (defaulting to 0). The `bufferPct` path in `buildExportPlan` applies BEFORE the `1/vs` clamp (step order: raw → buffer → safeScale → min(…, 1/vs) → min(…, sourceRatio)). There is no test verifying that a non-zero buffer combined with a `variantScale` still obeys the `1/vs` ceiling — e.g. `s=0.5, peakScale=1.8, buffer=10`:
- `rawEffScale = 0.5 × 1.8 = 0.9`
- `bufferedScale = 0.9 × 1.10 = 0.99`
- `downscaleClampedScale = min(safeScale(0.99), 1/0.5=2.0) = 0.99` (clamp does not bind — correct)

But also `s=0.5, peakScale=4.0, buffer=10`:
- `rawEffScale = 0.5 × 4.0 = 2.0`
- `bufferedScale = 2.0 × 1.10 = 2.2`
- `downscaleClampedScale = min(safeScale(2.2), 2.0) = 2.0` (ceiling DOES bind)

The implementation looks correct, but without a test covering a buffer-induced overshoot of `1/vs`, a future refactor could silently break this interaction (the same failure mode Phase 30 BUFFER-02 tests guard against for the `sourceRatio` cap). The Phase 30 T4 test (buffer pushes past `sourceRatio`) has an exact analogue here.

**Fix:** Add a test case to the Phase 55 describe block in `tests/core/variant-sizing.spec.ts`:
```ts
it('T4: buffer+variantScale — buffer-inflated demand still clamped at 1/s (no over-ceiling)', () => {
  const s = 0.5;
  const summary = { regions: [region('BIG', 4.0)], peaks: [], orphanedFiles: [] } as any as SkeletonSummary;
  const plan = buildExportPlan(scaleSummaryPeaks(summary, s), new Map(), {
    skeletonPath: SKELETON_PATH,
    variantScale: s,
    safetyBufferPercent: 10,
  });
  const rows = [...plan.rows, ...plan.passthroughCopies];
  const row = rows.find((r) => r.attachmentNames.includes('BIG'))!;
  // rawEff = 0.5 × 4.0 = 2.0; buffered = 2.0 × 1.1 = 2.2; 1/s = 2.0 → clamped at 2.0
  expect(row.effectiveScale).toBeCloseTo(1 / s, 5);   // 2.0
  expect(row.outW).toBe(Math.ceil(1000 * (1 / s)));   // 2000
});
```

### WR-02: Parity test for `variantScale` behavior between `src/core/export.ts` and renderer mirror is missing

**File:** `tests/core/export.spec.ts:905-911`
**Issue:** The existing Phase 55 parity check (line 905) asserts only that both files declare `variantScale?: number` on `BuildExportPlanOptions` via a regex grep — it does NOT execute both copies with a `variantScale` input and compare output. The behavioral parity test at line 921 (`renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs`) exercises only the master path (`variantScale` omitted). This means any future divergence in how the two copies implement the `1/vs` ceiling would pass the existing tests while silently producing different export plans in production (the renderer builds the plan client-side and passes it to the main process).

**Fix:** Add a behavioral parity case to the existing `renderer view buildExportPlan produces IDENTICAL ExportPlan` test or as a separate `it` block in the parity describe:
```ts
it('Phase 55 variantScale parity: both files produce IDENTICAL plan with variantScale=0.5', async () => {
  const viewModule = await import('../../src/renderer/src/lib/export-view.js');
  const buildExportPlanView = viewModule.buildExportPlan;
  const s = 0.5;
  const peaks = [/* region with peakScale 2.5 — exercises the ceiling-lift */];
  const summary = { peaks, regions: synthRegionsFromPeaks(peaks), orphanedFiles: [] } as unknown as SkeletonSummary;
  const scaled = scaleSummaryPeaks(summary, s);
  const opts = { skeletonPath: '/tmp/SIMPLE_TEST.json', variantScale: s };
  const corePlan = buildExportPlan(scaled, new Map(), opts);
  const viewPlan = buildExportPlanView(scaled, new Map(), opts);
  expect(viewPlan).toEqual(corePlan);
});
```

## Info

### IN-01: Backup files `.bak4` and `.bak3` are tracked in the working tree alongside reviewed source

**File:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx.bak4` and `src/renderer/src/panels/GlobalMaxRenderPanel.tsx.bak3`
**Issue:** Both `.bak` files are present on disk (confirmed by the `grep -rn computeExportDims` output above). They are stale copies of the panel source and appear to reference an older version of `computeExportDims` (line 224 in `.bak4` does not receive `peakDemandW/H` from `computeExportDims`). They are not source files in scope for this review but their presence as non-gitignored sibling files creates confusion and could mislead future grepping (e.g. scanning for `computeExportDims` callers finds them). This is outside the Phase 55 diff but worth flagging.

**Fix:** Add `*.bak` and `*.bak[0-9]` patterns to `.gitignore`, or remove the files with `git clean -f`.

### IN-02: `synthRegionsFromPeaks` in `export.spec.ts` divergences are documented but not enforced — future tests could silently accept wrong behavior

**File:** `tests/core/export.spec.ts:64-156` (WR-03 docblock)
**Issue:** The WR-03 docblock at line 64 documents three divergences from production analyzer semantics (winner tiebreak, contributor dedup, field-default masking), but there is no `TODO` or issue tracker reference to drive eventual resolution. The docblock notes "replacing this helper with a thin wrapper around `analyzeRegions` would cascade input-shape changes across every call site — too invasive for a review-fix pass," which is an accepted deferral. This is purely informational — the divergences do not affect any existing test, and the Phase 35 work confirmed them as non-biting.

**Fix:** No immediate action required. Consider adding a reference to the analyzer's real `pickRegionWinner` tiebreak behavior in at least one new test using `analyzeRegions` (Category A) if the Phase 55 new features ever need end-to-end fixture coverage. The current synthetic approach is explicitly scoped as an approximation.

---

_Reviewed: 2026-05-26T12:12:17Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
