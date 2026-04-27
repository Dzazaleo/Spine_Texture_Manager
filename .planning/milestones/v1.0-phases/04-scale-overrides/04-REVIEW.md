---
phase: 04-scale-overrides
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/core/overrides.ts
  - src/renderer/src/components/AppShell.tsx
  - src/renderer/src/lib/overrides-view.ts
  - src/renderer/src/modals/OverrideDialog.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - tests/arch.spec.ts
  - tests/core/overrides.spec.ts
  - tsconfig.node.json
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
resolved:
  WR-01: fixed 2026-04-24 (commit after e981400) — AppShell prefill wrapped in clampOverride
  WR-02: fixed 2026-04-24 — removed redundant autoFocus on Apply button; useEffect owns input focus per D-81
deferred:
  - WR-03, IN-01, IN-02, IN-03, IN-04, IN-05, IN-06 — tracked in .planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md for Phase 5/6 polish pass
status: partially_resolved
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

Phase 4 ships per-attachment scale overrides across two panels plus a hand-rolled percentage-input modal. The code is clean, well-documented, and the new `D-91` semantics (percent = fraction of source, not peak) are applied consistently across both the core math file, the renderer twin, both panels, the dialog, and the AppShell prefill. The four phase invariants from the context — Layer 3, applyOverride parity, `attachmentKey → attachmentName` conversion, no native `<dialog>` element — all hold.

No critical bugs and no security issues were found. The three warnings cover:

1. a plausible UX confusion where the prefill can exceed the helper text's stated max of 100%,
2. two focus declarations competing at dialog mount when `anyOverridden === false`,
3. `useCallback` dependencies on `selected` in `GlobalMaxRenderPanel` that would be safer with the functional-update form of `setState`.

The six info items are observations about a11y polish (focus trap / `tabIndex` on the dialog), minor UX edges (overlay drag-to-cancel, typed `""` in the number input), and documentation nits (a comment that overstates browser default Tab behavior).

Invariants verified against the source:

- Layer 3: neither `AppShell.tsx`, `OverrideDialog.tsx`, `GlobalMaxRenderPanel.tsx`, nor `AnimationBreakdownPanel.tsx` imports from `src/core/*`; all override math is imported from `../lib/overrides-view.js`. `tests/arch.spec.ts` locks this.
- Parity: `src/core/overrides.ts` and `src/renderer/src/lib/overrides-view.ts` contain byte-identical function bodies for `clampOverride` and `applyOverride` (the `Number.isFinite` guard, the `Math.round` pre-clamp, and the strict `> 100` clamped predicate all appear verbatim in both files). `tests/core/overrides.spec.ts` asserts this across 22 sampled inputs plus signature greps.
- `attachmentKey → attachmentName` conversion: `GlobalMaxRenderPanel.tsx` declares `selectedAttachmentNames` (memoized from `keyToName`) and passes it as `selectedKeys={selectedAttachmentNames}` on the `Row`; `tests/arch.spec.ts` has two regression greps (forbid `selectedKeys={selected}`, require the named intermediate).
- Dialog is NOT a native `<dialog>` — `OverrideDialog.tsx` uses a plain `<div role="dialog" aria-modal="true">` with overlay + panel divs. Confirmed by grep.
- React auto-escaping protects `attachmentName` in every usage (titles, aria-labels, highlight spans). No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`.

## Warnings

### WR-01: Dialog prefill can display a value greater than the documented 100% max

**File:** `src/renderer/src/components/AppShell.tsx:93-94`

**Issue:** The dialog prefill for a non-overridden row uses `Math.round(row.peakScale * 100)`. Under the new D-91 semantics, the percent field is bounded to `[1, 100]` (100% = source dimensions) and the dialog helper text says "Max = 100% (source dimensions)". However, `row.peakScale` is the engine-computed world-space scale and can easily exceed 1.0 on rigs where bones are scaled up in an animation (exactly the use case that motivates overrides). When `peakScale > 1.0`, the prefill shows e.g. `150`, the user sees `150` in an input labeled with a `max={100}` constraint, and Apply silently clamps back to 100. The helper text is then no longer literally true for that prefill state, and the silent clamp happens without the user pressing anything that visibly says "we dropped your value".

Note: `applyOverride(150)` correctly sets `clamped = true`, but the UI does not render a clamp badge for the prefill value specifically — the badge only lights up on rows that already have an override applied, and the prefill flow has not applied yet. So the silent clamp is invisible until Apply fires, and then only via the stored `100` being re-shown.

**Fix:** Clamp the prefill to `[1, 100]` at the computation site so the input never shows an out-of-range value:
```typescript
const currentPercent =
  overrides.get(row.attachmentName) ??
  Math.min(100, Math.max(1, Math.round(row.peakScale * 100)));
