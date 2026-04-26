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

describe('menu:notify-state IPC (D-181)', () => {
  it('rebuilds + reapplies menu via Menu.setApplicationMenu on every notify', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('menu:notify-state');
    expect(handler).toBeDefined();

    handler!({} as unknown, { canSave: true, canSaveAs: true, modalOpen: false });
    // Allow the void applyMenu's `await loadRecent()` microtask to flush —
    // applyMenu is fire-and-forget; we wait one tick before asserting.
    await new Promise((r) => setImmediate(r));

    expect(setApplicationMenu).toHaveBeenCalled();
  });

  it('silently rejects malformed payload (T-08.2-03-01 trust-boundary)', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('menu:notify-state');
    expect(handler).toBeDefined();

    // Missing modalOpen field — handler must reject silently.
    handler!({} as unknown, { canSave: true, canSaveAs: true });
    await new Promise((r) => setImmediate(r));
    expect(setApplicationMenu).not.toHaveBeenCalled();

    // Non-boolean canSave field — handler must reject silently.
    handler!({} as unknown, { canSave: 'yes', canSaveAs: true, modalOpen: false });
    await new Promise((r) => setImmediate(r));
    expect(setApplicationMenu).not.toHaveBeenCalled();

    // Non-object payload — handler must reject silently.
    handler!({} as unknown, null);
    await new Promise((r) => setImmediate(r));
    expect(setApplicationMenu).not.toHaveBeenCalled();
  });
});
