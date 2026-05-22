---
phase: 49-single-scale-variant-export
plan: 02
subsystem: renderer
tags: [variant-export, modal, dialog, ipc-consumer, toolbar, scale-ui, controlled-prop]

# Dependency graph
requires:
  - phase: 49-single-scale-variant-export
    plan: 01
    provides: "window.api.exportVariant typed Api member + variant:export IPC channel + preload binding; window.api.pickOutputDirectory reused for the PARENT pick"
  - phase: 06-optimize-assets-image-export
    provides: "OptimizeDialog controlled-prop surface + config controls (output-mode radio, atlas knobs, safety buffer, sharpen) reused verbatim; buildExportPlan; the AppShell activeOverrides selector + pickOutputDir helper + lastOutDir slot"
provides:
  - "src/renderer/src/modals/VariantDialog.tsx — single-pane (tab-ready) variant dialog: reuses Optimize config controls + ONE basic numeric scale field; probe-then-confirm onStart invokes window.api.exportVariant"
  - "AppShell 'Export Variant…' toolbar action + onClickExportVariant + a DEDICATED picker-only onConfirmStartVariant (keyed to variantDialogState) + the VariantDialog mount, reusing activeOverrides + the export-config locals"
  - "tests/renderer/variant-dialog.spec.tsx — EXPORT-01 renderer test (render + invoke-arg-order + s>=1/<=0 disabled)"
affects: [50-multi-scale-variant-ui, 51-batch-variant-export]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controlled-prop modal mirror: VariantDialog copies OptimizeDialog's prop surface + 3-state machine + useFocusTrap + ARIA scaffold, adding ONE numeric scale field (D-05) — config state stays in AppShell"
    - "Dedicated picker-only confirm keyed to its OWN dialog state: onConfirmStartVariant is separate from the Optimize onConfirmStart (which early-returns when exportDialogState===null) — runs ONLY the parent-folder picker, no plan probe, no ConflictDialog (D-03)"
    - "IPC arg-order fidelity: the dialog calls window.api.exportVariant in the EXACT Plan-01 Api signature order (summary, s, parentDir, overwrite, sharpen, mode, atlasOpts, overrides-entries[], buffer) — overrides cross the wire as Array.from(map.entries())"
    - "Single-pane structured-tab-ready layout (D-06): NO tabs / NO TabButton this phase; Phase 50/51 enrich the same control in place"

key-files:
  created:
    - "src/renderer/src/modals/VariantDialog.tsx"
    - "tests/renderer/variant-dialog.spec.tsx"
  modified:
    - "src/renderer/src/components/AppShell.tsx"

key-decisions:
  - "IPC arg order follows the Plan-01 TYPED signature (overrides=arg 8, buffer=arg 9), NOT the plan body's illustrative pseudocode (which placed overrides/buffer earlier) — the typed Api.exportVariant in src/shared/types.ts is the binding contract; the test asserts the typed order"
  - "Reworded the one VariantDialog header comment that contained the literal token 'TabButton' to 'tab-button' so the D-06 acceptance grep (grep -c 'TabButton' == 0) holds — the file genuinely imports no tab component"
  - "Export button label is 'Export Variant' (the dialog's primary action) vs the toolbar's 'Export Variant…' button — both satisfy the EXPORT-01/D-04 'Export Variant' grep"

patterns-established:
  - "Controlled-prop modal mirror reusing a sibling dialog's config controls + a single new field"
  - "Dedicated picker-only confirm handler keyed to its own dialog state (avoids the cross-dialog early-return trap)"

requirements-completed: [EXPORT-01, EXPORT-03]

# Metrics
duration: ~20min
completed: 2026-05-22
---

# Phase 49 Plan 02: Renderer Variant Export Dialog Summary

