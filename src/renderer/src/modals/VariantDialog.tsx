/**
 * Phase 49 Plan 02 — EXPORT-01 user-facing door for single-scale variant export.
 *
 * A clean SINGLE-PANE ARIA modal modeled on OptimizeDialog.tsx. It is the NEW
 * "Export Variant…" action (D-04 — separate from "Optimize Assets"; the shipped
 * Optimize flow is untouched). The dialog reuses OptimizeDialog's config controls
 * (output-mode radio + atlas knobs + safety buffer + sharpen — D-07 full config
 * inheritance) and adds ONE basic numeric scale field (D-05). It invokes the
 * Plan-01 channel `window.api.exportVariant` (already typed on `Api` by Plan 01)
 * after a native parent-folder pick driven by the parent's dedicated picker-only
 * `onConfirmStart` (= AppShell's `onConfirmStartVariant`, keyed to
 * `variantDialogState` — D-03).
 *
 * D-06 DIVERGENCE FLAG: this is a clean SINGLE PANE in Phase 49 — NO tabs, NO
 * tab-button import. The "tab-ready" requirement is satisfied by a structured
 * single-pane layout, NOT a tablist. Phase 50/51 enrich the SAME control
 * (Scale | Output | Batch tabs) in place without rework.
 *
 * 3-state machine + useFocusTrap carry over verbatim from OptimizeDialog.
 *
 * D-08 cheap renderer pre-check: when `props.scale <= 0 || props.scale >= 1` the
 * Export button is disabled + an inline hint shows. This is DEFENSE-IN-DEPTH —
 * the authoritative reject is the Plan-01 main-side VariantScaleError guard. The
 * scaled output lands at `{parentDir}/{NAME}@{s}x/` (main appends the subfolder).
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a string
 * literal — class strings copied verbatim from OptimizeDialog.tsx.
 *
 * Layer 3 invariant: imports only from react + ../../../shared/types.js + the
 * shared focus-trap hook. NEVER from ../../core/* (tests/arch.spec.ts gate).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type {
  ExportPlan,
  ExportResponse,
  ExportSummary,
  SkeletonSummary,
} from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';

type DialogState = 'pre-flight' | 'in-progress' | 'complete';

export interface VariantDialogProps {
  open: boolean;
  /**
   * Display-only plan for the summary tiles (master-sized; the actual
   * s-scaling happens MAIN-side per Plan-01 from `summary` + `scale`).
   */
  plan: ExportPlan;
  /**
   * The live skeleton summary. Sent over IPC alongside `scale` — main builds
   * the s-scaled plan + bakes the JSON from this (Plan-01 RESEARCH A2).
   */
  summary: SkeletonSummary;
  /** The PARENT folder pre-fill (the {NAME}@{s}x/ subfolder is appended main-side). */
  outDir: string | null;
  onClose: () => void;
  /**
   * Picker-only confirm hook. The parent (AppShell) runs the native
   * parent-folder picker (`onConfirmStartVariant`, keyed to variantDialogState)
   * and resolves `{ proceed, overwrite?, outDir? }`. D-03: the pre-existing-
   * target conflict is enforced MAIN-side (Plan-01 source-collision guard + the
   * workers' per-artifact overwrite gates) — NO ConflictDialog in the variant
   * path. When omitted, the dialog starts with `props.outDir` + overwrite=false.
   */
  onConfirmStart?: () => Promise<{
    proceed: boolean;
    overwrite?: boolean;
    outDir?: string | null;
  }>;
  /** D-05 basic numeric scale field (0 < s < 1). */
  scale: number;
  onScaleChange: (n: number) => void;
  /**
   * The mode-aware active override bucket (D-07). Crosses the IPC as a
   * `[regionName, pct]` entries array (a Map is not structured-clone-able;
   * main reconstructs `new Map(entries)`).
   */
  effectiveOverrides: Map<string, number>;
  // --- D-07: the reused OptimizeDialog config controls ---
  sharpenOnExport: boolean;
  onSharpenChange: (v: boolean) => void;
  safetyBufferPercent: number;
  onSafetyBufferChange: (n: number) => void;
  outputMode: 'loose' | 'atlas' | 'both';
  onOutputModeChange: (mode: 'loose' | 'atlas' | 'both') => void;
  atlasOpts: {
    maxPageSize: 1024 | 2048 | 4096 | 8192;
    allowRotation: boolean;
    padding: number;
  };
  onAtlasOptsChange: (opts: VariantDialogProps['atlasOpts']) => void;
}

