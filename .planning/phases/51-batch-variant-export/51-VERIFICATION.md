---
phase: 51-batch-variant-export
verified: 2026-05-23T15:18:00Z
status: human_needed
score: 2/2 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Live in-app batch run: open Export Variant on a real loaded project, add a second scale row (e.g. 0.36 + 0.57), pick ONE parent folder, click Export Variants."
    expected: "Exactly two sibling folders {NAME}@0.57x/ and {NAME}@0.36x/ are written under the picked parent; the complete state shows '2 of 2 exported' with one row per folder; only one folder picker appeared (D-12)."
    why_human: "Automated tests stub the window.api IPC boundary and run headless (jsdom + direct main-fn calls). The real Electron picker + real on-disk fan-out through the packaged renderer→preload→main path is not exercised by vitest."
  - test: "Live continue-on-error + cancel UX: trigger one variant to fail (e.g. re-export into an existing folder with overwrite off) in a 3-scale batch, and separately click Cancel mid-batch."
    expected: "The failed variant shows ✗ with its reason while the others land; clicking Cancel after the first variant records the remaining scales as ⊘ skipped (in-flight variant finishes intact)."
    why_human: "The batch-progress prefix, the live Cancel affordance, and the per-folder result list rendering against a real running batch (timing-dependent) cannot be observed programmatically; WR-05 also notes the Cancel button gives no in-flight feedback — a human should confirm the perceived behavior is acceptable."
---

# Phase 51: Batch Variant Export Verification Report

**Phase Goal:** Fan one master out to many resolutions in a single operation — N scales → N folders — reusing the single-scale export per scale.
**Verified:** 2026-05-23T15:18:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SC#1 — The user can export multiple scales in one batch run, each variant written to its own folder. (EXPORT-04) | ✓ VERIFIED | `handleExportVariantBatch` (variant-export.ts:368-460) loops `exportOneVariant` per scale, writing one `{NAME}@{token}x/` folder each. Renderer `onStart` fires exactly ONE `window.api.exportVariantBatch(props.summary, props.rows.map(r => r.scale), …)` (VariantDialog.tsx:278-289). Test "single call" asserts one batch call with `callArgs[1].toEqual([0.5,0.36])` + one picker. Matrix test asserts `batch.results.length === SCALES.length` and both folders land. 12/12 main + 7/7 renderer batch tests pass. |
| 2   | SC#2 — Each batch variant is a complete drop-in package identical to the single-scale path output for that scale, respecting output mode, across dual-runtime (4.2+4.3) × dual-mode (atlas-source + atlas-less). (EXPORT-04) | ✓ VERIFIED | Satisfied BY CONSTRUCTION (batch loops the verbatim-extracted `exportOneVariant` — the SAME body `handleExportVariant` wraps) AND PROVEN EMPIRICALLY: `variant-batch-faithful.spec.ts` byte-compares `{NAME}.json` + `{NAME}.atlas` of batch output vs N× single-call output over all 4 matrix cells (4.2/4.3 × atlas-source/atlas-less), `aJson.toEqual(bJson)` + `aAtlas.toEqual(bAtlas)`. Test PASSES (12/12). |

