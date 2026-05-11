# Phase 34: File → Open accepts Spine skeleton JSON files — Pattern Map

**Mapped:** 2026-05-11
**Files analyzed:** 6 (3 source-of-truth, 1 main IPC, 1 preload, 1 renderer; plus 1–2 test files)
**Analogs found:** 6 / 6 — every file has a strong in-tree analog within Phase 8/8.1/8.2 prior art.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main/project-io.ts` (NEW `handleOpenDialog`, DELETE `handleProjectOpen`) | main-process handler | request-response (picker → discriminated envelope; **no I/O after picker**) | `handleLocateSkeleton` at `src/main/project-io.ts:610-629` (Phase 8.1 D-149 picker-only handler) | **exact** — picker-only, no downstream load, returns discriminated envelope |
| `src/main/ipc.ts` (NEW `'project:open-dialog'`, DELETE `'project:open'`) | IPC channel registration | request-response (`ipcMain.handle`) | `'project:open-from-path'` at `src/main/ipc.ts:922-924` | **exact** — same single-line `ipcMain.handle` shape |
| `src/preload/index.ts` (NEW `openProjectPicker`, NEW `loadSkeletonFromPath`, DELETE `openProject`) | preload bridge | request-response (`ipcRenderer.invoke`) | `openProjectFromPath` at `src/preload/index.ts:193-195` | **exact** — thin path-based invoke wrapper, symmetric to existing `openProjectFromPath` |
| `src/renderer/src/App.tsx` (REWIRE `onMenuOpen` at lines 317-323) | renderer event handler | event-driven (menu IPC → branching async load dispatch) | `DropZone.handleDrop` at `src/renderer/src/components/DropZone.tsx:140-194` (suffix-branching prior art) **+** `App.tsx:325-330` `onMenuOpenRecent` (existing menu Open Recent dispatch shape) | **exact** — both analogs map directly onto the new 5-step flow |
| `tests/main/project-io.spec.ts` (NEW `handleOpenDialog` describe) | unit test (main) | request-response under `vi.mock('electron')` | Existing `handleProjectOpen / handleProjectOpenFromPath` describe at `tests/main/project-io.spec.ts:169` (mocks `dialog.showOpenDialog`) | **exact** — `electron` mock already exposes `dialog.showOpenDialog`, `BrowserWindow.getFocusedWindow` |
| `tests/renderer/save-load.spec.tsx` (extend "Phase 08.2 menu wiring" describe) **OR** new `tests/renderer/menu-open.spec.tsx` | renderer integration test | event-driven (capture-and-fire menu callback) | `8.2-MENU-03/04/05` at `tests/renderer/save-load.spec.tsx:480-554` (captures the `onMenuOpen` / `onMenuOpenRecent` callback via `api.onMenuOpen.mock.calls[0][0]` and invokes it) | **exact** — same capture-and-fire idiom; `api.openProject` mock must be renamed to `api.openProjectPicker` + add `api.loadSkeletonFromPath` |

---

## Pattern Assignments

### `src/main/project-io.ts` — DELETE `handleProjectOpen`, NEW `handleOpenDialog`

**Role:** main-process handler · **Data Flow:** request-response (picker-only, no load)

**Analog:** `handleLocateSkeleton` at `src/main/project-io.ts:610-629` (Phase 8.1 D-149 picker-only). Also reference the existing `handleProjectOpen` at `src/main/project-io.ts:291-306` for the imports / focused-window dance, but **the new handler does NOT chain into a load** — D-06 splits picker from load.

**Imports / file-level conventions** (existing, unchanged at `src/main/project-io.ts:39-60`):
```typescript
import { readFile, writeFile, rename } from 'node:fs/promises';
import * as path from 'node:path';
import { dialog, BrowserWindow } from 'electron';
import { validateProjectFile, migrate, serializeProjectFile, materializeProjectFile } from '../core/project-file.js';
import { loadSkeleton } from '../core/loader.js';
import { buildSummary } from './summary.js';
import { SkeletonJsonNotFoundError, SpineLoaderError, SpineVersionUnsupportedError } from '../core/errors.js';
```

**Picker-only pattern to MIRROR** (from `handleLocateSkeleton` at `src/main/project-io.ts:610-629`):
```typescript
export async function handleLocateSkeleton(
  originalPath: unknown,
): Promise<LocateSkeletonResponse> {
  if (typeof originalPath !== 'string') {
    return { ok: false };
  }
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: `Locate skeleton (was: ${path.basename(originalPath)})`,
    properties: ['openFile'],
    filters: [{ name: 'Skeleton JSON', extensions: ['json'] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false };
  }
  return { ok: true, newPath: result.filePaths[0] };
}
```

**Adapt for `handleOpenDialog`:**
- Title: `'Open Spine Project or Skeleton'` (D-01).
- Filter: `[{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }]` (D-01, single unified filter).
- Cancel arm returns `{ kind: 'cancelled' }` (NOT `{ ok: false }` — D-03 explicit three-arm envelope).
- After resolve: inspect `result.filePaths[0]`'s lowercase suffix and emit `{ kind: 'project'|'skeleton', path }` (D-02 main-side suffix dispatch).
- **No downstream load call.** Unlike today's `handleProjectOpen` at lines 305 (`return handleProjectOpenFromPath(result.filePaths[0])`), the renderer dispatches the load via Step 2 of D-06.

**Old code being DELETED** (`src/main/project-io.ts:286-306`):
```typescript
export async function handleProjectOpen(): Promise<OpenResponse> {
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: 'Open Spine Texture Manager Project',
    properties: ['openFile'],
    filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { ok: false, error: { kind: 'Unknown', message: 'Open cancelled' } };
  }
  return handleProjectOpenFromPath(result.filePaths[0]);
}
```

**Three-arm `OpenDialogResponse` envelope shape (NEW, in `src/shared/types.ts`):**
Mirror the existing 2-arm `LocateSkeletonResponse` at `src/shared/types.ts:1181-1183`:
```typescript
export type LocateSkeletonResponse =
  | { ok: true; newPath: string }
  | { ok: false };
