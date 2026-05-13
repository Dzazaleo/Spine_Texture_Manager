# Phase 38: Phase 4 Code-Review Polish Pass — Pattern Map

**Mapped:** 2026-05-13
**Files analyzed:** 4 (1 modify, 1 create, 1 audit doc, 1 todo move)
**Analogs found:** 3 strong + 1 partial / 4

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/renderer/src/modals/OverrideDialog.tsx` (modify) | component (modal) | event-driven (DOM mouse events) | itself — lines 122-129 (current overlay handler) | self / exact |
| `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` (create) | test | event-driven | `tests/renderer/override-dialog-empty-input.spec.tsx` | exact (same dialog, same test family) |
| `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` (create) | audit-doc | n/a | none — research's IN-NN audit table IS the source schema | no-analog (use research) |
| `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` (move + append) | todo close-out | n/a | `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` | exact (resolved-todo close-out format) |

## Pattern Assignments

### `src/renderer/src/modals/OverrideDialog.tsx` (component, event-driven) — IN-02 patch

**Analog:** itself. Sibling modals (`ConflictDialog.tsx:115`, `SettingsDialog.tsx:168`, `SaveQuitDialog.tsx:102`) all use the same `onClick={props.onCancel}` overlay pattern — i.e. **no existing overlay-mousedown guard pattern exists in the codebase**. This patch introduces it for the first time. Sibling-modal scope is INTENTIONALLY out of this phase (research Pitfall 5 + scope guardrail: IN-02 surface is `OverrideDialog.tsx` only).

**Imports pattern** (unchanged — no new imports needed; `KeyboardEvent` already present, no `MouseEvent` typing required because the inline handler infers from JSX):

```typescript
// OverrideDialog.tsx:54-55 — existing, do NOT touch
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';
```

**Current overlay handler** (`OverrideDialog.tsx:121-129`) — THE patch surface:

```tsx
return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="override-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={props.onCancel}                                // ← lines 128
  >
```

**Patch shape — minimal-diff, target-equality guard** (replaces only line 128):

```tsx
return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="override-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onMouseDown={(e) => {
      if (e.target === e.currentTarget) props.onCancel();
    }}
  >
```

**Inner-panel handler** (`OverrideDialog.tsx:130-134`) — keep AS-IS per research Open Question 2 (minimal-diff principle; inner `onClick={(e) => e.stopPropagation()}` remains defensive):

```tsx
<div
  className="bg-modal border border-border rounded-md p-6 min-w-[360px] font-mono shadow-2xl"
  onClick={(e) => e.stopPropagation()}                       // ← keep
  onKeyDown={keyDown}
