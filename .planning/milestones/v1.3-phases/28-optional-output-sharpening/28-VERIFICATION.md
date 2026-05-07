---
phase: 28-optional-output-sharpening
verified: 2026-05-06T22:01:11Z
status: passed
human_approved_at: 2026-05-06T22:55:00Z
score: 14/14 must-haves verified (automated)
overrides_applied: 0
human_verification:
  - test: "Visual A/B vs Photoshop Bicubic Sharper at 50–75% downscale ratios"
    expected: "Toggle ON + downscale produces output visually comparable to Photoshop's Bicubic Sharper (reduction) preset on real Spine art"
    why_human: "Perceptual quality assessment on real artwork; automated variance assertion proves measurable sharpening but cannot validate perceptual match against Photoshop reference"
  - test: "End-to-end smoke: open project → toggle ON → save → close → reopen → verify toggle restored ON"
    expected: "Checkbox state persists across save/reopen for both true and false values; project marks dirty on toggle"
    why_human: "Plan 28-01 Task 7 deferred manual smoke to UAT; the round-trip is unit-tested at the .stmproj layer (project-file.spec.ts) but the full Electron save/open lifecycle in the dev app needs human exercise"
  - test: "Toggle disabled during in-progress export"
    expected: "Once Start clicked and export is running, the Sharpen checkbox cannot be toggled"
    why_human: "Renderer interactive behavior in dev app; static disabled={state === 'in-progress'} is verified in source but live keypress/click behavior needs human"
---

# Phase 28: Optional Output Sharpening on Downscale — Verification Report

**Phase Goal:** Opt-in post-resize unsharp mask. Adds a checkbox to OptimizeDialog ("Sharpen output on downscale"), default OFF, persists per-project in .stmproj v1 schema (additive optional `sharpenOnExport: boolean`; missing field = false for backward-compat). When ON, image-worker applies `sharp.sharpen({ sigma: 0.5 })` after Lanczos3 resize on rows with `effectiveScale < 1.0`. Both resize call sites (per-region + atlas-extract) receive the conditional sharpen.

