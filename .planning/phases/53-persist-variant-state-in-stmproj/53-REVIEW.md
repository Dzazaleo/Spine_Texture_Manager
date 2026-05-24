---
phase: 53-persist-variant-state-in-stmproj
reviewed: 2026-05-24T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - src/shared/types.ts
  - src/core/project-file.ts
  - src/main/project-io.ts
  - src/renderer/src/components/AppShell.tsx
  - tests/core/project-file.spec.ts
  - tests/main/project-io.spec.ts
  - tests/core/project-file-loader-mode-heal.spec.ts
  - tests/renderer/save-load.spec.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 53: Code Review Report

**Reviewed:** 2026-05-24
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Phase 53 (SCALEUI-03) threads a new additive-optional `variantRows: { scale: number }[]`
field end-to-end: shared types → pure-core validator/serialize/materialize → main Open
assembly → renderer AppShell restore + dirty-tracking. The implementation is faithful to
the established additive-field idiom (mirrors `overridesAtlasLess`, `safetyBufferPercent`,
the Phase 40 atlas quartet) and the new validator branch correctly rejects NaN/Infinity/
non-array/missing-scale/string-scale. No schema version bump (D-05), no new `lastOutDir`
fs check (verified by the grep guard test), and Layer-3 purity is preserved (no
fs/electron/sharp/DOM imports added to `src/core/project-file.ts`).

I traced the four mount/restore seams (useState initializer, `mountOpenResponse`,
App.tsx remount-via-`loading`, resample useEffect) and the dirty derivation across the
untitled and loaded arms. The core round-trip and dirty logic are sound. The findings
below are robustness/consistency defects, not correctness blockers: a validator gap on
the per-row object value range, an asymmetric stale-key surface for the recovery/resample
deferral, and a divergent legacy-default handling between the two persistence layers.

No BLOCKER-class defects (no data loss, no crash, no security issue) were proven. The
deferred recovery/resample `variantRows` reset is explicitly acknowledged in-code as
"not an SC; acceptable," and I concur it is not a blocker — but it has a sharp edge worth
flagging (WR-01).

## Warnings

### WR-01: locate-skeleton recovery + resample silently reset variantRows to the default — but ONLY one path is reachable without data loss

**File:** `src/main/project-io.ts:1090` (recovery), `src/main/project-io.ts:1383` (resample)
**Issue:** Both `handleProjectReloadWithSkeleton` and `handleProjectResample` hard-code
`variantRows: [{ scale: 0.5 }]` in their returned `MaterializedProject`. The phase plan
deems this acceptable because:
- The **resample** seam is safe: `AppShell`'s resample `useEffect` (AppShell.tsx:1957-2059)
  inlines its own response handling and never calls `setVariantRows`, so the renderer's
  authored rows survive a resample/loaderMode toggle. Good.
- The **recovery** seam (`onClickLocateSkeleton`) routes the response through
  `mountOpenResponse`, which **does** call `setVariantRows(project.variantRows ?? …)`
  (AppShell.tsx:1724). So a successful locate-skeleton recovery **overwrites** the user's
  authored variant rows with `[{ scale: 0.5 }]`, discarding any multi-row set the user had
  configured before the failed Open.

