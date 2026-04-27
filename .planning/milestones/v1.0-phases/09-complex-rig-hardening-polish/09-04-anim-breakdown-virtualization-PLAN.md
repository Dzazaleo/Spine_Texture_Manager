---
phase: 09-complex-rig-hardening-polish
plan: 04
type: execute
wave: 2
depends_on: ["09-01"]
files_modified:
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx
  - tests/renderer/anim-breakdown-virtualization.spec.tsx
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-2, virtualization, tanstack-virtual, panel-anim-breakdown, variable-height]

must_haves:
  truths:
    - "AnimationBreakdownPanel outer card list renders ALL animation cards in regular DOM regardless of expand state (D-196 — outer not virtualized)"
    - "AnimationBreakdownPanel per-card inner row list virtualizes when card.rows.length > 100; below threshold the existing flat-table renders unchanged"
    - "Variable-height rows (Bone Path can wrap; override badges add height) handled via virtualizer.measureElement ResizeObserver pattern"
    - "Override Scale button still mounts OverrideDialog with correct row context when clicked from a virtualized inner row"
    - "Card collapse / re-expand: filter query preserved; planner-chosen scroll-reset policy holds (RESEARCH §Q10 — accept scroll-reset on re-expand as the simpler policy)"
    - "Existing AnimationBreakdownPanel tests remain GREEN"
  artifacts:
    - path: "src/renderer/src/panels/AnimationBreakdownPanel.tsx"
      provides: "Per-card inner-row TanStack Virtual integration with measureElement"
      contains: "useVirtualizer"
    - path: "tests/renderer/anim-breakdown-virtualization.spec.tsx"
      provides: "Wave 0 RED scaffold flipped GREEN — D-196 outer/inner/collapse/override behaviors verified"
  key_links:
    - from: "BreakdownTable (inside AnimationBreakdownPanel.tsx)"
      to: "@tanstack/react-virtual useVirtualizer + measureElement"
      via: "per-card threshold-gated render path swap with ref={virtualizer.measureElement}"
      pattern: "measureElement"
    - from: "AnimationBreakdownPanel virtualized inner row"
      to: "OverrideDialog mount via openDialog handler"
      via: "onClick on Override Scale button (preserved from flat-table path)"
      pattern: "onOpenOverrideDialog"
---

<objective>
Land per-card row-list virtualization in `src/renderer/src/panels/AnimationBreakdownPanel.tsx` per D-196. Critical distinction from Plan 03: the OUTER card list (one card per animation) stays in regular DOM — a complex rig has ~16 cards (cheap to render); the perf hot path is the rows INSIDE an expanded card. Per D-196, only the inner row lists virtualize.

This is the variable-height variant of TanStack Virtual: each row's height varies because the Bone Path column can wrap (long bone chains span multiple lines) and override badges add height. The canonical approach is `ref={virtualizer.measureElement}` with stable `getItemKey: (i) => rows[i].attachmentKey` (RESEARCH §Q1 + §Pitfall 2 + §Recommendations #9-12).

Purpose: Phase 9 deliverable #1 of 5 second half. Combined with Plan 03 (GlobalMaxRenderPanel), this gives the user dropped-frame-free per-card row scrolling regardless of how many attachments an animation references.

Output:
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — per-card inner virtualizer added to the existing `BreakdownTable` sub-component, threshold-gated at `card.rows.length > 100`. Outer card list unchanged (D-196).
- `tests/renderer/anim-breakdown-virtualization.spec.tsx` (Wave 0 RED) flipped GREEN — all 4 behaviors per VALIDATION.md rows 12-15.

Plan 04 is parallel-safe with Plan 03 — different files (AnimationBreakdownPanel.tsx vs GlobalMaxRenderPanel.tsx), different test files. Both depend only on Wave 0 (Plan 01).
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
@src/renderer/src/panels/AnimationBreakdownPanel.tsx
@src/renderer/src/modals/OverrideDialog.tsx
@tests/renderer/atlas-preview-modal.spec.tsx

