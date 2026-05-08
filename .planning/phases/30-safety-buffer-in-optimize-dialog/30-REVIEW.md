---
phase: 30-safety-buffer-in-optimize-dialog
reviewed: 2026-05-08T12:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/core/export.ts
  - src/core/project-file.ts
  - src/main/project-io.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/lib/atlas-preview-view.ts
  - src/renderer/src/lib/export-view.ts
  - src/renderer/src/modals/OptimizeDialog.tsx
  - src/shared/types.ts
  - tests/core/export.spec.ts
  - tests/core/project-file.spec.ts
  - tests/main/project-io.spec.ts
  - tests/renderer/optimize-dialog-buffer.spec.tsx
findings:
  critical: 4
  warning: 4
  info: 3
  total: 11
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-05-08
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 30 introduces a multiplicative `safetyBufferPercent` field (integer 0-25) into the .stmproj v1 schema, plumbs it through `buildExportPlan` math (with a NARROW `bufferCapped` predicate), and adds a number input in OptimizeDialog. The math, schema validator, and serializer round-trip are well-tested in `tests/core/export.spec.ts` (T1-T8) and `tests/core/project-file.spec.ts`.

However, four BLOCKER-class defects compromise the feature's correctness and maintainability:

1. **OptimizeDialog displays/exports a STALE plan** — `exportDialogState.plan` is built once at dialog open and never rebuilt when the user mutates `safetyBufferPercentLocal`. The "Used Files / to Resize / Saving est. pixels" tiles, the Pre-Flight list, and (most critically) the actual `startExport` IPC call all use the snapshot. The buffer input feels reactive but is functionally inert until the dialog is closed and reopened.
2. **AtlasPreviewModal does NOT thread `safetyBufferPercent`** — the modal's `useMemo(() => buildAtlasPreview(... { mode, maxPageDim }))` omits the field, so the optimized-mode page count and tile dims diverge from the OptimizeDialog and HTML doc-export views, both of which DO thread the buffer.
3. **`src/core/atlas-preview.ts` parity contract is BROKEN** — the renderer mirror `atlas-preview-view.ts` was updated to accept and thread `safetyBufferPercent`; the core copy was not. The "byte-identical" mirror invariant documented at `atlas-preview-view.ts:14-19` no longer holds. The `tests/core/atlas-preview.spec.ts` parity describe block likely fails (or was relaxed).
4. **`documentation.safetyBufferPercent` (v1.2-era) and the new top-level `safetyBufferPercent` (v1.3.1) are independent fields with different ranges and behaviors, never synced** — the HTML doc-export reads the documentation slot (range 0-100, "metadata only" per its UI label); the export math reads the new top-level field (range 0-25). For any project with non-zero values in either slot, the HTML report and the actual export disagree. Existing v1.2 projects with `documentation.safetyBufferPercent: 50` will export with buffer=0 (math) but advertise "50%" in the generated HTML report.

In addition, four WARNING-class defects:

- `reloadProjectWithSkeleton` IPC TYPE contract omits `safetyBufferPercent` (and `sharpenOnExport`, `loaderMode`) despite the main-side handler reading them defensively from the args object — silent state loss after locate-skeleton recovery.
- `AppShell.onClickLocateSkeleton` does NOT pass `safetyBufferPercent`/`sharpenOnExport`/`loaderMode` through the recovery IPC, even though the renderer holds these in state.
- `ExportRow.bufferCapped` JSDoc contradicts itself (and the implementation): the upper paragraph claims it can fire on canonical-1.0 clamp; the predicate excludes that case.
- Untitled (never-saved) sessions: changing `safetyBufferPercentLocal` does NOT mark the session dirty — the user can mutate the buffer, close, and lose the value silently. (Same pre-existing pattern as `sharpenOnExportLocal`.)

## Critical Issues

### CR-01: OptimizeDialog plan is captured at open and never rebuilt — buffer changes have no display or export effect

