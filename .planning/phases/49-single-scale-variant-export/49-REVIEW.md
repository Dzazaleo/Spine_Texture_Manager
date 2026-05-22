---
phase: 49-single-scale-variant-export
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - src/core/errors.ts
  - src/core/scale-summary-peaks.ts
  - src/main/ipc.ts
  - src/main/skeleton-json-writer.ts
  - src/main/variant-export.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/VariantDialog.tsx
  - src/shared/types.ts
  - tests/arch.spec.ts
  - tests/core/variant-sizing.spec.ts
  - tests/main/variant-dropin-faithful.spec.ts
  - tests/main/variant-package-layout.spec.ts
  - tests/main/variant-scale-guard.spec.ts
  - tests/main/variant-source-immutable.spec.ts
  - tests/renderer/variant-dialog.spec.tsx
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Phase 49: Code Review Report

**Reviewed:** 2026-05-22
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 49 adds a single-scale variant export feature: scale peak demands by `s` (0 < s < 1),
bake a scaled skeleton-JSON copy to disk (source never mutated), and reuse the existing
`buildExportPlan` + `runExport`/`runRepack` pipeline to produce a `{NAME}@{s}x/` drop-in package.

The core invariants are well-honored and well-tested: Layer-3 purity is enforced by new arch
anchors; `scaleSummaryPeaks` is a clean clone-first peak-only transform; `bake()` clones first so
the source object is structurally untouched; the source JSON sha256-immutability has a dedicated
test; the scale-direction guard lives at the edge (not in core); and the shared `written` rollback
Set correctly sweeps the baked JSON on a mid-export throw. The sizing semantics (`s × master_peak`
linear-on-scaled-peak) are correct and proven against the real sampler on both 4.2 and 4.3 rigs.

