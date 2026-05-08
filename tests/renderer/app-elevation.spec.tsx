// @vitest-environment jsdom
/**
 * Phase 31 PLATFORM-01 — App.tsx elevation plumbing specs (Task 2).
 *
 * Tests D1..D4 from 31-03-PLAN.md <behavior>:
 *   - D1 — non-elevated default body in idle (existing message preserved)
 *   - D2 — elevated → verbatim two-sentence advisory replaces idle body
 *   - D3 — advisory wrapper has role="status" (ARIA contract)
 *   - D4 — window.api.isElevated() called exactly once on mount
 *
 * Mirrors tests/renderer/app-update-subscriptions.spec.tsx full window.api
 * stub-surface idiom: every method App.tsx subscribes to at mount must be
 * present or render(<App/>) throws inside useEffect on first commit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { App } from '../../src/renderer/src/App';

afterEach(cleanup);

const VERBATIM_LEAD = 'Drag-and-drop is unavailable while running as administrator.';
const VERBATIM_ROUTING =
  'Use File → Open instead, or relaunch the app without administrator privileges.';
const EXISTING_IDLE_PROMPT_FRAGMENT = /Drop a/;

function stampApiSurface(isElevatedMock: ReturnType<typeof vi.fn>) {
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
      onMenuReloadProject: vi.fn(() => () => undefined),
      onMenuExport: vi.fn(() => () => undefined),
      onMenuCloseProject: vi.fn(() => () => undefined),
      onMenuShowInFolder: vi.fn(() => () => undefined),
      onMenuCopyPeakTable: vi.fn(() => () => undefined),
      // Phase 14 update subscriptions.
      onUpdateAvailable: vi.fn(() => () => undefined),
      onUpdateDownloaded: vi.fn(() => () => undefined),
      onUpdateNone: vi.fn(() => () => undefined),
      onUpdateError: vi.fn(() => () => undefined),
      onMenuCheckForUpdates: vi.fn(() => () => undefined),
      checkForUpdates: vi.fn(),
      requestPendingUpdate: vi.fn().mockResolvedValue(null),
      dismissUpdate: vi.fn(),
      downloadUpdate: vi.fn(),
      quitAndInstallUpdate: vi.fn(),
      openExternalUrl: vi.fn(),
      // Phase 18 dirty-guard.
      onCheckDirtyBeforeQuit: vi.fn(() => () => undefined),
      confirmQuitProceed: vi.fn(),
      // Phase 31 PLATFORM-01 — the bridge under test.
      isElevated: isElevatedMock,
    },
  });
}

describe('Phase 31 PLATFORM-01 — App.tsx elevation plumbing', () => {
  let isElevatedMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    isElevatedMock = vi.fn();
  });

  it('D1: non-elevated → idle body shows the existing empty-state prompt', async () => {
    isElevatedMock.mockResolvedValue(false);
    stampApiSurface(isElevatedMock);
    render(<App />);
    // Wait for the async useEffect → setState round-trip to settle.
    await waitFor(() => {
      expect(isElevatedMock).toHaveBeenCalled();
    });
    expect(screen.getByText(EXISTING_IDLE_PROMPT_FRAGMENT)).toBeTruthy();
    expect(screen.queryByText(VERBATIM_LEAD)).toBeNull();
  });

  it('D2: elevated → idle body shows the verbatim two-sentence advisory', async () => {
    isElevatedMock.mockResolvedValue(true);
    stampApiSurface(isElevatedMock);
    render(<App />);
    // The advisory is rendered inside a single <p> per UI-SPEC; both sentences
    // co-exist in the same text node separated by a single space. We assert
    // both substrings render in the DOM.
    await waitFor(() => {
      expect(screen.getByText((text) => text.includes(VERBATIM_LEAD))).toBeTruthy();
    });
    expect(
      screen.getByText((text) => text.includes(VERBATIM_ROUTING)),
    ).toBeTruthy();
    // Existing idle prompt must NOT render in the elevated branch.
    expect(screen.queryByText(EXISTING_IDLE_PROMPT_FRAGMENT)).toBeNull();
  });

  it('D3: advisory wrapper has role="status" (ARIA contract)', async () => {
    isElevatedMock.mockResolvedValue(true);
    stampApiSurface(isElevatedMock);
    render(<App />);
    const status = await screen.findByRole('status');
    // The status node must contain both verbatim sentences.
    expect(status.textContent).toContain(VERBATIM_LEAD);
    expect(status.textContent).toContain(VERBATIM_ROUTING);
  });

  it('D4: window.api.isElevated is called exactly once on mount', async () => {
    isElevatedMock.mockResolvedValue(false);
    stampApiSurface(isElevatedMock);
    render(<App />);
    await waitFor(() => {
      expect(isElevatedMock).toHaveBeenCalledTimes(1);
    });
    // Settle: give any stray microtasks a chance, then re-assert.
    await new Promise((r) => setTimeout(r, 0));
    expect(isElevatedMock).toHaveBeenCalledTimes(1);
  });
});
