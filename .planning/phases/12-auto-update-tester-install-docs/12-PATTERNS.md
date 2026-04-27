# Phase 12: Auto-update + tester install docs - Pattern Map

**Mapped:** 2026-04-27
**Files analyzed:** 24 (10 greenfield + 14 modified)
**Analogs found:** 22 / 24 (2 truly novel surfaces — `electron-updater` orchestrator + INSTALL.md greenfield doc)

This phase is a **wiring phase**: every load-bearing primitive already exists in the codebase (modal scaffold, atomic-write JSON store, typed-error envelope, IPC pattern, allow-listed external-URL bridge, menu→IPC bridge, custom-protocol handler). The only truly novel surface is `electron-updater` itself — and even there the *consumption* shape (events → one-way IPC sends) byte-mirrors Phase 6's `export:progress` channel.

---

## File Classification

| File (greenfield = G, modify = M) | Role | Data Flow | Closest Analog | Match Quality |
|-----------------------------------|------|-----------|----------------|---------------|
| `src/main/auto-update.ts` (G) | service / orchestrator | event-driven (electron-updater events → IPC sends) | `src/main/sampler-worker-bridge.ts` (worker events → `sampler:progress` IPC) AND `src/main/ipc.ts:handleStartExport` (`export:progress` send) | role-match (no exact electron-updater analog; pattern-match on the event→IPC translation shape) |
| `src/main/update-state.ts` (G) | persistence service | CRUD (atomic JSON read/write under userData) | `src/main/recent.ts` | **exact** (byte-for-byte template) |
| `src/main/index.ts` (M — boot wire + 2 menu items) | config / app-bootstrap | request-response (Menu click → webContents.send) | `src/main/index.ts:262-274` (Help submenu Documentation item) AND `:225-256` (Edit submenu Preferences item — unconditionally enabled) | **exact** (in-file precedent) |
| `src/main/ipc.ts` (M — 4 update channels + 2 allow-list entries) | IPC controller | request-response + event-driven | `src/main/ipc.ts:592-602` (`shell:open-external` allow-list send) AND `:545-547` (`export:start` invoke) | **exact** (in-file precedent) |
| `src/preload/index.ts` (M — 5 update bridges) | trust-boundary bridge | request-response + event subscription | `src/preload/index.ts:126-132` (`onExportProgress` subscribe) AND `:367-373` (`onMenuHelp` subscribe) AND `:385-387` (`openExternalUrl` send) | **exact** (in-file precedent) |
| `src/renderer/src/modals/UpdateDialog.tsx` (G) | component (modal) | request-response (props in / event out) | `src/renderer/src/modals/HelpDialog.tsx` (scaffold) AND `SaveQuitDialog.tsx` (multi-state buttons) | **exact** (modal scaffold) + role-match (button row + state machine) |
| `src/renderer/src/modals/HelpDialog.tsx` (M — INSTALL.md link section) | component (modal) | request-response | self (existing sections 1–7) | **exact** (in-file precedent) |
| `src/renderer/src/modals/AtlasPreviewModal.tsx:116` (M — F1 fix) | component (modal) | file-I/O (custom protocol) | `node:url` `pathToFileURL()` (stdlib) | role-match (single-line bug fix) |
| `src/main/ipc.ts:handlePickOutputDirectory` + renderer `pickOutputDir` callsite (M — F2 fix) | IPC controller + renderer caller | request-response (dialog) | `src/renderer/src/components/AppShell.tsx:404-415` (the bug site itself) | **exact** (in-file precedent — only the `defaultPath` derivation changes) |
| `src/core/loader.ts` (M — F3 version guard insertion) | service (pure-TS loader) | transform (JSON → SkeletonData + sourceDims) | `src/core/loader.ts:98-104` (existing `SkeletonJsonNotFoundError` throw) | **exact** (in-file precedent — same throw shape) |
| `src/core/errors.ts` (M — new `SpineVersionUnsupportedError` class) | model (typed-error envelope) | data (class definition) | `src/core/errors.ts:20-25` `SkeletonJsonNotFoundError` AND `:27-51` `AtlasNotFoundError` | **exact** (in-file precedent — same `extends SpineLoaderError` shape, same single-field constructor) |
| `src/shared/types.ts` (M — extend `SerializableError` union + `KNOWN_KINDS`) | model (discriminated union) | data | `src/shared/types.ts:518-542` `SerializableError` union | **exact** (in-file precedent — append a kind to the existing list) |
| `tests/main/auto-update.spec.ts` (G) | test | unit (mocked Electron + autoUpdater) | `tests/main/recent.spec.ts` (mocked `app.getPath`) AND `tests/main/menu.spec.ts` (mocked Menu) | role-match |
| `tests/main/update-state.spec.ts` (G) | test | unit (file-system + temp dir) | `tests/main/recent.spec.ts` | **exact** |
| `tests/renderer/update-dialog.spec.tsx` (G) | test | unit (jsdom modal render) | `tests/renderer/help-dialog.spec.tsx` AND `tests/renderer/settings-dialog.spec.tsx` | **exact** |
| `tests/integration/install-md.spec.ts` (G) | test | smoke (file existence + content grep) | (no exact analog — first integration smoke test) | role-match |
| `fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json` (G) + `.atlas` + `images/SQUARE.png` | test fixture | data | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | role-match (same fixture-shape; different content for rejection) |
| `.github/workflows/release.yml` (M — matrix expand + latest*.yml uploads) | config (CI) | event-driven (tag push → matrix build → publish) | self (existing `test` job + `publish` job) | **exact** (in-file precedent) |
| `.github/release-template.md` (M — bullets → single link) | config (release notes template) | data | self | **exact** (in-file precedent) |
| `electron-builder.yml` (M — flip `publish: null` → GitHub provider) | config (build tool) | data | (no analog — config flip per electron-updater docs) | role-match |
| `package.json` (M — add `electron-updater@6.8.3`) | config (dependency manifest) | data | self (`electron-builder` already devDependency) | **exact** |
| `INSTALL.md` (G — repo root) | docs (greenfield) | data | `.github/release-template.md:14-23` (existing inline bullets to be relocated) | role-match (relocate + expand) |
| `docs/install-images/*.png` (G) | docs (committed binary) | data | (no analog — first committed PNG screenshots) | none |
| `README.md` (M — Installing section) | docs | data | self | **exact** (in-file edit) |

---

## Pattern Assignments

### `src/main/auto-update.ts` (G) — service / event-driven

**Analog #1 (event-source → IPC translation):** `src/main/ipc.ts:511` (`evt.sender.send('export:progress', e)` inside `handleStartExport`).

**Analog #2 (typed import + event lifecycle):** `src/main/sampler-worker-bridge.ts` (worker postMessage → main forwards via webContents.send).

**One-way IPC send pattern** (excerpt from `src/main/ipc.ts:507-512`):
```typescript
const summary = await runExport(
  validPlan,
  outDir,
  (e) => {
    // webContents.send may throw if the renderer has gone away
    // mid-export (window closed). Swallow — the export still
    // completes and the summary is returned to whoever is left.
    try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ }
  },
  () => exportCancelFlag,
  overwrite,
);
```

