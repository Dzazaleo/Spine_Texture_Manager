// @vitest-environment jsdom
/**
 * Phase 22 Plan 22-05 Task 2 — DIMS-04 OptimizeDialog passthrough COPY chip +
 * actualSource-aware "already optimized" dim label tests.
 *
 * Asserts:
 *   - PreFlightBody renders muted "COPY" chip on plan.passthroughCopies rows
 *     with `opacity-60` muted treatment (Phase 6 D-109 precedent reused).
 *   - PreFlightBody does NOT render COPY chip on plan.rows entries.
 *   - Mixed plan: BOTH plan.rows + plan.passthroughCopies render.
 *   - PreFlightBody passthrough rows carry `text-fg-muted` color (the existing
 *     muted-row contract).
 *   - CHECKER FIX 2026-05-02 — passthrough row dim label uses actualSourceW/H
 *     (e.g. 811×962) NOT canonical sourceW/H (e.g. 1628×1908) when actualSource
 *     fields are populated.
 *   - CHECKER FIX 2026-05-02 — defensive `??` fallback uses sourceW/H when
 *     actualSourceW/H undefined (rare passthrough-without-actualSource case).
 *
 * Per project test convention (tests/renderer/missing-attachments-panel.spec.tsx:13-14):
 * use `not.toBeNull()` / `toBeDefined()` rather than @testing-library/jest-dom
 * matchers — no jest-dom imports anywhere in tests/renderer.
 *
 * window.api stub: OptimizeDialog mounts with `state: 'pre-flight'` (no
 * onExportProgress subscription on first render), so a minimal stub suffices —
 * onExportProgress is only invoked when the user clicks Start (state flips to
 * 'in-progress').
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { OptimizeDialog } from '../../src/renderer/src/modals/OptimizeDialog';
import type { ExportPlan, ExportRow } from '../../src/shared/types';

beforeEach(() => {
  // Minimal stub — pre-flight state doesn't fire onExportProgress, but useEffect
  // setup still touches the surface, so guard with no-op unsubs.
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

/** Build a synthetic ExportRow with sane defaults; allows partial overrides. */
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

/**
 * Build a synthetic ExportPlan. plan.totals.count = rows + passthroughCopies
 * per the Plan 22-03 partition contract.
 */
function makePlan(opts: {
  rows?: ExportRow[];
  passthroughCopies?: ExportRow[];
}): ExportPlan {
  return {
    rows: opts.rows ?? [],
    excludedUnused: [],
    passthroughCopies: opts.passthroughCopies ?? [],
    totals: {
      count: (opts.rows?.length ?? 0) + (opts.passthroughCopies?.length ?? 0),
    },
  };
}

/** Common required-prop surface for OptimizeDialog. */
const REQUIRED_PROPS = {
  open: true,
  outDir: '/tmp/out',
  onClose: vi.fn(),
  onOpenAtlasPreview: vi.fn(),
};

describe('OptimizeDialog — DIMS-04 passthrough COPY indicator (Phase 22)', () => {
  it('renders COPY chip for plan.passthroughCopies entries', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          sourcePath: '/fake/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 699,
          sourceH: 699,
          outW: 699,
          outH: 699,
          effectiveScale: 1.0,
          actualSourceW: 699,
          actualSourceH: 699,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    const copyChip = screen.getByText('COPY');
    expect(copyChip).not.toBeNull();
    // Parent <li> carries opacity-60 muted treatment (Phase 6 D-109 mirror).
    const li = copyChip.closest('li');
    expect(li?.className).toMatch(/opacity-60/);
  });

  it('does NOT render COPY chip for plan.rows entries', () => {
    const plan = makePlan({
      rows: [
        makeRow({
          sourcePath: '/fake/CIRCLE.png',
          outPath: 'images/CIRCLE.png',
          sourceW: 699,
          sourceH: 699,
          outW: 350,
          outH: 350,
          effectiveScale: 0.5,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    expect(screen.queryByText('COPY')).toBeNull();
  });

  it('renders BOTH normal rows AND COPY chip in mixed plan', () => {
    const plan = makePlan({
      rows: [
        makeRow({
          sourcePath: '/fake/RESIZED.png',
          outPath: 'images/RESIZED.png',
          sourceW: 699,
          sourceH: 699,
          outW: 350,
          outH: 350,
          effectiveScale: 0.5,
          attachmentNames: ['RESIZED'],
        }),
      ],
      passthroughCopies: [
        makeRow({
          sourcePath: '/fake/PASSTHROUGH.png',
          outPath: 'images/PASSTHROUGH.png',
          sourceW: 699,
          sourceH: 699,
          outW: 699,
          outH: 699,
          effectiveScale: 1.0,
          attachmentNames: ['PASSTHROUGH'],
          actualSourceW: 699,
          actualSourceH: 699,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    expect(screen.getByText('COPY')).not.toBeNull();
    // Both rows present (one with COPY chip, one without).
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(2);
  });

  it('PreFlightBody passthrough rows render with text-fg-muted color', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outW: 699,
          outH: 699,
          effectiveScale: 1.0,
          actualSourceW: 699,
          actualSourceH: 699,
        }),
      ],
    });
    const { container } = render(
      <OptimizeDialog {...REQUIRED_PROPS} plan={plan} />,
    );
    // Existing PreFlightBody muted-note treatment uses text-fg-muted; the
    // passthrough block reuses the same color contract. At least one element
    // (the spans inside the passthrough <li>) should carry it.
    const muted = container.querySelector('.text-fg-muted');
    expect(muted).not.toBeNull();
  });

  it('CHECKER FIX 2026-05-02 — passthrough row label shows actualSource dims (NOT canonical sourceW/H)', () => {
    // Drifted row: canonical 1628×1908, actual on-disk 811×962. Dialog must
    // render "811×962 (already optimized)" — NOT "1628×1908 (already optimized)".
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          sourcePath: '/fake/DRIFTED.png',
          outPath: 'images/DRIFTED.png',
          sourceW: 1628, // canonical
          sourceH: 1908,
          outW: 811, // capped to actualSource
          outH: 962,
          effectiveScale: 0.498,
          attachmentNames: ['DRIFTED'],
          actualSourceW: 811, // populated by Plan 22-03 Step 5
          actualSourceH: 962,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // Dim label uses actualSource (811×962), NOT canonical sourceW/H (1628×1908).
    expect(screen.getByText(/811×962/)).not.toBeNull();
    expect(screen.queryByText(/1628×1908/)).toBeNull();
  });

  it('CHECKER FIX 2026-05-02 — defensive fallback when actualSourceW undefined', () => {
    // Defensive case: passthrough row without actualSource (rare; e.g. edge case
    // where dimsMismatch is true but actualSource fields didn't propagate). The
    // `??` fallback uses sourceW/H so the dialog still renders something sensible.
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          sourcePath: '/fake/EDGE.png',
          outPath: 'images/EDGE.png',
          sourceW: 1000,
          sourceH: 1000,
          outW: 1000,
          outH: 1000,
          effectiveScale: 1.0,
          attachmentNames: ['EDGE'],
          // actualSourceW + actualSourceH intentionally omitted (undefined).
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // Falls back to canonical sourceW/H (1000×1000).
    expect(screen.getByText(/1000×1000/)).not.toBeNull();
  });
});
