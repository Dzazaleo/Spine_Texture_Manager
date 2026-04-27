---
phase: 02-global-max-render-source-panel
reviewed: 2026-04-23T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - scripts/cli.ts
  - src/core/analyzer.ts
  - src/main/summary.ts
  - src/renderer/src/App.tsx
  - src/renderer/src/components/SearchBar.tsx
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/shared/types.ts
  - tests/arch.spec.ts
  - tests/core/analyzer.spec.ts
  - tests/core/ipc.spec.ts
  - tests/core/summary.spec.ts
  - electron.vite.config.ts
  - package.json
  - src/renderer/src/index.css
  - .gitignore
findings:
  critical: 0
  warning: 2
  info: 6
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-04-23T00:00:00Z
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

Phase 2 ("Global Max Render Source" panel) adds a pure-TypeScript
`src/core/analyzer.ts` that folds sampler `PeakRecord`s into `DisplayRow[]`
with dedup by `attachmentName`, a `SearchBar` component, a
`GlobalMaxRenderPanel` sortable/filterable/selectable table, `App.tsx`
wiring, and a Rule-4 CJS main-bundle fix for Node 24 ESM compatibility.

Overall quality is high. The design discipline is evident: the analyzer is
pure and zero-I/O, preformatted label fields are derived once and tested,
the renderer/core boundary is preserved (no `src/core/*` imports in any
renderer file), the IPC envelope stays `structuredClone`-safe, and the
`SerializableError` envelope continues to strip stack traces per
T-01-02-02.

Security posture of the requested attack surfaces:

- **XSS / injection:** No `dangerouslySetInnerHTML`, no `innerHTML`
  assignment, no `eval`. `highlightMatch` uses React fragments +
  `<mark>`; all user-supplied strings render as React text nodes, which
  React escapes automatically. Attachment names, skin names, animation
  names, and the skeleton path all render as children of JSX elements.
- **Untrusted-input regex:** Filter uses `String.prototype.includes` on
  lowercased query — no `new RegExp` is constructed from user input
  anywhere in the diff. No ReDoS surface.
- **Renderer/core boundary:** Verified by inspection and by
  `tests/arch.spec.ts` Layer 3 grep test. `App.tsx` and
  `GlobalMaxRenderPanel.tsx` import only from `../../shared/types.js`;
  `SearchBar.tsx` imports only React types. Clean.
- **IPC envelope leaks:** `SkeletonSummary` remains plain-JSON
  (`structuredClone` round-trip tested). `SerializableError` excludes
  stack traces (tested in `tests/core/ipc.spec.ts`).
- **Deterministic sort stability:** Analyzer sort is total-ordered by a
  3-key comparator (skin, slot, attachment); analyzer dedup has an
  explicit equal-`peakScale` tiebreaker (test
  "equal peakScale dedup tiebreaker" locks this). React `key` uniqueness
  post-dedup is tested (`new Set(keys).size === 3`).

Two WARN-level items concern deterministic-display stability in the panel
and a documentation mismatch between the shift-select spec and the
keyboard-activation path. Info items cover minor UX polish.

## Warnings

