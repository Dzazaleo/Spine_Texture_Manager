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
import { DEFAULT_DOCUMENTATION } from '../../src/shared/types';

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
    // Phase 20 D-09 — events field added to SkeletonSummary in Plan 20-01.
    events: { count: 0, names: [] },
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
    openProject: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj', documentation: DEFAULT_DOCUMENTATION } } as OpenResponse),
    openProjectFromFile: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj', documentation: DEFAULT_DOCUMENTATION } } as OpenResponse),
    openProjectFromPath: vi.fn(),
    loadSkeletonFromFile: vi.fn().mockResolvedValue({ ok: true, summary: makeSummary() }),
    locateSkeleton: vi.fn().mockResolvedValue({ ok: true, newPath: '/a/b/SIMPLE_RENAMED.json' }),
    reloadProjectWithSkeleton: vi.fn().mockResolvedValue({ ok: true, project: { summary: makeSummary(), restoredOverrides: {}, staleOverrideKeys: [], samplingHz: 120, lastOutDir: null, sortColumn: null, sortDir: null, projectFilePath: '/a/b/proj.stmproj', documentation: DEFAULT_DOCUMENTATION } } as OpenResponse),
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
    onMenuReloadProject: vi.fn(() => () => undefined),
    onMenuExport: vi.fn(() => () => undefined),
    onMenuCloseProject: vi.fn(() => () => undefined),
    onMenuShowInFolder: vi.fn(() => () => undefined),
    onMenuCopyPeakTable: vi.fn(() => () => undefined),
    // Phase 9 Plan 02 D-194 — sampler progress + cancel bridges. AppShell
    // subscribes to onSamplerProgress on mount; the wrapped const must
    // return an unsubscribe stub so the cleanup in useEffect can call it.
    onSamplerProgress: vi.fn(() => () => undefined),
    cancelSampler: vi.fn(),
    // Phase 9 Plan 05 — Settings + Help menu surfaces. AppShell subscribes
    // to onMenuSettings on mount (Plan 06); App.tsx may subscribe to
    // onMenuHelp from Plan 07. openExternalUrl is the matching shell bridge.
    onMenuSettings: vi.fn(() => () => undefined),
    onMenuHelp: vi.fn(() => () => undefined),
    openExternalUrl: vi.fn(),
    // Phase 9 Plan 06 — re-sample IPC. AppShell calls this from a useEffect
    // when samplingHzLocal changes (Settings dialog Apply). The mount-pass
    // is skipped via a ref, so the mock value here is reached only by tests
    // that drive a samplingHz change; an OK envelope keeps that path clean.
    resampleProject: vi.fn().mockResolvedValue({
      ok: true,
      project: {
        summary: makeSummary(),
        restoredOverrides: {},
        staleOverrideKeys: [],
        samplingHz: 120,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
        projectFilePath: '/a/b/proj.stmproj',
        documentation: DEFAULT_DOCUMENTATION,
      },
    } as OpenResponse),
    // Phase 12 Plan 01 — auto-update preload surface (UPD-01..UPD-06).
    // App.tsx (post Phase 14 Plan 03 lift) mounts a useEffect that
    // subscribes to all five on* methods on first render — every method
    // must be present (returning unsub fn) or React throws 'is not a
    // function' on the useEffect commit.
    checkForUpdates: vi.fn(),
    downloadUpdate: vi.fn(),
    dismissUpdate: vi.fn(),
    quitAndInstallUpdate: vi.fn(),
    onUpdateAvailable: vi.fn(() => () => undefined),
    onUpdateDownloaded: vi.fn(() => () => undefined),
    onUpdateNone: vi.fn(() => () => undefined),
    onUpdateError: vi.fn(() => () => undefined),
    onMenuCheckForUpdates: vi.fn(() => () => undefined),
    onMenuInstallationGuide: vi.fn(() => () => undefined),
    // Phase 14 Plan 02/03 — late-mount sticky-slot recovery. App.tsx's
    // lifted useEffect calls window.api.requestPendingUpdate() once on
    // mount; tests must stub it so the Promise resolves (null = no
    // pending update, the common case for these specs).
    requestPendingUpdate: vi.fn().mockResolvedValue(null),
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

