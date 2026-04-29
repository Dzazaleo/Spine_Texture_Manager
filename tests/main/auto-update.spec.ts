/**
 * Phase 12 Plan 01 Task 2 — RED specs for auto-update.ts orchestrator.
 *
 * Coverage (per 12-01-PLAN.md Task 2 Behavior 1-14):
 *   1.  init idempotency (double-call binds events once).
 *   2.  init configures autoUpdater (autoDownload=false, autoInstallOnAppQuit=false,
 *       allowPrerelease=true).
 *   3.  update-available → IPC bridge to renderer with Summary extraction.
 *   4a. dismissedUpdateVersion = available → suppressed.
 *   4b. dismissedUpdateVersion > available → suppressed.
 *   4c. dismissedUpdateVersion < available → NOT suppressed (D-08 strict `>`).
 *   4d. dismissedUpdateVersion < major-bump → NOT suppressed.
 *   5.  update-downloaded → IPC.
 *   6.  update-not-available (manual) → IPC update:none.
 *   7.  update-not-available (startup) → IPC update:none (renderer ignores).
 *   8.  error on startup → silent (no IPC error send).
 *   9.  error on manual → IPC update:error.
 *   10. 10s timeout → silent (UPD-05).
 *   11. downloadUpdate → autoUpdater.downloadUpdate().
 *   12. quitAndInstallUpdate → setTimeout(0) deferred quitAndInstall(false, true).
 *   13. dismissUpdate → setDismissedVersion('X.Y.Z').
 *   14. extractSummary regex parsing (string / array / null / HTML-stripping).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ----- Module-level mocks (hoisted by vi.mock) ------------------------------

// electron-updater EventEmitter stub. Tests trigger events via `eventCallbacks`.
const eventCallbacks = vi.hoisted(() => new Map<string, ((...args: unknown[]) => void)[]>());
const autoUpdaterStub = vi.hoisted(() => ({
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowPrerelease: false,
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const list = eventCallbacks.get(event) ?? [];
    list.push(cb);
    eventCallbacks.set(event, list);
  }),
  checkForUpdates: vi.fn().mockResolvedValue(null),
  downloadUpdate: vi.fn().mockResolvedValue(undefined),
  quitAndInstall: vi.fn(),
}));

vi.mock('electron-updater', () => ({
  autoUpdater: autoUpdaterStub,
}));

// electron app stub.
const electronAppStub = vi.hoisted(() => ({
  getVersion: vi.fn(() => '1.0.0'),
  getPath: vi.fn(() => '/tmp/userData'),
}));

vi.mock('electron', () => ({
  app: electronAppStub,
}));

// getMainWindow stub via index.js mock — auto-update.ts imports from './index.js'.
const sendStub = vi.hoisted(() => vi.fn());
const mainWindowStub = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => false),
  webContents: { send: sendStub },
}));

vi.mock('../../src/main/index.js', () => ({
  getMainWindow: vi.fn(() => mainWindowStub),
}));

// update-state.ts mocks — controlled per-test for dismissed-version suppression.
const loadUpdateStateMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    version: 1,
    dismissedUpdateVersion: null,
    spikeOutcome: 'unknown',
  }),
);
const setDismissedVersionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../src/main/update-state.js', () => ({
  loadUpdateState: loadUpdateStateMock,
  setDismissedVersion: setDismissedVersionMock,
}));

// ----- Helpers --------------------------------------------------------------

async function fireEvent(name: string, ...args: unknown[]): Promise<void> {
  const list = eventCallbacks.get(name) ?? [];
  for (const cb of list) {
    await cb(...args);
  }
  // Drain any microtasks the callback may have scheduled (deliverUpdateAvailable
  // is async — it must resolve before the test asserts on sendStub).
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(async () => {
  // Reset call records but preserve `on` impl (which stores in eventCallbacks).
  sendStub.mockClear();
  autoUpdaterStub.checkForUpdates.mockClear();
  autoUpdaterStub.downloadUpdate.mockClear();
  autoUpdaterStub.quitAndInstall.mockClear();
  loadUpdateStateMock.mockClear();
  setDismissedVersionMock.mockClear();
  loadUpdateStateMock.mockResolvedValue({
    version: 1,
    dismissedUpdateVersion: null,
    spikeOutcome: 'unknown',
  });
  electronAppStub.getVersion.mockReturnValue('1.0.0');

  // Reset autoUpdater config flags to "wrong" defaults so init can be observed
  // to flip them.
  autoUpdaterStub.autoDownload = true;
  autoUpdaterStub.autoInstallOnAppQuit = true;
  autoUpdaterStub.allowPrerelease = false;
  autoUpdaterStub.on.mockClear();
  eventCallbacks.clear();

  // Reset module registry so the `initialized` guard inside auto-update.ts
  // resets between tests (otherwise event-listener-once tests bleed state).
  vi.resetModules();
  // Re-bind the same in-memory mocks for the freshly loaded module.
  vi.doMock('electron-updater', () => ({ autoUpdater: autoUpdaterStub }));
  vi.doMock('electron', () => ({ app: electronAppStub }));
  vi.doMock('../../src/main/index.js', () => ({
    getMainWindow: vi.fn(() => mainWindowStub),
  }));
  vi.doMock('../../src/main/update-state.js', () => ({
    loadUpdateState: loadUpdateStateMock,
    setDismissedVersion: setDismissedVersionMock,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

// ----- Tests ----------------------------------------------------------------

describe('initAutoUpdater (idempotency + config)', () => {
  it('(1) double init binds each event listener once (idempotency guard)', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    mod.initAutoUpdater();
    // 4 events bound (update-available, update-not-available, update-downloaded, error).
    // Two init calls would bind 8 if no guard; 4 == idempotent.
    expect(autoUpdaterStub.on).toHaveBeenCalledTimes(4);
  });

  it('(2) configures autoDownload=false, autoInstallOnAppQuit=false, allowPrerelease=true', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    expect(autoUpdaterStub.autoDownload).toBe(false);
    expect(autoUpdaterStub.autoInstallOnAppQuit).toBe(false);
    expect(autoUpdaterStub.allowPrerelease).toBe(true);
  });
});

describe('update-available → IPC bridge (extractSummary + variant)', () => {
  it('(3) emits update:available with version + extracted Summary + fullReleaseUrl', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', {
      version: '1.2.3',
      releaseNotes: '## Summary\nFixed F1 bug.\n## Other section\nignored',
    });
    expect(sendStub).toHaveBeenCalledTimes(1);
    expect(sendStub).toHaveBeenCalledWith('update:available', expect.objectContaining({
      version: '1.2.3',
      summary: 'Fixed F1 bug.',
      fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
    }));
  });
});

describe('dismissedUpdateVersion suppression (D-08 strict semver `>`)', () => {
  it('(4a) dismissed === available → suppress', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).not.toHaveBeenCalledWith('update:available', expect.anything());
  });

  it('(4b) dismissed > available → suppress', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.4', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).not.toHaveBeenCalledWith('update:available', expect.anything());
  });

  it('(4c) dismissed < available → NOT suppress (newer re-fires)', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.4', releaseNotes: '' });
    expect(sendStub).toHaveBeenCalledWith('update:available', expect.objectContaining({ version: '1.2.4' }));
  });

  it('(4d) major-bump (dismissed=1.2.3, available=2.0.0) → NOT suppress', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '2.0.0', releaseNotes: '' });
    expect(sendStub).toHaveBeenCalledWith('update:available', expect.objectContaining({ version: '2.0.0' }));
  });
});

describe('update-downloaded → IPC bridge', () => {
  it('(5) emits update:downloaded with version', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-downloaded', { version: '1.2.3' });
    expect(sendStub).toHaveBeenCalledWith('update:downloaded', { version: '1.2.3' });
  });
});

describe('update-not-available → IPC bridge (renderer-side filtering)', () => {
  it('(6) manual mode: emits update:none with currentVersion', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(true);
    await fireEvent('update-not-available');
    expect(sendStub).toHaveBeenCalledWith('update:none', { currentVersion: '1.0.0' });
  });

  it('(7) startup mode: also emits update:none (renderer filters by manualCheckPendingRef)', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(false);
    await fireEvent('update-not-available');
    expect(sendStub).toHaveBeenCalledWith('update:none', { currentVersion: '1.0.0' });
  });
});

describe('error handling — silent on startup, IPC on manual', () => {
  it('(8) error on startup → silent (no update:error IPC)', async () => {
    autoUpdaterStub.checkForUpdates.mockRejectedValueOnce(new Error('network down'));
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(false);
    expect(sendStub).not.toHaveBeenCalledWith('update:error', expect.anything());
  });

  it('(9) error on manual check → IPC update:error', async () => {
    autoUpdaterStub.checkForUpdates.mockRejectedValueOnce(new Error('boom'));
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(true);
    expect(sendStub).toHaveBeenCalledWith('update:error', expect.objectContaining({ message: 'boom' }));
  });
});

describe('10s timeout (UPD-05)', () => {
  it('(10) checkForUpdates that never resolves: silent after 10s on startup, no unhandled rejection', async () => {
    vi.useFakeTimers();
    // checkForUpdates returns a promise that NEVER resolves.
    autoUpdaterStub.checkForUpdates.mockImplementationOnce(() => new Promise(() => {}));
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    const checkPromise = mod.checkUpdate(false);
    // Advance past the 10s timeout.
    await vi.advanceTimersByTimeAsync(10_500);
    await checkPromise;
    expect(sendStub).not.toHaveBeenCalledWith('update:error', expect.anything());
  });
});

describe('downloadUpdate', () => {
  it('(11) calls autoUpdater.downloadUpdate', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.downloadUpdate();
    expect(autoUpdaterStub.downloadUpdate).toHaveBeenCalledTimes(1);
  });
});

describe('quitAndInstallUpdate (Pattern H setTimeout(0) deferral)', () => {
  it('(12) defers quitAndInstall(false, true) via setTimeout(0)', async () => {
    vi.useFakeTimers();
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    mod.quitAndInstallUpdate();
    expect(autoUpdaterStub.quitAndInstall).not.toHaveBeenCalled(); // synchronous return
    await vi.advanceTimersByTimeAsync(0);
    expect(autoUpdaterStub.quitAndInstall).toHaveBeenCalledWith(false, true);
  });
});

describe('dismissUpdate', () => {
  it('(13) calls setDismissedVersion(version)', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.dismissUpdate('1.2.3');
    expect(setDismissedVersionMock).toHaveBeenCalledWith('1.2.3');
  });
});

describe('extractSummary parsing (D-09)', () => {
  it('(14a) string with ## Summary section returns summary content', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', {
      version: '1.0.0',
      releaseNotes: '## Summary\nLine 1\nLine 2\n## Other\nignored',
    });
    expect(sendStub).toHaveBeenCalledWith(
      'update:available',
      expect.objectContaining({ summary: 'Line 1\nLine 2' }),
    );
  });

  it('(14b) HTML-tagged content is stripped to plain text', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', {
      version: '1.0.0',
      releaseNotes: '<p>Foo</p>',
    });
    expect(sendStub).toHaveBeenCalledWith(
      'update:available',
      expect.objectContaining({ summary: 'Foo' }),
    );
  });

  it('(14c) null releaseNotes → empty summary', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.0.0', releaseNotes: null });
    expect(sendStub).toHaveBeenCalledWith(
      'update:available',
      expect.objectContaining({ summary: '' }),
    );
  });

  it('(14d) array form joins notes', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', {
      version: '1.0.0',
      releaseNotes: [{ version: '1.0.0', note: '## Summary\nArray-form note' }],
    });
    expect(sendStub).toHaveBeenCalledWith(
      'update:available',
      expect.objectContaining({ summary: 'Array-form note' }),
    );
  });
});

// ============================================================================
// Phase 14 Plan 01 — additions for D-03 sticky slot, D-05 asymmetric dismissal,
// D-08 trigger threading. The pre-existing Phase 12 describe blocks above stay
// green (the startup path is preserved verbatim); these new blocks cover the
// new surface area.
// ============================================================================

describe('Phase 14 D-03 — sticky pendingUpdateInfo slot', () => {
  it('(14-1) getPendingUpdateInfo() returns null after init when no update-available has fired', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    expect(mod.getPendingUpdateInfo()).toBeNull();
  });

  it('(14-2) getPendingUpdateInfo() returns the payload after update-available fires', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', {
      version: '1.2.3',
      releaseNotes: '## Summary\nFix bug.',
    });
    const slot = mod.getPendingUpdateInfo();
    expect(slot).not.toBeNull();
    expect(slot).toEqual(
      expect.objectContaining({
        version: '1.2.3',
        summary: 'Fix bug.',
        fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
      }),
    );
  });

  it('(14-3) latest update-available wins (slot overwrites on newer version)', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    await fireEvent('update-available', { version: '1.2.4', releaseNotes: '' });
    expect(mod.getPendingUpdateInfo()?.version).toBe('1.2.4');
  });

  it('(14-4) clearPendingUpdateInfo() empties the slot', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(mod.getPendingUpdateInfo()).not.toBeNull();
    mod.clearPendingUpdateInfo();
    expect(mod.getPendingUpdateInfo()).toBeNull();
  });

  it('(14-8) sticky slot is NOT written when startup-check suppression fires', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1,
      dismissedUpdateVersion: '1.2.3',
      spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    // Prime trigger context to 'startup' (the default for the 3.5s timer path)
    // by calling checkUpdate(false) before the simulated event fires.
    await mod.checkUpdate(false);
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(mod.getPendingUpdateInfo()).toBeNull();
  });
});

describe('Phase 14 D-05 — asymmetric dismissal (manual ALWAYS re-presents)', () => {
  it('(14-5) manual check + dismissed === available → IPC IS sent (override)', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1,
      dismissedUpdateVersion: '1.2.3',
      spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(true); // manual
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).toHaveBeenCalledWith(
      'update:available',
      expect.objectContaining({ version: '1.2.3' }),
    );
  });

  it('(14-6) startup check + dismissed === available → IPC NOT sent (Phase 12 D-08 preserved)', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1,
      dismissedUpdateVersion: '1.2.3',
      spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(false); // startup
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).not.toHaveBeenCalledWith(
      'update:available',
      expect.anything(),
    );
  });

  it('(14-7) startup check + dismissed < available → IPC IS sent (strict-> preserved)', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1,
      dismissedUpdateVersion: '1.2.3',
      spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(false); // startup
    await fireEvent('update-available', { version: '1.2.4', releaseNotes: '' });
    expect(sendStub).toHaveBeenCalledWith(
      'update:available',
      expect.objectContaining({ version: '1.2.4' }),
    );
  });
});
