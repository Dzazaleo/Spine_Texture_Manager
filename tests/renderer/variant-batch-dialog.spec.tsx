// @vitest-environment jsdom
/**
 * Phase 51 Plan 02 — EXPORT-04 multi-row batch VariantDialog renderer proof.
 *
 * Cites the decisions it embodies:
 *  - D-01/D-03: the scale set is a list of rows; opens with one row at 0.5;
 *    `+ Add scale` appends; per-row remove (disabled at one row).
 *  - D-08: the complete state renders a per-folder result list + an aggregate
 *    "X of N exported" line.
 *  - D-10: two rows whose scales normalize to the same @{s}x token highlight +
 *    disable Export with an inline duplicate-token hint.
 *  - D-11: Export stays disabled while any row is invalid (blank/non-finite/
 *    s<=0/s>=1).
 *  - D-12: one parent pick + one batch call with the scales array.
 *
 * `.spec.tsx` (NOT `.ts`) on purpose: a `.ts` file under tests/renderer/ that
 * imports renderer source hits the node tsconfig's tests/**\/*.ts glob and reds
 * typecheck:node (TS6307). The .spec.tsx convention keeps it vitest-only.
 *
 * Harness modeled on `tests/renderer/variant-dialog.spec.tsx` but stubs the
 * batch IPC surface (exportVariantBatch / cancelVariantBatch /
 * onVariantBatchProgress) and supplies the controlled `rows`/`onRowsChange`.
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
let cancelVariantBatchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  exportVariantBatchMock = vi.fn(async () => ({
    ok: true,
    results: [
      { token: '0.5', status: 'exported', successes: 3 },
      { token: '0.36', status: 'exported', successes: 3 },
    ],
  }));
  cancelVariantBatchMock = vi.fn();
  vi.stubGlobal('api', {
    exportVariantBatch: exportVariantBatchMock,
    cancelVariantBatch: cancelVariantBatchMock,
    onVariantBatchProgress: vi.fn(() => () => {}),
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
    // bbox present so the px target fields are enabled.
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

describe('VariantDialog — Phase 51 EXPORT-04 multi-row batch', () => {
  it('rows: opens with one row at 0.5 and disables remove at one row', () => {
    render(<VariantDialog {...buildProps()} />);
    const factor = screen.getByTestId('variant-factor-0') as HTMLInputElement;
    expect(factor.value).toBe('0.5');
    const remove = screen.getByTestId('variant-remove-0') as HTMLButtonElement;
    expect(remove.disabled).toBe(true);
  });

  it('rows: + Add scale calls onRowsChange with an appended row', () => {
    const onRowsChange = vi.fn();
    render(<VariantDialog {...buildProps({ onRowsChange })} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ Add scale/i }));
    expect(onRowsChange).toHaveBeenCalledTimes(1);
    const appended = onRowsChange.mock.calls[0][0] as Array<{ scale: number }>;
    expect(appended.length).toBe(2);
    expect(appended[1].scale).toBe(0.5);
  });

  it('rows: per-row remove calls onRowsChange filtering that row', () => {
    const onRowsChange = vi.fn();
    render(
      <VariantDialog
        {...buildProps({
          rows: [
            { id: 'r1', scale: 0.5 },
            { id: 'r2', scale: 0.36 },
          ],
          onRowsChange,
        })}
      />,
    );
    // Remove the SECOND row (index 1).
    fireEvent.click(screen.getByTestId('variant-remove-1'));
    expect(onRowsChange).toHaveBeenCalledTimes(1);
    expect(onRowsChange.mock.calls[0][0]).toEqual([{ id: 'r1', scale: 0.5 }]);
  });

  it('duplicate: two rows producing the same token disable Export + show the hint', () => {
    render(
      <VariantDialog
        {...buildProps({
          rows: [
            { id: 'r1', scale: 0.5 },
            { id: 'r2', scale: 0.50001 }, // tokenFor === '0.5' → collision
          ],
        })}
      />,
    );
    const exportBtn = screen.getByRole('button', {
      name: /Export Variants?/i,
    }) as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
    expect(screen.getByText(/produce @0\.5x/i)).toBeTruthy();
  });

  it('invalid: a row with scale >= 1 disables Export', () => {
    render(
      <VariantDialog {...buildProps({ rows: [{ id: 'r1', scale: 1.0 }] })} />,
    );
    const exportBtn = screen.getByRole('button', {
      name: /Export Variant/i,
    }) as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
    expect(screen.getByText(/enter a value between 0 and 1/i)).toBeTruthy();
  });

  it('single call: Export fires exportVariantBatch once with the scales array + picked dir (D-12 one pick)', async () => {
    const onConfirmStart = vi.fn(async () => ({
      proceed: true,
      overwrite: false,
      outDir: '/tmp/parent',
    }));
    render(
      <VariantDialog
        {...buildProps({
          rows: [
            { id: 'r1', scale: 0.5 },
            { id: 'r2', scale: 0.36 },
          ],
          onConfirmStart,
        })}
      />,
    );

    const exportBtn = screen.getByRole('button', { name: /Export Variants/i });
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
    expect(callArgs[1]).toEqual([0.5, 0.36]); // scales array
    expect(callArgs[2]).toBe('/tmp/parent'); // single picked parent dir
    // D-12: the parent picker fired exactly once for the whole run.
    expect(onConfirmStart).toHaveBeenCalledTimes(1);
  });

  it('result list: the complete state renders the per-folder list + aggregate', async () => {
    exportVariantBatchMock.mockResolvedValueOnce({
      ok: true,
      results: [
        { token: '0.5', status: 'exported', successes: 3 },
        { token: '0.36', status: 'failed', reason: 'boom' },
      ],
    });
    render(
      <VariantDialog
        {...buildProps({
          rows: [
            { id: 'r1', scale: 0.5 },
            { id: 'r2', scale: 0.36 },
          ],
        })}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Export Variants/i }));
    });

    await waitFor(() => {
      expect(screen.getByText(/1 of 2 exported/i)).toBeTruthy();
    });
    // The failed row's reason is surfaced.
    expect(screen.getByText(/boom/i)).toBeTruthy();
  });
});
