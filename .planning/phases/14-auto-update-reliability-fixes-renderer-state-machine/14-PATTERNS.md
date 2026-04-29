# Phase 14: Auto-update reliability fixes - Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 8 (6 modified + 2 greenfield specs)
**Analogs found:** 8/8 (all in-tree precedents)

## File Classification

| File | Created/Modified | Role | Data Flow | Closest Analog | Match Quality |
|------|------------------|------|-----------|----------------|---------------|
| `src/main/auto-update.ts` | modified | main-process orchestrator | event-driven + IPC bridge | (self — see lines 92, 124-156, 358-383, 395-404) | exact (self-precedent) |
| `src/main/ipc.ts` | modified | IPC channel registry | request-response (handle) + one-way (on) | (self — `update:dismiss` 688-694; `update:check-now` 680-683) | exact (self-precedent) |
| `src/main/index.ts` | modified | app.whenReady boot wiring | startup lifecycle | (self — `mainWindowRef` 72-76; `initAutoUpdater()` 468-475) | exact (self-precedent) |
| `src/preload/index.ts` | modified | contextBridge surface | request-response invoke | (self — `checkForUpdates` 410; `pathToImageUrl` 504-540) | exact (self-precedent) |
| `src/renderer/src/App.tsx` | modified | top-level wiring + AppState union | request-response + subscription | (self — `useEffect` 281-293; render tree 295-391) + AppShell.tsx:931-979 (subscription block being LIFTED) | exact (lift-from-AppShell) |
| `src/renderer/src/components/AppShell.tsx` | modified (delete-only) | shell child component | (subscriptions REMOVED) | (self — lines 161-181, 904-998 being deleted) | n/a (deletion) |
| `tests/main/auto-update-dismissal.spec.ts` | created | vitest spec (main-side) | unit | `tests/main/auto-update.spec.ts` | exact |
| `tests/renderer/app-update-subscriptions.spec.tsx` | created | vitest spec (renderer-side) | unit | `tests/renderer/save-load.spec.tsx` (App.tsx mount precedent) + `tests/renderer/help-dialog.spec.tsx` (`window.api` stub idiom) | exact |

---

## Pattern Assignments

### `src/main/auto-update.ts` (orchestrator, event-driven + IPC bridge)

**Analog:** SELF — Phase 14 modifies the same file in 5 places.

**Phase 14 edits per CONTEXT.md `<canonical_refs>` line 107:**
1. Add `update:request-pending` handler (new export reading the sticky slot).
2. Add module-level sticky slot for latest update-available payload.
3. Thread trigger context through to `deliverUpdateAvailable` OR move suppression to checkUpdate entry (D-08 implementation choice — planner picks).
4. Add structured console logs (D-09 + D-10).
5. Re-verify SHELL_OPEN_EXTERNAL_ALLOWED Releases-index URL still allow-listed (D-12).

**Module-state precedent** (`src/main/auto-update.ts:94-96`):
```typescript
// --- Module state ----------------------------------------------------------

let initialized = false;
```
**Phase 14 extension** — add a sibling let-binding for the sticky slot:
```typescript
// Phase 14 D-03 — sticky slot for the latest 'update-available' payload.
// Cleared on user dismiss / download trigger; overwritten on newer version.
// Returned by 'update:request-pending' for late-mounting renderers.
let pendingUpdateInfo: UpdateAvailablePayload | null = null;
```
This mirrors the `let initialized = false;` pattern at line 96 — same module-scope let-binding rationale (lazy reference rebuilt each cold start; Phase 14 D-Discretion-2 keeps it in-memory only).

**Variant routing + IPC dispatch precedent** (`src/main/auto-update.ts:358-383`):
```typescript
async function deliverUpdateAvailable(info: UpdateInfo): Promise<void> {
  const state = await loadUpdateState();

  // D-08 strict-`>` semantics — suppress when dismissed >= available.
  if (
    state.dismissedUpdateVersion !== null &&
    compareSemver(state.dismissedUpdateVersion, info.version) >= 0
  ) {
    return;
  }

  // D-04 — Windows-fallback variant when on win32 AND spike has not passed
  // (build-time SPIKE_PASSED OR runtime spikeOutcome === 'pass').
  const spikeRuntimePass = state.spikeOutcome === 'pass';
  const variant: 'auto-update' | 'windows-fallback' =
    process.platform === 'win32' && !SPIKE_PASSED && !spikeRuntimePass
      ? 'windows-fallback'
      : 'auto-update';

  sendToWindow('update:available', {
    version: info.version,
    summary: extractSummary(info.releaseNotes),
    variant,
    fullReleaseUrl: GITHUB_RELEASES_INDEX_URL,
  });
}
```
**Phase 14 D-08 modification (planner picks Option a or b):**
- **Option a (thread-trigger):** Add a `triggeredManually: boolean` parameter to `deliverUpdateAvailable`; stash on a module-level `lastCheckTrigger` slot before `autoUpdater.checkForUpdates()` resolves; consume here to skip the dismissed-version branch when `trigger === 'manual'`.
- **Option b (suppress-at-entry):** Skip the dismissed-version branch in `deliverUpdateAvailable` entirely; instead apply suppression ONLY inside `checkUpdate(false)` (the 3.5 s startup-check path) BEFORE calling `autoUpdater.checkForUpdates()` (compare cached `dismissedUpdateVersion` to a cached `lastKnownVersion`, early-return if `>=`). After the bypass, ALSO write `pendingUpdateInfo = { ... }` so the next renderer mount can pick it up via `update:request-pending`.

