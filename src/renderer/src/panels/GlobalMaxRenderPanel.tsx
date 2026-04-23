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

type SortCol =
  | 'attachmentName'
  | 'skinName'
  | 'sourceW'
  | 'worldW'
  | 'peakScale'
  | 'animationName'
  | 'frame';
type SortDir = 'asc' | 'desc';

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
}

// ----- Pure helpers (module-top) -----------------------------------------

function filterByName(rows: readonly DisplayRow[], query: string): DisplayRow[] {
  const q = query.trim().toLowerCase();
  if (q === '') return rows.slice();
  return rows.filter((r) => r.attachmentName.toLowerCase().includes(q));
}

function compareRows(a: DisplayRow, b: DisplayRow, col: SortCol): number {
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
      return a.worldW - b.worldW;
    case 'peakScale':
      return a.peakScale - b.peakScale;
    case 'frame':
      return a.frame - b.frame;
  }
}

function sortRows(rows: readonly DisplayRow[], col: SortCol, dir: SortDir): DisplayRow[] {
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
  row: DisplayRow;
  query: string;
  checked: boolean;
  onToggle: (key: string) => void;
  onRangeToggle: (key: string) => void;
  suppressNextChangeRef: MutableRefObject<string | null>;
  /** Phase 3 D-72 — see GlobalMaxRenderPanelProps.onJumpToAnimation. */
  onJumpToAnimation?: (animationName: string) => void;
}

function Row({ row, query, checked, onToggle, onRangeToggle, suppressNextChangeRef, onJumpToAnimation }: RowProps) {
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
      <td className="py-2 px-3 font-mono text-sm text-fg text-right">{row.peakSizeLabel}</td>
      <td className="py-2 px-3 font-mono text-sm text-fg text-right">{row.scaleLabel}</td>
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
}: GlobalMaxRenderPanelProps) {
  // State: plain useState per D-32 (no Zustand / Jotai / Context).
  const [query, setQuery] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('peakScale'); // D-29 default
  const [sortDir, setSortDir] = useState<SortDir>('desc'); // D-29 default
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);
  // W-01 shift-click suppression flag: when the label onClick sees shiftKey and
  // runs range-select, it writes the clicked row's key here; the subsequent
  // native onChange on that input reads the flag and returns early so the
  // single-toggle does not undo the range state.
  const suppressNextChangeRef = useRef<string | null>(null);

  const filtered = useMemo(
    () => filterByName(summary.peaks, query),
    [summary.peaks, query],
  );
  const sorted = useMemo(
    () => sortRows(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir],
  );
  const visibleKeys = useMemo(() => sorted.map((r) => r.attachmentKey), [sorted]);

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
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