**File:** `src/renderer/src/components/AppShell.tsx:636-643`, `src/renderer/src/components/AppShell.tsx:1993-2014`
**Issue:** `onClickOptimize` builds the export plan with the CURRENT `safetyBufferPercentLocal`, stores it in `exportDialogState.plan`, and mounts the dialog. When the user types a new value into the dialog's safety-buffer input:
1. `onSafetyBufferChange={setSafetyBufferPercentLocal}` updates AppShell state.
2. AppShell re-renders. The dialog receives the new `safetyBufferPercent` prop value (input visually updates).
3. `exportDialogState.plan` is NOT rebuilt — the dialog's `props.plan` still reflects the value at open time.
4. The Pre-Flight list, the "Used Files / to Resize / Saving est. pixels" tiles, the in-progress row labels, AND the actual `startExport(props.plan, ...)` IPC payload all consume the stale plan.

The buffer is correctly threaded into AppShell's `atlasPreviewState` memo (line 846) and `savingsPctMemo` (line 862) — those rebuild on the dependency change. But `exportDialogState.plan` is a captured snapshot.

The user-facing symptom: open Optimize Assets, set buffer to 25, observe no change to the savings percentage tile, click Start, observe export at the un-buffered dimensions. Functionally inert input.

**Fix:** Either (a) rebuild the plan reactively in AppShell whenever `safetyBufferPercentLocal` changes while `exportDialogState !== null`, or (b) move plan derivation INTO OptimizeDialog (compute via a useMemo against summary + overrides + safetyBufferPercent props). Option (b) is cleaner — the dialog already owns the rendering of plan-derived UI. Option (a) is a smaller diff:

```tsx
// In AppShell, alongside atlasPreviewState/savingsPctMemo:
useEffect(() => {
  if (exportDialogState === null) return;
  const plan = buildExportPlan(summary, overrides, {
    safetyBufferPercent: safetyBufferPercentLocal,
  });
  setExportDialogState((prev) => (prev ? { ...prev, plan } : null));
}, [safetyBufferPercentLocal, summary, overrides, exportDialogState !== null]);
```

(Note the `exportDialogState !== null` boolean dep to avoid unnecessary recomputes when the dialog is closed.)

### CR-02: AtlasPreviewModal does not thread `safetyBufferPercent` — modal page count diverges from OptimizeDialog and HTML report

**File:** `src/renderer/src/modals/AtlasPreviewModal.tsx:115-118`
**Issue:** The modal's projection memo calls:
```tsx
const projection = useMemo(
  () => buildAtlasPreview(props.summary, props.overrides, { mode, maxPageDim }),
  [props.summary, props.overrides, mode, maxPageDim],
);
```

`safetyBufferPercent` is omitted from the opts object AND from the deps array. Two consequences:
1. When the user sets a non-zero buffer in OptimizeDialog and then clicks the cross-nav "→ Atlas Preview" footer button, the modal renders the un-buffered atlas projection — the page count and tile dims will be smaller than what will actually export.
2. `AtlasPreviewModal` has no prop to receive the buffer; AppShell never passes it. The modal is permanently unaware of the feature.

This breaks the consistency that the rest of Phase 30 carefully maintains (export-view.ts, atlas-preview-view.ts deriveInputs, AppShell's atlas-preview-state memo, AppShell's savings memo all thread the buffer).

**Fix:** Add `safetyBufferPercent: number` to `AtlasPreviewModalProps`, thread it from AppShell (line 2036-2045), and pass into the `useMemo`:

```tsx
// AtlasPreviewModal.tsx
export interface AtlasPreviewModalProps {
  // … existing fields
  safetyBufferPercent: number;
}

const projection = useMemo(
  () => buildAtlasPreview(props.summary, props.overrides, {
    mode, maxPageDim, safetyBufferPercent: props.safetyBufferPercent,
  }),
  [props.summary, props.overrides, mode, maxPageDim, props.safetyBufferPercent],
);

// AppShell.tsx around line 2036:
<AtlasPreviewModal
  open={true}
  summary={effectiveSummary}
  overrides={overrides}
  safetyBufferPercent={safetyBufferPercentLocal}
  // …
/>
```

### CR-03: `src/core/atlas-preview.ts` parity contract broken — core copy not updated to thread buffer

