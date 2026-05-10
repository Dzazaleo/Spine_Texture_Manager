---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 02
subsystem: errors
tags: [errors, ipc, typed-error-envelope, atlas-less, load-01, serializable-error]

# Dependency graph
requires:
  - phase: 12-loader-version-guard
    provides: KNOWN_KINDS routing pattern + SpineLoaderError taxonomy + AtlasNotFoundError two-field constructor template
provides:
  - MissingImagesDirError typed error class (src/core/errors.ts)
  - SerializableError union extension with 'MissingImagesDirError' kind literal
  - KNOWN_KINDS Set entry routing the error through the typed envelope arm (kind: 'MissingImagesDirError', not 'Unknown')
  - Regression test in tests/main/ipc.spec.ts that mocks loadSkeleton to throw MissingImagesDirError and asserts handleSkeletonLoad's catch branch produces the typed envelope
affects: [21-04-synthetic-atlas-synthesizer, 21-05-renderer-error-ui, 21-06-cli-atlas-less-mode]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-error envelope: throw SpineLoaderError subclass with .name discriminator → KNOWN_KINDS Set routes to typed kind literal in SerializableError union (Phase 12 / Plan 05 pattern, now extended)"
    - "Optional structured field on the error class (missingPngs?: string[]) for programmatic consumers; the IPC envelope only carries the human-formatted message string"
    - "vi.hoisted + vi.mock pattern in tests/main/ipc.spec.ts to swap loadSkeleton with a configurable throw-stub, lets tests drive handleSkeletonLoad's catch-branch without needing the (Plan 04) synthesizer"

key-files:
  created: []
  modified:
    - src/core/errors.ts
    - src/shared/types.ts
    - src/main/ipc.ts
    - tests/main/ipc.spec.ts

key-decisions:
  - "Two-field public-readonly constructor (searchedPath, skeletonPath) mirrors AtlasNotFoundError; optional third arg missingPngs?: string[] satisfies D-11 (full list of missing PNGs in the message) without forcing every call site to enumerate"
  - "Inserted 'MissingImagesDirError' between 'AtlasParseError' and 'ProjectFileNotFoundError' in SerializableError vanilla-arm to group loader-time errors together (matches existing visual ordering)"
  - "KNOWN_KINDS auto-derives KnownErrorKind from SerializableError['kind'] via Exclude — adding the literal in shared/types.ts is sufficient for the type narrowing; the Set entry is the runtime predicate"
  - "Regression test mocks loadSkeleton via vi.mock + vi.hoisted (avoids requiring the Plan 04 synthesizer to be implemented to test routing). Negative-case test asserts non-typed errors still route to kind: 'Unknown' as a guard against KNOWN_KINDS over-broadening"

patterns-established:
  - "When adding a new SpineLoaderError subclass: (1) define class in src/core/errors.ts with explicit `this.name = '<ClassName>'`, (2) extend SerializableError vanilla-arm in src/shared/types.ts with the matching kind literal, (3) append the literal to KNOWN_KINDS Set in src/main/ipc.ts, (4) add a regression test that asserts envelope routing produces the typed kind (not 'Unknown')"
  - "Test-side: loadSkeleton mock pattern in tests/main/ipc.spec.ts now exists for any future test that needs to drive handleSkeletonLoad's catch branch without booting the real loader"

requirements-completed: [LOAD-01]

# Metrics
duration: 5 min
completed: 2026-05-01
---

# Phase 21 Plan 02: errors-ipc Summary

**MissingImagesDirError typed-error class wired end-to-end through the SerializableError IPC envelope — class lives in `src/core/errors.ts`, kind literal lives in `src/shared/types.ts`, KNOWN_KINDS Set in `src/main/ipc.ts` routes it to `kind: 'MissingImagesDirError'` (not `'Unknown'`), and a vitest regression test in `tests/main/ipc.spec.ts` enforces the routing.**

## Performance

- **Duration:** ~5 min (287 s)
- **Started:** 2026-05-01T22:51:23Z
- **Completed:** 2026-05-01T22:56:10Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `MissingImagesDirError` class added to `src/core/errors.ts` mirroring `AtlasNotFoundError` shape (two-field constructor + optional `missingPngs?: string[]` D-11 list) with explicit `.name = 'MissingImagesDirError'` for IPC routing.
- `SerializableError` union in `src/shared/types.ts` extended with `'MissingImagesDirError'` kind literal between `'AtlasParseError'` and `'ProjectFileNotFoundError'`.
- `KNOWN_KINDS` Set in `src/main/ipc.ts` extended with `'MissingImagesDirError'` so `handleSkeletonLoad`'s catch branch routes the error to the typed envelope arm rather than falling through to `kind: 'Unknown'`.
- Regression test in `tests/main/ipc.spec.ts` confirms routing: mocks `loadSkeleton` to throw `MissingImagesDirError`, asserts `resp.error.kind === 'MissingImagesDirError'`, message contains `'Atlas-less mode requires'` + the missing PNG name, and no stack trace leaks (T-01-02-02). Negative-case test confirms non-typed errors still route to `kind: 'Unknown'`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MissingImagesDirError class to src/core/errors.ts** — `722a2b6` (feat)
2. **Task 2: Extend SerializableError union in src/shared/types.ts** — `b58e1e4` (feat)
3. **Task 3: Register MissingImagesDirError in KNOWN_KINDS + add ipc.spec.ts regression test** — `85ee344` (feat)

## Files Created/Modified

