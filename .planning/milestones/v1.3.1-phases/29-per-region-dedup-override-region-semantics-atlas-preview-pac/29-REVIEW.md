---
phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/renderer/src/lib/enrich-overrides.ts
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - tests/regression/path-indirection.spec.ts
findings:
  blocker: 0
  warning: 4
  total: 4
status: issues_found
---

# Phase 29: Code Review Report — Plan 29-07 + extraction commit (889a379)

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found (no BLOCKERs; 4 WARNINGs)

## Summary

The Plan 29-07 fix (panel READ-side `enrichWithEffective` flipped from `overrides.get(row.attachmentName)` to `overrides.get(row.regionName ?? row.attachmentName)`) is correctly applied at `enrich-overrides.ts:44` and the symmetry contract with the WRITE side (`AppShell.tsx:520-528`) and export-math read (`src/core/export.ts:187-188` and `src/renderer/src/lib/export-view.ts:279-280`) is preserved. The 4-surface invariant (panel display, atlas preview, optimize plan, exported PNGs) is now restored on path-indirected rigs.

The extraction of `enrichWithEffective` + `EnrichedRow` from `GlobalMaxRenderPanel.tsx` into `src/renderer/src/lib/enrich-overrides.ts` (commit 889a379) is mechanically sound — the panel re-imports both via a type-modifier import, the inline definitions are removed, and `tests/regression/path-indirection.spec.ts` can now import the helper from a `src/renderer/src/lib/**/*.ts` path that `tsconfig.node.json` already includes. No DOM/JSX surface leaks into node-tsc scope.

The CR-01 closure regression test at `path-indirection.spec.ts:387-484` correctly drives `enrichWithEffective` directly with a synthetic path-indirected `RegionRow` and asserts (a) post-fix Map-hit by regionName, (b) symmetric negative — Map keyed by winning attachmentName misses, (c) backward-compat — `regionName === attachmentName` legacy case still works.

The 4 WARNINGs below are correctness-adjacent rough edges that should be smoothed before this code is treated as load-bearing reference material. None block shipping the panel READ-side fix.

## Warnings

### WR-01: `?? row.attachmentName` fallback is dead code under strict typing — comment misleads future readers

**File:** `src/renderer/src/lib/enrich-overrides.ts:44`
**Issue:** `RegionRow.regionName` is typed as `string` (NOT `string | undefined` — see `src/shared/types.ts:190`). Under `"strict": true` (tsconfig.node.json line 14) the `?? row.attachmentName` branch is unreachable for every value satisfying the `RegionRow` type contract — `??` only fires on `null | undefined`, and `regionName` cannot be either.

The docblock at lines 36-37 claims the fallback "covers synthetic test fixtures and the no-indirection legacy case where regionName === attachmentName." Both cases are misstated:
- For synthetic fixtures: every fixture in `path-indirection.spec.ts` (lines 416, 477, 506, 691, 752) sets `regionName: <string>` — the field is never absent. The `as RegionRow` casts at lines 449, 477 of the spec only widen the assertion, they don't allow undefined either.
- For the no-indirection legacy case: when `regionName === attachmentName`, the LEFT side of `??` is a defined non-empty string, so the fallback still doesn't fire — the lookup returns the correct value via the left operand.

A stronger argument for keeping the `??` is "defense against runtime values that bypass the type system" (deserialization from IPC, etc.) — but that's not what the comment says. The symmetric reads in `src/core/export.ts:187` and `src/renderer/src/lib/export-view.ts:279` use the same `??` pattern, where it's also only justified via defensive runtime behavior.

**Fix:** Either drop the `??` (match the type contract):
```ts
const override = overrides.get(row.regionName);
```
or update the comment to state the actual rationale:
```ts
// Defensive runtime fallback for IPC payloads or test fixtures that
// bypass type checking. Under strict typing RegionRow.regionName is
// always a non-empty string and the left operand always wins.
const override = overrides.get(row.regionName ?? row.attachmentName);
```
The second option is strongly preferred — it preserves byte-identical symmetry with the export-side reads (which makes the 3-site key contract greppable) without claiming behavior the type system rules out.

