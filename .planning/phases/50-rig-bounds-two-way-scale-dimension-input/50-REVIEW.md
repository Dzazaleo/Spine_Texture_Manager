---
phase: 50-rig-bounds-two-way-scale-dimension-input
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/core/setup-bounds.ts
  - src/main/summary.ts
  - src/renderer/src/modals/VariantDialog.tsx
  - src/renderer/src/modals/variant-scale-derive.ts
  - src/shared/types.ts
  - tests/arch.spec.ts
  - tests/core/documentation.spec.ts
  - tests/core/setup-bounds.spec.ts
  - tests/main/summary.spec.ts
  - tests/renderer/variant-dialog.spec.tsx
  - tests/renderer/variant-twoway.spec.ts
  - tests/renderer/variant-twoway.spec.tsx
  - tsconfig.node.json
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 50: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 50 adds (1) a Layer-3-pure `computeSetupPoseBounds` that computes the rig's
setup-pose all-skins world bbox via the dual-runtime adapter, (2) a new
`SkeletonSummary.bbox` field threaded through `buildSummary`, and (3) an enriched
two-way (factor ↔ px) Scale card in `VariantDialog` backed by three pure
derivation helpers. The core math reuses the proven `attachmentWorldAABB` +
REG-47-01-safe lifecycle (no hardcoded `new Skeleton`), the IPC field is
correctly `{w,h} | null` (structuredClone-safe), and the px↔s helpers honor the
"what you type is what you get" contract. The architecture-boundary and purity
tests are well-formed.

No correctness or security BLOCKERs were proven. However there are four WARNINGs
worth fixing before ship: a duplicated bbox computation in the main summary
build, a stale-summary wiring that makes the new px reference axes (and the
underlying export source) read the pre-resample summary, a silent
display/state divergence on the px fields when the input is cleared, and a
double-compute of `scaleInvalid` that masks the over-range path. Several Info
items cover dead imports, magic numbers, and a contract-comment drift.

## Warnings

### WR-01: `computeSetupPoseBounds` is computed twice per load — its own comment claims it reuses `rt`, but it re-materializes the skeleton

**File:** `src/main/summary.ts:544-548` and `src/core/setup-bounds.ts:53`
**Issue:** The summary.ts comment at line 544-547 explicitly states the bbox is
"computed ONCE here via the already-bound `rt` ... REUSE that adapter — do NOT
add a second makeSkeleton / raw ctor." But `buildSummary` already called
`rt.makeSkeleton(...)` at line 332 for the breakdown walk, and then calls
`computeSetupPoseBounds(load)` at line 548, which internally calls
`rt.makeSkeleton(skeletonData)` AGAIN (setup-bounds.ts:53) plus a full
`setupPoseSlots → setupPose → updateWorldTransform` lifecycle. So the rig is
materialized twice in one `buildSummary`. This contradicts the load-bearing
comment and the "Cheap (<1 ms on SIMPLE_TEST), runs once per load" rationale at
summary.ts:309-310. It is not a crash, but the comment is actively misleading
(a future maintainer will trust "reuse rt, one makeSkeleton" and be wrong) and
the second full transform pass is avoidable work on large rigs.
**Fix:** Either (a) correct the summary.ts comment to state that
`computeSetupPoseBounds` performs its OWN self-contained materialization
(it must, since it needs the setup-pose transform pass the breakdown skeleton
does not run), or (b) if a single pass is truly intended, pass the already-posed
`skeleton` handle into a variant of `computeSetupPoseBounds` rather than
re-materializing. Given the function is also unit-tested standalone, (a) is the
honest fix:
```ts
// Phase 50 SCALEUI-02 — setup-pose all-skins bbox. computeSetupPoseBounds
// performs its OWN REG-47-01-safe materialization + setup-pose transform pass
// (it cannot reuse the breakdown skeleton above — that one is never posed).
const bbox = computeSetupPoseBounds(load);
```

### WR-02: VariantDialog reads the stale `summary` prop, not `effectiveSummary` — bbox axes (and the actual export source) ignore a post-resample summary