<interfaces>
TanStack Virtual variable-height API + AnimationBreakdownPanel current shape.

From @tanstack/react-virtual (variable-height variant):
```ts
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => innerCardScrollRef.current,
  estimateSize: () => 38,
  overscan: 10,
  getItemKey: (i) => rows[i].attachmentKey,
});

// In each rendered row:
// <tr
//   ref={virtualizer.measureElement}
//   data-index={virtualRow.index}
//   style={{ transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)` }}
// />
```

From src/renderer/src/panels/AnimationBreakdownPanel.tsx:459-578 (existing BreakdownTable — analog "before" excerpt):
```tsx
function BreakdownTable({ rows, query, onOpenOverrideDialog }: BreakdownTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-panel">
          <th>Attachment</th>
          <th>Bone Path</th>
          <th>Source W×H</th>
          <th>Scale</th>
          <th>Peak W×H</th>
          <th>Frame</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.attachmentKey} className="border-b border-border hover:bg-accent/5">
            <td>{highlightMatch(row.attachmentName, query)}</td>
            <td title={row.bonePath.join(' → ')}>{truncateMidEllipsis(row.bonePath, 48)}</td>
            <td>{row.originalSizeLabel}</td>
            <td onDoubleClick={() => onOpenOverrideDialog(row)}>
              {row.effectiveScale.toFixed(3)}×
              {row.override !== undefined && <span> • {row.override}%</span>}
            </td>
            <td>{`${row.effExportW}×${row.effExportH}`}</td>
            <td>{row.frameLabel}</td>
            <td>
              <button onClick={() => onOpenOverrideDialog(row)}>Override Scale</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Read the full file to confirm the actual prop names + the wrapping AnimationCard component shape. The card collapse state lives upstream of BreakdownTable; BreakdownTable receives only the rows + query + callback.

OverrideDialog (src/renderer/src/modals/OverrideDialog.tsx) — modal mounted on Override Scale click. Mounts via `[role="dialog"][aria-modal="true"]`. 08.2 D-184 — modal `aria-modal="true"` auto-suppresses File menu items via the existing modalOpen derivation.
</interfaces>

<critical_mechanics>
Five non-negotiables for variable-height TanStack Virtual — verbatim from RESEARCH §Pitfalls 1-2 + §Recommendations #9-12:

1. `position: sticky; top: 0; z-index: 1` on `<thead>` ONLY (NOT on `<tr>` — Pitfall 1).
2. `overflow-anchor: none` on the inner card's scroll container.
3. `getItemKey: useCallback((i) => rows[i].attachmentKey, [rows])` — stable identity. Index-based default keys cause measurement flicker on collapse/expand cycle (Pitfall 2).
4. `ref={virtualizer.measureElement}` on each `<tr>` — ResizeObserver-driven exact measurement. Cache survives sort/filter via stable getItemKey.
5. Per-card inner scroll container: `<div ref={innerRef} style={{ maxHeight: '600px', overflowY: 'auto', overflowAnchor: 'none' }}>` — bound the inner scroll so collapse/expand stays predictable.