```
…but the new type uses a `kind` discriminator per Phase 8 D-158 convention (mirrors `LoadResponse` / `OpenResponse` shape at `src/shared/types.ts:911-913`, `:1117-1119`):
```typescript
export type OpenDialogResponse =
  | { kind: 'project'; path: string }
  | { kind: 'skeleton'; path: string }
  | { kind: 'cancelled' };
```

---

### `src/main/ipc.ts` — DELETE `'project:open'`, NEW `'project:open-dialog'`

**Role:** IPC channel registration · **Data Flow:** request-response (`ipcMain.handle`)

**Analog:** the existing `'project:open-from-path'` registration at `src/main/ipc.ts:922-924` (one-arg invoke handler) — but the new channel takes ZERO renderer args.

**Existing pattern** (`src/main/ipc.ts:921-924`):
```typescript
ipcMain.handle('project:open', async (_evt) => handleProjectOpen());
ipcMain.handle('project:open-from-path', async (_evt, absolutePath) =>
  handleProjectOpenFromPath(absolutePath),
);
```

**New registration to add** (replace line 921):
```typescript
ipcMain.handle('project:open-dialog', async (_evt) => handleOpenDialog());
```

**Unchanged** (line 678): `ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));` — the new `loadSkeletonFromPath` preload method is a thin wrapper over this existing channel; no new main-side registration needed.

---

### `src/preload/index.ts` — DELETE `openProject`, NEW `openProjectPicker` + `loadSkeletonFromPath`

**Role:** preload bridge · **Data Flow:** request-response (`ipcRenderer.invoke`)

**Analog (1)** for `openProjectPicker`: existing `openProject` at `src/preload/index.ts:168` — same shape, channel name swap only.

**Analog (2)** for `loadSkeletonFromPath`: existing `openProjectFromPath` at `src/preload/index.ts:193-195`:
```typescript
/** F9.2 — direct path-based open (used by Phase 9 OS file association). */
openProjectFromPath: (absolutePath) =>
  ipcRenderer.invoke('project:open-from-path', absolutePath),
