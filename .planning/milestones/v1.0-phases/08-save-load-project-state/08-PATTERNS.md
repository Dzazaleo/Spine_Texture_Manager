# Phase 8: Save/Load project state — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 13 (6 new, 7 modified)
**Analogs found:** 13 / 13 (100% coverage — pure-extension phase)

> Phase 8 is **glue, not new architecture.** Every primitive Phase 8 needs is shipped, tested, and proven by Phases 1–7. PATTERNS.md below maps each new/modified file to the closest live analog with file:line excerpts so the planner can write tasks that COPY existing patterns rather than reinvent.

---

## File Classification

| New / Modified File | Kind | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|------|-----------|----------------|---------------|
| `src/core/project-file.ts` | NEW | core (pure-TS schema) | transform (pure) | `src/core/overrides.ts` (zero-import pure-TS) + `validateExportPlan` in `src/main/ipc.ts:92-112` (validator discipline) | exact (role + flow) |
| `src/main/project-io.ts` | NEW | main-process I/O | request-response + file I/O | `src/main/image-worker.ts:255-294` (atomic write) + `handlePickOutputDirectory` in `src/main/ipc.ts:274-293` (dialog + envelope) | exact |
| `src/renderer/src/modals/SaveQuitDialog.tsx` | NEW | modal (renderer) | event-driven (3-button promise) | `src/renderer/src/modals/OverrideDialog.tsx` (hand-rolled ARIA + useFocusTrap) | exact |
| `tests/core/project-file.spec.ts` | NEW | test (core) | round-trip + hygiene grep | `tests/core/overrides.spec.ts` (parity + hygiene grep pattern) | exact |
| `tests/main/project-io.spec.ts` | NEW | test (main, mocked) | mocked dialog + fs | `tests/main/ipc-export.spec.ts` (vi.mock electron + fs) | exact |
| `tests/renderer/save-load.spec.tsx` | NEW | test (renderer, jsdom) | DOM render + click + assert | `tests/renderer/atlas-preview-modal.spec.tsx` (jsdom prelude) | exact |
| `src/main/ipc.ts` | MODIFIED | main IPC bus | request-response | self (`registerIpcHandlers` block lines 462-500 + `handleSkeletonLoad` lines 225-260) | self-extend |
| `src/main/index.ts` | MODIFIED | main lifecycle | event-driven | self (`app.whenReady` lines 86-124 + module-level `protocol.registerSchemesAsPrivileged` lines 41-46) | self-extend |
| `src/preload/index.ts` | MODIFIED | preload (contextBridge) | request-response bridge | self (`api` object lines 50-141) | self-extend |
| `src/shared/types.ts` | MODIFIED | shared types | type union | self (`SerializableError` lines 490-493 + `LoadResponse` lines 496-498 + `Api` interface lines 511-570) | self-extend |
| `src/renderer/src/components/AppShell.tsx` | MODIFIED | renderer host | event-driven UI | self (`onClickOptimize` flow lines 229-234 + `exportInFlight` state lines 88) | self-extend |
| `src/renderer/src/components/DropZone.tsx` | MODIFIED | renderer drop target | event-driven | self (extension check lines 81-90) | self-extend |
| `tests/arch.spec.ts` | MODIFIED (optional) | test (boundary grep) | static analysis | self (`src/core/**/*.ts` grep block lines 116-134) | self-extend |

---

## Pattern Assignments

### `src/core/project-file.ts` (NEW — core, pure-TS)

**Primary analog:** `src/core/overrides.ts` (zero-import pure-TS module shape) + the `validateExportPlan` function lives in `src/main/ipc.ts:92-112` (validator discipline).

**Layer 3 module shape — copy from `src/core/overrides.ts:1-47`:**

```typescript
// Header docblock pattern — explains pure-TS, zero-fs/electron/DOM, mentions
// arch.spec.ts grep gate, names callers, calls out Layer 3 invariant.
/**
 * Phase 8 Plan NN — Pure-TS schema + hand-rolled validator + forward-only
 * migration ladder for the .stmproj project file (D-145..D-156).
 *
 * Pure, stateless, zero-I/O. No fs, no electron, no DOM. node:path is
 * permitted (no I/O — see tests/arch.spec.ts:116-134 forbidden-import grep
 * which lists `sharp` + `node:fs` + `fs/promises`, NOT `node:path`).
 *
 * Callers:
 *   - src/main/project-io.ts: invokes serializeProjectFile + JSON.stringify
 *     before atomic write; invokes JSON.parse → validateProjectFile →
 *     migrate → materializeProjectFile on Load.
 *   - tests/core/project-file.spec.ts: round-trip + hygiene + validator cases.
 */
```

**Hand-rolled validator pattern — copy from `src/main/ipc.ts:92-112`:**

```typescript
// Source: src/main/ipc.ts:92-112 (validateExportPlan)
function validateExportPlan(plan: unknown): string | null {
  if (!plan || typeof plan !== 'object') return 'plan is not an object';
  const p = plan as { rows?: unknown; excludedUnused?: unknown; totals?: unknown };
  if (!Array.isArray(p.rows)) return 'plan.rows is not an array';
  if (!Array.isArray(p.excludedUnused)) return 'plan.excludedUnused is not an array';
  if (!p.totals || typeof p.totals !== 'object') return 'plan.totals is not an object';
  for (let i = 0; i < p.rows.length; i++) {
    const r = p.rows[i] as Record<string, unknown>;
    if (
      typeof r.sourcePath !== 'string' || r.sourcePath.length === 0 ||
      // ... per-field shape checks ...
    ) {
      return `plan.rows[${i}] has invalid shape`;
    }
  }
  return null;
}
```

**Phase 8 application — `validateProjectFile` shape:**

