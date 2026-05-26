---
phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
verified: 2026-05-25T18:05:00Z
status: passed
approved_by: user
approved_at: 2026-05-26
score: 5/5 must-haves verified (+ 6/6 HUMAN-UAT items resolved 2026-05-26: 4 owner-confirmed live, 2 accepted on blanket approval — see 54-HUMAN-UAT.md)
overrides_applied: 0
human_verification:
  - test: "Reopen /Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json"
    expected: "GRAND / L_SKIRT Peak cells no longer tinted green (read at-limit/yellow); the section savings-% chip reads ≈ rounding residual, NOT the phantom 20.6%."
    why_human: "Requires a local-disk variant .json the owner holds (not committed, not jsdom-testable); the rendered tint + chip are visual/runtime outputs the automated synthetic-row suite proves mathematically but cannot observe end-to-end in the real app."
  - test: "Reopen /Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json"
    expected: "L_SKIRT 0.877× false green is gone."
    why_human: "Local-disk variant file (owner-owned); not committed and not jsdom-testable."
  - test: "Reopen a master rig with peakScale<1 genuine savings (e.g. /Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json)"
    expected: "Genuine green (e.g. CROWN-style peakScale<1 rows) is unchanged; the chip is unchanged — the universal D-02 math must NOT regress real savings."
    why_human: "Local-disk file (owner-owned); the master-unchanged regression is proven by spec cases R2/R2b but the live app readout is owner-confirmable only."
  - test: "Hover an extrapolation-icon row in BOTH the Global Max and Animation Breakdown tables"
    expected: "Tooltip reads 'Spine rig peak: X.XX× source' (no '— export capped at canonical'), identical in both panels."
    why_human: "Hover-driven createPortal tooltip render in the live app; jsdom spec asserts the text + source byte-identity but the real-app hover behavior is owner-confirmable."
---

# Phase 54: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) Verification Report

**Phase Goal:** Eliminate the false-positive green "savings" readout shown for REOPENED exported variants, as a renderer-side READ-MODEL / DISPLAY-ONLY fix — changing how Peak and the savings figure are computed for display and how the green tint decides, while changing NO exported bytes and NOT touching the v1.7-locked scale-bake or export sizing math.

