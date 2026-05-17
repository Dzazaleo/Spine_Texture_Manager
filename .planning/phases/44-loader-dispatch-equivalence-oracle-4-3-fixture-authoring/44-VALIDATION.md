---
phase: 44
slug: loader-dispatch-equivalence-oracle-4-3-fixture-authoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-17
---

# Phase 44 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `44-RESEARCH.md` § Validation Architecture. The per-task map
> below is the requirement→test contract; concrete Task IDs are bound by the
> planner/executor at plan time.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest v4 |
| **Config file** | `vitest.config.ts` (auto-discovers `tests/**/*.spec.ts`) |
| **Quick run command** | `npx vitest run tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-43-schema-guard-predicate.spec.ts tests/runtime43/ tests/safe01/safe01-enumeration.spec.ts` |
| **Full suite command** | `npm run test` |
| **Estimated runtime** | ~60–90 seconds (full); <10s targeted |

> Pre-existing noise: ~11 `tests/renderer/*` MixBlend specs fail at IMPORT
> (Phase-47-owned, NOT a Phase-44 regression — memory
> `project_renderer_mixblend_preexisting_failure`). Trust the targeted gates
> and the per-spec Tests line, not the raw suite count.

---

## Sampling Rate

- **After every task commit:** Run the quick command (touched spec(s) + the
  loader-predicate trio + `tests/safe01/safe01-enumeration.spec.ts` — the D-04
  post-flip canary).
- **After every plan wave:** Run the full suite (`npm run test`).
- **Before `/gsd-verify-work`:** Full suite green (modulo the documented
  pre-existing renderer MixBlend import-failures) **AND** the ORCL-02 HARD gate
  green **AND** all 3 entrypoints in the Multi-Runtime Matrix verified **AND**
  the D-04 denylist keeps `safe01-enumeration`/`safe01-baseline` green.
- **Max feedback latency:** ~90 seconds.

---

## Per-Task Verification Map

> Requirement→test contract (Task IDs assigned by planner). Status legend:
> ⬜ pending · ✅ green · ❌ red · ⚠️ flaky

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| DISP-01 | 4.2 JSON→'4.2' tag; 4.3 JSON→'4.3' tag; `checkSpine43Schema` repurposed rejecter→routing | unit | `npx vitest run tests/core/loader-version-guard-predicate.spec.ts tests/core/loader-43-schema-guard-predicate.spec.ts` | ✅ exist · ❌ W0 (add positive-routing cases) | ⬜ pending |
| DISP-01 | end-to-end: a 4.3 fixture loads + samples through `loadSkeleton` (no throw) | integration | `npx vitest run tests/runtime/d13-43-load-smoke.spec.ts` | ✅ exists (D-11: make it real) | ⬜ pending |
| DISP-02 | `<4.2` throws (preserved); `≥4.4`/`≥5` throws (NEW arm); `4.3.x`/`-beta` routes | unit | `npx vitest run tests/core/loader-version-guard-predicate.spec.ts tests/core/errors-version.spec.ts` | ✅ exist · ❌ W0 (add `4.3.0→route`, `4.4.0→throw`, `5.0.0→throw`, `4.3.73-beta→route`, `4.2-from-4.3.01→4.2`) | ⬜ pending |
| DISP-03 | routing decided BEFORE `pickRuntime`/`rt.parseSkeleton`; 4.2 JSON never reaches runtime-43 | structural | `npx vitest run tests/core/loader.spec.ts` | ✅ exists · ❌ W0 (add "tag resolved before parse" assertion) | ⬜ pending |
| ORCL-01 | 4.3 + 4.2 sibling committed in-repo, non-IK | structural | `npx vitest run tests/safe01/phase44-fixture-guard.spec.ts` (+ git-tracked check) | ✅ exists (arms at `CURRENT_PHASE`→44); skeleton2_42.* committed by D-05 | ⬜ pending |
| ORCL-02 | 4.3-runtime vs 4.2-runtime ALL 3 `SamplerOutput` maps within 1e-4 (hybrid abs-OR-rel D-13), HARD phase-exit gate D-14 | integration (HARD gate) | `npx vitest run tests/runtime43/orcl02-equivalence.spec.ts` | ❌ W0: NEW spec — generalize `runtime43-d03.spec.ts` | ⬜ pending |
| ORCL-03 | #891 status — v1.6 NO-OP (ORCL-01 non-IK, source-confirmed `ik:false` both JSONs) | documentation | n/a (CONTEXT documents disposition; no human gate — Phase 42 D-03) | n/a | ⬜ pending |
| XTRA-01 | multi-map fixture: no-throw + own-baseline byte-stable + STRUCTURAL (≥2 typed targets, local+world, mix≠1.0) | integration + structural | `npx vitest run tests/runtime43/xtra01-baseline.spec.ts tests/runtime43/xtra01-structural.spec.ts` | ❌ W0: NEW specs — clone `runtime43-baseline.spec.ts` + parse-JSON structural | ⬜ pending |
| XTRA-02 | scaleYMode fixture: no-throw + own-baseline byte-stable + STRUCTURAL (Uniform AND Volume) | integration + structural | `npx vitest run tests/runtime43/xtra02-baseline.spec.ts tests/runtime43/xtra02-structural.spec.ts` | ❌ W0: NEW specs — same pattern; structural vs 4.3.0 `ScaleYMode`/`"scaleY"` | ⬜ pending |
| D-02 | `SLIDER_4_3/` exists (+ OPTIONAL smoke-load-no-throw via runtime-43) | smoke (optional) | `npx vitest run tests/runtime43/slider43-smoke.spec.ts` | ❌ W0 (OPTIONAL): NEW smoke spec | ⬜ pending |
| D-04 | 4.3 fixtures excluded from SAFE-01 discovery POST-flip (co-required by D-06) | regression | `npx vitest run tests/safe01/safe01-enumeration.spec.ts tests/safe01/safe01-baseline.spec.ts` | ✅ exist · ❌ W0 (add path-prefix denylist to `discover-fixtures.ts`) | ⬜ pending |
| D-11 | `<4.2`/`≥4.4` throw-cases preserved as explicit assertions; 4.3 arms assert routing; CI green at Phase-44 exit | unit | `npm run test` (the 10 enumerated D-11 files all green) | ✅ all 10 exist; modified not new | ⬜ pending |