```typescript
// Adapt the validateExportPlan idiom to the discriminated-envelope shape
// CONTEXT.md D-156 specifies. Per-version dispatch on `version` FIRST.
export function validateProjectFile(input: unknown):
  | { ok: true; project: ProjectFile }
  | { ok: false; error: { kind: 'invalid-shape' | 'unknown-version' | 'newer-version'; message: string } } {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: { kind: 'invalid-shape', message: 'project file is not an object' } };
  }
  const obj = input as Record<string, unknown>;
  const version = obj.version;
  if (typeof version !== 'number') {
    return { ok: false, error: { kind: 'invalid-shape', message: 'version is not a number' } };
  }
  if (version > 1) {
    return { ok: false, error: { kind: 'newer-version', message: 'This project was saved by a newer version of Spine Texture Manager — please update.' } };
  }
  if (version !== 1) {
    return { ok: false, error: { kind: 'unknown-version', message: `Unknown project file version: ${version}` } };
  }
  // v1 field-shape guard:
  if (typeof obj.skeletonPath !== 'string' || obj.skeletonPath.length === 0) {
    return { ok: false, error: { kind: 'invalid-shape', message: 'skeletonPath is missing or empty' } };
  }
  if (!obj.overrides || typeof obj.overrides !== 'object') {
    return { ok: false, error: { kind: 'invalid-shape', message: 'overrides is not an object' } };
  }
  // ... per-field type guards for atlasPath/imagesDir/samplingHz/lastOutDir/
  //     sortColumn/sortDir (nullable string|number) ...
  if (!obj.documentation || typeof obj.documentation !== 'object') {
    return { ok: false, error: { kind: 'invalid-shape', message: 'documentation is not an object' } };
  }
  // overrides Record<string, number> — every value must be a number:
  for (const [k, v] of Object.entries(obj.overrides as Record<string, unknown>)) {
    if (typeof v !== 'number') {
      return { ok: false, error: { kind: 'invalid-shape', message: `overrides.${k} is not a number` } };
    }
  }
  return { ok: true, project: obj as unknown as ProjectFile };
}
```

**Cross-volume `relativizePath` — RESEARCH §Pitfall 4 verbatim (lines 596-632 of 08-RESEARCH.md):**

```typescript
import * as path from 'node:path';

export function relativizePath(absolutePath: string, basedir: string): string {
  if (!path.isAbsolute(absolutePath)) {
    throw new Error(`relativizePath: expected absolute, got '${absolutePath}'`);
  }
  const rel = path.relative(basedir, absolutePath);
  // Windows: cross-drive returns absolute target verbatim. Detect with isAbsolute(rel).
  if (path.isAbsolute(rel)) return absolutePath;
  // POSIX: cross-volume produces '../../../Volumes/...'. Detect via parsed roots.
  const baseRoot = path.parse(path.resolve(basedir)).root;
  const targetRoot = path.parse(absolutePath).root;
  if (baseRoot !== targetRoot) return absolutePath;
  return rel;
}

export function absolutizePath(stored: string, basedir: string): string {
  if (path.isAbsolute(stored)) return stored;
  return path.resolve(basedir, stored);
}
```

**Map ↔ Object boundary — RESEARCH §Pitfall 3:**

```typescript
// SAVE: state.overrides (Map<string, number>) → JSON Record<string, number>
const overridesJson = Object.fromEntries(state.overrides);

// LOAD: file.overrides (Record<string, number>) → Map<string, number>
const overridesMap = new Map(Object.entries(file.overrides));
```

**Forward-only migration ladder — RESEARCH Pattern 5 (08-RESEARCH.md lines 462-485):**

```typescript
export function migrate(project: ProjectFile): ProjectFileV1 {
  switch (project.version) {
    case 1:
      return project;  // v1 is current
    // case 2:  // future version stub
    //   return { version: 1, ... };
    default:
      throw new Error(`Unsupported project file version: ${(project as ProjectFile).version}`);
  }
}
```

**CRITICAL contract:** `migrate` runs AFTER `validateProjectFile` returns ok:true. The validator is the gate for `'newer-version'` rejection (D-151).

---

### `src/main/project-io.ts` (NEW — main-process I/O)

**Primary analog:** `src/main/image-worker.ts:255-294` (atomic write idiom) + `handlePickOutputDirectory` in `src/main/ipc.ts:274-293` (dialog + envelope).

**Imports pattern — copy from `src/main/image-worker.ts:55-64`:**

```typescript
// Source: src/main/image-worker.ts:55-64
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
import { dirname, resolve as pathResolve } from 'node:path';
import type { ... } from '../shared/types.js';
```

For project-io, pull `readFile`, `writeFile`, `rename`, `access` from `node:fs/promises`; `dialog`, `BrowserWindow` from `electron`; `loadSkeleton` from `../core/loader.js`; `sampleSkeleton` from `../core/sampler.js`; `buildSummary` from `./summary.js`; `validateProjectFile`, `migrate`, `serializeProjectFile`, `materializeProjectFile` from `../core/project-file.js`.

**Atomic write pattern — copy from `src/main/image-worker.ts:254-304`:**

```typescript
// Source: src/main/image-worker.ts:254-304 (verbatim try/catch idiom)
const tmpPath = resolvedOut + '.tmp';
try {
  await sharp(sourcePath)
    .resize(...)
    .toFile(tmpPath);
} catch (e) {
  // 'sharp-error' branch
}
// 6. Atomic rename per D-121.
try {
  await rename(tmpPath, resolvedOut);
} catch (e) {
  const error: ExportError = {
    kind: 'write-error',
    path: resolvedOut,
    message: e instanceof Error ? e.message : String(e),
  };
  errors.push(error);
}
```

**Phase 8 application — `handleProjectSaveAs` body:**

```typescript
// 1. Show save dialog (or skip if currentPath given for handleProjectSave).
const win = BrowserWindow.getFocusedWindow();
const result = win
  ? await dialog.showSaveDialog(win, {
      defaultPath: path.join(defaultDir, `${defaultBasename}.stmproj`),
      filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }],
    })
  : await dialog.showSaveDialog({ defaultPath: ..., filters: ... });
if (result.canceled || !result.filePath) return { ok: false, error: { kind: 'Unknown', message: 'cancelled' } };
const finalPath = result.filePath;

// 2. Build the v1 file shape via core/project-file.ts (pure).
const file = serializeProjectFile(state, finalPath);
const json = JSON.stringify(file, null, 2);

// 3. Atomic write — same idiom as image-worker.ts:254-304.
const tmpPath = finalPath + '.tmp';
try {
  await writeFile(tmpPath, json, 'utf8');
} catch (e) {
  return { ok: false, error: { kind: 'Unknown', message: e instanceof Error ? e.message : String(e) } };
}
try {
  await rename(tmpPath, finalPath);
} catch (e) {
  return { ok: false, error: { kind: 'Unknown', message: e instanceof Error ? e.message : String(e) } };
}
return { ok: true, path: finalPath };
```

**Dialog pattern — copy from `src/main/ipc.ts:274-293` (`handlePickOutputDirectory`):**

```typescript
// Source: src/main/ipc.ts:274-293
export async function handlePickOutputDirectory(defaultPath?: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow();
  const options: Electron.OpenDialogOptions = {
    title: 'Choose output folder for optimized images',
    defaultPath,
    buttonLabel: 'Export Here',
    properties: ['openDirectory', 'createDirectory', 'promptToCreate', 'dontAddToRecent'],
  };
  const result = win
    ? await dialog.showOpenDialog(win, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}
```

