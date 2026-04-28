---
slug: windows-atlas-images-404
status: resolved
trigger: |
  DATA_START
  on windows, the atlas feature correctly populates the atlas with the rectangles corresponding to each image, but the images do not display. The console shows "Failed to load resource: the server respondedn with a status of 404 (not found) - the errors repeats on each one of the atlas pages
  DATA_END
created: 2026-04-28
updated: 2026-04-28
platform: windows
goal: find_and_fix
---

# Debug: Windows Atlas Images 404

## Symptoms

- **Expected behavior:** When viewing the atlas in the main UI on Windows, each atlas page should render the source images inside their packed rectangles, matching macOS behavior.
- **Actual behavior:** Atlas rectangles populate correctly (geometry/layout is right), but the underlying images do not render. Each atlas page logs `Failed to load resource: the server responded with a status of 404 (not found)` in the DevTools console.
- **Error messages:** `Failed to load resource: the server responded with a status of 404 (not found)` — repeated once per atlas page.
- **Platform scope:** Works on macOS. Fails on Windows only.
- **Location in app:** Atlas preview/viewer in main UI.
- **Timeline:** Tested Windows for the first time yesterday (2026-04-27); error was present from the first run. User believes this feature has never worked correctly on Windows.
- **URL detail:** User has not yet inspected the exact failing URL in DevTools — pending. (Investigator should request the exact URL string as first action — it is the highest-leverage clue.)
- **Reproduction:** Launch the built app on Windows → open the atlas viewer in the main UI → observe broken image tiles and 404 errors in the DevTools console.

## Current Focus

```yaml
hypothesis: |
  The bug is NOT in URL construction (the F1 fix at Phase 12 Plan 03 already
  fixed renderer-side concat). The bug is in the protocol HANDLER at
  src/main/index.ts:394-410. On Windows, the handler receives a URL like
  app-image://localhost/C:/Users/Tester/stm/images/CIRCLE.png. It then does:
    const filePath = decodeURIComponent(url.pathname);
    // → filePath = "/C:/Users/Tester/stm/images/CIRCLE.png"
    const data = await readFile(filePath);
  On Windows, fs.readFile cannot resolve `/C:/Users/...` — the leading slash
  glued in front of the drive letter is not a valid Windows fs path.
  readFile throws ENOENT, the catch block returns a 404 Response, and
  every atlas-page <img> reports "Failed to load resource". On macOS the
  same code works because pathname starts with `/Users/leo/...` which IS
  a valid POSIX absolute path on disk.
test: |
  1. (User) paste the full failing URL from DevTools console — should match
     the shape `app-image://localhost/C:/...` (drive letter in pathname).
  2. (Investigator) confirm src/main/index.ts:398 strips pathname only via
     decodeURIComponent, never via url.fileURLToPath() — this is the bug.
expecting: |
  URL paste shows `app-image://localhost/C:/...` shape (drive letter inside
  the pathname). Confirms the URL is well-formed (renderer fix held); the
  404 originates from the handler's failed readFile of a `/C:/...` path on
  Windows.
next_action: |
  Confirm with user via paste, then patch src/main/index.ts protocol
  handler to use `fileURLToPath(request.url)` instead of
  `decodeURIComponent(new URL(request.url).pathname)`. fileURLToPath
  correctly converts `file:///C:/Users/...` (or `app-image://localhost/C:/...`
  reformatted) to `C:\Users\...` on Windows and `/Users/...` on macOS in
  one call — the cross-platform-correct primitive Node provides for exactly
  this purpose.
reasoning_checkpoint: |
  CONFIRMED 2026-04-28: User pasted exact failing URL from Windows DevTools:
    app-image://localhost/C:/Users/LeonardoCunha/Desktop/3QUEENS/with_atlas/SYMBOLS_&_TITLES/TQORW_SYMBOLS.png
  Shape exactly matches the diagnostic prediction (host=localhost, pathname
  starts with /C:/, drive letter inside pathname, forward-slash separators).
  Confirms: the F1 fix at the renderer/IPC layer is correct; the 404
  originates from src/main/index.ts:394-410's decodeURIComponent(pathname)
  step. Fix applied; 5/5 new regression tests + 37/37 prior F1 tests green;
  full suite 438 passed.
tdd_checkpoint: ""
```

## Investigation Notes

### Initial reasoning

Three classes of cause are consistent with "geometry renders but images 404 on Windows only":

1. **Path-shape bug** — the atlas tile geometry comes from parsed `.atlas` metadata (already in memory, no file I/O needed), but the image `src` URL is constructed by joining a directory with a filename. If that join uses `path.join` and the result is shoved into an `<img src>` without `pathToFileURL` / file URL normalization, Windows backslashes break the URL.

2. **Base-path bug** — the atlas viewer may resolve image paths relative to the renderer's current document URL (`file:///` of the bundled HTML) rather than the user's selected skeleton folder. On macOS the relative resolution may coincidentally land on the right disk location; on Windows (different drive letter, different bundle layout) it cannot.