### WR-02: Plan-29-07 regression test asserts on a clamped degenerate override value, not the user's reproduced bug

**File:** `tests/regression/path-indirection.spec.ts:455, 465, 470-472`
**Issue:** The test comment at lines 451-454 claims:

> The percent (0.011) is the user's reproduced bug from .planning/debug/path-indirected-duplicate-rows.md — the 4×4-on-378-wide repro that Phase 29 set out to close.

But `0.011` placed in `overrides.set('5/7', 0.011)` is `0.011 percent` (since the override Map stores percent values per `src/renderer/src/lib/overrides-view.ts:35-41`). The user's repro from the existing REGION-04 test at line 113 uses `overrideFraction * 100 ≈ 1.058 percent`, NOT `0.011 percent`. The new test value is two orders of magnitude smaller than the documented repro.

Behavioral consequence: `clampOverride(0.011)` returns `1` (the floor — see overrides-view.ts:38 `if (rounded < 1) return 1`), so the chosen override percent is degenerate — it gets clamped to the minimum 1% on every read path. The assertion still passes because `enrichWithEffective` returns the RAW Map-fetched value as `EnrichedRow.override` (no clamping at the enrich layer), but the test does NOT exercise the documented user repro and DOES NOT assert on `effectiveScale` / `effExportW` / `effExportH` to verify downstream propagation through `computeExportDims`.

This means a future regression that, say, accidentally double-applied `applyOverride` inside `enrichWithEffective`, or dropped the `computeExportDims` call entirely and synthesized fields by hand, would not be caught by this test.

**Fix:** Either pass the documented repro value (`(4 / 378) * 100 ≈ 1.058`) and assert downstream:
```ts
const overridePct = (4 / 378) * 100;
const overrides: ReadonlyMap<string, number> = new Map([['5/7', overridePct]]);
const enriched = enrichWithEffective([region57], overrides);
expect(enriched[0].override).toBe(overridePct);
expect(enriched[0].effExportW).toBe(4); // mirrors the integration test at line 119
expect(enriched[0].effExportH).toBe(Math.ceil(428 * 0.008));
```
or update the comment to drop the "user's reproduced bug" framing and state the test value is a sentinel for the Map-key plumbing only:
```ts
// Test value is intentionally degenerate (clamped to 1% on every downstream
// read) — this assertion checks ONLY the Map-key plumbing, not effective-
// scale propagation. See REGION-04 (line 85) for the integration test that
// exercises the user's reproduced bug end-to-end with a non-degenerate value.
```

### WR-03: `noIndirectionRow` synthetic in REGION-04 (Plan 29-07) test has internally inconsistent `contributingAttachments` after spread

**File:** `tests/regression/path-indirection.spec.ts:477`
**Issue:** The backward-compat synthetic at line 477 is built via:

```ts
const noIndirectionRow: RegionRow = { ...region57, regionName: 'CIRCLE', attachmentName: 'CIRCLE' } as RegionRow;
```

`contributingAttachments` is NOT overridden — it inherits the 3 path-indirected contributors from `region57` (`5/5/5/7/7`, `5/5/7/7`, `5/7`). This produces a structurally invalid row: a "no-indirection" region (`regionName === attachmentName === 'CIRCLE'`) whose `contributingAttachments` are 3 unrelated names.

Behaviorally this works because `enrichWithEffective` reads only `regionName`, `sourceW`, `sourceH`, `peakScale`, `actualSourceW`, `actualSourceH`, `dimsMismatch`, `canonicalW`, `canonicalH` (lines 44-55) — never `contributingAttachments`. But the test labels its purpose as "Backward-compat lock for the no-indirection case" (line 474), which is undermined when the synthetic data shape doesn't match the case being tested. A maintainer extending this test to also assert on `EnrichedRow` invariants involving `contributingAttachments` (e.g. "no-indirection rows have `contributingAttachments.length === 1`") would silently pass a broken assertion.

