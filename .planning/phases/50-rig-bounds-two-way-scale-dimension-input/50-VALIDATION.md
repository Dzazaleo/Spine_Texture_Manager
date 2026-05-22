---
phase: 50
slug: rig-bounds-two-way-scale-dimension-input
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `50-RESEARCH.md` §"Validation Architecture" (HIGH confidence — every
> seam confirmed against live source + 3 empirical probes through the real dual-runtime
> adapter). The planner binds each Wave-0 test file below to a concrete task ID; the test
> concerns, requirements, commands, and falsifiers are already fixed here.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`npm run test` / `npm run test:watch`) — core + main headless in Node; renderer in jsdom. `vitest.config.ts` `setupFiles` binds the dual-runtime adapter resolver (line 23) |
| **Config file** | `vitest.config.ts` (existing; full suite green per STATE.md) |
| **Quick run command** | `npx vitest run tests/core/setup-bounds.spec.ts tests/renderer/variant-twoway.spec.*` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~15s targeted suites · full suite a few minutes |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/setup-bounds.spec.ts tests/renderer/variant-twoway.spec.*` (the directly-affected suites, < 15s)
- **After every plan wave:** Run `npm run test` (full vitest) + `npm run typecheck:node` + `npm run typecheck:web`
- **Before `/gsd-verify-work`:** Full suite green **modulo the ~11 pre-existing `tests/renderer/*` MixBlend IMPORT failures** (Phase-47-owned, NOT regressions — memory `project_renderer_mixblend_preexisting_failure`) **plus** `typecheck:node` 0; the one screenshot UAT signed
- **Max feedback latency:** ~15 seconds (targeted) / authoritative signal is CI per `feedback_verify_whole_ci_surface_locally`

---

## Per-Task Verification Map

Rows are keyed to the Wave-0 test concerns (the concrete validation deliverables from research).
Task-ID binding (`50-0X-0Y`) is finalized by the planner; every row already has its requirement,
test type, real command, and falsifier locked. Prospective plan mapping per the ROADMAP stubs:
**50-01** = setup-pose bbox compute + `SkeletonSummary.bbox` seam + arch anchor (SCALEUI-02);
**50-02** = two-way factor↔px control (SCALEUI-01). 50-02 depends on 50-01 (reads `summary.bbox`).

| Row | Plan/Task | Wave | Requirement | Threat Ref | Secure / Correct Behavior | Test Type | Automated Command | File Exists | Status |
|-----|-----------|------|-------------|------------|---------------------------|-----------|-------------------|-------------|--------|
| V1 | 50-01 | 1 (W0) | SCALEUI-02 | — | `computeSetupPoseBounds` returns finite `{w,h}` for a 4.2 rig via the all-skins manifest union (D-06); materialized through `load.runtime.makeSkeleton` only, never a hardcoded ctor (D-07) | unit (core) | `npx vitest run tests/core/setup-bounds.spec.ts -t "4.2"` | ❌ W0 | ⬜ pending |
| V2 | 50-01 | 1 (W0) | SCALEUI-02 | T-50-RT (cross-runtime materialization) | `computeSetupPoseBounds` returns finite `{w,h}` for a 4.3 rig via the adapter — no `reading 'r'` / signature-divergence crash (REG-47-01 / 4.2-base-subclass landmines) | unit (core) | `npx vitest run tests/core/setup-bounds.spec.ts -t "4.3"` | ❌ W0 | ⬜ pending |
| V3 | 50-01 | 1 (W0) | SCALEUI-02 | — | D-08 cross-check oracle: all-skins union ≈ editor `skeleton.width/height` on a single-skin fully-visible rig (SIMPLE_TEST — research measured Δ 0.0%, assert ~1% tol); editor field is the cross-check, NEVER the source (D-05) | unit (core) | `npx vitest run tests/core/setup-bounds.spec.ts -t "cross-check"` | ❌ W0 | ⬜ pending |
| V4 | 50-01 | 1 (W0) | SCALEUI-02 | — | All-skins union **≥** editor setup-pose-visible subset on a multi-skin rig (skeleton2 4.3 — research measured +19.3% wide; assert `≥`, NOT exact) — documents + locks the D-06 "largest envelope" tradeoff | unit (core) | `npx vitest run tests/core/setup-bounds.spec.ts -t "all-skins envelope"` | ❌ W0 | ⬜ pending |
| V5 | 50-01 | 1 (W0) | SCALEUI-02 | T-50-FIN (non-finite across IPC) | Degenerate rig (zero textured attachments — only bbox/path/point/clipping) → returns `null`, NOT `-Infinity` (Pitfall 1: `maxX-minX === -Infinity` must be guarded `measured===0 → null`) | unit (core) | `npx vitest run tests/core/setup-bounds.spec.ts -t "degenerate"` | ❌ W0 | ⬜ pending |
| V6 | 50-01 | 1 (W0) | SCALEUI-02 | T-50-FIN | `SkeletonSummary.bbox` is populated by `buildSummary` (reusing the `rt` already bound at `summary.ts:325`) and is finite-or-null + `structuredClone`-safe across the existing IPC contract | unit (main) | `npx vitest run tests/main/summary.spec.ts -t "bbox"` | ⚠️ extend existing (clone test at :132) | ⬜ pending |
| V7 | 50-01 | 1 | SCALEUI-02 | T-50-LAYER (Layer-3 boundary) | `src/core/setup-bounds.ts` is Layer-3 pure (no `node:fs`/`sharp`/`electron`/DOM); the renderer reads precomputed `summary.bbox` only and does not import `core/` | grep/arch | `npx vitest run tests/arch.spec.ts` | ⚠️ extend (named anchor, mirror :384) | ⬜ pending |
| V8 | 50-02 | 2 (W0) | SCALEUI-01 | — | Pure derivation helpers: `pxFromScale(s, axis) === Math.round(s*axis)`; `scaleFromPx(px, axis) === px/axis` exact (no snapping, D-03); `displayFactor(s) === Number(s.toFixed(4))` (== `formatScaleToken`) | unit (renderer) | `npx vitest run tests/renderer/variant-twoway.spec.ts -t "derivation"` | ❌ W0 | ⬜ pending |
| V9 | 50-02 | 2 (W0) | SCALEUI-01 | — | Two-way binding: editing the factor updates both px fields; editing a px field sets `s = px/axis` exactly + re-derives the other two; scaling stays **uniform** (aspect-locked, never anisotropic — `project_phase6_default_scaling`), D-02 | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "two-way"` | ❌ W0 | ⬜ pending |
| V10 | 50-02 | 2 (W0) | SCALEUI-01 | — | No round-trip drift on the edited axis: a typed `512` stays `512` while focused (D-02; the px view of the canonical `s` does not re-round the field the user is editing) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "no drift"` | ❌ W0 | ⬜ pending |
| V11 | 50-02 | 2 (W0) | SCALEUI-01 | — | Over-range (D-04): typed px → `s ≥ 1` ALLOWS the entry, displays the ≥1 factor, DISABLES Export, shows the existing inline "variants are scaled-down" hint (reuses the Phase-49 D-08 renderer pre-check; authoritative reject stays main-side `VariantScaleError`) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "over-range"` | ❌ W0 | ⬜ pending |
| V12 | 50-02 | 2 (W0) | SCALEUI-01, SCALEUI-02 | T-50-FIN | Degenerate UI: `summary.bbox == null` → px fields disabled/blank, the factor field stays usable (factor-only input still works with no measurable geometry) | component (jsdom) | `npx vitest run tests/renderer/variant-twoway.spec.tsx -t "no geometry"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Threat refs (T-50-RT cross-runtime materialization, T-50-FIN finite-or-null across IPC, T-50-LAYER Layer-3 boundary) are formalized by the planner's per-PLAN `<threat_model>` block; mapped here prospectively. This phase adds no auth/session/network/file-write/IPC-channel surface (research §Security Domain).*

---

## Wave 0 Requirements

New test files to author before/with the implementation tasks (status today noted):

- [ ] `tests/core/setup-bounds.spec.ts` — SCALEUI-02: dual-runtime all-skins union (V1 4.2, V2 4.3), the D-08 cross-check oracle (V3 SIMPLE_TEST ≈ editor), the all-skins-≥-editor envelope (V4 skeleton2), and the degenerate `null` guard (V5). Reuse the dual-runtime co-import fixture pattern from `tests/scale-bake.spec.ts` / `tests/main/variant-dropin-faithful.spec.ts:1-209`.
- [ ] `tests/renderer/variant-twoway.spec.ts` (pure helpers) — SCALEUI-01: V8 derivation (`pxFromScale`/`scaleFromPx`/`displayFactor`, exact, no snap).
- [ ] `tests/renderer/variant-twoway.spec.tsx` (jsdom component) — SCALEUI-01: V9 two-way binding, V10 no-drift, V11 over-range, V12 no-geometry.
- [ ] Extend `tests/main/summary.spec.ts` — SCALEUI-02 (V6): assert `summary.bbox` is populated + finite-or-null + `structuredClone`-safe (extend the existing clone test at `:132`).
- [ ] Extend `tests/arch.spec.ts` — SCALEUI-02 (V7): named Layer-3 anchor for `src/core/setup-bounds.ts` (no `node:fs`/`sharp`/`electron`/DOM), mirroring the Phase-48 scale-bake anchor at `arch.spec.ts:384`. The existing renderer-↛-core grep (`arch.spec.ts:20`) already covers the renderer-must-not-import-core direction.
- Framework install: none — vitest is already configured.

**Fixture strategy (NO new committed fixture dir preferred):** Reuse already-committed json+atlas-only rigs.
- Dual-runtime bbox math reads NO PNG bytes (it measures world vertices), so atlas-source/atlas-less is mode-invariant here — drive on `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2, single-skin oracle, Δ 0.0%), `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3, multi-skin envelope ≥ editor), and the committed 4.3 rigs (`SLIDER_4_3` / `XTRA01_4_3` / `XTRA02_4_3`).
- **Degenerate case:** prefer constructing the zero-textured `skeletonData` **in-test** (a skin with only a bounding-box attachment) so NO new fixture dir is committed. **If a tiny degenerate fixture dir IS committed instead**, the SAME plan MUST co-extend `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts` (recurring landmine — `feedback_new_committed_fixtures_need_safe01_denylist`) and prove it git-tracked. Prefer the in-test construction to avoid this entirely.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The enriched Scale card renders legibly: the W×H setup-pose reference line + the three coupled fields (factor / target-W / target-H), aspect-locked editing feels right, the over-range disabled state + "scaled-down" hint reads clearly, and the `bbox == null` "no setup-pose geometry" state degrades gracefully | SCALEUI-01, SCALEUI-02 | jsdom cannot compute Tailwind layout/spacing (`feedback_layout_bugs_request_screenshots_early`) — automated coverage proves the binding math + state logic (V8–V12); only the *visual* legibility/feel is human | In `npm run dev`: open a 4.2 and a 4.3 project; open "Export Variant…"; confirm the W×H reference matches a sane rig size; type a factor and watch both px fields follow; type a target W (e.g. `512`) and confirm H follows aspect-locked and the typed value doesn't drift; type a value ≥ bbox and confirm Export disables with the hint; (if available) open a geometry-less rig and confirm the factor field still works. Capture a screenshot; record in `50-HUMAN-UAT.md`. Avoid the "opened ≠ rendered" trap (`feedback_uat_opened_is_not_rendered`) — the criterion is the *rendered, correctly-coupled* control, not "the dialog opened". |

*The headless layer (V1–V12) proves the bbox math (dual-runtime, cross-check, envelope, degenerate), the summary seam (finite-or-null, clone-safe), Layer-3 purity, and the full two-way binding state machine; only the visual legibility/feel is manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (V1–V12 map every SCALEUI req to an automated command; only the visual legibility/feel is manual)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 2 new `tests/core/setup-bounds.spec.ts` + `tests/renderer/variant-twoway.spec.*` files + the `summary.spec.ts` / `arch.spec.ts` extensions)
- [ ] No watch-mode flags (all commands are `vitest run`, not `--watch`)
- [ ] Feedback latency < 15s (targeted suites)
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 lands)

**Approval:** pending
