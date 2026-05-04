// @vitest-environment jsdom
/**
 * Phase 24 Plan 24-03 — RTL tests for UnusedAssetsPanel.
 * Phase 26.2 Plan 01 — Updated for lifted query props (D-03).
 *
 * Behavior gates (a)-(i):
 *   (a) Returns null when orphanedFiles is [] (component not in the DOM)
 *   (b) Renders with role="alert" and aria-label="Orphaned image files" when N > 0
 *   (c) Expanded by default when N > 0 (table/detail visible without any click)
 *   (d) Header shows "1 orphaned file" (singular) when count is 1
 *   (e) Header shows "N orphaned files" (plural) when count > 1
 *   (f) Header shows formatBytes(totalBytes) alongside count in the header text (e.g. "· 1.2 KB")
 *   (g) "Hide details" button shows when expanded=true; clicking it collapses (shows "Show details")
 *   (h) Table rows: each row shows filename and formatBytes(bytesOnDisk)
 *   (i) Search filter: passing a query prop filters to matching filenames; non-matching query shows "(no matches)"
 *
 * Mirrors missing-attachments-panel.spec.tsx idiom: vitest + @testing-library/react + jsdom;
 * assertions use `not.toBeNull()` / `toBeDefined()` rather than `@testing-library/jest-dom`
 * matchers (project convention — no jest-dom imports anywhere in tests/renderer).
 *
 * Phase 26.2 D-03 change: query and onQueryChange are now required props (lifted to AppShell).
 * All render calls pass query="" onQueryChange={() => {}}. Test (i) drives filtering via
 * prop-driven rerender instead of fireEvent on internal textbox.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { UnusedAssetsPanel } from '../../src/renderer/src/panels/UnusedAssetsPanel';

afterEach(cleanup);

const ONE_FILE = [{ filename: 'UNUSED_CIRCLE', bytesOnDisk: 1024 }];
const TWO_FILES = [
  { filename: 'UNUSED_CIRCLE', bytesOnDisk: 1024 },
  { filename: 'STALE_BITMAP', bytesOnDisk: 2048 },
];
const THREE_FILES = [
  { filename: 'UNUSED_CIRCLE', bytesOnDisk: 1024 },
  { filename: 'STALE_BITMAP', bytesOnDisk: 2048 },
  { filename: 'OLD_TEXTURE', bytesOnDisk: 512 },
];

describe('UnusedAssetsPanel (PANEL-02)', () => {
  // (a)
  it('returns null when orphanedFiles is empty (component not in the DOM)', () => {
    const { container } = render(<UnusedAssetsPanel orphanedFiles={[]} query="" onQueryChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  // (b)
  it('renders with role="alert" and aria-label="Orphaned image files" when N > 0', () => {
    render(<UnusedAssetsPanel orphanedFiles={ONE_FILE} query="" onQueryChange={() => {}} />);
    const panel = screen.getByRole('alert');
    expect(panel).not.toBeNull();
    expect(panel.getAttribute('aria-label')).toBe('Orphaned image files');
  });

  // (c)
  it('is expanded by default when N > 0 (table rows visible without any click)', () => {
    render(<UnusedAssetsPanel orphanedFiles={ONE_FILE} query="" onQueryChange={() => {}} />);
    // Table with "Filename" header should be visible immediately (no click required)
    expect(screen.queryByText('Filename')).not.toBeNull();
    expect(screen.queryByText('Size on Disk')).not.toBeNull();
    // The filename itself should be visible
    expect(screen.queryByText('UNUSED_CIRCLE')).not.toBeNull();
  });

  // (d)
  it('header shows singular "1 orphaned file" when count is 1', () => {
    render(<UnusedAssetsPanel orphanedFiles={ONE_FILE} query="" onQueryChange={() => {}} />);
    // Text is split across elements; use a function matcher that checks textContent of the panel
    const panel = screen.getByRole('alert');
    expect(panel.textContent).toMatch(/1 orphaned file[^s]/i);
  });

  // (e)
  it('header shows plural "N orphaned files" when count > 1', () => {
    render(<UnusedAssetsPanel orphanedFiles={TWO_FILES} query="" onQueryChange={() => {}} />);
    expect(screen.getByText(/2 orphaned files/i)).not.toBeNull();
  });

  // (f)
  it('header shows formatBytes(totalBytes) when totalBytes > 0', () => {
    // TWO_FILES: 1024 + 2048 = 3072 bytes → "3 KB"
    render(<UnusedAssetsPanel orphanedFiles={TWO_FILES} query="" onQueryChange={() => {}} />);
    // The formatted bytes should appear somewhere in the header area
    expect(screen.queryByText(/3 KB/)).not.toBeNull();
  });

  // (g)
  it('"Hide details" button is shown when expanded; clicking collapses to "Show details"', () => {
    render(<UnusedAssetsPanel orphanedFiles={ONE_FILE} query="" onQueryChange={() => {}} />);
    // Default state = expanded → "Hide details"
    const hideBtn = screen.getByRole('button', { name: /hide details/i });
    expect(hideBtn).not.toBeNull();
    expect(hideBtn.getAttribute('aria-expanded')).toBe('true');

    // Click to collapse
    fireEvent.click(hideBtn);

    // Now should show "Show details"
    const showBtn = screen.getByRole('button', { name: /show details/i });
    expect(showBtn).not.toBeNull();
    expect(showBtn.getAttribute('aria-expanded')).toBe('false');

    // Table rows should be hidden after collapse
    expect(screen.queryByText('Filename')).toBeNull();
  });

  // (h)
  it('table rows show filename and formatted size for each orphaned file', () => {
    render(<UnusedAssetsPanel orphanedFiles={TWO_FILES} query="" onQueryChange={() => {}} />);
    // Both filenames visible
    expect(screen.queryByText('UNUSED_CIRCLE')).not.toBeNull();
    expect(screen.queryByText('STALE_BITMAP')).not.toBeNull();
    // Both sizes: 1024 → "1 KB", 2048 → "2 KB"
    expect(screen.queryByText('1 KB')).not.toBeNull();
    expect(screen.queryByText('2 KB')).not.toBeNull();
  });

  // (i)
  it('search filter narrows rows to matching filenames', () => {
    let q = '';
    const onQueryChange = (val: string) => { q = val; };
    const { rerender } = render(
      <UnusedAssetsPanel orphanedFiles={THREE_FILES} query={q} onQueryChange={onQueryChange} />
    );
    // All 3 visible
    expect(screen.queryByText('UNUSED_CIRCLE')).not.toBeNull();
    expect(screen.queryByText('STALE_BITMAP')).not.toBeNull();
    expect(screen.queryByText('OLD_TEXTURE')).not.toBeNull();

    // Rerender with query that matches only STALE_BITMAP
    rerender(<UnusedAssetsPanel orphanedFiles={THREE_FILES} query="STALE" onQueryChange={onQueryChange} />);
    expect(screen.queryByText('STALE_BITMAP')).not.toBeNull();
    expect(screen.queryByText('UNUSED_CIRCLE')).toBeNull();
    expect(screen.queryByText('OLD_TEXTURE')).toBeNull();

    // Rerender with non-matching query → "(no matches)"
    rerender(<UnusedAssetsPanel orphanedFiles={THREE_FILES} query="XYZNOTFOUND" onQueryChange={onQueryChange} />);
    expect(screen.queryByText('(no matches)')).not.toBeNull();
  });
});
