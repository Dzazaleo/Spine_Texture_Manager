---
phase: 20
plan: 02
type: execute
wave: 2
depends_on: [20-01]
files_modified:
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx
  - src/renderer/src/components/AppShell.tsx
autonomous: true
requirements:
  - DOC-01
  - DOC-03
tags:
  - electron
  - react
  - tailwind
  - modal
  - aria
  - renderer

must_haves:
  truths:
    - "User clicks the top-bar Documentation button and the DocumentationBuilderDialog opens with three tabs (Animation Tracks / Sections / Export)"
    - "Modal scaffold uses the 5-modal ARIA pattern (role='dialog', aria-modal='true', aria-labelledby, useFocusTrap, outer overlay onClick close, inner stopPropagation)"
    - "Modal width is min-w-[960px] max-w-[1100px] max-h-[85vh] per D-15"
    - "User can switch between the three panes by clicking tabs; ARIA reflects the active tab (role='tablist' on the strip; aria-selected='true' on the active tab button) — backed by the verbatim TabButton component from AppShell.tsx so the visual + a11y contract matches the existing tab-strips in the app"
    - "Sections pane renders five sub-sections: Events (auto-list from summary.events.names with description input per event), Control Bones (filterable, opt-in via description.length > 0), Skins (auto-list from summary.skins.names with description input), General Notes (textarea), Safety Buffer (number input 0-100)"
    - "Animation Tracks pane and Export pane render placeholder bodies (filled in by later plans)"
    - "Documentation top-bar button at AppShell.tsx:1184-1196 has disabled/aria-disabled/title removed and onClick wired to setDocumentationBuilderOpen(true)"
    - "AppShell.tsx carries documentationBuilderOpen + documentation state; buildSessionState returns documentation in the AppSessionState payload so saves persist authored content"
    - "On materialize/load, AppShell intersects materialized.documentation entries with current skeleton summary names (D-09/D-10/D-11 drift policy)"
  artifacts:
    - path: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      provides: "10th hand-rolled modal with tab strip + Sections pane filled in"
      min_lines: 250
      contains:
        - "role=\"dialog\""
        - "aria-modal=\"true\""
        - "useFocusTrap"
        - "min-w-[960px] max-w-[1100px] max-h-[85vh]"
        - "Animation Tracks"
        - "Sections"
        - "Export"
    - path: src/renderer/src/components/AppShell.tsx
      provides: "Wire Documentation button + state hoist + drift policy"
      contains:
        - "setDocumentationBuilderOpen"
        - "documentation,"
        - "DocumentationBuilderDialog"
  key_links:
    - from: src/renderer/src/components/AppShell.tsx
      to: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      via: "JSX <DocumentationBuilderDialog open={documentationBuilderOpen} ... />"
      pattern: "<DocumentationBuilderDialog"
    - from: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      to: src/renderer/src/hooks/useFocusTrap.ts
      via: "import { useFocusTrap } from '../hooks/useFocusTrap'"
      pattern: "useFocusTrap\\(dialogRef"
    - from: src/renderer/src/components/AppShell.tsx
      to: src/core/documentation.ts (via shared/types re-export)
      via: "import { DEFAULT_DOCUMENTATION, intersectDocumentationWithSummary, type Documentation }"
      pattern: "intersectDocumentationWithSummary"
---

<objective>
Build the DocumentationBuilderDialog modal scaffold and wire it into AppShell. This plan delivers DOC-01 (modal accessible from top-bar) and DOC-03 (Sections pane content model — events, control bones, skins, general notes, safety buffer). Animation Tracks pane and Export pane are placeholder bodies filled in by Plan 03 and Plan 04 respectively.

Purpose: Lay the modal frame + state plumbing so subsequent plans can swap pane bodies without touching the scaffold or AppShell wiring.