**Score:** 2/2 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/main/variant-export.ts` | exportOneVariant (un-guarded) + handleExportVariant (wrapper) + handleExportVariantBatch (loop) + cancel flag | ✓ VERIFIED | All present (lines 82, 315, 368). `grep -c 'export async function handleExportVariantBatch'`=1; `async function exportOneVariant`=1; `let variantBatchCancelRequested`=1; `new Set<string>`=1 (per-variant only, Pitfall 4 holds — NO batch-wide Set). |
| `src/shared/types.ts` | BatchVariantResult type + Api members | ✓ VERIFIED | `BatchVariantResult` interface at line 617 (4 statuses); `exportVariantBatch` (1495), `cancelVariantBatch` (1552), `onVariantBatchProgress` (1565) Api members present. |
| `src/main/ipc.ts` | variant:exportBatch + variant:cancelBatch channels | ✓ VERIFIED | `variant:exportBatch` handler (1102) with finite-scale coercion `.filter((n) => Number.isFinite(n))` (1118); `variant:cancelBatch` one-way (1142) → `setVariantBatchCancelRequested()`; both handler fns imported (71-72). |
| `src/preload/index.ts` | exportVariantBatch + cancelVariantBatch + onVariantBatchProgress bindings | ✓ VERIFIED | All three bindings present (157, 218, 246). |
| `src/renderer/src/modals/variant-scale-derive.ts` | tokenFor renderer-local helper | ✓ VERIFIED | `export const tokenFor = (s) => String(displayFactor(s))` (line 49); renderer-local, no core/main import (Layer-3 holds — arch.spec.ts 20/20 green). |
| `src/renderer/src/modals/VariantDialog.tsx` | multi-row list + per-row two-way control + dedup/invalid gate + result list + cancel | ✓ VERIFIED | `rows.map` per-row control keyed `row.id` (384/393); add/remove (`crypto.randomUUID`, filter); `collidingTokens`/`hasDuplicate` dedup (D-10); `isRowInvalid`/`anyInvalid` (D-11); `startDisabled` gate; per-folder result list with all 4 statuses + "X of N exported" aggregate (751-819); Cancel button → `cancelVariantBatch` (850). Single-pane, no `role="tab"`. Old `window.api.exportVariant` single call = 0 (replaced). |
| `src/renderer/src/components/AppShell.tsx` | variantRows state + rows/onRowsChange wiring | ✓ VERIFIED | `variantRows` state (565), `rows={variantRows} onRowsChange={setVariantRows}` on mount (2589-2590), `onConfirmStart={onConfirmStartVariant}` reused verbatim (2593, D-12). Old `variantScale` = 0 (removed). |
| `tests/main/variant-batch-faithful.spec.ts` | byte-identity matrix + continue-on-error + cancel + no-spine-core | ✓ VERIFIED | 408 lines; 12 tests PASS incl. full 4-cell matrix, continue-on-error rollback, stale-flag reset + between-variants skip. |
| `tests/renderer/variant-batch-dialog.spec.tsx` | rows/dedup/invalid/single-call/result-list proof | ✓ VERIFIED | 7 tests PASS; `.spec.tsx` (not `.ts` — renderer-glob landmine avoided). |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| handleExportVariantBatch | exportOneVariant | per-scale loop call, one outer guard claim | ✓ WIRED | variant-export.ts:431 calls `exportOneVariant(...)` inside the loop; `variantExportInFlight` claimed once at 410, released in finally 458. |
| ipc.ts variant:exportBatch | handleExportVariantBatch | ipcMain.handle delegate with coerced scales[] | ✓ WIRED | ipc.ts:1115 delegates with finite-coerced scales array. |
| VariantDialog onStart | window.api.exportVariantBatch | single batch call with rows.map(r => r.scale) | ✓ WIRED | VariantDialog.tsx:278; "single call" test asserts called once. |
| VariantDialog dedup | tokenFor | group rows by tokenFor(scale) | ✓ WIRED | tokenFor used in collidingTokens compute + per-row highlight (191, 386). |
| AppShell | VariantDialog | rows={variantRows} onRowsChange={setVariantRows} | ✓ WIRED | AppShell.tsx:2589-2590. |
| preload onVariantBatchProgress | renderer subscription | variant:batch-progress event | ✓ WIRED | preload 246 subscribes; VariantDialog 172 consumes for the "variant N of M" prefix. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| VariantDialog result list | `results` (BatchVariantResult[]) | `window.api.exportVariantBatch(...).results` — real main-side per-folder outcomes from looping exportOneVariant | ✓ Yes (real disk-write outcomes) | ✓ FLOWING |
| VariantDialog progress prefix | `progress` | `onVariantBatchProgress` → main `evt.sender.send('variant:batch-progress', …)` per variant | ✓ Yes (emitted per loop iteration) | ✓ FLOWING |
| handleExportVariantBatch results | per-scale `res` | real `exportOneVariant` ExportResponse (read JSON → bake → buildExportPlan → runExport/runRepack) | ✓ Yes (real bake + write pipeline) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Batch byte-identity matrix (SC#2) | `npx vitest run tests/main/variant-batch-faithful.spec.ts` | 12 passed | ✓ PASS |
| Renderer multi-row dialog (SC#1 UI) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx` | 7 passed | ✓ PASS |
| Phase-49 regression (behavior-preserving extraction) | `npx vitest run tests/main/variant-{scale-guard,package-layout,dropin-faithful,source-immutable}.spec.ts` | 34 passed | ✓ PASS |
| Layer-3 arch purity | `npx vitest run tests/arch.spec.ts` | 20 passed | ✓ PASS |
| typecheck:node | `npm run typecheck:node` | exit 0 | ✓ PASS |
| typecheck:web | `npm run typecheck:web` | exit 0 | ✓ PASS |
| token-collapse probe (WR-01 boundary) | `node -e formatScaleToken(0.00001/0.99999)` | collapses to '0'/'1' only at <0.0001 / >0.9999 | ⚠ INFO (degenerate extremes only — see Anti-Patterns) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| EXPORT-04 | 51-01, 51-02 | User can export multiple scales in one batch run, each variant written to its own folder. | ✓ SATISFIED | SC#1 + SC#2 both VERIFIED above. REQUIREMENTS.md line 38 + traceability row (line 80) map EXPORT-04 → Phase 51 (currently marked "Pending" — the requirement is now implementation-satisfied; the status table is a manual ledger). No orphaned requirements: EXPORT-04 is the only ID mapped to Phase 51 and both plans declare it. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/main/variant-export.ts | 58-60 | `formatScaleToken` rounds to 4 dp; scales <0.0001 collapse to `@0x`, >0.9999 to `@1x` (WR-01) | ⚠️ Warning | Degenerate-extreme only — far outside any realistic texture-resize scale (step="0.05" input). Does NOT affect SC#1 or SC#2: even at a collapsing scale, batch output is still byte-identical to the single-scale path (both use the same formatScaleToken), so SC#2 holds. Folder name becomes misleading at that extreme. |
| src/main/variant-export.ts | 382-396 | dedup gate fails the WHOLE batch on any token collision (WR-02) | ⚠️ Warning | Two distinct sub-0.0001 scales collide on `@0x` and abort the batch; one fat-fingered duplicate aborts a valid run. Stems from WR-01; renderer D-10 gate blocks it pre-flight at normal scales. No SC impact at realistic scales. |
| src/main/variant-export.ts | 215, 285-292 | rollback leaves an empty `{NAME}@{s}x/` dir on failure (WR-03) | ⚠️ Warning | Empty-dir cruft after a failed variant; contract is "no orphan FILES" which is met (test asserts no surviving artifacts). Cosmetic. |
| src/renderer/.../VariantDialog.tsx | 848-858 | in-progress Cancel enabled before first progress event, no feedback (WR-05) | ⚠️ Warning | Affordance misrepresents between-variants-only cancel; functionally safe (D-09 by design). Surfaced for human UX check. |
| src/renderer/.../VariantDialog.tsx | 74-75, 298, 409 | dead `plan` prop / `useCallback([props])` / advisory `max="0.99"` (IN-02/03/04) | ℹ️ Info | Quality/maintainability only; no behavior impact. |

