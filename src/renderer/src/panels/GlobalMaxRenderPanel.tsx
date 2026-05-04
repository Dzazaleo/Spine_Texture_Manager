/**
 * Phase 2 Plan 02 — Global-max render source panel.
 *
 * Sortable (F3.1), searchable (F3.2), selectable (F3.3) table over
 * DisplayRow[] from IPC. Drop-in replacement for the Phase 1 debug surface
 * (Plan 02-03 flips App.tsx).
 *
 * State management: plain useState per D-32 (Phase 1 D-20 reaffirmed for
 * Phase 2 — no Zustand, no Jotai, no Context). Re-evaluate when Phase 4
 * overrides or Phase 8 save/load introduce cross-panel or persisted state.
 *
 * A11y (W-01 compliance): per-row checkbox single-toggle lives on native
 * <input> onChange so Space and Enter keyboard activation work
 * out-of-the-box per the WAI-ARIA Table pattern. Shift-click range-select
 * lifts onto the wrapping <label> onClick handler, which captures the
 * shiftKey modifier from the mouse event. Keyboard-only users get single-
 * toggle (matches VS Code / Finder conventions); range-select is explicitly
 * mouse-driven.
 *
 * Phase 4 Plan 03 extension: Scale cell + Peak W×H cell render override-aware
 * values when `overrides.has(row.attachmentName)` per D-82 / D-83. Scale
 * `<td>` gets `onDoubleClick` that calls `onOpenOverrideDialog(row, ...)`
 * per D-77. A new module-top helper `enrichWithEffective` derives
 * effective-scale / effective-dim fields BEFORE the filter + sort chain; the
 * existing `compareRows` comparator reads `effectiveScale` in the peakScale
 * branch so 50%-overridden high-peak rows sort correctly against 100%-kept
 * lower-peak rows. Layer 3: `applyOverride` is imported from the renderer-side
 * overrides-view module, never from the pure-TS math tree — the latter would
 * trip the arch.spec.ts gate. Event-propagation: `onDoubleClick` on the Scale
 * `<td>` is orthogonal to the Phase 2 checkbox click-chain because Scale and
 * checkbox are sibling `<td>` cells in the same `<tr>` — events don't share
 * handler context (verified by the acceptance criterion that shift-double-
 * clicking the Scale cell does not toggle selection).
 *
 * Phase 4 Plan 03 gap-fixes (human-verify 2026-04-24):
 *   - Gap A: selection set is converted from attachmentKey identities to
 *     attachmentName identities at the dialog invocation site (the outbound
 *     onOpenOverrideDialog contract uses attachmentName; this panel's
 *     internal React row key remains attachmentKey). Without the
 *     conversion, AppShell's `selectedKeys.has(row.attachmentName)` check
 *     always misses and batch scope silently collapses to the clicked row.
 *     See 04-03-SUMMARY.md §Deviations for the verbatim user quote.
 *   - Gap B: applyOverride is called with the single-arg signature
 *     (overridePercent) — effective scale = percent / 100. Non-overridden
 *     rows still show peakScale; peak is no longer threaded through the
 *     math.
 *   - Gap C: default sort changed to (attachmentName, asc) so the animator
 *     never loses the just-edited row off-screen in a long list.
 */
import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  type MouseEvent,
  type ChangeEvent,
  type ReactNode,
  type MutableRefObject,
  type CSSProperties,
} from 'react';
import clsx from 'clsx';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { SkeletonSummary, DisplayRow } from '../../../shared/types.js';
import { computeExportDims, safeScale } from '../lib/export-view.js';
import { formatBytes } from '../lib/format-bytes';
import { DimsBadge } from '../components/DimsBadge.js';

/**
 * Phase 9 Plan 03 — Threshold for switching from flat-table render to
 * TanStack Virtual (D-191 + D-195). Below ≤100 rows: flat-table preserves
 * Cmd-F text search and pays zero virtualization overhead (SIMPLE_PROJECT,
 * Jokerman). Above 100: useVirtualizer kicks in for `fixtures/Girl` and
 * future production rigs.
 */
const VIRTUALIZATION_THRESHOLD = 100;

type SortCol =
  | 'attachmentName'
  | 'skinName'
  | 'sourceW'
  | 'worldW'
  | 'peakScale'
  | 'animationName'
  | 'frame';
type SortDir = 'asc' | 'desc';

/**
 * Phase 4 Plan 03: effective-scale-enriched row. Added fields are strictly
 * renderer-side — src/shared/types.ts is NOT extended (discretion option A
 * from pattern-mapper flag 4).
 *
 * Round 5 (2026-04-25): the effective-dim fields now hold the EXPORT dims
 * (Math.ceil(sourceDim × ceil-thousandth-effScale), clamped ≤ source) — NOT
 * the world-AABB. This makes the panel's "Peak W×H" column match the
 * optimize dialog and the on-disk exported PNG dims byte-for-byte.
 *
 * effExportW/effExportH replace the legacy effectiveWorldW/H names so the
 * semantic shift is explicit at every read site.
 */