**Verified:** 2026-05-25T18:05:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-01: `computeExportDims` returns `peakDemandW/H = min(ceil(canonW × safeScale(rawPeakEff)), actualSource)`, `safeScale` retained, only the `min(...,1)` canonical clamp removed vs `peakDisplayW/H`; export-dim path byte-identical. | VERIFIED | `export-view.ts:305-306` = `Math.min(Math.ceil(canonW * safeScale(rawPeakEff)), actualSrcW)`; `rawPeakEff` reused from `:283` (shared with `peakDisplayEff` at `:287`). `git diff 55dd9f46..HEAD -- export-view.ts`: only additive `peakDemandW/H` type/return lines + docblock prose; NO change to any `effScale =`/`outW =`/`outH =`/`displayScale`/`buildExportPlan` math line (grep of changed `[-+]` lines hit only the return type + return literal where fields were appended). R1 spec: `computeExportDims(247,75,1.182,…,208.5,63)` → `peakDemandW === 247`. |
| 2 | D-02 universal: no "is this a variant" detection; math applies to master + variant uniformly; master peakScale<1 + NECK-repack drift rows display-unchanged & keep correct green. | VERIFIED | No variant-gating branch anywhere in the changed files (formula is unconditional on `peakScale`/`actualSource` scalars). Spec R2 asserts `peakDemandW === peakDisplayW` (byte-identical for peakScale≤1); R2b + R3 assert green preserved (`rowState === 'under'`); R6 (override) green preserved. CONTEXT D-02 honored. |
| 3 | D-03: `rowState` extracted to `lib/row-state.ts` (Layer-3 pure), pure integer compare no epsilon; equal => atLimit, strictly-smaller => under; both call sites pass `row.peakDemandW`. | VERIFIED | `row-state.ts:30-31`: `if (peakDisplayW < sourceW) return 'under'; if (peakDisplayW === sourceW) return 'atLimit';` — pure integer compare, zero imports (Layer-3 pure), exports `rowState` + `RowState`. Both call sites `GlobalMaxRenderPanel.tsx:1006` + `:1132` pass `row.peakDemandW, row.actualSourceW ?? row.sourceW`. Panel local `rowState` deleted (`grep -c "^function rowState"` = 0). R8 spec asserts atLimit/under/neutral edges. |
| 4 | Chip ≡ rows: `savingsPctMemo` rebased onto `enrichWithEffective` per-row `peakDemand`. | VERIFIED | `AppShell.tsx:1196-1210` sums `r.peakDemandW * r.peakDemandH` over `enrichWithEffective(effectiveSummary.regions, activeOverrides)` (same row set the panel at `GlobalMaxRenderPanel.tsx:714` tints) ÷ `actualSourceW ?? sourceW`; dropped `safetyBufferPercentLocal` from deps. Spec "savings" case mirrors this loop byte-for-byte and asserts GRAND contributes 0 + chip = Σ per-row residuals. |
| 5 | No export leak: `tests/core/export.spec.ts` green; `src/core/` untouched (Layer-3 pure); buildExportPlan/outW/outH/clamp byte-identical. | VERIFIED | `git diff --name-only 55dd9f46..HEAD \| grep -c "^src/core/"` = **0**. `tests/core/export.spec.ts` GREEN (re-run, part of 96-test targeted pass). `buildExportPlan` (below the last export-view edit) untouched; no `outW/outH/effScale/displayScale` math line changed. `tests/arch.spec.ts` GREEN (20/20). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/renderer/src/lib/export-view.ts` | computeExportDims returns peakDemandW/H; export-dim math unchanged | VERIFIED | `peakDemandW` ×5 occurrences (type + literal + comments); formula present at `:305-306`; export-dim diff confined to additive lines. |
| `src/renderer/src/lib/enrich-overrides.ts` | EnrichedRow carries peakDemandW/H; destructure + spread | VERIFIED | Type fields added (`:22-25` block), destructured from computeExportDims (args UNCHANGED), spread into return. Docblock updated. |
| `src/renderer/src/lib/row-state.ts` (created) | pure rowState + RowState, Layer-3, node-included | VERIFIED | 34 lines, zero imports, exports both symbols, phase-citing docblock binding the D-03 contract. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Peak cell + both rowState sites use peakDemandW; imports rowState; tooltip reworded | VERIFIED | Peak cell `:553` renders `row.peakDemandW`; call sites `:1006`/`:1132` pass `row.peakDemandW`; import `:66` from `../lib/row-state.js`; tooltip `:563` = new copy. |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | tooltip-copy ONLY; Peak cell + rowState UNCHANGED (out of scope) | VERIFIED | Diff is the single `:840` title line; Peak cell `:836` + rowState `:915`/`:960` still `peakDisplayW` (WR-02 documented deferral). |
| `src/renderer/src/components/icons/ExtrapolationIcon.tsx` | docblock prose updated; no mechanism change | VERIFIED | Docblock reworded (drops "export capped at canonical"); createPortal/getBoundingClientRect untouched. |
| `src/renderer/src/components/AppShell.tsx` | savingsPctMemo rebased onto enrichWithEffective per-row peakDemand | VERIFIED | Import `:75`; memo rebased `:1196-1210`; buildExportPlan import retained (`grep -c` = 1). |
| `tests/renderer/extrapolation-icon-tooltip.spec.tsx` | assertions on new copy; spec GREEN | VERIFIED | Rendered-text `:314`/`:348` + source-walk `:411`/`:412` updated; standalone 9/9 GREEN. |
| `tests/regression/variant-phantom-green.spec.ts` (created) | synthetic-row R1–R8 + chip≡rows + D-03; no committed fixture | VERIFIED | node-program `.spec.ts`, imports only `src/renderer/src/lib/**` + `src/shared` (0 panel/.tsx), R1–R8 (R2 split) + D-03 + savings cases, all GREEN. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `enrich-overrides.ts` | `export-view.ts` | computeExportDims return destructure | WIRED | `peakDemandW, peakDemandH` destructured (`:53-65`), args unchanged. |
| `GlobalMaxRenderPanel.tsx` | `row-state.ts` | `import { rowState }` | WIRED | `:66` `import { rowState, type RowState } from '../lib/row-state.js';` — used at 2 call sites + Peak-cell logic. |
| `AppShell.tsx` | `enrich-overrides.ts` | enrichWithEffective in savingsPctMemo | WIRED | `:75` import; `:1198` call inside savingsPctMemo. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| GlobalMaxRenderPanel Peak cell (`:553`) | `row.peakDemandW/H` | `enrichWithEffective(summary.regions, overridesMap)` (`:714`) → computeExportDims | Yes — `peakDemandW` is a non-optional `number` populated by computeExportDims from loaded `summary.regions` (real skeleton dims) | ✓ FLOWING |
| AppShell savings chip (`savingsPctMemo`) | `r.peakDemandW × r.peakDemandH` | `enrichWithEffective(effectiveSummary.regions, …)` (`:1198`) | Yes — same enriched source-of-truth as the panel | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| GRAND reopened-variant row reads Peak == Source, not green (D-01) | `npx vitest run …variant-phantom-green.spec.ts` R1 | peakDemandW===247, rowState===atLimit | ✓ PASS |
| Master peakScale<1 display-unchanged (D-02) | spec R2/R2b | peakDemand===peakDisplay; green preserved | ✓ PASS |
| NECK-repack drift stays green (D-02) | spec R3 | peakDemandW<120, rowState===under | ✓ PASS |
| D-03 pure integer tint, no epsilon | spec R8 | atLimit/under/neutral edges correct | ✓ PASS |
| chip ≡ Σ rows | spec savings case | GRAND contributes 0; pct = Σ residuals | ✓ PASS |
| No export leak | `npx vitest run tests/core/export.spec.ts` | green (part of 96-test pass) | ✓ PASS |
| Layer-3 purity | `npx vitest run tests/arch.spec.ts` | 20/20 green | ✓ PASS |
| typecheck:node | `npm run typecheck:node` | EXIT 0 | ✓ PASS |
| typecheck:web | `npm run typecheck:web` | EXIT 0 | ✓ PASS |
| Targeted specs (3 files) | regression + tooltip + export | 96/96 GREEN | ✓ PASS |

### Requirements Coverage

No formal REQUIREMENTS.md (git-rm'd at v1.7 close — intentionally absent for this standalone bugfix). Traceability anchored to the three locked decisions:

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| D-01 | 54-01-PLAN must_haves.truths[0] | Read-model render-demand (peakDemandW/H) drops the ≤1 clamp; reopened peakScale>1 variant reads Peak==Source, no green; export bytes unchanged | SATISFIED | Truth 1 + Artifact export-view.ts + spec R1 |
| D-02 | 54-01-PLAN must_haves.truths[1] | Universal (no variant detection); master peakScale<1 + drift rows unchanged | SATISFIED | Truth 2 + spec R2/R2b/R3/R6 |
| D-03 | 54-01-PLAN must_haves.truths[2] | rowState pure integer compare, no epsilon; both call sites pass peakDemandW | SATISFIED | Truth 3 + row-state.ts + spec R8 |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| GlobalMaxRenderPanel.tsx | 247 | Sort comparator reads `peakDisplayW` while cell renders `peakDemandW` (WR-01) | ℹ️ Info | Documented out-of-scope deferral (plan `:388`); UX-only sort/display divergence on peakScale>1 variants; does not affect the phantom-green goal. |
| AnimationBreakdownPanel.tsx | 836/915/960 | Peak cell + rowState still on `peakDisplayW` (WR-02) | ⚠️ Warning | Documented out-of-scope deferral (plan `:340` + CONTEXT). The phantom-green bug class still ships on the Animation Breakdown TAB; the phase goal was scoped to the Global Max read-model only. See Gaps note below. |
| AppShell.tsx | 2789 | Rebased value still flows via prop `exportPlanSavingsPct` (now a misnomer) (WR-03) | ℹ️ Info | Disposition "ACCEPTED AS-IS" in SUMMARY; value source unchanged, only basis rebased; maintainer-naming concern, not a goal failure. |

No TODO/FIXME/placeholder/stub patterns found in the changed source. The Task-1 Wave-0 type-stub (`undefined as unknown as number`) was fully replaced in Task 2 (grep = 0 residue). No empty-data or hardcoded-empty-prop stubs.

### Human Verification Required

The phase goal explicitly addresses REOPENED exported variants from local disk. The automated synthetic-row suite proves the math + tint + chip mathematically (R1–R8 + chip≡rows + D-03, all GREEN), but the actual end-to-end "reopen a real variant .json and observe the green is gone" cannot be exercised in jsdom — the variant files are owner-held local-disk artifacts (`/Users/leo/Downloads/…`), not committed fixtures. These are the OWNER-OWNED Manual UAT items from 54-VALIDATION §Manual-Only:

1. **Reopen TEST_ARMAN @0.5x variant** — GRAND/L_SKIRT no longer green; chip ≈ rounding residual (not 20.6%).
2. **Reopen 42 @0.1x variant** — L_SKIRT 0.877× green gone.
3. **Reopen a master peakScale<1 rig** — genuine green + chip UNCHANGED (D-02 regression guard).
4. **Hover extrapolation-icon rows in BOTH tables** — new tooltip copy, identical in both panels.

### Gaps Summary

No gaps blocking the phase goal. All 5 must-have truths VERIFIED with direct codebase evidence:
- D-01 formula landed exactly as specified (`safeScale` retained, only the `min(...,1)` clamp removed); export-dim path byte-identical; R1 GRAND case proves Peak==Source==247.
- D-02 universal math (no variant detection); master + drift rows display-unchanged (R2/R2b/R3/R6).
- D-03 pure integer compare in the extracted `row-state.ts`; both panel call sites wired to `peakDemandW`.
- Chip ≡ rows by construction (savingsPctMemo + spec share the identical enrichWithEffective + peakDemand loop).
- No export leak: `src/core/` untouched (0 files), export.spec.ts + arch.spec.ts green, buildExportPlan byte-identical.

Both typechecks exit 0; the 3 targeted specs are 96/96 GREEN; the orchestrator's full-suite run (main checkout) is GREEN (1571 passed / 0 failed). The two failures noted in the SUMMARY were executor-worktree gitignored-fixture artifacts (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/`), proven pre-existing and absent in the main checkout — not Phase-54 regressions.

**Known-acceptable deferrals (NOT gaps):** WR-01 (sort comparator) and WR-02 (AnimationBreakdownPanel still shows the bug on its own tab) are EXPLICITLY documented out-of-scope in the plan (`:388`, `:340`) and CONTEXT. The phase boundary deliberately scoped the fix to the Global Max Render panel read-model; the breakdown-panel wiring + sort comparator were not in scope and are correctly excluded per the verification instructions. WR-03 (prop name misnomer) is an ACCEPTED-AS-IS maintainer-naming concern with no value-source change.

**Status is `human_needed`** (not `passed`) solely because the phase goal targets reopened real variant files that are owner-held and not jsdom-testable — the automated layer is complete and green, but the live-app end-state observation is owner-owned per 54-VALIDATION.

---

_Verified: 2026-05-25T18:05:00Z_
_Verifier: Claude (gsd-verifier)_
