/**
 * Phase 8 Plan 04 — SaveQuitDialog (D-143 + D-144).
 *
 * Hand-rolled ARIA modal cloning OverrideDialog (Phase 4 D-81). Three buttons:
 *   - Save: AppShell calls saveProject; on success, runs the pendingAction.
 *   - Don't Save: runs pendingAction without saving.
 *   - Cancel: closes the dialog and aborts the pending action.
 *
 * Used in three contexts (passed via `reason` prop):
 *   - 'quit': user pressed Cmd+Q with isDirty === true.
 *   - 'new-skeleton-drop': user dropped a .json onto a dirty session.
 *   - 'new-project-drop': user dropped a .stmproj onto a dirty session.
 *
 * Body copy varies by reason; the three buttons stay the same.
 *
 * ARIA contract: role="dialog" + aria-modal="true" + aria-labelledby. Escape =>
 * onCancel (NOT Don't Save — Cancel is the safe default per Photoshop / AE
 * convention). Initial focus lands on Save (first tabbable in DOM order) via
 * useFocusTrap.
 *
 * Layer 3 invariant: this file imports only from react and the shared
 * useFocusTrap hook. Zero `core/*` imports — same Layer 3 rule as every
 * other renderer module. The tests/arch.spec.ts grep gate auto-scans this
 * file on every run.
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a
 * string literal. No template interpolation; conditional rendering uses
 * early-return null when !props.open instead of class toggling so the
 * scanner sees every literal once.
 */
import { useRef } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface SaveQuitDialogProps {
  open: boolean;
  reason: 'quit' | 'new-skeleton-drop' | 'new-project-drop';
  /** 'MyRig.stmproj' or null when Untitled. */
  basename: string | null;
  /** True while saveProject promise is in-flight; Save button shows "Saving…". */
  saving?: boolean;
  /** Calls saveProject; AppShell runs pendingAction on success. */
  onSave: () => void;
  /** Proceed without saving. */
  onDontSave: () => void;
  /** Abort pending action; modal closes; nothing happens. */
  onCancel: () => void;
}

function bodyCopyFor(
  reason: SaveQuitDialogProps['reason'],
  basename: string | null,
): { title: string; body: string } {
  const fileLabel = basename ?? 'Untitled';
  switch (reason) {
    case 'quit':
      return {
        title: 'Save changes before quitting?',
        body: `Your changes to ${fileLabel} have not been saved. Quitting now will discard them.`,
      };
    case 'new-skeleton-drop':
      return {
        title: 'Save changes before loading a new skeleton?',
        body: `Your changes to ${fileLabel} have not been saved. Loading a new skeleton will discard them.`,
      };
    case 'new-project-drop':
      return {
        title: 'Save changes before opening this project?',
        body: `Your changes to ${fileLabel} have not been saved. Opening another project will discard them.`,
      };
  }
}

export function SaveQuitDialog(props: SaveQuitDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Escape => Cancel (D-143 safe default per RESEARCH §Pattern C cookbook step 6).
  // useFocusTrap also auto-focuses the FIRST tabbable on mount = the Save
  // button below (Save is first in DOM order so the user's most-likely
  // intent for a "before quit" dialog is the default).
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });
  if (!props.open) return null;
  const { title, body } = bodyCopyFor(props.reason, props.basename);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-quit-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] max-w-[480px] font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="save-quit-title" className="text-sm text-fg mb-4 font-semibold">
          {title}
        </h2>
        <p className="text-xs text-fg-muted mb-6 leading-relaxed">{body}</p>
        <div className="flex gap-2 justify-end">
          {/* Save first => useFocusTrap auto-focuses it (first tabbable in
              DOM order). The 'Saving…' state is gated by props.saving — the
              parent (AppShell SaveQuitDialog mount in the 'quit' flow)
              shows it while the saveProject promise is in-flight. */}
          <button
            type="button"
            onClick={props.onSave}
            disabled={props.saving === true}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {props.saving === true ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={props.onDontSave}
            disabled={props.saving === true}
            className="border border-border rounded-md px-3 py-1 text-xs transition-colors cursor-pointer hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Don&apos;t Save
          </button>
          <button
            type="button"
            onClick={props.onCancel}
            disabled={props.saving === true}
            className="border border-border rounded-md px-3 py-1 text-xs transition-colors cursor-pointer hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
