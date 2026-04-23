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
import { app, BrowserWindow } from 'electron';
import { join } from 'node:path';
import { registerIpcHandlers } from './ipc.js';

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      // electron-vite emits ESM preload as `index.mjs` (required for Electron
      // ESM loader since package.json has `"type": "module"`). Plan 01-02's
      // initial `index.js` reference never resolved at build; fixed in 01-03.
      preload: join(__dirname, '../preload/index.mjs'),
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
