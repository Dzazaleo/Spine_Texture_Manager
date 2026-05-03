// @vitest-environment jsdom
/**
 * Phase 22.1 Plan 04 Task 4 — Integration tests for DimsBadge against
 * GlobalMaxRenderPanel and AnimationBreakdownPanel.
 *
 * Tests cover:
 *   - G-02: tooltip surfaces on every hover (not once-per-session) — deterministic fire
 *   - G-01 D-02: mode-aware wording (atlas-source 'auto' vs atlas-less 'atlas-less')
 *   - G-03: cap-binding-aware second sentence (effectiveScale=1.0 → capped; effectiveScale=0.5 → not capped)
 *   - No native title attribute remaining on the badge span
 *   - Sibling-symmetric: AnimationBreakdownPanel fires same behavior (proves shared DimsBadge component)
 *
 * Mount strategy: mount the panels directly (not AppShell). The panels do
 * not call window.api — no vi.stubGlobal('api', ...) needed.
 *
 * jsdom polyfills for useVirtualizer are included so the panels don't
 * emit empty table bodies (same polyfill recipe as
 * tests/renderer/global-max-virtualization.spec.tsx).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../../src/renderer/src/panels/AnimationBreakdownPanel';
import type {
  AnimationBreakdown,
  BreakdownRow,
  DisplayRow,
  SkeletonSummary,
} from '../../src/shared/types';

// jsdom polyfills for useVirtualizer.
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Drifted DisplayRow: actualSourceW=670, canonicalW=1000 (sourceRatio=0.67).
 * dimsMismatch:true triggers DimsBadge rendering.
 */
function makeDriftedRow(): DisplayRow {
  return {
    attachmentKey: 'default::slot-0::SQUARE',
    skinName: 'default',
    slotName: 'slot-0',
    attachmentName: 'SQUARE',
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    peakScaleX: 1.0,
    peakScaleY: 1.0,
    peakScale: 1.0,
    worldW: 1000,
    worldH: 1000,
    sourceW: 1000,
    sourceH: 1000,
    isSetupPosePeak: true,
    originalSizeLabel: '670×670',
    peakSizeLabel: '1000×1000',
    scaleLabel: '1.000×',
    sourceLabel: '__SETUP__',
    frameLabel: '—',
    sourcePath: '/fake/SQUARE.png',
    canonicalW: 1000,
    canonicalH: 1000,
    actualSourceW: 670,
    actualSourceH: 670,
    dimsMismatch: true,
  };
}

function makeSummary(peaks: DisplayRow[]): SkeletonSummary {
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: '/fake/skeleton.atlas',
    bones: { count: 1, names: ['root'] },
    slots: { count: 1 },
    attachments: { count: 1, byType: { RegionAttachment: 1 } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks,
    animationBreakdown: [],
    unusedAttachments: [],
    elapsedMs: 1,
    editorFps: 30,
  };
}

function makeDriftedBreakdownRow(): BreakdownRow {
  return {
    ...makeDriftedRow(),
    bonePath: ['root', 'slot-0', 'SQUARE'],
    bonePathLabel: 'root → slot-0 → SQUARE',
  };
}

function makeBreakdownSummary(rows: BreakdownRow[]): SkeletonSummary {
  const card: AnimationBreakdown = {
    cardId: 'setup-pose',
    animationName: 'Setup Pose (Default)',
    isSetupPose: true,
    uniqueAssetCount: rows.length,
    rows,
  };
  return {
    ...makeSummary([]),
    animationBreakdown: [card],
  };
}

// ---------------------------------------------------------------------------
// Test harness wrappers
// ---------------------------------------------------------------------------

/**
 * Minimal wrapper that provides the required query/onQueryChange props and
 * a fixed overrides map to GlobalMaxRenderPanel.
 * Also allows supplying effectiveScale via the overrides map: pass an
 * override (integer percent) to drive row.effectiveScale in the panel's
 * enrichWithEffective helper.
 */
function GlobalPanel({
  loaderMode,
  overridePct,
}: {
  loaderMode: 'auto' | 'atlas-less';
  overridePct?: number;
}) {
  const [query] = useState('');
  const driftedRow = makeDriftedRow();
  const overrides = overridePct !== undefined
    ? new Map([[driftedRow.attachmentName, overridePct]])
    : new Map<string, number>();
  return (
    <GlobalMaxRenderPanel
      summary={makeSummary([driftedRow])}
      overrides={overrides}
      onOpenOverrideDialog={vi.fn()}
      onJumpToAnimation={vi.fn()}
      query={query}
      onQueryChange={vi.fn()}
      loaderMode={loaderMode}
    />
  );
}

