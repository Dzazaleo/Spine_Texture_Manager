---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
verified: 2026-05-16T21:20:00Z
status: gaps_found
score: 4/5 must-haves verified (1 partial)
overrides_applied: 0
gaps:
  - truth: "RT-01: a runtime-distinctness test asserts adapter42.version !== adapter43.version and that Slider/BonePose exist only in the 4.3 module (ROADMAP Phase-42 Success Criterion #2)"
    status: partial
    reason: >-
      The dual-install itself is fully correct and independently verified
      (canonical @esotericsoftware/spine-core@4.3.0 exports Slider/BonePose;
      spine-core-42 alias = 4.2.111 does NOT; both resolve under node/vitest/tsc).
      However the ROADMAP-contracted *automated regression test* that asserts and
      locks this distinctness does not exist in the codebase. Git history shows
      the pre-replan 42-02-PLAN explicitly scoped tests/runtime/runtime-distinctness.spec.ts
      with the exact matching must_have; the Option-1 re-plan (commit c87a95f)
      silently removed that test artifact + its must_have/key_link from the plan
      while 42-REPLAN-NOTE.md only documents the typecheck-scope narrowing — the
      distinctness-test removal was collateral scope reduction, NOT an
      explicitly-reasoned descope. The ROADMAP plan-list line for 42-02 still
      reads "+ resolution/distinctness tests" and ROADMAP SC #2 (a non-negotiable
      contract) still requires it. Distinctness is functionally TRUE but not
      regression-locked by an automated test.
    artifacts:
      - path: "tests/runtime/runtime-distinctness.spec.ts"
        issue: "Does not exist. No test in tests/ asserts adapter42.version !== adapter43.version or Slider/BonePose-only-in-4.3. (d13-43-load-smoke.spec.ts only drives 4.3 SkeletonJson for integrity; it does not assert version/export distinctness between the two installs.)"
    missing:
      - "A small spec (e.g. tests/runtime/runtime-distinctness.spec.ts) importing from both '@esotericsoftware/spine-core' (4.3.0) and 'spine-core-42' (4.2.111) that asserts: (a) both resolve under vitest without throwing, (b) the two .version values differ (4.3.0 vs 4.2.111), (c) Slider and BonePose are exported from the 4.3 module and ABSENT from spine-core-42. This is a non-spine-core-logic, behavior-neutral test addition (no COMMIT A/B/repoint/C/D ancestry impact) and can land as a follow-up commit descendant of D."
human_verification:
  - test: "Decision on CR-01 (forward-fragility of the D-09 introducing-commit resolution)"
    expected: "Decide whether to apply /gsd-code-review-fix now (switch ci.yml:117 and safe01-freeze-guard.spec.ts:63 to `git log --reverse -S 'spine-core-42' --format=%H -- package.json | head -1` + a `grep -q spine-core-42 package.json` presence guard) OR carry CR-01 as an explicit Phase-44/45 entry-gate pre-req (Phase 44/45 churns package.json — the fragility becomes load-bearing there, not in Phase 42)."
    why_human: "Empirically the D-09 gate resolves correctly AS SHIPPED TODAY (pickaxe set size = 1; tail-1 == --reverse|head-1; baseline 1b5327d machine-verified ancestor of alias cc5783f; SAFE-01 ordering invariant genuinely enforced). CR-01 is a robustness gap that only manifests once a future phase removes-then-re-adds the spine-core-42 literal — a scheduling/risk-tolerance decision, not a Phase-42 goal failure, and explicitly surfaced by the orchestrator for developer decision."
---

# Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding — Verification Report

**Phase Goal:** De-risk the entire v1.6 milestone by freezing the existing 4.2 behavior as a committed byte-equal golden BEFORE any code changes, then landing the lockfile-pinned dual-install and the opaque-handle boundary scaffolding that gates every downstream phase.

