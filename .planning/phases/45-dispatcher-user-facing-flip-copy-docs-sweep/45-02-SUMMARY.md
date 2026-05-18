---
phase: 45-dispatcher-user-facing-flip-copy-docs-sweep
plan: 02
subsystem: testing
tags: [vitest, dual-runtime, spine-4.3, dispatch, false-green-guard, audit]

# Dependency graph
requires:
  - phase: 44-loader-dispatch-equivalence-oracle-4-3-fixture-authoring
    provides: "loader.ts resolveRuntimeTag dispatch flip + D-11 behavioral test inversion + in-repo 4.3 fixtures (SIMPLE_PROJECT_43/SLIDER_4_3/XTRA01_4_3/XTRA02_4_3) + D-10 correct-by-construction errors.ts strings + D-04 SAFE-01 denylist"
provides:
  - "UX-02 test-assertion half: the documented per-file D-11 disposition audit (all 10 Phase-44-D-11 files, verify-only, zero false-greens found)"
  - "D-12 permanent in-suite vitest standing guard (tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts) — every in-repo 4.3 fixture routes to runtime-43 and never throws SpineVersionUnsupportedError; rides every-CI npm run test"
affects: [phase-45-plan-01, phase-46, phase-47, milestone-v1.6-close]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Permanent in-suite anti-false-green standing sentinel (rides npm run test, not a CI grep / one-time check)"
    - "Documented per-file disposition audit as the deliverable (re-audit + prove, not blanket rewrite)"

key-files:
  created:
    - "tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts"
  modified: []

key-decisions:
  - "D-11 audit confirmed Phase-44 already correctly inverted all 10 files; zero false-greens survived → zero edits (the expected verify-only outcome)"
  - "D-12 guard placed in tests/runtime/ (idiomatic home; siblings d13-43-load-smoke / runtime-distinctness / runtime-43-mesh-uv-pagespace) with the locked dispatch-target triplet"

patterns-established:
  - "Standing-and-in-vitest anti-false-green guard: not-instanceof-reject + not.toThrow + handleRuntime(...).toBe('4.3') dispatch-target proof"

requirements-completed: [UX-02]

# Metrics
duration: 18min
completed: 2026-05-18
---

# Phase 45 Plan 02: Dispatcher Test-Assertion Finalization Summary

**Re-audited all 10 Phase-44-D-11 reject-assertion test files (zero surviving 4.3-reject false-greens; all `<4.2`/`≥4.4` typed-throws preserved verbatim) and added a permanent in-suite vitest standing guard asserting every in-repo 4.3 fixture routes to runtime-43 and never throws `SpineVersionUnsupportedError`.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-18T13:57Z
- **Completed:** 2026-05-18T14:01Z
- **Tasks:** 2 (Task 1 = verify-only audit, no code change; Task 2 = 1 net-new spec)
- **Files modified:** 1 created, 0 source files touched

## Accomplishments

- **D-11 per-file disposition audit (the D-10/D-11 deliverable):** every one of the 10 Phase-44-D-11 files read and classified; the false-green detection grep + the PRESERVE-THROW grep prove no 4.3 input green-asserts the OLD reject and every `<4.2`/`≥4.4` typed-throw survives verbatim. Expected outcome held — **zero edits**.
- **D-12 permanent standing guard:** net-new `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` asserts all 4 CONTEXT-named in-repo 4.3 fixtures route (dispatch-target triplet) and never reject. Rides every-CI `npm run test`.
- **Zero scope leak:** `src/core/*` (loader/runtime/errors/dispatch) is byte-untouched across the whole plan (`git diff --quiet src/core/` exits 0).

## D-11 per-file disposition

> **Audit method:** each file was read in full (or the assertion regions); the PATTERNS.md expected verdict was used as a cross-check, not blindly trusted. Step-2 false-green greps were run across all 10 files and every hit inspected in context.