**File:** `src/core/atlas-preview.ts:62-66`, `src/core/atlas-preview.ts:169-192`
**Issue:** `src/renderer/src/lib/atlas-preview-view.ts` is documented as "byte-identical" to `src/core/atlas-preview.ts` (lines 14-19 of the renderer file: *"If you modify one, modify the other in the same commit."*). Phase 30 modified the renderer copy:
- Added `safetyBufferPercent?: number` to the `opts` parameter of `buildAtlasPreview` (line 66 of renderer).
- Added the same param to `deriveInputs` (line 175 of renderer).
- Threaded the param into `buildExportPlan(summary, overrides, { safetyBufferPercent })` (line 197 of renderer).

The core file was NOT updated:
- `src/core/atlas-preview.ts:65` still has `opts: { mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096 }` — no `safetyBufferPercent`.
- `src/core/atlas-preview.ts:192` still calls `buildExportPlan(summary, overrides)` — no opts arg.

Consequences:
1. The function signatures of the two "byte-identical" mirrors now differ.
2. The optimized-mode atlas projection produced by `src/core/atlas-preview.ts` does not reflect the buffer, even when called by future consumers (e.g. main-process HTML doc-export, currently uses renderer-computed `atlasPreview` payload via IPC, but any future direct-from-main caller would silently use 0).
3. The tests at `tests/core/atlas-preview.spec.ts` parity describe block (referenced at renderer line 18 *"A parity describe block in tests/core/atlas-preview.spec.ts asserts sameness on representative inputs"*) either now fails or was loosened.

**Fix:** Mirror the renderer changes byte-identically into `src/core/atlas-preview.ts`:

```ts
// src/core/atlas-preview.ts:62
export function buildAtlasPreview(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts: {
    mode: 'original' | 'optimized';
    maxPageDim: 2048 | 4096;
    safetyBufferPercent?: number;
  },
): AtlasPreviewProjection {
  // …
  const allInputs = deriveInputs(summary, overrides, opts.mode, excluded, opts.safetyBufferPercent);
  // …
}

// src/core/atlas-preview.ts:169
function deriveInputs(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  mode: 'original' | 'optimized',
  excluded: Set<string>,
  safetyBufferPercent?: number,
): AtlasPreviewInput[] {
  if (mode === 'optimized') {
    const plan = buildExportPlan(summary, overrides, { safetyBufferPercent });
    // …
  }
}
```

Without this fix, the parity contract test at `tests/core/atlas-preview.spec.ts` should be failing on signature greps (renderer has the new opts shape; core does not). If the test was loosened to skip the new shape, the parity invariant is silently broken for future maintenance.

### CR-04: Two independent `safetyBufferPercent` fields exist (legacy `documentation.safetyBufferPercent` vs. new top-level) — never synced; HTML report and export math disagree

**File:** `src/core/documentation.ts:65-66`, `src/main/doc-export.ts:291-308`, `src/renderer/src/modals/DocumentationBuilderDialog.tsx:823-849`, `src/shared/types.ts:944`
**Issue:** Phase 30 introduces a NEW top-level `safetyBufferPercent: number` field on `AppSessionState`, `ProjectFileV1`, and `MaterializedProject` (range 0-25, integer-only). It replaces NO existing field. The pre-existing v1.2 `documentation.safetyBufferPercent` field (range 0-100, fractional via step 0.5, "Metadata only" per its DocumentationBuilderDialog label at lines 839-840) IS STILL PRESENT, with all its validation, serialization, and HTML-export plumbing intact.

Concrete consequence chain:
1. Open a v1.2 project with `documentation.safetyBufferPercent: 50` (legacy "metadata only" value).
2. The new top-level field is back-filled to 0 by the validator pre-massage (project-file.ts:206-208).
3. The user opens OptimizeDialog. The Quality group input shows "0" (the new top-level field). They never touch the input.
4. They click Start. Export runs with buffer=0 (because `buildExportPlan` reads the new top-level field, not `documentation.safetyBufferPercent`).
5. They click "Export Documentation". The HTML report's "Optimization Config" card displays "50%" (because `doc-export.ts:292` reads `payload.documentation.safetyBufferPercent`).

