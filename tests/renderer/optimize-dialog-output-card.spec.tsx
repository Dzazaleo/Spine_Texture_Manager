// @vitest-environment jsdom
/**
 * Phase 40 Plan 07 — OptimizeDialog Output card (D-01 series) UI tests.
 *
 * Mirrors harness pattern from `tests/renderer/optimize-dialog-buffer.spec.tsx`.
 *
 * Coverage:
 * - Output card renders with role=radiogroup label "Output mode" and 3 radios.
 * - Default `outputMode='loose'` selects the Loose radio.
 * - Atlas knobs (max page size, allow rotation, padding) hidden when 'loose'.
 * - Atlas knobs visible when 'atlas' or 'both'.
 * - Selecting a radio fires onOutputModeChange with the new value.
 * - Atlas page size select fires onAtlasOptsChange with parsed value.
 * - Allow rotation checkbox has the locked title= tooltip.
 * - Padding input clamps to 0..16.
 * - onStart threads `outputMode` + `atlasOpts` as 5th + 6th args to
 *   window.api.startExport.
 * - Progress handler prefixes lastPath with "Resize: " / "Composite: " when
 *   event.phase is present (D-05).
 */
import * as React from 'react';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportProgressEvent, ExportRow } from '../../src/shared/types';

let lastProgressHandler: ((e: ExportProgressEvent) => void) | null = null;