```

**Existing `openProject` to DELETE** (`src/preload/index.ts:167-168`):
```typescript
/** F9.2 — open native file picker, then chain to handleProjectOpenFromPath. */
openProject: () => ipcRenderer.invoke('project:open'),
```

**Two NEW methods (mirror `openProjectFromPath` symmetrically, mirror `loadSkeletonFromFile` for the skeleton-path analog at lines 55-72):**
```typescript
/** Phase 34 D-06 Step 1 — open native picker, returns OpenDialogResponse. No loading happens here. */
openProjectPicker: () => ipcRenderer.invoke('project:open-dialog'),

/** Phase 34 D-06 Step 3 (skeleton arm) — path-based skeleton load (symmetric companion to openProjectFromPath). */
loadSkeletonFromPath: (absolutePath: string) =>
  ipcRenderer.invoke('skeleton:load', absolutePath),
```

**Defense-in-depth note** (validated by existing `handleSkeletonLoad` at `src/main/ipc.ts:423-433`):
```typescript
export async function handleSkeletonLoad(jsonPath: unknown): Promise<LoadResponse> {
  // T-01-02-01: input validation at the trust boundary.
  if (typeof jsonPath !== 'string' || jsonPath.length === 0 || !jsonPath.endsWith('.json')) {
    return {
      ok: false,
      error: {
        kind: 'Unknown',
        message: `Invalid path argument: expected a non-empty string ending in .json`,
      },
    };
  }
  // ... loadSkeleton → sampleSkeleton → buildSummary chain
}
```
The new `loadSkeletonFromPath` preload method **does NOT need its own validator** — the main-side handler validates `endsWith('.json')` at the trust boundary. The preload is a pass-through (consistent with `openProjectFromPath`'s pass-through at line 194-195).

**`src/shared/types.ts` `Api` interface update** — replace existing line 1264:
```typescript
// Existing (DELETE):
openProject: () => Promise<OpenResponse>;

// New:
openProjectPicker: () => Promise<OpenDialogResponse>;
loadSkeletonFromPath: (absolutePath: string) => Promise<LoadResponse>;
```

---

### `src/renderer/src/App.tsx` — REWIRE `onMenuOpen` at lines 317-323

**Role:** renderer event handler · **Data Flow:** event-driven (menu IPC → branching async dispatch)

**Analog (1)** — existing `onMenuOpenRecent` at `App.tsx:325-330` provides the dirty-guard-then-path-load shape:
```typescript
const unsubOpenRecent = window.api.onMenuOpenRecent(async (path: string) => {
  const proceed = await handleBeforeDrop(path, 'stmproj');
  if (!proceed) return;
  const resp = await window.api.openProjectFromPath(path);
  handleProjectLoad(resp, path.split(/[\\/]/).pop() ?? path);
});
```

**Analog (2)** — `DropZone.handleDrop` at `src/renderer/src/components/DropZone.tsx:140-181` provides the suffix-branching prior art (note: Phase 34 D-02 LIFTS this branch into main, so the renderer routes by `kind` instead of by suffix):
```typescript
const lower = file.name.toLowerCase();

if (lower.endsWith('.stmproj')) {
  if (typeof onBeforeDrop === 'function') {
    const proceed = await onBeforeDrop(file.name, 'stmproj');
    if (!proceed) return;
  }
  onProjectDropStart(file.name);
  const resp = await window.api.openProjectFromFile(file);
  onProjectDrop(resp, file.name);
  return;
}