The user-facing semantic of "Safety Buffer" is a single concept; two fields representing it create silent disagreement. The DocumentationBuilderDialog's input copy still says "Metadata only. Captured in the HTML export; export math wiring deferred to a future phase." — Phase 30 IS the future phase, but the wiring did not happen.

Even worse: the OptimizeDialog input shape (integer 0-25) and the DocumentationBuilderDialog input shape (fractional 0-100, step 0.5) are now SEMANTICALLY divergent representations of the same concept. The user can edit either one independently.

**Fix (one of three options, requires a Phase 30 amendment decision):**

Option A — Single source of truth at the new top-level field:
- Remove `safetyBufferPercent` from `Documentation`/`DEFAULT_DOCUMENTATION`/`validateDocumentation` (or deprecate it; for read-only legacy back-compat read it once at materialize time and migrate it INTO the top-level field if the top-level is missing).
- Update `doc-export.ts:292` to read `payload.safetyBufferPercent` (add it to `DocExportPayload`) instead of `payload.documentation.safetyBufferPercent`.
- Remove the SafetyBufferSection in DocumentationBuilderDialog.

Option B — Sync the two fields in AppShell:
- When `safetyBufferPercentLocal` changes, also update `documentation.safetyBufferPercent`. (And vice-versa if the documentation builder is the source.) Both inputs would expose the same concept, but with different range constraints — confusing.

Option C — Explicit "deprecated, will be migrated" notice + back-fill:
- Document that `documentation.safetyBufferPercent` is a v1.2-era field; on materialize, if both fields exist and differ, prefer the top-level (or a Pitfall-resolved precedence). Update `doc-export.ts` to read the top-level field. Leave the doc-builder UI as a read-only display.

Option A is the cleanest end-state but requires a schema migration story; Option C is the minimum viable fix.

## Warnings

### WR-01: `reloadProjectWithSkeleton` IPC TYPE contract omits `safetyBufferPercent` / `sharpenOnExport` / `loaderMode`; recovery silently resets these to defaults

**File:** `src/shared/types.ts:1195-1203`, `src/renderer/src/components/AppShell.tsx:1228-1251`
**Issue:** The `reloadProjectWithSkeleton` IPC's `args` type only exposes:
```ts
{
  projectPath: string;
  newSkeletonPath: string;
  mergedOverrides: Record<string, number>;
  samplingHz?: number;
  lastOutDir?: string | null;
  sortColumn?: string | null;
  sortDir?: 'asc' | 'desc' | null;
}
```

`safetyBufferPercent`, `sharpenOnExport`, and `loaderMode` are missing. The main-side handler (`project-io.ts:710-716`) reads them defensively via `(a as Record<string, unknown>).safetyBufferPercent`, falling back to 0 / false / 'auto' when absent. The renderer's `onClickLocateSkeleton` (line 1232-1240) does NOT pass them.

Consequence: a user with `safetyBufferPercent: 5`, `sharpenOnExport: true`, `loaderMode: 'atlas-less'` who hits a missing-skeleton error and uses the locate-skeleton picker WILL silently lose all three settings. The post-recovery `MaterializedProject` arrives with the defaults and AppShell's `mountOpenResponse` overwrites local state.

**Fix:** Add the three fields to the type contract AND populate them in `onClickLocateSkeleton`:

```ts
// types.ts:1195
reloadProjectWithSkeleton: (args: {
  // … existing fields
  loaderMode?: 'auto' | 'atlas-less';
  sharpenOnExport?: boolean;
  safetyBufferPercent?: number;
}) => Promise<OpenResponse>;

// AppShell.tsx:1232
const resp = await window.api.reloadProjectWithSkeleton({
  projectPath: skeletonNotFoundError.projectPath,
  newSkeletonPath: located.newPath,
  mergedOverrides: skeletonNotFoundError.mergedOverrides,
  samplingHz: skeletonNotFoundError.cachedSamplingHz,
  lastOutDir: skeletonNotFoundError.cachedLastOutDir,
  sortColumn: skeletonNotFoundError.cachedSortColumn,
  sortDir: skeletonNotFoundError.cachedSortDir,
  loaderMode,
  sharpenOnExport: sharpenOnExportLocal,
  safetyBufferPercent: safetyBufferPercentLocal,
});
```

