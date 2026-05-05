// @vitest-environment jsdom
/**
 * Phase 27 QA-02 — empty-input Apply guard for OverrideDialog.
 *
 * Falsifying spec: today, clearing the input and clicking Apply (or pressing
 * Enter) calls onApply(NaN) → AppShell silently floors to 1% via clamp. After
 * the QA-02 fix, Apply is disabled on empty/whitespace and Enter is a no-op
 * in the same state.
 *
 * QA-04 history: across Tasks 1 + 2 of plan 27-02 the helper passed an
 * always-true `open` prop because production short-circuited via
 * `if (!props.open) return null`. Task 3 removed that dead prop AND the
 * helper passthrough in the same commit; the dialog's lifetime is now
 * governed entirely by AppShell's `dialogState !== null && (...)` mount
 * gate, and this spec mounts the dialog directly with no lifecycle prop.
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
