// @vitest-environment jsdom
/**
 * Bug-e UX patch — when the Spine rig demands resolution above source at
 * peak (peakScale > 1), the override-dialog percent reflects "% of peak
 * demand satisfied, capped at canonical." That number can read low (e.g.
 * 74.82%) for a row whose Peak column visually equals Source — confusing
 * to users who expect 100% for an at-canonical-limit row. The explainer
 * resolves that confusion in the dialog without changing the math.
 *
 * Conditional render: only present when peakScale > 1. The common case
 * (peakScale ≤ 1, where percent maps 1:1 to canonical export) keeps a
 * clean dialog.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import {
  OverrideDialog,
  type OverrideDialogProps,
} from '../../src/renderer/src/modals/OverrideDialog';

afterEach(cleanup);

function renderDialog(overrides: Partial<OverrideDialogProps> = {}) {
  return render(
    <OverrideDialog
      scope={['CROSS_GEM']}
      currentPercent={74.82}
      anyOverridden={false}
      onApply={vi.fn()}
      onClear={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />,
  );
}

describe('OverrideDialog — extrapolation explainer', () => {
  it('renders explainer when peakScale > 1', () => {
    renderDialog({ peakScale: 1.336 });
    expect(screen.getByText(/Spine rig renders/)).toBeTruthy();
    expect(screen.getByText(/1\.34× source/)).toBeTruthy();
    expect(screen.getByText(/capped at canonical/)).toBeTruthy();
  });

  it('omits explainer when peakScale === 1 exactly (no extrapolation)', () => {
    renderDialog({ peakScale: 1, currentPercent: 100 });
    expect(screen.queryByText(/Spine rig renders/)).toBeNull();
  });

  it('omits explainer when peakScale < 1 (rig under-uses source)', () => {
    renderDialog({ peakScale: 0.5, currentPercent: 100 });
    expect(screen.queryByText(/Spine rig renders/)).toBeNull();
  });

  it('omits explainer when peakScale prop is undefined (legacy callers)', () => {
    renderDialog({ peakScale: undefined });
    expect(screen.queryByText(/Spine rig renders/)).toBeNull();
  });
});
