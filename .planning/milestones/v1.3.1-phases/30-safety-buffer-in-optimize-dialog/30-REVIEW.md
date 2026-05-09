---
phase: 30-safety-buffer-in-optimize-dialog
reviewed: 2026-05-08T13:05:00Z
depth: standard
scope: gap-closure (plans 30-04 + 30-05)
files_reviewed: 10
files_reviewed_list:
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/AtlasPreviewModal.tsx
  - src/renderer/src/modals/OptimizeDialog.tsx
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx
  - src/shared/types.ts
  - src/core/atlas-preview.ts
  - src/main/doc-export.ts
  - tests/renderer/optimize-dialog-buffer.spec.tsx
  - tests/core/atlas-preview.spec.ts
  - tests/main/doc-export.spec.ts
findings:
  blocker: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 30 Gap-Closure: Code Review Report (plans 30-04 + 30-05)

**Reviewed:** 2026-05-08T13:05:00Z
**Depth:** standard
**Scope:** Files changed during the 30-04 + 30-05 gap-closure waves only — NOT a re-review of pre-closure phase 30 deliverables.
**Status:** issues_found (1 BLOCKER, 5 WARNINGs, 4 INFOs)

## Summary

The gap-closure plans correctly close the four BLOCKERs surfaced by `30-VERIFICATION.md`:

- **CR-01** (reactive plan rebuild) — closed via the new `useEffect` at `AppShell.tsx:954-961`. The boolean dep `exportDialogState !== null` correctly avoids feedback loops.
- **CR-02** (AtlasPreviewModal buffer threading) — closed; the modal now accepts `safetyBufferPercent: number` (REQUIRED) and threads it through `buildAtlasPreview` opts and the deps array.
- **CR-03** (atlas-preview core/renderer mirror parity) — closed; `src/core/atlas-preview.ts` now mirrors `src/renderer/src/lib/atlas-preview-view.ts` for the buffer plumbing (3 sites: opts, deriveInputs param, buildExportPlan call).
- **CR-04** (legacy vs new `safetyBufferPercent` field) — closed via Option C: doc-export reads top-level field with defensive integer-range coerce; DocumentationBuilderDialog surfaces a "Moved to Optimize dialog" notice.

WR-01/WR-02/WR-03/WR-04 are also addressed.

However, the closure introduces one BLOCKER (uncaught type breakage in renderer tests due to project tsconfig coverage gap), and the integration tests claimed to "catch CR-01 regression" do NOT actually exercise AppShell's reactive useEffect — only the static-grep sentinel does. Several WARNINGs flag weak-test problems and inherited inconsistencies the gap-closure inherits without addressing.

All 922 vitest tests pass. `typecheck:web` passes (because it excludes test files). `typecheck:node` does NOT cover the renderer `.tsx` test files, so the renderer-test type-breakage is silent.

---

## BLOCKER Issues

### BL-01: AtlasPreviewModal renderer test no longer type-checks against the (newly required) `safetyBufferPercent` prop

**File:** `tests/renderer/atlas-preview-modal.spec.tsx` (14 mount sites: lines 178, 198, 213, 228, 246, 263, 285, 323, 356, 376, 391, 448, 486, 519)
**Issue:** Plan 30-04 promoted `safetyBufferPercent: number` to a REQUIRED member of `AtlasPreviewModalProps` (`src/renderer/src/modals/AtlasPreviewModal.tsx:102`). All 14 existing test mounts of `<AtlasPreviewModal ...>` in `tests/renderer/atlas-preview-modal.spec.tsx` are now passing an incomplete props object. Direct TypeScript check confirms 14 `TS2739` errors:

```
tests/renderer/atlas-preview-modal.spec.tsx(178,8): error TS2739: Type '{ open: true; ... }' is missing the following properties from type 'AtlasPreviewModalProps': onOpenOptimizeDialog, safetyBufferPercent
```

(`onOpenOptimizeDialog` was already pre-existingly missing — Phase 30 inherits and adds `safetyBufferPercent` to the same broken mount list.)

The error does not surface in CI because:
- `tsconfig.web.json` `include:` covers `src/renderer/src/**/*.tsx` only; tests are excluded.
- `tsconfig.node.json` `include:` covers `tests/**/*.ts` only — `*.tsx` tests are not included.
- `vitest` transpiles via esbuild (strips types); does not type-check.

