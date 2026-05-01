/**
 * Phase 8.2 Plan 03 — RED specs for the 'menu:notify-state' IPC handler (D-181).
 *
 * Two cases per CONTEXT §domain test plan + plan §<acceptance_criteria>:
 *   1. valid payload → handler calls Menu.setApplicationMenu via applyMenu
 *      (mutates currentMenuState then fires void applyMenu(state, getMainWindow())).
 *   2. malformed payload (missing field, non-boolean field) → handler returns
 *      silently; setApplicationMenu is NOT called (T-08.2-03-01 trust-boundary
 *      input check; one-way channel — no envelope returned).
 *
 * Mock setup mirrors tests/main/menu.spec.ts (vi.hoisted spy capture for
 * Menu.buildFromTemplate / Menu.setApplicationMenu; electron + recent stubs to
 * make the registerIpcHandlers import a no-op for module-load side effects)
 * extended with a Map-backed ipcMain.on captor so we can pull out the registered
 * 'menu:notify-state' handler and invoke it directly.
 *
 * vi.hoisted() is mandatory because vi.mock() factories are hoisted ABOVE
 * module-scope `const`/`let` declarations — direct top-level const refs throw
 * "Cannot access X before initialization" (Plan 02 deviation #1 documented
 * this exact failure mode).
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Hoist-safe spy capture (see Plan 02 §Deviations from Plan #1).
const { buildFromTemplate, setApplicationMenu, ipcMainOnHandlers, ipcMainHandleHandlers } = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn(),
  // Map-backed captor — keys are channel names, values are the handler the
  // module passed to ipcMain.on. Lets us look up 'menu:notify-state' after
  // registerIpcHandlers() without round-tripping through real Electron.
  ipcMainOnHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => void>(),
  // Phase 12 Plan 03 — invoke-handler captor (mirrors ipcMainOnHandlers shape)
  // so we can pull out 'atlas:resolve-image-url' after registerIpcHandlers()
  // and exercise it directly without round-tripping through real Electron.
  ipcMainHandleHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => unknown>(),
}));

vi.mock('electron', () => ({
  Menu: { buildFromTemplate, setApplicationMenu },
  app: {
    getPath: vi.fn(() => '/tmp/userData'),
    isPackaged: false,
    on: vi.fn(),
    whenReady: vi.fn(() => ({ then: vi.fn() })),
    quit: vi.fn(),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn(), openExternal: vi.fn() },
  ipcMain: {
    on: vi.fn((channel: string, handler: (evt: unknown, ...args: unknown[]) => void) => {
      ipcMainOnHandlers.set(channel, handler);
    }),
    // Phase 12 Plan 03 — capture invoke handlers in the same Map-backed
    // pattern as ipcMain.on so 'atlas:resolve-image-url' (and any future
    // invoke channel) can be looked up + called directly from specs.
    handle: vi.fn((channel: string, handler: (evt: unknown, ...args: unknown[]) => unknown) => {
      ipcMainHandleHandlers.set(channel, handler);
    }),
  },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

// recent.ts is consumed transitively (buildAppMenu inside applyMenu calls
// loadRecent on every rebuild). Mock to keep the test fully isolated from fs.
vi.mock('../../src/main/recent.js', () => ({
  loadRecent: vi.fn().mockResolvedValue([]),
  addRecent: vi.fn(),
  clearRecent: vi.fn(),
}));

// Phase 9 Plan 02 — sampler-worker-bridge is consumed by ipc.ts for the
// 'sampler:cancel' handler. Mock so getSamplerWorkerHandle returns null
// (no in-flight worker in this test); the cancel handler should be a no-op
// and not throw.
vi.mock('../../src/main/sampler-worker-bridge.js', () => ({
  getSamplerWorkerHandle: vi.fn(() => null),
  runSamplerInWorker: vi.fn(),
}));

// Phase 14 Plan 01 — auto-update.ts is dynamically imported inside the
// 'update:request-pending' (and other update:*) handlers. Stub the surface
// so the handler bodies can be exercised without booting the real
// electron-updater module. getPendingUpdateInfo's return value is controlled
// per-test via getPendingUpdateInfoMock.mockReturnValueOnce(...).
type UpdateAvailablePayloadShape = {
  version: string;
  summary: string;
  variant: 'auto-update' | 'manual-download';
  fullReleaseUrl: string;
};
const getPendingUpdateInfoMock = vi.hoisted(() =>
  vi.fn<() => UpdateAvailablePayloadShape | null>(() => null),
);
vi.mock('../../src/main/auto-update.js', () => ({
  getPendingUpdateInfo: getPendingUpdateInfoMock,
  clearPendingUpdateInfo: vi.fn(),
  checkUpdate: vi.fn().mockResolvedValue(undefined),
  downloadUpdate: vi.fn().mockResolvedValue(undefined),
  dismissUpdate: vi.fn().mockResolvedValue(undefined),
  quitAndInstallUpdate: vi.fn(),
}));

// Phase 21 Plan 02 — mock src/core/loader.js so the MissingImagesDirError
// IPC envelope routing test below can drive handleSkeletonLoad's catch
// branch without needing the (not-yet-implemented) synthetic-atlas
// synthesizer (Plan 04). loadSkeletonMock is a vi.fn so individual tests
// can configure throw-vs-return; default impl is a stub that throws so
// any unintended invocation fails loudly.
const loadSkeletonMock = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('loadSkeleton mock not configured for this test');
  }),
);
vi.mock('../../src/core/loader.js', () => ({
  loadSkeleton: loadSkeletonMock,
  // Re-export createStubTextureLoader and checkSpineVersion as no-ops in
  // case any other consumer pulls them in transitively. Tests in this
  // file do not exercise these surfaces.
  createStubTextureLoader: vi.fn(),
  checkSpineVersion: vi.fn(),
}));

// Import AFTER all vi.mock() blocks so module-load side effects (electron's
// app.on, ipcMain.on, protocol.registerSchemesAsPrivileged) hit the mocks.
import { registerIpcHandlers, handleSkeletonLoad } from '../../src/main/ipc.js';
import { MissingImagesDirError } from '../../src/core/errors.js';

beforeEach(() => {
  vi.clearAllMocks();
  ipcMainOnHandlers.clear();
  ipcMainHandleHandlers.clear();
  // Echo-mock buildFromTemplate so applyMenu's chain resolves to a non-null
  // Menu — we don't assert on the template here; menu.spec.ts already covers
  // the structure.
  buildFromTemplate.mockImplementation((template) => ({ template }));
});

/**
 * Microtask + dynamic-import flush helper.
 *
 * The 'menu:notify-state' handler is async: it (1) awaits a dynamic
 * `import('./index.js')`, (2) calls `setCurrentMenuState(next)`, (3) fires
 * `void applyMenu(next, getMainWindow())` as fire-and-forget. applyMenu
 * itself awaits buildAppMenu → loadRecent before calling Menu.setApplicationMenu.
 *
 * Awaiting the handler's returned promise covers steps 1-3, but the
 * `void applyMenu(...)` is intentionally NOT awaited inside the handler
 * (it is fire-and-forget per D-181), so we then need to flush the queued
 * microtasks and macrotasks to let buildAppMenu / loadRecent / setApplicationMenu
 * complete before the assertion runs. setImmediate fires AFTER all queued
 * microtasks have drained, so two setImmediate ticks gives the inner await
 * chain enough time to traverse: dynamic-import → loadRecent (mocked
 * resolved value) → buildFromTemplate (echo-mock) → setApplicationMenu.
 */
