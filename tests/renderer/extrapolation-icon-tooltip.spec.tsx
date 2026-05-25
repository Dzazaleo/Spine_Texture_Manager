// @vitest-environment jsdom
/**
 * Phase 31 Plan 04 Task 2 — TOOLTIP-01 behavioral tests for the
 * ExtrapolationIcon hover tooltip regression fix (fix-shape (c) — React-managed
 * primitive ported from DimsBadge, sibling-symmetry by construction).
 *
 * Test coverage maps 1:1 to PLAN.md <behavior> T1..T4:
 *   - T1 (PRIMARY): Hovering the icon's host span surfaces a React-managed
 *     tooltip portal in document.body with the verbatim text "Spine rig peak:
 *     X.XX× source" (Phase 54 dropped the now-misleading "— export capped at
 *     canonical" suffix). On mouseLeave the portal unmounts. Asserted in BOTH
 *     GlobalMaxRenderPanel and AnimationBreakdownPanel.
 *   - T2 (sibling-symmetry, D-D-04): Both panels exhibit the same fix mechanism
 *     because the change lives only inside ExtrapolationIcon.tsx. We assert
 *     structural sibling-symmetry by source-walk: the panel files must NOT
 *     contain any ExtrapolationIcon-specific tooltip workaround code (no
 *     `<span title=...>` wrapper, no conditional `td title=undefined`).
 *   - T3 (no false-positive on rows without icon): When `peakScale <= 1`, the
 *     icon does NOT render, no React-managed tooltip portal exists, and the
 *     parent TD's existing `title` ("World AABB at peak: …") is unchanged.
 *   - T4 (doc-comment accuracy): `grep` invariants over the icon source — the
 *     "Phase 31" annotation is present and the invalidated "reliably wins"
 *     claim is removed.
 *
 * Mount strategy mirrors tests/renderer/dims-badge-tooltip.spec.tsx:
 *   - jsdom polyfills for useVirtualizer (offsetHeight/Width, ResizeObserver).
 *   - Panels mounted directly with hand-built RegionRow / BreakdownRow fixtures
 *     where peakScale > 1 (or === 1 for T3) — peakDisplayW/H are derived inside
 *     the panel via enrichWithEffective + computeExportDims.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';
import { AnimationBreakdownPanel } from '../../src/renderer/src/panels/AnimationBreakdownPanel';
import type {
  AnimationBreakdown,
  BreakdownRow,
  DisplayRow,
  RegionRow,
  SkeletonSummary,
} from '../../src/shared/types';

// ---------------------------------------------------------------------------
// jsdom polyfills (mirrors dims-badge-tooltip.spec.tsx)
// ---------------------------------------------------------------------------

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
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function () {};
  }
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Fixtures — peakScale > 1 (icon renders) and peakScale === 1 (icon absent)
// ---------------------------------------------------------------------------

/**
 * RegionRow with peakScale > 1 — drives the ExtrapolationIcon to render. The
 * panel computes peakDisplayW/H via enrichWithEffective + computeExportDims;
 * the only field that matters for icon visibility is peakScale.
 */
function makeExtrapolatedRegion(opts?: { peakScale?: number }): RegionRow {
  const peakScale = opts?.peakScale ?? 1.42;
  return {
    regionName: 'SQUARE',
    attachmentName: 'SQUARE',
    skinName: 'default',
    slotName: 'slot-square',
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    peakScale,
    peakScaleX: peakScale,
    peakScaleY: peakScale,
    worldW: 1420,
    worldH: 1420,
    sourceW: 1000,
    sourceH: 1000,
    isSetupPosePeak: true,
    sourcePath: '/fake/SQUARE.png',
    canonicalW: 1000,
    canonicalH: 1000,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    originalSizeLabel: '1000×1000',
    peakSizeLabel: '1000×1000',
    scaleLabel: `${peakScale.toFixed(3)}×`,
    sourceLabel: '__SETUP__',
    frameLabel: '—',
    contributingAttachments: [{
      attachmentName: 'SQUARE',
      skinName: 'default',
      slotName: 'slot-square',
      peakScale,
      animationName: '__SETUP__',
      time: 0,
      frame: 0,
      isSetupPosePeak: true,
    }],
  } as RegionRow;
}

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
      } as DisplayRow);
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