Note: the missing `sharpenOnExport`/`loaderMode` threading is a pre-existing Phase 28/Phase 21 oversight — Phase 30 inherits the same omission for the new field. Fixing all three together in one place is consistent with the recovery handler's already-defensive coercion.

### WR-02: `ExportRow.bufferCapped` JSDoc contradicts itself and the implementation

**File:** `src/shared/types.ts:399-416`
**Issue:** The doc reads:
> "Parallel to existing isCapped from Phase 22.1; the two flags are independent — a row can be bufferCapped without being isCapped (clean atlas with no dims drift, just buffer pushing past 1.0 → canonical clamp binds)."

But the predicate locked in the implementation at `src/core/export.ts:269-272` is the NARROW form:
```ts
const bufferCapped =
  bufferPct > 0
  && bufferedScale > sourceRatio
  && safeScale(rawEffScale) <= sourceRatio;
```

When the atlas is clean (no dimsMismatch), `sourceRatio = Infinity`. `bufferedScale > Infinity` is always false. `bufferCapped` cannot fire on the canonical-1.0 clamp by construction — and the very next paragraph of the same docblock says so:
> "(locked NARROW per CONTEXT D-06): bufferCapped fires when bufferedScale > sourceRatio AND rawEffScale <= sourceRatio — i.e. the buffer is what pushed the row past the actualSource cap. Does NOT fire on the canonical-1.0 clamp; that case is captured by existing isCapped semantics."

Wait — and `isCapped` ALSO does not fire on canonical clamp (`isCapped = downscaleClampedScale > sourceRatio`; downscaleClampedScale ≤ 1; sourceRatio = Infinity; predicate false). So the upper paragraph's example case ("clean atlas with no dims drift, just buffer pushing past 1.0 → canonical clamp binds") is impossible — neither flag fires. The example contradicts both the lower paragraph and the code.

This is misleading for downstream consumers (e.g. the deferred "(buffer-capped)" UI signal a future phase will wire). A future maintainer reading the upper paragraph will write code that expects `bufferCapped: true` on a clean-atlas row at `peakScale: 1.0 + buffer: 5%` — and silently get `undefined`.

**Fix:** Delete the misleading parenthetical from the upper paragraph. Reframe to match the implementation:

```ts
/**
 * Phase 30 BUFFER-02 D-06 — true when the buffer is what pushed a drifted-row
 * (dimsMismatch=true, actualSource defined) effective scale past the
 * sourceRatio cap. Independent of isCapped (a row can be bufferCapped without
 * being isCapped — see predicate below). Does NOT fire on canonical-1.0 clamp:
 * clean atlases have sourceRatio === Infinity, so `bufferedScale > sourceRatio`
 * is impossible by construction. Carried in IPC payload; not surfaced in
 * v1.3.1 UI per silent-cap contract D-05.
 *
 * Predicate (locked NARROW per CONTEXT D-06):
 *   bufferPct > 0 && bufferedScale > sourceRatio && safeScale(rawEffScale) <= sourceRatio
 */
bufferCapped?: boolean;
```

### WR-03: Untitled session: changing safety buffer does not mark dirty — value lost on close-without-save

**File:** `src/renderer/src/components/AppShell.tsx:889-905`
**Issue:** The `isDirty` derivation has two branches:
```ts
if (lastSaved === null) {
  return overrides.size > 0;  // untitled: dirty only if overrides exist
}
// loaded session: compares against lastSaved including safetyBufferPercent
```

For an untitled (never-saved) session, only `overrides.size > 0` triggers dirty. A user can:
1. Drop a skeleton (untitled session, no overrides yet).
2. Open Optimize Assets, set safety buffer to 25.
3. Close the dialog, close the app.
4. SaveQuitDialog never appears (isDirty was false).
5. The buffer value is lost.

