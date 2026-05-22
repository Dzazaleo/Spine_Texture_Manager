---
phase: 50-rig-bounds-two-way-scale-dimension-input
verified: 2026-05-23T01:00:00Z
status: human_needed
score: 2/2 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Open a 4.2 AND a 4.3 project in `npm run dev`, open 'Export Variant…', and read the enriched Scale card"
    expected: "The 'Setup-pose size: W × H px' reference line shows a sane rig size for each runtime; the three coupled fields (Factor / Width / Height) are legible and aspect-locked; typing a factor visibly moves both px fields; typing a target Width (e.g. 512) makes Height follow aspect-locked and the typed value does not drift; typing a value ≥ bbox disables Export with the inline 'scaled-down' hint; a geometry-less rig shows 'unavailable (no textured geometry)' with the factor field still usable"
    why_human: "jsdom cannot compute Tailwind layout/spacing or visual legibility/feel (feedback_layout_bugs_request_screenshots_early). The headless layer V1-V12 proves the binding math, the dual-runtime bbox, the summary seam, Layer-3 purity and the full two-way state machine; only the rendered visual control is human-only. Avoid the opened≠rendered trap (feedback_uat_opened_is_not_rendered) — the criterion is the rendered, correctly-coupled control. Record in 50-HUMAN-UAT.md."
---

# Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input Verification Report

**Phase Goal:** Give the animator an intuitive way to choose a scale — anchor it to the rig's overall setup-pose bounding box and let them enter either a factor or a target pixel dimension and see the other.
**Verified:** 2026-05-23T01:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| SC-1 | The user can specify a variant scale either as a factor or as a target dimension in pixels; entering one displays the corresponding other value (two-way binding). (SCALEUI-01) | ✓ VERIFIED | Three coupled inputs in `VariantDialog.tsx:352-471` (Factor / Width / Height), all views of the single canonical `s` (`props.scale`). Editing a px field calls `scaleFromPx(parsed, axis)` → `onScaleChange(s)` (lines 418, 463); px fields are derived via `pxFromScale(props.scale, axis)` (lines 400, 445); the factor field shows `displayFactor(props.scale)` (line 364). V9 (jsdom) asserts the px fields render `1095`/`924` from `s=0.5`, editing W→`512` fires `onScaleChange(512/2190)`, editing factor→`0.25` fires `onScaleChange(0.25)`. V10 asserts no-drift (typed `512` stays `512` while focused). V8 pins the exact helper math. All PASS in live run. The canonical `s` round-trips through AppShell `variantScale`/`setVariantScale` (AppShell.tsx:564,2586-2587) and is the export source. |
| SC-2 | The dimension reference shown to the user is the rig's overall setup-pose bounding box (W×H px), computed for both 4.2 and 4.3 rigs. (SCALEUI-02) | ✓ VERIFIED | `computeSetupPoseBounds(load)` (`src/core/setup-bounds.ts:42-89`) computes the all-skins setup-pose world-AABB union via the dual-runtime adapter (`rt.makeSkeleton` → setupPose → `updateWorldTransform('pose')` → union of `attachmentWorldAABB`). Surfaced as additive `SkeletonSummary.bbox: {w,h}|null` (`types.ts:812`), populated once in `buildSummary` (`summary.ts:548,562`), ferried over the existing IPC summary, read by the dialog as `props.summary.bbox` (`VariantDialog.tsx:137`) and displayed as `Setup-pose size: {w} × {h} px` (line 347-349). V1 (4.2 finite), V2 (4.3 finite, no cross-runtime crash), V3 (cross-check ≈ editor header ~1% on SIMPLE_TEST = real 2190×1847), V4 (all-skins envelope ≥ subset on 4.3 skeleton2), V6 (finite-or-null + structuredClone-safe). All PASS in live run. |