**`getMainWindow()` + null-safe send pattern** (composed from `src/main/index.ts:67-69` + the optional-chain idiom on Menu click handlers `:183`):
```typescript
// src/main/index.ts:65-69
let mainWindowRef: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef;
}
```

**Layer-3 boundary respected:** `src/main/index.ts` already imports `electron` types at module top. `auto-update.ts` does the same — it lives in `src/main/`, never in `src/core/`.

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| `evt.sender.send('export:progress', e)` shape | `src/main/ipc.ts:511` | Wrap `getMainWindow()?.webContents.send(channel, payload)` in try/catch (the `evt.sender` form needs an IPC entry-point; the auto-updater fires events out-of-band). Use `getMainWindow()` + null-safe access. |
| Try/catch around `webContents.send` | `src/main/ipc.ts:511` | Same try/catch (`webContents gone`). |
| Module-level state (`exportInFlight`, `exportCancelFlag` analogs) | `src/main/ipc.ts:106-107` | New: `initialized = false`, `lastCheckedVersion: string \| null = null`. Same single-let-binding pattern. |
| `setTimeout(..., 0)` deferral (for `quitAndInstall` in IPC handler) | `src/main/index.ts:131-137` (`project:confirm-quit-proceed` setTimeout pattern) | `setTimeout(() => autoUpdater.quitAndInstall(false, true), 0)` so the IPC ack returns first — the existing `setTimeout(() => app.quit(), 0)` at line 136 is byte-for-byte the precedent. |

**Anti-patterns (from RESEARCH §Anti-Patterns to Avoid)** — the planner should ensure executor does NOT:
- Call `autoUpdater.checkForUpdatesAndNotify()` (auto-shows native notification — D-05 forbids).
- Set `autoUpdater.autoDownload = true` (bypasses opt-in — UPD-03 requires opt-in).
- Import `electron-updater` from the renderer.
- Call `autoUpdater.quitAndInstall()` synchronously inside an IPC handler.
- Let `checkForUpdates()` rejection bubble unhandled (UPD-05 silent-swallow).

---

### `src/main/update-state.ts` (G) — persistence service / CRUD

**Analog:** `src/main/recent.ts` — the BYTE-FOR-BYTE template per RESEARCH §"Later" Persistence Recommendation.

**Imports + module constants** (lines 32-43):
```typescript
import { readFile, writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { app } from 'electron';

/** v1 on-disk schema. */
export type RecentFileV1 = { version: 1; paths: string[] };

/** Absolute path to the recent.json file inside the per-user Electron data dir. */
const RECENT_PATH = path.join(app.getPath('userData'), 'recent.json');

/** Cap (D-178) — front of the array is newest; oldest entries are dropped on overflow. */
const MAX_RECENT = 10;
```

**Validate-before-load with version-FIRST gating** (lines 54-71):
```typescript
export function validateRecentFile(
  input: unknown,
): { ok: true; file: RecentFileV1 } | { ok: false } {
  if (!input || typeof input !== 'object') return { ok: false };
  const obj = input as Record<string, unknown>;

  // Version FIRST — gate before any other field interpretation (mirrors
  // validateProjectFile lines 96-120; D-151 / D-156 discipline carried
  // forward; per D-177 unknown OR newer versions both load as []).
  if (typeof obj.version !== 'number') return { ok: false };
  if (obj.version !== 1) return { ok: false };

  if (!Array.isArray(obj.paths)) return { ok: false };
  for (const p of obj.paths) {
    if (typeof p !== 'string' || p.length === 0) return { ok: false };
  }
  return { ok: true, file: { version: 1, paths: obj.paths as string[] } };
}
```

**Atomic write** (lines 88-96):
```typescript
async function writeRecentFileAtomic(
  recent: RecentFileV1,
  finalPath: string,
): Promise<void> {
  const json = JSON.stringify(recent, null, 2);
  const tmpPath = finalPath + '.tmp';
  await writeFile(tmpPath, json, 'utf8');
  await rename(tmpPath, finalPath);
}
```

**Silent-swallow load** (lines 108-117):
```typescript
export async function loadRecent(): Promise<string[]> {
  try {
    const text = await readFile(RECENT_PATH, 'utf8');
    const parsed: unknown = JSON.parse(text);
    const v = validateRecentFile(parsed);
    return v.ok ? v.file.paths : [];
  } catch {
    return [];
  }
}
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Imports block | `recent.ts:32-34` | Identical (readFile, writeFile, rename, path, app from electron). |
| Schema type | `recent.ts:37` | `type UpdateStateV1 = { version: 1; dismissedUpdateVersion: string \| null }`. |
| File path constant | `recent.ts:40` | `const UPDATE_STATE_PATH = path.join(app.getPath('userData'), 'update-state.json')`. |
| `validate*File` | `recent.ts:54-71` | Same shape. Replace `paths` array check with `dismissedUpdateVersion: string \| null` check (allow `null` value as valid; reject `undefined` / non-string non-null). |
| `write*FileAtomic` | `recent.ts:88-96` | Identical body, different param + path constant. |
| `load*` silent-swallow | `recent.ts:108-117` | Return `{ version: 1, dismissedUpdateVersion: null }` on any failure. |
| Cap constant `MAX_RECENT` | `recent.ts:43` | OMIT — `dismissedUpdateVersion` is a single value, no cap. |
| `addRecent` push-to-front | `recent.ts:128-134` | Replace with `setDismissedVersion(v: string)` — overwrite single field. |
| `clearRecent` reset | `recent.ts:143-145` | OMIT — no clear surface needed. |

---

### `src/main/index.ts` (M — boot + 2 menu items) — config / app-bootstrap

**Analog (Help submenu existing item):** `src/main/index.ts:266-274`:
```typescript
{
  role: 'help',
  submenu: [
    {
      label: 'Documentation',
      click: () => mainWindow?.webContents.send('menu:help-clicked'),
    },
  ],
},
```

**Analog (unconditionally-enabled menu item — Edit menu Preferences):** `src/main/index.ts:250-254`:
```typescript
{
  label: 'Preferences…',
  accelerator: 'CommandOrControl+,',
  click: () => mainWindow?.webContents.send('menu:settings-clicked'),
},
```

**Analog (boot-time async fire-and-forget after `whenReady`):** `src/main/index.ts:381-388`:
```typescript
registerIpcHandlers();
createWindow();

