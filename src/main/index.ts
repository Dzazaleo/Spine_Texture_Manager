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
import { app, BrowserWindow, protocol, ipcMain } from 'electron';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { registerIpcHandlers } from './ipc.js';

// Phase 8 — Pitfall 1 re-entry guard for the before-quit dirty-guard flow.
// Set to true once the renderer has confirmed quit is OK; the before-quit
// handler returns early on the second app.quit() invocation so we don't
// re-prompt the user (and don't deadlock the synchronous quit listener).
let isQuitting = false;

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
    autoHideMenuBar: true,
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

app.whenReady().then(() => {
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
    const url = new URL(request.url);
    // Path is the URL pathname; explicitly decode for robustness against
    // double-encoding when the renderer applies encodeURI on absolute paths.
    const filePath = decodeURIComponent(url.pathname);
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