In BOTH options the existing `sendToWindow('update:available', { version, summary, variant, fullReleaseUrl })` call stays — Phase 14 only adds the `pendingUpdateInfo = payload` write immediately before/after this line so the slot stays in sync.

**`sendToWindow` helper precedent** (`src/main/auto-update.ts:395-404`):
```typescript
function sendToWindow(channel: string, payload: unknown): void {
  const win = getMainWindow();
  if (win && !win.isDestroyed()) {
    try {
      win.webContents.send(channel, payload);
    } catch {
      // webContents gone — silent (one-way channel; nothing to return).
    }
  }
}
```
Phase 14 reuses this verbatim. The new `update:request-pending` handler does NOT use `sendToWindow` (it returns directly from `ipcMain.handle`); the helper continues to serve `update:available` / `update:downloaded` / `update:none` / `update:error` only.

**Structured console-log precedent** (`src/main/auto-update.ts:139, 178, 198, 236`):
```typescript
console.error('[auto-update]', err.message);
// ...
console.error('[auto-update] checkUpdate', message);
// ...
console.error('[auto-update] downloadUpdate', message);
// ...
console.error('[auto-update] dismissUpdate', err);
```
**Phase 14 D-10 instrumentation** — extend with `console.info('[auto-update] <event>: key1=val1, key2=val2')` at the points listed in CONTEXT D-10:
- `initAutoUpdater` entry
- `setTimeout` callback fire (line 153)
- `checkForUpdates` resolve/reject + Promise.race timeout outcome (around line 170-175)
- each `autoUpdater.on(...)` event handler entry (lines 124, 128, 132, 136)
- `deliverUpdateAvailable` dismissed-version compare result + chosen variant
The constraint per D-10 is "structured (parseable: `[auto-update] <event>: <key=value>...`) not free-form." Use `console.info` for non-error states; the existing `console.error` calls already follow the bracketed prefix convention.

**`update:request-pending` handler — new export following existing API surface shape** (`src/main/auto-update.ts:108-238`):
```typescript
// Phase 14 D-03 — return the latest sticky update-available payload, or null.
// Renderer calls this once on mount to handle late-subscribe edge case where
// main fired 'update-available' BEFORE the renderer's React effect committed.
// Cleared on user dismiss / download trigger.
export function getPendingUpdateInfo(): UpdateAvailablePayload | null {
  return pendingUpdateInfo;
}

export function clearPendingUpdateInfo(): void {
  pendingUpdateInfo = null;
}
```
Pattern-match the existing exported public-API functions (`initAutoUpdater`, `checkUpdate`, `downloadUpdate`, `quitAndInstallUpdate`, `dismissUpdate`) — small, single-concern, idempotent. Both new functions are sync (no `Promise<>`).

---

### `src/main/ipc.ts` (IPC channel registry, request-response + one-way)

**Analog:** SELF — Phase 14 adds one new `ipcMain.handle` channel.

**Phase 14 edit per CONTEXT.md line 109:** Add `update:request-pending` (`ipcMain.handle`, returns `UpdateAvailablePayload | null`).

**Existing auto-update IPC channel precedent** (`src/main/ipc.ts:680-700`):
```typescript
ipcMain.handle('update:check-now', async () => {
  const { checkUpdate } = await import('./auto-update.js');
  return checkUpdate(true);
});
ipcMain.handle('update:download', async () => {
  const { downloadUpdate } = await import('./auto-update.js');
  return downloadUpdate();
});
ipcMain.on('update:dismiss', (_evt, version) => {
  if (typeof version !== 'string' || version.length === 0) return;
  void (async () => {
    const { dismissUpdate } = await import('./auto-update.js');
    await dismissUpdate(version);
  })();
});
ipcMain.on('update:quit-and-install', () => {
  void (async () => {
    const { quitAndInstallUpdate } = await import('./auto-update.js');
    quitAndInstallUpdate();
  })();
});
```

**Phase 14 new handler** — append to this block, mirroring `update:check-now`'s shape (dynamic import + return value):
```typescript
// Phase 14 D-03 — late-mount pending-update re-delivery channel.
// Renderer App.tsx calls this ONCE on mount via window.api.requestPendingUpdate().
// Returns the sticky 'update-available' payload (overwritten on newer
// version; cleared on dismiss/download), or null on first launch / no
// pending update. Slot lives in src/main/auto-update.ts module state per
// D-Discretion-2 (in-memory only for v1.1.2 hotfix scope).
ipcMain.handle('update:request-pending', async () => {
  const { getPendingUpdateInfo } = await import('./auto-update.js');
  return getPendingUpdateInfo();
});
```

