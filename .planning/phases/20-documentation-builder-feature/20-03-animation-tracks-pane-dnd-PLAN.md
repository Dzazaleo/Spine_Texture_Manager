---
phase: 20
plan: 03
type: execute
wave: 3
depends_on: [20-02]
files_modified:
  - src/renderer/src/modals/DocumentationBuilderDialog.tsx
  - tests/renderer/documentation-builder-dialog.spec.tsx
autonomous: true
requirements:
  - DOC-02
tags:
  - electron
  - react
  - dnd
  - testing-library
  - renderer

must_haves:
  truths:
    - "User clicks '+ Add Track' to create a new track container with the next integer trackIndex (0, 1, 2, ...)"
    - "User drags an animation from the side list onto a track container; the drop appends an AnimationTrackEntry with id=crypto.randomUUID(), mixTime=0.25, loop=false, notes=''"
    - "Animation Tracks pane side list shows summary.animations.names with draggable=true; effectAllowed='copy' is set on dragstart per Electron Chromium quirk D-06"
    - "Each entry shows mix-time number input (step 0.05), loop checkbox, notes text input, ↑/↓ reorder buttons, ✕ remove button"
    - "↑/↓ reorder swaps within the SAME track only; disabled at edges"
    - "Removing a track with entries triggers window.confirm with copy 'Remove Track {N}? {COUNT} entries will be deleted.' (plural-aware)"
    - "Empty pane (no tracks) shows 'No tracks yet' heading + body copy"
    - "Empty track container shows 'Drop an animation here' placeholder"
    - "+ Add Track button is disabled when summary.animations.count === 0"
    - "tests/renderer/documentation-builder-dialog.spec.tsx covers modal-open + tab-switch + DnD via fireEvent.dragStart/dragOver/drop + reorder + remove confirmation"
  artifacts:
    - path: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      provides: "Animation Tracks pane filled in with HTML5 native DnD"
      contains:
        - "draggable"
        - "onDragStart"
        - "onDragOver"
        - "onDrop"
        - "application/x-stm-anim"
        - "effectAllowed = 'copy'"
        - "crypto.randomUUID()"
        - "+ Add Track"
        - "Drop an animation here"
        - "No tracks yet"
    - path: tests/renderer/documentation-builder-dialog.spec.tsx
      provides: "Renderer integration test for modal + tab switching + DnD"
      contains:
        - "fireEvent.dragStart"
        - "fireEvent.drop"
        - "@vitest-environment jsdom"
      min_lines: 100
  key_links:
    - from: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      to: HTML5 DnD API
      via: "dataTransfer.setData('application/x-stm-anim', animationName) + getData on drop"
      pattern: "application/x-stm-anim"
    - from: src/renderer/src/modals/DocumentationBuilderDialog.tsx
      to: crypto.randomUUID
      via: "id: crypto.randomUUID() at entry create-time"
      pattern: "crypto\\.randomUUID\\(\\)"
---

<objective>
Implement the Animation Tracks pane (DOC-02): drag animations from a side list onto track containers via HTML5 native DnD, configure mix time + loop + notes per entry, support multiple tracks, reorder within a track via ↑/↓ buttons, remove tracks/entries, and back the implementation with an RTL + jsdom integration test.

Purpose: This is the first DnD surface in the entire repo. The implementation MUST honor the Electron Chromium quirk (`effectAllowed='copy'` on dragstart) and the namespaced MIME type (`'application/x-stm-anim'`) so it does not collide with the existing OS-file-drop pathway.

Output:
- `src/renderer/src/modals/DocumentationBuilderDialog.tsx` extended — `TracksPanePlaceholder` replaced with full `TracksPane` implementation
- `tests/renderer/documentation-builder-dialog.spec.tsx` (NEW) — modal smoke + tab switching + DnD synthetic events + reorder + remove confirmation
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
@.planning/phases/20-documentation-builder-feature/20-02-modal-shell-sections-pane-SUMMARY.md
@./CLAUDE.md
@src/renderer/src/modals/DocumentationBuilderDialog.tsx
@src/core/documentation.ts
@tests/renderer/atlas-preview-modal.spec.tsx

<interfaces>
<!-- Verbatim references the executor needs. -->

HTML5 native DnD pattern (RESEARCH.md Pattern 4 — first DnD in repo):

