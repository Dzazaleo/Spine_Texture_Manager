// @vitest-environment jsdom
/**
 * 2026-05-08 UX nicety — auto-expand-on-error in OptimizeDialog.
 *
 * Pre-fix: per-row error labels were gated on click-to-expand (a Set
 * `expandedErrors` toggled by row clicks). When export failed, the row
 * showed only a warning glyph + the global "N failed" tally; the underlying
 * libvips message stayed hidden until the user thought to click the row.
 *
 * Post-fix: the onExportProgress subscription seeds `expandedErrors` with
 * the failing row's index when status === 'error'. Users can still click
 * the row to collapse — auto-expand is a default, not a forcing function.
 *
 * Sister context: debug session
 * `.planning/debug/resolved/export-extract-area-bad-area.md` falsified
 * "silent failure was a UI bug" — it was intentional click-to-expand —
 * but the user opted in to auto-expand as a follow-up.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types';

let progressCallback: ((e: ExportProgressEvent) => void) | null = null;
let resolveStartExport: ((v: unknown) => void) | null = null;

beforeEach(() => {
  progressCallback = null;
  resolveStartExport = null;
  vi.stubGlobal('api', {
    onExportProgress: vi.fn((cb: (e: ExportProgressEvent) => void) => {
      progressCallback = cb;
      return () => {
        progressCallback = null;
      };
    }),
    // startExport stays pending so the dialog remains in 'in-progress'
    // and the progress subscription stays mounted while the test fires
    // synthetic events.
    startExport: vi.fn(
      () =>
        new Promise((resolve) => {
          resolveStartExport = resolve;
        }),
    ),
    cancelExport: vi.fn(),
    openOutputFolder: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

const PLAN: ExportPlan = {
  skeletonPath: '/proj/test.json',
  rows: [
    {
      sourcePath: '/fake/A.png',
      outPath: 'images/A.png',
      sourceW: 100,
      sourceH: 100,
      outW: 50,
      outH: 50,
      effectiveScale: 0.5,
      attachmentNames: ['A'],
    },
  ],
  passthroughCopies: [],
  excludedUnused: [],
  totals: { count: 1 },
};

describe('OptimizeDialog — auto-expand on per-row error', () => {
  it('error progress event renders the underlying message inline (no manual click required)', async () => {
    render(
      <OptimizeDialog
        open
        plan={PLAN}
        outDir="/tmp/out"
        onClose={() => undefined}
        onOpenAtlasPreview={() => undefined}
        sharpenOnExport={false}
        onSharpenChange={() => undefined}
        safetyBufferPercent={0}
        onSafetyBufferChange={() => undefined}
        outputMode="loose"
        onOutputModeChange={() => undefined}
        atlasOpts={{ maxPageSize: 4096, allowRotation: false, padding: 2 }}
        onAtlasOptsChange={() => undefined}
      />,
    );

    // Click Start to flip state → 'in-progress' so the
    // onExportProgress subscription mounts.
    const startBtn = screen.getByRole('button', { name: /start/i });
    await act(async () => {
      fireEvent.click(startBtn);
    });

    // The subscription must be live now.
    expect(progressCallback).not.toBeNull();

    // Deliver an error event for row 0.
    await act(async () => {
      progressCallback!({
        index: 0,
        total: 1,
        path: '/fake/A.png',
        outPath: 'images/A.png',
        status: 'error',
        error: { kind: 'sharp-error', path: '/fake/A.png', message: 'extract_area: bad extract area' },
      });
    });

    // Error text MUST be visible without any further click.
    expect(screen.getByText('extract_area: bad extract area')).not.toBeNull();
  });

  it('user can still click the row to collapse the auto-expanded error', async () => {
    render(
      <OptimizeDialog
        open
        plan={PLAN}
        outDir="/tmp/out"
        onClose={() => undefined}
        onOpenAtlasPreview={() => undefined}
        sharpenOnExport={false}
        onSharpenChange={() => undefined}
        safetyBufferPercent={0}
        onSafetyBufferChange={() => undefined}
        outputMode="loose"
        onOutputModeChange={() => undefined}
        atlasOpts={{ maxPageSize: 4096, allowRotation: false, padding: 2 }}
        onAtlasOptsChange={() => undefined}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start/i }));
    });
    await act(async () => {
      progressCallback!({
        index: 0,
        total: 1,
        path: '/fake/A.png',
        outPath: 'images/A.png',
        status: 'error',
        error: { kind: 'sharp-error', path: '/fake/A.png', message: 'extract_area: bad extract area' },
      });
    });
    expect(screen.getByText('extract_area: bad extract area')).not.toBeNull();

    // Click the failing row → toggles expanded off.
    const rowBtn = screen.getByRole('button', { name: /images\/A\.png/i });
    await act(async () => {
      fireEvent.click(rowBtn);
    });
    expect(screen.queryByText('extract_area: bad extract area')).toBeNull();
  });
});
