---
phase: 46
slug: slider-constraint-validation-4-3-performance-budget
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 46 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `46-RESEARCH.md` §Validation Architecture (research commit `164a139`).
> This whole phase IS a validation proof — the contract below is the deliverable, not scaffolding around it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest `^4.0.0` |
| **Config file** | `vitest.config.ts` (existing — covers the 1244-test suite per STATE.md) |
| **Quick run command** | `npx vitest run tests/runtime43/slider43-closedform.spec.ts tests/main/sampler-worker-spineboy43.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | Quick ~10 s; full suite per STATE.md baseline |

---

## Sampling Rate

- **After every task commit:** Run the quick run command (closed-form spec; perf spec once added)
- **After every plan wave:** Run `npm run test` (full suite — confirm no regression)
- **Before `/gsd-verify-work`:** Full suite green **modulo the documented pre-existing `tests/renderer/*` MixBlend IMPORT failures** (Phase-47-owned, NOT this phase — memory `project_renderer_mixblend_preexisting_failure`), PLUS both new gates green, PLUS `fixtures/SLIDER_4_3/NOTES.txt` present/parseable, PLUS zero-`src/core/`-diff
- **Sampler rate:** 120 Hz default (CLAUDE.md Fact 6). **No higher Nyquist rate needed** — the slider-driven scale peak is a monotone linear ramp at the keyed terminal frame (t=1.0 s lands exactly on the 120-step grid; `sampler.ts:322` terminal `+1e-9` epsilon independently catches it). Justified in RESEARCH.md §Sampling Rate.
- **Max feedback latency:** ~10 s (targeted run)

---

## Per-Task Verification Map

> Task IDs (`46-NN-NN`) are assigned by gsd-planner at plan time and gsd-executor populates this table per commit.
> The pre-task authoritative contract is the **Phase Requirements → Test Map** below, lifted verbatim from `46-RESEARCH.md` §Validation Architecture.

### Phase Requirements → Test Map (authoritative)

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLIDER-01 | The 4.3 slider rig is committed in-repo & parses through runtime-43 | smoke (already covered) | `npx vitest run tests/runtime43/slider43-smoke.spec.ts` | ✅ (Phase 44) |
| SLIDER-02 (peak) | Sampled `globalPeaks` `square` peakScale == hand-derived literal `4.0` within `toBeCloseTo(...,5)` | closed-form unit | `npx vitest run tests/runtime43/slider43-closedform.spec.ts` | ❌ W0 |
| SLIDER-02 (triangulation, D-05) | Owner editor-observed value in `fixtures/SLIDER_4_3/NOTES.txt` == `4.0` within `1e-2` (loud-fail if absent/unparseable) | closed-form unit | (same file, additional `expect`) | ❌ W0 |
| SLIDER-02 (SC#2, zero slider code) | No slider-specific symbol in `src/core/` (structural: closed-form test passes against unchanged `core/`) + `git diff` scope check empty | structural assertion | `git diff --name-only <phase-base>..HEAD -- src/core/ \| wc -l` == 0 | ❌ W0 |
| PERF-01 | `runSamplerJob` on spineboy-pro (warm-up discarded) < `measured × 3` ms, CI-enabled | perf integration | `npx vitest run tests/main/sampler-worker-spineboy43.spec.ts` | ❌ W0 |

*Per-task status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/runtime43/baseline-driver.ts` — ADD `buildLoadSlider43()` (clone of `buildLoad43()`, repointed to `fixtures/SLIDER_4_3/SLIDER-01.*`, dir-scan resolution, `load43.ts` loud-or-skip contract)
- [ ] `tests/runtime43/slider43-closedform.spec.ts` — SLIDER-02 (closed-form peak `4.0` + D-05 NOTES.txt triangulation)
- [ ] `tests/main/sampler-worker-spineboy43.spec.ts` — PERF-01 (clone of `sampler-worker-girl.spec.ts`, `it.skipIf` REMOVED, repointed to spineboy-pro, BUDGET = measured×3, `[PERF-43]` log)
- [ ] `fixtures/SLIDER_4_3/NOTES.txt` — owner-authored (D-03) via the §-spec; SLIDER-02 D-05 arm depends on it
- [ ] `46-OWNER-EXPORT-SPEC.md` — the D-10 §-spec (spineboy version-align acceptance token [already DONE — records `4.3.01`]; NOTES.txt value/frame/units)
- [ ] Framework install: none — vitest already present

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Owner reads Spine 4.3 editor `slider_bone` world scale at `slide` t=1.0 s and records it in `fixtures/SLIDER_4_3/NOTES.txt` | SLIDER-02 (D-03/D-05) | Requires the proprietary Spine 4.3 editor (external tool, not scriptable in CI) | Per `46-OWNER-EXPORT-SPEC.md` Action (b): open SLIDER-01 rig, play `slide`, scrub to t=1.0 s (frame 30 @ 30 fps dopesheet), record `slider_bone world scaleX/scaleY` (expected ≈ 4.0). The SLIDER-02 test then machine-parses NOTES.txt and asserts == 4.0 within 1e-2. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (5 items above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
