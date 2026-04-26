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
const { buildFromTemplate, setApplicationMenu, ipcMainOnHandlers } = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn(),
  // Map-backed captor — keys are channel names, values are the handler the
  // module passed to ipcMain.on. Lets us look up 'menu:notify-state' after
  // registerIpcHandlers() without round-tripping through real Electron.
  ipcMainOnHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => void>(),
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
  shell: { showItemInFolder: vi.fn(), openPath: vi.fn() },
  ipcMain: {
    on: vi.fn((channel: string, handler: (evt: unknown, ...args: unknown[]) => void) => {
      ipcMainOnHandlers.set(channel, handler);
    }),
    handle: vi.fn(),
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

// Import AFTER all vi.mock() blocks so module-load side effects (electron's
// app.on, ipcMain.on, protocol.registerSchemesAsPrivileged) hit the mocks.
import { registerIpcHandlers } from '../../src/main/ipc.js';

beforeEach(() => {
  vi.clearAllMocks();
  ipcMainOnHandlers.clear();
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
    // TODO Wave 1: registerIpcHandlers(); expect(ipcMainOnHandlers.has('sampler:cancel')).toBe(true);
    expect(true, 'Wave 1: sampler:cancel registration pending').toBe(false);
  });

  it('sampler:cancel handler invocation does not throw when no worker is in flight', async () => {
    // TODO Wave 1: registerIpcHandlers(); ipcMainOnHandlers.get('sampler:cancel')!({} as unknown);
    expect(true, 'Wave 1: idempotent-cancel contract pending').toBe(false);
  });
});