**File:** `src/renderer/src/components/AppShell.tsx:2584` (consumed by `VariantDialog.tsx:137`, `198`)
**Issue:** Every other dialog/panel in AppShell is wired to `effectiveSummary`
(`localSummary ?? summary`, AppShell.tsx:283), where `localSummary` is the
freshly resampled summary after a source toggle (atlas ↔ atlas-less). VariantDialog
alone is wired to the raw `summary={summary}` prop. Phase 50 makes this
divergence newly load-bearing: `bbox` is part of the all-skins union, and the
atlas-less vs atlas-source attachment set can differ (atlas-less skips missing
PNGs), so the two summaries can carry different `bbox.w/h`. After a user toggles
the source and re-samples, the px Width/Height reference axes in VariantDialog
would still reflect the pre-toggle geometry. Worse, the same stale `props.summary`
is what gets sent to `window.api.exportVariant(props.summary, ...)`
(VariantDialog.tsx:198-208), so the variant export itself is built from the
stale peaks/regions, not the active resampled ones. The wiring predates Phase 50
(introduced in 49-02), but Phase 50 is the first phase to read geometry-bearing
data off it, which surfaces the bug.
**Fix:** Pass the active summary to VariantDialog, consistent with every sibling
dialog:
```tsx
<VariantDialog
  open={true}
  plan={variantDialogState.plan}
  summary={effectiveSummary}   // was: summary
  ...
```
Confirm `variantDialogState.plan` is likewise rebuilt from `effectiveSummary`
when a resample occurs, or the plan and summary will disagree.

### WR-03: Clearing a px field leaves the displayed raw text and the canonical `s` silently out of sync

**File:** `src/renderer/src/modals/VariantDialog.tsx:412-420, 457-465`
**Issue:** In the Width/Height `onChange`, the raw string is always committed to
`activePxRaw` (e.g. `setActivePxRaw(raw)`), but `props.onScaleChange(...)` is
only called when `Number.isFinite(parsed)` is true. If the user clears the field
(empty string) or types a non-numeric fragment (`"-"`, `"."`, `"1e"`), `parsed`
is `NaN`, so the field now displays the raw text (because `activePxField==='w'`
makes the controlled value render `activePxRaw`) while `props.scale` retains its
previous value. The factor field and the OTHER px field continue to show the
stale `s`, and the disabled/hint state of Export is driven by the stale `s`. The
two-way invariant ("factor/W/H are all views of the single s") is broken for the
duration of the partial/empty edit. This is a UX correctness defect, not a crash
(blur restores consistency via the empty `activePxRaw`).
**Fix:** When the parsed value is non-finite, fall back to a deterministic scale
(e.g. 0, mirroring the factor field's `onChange` which does
`onScaleChange(Number.isFinite(parsed) ? parsed : 0)`), so the views never
diverge:
```ts
onChange={(e) => {
  const raw = e.target.value;
  setActivePxField('w');
  setActivePxRaw(raw);
  const parsed = parseFloat(raw);
  if (bbox !== null && bbox.w > 0) {
    props.onScaleChange(Number.isFinite(parsed) ? scaleFromPx(parsed, bbox.w) : 0);
  }
}}
```

### WR-04: `scaleInvalid` and the `onStart` guard duplicate the same predicate — drift risk on a future range change

**File:** `src/renderer/src/modals/VariantDialog.tsx:127-128, 150-152`
**Issue:** The over-range/under-range predicate
`!Number.isFinite(props.scale) || props.scale <= 0 || props.scale >= 1` is
written twice: once as `scaleInvalid` (line 127-128, used to disable the button +
the Enter handler) and once inline in `onStart` (line 150-152). The two must stay
byte-identical or the keyboard/Enter path and the button-disable path will accept
different ranges. This is exactly the kind of duplicated invariant that drifts
when the valid range changes (e.g. if a future phase allows `s >= 1` for
upscaling). The `keyDown` handler at line 273 already correctly reuses
`scaleInvalid`; `onStart` should too.
**Fix:** Reuse the single source of truth:
```ts
const onStart = useCallback(async () => {
  if (scaleInvalid) return;   // was: re-inlined Number.isFinite(...) || ...
  ...
}, [props, scaleInvalid]);
```
(Add `scaleInvalid` to the dep array, or keep `[props]` and recompute — but do
not re-spell the predicate.)