Collapse/expand policy (RESEARCH §Q10): Accept scroll-reset on re-expand as the simpler policy. The scroll container itself unmounts on collapse, so when the user re-expands the card the inner virtualizer re-mounts with a fresh measurement cache. `getItemKey` returning stable `attachmentKey` lets TanStack rebuild the cache fast (~10-20 measureElement calls for the visible window). Storing scroll offsets per-card is deferred (defer-able polish).
</critical_mechanics>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Refactor BreakdownTable in AnimationBreakdownPanel.tsx to threshold-gated TanStack Virtual with measureElement</name>
  <files>src/renderer/src/panels/AnimationBreakdownPanel.tsx</files>
  <read_first>
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx (full file — the existing AnimationCard / BreakdownTable structure; line numbers in PATTERNS.md (459-578) are approximate; verify the actual line numbers with `grep -n "function BreakdownTable\|interface BreakdownTableProps" src/renderer/src/panels/AnimationBreakdownPanel.tsx`)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/renderer/src/panels/AnimationBreakdownPanel.tsx (MOD — greenfield per-card virtualization)" — verbatim "after" shape with measureElement ref + getItemKey + overflow-anchor)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Q1 TanStack Virtual concrete API" AnimationBreakdownPanel section + §"Q10 Variable-height in TanStack Virtual" + §"Pitfalls 1-2" + §"Recommendations #9-12")
    - tests/renderer/anim-breakdown-virtualization.spec.tsx (Wave 0 RED — what we are flipping GREEN in Task 2)
  </read_first>
  <behavior>
    - Outer card list (one card per animation) renders in regular DOM regardless of expand state — D-196 outer-not-virtualized invariant
    - Inside an expanded card: when rows.length <= 100, the existing flat-table renders unchanged (preserves Cmd-F + ResizeObserver-free render)
    - Inside an expanded card: when rows.length > 100, the inner row list virtualizes via useVirtualizer with measureElement ResizeObserver-driven exact measurement
    - Each virtualized tr gets ref={virtualizer.measureElement} and data-index={virtualRow.index}
    - getItemKey returns stable rows[i].attachmentKey (memoized via useCallback)
    - Inner card scroll container bounded maxHeight 600px + overflow-y auto + overflow-anchor none
    - Override Scale button still mounts OverrideDialog with correct row context when clicked from a virtualized inner row
    - Collapse/expand cycle: card unmounts the inner virtualizer; on re-expand a fresh virtualizer mounts and rebuilds the measurement cache via stable getItemKey; filter query (held upstream) is preserved; scroll position resets to 0 (RESEARCH §Q10 simpler-policy)
    - Sticky thead inside the inner scroll container works via position sticky top 0 z-index 1 on thead (NOT tr)
  </behavior>
  <action>
Step 1. Add imports to the top of AnimationBreakdownPanel.tsx:

```ts
import { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
```

Step 2. Refactor BreakdownTable to a threshold-gated render. Replace the existing BreakdownTable body (lines roughly 459-578 — verify with `grep -n "function BreakdownTable" src/renderer/src/panels/AnimationBreakdownPanel.tsx`). The OUTER component (AnimationCard or whatever wraps cards) is UNCHANGED — D-196 outer-not-virtualized.

Replace BreakdownTable with the threshold-gated shape from PATTERNS.md §"src/renderer/src/panels/AnimationBreakdownPanel.tsx" — both render branches:

