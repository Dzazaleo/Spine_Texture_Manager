---
phase: 51
slug: batch-variant-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-23
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `51-RESEARCH.md` §Q8 (Validation Architecture). EXPORT-04 is the sole phase requirement; SC#1 (N scales → N folders) and SC#2 (each variant byte-identical to the single-scale path, dual-runtime × dual-mode) are the success criteria.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (setupFile `tests/setup/esm-adapter-resolver.ts`); typecheck programs `tsconfig.node.json` / `tsconfig.web.json` |
| **Quick run command** | `npx vitest run tests/main/variant-batch-faithful.spec.ts tests/renderer/variant-batch-dialog.spec.tsx` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~quick: a few seconds; full suite: minutes (1450+ tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (the two new spec files relevant to the task).
- **After every plan wave:** `npm run test` **AND** `npm run typecheck:node` **AND** `npm run typecheck:web` (the `.ts`-renderer-glob landmine — Pitfall 3 — means typecheck:node MUST be in the merge gate; the vitest-only self-check misses TS6307).
- **Before `/gsd-verify-work`:** Full suite green.
- **Phase gate:** full suite green on all 3 OS via CI (`ci.yml`); before any release, `release.yml` separately ([[feedback_release_yml_diverges_from_ci_yml]], [[feedback_verify_whole_ci_surface_locally]] — local green ≠ CI green ≠ release green).
- **Max feedback latency:** quick command < ~10 seconds.

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; this map is keyed by requirement / decision and the concrete test that proves it. The planner MUST attach the matching `<automated>` command to each task and reconcile the task-ID column.

| Req / SC / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
|---------------------|----------|-----------|-------------------|-------------|--------|
| EXPORT-04 / SC#1 | N scales → N `{NAME}@{s}x/` sibling folders in one run | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "byte-identity"` | ❌ Wave 0 | ⬜ pending |
| EXPORT-04 / SC#2 | Each batch variant byte-identical to the single-scale output for that scale (baked JSON + atlas), dual-runtime × dual-mode | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "matrix"` | ❌ Wave 0 | ⬜ pending |
| D-07 | Continue-on-error; each folder atomic on its own `written` Set; a forced-fail scale's folder absent, others fully landed | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "continue-on-error"` | ❌ Wave 0 | ⬜ pending |
| D-09 | Between-variants cancel: in-flight variant finishes, remaining recorded `skipped` | integration (main) | `npx vitest run tests/main/variant-batch-faithful.spec.ts -t "cancel"` | ❌ Wave 0 | ⬜ pending |
| D-10 | Duplicate normalized tokens flagged + Start blocked; `tokenFor(0.5) === tokenFor(0.50001) === '0.5'` | unit (renderer helper) + component | `npx vitest run tests/renderer/variant-twoway.spec.ts tests/renderer/variant-batch-dialog.spec.tsx -t "duplicate"` | ❌ Wave 0 | ⬜ pending |
| D-11 | Invalid row (blank / non-finite / s ≤ 0 / s ≥ 1) disables Start (mirror single-scale gate) | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "invalid"` | ❌ Wave 0 | ⬜ pending |
| D-01 / D-03 | Opens with one row at 0.5; `+ Add scale` adds; per-row remove; remove disabled at 1 row | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "rows"` | ❌ Wave 0 | ⬜ pending |
| D-12 | One parent pick + one overwrite for the run; exactly one `exportVariantBatch` call with the scales array | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "single call"` | ❌ Wave 0 | ⬜ pending |
| D-08 | Per-folder result list + aggregate ("X of N exported") rendered in the complete state | component (renderer) | `npx vitest run tests/renderer/variant-batch-dialog.spec.tsx -t "result list"` | ❌ Wave 0 | ⬜ pending |
| L-03 / Layer-3 | `core/` stays pure; renderer never imports `core/`/`main/`; `handleExportVariantBatch` imports no spine-core / runtime facade | static (arch + grep) | `npx vitest run tests/arch.spec.ts` + import-grep assertion on `src/main/variant-export.ts` | ✅ arch.spec.ts exists (add the grep) | ⬜ pending |
| L-04 / SC#2 | Dual-runtime (4.2 + 4.3) × dual-mode (atlas-source + atlas-less) cells all green | integration (main) | covered by the matrix in `variant-batch-faithful.spec.ts` (honor the 4.3-atlas-less = atlas-mode-only deviation, variant-package-layout.spec.ts:120-135) | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/main/variant-batch-faithful.spec.ts` (`.ts`, main-side — NOT subject to the renderer `.spec.tsx` rule) — covers EXPORT-04 SC#1/SC#2 + D-07 + D-09 + L-04. Reuses the existing committed fixtures (`fixtures/SIMPLE_PROJECT/SIMPLE_TEST.*` 4.2 + `fixtures/SLIDER_4_3/SLIDER-01.*` 4.3) and the `buildCellSummary` / MATRIX shape from `variant-package-layout.spec.ts:93-151`; the forced-fail uses the `maxPageSize:64` oversize trick (variant-package-layout.spec.ts:328-382).
- [ ] `tests/renderer/variant-batch-dialog.spec.tsx` (**MUST be `.spec.tsx`** — [[feedback_renderer_ts_helper_test_breaks_typecheck_node]]; harness from `tests/renderer/variant-dialog.spec.tsx:1-90`) — covers D-01/D-03/D-08/D-10/D-11/D-12 multi-row UI.
- [ ] `tokenFor` unit assertion added to the EXISTING `tests/renderer/variant-twoway.spec.ts` (already in `tsconfig.node.json` exclude :34) — asserts `tokenFor(0.5) === tokenFor(0.50001) === '0.5'`.
- [ ] Import-grep / arch assertion that `src/main/variant-export.ts`'s batch additions import no spine-core / runtime facade (batch is runtime-agnostic below `bake`).
- [ ] **NO new committed fixture dir** → do NOT touch `SAFE01_EXCLUDED_PREFIXES` ([[feedback_new_committed_fixtures_need_safe01_denylist]] pre-empted). If a new `.ts` renderer test is ever created, add it to `tsconfig.node.json` exclude (prefer `.spec.tsx` to avoid this entirely).
- Framework install: none — vitest already configured.

---

## Manual-Only Verifications

> Headless coverage is the bulk of SC#1/SC#2 (orchestration loop, per-variant rollback, continue-on-error, between-variants cancel, byte-identity vs single-call, dedup/invalid gates, multi-row UI mechanics, result-list render, Layer-3 purity). Only the native-shell + real-end-to-end interaction needs a running Electron dev server.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native parent-folder picker renders + behaves (the one pick for the run, D-12) | EXPORT-04 | Electron native dialog — not jsdom-testable (consistent with Phase 49's open "native folder-picker visual UAT" carry-forward) | Run `npm run dev`, open Export Variant…, click Start, confirm the OS folder picker appears and the chosen parent is used. |
| Real multi-row end-to-end ("I want 36% and 57%") | EXPORT-04 / SC#1 | Full UI + native shell + real fs — observable END-STATE must be the two real packages, not "dialog opened" ([[feedback_uat_opened_is_not_rendered]]) | Open a real rig; add a 2nd row; enter two distinct scales (e.g. 0.36, 0.57); pick a real parent; run. **Confirm two `{NAME}@{s}x/` sibling folders exist AND each loads/renders in Spine at the smaller size.** Capture in `51-HUMAN-UAT.md` with the observable end-state per criterion. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the two new spec files + the `tokenFor` assertion + the import-grep)
- [ ] No watch-mode flags (use `vitest run`, never `vitest`/`--watch`)
- [ ] Feedback latency < ~10s for the quick command
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 files exist)

**Approval:** pending
