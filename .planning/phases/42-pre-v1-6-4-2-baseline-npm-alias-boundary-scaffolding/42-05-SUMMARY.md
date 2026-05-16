---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
plan: 05
subsystem: test-infra / ci-gate
tags: [gap-closure, RT-01, SAFE-01, CR-01, dual-runtime, regression-lock]
requires:
  - "Frozen COMMIT B cc5783f (the dual spine-core install: @esotericsoftware/spine-core@4.3.0 + spine-core-42=@4.2.111)"
  - "Frozen COMMIT A 1b5327d (the SAFE-01 _manifest.json baseline) — ancestor of B"
provides:
  - "tests/runtime/runtime-distinctness.spec.ts — RT-01 / ROADMAP-Phase-42-SC-#2 automated regression lock (version distinctness + Slider/BonePose 4.3-only + dual-universe smoke)"
  - "CR-01-hardened D-09 SAFE-01 ancestry resolution in BOTH .github/workflows/ci.yml and tests/safe01/safe01-freeze-guard.spec.ts (explicit-oldest --reverse|head-1 + presence guard)"
affects:
  - ".github/workflows/ci.yml (D-09 step only)"
  - "tests/safe01/safe01-freeze-guard.spec.ts (first it(...) alias-resolution only)"
tech-stack:
  added: []
  patterns:
    - "Real-module (no vi.mock) dual-specifier co-import in tests/ — sanctioned (RT-03 backstop is src/**-scoped only); same idiom as tests/runtime/d13-43-load-smoke.spec.ts"
    - "Version read from RESOLVED package.json via createRequire (not a forgeable module export)"
    - "Explicit-oldest pickaxe resolution: git log --reverse -S <literal> ... | head-1 / [0] (NOT tail -1 / .pop()) + grep-presence guard"
key-files:
  created:
    - "tests/runtime/runtime-distinctness.spec.ts"
  modified:
    - ".github/workflows/ci.yml"
    - "tests/safe01/safe01-freeze-guard.spec.ts"
decisions:
  - "CR-01 user decision HARDEN NOW (2026-05-16): applied the forward-fragility fix immediately rather than deferring to Phase 44/45 where the package.json churn actually happens"
  - "Merged the pre-replan Task-3 alias-resolution + runtime-distinctness concerns into ONE consolidated spec file per 42-VERIFICATION.md missing: block"
  - "Did NOT assert `Pose` — live-confirmed `undefined` in 4.3.0; asserting it would false-fail. Asserted Slider/BonePose (ROADMAP-named) + Posed/SlotPose (stronger lock)"
metrics:
  duration: ~3 min
  completed: 2026-05-16
  tasks: 2
  files: 3
---

# Phase 42 Plan 05: Gap-Closure (RT-01 Distinctness Test + CR-01 D-09 Hardening) Summary

Restored the ROADMAP-Phase-42-SC-#2 runtime-distinctness automated regression lock (collaterally dropped by the Option-1 re-plan `c87a95f`) and hardened the D-09 SAFE-01 ancestry gate in both ci.yml and the vitest freeze-guard — two atomic, additive, behavior-neutral-today commits, neither perturbing any frozen Phase-42 commit.

## What Was Built

### Task 1 — `tests/runtime/runtime-distinctness.spec.ts` (commit `411b84f`)

A new real-module (no `vi.mock`) spec that imports BOTH `@esotericsoftware/spine-core` (4.3.0) AND `spine-core-42` (4.2.111) on purpose — the runtime-distinctness probe. Four `it(...)` blocks:

1. Both installs resolve under vitest (non-null module objects) — proving the dual-install is real, not just declared in package.json.
2. Version distinctness: `require('@esotericsoftware/spine-core/package.json').version` === `4.3.0`, `require('spine-core-42/package.json').version` === `4.2.111`, and `v43 !== v42` (the verbatim ROADMAP `adapter42.version !== adapter43.version` contract).
3. `Slider`/`BonePose` (ROADMAP-named) + `Posed`/`SlotPose` (supporting Pose-arch, stronger lock) exported from 4.3, ABSENT from `spine-core-42`. `Pose` deliberately NOT asserted (live-confirmed `undefined` in 4.3.0).
4. Dual-universe smoke (research Pitfall 4): `Skeleton` is a `function` in BOTH installs but NOT the same reference across them — proving two genuinely distinct module instances.

A one-time `console.log` emits the resolved versions and the contract-symbol `typeof` surface BEFORE the assertions, so a future upstream export rename fails loudly with a visible diff rather than as a mystery `toBeUndefined` failure.

**Live-confirmed export surface (logged by the spec at execution time):**
- `resolved versions: {"v43":"4.3.0","v42":"4.2.111"}`
- `sc43 contract-symbol surface: {"Slider":"function","BonePose":"function","Pose":"undefined","Posed":"function","SlotPose":"function","Skeleton":"function"}`
- `sc42 contract-symbol surface: {"Slider":"undefined","BonePose":"undefined","Pose":"undefined","Posed":"undefined","SlotPose":"undefined","Skeleton":"function"}`
- `Object.keys(sc43).length = 159 / Object.keys(sc42).length = 117`

This exactly matches the plan's pre-confirmed interface facts (including `Pose` resolving to `undefined` in 4.3.0 — correctly NOT asserted).

### Task 2 — CR-01 D-09 hardening (commit `65c99e1`)