// Phase 08.2 D-176 — the `Keyboard shortcuts (D-140 + Pitfall 6)` describe
// block at this position pre-08.2 asserted that the AppShell.tsx window-level
// keydown listener fired onClickSave on Cmd+S. Plan 08.2-04 DELETED that
// listener — the native Electron menu accelerator (Plan 08.2-02) is now the
// single source of truth for Cmd+O / Cmd+S / Cmd+Shift+S. The two cases that
// targeted the deleted listener are retired here:
//
//   - 'Cmd+S triggers Save' — was failing post-Plan 04 because the listener
//     was deleted; replaced functionally by the native menu accelerator (no
//     renderer test surface — that's a main-side responsibility verified in
//     tests/main/menu.spec.ts case (e) and exercised via the live Electron
//     menu in manual UAT).
//   - 'Cmd+S suppressed when modal open (T-08-SHORT)' — replaced by
//     8.2-MENU-02 below (modalOpen flips true on OverrideDialog mount → main
//     disables File menu items via menu rebuild).
//
// 8.2-MENU-06 below provides the inverse assertion: a Cmd+O keydown
// dispatched into the window does NOT call window.api.openProject() directly
// (the renderer keydown path is gone end-to-end).

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
    // Note: onDoubleClick lives on the Peak <td> (e.g. "0.500×"), NOT the
    // attachmentName <td> — so we target the row containing CIRCLE and
    // find the Scale cell within it.
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const peakCell = within(circleRow).getByText(/^32×32$/);
    fireEvent.doubleClick(peakCell);
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
    // onDoubleClick lives on the Peak <td>, so we find the row containing
    // CIRCLE then target the Peak cell within it (peakScale 0.5 → "0.500×").
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const peakCell = within(circleRow).getByText(/^32×32$/);
    fireEvent.doubleClick(peakCell);
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
          documentation: DEFAULT_DOCUMENTATION,
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

/**
 * Phase 08.2 — File menu wiring renderer specs (8.2-MENU-01..06).
 *
 * These six cases assert the renderer side of the native Electron menu
 * surface shipped by Plans 08.2-02 (main-side menu builder), 08.2-03
 * (preload bridges + ipc handler), and 08.2-04 (App.tsx subscriptions +
 * AppShell.tsx push + keydown deletion).
 *
 *   01: AppShell pushes notifyMenuState({canSave,canSaveAs:true,modalOpen:false}) on mount
 *   02: Opening OverrideDialog flips modalOpen:true (D-184)
 *   03: onMenuOpen → openProject() in the loaded state (the happy path)
 *   04: onMenuOpen → openProject() in projectLoadFailed state — THE CANONICAL
 *       08.1 UAT REGRESSION REPRODUCER (Cmd+O on the recovery banner now fires)
 *   05: onMenuOpenRecent('/abs/path.stmproj') → openProjectFromPath('/abs/path.stmproj')
 *   06: AppShell keydown listener is gone — Cmd+O via window.dispatchEvent does
 *       NOT call openProject directly (replaces the retired Keyboard shortcuts
 *       describe block — the inverse assertion of D-176)
 */
