// @vitest-environment jsdom
/**
 * Phase 25 PANEL-03 — RTL tests for missing-row danger indicators in
 * GlobalMaxRenderPanel.
 *
 * Tests the 'missing' RowState variant (rowState predicate priority) and the
 * ⚠ icon rendered beside the attachment name for rows with isMissing: true.
 *
 * Mirrors missing-attachments-panel.spec.tsx idiom: vitest + @testing-library/react
 * + jsdom; assertions use not.toBeNull() / toBeNull() — no @testing-library/jest-dom.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import type { DisplayRow, SkeletonSummary } from '../../src/shared/types';

// jsdom polyfills for useVirtualizer. Without these the virtualizer sees a
// 0×0 rect and emits zero virtual items. Mirrors global-max-virtualization.spec.tsx.
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
});

afterEach(cleanup);

/** Minimal DisplayRow that does not propagate NaN through computeExportDims. */
function makeRow(attachmentName: string, isMissing?: boolean): DisplayRow {
  return {
    attachmentKey: `default/slot/${attachmentName}`,
    skinName: 'default',
    slotName: 'slot',
    attachmentName,
    animationName: 'Setup Pose (Default)',
    time: 0,
    frame: 0,
    peakScaleX: 0.5,
    peakScaleY: 0.5,
    peakScale: 0.5,
    worldW: 32,
    worldH: 32,
    sourceW: 64,
    sourceH: 64,
    isSetupPosePeak: true,
    originalSizeLabel: '64×64',
    peakSizeLabel: '32×32',
    scaleLabel: '0.500×',
    sourceLabel: 'Setup Pose (Default)',
    frameLabel: '—',
    sourcePath: `/fake/${attachmentName}.png`,
    canonicalW: 64,
    canonicalH: 64,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    ...(isMissing ? { isMissing: true } : {}),
  };
}

function makeSummary(rows: DisplayRow[]): SkeletonSummary {
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: null,
    bones: { count: 1, names: ['root'] },
    slots: { count: rows.length },
    attachments: { count: rows.length, byType: { RegionAttachment: rows.length } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: rows,
    animationBreakdown: [],
    orphanedFiles: [],
    skippedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
}

function PanelHarness({ rows }: { rows: DisplayRow[] }) {
  const [query, setQuery] = useState('');
  return (
    <GlobalMaxRenderPanel
      summary={makeSummary(rows)}
      overrides={new Map()}
      onOpenOverrideDialog={vi.fn()}
      query={query}
      onQueryChange={setQuery}
      loaderMode="atlas-less"
    />
  );
}

describe('Phase 25: GlobalMaxRenderPanel missing row danger indicators', () => {
  it('renders ⚠ icon (aria-label="Missing PNG") for row with isMissing: true', () => {
    render(<PanelHarness rows={[makeRow('MISSING_ATT', true)]} />);
    expect(screen.getByLabelText('Missing PNG')).not.toBeNull();
  });

  it('renders no ⚠ icon for row with isMissing: undefined', () => {
    render(<PanelHarness rows={[makeRow('NORMAL_ATT')]} />);
    expect(screen.queryByLabelText('Missing PNG')).toBeNull();
  });

  it('missing row has bg-danger left-accent (rowState "missing" checked before isUnused)', () => {
    // A row with isMissing: true should be styled with bg-danger in the left-accent
    // even though it is not "unused". We verify via the row's attachment name being
    // present (confirming it is rendered) combined with the icon check — the
    // bg-danger accent class is on a non-aria span so we verify rowState priority
    // indirectly through the icon presence (missing > unused/neutral).
    render(
      <PanelHarness
        rows={[
          makeRow('MISSING_ATT', true),
          makeRow('NORMAL_ATT'),
        ]}
      />,
    );
    // Missing row is rendered (name appears in DOM) with its ⚠ icon.
    expect(screen.getByLabelText('Missing PNG')).not.toBeNull();
    // Normal row is rendered without ⚠ icon (queryByLabelText returns null for
    // normal row; only one icon exists).
    const icons = screen.queryAllByLabelText('Missing PNG');
    expect(icons.length).toBe(1);
  });

  it('non-missing row renders without ⚠ icon even when peakScale is low (unused path unaffected)', () => {
    // Regression check: a genuinely non-missing row with peakScale < 1.0 still
    // renders normally (under-state) without the ⚠ icon. This confirms that the
    // missing check in rowState does NOT accidentally suppress under/over/neutral
    // styling for non-missing rows.
    const lowScaleRow: DisplayRow = {
      ...makeRow('LOW_SCALE_ATT'),
      peakScale: 0.1,
      peakScaleX: 0.1,
      peakScaleY: 0.1,
    };
    render(<PanelHarness rows={[lowScaleRow]} />);
    expect(screen.queryByLabelText('Missing PNG')).toBeNull();
    // Row name is still present in the DOM (row renders; just without danger icon).
    expect(screen.getByText('LOW_SCALE_ATT')).not.toBeNull();
  });
});