This is a real (if narrow) data-loss-on-recovery path: user opens a project with
`[0.5, 0.36, 0.57]`, the skeleton is missing, they locate a replacement, and their variant
scale set is silently reset to a single `0.5` row. The in-code comment at
project-io.ts:1084-1089 acknowledges the reset but understates the consequence (it frames
it as "the dialog's rows reset," not "authored persisted state is discarded on the recovery
hop"). The cached recovery payload (`SerializableError.SkeletonNotFoundOnLoadError`) already
threads `mergedOverridesBuckets`, `samplingHz`, etc. — `variantRows` is the one restorable
field left off the recovery envelope.

**Fix:** Thread `variantRows` through the recovery envelope the same way `mergedOverridesBuckets`
is threaded, so the recovery hop round-trips the authored set:
```ts
// In SerializableError 'SkeletonNotFoundOnLoadError' arm (src/shared/types.ts):
variantRows?: { scale: number }[];

// In handleProjectOpenFromPath rescue branch (project-io.ts ~509):
variantRows: materialized.variantRows,

// In AppShell.onClickLocateSkeleton args + handleProjectReloadWithSkeleton:
// forward a.variantRows (coerced) into the returned MaterializedProject
// instead of the hard-coded [{ scale: 0.5 }] default at project-io.ts:1090.
```
If the team prefers to keep the deferral, at minimum sharpen the comment to state plainly
that authored rows are DISCARDED (not merely "reset") on the recovery hop, so a future
reader does not assume parity with the other recovery-threaded fields.

### WR-02: validator accepts any finite `scale` (including negative, zero, and ≥ 1) — diverges from the renderer's documented [0, 1) contract

**File:** `src/core/project-file.ts:392-400`
**Issue:** The new per-row guard only checks `typeof scale === 'number' && Number.isFinite(scale)`.
It accepts `scale: -3`, `scale: 0`, and `scale: 5`. But the variant feature's invariant
(VariantDialog factor input `min="0" max="0.9999"`, and `exportVariant`/D-08 which "rejects
s>=1 / NaN / <=0 with a typed VariantScaleError" per types.ts:1510) is that a variant scale
is in `(0, 1)`. A hand-edited or corrupted `.stmproj` with `"variantRows":[{"scale":2}]`
will validate clean, materialize, restore into the dialog, and surface a row the export path
will reject only at export time (or the dialog will clamp on next focus). This is a weaker
boundary than the sibling fields — `safetyBufferPercent` (range [0,25]) and `atlasPadding`
(range [0,16]) both enforce their domain at the validator.

This is not a crash or data-loss path (the export-side guard catches it), but it lets an
out-of-domain value persist and round-trip, which is exactly the class of "silently corrupt
serialized value" the NaN/Infinity rejection in the same loop was added to prevent.

**Fix:** Tighten the per-row guard to the feature's domain, matching the sibling integer-range
pattern:
```ts
const scale = (row as { scale: number }).scale;
if (
  !row || typeof row !== 'object' || Array.isArray(row)
  || typeof (row as { scale?: unknown }).scale !== 'number'
  || !Number.isFinite(scale)
  || scale <= 0 || scale >= 1
) {
  return { ok: false, error: { kind: 'invalid-shape',
    message: `variantRows[${i}].scale is not a finite number in (0, 1)` } };
}
```
Note: the existing test `validateProjectFile accepts an empty variantRows array` and the
`(0, 1)` factor tests would still pass; add a case for `scale >= 1` / `scale <= 0` rejection
to lock the tightened domain. (If the team intends to allow upscale variants in the future,
leave as-is but document the deliberate looseness — currently it is undocumented divergence.)

### WR-03: legacy-default value `[{ scale: 0.5 }]` is duplicated as a magic literal across 9 sites with no shared constant

**File:** `src/core/project-file.ts:387,483,674`; `src/main/project-io.ts:1090,1383`;
`src/renderer/src/components/AppShell.tsx:467,584,1676,1725`
**Issue:** The "default single 0.5 row" sentinel `[{ scale: 0.5 }]` (and the bare `0.5`
literal in the untitled dirty-check at AppShell.tsx:1250) is hand-copied at nine+ sites
across all three layers. The sibling fields avoid this by having a single validator default
and letting `?? default` fall through, but `variantRows`'s default is an object literal, so
each site re-spells it. A future change to the default (e.g. to `[]` or `[{ scale: 0.75 }]`)
must be made in lockstep at every site or the layers silently disagree — exactly the
"divergent default" failure mode that the dirty derivation depends on being identical
(if the validator default and the AppShell untitled-baseline `0.5` ever drift, a
freshly-opened legacy project could read as dirty-on-open, breaking SC#2/D-03).

The validator already accepts `[]` (test at project-file.spec.ts:818), so the system has
TWO legitimate "empty/default" representations (`[]` from the validator-accepts path and
`[{ scale: 0.5 }]` from the missing-field pre-massage), which the renderer then has to
re-default a third time — increasing the surface where they can diverge.

**Fix:** Extract a single exported constant and reference it everywhere:
```ts
// src/core/project-file.ts (or a shared constants module reachable by renderer via shared/types)
export const DEFAULT_VARIANT_ROWS: { scale: number }[] = [{ scale: 0.5 }];
```
Renderer sites import it (through the `shared/types` re-export boundary, mirroring how
`DEFAULT_DOCUMENTATION` is re-exported) so the untitled-dirty baseline, the useState seed,
the `mountOpenResponse` restore, and the serialize/materialize defaults all reference one
source of truth.

## Info

### IN-01: `serializeProjectFile` `?? []` for `variantRows` can write an empty array that the materializer/validator then re-defaults — asymmetric round-trip

**File:** `src/core/project-file.ts:483`
**Issue:** `serializeProjectFile` writes `variantRows: (state.variantRows ?? []).map(...)`.
If a caller hands in a state with `variantRows: undefined` (e.g. a `Partial` cast, which the
comment explicitly anticipates), the serialized file gets `"variantRows": []`. On reload the
validator accepts `[]` (project-file.spec.ts:818) and does NOT pre-massage it back to the
`[{ scale: 0.5 }]` default (the pre-massage only fires on `undefined`, not `[]`). So a
serialize→materialize round-trip of an undefined input yields `[]`, not the default — while
the materializer's own `?? [{ scale: 0.5 }]` at line 674 only triggers on `undefined`,
never on `[]`. The two defaults (`[]` at serialize vs `[{ scale: 0.5 }]` at materialize)
are inconsistent for the undefined-input edge.
**Fix:** Use the same default object in the serialize fallback so the round-trip is
idempotent: `(state.variantRows ?? DEFAULT_VARIANT_ROWS)` (see WR-03). In practice
AppShell always passes a non-empty array, so this is latent — flagged for consistency.

### IN-02: comment at `serializeProjectFile` overstates the spread's null-safety rationale

**File:** `src/core/project-file.ts:476-483`
**Issue:** The docblock says the `?? []` "mirrors the spread-tolerates-undefined behaviour
of the `overrides` / `overridesAtlasLess` fields above." But `overrides` uses `{ ...state.overrides }`
(object spread, which throws on `null` but tolerates `undefined`), whereas `variantRows`
uses `(state.variantRows ?? []).map(...)` (explicit nullish-coalesce because `.map` on
undefined throws). The two are not the same mechanism; the comment conflates them. Minor
doc-accuracy nit — no behavioral impact.
**Fix:** Reword to "explicit `?? []` because `.map` on undefined throws (object spread on
the sibling fields tolerates undefined differently)."

### IN-03: untitled-arm dirty check uses a bare `0.5` magic literal instead of comparing against the default-row set

**File:** `src/renderer/src/components/AppShell.tsx:1249-1251`
**Issue:** `if (variantScales.length !== 1 || variantScales[0] !== 0.5) return true;` hard-codes
`0.5` as the untitled clean-baseline. This is the third independent spelling of the default
(see WR-03). It is correct today, but it couples the untitled-dirty contract to the literal
`0.5` rather than to the shared default constant, so a default change must also update this
comparison or untitled sessions misreport dirtiness.
**Fix:** Compare against `DEFAULT_VARIANT_ROWS` (WR-03):
`const def = DEFAULT_VARIANT_ROWS; if (variantScales.length !== def.length || variantScales.some((s,i)=>s!==def[i].scale)) return true;`

### IN-04: dirty compare relies on exact float equality of scale projections — acceptable but undocumented fragility

**File:** `src/renderer/src/components/AppShell.tsx:1285-1289`
**Issue:** The loaded-arm dirty check uses `variantScales[i] !== lastSaved.variantScales[i]`
(strict `!==` on floats). Because both sides originate from the same JSON-round-tripped
numbers (load → `r.scale` → snapshot → compare), the values are bit-identical and the
compare is correct. However, when a user edits via the **px** field, the new scale is
`scaleFromPx(parsed, bbox.w)` (a division) — which is intended to mark dirty (an edit), so
the float-inexactness is harmless there too. The fragility is latent: if any future code
path re-derives a scale through arithmetic and expects "no change," exact `!==` would
false-dirty. This matches the established `overrides` compare idiom (also exact `!==`), so
it is consistent — flagged only so the float-exactness assumption is on record.
**Fix:** No change required. Optionally add a one-line comment noting the compare assumes
bit-identical round-tripped values (true for the load/save path; px-edits are intended
dirties).

---

_Reviewed: 2026-05-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
