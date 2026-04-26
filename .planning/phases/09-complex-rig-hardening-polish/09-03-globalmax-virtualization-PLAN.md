---
phase: 09-complex-rig-hardening-polish
plan: 03
type: execute
wave: 2
depends_on: ["09-01"]
files_modified:
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - tests/renderer/global-max-virtualization.spec.tsx
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-2, virtualization, tanstack-virtual, panel-globalmax]

must_haves:
  truths:
    - "GlobalMaxRenderPanel below threshold (≤100 rows): renders all rows in regular DOM (preserves Cmd-F text search and zero virtualization overhead)"
    - "GlobalMaxRenderPanel above threshold (>100 rows): renders ≤60 <tr> elements (header + window of ≤59) regardless of total row count"
    - "Sticky <thead> stays at parent-relative top=0 during scroll in the virtualized path"
    - "Sort + search + per-row checkbox + OverrideDialog launch all function in BOTH the flat-table path and the virtualized path (no behavioral regression)"
    - "Existing Phase 1-7 tests in tests/renderer/global-max-render-panel.spec.tsx (or equivalent) remain GREEN"
  artifacts:
    - path: "src/renderer/src/panels/GlobalMaxRenderPanel.tsx"
      provides: "Threshold-gated TanStack Virtual integration"
      contains: "useVirtualizer"
    - path: "tests/renderer/global-max-virtualization.spec.tsx"
      provides: "Wave 0 RED scaffold flipped GREEN — D-191/D-195 + sticky thead behaviors verified"
  key_links:
    - from: "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (useVirtual = sorted.length > 100)"
      to: "@tanstack/react-virtual useVirtualizer"
      via: "threshold-gated render path swap"
      pattern: "useVirtualizer"
    - from: "src/renderer/src/panels/GlobalMaxRenderPanel.tsx <thead>"
      to: "CSS sticky positioning"
      via: "className with position:sticky top:0 z-index:1 on <thead>"
      pattern: "sticky"
---

<objective>
Land TanStack Virtual row virtualization in `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` per D-191 + D-192 + D-195. Threshold-gated at N=100 rows: below the threshold, the existing flat-table JSX renders unchanged (preserves Cmd-F text search and zero virtualization overhead — important for SIMPLE_PROJECT and Jokerman); above, the virtualizer takes over.

Sticky `<thead>` behavior preserved per RESEARCH §Q1 + §Recommendations #10 (apply `position: sticky` to `<thead>`, NEVER to `<tr>` inside `<tbody>` — Pitfall 1). All existing interactions (sort headers, search filter, per-row checkbox, OverrideDialog launch) MUST function identically in the virtualized path.

Purpose: Phase 9 deliverable #1 of 5 lands here. Combined with Plan 04 (AnimationBreakdown virtualization), this gives the user dropped-frame-free scrolling on `fixtures/Girl` (~80 attachments × multiple skins → can produce 300+ rows when expanded by skin filter) and any future production rig of arbitrary size.

Output:
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` extended with: useVirtualizer hook, parentRef, getItemKey memoized to `attachmentKey`, threshold-gated render path (flat below ≤100, virtualized above), sticky `<thead>` preserved via CSS, `overflow-anchor: none` on outer scroll container
- `tests/renderer/global-max-virtualization.spec.tsx` (Wave 0 RED) flipped GREEN — all 4 behaviors per VALIDATION.md rows 8-11
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md
@.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md
@CLAUDE.md
@src/renderer/src/panels/GlobalMaxRenderPanel.tsx
@src/renderer/src/components/SearchBar.tsx
@tests/renderer/atlas-preview-modal.spec.tsx

<interfaces>
<!-- TanStack Virtual API surface — what the executor uses verbatim. -->

From @tanstack/react-virtual (v3.13.24):
```ts
import { useVirtualizer } from '@tanstack/react-virtual';

const virtualizer = useVirtualizer({
  count: number,
  getScrollElement: () => HTMLDivElement | null,
  estimateSize: (index: number) => number,
  overscan: number,
  getItemKey: (index: number) => string | number,
});

