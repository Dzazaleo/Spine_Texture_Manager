---
phase: 49-single-scale-variant-export
verified: 2026-05-22T00:00:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification:
  - test: "\"Export Variant…\" native end-to-end UAT (EXPORT-01) on a 4.2 AND a 4.3 project"
    expected: "In `npm run dev`: click \"Export Variant…\", enter 0.5, pick a PARENT folder via the native dialog, Export → a {NAME}@0.5x/ folder appears with the correct artifacts for the active output mode, and the variant renders in the viewer at exactly half the master size (rendered end-state, NOT just \"dialog opened\")."
    why_human: "Electron native folder picker + real WebGL render cannot be exercised in jsdom; automated coverage stops at the IPC handler (per 49-VALIDATION.md Manual-Only). Documented UAT to record in 49-HUMAN-UAT.md."
  - test: "Re-export-into-existing-folder result surfacing (CR-01 partial-failure path)"
    expected: "Export a variant once (fresh folder, succeeds). Export the SAME scale into the SAME parent again. Decide whether the dialog must surface the worker's overwrite-collision errors rather than reporting \"0 files exported\" as success. (Code review CR-01: the dialog ignores summary.errors[]; the JSON is overwritten unconditionally while images are refused, leaving a mismatched package presented as success.)"
    why_human: "Whether this misleading-success-on-re-export is acceptable for shipping, or must be fixed before EXPORT-01 is signed off, is a product/correctness decision — not programmatically resolvable. The happy-path (first export to a fresh folder) is fully correct and verified."
---

# Phase 49: Single-Scale Variant Export — Verification Report

**Phase Goal:** Deliver the first end-user value — export one scaled-down variant to a chosen folder as a complete, drop-in package (scaled skeleton JSON + resized textures + scaled atlas), reusing the existing export-sizing + atlas-writer pipeline and sizing textures arithmetically (`variant_peak = s × master_peak`, never by re-sampling the variant); respecting output modes `loose | atlas | both`; dual-runtime (4.2 + 4.3) × dual loader-mode (atlas-source + atlas-less); source JSON never modified.
**Verified:** 2026-05-22
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

The phase's must-haves are the 4 ROADMAP Success Criteria (EXPORT-01/02/03/05) merged with the plan-frontmatter truths (the L-xx invariants + the D-xx decisions). All are backed by substantive, wired, data-flowing code with passing discriminating tests.

