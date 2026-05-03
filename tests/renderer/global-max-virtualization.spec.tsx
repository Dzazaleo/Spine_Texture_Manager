// @vitest-environment jsdom
/**
 * Phase 9 Plan 03 — GlobalMaxRenderPanel virtualization behaviors (D-191 / D-195).
 *
 * Wave 0 (Plan 01) shipped this file as RED scaffolds. Wave 2 (this plan) flips
 * the four behaviors GREEN against the real `useVirtualizer`-integrated panel:
 *
 *   - Row 8: below threshold (50 rows: getAllByRole('row').length === 51)
 *   - Row 9: above threshold (200 rows: getAllByRole('row').length ≤ 60)
 *   - Row 10: sort/search/checkbox preserved in virtualized path
 *   - Row 11: sticky thead (className contract — visual sticky verified in UAT)
 *
 * jsdom limitations (RESEARCH §Q9):
 *   - useVirtualizer reads getBoundingClientRect / scrollTop / clientHeight on
 *     the parent ref; jsdom returns zeroed rects by default, so we polyfill
 *     `Element.prototype.getBoundingClientRect` with a synthetic 600×800 box
 *     and stub `clientHeight` so the virtualizer sees a finite viewport and
 *     emits a non-empty getVirtualItems() window.
 *   - No real layout / paint pipeline — these are className + element-count
 *     contracts. Visual sticky behavior is verified manually per VALIDATION.md
 *     "Manual-Only Verifications".
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx (jsdom + Testing Library shape).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import { SearchBar } from '../../src/renderer/src/components/SearchBar';
import type { DisplayRow, SkeletonSummary } from '../../src/shared/types';

// jsdom polyfills for useVirtualizer. Without these, the virtualizer treats
// the parent element as a 0×0 rect and emits zero virtual items — every
// virtualized assertion would see only the header row.
//
// virtual-core's `observeElementRect` reads `element.offsetWidth` and
// `element.offsetHeight` (NOT getBoundingClientRect) to size the scroll
// container — see node_modules/@tanstack/virtual-core/dist/esm/index.js
// `const getRect = (element) => { offsetWidth, offsetHeight }`. jsdom
// defaults both to 0; we override on HTMLElement.prototype so EVERY
// element reports a finite size. The virtualizer's range math (start +
// overscan + end) then emits a non-empty getVirtualItems() window.
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
 * Synthesize a single DisplayRow with stable attachmentKey. Every numeric
 * field is filled so the panel's enrichWithEffective + computeExportDims
 * helpers don't propagate NaN. attachmentName is the index-based identifier
 * the search filter matches against.
 */
function makeRow(i: number): DisplayRow {
  const name = `attachment-${String(i).padStart(4, '0')}`;
  return {
    attachmentKey: `default::slot-${i}::${name}`,
    skinName: 'default',
    slotName: `slot-${i}`,
    attachmentName: name,
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    peakScaleX: 1,
    peakScaleY: 1,
    peakScale: 1,
    worldW: 64,
    worldH: 64,
    sourceW: 64,
    sourceH: 64,
    isSetupPosePeak: true,
    originalSizeLabel: '64×64',
    peakSizeLabel: '64×64',
    scaleLabel: '1.000×',
    sourceLabel: '__SETUP__',
    frameLabel: '—',
    sourcePath: `/fake/${name}.png`,
    // Phase 22 DIMS-01 — canonical/actual dim fields. Defaults reflect the
    // happy-path "no drift" case (canonical === source; actualSource undefined;
    // dimsMismatch false).
    canonicalW: 64,
    canonicalH: 64,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
  };
}

/**
 * Phase 22 DIMS-02 — drifted variant for badge tests. Canonical 1628×1908,
 * actual on-disk 811×962 (halved-PNG scenario). dimsMismatch:true triggers
 * the badge SVG + tooltip in the Source W×H cell.
 */
function makeDriftedRow(i: number): DisplayRow {
  return {
    ...makeRow(i),
    canonicalW: 1628,
    canonicalH: 1908,
    actualSourceW: 811,
    actualSourceH: 962,
    dimsMismatch: true,
  };
}

