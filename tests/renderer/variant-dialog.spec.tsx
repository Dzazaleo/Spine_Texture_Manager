// @vitest-environment jsdom
/**
 * Phase 49 Plan 02 — VariantDialog renderer test (EXPORT-01).
 * Phase 51 Plan 02 — MIGRATED to the rows[] prop (the scale → rows props change
 * is the cause; a 1-row list IS the single-export case, D-03/D-04).
 *
 * Mirrors the harness pattern from `tests/renderer/optimize-dialog-output-card.spec.tsx`
 * (window.api stub + ComponentProps builder + @testing-library/react).
 *
 * Coverage (migrated to the multi-row API):
 * - The factor field (D-05/D-09, still id-via-testid) renders the controlled value.
 * - Clicking Export → onConfirmStart resolves { proceed:true, outDir } →
 *   window.api.exportVariantBatch fires ONCE with a 1-element scales array (the
 *   single-export case, D-04). Asserts arg[1] === [0.5] and arg[2] is the picked
 *   parent dir.
 * - A failed BatchVariantResult surfaces its reason in the complete state.
 * - A rejected exportVariantBatch promise transitions to the complete state.
 * - s >= 1 / s <= 0 (a 1-row invalid list) disables Export + shows the hint.
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

let exportVariantBatchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  exportVariantBatchMock = vi.fn(async () => ({
    ok: true,
    results: [{ token: '0.5', status: 'exported', successes: 3 }],
  }));
  vi.stubGlobal('api', {
    exportVariantBatch: exportVariantBatchMock,
    cancelVariantBatch: vi.fn(),
    onVariantBatchProgress: vi.fn(() => () => {}),
    onExportProgress: vi.fn(() => () => {}),
    onVariantResult: vi.fn(() => () => {}),
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
    bbox: { w: 1000, h: 800 },
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
    rows: [{ id: 'r1', scale: 0.5 }],
    onRowsChange: vi.fn(),
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

describe('VariantDialog — Phase 49 EXPORT-01 (migrated to rows[])', () => {
  it('renders the numeric scale (factor) field showing the controlled value', () => {
    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 0.5 }] })} />,
    );
    const input = screen.getByTestId('variant-factor-0') as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.type).toBe('number');
    expect(input.value).toBe('0.5');
  });

  it('invokes window.api.exportVariantBatch once with (summary, [0.5], "/tmp/parent", ...) on Export', async () => {
    const props = buildProps({ rows: [{ id: 'r1', scale: 0.5 }] });
    render(<VariantDialog {...props} />);

    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      fireEvent.click(exportBtn);
    });

    await waitFor(() => {
      expect(exportVariantBatchMock).toHaveBeenCalledTimes(1);
    });

    const callArgs = exportVariantBatchMock.mock.calls[0];
    // Arg order: (summary, scales[], parentDir, overwrite, sharpen, mode,
    //             atlasOpts, effectiveOverrides[], safetyBufferPercent).
    expect(callArgs[0]).toBe(props.summary); // summary
    expect(callArgs[1]).toEqual([0.5]); // 1-element scales array (single export)
    expect(callArgs[2]).toBe('/tmp/parent'); // picked parent dir
    expect(callArgs[3]).toBe(false); // overwrite
    expect(callArgs[5]).toBe('loose'); // outputMode
    expect(callArgs[7]).toEqual([['CIRCLE', 150]]); // overrides entries
    expect(callArgs[8]).toBe(0); // safetyBufferPercent
  });

  it('surfaces a failed BatchVariantResult reason in the complete state', async () => {
    exportVariantBatchMock.mockResolvedValueOnce({
      ok: true,
      results: [
        {
          token: '0.5',
          status: 'failed',
          reason: 'Refusing to overwrite existing file: …/CIRCLE.png',
        },
      ],
    });

    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 0.5 }] })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export Variant/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/0 of 1 exported/i)).toBeTruthy();
    });
    expect(
      screen.getByText(/Refusing to overwrite existing file/i),
    ).toBeTruthy();
  });

  it('WR-02: a rejected exportVariantBatch promise transitions to the complete error state (no wedged in-progress)', async () => {
    exportVariantBatchMock.mockRejectedValueOnce(
      new Error('unexpected main-side throw'),
    );

    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 0.5 }] })} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export Variant/i }));
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Close$/i })).toBeTruthy();
    });
    expect(
      screen.getAllByText(/unexpected main-side throw/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Exporting…/i)).toBeNull();
  });

  it('disables Export and shows the inline hint when scale >= 1 (s = 1.0)', () => {
    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 1.0 }] })} />,
    );
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/enter a value between 0 and 1/i)).toBeTruthy();
  });

  it('disables Export when scale >= 1 (s = 2.0)', () => {
    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 2.0 }] })} />,
    );
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables Export when scale <= 0 (s = 0)', () => {
    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 0 }] })} />,
    );
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
