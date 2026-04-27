---
phase: 12-auto-update-tester-install-docs
plan: 05
subsystem: core
tags: [spine, version-guard, typed-error-envelope, ipc, fixtures, layer-3, tdd]

# Dependency graph
requires:
  - phase: 11-ci-release-pipeline-github-actions-draft-release
    provides: "11-WIN-FINDINGS.md §F3 — original Phase 11 spillover repro of the 3.x silent zero-output bug"
  - phase: 12-auto-update-tester-install-docs
    provides: "Plan 12-01 KNOWN_KINDS Set / SHELL_OPEN_EXTERNAL_ALLOWED Set / SerializableError union shape (untouched by 12-05)"
provides:
  - "checkSpineVersion(version, skeletonPath) predicate at src/core/loader.ts (exported for unit tests)"
  - "SpineVersionUnsupportedError class extending SpineLoaderError (src/core/errors.ts)"
  - "SerializableError union extension: { kind: 'SpineVersionUnsupportedError'; message; detectedVersion } third arm"
  - "Dedicated typed-error forwarder branches at src/main/ipc.ts + src/main/project-io.ts (3 sites) + src/main/sampler-worker.ts that populate detectedVersion"
  - "fixtures/SPINE_3_8_TEST/ rig (Spine 3.8.99-shaped JSON + stub atlas + 1×1 PNG sentinel) for fixture-driven regression"
  - "27 new vitest cases (5 errors-version + 12 predicate + 10 fixture-driven)"
affects: [12-06, future Spine version-bump phases, post-v1.1 untested-version-warning surface]

# Tech tracking
tech-stack:
  added: [none]
  patterns:
    - "Pattern F (typed-error envelope at IPC boundary): extension to a third union arm with one extra typed field beyond {kind, message}"
    - "Predicate-and-throw at the loader's first opportunity: hoist JSON.parse, narrow `unknown`, call predicate, then resume normal load flow"
    - "TypeScript-enforced forwarder safety: `KnownErrorKind` / `NonRecoveryKind` / `Exclude<...>` casts widened to also exclude the new kind, forcing a dedicated `instanceof` branch via the type system"

key-files:
  created:
    - tests/core/errors-version.spec.ts
    - tests/core/loader-version-guard-predicate.spec.ts
    - tests/core/loader-version-guard.spec.ts
    - fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json
    - fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.atlas
    - fixtures/SPINE_3_8_TEST/images/SQUARE.png
  modified:
    - src/core/errors.ts
    - src/core/loader.ts
    - src/shared/types.ts
    - src/main/ipc.ts
    - src/main/project-io.ts
    - src/main/sampler-worker.ts
    - tests/core/loader.spec.ts
    - tests/core/ipc.spec.ts

key-decisions:
  - "JSON.parse hoist: single parse for both version-check and readSkeletonData (no double-parse penalty)"
  - "4.3+ leniency: per CONTEXT.md Deferred — < 4.2 hard reject; 4.3+ silent pass (future v1.2+ extension point for an 'untested-version' warning surface)"
  - "KNOWN_KINDS Set INTENTIONALLY OMITS 'SpineVersionUnsupportedError': the extra typed field on its envelope arm cannot be produced by the generic kind-list cast; KnownErrorKind tightened via `Exclude<…, 'SpineVersionUnsupportedError'>` so the type system enforces dedicated-branch routing"
  - "checkSpineVersion exported for unit-test coverage of the seven decision cases independently of fixture loading"
  - "Pre-3.7 exports (no `skeleton.spine` field) and malformed JSON (no `skeleton` object) both route through `checkSpineVersion(null, …)` — single rejection path for both pathological shapes"

patterns-established:
  - "Pattern F extension shape: when a typed-error envelope arm needs an extra field beyond {kind, message}, add a dedicated instanceof branch BEFORE the generic forwarder AND tighten the Exclude<...> cast to force compile-time routing."
  - "Loader version guards belong at the loader's FIRST byte of post-readFileSync work — before atlas resolution and before skeleton parsing — so the rejection is fast and structurally separated from the rest of the load flow."

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-04-27
---

# Phase 12 Plan 05: F3 Spine 4.2 Version Guard at loader.ts Summary

