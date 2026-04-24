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
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import clsx from 'clsx';
import type {
  SkeletonSummary,
  AnimationBreakdown,
  BreakdownRow,
} from '../../../shared/types.js';
import { SearchBar } from '../components/SearchBar';
import { applyOverride } from '../lib/overrides-view.js';

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
}

/**
 * Phase 4 Plan 03: effective-scale-enriched breakdown row. Added fields are
 * strictly renderer-side — src/shared/types.ts is NOT extended (discretion
 * option A). effectiveScale/worldW/worldH === the raw peak values when the
 * row has no override.
 */
type EnrichedBreakdownRow = BreakdownRow & {
  effectiveScale: number;
  effectiveWorldW: number;
  effectiveWorldH: number;
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

/** Phase 4 Plan 03: shared empty-map fallback so default-prop consumers don't
 *  allocate a fresh Map on every render. */
const EMPTY_OVERRIDES: ReadonlyMap<string, number> = new Map();
/** Phase 4 Plan 03: no-op default for the open-dialog callback when the panel
 *  is rendered standalone (outside AppShell). */
const NOOP_OPEN_DIALOG: (row: BreakdownRow) => void = () => undefined;

/**
 * Phase 4 Plan 03: enrich each card's rows with render-time effective
 * fields derived from the overrides map. Non-overridden rows pass
 * through with effective fields === raw peak fields.
 */
function enrichCardsWithEffective(
  cards: readonly AnimationBreakdown[],
  overrides: ReadonlyMap<string, number>,
): Array<EnrichedCard> {
  return cards.map((card) => ({
    ...card,
    rows: card.rows.map((row) => {
      const override = overrides.get(row.attachmentName);
      if (override === undefined) {
        return {
          ...row,
          effectiveScale: row.peakScale,
          effectiveWorldW: row.worldW,
          effectiveWorldH: row.worldH,
          override: undefined,
        };
      }
      const { effectiveScale } = applyOverride(row.peakScale, override);
      return {
        ...row,
        effectiveScale,
        // Multiply by override/100 directly (not effectiveScale/peakScale) to
        // avoid a divide-by-zero when peakScale is 0.
        effectiveWorldW: row.worldW * override / 100,
        effectiveWorldH: row.worldH * override / 100,
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
}: AnimationBreakdownPanelProps) {
  // Phase 4 Plan 03: default-prop shims so the panel stays usable standalone
  // (AppShell always passes non-null values).
  const overridesMap: ReadonlyMap<string, number> = overrides ?? EMPTY_OVERRIDES;
  const openDialog = onOpenOverrideDialog ?? NOOP_OPEN_DIALOG;

  const [query, setQuery] = useState('');
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
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="mb-4 flex items-center gap-4">
        <h2 className="text-lg font-semibold">Animation Breakdown</h2>
        <SearchBar
          value={query}
          onChange={setQuery}
          placeholder="Filter rows across cards…"
        />
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
        'border border-border rounded-md bg-panel overflow-hidden',
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
                    colSpan={7}
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
}

function BreakdownTable({ rows, query, onOpenOverrideDialog }: BreakdownTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-panel">
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
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.attachmentKey}
            className="border-b border-border hover:bg-accent/5"
          >
            <td className="py-2 px-3 font-mono text-sm text-fg">
              {highlightMatch(row.attachmentName, query)}
            </td>
            <td
              title={row.bonePath.join(' → ')}
              className="py-2 px-3 font-mono text-xs text-fg-muted max-w-[320px]"
            >
              {truncateMidEllipsis(row.bonePath, 48)}
            </td>
            <td className="py-2 px-3 font-mono text-sm text-fg text-right">
              {row.originalSizeLabel}
            </td>
            <td
              className={clsx(
                'py-2 px-3 font-mono text-sm text-right',
                row.override !== undefined ? 'text-accent' : 'text-fg',
              )}
              onDoubleClick={() => onOpenOverrideDialog(row)}
              title={
                row.override !== undefined
                  ? `Peak ${row.scaleLabel} × ${row.override}% = ${row.effectiveScale.toFixed(3)}×`
                  : undefined
              }
            >
              {row.effectiveScale.toFixed(3)}×
              {row.override !== undefined && <span> • {row.override}%</span>}
            </td>
            <td className={clsx(
              'py-2 px-3 font-mono text-sm text-right',
              row.override !== undefined ? 'text-accent' : 'text-fg',
            )}>
              {row.override !== undefined
                ? `${(row.effectiveWorldW).toFixed(0)}×${(row.effectiveWorldH).toFixed(0)}`
                : row.peakSizeLabel}
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
        ))}
      </tbody>
    </table>
  );
}
