# Phase 38: Phase 4 Code-Review Polish Pass — Research

**Researched:** 2026-05-13
**Domain:** Renderer-side polish (OverrideDialog + GlobalMaxRenderPanel) — Electron + React + TS, no Spine math
**Confidence:** HIGH

## Summary

Phase 38 is a v1.0-era polish sweep with a small surface (two renderer files), a single source-of-truth review (`.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md`), and a long-lived pending todo to retire. Per-finding audit against current code reveals the situation is **far simpler than the roadmap text implies** — Phase 27 (PROJECT.md "Key Decisions" already records this) already swept FOUR of the seven deferred items as part of its QA-01..QA-04 cleanup, and Phase 6 Gap-Fix Round 6 already implemented the IN-01 focus-trap via a shared `useFocusTrap` hook.

The net Phase 38 work is therefore:

- **One actual code change** — IN-02 (drag-to-cancel overlay guard in `OverrideDialog.tsx`). ~3 lines of diff plus one new test.
- **One audit document** — `38-POLISH-AUDIT.md` with verdict per finding (most are `no-op (swept)`).
- **One todo move** — `2026-04-24-phase-4-code-review-follow-up.md` → `resolved/` with closing note.

**Primary recommendation:** Plan 3 atomic plans — 38-01 audit (POLISH-01), 38-02 IN-02 fix + test (POLISH-02), 38-03 todo move (POLISH-03). Do NOT plan separate per-finding plans for the no-op verdicts; they collapse into a single audit document. The audit IS the verification artifact for the no-op findings.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Modal overlay click → cancel (IN-02) | Browser/Client (renderer) | — | Pure DOM event semantics in `OverrideDialog.tsx`; no IPC, no core math |
| Focus trap (IN-01) | Browser/Client (renderer) | — | Already implemented via `useFocusTrap` hook (Phase 6) |
| Sort comparator (IN-05) | Browser/Client (renderer) | — | Display sort only — compareRows never crosses determinism boundary (see GlobalMaxRenderPanel.tsx:240-246 comment) |
| Audit document (POLISH-01) | Documentation | — | `.planning/phases/38-*/` planning artifact, not code |
| Todo move (POLISH-03) | Filesystem/git | — | `mv` + closing note; reference resolved-todo format |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| POLISH-01 | Audit IN-01..IN-06 against current code → `38-POLISH-AUDIT.md` | This research's IN-NN audit table below IS the input; planner copies the table structure into the audit doc |
| POLISH-02 | Apply still-applicable findings via atomic commits, skip IN-04 | Only IN-02 still applies; one ~3-line patch + one new test |
| POLISH-03 | Move `2026-04-24-phase-4-code-review-follow-up.md` → `resolved/` with closing note | Resolved-todo format documented in §Todo Close-Out Semantics below |

## IN-NN Audit (the load-bearing table)

For each finding: verdict, evidence, and (if `applies`) the minimal patch shape.

### IN-01 — OverrideDialog focus trap

- **Verdict:** `no-op (swept by Phase 6 Gap-Fix Round 6 — commit 5551073)`
- **Original problem:** The header comment claimed the browser provides default Tab-focus trapping inside `role="dialog"` modals. It doesn't. Tab could escape to the panel underneath.
- **Current state:** `OverrideDialog.tsx:55` imports `useFocusTrap` from `'../hooks/useFocusTrap'`. Line 80 calls `useFocusTrap(dialogRef, true, { onEscape: props.onCancel })`. The hook (`src/renderer/src/hooks/useFocusTrap.ts:100-189`) auto-focuses the first tabbable on mount, cycles Tab/Shift+Tab between first and last tabbable, listens to Escape at the document level, and restores focus to the previous element on unmount. The dialog ref is wired at `OverrideDialog.tsx:123`.
- **Misleading-comment check:** The current docblock at `OverrideDialog.tsx:18-25` correctly describes the situation (Phase 6 Gap-Fix Round 6 hoisted the trap into the shared hook). No misleading comment remains. No re-word required.
- **Action:** None. Document this as `no-op` in the audit with commit reference `5551073` and quote `OverrideDialog.tsx:80` (`useFocusTrap(dialogRef, true, ...)`) as the satisfying line.

### IN-02 — Overlay drag-to-cancel guard