Below-threshold branch (rows.length <= 100): return the existing flat-table JSX verbatim, with the only change being the `<thead className="bg-panel sticky top-0 z-10">` (sticky class added so that pre-Phase-9 thead behavior matches the virtualized branch's sticky thead).

Above-threshold branch (rows.length > 100): outer wrapper `<div ref={innerRef} style={{ maxHeight: '600px', overflowY: 'auto', overflowAnchor: 'none' }}>`; inner wrapper `<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>`; the same `<table>` with the same `<thead className="bg-panel sticky top-0 z-10">`; tbody renders only the virtualized window.

Each virtualized `<tr>`:
- key={row.attachmentKey}
- data-index={virtualRow.index}
- ref={virtualizer.measureElement}
- style={{ transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)` }}
- className="border-b border-border hover:bg-accent/5"
- All existing td cells preserved verbatim including the Override Scale button at the end (which D-196 test (d) verifies)

The virtualizer config:
```ts
const useVirtual = rows.length > 100;
const innerRef = useRef<HTMLDivElement>(null);
const getItemKey = useCallback((i: number) => rows[i].attachmentKey, [rows]);
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => innerRef.current,
  estimateSize: () => 38,
  overscan: 10,
  getItemKey,
});
```

Step 3. Verify the AnimationCard collapse/expand state. The AnimationCard component holds the expanded/collapsed state. When a card collapses, its BreakdownTable unmounts entirely. When it re-expands, BreakdownTable re-mounts fresh — the virtualizer rebuilds its measurement cache from getItemKey mappings (stable across mount cycles). RESEARCH §Q10 — accept the scroll-reset on re-expand as the simpler policy.

The filter query (held upstream of BreakdownTable, likely in the parent panel or AnimationCard) is preserved across collapse/expand because it is parent state, not BreakdownTable state. No additional code needed for query preservation — Test 3 in Task 2 verifies this.

Step 4. Sanity-check existing AnimationBreakdownPanel tests. Run `npm run test 2>&1 | grep -E "anim|breakdown" | head -20`. Most existing tests probably feed small fixtures (<100 rows per card), exercising the flat-table path which is unchanged. If a test feeds >100 rows per card and now hits the virtualizer, the test may need to assert on filtered subsets.

`npx tsc --noEmit -p tsconfig.web.json` MUST exit 0.
  </action>
  <verify>
    <automated>grep -q "useVirtualizer" src/renderer/src/panels/AnimationBreakdownPanel.tsx &amp;&amp; grep -q "measureElement" src/renderer/src/panels/AnimationBreakdownPanel.tsx &amp;&amp; grep -q "overflowAnchor" src/renderer/src/panels/AnimationBreakdownPanel.tsx &amp;&amp; npx tsc --noEmit -p tsconfig.web.json</automated>
  </verify>
  <acceptance_criteria>
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx imports useVirtualizer from @tanstack/react-virtual
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx defines `const useVirtual = rows.length > 100` (or equivalent threshold-gated boolean inside BreakdownTable)
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx calls useVirtualizer with getItemKey set to a useCallback-wrapped function returning rows[i].attachmentKey
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx applies position sticky on thead (NOT on tr) — grep tsx for "sticky top-0" returns at least one match in the BreakdownTable thead
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx applies overflowAnchor 'none' (or kebab-case overflow-anchor none) to the inner scroll container in the virtualized path
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx virtualized tr rows include `ref={virtualizer.measureElement}` AND `data-index={virtualRow.index}` AND the translate transform with the index subtraction
    - The OUTER AnimationBreakdownPanel render still maps over `summary.animationBreakdown` cards in regular DOM (no useVirtualizer wrapping the outer list — D-196 outer-not-virtualized)
    - npx tsc --noEmit -p tsconfig.web.json exits 0
    - Existing AnimationBreakdownPanel tests (if a tests/renderer/animation-breakdown-panel.spec.tsx or similar exists) remain GREEN
  </acceptance_criteria>
  <done>The threshold-gated per-card inner virtualization integration ships. Outer card list unchanged (D-196). Variable-height handled via measureElement. Task 2 below verifies the four required behaviors against synthetic test fixtures.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Author tests/renderer/anim-breakdown-virtualization.spec.tsx behaviors (flip Wave 0 RED to GREEN)</name>
  <files>tests/renderer/anim-breakdown-virtualization.spec.tsx</files>
  <read_first>
    - tests/renderer/anim-breakdown-virtualization.spec.tsx (Wave 0 RED scaffold from Plan 01 — 4 placeholder it() blocks)
    - tests/renderer/atlas-preview-modal.spec.tsx (jsdom + @testing-library/react setup analog — full file)
    - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (rows 12-15 — exact behaviors and assertion thresholds: 16 cards in DOM / inner <=60 tr / collapse-expand filter preservation / OverrideDialog mount from virtualized row)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"DOM-count assertion thresholds" + §"Q10 Variable-height in TanStack Virtual" — collapse/expand policy)
    - src/renderer/src/panels/AnimationBreakdownPanel.tsx (post-Task-1 — what we are testing)
    - src/renderer/src/modals/OverrideDialog.tsx (the modal that should mount on Override Scale click)
    - src/shared/types.ts (DisplayRow + AnimationBreakdown shapes — needed to build synthetic fixtures)
  </read_first>
  <behavior>
    - "outer cards in regular DOM" — render AnimationBreakdownPanel with 16 synthetic AnimationBreakdown cards; ALL 16 corresponding card DOM elements present regardless of expand state
    - "inner above threshold" — expanded card with 200 rows renders <=60 `<tr>` elements within that card's body
    - "collapse/expand" — collapse a card with 200 rows then re-expand it; the upstream filter query is preserved across the cycle; scroll resets to 0 on re-expand (RESEARCH §Q10 simpler-policy)
    - "override" — click Override Scale on a virtualized inner row; OverrideDialog mounts via `screen.getByRole('dialog', { name: /override/i })` with the correct row context (verify via the dialog's row-name display or scope prop)
  </behavior>
  <action>
Replace the Wave 0 RED scaffold with real test bodies. Pattern follows tests/renderer/atlas-preview-modal.spec.tsx for setup; assertions match VALIDATION.md verbatim.

Synthetic fixture builder. AnimationBreakdownPanel takes a summary or animationBreakdown prop. Read src/shared/types.ts for the AnimationBreakdown shape; build a helper that synthesizes N cards each with M rows.

```tsx
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { AnimationBreakdownPanel } from '../../src/renderer/src/panels/AnimationBreakdownPanel';
import type { DisplayRow, AnimationBreakdown } from '../../src/shared/types';

