// @vitest-environment jsdom
/**
 * Phase 27 QA-03 — natural-order localeCompare in the GlobalMaxRenderPanel comparator.
 *
 * Falsifying: today, sorting CHAIN_2, CHAIN_10 ascending produces
 * [CHAIN_10, CHAIN_2] (lexicographic). After QA-03, the comparator passes
 * { sensitivity: 'base', numeric: true } and produces [CHAIN_2, CHAIN_10].
 *
 * One surface tested: the GlobalMaxRenderPanel compareRows function
 * (lines 241-264 of GlobalMaxRenderPanel.tsx). compareRows produces a
 * display sort only — its output is consumed by sortRows → table render
 * and never crosses a determinism boundary.
 *
 * OUT OF SCOPE (intentionally NOT tested in this spec):
 *   - src/renderer/src/lib/atlas-preview-view.ts (D-125 packer input — same
 *     determinism contract as src/core/atlas-preview.ts).
 *   - src/renderer/src/lib/export-view.ts (renderer-side mirror of
 *     src/core/export.ts's byte-deterministic ExportRow ordering).
 *   - src/core/* localeCompare sites (intentionally bare for byte-deterministic
 *     packer + CLI contract; see 27-03-PLAN.md objective).
 *
 * Changing those sites without coordinated changes to their core mirrors
 * would break the preview↔export byte-identical invariant (D-125).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import type { DisplayRow, SkeletonSummary } from '../../src/shared/types';

// jsdom polyfills for useVirtualizer. Without these the virtualizer sees a
// 0×0 rect and emits zero virtual items. Mirrors global-max-missing-row.spec.tsx.
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
function makeRow(attachmentName: string): DisplayRow {
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
  };
}

function buildSummary(names: string[]): SkeletonSummary {
  const peaks = names.map((n) => makeRow(n));
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: null,
    bones: { count: 1, names: ['root'] },
    slots: { count: peaks.length },
    attachments: { count: peaks.length, byType: { RegionAttachment: peaks.length } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks,
    animationBreakdown: [],
    orphanedFiles: [],
    skippedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
}

function PanelWrapper({ summary }: { summary: SkeletonSummary }) {
  const [q, setQ] = useState('');
  return (
    <GlobalMaxRenderPanel
      summary={summary}
      overrides={new Map()}
      onOpenOverrideDialog={vi.fn()}
      query={q}
      onQueryChange={setQ}
      loaderMode="auto"
    />
  );
}

/** Extract attachment-name text from each rendered tbody row's column-3 cell.
 *
 * Column layout (see GlobalMaxRenderPanel.tsx:996-1060):
 *   td:nth-child(1) — row state indicator
 *   td:nth-child(2) — checkbox
 *   td:nth-child(3) — attachment name (with optional ⚠ icon for missing rows;
 *                     none of these test rows are missing)
 *
 * This works for both the flat-table render path (≤100 rows) and the
 * virtualized render path (>100 rows). All tests in this spec use ≤5 rows
 * so they hit the flat-table path.
 */
function getAttachmentNamesInOrder(): string[] {
  const cells = Array.from(document.querySelectorAll('tbody tr td:nth-child(3)'));
  return cells.map((td) => (td.textContent ?? '').trim());
}

describe('renderer localeCompare numeric sort — GlobalMaxRenderPanel', () => {
  it('sorts CHAIN_2 before CHAIN_10 (natural numeric order)', () => {
    render(<PanelWrapper summary={buildSummary(['CHAIN_10', 'CHAIN_2'])} />);
    // Default sort is attachmentName asc (panel line 612-613).
    expect(getAttachmentNamesInOrder()).toEqual(['CHAIN_2', 'CHAIN_10']);
  });

  it('handles mixed-arity natural sort: CHAIN_1, CHAIN_2, CHAIN_3, CHAIN_10, CHAIN_11', () => {
    render(
      <PanelWrapper
        summary={buildSummary(['CHAIN_11', 'CHAIN_1', 'CHAIN_3', 'CHAIN_10', 'CHAIN_2'])}
      />,
    );
    expect(getAttachmentNamesInOrder()).toEqual([
      'CHAIN_1',
      'CHAIN_2',
      'CHAIN_3',
      'CHAIN_10',
      'CHAIN_11',
    ]);
  });
});