**Score:** 2/2 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/setup-bounds.ts` | `computeSetupPoseBounds(load): {w,h}\|null`, Layer-3 pure, all-skins union, degenerate→null | ✓ VERIFIED | 89 lines, exact signature, `rt.makeSkeleton` (no raw ctor), `rt.skins`/`rt.skinEntries` all-skins union, `if (measured === 0) return null` degenerate guard, reuses `attachmentWorldAABB`. No sharp/node:fs/electron import. Wired into summary.ts. |
| `src/shared/types.ts` | `SkeletonSummary.bbox: {w,h}\|null` additive field | ✓ VERIFIED | Declared at line 812 as sibling to `runtimeTag`, with doc-comment. |
| `src/main/summary.ts` | `buildSummary` computes bbox once via `computeSetupPoseBounds` and returns it | ✓ VERIFIED | Import (line 40), call (line 548), returned in object (line 562). |
| `src/renderer/src/modals/variant-scale-derive.ts` | pure helpers `pxFromScale`/`scaleFromPx`/`displayFactor`, no core import | ✓ VERIFIED | All three exported with exact bodies; `scaleFromPx = px / axis` (exact, no snap); no core/ or formatScaleToken import (Layer-3 clean). |
| `src/renderer/src/modals/VariantDialog.tsx` | enriched Scale card: bbox reference line + 3 coupled aspect-locked inputs | ✓ VERIFIED | Lines 340-478: bbox reference line + Factor/Width/Height fields; reads `props.summary.bbox`; writes `s` via `onScaleChange`; `activePxField`/`activePxRaw` no-drift state; degenerate `bbox===null` disables px fields; over-range reuses `scaleInvalid`→Export disabled (line 712); no tabs (D-09). |
| `tests/core/setup-bounds.spec.ts` | V1-V5 dual-runtime union, oracle, envelope, degenerate | ✓ VERIFIED | 5 tests, all PASS. |
| `tests/main/summary.spec.ts` | V6 bbox finite-or-null + structuredClone-safe | ✓ VERIFIED | Extended (lines 155-175), PASS. |
| `tests/arch.spec.ts` | V7 named Layer-3 anchor for setup-bounds.ts | ✓ VERIFIED | Named describe block (line 402), content-grep, range-free. |
| `tests/renderer/variant-twoway.spec.ts` | V8 pure-helper unit tests | ✓ VERIFIED | 3 tests, all PASS. |
| `tests/renderer/variant-twoway.spec.tsx` | V9-V12 jsdom component tests | ✓ VERIFIED | 4 tests (two-way / no-drift / over-range / no-geometry), all PASS. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `summary.ts` | `core/setup-bounds.ts` | `import + computeSetupPoseBounds(load)` | ✓ WIRED | Import line 40, call line 548. |
| `core/setup-bounds.ts` | `load.runtime` | `rt.makeSkeleton → setupPose → updateWorldTransform('pose')` | ✓ WIRED | Lines 53-56 — REG-47-01-safe lifecycle via adapter, loud null-guard. |
| `core/setup-bounds.ts` | `core/bounds.ts attachmentWorldAABB` | per-attachment AABB fold | ✓ WIRED | Imported (line 28), called line 73. |
| `VariantDialog.tsx` | `props.summary.bbox` | reads precomputed reference axes | ✓ WIRED | Line 137 `const rawBbox = props.summary.bbox`. |
| `VariantDialog.tsx` | `variant-scale-derive.ts` | `scaleFromPx(px, axis) → onScaleChange(s)` | ✓ WIRED | Import line 46; px onChange lines 418, 463. |
| `VariantDialog.tsx` | `props.onScaleChange` | every field edit writes canonical s | ✓ WIRED | Lines 371 (factor), 418 (W), 463 (H). |
| AppShell → VariantDialog | `summary={summary}` | bbox reaches dialog with zero new wiring | ⚠️ WIRED (raw `summary`, not `effectiveSummary`) | AppShell.tsx:2584 passes raw `summary` — intentional, consistent with the established export-pipeline convention (AppShell.tsx:1239-1242 / `onClickOptimize`). See WR-02 below — a known post-resample edge case, not goal-blocking. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `VariantDialog.tsx` bbox reference line | `props.summary.bbox` | `buildSummary` → `computeSetupPoseBounds(load)` → real world-AABB union | ✓ Yes — V3 confirms 2190×1847 on SIMPLE_TEST (real geometry, not hardcoded/empty) | ✓ FLOWING |
| `VariantDialog.tsx` px fields | `props.scale` (canonical s) | AppShell `variantScale` state, written by `onScaleChange`/`setVariantScale` | ✓ Yes — round-trips; V9 confirms render+react | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| All V1-V12 phase-50 tests | `npx vitest run` (6 phase-50 suites) | 44 passed / 44 | ✓ PASS |
| Full suite (regression — bbox now required field) | `npx vitest run` | 150 files, 1509 passed, 5 skipped, 2 todo, 0 failed | ✓ PASS |
| Node typecheck | `npm run typecheck:node` | RC 0, no errors | ✓ PASS |
| Web typecheck | `npm run typecheck:web` | RC 0, no errors | ✓ PASS |
| Layer-3 purity (renderer ↛ core, setup-bounds ↛ sharp/fs/electron) | grep | no forbidden imports | ✓ PASS |
| D-09 no-tabs | grep for tab elements | only a comment match | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SCALEUI-01 | 50-02 (`requirements: [SCALEUI-01]`) | Specify scale as factor OR target px; entering one displays the other | ✓ SATISFIED | Two-way control verified (SC-1); V8-V12 green. |
| SCALEUI-02 | 50-01 (`requirements: [SCALEUI-02]`) | Dimension reference = rig's setup-pose bbox (W×H px), 4.2 + 4.3 | ✓ SATISFIED | `computeSetupPoseBounds` + `SkeletonSummary.bbox` + reference line verified (SC-2); V1-V7 green. |

No orphaned requirements: REQUIREMENTS.md maps exactly SCALEUI-01 and SCALEUI-02 to Phase 50; both are claimed by a plan frontmatter. EXPORT-04 is mapped to Phase 51 (not this phase).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/main/summary.ts` | 544-548 | Comment claims "computed ONCE via the already-bound rt / do NOT add a second makeSkeleton" but `computeSetupPoseBounds` self-materializes (rig posed twice per `buildSummary`) | ℹ️ Info (WR-01) | Comment is misleading; not a behavioral defect — bbox is correct (V6). Second pass is avoidable work on large rigs but cheap (<1ms on SIMPLE_TEST). |
| `src/renderer/src/modals/VariantDialog.tsx` | 412-420, 457-465 | Clearing a px field commits raw text to `activePxRaw` but does not update `s` when `parsed` is NaN → transient display/`s` desync during partial edit | ⚠️ Warning (WR-03) | Transient only; restored on blur. Does NOT affect the happy-path two-way binding (V9/V10 green). Polish item, not goal-blocking. |
| `src/renderer/src/components/AppShell.tsx` | 2584 | VariantDialog wired to raw `summary`, not `effectiveSummary`; after an atlas↔atlas-less source toggle the bbox axes (and the export source) reflect pre-resample geometry | ⚠️ Warning (WR-02) | Pre-existing wiring (49-02), intentional per AppShell.tsx:1239-1242 (export pipeline reads raw `summary` by design). Phase 50 is the first to read geometry off it. Edge case (source toggle), not the core goal. Recommend confirming with the developer. |

