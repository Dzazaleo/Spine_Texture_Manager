---
phase: 49
slug: single-scale-variant-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `49-RESEARCH.md` §"Validation Architecture" (HIGH confidence). The
> planner binds each Wave-0 test file below to a concrete task ID; the test concerns,
> requirements, commands, and falsifiers are already fixed here.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (`npm run test` / `npm run test:watch`) — core + main + oracle headless in Node; renderer in jsdom |
| **Config file** | `vitest.config.*` (existing; 141 test files green per STATE.md) |
| **Quick run command** | `npx vitest run tests/core/variant-sizing.spec.ts tests/main/variant-*.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~30s targeted variant suites · full suite a few minutes |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/variant-sizing.spec.ts tests/main/variant-*.spec.ts` (targeted, < 30s)
- **After every plan wave:** Run `npm run test` (full suite — must stay green)
- **Before `/gsd-verify-work`:** Full suite green **modulo the ~11 pre-existing `tests/renderer/*` MixBlend IMPORT failures** (Phase-47-owned, NOT regressions — memory `project_renderer_mixblend_preexisting_failure`) **plus** `typecheck:node` 0
- **Max feedback latency:** ~30 seconds (targeted) / authoritative signal is CI per `feedback_verify_whole_ci_surface_locally`

---

## Per-Task Verification Map

Rows are keyed to the Wave-0 test files (the concrete validation deliverables from research).
Task-ID binding (`49-0X-0Y`) is finalized by the planner; every row already has its requirement,
test type, real command, and falsifier locked.