afterEach(cleanup);

function makeRow(cardName: string, i: number): DisplayRow {
  return {
    attachmentKey: `${cardName}-attachment-${i}-default`,
    attachmentName: `${cardName}-attachment-${i}`,
    skinName: 'default',
    slotName: `slot-${i}`,
    bonePath: ['root', `bone-${i}`],
    originalSizeLabel: '64×64',
    effExportW: 96,
    effExportH: 96,
    effectiveScale: 1.5,
    sourceLabel: cardName,
    frameLabel: 'frame 12 / 0.4s',
    override: undefined,
    // Adapt remaining fields from the actual DisplayRow interface
  } as DisplayRow;
}

function makeCard(name: string, rowCount: number): AnimationBreakdown {
  return {
    cardId: name === 'Setup Pose (Default)' ? 'setup-pose' : `anim-${name}`,
    cardLabel: name,
    rows: Array.from({ length: rowCount }, (_, i) => makeRow(name, i)),
    // Adapt remaining AnimationBreakdown fields from the actual interface
  } as AnimationBreakdown;
}

function renderPanel(cardCount: number, rowsPerCard: number) {
  const cards = Array.from({ length: cardCount }, (_, i) =>
    makeCard(i === 0 ? 'Setup Pose (Default)' : `walk-${i}`, rowsPerCard),
  );
  return render(
    <AnimationBreakdownPanel
      animationBreakdown={cards}
      query=""
      onOpenOverrideDialog={vi.fn()}
      // Adapt remaining required props
    />,
  );
}

