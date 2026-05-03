// @vitest-environment jsdom
/**
 * Phase 22.1 Plan 22.1-05 — G-05 + G-06 D-08 + G-07 D-07 passthrough row
 * rendering tests for OptimizeDialog.
 *
 * Asserts:
 *   G-05 — passthrough rows do NOT contain "(already optimized)" parenthetical.
 *   G-06 D-08 — passthrough rows render source→target dim shape even when
 *     source = target (no-override passthrough, e.g. "670×670 → 670×670").
 *   G-07 D-07 — passthrough rows with `isCapped: true` render a muted
 *     "(capped)" suffix; rows without isCapped do NOT.
 *   CHECKER FIX 2026-05-02 — undefined actualSourceW falls back to sourceW.
 *   Phase 6 D-109 — muted-row UX preserved (opacity-60 + text-fg-muted).
 *   COPY chip — preserved on every passthrough row.
 *   Resize-row dim shape regression (G-06) — normal plan.rows still render
 *     their own source→target shape unchanged.
 *
 * Per project test convention (tests/renderer/missing-attachments-panel.spec.tsx:13-14):
 * use `not.toBeNull()` / `toBeDefined()` rather than @testing-library/jest-dom
 * matchers — no jest-dom imports anywhere in tests/renderer.
 *
 * window.api stub: OptimizeDialog mounts with state: 'pre-flight' (no
 * onExportProgress subscription on first render), so a minimal stub suffices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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

describe('OptimizeDialog — G-05 + G-06 D-08 + G-07 D-07 passthrough rows (Phase 22.1)', () => {
  it('G-05: passthrough row label does NOT contain "(already optimized)"', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/SQUARE.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          actualSourceW: 670,
          actualSourceH: 670,
        }),
      ],
    });
    const { container } = render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // "(already optimized)" must not appear anywhere in the rendered output.
    expect(container.textContent).not.toContain('(already optimized)');
  });

  it('G-06 D-08: passthrough row renders source→target dim shape even when source = target', () => {
    // No-override passthrough case: sourceW=670, outW=670 → renders "670×670 → 670×670".
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/SQUARE.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          actualSourceW: 670,
          actualSourceH: 670,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // Source and target dims are identical (no-override passthrough) but the arrow shape must be present.
    expect(screen.getByText(/670×670 → 670×670/)).not.toBeNull();
  });

  it('G-06 D-08 (override path): row with 50% override renders in plan.rows with resize dim shape', () => {
    // When a 50% override is applied, plan 22.1-03 re-routes the row from
    // passthroughCopies to plan.rows. The dialog must render the resize shape.
    const plan = makePlan({
      rows: [
        makeRow({
          outPath: 'images/SQUARE.png',
          sourceW: 670,
          sourceH: 670,
          outW: 335, // 50% of 670
          outH: 335,
          effectiveScale: 0.5,
          actualSourceW: 670,
          actualSourceH: 670,
        }),
      ],
      passthroughCopies: [],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // Resize row shape: source→target (670×670 → 335×335).
    expect(screen.getByText(/670×670 → 335×335/)).not.toBeNull();
    // No COPY chip because it's a resize row, not a passthrough.
    expect(screen.queryByText('COPY')).toBeNull();
  });

  it('G-07 D-07: passthrough row with isCapped=true renders the (capped) suffix', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/DRIFTED.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          actualSourceW: 670,
          actualSourceH: 670,
          isCapped: true,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // The "(capped)" muted suffix must be present.
    expect(screen.getByText('(capped)')).not.toBeNull();
  });

  it('G-07 D-07: passthrough row with isCapped=false does NOT render (capped)', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/NODRIFT.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          actualSourceW: 670,
          actualSourceH: 670,
          isCapped: false,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // "(capped)" must NOT appear for an uncapped row.
    expect(screen.queryByText('(capped)')).toBeNull();
  });

  it('CHECKER FIX preserved: undefined actualSourceW falls back to sourceW', () => {
    // Defensive case: passthrough row without actualSource fields populated.
    // The `??` fallback must use sourceW/H so the label is still sensible.
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/EDGE.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          // actualSourceW and actualSourceH intentionally omitted (undefined).
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // Falls back to canonical sourceW/H: "670×670 → 670×670".
    expect(screen.getByText(/670×670 → 670×670/)).not.toBeNull();
  });

  it('Phase 6 D-109 muted style preserved: opacity-60 + text-fg-muted', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/MUTED.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          actualSourceW: 670,
          actualSourceH: 670,
        }),
      ],
    });
    const { container } = render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // The passthrough row <li> must carry opacity-60 muted treatment (Phase 6 D-109).
    const liWithOpacity = container.querySelector('li.opacity-60');
    expect(liWithOpacity).not.toBeNull();
    // At least one element within the row must carry text-fg-muted.
    const mutedEl = container.querySelector('.text-fg-muted');
    expect(mutedEl).not.toBeNull();
  });

  it('COPY chip preserved on passthrough rows', () => {
    const plan = makePlan({
      passthroughCopies: [
        makeRow({
          outPath: 'images/COPY_TEST.png',
          sourceW: 670,
          sourceH: 670,
          outW: 670,
          outH: 670,
          effectiveScale: 1.0,
          actualSourceW: 670,
          actualSourceH: 670,
        }),
      ],
    });
    render(<OptimizeDialog {...REQUIRED_PROPS} plan={plan} />);
    // The COPY chip must be present.
    const chip = screen.getByText('COPY');
    expect(chip).not.toBeNull();
    // The chip's className must include the bordered/rounded chip styling.
    expect(chip.className).toMatch(/border/);
    expect(chip.className).toMatch(/uppercase/);
  });
});