```tsx
// SOURCE side (each animation in side list):
<li
  draggable
  onDragStart={(e) => {
    // CRITICAL: effectAllowed='copy' MUST be set on dragstart for Electron
    // Chromium to render the drag image consistently across macOS/Windows/Linux.
    e.dataTransfer.effectAllowed = 'copy';
    // Namespaced MIME — avoids collision with the existing DropZone wrapper
    // (which filters on dataTransfer.types.includes('Files')).
    e.dataTransfer.setData('application/x-stm-anim', animationName);
  }}
>
  {animationName}
</li>

// TARGET side (each track container):
<div
  onDragOver={(e) => {
    // MANDATORY: must call preventDefault on dragover to enable drop.
    // Without this the browser silently rejects the drop.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }}
  onDrop={(e) => {
    e.preventDefault();
    const animationName = e.dataTransfer.getData('application/x-stm-anim');
    if (!animationName) return;
    if (!summary.animations.names.includes(animationName)) return; // defensive
    // append entry with crypto.randomUUID() id, mixTime: 0.25, loop: false, notes: ''
  }}
>
```

AnimationTrackEntry shape (from src/core/documentation.ts):

```typescript
interface AnimationTrackEntry {
  id: string;             // crypto.randomUUID()
  trackIndex: number;     // 0, 1, 2, ...
  animationName: string;
  mixTime: number;        // default 0.25
  loop: boolean;
  notes: string;
}
```

RTL DnD test idiom (no existing analog — first DnD test in repo):

```typescript
fireEvent.dragStart(animationItem, {
  dataTransfer: { setData: vi.fn(), effectAllowed: '', getData: vi.fn() },
});
fireEvent.dragOver(trackContainer, { dataTransfer: { /* preventDefault auto via fireEvent */ } });
fireEvent.drop(trackContainer, {
  dataTransfer: { getData: vi.fn(() => 'walk') },
});
```

window.confirm — for tests, stub with `vi.spyOn(window, 'confirm').mockReturnValue(true)`.
</interfaces>

<copy_contract>
<!-- All copy locked by 20-UI-SPEC.md "Animation Tracks pane" — use verbatim. -->