Same defect was inherited from `samplingHzLocal` and `sharpenOnExportLocal` — pre-existing pattern, not Phase 30's invention. But Phase 30 adds a third "session-state-with-no-untitled-dirty-tracking" field, doubling down on the issue.

**Fix:** Either extend the untitled-session dirty check to include non-default `safetyBufferPercentLocal` / `sharpenOnExportLocal` / non-default `samplingHzLocal`, OR seed `lastSaved` with defaults at AppShell mount when `initialProject` is null:

```ts
// Option A — extend untitled-dirty
if (lastSaved === null) {
  if (overrides.size > 0) return true;
  if (safetyBufferPercentLocal !== 0) return true;
  if (sharpenOnExportLocal !== false) return true;
  if (samplingHzLocal !== 120) return true;  // D-146 default
  return false;
}

// Option B — seed lastSaved with defaults on untitled mount
const [lastSaved, setLastSaved] = useState(() =>
  initialProject
    ? { /* … existing */ }
    : {
        overrides: {},
        samplingHz: 120,
        sharpenOnExport: false,
        safetyBufferPercent: 0,
      },
);
```

Option B has cleaner semantics (untitled and loaded sessions follow the same dirty derivation) but changes the SaveQuitDialog trigger conditions for existing flows — the pre-existing pattern would have to change, which is a wider blast radius. Option A is a narrower fix.