| #  | Truth (source) | Status | Evidence |
|----|----------------|--------|----------|
| 1  | EXPORT-01 (SC1): user can export a single scaled-down variant to a chosen folder as a drop-in package (baked JSON + resized textures + per-mode atlas), usable as-is | ✓ VERIFIED | Engine `handleExportVariant` (variant-export.ts:53-230) composes guard→read→bake→`{NAME}@{s}x/`→write-JSON-first→buildExportPlan(scaled)→dispatch. Renderer leg wired: "Export Variant…" toolbar button → VariantDialog → `window.api.exportVariant` (renderer test asserts ONE call with the exact typed arg order). Package-layout test (V3) proves the written folder is a real drop-in across the full matrix. Faithfulness oracle (V6) loads the WRITTEN package via `loadSkeleton` and samples it. (Native-dialog + visual half-size end-state → human UAT.) |
| 2  | EXPORT-02 (SC2): variant texture sizes = `s × master_peak`, reusing buildExportPlan; source project never modified | ✓ VERIFIED | `scaleSummaryPeaks` (peak-only A1) feeds `buildExportPlan` UNCHANGED (variant-export.ts:123). V1 sizing test proves a genuine sub-1.0 row (`0.5×0.4=0.2` effectiveScale, not a clamp artifact) AND the linear-on-scaled-peak override invariant diverges from the wrong `s×clamp(...)` interpretation. V2 proves source sha256 byte-identical before/after a real 0.5× export + the bake-input object structurally unmutated. |
| 3  | EXPORT-03 (SC3): respects `loose \| atlas \| both`; scaled JSON is the one always-present new artifact | ✓ VERIFIED | Dispatch matrix branches on outputMode (variant-export.ts:168-191); JSON always written FIRST (line 164) regardless of mode. Package-layout test asserts `{NAME}.json` exists in ALL three modes per matrix cell, plus per-mode artifacts (loose→images/, atlas→.atlas+.png, both→union) and atlas-coherence (repacked .atlas covers every baked-JSON path: region). |
| 4  | EXPORT-05 (SC4): works for atlas-source + atlas-less AND 4.2 + 4.3 (variant behaves identically to master at smaller size — faithfulness bar) | ✓ VERIFIED | Package-layout matrix runs (4.2 SIMPLE_PROJECT, 4.3 SLIDER_4_3) × (atlas-source, atlas-less), 4.3-atlas-less scoped atlas-mode-only via the page-extraction fallback (deliberate, documented — SLIDER_4_3 has no images/). Faithfulness oracle proves per-attachment + aggregate world-AABB == exactly s× master on a 4.2 AND a 4.3 rig. Write path is runtime-agnostic (no spine-core import below bake — grep=0). |
| 5  | L-01: variant geometry produced ONLY by core bake() — no bone scaling | ✓ VERIFIED | `bake(sourceJson, s)` from core/scale-bake.ts is the sole geometry producer (variant-export.ts:112); faithfulness oracle (a) re-proves `parse(bake,1) ≡ parse(orig,scale=s)` field-identity on the export path's input. |
| 6  | L-02: `variant_peak = s × master_peak` by arithmetic; NEVER re-sampled in the variant path | ✓ VERIFIED | `grep -cE "sampleSkeleton\|runSamplerInWorker\|runSamplerJob" src/main/variant-export.ts src/core/scale-summary-peaks.ts` = 0. Sizing is pure arithmetic via scaleSummaryPeaks; the only sampling in the phase is the faithfulness PROOF (V6), which samples the PACKAGE, not the sizing path. |
| 7  | L-03: bake returns NEW JSON; source never mutated; first-ever skeleton-JSON disk write lives in main/ | ✓ VERIFIED | `writeSkeletonJsonAtomic` in src/main/skeleton-json-writer.ts (exists); `src/core/skeleton-json-writer.ts` ABSENT. Arch anchor (V8) asserts both. scale-summary-peaks is Layer-3 pure (grep for fs/sharp/electron, comments excluded = 0). |
| 8  | L-04: write path runtime-agnostic (no spine-core import below bake) | ✓ VERIFIED | `grep -cE "@esotericsoftware/spine-core\|spine-core-42"` in variant-export.ts / skeleton-json-writer.ts / scale-summary-peaks.ts all = 0. Dual-runtime absorbed by bake's schema-awareness; dual-mode by the existing pipeline branching. |
| 9  | D-07: variant inherits the user's FULL active export config; buildExportPlan reused UNCHANGED | ✓ VERIFIED | Handler threads effectiveOverrides + safetyBufferPercent + outputMode + atlasOpts + sharpen into buildExportPlan/runExport/runRepack. AppShell mount passes `effectiveOverrides={activeOverrides}` (mode-aware bucket) + all config locals. No new override routing built. |
| 10 | D-08: edge accepts 0<s<1, rejects s>=1 / NaN / <=0 with typed VariantScaleError; core bake stays direction-agnostic | ✓ VERIFIED | Guard FIRST at the edge (variant-export.ts:67); VariantScaleError class in core/errors.ts:228. V5 guard test asserts s=1.0/2.0/0/NaN rejected, s=0.5 proceeds, and `bake(json,1.0)` does NOT throw (Phase-48 D-09 preserved). Renderer adds a defense-in-depth disable (VariantDialog scale pre-check; renderer test asserts disabled at s=1.0/2.0/0). |
| 11 | D-01/D-02: layout `{PARENT}/{NAME}@{s}x/` with clean inner basenames; scale token from canonical formatScaleToken | ✓ VERIFIED | `outDir = join(parentDir, ${NAME}@${formatScaleToken(s)}x)`; inner `${NAME}.json` etc. clean. Package-layout test asserts NO inner basename has `@` and every entry matches `^${NAME}(\.json\|\.atlas\|\.png\|_\d+\.png)$`, anchoring the folder token to `formatScaleToken` by name. |
| 12 | D-04: NEW "Export Variant…" action, separate from Optimize; shipped Optimize flow untouched | ✓ VERIFIED | `git diff 6b08e94..HEAD -- src/main/ipc.ts` and `-- AppShell.tsx` show ZERO removed lines (pure additions). handleStartExport / export:start / OptimizeDialog byte-untouched. |