function BreakdownPanel({ loaderMode }: { loaderMode: 'auto' | 'atlas-less' }) {
  const [query] = useState('');
  const driftedRow = makeDriftedBreakdownRow();
  return (
    <AnimationBreakdownPanel
      summary={makeBreakdownSummary([driftedRow])}
      focusAnimationName={null}
      onFocusConsumed={vi.fn()}
      overrides={new Map()}
      onOpenOverrideDialog={vi.fn()}
      query={query}
      onQueryChange={vi.fn()}
      loaderMode={loaderMode}
    />
  );
}

// ---------------------------------------------------------------------------
// G-02: tooltip surfaces on every hover, not once-per-session
// ---------------------------------------------------------------------------

describe('G-02: tooltip surfaces on every hover (not once-per-session)', () => {
  it('GlobalMaxRenderPanel: fires deterministically across multiple mouseEnter/mouseLeave cycles', () => {
    render(<GlobalPanel loaderMode="auto" />);
    const host = screen.getByTestId('dims-badge-host');
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.mouseEnter(host);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    fireEvent.mouseLeave(host);
    expect(screen.queryByRole('tooltip')).toBeNull();
    // Second hover — must fire again (not once-per-session)
    fireEvent.mouseEnter(host);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
    fireEvent.mouseLeave(host);
    // Third hover
    fireEvent.mouseEnter(host);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G-01 D-02: mode-aware wording
// ---------------------------------------------------------------------------

describe('G-01 D-02: mode-aware wording', () => {
  it('atlas-source mode ("auto") renders "Atlas region declares" wording', () => {
    render(<GlobalPanel loaderMode="auto" />);
    fireEvent.mouseEnter(screen.getByTestId('dims-badge-host'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Atlas region declares 670×670');
  });

  it('atlas-less mode renders "Source PNG (" wording', () => {
    render(<GlobalPanel loaderMode="atlas-less" />);
    fireEvent.mouseEnter(screen.getByTestId('dims-badge-host'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Source PNG (670×670)');
  });
});

// ---------------------------------------------------------------------------
// G-03: cap-binding-aware second sentence
// ---------------------------------------------------------------------------

describe('G-03: cap-binding-aware suffix', () => {
  it('effectiveScale=0.5 (override 50%) suppresses the cap suffix — sourceRatio=0.67, 0.5 < 0.67', () => {
    // 50% override → effectiveScale = 0.5, sourceRatio = 670/1000 = 0.67
    // 0.5 < 0.67 → cap NOT binding → no second sentence
    render(<GlobalPanel loaderMode="auto" overridePct={50} />);
    fireEvent.mouseEnter(screen.getByTestId('dims-badge-host'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).not.toContain('Optimize will cap');
  });

  it('effectiveScale=1.0 (no override) surfaces the cap suffix — sourceRatio=0.67, 1.0 > 0.67', () => {
    // No override → effectiveScale = 1.0 (clamped), sourceRatio = 0.67
    // 1.0 > 0.67 → cap binds → second sentence appears
    render(<GlobalPanel loaderMode="auto" />);
    fireEvent.mouseEnter(screen.getByTestId('dims-badge-host'));
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Optimize will cap at on-disk size.');
  });
});

// ---------------------------------------------------------------------------
// G-02: badge span has no native title attribute
// ---------------------------------------------------------------------------

describe('G-02: badge has no native title attribute', () => {
  it('GlobalMaxRenderPanel badge span does not have title attribute', () => {
    render(<GlobalPanel loaderMode="auto" />);
    const host = screen.getByTestId('dims-badge-host');
    const badgeSpan = host.querySelector('span');
    expect(badgeSpan?.getAttribute('title')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// G-02 sibling-symmetric: AnimationBreakdownPanel badge
// ---------------------------------------------------------------------------

describe('G-02 sibling-symmetric: AnimationBreakdownPanel badge fires on every hover', () => {
  it('AnimationBreakdownPanel badge fires deterministically with same atlas-source wording', () => {
    render(<BreakdownPanel loaderMode="auto" />);
    // The "Setup Pose (Default)" card is auto-expanded on mount (Phase 3 D-63/D-64).
    // No click needed — rows are already rendered.
    const host = screen.getByTestId('dims-badge-host');
    fireEvent.mouseEnter(host);
    const tooltip = screen.getByRole('tooltip');
    expect(tooltip.textContent).toContain('Atlas region declares 670×670');
    fireEvent.mouseLeave(host);
    expect(screen.queryByRole('tooltip')).toBeNull();
    // Second hover — fires again (sibling symmetry + deterministic)
    fireEvent.mouseEnter(host);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });
});
