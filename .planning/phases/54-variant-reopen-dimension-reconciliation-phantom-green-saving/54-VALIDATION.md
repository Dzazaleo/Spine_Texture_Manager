---
phase: 54
slug: variant-reopen-dimension-reconciliation-phantom-green-saving
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-25
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `54-RESEARCH.md` § Validation Architecture. No formal REQ IDs
> (REQUIREMENTS.md was git-rm'd at v1.7 close) — must-haves derived from locked
> decisions D-01 / D-02 / D-03.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.x (run via `npm run test`) |
| **Config file** | `vitest.config.ts` (present) |
| **Quick run command** | `npx vitest run tests/regression/variant-phantom-green.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | quick ~2s · full suite ~60–90s |

**Typecheck gates (CI-surface landmine — both MUST pass):** `npm run typecheck:node` **and** `npm run typecheck:web`. Local vitest-green ≠ CI-green (memory `feedback_verify_whole_ci_surface_locally`); the renderer `.ts`-test/TS6307 trap (memory `feedback_renderer_ts_helper_test_breaks_typecheck_node`) is sidestepped by extracting `rowState` to a pure `src/renderer/src/lib/row-state.ts` (node-included) so the spec stays a single `.spec.ts`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/regression/variant-phantom-green.spec.ts && npm run typecheck:node && npm run typecheck:web`
- **After every plan wave:** Run `npm run test`
- **Before `/gsd-verify-work`:** Full suite green + both typechecks green
- **Max feedback latency:** ~90 seconds (full suite)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement (decision) | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|------------------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | Wave 0 — extract pure `rowState` → `src/renderer/src/lib/row-state.ts` (node-included, Layer-3) | — | N/A | unit (compile) | `npm run typecheck:node && npm run typecheck:web` | ❌ W0 | ⬜ pending |
| 54-01-02 | 01 | 1 | D-01 — `computeExportDims` returns `peakDemandW/H = min(ceil(canonW × safeScale(rawPeakEff)), actualSource)`; export `outW/outH` byte-identical | — | N/A (no new input surface) | unit | `npx vitest run tests/regression/variant-phantom-green.spec.ts -t "D-01"` | ❌ W0 | ⬜ pending |
| 54-01-03 | 01 | 1 | D-01/D-02 — Peak cell + `enrich-overrides.ts` surface `peakDemandW/H`; universal (no variant detection) | — | N/A | unit | `npx vitest run tests/regression/variant-phantom-green.spec.ts -t "regression\|drift"` | ❌ W0 | ⬜ pending |
| 54-01-04 | 01 | 1 | D-03 — `rowState` green only when rendered integers strictly differ (pure integer compare, no epsilon) | — | N/A | unit | `npx vitest run tests/regression/variant-phantom-green.spec.ts -t "D-03"` | ❌ W0 | ⬜ pending |
| 54-01-05 | 01 | 1 | chip ≡ rows — `savingsPctMemo` rebased onto per-row render demand (`enrichWithEffective`) | — | N/A | unit | `npx vitest run tests/regression/variant-phantom-green.spec.ts -t "savings"` | ❌ W0 | ⬜ pending |
| 54-01-06 | 01 | 1 | No export leak — export bytes / OptimizeDialog pre-flight unchanged | — | export path frozen (Option A rejected) | existing | `npx vitest run tests/core/export.spec.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> Task IDs above are illustrative (single-plan phase); the planner sets the final IDs. The mapping (decision → command) is the binding contract.

---

## Regression rows the suite MUST lock (from RESEARCH §5)

| # | Row class | Inputs (`canonW, peakScale, actualSrc, override?`) | Expected (current → fixed) | Assert |
|---|-----------|----------------------------------------------------|----------------------------|--------|
| R1 | **The bug** — variant `peakScale>1`, drift | `208.5, 1.182, 247, none` | `209 GREEN → 247` (no green) | `peakDemand==source`, state `atLimit` |
| R2 | Genuine master savings `peakScale<1` | `478.5, 0.44, 211, none` | `211 → 211` unchanged | `peakDemand==peakDisplay` (call both) |
| R3 | NECK-repack drift, real savings | `100, 0.8, 120, none` | `80 GREEN → 80 GREEN` | `peakDemand<source`, state `under` |
| R4 | Master `peakScale>1` no drift | `417, 1.182, 417, none` | `417 → 417` unchanged | `peakDemand==source`, state `atLimit` |
| R5 | Clean `peakScale==1` no drift | `153, 1.0, 153, none` | `153 → 153` | state `atLimit` |
| R6 | Override <100% on `peakScale>1` | `208.5, 1.182, 247, 50` | `124 → 124` still green | `peakDemand<source`, state `under` |
| R7 | Rounding asymptote `peakScale≈0.998` | `200, 0.998, 200, none` | `200 → 200` unchanged | state `atLimit`, no green |
| R8 | D-03 contract — equal rendered integers | `peakDemand==source` after rounding | — | `rowState(N, N) === 'atLimit'` |

**Critical:** `safeScale(rawPeakEff)` MUST be retained in the render-demand formula — dropping it diverges on ~45% of `peakScale ≤ 1` rows (fuzz-proven). The ONLY removed operation is the `min(…, 1)` canonical clamp.

---

## Wave 0 Requirements

- [ ] `tests/regression/variant-phantom-green.spec.ts` — synthetic-row suite covering D-01 / D-02 / D-03 + chip≡rows (rows R1–R8). **No committed fixture** ⇒ no SAFE-01 denylist change required.
- [ ] `src/renderer/src/lib/row-state.ts` — extract pure `rowState` from `GlobalMaxRenderPanel.tsx` (Layer-3, node-included) so test (iii) imports it as `.spec.ts` without the TS6307 trap.
- [ ] No framework install (vitest present).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Reopened variant no longer shows phantom green | D-01 / D-02 | Requires Electron dev server + real reopened-variant `.json` on local disk (not jsdom-testable) | Reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json` → GRAND/L_SKIRT no longer green; section chip ≈ rounding residual, NOT 20.6% |
| Second reopened-variant repro | D-01 | same | Reopen `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json` → L_SKIRT 0.877× green gone |
| Master genuine savings unaffected | D-02 (regression) | same | Reopen a master with `peakScale<1` (e.g. `/Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json`) → genuine green unchanged; chip unchanged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`variant-phantom-green.spec.ts`, `lib/row-state.ts`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