// virtualizer.getVirtualItems(): Array<{ index, key, size, start, end, ... }>
// virtualizer.getTotalSize(): number
// virtualizer.measureElement: (HTMLElement | null) => void
// virtualizer.scrollToIndex(idx, { align: 'start' | 'center' | 'end' })
```

From src/renderer/src/panels/GlobalMaxRenderPanel.tsx:683-775 (existing flat-table — analog "before" excerpt; the executor preserves this verbatim for the below-threshold render path):
```tsx
<table className="w-full border-collapse">
  <thead>
    <tr className="bg-panel">
      <th scope="col" className="py-2 px-3 border-b border-border w-8">
        <SelectAllCheckbox visibleKeys={visibleKeys} selected={selected} onBulk={setSelected} />
      </th>
      <SortHeader col="attachmentName" label="Attachment" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
      {/* ... 6 more SortHeader columns ... */}
    </tr>
  </thead>
  <tbody>
    {sorted.length === 0 && (
      <tr><td colSpan={8}>No attachments…</td></tr>
    )}
    {sorted.map((row) => (
      <Row
        key={row.attachmentKey}
        row={row}
        query={query}
        checked={selected.has(row.attachmentKey)}
        onToggle={handleToggleRow}
        onRangeToggle={handleRangeToggle}
        suppressNextChangeRef={suppressNextChangeRef}
        onJumpToAnimation={onJumpToAnimation}
        onOpenOverrideDialog={openDialog}
        selectedKeys={selectedAttachmentNames}
        isFlashing={isFlashing === row.attachmentName}
        registerRef={(el) => registerRowRef(row.attachmentName, el)}
      />
    ))}
  </tbody>
</table>
```

The Row component is already memoized (verify by reading the existing GlobalMaxRenderPanel.tsx imports + Row definition). It accepts a `style` prop OR can be wrapped in a styled `<tr>` — the virtualizer needs to apply `transform: translateY(...)` per row, which means either Row accepts a style prop OR the executor wraps each rendered Row in a styled `<tr>`. Read the existing Row component shape to pick the path of least churn.
</interfaces>

<critical_mechanics>
<!-- The five non-negotiables for TanStack Virtual table rendering — verbatim from RESEARCH §Pitfalls 1-2 + §Recommendations #9-12. -->

1. `position: sticky; top: 0; z-index: 1` on `<thead>` ONLY (NOT `<tr>` inside `<tbody>` — transforms break sticky stacking context per Pitfall 1).
2. `overflow-anchor: none` on the outer scroll container (prevents browser-driven scroll re-anchoring on sort/filter content-height changes).
3. `getItemKey: useCallback((i) => sorted[i].attachmentKey, [sorted])` — stable identity. Index-based default keys cause measurement flicker (Pitfall 2).
4. Row translate: `transform: translateY(${virtualRow.start - idx * virtualRow.size}px)` — table-row translate basis is the row's INITIAL position, not absolute scroll offset. The `idx * virtualRow.size` subtraction is documented in the official table example and is REQUIRED for `<tr>` rendering.
5. Inner div wrapper: `<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>` — gives the table its full virtual height so the scrollbar reflects the total row count.
</critical_mechanics>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Refactor GlobalMaxRenderPanel.tsx to threshold-gated TanStack Virtual</name>
  <files>src/renderer/src/panels/GlobalMaxRenderPanel.tsx</files>
  <read_first>
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (full file — the existing flat-table JSX at lines ~683-775 is the "before" excerpt; the existing Row sub-component definition + memoization shape; the existing sort/filter/checkbox state machinery; the existing registerRowRef + isFlashing wiring)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/renderer/src/panels/GlobalMaxRenderPanel.tsx (MOD — greenfield virtualization)" — exact "after" shape with the 5 non-negotiable mechanics)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Q1 TanStack Virtual concrete API" GlobalMaxRender section + §"Pitfalls 1-2" + §"Recommendations #9-12")
    - tests/renderer/global-max-virtualization.spec.tsx (Wave 0 — the 4 behaviors that MUST flip GREEN)
  </read_first>
  <behavior>
    - When `sorted.length <= 100`: existing flat-table JSX renders unchanged (preserves Cmd-F + zero virtualization overhead)
    - When `sorted.length > 100`: virtualized render path takes over with TanStack Virtual `useVirtualizer({ count: sorted.length, getScrollElement: () => parentRef.current, estimateSize: () => 34, overscan: 20, getItemKey: useCallback((i) => sorted[i].attachmentKey, [sorted]) })`
    - Sticky `<thead>` works in both paths (CSS sticky on `<thead>` only — Pitfall 1)
    - `overflow-anchor: none` on the outer scroll container in the virtualized path (RESEARCH §Recommendations #11)
    - All existing interactions function in BOTH paths: sort header click, search query filter, per-row checkbox toggle, OverrideDialog launch on double-click, registerRowRef for the cross-panel jump (focusAttachmentName), isFlashing animation
    - `virtualizer.scrollToIndex(0)` called when sortCol/sortDir/query changes in the virtualized path (RESEARCH §Q1 — scroll restoration on sort/filter)
    - The existing focusAttachmentName cross-panel jump still works in the virtualized path (call `virtualizer.scrollToIndex(idx)` when the focused row is outside the visible window — RESEARCH §"scrollToIndex after sort/filter")
  </behavior>
  <action>
The pattern from PATTERNS.md `<after_excerpt>` is verbatim — use it as the canonical shape. Below is the executor's exact implementation responsibility:

### Step 1: Add imports to the top of GlobalMaxRenderPanel.tsx

```ts
import { useCallback, useMemo, useRef } from 'react';  // useRef may already be imported; useCallback / useMemo too — verify and don't duplicate
import { useVirtualizer } from '@tanstack/react-virtual';
```

### Step 2: Inside the GlobalMaxRenderPanel component body, AFTER the existing `sorted` derivation but BEFORE the `return` statement

Add the virtualization machinery:

```ts
// Phase 9 Plan 03 D-191/D-195 — threshold-gated virtualization. Below 100
// rows: flat-table render path (preserves Cmd-F text search + zero
// virtualization overhead — SIMPLE_PROJECT, Jokerman). Above 100: TanStack
// Virtual takes over (Girl + future production rigs).
const useVirtual = useMemo(() => sorted.length > 100, [sorted.length]);

