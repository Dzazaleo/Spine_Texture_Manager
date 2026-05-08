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
import * as React from 'react';
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

describe('reactive plan rebuild — Phase 30 CR-01 closure (post-mount buffer change must reach startExport)', () => {
  // The CR-01 regression: AppShell's exportDialogState.plan was captured at
  // dialog open and never rebuilt when safetyBufferPercentLocal changed.
  // Setting buffer=5 in the input AFTER open and clicking Start exported
  // with buffer=0 (the snapshot value). The fix is a useEffect in AppShell
  // that rebuilds the plan when buffer/summary/overrides change while the
  // dialog is open.
  //
  // This describe block contains 3 tests:
  //   1. StatefulWrapper integration test — mounts a wrapper that mirrors
  //      AppShell's CORRECT behavior (the useEffect that rebuilds plan
  //      when buffer changes). Asserts the dialog re-renders.
  //   2. IPC payload assertion — asserts startExport receives the rebuilt
  //      plan. NO soft-fail fallback per Warning-5 fix.
  //   3. Static-grep regression sentinel — asserts the AppShell useEffect
  //      signature exists. PERMANENT regression sentinel that survives
  //      even if the wrapper-based tests are naive (Warning-4 fix).

  function StatefulWrapper(initialProps: {
    initialBuffer: number;
    summary: unknown;
    overrides: ReadonlyMap<string, number>;
    outDir: string;
    onConfirmStart?: ComponentProps<typeof OptimizeDialog>['onConfirmStart'];
  }) {
    const [buffer, setBuffer] = React.useState(initialProps.initialBuffer);
    // Mirror the CR-01 fix in AppShell: rebuild plan when buffer changes.
    const plan = React.useMemo(() => {
      // Synthesized plan factory; in real AppShell this is buildExportPlan.
      // For test purposes, compute outW = Math.floor(peakScale * (1 + buffer/100) * sourceW).
      const peakScale = 0.5;
      const sourceW = 1000;
      const sourceH = 1000;
      const bufferMultiplier = 1 + buffer / 100;
      const outW = Math.floor(peakScale * bufferMultiplier * sourceW);
      const outH = Math.floor(peakScale * bufferMultiplier * sourceH);
      return makePlan({
        rows: [makeRow({
          sourceW,
          sourceH,
          outW,
          outH,
          effectiveScale: peakScale * bufferMultiplier,
        })],
      });
    }, [buffer, initialProps.summary, initialProps.overrides]);
    const extra: Partial<ComponentProps<typeof OptimizeDialog>> = {
      plan,
      outDir: initialProps.outDir,
      safetyBufferPercent: buffer,
      onSafetyBufferChange: setBuffer,
    };
    if (initialProps.onConfirmStart !== undefined) {
      extra.onConfirmStart = initialProps.onConfirmStart;
    }
    return (
      <OptimizeDialog
        {...buildProps(extra)}
      />
    );
  }

  it('post-mount buffer change re-renders dialog with rebuilt plan (CR-01 closure)', () => {
    const summary = {} as unknown;
    const overrides = new Map<string, number>();
    render(
      <StatefulWrapper
        initialBuffer={0}
        summary={summary}
        overrides={overrides}
        outDir="/tmp/out"
      />,
    );
    // Initial buffer=0 → outW = floor(0.5 * 1.0 * 1000) = 500
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(input.value).toBe('0');
    // Type "5" → wrapper rebuilds plan → dialog re-renders with new outW = floor(0.5 * 1.05 * 1000) = 525
    fireEvent.change(input, { target: { value: '5' } });
    const inputAfter = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    expect(inputAfter.value).toBe('5');
    // Tile or pre-flight body should now reflect the new outW (525). The
    // exact text depends on OptimizeDialog's rendering; assert via tile
    // text containing "525" OR via getAllByText(/525/) length >= 1.
    expect(screen.queryAllByText(/525/).length).toBeGreaterThanOrEqual(1);
  });

  it('post-mount buffer change → startExport receives plan with rebuilt outW (CR-01 IPC closure)', async () => {
    // Warning-5 fix: this test reliably reaches the IPC path OR fails loudly
    // with `it.skip` + TODO. NO soft-fail fallback to a weaker assertion.
    const startExportMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('api', {
      onExportProgress: vi.fn(() => () => undefined),
      startExport: startExportMock,
      cancelExport: vi.fn(),
      openOutputFolder: vi.fn(),
    });
    const summary = {} as unknown;
    const overrides = new Map<string, number>();
    // onConfirmStart resolves immediately so the OptimizeDialog Start flow
    // reliably reaches startExport. We pass `proceed: true` + `overwrite: false`
    // so the dialog flips to in-progress and calls window.api.startExport.
    const onConfirmStartMock = vi.fn().mockResolvedValue({ proceed: true, overwrite: false });
    render(
      <StatefulWrapper
        initialBuffer={0}
        summary={summary}
        overrides={overrides}
        outDir="/tmp/out"
        onConfirmStart={onConfirmStartMock}
      />,
    );
    // Type "5" then click Start.
    const input = screen.getByLabelText(/Safety buffer:/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    const startBtn = await screen.findByRole('button', { name: /Start/i });
    fireEvent.click(startBtn);
    // Allow the async onConfirmStart promise + startExport call to settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));
    // FAIL LOUDLY if startExport was never called — no soft-fail fallback.
    expect(startExportMock.mock.calls.length).toBeGreaterThan(0);
    // Concrete IPC assertion: the plan argument passed to startExport
    // must have rows[0].outW === 525 (post-buffer), NOT 500 (pre-buffer).
    const planArg = startExportMock.mock.calls[0][0];
    expect(planArg.rows[0].outW).toBe(525);
  });

  it('CR-01 regression: AppShell rebuilds exportDialogState.plan when buffer changes (static grep)', () => {
    // Warning-4 fix: PERMANENT static-grep regression sentinel that locks
    // the EXACT useEffect signature literal in src/renderer/src/components/AppShell.tsx.
    // Survives even if the StatefulWrapper-based tests above are naive
    // (the wrapper does the rebuild internally; if a future maintainer
    // accidentally reverts the AppShell useEffect, those tests still pass
    // because the wrapper carries the contract). This test reads the
    // production source file and asserts the useEffect literal is present.
    // Mirrors the parity-regex pattern at tests/core/export.spec.ts:719-725.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    const appShell: string = fs.readFileSync('src/renderer/src/components/AppShell.tsx', 'utf-8');
    // The reactive-rebuild useEffect must exist with the boolean dep form to avoid set-loop.
    expect(appShell, 'AppShell.tsx must contain the reactive useEffect that rebuilds exportDialogState.plan')
      .toMatch(/useEffect\(\(\) => \{[\s\S]*?if \(exportDialogState === null\) return/);
    expect(appShell, 'AppShell.tsx must rebuild plan via buildExportPlan(summary, overrides, { safetyBufferPercent: safetyBufferPercentLocal })')
      .toMatch(/setExportDialogState\(\(prev\) =>[\s\S]*?buildExportPlan\([\s\S]*?safetyBufferPercent: safetyBufferPercentLocal/);
    // Boolean dep form — `exportDialogState !== null` not `exportDialogState`.
    // Using the full object would create a feedback loop.
    expect(appShell, 'AppShell.tsx useEffect deps must use boolean form `exportDialogState !== null` (not the full state object) to avoid feedback loop')
      .toMatch(/\[\s*safetyBufferPercentLocal,\s*summary,\s*overrides,\s*exportDialogState !== null\s*\]/);
  });
});
