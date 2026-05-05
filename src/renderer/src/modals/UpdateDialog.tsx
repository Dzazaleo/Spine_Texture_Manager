/**
 * Phase 12 Plan 01 Task 3 — Auto-update modal (D-05).
 *
 * Hand-rolled ARIA modal cloning HelpDialog's scaffold (Phase 9 D-188 +
 * the 5-modal pattern from src/renderer/src/modals/). Used by the
 * `update:available` / `update:downloaded` / `update:none` IPC flow
 * wired in Task 5 — AppShell mounts this in response to those events
 * (D-05 forbids native alert(), system toasts, or new UI primitives;
 * everything routes through this modal).
 *
 * State machine:
 *   - 'available': UpdateInfo received from main; user picks Download or Later.
 *   - 'downloading': download in flight (indeterminate spinner — UPD-03).
 *   - 'downloaded': ready to apply; user picks Restart or Later.
 *   - 'none': either "You're up to date" (manual check, no update) OR
 *     an error message (manual check, network/timeout failure). Reuses
 *     this modal so D-05's "no native dialog" rule holds for every
 *     manual-check exit path.
 *
 * Variant routing (Phase 12 D-04 + Phase 16 D-01 + D-05):
 *   - 'auto-update' (default): Linux always; Windows-IF-spike-PASS.
 *     Buttons: Download + Restart / Restart / Later / Dismiss.
 *   - 'manual-download': platform routes manual-download (Phase 16 D-01:
 *     macOS always; Windows unless spikeOutcome === 'pass'). Buttons:
 *     Open Release Page / Later. The user is directed externally to
 *     download the new installer manually (UPD-06 documented manual
 *     update path).
 *
 * ARIA contract (mirrors HelpDialog.tsx:89-114 byte-for-byte):
 *   - role="dialog" + aria-modal="true" + aria-labelledby="update-title"
 *   - useFocusTrap with onEscape: props.onClose
 *   - outer overlay onClick = onClose; inner content onClick stops
 *     propagation so clicks on text don't dismiss the dialog.
 *
 * Phase 8.2 D-184 — role="dialog" + aria-modal="true" auto-suppresses
 * File menu via the existing modalOpen derivation (any aria-modal="true"
 * mount feeds the notifyMenuState push side that disables Save/Save As
 * at the OS level while the modal is open). No extra wiring needed in
 * AppShell beyond the updateState slot (Task 5).
 *
 * Release-notes rendering (D-09):
 *   - Plain-text <pre> with whitespace-pre-wrap. No markdown library, no
 *     dangerouslySetInnerHTML, no innerHTML — HelpDialog precedent: zero
 *     XSS surface. Main-side extractSummary already strips HTML tags
 *     before the string crosses IPC.
 *
 * Layer 3 invariant: this file imports only from react and the local
 * useFocusTrap hook. It never reaches into src/core/* or src/main/* —
 * the tests/arch.spec.ts grep gate auto-scans this file on every test run.
 *
 * Tailwind v4 literal-class discipline: every className is a string
 * literal (or a clsx conditional with literal branches). No template
 * interpolation; conditional state arms render via ternaries / && chains
 * with literal class strings inside.
 */

import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

/**
 * UpdateDialog state machine. The 'none' arm is the warning-8 fix for
 * D-05 (no native alert()): the manual-check "You're up to date" message
 * and the manual-check error message both reuse this modal with state='none'
 * so the renderer never falls back to `window.alert(...)`.
 */
export type UpdateDialogState = 'available' | 'downloading' | 'downloaded' | 'none';

/**
 * D-04 variant routing. main is the single source of truth for `variant` —
 * the renderer never derives this from the OS platform (the platform global
 * is unavailable to the sandboxed renderer anyway).
 */
export type UpdateDialogVariant = 'auto-update' | 'manual-download';

export interface UpdateDialogProps {
  open: boolean;
  state: UpdateDialogState;
  /** Available version label (e.g. "1.2.3"). Empty string for state='none' error path. */
  version: string;
  /**
   * Plain-text Summary section already extracted by main's extractSummary
   * (D-09). Empty string when no notes available OR when state='none' shows
   * "You're up to date". Non-empty string when state='none' carries an
   * error message.
   */
  summary: string;
  /** Default 'auto-update' (Linux always; Windows-IF-spike-PASS). macOS + Windows-default route to 'manual-download' (Phase 16 D-01). */
  variant?: UpdateDialogVariant;
  /** state='available' (auto-update variant only) — opt-in download trigger (UPD-03). */
  onDownload?: () => void;
  /** state='downloaded' (auto-update variant only) — quit + apply + relaunch (UPD-04). */
  onRestart?: () => void;
  /** All states + both variants — persists dismissedUpdateVersion via D-08. */
  onLater: () => void;
  /** manual-download variant only — opens GitHub Release page externally. */
  onOpenReleasePage?: () => void;
  /** Overlay click + Escape key. */
  onClose: () => void;
}

