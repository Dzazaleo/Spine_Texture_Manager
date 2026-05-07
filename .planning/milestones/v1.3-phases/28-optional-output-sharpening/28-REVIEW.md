---
phase: 28-optional-output-sharpening
reviewed: 2026-05-06T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - src/shared/types.ts
  - src/core/project-file.ts
  - src/main/project-io.ts
  - src/main/ipc.ts
  - src/main/image-worker.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/OptimizeDialog.tsx
  - tests/core/project-file.spec.ts
  - tests/main/image-worker.sharpen.spec.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 28: Code Review Report

**Reviewed:** 2026-05-06
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 28 introduces an optional "Sharpen output on downscale" toggle that round-trips through the `.stmproj` schema, the IPC boundary, and the sharp pipeline. The mechanical plumbing follows the prior `loaderMode` and `samplingHz` precedents cleanly, the sharpen gate (`sharpenEnabled && effectiveScale < 1.0`) is correctly centralised in `applyResizeAndSharpen`, and both image-worker resize call sites collapse onto the helper as D-08 requires.

However, the test surface for this phase introduces NEW TypeScript compilation failures that did not exist before Phase 28 landed: making `sharpenOnExport` REQUIRED on `AppSessionState` / `ProjectFileV1` while leaving five pre-existing test fixtures un-updated breaks `tsc --noEmit -p tsconfig.node.json` with TS2741 errors that are NOT documented in `deferred-items.md` as pre-existing. A second NEW typecheck failure exists in the brand-new `tests/main/image-worker.sharpen.spec.ts` itself (missing `rotated` field on a synthesized `atlasSource`).

Findings below cover (a) the type-safety regressions, (b) a defensive-coding hole in the resample IPC envelope where `ResampleArgs` does not declare `sharpenOnExport` but `handleProjectResample` reads it anyway, and (c) several mid-severity correctness/quality concerns.

## Critical Issues

### CR-01: Phase 28 introduces NEW TypeScript build failures in pre-existing test files

**File:** `tests/core/project-file.spec.ts:115`, `:135`, `:164`, `:202`, `:261`, `:300`, `:355`
**File:** `tests/main/project-io.spec.ts:100` (not listed in scope, but transitively broken)

**Issue:**
Phase 28 added `sharpenOnExport: boolean` as a REQUIRED field on `AppSessionState` and `ProjectFileV1` (`src/shared/types.ts:811`, `:786`) but did NOT update the seven pre-existing `AppSessionState` / `ProjectFileV1` literal constructions in the test suite. Running `tsc --noEmit -p tsconfig.node.json` against the post-phase tree yields:

```
tests/core/project-file.spec.ts(115,11): error TS2741: Property 'sharpenOnExport' is missing in type '...' but required in type 'AppSessionState'.
tests/core/project-file.spec.ts(135,11): error TS2741: ...
tests/core/project-file.spec.ts(164,11): error TS2741: ...
tests/core/project-file.spec.ts(202,40): error TS2345: ... not assignable to parameter of type 'ProjectFileV1' (sharpenOnExport missing).
tests/core/project-file.spec.ts(261,11): error TS2741: ...
tests/core/project-file.spec.ts(300,11): error TS2741: ... ProjectFileV1.
tests/core/project-file.spec.ts(355,11): error TS2741: ...
tests/main/project-io.spec.ts(100,7): error TS2741: ...
```

These eight errors did NOT exist on the base commit (`67d04bfbb2309f151567ac52725a265711db4604^`); they were introduced when Phase 28 widened the type contract. The phase's `deferred-items.md` lists OptimizeDialog null-vs-string TS errors and AppShell `onClickOpen` TS6133 as pre-existing baseline failures, but DOES NOT list these eight TS2741 errors. They are net-new regressions that the phase was responsible for fixing.

The newly-added Phase 28 test cases at `:421` and `:441` correctly include `sharpenOnExport`, demonstrating the team understood the new contract — they simply forgot to backfill the existing fixtures.

**Fix:**
Add `sharpenOnExport: false` (or `: true` where intentional) to each pre-existing literal:

