/**
 * Phase 9 Plan 06 — Settings modal (Claude's Discretion area; D-188 menu
 * placement = Edit→Preferences with accelerator CommandOrControl+,, wired
 * by Plan 09-05).
 *
 * Single setting exposed: `samplingHz` (per-project; persists in `.stmproj`
 * v1 via the existing Phase 8 D-146 schema; no schema change). UX per
 * 09-CONTEXT.md Claude's Discretion: dropdown of presets 60 / 120 (default) /
 * 240, plus a "Custom…" option that reveals a number input. Validation:
 *   - non-positive integers rejected (the Apply button shows an inline
 *     `role="alert"` error and does not dispatch onApply).
 *   - non-integers are silently rounded via `Math.round` (e.g. 180.7 → 181).
 *   - values >1000 are clamped to 1000 (typo-safety per 09-CONTEXT.md
 *     Claude's Discretion: prevents a stray keystroke from suggesting a
 *     1,000,000 Hz sampling rate).
 *
 * 08.2 D-184 — `role="dialog"` + `aria-modal="true"` are auto-picked up by
 * the AppShell `modalOpen` derivation; while open the File menu items are
 * disabled at the OS level. No extra notify-state wiring needed here.
 *
 * Layer 3 invariant: this file imports only from React + the shared
 * useFocusTrap hook. It NEVER reaches into src/core/* — the
 * tests/arch.spec.ts grep gate auto-scans this file on every run.
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a
 * string literal. No template interpolation, no concatenation; conditional
 * rendering via early-return null when !props.open and a `preset === 'custom'`
 * branch for the input row.
 */
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface SettingsDialogProps {
  open: boolean;
  /**
   * The current samplingHz value at the moment the dialog opens. Drives the
   * initial preset selection (matches a 60/120/240 preset → that preset is
   * selected; otherwise the dialog opens in Custom mode with the input
   * pre-filled).
   */
  currentSamplingHz: number;
  /**
   * Dispatched when the user clicks Apply with a valid value. Receives the
   * (clamped, integer) hz value. The host component is responsible for
   * closing the dialog and triggering the re-sample.
   */
  onApply: (hz: number) => void;
  /**
   * Dispatched when the user clicks Cancel, presses Escape, or clicks the
   * outer overlay (mirrors OverrideDialog UX).
   */
  onCancel: () => void;
}

const PRESETS = [60, 120, 240] as const;
type PresetValue = (typeof PRESETS)[number];
type Preset = PresetValue | 'custom';

const PRESETS_AS_NUMBERS: ReadonlyArray<number> = PRESETS;

function isPreset(n: number): n is PresetValue {
  return PRESETS_AS_NUMBERS.includes(n);
}

function validateCustom(
  raw: string,
): { ok: true; hz: number } | { ok: false; error: string } {
  const n = Number(raw);
  if (!Number.isFinite(n)) return { ok: false, error: 'Must be a number' };
  if (n <= 0) return { ok: false, error: 'Must be a positive integer' };
  // Round non-integers (e.g. 180.7 → 181) before clamp so 999.9 → 1000 not 999.
  const integer = Math.round(n);
  // Typo-safety per 09-CONTEXT.md Claude's Discretion: clamp at 1000 Hz.
  // Above this is almost certainly a stray keystroke (1500 → 15000 → 150000)
  // that would lock the renderer waiting on a multi-minute sample.
  const clamped = Math.min(integer, 1000);
  return { ok: true, hz: clamped };
}

export function SettingsDialog(props: SettingsDialogProps) {
  // Initial preset selection: if currentSamplingHz matches a preset, select
  // it; otherwise mount in Custom mode with the input prefilled to the
  // current value. The branch needs to re-evaluate every time `open` flips
  // true (the user may have changed samplingHz in a previous open) — the
  // sync useEffect below handles that.
  const initialPreset: Preset = isPreset(props.currentSamplingHz)
    ? props.currentSamplingHz
    : 'custom';
  const [preset, setPreset] = useState<Preset>(initialPreset);
  const [customValue, setCustomValue] = useState<string>(String(props.currentSamplingHz));
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Document-level Escape + Tab cycle via the shared hook (mirrors
  // OverrideDialog Gap-Fix Round 6 behavior). onEscape fires onCancel
  // regardless of where focus has drifted in the document.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });

  // Reset internal state when the dialog re-opens with a different value.
  // Without this, opening → cancelling → re-opening with a new prop value
  // would still display the stale state from the prior open.
  useEffect(() => {
    if (props.open) {
      const next: Preset = isPreset(props.currentSamplingHz)
        ? props.currentSamplingHz
        : 'custom';
      setPreset(next);
      setCustomValue(String(props.currentSamplingHz));
      setError(null);
    }
  }, [props.open, props.currentSamplingHz]);

  if (!props.open) return null;

  const apply = () => {
    if (preset === 'custom') {
      const result = validateCustom(customValue);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      props.onApply(result.hz);
      return;
    }
    // Preset path — preset is one of 60/120/240; dispatch directly.
    props.onApply(preset);
  };

  const onSelectChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const v = e.target.value;
    if (v === 'custom') {
      setPreset('custom');
      setError(null);
      // Auto-focus the number input after the custom row mounts. setTimeout
      // 0 defers until React has painted the input — without it the ref is
      // still null because the input has not been rendered yet.
      setTimeout(() => customInputRef.current?.focus(), 0);
      return;
    }
    const n = Number(v);
    if (isPreset(n)) {
      setPreset(n);
      setError(null);
    }
  };

  const onCustomChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCustomValue(e.target.value);
    // Clear any prior error so the inline-alert disappears as the user
    // corrects their input. The next Apply re-validates from scratch.
    if (error !== null) setError(null);
  };

  // Enter triggers Apply (per-context shortcut, same idiom as OverrideDialog).
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') apply();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="settings-title" className="text-sm text-fg mb-4">
          Preferences
        </h2>

        <label className="text-xs text-fg-muted block mb-2" htmlFor="settings-sampling-rate">
          Sampling rate
        </label>
        <select
          id="settings-sampling-rate"
          value={String(preset)}
          onChange={onSelectChange}
          className="w-full bg-panel border border-border rounded-md px-2 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <option value="60">60 Hz</option>
          <option value="120">120 Hz (default)</option>
          <option value="240">240 Hz</option>
          <option value="custom">Custom…</option>
        </select>

        {preset === 'custom' && (
          <div className="mt-3">
            <label className="text-xs text-fg-muted block mb-1" htmlFor="settings-custom-hz">
              Custom sampling rate (Hz)
            </label>
            <input
              ref={customInputRef}
              id="settings-custom-hz"
              type="number"
              min={1}
              max={1000}
              step={1}
              value={customValue}
              onChange={onCustomChange}
              aria-label="Custom sampling rate (Hz)"
              className="w-full bg-panel border border-border rounded-md px-2 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent"
            />
            {error !== null && (
              <div role="alert" className="text-xs text-danger mt-1">
                {error}
              </div>
            )}
          </div>
        )}

        <p className="text-fg-muted text-xs mt-4">
          Higher rates catch sub-frame peaks at the cost of sampling time.
          Default 120 Hz is recommended.
        </p>

        <div className="flex gap-2 mt-6 justify-end">
          <button
            type="button"
            onClick={props.onCancel}
            className="border border-border rounded-md px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
