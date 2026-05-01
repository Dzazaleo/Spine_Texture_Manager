// @vitest-environment jsdom
/**
 * Phase 20 Plan 03 — DocumentationBuilderDialog renderer integration tests.
 *
 * Coverage (per 20-03-PLAN.md Task 1 behavior list):
 *   - rendering with open=false produces no modal
 *   - rendering with open=true produces a 5-modal-ARIA-scaffold dialog
 *   - tab strip switches activePane on click; aria-selected updates
 *   - Cancel calls onClose
 *   - Save changes calls onChange (with the current draft) AND onClose
 *   - side list renders draggable items for each summary.animations.names entry
 *   - + Add Track creates a track; DnD (dragStart + dragOver + drop) appends an
 *     AnimationTrackEntry with default mixTime=0.25 + loop=false + notes=''
 *   - + Add Track is disabled when summary.animations.count === 0
 *   - removing a track with entries triggers window.confirm; confirmed → drops track
 *   - ↑/↓ reorder swaps adjacent entries within the same track
 *
 * DnD pattern (first DnD test surface in repo): RTL fireEvent.dragStart /
 * dragOver / drop with synthetic dataTransfer mock. Mock setData verifies the
 * locked MIME 'application/x-stm-anim'; mock getData simulates the drop
 * payload landing on the target. effectAllowed='copy' is set on the
 * dataTransfer object passed to dragStart and is the Electron Chromium
 * quirk (D-06) the implementation MUST honor.
 *
 * crypto.randomUUID polyfill: jsdom 29.x exposes globalThis.crypto in Node
 * 19+, but defensively polyfilled at file top using node:crypto.webcrypto in
 * case of older Node versions running the test suite. Production renderer
 * (Electron 41 / Chromium ~134) has the API natively. (RESEARCH §Pitfall 5.)
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { webcrypto } from 'node:crypto';
import { DocumentationBuilderDialog } from '../../src/renderer/src/modals/DocumentationBuilderDialog';
import {
  DEFAULT_DOCUMENTATION,
  type Documentation,
  type SkeletonSummary,
} from '../../src/shared/types.js';

// Defensive polyfill for crypto.randomUUID in jsdom environments where
// globalThis.crypto is undefined (older Node). Production Electron 41 /
// Chromium ~134 has it natively; this guard exists only for the test runtime.
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto as Crypto;
}

afterEach(cleanup);

/**
 * Build a minimal SkeletonSummary suitable for the DocumentationBuilderDialog.
 * The modal only reads `summary.animations.{count, names}` plus
 * `summary.bones`, `summary.skins`, `summary.events` (for the Sections pane,
 * not exercised here). Other fields default to empty stubs sufficient for
 * type compliance.
 */
function makeSummary(overrides: Partial<SkeletonSummary> = {}): SkeletonSummary {
  const base: SkeletonSummary = {
    skeletonPath: '/tmp/SIMPLE.json',
    atlasPath: '/tmp/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    events: { count: 0, names: [] },
    peaks: [],
    animationBreakdown: [],
    elapsedMs: 1,
    editorFps: 30,
  };
  return { ...base, ...overrides };
}

describe('DocumentationBuilderDialog — modal scaffold (DOC-01)', () => {
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
});

describe('DocumentationBuilderDialog — tab strip (DOC-01)', () => {
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
    // Initial: tracks active.
    expect(tracksTab.getAttribute('aria-selected')).toBe('true');
    expect(sectionsTab.getAttribute('aria-selected')).toBe('false');
    // Click Sections; aria-selected swaps.
    fireEvent.click(sectionsTab);
    expect(sectionsTab.getAttribute('aria-selected')).toBe('true');
    expect(tracksTab.getAttribute('aria-selected')).toBe('false');
  });
});

describe('DocumentationBuilderDialog — footer actions (DOC-01)', () => {
  it('Cancel calls onClose; does not call onChange', () => {
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
  });

  it('Save changes calls onChange (with current draft) AND onClose', () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('DocumentationBuilderDialog — Animation Tracks pane (DOC-02)', () => {
  it('+ Add Track is disabled when summary.animations.count === 0', () => {
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

  it('renders draggable side-list items for each summary.animations.names entry', () => {
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary({ animations: { count: 2, names: ['walk', 'run'] } })}
        onChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const walk = screen.getByText('walk');
    const run = screen.getByText('run');
    expect(walk.getAttribute('draggable')).toBe('true');
    expect(run.getAttribute('draggable')).toBe('true');
  });

  it('drag-and-drop appends an AnimationTrackEntry with locked defaults', () => {
    let latestDoc: Documentation | null = null;
    const onChange = vi.fn((next: Documentation) => {
      latestDoc = next;
    });
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

    // Simulate dragstart on the 'walk' side-list item. The handler MUST set
    // effectAllowed='copy' (D-06 Electron Chromium quirk) and call setData
    // with the locked MIME 'application/x-stm-anim'.
    const walkItem = screen.getByText('walk');
    const setDataMock = vi.fn();
    fireEvent.dragStart(walkItem, {
      dataTransfer: { setData: setDataMock, effectAllowed: '' },
    });
    expect(setDataMock).toHaveBeenCalledWith('application/x-stm-anim', 'walk');

    // Locate Track 0 container by its aria-label, then dragover + drop.
    const track0 = screen.getByLabelText('Track 0');
    fireEvent.dragOver(track0, { dataTransfer: { dropEffect: 'copy' } });
    fireEvent.drop(track0, {
      dataTransfer: { getData: vi.fn(() => 'walk') },
    });

    // Save and verify the parent received an animationTracks array containing
    // the locked default-shaped entry.
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

  it('drop with unknown animation name (not in summary) is rejected silently', () => {
    let latestDoc: Documentation | null = null;
    const onChange = vi.fn((next: Documentation) => {
      latestDoc = next;
    });
    render(
      <DocumentationBuilderDialog
        open
        documentation={DEFAULT_DOCUMENTATION}
        summary={makeSummary({ animations: { count: 2, names: ['walk', 'run'] } })}
        onChange={onChange}
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Add Track' }));
    const track0 = screen.getByLabelText('Track 0');
    fireEvent.dragOver(track0, { dataTransfer: { dropEffect: 'copy' } });
    // Spoofed payload — name not in summary.animations.names.
    fireEvent.drop(track0, {
      dataTransfer: { getData: vi.fn(() => 'NOT_A_REAL_ANIMATION') },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(latestDoc).not.toBeNull();
    expect(latestDoc!.animationTracks).toHaveLength(0);
  });

  it('removing a track with entries prompts confirm; ✕ confirmed drops the track', () => {
    let latestDoc: Documentation | null = null;
    const onChange = vi.fn((next: Documentation) => {
      latestDoc = next;
    });
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
    const onChange = vi.fn((next: Documentation) => {
      latestDoc = next;
    });
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
    // Click 'Move down' on the first entry — swaps walk and run.
    const moveDownButtons = screen.getAllByRole('button', { name: 'Move down' });
    fireEvent.click(moveDownButtons[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(latestDoc!.animationTracks.map((e) => e.animationName)).toEqual(['run', 'walk']);
  });
});
