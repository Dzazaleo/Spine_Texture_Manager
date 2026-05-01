/**
 * Phase 20 Plan 02 — DocumentationBuilderDialog (10th hand-rolled modal).
 *
 * The 5-modal ARIA scaffold (role="dialog" + aria-modal="true" +
 * aria-labelledby + outer overlay onClick=close + inner stopPropagation +
 * useFocusTrap) is reused verbatim from OptimizeDialog.tsx:299-315 with the
 * modal-frame swaps locked by Phase 20 D-15 (min-w-[960px] max-w-[1100px]
 * max-h-[85vh]) and the title id swapped to documentation-builder-title.
 *
 * Three-pane composition (D-13): Animation Tracks (placeholder this plan,
 * filled in by Plan 03), Sections (full implementation per DOC-03 + D-09 /
 * D-10 / D-11 / D-12 / D-22), Export (placeholder this plan, filled in by
 * Plan 04). Tab state is modal-local useState; switches via a tab strip with
 * verbatim TabButton class string from AppShell.tsx:1487-1515.
 *
 * Sections pane sub-section content model (DOC-03):
 *   - Events       — auto-discovered from summary.events.names (D-09).
 *                    User authors a description per event. Drift policy
 *                    handled at materialize time by AppShell via
 *                    intersectDocumentationWithSummary.
 *   - Control Bones — auto-list ALL bones from summary.bones.names with a
 *                    debounced (100ms) filter input. Opt-in semantics
 *                    (D-10): only entries with description.length > 0 are
 *                    persisted; the live edit map maintains the full list
 *                    so erasing a description correctly removes the entry.
 *   - Skins        — auto-list ALL skins from summary.skins.names (D-11).
 *                    Empty descriptions are fine; ALL skins always written.
 *   - General Notes — single multi-line textarea (D-12). Plain text, no
 *                    Markdown. Plain-text discipline rendered via React
 *                    children — no dangerouslySetInnerHTML (T-20-07).
 *   - Safety Buffer — number input [0, 100]; metadata only this phase per
 *                    D-22. Backlog 999.7 wires the export-math multiplier.
 *
 * Tailwind v4 literal-class discipline (RESEARCH Pitfall 7): every className
 * is a string literal or clsx with literal branches. NO template strings, NO
 * runtime concatenation — the JIT scans source statically.
 *
 * Layer 3 invariant: imports only from react + clsx + ../hooks/useFocusTrap +
 * ../../../shared/types.js. Documentation-related types and helpers are
 * re-exported through shared/types.ts so the renderer never reaches into
 * src/core/* directly (tests/arch.spec.ts:19-34 grep gate honored).
 */
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { clsx } from 'clsx';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type {
  Documentation,
  EventDescriptionEntry,
  BoneDescriptionEntry,
  SkinDescriptionEntry,
  SkeletonSummary,
} from '../../../shared/types.js';

export interface DocumentationBuilderDialogProps {
  open: boolean;
  documentation: Documentation;
  summary: SkeletonSummary;
  onChange: (next: Documentation) => void;
  onClose: () => void;
}

type ActivePane = 'tracks' | 'sections' | 'export';

