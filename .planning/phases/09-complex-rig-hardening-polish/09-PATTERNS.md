# Phase 9: Complex-rig hardening + polish — Pattern Map

**Mapped:** 2026-04-26
**Files analyzed:** 19 (8 new + 11 modified)
**Analogs found:** 17 / 19 (2 greenfield: virtualization JSX swap)

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `src/main/sampler-worker.ts` (NEW) | worker (Node `worker_threads`) | request-response across postMessage | `src/main/image-worker.ts` (orchestration only — image-worker is a same-process async function, NOT a real Worker) | role-match (NEW worker_threads plumbing on top of mirrored protocol) |
| `src/main/sampler-worker-bridge.ts` (NEW; planner may inline in `project-io.ts`) | main-process bridge / orchestrator | spawn-and-wait + progress relay + cancel | `src/main/ipc.ts:471-482` (`runExport` invocation site with progress callback + cancel-flag closure) | role-match |
| `src/main/ipc.ts` (MOD) | IPC handler | one-way fire-and-forget channels | `src/main/ipc.ts:104-105, 474-479, 515-519` (existing `'export:progress'` + `'export:cancel'`) | exact (same file, same channel shape) |
| `src/preload/index.ts` (MOD) | preload bridge | listener-identity-preserved subscription + fire-and-forget send | `src/preload/index.ts:113-115, 126-132` (existing `cancelExport` + `onExportProgress`) | exact |
| `src/main/project-io.ts` (MOD lines 437-441 + 640-643) | main-process orchestrator | refactored sample call sites | self (`:437-441`, `:640-643`) — the existing in-thread `sampleSkeleton` call sites ARE the "before" excerpt | exact (in-place refactor) |
| `src/renderer/src/components/AppShell.tsx` (MOD) | React component (header + state machine) | useEffect IPC subscription + spinner UI + cancel hook | `src/renderer/src/components/AppShell.tsx` (existing `samplingHz` plumbing + filename chip at `:789-797`) + `src/preload/index.ts:126-132` subscription contract | partial (no existing `onExportProgress` subscription in AppShell — preload has the bridge; AppShell wires it for the first time here) |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MOD) | React panel (table) | greenfield TanStack Virtual integration with threshold gate | self (`:683-775` flat-table JSX is the "before" excerpt) | greenfield (no virtualization analog in repo) |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (MOD) | React panel (collapsible cards) | greenfield per-card inner-list virtualization | self (`:459-578` `BreakdownTable` is the "before" excerpt) | greenfield |
| `src/renderer/src/components/SearchBar.tsx` (MOD or no-change) | React component | input filter — must continue to work in virtualized path | self (already correct — filter happens BEFORE the virtualizer; no behavioral change) | exact (no diff expected) |
| `src/renderer/src/modals/SettingsDialog.tsx` (NEW) | React modal | controlled input → applies to AppShell `samplingHz` state | `src/renderer/src/modals/OverrideDialog.tsx:60-171` | exact |
| `src/renderer/src/modals/HelpDialog.tsx` (NEW) | React modal | static content + external links via `shell.openExternal` | `src/renderer/src/modals/OverrideDialog.tsx:60-171` (modal shape) + `src/preload/index.ts:138-140` (`openOutputFolder` for the `shell.openExternal` bridge precedent) | role-match |
| `src/renderer/src/components/RigInfoTooltip.tsx` (NEW; planner may inline into AppShell filename chip) | React component (tooltip) | hover surface displaying `summary` + `skeleton.fps` | `src/renderer/src/components/AppShell.tsx:789-797` (existing `title=…` hover surface on the filename chip) | partial (existing pattern is HTML `title` only; rig-info-tooltip needs richer multiline content — small new CSS-only tooltip OR inline JSX expansion) |
| `package.json` (MOD) | config | runtime dependency add | self (`dependencies` block — sharp + spine-core already there) | exact |
| `tests/main/sampler-worker.spec.ts` (NEW) | test (vitest, in-thread function-extract + one Worker spawn smoke) | runs worker logic without spawning real Worker (cases a-d) + one end-to-end Worker spawn | `tests/main/image-worker.spec.ts:34-43` (mock setup + direct `runExport` invocation) | exact |
| `tests/main/sampler-worker-girl.spec.ts` (NEW) | test (vitest, integration wall-time gate) | spawns real Worker against `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`; asserts <8000 ms with warm-up | `tests/main/image-worker.integration.spec.ts` (real-bytes integration, no mocks; closest existing analog) | role-match |
| `tests/main/ipc.spec.ts` (MOD — extension) | test (vitest) | extends with `'sampler:progress'` emit + `'sampler:cancel'` handler registration cases | self (`tests/main/ipc.spec.ts:25-77` Map-backed `ipcMain.on` captor) | exact |
| `tests/renderer/global-max-virtualization.spec.tsx` (NEW) | test (vitest + @testing-library/react, jsdom) | DOM-count assertion under/over threshold; sort/search/checkbox preservation | `tests/renderer/atlas-preview-modal.spec.tsx` (jsdom + Testing Library shape) | role-match |
| `tests/renderer/anim-breakdown-virtualization.spec.tsx` (NEW) | test (vitest + Testing Library, jsdom) | outer cards in regular DOM; inner virtualization above threshold; collapse/expand; OverrideDialog mount from virtualized row | `tests/renderer/atlas-preview-modal.spec.tsx` | role-match |
| `tests/renderer/settings-dialog.spec.tsx` (NEW) | test (Testing Library) | dropdown 60/120/240 + custom; clamp; dirty derivation | `tests/renderer/atlas-preview-modal.spec.tsx` (modal jsdom shape) | role-match |
| `tests/renderer/rig-info-tooltip.spec.tsx` (NEW) | test (Testing Library) | hover → tooltip content includes `skeleton.fps: N (editor metadata — does not affect sampling)` | `tests/renderer/atlas-preview-modal.spec.tsx` | role-match |
| `tests/renderer/help-dialog.spec.tsx` (NEW) | test (Testing Library) | menu click mounts dialog; `shell.openExternal` mocked + asserted on link click | `tests/renderer/atlas-preview-modal.spec.tsx` + `tests/main/ipc.spec.ts` mock pattern | role-match |
| `tests/arch.spec.ts` (MOD — extension) | test (vitest grep) | new `describe` block guarding `src/main/sampler-worker.ts` against renderer / react / electron / DOM-globals imports | self (`tests/arch.spec.ts:19-34` boundary grep + `:136-154` Phase 8 named-anchor block) | exact |

---

## Pattern Assignments

### `src/main/sampler-worker.ts` (NEW — worker, request-response)

