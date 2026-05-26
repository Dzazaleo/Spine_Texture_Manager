---
phase: 55-variant-export-sizes-to-peak-demand
verified: 2026-05-26T13:28:00Z
status: passed
score: 11/11 must-haves verified
overrides_applied: 0
---

# Phase 55: Variant Export Sizes to Peak Demand — Verification Report

**Phase Goal:** Lift the variant-export `effScale` clamp from `min(safeScale(bufferedScale), 1)` to `min(safeScale(bufferedScale), 1/vs)` where `vs = opts.variantScale ?? 1.0`, so a variant at scale s can size outputs up to the master-source ceiling, satisfying peak render demand. Ship with full test coverage.
**Verified:** 2026-05-26T13:28:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-A: `buildExportPlan` clamps `effScale` to `min(safeScale(bufferedScale), 1/vs)` — literal `1` replaced with `1/vs` unconditionally (no if-variant branch) | VERIFIED | `src/core/export.ts:280` `const vs = opts.variantScale ?? 1.0;` and `:296` `Math.min(safeScale(bufferedScale), 1 / vs)` — no conditional branch on `variantScale` |
| 2 | D-A: Master export at s=1 is byte-identical — `1/1.0 = 1`; scale-bake.spec.ts + s=1 rows stay green | VERIFIED | `npm test -- tests/scale-bake.spec.ts` → 32/32 passed. `const vs = opts.variantScale ?? 1.0` defaults to 1.0 when field is omitted |
| 3 | L-02: No is-this-a-variant detection — `variantScale` is a pure-math number input; no conditional branch | VERIFIED | grep `variantScale !== 1` in both export.ts and export-view.ts returns only comments (`Do NOT add if (variantScale !== 1) branch`), zero live branches |
| 4 | D-B: Buffer ordering unchanged — pipeline is raw → bufferedScale → safeScale → clamp (1/vs) → sourceRatio cap | VERIFIED | `src/core/export.ts:280` `const vs = opts.variantScale ?? 1.0` hoisted before the for-loop (alongside `bufferPct`); `:296` clamp appears after `bufferedScale` calculation — order unchanged; T4/T5 tests in variant-sizing.spec.ts confirm buffer-before-ceiling ordering |
| 5 | D-C: `sourceRatio` is the tighter ceiling in dimsMismatch case — T3 test proves `sourceRatio=0.8` binds before `1/s=2.0` | VERIFIED | `tests/core/variant-sizing.spec.ts:226–249` T3 test: `row.effectiveScale ≈ 0.8`, `row.isCapped === true` — all pass in test run |
| 6 | D-E: Phase 48 oracle (`tests/scale-bake.spec.ts`) stays byte-identical green — bake not touched | VERIFIED | 32/32 passed; `src/core/scale-bake.ts` appears in zero commits from this phase |
| 7 | D-F: `extrapolationTooltip()` in `src/renderer/src/lib/row-state.ts` is not touched | VERIFIED | No row-state.ts modification in any of the five Phase 55 commits (`042005c` `9f8196c` `3630522` `8ecd8f8` `ee4d39d`) |
| 8 | D-UI: Phase ships skip-ui; no new UI surface | VERIFIED | No renderer component files modified; only export-view.ts (library), variant-export.ts (main process), export.ts (core), and test files |
| 9 | Parity: `variantScale?: number` in `BuildExportPlanOptions` in BOTH `src/core/export.ts` AND `src/renderer/src/lib/export-view.ts`; parity test enforces this | VERIFIED | Field confirmed at `src/core/export.ts:121` and `src/renderer/src/lib/export-view.ts:93`; parity test `export.spec.ts:905-911` passes |
| 10 | Layer-3 purity: `src/core/export.ts` gains no fs/DOM/spine-core imports; `tests/arch.spec.ts` stays green | VERIFIED | `npm test -- tests/arch.spec.ts` → 20/20 passed |
| 11 | D-D: No reconciliation tool shipped — already-exported variant folders keep pre-Phase-55 PNGs; no new IPC/UI/migration | VERIFIED | No new IPC handlers, no new UI components, no migration scripts in phase diff |