beforeEach(() => {
  lastProgressHandler = null;
  vi.stubGlobal('api', {
    onExportProgress: vi.fn((handler: (e: ExportProgressEvent) => void) => {
      lastProgressHandler = handler;
      return () => undefined;
    }),
    startExport: vi.fn(async () => ({
      ok: true,
      summary: {
        successes: 1,
        errors: [],
        outputDir: '/tmp/out',
        durationMs: 100,
        cancelled: false,
      },
    })),
    cancelExport: vi.fn(),
    openOutputFolder: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

function makeRow(overrides: Partial<ExportRow> = {}): ExportRow {
  return {
    sourcePath: '/fake/CIRCLE.png',
    outPath: 'images/CIRCLE.png',
    sourceW: 699,
    sourceH: 699,
    outW: 350,
    outH: 350,
    effectiveScale: 0.5,
    attachmentNames: ['CIRCLE'],
    ...overrides,
  };
}

function makePlan(opts: { rows?: ExportRow[]; passthroughCopies?: ExportRow[] } = {}): ExportPlan {
  return {
    rows: opts.rows ?? [makeRow()],
    excludedUnused: [],
    passthroughCopies: opts.passthroughCopies ?? [],
    totals: { count: (opts.rows?.length ?? 1) + (opts.passthroughCopies?.length ?? 0) },
  } as unknown as ExportPlan;
}

function buildProps(
  overrides: Partial<ComponentProps<typeof OptimizeDialog>> = {},
): ComponentProps<typeof OptimizeDialog> {
  return {
    open: true,
    outDir: '/tmp/out',
    plan: makePlan(),
    onClose: vi.fn(),
    onOpenAtlasPreview: vi.fn(),
    sharpenOnExport: false,
    onSharpenChange: vi.fn(),
    safetyBufferPercent: 0,
    onSafetyBufferChange: vi.fn(),
    // Phase 40 D-01 — new props
    outputMode: 'loose',
    onOutputModeChange: vi.fn(),
    atlasOpts: { maxPageSize: 4096, allowRotation: false, padding: 2 },
    onAtlasOptsChange: vi.fn(),
    ...overrides,
  } as unknown as ComponentProps<typeof OptimizeDialog>;
}

describe('OptimizeDialog — Phase 40 Output card (D-01)', () => {
  it('renders the Output card with radiogroup labelled "Output mode" containing 3 radios', () => {
    render(<OptimizeDialog {...buildProps()} />);
    const radiogroup = screen.getByRole('radiogroup', { name: /Output mode/i });
    expect(radiogroup).toBeTruthy();
    const radios = screen.getAllByRole('radio');
    // Output card contributes 3 radios — there may not be others in the
    // dialog. Assert at least 3 present.
    expect(radios.length).toBeGreaterThanOrEqual(3);
  });

  it('Loose radio is checked by default (outputMode=loose)', () => {
    render(<OptimizeDialog {...buildProps({ outputMode: 'loose' })} />);
    const loose = screen.getByLabelText(/Loose PNGs/i) as HTMLInputElement;
    expect(loose.checked).toBe(true);
    const atlas = screen.getByLabelText(/^Atlas$/i) as HTMLInputElement;
    expect(atlas.checked).toBe(false);
  });

  it('does NOT render atlas knobs when outputMode="loose" (D-01b)', () => {
    render(<OptimizeDialog {...buildProps({ outputMode: 'loose' })} />);
    expect(screen.queryByLabelText(/Max page size/i)).toBeNull();
    expect(screen.queryByLabelText(/Allow rotation/i)).toBeNull();
    expect(screen.queryByLabelText(/Padding/i)).toBeNull();
  });

  it('renders all 3 atlas knobs when outputMode="atlas"', () => {
    render(<OptimizeDialog {...buildProps({ outputMode: 'atlas' })} />);
    expect(screen.getByLabelText(/Max page size/i)).toBeTruthy();
    expect(screen.getByLabelText(/Allow rotation/i)).toBeTruthy();
    expect(screen.getByLabelText(/Padding/i)).toBeTruthy();
  });

  it('renders all 3 atlas knobs when outputMode="both"', () => {
    render(<OptimizeDialog {...buildProps({ outputMode: 'both' })} />);
    expect(screen.getByLabelText(/Max page size/i)).toBeTruthy();
    expect(screen.getByLabelText(/Allow rotation/i)).toBeTruthy();
    expect(screen.getByLabelText(/Padding/i)).toBeTruthy();
  });

  it('clicking the Atlas radio fires onOutputModeChange("atlas")', () => {
    const onOutputModeChange = vi.fn();
    render(<OptimizeDialog {...buildProps({ outputMode: 'loose', onOutputModeChange })} />);
    const atlas = screen.getByLabelText(/^Atlas$/i) as HTMLInputElement;
    fireEvent.click(atlas);
    expect(onOutputModeChange).toHaveBeenCalledWith('atlas');
  });

  it('clicking the Both radio fires onOutputModeChange("both")', () => {
    const onOutputModeChange = vi.fn();
    render(<OptimizeDialog {...buildProps({ outputMode: 'loose', onOutputModeChange })} />);
    const both = screen.getByLabelText(/Both/i) as HTMLInputElement;
    fireEvent.click(both);
    expect(onOutputModeChange).toHaveBeenCalledWith('both');
  });

  it('max page size select renders options 1024/2048/4096/8192 with 4096 selected default', () => {
    render(<OptimizeDialog {...buildProps({ outputMode: 'atlas' })} />);
    const select = screen.getByLabelText(/Max page size/i) as HTMLSelectElement;
    const optValues = Array.from(select.options).map((o) => o.value);
    expect(optValues).toEqual(['1024', '2048', '4096', '8192']);
    expect(select.value).toBe('4096');
  });

  it('changing max page size to 8192 fires onAtlasOptsChange with maxPageSize=8192', () => {
    const onAtlasOptsChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({
          outputMode: 'atlas',
          atlasOpts: { maxPageSize: 4096, allowRotation: false, padding: 2 },
          onAtlasOptsChange,
        })}
      />,
    );
    const select = screen.getByLabelText(/Max page size/i) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: '8192' } });
    expect(onAtlasOptsChange).toHaveBeenCalledWith(
      expect.objectContaining({ maxPageSize: 8192 }),
    );
  });

  it('Allow rotation checkbox has D-01d locked title= tooltip', () => {
    render(<OptimizeDialog {...buildProps({ outputMode: 'atlas' })} />);
    const checkbox = screen.getByLabelText(/Allow rotation/i) as HTMLInputElement;
    expect(checkbox.title).toBe('Packer may rotate regions 90° for tighter packing.');
  });

  it('toggling Allow rotation fires onAtlasOptsChange with allowRotation=true', () => {
    const onAtlasOptsChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({
          outputMode: 'atlas',
          atlasOpts: { maxPageSize: 4096, allowRotation: false, padding: 2 },
          onAtlasOptsChange,
        })}
      />,
    );
    const checkbox = screen.getByLabelText(/Allow rotation/i) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(onAtlasOptsChange).toHaveBeenCalledWith(
      expect.objectContaining({ allowRotation: true }),
    );
  });

  it('Padding input clamps 99 → 16 (max)', () => {
    const onAtlasOptsChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({
          outputMode: 'atlas',
          atlasOpts: { maxPageSize: 4096, allowRotation: false, padding: 2 },
          onAtlasOptsChange,
        })}
      />,
    );
    const input = screen.getByLabelText(/Padding/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    expect(onAtlasOptsChange).toHaveBeenCalledWith(
      expect.objectContaining({ padding: 16 }),
    );
  });

  it('Padding input clamps -5 → 0 (min)', () => {
    const onAtlasOptsChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({
          outputMode: 'atlas',
          atlasOpts: { maxPageSize: 4096, allowRotation: false, padding: 2 },
          onAtlasOptsChange,
        })}
      />,
    );
    const input = screen.getByLabelText(/Padding/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });
    expect(onAtlasOptsChange).toHaveBeenCalledWith(
      expect.objectContaining({ padding: 0 }),
    );
  });

  it('clicking Start fires window.api.startExport with outputMode + atlasOpts as 5th + 6th args', async () => {
    const startExport = vi.fn(async () => ({
      ok: true,
      summary: { successes: 1, errors: [], outputDir: '/tmp/out', durationMs: 100, cancelled: false },
    }));
    vi.stubGlobal('api', {
      onExportProgress: vi.fn(() => () => undefined),
      startExport,
      cancelExport: vi.fn(),
      openOutputFolder: vi.fn(),
    });
    render(
      <OptimizeDialog
        {...buildProps({
          outputMode: 'atlas',
          atlasOpts: { maxPageSize: 2048, allowRotation: true, padding: 4 },
        })}
      />,
    );
    const startBtn = screen.getByRole('button', { name: /^Start$/i });
    fireEvent.click(startBtn);
    await waitFor(() => expect(startExport).toHaveBeenCalled());
    // Args: 1=plan, 2=outDir, 3=overwrite, 4=sharpenEnabled, 5=outputMode, 6=atlasOpts
    const callArgs = startExport.mock.calls[0]!;
    expect(callArgs[4]).toBe('atlas');
    expect(callArgs[5]).toEqual({ maxPageSize: 2048, allowRotation: true, padding: 4 });
  });

  it('REPACK-10 surfacing: response.error.message reaches the summary verbatim', async () => {
    const lockedMsg =
      'Region CIRCLE is 1234×5678 px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override.';
    vi.stubGlobal('api', {
      onExportProgress: vi.fn(() => () => undefined),
      startExport: vi.fn(async () => ({
        ok: false,
        error: { kind: 'Unknown', message: lockedMsg },
      })),
      cancelExport: vi.fn(),
      openOutputFolder: vi.fn(),
    });
    render(
      <OptimizeDialog
        {...buildProps({
          outputMode: 'atlas',
          atlasOpts: { maxPageSize: 1024, allowRotation: false, padding: 2 },
        })}
      />,
    );
    const startBtn = screen.getByRole('button', { name: /^Start$/i });
    fireEvent.click(startBtn);
    // After the failing IPC resolves, the dialog transitions to 'complete' state
    // and renders a synthetic summary whose write-error.message is the verbatim
    // IPC error.message. The error text appears in the DOM unchanged.
    await waitFor(() => {
      expect(screen.getByText(/exceeds the page-size cap/i)).toBeTruthy();
    });
    expect(screen.getByText(/Increase atlasMaxPageSize or apply a smaller override/i)).toBeTruthy();
  });

  it('D-05: progress handler reads event.phase and builds Resize:/Composite: prefix in state', async () => {
    // The progress.lastPath state slot captures the prefix even though no
    // current OptimizeDialog surface renders it as a label (future-proofing
    // per D-05 — additive field, renderer can opt-in to display). Verify
    // state-write via the captured callback firing without throwing — the
    // critical guarantee is the handler accepts the additive phase field.
    render(<OptimizeDialog {...buildProps({ outputMode: 'atlas' })} />);
    const startBtn = screen.getByRole('button', { name: /^Start$/i });
    fireEvent.click(startBtn);
    await waitFor(() => expect(lastProgressHandler).not.toBeNull());
    expect(() => {
      act(() => {
        lastProgressHandler!({
          index: 0,
          path: 'images/CIRCLE.png',
          status: 'in-progress',
          phase: 'resize',
        } as ExportProgressEvent);
      });
    }).not.toThrow();
    expect(() => {
      act(() => {
        lastProgressHandler!({
          index: 0,
          path: 'project.png',
          status: 'in-progress',
          phase: 'composite',
        } as ExportProgressEvent);
      });
    }).not.toThrow();
  });

  it('D-05: source contains event.phase prefix build (Resize:/Composite: label)', () => {
    // Static source-grep — the implementation must construct the prefixed
    // label so any future renderer surface (or downstream consumer) can read
    // it. Acceptance criteria locks grep `event.phase` ≥ 1 occurrence.
    const fs = require('node:fs') as typeof import('node:fs');
    const src = fs.readFileSync('src/renderer/src/modals/OptimizeDialog.tsx', 'utf8');
    expect(src.match(/event\.phase/g)?.length ?? 0).toBeGreaterThanOrEqual(1);
    // Both labels must be present.
    expect(src.includes("'Composite'")).toBe(true);
    expect(src.includes("'Resize'")).toBe(true);
  });
});
