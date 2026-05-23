/**
 * Phase 49 Plan 02 — EXPORT-01 user-facing door for variant export.
 * Phase 51 Plan 02 — EXPORT-04 generalized into a MULTI-ROW scale list (a batch).
 *
 * A clean SINGLE-PANE ARIA modal modeled on OptimizeDialog.tsx. It is the
 * "Export Variant…" action (D-04 — separate from "Optimize Assets"; the shipped
 * Optimize flow is untouched). The dialog reuses OptimizeDialog's config controls
 * (output-mode radio + atlas knobs + safety buffer + sharpen — D-07 full config
 * inheritance).
 *
 * Phase 51 unifies single + batch into THIS ONE dialog (D-04): the scale set is a
 * LIST of rows (each row = the Phase-50 two-way factor↔W↔H control). A 1-row list
 * is a single export (today's behavior); 2+ rows is a batch. The dialog opens with
 * one row at 0.5 (D-03). `+ Add scale` appends a manually-typed row with NO presets
 * (D-01/D-02); per-row remove filters it (disabled at one row — never zero rows,
 * D-03/D-04). `onStart` fires EXACTLY ONE batch IPC call (the
 * exportVariantBatch channel) with `rows.map(r => r.scale)` after the single
 * parent pick + single overwrite decision (D-12 — onConfirmStart reused verbatim).
 * The one active override bucket applies to every scale unchanged (D-13).
 *
 * D-06 DIVERGENCE FLAG: this is a clean SINGLE PANE — NO tabs, NO tab-button
 * import (D-06 OVERTURNS the older 49-D-06/50-D-09 "tabs land at 51" expectation;
 * the multi-row scale list is added in place).
 *
 * D-10 dedup gate: two rows whose scales normalize to the same @{s}x token
 * (tokenFor(0.5) === tokenFor(0.50001) === '0.5') are highlighted and Export is
 * disabled with an inline duplicate-token hint. D-11 invalid gate: Export stays
 * disabled while any row is invalid (blank / non-finite / s <= 0 / s >= 1) — the
 * per-row cheap renderer gate mirrors the single-scale rule. Both are DEFENSE-IN-
 * DEPTH; the authoritative reject is the main-side VariantScaleError per variant.
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a string
 * literal — class strings copied verbatim from OptimizeDialog.tsx / the prior
 * single-scale field.
 *
 * Layer 3 invariant: imports only from react + ../../../shared/types.js + the
 * shared focus-trap hook + the renderer-local variant-scale-derive helpers.
 * NEVER from ../../core/* (tests/arch.spec.ts gate). `tokenFor` is renderer-local
 * (== main's formatScaleToken math) precisely to honor that boundary (T-51-10).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import type {
  BatchVariantResult,
  ExportPlan,
  SkeletonSummary,
} from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';
import {
  displayFactor,
  pxFromScale,
  scaleFromPx,
  tokenFor,
} from './variant-scale-derive';

type DialogState = 'pre-flight' | 'in-progress' | 'complete';

/** A single scale row in the multi-row list (D-01). */
export interface VariantRow {
  id: string;
  scale: number;
}