**Verified:** 2026-05-06T22:01:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | OptimizeDialog renders "Sharpen output on downscale" checkbox between 3-tile summary and state-branched body (D-03) | VERIFIED | `src/renderer/src/modals/OptimizeDialog.tsx:393-402` — `<label>...<input type="checkbox" checked={props.sharpenOnExport} ...>Sharpen output on downscale</label>` placed at L389 right after the 3-tile summary block close (L387) and before `{state === 'pre-flight' && <PreFlightBody ...>}` at L404 |
| 2 | Checkbox default state is unchecked (OFF) on fresh load / v1.2-era .stmproj absent field (D-04) | VERIFIED | `src/core/project-file.ts:192-194` — `if (obj.sharpenOnExport === undefined) { obj.sharpenOnExport = false; }`; `src/renderer/src/components/AppShell.tsx:314-315` — `useState(() => initialProject?.sharpenOnExport ?? false)`; `tests/core/project-file.spec.ts:374-394` test "validateProjectFile pre-massages missing sharpenOnExport to false" PASSES |
| 3 | Toggling marks project dirty (Save button enables) | VERIFIED | `src/renderer/src/components/AppShell.tsx:819` — `if (sharpenOnExportLocal !== lastSaved.sharpenOnExport) return true;` inside `isDirty` memo; deps include `sharpenOnExportLocal` (L821) |
| 4 | Save → close → reopen restores last-saved value (true ↔ true; false ↔ false) | VERIFIED (round-trip layer); HUMAN_NEEDED (full app smoke) | `tests/core/project-file.spec.ts:420-458` — both round-trip true and round-trip false cases PASS (25/25 tests pass); AppShell L1079 `setSharpenOnExportLocal(project.sharpenOnExport ?? false)` restores on Open. **Human verification covers full Electron lifecycle.** |
| 5 | v1.2-era .stmproj (no `sharpenOnExport` field) loads successfully and renders unchecked | VERIFIED | `tests/core/project-file.spec.ts:374-395` — `sharpenOnExport INTENTIONALLY ABSENT` test passes; validator pre-massage at `src/core/project-file.ts:192-194` substitutes `false` |
| 6 | Non-boolean `sharpenOnExport` rejected with `invalid-shape` error mentioning `sharpenOnExport` | VERIFIED | `src/core/project-file.ts:195-199` — `if (typeof obj.sharpenOnExport !== 'boolean') return { ok: false, error: { kind: 'invalid-shape', message: 'sharpenOnExport is not boolean' } }`; `tests/core/project-file.spec.ts:397-418` test "validateProjectFile rejects non-boolean sharpenOnExport" PASSES |
| 7 | Checkbox disabled during `state === 'in-progress'` | VERIFIED (static) / HUMAN_NEEDED (live) | `src/renderer/src/modals/OptimizeDialog.tsx:398` — `disabled={state === 'in-progress'}`. Static source check passes; live click-during-export behavior needs human |
| 8 | Toggle threaded into `window.api.startExport(plan, outDir, overwrite, sharpenEnabled)` as 4th arg | VERIFIED | `src/renderer/src/modals/OptimizeDialog.tsx:230-235` — `await window.api.startExport(props.plan, resolvedOutDir, overwrite, props.sharpenOnExport)`. 4th arg is the prop value |
| 9 | When `sharpenEnabled === true` AND `effectiveScale < 1.0`, `sharp.sharpen({ sigma: 0.5 })` called exactly once on resize pipeline (D-07) | VERIFIED | `src/main/image-worker.ts:96-98` — `if (sharpenEnabled && effectiveScale < 1.0) { p = p.sharpen({ sigma: SHARPEN_SIGMA }); }`. Test Case 1 (per-region) and Case 4 (atlas-extract) at `tests/main/image-worker.sharpen.spec.ts` both assert `expect(sharpenedVar).toBeGreaterThan(baselineVar * 1.15)` → both PASS |
| 10 | When `sharpenEnabled === true` AND `effectiveScale === 1.0`, sharpen NOT called (downscale-only gate) | VERIFIED | Same gate `effectiveScale < 1.0` at image-worker.ts:96 (strict `<`, not `<=`); test Case 2 asserts `Buffer.compare(offRaw, onRaw) === 0` at scale=1.0 → PASSES |
| 11 | When `sharpenEnabled === false`, sharpen NEVER called regardless of scale | VERIFIED | Gate `sharpenEnabled && ...` at L96; test Case 3 asserts byte-identical OFF/OFF at scale=0.5 → PASSES |
| 12 | BOTH resize call sites collapse onto SAME `applyResizeAndSharpen` helper (D-08) — single locus of sigma + gate | VERIFIED | `grep -c "kernel: 'lanczos3'" src/main/image-worker.ts` = 1 (only inside helper at L95); `grep -c "applyResizeAndSharpen(" src/main/image-worker.ts` = 3 (1 declaration + 2 call sites at L480+L493); Case 5 cross-branch consistency test asserts variance ratio < 0.10 → PASSES |
| 13 | Sigma is `0.5` bound to module-level `SHARPEN_SIGMA` constant (D-05) | VERIFIED | `src/main/image-worker.ts:71` — `const SHARPEN_SIGMA = 0.5;` and `:97` `p.sharpen({ sigma: SHARPEN_SIGMA })`; `grep -rn "sigma: 0.5" src/` returns 0 magic-literal matches |
| 14 | Passthrough rows (Phase 22 `passthroughCopies[]`) NEVER enter the helper — preserve byte-identity | VERIFIED | Passthrough loop at `src/main/image-worker.ts:127-263` uses `copyFile` / `sharp().extract().toFile()` direct paths; no `applyResizeAndSharpen` call inside that loop. Phase 22 byte-identity tests still pass |