if (lower.endsWith('.json')) {
  if (typeof onBeforeDrop === 'function') {
    const proceed = await onBeforeDrop(file.name, 'json');
    if (!proceed) return;
  }
  onLoadStart(file.name);
  const resp = await window.api.loadSkeletonFromFile(file);
  onLoad(resp, file.name);
  return;
}
```

**Existing `onMenuOpen` to REWIRE** (`src/renderer/src/App.tsx:317-323`):
```typescript
useEffect(() => {
  const unsubOpen = window.api.onMenuOpen(async () => {
    const proceed = await handleBeforeDrop('', 'stmproj');  // ← fires guard BEFORE picker (D-05 fixes this)
    if (!proceed) return;
    const resp = await window.api.openProject();             // ← single-IPC-call (D-06 splits this)
    handleProjectLoad(resp, '(menu)');
  });
  // ... rest of useEffect
```

**Target shape (per D-05 + D-06, mirroring both analogs):**
```typescript
const unsubOpen = window.api.onMenuOpen(async () => {
  // Step 1 — picker only (D-06 Step 1). No guard yet.
  const result = await window.api.openProjectPicker();
  // Step 2a — cancel branch: no guard, no toast, no state change (D-05 improvement).
  if (result.kind === 'cancelled') return;
  // Step 2b — derive basename + kind, fire dirty-guard with actual kind (D-05).
  const fileName = result.path.split(/[\\/]/).pop() ?? result.path;
  const dropKind: 'json' | 'stmproj' = result.kind === 'project' ? 'stmproj' : 'json';
  const proceed = await handleBeforeDrop(fileName, dropKind);
  if (!proceed) return;
  // Step 3 — dispatch by kind (D-06 Step 3).
  if (result.kind === 'project') {
    const resp = await window.api.openProjectFromPath(result.path);
    handleProjectLoad(resp, fileName);
  } else {
    const resp = await window.api.loadSkeletonFromPath(result.path);
    handleLoad(resp, fileName);
  }
});
```

**Reused unchanged handlers** (existing in `App.tsx`):
- `handleLoad` at `App.tsx:130-136` — skeleton-only load landing (`status: 'loaded'`).
- `handleProjectLoad` at `App.tsx:144-163` — project load landing (`status: 'projectLoaded'`); preserves the `SkeletonNotFoundOnLoadError` recovery branch.
- `handleBeforeDrop` ref-bridge at `App.tsx:237-242` — Phase 8.1 D-163 dirty-guard:
  ```typescript
  const handleBeforeDrop = useCallback(
    async (fileName: string, kind: 'json' | 'stmproj'): Promise<boolean> => {
      return beforeDropRef.current?.(fileName, kind) ?? true;
    },
    [],
  );
  ```

---

### `tests/main/project-io.spec.ts` — extend with `handleOpenDialog` describe

**Role:** unit test (main) · **Data Flow:** request-response under `vi.mock('electron')`

**Analog:** existing electron mock + `handleProjectSaveAs` test that asserts dialog options at `tests/main/project-io.spec.ts:155-166`:
```typescript
it('save-as opens dialog with correct defaultPath', async () => {
  const electron = await import('electron');
  vi.mocked(electron.dialog.showSaveDialog).mockResolvedValue({
    canceled: false,
    filePath: '/picked/MyRig.stmproj',
  } as Awaited<ReturnType<typeof electron.dialog.showSaveDialog>>);
  await handleProjectSaveAs(baseState, '/a/b', 'MyRig');
  const dialogArgs = vi.mocked(electron.dialog.showSaveDialog).mock.calls[0];
  const opts = dialogArgs[dialogArgs.length - 1] as Electron.SaveDialogOptions;
  expect(opts.defaultPath).toMatch(/MyRig\.stmproj$/);
  expect(opts.filters?.[0]?.extensions).toContain('stmproj');
});
```

**Existing electron mock to reuse** (`tests/main/project-io.spec.ts:22-40`):
```typescript
vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: {
    getFocusedWindow: vi.fn(() => null),
    getAllWindows: vi.fn(() => []),
  },
  app: { whenReady: vi.fn(), quit: vi.fn(), on: vi.fn(), getPath: vi.fn(() => '/tmp/userData') },
}));
```

**Import update** — add `handleOpenDialog` to the existing import block at `tests/main/project-io.spec.ts:10-14`:
```typescript
// Current:
import { handleProjectSave, handleProjectSaveAs, handleProjectOpenFromPath } from '../../src/main/project-io.js';

