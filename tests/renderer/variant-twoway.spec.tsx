// @vitest-environment jsdom
/**
 * Phase 50 Plan 02 — V9-V12 jsdom component tests for the enriched two-way
 * scale↔dimension VariantDialog Scale card (SCALEUI-01).
 *
 * Harness copied from `tests/renderer/variant-dialog.spec.tsx:1-114` (the
 * `@vitest-environment jsdom` pragma, the `vi.stubGlobal('api', …)` beforeEach,
 * the afterEach cleanup, makePlan/makeSummary/buildProps). makeSummary is
 * EXTENDED with `bbox: { w: 2190, h: 1847 }`; a `makeSummaryNoBbox()` variant
 * with `bbox: null` drives V12.
 *
 * FIELD CONTRACT for Task 2 (the enriched Scale card MUST provide these labels
 * so these queries resolve):
 *   - Factor field:  <label> text "Factor:" associated with a number input.
 *   - Width field:   <label> text "Width:"  associated with a number input
 *                    (data-testid="variant-target-width").
 *   - Height field:  <label> text "Height:" associated with a number input
 *                    (data-testid="variant-target-height").
 *   - bbox reference line: contains "Setup-pose size:" — shows "W × H px" when
 *     bbox != null, "unavailable (no textured geometry)" when bbox == null.
 *
 * Coverage:
 *  - V9 two-way (D-02): factor/W/H are all views of the single s; editing W or
 *    the factor writes the canonical s via onScaleChange. Uniform (one s).
 *  - V10 no drift (D-02): a typed 512 stays 512 in the focused px field.
 *  - V11 over-range (D-04): a typed W giving s>=1 is allowed (onScaleChange
 *    fires); rendering with scale>=1 disables Export + shows the inline hint.
 *  - V12 no geometry (T-50-FIN): bbox==null disables the px fields, the bbox
 *    line degrades gracefully, the factor field stays usable.
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
    bbox: { w: 2190, h: 1847 },
  } as unknown as SkeletonSummary;
}

function makeSummaryNoBbox(): SkeletonSummary {
  return {
    skeletonPath: '/proj/SIMPLE_TEST.json',
    atlasPath: '/proj/SIMPLE_TEST.atlas',
    runtimeTag: '4.2',
    peaks: [{ peakScale: 1 }],
    regions: [{ peakScale: 1 }],
    bbox: null,
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

describe('VariantDialog — Phase 50 SCALEUI-01 two-way scale↔dimension control', () => {
  it('V9 two-way (D-02): factor/W/H are views of the single s; editing W or the factor writes s', () => {
    const onScaleChange = vi.fn();
    render(
      <VariantDialog
        {...buildProps({
          summary: makeSummary(), // bbox { w:2190, h:1847 }
          scale: 0.5,
          onScaleChange,
        })}
      />,
    );

    // (a) Both px fields are derived from s.
    const widthInput = screen.getByTestId(
      'variant-target-width',
    ) as HTMLInputElement;
    const heightInput = screen.getByTestId(
      'variant-target-height',
    ) as HTMLInputElement;
    expect(widthInput.value).toBe('1095'); // round(0.5 * 2190)
    expect(heightInput.value).toBe('924'); // round(0.5 * 1847)

    // (b) Editing the width field to 512 fires onScaleChange with EXACTLY 512/2190.
    fireEvent.change(widthInput, { target: { value: '512' } });
    expect(onScaleChange).toHaveBeenLastCalledWith(512 / 2190);

    // (c) Editing the factor field to 0.25 fires onScaleChange with 0.25.
    const factorInput = screen.getByLabelText(/Factor:/i) as HTMLInputElement;
    fireEvent.change(factorInput, { target: { value: '0.25' } });
    expect(onScaleChange).toHaveBeenLastCalledWith(0.25);

    // Uniform: there is exactly ONE scale write per edit (never two independent
    // axis scales). Each onChange called onScaleChange a single time.
    expect(onScaleChange).toHaveBeenCalledTimes(2);
  });

  it('V10 no drift (D-02): a typed 512 stays 512 in the focused width field (no re-round to 511/513)', () => {
    // The dialog is uncontrolled for the px fields' raw text while focused: the
    // edited axis must not re-derive from the rounded display and drift.
    render(
      <VariantDialog
        {...buildProps({ summary: makeSummary(), scale: 0.5 })}
      />,
    );
    const widthInput = screen.getByTestId(
      'variant-target-width',
    ) as HTMLInputElement;
    act(() => {
      widthInput.focus();
    });
    fireEvent.change(widthInput, { target: { value: '512' } });
    // While focused, the controlled value reflects the raw typed string — NOT
    // round(scaleFromPx(512,2190)*2190) which could land 511/513.
    expect(widthInput.value).toBe('512');
  });

  it('V11 over-range (D-04): a typed W giving s>=1 is allowed; scale>=1 disables Export + shows the hint', () => {
    // Drive 1 — the over-range edit is ALLOWED (onScaleChange fires).
    const onScaleChange = vi.fn();
    render(
      <VariantDialog
        {...buildProps({
          summary: makeSummary(),
          scale: 0.5,
          onScaleChange,
        })}
      />,
    );
    const widthInput = screen.getByTestId(
      'variant-target-width',
    ) as HTMLInputElement;
    fireEvent.change(widthInput, { target: { value: '3000' } }); // s ≈ 1.37
    expect(onScaleChange).toHaveBeenLastCalledWith(3000 / 2190);
    cleanup();

    // Drive 2 — rendering with the resulting s>=1 shows the >=1 factor, disables
    // Export, and surfaces the existing inline scaled-down hint (D-04).
    render(
      <VariantDialog {...buildProps({ summary: makeSummary(), scale: 1.37 })} />,
    );
    const exportBtn = screen.getByRole('button', { name: /Export Variant/i });
    expect((exportBtn as HTMLButtonElement).disabled).toBe(true);
    const factorInput = screen.getByLabelText(/Factor:/i) as HTMLInputElement;
    expect(factorInput.value).toBe('1.37'); // the >=1 factor is shown
    expect(
      screen.getByText(/enter a value between 0 and 1/i),
    ).toBeTruthy();
  });

  it('V12 no geometry (T-50-FIN): bbox==null disables px fields, degrades the bbox line, keeps the factor usable', () => {
    const onScaleChange = vi.fn();
    render(
      <VariantDialog
        {...buildProps({
          summary: makeSummaryNoBbox(), // bbox null
          scale: 0.5,
          onScaleChange,
        })}
      />,
    );

    // The bbox reference line degrades gracefully.
    expect(
      screen.getByText(/Setup-pose size:.*unavailable/i),
    ).toBeTruthy();

    // The two px fields are disabled.
    const widthInput = screen.getByTestId(
      'variant-target-width',
    ) as HTMLInputElement;
    const heightInput = screen.getByTestId(
      'variant-target-height',
    ) as HTMLInputElement;
    expect(widthInput.disabled).toBe(true);
    expect(heightInput.disabled).toBe(true);

    // The factor field is still fully usable.
    const factorInput = screen.getByLabelText(/Factor:/i) as HTMLInputElement;
    expect(factorInput.disabled).toBe(false);
    fireEvent.change(factorInput, { target: { value: '0.25' } });
    expect(onScaleChange).toHaveBeenLastCalledWith(0.25);
  });
});