**Score:** 12/12 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/scale-summary-peaks.ts` | pure peak-only scaleSummaryPeaks (A1) | ✓ VERIFIED | 34 lines, structuredClone + multiply only peakScale/X/Y; Layer-3 pure; wired into variant-export.ts:123; data flows into buildExportPlan. |
| `src/core/errors.ts` (VariantScaleError) | typed edge error (D-08) | ✓ VERIFIED | Class at :228, extends Error, sets .name, carries readonly scale; used in variant-export.ts:68; V5 asserts the message. |
| `src/main/skeleton-json-writer.ts` | first-ever atomic JSON writer (throws, no indent, registers paths first) | ✓ VERIFIED | 26 lines; .tmp+rename; both paths added to `written` BEFORE writeFile; throws (no envelope); JSON.stringify with no indent. Wired into variant-export.ts:164. |
| `src/main/variant-export.ts` | handleExportVariant + formatScaleToken | ✓ VERIFIED | 230 lines; full orchestration; guard→read→bake→outDir→write-JSON-first→buildExportPlan→dispatch→one rollback Set; both helpers exported and consumed by tests + ipc.ts. |
| `src/shared/types.ts` (Api.exportVariant) | typed Api member | ✓ VERIFIED | Signature at :1449; both typechecks pass; preload `const api: Api` literal compiles against it. |
| `src/preload/index.ts` | window.api.exportVariant binding | ✓ VERIFIED | :127 binds → ipcRenderer.invoke('variant:export', …) in the typed arg order. |
| `src/main/ipc.ts` (variant:export channel) | registered channel delegating to handler | ✓ VERIFIED | ipcMain.handle('variant:export', …) at :1060 with the full coercion ladder → handleExportVariant. |
| `src/renderer/src/modals/VariantDialog.tsx` | single-pane dialog + scale field, invokes exportVariant | ✓ VERIFIED | 546 lines; no TabButton (=0); numeric scale field; reuses Optimize config controls; invokes window.api.exportVariant at :166. ⚠️ result-surfacing gap — see CR-01 below. |
| `src/renderer/src/components/AppShell.tsx` | toolbar action + onConfirmStartVariant + mount | ✓ VERIFIED | "Export Variant…" button (:2236), onClickExportVariant (:814), dedicated picker-only onConfirmStartVariant keyed to variantDialogState (:833, no exportDialogState refs), VariantDialog mount (:2581). |
| `tests/core/variant-sizing.spec.ts` | V1 s×master_peak (with/without overrides, no re-sample) | ✓ VERIFIED | Discriminating: proves sub-1.0 row + linear-override invariant ≠ wrong interpretation; no sampler import. |
| `tests/main/variant-source-immutable.spec.ts` | V2 source sha256 byte-identical | ✓ VERIFIED | sha256 before/after a real export + bake-input structural unmutated. |
| `tests/main/variant-scale-guard.spec.ts` | V5 D-08 guard + core-agnostic | ✓ VERIFIED | s>=1/NaN/0 rejected; s=0.5 proceeds; bake(1.0) does not throw. |
| `tests/main/variant-package-layout.spec.ts` | V3/V4/V7 layout + rollback over the matrix | ✓ VERIFIED | Drives real handleExportVariant; per-mode artifacts; clean basenames; JSON-in-all-modes; atlas coherence; oversize-forced rollback sweeps the JSON. |
| `tests/main/variant-dropin-faithful.spec.ts` | V6 geometry + cross-resolve + s× world-AABB (dual-runtime) | ✓ VERIFIED | Loads the WRITTEN package; per-attachment + aggregate world-AABB == s× master on 4.2 + 4.3. |
| `tests/arch.spec.ts` (V8 anchor) | scale-summary-peaks pure + writer in main | ✓ VERIFIED | Phase-49 named block (:406) asserts purity + writer-in-main / absent-from-core. |
| `tests/renderer/variant-dialog.spec.tsx` | EXPORT-01 renderer test | ✓ VERIFIED | Render + invoke-arg-order + s>=1/<=0 disabled. (Does NOT cover the partial-failure result path — see CR-01.) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| variant-export.ts | core/scale-bake.ts | `bake(sourceJson, s)` | ✓ WIRED | :112 |
| variant-export.ts | core/export.ts | `buildExportPlan(scaleSummaryPeaks(summary,s), …)` UNCHANGED | ✓ WIRED | :123 |
| variant-export.ts | skeleton-json-writer.ts | `writeSkeletonJsonAtomic(...)` FIRST inside try | ✓ WIRED | :164, before runExport/runRepack |
| ipc.ts | variant-export.ts | `ipcMain.handle('variant:export', …)` → handleExportVariant | ✓ WIRED | :1060→:1073 |
| preload/index.ts | ipc.ts | `window.api.exportVariant` → invoke('variant:export', …) | ✓ WIRED | :127→:139 |
| preload literal | types.ts Api | `const api: Api` typechecks against Api.exportVariant | ✓ WIRED | typecheck:web exit 0 |
| AppShell.tsx | VariantDialog.tsx | button → mount with config props + onConfirmStart={onConfirmStartVariant} | ✓ WIRED | :2581 |
| VariantDialog.tsx | window.api.exportVariant | onStart → invoke | ✓ WIRED | :166 (renderer test asserts 1 call, correct args) |
| AppShell onConfirmStartVariant | variant parent pick | `pickOutputDir(...)` keyed to variantDialogState, NOT exportDialogState | ✓ WIRED | :833-845 (no exportDialogState ref) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| handleExportVariant → written package | baked JSON + ExportPlan rows | `bake(JSON.parse(readFile(source)))` + `buildExportPlan(scaleSummaryPeaks(summary,s))` | Yes — real source JSON read, real bake, real export pipeline | ✓ FLOWING (package-layout test asserts real files on disk; faithfulness oracle loads + samples them) |
| VariantDialog complete-state | `summary` (ExportSummary) + `errorMessage` | `window.api.exportVariant(...)` response | Yes on response.ok; BUT `summary.errors[]` is dropped (errorMessage forced null) | ⚠️ HOLLOW (partial) — see CR-01. Happy-path data flows correctly; worker-reported partial failures are not surfaced. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full variant suite (V1–V8) | `npx vitest run tests/core/variant-sizing.spec.ts tests/main/variant-*.spec.ts tests/arch.spec.ts tests/renderer/variant-dialog.spec.tsx` | 5+2 files, 60 tests passed | ✓ PASS |
| Faithfulness oracle (s× world-AABB, dual-runtime) | included above | 8 tests passed | ✓ PASS |
| Full test suite (regression check) | `npx vitest run` | 147 files, 1493 passed, 5 skipped, 2 todo, 0 failures | ✓ PASS |
| typecheck:node | `tsc -p tsconfig.node.json --noEmit` | exit 0, 0 errors | ✓ PASS |
| typecheck:web | `tsc -p tsconfig.web.json --noEmit` | exit 0, 0 errors | ✓ PASS |
| Native folder picker + visual half-size render | (Electron / WebGL) | not runnable headlessly | ? SKIP → human |

Note: the documented pre-existing failures (Girl / SAMPLER_ALPHA_ZERO missing-fixture, ~11 MixBlend imports) did NOT appear in this run — the suite is fully green, exceeding the SUMMARY claims.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXPORT-01 | 49-01, 49-02, 49-03 | Export a single scaled-down variant as a drop-in package | ✓ SATISFIED | Truth #1; engine + renderer + package/faithfulness tests. Native-dialog end-state → human UAT. |
| EXPORT-02 | 49-01 | Variant sizes = `s × master_peak`, reuse pipeline, source never modified | ✓ SATISFIED | Truth #2; V1 + V2. |
| EXPORT-03 | 49-01, 49-02, 49-03 | Respect `loose \| atlas \| both`; JSON always-present | ✓ SATISFIED | Truth #3; V3. |
| EXPORT-05 | 49-01, 49-03 | atlas-source + atlas-less; 4.2 + 4.3 | ✓ SATISFIED | Truth #4; V6 + V7 matrix. |

All 4 declared requirement IDs map to Phase 49 in REQUIREMENTS.md (lines 74-77) and are accounted for. No orphaned requirements: EXPORT-04 is mapped to Phase 51, SCALEUI-01/02 to Phase 50 — both correctly out of this phase's scope.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/renderer/src/modals/VariantDialog.tsx | 177-197, 476-486 | success branch sets `errorMessage=null` and complete-state ignores `summary.errors[]` | ⚠️ Warning (CR-01) | A worker partial/total failure (e.g. overwrite collision on re-export — overwrite hardcoded false at AppShell:844; writer has no overwrite gate so JSON is replaced while images are refused) renders as "0 files exported" success → misleading result / mismatched package. Happy-path (fresh folder) unaffected. |
| src/main/variant-export.ts | 123-126 | buildExportPlan/scaleSummaryPeaks call sits OUTSIDE the try (try begins :161) | ℹ️ Info (WR-01) | A malformed summary would reject the IPC promise instead of returning a clean envelope. Not triggerable on the verified happy-path; renderer has no try/catch around the await (WR-02) so the dialog could wedge in "in-progress". |
| src/main/variant-export.ts | 49-51 | `formatScaleToken = String(s)` | ℹ️ Info (WR-03) | `<input step="0.05">` float drift could produce `@0.30000000000000004x` folder names. Tests only exercise s=0.5 so never tripped. Cosmetic; does not affect drop-in faithfulness. |
| src/main/variant-export.ts | 130-147 | source-collision guard reads only `plan.rows[0]` | ℹ️ Info (WR-04) | Bypassed for an all-passthrough project shape; per-row F_OK guard in runExport is the backstop. |
| src/main/ipc.ts / variant-export.ts | re-entrancy / buffer bound | no in-flight guard; safetyBufferPercent not re-clamped main-side | ℹ️ Info (WR-05/WR-06) | Parity gaps vs export:start; buildExportPlan caps at source dims so no upscale; trust-boundary hardening only. |

None of these are BLOCKERs — the phase goal's happy path is achieved and proven. CR-01 is elevated to a WARNING with a human decision because it borders on silent data-integrity (a corrupt re-export presented as success).

### Human Verification Required

1. **"Export Variant…" native end-to-end UAT (EXPORT-01)** — documented manual-only (49-VALIDATION.md). In `npm run dev`, open a 4.2 and a 4.3 project, click "Export Variant…", enter 0.5, pick a PARENT folder via the native dialog, Export. Confirm `{NAME}@0.5x/` appears with the correct artifacts for the active output mode AND the variant renders in the viewer at exactly half the master size. (UAT criterion is the *rendered* end-state, not "the dialog opened" — avoid the opened≠rendered trap.) Record in `49-HUMAN-UAT.md`.

2. **Re-export-into-existing-folder result surfacing (CR-01)** — Export a variant once (fresh folder → succeeds), then export the SAME scale into the SAME parent again. Decide whether the dialog reporting the worker's overwrite-collision as success ("0 files exported", no error shown, JSON silently replaced) is acceptable to ship, or must be fixed (surface `summary.errors[]` like OptimizeDialog, and/or gate the JSON write on overwrite / drive a probe-then-confirm) before EXPORT-01 sign-off.

### Gaps Summary

No must-have FAILED. All 12 observable truths and all 4 ROADMAP success criteria are verified against substantive, wired, data-flowing code, with discriminating headless tests (V1–V8) green, a fully green full suite (1493 passed / 0 failures), and both typechecks clean. The bake-driven `s × master_peak` faithfulness is proven by sampling the LOADED written package on both runtimes.

Status is **human_needed** (not passed) for two reasons, in priority order per the gate decision tree: (1) the EXPORT-01 native-dialog + visual half-size end-state is a documented manual-only UAT that the headless layer structurally cannot cover; and (2) the advisory code review's CR-01 — the renderer presents worker partial/total failures as success on the re-export path — is a real result-surfacing / data-integrity gap that warrants a maintainer decision. CR-01 does NOT block the happy-path goal (first export to a fresh folder is fully correct), so it is classified WARNING, not BLOCKER.

---

_Verified: 2026-05-22_
_Verifier: Claude (gsd-verifier)_
