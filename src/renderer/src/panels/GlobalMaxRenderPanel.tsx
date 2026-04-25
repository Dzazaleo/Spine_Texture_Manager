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
} from 'react';
import clsx from 'clsx';
import type { SkeletonSummary, DisplayRow } from '../../../shared/types.js';
import { SearchBar } from '../components/SearchBar';
import { computeExportDims } from '../lib/export-view.js';

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
}

// ----- Pure helpers (module-top) -----------------------------------------

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
    const { effScale, outW, outH } = computeExportDims(
      row.sourceW,
      row.sourceH,
      row.peakScale,
      override,
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
    <tr className={clsx('border-b border-border hover:bg-accent/5', checked && 'bg-accent/5')}>
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
        {highlightMatch(row.attachmentName, query)}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg-muted">{row.skinName}</td>
      <td className="py-2 px-3 font-mono text-sm text-fg text-right">{row.originalSizeLabel}</td>
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
      <td
        className={clsx(
          'py-2 px-3 font-mono text-sm text-right',
          row.override !== undefined ? 'text-accent' : 'text-fg',
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
}: GlobalMaxRenderPanelProps) {
  // Phase 4 Plan 03: default-prop shims so the panel stays usable standalone
  // (AppShell always passes non-null values).
  const overridesMap: ReadonlyMap<string, number> = overrides ?? EMPTY_OVERRIDES;
  const openDialog = onOpenOverrideDialog ?? NOOP_OPEN_DIALOG;

  // State: plain useState per D-32 (no Zustand / Jotai / Context).
  const [query, setQuery] = useState('');
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

  // Phase 4 Plan 03: enrichment runs BEFORE filter + sort so the existing
  // comparator reads .effectiveScale / .effectiveWorldW without other
  // restructuring (pattern-mapper flag 3).
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

  // Phase 5 Plan 03 — F6.2 unused-section filter. Inherits the same
  // substring-lowercase predicate the peak table uses via filterByName
  // (D-107 inherited SearchBar filter; Pitfall 6 — the section chrome
  // renders whenever summary.unusedAttachments is non-empty, so the
  // filter may return 0 rows while chrome stays visible with a
  // "(no matches)" placeholder in the body).
  //
  // Rule-1 bug fix (executor 2026-04-24): SkeletonSummary.unusedAttachments
  // is declared OPTIONAL in src/shared/types.ts (Plan 02 SUMMARY §key-decisions:
  // kept optional to preserve source compatibility with pre-Plan-02 consumers),
  // so a nullish-coalesce to [] is required before .slice/.filter and before
  // the .length guard in the render block below.
  const unusedAttachments = summary.unusedAttachments ?? [];
  const filteredUnused = useMemo(
    () => {
      const q = query.trim().toLowerCase();
      if (q === '') return unusedAttachments.slice();
      return unusedAttachments.filter(
        (u) => u.attachmentName.toLowerCase().includes(q),
      );
    },
    [unusedAttachments, query],
  );

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
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="mb-4 flex items-center gap-4">
        <SearchBar value={query} onChange={setQuery} />
        <span className="text-fg-muted font-mono text-sm ml-auto">
          {selected.size} selected / {sorted.length} total
        </span>
      </header>
      {/* Phase 5 Plan 03 — F6.2 unused attachment section (D-103, D-105, D-107).
          Chrome visible whenever summary.unusedAttachments is non-empty; body
          shows "(no matches)" when the search filter excludes every row
          (Pitfall 6 chrome-visible policy). Red scope is header-only (D-105).
          Uses the ??-coalesced local `unusedAttachments` because the IPC field
          is declared optional (see the filteredUnused memo above). */}
      {unusedAttachments.length > 0 && (
        <section className="mb-6 border-b border-border pb-4" aria-label="Unused attachments">
          <header className="flex items-center gap-2 mb-2 text-danger font-mono text-sm font-semibold">
            <span aria-hidden="true">⚠</span>
            <span>
              {filteredUnused.length === 1
                ? '1 unused attachment'
                : `${filteredUnused.length} unused attachments`}
            </span>
          </header>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-panel">
                <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">Attachment</th>
                <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">Source Size</th>
                <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">Defined In</th>
              </tr>
            </thead>
            <tbody>
              {filteredUnused.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-fg-muted font-mono text-sm text-center py-4">(no matches)</td>
                </tr>
              ) : filteredUnused.map((u) => (
                <tr key={u.attachmentName} className="border-b border-border">
                  <td className="py-2 px-3 font-mono text-sm text-fg">{u.attachmentName}</td>
                  <td className="py-2 px-3 font-mono text-sm text-fg-muted">{u.sourceLabel}</td>
                  <td className="py-2 px-3 font-mono text-sm text-fg-muted">{u.definedInLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-panel">
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
              <td colSpan={8} className="text-fg-muted font-mono text-sm text-center py-8">
                {query.trim() !== ''
                  ? 'No attachments match "' + query + '"'
                  : 'No attachments'}
              </td>
            </tr>
          )}
          {sorted.map((row) => (
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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