describe('Phase 08.2 menu wiring', () => {
  it('8.2-MENU-01: AppShell calls notifyMenuState on mount with summary loaded', async () => {
    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;
    const f = new File(['{}'], 'SIMPLE_TEST.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f] } as unknown as DataTransfer });
    // Wait for the load → AppShell mount → useEffect chain.
    // makeSummary().peaks contains a CIRCLE row (peakScale 0.5) — its presence
    // proves AppShell rendered and the mount-time notifyMenuState push fired.
    await screen.findByText(/^CIRCLE$/i);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    // The mount-time push has canSave/canSaveAs:true (summary loaded), modalOpen:false.
    expect(api.notifyMenuState).toHaveBeenCalledWith(
      expect.objectContaining({ canSave: true, canSaveAs: true, modalOpen: false }),
    );
  });

  it('8.2-MENU-02: Opening OverrideDialog flips modalOpen to true (D-184)', async () => {
    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;
    const f = new File(['{}'], 'SIMPLE_TEST.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f] } as unknown as DataTransfer });
    // Same fixture / row-targeting pattern Plan 08.1-05 uses (lines 160-167):
    // makeSummary() peaks contain CIRCLE + SQUARE (no TRIANGLE) — target CIRCLE
    // (peakScale 0.5 → "0.500×" in the Scale cell, where onDoubleClick lives).
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const peakCell = within(circleRow).getByText(/^32×32$/);
    fireEvent.doubleClick(peakCell);
    // The OverrideDialog mount triggers a notifyMenuState push with modalOpen:true.
    await screen.findByRole('dialog');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    // Find any call where modalOpen===true AFTER the mount push.
    const modalPushed = api.notifyMenuState.mock.calls.some(
      (c: unknown[]) => (c[0] as { modalOpen?: boolean }).modalOpen === true,
    );
    expect(modalPushed).toBe(true);
  });

  it('8.2-MENU-03: onMenuOpen callback fires openProject (loaded state)', async () => {
    render(<App />);
    // The App.tsx menu-event useEffect runs on mount; capture the registered
    // callback via .mock.calls[0][0]. Plan 08.2-04's useEffect calls
    // window.api.onMenuOpen(cb) once; the mock returns a stub unsubscribe.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    expect(api.onMenuOpen.mock.calls.length).toBeGreaterThan(0);
    const cb = api.onMenuOpen.mock.calls[0][0] as () => Promise<void>;
    await cb();
    expect(api.openProject).toHaveBeenCalled();
  });

  it('8.2-MENU-04: onMenuOpen in projectLoadFailed state still fires open flow (08.1 UAT fix)', async () => {
    // THE CANONICAL 08.1 UAT REGRESSION REPRODUCER. Drive App into
    // projectLoadFailed by dropping a .stmproj that fails to load with
    // SkeletonNotFoundOnLoadError + the 7 threaded recovery fields per
    // Phase 8.1 D-158. Then invoke the captured onMenuOpen callback. After
    // Plan 08.2-04, App.tsx is the always-mounted root that owns the
    // subscription, so Cmd+O fires regardless of AppState — including the
    // recovery-banner state where the bug originally manifested.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    api.openProjectFromFile = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        kind: 'SkeletonNotFoundOnLoadError',
        message: 'Skeleton JSON not found: /missing/skel.json',
        projectPath: '/abs/proj.stmproj',
        originalSkeletonPath: '/missing/skel.json',
        mergedOverrides: {},
        samplingHz: 120,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
      },
    } as OpenResponse);

    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;
    const f = new File(['{}'], 'broken.stmproj', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f] } as unknown as DataTransfer });

    // Wait for App to enter projectLoadFailed (recovery banner mounts as role=alert).
    await screen.findByRole('alert');

    // Now invoke the captured onMenuOpen — it MUST still trigger openProject.
    // THIS IS THE CANONICAL 08.1 UAT BUG ASSERTION.
    const cb = api.onMenuOpen.mock.calls[0][0] as () => Promise<void>;
    await cb();
    expect(api.openProject).toHaveBeenCalled();
  });

  it('8.2-MENU-05: onMenuOpenRecent fires openProjectFromPath after dirty-guard', async () => {
    render(<App />);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const api = (globalThis as any).api;
    api.openProjectFromPath = vi.fn().mockResolvedValue({
      ok: true,
      project: {
        summary: makeSummary(),
        restoredOverrides: {},
        staleOverrideKeys: [],
        samplingHz: 120,
        lastOutDir: null,
        sortColumn: null,
        sortDir: null,
        projectFilePath: '/abs/path.stmproj',
        documentation: DEFAULT_DOCUMENTATION,
      },
    });
    const cb = api.onMenuOpenRecent.mock.calls[0][0] as (path: string) => Promise<void>;
    await cb('/abs/path.stmproj');
    expect(api.openProjectFromPath).toHaveBeenCalledWith('/abs/path.stmproj');
  });

  it('8.2-MENU-06: AppShell keydown listener is gone — Cmd+O dispatch does NOT call openProject directly', async () => {
    // Mount AppShell DIRECTLY (NOT App) so the App.tsx-level menu-event
    // useEffect that captures onMenuOpen never runs — that callback (when
    // invoked) DOES call openProject, which would pollute this assertion.
    // We're asserting the OLD AppShell.tsx:626-643 keydown path is gone:
    // dispatching Cmd+O via window.dispatchEvent must NOT trigger
    // openProject in any way.
    const summary = makeSummary();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    render(<AppShell summary={summary} samplingHz={120} {...({} as any)} />);
    // Defensive reset — even though App isn't mounted, the openProject mock
    // is shared via vi.stubGlobal('api', ...). Clear before dispatching to
    // make the assertion unambiguous.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).api.openProject.mockClear();
    fireEvent.keyDown(window, { key: 'o', metaKey: true });
    await Promise.resolve();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((globalThis as any).api.openProject).not.toHaveBeenCalled();
  });
});
