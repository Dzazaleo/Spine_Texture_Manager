---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
verified: 2026-05-16T23:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5 (1 partial)
  gaps_closed:
    - "RT-01 / ROADMAP-SC-#2: the runtime-distinctness automated regression test (tests/runtime/runtime-distinctness.spec.ts) was collaterally descoped by the Option-1 re-plan — RESTORED by 42-05 commit 411b84f, 4/4 green, asserts adapter42.version (4.2.111) !== adapter43.version (4.3.0) + Slider/BonePose 4.3-only + dual-universe Skeleton non-identity smoke"
    - "CR-01 (human-decision item, user-decided HARDEN NOW 2026-05-16): the D-09 SAFE-01 ancestry resolution forward-fragility — HARDENED by 42-05 commit 65c99e1 in BOTH .github/workflows/ci.yml (--reverse|head-1 + grep presence guard) and tests/safe01/safe01-freeze-guard.spec.ts (--reverse + [0] + readFileSync presence guard); behavior-equivalent today (resolved alias commit STILL cc5783f; pickaxe set size = 1)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "tests/renderer/*.spec.tsx (11 suites) import the removed 4.3 export MixBlend and fail with SyntaxError"
    addressed_in: "Phase 47"
    evidence: "ROADMAP Phase 47 = 'spine-player 4.3.0 Bump + Viewer Regression — Decoupled, revertible viewer bump; drop removed MixBlend/MixDirection; ... migrated to the new apply(fromSetup, add, out, appliedPose) model (PLAYER-01)'. Phase 42 is boundary-scaffolding and DELIBERATELY does not port the renderer (its arch anchors gate src/** only). The 11 failures are byte-identical at the pre-42-05 base bc0c6c6 — a pre-existing, intended, Phase-47-owned milestone state, not a Phase-42 regression or goal failure."
---

# Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding — Verification Report (Re-Verification)

**Phase Goal:** De-risk the entire v1.6 milestone by freezing the existing 4.2 behavior as a committed byte-equal golden BEFORE any code changes, then landing the lockfile-pinned dual-install and the opaque-handle boundary scaffolding that gates every downstream phase.

**Verified:** 2026-05-16T23:00:00Z
**Status:** passed
**Re-verification:** Yes — after gap closure (plan 42-05; commits 411b84f test + 65c99e1 fix + c7a20bd docs; merged at 851e6fa)

## Re-Verification Summary

The prior 42-VERIFICATION.md was `gaps_found` (score 4/5): one PARTIAL gap on ROADMAP Phase-42 Success Criterion #2 (RT-01 — the contracted runtime-distinctness automated regression test was collaterally descoped by the Option-1 re-plan `c87a95f`) plus one human-decision item (CR-01 — D-09 ancestry-resolution forward-fragility, resolved with the user: HARDEN NOW, 2026-05-16). Gap-closure plan 42-05 landed both as two atomic additive descendants of the frozen D `2360c51`. **Both gaps are now CLOSED. No regression. The four previously-VERIFIED criteria pass a quick regression re-check. Score: 5/5.**

The 11 failing `tests/renderer/*.spec.tsx` suites (`SyntaxError: ... does not provide an export named 'MixBlend'`) are confirmed PRE-EXISTING (byte-identical at the pre-42-05 base) and an explicitly ROADMAP-tracked **Phase-47-owned** milestone state — filtered to `deferred` per Step 9b. They are NOT a Phase-42 goal failure (Phase 42 deliberately does not port the renderer; its arch anchors gate `src/**` only).

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria — the non-negotiable contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (SAFE-01) | A deterministic byte-equal golden snapshot of SamplerOutput for every in-repo 4.2 fixture is committed in a commit that **predates** the npm-alias commit (order is the acceptance test) | ✓ VERIFIED | COMMIT A `1b5327d` is machine-verified `git merge-base --is-ancestor` of alias COMMIT B `cc5783f`. Full frozen chain A `1b5327d` → B `cc5783f` → repoint `1a8c18b` → C `b6f3177` → D `2360c51` all ancestors of HEAD, original SHAs intact (not amended/rebased). `tests/safe01` suite 38 passed / 0 failed (with arch.spec.ts). `safe01-freeze-guard.spec.ts` A→B ancestry `it` **HARD-PASSES at 421ms** (ran the `merge-base --is-ancestor` child process — the non-vacuous path, NOT the ~0ms skip-with-reason path). |
| 2 (RT-01) | From a fresh clone, 4.3.0 (canonical) + 4.2.111 (alias) both resolve identically; **a runtime-distinctness test asserts adapter42.version !== adapter43.version and Slider/BonePose exist only in the 4.3 module** | ✓ VERIFIED (gap closed) | **`tests/runtime/runtime-distinctness.spec.ts` now EXISTS (commit `411b84f`, 153 lines) and passes 4/4.** Live diagnostic confirms: `{"v43":"4.3.0","v42":"4.2.111"}`; sc43 `Slider`/`BonePose`/`Posed`/`SlotPose` = `function`, sc42 all `undefined`; `Skeleton` = `function` in BOTH but non-identical reference (Pitfall-4 dual-universe smoke). Asserts the verbatim `v43 !== v42` ROADMAP `!==` contract + exact pins (`4.3.0`/`4.2.111`) + Slider/BonePose 4.3-only-and-absent-from-spine-core-42, reading `.version` from the non-forgeable resolved package.json. `tests/arch.spec.ts` still 15/15 green (the new `tests/` both-specifier co-import did NOT trip the `src/**`-scoped RT-03 backstop). |
| 3 (RT-03) | A 4.2-object-at-a-4.3-boundary is a **compile-time** error: opaque branded handles carry a required runtime tag; no source file imports both alias specifiers (arch-enforced) | ✓ VERIFIED (regression re-check) | Unchanged by 42-05 (frozen COMMIT C `b6f3177`). `tests/arch.spec.ts:313` "Phase 42 RT-03 backstop: no source file imports BOTH spine-core alias specifiers" present + green in the 38-pass run. The new `tests/runtime/runtime-distinctness.spec.ts` is the sanctioned `tests/` co-import idiom (RT-03 backstop globs `src/**` ONLY) — proven by arch.spec.ts staying green after it landed. |
| 4 (RT-04) | The new core/runtime/ module imports no DOM, Electron, or sharp; Layer-3 purity green under tests/arch.spec.ts | ✓ VERIFIED (regression re-check) | Unchanged by 42-05 (frozen COMMIT C `b6f3177`). `tests/arch.spec.ts:297` "Phase 42 RT-04: src/core/runtime/ is Layer-3 pure" present, `globSync('src/core/runtime/**/*.ts')`, green in the 38-pass arch+safe01 run. |
| 5 (CI-01) | CI runs fresh-clone vs 4.2.x+4.3.x slots, alias resolves under npm ci, both spine-core copies packaged, PR-only bundle-smoke runs the built worker (not src/) vs a 4.2+4.3 fixture | ✓ VERIFIED (re-checked + CR-01-hardened) | `.github/workflows/ci.yml` (229 lines): 5×`fetch-depth: 0`, 2×`merge-base --is-ancestor`, 3-OS matrix (ubuntu/windows/macos), `bundle-smoke` job asserting BOTH `node_modules/@esotericsoftware/spine-core` + `node_modules/spine-core-42` survive packaging. **CR-01-hardened D-09 step**: `grep -q "spine-core-42" package.json` presence guard (line 116-117) + explicit-oldest `git log --reverse -S 'spine-core-42' ... | head -1` (line 121); the old fragile `tail -1` form is GONE. `release.yml` byte-untouched across all of Phase 42. |

