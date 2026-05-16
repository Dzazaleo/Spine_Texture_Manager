---
phase: 42
slug: pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `42-RESEARCH.md` § Validation Architecture. Task IDs are assigned by the planner; expand the Per-Task map per plan task at plan/execute time.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `vitest` 4 (already a devDependency) — `environment: 'node'`, `include: ['tests/**/*.spec.ts','tests/**/*.spec.tsx']` |
| **Config file** | `vitest.config.ts` (no change needed) |
| **Quick run command** | `npx vitest run tests/safe01 tests/runtime tests/arch.spec.ts` |
| **Full suite command** | `npm run typecheck && npm run test` (`tsc --noEmit` proves 4.2/4.3 type isolation; `vitest run` = what CI's `test` job runs) |
| **Estimated runtime** | Quick surface ~<15s (SAFE-01 baseline excl. gitignored heavy rigs runs in seconds); full suite ~minutes (existing regression suite + heavy rigs e.g. `Girl/` ~606ms) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/safe01 tests/runtime tests/arch.spec.ts`
- **After every plan wave:** Run `npm run typecheck && npm run test` (proves Phase 42 broke nothing pre-existing)
- **Before `/gsd-verify-work 42`:** Full suite green on the 3-OS CI matrix + the git-ancestry CI step green + (at PR→main) the production-bundle smoke green
- **Max feedback latency:** ~60 seconds (quick surface)
- **Observable-behavior granularity (Nyquist rationale):** SAFE-01 is sampled at *full `SamplerOutput`* granularity — every `${skin}/${slot}/${attachment}` record across all 3 maps (`globalPeaks` + `perAnimation` + `setupPosePeaks`, D-06), strict equality. The failure mode is *silent per-attachment undersize*; coarser sampling (`globalPeaks`-only or a digest) lets per-animation/setup-pose drift that nets out at the global peak slip through. The Nyquist rate is "every record, every fixture, every commit" — anything coarser under-samples the failure surface.

---

## Per-Task Verification Map

> Task IDs (`42-PP-TT`) are assigned by the planner. Until then this is the requirement→behavior→test scaffold from RESEARCH.md; the planner/executor maps each row onto its concrete task. `File Exists ❌ W0` = the test file is a Wave 0 gap (must be created before it can gate).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SAFE-01 | — | Every discovered 4.2 fixture's full `SamplerOutput` byte-identical to committed canonical baseline (strict `toEqual`) | golden | `npx vitest run tests/safe01/safe01-baseline.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SAFE-01 | — | Discovered fixture set == committed enumeration manifest (silent dropout = failure, D-08) | unit | `npx vitest run tests/safe01/safe01-enumeration.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SAFE-01 | T-supply-chain | SAFE-01 baseline commit is a git ancestor of the npm-alias commit (D-09; skip-with-reason until alias exists, hard-assert after) | integration | `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SAFE-01 | — | Canonical serializer deterministic; surfaces (not hides) `NaN`/`Infinity`/`-0` as string sentinels | unit | `npx vitest run tests/safe01/canonical-json.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SAFE-01 | — | No `UPDATE_FIXTURES`/`process.env` regen branch in the SAFE-01 baseline spec (D-09 no-escape-hatch) | unit (meta) | `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-01 | T-supply-chain | `@esotericsoftware/spine-core` and `spine-core-42` resolve to distinct versions under vitest/Node | unit | `npx vitest run tests/runtime/alias-resolution.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-01 | — | Dual-type isolation: 4.2 and 4.3 `Skeleton` types non-overlapping under `tsc moduleResolution:bundler` | typecheck | `npm run typecheck` | ✅ (cmd exists) | ⬜ pending |
| TBD | TBD | TBD | RT-01 | T-supply-chain | `npm ci` from committed lockfile reproduces both copies (no churn) | CI step | `npm ci` in `ci.yml` `test` job | ❌ W0 (ci.yml) | ⬜ pending |
| TBD | TBD | TBD | RT-01 | — | Vite renderer + Vite main both build with the alias resolvable | CI step | `npm run build` in `ci.yml` `bundle-smoke` | ❌ W0 (ci.yml) | ⬜ pending |
| TBD | TBD | TBD | RT-03 | — | `adapter42.version !== adapter43.version`; `Slider`/`BonePose`/`Pose`/`Posed`/`SlotPose` exist only in 4.3 module | unit | `npx vitest run tests/runtime/runtime-distinctness.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-03 | — | A cross-runtime handle mix is a **compile-time** error (brand + required `__rt`) | typecheck (neg) | `npm run typecheck` + a `// @ts-expect-error` fixture | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RT-03 | — | No source file imports BOTH spine-core alias specifiers (backstop) | unit (arch) | `npx vitest run tests/arch.spec.ts` | ✅ (extend) | ⬜ pending |
| TBD | TBD | TBD | RT-04 | — | `core/runtime/**` imports no DOM/Electron/sharp/node:fs (and no spine-core in Phase 42) | unit (arch) | `npx vitest run tests/arch.spec.ts` | ✅ (extend) | ⬜ pending |
| TBD | TBD | TBD | CI-01 | — | `ci.yml` triggers push(any)+PR→main+dispatch, NEVER tags; `paths-ignore` skips docs-only | CI (self) | workflow runs on push; manual `paths-ignore` review | ❌ W0 (ci.yml) | ⬜ pending |
| TBD | TBD | TBD | CI-01 | — | 3-OS matrix runs full vitest + SAFE-01 gate + ancestry + distinctness on every code push | CI | `ci.yml` `test` job (3-OS) | ❌ W0 (ci.yml) | ⬜ pending |
| TBD | TBD | TBD | CI-01 / D-13 | T-input-parsing | In-repo 4.3 JSON loads through 4.3 `SkeletonJson` directly without the v1.4 reject (integrity, not value) | integration | `npx vitest run tests/runtime/d13-43-load-smoke.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | CI-01 | T-supply-chain | electron-builder packages BOTH spine-core copies; built worker runs against a 4.2 + the 4.3 fixture | CI | `ci.yml` `bundle-smoke` (PR→main only) | ❌ W0 (ci.yml) | ⬜ pending |
| TBD | TBD | TBD | CI-01 / D-13 | — | CI FAILS if owner ORCL-01/SLIDER-01 fixtures absent once milestone reaches Phase 44 | unit (phase-gated) | `npx vitest run tests/safe01/phase44-fixture-guard.spec.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/safe01/canonical-json.ts` + `canonical-json.spec.ts` — deterministic serializer + determinism/sentinel self-test (must exist & be proven before it gates `core/`)
- [ ] `tests/safe01/discover-fixtures.ts` — auto-discovery + "samples OK" predicate (D-08 / D-08-R two-tier)
- [ ] `tests/safe01/safe01-baseline.spec.ts` — strict `toEqual` vs committed per-fixture JSON (SAFE-01)
- [ ] `tests/safe01/safe01-enumeration.spec.ts` — discovered set == manifest (D-08 dropout-is-failure)
- [ ] `tests/safe01/safe01-freeze-guard.spec.ts` — git-ancestry assertion (D-09) + no-regen meta-test
- [ ] `tests/safe01/baselines/_manifest.json` + per-fixture `*.json` — COMMITTED frozen baseline (COMMIT A; git-tracked subset NOT gitignored; heavy-rig baselines gitignored + `it.skipIf` per D-08-R)
- [ ] `tests/safe01/phase44-fixture-guard.spec.ts` + `phase-gate.ts` — D-13 Phase-44 owner-fixture-absence guard
- [ ] `tests/runtime/alias-resolution.spec.ts` — both specifiers resolve distinctly (RT-01)
- [ ] `tests/runtime/runtime-distinctness.spec.ts` — v42≠v43; Slider/BonePose 4.3-only (RT-03)
- [ ] `tests/runtime/d13-43-load-smoke.spec.ts` — 4.3 `SkeletonJson` direct load past v1.4 reject (D-13)
- [ ] `src/core/runtime/types.ts` + `runtime.ts` — opaque handles + `SpineRuntime` interface (signatures only; RT-03/RT-04)
- [ ] `tests/arch.spec.ts` — append `core/runtime/` Layer-3 anchor + no-co-mingled-imports anchor (RT-04/RT-03 backstop) — *extends existing file*
- [ ] `.github/workflows/ci.yml` — dual-runtime gate workflow (CI-01) — *new file; release.yml untouched*
- [ ] A `// @ts-expect-error` compile-negative fixture proving a cross-runtime handle mix fails `tsc` (RT-03)
- [ ] `42-OWNER-EXPORT-SPEC.md` — owner handoff doc (D-01..D-05) — *no code; docs deliverable*

*Framework install: none — `vitest` 4 already a devDependency; no new test tooling.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `ci.yml` `paths-ignore` glob set correctly excludes docs-only commits but never skips a commit that also touches code | CI-01 / D-11 | CI self-trigger behavior is observed at push time, not cleanly unit-testable in isolation | After `ci.yml` lands, push a docs-only commit (`.planning/**`-only) — CI must NOT run; push a commit touching code — CI MUST run; review the glob list against D-11 |
| `42-OWNER-EXPORT-SPEC.md` is complete & self-contained enough for the owner to export all 5 artifacts (ORCL-01 ×2, SLIDER-01, XTRA-01, XTRA-02) in one Spine session | (handoff for SAFE-01/Phase 44) | It is an owner handoff document; "correctness" = a human (owner) can follow it end-to-end without back-and-forth | Owner/reviewer reads the spec and confirms each rig's parameters, artifact set (D-04 atlas-source), redistributability statement (D-05), and the spine-editor#891 rationale (D-03) are unambiguous |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