**Trust-boundary string-guard precedent** (`src/main/ipc.ts:653-655, 688-694`):
```typescript
ipcMain.on('shell:open-external', (_evt, url) => {
  if (typeof url !== 'string' || url.length === 0) return;
  if (!SHELL_OPEN_EXTERNAL_ALLOWED.has(url)) return;
  // ...
});
// ...
ipcMain.on('update:dismiss', (_evt, version) => {
  if (typeof version !== 'string' || version.length === 0) return;
  // ...
});
```
**Phase 14 NOT-NEEDED:** the new `update:request-pending` handler takes NO inbound args (called from preload via `ipcRenderer.invoke('update:request-pending')` with zero payload), so no `typeof === 'string'` guard is required at the IPC entry point per CONTEXT line 140. Only the typed return value matters; the shape is enforced by TypeScript at the renderer-side preload bridge.

**SHELL_OPEN_EXTERNAL_ALLOWED Releases-index URL re-verification** (`src/main/ipc.ts:174`):
```typescript
'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
```
**Phase 14 D-12 cheap verification** — grep `src/main/ipc.ts` for the literal string `https://github.com/Dzazaleo/Spine_Texture_Manager/releases`. Phase 14 must NOT rely on the entry being there — explicit re-verification only. Currently present at line 174 (verified in this pattern map). If the planner's grep finds it absent, that's the smoking gun for "Open Release Page button does nothing" — restore to `SHELL_OPEN_EXTERNAL_ALLOWED` as a separate plan task.

---

### `src/main/index.ts` (app.whenReady boot wiring)

**Analog:** SELF — Phase 14 adds D-10 instrumentation only.

**Phase 14 edit per CONTEXT.md line 111:** confirm `initAutoUpdater()` at line 475 still fires; instrument with structured console log per D-10.

**Existing module-scope ref precedent** (`src/main/index.ts:72-76`):
```typescript
let mainWindowRef: BrowserWindow | null = null;

export function getMainWindow(): BrowserWindow | null {
  return mainWindowRef;
}
```
This is the lineage CONTEXT line 141 names ("`mainWindowRef` at `src/main/index.ts:74` is the precedent for module-scoped lazy refs"). Phase 14's `pendingUpdateInfo` slot in `auto-update.ts` follows this same shape (file-scope `let` + accessor function exported).

**`app.whenReady` boot block precedent** (`src/main/index.ts:407-483`):
```typescript
app.whenReady().then(() => {
  app.setAboutPanelOptions({ /* ... */ });
  protocol.handle('app-image', async (request) => { /* ... */ });
  registerIpcHandlers();
  createWindow();
  void applyMenu(currentMenuState, mainWindowRef);

  // Phase 12 Plan 01 Task 5 — auto-update startup wiring (UPD-01 / D-06).
  initAutoUpdater();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
```
**Phase 14 D-10 addition** — insert a `console.info` ABOVE the `initAutoUpdater();` line:
```typescript
console.info('[auto-update] app-ready: initiating auto-updater');
initAutoUpdater();
```
The actual instrumentation lives inside `initAutoUpdater` itself (per CONTEXT D-10 the `initAutoUpdater entry` log point is one of the suggested coverage points). The boot-side log at the call site is belt-and-braces — confirms the `app.whenReady` callback fired AT ALL (rules out `whenReady` never resolving as a root cause).

---

### `src/preload/index.ts` (contextBridge surface, request-response invoke)

**Analog:** SELF — Phase 14 adds one new bridge method.

**Phase 14 edit per CONTEXT.md line 112:** Add `requestPendingUpdate(): Promise<UpdateAvailablePayload | null>` IPC bridge.

**Existing one-shot invoke precedent** (`src/preload/index.ts:410`):
```typescript
/** UPD-02 — Help → Check for Updates manual trigger. Resolves when checkUpdate completes. */
checkForUpdates: (): Promise<void> => ipcRenderer.invoke('update:check-now'),
```
This is the closest analog — same shape (no inbound args, returns `Promise<T>`, single-line implementation). Phase 14 mirrors verbatim:
```typescript
/**
 * Phase 14 D-03 — late-mount pending-update re-delivery.
 * Renderer App.tsx calls this ONCE on mount in the update-subscription
 * useEffect. Main returns the sticky 'update-available' payload OR null.
 * Handles the edge case where main fired 'update-available' BEFORE the
 * renderer's React effect committed (e.g. 3.5s startup check resolving
 * before React hydration finishes).
 *
 * No subscription pattern (Pitfall 9 listener-identity preservation NOT
 * needed) — one-shot invoke; slot lives in main-process module state.
 */
requestPendingUpdate: (): Promise<{
  version: string;
  summary: string;
  variant: 'auto-update' | 'windows-fallback';
  fullReleaseUrl: string;
} | null> => ipcRenderer.invoke('update:request-pending'),
```