```
Or use `clampOverride(Math.round(row.peakScale * 100))` — it is already imported in this file. This matches the input's own `min={1} max={100}` constraints and keeps the helper text literally true for every dialog open.

---

### WR-02: Two auto-focus declarations compete at dialog mount when `anyOverridden === false`

**File:** `src/renderer/src/modals/OverrideDialog.tsx:59-66, 147`

**Issue:** The dialog declares focus on two elements simultaneously when `anyOverridden === false`:

1. The input gets `inputRef.current?.focus(); inputRef.current?.select()` from the `useEffect` on open.
2. The Apply button has `autoFocus={!props.anyOverridden}`, which React applies during mount.

Both "win" at different phases of the React lifecycle (`autoFocus` fires during the browser's post-commit focus step; the `useEffect` fires on the next tick and re-steals focus). In practice the `useEffect` wins, so the input is focused and the `<select>` happens — but the Apply button briefly had focus before the effect ran, and the intent of the `autoFocus` prop is unclear from reading the code. The two declarations disagree on which element "should" be focused when `anyOverridden === false`.

If someone later changes the effect to only focus conditionally (or React changes batching around `autoFocus`), the two can flip and the user lands on Apply instead of the input — which breaks the D-81 "immediately retype without a manual click" flow.

**Fix:** Pick one focus owner. Since D-81 explicitly calls out auto-focus + auto-select on the input, drop the `autoFocus` prop on Apply:
```tsx
<button
  type="button"
  onClick={apply}
  className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
>
  Apply
</button>
```
The useEffect's input focus stays as the single source of truth. If the goal of the `autoFocus` was "make Enter work when anyOverridden is false", note that Enter on the input already triggers Apply via the panel div's keyDown handler, so removing `autoFocus` loses nothing.

---

### WR-03: `handleToggleRow` and `handleRangeToggle` read `selected` from closure instead of functional updater

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:493-502, 505-540`

**Issue:** Both handlers capture `selected` from state via the closure and list it in the `useCallback` dependency array. That means:

- Two rapid clicks within the same render frame both see the pre-click `selected` value.
- React's automatic batching (React 18+) normally resolves this correctly because both calls' `setSelected(next)` run with the same `prev` and produce the same `next` — but the moment someone introduces an async handler, a microtask between clicks, or a third setState that depends on the latest selection, the stale-closure bug will surface silently.

The existing shift-click suppression ref shows the authors are already aware of rapid-click timing concerns, so the defensive pattern is worth applying here too.

**Fix:** Use the functional updater form of `setSelected` so the handler reads the latest state:
```typescript
const handleToggleRow = useCallback((key: string) => {
  setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });
  setLastClicked(key);
}, []);
```
Same shape for `handleRangeToggle` — fold the `selected.has(key)` read inside the updater. The `useCallback` can then drop `selected` from its deps and become stable across renders, which also avoids child re-renders when selection changes.

---

## Info

### IN-01: Dialog has no focus trap; Tab can move focus outside the modal

**File:** `src/renderer/src/modals/OverrideDialog.tsx:18-21, 85-97`

**Issue:** The header comment says "Focus-trap provided by the browser's default tab-order cycling inside the modal container". Browsers do not trap Tab inside arbitrary divs — Tab cycles through all focusable elements in document order, including the panels rendered behind the overlay. Pressing Tab several times inside the dialog can move focus to the `GlobalMaxRenderPanel` sort headers or checkboxes behind the `aria-modal="true"` overlay.

For the SIMPLE_TEST.json rig the panel elements are few and the dialog has only four focusables, so this is currently a minor WCAG 2.4.3 concern. As real rigs grow and the panel accumulates more focusables, the modal's "modal-ness" degrades. `aria-modal="true"` is a screen-reader affordance and does not block Tab focus from escaping.