>
```

**Docblock update** — research notes the existing docblock (lines 17-25) describes Phase 6 Gap-Fix Round 6 focus-trap behavior with the phrase "overlay click closes (discards)" (line 17). The planner SHOULD update that one phrase to "overlay mousedown-on-overlay closes (discards) — drag-to-cancel guarded via `e.target === e.currentTarget`" or similar one-line tweak referencing IN-02 + Phase 38. The rest of the docblock is unchanged. Minimal-diff: 1 phrase, 1 commit-message cross-reference.

**Error handling / validation patterns:** none — pure DOM event handler change, no error paths, no async. The `e.target === e.currentTarget` IS the entire validation.

---

### `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` (test, event-driven) — IN-02 regression spec

**Analog:** `tests/renderer/override-dialog-empty-input.spec.tsx` (98 lines, same dialog under test, same test family, same vitest+RTL stack).

**Header + environment directive** (lines 1-23):

```tsx
// @vitest-environment jsdom
/**
 * Phase 27 QA-02 — empty-input Apply guard for OverrideDialog.
 * [...docblock describing falsifying behavior, lifecycle context, history...]
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  OverrideDialog,
  type OverrideDialogProps,
} from '../../src/renderer/src/modals/OverrideDialog';
```

**`afterEach(cleanup)` + render helper pattern** (lines 24-42) — copy verbatim, adjust `describe` label:

```tsx
afterEach(cleanup);

function renderDialog(overrides: Partial<OverrideDialogProps> = {}) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <OverrideDialog
      scope={['SQUARE']}
      currentPercent={50}
      anyOverridden={false}
      onApply={onApply}
      onClear={onClear}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { ...utils, onApply, onClear, onCancel };
}
```

**Test-case shape — RED/GREEN comment style** (lines 44-97) — mirror this discipline; each `it()` block includes both the pre-fix (RED diagnostic) and post-fix (GREEN expected) assertion when applicable:

```tsx
describe('OverrideDialog — empty input guard (QA-02)', () => {
  it('disables Apply when input is empty', () => {
    const { onApply } = renderDialog();
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    const applyBtn = screen.getByRole('button', { name: /^Apply$/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(applyBtn);
    expect(onApply).not.toHaveBeenCalled();
  });
  // [...four more cases following same structure...]
});
```

**Specific element queries for the drag-to-cancel spec** — the analog establishes these conventions:

- Overlay = the root `<div role="dialog">` → query via `screen.getByRole('dialog')`.
- Inner panel = no role → query via the input inside it (`screen.getByRole('spinbutton')`) and use `.parentElement` if the panel ref is needed, OR fire directly on the input (which is a child of the panel, so its target ≠ currentTarget when the event reaches the overlay).
- Buttons → `screen.getByRole('button', { name: /^Apply$/ })` (already used in analog line 49).

**Two-case shape recommended by research** (one positive, one negative):

```tsx
describe('OverrideDialog — drag-to-cancel guard (IN-02)', () => {
  it('mousedown directly on overlay still cancels', () => {
    const { onCancel } = renderDialog();
    const overlay = screen.getByRole('dialog');
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('mousedown originating inside the panel does NOT cancel', () => {
    const { onCancel } = renderDialog();
    const input = screen.getByRole('spinbutton');
    // mousedown on the input → e.target === input, e.currentTarget === overlay → guard rejects
    fireEvent.mouseDown(input);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
```

**Falsifying-spec discipline** — analog header docblock (lines 2-16) describes the RED state ("today, clearing the input ... calls onApply(NaN)") and the GREEN expectation. The drag-to-cancel spec should mirror this: header docblock should describe the RED state ("today, onClick on overlay fires on any mouseup, including drag-out of typed text → onCancel discards user input") and the GREEN expectation ("after IN-02 fix, only direct mousedown-on-overlay cancels; drag-out is a no-op"). Add this as the test file's leading docblock.

---

### `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` (audit-doc) — POLISH-01 deliverable

**Analog:** **no direct analog**. Existing candidates were considered and rejected:

| Candidate | Why not |
|-----------|---------|
| `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` | Different schema — that audit enumerates Spine 4.2 features (RGBA2Timeline, InheritTimeline, etc.) with source-code line-citations from `spine-core/dist/Animation.js`. POLISH-AUDIT enumerates code-review findings (IN-01..06 + WR-03) with verdict + sweeping-phase commit. Different domain, different fields. |
| `.planning/phases/37-*/37-01-audit-rgba2-inherit-PLAN.md` | This is a PLAN.md not the audit output. |
| `.planning/milestones/v1.4-phases/35-region-keyed-export-plan/35-03-atlas-preview-consumer-audit-PLAN.md` | Same — a PLAN, not the audit output. |

**Source schema:** the planner derives the document structure directly from `38-RESEARCH.md` lines 38-147 — the per-finding subsections AND the closing "Audit Summary" table (lines 138-147) ARE the audit content. The audit doc is essentially a copy-edit of the research's IN-NN audit section into a stand-alone artifact with:

1. **Frontmatter:** phase number, date (2026-05-13), source-review live path (`.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md` — research Pitfall 1 corrects the archived path), summary verdict table.
2. **Per-finding sections (`### IN-NN`):** verdict / evidence (current-code file:line) / sweeping phase + commit (`no-op`) OR fix-shape (`applies`) OR intent quote (`skip`).
3. **Closing summary:** "1 of 7 findings still applies (IN-02). 5 no-ops swept by Phase 6 / Phase 27. 1 explicit skip (IN-04 by Phase 2/3 intent)."

**Recommended frontmatter shape** (consistent with other planning artifacts):

```markdown
# Phase 38 — Phase 4 Code-Review Polish Audit

**Audit date:** 2026-05-13
**Source review:** `.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md` (live path — `04-REVIEW.md` was archived at v1.0→v1.1 cutover; the `phases/04-scale-overrides/` path in REQUIREMENTS.md is stale)
**Findings audited:** IN-01..IN-06 + WR-03 (7 total)
**Summary:** 1 applies (IN-02), 5 no-op (swept by Phase 6 Gap-Fix R6 / Phase 27 QA-01..04), 1 skip (IN-04, intentional duplication per Phase 2/3 pattern)
```