**Score:** 14/14 truths verified (all automated must-haves passing)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/shared/types.ts` | ProjectFileV1.sharpenOnExport, AppSessionState.sharpenOnExport, MaterializedProject.sharpenOnExport, Api.startExport gains 4th arg | VERIFIED | grep matches at L786, L811, L841 (3 interfaces); L944 `sharpenEnabled?: boolean` (Api signature) |
| `src/core/project-file.ts` | Validator pre-massage + per-field type-check + serializer write + materializer fallback + PartialMaterialized field | VERIFIED | 5 sites confirmed: L192-198 (pre-massage + type-check), L316 (serializer), L371 (PartialMaterialized), L428 (materializer fallback). `from 'sharp'` count = 0 (Layer 3 invariant preserved) |
| `src/main/project-io.ts` | MaterializedProject envelope threading at Open + recovery + resample sites | VERIFIED | L557 (Open), L691-692 (recovery defensive coerce), L824-826 (recovery rebuild), L1042-1043 (resample defensive coerce — Rule 3 auto-fix per 28-01-SUMMARY) |
| `src/main/ipc.ts` | handleStartExport gains 5th param + runExport 6th arg + ipcMain.handle strict coerce; @ts-expect-error removed | VERIFIED | L538 (5th param `sharpenEnabled: boolean = false`), L657 (6th arg to runExport), L688-695 (ipcMain.handle strict `=== true`); `grep -c "@ts-expect-error Phase 28-02"` = 0 (placeholder removed per Plan 28-02) |
| `src/preload/index.ts` | startExport bridge accepts 4th arg + strict coerce | VERIFIED | L98-104 — `(plan, outDir, overwrite, sharpenEnabled) => ipcRenderer.invoke('export:start', plan, outDir, overwrite === true, sharpenEnabled === true)` |
| `src/renderer/src/components/AppShell.tsx` | sharpenOnExportLocal lifecycle (state slot + lastSaved + buildSessionState + isDirty + setLastSaved + Open restore + OptimizeDialog wire-through) | VERIFIED | 9 occurrences spread across 8 distinct sites: L314 (state slot), L354+L360 (lastSaved shape), L744+L754 (buildSessionState value+dep), L819+L821 (isDirty comparison+dep), L846+L880+L1058 (3 setLastSaved literal sites — `samplingHz:` count = `sharpenOnExport:` count = 3), L1079 (Open restore), L1854-1855 (OptimizeDialog props) |
| `src/renderer/src/modals/OptimizeDialog.tsx` | Props (sharpenOnExport, onSharpenChange) + checkbox render with locked copy + 4th startExport arg | VERIFIED | L109-110 (props), L393-402 (checkbox with literal "Sharpen output on downscale", `disabled={state === 'in-progress'}`), L234 (4th arg) |
| `src/main/image-worker.ts` | SHARPEN_SIGMA module-level const + applyResizeAndSharpen helper + both call sites collapsed + runExport 6th arg | VERIFIED | L71 (`const SHARPEN_SIGMA = 0.5`), L88-100 (helper with downscale-only gate), L117 (runExport 6th arg `sharpenEnabled: boolean = false`), L480+L493 (atlas-extract + per-region call sites both routed through helper) |
| `tests/main/image-worker.sharpen.spec.ts` | NEW file with 5 cases (4 toggle/scale combos + 1 cross-branch) | VERIFIED | File exists (317 lines, 12 expect calls); 5 it() cases (Cases 1-5) with `describe('runExport — sharpen ...')` header; all 5 PASS in `npx vitest run` |
| `tests/core/project-file.spec.ts` | New describe block "Phase 28 — sharpenOnExport (D-06)" with 4 cases | VERIFIED | L374-461 — describe block at L374, 4 it() cases (pre-massage missing → false, reject non-boolean, round-trip true, round-trip false); all 4 PASS (25/25 file total) |
| `.planning/REQUIREMENTS.md` | SHARP — Output Quality section + 3 traceability rows | VERIFIED | L40 `### SHARP — Output Quality`; L42-44 SHARP-01/02/03 entries; L91-93 traceability rows (note: SHARP-01/02 status is "Pending" pending verification flip per 28-03-SUMMARY follow-up suggestion; SHARP-03 is "Complete") |
| `.planning/ROADMAP.md` | Phase 28 detail section + Progress row | VERIFIED | L80 milestone bullet (already pivoted); L647-666 detail section with Goal/Depends/Requirements/Success Criteria/Plans; L694 progress row `28. Optional output sharpening on downscale | v1.3 | 3/3 | Complete | 2026-05-06` |
| `.planning/STATE.md` | References "Optional output sharpening" (not PMA preservation as active scope) | VERIFIED | L20 + L30 reference Phase 28 / optional-output-sharpening; `grep -c "PMA preservation" .planning/STATE.md` = 0 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| OptimizeDialog.tsx checkbox | window.api.startExport 4th arg | `props.sharpenOnExport` passed at L234 | WIRED | `grep -A4 "window.api.startExport" OptimizeDialog.tsx` shows `props.sharpenOnExport` within the call |
| AppShell.tsx | project-file.ts serialize | `buildSessionState` includes `sharpenOnExport: sharpenOnExportLocal` (L744) → `serializeProjectFile` writes `state.sharpenOnExport` (project-file.ts:316) | WIRED | Both sides match contract; round-trip verified by tests/core/project-file.spec.ts |
| project-file.ts validate | project-io.ts MaterializedProject | `materializeProjectFile` returns `sharpenOnExport: file.sharpenOnExport ?? false` (project-file.ts:428) → project-io.ts:557 threads `materialized.sharpenOnExport` | WIRED | Open flow envelope construction confirmed |
| project-io.ts (Open) | AppShell initialProject | MaterializedProject.sharpenOnExport seeds `initialProject?.sharpenOnExport ?? false` (AppShell.tsx:315) and `setSharpenOnExportLocal(project.sharpenOnExport ?? false)` on Open (L1079) | WIRED | Both useState initializer + Open-success restore match the contract |
| OptimizeDialog → preload | `window.api.startExport(plan, outDir, overwrite, sharpenOnExport)` → preload bridge `sharpenEnabled === true` | preload/index.ts:98-104 | WIRED | Strict coerce defense in depth |
| preload → ipc.ts handler | `ipcRenderer.invoke('export:start', ...)` → `ipcMain.handle('export:start', ...)` strict-coerces `sharpenEnabled === true` | ipc.ts:688-695 | WIRED | Defense-in-depth strict coerce at both boundaries |
| ipc.ts → image-worker.ts | `handleStartExport` 5th param → `runExport(... overwrite, sharpenEnabled)` 6th arg (ipc.ts:646-657) | image-worker.ts:117 accepts arg | WIRED | @ts-expect-error placeholder from Plan 28-01 was correctly removed |
| image-worker.ts runExport | applyResizeAndSharpen helper | Both branches at L480+L493 invoke helper with `sharpenEnabled` | WIRED | grep `kernel: 'lanczos3'` count went 2 → 1 (collapse confirmed); helper count = 3 (1 decl + 2 calls) |
| applyResizeAndSharpen | sharp.sharpen({ sigma: SHARPEN_SIGMA }) | Single conditional `if (sharpenEnabled && effectiveScale < 1.0)` at L96-98 | WIRED | Single locus of gate (D-07 + D-05 + D-08) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| OptimizeDialog checkbox | `props.sharpenOnExport` | AppShell `sharpenOnExportLocal` useState seeded from `initialProject?.sharpenOnExport ?? false` | Yes — boolean state mutated by user click | FLOWING |
| AppShell session state | `sharpenOnExportLocal` | `useState` initialized from `initialProject?.sharpenOnExport`; mutated by `setSharpenOnExportLocal` (passed as `onSharpenChange` to OptimizeDialog); restored on Open | Yes — flows through buildSessionState → serializer → .stmproj on Save | FLOWING |
| ipc.ts handleStartExport | `sharpenEnabled` (boolean param) | IPC arg from `ipcMain.handle('export:start')` strict-coerce `=== true` | Yes — boolean passed through to runExport | FLOWING |
| runExport pipeline | `sharpenEnabled` (6th arg) | `handleStartExport` invocation at ipc.ts:657 | Yes — flows through to applyResizeAndSharpen at both call sites | FLOWING |
| applyResizeAndSharpen | `effectiveScale`, `sharpenEnabled` | row.effectiveScale from ExportPlan + sharpenEnabled threaded through runExport | Yes — gate evaluated per-row; sharp.sharpen invoked when both conditions hold | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Sharpen test suite passes | `npx vitest run tests/main/image-worker.sharpen.spec.ts` | "Test Files 1 passed (1) · Tests 5 passed (5)" | PASS |
| .stmproj round-trip tests pass | `npx vitest run tests/core/project-file.spec.ts` | "Test Files 1 passed (1) · Tests 25 passed (25)" | PASS |
| Main tsconfig compiles clean | `npx tsc --noEmit -p tsconfig.json` | exit=0 (zero errors) | PASS |
| Layer 3 invariant: no sharp in core/shared | `grep -rn "from 'sharp'" src/core/ src/shared/` | 0 hits | PASS |
| SHARPEN_SIGMA single locus | `grep -rn "SHARPEN_SIGMA" src/` | 2 hits in image-worker.ts (declaration + use) | PASS |
| No sigma magic literal | `grep -rn "sigma: 0.5" src/` | 0 hits | PASS |
| Schema version unchanged at 1 | `grep -n "version: 1" src/core/project-file.ts` | L301 `version: 1,` | PASS |
| @ts-expect-error placeholder removed | `grep -c "@ts-expect-error Phase 28-02" src/main/ipc.ts` | 0 hits | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SHARP-01 | 28-01-PLAN | User opt-in checkbox in OptimizeDialog + .stmproj v1 persistence (additive `sharpenOnExport`; missing → false) | SATISFIED | OptimizeDialog checkbox at L393-402 with literal copy "Sharpen output on downscale"; .stmproj round-trip + backward-compat tests pass (4/4 cases); validator pre-massage + per-field type-check at project-file.ts:192-199 |
| SHARP-02 | 28-02-PLAN | image-worker applies `sharp.sharpen({ sigma: 0.5 })` after Lanczos3 on `effectiveScale < 1.0`; both call sites collapsed via shared helper | SATISFIED | `SHARPEN_SIGMA = 0.5` at image-worker.ts:71; `applyResizeAndSharpen` helper L88-100; both call sites at L480+L493 routed through helper; `kernel: 'lanczos3'` count went 2→1 (collapse confirmed); Cases 1+4 in sharpen.spec.ts assert variance > baseline*1.15 → PASS |
| SHARP-03 | 28-03-PLAN | Regression test locks SHARPEN_SIGMA constant + downscale-only gate; toggle OFF + downscale baseline; toggle ON + 1.0× baseline | SATISFIED | tests/main/image-worker.sharpen.spec.ts created (317 lines, 5 cases); all 5 PASS deterministically; Case 5 cross-branch helper-routing verifies D-08 behaviorally; sigma drift to 0.05 mathematically falls below 1.15× threshold (variance ratio 1.0× — adversarial drift fires the gate) |