export interface VariantDialogProps {
  open: boolean;
  /**
   * Display-only plan for the summary tiles (master-sized; the actual
   * s-scaling happens MAIN-side per Plan-01 from `summary` + each `scale`).
   */
  plan: ExportPlan;
  /**
   * The live skeleton summary. Sent over IPC alongside the scales — main builds
   * the s-scaled plan + bakes the JSON from this per scale (Plan-01 RESEARCH A2).
   */
  summary: SkeletonSummary;
  /** The PARENT folder pre-fill (the {NAME}@{s}x/ subfolders are appended main-side). */
  outDir: string | null;
  onClose: () => void;
  /**
   * Picker-only confirm hook. The parent (AppShell) runs the native
   * parent-folder picker (`onConfirmStartVariant`, keyed to variantDialogState)
   * ONCE for the whole run (D-12) and resolves `{ proceed, overwrite?, outDir? }`.
   * D-03/D-12: the pre-existing-target conflict is enforced MAIN-side per folder
   * (Plan-01 source-collision guard + the workers' per-artifact overwrite gates)
   * — NO ConflictDialog in the variant path. When omitted, the dialog starts with
   * `props.outDir` + overwrite=false.
   */
  onConfirmStart?: () => Promise<{
    proceed: boolean;
    overwrite?: boolean;
    outDir?: string | null;
  }>;
  /**
   * Phase 51 D-01/D-03 — the scale set as a list of rows. Each row is the
   * Phase-50 two-way control (factor / target-W / target-H). 1 row = a single
   * export (today's behavior, D-04); 2+ rows = a batch. Opens with one row at
   * 0.5 (D-03). Controlled by AppShell (`variantRows` / `setVariantRows`).
   */
  rows: { id: string; scale: number }[];
  onRowsChange: (rows: { id: string; scale: number }[]) => void;
  /**
   * The mode-aware active override bucket (D-07/D-13 — one bucket for ALL scales).
   * Crosses the IPC as a `[regionName, pct]` entries array (a Map is not
   * structured-clone-able; main reconstructs `new Map(entries)`).
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
  // Phase 51 D-08 — the per-folder results from the batch run. `null` until the
  // run completes (or the WR-02 catch path synthesizes a single failed result).
  const [results, setResults] = useState<BatchVariantResult[] | null>(null);
  // WR-02 catch-path error line (a rejected IPC promise, not an envelope).
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Phase 50 SCALEUI-01 / Phase 51 — which ROW + axis is being actively edited as
  // px, plus the raw string typed into it. Generalizes the single-scale
  // activePxField/activePxRaw to be keyed by row id (Q6). A px input is "active"
  // iff activePx?.rowId === row.id && activePx.field === axis. While active we
  // render its RAW text (not the rounded re-derivation of s) so the edited axis
  // never round-trip-drifts (D-02 / RESEARCH Pitfall 4). Cleared on blur.
  const [activePx, setActivePx] = useState<{
    rowId: string;
    field: 'w' | 'h';
    raw: string;
  } | null>(null);

  const startBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Per-state primary-action focus (mirror OptimizeDialog.tsx:251-256).
  useEffect(() => {
    if (!props.open) return;
    if (state === 'pre-flight') startBtnRef.current?.focus();
    if (state === 'complete') closeBtnRef.current?.focus();
  }, [props.open, state]);

  // D-11 — per-row cheap invalid gate (mirrors the single-scale rule). The
  // authoritative reject stays main-side VariantScaleError.
  const isRowInvalid = (r: VariantRow) =>
    !Number.isFinite(r.scale) || r.scale <= 0 || r.scale >= 1;
  const anyInvalid = props.rows.some(isRowInvalid);

  // D-10 — duplicate-token detection. Group rows by tokenFor(scale); any token
  // shared by >1 row is a collision → those rows highlight + Export disables.
  const tokenCounts = new Map<string, number>();
  for (const r of props.rows) {
    const t = tokenFor(r.scale);
    tokenCounts.set(t, (tokenCounts.get(t) ?? 0) + 1);
  }
  const collidingTokens = new Set(
    [...tokenCounts.entries()].filter(([, n]) => n > 1).map(([t]) => t),
  );
  const hasDuplicate = collidingTokens.size > 0;

  // Combined Start-disabled predicate (D-10 + D-11): block on any invalid row OR
  // any duplicate token. (A 1-row valid list is a single export, D-04.)
  const startDisabled = anyInvalid || hasDuplicate;

  // Phase 51 D-01/D-02/D-03 — row mutators (controlled; AppShell owns the set).
  const addRow = () =>
    props.onRowsChange([
      ...props.rows,
      { id: crypto.randomUUID(), scale: 0.5 },
    ]);
  const removeRow = (id: string) =>
    props.onRowsChange(props.rows.filter((r) => r.id !== id)); // disabled at 1 row
  const setRowScale = (id: string, scale: number) =>
    props.onRowsChange(
      props.rows.map((r) => (r.id === id ? { ...r, scale } : r)),
    );

  // Phase 50 SCALEUI-01 — the setup-pose reference axes from 50-01. Arrives via
  // `summary={summary}` (AppShell.tsx) with ZERO new wiring. `null` = degenerate
  // rig (no textured geometry) → the px fields disable, the factor stays usable.
  // Normalize a missing/falsy field (a non-finite axis or a pre-50-01-shaped
  // summary) to `null` so the degenerate-rig path also covers it (threat
  // T-50-FIN — no Infinity/NaN can reach scaleFromPx). One rig → one setup-pose
  // box, shared across all rows.
  const rawBbox = props.summary.bbox;
  const bbox =
    rawBbox != null &&
    Number.isFinite(rawBbox.w) &&
    Number.isFinite(rawBbox.h) &&
    rawBbox.w > 0 &&
    rawBbox.h > 0
      ? rawBbox
      : null;

  const onStart = useCallback(async () => {
    // Cheap renderer guard (the button is already disabled, but defense-in-depth
    // against an Enter shortcut firing on an invalid/duplicate set, D-10/D-11).
    if (startDisabled) return;

    // Probe-then-confirm — modeled on OptimizeDialog.tsx:271-292. The parent runs
    // the picker-only onConfirmStartVariant ONCE for the run (D-12).
    let overwrite = false;
    let parentDir: string | null = props.outDir;
    if (props.onConfirmStart) {
      const decision = await props.onConfirmStart();
      if (!decision.proceed) return; // user cancelled the picker → stay pre-flight
      overwrite = decision.overwrite === true;
      if (decision.outDir !== undefined) parentDir = decision.outDir;
    }

    // Null-guard the parent dir (mirror OptimizeDialog:303-320). The IPC contract
    // requires a real parent path; AppShell always supplies one before
    // proceed:true, so this is defense-in-depth.
    if (parentDir === null) {
      setResults([
        {
          token: '',
          status: 'failed',
          reason: 'A parent folder must be selected.',
        },
      ]);
      setErrorMessage('A parent folder must be selected.');
      setState('complete');
      return;
    }

    setState('in-progress');
    setErrorMessage(null);
    setResults(null);
    // WR-02: wrap the IPC await in try/catch. After setState('in-progress'), a
    // rejected promise (unexpected main-side throw) would otherwise leave the
    // dialog wedged on "Exporting…" forever — ESC + click-outside are no-ops
    // while in-progress (onCloseSafely), so the user would have no recovery. On
    // rejection, synthesize a single failed result so the complete state renders.
    try {
      // Argument order matches the Plan-01 `Api.exportVariantBatch` signature:
      // (summary, scales[], parentDir, overwrite, sharpenEnabled, outputMode,
      //  atlasOpts, effectiveOverrides[], safetyBufferPercent). D-12 one pick,
      // D-13 one override bucket for every scale.
      const response = await window.api.exportVariantBatch(
        props.summary,
        props.rows.map((r) => r.scale),
        parentDir,
        overwrite,
        props.sharpenOnExport,
        props.outputMode,
        props.atlasOpts,
        Array.from(props.effectiveOverrides.entries()),
        props.safetyBufferPercent,
      );
      setResults(response.results);
    } catch (err) {
      // WR-02: the IPC promise rejected (not an envelope) — synthesize a failure
      // result so the complete state has something to render.
      const message = err instanceof Error ? err.message : String(err);
      setResults([{ token: '', status: 'failed', reason: message }]);
      setErrorMessage(message);
    }
    setState('complete');
  }, [props, startDisabled]);

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
    if (e.key === 'Enter' && state === 'pre-flight' && !startDisabled) onStart();
  };

  if (!props.open) return null;

  // The project name (display only — main owns the canonical token via
  // formatScaleToken; the per-row hint uses the byte-identical renderer-local
  // tokenFor, T-51-10).
  const projectName =
    props.summary.skeletonPath
      .split(/[\\/]/)
      .pop()
      ?.replace(/\.json$/i, '') ?? 'project';

  const isBatch = props.rows.length > 1;
  const headerTitle =
    state === 'complete'
      ? 'Variant export complete'
      : state === 'in-progress'
        ? 'Exporting variants…'
        : props.outDir !== null
          ? `Export Variant${isBatch ? 's' : ''} → ${props.outDir}`
          : `Export Variant${isBatch ? 's' : ''}`;

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

        {/* Phase 51 D-01/D-03/D-06 — the multi-row scale list (single pane, NO
            tabs). Each row is the Phase-50 two-way control (factor / target-W px /
            target-H px), keyed by row.id (Pitfall 6 — NOT array index). The factor
            `s` is the single source of truth the export path consumes (D-02); the
            px fields are views (px = round(s × axis)). Typed px targets are honored
            EXACTLY via scaleFromPx (D-03, no snap); `s` is never rounded — only the
            display is. Over-range (s ≥ 1) is allowed: the per-row D-11 gate
            disables Export + shows the inline hint, the authoritative reject stays
            main-side. Reads props.summary.bbox (50-01) — ZERO new IPC/props.
            Layer-3: NO core/ or formatScaleToken import; the px↔s math is the
            renderer-local variant-scale-derive.ts. */}
        <div className="border border-border rounded-md bg-surface p-3 mb-4">
          <span className="text-xs text-fg-muted mb-2 block">
            Variant scales
          </span>

          {/* Bbox reference line. Display-rounded; the px↔s math below uses the
              UNROUNDED bbox.w/h (display rounding ≠ math rounding). bbox == null
              degrades gracefully. One rig → one shared setup-pose box. */}
          <p className="text-xs text-fg-muted mb-3">
            {bbox !== null
              ? `Setup-pose size: ${Math.round(bbox.w)} × ${Math.round(bbox.h)} px`
              : 'Setup-pose size: unavailable (no textured geometry)'}
          </p>

          {props.rows.map((row, idx) => {
            const rowInvalid = isRowInvalid(row);
            const rowColliding = collidingTokens.has(tokenFor(row.scale));
            const widthActive =
              activePx?.rowId === row.id && activePx.field === 'w';
            const heightActive =
              activePx?.rowId === row.id && activePx.field === 'h';
            return (
              <div
                key={row.id}
                className={
                  rowColliding
                    ? 'border border-[color:var(--color-danger)] rounded-md p-2 mb-2'
                    : 'border border-border rounded-md p-2 mb-2'
                }
              >
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Factor field — the canonical s for this row. */}
                  <label className="flex items-center gap-1 text-xs text-fg cursor-pointer">
                    Factor:
                    <input
                      type="number"
                      data-testid={`variant-factor-${idx}`}
                      step="0.05"
                      min="0"
                      max="0.99"
                      value={displayFactor(row.scale)}
                      onChange={(e) => {
                        const parsed = parseFloat(e.target.value);
                        // Editing the factor clears any active px raw-edit so both
                        // px fields re-derive from the new s.
                        setActivePx(null);
                        setRowScale(
                          row.id,
                          Number.isFinite(parsed) ? parsed : 0,
                        );
                      }}
                      disabled={state === 'in-progress'}
                      title="Variants are scaled-down. Enter a value between 0 and 1 (e.g. 0.5 for half-size)."
                      className="w-20 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-fg-muted">×</span>
                  </label>

                  {/* Target Width field (px). When actively edited, shows the RAW
                      typed string (no round-trip drift, D-02); otherwise
                      pxFromScale(s, w). Disabled (and blank) when bbox is null. The
                      px→s divide is guarded `bbox != null && bbox.w > 0`. */}
                  <label className="flex items-center gap-1 text-xs text-fg cursor-pointer">
                    W:
                    <input
                      type="number"
                      data-testid={`variant-target-width-${idx}`}
                      min={0}
                      step={1}
                      value={
                        bbox === null
                          ? ''
                          : widthActive
                            ? activePx.raw
                            : pxFromScale(row.scale, bbox.w)
                      }
                      onFocus={() => {
                        if (bbox !== null) {
                          setActivePx({
                            rowId: row.id,
                            field: 'w',
                            raw: String(pxFromScale(row.scale, bbox.w)),
                          });
                        }
                      }}
                      onBlur={() => setActivePx(null)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setActivePx({ rowId: row.id, field: 'w', raw });
                        const parsed = parseFloat(raw);
                        if (
                          bbox !== null &&
                          bbox.w > 0 &&
                          Number.isFinite(parsed)
                        ) {
                          setRowScale(row.id, scaleFromPx(parsed, bbox.w));
                        }
                      }}
                      disabled={state === 'in-progress' || bbox === null}
                      title="Target width in pixels. Sets the scale factor exactly (px ÷ setup-pose width); height follows aspect-locked."
                      className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-fg-muted">px</span>
                  </label>

                  {/* Target Height field (px) — symmetric with bbox.h. */}
                  <label className="flex items-center gap-1 text-xs text-fg cursor-pointer">
                    H:
                    <input
                      type="number"
                      data-testid={`variant-target-height-${idx}`}
                      min={0}
                      step={1}
                      value={
                        bbox === null
                          ? ''
                          : heightActive
                            ? activePx.raw
                            : pxFromScale(row.scale, bbox.h)
                      }
                      onFocus={() => {
                        if (bbox !== null) {
                          setActivePx({
                            rowId: row.id,
                            field: 'h',
                            raw: String(pxFromScale(row.scale, bbox.h)),
                          });
                        }
                      }}
                      onBlur={() => setActivePx(null)}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setActivePx({ rowId: row.id, field: 'h', raw });
                        const parsed = parseFloat(raw);
                        if (
                          bbox !== null &&
                          bbox.h > 0 &&
                          Number.isFinite(parsed)
                        ) {
                          setRowScale(row.id, scaleFromPx(parsed, bbox.h));
                        }
                      }}
                      disabled={state === 'in-progress' || bbox === null}
                      title="Target height in pixels. Sets the scale factor exactly (px ÷ setup-pose height); width follows aspect-locked."
                      className="w-16 bg-surface border border-border text-fg px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <span className="text-fg-muted">px</span>
                  </label>

                  {/* Per-row folder hint (the {NAME}@{s}x/ folder for this row). */}
                  <span className="text-xs text-fg-muted">
                    {projectName}@{tokenFor(row.scale)}x
                  </span>

                  {/* Per-row remove (✕). Disabled at one row (never zero rows,
                      D-03/D-04). */}
                  <button
                    type="button"
                    aria-label="Remove scale"
                    data-testid={`variant-remove-${idx}`}
                    onClick={() => removeRow(row.id)}
                    disabled={props.rows.length === 1 || state === 'in-progress'}
                    className="ml-auto border border-border rounded-md px-2 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✕
                  </button>
                </div>

                {rowInvalid && (
                  <p className="mt-1 text-xs text-[color:var(--color-danger)]">
                    Variants are scaled-down — enter a value between 0 and 1.
                  </p>
                )}
              </div>
            );
          })}

          {/* D-01/D-02 — manual add, NO presets. */}
          <button
            type="button"
            onClick={addRow}
            disabled={state === 'in-progress'}
            className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Add scale
          </button>

          {/* D-10 — duplicate-token inline hint. */}
          {hasDuplicate && (
            <p className="mt-2 text-xs text-[color:var(--color-danger)]">
              Two scales produce @{[...collidingTokens][0]}x — remove or change one.
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
            {isBatch
              ? `${props.rows.length} scaled packages are written as sibling folders inside the parent you pick — the source project is never modified.`
              : 'The scaled skeleton + textures are written to a new folder inside the parent you pick — the source project is never modified.'}
          </p>
        )}
        {/* Phase 51 D-08 — per-folder result list + aggregate (Task 2 enriches
            this block). The WR-02 catch path sets errorMessage for a rejected IPC. */}
        {state === 'complete' && results !== null && (
          <div className="text-xs mb-2">
            {errorMessage !== null && (
              <p className="text-[color:var(--color-danger)]">{errorMessage}</p>
            )}
            {results.map((r, i) => (
              <p key={i} className="text-fg-muted">
                {projectName}@{r.token}x/ — {r.status}
              </p>
            ))}
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
                disabled={startDisabled}
                className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50"
              >
                {isBatch ? 'Export Variants' : 'Export Variant'}
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
              {props.outDir !== null && (
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
