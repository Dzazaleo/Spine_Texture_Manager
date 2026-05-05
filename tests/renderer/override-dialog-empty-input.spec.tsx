// @vitest-environment jsdom
/**
 * Phase 27 QA-02 — empty-input Apply guard for OverrideDialog.
 *
 * Falsifying spec: today, clearing the input and clicking Apply (or pressing
 * Enter) calls onApply(NaN) → AppShell silently floors to 1% via clamp. After
 * the QA-02 fix, Apply is disabled on empty/whitespace and Enter is a no-op
 * in the same state.
 *
 * Note on test scaffold: the helper passes `open={true}` for the duration of
 * Tasks 1 + 2. Task 3 (QA-04) removes the `open` prop from production and
 * STRIPS `open={true}` from this helper IN THE SAME COMMIT. This keeps each
 * task's RED/GREEN cleanly scoped:
 *   - Tasks 1/2 fail/pass in isolation; the dialog short-circuits to `null`
 *     without `open={true}` (line 82 of OverrideDialog.tsx pre-Task-3),
 *     which would mask QA-02 RED state under a "spinbutton not found" error.
 *   - Task 3 removes both the prop AND the helper's `open={true}` so the
 *     spec compiles against the new prop shape.
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
      open={true}
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

describe('OverrideDialog — empty input guard (QA-02)', () => {
  it('disables Apply when input is empty', () => {
    const { onApply } = renderDialog();
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    const applyBtn = screen.getByRole('button', { name: /^Apply$/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(applyBtn);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('disables Apply when input is whitespace-only', () => {
    const { onApply } = renderDialog();
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '   ' } });
    const applyBtn = screen.getByRole('button', { name: /^Apply$/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(true);
    fireEvent.click(applyBtn);
    expect(onApply).not.toHaveBeenCalled();
  });

  it('re-enables Apply after typing a valid number', () => {
    const { onApply } = renderDialog();
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.change(input, { target: { value: '75' } });
    const applyBtn = screen.getByRole('button', { name: /^Apply$/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith(75);
  });

  it('Apply with un-modified pre-fill still submits the original currentPercent', () => {
    const { onApply } = renderDialog({ currentPercent: 42 });
    const applyBtn = screen.getByRole('button', { name: /^Apply$/ }) as HTMLButtonElement;
    expect(applyBtn.disabled).toBe(false);
    fireEvent.click(applyBtn);
    expect(onApply).toHaveBeenCalledWith(42);
  });

  it('Enter on empty input does not submit', () => {
    const { onApply } = renderDialog();
    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    // Enter is handled on the inner panel div onKeyDown, not the input.
    // Fire on the input — the event bubbles to the panel div per the existing handler.
    fireEvent.keyDown(input, { key: 'Enter' });
    // Pre-fix (RED): keyDown reaches `apply()` which calls onApply(Number('')) === onApply(0).
    // Post-fix (GREEN): keyDown's `&& isValid` guard suppresses the apply() call entirely.
    // Both assertions together make the RED diagnostic explicit: "called with 0" identifies
    // the silent-floor bug; "not called" identifies the post-fix correct state.
    expect(onApply).not.toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalledWith(0);
  });
});
