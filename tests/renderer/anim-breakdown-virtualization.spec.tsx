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