---

## Wave 0 Requirements

- [ ] `tests/runtime43/orcl02-equivalence.spec.ts` — ORCL-02 (HARD gate; generalize `runtime43-d03.spec.ts` to all-3-maps + D-13 comparator + D-14 hard semantics)
- [ ] `tests/runtime43/xtra01-baseline.spec.ts` + `xtra01-structural.spec.ts` — XTRA-01 (D-03 b+c)
- [ ] `tests/runtime43/xtra02-baseline.spec.ts` + `xtra02-structural.spec.ts` — XTRA-02 (D-03 b+c)
- [ ] `tests/runtime43/slider43-smoke.spec.ts` — D-02 SLIDER smoke (OPTIONAL)
- [ ] `tests/safe01/discover-fixtures.ts` path-prefix denylist — D-04 (CO-REQUIRED by the flip; keeps `safe01-enumeration`/`safe01-baseline` green)
- [ ] New positive-routing cases in `loader-version-guard-predicate.spec.ts` / `loader-43-schema-guard-predicate.spec.ts` — DISP-01/02
- [ ] No framework install needed (vitest present)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Built CJS worker routes a 4.3 input to runtime-43 | DISP-01/03 (Pitfall 5 / A3) | The ambient-`require('../runtime-4x.cjs')` resolver only exists in the BUILT `out/main` artifact, not under `src/` — vitest cannot exercise it | `npm run build`, then sample a 4.3 fixture through the built worker; assert it routes to runtime-43 and lazy-single-copy is preserved |
| CLI (tsx/ESM) routes the 4.3 fixture | DISP-01/03 (memory `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`) | The CLI resolves via `scripts/register-esm-adapter-resolver.ts` (a 3rd distinct runtime arm); `npm test` green-washes this seam | `npm run cli -- fixtures/SIMPLE_PROJECT_43/skeleton2.json` — produces a table (no `pickRuntime` loud-throw, not a reject) |
| spine-editor#891 disposition | ORCL-03 | v1.6 NO-OP by design — ORCL-01 is non-IK (source-confirmed `ik:false` in both JSONs); CONTEXT documents the disposition, no human gate (Phase 42 D-03) | Confirm `ik` absent in `skeleton2.json` + `skeleton2_42.json`; record disposition in SUMMARY |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] 3-entrypoint Multi-Runtime Matrix verified (vitest + built worker + CLI)
- [ ] ORCL-02 HARD gate green
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
