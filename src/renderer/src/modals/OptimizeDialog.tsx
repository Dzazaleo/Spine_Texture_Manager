/**
 * Phase 6 Plan 06 — Hand-rolled ARIA modal for Optimize Assets (F8.1 + F8.5).
 *
 * Three-state state machine (D-119 + D-120):
 *   1. 'pre-flight' (initial on mount): scrollable file list preview +
 *      Cancel/Start footer. excludedUnused count surfaced as a muted note
 *      (D-109).
 *   2. 'in-progress' (Start clicked): linear bar + scrollable per-file
 *      checklist + Cancel footer. Subscribes to api.onExportProgress in
 *      a useEffect; cleanup via the returned unsubscribe (Pitfall 9 +
 *      Pitfall 15 leak prevention — the wrapped-const closure on the
 *      preload side preserves listener identity end-to-end).
 *   3. 'complete' (export resolved or cancelled): bar at 100% + summary
 *      line + Open output folder / Close footer.
 *
 * ARIA scaffold cloned verbatim from OverrideDialog.tsx (Phase 4 D-81):
 * role='dialog' + aria-modal='true' + aria-labelledby + outer overlay
 * onClick=close + inner stopPropagation + onKeyDown for ESC.
 *
 * State-conditional close behavior: ESC + click-outside close in
 * pre-flight or complete. During in-progress they are NO-OPS — user
 * must explicitly Cancel. This prevents accidental dismissal mid-run
 * (T-06-16 mitigation: renderer never silently goes deaf while main
 * keeps writing files).
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a
 * string literal or clsx with literal branches. Status icons use clsx
 * with the per-status class branches enumerated below.
 *
 * Layer 3 invariant: imports only from react + clsx + ../../../shared/types.js.
 * NEVER from ../../core/* (tests/arch.spec.ts gate at lines 19-34).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import clsx from 'clsx';
import type {
  ExportPlan,
  ExportProgressEvent,
  ExportResponse,
  ExportSummary,
} from '../../../shared/types.js';

type DialogState = 'pre-flight' | 'in-progress' | 'complete';
type RowStatus = 'idle' | 'in-progress' | 'success' | 'error';

export interface OptimizeDialogProps {
  open: boolean;
  plan: ExportPlan;
  outDir: string;
  onClose: () => void;
  onRunStart?: () => void;
  onRunEnd?: () => void;
  /**
   * Gap-Fix Round 3 (2026-04-25) — pre-start confirmation hook. The
   * dialog calls this when the user clicks Start; the parent (AppShell)
   * runs the probe-then-confirm flow (probeExportConflicts +
   * ConflictDialog) and resolves with one of:
   *   - `{ proceed: true, overwrite: false }` — no conflicts; start normally
   *   - `{ proceed: true, overwrite: true }`  — user clicked Overwrite all
   *   - `{ proceed: false }`                  — user cancelled or picked
   *                                             a different folder; the
   *                                             dialog stays in pre-flight
   *                                             (or AppShell separately
   *                                             closes/reopens it)
   *
   * If the prop is omitted (legacy callers), the dialog skips the probe
   * and starts directly with overwrite=false — preserving today's
   * behaviour for any caller that has not yet adopted the new flow.
   */
  onConfirmStart?: () => Promise<{ proceed: boolean; overwrite?: boolean }>;
}

