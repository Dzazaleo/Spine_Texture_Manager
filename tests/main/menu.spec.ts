/**
 * Phase 8.2 Plan 02 — RED specs for buildAppMenu (D-173, D-174, D-185, D-188).
 *
 * Cases (a)-(g) per CONTEXT §domain test plan:
 *   (a) {canSave:false, canSaveAs:false, modalOpen:false} → File→Open enabled,
 *       File→Save disabled
 *   (b) {canSave:true, canSaveAs:true, modalOpen:false} → Save + Save As enabled
 *   (c) modalOpen:true → Open + Open Recent + Save + Save As all disabled (D-184)
 *   (d) Edit menu uses role:'editMenu' (D-188)
 *   (e) accelerators: Open=CmdOrCtrl+O, Save=CmdOrCtrl+S, Save As=CmdOrCtrl+Shift+S
 *   (f) Open Recent submenu has 10 path items + separator + 'Clear Menu' when
 *       paths.length === 10
 *   (g) empty Open Recent → '(No recent projects)' placeholder + separator +
 *       disabled Clear Menu
 *
 * Mock setup (lift from PATTERNS.md §"tests/main/menu.spec.ts (NEW)" lines 810-833):
 *   - vi.mock('electron') stubs Menu / app / BrowserWindow / ipcMain / protocol
 *     because importing src/main/index.ts runs top-level statements (protocol
 *     scheme registration, app.on('before-quit'), ipcMain.on('project:confirm-quit-proceed'),
 *     app.on('open-file')). Stubbing these makes the import a no-op for tests.
 *   - vi.mock('../../src/main/recent.js') stubs loadRecent + clearRecent so we
 *     can drive case (f) (10 paths) and case (g) (0 paths) deterministically.
 *   - buildFromTemplate.mockImplementation(template => ({ template })) is the
 *     "echo-mock" pattern from ipc-export.spec.ts — gives tests a window onto
 *     the template buildAppMenu passed in, without actually constructing a Menu.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// vi.mock() factories are hoisted to the top of the file BEFORE module-scope
// `const`/`let` declarations resolve — referencing top-level consts directly
// throws "Cannot access 'X' before initialization". vi.hoisted() lets us
// declare the spies in a hoist-safe way so the factory and the test bodies
// share the same vi.fn() references.
const { buildFromTemplate, setApplicationMenu } = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn(),
}));

vi.mock('electron', () => ({
  Menu: { buildFromTemplate, setApplicationMenu },
  app: {
    getPath: vi.fn(() => '/tmp/userData'),
    isPackaged: false,
    on: vi.fn(),
    whenReady: vi.fn(() => ({ then: vi.fn() })),
  },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

// recent.ts is consumed by buildAppMenu — mock its exports so each test can
// drive a specific paths[] without touching the real fs.
vi.mock('../../src/main/recent.js', () => ({
  loadRecent: vi.fn().mockResolvedValue([]),
  clearRecent: vi.fn(),
}));

import { buildAppMenu } from '../../src/main/index.js';

beforeEach(() => {
  vi.clearAllMocks();
  // Echo-mock: every call to Menu.buildFromTemplate returns an object that
  // exposes the template the caller passed in. Tests inspect that template
  // via buildFromTemplate.mock.calls[0][0]. Re-installed on each test so
  // vi.clearAllMocks() doesn't strip the impl.
  buildFromTemplate.mockImplementation((template) => ({ template }));
});

describe('buildAppMenu enabled-state matrix (D-181, D-184, D-187)', () => {
  it('(a) state {canSave:false, canSaveAs:false, modalOpen:false} → File→Open enabled, Save/Save As disabled', async () => {
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const fileMenu = tpl.find((m: { label?: string }) => m.label === 'File').submenu;
    const open = fileMenu.find((i: { label?: string }) => i.label === 'Open…');
    const save = fileMenu.find((i: { label?: string }) => i.label === 'Save');
    const saveAs = fileMenu.find((i: { label?: string }) => i.label === 'Save As…');
    // Open is enabled when modalOpen:false (D-187 — Cmd+O fires in idle/error/projectLoadFailed).
    expect(open.enabled).not.toBe(false);
    // canSave:false disables Save (D-181 — toolbar / menu greyed when nothing to persist).
    expect(save.enabled).toBe(false);
    expect(saveAs.enabled).toBe(false);
  });

  it('(b) state {canSave:true, canSaveAs:true, modalOpen:false} → Save + Save As enabled', async () => {
    await buildAppMenu(
      { canSave: true, canSaveAs: true, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const fileMenu = tpl.find((m: { label?: string }) => m.label === 'File').submenu;
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Save').enabled).toBe(true);
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Save As…').enabled).toBe(true);
  });

  it('(c) modalOpen:true → Open + Open Recent + Save + Save As all disabled', async () => {
    await buildAppMenu(
      { canSave: true, canSaveAs: true, modalOpen: true },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const fileMenu = tpl.find((m: { label?: string }) => m.label === 'File').submenu;
    // D-184: every File item disabled when ANY modal is mounted in the renderer.
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Open…').enabled).toBe(false);
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Save').enabled).toBe(false);
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Save As…').enabled).toBe(false);
    // Open Recent submenu items are also disabled (recentSubmenu items carry
    // enabled: !fileDisabled per the buildAppMenu impl). Drill into the submenu
    // and check the first non-separator item.
    const openRecent = fileMenu.find((i: { label?: string }) => i.label === 'Open Recent');
    // submenu in case (c) is the empty placeholder set since loadRecent
    // defaults to []; the placeholder + Clear Menu are both disabled.
    const placeholder = openRecent.submenu[0];
    expect(placeholder.enabled).toBe(false);
  });

  it('(d) Edit menu uses custom submenu (08.2 had role:editMenu — Phase 9 Plan 05 replaces with Edit submenu containing standard roles + Preferences)', async () => {
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    // Phase 9 Plan 05: replaced { role: 'editMenu' } with a custom Edit submenu.
    // The role:'editMenu' literal is gone; an Edit-labelled menu with a submenu
    // containing the standard Edit roles (undo/redo/cut/copy/paste/etc.) plus
    // a Preferences entry is what now occupies the slot.
    expect(tpl).not.toContainEqual(expect.objectContaining({ role: 'editMenu' }));
    const editMenu = tpl.find((m: { label?: string }) => m.label === 'Edit');
    expect(editMenu).toBeDefined();
    expect(Array.isArray(editMenu.submenu)).toBe(true);
    // Standard roles must still be present so the cross-platform accelerators
    // (Cmd+Z / Cmd+C / Cmd+V / etc.) work — role:'editMenu' provided these
    // automatically; the custom submenu must list them explicitly.
    const submenuRoles = editMenu.submenu
      .map((i: { role?: string }) => i.role)
      .filter((r: string | undefined) => r !== undefined);
    expect(submenuRoles).toContain('undo');
    expect(submenuRoles).toContain('redo');
    expect(submenuRoles).toContain('cut');
    expect(submenuRoles).toContain('copy');
    expect(submenuRoles).toContain('paste');
    expect(submenuRoles).toContain('selectAll');
  });

  it('(e) accelerators: Open=CmdOrCtrl+O, Save=CmdOrCtrl+S, Save As=CmdOrCtrl+Shift+S', async () => {
    await buildAppMenu(
      { canSave: true, canSaveAs: true, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const fileMenu = tpl.find((m: { label?: string }) => m.label === 'File').submenu;
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Open…').accelerator).toBe('CmdOrCtrl+O');
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Save').accelerator).toBe('CmdOrCtrl+S');
    expect(fileMenu.find((i: { label?: string }) => i.label === 'Save As…').accelerator).toBe('CmdOrCtrl+Shift+S');
  });

  it('(f) Open Recent submenu has 10 path items + separator + Clear Menu when paths.length === 10', async () => {
    const recent = await import('../../src/main/recent.js');
    vi.mocked(recent.loadRecent).mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => `/p${i}.stmproj`),
    );
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const recentMenu = tpl
      .find((m: { label?: string }) => m.label === 'File')
      .submenu.find((i: { label?: string }) => i.label === 'Open Recent').submenu;
    // 10 path items + separator + Clear Menu = 12.
    expect(recentMenu.length).toBe(12);
    expect(recentMenu[10].type).toBe('separator');
    expect(recentMenu[11].label).toBe('Clear Menu');
  });

  it('(g) empty Open Recent → placeholder + separator + disabled Clear Menu', async () => {
    const recent = await import('../../src/main/recent.js');
    vi.mocked(recent.loadRecent).mockResolvedValue([]);
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const recentMenu = tpl
      .find((m: { label?: string }) => m.label === 'File')
      .submenu.find((i: { label?: string }) => i.label === 'Open Recent').submenu;
    // First item is the disabled '(No recent projects)' placeholder per Discretion.
    expect(recentMenu[0].enabled).toBe(false);
    // Last item is the disabled Clear Menu (nothing to clear).
    expect(recentMenu[recentMenu.length - 1].label).toBe('Clear Menu');
    expect(recentMenu[recentMenu.length - 1].enabled).toBe(false);
  });
});

/**
 * Phase 9 Plan 05 — Edit menu Preferences (Claude's Discretion + RESEARCH §Q6).
 *
 * Two cases:
 *   (h1) Preferences… item exists in the custom Edit submenu with the
 *        cross-platform accelerator CommandOrControl+,
 *   (h2) Click handler fires mainWindow?.webContents.send('menu:settings-clicked')
 */
