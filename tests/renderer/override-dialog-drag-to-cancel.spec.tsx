// @vitest-environment jsdom
/**
 * Phase 38 IN-02 — drag-to-cancel guard for OverrideDialog overlay.
 *
 * Falsifying spec: today (pre-IN-02), the overlay uses `onClick={props.onCancel}`.
 * `onClick` fires on any mouseup landing on the overlay — including a drag that
 * started inside the panel (user drag-selecting their typed percentage to retype
 * it) and released on the overlay. The inner panel's `onClick={(e) => e.stopPropagation()}`
 * only catches events ORIGINATING inside the panel; a drag-out has the overlay as
 * the event target so stopPropagation never fires. Net: user's typed value is
 * silently discarded.
 *
 * After the IN-02 fix, the overlay uses `onMouseDown` + an `e.target === e.currentTarget`
 * guard. `onMouseDown` fires BEFORE any drag can complete, and the target-equality
 * check ensures the press originated directly on the overlay (not on a child).
 *
 * Cross-references:
 *   - .planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md (IN-02 section)
 *   - .planning/milestones/v1.0-phases/04-scale-overrides/04-REVIEW.md:144-161
 *     (original IN-02 finding + fix recommendation, verbatim source)
 *
 * Phase 27 precedent: test commits land BEFORE the fix commit so the RED state is
 * captured in git history (e.g. 6a4efe9 test(27-02) → fb3fedc fix(27-02)).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import {
  OverrideDialog,
  type OverrideDialogProps,
} from '../../src/renderer/src/modals/OverrideDialog';

afterEach(cleanup);

function renderDialog(overrides: Partial<OverrideDialogProps> = {}) {
  const onApply = vi.fn();
  const onClear = vi.fn();
  const onCancel = vi.fn();
  const utils = render(
    <OverrideDialog
      scope={['SQUARE']}
      currentPercent={50}
      anyOverridden={false}
      onApply={onApply}
      onClear={onClear}
      onCancel={onCancel}
      {...overrides}
    />,
  );
  return { ...utils, onApply, onClear, onCancel };
}

describe('OverrideDialog — drag-to-cancel guard (IN-02)', () => {
  it('mousedown directly on the overlay cancels', () => {
    // GREEN expectation: a direct mousedown on the overlay (no panel ancestry)
    // satisfies e.target === e.currentTarget and triggers onCancel.
    // Pre-fix (RED): production overlay uses onClick, not onMouseDown — so
    // fireEvent.mouseDown(overlay) reaches no handler and onCancel is never
    // called. This is the load-bearing RED assertion in this commit.
    const { onCancel } = renderDialog();
    const overlay = screen.getByRole('dialog');
    fireEvent.mouseDown(overlay, { target: overlay });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('mousedown originating inside the panel does NOT cancel', () => {
    // GREEN expectation: pressing on the input (a descendant of the inner
    // panel) sets e.target === input ≠ e.currentTarget (overlay) → the
    // target-equality guard rejects the cancel call.
    // Pre-fix (RED) note: with today's onClick handler, fireEvent.mouseDown
    // on the input does NOT reach the overlay handler at all (wrong event
    // type), so this case incidentally passes pre-fix too. The post-fix
    // behaviour is what we lock here: even when the new onMouseDown listener
    // is wired, the guard correctly suppresses the cancel.
    const { onCancel } = renderDialog();
    const input = screen.getByRole('spinbutton');
    fireEvent.mouseDown(input);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