function makeSummary(rowCount: number): SkeletonSummary {
  const peaks: DisplayRow[] = Array.from({ length: rowCount }, (_, i) => makeRow(i));
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: '/fake/skeleton.atlas',
    bones: { count: 1, names: ['root'] },
    slots: { count: rowCount },
    attachments: { count: rowCount, byType: { RegionAttachment: rowCount } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    peaks,
    animationBreakdown: [],
    unusedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
}

/**
 * Phase 19 Plan 04 — query state lifted to AppShell. Mirror that contract
 * in tests with a small wrapper component holding query state + the lifted
 * SearchBar, threaded down to the panel via REQUIRED query/onQueryChange
 * props. The SearchBar carries the same `aria-label="Filter rows by
 * attachment name"` as the production sticky-bar instance, so the existing
 * `getByLabelText(/filter rows by attachment name/i)` query keeps working.
 */
function PanelTestHarness({ rowCount }: { rowCount: number }) {
  const [query, setQuery] = useState('');
  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      <GlobalMaxRenderPanel
        summary={makeSummary(rowCount)}
        onJumpToAnimation={vi.fn()}
        overrides={new Map()}
        onOpenOverrideDialog={vi.fn()}
        query={query}
        onQueryChange={setQuery}
        loaderMode="auto"
      />
    </>
  );
}

/**
 * Phase 22 DIMS-02 — explicit-rows harness for badge tests. Wraps the supplied
 * rows in a SkeletonSummary fixture so the panel renders them under the
 * standard query/onQueryChange contract.
 */