However, the **error/result surfacing in the variant flow is broken**: the `runExport`/`runRepack`
workers report per-file failures (overwrite collisions, missing sources, sharp errors) via a
`summary.errors[]` array WITHOUT throwing, and `VariantDialog` completely ignores that array. A
partial or even total failure is therefore presented to the user as a success ("Variant written —
0 files exported"), and the JSON is silently overwritten while the images are refused. This is the
BLOCKER below. Several robustness gaps (un-try/caught sizing call, no renderer await guard, missing
re-entrancy guard, float folder-token artifacts) compound it.

## Critical Issues

### CR-01: Variant export reports per-file failures as success — silent data loss / misleading result

**File:** `src/renderer/src/modals/VariantDialog.tsx:177-197, 476-489`
**Issue:**
`runExport` and `runRepack` do NOT throw on per-row failures — they push entries into
`summary.errors[]` and return a "successful" summary (see `src/main/image-worker.ts:177-192` overwrite
guard, and the `missing-source` / `sharp-error` / `overwrite-source` per-row arms). `handleExportVariant`
forwards that summary verbatim as `{ ok: true, summary }` (`src/main/variant-export.ts:216`).

`VariantDialog` decides success vs. failure SOLELY by `errorMessage === null`, which is only set on
`!response.ok`. It never inspects `response.summary.errors`. So when, e.g., the user re-exports a
variant into an existing `{NAME}@{s}x/` folder (the variant flow hardcodes `overwrite=false` in
`AppShell.onConfirmStartVariant:844`), every image row fails with `'overwrite-source'`, the worker
returns `successes: 0, errors: [...]`, and the dialog renders:

```
Variant written to SIMPLE_TEST@0.5x/ — 0 files exported.
```

with NO error displayed. Worse, `writeSkeletonJsonAtomic` overwrites `{NAME}.json` unconditionally
(no `allowOverwrite` gate — `src/main/skeleton-json-writer.ts:24-25`), so the JSON IS replaced while
the textures are silently refused, leaving a corrupt/mismatched package the user believes succeeded.

Compare `OptimizeDialog.tsx:1005, 1021-1024`, which renders `summary.successes` + `summary.errors.length`
("N succeeded, M failed") AND lists each `summary.errors` entry. The variant dialog dropped that
contract.

**Fix:** Surface `summary.errors` in the complete state, mirroring OptimizeDialog. At minimum, treat a
non-empty `errors` array as a (partial) failure:

```tsx
// in onStart, success branch:
if (response.ok) {
  setSummary(response.summary);
  setErrorMessage(
    response.summary.errors.length > 0
      ? `${response.summary.successes} exported, ${response.summary.errors.length} failed.`
      : null,
  );
}
// and in the complete-state body, render the per-row errors when present:
{summary.errors.length > 0 && (
  <ul className="...">{summary.errors.map((e, i) => <li key={i}>{e.path}: {e.message}</li>)}</ul>
)}
```
Additionally, decide the re-export-collision policy explicitly: either probe-then-confirm in the
variant path (drive `overwrite=true` after user consent) or make `writeSkeletonJsonAtomic` honor the
same `overwrite` gate as the workers so the JSON is not replaced when the images are refused.

## Warnings

### WR-01: `scaleSummaryPeaks` + `buildExportPlan` call sits OUTSIDE the try/catch — uncaught throw rejects the IPC promise

**File:** `src/main/variant-export.ts:123-126`
**Issue:**
The `readFile` (step 5) and `bake` (step 6) calls are individually try/caught and return clean
`{ ok: false }` envelopes. But `buildExportPlan(scaleSummaryPeaks(summary, s), ...)` at line 123 is
NOT inside any try/catch (the main `try` only begins at line 161). `scaleSummaryPeaks` iterates
`c.regions` and `c.peaks` unconditionally (`src/core/scale-summary-peaks.ts:23,28`); a malformed
summary (e.g. `regions` undefined) throws `TypeError: ... is not iterable`, and `buildExportPlan`
can throw on its own. Any such throw propagates out of `handleExportVariant` as a REJECTED promise
rather than the documented `ExportResponse` envelope, breaking the IPC contract that callers rely on.
**Fix:** Move the plan build inside the existing `try` (or wrap it in its own try/catch that returns
`{ ok: false, error: { kind: 'Unknown', message } }`), consistent with steps 5 and 6.

### WR-02: Renderer awaits `exportVariant` / `onConfirmStart` with no try/catch — a rejected IPC promise wedges the dialog in "in-progress" forever

**File:** `src/renderer/src/modals/VariantDialog.tsx:133, 166-176`
**Issue:**
`const response = await window.api.exportVariant(...)` (line 166) and
`const decision = await props.onConfirmStart()` (line 133) have no surrounding try/catch. After
`setState('in-progress')` (line 161), if the IPC promise rejects (see WR-01, or any unexpected main-side
throw), the `await` throws, `setState('complete')` (line 197) never runs, and the dialog is permanently
stuck on "Exporting…". ESC and click-outside are intentionally no-ops while in-progress
(`onCloseSafely:202`), so the user has no recovery short of killing the app.
**Fix:** Wrap the IPC awaits in try/catch and transition to the `complete` error state on rejection:

```tsx
try {
  const response = await window.api.exportVariant(/* ... */);
  /* ...existing handling... */
} catch (err) {
  setErrorMessage(err instanceof Error ? err.message : String(err));
  setState('complete');
}
```

### WR-03: `formatScaleToken(String(s))` emits float-artifact folder names (`@0.30000000000000004x`)

**File:** `src/main/variant-export.ts:49-51, 92`
**Issue:**
`formatScaleToken` is `String(s)`. The scale originates from a `<input type="number" step="0.05">`
(`VariantDialog.tsx:270-284`) whose native step-up accumulates IEEE-754 error: stepping to 0.15, 0.3,
0.35, 0.6, 0.7, 0.85, 0.95 yields values like `0.30000000000000004` and `0.6000000000000001` (verified).
`String()` of those produces folder names such as `SIMPLE_TEST@0.30000000000000004x/`, breaking the
clean `@{s}x` convention the phase advertises and the package-layout test asserts on (the test only
exercises `S = 0.5`, so it never catches this). The same artifact appears in the dialog's `folderHint`
(`VariantDialog.tsx:229`).
**Fix:** Normalize the token, e.g. trim to a sane precision and strip trailing zeros:
`return String(Number(s.toFixed(4)));` (so `0.30000000000000004 → '0.3'`). Apply the same normalization
to `folderHint` in the dialog (or have the dialog import/reuse the canonical helper).

### WR-04: Source-collision guard only inspects `plan.rows[0]` — bypassed when every row is a passthrough copy

**File:** `src/main/variant-export.ts:130-147`
**Issue:**
The "outDir IS the source images dir" guard is gated on `if (plan.rows.length > 0)` and reads only
`plan.rows[0].sourcePath`. But `buildExportPlan` puts each region into EITHER `rows` OR
`passthroughCopies` (`src/core/export.ts:452,454`). For a project where every region is a passthrough
copy (already at/below source dims), `plan.rows` is empty while `passthroughCopies` is non-empty, so the
collision guard is skipped entirely — yet `runExport` still writes the passthrough copies. The friendly
"pick a different folder" rejection never fires for that project shape (the per-row F_OK guard in
`runExport` is the only backstop, and only when `overwrite=false`).
**Fix:** Derive the collision check from `plan.rows[0] ?? plan.passthroughCopies[0]` (or iterate both),
matching the set of rows the workers actually write.

### WR-05: No re-entrancy guard on the variant export channel

**File:** `src/main/ipc.ts:1060-1091`, `src/main/variant-export.ts:53-64`
**Issue:**
`handleStartExport` claims a module-level `exportInFlight` slot to serialize exports
(`src/main/ipc.ts:763, 847`). `handleExportVariant` claims NO such slot, and the `variant:export`
handler doesn't either. Two concurrent variant exports (or a variant export concurrent with a regular
Optimize export) can run simultaneously, racing on the same `written` rollback Sets and potentially the
same output folder. The renderer modal serializes within a single dialog (the button disables to
"Exporting…"), but the main process has no defense if the renderer or a test/automation fires twice.
**Fix:** Either share the existing `exportInFlight` guard with the variant path, or add a dedicated
in-flight flag in `handleExportVariant`, returning `{ kind: 'already-running' }` on re-entry.

