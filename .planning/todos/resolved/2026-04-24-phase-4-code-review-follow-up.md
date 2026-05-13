---
created: 2026-04-24T16:17:43.663Z
title: Phase 4 code review follow-up — WR-03 + 6 info findings
area: ui
resolves_phase: 38
files:
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx:493-540
  - src/renderer/src/modals/OverrideDialog.tsx
  - .planning/phases/04-scale-overrides/04-REVIEW.md
---

## Problem

Phase 4 code review (commit `e981400`) surfaced 9 findings. WR-01 (dialog prefill
clamp for peakScale > 1.0 bones like SIMPLE_TEST's SQUARE2) and WR-02 (redundant
`autoFocus` on Apply button conflicting with `useEffect` input focus) were fixed
inline at phase close. The remaining 7 are deferred polish items — none are
correctness bugs, but they should be swept during the Phase 5/6 polish pass to
keep code hygiene high.

Deferred findings:

- **WR-03** ([GlobalMaxRenderPanel.tsx:493-540](src/renderer/src/panels/GlobalMaxRenderPanel.tsx#L493-L540)):
  `handleToggleRow` + `handleRangeToggle` capture `selected` via closure.
  Switch to functional `setSelected(prev => ...)` updater — safer idiom against
  fast keyboard-event races, and lets `useCallback` drop the `selected`
  dependency.

- **IN-01** (OverrideDialog.tsx keyDown comment): Comment claims browsers trap
  Tab inside `role="dialog"` modals. They don't — focus can escape to the panel
  behind. Either reword the comment to flag the known gap or add a ~15-line
  focus-trap implementation.

- **IN-02** (OverrideDialog.tsx drag-to-cancel): Mouse-down on the inner panel
  then mouse-up on the overlay can close the dialog unexpectedly. Track
  mouse-down target and only close if both down + up are on the overlay.

- **IN-03** (OverrideDialog.tsx empty input): Empty string → `Number("")` = 0
  → clampOverride floors to 1 silently. Either disable Apply when input is
  empty, or show inline validation.

- **IN-04** (GlobalMaxRenderPanel.tsx highlightMatch): Substring-match highlight
  code is duplicated from SearchBar.tsx. Consider extracting to a shared
  renderer util (`src/renderer/src/lib/`). Intentional per Phase 2 pattern;
  flagging only as a future DRY candidate.

- **IN-05** (GlobalMaxRenderPanel.tsx sort comparator): `localeCompare` called
  without locale options. Add `{ sensitivity: 'base', numeric: true }` so
  `CHAIN_10` sorts after `CHAIN_9`.

- **IN-06** (OverrideDialog.tsx dead guard): `if (!props.open) return null` is
  unreachable — AppShell conditionally mounts/unmounts the dialog. Remove dead
  branch + drop the `open` prop entirely.

Full line-numbered detail with each finding's reasoning and suggested fix in
the REVIEW.md artifact.

## Solution

Run `/gsd-code-review-fix 4` to auto-apply the 7 items via fixer agent with
atomic commits — after Phase 5 or 6 ships, during the next natural polish
window. Or fold into a dedicated "UI polish" phase if one materializes.

None of these block Phase 4 closure — code review is advisory and WR-01 +
WR-02 (the only user-visible items) are already fixed.

---

## Resolved

2026-05-13 — Phase 38 (POLISH-01..03): audit at `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` enumerated all 7 deferred findings against current code. Net outcome:
  - **1 applies** (IN-02 drag-to-cancel overlay guard) — fixed in `src/renderer/src/modals/OverrideDialog.tsx` via `onMouseDown` + `e.target === e.currentTarget` guard; regression spec at `tests/renderer/override-dialog-drag-to-cancel.spec.tsx`.
  - **5 no-ops** — IN-01 (Phase 6 Gap-Fix R6, commit `5551073` — focus trap via shared `useFocusTrap` hook), IN-03 (Phase 27 QA-02, commit `fb3fedc` — empty-input guard), IN-05 (Phase 27 QA-03, commit `01468e4` — natural-order localeCompare), IN-06 (Phase 27 QA-04, commit `cf098e0` — dead `open` prop removed), WR-03 (Phase 27 QA-01, commit `f7668c4` — functional `setSelected` updater).
  - **1 skip** — IN-04 (`highlightMatch` duplication between `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx`) intentional per Phase 2/3 self-contained-panel pattern; no third consumer triggers the documented extraction threshold. Note: the original todo line 42-45 phrased the duplication as "from SearchBar.tsx" — that was a slip; the actual duplication sites are the two panels, as the 38-01 audit records.