**Closing-summary table** (copy from research lines 138-147):

```markdown
| Finding | Verdict | Sweeping phase / commit | Action in Phase 38 |
|---------|---------|--------------------------|---------------------|
| IN-01 focus trap | no-op | Phase 6 Gap-Fix R6 / `5551073` | Document; no code change |
| IN-02 drag-to-cancel | applies | — | ~3-line patch + new test |
| IN-03 empty-input guard | no-op | Phase 27 QA-02 / `fb3fedc` | Document; no code change |
| IN-04 highlightMatch DRY | skip | Phase 2/3 intentional duplication | Document rationale; no code change |
| IN-05 sort locale options | no-op | Phase 27 QA-03 / `01468e4` | Document; no code change |
| IN-06 dead `open` prop | no-op | Phase 27 QA-04 / `cf098e0` | Document; no code change |
| WR-03 functional setSelected | no-op | Phase 27 QA-01 / `f7668c4` | Document; no code change |
```

**Pitfall reminder for the planner:** the audit doc MUST cite the live `04-REVIEW.md` path (`.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md`) — NOT the archived path in REQUIREMENTS.md POLISH-01 (`.planning/phases/04-scale-overrides/04-REVIEW.md`). Research Pitfall 1.

**Pitfall reminder 2:** IN-04 source-of-truth is the two PANELS (`GlobalMaxRenderPanel.tsx:283-298` + `AnimationBreakdownPanel.tsx:302-317`), NOT `SearchBar.tsx`. Research Pitfall 2 — the Phase 38 task spec wording is a slip.

---

### `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` → `resolved/` (todo close-out) — POLISH-03

**Analog:** `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` (80 lines, recently-resolved todo with documented close-out format).

**Close-out structural pattern** (analog lines 73-79):

```markdown
[existing content unchanged above this point]

---

## Resolved

2026-04-28 — Phase 13 Plan 02: [one-paragraph summary of the resolving phase's outcome — what changed, where, why, and any explicit deferrals or carry-forwards]. [Final sentence noting non-rewrites / preserved history if relevant.]
```

**Key conventions extracted:**

1. **Separator:** ` --- ` line between existing content and the new section.
2. **Heading:** `## Resolved` (h2, exact wording).
3. **Date prefix:** ISO date (`2026-05-13`) — em-dash — phase reference (`Phase 38 (POLISH-01..03)`) — colon — narrative.
4. **Narrative shape:** one paragraph; cite the audit doc path, list each finding's outcome (1 applies + 5 no-ops + 1 skip) with commit SHAs for the no-ops, end with the intent quote for the skip.
5. **No file moves with rename:** the resolved-todo retains the original date-prefixed filename (`2026-04-24-phase-4-code-review-follow-up.md` stays as the basename when moved into `resolved/`).
6. **Existing content untouched:** the original problem / deferred-findings list above the `---` separator stays byte-identical.

**Recommended close-out body** (per research lines 425-432 — already drafted, planner copies verbatim, regenerates commit SHAs against actual git log at execution time):

```markdown
---

## Resolved

2026-05-13 — Phase 38 (POLISH-01..03): audit at `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` enumerated all 7 deferred findings against current code. Net outcome:
  - **1 applies** (IN-02 drag-to-cancel overlay guard) — fixed in `src/renderer/src/modals/OverrideDialog.tsx` via `onMouseDown` + `e.target === e.currentTarget` guard; regression spec at `tests/renderer/override-dialog-drag-to-cancel.spec.tsx`.
  - **5 no-ops** — IN-01 (Phase 6 Gap-Fix R6, commit `5551073` — focus trap via shared `useFocusTrap` hook), IN-03 (Phase 27 QA-02, commit `fb3fedc` — empty-input guard), IN-05 (Phase 27 QA-03, commit `01468e4` — natural-order localeCompare), IN-06 (Phase 27 QA-04, commit `cf098e0` — dead `open` prop removed), WR-03 (Phase 27 QA-01, commit `f7668c4` — functional `setSelected` updater).
  - **1 skip** — IN-04 (`highlightMatch` duplication between `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx`) intentional per Phase 2/3 self-contained-panel pattern; no third consumer triggers the documented extraction threshold.
```