**Subscription-with-listener-identity precedent (NOT applicable here, but referenced in CONTEXT line 139)** (`src/preload/index.ts:425-447`):
```typescript
/** UPD-04 — subscribe to 'update:available'. Pitfall 9 listener-identity. */
onUpdateAvailable: (
  cb: (payload: { version: string; summary: string; variant?: 'auto-update' | 'windows-fallback'; fullReleaseUrl: string; }) => void,
) => {
  const wrapped = (
    _evt: Electron.IpcRendererEvent,
    payload: { version: string; summary: string; variant?: 'auto-update' | 'windows-fallback'; fullReleaseUrl: string; },
  ) => cb(payload);
  ipcRenderer.on('update:available', wrapped);
  return () => {
    ipcRenderer.removeListener('update:available', wrapped);
  };
},
```
Phase 14's `requestPendingUpdate` does NOT need this scaffold (one-shot invoke; no subscription, no `removeListener` cleanup). The 5 existing `onUpdate*` / `onMenuCheckForUpdates` bridges remain unchanged — they're the channels App.tsx subscribes to (lifted from AppShell).

---

### `src/renderer/src/App.tsx` (top-level wiring + AppState union)

**Analog:** SELF — Phase 14 LIFTS the subscription block from AppShell into App.tsx.

**Phase 14 edit per CONTEXT.md line 113:** lift `update:*` subscriptions + `updateState` useState slot + `manualCheckPendingRef` + `<UpdateDialog>` from AppShell to App.tsx; render `<UpdateDialog>` as sibling of `<DropZone>` so it surfaces over every AppState branch.

**Existing top-level useEffect precedent (App.tsx:281-293)**:
```typescript
useEffect(() => {
  if (
    state.status === 'idle' ||
    state.status === 'error' ||
    state.status === 'projectLoadFailed'
  ) {
    window.api.notifyMenuState({
      canSave: false,
      canSaveAs: false,
      modalOpen: false,
    });
  }
}, [state.status]);
```
This is the precedent for top-level `useEffect` blocks living in App.tsx (mirrors what Phase 14 needs — a `useEffect` that runs unconditionally on mount, regardless of AppState branch).

**Existing render-tree precedent (App.tsx:295-391)** — the six AppState branches all render through a single `<DropZone>` wrapper:
```typescript
return (
  <DropZone
    onLoad={handleLoad}
    onLoadStart={handleLoadStart}
    onProjectDrop={handleProjectLoad}
    onProjectDropStart={handleLoadStart}
    onBeforeDrop={handleBeforeDrop}
  >
    {state.status === 'idle' && (
      <p className="text-fg-muted font-mono text-sm">
        Drop a <code>.spine</code> JSON file anywhere in this window
      </p>
    )}
    {state.status === 'loading' && ( /* ... */ )}
    {state.status === 'loaded' && ( <AppShell ... /> )}
    {state.status === 'projectLoaded' && ( <AppShell ... /> )}
    {state.status === 'projectLoadFailed' && ( /* ... */ )}
    {state.status === 'error' && ( /* ... */ )}
  </DropZone>
);
```
**Phase 14 modification** — add `<UpdateDialog>` as a sibling INSIDE the `<DropZone>` (or as a sibling fragment outside, depending on whether DropZone enforces single-child). The dialog's z-50 overlay covers the rendered AppState branch contents.

**Subscription block being LIFTED from AppShell** (`src/renderer/src/components/AppShell.tsx:931-998`):
```typescript
useEffect(() => {
  const unsubAvailable = window.api.onUpdateAvailable((payload) => {
    setUpdateState({
      open: true,
      state: 'available',
      version: payload.version,
      summary: payload.summary,
      variant: payload.variant === 'windows-fallback' ? 'windows-fallback' : 'auto-update',
    });
  });
  const unsubDownloaded = window.api.onUpdateDownloaded(() => {
    setUpdateState((prev) => ({ ...prev, state: 'downloaded' }));
  });
  const unsubNone = window.api.onUpdateNone((payload) => {
    if (manualCheckPendingRef.current) {
      manualCheckPendingRef.current = false;
      setUpdateState({
        open: true,
        state: 'none',
        version: payload.currentVersion,
        summary: '',
        variant: 'auto-update',
      });
    }
  });
  const unsubError = window.api.onUpdateError((payload) => {
    if (manualCheckPendingRef.current) {
      manualCheckPendingRef.current = false;
      setUpdateState({
        open: true,
        state: 'none',
        version: '',
        summary: `Update check failed: ${payload.message}`,
        variant: 'auto-update',
      });
    }
  });
  const unsubMenuCheck = window.api.onMenuCheckForUpdates(() => {
    manualCheckPendingRef.current = true;
    void window.api.checkForUpdates();
  });
  return () => {
    unsubAvailable();
    unsubDownloaded();
    unsubNone();
    unsubError();
    unsubMenuCheck();
    // unsubMenuInstall STAYS in AppShell — it's not an update concern.
  };
}, []);
```
**Phase 14 lift** — copy this block VERBATIM into App.tsx (with one addition: a `void window.api.requestPendingUpdate().then(...)` call inside the useEffect to handle the late-mount edge case per D-03). The `manualCheckPendingRef` and `updateState` state slots also lift verbatim.