3. **CSP / protocol bug** — Electron on Windows may block `file://` loads from a packaged renderer if `webSecurity` is on and no custom protocol handler is registered. macOS dev runs may be more lenient.

### Investigation 2026-04-28

Read every code path that touches atlas image src construction and the
protocol handler that serves them.

**Findings:**

- The renderer (`src/renderer/src/modals/AtlasPreviewModal.tsx:143`) uses
  `window.api.pathToImageUrl(absolutePath)` — does NOT do string concat.
  Phase 12 Plan 03 D-19 fixed a previous Windows bug where naive concat
  produced `app-image://localhostC:%5C...` (host became `localhostc`).
  This is the F1 fix and it is in place.

- The preload bridge (`src/preload/index.ts:518`) is a thin
  `ipcRenderer.invoke('atlas:resolve-image-url', absolutePath)` — no
  transformation.

- The IPC handler (`src/main/ipc.ts:734-748`) detects Windows-style paths
  via `/^[A-Za-z]:[\\/]/` and routes through
  `pathToFileURL(absolutePath, { windows: true })`. It returns
  `app-image://localhost${fileUrl.pathname}`. For Windows input
  `C:\Users\Tester\stm\images\CIRCLE.png` this produces
  `app-image://localhost/C:/Users/Tester/stm/images/CIRCLE.png`.
  URL is well-formed — `host='localhost'`, `pathname='/C:/Users/...'`.
  Tested under tests/main/ipc.spec.ts §F1 fix and tests/renderer
  /atlas-preview-modal.spec.tsx §F1 regression.

- **The bug is in the protocol handler at `src/main/index.ts:394-410`:**

  ```ts
  protocol.handle('app-image', async (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);
    // ↑ On Windows: filePath === "/C:/Users/Tester/stm/images/CIRCLE.png"
    //   (leading slash, then literal "C:", then forward-slash separators).
    //   Node's fs.readFile on Windows will throw ENOENT — that path doesn't
    //   resolve to any real file. The catch block returns 404.
    try {
      const data = await readFile(filePath);
      ...
    } catch {
      return new Response(null, { status: 404 });
    }
  });
  ```

  No `fileURLToPath` is used anywhere in the project (verified via grep).
  The comment in the handler ("path already starts with '/' on macOS")
  is correct only for macOS — it does not account for Windows where the
  leading slash makes the path invalid. The empty `catch` swallows the
  ENOENT silently; the only user-visible signal is the 404.

- **Why macOS works:** `pathToFileURL('/Users/leo/...').pathname` is
  `/Users/leo/...` — a valid POSIX absolute path. `readFile` reads it.
  No transformation needed.

- **Why Windows fails:** `pathToFileURL('C:\\Users\\...', {windows: true})
  .pathname` is `/C:/Users/...` — **not** a valid Windows fs path.
  `readFile` rejects with ENOENT. The handler returns 404 for every page.

**Discriminator:** the user's pasted URL from DevTools should match the
shape `app-image://localhost/C:/...`. If it does, the URL was constructed
correctly by the renderer/IPC chain — confirming the failure is in the
handler's `readFile` step. If the URL has any other shape (e.g.
`localhostc`, backslashes, double-encoded colon), the F1 fix has regressed
and we go back to URL-construction analysis.

## Evidence

- timestamp: 2026-04-28T00:00:00Z
  source: src/main/index.ts:394-410
  observation: |
    Protocol handler extracts pathname via `decodeURIComponent(url.pathname)`
    and passes the result to `readFile` directly. No `fileURLToPath` call.
    On Windows, this passes `/C:/Users/...` to readFile, which fails ENOENT.

- timestamp: 2026-04-28T00:00:00Z
  source: src/main/ipc.ts:734-748
  observation: |
    URL construction handler uses `pathToFileURL(absolutePath, {windows: true})`
    when input matches /^[A-Za-z]:[\\/]/. Returns
    `app-image://localhost${fileUrl.pathname}`. Output well-formed and
    test-covered (tests/main/ipc.spec.ts §F1 fix).

- timestamp: 2026-04-28T00:00:00Z
  source: src/renderer/src/modals/AtlasPreviewModal.tsx:143
  observation: |
    Renderer goes through window.api.pathToImageUrl bridge — no inline
    string concat. F1 fix held.

- timestamp: 2026-04-28T00:00:00Z
  source: grep -rn fileURLToPath src/
  observation: |
    Zero matches. Code uses pathToFileURL (correctly) for outbound URL
    construction, but never inverse fileURLToPath for inbound URL → path
    translation in the protocol handler. Asymmetry is the root cause.