- `src/core/errors.ts` — Added 40-line `MissingImagesDirError` class extending `SpineLoaderError` (constructor: `searchedPath`, `skeletonPath`, optional `missingPngs?: string[]`; `.name = 'MissingImagesDirError'`).
- `src/shared/types.ts` — Added single literal `| 'MissingImagesDirError'` to the vanilla-arm of `SerializableError` (line 583, between `'AtlasParseError'` and `'ProjectFileNotFoundError'`). The `KnownErrorKind` type alias in `src/main/ipc.ts` auto-derives from this.
- `src/main/ipc.ts` — Added `'MissingImagesDirError',` line to `KNOWN_KINDS` Set (after `'AtlasParseError'`). Single insertion; no other changes.
- `tests/main/ipc.spec.ts` — Added `vi.mock('../../src/core/loader.js', ...)` block with hoisted `loadSkeletonMock` so tests can drive `handleSkeletonLoad`'s catch branch. Added two `it(...)` tests in a new describe block: (a) routing produces `kind: 'MissingImagesDirError'` + D-11 message contract + no stack-trace leak; (b) non-typed errors still route to `kind: 'Unknown'` (regression guard).

## Decisions Made

- **Test mock strategy:** Plan 04 (synthesizer) is not yet implemented, so a real `MissingImagesDirError` cannot be triggered through normal code paths. Chose to mock `loadSkeleton` via `vi.mock` + `vi.hoisted` to drive the catch branch directly. This proves the routing wiring without depending on Plan 04.
- **Negative-case regression test:** Added a second test asserting `kind: 'Unknown'` for non-typed errors. This guards against accidental over-broadening of the `KNOWN_KINDS` predicate (e.g., a future refactor that drops the `instanceof SpineLoaderError` check).
- **No `forwardToRenderer` helper extraction:** The plan's task description suggested mirroring an existing `forwardToRenderer(err)` helper test, but no such helper exists — the routing logic lives inline in `handleSkeletonLoad`'s catch block. Chose to test the actual handler instead of refactoring out a helper (Rule 4 — would have been an architectural change requiring user approval). The test is functionally equivalent to what the plan asked for.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written, with one clarification on test approach noted under Decisions Made above.

### Plan-vs-reality clarifications

- **Plan referenced "the AtlasNotFoundError analog test" in `tests/main/ipc.spec.ts`** — that test does not exist there; the analogous test is in `tests/core/ipc.spec.ts` (line 79, `it('D-10/F1.4: missing atlas returns {ok: false, error.kind: AtlasNotFoundError}')`). The plan explicitly directed the new test to `tests/main/ipc.spec.ts` and allowed the analog signature to differ; I honored the file path and built the test from scratch using the loadSkeleton-mock pattern. This is a plan readability nit, not a deviation — the work landed where the plan said it should.

---

**Total deviations:** 0 auto-fixes
**Impact on plan:** Plan executed exactly as written. All acceptance criteria met.

## Issues Encountered

- **Pre-existing TypeScript warnings (out of scope):** `npm run typecheck` reports two pre-existing TS6133 unused-parameter warnings in `src/renderer/src/panels/AnimationBreakdownPanel.tsx:286` and `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:531`. Confirmed pre-existing via `git stash` round-trip — unrelated to this plan's changes. Out of scope per the executor's scope-boundary rule.
- **Pre-existing test failure (out of scope):** `tests/main/sampler-worker-girl.spec.ts` fails its 1 test because the fixture under `fixtures/Girl/` is not committed to the repo (it is the user's local rig and shows up as an untracked `fixtures/Girl copy/` in `git status`). Confirmed pre-existing via `git stash` round-trip. Unrelated to this plan; out of scope.

## Verification Summary

- `npm run typecheck`: 0 errors in scope (the 2 pre-existing renderer warnings are unrelated).
- `npx vitest run tests/main/ipc.spec.ts`: 18 passed (2 new MissingImagesDirError tests + 16 pre-existing). 197 ms.
- `npm run test`: 587 passed | 1 failed (pre-existing sampler-worker-girl.spec.ts, fixture missing) | 2 skipped | 2 todo across 52 files.
- Plan-level grep verification: all three sites wired (`'MissingImagesDirError'` literal in `src/main/ipc.ts`, `src/shared/types.ts`, and `this.name = 'MissingImagesDirError'` in `src/core/errors.ts`).

## Next Phase Readiness

- Plan 21-04 (synthetic-atlas synthesizer) can now `throw new MissingImagesDirError(searchedPath, skeletonPath, missingPngs)` and the IPC envelope will route correctly to `kind: 'MissingImagesDirError'`. No further wiring required at the typed-error layer.
- Plan 21-05 (renderer error UI) can branch on `error.kind === 'MissingImagesDirError'` in the SerializableError union narrowing — the kind literal is now exposed.
- Plan 21-06 (CLI atlas-less mode) can `instanceof MissingImagesDirError` against the imported class for typed CLI output.

## Self-Check: PASSED

**Files verified to exist:**
- `src/core/errors.ts` — FOUND (contains `export class MissingImagesDirError extends SpineLoaderError` + `this.name = 'MissingImagesDirError'`)
- `src/shared/types.ts` — FOUND (contains `'MissingImagesDirError'` kind literal in SerializableError union)
- `src/main/ipc.ts` — FOUND (contains `'MissingImagesDirError'` in KNOWN_KINDS Set)
- `tests/main/ipc.spec.ts` — FOUND (contains `MissingImagesDirError` import + `toBe('MissingImagesDirError')` assertion + `vi.mock('../../src/core/loader.js')` block)

**Commits verified to exist (via `git log --oneline`):**
- `722a2b6` — FOUND (Task 1)
- `b58e1e4` — FOUND (Task 2)
- `85ee344` — FOUND (Task 3)

---
*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Completed: 2026-05-01*
