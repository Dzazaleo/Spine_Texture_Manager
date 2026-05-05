/**
 * Phase 3 Plan 02 — Per-animation breakdown cards panel.
 *
 * Consumes `summary.animationBreakdown` (Plan 03-01's IPC field) and renders
 * one collapsible card per entry: the static-pose baseline card first
 * (cardId === 'setup-pose'), then one card per animation in skeleton JSON
 * order. Each expanded card shows a 7-column table (D-57): Attachment,
 * Bone Path, Source W×H, Scale, Peak W×H, Frame, and the Phase-4-reserved
 * Override button.
 *
 * State owned by this panel:
 *   - `query`: SearchBar value; filters rows by attachmentName (D-70).
 *   - `userExpanded: Set<string>`: the user-intent set of expanded cardIds.
 *     Initialized to the static-pose-only seed per D-63/D-64. The literal
 *     construction is grep-verified by the audit — do not refactor to a
 *     constant or alternate construction.
 *   - `isFlashing: string | null`: local flash-highlight flag. Only the
 *     jump-target card gets the ring (D-66), for ~900ms.
 *
 * Derived state (`useMemo`):
 *   - `filteredCards`: cards with their row sets filtered when query is
 *     non-empty (D-70). All cards always present so zero-match cards can
 *     render their headers with a '— filtered' suffix (UI-SPEC Copywriting).
 *   - `effectiveExpanded`: during active search, auto-expand cards with
 *     matches on top of userExpanded (D-71). User-toggling a card during
 *     search writes to userExpanded; the union behavior means
 *     matched-cards that the user collapses during search re-appear expanded
 *     until either the search clears OR the match set changes to exclude
 *     that card.
 *
 * Jump-target flow (D-52/D-66): AppShell sets focusAnimationName; this
 * panel's useEffect detects the change, scrolls the target card into view,
 * adds it to userExpanded, sets isFlashing to the card's cardId, fires
 * onFocusConsumed SYNCHRONOUSLY so AppShell clears focusAnimationName on
 * the same tick, and schedules a 900ms timer to clear isFlashing. The
 * synchronous onFocusConsumed is the resolution to the panel-re-mount leak
 * (RESEARCH §Pitfall 5) — useEffect cleanup clears the timer on unmount so
 * isFlashing can never leak into a future mount.
 *
 * Layer 3 invariant: this file imports only react, clsx, the shared types
 * file, and sibling renderer modules. Never imports from src/core/*. Enforced
 * by tests/arch.spec.ts.
 *
 * Tailwind v4 literal-class discipline: every className is a string literal
 * or a clsx conditional. No template interpolation (carried-forward footgun
 * from earlier phases).
 *
 * Two-weight typography contract: only font-normal (400) + font-semibold
 * (600) appear. Weight 500 is forbidden project-wide.
 *
 * Phase 4 Plan 03 extension: per-row Scale + Peak W×H cells render
 * override-aware values when `overrides.has(row.attachmentName)` per D-82 /
 * D-83. Scale `<td>` gains a double-click handler that opens the override
 * dialog on the clicked row. Phase 3's D-69 placeholder Override Scale button
 * is UNLOCKED (drop the interaction-blocking attribute + the dim styling,
 * attach the dialog-open click handler, refresh aria-label). D-90: no batch
 * path here — selection UI only exists on the Global panel. Layer 3:
 * `applyOverride` is imported from the renderer-side overrides-view module,
 * never from the pure-TS math tree.
 *
 * Phase 4 Plan 03 gap-fix B (human-verify 2026-04-24): applyOverride is
 * called with the single-arg signature (overridePercent) — effective
 * scale = percent / 100. Peak W×H uses sourceW/H × percent/100. Tooltip
 * format updated to "{X}% of source = {S.SSS}×" (dropped the old "Peak
 * N× × Y% =" prefix — peak is no longer part of the equation). See
 * 04-03-SUMMARY.md §Deviations for the rationale.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import { useVirtualizer } from '@tanstack/react-virtual';
import type {
  SkeletonSummary,
  AnimationBreakdown,
  BreakdownRow,
} from '../../../shared/types.js';
import { computeExportDims, safeScale } from '../lib/export-view.js';
import { DimsBadge } from '../components/DimsBadge.js';
import { WarningTriangleIcon } from '../components/icons/WarningTriangleIcon';

/**
 * Phase 9 Plan 04 (D-195/D-196) — threshold above which a card's INNER row
 * list virtualizes via TanStack Virtual. Outer card list is NEVER virtualized
 * (D-196 outer-not-virtualized invariant — a complex rig has ~16 cards which
 * stay cheap to render). Below this threshold the existing flat-table JSX
 * renders unchanged, preserving Cmd-F text search and zero virtualization
 * overhead. Above it, useVirtualizer + measureElement (variable-height
 * because Bone Path can wrap and override badges add height) takes over.
 */
