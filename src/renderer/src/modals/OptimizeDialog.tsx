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
 * onClick=close + inner stopPropagation + onKeyDown for Enter (pre-flight
 * Start shortcut). Round 6 hoisted Tab cycle + Escape into the shared
 * useFocusTrap hook so focus never escapes the dialog and Escape works
 * regardless of where focus has drifted.
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
import { useFocusTrap } from '../hooks/useFocusTrap';

type DialogState = 'pre-flight' | 'in-progress' | 'complete';
type RowStatus = 'idle' | 'in-progress' | 'success' | 'error';

export interface OptimizeDialogProps {
  open: boolean;
  plan: ExportPlan;
  outDir: string | null;
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
  /**
   * Phase 19 UI-03 + D-11/D-12 — REQUIRED cross-nav handler. The dialog
   * renders a footer-LEFT outlined-secondary button that invokes
   * `props.onClose()` THEN `props.onOpenAtlasPreview()` (sequential mount
   * per D-11; useFocusTrap cleanup runs on unmount before
   * AtlasPreviewModal's mount calls its own trap — two distinct trap
   * lifecycles, never co-existing). Plan 19-03 added the prop type as
   * OPTIONAL + wired the AppShell-side binding
   * `onOpenAtlasPreview={() => setAtlasPreviewOpen(true)}`; Plan 19-06
   * tightens to REQUIRED here as the modal-side cross-nav button is now
   * rendered and consumes this handler unconditionally.
   */
  onOpenAtlasPreview: () => void;
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
  // Phase 22 Plan 22-05 — total now spans [passthroughCopies, ...rows] in a
  // single absolute index space (image-worker emits passthrough events first
  // at indices 0..N-1, resize events follow at N..total-1). Mirrors the
  // image-worker single-index-space contract from Plan 22-04 Task 2.
  const [rowStatuses, setRowStatuses] = useState<Map<number, RowStatus>>(() => {
    const m = new Map<number, RowStatus>();
    const totalRows =
      props.plan.passthroughCopies.length + props.plan.rows.length;
    for (let i = 0; i < totalRows; i++) m.set(i, 'idle');
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
  // Gap-Fix Round 6 (2026-04-25): the dialog root ref is consumed by
  // useFocusTrap to scope the Tab cycle + document-level Escape listener.
  const dialogRef = useRef<HTMLDivElement>(null);

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

  // Gap-Fix Round 6 (2026-04-25): per-state primary-action focus targeting.
  // useFocusTrap auto-focuses the FIRST tabbable on initial mount; this
  // useEffect overrides that to land on the per-state primary action
  // (Start in pre-flight, Cancel in in-progress, Close in complete) so
  // keyboard users get immediate Enter-to-act behavior. The trap continues
  // to enforce the Tab cycle independently — the two never fight because
  // the trap only re-runs on enabled flips, not on per-state focus moves.
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
    // Phase 6 REVIEW M-02 (2026-04-25) — narrow deps from `[state, props]`
    // to `[state, props.onClose]`. The whole `props` object is a fresh
    // reference on every parent render, which previously recreated
    // onCloseSafely each tick; useFocusTrap (which lists `onEscape` in
    // its dependency array) would then tear down + re-run its effect on
    // every parent render, racing against the per-state focus useEffect
    // above and undoing the auto-focus contract documented in
    // useFocusTrap.ts:184-188. Only `state` (closure-captured) and
    // `props.onClose` (the only prop the body reads) need to be tracked.
  }, [state, props.onClose]);

  const onOpenOutputFolder = useCallback(() => {
    if (props.outDir !== null) {
      window.api.openOutputFolder(props.outDir);
    }
  }, [props.outDir]);

  // Gap-Fix Round 6 (2026-04-25): document-level Escape handler via the
  // shared focus-trap hook. Pass undefined when state === 'in-progress'
  // so the hook's Escape branch becomes a no-op (D-115 — user must
  // explicitly click Cancel mid-run; ESC must not abort silently). The
  // pre-flight + complete states pass onCloseSafely so ESC works
  // regardless of where focus currently sits in the document.
  useFocusTrap(dialogRef, props.open, {
    onEscape: state === 'in-progress' ? undefined : onCloseSafely,
  });