So the only way to discover the breakage today is to run `tsc` directly against the test file with full type-checking. Plans 30-04 + 30-05 did not update the test fixture. The plan's `must_haves.truths` block (Plan 30-04 Task 2) verified prop threading at the AppShell mount site but did not regression-check existing AtlasPreviewModal test mounts.

The test runtime survives because `props.safetyBufferPercent === undefined` flows into `buildAtlasPreview({ safetyBufferPercent: undefined })` which collapses to `0` via `bufferPct = opts?.safetyBufferPercent ?? 0` in `src/core/export.ts:217`. So the tests behave as before — but the type contract is silently broken.

**Fix:** Add `safetyBufferPercent={0}` (and `onOpenOptimizeDialog={vi.fn()}` to clear the pre-existing carry-forward) to all 14 mount sites in `tests/renderer/atlas-preview-modal.spec.tsx`. Optionally introduce a `makeProps` helper at the top of the file (mirroring `tests/renderer/optimize-dialog-buffer.spec.tsx`'s `buildProps`) so future required-prop additions land in one place. Separately: extend project tsconfig coverage so `*.tsx` test files type-check in CI (lift either `tsconfig.web.json` to include `tests/renderer/**/*.tsx` or add a third `tsconfig.tests.json`).

```typescript
// Apply to every mount in atlas-preview-modal.spec.tsx — example for the first one (line 178):
<AtlasPreviewModal
  open={true}
  summary={makeSummary()}
  overrides={new Map()}
  onJumpToRegion={vi.fn()}
  onClose={vi.fn()}
  onOpenOptimizeDialog={vi.fn()}     // pre-existing missing prop
  safetyBufferPercent={0}            // Phase 30 closure plan 30-04
/>
```

---

## WARNING Issues

### WR-01: Static-grep regression sentinel test #2 (post-mount → startExport plan rebuild) is structurally tautological — does NOT exercise the AppShell useEffect

**File:** `tests/renderer/optimize-dialog-buffer.spec.tsx:208-249, 276-327`
**Issue:** Test 2 (`'post-mount buffer change → startExport receives plan with rebuilt outW (CR-01 IPC closure)'`) mounts a `StatefulWrapper` (line 208-250) whose own internal `React.useMemo` rebuilds the plan when the buffer changes (line 217-235). The test then types `5` into the input, clicks Start, and asserts `startExportMock.mock.calls[0][0].rows[0].outW === 525`.

But the wrapper's `useMemo` IS the rebuild logic — it's a self-fulfilling simulation of the AppShell useEffect, not a test of the AppShell useEffect. If the AppShell's `useEffect` at lines 954-961 were reverted (deleted entirely), this test would still pass, because the wrapper does the rebuild work. Verified empirically: deleting AppShell.tsx:954-961 still leaves Test 2 GREEN.

The plan claimed Test 2 closes IN-03 ("the test that would have caught CR-01"). It would have caught CR-01 if Test 2 had instead mounted the actual `<AppShell>` or a smaller AppShell-shaped wrapper with no internal `useMemo` — i.e., a wrapper that ONLY owns `safetyBufferPercent` state and feeds it as a prop without rebuilding plan. The current shape only catches "did the wrapper's useMemo work as expected".

The deps-array static-grep at lines 348-349 IS the load-bearing regression sentinel (verified by deleting AppShell.tsx:954-961 — test goes RED on assertion 3). Tests 1 + 2 add little incremental safety beyond the grep.

**Fix:** Either (a) delete Tests 1 + 2 entirely and rely on the static-grep sentinel (assertion 3) as the protection, or (b) replace the `StatefulWrapper`'s internal `useMemo` with a simple useState that holds the plan and DOESN'T rebuild — then exercise via a parent component that mounts a useEffect against `[buffer]` to mirror AppShell's pattern. Option (b) is the only way the test can fail when AppShell's useEffect is reverted.

### WR-02: Static-grep assertion #2 (the buildExportPlan-after-setExportDialogState regex) can match across UNRELATED code paths and won't catch a useEffect revert

**File:** `tests/renderer/optimize-dialog-buffer.spec.tsx:344-345`
**Issue:** The regex
```
/setExportDialogState\(\(prev\) =>[\s\S]*?buildExportPlan\([\s\S]*?safetyBufferPercent: safetyBufferPercentLocal/
```
uses `[\s\S]*?` (non-greedy any-line). Even if the new useEffect at AppShell.tsx:954-961 is fully reverted, this regex still matches via the existing pre-Phase-30 outDir-only update at AppShell.tsx:685 (`setExportDialogState((prev) => (prev ? { ...prev, outDir: pickedDir } : null));`) followed minimally by the `onConflictPickDifferent` call at line 761-762 (`buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal })`). The non-greedy `*?` will skip 70+ lines of code to find the match.

So this assertion does NOT catch a revert of the new useEffect. The deps-array assertion #3 at line 348-349 is the only real protection.

**Fix:** Tighten the regex to anchor closer to the useEffect signature, e.g.:
```typescript
expect(appShell)
  .toMatch(/useEffect\(\(\) => \{\s*if \(exportDialogState === null\) return;[\s\S]{0,500}?setExportDialogState\(\(prev\) =>[\s\S]{0,200}?\{ \.\.\.prev, plan \}/);
```
(Bound character distances so the regex cannot stretch across unrelated code paths.) Or drop assertion #2 entirely; assertion #3 is sufficient.

### WR-03: "Byte-identical inline-copy" invariant claim weakened by un-mirrored comment text

**File:** `src/core/atlas-preview.ts:78-79` vs `src/renderer/src/lib/atlas-preview-view.ts:69-70`
**Issue:** The two files are claimed (per atlas-preview-view.ts:14-19 and Plan 30-05 Task 2) to be byte-identical inline copies. After the Plan 30-05 mirror update they are not byte-identical:

`src/core/atlas-preview.ts:78-79`:
```typescript
  // The excluded set is now always empty — D-109 semantics are superseded by
  // Phase 24's orphanedFiles concept. Plan 02 will wire the new exclusion.
```

`src/renderer/src/lib/atlas-preview-view.ts:69-70`:
```typescript
  // excluded set now always empty; Plan 02 wires new exclusion surface.
```

The parity-grep test added in Plan 30-05 (`tests/core/atlas-preview.spec.ts:410-430`) only asserts the regex `/safetyBufferPercent\?\s*:\s*number/` matches in both files — it does not enforce comment parity, full-body parity, nor verbatim equality. The 5-case projection-equality test at line 431-466 is also loose (all cases use `safetyBufferPercent` undefined, so the buffer arithmetic short-circuits to no-op).

The plan claimed "byte-identical mirror" but only enforces "structurally similar mirror with identical packer construction and signature shapes." The comment divergence is benign behavior-wise but contradicts the contract.

**Fix:** Either (a) tighten the comment in `src/core/atlas-preview.ts:78-79` to byte-match the renderer copy, OR (b) revise the docblock at `atlas-preview-view.ts:14-19` to drop "byte-identical" and claim only "function-body-identical" (truth-in-advertising), OR (c) add a new parity test that diffs everything below the `===== BYTE-IDENTICAL =====` marker in atlas-preview-view.ts against the post-imports body of atlas-preview.ts and asserts equality. (c) is the most honest closure.

### WR-04: New AppShell useEffect causes a redundant `buildExportPlan` invocation on every Optimize dialog open

**File:** `src/renderer/src/components/AppShell.tsx:636-643, 954-961`
**Issue:** Sequence on dialog open:
1. User clicks Optimize → `onClickOptimize` callback fires.
2. `onClickOptimize` calls `buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal })` (line 639) → `setExportDialogState({ plan, outDir })` (line 642).
3. React re-renders. The boolean `exportDialogState !== null` flips false → true.
4. The new useEffect at line 954-961 fires (deps change). It calls `buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal })` AGAIN with identical inputs (line 956-958), then `setExportDialogState((prev) => ({ ...prev, plan: newPlan }))` (line 959).
5. React re-renders. The plan reference is replaced (with an identical-content plan), so any consumers re-memoize.

For a typical SIMPLE_TEST.json fixture this is sub-millisecond, but for a complex rig like `Girl/TOPSCREEN_ANIMATION_JOKER.json` (606 ms sampler) the build is heavier. More importantly, the redundant build creates a NEW plan reference that ripples through any downstream useMemo deps consuming `exportDialogState.plan`.

**Fix:** Two options:
1. **Skip the rebuild on initial open** by tracking whether the useEffect has already run for the current open: e.g. add a `useRef` keyed on the dialog session that gates the rebuild.
2. **Move the rebuild logic into `onClickOptimize`** — but then you need a parallel listener for buffer changes during the open session. The current useEffect-only approach is simpler; the redundancy is the price.

Honestly, INFO-level for v1 (out of perf scope). Logged as WARNING because it's a structural smell that future maintainers may copy.

### WR-05: Inherited `summary` vs `effectiveSummary` divergence — Optimize plan uses raw `summary` but AtlasPreviewModal + savings memo use `effectiveSummary`

**File:** `src/renderer/src/components/AppShell.tsx:639, 956, 861, 843, 2103`
**Issue:** Phase 30 closure introduced the new useEffect (line 956) and explicitly chose to use `summary` (raw prop) NOT `effectiveSummary` (post-resample localSummary override at line 275: `effectiveSummary = localSummary ?? summary`). The plan documents this rationale at AppShell.tsx:935-938 — "match `onClickOptimize` exactly". `onClickOptimize` at line 639 also uses raw `summary`.

But other adjacent memos diverge:
- `savingsPctMemo` (line 861) uses `effectiveSummary`.
- `atlasPreviewState` (line 843) uses `effectiveSummary`.
- `<AtlasPreviewModal summary={effectiveSummary}>` (line 2103) — the modal projects buffer-aware atlas preview using `effectiveSummary`.

After a sampling-rate change in Settings (which sets `localSummary`), the user gets:
- OptimizeDialog plan reflects PRE-RESAMPLE peaks (raw `summary`).
- AtlasPreviewModal page count + tile dims reflect POST-RESAMPLE peaks (`effectiveSummary`).
- HTML doc-export savings chip reflects POST-RESAMPLE peaks.
- Actual export pipeline (since `startExport(plan, ...)` consumes the OptimizeDialog plan) writes PRE-RESAMPLE peaks to disk.

So changing sampling rate, opening the modal, and clicking "→ Optimize Assets" cross-nav: the modal showed one set of dims; the export dialog shows DIFFERENT dims; the actual export uses the dialog's dims. Inconsistent user-facing semantics.

This is a PRE-EXISTING bug from `onClickOptimize`. Phase 30 closure adopted the same `summary` (not `effectiveSummary`) choice for the new useEffect, so it doubles down on the inconsistency rather than resolving it. The plan documents the choice as intentional but does not flag the inconsistency.

**Fix:** Decide which `summary` is the export-pipeline source of truth. If raw `summary`, then `savingsPctMemo`, `atlasPreviewState`, and the AtlasPreviewModal mount should also key off raw `summary` for consistency. If `effectiveSummary`, then `onClickOptimize` + new useEffect should switch to `effectiveSummary`. Out of Phase 30 scope to fix; flag for v1.3.2 polish.

---

## INFO Issues

### IN-01: `SafetyBufferSubSection` keeps unused `draft` and `onChange` parameters with `void` discard markers

**File:** `src/renderer/src/modals/DocumentationBuilderDialog.tsx:845-887`
**Issue:** The function still accepts `{ draft, onChange }` (lines 846-851) but body uses neither (lines 875-876: `void onChange; void draft;`). Reading the JSDoc (line 872-874), the section is now read-only "Moved to Optimize dialog" notice; the params should be removed both from the destructure AND the type. The single caller at line 650 still passes them.

**Fix:**
```typescript
function SafetyBufferSubSection() {
  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Safety Buffer</h3>
      <p className="text-xs text-fg-muted mb-3">
        Moved to Optimize dialog. Open <strong>File → Optimize Assets</strong> and
        set <strong>Quality → Safety buffer</strong> to control the percentage
        applied to all exports. The value entered there drives both the export
        math and this HTML report's "Optimization Config" card.
      </p>
    </section>
  );
}
```
Update caller at line 650 from `<SafetyBufferSubSection draft={draft} onChange={onChange} />` to `<SafetyBufferSubSection />`. Eliminates the `void` ceremony.

### IN-02: Defensive coerce in `renderOptimizationConfigCard` falls back to 0 silently — no log/notice when out-of-range value reaches main

**File:** `src/main/doc-export.ts:303-318`
**Issue:** The defensive coerce (lines 311-318) silently coerces non-integer / out-of-range / non-numeric `safetyBufferPercent` to 0. No log, no error envelope, no warning passed back. This mirrors the IPC-seam pattern at `project-io.ts:700-716`, but in this case the malformed value originates in the renderer, so a developer-facing console log would help diagnose IPC contract drift during dev/test.

**Fix:** Add a `console.warn` (or similar) when the coerce path fires:
```typescript
if (typeof safetyRaw === 'number' && (!Number.isInteger(safetyRaw) || safetyRaw < 0 || safetyRaw > 25)) {
  console.warn(`doc-export: safetyBufferPercent out of range (${safetyRaw}); coercing to 0`);
}
```
Optional. Bug is self-healing in production; helps debugging.

### IN-03: Phase 30 closure does not migrate or surface legacy `Documentation.safetyBufferPercent` value

**File:** `src/core/documentation.ts:65-66`, `src/renderer/src/modals/DocumentationBuilderDialog.tsx:845-887`
**Issue:** Per the Option C reconciliation (Plan 30-05 Decision), the legacy 0-100 `Documentation.safetyBufferPercent` field stays present in the type + serializer for backward-compat, but is now ignored by all UI surfaces and the export pipeline. A v1.2-era project saved with `documentation.safetyBufferPercent: 50` will:
- Round-trip through the .stmproj (legacy field preserved).
- NOT pre-fill the new `safetyBufferPercentLocal` slot (which inits to 0).
- NOT surface a notice that "the legacy 'Safety Buffer' field is no longer driving export math; please re-set in Optimize dialog".

The user has to discover this themselves. The "Moved to Optimize dialog" notice in `SafetyBufferSubSection` doesn't reference legacy values that may have been set.

This is the intentional Option C trade-off (cheaper than Option A's materialize-time migration). The verification report lists it as the cleanest end-state, but the user-facing UX could be tightened.

**Fix:** Add a one-time toast / notice when AppShell mounts a project where `documentation.safetyBufferPercent > 0` and `safetyBufferPercentLocal === 0`: "Detected legacy Safety Buffer value of N%. Set the new buffer in Optimize dialog → Quality → Safety buffer if you want to apply it to exports."

Pure-UX item; not technically a bug. Good v1.3.2 candidate.

### IN-04: `parseInt(e.target.value, 10)` clamp does not handle negative input from spinbutton

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:443-455`
**Issue:** The clamp `Math.max(0, Math.min(25, parsed))` correctly bounds final values, but `parseInt('-5', 10)` returns `-5`, which clamps to `0`. The HTML5 `<input type="number" min={0} max={25}>` may also let the user type `-5` directly (browser behavior depends on platform). Phase 30 plan documented integer-only [0, 25]. Current clamp handles it correctly via `Math.max(0, ...)`.

NIT: this works correctly today; just confirming the negative-path clamp is sound. Not a defect.

---

## Verified Behaviours (no findings)

- `bufferCapped` JSDoc rewrite at `src/shared/types.ts:399-426` matches the predicate at `src/core/export.ts:269-272`.
- `reloadProjectWithSkeleton` IPC type at `src/shared/types.ts:1205-1226` adds `loaderMode`, `sharpenOnExport`, `safetyBufferPercent` as optional fields; consumer at `src/main/project-io.ts:698-716` defensively coerces.
- `onClickLocateSkeleton` at `AppShell.tsx:1284-1315` threads all three new fields verbatim.
- `isDirty` untitled branch at `AppShell.tsx:889-918` correctly fires on non-default `safetyBufferPercentLocal` / `sharpenOnExportLocal` / `samplingHzLocal`.
- `Math.floor(parseInt(...))` cleanup at `OptimizeDialog.tsx:443-455` correctly removes the no-op.
- Defensive integer-range coerce at `doc-export.ts:311-318` rejects non-integer / out-of-range / non-numeric values.
- All 922 vitest tests pass; the new 3 tests in `tests/renderer/optimize-dialog-buffer.spec.tsx` GREEN; the new parity test in `tests/core/atlas-preview.spec.ts:410-430` GREEN; the doc-export fixture update at `tests/main/doc-export.spec.ts:178` GREEN.
- Layer 3 invariant preserved: `grep -rn "from 'sharp'" src/core/` returns 0; new `src/core/atlas-preview.ts` mirror does not import any DOM/electron/sharp surfaces.

---

_Reviewed: 2026-05-08T13:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
