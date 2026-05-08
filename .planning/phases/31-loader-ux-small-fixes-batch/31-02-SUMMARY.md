---
phase: 31-loader-ux-small-fixes-batch
plan: 02
subsystem: ui
tags: [react, useState, panel, animation-breakdown, bulk-actions, tailwind-v4, tdd]

# Dependency graph
requires:
  - phase: 03-per-animation-breakdown-cards-panel
    provides: AnimationBreakdownPanel + setup-pose seed at line 344
  - phase: 09-virtualization-and-perf
    provides: Per-card inner-row virtualization (preserved unchanged)
  - phase: 19-ui-improvements
    provides: Lifted SearchBar query state + h-8 toolbar button class string
  - phase: 22-seed-002-dims-badge-override-cap
    provides: DimsBadge primitive (preserved unchanged)
provides:
  - Default-collapsed Animation Breakdown panel on initial mount and project reload
  - Expand all / Collapse all bulk buttons in panel header
  - allCardIds memo (absolute, summary.animationBreakdown-derived)
affects:
  - phase 32+ ui polish — bulk action pattern reusable in future panel headers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PANEL-09 lock: panel-internal collapse/expand state stays in-memory React state; no .stmproj persistence"
    - "Bulk-action right-cluster header layout: ml-auto wrapper holds [count, Expand all, Collapse all] with gap-2"
    - "Verbatim h-8 toolbar class string copied byte-for-byte from AppShell.tsx:1791 (Pitfall 8 literal-class discipline)"

key-files:
  created: []
  modified:
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx
    - tests/renderer/anim-breakdown-virtualization.spec.tsx
    - tests/renderer/dims-badge-tooltip.spec.tsx

key-decisions:
  - "Default seed flipped from new Set(['setup-pose']) to new Set() — superseded D-63/D-64 static-pose-expanded seed (PANEL-08)"
  - "Bulk buttons hidden (not disabled) when summary.animations.count === 0, per UI-SPEC §sub-feature B recommendation"
  - "allCardIds derived from summary.animationBreakdown (NOT filteredCards) — bulk actions are absolute, not filter-scoped (B-D-04)"
  - "Search auto-expand union at lines 376-382 preserved byte-identical — bulk Collapse all does not break the union behavior"
  - "Existing tests that depended on the old default-expanded seed updated to manually expand the setup-pose card (Rule 1 deviation)"

patterns-established:
  - "Panel-header right-cluster wrapper for [count + tertiary actions] using ml-auto + flex gap-2"

requirements-completed: [PANEL-08, PANEL-09, PANEL-10, PANEL-11]

# Metrics
duration: 7.7min
completed: 2026-05-08
---

# Phase 31 Plan 02: Animation Breakdown collapse defaults + bulk Expand all/Collapse all Summary

**Default-collapsed Animation Breakdown panel with absolute bulk Expand all/Collapse all buttons, in-memory React state only, search-union behavior preserved verbatim.**

## Performance

- **Duration:** 7.7 min (465 s)
- **Started:** 2026-05-08T15:56:35Z
- **Completed:** 2026-05-08T16:04:20Z (approx — final commit timestamp)
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 3

## Accomplishments

- `userExpanded` initial seed flipped from `new Set(['setup-pose'])` to `new Set()` — every card (Setup Pose + animations) now starts collapsed on initial mount and on project reload via panel-unmount.
- `Expand all` / `Collapse all` buttons land in the panel header right cluster with the verbatim `h-8` toolbar class string (Pitfall 8 literal-class discipline preserved — copy-paste from `AppShell.tsx:1791`, no factoring, no template interpolation).
- `allCardIds` `useMemo` computed from `summary.animationBreakdown` (NOT `filteredCards`) so bulk Expand all is absolute across search-clear (B-D-04 contract).
- Search auto-expand union (`effectiveExpanded = userExpanded ∪ matched`) at lines 376-382 preserved byte-identical — bulk Collapse all sets `userExpanded` to empty, but matched cards still surface during active search via the union.
- Buttons hidden when `summary.animations.count === 0` (per UI-SPEC §sub-feature B recommendation: hide rather than disable).
- 7 new behavioral tests B1..B7 cover PANEL-08/09/10/11 and B-D-04; 14/14 tests pass in `anim-breakdown-virtualization.spec.tsx`; 193/193 renderer tests green; renderer typecheck (`npm run typecheck:web`) exits 0.

## Task Commits

1. **Task 1 (RED): add behavioral tests B1..B7** — `7eae6a6` (test)
2. **Task 1 (GREEN): collapse defaults + bulk Expand all/Collapse all** — `28269dd` (feat)

_Note: Single-task plan with TDD substeps — RED (failing tests committed first), then GREEN (implementation + existing-test fixups committed together)._

## Files Created/Modified

- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — Flipped `userExpanded` seed to `new Set()`; added `allCardIds` `useMemo`; added Expand all / Collapse all bulk buttons inside the header right cluster wrapper.
- `tests/renderer/anim-breakdown-virtualization.spec.tsx` — Added the 7-test `Phase 31 PANEL-08..11` describe block; updated 4 existing tests (inner-virt, collapse/re-expand, override, DIMS-02 dims-mismatch badge ×3) to manually expand the setup-pose card after render.
- `tests/renderer/dims-badge-tooltip.spec.tsx` — Updated 1 G-02 sibling-symmetric test to expand the setup-pose card before exercising the dims-badge tooltip.

## Decisions Made