Output:
- `src/renderer/src/modals/DocumentationBuilderDialog.tsx` (NEW) — 10th hand-rolled modal with 5-modal ARIA scaffold, tab strip, Sections pane (full content), Animation Tracks pane (placeholder), Export pane (placeholder)
- `src/renderer/src/components/AppShell.tsx` extended — `documentationBuilderOpen` + `documentation` state, drift-policy intersection on materialize, `buildSessionState` extension, Documentation button wiring (remove disabled, add onClick), modal mount
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/20-documentation-builder-feature/20-CONTEXT.md
@.planning/phases/20-documentation-builder-feature/20-RESEARCH.md
@.planning/phases/20-documentation-builder-feature/20-PATTERNS.md
@.planning/phases/20-documentation-builder-feature/20-UI-SPEC.md
@.planning/phases/20-documentation-builder-feature/20-01-core-types-validator-summary-SUMMARY.md
@./CLAUDE.md
@src/renderer/src/modals/OptimizeDialog.tsx
@src/renderer/src/modals/OverrideDialog.tsx
@src/renderer/src/components/AppShell.tsx
@src/renderer/src/hooks/useFocusTrap.ts
@src/core/documentation.ts

<interfaces>
<!-- Verbatim references the executor needs. -->

5-modal ARIA scaffold (verbatim from src/renderer/src/modals/OptimizeDialog.tsx:299-315):

```tsx
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
    <h2 id="optimize-title" className="text-sm text-fg mb-4">{headerTitle}</h2>
```

For Phase 20: swap `min-w-[640px] max-w-[800px] max-h-[80vh]` → `min-w-[960px] max-w-[1100px] max-h-[85vh]` and the `aria-labelledby` / `<h2 id>` to `documentation-builder-title`.

useFocusTrap usage (verbatim from src/renderer/src/modals/OverrideDialog.tsx:71):

```tsx
useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });
```

TabButton (existing — at src/renderer/src/components/AppShell.tsx:1478-1507; promote to a shared module OR inline-redefine with byte-identical body):

```tsx
function TabButton({ isActive, onClick, children }: {
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
```

Documentation button (existing placeholder at src/renderer/src/components/AppShell.tsx:1184-1196):

```tsx
<button
  type="button"
  disabled
  aria-disabled="true"
  title="Available in v1.2 Phase 20"
  className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
>
  Documentation
</button>
```

Phase 20 transformation: REMOVE `disabled`, `aria-disabled`, `title`. ADD `onClick={() => setDocumentationBuilderOpen(true)}`. Class string preserved verbatim.

State hoist parallel (existing pattern at src/renderer/src/components/AppShell.tsx:159):

```tsx
const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
```

Phase 20 adds:

```tsx
const [documentationBuilderOpen, setDocumentationBuilderOpen] = useState(false);
const [documentation, setDocumentation] = useState<Documentation>(DEFAULT_DOCUMENTATION);
```

buildSessionState extension (src/renderer/src/components/AppShell.tsx:578-597) — append `documentation,` to the returned object literal and add `documentation` to the useCallback deps array.

Modal mount placement: alongside the existing `{atlasPreviewOpen && (` block (~line 1387 in AppShell.tsx). Render `<DocumentationBuilderDialog .../>` parallel.
</interfaces>

<copy_contract>
<!-- All copy locked by 20-UI-SPEC.md "Copywriting Contract" — use verbatim. -->

Modal frame:
- Title: "Documentation Builder"
- Sub-title: "Per-skeleton notes, animation tracks, and HTML export"
- Tab labels: "Animation Tracks" | "Sections" | "Export"
- Footer: Cancel / Save changes

Sections pane:
- Events heading: "Events"; helper: "Auto-discovered from skeleton. Add a description per event."; empty: "This skeleton has no events."
- Control Bones heading: "Control Bones"; helper: "Check the bones that act as controllers and add a description."; filter placeholder: "Filter bones…"; filter empty: 'No bones match "{QUERY}".'
- Skins heading: "Skins"; helper: "Describe each skin variant. Empty descriptions are fine."
- General Notes heading: "General Notes"; helper: "Freeform notes shown in the HTML export."; textarea placeholder: "e.g. This version had texture improvements and animation clean-up."
- Safety Buffer heading: "Safety Buffer"; helper: "Metadata only. Captured in the HTML export; export math wiring deferred to a future phase."; suffix: "%"
</copy_contract>