**Fix:** Either (a) document the deferral explicitly and track as a Phase 9 polish item, or (b) add a minimal focus trap: on Tab from the last focusable, move focus to the first; on Shift+Tab from the first, move to the last. ~15 extra lines. The comment at lines 18-21 should be corrected either way — browsers do not provide default focus trapping.

---

### IN-02: Overlay `onClick` fires on drag-release, can discard typed input accidentally

**File:** `src/renderer/src/modals/OverrideDialog.tsx:85-92`

**Issue:** The overlay closes the dialog on any click event. If a user mousedowns inside the panel (for example, drag-selecting their typed percentage to retype it) and then mouseups on the overlay outside the panel, the overlay's `onClick` fires and the dialog discards the typed value. `e.stopPropagation()` on the inner panel only catches events that originate inside the panel — a drag that ends on the overlay has the overlay as the event target.

**Fix:** Use `onMouseDown` on the overlay instead of `onClick`, and only close when both mousedown and mouseup happen on the overlay itself:
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="override-title"
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onMouseDown={(e) => {
    if (e.target === e.currentTarget) props.onCancel();
  }}
>
```

---

### IN-03: Empty input string becomes `0` → clamped to `1` silently on Apply

**File:** `src/renderer/src/modals/OverrideDialog.tsx:75, 108-111`

**Issue:** `apply = () => props.onApply(Number(inputValue))`. If the user clears the input (empty string), `Number("") === 0`, which `clampOverride` snaps to `1`. The clamp is silent and the input has no validation message. A minor UX wrinkle: clearing + Apply without typing stores `1%`, which surprises the user.

**Fix:** Either (a) disable Apply when the input is empty, or (b) treat empty as "no change" and keep the current value:
```typescript
const apply = () => {
  const n = inputValue.trim() === '' ? props.currentPercent : Number(inputValue);
  props.onApply(n);
};
```

---

### IN-04: Duplicated `highlightMatch` helper between the two panels

**File:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:218-233`, `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:198-213`

**Issue:** The two panels define `highlightMatch` with byte-identical function bodies. The header comment on `AnimationBreakdownPanel.tsx:213-217` explicitly calls out the duplication ("Mirrors the prior phase's helper in the global panel (same 15-line helper; intentional duplication to keep this panel self-contained)"), so this is a conscious choice, not an oversight. Flagging only so a future refactor notices the intent — do NOT flatten it without preserving the self-contained-panel rationale.

**Fix:** No action required. If a third consumer appears in Phase 6+, consider extracting to `src/renderer/src/lib/highlight-match.tsx`.

---

### IN-05: `localeCompare` without options can produce environment-dependent ordering

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:168-173`

**Issue:** `compareRows` uses `a.attachmentName.localeCompare(b.attachmentName)` with no `locales` or `options` argument. Default locale comparison differs across Node/Chromium ICU versions and the user's system locale (e.g., whether `"a" < "B"` case-insensitively or case-sensitively). For a Spine rig with attachments like `SQUARE`, `SQUARE2`, `circle_01`, the sort order may not match what the developer tested on one machine vs. another.

**Fix:** Pin to the base sensitivity and ignore case to match the filter, which is already case-insensitive:
```typescript
return a.attachmentName.localeCompare(b.attachmentName, 'en', { sensitivity: 'base', numeric: true });
```
`numeric: true` also makes `SQUARE2` sort after `SQUARE10` correctly. The same three other `localeCompare` calls (skinName, animationName) could get the same treatment for consistency.

---

### IN-06: `useEffect` dependency on `props.open` is effectively constant while the component is mounted

**File:** `src/renderer/src/modals/OverrideDialog.tsx:59-66`

**Issue:** `AppShell.tsx:168-170` only renders `<OverrideDialog>` when `dialogState !== null`, and passes `open={true}` unconditionally. The dialog never re-renders with `open={false}` — it unmounts instead. So the `useEffect([props.open])` dependency is constant for the lifetime of the component, and the `if (props.open) {...}` guard on line 60 is always true.

This is harmless, but the dead-code smell obscures the actual mount-once-focus semantic. Simplifies to `useEffect(() => { ... }, [])` with a comment explaining that mount == open.

**Fix:** Optional cleanup, low priority. If kept as-is, the dead branch is dead-because-the-parent-always-passes-true and should be documented.

---

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