type EnrichedRow = DisplayRow & {
  effectiveScale: number;
  effExportW: number;
  effExportH: number;
  /** undefined when no override; else the clamped integer percent. */
  override: number | undefined;
};

export interface GlobalMaxRenderPanelProps {
  summary: SkeletonSummary;
  /**
   * Phase 3 Plan 02 (D-72): clicking the Source Animation chip fires this
   * callback with `row.sourceLabel` — either the animation name or the
   * canonical static-pose label. Setting the prop upgrades the chip to an
   * interactive <button>; when undefined, the chip stays a non-interactive
   * <span> so the panel remains usable outside the top-tab shell.
   */
  onJumpToAnimation?: (animationName: string) => void;
  /**
   * Phase 4 Plan 02: override-aware render + dialog trigger. AppShell passes
   * its overrides map + dialog-open callback; panel body wiring lands in
   * Plan 04-03. Optional today so this plan's AppShell changes typecheck.
   */
  overrides?: ReadonlyMap<string, number>;
  onOpenOverrideDialog?: (
    row: DisplayRow,
    selectedKeys?: ReadonlySet<string>,
  ) => void;
  /**
   * Phase 7 D-130: Atlas Preview dblclick → AppShell sets this; panel scrolls
   * the matching row into view + flashes it for 900ms, then calls
   * onFocusConsumed() synchronously so AppShell clears the focus state on
   * the same tick (RESEARCH Pitfall 5 — re-mount leak prevention; carry-over
   * from Phase 3 D-66). Optional today so other callers of this panel
   * (standalone tests, future surfaces) typecheck without these props.
   */
  focusAttachmentName?: string | null;
  onFocusConsumed?: () => void;
  /**
   * Phase 19 UI-01 + D-04 — REQUIRED props for the lifted SearchBar query
   * state (tightened from interim OPTIONAL set by Plan 19-03). AppShell owns
   * the source of truth (single sticky-bar SearchBar drives both panels);
   * the panel-internal useState('') slot and panel-internal SearchBar
   * element are removed in Plan 19-04.
   */
  query: string;
  onQueryChange: (q: string) => void;
  /**
   * Phase 22.1 G-01 D-02 — loader mode for the dims-mismatch badge tooltip
   * wording. 'auto' resolves to atlas-source variant; 'atlas-less' to
   * PNG-source variant. Threaded from AppShell.tsx (already in scope there
   * via the loaderMode state at line 273).
   */
  loaderMode: 'auto' | 'atlas-less';
  /**
   * Phase 24 OPT-03 (D-08, D-09, D-10) — Pixel-area savings % chip in the
   * section header. Computed by AppShell.tsx:702-712 (savingsPctMemo) via
   * buildExportPlan. Null when the export plan is empty (no attachments);
   * chip is hidden when null or 0 (D-11 chip-hidden policy).
   */
  savingsPct?: number | null;
}

// ----- Pure helpers (module-top) -----------------------------------------

/**
 * Phase 19 UI-02 + D-06 — Row state predicate. Drives the row left-accent
 * bar (UI-SPEC §5) and the tinted ratio cell. The "ratio" the spec refers
 * to is the effective render scale (1.0× = source size, < 1.0× = under-
 * rendered / could be downscaled, > 1.0× = over-rendered / source too small).
 */
type RowState = 'under' | 'over' | 'unused' | 'neutral' | 'missing';

function rowState(peakRatio: number, isUnused: boolean, isMissing?: boolean): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakRatio < 1.0) return 'under';
  if (peakRatio > 1.0) return 'over';
  return 'neutral';
}

/** Phase 4 Plan 03: shared empty-map fallback so default-prop consumers don't
 *  allocate a fresh Map on every render. */
const EMPTY_OVERRIDES: ReadonlyMap<string, number> = new Map();
/** Phase 4 Plan 03: no-op default for the open-dialog callback when the panel
 *  is rendered standalone (outside AppShell). */
const NOOP_OPEN_DIALOG: (
  row: DisplayRow,
  selectedKeys?: ReadonlySet<string>,
) => void = () => undefined;

/**
 * Phase 4 Plan 03 + Round 5 (2026-04-25): enrich raw DisplayRow[] with
 * render-time effective fields. Now uses the renderer-side computeExportDims
 * helper (single source of truth shared with OptimizeDialog), so the panel's
 * "Peak W×H" column shows the EXPORT dims — Math.ceil(sourceDim ×
 * ceil-thousandth-effScale, clamped ≤ source) — instead of the world-AABB.
 *
 * The world-AABB (worldW/worldH from the sampler) is preserved on the raw
 * DisplayRow fields and surfaced via the cell's hover tooltip for power users.
 */
