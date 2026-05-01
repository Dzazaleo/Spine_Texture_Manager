---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 05
subsystem: types
tags: [types, type-cascade, layer-3, atlas-less, ipc-contract]

# Dependency graph
requires:
  - phase: 21
    provides: "21-CONTEXT.md decisions D-03, D-08, D-15 — the contract shape this plan ratifies"
provides:
  - "LoadResult.atlasPath: string | null (D-03 — null in atlas-less mode)"
  - "SourceDims.source: 'atlas-orig' | 'atlas-bounds' | 'png-header' (D-15 — third variant for atlas-less)"
  - "LoaderOptions.loaderMode?: 'auto' | 'atlas-less' (D-08 — per-project override field)"
  - "SkeletonSummary.atlasPath: string | null (D-03 cascade across IPC seam)"
affects: [21-06 loader integration, 21-07 stmproj loaderMode plumbing, 22-dim-drift-badge]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure type widening — additive variant + nullability with no runtime change"
    - "Surgical 3-way merge prep — minimal edits to shared/types.ts to coexist with parallel-wave plan 21-02 changes"

key-files:
  created: []
  modified:
    - "src/core/types.ts (LoadResult.atlasPath nullable; SourceDims.source +'png-header'; LoaderOptions.loaderMode added)"
    - "src/shared/types.ts (SkeletonSummary.atlasPath nullable — IPC contract)"
    - "src/renderer/src/components/AppShell.tsx (cascade: atlasPath null→undefined coercion at resampleProject IPC seam)"
    - "tests/core/loader.spec.ts (cascade: non-null assertion on canonical-mode fixture)"
    - "tests/core/summary.spec.ts (cascade: non-null assertion on canonical-mode fixture)"

key-decisions:
  - "Cascade fixes attached to the task that caused them: tests/core/loader.spec.ts narrowing → Task 1 commit (LoadResult widening); tests/core/summary.spec.ts + AppShell.tsx fixes → Task 2 commit (SkeletonSummary widening)."
  - "Coerced null → undefined at the resampleProject IPC seam (AppShell.tsx:1053) rather than widening the IPC payload type — minimum-blast-radius fix that respects the existing string|undefined contract."
  - "Pre-existing TS6133 panel warnings + Girl-fixture sampler test failure documented in deferred-items.md — verified by stashing this plan's diffs and re-running the same checks against the unmodified base commit f09c29b."

patterns-established:
  - "Type-widening cascade discipline: make the contract change, run typecheck, fix every consumer the compiler flags, document scope-out items."
  - "Deviation Rule 1/3 application: test files NOT in plan files_modified are still in-scope when the type widening directly causes their typecheck failures (compiler-detected blocking issue)."

requirements-completed: [LOAD-01]

# Metrics
duration: 4min
completed: 2026-05-01
---

# Phase 21 Plan 05: Types Cascade Summary

**LoadResult.atlasPath + SkeletonSummary.atlasPath widened to `string | null`; SourceDims.source gains `'png-header'` discriminator; LoaderOptions.loaderMode added — D-03 + D-08 + D-15 type contract ratified for Plan 06 + Plan 07 consumers.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-01T22:51:57Z
- **Completed:** 2026-05-01T23:55:47Z (note: included one stash/unstash pre-existing-failure verification round-trip; pure-edit time was under 4 minutes)
- **Tasks:** 2 (both `type="auto"`)
- **Files modified:** 5 (2 type files + 3 cascade fixes)

## Accomplishments

- `src/core/types.ts`: three additive type changes — `LoadResult.atlasPath: string | null`, `SourceDims.source: 'atlas-orig' | 'atlas-bounds' | 'png-header'`, new `LoaderOptions.loaderMode?: 'auto' | 'atlas-less'`.
- `src/shared/types.ts`: `SkeletonSummary.atlasPath: string | null` (IPC contract widening, surgical edit to coexist with parallel Plan 21-02 changes to the same file).
- Cascade fix at `src/renderer/src/components/AppShell.tsx:1053`: null→undefined coercion at the resampleProject IPC seam (`summary.atlasPath ?? undefined`).
- Test narrowings at `tests/core/loader.spec.ts:37` + `tests/core/summary.spec.ts:52` (canonical-mode fixture asserts `atlasPath` non-null with explicit `expect(...).not.toBeNull()` + `!` assertion).
- ProjectFileV1 / AppSessionState deliberately NOT touched (Plan 21-07 territory) — scope discipline preserved.

## Task Commits