const VIRTUALIZATION_THRESHOLD = 100;

export interface AnimationBreakdownPanelProps {
  summary: SkeletonSummary;
  /** Phase 3 D-52/D-66: when non-null, the panel scrolls + auto-expands + flashes
   *  the matching card, then calls onFocusConsumed() synchronously so AppShell clears focus. */
  focusAnimationName: string | null;
  onFocusConsumed: () => void;
  /**
   * Phase 4 Plan 02: override-aware render + dialog trigger. No selection UI
   * on this panel per D-90 — always per-row. Optional today so this plan's
   * AppShell changes typecheck; panel body wiring lands in Plan 04-03.
   */
  overrides?: ReadonlyMap<string, number>;
  onOpenOverrideDialog?: (row: BreakdownRow) => void;
  /**
   * Phase 19 UI-01 + D-04 (Plan 19-05 closure) — REQUIRED props for the
   * lifted SearchBar query state. AppShell owns the source of truth (single
   * sticky-bar SearchBar drives both panels). The panel-internal
   * useState('') slot + the panel-internal SearchBar JSX element have been
   * REMOVED in this plan; tightened from Plan 19-03's interim OPTIONAL
   * posture to REQUIRED here.
   */
  query: string;
  onQueryChange: (q: string) => void;
  /**
   * Phase 22.1 G-01 D-02 — loader mode for the dims-mismatch badge tooltip
   * wording. 'auto' resolves to atlas-source variant; 'atlas-less' to
   * PNG-source variant. Sibling-symmetric with GlobalMaxRenderPanelProps
   * (Phase 19 D-06). Threaded from AppShell.tsx.
   */
  loaderMode: 'auto' | 'atlas-less';
}

/**
 * Phase 4 Plan 03 + Round 5 (2026-04-25): effective-scale-enriched breakdown
 * row. Added fields are strictly renderer-side — src/shared/types.ts is NOT
 * extended (discretion option A).
 *
 * Round 5: effExportW/effExportH replace effectiveWorldW/H — they hold the
 * EXPORT dims (Math.ceil(sourceDim × ceil-thousandth-effScale, clamped ≤
 * source)) so the per-card "Peak W×H" column matches the optimize dialog
 * and the GlobalMaxRenderPanel's same column. World-AABB stays available
 * via the raw worldW/H DisplayRow fields for the cell's hover tooltip.
 */
type EnrichedBreakdownRow = BreakdownRow & {
  effectiveScale: number;
  effExportW: number;
  effExportH: number;
  /**
   * Source-shrink display scale (2026-05-05): outW / sourceW. Sibling-
   * symmetric to GlobalMaxRenderPanel.EnrichedRow.displayScale.
   */
  displayScale: number;
  /**
   * Peak display dims (2026-05-05): world-space pixel demand, invariant of
   * source PNG dims. Sibling-symmetric to the Global Max Render panel's
   * peakDisplayW/H field. Per-animation rows inherit the same semantics.
   */
  peakDisplayW: number;
  peakDisplayH: number;
  /** undefined when no override; else the clamped integer percent. */
  override: number | undefined;
};

/**
 * Phase 4 Plan 03: an AnimationBreakdown where rows have been enriched. We
 * Omit<,'rows'> before intersecting so the narrower EnrichedBreakdownRow[]
 * survives TypeScript's structural merge (a bare `& { rows: EnrichedBreakdownRow[] }`
 * would still be widened back to BreakdownRow[] by the original field).
 */