function enrichWithEffective(
  rows: readonly DisplayRow[],
  overrides: ReadonlyMap<string, number>,
): EnrichedRow[] {
  return rows.map((row) => {
    const override = overrides.get(row.attachmentName);
    // Phase 22 DIMS-03 (Plan 22-04) — pass actualSourceW/H + dimsMismatch
    // through so the panel's Peak W×H column reflects cap math (drifted rows
    // show on-disk dims, NOT pre-cap canonical × peakScale). Without these,
    // the panel would lie to the user about what the export will actually
    // produce when the cap binds.
    const { effScale, outW, outH } = computeExportDims(
      row.sourceW,
      row.sourceH,
      row.peakScale,
      override,
      row.actualSourceW,
      row.actualSourceH,
      row.dimsMismatch,
      row.canonicalW,
      row.canonicalH,
    );
    return {
      ...row,
      effectiveScale: effScale,
      effExportW: outW,
      effExportH: outH,
      override,
    };
  });
}

function filterByName(rows: readonly EnrichedRow[], query: string): EnrichedRow[] {
  const q = query.trim().toLowerCase();
  if (q === '') return rows.slice();
  return rows.filter((r) => r.attachmentName.toLowerCase().includes(q));
}

function compareRows(a: EnrichedRow, b: EnrichedRow, col: SortCol): number {
  switch (col) {
    case 'attachmentName':
      return a.attachmentName.localeCompare(b.attachmentName);
    case 'skinName':
      return a.skinName.localeCompare(b.skinName);
    case 'animationName':
      return a.animationName.localeCompare(b.animationName);
    case 'sourceW':
      return a.sourceW - b.sourceW;
    case 'worldW':
      // D-83 (Round 5 2026-04-25): Peak W×H sort reads the EXPORT dim
      // (effExportW) so the displayed ordering matches the visible Peak
      // W×H column — which now shows export dims, not the world-AABB.
      return a.effExportW - b.effExportW;
    case 'peakScale':
      // Phase 4 pattern-mapper flag 3: comparator reads EFFECTIVE scale so
      // 50%-overridden high-peak rows sort correctly against 100%-kept
      // lower-peak rows.
      return a.effectiveScale - b.effectiveScale;
    case 'frame':
      return a.frame - b.frame;
  }
}

function sortRows(rows: readonly EnrichedRow[], col: SortCol, dir: SortDir): EnrichedRow[] {
  const sorted = rows.slice().sort((a, b) => compareRows(a, b, col));
  if (dir === 'desc') sorted.reverse();
  return sorted;
}

// D-40 match-highlight: React fragments + <mark>, no HTML parsing. XSS-safe
// per T-02-02-01 (all user-supplied strings render as React text nodes).
function highlightMatch(name: string, query: string): ReactNode {
  const q = query.trim();
  if (q === '') return name;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return name;
  const before = name.slice(0, idx);
  const match = name.slice(idx, idx + q.length);
  const after = name.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className="bg-accent/20 text-accent rounded-sm px-0.5">{match}</mark>
      {after}
    </>
  );
}

// ----- SortHeader sub-component ------------------------------------------

interface SortHeaderProps {
  col: SortCol;
  label: string;
  activeCol: SortCol;
  dir: SortDir;
  onSort: (col: SortCol) => void;
  align?: 'left' | 'right';
}