**Hard-reject Spine < 4.2 at loader-time with `SpineVersionUnsupportedError` typed envelope (D-21); fixtures/SPINE_3_8_TEST/ rig drives the regression test.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-04-27T21:17:19Z
- **Completed:** 2026-04-27T21:27:13Z
- **Tasks:** 3 (all TDD: RED → GREEN per task)
- **Files modified:** 14 (8 modified + 6 created)

## Accomplishments

- `checkSpineVersion(version, skeletonPath)` predicate exported from `src/core/loader.ts` — pure-TS string parse + integer compare; throws `SpineVersionUnsupportedError` when major.minor < 4.2 or when version is null/malformed/empty; lenient on 4.3+ per CONTEXT Deferred. **Layer-3 invariant fully preserved** (no new electron / DOM / `node:fs` imports in `core/`).
- Insertion point is at the FIRST post-`readFileSync` opportunity, BEFORE atlas resolution. `JSON.parse` hoisted out of the line-140 `readSkeletonData` call so the version check + skeleton parse share one parse — no double-parse penalty.
- `SpineVersionUnsupportedError` class added to `src/core/errors.ts` (extends `SpineLoaderError`; `.name`-based KNOWN_KINDS routing contract preserved). Constructor accepts `(detectedVersion, skeletonPath)` and surfaces them as `public readonly` fields.
- `SerializableError` union extended with a THIRD arm `{ kind: 'SpineVersionUnsupportedError'; message; detectedVersion }` — keeps narrowing precise so the renderer/CLI can display the version separately from the message.
- Dedicated `instanceof SpineVersionUnsupportedError` branches added to FOUR forwarder sites (`src/main/ipc.ts:handleSkeletonLoad`, `src/main/project-io.ts` × 3 catch sites, `src/main/sampler-worker.ts:serializeError`) BEFORE the generic `instanceof SpineLoaderError` branch — populates the `detectedVersion` envelope field at every trust boundary.
- `KnownErrorKind` / `NonRecoveryKind` type aliases tightened via `Exclude<…, 'SkeletonNotFoundOnLoadError' | 'SpineVersionUnsupportedError'>` so the TypeScript compiler enforces dedicated-branch routing for the new kind (it cannot accidentally fall through the generic kind-list arm).
- `fixtures/SPINE_3_8_TEST/` rig delivered: minimal `SPINE_3_8_TEST.json` (3.8.99-shaped), stub `SPINE_3_8_TEST.atlas` (1×1 SQUARE region), `images/SQUARE.png` (74-byte hand-crafted RGBA PNG sentinel verified by `file`).
- 27 new vitest cases land green: 5 errors-version (class shape) + 12 predicate (all 7 decision branches × multiple cases) + 10 fixture-driven (loadSkeleton-rejection + 4 fixture-existence sentinels + 4.2 regression assertion).

## Task Commits

Each task ran the TDD RED → GREEN cycle. Two test fixtures (`tests/core/loader.spec.ts`, `tests/core/ipc.spec.ts`) were updated mid-Task-2-GREEN as a Rule 1 deviation; the updates are bundled into the GREEN commit (single coherent code surface).

1. **Task 1: SpineVersionUnsupportedError class + SerializableError union arm + KNOWN_KINDS forwarder branches**
   - `7e4b858` test — failing tests for SpineVersionUnsupportedError class shape (Task 1 RED; 5 cases — constructor, .name, .message, instanceof SpineLoaderError, 'unknown' variant)
   - `a1c608c` feat — add SpineVersionUnsupportedError + thread typed envelope (Task 1 GREEN; 5 file edits across `core/errors.ts` + `shared/types.ts` + `main/ipc.ts` + `main/project-io.ts` + `main/sampler-worker.ts`)
2. **Task 2: checkSpineVersion predicate + insertion site in src/core/loader.ts**
   - `09d7703` test — failing tests for checkSpineVersion predicate (Task 2 RED; 12 cases — 4 accepted + 8 rejected covering all decision branches)
   - `a16322a` feat — insert checkSpineVersion guard between readFileSync and atlas (Task 2 GREEN; loader.ts predicate + insertion site + JSON.parse hoist + 2 test-fixture updates for the now-shifted order-of-operations contract)
3. **Task 3: 3.8 fixture + fixture-driven version-guard tests**
   - `3d479fa` test — failing fixture-driven tests for F3 version guard (Task 3 RED; 10 cases including 4.2 regression assertion that was already passing)
   - `040a766` feat — add fixtures/SPINE_3_8_TEST/ rig (3.8.99 shape) for F3 regression (Task 3 GREEN; 3 fixture files committed — 28 lines net)

