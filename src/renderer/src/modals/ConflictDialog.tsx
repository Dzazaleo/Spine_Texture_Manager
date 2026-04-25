/**
 * Phase 6 Gap-Fix Round 3 (2026-04-25) — Hand-rolled ARIA modal for the
 * pre-start overwrite-confirmation flow.
 *
 * Mounted by AppShell when probeExportConflicts returns a non-empty list.
 * Three discrete user actions:
 *   - Cancel              → close ConflictDialog AND close OptimizeDialog
 *                           (user backed out of the export entirely)
 *   - Pick different folder → close ConflictDialog → re-call
 *                             pickOutputDirectory; AppShell rebuilds the
 *                             plan, re-probes, and re-evaluates
 *   - Overwrite all       → close ConflictDialog → call
 *                           startExport(plan, outDir, overwrite=true);
 *                           OptimizeDialog flips to in-progress
 *
 * ARIA scaffold cloned verbatim from OverrideDialog.tsx + OptimizeDialog.tsx
 * (Phase 4 D-81 / Phase 6 Plan 06):
 *   - role='dialog' + aria-modal='true' + aria-labelledby
 *   - outer overlay onClick={onCancel} (ESC equivalent — safer default)
 *   - inner panel stopPropagation so clicks inside don't bubble to overlay
 *   - keyDown ESC = onCancel
 *   - auto-focus the FIRST button (Cancel — safer default; user must
 *     deliberately Tab to the destructive Overwrite all option)
 *
 * Footer button order (left-to-right): Cancel | Pick different folder |
 * Overwrite all. The destructive action sits RIGHTMOST per platform
 * convention so a habit Enter/click on the leftmost button never destroys
 * data — and uses the same orange-accent treatment as OptimizeDialog's
 * Start button so it's visually identifiable as the primary-but-dangerous
 * action.
 *
 * Conflict list: scrollable via max-h-[12rem] overflow-auto; each path
 * rendered as truncate-with-ellipsis font-mono with title=path so the
 * full path surfaces on hover. The visible cap is generous enough that
 * typical collision lists (a few rows) display in full; large collision
 * lists (entire-folder overwrite) scroll inside the dialog rather than
 * stretching the dialog beyond the viewport.
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a
 * string literal. No template interpolation, no concatenation; conditional
 * rendering handled via early-return null when !props.open rather than
 * class toggling so the scanner sees every literal once.
 *
 * Layer 3 invariant: imports only from react. Never from src/core/* or any
 * main-process module — the arch.spec.ts renderer-boundary grep auto-scans
 * this file on every test run.
 */
import { useEffect, useRef, type KeyboardEvent } from 'react';

export interface ConflictDialogProps {
  open: boolean;
  /** Absolute paths of files that would be overwritten. Sorted, deduped. */
  conflicts: string[];
  /**
   * User clicked Cancel (or hit ESC, or clicked the overlay). Backs out of
   * the export entirely — AppShell closes both ConflictDialog AND
   * OptimizeDialog.
   */
  onCancel: () => void;
  /**
   * User clicked "Pick different folder". AppShell closes this dialog and
   * re-triggers pickOutputDirectory; the resulting picker may itself be
   * cancelled (user changes mind) or yield a new outDir which is then
   * re-probed and either OK'd straight to startExport or surfaces a fresh
   * ConflictDialog if the new folder also collides.
   */
  onPickDifferent: () => void;
  /**
   * User clicked "Overwrite all". AppShell closes this dialog and calls
   * startExport(plan, outDir, overwrite=true). OptimizeDialog flips to
   * in-progress; the existing per-row progress UI takes over.
   */
  onOverwrite: () => void;
}

export function ConflictDialog(props: ConflictDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (props.open) {
      // D-81: auto-focus the first (safest) button — user must Tab to
      // reach the destructive Overwrite-all option.
      cancelBtnRef.current?.focus();
    }
  }, [props.open]);

  if (!props.open) return null;

  const count = props.conflicts.length;
  const title =
    count === 1
      ? '1 file will be overwritten'
      : `${count} files will be overwritten`;

  // D-81: ESC = Cancel; no Enter shortcut on this dialog because the
  // primary action is destructive — we DO NOT want Enter to overwrite
  // by default. The user must explicitly Tab over and click/Space.
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') props.onCancel();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conflict-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[480px] max-w-[800px] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="conflict-title" className="text-sm text-fg mb-4">
          {title}
        </h2>
        <ul className="text-xs text-[color:var(--color-danger)] max-h-[12rem] overflow-auto border border-border rounded-md p-2 mb-4">
          {props.conflicts.map((path) => (
            <li
              key={path}
              title={path}
              className="truncate py-0.5"
            >
              {path}
            </li>
          ))}
        </ul>
        <p className="text-fg-muted text-xs mb-4">
          Choose Cancel to back out, Pick different folder to choose a new
          output directory, or Overwrite all to proceed (this cannot be undone).
        </p>
        <div className="flex gap-2 justify-end">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={props.onCancel}
            className="border border-border rounded-md px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={props.onPickDifferent}
            className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg"
          >
            Pick different folder
          </button>
          <button
            type="button"
            onClick={props.onOverwrite}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
          >
            Overwrite all
          </button>
        </div>
      </div>
    </div>
  );
}