export function OptimizeDialog(props: OptimizeDialogProps) {
  const [state, setState] = useState<DialogState>('pre-flight');
  // Gap-Fix #3 (2026-04-25 human-verify Step 1): key rowStatuses + rowErrors
  // by row INDEX (number), NOT outPath. Previously the write site at line 87
  // stored event.outPath (ABSOLUTE resolved path emitted by image-worker)
  // while the read site at line 329 looked up row.outPath (RELATIVE
  // 'images/AVATAR/BODY.png') — keys never matched, so all rows stayed ○
  // idle even when errors arrived. Index is unambiguous, doesn't depend on
  // path normalization, and is already on every progress event (event.index).
  const [rowStatuses, setRowStatuses] = useState<Map<number, RowStatus>>(() => {
    const m = new Map<number, RowStatus>();
    for (let i = 0; i < props.plan.rows.length; i++) m.set(i, 'idle');
    return m;
  });
  const [rowErrors, setRowErrors] = useState<Map<number, string>>(new Map());
  const [expandedErrors, setExpandedErrors] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState<{ current: number; lastPath: string }>({
    current: 0,
    lastPath: '',
  });
  const [summary, setSummary] = useState<ExportSummary | null>(null);

  const startBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Subscribe to progress events while in-progress. Cleanup unsubscribes
  // exactly the listener registered (Pitfall 9 — the preload's wrapped-const
  // closure preserves listener identity through window.api.onExportProgress).
  useEffect(() => {
    if (state !== 'in-progress') return;
    const unsubscribe = window.api.onExportProgress((event: ExportProgressEvent) => {
      // Gap-Fix #3: keyed by event.index (number), NOT event.outPath. The
      // image-worker emits ABSOLUTE outPath; the row table reads from
      // row.outPath which is RELATIVE — keys never matched. Index is
      // unambiguous and already on every progress event.
      setRowStatuses((prev) => {
        const next = new Map(prev);
        next.set(event.index, event.status);
        return next;
      });
      setProgress({ current: event.index + 1, lastPath: event.path });
      if (event.status === 'error' && event.error) {
        const errMsg = event.error.message;
        setRowErrors((prev) => {
          const next = new Map(prev);
          next.set(event.index, errMsg);
          return next;
        });
      }
    });
    return unsubscribe;
  }, [state]);

  // Auto-focus the primary action of the current state — keyboard users get
  // immediate Enter-to-act behavior without a manual click.
  useEffect(() => {
    if (!props.open) return;
    if (state === 'pre-flight') startBtnRef.current?.focus();
    if (state === 'in-progress') cancelBtnRef.current?.focus();
    if (state === 'complete') closeBtnRef.current?.focus();
  }, [props.open, state]);

  const onStart = useCallback(async () => {
    // Gap-Fix Round 3 (2026-04-25): probe-then-confirm. Ask the parent
    // (AppShell) whether it's safe to proceed BEFORE flipping to
    // in-progress; the parent runs probeExportConflicts and may surface a
    // ConflictDialog which yields { proceed:true, overwrite:true } when
    // the user clicks "Overwrite all", { proceed:false } when they Cancel
    // or Pick different folder, or { proceed:true, overwrite:false } when
    // there are no conflicts.
    //
    // CRITICAL: setState('in-progress') and props.onRunStart() must run
    // ONLY AFTER the parent says proceed:true — otherwise the dialog
    // would flicker into the in-progress UI during the probe / modal
    // and the toolbar button would grey out for an export that never ran.
    let overwrite = false;
    if (props.onConfirmStart) {
      const decision = await props.onConfirmStart();
      if (!decision.proceed) {
        // User cancelled or picked a different folder — stay in pre-flight.
        // (If the parent closed this dialog as part of "Pick different
        // folder", `props.open` will go false on the next render and this
        // component unmounts; we don't need to handle that here.)
        return;
      }
      overwrite = decision.overwrite === true;
    }

    setState('in-progress');
    props.onRunStart?.();
    // All rows already initialized to 'idle' on mount; progress events flip
    // them to 'in-progress' / 'success' / 'error' as they fire.
    const response: ExportResponse = await window.api.startExport(
      props.plan,
      props.outDir,
      overwrite,
    );
    if (response.ok) {
      setSummary(response.summary);
    } else {
      // already-running / invalid-out-dir / overwrite-source / Unknown —
      // surface as a synthetic summary with one synthetic write-error so
      // the complete state still renders cleanly + the error is visible
      // to the user. (overwrite-source should never reach here in normal
      // flow because the probe-then-confirm above intercepts it; this
      // branch is the defense-in-depth path.)
      setSummary({
        successes: 0,
        errors: [
          {
            kind: 'write-error',
            path: props.outDir,
            message: response.error.message,
          },
        ],
        outputDir: props.outDir,
        durationMs: 0,
        cancelled: false,
      });
    }
    setState('complete');
    props.onRunEnd?.();
  }, [props]);

  const onCancelInProgress = useCallback(() => {
    window.api.cancelExport();
    // Don't change state immediately — wait for startExport to resolve
    // with summary.cancelled === true, then state flips to 'complete'.
  }, []);

  const onCloseSafely = useCallback(() => {
    // ESC + click-outside guard (T-06-16): only allow close in pre-flight or
    // complete. During in-progress they are NO-OPS — user must explicitly Cancel.
    if (state === 'in-progress') return;
    props.onClose();
  }, [state, props]);

  const onOpenOutputFolder = useCallback(() => {
    window.api.openOutputFolder(props.outDir);
  }, [props.outDir]);

  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onCloseSafely();
    if (e.key === 'Enter' && state === 'pre-flight') onStart();
  };

  if (!props.open) return null;

  const total = props.plan.rows.length;
  const headerTitle =
    state === 'complete'
      ? `Export complete — ${summary?.successes ?? 0} of ${total} succeeded`
      : state === 'in-progress'
        ? `Optimize Assets — ${progress.current} of ${total} → ${props.outDir}`
        : `Optimize Assets — ${total} images → ${props.outDir}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="optimize-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCloseSafely}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[640px] max-w-[800px] max-h-[80vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="optimize-title" className="text-sm text-fg mb-4">
          {headerTitle}
        </h2>

        {state === 'pre-flight' && <PreFlightBody plan={props.plan} />}
        {state !== 'pre-flight' && (
          <InProgressBody
            plan={props.plan}
            rowStatuses={rowStatuses}
            rowErrors={rowErrors}
            expandedErrors={expandedErrors}
            onToggleExpand={(rowIndex) => {
              setExpandedErrors((prev) => {
                const next = new Set(prev);
                if (next.has(rowIndex)) next.delete(rowIndex);
                else next.add(rowIndex);
                return next;
              });
            }}
            progressCurrent={progress.current}
            total={total}
            summary={summary}
          />
        )}

        <div className="flex gap-2 mt-6 justify-end">
          {state === 'pre-flight' && (
            <>
              <button
                type="button"
                onClick={props.onClose}
                className="border border-border rounded-md px-3 py-1 text-xs"
              >
                Cancel
              </button>
              <button
                ref={startBtnRef}
                type="button"
                onClick={onStart}
                disabled={total === 0}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Start
              </button>
            </>
          )}
          {state === 'in-progress' && (
            <button
              ref={cancelBtnRef}
              type="button"
              onClick={onCancelInProgress}
              className="border border-border rounded-md px-3 py-1 text-xs"
            >
              Cancel
            </button>
          )}
          {state === 'complete' && (
            <>
              <button
                type="button"
                onClick={onOpenOutputFolder}
                className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg"
              >
                Open output folder
              </button>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={props.onClose}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PreFlightBody({ plan }: { plan: ExportPlan }) {
  return (
    <div className="flex-1 overflow-auto">
      <ul className="text-xs text-fg-muted">
        {plan.rows.map((row) => {
          const ratio = row.outW > 0 ? row.sourceW / row.outW : 1;
          return (
            <li
              key={row.outPath}
              className="py-1 border-b border-border last:border-0"
            >
              <span className="text-fg">{row.outPath}</span>
              <span className="ml-2">
                {row.sourceW}×{row.sourceH} → {row.outW}×{row.outH}
              </span>
              {ratio > 1.05 && (
                <span className="ml-2">~{ratio.toFixed(1)}x smaller</span>
              )}
            </li>
          );
        })}
      </ul>
      {plan.excludedUnused.length > 0 && (
        <p className="mt-3 text-xs text-fg-muted">
          {plan.excludedUnused.length} unused attachments excluded — see Global panel.
        </p>
      )}
    </div>
  );
}

function InProgressBody(props: {
  plan: ExportPlan;
  // Gap-Fix #3: keyed by row INDEX (number), NOT outPath. The image-worker
  // emits ABSOLUTE outPath; row.outPath is RELATIVE; using outPath as the
  // key meant rows never updated. Index is unambiguous.
  rowStatuses: ReadonlyMap<number, RowStatus>;
  rowErrors: ReadonlyMap<number, string>;
  expandedErrors: ReadonlySet<number>;
  onToggleExpand: (rowIndex: number) => void;
  progressCurrent: number;
  total: number;
  summary: ExportSummary | null;
}) {
  const pct =
    props.total > 0
      ? Math.min(100, Math.round((props.progressCurrent / props.total) * 100))
      : 0;
  return (
    <>
      <div className="mb-4">
        <div className="h-2 bg-panel border border-border rounded-md overflow-hidden">
          <div
            className="h-full bg-accent"
            style={{ width: `${pct}%` }}
            aria-hidden
          />
        </div>
      </div>
      <ul className="flex-1 overflow-auto text-xs">
        {props.plan.rows.map((row, rowIndex) => {
          const status = (props.rowStatuses.get(rowIndex) ?? 'idle') as RowStatus;
          const errMsg = props.rowErrors.get(rowIndex);
          const expanded = props.expandedErrors.has(rowIndex);
          return (
            <li
              key={row.outPath}
              className="py-1 border-b border-border last:border-0"
            >
              <button
                type="button"
                onClick={() => {
                  if (status === 'error' && errMsg) props.onToggleExpand(rowIndex);
                }}
                className="w-full text-left flex items-center gap-2"
                disabled={status !== 'error'}
              >
                <span
                  aria-hidden
                  className={clsx(
                    'inline-block w-3 text-center',
                    status === 'success' && 'text-fg',
                    status === 'error' && 'text-[color:var(--color-danger)]',
                    status === 'in-progress' && 'text-fg-muted animate-pulse',
                    status === 'idle' && 'text-fg-muted',
                  )}
                >
                  {status === 'success'
                    ? '✓'
                    : status === 'error'
                      ? '⚠'
                      : status === 'in-progress'
                        ? '·'
                        : '○'}
                </span>
                <span
                  className={clsx(
                    'flex-1',
                    status === 'error'
                      ? 'text-[color:var(--color-danger)]'
                      : 'text-fg',
                  )}
                >
                  {row.outPath}
                </span>
                <span className="text-fg-muted">
                  {row.sourceW}×{row.sourceH} → {row.outW}×{row.outH}
                </span>
              </button>
              {expanded && errMsg && (
                <p className="mt-1 ml-5 text-[color:var(--color-danger)]">
                  {errMsg}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {props.summary !== null && (
        <p className="mt-3 text-xs text-fg-muted">
          {props.summary.successes} succeeded, {props.summary.errors.length} failed in{' '}
          {(props.summary.durationMs / 1000).toFixed(1)}s
          {props.summary.cancelled ? ' — cancelled' : ''}
        </p>
      )}
    </>
  );
}