function makeBreakdownRow(opts?: { peakScale?: number }): BreakdownRow {
  const peakScale = opts?.peakScale ?? 1.42;
  return {
    attachmentKey: 'default::slot-square::SQUARE',
    skinName: 'default',
    slotName: 'slot-square',
    attachmentName: 'SQUARE',
    regionName: 'SQUARE',
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    peakScaleX: peakScale,
    peakScaleY: peakScale,
    peakScale,
    worldW: 1420,
    worldH: 1420,
    sourceW: 1000,
    sourceH: 1000,
    isSetupPosePeak: true,
    originalSizeLabel: '1000×1000',
    peakSizeLabel: '1000×1000',
    scaleLabel: `${peakScale.toFixed(3)}×`,
    sourceLabel: '__SETUP__',
    frameLabel: '—',
    sourcePath: '/fake/SQUARE.png',
    canonicalW: 1000,
    canonicalH: 1000,
    actualSourceW: undefined,
    actualSourceH: undefined,
    dimsMismatch: false,
    bonePath: ['root', 'slot-square', 'SQUARE'],
    bonePathLabel: 'root → slot-square → SQUARE',
  } as unknown as BreakdownRow;
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
// Harnesses
// ---------------------------------------------------------------------------

function GlobalPanel({ regions }: { regions: RegionRow[] }) {
  const [query, setQuery] = useState('');
  return (
    <GlobalMaxRenderPanel
      summary={makeSummary(regions)}
      overrides={new Map()}
      onOpenOverrideDialog={vi.fn()}
      query={query}
      onQueryChange={setQuery}
      loaderMode="atlas-less"
    />
  );
}

function BreakdownPanel({ rows }: { rows: BreakdownRow[] }) {
  const [query, setQuery] = useState('');
  return (
    <AnimationBreakdownPanel
      summary={makeBreakdownSummary(rows)}
      focusAnimationName={null}
      onFocusConsumed={vi.fn()}
      overrides={new Map()}
      onOpenOverrideDialog={vi.fn()}
      query={query}
      onQueryChange={setQuery}
      loaderMode="atlas-less"
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers — locate the ExtrapolationIcon host span (the React-managed
// onMouseEnter target). Selector is the SVG path data unique to this icon
// (the upward-arrow shaft). We walk up to find the host <span> ancestor
// that owns the onMouseEnter handler — i.e. the closest ancestor with the
// `inline-block` class that contains exactly the icon SVG.
// ---------------------------------------------------------------------------

function findExtrapolationIconHost(container: HTMLElement): HTMLElement | null {
  // Phase 31 fix-shape (c): the icon SVG is wrapped in a host span. Find the
  // SVG via its unique vertical-shaft path (M10 16 L10 4) and walk up to its
  // parent span.
  const svg = container.querySelector('svg path[d="M10 16 L10 4"]');
  if (!svg) return null;
  let host: Element | null = svg.closest('svg')?.parentElement ?? null;
  // The host is the <span ref=hostRef> immediately wrapping the SVG, with
  // an onMouseEnter handler. In jsdom we can't probe handler attachment
  // directly — testing-library exposes elements via fireEvent and the
  // span will respond to mouseEnter just fine.
  return host as HTMLElement | null;
}

// ---------------------------------------------------------------------------
// T1 (PRIMARY) — React-managed tooltip surfaces on hover in BOTH panels.
// ---------------------------------------------------------------------------

describe('TOOLTIP-01 T1 — ExtrapolationIcon hover surfaces React-managed tooltip', () => {
  it('GlobalMaxRenderPanel: hovering the icon renders the verbatim tooltip text via createPortal in document.body', () => {
    const regions = [makeExtrapolatedRegion({ peakScale: 1.42 })];
    const { container } = render(<GlobalPanel regions={regions} />);

    // Pre-hover: no tooltip in the document.
    expect(screen.queryByRole('tooltip')).toBeNull();

    const host = findExtrapolationIconHost(container);
    expect(host).not.toBeNull();

    fireEvent.mouseEnter(host!);

    const tooltip = screen.queryByRole('tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe('Spine rig peak: 1.42× source');
    // Portal target: the tooltip lives directly in document.body, NOT inside
    // the panel container (the regression-proof property of fix-shape (c)).
    expect(document.body.contains(tooltip)).toBe(true);
    expect(container.contains(tooltip)).toBe(false);

    fireEvent.mouseLeave(host!);
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Second hover — fires again (deterministic, not once-per-session).
    fireEvent.mouseEnter(host!);
    expect(screen.queryByRole('tooltip')).not.toBeNull();
  });

  it('AnimationBreakdownPanel: sibling-symmetric — same icon, same React-managed tooltip', () => {
    const rows = [makeBreakdownRow({ peakScale: 1.75 })];
    const { container } = render(<BreakdownPanel rows={rows} />);

    // Phase 31 PANEL-08 — Setup Pose card now starts collapsed; expand it so
    // the row renders.
    const card = container.querySelector('section[aria-labelledby^="bd-header-"]');
    const expandToggle = card?.querySelector(
      'button[aria-expanded]',
    ) as HTMLButtonElement | null;
    if (expandToggle !== null && expandToggle.getAttribute('aria-expanded') === 'false') {
      fireEvent.click(expandToggle);
    }

    const host = findExtrapolationIconHost(container);
    expect(host).not.toBeNull();

    fireEvent.mouseEnter(host!);
    const tooltip = screen.queryByRole('tooltip');
    expect(tooltip).not.toBeNull();
    expect(tooltip!.textContent).toBe('Spine rig peak: 1.75× source');
    expect(document.body.contains(tooltip)).toBe(true);
    expect(container.contains(tooltip)).toBe(false);

    fireEvent.mouseLeave(host!);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// T2 (sibling-symmetry, D-D-04) — change lives ONLY in ExtrapolationIcon.tsx.
// Both panels render the same component and surface the same React tooltip.
// We assert structural symmetry: neither panel contains an icon-specific
// tooltip workaround (no <span title=...> wrapper, no conditional td title
// suppression).
// ---------------------------------------------------------------------------

describe('TOOLTIP-01 T2 — sibling-symmetry by construction (D-D-04)', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const iconSource = readFileSync(
    path.join(repoRoot, 'src/renderer/src/components/icons/ExtrapolationIcon.tsx'),
    'utf-8',
  );
  const globalPanelSource = readFileSync(
    path.join(repoRoot, 'src/renderer/src/panels/GlobalMaxRenderPanel.tsx'),
    'utf-8',
  );
  const breakdownPanelSource = readFileSync(
    path.join(repoRoot, 'src/renderer/src/panels/AnimationBreakdownPanel.tsx'),
    'utf-8',
  );

  it('ExtrapolationIcon owns the createPortal + getBoundingClientRect mechanism', () => {
    expect(iconSource).toMatch(/createPortal/);
    expect(iconSource).toMatch(/getBoundingClientRect/);
  });

  it('GlobalMaxRenderPanel does NOT carry an icon-specific tooltip workaround', () => {
    // Fix-shape (a) marker: would have suppressed td title when peakScale>1.
    expect(globalPanelSource).not.toMatch(
      /title=\{\s*row\.peakScale\s*>\s*1\s*\?\s*undefined/,
    );
    // Fix-shape (b) marker: would have wrapped the icon in <span title=...>.
    // Detect a span title= attribute that interpolates the verbatim Spine rig
    // peak template (the wrapper span pattern). The plain td title= line is
    // always present for non-icon rows; we only reject the icon-wrapper span.
    expect(globalPanelSource).not.toMatch(
      /<span[^>]*title=\{`Spine rig peak:/,
    );
  });

  it('AnimationBreakdownPanel does NOT carry an icon-specific tooltip workaround', () => {
    expect(breakdownPanelSource).not.toMatch(
      /title=\{\s*row\.peakScale\s*>\s*1\s*\?\s*undefined/,
    );
    expect(breakdownPanelSource).not.toMatch(
      /<span[^>]*title=\{`Spine rig peak:/,
    );
  });

  it('Both panels still pass the verbatim Spine-rig-peak template to ExtrapolationIcon', () => {
    // Acceptance criterion from PLAN.md: REQUIREMENTS TOOLTIP-01 verbatim text
    // is preserved at both call sites (passed via the icon `title` prop).
    expect(globalPanelSource).toMatch(/Spine rig peak: \$\{row\.peakScale\.toFixed\(2\)\}× source`/);
    expect(breakdownPanelSource).toMatch(/Spine rig peak: \$\{row\.peakScale\.toFixed\(2\)\}× source`/);
  });
});

// ---------------------------------------------------------------------------
// T3 — no false-positive on rows without the icon (peakScale <= 1).
// ---------------------------------------------------------------------------

describe('TOOLTIP-01 T3 — peakScale <= 1 rows: no icon, no React tooltip portal', () => {
  it('GlobalMaxRenderPanel: peakScale=1.0 row renders no ExtrapolationIcon and no tooltip portal', () => {
    const regions = [makeExtrapolatedRegion({ peakScale: 1.0 })];
    const { container } = render(<GlobalPanel regions={regions} />);

    // Icon is absent — its unique shaft path is not in the DOM.
    expect(container.querySelector('svg path[d="M10 16 L10 4"]')).toBeNull();

    // No React-managed tooltip portal anywhere.
    expect(screen.queryByRole('tooltip')).toBeNull();

    // Parent TD's existing `title` attribute IS still present (sub-feature D
    // contract: TD-level "World AABB at peak: …" survives untouched on
    // non-icon rows).
    const tdWithAabbTitle = Array.from(container.querySelectorAll('td')).find(
      (td) => td.getAttribute('title')?.includes('World AABB at peak'),
    );
    expect(tdWithAabbTitle).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// T4 — doc-comment accuracy: Phase 31 annotation present, "reliably wins"
// claim removed.
// ---------------------------------------------------------------------------

describe('TOOLTIP-01 T4 — ExtrapolationIcon doc-comment accurately describes the new mechanism', () => {
  const repoRoot = path.resolve(__dirname, '../..');
  const iconSource = readFileSync(
    path.join(repoRoot, 'src/renderer/src/components/icons/ExtrapolationIcon.tsx'),
    'utf-8',
  );

  it('contains a Phase 31 annotation (≥1 mention)', () => {
    const matches = iconSource.match(/Phase 31/g);
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT contain the invalidated "reliably wins" claim', () => {
    expect(iconSource).not.toMatch(/reliably wins/);
  });
});