async function flushApplyMenu(): Promise<void> {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

describe('menu:notify-state IPC (D-181)', () => {
  it('rebuilds + reapplies menu via Menu.setApplicationMenu on every notify', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('menu:notify-state');
    expect(handler).toBeDefined();

    // The handler is async (dynamic import inside) — await its returned
    // promise so the void applyMenu() inside has been kicked off, then
    // flush the inner await chain.
    await handler!({} as unknown, { canSave: true, canSaveAs: true, modalOpen: false });
    await flushApplyMenu();

    expect(setApplicationMenu).toHaveBeenCalled();
  });

  it('silently rejects malformed payload (T-08.2-03-01 trust-boundary)', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('menu:notify-state');
    expect(handler).toBeDefined();

    // Missing modalOpen field — handler must reject silently.
    await handler!({} as unknown, { canSave: true, canSaveAs: true });
    await flushApplyMenu();
    expect(setApplicationMenu).not.toHaveBeenCalled();

    // Non-boolean canSave field — handler must reject silently.
    await handler!({} as unknown, { canSave: 'yes', canSaveAs: true, modalOpen: false });
    await flushApplyMenu();
    expect(setApplicationMenu).not.toHaveBeenCalled();

    // Non-object payload — handler must reject silently.
    await handler!({} as unknown, null);
    await flushApplyMenu();
    expect(setApplicationMenu).not.toHaveBeenCalled();
  });
});

