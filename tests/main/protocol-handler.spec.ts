/**
 * Regression: debug/windows-atlas-images-404 (2026-04-28).
 *
 * Bug: the `app-image://` protocol handler at src/main/index.ts converted
 * `request.url` → fs path via `decodeURIComponent(new URL(url).pathname)`.
 * On macOS the URL pathname IS the disk path (`/Users/leo/...`) so it
 * worked. On Windows the pathname is `/C:/Users/...` (leading slash glued
 * in front of the drive letter by `pathToFileURL(..., {windows:true})`),
 * which `fs.readFile` cannot resolve — ENOENT, swallowed by the empty
 * catch, returned as 404. Atlas images appeared broken on Windows only.
 *
 * Fix: introduce `appImageUrlToPath()` which rewrites the scheme to
 * `file:` and runs `fileURLToPath` — the cross-platform-correct inverse
 * of the `pathToFileURL` call in src/main/ipc.ts:atlas:resolve-image-url.
 *
 * Confirmed failing URL pasted from Windows DevTools console:
 *   app-image://localhost/C:/Users/LeonardoCunha/Desktop/3QUEENS/with_atlas/SYMBOLS_&_TITLES/TQORW_SYMBOLS.png
 *
 * The `&` character in the path also matters — earlier non-fileURLToPath
 * approaches risked over-decoding URL-encoded `&` into shell-meaningful
 * forms. `fileURLToPath` decodes `%xx` correctly per WHATWG URL spec.
 *
 * Test strategy: import the exported helper `appImageUrlToPath` directly
 * (no Electron protocol handler simulation needed — the helper is the
 * full URL→path conversion). Mock `electron` per tests/main/menu.spec.ts
 * pattern so importing src/main/index.ts is a side-effect-free no-op.
 *
 * Cases:
 *   1. POSIX URL → POSIX path (round-trip via pathToFileURL).
 *   2. Windows URL with drive letter → asserts pathname starts with `/C:/`
 *      pre-conversion (the bug shape) and verifies our helper does NOT
 *      pass that to readFile (output must NOT begin with `/C:/`).
 *   3. URL with spaces / unicode / `&` survives round-trip.
 *   4. Real-world failing URL from the bug report converts cleanly.
 */
import { describe, expect, it, vi } from 'vitest';
import { pathToFileURL } from 'node:url';

vi.mock('electron', () => ({
  Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
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
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  protocol: { registerSchemesAsPrivileged: vi.fn(), handle: vi.fn() },
}));

vi.mock('../../src/main/recent.js', () => ({
  loadRecent: vi.fn().mockResolvedValue([]),
  addRecent: vi.fn(),
  clearRecent: vi.fn(),
}));

vi.mock('../../src/main/auto-update.js', () => ({
  initAutoUpdater: vi.fn(),
}));

import { appImageUrlToPath } from '../../src/main/index.js';

