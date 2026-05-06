/**
 * Phase 1 Plan 02 — Electron main-process entry.
 *
 * Responsibilities:
 *   - App lifecycle (`app.whenReady`, `window-all-closed`).
 *   - BrowserWindow creation with pinned security webPreferences (D-06,
 *     T-01-02-03): contextIsolation: true, nodeIntegration: false,
 *     sandbox: true. These are Electron 2024+ defaults, but we pin them
 *     explicitly so a future regression surfaces in code review.
 *   - HMR branch: loads `process.env.ELECTRON_RENDERER_URL` in dev (set by
 *     `electron-vite dev`), falls back to `out/renderer/index.html` in
 *     packaged builds (Pitfall 7).
 *   - DevTools only when NOT packaged — canonical Electron pattern.
 *   - IPC handler registration via `registerIpcHandlers()`.
 *
 * Cross-platform (D-23, D-27): no platform-branching; no macOS-only chrome
 * options on the BrowserWindow (hidden-inset title bar, traffic-light
 * positioning, blur/vibrancy, visual-effect tuning) are set — the window
 * uses the default OS frame. Adding a Windows `.exe` target is a Phase 9
 * config-only diff per CONTEXT.md §<portability>. Layer-3 arch test greps
 * this file for the exact token literals; see tests/arch.spec.ts.
 *
 * Layer-3 boundary test (`tests/arch.spec.ts`) greps this file for platform
 * anti-patterns; keep the grep happy.
 */
import { app, BrowserWindow, protocol, ipcMain, Menu, type MenuItemConstructorOptions } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { registerIpcHandlers } from './ipc.js';
import { loadRecent, clearRecent } from './recent.js';
// Phase 12 Plan 01 Task 5 — auto-update boot wiring (UPD-01, D-06).
// initAutoUpdater binds events, configures autoDownload=false /
// autoInstallOnAppQuit=false / allowPrerelease=true, and schedules the
// 3.5s startup check from inside the function body. Called after applyMenu
// so the menu is up by the time the first 'update:available' could fire.
import { initAutoUpdater } from './auto-update.js';

// Phase 8 — Pitfall 1 re-entry guard for the before-quit dirty-guard flow.
// Set to true once the renderer has confirmed quit is OK; the before-quit
// handler returns early on the second app.quit() invocation so we don't
// re-prompt the user (and don't deadlock the synchronous quit listener).
let isQuitting = false;

/**
 * Phase 8.2 D-181 — module-scope menu state. Updated by ipc.ts's
 * 'menu:notify-state' handler (Plan 03) and consumed by buildAppMenu /
 * applyMenu / project-io.ts (Plan 03 addRecent + menu rebuild).
 *
 * Initial value matches "no project loaded, no modal" — what app.whenReady
 * installs before any renderer event arrives. Plan 03 wires
 * setCurrentMenuState() into the 'menu:notify-state' IPC handler so renderer
 * pushes drive subsequent rebuilds via applyMenu().
 *
 * mainWindowRef tracks the most recent BrowserWindow so the menu's click
 * handlers (which capture mainWindow at template-build time) can route through
 * the latest window even after activate-on-empty re-creates one. Nulled in
 * the 'closed' listener so a stale handle never reaches webContents.send().
 */
export type MenuState = {
  canSave: boolean;
  canSaveAs: boolean;
  /**
   * True iff a project (.json or .stmproj) is loaded — i.e. AppShell is
   * mounted on the `loaded` or `projectLoaded` AppState branch. Drives the
   * File → Reload Project enabled-state. False in idle / loading / error /
   * projectLoadFailed (nothing to reload from disk).
   */
  canReload: boolean;
  modalOpen: boolean;
};

let currentMenuState: MenuState = {
  canSave: false,
  canSaveAs: false,
  canReload: false,
  modalOpen: false,
};

let mainWindowRef: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef;
}
export function getCurrentMenuState(): MenuState {
  return currentMenuState;
}
export function setCurrentMenuState(next: MenuState): void {
  currentMenuState = next;
}