- **Verdict:** `applies` ✅
- **Original problem:** `onClick` on the outer overlay div fires on any mouseup that lands there, including a mousedown that started inside the panel (e.g. drag-selecting typed text). `e.stopPropagation()` on the inner panel only catches events that ORIGINATE inside the panel — a drag that ends on the overlay has the overlay as the click target.
- **Current state — verified still present:** `OverrideDialog.tsx:122-129`:
  ```tsx
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="override-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={props.onCancel}    // ← bug: any mouseup-on-overlay closes the dialog
  >
  ```
  Inner panel at `OverrideDialog.tsx:130-134` still uses `onClick={(e) => e.stopPropagation()}` — does NOT defend against drag-to-overlay.
- **Patch shape (file + lines):** `src/renderer/src/modals/OverrideDialog.tsx:122-129` — switch to `onMouseDown` + target-equality guard. Inner panel's `onClick` stopPropagation can stay (defensive, no harm) or be dropped (the target-equality check makes it redundant). Minimal-diff recommendation: keep inner stopPropagation, change only the outer:
  ```tsx
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
  Rationale per IN-02 fix in the original review: `onMouseDown` fires before the drag can complete; `e.target === e.currentTarget` ensures the press started directly on the overlay (not inside the panel and dragged out).
- **Test surface:** No existing test covers drag-to-cancel. New test file recommended: `tests/renderer/override-dialog-drag-to-cancel.spec.tsx`. Mirror the structure of `tests/renderer/override-dialog-empty-input.spec.tsx` (lines 17-42 give a ready-made `renderDialog` helper). Two cases:
  1. Plain click directly on the overlay → `onCancel` fires.
  2. `mouseDown` on inner panel, `mouseUp` on overlay (simulated via firing `mouseDown` on the panel root, then `mouseDown` on the overlay) → assert `onCancel` was NOT called. Use `fireEvent.mouseDown(overlay, { target: panelDiv })` style; the target-equality guard ensures the press whose target isn't the overlay itself is ignored.
- **Confidence:** HIGH — bug surface verified present in current source; fix shape lifted verbatim from the original review (`04-REVIEW.md:153-161`).

### IN-03 — Empty-input guard

- **Verdict:** `no-op (swept by Phase 27 — commit fb3fedc, plan 27-02)`
- **Original problem:** `apply = () => props.onApply(Number(inputValue))`. `Number("") === 0` → `clampOverride` floors silently to 1%.
- **Current state:** `OverrideDialog.tsx:108`:
  ```ts
  const isValid = inputValue.trim() !== '' && Number.isFinite(Number(inputValue.trim()));
  ```
  The Apply button at `OverrideDialog.tsx:179-190` carries `disabled={!isValid}` plus a class-toggled disabled style. The Enter handler at `OverrideDialog.tsx:117-119` guards `if (e.key === 'Enter' && isValid) apply();`.
- **Test coverage:** `tests/renderer/override-dialog-empty-input.spec.tsx` (5 cases) — empty + whitespace disable Apply, valid re-enables, Apply preserves pre-fill, Enter on empty is a no-op.
- **Action:** None. Document as `no-op` in audit with commit reference `fb3fedc` and quote the `isValid` line.

### IN-04 — `highlightMatch` DRY-candidate (intentional duplication)

- **Verdict:** `skip (intentional per Phase 2 / Phase 3 pattern)`
- **Sourcing-of-truth correction:** The original review (`04-REVIEW.md:181-185`) and the todo (`2026-04-24-phase-4-code-review-follow-up.md:42-45`) flag the duplication as between **`AnimationBreakdownPanel.tsx` and `GlobalMaxRenderPanel.tsx`** — NOT between `SearchBar.tsx` and either panel. The Phase 38 task spec's wording "`highlightMatch` duplication from `SearchBar.tsx`" is a minor slip; `SearchBar.tsx` does NOT define `highlightMatch` (verified by `grep -rn highlightMatch src/renderer/src/components/SearchBar.tsx` → empty). The audit document must use the original review's correct sourcing.
- **Current state — two implementations confirmed byte-identical (15 lines each):**
  - `GlobalMaxRenderPanel.tsx:283-298`
  - `AnimationBreakdownPanel.tsx:302-317`
  - Both bodies: `q = query.trim(); if (q === '') return name; idx = name.toLowerCase().indexOf(q.toLowerCase()); if (idx < 0) return name; before = name.slice(0, idx); match = name.slice(idx, idx + q.length); after = name.slice(idx + q.length); return <>{before}<mark className="bg-accent/20 text-accent rounded-sm px-0.5">{match}</mark>{after}</>;`
- **Intent documentation (audit must cite these):**
  - `AnimationBreakdownPanel.tsx:295-300` docblock: *"Mirrors the prior phase's helper in the global panel (same 15-line helper; intentional duplication to keep this panel self-contained)."*
  - `.planning/milestones/v1.0-phases/03-animation-breakdown-panel/03-02-SUMMARY.md:48`: *"Module-top highlightMatch helper duplicated verbatim from Phase 2 GlobalMaxRenderPanel.tsx (same 15 lines). Extracting it to a shared module would have touched Phase 2 files needlessly; intentional duplication keeps each panel self-contained and review-friendly."*
- **No third consumer exists** — `grep -rn highlightMatch src/renderer/src/` finds exactly two production sites (the two panels) plus three `.bak*` files (pre-Phase-29/Phase-26.1 snapshots — ignore). The Phase 4 review's exit condition ("If a third consumer appears in Phase 6+, consider extracting to `src/renderer/src/lib/highlight-match.tsx`") has not been met.
- **Action:** None. Document as `skip (intentional per Phase 2/3 pattern)` in audit with quotes from the docblock + 03-02-SUMMARY.md.

### IN-05 — Sort comparator locale options

- **Verdict:** `no-op (swept by Phase 27 — commit 01468e4, plan 27-03)`
- **Original problem:** `compareRows` used `localeCompare(b.attachmentName)` with no options → environment-dependent ordering; `CHAIN_10` lexicographically sorted between `CHAIN_1` and `CHAIN_2`.
- **Current state:** `GlobalMaxRenderPanel.tsx:247-273` (the `compareRows` function), all four string branches now pass `undefined, { sensitivity: 'base', numeric: true }`:
  - Line 253 (attachmentName/regionName), 255 (skinName), 257 (animationName) — all carry the options object.
  - The function-leading comment at `GlobalMaxRenderPanel.tsx:236-246` documents the QA-03 sweep and the explicit scope-bound: *"display sort only. compareRows feeds sortRows … Its output never crosses a determinism boundary"* (this scope reasoning is the reason `src/core/atlas-preview.ts` and `src/core/export.ts` were INTENTIONALLY not updated — touching those would break the preview↔export byte-identical invariant per D-125).
- **Test coverage:** `tests/renderer/locale-compare-numeric-sort.spec.tsx` — two cases (`CHAIN_2` before `CHAIN_10`; mixed-arity natural sort `CHAIN_1, 2, 3, 10, 11`).
- **Action:** None. Document as `no-op` in audit with commit reference `01468e4` and quote line 253.

### IN-06 — Dead `open` prop + early-return guard

- **Verdict:** `no-op (swept by Phase 27 — commit cf098e0, plan 27-02)`
- **Original problem:** AppShell mount-gates the dialog with `dialogState !== null && <OverrideDialog ... />`, and passed `open={true}` unconditionally. The dialog's own `if (!props.open) return null` was dead code.
- **Current state:** The `open` prop is gone entirely. `OverrideDialogProps` interface (`OverrideDialog.tsx:57-64`) carries only `scope`, `currentPercent`, `anyOverridden`, `onApply`, `onClear`, `onCancel`. No `open` prop, no early-return guard. The docblock at `OverrideDialog.tsx:28-32` explicitly notes the QA-04 removal: *"conditional rendering handled by AppShell's mount gate (`dialogState !== null && <OverrideDialog ... />`) rather than an internal `open` flag (QA-04, Phase 27 — dead-prop removal)."*
- **AppShell call site** — already props-aligned (no `open` prop passed; mount-gate is the lifecycle).
- **Action:** None. Document as `no-op` in audit with commit reference `cf098e0` and quote the `OverrideDialogProps` interface body.

### WR-03 — Functional `setSelected` updater

- **Verdict:** `no-op (swept by Phase 27 — commit f7668c4, plan 27-01)`
- **Original problem:** `handleToggleRow` + `handleRangeToggle` in `GlobalMaxRenderPanel` captured `selected` via closure → stale-closure race under rapid-fire toggles.
- **Current state:** Both handlers at `GlobalMaxRenderPanel.tsx:815-874` use the functional updater `setSelected((prev) => { … })` form. Each branch (toggle, range with anchor, range without anchor, range with off-screen anchor) reads `prev` inside the updater. `useCallback` deps no longer include `selected`.
- **Test coverage:** `tests/renderer/global-max-functional-setselected.spec.tsx` — a 463-line regression spec with closure-vs-functional handler harness proving the race and a real-panel control case.
- **Action:** None. Document as `no-op` in audit with commit reference `f7668c4` and quote `GlobalMaxRenderPanel.tsx:815-817` (the `setSelected((prev) =>` form).

### Audit Summary (the table the planner copies into POLISH-AUDIT.md)

| Finding | Verdict | Sweeping phase / commit | Action in Phase 38 |
|---------|---------|--------------------------|---------------------|
| IN-01 focus trap | `no-op` | Phase 6 Gap-Fix R6 / `5551073` | Document; no code change |
| IN-02 drag-to-cancel | `applies` | — | ~3-line patch + new test |
| IN-03 empty-input guard | `no-op` | Phase 27 QA-02 / `fb3fedc` | Document; no code change |
| IN-04 highlightMatch DRY | `skip` | Phase 2/3 intentional duplication | Document rationale; no code change |
| IN-05 sort locale options | `no-op` | Phase 27 QA-03 / `01468e4` | Document; no code change |
| IN-06 dead `open` prop | `no-op` | Phase 27 QA-04 / `cf098e0` | Document; no code change |
| WR-03 functional setSelected | `no-op` | Phase 27 QA-01 / `f7668c4` | Document; no code change |

## Project Constraints (from CLAUDE.md)

- `src/core/` is pure TypeScript, no DOM — does NOT apply to this phase (renderer-only).
- All renderer code lives under `src/renderer/`. Both phase-38 files (`OverrideDialog.tsx`, `GlobalMaxRenderPanel.tsx`) are correctly located.
- `npm run test` runs vitest. Tests-before-phase-close is enforced (`.planning/config.json` → `phases.require_tests_before_phase_close: true`).
- Phases execute in order — Phase 38 follows 37; do not skip ahead. (Already satisfied — STATE.md `Phase: 38, Status: Ready to plan`.)
- Tailwind v4 literal-class discipline applies to any new JSX — but the IN-02 patch is event-handler only, no className change.

## Standard Stack

No new libraries. All work uses existing project surface:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | (project current) | Component model | Existing |
| vitest | (project current) | Test runner — `tests/renderer/*.spec.tsx` | Existing per project config |
| @testing-library/react | (project current) | `render`, `fireEvent`, `screen`, `cleanup` | Existing — used by all `tests/renderer/*` |
| jsdom | (project current) | `@vitest-environment jsdom` directive | Existing — used in `override-dialog-empty-input.spec.tsx` line 1 |

**Version verification skipped** — phase is purely renderer-side polish with no new dependencies; existing stack is sufficient and verified by the running test suite.

## Architecture Patterns

### Test File Conventions (lift from neighbors)

For the IN-02 test, mirror `tests/renderer/override-dialog-empty-input.spec.tsx`:

1. First line: `// @vitest-environment jsdom`
2. Header docblock cross-references the QA-tag (here: `IN-02`).
3. Imports: `afterEach, describe, expect, it, vi` from vitest; `cleanup, fireEvent, render, screen` from `@testing-library/react`; the dialog + its props type.
4. `afterEach(cleanup)`.
5. Helper `renderDialog(overrides: Partial<OverrideDialogProps> = {})` that returns `{ ...utils, onApply, onClear, onCancel }`.
6. 2-3 cases per finding.

### Atomic Per-Finding Commit Shape

Per the roadmap success criterion 2 and the user's anti-scope guardrail, each `applies` finding lands as a discrete `fix(38): IN-NN <one line>` commit. The single `applies` finding (IN-02) needs ONE such commit; the test commit can either ride along (combined `fix+test`) or precede (`test(38): IN-02 add failing regression spec` → `fix(38): IN-02 onMouseDown overlay guard`). The Phase 27 history shows the project prefers the test-first split (e.g. `6a4efe9 test(27-02): add failing regression spec for OverrideDialog empty-input Apply guard (QA-02)` → `fb3fedc fix(27-02): guard OverrideDialog Apply on empty/whitespace input (QA-02)`). Recommend the planner follow the same pattern.

### Audit Document Shape (POLISH-AUDIT.md)

The audit doc is itself a planning artifact, not code. Recommended sections:

1. **Header / frontmatter** — phase, date, source-review path (with the live `.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md` path), summary verdict table.
2. **Per-finding subsections** — one `### IN-NN` per finding, each carrying: verdict, evidence (current code with file:line), sweeping phase + commit (for `no-op`), or fix-shape (for `applies`), or intent quote (for `skip`).
3. **Closing summary** — "1 of 7 findings still applies (IN-02). 5 no-ops swept by Phase 6 / Phase 27. 1 explicit skip (IN-04 by Phase 2/3 intent)."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap | Inline tabbable-element queries inside OverrideDialog | `useFocusTrap` hook (already imported) | Already implemented in Phase 6; shared with OptimizeDialog + ConflictDialog |
| Drag-to-cancel guard | `mousedown`/`mouseup` ref tracking + custom state machine | `onMouseDown` + `e.target === e.currentTarget` equality check (3 lines) | Standard React pattern; matches original review fix verbatim |
| Locale-aware sort | Custom natural-sort implementation | `localeCompare(b, undefined, { sensitivity: 'base', numeric: true })` | Already swept by Phase 27 — no new code needed |

## Runtime State Inventory

> Phase 38 is a UI polish pass with no rename, no datastore, no service config, no OS registration, no env vars, and no build artifacts that survive a code-only change. The runtime-state categories below are answered explicitly per the rename/refactor protocol so the planner can confirm no migration is needed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — IN-02 is a runtime event-handler change with no persistence surface. `OverrideDialog` is a transient mount; no state leaves React. | None |
| Live service config | None — no IPC channel, no main-process state, no service touched. | None |
| OS-registered state | None — no Electron menu / shortcut / scheduler interaction. | None |
| Secrets / env vars | None — no env vars consumed by `OverrideDialog` or `GlobalMaxRenderPanel`. | None |
| Build artifacts | None — IN-02 patch is renderer source; production bundle is regenerated by next `npm run build`. No installed packages, no compiled binaries with the old behavior cached. | None |

**Canonical question — answered:** After the IN-02 patch lands, the only runtime systems carrying the old behavior are running `npm run dev` sessions (in-memory; HMR refreshes them) and any user's installed binary (next release picks up the fix). Nothing else is cached or registered.

## Common Pitfalls

### Pitfall 1: Confusing `04-REVIEW.md` archived path vs live path

- **What goes wrong:** Roadmap success criterion 1 literally references `.planning/phases/04-scale-overrides/04-REVIEW.md`, but that directory was archived during the v1.0→v1.1 milestone cutover.
- **Live path:** `.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md` ← USE THIS.
- **How to avoid:** Audit doc must cite the live path. Planner should not chase the broken roadmap path.

### Pitfall 2: Treating IN-04 source as `SearchBar.tsx`

- **What goes wrong:** Phase 38 task spec wording slip — IN-04 is `highlightMatch` duplication between the **two panels**, not between SearchBar and either panel. SearchBar.tsx contains no `highlightMatch`.
- **How to avoid:** Audit doc must cite the actual duplication sites (`GlobalMaxRenderPanel.tsx:283` and `AnimationBreakdownPanel.tsx:302`) and the actual intent-documentation sites (`AnimationBreakdownPanel.tsx:295-300` docblock + `03-02-SUMMARY.md:48`).

### Pitfall 3: Over-scoping the no-op findings

- **What goes wrong:** Treating "audit" as "re-verify and re-implement". The Phase 27 sweeps + Phase 6 Gap-Fix Round 6 are already verified by their own commits, tests, and SUMMARY artifacts. Re-doing them in Phase 38 produces churn with no behavior change.
- **How to avoid:** The audit document is the deliverable for no-op findings. The planner should NOT create per-no-op plans (38-02a, 38-02b, …); they collapse into the single audit document under POLISH-01.

### Pitfall 4: Touching `compareRows` again

- **What goes wrong:** Tempted to "while I'm in this file" tweak the comparator further.
- **Why it's bad:** The function-leading comment at `GlobalMaxRenderPanel.tsx:236-246` documents a determinism scope boundary — `compareRows` is **display-only**; the byte-identical packer↔export invariant (D-125) lives in `src/core/atlas-preview.ts` and `src/core/export.ts`, which are intentionally bare-localeCompare. Don't touch those. Don't expand the renderer comparator's options beyond what QA-03 set.

### Pitfall 5: Modifying `useFocusTrap`

- **What goes wrong:** Tempted to "improve" the focus trap while addressing IN-01.
- **Why it's bad:** IN-01 is a no-op. `useFocusTrap` is shared by OverrideDialog, OptimizeDialog, and ConflictDialog. Any change has three-modal blast radius.

## Code Examples

### IN-02 patch (the one applicable code change)

Source: `04-REVIEW.md:153-161` and verified shape in `OverrideDialog.tsx:122-129`.

```tsx
// Source: .planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md:153-161
// Before (src/renderer/src/modals/OverrideDialog.tsx:122-129):
<div
  ref={dialogRef}
  role="dialog"
  aria-modal="true"
  aria-labelledby="override-title"
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onClick={props.onCancel}
>

// After:
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

### IN-02 test (mirror `override-dialog-empty-input.spec.tsx`)

```tsx
// Source: pattern lifted from tests/renderer/override-dialog-empty-input.spec.tsx:17-42
// Target: tests/renderer/override-dialog-drag-to-cancel.spec.tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OverrideDialog, type OverrideDialogProps } from '../../src/renderer/src/modals/OverrideDialog';

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

describe('OverrideDialog — drag-to-cancel guard (IN-02)', () => {
  it('plain mousedown directly on overlay still cancels', () => {
    const { onCancel } = renderDialog();
    const overlay = screen.getByRole('dialog');
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('mousedown that originated inside the panel does NOT cancel', () => {
    const { onCancel } = renderDialog();
    const input = screen.getByRole('spinbutton');
    // mousedown on the inner panel → e.target is the input, e.currentTarget is the overlay
    fireEvent.mouseDown(input);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
```

The key assertion is `e.target === e.currentTarget`: when the press starts on the input or anywhere inside the inner panel and bubbles up to the overlay, target ≠ currentTarget → no cancel.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-dialog inline focus trap | Shared `useFocusTrap` hook | Phase 6 Gap-Fix R6 / 2026-04-25 | All three hand-rolled modals (Override/Optimize/Conflict) now share the trap |
| Closure-capture setSelected | Functional `setSelected((prev) => ...)` | Phase 27 QA-01 / 2026-05-07 | Rapid-fire toggle race eliminated; useCallback drops `selected` dep |
| Bare `localeCompare(b)` | `localeCompare(b, undefined, { sensitivity: 'base', numeric: true })` | Phase 27 QA-03 / 2026-05-07 | `CHAIN_10` sorts after `CHAIN_9`; case-insensitive; renderer-only (core stays bare) |
| `Number(inputValue)` on apply | `isValid` guard + disabled Apply | Phase 27 QA-02 / 2026-05-07 | Empty/whitespace no longer floor-clamps to 1% |
| `if (!props.open) return null` | AppShell mount-gate only | Phase 27 QA-04 / 2026-05-07 | `open` prop removed entirely |

**Deprecated/outdated:**
- The original `04-REVIEW.md` recommendation for IN-01 included "either reword the comment OR implement ~15-line focus-trap". Outdated — the 15-line trap was implemented (better) in Phase 6 via a shared hook (~190 lines), so neither sub-option is in scope today. The current comment is correct.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | — | — | All claims verified against current source (`OverrideDialog.tsx`, `GlobalMaxRenderPanel.tsx`, `SearchBar.tsx`, `AnimationBreakdownPanel.tsx`, `useFocusTrap.ts`), git log (commits `f7668c4`, `fb3fedc`, `cf098e0`, `01468e4`, `5551073`), and existing tests (`override-dialog-empty-input.spec.tsx`, `locale-compare-numeric-sort.spec.tsx`, `global-max-functional-setselected.spec.tsx`). |

All claims in this research were verified — no user confirmation needed before planning.

## Open Questions

1. **Should the IN-02 fix-and-test land as one commit or two?**
   - What we know: Phase 27 used the test-first split (`6a4efe9` test → `fb3fedc` fix).
   - Recommendation: Follow Phase 27 precedent — `test(38): IN-02 add failing regression spec` then `fix(38): IN-02 onMouseDown overlay guard`. The planner can collapse to one commit if scope pressure surfaces; not load-bearing.

2. **Inner-panel `onClick={(e) => e.stopPropagation()}` — keep or drop?**
   - What we know: With the new overlay `onMouseDown` + target-equality guard, the inner stopPropagation becomes redundant for the cancel path. But the inner div also catches clicks for in-panel button targeting; removing stopPropagation could be a no-op or could subtly change something downstream.
   - Recommendation: KEEP it. Minimal-diff principle — IN-02 fix is the overlay-handler change only. Touching the inner-panel handler expands scope.

## Environment Availability

> Phase 38 has no external runtime dependencies beyond the existing dev stack (Node, npm, vitest, React, Electron). No new tools, no services, no databases. Audit skipped per the protocol: "If the phase is purely code/config changes with no external dependencies (e.g. refactoring, documentation), output: 'Step 2.6: SKIPPED'".

**Step 2.6: SKIPPED (no external dependencies identified)**

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (project default — `tech_stack.testing` in `.planning/config.json`) |
| Config file | `vitest.config.ts` (existing, project root — confirmed by neighbouring tests' running success) |
| Quick run command | `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| POLISH-01 | Audit document exists and enumerates IN-01..06 with verdicts | manual-only (doc-existence) | n/a (planner-managed artifact) | ❌ Wave 0 — `38-POLISH-AUDIT.md` |
| POLISH-02 (IN-02) | Plain mousedown on overlay → cancels | unit | `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx -t "plain mousedown directly on overlay"` | ❌ Wave 0 — new test file |
| POLISH-02 (IN-02) | Mousedown originating inside panel → does NOT cancel | unit | `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx -t "mousedown that originated inside the panel"` | ❌ Wave 0 — new test file |
| POLISH-02 (no-op verifications) | IN-01/03/04/05/06 + WR-03 no-ops remain green | regression suite | `npm run test -- tests/renderer/override-dialog-empty-input.spec.tsx tests/renderer/locale-compare-numeric-sort.spec.tsx tests/renderer/global-max-functional-setselected.spec.tsx` | ✅ — already passing per Phase 27 |
| POLISH-03 | Todo moved to `resolved/` with closing note referencing Phase 38 | manual-only (filesystem state) | `test -f .planning/todos/resolved/2026-04-24-phase-4-code-review-follow-up.md && ! test -f .planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` | n/a — verification by file existence |

### Sampling Rate

- **Per task commit:** `npm run test -- tests/renderer/override-dialog-drag-to-cancel.spec.tsx` (quick — single file, ~1s)
- **Per wave merge:** `npm run test` (full suite — verifies all six no-op surfaces remain green)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` — new file covering IN-02 fix; mirror `override-dialog-empty-input.spec.tsx` structure
- [ ] `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` — audit document (POLISH-01 deliverable)

*Framework, config, and shared helpers already exist — no Wave 0 setup work beyond the two files above.*

## Security Domain

> Per `.planning/config.json` there is no explicit `security_enforcement` flag. Phase 38 surface is a renderer-side event-handler change in a sandboxed Electron renderer process. ASVS categories that map are minimal; included here for completeness.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — no auth surface |
| V3 Session Management | no | n/a — no session |
| V4 Access Control | no | n/a — no privileged action |
| V5 Input Validation | partial | Number input already validated via `isValid` in `OverrideDialog.tsx:108` (Phase 27 QA-02). IN-02 patch adds no new input surface |
| V6 Cryptography | no | n/a |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via search query echo | Tampering | React text-node rendering (existing); `highlightMatch` uses React fragments + `<mark>`, no `dangerouslySetInnerHTML`. Unchanged by Phase 38. |
| Click-jacking via overlay race | Tampering | IN-02 fix actually HARDENS this — the target-equality guard means an accidental drag-out can no longer discard typed input. |

## Todo Close-Out Semantics

`.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` must move to `.planning/todos/resolved/` (same filename — date prefix preserved). The closing note appends below the existing content following a `---` separator and a `## Resolved` heading. Reference format (verbatim shape from `2026-04-28-electron-updater-prerelease-channel-mismatch.md`):

```markdown
[existing content unchanged]

---

## Resolved

2026-05-13 — Phase 38 (POLISH-01..03): audit at `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` enumerated all 7 deferred findings against current code. Net outcome:
  - **1 applies** (IN-02 drag-to-cancel overlay guard) — fixed in `src/renderer/src/modals/OverrideDialog.tsx` via `onMouseDown` + `e.target === e.currentTarget` guard; regression spec at `tests/renderer/override-dialog-drag-to-cancel.spec.tsx`.
  - **5 no-ops** — IN-01 (Phase 6 Gap-Fix R6, commit `5551073` — focus trap via shared `useFocusTrap` hook), IN-03 (Phase 27 QA-02, commit `fb3fedc` — empty-input guard), IN-05 (Phase 27 QA-03, commit `01468e4` — natural-order localeCompare), IN-06 (Phase 27 QA-04, commit `cf098e0` — dead `open` prop removed), WR-03 (Phase 27 QA-01, commit `f7668c4` — functional `setSelected` updater).
  - **1 skip** — IN-04 (`highlightMatch` duplication between `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx`) intentional per Phase 2/3 self-contained-panel pattern; no third consumer triggers the documented extraction threshold.
```

The planner should regenerate the commit SHAs against the actual git log at execution time in case the audit fix lands a different SHA than this research's reference.

## Sources

### Primary (HIGH confidence)
- `src/renderer/src/modals/OverrideDialog.tsx` (196 lines, read in full) — current state of all IN-01/02/03/06 surfaces
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (1164 lines, read in full) — current state of IN-04 source, IN-05 comparator, WR-03 handlers
- `src/renderer/src/components/SearchBar.tsx` (72 lines, read in full) — confirms NO `highlightMatch` here; IN-04 source-of-truth sits in the two panels
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (lines 290-322 + grep verified across file) — second `highlightMatch` site (IN-04 partner) with intent docblock
- `src/renderer/src/hooks/useFocusTrap.ts` (190 lines, read in full) — IN-01 satisfying surface
- `tests/renderer/override-dialog-empty-input.spec.tsx`, `tests/renderer/locale-compare-numeric-sort.spec.tsx`, `tests/renderer/global-max-functional-setselected.spec.tsx` — existing regression coverage for IN-03/05 + WR-03
- `git log --oneline --all | grep -iE "phase 27|QA-0[1-4]"` — commit SHAs for Phase 27 sweeps (`f7668c4`, `fb3fedc`, `cf098e0`, `01468e4`, `5551073`)
- `.planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md` — source-of-truth for IN-01..06 + WR-03
- `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` — long-lived todo to retire
- `.planning/REQUIREMENTS.md:33-39` — POLISH-01..03 requirements
- `.planning/ROADMAP.md:65-75` — Phase 38 goal + success criteria

### Secondary (MEDIUM confidence)
- `.planning/milestones/v1.0-phases/03-animation-breakdown-panel/03-02-SUMMARY.md:48` — Phase 3 documentation of intentional `highlightMatch` duplication (corroborates IN-04 skip rationale)
- `.planning/todos/resolved/2026-04-28-electron-updater-prerelease-channel-mismatch.md` — example of resolved-todo closing-note shape (for POLISH-03)

### Tertiary (LOW confidence)
- None. All claims are verified against either current source or recorded git history.

## Metadata

**Confidence breakdown:**
- Per-finding verdicts: HIGH — every IN-NN was checked against current source AND a corresponding commit SHA (for `no-op` cases) or a current bug-still-present grep (for IN-02).
- Fix shape for IN-02: HIGH — lifted verbatim from the original review and verified against current overlay handler.
- Test pattern: HIGH — pattern mirror exists in same directory (`override-dialog-empty-input.spec.tsx`).
- Todo close-out format: HIGH — shape verified against existing resolved todo example.

**Research date:** 2026-05-13
**Valid until:** ~2026-06-12 (30 days — surface is stable polish-pass, no fast-moving dependencies). If the planner runs >30 days from this date, re-grep `OverrideDialog.tsx:122-129` to confirm IN-02 is still unfixed.