- timestamp: 2026-04-28T00:00:00Z
  source: user paste from Windows DevTools console
  observation: |
    DATA_START
    app-image://localhost/C:/Users/LeonardoCunha/Desktop/3QUEENS/with_atlas/SYMBOLS_&_TITLES/TQORW_SYMBOLS.png
    DATA_END
    Confirms the URL is well-formed (host=localhost — F1 fix held). Pathname
    is `/C:/Users/.../TQORW_SYMBOLS.png` — drive letter inside pathname,
    leading slash, forward-slash separators. Matches the diagnostic prediction
    bit-for-bit. The `&` character (in `SYMBOLS_&_TITLES`) is handled
    correctly by `fileURLToPath` via WHATWG URL %26-decoding.

## Eliminated

- **Path-shape bug in renderer URL construction:** the F1 fix already
  routes through main-process `pathToFileURL` with explicit `{windows: true}`
  detection. Tests cover both POSIX and Windows-style inputs.
- **Base-path bug:** absolute paths are passed end-to-end; no relative
  resolution against renderer document URL.
- **CSP / protocol-registration bug:** the `app-image` scheme is registered
  privileged at module load (BEFORE app.whenReady) per Electron docs, with
  `standard:true, secure:true, supportFetchAPI:true, stream:true`. The
  handler is wired inside whenReady. CSP and registration are correct.
  (Also: a registration/CSP failure would manifest as a different error
  — net::ERR_BLOCKED_BY_RESPONSE or net::ERR_UNKNOWN_URL_SCHEME — not a
  generic 404.)

## Resolution

### Root cause

The Electron `app-image://` protocol handler at `src/main/index.ts:394-410`
extracted `url.pathname` and passed it to `fs.readFile` without converting
the URL pathname back to a platform-correct filesystem path. The renderer
side correctly used `pathToFileURL(absolutePath, {windows: true})` to build
URLs, producing pathnames shaped `/C:/Users/.../CIRCLE.png` on Windows
(leading `/`, drive letter, forward-slash separators). On macOS the
pathname IS the disk path (`/Users/leo/...`), so `readFile(pathname)`
worked. On Windows `readFile('/C:/Users/...')` threw ENOENT — the leading
`/` glued in front of the drive letter is not a valid Windows fs path.
The empty `catch` block silently returned a 404 Response, surfacing in
DevTools as "Failed to load resource: 404 (not found)" for every atlas
page image. Confirmed by user-pasted URL on 2026-04-28:
`app-image://localhost/C:/Users/LeonardoCunha/Desktop/3QUEENS/with_atlas/SYMBOLS_&_TITLES/TQORW_SYMBOLS.png`.

The asymmetry was fundamental: the project used `pathToFileURL` correctly
outbound but never the inverse `fileURLToPath` inbound (zero matches in
`grep -rn fileURLToPath src/` before the fix).

### Fix

Introduced an exported helper `appImageUrlToPath(appImageUrl)` in
`src/main/index.ts` that rewrites the URL scheme from `app-image:` to
`file:` and runs `node:url`'s `fileURLToPath`. `fileURLToPath` is the
cross-platform-correct inverse of `pathToFileURL`: on Windows it strips
the leading `/`, replaces `/` with `\`, and decodes `%xx` per WHATWG
URL spec (handles spaces, `&`, unicode); on macOS/Linux it leaves POSIX
paths verbatim. The `protocol.handle('app-image', ...)` callback now
calls `appImageUrlToPath(request.url)` instead of
`decodeURIComponent(new URL(request.url).pathname)`.

### Verification

- `npx vitest run tests/main/protocol-handler.spec.ts` → **5/5 passed**
  (new regression tests covering POSIX round-trip, Windows-shape URL
  shape sanity, helper output for Windows URL, percent-encoded special
  chars including `&`, and the verbatim user-pasted failing URL).
- `npx vitest run tests/main/ipc.spec.ts tests/main/menu.spec.ts
  tests/renderer/atlas-preview-modal.spec.tsx` → **37/37 passed**
  (Phase 12 Plan 03 §F1 fix tests + atlas preview modal F1 regression
  + menu spec — all green; F1 renderer/IPC contract still upheld).
- `npx vitest run` (full suite) → **438 passed / 1 skipped / 1 todo**.
- Runtime verification on Windows: deferred to next packaged Windows
  build (user can re-run the failing repro: launch app on Windows →
  open atlas viewer → confirm images render and DevTools console is
  free of 404s).

### Files changed

- `src/main/index.ts`
  - Added `import { fileURLToPath } from 'node:url';` (line 29).
  - Added exported helper `appImageUrlToPath(appImageUrl: string): string`
    (~line 402) — cross-platform-safe inverse of `pathToFileURL`.
  - Replaced the `decodeURIComponent(url.pathname)` line in the
    `protocol.handle('app-image', ...)` callback with a call to
    `appImageUrlToPath(request.url)`. Inline comment cites this debug
    slug for future archaeologists.
- `tests/main/protocol-handler.spec.ts` (new) — 5 regression cases.

### Specialist hint

`general` (Electron + Node platform-path semantics; not a TypeScript or
React bug). Touched Electron `protocol.handle` API conventions and Node
`node:url` `fileURLToPath`/`pathToFileURL` symmetry.