**Fix:** Override `contributingAttachments` to match the no-indirection contract:
```ts
const noIndirectionRow: RegionRow = {
  ...region57,
  regionName: 'CIRCLE',
  attachmentName: 'CIRCLE',
  contributingAttachments: [{
    attachmentName: 'CIRCLE',
    skinName: 'default',
    slotName: 'SLOT_5/5/5/7/7',
    peakScale: 1.0,
    animationName: 'IDLE',
    time: 0,
    frame: 0,
    isSetupPosePeak: false,
  }],
} as RegionRow;
```

### WR-04: Stale doc reference — `enrichWithEffective at line 262` no longer exists

**File:** `tests/regression/path-indirection.spec.ts:395`; cross-refs in `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:23-48, 720-728`
**Issue:** Comment at spec line 395 reads:

> Pre-29-07 the panel's enrichWithEffective at line 262 read `overrides.get(row.attachmentName)`.

After commit 889a379 the helper has been extracted to `src/renderer/src/lib/enrich-overrides.ts:44` — there is no `enrichWithEffective` in `GlobalMaxRenderPanel.tsx` at any line number anymore. A future reader who follows the breadcrumb to `GlobalMaxRenderPanel.tsx:262` will land on `compareRows` (the `worldW` case branch), not the helper.

Same staleness in panel docblock at `GlobalMaxRenderPanel.tsx:23-48` and the `useMemo` comment at lines 720-728: both still use "module-top helper" / "Plan 29-07 line 262" framing as if the helper lived in this file. The panel's import at line 65 (`from '../lib/enrich-overrides.js'`) tells the truth.

**Fix:** Update spec comment line 395 to:
```ts
// Pre-29-07 the panel's enrichWithEffective (then defined inline in
// GlobalMaxRenderPanel.tsx, now extracted to src/renderer/src/lib/
// enrich-overrides.ts) read `overrides.get(row.attachmentName)`.
```
Also pass over the panel docblock at lines 23-48 and 720-728: every reference to "module-top helper" or implicit "this file's helper" should clarify the helper now lives in `../lib/enrich-overrides.ts`.

---

## Cross-cutting observations (no findings)

**Symmetry verified across 3 sites:** The override-Map key contract `row.regionName ?? row.attachmentName` is now grep-uniform at:
- `src/renderer/src/lib/enrich-overrides.ts:44` (panel READ — Plan 29-07)
- `src/renderer/src/lib/export-view.ts:279` (renderer-side export read)
- `src/core/export.ts:187` (core export read)

This satisfies the "all three sites speak the same key contract" claim in the panel's prop docblock at lines 124-130.

**Type-modifier import (panel line 65):** `import { type EnrichedRow, enrichWithEffective } from '../lib/enrich-overrides.js';` — correct: the type tag elides `EnrichedRow` from emit, the function ships verbatim. Compatible with the project's strict TS posture.

**No `.tsx` leak into tsconfig.node.json:** The new `enrich-overrides.ts` lives under `src/renderer/src/lib/` which is whitelisted in `tsconfig.node.json` line 11. The test imports the `.ts` file (not the panel `.tsx`), so node-tsc scope stays clean. The stated extraction rationale matches the actual extraction.

**Panel `onOpenOverrideDialog` prop signature mismatch (NOT a bug, worth knowing):** The panel-level prop type at line 133 declares `selectedKeys?: ReadonlySet<string>` (optional), but `RowProps` line 351 declares the same callback as `selectedKeys: ReadonlySet<string>` (required). The actual call at line 557 always passes `selectedKeys`, so this never manifests. Pre-existing — not introduced by Plan 29-07 or the extraction commit.

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