function SortHeader({ col, label, activeCol, dir, onSort, align = 'left' }: SortHeaderProps) {
  const isActive = col === activeCol;
  const ariaSort = isActive ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const arrow = !isActive ? '▲' : dir === 'asc' ? '▲' : '▼';
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={clsx(
        'py-2 px-3 font-mono text-xs font-semibold border-b border-border',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={clsx(
          'inline-flex items-center gap-1 hover:text-accent focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
          isActive ? 'text-accent' : 'text-fg',
        )}
      >
        <span>{label}</span>
        <span className={clsx(isActive ? 'text-accent' : 'text-fg-muted')}>{arrow}</span>
      </button>
    </th>
  );
}

// ----- Row sub-component (W-01 a11y-safe handler split) ------------------

interface RowProps {
  row: EnrichedRow;
  query: string;
  checked: boolean;
  onToggle: (key: string) => void;
  onRangeToggle: (key: string) => void;
  suppressNextChangeRef: MutableRefObject<string | null>;
  /** Phase 3 D-72 — see GlobalMaxRenderPanelProps.onJumpToAnimation. */
  onJumpToAnimation?: (animationName: string) => void;
  /** Phase 4 D-77 + D-86 dialog trigger. */
  onOpenOverrideDialog: (row: DisplayRow, selectedKeys: ReadonlySet<string>) => void;
  /** Phase 4 D-86 — live selection set passed through for batch detection in AppShell. */
  selectedKeys: ReadonlySet<string>;
  /** Phase 7 D-130: true while this row is the jump-target flash subject (900ms). */
  isFlashing: boolean;
  /** Phase 7 D-130: ref-registration callback so the panel can scroll this row into view. */
  registerRef: (el: HTMLElement | null) => void;
  /**
   * Phase 9 Plan 03: virtualizer transform style. The virtualized render
   * path applies `transform: translateY(...)` to position rows over the
   * total-height spacer; below-threshold flat-table render leaves it
   * undefined and the row sits at its natural position.
   */
  style?: CSSProperties;
  /**
   * Phase 19 UI-02 + D-06 — row state for left-accent bar + tinted ratio
   * cell. Computed per-row in the parent via rowState(effectiveScale, isUnused).
   */
  state: RowState;
  /**
   * Phase 22.1 G-01 D-02 — loader mode for DimsBadge tooltip wording.
   * Threaded from panel-level prop to row-level so DimsBadge receives it.
   */
  loaderMode: 'auto' | 'atlas-less';
}

function Row({
  row,
  query,
  checked,
  onToggle,
  onRangeToggle,
  suppressNextChangeRef,
  onJumpToAnimation,
  onOpenOverrideDialog,
  selectedKeys,
  isFlashing,
  registerRef,
  style,
  state,
  loaderMode,
}: RowProps) {
  const handleLabelClick = useCallback(
    (e: MouseEvent<HTMLLabelElement>) => {
      if (e.shiftKey) {
        // Shift-click: pre-empt the native onChange single-toggle, run range-select
        // instead. The suppressNextChangeRef is read by handleChange below; when it
        // matches this row's key, handleChange returns early so the single-toggle
        // does not stomp the range state.
        suppressNextChangeRef.current = row.attachmentKey;
        onRangeToggle(row.attachmentKey);
      }
      // Plain click falls through: the label click propagates to the input, which
      // fires onChange, and handleChange performs the single-toggle. shiftKey=false
      // means no suppression flag is set.
    },
    [onRangeToggle, row.attachmentKey, suppressNextChangeRef],
  );

  const handleChange = useCallback(
    (_e: ChangeEvent<HTMLInputElement>) => {
      if (suppressNextChangeRef.current === row.attachmentKey) {
        // Shift-click path already set the range state; skip the single-toggle.
        suppressNextChangeRef.current = null;
        return;
      }
      onToggle(row.attachmentKey);
    },
    [onToggle, row.attachmentKey, suppressNextChangeRef],
  );

  return (
    <tr
      ref={(el) => registerRef(el)}
      style={style}
      className={clsx(
        'border-b border-border hover:bg-accent/5',
        checked && 'bg-accent/5',
        // Phase 7 D-130: flash highlight — same Tailwind ring pattern as
        // AnimationBreakdownPanel.tsx line 407.
        isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
        // Phase 26.1 D-06 + D-10 — danger tint takes priority over zebra for missing rows.
        state === 'missing' ? 'bg-danger/10' : 'even:bg-white/[0.03]',
      )}
    >
      {/* Phase 19 UI-02 + D-06 — row state-color left-accent bar (UI-SPEC §5).
          Mirrors the existing banner pattern at AppShell.tsx:1227 / 1258.
          clsx with literal-class branches per Tailwind v4 discipline. */}
      <td className="w-1 p-0">
        <span
          className={clsx(
            'inline-block w-1 h-full',
            state === 'under' && 'bg-success',
            state === 'over' && 'bg-warning',
            state === 'unused' && 'bg-danger',
            state === 'missing' && 'bg-danger',
            state === 'neutral' && 'bg-transparent',
          )}
          aria-hidden="true"
        />
      </td>
      <td className="py-2 px-3">
        {/* Wrapping label: onClick captures shiftKey for range selection (mouse-only).
            The nested <input> onChange fires on plain click AND on Space/Enter keyboard
            activation — keyboard accessibility preserved per WAI-ARIA Table pattern. */}
        <label onClick={handleLabelClick} className="inline-flex cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            aria-label={'Select ' + row.attachmentName}
            onChange={handleChange}
          />
        </label>
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg">
        {row.isMissing && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 text-danger mr-1 flex-shrink-0"
            aria-label="Missing PNG"
          >
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path d="M8 1.5 L14.5 13.5 H1.5 Z" />
            </svg>
          </span>
        )}
        {highlightMatch(row.attachmentName, query)}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg-muted">{row.skinName}</td>
      <td className="py-2 px-3 font-mono text-sm text-fg text-right">
        {row.originalSizeLabel}
        {/* Phase 22.1 G-02 + G-03 + G-01 D-02 — DimsBadge replaces the
            native HTML `title` attribute (G-02: fires once-per-session due
            to small hit-area + virtualizer remount + browser-idle-trigger).
            Custom React-managed tooltip primitive surfaces on every hover.
            Mode-aware wording (G-01 D-02) + cap-binding-aware second sentence
            (G-03). Sibling symmetry (Phase 19 D-06) enforced by sharing the
            DimsBadge component with AnimationBreakdownPanel. */}
        {/* Phase 22.1 G-03: pass the pre-sourceRatio-cap scale to DimsBadge
            so deriveIsCapped can detect whether the cap binds. The panel's
            row.effectiveScale is the POST-cap value (min(downscaleClamped,
            sourceRatio)); for cap-binding detection we need the uncapped
            downscale-clamped scale. */}
        <DimsBadge
          row={row}
          effectiveScale={Math.min(safeScale(
            row.override !== undefined ? row.override / 100 : row.peakScale
          ), 1.0)}
          loaderMode={loaderMode}
        />
      </td>
      {/* Peak W×H column (Round 5 2026-04-25): shows the EXPORT dims that
          buildExportPlan + the optimize dialog use, NOT the world-AABB.
          Hover tooltip surfaces the world-AABB for power users (rotation /
          mesh-deformation diagnostic). Override path: same export dims,
          just driven by the override percent through computeExportDims. */}
      <td
        className={clsx(
          'py-2 px-3 font-mono text-sm text-right',
          row.override !== undefined ? 'text-accent' : 'text-fg',
        )}
        title={`World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)}`}
      >
        {`${row.effExportW}×${row.effExportH}`}
      </td>
      {/* Phase 19 UI-02 + D-06 — tinted ratio cell (UI-SPEC §5). State color
          trumps the prior override-aware text-accent here per the deliberate
          D-06 visual unification (the override percent badge below still
          surfaces the override signal). clsx literal branches per Tailwind v4
          discipline (no template-string interpolation). */}
      <td
        className={clsx(
          'py-2 px-3 font-mono text-sm text-right',
          state === 'under' && 'bg-success/10 text-success',
          state === 'over' && 'bg-warning/10 text-warning',
          state === 'unused' && 'bg-danger/10 text-danger',
          state === 'missing' && 'bg-danger/10 text-danger',
          state === 'neutral' && 'text-fg',
        )}
        onDoubleClick={() => onOpenOverrideDialog(row, selectedKeys)}
        title={
          row.override !== undefined
            ? `${row.override}% of source = ${row.effectiveScale.toFixed(3)}×`
            : undefined
        }
      >
        {row.effectiveScale.toFixed(3)}×
        {row.override !== undefined && <span> • {row.override}%</span>}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg">
        {onJumpToAnimation !== undefined ? (
          <button
            type="button"
            onClick={() => onJumpToAnimation(row.sourceLabel)}
            aria-label={`Jump to ${row.sourceLabel} in Animation Breakdown`}
            className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg cursor-pointer hover:bg-accent/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            {row.sourceLabel}
          </button>
        ) : (
          <span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono">
            {row.sourceLabel}
          </span>
        )}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg-muted text-right">{row.frameLabel}</td>
    </tr>
  );
}

