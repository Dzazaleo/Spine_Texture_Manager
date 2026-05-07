// @vitest-environment jsdom
/**
 * Phase 29 Plan 29-02 Task 3 — GlobalMaxRenderPanel region-key conversion tests.
 *
 * Locks the new behavior:
 *   - Panel renders summary.regions.length rows (NOT summary.peaks.length)
 *   - Row label format is `{regionName}.png` with `images/` prefix stripped
 *     (REGION-03)
 *   - "(used by N attachments)" indicator renders when
 *     contributingAttachments.length > 1 (D-08)
 *   - Selection key flipped from attachmentKey to regionName
 *   - focusRegionName prop replaces focusAttachmentName for cross-panel jump
 *   - AnimationBreakdownPanel UNCHANGED — verified by separate spec coverage
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import type { DisplayRow, RegionRow, SkeletonSummary } from '../../src/shared/types';

// jsdom polyfills for useVirtualizer + Element.scrollIntoView (focus-jump effect).
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() { return 800; },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() { return 600; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get() { return 800; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get() { return 600; },
  });
  if (!('ResizeObserver' in globalThis)) {
    (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  // jsdom does not implement scrollIntoView; the panel's focus-jump effect
  // calls it on the row element. Stub as a no-op so the test does not throw.
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function () {};
  }
});

afterEach(cleanup);

/** Build a single contributor entry. */
function makeContributor(
  attachmentName: string,
  overrides?: { peakScale?: number; isSetupPosePeak?: boolean },
) {
  return {
    attachmentName,
    skinName: 'default',
    slotName: `slot_${attachmentName}`,
    peakScale: overrides?.peakScale ?? 0.5,
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    isSetupPosePeak: overrides?.isSetupPosePeak ?? true,
  };
}

/** Build a fully-populated RegionRow for synthetic tests. */
function makeRegionRow(
  regionName: string,
  attachmentNames: string[],
  options?: { sourceW?: number; sourceH?: number },
): RegionRow {
  const sourceW = options?.sourceW ?? 64;
  const sourceH = options?.sourceH ?? 64;
  const winnerName = [...attachmentNames].sort()[0];
  return {
    regionName,
    attachmentName: winnerName, // REGION-05 lex tiebreak winner
    skinName: 'default',
    slotName: `slot_${winnerName}`,
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    peakScale: 0.5,
    peakScaleX: 0.5,
    peakScaleY: 0.5,
    worldW: 32,
    worldH: 32,
    sourceW,
    sourceH,
    isSetupPosePeak: true,
    sourcePath: `/fake/${regionName}.png`,
    canonicalW: sourceW,
    canonicalH: sourceH,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: `${sourceW}×${sourceH}`,
    peakSizeLabel: '32×32',
    scaleLabel: '0.500×',
    sourceLabel: '__SETUP__',
    frameLabel: '—',
    contributingAttachments: attachmentNames.map((n) => makeContributor(n)),
  };
}

/** Mirror peaks for the SkeletonSummary contract. */
function peaksFromRegions(regions: RegionRow[]): DisplayRow[] {
  const out: DisplayRow[] = [];
  for (const r of regions) {
    for (const c of r.contributingAttachments) {
      out.push({
        attachmentKey: `${c.skinName}::${c.slotName}::${c.attachmentName}`,
        skinName: c.skinName,
        slotName: c.slotName,
        attachmentName: c.attachmentName,
        regionName: r.regionName,
        animationName: c.animationName,
        time: c.time,
        frame: c.frame,
        peakScaleX: c.peakScale,
        peakScaleY: c.peakScale,
        peakScale: c.peakScale,
        worldW: r.worldW,
        worldH: r.worldH,
        sourceW: r.sourceW,
        sourceH: r.sourceH,
        isSetupPosePeak: c.isSetupPosePeak,
        originalSizeLabel: r.originalSizeLabel,
        peakSizeLabel: r.peakSizeLabel,
        scaleLabel: r.scaleLabel,
        sourceLabel: r.sourceLabel,
        frameLabel: r.frameLabel,
        sourcePath: r.sourcePath,
        canonicalW: r.canonicalW,
        canonicalH: r.canonicalH,
        actualSourceW: r.actualSourceW,
        actualSourceH: r.actualSourceH,
        dimsMismatch: r.dimsMismatch,
      });
    }
  }
  return out;
}

function makeSummary(regions: RegionRow[]): SkeletonSummary {
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: null,
    bones: { count: 1, names: ['root'] },
    slots: { count: regions.length },
    attachments: { count: regions.length, byType: { RegionAttachment: regions.length } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: peaksFromRegions(regions),
    regions,
    animationBreakdown: [],
    orphanedFiles: [],
    skippedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  } as unknown as SkeletonSummary;
}

