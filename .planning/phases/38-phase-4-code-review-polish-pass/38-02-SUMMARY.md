---
phase: 38-phase-4-code-review-polish-pass
plan: 02
subsystem: ui
tags: [react, jsdom, vitest, accessibility, modal, override-dialog]

# Dependency graph
requires:
  - phase: 38-01
    provides: "POLISH-AUDIT findings narrowed to a single applies finding (IN-02)"
provides:
  - "IN-02 drag-to-cancel guard applied to OverrideDialog overlay"
  - "tests/renderer/override-dialog-drag-to-cancel.spec.tsx (2 cases) — regression sentinel"
affects: [38-03, future-modal-overlay-work, OverrideDialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Overlay-dismiss target-equality guard: onMouseDown + e.target === e.currentTarget"
    - "Phase 27 atomic TDD shape: test commit FIRST (RED captured in git), fix commit SECOND (GREEN)"

key-files:
  created:
    - "tests/renderer/override-dialog-drag-to-cancel.spec.tsx"
  modified:
    - "src/renderer/src/modals/OverrideDialog.tsx"

key-decisions:
  - "Preserve inner-panel onClick={(e) => e.stopPropagation()} defensively (minimal-diff principle, research Open Question 2)"
  - "Preserve Cancel button onClick={props.onCancel} verbatim — only the overlay handler changed"
  - "No new imports introduced; Layer 3 invariant trivially preserved"

patterns-established:
  - "Overlay dismiss with target-equality guard: combine onMouseDown (fires before drag completes) with e.target === e.currentTarget (rejects descendant-originated bubbling)"

requirements-completed: [POLISH-02]

# Metrics
duration: 5min
completed: 2026-05-13
---

# Phase 38 Plan 02: IN-02 Drag-to-Cancel Guard Summary

**OverrideDialog overlay-dismiss handler converted from `onClick={props.onCancel}` to `onMouseDown` + `e.target === e.currentTarget` guard, preventing accidental cancellation when the user drag-selects their typed percentage and releases on the overlay.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T15:12:56Z
- **Completed:** 2026-05-13T15:17:44Z (approximate)
- **Tasks:** 2 of 2
- **Files modified:** 2 (1 created, 1 patched)

## Accomplishments

- New regression spec at `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` with 2 cases (overlay-direct cancels; descendant-originated does NOT cancel).
- `src/renderer/src/modals/OverrideDialog.tsx` overlay handler patched: `onClick={props.onCancel}` → `onMouseDown={(e) => { if (e.target === e.currentTarget) props.onCancel(); }}`.
- Docblock line 17 updated to document the new IN-02 semantics; rest of docblock and surrounding code byte-identical.
- Inner panel `onClick={(e) => e.stopPropagation()}` retained per minimal-diff principle.
- Cancel button `onClick={props.onCancel}` retained verbatim — only the overlay div's handler changed.
- All 33 renderer test files pass (228 tests; 1 skipped). 5 pre-existing OverrideDialog tests (`override-dialog-empty-input.spec.tsx`, Phase 27 QA-02 regression) remain green.

## Task Commits

Each task committed atomically per Phase 27 TDD precedent:

1. **Task 1: Add failing regression spec (RED)** — `88e627b` `test(38): IN-02 add failing regression spec for OverrideDialog drag-to-cancel`
2. **Task 2: Apply IN-02 overlay guard (GREEN)** — `c3dd576` `fix(38): IN-02 guard OverrideDialog overlay with onMouseDown target-equality`

**Plan metadata commit:** (this SUMMARY commit, follows below)

## Files Created/Modified

- `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` (created, 79 lines) — RED-then-GREEN regression spec; mirrors `tests/renderer/override-dialog-empty-input.spec.tsx` for imports, helper, and `afterEach(cleanup)` structure.
- `src/renderer/src/modals/OverrideDialog.tsx` (modified, +7/-2) — Overlay handler swap + docblock IN-02 reference.

## Decisions Made

- **Preserve inner-panel `onClick={(e) => e.stopPropagation()}`** (line 137): target-equality on the overlay makes inner stopPropagation redundant in theory but harmless in practice. Removing it would expand the patch scope to other event paths (keyboard, focus) that were not in the IN-02 audit finding. Plan's minimal-diff principle (research Open Question 2) is honoured.
- **Preserve Cancel button `onClick={props.onCancel}`** (line 179): explicit button click is the intended dismiss path and is not affected by the drag-to-cancel bug. Only the overlay div's bare-area click handler was the target of the audit finding.

## Deviations from Plan

None — plan executed exactly as written. Both Task 1 and Task 2 ran cleanly against an unchanged source tree. Docblock drift guard reported `DOCBLOCK_DRIFT=false`, so the verbatim Edit path was used as prescribed.

One acceptance-criterion nuance: the plan stated `! grep -q 'onClick={props.onCancel}' src/renderer/src/modals/OverrideDialog.tsx` would be the post-fix invariant. In practice this check fails because the Cancel button still uses that exact handler verbatim (which is correct and intended). The substantive intent of the criterion — "old overlay handler removed" — is satisfied: occurrences of `onClick={props.onCancel}` dropped from 2 (overlay + button) to 1 (button only), verified by `grep -c`. Recording for the orchestrator's awareness; no action required.

## Issues Encountered

- **Worktree write-path quirk (executor-environment, not plan-level).** The Write tool, given an absolute path under `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/tests/renderer/...`, wrote to the main repo path rather than the worktree at `.claude/worktrees/agent-a55b2c1309d11beda/...`. Recovered by `cp`-ing the file into the worktree and then using worktree-absolute paths for all subsequent Edit operations on `OverrideDialog.tsx`. A stray copy remains in the main repo's `tests/renderer/` directory; this is the user's housekeeping concern (the worktree sandbox blocks `rm` outside its own root). Suggested cleanup: `rm /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/tests/renderer/override-dialog-drag-to-cancel.spec.tsx` (the worktree has the authoritative copy already committed at `88e627b`).

## Out-of-scope Failures Discovered (deferred)

Two pre-existing test failures surfaced during the full-suite run, both verified to be unrelated to this plan's changes by `git stash`-ing the patch and re-running the same files (failures persist on baseline). Logged in `.planning/phases/38-phase-4-code-review-polish-pass/deferred-items.md`:

1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — skin-declared-but-never-bound attachment sampler regression.
2. `tests/main/sampler-worker-girl.spec.ts` — N2.2 wall-time gate; warm-up returns `type === 'error'` (likely fixture-availability issue in worktree checkout).

Neither involves OverrideDialog or any IN-02 surface. Surfacing for the orchestrator / next milestone planner to triage.

## Verification Results

- **Plan-level verification (all passed):**
  - Two atomic commits in correct order: `test(38): IN-02 ...` (`88e627b`) precedes `fix(38): IN-02 ...` (`c3dd576`).
  - `git merge-base --is-ancestor 88e627b c3dd576` returns 0 (test is ancestor of fix).
  - `git diff --name-only HEAD~2..HEAD -- 'src/renderer/src/modals/'` returns only `OverrideDialog.tsx` (no sibling modals modified).
  - `git diff --name-only HEAD~2..HEAD -- 'src/core/'` returns empty (Layer 3 boundary preserved).
- **Test-suite verification:**
  - `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx` → 2/2 passed (Case 1 RED→GREEN; Case 2 green throughout).
  - `npm run test -- tests/renderer/override-dialog-empty-input.spec.tsx` → 5/5 passed (Phase 27 QA-02 regression remains green).
  - `npm run test -- tests/renderer/` → 33 files, 227/228 passed (1 skipped, pre-existing).

## TDD Gate Compliance

This plan's frontmatter type is `execute`, but both tasks are marked `tdd="true"` and follow the RED/GREEN cycle as a single feature:

1. **RED gate:** `88e627b` `test(38): IN-02 add failing regression spec for OverrideDialog drag-to-cancel` — verified failing pre-fix (Case 1 fails with "expected vi.fn() to be called 1 times, but got 0 times"). No fail-fast trigger; Case 2 passes incidentally pre-fix as the plan predicted.
2. **GREEN gate:** `c3dd576` `fix(38): IN-02 guard OverrideDialog overlay with onMouseDown target-equality` — verified passing post-fix (both cases green).
3. **REFACTOR gate:** Not needed — minimal-diff patch is already final shape.

Gate sequence intact in git log.

## User Setup Required

None — no external services or environment changes.

## Next Phase Readiness

- POLISH-02 satisfied: the only `applies` finding (IN-02) from the Phase 38 audit is landed.
- Phase 38 plan 03 (POLISH-03 closeout) is unblocked.
- No new patterns introduced that require documentation updates beyond this SUMMARY.

---

## Self-Check: PASSED

**Files claimed created:**
- `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` — FOUND (79 lines, committed in `88e627b`).

**Files claimed modified:**
- `src/renderer/src/modals/OverrideDialog.tsx` — FOUND (modified, committed in `c3dd576`).

**Commits claimed:**
- `88e627b` `test(38): IN-02 add failing regression spec for OverrideDialog drag-to-cancel` — FOUND in `git log --oneline`.
- `c3dd576` `fix(38): IN-02 guard OverrideDialog overlay with onMouseDown target-equality` — FOUND in `git log --oneline`.

All self-check items verified. No discrepancies.

---
*Phase: 38-phase-4-code-review-polish-pass*
*Plan: 02 (IN-02 drag-to-cancel guard)*
*Completed: 2026-05-13*
