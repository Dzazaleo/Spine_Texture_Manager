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
 *
 * Phase 12 Plan 03 (D-19) — F1 atlas-image URL regression tests appended at
 * the bottom of this file exercise the algorithmic correctness of the
 * `pathToFileURL → app-image://localhost/<pathname>` URL construction (the
 * same algorithm running in the new `atlas:resolve-image-url` IPC handler).
 * Runs in the 12-02 expanded matrix → Windows runner exercises real
 * pathToFileURL Windows behavior; macOS/Linux runners verify the algorithm
 * doesn't break on POSIX paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { pathToFileURL } from 'node:url';
import { AtlasPreviewModal } from '../../src/renderer/src/modals/AtlasPreviewModal';
import type { SkeletonSummary, DisplayRow } from '../../src/shared/types';

afterEach(cleanup);

// Phase 12 Plan 03 (D-19) — F1 fix: AtlasPreviewModal.tsx now calls
// `window.api.pathToImageUrl(absolutePath)` (Promise<string>) before
// assigning img.src, so the test environment needs a window.api stub
// or every render hits "TypeError: Cannot read properties of undefined".
// The stub returns a string that mirrors the production main-side handler
// shape (`app-image://localhost/<pathname>`) — jsdom can't actually fetch
// the URL but img.src assignment + the existing onload/onerror callbacks
// are exercised. Minimal surface: only `pathToImageUrl` is used by this
// modal; other api methods stay undefined and any future test additions
// can extend the stub. Pattern mirrors tests/renderer/save-load.spec.tsx
// (vi.stubGlobal('api', { ... })) and tests/renderer/help-dialog.spec.tsx.
beforeEach(() => {
  vi.stubGlobal('api', {
    pathToImageUrl: vi.fn(async (absolutePath: string) => {
      const fileUrl = pathToFileURL(absolutePath);
      return `app-image://localhost${fileUrl.pathname}`;
    }),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    editorFps: 30,
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

/**
 * Phase 12 Plan 03 (D-19) — F1 atlas-image URL regression tests.
 *
 * The bug: AtlasPreviewModal.tsx:116 used to construct img.src as
 *   `app-image://localhost${encodeURI(absolutePath)}`
 *
 * On Windows, absolutePath = 'C:\\Users\\Leo\\stm\\images\\CIRCLE.png'.
 * encodeURI preserves ':', so the final URL was
 *   'app-image://localhostC:%5CUsers%5C…'
 * which the URL parser interprets with host='localhostc' (lowercased; up to
 * the first ':') — the protocol handler 404s and the atlas preview shows
 * only outline rectangles instead of the underlying texture.
 * RESEARCH §F1 + 11-WIN-FINDINGS §F1: the trailing 'c' on 'localhost' is
 * the smoking gun (drive-letter `C:` glued onto `localhost`).
 *
 * The fix: route URL construction through pathToFileURL().pathname in the
 * privileged main process via the new `atlas:resolve-image-url` IPC handler
 * + `window.api.pathToImageUrl` preload bridge. The handler enforces
 * `windows: true` interpretation when it sees a leading drive-letter so
 * the URL is correct regardless of which OS hosts the IPC handler.
 *
 * These tests exercise the SAME algorithm directly via node:url
 * pathToFileURL (the IPC handler's body) — algorithmic correctness on
 * the inputs that hit the bridge in production. CI runs this spec on
 * the 12-02 expanded matrix [ubuntu-latest, windows-2022, macos-14] so
 * the Windows runner exercises real pathToFileURL Windows behavior on
 * top of the explicit { windows: true } simulation.
 */
describe('F1 regression — app-image:// URL construction (D-19)', () => {
  it('Windows-style path: host stays "localhost" (NOT "localhostc"); drive letter goes in pathname', () => {
    const winPath = 'C:\\Users\\Tester\\stm\\images\\CIRCLE.png';
    // { windows: true } forces Windows interpretation regardless of dev-host
    // OS. Same option the IPC handler picks when it detects a drive-letter.
    const fileUrl = pathToFileURL(winPath, { windows: true });
    const appImageUrl = `app-image://localhost${fileUrl.pathname}`;
    const parsed = new URL(appImageUrl);

    // The bug: drive-letter `C` glued onto 'localhost' → host became 'localhostc'.
    expect(parsed.host).toBe('localhost');
    expect(parsed.host).not.toMatch(/localhostc/i);

    // Drive-letter ends up in path, not host.
    expect(parsed.pathname).toMatch(/^\/C:\//);
  });

  it('POSIX-style path: host="localhost" and pathname is the absolute path verbatim', () => {
    const posixPath = '/Users/leo/stm/images/CIRCLE.png';
    const fileUrl = pathToFileURL(posixPath);
    const appImageUrl = `app-image://localhost${fileUrl.pathname}`;
    const parsed = new URL(appImageUrl);

    expect(parsed.host).toBe('localhost');
    expect(parsed.pathname).toBe('/Users/leo/stm/images/CIRCLE.png');
  });

  it('the buggy concat shape produces a malformed URL on Windows-style input (anti-test pinning the original failure mode)', () => {
    const winPath = 'C:\\Users\\Tester\\stm\\images\\CIRCLE.png';
    // Simulate the OLD (buggy) renderer concat — encodeURI preserves ':'.
    const buggyUrl = `app-image://localhost${encodeURI(winPath)}`;

    // Two possible failure modes for the buggy shape, BOTH of which break
    // the atlas preview at runtime:
    //   (a) Permissive parser (Chromium / older Node WHATWG URL) — the ':'
    //       in the drive letter is treated as a host:port separator and
    //       host becomes 'localhostc' (lowercased; up to first ':'), which
    //       is the original Windows runtime smoking gun
    //       (11-WIN-FINDINGS §F1).
    //   (b) Strict parser (modern Node WHATWG URL) — the malformed URL
    //       throws TypeError 'Invalid URL' outright because the path
    //       starts mid-host without a separator.
    // Either outcome is sufficient evidence of the bug; the positive
    // test above proves the fix shape avoids both. The anti-test pair
    // makes the regression visible if a future refactor accidentally
    // re-introduces the concat shape.
    let outcome: 'invalid-url' | 'localhostc-host' | 'looks-fine' = 'looks-fine';
    try {
      const buggyParsed = new URL(buggyUrl);
      if (buggyParsed.host === 'localhostc') outcome = 'localhostc-host';
    } catch {
      outcome = 'invalid-url';
    }
    expect(outcome).not.toBe('looks-fine');
  });
});
