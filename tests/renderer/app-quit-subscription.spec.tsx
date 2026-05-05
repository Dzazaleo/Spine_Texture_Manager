// @vitest-environment jsdom
/**
 * Phase 18 Plan 02 — App.tsx before-quit dirty-guard lift specs (QUIT-01 / QUIT-02).
 *
 * Asserts the lifted `onCheckDirtyBeforeQuit` subscription lives in App.tsx
 * (not AppShell) and runs on every AppState branch — including 'idle' (no
 * project loaded), which is the AppState where Cmd+Q + AppleScript quit
 * silently no-op'd pre-lift (root cause: AppShell unmounted → no listener →
 * main paused at preventDefault forever).
 *
 * Coverage (CONTEXT D-07 — verbatim wording):
 *   1. (18-a) App.tsx mounted in `idle` AppState (no project loaded) registers
 *             `onCheckDirtyBeforeQuit`.
 *   2. (18-b) Firing `onCheckDirtyBeforeQuit` while idle → window.api.
 *             confirmQuitProceed() called; SaveQuitDialog does NOT mount.
 *   3. (18-c) Firing `onCheckDirtyBeforeQuit` while loaded + isDirty === true
 *             → SaveQuitDialog DOES mount; confirmQuitProceed() is NOT called yet.
 *   4. (18-d) Cancel-from-SaveQuitDialog → confirmQuitProceed() is NOT called
 *             (app stays paused at main's preventDefault — correct cancel
 *             semantic).
 *
 * Analog: tests/renderer/app-update-subscriptions.spec.tsx (Phase 14 lift
 * spec — same Object.defineProperty(window, 'api', ...) idiom, same
 * render(<App/>) + synthetic-callback-fire pattern). The loaded+dirty path
 * (18-c, 18-d) follows tests/renderer/save-load.spec.tsx's 8.1-VR-03a/b idiom:
 * drop a .json → loaded state → double-click a Scale cell → set value 50 →
 * Apply → overrides Map gains an entry → AppShell.tsx isDirty memo flips true.
 *
 * Plan 18-01 has already lifted the subscription out of AppShell into
 * App.tsx; this spec locks the lift so a future revert (subscription back
 * in AppShell) fails the suite — App in idle would not register the
 * subscription, and assertions 18-a / 18-b would fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../src/renderer/src/App';
import type { LoadResponse, OpenResponse, SaveResponse, SkeletonSummary } from '../../src/shared/types';

afterEach(cleanup);

// Synthetic minimal SkeletonSummary that satisfies AppShell's mount AND
// surfaces a CIRCLE row with peakScale 0.5 — used for assertions 18-c / 18-d
// to drive a dirty-state mutation via the OverrideDialog Apply path (mirrors
// save-load.spec.tsx's 8.1-VR-03a fixture exactly).
function makeSummary(): SkeletonSummary {
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

describe('Phase 18 — App.tsx before-quit dirty-guard lift', () => {
  // Capture the registered callback so tests can fire the IPC synthetically.
  let checkDirtyBeforeQuitCb: (() => void) | null = null;

  const confirmQuitProceedMock = vi.fn();

  beforeEach(() => {
    checkDirtyBeforeQuitCb = null;
    confirmQuitProceedMock.mockClear();

    // Stamp the FULL window.api surface required to mount App.tsx without
    // crashing — App.tsx subscribes to menu channels (Phase 8.2), the 5 lifted
    // update channels (Phase 14), and the new lifted quit channel (Phase 18)
    // unconditionally on mount; missing any method throws TypeError on the
    // first useEffect commit. The save/open/loader bridges below are needed
    // by assertions 18-c / 18-d for the .json drop → loaded → override edit
    // path. Mirrors save-load.spec.tsx's full-surface idiom.
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: {
        // Phase 8 — save/open/loader IPC surface (needed by 18-c / 18-d
        // .json drop path → loaded state → AppShell mount → override edit).
        saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
        saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' } as SaveResponse),
        openProject: vi.fn(),
        openProjectFromFile: vi.fn(),
        openProjectFromPath: vi.fn(),
        loadSkeletonFromFile: vi.fn().mockResolvedValue({ ok: true, summary: makeSummary() } as LoadResponse),
        locateSkeleton: vi.fn(),
        reloadProjectWithSkeleton: vi.fn(),
        pickOutputDirectory: vi.fn(),
        startExport: vi.fn(),
        cancelExport: vi.fn(),
        onExportProgress: vi.fn(() => () => undefined),
        openOutputFolder: vi.fn(),
        probeExportConflicts: vi.fn(),
        // Phase 8.2 D-175 / D-181 — menu surface.
        notifyMenuState: vi.fn(),
        onMenuOpen: vi.fn(() => () => undefined),
        onMenuOpenRecent: vi.fn(() => () => undefined),
        onMenuSave: vi.fn(() => () => undefined),
        onMenuSaveAs: vi.fn(() => () => undefined),
        // Phase 9 D-194 — sampler progress + cancel bridges.
        onSamplerProgress: vi.fn(() => () => undefined),
        cancelSampler: vi.fn(),
        // Phase 9 — Settings + Help menu surfaces.
        onMenuSettings: vi.fn(() => () => undefined),
        onMenuHelp: vi.fn(() => () => undefined),
        openExternalUrl: vi.fn(),
        // Phase 9 — re-sample IPC.
        resampleProject: vi.fn(),
        // Phase 14 — lifted update subscriptions.
        onUpdateAvailable: vi.fn(() => () => undefined),
        onUpdateDownloaded: vi.fn(() => () => undefined),
        onUpdateNone: vi.fn(() => () => undefined),
        onUpdateError: vi.fn(() => () => undefined),
        onMenuCheckForUpdates: vi.fn(() => () => undefined),
        onMenuInstallationGuide: vi.fn(() => () => undefined),
        // Phase 12 / Phase 14 — auto-update IPC bridges.
        checkForUpdates: vi.fn(),
        requestPendingUpdate: vi.fn().mockResolvedValue(null),
        dismissUpdate: vi.fn(),
        downloadUpdate: vi.fn(),
        quitAndInstallUpdate: vi.fn(),
        // Phase 18 — the channel under test. Capture the callback so tests
        // can fire the IPC synthetically; return a no-op unsubscribe so
        // App.tsx's cleanup doesn't crash on unmount.
        onCheckDirtyBeforeQuit: vi.fn((cb: () => void) => {
          checkDirtyBeforeQuitCb = cb;
          return () => undefined;
        }),
        confirmQuitProceed: confirmQuitProceedMock,
      },
    });
  });

  it('(18-a) App.tsx mounted in idle (no project loaded) registers onCheckDirtyBeforeQuit', () => {
    render(<App />);
    // The subscription must register on App's first useEffect commit, BEFORE
    // any project is loaded (no AppShell mounted yet). Pre-lift this happened
    // inside AppShell which was unmounted in idle — assertion would fail and
    // the run-time bug would be visible in the test suite.
    expect(window.api.onCheckDirtyBeforeQuit as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
    expect(checkDirtyBeforeQuitCb).not.toBeNull();
  });

  it('(18-b) Firing onCheckDirtyBeforeQuit while idle calls confirmQuitProceed and does NOT mount SaveQuitDialog', () => {
    render(<App />);
    expect(checkDirtyBeforeQuitCb).not.toBeNull();
    // Synthetic IPC fire — wrap in act() because the captured callback path
    // bypasses the DOM event system; React 19 won't auto-flush state updates
    // without explicit act() (see Phase 14 spec lines 147 + 167 + 175 + 192).
    act(() => {
      checkDirtyBeforeQuitCb!();
    });
    // Plan 01 D-04 — AppShell unmounted → dirtyCheckRef.current === null →
    // App.tsx fires confirmQuitProceed immediately, no dialog.
    expect(confirmQuitProceedMock).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('(18-c) Firing onCheckDirtyBeforeQuit while loaded + isDirty === true mounts SaveQuitDialog and does NOT call confirmQuitProceed yet', async () => {
    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;

    // Drop SIMPLE_TEST.json → handleLoad → status: 'loaded' → AppShell mounts.
    // Plan 01 D-02: AppShell's useEffect at AppShell.tsx:1072-1086 registers
    // `{ isDirty: () => isDirty, openSaveQuitDialog }` into dirtyCheckRef.current.
    const f1 = new File(['{}'], 'SIMPLE_TEST.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f1] } as unknown as DataTransfer });

    // Mark the session dirty by applying an override via the GlobalMaxRender
    // panel double-click → OverrideDialog → Apply path. The override Map
    // gains CIRCLE → AppShell's isDirty memo flips true (line 607-608: lastSaved
    // === null, so dirty = overrides.size > 0). Mirrors save-load.spec.tsx's
    // 8.1-VR-03a fixture; React 19's MessageChannel-flushed update scheduler
    // requires findBy* polling rather than naked microtask awaits.
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const scaleCell = within(circleRow).getByText(/0\.500×/);
    fireEvent.doubleClick(scaleCell);
    const input = await screen.findByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    const apply = await screen.findByRole('button', { name: /^Apply$/i });
    await userEvent.click(apply);

    // App.tsx's lifted before-quit subscription was registered at App's first
    // useEffect commit. Now that AppShell is mounted + dirty, fire the IPC
    // synthetically — App.tsx's three-branch dispatch (App.tsx:365-387) hits
    // the dirty branch → ref.openSaveQuitDialog(onProceed) → AppShell calls
    // setSaveQuitDialogState({ reason: 'quit', pendingAction: onProceed }) →
    // SaveQuitDialog mounts.
    expect(checkDirtyBeforeQuitCb).not.toBeNull();
    act(() => {
      checkDirtyBeforeQuitCb!();
    });

    // SaveQuitDialog with reason='quit' is mounted. Bodycopy from
    // src/renderer/src/modals/SaveQuitDialog.tsx:55-59:
    //   "Save changes before quitting?"
    const dialogTitle = await screen.findByText(/Save changes before quitting/i);
    expect(dialogTitle, 'SaveQuitDialog with reason=quit must mount on dirty IPC fire').toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    // confirmQuitProceed has NOT been called yet — main stays paused at
    // preventDefault until the user clicks Save / Don't Save (which runs the
    // pendingAction → confirmQuitProceed) or Cancel (which does NOT).
    expect(confirmQuitProceedMock).not.toHaveBeenCalled();
  });

  it("(18-d) Cancel-from-SaveQuitDialog does NOT call confirmQuitProceed (app stays paused at main preventDefault — correct cancel-quit semantic)", async () => {
    const { container } = render(<App />);
    const dropTarget = container.firstElementChild as HTMLElement;

    // Same setup as 18-c: drop .json → loaded state → AppShell mounts.
    const f1 = new File(['{}'], 'SIMPLE_TEST.json', { type: 'application/json' });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [f1] } as unknown as DataTransfer });

    // Mark dirty via the OverrideDialog Apply path (same as 18-c).
    const circleNameCell = await screen.findByText(/^CIRCLE$/i);
    const circleRow = circleNameCell.closest('tr')!;
    const scaleCell = within(circleRow).getByText(/0\.500×/);
    fireEvent.doubleClick(scaleCell);
    const input = await screen.findByRole('spinbutton');
    fireEvent.change(input, { target: { value: '50' } });
    const apply = await screen.findByRole('button', { name: /^Apply$/i });
    await userEvent.click(apply);

    // Fire the IPC → SaveQuitDialog mounts (proven by 18-c).
    expect(checkDirtyBeforeQuitCb).not.toBeNull();
    act(() => {
      checkDirtyBeforeQuitCb!();
    });
    await screen.findByText(/Save changes before quitting/i);

    // Click Cancel. AppShell.tsx:1423-1430 — onCancel runs cancelAction?.()
    // (undefined for the 'quit' flow per Plan 01 architectural-lock — App.tsx
    // does NOT pass a cancelAction) then setSaveQuitDialogState(null). Dialog
    // unmounts. confirmQuitProceed is NEVER called — main stays paused at
    // preventDefault → Electron aborts the quit. That is the cancel-quit
    // semantic: pressing Cancel keeps the app running.
    const cancelBtn = screen.getByRole('button', { name: /^Cancel$/i });
    await userEvent.click(cancelBtn);

    // The two load-bearing post-conditions:
    //   (1) confirmQuitProceed was NEVER called — main pauses → quit aborted.
    //   (2) The dialog has unmounted (cleanup happened).
    expect(confirmQuitProceedMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