type EnrichedCard = Omit<AnimationBreakdown, 'rows'> & {
  rows: EnrichedBreakdownRow[];
};

// ----- Module-top pure helpers -------------------------------------------

/**
 * Phase 19 UI-02 + D-06 — Row state predicate. Drives the row left-accent
 * bar (UI-SPEC §5) and the tinted ratio cell. The "ratio" the spec refers
 * to is the effective render scale (1.0× = source size, < 1.0× = under-
 * rendered / could be downscaled, > 1.0× = over-rendered / source too small).
 *
 * Per UI-SPEC §5: AnimationBreakdownPanel rows are PER-ANIMATION peak rows.
 * The "unused" state is tracked on the global summary level (not per-
 * animation), so `isUnused` is always false here — under/over/neutral cover
 * the typical Animation Breakdown usage. This predicate is co-located here
 * (mirroring the inline duplication in GlobalMaxRenderPanel.tsx — Plan 19-04
 * §"Hand-off Notes" allows the duplication; renderer-tree-only, two callsites).
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
const NOOP_OPEN_DIALOG: (row: BreakdownRow) => void = () => undefined;

/**
 * Phase 4 Plan 03 + Round 5 (2026-04-25): enrich each card's rows with
 * render-time effective fields. Now uses computeExportDims (single source
 * of truth shared with OptimizeDialog) so the per-card "Peak W×H" column
 * shows EXPORT dims — Math.ceil(sourceDim × ceil-thousandth-effScale,
 * clamped ≤ source). World-AABB stays accessible via the cell hover tooltip.
 */
function enrichCardsWithEffective(
  cards: readonly AnimationBreakdown[],
  overrides: ReadonlyMap<string, number>,
): Array<EnrichedCard> {
  return cards.map((card) => ({
    ...card,
    rows: card.rows.map((row) => {
      const override = overrides.get(row.attachmentName);
      // Phase 22 DIMS-03 (Plan 22-04) — pass actualSourceW/H + dimsMismatch
      // through so the per-card Peak W×H column reflects cap math. Sibling-
      // symmetric to GlobalMaxRenderPanel.enrichWithEffective per Phase 19
      // D-06 (both panels read the same enriched shape from the same helper
      // signature).
      const { effScale, outW, outH, displayScale, peakDisplayW, peakDisplayH } = computeExportDims(
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
        displayScale,
        peakDisplayW,
        peakDisplayH,
        override,
      };
    }),
  }));
}

/**
 * Filter each card's rows by case-insensitive substring match on
 * attachmentName (D-70). Keeps all cards (including zero-match ones) so
 * their headers can show the '— filtered' suffix per the design spec.
 * uniqueAssetCount is recomputed post-filter so it matches rows.length.
 */
function filterCardsByAttachmentName(
  cards: ReadonlyArray<EnrichedCard>,
  query: string,
): Array<EnrichedCard> {
  const q = query.trim().toLowerCase();
  if (q === '') return cards.slice();
  return cards.map((card) => {
    const rows: EnrichedBreakdownRow[] = card.rows.filter((r) =>
      r.attachmentName.toLowerCase().includes(q),
    );
    return { ...card, uniqueAssetCount: rows.length, rows };
  });
}

/**
 * Mid-ellipsis truncation for the Bone Path cell (D-67). If the joined path
 * fits within maxChars, return it as-is; otherwise keep the root token and
 * the last two tokens (slot + attachment) with '…' in the middle. Preserves
 * the leaf which is the most actionable token; CSS-only end-ellipsis would
 * drop it.
 *
 * Executor tuning note: 48 chars fits roughly a 320px max-width cell at
 * 12px JetBrains Mono. If real rigs overflow, raise maxChars — this is
 * the single point of tuning.
 */
function truncateMidEllipsis(path: readonly string[], maxChars: number): string {
  const SEPARATOR = ' → '; // U+2192 flanked by single spaces
  const full = path.join(SEPARATOR);
  if (full.length <= maxChars || path.length <= 3) return full;
  const lastTwo = path.slice(-2).join(SEPARATOR);
  return `${path[0]}${SEPARATOR}…${SEPARATOR}${lastTwo}`;
}

