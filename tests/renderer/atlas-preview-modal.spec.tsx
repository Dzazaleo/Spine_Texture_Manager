// @vitest-environment jsdom
/**
 * Phase 7 — renderer-side specs for AtlasPreviewModal.
 *
 * Coverage (per CONTEXT.md <decisions> tests):
 *   - Modal opens with default view (Optimized @ 2048, page 1) [D-135]
 *   - Toggle re-render: switching mode/resolution updates active class [D-128]
 *   - Pager bounds-disable correctly [D-128]
 *   - Dblclick on canvas fires onJumpToAttachment with correct attachmentName [D-130]
 *   - Accessibility: canvas role=img + aria-label describing page+regions+efficiency [D-138]
 *   - Close interactions (X button + overlay) [D-81]
 *
 * Canvas-pixel assertions are SKIPPED (jsdom returns null from getContext('2d'))
 * — pixel correctness is asserted via tests/core/atlas-preview.spec.ts golden
 * values + a manual checkpoint:human-verify gate. See RESEARCH §Open Question 3.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AtlasPreviewModal } from '../../src/renderer/src/modals/AtlasPreviewModal';
import type { SkeletonSummary, DisplayRow } from '../../src/shared/types';

afterEach(cleanup);

/**
 * Build a fully-populated DisplayRow for synthetic tests. Every numeric field
 * is set so buildExportPlan / buildAtlasPreview can consume the row without
 * NaN propagation. peakScale=1 keeps Optimized output dims === source dims —
 * predictable for the canvas hit-test math.
 */
function row(
  attachmentName: string,
  sourceW: number,
  sourceH: number,
  sourcePath: string,
): DisplayRow {
  return {
    attachmentKey: `default::${attachmentName}::${attachmentName}`,
    skinName: 'default',
    slotName: attachmentName,
    attachmentName,
    animationName: '__SETUP__',
    time: 0,
    frame: 0,
    peakScaleX: 1,
    peakScaleY: 1,
    peakScale: 1,
    worldW: sourceW,
    worldH: sourceH,
    sourceW,
    sourceH,
    isSetupPosePeak: true,
    originalSizeLabel: `${sourceW}×${sourceH}`,
    peakSizeLabel: `${sourceW}×${sourceH}`,
    scaleLabel: '1.000×',
    sourceLabel: '__SETUP__',
    frameLabel: '—',
    sourcePath,
  };
}

// Helper: synthesize a minimal SkeletonSummary with 3 small regions that pack
// into a single 2048×2048 page.
function makeSummary(): SkeletonSummary {
  const peaks: DisplayRow[] = [
    row('CIRCLE', 64, 64, '/fake/CIRCLE.png'),
    row('SQUARE', 128, 128, '/fake/SQUARE.png'),
    row('TRIANGLE', 96, 96, '/fake/TRIANGLE.png'),
  ];
  return {
    skeletonPath: '/fake/skeleton.json',
    atlasPath: '/fake/skeleton.atlas',
    bones: { count: 1, names: ['root'] },
    slots: { count: 3 },
    attachments: { count: 3, byType: { RegionAttachment: 3 } },
    skins: { count: 1, names: ['default'] },
    animations: { count: 0, names: [] },
    peaks,
    animationBreakdown: [],
    unusedAttachments: [],
    elapsedMs: 1,
  };
}

describe('AtlasPreviewModal — default view (D-135)', () => {
  it('opens with role=dialog labelled "Atlas Preview" + Optimized + 2048 active', () => {
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: /atlas preview/i });
    expect(dialog).not.toBeNull();
    // Default mode: Optimized
    const optimizedBtn = screen.getByRole('button', { name: /^optimized$/i });
    expect(optimizedBtn.className).toMatch(/bg-accent/);
    // Default resolution: 2048
    const res2048Btn = screen.getByRole('button', { name: /^2048px$/i });
    expect(res2048Btn.className).toMatch(/bg-accent/);
  });

  it('renders the footer disclaimer literally', () => {
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByText(/Preview assumes 2px padding and no rotation/i),
    ).not.toBeNull();
  });

  it('does not render when open=false', () => {
    const { container } = render(
      <AtlasPreviewModal
        open={false}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });
});