### WR-01: Panel `sortRows` loses tie-order stability when `dir === 'desc'`

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:76-80`
**Issue:** `sortRows` does `rows.slice().sort(compareRows).reverse()` for
the descending case. V8's `Array.prototype.sort` is stable (per ES2019
spec), so ties preserve the pre-sort order — but `Array.prototype.reverse`
reverses ALL elements including ties, which flips the relative order of
tied rows. In the `peakScale` column (the default, with many attachments
potentially sharing `peakScale === 1.000` for setup-pose peaks), this
means tied rows appear in the opposite order in ascending vs descending
views. Users clicking the same header twice to toggle direction see
neighbouring tied rows shuffle. This also breaks the "equal rows retain
analyzer (skin, slot, attachment) order" intuition that the CLI output
establishes.

**Fix:** Invert the comparator result instead of reversing the array so
the stable-sort guarantee carries through to the descending case:

```ts
function sortRows(rows: readonly DisplayRow[], col: SortCol, dir: SortDir): DisplayRow[] {
  const sign = dir === 'desc' ? -1 : 1;
  return rows.slice().sort((a, b) => sign * compareRows(a, b, col));
}
```

This also removes one array pass.

### WR-02: Shift+Space keyboard activation can trigger range-select despite "mouse-only" spec

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:140-167`
**Issue:** The component docstring (lines 13-18) and
`handleLabelClick`'s inline comment (line 184-186) both claim
"range-select is explicitly mouse-driven" and keyboard users only get
single-toggle. However, `handleLabelClick` fires on the wrapping
`<label>`'s click handler, which is triggered by BOTH mouse clicks AND
by keyboard activation of the nested `<input>` (Space/Enter). When a
keyboard user holds Shift and presses Space on a focused checkbox, the
synthesized `click` event includes `shiftKey: true` — so
`handleLabelClick` runs `onRangeToggle` and sets
`suppressNextChangeRef`, and the `change` event's handler returns early.
Result: Shift+Space on a keyboard performs a range-select AND the
visible checkbox state diverges from the intent (the browser's native
Space-toggles-the-box semantics is suppressed). This is an accessibility
surprise: the documented a11y guarantee ("keyboard-only users get
single-toggle; range-select is mouse-driven") is not enforced in code.

This is not a security bug, but it's a correctness gap versus spec and a
real-user-impact W-01-adjacent concern — users who rely on
Space-to-toggle will hit the range-select branch if they happen to
have Shift pressed.

**Fix:** Gate the shift-path on a `MouseEvent`-specific field that is
only true for actual pointer clicks. React's synthetic event's
`nativeEvent.detail` is `> 0` for real mouse clicks and `0` for
keyboard-synthesized clicks (see Web Platform Tests + the DOM Level 3
`UIEvent.detail` definition):

```ts
const handleLabelClick = useCallback(
  (e: MouseEvent<HTMLLabelElement>) => {
    // detail === 0 means this "click" was synthesized from a keyboard
    // activation (Space/Enter on the nested input). Honour the docstring:
    // range-select is mouse-only.
    if (e.shiftKey && e.detail > 0) {
      suppressNextChangeRef.current = row.attachmentKey;
      onRangeToggle(row.attachmentKey);
    }
  },
  [onRangeToggle, row.attachmentKey, suppressNextChangeRef],
);
```

Alternatively (simpler, no behaviour change for mice): drop the
`<label>` wrapping and install the shift-click handler on a sibling
`<td>` or on the `<input>` `onClick` directly — the input's click handler
receives the same `shiftKey` for mouse clicks and will not fire for
Space/Enter (only the `change` handler does).

## Info

### IN-01: Inactive sort-header arrow glyph matches the ascending glyph

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:115`
**Issue:** `const arrow = !isActive ? '▲' : dir === 'asc' ? '▲' : '▼'`.
Inactive columns show `▲` — visually indistinguishable from an active
ascending column. The colour differs (`text-fg-muted` vs `text-accent`),
but the glyph carries the same meaning to a user glancing at the table,
and the `aria-sort="none"` only reaches screen-reader users. New users
may click a header expecting "toggle from asc to desc" when it's
actually "jump to this column, reset to asc" (D-30).
**Fix:** Use a neutral glyph (e.g. `↕`, `⇅`, or an empty string) for the
inactive case:

```ts
const arrow = !isActive ? '↕' : dir === 'asc' ? '▲' : '▼';
```

### IN-02: Empty-state message interpolates raw query into surrounding quotes

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:419`
**Issue:** `'No attachments match "' + query + '"'` — if the user types
a query containing a double-quote (e.g. `foo"bar`), the rendered string
becomes `No attachments match "foo"bar"`, which is visually confusing.
Not a security issue (React escapes the text), just UX.
**Fix:** Use a React expression with the query already truthy (since
the conditional already checks `query.trim() !== ''`) and consider a
stylistic container:

```tsx
{query.trim() !== '' ? (
  <>No attachments match <code className="font-mono">{query.trim()}</code></>
) : (
  'No attachments'
)}
```

Also: the bare `query` here is the un-trimmed value; the filter uses
`query.trim().toLowerCase()`. If the user types trailing whitespace,
the message shows the whitespace inside the quotes while the filter
logic silently trimmed it. Using `query.trim()` for display keeps the
two consistent.

### IN-03: CLI `renderTable` assumes every row string is non-null

**File:** `scripts/cli.ts:117`
**Issue:** `if (r[c].length > widths[c])` indexes `rows[*]` by column
without a null check. Today all producers are `String(...)` /
`.toFixed(...)` / template literals, so every cell is a non-empty
string and the access is safe. However, the header row is built by
literal strings and the body rows are built from `DisplayRow` fields —
if a future `DisplayRow` field is ever optional (e.g. `animationName?`
if static-pose-only rows are emitted), `String(undefined)` becomes
`'undefined'` which is misleading. Defensive coding suggestion, not a
live bug.
**Fix:** Add a type-level guard keeping `DisplayRow` fields
non-optional (already enforced in `src/shared/types.ts` — document this
invariant in the CLI file comment, or coerce with `r[c] ?? ''` for
defence in depth).

### IN-04: `SortHeader`'s button has no `title`/tooltip and no clear click-affordance cursor

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:125-135`
**Issue:** The `<button>` inside each `<th>` is styled with
`hover:text-accent` but no `cursor-pointer` and no explanatory
`title`/`aria-label` beyond the visible label. Users discovering the
sort feature by hover have to guess. A `title={`Sort by ${label} (${dir
=== 'asc' ? 'ascending' : 'descending'})`}` would make the interaction
self-documenting. Minor UX polish.
**Fix:** Add `title` on the button and `className="cursor-pointer"`.

### IN-05: `handleRangeToggle` uses `visibleKeys.indexOf` twice per shift-click

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:312-313`
**Issue:** `visibleKeys.indexOf(lastClicked)` and
`visibleKeys.indexOf(key)` each walk the array. For small panels this
is fine; but the Phase 2 spec envisages large skeletons with hundreds
or thousands of attachments. Since perf is out of v1 scope, flagging as
info only.
**Fix (optional, when perf matters):** Precompute a
`Map<string, number>` of key→index alongside `visibleKeys` in the same
`useMemo`:

```ts
const visibleIndex = useMemo(() => {
  const m = new Map<string, number>();
  for (let i = 0; i < visibleKeys.length; i++) m.set(visibleKeys[i], i);
  return m;
}, [visibleKeys]);
```

### IN-06: `App.tsx` console.log leaks full skeleton summary to devtools in all builds

**File:** `src/renderer/src/App.tsx:52-57`
**Issue:** The D-17 `console.log('[Spine Texture Manager] Loaded
skeleton summary:', state.summary)` fires unconditionally on every
successful load, including in packaged production builds. The file's
own docblock flags this as a Phase 9 concern ("In production builds
(app.isPackaged), consider reducing console verbosity"). The full
`SkeletonSummary` includes the absolute `skeletonPath` and `atlasPath`
— benign for a desktop app, but a polish item before release.
**Fix (Phase 9 tracker):** Gate the log on `import.meta.env.DEV` so
packaged builds emit nothing. No change needed now; already tracked.

---

_Reviewed: 2026-04-23T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