1. **Task 1: Widen src/core/types.ts** — `1e17013` (feat)
2. **Task 2: Widen SkeletonSummary.atlasPath** — `211ac58` (feat)

## Files Created/Modified

- `src/core/types.ts` — D-03 nullable atlasPath + D-15 png-header SourceDims variant + D-08 LoaderOptions.loaderMode field, all with substantive JSDoc.
- `src/shared/types.ts` — D-03 SkeletonSummary.atlasPath nullable (single-field surgical edit; ProjectFileV1 + AppSessionState left untouched per scope boundary with Plan 21-07).
- `src/renderer/src/components/AppShell.tsx` — line 1053 resampleProject IPC seam: `atlasPath: summary.atlasPath ?? undefined`. The IPC payload type is `string | undefined`, NOT nullable, so we coerce at this single seam rather than ripple the nullability further.
- `tests/core/loader.spec.ts` — line 37 narrows `r.atlasPath` for canonical-mode SIMPLE_TEST fixture which always has a sibling `.atlas`.
- `tests/core/summary.spec.ts` — line 52 narrows `s.atlasPath` for canonical-mode SIMPLE_TEST fixture.
- `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/deferred-items.md` — pre-existing typecheck warnings + sampler-worker-girl test failure logged with verification evidence.

## Decisions Made

- **Cascade fixes split per causing task:** `tests/core/loader.spec.ts` rides Task 1 (it consumes `LoadResult` from `src/core/types.ts`); `tests/core/summary.spec.ts` + `src/renderer/src/components/AppShell.tsx` ride Task 2 (they consume `SkeletonSummary` from `src/shared/types.ts`). This keeps each commit's diff scoped to a single contract change.
- **AppShell.tsx fix uses `?? undefined`** instead of widening the IPC payload type. Rationale: the resampleProject IPC contract is `string | undefined` (not nullable). Widening the IPC type adds nullability surface to a 5+ field payload; coercing at the single seam is minimal-blast-radius and reads as an obvious shape adapter.

## Deviations from Plan

The plan author (RESEARCH.md §Pitfall 8) asserted that ALL consumer sites of `atlasPath` were already null-defensive. Two sites were missed during the audit and required cascade fixes:

### Auto-fixed Issues

**1. [Rule 3 - Blocking] tests/core/loader.spec.ts:37 fails to typecheck after LoadResult.atlasPath widening**
- **Found during:** Task 1 (src/core/types.ts widening)
- **Issue:** `expect(r.atlasPath.endsWith('SIMPLE_TEST.atlas')).toBe(true)` — `.endsWith` not callable on `string | null`. RESEARCH.md §Pitfall 8 audit was production-only; tests were not surveyed.
- **Fix:** Added `expect(r.atlasPath).not.toBeNull(); expect(r.atlasPath!.endsWith(...))`. Semantically correct — the SIMPLE_TEST fixture is canonical-mode and always has a sibling `.atlas`, so non-null is the runtime invariant.
- **Files modified:** `tests/core/loader.spec.ts`
- **Verification:** `npm run typecheck` — error cleared.
- **Committed in:** `1e17013` (Task 1 commit)

**2. [Rule 3 - Blocking] tests/core/summary.spec.ts:52 fails to typecheck after SkeletonSummary.atlasPath widening**
- **Found during:** Task 2 (src/shared/types.ts widening)
- **Issue:** Same shape as above — `.endsWith` on a `string | null`. Same canonical-mode invariant applies.
- **Fix:** Same `not.toBeNull()` + `!` pattern.
- **Files modified:** `tests/core/summary.spec.ts`
- **Verification:** `npm run typecheck` — error cleared.
- **Committed in:** `211ac58` (Task 2 commit)

**3. [Rule 3 - Blocking] src/renderer/src/components/AppShell.tsx:1053 fails to typecheck — resampleProject IPC payload expects string|undefined, not nullable**
- **Found during:** Task 2 (src/shared/types.ts widening)
- **Issue:** `atlasPath: summary.atlasPath` — once SkeletonSummary.atlasPath widens to `string | null`, the assignment to a `string | undefined`-typed payload field fails. RESEARCH.md §Pitfall 8 listed this site as "passthrough; project-io.ts:840 handles null gracefully" but didn't note that the IPC payload type itself is not nullable (only project-io.ts:840's `typeof === 'string'` check coerces null to undefined — but the typecheck happens at the IPC payload boundary, BEFORE that coercion runs).
- **Fix:** Coerce inline: `atlasPath: summary.atlasPath ?? undefined`. Honors the existing IPC contract (no payload-type widening); the runtime semantics are unchanged because `project-io.ts:840` already routes both null and undefined to undefined.
- **Files modified:** `src/renderer/src/components/AppShell.tsx`
- **Verification:** `npm run typecheck` — error cleared.
- **Committed in:** `211ac58` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 3 — blocking issues caused directly by the type widening; missed during the production-only Pitfall 8 audit).
**Impact on plan:** All three are minimal-blast-radius fixes. The contract change is exactly what the plan specified; the audit just didn't include test files or note that the IPC payload type at AppShell.tsx:1053 is non-nullable. No scope creep — every fix is the smallest correct narrowing/coercion. Total LOC added across all three fixes: ~10 lines including comments.

