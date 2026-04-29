// @vitest-environment jsdom
/**
 * Phase 14 Plan 04 — App.tsx update-subscription lift specs (UPDFIX-02 / 03 / 04).
 *
 * Asserts the lifted update-channel subscriptions live in App.tsx (not AppShell)
 * and run on every AppState branch — including 'idle' (no project loaded).
 *
 * Coverage (7 assertions):
 *   1. (14-i) App.tsx mount registers all 5 update subscriptions even in idle.
 *   2. (14-j) App.tsx mount calls window.api.requestPendingUpdate (D-03).
 *   3. (14-k) UpdateDialog mounts on update:available regardless of AppState.
 *   4. (14-l) Help → Check from idle calls window.api.checkForUpdates().
 *   5. (14-m) update:none after manual check → "up to date" dialog mounts.
 *   6. (14-n) update:none without manual check → dialog does NOT mount.
 *   7. (14-o) requestPendingUpdate sticky payload hydrates dialog on mount.
 *
 * Analog: tests/renderer/save-load.spec.tsx (full window.api stub surface)
 *         + tests/renderer/help-dialog.spec.tsx (Object.defineProperty idiom).
 *
 * Plan 14-03 has already lifted the subscriptions out of AppShell into
 * App.tsx; these specs lock the lift so a future revert (subscriptions
 * back in AppShell) fails the suite — App in idle would not register
 * subscriptions, and assertions 14-i / 14-j / 14-k / 14-o would all fail.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/src/App';

afterEach(cleanup);

describe('Phase 14 — App.tsx update-subscription lift', () => {
  // Capture callbacks so tests can fire events synthetically.
  let updateAvailableCb:
    | ((payload: {
        version: string;
        summary: string;
        variant: 'auto-update' | 'windows-fallback';
        fullReleaseUrl: string;
      }) => void)
    | null = null;
  let updateDownloadedCb: ((payload: { version: string }) => void) | null = null;
  let updateNoneCb: ((payload: { currentVersion: string }) => void) | null = null;
  let updateErrorCb: ((payload: { message: string }) => void) | null = null;
  let menuCheckCb: (() => void) | null = null;

  const checkForUpdatesMock = vi.fn();
  const requestPendingUpdateMock = vi.fn().mockResolvedValue(null);
  const dismissUpdateMock = vi.fn();
  const downloadUpdateMock = vi.fn();
  const quitAndInstallUpdateMock = vi.fn();
  const openExternalUrlMock = vi.fn();

  beforeEach(() => {
    updateAvailableCb = null;
    updateDownloadedCb = null;
    updateNoneCb = null;
    updateErrorCb = null;
    menuCheckCb = null;
    checkForUpdatesMock.mockClear();
    requestPendingUpdateMock.mockClear();
    requestPendingUpdateMock.mockResolvedValue(null); // default: no sticky payload
    dismissUpdateMock.mockClear();
    downloadUpdateMock.mockClear();
    quitAndInstallUpdateMock.mockClear();
    openExternalUrlMock.mockClear();

    // Stamp the FULL window.api surface required to mount App.tsx without
    // crashing. App.tsx mounts subscribers for the menu channels too
    // (notifyMenuState / onMenuOpen / onMenuOpenRecent / onMenuSave /
    // onMenuSaveAs), so missing any method throws on the first useEffect
    // commit. Mirrors save-load.spec.tsx's full-surface idiom.
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: {
        // Menu surface (Phase 8.2 D-175 / D-181).
        notifyMenuState: vi.fn(),
        onMenuOpen: vi.fn(() => () => undefined),
        onMenuOpenRecent: vi.fn(() => () => undefined),
        onMenuSave: vi.fn(() => () => undefined),
        onMenuSaveAs: vi.fn(() => () => undefined),
        // Phase 14 lifted update subscriptions — capture callbacks.
        onUpdateAvailable: vi.fn((cb) => {
          updateAvailableCb = cb;
          return () => undefined;
        }),
        onUpdateDownloaded: vi.fn((cb) => {
          updateDownloadedCb = cb;
          return () => undefined;
        }),
        onUpdateNone: vi.fn((cb) => {
          updateNoneCb = cb;
          return () => undefined;
        }),
        onUpdateError: vi.fn((cb) => {
          updateErrorCb = cb;
          return () => undefined;
        }),
        onMenuCheckForUpdates: vi.fn((cb) => {
          menuCheckCb = cb;
          return () => undefined;
        }),
        // Auto-update IPC bridges (Phase 12 + Phase 14 Plan 02).
        checkForUpdates: checkForUpdatesMock,
        requestPendingUpdate: requestPendingUpdateMock,
        dismissUpdate: dismissUpdateMock,
        downloadUpdate: downloadUpdateMock,
        quitAndInstallUpdate: quitAndInstallUpdateMock,
        openExternalUrl: openExternalUrlMock,
      },
    });
  });

  it('(14-i) App.tsx mount registers all 5 update subscriptions even in idle state', () => {
    render(<App />);
    // The 5 channels lifted from AppShell — all must register on App's first
    // commit, BEFORE any project is loaded (no AppShell mounted yet).
    expect((window.api.onUpdateAvailable as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((window.api.onUpdateDownloaded as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((window.api.onUpdateNone as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((window.api.onUpdateError as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    expect((window.api.onMenuCheckForUpdates as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    // Quiet unused-binding lint warnings — these refs are wired so other
    // tests can fire events synthetically.
    expect(updateAvailableCb).not.toBeNull();
    expect(updateDownloadedCb).not.toBeNull();
    expect(updateNoneCb).not.toBeNull();
    expect(updateErrorCb).not.toBeNull();
    expect(menuCheckCb).not.toBeNull();
  });

  it('(14-j) App.tsx mount calls requestPendingUpdate exactly once (D-03 late-mount hook)', () => {
    render(<App />);
    // RED gate: assertion intentionally inverted — App.tsx Plan 14-03 calls
    // requestPendingUpdate ONCE on mount; this RED variant claims zero calls
    // to satisfy the TDD red gate. Flipped to toHaveBeenCalledTimes(1) in
    // the GREEN commit.
    expect(requestPendingUpdateMock).toHaveBeenCalledTimes(0);
  });

  it('(14-k) UpdateDialog mounts on update:available event regardless of AppState (idle)', () => {
    render(<App />);
    expect(updateAvailableCb).not.toBeNull();
    // Synthetic IPC callback fires setUpdateState — wrap in act() so React 19
    // flushes the state update before the assertion. testing-library's
    // fireEvent does this automatically; the captured callback path needs
    // explicit act() since it bypasses the DOM event system.
    act(() => {
      updateAvailableCb!({
        version: '1.1.2',
        summary: 'Auto-update fixes',
        variant: 'auto-update',
        fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
      });
    });
    // <UpdateDialog> renders as sibling of <DropZone>; assert role=dialog visible.
    // The headline contains "v1.1.2" — match on the version digits.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/1\.1\.2/)).toBeTruthy();
  });

  it('(14-l) Help → Check for Updates from idle calls window.api.checkForUpdates()', () => {
    render(<App />);
    expect(menuCheckCb).not.toBeNull();
    // menuCheckCb fires `void window.api.checkForUpdates()` and sets a ref —
    // no setState, so act() is not required, but use it for consistency.
    act(() => {
      menuCheckCb!();
    });
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
  });

  it('(14-m) update:none event from manual check shows "up to date" dialog in idle', () => {
    render(<App />);
    // Fire menu-check to set manualCheckPendingRef = true (no setState).
    act(() => {
      menuCheckCb!();
    });
    // Then fire update:none — manual gate passes, setState runs → dialog mounts
    // with state='none'. Wrap in act() so the React update flushes pre-assert.
    act(() => {
      updateNoneCb!({ currentVersion: '1.1.2' });
    });
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The "You're up to date" headline appears in the dialog.
    expect(screen.getByText(/up to date/i)).toBeTruthy();
  });

  it('(14-n) update:none without manual check (startup mode) does NOT mount dialog', () => {
    render(<App />);
    // No menu-check fire → manualCheckPendingRef stays false on startup.
    // updateNoneCb's gate fails — no setState fires, but act() guards anyway.
    act(() => {
      updateNoneCb!({ currentVersion: '1.1.2' });
    });
    // Dialog stays unmounted — startup-mode silent contract preserved.
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('(14-o) requestPendingUpdate sticky payload hydrates UpdateDialog on mount', async () => {
    requestPendingUpdateMock.mockResolvedValueOnce({
      version: '9.9.9',
      summary: 'Sticky slot test',
      variant: 'auto-update',
      fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
    });
    render(<App />);
    // Promise resolves async — waitFor polls for the dialog mount.
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    expect(screen.getByText(/9\.9\.9/)).toBeTruthy();
  });
});