/**
 * Match-highlight: React fragments + <mark>; never HTML parsing. XSS-safe by
 * construction — every user-supplied substring renders as a React text node
 * or the DOM-escaped children of <mark>. Mirrors the prior phase's helper in
 * the global panel (same 15-line helper; intentional duplication to keep this
 * panel self-contained).
 */
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

// ----- Main panel component ---------------------------------------------

export function AnimationBreakdownPanel({
  summary,
  focusAnimationName,
  onFocusConsumed,
  overrides,
  onOpenOverrideDialog,
  query,
  onQueryChange,
  loaderMode,
}: AnimationBreakdownPanelProps) {
  // Phase 4 Plan 03: default-prop shims so the panel stays usable standalone
  // (AppShell always passes non-null values).
  const overridesMap: ReadonlyMap<string, number> = overrides ?? EMPTY_OVERRIDES;
  const openDialog = onOpenOverrideDialog ?? NOOP_OPEN_DIALOG;

  // Phase 19 UI-01 + D-04 (Plan 19-05) — panel-internal `useState('')` slot
  // REMOVED. `query` is now driven by AppShell's lifted state via REQUIRED
  // props; the panel-internal SearchBar JSX element is GONE (the sticky-bar
  // SearchBar in AppShell is the sole input). `onQueryChange` is destructured
  // to satisfy the props contract but never invoked from this panel — the
  // sticky-bar SearchBar calls it directly through AppShell's binding.
  // D-63/D-64: static-pose card seeded as the only initially-expanded cardId.
  // The literal construction is a grep-verified signature.
  const [userExpanded, setUserExpanded] = useState<Set<string>>(
    new Set(['setup-pose']),
  );
  const [isFlashing, setIsFlashing] = useState<string | null>(null);

  const cardRefs = useRef(new Map<string, HTMLElement>());

  const registerCardRef = useCallback((cardId: string, el: HTMLElement | null) => {
    if (el === null) cardRefs.current.delete(cardId);
    else cardRefs.current.set(cardId, el);
  }, []);

  // Keep a cardId → original card lookup for the 'M / N' filtered header math.
  // Operates on raw summary (not enriched) — the header math is independent
  // of override enrichment.
  const originalById = useMemo(
    () => new Map(summary.animationBreakdown.map((c) => [c.cardId, c])),
    [summary.animationBreakdown],
  );

  // Phase 4 Plan 03: enrichment runs BEFORE filter so filtered rows carry the
  // effective fields needed by BreakdownTable.
  const enrichedCards = useMemo(
    () => enrichCardsWithEffective(summary.animationBreakdown, overridesMap),
    [summary.animationBreakdown, overridesMap],
  );

  const filteredCards = useMemo(
    () => filterCardsByAttachmentName(enrichedCards, query),
    [enrichedCards, query],
  );

  const effectiveExpanded = useMemo(() => {
    if (query === '') return userExpanded;
    const cardsWithMatches = filteredCards
      .filter((c) => c.rows.length > 0)
      .map((c) => c.cardId);
    return new Set<string>([...userExpanded, ...cardsWithMatches]);
  }, [query, userExpanded, filteredCards]);

  const toggleCard = useCallback((cardId: string) => {
    setUserExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  // D-52/D-66 jump-effect: scroll + expand + flash; SYNCHRONOUSLY fire the
  // consume callback so the focus can never leak across re-mounts
  // (RESEARCH §Pitfall 5).
  useEffect(() => {
    if (focusAnimationName === null) return;
    const cardId =
      focusAnimationName === 'Setup Pose (Default)'
        ? 'setup-pose'
        : `anim:${focusAnimationName}`;

    setUserExpanded((prev) => {
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });
    setIsFlashing(cardId);

    const el = cardRefs.current.get(cardId);
    if (el !== undefined) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    onFocusConsumed();

    const timer = setTimeout(() => setIsFlashing(null), 900);
    return () => clearTimeout(timer);
  }, [focusAnimationName, onFocusConsumed]);

  return (
    <div className="w-full p-8">
      <header className="mb-4 flex items-center gap-2">
        <span
          className="inline-flex items-center justify-center w-5 h-5 text-fg flex-shrink-0"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 20 20"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            className="w-5 h-5"
            aria-hidden="true"
          >
            <path d="M3 17 V10 M8 17 V6 M13 17 V12 M18 17 V4" />
          </svg>
        </span>
        <h2 className="text-sm font-semibold text-fg">Animation Breakdown</h2>
        <span className="text-fg-muted font-mono text-xs font-normal ml-auto">
          {filteredCards.length} animations
        </span>
      </header>
      <div className="flex flex-col gap-3">
        {filteredCards.map((card) => {
          const original = originalById.get(card.cardId);
          const totalCount = original?.rows.length ?? card.rows.length;
          return (
            <AnimationCard
              key={card.cardId}
              card={card}
              totalCount={totalCount}
              queryActive={query !== ''}
              expanded={effectiveExpanded.has(card.cardId)}
              onToggle={() => toggleCard(card.cardId)}
              query={query}
              isFlashing={isFlashing === card.cardId}
              registerRef={(el) => registerCardRef(card.cardId, el)}
              onOpenOverrideDialog={openDialog}
              loaderMode={loaderMode}
            />
          );
        })}
      </div>
    </div>
  );
}

// ----- AnimationCard sub-component ---------------------------------------

interface AnimationCardProps {
  card: EnrichedCard;
  totalCount: number;
  queryActive: boolean;
  expanded: boolean;
  onToggle: () => void;
  query: string;
  isFlashing: boolean;
  registerRef: (el: HTMLElement | null) => void;
  /** Phase 4 D-77 dialog trigger. */
  onOpenOverrideDialog: (row: BreakdownRow) => void;
  /** Phase 22.1 G-01 D-02 — loader mode for DimsBadge tooltip wording. */
  loaderMode: 'auto' | 'atlas-less';
}

function AnimationCard({
  card,
  totalCount,
  queryActive,
  expanded,
  onToggle,
  query,
  isFlashing,
  registerRef,
  onOpenOverrideDialog,
  loaderMode,
}: AnimationCardProps) {
  const headerId = `bd-header-${card.cardId}`;
  const bodyId = `bd-body-${card.cardId}`;
  const caret = expanded ? '▾' : '▸'; // U+25BE / U+25B8

  const countLabel = (() => {
    if (queryActive) {
      return ` — ${card.rows.length} / ${totalCount} unique assets — filtered`;
    }
    if (card.rows.length === 0) {
      return ' — No assets referenced';
    }
    return ` — ${card.rows.length} unique assets referenced`;
  })();

  return (
    <section
      ref={registerRef}
      aria-labelledby={headerId}
      className={clsx(
        'border border-border rounded-md bg-modal overflow-hidden',
        isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
      )}
    >
      <button
        id={headerId}
        type="button"
        aria-expanded={expanded}
        aria-controls={bodyId}
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left text-sm font-semibold font-mono text-fg hover:bg-accent/5 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="text-fg-muted">{caret}</span>
        {/* Phase 19 UI-02 + D-08 — section-level play/film glyph (UI-SPEC §3
            lines 240-247). Stroke-based SVG; inherits text-fg via
            currentColor. The caret span above is preserved (distinct
            purpose — expand/collapse indicator vs. category icon). */}
        <span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5 text-fg">
          <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
            <rect x="3" y="3" width="14" height="14" rx="2" />
            <path d="M9 7 l4 3 -4 3 z" />
          </svg>
        </span>
        <span>{card.animationName}</span>
        <span className="text-fg-muted">{countLabel}</span>
      </button>
      {expanded && (
        <div id={bodyId} role="region" className="border-t border-border">
          {card.rows.length === 0 ? (
            <table className="w-full border-collapse">
              <tbody>
                <tr>
                  <td
                    colSpan={8}
                    className="text-fg-muted font-mono text-sm text-center py-8"
                  >
                    No assets referenced
                  </td>
                </tr>
              </tbody>
            </table>
          ) : (
            <BreakdownTable
              rows={card.rows}
              query={query}
              onOpenOverrideDialog={onOpenOverrideDialog}
              loaderMode={loaderMode}
            />
          )}
        </div>
      )}
    </section>
  );
}

// ----- BreakdownTable sub-component --------------------------------------

interface BreakdownTableProps {
  rows: readonly EnrichedBreakdownRow[];
  query: string;
  /** Phase 4 D-77 dialog trigger (per-row only per D-90 — no batch here). */
  onOpenOverrideDialog: (row: BreakdownRow) => void;
  /** Phase 22.1 G-01 D-02 — loader mode for DimsBadge tooltip wording. */
  loaderMode: 'auto' | 'atlas-less';
}

/**
 * Phase 9 Plan 04 (D-196) — shared <thead> markup. Identical between the
 * flat-table and virtualized render paths so sort/search semantics carry
 * over verbatim. The `sticky top-0 z-10` utilities apply position:sticky
 * to <thead> so the column header stays pinned when the inner card
 * scroll-container scrolls (RESEARCH §Pitfall 1: position:sticky NEVER
 * goes on a <tr> inside <tbody> — virtualizer applies translateY to <tr>
 * which creates a stacking context that breaks sticky positioning).
 */
function BreakdownTableHead() {
  return (
    <thead className="bg-modal sticky top-0 z-10">
      <tr>
        {/* Phase 19 UI-02 + D-06 — empty cell aligning with the per-row
            state-color left-accent bar (`<td className="w-1 p-0">`). The
            aria-label keeps the column count consistent with the body
            without naming a visible header. */}
        <th
          scope="col"
          className="w-1 p-0 border-b border-border"
          aria-label="Row state indicator"
        />
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left"
        >
          Attachment
        </th>
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left"
        >
          Bone Path
        </th>
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-right"
        >
          Source W×H
        </th>
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-right"
        >
          Scale
        </th>
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-right"
        >
          Peak W×H
        </th>
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-right"
        >
          Frame
        </th>
        <th
          scope="col"
          className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left"
        >
          Actions
        </th>
      </tr>
    </thead>
  );
}

/**
 * Phase 9 Plan 04 (D-196) — single <tr> rendering shared between the two
 * paths. The `style` prop is undefined in the flat-table path (zero
 * behavioral change) and carries the translateY transform in the
 * virtualized path. The `measureRef` prop is undefined in the flat-table
 * path and is `virtualizer.measureElement` in the virtualized path —
 * ResizeObserver-driven exact measurement for variable-height rows
 * (Bone Path can wrap; override badges add height per RESEARCH §Q10).
 */
interface BreakdownRowItemProps {
  row: EnrichedBreakdownRow;
  query: string;
  onOpenOverrideDialog: (row: BreakdownRow) => void;
  /**
   * Phase 19 UI-02 + D-06 — row state derived from rowState(effectiveScale,
   * isUnused). Drives the left-accent bar `<td>` color + the tinted ratio
   * cell. Computed per-row in the parent (BreakdownTable) so the
   * table-level isUnused predicate (always false in this panel — see
   * RowState docblock above) feeds in once.
   */
  state: RowState;
  style?: CSSProperties;
  measureRef?: (el: HTMLTableRowElement | null) => void;
  dataIndex?: number;
  /** Phase 22.1 G-01 D-02 — loader mode for DimsBadge tooltip wording. */
  loaderMode: 'auto' | 'atlas-less';
}

function BreakdownRowItem({
  row,
  query,
  onOpenOverrideDialog,
  state,
  style,
  measureRef,
  dataIndex,
  loaderMode,
}: BreakdownRowItemProps) {
  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      style={style}
      className={clsx(
        'border-b border-border hover:bg-accent/5',
        // Phase 26.1 D-06 + D-10 — danger tint takes priority over zebra for missing rows.
        state === 'missing' ? 'bg-danger/20' : 'even:bg-white/[0.04]',
      )}
    >
      {/* Phase 19 UI-02 + D-06 — row state-color left-accent bar (UI-SPEC §5).
          Mirrors the existing banner pattern at AppShell.tsx:1227 / 1258 +
          GlobalMaxRenderPanel.tsx (Plan 19-04). clsx with literal-class
          branches per Tailwind v4 discipline (Pitfall 3 + 8). */}
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
      <td className="py-2 px-3 font-mono text-sm text-fg">
        {row.isMissing && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 text-danger mr-1 flex-shrink-0"
            aria-label="Missing PNG"
          >
            <WarningTriangleIcon className="w-4 h-4" />
          </span>
        )}
        {highlightMatch(row.attachmentName, query)}
        {row.isMissing && (
          <span className="ml-1.5 text-xs text-danger font-semibold">(missing)</span>
        )}
      </td>
      <td
        title={row.bonePath.join(' → ')}
        className="py-2 px-3 font-mono text-xs text-fg-muted max-w-[320px]"
      >
        {truncateMidEllipsis(row.bonePath, 48)}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg text-right">
        {row.originalSizeLabel}
        {/* Phase 22.1 G-02 + G-03 + G-01 D-02 — DimsBadge replaces the
            native HTML `title` attribute. Sibling-symmetric with
            GlobalMaxRenderPanel (Phase 19 D-06): the SAME DimsBadge
            component enforces parity at the shared-component level rather
            than by copy-paste convention. */}
        {/* Phase 22.1 G-03: pass the pre-sourceRatio-cap scale to DimsBadge
            so deriveIsCapped can detect whether the cap binds. Sibling-symmetric
            with GlobalMaxRenderPanel (Phase 19 D-06). */}
        <DimsBadge
          row={row}
          effectiveScale={Math.min(safeScale(
            row.override !== undefined ? row.override / 100 : row.peakScale
          ), 1.0)}
          loaderMode={loaderMode}
        />
      </td>
      {/* Phase 19 UI-02 + D-06 — tinted ratio cell (UI-SPEC §5 lines 314-323).
          2026-05-05: double-click handler moved to Peak column below.
          Scale is a read-only display of the source-shrink ratio. */}
      <td
        className={clsx(
          'py-2 px-3 font-mono text-sm text-right',
          state === 'under' && 'bg-success/10 text-success',
          state === 'over' && 'bg-warning/10 text-warning',
          state === 'unused' && 'bg-danger/10 text-danger',
          state === 'missing' && 'bg-danger/10 text-danger',
          state === 'neutral' && 'text-fg',
        )}
        title={
          row.override !== undefined
            ? `Source reduced to ${row.displayScale.toFixed(3)}× (${row.override}% of peak demand)`
            : `Source reduced to ${row.displayScale.toFixed(3)}× (peak demand)`
        }
      >
        {row.displayScale.toFixed(3)}×
      </td>
      {/* Peak W×H column (2026-05-05 redesign): shows world-space pixel
          demand (canonicalW × peakScale, override-scaled, clamped at
          canonical). INVARIANT of source PNG dims — does not shift across
          re-optimize/reload cycles. Sibling-symmetric to the Global Max
          Render panel column.

          Override double-click target (2026-05-05): the click handler lives
          here (was: Scale column). The user is editing what the rig demands,
          not the derived shrink ratio. */}
      <td
        className={clsx(
          'py-2 px-3 font-mono text-sm text-right cursor-pointer',
          row.override !== undefined ? 'text-accent' : 'text-fg',
        )}
        onDoubleClick={() => onOpenOverrideDialog(row)}
        title={
          row.override !== undefined
            ? `Override set • World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)} • double-click to edit`
            : `World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)} • double-click to override`
        }
      >
        {`${row.peakDisplayW}×${row.peakDisplayH}`}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg-muted text-right">
        {row.frameLabel}
      </td>
      <td className="py-2 px-3 font-mono text-sm text-fg">
        {/* D-69 → D-77: Override Scale button unlocked in Phase 4. Chip
            styling kept per 04-CONTEXT Claude's Discretion recommendation;
            only the opacity dim and the interaction-blocking attribute
            are dropped. */}
        <button
          type="button"
          onClick={() => onOpenOverrideDialog(row)}
          aria-label={'Override scale for ' + row.attachmentName}
          className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg hover:bg-accent/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
        >
          Override Scale
        </button>
      </td>
    </tr>
  );
}