## Issues Encountered

- **Pre-existing TS6133 warnings** in `src/renderer/src/panels/AnimationBreakdownPanel.tsx:286` and `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:531` (`'onQueryChange' is declared but its value is never read`). Verified pre-existing on base commit `f09c29b` by stashing this plan's diffs and re-running typecheck. Not caused by Plan 21-05; logged to `deferred-items.md`.
- **Pre-existing vitest failure** in `tests/main/sampler-worker-girl.spec.ts` ("warm-up run must complete (not error/cancel)"). Verified pre-existing on base commit `f09c29b` by stashing this plan's diffs and re-running the spec. Not caused by Plan 21-05's type widening (the test never references `atlasPath`, `SourceDims.source`, or `LoaderOptions.loaderMode`). Logged to `deferred-items.md`. Likely a missing `fixtures/Girl` test fixture or environment-specific harness issue.

## Verification

```text
Verification 3 (npm run typecheck — pure type widening, both files):
  ✓ grep -q "atlasPath: string | null" src/core/types.ts
  ✓ grep -q "atlasPath: string | null" src/shared/types.ts

Verification 4 (SourceDims.source +'png-header'):
  ✓ grep -q "'png-header'" src/core/types.ts

Verification 5 (LoaderOptions.loaderMode):
  ✓ grep -E "loaderMode\?:" src/core/types.ts

Plan-level success criteria (after excluding pre-existing TS6133 unrelated to this plan):
  ✓ npm run typecheck — 0 NEW errors caused by this plan
  ✓ npm run test — 0 NEW failures caused by this plan (1 pre-existing Girl-fixture failure documented in deferred-items.md and verified pre-existing on base commit f09c29b)
  ✓ ProjectFileV1 / AppSessionState NOT touched (Plan 07 territory)
```

## Next Phase Readiness

- `LoadResult.atlasPath: string | null` is now the contract — Plan 21-06 (loader integration) can return `atlasPath: null` for atlas-less mode.
- `SourceDims.source` discriminator now has the `'png-header'` variant — Plan 21-04 (synthesizer) can label atlas-less rows distinctly.
- `LoaderOptions.loaderMode?` is now an option — Plan 21-06 can branch on it for the D-08 force-atlas-less path.
- `SkeletonSummary.atlasPath: string | null` propagates the null across the IPC seam — renderer suppression of atlas-only UI affordances (Plan 21-07/08 territory) can branch on null cleanly.
- **Coordination note for wave merge with Plan 21-02:** Plan 21-02 also modifies `src/shared/types.ts` (adds `MissingImagesDirError` to the `SerializableError['kind']` union). Plan 21-05's edit is surgical — single-field nullability widening on `SkeletonSummary.atlasPath`. The two diffs touch different lines and should 3-way merge trivially.

## Self-Check: PASSED

All claims verified against the filesystem and git log:

- ✓ `src/core/types.ts` modified — contains `atlasPath: string | null`, `'png-header'`, `loaderMode?: 'auto' | 'atlas-less'`.
- ✓ `src/shared/types.ts` modified — `SkeletonSummary.atlasPath: string | null` present.
- ✓ `src/renderer/src/components/AppShell.tsx` modified — `summary.atlasPath ?? undefined` cascade fix at line 1053.
- ✓ `tests/core/loader.spec.ts` modified — non-null assertion at line 37.
- ✓ `tests/core/summary.spec.ts` modified — non-null assertion at line 52.
- ✓ Commit `1e17013` exists in git log (Task 1).
- ✓ Commit `211ac58` exists in git log (Task 2).
- ✓ `deferred-items.md` created at `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/deferred-items.md`.
- ✓ ProjectFileV1 / AppSessionState in `src/shared/types.ts` confirmed UNTOUCHED (no `loaderMode` field added — Plan 07 scope).

---
*Phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas*
*Completed: 2026-05-01*