// Phase 9 D-194 — sampler:cancel + sampler:progress IPC channels.
//
// 'sampler:cancel' is renderer→main fire-and-forget; main calls
// samplerWorkerHandle?.terminate() (Wave 1 wires the handle).
// 'sampler:progress' is main→renderer fire-and-forget emitted from
// the bridge inside handleProjectOpenFromPath / handleProjectReloadWithSkeleton.
//
// This block ASSERTS the channel registration shape; the actual handler body
// is unit-tested via tests/main/sampler-worker.spec.ts (Wave 1).
//
// Wave 0 RED-by-design: registration of 'sampler:cancel' on ipcMain.on
// happens in Wave 1 inside src/main/ipc.ts. These placeholders flip to
// GREEN when Wave 1 lands the registration.
describe('Phase 9 D-194 — sampler IPC channels', () => {
  it('sampler:cancel handler is registered on ipcMain.on', async () => {
    registerIpcHandlers();
    expect(ipcMainOnHandlers.has('sampler:cancel')).toBe(true);
  });

  it('sampler:cancel handler invocation does not throw when no worker is in flight', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('sampler:cancel');
    expect(handler).toBeDefined();
    // No worker in flight — getSamplerWorkerHandle returns null (mocked) so
    // the handler short-circuits without calling terminate(). Idempotent
    // (T-09-02-IPC-02 DoS-flood mitigation).
    expect(() => handler!({} as unknown)).not.toThrow();
  });
});

/**
 * Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — shell:open-external allow-list.
 *
 * The 'shell:open-external' channel is renderer→main fire-and-forget that
 * routes a URL to shell.openExternal. Critical security control: the URL
 * MUST be validated against a closed allow-list before the shell call
 * (Electron security checklist — arbitrary shell.openExternal(userInput)
 * is a documented sandbox-escape vector).
 *
 * Four cases:
 *   1. handler is registered on ipcMain.on
 *   2. allow-listed URL → shell.openExternal IS called with the URL
 *   3. non-allow-listed URL → shell.openExternal is NOT called (silent reject)
 *   4. non-string / empty payload → shell.openExternal is NOT called
 */
