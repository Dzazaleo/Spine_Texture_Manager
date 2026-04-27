---
phase: 02-global-max-render-source-panel
plan: 02
subsystem: renderer-panel
tags:
  - react
  - table
  - sort
  - filter
  - selection
  - wai-aria
  - tailwind-literal
requirements:
  - F3.1
  - F3.2
  - F3.3
dependency_graph:
  requires:
    - src/shared/types.ts (DisplayRow, SkeletonSummary — Plan 02-01)
  provides:
    - GlobalMaxRenderPanel (sortable/searchable/selectable table component)
    - SearchBar (reusable controlled input with clear button + ESC handling)
  affects:
    - src/renderer/src/App.tsx (Plan 02-03 will flip loaded-branch render to GlobalMaxRenderPanel)
tech_stack:
  added: []
  patterns:
    - plain-useState-panel-state (D-32 — no Zustand/Jotai/Context)
    - tailwind-literal-class-rule (Pitfall 8 — clsx for conditionals only)
    - wai-aria-table-pattern (aria-sort on th; native onChange on checkbox for keyboard; label onClick for shiftKey)
    - react-fragment-match-highlight (D-40 — no dangerouslySetInnerHTML, XSS-safe)
    - module-top-pure-helpers (filterByName/sortRows/compareRows/highlightMatch all module-top, component-body stays declarative)
key_files:
  created:
    - src/renderer/src/components/SearchBar.tsx
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  modified: []
decisions:
  - D-29 default sort locked in state initializer — useState<SortCol>('peakScale') + useState<SortDir>('desc')
  - D-30 sort toggle — handleSort flips dir if same col, resets to asc on new col
  - D-31 selection contract — Set<string> keyed on attachmentKey; tri-state select-all via ref.current.indeterminate; shift-click range on visible-keys index range
  - D-32 plain useState — 5 useState calls + 1 useRef; no external state library, cited 2x in source per W-02
  - D-37 filter strictness — .toLowerCase().includes() on attachmentName only; .trim() collapses pure-whitespace queries to "show all"
  - D-39 clear button — only rendered when value !== ''; dedicated aria-label="Clear search"
  - D-40 match highlight — String.slice + React fragments + <mark className="bg-accent/20 text-accent rounded-sm px-0.5">
  - D-41 zero-results row — plain text echo of query (React text node — XSS-safe)
  - D-42 ESC handling — two-tap: clear non-empty, blur already-empty
  - D-44 chip styling — filename header + Source Animation cell share "inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono"
  - W-01 a11y split — onChange on <input> carries single-toggle (keyboard path); onClick on wrapping <label> captures shiftKey for range-select (mouse path); suppressNextChangeRef prevents range→single double-fire
metrics:
  duration: 3m 13s
  completed: "2026-04-23"
  tasks: 2
  files_changed: 2
  tests_delta: "no new tests added in this plan; 62 existing tests + 4 arch specs still green"
  commits:
    - "c43649d: feat(02-02): add SearchBar controlled input component"
    - "ed7b813: feat(02-02): add GlobalMaxRenderPanel — sortable/searchable/selectable table"
---

# Phase 02 Plan 02: Renderer Panel + SearchBar Summary

**One-liner:** Ships the two Phase 2 renderer artifacts that turn `DisplayRow[]` into an interactive surface — `SearchBar` (controlled input, clear button, two-tap ESC) and `GlobalMaxRenderPanel` (hand-rolled sortable / searchable / selectable table with WAI-ARIA-compliant per-row checkbox, tri-state select-all, and shift-click range). Both honour the plain-`useState` discipline (D-32) and the literal-Tailwind-class rule (Pitfall 8); neither imports from `src/core/*` (Layer 3 defense).

## What shipped

1. **`src/renderer/src/components/SearchBar.tsx`** (NEW, 68 lines) — a 3-prop controlled input.
   - Props: `value`, `onChange`, optional `placeholder` (defaults to "Filter by attachment name…").
   - Clear button (`✕` multiplication-X glyph) renders only when `value !== ''` (D-39); `aria-label="Clear search"` supplies an accessible name; click resets the query via `onChange('')`.
   - Two-tap ESC handling (D-42): first tap on a non-empty value calls `e.preventDefault()` + `onChange('')`; second tap on an already-empty value calls `e.currentTarget.blur()` so ESC becomes a universal "get out of the search field" gesture.
   - Focus ring uses the orange accent token (`focus:ring-2 focus:ring-accent`); placeholder muted (`placeholder:text-fg-muted`).
   - All Tailwind classes are literal strings — no template-string interpolation; no `clsx` needed because there are no conditional classes on the input itself (the clear button is a conditional element, not a conditional class).
   - Zero imports from `src/core/*` (Layer 3 defense); zero `dangerouslySetInnerHTML`.