// Phase 34:
import { handleProjectSave, handleProjectSaveAs, handleProjectOpenFromPath, handleOpenDialog } from '../../src/main/project-io.js';
```

**Test shape for `34-OPEN-01..05`** (mirrors save-as analog above):
```typescript
describe('handleOpenDialog (Phase 34)', () => {
  it('34-OPEN-01: cancel → returns { kind: "cancelled" }', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'cancelled' });
  });

  it('34-OPEN-02: picked .stmproj → { kind: "project", path }', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: ['/a/b/MyRig.stmproj'],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    const result = await handleOpenDialog();
    expect(result).toEqual({ kind: 'project', path: '/a/b/MyRig.stmproj' });
  });

  it('34-OPEN-05: dialog filter is single unified [stmproj, json]', async () => {
    const electron = await import('electron');
    vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
      canceled: true, filePaths: [],
    } as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
    await handleOpenDialog();
    const dialogArgs = vi.mocked(electron.dialog.showOpenDialog).mock.calls[0];
    const opts = dialogArgs[dialogArgs.length - 1] as Electron.OpenDialogOptions;
    expect(opts.filters).toEqual([{ name: 'Spine Project or Skeleton', extensions: ['stmproj', 'json'] }]);
    expect(opts.title).toBe('Open Spine Project or Skeleton');
  });
});
```

---

### `tests/renderer/save-load.spec.tsx` (extend) OR new `tests/renderer/menu-open.spec.tsx`

**Role:** renderer integration test · **Data Flow:** event-driven (capture-and-fire menu callback)

**Analog:** `8.2-MENU-03/04/05` at `tests/renderer/save-load.spec.tsx:480-554`. The canonical idiom is: capture the registered `onMenuOpen` callback from the mock's `.mock.calls[0][0]`, invoke it, assert the downstream IPC mocks fired.

**Existing 8.2-MENU-03 pattern to mirror** (`tests/renderer/save-load.spec.tsx:480-491`):
```typescript
it('8.2-MENU-03: onMenuOpen callback fires openProject (loaded state)', async () => {
  render(<App />);
  const api = (globalThis as any).api;
  expect(api.onMenuOpen.mock.calls.length).toBeGreaterThan(0);
  const cb = api.onMenuOpen.mock.calls[0][0] as () => Promise<void>;
  await cb();
  expect(api.openProject).toHaveBeenCalled();
});
```

**Mock surface update required in `beforeEach`** (`tests/renderer/save-load.spec.tsx:60-145`):
- **DELETE** line 63: `openProject: vi.fn().mockResolvedValue(...)` — `window.api.openProject` no longer exists.
- **ADD**: `openProjectPicker: vi.fn().mockResolvedValue({ kind: 'cancelled' })` (default = cancel; per-test override sets `{ kind: 'project', path: '/abs/x.stmproj' }` or `{ kind: 'skeleton', path: '/abs/x.json' }`).
- **ADD**: `loadSkeletonFromPath: vi.fn().mockResolvedValue({ ok: true, summary: makeSummary() } as LoadResponse)`.

**Note on existing test 8.2-MENU-04 (the canonical 08.1 UAT reproducer):** must be updated to the new picker shape but its assertion contract remains — `onMenuOpen` in `projectLoadFailed` state still fires the picker. Replace `expect(api.openProject).toHaveBeenCalled()` with `expect(api.openProjectPicker).toHaveBeenCalled()`.

**New test shape for `34-MENU-01..05`** (mirrors 8.2-MENU-03):
```typescript
it('34-MENU-01: onMenuOpen → picker returns cancelled → no load, no guard', async () => {
  render(<App />);
  const api = (globalThis as any).api;
  api.openProjectPicker = vi.fn().mockResolvedValue({ kind: 'cancelled' });
  const cb = api.onMenuOpen.mock.calls[0][0] as () => Promise<void>;
  await cb();
  expect(api.openProjectPicker).toHaveBeenCalled();
  expect(api.openProjectFromPath).not.toHaveBeenCalled();
  expect(api.loadSkeletonFromPath).not.toHaveBeenCalled();
});