**Plan metadata:** Will be the next commit (this SUMMARY + STATE.md + ROADMAP.md updates).

## Files Created/Modified

**Created:**
- `src/core/errors.ts` (modified — see below; one new class added)
- `tests/core/errors-version.spec.ts` — 5 class-shape unit tests for `SpineVersionUnsupportedError`
- `tests/core/loader-version-guard-predicate.spec.ts` — 12 predicate unit tests across all seven decision cases
- `tests/core/loader-version-guard.spec.ts` — 10 fixture-driven tests asserting end-to-end rejection
- `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json` — minimal Spine 3.8.99-shaped skeleton JSON
- `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.atlas` — stub atlas with one SQUARE region (sentinel for future expansion)
- `fixtures/SPINE_3_8_TEST/images/SQUARE.png` — 1×1 transparent RGBA PNG (74 bytes)

**Modified:**
- `src/core/errors.ts` — appended `SpineVersionUnsupportedError extends SpineLoaderError` with two-field constructor (mirrors AtlasNotFoundError template; `.name` set for KNOWN_KINDS routing)
- `src/core/loader.ts` — imported new error class; added exported `checkSpineVersion` predicate; inserted version-guard call between `readFileSync` and atlas resolution; hoisted `JSON.parse(jsonText)` so the parse is shared with `readSkeletonData(parsedJson)`
- `src/shared/types.ts` — `SerializableError` union extended with the third arm `{ kind: 'SpineVersionUnsupportedError'; message; detectedVersion }`
- `src/main/ipc.ts` — imported new error class; added dedicated `instanceof SpineVersionUnsupportedError` branch in `handleSkeletonLoad` BEFORE the generic forwarder; `KnownErrorKind` tightened to also Exclude `'SpineVersionUnsupportedError'`; KNOWN_KINDS Set deliberately omits the new kind (commented inline)
- `src/main/project-io.ts` — imported new error class; added dedicated `instanceof` branches at all 3 SpineLoaderError catch sites (project-open, locate-and-reload, resample); `NonRecoveryKind` tightened identically to `KnownErrorKind`
- `src/main/sampler-worker.ts` — imported new error class; added dedicated `instanceof` branch in `serializeError`; the generic forwarder's `Exclude<…>` cast extended to keep type-safe under the union widening
- `tests/core/loader.spec.ts` — 3 inline `'{}'` fixtures changed to `'{"skeleton":{"spine":"4.2.43"}}'` so the existing AtlasNotFoundError tests reach the atlas-resolution branch (the new version-guard now fires before atlas resolution per the F3 insertion-site contract; pre-12-05 ordering was atlas → skeleton-parse, post-12-05 ordering is version-guard → atlas → skeleton-parse)
- `tests/core/ipc.spec.ts` — same one-line fixture update for the IPC-layer AtlasNotFoundError test (D-10/F1.4)

## Decisions Made