function BreakdownTable({ rows, query, onOpenOverrideDialog, loaderMode }: BreakdownTableProps) {
  // Phase 9 Plan 04 (D-195/D-196) — threshold-gated per-card inner-row
  // virtualization. Below the threshold the existing flat-table JSX
  // renders unchanged; above it, useVirtualizer + measureElement
  // (variable-height) takes over. The OUTER card list is NEVER
  // virtualized (D-196 outer-not-virtualized invariant).
  const useVirtual = rows.length > VIRTUALIZATION_THRESHOLD;

  // Stable identity — the cache survives sort/filter cycles via the
  // attachmentKey identity rather than the volatile array index. RESEARCH
  // §Pitfall 2: index-based default keys cause measurement-cache flicker
  // when rows reorder.
  const getItemKey = useCallback(
    (index: number) => rows[index].attachmentKey,
    [rows],
  );

  const innerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => innerRef.current,
    // 38px estimate — single-line row height with py-2 padding plus a
    // little extra for variable-height tolerance (RESEARCH §Recommendations
    // #12 — taller estimate vs GlobalMaxRender's 34 because Bone Path can
    // wrap; measureElement corrects to the real height as rows mount).
    estimateSize: () => 38,
    overscan: 10,
    getItemKey,
  });

  if (!useVirtual) {
    // Flat-table render path (rows.length ≤ 100). Renders ALL rows in the
    // DOM — preserves Cmd-F text search and zero virtualization overhead.
    // Sticky <thead> applies in this path too so the visual header behaviour
    // matches the virtualized path even though there is no scroll container
    // around the flat table.
    return (
      <table className="w-full border-collapse">
        <BreakdownTableHead />
        <tbody>
          {rows.map((row) => {
            // Phase 19 UI-02 + D-06 — per-row state. AnimationBreakdownPanel
            // rows do not surface the global Unused Assets membership (that
            // lives on the global summary; per-animation rows only carry
            // peak data), so isUnused is always false here.
            const state = rowState(row.displayScale, false, row.isMissing);
            return (
              <BreakdownRowItem
                key={row.attachmentKey}
                row={row}
                query={query}
                onOpenOverrideDialog={onOpenOverrideDialog}
                state={state}
                loaderMode={loaderMode}
              />
            );
          })}
        </tbody>
      </table>
    );
  }

  // Virtualized render path (rows.length > 100). Outer scroll container
  // bounded at maxHeight: 600px so collapse/expand stays predictable.
  // overflow-anchor:none prevents the browser from re-anchoring on
  // sort/filter content-height changes (RESEARCH §Recommendations #11).
  return (
    <div
      ref={innerRef}
      style={{
        maxHeight: '600px',
        overflowY: 'auto',
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
          <BreakdownTableHead />
          <tbody>
            {virtualizer.getVirtualItems().map((virtualRow, idx) => {
              const row = rows[virtualRow.index];
              // Phase 19 UI-02 + D-06 — per-row state. AnimationBreakdownPanel
              // rows do not surface the global Unused Assets membership (that
              // lives on the global summary; per-animation rows only carry
              // peak data), so isUnused is always false here.
              const state = rowState(row.displayScale, false, row.isMissing);
              return (
                <BreakdownRowItem
                  key={row.attachmentKey}
                  row={row}
                  query={query}
                  onOpenOverrideDialog={onOpenOverrideDialog}
                  state={state}
                  // Per RESEARCH §Q1: translate basis is the row's INITIAL
                  // position, not absolute scroll offset. The
                  // (idx * virtualRow.size) subtraction is REQUIRED for
                  // <tr> rendering per the official TanStack Virtual table
                  // example.
                  style={{
                    transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)`,
                  }}
                  // ResizeObserver-driven exact measurement for
                  // variable-height rows (Bone Path can wrap; override
                  // badges add height — RESEARCH §Q10).
                  measureRef={virtualizer.measureElement}
                  dataIndex={virtualRow.index}
                  loaderMode={loaderMode}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