it('34-MENU-03: picker returns { kind: "skeleton", path } → loadSkeletonFromPath + handleLoad', async () => {
  render(<App />);
  const api = (globalThis as any).api;
  api.openProjectPicker = vi.fn().mockResolvedValue({ kind: 'skeleton', path: '/abs/SIMPLE.json' });
  api.loadSkeletonFromPath = vi.fn().mockResolvedValue({ ok: true, summary: makeSummary() });
  const cb = api.onMenuOpen.mock.calls[0][0] as () => Promise<void>;
  await cb();
  expect(api.loadSkeletonFromPath).toHaveBeenCalledWith('/abs/SIMPLE.json');
});
```

---

## Shared Patterns

### Trust-boundary input validation (apply to: every main-side handler)

**Source:** `handleProjectOpenFromPath` at `src/main/project-io.ts:332-344` + `handleSkeletonLoad` at `src/main/ipc.ts:425-433`.

**Pattern:** Every main-side handler validates `typeof` + non-empty + extension at the TOP of the function and returns a typed `{ kind: 'Unknown', message: ... }` error envelope on failure. Layer-3 + Phase 6 D-10 + Phase 8 D-156.

```typescript
// handleProjectOpenFromPath (project-io.ts:332-344):
if (
  typeof absolutePath !== 'string' ||
  absolutePath.length === 0 ||
  !absolutePath.endsWith('.stmproj')
) {
  return {
    ok: false,
    error: {
      kind: 'Unknown',
      message: 'absolutePath must be a non-empty .stmproj path',
    },
  };
}
```

**Phase 34 application:** `handleOpenDialog` takes no renderer args, so its validation is post-picker: `if (typeof result.filePaths[0] !== 'string')` defensive check before suffix dispatch. The downstream `handleProjectOpenFromPath` and `handleSkeletonLoad` re-validate at THEIR boundaries (defense-in-depth).

---

### Discriminated envelopes (apply to: new `OpenDialogResponse` type)

**Source:** `LoadResponse` at `src/shared/types.ts:911-913`, `OpenResponse` at `:1117-1119`, `LocateSkeletonResponse` at `:1181-1183`, `SerializableError` discriminated union throughout `src/shared/types.ts:880-908`.

**Pattern:** Hand-rolled discriminated union (Phase 2 D-28 / Phase 4 D-81 / Phase 8 D-156 — no `zod`). One field is the discriminator (`ok` or `kind`); the union is exhaustively narrowed by exhaustive `if`/`else` branches in the consumer.

```typescript
// src/shared/types.ts:911-913
export type LoadResponse =
  | { ok: true; summary: SkeletonSummary }
  | { ok: false; error: SerializableError };

// src/shared/types.ts:1117-1119
export type OpenResponse =
  | { ok: true; project: MaterializedProject }
  | { ok: false; error: SerializableError };

// src/shared/types.ts:1181-1183
export type LocateSkeletonResponse =
  | { ok: true; newPath: string }
  | { ok: false };
```

**Phase 34 — the NEW type:**
```typescript
// Discriminator is `kind` (NOT `ok`), since the third arm ('cancelled') is not
// an error — it's a true no-op the renderer treats verbatim (no toast, no
// error UI, no state change). Mirrors Phase 8 D-158 SerializableError's `kind`
// convention rather than LoadResponse's `ok` boolean.
export type OpenDialogResponse =
  | { kind: 'project'; path: string }
  | { kind: 'skeleton'; path: string }
  | { kind: 'cancelled' };
```

---

### Path-based preload symmetry (apply to: NEW `loadSkeletonFromPath`)

**Source:** `openProjectFromPath` at `src/preload/index.ts:193-195` — the established symmetric counterpart to `openProjectFromFile` (lines 179-191) and `loadSkeletonFromFile` (lines 55-72).

**Pattern:** For every File-based preload entry, there's a corresponding Path-based entry that takes an absolute string path. The Path-based entry is a thin `ipcRenderer.invoke` wrapper; the File-based entry resolves `webUtils.getPathForFile(file)` and then invokes the same channel.

```typescript
// src/preload/index.ts:193-195 (the analog for Phase 34's new method)
openProjectFromPath: (absolutePath) =>
  ipcRenderer.invoke('project:open-from-path', absolutePath),
```

**Phase 34 mirror:**
```typescript
loadSkeletonFromPath: (absolutePath: string) =>
  ipcRenderer.invoke('skeleton:load', absolutePath),
