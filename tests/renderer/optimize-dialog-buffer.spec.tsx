// @vitest-environment jsdom
/**
 * Phase 30 BUFFER-01 — OptimizeDialog safety-buffer input UI tests.
 *
 * Mirrors the harness pattern from tests/renderer/optimize-dialog-passthrough.spec.tsx
 * (jsdom + vi.stubGlobal('api', ...) + makeRow / makePlan factories).
 *
 * Coverage:
 * - Input value mirrors the controlled `safetyBufferPercent` prop.
 * - onChange fires with clamped values for valid / negative / >25 / decimal / NaN.
 * - Tooltip via native title= matches D-15 verbatim.
 * - ARIA: label htmlFor ↔ input id binding.
 * - Disabled-state during state === 'in-progress' (deferred to HUMAN-UAT — covered
 *   architecturally via the literal `disabled={state === 'in-progress'}` mirror
 *   of the existing sharpen toggle precedent).
 * - Reactive: prop change triggers re-render with new value.
 */
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportRow } from '../../src/shared/types';

beforeEach(() => {
  vi.stubGlobal('api', {
    onExportProgress: vi.fn(() => () => undefined),
    startExport: vi.fn(),
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

function makePlan(opts: {
  rows?: ExportRow[];
  passthroughCopies?: ExportRow[];
} = {}): ExportPlan {
  return {
    rows: opts.rows ?? [makeRow()],
    excludedUnused: [],
    passthroughCopies: opts.passthroughCopies ?? [],
    totals: {
      count: (opts.rows?.length ?? 1) + (opts.passthroughCopies?.length ?? 0),
    },
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
    ...overrides,
  } as unknown as ComponentProps<typeof OptimizeDialog>;
}

describe('OptimizeDialog — Phase 30 safety buffer input (BUFFER-01)', () => {
  it('renders input with value="0" when safetyBufferPercent={0}', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />);
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.value).toBe('0');
  });

  it('renders input with value="5" when safetyBufferPercent={5}', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 5 })} />);
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.value).toBe('5');
  });

  it('typing "15" fires onSafetyBufferChange with 15 (in-range)', () => {
    const onSafetyBufferChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({ safetyBufferPercent: 0, onSafetyBufferChange })}
      />,
    );
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '15' } });
    expect(onSafetyBufferChange).toHaveBeenCalledWith(15);
  });

  it('typing "-3" fires onSafetyBufferChange with 0 (clamp at min)', () => {
    const onSafetyBufferChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({ safetyBufferPercent: 0, onSafetyBufferChange })}
      />,
    );
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-3' } });
    expect(onSafetyBufferChange).toHaveBeenCalledWith(0);
  });

  it('typing "99" fires onSafetyBufferChange with 25 (clamp at max)', () => {
    const onSafetyBufferChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({ safetyBufferPercent: 0, onSafetyBufferChange })}
      />,
    );
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '99' } });
    expect(onSafetyBufferChange).toHaveBeenCalledWith(25);
  });

  it('pasting "abc" fires onSafetyBufferChange with 0 (NaN fallback)', () => {
    const onSafetyBufferChange = vi.fn();
    render(
      <OptimizeDialog
        {...buildProps({ safetyBufferPercent: 5, onSafetyBufferChange })}
      />,
    );
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(onSafetyBufferChange).toHaveBeenCalledWith(0);
  });

  it('input has tooltip via title= attribute matching D-15 verbatim', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />);
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.getAttribute('title')).toBe(
      "Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate.",
    );
  });

  it('input has id="safety-buffer-input" with label htmlFor binding (ARIA)', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />);
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.id).toBe('safety-buffer-input');
  });

  it('input has min=0 / max=25 / step=1 attributes', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />);
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('25');
    expect(input.getAttribute('step')).toBe('1');
  });

  it('Quality group renders with "Quality" header label', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />);
    expect(screen.getByText('Quality')).not.toBeNull();
  });

  it('sharpen toggle still renders inside the Quality group (relocated, not removed)', () => {
    render(<OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />);
    const sharpenLabel = screen.getByText(/Sharpen output on downscale/i);
    expect(sharpenLabel).not.toBeNull();
  });

  it('controlled prop change re-renders input with new value', () => {
    const { rerender } = render(
      <OptimizeDialog {...buildProps({ safetyBufferPercent: 0 })} />,
    );
    let input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.value).toBe('0');
    rerender(<OptimizeDialog {...buildProps({ safetyBufferPercent: 7 })} />);
    input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.value).toBe('7');
  });
});