</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Create DocumentationBuilderDialog.tsx scaffold + tab strip + Sections pane</name>
  <files>src/renderer/src/modals/DocumentationBuilderDialog.tsx</files>
  <read_first>
    - src/renderer/src/modals/OptimizeDialog.tsx (full file — focus on 260-312 scaffold)
    - src/renderer/src/modals/OverrideDialog.tsx (full file — focus on 60-160 useFocusTrap + footer)
    - src/renderer/src/components/AppShell.tsx (lines 1155-1175 tab strip; lines 1478-1507 TabButton)
    - src/renderer/src/hooks/useFocusTrap.ts (full file — confirm signature + onEscape behavior)
    - src/core/documentation.ts (verify exported types)
    - .planning/phases/20-documentation-builder-feature/20-UI-SPEC.md (full file — Copywriting Contract + Visual State Inventory)
    - .planning/phases/20-documentation-builder-feature/20-PATTERNS.md (lines 237-446 — modal patterns)
    - .planning/phases/20-documentation-builder-feature/20-CONTEXT.md (D-13, D-14, D-15, D-16 — modal composition)
  </read_first>
  <action>
Create `src/renderer/src/modals/DocumentationBuilderDialog.tsx`. This is the 10th hand-rolled modal in the project — follow the 5-modal ARIA scaffold verbatim.

**File-top imports:**

```tsx
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { clsx } from 'clsx';
import { useFocusTrap } from '../hooks/useFocusTrap';
import type { Documentation, EventDescriptionEntry, BoneDescriptionEntry, SkinDescriptionEntry } from '../../../shared/types.js';
import type { SkeletonSummary } from '../../../shared/types.js';
```

**Props:**

```tsx
export interface DocumentationBuilderDialogProps {
  open: boolean;
  documentation: Documentation;
  summary: SkeletonSummary;
  onChange: (next: Documentation) => void;
  onClose: () => void;
}
```

**Component body — scaffold:**

```tsx
export function DocumentationBuilderDialog(props: DocumentationBuilderDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [activePane, setActivePane] = useState<'tracks' | 'sections' | 'export'>('tracks');

  // Local working copy of documentation — committed to parent via Save changes.
  // Reset to props.documentation each time the modal opens (handled below).
  const [draft, setDraft] = useState<Documentation>(props.documentation);

  // Reset draft to props.documentation when modal transitions from closed → open.
  // Use a ref to detect the transition (prevents draft-loss on parent re-renders
  // while the modal is open).
  const wasOpenRef = useRef(false);
  if (props.open && !wasOpenRef.current) {
    // First render after open — reset draft.
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

        {/* Tab strip — verbatim TabButton class string from AppShell.tsx:1478-1507 */}
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

        {/* Active pane body — flex-1 to fill, overflow-y-auto for long rigs */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activePane === 'tracks' && (
            <TracksPanePlaceholder />
          )}
          {activePane === 'sections' && (
            <SectionsPane
              draft={draft}
              summary={props.summary}
              onChange={setDraft}
            />
          )}
          {activePane === 'export' && (
            <ExportPanePlaceholder />
          )}
        </div>

        {/* Footer — verbatim Cancel / primary CTA pattern from OverrideDialog.tsx:131-160 */}
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
```

**Inline TabButton (verbatim class string from AppShell.tsx:1478-1507):**

Define a local `function TabButton(...)` at the bottom of the file with the exact same body as AppShell.tsx:1478-1507. Use the inline-redefine option per PATTERNS.md "Pattern 4 reuse decision" — no cross-file refactor in this plan. The CLASS STRING must be byte-identical.

**Placeholder panes:**

```tsx
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
```

**Sections pane (FULL implementation per DOC-03 + UI-SPEC Sections pane copy):**