// Stable identity for measurement cache survival across sort/filter
// (RESEARCH §Pitfall 2 — index-based default keys cause measurement flicker).
const getItemKey = useCallback(
  (index: number) => sorted[index].attachmentKey,
  [sorted],
);

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: sorted.length,
  getScrollElement: () => parentRef.current,
  // Uniform-row table — 34 px is the current row height by inspection of
  // typography + padding (RESEARCH §Recommendations #12).
  estimateSize: () => 34,
  // 20 row overscan — well-tested default for tables of this size.
  overscan: 20,
  getItemKey,
});

// Phase 9 D-191 — scroll restoration on sort/filter. RESEARCH §Q1: when the
// row order or filter changes, snap to top so the user's "find a row" intent
// is satisfied via the search field rather than scroll memory.
useEffect(() => {
  if (!useVirtual) return;
  virtualizer.scrollToIndex(0);
}, [sortCol, sortDir, query, useVirtual, virtualizer]);

// Phase 9 D-191 — the existing focusAttachmentName cross-panel jump (Phase 7
// D-130) still needs to work in the virtualized path. Find the row's index
// in `sorted` and scrollToIndex; the existing registerRowRef + isFlashing
// continue to handle the visual flash once the row is mounted.
useEffect(() => {
  if (!useVirtual) return;
  if (focusAttachmentName === null) return;
  const idx = sorted.findIndex((r) => r.attachmentName === focusAttachmentName);
  if (idx >= 0) {
    virtualizer.scrollToIndex(idx, { align: 'center' });
  }
}, [focusAttachmentName, sorted, useVirtual, virtualizer]);
```

(If the existing component doesn't have `focusAttachmentName` as a prop or variable directly accessible, read the file to identify the variable name and adapt accordingly.)

### Step 3: Replace the existing `<table>...</table>` render with a threshold-gated swap

```tsx
// EXISTING (preserved unchanged in both paths):
const tableHeader = (
  <thead className="bg-panel sticky top-0 z-10">
    <tr>
      <th scope="col" className="py-2 px-3 border-b border-border w-8">
        <SelectAllCheckbox visibleKeys={visibleKeys} selected={selected} onBulk={setSelected} />
      </th>
      <SortHeader col="attachmentName" label="Attachment" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
      {/* ... other SortHeader cells preserved verbatim ... */}
    </tr>
  </thead>
);