```typescript
// project-file.spec.ts:115, :135, :164, :261, :355 — AppSessionState literals
const state: AppSessionState = {
  // ... existing fields
  documentation: DEFAULT_DOCUMENTATION,
  loaderMode: 'auto',
  sharpenOnExport: false,  // <-- ADD
};

// project-file.spec.ts:202, :300 — ProjectFileV1 literals
const oldFile = {
  version: 1 as const,
  // ... existing fields
  loaderMode: 'auto' as const,
  sharpenOnExport: false,  // <-- ADD
};

// tests/main/project-io.spec.ts:100 — same shape
```

### CR-02: image-worker.sharpen.spec.ts has a TypeScript compile error in NEW code

**File:** `tests/main/image-worker.sharpen.spec.ts:110`

**Issue:**
The brand-new sharpen regression spec synthesises an `atlasSource` literal that omits the REQUIRED `rotated: boolean` field from `ExportRow.atlasSource`:

```typescript
row.atlasSource = { pagePath: srcPath, x: 0, y: 0, w: 64, h: 64 };
```

`tsc --noEmit -p tsconfig.node.json` reports:

```
tests/main/image-worker.sharpen.spec.ts(110,5): error TS2741: Property 'rotated' is missing in type '{ pagePath: string; x: number; y: number; w: number; h: number; }' but required in type '{ pagePath: string; x: number; y: number; w: number; h: number; rotated: boolean; }'.
```

At runtime the test happens to PASS because `image-worker.ts:401` checks `row.atlasSource.rotated === true`, and `undefined === true` is `false` — so the rotated-region rejection branch is correctly skipped. But the TypeScript compile failure is a regression introduced by Phase 28 in code Phase 28 authored, AND it weakens the test's coverage: a future drift that flips the rotated-region rejection logic to `=== false` (instead of `=== true`) would not be caught because `undefined === false` is also false.

This is the only direct type error in the Phase 28 review scope (the others in CR-01 are in pre-existing tests that Phase 28 should have updated alongside the type widening).

**Fix:**
```typescript
row.atlasSource = { pagePath: srcPath, x: 0, y: 0, w: 64, h: 64, rotated: false };
```

## Warnings

### WR-01: handleProjectResample reads `sharpenOnExport` from a field that ResampleArgs does not declare

**File:** `src/main/project-io.ts:1042`

**Issue:**
`handleProjectResample` defensively coerces `sharpenOnExport` from the IPC payload:

```typescript
sharpenOnExport:
  typeof a.sharpenOnExport === 'boolean' ? a.sharpenOnExport : false,
```

But `ResampleArgs` (`src/shared/types.ts:867-894`) does NOT declare a `sharpenOnExport` field. Both AppShell resample call sites (`runReload` at AppShell.tsx:912, the samplingHz `useEffect` at AppShell.tsx:1338) omit it. The defensive read therefore ALWAYS evaluates to `false` because the field is structurally absent.

The downstream effect is harmless TODAY because:
1. The renderer's `sharpenOnExportLocal` state is the source of truth
2. `runReload` and the resample effect do NOT call `mountOpenResponse`, so the materialized `sharpenOnExport: false` is silently discarded
3. `setSharpenOnExportLocal` is never re-set on resample

But the contract is misleading and brittle — anyone reading `MaterializedProject.sharpenOnExport: boolean` (REQUIRED) at the resample seam would expect it to round-trip the renderer's current value. As written, a future refactor that DOES route the resample materialised payload through `mountOpenResponse` would silently flip the toggle OFF.

**Fix:**
Either (a) add `sharpenOnExport?: boolean` to `ResampleArgs` and have AppShell thread `sharpenOnExportLocal` at both resample call sites, OR (b) document at the resample seam that `MaterializedProject.sharpenOnExport` is meaningless on the resample arm so consumers do not trust it. Option (a) is preferred for symmetry with Phase 21's `loaderMode` resample threading.

### WR-02: applyResizeAndSharpen accepts `effectiveScale: NaN` silently

**File:** `src/main/image-worker.ts:88-100`

