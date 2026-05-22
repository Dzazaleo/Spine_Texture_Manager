---
phase: 49-single-scale-variant-export
verified: 2026-05-22T17:10:00Z
status: human_needed
score: 12/12 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/12
  trigger: "Code-review fixes applied (CR-01 blocker + WR-01..06 warnings) — commits f2e1c16, f905f8c, 268e8fd, 2b82b82; annotated b375f62"
  gaps_closed:
    - "CR-01 partial-failure result-surfacing — was a human-decision item; now resolved in code on both legs (main-side overwrite gate + renderer errors[] surfacing). Human item REMOVED."
  gaps_remaining: []
  regressions: []
  invariants_reconfirmed:
    - "Layer-3 purity (src/core/) — fixes touched ZERO core files (git diff f2e1c16~1..2b82b82 -- src/core/ = empty)"
    - "L-01 bake-only geometry, L-02 no re-sample, L-04 no spine-core below bake — all grep=0, core untouched"
    - "D-04 shipped Optimize flow byte-untouched — ipc.ts/AppShell.tsx 0 removed lines; OptimizeDialog.tsx 0 changes"
human_verification:
  - test: "\"Export Variant…\" native end-to-end UAT (EXPORT-01) on a 4.2 AND a 4.3 project"
    expected: "In `npm run dev`: click \"Export Variant…\", enter 0.5, pick a PARENT folder via the native dialog, Export → a {NAME}@0.5x/ folder appears with the correct artifacts for the active output mode, and the variant renders in the viewer at exactly half the master size (rendered end-state, NOT just \"dialog opened\")."
    why_human: "Electron native folder picker + real WebGL render cannot be exercised in jsdom; automated coverage stops at the IPC handler (per 49-VALIDATION.md Manual-Only). Documented UAT to record in 49-HUMAN-UAT.md."
---

# Phase 49: Single-Scale Variant Export — Verification Report

**Phase Goal:** Deliver the first end-user value — export one scaled-down variant to a chosen folder as a complete, drop-in package (scaled skeleton JSON + resized textures + scaled atlas), reusing the existing export-sizing + atlas-writer pipeline and sizing textures arithmetically (`variant_peak = s × master_peak`, never by re-sampling the variant); respecting output modes `loose | atlas | both`; dual-runtime (4.2 + 4.3) × dual loader-mode (atlas-source + atlas-less); source JSON never modified; first feature to WRITE a skeleton JSON; variant never re-sampled.
**Verified:** 2026-05-22T17:10:00Z
**Status:** human_needed
**Re-verification:** Yes — after code-review gap closure (CR-01 + WR-01..06 fixed)

## Re-Verification Summary

The initial verification passed 12/12 must-haves (`human_needed`, with two human items: the native-dialog UAT and a maintainer decision on the CR-01 partial-failure result-surfacing). Since then the code reviewer's **CR-01 blocker and all six WR-01..06 warnings were FIXED** (commits `f2e1c16`, `f905f8c`, `268e8fd`, `2b82b82`; annotated in 49-REVIEW.md by `b375f62`). This re-verification confirms, against the codebase (not the SUMMARY/REVIEW claims):

1. **The 12 must-haves STILL hold** — the fixes did not regress the goal. The fix commits touched ONLY `src/main/variant-export.ts`, `src/main/skeleton-json-writer.ts`, `src/renderer/.../VariantDialog.tsx`, and added two tests to `tests/renderer/variant-dialog.spec.tsx`. **`src/core/` was touched by ZERO fix commits** (`git diff f2e1c16~1..2b82b82 -- src/core/` is empty), so every Layer-3 invariant (L-01/L-02/L-04 + scale-summary-peaks purity) is mechanically unchanged.
2. **CR-01 is genuinely resolved in code on BOTH legs** (see below) — its former human-decision item is closed.
3. **D-04 (shipped Optimize flow byte-untouched) still holds** — `ipc.ts` and `AppShell.tsx` have 0 removed lines vs. phase start (`6b08e94`); `OptimizeDialog.tsx` is wholly unchanged.