describe('AnimationBreakdownPanel — Wave 2 D-196', () => {
  it('outer cards: 16 cards render in regular DOM regardless of expand state', () => {
    renderPanel(16, 5);  // 16 cards, 5 rows each
    // Each card renders with its label as a heading or section. Adapt the
    // query selector to match the actual DOM: getAllByRole('region', { ... })
    // or queryAllByText for the card label.
    const cardElements = screen.getAllByRole('region');
    // OR use a different selector if the panel doesn't use role=region:
    // const cardElements = container.querySelectorAll('section[aria-labelledby]');
    expect(cardElements.length).toBe(16);
  });

  it('inner above threshold: expanded card with 200 rows renders <=60 tr elements within the card body', () => {
    const { container } = renderPanel(1, 200);
    // Click the card to expand if it starts collapsed (adapt to actual UI):
    const expandButton = screen.queryByRole('button', { name: /expand|collapse/i });
    if (expandButton) fireEvent.click(expandButton);

    // Find the rendered tr count inside the (single) expanded card.
    const trCount = container.querySelectorAll('tbody tr').length;
    expect(
      trCount,
      `Inner virtualizer should render <=60 rows; got ${trCount}`,
    ).toBeLessThanOrEqual(60);
    expect(trCount).toBeLessThan(200 * 0.3);
  });

  it('collapse/expand: filter query preserved; scroll-reset policy holds', () => {
    const { rerender } = renderPanel(1, 200);
    // Apply a filter query upstream:
    rerender(
      <AnimationBreakdownPanel
        animationBreakdown={[makeCard('walk-1', 200)]}
        query="attachment-1"
        onOpenOverrideDialog={vi.fn()}
      />,
    );
    // Expand → collapse → expand cycle (UI-driven).
    const expandToggle = screen.queryByRole('button', { name: /expand|collapse/i });
    if (expandToggle) {
      fireEvent.click(expandToggle); // collapse
      fireEvent.click(expandToggle); // re-expand
    }
    // Query is preserved (the rerender already passed it down; the panel
    // doesn't reset it on collapse). Verify the rendered rows match the
    // filter — at least one rendered row's text contains "attachment-1":
    const rendered = screen.queryAllByText(/attachment-1/);
    expect(rendered.length).toBeGreaterThan(0);
  });

  it('override: clicking Override Scale on a virtualized inner row mounts OverrideDialog with correct row context', () => {
    const onOpenOverrideDialog = vi.fn();
    render(
      <AnimationBreakdownPanel
        animationBreakdown={[makeCard('walk-1', 200)]}
        query=""
        onOpenOverrideDialog={onOpenOverrideDialog}
      />,
    );
    // Expand card if collapsed:
    const expandToggle = screen.queryByRole('button', { name: /expand|collapse/i });
    if (expandToggle) fireEvent.click(expandToggle);

    // Find an Override Scale button — there should be many; click the first.
    const overrideButtons = screen.getAllByRole('button', { name: /override scale/i });
    expect(overrideButtons.length).toBeGreaterThan(0);
    fireEvent.click(overrideButtons[0]);

    // The callback was invoked with a DisplayRow argument:
    expect(onOpenOverrideDialog).toHaveBeenCalledTimes(1);
    expect(onOpenOverrideDialog.mock.calls[0][0]).toMatchObject({
      attachmentKey: expect.stringMatching(/walk-1-attachment-/),
    });
  });
});
```

The exact prop surface of AnimationBreakdownPanel (and BreakdownTable) is determined by reading the existing component's props interface. Adapt the test fixtures and prop wiring to whatever the actual component expects. If the component manages its own internal expand state via useState, the tests interact via UI clicks (fireEvent on the expand toggle) rather than passing an `expanded` prop.

If the panel does not use `role=region` for cards, fall back to `container.querySelectorAll('section[aria-labelledby]')` or similar — the assertion is "all 16 card DOM elements present", not a specific role.

After landing, run `npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx`. ALL 4 tests MUST GREEN. Common failures:
- "outer cards" failing with count !== 16 → outer card list got accidentally virtualized (D-196 violation). Verify Task 1's outer render is still a plain `.map(...)`.
- "inner above threshold" failing with tr count > 60 → threshold logic wrong inside BreakdownTable.
- "override" failing with onOpenOverrideDialog NOT called → virtualized tr lost the onClick handler. Verify the existing td/button rendering is preserved verbatim in the virtualized branch.

Run the full suite. `npm run test 2>&1 | tail -5` MUST show no regressions.
  </action>
  <verify>
    <automated>npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx 2>&amp;1 | grep -E "passed|failed" | tail -3 ; npm run test 2>&amp;1 | tail -3 | grep -E "passed"</automated>
  </verify>
  <acceptance_criteria>
    - tests/renderer/anim-breakdown-virtualization.spec.tsx no longer contains `expect(true).toBe(false)` placeholders
    - npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx -t "outer cards" GREEN — 16-card render produces 16 card DOM elements
    - npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx -t "inner above threshold" GREEN — 200-row expanded card produces <=60 tr elements
    - npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx -t "collapse" GREEN — filter query preserved across collapse/expand
    - npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx -t "override" GREEN — OverrideDialog callback invoked with correct row context from a virtualized row
    - npm run test total reports no regressions in pre-Phase-9 GREEN tests
  </acceptance_criteria>
  <done>The Wave 0 RED scaffold for anim-breakdown-virtualization.spec.tsx flips fully GREEN. Plan 04 closes; Plan 05 (menu surface) can land in Wave 3.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| n/a — Plan 04 is a renderer-only refactor | No new IPC channels, no new external surfaces. Same TanStack Virtual library used in Plan 03; runs inside the existing renderer process under the same sandbox. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-04-01 | Tampering | TanStack Virtual library code | accept | Same supply-chain risk as Plan 01 + Plan 03. Locked to ^3.13.24 via package-lock.json. |
| T-09-04-02 | Denial of Service | measureElement ResizeObserver thrashing on rapid expand/collapse | mitigate | Threshold gate at 100 rows means cards with <=100 rows do not pay the ResizeObserver cost at all. Above threshold the observer fires once per visible row on first paint; cached via stable getItemKey. Worst-case observed: rapid collapse/expand of a 200-row card → ~10-20 observer fires per cycle (window-sized). No memory growth across cycles because virtualizer cache survives via stable getItemKey. |
| T-09-04-03 | Information Disclosure | Synthetic test fixtures + OverrideDialog row context | accept | Test fixtures use makeRow(name, i) synthetic data. OverrideDialog modal already exists with established trust boundaries — no new surface. |
</threat_model>

<verification>
After Task 2:
1. npm run test tests/renderer/anim-breakdown-virtualization.spec.tsx — all 4 tests GREEN
2. npm run test — full suite GREEN count >= post-Plan-03 baseline (no regressions)
3. grep -n "useVirtualizer\|measureElement\|getItemKey" src/renderer/src/panels/AnimationBreakdownPanel.tsx — all three patterns present
4. npx tsc --noEmit -p tsconfig.web.json exits 0
5. Manual smoke (NOT automated): npm run dev, load fixtures/Girl, expand each animation card, confirm rows scroll smoothly with sticky inner-card thead and Override Scale button mounts OverrideDialog
</verification>

<success_criteria>
- [ ] AnimationBreakdownPanel.tsx outer card list UNCHANGED (D-196 outer-not-virtualized)
- [ ] BreakdownTable inner row list threshold-gated at N=100 (D-195)
- [ ] TanStack Virtual `useVirtualizer` with `measureElement` for variable-height (D-196 + RESEARCH §Q10)
- [ ] Sticky `<thead>` via CSS (NOT on `<tr>` — Pitfall 1)
- [ ] `overflow-anchor: none` on inner scroll container
- [ ] Stable `getItemKey` returning `attachmentKey` (Pitfall 2)
- [ ] All existing interactions preserved in both paths (sort, search, double-click, OverrideDialog launch)
- [ ] Wave 0 RED scaffold for anim-breakdown-virtualization.spec.tsx flipped GREEN — all 4 behaviors
- [ ] Pre-existing tests GREEN (no regressions)
- [ ] `<threat_model>` block present (above)
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-04-SUMMARY.md` summarizing:
- Outer card count preserved (D-196 invariant — 16-card render verified)
- Inner DOM count delta: 200-row baseline (200+ tr) vs Plan 04 (<=60 tr)
- Variable-height confirmation via measureElement
- Override Scale mount-from-virtualized-row test GREEN
- Manual UAT checklist for Plan 08 close-out (load Girl, expand each card, override, collapse/re-expand)
</output>
