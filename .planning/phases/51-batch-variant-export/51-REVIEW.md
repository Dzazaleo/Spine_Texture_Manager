---
phase: 51-batch-variant-export
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src/main/ipc.ts
  - src/main/variant-export.ts
  - src/preload/index.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/modals/VariantDialog.tsx
  - src/renderer/src/modals/variant-scale-derive.ts
  - src/shared/types.ts
  - tests/main/variant-batch-faithful.spec.ts
  - tests/renderer/variant-batch-dialog.spec.tsx
  - tests/renderer/variant-dialog.spec.tsx
  - tests/renderer/variant-twoway.spec.ts
  - tests/renderer/variant-twoway.spec.tsx
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 51: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 51 adds the batch variant-export engine (`handleExportVariantBatch` looping the
verbatim-extracted `exportOneVariant` body), a between-variants cancel flag, the
`variant:exportBatch` / `variant:cancelBatch` IPC channels, and a multi-row
`VariantDialog`. I reviewed it adversarially against the three stated project
constraints (Layer-3 purity, untrusted IPC coercion, non-shared per-variant rollback
Sets) plus general correctness/security.

The three headline constraints are met and provably so:
- **Per-variant rollback Sets are NOT shared** — `exportOneVariant` mints a fresh
  `const written = new Set()` per call (variant-export.ts:215). The continue-on-error
  test (variant-batch-faithful.spec.ts:245-285) empirically proves a failed variant
  does not delete earlier-landed folders. Correct.
- **Layer-3 purity holds** — `tokenFor` is correctly re-implemented renderer-local in
  variant-scale-derive.ts:49 and `VariantDialog` imports only react + shared/types +
  the local derive helpers. No `core/` or `variant-export` import in the renderer.
- **IPC coercion is present** — `variant:exportBatch` coerces `scales` to a finite
  number array, `parentDir` to string, rebuilds the overrides Map from entries
  (ipc.ts:1102-1133).

No BLOCKER-class defects (no data loss, no injection, no auth bypass, no crash that
escapes the IPC envelope). The findings below are correctness/robustness WARNINGs and
quality INFO items. The most consequential is the silent token-collapse of valid
sub-range scales (WR-01), which can land an entire scaled package in a misleadingly
named or wrong folder.

## Warnings

### WR-01: Valid in-range scales silently collapse to a misleading `@0x` / `@1x` folder token

**File:** `src/main/variant-export.ts:58-60` (and `src/renderer/src/modals/variant-scale-derive.ts:40,49`)
**Issue:** `formatScaleToken(s) = String(Number(s.toFixed(4)))` rounds to 4 decimals.
The guard in `exportOneVariant` accepts any `s` with `0 < s < 1` (variant-export.ts:96).
But a valid scale like `s = 0.000049` rounds to token `'0'`, and `s = 0.99999` rounds to
token `'1'`. Verified:
```
formatScaleToken(0.00001)  -> "0"
formatScaleToken(0.99999)  -> "1"
```
Both pass the renderer D-11 gate (`s <= 0 || s >= 1`, VariantDialog.tsx:184) AND the
main guard (`s <= 0 || s >= 1`, variant-export.ts:96), so the export proceeds and writes
a package into `{NAME}@0x/` or `{NAME}@1x/`. `@0x` reads as a degenerate/zero export and
`@1x` reads as a no-op full-size export — neither matches the actual baked geometry
(which used the exact unrounded `s`). The on-disk folder name no longer identifies the
variant it contains. This is a real divergence between the canonical `s` (used for
baking) and the token (used for the directory name and all UI labels).
**Fix:** Reject (or clamp-and-warn) at the guard when the rounded token does not faithfully
represent the scale, e.g. add to `exportOneVariant`'s step-1 guard:
```ts
const token = formatScaleToken(s);
if (token === '0' || token === '1') {
  return { ok: false, error: { kind: 'Unknown',
    message: `Scale ${s} rounds to a degenerate folder token @${token}x; choose a scale in [0.0001, 0.9999].` } };
}
```
Mirror the same check in the renderer `isRowInvalid` so the row is flagged before submit.

### WR-02: Batch duplicate-token check uses the wrong precedence — invalid rows are never reached, but two valid sub-range scales rounding to the same token fail the WHOLE batch

**File:** `src/main/variant-export.ts:382-396`
**Issue:** The dedup gate runs FIRST (before the `variantExportInFlight` check and before
any per-scale validity check) and, on ANY collision, marks **every** scale `'failed'` and
returns. Combined with WR-01, two distinct valid scales that both round to `'0'` (e.g.
`0.00001` and `0.00002`) are reported as a duplicate-token collision and the entire batch
is rejected — even though the user typed two legitimately different factors. Verified the
collision is detected (`["0", 2]`). The user gets `Duplicate scale token @0x` for inputs
that are not visibly duplicates. This is a confusing failure mode that stems directly from
the lossy token (WR-01); fixing WR-01 (rejecting `@0x`/`@1x` per-row) removes this corner,
but the dedup-kills-whole-batch design also means one fat-fingered duplicate aborts an
otherwise-valid 10-scale run with no partial progress.
**Fix:** After fixing WR-01, additionally consider making the dedup gate mark only the
*colliding* rows `'failed'` and still run the non-colliding scales (continue-on-error
parity with D-07), rather than failing the entire batch:
```ts
const dupTokens = new Set([...seen.entries()].filter(([, n]) => n > 1).map(([t]) => t));
// ... in the loop, skip+record only when dupTokens.has(formatScaleToken(scales[i]))
```
At minimum, document that one duplicate aborts the full batch so the renderer copy can warn.