**Net change vs. prior report:** human items 2 → 1 (the CR-01 decision item is closed by the fix; only the structurally-manual native-dialog + visual half-size UAT remains, which is expected and acceptable). Targeted variant suite 60 → 62 tests (the 2 new CR-01 + WR-02 regression tests landed). Score unchanged at 12/12. Status remains `human_needed` solely because of the one structurally-manual UAT.

## CR-01 Resolution Verification (was the blocker)

CR-01 ("variant export reports per-file failures as success — silent data loss / misleading result") is fixed on the two distinct legs the review called out, and both are verified in the actual code:

| Leg | Where | Fixed? | Code evidence |
|-----|-------|--------|---------------|
| Main-side: JSON write must not silently replace `{NAME}.json` while images are refused | `src/main/skeleton-json-writer.ts:24-47` | ✓ YES | `writeSkeletonJsonAtomic` now takes `allowOverwrite: boolean = true`; when `!allowOverwrite` and the target exists it **throws** `Refusing to overwrite existing file: …` (lines 33-40), which the orchestrator's step-10 `catch` (variant-export.ts:283-295) sweeps via the shared `written` Set → rolled-back error envelope, not silent corruption. `handleExportVariant` passes the user's `overwrite` through at the call site (variant-export.ts:230). |
| Renderer: a worker partial/total failure (`ok:true` + non-empty `summary.errors[]`) must NOT render as success | `src/renderer/.../VariantDialog.tsx:183-195, 515-547` | ✓ YES | On `response.ok`, the dialog now sets `errorMessage` to `${successes} exported, ${failed} failed.` when `summary.errors.length > 0` (lines 191-195), and the complete-state body renders a per-row `<ul>` of `{path}: {message}` mirroring OptimizeDialog (lines 533-547). The "N files exported" success copy renders ONLY when `errorMessage === null` (line 517). |

**Discriminating regression test (proves the OLD bug is dead):** `tests/renderer/variant-dialog.spec.tsx` — *"CR-01: surfaces per-row worker failures when the IPC returns ok:true with a non-empty errors[]"* — mocks `exportVariant → { ok:true, summary:{ successes:0, errors:[overwrite-source] } }`, then asserts `0 succeeded, 1 failed.` AND the per-row "Refusing to overwrite…" text are visible, AND that `/files? exported\./` is **NOT** present. This is the exact scenario the review described; it is now caught by an automated test.

## Goal Achievement

### Observable Truths

The phase's must-haves are the 4 ROADMAP Success Criteria (EXPORT-01/02/03/05) merged with the plan-frontmatter truths (the L-xx invariants + the D-xx decisions). All remain backed by substantive, wired, data-flowing code with passing discriminating tests. Items re-confirmed against the post-fix code; items affected by a fix are annotated.