**State-slot precedent being LIFTED** (`src/renderer/src/components/AppShell.tsx:161-181`):
```typescript
const [updateState, setUpdateState] = useState<{
  open: boolean;
  state: UpdateDialogState;
  version: string;
  summary: string;
  variant: UpdateDialogVariant;
}>({
  open: false,
  state: 'available',
  version: '',
  summary: '',
  variant: 'auto-update',
});

const manualCheckPendingRef = useRef<boolean>(false);
```
Phase 14 lifts both VERBATIM into App.tsx. Imports (`UpdateDialogState`, `UpdateDialogVariant`) move with them.

**`<UpdateDialog>` mount in AppShell** — find the JSX render block in AppShell that mounts `<UpdateDialog open={updateState.open} ... />` (likely near the bottom of the AppShell return tree); cut and paste into App.tsx as a sibling of `<DropZone>` (or inside DropZone as a non-child overlay; planner picks based on DropZone's children prop signature).

---

### `src/renderer/src/components/AppShell.tsx` (shell component, deletion)

**Analog:** SELF — Phase 14 REMOVES the lifted code.

**Phase 14 edit per CONTEXT.md line 114:** REMOVE `updateState` useState (lines 161-181), `manualCheckPendingRef` (line 181), the 5-channel `useEffect` (lines 931-998 — but keep `unsubMenuInstall` which is a Plan 12-06 D-16.3 concern, not an update concern), and the `<UpdateDialog>` JSX mount.

**Care points (per CONTEXT line 114):**
- Keep `unsubMenuInstall` (lines 987-989) — that subscribes to `menu:installation-guide-clicked`, NOT an `update:*` channel. Lift extracts ONLY the 5 update-related unsubscribes; the install-guide unsub stays in AppShell's useEffect.
- The `manualCheckPendingRef.current = true; void window.api.checkForUpdates();` line at AppShell.tsx:976-979 is INSIDE `unsubMenuCheck` — that lifts to App.tsx.

**Test impact** — the existing `tests/renderer/save-load.spec.tsx` mock surface (lines 99-110, not shown but inferred from CONTEXT) stubs `onUpdateAvailable` / `onUpdateDownloaded` / `onUpdateNone` / `onUpdateError` / `onMenuCheckForUpdates` on `window.api`. These stubs were needed because AppShell mounted the subscription useEffect on first render; after Phase 14's lift, App.tsx mounts those subscriptions instead. The stubs likely STAY (App.tsx is rendered indirectly by save-load.spec.tsx via the `<App />` render at AppShell.tsx render call), but verify the spec doesn't pass a no-window.api shape that breaks the lifted useEffect.

---

### `tests/main/auto-update-dismissal.spec.ts` (vitest spec, GREENFIELD)

**Analog:** `tests/main/auto-update.spec.ts` (Phase 12 Plan 01 Task 2).

**Phase 14 spec coverage per CONTEXT D-15 line 66:**
- Asserts asymmetric rule (manual check re-presents even with `dismissedUpdateVersion === info.version`; startup check suppresses).
- Asserts Later click persists regardless of trigger.
- Asserts windows-fallback variant follows same rule.
- Asserts `update:request-pending` handler returns the sticky slot or null.

**Top-of-file pattern (mocks + hoisted stubs)** (`tests/main/auto-update.spec.ts:24-82`):
```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ----- Module-level mocks (hoisted by vi.mock) ------------------------------

const eventCallbacks = vi.hoisted(() => new Map<string, ((...args: unknown[]) => void)[]>());
const autoUpdaterStub = vi.hoisted(() => ({
  autoDownload: true,
  autoInstallOnAppQuit: true,
  allowPrerelease: false,
  on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    const list = eventCallbacks.get(event) ?? [];
    list.push(cb);
    eventCallbacks.set(event, list);
  }),
  checkForUpdates: vi.fn().mockResolvedValue(null),
  downloadUpdate: vi.fn().mockResolvedValue(undefined),
  quitAndInstall: vi.fn(),
}));

vi.mock('electron-updater', () => ({ autoUpdater: autoUpdaterStub }));

const electronAppStub = vi.hoisted(() => ({
  getVersion: vi.fn(() => '1.0.0'),
  getPath: vi.fn(() => '/tmp/userData'),
}));

vi.mock('electron', () => ({ app: electronAppStub }));

const sendStub = vi.hoisted(() => vi.fn());
const mainWindowStub = vi.hoisted(() => ({
  isDestroyed: vi.fn(() => false),
  webContents: { send: sendStub },
}));

vi.mock('../../src/main/index.js', () => ({
  getMainWindow: vi.fn(() => mainWindowStub),
}));

const loadUpdateStateMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    version: 1,
    dismissedUpdateVersion: null,
    spikeOutcome: 'unknown',
  }),
);
const setDismissedVersionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../src/main/update-state.js', () => ({
  loadUpdateState: loadUpdateStateMock,
  setDismissedVersion: setDismissedVersionMock,
}));
```

**Helper for firing autoUpdater events** (`tests/main/auto-update.spec.ts:86-95`):
```typescript
async function fireEvent(name: string, ...args: unknown[]): Promise<void> {
  const list = eventCallbacks.get(name) ?? [];
  for (const cb of list) {
    await cb(...args);
  }
  // Drain any microtasks the callback may have scheduled (deliverUpdateAvailable
  // is async — it must resolve before the test asserts on sendStub).
  await Promise.resolve();
  await Promise.resolve();
}
```

**Suppression assertion shape** (`tests/main/auto-update.spec.ts:178-216`):
```typescript
describe('dismissedUpdateVersion suppression (D-08 strict semver `>`)', () => {
  it('(4a) dismissed === available → suppress', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).not.toHaveBeenCalledWith('update:available', expect.anything());
  });
  // ... 4b, 4c, 4d
});
```

**Phase 14 NEW assertions** — extend with describe blocks for the asymmetric rule:
```typescript
describe('Phase 14 D-05 asymmetric dismissal — manual ALWAYS re-presents', () => {
  it('(14-a) manual check with dismissed === available → re-presents (NOT suppressed)', async () => {
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    // Phase 14: trigger manual check (option a: thread param; option b: separate path).
    await mod.checkUpdate(true); // triggeredManually=true
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).toHaveBeenCalledWith('update:available', expect.objectContaining({ version: '1.2.3' }));
  });

  it('(14-b) startup check with dismissed === available → STILL suppresses', async () => {
    // Same setup, but checkUpdate(false) → suppression should fire.
    loadUpdateStateMock.mockResolvedValue({
      version: 1, dismissedUpdateVersion: '1.2.3', spikeOutcome: 'unknown',
    });
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await mod.checkUpdate(false);
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    expect(sendStub).not.toHaveBeenCalledWith('update:available', expect.anything());
  });

  it('(14-c) Later click after manual re-present STILL persists dismissedUpdateVersion', async () => {
    // D-06 — Later persists regardless of trigger.
    const mod = await import('../../src/main/auto-update.js');
    await mod.dismissUpdate('1.2.3');
    expect(setDismissedVersionMock).toHaveBeenCalledWith('1.2.3');
  });

  it('(14-d) windows-fallback variant follows asymmetric rule (D-07)', async () => {
    // Mock process.platform = 'win32' OR rely on SPIKE_PASSED constant.
    // Manual check with dismissed === available + variant=windows-fallback → re-presents
    // with variant='windows-fallback' (not 'auto-update').
    // Implementation depends on how Phase 14 surfaces variant routing post-lift.
  });
});

describe('Phase 14 D-03 update:request-pending sticky slot', () => {
  it('(14-e) returns null on first launch (no update-available fired yet)', async () => {
    const mod = await import('../../src/main/auto-update.js');
    expect(mod.getPendingUpdateInfo()).toBeNull();
  });

  it('(14-f) returns latest payload after update-available fires', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '## Summary\nNew' });
    expect(mod.getPendingUpdateInfo()).toEqual(expect.objectContaining({ version: '1.2.3' }));
  });

  it('(14-g) overwrites on newer version', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    await fireEvent('update-available', { version: '1.2.4', releaseNotes: '' });
    expect(mod.getPendingUpdateInfo()?.version).toBe('1.2.4');
  });

  it('(14-h) clearPendingUpdateInfo() empties the slot', async () => {
    const mod = await import('../../src/main/auto-update.js');
    mod.initAutoUpdater();
    await fireEvent('update-available', { version: '1.2.3', releaseNotes: '' });
    mod.clearPendingUpdateInfo();
    expect(mod.getPendingUpdateInfo()).toBeNull();
  });
});
```

**`beforeEach` cleanup pattern** (`tests/main/auto-update.spec.ts:97-133`) — Phase 14 mirrors verbatim (mock reset + `vi.resetModules()` + `vi.doMock` re-bind so the `initialized` and `pendingUpdateInfo` module-state guards reset between tests).

---

### `tests/renderer/app-update-subscriptions.spec.tsx` (vitest spec, GREENFIELD)

**Analog:** `tests/renderer/save-load.spec.tsx` (App.tsx mount precedent) + `tests/renderer/help-dialog.spec.tsx` (`window.api` stub via `Object.defineProperty`).

**Phase 14 spec coverage per CONTEXT D-15 line 67:**
- Renders App.tsx in idle state, asserts `update:*` subscription effects ran (mock `window.api.onUpdateAvailable` etc., assert listeners attached).
- Asserts `<UpdateDialog>` mounts on `update:available` event regardless of AppState.

**File header pattern** (`tests/renderer/help-dialog.spec.tsx:1-26`):
```typescript
// @vitest-environment jsdom
/**
 * Phase 14 Plan XX — App.tsx update-subscription specs.
 *
 * Asserts the lifted update-channel subscriptions:
 *   1. App.tsx renders with status='idle' (no project loaded) → all 5 update
 *      subscriptions registered on mount (onUpdateAvailable / onUpdateDownloaded
 *      / onUpdateNone / onUpdateError / onMenuCheckForUpdates).
 *   2. Firing update:available event → <UpdateDialog> mounts with the payload's
 *      version + summary + variant.
 *   3. Firing menu:check-for-updates-clicked → window.api.checkForUpdates() called.
 *   4. App.tsx mount calls window.api.requestPendingUpdate() (D-03 late-mount hook).
 *
 * Analog: tests/renderer/save-load.spec.tsx (App.tsx render shape with full
 *         window.api stub surface) + tests/renderer/help-dialog.spec.tsx
 *         (window.api stub idiom via Object.defineProperty + vi.fn observability).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../src/renderer/src/App';

afterEach(cleanup);
```

**`window.api` stub idiom precedent** (`tests/renderer/help-dialog.spec.tsx:32-48`):
```typescript
describe('HelpDialog ...', () => {
  const openExternalUrl = vi.fn();

  beforeEach(() => {
    openExternalUrl.mockClear();
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: { openExternalUrl },
    });
  });
```

**Full App.tsx mount stub idiom precedent** (`tests/renderer/save-load.spec.tsx:44-110`):
```typescript
beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' }),
    saveProjectAs: vi.fn().mockResolvedValue({ ok: true, path: '/a/b/proj.stmproj' }),
    openProject: vi.fn().mockResolvedValue({ ok: true, project: { /* ... */ } }),
    // ... full window.api surface
    onUpdateAvailable: vi.fn(() => () => undefined),
    onUpdateDownloaded: vi.fn(() => () => undefined),
    onUpdateNone: vi.fn(() => () => undefined),
    onUpdateError: vi.fn(() => () => undefined),
    onMenuCheckForUpdates: vi.fn(() => () => undefined),
    checkForUpdates: vi.fn(),
  });
});
```

**Phase 14 NEW spec assertion shape** — capture wrapped callbacks and fire events synthetically:
```typescript
describe('Phase 14 — App.tsx update-subscription lift', () => {
  // Capture callbacks so tests can fire events synthetically.
  let updateAvailableCb: ((payload: { version: string; summary: string; variant: 'auto-update' | 'windows-fallback'; fullReleaseUrl: string }) => void) | null = null;
  let updateNoneCb: ((payload: { currentVersion: string }) => void) | null = null;
  let menuCheckCb: (() => void) | null = null;
  const checkForUpdatesMock = vi.fn();
  const requestPendingUpdateMock = vi.fn().mockResolvedValue(null);

  beforeEach(() => {
    updateAvailableCb = null;
    updateNoneCb = null;
    menuCheckCb = null;
    checkForUpdatesMock.mockClear();
    requestPendingUpdateMock.mockClear();
    Object.defineProperty(window, 'api', {
      writable: true,
      configurable: true,
      value: {
        // Full surface required to mount App.tsx without errors.
        notifyMenuState: vi.fn(),
        onMenuOpen: vi.fn(() => () => undefined),
        onMenuOpenRecent: vi.fn(() => () => undefined),
        onMenuSave: vi.fn(() => () => undefined),
        onMenuSaveAs: vi.fn(() => () => undefined),
        // Phase 14 — lifted update subscriptions. Capture the callback so tests fire events.
        onUpdateAvailable: vi.fn((cb) => { updateAvailableCb = cb; return () => undefined; }),
        onUpdateDownloaded: vi.fn(() => () => undefined),
        onUpdateNone: vi.fn((cb) => { updateNoneCb = cb; return () => undefined; }),
        onUpdateError: vi.fn(() => () => undefined),
        onMenuCheckForUpdates: vi.fn((cb) => { menuCheckCb = cb; return () => undefined; }),
        checkForUpdates: checkForUpdatesMock,
        requestPendingUpdate: requestPendingUpdateMock,
        dismissUpdate: vi.fn(),
        downloadUpdate: vi.fn(),
        quitAndInstallUpdate: vi.fn(),
      },
    });
  });

  it('(14-i) App.tsx mount registers all 5 update subscriptions even in idle state', () => {
    render(<App />);
    expect(window.api.onUpdateAvailable).toHaveBeenCalledTimes(1);
    expect(window.api.onUpdateDownloaded).toHaveBeenCalledTimes(1);
    expect(window.api.onUpdateNone).toHaveBeenCalledTimes(1);
    expect(window.api.onUpdateError).toHaveBeenCalledTimes(1);
    expect(window.api.onMenuCheckForUpdates).toHaveBeenCalledTimes(1);
  });

  it('(14-j) App.tsx mount calls requestPendingUpdate (D-03 late-mount hook)', () => {
    render(<App />);
    expect(requestPendingUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('(14-k) UpdateDialog mounts on update:available event regardless of AppState (idle)', () => {
    render(<App />);
    expect(updateAvailableCb).not.toBeNull();
    updateAvailableCb!({
      version: '1.1.2',
      summary: 'Auto-update fixes',
      variant: 'auto-update',
      fullReleaseUrl: 'https://github.com/Dzazaleo/Spine_Texture_Manager/releases',
    });
    // <UpdateDialog> renders as sibling of <DropZone>; assert role=dialog visible.
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/1\.1\.2/)).toBeTruthy();
  });

  it('(14-l) Help → Check for Updates from idle calls window.api.checkForUpdates()', () => {
    render(<App />);
    expect(menuCheckCb).not.toBeNull();
    menuCheckCb!();
    expect(checkForUpdatesMock).toHaveBeenCalledTimes(1);
  });

  it('(14-m) update:none event from manual check shows "up to date" dialog in idle', () => {
    render(<App />);
    // Trigger manual check first to set manualCheckPendingRef.
    menuCheckCb!();
    // Then fire update:none.
    updateNoneCb!({ currentVersion: '1.1.2' });
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The dialog renders the up-to-date state.
  });
});
```

---

## Shared Patterns

### Pattern: Module-level state in `src/main/`
**Source:** `src/main/index.ts:72-76` (`mainWindowRef`) + `src/main/auto-update.ts:96` (`initialized`).
**Apply to:** `src/main/auto-update.ts` for the new `pendingUpdateInfo` slot.
**Rationale (CONTEXT line 141):** The lazy module-scope `let` + accessor function pattern is the established main-process idiom for slots that survive across IPC handler invocations but don't need disk persistence (Phase 14 D-Discretion-2 — sticky slot is in-memory only for v1.1.2 hotfix).

### Pattern: IPC channel naming `update:<verb-or-noun>`
**Source:** `src/main/ipc.ts:680-700` (existing 4 update channels) + `src/main/auto-update.ts:124-149` (4 send channels: `update:available` / `update:none` / `update:downloaded` / `update:error`).
**Apply to:** Phase 14's new `update:request-pending` channel.
**Rationale (CONTEXT line 138):** Matches existing 8 channels — colon-separated namespace, lowercase, hyphenated multi-word verb-or-noun.

### Pattern: Trust-boundary string guards
**Source:** `src/main/ipc.ts:653-655` (`shell:open-external`) + `src/main/ipc.ts:688-694` (`update:dismiss`).
**Apply to:** Any new IPC handler with inbound string args. Phase 14's `update:request-pending` takes NO inbound args, so no guard is required at THAT site (CONTEXT line 140).

### Pattern: Pitfall 9 listener-identity preservation
**Source:** `src/preload/index.ts:425-447` (5 `onUpdate*` bridges + `onMenuCheckForUpdates`).
**Apply to:** Subscription bridges only. Phase 14's `requestPendingUpdate` does NOT need this (one-shot invoke; no cleanup function returned).

### Pattern: `getMainWindow() + sendToWindow` for out-of-band IPC
**Source:** `src/main/auto-update.ts:395-404`.
**Apply to:** All renderer signalling from `src/main/auto-update.ts`. Phase 14 reuses verbatim; new `update:request-pending` handler uses `ipcMain.handle` return value instead, so does NOT call `sendToWindow`.

### Pattern: `console.error('[auto-update] ...', ...)` structured logging
**Source:** `src/main/auto-update.ts:139, 178, 198, 236`.
**Apply to:** Phase 14 D-10 instrumentation. Extend with `console.info('[auto-update] <event>: key1=val1, ...')` for non-error states. Constraint per D-10: "structured (parseable) not free-form."

### Pattern: vitest `vi.hoisted` + `vi.mock` for main-process spec mocks
**Source:** `tests/main/auto-update.spec.ts:24-82` + `97-133` (beforeEach module-reset).
**Apply to:** `tests/main/auto-update-dismissal.spec.ts`. Reuse the entire mock scaffold verbatim; only the `describe` blocks differ.

### Pattern: `Object.defineProperty(window, 'api', ...)` for renderer specs
**Source:** `tests/renderer/help-dialog.spec.tsx:43-48` (idiom 1) + `tests/renderer/save-load.spec.tsx:44-110` (full-surface idiom 2).
**Apply to:** `tests/renderer/app-update-subscriptions.spec.tsx`. Use save-load.spec.tsx's full-surface shape because App.tsx requires the entire `window.api` shape to mount without errors.

---

## No Analog Found

(none — every Phase 14 file has a strong in-tree analog because the phase is a refactor + extension of existing Phase 12 surface)

---

## Metadata

**Analog search scope:** `src/main/`, `src/preload/`, `src/renderer/src/`, `tests/main/`, `tests/renderer/`, `tests/integration/` (read-only).
**Files scanned:** 8 source files + 4 test files.
**Pattern extraction date:** 2026-04-29.