**The user-facing door for variant export: a NEW "Export Variant…" toolbar action opens a clean single-pane VariantDialog that reuses OptimizeDialog's full config controls plus one basic numeric scale field, and fires `window.api.exportVariant` (the Plan-01 channel) after a native parent-folder pick driven by a dedicated picker-only `onConfirmStartVariant` — making EXPORT-01 genuinely click-to-export this phase.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `VariantDialog.tsx` — a clean SINGLE-PANE ARIA modal modeled on `OptimizeDialog.tsx` (3-state machine `pre-flight | in-progress | complete` + `useFocusTrap` + `role="dialog"`/`aria-modal`/labelledby carried over verbatim). D-06 honored: NO tabs, NO tab-button import — the body is a structured single-pane layout (Phase 50/51 enrich the same control in place).
- **D-05 basic numeric scale field:** a single `<input type="number" step="0.05" min="0" max="0.99">` bound to `props.scale`/`props.onScaleChange`, with an inline hint ("Variants are scaled-down — enter a value between 0 and 1") and the Export button DISABLED when `props.scale <= 0 || props.scale >= 1` (the cheap D-08 renderer pre-check; the authoritative gate is the Plan-01 main-side `VariantScaleError`).
- **D-07 full config inheritance:** the output-mode radio + atlas knobs (max page size / allow rotation / padding) + safety buffer + sharpen controls are reused with the SAME markup + class strings as `OptimizeDialog.tsx`, reading `props.outputMode`/`props.atlasOpts`/`props.safetyBufferPercent`/`props.sharpenOnExport` and calling the matching `on*Change` callbacks. No new override routing — `effectiveOverrides` is the mode-aware `activeOverrides` bucket passed through.
- **Probe-then-confirm `onStart`:** invokes `window.api.exportVariant(summary, s, parentDir, overwrite, sharpen, outputMode, atlasOpts, Array.from(effectiveOverrides.entries()), safetyBufferPercent)` — the EXACT Plan-01 typed Api arg order — after the parent's picker-only `onConfirmStart` resolves a parent dir. On `response.ok` → complete state with a reveal-output affordance; on `!ok` → surface `response.error.message` (the typed `VariantScaleError`/collision/Unknown message).
- **AppShell wiring:** a NEW "Export Variant…" toolbar button (secondary/outlined class string, byte-identical to the Documentation button) placed beside "Optimize Assets" (D-04 — the shipped Optimize flow + OptimizeDialog mount + onClickOptimize + onConfirmStart are byte-untouched; the AppShell diff is PURE additions). `onClickExportVariant` builds the display master plan reusing `activeOverrides` + `safetyBufferPercentLocal`. `variantDialogState` + `variantScale` (default 0.5) state slots. The `<VariantDialog>` mount inherits the full active export config.
- **BLOCKER FIX — the dedicated picker-only `onConfirmStartVariant`:** keyed to `variantDialogState` (NOT `exportDialogState`), it runs ONLY the native parent-folder picker (`pickOutputDir` + `setLastOutDir`), returns `{ proceed, overwrite:false, outDir }`, and contains ZERO `exportDialogState`/`setExportDialogState`/plan-probe references. This is the required handler: the Optimize `onConfirmStart` early-returns `{proceed:false}` whenever `exportDialogState===null` — which is always true while VariantDialog is open — so reusing it would never fire `exportVariant`.
- `tests/renderer/variant-dialog.spec.tsx` — 5 tests green: scale field renders + shows the controlled value; Export fires `exportVariant` ONCE with `(summary, 0.5, '/tmp/parent', false, …, 'loose', …, [['CIRCLE',150]], 0)`; Export disabled + inline hint at `s=1.0`; disabled at `s=2.0` and `s=0`.

## Task Commits

1. **Task 1: VariantDialog single-pane variant export door + renderer test** — `8c9af05` (feat)
2. **Task 2: AppShell Export Variant toolbar action + picker-only onConfirmStartVariant + mount** — `06af463` (feat)

## Files Created/Modified

- `src/renderer/src/modals/VariantDialog.tsx` (created) — single-pane variant dialog reusing Optimize config controls + a basic numeric scale field; invokes `window.api.exportVariant`.
- `tests/renderer/variant-dialog.spec.tsx` (created) — EXPORT-01 renderer test (render + invoke-arg-order + s>=1/<=0 disabled).
- `src/renderer/src/components/AppShell.tsx` (modified) — additive: import VariantDialog; `variantDialogState`+`variantScale` slots; `onClickExportVariant`; the dedicated picker-only `onConfirmStartVariant`; the "Export Variant…" toolbar button; the `<VariantDialog>` mount. The shipped Optimize surface is byte-untouched.

## Decisions Made