| #  | Truth (source) | Status | Evidence |
|----|----------------|--------|----------|
| 1  | EXPORT-01 (SC1): user can export a single scaled-down variant to a chosen folder as a drop-in package (baked JSON + resized textures + per-mode atlas), usable as-is | ✓ VERIFIED | Engine `handleExportVariant` (variant-export.ts:69-301) composes guard→read→bake→`{NAME}@{s}x/`→write-JSON-first→buildExportPlan(scaled)→dispatch, now under a re-entrancy guard + clamped buffer. Renderer leg wired: "Export Variant…" toolbar button (AppShell:2236) → VariantDialog → `window.api.exportVariant` (renderer test asserts ONE call, exact typed arg order, VariantDialog.tsx:172-182). Package-layout test (V3) proves the written folder is a real drop-in across the matrix; faithfulness oracle (V6) loads the WRITTEN package and samples it. (Native-dialog + visual half-size end-state → human UAT.) |
| 2  | EXPORT-02 (SC2): variant texture sizes = `s × master_peak`, reusing buildExportPlan; source project never modified | ✓ VERIFIED | `scaleSummaryPeaks` (peak-only A1, core, unchanged by fixes) feeds `buildExportPlan` UNCHANGED (variant-export.ts:172). V1 sizing test proves a genuine sub-1.0 row + the linear-on-scaled-peak override invariant. V2 proves source sha256 byte-identical before/after a real 0.5× export + bake-input structurally unmutated. |
| 3  | EXPORT-03 (SC3): respects `loose \| atlas \| both`; scaled JSON is the one always-present new artifact | ✓ VERIFIED | Dispatch matrix branches on outputMode (variant-export.ts:234-257); JSON always written FIRST (line 230) regardless of mode. Package-layout test asserts `{NAME}.json` in ALL three modes + per-mode artifacts + atlas-coherence. |
| 4  | EXPORT-05 (SC4): works for atlas-source + atlas-less AND 4.2 + 4.3 (faithfulness bar) | ✓ VERIFIED | Package-layout matrix (4.2 SIMPLE_PROJECT, 4.3 SLIDER_4_3) × (atlas-source, atlas-less). Faithfulness oracle proves per-attachment + aggregate world-AABB == exactly s× master on 4.2 AND 4.3. Write path runtime-agnostic (grep spine-core in the three variant files = 0; re-confirmed post-fix). |
| 5  | L-01: variant geometry produced ONLY by core bake() — no bone scaling | ✓ VERIFIED | `bake(sourceJson, s)` is the sole geometry producer (variant-export.ts:155); core unchanged by fixes; faithfulness oracle re-proves `parse(bake,1) ≡ parse(orig,scale=s)` field-identity. |
| 6  | L-02: `variant_peak = s × master_peak` by arithmetic; NEVER re-sampled in the variant path | ✓ VERIFIED | `grep -cE "sampleSkeleton\|runSamplerInWorker\|runSamplerJob" src/main/variant-export.ts src/core/scale-summary-peaks.ts` = 0 (re-run post-fix). Sizing is pure arithmetic via scaleSummaryPeaks. |
| 7  | L-03: bake returns NEW JSON; source never mutated; first-ever skeleton-JSON disk write lives in main/ | ✓ VERIFIED | `writeSkeletonJsonAtomic` in src/main/skeleton-json-writer.ts (now with the CR-01 overwrite gate); `src/core/skeleton-json-writer.ts` ABSENT (`ls` → No such file). Arch anchor (V8) asserts both. |
| 8  | L-04: write path runtime-agnostic (no spine-core import below bake) | ✓ VERIFIED | `grep -cE "@esotericsoftware/spine-core\|spine-core-42"` in variant-export.ts / skeleton-json-writer.ts / scale-summary-peaks.ts all = 0 (re-run post-fix). |
| 9  | D-07: variant inherits the user's FULL active export config; buildExportPlan reused UNCHANGED | ✓ VERIFIED | Handler threads effectiveOverrides + (now clamped) safetyBufferPercent + outputMode + atlasOpts + sharpen into buildExportPlan/runExport/runRepack. AppShell mount passes `effectiveOverrides={activeOverrides}` + config locals (AppShell:2588-2606). No new override routing built. |
| 10 | D-08: edge accepts 0<s<1, rejects s>=1 / NaN / <=0 with typed VariantScaleError; core bake stays direction-agnostic | ✓ VERIFIED | Guard FIRST at the edge (variant-export.ts:92); VariantScaleError in core/errors.ts. V5 guard test asserts s=1.0/2.0/0/NaN rejected, s=0.5 proceeds, `bake(json,1.0)` does NOT throw. Renderer defense-in-depth disable preserved. |
| 11 | D-01/D-02: layout `{PARENT}/{NAME}@{s}x/` with clean inner basenames; scale token from canonical formatScaleToken | ✓ VERIFIED | `outDir = join(parentDir, ${NAME}@${formatScaleToken(s)}x)` (variant-export.ts:129); inner `${NAME}.json` clean (line 230). `formatScaleToken` now `String(Number(s.toFixed(4)))` (WR-03, line 58); renderer `folderHint` uses the same inline normalization (VariantDialog.tsx:267) so display ≡ on-disk. Package-layout test asserts NO inner basename has `@`. |
| 12 | D-04: NEW "Export Variant…" action, separate from Optimize; shipped Optimize flow untouched | ✓ VERIFIED | `git diff 6b08e94..HEAD -- src/main/ipc.ts` and `-- AppShell.tsx` = ZERO removed lines (pure additions); `OptimizeDialog.tsx` 0 changes. The 4 FIX commits also touched no core file and no Optimize artifact (`git diff f2e1c16~1..2b82b82 -- src/core/` empty). |