  // Enter shortcut for the pre-flight Start action stays as a local
  // keydown on the panel (Enter is per-context, not a global shortcut).
  // Round 6 narrowed this from {Escape, Enter} to {Enter only}; the
  // useFocusTrap hook owns Escape now.
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && state === 'pre-flight') onStart();
  };

  if (!props.open) return null;

  // Phase 22 Plan 22-05 — total spans BOTH passthroughCopies + rows under the
  // single-index-space contract from Plan 22-04 (image-worker emits passthrough
  // events first then resize events, all in monotonically-increasing index
  // 0..total-1). Header title + progress percent + Start-disabled predicate
  // all reflect both arrays.
  const total =
    props.plan.passthroughCopies.length + props.plan.rows.length;
  // Phase 19 UI-03 D-09 — three summary tile values computed in-render from
  // props.plan (no new prop surface required). Zero-guard on the savings
  // calculation handles the empty-plan edge case so we never divide by 0.
  //
  // Phase 22 Plan 22-05 — "Used Files" includes passthroughCopies (those files
  // ARE written to outDir via byte-copy per D-03; they are NOT excluded). "to
  // Resize" still counts only plan.rows (passthrough rows are byte-copied, not
  // Lanczos'd). Savings calc still operates on plan.rows only — passthrough
  // rows produce 0 savings by construction (input bytes === output bytes).
  const totalUsedFiles =
    props.plan.rows.length + props.plan.passthroughCopies.length;
  const toResize = props.plan.rows.filter((r) => r.outW < r.sourceW).length;
  const sumSourcePixels = props.plan.rows.reduce(
    (acc, r) => acc + r.sourceW * r.sourceH,
    0,
  );
  const sumOutPixels = props.plan.rows.reduce(
    (acc, r) => acc + r.outW * r.outH,
    0,
  );
  const savingsPct =
    sumSourcePixels > 0
      ? (1 - sumOutPixels / sumSourcePixels) * 100
      : 0;
  const headerTitle =
    state === 'complete'
      ? `Export complete — ${summary?.successes ?? 0} of ${total} succeeded`
      : state === 'in-progress'
        ? `Optimize Assets — ${progress.current} of ${total} → ${props.outDir}`
        : props.outDir !== null
          ? `Optimize Assets — ${total} images → ${props.outDir}`
          : `Optimize Assets — ${total} images`;

  return (
    <div
      ref={dialogRef}
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

        {/* Phase 19 UI-03 D-09 — 3 summary tiles (Used Files / to Resize /
            Saving est. pixels) above the body branches. bg-surface
            (= --color-stone-950) is intentionally darker than the
            surrounding bg-panel (= --color-stone-900) for a recessed
            card-on-card visual using existing tokens only. */}
        <div className="flex gap-3 mb-4">
          <div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
            <span className="text-base font-semibold text-fg">{totalUsedFiles}</span>
            <span className="text-xs text-fg-muted text-center">Used Files</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
            <span className="text-base font-semibold text-fg">{toResize}</span>
            <span className="text-xs text-fg-muted text-center">to Resize</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 border border-border rounded-md bg-surface p-3">
            <span className="text-base font-semibold text-fg">{savingsPct.toFixed(1)}%</span>
            <span className="text-xs text-fg-muted text-center">Saving est. pixels</span>
          </div>
        </div>

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

        <div className="flex gap-2 mt-6 justify-between">
          {/* Phase 19 UI-03 D-11 + D-12 — cross-nav to AtlasPreviewModal at
              footer LEFT. Sequential mount: onClose() runs FIRST so the
              focus-trap unmount-cleanup completes BEFORE AtlasPreviewModal's
              mount installs its own trap (two distinct trap lifecycles, never
              co-existing). Disabled predicate is plan.rows.length === 0 per
              orchestrator's revision-pass lock — keeps OptimizeDialogProps
              tight (no new `summary` prop needed). D-18 outlined-secondary
              class string is byte-for-byte identical to AppShell.tsx:1165. */}
          <button
            type="button"
            onClick={() => {
              props.onClose();
              props.onOpenAtlasPreview();
            }}
            disabled={props.plan.rows.length === 0 || state === 'in-progress'}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
          >
            <span aria-hidden="true">→ </span>Atlas Preview
          </button>
          {/* Existing state-branched action cluster wrapped at RIGHT. */}
          <div className="flex gap-2">
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
        {/* Phase 22 DIMS-04 — passthrough byte-copies (D-03). Muted treatment
            mirrors Phase 6 D-109 excludedUnused UX. "COPY" indicator label
            identifies these as byte-copies (no Lanczos). Files DO get
            written to outDir — image-worker uses fs.promises.copyFile per
            Plan 22-04.

            Phase 22.1 G-05 — parenthetical text removed from passthrough
            row label. COPY chip alone communicates the byte-copy semantic.

            Phase 22.1 G-06 D-08 — source→target shape parity with resize
            rows. For passthrough, outW === sourceW so the "→ X×Y" repeats
            the source dims; this is intentional (preflight shows the user
            the row WILL become outW×outH at their current override setting;
            if they set a 50% override, the row leaves passthrough via
            plan 22.1-03's G-07 partition and reappears in plan.rows above
            with the resize dim shape).

            CHECKER FIX 2026-05-02 — `row.actualSourceW ?? row.sourceW`
            fallback preserved — still correct under the 22.1-01 unified
            model since both resolve to the same value in atlas-source mode
            (atlas orig === sourceW). */}
        {plan.passthroughCopies.map((row) => {
          // G-06 D-08 (Phase 22.1) — source→target shape parity with resize rows.
          // For passthrough, outW === sourceW so the "→ X×Y" repeats the source dims;
          // this is intentional (preflight shows the user the row WILL become outW×outH
          // at their current override setting; if they set a 50% override, the row
          // leaves passthrough via plan 22.1-03's G-07 partition and reappears in
          // plan.rows above with the resize dim shape).
          // CHECKER FIX 2026-05-02 fallback `row.actualSourceW ?? row.sourceW`
          // preserved — still correct under the 22.1-01 unified model.
          const sourceDimW = row.actualSourceW ?? row.sourceW;
          const sourceDimH = row.actualSourceH ?? row.sourceH;
          return (
            <li key={row.outPath} className="py-1 border-b border-border last:border-0 opacity-60">
              <span className="text-fg-muted">{row.outPath}</span>
              <span className="ml-2 text-fg-muted">
                {sourceDimW}×{sourceDimH} → {row.outW}×{row.outH}
              </span>
              <span className="ml-2 inline-block border border-border rounded-sm px-1 text-[10px] uppercase">
                COPY
              </span>
              {/* G-07 D-07 (Phase 22.1) — cap-binding signal. Rendered as a small
                  muted "(capped)" suffix when ExportRow.isCapped (set by plan 22.1-03's
                  buildExportPlan emit loop when downscaleClampedScale > sourceRatio).
                  Per CONTEXT D-07: "If it's too noisy we can remove it later." */}
              {row.isCapped && (
                <span className="ml-2 text-fg-muted text-[10px]">(capped)</span>
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
        {/* Phase 22 Plan 22-05 — iterate passthroughCopies FIRST then rows in a
            single absolute index space (rowIndex 0..N-1 = passthrough,
            N..total-1 = resize). Matches the image-worker emission order from
            Plan 22-04 Task 2. Passthrough rows render with opacity-60 muted
            treatment + bordered "COPY" chip; their dim label uses
            row.actualSourceW ?? row.sourceW (CHECKER FIX 2026-05-02). */}
        {[...props.plan.passthroughCopies, ...props.plan.rows].map(
          (row, rowIndex) => {
            const isPassthrough =
              rowIndex < props.plan.passthroughCopies.length;
            const status = (props.rowStatuses.get(rowIndex) ?? 'idle') as RowStatus;
            const errMsg = props.rowErrors.get(rowIndex);
            const expanded = props.expandedErrors.has(rowIndex);
            // CHECKER FIX 2026-05-02 — passthrough rows render actualSource
            // dims (cap-aware on-disk dims) NOT canonical sourceW/H.
            const sourceLabel = isPassthrough
              ? `${row.actualSourceW ?? row.sourceW}×${row.actualSourceH ?? row.sourceH}`
              : `${row.sourceW}×${row.sourceH}`;
            // G-05 + G-06 D-08 Phase 22.1 — dimText uses source→target shape for
            // ALL rows (passthrough and resize) for pre-flight label parity.
            // COPY chip communicates byte-copy semantic for passthrough rows.
            const dimText = `${sourceLabel} → ${row.outW}×${row.outH}`;
            return (
              <li
                key={row.outPath}
                className={clsx(
                  'py-1 border-b border-border last:border-0',
                  isPassthrough && 'opacity-60',
                )}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (status === 'error' && errMsg)
                      props.onToggleExpand(rowIndex);
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
                        : isPassthrough
                          ? 'text-fg-muted'
                          : 'text-fg',
                    )}
                  >
                    {row.outPath}
                  </span>
                  <span className="text-fg-muted">{dimText}</span>
                  {isPassthrough && (
                    <span className="ml-2 inline-block border border-border rounded-sm px-1 text-[10px] uppercase">
                      COPY
                    </span>
                  )}
                </button>
                {expanded && errMsg && (
                  <p className="mt-1 ml-5 text-[color:var(--color-danger)]">
                    {errMsg}
                  </p>
                )}
              </li>
            );
          },
        )}
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