describe('Phase 9 Plan 05 — Edit menu Preferences (RESEARCH §Q6 + Claude Discretion)', () => {
  it('(h1) Preferences… item exists in Edit submenu with accelerator CommandOrControl+,', async () => {
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const editMenu = tpl.find((m: { label?: string }) => m.label === 'Edit');
    expect(editMenu).toBeDefined();
    const prefs = editMenu.submenu.find(
      (i: { label?: string }) => i.label === 'Preferences…',
    );
    expect(prefs).toBeDefined();
    expect(prefs.accelerator).toBe('CommandOrControl+,');
  });

  it('(h2) Preferences click fires menu:settings-clicked on the main window webContents', async () => {
    const send = vi.fn();
    const fakeWindow = { webContents: { send } } as unknown as Parameters<
      typeof buildAppMenu
    >[1];
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      fakeWindow,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const editMenu = tpl.find((m: { label?: string }) => m.label === 'Edit');
    const prefs = editMenu.submenu.find(
      (i: { label?: string }) => i.label === 'Preferences…',
    );
    prefs.click();
    expect(send).toHaveBeenCalledWith('menu:settings-clicked');
  });
});

/**
 * Phase 9 Plan 05 — Help menu Documentation (08.2 D-188 placeholder filled).
 *
 * Two cases:
 *   (i1) role:'help' submenu now contains a Documentation item (placeholder
 *        filled, role:'help' preserved per Pitfall 8 — Electron validation
 *        requires role:'help' to have a non-empty submenu).
 *   (i2) Click handler fires mainWindow?.webContents.send('menu:help-clicked')
 */
describe('Phase 9 Plan 05 — Help menu Documentation (08.2 D-188 placeholder fill)', () => {
  it('(i1) Documentation item exists inside role:help submenu', async () => {
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      null,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const helpMenu = tpl.find((m: { role?: string }) => m.role === 'help');
    expect(helpMenu).toBeDefined();
    expect(Array.isArray(helpMenu.submenu)).toBe(true);
    const docs = helpMenu.submenu.find(
      (i: { label?: string }) => i.label === 'Documentation',
    );
    expect(docs).toBeDefined();
  });

  it('(i2) Documentation click fires menu:help-clicked on the main window webContents', async () => {
    const send = vi.fn();
    const fakeWindow = { webContents: { send } } as unknown as Parameters<
      typeof buildAppMenu
    >[1];
    await buildAppMenu(
      { canSave: false, canSaveAs: false, modalOpen: false },
      fakeWindow,
    );
    const tpl = buildFromTemplate.mock.calls[0][0];
    const helpMenu = tpl.find((m: { role?: string }) => m.role === 'help');
    const docs = helpMenu.submenu.find(
      (i: { label?: string }) => i.label === 'Documentation',
    );
    docs.click();
    expect(send).toHaveBeenCalledWith('menu:help-clicked');
  });
});