**Analog:** `src/main/image-worker.ts` (the canonical worker pattern at the **orchestration layer**, but image-worker is a **same-process async function** — `grep -rn worker_threads src/` returns empty. Phase 9 introduces the project's first true `worker_threads` Worker. The protocol shape mirrors Phase 6; the spawn / `parentPort` plumbing is greenfield.)

**Imports pattern** (`image-worker.ts:56-65`):
```ts
import sharp from 'sharp';
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
import { dirname, resolve as pathResolve, relative as pathRelative, isAbsolute } from 'node:path';
import type {
  ExportError,
  ExportPlan,
  ExportProgressEvent,
  ExportSummary,
} from '../shared/types.js';
```

For the sampler worker, the Phase 9 imports differ — they MUST include `node:worker_threads` (greenfield) and the existing `loadSkeleton` + `sampleSkeleton` from `core/`:
```ts
// NEW shape — greenfield (no in-repo precedent for parentPort/workerData):
import { parentPort, workerData } from 'node:worker_threads';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';
import type { SerializableError } from '../shared/types.js';
```

**File-level comment style** (mirror `image-worker.ts:1-55` — block comment naming the phase, the function exported, the I/O contract, and the Layer 3 invariant). Mention the byte-frozen-sampler trade-off explicitly per RESEARCH §Recommendations #2: cooperative cancel flag is wired but Phase 9 effectively cancels via `worker.terminate()`.

**Cooperative cancel flag** (mirror `image-worker.ts:97-103`):
```ts
// src/main/image-worker.ts:97-103 — between-iteration cooperative cancel
for (let i = 0; i < plan.rows.length; i++) {
  // D-115: cooperative cancel between files. In-flight cannot be aborted
  // mid-libvips; this check at the top of every iteration is the contract.
  if (isCancelled()) {
    bailedOnCancel = true;
    break;
  }
  ...
}
```

For the sampler worker, the corresponding shape is a module-level `cancelled` flag set by `parentPort.on('message', msg => { if (msg?.type === 'cancel') cancelled = true; })`. The flag is checked BEFORE and AFTER the single `sampleSkeleton(load, { samplingHz })` call only — sampler is byte-frozen (D-102) so there is no inner-loop emit point. Forceful cancellation comes from the bridge's `worker.terminate()`.

**Discriminated-union postMessage protocol** (NEW for Phase 9; modeled on the `ExportProgressEvent` / `ExportError` discriminated unions at `src/shared/types.ts`):
```ts
// Worker → main:
{ type: 'progress', percent: number }
{ type: 'complete', output: SamplerOutput }
{ type: 'cancelled' }
{ type: 'error', error: SerializableError }
// Main → worker:
{ type: 'cancel' }
```

**Error envelope** (mirror Phase 6 D-10 SerializableError pattern in `ipc.ts:88-94`):
```ts
// src/main/ipc.ts:88-94 — KnownErrorKind narrowing for the typed envelope
type KnownErrorKind = Exclude<SerializableError['kind'], 'SkeletonNotFoundOnLoadError'>;

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);
```

The worker catches loader/sampler errors and posts `{ type: 'error', error: { kind, message } }` — never a stack trace (T-01-02-02 information-disclosure mitigation).

**What differs from the analog:**
- `image-worker.ts` is invoked as `await runExport(plan, outDir, onProgress, isCancelled, allowOverwrite)` from the **same** process. No `new Worker(...)` is spawned anywhere in repo.
- Phase 9 actually instantiates `new Worker(workerPath, { workerData: { skeletonPath, atlasRoot, samplingHz } })` from the bridge.
- The worker file uses `parentPort.on('message', …)` + `parentPort.postMessage(...)` — greenfield API surface in this codebase.
- Path-based protocol per D-193: SkeletonData NEVER crosses the boundary (Pitfall 4 — class instances lose their prototype across structured clone). Worker calls `loadSkeleton` itself.

---

### `src/main/sampler-worker-bridge.ts` (NEW — bridge / orchestrator) — planner may inline in `project-io.ts`

**Analog:** `src/main/ipc.ts:471-482` (the `runExport` invocation site inside `handleStartExport`). This is the closest existing example of "fire a long-running job + relay progress events back to the renderer + handle cancel-flag closure."

**Progress emission via `evt.sender.send`** (`ipc.ts:471-482`):
```ts
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

**For Phase 9** — the bridge differs in two ways:
1. **No `evt` available.** project-io.ts call sites (`:440`, `:641`) are inside `handleProjectOpenFromPath` / `handleProjectReloadWithSkeleton` which receive plain `_evt` from `ipcMain.handle` but currently do not surface it through to the sampling step. Planner SHOULD pass `mainWindow.webContents` directly via the `BrowserWindow` import already in `ipc.ts:39`, OR thread an emitter callback through the project-io seam.
2. **`worker.terminate()` is the cancellation primitive** — not a flag closure. The cooperative `'cancel'` postMessage is wired but does nothing inside `sampleSkeleton` (byte-frozen). Per RESEARCH §Q5, the cancel IPC handler in `ipc.ts` calls `await worker?.terminate()`.

**Promise-wrapped Worker spawn** (greenfield — no existing analog):
```ts
function runSamplerInWorker(params: { skeletonPath, atlasRoot?, samplingHz },
  webContents: Electron.WebContents): Promise<{ type: 'complete', output } | { type: 'cancelled' } | { type: 'error', error }> {
  return new Promise((resolve) => {
    const worker = new Worker(workerPath, { workerData: params });
    samplerWorkerHandle = worker; // module-level for cancel
    worker.on('message', (msg) => {
      if (msg.type === 'progress') {
        try { webContents.send('sampler:progress', msg.percent); } catch {}
      } else {
        // complete / cancelled / error
        resolve(msg);
        worker.terminate();
        samplerWorkerHandle = null;
      }
    });
    worker.on('error', (err) => resolve({ type: 'error', error: { kind: 'Unknown', message: err.message } }));
    worker.on('exit', () => { samplerWorkerHandle = null; });
  });
}
```

**Module-level cancel state** (mirror `ipc.ts:104-105`):
```ts
// src/main/ipc.ts:104-105
let exportInFlight = false;
let exportCancelFlag = false;
```

Phase 9 parallel: `let samplerWorkerHandle: Worker | null = null;` — the cancel handler does `samplerWorkerHandle?.terminate(); samplerWorkerHandle = null`. (Cooperative flag is wired in the worker but unused for actual cancellation in Phase 9.)

---

### `src/main/ipc.ts` (MOD — IPC handler, fire-and-forget channels)

**Analog:** self — `src/main/ipc.ts:515-519` (existing `'export:cancel'`) and `:474-479` (existing `'export:progress'` emission inside `handleStartExport`).

**Channel registration excerpt** (`ipc.ts:512-519`):
```ts
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite) =>
  handleStartExport(evt, plan, outDir, overwrite === true),
);
ipcMain.on('export:cancel', () => {
  // D-115: cooperative cancel. Flag is read on every iteration of the
  // runExport loop between files. In-flight cannot be aborted mid-libvips.
  exportCancelFlag = true;
});
```

**Phase 9 additions** (mirror byte-for-byte; channel renames only):
```ts
// NEW — D-194
ipcMain.on('sampler:cancel', () => {
  // D-194: forceful cancel. Sampler is byte-frozen so cooperative
  // flag-checking inside sampleSkeleton is impossible. terminate() is
  // the actual cancellation mechanism (RESEARCH §Q5).
  void samplerWorkerHandle?.terminate();
  samplerWorkerHandle = null;
});
```

**No `'sampler:start'` channel** — the worker is spawned **internally** by `project-io.ts` during `handleProjectOpenFromPath` / `handleProjectReloadWithSkeleton`. Only the cancel channel is public IPC (RESEARCH §Pattern lineage).

**Progress emission shape** (mirrors `ipc.ts:474-479`):
```ts
// Phase 9 progress emitter (inside the bridge's worker.on('message') handler):
(percent) => {
  try { mainWindow.webContents.send('sampler:progress', percent); } catch { /* webContents gone */ }
}
```

**Trust-boundary input check pattern** (`ipc.ts:568-577` — `'menu:notify-state'` precedent for typeof-validating one-way payloads): N/A here because `'sampler:cancel'` has no payload.

---

### `src/preload/index.ts` (MOD — preload bridge, listener-identity preservation + fire-and-forget)

**Analog:** self — `src/preload/index.ts:113-115` and `:126-132`.

**Listener-identity preservation excerpt** (`preload/index.ts:126-132`):
```ts
onExportProgress: (handler) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
  ipcRenderer.on('export:progress', wrapped);
  return () => {
    ipcRenderer.removeListener('export:progress', wrapped);
  };
},
```

**Fire-and-forget cancel excerpt** (`preload/index.ts:113-115`):
```ts
cancelExport: (): void => {
  ipcRenderer.send('export:cancel');
},
```

**Phase 9 byte-for-byte mirrors** (channel/payload renames only):
```ts
// NEW — D-194
onSamplerProgress: (handler: (percent: number) => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, percent: number) => handler(percent);
  ipcRenderer.on('sampler:progress', wrapped);
  return () => {
    ipcRenderer.removeListener('sampler:progress', wrapped);
  };
},