**Verified:** 2026-05-16T21:20:00Z
**Status:** gaps_found (1 partial against ROADMAP SC #2) + 1 human-decision item (CR-01)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the non-negotiable contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SAFE-01) | A deterministic byte-equal golden snapshot of SamplerOutput for every in-repo 4.2 fixture is committed in a commit that **predates** the npm-alias commit (order is the acceptance test) | ✓ VERIFIED | COMMIT A `1b5327d` (manifest-add) is machine-verified `git merge-base --is-ancestor` of alias commit `cc5783f`. 11 git-tracked baseline JSONs + `_manifest.json` committed. `safe01-baseline.spec.ts`: all 11 fixtures byte-equal (16 passed). `safe01-freeze-guard.spec.ts` ancestry assertion now HARD-PASSING (435ms, flipped from skip→assert as designed). Canonical serializer has NaN/-0 string sentinels + toPrecision(15) clamp + zero core/sharp/electron import + zero regen branch. |
| 2 (RT-01) | From a fresh clone, 4.3.0 (canonical) + 4.2.111 (alias) both resolve identically; **a runtime-distinctness test asserts adapter42.version !== adapter43.version and Slider/BonePose exist only in the 4.3 module** | ✗ PARTIAL | Dual-install fully correct: package.json `@esotericsoftware/spine-core@4.3.0` + `spine-core-42`=`npm:@esotericsoftware/spine-core@4.2.111` + spine-player still 4.2.111; lockfile integrity-pinned (sha512); both installed (4.3.0 / 4.2.111); functionally `Slider`/`BonePose` in canonical only — VERIFIED. **BUT the ROADMAP-contracted automated runtime-distinctness test does NOT exist** (removed by the Option-1 re-plan, not a documented descope). Full suite (954 passed) proves both resolve under vitest, but no test asserts version/export *distinctness*. See Gaps. |
| 3 (RT-03) | A 4.2-object-at-a-4.3-boundary is a **compile-time** error: opaque branded handles carry a required runtime tag; no source file imports both alias specifiers (arch-enforced) | ✓ VERIFIED | `src/core/runtime/types.ts`: 8 `unique symbol` per-kind brands + REQUIRED non-optional `__rt: RuntimeTag` (0 optional `__rt?:`) + 3 helper exports. `handle-brand-negative.ts`: 7 `@ts-expect-error`, **ZERO leaked tsc errors** → all directives consumed by genuine compile errors → wall is REAL (an unused directive would fail `typecheck:node`). RT-03 backstop arch anchor present + green; no `src/**` co-mingling; `spine-core-43` (rejected key) absent. |
| 4 (RT-04) | The new core/runtime/ module imports no DOM, Electron, or sharp; Layer-3 purity green under tests/arch.spec.ts | ✓ VERIFIED | `grep` for `@esotericsoftware/spine-core|spine-core-42|sharp|electron|node:fs` in `types.ts`+`runtime.ts` = 0. RT-04 arch anchor `Phase 42 RT-04` present, `globSync('src/core/runtime/**')`, asserts `.toEqual([])`, green in the 38-pass arch+safe01 run. `runtime.ts` signatures-only (31 signatures, no bodies, `pickRuntime` as `export declare`). |
| 5 (CI-01) | CI runs from a fresh clone vs 4.2.x+4.3.x slots, alias resolves reproducibly under npm ci, both spine-core copies packaged, PR-only production-bundle smoke runs the built worker (not src/) vs a 4.2+4.3 fixture | ✓ VERIFIED | `.github/workflows/ci.yml` (225 lines): 0 `tags:` lines, 5×`fetch-depth: 0`, 2×`merge-base --is-ancestor`, bare `typecheck:node` (1) + 0 full `typecheck`, 3-OS matrix (ubuntu/windows/macos all present), 1 PR-only `bundle-smoke` asserting BOTH `node_modules/@esotericsoftware/spine-core`(4.3.0)+`spine-core-42`(4.2.111) survive packaging and runs built `out/main/sampler-worker.cjs` vs SIMPLE_TEST + 4.3 SkeletonJson, 4 pinned-SHA actions. `release.yml` byte-untouched in Phase 42. D-13 smoke PASSES (4.3 JSON parses past v1.4 reject via direct 4.3 SkeletonJson). Phase-44 guard correctly SKIPS (CURRENT_PHASE=42<44). `42-OWNER-EXPORT-SPEC.md` (187 lines) with all content tokens. |

**Score:** 4/5 ROADMAP success criteria fully verified; 1 (RT-01) PARTIAL — dual-install correct, distinctness test artifact missing.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/safe01/canonical-json.ts` | Deterministic serializer | ✓ VERIFIED | 107 lines; NaN/-0 sentinels; toPrecision(15); no core import |
| `tests/safe01/discover-fixtures.ts` | Auto-discovery | ✓ VERIFIED | 101 lines; predicate-based, no hand-list |
| `tests/safe01/safe01-baseline.spec.ts` | Strict byte-equal toEqual | ✓ VERIFIED | 99 lines; no regen branch; 11 fixtures byte-equal |
| `tests/safe01/safe01-freeze-guard.spec.ts` | D-09 ancestry + no-regen meta | ✓ VERIFIED | 125 lines; merge-base×4, diff-filter=A, hard-passing now |
| `tests/safe01/baselines/_manifest.json` + 11 baselines | Committed golden set | ✓ VERIFIED | 12 git-tracked files; `_meta` provenance present |
| `package.json` / `package-lock.json` | 4.3.0 canonical + spine-core-42 alias | ✓ VERIFIED | Frozen COMMIT B `cc5783f`; integrity sha512 pinned |
| `src/core/runtime/types.ts` | unique-symbol brands + required __rt | ✓ VERIFIED | 72 lines; 8 brands; 3 helpers; 0 forbidden imports |
| `src/core/runtime/runtime.ts` | SpineRuntime signatures-only | ✓ VERIFIED | 64 lines; 31 sigs; declared pickRuntime; boneAxisScale-only (no slotBone) |
| `src/core/types.ts` LoadResult.runtime? | Additive optional field | ✓ VERIFIED | `runtime?: SpineRuntime` at :190; type-only import at :22 |
| `tests/runtime/handle-brand-negative.ts` | @ts-expect-error compile-negative | ✓ VERIFIED | 78 lines; 7 directives, all consumed (0 leaked) |
| `.github/workflows/ci.yml` | Dual-runtime gate | ✓ VERIFIED | 225 lines; all properties confirmed |
| `tests/runtime/d13-43-load-smoke.spec.ts` | 4.3 SkeletonJson direct-load | ✓ VERIFIED | Passes; bypasses gated loader; consumes 4.3 constraints[] |
| `tests/safe01/phase-gate.ts` + `phase44-fixture-guard.spec.ts` | CURRENT_PHASE marker + guard | ✓ VERIFIED | `CURRENT_PHASE=42 as const`; guard skips-with-reason |
| `42-OWNER-EXPORT-SPEC.md` | One-session owner handoff | ✓ VERIFIED | 187 lines; all required tokens present |
| `tests/runtime/runtime-distinctness.spec.ts` | RT-01 version/export distinctness | ✗ MISSING | Removed by Option-1 re-plan; ROADMAP SC #2 still requires it |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| COMMIT A `1b5327d` | COMMIT B `cc5783f` | `git merge-base --is-ancestor` | ✓ WIRED | TRUE — baseline predates alias (the existential SAFE-01 invariant) |
| COMMIT B `cc5783f` | repoint `1a8c18b` | descendant | ✓ WIRED | TRUE — A→B→repoint linear |
| repoint `1a8c18b` | COMMIT C `b6f3177` | descendant | ✓ WIRED | TRUE |
| COMMIT C `b6f3177` | COMMIT D `2360c51` | descendant | ✓ WIRED | TRUE — full A→B→repoint→C→D chain, all ancestors of HEAD |
| 8 bare consumers (src/+tests) | `spine-core-42` | mechanical specifier rename | ✓ WIRED | repoint `1a8c18b` = specifier-only (16 files, 19+/18−); all 8 prod files now `spine-core-42`, 0 bare; SAFE-01 re-verified byte-equal |
| `safe01-freeze-guard.spec.ts` | git history | merge-base/pickaxe | ✓ WIRED | Hard-asserts A→B ancestry now (not skipped) |
| `ci.yml` D-09 step | git history | `git log -S 'spine-core-42' \| tail -1` | ⚠️ WIRED (fragile) | Resolves correctly TODAY (pickaxe size=1); CR-01 forward-fragility — see Human Verification |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `safe01-baseline.spec.ts` | per-fixture canonical SamplerOutput | live `loadSkeleton`+`sampleSkeleton` (4.2.111 via spine-core-42) vs committed baseline JSON | ✓ Yes — 11 fixtures byte-equal against real committed goldens | ✓ FLOWING |
| `d13-43-load-smoke.spec.ts` | parsed 4.3 skeletonData | real 4.3.0 `SkeletonJson` over `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` | ✓ Yes — parses past v1.4 reject, consumes 4.3 constraints[] | ✓ FLOWING |
| `handle-brand-negative.ts` | tsc diagnostics | real `tsc -p tsconfig.node.json` | ✓ Yes — 7 directives consumed by genuine TS2345 errors | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| SAFE-01 byte-equal + freeze-guard | `npx vitest run tests/safe01 tests/arch.spec.ts` | 5 passed / 1 skipped, 38 tests, 0 failed; ancestry assertion hard-passing | ✓ PASS |
| Phase-42 unified test gate (excl. Phase-47-owned renderer + scratch) | `CI=true npx vitest run --exclude '**/tests/renderer/**' --exclude '**/_trace_tmp/**'` | 75 files passed / 3 skipped; **954 passed / 0 failed** / 31 skipped | ✓ PASS |
| typecheck:node fresh-clone-equivalent gate | `npm run typecheck:node` then strip gitignored scratch | 140 raw errors ALL in gitignored `scripts/probe-*`/`diagnose-*`/`_trace_tmp`; **0 git-tracked errors** → fresh-clone exit 0 | ✓ PASS |
| Compile-negative wall is real | `tsc -p tsconfig.node.json \| grep handle-brand-negative` | 0 leaked errors → all 7 `@ts-expect-error` consumed | ✓ PASS |
| D-13 4.3 load-smoke | `npx vitest run tests/runtime/d13-43-load-smoke.spec.ts` | 1 passed | ✓ PASS |
| Phase-44 guard skip-with-reason | `npx vitest run tests/safe01/phase44-fixture-guard.spec.ts` | 1 skipped (CURRENT_PHASE=42<44) | ✓ PASS |
| RT-01 functional distinctness (manual, no test) | `node -e "require('@esotericsoftware/spine-core'); require('spine-core-42')"` | canonical has Slider/BonePose; alias does not; both resolve | ✓ PASS (functionally) — but NOT regression-locked by a test |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SAFE-01 | 42-01, 42-02 | Byte-equal golden committed before the npm alias | ✓ SATISFIED | A→B ancestry machine-verified; 11 fixtures byte-equal; freeze-guard hard-passing |
| RT-01 | 42-02 | 4.3.0 canonical + 4.2.111 exact-pinned alias; both resolve; distinctness test | ⚠️ PARTIAL | Dual-install + resolution VERIFIED; the ROADMAP-required distinctness *test* is MISSING (re-plan collateral removal) |
| RT-03 | 42-03 | Cross-runtime mix is a compile-time error; no co-mingled imports | ✓ SATISFIED | unique-symbol brand wall proven real (0 leaked @ts-expect-error); RT-03 backstop green |
| RT-04 | 42-03 | core/runtime/ Layer-3 pure, arch-enforced | ✓ SATISFIED | 0 forbidden imports; RT-04 arch anchor green |
| CI-01 | 42-04 | CI fresh-clone dual-runtime gate + bundle-smoke + packaging | ✓ SATISFIED | ci.yml verified; release.yml untouched; D-13 smoke passes |

No orphaned requirements — REQUIREMENTS.md maps exactly {SAFE-01, RT-01, RT-03, RT-04, CI-01} to Phase 42 (5 expected), all declared across the 4 plans and accounted for.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | — | No TODO/FIXME/PLACEHOLDER/stub in any new Phase-42 source/test file | ℹ️ Info | `runtime.ts` is signatures-only by design (correct Phase-42 scaffold, NOT a stub — Phase 43 implements bodies) |
| `.planning/STATE.md` | 22-27 | Stale "Phase 42: 1/4 plans complete / execution started" | ℹ️ Info | Known SDK miscount (MEMORY.md `project_gsd_phase_complete_state_miscount`); git history + all 4 SUMMARYs confirm all 4 plans executed/committed. Not a Phase-42 deliverable. |

### Human Verification Required

#### 1. CR-01 — D-09 introducing-commit resolution forward-fragility (orchestrator-surfaced)

**Test:** Decide the disposition of code-review BLOCKER CR-01 (`ci.yml:117` + `safe01-freeze-guard.spec.ts:63` use `git log -S 'spine-core-42' ... | tail -1`/`.pop()` to resolve the alias-introducing commit; lacks an explicit `--reverse | head -1` + a `grep -q spine-core-42 package.json` presence guard).

**Expected:** Either (a) apply `/gsd-code-review-fix` now to harden both call sites to the robust form, OR (b) accept it for Phase 42 as-shipped and carry CR-01 as an explicit Phase-44/45 entry-gate pre-req (those phases churn package.json, where the fragility becomes load-bearing).

**Why human:** The Phase-42 SAFE-01 goal is achieved AS DELIVERED TODAY — independently re-confirmed: the `spine-core-42` pickaxe set on package.json has exactly 1 entry, so `tail -1` returns the correct introducing commit `cc5783f`; baseline `1b5327d` is a machine-verified ancestor; the SAFE-01 ordering invariant is genuinely enforced. CR-01 is a forward-fragility advisory (it only misbehaves once a future phase removes-then-re-adds the literal), surfaced by the orchestrator for a developer scheduling/risk decision — not a falsifiable Phase-42 goal failure.

### Gaps Summary

**One partial gap against a ROADMAP success criterion (RT-01 SC #2):** the dual-install is correct and the distinctness is *functionally* true (verified: canonical 4.3.0 exports `Slider`/`BonePose`; `spine-core-42`=4.2.111 does not; both resolve), but the **ROADMAP-contracted automated runtime-distinctness test does not exist**. Git history shows the pre-replan `42-02-PLAN` explicitly scoped `tests/runtime/runtime-distinctness.spec.ts` with the exact must_have matching ROADMAP SC #2; the Option-1 re-plan (`c87a95f`) removed it as collateral scope reduction while `42-REPLAN-NOTE.md` only documents the (orthogonal) typecheck-scope narrowing. The ROADMAP plan-list line for 42-02 still reads "+ resolution/distinctness tests" and SC #2 still requires the assertion. This is a `partial`: the dual-runtime de-risking machinery is genuinely in place, but the regression lock that ROADMAP makes a non-negotiable acceptance criterion is absent. Closing it is a small, behavior-neutral, ancestry-irrelevant follow-up test (importing both specifiers, asserting `.version` difference + `Slider`/`BonePose` 4.3-only) that does not perturb any frozen commit.

**Everything else is genuinely verified.** The existential SAFE-01 ordering invariant (the milestone's load-bearing de-risking root) is machine-enforced and hard-passing; the 4-commit ordering A→B→repoint→C→D is intact and all ancestors of HEAD; the repoint is provably specifier-only with SAFE-01 byte-equality re-verified; the opaque-handle compile wall is proven real (not aspirational); `typecheck:node` is genuinely exit 0 on a fresh-clone-equivalent tree; the unified test gate (excluding the explicitly Phase-47-owned `tests/renderer/**`) is 954 passed / 0 failed; CI-01's ci.yml + D-13 smoke + Phase-44 guard + owner spec are all substantive and correct; `release.yml` is byte-untouched; the `typecheck:web` / `AnimationPlayerModal.tsx` 22-error leak is confirmed to trace *only* to spine-player's own bare `Player.d.ts` hoist and is correctly out of Phase-42 scope per the user-locked Option 1 (NOT flagged as a Phase-42 miss).

---

_Verified: 2026-05-16T21:20:00Z_
_Verifier: Claude (gsd-verifier)_