**Issue:**
The sharpen gate is `sharpenEnabled && effectiveScale < 1.0`. For `effectiveScale = NaN`, `NaN < 1.0` evaluates to `false`, so sharpen is skipped — by accident, not by contract. Upstream `runExport` has a NaN/zero-dim guard at `image-worker.ts:433-445` that rejects rows with `!Number.isFinite(row.outW) || !Number.isFinite(row.outH)` BEFORE entering the helper, but it does NOT validate `row.effectiveScale`. A future code path that produces `outW/outH` from an integer source while leaving `effectiveScale` as `NaN` (e.g. a zero-source-pixel division) would produce non-sharpened output with no error, masking an upstream sampler bug.

This is defense-in-depth (the helper currently does the right thing for NaN), but the contract is implicit. Worth either widening the NaN guard to include `effectiveScale`, or adding a comment in the helper that `NaN < 1.0 === false` is the intended skip behavior.

**Fix:**
```typescript
// Option 1: extend the guard at image-worker.ts:433
if (
  !Number.isFinite(row.outW) || !Number.isFinite(row.outH) ||
  row.outW <= 0 || row.outH <= 0 ||
  !Number.isFinite(row.effectiveScale)  // <-- ADD
) {
  // ... reject as 'write-error'
}

// Option 2: explicit comment in applyResizeAndSharpen
if (sharpenEnabled && Number.isFinite(effectiveScale) && effectiveScale < 1.0) {
  p = p.sharpen({ sigma: SHARPEN_SIGMA });
}
```

### WR-03: OptimizeDialog passes `string | null` to APIs expecting `string`

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:230-235`, `:250-254`

**Issue:**
The phase's plan-28-01 SUMMARY and `deferred-items.md` correctly identify these as PRE-EXISTING TS errors, but Phase 28 added a 4th argument (`props.sharpenOnExport`) to the SAME `window.api.startExport(plan, resolvedOutDir, overwrite, props.sharpenOnExport)` call site at line 230-235 without addressing the type mismatch:

```typescript
const response: ExportResponse = await window.api.startExport(
  props.plan,
  resolvedOutDir,        // <-- string | null, but Api.startExport expects string
  overwrite,
  props.sharpenOnExport,
);
```

If `resolvedOutDir` is `null` at runtime, `handleStartExport` will reject with `'outDir must be a non-empty string'` — this is the round-trip already documented and protected. The pre-existing error count is 3 occurrences (line 232, 250, 254) per the deferred-items file, and Phase 28 left them at exactly 3 — but it also did NOT take the opportunity to fix them while the file was being touched, leaving the renderer's type contract in a broken state.

This is a quality issue rather than a hard bug: the runtime reject is graceful and AppShell's `onConfirmStart` always supplies an `outDir` before `proceed: true`. But the typecheck failure invisibly degrades the IDE's ability to detect a future regression.

**Fix:**
Either tighten `Api.startExport`'s `outDir` to `string | null` (matches preload coerce + main reject behaviour), OR add an early-return when `resolvedOutDir === null` before the IPC call. Mention that this was deferred to Phase 28+1 in the next phase's PLAN.md.

### WR-04: Sharpen toggle's checkbox `id`/`htmlFor` association missing for label

**File:** `src/renderer/src/modals/OptimizeDialog.tsx:393-402`

**Issue:**
The new sharpen checkbox uses an implicit `<label>` wrapper without an explicit `id`/`htmlFor` pairing or a screen-reader-accessible label:

```jsx
<label className="flex items-center gap-2 mb-4 text-xs text-fg cursor-pointer">
  <input
    type="checkbox"
    checked={props.sharpenOnExport}
    onChange={(e) => props.onSharpenChange(e.target.checked)}
    disabled={state === 'in-progress'}
    className="..."
  />
  Sharpen output on downscale