cancelSampler: (): void => {
  ipcRenderer.send('sampler:cancel');
},
```

**Pitfall 9 (listener identity)**: the `wrapped` const MUST be captured BEFORE `ipcRenderer.on` so the unsubscribe closure references the same identity. Anonymous closures leak listeners (RESEARCH §Pitfall 5). This is enforced by mirroring the existing pattern verbatim.

**Type extension** — add `onSamplerProgress` and `cancelSampler` to the `Api` interface in `src/shared/types.ts`. The contextBridge expose surface is closed-list per `src/preload/index.ts:50` — methods not on the literal `api` object cannot be reached from the renderer.

---

### `src/main/project-io.ts` (MOD lines 437-441 + 640-643 — call-site refactor)

**Analog:** self — the existing in-thread sample call sites ARE the "before" excerpt.

**"Before" excerpt — `project-io.ts:437-441`** (inside `handleProjectOpenFromPath`):
```ts
  // 7. Re-sample. F9.2 "recomputes peaks". samplingHz threads from
  //    materializeProjectFile (D-146 default 120 when null on disk).
  const t0 = performance.now();
  const samplerOutput = sampleSkeleton(load, { samplingHz: materialized.samplingHz });
  const elapsedMs = Math.round(performance.now() - t0);
```

**"Before" excerpt — `project-io.ts:640-643`** (inside `handleProjectReloadWithSkeleton`):
```ts
  const t0 = performance.now();
  const samplerOutput = sampleSkeleton(load, { samplingHz });
  const elapsedMs = Math.round(performance.now() - t0);
  const summary = buildSummary(load, samplerOutput, elapsedMs);
```

**"After" shape (D-190 + D-193) — both sites become:**
```ts
  // Phase 9 D-190 — sampler offloaded to worker_threads. Path-based protocol
  // (D-193): worker calls loadSkeleton itself; SkeletonData never crosses
  // postMessage. The `load` variable above is preserved for buildSummary's
  // load-time metadata (skeletonPath, atlasPath, editorFps); only the
  // sampleSkeleton call is moved to the worker.
  const t0 = performance.now();
  const result = await runSamplerInWorker(
    { skeletonPath: <materialized.skeletonPath | a.newSkeletonPath>,
      atlasRoot: <materialized.atlasPath ?? undefined | undefined>,
      samplingHz: <materialized.samplingHz | samplingHz> },
    mainWindow.webContents,
  );
  if (result.type !== 'complete') {
    return { ok: false, error: result.type === 'cancelled'
      ? { kind: 'Unknown', message: 'Sampling cancelled.' }
      : result.error };
  }
  const samplerOutput = result.output;
  const elapsedMs = Math.round(performance.now() - t0);
```

**Critical preservations** (RESEARCH §Recommendations + D-102):
- The `load` object (skeleton + atlas) is still computed in main for `buildSummary` to read `skeletonPath`, `atlasPath`, `editorFps` (loader.ts:229). The worker re-loads the same JSON internally — the small duplication is the cost of D-193's no-circular-refs protocol (RESEARCH §Q3: <2% overhead vs sampling cost).
- `buildSummary(load, samplerOutput, elapsedMs)` signature unchanged.
- The F9.2 "recomputes peaks" contract block-comment at `:293-297` is preserved verbatim.

---

### `src/renderer/src/components/AppShell.tsx` (MOD — React component, useEffect + spinner UI + cancel hook)

**Analog:** self — the existing filename chip at `AppShell.tsx:789-797` is the closest "hover surface" precedent; the existing `samplingHz` plumbing at `:71/114/477/485/506-508` is already threaded end-to-end.

**Existing filename chip** (`AppShell.tsx:789-797`) — anchor for the rig-info tooltip:
```tsx
<span
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg"
  title={currentProjectPath ?? summary.skeletonPath}