Applied the identical forward-fragility fix to both files in one atomic commit:

- **`.github/workflows/ci.yml`** (D-09 step): added a two-line `grep -q "spine-core-42" package.json || { echo "::error::..."; exit 1; }` presence guard as the first run-block lines; replaced `ALIAS_COMMIT="$(git log -S 'spine-core-42' --format=%H -- package.json | tail -1)"` with the explicit-oldest `git log --reverse -S 'spine-core-42' --format=%H -- package.json | head -1` form + explanatory comment. The `BASE_COMMIT` line's `--diff-filter=A | tail -1` (chronologically meaningful), the `echo` provenance lines, the shallow-clone guard, and the `merge-base --is-ancestor` assertion are all preserved verbatim.
- **`tests/safe01/safe01-freeze-guard.spec.ts`** (first `it(...)`): added a CR-01 `readFileSync(package.json)` + `.includes('spine-core-42')` presence guard with a loud `throw new Error(...)` at the top of the test body (reusing the already-imported `readFileSync`/`path`/`REPO_ROOT` — no duplicate imports); replaced the alias resolution `sh(['log','-S','spine-core-42',...]).split('\n').filter(Boolean).pop()` with the `--reverse` + `[0]` form. The `baselineCommit` `--diff-filter=A` + `.pop()` resolution, the `if (!aliasCommit) return` skip-with-reason path, the `if (!baselineCommit) throw`, the `merge-base --is-ancestor` `expect().not.toThrow()`, and the entire `_meta.generatedCommit` cross-check are preserved verbatim. The second `it(...)` (no-regen meta-test) is untouched — it greps the sibling `safe01-baseline.spec.ts`, not this file, so the new `readFileSync(... 'package.json')` does not trip it.

## Behavior-Equivalence Proof (CR-01 — verified live this session)

| Resolution | Result | |
|---|---|---|
| `git log --reverse -S 'spine-core-42' --format=%H -- package.json \| head -1` | `cc5783ffc211214ff9255a643130bd09d81589e5` | new (hardened) form |
| `git log -S 'spine-core-42' --format=%H -- package.json \| tail -1` | `cc5783ffc211214ff9255a643130bd09d81589e5` | old (pre-CR-01) form |
| pickaxe set size (`git log -S 'spine-core-42' ... \| wc -l`) | `1` | single occurrence today |

Both forms resolve to the **identical** commit — the frozen COMMIT B `cc5783f`. The hardening is behavior-equivalent TODAY (pickaxe set size = 1, so `tail -1` happens to equal `--reverse | head -1`); it closes the forward-fragility (a future remove-then-re-add of the literal would make `tail -1`/`.pop()` resolve the wrong commit and silently void the SAFE-01 ordering gate). The SAFE-01 ordering invariant is unchanged, only made stronger.

## Verification Results

| Check | Result |
|---|---|
| `npx vitest run tests/runtime/runtime-distinctness.spec.ts` | 4/4 passed |
| `npx vitest run tests/arch.spec.ts` (LANDMINE PROOF — RT-03 `src/**` backstop did NOT trip on new `tests/` co-import) | 15/15 passed |
| `npx vitest run tests/safe01` | 23 passed / 1 skipped |
| `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | 2/2 passed; the A→B ancestry `it` **HARD-PASSED** (435ms — it ran the `merge-base --is-ancestor` child process, the non-vacuous path, NOT the ~0ms skip-with-reason path) |
| `npx vitest run tests/safe01 tests/arch.spec.ts` | 38 passed / 1 skipped |
| Final consolidated `runtime-distinctness + safe01 + arch.spec.ts` | 42 passed / 1 skipped |

## Frozen-Commit Integrity

- All 5 frozen-chain commits are ancestors of HEAD (no amend/rebase/reorder): A `1b5327d` → B `cc5783f` → repoint `1a8c18b` → C `b6f3177` → D `2360c51`.
- Both 42-05 commits are NEW additive descendants of HEAD (`bc0c6c6`, itself a descendant of frozen D `2360c51`).
- Task 1 commit `411b84f` touches ONLY `tests/runtime/runtime-distinctness.spec.ts` (153 insertions, 0 deletions).
- Task 2 commit `65c99e1` touches ONLY `.github/workflows/ci.yml` + `tests/safe01/safe01-freeze-guard.spec.ts` (28 insertions, 2 line-replacements; no file deletions).
- `package.json` / `package-lock.json` are byte-untouched by both 42-05 commits (confirmed: NOT in `git diff 2360c51 HEAD`'s commit-attributable file set — the `.planning/*` entries in that range belong to the prior frozen 42-05-planning docs commits, not to my two execution commits).
- `src/renderer/**` / `@esotericsoftware/spine-player` / `tsconfig.web.json` / `vitest.config.ts` untouched.

## Deviations from Plan

None — plan executed exactly as written. Both tasks were fully specified; the live-confirmed export surface and the CR-01 behavior-equivalence proof matched the plan's pre-confirmed interface facts verbatim. No deviation rules (1–4) triggered. No authentication gates. No checkpoints (fully autonomous plan).

## Self-Check: PASSED

- `tests/runtime/runtime-distinctness.spec.ts` — FOUND
- `.github/workflows/ci.yml` — FOUND (modified)
- `tests/safe01/safe01-freeze-guard.spec.ts` — FOUND (modified)
- Commit `411b84f` — FOUND in git log
- Commit `65c99e1` — FOUND in git log