</label>
```

Implicit `<label>` wrapping technically works for screen readers, but the rest of the dialog's controls (e.g. focus trap, Tab cycle) operate on named buttons via `aria-modal` + role="dialog". The checkbox has no `id`, no `aria-describedby`, and no programmatic association to the dialog's title — keyboard users navigating via the Tab cycle hear "Sharpen output on downscale, checkbox" with no indication of state-conditional behavior (only fires when downscaling). Minor a11y polish opportunity.

**Fix:** Either add an explicit `id`/`htmlFor`:
```jsx
<input id="sharpen-toggle" type="checkbox" ... />
<label htmlFor="sharpen-toggle">Sharpen output on downscale</label>
```
…or wrap in a `<fieldset>` with a `<legend>` for the export-options grouping. Out of scope of strict correctness; not blocking.

## Info

### IN-01: Defensive `?? false` against a non-nullable boolean type

**File:** `src/renderer/src/components/AppShell.tsx:315`, `:360`, `:1058`, `:1079`
**File:** `src/main/project-io.ts:428`

**Issue:**
Multiple sites coerce `sharpenOnExport` with `?? false` when the typing already declares it as non-nullable `boolean`:

```typescript
// AppShell.tsx:315
const [sharpenOnExportLocal, setSharpenOnExportLocal] = useState<boolean>(
  () => initialProject?.sharpenOnExport ?? false,
);

// AppShell.tsx:360
sharpenOnExport: initialProject.sharpenOnExport ?? false,

// AppShell.tsx:1058
sharpenOnExport: project.sharpenOnExport ?? false,

// AppShell.tsx:1079
setSharpenOnExportLocal(project.sharpenOnExport ?? false);

// project-io.ts:428
sharpenOnExport: file.sharpenOnExport ?? false,
```

Once `MaterializedProject.sharpenOnExport: boolean` and `ProjectFileV1.sharpenOnExport: boolean` are committed (both REQUIRED, both non-optional), `?? false` is dead defense. The validator pre-massage already guarantees the field is present.

The `loaderMode ?? 'auto'` pattern at the same lines has the same property — it's a stylistic mirror, not a runtime defect. Leaving it is fine; just be aware these branches are unreachable per the type system.

**Fix:** Optionally drop the `?? false` to reduce noise, OR keep them with a comment that explains they are belt-and-suspenders for future code paths that bypass the validator. Either is acceptable.

### IN-02: Comment refers to "@ts-expect-error placeholder" that was removed

**File:** `src/main/ipc.ts` (no occurrence — but `28-01-PLAN.md` and `28-01-SUMMARY.md` reference it)

**Issue:**
Plan 28-01's tracking artifacts (`28-01-SUMMARY.md` line 31) and Plan 28-02's task list reference an `@ts-expect-error Phase 28-02` placeholder at the runExport call site. A grep across `src/` shows no such marker remains — Plan 28-02 successfully removed it. No code action needed; this is just an observation that the cleanup happened (good) and the planning docs could be retroactively updated for traceability. Out of code review scope; surface only as informational.

**Fix:** None required. Confirmed clean.

### IN-03: passthroughCopies row shape NOT validated by validateExportPlan

**File:** `src/main/ipc.ts:280-303`

**Issue:**
Pre-existing (NOT a Phase 28 regression), but worth surfacing while the file is in scope: `validateExportPlan` checks that `passthroughCopies` is an array (line 289) but does NOT validate per-row shape — only `plan.rows[i]` shapes are guarded at lines 290-302. A malformed `passthroughCopies[i]` from a compromised renderer would crash inside `image-worker.ts:172` (`row.sourcePath` access on undefined).

The `passthroughCopies` array is structurally similar to `rows` (per `ExportRow` type) but the validator was only extended for empty-array length-check at WR-005. If a future phase tightens the trust boundary, mirror the per-row loop:

```typescript
for (let i = 0; i < p.passthroughCopies.length; i++) {
  const r = p.passthroughCopies[i] as Record<string, unknown>;
  if (
    typeof r.sourcePath !== 'string' || r.sourcePath.length === 0 ||
    typeof r.outPath !== 'string' || r.outPath.length === 0 ||
    // ... etc
  ) {
    return `plan.passthroughCopies[${i}] has invalid shape`;
  }
}
```

Out of Phase 28 scope. Surface to a future hardening pass.

**Fix:** Defer to a follow-up trust-boundary-hardening phase.

---

_Reviewed: 2026-05-06_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