// Phase 7 D-133 amendment (per RESEARCH §Pitfall 1): register the
// app-image:// scheme with privileges that allow:
//   - standard:        URL parsing follows the standard origin rules
//   - secure:          canvas reads aren't tainted (no toDataURL SecurityError;
//                      Phase 7 doesn't call toDataURL, but secure: true future-proofs)
//   - supportFetchAPI: net.fetch resolves protocol URLs in the handler below
//   - stream:          large PNGs stream lazily from disk (no buffering)
// MUST be called at module load time, BEFORE app.whenReady() resolves —
// per Electron docs (electronjs.org/docs/latest/api/protocol). Putting this
// inside whenReady().then(...) silently fails — RESEARCH §Pitfall 1.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-image',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// DIAGNOSTIC ONLY — disable Chromium GPU compositor to test if Windows
// row-streak artifacts are caused by hardware-acceleration sub-pixel
// rasterization. Revert this line once the test confirms or rules out GPU.
app.disableHardwareAcceleration();

// Phase 8 — dirty-guard intercept (D-143). Standard Electron pattern with the
// Pitfall 1 setTimeout deferral on the second quit invocation. Wired EARLY
// (module load time) so the listener catches Cmd+Q before window-all-closed
// fires.
//
// Flow (dual-one-way wiring per RESEARCH §Pitfall 7):
//   1. User triggers quit (Cmd+Q, menu, etc.). Electron fires 'before-quit'.
//   2. Listener calls event.preventDefault() to pause the quit and sends
//      'project:check-dirty-before-quit' to the renderer's first window.
//   3. Renderer mounts SaveQuitDialog (or fast-paths through if not dirty).
//      User picks Save / Don't Save / Cancel.
//   4. Save success or Don't Save → renderer sends 'project:confirm-quit-proceed'.
//      Cancel → renderer does NOT send anything; main stays paused at the
//      preventDefault() above and the app keeps running.
//   5. confirm-quit-proceed listener sets isQuitting=true and re-invokes
//      app.quit() via setTimeout(..., 0) — the load-bearing setTimeout
//      from Pitfall 1 prevents synchronous re-fire of the before-quit handler.
//   6. The re-fired before-quit handler sees isQuitting=true and returns early
//      (without preventDefault), letting the quit propagate to OS exit.
//
// NEVER use ipcMain.handle (invoke) for the renderer→main confirm channel;
// the synchronous before-quit listener cannot await an invoke roundtrip.
app.on('before-quit', (event) => {
  if (isQuitting) return; // re-entry guard — already confirmed; let it through
  event.preventDefault();
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) {
    // No window to ask; let the quit through. setTimeout breaks the
    // synchronous re-fire that would otherwise hit the preventDefault
    // path again (Pitfall 1).
    isQuitting = true;
    setTimeout(() => app.quit(), 0);
    return;
  }
  win.webContents.send('project:check-dirty-before-quit');
});

ipcMain.on('project:confirm-quit-proceed', () => {
  isQuitting = true;
  // Load-bearing setTimeout (Pitfall 1) — defers the second app.quit() to a
  // fresh microtask so the synchronous re-fire of before-quit sees
  // isQuitting === true and returns early, allowing OS exit to propagate.
  setTimeout(() => app.quit(), 0);
});

/**
 * Phase 8.2 — application Menu builder (D-173, D-174, D-185, D-188).
 *
 * Builds the full standard macOS template (App / File / Edit / View /
 * Window / Help) using role:* for non-File menus so cross-platform
 * standard accelerators (Cmd+C/V/A/Z, Cmd+W, Cmd+Q etc.) work without
 * manual wiring.
 *
 * Re-reads recent.json on every rebuild via loadRecent() so the Open
 * Recent submenu always reflects the latest persisted list (D-179
 * click-and-recover semantics — no fs.access at menu-build time).
 *
 * File menu enabled-state computed from MenuState:
 *   - state.modalOpen === true        → all four File items disabled (D-184)
 *   - state.canSave === false         → Save disabled (regardless of modalOpen)
 *   - state.canSaveAs === false       → Save As disabled
 *   - Open / Open Recent always enabled when modalOpen === false (D-187)
 *     so Cmd+O fires in idle/error/projectLoadFailed AppState — the
 *     entire 08.1 UAT bug fix.
 *
 * Click handlers fire one-way IPC into the renderer via
 * mainWindow.webContents.send (D-175); App.tsx subscribes via
 * window.api.onMenuOpen / onMenuOpenRecent / onMenuSave / onMenuSaveAs
 * (Plan 04). The renderer then routes through its existing dirty-guard
 * and openProject() / saveProject() / saveProjectAs() flows.
 *
 * Optional-chain on mainWindow inside every click handler is mandatory —
 * when the window is closed (mainWindowRef === null), the click is a
 * silent no-op rather than a TypeError. T-08.2-02-01 mitigation.
 */
