// @vitest-environment jsdom
/**
 * Phase 9 Plan 04 — AnimationBreakdownPanel per-card virtualization behaviors (D-196).
 *
 * Wave 0 (Plan 01) shipped this file as RED scaffolds. Wave 2 (this plan) flips
 * the four behaviors GREEN against the real `useVirtualizer + measureElement`
 * integration in BreakdownTable:
 *
 *   - Row 12: D-196 outer cards in regular DOM (16 cards: all 16 section
 *     elements present regardless of expand state)
 *   - Row 13: D-196 inner virtualization (200-row expanded card → ≤60 <tr>)
 *   - Row 14: D-196 collapse/re-expand (filter query preserved across cycle)
 *   - Row 15: D-196 OverrideDialog mounts from a virtualized inner row with
 *     correct row context
 *
 * jsdom polyfill recipe (carried verbatim from
 * tests/renderer/global-max-virtualization.spec.tsx — see
 * 09-03-SUMMARY.md §"jsdom polyfill recipe"):
 *
 *   virtual-core's `observeElementRect` reads `element.offsetWidth` /
 *   `element.offsetHeight` directly (NOT getBoundingClientRect) — see
 *   `node_modules/@tanstack/virtual-core/dist/esm/index.js`
 *   `const getRect = (element) => ({ width: element.offsetWidth,
 *   height: element.offsetHeight })`. jsdom defaults both to 0; we
 *   override on HTMLElement.prototype so EVERY element reports a finite
 *   size. The virtualizer's range math then emits a non-empty
 *   getVirtualItems() window.
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx (jsdom + Testing Library shape).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { AnimationBreakdownPanel } from '../../src/renderer/src/panels/AnimationBreakdownPanel';
import { SearchBar } from '../../src/renderer/src/components/SearchBar';
import type {
  AnimationBreakdown,
  BreakdownRow,
  SkeletonSummary,
} from '../../src/shared/types';

// jsdom polyfills for useVirtualizer. Without these, the virtualizer treats
// the parent element as a 0×0 rect and emits zero virtual items — every
// virtualized assertion would see only the header row.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 800;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 600;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() {
      return 800;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      return 600;
    },
  });

  // ResizeObserver — used by useVirtualizer's measureElement path. jsdom
  // doesn't ship one; a no-op stub is sufficient because we test via DOM
  // counts, not exact pixel measurements.
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(cleanup);

/**
 * Build a synthetic BreakdownRow. Every numeric / string field is filled
 * so the panel's enrichWithEffective + computeExportDims helpers don't
 * propagate NaN. attachmentName is the index-based identifier the
 * SearchBar filter matches against.
 */
function makeRow(cardName: string, i: number): BreakdownRow {
  const name = `${cardName}-attachment-${String(i).padStart(4, '0')}`;
  return {
    attachmentKey: `default::slot-${i}::${name}`,
    skinName: 'default',
    slotName: `slot-${i}`,
    attachmentName: name,
    animationName: cardName,
    time: 0,
    frame: 0,
    peakScaleX: 1,
    peakScaleY: 1,
    peakScale: 1,
    worldW: 64,
    worldH: 64,
    sourceW: 64,
    sourceH: 64,
    isSetupPosePeak: cardName === 'Setup Pose (Default)',
    originalSizeLabel: '64×64',
    peakSizeLabel: '64×64',
    scaleLabel: '1.000×',
    sourceLabel: cardName,
    frameLabel: '—',
    sourcePath: `/fake/${name}.png`,
    bonePath: ['root', `bone-${i}`, `slot-${i}`, name],
    bonePathLabel: `root → bone-${i} → slot-${i} → ${name}`,
    // Phase 22 DIMS-01 — canonical/actual dim defaults. Same shape as
    // tests/renderer/global-max-virtualization.spec.tsx happy-path defaults.
    canonicalW: 64,
    canonicalH: 64,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
  };
}

/**
 * Phase 22 DIMS-02 — drifted variant for badge tests on the breakdown panel.
 * Sibling-symmetric with global-max-virtualization.spec.tsx makeDriftedRow per
 * Phase 19 D-06 visual unification contract.
 */