| # | File | Verdict | Evidence | Edited? |
|---|------|---------|----------|---------|
| 1 | `tests/core/loader-43-schema-guard-predicate.spec.ts` | ALREADY-CORRECT + PRESERVE-THROW | `resolveRuntimeTag('4.3.01', {spine:'4.3.01'},bones:[]).toBe('4.3')` (L129–133) + `resolveRuntimeTag('4.3.01', canonical43).toBe('4.3')` (L140) prove the user-facing valid-4.3 path ROUTES. The `checkSpine43Schema({constraints:[]}).toThrow` cases (L64–96) are the standalone contradiction-PRIMITIVE (contract unchanged by the flip), NOT a 4.3-reject false-green. | No |
| 2 | `tests/core/loader-version-guard-predicate.spec.ts` | ALREADY-CORRECT + PRESERVE-THROW | `resolveRuntimeTag('4.3.01'/'4.3.73-beta'/'4.3.0', …).toBe('4.3')` (L144–160) routes. PRESERVE-THROW: `resolveRuntimeTag('4.4.0'/'5.0.0', …).toThrow` (L164–180, `≥4.4`) + `resolveRuntimeTag('4.1.99'/'3.8.99', …).toThrow` (L182–192, `<4.2`) intact verbatim. `checkSpineVersion('4.3.0'/'4.3.91-beta').toThrow` (L96–113) is the ISOLATED semver predicate (unchanged by design; the dispatcher routes — NOT the user-facing path, documented so a reviewer doesn't "fix" it). | No |
| 3 | `tests/core/loader-version-guard.spec.ts` | ALREADY-CORRECT (canonical flipped exemplar) + PRESERVE-THROW | `loadSkeleton(FIXTURE_43)` arm asserts ROUTING: `.not.toThrow()` (L127) + `handleRuntime(load.skeletonData).toBe('4.3')` (L134) + `caught` undefined / `.not.toBeInstanceOf(SpineVersionUnsupportedError)` (L164–166). PRESERVE-THROW: `loadSkeleton(FIXTURE_38)` (spine 3.8.99, `<4.2`) `.toThrow(SpineVersionUnsupportedError)` (L60) verbatim. | No |
| 4 | `tests/core/errors-version.spec.ts` | ALREADY-CORRECT + PRESERVE-THROW | D-10 3-branch block landed: `≥4.4` LOCKED wording (L72–88, asserts "This app supports Spine 4.2 and 4.3" + `.not.toContain('supported downgrade')`); `4.3-schema` = contradiction wording, NOT "re-export as 4.2" (L90–101); 4.3.x defensively NOT the old reject branch (L103–108). PRESERVE-THROW: `<4.2`/`unknown` LOCKED `<4.2` wording (L110–130). No `errors.ts` edit (Phase 45 must not touch it; assertions stay green untouched). | No |
| 5 | `tests/core/loader.spec.ts` | NO-4.3-ASSERT | 548 lines; no `loadSkeleton(4.3) toThrow` anywhere. `'4.2.43'` used only as a PREREQUISITE skeleton.spine to reach the `AtlasNotFoundError`/atlas-resolution branch (L90, L113, L134, L275). No 4.3-reject assertion exists to invert. | No |
| 6 | `tests/runtime/d13-43-load-smoke.spec.ts` | ALREADY-CORRECT (also the D-12 guard analog) | Direct-runtime arm (L125–221) asserts `SpineVersionUnsupportedError` NEVER raised on the direct path. Phase-44 D-11 GATED-loader `describe` (L223–258): `loadSkeleton(skeleton2.json)` `.not.toThrow()` (L238) + `handleRuntime(load.skeletonData).toBe('4.3')` (L245) + bones[]/skins[] non-empty. The OLD reject is gone. | No |
| 7 | `tests/core/ipc.spec.ts` | NO-4.3-ASSERT | 97 lines, fully read. `handleSkeletonLoad` happy + typed-error envelope only. `'4.2.43'` used solely as the prerequisite to reach `AtlasNotFoundError` (L85). No 4.3 input, no 4.3-reject assertion. | No |
| 8 | `tests/main/ipc.spec.ts` | NO-4.3-ASSERT (loader fully mocked) | 556 lines. `src/core/loader.js` fully `vi.mock`-ed with `checkSpineVersion: vi.fn()` (L118–125); the real version-guard never executes. The only `reject` strings are unrelated trust-boundary handlers (malformed menu payload L184–203, non-allowlisted shell URL L269–293, `.json`-suffix validator L539–555) — none version-related. Nothing to invert. | No |
| 9 | `tests/main/viewer-asset-feed-ipc.spec.ts` | NO-4.3-ASSERT (loader fully mocked) | 207 lines. Same pattern: `src/core/loader.js` `vi.mock`-ed with `checkSpineVersion: vi.fn()` (L101–105). Tests are `viewer:get-asset-feed` trust-boundary rejections (non-string / non-`.json` → `ok:false`, L118–145) — unrelated to version. | No |
| 10 | `tests/safe01/discover-fixtures.ts` | ALREADY-CORRECT (Phase-44 D-04 denylist absorbed the flip) | Not a `.spec` — a discovery utility. `SAFE01_EXCLUDED_PREFIXES` (L119–126) already excludes all 4.3-routing dirs (`SIMPLE_PROJECT_43/`, `SLIDER_4_3/`, `XTRA01_4_3/`, `XTRA02_4_3/`, `SPINE_4_3_TEST/`, `test_4.3/`) so the post-flip route-instead-of-reject doesn't leak them into the frozen SAFE-01 set. `SPINE_3_8_TEST` deliberately NOT denylisted (stays a natural `<4.2` reject-exclusion). Entries NOT removed (removing = re-leak + silent descope). | No |

**One-line summary verdict:** No surviving 4.3-reject false-green; all `<4.2`/`≥4.4` typed-throws preserved verbatim.

### Step-2 false-green grep evidence (recorded)

- `grep -nE "resolveRuntimeTag\('4\.3" tests/core/*.spec.ts` — every `.toBe('4.3')` hit is ROUTING; the only `.toThrow(` hits (`loader-version-guard-predicate.spec.ts:236/242/248`) are `resolveRuntimeTag('4.3.01', {ik:[]|transform:[]|path:[]})` — the **D-08 token=4.3-BUT-legacy-top-level-array contradiction** (malformed file), NOT a valid-4.3-reject false-green. A canonical valid 4.3 input (`{constraints:[]}` / `{}`) routes.
- `grep -nE "loadSkeleton\(FIXTURE_43\)|loadSkeleton\(.*4_?3.*\)" tests/core/*.spec.ts tests/runtime/*.spec.ts` — every `loadSkeleton(FIXTURE_43)` hit (`loader-version-guard.spec.ts:127/128/138/157`) is paired with `.not.toThrow()` / `handleRuntime(...).toBe('4.3')`. Zero `.toThrow(SpineVersionUnsupportedError)` on a 4.3 fixture.
- `grep -rnE "toThrow\(SpineVersionUnsupportedError\)" tests/` — every subject confirmed a `<4.2` input (`FIXTURE_38` 3.8.99 / `'4.1.99'` / `'3.8.99'` / `null` / malformed / `'4.4.0'`/`'5.0.0'` `≥4.4`) OR the standalone `checkSpine43Schema` contradiction-primitive. Zero on a valid-4.3 user-facing input.
- PRESERVE-THROW bar: `grep -F "expect(() => loadSkeleton(FIXTURE_38)).toThrow(SpineVersionUnsupportedError)" tests/core/loader-version-guard.spec.ts` STILL matches; `grep -nE "4\.4\.0|4\.1\.99" tests/core/loader-version-guard-predicate.spec.ts` shows the `≥4.4` + `<4.2` resolveRuntimeTag throw cases present.
- SCOPE-LEAK: `git diff --quiet src/core/` exits 0. `git status --porcelain tests/` showed NO modification to any of the 10 audited files (verify-only; only the net-new Task-2 spec added).

## D-12 standing guard — in-suite proof

`npm run test -- tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts`:

```
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

The guard rides the standard vitest gate every CI invokes (NOT a CI grep / one-time check). Targeted regression gate (per `project_renderer_mixblend_preexisting_failure` — NOT raw suite count): `npm run test -- tests/core/loader-version-guard.spec.ts tests/runtime/d13-43-load-smoke.spec.ts tests/core/errors-version.spec.ts tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` → **4 files passed (4) / 36 tests passed (36) / 0 failures**.

## Task Commits

Each task was committed atomically:

1. **Task 1: Re-audit all 10 Phase-44-D-11 test files** — *no code commit* (verify-only audit; the deliverable is the disposition table above + grep evidence — recorded in this SUMMARY. Expected outcome held: zero surviving false-green, zero edits, `src/core/` byte-untouched.)
2. **Task 2: Add the permanent D-12 anti-false-green standing guard spec** — `ee4b005` (test)

**Plan metadata:** committed with this SUMMARY (docs).

## Files Created/Modified

- `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` (created) — permanent in-suite vitest standing guard; asserts all 4 in-repo 4.3 fixtures route to runtime-43 (dispatch-target triplet) and never throw `SpineVersionUnsupportedError`.

## Decisions Made

- **Task 1 produced zero code edits** — this is the plan's explicitly expected outcome. Phase 44 D-11 already correctly inverted all behavioral 4.3-reject assertions for CI-green; Phase 45's D-11/SC#3 deliverable is the documented per-file disposition audit itself, not blanket rewrites. The acceptance bar (D-10) is met by *proving* no false-green remains + the D-12 standing sentinel.
- **D-12 guard home = `tests/runtime/`** — idiomatic (siblings `d13-43-load-smoke.spec.ts` / `runtime-distinctness.spec.ts` / `runtime-43-mesh-uv-pagespace.spec.ts` are cross-runtime sentinels there); the locked dispatch-target triplet was used verbatim per the PATTERNS.md proven shape.

## Deviations from Plan

None - plan executed exactly as written. Task 1's expected verify-only outcome (zero false-greens, zero edits) held; Task 2's spec was written verbatim from the locked PATTERNS.md shape and passed first run.

**45-PATTERNS.md note (not a deviation):** `45-PATTERNS.md` is an untracked file in the main worktree (never committed) so it was not present in this isolated git worktree. It was read read-only from the main-tree path to honor the plan's `<read_first>` cross-check instruction. The 45-02-PLAN.md `<interfaces>` block fully inlines the proven D-12 guard skeleton, the 4 fixture paths, and the disposition legend, so the plan was self-contained for execution; PATTERNS.md served only as a cross-check (verified, not blindly trusted — its 10-file disposition matched the independent file reads). No shared orchestrator artifact was modified.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- UX-02 test-assertion half is COMPLETE: the D-11 audit is documented and the D-12 standing sentinel is in-suite and green. A future re-plan silently re-introducing the 4.3 reject would now be caught by `npm run test`.
- The UX-02 user-facing copy/docs sweep half (App.tsx drop-zone, HelpDialog, README, CHANGELOG.md, doc-export no-op disposition — UX-01/UX-02 copy) is owned by Plan 45-01 (the parallel wave-1 plan); orchestrator merges + owns shared-file writes after both worktree agents complete.
- Zero runtime/loader/dispatch/errors behavior change — `src/core/*` byte-untouched, so no regression risk introduced to Phase 44's dispatch work.

## Self-Check: PASSED

- `tests/runtime/d12-43-fixtures-route-standing-guard.spec.ts` — FOUND
- `.planning/phases/45-dispatcher-user-facing-flip-copy-docs-sweep/45-02-SUMMARY.md` — FOUND
- Commit `ee4b005` (test 45-02) — FOUND in git log
- SUMMARY contains the 10-row "D-11 per-file disposition" table + the one-line summary verdict + the pasted 4-passing D-12 `Tests  4 passed (4)` result line

---
*Phase: 45-dispatcher-user-facing-flip-copy-docs-sweep*
*Completed: 2026-05-18*