**Phase 8 `handleProjectOpen` adaptation:** swap `showOpenDialog` properties to `['openFile']`, add `filters: [{ name: 'Spine Texture Manager Project', extensions: ['stmproj'] }]`, then on success: `readFile` → `JSON.parse` → `validateProjectFile` → `migrate` → `materializeProjectFile` → `loadSkeleton(absoluteSkel)` → `sampleSkeleton({ samplingHz })` → `buildSummary` → wrap in `{ ok: true, project: { summary, restoredOverrides, ...settings } }`.

**Error envelope pattern — copy from `handleSkeletonLoad` `src/main/ipc.ts:225-260`:**

```typescript
// Source: src/main/ipc.ts:225-260
export async function handleSkeletonLoad(jsonPath: unknown): Promise<LoadResponse> {
  if (typeof jsonPath !== 'string' || jsonPath.length === 0 || !jsonPath.endsWith('.json')) {
    return { ok: false, error: { kind: 'Unknown', message: `Invalid path argument: ...` } };
  }
  try {
    // ... do the work ...
    return { ok: true, summary };
  } catch (err) {
    if (err instanceof SpineLoaderError && KNOWN_KINDS.has(err.name as KnownErrorKind)) {
      return { ok: false, error: { kind: err.name as KnownErrorKind, message: err.message } };
    }
    return { ok: false, error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) } };
  }
}
```

For Phase 8: catch `SkeletonJsonNotFoundError` → translate to `'SkeletonNotFoundOnLoadError'` so the renderer can surface the locate-skeleton recovery picker (D-149). Same try/catch shell, different `KNOWN_KINDS` extension.

---

### `src/renderer/src/modals/SaveQuitDialog.tsx` (NEW — hand-rolled ARIA modal)

**Primary analog:** `src/renderer/src/modals/OverrideDialog.tsx` (full file, lines 1-171).

**Imports + ref + useFocusTrap pattern — copy from `OverrideDialog.tsx:47-71`:**

```typescript
// Source: src/renderer/src/modals/OverrideDialog.tsx:47-71
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface OverrideDialogProps {
  open: boolean;
  scope: string[];
  // ...
  onCancel: () => void;
}

export function OverrideDialog(props: OverrideDialogProps) {
  // ...
  const dialogRef = useRef<HTMLDivElement>(null);
  // Gap-Fix Round 6: document-level Escape + Tab cycle via shared hook.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });
  // ...
  if (!props.open) return null;
```

**Outer overlay + inner panel structure — copy from `OverrideDialog.tsx:100-169`:**

```typescript
// Source: src/renderer/src/modals/OverrideDialog.tsx:100-169
return (
  <div
    ref={dialogRef}
    role="dialog"
    aria-modal="true"
    aria-labelledby="override-title"
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
    onClick={props.onCancel}  // overlay click = cancel
  >
    <div
      className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={keyDown}
    >
      <h2 id="override-title" className="text-sm text-fg mb-4">{title}</h2>
      {/* body */}
      <div className="flex gap-2 mt-6 justify-end">
        <button
          type="button"
          onClick={props.onCancel}
          className="border border-border rounded-md px-3 py-1 text-xs"
        >Cancel</button>
        <button
          type="button"
          onClick={apply}
          className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
        >Apply</button>
      </div>
    </div>
  </div>
);
```

**Phase 8 SaveQuitDialog adaptation:** three buttons in footer (`Save` = `bg-accent text-panel font-semibold`, `Don't Save` + `Cancel` = `border border-border text-xs`). Body copy varies by `props.reason`:

```typescript
export interface SaveQuitDialogProps {
  open: boolean;
  reason: 'quit' | 'new-skeleton-drop' | 'new-project-drop';
  basename: string | null;  // e.g. "MyRig.stmproj" — null when Untitled
  onSave: () => void;       // calls saveProject; AppShell proceeds with pending action on success
  onDontSave: () => void;   // proceed without saving
  onCancel: () => void;     // abort pending action; modal closes
}
```

`useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel })` — Esc maps to Cancel (NOT Don't Save — Cancel is the safe default per Photoshop/AE convention). Initial focus lands on `Save` (first tabbable in DOM order — place it first in the footer so the trap auto-focuses it).

---

### `tests/core/project-file.spec.ts` (NEW)

**Primary analog:** `tests/core/overrides.spec.ts` (full file, lines 1-101).

**Test harness pattern — copy from `tests/core/overrides.spec.ts:1-43`:**

```typescript
// Source: tests/core/overrides.spec.ts:1-43
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { clampOverride, applyOverride } from '../../src/core/overrides.js';
// ... renderer-copy import for parity tests if applicable ...

const CORE_SRC = path.resolve('src/core/overrides.ts');

describe('clampOverride (D-79)', () => {
  it('D-79: clamps 200 → 100 (silent source-max clamp, F5.2)', () => {
    expect(clampOverride(200)).toBe(100);
  });
  // ...
});
```

**Hygiene grep block pattern — copy from `tests/core/overrides.spec.ts` (zero-import discipline):**

```typescript
// Look for the corresponding "Hygiene" describe block in overrides.spec.ts that
// reads CORE_SRC and asserts no node:fs / node:path / sharp / spine-core / react
// imports. Phase 8 project-file.ts is allowed to import 'node:path' (no I/O,
// permitted by tests/arch.spec.ts:116-134), but MUST NOT import node:fs,
// node:fs/promises, sharp, electron, or any DOM symbol.

describe('hygiene — Layer 3 invariant for src/core/project-file.ts', () => {
  it('does not import node:fs / node:fs/promises / sharp / electron / DOM', () => {
    const src = readFileSync(path.resolve('src/core/project-file.ts'), 'utf8');
    expect(src, 'core/project-file.ts must not import node:fs').not.toMatch(/from ['"]node:fs/);
    expect(src, 'core/project-file.ts must not import sharp').not.toMatch(/from ['"]sharp['"]/);
    expect(src, 'core/project-file.ts must not import electron').not.toMatch(/from ['"]electron['"]/);
  });
  // node:path IS permitted — see tests/arch.spec.ts:116-134.
});
```

**Cases per CONTEXT.md `<domain>` "Tests" section:**
(a) round-trip equality, (b) relative path stored as `./SIMPLE.json`, (c) cross-volume falls back to absolute, (d) validator rejects missing/wrong-type fields, (e) validator accepts minimal v1, (f) `migrate` is identity on v1, (g) hygiene grep, (h) `documentation: {}` preserved on round-trip.

---

### `tests/main/project-io.spec.ts` (NEW)

**Primary analog:** `tests/main/ipc-export.spec.ts:1-180` (vi.mock electron + fs).

**Mock setup pattern — copy from `tests/main/ipc-export.spec.ts:19-71`:**

```typescript
// Source: tests/main/ipc-export.spec.ts:19-71
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { handleProjectSave, handleProjectOpen, ... } from '../../src/main/project-io.js';

vi.mock('electron', () => ({
  dialog: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn() },
  BrowserWindow: { getFocusedWindow: vi.fn() },
  app: { whenReady: vi.fn(), quit: vi.fn(), on: vi.fn() },
}));

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  access: vi.fn().mockRejectedValue(new Error('ENOENT')),
  constants: { F_OK: 0, R_OK: 4 },
}));

beforeEach(async () => {
  vi.clearAllMocks();
  const fsPromises = await import('node:fs/promises');
  vi.mocked(fsPromises.access).mockReset().mockRejectedValue(new Error('ENOENT'));
});
```

**Dialog mock — copy from `tests/main/ipc-export.spec.ts:75-92`:**

```typescript
// Source: tests/main/ipc-export.spec.ts:75-92
const electron = await import('electron');
vi.mocked(electron.dialog.showOpenDialog).mockResolvedValue({
  canceled: false,
  filePaths: ['/picked/path.stmproj'],
} as unknown as Awaited<ReturnType<typeof electron.dialog.showOpenDialog>>);
const result = await handleProjectOpen();
expect(result.ok).toBe(true);
```

**Cases per CONTEXT.md `<domain>` "Tests":** (a) save → tmp file appears then renames; (b) save with currentPath skips dialog; (c) save-as opens dialog with correct defaultPath; (d) open valid file invokes loadSkeleton with materialized path; (e) missing skeleton → `'SkeletonNotFoundOnLoadError'`; (f) newer schema → `'ProjectFileVersionTooNewError'`; (g) malformed JSON → `'ProjectFileParseError'`; (h) atlas auto-rediscovery on missing path.

---

### `tests/renderer/save-load.spec.tsx` (NEW)

**Primary analog:** `tests/renderer/atlas-preview-modal.spec.tsx:1-130` (jsdom prelude + Testing Library).

**jsdom prelude — copy from `tests/renderer/atlas-preview-modal.spec.tsx:1-22`:**

```typescript
// @vitest-environment jsdom
/**
 * Phase 8 — renderer-side specs for Save/Open buttons + dirty marker +
 * SaveQuitDialog + Cmd/Ctrl+S/O shortcuts + stale-override banner.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AppShell } from '../../src/renderer/src/components/AppShell';
import type { SkeletonSummary } from '../../src/shared/types';

afterEach(cleanup);
```

**Synthetic SkeletonSummary helper — copy from `tests/renderer/atlas-preview-modal.spec.tsx:30-82`:**

```typescript
function makeSummary(): SkeletonSummary {
  // ... 3 small regions packed deterministically ...
}
```

**`window.api` stub pattern — Phase 8 needs to stub `saveProject`, `openProject`, etc. before render. Standard vi.stubGlobal recipe:**

```typescript
beforeEach(() => {
  vi.stubGlobal('api', {
    saveProject: vi.fn().mockResolvedValue({ ok: true, path: '/foo/bar.stmproj' }),
    openProject: vi.fn().mockResolvedValue({ ok: true, project: { ... } }),
    // ... other methods ...
  });
});
```

**Cases:** (a) Save click invokes `window.api.saveProject`; (b) dirty marker `•` renders when overrides Map mutates; (c) SaveQuitDialog three-button promise (Save → onSave then proceed; Don't Save → proceed; Cancel → abort); (d) Cmd+S keydown fires save (suppressed when modal open); (e) Cmd+O fires open; (f) stale-override banner renders with correct count + names (cap at 5 + "+ M more").

---

### `src/main/ipc.ts` (MODIFIED — register 5 new channels)

**Self-extend.** New imports at top:

```typescript
// Add to imports near existing line 39-46:
import {
  handleProjectSave,
  handleProjectSaveAs,
  handleProjectOpen,
  handleProjectOpenFromPath,
  handleLocateSkeleton,
} from './project-io.js';
```

**Register block — copy idiom from `src/main/ipc.ts:462-500` (`registerIpcHandlers`):**

```typescript
// Source: src/main/ipc.ts:462-500 — extend the function body, do NOT replace.
export function registerIpcHandlers(): void {
  ipcMain.handle('skeleton:load', async (_evt, jsonPath) => handleSkeletonLoad(jsonPath));
  ipcMain.handle('dialog:pick-output-dir', async (_evt, defaultPath) =>
    handlePickOutputDirectory(typeof defaultPath === 'string' ? defaultPath : undefined),
  );
  // ... existing export channels ...

  // Phase 8 Plan NN — project file channels (D-140..D-156).
  ipcMain.handle('project:save', async (_evt, state, currentPath) =>
    handleProjectSave(state, typeof currentPath === 'string' ? currentPath : null),
  );
  ipcMain.handle('project:save-as', async (_evt, state, defaultDir, defaultBasename) =>
    handleProjectSaveAs(state, defaultDir, defaultBasename),
  );
  ipcMain.handle('project:open', async (_evt) => handleProjectOpen());
  ipcMain.handle('project:open-from-path', async (_evt, absolutePath) =>
    handleProjectOpenFromPath(absolutePath),
  );
  ipcMain.handle('project:locate-skeleton', async (_evt, originalPath) =>
    handleLocateSkeleton(typeof originalPath === 'string' ? originalPath : ''),
  );
}
```

**Trust-boundary input validation — copy idiom from `src/main/ipc.ts:227-235` (`handleSkeletonLoad` first lines):**

```typescript
// Source: src/main/ipc.ts:227-235
if (typeof jsonPath !== 'string' || jsonPath.length === 0 || !jsonPath.endsWith('.json')) {
  return { ok: false, error: { kind: 'Unknown', message: `Invalid path argument: expected a non-empty string ending in .json` } };
}
```

For Phase 8: `handleProjectOpenFromPath` checks `endsWith('.stmproj')`; `handleProjectSave`/`SaveAs` validates the `state` shape (cheap typeof object check at the boundary).

---

### `src/main/index.ts` (MODIFIED — `before-quit` listener)

**Self-extend.** Existing module imports lines 26-29; existing `app.whenReady` lines 86-124; existing `window-all-closed` lines 126-132.

**Phase 8 additions — RESEARCH §Pitfall 1 (08-RESEARCH.md lines 535-558):**

```typescript
// Source: 08-RESEARCH.md:535-558 (proposed pattern, derived from Electron docs).
// New imports near existing line 26:
import { app, BrowserWindow, ipcMain, protocol } from 'electron';

// Module-level flag — Pitfall 1 re-entry guard.
let isQuitting = false;

// Add AFTER existing protocol.registerSchemesAsPrivileged block (line 41-46).
// Wire BEFORE app.whenReady because before-quit can fire any time.
app.on('before-quit', (event) => {
  if (isQuitting) return;  // re-entry guard — already confirmed; let it through
  event.preventDefault();
  const win = BrowserWindow.getAllWindows()[0];
  if (!win || win.isDestroyed()) {
    isQuitting = true;
    setTimeout(() => app.quit(), 0);  // load-bearing setTimeout (Pitfall 1)
    return;
  }
  win.webContents.send('project:check-dirty-before-quit');
});

// Renderer responds via this one-way channel after dirty-guard resolves.
ipcMain.on('project:confirm-quit-proceed', () => {
  isQuitting = true;
  setTimeout(() => app.quit(), 0);
});

// macOS file-association scaffold (Phase 9 polish drop-in per CONTEXT.md
// Out of Scope). Wire the listener; the electron-builder config that
// actually registers the file type is Phase 9.
app.on('open-file', (event, path) => {
  event.preventDefault();
  const win = BrowserWindow.getAllWindows()[0];
  if (win) win.webContents.send('project:open-from-os', path);
  // else: stash the path and replay it after createWindow resolves.
});
```

**Existing `app.whenReady` block (lines 86-124) untouched** — `registerIpcHandlers()` automatically picks up the 5 new channels because they are registered inside the function body Phase 8 extends.

---

### `src/preload/index.ts` (MODIFIED — extend Api with 5 methods)

**Self-extend.** Existing `api: Api` object at lines 50-141.

**New methods follow the exact `pickOutputDirectory` / `startExport` shape — copy from `src/preload/index.ts:78-95`:**

```typescript
// Source: src/preload/index.ts:78-95
pickOutputDirectory: (defaultPath?: string): Promise<string | null> =>
  ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),

startExport: (plan, outDir, overwrite) =>
  ipcRenderer.invoke('export:start', plan, outDir, overwrite === true),
```

**Phase 8 additions — append inside the same `api` object literal:**

```typescript
saveProject: (state, currentPath) =>
  ipcRenderer.invoke('project:save', state, currentPath),

saveProjectAs: (state, defaultDir, defaultBasename) =>
  ipcRenderer.invoke('project:save-as', state, defaultDir, defaultBasename),

openProject: () =>
  ipcRenderer.invoke('project:open'),

openProjectFromPath: (absolutePath: string) =>
  ipcRenderer.invoke('project:open-from-path', absolutePath),

locateSkeleton: (originalPath: string) =>
  ipcRenderer.invoke('project:locate-skeleton', originalPath),

// Quit-flow listener — RESEARCH §Pitfall 1 sequence diagram (08-RESEARCH.md:233-279).
// Subscription pattern — copy from existing onExportProgress at preload/index.ts:126-132.
onCheckDirtyBeforeQuit: (handler: () => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent) => handler();
  ipcRenderer.on('project:check-dirty-before-quit', wrapped);
  return () => ipcRenderer.removeListener('project:check-dirty-before-quit', wrapped);
},

confirmQuitProceed: () => {
  ipcRenderer.send('project:confirm-quit-proceed');
},
```

**Drag-drop project file from File object — copy + adapt `loadSkeletonFromFile` at lines 51-68:**

```typescript
// Source: src/preload/index.ts:51-68 (loadSkeletonFromFile)
loadSkeletonFromFile: async (file: File): Promise<LoadResponse> => {
  const jsonPath = webUtils.getPathForFile(file);
  if (!jsonPath) {
    return { ok: false, error: { kind: 'Unknown', message: 'Dropped file has no filesystem path...' } };
  }
  return ipcRenderer.invoke('skeleton:load', jsonPath);
},
```

For `.stmproj` drop, the DropZone passes the `File` to `window.api.openProjectFromFile(file)` which preload-resolves the path and calls `ipcRenderer.invoke('project:open-from-path', path)` — same shape as `loadSkeletonFromFile`.

---

### `src/shared/types.ts` (MODIFIED — extend types)

**Self-extend.** Existing `SerializableError` at lines 490-493; `LoadResponse` at lines 496-498; `Api` interface at lines 511-570.

**SerializableError extension — extend the union at line 491:**

```typescript
// Source: src/shared/types.ts:490-493 (existing)
export interface SerializableError {
  kind: 'SkeletonJsonNotFoundError' | 'AtlasNotFoundError' | 'AtlasParseError' | 'Unknown';
  message: string;
}

// Phase 8 extension:
export interface SerializableError {
  kind:
    | 'SkeletonJsonNotFoundError'
    | 'AtlasNotFoundError'
    | 'AtlasParseError'
    | 'ProjectFileNotFoundError'
    | 'ProjectFileParseError'
    | 'ProjectFileVersionTooNewError'
    | 'SkeletonNotFoundOnLoadError'
    | 'Unknown';
  message: string;
}
```

**Response envelope — copy idiom from `LoadResponse` at lines 496-498:**

```typescript
// Source: src/shared/types.ts:496-498
export type LoadResponse =
  | { ok: true; summary: SkeletonSummary }
  | { ok: false; error: SerializableError };

// Phase 8 additions — same shape:
export type SaveResponse =
  | { ok: true; path: string }
  | { ok: false; error: SerializableError };

export type OpenResponse =
  | { ok: true; project: MaterializedProject }
  | { ok: false; error: SerializableError };

export type LocateSkeletonResponse =
  | { ok: true; newPath: string }
  | { ok: false };
```

**ProjectFileV1 + MaterializedProject + AppSessionState — new types per CONTEXT.md D-145:**

```typescript
export interface ProjectFileV1 {
  version: 1;
  skeletonPath: string;            // relative or absolute (D-155)
  atlasPath: string | null;        // hint, not requirement (D-152)
  imagesDir: string | null;
  overrides: Record<string, number>;  // Map → Object at IPC boundary (Pitfall 3)
  samplingHz: number | null;       // null → 120 default (D-146)
  lastOutDir: string | null;       // absolute (D-145)
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  documentation: object;           // reserved slot (D-148)
}

export type ProjectFile = ProjectFileV1;  // union grows as versions accumulate

export interface MaterializedProject {
  summary: SkeletonSummary;            // from re-sample on Load
  restoredOverrides: Record<string, number>;  // intersected with skeleton attachments per D-150
  staleOverrideKeys: string[];        // names dropped per D-150
  samplingHz: number;                  // resolved (default 120 if null)
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  projectFilePath: string;             // absolute path of the .stmproj
}

export interface AppSessionState {
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number | null;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
}
```

**Api extension — copy method shape from `Api.pickOutputDirectory` at line 518:**

```typescript
// Append to the Api interface (currently ends at line 570).
saveProject: (state: AppSessionState, currentPath: string | null) => Promise<SaveResponse>;
saveProjectAs: (state: AppSessionState, defaultDir: string, defaultBasename: string) => Promise<SaveResponse>;
openProject: () => Promise<OpenResponse>;
openProjectFromPath: (absolutePath: string) => Promise<OpenResponse>;
locateSkeleton: (originalPath: string) => Promise<LocateSkeletonResponse>;
onCheckDirtyBeforeQuit: (handler: () => void) => () => void;
confirmQuitProceed: () => void;
```

**Comment requirement:** Per file-top docblock lines 1-17 — every new field MUST be structuredClone-safe (no Map, no class instances). All Phase 8 types comply by construction (Records, primitives, nested plain objects).

---

### `src/renderer/src/components/AppShell.tsx` (MODIFIED — major touch)

**Self-extend.** Existing toolbar buttons cluster lines 360-382; existing modal mount lines 407-466; existing state declarations lines 57-117.

**New state — copy idiom from `exportInFlight` at line 88:**

```typescript
// Source: src/renderer/src/components/AppShell.tsx:88
const [exportInFlight, setExportInFlight] = useState(false);

// Phase 8 additions — same plain-useState shape:
const [currentProjectPath, setCurrentProjectPath] = useState<string | null>(null);
const [lastSaved, setLastSaved] = useState<{
  overrides: Record<string, number>;
  samplingHz: number;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
} | null>(null);
const [saveQuitDialogState, setSaveQuitDialogState] = useState<{
  reason: 'quit' | 'new-skeleton-drop' | 'new-project-drop';
  pendingAction: () => void;  // proceeds when user picks Save success / Don't Save
} | null>(null);
const [staleOverrideNotice, setStaleOverrideNotice] = useState<string[] | null>(null);
const [skeletonNotFoundError, setSkeletonNotFoundError] = useState<string | null>(null);
```

**Dirty derivation — RESEARCH "Claude's Discretion" recommended pattern (CONTEXT.md line 151):**

```typescript
// Field-by-field equality on the 5 D-145 fields.
const isDirty = useMemo(() => {
  if (lastSaved === null) {
    // Untitled session — dirty when overrides Map has any entries OR
    // sortColumn/sortDir/lastOutDir/samplingHz are non-default.
    return overrides.size > 0;
  }
  // Compare current state to lastSaved snapshot field-by-field.
  if (Object.keys(Object.fromEntries(overrides)).length !== Object.keys(lastSaved.overrides).length) return true;
  for (const [k, v] of overrides) if (lastSaved.overrides[k] !== v) return true;
  // ... samplingHz / lastOutDir / sortColumn / sortDir ...
  return false;
}, [overrides, lastSaved /*, samplingHz, sortColumn, sortDir, lastOutDir */]);
```

**Toolbar button — copy class string verbatim from `Optimize Assets` at lines 366-381:**

```typescript
// Source: src/renderer/src/components/AppShell.tsx:374-382 (Optimize Assets button)
<button
  type="button"
  onClick={onClickOptimize}
  disabled={summary.peaks.length === 0 || exportInFlight}
  className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
>
  Optimize Assets
</button>
```

Phase 8 Save / Open buttons use the **same class string verbatim** (Tailwind v4 literal-class scanner discipline — Pitfall 3, see line 365 comment in AppShell).

**Filename chip with dirty marker — copy from line 338, extend with `•` prefix:**

```typescript
// Source: src/renderer/src/components/AppShell.tsx:336-340 (existing chip)
<span className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg">
  {summary.skeletonPath}
</span>

// Phase 8 — replace with dirty-aware chip:
<span
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg"
  title={currentProjectPath ?? undefined}
>
  {isDirty ? '• ' : ''}{currentProjectPath ? path.basename(currentProjectPath) : 'Untitled'}
</span>
```

**Cmd+S/O keyboard listener — RESEARCH Pattern 4 (08-RESEARCH.md:436-457):**

```typescript
useEffect(() => {
  const onKeyDown = (e: KeyboardEvent) => {
    const isMetaOrCtrl = e.metaKey || e.ctrlKey;
    if (!isMetaOrCtrl) return;
    // Suppress when ANY modal is open — modals all have role="dialog".
    if (document.querySelector('[role="dialog"]')) return;
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      e.stopPropagation();
      onClickSave();
    } else if (e.key === 'o' || e.key === 'O') {
      e.preventDefault();
      e.stopPropagation();
      onClickOpen();
    }
  };
  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}, [onClickSave, onClickOpen]);
```

**Save click handler — analog: `onClickOptimize` at lines 229-234:**

```typescript
// Source: src/renderer/src/components/AppShell.tsx:229-234
const onClickOptimize = useCallback(async () => {
  const outDir = await pickOutputDir();
  if (outDir === null) return;
  const plan = buildExportPlan(summary, overrides);
  setExportDialogState({ plan, outDir });
}, [pickOutputDir, summary, overrides]);

// Phase 8 — same useCallback + state-mutate idiom:
const onClickSave = useCallback(async () => {
  const state = buildSessionState(summary, overrides /*, samplingHz, etc. */);
  if (currentProjectPath !== null) {
    const resp = await window.api.saveProject(state, currentProjectPath);
    if (resp.ok) setLastSaved({ ...snapshotFields });  // clears dirty
  } else {
    const skeletonDir = summary.skeletonPath.replace(/[\\/][^\\/]+$/, '') || '.';
    const basename = summary.skeletonPath.split(/[\\/]/).pop()?.replace(/\.json$/, '') ?? 'Untitled';
    const resp = await window.api.saveProjectAs(state, skeletonDir, basename);
    if (resp.ok) {
      setCurrentProjectPath(resp.path);
      setLastSaved({ ...snapshotFields });
    }
  }
}, [summary, overrides, currentProjectPath /*, samplingHz, etc. */]);
```

**Modal mount — copy idiom from `OverrideDialog` mount at lines 407-417 + `ConflictDialog` at lines 443-451:**

```typescript
// Source: src/renderer/src/components/AppShell.tsx:443-451
{conflictState !== null && (
  <ConflictDialog
    open={true}
    conflicts={conflictState.conflicts}
    onCancel={onConflictCancel}
    // ...
  />
)}

// Phase 8 SaveQuitDialog mount — same shape:
{saveQuitDialogState !== null && (
  <SaveQuitDialog
    open={true}
    reason={saveQuitDialogState.reason}
    basename={currentProjectPath ? path.basename(currentProjectPath) : null}
    onSave={async () => {
      await onClickSave();
      saveQuitDialogState.pendingAction();
      setSaveQuitDialogState(null);
    }}
    onDontSave={() => {
      saveQuitDialogState.pendingAction();
      setSaveQuitDialogState(null);
    }}
    onCancel={() => setSaveQuitDialogState(null)}
  />
)}
```

**Stale-override banner — render conditionally above `<main>`:**

```typescript
{staleOverrideNotice !== null && staleOverrideNotice.length > 0 && (
  <div role="status" className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted">
    <span>
      {staleOverrideNotice.length} saved override{staleOverrideNotice.length === 1 ? '' : 's'} skipped — attachments no longer in skeleton:{' '}
      {staleOverrideNotice.slice(0, 5).join(', ')}
      {staleOverrideNotice.length > 5 ? ` + ${staleOverrideNotice.length - 5} more` : ''}
    </span>
    <button
      type="button"
      onClick={() => setStaleOverrideNotice(null)}
      className="ml-2 text-xs text-fg-muted hover:text-fg"
    >
      Dismiss
    </button>
  </div>
)}
```

**Sort column key strings — copy from `GlobalMaxRenderPanel.tsx:66-73`:**

```typescript
// Source: src/renderer/src/panels/GlobalMaxRenderPanel.tsx:66-73
type SortCol = 'attachmentName' | 'skinName' | 'sourceW' | 'worldW' | 'peakScale' | 'animationName' | 'frame';
type SortDir = 'asc' | 'desc';
```

ProjectFileV1.sortColumn must be one of these literal strings (D-91 default `'attachmentName'`).

---

### `src/renderer/src/components/DropZone.tsx` (MODIFIED — branch on extension)

**Self-extend.** Existing extension check at lines 81-90.

**Existing pattern — copy from `src/renderer/src/components/DropZone.tsx:81-90`:**

```typescript
// Source: src/renderer/src/components/DropZone.tsx:81-90
if (!file.name.toLowerCase().endsWith('.json')) {
  onLoad(
    {
      ok: false,
      error: { kind: 'Unknown', message: `Not a .json file: ${file.name}` },
    },
    file.name,
  );
  return;
}

onLoadStart(file.name);
const resp = await window.api.loadSkeletonFromFile(file);
onLoad(resp, file.name);
```

**Phase 8 extension — branch on extension:**

```typescript
const lower = file.name.toLowerCase();
if (lower.endsWith('.stmproj')) {
  // New project-file path. Dirty-guard pre-check is the parent's
  // responsibility — pass the action up via onProjectDrop callback.
  onProjectDropStart(file.name);
  // Preload resolves the absolute path via webUtils.getPathForFile
  // (same as loadSkeletonFromFile per RESEARCH §Pitfall 5).
  const resp = await window.api.openProjectFromFile(file);
  onProjectDrop(resp, file.name);
  return;
}
if (lower.endsWith('.json')) {
  // Existing skeleton-load path — preserved.
  onLoadStart(file.name);
  const resp = await window.api.loadSkeletonFromFile(file);
  onLoad(resp, file.name);
  return;
}
// Other → existing rejection.
onLoad(
  { ok: false, error: { kind: 'Unknown', message: `Not a .json or .stmproj file: ${file.name}` } },
  file.name,
);
```

**New props on DropZoneProps:** `onProjectDrop`, `onProjectDropStart` (mirror existing `onLoad`, `onLoadStart`).

---

### `tests/arch.spec.ts` (MODIFIED — optional extension)

**Self-extend.** Existing core-import grep at lines 116-134.

**No change strictly required** — the existing grep block at line 118 (`globSync('src/core/**/*.ts')`) auto-scans `src/core/project-file.ts` once it lands. The forbidden-import regex at line 128 already blocks `sharp`, `node:fs`, `node:fs/promises`, `fs`, `fs/promises`. The grep does NOT block `node:path` or `electron` (currently).

**Optional Phase 8 extension** — add `electron` to the forbidden list AND add an explicit project-file.ts hygiene check:

```typescript
// Source: tests/arch.spec.ts:128 (existing regex)
if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]fs(\/promises)?['"]/.test(text)) {

// Phase 8 (recommended) — add electron to the same regex:
if (/from ['"]sharp['"]|from ['"]node:fs(\/promises)?['"]|from ['"]fs(\/promises)?['"]|from ['"]electron['"]/.test(text)) {
```

The existing test message at line 132 (`Core files importing sharp/node:fs:`) should be updated to `Core files importing sharp/node:fs/electron:` to keep the assertion error self-documenting.

**No new test block required** — the existing grep + the new project-file.spec.ts hygiene block (described above) cover the boundary at two layers.

---

## Shared Patterns

### Pattern A: Hand-rolled validator returning typed envelope (D-156)

**Source:** `src/main/ipc.ts:92-112` (`validateExportPlan`).
**Apply to:** `src/core/project-file.ts` `validateProjectFile`.
**Difference:** the project-file validator returns a **discriminated `{ok, project}` envelope** (richer than `validateExportPlan`'s `string | null`) because the schema-version error is a different recovery path than a shape error — UX needs the discriminator.

### Pattern B: Atomic file write `<path>.tmp` + `fs.rename`

**Source:** `src/main/image-worker.ts:255-304` (verbatim try/catch idiom).
**Apply to:** `src/main/project-io.ts` `handleProjectSave` / `handleProjectSaveAs`.
**Same-directory rule:** ALWAYS write tmp in the same directory as the final path → same filesystem → `rename` is atomic on POSIX, best-effort on Windows. Cross-volume rename returns EXDEV; Phase 8 user-picks the save location so cross-volume is impossible by construction.

### Pattern C: Hand-rolled ARIA modal + shared `useFocusTrap`

**Source:** `src/renderer/src/modals/OverrideDialog.tsx:60-171` + `src/renderer/src/hooks/useFocusTrap.ts:100-190`.
**Apply to:** `src/renderer/src/modals/SaveQuitDialog.tsx` (NEW).
**Cookbook:**
1. `dialogRef = useRef<HTMLDivElement>(null)`.
2. `useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel })`.
3. Outer `<div role="dialog" aria-modal="true" aria-labelledby="..." className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={props.onCancel}>`.
4. Inner `<div className="bg-panel border border-border rounded-md p-6 ..." onClick={(e) => e.stopPropagation()}>`.
5. Footer `<div className="flex gap-2 mt-6 justify-end">` containing the buttons.
6. Primary button = `bg-accent text-panel font-semibold`; secondary buttons = `border border-border text-xs`.

### Pattern D: IPC envelope (D-10)

**Source:** `src/shared/types.ts:490-498` (`SerializableError` + `LoadResponse`) + `src/main/ipc.ts:225-260` (`handleSkeletonLoad` envelope shape).
**Apply to:** `SaveResponse`, `OpenResponse`, `LocateSkeletonResponse`, all five Phase 8 IPC handlers.
**Hard rule:** every IPC handler returns `{ok: true, ...} | {ok: false, error: SerializableError}`. Translate `SpineLoaderError.name` → `SerializableError.kind`; for new error classes (`ProjectFileNotFoundError`, etc.), extend the union and the `KNOWN_KINDS` set in `src/main/ipc.ts:57-61`.

### Pattern E: Map ↔ Object boundary (Pitfall 3)

**Source:** RESEARCH §Pitfall 3 (08-RESEARCH.md:578-595).
**Apply to:** `src/core/project-file.ts` `serializeProjectFile` / `materializeProjectFile`.
**Recipe:**
- Save: `Object.fromEntries(state.overrides)` → JSON.
- Load: `new Map(Object.entries(file.overrides))` → AppShell setState.
- IPC payloads NEVER carry Maps (file-top docblock `src/shared/types.ts:1-17` lock).

### Pattern F: Subscription with unsubscribe (preload)

**Source:** `src/preload/index.ts:126-132` (`onExportProgress`).
**Apply to:** `onCheckDirtyBeforeQuit` listener.
**Recipe:** wrap the handler in a local const; `ipcRenderer.on(channel, wrapped)`; return `() => ipcRenderer.removeListener(channel, wrapped)`. Listener identity preservation per RESEARCH §Pitfall 9 (08-RESEARCH.md, listener accumulation).

### Pattern G: Tailwind v4 literal-class discipline (Pitfall 8)

**Source:** every renderer component — see `AppShell.tsx:370-382`, `OverrideDialog.tsx:106-167`, `DropZone.tsx:111-115`.
**Apply to:** every new className in Phase 8.
**Hard rule:** every className is a string literal. No template interpolation. No concatenation. Conditional rendering via `clsx` with literal branches OR early-return null when `!props.open`.

### Pattern H: jsdom + Testing Library renderer test prelude

**Source:** `tests/renderer/atlas-preview-modal.spec.tsx:1-22`.
**Apply to:** `tests/renderer/save-load.spec.tsx` (NEW).
**Recipe:** first line `// @vitest-environment jsdom` (literal, NOT a JS comment in the wrong format). Then `import { afterEach, describe, expect, it, vi } from 'vitest'`; `import { cleanup, render, screen, fireEvent } from '@testing-library/react'`; `afterEach(cleanup)`. Stub `window.api` via `vi.stubGlobal('api', { ... })` in `beforeEach`.

### Pattern I: vi.mock electron + fs main-process test prelude

**Source:** `tests/main/ipc-export.spec.ts:19-71`.
**Apply to:** `tests/main/project-io.spec.ts` (NEW).
**Recipe:** `vi.mock('electron', () => ({ dialog: { ... }, ipcMain: { ... }, BrowserWindow: { ... }, app: { ... } }))`. Mock `node:fs/promises` with default-rejecting `access`. Inside `beforeEach`, `vi.clearAllMocks()` then `vi.mocked(fsPromises.access).mockReset().mockRejectedValue(new Error('ENOENT'))` (per the prior-test impl-leak warning at lines 60-71).

---

## No Analog Found

**None.** Phase 8 is a pure-extension phase — every architectural primitive needed is shipped, tested, and proven by Phases 1–7. The only "novel" patterns (window-level Cmd+S/O listener with modal suppression, Electron `before-quit` async dance) are derived from authoritative external docs (RESEARCH §Pitfall 1 + §Pattern 4) rather than re-using a project analog, but neither requires inventing a new internal pattern — both compose existing primitives (useEffect + window.addEventListener; ipcMain.on + setTimeout).

---

## Metadata

**Analog search scope:**
- `src/core/**/*.ts` (12 files scanned)
- `src/main/**/*.ts` (6 files scanned)
- `src/renderer/src/**/*.{ts,tsx}` (24 files scanned)
- `src/shared/types.ts`
- `src/preload/index.ts`
- `tests/**/*.spec.{ts,tsx}` (16 files scanned, including the new tests/renderer/ folder)

**Files scanned with line excerpts captured:** 12
**Pattern extraction date:** 2026-04-25

**Verified read inline (file:line):**
- `src/main/ipc.ts:1-500` (validateExportPlan, handleSkeletonLoad, handlePickOutputDirectory, registerIpcHandlers)
- `src/main/image-worker.ts:1-80, 220-326` (atomic write + imports)
- `src/main/index.ts:1-132` (lifecycle, protocol, app.whenReady)
- `src/preload/index.ts:1-160` (full file, contextBridge api object)
- `src/shared/types.ts:1-571` (full file, all existing IPC contracts)
- `src/renderer/src/modals/OverrideDialog.tsx:1-171` (full file, ARIA scaffold)
- `src/renderer/src/hooks/useFocusTrap.ts:1-190` (full file, focus trap contract)
- `src/renderer/src/components/AppShell.tsx:1-507` (full file, toolbar + state + modal mount)
- `src/renderer/src/components/DropZone.tsx:1-122` (full file, extension check)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:60-85` (sort column keys)
- `src/core/overrides.ts:1-101` (full file, pure-TS module shape)
- `src/core/loader.ts:1-60` (loader entry + imports)
- `tests/arch.spec.ts:1-134` (full file, Layer 3 grep)
- `tests/main/ipc-export.spec.ts:1-180` (vi.mock recipes, dialog mocks, re-entrancy test)
- `tests/core/ipc.spec.ts:1-75` (handler-extraction discipline)
- `tests/core/overrides.spec.ts:1-80` (parity + hygiene block)
- `tests/renderer/atlas-preview-modal.spec.tsx:1-220` (jsdom prelude + Testing Library)