### WR-04: `OptimizeDialog` input parsing has redundant `Math.floor` after `parseInt`

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:443-451`
**Issue:**
```tsx
onChange={(e) => {
  const parsed = parseInt(e.target.value, 10);
  if (!Number.isFinite(parsed)) {
    props.onSafetyBufferChange(0);
    return;
  }
  const clamped = Math.max(0, Math.min(25, Math.floor(parsed)));
  props.onSafetyBufferChange(clamped);
}}
```

`parseInt(s, 10)` already truncates fractional inputs to integers (e.g. `parseInt('5.9', 10) === 5`). The `Math.floor(parsed)` is therefore a no-op. Minor — not a bug, but the layered defense suggests the author was uncertain which guard does what; future maintainer might think parseInt allows fractions and add additional guards. Either remove the `Math.floor` (parseInt is sufficient) or replace `parseInt` with `Number(value)` if you actually want to detect fractional input as invalid.

**Fix:** Simplify:
```tsx
const parsed = parseInt(e.target.value, 10);
if (!Number.isFinite(parsed)) {
  props.onSafetyBufferChange(0);
  return;
}
const clamped = Math.max(0, Math.min(25, parsed));
props.onSafetyBufferChange(clamped);
```

Or, if you want to reject "5.9" as invalid input (rather than silently truncating to 5):
```tsx
const parsed = Number(e.target.value);
if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
  props.onSafetyBufferChange(0);
  return;
}
const clamped = Math.max(0, Math.min(25, parsed));
props.onSafetyBufferChange(clamped);
```

The second variant matches the validator's strictness contract (`Number.isInteger` check at `project-file.ts:211`).

## Info

### IN-01: `BuildExportPlanOptions.safetyBufferPercent` JSDoc says "math accepts any non-negative number" but math accepts negative too

**File:** `src/core/export.ts:74-90`, `src/renderer/src/lib/export-view.ts:53-71`
**Issue:** The JSDoc says:
> "Out-of-range values are NOT defensively coerced here — the math accepts any non-negative number, but ergonomically the caller's contract is integer 0-25."

But the math at line 219 is:
```ts
const bufferedScale = bufferPct === 0 ? rawEffScale : rawEffScale * (1 + bufferPct / 100);
```

A negative `bufferPct` (say -10) would compute `rawEffScale * 0.9` — a scale REDUCTION, not a no-op. The math doesn't validate the sign. "Accepts any non-negative number" is true but the doc could clarify that negatives produce unintended downscale-shrink, not a defensive no-op. Minor — not a runtime bug because callers (OptimizeDialog clamp, validator pre-save) prevent negatives — but future callers warrant the heads-up.

**Fix:** Clarify the docblock or add a defensive guard. Since the docblock already takes the "no defensive coerce" stance, just tighten the wording:
```
* Out-of-range values are NOT defensively coerced here — the math accepts
* any number (including negatives, which produce unintended shrink); the
* caller's contract is integer 0-25.
```

### IN-02: AppShell builds export plan THREE TIMES per render (atlasPreviewState memo, savingsPctMemo, onClickOptimize/onConflictPickDifferent)

**File:** `src/renderer/src/components/AppShell.tsx:639-643`, `src/renderer/src/components/AppShell.tsx:761-766`, `src/renderer/src/components/AppShell.tsx:843-848`, `src/renderer/src/components/AppShell.tsx:861-872`
**Issue:** `buildExportPlan(summary, overrides, { safetyBufferPercent })` is called from four sites in AppShell. Three are reactive (one inside a useMemo for atlasPreviewState that calls buildAtlasPreview which itself calls buildExportPlan; one inside savingsPctMemo; one in onClickOptimize callback; one in onConflictPickDifferent callback). For most renders this is fine — the memos rebuild only when their deps change.

But the `buildAtlasPreview` call inside atlasPreviewState (line 843) ALSO calls `buildExportPlan` internally (atlas-preview-view.ts:197), so a single AppShell render that crosses any of the {summary, overrides, safetyBufferPercentLocal} dep boundaries effectively builds the plan twice (once for savings, once via atlas-preview). Out of v1 perf scope per Phase 30 review-scope, but worth noting for the v1.3.2 polish phase.

**Fix:** Defer; mention as a v1.3.2 polish item. Optional consolidation:
```ts
const exportPlanMemo = useMemo(
  () => buildExportPlan(effectiveSummary, overrides, { safetyBufferPercent: safetyBufferPercentLocal }),
  [effectiveSummary, overrides, safetyBufferPercentLocal],
);
// then atlasPreviewState, savingsPctMemo, and onClickOptimize all consume exportPlanMemo
```

### IN-03: `tests/renderer/optimize-dialog-buffer.spec.tsx` covers UI input but NOT the stale-plan defect (CR-01)

**File:** `tests/renderer/optimize-dialog-buffer.spec.tsx:177-186`
**Issue:** The "controlled prop change re-renders input with new value" test at line 177-186 verifies the input element re-renders when `safetyBufferPercent` prop changes. But it does NOT verify that the displayed plan (Used Files / to Resize / Saving %) or the Pre-Flight list updates when the buffer changes. With CR-01 in place, the test could be passing while the actual export reflects a stale plan.

A regression test that would have caught CR-01:
```tsx
it('Pre-Flight list and tile values update when safetyBufferPercent prop changes', () => {
  // Render with plan built at buffer=0 (e.g. peakScale 0.5, sourceW 1000 → outW 500)
  const planBuf0 = buildExportPlan(summary, new Map(), { safetyBufferPercent: 0 });
  const { rerender } = render(<OptimizeDialog {...buildProps({ plan: planBuf0, safetyBufferPercent: 0 })} />);
  expect(screen.getByText(/500.*500/)).toBeDefined();
  // Update buffer prop AND plan prop together (the parent must rebuild the plan)
  const planBuf25 = buildExportPlan(summary, new Map(), { safetyBufferPercent: 25 });
  rerender(<OptimizeDialog {...buildProps({ plan: planBuf25, safetyBufferPercent: 25 })} />);
  expect(screen.getByText(/625.*625/)).toBeDefined();  // 0.5 × 1.25 × 1000 = 625
});
```

This test passing would NOT catch CR-01 by itself — it relies on the parent rebuilding the plan when the buffer changes. The integration test that WOULD catch CR-01 is at the AppShell level: render AppShell with a project, open OptimizeDialog, fire onSafetyBufferChange, observe that the dialog's Pre-Flight list updates.

**Fix:** Add an AppShell-level integration test (or extend an existing optimize-dialog test harness with an AppShell wrapper) that simulates buffer change AFTER mount and asserts the dialog's plan content reflects the new buffer.

---

_Reviewed: 2026-05-08T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