// Phase 8.2 — install initial menu (no project loaded, modal-free).
// Async-but-fire-and-forget — the menu paints once loadRecent resolves;
// main can boot the window in parallel. Plan 03's 'menu:notify-state' IPC
// handler will rebuild + reapply once the renderer pushes updated state.
void applyMenu(currentMenuState, mainWindowRef);
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Help submenu structure | `index.ts:266-274` | Append two new items inside the same `submenu` array — keep `Documentation` first; add `Check for Updates…` and `Installation Guide…` below. NEVER remove `role: 'help'` (Pitfall 8 — Electron throws without it). |
| Click handler shape | `index.ts:271` | `click: () => mainWindow?.webContents.send('menu:check-for-updates-clicked')` (planner discretion on exact channel name; recommended `menu:check-for-updates` for consistency with `menu:help-clicked`). Optional-chain on `mainWindow` is **mandatory** (T-08.2-02-01). |
| Boot-time deferred init | `index.ts:381-388` (`void applyMenu(...)`) | Add `setTimeout(() => initAutoUpdater(), 3500)` *after* `void applyMenu(...)` inside the `app.whenReady().then(...)` block. Researched delay = `STARTUP_CHECK_DELAY_MS` constant in `auto-update.ts` (3500 ms per RESEARCH §Update Lifecycle). |
| Menu items unconditional-enable | `index.ts:250-254` (Preferences…) | Don't gate on `state.modalOpen` or `state.canSave` — Help-menu items are always-available (T-09-05-MENU-02 from Phase 9 establishes this). |

---

### `src/main/ipc.ts` (M — 4 update channels + 2 allow-list entries) — IPC controller

**Analog (allow-list pattern, exact-string Set.has):** `src/main/ipc.ts:131-138` + `:592-602`:
```typescript
const SHELL_OPEN_EXTERNAL_ALLOWED: ReadonlySet<string> = new Set<string>([
  'https://esotericsoftware.com/spine-runtimes',
  'https://esotericsoftware.com/spine-api-reference',
  'https://en.esotericsoftware.com/spine-json-format',
]);

// ...later in registerIpcHandlers...
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
  try {
    void shell.openExternal(url);
  } catch {
    // shell.openExternal can throw on platforms where the default browser
    // is misconfigured. Silent — one-way channel; nothing to return.
  }
});
```

**Analog (`ipcMain.handle` invoke channels):** `src/main/ipc.ts:545-547`:
```typescript
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite) =>
  handleStartExport(evt, plan, outDir, overwrite === true),
);
```

**Analog (`ipcMain.on` send channels):** `src/main/ipc.ts:548-552`:
```typescript
ipcMain.on('export:cancel', () => {
  // D-115: cooperative cancel. Flag is read on every iteration of the
  // runExport loop between files. In-flight cannot be aborted mid-libvips.
  exportCancelFlag = true;
});
```

**KNOWN_KINDS extension pattern:** `src/main/ipc.ts:90-96`:
```typescript
type KnownErrorKind = Exclude<SerializableError['kind'], 'SkeletonNotFoundOnLoadError'>;

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Add 2 entries to `SHELL_OPEN_EXTERNAL_ALLOWED` | `:131-138` | Append `'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md'` and `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'`. Keep exact-string Set.has (D-18 option (b) — no pattern support). |
| Add `update:check-now` invoke | `:545-547` | `ipcMain.handle('update:check-now', async () => checkUpdate(true))` — re-export `checkUpdate` from `auto-update.ts`. |
| Add `update:download` invoke | `:545-547` | `ipcMain.handle('update:download', async () => downloadUpdate())`. |
| Add `update:dismiss` send | `:548-552` | `ipcMain.on('update:dismiss', (_evt, version) => { if (typeof version === 'string') void dismissUpdate(version); })`. |
| Add `update:quit-and-install` send | `:548-552` | `ipcMain.on('update:quit-and-install', () => quitAndInstallUpdate())`. |
| Extend `KNOWN_KINDS` for F3 | `:90-96` | Append `'SpineVersionUnsupportedError'` to the Set. The forwarder at `handleSkeletonLoad` already routes by `err.name` once the kind is in the Set. |
| Trust-boundary `typeof` checks | `:594` (`if (typeof url !== 'string' || url.length === 0) return;`) | Apply same shape to `update:dismiss` (typeof version === 'string'). |

---

### `src/preload/index.ts` (M — 5 update bridges) — trust-boundary bridge

**Analog (event-subscribe with Pitfall-9 listener-identity preservation):** `src/preload/index.ts:126-132`:
```typescript
onExportProgress: (handler) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
  ipcRenderer.on('export:progress', wrapped);
  return () => {
    ipcRenderer.removeListener('export:progress', wrapped);
  };
},
```

**Analog (menu-event subscribe — same shape):** `src/preload/index.ts:367-373`:
```typescript
onMenuHelp: (cb: () => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
  ipcRenderer.on('menu:help-clicked', wrapped);
  return () => {
    ipcRenderer.removeListener('menu:help-clicked', wrapped);
  };
},
```

**Analog (one-way send):** `src/preload/index.ts:385-387`:
```typescript
openExternalUrl: (url: string): void => {
  ipcRenderer.send('shell:open-external', url);
},
```

**Analog (invoke):** `src/preload/index.ts:158`:
```typescript
openProject: () => ipcRenderer.invoke('project:open'),
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| `onUpdateEvent(handler)` listener-multiplexer | `:126-132` (`onExportProgress`) | Subscribe to four channels (`update:available`, `update:downloaded`, `update:none`, `update:error`); fold them into one handler with a discriminated `{ type: ... }` payload OR expose four separate `onUpdate*` methods (planner discretion — four separate methods byte-mirrors `onMenuOpen` / `onMenuSave` / `onMenuSaveAs` / `onMenuOpenRecent` precedent at `:269-306` and is the recommended shape for symmetry). |
| `checkForUpdates()` invoke | `:158` (`openProject`) | `checkForUpdates: () => ipcRenderer.invoke('update:check-now')`. |
| `downloadUpdate()` invoke | `:158` | `downloadUpdate: () => ipcRenderer.invoke('update:download')`. |
| `dismissUpdate(version)` send | `:385-387` (`openExternalUrl`) | `dismissUpdate: (version: string): void => { ipcRenderer.send('update:dismiss', version); }`. |
| `quitAndInstallUpdate()` send | `:385-387` | `quitAndInstallUpdate: (): void => { ipcRenderer.send('update:quit-and-install'); }`. |
| `onMenuCheckForUpdates(cb)` subscribe | `:367-373` (`onMenuHelp`) | Identical shape; channel name `menu:check-for-updates-clicked` (planner picks; matches `menu:help-clicked` convention). |
| `onMenuInstallationGuide(cb)` subscribe | `:367-373` | Identical shape; channel name `menu:installation-guide-clicked`. The renderer's handler simply calls `window.api.openExternalUrl(INSTALL_MD_URL)`. |
| Pitfall 9 wrapped-const-then-removeListener | every analog at `:127-131` | Mandatory — every `onUpdate*` MUST capture `wrapped` in a const before `ipcRenderer.on` so the unsubscribe targets the same identity. |

---

### `src/renderer/src/modals/UpdateDialog.tsx` (G) — component (modal)

**Analog #1 (modal scaffold — copy verbatim):** `src/renderer/src/modals/HelpDialog.tsx:89-114`:
```tsx
return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="help-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={props.onClose}
  >
    <div
      className="bg-panel border border-border rounded-md p-6 max-w-[700px] max-h-[80vh] overflow-y-auto font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-baseline justify-between mb-4">
        <h2 id="help-title" className="text-base font-semibold text-fg">
          Documentation
        </h2>
        <button
          type="button"
          onClick={props.onClose}
          aria-label="Close help"
          className="border border-border rounded-md px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
        >
          Close
        </button>
      </div>