**No orphaned requirements.** REQUIREMENTS.md maps SHARP-01/02/03 exclusively to Phase 28; all three appear in plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | — | — | No new TODO/FIXME/PLACEHOLDER markers introduced by Phase 28 |

Pre-existing test failures (3 tests across 2 files) are documented baseline failures unrelated to Phase 28 (`tests/integration/build-scripts.spec.ts` package.json version stale fixture; `tests/renderer/save-load.spec.tsx` toolbar Open button selector fixture mismatch). Both are documented in `.planning/phases/28-optional-output-sharpening/deferred-items.md`. Plan 28-03 confirms the failure count went 5→3 across runs (environmental flakiness in pre-existing baseline) without Phase 28 changes affecting any of them.

### Human Verification Required

Three items need human exercise. Two are inherent to the phase (perceptual quality + full-app lifecycle smoke); one is the live-disabled-during-export interaction.

**1. Visual A/B vs Photoshop Bicubic Sharper**

- **Test:** Load a real Spine project with downscale ratios in [0.5, 0.75]. Toggle ON, run optimize. Open output PNG in Photoshop. Reduce same source via "Bicubic Sharper (reduction)". Compare side-by-side.
- **Expected:** STM toggle-ON output is visually comparable to Photoshop Bicubic Sharper preset on real artwork (no halos / over-sharpening artifacts at hard edges).
- **Why human:** Perceptual quality assessment on real artwork. Automated test proves measurable sharpening (variance ratio 1.2524× at sigma=0.5) but cannot validate perceptual match against Photoshop reference.