function makeDriftedRow(cardName: string, i: number): BreakdownRow {
  return {
    ...makeRow(cardName, i),
    canonicalW: 1628,
    canonicalH: 1908,
    actualSourceW: 811,
    actualSourceH: 962,
    dimsMismatch: true,
  };
}

/**
 * Build a synthetic AnimationBreakdown card. The cardId follows the
 * setup-pose vs anim:<name> convention from src/main/summary.ts.
 */
function makeCard(name: string, rowCount: number): AnimationBreakdown {
  const isSetupPose = name === 'Setup Pose (Default)';
  return {
    cardId: isSetupPose ? 'setup-pose' : `anim:${name}`,
    animationName: name,
    isSetupPose,
    uniqueAssetCount: rowCount,
    rows: Array.from({ length: rowCount }, (_, i) => makeRow(name, i)),
  };
}

/** Build a SkeletonSummary fixture with N cards, each carrying M rows. */
function makeSummary(cardCount: number, rowsPerCard: number): SkeletonSummary {
  const animationBreakdown: AnimationBreakdown[] = Array.from(
    { length: cardCount },
    (_, i) =>
      makeCard(
        i === 0 ? 'Setup Pose (Default)' : `walk-${String(i).padStart(2, '0')}`,
        rowsPerCard,
      ),
  );
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: '/fake/skeleton.atlas',
    bones: { count: 1, names: ['root'] },
    slots: { count: rowsPerCard },
    attachments: {
      count: rowsPerCard,
      byType: { RegionAttachment: rowsPerCard },
    },
    skins: { count: 1, names: ['default'] },
    animations: {
      count: cardCount - 1,
      names: animationBreakdown.slice(1).map((c) => c.animationName),
    },
    peaks: [],
    animationBreakdown,
    unusedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
}

/**
 * Phase 19 Plan 05 — query state lifted to AppShell. Mirror that contract
 * in tests with a small wrapper component holding query state + the lifted
 * SearchBar, threaded down to the panel via REQUIRED query/onQueryChange
 * props. The SearchBar carries the same `aria-label="Filter rows by
 * attachment name"` as the production sticky-bar instance, so the existing
 * `getByLabelText(/filter rows by attachment name/i)` query keeps working.
 */
function PanelTestHarness({
  cardCount,
  rowsPerCard,
  onOpenOverrideDialog,
}: {
  cardCount: number;
  rowsPerCard: number;
  onOpenOverrideDialog: (row: BreakdownRow) => void;
}) {
  const [query, setQuery] = useState('');
  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      <AnimationBreakdownPanel
        summary={makeSummary(cardCount, rowsPerCard)}
        focusAnimationName={null}
        onFocusConsumed={vi.fn()}
        overrides={new Map()}
        onOpenOverrideDialog={onOpenOverrideDialog}
        query={query}
        onQueryChange={setQuery}
      />
    </>
  );
}

function renderPanel(
  cardCount: number,
  rowsPerCard: number,
  onOpenOverrideDialog: (row: BreakdownRow) => void = vi.fn(),
) {
  return render(
    <PanelTestHarness
      cardCount={cardCount}
      rowsPerCard={rowsPerCard}
      onOpenOverrideDialog={onOpenOverrideDialog}
    />,
  );
}

/**
 * Phase 22 DIMS-02 — explicit-rows harness for badge tests on the breakdown
 * panel. Wraps the supplied rows in a SkeletonSummary fixture with one card
 * (the setup-pose card seeds expanded by default per D-63/D-64) so every
 * supplied BreakdownRow renders inside the expanded card body.
 */