function PanelRowsHarness({ rows }: { rows: DisplayRow[] }) {
  const [query, setQuery] = useState('');
  const summary: SkeletonSummary = {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: '/fake/skeleton.atlas',
    bones: { count: 1, names: ['root'] },
    slots: { count: rows.length },
    attachments: { count: rows.length, byType: { RegionAttachment: rows.length } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    peaks: rows,
    animationBreakdown: [],
    unusedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
  return (
    <>
      <SearchBar value={query} onChange={setQuery} />
      <GlobalMaxRenderPanel
        summary={summary}
        onJumpToAnimation={vi.fn()}
        overrides={new Map()}
        onOpenOverrideDialog={vi.fn()}
        query={query}
        onQueryChange={setQuery}
        loaderMode="auto"
      />
    </>
  );
}

function renderPanel(rowCount: number) {
  return render(<PanelTestHarness rowCount={rowCount} />);
}

describe('GlobalMaxRenderPanel — Wave 2 D-191 / D-195', () => {
  it('below threshold (50 rows): getAllByRole("row").length === 51 (header + 50 data rows)', () => {
    renderPanel(50);
    // Flat-table render path renders all 50 data rows + 1 header row.
    expect(screen.getAllByRole('row').length).toBe(51);
  });

  it('above threshold (200 rows): getAllByRole("row").length <= 60 (header + window of <=59)', () => {
    renderPanel(200);
    const rowCount = screen.getAllByRole('row').length;
    expect(
      rowCount,
      `Virtualized path should render <=60 rows; got ${rowCount}`,
    ).toBeLessThanOrEqual(60);
    // Sanity: virtualization is actually doing work (>=70% reduction vs naive).
    expect(rowCount).toBeLessThan(200 * 0.3);
    // And we still have SOMETHING beyond just the header (the virtualizer
    // window emitted at least a few rows).
    expect(rowCount).toBeGreaterThan(1);
  });

  it('sort/search/checkbox preserved in virtualized path (200 rows)', () => {
    renderPanel(200);

    // 1. Click a sort header — the Attachment column header is a <button>
    //    inside a <th>. Click on it; the panel re-sorts and re-renders the
    //    virtualizer window without throwing.
    const attachmentHeader = screen.getByRole('button', { name: /attachment/i });
    act(() => {
      fireEvent.click(attachmentHeader);
    });
    expect(screen.getAllByRole('row').length).toBeLessThanOrEqual(60);

    // 2. Type into the search input (filters rows by attachmentName
    //    substring, BEFORE the virtualizer sees them — so the windowed
    //    DOM reflects the filtered subset).
    const searchInput = screen.getByLabelText(/filter rows by attachment name/i);
    act(() => {
      fireEvent.change(searchInput, { target: { value: 'attachment-0001' } });
    });
    // Filter narrows to a single row; render still works.
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('row').length).toBeLessThanOrEqual(60);

    // Reset filter so the per-row checkbox toggle has rows to act on.
    act(() => {
      fireEvent.change(searchInput, { target: { value: '' } });
    });

    // 3. Toggle a per-row checkbox. Index 0 in the rendered checkboxes is
    //    the SelectAllCheckbox; index 1 is the first per-row checkbox.
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThan(1);
    act(() => {
      fireEvent.click(checkboxes[1]);
    });
    // Selection state updates without throw — the "N selected / M total"
    // chip in the header reflects the new count.
    expect(screen.getByText(/selected/i).textContent).toMatch(/\d+ selected/);
  });

  it('sticky thead: className contains "sticky top-0" in virtualized path', () => {
    const { container } = renderPanel(200);
    const thead = container.querySelector('thead');
    expect(thead).not.toBeNull();
    // Pitfall 1 contract: position:sticky is on <thead>, NEVER on <tr>
    // inside <tbody>. Tailwind's `sticky` + `top-0` utilities apply
    // position:sticky and top:0; visual behavior is verified manually
    // per VALIDATION.md "Manual-Only Verifications" (jsdom does not
    // implement position:sticky layout).
    const cls = thead!.className;
    expect(cls).toMatch(/sticky/);
    expect(cls).toMatch(/top-0/);
  });
});

/**
 * Phase 22 Plan 22-05 Task 1 — DIMS-02 dims-mismatch badge in the Source W×H
 * cell. Updated for Plan 22.1-04 (DimsBadge component — G-02 fix):
 *   - Badge renders as a hover-tooltip (data-testid="dims-badge-host") instead
 *     of a native title attribute.
 *   - Tooltip text uses mode-aware wording (atlas-source 'auto') + cap-aware
 *     second sentence (peakScale=1 > sourceRatio ~0.50 → capped).
 *   - Badge absent when dimsMismatch === false or actualSource is undefined.
 */
describe('GlobalMaxRenderPanel — DIMS-02 dims-mismatch badge (Phase 22)', () => {
  it('renders dims-mismatch badge when row.dimsMismatch === true', () => {
    const rows = [makeDriftedRow(0)];
    render(<PanelRowsHarness rows={rows} />);
    // DimsBadge renders a host div with data-testid="dims-badge-host".
    const host = screen.getByTestId('dims-badge-host');
    expect(host).not.toBeNull();
    // Hover to surface the tooltip and verify content.
    fireEvent.mouseEnter(host);
    const tooltip = screen.getByRole('tooltip');
    // Mode-aware wording: loaderMode="auto" → atlas-source sentence.
    expect(tooltip.textContent).toContain('Atlas region declares 811×962');
    // Cap-binding: peakScale=1.0 > sourceRatio≈0.50 → cap suffix appears.
    expect(tooltip.textContent).toContain('Optimize will cap at on-disk size.');
  });

  it('does NOT render badge when row.dimsMismatch === false', () => {
    const rows = [makeRow(0)];
    render(<PanelRowsHarness rows={rows} />);
    expect(screen.queryByTestId('dims-badge-host')).toBeNull();
  });

  it('badge is absent when actualSource is undefined (atlas-extract path)', () => {
    // dimsMismatch:false + actualSource undefined is the locked atlas-extract
    // contract from Plan 22-01 / 22-02. DimsBadge returns null when
    // !row.dimsMismatch or actualSource is undefined.
    const rows = [{ ...makeRow(0), dimsMismatch: false }];
    render(<PanelRowsHarness rows={rows} />);
    expect(screen.queryByTestId('dims-badge-host')).toBeNull();
  });
});