export async function buildAppMenu(
  state: MenuState,
  mainWindow: BrowserWindow | null,
): Promise<Menu> {
  const recent = await loadRecent();
  const fileDisabled = state.modalOpen;

  const recentSubmenu: MenuItemConstructorOptions[] =
    recent.length === 0
      ? [{ label: '(No recent projects)', enabled: false }]
      : recent.map((p) => ({
          label: p.split(/[\\/]/).pop() ?? p,
          toolTip: p, // Discretion: full absolute path on hover
          enabled: !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:open-recent-clicked', p),
        }));
  recentSubmenu.push({ type: 'separator' });
  recentSubmenu.push({
    label: 'Clear Menu',
    enabled: recent.length > 0,
    click: async () => {
      await clearRecent();
      // Re-apply so the now-empty submenu paints — re-reads recent.json.
      void applyMenu(currentMenuState, mainWindowRef);
    },
  });

  const template: MenuItemConstructorOptions[] = [
    { role: 'appMenu' },
    {
      label: 'File',
      submenu: [
        {
          label: 'Open…',
          accelerator: 'CmdOrCtrl+O',
          enabled: !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:open-clicked'),
        },
        { label: 'Open Recent', submenu: recentSubmenu },
        { type: 'separator' },
        // Reload Project — re-reads JSON + atlas + PNGs from disk so the user
        // can pick up changes re-exported from Spine without losing per-
        // attachment overrides. Overrides whose attachments no longer exist
        // surface in the existing stale-override alert.
        //
        // CmdOrCtrl+R intentionally shadows Electron's default View → Reload
        // (which page-reloads the renderer and clears all in-memory project
        // state — misleading for end users). The custom view menu below
        // preserves CmdOrCtrl+Shift+R as a dev escape hatch.
        {
          label: 'Reload Project',
          accelerator: 'CmdOrCtrl+R',
          enabled: state.canReload && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:reload-clicked'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          enabled: state.canSave && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:save-clicked'),
        },
        {
          label: 'Save As…',
          accelerator: 'CmdOrCtrl+Shift+S',
          enabled: state.canSaveAs && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:save-as-clicked'),
        },
        { type: 'separator' },
        // Export… — opens the OptimizeDialog (same surface the toolbar
        // "Optimize Assets" button drives). Gated on canReload because the
        // precondition is identical: a project must be loaded. The toolbar
        // button additionally disables when peaks.length === 0 OR the
        // export is in flight; we don't replicate those here because (a)
        // peaks.length === 0 is a degenerate case that opens an empty
        // dialog rather than doing damage, and (b) exportInFlight implies
        // OptimizeDialog is mounted, so modalOpen is already true.
        {
          label: 'Export…',
          accelerator: 'CmdOrCtrl+E',
          enabled: state.canReload && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:export-clicked'),
        },
        {
          // Copy the on-screen peak table to the clipboard as TSV (one row
          // per attachment-peak). Useful for handoff to spreadsheets without
          // running a full Export. Same canReload gating as Export.
          label: 'Copy Peak Table',
          enabled: state.canReload && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:copy-peak-table-clicked'),
        },
        { type: 'separator' },
        {
          // Reveal the loaded skeleton JSON in the OS file browser
          // (Finder on macOS, File Explorer on Windows, Files on Linux).
          // Cross-platform via shell.showItemInFolder under the hood.
          label: 'Show in Folder',
          enabled: state.canReload && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:show-in-folder-clicked'),
        },
        { type: 'separator' },
        {
          // Close the loaded project — returns the AppState to idle
          // (empty drop zone). Distinct from the OS-level "Close Window"
          // role:'close' below, which closes the BrowserWindow itself
          // (and on this single-window app, triggers app.quit via
          // window-all-closed). Cmd+W stays bound to window close;
          // Cmd+Shift+W is the project-close shortcut.
          //
          // Dirty-guard: if the session is dirty, the SaveQuitDialog with
          // reason 'close' prompts Save / Don't Save / Cancel before
          // proceeding (parity with quit + reload flows).
          label: 'Close Project',
          accelerator: 'CmdOrCtrl+Shift+W',
          enabled: state.canReload && !fileDisabled,
          click: () => mainWindow?.webContents.send('menu:close-project-clicked'),
        },
        { role: 'close' },
      ],
    },
    // Phase 9 Plan 05 — replaces { role: 'editMenu' } with a custom Edit
    // submenu (RESEARCH §Q6 + 08.2 D-188). Standard Edit roles preserved so
    // cross-platform accelerators (Cmd/Ctrl+Z/Y/X/C/V/A) keep working
    // automatically; Preferences… is appended after a separator so it sits
    // at the bottom per the macOS HIG App-menu convention extended to
    // Edit-menu placement on Win/Linux. Accelerator CommandOrControl+,
    // works cross-platform without branching (Cmd+, on macOS, Ctrl+, on
    // Win/Linux — matches VSCode / modern editor convention).
    //
    // Preferences is unconditionally enabled (T-09-05-MENU-01): even in the
    // empty/error AppState the user can inspect samplingHz (default 120 per
    // CLAUDE.md fact #6). Mirrors File→Open's D-187 unconditional enable.
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        // pasteAndMatchStyle removed: it's a Cocoa rich-text role that strips
        // formatting on paste. This app's only inputs are settings fields and
        // override numbers — no formatting to strip, the role is dead weight.
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'CommandOrControl+,',
          click: () => mainWindow?.webContents.send('menu:settings-clicked'),
        },
      ],
    },
    // Custom View menu — replaces { role: 'viewMenu' } so we can drop the
    // default CmdOrCtrl+R "Reload" item (it page-reloads the renderer and
    // wipes the loaded project, which is misleading). File → Reload Project
    // claims CmdOrCtrl+R.
    //
    // forceReload + toggleDevTools are dev-only (gated on !app.isPackaged):
    //   - forceReload (CmdOrCtrl+Shift+R) is a dev HMR escape hatch; in
    //     packaged builds end users have no reason to page-reload the
    //     renderer and would just lose project state.
    //   - DevTools should not be exposed to end users (parity with the
    //     auto-open DevTools gate near createWindow).
    // Pattern mirrors the existing app.isPackaged check at createWindow's
    // ready-to-show handler — single conditional, no platform branching.
    {
      label: 'View',
      submenu: [
        ...(app.isPackaged
          ? []
          : ([
              { role: 'forceReload' },
              { role: 'toggleDevTools' },
              { type: 'separator' },
            ] as MenuItemConstructorOptions[])),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
    // Phase 9 Plan 05 — fills the 08.2 D-188 placeholder. role:'help' MUST
    // be preserved (Pitfall 8: Electron's MenuItemConstructorOptions
    // validation throws "Invalid template for MenuItem: must have submenu
    // type with role help" without role + non-empty submenu). The
    // Documentation item is unconditionally enabled (T-09-05-MENU-02): Help
    // is always available regardless of AppState. macOS Help-menu search
    // integration comes free with role:'help' — no extra wiring needed.
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => mainWindow?.webContents.send('menu:help-clicked'),
        },
        // Phase 12 Plan 01 Task 5 — Help → Check for Updates… (UPD-02 / D-07).
        // Unconditionally enabled (Pattern G + T-09-05-MENU-02 — Help items
        // are always available regardless of AppState). No accelerator
        // (CONTEXT.md Claude's Discretion: macOS standard is no accelerator
        // on Help-menu items; cross-platform consistency keeps the convention
        // on Windows/Linux too). Optional-chain on mainWindow per
        // T-08.2-02-01 (closed-window null-safety; renderer subscribes via
        // window.api.onMenuCheckForUpdates and invokes
        // window.api.checkForUpdates() when it fires). Plan 12-06 will add
        // the sibling "Installation Guide…" item; not this plan.
        {
          label: 'Check for Updates…',
          click: () => mainWindow?.webContents.send('menu:check-for-updates-clicked'),
        },
        // Phase 12 Plan 06 Task 4 — Help → Installation Guide… (D-16.3).
        // Unconditionally enabled (Pattern G + T-09-05-MENU-02 — Help items
        // are always available regardless of AppState). No accelerator.
        // Optional-chain on mainWindow per T-08.2-02-01 (closed-window
        // null-safety; renderer subscribes via window.api.onMenuInstallationGuide
        // and calls window.api.openExternalUrl(INSTALL_DOC_URL) when it
        // fires — URL routes through SHELL_OPEN_EXTERNAL_ALLOWED allow-list).
        {
          label: 'Installation Guide…',
          click: () => mainWindow?.webContents.send('menu:installation-guide-clicked'),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

export async function applyMenu(
  state: MenuState,
  mainWindow: BrowserWindow | null,
): Promise<void> {
  const menu = await buildAppMenu(state, mainWindow);
  Menu.setApplicationMenu(menu);
}

// Phase 9 polish drop-in scaffold (D-140 §Out of Scope). The macOS file
// association registration itself (Info.plist via electron-builder) is Phase 9;
// this listener is wired now so the registration drop-in is config-only.
// On macOS, when the user double-clicks a .stmproj file in Finder, Electron
// fires 'open-file' BEFORE the window is ready; we forward the path to the
// renderer's first window. If the app launched via the file double-click
// (no window yet), the path arrives before createWindow resolves — Phase 9
// will add stash logic for that race.
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('project:open-from-os', filePath);
});

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      // Preload is emitted as CJS (`.cjs`) per electron.vite.config.ts. Sandbox
      // mode (pinned below) requires a CommonJS preload; an ESM preload under
      // sandbox fails silently, leaving `window.api` undefined in the renderer.
      // Plan 01-03's earlier `.mjs` reference compiled but did not execute
      // under sandbox — caught at Plan 01-05 human-verify, corrected here.
      preload: join(__dirname, '../preload/index.cjs'),
      // D-06 / T-01-02-03: pin explicitly. All three are Electron 2024+ defaults
      // but making them explicit lets code review catch a regression.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Defensive belt-and-braces for Windows menu-bar visibility. autoHideMenuBar
  // above is the documented knob, but on some Windows configurations the menu
  // bar can still come up hidden (and Alt-press becomes the only way to reveal
  // it — confusing for first-time users). setMenuBarVisibility(true) is the
  // explicit force-show call; safe no-op on macOS where the menu bar lives at
  // the top of the screen and isn't owned by the BrowserWindow. No platform
  // branching (D-23): single unconditional call works on every OS.
  mainWindow.setMenuBarVisibility(true);

  // Phase 8.2 — track the active window so menu click handlers can route
  // mainWindow.webContents.send(...). Null on close so a stale handle never
  // reaches the renderer (T-08.2-02-01 mitigation). Identity check guards
  // against a future race where a second window opens before the first
  // window's 'closed' fires.
  mainWindowRef = mainWindow;
  mainWindow.on('closed', () => {
    if (mainWindowRef === mainWindow) {
      mainWindowRef = null;
    }
  });

  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    // DevTools in dev only — never leak internals to packaged users.
    if (!app.isPackaged) {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });

  // HMR branch (Pitfall 7): dev loads Vite URL, prod loads bundled file.
  // The env var is populated by `electron-vite dev`; packaged apps never see it.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

