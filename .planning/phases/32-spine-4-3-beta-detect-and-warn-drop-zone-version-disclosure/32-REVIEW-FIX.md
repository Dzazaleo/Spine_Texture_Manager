---
phase: 32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure
fixed_at: 2026-05-10T17:28:00Z
review_path: .planning/phases/32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure/32-REVIEW.md
iteration: 1
findings_in_scope: 1
fixed: 1
skipped: 0
status: all_fixed
---

# Phase 32: Code Review Fix Report

**Fixed at:** 2026-05-10
**Source review:** `.planning/phases/32-spine-4-3-beta-detect-and-warn-drop-zone-version-disclosure/32-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope (critical + warning): 1
- Fixed: 1
- Skipped: 0

Phase 32's REVIEW.md surfaced 0 critical / 1 warning / 3 info findings. Per `fix_scope: critical_warning`, only the warning (WR-01) was in scope. Info findings (IN-01 stale line reference, IN-02 atlas page PNG name mismatch, IN-03 docblock-vs-coverage gap) were deferred per scope and remain documented in REVIEW.md for a future polish pass.

## Fixed Issues

### WR-01: Vacuous-pass test — `try/catch` without preceding `toThrow()` guard

**Files modified:** `tests/core/loader-43-schema-guard-predicate.spec.ts`
**Commit:** `0c1cdf6`
**Applied fix:** Added `expect(() => checkSpine43Schema({ constraints: [] }, SKEL)).toThrow(SpineVersionUnsupportedError);` as the first assertion inside the "Rejection error carries detectedVersion === '4.3-schema' (sentinel)" test, immediately before the existing `try/catch` block. This matches the well-formed pattern in `tests/core/loader-version-guard-predicate.spec.ts:42-50` and ensures the test fails fast if the predicate ever silently stops throwing — closing the vacuous-pass hole that would have left the `'4.3-schema'` sentinel routing key untested at the predicate level.

The two `expect()` calls inside the existing `catch` block were preserved unchanged; they continue to assert the error's `detectedVersion === '4.3-schema'` and `skeletonPath === SKEL` properties. The fix is purely additive — one line of new throw-guard, zero deletions.

**Verification:**
- Tier 1: Re-read modified file at lines 76-84; throw-guard present, surrounding code intact.
- Tier 2 (focused): `npx vitest run tests/core/loader-43-schema-guard-predicate.spec.ts` — 11 passed (11). `npx vitest run` over all four Phase 32 test files (`loader-43-schema-guard-predicate`, `loader-version-guard-predicate`, `loader-version-guard`, `errors-version`) — 54 passed (54).
- Tier 2 (full suite): `npm test` run from the main worktree (where local-only fixtures `fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/` exist) with the modified test file in place — 91 test files passed (91), 999 tests passed, 0 failures.
- The same `npm test` run inside the isolated worktree showed 2 unrelated failures, both `SkeletonJsonNotFoundError` for the gitignored local-only fixtures missing from the worktree filesystem; these are environmental (worktree fixture-presence) and not regressions caused by this fix. Baseline `npm test` in the main worktree before applying the fix was identical (91/91, 999 passed).

## Skipped Issues

None — the single in-scope finding was fixed cleanly.

## Out-of-Scope Findings (deferred — Info)

The following findings from REVIEW.md were not addressed in this run because `fix_scope` is `critical_warning`. They remain open in REVIEW.md and can be picked up in a future polish pass:

- **IN-01** — Stale line reference in `tests/core/loader-version-guard.spec.ts:153` comment (says "line 82-89", actual location is "line 91-98").
- **IN-02** — Atlas page PNG name (`SPINE_4_3_TEST.png`) does not match any present file in `fixtures/SPINE_4_3_TEST/` (only `images/SQUARE.png` is present). Same inconsistency exists in the 3.8 fixture per established convention; harmless today (version guard fires before atlas resolution) but a latent regression hazard.
- **IN-03** — Docblock at `src/core/loader.ts:240-244` overstates `checkSpine43Schema`'s coverage envelope; the predicate cannot catch a 4.3 export with missing/malformed `skeleton.spine` because `checkSpineVersion` throws first. Recommend tightening the docblock (low-risk option a) over restructuring loader ordering (option b would change Phase 12 F3 error-message contract).

---

_Fixed: 2026-05-10_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
