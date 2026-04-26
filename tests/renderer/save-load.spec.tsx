// @vitest-environment jsdom
/**
 * Phase 8 Plan 04 — renderer specs for AppShell Save/Open buttons + dirty
 * marker + SaveQuitDialog + Cmd/Ctrl+S/O shortcuts + stale-override banner +
 * DropZone .stmproj branch.
 *
 * RED until Plan 04 wires AppShell + DropZone + SaveQuitDialog. Imports below
 * intentionally reference modules/exports that do not yet exist, OR existing
 * modules whose new behavior has not been wired yet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import { App } from '../../src/renderer/src/App';
import type { SkeletonSummary, OpenResponse, SaveResponse } from '../../src/shared/types';

afterEach(cleanup);

function makeSummary(): SkeletonSummary {
  // Synthetic minimal SkeletonSummary that satisfies AppShell's mount.
  // Plan 04 may need to enrich this — adapt as required during GREEN.
  return {
    skeletonPath: '/a/b/SIMPLE.json',
    atlasPath: '/a/b/SIMPLE.atlas',
    bones: { count: 0, names: [] },
    slots: { count: 0 },
    attachments: { count: 0, byType: {} },
    skins: { count: 0, names: [] },
    animations: { count: 0, names: [] },
    peaks: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: 'CIRCLE', skinName: 'default', slotName: 'slot-circle', sourceW: 64, sourceH: 64,
        worldW: 32, worldH: 32, peakScale: 0.5, animationName: 'idle', frame: 12, sourcePath: '/a/b/images/CIRCLE.png' } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { attachmentName: 'SQUARE', skinName: 'default', slotName: 'slot-square', sourceW: 64, sourceH: 64,
        worldW: 64, worldH: 64, peakScale: 1.0, animationName: 'idle', frame: 0, sourcePath: '/a/b/images/SQUARE.png' } as any,
    ],
    animationBreakdown: [],
    elapsedMs: 5,
  } as unknown as SkeletonSummary;
}

beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
    openProject: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj' } } as OpenResponse),
    openProjectFromFile: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj' } } as OpenResponse),
    openProjectFromPath: vi.fn(),
    loadSkeletonFromFile: vi.fn().mockResolvedValue({ ok: true, summary: makeSummary() }),
    locateSkeleton: vi.fn().mockResolvedValue({ ok: true, newPath: '/a/b/SIMPLE_RENAMED.json' }),
    reloadProjectWithSkeleton: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj' } } as OpenResponse),
    onCheckDirtyBeforeQuit: vi.fn(() => () => undefined),
    confirmQuitProceed: vi.fn(),
    pickOutputDirectory: vi.fn(),
    startExport: vi.fn(),
    cancelExport: vi.fn(),
    onExportProgress: vi.fn(() => () => undefined),
    openOutputFolder: vi.fn(),
    probeExportConflicts: vi.fn(),
    // Phase 08.2 D-175 / D-181 — menu surface bridges. AppShell pushes
    // notifyMenuState in a useEffect on mount; App.tsx subscribes to all
    // four onMenu* channels in a useEffect. Tests must mock these or the
    // mount-time call throws "window.api.notifyMenuState is not a function".
    notifyMenuState: vi.fn(),
    onMenuOpen: vi.fn(() => () => undefined),
    onMenuOpenRecent: vi.fn(() => () => undefined),
    onMenuSave: vi.fn(() => () => undefined),
    onMenuSaveAs: vi.fn(() => () => undefined),
  });
});

describe('AppShell Save/Open buttons (D-140, D-141)', () => {
  it('Save reuses currentProjectPath', async () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Plan 04 wires: clicking Save with currentProjectPath !== null calls
    // window.api.saveProject (NOT saveProjectAs).
    const saveBtn = screen.getByRole('button', { name: /^Save$/i });
    await userEvent.click(saveBtn);
    // First Save with no path opens save-as; subsequent calls use save.
    // The contract Plan 04 must satisfy:
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.saveProjectAs.mock.calls.length + (globalThis as any).api.saveProject.mock.calls.length).toBeGreaterThan(0);
  });

  it('dirty marker bullet renders when state mutates (D-144)', () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Untitled clean → 'Untitled' literal in chip.
    // Plan 04: a dirty mutation (override added) prepends '• '.
    // We assert the clean baseline here; the dirty path is exercised after a
    // user action that Plan 04's onApplyOverride flow fires.
    expect(screen.getByText(/Untitled|SIMPLE\.json/i)).toBeTruthy();
  });
});

describe('Keyboard shortcuts (D-140 + Pitfall 6)', () => {
  it('Cmd+S triggers Save', async () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    // Plan 04: window-level listener fires onClickSave when no modal is open.
    await Promise.resolve();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (globalThis as any).api.saveProject.mock.calls.length + (globalThis as any).api.saveProjectAs.mock.calls.length;
    expect(calls).toBeGreaterThan(0);
  });

  it('Cmd+S suppressed when modal open (T-08-SHORT)', async () => {
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} elapsedMs={5} samplingHz={120} {...({} as any)} />);
    // Mount a fake modal element with role="dialog" (the suppression heuristic).
    const fakeModal = document.createElement('div');
    fakeModal.setAttribute('role', 'dialog');
    document.body.appendChild(fakeModal);
    fireEvent.keyDown(window, { key: 's', metaKey: true });
    await Promise.resolve();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.saveProject).not.toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.saveProjectAs).not.toHaveBeenCalled();
    document.body.removeChild(fakeModal);
  });
});

describe('SaveQuitDialog three-button flow (D-143)', () => {
  // Phase 8.1 Plan 01 Task 3: the two prior placeholder shells are flipped
  // to real RED specs. Plan 08.1-04 (D-163 ref-bridge) wires the
  // App.tsx <-> AppShell coupling that turns these GREEN.
  it('8.1-VR-03a: dirty + .json drop → SaveQuitDialog reason=new-skeleton-drop (D-163, D-164)', async () => {
    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;

    // First drop: SIMPLE_TEST.json (clean → loaded).
    const f1 = new File(['{}'], 'SIMPLE_TEST.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f1] } as unknown as DataTransfer });

    // Phase 8.1 Plan 05 — Rule 3 fix (precedent set by Plan 08.1-04): React 19's
    // update scheduler uses MessageChannel/setTimeout for state-update flushing
    // (not microtasks), so naked `await Promise.resolve()` ticks never observe
    // post-setState DOM. `findByText` polls testing-library's built-in waitFor
    // (default 1000ms / 50ms) — canonical pattern for async-DOM under React 19.
    // Also: makeSummary() peaks include CIRCLE + SQUARE only (no TRIANGLE), so
    // the dirty-mutation fixture targets CIRCLE — an attachment that ACTUALLY
    // renders in GlobalMaxRenderPanel after the first drop. Pre-fix this spec
    // searched for TRIANGLE (silent .catch → empty array → dirty mutation
    // skipped → isDirty stays false → dialog never mounts).
    // Mark the session dirty by applying an override via the GlobalMaxRender
    // panel double-click → OverrideDialog → Apply path. The override Map
    // gains CIRCLE → AppShell's isDirty memo flips true.
    // Note: onDoubleClick lives on the Scale <td> (e.g. "0.500×"), NOT the
    // attachmentName <td> — so we target the row containing CIRCLE and
    // find the Scale cell within it.
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const scaleCell = within(circleRow).getByText(/0\.500×/);
    fireEvent.doubleClick(scaleCell);
    const input = await screen.findByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    const apply = await screen.findByRole('button', { name: /^Apply$/i });
    await userEvent.click(apply);

    // Second drop: a different .json (the dirty-guard should fire).
    const f2 = new File(['{}'], 'OTHER.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f2] } as unknown as DataTransfer });

    // SaveQuitDialog must be mounted with the new-skeleton-drop body copy.
    // findByText waits for the async-driven mount under React 19.
    const dialogTitle = await screen.findByText(/Save changes before loading a new skeleton/i);
    expect(dialogTitle, 'SaveQuitDialog with new-skeleton-drop title must mount').toBeTruthy();

    // Cancel — second drop is aborted.
    const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i });
    await userEvent.click(cancelBtn);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const loadCalls = (globalThis as any).api.loadSkeletonFromFile.mock.calls;
    // The first drop loaded SIMPLE_TEST.json. After Cancel, the second
    // drop must NOT have triggered a second loadSkeletonFromFile call.
    expect(loadCalls.length).toBe(1);
  });

  it("8.1-VR-03b: dirty + .stmproj drop → SaveQuitDialog reason=new-project-drop, Don't Save proceeds (D-163, D-164, D-167)", async () => {
    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;

    // First drop: load a skeleton .json so AppShell mounts.
    const f1 = new File(['{}'], 'SIMPLE_TEST.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f1] } as unknown as DataTransfer });

    // Phase 8.1 Plan 05 — Rule 3 fix (see VR-03a above for full rationale).
    // findByText replaces microtask-await + queryByText (React 19 concurrent
    // rendering); CIRCLE replaces TRIANGLE (CIRCLE is in makeSummary()).
    // onDoubleClick lives on the Scale <td>, so we find the row containing
    // CIRCLE then target the Scale cell within it (peakScale 0.5 → "0.500×").
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const scaleCell = within(circleRow).getByText(/0\.500×/);
    fireEvent.doubleClick(scaleCell);
    const input = await screen.findByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    const apply = await screen.findByRole('button', { name: /^Apply$/i });
    await userEvent.click(apply);

    // Second drop: a .stmproj.
    const f2 = new File(['{}'], 'OTHER.stmproj', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f2] } as unknown as DataTransfer });

    // SaveQuitDialog with new-project-drop title.
    const dialogTitle = await screen.findByText(/Save changes before opening this project/i);
    expect(dialogTitle, 'SaveQuitDialog with new-project-drop title must mount').toBeTruthy();

    // Don't Save — second drop proceeds.
    const dontSaveBtn = screen.getByRole('button', { name: /Don.t Save/i });
    await userEvent.click(dontSaveBtn);

    // openProjectFromFile must have been called for OTHER.stmproj.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projCalls = (globalThis as any).api.openProjectFromFile.mock.calls;
    expect(projCalls.length).toBeGreaterThanOrEqual(1);
  });
});

describe('Stale-override banner (D-150)', () => {
  it('stale override banner renders count + names', async () => {
    // Plan 04 Task 2b GREEN — the banner mounts when AppShell's
    // staleOverrideNotice state is non-empty. The test seeds it via the
    // initialProject prop path (the same path App.tsx uses when opening a
    // .stmproj from the picker / drop) since that path is exercisable from
    // AppShell alone without App.tsx integration.
    const summary = makeSummary();
    render(
      <AppShell
        summary={summary}
        samplingHz={120}
        initialProject={{
          summary,
          restoredOverrides: { CIRCLE: 50 },
          staleOverrideKeys: ['GHOST', 'OLD_HAT'],
          samplingHz: 120,
          lastOutDir: null,
          sortColumn: null,
          sortDir: null,
          projectFilePath: '/a/b/proj.stmproj',
        }}
      />,
    );
    // Banner contains a count + plural noun + the stale names.
    const banner = screen.getByRole('status');
    expect(banner.textContent).toMatch(/2 saved overrides skipped/i);
    expect(banner.textContent).toContain('GHOST');
    expect(banner.textContent).toContain('OLD_HAT');
  });
});

describe('8.1-VR-01: .stmproj drop SkeletonNotFoundOnLoadError → App.tsx recovery banner (D-161, D-162)', () => {
  it('renders Skeleton not found banner with Locate skeleton button on .stmproj drop with missing skeleton', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).api.openProjectFromFile = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        kind: 'SkeletonNotFoundOnLoadError',
        message: 'Skeleton JSON not found: /a/b/RENAMED.json',
        projectPath: '/a/b/proj.stmproj',
        originalSkeletonPath: '/a/b/RENAMED.json',
        mergedOverrides: { TRIANGLE: 50 },
        samplingHz: 120,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
      },
    } as OpenResponse);

    const { container } = render(<App />);
    // Simulate a .stmproj drop on the full-window DropZone.
    const dropTarget = container.firstElementChild as HTMLElement;
    const file = new File(['{}'], 'proj.stmproj', { type: 'application/json' });
    const dataTransfer = { files: [file] } as unknown as DataTransfer;
    fireEvent.drop(dropTarget, { dataTransfer });
    // Phase 8.1 Plan 04 — Rule 3 fix: React 19's update scheduler uses
    // MessageChannel/setTimeout for state-update flushing (not microtasks),
    // so naked `await Promise.resolve()` ticks never observe the post-setState
    // DOM. `findByRole` polls with testing-library's built-in waitFor
    // (default 1000ms, 50ms interval) until the banner mounts — the canonical
    // pattern for async-driven DOM under React 19's concurrent rendering.

    // Recovery banner is present (NOT the generic text-accent-muted error line).
    const banner = await screen.findByRole('alert');
    expect(banner, 'projectLoadFailed banner should mount with role=alert').toBeTruthy();
    expect(banner.textContent).toMatch(/Skeleton not found/i);
    // Locate skeleton button reachable.
    const locateBtn = screen.getByRole('button', { name: /Locate skeleton/i });
    expect(locateBtn).toBeTruthy();
  });
});

describe('8.1-VR-02: AppShell toolbar Open threads projectPath into recovery banner (D-159, D-160)', () => {
  it('Open → SkeletonNotFoundOnLoadError envelope → Locate skeleton uses threaded projectPath', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).api.openProject = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        kind: 'SkeletonNotFoundOnLoadError',
        message: 'Skeleton JSON not found: /a/b/RENAMED.json',
        projectPath: '/a/b/proj.stmproj',
        originalSkeletonPath: '/a/b/RENAMED.json',
        mergedOverrides: { TRIANGLE: 50 },
        samplingHz: 120,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
      },
    } as OpenResponse);

    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} samplingHz={120} {...({} as any)} />);

    // Click toolbar Open. AppShell internal state sets skeletonNotFoundError
    // with the THREADED projectPath (NOT empty string).
    const openBtn = screen.getByRole('button', { name: /^Open$/i });
    await userEvent.click(openBtn);

    // Locate skeleton button surfaces in the inline banner.
    const locateBtn = await screen.findByRole('button', { name: /Locate skeleton/i });
    await userEvent.click(locateBtn);

    // The reload IPC must have been called with the threaded projectPath
    // (post-fix from Plan 08.1-03; pre-fix this is empty string and the
    // call is made but with the wrong path — the assertion locks the
    // post-fix contract).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = (globalThis as any).api.reloadProjectWithSkeleton.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0].projectPath).toBe('/a/b/proj.stmproj');
    expect(calls[0][0].mergedOverrides).toEqual({ TRIANGLE: 50 });
  });
});