export function VariantDialog(props: VariantDialogProps) {
  const [state, setState] = useState<DialogState>('pre-flight');
  const [summary, setSummary] = useState<ExportSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Per-state primary-action focus (mirror OptimizeDialog.tsx:251-256).
  useEffect(() => {
    if (!props.open) return;
    if (state === 'pre-flight') startBtnRef.current?.focus();
    if (state === 'complete') closeBtnRef.current?.focus();
  }, [props.open, state]);

  // D-08 cheap renderer pre-check (defense-in-depth; main owns the gate).
  const scaleInvalid =
    !Number.isFinite(props.scale) || props.scale <= 0 || props.scale >= 1;

  const onStart = useCallback(async () => {
    // Cheap renderer guard (the button is already disabled, but defense-in-
    // depth against an Enter shortcut firing on an invalid scale).
    if (!Number.isFinite(props.scale) || props.scale <= 0 || props.scale >= 1) {
      return;
    }

    // Probe-then-confirm — modeled on OptimizeDialog.tsx:271-292. The parent
    // runs the picker-only onConfirmStartVariant (D-03).
    let overwrite = false;
    let parentDir: string | null = props.outDir;
    if (props.onConfirmStart) {
      const decision = await props.onConfirmStart();
      if (!decision.proceed) return; // user cancelled the picker → stay pre-flight
      overwrite = decision.overwrite === true;
      if (decision.outDir !== undefined) parentDir = decision.outDir;
    }

    // Null-guard the parent dir (mirror OptimizeDialog:303-320). The IPC
    // contract requires a real parent path; AppShell always supplies one before
    // proceed:true, so this is defense-in-depth.
    if (parentDir === null) {
      setSummary({
        successes: 0,
        errors: [
          {
            kind: 'write-error',
            path: '',
            message: 'A parent folder must be selected.',
          },
        ],
        outputDir: '',
        durationMs: 0,
        cancelled: false,
      });
      setErrorMessage('A parent folder must be selected.');
      setState('complete');
      return;
    }

    setState('in-progress');
    setErrorMessage(null);
    // WR-02: wrap the IPC await in try/catch. After setState('in-progress'),
    // a rejected promise (unexpected main-side throw) would otherwise leave the
    // dialog wedged on "Exporting…" forever — ESC + click-outside are no-ops
    // while in-progress (onCloseSafely), so the user would have no recovery.
    // On rejection, surface the message + transition to the complete state.
    try {
      // Argument order matches the Plan-01 `Api.exportVariant` signature exactly:
      // (summary, s, parentDir, overwrite, sharpenEnabled, outputMode, atlasOpts,
      //  effectiveOverrides[], safetyBufferPercent).
      const response: ExportResponse = await window.api.exportVariant(
        props.summary,
        props.scale,
        parentDir,
        overwrite,
        props.sharpenOnExport,
        props.outputMode,
        props.atlasOpts,
        Array.from(props.effectiveOverrides.entries()),
        props.safetyBufferPercent,
      );
      if (response.ok) {
        setSummary(response.summary);
        // CR-01: runExport/runRepack do NOT throw on per-row failures (overwrite
        // collisions, missing sources, sharp errors) — they push entries into
        // summary.errors[] and return ok:true. Deciding success purely by
        // !response.ok would render a partial/total failure as success
        // ("0 files exported"). Mirror OptimizeDialog: treat a non-empty errors
        // array as a (partial) failure so the per-row errors surface below.
        setErrorMessage(
          response.summary.errors.length > 0
            ? `${response.summary.successes} exported, ${response.summary.errors.length} failed.`
            : null,
        );
      } else {
        // Surface the typed error message (VariantScaleError / collision /
        // already-running / Unknown).
        setSummary({
          successes: 0,
          errors: [
            {
              kind: 'write-error',
              path: parentDir,
              message: response.error.message,
            },
          ],
          outputDir: parentDir,
          durationMs: 0,
          cancelled: false,
        });
        setErrorMessage(response.error.message);
      }
    } catch (err) {
      // WR-02: the IPC promise rejected (not an envelope) — synthesize a
      // failure summary so the complete state has something to render.
      const message = err instanceof Error ? err.message : String(err);
      setSummary({
        successes: 0,
        errors: [{ kind: 'write-error', path: parentDir, message }],
        outputDir: parentDir,
        durationMs: 0,
        cancelled: false,
      });
      setErrorMessage(message);
    }
    setState('complete');
  }, [props]);

  const onCloseSafely = useCallback(() => {
    // ESC + click-outside no-op while in-progress (mirror OptimizeDialog:367-381).
    if (state === 'in-progress') return;
    props.onClose();
  }, [state, props.onClose]);

  const onOpenOutputFolder = useCallback(() => {
    if (props.outDir !== null) {
      window.api.openOutputFolder(props.outDir);
    }
  }, [props.outDir]);

  useFocusTrap(dialogRef, props.open, {
    onEscape: state === 'in-progress' ? undefined : onCloseSafely,
  });

  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && state === 'pre-flight' && !scaleInvalid) onStart();
  };

  if (!props.open) return null;

  // The {NAME}@{s}x/ folder name the user will get (display only — main owns the
  // canonical token via formatScaleToken; this is best-effort copy).
  const projectName =
    props.summary.skeletonPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.json$/i, '') ?? 'project';
  // WR-03: mirror main's formatScaleToken normalization so the display copy
  // matches the real on-disk folder name. The scale arrives from a
  // `step="0.05"` numeric input whose native step-up accumulates IEEE-754 error
  // (e.g. 0.30000000000000004); a raw `${props.scale}` would render that
  // artifact. Rounding to 4 decimals + re-parsing strips it AND trailing zeros
  // (0.5 → '0.5'). NOTE: kept inline (not imported) — the canonical helper lives
  // in src/main/variant-export.ts, a Node module the Layer-3 renderer must not
  // pull in; this 1-liner is the byte-identical normalization.
  const scaleToken = String(Number(props.scale.toFixed(4)));
  const folderHint = `${projectName}@${scaleToken}x`;

  const headerTitle =
    state === 'complete'
      ? errorMessage === null
        ? `Variant exported — ${projectName}@${scaleToken}x`
        : 'Variant export failed'
      : state === 'in-progress'
        ? `Exporting variant — ${folderHint}`
        : props.outDir !== null
          ? `Export Variant — ${folderHint} → ${props.outDir}`
          : `Export Variant — ${folderHint}`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="variant-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onCloseSafely}
    >
      <div
        className="bg-modal border border-border rounded-md p-6 min-w-[640px] max-w-[800px] max-h-[80vh] flex flex-col font-mono shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="variant-title" className="text-sm text-fg mb-4">
          {headerTitle}
        </h2>

        {/* D-05 — basic numeric scale field. Single labeled input; inline hint
            + disabled Export when out of (0,1). Phase 50 enriches this control
            (px two-way binding) in place — do NOT over-build it now. */}
        <div className="border border-border rounded-md bg-surface p-3 mb-4">
          <span className="text-xs text-fg-muted mb-2 block">Variant scale</span>
          <label
            htmlFor="variant-scale-input"
            className="flex items-center gap-2 text-xs text-fg cursor-pointer"
          >
            Scale:
            <input
              id="variant-scale-input"
              type="number"
              step="0.05"
              min="0"
              max="0.99"
              value={props.scale}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                props.onScaleChange(Number.isFinite(parsed) ? parsed : 0);
              }}
              disabled={state === 'in-progress'}
              title="Variants are scaled-down. Enter a value between 0 and 1 (e.g. 0.5 for half-size)."
              className="w-20 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-fg-muted">× source</span>
          </label>
          {scaleInvalid && (
            <p className="mt-2 text-xs text-[color:var(--color-danger)]">
              Variants are scaled-down — enter a value between 0 and 1.
            </p>
          )}
        </div>

        {/* D-07 — reused Output card (radio group + conditional atlas knobs).
            Markup + class strings copied verbatim from OptimizeDialog.tsx:509-639. */}
        <div className="border border-border rounded-md bg-surface p-3 mb-4">
          <span className="text-xs text-fg-muted mb-2 block">Output</span>
          <div
            role="radiogroup"
            aria-label="Output mode"
            className="flex items-center gap-3 mb-2 text-xs text-fg"
          >
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="variant-output-mode"
                value="loose"
                checked={props.outputMode === 'loose'}
                onChange={() => props.onOutputModeChange('loose')}
                disabled={state === 'in-progress'}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              Loose PNGs
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="variant-output-mode"
                value="atlas"
                checked={props.outputMode === 'atlas'}
                onChange={() => props.onOutputModeChange('atlas')}
                disabled={state === 'in-progress'}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              Atlas
            </label>
            <label className="flex items-center gap-1 cursor-pointer">
              <input
                type="radio"
                name="variant-output-mode"
                value="both"
                checked={props.outputMode === 'both'}
                onChange={() => props.onOutputModeChange('both')}
                disabled={state === 'in-progress'}
                className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
              />
              Both
            </label>
          </div>
          {props.outputMode !== 'loose' && (
            <div className="flex flex-col gap-2 mt-2">
              <label
                htmlFor="variant-atlas-max-page-size"
                className="flex items-center gap-2 text-xs text-fg cursor-pointer"
              >
                Max page size:
                <select
                  id="variant-atlas-max-page-size"
                  value={props.atlasOpts.maxPageSize}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (v === 1024 || v === 2048 || v === 4096 || v === 8192) {
                      props.onAtlasOptsChange({ ...props.atlasOpts, maxPageSize: v });
                    }
                  }}
                  disabled={state === 'in-progress'}
                  className="bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value={1024}>1024</option>
                  <option value={2048}>2048</option>
                  <option value={4096}>4096</option>
                  <option value={8192}>8192</option>
                </select>
                <span className="text-fg-muted">px</span>
              </label>

              <label
                htmlFor="variant-atlas-allow-rotation-toggle"
                title="Packer may rotate regions 90° for tighter packing."
                className="flex items-center gap-2 text-xs text-fg cursor-pointer"
              >
                <input
                  id="variant-atlas-allow-rotation-toggle"
                  type="checkbox"
                  checked={props.atlasOpts.allowRotation}
                  onChange={(e) =>
                    props.onAtlasOptsChange({
                      ...props.atlasOpts,
                      allowRotation: e.target.checked,
                    })
                  }
                  disabled={state === 'in-progress'}
                  title="Packer may rotate regions 90° for tighter packing."
                  className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                />
                Allow rotation
              </label>

              <label
                htmlFor="variant-atlas-padding-input"
                className="flex items-center gap-2 text-xs text-fg cursor-pointer"
              >
                Padding:
                <input
                  id="variant-atlas-padding-input"
                  type="number"
                  min={0}
                  max={16}
                  step={1}
                  value={props.atlasOpts.padding}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value, 10);
                    if (!Number.isFinite(parsed)) {
                      props.onAtlasOptsChange({ ...props.atlasOpts, padding: 0 });
                      return;
                    }
                    const clamped = Math.max(0, Math.min(16, parsed));
                    props.onAtlasOptsChange({ ...props.atlasOpts, padding: clamped });
                  }}
                  disabled={state === 'in-progress'}
                  title="Inter-region gap on the packed atlas page."
                  className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-fg-muted">px</span>
              </label>
            </div>
          )}
        </div>

        {/* D-07 — reused Quality card (safety buffer + sharpen). Markup + class
            strings copied verbatim from OptimizeDialog.tsx:645-698. */}
        <div className="border border-border rounded-md bg-surface p-3 mb-4">
          <span className="text-xs text-fg-muted mb-2 block">Quality</span>
          <label
            htmlFor="variant-safety-buffer-input"
            className="flex items-center gap-2 mb-2 text-xs text-fg cursor-pointer"
          >
            Safety buffer:
            <input
              id="variant-safety-buffer-input"
              type="number"
              min={0}
              max={25}
              step={1}
              value={props.safetyBufferPercent}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                if (!Number.isFinite(parsed)) {
                  props.onSafetyBufferChange(0);
                  return;
                }
                const clamped = Math.max(0, Math.min(25, parsed));
                props.onSafetyBufferChange(clamped);
              }}
              disabled={state === 'in-progress'}
              title="Multiplicatively grows every row's effective scale. Capped at source dimensions — textures never extrapolate."
              className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <span className="text-fg-muted">%</span>
          </label>
          <label
            htmlFor="variant-sharpen-on-export-toggle"
            className="flex items-center gap-2 text-xs text-fg cursor-pointer"
          >
            <input
              id="variant-sharpen-on-export-toggle"
              type="checkbox"
              checked={props.sharpenOnExport}
              onChange={(e) => props.onSharpenChange(e.target.checked)}
              disabled={state === 'in-progress'}
              className="cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            />
            Sharpen output on downscale
          </label>
        </div>

        {/* Body branches — pre-flight summary + state-specific copy. Single pane,
            no tabs (D-06). */}
        {state === 'pre-flight' && (
          <p className="text-xs text-fg-muted mb-2">
            The scaled skeleton + textures are written to a new{' '}
            <span className="text-fg">{folderHint}/</span> folder inside the
            parent you pick — the source project is never modified.
          </p>
        )}
        {state === 'complete' && summary !== null && (
          <div className="text-xs mb-2">
            {errorMessage === null ? (
              <p className="text-fg-muted">
                Variant written to{' '}
                <span className="text-fg">{folderHint}/</span> —{' '}
                {summary.successes} file{summary.successes === 1 ? '' : 's'}{' '}
                exported.
              </p>
            ) : (
              <p className="text-[color:var(--color-danger)]">{errorMessage}</p>
            )}
            {/* CR-01: surface per-row worker failures (overwrite collisions,
                missing sources, sharp errors) the same way OptimizeDialog does
                (OptimizeDialog.tsx:1003-1028). Without this list a partial
                failure (ok:true + non-empty errors[]) showed as success. The
                summary line gives the succeeded/failed counts; the list gives
                the per-file path + reason. Both render only when errors exist. */}
            {summary.errors.length > 0 && (
              <>
                <p className="mt-1 text-fg-muted">
                  {summary.successes} succeeded, {summary.errors.length} failed.
                </p>
                <ul className="mt-1 text-[color:var(--color-danger)]">
                  {summary.errors.map((err, i) => (
                    <li key={i}>
                      {err.path ? `${err.path}: ` : ''}
                      {err.message}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
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
                disabled={scaleInvalid}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                Export Variant
              </button>
            </>
          )}
          {state === 'in-progress' && (
            <button
              type="button"
              disabled
              className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
            >
              Exporting…
            </button>
          )}
          {state === 'complete' && (
            <>
              {errorMessage === null && props.outDir !== null && (
                <button
                  type="button"
                  onClick={onOpenOutputFolder}
                  className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg"
                >
                  Open output folder
                </button>
              )}
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