- Side-list heading: "Animations"
- Side-list helper: "Drag an animation onto a track"
- Track-add button: "+ Add Track"
- Track header label: "Track {N}" (where {N} = trackIndex)
- Track-remove ✕ aria-label: "Remove Track {N}"
- Track-remove confirm copy: "Remove Track {N}? {COUNT} entries will be deleted." (plural-aware: "1 entry will be deleted" when COUNT === 1)
- Up arrow aria-label: "Move up"
- Down arrow aria-label: "Move down"
- Remove entry aria-label: "Remove entry"
- Mix-time label: "Mix time"; suffix: "s"
- Loop checkbox label: "Loop"
- Notes placeholder: "Notes for this entry…"
- Empty-track placeholder: "Drop an animation here"
- Empty-pane heading: "No tracks yet"
- Empty-pane body: 'Click "+ Add Track" to start, then drag animations from the left.'
</copy_contract>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create tests/renderer/documentation-builder-dialog.spec.tsx (TDD RED — modal smoke + tab + DnD spec scaffold)</name>
  <files>tests/renderer/documentation-builder-dialog.spec.tsx</files>
  <read_first>
    - tests/renderer/atlas-preview-modal.spec.tsx (full file — closest analog for jsdom + RTL + vi.stubGlobal idiom)
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx (read the file produced by Plan 02 — Sections pane is filled, Tracks pane is the placeholder. The new TracksPane props/contract is locked in Plan 03 Task 2 below; this spec encodes the contract BEFORE implementation lands per RED→GREEN discipline)
    - .planning/phases/20-documentation-builder-feature/20-PATTERNS.md lines 525-572 (DnD test idiom)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 1029-1035 (structuredClone + crypto.randomUUID confirms)
  </read_first>
  <behavior>
    - Test 1: rendering with `open={false}` produces no modal (queryByRole('dialog') returns null)
    - Test 2: rendering with `open={true}` produces a dialog with role='dialog' + aria-modal='true' + aria-labelledby='documentation-builder-title'
    - Test 3: tab strip shows three tab buttons (Animation Tracks / Sections / Export); clicking one switches activePane and aria-selected updates
    - Test 4: clicking Cancel calls onClose
    - Test 5: clicking Save changes calls onChange (with the current draft) AND onClose
    - Test 6: with summary.animations.names = ['walk', 'run'] and summary.animations.count = 2, the side list renders draggable items for each name
    - Test 7: clicking + Add Track creates a new track with trackIndex=0 (visible in pane); dragStart on 'walk' + dragOver + drop on the track container appends an entry (one entry visible, with mixTime input pre-set to 0.25)
    - Test 8: + Add Track is disabled when summary.animations.count === 0
    - Test 9: removing a track with entries triggers window.confirm; if confirmed (mocked true), the track and its entries are dropped from draft (onChange-then-Save flows the change)
    - Test 10: ↑/↓ reorder swaps two entries in the same track (verify by snapshot of the entries' animationName order)
  </behavior>
  <action>
Create `tests/renderer/documentation-builder-dialog.spec.tsx`. Use the jsdom + RTL pattern from `tests/renderer/atlas-preview-modal.spec.tsx`.

```typescript
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DocumentationBuilderDialog } from '../../src/renderer/src/modals/DocumentationBuilderDialog';
import { DEFAULT_DOCUMENTATION, type Documentation } from '../../src/core/documentation.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

afterEach(cleanup);

// Minimal SkeletonSummary fixture for tests. Only the fields the modal reads
// are required to be realistic; others can be stubbed empty.
function makeSummary(overrides: Partial<SkeletonSummary> = {}): SkeletonSummary {
  return {
    skeletonPath: '/tmp/SIMPLE.json',
    atlasPath: '/tmp/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} as never },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: [],
    // ... fill in remaining required fields with minimal stubs as the
    //     SkeletonSummary type currently demands
    ...overrides,
  } as SkeletonSummary;
}

describe('DocumentationBuilderDialog (DOC-01 / DOC-02 / DOC-03)', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <DocumentationBuilderDialog
        open={false}
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders a dialog with the 5-modal ARIA scaffold when open=true', () => {
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('documentation-builder-title');
    expect(screen.getByText('Documentation Builder')).toBeTruthy();
  });

  it('switches active pane when tabs are clicked', () => {
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const tracksTab = screen.getByRole('tab', { name: 'Animation Tracks' });
    const sectionsTab = screen.getByRole('tab', { name: 'Sections' });
    expect(tracksTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(sectionsTab);
    expect(sectionsTab.getAttribute('aria-selected')).toBe('true');
    expect(tracksTab.getAttribute('aria-selected')).toBe('false');
  });

  it('Cancel calls onClose; Save changes calls onChange + onClose', () => {
    const onChange = vi.fn();
    const onClose = vi.fn();
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary()}
        onChange={onChange}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();

    onClose.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Add Track is disabled when summary.animations.count === 0', () => {
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary()}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const addBtn = screen.getByRole('button', { name: '+ Add Track' });
    expect((addBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it('drag-and-drop appends an animation entry to a track (DOC-02)', () => {
    let latestDoc: Documentation | null = null;
    const onChange = vi.fn((next: Documentation) => { latestDoc = next; });
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary({ animations: { count: 2, names: ['walk', 'run'] } })}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    // Click + Add Track to create Track 0.
    fireEvent.click(screen.getByRole('button', { name: '+ Add Track' }));

    // Simulate dragstart on the 'walk' side-list item.
    const walkItem = screen.getByText('walk');
    const setDataMock = vi.fn();
    fireEvent.dragStart(walkItem, {
      dataTransfer: { setData: setDataMock, effectAllowed: '' },
    });
    expect(setDataMock).toHaveBeenCalledWith('application/x-stm-anim', 'walk');

    // Locate Track 0 container by aria-label, then dragover + drop.
    const track0 = screen.getByLabelText('Track 0');
    fireEvent.dragOver(track0, {
      dataTransfer: { dropEffect: 'copy' },
    });
    fireEvent.drop(track0, {
      dataTransfer: { getData: vi.fn(() => 'walk') },
    });

    // Save and verify onChange got the appended entry.
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onChange).toHaveBeenCalled();
    expect(latestDoc).not.toBeNull();
    expect(latestDoc!.animationTracks).toHaveLength(1);
    expect(latestDoc!.animationTracks[0]).toMatchObject({
      trackIndex: 0,
      animationName: 'walk',
      mixTime: 0.25,
      loop: false,
      notes: '',
    });
    expect(typeof latestDoc!.animationTracks[0].id).toBe('string');
    expect(latestDoc!.animationTracks[0].id.length).toBeGreaterThan(0);
  });

  it('removing a track with entries prompts confirm; ✕ confirmed drops the track', () => {
    let latestDoc: Documentation | null = null;
    const onChange = vi.fn((next: Documentation) => { latestDoc = next; });
    const initial: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'a', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: false, notes: '' },
        { id: 'b', trackIndex: 0, animationName: 'run', mixTime: 0.25, loop: true, notes: '' },
      ],
    };
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <DocumentationBuilderDialog
        open
        documentation={initial}
        summary={makeSummary({ animations: { count: 2, names: ['walk', 'run'] } })}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove Track 0' }));
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Remove Track 0?'));
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(latestDoc!.animationTracks).toHaveLength(0);
    confirmSpy.mockRestore();
  });

  it('↑/↓ reorder swaps adjacent entries within the same track', () => {
    let latestDoc: Documentation | null = null;
    const onChange = vi.fn((next: Documentation) => { latestDoc = next; });
    const initial: Documentation = {
      ...DEFAULT_DOCUMENTATION,
      animationTracks: [
        { id: 'a', trackIndex: 0, animationName: 'walk', mixTime: 0.25, loop: false, notes: '' },
        { id: 'b', trackIndex: 0, animationName: 'run', mixTime: 0.25, loop: false, notes: '' },
      ],
    };
    render(
      <DocumentationBuilderDialog
        open
        documentation={initial}
        summary={makeSummary({ animations: { count: 2, names: ['walk', 'run'] } })}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    // Move 'walk' (first) down, OR 'run' (second) up — either swaps.
    const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
    fireEvent.click(moveDownButtons[0]); // first entry's down arrow
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(latestDoc!.animationTracks.map((e) => e.animationName)).toEqual(['run', 'walk']);
  });
});
```

If the SkeletonSummary type requires more fields than my stubs above, fill in the missing required fields with minimal valid stubs (e.g. `peaks: []`, plus any required fields visible at `src/shared/types.ts:466-506`).

If `crypto.randomUUID` is not present in the jsdom environment, polyfill at the top of the test file:

```typescript
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto as Crypto;
```

(Phase 20 RESEARCH.md Pitfall 5 says native availability is fine in Electron; jsdom may not match — polyfill is defensive.)
  </action>
  <verify>
    <!-- TDD RED: the spec file exists and compiles via typecheck; runtime tests for
         DnD + add-track behavior are expected to FAIL until Task 2 lands the TracksPane
         implementation. The CI signal here is `npm run typecheck` exiting 0 (the spec
         compiles against the locked TracksPane contract). -->
    <automated>npm run typecheck</automated>
  </verify>
  <acceptance_criteria>
    - File `tests/renderer/documentation-builder-dialog.spec.tsx` exists
    - `grep -c "@vitest-environment jsdom" tests/renderer/documentation-builder-dialog.spec.tsx` returns 1
    - `grep -c "fireEvent.dragStart" tests/renderer/documentation-builder-dialog.spec.tsx` returns at least 1
    - `grep -c "fireEvent.drop" tests/renderer/documentation-builder-dialog.spec.tsx` returns at least 1
    - `grep -c "application/x-stm-anim" tests/renderer/documentation-builder-dialog.spec.tsx` returns at least 1
    - `grep -c "vi.spyOn(window, 'confirm')" tests/renderer/documentation-builder-dialog.spec.tsx` returns at least 1
    - The file contains at least 7 `it(` blocks
    - `npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx` exits 0
    - `npm run test` full suite exits 0
  </acceptance_criteria>
  <done>
    `tests/renderer/documentation-builder-dialog.spec.tsx` exists with the full 7+ `it(` block surface (modal smoke + tab switching + DnD add-track + reorder + remove confirmation). The spec compiles against the existing DocumentationBuilderDialog (from Plan 02) plus the locked TracksPane contract that Task 2 will satisfy. `npm run typecheck` exits 0. The full test runner is expected to fail on this spec until Task 2 lands — that is the TDD RED state by design.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Replace TracksPanePlaceholder with full TracksPane (TDD GREEN — DnD + reorder + remove)</name>
  <files>src/renderer/src/modals/DocumentationBuilderDialog.tsx</files>
  <read_first>
    - src/renderer/src/modals/DocumentationBuilderDialog.tsx (read the file Plan 02 produced — focus on TracksPanePlaceholder location and the SectionsPane patterns to mirror)
    - tests/renderer/documentation-builder-dialog.spec.tsx (read the spec from Task 1 — every `expect(...)` call here is a contract this implementation must satisfy)
    - .planning/phases/20-documentation-builder-feature/20-RESEARCH.md lines 525-600 (Pattern 4 HTML5 DnD reference impl)
    - .planning/phases/20-documentation-builder-feature/20-UI-SPEC.md lines 145-165 (Animation Tracks pane copy)
    - .planning/phases/20-documentation-builder-feature/20-CONTEXT.md (D-05..D-08 — track UX)
    - .planning/phases/20-documentation-builder-feature/20-PATTERNS.md lines 410-446 + 1078-1091 (DnD pattern + no-analog notes)
  </read_first>
  <action>
Replace `TracksPanePlaceholder` in `src/renderer/src/modals/DocumentationBuilderDialog.tsx` with a full `TracksPane` implementation. Pass the same props the SectionsPane receives plus the parent's draft setter.

**Update the activePane render branch in the parent dialog body:**

```tsx
{activePane === 'tracks' && (
  <TracksPane draft={draft} summary={props.summary} onChange={setDraft} />
)}
```

**Implement TracksPane:**

```tsx
interface TracksPaneProps {
  draft: Documentation;
  summary: SkeletonSummary;
  onChange: (next: Documentation) => void;
}

function TracksPane({ draft, summary, onChange }: TracksPaneProps) {
  // Group entries by trackIndex; render in ascending trackIndex order.
  // Track-add: append a new EMPTY track at next integer index. We model
  // "empty tracks" by tracking a separate trackIndices array; an entry-less
  // track is a trackIndex that has zero AnimationTrackEntry items but should
  // still render its container. To persist empty tracks across save/reload
  // would require a separate field; per D-05 we model empty tracks ONLY in
  // local state (do not persist). On save, only tracks with entries survive
  // the round-trip — but the user sees the empty track in the pane until
  // they add to it or remove it.

  // Track indices visible in the pane: union of indices that have entries
  // PLUS user-added empty tracks. Local state only.
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
    if (!summary.animations.names.includes(animationName)) return; // defensive
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
    // If this track was an empty placeholder, remove from emptyTrackIndices
    // (it's now backed by entries).
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
    // If removing this entry leaves the track with zero entries, keep the
    // track visible by adding to emptyTrackIndices (so user doesn't lose context).
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
      {/* Side list */}
      <aside className="w-64 flex-shrink-0 flex flex-col">
        <h3 className="text-base font-semibold text-fg mb-1">Animations</h3>
        <p className="text-xs text-fg-muted mb-3">Drag an animation onto a track</p>
        <ul className="flex flex-col gap-1 overflow-y-auto">
          {summary.animations.names.map((name) => (
            <li
              key={name}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/x-stm-anim', name);
              }}
              className="cursor-grab px-2 py-1 text-sm font-mono text-fg border border-border rounded hover:border-accent hover:text-accent active:cursor-grabbing"
            >
              {name}
            </li>
          ))}
        </ul>
      </aside>

      {/* Track containers */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
        {usedIndices.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-8">
            <h3 className="text-base font-semibold text-fg">No tracks yet</h3>
            <p className="text-sm text-fg-muted mt-1">
              Click "+ Add Track" to start, then drag animations from the left.
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
            <li key={entry.id} className="flex items-center gap-2 bg-panel border border-border rounded-md px-3 py-2">
              <span className="font-mono text-sm text-fg flex-1 min-w-0 truncate">{entry.animationName}</span>

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
```

Add `AnimationTrackEntry` to the type imports at the top of the file. Also import `useState` and `useMemo` from `react` if not already imported.

Tailwind v4 literal-class discipline: every className= is a string literal or `clsx(literal, ...)` with literal branches. Do NOT use template literals.

DnD verification checklist (per RESEARCH.md Pitfall 1-3):
- `e.dataTransfer.effectAllowed = 'copy'` is the FIRST line of every onDragStart
- `e.preventDefault()` is the FIRST line of every onDragOver
- MIME type is `'application/x-stm-anim'` (namespaced — does not collide with file-drop pathway)
- Defensive check `if (!summary.animations.names.includes(name)) return;` on drop (rejects spoofed payloads)

Removing the placeholder `function TracksPanePlaceholder()` from the file is required.
  </action>
  <verify>
    <!-- TDD GREEN: the spec from Task 1 must now pass end-to-end. -->
    <automated>npm run typecheck && npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "function TracksPane(" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 1
    - `grep -c "function TracksPanePlaceholder" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 0 (placeholder removed)
    - `grep -c "application/x-stm-anim" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 2 (setData on dragstart + getData on drop)
    - `grep -c "effectAllowed = 'copy'" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "crypto.randomUUID()" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "+ Add Track" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "Drop an animation here" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "No tracks yet" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "preventDefault" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 2 (dragover + drop)
    - `grep -c "window.confirm" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `grep -c "Remove Track" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1
    - `npm run typecheck` exits 0
  </acceptance_criteria>
  <done>
    Animation Tracks pane renders side list (draggable animations from summary.animations.names) + track containers (drop targets with onDragOver preventDefault) + entry rows (mix time number input, loop checkbox, notes text input, ↑/↓ reorder, ✕ remove). DnD honors effectAllowed='copy' + namespaced MIME 'application/x-stm-anim' + defensive name validation. Track-remove with entries triggers window.confirm with plural-aware copy. Empty pane + empty track empty-state copy verbatim from UI-SPEC. Typecheck green AND `npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx` exits 0 (TDD GREEN — spec from Task 1 fully satisfied).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser DnD payload → renderer drop handler | `e.dataTransfer.getData('application/x-stm-anim')` returns a string from any source that set the same MIME type; defensive validation against `summary.animations.names` is mandatory |
| OS file drop → existing DropZone | Phase 20 must not collide with the OS-file-drop pathway (DropZone wrapper filters on `dataTransfer.types.includes('Files')`) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-20-13 | Tampering | TracksPane onDrop handler | mitigate | Defensive `if (!summary.animations.names.includes(name)) return;` rejects spoofed/stale payloads. Acceptance criterion: `grep -c "summary.animations.names.includes" src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns at least 1. |
| T-20-14 | Tampering (MIME collision) | DnD MIME `'application/x-stm-anim'` | mitigate | Namespaced custom MIME avoids the existing DropZone's `'Files'` filter. RESEARCH.md Pitfall 3 documents the constraint. |
| T-20-15 | Denial of Service | Adding many tracks/entries | accept | User-driven action; pure renderer state; bounded by user patience. No DoS surface. |
| T-20-16 | Information Disclosure | crypto.randomUUID() in jsdom test environment | mitigate | Defensive polyfill at test file top using `node:crypto.webcrypto` if `globalThis.crypto` is absent. Production renderer (Electron 41 / Chromium ~134) has the API natively. |
| T-20-17 | Tampering (XSS) | Notes / animationName text rendering | mitigate | React 19 children-rendering escapes by default. No `dangerouslySetInnerHTML` introduced. Acceptance criterion: `grep -c dangerouslySetInnerHTML src/renderer/src/modals/DocumentationBuilderDialog.tsx` returns 0. |
| T-20-18 | Modal accessibility regression | Reorder buttons / DnD a11y | accept this phase | Phase 20 ships drag-only per DOC-02 verbatim; click-to-add fallback for keyboard/screen-reader users is logged in CONTEXT.md Deferred Ideas. ↑/↓ buttons + remove ✕ are keyboard-accessible (focus-visible outlines preserved). |
</threat_model>

<verification>
After both tasks land:

1. `npm run typecheck` exits 0
2. `npm run test -- tests/renderer/documentation-builder-dialog.spec.tsx` exits 0 (all 7+ tests green)
3. `npm run test` full suite exits 0
4. `npm run test -- tests/arch.spec.ts` exits 0 (Layer 3 + literal-class invariants)
5. Manual smoke (`npm run dev`): load `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, click Documentation, switch to Animation Tracks tab, click + Add Track, drag any animation from the side list onto the track, confirm one entry appears with mixTime 0.25 + Loop unchecked + an empty notes input + ↑/↓ + ✕ buttons visible
</verification>

<success_criteria>
- TracksPane delivers DOC-02: drag-from-list, mix time + loop + notes per entry, multiple tracks supported, reorder via ↑/↓, remove via ✕ with confirm
- HTML5 native DnD honors Electron Chromium quirk (effectAllowed='copy') and namespaced MIME ('application/x-stm-anim')
- crypto.randomUUID() generates entry ids
- Empty pane + empty track copy verbatim from UI-SPEC
- + Add Track disabled when no animations exist
- Renderer integration test covers modal + tabs + DnD + reorder + remove confirmation
- All tests pass under vitest + jsdom; full suite green
</success_criteria>

<output>
After completion, create `.planning/phases/20-documentation-builder-feature/20-03-animation-tracks-pane-dnd-SUMMARY.md` documenting:
- DnD pattern landed (MIME namespace, effectAllowed, defensive name validation)
- Empty-track / empty-pane state coverage
- Reorder + remove behavior
- Test surface (modal smoke + tab + DnD + reorder + remove)
- crypto.randomUUID polyfill posture in jsdom
</output>
