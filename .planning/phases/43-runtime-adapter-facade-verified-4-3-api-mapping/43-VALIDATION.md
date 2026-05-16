---
phase: 43
slug: runtime-adapter-facade-verified-4-3-api-mapping
status: ready
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-17
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `43-RESEARCH.md` § Validation Architecture. Task IDs are assigned by the planner; expand the Per-Task map per plan task at plan/execute time.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 4.x (`package.json:55`) — `environment: 'node'` for `tests/safe01/**` + `core` specs |
| **Config file** | `vitest.config.ts` (repo root; no change needed) |
| **Quick run command** | `npx vitest run tests/safe01/safe01-baseline.spec.ts tests/arch.spec.ts` |
| **Full suite command** | `npm run test` (= `vitest run`) |
| **Estimated runtime** | Quick surface ~<30s (SAFE-02 git-tracked subset + the RT-02 anchor); full suite ~minutes (all `core` specs + the existing reject-guard specs that MUST stay green — Phase 43 does not touch loader behavior) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/safe01/safe01-baseline.spec.ts tests/arch.spec.ts` (the SAFE-02 gate + the RT-02 no-import anchor — the two phase-defining invariants).
- **After every plan wave:** Run `npm run test` (full suite — proves Phase 43 broke nothing pre-existing, incl. the reject-guard specs which stay green since loader behavior is untouched, D-02).
- **Before `/gsd-verify-work 43`:** Full suite green **+ the D-04 local heavy-rig SAFE-02 run recorded in `43-VERIFICATION.md`** + the 4.3 own-baseline captured & committed (D-01) + `safe01-freeze-guard.spec.ts` green (baseline-predates-alias still holds).
- **Max feedback latency:** ~30 seconds (quick surface).
- **Observable-behavior granularity (Nyquist rationale):** SAFE-02 is sampled at *full canonicalized `SamplerOutput`* granularity — every `${skin}/${slot}/${attachment}` record across all 3 maps (`globalPeaks` + `perAnimation` + `setupPosePeaks`), strict `toEqual` (NOT epsilon). The failure mode is *silent per-attachment undersize from a leaking facade*; a single drifted record is the smallest detectable failure and strict full-output equality samples it exactly with no aliasing. The 4.3 own-baseline is a *sentinel* (regression detector), not the phase-stop gate (D-01) — sampled per-wave. The D-04 heavy-rig gate is the anti-aliasing measure for "subtle drift hides in complex rigs" — sampled once at the phase gate, locally, because the heavy baselines are gitignored.

---

## Per-Task Verification Map

> Task IDs (`43-PP-TT` = phase 43, plan PP, task TT) are the concrete plan/task each row maps onto; the planner assigns them. `File Exists ❌ W0` = the test seam is PLANNED in the named plan/task but not yet BUILT (created when that task executes).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 43-PP-TT | TBD | TBD | SAFE-02 | — | Every git-tracked 4.2 fixture's full canonical `SamplerOutput` byte-identical through the rewired adapter (strict `toEqual`); baselines FROZEN (D-09) | regression (golden) | `npx vitest run tests/safe01/safe01-baseline.spec.ts` | ✅ exists — re-runs through rewired path | ⬜ pending |
| 43-PP-TT | TBD | TBD | SAFE-02 (heavy, D-04) | — | Heavy/proprietary rigs (`Girl/`,`SKINS/`,`CHJ/`,`3Queens/`,`Jokerman/`) byte-identical, run LOCALLY with gitignored baselines present; result recorded in `43-VERIFICATION.md` | regression, presence-guarded | `npx vitest run tests/safe01/safe01-baseline.spec.ts` *(heavy baselines present)* | ✅ exists — `it.skipIf` arm `safe01-baseline.spec.ts:83-98` | ⬜ pending |
| 43-PP-TT | TBD | TBD | SAFE-02 (enumeration) | — | No fixture silently dropped / no undeclared new fixture; D-05: only the 4.3 file committed (4.2 sibling stays untracked → not discovered) | regression | `npx vitest run tests/safe01/safe01-enumeration.spec.ts` | ✅ exists | ⬜ pending |
| 43-PP-TT | TBD | TBD | SAFE-02 (freeze) | — | Baseline commit predates alias; no env-regen of baselines | meta-test | `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ✅ exists | ⬜ pending |
| 43-PP-TT | TBD | TBD | RT-02 | T-cross-runtime | `sampler.ts`/`bounds.ts`/`loader.ts` import NO spine-core package directly (named arch anchor) | arch (grep glob) | `npx vitest run tests/arch.spec.ts` | ❌ W0 — ADD named anchor (pattern `arch.spec.ts:148-178` globSync scanner) | ⬜ pending |
| 43-PP-TT | TBD | TBD | SAFE-03 | T-cross-runtime | Each loaded skeleton's attachments resolve `attachmentKind`/`instanceof` against the loading runtime; cross-feed detected via `handleRuntime` | regression | `npx vitest run tests/<new>/safe03-cross-runtime.spec.ts` | ❌ W0 — NEW spec | ⬜ pending |
| 43-PP-TT | TBD | TBD | PORT-01 / PORT-02 / PORT-03 | T-wrong-pose | 4.3 `skeleton2.json` samples without throw via verified Pose API; byte-stable vs its OWN 4.3 baseline (SEPARATE store, NOT golden-shared — D-01); rotated-region geometry correct; `TransformConstraint`-on-`SQUARE` canary | regression (own-baseline) | `npx vitest run tests/<new>/runtime43-baseline.spec.ts` | ❌ W0 — NEW spec + freshly-captured 4.3 baseline | ⬜ pending |
| 43-PP-TT | TBD | TBD | PORT-03 (A1 — highest risk) | T-wrong-pose | 4.3 rotated-region (`rotate:90` regions in `skeleton2.atlas`) offsets validated against known-good (editor bounds or 4.2-sibling geometry) BEFORE the `applyRotatedRegionFix` no-op is declared; fallback = re-express Phase-33 math into `sequence.offsets[]` | regression | `npx vitest run tests/<new>/runtime43-baseline.spec.ts` | ❌ W0 — empirical validation task, NOT an assumption | ⬜ pending |
| 43-PP-TT | TBD | TBD | PORT-01 (D-03) | T-wrong-pose | runtime-43 dev-assertion fires if a pre-constraint `pose` is read where `appliedPose` is required; positive: `SQUARE` peak is the post-`TransformConstraint` value | unit | `npx vitest run tests/<new>/runtime43-d03.spec.ts` | ❌ W0 — NEW unit | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/arch.spec.ts` named anchor — `sampler.ts`/`bounds.ts`/`loader.ts` ↛ direct `spine-core`/`spine-core-42` import (covers RT-02). Extend the existing globSync scanner + add a named `describe` block (precedent: Phase-9/18/36 named anchors at `arch.spec.ts:200-231`).
- [ ] `tests/<new>/safe03-cross-runtime.spec.ts` — SAFE-03 invariant (attachmentKind resolves against the loading runtime; cross-feed detected via `handleRuntime`).
- [ ] `tests/<new>/runtime43-baseline.spec.ts` + a captured `skeleton2.json` 4.3 `SamplerOutput` baseline in a SEPARATE store from `tests/safe01/baselines/` (NOT golden-shared — D-01). Reuse `canonical-json.ts`'s serializer for byte-stability.
- [ ] `tests/<new>/runtime43-d03.spec.ts` — D-03 dev-assertion unit + the `TransformConstraint`-on-`SQUARE` post-constraint canary.
- [ ] **Interface-completeness gap (escalated — RESEARCH Q1):** an `attachmentTimelineNames`-style additive adapter method so `sampler.ts` can drop its `AttachmentTimeline`/`Skeleton`/`AnimationState` spine-core import. The planner must resolve Q1 (recommended: one strictly-additive interface method — RT-02 requires it; the Phase-42 "locked" status should not block a strictly-additive completion).
- [ ] No framework install needed (vitest present).

*Wave 0 builds the four test seams above before the implementation tasks that they verify.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Heavy/proprietary-rig SAFE-02 byte-equality (`Girl/`, `SKINS/`, `CHJ/`, `3Queens/`, `Jokerman/`) | SAFE-02 / D-04 | Heavy-rig baselines are gitignored (present locally only, per Phase-42 D-08-R); CI runs only the redistributable subset — "subtle drift hides exactly there" so a documented local pass is a HARD close gate | Locally, with the gitignored heavy baselines present, run `npx vitest run tests/safe01/safe01-baseline.spec.ts`; record the pass (fixture set + result) in `43-VERIFICATION.md`. CI-subset-green alone does NOT close Phase 43. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (the 4 new test seams + the Q1 interface method)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (quick surface)
- [x] `nyquist_compliant: true` set in frontmatter (derived from `43-RESEARCH.md` § Validation Architecture; per-task IDs expanded by planner/executor)

**Approval:** pending
