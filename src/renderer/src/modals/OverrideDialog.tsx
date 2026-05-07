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
 *      click closes (discards). Phase 6 Gap-Fix Round 6 (2026-04-25)
 *      hoisted the focus trap + Escape handling into the shared
 *      useFocusTrap hook so focus never escapes the dialog (Tab cycles)
 *      and Escape works regardless of where focus has drifted. Auto-
 *      select on open retained as a thin useEffect because the hook
 *      owns focus() but not select() — the input is the FIRST tabbable
 *      so the hook focuses it; the useEffect immediately selects the
 *      contents so the user can retype.
 *   4. Tailwind v4 literal-class discipline (Pitfall 8): every className
 *      is a string literal. No template interpolation, no concatenation;
 *      conditional rendering handled by AppShell's mount gate
 *      (`dialogState !== null && <OverrideDialog ... />`) rather than an
 *      internal `open` flag (QA-04, Phase 27 — dead-prop removal). The
 *      scanner sees every literal once because mount/unmount controls
 *      visibility, not class toggling. QA-02 (Phase 27) added a single
 *      ternary on the Apply button between two literal classNames for
 *      the disabled-state opacity-50/cursor-not-allowed branch.
 *   5. Two-weight typography: font-normal (400, implicit default) for
 *      body, input, and helper text; font-semibold (600) reserved for the
 *      primary Apply button. Weight 500 is forbidden project-wide.
 *
 * Peak-anchored override semantics (2026-05-05 redesign): the percent input
 * means "% of peak demand" — 100% = ship at peak (sharpest possible without
 * oversampling); 50% = ship at half of peak (trade quality for bytes). Under
 * peak-anchored math, applying 100% is functionally equivalent to clearing
 * the override (effScale === peakScale either way), so the prior "Reset to
 * source (100%)" button has been collapsed into the single "Reset to peak"
 * button (visible only when anyOverridden — nothing to clear otherwise).
 * Helper text reads "Max = 100% (peak demand)".
 *
 * Layer 3 invariant: this file imports only React + type-only React
 * keyboard-event typing. It never reaches into the pure-TS math tree —
 * the AppShell's onApply handler is the single place where the clamp
 * primitive runs. The tests/arch.spec.ts renderer-boundary grep
 * auto-scans this file on every test run.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface OverrideDialogProps {
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
  /**
   * Peak demand multiplier for the clicked row (or the max across the
   * batch scope). When > 1 the rig renders the asset above its source
   * resolution at the peak frame; the dialog surfaces a short explanation
   * so the displayed percent (% of peak demand satisfied, capped at
   * canonical) is interpretable. Optional for backward-compat; absent
   * means "no extrapolation, treat as ≤ 1."
   */
  peakScale?: number;
  onApply: (percent: number) => void;
  onClear: () => void;
  onCancel: () => void;
}

export function OverrideDialog(props: OverrideDialogProps) {
  const [inputValue, setInputValue] = useState(String(props.currentPercent));
  const inputRef = useRef<HTMLInputElement>(null);
  // Gap-Fix Round 6 (2026-04-25): the dialog root ref is consumed by
  // useFocusTrap to scope the Tab cycle + document-level Escape listener.
  const dialogRef = useRef<HTMLDivElement>(null);

  // Gap-Fix Round 6 (2026-04-25): document-level Escape + Tab cycle via
  // shared hook. ESC = onCancel works regardless of where focus has
  // drifted in the document. The hook also auto-focuses the first
  // tabbable on mount = the input, which is the desired D-81 behavior.
  // QA-04 (Phase 27): the dialog mounts only when AppShell's dialogState
  // !== null, so it is by definition always active when present. The
  // hook's second arg becomes the literal `true`.
  useFocusTrap(dialogRef, true, { onEscape: props.onCancel });

  // The select() call is split out from focus() because useFocusTrap
  // owns the focus step. The input is the FIRST tabbable so the hook
  // already focuses it; this useEffect runs after the hook's focus
  // call lands and immediately selects the contents so the user can
  // retype without a manual click+select. (Phase 4 D-81 retains.)
  // QA-04 (Phase 27): runs once on mount. The mount itself is the
  // trigger (AppShell remounts the dialog every time dialogState
  // transitions from null → non-null), so deps are empty. inputRef
  // is a stable ref (exempt from react-hooks/exhaustive-deps).
  useEffect(() => {
    inputRef.current?.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    props.scope.length === 1
      ? `Override scale — ${props.scope[0]}`
      : `Override scale — ${props.scope.length} selected rows`;

  const apply = () => props.onApply(Number(inputValue));

  // QA-02 (Phase 27) — empty/whitespace guard. Number('') === 0 floors silently
  // through AppShell's onApply clamp to 1%; surfacing invalidity at the dialog
  // is simpler than relying on downstream clamps. Number.isFinite(Number(' '))
  // is false because Number(' ') === 0 — so trim() first, then check non-empty,
  // then Number.isFinite catches inputs like 'abc' (Number('abc') === NaN).
  const isValid = inputValue.trim() !== '' && Number.isFinite(Number(inputValue.trim()));

  // Enter triggers Apply (per-context shortcut, intentional). ESC moved
  // into useFocusTrap above so it works regardless of focus position.
  // Handler lives on the inner panel div (not on the input) so Tab
  // focus cycling stays intact — stopPropagation inside the input's
  // onKeyDown would break the trap.
  // QA-02 (Phase 27): Enter is a no-op when isValid is false — same guard
  // surface as the disabled Apply button.
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && isValid) apply();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-modal border border-border rounded-md p-6 min-w-[360px] font-mono shadow-2xl"
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
            max={999}
            step="any"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="bg-panel border border-border rounded-md px-2 py-1 w-24 text-fg focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <span className="text-fg-muted text-sm">%</span>
        </label>
        {/* 100% = ship at peak demand (sharpest possible export without
            oversampling). Higher values target dims between peak and the
            source ceiling and silently cap at min(canonical, on-disk PNG)
            in both the panel display and the export pipeline. */}
        <p className="text-fg-muted text-xs mt-2">100% = peak demand.</p>
        {/* Extrapolation explainer (peakScale > 1): the rig renders the
            asset above source resolution at peak. Export caps at canonical,
            so the percent shown reflects "% of rig demand satisfied," not
            "% of canonical." Conditional — clean dialog for the common
            peakScale ≤ 1 case where percent maps 1:1 to canonical export. */}
        {props.peakScale !== undefined && props.peakScale > 1 && (
          <p className="text-fg-muted text-xs mt-2 leading-relaxed">
            Spine rig renders this asset at{' '}
            <span className="text-fg">{props.peakScale.toFixed(2)}× source</span>{' '}
            at peak. Export is capped at canonical, so the percentage shown
            reflects how much of the rig's peak demand the export satisfies —
            not the export size relative to canonical.
          </p>
        )}
        <div className="flex gap-2 mt-6 justify-end">
          {/* Peak-anchored redesign (2026-05-05): under the new semantics
              applying 100% produces the same effScale as clearing the
              override (both → effScale = peakScale), so the prior "Reset
              to source (100%)" button was redundant. "Reset to peak"
              remains as the single clear action, visible only when there
              is actually an override to clear. */}
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
            onClick={props.onCancel}
            className="border border-border rounded-md px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!isValid}
            className={
              isValid
                ? "bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
                : "bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold opacity-50 cursor-not-allowed"
            }
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