### Human Verification Required

The phase ships a UI control whose visual legibility/feel is the one criterion automated coverage cannot prove (jsdom cannot compute Tailwind layout — `feedback_layout_bugs_request_screenshots_early`). 50-VALIDATION.md §Manual-Only formally defines this single screenshot gate, and both summaries note the UAT is still owed.

### 1. Enriched Scale-card visual + interaction UAT (4.2 + 4.3)

**Test:** In `npm run dev`, open a 4.2 project and a 4.3 project, open "Export Variant…", and exercise the Scale card.
**Expected:** The "Setup-pose size: W × H px" line shows a sane rig size for each runtime; the three coupled fields are legible and aspect-locked; typing a factor moves both px fields; typing a target Width (e.g. 512) makes Height follow aspect-locked with no drift on the typed value; a value ≥ bbox disables Export with the inline "scaled-down" hint; a geometry-less rig shows "unavailable (no textured geometry)" with the factor field still usable.
**Why human:** jsdom cannot compute Tailwind layout/visual legibility. V1-V12 prove all binding math, dual-runtime bbox, summary seam, Layer-3 purity, and the two-way state machine; only the rendered control's visual feel is human-only. Record in `50-HUMAN-UAT.md` (avoid the opened≠rendered trap — the criterion is the rendered, correctly-coupled control).

### Gaps Summary

No goal-blocking gaps. Both ROADMAP success criteria (SCALEUI-01, SCALEUI-02) are fully implemented, wired end-to-end, and proven by the V1-V12 automated suite (all green), with clean dual typechecks and a fully-green full suite (1509 passed, 0 failed) confirming no regression from the new required `bbox` field.

The phase is `human_needed` (not `passed`) solely because the visual legibility/feel of the enriched UI control — the one criterion jsdom cannot verify — requires the formally-scoped screenshot UAT, which is still owed.

Three non-blocking review findings carry forward as advisory items (not gates):
- **WR-02 (Warning):** VariantDialog reads raw `summary` not `effectiveSummary`. Pre-existing intentional export-pipeline convention; surfaces a post-resample (source-toggle) edge case. Recommend the developer confirm whether the bbox reference should track a resampled summary, or accept the existing convention.
- **WR-03 (Warning):** transient display/`s` desync when a px field is cleared mid-edit; restored on blur; happy path unaffected.
- **WR-01 (Info):** misleading "reuse rt" comment in summary.ts (bbox is correct; comment, not behavior).

---

_Verified: 2026-05-23T01:00:00Z_
_Verifier: Claude (gsd-verifier)_