**2. Full save/reopen round-trip in dev app**

- **Test:** `npm run dev`. Open a project. Click Optimize Assets. Toggle Sharpen ON. Cancel dialog. Save project. Close window/quit app. Re-launch. Open same project. Click Optimize Assets again.
- **Expected:** Sharpen checkbox renders ON. Save button initially disabled (no dirty state). Toggle OFF, save, close, reopen — checkbox renders OFF.
- **Why human:** Plan 28-01 Task 7 deferred manual smoke. The round-trip is unit-tested at the .stmproj layer (4/4 project-file.spec.ts cases pass) but the full Electron save/open lifecycle in the dev app needs human exercise.

**3. Toggle disabled during in-progress export**

- **Test:** With a multi-row project, Toggle ON, click Start, while export is in-progress (rows transitioning idle → in-progress → success), attempt to click the Sharpen checkbox.
- **Expected:** Checkbox is non-interactive (cursor: not-allowed; no toggle state change) until export completes.
- **Why human:** Static `disabled={state === 'in-progress'}` is verified at OptimizeDialog.tsx:398; live click-during-export interaction in dev app needs human verification.

### Gaps Summary

**No automated gaps.** All 14 must-haves verified across the codebase. The test suite results, TypeScript compilation, structural greps (kernel count, helper count, SIGMA locus, Layer 3 invariant), data-flow tracing, and key-link verification all confirm Phase 28 is mechanically complete.