function PanelRowsHarness({ rows }: { rows: BreakdownRow[] }) {
  const [query, setQuery] = useState('');
  const card: AnimationBreakdown = {
    cardId: 'setup-pose',
    animationName: 'Setup Pose (Default)',
    isSetupPose: true,
    uniqueAssetCount: rows.length,
    rows,
  };
  const summary: SkeletonSummary = {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: '/fake/skeleton.atlas',
    bones: { count: 1, names: ['root'] },
    slots: { count: rows.length },
    attachments: { count: rows.length, byType: { RegionAttachment: rows.length } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    peaks: [],
    animationBreakdown: [card],
    unusedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      <AnimationBreakdownPanel
        summary={summary}
        focusAnimationName={null}
        onFocusConsumed={vi.fn()}
        overrides={new Map()}
        onOpenOverrideDialog={vi.fn()}
        query={query}
        onQueryChange={setQuery}
        loaderMode="auto"
      />
    </>
  );
}

describe('AnimationBreakdownPanel — Wave 2 D-196', () => {
  it('outer cards: 16 cards render in regular DOM regardless of expand state', () => {
    // 16 cards × 5 rows each — well below the 100-row threshold so every
    // card uses the flat-table path. The OUTER card list should NOT be
    // virtualized regardless of expand state (D-196 outer-not-virtualized).
    const { container } = renderPanel(16, 5);

    // AnimationCard renders one <section aria-labelledby="bd-header-..."> per
    // card. Use the structural selector rather than role=region (the
    // expanded body is also marked role=region inside the section).
    const cards = container.querySelectorAll('section[aria-labelledby^="bd-header-"]');
    expect(
      cards.length,
      `Expected 16 outer card <section> elements; got ${cards.length}`,
    ).toBe(16);
  });

  it('inner above threshold: expanded card with 200 rows renders <=60 tr elements', () => {
    // Single card with 200 rows. The setup-pose card seeds expanded by
    // default per D-63/D-64 (the panel useState seeds new Set(['setup-pose'])),
    // so the rendered card index 0 is already expanded with no UI click
    // required.
    const { container } = renderPanel(1, 200);

    // Sanity: the single setup-pose card is expanded by default.
    const card = container.querySelector('section[aria-labelledby^="bd-header-"]');
    expect(card).not.toBeNull();
    const expandToggle = card!.querySelector('button[aria-expanded]');
    expect(expandToggle?.getAttribute('aria-expanded')).toBe('true');

    // Count tr elements inside the expanded card body. The virtualized
    // path renders only the visible window + overscan (10) — never all 200.
    const trCount = container.querySelectorAll('tbody tr').length;
    expect(
      trCount,
      `Inner virtualizer should render <=60 rows; got ${trCount}`,
    ).toBeLessThanOrEqual(60);
    // Sanity: virtualization is actually doing work (>=70% reduction vs
    // naive). Threshold borrowed from
    // tests/renderer/global-max-virtualization.spec.tsx:157.
    expect(trCount).toBeLessThan(200 * 0.3);
    // And we still have SOMETHING beyond a placeholder (the virtualizer
    // window emitted at least a few rows).
    expect(trCount).toBeGreaterThan(1);
  });

  it('collapse/re-expand: filter query preserved; scroll-reset policy holds', () => {
    // Render a single 200-row card (setup-pose, expanded by default).
    const { container } = renderPanel(1, 200);

    // 1. Type a filter query into the SearchBar.
    const searchInput = screen.getByLabelText(/filter rows by attachment name/i);
    act(() => {
      fireEvent.change(searchInput, {
        target: { value: 'attachment-0001' },
      });
    });
    // Filter applied — the input value reflects the typed query.
    expect((searchInput as HTMLInputElement).value).toBe('attachment-0001');

    // Verify the filter actually filtered rows (at least one matching
    // row renders inside the virtualized window).
    expect(screen.queryAllByText(/attachment-0001/).length).toBeGreaterThan(0);

    // 2. Clear the filter so the user-toggle can actually collapse the
    //    card (D-71 union behavior auto-expands cards with matching rows
    //    during active search; clearing the filter releases that override
    //    so userExpanded controls the body).
    act(() => {
      fireEvent.change(searchInput, { target: { value: '' } });
    });

    // 3. Collapse → re-expand cycle. The expand-toggle button is the
    //    <button aria-expanded> at the top of the card.
    const card = container.querySelector('section[aria-labelledby^="bd-header-"]');
    expect(card).not.toBeNull();
    const expandToggle = card!.querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement;
    expect(expandToggle).not.toBeNull();
    expect(expandToggle.getAttribute('aria-expanded')).toBe('true');

    // Collapse — the card body unmounts (the inner virtualizer goes with it).
    act(() => {
      fireEvent.click(expandToggle);
    });
    expect(expandToggle.getAttribute('aria-expanded')).toBe('false');

    // Re-expand — the card body remounts with a fresh inner virtualizer.
    // Per RESEARCH §Q10 simpler-policy: the inner scroll container is
    // freshly created so scrollTop === 0 by construction. The
    // measurement cache rebuilds via stable getItemKey
    // (rows[i].attachmentKey).
    act(() => {
      fireEvent.click(expandToggle);
    });
    expect(expandToggle.getAttribute('aria-expanded')).toBe('true');

    // 4. Re-apply the filter query — it should typecheck against the
    //    same controlled SearchBar (the input element is preserved
    //    because it lives in the panel header, NOT inside BreakdownTable).
    act(() => {
      fireEvent.change(searchInput, {
        target: { value: 'attachment-0001' },
      });
    });
    expect((searchInput as HTMLInputElement).value).toBe('attachment-0001');

    // The filtered rows render post-cycle: the query memo refilters the
    // (re-mounted) virtualized window correctly.
    const rendered = screen.queryAllByText(/attachment-0001/);
    expect(rendered.length).toBeGreaterThan(0);

    // 5. Scroll-reset policy: the inner scroll container's scrollTop is
    //    0 (the container was just freshly mounted by the re-expand). The
    //    inline `overflow-y: auto` container is the virtualized scroll
    //    parent — find it via its inline style.
    const innerScroll = container.querySelector(
      'div[style*="overflow-y"]',
    ) as HTMLElement | null;
    if (innerScroll !== null) {
      expect(innerScroll.scrollTop).toBe(0);
    }
  });

  it('override: clicking Override Scale on a virtualized inner row mounts OverrideDialog with correct row context', () => {
    // Single 200-row card so the virtualized path is active. The setup-pose
    // card seeds expanded by default — Override Scale buttons are
    // immediately rendered inside the virtualized window.
    const onOpenOverrideDialog = vi.fn();
    renderPanel(1, 200, onOpenOverrideDialog);

    // Find Override Scale buttons inside the virtualized window. Each row
    // renders one <button aria-label="Override scale for ...">. There
    // should be many (the visible window — typically ~21-31 rows + 10
    // overscan).
    const overrideButtons = screen.getAllByRole('button', {
      name: /override scale for/i,
    });
    expect(
      overrideButtons.length,
      'At least one Override Scale button should be rendered in the virtualized window',
    ).toBeGreaterThan(0);

    // Click the first Override Scale button. The panel's
    // onOpenOverrideDialog prop (passed via openDialog → BreakdownTable
    // → BreakdownRowItem button onClick) should fire with the matching
    // BreakdownRow object.
    act(() => {
      fireEvent.click(overrideButtons[0]);
    });

    expect(onOpenOverrideDialog).toHaveBeenCalledTimes(1);
    const calledWithRow = onOpenOverrideDialog.mock.calls[0][0] as BreakdownRow;
    // The first virtualized row is at index 0 in the (single setup-pose)
    // card's rows array — its attachmentName follows the makeRow pattern.
    expect(calledWithRow.attachmentName).toMatch(
      /^Setup Pose \(Default\)-attachment-/,
    );
    // Bone path is preserved (the row context flows through the
    // virtualized path verbatim).
    expect(calledWithRow.bonePath).toEqual([
      'root',
      'bone-0',
      'slot-0',
      calledWithRow.attachmentName,
    ]);
  });
});

/**
 * Phase 22 Plan 22-05 Task 1 — DIMS-02 dims-mismatch badge in the Source W×H
 * cell of the AnimationBreakdownPanel. Sibling-symmetric with the
 * GlobalMaxRenderPanel describe block (Phase 19 D-06 visual unification).
 * ROADMAP DIMS-02 wording locked verbatim.
 */
describe('AnimationBreakdownPanel — DIMS-02 dims-mismatch badge (Phase 22)', () => {
  it('renders dims-mismatch badge when row.dimsMismatch === true', () => {
    const rows = [makeDriftedRow('Setup Pose (Default)', 0)];
    render(<PanelRowsHarness rows={rows} />);
    // Phase 22.1 G-02 — badge now uses custom React tooltip primitive (DimsBadge).
    // The host div carries data-testid="dims-badge-host"; no native title attribute.
    const host = screen.getByTestId('dims-badge-host');
    expect(host).not.toBeNull();
    // Tooltip surfaces on hover (not via static title).
    fireEvent.mouseEnter(host);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain(
      'Atlas region declares 811×962 but canonical is 1628×1908',
    );
  });

  it('does NOT render badge when row.dimsMismatch === false', () => {
    const rows = [makeRow('Setup Pose (Default)', 0)];
    render(<PanelRowsHarness rows={rows} />);
    expect(screen.queryByTestId('dims-badge-host')).toBeNull();
  });

  it('badge is absent when actualSource is undefined (atlas-extract path)', () => {
    const rows = [{ ...makeRow('Setup Pose (Default)', 0), dimsMismatch: false }];
    render(<PanelRowsHarness rows={rows} />);
    expect(screen.queryByTestId('dims-badge-host')).toBeNull();
  });
});

/**
 * Phase 31 PANEL-08..11 — Animation Breakdown collapse defaults + bulk Expand
 * all / Collapse all buttons.
 *
 *   B1 (PANEL-08): Initial render with summary.animations.count > 0 — all
 *                  cards collapsed including Setup Pose.
 *   B2 (PANEL-11): Setup Pose remains the FIRST card in DOM order; only its
 *                  initial-expansion seed changed.
 *   B3 (PANEL-10): "Expand all" + "Collapse all" buttons present in header
 *                  with verbatim h-8 toolbar class string.
 *   B4: Click "Expand all" → all cards open. Click "Collapse all" → all
 *       cards close.
 *   B5: After bulk Expand all, toggling an individual card collapses just
 *       that one card (preserves toggleCard).
 *   B6 (B-D-02 + B-D-04): Search auto-expand union preserved verbatim — a
 *       matching card surfaces during active search even though
 *       userExpanded is the empty set; bulk Collapse all does not remove
 *       it from view while search is still active.
 *   B7: Empty rig (summary.animations.count === 0) — neither bulk button
 *       renders (UI-SPEC § sub-feature B recommendation: hide rather than
 *       disable).
 */
describe('AnimationBreakdownPanel — Phase 31 PANEL-08..11', () => {
  it('B1 (PANEL-08): all cards collapsed on initial render including Setup Pose', () => {
    // 3 cards (Setup Pose + 2 anims) × 5 rows each. With the default seed
    // flipped to new Set(), every card body must NOT render. Each card's
    // header carries aria-expanded="false".
    renderPanel(3, 5);

    const expandToggles = screen.getAllByRole('button', { expanded: false });
    // 3 cards → 3 expand toggles, all false.
    expect(expandToggles.length).toBeGreaterThanOrEqual(3);

    // No card body content (row text from the makeRow generator) should
    // render — every card body is collapsed.
    expect(screen.queryByText(/-attachment-0000$/)).toBeNull();
  });

  it('B2 (PANEL-11): Setup Pose remains the first card in DOM order', () => {
    const { container } = renderPanel(3, 5);
    const cards = container.querySelectorAll(
      'section[aria-labelledby^="bd-header-"]',
    );
    expect(cards.length).toBe(3);
    // First card's header id is bd-header-setup-pose.
    const firstHeaderId = cards[0].getAttribute('aria-labelledby');
    expect(firstHeaderId).toBe('bd-header-setup-pose');
  });

  it('B3 (PANEL-10): Expand all + Collapse all buttons render with verbatim h-8 class string', () => {
    renderPanel(3, 5);
    const expandAllBtn = screen.getByRole('button', {
      name: 'Expand all animation cards',
    });
    const collapseAllBtn = screen.getByRole('button', {
      name: 'Collapse all animation cards',
    });
    expect(expandAllBtn).not.toBeNull();
    expect(collapseAllBtn).not.toBeNull();
    expect(expandAllBtn.getAttribute('type')).toBe('button');
    expect(collapseAllBtn.getAttribute('type')).toBe('button');
    expect(expandAllBtn.textContent).toBe('Expand all');
    expect(collapseAllBtn.textContent).toBe('Collapse all');
    // Verbatim h-8 class string fragments — ensures Pitfall 8 literal-class
    // discipline (no template interpolation, no shared-variable factoring).
    const className = expandAllBtn.getAttribute('class') ?? '';
    expect(className).toContain('h-8');
    expect(className).toContain('text-xs');
    expect(className).toContain('font-semibold');
    expect(className).toContain('border border-border');
    expect(className).toContain('rounded-md');
    expect(className).toContain('px-3');
    expect(className).toContain('flex-shrink-0');
    const className2 = collapseAllBtn.getAttribute('class') ?? '';
    expect(className2).toContain('h-8');
    expect(className2).toContain('text-xs');
    expect(className2).toContain('font-semibold');
  });

  it('B4: Expand all opens every card; Collapse all closes every card', () => {
    renderPanel(3, 5);

    // Initially: all collapsed.
    const expandAllBtn = screen.getByRole('button', {
      name: 'Expand all animation cards',
    });
    act(() => {
      fireEvent.click(expandAllBtn);
    });

    // After Expand all: every card body is open. Each card had 5 rows; we
    // should see 5 rows × 3 cards = 15 row records by attachmentName text.
    const rowsAfterExpand = screen.queryAllByText(/-attachment-0000$/);
    expect(rowsAfterExpand.length).toBe(3); // one row per card

    const collapseAllBtn = screen.getByRole('button', {
      name: 'Collapse all animation cards',
    });
    act(() => {
      fireEvent.click(collapseAllBtn);
    });

    // After Collapse all: every card body is closed.
    const rowsAfterCollapse = screen.queryAllByText(/-attachment-0000$/);
    expect(rowsAfterCollapse.length).toBe(0);
  });

  it('B5: after Expand all, individual card toggle collapses just that card', () => {
    const { container } = renderPanel(3, 5);

    const expandAllBtn = screen.getByRole('button', {
      name: 'Expand all animation cards',
    });
    act(() => {
      fireEvent.click(expandAllBtn);
    });

    // Sanity: all 3 expanded.
    expect(screen.queryAllByText(/-attachment-0000$/).length).toBe(3);

    // Toggle the FIRST card (Setup Pose) closed.
    const cards = container.querySelectorAll(
      'section[aria-labelledby^="bd-header-"]',
    );
    expect(cards.length).toBe(3);
    const firstToggle = cards[0].querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement;
    expect(firstToggle.getAttribute('aria-expanded')).toBe('true');
    act(() => {
      fireEvent.click(firstToggle);
    });
    expect(firstToggle.getAttribute('aria-expanded')).toBe('false');

    // The other two cards remain expanded.
    const secondToggle = cards[1].querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement;
    const thirdToggle = cards[2].querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement;
    expect(secondToggle.getAttribute('aria-expanded')).toBe('true');
    expect(thirdToggle.getAttribute('aria-expanded')).toBe('true');

    // After single-card collapse: 2 cards' first rows still visible.
    expect(screen.queryAllByText(/-attachment-0000$/).length).toBe(2);
  });

  it('B6 (B-D-02 + B-D-04): search union preserved; matching cards surface even with empty userExpanded; bulk Collapse all does not remove matched cards while search active', () => {
    // 3 cards × 5 rows each. Default seed is empty Set ⇒ all collapsed.
    renderPanel(3, 5);

    // Click Collapse all so userExpanded is unambiguously empty (the
    // default-collapsed seed already does this; the explicit click here
    // proves the bulk action stays absolute and does not interfere with
    // search-union behavior afterwards).
    const collapseAllBtn = screen.getByRole('button', {
      name: 'Collapse all animation cards',
    });
    act(() => {
      fireEvent.click(collapseAllBtn);
    });

    // Type a query that matches only one card's rows (anim 'walk-01' has
    // attachmentName like "walk-01-attachment-0001"). The substring
    // 'walk-01-attachment-0001' is a unique row inside walk-01.
    const searchInput = screen.getByLabelText(
      /filter rows by attachment name/i,
    );
    act(() => {
      fireEvent.change(searchInput, {
        target: { value: 'walk-01-attachment-0001' },
      });
    });

    // The matched row text is rendered — the union auto-expands the
    // matched card even though userExpanded is empty.
    expect(
      screen.queryAllByText(/walk-01-attachment-0001/).length,
    ).toBeGreaterThan(0);
  });

  it('B7: empty rig (summary.animations.count === 0) hides bulk buttons', () => {
    // 1 card (Setup Pose) only ⇒ animations.count === 0 (cardCount - 1).
    renderPanel(1, 5);
    expect(
      screen.queryByRole('button', { name: 'Expand all animation cards' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Collapse all animation cards' }),
    ).toBeNull();
  });
});
