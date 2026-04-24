/**
 * Phase 4 Plan 02 — hand-rolled percentage-input modal (D-77..D-81).
 *
 * UX refinements beyond a bare form:
 *
 *   1. Hand-rolled over modal libraries per D-28. No external dialog/modal
 *      dependency; the project's established discipline is to assemble React
 *      primitives directly when the hand-rolled version stays under the
 *      60-line threshold called out in the phase-context Claude's-Discretion
 *      section. Measured focus + overlay + close logic clears well under
 *      that bar.
 *   2. Controlled input with internal useState so the user's typed value
 *      (for example the out-of-range 200) stays visible in the input until
 *      Apply fires; the AppShell's onApply handler performs the silent
 *      clamp per D-79. The dialog itself does no clamping — it forwards
 *      Number(inputValue) raw so the clamp math has a single owner.
 *   3. ESC closes (discards); Enter inside the dialog applies; overlay
 *      click closes (discards). Focus-trap provided by the browser's
 *      default tab-order cycling inside the modal container plus an
 *      auto-focus + auto-select on open — hand-rolled, well under the
 *      60-line threshold that would justify pulling in a focus-scope lib.
 *   4. Tailwind v4 literal-class discipline (Pitfall 8): every className
 *      is a string literal. No template interpolation, no concatenation;
 *      conditional rendering handled via early-return null when !props.open
 *      rather than class toggling so the scanner sees every literal once.
 *   5. Two-weight typography: font-normal (400, implicit default) for
 *      body, input, and helper text; font-semibold (600) reserved for the
 *      primary Apply button. Weight 500 is forbidden project-wide.
 *
 * Phase 4 Plan 03 gap-fix B (human-verify 2026-04-24): two reset buttons
 * replace the single "Reset to 100%". "Reset to peak" (clear override)
 * is visible only when anyOverridden; "Reset to source (100%)" (apply-100)
 * is always visible. The helper text "Max = 100% (source dimensions)" is
 * now literally true under the new applyOverride semantics. See
 * 04-03-SUMMARY.md §Deviations for the full rationale.
 *
 * Layer 3 invariant: this file imports only React + type-only React
 * keyboard-event typing. It never reaches into the pure-TS math tree —
 * the AppShell's onApply handler is the single place where the clamp
 * primitive runs. The tests/arch.spec.ts renderer-boundary grep
 * auto-scans this file on every test run.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';

export interface OverrideDialogProps {
  open: boolean;
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
  onApply: (percent: number) => void;
  onClear: () => void;
  onCancel: () => void;
}

export function OverrideDialog(props: OverrideDialogProps) {
  const [inputValue, setInputValue] = useState(String(props.currentPercent));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.open) {
      // D-81: auto-focus + auto-select the input on open so the user can
      // immediately retype without a manual click + select step.
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [props.open]);

  if (!props.open) return null;

  const title =
    props.scope.length === 1
      ? `Override scale — ${props.scope[0]}`
      : `Override scale — ${props.scope.length} selected rows`;

  const apply = () => props.onApply(Number(inputValue));

  // D-81: Enter triggers Apply; ESC triggers Cancel. Handler lives on the
  // inner panel div (not on the input) so Tab focus cycling stays intact —
  // stopPropagation inside the input's onKeyDown would break the focus trap.
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') props.onCancel();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="override-title" className="text-sm text-fg mb-4">
          {title}
        </h2>
        <label className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={100}
            step={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="bg-panel border border-border rounded-md px-2 py-1 w-24 text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="text-fg-muted text-sm">%</span>
        </label>
        <p className="text-fg-muted text-xs mt-2">Max = 100% (source dimensions)</p>
        <div className="flex gap-2 mt-6 justify-end">
          {/* Gap-fix B (human-verify 2026-04-24): two reset buttons replace the
              single Reset. "Reset to peak" clears the override (visible only
              when anyOverridden — nothing to clear otherwise). "Reset to
              source (100%)" applies 100 — always visible as a valid target
              action independent of current state. */}
          {props.anyOverridden && (
            <button
              type="button"
              onClick={props.onClear}
              className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg"
            >
              Reset to peak
            </button>
          )}
          <button
            type="button"
            onClick={() => props.onApply(100)}
            className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg"
          >
            Reset to source (100%)
          </button>
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
            autoFocus={!props.anyOverridden}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