## Info

### IN-01: Unused type import `ExportPlan` / `plan` prop is display-only and never read for geometry

**File:** `src/renderer/src/modals/VariantDialog.tsx:40, 56-57`
**Issue:** `plan: ExportPlan` is documented as "Display-only plan for the summary
tiles" but Phase 50's enriched card no longer renders any plan-derived tiles
(the bbox reference line + px fields are summary-driven). `props.plan` is now
referenced nowhere in the component body. If it is genuinely dead, the prop and
its `ExportPlan` import are dead code; if a Phase 51 tab will consume it, a
`// eslint-disable` or a TODO would document the intent.
**Fix:** Either remove the unused `plan` prop + `ExportPlan` import, or add a
one-line comment noting it is retained for the Phase-51 tabs.

### IN-02: Magic numbers in `displayFactor`/token rounding (`toFixed(4)`) duplicated across renderer + main with only a prose contract linking them

**File:** `src/renderer/src/modals/variant-scale-derive.ts:40` and `src/renderer/src/modals/VariantDialog.tsx:293`
**Issue:** The `Number(s.toFixed(4))` normalization is hand-copied in two
renderer locations (`displayFactor` and the inline `scaleToken` at
VariantDialog.tsx:293) and is contractually required to stay byte-identical to
`formatScaleToken` in `src/main/variant-export.ts`. The Layer-3 boundary
legitimately forbids importing the Node helper, but three independent copies of
the literal `4` is a drift hazard with no compile-time link. The
`variant-twoway.spec.ts` test pins the value, which mitigates this.
**Fix:** Have `VariantDialog.tsx:293` call the existing `displayFactor(props.scale)`
helper instead of re-spelling `String(Number(props.scale.toFixed(4)))`, removing
one of the three copies. (Note `String(displayFactor(s))` matches
`String(Number(s.toFixed(4)))`.)

### IN-03: Contract comment in `variant-scale-derive.ts` says callers "MUST guard `axis > 0`" but the helper does not — relies entirely on the caller

**File:** `src/renderer/src/modals/variant-scale-derive.ts:28-34`
**Issue:** `scaleFromPx` documents that callers must guard `axis > 0` (else
Infinity/NaN, threat T-50-FIN). The VariantDialog callers do guard
(`bbox !== null && bbox.w > 0`), and the bbox normalization at VariantDialog.tsx
139-145 makes a zero/non-finite axis impossible. So the contract holds today.
But the helper is a generic exported function with zero internal protection; any
future caller that forgets the guard reintroduces the non-finite hazard the rest
of the phase works hard to prevent. Low risk given current call sites.
**Fix (optional):** Make the helper self-defending so the invariant cannot be
violated regardless of caller discipline:
```ts
export const scaleFromPx = (px: number, axis: number): number =>
  axis > 0 ? px / axis : 0;
```
This keeps the test (`scaleFromPx(512, 2190) === 512 / 2190`) green while
removing the foot-gun.

### IN-04: `tsconfig.node.json` excludes `variant-twoway.spec.ts` from the node typecheck program — pure helpers lose static type coverage

**File:** `tsconfig.node.json:35`
**Issue:** `tests/renderer/variant-twoway.spec.ts` is a pure-helper spec (no DOM)
that imports the renderer-local `variant-scale-derive.ts`. It is excluded from
the node tsc program because that module is not in this program's `include`. The
exclusion is justified and consistent with the `dual-viewer-routing.spec.ts`
precedent, but the net effect is that the pure-helper unit test is type-checked
by neither the node program (excluded) nor the web program (renderer tests are
vitest-only). It still runs under vitest, so behavior is covered; only static
type errors in the spec itself would go unnoticed.
**Fix:** None required — documented and consistent with existing convention.
Noting for completeness so the coverage gap is a known, intentional one.

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