### WR-06: IPC boundary does not re-validate `safetyBufferPercent` / scale range that the renderer clamps

**File:** `src/main/ipc.ts:1089`, `src/main/variant-export.ts:62-69`
**Issue:**
The renderer clamps `safetyBufferPercent` to [0,25] (`VariantDialog.tsx:442`) and scale to (0,1), but
the `variant:export` handler only coerces `Number(safetyBufferPercent) || 0` with no upper bound, and
`handleExportVariant`'s scale guard rejects only NaN/<=0/>=1 (correct) while the buffer is passed through
to `buildExportPlan` unbounded. A misbehaving or compromised renderer (the documented trust boundary —
see `ipc.ts:30-32`) can send `safetyBufferPercent: 100000`. `buildExportPlan` caps export dims at source
dims so this won't upscale, but it violates the project's own "validate at the trust boundary" contract
that `validateExportOpts` enforces for the sibling `export:start` channel.
**Fix:** Clamp/validate `safetyBufferPercent` to the documented [0,25] integer range main-side (mirror
the renderer clamp) before calling `buildExportPlan`.

## Info

### IN-01: Default `effectiveOverrides` parameter is dead in practice

**File:** `src/main/variant-export.ts:62`
**Issue:** `handleExportVariant` declares `effectiveOverrides: ReadonlyMap<string, number> = new Map()`,
but the only caller (the `variant:export` IPC handler, `ipc.ts:1086-1088`) always passes a constructed
Map (or empty). The default is harmless but never exercised; it can lull future callers into thinking
overrides are optional when the IPC contract always supplies them.
**Fix:** Optional — keep for defense-in-depth, or drop the default to make the contract explicit.

### IN-02: `scaleSummaryPeaks` scales `peaks` (DisplayRow[]) that `buildExportPlan` never reads

**File:** `src/core/scale-summary-peaks.ts:28-32`
**Issue:** `buildExportPlan` sizes exclusively off `summary.regions` (`src/core/export.ts:219`). The
`peaks` (DisplayRow) array is scaled too but is unused downstream in the variant sizing path. It is not
incorrect (keeps the cloned summary internally consistent), just superfluous work — note it so a future
reader doesn't assume `peaks` feeds the plan.
**Fix:** None required; optionally add a one-line comment that `peaks` is scaled only for summary
consistency, not for sizing.

### IN-03: `parentDir` is trusted without absolute-path / traversal validation

**File:** `src/main/variant-export.ts:72-92`, `src/main/ipc.ts:1077`
**Issue:** `parentDir` (renderer-origin) is validated only for non-empty string, then joined directly
into `outDir`. The native folder picker always returns an absolute path, and `NAME` is sanitized via
`basename`, so the realistic attack surface is small — and this mirrors the pre-existing `handleStartExport`
trust of `outDir`. Flagged for parity awareness, not as a new regression: the variant path inherits the
same boundary posture as the shipped export path.
**Fix:** Optional — consider asserting `path.isAbsolute(parentDir)` for defense-in-depth, consistent with
any future hardening of `handleStartExport`'s `outDir`.

---

_Reviewed: 2026-05-22_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