**Score:** 12/12 truths verified

### Code-Review Fix Verification (CR-01 + WR-01..06)

Each fix confirmed present and substantive in the actual code (not a claim):

| Finding | Claimed fix | Status | Code evidence |
|---------|-------------|--------|---------------|
| CR-01 | overwrite gate on JSON write + renderer surfaces errors[] | ✓ RESOLVED | skeleton-json-writer.ts:24-40 (`allowOverwrite` gate, throws); VariantDialog.tsx:191-195 + 533-547 (errors surfaced). Plus discriminating regression test (above). |
| WR-01 | try/catch around scaleSummaryPeaks+buildExportPlan → error envelope | ✓ RESOLVED | variant-export.ts:171-181 — plan build wrapped, returns `{ ok:false, error:{ kind:'Unknown', message } }`. |
| WR-02 | renderer await of exportVariant wrapped → rejection reaches complete/error state | ✓ RESOLVED | VariantDialog.tsx:168-227 — try/catch synthesizes a failure summary + `setState('complete')`. Discriminating regression test asserts Close button appears + no wedged "Exporting…". |
| WR-03 | formatScaleToken strips float artifacts | ✓ RESOLVED | variant-export.ts:57-59 (`String(Number(s.toFixed(4)))`); renderer folderHint mirrors at VariantDialog.tsx:267. |
| WR-04 | collision sentinel covers the all-passthrough case | ✓ RESOLVED | variant-export.ts:191 — `const collisionSentinel = plan.rows[0] ?? plan.passthroughCopies[0]`. |
| WR-05 | variant re-entrancy guard | ✓ RESOLVED | variant-export.ts:67 (`variantExportInFlight`), checked first (86-88), claimed before first await (135), released in finally (296-299). Separate variant-scoped flag (D-04: Optimize slot untouched). |
| WR-06 | handleExportVariant re-validates safetyBufferPercent at the IPC boundary | ✓ RESOLVED | variant-export.ts:112-114 — NaN/non-finite→0, `Math.trunc`, clamp `[0,25]`; fed into buildExportPlan at line 174. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/scale-summary-peaks.ts` | pure peak-only scaleSummaryPeaks (A1) | ✓ VERIFIED | 34 lines; structuredClone + multiply only peakScale/X/Y; Layer-3 pure (grep fs/sharp/spine-core/electron = 0); **untouched by the fixes**; wired into variant-export.ts:172. |
| `src/core/errors.ts` (VariantScaleError) | typed edge error (D-08) | ✓ VERIFIED | Class extends Error, sets .name, carries readonly scale; used in variant-export.ts:93; untouched by fixes. |
| `src/main/skeleton-json-writer.ts` | first-ever atomic JSON writer (throws; registers paths first) + CR-01 overwrite gate | ✓ VERIFIED | 47 lines (was 26); `.tmp`+rename; both paths added to `written` BEFORE writeFile; throws; no indent; NEW `allowOverwrite` gate (CR-01). Wired into variant-export.ts:230. |
| `src/main/variant-export.ts` | handleExportVariant + formatScaleToken | ✓ VERIFIED | 301 lines (was 230); full orchestration + re-entrancy guard + clamped buffer + try/caught plan build + dual-bucket collision sentinel; both helpers exported and consumed by tests + ipc.ts. |
| `src/shared/types.ts` (Api.exportVariant) | typed Api member | ✓ VERIFIED | Signature present; both typechecks pass (exit 0). |
| `src/preload/index.ts` | window.api.exportVariant binding | ✓ VERIFIED | Binds → ipcRenderer.invoke('variant:export', …) in typed arg order. |
| `src/main/ipc.ts` (variant:export channel) | registered channel delegating to handler | ✓ VERIFIED | ipcMain.handle('variant:export', …) → handleExportVariant; 0 removed lines vs. phase start. |
| `src/renderer/src/modals/VariantDialog.tsx` | single-pane dialog + scale field, invokes exportVariant, surfaces errors | ✓ VERIFIED | ~560 lines; no TabButton; numeric scale field; reuses Optimize config controls; invokes window.api.exportVariant at :172; **CR-01 result-surfacing now present** (191-195, 533-547); WR-02 try/catch (168-227). |
| `src/renderer/src/components/AppShell.tsx` | toolbar action + onConfirmStartVariant + mount | ✓ VERIFIED | "Export Variant…" button (:2236), onClickExportVariant (:814), picker-only onConfirmStartVariant keyed to variantDialogState returning `overwrite:false` (:833-845), VariantDialog mount (:2580); 0 removed lines vs. phase start. |
| `tests/core/variant-sizing.spec.ts` | V1 s×master_peak | ✓ VERIFIED | Discriminating; no sampler import. |
| `tests/main/variant-source-immutable.spec.ts` | V2 source sha256 byte-identical | ✓ VERIFIED | sha256 before/after + bake-input unmutated. |
| `tests/main/variant-scale-guard.spec.ts` | V5 D-08 guard | ✓ VERIFIED | s>=1/NaN/0 rejected; s=0.5 proceeds; bake(1.0) does not throw. |
| `tests/main/variant-package-layout.spec.ts` | V3/V4/V7 layout + rollback over the matrix | ✓ VERIFIED | Drives real handleExportVariant; per-mode artifacts; clean basenames; JSON-in-all-modes; atlas coherence; oversize-forced rollback sweeps the JSON. |
| `tests/main/variant-dropin-faithful.spec.ts` | V6 geometry + cross-resolve + s× world-AABB (dual-runtime) | ✓ VERIFIED | Loads the WRITTEN package; per-attachment + aggregate world-AABB == s× master on 4.2 + 4.3. |
| `tests/arch.spec.ts` (V8 anchor) | scale-summary-peaks pure + writer in main | ✓ VERIFIED | Phase-49 named block asserts purity + writer-in-main / absent-from-core. |
| `tests/renderer/variant-dialog.spec.tsx` | EXPORT-01 renderer test + CR-01 + WR-02 regression | ✓ VERIFIED | Render + invoke-arg-order + s>=1/<=0 disabled, PLUS the 2 NEW discriminating regression tests (CR-01 errors[] surfacing; WR-02 rejected-promise → complete error state). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| variant-export.ts | core/scale-bake.ts | `bake(sourceJson, s)` | ✓ WIRED | :155 |
| variant-export.ts | core/export.ts | `buildExportPlan(scaleSummaryPeaks(summary,s), …)` UNCHANGED, try/caught | ✓ WIRED | :171-181 |
| variant-export.ts | skeleton-json-writer.ts | `writeSkeletonJsonAtomic(..., overwrite)` FIRST inside try | ✓ WIRED | :230, before runExport/runRepack; overwrite gate now threaded |
| ipc.ts | variant-export.ts | `ipcMain.handle('variant:export', …)` → handleExportVariant | ✓ WIRED | unchanged channel |
| preload/index.ts | ipc.ts | `window.api.exportVariant` → invoke('variant:export', …) | ✓ WIRED | typed arg order |
| preload literal | types.ts Api | `const api: Api` typechecks against Api.exportVariant | ✓ WIRED | typecheck:web exit 0 |
| AppShell.tsx | VariantDialog.tsx | button → mount with config props + onConfirmStart={onConfirmStartVariant} | ✓ WIRED | :2580-2607 |
| VariantDialog.tsx | window.api.exportVariant | onStart → invoke (try/caught) | ✓ WIRED | :172 (renderer test asserts 1 call, correct args) |
| VariantDialog complete-state | summary.errors[] | per-row `<ul>` render | ✓ WIRED | :533-547 (CR-01 fix — was ORPHANED/HOLLOW, now flowing) |
| AppShell onConfirmStartVariant | variant parent pick | `pickOutputDir(...)` keyed to variantDialogState, returns overwrite:false | ✓ WIRED | :833-845 (no exportDialogState ref) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| handleExportVariant → written package | baked JSON + ExportPlan rows | `bake(JSON.parse(readFile(source)))` + `buildExportPlan(scaleSummaryPeaks(summary,s))` | Yes — real source JSON read, real bake, real export pipeline | ✓ FLOWING (package-layout test asserts real files on disk; faithfulness oracle loads + samples them) |
| VariantDialog complete-state | `summary` (ExportSummary) + `errorMessage` | `window.api.exportVariant(...)` response | Yes — happy-path success line on empty errors[]; partial/total failures now surfaced via errorMessage + per-row list | ✓ FLOWING (CR-01 FIXED — was ⚠️ HOLLOW; `summary.errors[]` is now consumed: errorMessage set at :191-195, list rendered at :533-547; regression test proves it) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full variant suite (V1–V8 + renderer incl. 2 new regression tests) | `npx vitest run tests/core/variant-sizing.spec.ts tests/main/variant-*.spec.ts tests/arch.spec.ts tests/renderer/variant-dialog.spec.tsx` | 7 files, **62 tests passed** (was 60; +CR-01 +WR-02) | ✓ PASS |
| CR-01 regression (partial-failure NOT shown as success) | included above | passes (asserts "0 succeeded, 1 failed" + per-row error visible, success copy absent) | ✓ PASS |
| WR-02 regression (rejected promise → complete error state) | included above | passes (asserts Close button present, no wedged "Exporting…") | ✓ PASS |
| typecheck (node + web) | `npm run typecheck` | exit 0, 0 errors | ✓ PASS |
| Full suite (reported by orchestrator) | `npx vitest run` | 147 files / 1495 passed / 0 failures (incl. the 2 new regression tests) | ✓ PASS (reported; targeted re-run + typecheck independently confirmed) |
| Layer-3 purity / no-spine-core / no-resample (re-run post-fix) | `grep -cE` on the 3 variant files | all 0 | ✓ PASS |
| Fixes touched src/core/ ? | `git diff f2e1c16~1..2b82b82 -- src/core/` | empty | ✓ PASS (core untouched) |
| D-04 Optimize byte-untouched | `git diff 6b08e94..HEAD -- ipc.ts AppShell.tsx` removed lines; OptimizeDialog.tsx diff | 0 / 0 / no changes | ✓ PASS |
| Native folder picker + visual half-size render | (Electron / WebGL) | not runnable headlessly | ? SKIP → human |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| EXPORT-01 | 49-01, 49-02, 49-03 | Export a single scaled-down variant as a drop-in package | ✓ SATISFIED | Truth #1; engine + renderer + package/faithfulness tests; CR-01 result-surfacing now correct. Native-dialog end-state → human UAT. |
| EXPORT-02 | 49-01 | Variant sizes = `s × master_peak`, reuse pipeline, source never modified | ✓ SATISFIED | Truth #2; V1 + V2; core untouched by fixes. |
| EXPORT-03 | 49-01, 49-02, 49-03 | Respect `loose \| atlas \| both`; JSON always-present | ✓ SATISFIED | Truth #3; V3. |
| EXPORT-05 | 49-01, 49-03 | atlas-source + atlas-less; 4.2 + 4.3 | ✓ SATISFIED | Truth #4; V6 + V7 matrix. |

All 4 declared requirement IDs map to Phase 49 in REQUIREMENTS.md (lines 35-39, 74-77). No orphaned requirements: EXPORT-04 → Phase 51, SCALEUI-01/02 → Phase 50 — both correctly out of this phase's scope.

### Anti-Patterns Found

Re-scan of the post-fix code. The prior report's CR-01 + WR-01..06 entries are now CLEARED (each verified resolved above). Remaining items are the 3 deferred INFO findings from 49-REVIEW.md, none of which are blockers or regressions:

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/main/variant-export.ts | 78 | `effectiveOverrides` default `= new Map()` dead in practice (IN-01) | ℹ️ Info (deferred) | The IPC handler always supplies a Map. Harmless defense-in-depth default; reviewer marked optional. |
| src/core/scale-summary-peaks.ts | 28-32 | scales `peaks` (DisplayRow[]) that buildExportPlan never reads (IN-02) | ℹ️ Info (deferred) | Superfluous but keeps the cloned summary internally consistent; not incorrect. |
| src/main/variant-export.ts | 97-99 | `parentDir` trusted without `isAbsolute`/traversal check (IN-03) | ℹ️ Info (deferred) | Native picker always returns absolute; `NAME` is `basename`-sanitized; mirrors pre-existing handleStartExport posture. Parity awareness only. |

None are BLOCKERs. The CR-01 borderline-data-integrity concern that drove the prior WARNING is RESOLVED in code (overwrite gate + error surfacing + regression test).

### Human Verification Required

1. **"Export Variant…" native end-to-end UAT (EXPORT-01)** — documented manual-only (49-VALIDATION.md). In `npm run dev`, open a 4.2 and a 4.3 project, click "Export Variant…", enter 0.5, pick a PARENT folder via the native dialog, Export. Confirm `{NAME}@0.5x/` appears with the correct artifacts for the active output mode AND the variant renders in the viewer at exactly half the master size. (UAT criterion is the *rendered* end-state, not "the dialog opened" — avoid the opened≠rendered trap.) Record in `49-HUMAN-UAT.md`.

   *(This is the single expected, structurally-manual item — Electron native picker + real WebGL render cannot be exercised in jsdom. Acceptable as human-only.)*

**CLOSED since the prior report:** the CR-01 "re-export-into-existing-folder result surfacing" decision item is no longer a human item — the deviation it flagged is now fixed in code (main-side overwrite gate prevents silent JSON replacement; renderer surfaces `summary.errors[]`; a discriminating regression test guards both), so it requires no maintainer decision.

### Gaps Summary

No must-have FAILED. After gap closure, all 12 observable truths and all 4 ROADMAP success criteria remain verified against substantive, wired, data-flowing code. The CR-01 blocker is resolved on both legs (verified in `skeleton-json-writer.ts:24-40` and `VariantDialog.tsx:191-195/533-547`, plus a new discriminating regression test). All six WR-01..06 warnings are resolved in code. The fixes were surgically scoped: ZERO `src/core/` files touched (Layer-3 purity, L-01/L-02/L-04 mechanically intact) and ZERO Optimize-flow lines touched (D-04 holds). Targeted suite green at 62 tests; `npm run typecheck` exit 0; full suite reported 1495 passed / 0 failures.

Status remains **human_needed** for exactly one reason, per the gate decision tree: the EXPORT-01 native-dialog + visual half-size end-state is a documented manual-only UAT that the headless layer structurally cannot cover. This is expected and acceptable. There are no remaining automated gaps and no remaining maintainer decisions.

---

_Verified: 2026-05-22T17:10:00Z (re-verification after CR-01 + WR-01..06 gap closure)_
_Verifier: Claude (gsd-verifier)_