```
Note: `'skeleton:load'` is the SAME channel `loadSkeletonFromFile` invokes (after File → path resolution). The new preload method is the path-based twin.

---

### Picker-then-act split (apply to: `App.tsx onMenuOpen` D-06 architecture)

**Source:** Phase 8.1 D-149 — `handleLocateSkeleton` (`src/main/project-io.ts:610-629`, picker-only) chained from the renderer with `handleProjectReloadWithSkeleton` (`src/main/project-io.ts:658+`, load-only). The renderer's `App.tsx:183-203` is the canonical dispatch:

```typescript
const handleLocateSkeleton = useCallback(async () => {
  if (state.status !== 'projectLoadFailed') return;
  const located = await window.api.locateSkeleton(state.error.originalSkeletonPath);  // ← picker IPC
  if (!located.ok) return; // user cancelled picker
  const resp = await window.api.reloadProjectWithSkeleton({ /* threaded recovery args */ });  // ← load IPC
  // ... mount resp via handleProjectLoad
}, [state]);
```

**Phase 34 application:** the new `onMenuOpen` handler follows the exact same shape — picker IPC → branch by result → load IPC. The picker (`openProjectPicker`) and the load (`openProjectFromPath` OR `loadSkeletonFromPath`) are separate round-trips. This is the canonical D-06 two-IPC-step architecture and the same architectural shape as the locate-skeleton recovery.

---

### One-way IPC for menu events (apply to: `onMenuOpen` subscription remains unchanged)

**Source:** Phase 8.2 D-175 — `onMenuOpen` at `src/preload/index.ts:284-290`. The preload subscribes via `ipcRenderer.on('menu:open-clicked', ...)` with Pitfall 9 listener-identity preservation:

```typescript
onMenuOpen: (cb: () => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent) => cb();
  ipcRenderer.on('menu:open-clicked', wrapped);
  return () => {
    ipcRenderer.removeListener('menu:open-clicked', wrapped);
  };
},
```

**Phase 34 application:** unchanged. `onMenuOpen` subscription stays. The new `'project:open-dialog'` is request-response (`invoke`), NOT one-way — consistent with `'project:open-from-path'`'s `invoke` shape.

---

## No Analog Found

Every file in scope has a strong in-tree analog. No "no analog" entries.

---

## Metadata

**Analog search scope:**
- `src/main/project-io.ts` (full file scanned via grep + targeted reads at lines 1-60, 280-400, 600-670)
- `src/main/ipc.ts` (targeted reads at lines 410-490, 670-690, 910-940)
- `src/preload/index.ts` (full file read, 670 lines)
- `src/renderer/src/App.tsx` (targeted reads at lines 125-205, 230-350)
- `src/renderer/src/components/DropZone.tsx` (targeted read at lines 130-205)
- `src/shared/types.ts` (targeted reads at lines 905-940, 1115-1140, 1180-1300)
- `tests/main/project-io.spec.ts` (targeted reads at lines 1-280)
- `tests/renderer/save-load.spec.tsx` (targeted reads at lines 55-150, 420-580)

**Files scanned:** 8 source + 2 test

**Pattern extraction date:** 2026-05-11

**Key observations:**
1. **`handleLocateSkeleton` (`src/main/project-io.ts:610-629`) is the perfect picker-only template** for the new `handleOpenDialog`. It already demonstrates: focused-window dance, `dialog.showOpenDialog` invocation, cancel-arm typed envelope, no downstream load.
2. **`onMenuOpenRecent` (`App.tsx:325-330`) is the perfect template for the dispatch arms** of the new `onMenuOpen` — it already does `handleBeforeDrop(path, 'stmproj')` → `openProjectFromPath(path)` → `handleProjectLoad(resp, basename)`. The new flow just adds the `else` branch for `kind === 'skeleton'` and lifts the picker call to before the guard.
3. **`DropZone.handleDrop` (`DropZone.tsx:140-194`) is the analog for the suffix-branching**, but Phase 34 D-02 lifts the branch into main; the renderer routes by `kind` returned from `OpenDialogResponse`, not by suffix.
4. **The `8.2-MENU-03/04/05` test pattern** at `save-load.spec.tsx:480-554` is the canonical capture-and-fire idiom for menu-IPC tests. All five `34-MENU-0x` cases follow it byte-for-byte with mock renames.
5. **`OpenDialogResponse` uses `kind` (not `ok`)** as its discriminator — the third arm `'cancelled'` is a true no-op, not an error, so the Phase 8 D-158 `SerializableError`-style `kind` convention is a better fit than `LoadResponse`'s `ok` boolean.