>
  {isDirty ? '• ' : ''}
  {currentProjectPath
    ? currentProjectPath.split(/[\\/]/).pop() ?? 'Untitled'
    : 'Untitled'}
</span>
```

The `title=…` HTML attribute is the existing single-line tooltip surface. The Phase 9 rig-info tooltip needs multiline structured content; planner picks between (a) a tiny CSS-only `:hover` overlay (no new deps) or (b) a small `<RigInfoTooltip>` component that renders a positioned div on hover.

**`samplingHz` prop threading** (`AppShell.tsx:71, 114, 477, 485, 506-508`):
```tsx
// :71 — prop type
samplingHz?: number;
// :114 — default
samplingHz = 120,
// :477, :485 — flow into buildSessionState
samplingHz,
[summary.skeletonPath, summary.atlasPath, overrides, samplingHz],
// :506-508 — dirty derivation includes samplingHz
if (samplingHz !== lastSaved.samplingHz) return true;
```

**Phase 9 wiring expectations**:
1. **`useEffect` IPC subscription** (mirror Phase 8.2 `onMenuOpen` pattern, `AppShell.tsx` already has these subscriptions threaded — Phase 9 adds one more):
   ```ts
   useEffect(() => {
     const unsubscribe = window.api.onSamplerProgress((percent) => {
       // update sampling progress state — triggers spinner re-render
     });
     return unsubscribe; // Pitfall 9 cleanup
   }, []);
   ```
2. **Spinner UI** during sample-in-flight (planner picks placement; existing `staleOverrideNotice` banner at `:866-891` is the closest precedent for a transient header strip).
3. **Cancel hook** — when project-open is dispatched mid-sample (08.2 menu Open scenario), call `window.api.cancelSampler()` BEFORE dispatching the new open. Captured by RESEARCH §Specifics — D-194's cancellation token is the mechanism for the 08.2 menu-Open mid-sample case.

**Settings re-sample trigger** (RESEARCH §Pitfall 7):
```ts
useEffect(() => {
  // When samplingHz changes (Settings modal apply), re-dispatch the sample
  // via the worker bridge. Existing AppShell:506-508 already marks the
  // project dirty (D-145); this useEffect ensures the displayed peaks
  // refresh to match the new rate.
  // Implementation owns project-io re-entry — planner picks the seam.
}, [samplingHz, summary.skeletonPath]);
```

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MOD — greenfield virtualization)

**Analog:** self — the existing flat-table JSX at `:683-775` IS the "before" excerpt. **No virtualization analog exists in the codebase.**

**"Before" excerpt** (`GlobalMaxRenderPanel.tsx:682-775` abridged):
```tsx
<table className="w-full border-collapse">
  <thead>
    <tr className="bg-panel">
      <th scope="col" className="py-2 px-3 border-b border-border w-8">
        <SelectAllCheckbox visibleKeys={visibleKeys} selected={selected} onBulk={setSelected} />
      </th>
      <SortHeader col="attachmentName" label="Attachment" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
      <SortHeader col="skinName" label="Skin" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
      {/* … 5 more SortHeader columns … */}
    </tr>
  </thead>
  <tbody>
    {sorted.length === 0 && (
      <tr><td colSpan={8}>No attachments…</td></tr>
    )}
    {sorted.map((row) => (
      <Row
        key={row.attachmentKey}
        row={row}
        query={query}
        checked={selected.has(row.attachmentKey)}
        onToggle={handleToggleRow}
        onRangeToggle={handleRangeToggle}
        suppressNextChangeRef={suppressNextChangeRef}
        onJumpToAnimation={onJumpToAnimation}
        onOpenOverrideDialog={openDialog}
        selectedKeys={selectedAttachmentNames}
        isFlashing={isFlashing === row.attachmentName}
        registerRef={(el) => registerRowRef(row.attachmentName, el)}
      />
    ))}
  </tbody>
</table>
```

**"After" shape** (D-191 + D-195; threshold-gated TanStack Virtual swap per RESEARCH §Q1):
```tsx
const useVirtual = useMemo(() => sorted.length > 100, [sorted.length]);
const parentRef = useRef<HTMLDivElement>(null);
const getItemKey = useCallback((i: number) => sorted[i].attachmentKey, [sorted]);
const virtualizer = useVirtualizer({
  count: sorted.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 34,
  overscan: 20,
  getItemKey,
});

if (!useVirtual) {
  // existing flat-table JSX — UNCHANGED below threshold (preserves Cmd-F).
  return <table>…</table>;
}