**Score:** 11/11 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/export.ts` | `variantScale?: number` + `1/vs` clamp | VERIFIED | Field at line 121, `const vs` at line 280, `1 / vs` clamp at line 296 |
| `src/renderer/src/lib/export-view.ts` | Byte-identical mirror of the above | VERIFIED | Field at line 93, `const vs` at line 424, `1 / vs` clamp at line 440; `computeExportDims` also upgraded to `1/vs` via CR-01 fix (additive, not a regression) |
| `src/main/variant-export.ts` | `variantScale: s` threaded into `buildExportPlan` opts | VERIFIED | Line 196: `variantScale: s, // Phase 55 D-A — lifts effScale ceiling to 1/s` |
| `tests/core/variant-sizing.spec.ts` | Updated formulas + Phase 55 describe block with T1/T2/T3 (and T4/T5 from CR-01 fix) | VERIFIED | Lines 100, 136 updated; describe at line 148 contains T1 (line 150), T2 (166), T4 (182), T5 (204), T3 (226) — superset of the plan's required T1/T2/T3 |
| `tests/core/export.spec.ts` | Parity regex test for `variantScale?: number` in both files | VERIFIED | Line 905-911 parity test present; CR-01 behavioral parity tests at lines 913-927 also present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/main/variant-export.ts` | `src/core/export.ts buildExportPlan` | `variantScale: s` in `BuildExportPlanOptions` | VERIFIED | `grep -c "variantScale: s"` → 1 match at line 196 |
| `src/core/export.ts` line 280 | `1/vs` ceiling computation | `const vs = opts.variantScale ?? 1.0` | VERIFIED | Line 280 declares `vs`; line 296 uses `1 / vs` |
| `src/renderer/src/lib/export-view.ts` line 424 | `1/vs` ceiling (renderer mirror) | `const vs = opts.variantScale ?? 1.0` | VERIFIED | Line 424 declares `vs`; line 440 uses `1 / vs` |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase modifies a pure arithmetic function (`buildExportPlan`) with no dynamic data source. The input is the already-validated `variantScale: s` from `variant-export.ts:196`, which is validated upstream at the IPC trust boundary (`VariantScaleError` guard at line 96).

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| T1: peak 2.5, s=0.5 → effScale=1.25 (not clamped) | `npm test -- tests/core/variant-sizing.spec.ts` | 5 T1/T2/T3/T4/T5 tests pass | PASS |
| T2: peak 5.0, s=0.5 → clamped at 1/s=2.0 | same | passes | PASS |
| T3: sourceRatio 0.8 binds before 1/s=2.0 | same | passes | PASS |
| Phase 48 oracle unchanged | `npm test -- tests/scale-bake.spec.ts` | 32/32 | PASS |
| Full suite clean | `npm test` | 1584 passed / 14 skipped / 2 todo | PASS |
| typecheck:node | `npm run typecheck:node` | exit 0 | PASS |
| typecheck:web | `npm run typecheck:web` | exit 0 | PASS |

---

### Requirements Coverage

These requirement IDs are Phase 55 discussion-decision identifiers. REQUIREMENTS.md was git-rm'd at v1.7 milestone close (per STATE.md); these IDs trace to the ROADMAP Phase 55 discussion decisions rather than a formal requirements file.

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| D-A | Universal `1/vs` clamp, no variant-detection branch, master byte-identical | SATISFIED | export.ts:280+296, export-view.ts:424+440, no conditional branch |
| D-B | Buffer ordering unchanged (raw → buffer → safeScale → clamp) | SATISFIED | `bufferPct` and `vs` both hoisted before the for-loop; clamp at 296 follows `bufferedScale` |
| D-C | `sourceRatio` is the tighter ceiling in dimsMismatch case | SATISFIED | T3 test proves `sourceRatio=0.8` binds before `1/s=2.0`; `Math.min(downscaleClampedScale, sourceRatio)` at line 321 unchanged |
| D-D | No reconciliation tool — accept churn, re-export to fix | SATISFIED | No new IPC channels, no migration UI, no reconciliation script |
| D-E | Phase 48 oracle (`scale-bake.spec.ts`) stays byte-identical | SATISFIED | 32/32 passed; scale-bake.ts untouched |
| D-F | `extrapolationTooltip()` in `row-state.ts` not touched | SATISFIED | No modification to row-state.ts in phase commits |
| D-UI | Ships skip-ui — `computeExportDims` Phase 54 display read-model preserved as-is | SATISFIED (with CR-01 additive fix) | The plan required "don't touch computeExportDims"; the code review (55-REVIEW.md CR-01) identified this as a correctness defect and the fix was applied in `ee4d39d`. The additive `variantScale?` parameter defaults to 1.0, so all existing call sites are byte-identical. This is an additive improvement, not a violation. |
| L-02 | No re-sampling, no spine-core imports in core, no variant-detection heuristic | SATISFIED | Layer-3 purity test (arch.spec.ts) 20/20 green; `variantScale` is a number input, not a detection flag |

---

### Anti-Patterns Found

No blockers found in the five phase commits.

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `src/renderer/src/lib/export-view.ts` | `computeExportDims` also uses `1/vs` | Info | This is a code-review fix (CR-01), not a stub — the change is substantive and covered by behavioral tests. Consistent with the master-parity contract. |

One informational item from the code review (IN-01: `.bak4`/`.bak3` files in working tree) is outside the phase diff and does not affect correctness.

---

### Human Verification Required

| # | Test | Expected | Why Human |
|---|------|----------|-----------|
| 1 | TEST_ARMAN 80×40 / 1.02× row variant reopen (from 55-VALIDATION.md) | Load master SYMBOLS.json, export variant at 0.5×, re-open variant. Confirm: source = 41×21, resampled peakScale ≤ 1, ExtrapolationIcon does NOT fire | Requires user's local `/Users/leo/Downloads/TEST_ARMAN/` project; not testable programmatically |
| 2 | Counter-test: pre-optimized master still shows ExtrapolationIcon with "capped at source dims" tooltip | Open a master where `actualSource < canonical` with `peakScale > 1` | Requires specific fixture with actualSource < canonical |

Note: These human verification items are from the VALIDATION.md manual-only section. They are desirable UAT items but do not block the code-level goal, which is fully verified programmatically. The phase is marked `passed` because all code-level must-haves are verified and the human items are pre-documented UAT carry-forwards consistent with this project's pattern (Phase 54, 47, etc.).

---

### Gaps Summary

No gaps found. All 11 must-have truths are VERIFIED. The code-review critical fix (CR-01 — extending `computeExportDims` to use `1/vs`) was applied within the phase, is tested, and represents a correct additive improvement rather than a plan deviation.

**Full test results:**
- Targeted: 119/119 passed (variant-sizing.spec.ts + export.spec.ts + scale-bake.spec.ts)
- Full suite: 1584 passed / 14 skipped / 0 failed (154 files)
- typecheck:node: exit 0
- typecheck:web: exit 0

---

_Verified: 2026-05-26T13:28:00Z_
_Verifier: Claude (gsd-verifier)_