**Git move semantics** (user is git-beginner per memory `user_git_experience` + `feedback_explain_git`):

- `git mv .planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md .planning/todos/resolved/2026-04-24-phase-4-code-review-follow-up.md`
- Then append the `## Resolved` section via the Edit tool (Read first, then Edit — do not Write the whole file).
- Single commit (`chore(38): close phase-4-code-review-follow-up todo (POLISH-03)`) captures both the rename and the append in one atomic change.

---

## Shared Patterns

### Atomic per-finding commit pattern
**Source:** Phase 27 history (research lines 182-184) — `6a4efe9 test(27-02): add failing regression spec ...` → `fb3fedc fix(27-02): guard OverrideDialog ...`.

**Apply to:** IN-02 plan only (POLISH-02). The single `applies` finding lands as a test-first split:

```
1. test(38): IN-02 add failing regression spec for OverrideDialog drag-to-cancel
2. fix(38): IN-02 guard OverrideDialog overlay with onMouseDown target-equality
```

Optional collapse to one commit allowed under scope pressure (research Open Question 1). Recommend the split — matches project precedent.

### Tailwind v4 literal-class discipline
**Source:** `OverrideDialog.tsx:26-28` docblock (Pitfall 8 reference).
**Apply to:** Any JSX change in this phase.
**Constraint:** Every `className` is a string literal. No template interpolation, no concatenation. The IN-02 patch is event-handler only — no `className` change required → constraint trivially satisfied.

### Layer-3 renderer-boundary invariant
**Source:** `OverrideDialog.tsx:48-53` docblock.
**Apply to:** Any new imports in this file (none expected for IN-02).
**Constraint:** This file imports only React + type-only React keyboard-event typing. It never reaches into the pure-TS math tree. `tests/arch.spec.ts` renderer-boundary grep auto-scans on every test run. The IN-02 patch adds no imports → constraint trivially satisfied.

### Falsifying-spec test discipline
**Source:** `override-dialog-empty-input.spec.tsx:2-16` (header docblock) + lines 90-97 (per-case RED/GREEN comments).
**Apply to:** `override-dialog-drag-to-cancel.spec.tsx` (new file).
**Pattern:** Header docblock names the RED state (current bug behavior) and the GREEN expectation (post-fix behavior). Each `it()` block carries an inline RED/GREEN comment for any case where the pre-fix path produces a different but specific wrong value (e.g. "Pre-fix (RED): onCancel called on drag-out → user input discarded; Post-fix (GREEN): onCancel not called → input preserved").

### Resolved-todo close-out narrative shape
**Source:** `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md:73-79`.
**Apply to:** `2026-04-24-phase-4-code-review-follow-up.md` (POLISH-03 move).
**Constraint:** Append below existing content with `---` separator + `## Resolved` h2 + date-prefixed paragraph citing audit-doc path and per-finding outcomes.

## No Analog Found

| File | Role | Reason |
|------|------|--------|
| `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` | audit-doc | No prior code-review polish-audit doc in `.planning/`. The existing `SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` is a different domain (Spine source audit, not code-review findings). Planner derives schema directly from `38-RESEARCH.md` IN-NN audit table (lines 38-147) which already enumerates per-finding verdict + evidence + commit refs. |

## Metadata

**Analog search scope:**
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/src/modals/` (all 9 dialogs grepped for `onMouseDown` + `currentTarget` — none found; IN-02 introduces the pattern)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/src/renderer/` (no `e.target === e.currentTarget` anywhere)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/tests/renderer/` (override-dialog-empty-input.spec.tsx is the closest test analog — same dialog, same family)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/todos/resolved/` (close-out format extracted from electron-updater example)
- `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/` (audit-doc search — only `SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` exists; different domain)

**Files read in full or via targeted ranges:**
- `src/renderer/src/modals/OverrideDialog.tsx` (196 lines, full read)
- `tests/renderer/override-dialog-empty-input.spec.tsx` (98 lines, full read)
- `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` (80 lines, full read)
- `.planning/phases/38-phase-4-code-review-polish-pass/38-RESEARCH.md` (468 lines, full read — source of truth for verdicts + fix shape)
- `.planning/REQUIREMENTS.md` (113 lines, full read — POLISH-01..03 definitions)
- `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` (lines 1-30 — header + first finding only; close-out append target)

**Pattern extraction date:** 2026-05-13