// ----- SelectAllCheckbox sub-component (tri-state) -----------------------

interface SelectAllProps {
  visibleKeys: readonly string[];
  selected: ReadonlySet<string>;
  onBulk: (next: Set<string>) => void;
}

function SelectAllCheckbox({ visibleKeys, selected, onBulk }: SelectAllProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  const visibleSelectedCount = visibleKeys.reduce(
    (acc, k) => acc + (selected.has(k) ? 1 : 0),
    0,
  );
  const allChecked = visibleKeys.length > 0 && visibleSelectedCount === visibleKeys.length;
  const someChecked = visibleSelectedCount > 0 && !allChecked;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = someChecked;
  }, [someChecked]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={allChecked}
      aria-label="Select all visible rows"
      onChange={(e) => {
        const next = new Set(selected);
        if (e.target.checked) {
          for (const k of visibleKeys) next.add(k);
        } else {
          for (const k of visibleKeys) next.delete(k);
        }
        onBulk(next);
      }}
    />
  );
}

// ----- Main component ----------------------------------------------------

export function GlobalMaxRenderPanel({
  summary,
  onJumpToAnimation,
  overrides,
  onOpenOverrideDialog,
  focusAttachmentName,
  onFocusConsumed,
  query,
  onQueryChange,
  loaderMode,
  savingsPct,
}: GlobalMaxRenderPanelProps) {
  // Phase 4 Plan 03: default-prop shims so the panel stays usable standalone
  // (AppShell always passes non-null values).
  const overridesMap: ReadonlyMap<string, number> = overrides ?? EMPTY_OVERRIDES;
  const openDialog = onOpenOverrideDialog ?? NOOP_OPEN_DIALOG;

  // Phase 19 UI-01 + D-04 — query state lifted to AppShell (single sticky-bar
  // SearchBar drives the panel via props.query + props.onQueryChange).
  // Panel-internal useState('') slot REMOVED in Plan 19-04.
  // Gap-fix C (human-verify 2026-04-24): default sort is (attachmentName, asc)
  // so the just-edited row stays visible in a long list. Supersedes the
  // Phase 2 D-29 default (peakScale desc).
  const [sortCol, setSortCol] = useState<SortCol>('attachmentName');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  // W-01 shift-click suppression flag: when the label onClick sees shiftKey and
  // runs range-select, it writes the clicked row's key here; the subsequent
  // native onChange on that input reads the flag and returns early so the
  // single-toggle does not undo the range state.
  const suppressNextChangeRef = useRef<string | null>(null);

  // Phase 7 D-130 — keyed by row.attachmentName (NOT attachmentKey or cardId
  // — the modal hits via attachmentName, since that's the identity AtlasPage
  // regions carry from buildAtlasPreview).
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const registerRowRef = useCallback((name: string, el: HTMLElement | null) => {
    if (el === null) rowRefs.current.delete(name);
    else rowRefs.current.set(name, el);
  }, []);

  const [isFlashing, setIsFlashing] = useState<string | null>(null);

  // Phase 7 D-130 jump-effect: scroll + flash; SYNCHRONOUSLY fire the
  // consume callback so the focus can never leak across re-mounts
  // (RESEARCH §Pitfall 5 — Phase 3 D-66 carry-over). Cloned 1:1 from
  // AnimationBreakdownPanel.tsx:299-325 with these adaptations:
  //   - Key by attachmentName directly (no setup-pose / anim: prefix derivation).
  //   - Scroll block: 'center' (table rows are shorter than animation cards;
  //     'start' would clip cells with overflowing content like the override
  //     percentage badge or long bone-path tooltip).
  useEffect(() => {
    if (!focusAttachmentName) return;
    setIsFlashing(focusAttachmentName);
    const el = rowRefs.current.get(focusAttachmentName);
    if (el !== undefined) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    onFocusConsumed?.();   // SYNCHRONOUS — no setTimeout/RAF (Pitfall 5)
    const timer = setTimeout(() => setIsFlashing(null), 900);
    return () => clearTimeout(timer);
  }, [focusAttachmentName, onFocusConsumed]);

  // Phase 4 Plan 03 + Round 5: enrichment runs BEFORE filter + sort so the
  // comparator reads .effectiveScale / .effExportW (Round 5: export dims,
  // not world-AABB) without other restructuring (pattern-mapper flag 3).
  const enriched = useMemo(
    () => enrichWithEffective(summary.peaks, overridesMap),
    [summary.peaks, overridesMap],
  );
  const filtered = useMemo(
    () => filterByName(enriched, query),
    [enriched, query],
  );
  const sorted = useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir],
  );
  const visibleKeys = useMemo(() => sorted.map((r) => r.attachmentKey), [sorted]);


  // Gap-fix A (human-verify 2026-04-24): convert the internal attachmentKey
  // selection to the outbound attachmentName contract BEFORE handing the set
  // to onOpenOverrideDialog. AppShell's batch-scope check
  // (selectedKeys.has(row.attachmentName)) requires attachmentName values;
  // passing raw `selected` (attachmentKey strings) silently collapses batch
  // scope to the clicked row. Lookup key→name via the enriched row list
  // (attachmentKey is unique per row so the map yields one name per key).
  // See 04-03-SUMMARY.md §Deviations for the verbatim user quote.
  const keyToName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of enriched) m.set(r.attachmentKey, r.attachmentName);
    return m;
  }, [enriched]);
  const selectedAttachmentNames = useMemo(() => {
    const names = new Set<string>();
    for (const key of selected) {
      const name = keyToName.get(key);
      if (name !== undefined) names.add(name);
    }
    return names;
  }, [selected, keyToName]);

  const handleSort = useCallback(
    (col: SortCol) => {
      if (col === sortCol) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortCol(col);
        setSortDir('asc'); // D-30: new column resets to asc
      }
    },
    [sortCol],
  );

  // Phase 9 Plan 03 (D-191/D-195) — threshold-gated TanStack Virtual.
  // Below threshold: existing flat-table JSX renders unchanged (preserves
  // Cmd-F text search and zero virtualization overhead). Above threshold:
  // virtualizer takes over. SIMPLE_PROJECT and Jokerman stay below; Girl
  // crosses (~80 attachments × multiple skins → 200-300 rows).
  const useVirtual = sorted.length > VIRTUALIZATION_THRESHOLD;

  // Stable identity for measurement-cache survival across sort/filter
  // (RESEARCH §Pitfall 2 — index-based default keys cause measurement flicker).
  const getItemKey = useCallback(
    (index: number) => sorted[index].attachmentKey,
    [sorted],
  );

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    // Uniform-row table — 34 px is the current row height by inspection
    // of typography + py-2 padding (RESEARCH §Recommendations #12).
    estimateSize: () => 34,
    // 20-row overscan — well-tested default for tables of this size.
    overscan: 20,
    getItemKey,
  });

  // Phase 9 D-191 — scroll restoration on sort/filter change. RESEARCH §Q1:
  // when row order or filter changes, snap to top so the user's "find a row"
  // intent is satisfied via the search field rather than scroll memory.
  useEffect(() => {
    if (!useVirtual) return;
    virtualizer.scrollToIndex(0);
    // virtualizer identity changes per-render but scrollToIndex is idempotent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortCol, sortDir, query, useVirtual]);

  // Phase 9 D-191 — focusAttachmentName cross-panel jump (Phase 7 D-130) MUST
  // continue to work in the virtualized path. Find the row's index in `sorted`
  // and scrollToIndex; the existing registerRowRef + isFlashing keep handling
  // the visual flash once the row is mounted.
  useEffect(() => {
    if (!useVirtual) return;
    if (!focusAttachmentName) return;
    const idx = sorted.findIndex((r) => r.attachmentName === focusAttachmentName);
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusAttachmentName, sorted, useVirtual]);

  // Plain single-toggle (Space / Enter keyboard path, or plain mouse click).
  const handleToggleRow = useCallback(
    (key: string) => {
      const next = new Set(selected);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setSelected(next);
      setLastClicked(key);
    },
    [selected],
  );

  // Shift-click range-toggle (mouse-only; fired from the wrapping label onClick).
  const handleRangeToggle = useCallback(
    (key: string) => {
      if (lastClicked === null) {
        // No anchor yet — fall back to single-toggle semantics.
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelected(next);
        setLastClicked(key);
        return;
      }
      const aIdx = visibleKeys.indexOf(lastClicked);
      const bIdx = visibleKeys.indexOf(key);
      if (aIdx < 0 || bIdx < 0) {
        // Anchor not in visible set (filter changed); fall back to single-toggle.
        const next = new Set(selected);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setSelected(next);
        setLastClicked(key);
        return;
      }
      const [lo, hi] = aIdx < bIdx ? [aIdx, bIdx] : [bIdx, aIdx];
      const next = new Set(selected);
      // Target state derived from the NEWLY clicked row: if it was selected,
      // shift-click clears the range; else, shift-click adds.
      const targetSelected = !selected.has(key);
      for (let i = lo; i <= hi; i++) {
        if (targetSelected) next.add(visibleKeys[i]);
        else next.delete(visibleKeys[i]);
      }
      setSelected(next);
      setLastClicked(key);
    },
    [selected, lastClicked, visibleKeys],
  );

  return (
    <div className="w-full p-8">
      {/*
        Phase 21 Plan 11 (G-03 UAT-1 revised diagnosis, 2026-05-02) —
        `min-h-[calc(100vh-200px)]` pins the section to the SAME vertical
        extent as the virtualized scroll container (line 861 inline-style
        `height: 'calc(100vh - 200px)'`). Without this min-height, when the
        per-attachment filter narrows `sorted.length` below
        VIRTUALIZATION_THRESHOLD (100), `useVirtual` flips false and the
        panel switches from the fixed-height virtualized path to the
        content-driven flat-table path — the panel's vertical extent
        collapses by hundreds of pixels in a single render, which is what
        the user observed as "panel slides downward toward the center" on
        the Global tab (HUMAN-UAT Test 1 failure).
        AnimationBreakdownPanel does not exhibit this regression because
        its virtualizer is per-card with a small fixed `maxHeight: 600px`
        cap; cards stack with content-driven heights and no panel-level
        height switch occurs across the threshold.
      */}
      <section className="border border-border rounded-md bg-panel p-4 mb-4 min-h-[calc(100vh-200px)]">
      <header className="mb-4 flex items-center gap-2 text-sm font-semibold text-fg">
        <span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5 text-fg">
          <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
            <rect x="2" y="6" width="16" height="8" rx="1" />
            <path d="M5 6 v3 M8 6 v2 M11 6 v3 M14 6 v2 M17 6 v3" />
          </svg>
        </span>
        <span>Global Max Render Scale</span>
        {/* Phase 24 OPT-03 — pixel-area savings % chip (D-08, D-09, D-10).
            Hidden when savingsPct is null/undefined/0 (no data or 0% savings).
            text-warning signals an informational metric distinct from interactive elements.
            toFixed(1) matches OptimizeDialog.tsx:354 display format. */}
        {savingsPct !== null && savingsPct !== undefined && savingsPct > 0 && (
          <span className="font-mono text-xs text-warning border border-border rounded-md px-2 py-1 flex-shrink-0">
            {savingsPct.toFixed(1)}% pixel savings
          </span>
        )}
        <span className="text-fg-muted font-mono text-sm font-normal ml-auto">
          {selected.size} selected / {sorted.length} total
        </span>
      </header>
      {/* Phase 9 Plan 03 — Sticky <thead> via Tailwind `sticky top-0` (D-191
          + RESEARCH §Pitfall 1). MUST stay on <thead>, NEVER on <tr> inside
          <tbody>: virtualizer applies transform: translateY to <tr>s, which
          creates stacking contexts that break sticky positioning. The same
          <thead> markup works in BOTH the flat-table and virtualized render
          paths — only the surrounding scroll-container wrapper differs. */}
      {useVirtual ? (
        // Virtualized render path (sorted.length > 100). RESEARCH §Q1
        // shape: outer scroll container with overflow-anchor:none + inner
        // total-height spacer + table with translateY-positioned rows.
        <div
          ref={parentRef}
          // overflow-anchor:none prevents browser scroll re-anchoring on
          // sort/filter content-height changes (RESEARCH §Recommendations
          // #11). No Tailwind utility — inline style required.
          style={{
            height: 'calc(100vh - 200px)',
            overflow: 'auto',
            overflowAnchor: 'none',
          }}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
            <table className="w-full border-collapse">
              <thead className="bg-panel sticky top-0 z-10">
                <tr>
                  <th className="w-1 p-0" aria-label="Row state indicator" />
                  <th scope="col" className="py-2 px-3 border-b border-border w-8">
                    <SelectAllCheckbox
                      visibleKeys={visibleKeys}
                      selected={selected}
                      onBulk={setSelected}
                    />
                  </th>
                  <SortHeader
                    col="attachmentName"
                    label="Attachment"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    col="skinName"
                    label="Skin"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    col="sourceW"
                    label="Source W×H"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    col="worldW"
                    label="Peak W×H"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    col="peakScale"
                    label="Scale"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortHeader
                    col="animationName"
                    label="Source Animation"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                  />
                  <SortHeader
                    col="frame"
                    label="Frame"
                    activeCol={sortCol}
                    dir={sortDir}
                    onSort={handleSort}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody>
                {virtualizer.getVirtualItems().map((virtualRow, idx) => {
                  const row = sorted[virtualRow.index];
                  const state = rowState(row.effectiveScale, false, row.isMissing);
                  return (
                    <Row
                      key={row.attachmentKey}
                      row={row}
                      query={query}
                      checked={selected.has(row.attachmentKey)}
                      onToggle={handleToggleRow}
                      onRangeToggle={handleRangeToggle}
                      suppressNextChangeRef={suppressNextChangeRef}
                      onJumpToAnimation={onJumpToAnimation}
                      onOpenOverrideDialog={openDialog}
                      selectedKeys={selectedAttachmentNames}
                      isFlashing={isFlashing === row.attachmentName}
                      registerRef={(el) => registerRowRef(row.attachmentName, el)}
                      state={state}
                      loaderMode={loaderMode}
                      // Per RESEARCH §Q1: translate basis is the row's
                      // INITIAL position, not absolute scroll offset. The
                      // `idx * virtualRow.size` subtraction is documented
                      // in the official TanStack Virtual table example
                      // and is REQUIRED for <tr> rendering (vs the
                      // <div>-based docs default).
                      style={{
                        transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)`,
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        // Flat-table render path (sorted.length ≤ 100). UNCHANGED from
        // pre-Phase-9 — preserves Cmd-F text search and zero virtualization
        // overhead. SIMPLE_PROJECT, Jokerman, and any rig at or below the
        // threshold land here.
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-panel">
              <th className="w-1 p-0" aria-label="Row state indicator" />
              <th scope="col" className="py-2 px-3 border-b border-border w-8">
                <SelectAllCheckbox
                  visibleKeys={visibleKeys}
                  selected={selected}
                  onBulk={setSelected}
                />
              </th>
              <SortHeader
                col="attachmentName"
                label="Attachment"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                col="skinName"
                label="Skin"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                col="sourceW"
                label="Source W×H"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortHeader
                col="worldW"
                label="Peak W×H"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortHeader
                col="peakScale"
                label="Scale"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
              <SortHeader
                col="animationName"
                label="Source Animation"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
              />
              <SortHeader
                col="frame"
                label="Frame"
                activeCol={sortCol}
                dir={sortDir}
                onSort={handleSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="text-fg-muted font-mono text-sm text-center py-8">
                  {query.trim() !== ''
                    ? 'No attachments match "' + query + '"'
                    : 'No attachments'}
                </td>
              </tr>
            )}
            {sorted.map((row) => {
              const state = rowState(row.effectiveScale, false, row.isMissing);
              return (
                <Row
                  key={row.attachmentKey}
                  row={row}
                  query={query}
                  checked={selected.has(row.attachmentKey)}
                  onToggle={handleToggleRow}
                  onRangeToggle={handleRangeToggle}
                  suppressNextChangeRef={suppressNextChangeRef}
                  onJumpToAnimation={onJumpToAnimation}
                  onOpenOverrideDialog={openDialog}
                  selectedKeys={selectedAttachmentNames}
                  /* Phase 7 D-130 NEW: */
                  isFlashing={isFlashing === row.attachmentName}
                  registerRef={(el) => registerRowRef(row.attachmentName, el)}
                  state={state}
                  loaderMode={loaderMode}
                />
              );
            })}
          </tbody>
        </table>
      )}
      </section>
    </div>
  );
}