**Status `human_needed`** because three items intrinsically require human exercise:
1. Perceptual A/B vs Photoshop (cannot be automated meaningfully — that's the entire reason this is opt-in).
2. Full Electron lifecycle round-trip in dev app (deferred from Plan 28-01 Task 7 to UAT per plan).
3. Live disabled-during-export interaction (visual/interactive verification).

After HUMAN-UAT signs off, the suggested follow-up (per 28-03-SUMMARY) is to flip SHARP-01/02 traceability rows from "Pending" → "Complete" in REQUIREMENTS.md and bring the unchecked SHARP-01/02 checkboxes to `[x]`. SHARP-03 is already marked Complete. The Phase 28 Progress row is already marked Complete (2026-05-06).

---

## Verification Method Summary

- **Initial mode** (no previous VERIFICATION.md found).
- **Must-haves established** from PLAN frontmatter `must_haves` blocks across 28-01-PLAN.md, 28-02-PLAN.md, 28-03-PLAN.md (merged); cross-checked against ROADMAP.md Phase 28 Success Criteria (6 entries) — full superset coverage.
- **Three-level artifact verification** (exists, substantive, wired) applied to all 13 artifacts; all PASS.
- **Level 4 data-flow trace** confirmed all dynamic data variables flow from real sources (no static fallback).
- **Behavioral spot-checks** confirmed test suites pass and structural invariants (Layer 3, sigma locus, schema version) hold.
- **Anti-pattern scan** found no new TODO/FIXME/placeholder/stub markers introduced by Phase 28.
- **Pre-existing baseline failures** (3 individual tests in 2 files) confirmed unrelated to Phase 28 per deferred-items.md.

---

*Verified: 2026-05-06T22:01:11Z*
*Verifier: Claude (gsd-verifier)*