```

**Analog #1 (focus trap + Escape):** `src/renderer/src/modals/HelpDialog.tsx:72-77`:
```typescript
export function HelpDialog(props: HelpDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // Document-level Escape + Tab cycle via the shared hook (Phase 6 Gap-Fix
  // Round 6). Escape works regardless of where focus has drifted; Tab cycles
  // back to the first tabbable when reaching the last. onEscape closes.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;
```

**Analog #1 (external-link button + curried `openLink`):** `src/renderer/src/modals/HelpDialog.tsx:81-87, 137-144`:
```typescript
const openLink = (url: string) => () => {
  window.api.openExternalUrl(url);
};
// ...
<button
  type="button"
  className="underline text-accent hover:text-fg"
  onClick={openLink(SPINE_JSON_FORMAT_URL)}
>
  Spine JSON format reference
</button>
```

**Analog #2 (multi-button modal with primary/secondary/disabled-during-pending state):** `src/renderer/src/modals/SaveQuitDialog.tsx:100-129`:
```tsx
<div className="flex gap-2 justify-end">
  {/* Save first => useFocusTrap auto-focuses it (first tabbable in
      DOM order). The 'Saving…' state is gated by props.saving — the
      parent (AppShell SaveQuitDialog mount in the 'quit' flow)
      shows it while the saveProject promise is in-flight. */}
  <button
    type="button"
    onClick={props.onSave}
    disabled={props.saving === true}
    className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:opacity-90 active:opacity-80 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {props.saving === true ? 'Saving…' : 'Save'}
  </button>
  <button
    type="button"
    onClick={props.onDontSave}
    disabled={props.saving === true}
    className="border border-border rounded-md px-3 py-1 text-xs transition-colors cursor-pointer hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    Don&apos;t Save
  </button>
```

**Analog (release-notes plain-text container — banned markdown rendering):** Per RESEARCH §UpdateDialog: `<pre className="text-xs text-fg-muted whitespace-pre-wrap">{summary}</pre>` (mirrors HelpDialog `<p className="text-xs text-fg-muted leading-relaxed">` plain-text discipline; NO `dangerouslySetInnerHTML`).

**Module-constant URL pattern:** `src/renderer/src/modals/HelpDialog.tsx:65-70`:
```typescript
// External link URLs — MUST be present in SHELL_OPEN_EXTERNAL_ALLOWED in
// src/main/ipc.ts. If you add a URL here, also add it there. Mismatches
// are silently dropped by the main handler.
const SPINE_RUNTIMES_URL = 'https://esotericsoftware.com/spine-runtimes';
const SPINE_API_REF_URL = 'https://esotericsoftware.com/spine-api-reference';
const SPINE_JSON_FORMAT_URL = 'https://en.esotericsoftware.com/spine-json-format';
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Outer scaffold (`role="dialog"`, `aria-modal`, overlay onClick = onClose, inner stopPropagation) | `HelpDialog.tsx:89-101` | Verbatim. Change `aria-labelledby` → `"update-title"`. |
| `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` | `HelpDialog.tsx:72-77` | Identical. (Note: D-05 specifies "Later" maps to outer-overlay close + Escape, NOT a separate "Cancel" button — the Later button is in the button row.) |
| Button row (3-state machine) | `SaveQuitDialog.tsx:100-129` | State machine: `available` → [Download + Restart] [Later]; `downloading` → [Downloading…] (disabled); `downloaded` → [Restart] [Later]. Primary button mirrors Save's `bg-accent` styling; secondary mirrors Don't Save's `border-border` styling. |
| External-link `openLink` curried handler | `HelpDialog.tsx:81-87` | Single link: "View full release notes" → `openLink(GITHUB_RELEASES_INDEX_URL)`. Add `GITHUB_RELEASES_INDEX_URL` module constant. |
| Module URL constants block | `HelpDialog.tsx:65-70` | Add `const GITHUB_RELEASES_INDEX_URL = 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'`. Comment must reference the SHELL_OPEN_EXTERNAL_ALLOWED parallel. |
| Plain-text release-notes container | (none — first instance) | `<pre className="text-xs text-fg-muted whitespace-pre-wrap">{props.summary}</pre>` (preserves newlines without enabling HTML). Per HelpDialog precedent: NO `react-markdown`, NO `dangerouslySetInnerHTML`. |
| File-comment header (block at top) | `HelpDialog.tsx:1-56` | Same documentation discipline — list ARIA contract, useFocusTrap usage, modal-open menu-suppression inheritance (Phase 8.2 D-184), Layer 3 invariant note (no `core/*` imports). |

---

### `src/renderer/src/modals/HelpDialog.tsx` (M — INSTALL.md link section, D-16.4)

**Analog (in-file precedent):** Existing sections 1–7 use the `<section className="mb-4">` + `<h3>` + `<p>` + curried `openLink(URL)` button pattern.

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Section structure | `HelpDialog.tsx:128-146` (Section 2 with embedded link) | Add a new section (recommended placement: between sections 1 and 2, OR a dedicated section 8 at the bottom — planner picks). Heading: "Install instructions" (or similar). Body: `<p>...</p>` with one embedded `<button>` linking to `INSTALL_DOC_URL`. |
| Module URL constant | `HelpDialog.tsx:65-70` | Add `const INSTALL_DOC_URL = 'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md'`. The same URL must be added to `SHELL_OPEN_EXTERNAL_ALLOWED` in `src/main/ipc.ts` (D-16/D-18). |
| `openLink(INSTALL_DOC_URL)` button | `HelpDialog.tsx:137-144` | Verbatim shape. |

**Wording-stability constraint (Phase 9 Plan 07 lock):** The em-dash (U+2014) at `HelpDialog.tsx:210, 222` and the literal substrings "editor metadata" + "does not affect sampling" are gated by `tests/renderer/help-dialog.spec.tsx`. Phase 12 MUST NOT regress these — only ADD a new section.

---

### `src/renderer/src/modals/AtlasPreviewModal.tsx:116` (M — F1 fix)

**Bug site (verbatim, single-line):**
```typescript
img.src = `app-image://localhost${encodeURI(absolutePath)}`;
```

**Root-cause confirmed in RESEARCH §F1 Atlas-Image URL Audit:** on Windows, `absolutePath = 'C:\\Users\\...'`. After `encodeURI()` the colon is preserved (per WHATWG URL spec), so concatenated to `app-image://localhost`, the URL parser sees host = `localhostc` (lowercased — the `c` from `C:` glued onto `localhost`).

**Fix pattern — `pathToFileURL` from `node:url`:**
```typescript
import { pathToFileURL } from 'node:url';
// ...
const fileUrl = pathToFileURL(absolutePath);
img.src = `app-image://localhost${fileUrl.pathname}`;
```

**Layer-3 concern:** `node:url` is a Node-only module; the renderer runs in a sandbox without Node access. `pathToFileURL` MUST be exposed via the preload bridge — add `window.api.pathToImageUrl(absolutePath: string): string` to `src/preload/index.ts`. **Open Question 1 in RESEARCH** flags whether `node:url` is available in sandboxed preload (likely yes — `webUtils` from `electron` is already imported there at `:47`); if NOT, fall back to a main-process `ipcMain.handle('image-url:path-to-url', ...)` invoke.

**Main-process protocol handler is already correct** (`src/main/index.ts:363-379`) — once the renderer constructs the URL correctly, the handler resolves the path correctly. **No main-process changes for F1.**

**Test pattern** (from RESEARCH §F1 Windows-runtime test, runs on D-22 expanded matrix):
```typescript
test('app-image:// URL is well-formed for Windows-style paths', () => {
  const winPath = 'C:\\Users\\Tester\\stm\\images\\CIRCLE.png';
  const fileUrl = pathToFileURL(winPath);
  const appImageUrl = `app-image://localhost${fileUrl.pathname}`;
  const parsed = new URL(appImageUrl);
  expect(parsed.host).toBe('localhost');
  expect(parsed.pathname).toMatch(/^\/C:\//);
});
```

**What to copy / What to change:**

| Element | Copy from | Change for Phase 12 |
|---------|-----------|---------------------|
| Pre-fix line `img.src = ...` | `AtlasPreviewModal.tsx:116` | Replace with `pathToFileURL`-derived form. |
| Preload bridge addition | `src/preload/index.ts:138-140` (`openOutputFolder` shape) OR `:158` (invoke) | Recommended: `pathToImageUrl: (absolutePath: string): string => { const u = pathToFileURL(absolutePath); return `app-image://localhost${u.pathname}`; }` — synchronous, no IPC roundtrip. If `node:url` unavailable, use `ipcRenderer.invoke('image-url:path-to-url', absolutePath)` shape. |
| Vitest test | `tests/renderer/atlas-preview-modal.spec.tsx` (extend existing) | Add Windows-path test per RESEARCH excerpt above. |

---

### `src/renderer/src/components/AppShell.tsx:404-415` (M — F2 fix Part 1)

**Bug site identified per RESEARCH §F2 Open Question 4 grep:**
```typescript
const pickOutputDir = useCallback(async (): Promise<string | null> => {
  // Phase 6 REVIEW L-01 (2026-04-25) — fall back to '.' (process cwd
  // resolution at the OS picker) when the skeleton path has no parent
  // segment. Edge case: a skeleton at filesystem root like '/skel.json'
  // would otherwise produce defaultOutDir = '/images-optimized' and
  // suggest writing to system root. Realistically nobody drops a skeleton
  // there, but the regex-strip approach has no defense and a one-token
  // fallback removes the suggestion entirely.
  const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
  const defaultOutDir = skeletonDir + '/images-optimized';
  return window.api.pickOutputDirectory(defaultOutDir);
}, [summary.skeletonPath]);
```

**Bug analysis (composed from RESEARCH §F2 + WIN-FINDINGS):** `defaultOutDir = skeletonDir + '/images-optimized'` is what makes the Windows native picker treat the call as save-as (a path that doesn't exist yet, last segment looks like a filename). The picker properties at `src/main/ipc.ts:343-353` are already correct (`'openDirectory', 'createDirectory', 'promptToCreate', 'dontAddToRecent'`). Only the renderer's `defaultPath` is wrong.

**Picker properties already correct** (`src/main/ipc.ts:343-353`):
```typescript
const options: Electron.OpenDialogOptions = {
  title: 'Choose output folder for optimized images',
  defaultPath,
  buttonLabel: 'Export Here',
  properties: [
    'openDirectory',
    'createDirectory',   // macOS — allow creating new folder in picker
    'promptToCreate',    // Windows — prompt if entered path doesn't exist
    'dontAddToRecent',   // Windows — don't pollute recent docs
  ],
};
```

**Overwrite-warning predicate already correct** (`src/main/ipc.ts:217-223` `probeExportConflicts` + the existing `ConflictDialog` mount). D-20.3 is already satisfied.

**What to copy / What to change:**

| Element | Copy from / Reference | Change for Phase 12 |
|---------|-----------------------|---------------------|
| Picker properties array | `ipc.ts:347-352` | NO change — verified already correct. Test asserts the array shape stays. |
| `defaultPath` derivation | `AppShell.tsx:412-413` | Replace `skeletonDir + '/images-optimized'` with `skeletonDir` (or `path.dirname(skeletonPath)`-equivalent — the parent of skeleton .json, NOT a sibling-named subfolder). Per RESEARCH §F2 Recommended fix sequence step 3. |
| Vitest test | `tests/main/ipc.spec.ts` (extend existing) | Assert: `defaultPath` does NOT contain literal `'images'` substring. Recommended `tests/renderer/app-shell.spec.tsx` (greenfield) for the renderer-side derivation; or unit-test the helper if extracted. |
| Overwrite-warning probe | `ipc.ts:205-228` | NO change — verified already correct (D-20.3 satisfied). |

---

### `src/core/loader.ts` (M — F3 version guard insertion)

**Analog (existing throw site — same exact shape for new throw):** `src/core/loader.ts:98-104`:
```typescript
// 1. Read skeleton JSON
let jsonText: string;
try {
  jsonText = fs.readFileSync(skeletonPath, 'utf8');
} catch {
  throw new SkeletonJsonNotFoundError(skeletonPath);
}
```

**Insertion point per RESEARCH §F3 EARLIER variant** (lines 98-104 → 105 after JSON.parse):
```typescript
// EARLIER variant — at line 100, after JSON.parse:
const parsedJson: unknown = JSON.parse(jsonText);
if (parsedJson && typeof parsedJson === 'object' && 'skeleton' in parsedJson) {
  const skel = (parsedJson as Record<string, unknown>).skeleton as Record<string, unknown> | undefined;
  if (skel && typeof skel.spine === 'string') {
    checkSpineVersion(skel.spine, skeletonPath);
  } else {
    checkSpineVersion(null, skeletonPath);  // unknown — reject
  }
}
// ... atlas resolution ...
const skeletonData = skeletonJson.readSkeletonData(parsedJson);
```

**Predicate function (greenfield in `loader.ts`):** Per RESEARCH §F3 Predicate:
```typescript
function checkSpineVersion(version: string | null, skeletonPath: string): void {
  if (version === null) {
    // Pre-3.7 had no `skeleton.spine` field. Treat as < 4.2 — reject.
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);
  }
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '', 10);
  const minor = parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  if (major < 4 || (major === 4 && minor < 2)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
}
```

**Layer-3 invariant respected:** `src/core/loader.ts` already imports `node:fs` for `readFileSync` (line 30) — adding string parsing + `parseInt` adds zero new boundary crossings. No `electron`, no DOM, no new `node:fs` calls.

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Throw shape | `loader.ts:98-104` (`SkeletonJsonNotFoundError(skeletonPath)`) | Same shape: `throw new SpineVersionUnsupportedError(version, skeletonPath)`. |
| Insertion point | After `loader.ts:101` (`jsonText = fs.readFileSync(...)` succeeds) and BEFORE `loader.ts:107` (atlas resolution) | Per RESEARCH EARLIER variant — guarantees rejection fires on truly old Spine inputs that don't even parse cleanly through spine-core 4.2's `SkeletonJson`. |
| `JSON.parse(jsonText)` | `loader.ts:140` (currently inline at `readSkeletonData(JSON.parse(jsonText))`) | Hoist to a `const parsedJson: unknown = JSON.parse(jsonText)` statement so version-check + readSkeletonData share one parse. Pass `parsedJson` to `readSkeletonData` at line 140 (avoids double-parse). |
| Predicate `checkSpineVersion` | (none — first instance) | Greenfield helper inside `loader.ts`. Pure function — no side effects. |

---

### `src/core/errors.ts` (M — new `SpineVersionUnsupportedError` class)

**Analog (single-field constructor):** `src/core/errors.ts:20-25` `SkeletonJsonNotFoundError`:
```typescript
export class SkeletonJsonNotFoundError extends SpineLoaderError {
  constructor(public readonly path: string) {
    super(`Spine skeleton JSON not found or not readable: ${path}`);
    this.name = 'SkeletonJsonNotFoundError';
  }
}
```

**Analog (two-field constructor with structured message):** `src/core/errors.ts:27-51` `AtlasNotFoundError`:
```typescript
export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
        `Re-export from the Spine editor with the atlas included.\n` +
        `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
    );
    this.name = 'AtlasNotFoundError';
  }
}
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Class shape (extends `SpineLoaderError`) | `errors.ts:20-25` AND `:27-51` | Same `extends SpineLoaderError`. |
| Two-field constructor | `errors.ts:29-32` (AtlasNotFoundError shape) | `constructor(public readonly detectedVersion: string, public readonly skeletonPath: string)`. |
| Message (D-21 wording) | `errors.ts:44-48` (multiline string concat) | `super(\`This file was exported from Spine ${detectedVersion}. Spine Texture Manager requires Spine 4.2 or later. Re-export from Spine 4.2 or later in the editor.\`)`. |
| `this.name` assignment | `errors.ts:24, 49, 58` | `this.name = 'SpineVersionUnsupportedError'`. (Critical — `KNOWN_KINDS` Set.has lookup at `ipc.ts:90-96` uses `err.name`.) |

---

### `src/shared/types.ts` (M — extend `SerializableError` union)

**Analog:** `src/shared/types.ts:518-542`:
```typescript
export type SerializableError =
  | {
      kind: 'SkeletonNotFoundOnLoadError';
      message: string;
      // Cached recovery payload — fed to handleProjectReloadWithSkeleton
      // when the user picks a replacement skeleton (D-149 chain).
      projectPath: string;
      originalSkeletonPath: string;
      mergedOverrides: Record<string, number>;
      samplingHz: number;
      lastOutDir: string | null;
      sortColumn: string | null;
      sortDir: 'asc' | 'desc' | null;
    }
  | {
      kind:
        | 'SkeletonJsonNotFoundError'
        | 'AtlasNotFoundError'
        | 'AtlasParseError'
        | 'ProjectFileNotFoundError'
        | 'ProjectFileParseError'
        | 'ProjectFileVersionTooNewError'
        | 'Unknown';
      message: string;
    };
```

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| Add new arm OR extend existing union | `:533-540` second-arm union list | Per RESEARCH §F3: `\| { kind: 'SpineVersionUnsupportedError'; message: string; detectedVersion: string }` — third arm with one extra typed field beyond `message`. Keeps narrowing precise (renderer can show `detectedVersion` separately if it wants). |

---

### `tests/main/auto-update.spec.ts` (G) — test (mocked autoUpdater)

**Analog #1:** `tests/main/recent.spec.ts` — mocked `app.getPath('userData')` + temp dir + assertions on JSON file shape.

**Analog #2:** `tests/main/menu.spec.ts` — mocked Electron `Menu` builder + assertion that click handler fires the right `webContents.send` channel.

**What to copy / What to change:**

| Test concern | Copy from | Change for Phase 12 |
|--------------|-----------|---------------------|
| Mock `app.getPath('userData')` | `recent.spec.ts` setup block | Identical — points to OS temp dir. |
| Mock `electron-updater`'s `autoUpdater` | (none — first instance) | Use `vi.mock('electron-updater', () => ({ autoUpdater: { ...stub fields and event-emitter shape... } }))`. Drive event emissions in tests via the stub's `emit` to assert IPC sends. |
| Assert `webContents.send('update:available', ...)` | `menu.spec.ts` (similar webContents.send pattern) | Capture the `getMainWindow()` mock, drive the autoUpdater event emission, assert the mock's send was called with channel + payload. |
| Assert `Promise.race` 10s timeout | (none — first instance) | Use `vi.useFakeTimers()` + advance by 10001ms; assert `update:error` (manual mode) or silent (startup mode). |

---

### `tests/main/update-state.spec.ts` (G) — test

**Analog:** `tests/main/recent.spec.ts` — copy-and-rename the entire test file structure. Same mocking strategy, same temp-dir lifecycle, same assertions adapted to the new schema (single `dismissedUpdateVersion` field instead of `paths` array).

---

### `tests/renderer/update-dialog.spec.tsx` (G) — test

**Analog:** `tests/renderer/help-dialog.spec.tsx` — jsdom render + ARIA assertions + button-click assertions.

**Sub-analog (button-click + props change):** `tests/renderer/settings-dialog.spec.tsx` — modal with primary/secondary action buttons.

**What to copy / What to change:**

| Test concern | Copy from | Change for Phase 12 |
|--------------|-----------|---------------------|
| Render dialog open, assert role=dialog + aria-modal | `help-dialog.spec.tsx` | Identical. |
| Assert `props.onClose` fires on Escape | `help-dialog.spec.tsx` | Identical (useFocusTrap onEscape mapping). |
| Assert button onClick fires correct callback | `settings-dialog.spec.tsx` (Save button → onApply) | "Download + Restart" → `onDownload`; "Later" → `onLater`; "Restart" → `onQuitAndInstall`. |
| Assert state machine | (none — first instance) | Render with `state="available"` then re-render with `state="downloaded"`; assert button copy changes accordingly. |

---

### `tests/integration/install-md.spec.ts` (G) — test (smoke)

**Analog:** No exact analog. Closest is `tests/main/recent.spec.ts` for file-existence assertions. Composed from RESEARCH §Wave 0 Gaps:

```typescript
test('REL-03: INSTALL.md exists at repo root', () => {
  const path = resolve(__dirname, '../../INSTALL.md');
  expect(existsSync(path)).toBe(true);
});

test('REL-03: INSTALL.md contains macOS / Windows / Linux sections', () => {
  const text = readFileSync(resolve(__dirname, '../../INSTALL.md'), 'utf8');
  expect(text).toMatch(/##\s*macOS/i);
  expect(text).toMatch(/##\s*Windows/i);
  expect(text).toMatch(/##\s*Linux/i);
  expect(text).toMatch(/libfuse2/);
});

test('REL-03: referenced screenshots exist in docs/install-images/', () => {
  const dir = resolve(__dirname, '../../docs/install-images');
  expect(existsSync(dir)).toBe(true);
  // Per RESEARCH §screenshot list:
  expect(existsSync(resolve(dir, 'macos-gatekeeper-open-anyway.png'))).toBe(true);
  // ... etc
});
```

---

### `fixtures/SPINE_3_8_TEST/` (G)

**Analog:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — same fixture shape (skeleton JSON + .atlas + images/SQUARE.png). Different content per RESEARCH §F3 Fixture for the version-rejection test:

```json
{
  "skeleton": { "spine": "3.8.99" },
  "bones": [{ "name": "root" }],
  "slots": [],
  "skins": [{ "name": "default", "attachments": {} }]
}
```

Plus stub `.atlas` file (one region, points to `images/SQUARE.png`) and a 1x1 transparent `images/SQUARE.png` so the test confirms F3's version check fires BEFORE atlas-resolution path runs.

---

### `.github/workflows/release.yml` (M — matrix expand + latest*.yml uploads)

**Analog (test job structure):** Lines 28-51 (current single-OS test job).

**Analog (publish step files: input):** Lines 138-150 (current `softprops/action-gh-release@v2` `files:` block).

**Analog (action SHA-pinning):** Phase 11's pin discipline — every `uses: <action>@<sha>` carries the SHA, never floating tags. Preserve in Phase 12.

**Analog (`if-no-files-found: error`):** Lines 71, 90, 109 — Phase 11 D-22 discipline. Preserve in Phase 12.

**What to copy / What to change** (per RESEARCH §CI Test-Matrix Expansion + §CI publish-step diff):

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| `runs-on:` | `:29` (`runs-on: ubuntu-latest`) | `runs-on: ${{ matrix.os }}`. |
| `strategy` block | (none — first instance) | Add `strategy: { fail-fast: true, matrix: { os: [ubuntu-latest, windows-2022, macos-14] } }`. `fail-fast: true` preserves CI-05 atomicity (D-23). |
| Tag-version guard step `if:` clause | `:39` | Add `&& matrix.os == 'ubuntu-latest'` so the guard runs once. Add `shell: bash` explicitly so Windows matrix leg uses Git-Bash for the `${GITHUB_REF_NAME#v}` expansion. |
| `actions/upload-artifact@v4 path:` (build-mac) | `:70` (`path: release/*.dmg`) | Multi-line glob: `path: \|\\n  release/*.dmg\\n  release/latest-mac.yml`. Preserve `if-no-files-found: error`. |
| `actions/upload-artifact@v4 path:` (build-win) | `:89` | Multi-line glob: `release/*.exe` + `release/latest.yml`. |
| `actions/upload-artifact@v4 path:` (build-linux) | `:108` | Multi-line glob: `release/*.AppImage` + `release/latest-linux.yml`. |
| `softprops/action-gh-release@v2 files:` | `:147-150` | Append `assets/latest.yml`, `assets/latest-mac.yml`, `assets/latest-linux.yml`. |
| `INSTALL_DOC_LINK` env var | `:135` | Change from `.../README.md` to `.../INSTALL.md`. |

---

### `.github/release-template.md` (M — bullets → single link)

**Analog (in-file precedent):** Lines 14-23 — the existing bullet block to be replaced.

**Per D-17 / RESEARCH §Release-template prune:**
```markdown
## Install instructions

See [INSTALL.md](${INSTALL_DOC_LINK}) for per-OS install + first-launch instructions.
```

The `## Install instructions` heading stays per REL-02. The `${INSTALL_DOC_LINK}` placeholder is already substituted by `.github/workflows/release.yml`'s envsubst step.

---

### `electron-builder.yml` (M — flip `publish: null` → GitHub provider)

**No code analog** — config flip per electron-updater docs. Per RESEARCH §electron-updater Configuration:

```yaml
# Phase 11 (today):
publish: null

# Phase 12 (replacement):
publish:
  provider: github
  owner: Dzazaleo
  repo: Spine_Texture_Manager
  releaseType: release
```

**Critical pre-step (RESEARCH Open Question 5):** A fresh local build with the flipped config MUST be done before pushing v1.1.0-rc2 tag. Inspect `release/win-unpacked/resources/app-update.yml` (Windows) or `release/mac/Spine Texture Manager.app/Contents/Resources/app-update.yml` (macOS); confirm shape matches `{ provider: 'github', owner: 'Dzazaleo', repo: 'Spine_Texture_Manager', updaterCacheDirName: '...' }`. If missing, escalate before tag push.

---

### `INSTALL.md` (G — repo root)

**Analog:** `.github/release-template.md:14-23` (existing inline install bullets are the only install-content surface today; relocate + expand). Full content template lives in RESEARCH §INSTALL.md Authoring Plan.

**What to copy / What to change:**

| Element | Copy from analog | Change for Phase 12 |
|---------|------------------|---------------------|
| macOS bullet | `release-template.md:19` (one-line bullet) | Expand to numbered steps with embedded screenshot per RESEARCH structure. |
| Windows bullet | `release-template.md:20` | Expand to numbered steps + 2 screenshots (More info / Run anyway). |
| Linux bullet | `release-template.md:21` (mentions libfuse2t64 inline) | Expand to numbered steps + dedicated libfuse2/libfuse2t64 paragraph (D-15 wording). |
| Troubleshooting section | (none — greenfield) | Per RESEARCH structure — auto-update wording, atlas-preview F1-fix-version note, terminal launch instructions. |

---

### `README.md` (M — Installing section)

**Analog (in-file precedent):** Whatever existing section structure README.md uses. Per RESEARCH §README.md "Installing" section (D-16.2):

```markdown
## Installing

For non-developer testers: see [INSTALL.md](INSTALL.md).

For developers (build from source): clone, `npm install`, `npm run dev`. See `CLAUDE.md` for project conventions.
```

---

## Shared Patterns

### Pattern A: ARIA modal scaffold

**Source:** `src/renderer/src/modals/HelpDialog.tsx:89-114` (with `useFocusTrap` from `:72-77`)

**Apply to:** `UpdateDialog.tsx` (greenfield)

```tsx
const dialogRef = useRef<HTMLDivElement>(null);
useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

if (!props.open) return null;

return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="update-title"  // ← change ID per modal
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={props.onClose}
  >
    <div
      className="bg-panel border border-border rounded-md p-6 [size]"
      onClick={(e) => e.stopPropagation()}
    >
      {/* content */}
    </div>
  </div>
);
```

**Why this is shared:** All five existing modals (HelpDialog, OverrideDialog, OptimizeDialog, SettingsDialog, AtlasPreviewModal, ConflictDialog, SaveQuitDialog — actually 7) use this scaffold. Phase 8.2 D-184 also auto-suppresses File-menu accelerators while a modal is open via the existing `modalOpen` derivation feeding `notifyMenuState` — `UpdateDialog` inherits this for free as long as `aria-modal="true"` is present.

---

### Pattern B: Atomic JSON write under userData (Pattern-B)

**Source:** `src/main/recent.ts:88-96` (which itself lifts from `src/main/project-io.ts:172-221`)

**Apply to:** `src/main/update-state.ts` (greenfield)

```typescript
async function writeFileAtomic<T>(value: T, finalPath: string): Promise<void> {
  const json = JSON.stringify(value, null, 2);
  const tmpPath = finalPath + '.tmp';
  await writeFile(tmpPath, json, 'utf8');
  await rename(tmpPath, finalPath);
}
```

**Pitfall 2 (carried forward):** `tmpPath = finalPath + '.tmp'` — same directory avoids EXDEV cross-device errors on rename. POSIX atomic; Windows best-effort, acceptable for a settings file (D-177).

---

### Pattern C: One-way IPC send with `getMainWindow()` + try/catch

**Source:** `src/main/ipc.ts:511` (`evt.sender.send('export:progress', e)`) + `src/main/index.ts:67-69` (`getMainWindow()`)

**Apply to:** `src/main/auto-update.ts` `sendToWindow(channel, payload)` helper

```typescript
function sendToWindow(channel: string, payload: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    try { win.webContents.send(channel, payload); } catch { /* renderer gone */ }
  }
}
```

---

### Pattern D: Preload event-subscribe with Pitfall-9 listener-identity preservation

**Source:** `src/preload/index.ts:126-132` (`onExportProgress`) — applies to every `on*` method in preload.

**Apply to:** `onUpdateAvailable`, `onUpdateDownloaded`, `onUpdateNone`, `onUpdateError`, `onMenuCheckForUpdates`, `onMenuInstallationGuide` (all new bridges in Phase 12).

```typescript
on<EventName>: (cb) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, payload: <T>) => cb(payload);
  ipcRenderer.on('<channel>', wrapped);
  return () => {
    ipcRenderer.removeListener('<channel>', wrapped);
  };
},
```

**Why critical:** without capturing `wrapped` in a const, `removeListener` targets a different closure identity and listeners accumulate (Pitfall 9 from Phase 6).

---

### Pattern E: `SHELL_OPEN_EXTERNAL_ALLOWED` allow-list defense

**Source:** `src/main/ipc.ts:131-138` (Set definition) + `:592-602` (handler usage).

**Apply to:** Any new external URL surface in Phase 12 (UpdateDialog "View full release notes" link, HelpDialog INSTALL.md link, "Installation Guide" Help menu item, Windows manual-fallback notice).

**Set.has comparison is exact-string** — D-18 confirmed option (b): no pattern support. Two new entries:
- `'https://github.com/Dzazaleo/Spine_Texture_Manager/blob/main/INSTALL.md'`
- `'https://github.com/Dzazaleo/Spine_Texture_Manager/releases'`

---

### Pattern F: Typed-error envelope at IPC boundary

**Source:** `src/core/errors.ts:13-18` (`SpineLoaderError` base) + `src/main/ipc.ts:90-96` (`KNOWN_KINDS` Set) + `src/shared/types.ts:518-542` (`SerializableError` discriminated union).

**Apply to:** F3's `SpineVersionUnsupportedError`. Three coordinated changes:
1. Define class in `errors.ts` extending `SpineLoaderError`.
2. Append kind to `SerializableError` union in `types.ts`.
3. Append `'SpineVersionUnsupportedError'` to `KNOWN_KINDS` Set in `ipc.ts:92-96`.

Once all three land, the existing `handleSkeletonLoad` forwarder (which routes by `err.name`) handles the new kind without further code changes.

---

### Pattern G: Help-menu item, unconditionally enabled

**Source:** `src/main/index.ts:266-274` (Documentation item — Phase 9 Plan 05 D-188) + `:250-254` (Edit menu Preferences item — T-09-05-MENU-01).

**Apply to:** Two new Phase 12 menu items (Check for Updates, Installation Guide).

```typescript
{
  label: 'Check for Updates…',  // planner picks exact wording
  click: () => mainWindow?.webContents.send('menu:check-for-updates-clicked'),
},
{
  label: 'Installation Guide…',
  click: () => mainWindow?.webContents.send('menu:installation-guide-clicked'),
},
```

**Mandatory:** optional-chain on `mainWindow` (T-08.2-02-01 — closed-window null-safety).

**Mandatory:** keep `role: 'help'` on the parent submenu (Pitfall 8 — Electron template validation throws without it).

**Unconditional enable:** no `enabled:` clause — Help-menu items don't gate on `state.modalOpen` or `state.canSave`.

---

### Pattern H: setTimeout(0) deferral around quit-style synchronous calls

**Source:** `src/main/index.ts:131-137` (`project:confirm-quit-proceed` → `setTimeout(() => app.quit(), 0)` Pitfall 1)

**Apply to:** `auto-update.ts:quitAndInstallUpdate()` for the same reason — `quitAndInstall` is synchronous-quit; defer with `setTimeout(() => autoUpdater.quitAndInstall(false, true), 0)` so the IPC ack returns first.

---

## No Analog Found

| File | Role | Data Flow | Reason | Planner uses... |
|------|------|-----------|--------|-----------------|
| `src/main/auto-update.ts` (event-source side) | service | event-driven (electron-updater) | `electron-updater` is the only library import in main with this lifecycle shape; no in-codebase precedent for binding an external library's event-emitter into our IPC boundary | RESEARCH §Update Lifecycle (composed reference implementation lines 570-687) |
| `INSTALL.md` cookbook structure | docs | data | First per-OS install doc with embedded screenshots in the project | RESEARCH §INSTALL.md Authoring Plan (full structure, screenshot list, libfuse2 wording) |
| `docs/install-images/*.png` | docs (binary) | data | First committed PNG screenshots | RESEARCH §screenshot list (filename convention + tooling per OS) |
| `tests/integration/install-md.spec.ts` | test (smoke) | file existence + content grep | First integration smoke test | RESEARCH §Wave 0 Gaps + composed test stubs above |

---

## Metadata

**Analog search scope:**
- `src/main/` (all 8 files)
- `src/renderer/src/modals/` (all 7 files)
- `src/renderer/src/components/` (AppShell.tsx — F2 fix site)
- `src/renderer/src/hooks/useFocusTrap.ts` (modal scaffold dependency)
- `src/preload/index.ts` (all bridges)
- `src/core/` (loader.ts, errors.ts)
- `src/shared/types.ts` (SerializableError union)
- `tests/main/`, `tests/renderer/`, `tests/core/` (test patterns)
- `.github/workflows/release.yml`, `.github/release-template.md` (CI patterns)
- `fixtures/SIMPLE_PROJECT/` (fixture shape reference)

**Files scanned:** 24 source files, 12 test files, 2 CI/config files.

**Pattern extraction date:** 2026-04-27

**Authoritative cross-references:**
- For *what* to do: `12-CONTEXT.md` (D-01..D-25 user decisions).
- For *why and how*: `12-RESEARCH.md` (1522 lines — full technical reference; this PATTERNS.md is the executor's "what to copy from where" lookup, while RESEARCH is the planner's verified-claim ledger).
- For *test gates*: `12-VALIDATION.md` (Wave 0 gaps + manual-tester checklist).
