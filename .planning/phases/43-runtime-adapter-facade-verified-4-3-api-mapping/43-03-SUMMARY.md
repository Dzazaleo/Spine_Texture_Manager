---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
plan: 03
subsystem: core
tags: [spine-runtime-adapter, esm, vitest, safe-02, rt-02, pickRuntime, byte-equality]

# Dependency graph
requires:
  - phase: 43-02
    provides: "runtime-42.ts (verbatim 4.2.111 relocation: makeAtlas/parseSkeleton/applyRotatedRegionFix + StubTexture); pickRuntime body"
  - phase: 43-04
    provides: "runtime-43.ts (verified 4.3.0 Pose-API port); both adapters expose create(): SpineRuntime"
provides:
  - "spine-core-free loader.ts/sampler.ts/bounds.ts — the RT-02 arch anchor is GREEN"
  - "loader hard-picks pickRuntime('4.2') unconditionally (D-02); parse seam + Phase-33 patch relocated; LoadResult.runtime populated"
  - "SAFE-02 byte-equality proof: every git-tracked 4.2 fixture is strict-toEqual its FROZEN Phase-42 SAFE-01 baseline through the rewired adapter"
  - "Option A — pickRuntime resolves adapters in BOTH the production CJS worker (byte-identical lazy require, Plan 02) AND vitest ESM (test-only injected resolver via setupFile)"
  - "load43.ts no longer silently swallows a broken pickRuntime — the 4.3 verification path is now integrity-sound"