No BLOCKER-class anti-patterns. All warnings are robustness/UX edges at degenerate inputs, correctly categorized in 51-REVIEW.md (0 critical, 5 warning, 4 info).

### Deferred Items

Phase 51 is the LAST phase of the v1.7 milestone (phases 48-51), so Step 9b found no later phase to defer any concern to. The `deferred-items.md` in the phase dir documents two PRE-EXISTING, environmental `npm run test` failures (`sampler-worker-girl.spec.ts`, `sampler-skin-defined-unbound-attachment.spec.ts`) caused by gitignored local-only fixtures (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/`) — orthogonal to phase 51 (which touches none of those files) and a known repo pattern (MEMORY.md: "gitignored fixtures + platform/OS divergence"). Not phase-51 gaps.

### Human Verification Required

#### 1. Live in-app batch run (end-to-end fan-out)

**Test:** Open the Export Variant dialog on a real loaded project, add a second scale row (e.g. 0.36 + 0.57), pick ONE parent folder, click "Export Variants".
**Expected:** Exactly two sibling folders `{NAME}@0.57x/` and `{NAME}@0.36x/` written under the picked parent; complete state shows "2 of 2 exported" with one row per folder; only one folder picker appeared (D-12).
**Why human:** Automated tests stub the `window.api` IPC boundary and run headless. The real Electron picker + real on-disk fan-out through the packaged renderer→preload→main path is not exercised by vitest.

#### 2. Live continue-on-error + cancel UX

**Test:** Trigger one variant to fail (re-export into an existing folder with overwrite off) in a 3-scale batch; separately click Cancel mid-batch.
**Expected:** Failed variant shows ✗ with reason while others land; clicking Cancel after the first variant records remaining scales as ⊘ skipped (in-flight variant finishes intact).
**Why human:** The batch-progress prefix, live Cancel affordance, and per-folder result rendering against a real running (timing-dependent) batch can't be observed programmatically. WR-05 notes the Cancel button gives no in-flight feedback — a human should confirm the perceived behavior is acceptable.

### Gaps Summary

No gaps. Both EXPORT-04 success criteria are VERIFIED at all four verification levels (exists, substantive, wired, data-flowing) with empirical test evidence:

- **SC#1** — the multi-row dialog fires exactly one `exportVariantBatch` call with the row scales, and the engine writes one `{NAME}@{token}x/` folder per scale (proven by the renderer "single call" test + the main matrix test's per-folder existence asserts).
- **SC#2** — each batch variant is byte-identical to the single-scale path for that scale, proven both by construction (batch loops the verbatim `exportOneVariant` body) AND empirically (the `variant-batch-faithful` byte-identity matrix over 4.2/4.3 × atlas-source/atlas-less, comparing `{NAME}.json` + `{NAME}.atlas` bytes).

The behavior-preserving extraction is confirmed safe (all 34 Phase-49 variant regression tests stay green). Layer-3 purity holds (arch.spec.ts green; `tokenFor` is renderer-local). typecheck:node + typecheck:web both clean. The 5 review warnings are degenerate-input robustness / UX-affordance edges that do not affect either SC at any realistic scale.

Status is **human_needed** (not passed) solely because the live in-app Electron end-to-end flow — real picker, real disk fan-out, live cancel/progress UX — is by nature outside automated headless coverage and must be confirmed by a human before milestone close. All automated checks pass.

---

_Verified: 2026-05-23T15:18:00Z_
_Verifier: Claude (gsd-verifier)_
