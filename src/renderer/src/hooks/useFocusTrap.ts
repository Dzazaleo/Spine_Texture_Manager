/**
 * Phase 6 Gap-Fix Round 6 (2026-04-25) — shared focus trap + document-level
 * Escape handler for hand-rolled ARIA modals.
 *
 * Background: the project's three hand-rolled ARIA modals (OverrideDialog
 * from Phase 4 D-81, OptimizeDialog + ConflictDialog from Phase 6) each
 * implement the modal scaffold inline (`role="dialog"` + `aria-modal="true"` +
 * `aria-labelledby` + outer-overlay onClick close + inner stopPropagation).
 * They each ALSO auto-focus a single button on mount via a useEffect ref
 * call. What none of them do — and what Step-4 human-verify caught as a
 * regression — is:
 *
 *   1. Maintain a Tab/Shift+Tab focus cycle. Once focus reaches the LAST
 *      tabbable element inside the dialog, pressing Tab moves focus to
 *      whatever lives behind the modal (the page underneath, devtools,
 *      browser chrome). Same with Shift+Tab off the FIRST element. The
 *      user's reported symptom: "Tabbing only works if user clicks in the
 *      optimize dialogue footer first and tabbing repeatedly works once".
 *
 *   2. Listen for Escape at the DOCUMENT level. The existing dialogs wire
 *      their `onKeyDown={Escape}` handler on the dialog root div, which
 *      means the keydown only fires when focus is INSIDE the dialog
 *      subtree. Once focus has drifted to the page underneath (problem 1),
 *      Escape no longer reaches the handler — the user's reported symptom:
 *      "Esc closes the dialog IF user didn't tab enough times to make the
 *      focus leave the dialogue".
 *
 * Invariants this hook guarantees:
 *
 *   - On mount (when `enabled` becomes true), the FIRST focusable
 *     descendant of the container is auto-focused so the user can press
 *     Tab immediately without first clicking inside the dialog.
 *
 *   - Tab from the LAST focusable cycles to the FIRST. Shift+Tab from
 *     the FIRST cycles to the LAST. Focus never escapes the container.
 *
 *   - The keydown listener is registered on `document` (not the
 *     container) so the cycle works even if focus has drifted — the
 *     trap rescues focus back inside on the next Tab regardless of
 *     where it currently sits.
 *
 *   - The tabbable list is re-queried on every Tab press. The
 *     OptimizeDialog's footer changes between states (pre-flight has
 *     Cancel + Start, in-progress has Cancel only, complete has Open
 *     Folder + Close), so a memoized snapshot would go stale.
 *
 *   - Optional `onEscape` callback fires when Escape is pressed AND
 *     `enabled === true`. The dialog can pass undefined to opt out
 *     (e.g. OptimizeDialog's `'in-progress'` state where Escape is
 *     a no-op per D-115 — user must explicitly Cancel mid-run).
 *
 *   - On unmount (or when `enabled` becomes false), the listener is
 *     removed and previous focus is restored to whatever element was
 *     focused before the dialog opened (the toolbar button that opened
 *     the modal, in normal flow).
 *
 * Layer 3 invariant: this file lives under src/renderer/src/hooks/ and
 * imports only from react. It NEVER reaches into src/core/* — the
 * tests/arch.spec.ts grep gate auto-scans this file on every test run.
 */
import { useEffect, type RefObject } from 'react';

/**
 * Standard tabbable selector. Matches every interactive element that
 * participates in the browser's default Tab order:
 *   - buttons (excluding disabled — disabled buttons are NOT tabbable)
 *   - links with href
 *   - inputs / selects / textareas (excluding disabled)
 *   - any element with explicit non-negative tabIndex
 *
 * Deliberately excludes elements with `tabindex="-1"` (those are
 * focusable programmatically but not via Tab — e.g. our dialog root
 * itself if we ever add `tabindex="-1"` for screen-reader anchoring).
 */
const TABBABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface UseFocusTrapOptions {
  /**
   * Optional Escape handler. When provided AND `enabled === true`, the
   * hook listens for Escape at the document level and calls this on
   * each press. Pass `undefined` to opt out (OptimizeDialog's
   * `'in-progress'` state per D-115 — Escape must NOT close mid-run;
   * user must explicitly click Cancel).
   */
  onEscape?: () => void;
}

/**
 * Activates a focus trap on the given container while `enabled` is true.
 *
 * @param containerRef ref pointing at the dialog root element (the one
 *                     with `role="dialog"`). All descendants are
 *                     considered candidates for the focus cycle.
 * @param enabled      flag — typically `props.open` of the host dialog.
 *                     When false, the hook is a no-op (no listener
 *                     registered, no auto-focus performed).
 * @param options      `{ onEscape? }` per UseFocusTrapOptions JSDoc above.
 */
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  options: UseFocusTrapOptions = {},
): void {
  const { onEscape } = options;

  useEffect(() => {
    if (!enabled) return;
    const container = containerRef.current;
    if (!container) return;

    // Snapshot whatever was focused before we opened so we can restore
    // it on unmount. In normal flow this is the toolbar button that
    // opened the dialog; restoring focus there satisfies the standard
    // accessibility contract that closing a modal returns focus to the
    // trigger.
    const previouslyFocused =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Auto-focus the FIRST tabbable descendant on mount. Without this
    // step the user has to click inside the dialog before Tab does
    // anything useful — exactly the bug reported in Step 4 verification.
    const initialTabbables = container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);
    if (initialTabbables.length > 0) {
      initialTabbables[0].focus();
    }

    const onKeyDown = (event: KeyboardEvent) => {
      // Escape branch — fires regardless of where focus currently
      // sits (document-level listener), so it works even after focus
      // has drifted out of the container. The dialog opts out of
      // Escape handling by passing undefined (OptimizeDialog's
      // 'in-progress' state per D-115).
      if (event.key === 'Escape') {
        if (onEscape) {
          event.preventDefault();
          onEscape();
        }
        return;
      }

      // Tab branch — re-query the tabbable list on each press so
      // dynamic state changes (e.g. OptimizeDialog's footer flipping
      // between Cancel+Start / Cancel / Open+Close as state machine
      // advances) are reflected. A memoized snapshot would go stale.
      if (event.key !== 'Tab') return;
      const tabbables = container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR);
      if (tabbables.length === 0) return;
      const first = tabbables[0];
      const last = tabbables[tabbables.length - 1];
      const active = document.activeElement;

      // Two cycle scenarios + a rescue scenario:
      //   1. Shift+Tab while on FIRST → wrap to LAST
      //   2. Tab while on LAST       → wrap to FIRST
      //   3. Focus is OUTSIDE the container entirely (focus drifted
      //      to the page underneath, devtools, etc.) → rescue back
      //      to FIRST on either Tab or Shift+Tab. This is the
      //      defense for the reported "click footer to bring focus
      //      back" complaint — once the trap is mounted, a single
      //      Tab press is enough to recover.
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      } else if (!container.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      // Restore focus to whatever the user came from. Guarded with
      // `isConnected` check because the trigger might have been
      // unmounted while the dialog was open (rare but possible if
      // the dialog cause was a row that subsequently disappeared).
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
    // Re-run when enabled flips so the trap mounts/unmounts cleanly
    // alongside the host dialog's open/close. onEscape changes per
    // render in some callers but the closure capture is stable for
    // the duration of any given (enabled === true) lifecycle.
  }, [containerRef, enabled, onEscape]);
}