- **IPC arg order follows the Plan-01 TYPED `Api.exportVariant` signature**, NOT the plan body's illustrative pseudocode. The plan's Task-1 pseudocode placed `effectiveOverrides`/`safetyBufferPercent` earlier in the call, but the binding contract — the typed `Api.exportVariant` in `src/shared/types.ts` (added by Plan 01) — orders them as args 8 and 9: `(summary, s, parentDir, overwrite, sharpenEnabled, outputMode, atlasOpts, effectiveOverrides[], safetyBufferPercent)`. The dialog and the test both follow the typed order; `typecheck:web` is the proof (0 errors).
- **Reworded one header comment** that contained the literal token `TabButton` to `tab-button` so the D-06 acceptance grep (`grep -c 'TabButton'` returns `0`) holds. The file genuinely imports no tab component — only the comment text tripped the substring scan.
- **Export action label** is `Export Variant` (the dialog's primary button) vs the toolbar's `Export Variant…` button. Both satisfy the EXPORT-01/D-04 `grep -c 'Export Variant'` criterion (which returns 2 in AppShell: the button label + the comment).

## Deviations from Plan

None requiring deviation rules — the plan executed as written. Two minor in-plan adjustments worth recording:

1. **IPC arg order taken from the typed signature, not the pseudocode** (see Decisions above). This is a faithful realization of the plan's intent — the plan explicitly states "the Api type lives in Plan 01's files_modified — this plan only CONSUMES it" — so the typed signature is authoritative over the inline illustrative snippet.
2. **`TabButton` comment reword** to satisfy the literal-zero D-06 grep (see Decisions above). No functional change.

## Authentication Gates

None — no auth-gated tools were invoked.

## Verification

- `npx vitest run tests/renderer/variant-dialog.spec.tsx` — **5 passed** (render + invoke-arg-order + s>=1/s<=0 disabled).
- `npx vitest run tests/renderer/appshell-optimize-flow.spec.tsx` — **green** (the shipped Optimize flow is unaffected by the additions).
- `npx vitest run tests/renderer/` (full renderer suite) — **41 files / 326 passed / 1 skipped / 0 failures**. The ~11 pre-existing `tests/renderer/*` MixBlend IMPORT failures noted in the plan's `<verification>` did NOT appear in this run (Phase-47-owned; memory `project_renderer_mixblend_preexisting_failure`).
- `npx vitest run tests/arch.spec.tsx` — **green** (VariantDialog is Layer-3 pure: imports only react + ../../../shared/types.js + the focus-trap hook; no `../../core/*`).
- `npm run typecheck:web` — **0 errors** (the VariantDialogProps↔AppShell wiring + the `window.api.exportVariant` consumption compile against the Plan-01 typed surface).
- Acceptance greps — all PASS:
  - VariantDialog: `window.api.exportVariant` (2), `TabButton` (0), `type="number"` (3), config `on*Change` (14), scale pre-check (3).
  - AppShell: `Export Variant` (2), `onClickExportVariant` (2), `onConfirmStartVariant` (3), `<VariantDialog` (1), mount `onConfirmStart={onConfirmStartVariant}` (1), mount `effectiveOverrides={activeOverrides}` (1).
  - BLOCKER FIX: the `onConfirmStartVariant` body references `variantDialogState` and contains ZERO `exportDialogState`/`setExportDialogState` references (inspected).
  - D-04: `git diff` on AppShell is PURE additions (no removed/changed lines) — the Optimize flow is byte-untouched.

## Next Phase Readiness

- The "Export Variant…" door is live and wired to the full active export config — Phase 50 enriches the SAME single numeric scale control in place (px two-way binding) + adds the `Scale | Output | Batch` tabs without rework (the dialog is structured tab-ready).
- The renderer leg of EXPORT-01 is complete: click → single-pane dialog → enter scale → pick PARENT folder → `window.api.exportVariant` fires → complete state for `{NAME}@{s}x/`.
- The manual native-folder-picker + the visual rendered-at-half-size end-state are deferred to `/gsd-verify-work` `49-HUMAN-UAT.md` (per 49-VALIDATION.md Manual-Only — NOT an execute checkpoint).

## Self-Check: PASSED

- `src/renderer/src/modals/VariantDialog.tsx` — FOUND.
- `tests/renderer/variant-dialog.spec.tsx` — FOUND.
- `src/renderer/src/components/AppShell.tsx` — FOUND (modified).
- Task commit `8c9af05` — FOUND in git history.
- Task commit `06af463` — FOUND in git history.

---
*Phase: 49-single-scale-variant-export*
*Completed: 2026-05-22*