### WR-03: Rollback sweep leaves an orphan empty `{NAME}@{s}x/` directory on failure

**File:** `src/main/variant-export.ts:215, 285-292` + `src/main/skeleton-json-writer.ts:42-46`
**Issue:** The rollback contract (EXPORT-02 / "NO orphan files left after a failed export")
sweeps every path in the `written` Set with `fsRm(p, { force: true })`. But `written` only
ever holds *file* paths (`.tmp`, final JSON, worker artifacts). `writeSkeletonJsonAtomic`
calls `mkdir(dirname(finalPath), { recursive: true })` (skeleton-json-writer.ts:44) which
creates the `{NAME}@{s}x/` directory, and that directory path is never added to `written`.
On a mid-export throw, all files are removed but the empty variant directory survives. The
continue-on-error test even encodes this tolerance (`if (fs.existsSync(folder))` guard at
variant-batch-faithful.spec.ts:278) rather than asserting the folder is gone. The
acceptance language is "no orphan *files*", so this is not a contract violation, but an
empty `{NAME}@0.36x/` left behind after a failed atlas export is user-visible cruft that
a subsequent `overwrite=false` re-export will sit inside.
**Fix:** Track whether the directory was freshly created and rmdir it in the catch when it
ends up empty, or have the rollback attempt `fsRm(outDir, { recursive: true, force: true })`
*only when it is empty after the file sweep*:
```ts
for (const p of written) await fsRm(p, { force: true }).catch(() => {});
try { if ((await readdir(outDir)).length === 0) await fsRm(outDir, { recursive: true, force: true }); } catch {}
```

### WR-04: `Number(safetyBufferPercent) || 0` at the IPC boundary mis-coerces a legitimately-zero NaN path and silently drops fractional buffers