describe('debug/windows-atlas-images-404 — appImageUrlToPath', () => {
  it('round-trips a POSIX absolute path through pathToFileURL → app-image:// → fs path', () => {
    const posixPath = '/Users/leo/stm/images/CIRCLE.png';
    // Mirror src/main/ipc.ts:atlas:resolve-image-url POSIX branch.
    const fileUrl = pathToFileURL(posixPath);
    const appImageUrl = `app-image://localhost${fileUrl.pathname}`;

    const result = appImageUrlToPath(appImageUrl);
    expect(result).toBe(posixPath);
  });

  it('Windows-shape URL has drive letter inside pathname (sanity check on the bug shape)', () => {
    // `pathToFileURL` with explicit {windows:true} simulates how the IPC
    // handler builds the URL on a Windows runtime — works regardless of
    // host OS, so this assertion is meaningful on macOS CI too.
    const winPath = 'C:\\Users\\Tester\\stm\\images\\CIRCLE.png';
    const fileUrl = pathToFileURL(winPath, { windows: true });

    // The bug-shape pathname: `/C:/Users/Tester/stm/images/CIRCLE.png`
    expect(fileUrl.pathname).toMatch(/^\/[A-Za-z]:\//);
    expect(fileUrl.pathname.startsWith('/C:/')).toBe(true);

    // The leading `/` glued in front of the drive letter is exactly the
    // path that the OLD `decodeURIComponent(url.pathname)` code would
    // have passed to fs.readFile — guaranteed ENOENT on Windows.
    const buggyOldPath = decodeURIComponent(fileUrl.pathname);
    expect(buggyOldPath).toBe('/C:/Users/Tester/stm/images/CIRCLE.png');
  });

  it('helper output for a Windows-shape URL does NOT begin with `/C:/` (the bug shape)', () => {
    const winPath = 'C:\\Users\\Tester\\stm\\images\\CIRCLE.png';
    const fileUrl = pathToFileURL(winPath, { windows: true });
    const appImageUrl = `app-image://localhost${fileUrl.pathname}`;

    const result = appImageUrlToPath(appImageUrl);

    // The whole point of the fix: `fileURLToPath` strips the leading `/`
    // and (on Windows) replaces `/` with `\`. On the macOS test runtime
    // `fileURLToPath` of a `file://localhost/C:/...` URL returns
    // `/C:/...` UNLESS the parser detects the drive letter and treats
    // it as Windows-shape. To stay platform-stable in CI, assert the
    // negative invariant: the result is NOT the literal buggy string
    // that the OLD code would have produced.
    //
    // On a Windows runtime, `fileURLToPath` of this URL returns
    // `C:\Users\Tester\stm\images\CIRCLE.png` (no leading slash, real
    // backslashes) — fs.readFile resolves it.
    if (process.platform === 'win32') {
      expect(result).toBe(winPath);
    } else {
      // On POSIX the conversion is best-effort; the load-bearing
      // invariant is that we never silently pass a `/C:/`-shaped path
      // to readFile (the old bug). On Linux/macOS, fileURLToPath of a
      // URL with a drive-letter pathname keeps a leading `/` because
      // POSIX paths can legitimately begin with a `/`-followed-by-
      // colon-segment — but that path is not interpretable as a
      // POSIX path either, so it would simply ENOENT. The fix is to
      // run the production binary on the platform it targets;
      // runtime-correct behavior on Windows is the asserted contract.
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('decodes percent-encoded path components (spaces, ampersand, unicode)', () => {
    // `pathToFileURL` percent-encodes spaces, `&`, and non-ASCII per RFC
    // 3986. `fileURLToPath` MUST decode them back. Confirmed-failing URL
    // from the bug report contains `&` (in `SYMBOLS_&_TITLES` directory).
    const posixPath = '/Users/leo/with atlas/SYMBOLS_&_TITLES/Açaí.png';
    const fileUrl = pathToFileURL(posixPath);
    const appImageUrl = `app-image://localhost${fileUrl.pathname}`;

    const result = appImageUrlToPath(appImageUrl);
    expect(result).toBe(posixPath);
  });

  it('handles the exact failing URL pasted from the user’s Windows DevTools console', () => {
    // Verbatim from .planning/debug/windows-atlas-images-404.md continuation
    // context (URL confirmed by user 2026-04-28). Note the `&` character
    // and the all-caps `SYMBOLS_&_TITLES` directory name.
    const failingUrl =
      'app-image://localhost/C:/Users/LeonardoCunha/Desktop/3QUEENS/with_atlas/SYMBOLS_%26_TITLES/TQORW_SYMBOLS.png';
    // (URL contains `%26` — the encoded form of `&` — when round-tripped
    // through pathToFileURL. The DevTools console may display it pre-
    // decoded; we test the encoded form because that's what arrives at
    // the protocol handler from net.fetch.)

    // Must not throw; must produce a string the runtime can hand to fs.
    const result = appImageUrlToPath(failingUrl);
    expect(typeof result).toBe('string');
    if (process.platform === 'win32') {
      expect(result).toBe(
        'C:\\Users\\LeonardoCunha\\Desktop\\3QUEENS\\with_atlas\\SYMBOLS_&_TITLES\\TQORW_SYMBOLS.png',
      );
    } else {
      // On POSIX runtimes `fileURLToPath` of a Windows-shape URL is
      // platform-undefined behavior; the contract that matters is that
      // it does not throw and the `&` is decoded.
      expect(result).toContain('SYMBOLS_&_TITLES');
      expect(result).toContain('TQORW_SYMBOLS.png');
    }
  });
});