2. **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** (NEW, 439 lines) — the sortable / searchable / selectable table.
   - **Props:** `{ summary: SkeletonSummary }` only; parent passes the full summary, panel reads `summary.peaks` (the `DisplayRow[]` from Plan 02-01) and `summary.skeletonPath` (rendered as a header chip).
   - **State (plain useState per D-32, cited 2× in-source per W-02):**
     - `query: string` — search string, owned here, handed to `SearchBar` as controlled value.
     - `sortCol: SortCol` — default `'peakScale'` (D-29).
     - `sortDir: SortDir` — default `'desc'` (D-29).
     - `selected: Set<string>` — attachmentKey set; seeded `() => new Set()` so the initial set is stable across renders.
     - `lastClicked: string | null` — shift-click anchor; VS Code / Finder semantics (anchors on most-recently-clicked row).
     - `suppressNextChangeRef: useRef<string | null>` — W-01 shift-click suppression flag to prevent the native `onChange` from overwriting the range state the preceding `onClick` just committed.
   - **Derived (memoized):** `filtered` → `sorted` → `visibleKeys`, wired through `useMemo` so a search-bar keystroke does not recompute the sort step unnecessarily.
   - **Sort (D-30):** `handleSort(col)` — if same col, flip dir via setter callback; if new col, reset to `'asc'`.
   - **Filter (D-37):** `filterByName(rows, query)` — `.trim().toLowerCase()`, then `.toLowerCase().includes()` on `attachmentName` only. No `new RegExp(query)` (T-02-02-02 mitigation — substring is literal; no regex meta-character injection vector).
   - **Selection (D-31):**
     - Per-row `<input type="checkbox">` carries the single-toggle on its native `onChange` so Space / Enter keyboard activation works out of the box (WAI-ARIA Table pattern compliance).
     - Wrapping `<label>` owns `onClick` — when `e.shiftKey`, it sets `suppressNextChangeRef.current = row.attachmentKey` and calls `onRangeToggle`; the subsequent native `onChange` reads the flag and returns early, preserving the range state.
     - `SelectAllCheckbox` (thead) runs a tri-state effect: `ref.current.indeterminate = someChecked && !allChecked`; toggles add-all or remove-all on visible rows only.
     - Shift-click range derives target state from the newly-clicked row — if it was selected, shift-click clears the range; else shift-click adds it (VS Code / Finder convention).
   - **Match highlight (D-40):** `highlightMatch(name, query)` — `String.slice` splits the attachment name into `before + match + after`, rendered as `<>{before}<mark className="bg-accent/20 text-accent rounded-sm px-0.5">{match}</mark>{after}</>`. No HTML parsing; no `dangerouslySetInnerHTML`. XSS-safe per T-02-02-01.
   - **Zero-results row (D-41):** `colSpan=8` cell with "No attachments match \"<query>\"" (or "No attachments" for an empty query); `{query}` is a React text child, not interpolated HTML.
   - **Header chip (D-44):** `summary.skeletonPath` wraps in `<span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg">` — same chip class shared with the `Source Animation` cell.
   - **Selection count caption:** `{selected.size} selected / {sorted.length} total` with `text-fg-muted font-mono text-sm ml-auto`.
   - **Cell density (D-47):** all cells use `py-2 px-3 font-mono`.
   - **Layer 3:** imports only React, clsx, `../../../shared/types.js` (type-only: `SkeletonSummary`, `DisplayRow`), and `../components/SearchBar`. Zero `src/core/*` imports (T-02-02-03 mitigation).
   - **Pitfall 8 discipline:** every Tailwind class string is a literal; `clsx` handles 3 conditionals (active sort header text, inactive-arrow text-fg-muted, selected row bg-accent/5 + hover:bg-accent/5).

## Verification

| Gate                                      | Expected                         | Observed                                   |
| ----------------------------------------- | -------------------------------- | ------------------------------------------ |
| `npm run typecheck:web`                   | clean                            | clean ✓                                    |
| `npm run test -- tests/arch.spec.ts`      | 4/4 pass                         | 4/4 pass ✓                                 |
| `npm run test` (full suite)               | ≥ 62 pass + 1 skip (no regression) | 62 pass + 1 skip ✓                         |
| `npx electron-vite build`                 | green bundle                     | green (main 16.83 kB, renderer 563.23 kB JS + 16.68 kB CSS) ✓ |
| `grep -c "D-32"` in panel                 | ≥ 2 (W-02)                       | 2 ✓                                        |
| `grep "onChange={handleChange}"` in panel | present (W-01 keyboard a11y)     | present ✓                                  |
| `grep "e.shiftKey"` in panel              | present (W-01 range-select)      | present ✓                                  |
| `grep "handleLabelClick"` in panel        | present (W-01 handler split)     | present ✓                                  |
| `! grep "onChange={() => {}}"` in panel   | zero (no empty onChange)         | zero ✓                                     |
| `! grep "dangerouslySetInnerHTML"` both   | zero (T-02-02-01 mitigation)     | zero ✓                                     |
| `! grep "new RegExp"` in panel            | zero (T-02-02-02 mitigation)     | zero ✓                                     |
| `! grep -E "from ['"][^'"]*/core/"` both  | zero (T-02-02-03 / Layer 3)      | zero ✓                                     |
| `! grep "DebugPanel"` both                | zero (grep-literal compliance)   | zero ✓                                     |