export function DocumentationBuilderDialog(props: DocumentationBuilderDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activePane, setActivePane] = useState<ActivePane>('tracks');

  // Local working copy of documentation — committed to parent via Save changes.
  // Reset to props.documentation each time the modal transitions closed → open
  // so re-opening after Cancel discards in-flight edits and re-opening after
  // a parent-side documentation update (e.g. drift policy on .stmproj reload)
  // picks up the new baseline.
  const [draft, setDraft] = useState<Documentation>(props.documentation);
  const wasOpenRef = useRef(false);
  if (props.open && !wasOpenRef.current) {
    setDraft(props.documentation);
    wasOpenRef.current = true;
  } else if (!props.open && wasOpenRef.current) {
    wasOpenRef.current = false;
  }

  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;

  const onSave = () => {
    props.onChange(draft);
    props.onClose();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="documentation-builder-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[960px] max-w-[1100px] max-h-[85vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="documentation-builder-title" className="text-sm text-fg mb-1">
          Documentation Builder
        </h2>
        <p className="text-xs text-fg-muted mb-4">
          Per-skeleton notes, animation tracks, and HTML export
        </p>

        {/* Tab strip — verbatim TabButton class string from AppShell.tsx:1487-1515 */}
        <nav role="tablist" className="flex gap-1 items-center mb-4 border-b border-border">
          <TabButton isActive={activePane === 'tracks'} onClick={() => setActivePane('tracks')}>
            Animation Tracks
          </TabButton>
          <TabButton isActive={activePane === 'sections'} onClick={() => setActivePane('sections')}>
            Sections
          </TabButton>
          <TabButton isActive={activePane === 'export'} onClick={() => setActivePane('export')}>
            Export
          </TabButton>
        </nav>

        {/* Active pane body — flex-1 to fill, overflow-y-auto for long rigs. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activePane === 'tracks' && <TracksPanePlaceholder />}
          {activePane === 'sections' && (
            <SectionsPane draft={draft} summary={props.summary} onChange={setDraft} />
          )}
          {activePane === 'export' && <ExportPanePlaceholder />}
        </div>

        {/* Footer — Cancel + Save changes (filled-primary CTA). */}
        <div className="flex gap-2 mt-6 justify-end">
          <button
            type="button"
            onClick={props.onClose}
            className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder panes (filled in by later plans).
// ---------------------------------------------------------------------------

function TracksPanePlaceholder() {
  // Filled in by Plan 03 (Animation Tracks DnD).
  return (
    <div className="text-sm text-fg-muted italic p-4">
      Animation Tracks pane — implementation in Plan 03.
    </div>
  );
}

function ExportPanePlaceholder() {
  // Filled in by Plan 04 (Export pane + IPC wiring).
  return (
    <div className="text-sm text-fg-muted italic p-4">
      Export pane — implementation in Plan 04.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections pane (FULL implementation per DOC-03 + UI-SPEC Sections pane copy).
// ---------------------------------------------------------------------------

interface SectionsPaneProps {
  draft: Documentation;
  summary: SkeletonSummary;
  onChange: (next: Documentation) => void;
}

function SectionsPane({ draft, summary, onChange }: SectionsPaneProps) {
  return (
    <div className="flex flex-col gap-6 p-2">
      <EventsSubSection draft={draft} summary={summary} onChange={onChange} />
      <ControlBonesSubSection draft={draft} summary={summary} onChange={onChange} />
      <SkinsSubSection draft={draft} summary={summary} onChange={onChange} />
      <GeneralNotesSubSection draft={draft} onChange={onChange} />
      <SafetyBufferSubSection draft={draft} onChange={onChange} />
    </div>
  );
}

function EventsSubSection({ draft, summary, onChange }: SectionsPaneProps) {
  // D-09: events auto-discovered from summary.events.names. User types a
  // description per event. Drift policy (intersect on reload) is handled by
  // AppShell at materialize time — this pane just edits the current draft.
  const descByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of draft.events) m.set(e.name, e.description);
    return m;
  }, [draft.events]);

  const setDescription = (name: string, description: string) => {
    // Replace or insert; preserve order = summary.events.names order.
    const next: EventDescriptionEntry[] = summary.events.names.map((n) => ({
      name: n,
      description: n === name ? description : descByName.get(n) ?? '',
    }));
    onChange({ ...draft, events: next });
  };

  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Events</h3>
      <p className="text-xs text-fg-muted mb-3">
        Auto-discovered from skeleton. Add a description per event.
      </p>
      {summary.events.count === 0 ? (
        <p className="text-sm text-fg-muted italic">This skeleton has no events.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {summary.events.names.map((name) => (
            <li key={name} className="flex items-start gap-3">
              <span className="font-mono text-xs text-danger min-w-[160px] pt-1">{name}</span>
              <input
                type="text"
                value={descByName.get(name) ?? ''}
                onChange={(e) => setDescription(name, e.target.value)}
                placeholder="Description…"
                aria-label={`Description for event ${name}`}
                className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ControlBonesSubSection({ draft, summary, onChange }: SectionsPaneProps) {
  // D-10: control bones auto-list ALL bones from summary.bones.names. User
  // opts in by typing a description (description.length > 0 means
  // "documented and saved"). Filter input REQUIRED (rigs may have hundreds).
  // 100ms debounce per Claude's Discretion in CONTEXT.md.
  // Save: only entries with description.length > 0 are written (D-10).
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  // Debounce filter input — 100ms setTimeout with cleanup. React-idiomatic.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filter), 100);
    return () => clearTimeout(t);
  }, [filter]);

  const descByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of draft.controlBones) m.set(b.name, b.description);
    return m;
  }, [draft.controlBones]);

  const visibleBones = useMemo(() => {
    if (debouncedFilter.length === 0) return summary.bones.names;
    const q = debouncedFilter.toLowerCase();
    return summary.bones.names.filter((n) => n.toLowerCase().includes(q));
  }, [summary.bones.names, debouncedFilter]);

  const setDescription = (name: string, description: string) => {
    // Persist only documented bones; preserve summary.bones.names order.
    const next: BoneDescriptionEntry[] = [];
    for (const n of summary.bones.names) {
      const desc = n === name ? description : descByName.get(n) ?? '';
      if (desc.length > 0) next.push({ name: n, description: desc });
    }
    onChange({ ...draft, controlBones: next });
  };

  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Control Bones</h3>
      <p className="text-xs text-fg-muted mb-3">
        Check the bones that act as controllers and add a description.
      </p>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter bones…"
        aria-label="Filter bones"
        className="w-full bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg mb-3 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      {visibleBones.length === 0 ? (
        <p className="text-sm text-fg-muted italic">No bones match &quot;{debouncedFilter}&quot;.</p>
      ) : (
        <ul className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
          {visibleBones.map((name) => (
            <li key={name} className="flex items-start gap-3">
              <span className="font-mono text-xs text-danger min-w-[200px] pt-1">{name}</span>
              <input
                type="text"
                value={descByName.get(name) ?? ''}
                onChange={(e) => setDescription(name, e.target.value)}
                placeholder="Description…"
                aria-label={`Description for bone ${name}`}
                className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SkinsSubSection({ draft, summary, onChange }: SectionsPaneProps) {
  // D-11: skins auto-list ALL from summary.skins.names; ALL skins always
  // written (even with empty descriptions). Order = summary.skins.names order.
  const descByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of draft.skins) m.set(s.name, s.description);
    return m;
  }, [draft.skins]);

  const setDescription = (name: string, description: string) => {
    const next: SkinDescriptionEntry[] = summary.skins.names.map((n) => ({
      name: n,
      description: n === name ? description : descByName.get(n) ?? '',
    }));
    onChange({ ...draft, skins: next });
  };

  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Skins</h3>
      <p className="text-xs text-fg-muted mb-3">
        Describe each skin variant. Empty descriptions are fine.
      </p>
      <ul className="flex flex-col gap-2">
        {summary.skins.names.map((name) => (
          <li key={name} className="flex items-start gap-3">
            <span className="font-mono text-xs text-blue-400 min-w-[160px] pt-1">{name}</span>
            <input
              type="text"
              value={descByName.get(name) ?? ''}
              onChange={(e) => setDescription(name, e.target.value)}
              placeholder="Description…"
              aria-label={`Description for skin ${name}`}
              className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GeneralNotesSubSection({
  draft,
  onChange,
}: {
  draft: Documentation;
  onChange: (next: Documentation) => void;
}) {
  // D-12: single multi-line textarea; plain text, no Markdown. React escapes
  // children-rendered strings by default and the textarea value is bound via
  // .value (controlled component) — no dangerouslySetInnerHTML surface (T-20-07).
  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">General Notes</h3>
      <p className="text-xs text-fg-muted mb-3">Freeform notes shown in the HTML export.</p>
      <textarea
        value={draft.generalNotes}
        onChange={(e) => onChange({ ...draft, generalNotes: e.target.value })}
        placeholder="e.g. This version had texture improvements and animation clean-up."
        aria-label="General notes"
        rows={6}
        className="w-full bg-surface border border-border rounded-md px-2 py-2 text-sm text-fg font-sans focus:outline-none focus-visible:outline-2 focus-visible:outline-accent resize-y"
      />
    </section>
  );
}

function SafetyBufferSubSection({
  draft,
  onChange,
}: {
  draft: Documentation;
  onChange: (next: Documentation) => void;
}) {
  // D-22: number input [0, 100]; metadata only this phase. Step 0.5.
  // Out-of-range input is silently ignored — the validator already enforces
  // [0, 100] on save (validateDocumentation in src/core/documentation.ts).
  const onChangeValue = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange({ ...draft, safetyBufferPercent: 0 });
      return;
    }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > 100) return; // ignore out-of-range
    onChange({ ...draft, safetyBufferPercent: v });
  };
  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Safety Buffer</h3>
      <p className="text-xs text-fg-muted mb-3">
        Metadata only. Captured in the HTML export; export math wiring deferred to a future phase.
      </p>
      <div className="inline-flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={draft.safetyBufferPercent}
          onChange={onChangeValue}
          aria-label="Safety buffer percent"
          className="bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg w-24 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        <span className="text-sm text-fg-muted">%</span>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// TabButton — verbatim class string from AppShell.tsx:1487-1515 per D-13.
// Inline-redefined per PATTERNS.md "Pattern 4 reuse decision" (option 2):
// no cross-file refactor in this plan; the CLASS STRING is byte-identical
// so the Tailwind v4 JIT and the visual + a11y contracts both match.
// ---------------------------------------------------------------------------

function TabButton({
  isActive,
  onClick,
  children,
}: {
  isActive: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      type="button"
      aria-selected={isActive}
      onClick={onClick}
      className={clsx(
        'relative px-4 py-2 text-sm font-sans transition-colors focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
        isActive ? 'font-semibold text-accent' : 'font-normal text-fg-muted hover:text-fg',
      )}
    >
      {children}
      {isActive && (
        <span aria-hidden className="absolute left-0 right-0 -bottom-px h-[2px] bg-accent" />
      )}
    </button>
  );
}