/**
 * Convert an `app-image://localhost/<pathname>` URL back to a platform-correct
 * filesystem path. Inverse of the `pathToFileURL` call in
 * `src/main/ipc.ts:atlas:resolve-image-url`.
 *
 * Exported for unit-testability — see `tests/main/protocol-handler.spec.ts`
 * (debug/windows-atlas-images-404 regression).
 *
 * Implementation note: `fileURLToPath` only accepts `file:` URLs, so we rewrite
 * the scheme on the fly. The path/host/query are otherwise identical between
 * `app-image://localhost/...` and `file://localhost/...`.
 *
 * Round-trips:
 *   POSIX   `/Users/leo/x.png`        → `app-image://localhost/Users/leo/x.png`
 *           → `/Users/leo/x.png` ✓
 *   Windows `C:\\Users\\Tester\\x.png` → `app-image://localhost/C:/Users/Tester/x.png`
 *           → `C:\\Users\\Tester\\x.png` ✓ (on Windows runtime)
 */
export function appImageUrlToPath(appImageUrl: string): string {
  const fileUrl = appImageUrl.replace(/^app-image:/, 'file:');
  return fileURLToPath(fileUrl);
}

app.whenReady().then(() => {
  // Phase 13 — Windows About-panel SemVer fix (carry-forward from 12.1
  // Anti-Pattern #4). Without this, the Windows About dialog reads the
  // win32 FileVersion 4-component padded form (`1.1.1.0`) instead of the
  // SemVer string (`1.1.1`). app.getVersion() reads from package.json at
  // runtime so this stays in sync with the version field automatically.
  // No-op on Windows for fields macOS doesn't support and vice versa, so
  // a single unconditional call configures both platforms (D-06: no
  // platform-conditional branching).
  app.setAboutPanelOptions({
    applicationName: 'Spine Texture Manager',
    applicationVersion: app.getVersion(),
  });

  // Phase 7 D-133 amendment: register the app-image:// protocol handler.
  // Renderer constructs URLs as `app-image://<absolutePath>` (the path
  // already starts with '/' on macOS — encodeURI in the renderer to handle
  // spaces / unicode in file names). net.fetch resolves the file via the
  // standard fetch pipeline (streams bytes from disk; no IPC roundtrip per
  // region). Trust boundary: the loader's sibling-path validation (Phase 1
  // D-09 + Phase 6 D-122) — every PNG path the renderer constructs an
  // app-image:// URL for was previously validated by loadSkeleton + Phase 5
  // findUnusedAttachments. Defense-in-depth path-prefix allow-list is a
  // future polish (RESEARCH §Security Domain V5 row).
  protocol.handle('app-image', async (request) => {
    // debug/windows-atlas-images-404 (2026-04-28):
    //   `decodeURIComponent(new URL(request.url).pathname)` returned a
    //   POSIX-shaped string on every platform — fine on macOS where the
    //   pathname IS the disk path (`/Users/leo/...`), but broken on
    //   Windows where pathToFileURL('C:\\...').pathname is `/C:/...`
    //   and `fs.readFile('/C:/Users/...')` fails ENOENT (the leading `/`
    //   in front of the drive letter is not a valid Windows fs path).
    //   The empty catch swallowed the ENOENT and returned 404, hiding
    //   the bug. `fileURLToPath` is the cross-platform-correct inverse
    //   of `pathToFileURL`: it strips the leading `/` and replaces `/`
    //   with `\\` on Windows, leaves POSIX paths verbatim on macOS/Linux.
    //   `app-image:` is not a `file:` scheme, so we rewrite it before
    //   calling `fileURLToPath` (which only accepts `file:`).
    const filePath = appImageUrlToPath(request.url);
    try {
      const data = await readFile(filePath);
      const ext = filePath.toLowerCase().split('.').pop() ?? '';
      const contentType =
        ext === 'png' ? 'image/png' :
        ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
        'application/octet-stream';
      return new Response(data, { headers: { 'content-type': contentType } });
    } catch {
      return new Response(null, { status: 404 });
    }
  });

  registerIpcHandlers();
  createWindow();

  // Phase 8.2 — install initial menu (no project loaded, modal-free).
  // Async-but-fire-and-forget — the menu paints once loadRecent resolves;
  // main can boot the window in parallel. Plan 03's 'menu:notify-state' IPC
  // handler will rebuild + reapply once the renderer pushes updated state.
  void applyMenu(currentMenuState, mainWindowRef);

  // Phase 12 Plan 01 Task 5 — auto-update startup wiring (UPD-01 / D-06).
  // initAutoUpdater binds the four electron-updater event listeners
  // (update-available / update-not-available / update-downloaded / error),
  // configures autoDownload=false (UPD-03 opt-in), autoInstallOnAppQuit=false,
  // allowPrerelease=true (rc tags subscribe to themselves), and schedules
  // the 3.5s startup check via setTimeout INSIDE its own body. silent-swallow
  // on error/timeout per UPD-05.
  initAutoUpdater();

  app.on('activate', () => {
    // macOS convention: re-open a window when dock icon clicked with none open.
    // This callback itself has no platform branching and costs nothing on
    // Windows (where `activate` does not fire).
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Quit the app when the last window closes. This is the cross-platform
  // sensible default (vs. macOS's "stay in dock" behavior which would require
  // platform branching — forbidden by D-23). Users can relaunch from the
  // dock/start menu.
  app.quit();
});