## Deviations from Plan

None — plan executed exactly as written. Both files match the action-body code block byte-for-byte (modulo trivial formatting nits: I exported a `MutableRefObject` type import from 'react' alongside the other React types rather than qualifying it inline as `React.MutableRefObject<...>`; identical runtime behaviour, identical type constraint, and the plan's acceptance grep gates do not check the reference form).

### Auto-fixed issues

None. Zero Rule 1 / 2 / 3 fixes needed. Zero Rule 4 architectural questions arose.

### Auth gates

None. Plan is pure renderer code — no IPC wiring, no credentials, no external services.

## TDD Gate Compliance

Plan 02-02 was `type: execute` (not `type: tdd`). No `tdd="true"` tasks. No RED / GREEN / REFACTOR gate sequence required. Verification was post-write gate suite (typecheck + arch specs + full test suite + production bundle); all four gates passed on the first commit for each of the two tasks.

## Threat Flags

No new trust-boundary surface introduced. Both new files are pure renderer-layer UI; they consume the already-IPC-validated `SkeletonSummary` from `summary.ts` and contribute no new endpoints, schema changes, auth paths, or file-system access. The three threats declared in `02-02-PLAN.md` `<threat_model>` (T-02-02-01 XSS via row strings, T-02-02-02 XSS via search query, T-02-02-03 Layer 3 escape) are all mitigated in-code and asserted by the grep acceptance gates above — no residual risk flagged.

## Known Stubs

None. All rendered data flows from real sources:
- Row cells read from `DisplayRow` (produced by `src/core/analyzer.ts` — live, non-stub data).
- Header chip reads `summary.skeletonPath` (live from IPC).
- Selection count reads `selected.size` + `sorted.length` (live React state).
- Match highlight renders the actual substring index from the live query.
- Zero-results row interpolates the actual `query` state, not a hardcoded placeholder.

No hardcoded `peaks={[]}`, no "coming soon" text, no TODO markers, no placeholder prop-fed components. The one `placeholder` prop on `SearchBar` is the legitimate HTML `placeholder` attribute — a UX hint, not a stub.

## Foundations laid for Wave 3 (02-03)

- `GlobalMaxRenderPanel` has the same prop shape (`{ summary: SkeletonSummary }`) as the Phase 1 debug surface, so Plan 02-03's `App.tsx` flip is a one-line swap: change the import path and component name in the `loaded` state branch.
- `SearchBar` is exported as a named export — ready for reuse by future panels (e.g. Phase 5 Override Selector, Phase 8 Saved Sessions) if the 3-prop surface stays sufficient.
- The 7-column sort surface matches screenshot 1's layout; when Phase 4 Overrides add a batch ACTIONS rail, the `selected: Set<string>` state is already the authoritative source — the rail can read it through props lifted into `App.tsx` (Plan 02-03 will decide the lift pattern).
- The `suppressNextChangeRef` pattern is a reusable a11y-safe workaround for any future component needing a "click-with-modifier-pre-empts-default-toggle" flow — documented in the W-01 inline comments for future contributors.

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/renderer/src/components/SearchBar.tsx
- FOUND: src/renderer/src/panels/GlobalMaxRenderPanel.tsx

Commits verified to exist:
- FOUND: c43649d (feat SearchBar)
- FOUND: ed7b813 (feat GlobalMaxRenderPanel)

Grep gates verified:
- PASS: SearchBar exports `SearchBar` + `SearchBarProps`
- PASS: SearchBar has `aria-label="Clear search"` + `aria-label="Filter rows by attachment name"` + ESC handler + orange focus ring
- PASS: GlobalMaxRenderPanel exports `GlobalMaxRenderPanel` + `GlobalMaxRenderPanelProps`
- PASS: GlobalMaxRenderPanel imports SearchBar + DisplayRow + SkeletonSummary
- PASS: GlobalMaxRenderPanel has aria-sort, aria-label per-row + select-all, <mark> match highlight, tri-state indeterminate, shift-click, handleLabelClick, onChange={handleChange}
- PASS: `D-32` count ≥ 2 (W-02 compliance)
- PASS: no empty `onChange={() => {}}` anywhere
- PASS: no `dangerouslySetInnerHTML` anywhere
- PASS: no `new RegExp` in panel (T-02-02-02)
- PASS: no `src/core/*` import in either file (T-02-02-03 / Layer 3)
- PASS: no `DebugPanel` literal in either file (grep-literal compliance)

Integration verified:
- PASS: `npm run typecheck:web` exits 0
- PASS: `npm run test -- tests/arch.spec.ts` exits 0 (4 arch specs green)
- PASS: `npm run test` exits 0 (62 passed + 1 skipped — no regression from Plan 02-01's baseline)
- PASS: `npx electron-vite build` exits 0 (production bundle compiles; renderer JS 563.23 kB, CSS 16.68 kB)