- **Hide bulk buttons on empty rig (PANEL-10 + UI-SPEC § sub-feature B):** Buttons are wrapped in `{summary.animations.count > 0 && (<>...</>)}`; the empty-rig `disabled:opacity-50` alternate path was not adopted — hiding is cleaner and matches the existing AnimationBreakdownPanel empty-state idiom.
- **`allCardIds` source-of-truth = `summary.animationBreakdown`** (not `filteredCards`) — locks the absolute, not-filter-scoped semantics required by B-D-04. Verified by acceptance grep: `grep -n "summary.animationBreakdown" | grep -v "originalById\|enrichedCards"` shows the memo derivation cleanly.
- **Did not edit the doc-comment block at lines 24-27** (search-as-discovery affordance) — the comment is still accurate after PANEL-08 (search reveals matched cards even when collapsed by default). Plan permitted edit only if "directly contradicts the new behavior"; nothing contradicts.
- **Wrapped header right cluster in a single `<div className="ml-auto flex items-center gap-2">`** rather than putting `ml-auto` on each child — matches UI-SPEC §sub-feature B header layout contract and avoids double-pushing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated 4 existing tests broken by the seed flip**
- **Found during:** Task 1 GREEN (running existing test suite after the seed-flip)
- **Issue:** Four pre-existing tests (`inner above threshold` / `collapse/re-expand` / `override-clicks-virtualized-row` in `anim-breakdown-virtualization.spec.tsx`, plus the G-02 sibling-symmetric `AnimationBreakdownPanel badge fires deterministically` in `dims-badge-tooltip.spec.tsx`) asserted that the setup-pose card body was rendered immediately after mount, relying on the old `new Set(['setup-pose'])` default seed. After the PANEL-08 flip, the card body is collapsed at mount, so those assertions broke.
- **Fix:** Added a single `fireEvent.click(expandToggle)` step after `render(...)` in each of the 4 tests to manually expand the setup-pose card. Did not change any test's actual contract — only the precondition (card now requires explicit expand) is updated. Wrapped the DIMS-02 describe block's three tests in a small `expandSetupPose(container)` helper to keep duplication minimal.
- **Files modified:** `tests/renderer/anim-breakdown-virtualization.spec.tsx`, `tests/renderer/dims-badge-tooltip.spec.tsx`
- **Verification:** `npx vitest run tests/renderer/` — 193 passed, 2 skipped, 0 failed.
- **Committed in:** `28269dd` (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — pre-existing tests broken by required seed change)
**Impact on plan:** No scope creep. The test edits were the minimum surface needed to keep existing behavioral coverage green after the plan-required seed flip.

## Issues Encountered

- **Initial B4/B5 test scope error (resolved during GREEN):** The B4 and B5 test bodies originally counted `screen.queryAllByText(/-attachment-0000$/)` to verify expanded card row counts. The bonePath cell happens to end with the same attachmentName text, so each row contributed 2 matches and the assertion `.toBe(3)` saw 6 instead. Fixed by switching to `aria-expanded` toggle assertions (one per card section), which is semantically the correct check and decouples the test from internal cell text. No production code change.
- **Pre-existing test failures unrelated to this plan:** `tests/main/sampler-worker-girl.spec.ts` and `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` fail in the worktree due to missing fixtures (`fixtures/Girl/`, `fixtures/SAMPLER_ALPHA_ZERO/`) that are not present in this checkout. Out of scope per Rule "SCOPE BOUNDARY"; not caused by this plan's changes.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All four PANEL-* requirements (PANEL-08, PANEL-09, PANEL-10, PANEL-11) closed at the code level. HUMAN-UAT can verify visually:
  - Load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (or any rig with multiple animations).
  - Switch to AB tab — confirm all cards collapsed including Setup Pose.
  - Click "Expand all" — every card opens.
  - Click "Collapse all" — every card closes.
  - Type a search query while collapsed — matched cards auto-expand (search union preserved).
  - Reload project — all cards collapsed again (panel-unmount → seed re-runs).
- No blockers for sibling Plan 31-01 (Sub-feature A — source-toggle disable) or 31-03 (Sub-feature C — Windows admin DnD) or 31-04 (Sub-feature D — TOOLTIP-01); these are wave-parallel and depend on different files.

## Self-Check

Verifying all claims are accurate:

**Files exist:**
- FOUND: `src/renderer/src/panels/AnimationBreakdownPanel.tsx`
- FOUND: `tests/renderer/anim-breakdown-virtualization.spec.tsx`
- FOUND: `tests/renderer/dims-badge-tooltip.spec.tsx`

**Commits exist:**
- FOUND: `7eae6a6` (test RED)
- FOUND: `28269dd` (feat GREEN)

**Acceptance criteria greps:**
- Old seed gone: `grep -n "new Set(\['setup-pose'\])" src/renderer/src/panels/AnimationBreakdownPanel.tsx` → 0 hits ✓
- New empty seed: `grep -n "new Set()" src/renderer/src/panels/AnimationBreakdownPanel.tsx` → 2 hits (≥1 required) ✓
- "Expand all" hits: 4 (≥2 required) ✓
- "Collapse all" hits: 2 (≥2 required) ✓
- Verbatim h-8 class string occurrences: 2 (≥2 required) ✓
- `allCardIds` hits: 2 (≥2 required) ✓
- `summary.animations.count > 0` hits: 1 (≥1 required) ✓
- `allCardIds` derives from `summary.animationBreakdown`, NOT `filteredCards` — verified by reading the memo body.
- Search auto-expand union code preserved byte-identical at the new line offsets (392-398) — verified by `grep -n "effectiveExpanded"` and reading the surrounding code.

## Self-Check: PASSED

---
*Phase: 31-loader-ux-small-fixes-batch*
*Completed: 2026-05-08*