// External link URLs — MUST be present in SHELL_OPEN_EXTERNAL_ALLOWED in
// src/main/ipc.ts. If you add a URL here, also add it there. Mismatches
// are silently dropped by the main handler. Mirrors HelpDialog.tsx:65-70.
const GITHUB_RELEASES_INDEX_URL =
  'https://github.com/Dzazaleo/Spine_Texture_Manager/releases';

/**
 * Headline string by state + variant. Pulled out of the JSX so the test
 * suite can assert `/up to date/i` without coupling to the JSX structure.
 */
function headlineFor(
  state: UpdateDialogState,
  variant: UpdateDialogVariant,
  version: string,
  summary: string,
): string {
  if (state === 'none') {
    // Error path: summary is non-empty (carries the error message).
    if (summary.length > 0) return 'Update check failed';
    // Happy path: manual check, app is already on the latest version.
    return "You're up to date";
  }
  if (state === 'downloaded') {
    return `Restart to apply v${version}`;
  }
  // 'available' or 'downloading' — both variants share the headline.
  if (variant === 'manual-download') {
    return `Update available: v${version}`;
  }
  return `Update available: v${version}`;
}

export function UpdateDialog(props: UpdateDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Document-level Escape + Tab cycle via the shared hook. Same pattern
  // every other dialog in src/renderer/src/modals/ uses.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });
  if (!props.open) return null;

  const variant: UpdateDialogVariant = props.variant ?? 'auto-update';
  const headline = headlineFor(props.state, variant, props.version, props.summary);

  // Curried click handler for external links — mirrors HelpDialog.tsx:85-87.
  const openLink = (url: string) => () => {
    window.api.openExternalUrl(url);
  };

  // Body: state='none' happy path shows "Running v${version}." beneath
  // the headline. Error path shows the summary in the <pre> block. All
  // other states show the summary in the <pre> block (release notes).
  const showCurrentVersionLine =
    props.state === 'none' && props.summary.length === 0 && props.version.length > 0;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-modal border border-border rounded-md p-6 max-w-[600px] max-h-[80vh] overflow-y-auto font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between mb-4">
          <h2 id="update-title" className="text-base font-semibold text-fg">
            {headline}
          </h2>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="Close update dialog"
            className="border border-border rounded-md px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
          >
            Close
          </button>
        </div>

        {showCurrentVersionLine && (
          <p className="text-xs text-fg-muted leading-relaxed mb-4">
            Running v{props.version}.
          </p>
        )}

        {props.summary.length > 0 && (
          <pre className="text-xs text-fg-muted whitespace-pre-wrap mb-4 font-mono">
            {props.summary}
          </pre>
        )}

        {/* "View full release notes" link only on the auto-update variant
            available/downloaded/downloading states — manual-download's
            [Open Release Page] button covers this affordance. state='none'
            doesn't show a release-notes link (no specific release to point
            to). */}
        {variant !== 'manual-download' && props.state !== 'none' && (
          <button
            type="button"
            onClick={openLink(GITHUB_RELEASES_INDEX_URL)}
            className="underline text-accent hover:text-fg text-xs mb-4 block"
          >
            View full release notes
          </button>
        )}

        {/* Button row by state + variant. Class strings copied from
            SaveQuitDialog.tsx:108-128 verbatim (primary bg-accent / secondary
            border-border / disabled opacity-50 idiom). */}
        <div className="flex gap-2 justify-end">
          {variant === 'manual-download' && (
            <>
              <button
                type="button"
                onClick={props.onOpenReleasePage}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Open Release Page
              </button>
              <button
                type="button"
                onClick={props.onLater}
                className="border border-border rounded-md px-3 py-1 text-xs transition-colors cursor-pointer hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Later
              </button>
            </>
          )}

          {variant !== 'manual-download' && props.state === 'available' && (
            <>
              <button
                type="button"
                onClick={props.onDownload}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Download + Restart
              </button>
              <button
                type="button"
                onClick={props.onLater}
                className="border border-border rounded-md px-3 py-1 text-xs transition-colors cursor-pointer hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Later
              </button>
            </>
          )}

          {variant !== 'manual-download' && props.state === 'downloading' && (
            <button
              type="button"
              disabled
              className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold opacity-50 cursor-not-allowed"
            >
              Downloading…
            </button>
          )}

          {variant !== 'manual-download' && props.state === 'downloaded' && (
            <>
              <button
                type="button"
                onClick={props.onRestart}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Restart
              </button>
              <button
                type="button"
                onClick={props.onLater}
                className="border border-border rounded-md px-3 py-1 text-xs transition-colors cursor-pointer hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
              >
                Later
              </button>
            </>
          )}

          {variant !== 'manual-download' && props.state === 'none' && (
            <button
              type="button"
              onClick={props.onLater}
              className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