**Score:** 5/5 ROADMAP success criteria fully verified (was 4/5 with 1 partial; the RT-01 SC#2 partial is now CLOSED).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | 11 `tests/renderer/*.spec.tsx` suites fail with `SyntaxError: '@esotericsoftware/spine-core' does not provide an export named 'MixBlend'` | Phase 47 | ROADMAP Phase 47 = "spine-player 4.3.0 Bump + Viewer Regression — drop removed MixBlend/MixDirection; migrated to the new apply(fromSetup, add, out, appliedPose) model (PLAYER-01)". Pre-existing & byte-identical at the pre-42-05 base; caused by the FROZEN 42-02 4.3 repoint. Phase 42 is boundary-scaffolding and DELIBERATELY does not port the renderer (arch anchors gate src/** only). Intended, planned, Phase-47-owned — not a Phase-42 regression. |

### Required Artifacts (gap-closure delta + key prior anchors regression-checked)

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `tests/runtime/runtime-distinctness.spec.ts` | RT-01 / ROADMAP-SC-#2 automated regression lock (NEW — the closed gap) | ✓ VERIFIED | 153 lines (commit `411b84f`); imports BOTH `@esotericsoftware/spine-core` (4.3.0) + `spine-core-42` (4.2.111) on purpose; 4 focused `it` blocks; version from resolved package.json via `createRequire`; pre-assertion diagnostic `console.log`; 4/4 green |
| `.github/workflows/ci.yml` | CR-01-hardened D-09 step | ✓ VERIFIED | 229 lines; `grep -q "spine-core-42" package.json` presence guard + `git log --reverse -S 'spine-core-42' ... \| head -1` (line 121); old `tail -1` form GONE; 3-OS matrix + bundle-smoke + 5×fetch-depth:0 all intact |
| `tests/safe01/safe01-freeze-guard.spec.ts` | CR-01-hardened vitest D-09 enforcement | ✓ VERIFIED | `readFileSync(package.json)` + `.includes('spine-core-42')` loud-throw presence guard (lines 41-51); alias resolution now `--reverse` + `[0]` (lines 76-85); A→B ancestry `it` hard-passes 421ms; skip-with-reason / `_meta` cross-check preserved |
| `tests/safe01/baselines/_manifest.json` + 11 baselines | Committed golden (frozen COMMIT A) | ✓ VERIFIED (regression) | SAFE-01 byte-equal suite green; A `1b5327d` ancestor of B `cc5783f` machine-verified |
| `package.json` / `package-lock.json` | 4.3.0 canonical + spine-core-42 alias (frozen COMMIT B) | ✓ VERIFIED (regression) | Byte-untouched in `2360c51..HEAD` (frozen COMMIT B `cc5783f` anchor not perturbed by 42-05) |
| `src/core/runtime/types.ts` + `runtime.ts` | Branded handles + signatures (frozen COMMIT C) | ✓ VERIFIED (regression) | Unchanged by 42-05; RT-03 + RT-04 arch anchors green in 38-pass run |
| `tests/runtime/d13-43-load-smoke.spec.ts` | 4.3 SkeletonJson direct-load (frozen COMMIT D) | ✓ VERIFIED (regression) | Passes in the consolidated 43-pass run; the established `tests/` co-import idiom precedent |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| COMMIT A `1b5327d` | COMMIT B `cc5783f` | `git merge-base --is-ancestor` | ✓ WIRED | TRUE — baseline predates alias (the existential SAFE-01 invariant); unchanged by 42-05 |
| Full chain A→B→repoint `1a8c18b`→C `b6f3177`→D `2360c51` | HEAD | first-parent ancestry | ✓ WIRED | All 5 frozen commits ancestors of HEAD, original SHAs intact (not amended); 42-05 commits `411b84f`/`65c99e1` are NEW additive descendants of D |
| `tests/runtime/runtime-distinctness.spec.ts` | ROADMAP Phase-42 SC #2 (RT-01) | automated vitest assertions on resolved package.json `.version` + `Object.keys` export presence/absence across both installs | ✓ WIRED | `v43 !== v42` + exact pins + Slider/BonePose 4.3-only asserted and passing — the contract is now regression-locked |
| `ci.yml` D-09 + `safe01-freeze-guard.spec.ts` (CR-01-hardened) | SAFE-01 baseline-predates-alias ordering invariant | `git log --reverse -S 'spine-core-42' ... \| head -1`/`[0]` + literal-presence guard, then `git merge-base --is-ancestor` | ✓ WIRED | Forward-fragility CLOSED; behavior-equivalent today (resolved alias commit STILL `cc5783f`; `tail-1` == `--reverse\|head-1` == `cc5783f`; pickaxe set size = 1) |
| `safe01-freeze-guard.spec.ts` baseline operand | `--diff-filter=A` manifest add | `.split('\n').filter(Boolean).pop()` (UNCHANGED — CR-01 scoped to the `-S` alias pickaxe only) | ⚠️ WIRED (advisory) | Functions correctly today; review WR-01/WR-02 flag the baseline-side `.pop()` as asymmetrically un-hardened + a now-stale comment at line 53. Advisory follow-up — does NOT break any SC (the SAFE-01 acceptance test is the A→B git-ancestry ordering, which hard-passes) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `runtime-distinctness.spec.ts` | `v43`/`v42`, `sc43Rec`/`sc42Rec` exports | live `createRequire` resolution of `@esotericsoftware/spine-core/package.json` (4.3.0) + `spine-core-42/package.json` (4.2.111) + real module namespaces | ✓ Yes — diagnostic log emits `{"v43":"4.3.0","v42":"4.2.111"}` + real `Object.keys` counts (159 / 117); not hardcoded, not empty | ✓ FLOWING |
| `safe01-freeze-guard.spec.ts` | `aliasCommit`, `baselineCommit` | live `git log` child processes over real repo history + real `readFileSync(package.json)` | ✓ Yes — `aliasCommit` resolves to real `cc5783f`; A→B `merge-base` assertion executes (421ms, non-vacuous) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| RT-01 distinctness regression lock (the closed gap) | `CI=true npx vitest run tests/runtime/runtime-distinctness.spec.ts` | 4/4 passed; diagnostic confirms v43=4.3.0, v42=4.2.111, Slider/BonePose 4.3-only, Skeleton non-identical | ✓ PASS |
| SAFE-01 freeze-guard A→B HARD-pass (non-vacuous) | `CI=true npx vitest run tests/safe01/safe01-freeze-guard.spec.ts --reporter=verbose` | 2/2 passed; A→B ancestry `it` ran at **421ms** (the `merge-base --is-ancestor` child-process path, NOT the ~0ms skip path) | ✓ PASS |
| SAFE-01 suite + arch anchors (RT-03/RT-04) | `CI=true npx vitest run tests/safe01 tests/arch.spec.ts` | 38 passed / 0 failed / 21 skipped | ✓ PASS |
| Landmine proof: new `tests/` co-import did NOT trip `src/**` RT-03 backstop | `CI=true npx vitest run tests/arch.spec.ts` | 15/15 passed | ✓ PASS |
| Consolidated gap-closure + core regression | `CI=true npx vitest run runtime-distinctness + safe01 + arch.spec.ts + d13-43-load-smoke` | 43 passed / 0 failed / 1 skipped (Phase-44 guard skip-with-reason — by design) | ✓ PASS |
| CR-01 behavior-equivalence (resolved alias commit unchanged) | `git log -S / --reverse -S 'spine-core-42' -- package.json` | both forms == `cc5783f`; pickaxe set size = 1 | ✓ PASS |
| Pre-existing renderer state is Phase-47-owned (NOT a Phase-42 regression) | `CI=true npx vitest run tests/renderer` | 11 failed (MixBlend SyntaxError) — ROADMAP Phase 47 explicitly owns the MixBlend/MixDirection drop; deferred | ? DEFERRED (Phase 47) |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| SAFE-01 | 42-01, 42-02, 42-05 | Byte-equal golden committed before the npm alias (order is load-bearing) | ✓ SATISFIED | A→B ancestry machine-verified; freeze-guard hard-passes; CR-01 hardening makes the gate strictly stronger (forward-fragility closed) |
| RT-01 | 42-02, 42-05 | 4.3.0 canonical + 4.2.111 exact-pinned alias; both resolve; **distinctness test** | ✓ SATISFIED (was PARTIAL) | Dual-install + resolution VERIFIED; the ROADMAP-required distinctness *test* now EXISTS and passes 4/4 (`runtime-distinctness.spec.ts`, commit `411b84f`) — the SC#2 regression lock is restored |
| RT-03 | 42-03 | Cross-runtime mix is a compile-time error; no co-mingled imports | ✓ SATISFIED | unique-symbol brand wall + RT-03 backstop arch anchor green; unchanged by 42-05 (regression-checked) |
| RT-04 | 42-03 | core/runtime/ Layer-3 pure, arch-enforced | ✓ SATISFIED | RT-04 arch anchor green; unchanged by 42-05 (regression-checked) |
| CI-01 | 42-04 | CI fresh-clone dual-runtime gate + bundle-smoke + packaging | ✓ SATISFIED | ci.yml verified (229 lines, 3-OS, bundle-smoke, fetch-depth:0); CR-01-hardened D-09 step; release.yml byte-untouched |

No orphaned requirements — REQUIREMENTS.md maps exactly {SAFE-01, RT-01, RT-03, RT-04, CI-01} to Phase 42 (5 expected); all declared across plans 42-01..42-05 and accounted for. RT-01 + SAFE-01 additionally declared in the 42-05 gap-closure plan frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/safe01/safe01-freeze-guard.spec.ts` | 53 | Stale comment "OLDEST add (tail/.pop()) ... robust against a later delete+re-add" contradicts the now-hardened alias block (review WR-02/IN-03) | ⚠️ Warning (advisory) | The baseline operand still uses `.pop()` (CR-01 was scoped to the `-S` alias pickaxe ONLY — correct per plan). Functions correctly today (`git log` default newest-first → `.pop()` is oldest). NOT an SC failure: the SAFE-01 acceptance test is the A→B git-ancestry ordering, which hard-passes. Advisory follow-up only. |
| `.github/workflows/ci.yml` | ~118 | Baseline `BASE_COMMIT` uses `--diff-filter=A \| tail -1` while alias side was hardened (review WR-01) | ⚠️ Warning (advisory) | Asymmetric robustness — same advisory class as WR-02. Plan explicitly scoped CR-01 to the alias `-S` pickaxe; the `--diff-filter=A` baseline is chronologically meaningful today. Advisory follow-up; does not break SAFE-01. |
| `tests/runtime/runtime-distinctness.spec.ts` | 81-101 | Top-level `console.log` runs on every suite run (review IN-02) | ℹ️ Info | Deliberate, eslint-suppressed forward-fragility aid (surfaces a future upstream export rename as a visible diff). Defensible as-is; optional reporter-hygiene relocation. No correctness impact. |

The two Warnings are the 42-REVIEW.md advisory findings (0 blockers / 2 warnings / 3 info). They are forward-robustness/consistency follow-ups on the SAFE-01 ordering gate's *baseline* operand — they do NOT break any ROADMAP Success Criterion (the SC#1 acceptance test is the A→B ordering, machine-verified and hard-passing; CR-01's user-decided scope was the alias pickaxe, which is correctly hardened). Recommended as a low-priority follow-up (logical home: the Phase 44/45 entry-gate, where package.json churn makes the baseline-side fragility load-bearing — same rationale as the original CR-01 deferral option).

### Human Verification Required

None. The sole prior human-decision item (CR-01) was resolved with the user on 2026-05-16 (decision: HARDEN NOW) and is now machine-verified closed in both `ci.yml` and `safe01-freeze-guard.spec.ts`. All five ROADMAP success criteria are programmatically verifiable (git ancestry, automated test pass/fail, ci.yml structure) and verified green. No visual/real-time/external-service surface in this phase.

### Gaps Summary

**No gaps.** The single prior PARTIAL (RT-01 / ROADMAP-SC-#2 runtime-distinctness automated regression test, collaterally descoped by the Option-1 re-plan) is CLOSED: `tests/runtime/runtime-distinctness.spec.ts` (commit `411b84f`, 153 lines) now exists and passes 4/4, asserting the verbatim ROADMAP `adapter42.version !== adapter43.version` contract (`4.3.0` ≠ `4.2.111`, read from non-forgeable resolved package.json), `Slider`/`BonePose` exported from 4.3 and absent from `spine-core-42`, plus a dual-universe `Skeleton`-non-identity smoke. The prior human-decision item (CR-01 forward-fragility, user-decided HARDEN NOW) is CLOSED: both `.github/workflows/ci.yml` and `tests/safe01/safe01-freeze-guard.spec.ts` now resolve the alias-introducing commit via explicit-oldest `--reverse|head-1`/`[0]` + a literal-presence guard; behavior-equivalent today (resolved alias commit STILL `cc5783f`; pickaxe set size = 1) — a strict strengthening of the SAFE-01 data-integrity gate, not a behavior change.

**No regression.** The four previously-VERIFIED criteria (SAFE-01 ordering, RT-03 brand wall, RT-04 purity, CI-01 ci.yml) pass a quick regression re-check; the frozen A→B→repoint→C→D chain is intact at original SHAs (not amended/rebased); both 42-05 commits are new additive descendants of D `2360c51` touching ONLY their target files (`411b84f`: the new spec only; `65c99e1`: ci.yml + freeze-guard only); `package.json`/`package-lock.json`/`src/renderer/**`/`tsconfig.web.json`/`vitest.config.ts` byte-untouched; `release.yml` byte-untouched across all of Phase 42; the freeze-guard A→B ancestry assertion hard-passes the non-vacuous path (421ms).

**Deferred (not a gap):** 11 `tests/renderer/*.spec.tsx` suites fail with the `MixBlend` SyntaxError — pre-existing, byte-identical at the pre-42-05 base, caused by the FROZEN 42-02 4.3 repoint, and EXPLICITLY ROADMAP-tracked as Phase-47-owned (`drop removed MixBlend/MixDirection`). Phase 42 is boundary-scaffolding and deliberately does not port the renderer (arch anchors gate `src/**` only). This is an intended, planned, Phase-47-owned milestone state — correctly filtered to `deferred`, does NOT affect Phase-42 goal achievement.

**Two advisory Warnings** (from 42-REVIEW.md, 0 blockers): the SAFE-01 freeze-guard/ci.yml *baseline* operand retains `.pop()`/`tail -1` (asymmetric to the now-hardened alias side) plus a stale contradictory comment at `safe01-freeze-guard.spec.ts:53`. These are forward-robustness follow-ups on an operand that functions correctly today; CR-01's user-decided scope was the alias pickaxe (correctly hardened). They do NOT break any ROADMAP Success Criterion. Recommended as a low-priority Phase-44/45 entry-gate follow-up (where package.json churn makes the baseline-side fragility load-bearing).

**Phase 42 goal is achieved.** The v1.6 milestone is de-risked: the byte-equal 4.2 baseline is committed and machine-proven to predate the npm-alias commit; the lockfile-pinned dual-install is real and now regression-locked by an automated distinctness test; the opaque-handle boundary scaffolding (RT-03 brand wall + RT-04 purity) is arch-enforced and green; the CI dual-runtime gate is in place with the SAFE-01 ordering invariant hardened against forward-fragility. Ready to proceed to Phase 43.

---

_Verified: 2026-05-16T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification after gap closure (plan 42-05) — previous: gaps_found 4/5 → now: passed 5/5_
