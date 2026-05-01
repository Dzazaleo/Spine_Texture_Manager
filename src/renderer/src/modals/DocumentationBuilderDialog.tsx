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
  AnimationTrackEntry,
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
          {activePane === 'tracks' && (
            <TracksPane draft={draft} summary={props.summary} onChange={setDraft} />
          )}
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

function ExportPanePlaceholder() {
  // Filled in by Plan 04 (Export pane + IPC wiring).
  return (
    <div className="text-sm text-fg-muted italic p-4">
      Export pane — implementation in Plan 04.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Animation Tracks pane (FULL implementation per DOC-02 + UI-SPEC).
//
// First DnD surface in repo. HTML5 native DnD honors the locked contract:
//   - dragstart on side-list <li>: e.dataTransfer.effectAllowed='copy'
//     (Electron Chromium quirk per D-06) THEN setData with the namespaced
//     MIME 'application/x-stm-anim' (per D-06; avoids collision with the
//     existing OS file-drop pathway which filters on 'Files').
//   - dragover on track container: e.preventDefault() MANDATORY (HTML5 spec
//     — drop is silently rejected without it). Sets dropEffect='copy'.
//   - drop on track container: e.preventDefault() then getData with the
//     same MIME. Defensive name validation against summary.animations.names
//     rejects spoofed/stale payloads (T-20-13 mitigation).
//
// Empty-track tracking: tracks with zero entries exist in local state only
// (emptyTrackIndices). This is per D-05 — empty tracks are local-only;
// only tracks with at least one entry survive a save → reload round-trip.
// ---------------------------------------------------------------------------

interface TracksPaneProps {
  draft: Documentation;
  summary: SkeletonSummary;
  onChange: (next: Documentation) => void;
}

function TracksPane({ draft, summary, onChange }: TracksPaneProps) {
  // Track indices visible in the pane = union of indices that have entries
  // PLUS user-added empty tracks (local state). Persisted documentation
  // only carries entries; empty tracks live as local UI state.
  const [emptyTrackIndices, setEmptyTrackIndices] = useState<number[]>([]);

  const usedIndices = useMemo(() => {
    const s = new Set<number>();
    for (const e of draft.animationTracks) s.add(e.trackIndex);
    for (const i of emptyTrackIndices) s.add(i);
    return Array.from(s).sort((a, b) => a - b);
  }, [draft.animationTracks, emptyTrackIndices]);

  const nextTrackIndex = usedIndices.length === 0 ? 0 : Math.max(...usedIndices) + 1;

  const onAddTrack = () => {
    setEmptyTrackIndices((prev) => [...prev, nextTrackIndex]);
  };

  const onRemoveTrack = (trackIndex: number) => {
    const entriesInTrack = draft.animationTracks.filter((e) => e.trackIndex === trackIndex);
    if (entriesInTrack.length > 0) {
      const noun = entriesInTrack.length === 1 ? '1 entry' : `${entriesInTrack.length} entries`;
      const verb = entriesInTrack.length === 1 ? 'will be deleted' : 'will be deleted';
      if (!window.confirm(`Remove Track ${trackIndex}? ${noun} ${verb}.`)) return;
    }
    onChange({
      ...draft,
      animationTracks: draft.animationTracks.filter((e) => e.trackIndex !== trackIndex),
    });
    setEmptyTrackIndices((prev) => prev.filter((i) => i !== trackIndex));
  };

  const onAppendEntry = (trackIndex: number, animationName: string) => {
    if (!summary.animations.names.includes(animationName)) return; // T-20-13 defensive
    const newEntry: AnimationTrackEntry = {
      id: crypto.randomUUID(),
      trackIndex,
      animationName,
      mixTime: 0.25,
      loop: false,
      notes: '',
    };
    onChange({
      ...draft,
      animationTracks: [...draft.animationTracks, newEntry],
    });
    // Track is now backed by entries — drop the empty placeholder marker.
    setEmptyTrackIndices((prev) => prev.filter((i) => i !== trackIndex));
  };

  const onUpdateEntry = (id: string, patch: Partial<AnimationTrackEntry>) => {
    onChange({
      ...draft,
      animationTracks: draft.animationTracks.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    });
  };

  const onRemoveEntry = (id: string) => {
    const entry = draft.animationTracks.find((e) => e.id === id);
    onChange({
      ...draft,
      animationTracks: draft.animationTracks.filter((e) => e.id !== id),
    });
    // If removing this entry leaves the track empty, keep the track visible
    // by adding to emptyTrackIndices so the user doesn't lose context.
    if (entry) {
      const remainingInTrack = draft.animationTracks.filter(
        (e) => e.trackIndex === entry.trackIndex && e.id !== id,
      ).length;
      if (remainingInTrack === 0 && !emptyTrackIndices.includes(entry.trackIndex)) {
        setEmptyTrackIndices((prev) => [...prev, entry.trackIndex]);
      }
    }
  };

  const onMoveEntry = (id: string, direction: 'up' | 'down') => {
    const entry = draft.animationTracks.find((e) => e.id === id);
    if (!entry) return;
    const sameTrack = draft.animationTracks
      .map((e, idx) => ({ e, idx }))
      .filter((x) => x.e.trackIndex === entry.trackIndex);
    const pos = sameTrack.findIndex((x) => x.e.id === id);
    const swapPos = direction === 'up' ? pos - 1 : pos + 1;
    if (swapPos < 0 || swapPos >= sameTrack.length) return;
    const next = [...draft.animationTracks];
    const a = sameTrack[pos].idx;
    const b = sameTrack[swapPos].idx;
    [next[a], next[b]] = [next[b], next[a]];
    onChange({ ...draft, animationTracks: next });
  };

  return (
    <div className="flex gap-4 h-full p-2">
      {/* Side list — draggable animation names (DnD source). */}
      <aside className="w-64 flex-shrink-0 flex flex-col">
        <h3 className="text-base font-semibold text-fg mb-1">Animations</h3>
        <p className="text-xs text-fg-muted mb-3">Drag an animation onto a track</p>
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {summary.animations.names.map((name) => (
            <li
              key={name}
              draggable
              onDragStart={(e) => {
                // CRITICAL: effectAllowed='copy' MUST be set on dragstart for
                // Electron Chromium to render the drag image consistently
                // across macOS/Windows/Linux (D-06).
                e.dataTransfer.effectAllowed = 'copy';
                // Namespaced MIME — avoids collision with the existing OS
                // file-drop pathway (which filters on 'Files').
                e.dataTransfer.setData('application/x-stm-anim', name);
              }}
              className="cursor-grab px-2 py-1 text-sm font-mono text-fg border border-border rounded hover:border-accent hover:text-accent active:cursor-grabbing"
            >
              {name}
            </li>
          ))}
        </ul>
      </aside>

      {/* Track containers + Add Track button. */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
        {usedIndices.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <h3 className="text-base font-semibold text-fg">No tracks yet</h3>
            <p className="text-sm text-fg-muted mt-1">
              Click &quot;+ Add Track&quot; to start, then drag animations from the left.
            </p>
          </div>
        ) : (
          usedIndices.map((trackIndex) => (
            <TrackContainer
              key={trackIndex}
              trackIndex={trackIndex}
              entries={draft.animationTracks.filter((e) => e.trackIndex === trackIndex)}
              animationNames={summary.animations.names}
              onAppendEntry={(name) => onAppendEntry(trackIndex, name)}
              onUpdateEntry={onUpdateEntry}
              onRemoveEntry={onRemoveEntry}
              onMoveEntry={onMoveEntry}
              onRemoveTrack={() => onRemoveTrack(trackIndex)}
            />
          ))
        )}

        <button
          type="button"
          onClick={onAddTrack}
          disabled={summary.animations.count === 0}
          className="self-start border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
        >
          + Add Track
        </button>
      </div>
    </div>
  );
}

interface TrackContainerProps {
  trackIndex: number;
  entries: AnimationTrackEntry[];
  animationNames: string[];
  onAppendEntry: (name: string) => void;
  onUpdateEntry: (id: string, patch: Partial<AnimationTrackEntry>) => void;
  onRemoveEntry: (id: string) => void;
  onMoveEntry: (id: string, direction: 'up' | 'down') => void;
  onRemoveTrack: () => void;
}

function TrackContainer({
  trackIndex,
  entries,
  animationNames,
  onAppendEntry,
  onUpdateEntry,
  onRemoveEntry,
  onMoveEntry,
  onRemoveTrack,
}: TrackContainerProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <section
      onDragOver={(e) => {
        // MANDATORY: must call preventDefault on dragover to enable drop.
        // Without this the browser silently rejects the drop and onDrop
        // never fires. Standard HTML5 DnD invariant.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        if (!isDragOver) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        const name = e.dataTransfer.getData('application/x-stm-anim');
        if (!name) return;
        // Defensive: reject names not present in the current skeleton.
        // Mitigates T-20-13 (spoofed payload) and stale-drag scenarios.
        if (!animationNames.includes(name)) return;
        onAppendEntry(name);
      }}
      aria-label={`Track ${trackIndex}`}
      className={clsx(
        'border rounded-md p-3 min-h-[80px] transition-colors',
        isDragOver ? 'border-accent bg-accent/5' : 'border-border bg-surface',
      )}
    >
      <header className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-fg font-mono">Track {trackIndex}</h4>
        <button
          type="button"
          aria-label={`Remove Track ${trackIndex}`}
          onClick={onRemoveTrack}
          className="text-fg-muted hover:text-danger text-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
        >
          ✕
        </button>
      </header>

      {entries.length === 0 ? (
        <p className="text-xs text-fg-muted italic text-center py-4">Drop an animation here</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry, idx) => (
            <li
              key={entry.id}
              className="flex items-center gap-2 bg-panel border border-border rounded-md px-3 py-2"
            >
              <span className="font-mono text-sm text-fg flex-1 min-w-0 truncate">
                {entry.animationName}
              </span>

              <label className="text-xs text-fg-muted">Mix time</label>
              <input
                type="number"
                min={0}
                step={0.05}
                value={entry.mixTime}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v >= 0) onUpdateEntry(entry.id, { mixTime: v });
                }}
                aria-label={`Mix time for ${entry.animationName}`}
                className="bg-surface border border-border rounded px-1 py-0.5 text-xs text-fg w-16 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />
              <span className="text-xs text-fg-muted">s</span>

              <label className="inline-flex items-center gap-1 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={entry.loop}
                  onChange={(e) => onUpdateEntry(entry.id, { loop: e.target.checked })}
                  aria-label={`Loop for ${entry.animationName}`}
                />
                Loop
              </label>

              <input
                type="text"
                value={entry.notes}
                onChange={(e) => onUpdateEntry(entry.id, { notes: e.target.value })}
                placeholder="Notes for this entry…"
                aria-label={`Notes for ${entry.animationName}`}
                className="bg-surface border border-border rounded px-2 py-0.5 text-xs text-fg flex-1 min-w-[120px] focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />

              <button
                type="button"
                aria-label="Move up"
                onClick={() => onMoveEntry(entry.id, 'up')}
                disabled={idx === 0}
                className="text-fg-muted hover:text-fg text-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
              >
                ↑
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => onMoveEntry(entry.id, 'down')}
                disabled={idx === entries.length - 1}
                className="text-fg-muted hover:text-fg text-xs disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
              >
                ↓
              </button>
              <button
                type="button"
                aria-label="Remove entry"
                onClick={() => onRemoveEntry(entry.id)}
                className="text-fg-muted hover:text-danger text-xs cursor-pointer focus-visible:outline-2 focus-visible:outline-accent"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
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
