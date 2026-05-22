// @vitest-environment jsdom
/**
 * Phase 49 Plan 02 — VariantDialog renderer test (EXPORT-01).
 *
 * Mirrors the harness pattern from `tests/renderer/optimize-dialog-output-card.spec.tsx`
 * (window.api stub + ComponentProps builder + @testing-library/react).
 *
 * Coverage:
 * - The basic numeric scale field (D-05) renders and shows the controlled value.
 * - Clicking Export → onConfirmStart resolves { proceed:true, outDir } →
 *   window.api.exportVariant fires ONCE with the Plan-01 arg order:
 *   (summary, s, parentDir, overwrite, sharpen, mode, atlasOpts, overrides[], buffer).
 *   Asserts the 2nd arg is the scale and the 3rd arg is the picked parent dir.
 * - s >= 1 disables the Export button + shows the inline hint (cheap D-08 pre-check).
 * - s <= 0 (e.g. 2.0 and 0) likewise disables Export.
 */
import * as React from 'react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { VariantDialog } from '../../src/renderer/src/modals/VariantDialog';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types';

let exportVariantMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  exportVariantMock = vi.fn(async () => ({
    ok: true,
    summary: {
      successes: 3,
      errors: [],
      outputDir: '/tmp/parent/SIMPLE_TEST@0.5x',
      durationMs: 100,
      cancelled: false,
    },
  }));
  vi.stubGlobal('api', {
    exportVariant: exportVariantMock,
    pickOutputDirectory: vi.fn(async () => '/tmp/parent'),
    openOutputFolder: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function makePlan(): ExportPlan {
  return {
    skeletonPath: '/proj/SIMPLE_TEST.json',
    rows: [
      {
        sourcePath: '/fake/CIRCLE.png',
        outPath: 'images/CIRCLE.png',
        sourceW: 699,
        sourceH: 699,
        outW: 350,
        outH: 350,
        effectiveScale: 0.5,
        attachmentNames: ['CIRCLE'],
      },
    ],
    excludedUnused: [],
    passthroughCopies: [],
    totals: { count: 1 },
  } as unknown as ExportPlan;
}

function makeSummary(): SkeletonSummary {
  return {
    skeletonPath: '/proj/SIMPLE_TEST.json',
    atlasPath: '/proj/SIMPLE_TEST.atlas',
    runtimeTag: '4.2',
    peaks: [{ peakScale: 1 }],
    regions: [{ peakScale: 1 }],
  } as unknown as SkeletonSummary;
}

function buildProps(
  overrides: Partial<ComponentProps<typeof VariantDialog>> = {},
): ComponentProps<typeof VariantDialog> {
  return {
    open: true,
    plan: makePlan(),
    summary: makeSummary(),
    outDir: null,
    onClose: vi.fn(),
    onConfirmStart: vi.fn(async () => ({
      proceed: true,
      overwrite: false,
      outDir: '/tmp/parent',
    })),
    scale: 0.5,
    onScaleChange: vi.fn(),
    effectiveOverrides: new Map<string, number>([['CIRCLE', 150]]),
    sharpenOnExport: false,
    onSharpenChange: vi.fn(),
    safetyBufferPercent: 0,
    onSafetyBufferChange: vi.fn(),
    outputMode: 'loose',
    onOutputModeChange: vi.fn(),
    atlasOpts: { maxPageSize: 4096, allowRotation: false, padding: 2 },
    onAtlasOptsChange: vi.fn(),
    ...overrides,
  } as ComponentProps<typeof VariantDialog>;
}

describe('VariantDialog — Phase 49 EXPORT-01', () => {
  it('renders the basic numeric scale field showing the controlled value', () => {
    render(<VariantDialog {...buildProps({ scale: 0.5 })} />);
    const input = screen.getByLabelText(/Scale:/i) as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('number');
    expect(input.value).toBe('0.5');
  });

  it('invokes window.api.exportVariant once with (summary, 0.5, "/tmp/parent", ...) on Export', async () => {
    const props = buildProps({ scale: 0.5 });
    render(<VariantDialog {...props} />);

    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    await waitFor(() => {
      expect(exportVariantMock).toHaveBeenCalledTimes(1);
    });

    const callArgs = exportVariantMock.mock.calls[0];
    // Arg order: (summary, s, parentDir, overwrite, sharpen, mode, atlasOpts,
    //             effectiveOverrides[], safetyBufferPercent).
    expect(callArgs[0]).toBe(props.summary); // summary
    expect(callArgs[1]).toBe(0.5); // scale
    expect(callArgs[2]).toBe('/tmp/parent'); // picked parent dir
    expect(callArgs[3]).toBe(false); // overwrite
    expect(callArgs[5]).toBe('loose'); // outputMode
    // effectiveOverrides crosses the wire as a [name, pct] entries array.
    expect(callArgs[7]).toEqual([['CIRCLE', 150]]);
    expect(callArgs[8]).toBe(0); // safetyBufferPercent
  });

  it('CR-01: surfaces per-row worker failures when the IPC returns ok:true with a non-empty errors[]', async () => {
    // runExport/runRepack do NOT throw on per-row failures (overwrite
    // collisions, missing sources, sharp errors) — they return ok:true with a
    // populated summary.errors[]. The dialog must NOT render that as success.
    exportVariantMock.mockResolvedValueOnce({
      ok: true,
      summary: {
        successes: 0,
        errors: [
          {
            kind: 'overwrite-source',
            path: '/tmp/parent/SIMPLE_TEST@0.5x/images/CIRCLE.png',
            message: 'Refusing to overwrite existing file: …/CIRCLE.png',
          },
        ],
        outputDir: '/tmp/parent/SIMPLE_TEST@0.5x',
        durationMs: 12,
        cancelled: false,
      },
    });

    render(<VariantDialog {...buildProps({ scale: 0.5 })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export Variant/i }));
    });

    // The failed-count summary line and the per-row error are both visible; the
    // "0 files exported" success copy is NOT.
    await waitFor(() => {
      expect(screen.getByText(/0 succeeded, 1 failed\./i)).toBeTruthy();
    });
    expect(screen.getByText(/Refusing to overwrite existing file/i)).toBeTruthy();
    expect(screen.queryByText(/files? exported\./i)).toBeNull();
  });

  it('WR-02: a rejected exportVariant promise transitions to the complete error state (no wedged in-progress)', async () => {
    exportVariantMock.mockRejectedValueOnce(new Error('unexpected main-side throw'));

    render(<VariantDialog {...buildProps({ scale: 0.5 })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export Variant/i }));
    });

    // The dialog reached the complete state (Close button present) instead of
    // staying stuck on "Exporting…", and the rejection message is surfaced
    // (it appears in both the top error line and the synthesized per-row list).
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Close$/i })).toBeTruthy();
    });
    expect(screen.getAllByText(/unexpected main-side throw/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Exporting…/i)).toBeNull();
  });

  it('disables Export and shows the inline hint when scale >= 1 (s = 1.0)', () => {
    render(<VariantDialog {...buildProps({ scale: 1.0 })} />);
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    expect(
      screen.getByText(/enter a value between 0 and 1/i),
    ).toBeTruthy();
  });

  it('disables Export when scale >= 1 (s = 2.0)', () => {
    render(<VariantDialog {...buildProps({ scale: 2.0 })} />);
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables Export when scale <= 0 (s = 0)', () => {
    render(<VariantDialog {...buildProps({ scale: 0 })} />);
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