describe('AtlasPreviewModal — toggle re-render (D-128)', () => {
  it('clicking Original flips the active class to Original toggle', () => {
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const originalBtn = screen.getByRole('button', { name: /^original$/i });
    const optimizedBtn = screen.getByRole('button', { name: /^optimized$/i });
    expect(optimizedBtn.className).toMatch(/bg-accent/);
    fireEvent.click(originalBtn);
    expect(originalBtn.className).toMatch(/bg-accent/);
    expect(optimizedBtn.className).not.toMatch(/bg-accent/);
  });

  it('clicking 4096px flips the active class to 4096 toggle', () => {
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const res4096Btn = screen.getByRole('button', { name: /^4096px$/i });
    fireEvent.click(res4096Btn);
    expect(res4096Btn.className).toMatch(/bg-accent/);
  });
});

describe('AtlasPreviewModal — pager bounds (D-128)', () => {
  it('< button disabled at page 1; > button disabled at page totalPages', () => {
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    // aria-label literals "Previous page" / "Next page" come from the
    // pager buttons in src/renderer/src/modals/AtlasPreviewModal.tsx.
    const prev = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });
    expect(prev.hasAttribute('disabled')).toBe(true);
    // 3 small regions in 1 page → next also disabled.
    expect(next.hasAttribute('disabled')).toBe(true);
  });
});

describe('AtlasPreviewModal — dblclick jump-target (D-130)', () => {
  it('dblclick on canvas calls onJumpToAttachment with the hit region attachmentName', () => {
    const onJump = vi.fn();
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={onJump}
        onClose={vi.fn()}
      />,
    );
    const canvas = screen.getByRole('img', {
      name: /packed atlas page/i,
    }) as HTMLCanvasElement;
    // Mock getBoundingClientRect so the hit-test math has a deterministic base.
    // The packer places packed regions starting near the (0, 0) corner of the
    // 2048×2048 page; clicking at CSS (5, 5) inside the page-aligned canvas
    // lands inside the first packed region regardless of which input it is.
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 2048,
        bottom: 2048,
        width: 2048,
        height: 2048,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    fireEvent.doubleClick(canvas, { clientX: 5, clientY: 5 });
    expect(onJump).toHaveBeenCalledTimes(1);
    // Spec doesn't pin which attachment is "first" (depends on alphabetical
    // sort by sourcePath). Just assert it received some attachmentName from
    // our 3 known regions.
    expect(['CIRCLE', 'SQUARE', 'TRIANGLE']).toContain(onJump.mock.calls[0][0]);
  });

  it('dblclick on empty canvas area does NOT call onJumpToAttachment', () => {
    const onJump = vi.fn();
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={onJump}
        onClose={vi.fn()}
      />,
    );
    const canvas = screen.getByRole('img', {
      name: /packed atlas page/i,
    }) as HTMLCanvasElement;
    canvas.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 2048,
        bottom: 2048,
        width: 2048,
        height: 2048,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    // Click far beyond all packed regions — total packed area is well below
    // 300px from the origin even with 2px padding.
    fireEvent.doubleClick(canvas, { clientX: 2000, clientY: 2000 });
    expect(onJump).not.toHaveBeenCalled();
  });
});

describe('AtlasPreviewModal — accessibility (D-138)', () => {
  it('canvas has role=img + aria-label describing page count + region count + efficiency', () => {
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const canvas = screen.getByRole('img');
    const label = canvas.getAttribute('aria-label') ?? '';
    expect(label).toMatch(/Packed atlas page/);
    expect(label).toMatch(/region/);
    expect(label).toMatch(/efficiency/i);
  });
});

describe('AtlasPreviewModal — close interactions (D-81)', () => {
  it('clicking the close X button calls onClose', () => {
    const onClose = vi.fn();
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /^close$/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clicking the overlay (outside the panel) calls onClose', () => {
    const onClose = vi.fn();
    render(
      <AtlasPreviewModal
        open={true}
        summary={makeSummary()}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={onClose}
      />,
    );
    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