- **JSON.parse hoist (single parse).** Hoisting `JSON.parse(jsonText)` out of the line-140 `readSkeletonData` call gives the version-guard direct access to `parsedJson.skeleton.spine` without re-parsing. Performance penalty avoided; the alternative (let the version-guard parse independently and let `readSkeletonData` parse a second time) would have doubled the JSON-parse cost on every load.
- **4.3+ silent leniency.** Per CONTEXT.md Deferred: "4.3+ is not silently rejected, but it's also not actively supported." The predicate's reject branch is `major < 4 || (major === 4 && minor < 2)` — 4.3+ passes silently. A future "untested-version" warning surface (separate kind, separate UI affordance) is a v1.2+ extension point and was deliberately deferred to keep this plan focused on the F3 regression.
- **`KNOWN_KINDS` Set deliberately omits `'SpineVersionUnsupportedError'`.** The plan's acceptance criteria called for adding the new kind to the Set. The Set is typed by `KnownErrorKind = Exclude<SerializableError['kind'], …>`; the new arm carries an extra typed field (`detectedVersion`) beyond `{kind, message}`, so the generic `{kind: err.name as KnownErrorKind, message: err.message}` cast cannot produce it. **Equivalent design with tighter type safety:** also exclude `'SpineVersionUnsupportedError'` at the `Exclude<...>` level, keep the dedicated `instanceof` branch BEFORE the generic forwarder, and let TypeScript enforce that the generic branch can never accidentally produce the version-error arm. Same runtime behavior; safer at compile time. Documented inline in `src/main/ipc.ts` and `src/main/project-io.ts`.
- **`checkSpineVersion` exported.** The predicate's seven decision branches deserve direct unit-test coverage independent of fixture loading. Exporting it (`export function checkSpineVersion`) gave the predicate test 12 case-by-case assertions; the alternative (test only via fixtures) would have required 12 separate fixture files just to hit each decision branch. Pure-TS function; exporting it adds zero runtime cost.
- **12-01's `update:*` IPC surface preserved byte-for-byte.** The 4 `update:*` IPC handlers and the `SHELL_OPEN_EXTERNAL_ALLOWED` Set in `src/main/ipc.ts` were NOT modified by this plan. The `git diff src/main/ipc.ts` shows the changes are contained to the `KNOWN_KINDS` region + new import + new catch-clause branch (35 inserts / 4 deletes total).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] KNOWN_KINDS Set entry incompatible with TypeScript narrowing**
- **Found during:** Task 1 GREEN (typecheck:node)
- **Issue:** Plan's acceptance criteria called for `'SpineVersionUnsupportedError'` to be a member of `KNOWN_KINDS` and to have its `detectedVersion` field populated by a dedicated branch in the same forwarder. The Set is typed by `KnownErrorKind = Exclude<SerializableError['kind'], 'SkeletonNotFoundOnLoadError'>`; once the new arm with an extra typed field landed, the generic `{kind: err.name as KnownErrorKind, message: err.message}` cast at the forwarder fallback could no longer satisfy the union (TypeScript correctly rejected `{kind, message}` for the version-error arm because `detectedVersion` was missing). Same root cause cascaded to 3 other forwarder sites in `src/main/project-io.ts` (NonRecoveryKind) and 1 in `src/main/sampler-worker.ts`.
- **Fix:** Tightened both `KnownErrorKind` (in ipc.ts) and `NonRecoveryKind` (in project-io.ts) to also `Exclude` `'SpineVersionUnsupportedError'`. Added the dedicated `instanceof SpineVersionUnsupportedError` branch BEFORE the generic forwarder at all 5 catch sites (ipc.ts × 1, project-io.ts × 3, sampler-worker.ts × 1). Equivalent design: the new kind is typed-out of the generic-cast path and routed exclusively through the dedicated branch (which populates `detectedVersion` from the error instance). Same runtime behavior; tighter type safety.
- **Files modified:** src/main/ipc.ts, src/main/project-io.ts, src/main/sampler-worker.ts
- **Verification:** `npm run typecheck:web` clean; `npm run typecheck:node` clean except for the pre-existing `scripts/probe-per-anim.ts` failure carried via deferred-items.md per SCOPE BOUNDARY.
- **Committed in:** `a1c608c` (Task 1 GREEN commit)

**2. [Rule 1 - Bug] Existing inline-fixture tests broken by the new order-of-operations**
- **Found during:** Task 2 GREEN (vitest run)
- **Issue:** `tests/core/loader.spec.ts` (3 tests) and `tests/core/ipc.spec.ts` (1 test) used inline `'{}'` JSON fixtures to exercise the AtlasNotFoundError branch. The pre-12-05 loader ordering was readFileSync → atlas-resolution → skeleton-parse, so an empty JSON object would reach atlas-resolution before failing. Post-12-05, the version-guard fires BEFORE atlas-resolution, so empty `'{}'` (no `skeleton.spine` field) now produces `SpineVersionUnsupportedError` instead of letting the test reach AtlasNotFoundError. The 4 tests' true intent is to exercise the AtlasNotFoundError branch; the version-guard's interception was an accidental short-circuit.
- **Fix:** Updated all 4 inline fixtures from `'{}'` to `'{"skeleton":{"spine":"4.2.43"}}'`. Test comments updated to document the new "version-guard → atlas → skeleton-parse" ordering. The fix is the minimum viable surface change — the tests' assertions and fixture-cleanup logic are otherwise byte-identical.
- **Files modified:** tests/core/loader.spec.ts, tests/core/ipc.spec.ts
- **Verification:** All 4 tests pass; full suite 415/415 passing (no other tests required updating).
- **Committed in:** `a16322a` (Task 2 GREEN commit; bundled with the loader.ts edits as one cohesive code surface).

---