affects: [44-dispatch-version-routing, 45-loader-reject-repurpose, 47-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Environment-conditional adapter resolution: production lazy-require path is byte-identical to Plan 02 (resolver is null in production); a test-only injected resolver (vitest setupFile, never in the worker bundle) statically imports the REAL adapters under ESM"
    - "Verification-integrity discipline: a Wave-0 skip helper must distinguish a legit fixture-absent ENOENT (null) from a broken resolver (propagate loudly) — a swallowed resolver failure silently green-washes the whole dependent gate"

key-files:
  created:
    - tests/setup/esm-adapter-resolver.ts
  modified:
    - src/core/loader.ts
    - src/core/sampler.ts
    - src/core/bounds.ts
    - src/core/types.ts
    - src/core/runtime/runtime.ts
    - src/core/runtime/runtime-42.ts
    - src/core/runtime/runtime-43.ts
    - tests/arch.spec.ts
    - tests/core/bounds.spec.ts
    - tests/core/bounds-rotation-aabb.spec.ts
    - tests/runtime43/load43.ts
    - tests/runtime43/safe03-cross-runtime.spec.ts
    - vitest.config.ts

key-decisions:
  - "Option A: pickRuntime checks the injected ESM resolver FIRST; the discriminant is 'is a test resolver bound?' NOT 'typeof require' (vitest provides a require shim that cannot resolve ./runtime-42.js against its .ts transform graph)"
  - "The production worker bundle never imports the test setupFile, so __esmAdapterResolver is always null in production → the lazy-require branch is byte-identical to Plan 02 (ARCHITECTURE §4 lazy-single-copy untouched)"
  - "load43.ts: pickRuntime('4.3') failure propagates loudly (no catch); only a genuine fixture-ENOENT is a legit Wave-0 null (Plan 05 owns fixtures/SIMPLE_PROJECT_43/)"
  - "Task 2 required zero code changes — SAFE-02 was GREEN on the first run after Option A, proving the rewire is byte-faithful by construction (no byte-faithfulness fix needed → no Task-2 commit)"

patterns-established:
  - "Bundler-safe test seam: an exported __setEsmAdapterResolver setter + a setupFiles-registered binder that statically imports the real implementations — resolution-only, NOT a mock, so the gate exercises the real code path"

requirements-completed: [RT-02, SAFE-02, SAFE-03]

# Metrics
duration: ~32min
completed: 2026-05-17
---

# Phase 43 Plan 03: Runtime-Adapter Consumer Rewire + Option A ESM Seam Summary

**spine-core-free loader/sampler/bounds rewired through `load.runtime.*` (RT-02 GREEN), proven byte-identical to the FROZEN Phase-42 SAFE-01 baseline (SAFE-02 GREEN), with `pickRuntime` made dual-environment via a test-only injected ESM resolver that keeps the production worker's lazy-single-copy `require` path byte-identical to Plan 02.**

## Performance

- **Duration:** ~32 min
- **Started:** 2026-05-17T~13:30Z (continuation executor)
- **Completed:** 2026-05-17T~14:02Z
- **Tasks:** 2 (Task 1 finalized + committed; Task 2 = full-suite proof, no code change needed)
- **Files modified:** 14 (13 modified + 1 created)

## Accomplishments

- **RT-02 anchor GREEN:** `loader.ts`/`sampler.ts`/`bounds.ts` import zero spine-core packages — the offenders list is empty.
- **SAFE-02 GREEN (the HARD phase-exit gate):** every git-tracked 4.2 fixture's full canonicalized `SamplerOutput` is strict-`toEqual` to its FROZEN Phase-42 SAFE-01 baseline through the rewired adapter — 12/12, zero baseline regeneration (D-09 satisfied).
- **Option A delivered:** `pickRuntime` resolves adapters in BOTH environments. The production electron-vite CJS worker keeps the Plan-02 lazy-`require('./runtime-4x.js')` path **byte-identical** (lazy single-copy, ARCHITECTURE §4 untouched — `__esmAdapterResolver` is always null in production because the worker bundle never imports the setupFile). Under vitest ESM, a test-only resolver (`tests/setup/esm-adapter-resolver.ts`, registered via `setupFiles`) statically imports the **real** `runtime-42.ts`/`runtime-43.ts` and binds the resolver — resolution-only, NOT a mock, so SAFE-02 exercises the real 4.2.111 path. `loadSkeleton` stays synchronous. No silent null.
- **Verification-integrity gap closed:** `tests/runtime43/load43.ts` previously wrapped `require('.../runtime.js')` + `pickRuntime('4.3')` in a blanket `try/catch → return null`, which silently swallowed `require is not defined` and masked that `pickRuntime` was non-functional (all of 43-04's 4.3 seams were never actually exercised). Now `pickRuntime('4.3')` failure **propagates loudly**; only a genuine fixture-absent ENOENT is a legit Wave-0 null.
- **SAFE-03 actually RUNS and PASSES** (2/2 tests, not skipped) — and now genuinely exercises `pickRuntime('4.3')` resolving the real runtime-43 (`rt.tag === '4.3'`), gated only by the legit absence of the Plan-05 4.3 fixture.
- **Behavior-neutrality proven against base:** the 11 failing test files on this branch fail **identically on the base commit `32038eb`** (pre-rewire) — zero regressions introduced.

## Task Commits

1. **Task 1: Rewire core to `load.runtime.*` + Option A ESM seam** — `0ea26c5` (feat)
   - The full uncommitted rewire (prior executor) + Option A applied together as ONE atomic coherent unit (the prior executor never committed; the rewire alone could not run SAFE-02 without Option A).
2. **Task 2: Full-suite behavior-neutrality proof** — no commit (zero code changes needed; SAFE-02 GREEN on first run after Option A).

_No separate plan-metadata commit by this executor — STATE.md/ROADMAP.md are owned by the orchestrator (commit_rules)._

## Files Created/Modified

- `src/core/runtime/runtime.ts` — Option A `pickRuntime`: resolver-first, then byte-identical Plan-02 lazy `require`, then loud throw; added `__setEsmAdapterResolver` test-infra setter.
- `tests/setup/esm-adapter-resolver.ts` — **NEW.** Test-infra-only setupFile; statically imports the real runtime-42/runtime-43 and binds the ESM resolver (resolution-only, never in the worker bundle).
- `vitest.config.ts` — registered the setupFile via `setupFiles`.
- `tests/runtime43/load43.ts` — pickRuntime('4.3') failure now propagates; only fixture-ENOENT → null; static `pickRuntime` import (no `require`).
- `tests/runtime43/safe03-cross-runtime.spec.ts` — `brandHandle` switched from `require` to a static ESM import (vitest is `"type":"module"`).
- `src/core/loader.ts` — spine-core-free; `pickRuntime('4.2')` unconditional hard-pick; parse seam + Phase-33 patch delegated to `rt.*`; `LoadResult.runtime` populated; narrow structural views replace spine-core type reads.
- `src/core/sampler.ts` — spine-core import removed; ~12 leaf calls + snapshotFrame + fanOutSequencePeaks routed through `load.runtime.*`; LOCKED tick order + Pass-1.5 preserved verbatim.
- `src/core/bounds.ts` — spine-core import removed; instanceof-free (`rt.attachmentKind`); `(rt, sk, slot, a)` signature; `.region`/`.uvs` → `rt.attachmentRegionMeta`/`attachmentUVs`; bone scale → `rt.boneAxisScale`.
- `src/core/types.ts` — comment-only; `runtime?` kept optional.
- `src/core/runtime/runtime-42.ts` / `runtime-43.ts` — strictly-additive `attachmentName(a)` accessor.
- `tests/arch.spec.ts` — RT-02 anchor scoped to the 3 D-02 consumer files.
- `tests/core/bounds.spec.ts` / `bounds-rotation-aabb.spec.ts` — adapted to the `(rt,sk,slot,a)` signature; behavioral assertions byte-unchanged.

## Decisions Made

See `key-decisions` frontmatter. The pivotal one: the Option-A environment discriminant is **"is a test resolver bound?"** (resolver-first), NOT `typeof require`. Investigation showed vitest injects a `require` shim (`typeof require !== 'undefined'` is true) that nonetheless fails to resolve `./runtime-42.js` ("Cannot find module") against vitest's `.ts` transform graph. Gating on `require` would have left the worker path unchanged but never reached the resolver under vitest. Resolver-first preserves invariant (a) because `__esmAdapterResolver` is provably null in production (the worker bundle never imports the test setupFile), so the lazy-`require` branch runs byte-identically to Plan 02.

## Deviations from Plan

This was a continuation executor applying the user's chosen architectural resolution (Option A) on top of an already-complete uncommitted rewire. Option A itself is the sanctioned resolution of the escalated Rule-4 blocker (`pickRuntime` lazy-`require` incompatible with vitest ESM). Within Option A:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Option-A environment discriminant corrected from `typeof require` to resolver-presence**
- **Found during:** Task 1 (SAFE-02 still failing after the first Option-A draft)
- **Issue:** The initial Option-A `pickRuntime` gated on `typeof require !== 'undefined'`. Under vitest a `require` shim exists but cannot resolve `./runtime-42.js`, so the production branch threw "Cannot find module" and the ESM resolver branch was never reached → SAFE-02 still RED (`gitTracked.length === 0`, all fixtures swallowed into `excluded`).
- **Fix:** Reordered `pickRuntime` to check the injected `__esmAdapterResolver` FIRST (it is provably null in production, so the worker path stays byte-identical to Plan 02), then the lazy `require`, then a loud throw.
- **Files modified:** `src/core/runtime/runtime.ts`
- **Verification:** SAFE-02 → 12/12 GREEN; idempotent on re-run; `git status tests/safe01/baselines/` empty.
- **Committed in:** `0ea26c5` (Task 1 commit)

**2. [Rule 1 - Bug] `safe03-cross-runtime.spec.ts` latent ESM `require` landmine removed**
- **Found during:** Task 1 (Option A — making SAFE-03 robustly runnable per the user decision)
- **Issue:** `safe03` test 2 did `const { brandHandle } = require('../../src/core/runtime/types.js')` — dead in this worktree (fixture absent → short-circuits earlier) but a `ReferenceError` landmine the moment the 4.3 fixture lands (Plan 05), since the package is `"type":"module"`.
- **Fix:** Converted to a static ESM `import { brandHandle, handleRuntime }`.
- **Files modified:** `tests/runtime43/safe03-cross-runtime.spec.ts`
- **Verification:** SAFE-03 → 2/2 GREEN.
- **Committed in:** `0ea26c5` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug) — both inside the sanctioned Option-A scope.
**Impact on plan:** Both fixes are required for Option A to actually satisfy the SAFE-02 / SAFE-03 acceptance criteria. No scope creep — the loader/sampler/bounds rewire and the algorithm are byte-unchanged (SAFE-02 strict-`toEqual` proves it).

## Issues Encountered

- **Executor error during base-commit comparison (fully recovered):** While setting up the base-`32038eb` comparison, an exploratory `git checkout 32038eb -- .` reverted the working tree + index back to base content. Task 1's commit `0ea26c5` was never at risk (it is in git history). The working tree was surgically restored from HEAD (`git checkout HEAD -- <files>`), verified clean (`git status --short` empty, Option-A markers present, tsc clean). The base comparison was then redone correctly via an **isolated separate `git worktree`** (`/tmp/base-cmp-*`, removed after) which never touches this worktree. No work lost; final state verified against the Task-1 commit.

## Pre-existing Failures (out of scope — confirmed identical on base `32038eb`)

The full suite shows `11 failed test files | 109 passed | 1 skipped` and `1 failed | 1200 passed | 22 skipped | 2 todo` tests. **All 11 failing files fail identically on the pre-rewire base commit `32038eb`** (verified via an isolated worktree with the identical git-tracked fixture set):

- **8× `tests/renderer/*.spec.tsx`** — `SyntaxError: '@esotericsoftware/spine-core' does not provide an export named 'MixBlend'` from `src/renderer/src/modals/AnimationPlayerModal.tsx:46`. A pre-existing ESM named-export mismatch that predates Phase 43; renderer is out of 43-03 scope. (Files: app-elevation, app-quit-subscription, app-update-subscriptions, appshell-mode-switch-divergence, atlas-less-fallback-save-roundtrip, loader-mode-toggle-disabled, override-migration-banner, rig-info-tooltip, save-load — the modal import transitively breaks several.)
- **`tests/core/sampler-skin-defined-unbound-attachment.spec.ts`** — `SkeletonJsonNotFoundError` for `fixtures/SAMPLER_ALPHA_ZERO/...` (a gitignored heavy/proprietary rig, absent in any worktree checkout). Suite-level setup throws → all 7 tests skipped. Environmental, not a code regression.
- **`tests/main/sampler-worker-girl.spec.ts`** (the single "1 failed" test) — `fixtures/Girl/...` heavy rig absent in the worktree (gitignored). Environmental.

These are NOT regressions: the rewire is behavior-neutral. The D-04 heavy-rig SAFE-02 close-gate (running against the gitignored `fixtures/Girl|SKINS|CHJ|3Queens|Jokerman`) is **Plan 05's** hard close-gate, explicitly out of scope here (CI-subset green is necessary but not sufficient — D-04).

## Phase-43 Gate Results (this branch)

| Gate | Command | Result |
|------|---------|--------|
| RT-02 (3 consumers spine-core-free) | `grep -lE spine-core src/core/{sampler,bounds,loader}.ts` | EMPTY ✅ |
| RT-02 anchor | `vitest run tests/arch.spec.ts -t "Phase 43 RT-02"` | 2 passed ✅ |
| SAFE-02 (HARD exit gate) | `vitest run tests/safe01/safe01-baseline.spec.ts` | 12 passed ✅ (strict toEqual; idempotent) |
| SAFE-01 enumeration | `vitest run tests/safe01/safe01-enumeration.spec.ts` | passed ✅ (SIMPLE_PROJECT_43 still excluded) |
| SAFE-01 freeze-guard (D-09) | `vitest run tests/safe01/safe01-freeze-guard.spec.ts` | passed ✅ |
| D-09 baseline freeze | `git status --porcelain tests/safe01/baselines/` | EMPTY ✅ (zero regen) |
| SAFE-03 | `vitest run tests/runtime43/safe03-cross-runtime.spec.ts` | 2 passed ✅ (RAN, not skipped; real pickRuntime('4.3') exercised) |
| Loader reject-guards (D-02 untouched) | `vitest run tests/core/loader-version-guard*.spec.ts errors-version loader.spec ...` | 80 passed ✅ |
| tsc | `tsc --noEmit -p tsconfig.node.json` | 0 errors ✅ |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RT-02 is structurally locked GREEN; SAFE-02 is the regression sentinel for every later wave.
- `LoadResult.runtime` is populated and `load.runtime` is the single seam — **Phase 44** can now build version dispatch (DISP-01/03) on top of `pickRuntime` without touching the consumers.
- **Plan 05** must capture `fixtures/SIMPLE_PROJECT_43/` (4.3 fixture) — once present, `tryLoad43()` will resolve fully and SAFE-03's 4.3-skin-entry assertions will execute against the real 4.3 path (it already resolves the real runtime-43; only the fixture is gated). Plan 05 also owns the D-04 heavy-rig SAFE-02 close-gate.
- The `tests/setup/esm-adapter-resolver.ts` pattern is reusable for any future ESM-vs-CJS-worker resolution seam — it is test-infra-only and provably absent from the production worker bundle.

## Self-Check: PASSED

- `tests/setup/esm-adapter-resolver.ts` — FOUND
- `.planning/phases/43-runtime-adapter-facade-verified-4-3-api-mapping/43-03-SUMMARY.md` — FOUND
- Task 1 commit `0ea26c5` — FOUND in git history
- HEAD on `worktree-agent-a2115f23dbb9b43c1` (per-agent branch — assertion OK)

---

## Addendum (2026-05-17) — Issues Encountered: vi.resetModules() resolver-robustness fix

### The gap (a real regression, NOT pre-existing, NOT out of scope)

Option A as originally landed stored the test-only ESM resolver at **module
scope** in `src/core/runtime/runtime.ts` (`let __esmAdapterResolver`). The
vitest setupFile (`tests/setup/esm-adapter-resolver.ts`, `setupFiles`) binds it
**exactly once per file, before any test**, on the *original* `runtime.ts`
instance.

`tests/main/repack-worker.spec.ts` calls `vi.resetModules()` (≈ lines 376, 452).
`vi.resetModules()` clears vitest's module registry but the setupFile does NOT
re-run. The next `loadSkeleton` → `import('runtime.ts')` therefore yielded a
**fresh** `runtime.ts` instance whose module-scoped `__esmAdapterResolver` was
`null`. `pickRuntime` fell to branch (2) — the vitest-unresolvable
`require('./runtime-42.js')` — and threw `Error: Cannot find module
'./runtime-42.js'`. The failure surfaces only when the gitignored SKINS fixture
is present (so `describeIfSkins` = `describe`, the suite RUNS):
`tests/main/repack-worker.spec.ts > runRepack — UAT round 2: SKINS fixture
sanity (gitignored) > atlas region count ≈ unique-paths in JSON`.
SAFE-02 stayed green because its specs do not call `vi.resetModules()`, so the
original-instance binding survived there.

### The fix

Moved the resolver slot from **module scope** to **`globalThis`** (unique typed
key `__GSD_ESM_ADAPTER_RESOLVER__`, typed getter + idempotent setter).
`vi.resetModules()` never clears `globalThis`, so the setupFile's one-time
binding stays reachable by every post-reset fresh `runtime.ts` instance. This is
the **same Option A mechanism** — test-infra-ONLY, REAL adapters,
resolution-only (NOT a mock), synchronous loader — just hardened.

- `__setEsmAdapterResolver(fn)` public API **byte-stable** (signature
  unchanged; now writes to `globalThis`; idempotent — `delete`s slot on `null`).
- `pickRuntime` precedence **unchanged**: (1) globalThis resolver → (2) ambient
  `require('./runtime-4x.js')` — **byte-identical to Plan 02** → (3) loud throw.
- No static adapter import added; `pickRuntime` stays sync; `loadSkeleton`
  untouched.
- Two files only: `src/core/runtime/runtime.ts` + `tests/setup/esm-adapter-resolver.ts`
  (comment-only on the setupFile — its `__setEsmAdapterResolver(...)` call is
  unchanged). No consumer/test-logic edits.

### Before / after of the repack-worker SKINS test (A/B, full spec file)

| Code state | `tests/main/repack-worker.spec.ts` (full file) |
|---|---|
| Pristine pre-fix base `93b4fe3` | **1 failed | 20 passed** — SKINS-sanity test `Error: Cannot find module './runtime-42.js'` |
| With fix | **21 passed (21)** — SKINS-sanity test RUNS (✓ ≈4.3s) and PASSES |

(Verified by stashing the fix and re-running the full spec file — the regression
reproduces deterministically pre-fix and is gone post-fix.)

### Full-suite counts (A/B on identical worktree, SKINS fixture symlinked in for verification only — never staged)

| Code state | Tests | Test Files |
|---|---|---|
| Pristine pre-fix `93b4fe3` | **2 failed | 1201 passed** | 12 failed | 108 passed |
| With fix | **1 failed | 1202 passed** | 11 failed | 109 passed |

Net delta of the fix: **−1 failure** (the regression), **+1 pass**, **zero new
failures**.

Enumeration of the 11 remaining failed files WITH the fix (each proven
NOT-our-regression by failing identically on the pristine pre-fix base):

- **9 known pre-existing renderer files** (ESM `MixBlend` named-export mismatch
  in `AnimationPlayerModal.tsx`, predates Phase 43, out of scope):
  `app-elevation`, `app-quit-subscription`, `app-update-subscriptions`,
  `appshell-mode-switch-divergence`, `atlas-less-fallback-save-roundtrip`,
  `loader-mode-toggle-disabled`, `override-migration-banner`,
  `rig-info-tooltip`, `save-load` (`tests/renderer/*.spec.tsx`).
- **2 worktree-environment artifacts** (missing **gitignored** licensed
  fixtures absent from a fresh worktree; `SkeletonJsonNotFoundError`, NOT the
  resolver error; fail identically on the pristine base → pre-existing, out of
  scope per the scope boundary):
  `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`
  (`fixtures/SAMPLER_ALPHA_ZERO/`) and
  `tests/main/sampler-worker-girl.spec.ts` (`fixtures/Girl/`).

(The verification spec's "9 renderer-only" expectation assumed those two
gitignored fixtures present, as in the main checkout; in a fresh worktree they
are absent — an environmental difference, fully accounted for by the A/B diff
showing zero delta on those two files.)

### Hard gates re-confirmed AFTER the fix

- **SAFE-02 stayed 12/12 byte-equal** vs the committed canonical baselines
  (Chicken-Min, EXPORT_PROJECT, INHERIT_TIMELINE, SIMPLE_PROJECT_NO_ATLAS_MESH,
  SIMPLE_PROJECT_NO_ATLAS, SIMPLE_TEST_GHOST, SIMPLE_TEST, skeleton, skeleton2,
  spine_rotated, spine_stripWS + discovery). No tolerance relaxed.
- **D-09**: `git status --porcelain tests/safe01/baselines/` EMPTY — **zero
  baseline regeneration**. `tests/safe01/baselines/` untouched.
- **RT-02 GREEN** (runtime43-baseline, runtime43-d03); **SAFE-03 runs+passes**
  (real `pickRuntime('4.3')`); **freeze-guard GREEN**;
  `tsc --noEmit -p tsconfig.node.json` — 0 errors.
- **Production worker path unchanged**: the worker never imports the setupFile,
  so the `globalThis` slot is `undefined` in production → branch (2) lazy
  single-copy `require` runs byte-identically to Plan 02 (ARCHITECTURE §4
  preserved). Not async; no static adapter import.

### Self-Check (addendum): PASSED

- `src/core/runtime/runtime.ts` (globalThis-scoped resolver) — FOUND
- `tests/setup/esm-adapter-resolver.ts` (globalThis-aware comment) — FOUND
- Fix commit `e43f206` — FOUND in git history
- HEAD on `worktree-agent-ad30e3233c1dc0871` (per-agent branch — assertion OK)

---
*Phase: 43-runtime-adapter-facade-verified-4-3-api-mapping*
*Completed: 2026-05-17 (addendum: vi.resetModules resolver-robustness fix, 2026-05-17)*