return (
  <div ref={parentRef} style={{ height: '...', overflow: 'auto', overflowAnchor: 'none' }}>
    <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-panel">
          {/* SortHeader cells unchanged */}
        </thead>
        <tbody>
          {virtualizer.getVirtualItems().map((virtualRow, idx) => {
            const row = sorted[virtualRow.index];
            return (
              <Row
                key={row.attachmentKey}
                row={row}
                {/* … all existing props verbatim … */}
                style={{
                  // Per RESEARCH §Q1: translate basis is row's INITIAL position,
                  // not absolute scroll offset. The (idx * virtualRow.size)
                  // subtraction is required for <tr> rendering.
                  transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)`,
                }}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
```

**Pitfall 1** (RESEARCH): apply `position: sticky` to `<thead>`, NEVER to a `<tr>` inside `<tbody>` (transforms create stacking contexts that break sticky). RESEARCH §Recommendations #10.

**`overflowAnchor: 'none'`** on the outer scroll container (RESEARCH §Recommendations #11) — without this, the browser re-anchors scroll on sort/filter content-height changes.

---

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (MOD — greenfield per-card virtualization)

**Analog:** self — the existing `BreakdownTable` at `:459-578` is the "before" excerpt.

**"Before" excerpt** (`AnimationBreakdownPanel.tsx:459-578` abridged):
```tsx
function BreakdownTable({ rows, query, onOpenOverrideDialog }: BreakdownTableProps) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-panel">
          <th>Attachment</th>
          <th>Bone Path</th>
          <th>Source W×H</th>
          <th>Scale</th>
          <th>Peak W×H</th>
          <th>Frame</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.attachmentKey} className="border-b border-border hover:bg-accent/5">
            <td>{highlightMatch(row.attachmentName, query)}</td>
            <td title={row.bonePath.join(' → ')}>{truncateMidEllipsis(row.bonePath, 48)}</td>
            <td>{row.originalSizeLabel}</td>
            <td onDoubleClick={() => onOpenOverrideDialog(row)} title={…}>
              {row.effectiveScale.toFixed(3)}×
              {row.override !== undefined && <span> • {row.override}%</span>}
            </td>
            <td>{`${row.effExportW}×${row.effExportH}`}</td>
            <td>{row.frameLabel}</td>
            <td>
              <button onClick={() => onOpenOverrideDialog(row)}>Override Scale</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**"After" shape** (D-196: outer card list stays in regular DOM; inner row list virtualizes when `rows.length > 100`; RESEARCH §Q1 + Q10):
```tsx
function BreakdownTable({ rows, query, onOpenOverrideDialog }: BreakdownTableProps) {
  const useVirtual = rows.length > 100;
  const innerRef = useRef<HTMLDivElement>(null);
  const getItemKey = useCallback((i: number) => rows[i].attachmentKey, [rows]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => innerRef.current,
    estimateSize: () => 38, // RESEARCH §Recommendations #12 (taller — Bone Path can wrap)
    overscan: 10,
    getItemKey,
  });

  if (!useVirtual) {
    // existing flat-table JSX UNCHANGED — preserves Cmd-F + ResizeObserver-free render.
    return <table>…</table>;
  }

  return (
    <div ref={innerRef} style={{ maxHeight: '600px', overflowY: 'auto', overflowAnchor: 'none' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-panel">…</thead>
          <tbody>
            {virtualizer.getVirtualItems().map((virtualRow, idx) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.attachmentKey}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}  // ResizeObserver-driven exact measurement
                  style={{ transform: `translateY(${virtualRow.start - idx * virtualRow.size}px)` }}
                  className="border-b border-border hover:bg-accent/5"
                >
                  {/* all existing <td> cells verbatim — including the
                      OverrideDialog launcher button at the end */}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Critical**:
- `getItemKey` returns stable `row.attachmentKey` (RESEARCH §Pitfall 2 — index-based default keys cause measurement flicker; the cache invalidates on every re-mount of a collapsed/expanded card).
- `measureElement` ref on every `<tr>` for variable-height (Bone Path can wrap, override badge changes height).
- The OverrideDialog launcher button at the END of each row mounts identically inside the virtualized path — D-196 test case (d) verifies this.

---

### `src/renderer/src/components/SearchBar.tsx` (MOD or no-change)

**Analog:** self — current implementation is correct.

**Why no change is expected**: The SearchBar's `onChange` updates parent-owned `query` state. The parent panel filters `rows` by query BEFORE handing them to the virtualizer. The virtualizer renders only the filtered subset's window. **Filter happens upstream of virtualization** — no SearchBar change needed.

If the planner discovers a regression (e.g., scroll position jumps weirdly when query changes), the fix is on the panel side: call `virtualizer.scrollToIndex(0)` after a search-query change (RESEARCH §Q1 — "Scroll restoration on sort/filter").

---

### `src/renderer/src/modals/SettingsDialog.tsx` (NEW — modal)

**Analog:** `src/renderer/src/modals/OverrideDialog.tsx:60-171`.

**Imports + props pattern** (`OverrideDialog.tsx:47-58`):
```ts
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface OverrideDialogProps {
  open: boolean;
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
  onApply: (percent: number) => void;
  onClear: () => void;
  onCancel: () => void;
}
```

**Modal shape with focus trap + escape handling** (`OverrideDialog.tsx:60-108`):
```tsx
export function OverrideDialog(props: OverrideDialogProps) {
  const [inputValue, setInputValue] = useState(String(props.currentPercent));
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Document-level Escape + Tab cycle via shared hook.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });

  useEffect(() => {
    if (props.open) inputRef.current?.select();
  }, [props.open]);

  if (!props.open) return null;

  const apply = () => props.onApply(Number(inputValue));
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') apply();
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="override-title">{title}</h2>
        {/* … input + buttons … */}
      </div>
    </div>
  );
}
```

**Buttons row pattern** (`OverrideDialog.tsx:131-167`):
```tsx
<div className="flex gap-2 mt-6 justify-end">
  <button type="button" onClick={props.onCancel}
    className="border border-border rounded-md px-3 py-1 text-xs">
    Cancel
  </button>
  <button type="button" onClick={apply}
    className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold">
    Apply
  </button>
</div>
```

**Phase 9 SettingsDialog differences**:
- Props: `{ open, currentSamplingHz, onApply: (hz: number) => void, onCancel: () => void }`.
- Body: dropdown `60 / 120 / 240 / Custom…` + a hidden number input revealed when Custom is selected. Validation: positive integer, max 1000 (typo-safety per CONTEXT.md Claude's Discretion Settings recommendation).
- `aria-modal="true"` + `role="dialog"` — auto-picked up by 08.2 D-184 `modalOpen` derivation, no extra wiring.

---

### `src/renderer/src/modals/HelpDialog.tsx` (NEW — modal, static content)

**Analog:** `src/renderer/src/modals/OverrideDialog.tsx:100-108` (modal shell shape).

**External-link bridge (precedent)** — `src/preload/index.ts:138-140`:
```ts
openOutputFolder: (dir: string): void => {
  ipcRenderer.send('shell:open-folder', dir);
},
```

**`shell:open-folder` handler** in `src/main/ipc.ts:520-532`:
```ts
ipcMain.on('shell:open-folder', (_evt, dir) => {
  if (typeof dir === 'string' && dir.length > 0) {
    try {
      shell.showItemInFolder(dir);
    } catch { /* silent on bad paths */ }
  }
});
```

**Phase 9 HelpDialog requirements**:
- Same modal shell as OverrideDialog (`role="dialog"`, `aria-modal="true"`, focus trap).
- **Static React component for content** per RESEARCH §Recommendations #4 — NO markdown library (zero runtime footprint, zero XSS surface).
- External links via a new preload bridge `openExternalUrl(url: string): void` mirroring `openOutputFolder`'s shape, with a new `'shell:open-external'` ipcMain.on handler in `ipc.ts` calling `shell.openExternal(url)`.
- Sections per CONTEXT.md Claude's Discretion: "What this app does" / "How to load a rig" / "Reading the Global Max Render Source panel" / "Reading the Animation Breakdown panel" / "How to override a scale" / "How to optimize and export" / "Sampling rate (advanced) — `samplingHz` vs `skeleton.fps`".
- The last section MUST align with `src/core/sampler.ts:41-44` wording (the canonical project terminology) — RESEARCH §Recommendations #15 + #16.

---

### `src/renderer/src/components/RigInfoTooltip.tsx` (NEW; planner may inline into AppShell filename chip)

**Analog:** `src/renderer/src/components/AppShell.tsx:789-797` (existing `title=…` HTML hover surface on the filename chip).

**"Before" — existing single-line tooltip** (`AppShell.tsx:789-797`):
```tsx
<span
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg"
  title={currentProjectPath ?? summary.skeletonPath}
>
  {isDirty ? '• ' : ''}
  {currentProjectPath ? currentProjectPath.split(/[\\/]/).pop() ?? 'Untitled' : 'Untitled'}
</span>
```

**Phase 9 rig-info content** (RESEARCH §Recommendations #16; CONTEXT.md Claude's Discretion):
```
skeletonName: <basename of summary.skeletonPath>
bones:        <summary.bones.count>
slots:        <summary.slots.count>
attachments:  <summary.attachments.count>
animations:   <summary.animations.count>
skins:        <summary.skins.count>
skeleton.fps: <editorFps> (editor metadata — does not affect sampling)
```

**Source surfaces:**
- Counts come from the existing `summary` shape (already passed to AppShell).
- `skeleton.fps` comes from `loader.ts:225-229` (`editorFps = skeletonData.fps || 30`). The summary may need a one-line extension to carry `editorFps` through to the renderer (RESEARCH §Recommendations #16: "verify in `src/main/summary.ts` if not threading; planner picks the seam").

**Implementation choice (planner discretion)**:
- (a) **CSS-only tooltip** — small absolutely-positioned `<div>` shown via `:hover` selector, no JS. Smallest footprint.
- (b) **Tiny `<RigInfoTooltip>` component** — controlled hover state with a positioned div (`useState` for `isHovered`). Slightly larger, easier to test.

The terminology "(editor metadata — does not affect sampling)" is **load-bearing** — it must align with `src/core/sampler.ts:41-44` (CLAUDE.md fact #1; RESEARCH §Specifics).

---

### `package.json` (MOD — config)

**Analog:** self — `dependencies` block.

**"After" diff:**
```json
{
  "dependencies": {
    "@spine/spine-core": "...",
    "sharp": "...",
    "@tanstack/react-virtual": "^3.13.24"   // NEW (D-192)
  }
}
```

Version verified 2026-04-26 via npm registry (RESEARCH §Library + API). Headless React virtualizer; ~6 KB gzipped; supports variable-height items via `measureElement`.

---

### `tests/main/sampler-worker.spec.ts` (NEW — vitest)

**Analog:** `tests/main/image-worker.spec.ts:34-43` (mock setup) + `:132-235` (case structure).

**Mock setup pattern** (`image-worker.spec.ts:34-62`):
```ts
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

vi.mock('sharp', () => { /* … */ });
vi.mock('node:fs/promises', () => ({ access: vi.fn(), … }));
```

**Test pattern (function-extract — Phase 6's strategy per RESEARCH §Pattern lineage)** — `image-worker.spec.ts:132-142`:
```ts
describe('runExport — case (a) all-success (D-114, F8.5)', () => {
  it('emits N progress events all status=success, summary has 0 errors, successes=N', async () => {
    const events: ExportProgressEvent[] = [];
    const plan = buildPlan(3);
    const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
    expect(events.length).toBe(3);
    expect(events.every((e) => e.status === 'success')).toBe(true);
    expect(summary.successes).toBe(3);
    expect(summary.errors.length).toBe(0);
    expect(summary.cancelled).toBe(false);
  });
});
```

**Phase 9 strategy** (RESEARCH §Pattern lineage; §Recommendations #7):
1. Extract the worker's message-handler body into an exported plain async function `runSamplerJob({ skeletonPath, atlasRoot, samplingHz, onProgress, isCancelled })` and unit-test it WITHOUT spawning a Worker. Mirrors image-worker's `runExport` strategy exactly.
2. Cases (a) byte-identical-vs-in-thread, (b) progress events fire monotonic, (c) cancellation, (d) error path (missing path), (e) hygiene grep — all run via the function-extract seam.
3. **One end-to-end Worker spawn smoke test** — actually spawn `new Worker(...)` against `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, assert `{ type: 'progress' }` then `{ type: 'complete', output }` flow, and the output equals in-thread `sampleSkeleton(load)` byte-for-byte (Map-key parity, peakScale within `PEAK_EPSILON` per RESEARCH §Recommendations #13).

---

### `tests/main/sampler-worker-girl.spec.ts` (NEW — N2.2 wall-time gate)

**Analog:** `tests/main/image-worker.integration.spec.ts` (real-bytes integration; closest existing analog because it bypasses mocks and runs against fixtures).

**Pattern** (RESEARCH §Q8):
```ts
it('fixtures/Girl samples in <8000 ms (N2.2 gate, 2000 ms margin from 10000 ms)', async () => {
  // Warm-up run discarded — JIT compilation + V8 inline-cache stabilization.
  await runSamplerJob({ skeletonPath, atlasRoot, samplingHz: 120 });
  const t0 = performance.now();
  const result = await runSamplerJob({ skeletonPath, atlasRoot, samplingHz: 120 });
  const elapsed = performance.now() - t0;
  expect(result.type).toBe('complete');
  expect(elapsed, `Girl sample took ${elapsed.toFixed(0)} ms (budget 8000)`).toBeLessThan(8000);
});
```

**`.skipIf(env.CI)` clause permitted** if empirical CI variance exceeds budget — explicitly authorized by CONTEXT.md `<domain>` test plan.

---

### `tests/main/ipc.spec.ts` (MOD — extension)

**Analog:** self — `tests/main/ipc.spec.ts:25-77` Map-backed `ipcMain.on` captor.

**Captor pattern** (`ipc.spec.ts:25-56`):
```ts
const { buildFromTemplate, setApplicationMenu, ipcMainOnHandlers } = vi.hoisted(() => ({
  buildFromTemplate: vi.fn(),
  setApplicationMenu: vi.fn(),
  ipcMainOnHandlers: new Map<string, (evt: unknown, ...args: unknown[]) => void>(),
}));

vi.mock('electron', () => ({
  /* … */
  ipcMain: {
    on: vi.fn((channel: string, handler) => {
      ipcMainOnHandlers.set(channel, handler);
    }),
    handle: vi.fn(),
  },
  /* … */
}));
```

**Test pattern** (`ipc.spec.ts:101-114`):
```ts
describe('menu:notify-state IPC (D-181)', () => {
  it('rebuilds + reapplies menu via Menu.setApplicationMenu on every notify', async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('menu:notify-state');
    expect(handler).toBeDefined();
    await handler!({} as unknown, { canSave: true, canSaveAs: true, modalOpen: false });
    expect(setApplicationMenu).toHaveBeenCalled();
  });
});
```

**Phase 9 extensions**:
1. `'sampler:cancel'` handler registered (existence assertion + handler can be invoked without throwing).
2. `'sampler:progress'` event payload shape (verify via the bridge — when `worker.postMessage({ type: 'progress', percent: 50 })` arrives, `webContents.send('sampler:progress', 50)` fires).

The captor pattern transfers verbatim — only the channel name and assertion target change.

---

### `tests/renderer/global-max-virtualization.spec.tsx` (NEW)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx:1-18` (jsdom + Testing Library setup).

**Setup pattern** (`atlas-preview-modal.spec.tsx:1-22`):
```ts
// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { AtlasPreviewModal } from '../../src/renderer/src/modals/AtlasPreviewModal';
import type { SkeletonSummary, DisplayRow } from '../../src/shared/types';

afterEach(cleanup);
```

**Test pattern** (`atlas-preview-modal.spec.tsx:84-99`):
```ts
describe('AtlasPreviewModal — default view (D-135)', () => {
  it('opens with role=dialog labelled "Atlas Preview" + Optimized + 2048 active', () => {
    render(<AtlasPreviewModal open={true} summary={makeSummary()} … />);
    const dialog = screen.getByRole('dialog', { name: /atlas preview/i });
    expect(dialog).not.toBeNull();
    const optimizedBtn = screen.getByRole('button', { name: /^optimized$/i });
    expect(optimizedBtn.className).toMatch(/bg-accent/);
  });
});
```

**Phase 9 cases per CONTEXT.md `<domain>` "Tests"**:
- (a) below threshold (50 rows): `screen.getAllByRole('row').length === 51` (header + 50 data rows).
- (b) above threshold (200 rows): `screen.getAllByRole('row').length ≤ 60` (header + window of ~30 + overscan 20).
- (c) sort + search + per-row checkbox preservation in virtualized path.
- (d) sticky header — assert `<thead>` element's `getBoundingClientRect().top` stays at parent-relative 0 after scroll. (jsdom-limited: `scrollTop` mutation may need `Element.prototype.scrollTop` polyfill — RESEARCH §Q9.)

---

### `tests/renderer/anim-breakdown-virtualization.spec.tsx` (NEW)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx` (same jsdom + Testing Library setup).

**Phase 9 cases per CONTEXT.md `<domain>` "Tests"** (D-196):
- (a) outer card list renders ALL cards in regular DOM (16 cards present regardless of expand state).
- (b) expanded card with rows > 100 virtualizes its inner row list (DOM `<tr>` count ≤ 60 within the expanded card's body).
- (c) collapse + re-expand: filter query preserved across collapse/expand; planner-chosen scroll-reset policy holds (RESEARCH §Q10 recommends accepting scroll-reset on collapse/expand as the simpler policy).
- (d) `Override Scale` button still mounts OverrideDialog from a virtualized inner row (assert `screen.getByRole('dialog', { name: /override scale/i })` after click).

---

### `tests/renderer/settings-dialog.spec.tsx` (NEW)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx` (modal jsdom shape).

**Phase 9 cases**:
- Dialog opens with samplingHz selected; dropdown contains 60 / 120 / 240 / Custom.
- Selecting "Custom" reveals the number input.
- Non-positive integer rejected (input validation per Claude's Discretion).
- Apply → dispatched `onApply(hz)` → AppShell `samplingHz` updates → project marked dirty (D-145 derivation).

---

### `tests/renderer/rig-info-tooltip.spec.tsx` (NEW)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx`.

**Phase 9 cases**:
- Hover the filename chip → tooltip becomes visible (CSS `:hover` or React state).
- Tooltip content includes `skeleton.fps: <N> (editor metadata — does not affect sampling)` — string matched against the canonical wording from `src/core/sampler.ts:41-44`.
- Counts (bones / slots / attachments / animations / skins) match the synthesized `summary` shape.

---

### `tests/renderer/help-dialog.spec.tsx` (NEW)

**Analog:** `tests/renderer/atlas-preview-modal.spec.tsx` + `tests/main/ipc.spec.ts` mock pattern for `shell.openExternal`.

**Phase 9 cases**:
- Help-menu click triggers HelpDialog mount (mocked via `window.api.onMenu*` subscription firing in the test).
- HelpDialog shows the canonical sections (per CONTEXT.md Claude's Discretion: 7 sections).
- Click an external link → `window.api.openExternalUrl` fires (mocked) — assert `mockedOpenExternal.toHaveBeenCalledWith('https://...')`.

---

### `tests/arch.spec.ts` (MOD — Phase 9 named-anchor block)

**Analog:** self — `tests/arch.spec.ts:136-154` (Phase 8 named-anchor block for `src/core/project-file.ts`). RESEARCH §Validation Architecture explicitly recommends a named block for the worker.

**"After" — new block to add** (RESEARCH §Validation Architecture lines 608-619):
```ts
describe('Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces', () => {
  it('does not import from src/renderer/ or DOM types', () => {
    const filePath = 'src/main/sampler-worker.ts';
    let text = '';
    try {
      text = readFileSync(filePath, 'utf8');
    } catch {
      // File doesn't exist yet (Wave 1 lands it). When it lands the grep applies.
      return;
    }
    expect(text, `${filePath} must not import from src/renderer/`).not.toMatch(/from ['"][^'"]*\/renderer\//);
    expect(text, `${filePath} must not import from react`).not.toMatch(/from ['"]react['"]/);
    expect(text, `${filePath} must not import from electron`).not.toMatch(/from ['"]electron['"]/);
    expect(text, `${filePath} must not reference DOM globals`).not.toMatch(/document\.|window\./);
  });
});
```

**Why electron is forbidden in the worker** (RESEARCH §Validation Architecture line 620): workers run in a Node-only context with NO `BrowserWindow` or `webContents` — only `node:worker_threads` + Node primitives. Importing electron in the worker would fail at runtime.

The existing globSync at lines 19-34 covers `src/{main,preload,renderer}/**` for general Layer 3 — Phase 9 piggybacks on that AND adds the named anchor for PR-review visibility.

---

## Shared Patterns

### Cross-cutting: `worker.terminate()` is the cancellation primitive

**Source:** RESEARCH §Q5 + §Recommendations #2.

**Apply to:**
- `src/main/sampler-worker.ts` — wires the cooperative `'cancel'` postMessage protocol (dead in Phase 9 but documented for future-sampler compatibility).
- `src/main/sampler-worker-bridge.ts` — `'sampler:cancel'` IPC handler does `await samplerWorkerHandle?.terminate()`.
- `src/main/ipc.ts:515-519` — Phase 6 `'export:cancel'` is the shape mirror, but mechanism differs (Phase 6 is a between-files JS-loop flag; Phase 9 is `terminate()` because the sampler call is uninterruptible).
- `tests/main/sampler-worker.spec.ts` — cancel test asserts `performance.now() - terminateStart < 200` after `await worker.terminate()`.

**Pitfall 6 (RESEARCH)**: `terminate()` does NOT run finally blocks. Phase 9 worker has no cleanup obligations (pure compute job — no resource ownership) so this is safe.

---

### Cross-cutting: Listener-identity preservation (Pitfall 9)

**Source:** `src/preload/index.ts:126-132` (the canonical idiom).

**Apply to:** every `window.api.onSamplerProgress` registration.

```ts
const wrapped = (_evt, payload) => handler(payload);
ipcRenderer.on('channel', wrapped);
return () => ipcRenderer.removeListener('channel', wrapped);
```

**Pitfall 9 (RESEARCH §Pitfall 5):** anonymous closures leak listeners — `removeListener` compares by reference. The same idiom MUST be used inside `useEffect` cleanup in `AppShell.tsx`.

---

### Cross-cutting: Modal `aria-modal="true"` auto-suppresses menus

**Source:** Phase 8.2 D-184 — any modal with `[role="dialog"][aria-modal="true"]` mounted derives `modalOpen=true`, which is pushed to main via `notifyMenuState` and disables File menu items.

**Apply to:** `SettingsDialog.tsx` and `HelpDialog.tsx` — they mount with `role="dialog"` + `aria-modal="true"` (verbatim from `OverrideDialog.tsx:103-104`) and are auto-picked up. **No extra wiring needed.**

---

### Cross-cutting: Discriminated-union message protocol

**Source:** `src/shared/types.ts` (`ExportProgressEvent`, `ExportError`, `SerializableError`); RESEARCH §Pattern lineage.

**Apply to:**
- Worker → main: `{ type: 'progress' | 'complete' | 'cancelled' | 'error', …}`.
- Main → worker: `{ type: 'cancel' }`.
- Type-narrows cleanly in TypeScript switch statements.

---

### Cross-cutting: TanStack Virtual sticky-thead + variable-height + getItemKey

**Source:** RESEARCH §Library + API + §Q1 + §Pitfalls 1-2 + §Recommendations #9-12.

**Apply to:** both `GlobalMaxRenderPanel.tsx` and `AnimationBreakdownPanel.tsx`.

**Five non-negotiables:**
1. `position: sticky; top: 0; z-index: 1` on `<thead>` (NOT `<tr>` — Pitfall 1).
2. `overflow-anchor: none` on outer scroll container (Pitfall: scroll re-anchoring).
3. `getItemKey: useCallback((i) => rows[i].attachmentKey, [rows])` (Pitfall 2 — index-based default keys cause measurement flicker).
4. `transform: translateY(${virtualRow.start - idx * virtualRow.size}px)` per the official table example (NOT `virtualRow.start` directly — table-row translate basis is initial position).
5. `ref={virtualizer.measureElement}` on each `<tr>` for variable-height (AnimationBreakdownPanel) — ResizeObserver-driven exact measurement.

---

### Cross-cutting: Indeterminate spinner (NOT determinate progress bar)

**Source:** RESEARCH §Q4 + §Pitfall 3 + §Recommendations #3.

**Apply to:** `AppShell.tsx` sampling-progress UI.

**Why indeterminate:** sampler.ts is byte-frozen (D-102). A `setInterval`-based heartbeat in the worker can't fire mid-`sampleSkeleton` because the JS event loop is blocked by the synchronous sampler call. The worker emits only `{type:'progress', percent:0}` at start and `{type:'complete'}` at end — the gap is unobservable. CSS spinner / animated bar honestly conveys "I'm working" without a fake percentage.

---

### Cross-cutting: Trust-boundary input validation at every IPC entry

**Source:** `src/main/ipc.ts:125-145` (validateExportPlan), `:213-216` (typeof outDir), `:568-577` ('menu:notify-state' validation).

**Apply to:** any new IPC channel that takes a payload. (Phase 9's two new channels — `'sampler:progress'` and `'sampler:cancel'` — are both **payload-less or main → renderer**, so no new trust-boundary check needed. The internal worker spawn uses `workerData` which is structured-clone-safe and originates from main itself, not the renderer.)

---

## No Analog Found

Files with no close existing match — the planner uses RESEARCH.md patterns instead of an in-codebase mirror:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/main/sampler-worker.ts` (the actual `parentPort`/`workerData` plumbing) | worker (Node `worker_threads`) | postMessage protocol | No true `worker_threads` worker exists in repo (`grep -rn worker_threads src/` returns empty per RESEARCH §Overview). image-worker.ts is a same-process function. The protocol shape mirrors Phase 6; the spawn/lifecycle is greenfield Node `worker_threads` per RESEARCH §Q2. |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (the virtualizer integration) | greenfield virtualization | TanStack Virtual via `useVirtualizer` | No virtualization analog in repo. The "before" is the existing flat-table JSX (self-analog); the "after" follows the TanStack Virtual table example verbatim per RESEARCH §Q1. |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (the per-card inner virtualizer) | greenfield virtualization (variable-height) | TanStack Virtual + `measureElement` | Same — no virtualization analog. The variable-height variant follows the dynamic example per RESEARCH §Q1. |

---

## Metadata

**Analog search scope:**
- `src/main/` — image-worker.ts, ipc.ts, project-io.ts, index.ts, summary.ts, recent.ts (all confirmed read or grepped)
- `src/preload/index.ts` — full read
- `src/renderer/src/components/` — AppShell.tsx (filename chip + samplingHz plumbing + IPC subscription patterns), SearchBar.tsx, DropZone.tsx (existence noted)
- `src/renderer/src/panels/` — GlobalMaxRenderPanel.tsx (lines 683-775), AnimationBreakdownPanel.tsx (lines 459-578)
- `src/renderer/src/modals/` — OverrideDialog.tsx (full read), AtlasPreviewModal/OptimizeDialog/ConflictDialog/SaveQuitDialog (existence noted)
- `tests/main/` — image-worker.spec.ts (cases a-d structure), ipc.spec.ts (full read), arch.spec.ts (full read)
- `tests/renderer/` — atlas-preview-modal.spec.tsx (jsdom + Testing Library setup; only renderer test analog in repo)
- `src/core/` — read-only references for terminology source (sampler.ts:41-44 + loader.ts:225-229) — NOT a modification surface (Phase 5 D-102 byte-frozen)

**Files scanned:** ~14 source files + 4 test files + CONTEXT.md + RESEARCH.md
**Pattern extraction date:** 2026-04-26

## PATTERN MAPPING COMPLETE