describe('Phase 9 Plan 05 T-09-05-OPEN-EXTERNAL — shell:open-external allow-list', () => {
  it('shell:open-external handler is registered on ipcMain.on', async () => {
    registerIpcHandlers();
    expect(ipcMainOnHandlers.has('shell:open-external')).toBe(true);
  });

  it('allow-listed URL invokes shell.openExternal', async () => {
    const electron = await import('electron');
    const openExternalMock = vi.mocked(electron.shell.openExternal);
    openExternalMock.mockClear();
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('shell:open-external')!;
    handler({} as unknown, 'https://esotericsoftware.com/spine-runtimes');
    expect(openExternalMock).toHaveBeenCalledWith(
      'https://esotericsoftware.com/spine-runtimes',
    );
  });

  it('non-allow-listed URL is silently rejected (defense in depth — T-09-05-OPEN-EXTERNAL)', async () => {
    const electron = await import('electron');
    const openExternalMock = vi.mocked(electron.shell.openExternal);
    openExternalMock.mockClear();
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('shell:open-external')!;
    handler({} as unknown, 'https://evil.example.com/');
    handler({} as unknown, 'http://esotericsoftware.com/spine-runtimes'); // wrong scheme
    handler({} as unknown, 'https://esotericsoftware.com/spine-runtimes/'); // trailing-slash drift
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('non-string / empty payload is silently rejected', async () => {
    const electron = await import('electron');
    const openExternalMock = vi.mocked(electron.shell.openExternal);
    openExternalMock.mockClear();
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('shell:open-external')!;
    handler({} as unknown, 12345);
    handler({} as unknown, null);
    handler({} as unknown, undefined);
    handler({} as unknown, '');
    handler({} as unknown, { url: 'https://esotericsoftware.com/spine-runtimes' });
    expect(openExternalMock).not.toHaveBeenCalled();
  });
});

/**
 * Phase 12 Plan 03 (D-19) — F1 atlas-image URL bridge.
 *
 * The 'atlas:resolve-image-url' invoke channel maps a renderer-supplied
 * absolute filesystem path to an `app-image://localhost/<pathname>` URL via
 * `pathToFileURL().pathname` running in the privileged main process.
 *
 * Renderer cannot do this itself — sandboxed renderers have no `node:url`,
 * and naive string concat (`app-image://localhost${path}`) glues drive
 * letters onto the host on Windows: `'C:\\…'` produces host `localhostc`
 * (lowercased; up to first `:`), which 404s the atlas-preview image fetch.
 * RESEARCH §F1 + 11-WIN-FINDINGS §F1 — `localhostc/` is the smoking gun.
 *
 * Cases:
 *   1. handler is registered on ipcMain.handle
 *   2. POSIX absolute path → returned URL has host='localhost' and pathname='/Users/...'
 *   3. Windows-style path → returned URL has host='localhost' (NOT 'localhostc')
 *      and pathname starts with '/C:/'
 *   4. non-string / empty payload → returns '' (renderer broken-image fallback)
 */
describe('Phase 12 Plan 03 (D-19) — atlas:resolve-image-url F1 fix', () => {
  it('atlas:resolve-image-url handler is registered on ipcMain.handle', async () => {
    registerIpcHandlers();
    expect(ipcMainHandleHandlers.has('atlas:resolve-image-url')).toBe(true);
  });

  // Skip on Windows: pathToFileURL('/Users/...') interprets the leading '/' as
  // drive-relative and prepends the current drive letter, so the round-trip
  // assertion `pathname === '/Users/leo/stm/images/CIRCLE.png'` fails on
  // Windows runners (becomes '/D:/Users/leo/...'). Production correctness for
  // Windows is covered by the adjacent 'Windows-style path' test (which uses
  // an explicit C:\...-shape literal).
  it.skipIf(process.platform === 'win32')('POSIX absolute path resolves to app-image://localhost/<pathname>', async () => {
    registerIpcHandlers();
    const handler = ipcMainHandleHandlers.get('atlas:resolve-image-url')!;
    const result = await handler({} as unknown, '/Users/leo/stm/images/CIRCLE.png');
    expect(typeof result).toBe('string');
    const parsed = new URL(result as string);
    expect(parsed.protocol).toBe('app-image:');
    expect(parsed.host).toBe('localhost');
    expect(parsed.pathname).toBe('/Users/leo/stm/images/CIRCLE.png');
  });

  it('Windows-style path keeps host=localhost and puts drive letter in pathname (F1 regression)', async () => {
    registerIpcHandlers();
    const handler = ipcMainHandleHandlers.get('atlas:resolve-image-url')!;
    const result = await handler(
      {} as unknown,
      'C:\\Users\\Tester\\stm\\images\\CIRCLE.png',
    );
    expect(typeof result).toBe('string');
    const parsed = new URL(result as string);
    // The bug: host became 'localhostc' (drive-letter `C` glued onto 'localhost'
    // up to the first ':'). The fix MUST keep host pinned to 'localhost'.
    expect(parsed.host).toBe('localhost');
    expect(parsed.host).not.toMatch(/localhostc/i);
    // Drive letter must end up in the path, not the host.
    expect(parsed.pathname).toMatch(/^\/C:\//);
  });

  it('non-string / empty payload returns empty string (renderer broken-image fallback)', async () => {
    registerIpcHandlers();
    const handler = ipcMainHandleHandlers.get('atlas:resolve-image-url')!;
    expect(await handler({} as unknown, 12345)).toBe('');
    expect(await handler({} as unknown, null)).toBe('');
    expect(await handler({} as unknown, undefined)).toBe('');
    expect(await handler({} as unknown, '')).toBe('');
    expect(await handler({} as unknown, { path: '/foo' })).toBe('');
  });
});

/**
 * Phase 14 Plan 01 D-03 — `update:request-pending` IPC channel.
 *
 * Late-mount renderer re-delivery channel. Renderer App.tsx invokes once on
 * mount; handler returns the sticky `update-available` payload (overwritten
 * on each newer version; cleared by renderer-driven dismiss/download flows),
 * or null on first launch / no pending update.
 *
 * Cases:
 *   1. handler is registered on ipcMain.handle.
 *   2. handler returns the value of getPendingUpdateInfo() from auto-update.js.
 *   3. existing 4 update:* handlers are still registered (no regression).
 */
describe('Phase 14 Plan 01 D-03 — update:request-pending', () => {
  it('update:request-pending handler is registered on ipcMain.handle', async () => {
    registerIpcHandlers();
    expect(ipcMainHandleHandlers.has('update:request-pending')).toBe(true);
  });

  it('handler returns null when getPendingUpdateInfo() returns null', async () => {
    getPendingUpdateInfoMock.mockReturnValueOnce(null);
    registerIpcHandlers();
    const handler = ipcMainHandleHandlers.get('update:request-pending')!;
    const result = await handler({} as unknown);
    expect(result).toBeNull();
  });

  it('handler returns the payload when getPendingUpdateInfo() returns one', async () => {
    const payload = {
      version: '1.2.3',
      summary: 'Fix bug.',
      variant: 'auto-update' as const,
      fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
    };
    getPendingUpdateInfoMock.mockReturnValueOnce(payload);
    registerIpcHandlers();
    const handler = ipcMainHandleHandlers.get('update:request-pending')!;
    const result = await handler({} as unknown);
    expect(result).toEqual(payload);
  });

  it('existing 4 update channels still register (no regression)', async () => {
    registerIpcHandlers();
    expect(ipcMainHandleHandlers.has('update:check-now')).toBe(true);
    expect(ipcMainHandleHandlers.has('update:download')).toBe(true);
    expect(ipcMainOnHandlers.has('update:dismiss')).toBe(true);
    expect(ipcMainOnHandlers.has('update:quit-and-install')).toBe(true);
  });
});

/**
 * Phase 21 Plan 02 (LOAD-01) — MissingImagesDirError IPC envelope routing.
 *
 * D-10: when the atlas-less synthesizer (Plan 04) cannot find an `images/`
 * folder beside the .json (or finds it but every per-region PNG read fails),
 * it throws MissingImagesDirError. The IPC forwarder in handleSkeletonLoad
 * MUST route this through the typed envelope arm — `kind:
 * 'MissingImagesDirError'` — so the renderer can show a typed error UI.
 *
 * Without the KNOWN_KINDS Set entry the catch-block falls through to the
 * generic `kind: 'Unknown'` arm and the user sees a generic message.
 *
 * T-21-02-03 (spoofing): also asserts the .name discriminator wiring is
 * intact — if the class accidentally sets a different .name, KNOWN_KINDS.has
 * misses and routing degrades silently to 'Unknown'.
 */
describe('Phase 21 Plan 02 (LOAD-01) — MissingImagesDirError IPC envelope routing', () => {
  it('forwards MissingImagesDirError as kind: MissingImagesDirError (not Unknown)', async () => {
    // Drive the catch-branch directly: configure loadSkeleton mock to throw
    // a MissingImagesDirError exactly as the synthesizer (Plan 04) will.
    const err = new MissingImagesDirError(
      '/path/to/images',
      '/path/to/skeleton.json',
      ['MISSING.png'],
    );
    loadSkeletonMock.mockImplementationOnce(() => {
      throw err;
    });

    const resp = await handleSkeletonLoad('/path/to/skeleton.json');
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      // CORE assertion — KNOWN_KINDS Set must include 'MissingImagesDirError'
      // so the routing produces the typed envelope arm; without the wiring
      // this would be 'Unknown'.
      expect(resp.error.kind).toBe('MissingImagesDirError');
      // D-11 message contract — atlas-less mode + missing PNG list surfaced.
      expect(resp.error.message).toContain('Atlas-less mode requires');
      expect(resp.error.message).toContain('MISSING.png');
      // T-01-02-02 — no stack trace leaked through the IPC envelope.
      expect(resp.error.message).not.toContain('at ');
      expect(resp.error.message).not.toContain('.ts:');
    }
  });

  it('routing still produces kind: Unknown for non-typed errors (regression guard)', async () => {
    // Negative case: a vanilla Error (NOT a SpineLoaderError subclass) must
    // still fall through to the generic 'Unknown' arm. Confirms the new
    // KNOWN_KINDS entry did not over-broaden the routing predicate.
    loadSkeletonMock.mockImplementationOnce(() => {
      throw new Error('synthetic non-typed failure');
    });
    const resp = await handleSkeletonLoad('/path/to/skeleton.json');
    expect(resp.ok).toBe(false);
    if (!resp.ok) {
      expect(resp.error.kind).toBe('Unknown');
    }
  });
});