| Row | Plan/Task | Wave | Requirement | Threat Ref | Secure / Correct Behavior | Test Type | Automated Command | File Exists | Status |
|-----|-----------|------|-------------|------------|---------------------------|-----------|-------------------|-------------|--------|
| V1 | 49-01 T1 | 1 (W0) | EXPORT-02 | — | `variant_peak = s × master_peak` exact; override-%-of-peak applied to the **scaled** peak; no re-sampling anywhere in the path (peak-only interpretation A1, locked in plan `must_haves.truths` citing D-07) | unit (core) | `npx vitest run tests/core/variant-sizing.spec.ts` | ❌ W0 | ⬜ pending |
| V2 | 49-01 T2 | 1 (W0) | EXPORT-02 | T-49-SRC (source integrity) | source `{NAME}.json` byte-identical (sha256) before/after a variant export; `bake` input object unmutated | integration (main) | `npx vitest run tests/main/variant-source-immutable.spec.ts` | ❌ W0 | ⬜ pending |
| V3 | 49-03 T1 | 1 (W0) | EXPORT-01, EXPORT-03 | T-49-DIR (outDir containment) | per-mode drop-in layout: `loose`→`{NAME}.json`+`images/<region>.png`×N; `atlas`→`{NAME}.json`+`{NAME}.atlas`+`{NAME}.png`; `both`→union; scaled JSON present in **all** modes; inner basenames clean (no `@`-suffix); folder == `{NAME}@{s}x` | integration (main, tmp outDir) | `npx vitest run tests/main/variant-package-layout.spec.ts` | ❌ W0 | ⬜ pending |
| V4 | 49-03 T1 | 1 (W0) | EXPORT-01 | T-49-DIR | partial-failure rollback **includes the JSON**: force `runRepack` oversize (tiny `maxPageSize`) on `atlas` mode → `{NAME}@{s}x/` contains NO `{NAME}.json` and no partial PNG/atlas after the throw | integration (main) | `npx vitest run tests/main/variant-package-layout.spec.ts` (folded) | ❌ W0 | ⬜ pending |
| V5 | 49-01 T1 | 1 (W0) | EXPORT-01 | — | D-08 scale-direction guard: `s=1.0` and `s=2.0` → `ok:false` with `VariantScaleError` message; `s=0.5` proceeds; core `bake(json, 1.0)` still SUCCEEDS (direction-agnostic, Phase-48 D-09 preserved) | unit (main) | `npx vitest run tests/main/variant-scale-guard.spec.ts` | ❌ W0 | ⬜ pending |
| V6 | 49-03 T2 | 2 | EXPORT-01, EXPORT-05 | — | drop-in faithfulness: (a) geometry via Phase-48 oracle `parse(baked,1) ≡ parse(source, scale=s)` (excl. parse ids); (b) the written `{NAME}@{s}x/` package loads via `loadSkeleton` with all JSON `path:` regions resolving (atlas siblings / `images/`); (c) sample the **loaded package** → each attachment world-AABB == `s ×` master world-AABB (spike-003 bar) | oracle (dual-runtime) | `npx vitest run tests/main/variant-dropin-faithful.spec.ts` (+ reuse `tests/scale-bake.spec.ts` harness) | ❌ W0 | ⬜ pending |
| V7 | 49-03 T1 | 2 | EXPORT-05, EXPORT-03 | — | dual-runtime × dual-mode matrix: V3 + V6 parameterized over (4.2 + 4.3) × (atlas-source + atlas-less); atlas-less + `atlas` mode repacks the per-region PNGs into a coherent `{NAME}.atlas` whose region names == JSON `path:` names | matrix (parameterized) | `npx vitest run tests/main/variant-*.spec.ts` | ❌ W0 | ⬜ pending |
| V8 | 49-03 T3 | (defense-in-depth) | EXPORT-02 (L-03) | — | the new skeleton-JSON writer + `s×`-sizing orchestration live in `main/`; `src/core/**` stays free of `node:fs`/`sharp`/`electron` | unit (arch) | `npx vitest run tests/arch.spec.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Threat refs (T-49-DIR outDir path containment, T-49-SRC source-byte integrity) are formalized by the planner's per-PLAN `<threat_model>` block; mapped here prospectively.*

---

## Wave 0 Requirements

New test files to author before/with the implementation tasks (all ❌ today):

- [ ] `tests/core/variant-sizing.spec.ts` — EXPORT-02: the `s × master_peak` exact arithmetic assertion, with + without overrides, at clamp/cap edges; asserts the locked peak-only interpretation (A1) and that no `sampleSkeleton` runs in the variant path.
- [ ] `tests/main/variant-source-immutable.spec.ts` — EXPORT-02: source-never-modified (sha256 before/after; bake input unmutated).
- [ ] `tests/main/variant-package-layout.spec.ts` — EXPORT-01/03: per-mode files exist, clean `{NAME}` basenames, JSON always present, **rollback-leaves-nothing** (oversize-forced).
- [ ] `tests/main/variant-dropin-faithful.spec.ts` — EXPORT-01/05: load the written package + sample + assert `s×` world-AABB; reuse the Phase-48 oracle for geometry.
- [ ] `tests/main/variant-scale-guard.spec.ts` — EXPORT-01: D-08 (`s≥1` reject; `s=0.5` proceed; core bake still direction-agnostic).
- [ ] (defense-in-depth) `tests/arch.spec.ts` named anchor asserting the new JSON writer lives in `main/` (matches the Phase-48 scale-bake anchor precedent `arch.spec.ts:384-394`) — extends an EXISTING file.

**Fixture strategy (EXPORT-05 — NO new committed fixture dir):** Reuse existing committed fixtures.
- Pixel path (`runExport`/`runRepack` read PNG bytes via sharp): drive on `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (4.2, atlas-source, has a real `.png`).
- 4.3 + atlas-less coverage rides the oracle/layout assertions that do NOT read pixels (json+atlas-only fixtures `fixtures/SLIDER_4_3` / `XTRA01_4_3` / `XTRA02_4_3` per `project_rigs_committable_json_atlas_only_no_png`).
- **If any new fixture dir IS committed** (e.g. placeholder 4.3 PNGs): the SAME plan MUST co-extend `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts` (recurring landmine — `feedback_new_committed_fixtures_need_safe01_denylist`, Pitfall 5). Prefer reuse to avoid this entirely.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| "Export Variant…" toolbar action → single-pane dialog opens, basic numeric scale field accepts `s`, folder picker fires, "complete" + reveal-folder | EXPORT-01 | Electron native folder picker + real renderer interaction not jsdom-testable (precedent: Phase 23/34 picker UATs) — automated coverage stops at the IPC handler | In `npm run dev`: open a 4.2 and a 4.3 project; click "Export Variant…", enter `0.5`, pick a parent folder, Export; confirm `{NAME}@0.5x/` appears with the right artifacts for the active output mode and the variant renders in the viewer at half size. Record in `49-HUMAN-UAT.md`. |

*The headless layer (V1–V8) proves sizing, faithfulness, layout, rollback, the guard, and dual-runtime/dual-mode coherence; only the native-dialog + visual end-state is manual. Avoid the "opened ≠ rendered" trap (`feedback_uat_opened_is_not_rendered`) — the UAT criterion is the rendered `{NAME}@{s}x/` package, not "the dialog opened".*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (V1–V8 map every EXPORT req to an automated command; only the native-dialog end-state is manual)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 5 new variant `*.spec.ts` + the arch anchor)
- [ ] No watch-mode flags (all commands are `vitest run`, not `--watch`)
- [ ] Feedback latency < 30s (targeted suites)
- [ ] `nyquist_compliant: true` set in frontmatter (after Wave 0 lands)

**Approval:** pending