**File:** `src/main/ipc.ts:1131` (and the sibling single-variant path at ipc.ts:1093)
**Issue:** The batch handler coerces `safetyBufferPercent` via `Number(safetyBufferPercent) || 0`.
`Number('abc') || 0` → `0` (fine), but the `|| 0` idiom also turns a legitimate `0` into `0`
(fine) — the real problem is it is the *only* boundary coercion, and the documented contract
says the value is "re-clamped per-variant inside the body" (ipc.ts:1101). The body clamp
(`exportOneVariant` step 2b, variant-export.ts:116-118) does `Math.trunc` + clamp `[0,25]`,
so fractional buffers (e.g. `12.5`) are silently floored to `12`. That truncation is
undocumented at the renderer (the dialog `step={1}` discourages it, VariantDialog.tsx:705,
but a compromised/older renderer can send `12.5`). Not a security issue (clamped), but the
double-coercion (`|| 0` here, `Math.trunc` there) is inconsistent with the sibling
`export:start` channel which validates-and-rejects wrong values via `validateExportOpts`
rather than silently coercing. The asymmetry is a maintainability trap.
**Fix:** Drop the `|| 0` (it is redundant with the body's `Number.isFinite` guard) and rely
on the single canonical clamp in `exportOneVariant`, or document explicitly that the variant
channels coerce-and-clamp (vs. `export:start`'s validate-and-reject) so the divergence is intentional.

### WR-05: In-progress Cancel button is enabled before the first progress event, but cancelling then has no observable effect and the UI gives no feedback

**File:** `src/renderer/src/modals/VariantDialog.tsx:848-858`
**Issue:** While `state === 'in-progress'` and before the first `variant:batch-progress`
event arrives (`progress === null`), the Cancel button is **enabled** (the disabled
predicate is `progress !== null && progress.variantIndex === progress.variantTotal - 1`,
which is `false` when `progress === null`). Clicking it fires `cancelVariantBatch()`, which
sets `variantBatchCancelRequested = true`. But the main loop checks that flag at the **top**
of each iteration (variant-export.ts:413) — the in-flight variant 0 always completes, and if
the batch is a single scale, the flag is read once at i=0 *before* it could have been set,
so a 1-scale "cancel" does nothing and the button gives no visual acknowledgement (no
disabled state, no "cancelling…" copy). The user can click Cancel repeatedly with zero
feedback. Functionally safe (D-09 is between-variants only by design), but the affordance
misrepresents what it does.
**Fix:** After a click, set a local `cancelRequested` state and swap the button label to
"Cancelling after current…" + disable it, so the user understands the in-flight variant
will finish. Optionally disable Cancel entirely on a 1-scale run (`progress?.variantTotal === 1`),
since there is nothing to skip.

## Info

### IN-01: `formatScaleToken` / `tokenFor` duplication is a documented-but-fragile two-source invariant

**File:** `src/main/variant-export.ts:58-60` and `src/renderer/src/modals/variant-scale-derive.ts:40,49`
**Issue:** The renderer `tokenFor` (`String(displayFactor(s))`) and main `formatScaleToken`
(`String(Number(s.toFixed(4)))`) must stay byte-identical for the folder hint to match the
on-disk folder. They are kept in sync only by comment ("byte-identical to main's
formatScaleToken"). There is no test asserting `tokenFor(x) === formatScaleToken(x)` across a
shared sample set — the renderer test (variant-twoway.spec.ts:68-73) tests `tokenFor` alone,
the main test tests `formatScaleToken` alone. A future edit to one (e.g. switching to 5
decimals) silently diverges the UI hint from reality.
**Fix:** Add a cross-boundary equivalence test that imports both and asserts equality over a
sample array, OR (preferred) factor the 1-liner into a shared structuredClone-safe pure helper
both layers import (the math has no Node dependency, so it can live in shared/).

### IN-02: `displayFactor` advisory `max="0.99"` on the factor input does not match the actual valid range

**File:** `src/renderer/src/modals/VariantDialog.tsx:409`
**Issue:** The factor input declares `max="0.99"` but the validity gate accepts `s < 1`
(so `0.995` is valid). The HTML `max` attribute is advisory for `type="number"` typed input
(it does not block typing), so this is purely a UX inconsistency — the spinner caps at 0.99
while typed `0.995` is accepted. Harmless but confusing.
**Fix:** Set `max="0.9999"` (or remove `max`) to match the real accepted range, and the
`step="0.05"` likewise will overshoot near the boundary.

### IN-03: Dialog summary tile (`plan` prop) is built master-sized and never reflects the per-row scales

**File:** `src/renderer/src/modals/VariantDialog.tsx:74-75` + `src/renderer/src/components/AppShell.tsx:818-822`
**Issue:** `VariantDialog` receives a `plan` prop documented as "display-only plan for the
summary tiles (master-sized)", but the multi-row dialog body never renders any tile derived
from `plan` — the prop is effectively dead in the 51 dialog (the only sizing surface is the
per-row px hint computed from `summary.bbox`). AppShell still calls `buildExportPlan` on every
`onClickExportVariant` (AppShell.tsx:818) to populate it. This is dead computation + a dead
prop carried from the Phase-49 single-pane design.
**Fix:** If no tile consumes `plan`, drop the prop from `VariantDialogProps` and the
`buildExportPlan` call in `onClickExportVariant` (the main side rebuilds the s-scaled plan
itself anyway, per Plan-01). If a future tile will use it, leave a TODO referencing the intent.

### IN-04: `onStart` `useCallback` deps include the whole `props` object, defeating memoization

**File:** `src/renderer/src/modals/VariantDialog.tsx:298`
**Issue:** `onStart`'s dependency array is `[props, startDisabled]`. `props` is a fresh object
reference every parent render (AppShell passes inline closures/objects), so `onStart` is
re-created on every render — the `useCallback` provides no stabilization. Not a correctness
bug (the handler reads the latest props, which is what we want), but the `useCallback` wrapper
is misleading dead ceremony.
**Fix:** Either depend on the specific primitives/callbacks actually read
(`props.onConfirmStart`, `props.outDir`, `props.summary`, `props.rows`, …) or drop the
`useCallback` and use a plain function, documenting that it intentionally closes over latest props.

---

## Resolution (post-review, 2026-05-23 — commit `1c68cb8`)

Fixed immediately after the user's live UAT (alongside the two user-flagged UX
items), with a new regression test:

- **WR-01 — FIXED.** `exportOneVariant` now rejects a valid 0<s<1 scale whose 4dp
  token collapses to `@0x`/`@1x` (step-1b guard); renderer `isRowInvalid` mirrors
  it (row flagged pre-submit with a clearer hint). Locked by
  `tests/main/variant-scale-guard.spec.ts` (degenerate-token cases + no-folder-written).
- **WR-05 — FIXED.** Cancel latches ("Cancelling after current…" + disabled) and is
  disabled on a 1-scale run, on the last variant, and before the first progress event.
- **IN-02 — FIXED.** Factor input `max` 0.99 → 0.9999 (matches the real accepted range).

Deferred to v1.8 (tracked in PROJECT.md → Next Milestone): **WR-02** (dedup aborts
the whole batch — make it continue-on-error parity), **WR-03** (orphan empty variant
dir on failure), **WR-04** (variant-channel coerce-and-clamp vs `export:start`
validate-and-reject), **IN-01** (no cross-boundary `tokenFor`≡`formatScaleToken`
test), **IN-03** (dead `plan` prop + `buildExportPlan` call), **IN-04** (`onStart`
useCallback deps).

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