if (!useVirtual) {
  // EXISTING flat-table render path — UNCHANGED below threshold (preserves
  // Cmd-F + zero virtualization overhead). Sticky thead via CSS works the
  // same way in both paths because <table>'s natural scroll container in
  // the parent panel layout supplies the position-relative context.
  return (
    <div className="..."> {/* existing wrapper unchanged */}
      <table className="w-full border-collapse">
        {tableHeader}
        <tbody>
          {sorted.length === 0 && (
            <tr><td colSpan={8} className="...">No attachments…</td></tr>
          )}
          {sorted.map((row) => (
            <Row
              key={row.attachmentKey}
              {/* ... all existing props preserved ... */}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// VIRTUALIZED render path — > 100 rows.
return (
  <div className="..."> {/* existing wrapper preserved */}
    <div
      ref={parentRef}
      // overflow-anchor: none prevents browser scroll re-anchoring on
      // content-height changes (RESEARCH §Recommendations #11).
      style={{ height: 'calc(100vh - 200px)', overflow: 'auto', overflowAnchor: 'none' }}
      // Tailwind alternative if the project prefers utility classes:
      // className="h-[calc(100vh-200px)] overflow-auto"
      // But overflow-anchor:none has no Tailwind utility — inline style required.
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
        }}
      >
        <table className="w-full border-collapse">
          {/* sticky thead — Pitfall 1: position:sticky goes on <thead>, NEVER
              on <tr> inside <tbody>. The transform on virtualized <tr>s
              creates stacking contexts that break sticky positioning. */}
          {tableHeader}
          <tbody>
            {virtualizer.getVirtualItems().map((virtualRow, idx) => {
              const row = sorted[virtualRow.index];
              return (
                <Row
                  key={row.attachmentKey}
                  row={row}
                  {/* ... existing props verbatim ... */}
                  // Per RESEARCH §Q1: translate basis is row's INITIAL
                  // position, not absolute scroll offset. The (idx * size)
                  // subtraction is required for <tr> rendering per the
                  // official TanStack Virtual table example.
                  style={{
                    transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)`,
                  }}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

### Step 4: Update the Row component if it does not currently accept a `style` prop

If `Row` is defined inline in this file or imported from a sibling, check whether it accepts a `style?: React.CSSProperties` prop and forwards it to the rendered `<tr>`. If not, add the prop:

```tsx
// Inside Row's props interface:
interface RowProps {
  // ... existing props ...
  style?: React.CSSProperties;  // Phase 9 Plan 03 — virtualizer transforms
}

// Inside Row's render:
<tr ref={...} style={props.style} className={...}>
  {/* existing cells ... */}
</tr>
```

If Row already has a `style` prop merging via `{...style}` spread, no change needed.

### Step 5: Sanity-check the existing tests

Run `npm run test tests/renderer/global-max-render-panel.spec.tsx` (or the existing GlobalMaxRender test file — confirm the exact filename via `ls tests/renderer/`). The pre-existing tests MUST stay GREEN. Most existing tests probably operate on small fixtures (<100 rows), exercising the flat-table path which is unchanged. If a test feeds >100 rows and now hits the virtualizer, audit it: the test may need to assert on filtered subsets rather than scanning all rendered DOM.

If the existing test file does not exist (only the Wave 0 virtualization spec exists), this step is a no-op.
  </action>
  <verify>
    <automated>npm run test tests/renderer/global-max-virtualization.spec.tsx && grep -q "useVirtualizer" src/renderer/src/panels/GlobalMaxRenderPanel.tsx && grep -q "overflowAnchor" src/renderer/src/panels/GlobalMaxRenderPanel.tsx && grep -q "getItemKey" src/renderer/src/panels/GlobalMaxRenderPanel.tsx && npx tsc --noEmit -p tsconfig.web.json && npm run test 2>&1 | tail -5 | grep -E "passed"</automated>
  </verify>
  <acceptance_criteria>
    - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` imports `useVirtualizer` from `@tanstack/react-virtual`
    - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` defines `const useVirtual = useMemo(() => sorted.length > 100, [sorted.length])` (or equivalent threshold-gated boolean)
    - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` calls `useVirtualizer` with `getItemKey` set to a useCallback-wrapped function returning `sorted[i].attachmentKey`
    - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` applies `position: sticky; top: 0; z-index: ...` to `<thead>` (NOT `<tr>` inside `<tbody>`) — grep `tsx` for `sticky top-0` returns at least one match in the thead block
    - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` applies `overflowAnchor: 'none'` (or the kebab-case CSS variant `overflow-anchor: none`) to the outer scroll container in the virtualized path
    - `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` virtualized `<tr>` rows receive `style={{ transform: \`translateY(${virtualRow.start - idx * virtualRow.size}px)\` }}` (the index subtraction MUST be present — it is the table-row translate-basis fix per RESEARCH §Q1)
    - `npx tsc --noEmit -p tsconfig.web.json` exits 0
    - Existing GlobalMaxRender tests (if a `tests/renderer/global-max-render-panel.spec.tsx` or similar exists) remain GREEN
  </acceptance_criteria>
  <done>The threshold-gated virtualization integration ships in GlobalMaxRenderPanel.tsx; the flat-table path is preserved unchanged below ≤100 rows; the virtualized path mounts above; existing interactions are preserved in both paths. Task 2 below verifies the four required behaviors against a synthetic test fixture.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author tests/renderer/global-max-virtualization.spec.tsx behaviors (flip Wave 0 RED → GREEN)</name>
  <files>tests/renderer/global-max-virtualization.spec.tsx</files>
  <read_first>
    - tests/renderer/global-max-virtualization.spec.tsx (Wave 0 RED scaffold from Plan 01 — 4 placeholder it() blocks)
    - tests/renderer/atlas-preview-modal.spec.tsx (jsdom + @testing-library/react setup analog — full file)
    - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (rows 8-11 — exact behaviors, exact assertion thresholds: 51 rows / ≤60 rows / sticky thead / sort+search+checkbox)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"DOM-count assertion thresholds" + §"Q9 sticky-header + virtualizer interaction")
    - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (post-Task-1 — what we are testing)
    - src/shared/types.ts (DisplayRow + SkeletonSummary shapes — needed to build synthetic fixtures)
  </read_first>
  <behavior>
    - "below threshold (50 rows)": render GlobalMaxRenderPanel with 50 synthetic DisplayRow rows; `screen.getAllByRole('row').length === 51` (header + 50 data rows)
    - "above threshold (200 rows)": render GlobalMaxRenderPanel with 200 synthetic DisplayRow rows; `screen.getAllByRole('row').length <= 60` (header + ≤59 visible)
    - "sort/search/checkbox preserved": with 200 rows, click a sort header (DOM updates), type into search (filter applies), toggle a per-row checkbox (selection state updates) — all without throwing
    - "sticky thead": with 200 rows, scroll the parent container by 1000 px; `<thead>.getBoundingClientRect().top` stays at the parent-relative top (0 within the scroll container's local coordinate system)
  </behavior>
  <action>
Replace the Wave 0 RED scaffold with the actual test bodies. The pattern follows `tests/renderer/atlas-preview-modal.spec.tsx` for setup; the assertions match VALIDATION.md verbatim.

**Synthetic fixture builder.** GlobalMaxRenderPanel takes `rows: DisplayRow[]` (or accesses them via a `summary` prop). Build a helper that synthesizes N rows with stable `attachmentKey` strings. Read `src/shared/types.ts` for the DisplayRow shape; build only the fields the component reads (most are display-strings + numbers).

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import type { DisplayRow } from '../../src/shared/types';

afterEach(cleanup);

function makeRow(i: number): DisplayRow {
  // Build a structurally valid DisplayRow. Adapt field names to match the
  // actual shape in src/shared/types.ts. The KEY field is attachmentKey
  // (used by getItemKey). Other fields can be filler.
  return {
    attachmentKey: `attachment-${i}-default`,
    attachmentName: `attachment-${i}`,
    skinName: 'default',
    slotName: `slot-${i}`,
    bonePath: ['root', `bone-${i}`],
    originalSizeLabel: '64×64',
    effExportW: 96,
    effExportH: 96,
    effectiveScale: 1.5,
    sourceLabel: 'walk',
    frameLabel: 'frame 12 / 0.4s',
    override: undefined,
    // ... other fields filled from the actual interface ...
  } as DisplayRow;
}

function renderPanel(rowCount: number) {
  const rows = Array.from({ length: rowCount }, (_, i) => makeRow(i));
  // Adapt props to whatever GlobalMaxRenderPanel actually expects. May need
  // a minimal `summary` shim and onJumpToAnimation / onOpenOverrideDialog
  // mocks. Use vi.fn() for callbacks.
  return render(
    <GlobalMaxRenderPanel
      rows={rows}
      // ... other required props with vi.fn() callbacks ...
    />,
  );
}

describe('GlobalMaxRenderPanel — Wave 2 D-191 / D-195', () => {
  it('below threshold (50 rows): getAllByRole("row").length === 51 (header + 50 data rows)', () => {
    renderPanel(50);
    expect(screen.getAllByRole('row').length).toBe(51);
  });

  it('above threshold (200 rows): getAllByRole("row").length <= 60 (header + window of <=59)', () => {
    renderPanel(200);
    const rowCount = screen.getAllByRole('row').length;
    expect(
      rowCount,
      `Virtualized path should render <=60 rows; got ${rowCount}`,
    ).toBeLessThanOrEqual(60);
    // Also assert the virtualization is actually doing work (>= 70% reduction)
    expect(rowCount).toBeLessThan(200 * 0.3);
  });

  it('sort/search/checkbox preserved in virtualized path (200 rows)', () => {
    renderPanel(200);
    // Click a sort header (Attachment column)
    const attachmentHeader = screen.getByRole('columnheader', { name: /attachment/i });
    fireEvent.click(attachmentHeader);
    // Should not throw; the panel re-renders with sorted rows.
    expect(screen.getAllByRole('row').length).toBeLessThanOrEqual(60);

    // Type into search (if SearchBar is mounted inside the panel)
    const searchInput = screen.queryByRole('searchbox');
    if (searchInput) {
      fireEvent.change(searchInput, { target: { value: 'attachment-1' } });
      // Filter applies; render still works without throwing.
      expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    }

    // Toggle a per-row checkbox if SelectAllCheckbox or per-row checkboxes
    // are exposed via accessible roles.
    const checkboxes = screen.queryAllByRole('checkbox');
    if (checkboxes.length > 0) {
      fireEvent.click(checkboxes[0]);
      // Should not throw.
    }
  });

  it('sticky thead: outer scroll keeps thead at parent-relative top=0', () => {
    const { container } = renderPanel(200);
    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();

    // jsdom doesn't fully implement layout / IntersectionObserver / sticky
    // CSS, but we can assert the className applies position:sticky.
    // RESEARCH §Q9 — "jsdom-limited: scrollTop mutation may need
    // Element.prototype.scrollTop polyfill". This assertion is a className
    // contract check; visual sticky behavior is verified manually in UAT.
    const computed = thead!.className;
    expect(computed).toMatch(/sticky/);
    expect(computed).toMatch(/top-0/);
  });
});
```

If the GlobalMaxRenderPanel component requires a more elaborate prop surface (e.g., it consumes `summary: SkeletonSummary` directly rather than a flat `rows` prop), build a minimal `makeSummary(rowCount)` helper that wraps `makeRow(...)` in a SkeletonSummary shape. The exact prop surface is determined by reading the component's actual props interface — adapt the test fixtures accordingly.

After landing the tests, run `npm run test tests/renderer/global-max-virtualization.spec.tsx`. ALL 4 tests MUST GREEN. If any fails:

- "below threshold" failing with row count > 51 → the threshold gate is wrong (off-by-one). Verify Task 1's `useVirtual = useMemo(() => sorted.length > 100, ...)` — at exactly 100 rows the flat path renders; at 101+ the virtualizer kicks in. 50 rows is well below; expect 51 total elements.
- "above threshold" failing with row count > 60 → overscan is too high or virtualizer count is wrong. RESEARCH §Q1 budgets overscan: 20 + visible window ~30 = 50 typical. 60 is the conservative bound.
- "sort/search/checkbox" failing with throw → an existing prop wiring broke when threading through the virtualized `<tr>`. Check the Row component's `style` prop forwarding.
- "sticky thead" failing → className doesn't contain `sticky` / `top-0`. Task 1 didn't apply the sticky class to thead.

After GREEN locally, run the full suite. `npm run test 2>&1 | tail -5` MUST show no regressions; ANY pre-existing GREEN test that turns RED is a Phase 9 bug and MUST be fixed before this task closes.
  </action>
  <verify>
    <automated>npm run test tests/renderer/global-max-virtualization.spec.tsx 2>&1 | grep -E "passed|failed" | tail -3 && npm run test 2>&1 | tail -3 | grep -E "passed"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/renderer/global-max-virtualization.spec.tsx` no longer contains `expect(true).toBe(false)` placeholders; instead contains real `render(<GlobalMaxRenderPanel ... />)` calls and assertions matching VALIDATION.md rows 8-11
    - `npm run test tests/renderer/global-max-virtualization.spec.tsx -t "below threshold"` GREEN — 50-row render produces exactly 51 `<tr>` elements
    - `npm run test tests/renderer/global-max-virtualization.spec.tsx -t "above threshold"` GREEN — 200-row render produces ≤60 `<tr>` elements (≥70% reduction)
    - `npm run test tests/renderer/global-max-virtualization.spec.tsx -t "sort|search|checkbox"` GREEN — all 3 sub-assertions pass
    - `npm run test tests/renderer/global-max-virtualization.spec.tsx -t "sticky"` GREEN — className contains `sticky` + `top-0`
    - `npm run test` total reports no regressions in pre-Phase-9 GREEN tests
  </acceptance_criteria>
  <done>The Wave 0 RED scaffold for global-max-virtualization.spec.tsx flips fully GREEN. Plan 03 closes; Plan 04 (parallel — touches a different file) can land independently.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| n/a — Plan 03 is a renderer-only refactor | No new IPC channels, no new external surfaces. The TanStack Virtual library runs inside the existing renderer process under the same sandbox. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-03-01 | Tampering | TanStack Virtual library code | accept | Same supply-chain risk as Plan 01. Locked to `^3.13.24` via package-lock.json. |
| T-09-03-02 | Denial of Service | Mis-tuned overscan / huge row count → memory pressure | mitigate | Threshold gate at N=100 prevents virtualizer overhead on small rigs. Overscan: 20 (well-tested default). measureElement cache survives sort/filter via stable getItemKey. Worst-case observed: ~80 attachments × multiple skins → 200-300 rows; trivially handled. |
| T-09-03-03 | Information Disclosure | Synthetic test fixtures | accept | Tests use `makeRow(i)` synthetic data; no real fixtures crossed in test runs. Fixture files (Girl/Jokerman/SIMPLE_PROJECT) are committed in-repo with no secrets. |
</threat_model>

<verification>
After Task 2:
1. `npm run test tests/renderer/global-max-virtualization.spec.tsx` — all 4 tests GREEN
2. `npm run test` — full suite GREEN count >= post-Plan-02 baseline (no regressions in unrelated specs)
3. `grep -n "useVirtualizer\|getItemKey\|overflowAnchor" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — all three patterns present
4. `npx tsc --noEmit -p tsconfig.web.json` exits 0
5. Manual smoke (NOT automated): `npm run dev`, load fixtures/Girl, confirm panel renders >100 rows smoothly with sticky header
</verification>

<success_criteria>
- [ ] GlobalMaxRenderPanel.tsx threshold-gated at N=100 (D-191/D-195)
- [ ] TanStack Virtual `useVirtualizer` integration with stable `getItemKey` and overscan: 20
- [ ] Sticky `<thead>` via CSS (NOT on `<tr>` — Pitfall 1)
- [ ] `overflow-anchor: none` on outer scroll container
- [ ] All existing interactions preserved in both paths (sort, search, checkbox, OverrideDialog launch, focusAttachmentName jump)
- [ ] Wave 0 RED scaffold for global-max-virtualization.spec.tsx flipped GREEN — all 4 behaviors
- [ ] Pre-existing tests GREEN (no regressions)
- [ ] `<threat_model>` block present (above)
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-03-SUMMARY.md` summarizing:
- DOM count delta: 200-row baseline (200+ <tr>) vs Plan 03 (≤60 <tr>)
- Threshold value confirmation (N=100)
- Test count delta (Wave 0 RED rows for this plan flipped to GREEN)
- Manual UAT checklist for Plan 08 close-out (load Girl in dev, scroll, sort, search, override)
</output>