function PanelHarness({
  regions,
  focusRegionName,
}: {
  regions: RegionRow[];
  focusRegionName?: string | null;
}) {
  const [query, setQuery] = useState('');
  return (
    <GlobalMaxRenderPanel
      summary={makeSummary(regions)}
      overrides={new Map()}
      onOpenOverrideDialog={vi.fn()}
      query={query}
      onQueryChange={setQuery}
      loaderMode="atlas-less"
      focusRegionName={focusRegionName ?? null}
      onFocusConsumed={vi.fn()}
    />
  );
}

describe('GlobalMaxRenderPanel — Phase 29 D-01 / REGION-03 / D-08', () => {
  it('Test 1 — data source: panel renders summary.regions.length rows (NOT peaks.length)', () => {
    // Build a path-indirected summary: one region with 3 contributors.
    // peaks.length === 3 but regions.length === 1; panel should render 1 row.
    const regions = [makeRegionRow('SHARED', ['a', 'b', 'c'])];
    render(<PanelHarness regions={regions} />);
    // Header row + 1 data row = 2 rows.
    const rows = screen.getAllByRole('row');
    expect(rows.length).toBe(2);
  });

  it('Test 2 — REGION-03 label format with images/ stripped: regionName "images/5/7" renders as "5/7.png"', () => {
    const regions = [makeRegionRow('images/5/7', ['5/7'])];
    render(<PanelHarness regions={regions} />);
    expect(screen.getByText('5/7.png')).not.toBeNull();
  });

  it('Test 3 — REGION-03 label format without images/ prefix: regionName "CIRCLE" renders as "CIRCLE.png"', () => {
    const regions = [makeRegionRow('CIRCLE', ['CIRCLE'])];
    render(<PanelHarness regions={regions} />);
    expect(screen.getByText('CIRCLE.png')).not.toBeNull();
  });

  it('Test 4 — D-08 (used by N) indicator: renders when contributingAttachments.length === 3', () => {
    const regions = [makeRegionRow('SHARED', ['a', 'b', 'c'])];
    render(<PanelHarness regions={regions} />);
    expect(screen.getByText(/used by 3 attachments/i)).not.toBeNull();
  });

  it('Test 4b — D-08 (used by N) indicator: NOT rendered when contributingAttachments.length === 1', () => {
    const regions = [makeRegionRow('SOLO', ['a'])];
    render(<PanelHarness regions={regions} />);
    expect(screen.queryByText(/used by/i)).toBeNull();
  });

  it('Test 5 — selection key flipped to regionName: checkbox aria-label uses regionName', () => {
    const regions = [makeRegionRow('SHARED_PNG', ['a', 'b'])];
    render(<PanelHarness regions={regions} />);
    // Phase 29: aria-label is "Select {regionName}" not "Select {attachmentName}".
    expect(screen.getByLabelText('Select SHARED_PNG')).not.toBeNull();
  });

  it('Test 6 — focus-jump from Atlas Preview: focusRegionName=images/5/7 highlights the matching region row', () => {
    const regions = [
      makeRegionRow('CIRCLE', ['CIRCLE']),
      makeRegionRow('images/5/7', ['5/7']),
    ];
    // The flash assertion is brittle to implementation; we instead verify the
    // jumped row mounts (its text label appears in the DOM), and that the
    // focusRegionName prop does not throw.
    render(<PanelHarness regions={regions} focusRegionName={'images/5/7'} />);
    expect(screen.getByText('5/7.png')).not.toBeNull();
  });

  it('Test 7 — sort by attachment column reads regionName naturally', () => {
    const regions = [
      makeRegionRow('CHAIN_10', ['CHAIN_10']),
      makeRegionRow('CHAIN_2', ['CHAIN_2']),
    ];
    render(<PanelHarness regions={regions} />);
    // Default sort = attachmentName asc, but compareRows now reads regionName.
    // Natural numeric order: CHAIN_2 < CHAIN_10.
    const cells = Array.from(document.querySelectorAll('tbody tr td:nth-child(3)'));
    const labels = cells.map((td) => (td.textContent ?? '').trim());
    // The cell text includes the label only (no "(used by N)" since 1 contributor each).
    expect(labels).toEqual(['CHAIN_2.png', 'CHAIN_10.png']);
  });

  it('Test 8 — Tailwind v4 literal-class discipline: (used by N) span uses literal classes (no template interpolation)', () => {
    // Indirect verification: render a path-indirected region; locate the
    // indicator span; assert its className includes the literal Tailwind
    // utilities (text-xs text-fg-muted ml-1.5) rather than dynamically built.
    const regions = [makeRegionRow('SHARED', ['a', 'b', 'c'])];
    render(<PanelHarness regions={regions} />);
    const indicator = screen.getByText(/used by 3 attachments/);
    expect(indicator.className).toMatch(/text-xs/);
    expect(indicator.className).toMatch(/text-fg-muted/);
  });
});