**Total deviations:** 2 auto-fixed (1 Rule 3 blocking — TypeScript narrowing + 1 Rule 1 bug — existing-test order-of-operations).
**Impact on plan:** Both deviations were necessary for correctness. The Rule 3 deviation produced a TIGHTER design than the plan specified (compile-time enforcement of dedicated-branch routing). The Rule 1 deviation was forced by the F3 architectural change itself — the new "version-guard fires first" contract necessarily breaks tests that assumed the old contract. No scope creep; no new features.

## Issues Encountered

- **CLI exit code verification confusion.** Initial smoke test of `npm run cli -- fixtures/SPINE_3_8_TEST/...` followed by `; echo "EXIT:$?"` reported `EXIT:0` — looked like a regression. Re-ran with `npm run cli -- fixture > /dev/null 2>&1; echo "CLI EXIT:$?"` and got `CLI EXIT:3` — the exit code from `scripts/cli.ts:164`'s `SpineLoaderError`-catch path. The first run's `EXIT:0` was the exit code of the entire pipe (last command was `tail -15`, which always exits 0). No regression — the CLI threads the new typed kind correctly through the existing catch-and-format-from-err.name path. Documented for future smoke-runs.

## User Setup Required

None — F3 is a pure source-code fix. No environment variables, no external service configuration, no manual steps for testers. The next CI tag-push (gated on Phase 12.1's publish-race fix) will exercise the F3 regression test on every leg of the 3-OS matrix [ubuntu-latest, windows-2022, macos-14] automatically.

## Next Phase Readiness

- **Phase 12 progress:** 5/6 plans complete (Wave 2 finishes here).
- **Plan 12-06 unblocked:** INSTALL.md authoring + linking surfaces (REL-03). The only remaining plan in Phase 12. No dependency cross-coupling with 12-05 — 12-06 is documentation-and-linking work.
- **Cross-link to 11-WIN-FINDINGS.md §F3:** the original Phase 11 spillover finding ("Optimize Assets reports success while producing zero usable images on a 3.8 rig") now has a fail-fast typed envelope at the loader's first opportunity. Future regressions are caught by the fixture-driven test on every CI run including the 12-02 expanded matrix.
- **Future v1.2+ extension point:** the 4.3+ leniency carve-out is documented in `src/core/loader.ts checkSpineVersion` JSDoc and in CONTEXT.md Deferred. A future "untested-version" warning surface would split the predicate's pass branch into "supported (4.2.x)" and "untested-but-permitted (4.3+)" — separate kinds, separate UI affordances. Out of scope for v1.1.

## Self-Check: PASSED

Files exist:
- FOUND: src/core/errors.ts (SpineVersionUnsupportedError class added)
- FOUND: src/core/loader.ts (checkSpineVersion + insertion site)
- FOUND: src/shared/types.ts (third union arm)
- FOUND: src/main/ipc.ts (forwarder branch)
- FOUND: src/main/project-io.ts (3 forwarder branches)
- FOUND: src/main/sampler-worker.ts (forwarder branch)
- FOUND: fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json
- FOUND: fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.atlas
- FOUND: fixtures/SPINE_3_8_TEST/images/SQUARE.png
- FOUND: tests/core/errors-version.spec.ts
- FOUND: tests/core/loader-version-guard-predicate.spec.ts
- FOUND: tests/core/loader-version-guard.spec.ts

Commits exist (verified via `git log --oneline | head -10`):
- FOUND: 7e4b858 (Task 1 RED)
- FOUND: a1c608c (Task 1 GREEN)
- FOUND: 09d7703 (Task 2 RED)
- FOUND: a16322a (Task 2 GREEN)
- FOUND: 3d479fa (Task 3 RED)
- FOUND: 040a766 (Task 3 GREEN)

TDD gate compliance:
- 3 `test(...)` commits land BEFORE their corresponding `feat(...)` GREEN commits.
- All 3 RED commits demonstrably fail at the time of commit (5/5, 12/12, 9/10 respectively).
- All 3 GREEN commits demonstrably pass after the implementation lands (5/5, 24/24 across loader+predicate, 10/10).
- No REFACTOR commits needed (the GREEN implementations were the minimum viable code; no cleanup required).

Test counts:
- Baseline: 388 passing.
- Post-12-05: 415 passing (+27 net = 5 errors-version + 12 predicate + 10 fixture-driven).

---
*Phase: 12-auto-update-tester-install-docs*
*Completed: 2026-04-27*