```tsx
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
  // D-09: events auto-discovered from summary.events.names. User types
  // description per event. Drift policy (intersect on reload) is handled
  // by AppShell at materialize time — this pane just edits the current draft.

  // Build a name → description lookup from draft.events for fast updates.
  const descByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of draft.events) m.set(e.name, e.description);
    return m;
  }, [draft.events]);

  const setDescription = (name: string, description: string) => {
    // Replace or insert; preserve order = summary.events.names order.
    const next: EventDescriptionEntry[] = summary.events.names.map((n) => ({
      name: n,
      description: n === name ? description : (descByName.get(n) ?? ''),
    }));
    onChange({ ...draft, events: next });
  };

  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Events</h3>
      <p className="text-xs text-fg-muted mb-3">Auto-discovered from skeleton. Add a description per event.</p>
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
  // D-10: control bones auto-list ALL bones from summary.bones.names.
  // User opts in by typing a description (description.length > 0 means
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

  // Live-edit map: bone name → description. Stored in draft.controlBones
  // ONLY when description.length > 0 (D-10 contract).
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
      const desc = n === name ? description : (descByName.get(n) ?? '');
      if (desc.length > 0) next.push({ name: n, description: desc });
    }
    onChange({ ...draft, controlBones: next });
  };

  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Control Bones</h3>
      <p className="text-xs text-fg-muted mb-3">Check the bones that act as controllers and add a description.</p>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter bones…"
        className="w-full bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg mb-3 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
      />
      {visibleBones.length === 0 ? (
        <p className="text-sm text-fg-muted italic">No bones match "{debouncedFilter}".</p>
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
                className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Add `useEffect` to the file-top React import alongside `useMemo, useRef, useState, type ChangeEvent`. The hook order inside `ControlBonesSubSection` is now contiguous and final: `useState (filter, debouncedFilter)` → `useEffect (debounce setTimeout/clearTimeout)` → `useMemo (descByName)` → `useMemo (visibleBones using debouncedFilter)` → `setDescription` arrow → render.

```tsx
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
      description: n === name ? description : (descByName.get(n) ?? ''),
    }));
    onChange({ ...draft, skins: next });
  };

  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Skins</h3>
      <p className="text-xs text-fg-muted mb-3">Describe each skin variant. Empty descriptions are fine.</p>
      <ul className="flex flex-col gap-2">
        {summary.skins.names.map((name) => (
          <li key={name} className="flex items-start gap-3">
            <span className="font-mono text-xs text-blue-400 min-w-[160px] pt-1">{name}</span>
            <input
              type="text"
              value={descByName.get(name) ?? ''}
              onChange={(e) => setDescription(name, e.target.value)}
              placeholder="Description…"
              className="flex-1 bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GeneralNotesSubSection({ draft, onChange }: { draft: Documentation; onChange: (next: Documentation) => void }) {
  // D-12: single multi-line textarea; plain text, no Markdown.
  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">General Notes</h3>
      <p className="text-xs text-fg-muted mb-3">Freeform notes shown in the HTML export.</p>
      <textarea
        value={draft.generalNotes}
        onChange={(e) => onChange({ ...draft, generalNotes: e.target.value })}
        placeholder="e.g. This version had texture improvements and animation clean-up."
        rows={6}
        className="w-full bg-surface border border-border rounded-md px-2 py-2 text-sm text-fg font-sans focus:outline-none focus-visible:outline-2 focus-visible:outline-accent resize-y"
      />
    </section>
  );
}

function SafetyBufferSubSection({ draft, onChange }: { draft: Documentation; onChange: (next: Documentation) => void }) {
  // D-22: number input [0, 100]; metadata only this phase. Step 0.5.
  const onChangeValue = (e: ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') { onChange({ ...draft, safetyBufferPercent: 0 }); return; }
    const v = Number(raw);
    if (!Number.isFinite(v) || v < 0 || v > 100) return; // ignore out-of-range
    onChange({ ...draft, safetyBufferPercent: v });
  };
  return (
    <section>
      <h3 className="text-base font-semibold text-fg mb-1">Safety Buffer</h3>
      <p className="text-xs text-fg-muted mb-3">Metadata only. Captured in the HTML export; export math wiring deferred to a future phase.</p>
      <div className="inline-flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={draft.safetyBufferPercent}
          onChange={onChangeValue}
          className="bg-surface border border-border rounded-md px-2 py-1 text-sm text-fg w-24 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
        />
        <span className="text-sm text-fg-muted">%</span>
      </div>
    </section>
  );
}
```

**Final TabButton (paste at bottom of file — byte-identical to AppShell.tsx:1478-1507):**

```tsx
function TabButton({ isActive, onClick, children }: { isActive: boolean; onClick: () => void; children: React.ReactNode }) {
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
```

Tailwind v4 literal-class discipline (Pitfall 7 from RESEARCH.md): EVERY className= in this file MUST be a string literal or `clsx` with literal branches. NO template strings, NO runtime concatenation. The Tailwind v4 JIT scans source for class strings.

ARIA discipline: ensure `<input>` and `<textarea>` elements WITHOUT a visible `<label>` use `aria-label` or are paired with the heading via `aria-labelledby` for screen readers. The simplest fix: add `aria-label="<copy>"` to each input where the visible label is the bone/event/skin name (e.g. `aria-label={`Description for ${name}`}`).
  </action>
  <verify>
    <automated>npm run typecheck && npm run test -- tests/arch.spec.ts</automated>
  </verify>
  <acceptance_criteria>
    - File `src/renderer/src/modals/DocumentationBuilderDialog.tsx` exists
    - `grep -c 'role="dialog"' src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c 'aria-modal="true"' src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "useFocusTrap(dialogRef" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "min-w-\[960px\] max-w-\[1100px\] max-h-\[85vh\]" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c 'role="tablist"' src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "Animation Tracks" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "Sections" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "Export" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "Save changes" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "This skeleton has no events" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "Filter bones" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "safetyBufferPercent" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 2
    - `grep -E "from 'electron|require\\('electron'\\)" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns NOTHING (renderer can't import electron)
    - TypeScript typecheck passes
  </acceptance_criteria>
  <done>
    DocumentationBuilderDialog mounts with the 5-modal ARIA scaffold, three-tab strip, full Sections pane (Events / Control Bones with filter / Skins / General Notes / Safety Buffer), placeholder Tracks + Export panes, and Cancel / Save changes footer. All copy verbatim from UI-SPEC. All className= values are literal strings or clsx with literal branches. Module compiles without typecheck errors.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire Documentation button + state hoist + drift policy in AppShell.tsx</name>
  <files>src/renderer/src/components/AppShell.tsx</files>
  <read_first>
    - src/renderer/src/components/AppShell.tsx (read these specific ranges via grep + offset Read: lines 1-200 imports + initial state hooks; lines 575-700 buildSessionState + project handlers; lines 1180-1210 Documentation button placeholder; lines 1380-1420 modal mount block; lines 1478-1510 TabButton)
    - src/core/documentation.ts (verify DEFAULT_DOCUMENTATION export)
    - src/shared/types.ts (confirm AppSessionState now requires documentation; SkeletonSummary now has events)
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx (confirm props interface from Task 1)
    - .planning/phases/20-documentation-builder-feature/20-PATTERNS.md (lines 803-940 — AppShell extension sites + drift policy)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 1008-1019 (drift policy specifics)
  </read_first>
  <action>
**Step A — Add file-top imports.** Add to the existing imports near the top of `AppShell.tsx`:

```tsx
import { DocumentationBuilderDialog } from '../modals/DocumentationBuilderDialog';
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../../shared/types.js';
```

(Note: `Documentation` types are re-exported through `shared/types.ts` per Plan 01 Task 2, so the renderer's import path is `'../../../shared/types.js'` — staying within the Layer 3 invariant via the re-export route.)

**Step B — Add useState hooks** parallel to `atlasPreviewOpen` at line 159:

```tsx
// Phase 20 D-01 — Documentation Builder modal lifecycle.
const [documentationBuilderOpen, setDocumentationBuilderOpen] = useState(false);
const [documentation, setDocumentation] = useState<Documentation>(DEFAULT_DOCUMENTATION);
```

**Step C — Extend `buildSessionState`** at lines 578-597. Add `documentation,` as the last property in the returned object literal AND `documentation` as the last entry in the `useCallback` dependency array. Final shape:

```tsx
const buildSessionState = useCallback(
  (): AppSessionState => ({
    skeletonPath: summary.skeletonPath,
    atlasPath: summary.atlasPath ?? null,
    imagesDir: null,
    overrides: Object.fromEntries(overrides),
    samplingHz: samplingHzLocal,
    lastOutDir: null,
    sortColumn: 'attachmentName',
    sortDir: 'asc',
    documentation,                                          // NEW (Phase 20 D-01)
  }),
  [summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal, documentation],  // documentation added
);
```

**Step D — Add drift policy on materialize.** The drift logic is encapsulated in `intersectDocumentationWithSummary(doc, summary): Documentation` in `src/core/documentation.ts` (landed in Plan 01 Task 1). This plan only wires the call site.

Add a file-top import (alongside the existing `DEFAULT_DOCUMENTATION` import):

```tsx
import { DEFAULT_DOCUMENTATION, intersectDocumentationWithSummary, type Documentation } from '../../../shared/types.js';
```

(Plan 01 Task 2 Step B lands the runtime re-export of `intersectDocumentationWithSummary` through `shared/types.ts` — same route as `DEFAULT_DOCUMENTATION`. Confirm the line is present after the type re-export block; if missing, this task adds it.)

Locate AppShell's existing project-load reducer / handler that processes the `loaded` / `projectLoaded` AppState branch. AppShell does NOT call `materializeProjectFile` directly — materialization happens in `App.tsx` (or the upstream AppState reducer) and the materialized `AppSessionState` arrives as `props.session` (or equivalent) when AppShell mounts on `loaded` / `projectLoaded`. The drift-policy hook lives in AppShell because that is where the renderer first sees the materialized documentation alongside the live `summary`.

Add ONE `useEffect` near the top of AppShell (alongside the existing skeleton-load effect) that calls `intersectDocumentationWithSummary` exactly ONCE per (summary, materialized.documentation) tuple:

```tsx
// Phase 20 D-09/D-10/D-11 — drift policy: realign loaded documentation with
// the current skeleton. Mirrors Phase 8 D-150 stale-overrides intersection.
// This effect runs on mount AND whenever a new skeleton+session arrives
// (which re-mounts AppShell on the AppState branch transition; React's
// reconciliation makes this idempotent).
useEffect(() => {
  if (!props.session) return; // 'loaded' branch with no prior session — leave default
  const drifted = intersectDocumentationWithSummary(
    props.session.documentation,
    summary,
  );
  setDocumentation(drifted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [props.session?.documentation, summary]);
```

If AppShell receives the loaded session via a different prop name (e.g. `projectLoadedState.session`, `restoredState`, etc.), substitute the actual name. Search AppShell.tsx for the props type that carries `documentation` from the AppState reducer; the planner-noted location is around the `loaded` / `projectLoaded` branches near line 192-198 (the comment "state.project.samplingHz on the projectLoaded branch" cites the existing analog).

When AppShell mounts on `loaded` (fresh skeleton, no `.stmproj`) — i.e. there is no prior `documentation` to drift — seed the AppShell-local `documentation` state from `intersectDocumentationWithSummary(DEFAULT_DOCUMENTATION, summary)` so events + skins are pre-populated with empty descriptions ready to author. This is the SAME function call as the materialize path; the input is just `DEFAULT_DOCUMENTATION` instead of a saved doc:

```tsx
// Initial seed for fresh skeleton load (no .stmproj). Use the same drift
// helper to keep events + skins aligned with summary on first paint.
const [documentation, setDocumentation] = useState<Documentation>(() =>
  intersectDocumentationWithSummary(DEFAULT_DOCUMENTATION, summary),
);
```

(Single helper, single call site; resolves checker BLOCKER 3 INFO 12 by eliminating the multi-site-risk inline drift block.)

When loading a fresh skeleton WITHOUT a `.stmproj` (no documentation to drift), reset to a base shape with auto-discovered events/skins:

```tsx
// On fresh skeleton load (no .stmproj): seed events + skins from current summary
// so the Sections pane is pre-populated with empty descriptions.
const baseDoc: Documentation = {
  ...DEFAULT_DOCUMENTATION,
  events: summary.events.names.map((n) => ({ name: n, description: '' })),
  skins: summary.skins.names.map((n) => ({ name: n, description: '' })),
};
setDocumentation(baseDoc);
```

Apply this at the existing fresh-skeleton-load handler (search for `setOverrides(new Map())` or similar reset calls and add this `setDocumentation(baseDoc)` adjacent).

**Step E — Wire the Documentation top-bar button.** Locate lines 1184-1196 (the existing placeholder). REMOVE the `disabled`, `aria-disabled="true"`, and `title="Available in v1.2 Phase 20"` attributes. ADD `onClick={() => setDocumentationBuilderOpen(true)}`. The className must remain BYTE-IDENTICAL.

```tsx
<button
  type="button"
  onClick={() => setDocumentationBuilderOpen(true)}
  className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
>
  Documentation
</button>
```

**Step F — Mount the modal.** Locate the existing `{atlasPreviewOpen && (` block (~line 1387 area). Add a parallel block:

```tsx
<DocumentationBuilderDialog
  open={documentationBuilderOpen}
  documentation={documentation}
  summary={summary}
  onChange={setDocumentation}
  onClose={() => setDocumentationBuilderOpen(false)}
/>
```

(Conditional rendering not required — the component returns null when `!props.open`.)

**Step G — Update the modal-open audit list.** AppShell.tsx has an existing comment block listing modal lifecycle (around lines 841-872). Add `documentationBuilderOpen` to the list and to any aggregated "is any modal open" boolean if one exists (search for `atlasPreviewOpen ||` in the surrounding lines).

If a `useEffect`-based audit (around lines 850-872) tracks open modals for some keyboard handler, include `documentationBuilderOpen` in that list and the dependency array. Treat it parallel to `atlasPreviewOpen`.
  </action>
  <verify>
    <automated>npm run typecheck && npm run test</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "setDocumentationBuilderOpen" src/renderer/src/components/AppShell.tsx` returns at least 2 (declaration + button + close)
    - `grep -c "DocumentationBuilderDialog" src/renderer/src/components/AppShell.tsx` returns at least 2 (import + JSX mount)
    - `grep -c "DEFAULT_DOCUMENTATION" src/renderer/src/components/AppShell.tsx` returns at least 1
    - `grep -c "Available in v1.2 Phase 20" src/renderer/src/components/AppShell.tsx` returns 0 (placeholder title removed — this is the strongest signal that the disabled-button block was rewritten; the placeholder title was the unique anchor for the disabled state)
    - `grep -B5 ">Documentation<" src/renderer/src/components/AppShell.tsx | grep -c " disabled"` returns 0 (multi-line check confirming the `<button>` immediately preceding the `>Documentation<` text node has no `disabled` attribute on its tag)
    - `grep -c "documentation," src/renderer/src/components/AppShell.tsx` returns at least 1 (in buildSessionState)
    - `grep -c "intersectDocumentationWithSummary" src/renderer/src/components/AppShell.tsx` returns at least 2 (initial seed via useState lazy init + load-side useEffect)
    - `npm run typecheck` exits 0
    - `npm run test` full suite exits 0
  </acceptance_criteria>
  <done>
    The Documentation top-bar button opens the modal. AppShell carries `documentation` state seeded from the current skeleton (with auto-discovered events + skins on fresh load) and intersected against the live skeleton on `.stmproj` reload (drift policy). `buildSessionState` returns the documentation in the AppSessionState payload, so the existing `project:save` IPC route persists it via the validator + serializer landed in Plan 01. Modal mount alongside the existing AtlasPreviewModal mount. Class string preserved verbatim. Typecheck + full test suite green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User-typed text → renderer state | User-supplied descriptions, notes, filter strings are only stored in renderer state in this plan; no IPC traversal yet |
| renderer drift logic → AppSessionState | After load, renderer-side intersection drops/adds entries based on the live SkeletonSummary; drop is documented behavior, not an information leak |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-07 | Tampering (XSS in modal) | Renderer text rendering of user-typed descriptions | mitigate | React 19 escapes children-rendered strings by default. Acceptance criterion: no `dangerouslySetInnerHTML` introduced (`grep -c dangerouslySetInnerHTML src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 0). |
| T-20-08 | Information Disclosure (drift) | AppShell drift-policy block | accept | Phase 20 D-09/D-10/D-11 specify silent drop of stale entries. The dropped data was already orphaned (referenced names no longer in skeleton); persisting it would only cause stale HTML export rendering. |
| T-20-09 | Denial of Service (large rig) | ControlBonesSubSection filter | mitigate | 100ms debounce on filter input (per CONTEXT.md Claude's Discretion); pure renderer-side substring match; max-h-[300px] overflow-y-auto on the list keeps DOM bounded. |
| T-20-10 | Tampering (Tailwind v4 literal-class scanner miss) | DocumentationBuilderDialog.tsx | mitigate | Every className= is a string literal or `clsx(literal, ...)` with literal branches per Pitfall 7. No template strings, no runtime concatenation. |
| T-20-11 | Modal accessibility regression | DocumentationBuilderDialog scaffold | mitigate | 5-modal ARIA scaffold preserved verbatim from OptimizeDialog.tsx:299-315. useFocusTrap traps focus + Escape closes. No `tabIndex={-1}` on tab buttons. Inputs without visible labels carry `aria-label`. |
| T-20-12 | Layer 3 invariant leak | Documentation type re-export route | mitigate | Renderer imports `Documentation` and `DEFAULT_DOCUMENTATION` through `'../../../shared/types.js'` re-export (not directly from `core/documentation.ts`) — preserves arch.spec.ts:19-34 renderer-boundary grep. |
</threat_model>

<verification>
After both tasks land:

1. `npm run typecheck` exits 0
2. `npm run test` full suite exits 0 (no regressions; arch.spec.ts:19-34 + :116-134 stay green)
3. `npm run dev` smoke (manual): clicking Documentation top-bar button opens the modal; tabs switch between three panes; Sections pane lists events / control bones (filterable) / skins / general notes / safety buffer with the locked copy from UI-SPEC; Cancel and Escape close without saving; Save changes commits draft to `documentation` state
4. `grep -E "dangerouslySetInnerHTML|innerHTML\\s*=" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns NOTHING (no XSS surface)
5. `grep -E "from 'electron|require\\('electron'\\)" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns NOTHING (renderer cannot import electron)
</verification>

<success_criteria>
- DocumentationBuilderDialog opens from the top-bar Documentation button (DOC-01)
- Modal scaffold complies with the 5-modal ARIA pattern verbatim
- Tab strip switches between Animation Tracks (placeholder) / Sections (full) / Export (placeholder)
- Sections pane delivers DOC-03: events auto-discovered + control bones (filtered + opt-in) + skins (auto-listed) + general notes (textarea) + safety buffer (number input)
- AppShell carries documentation state, persists it via buildSessionState → AppSessionState → existing project:save IPC, and intersects on materialize per the drift policy
- Class string on the Documentation button preserved byte-identical (only attributes changed)
- Layer 3 invariant preserved (no electron imports in renderer modal; types re-exported via shared/types.ts)
- Typecheck + full test suite green
</success_criteria>

<output>
After completion, create `.planning/phases/20-documentation-builder-feature/20-02-modal-shell-sections-pane-SUMMARY.md` documenting:
- Modal scaffold structure (5-modal ARIA + tab strip + footer)
- Sections pane sub-section design (events / control bones with filter / skins / general notes / safety buffer)
- AppShell integration points (state hoist, buildSessionState, drift policy, button wiring)
- Copy locked from UI-SPEC verbatim
- Tailwind v4 literal-class discipline confirmed
</output>
