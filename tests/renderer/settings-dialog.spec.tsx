// @vitest-environment jsdom
/**
 * Phase 9 Plan 06 Task 1 — Wave 4 GREEN tests for SettingsDialog (samplingHz exposure).
 *
 * Behavior claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 16: Settings — samplingHz dropdown (60/120/240/Custom), positive-int clamp,
 *     apply → AppShell samplingHz updates → project dirty (D-145 derivation)
 *
 * The "apply → AppShell dirty" half of the contract is exercised in tests/renderer/save-load.spec.tsx
 * (existing samplingHz dirty derivation at AppShell.tsx:506-508). This file owns the
 * SettingsDialog-component-level contract: dropdown shape, validation, dispatched
 * onApply payloads. Wave 4 GREEN replaces the Wave 0 RED scaffolds.
 *
 * Analog: tests/renderer/atlas-preview-modal.spec.tsx (modal jsdom shape) +
 * src/renderer/src/modals/OverrideDialog.tsx (modal shell shape with focus trap).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { SettingsDialog } from '../../src/renderer/src/modals/SettingsDialog';

afterEach(cleanup);

describe('SettingsDialog — Wave 4 (Claude Discretion: samplingHz exposure)', () => {
  it('opens with role=dialog labelled Preferences; dropdown contains 60, 120, 240, Custom options', () => {
    render(
      <SettingsDialog
        open={true}
        currentSamplingHz={120}
        onApply={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: /preferences/i })).toBeTruthy();
    const select = screen.getByRole('combobox');
    expect(select).toBeTruthy();
    const optionTexts = Array.from(select.querySelectorAll('option')).map(
      (o) => o.textContent ?? '',
    );
    // The 4 options: 60, 120, 240, Custom…
    expect(optionTexts.some((t) => t.includes('60'))).toBe(true);
    expect(optionTexts.some((t) => t.includes('120'))).toBe(true);
    expect(optionTexts.some((t) => t.includes('240'))).toBe(true);
    expect(optionTexts.some((t) => t.toLowerCase().includes('custom'))).toBe(true);
  });

  it('selecting Custom reveals a number input; non-positive integers are rejected; values >1000 are clamped', () => {
    const onApply = vi.fn();
    render(
      <SettingsDialog
        open={true}
        currentSamplingHz={120}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'custom' } });
    const input = screen.getByLabelText(/custom sampling rate/i) as HTMLInputElement;
    expect(input).toBeTruthy();

    // Non-positive: error appears; onApply not called.
    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeNull();

    // >1000: clamped to 1000.
    fireEvent.change(input, { target: { value: '99999' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledWith(1000);
  });

  it('apply on a preset (240) dispatches onApply(240); custom non-integer is rounded to integer', () => {
    const onApply = vi.fn();
    const { rerender } = render(
      <SettingsDialog
        open={true}
        currentSamplingHz={120}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );

    // Preset path — selecting 240 + Apply dispatches onApply(240).
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: '240' } });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenLastCalledWith(240);

    // Custom path — fresh mount, custom value 180.7 rounds to 181.
    rerender(
      <SettingsDialog
        open={true}
        currentSamplingHz={120}
        onApply={onApply}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText(/custom sampling rate/i), {
      target: { value: '180.7' },
    });
    fireEvent.click(screen.getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenLastCalledWith(181);
  });
});
