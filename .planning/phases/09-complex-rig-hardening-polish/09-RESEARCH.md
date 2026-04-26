# Phase 9: Complex-rig hardening + polish — Research

**Researched:** 2026-04-26
**Domain:** Node `worker_threads` cancellation; React virtualization (TanStack Virtual); Electron menu accelerators; markdown rendering for in-app help
**Confidence:** HIGH (TanStack Virtual + Pattern lineage); MEDIUM (worker_threads cancellation idiom — verified via Node.js docs, no project precedent yet); MEDIUM (markdown rendering — three viable shapes, planner picks)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-189**: `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` IS the N2.2 baseline gate. ~908 KB JSON (verified `ls -lh`). Always-runnable on local `npm run test`.
- **D-190**: Sampler worker built UNCONDITIONALLY — overrides ROADMAP "if profiling shows main-thread jank." Always offload `sampleSkeleton` to a `worker_threads` worker.
- **D-191**: Both panels virtualize, threshold-gated at N=100 rows.
- **D-192**: Library is `@tanstack/react-virtual` (current latest **v3.13.24** verified via `npm view @tanstack/react-virtual version` 2026-04-26 [VERIFIED: npm registry]). Headless, ~6 KB gzipped, variable-height support.
- **D-193**: Worker lives at `src/main/sampler-worker.ts`; **PATH-BASED** protocol — `{ skeletonPath, atlasRoot, samplingHz }` over postMessage; worker re-loads JSON inside the worker process. **`SkeletonData` NEVER crosses the postMessage boundary.**
- **D-194**: Worker emits `{ type: 'progress', percent }` events AND supports `'cancel'` message; renderer subscribes via `window.api.onSamplerProgress`. Mirrors Phase 6 export:progress/cancel exactly.
- **D-195**: Virtualization threshold = N=100 rows.
- **D-196**: AnimationBreakdownPanel — outer card list stays in regular DOM; per-card inner row list virtualizes when `card.rows.length > 100`.

### Claude's Discretion

The remaining three ROADMAP-named deliverables for Phase 9 default to planner discretion (CONTEXT.md §"Claude's Discretion"):

- **Settings modal (samplingHz exposure)** — minimum: a Settings modal with a samplingHz control (dropdown 60/120/240 + custom number, validates positive int, default 120 per CLAUDE.md fact #6). Lives in the menu surface from 08.2 D-188. Accelerator suggested `Cmd/Ctrl+,`.
- **Rig-info tooltip** — minimum: tooltip on the toolbar filename chip (Phase 8 D-144 surface) showing `skeleton.fps` extracted from `loader.ts:225-229` plus bones/slots/animations counts already available, with `skeleton.fps` clearly labeled `(editor metadata — does not affect sampling)`.
- **Documentation button** — minimum: a Help-menu item (08.2 placeholder per D-188) and/or toolbar `?` button that opens a single-page in-app help view (modal). Static markdown shipped in repo.
- **08.2 deferred polish triage** — User did not select this area. Default: NONE of the 08.2-routed polish items land in Phase 9 (OS file association, reopen-last-project, window state persistence, auto-save, native Quit-via-File→Exit on Win/Linux, macOS Help-menu search).

### Deferred Ideas (OUT OF SCOPE)

| Item | Source | Defer to |
|------|--------|----------|
| OS file association registration | 08.2 D-188 | Post-MVP polish phase |
| Reopen-last-project on launch | 08.2 D-188 | Post-MVP polish phase |
| Window state persistence (size + position) | 08.2 D-188 | Post-MVP polish phase |
| Auto-save / scratch-file crash recovery | 08.2 D-188 | Its own phase |
| Native Quit-via-File→Exit on Win/Linux | 08.2 D-188 | Post-MVP polish phase |
| macOS Help-menu search integration | 08.2 D-188 | Comes free with `role: 'help'`; not new work |
| Adaptive bisection refinement | ROADMAP | Post-MVP |
| `.skel` binary loader | ROADMAP / REQUIREMENTS.md | Post-MVP |
| Spine 5+ loader adapter | ROADMAP | Post-MVP |
| Aspect-ratio anomaly flag | ROADMAP | Post-MVP |
| In-app atlas re-packing | ROADMAP | Post-MVP |
| `scripts/cli.ts` changes | Phase 5 D-102 byte-frozen | Locked indefinitely |
| `src/core/sampler.ts` changes | Phase 5 D-102 byte-frozen + CLAUDE.md fact #2/#3 | Locked indefinitely |
| `src/core/project-file.ts` `.stmproj` schema changes | Phase 8 D-145 + 8.1 D-171 | Locked indefinitely |
| Settings: per-app persistence (settings.json) | Discretion — samplingHz is per-project | Until non-per-project setting needed |
| Toolbar gear icon for Settings (in addition to menu) | Discretion | Planner's call |
| Toolbar `?` button for Help (in addition to menu) | Discretion | Planner's call |
| Cancel button in the sampling progress UI | Discretion | Planner's call |
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **N2.2** | Complex rig (~80 attachments, ~16 animations) samples in <10 s on the main thread; move to worker if slower. | Worker-thread design (D-190/D-193/D-194 below); wall-time gate test design in Validation Architecture; Pattern lineage `image-worker.ts` shows the existing test envelope. fixtures/Girl is ~908 KB / 22,285 quote chars (≈ ~5× Jokerman) — verified via `ls` + `grep -c '"'`. |
| (polish) | Settings modal (samplingHz exposure) | Existing modal pattern (`OverrideDialog.tsx`) + `useFocusTrap` hook reused; menu accelerator `CommandOrControl+,` verified cross-platform. |
| (polish) | Rig-info tooltip | `loader.ts:229` (`editorFps = skeletonData.fps \|\| 30`) + existing `summary` shape supplies bone/slot/anim counts. |
| (polish) | Documentation in-app help | Three viable markdown approaches surveyed; planner picks. |
| (polish) | UI virtualization | `@tanstack/react-virtual` v3.13.24 with documented sticky-header + variable-height patterns. |
</phase_requirements>

---

## Overview

Phase 9 has one hard exit gate (**N2.2**: fixtures/Girl samples in <10 s with no dropped UI frames) and four polish deliverables. Eight design decisions are locked (D-189..D-196) — research focuses on **how** to implement them, not whether. Open questions are concrete API choices: TanStack Virtual's sticky-header + variable-height idioms, Node `worker_threads` cooperative cancellation pattern, postMessage cadence, markdown rendering size/safety tradeoff, and the wall-time test margin. The Phase 6 `image-worker.ts` is the orchestration template the Phase 9 worker mirrors — but image-worker is a same-thread function, **not** an actual `worker_threads` `new Worker(...)` (verified by `grep -rn worker_threads src/` returning empty). Phase 9 introduces the project's first true `worker_threads` worker; the IPC + postMessage protocol shape mirrors Phase 6, but the spawn/lifecycle code is new.

---

## Library + API research

### TanStack Virtual (`@tanstack/react-virtual` v3.13.24)

Version verified 2026-04-26 via `npm view @tanstack/react-virtual version` [VERIFIED: npm registry]. Headless React virtualizer (~6 KB gzipped). Imports: `useVirtualizer`, `defaultRangeExtractor`, type `Range`.

#### Sticky thead inside an internal scroll container — the GlobalMaxRenderPanel pattern

The official `react-table` example [CITED: tanstack.com/virtual/latest/docs/framework/react/examples/table] is the closest analog. Key shape:

```tsx
const parentRef = React.useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 34,
  overscan: 20,
  getItemKey: (index) => rows[index].attachmentKey, // stable key — see below
});

return (
  <div ref={parentRef} style={{ height: 600, overflow: 'auto' }}>
    <div style={{ height: virtualizer.getTotalSize() }}>
      <table>
        <thead /* sticky */ ><tr>...</tr></thead>
        <tbody>
          {virtualizer.getVirtualItems().map((virtualRow, index) => {
            const row = rows[virtualRow.index];
            return (
              <tr key={row.attachmentKey} style={{
                height: virtualRow.size,
                transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
              }}>
                ...
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);
```

**Critical mechanics:**
- The translate basis for tables is the **row's initial position** — not the absolute scroll offset. The `index * virtualRow.size` subtraction in `translateY` is documented in the example and is required for `<tr>` rendering [CITED: tanstack.com/virtual/latest/docs/framework/react/examples/table].
- Sticky `<thead>` works via plain CSS (`position: sticky; top: 0; z-index: 1`) on the `<thead>` inside the inner div. The virtualizer transforms only `<tr>` children of `<tbody>`, leaving `<thead>` untouched.
- `getScrollElement` MUST return the bounded scroll container (the outer `<div ref={parentRef}>` with explicit height + `overflow: auto`).

#### Variable-height — the AnimationBreakdownPanel inner-list pattern

For the per-card inner row list (D-196), each row's height varies (Bone Path can be long, override badges add height, highlightMatch can wrap). Use `measureElement` [CITED: tanstack.com/virtual/latest/docs/api/virtualizer.md]:

```tsx
const virtualizer = useVirtualizer({
  count: rows.length,
  getScrollElement: () => innerCardScrollRef.current,
  estimateSize: () => 38, // initial guess; measureElement refines
  overscan: 10,
  getItemKey: (i) => rows[i].attachmentKey,
});

// in render:
<tr
  key={virtualRow.key}
  data-index={virtualRow.index}
  ref={virtualizer.measureElement} // ← ResizeObserver-driven exact measurement
  style={{
    transform: `translateY(${virtualRow.start - index * virtualRow.size}px)`,
  }}
>
```

`measureElement` runs a ResizeObserver on each rendered element and caches the measurement keyed by `getItemKey(index)`. The cache survives unmount/remount (collapse → re-expand) **only if `getItemKey` returns stable identities** — that's why every row card MUST use `attachmentKey` (already used as the React key throughout the codebase per `panels/GlobalMaxRenderPanel.tsx:330` and `panels/AnimationBreakdownPanel.tsx:511`).

#### `overflowAnchor: 'none'` — required CSS

The dynamic example [CITED: tanstack.com/virtual/latest/docs/framework/react/examples/dynamic] sets:
```css
.scroll-container {
  overflow-y: auto;
  contain: strict;
  overflow-anchor: none;
}
```
Without `overflow-anchor: none`, browsers will re-anchor scroll position on content height changes (sort, filter), causing visible jumps.

#### `scrollToIndex` after sort/filter

Documented method on the virtualizer instance: `virtualizer.scrollToIndex(idx, { align: 'start' | 'center' | 'end', behavior: 'smooth' })` [CITED: tanstack.com/virtual/latest/docs/framework/react/examples/dynamic]. Useful for the existing focusAttachmentName jump (AppShell:126) — the planner SHOULD wire this so the jump still works in the virtualized path.

#### `getItemKey` — when omitted, defaults to index

Official guidance: "Memoize this function to prevent unnecessary recalculations of the measurement cache" [CITED: tanstack.com/virtual/latest/docs/api/virtualizer.md]. For both panels, supply `getItemKey: (index) => rows[index].attachmentKey` — wrapped in `useCallback`.

### Node `worker_threads` cancellation idiom (Node 22 LTS)

[CITED: nodejs.org/api/worker_threads.html, fetched 2026-04-26]

**No canonical AbortSignal pattern exists for arbitrary worker cancellation.** The Node docs document AbortSignal only for `locks.request()`, not for general worker workloads. The 2025-canonical pattern remains **flag-check at loop boundaries** + `worker.terminate()` as the forceful escape hatch.

| Mechanism | When to use | Latency | Cleanup |
|-----------|-------------|---------|---------|
| **Cooperative flag** (recommended) | Workloads with a tight inner loop and a natural batch boundary (e.g., per-attachment in `snapshotFrame`) | ≤ one batch boundary (≪ 200 ms for our case) | Worker can return final state, postMessage `{ type: 'cancelled' }`, exit cleanly |
| **`worker.terminate()`** | Forceful kill; nothing safe to clean up; or flag-check window too coarse | "Asynchronous; as soon as possible." Platform-dependent. Typically <50 ms for a JS-bound worker | NO cleanup; pending I/O / timers / finally blocks NOT guaranteed to run |
| **`AbortSignal`** (locks only) | `locks.request()` body | Native | Native |

**Caveat — chatty postMessage:** Node docs explicitly warn:
> "stdio output originating from a Worker can get blocked by synchronous code on the receiving end that is blocking the Node.js event loop."
> [CITED: nodejs.org/api/worker_threads.html §"Synchronous blocking of stdio"]

The doc's idiomatic example uses `if (i % 1000 === 0) parentPort.postMessage(...)` — i.e., batch progress every 1000 inner-loop iterations.

**Serialization:**
- ✅ Structured-clone-safe: `Map`, `Set`, circular refs, primitives, ArrayBuffer/TypedArray (with transfer caveats), `Date`, `RegExp`, `Error`.
- ❌ NOT serializable: class instances (lose prototype + private fields), getters, functions, native C++-backed objects.

This is the technical reason for **D-193 path-based protocol**: `SkeletonData` (Spine class instances with bone-bone-parent circular refs) would be serialized as a stripped plain object — losing methods. Re-loading the JSON inside the worker is the correct shape. [VERIFIED: nodejs.org/api/worker_threads.html §"Considerations when transferring TypedArrays and Buffers"]

### Markdown rendering options for in-app Help (planner discretion)

Three viable shapes, surveyed 2026-04-26 [VERIFIED: npm registry]:

| Approach | Footprint | Risk | Verdict |
|----------|-----------|------|---------|
| **Precompiled HTML** at build time (Vite `?raw` import + a build-step markdown→HTML transform, OR ship the HTML directly) | ~0 KB runtime | Zero XSS risk (we author the HTML) | **Recommended.** Smallest footprint; no Layer 3 surface; help content is static. |
| `marked` v18.0.2 + `dompurify` v3.4.1 | ~50 KB gz | XSS-safe via DOMPurify; well-maintained | Acceptable if planner wants live MD parsing for some reason (we don't — content is static). |
| `react-markdown` v10.1.0 | ~80 KB gz | Defaults to safe; pluggable | Overkill — we have one static help page, not a markdown rendering surface. |

**Layer 3 implication:** Whatever shape lands stays in `src/renderer/` (or as a build-time asset under `src/renderer/src/help/`). Never imports from `src/core/`. The `arch.spec.ts:19-34` grep already enforces this.

**Recommendation:** Author the help page as a static React component (or a precompiled HTML string from a `?raw` import). External links via `shell.openExternal` only. No new runtime dep.

### Electron accelerator `CommandOrControl+,`

[CITED: electronjs.org/docs/latest/tutorial/keyboard-shortcuts] — `CommandOrControl` resolves to `⌘` on macOS and `Ctrl` on Windows/Linux. The comma key is a single-character Electron accelerator name; `CommandOrControl+,` works cross-platform. Used in `src/main/index.ts:203/211/217` already (`CmdOrCtrl+O` / `CmdOrCtrl+S` / `CmdOrCtrl+Shift+S`) — same syntax. **No comma-specific gotchas documented.** [CITED: electronjs.org/docs/latest/tutorial/keyboard-shortcuts]

---

## Pattern lineage

The Phase 9 sampler worker mirrors the Phase 6 image-worker shape **at the IPC + protocol layer.** However, an important note: `src/main/image-worker.ts` is **NOT** an actual `worker_threads` worker — it's a same-process async function called serially by `handleStartExport` [VERIFIED: `grep -rn 'worker_threads\|new Worker' src/` returns empty]. Phase 9 introduces the project's first true `worker_threads` Worker. The orchestration shape (cancel flag, progress events, IPC channels) is borrowed verbatim from Phase 6; the worker spawn/`parentPort` plumbing is new.

### Excerpts from `src/main/ipc.ts` the planner mirrors

**Module-level cancel flag (image-worker.ts:96-105) — mirror for sampler:**
```ts
// src/main/ipc.ts:104-105 (Phase 6 inheritance)
let exportInFlight = false;
let exportCancelFlag = false;
```
Phase 9 adds parallel `samplerInFlight` + `samplerCancelFlag` (or, if planner opts for `worker.terminate()`, just a worker-handle ref). Reset in `finally`.

**Progress emission via `evt.sender.send` (ipc.ts:474-479) — mirror for sampler:**
```ts
// src/main/ipc.ts:474-479
(e) => {
  try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ }
},
```
Phase 9: `(percent) => { try { mainWindow.webContents.send('sampler:progress', percent); } catch {} }`. Note: project-io.ts call sites (lines 437-462 and 584-662) currently call `sampleSkeleton(load, { samplingHz })` synchronously and have no `evt` to hand — the planner SHOULD pass either `mainWindow.webContents` directly (via the `BrowserWindow` import already in ipc.ts) or thread an emitter callback through the project-io seam.

**Channel registration (ipc.ts:512-519) — mirror for sampler:**
```ts
// src/main/ipc.ts:512-519
ipcMain.handle('export:start', async (evt, plan, outDir, overwrite) =>
  handleStartExport(evt, plan, outDir, overwrite === true),
);
ipcMain.on('export:cancel', () => {
  exportCancelFlag = true;
});
```
Phase 9: `ipcMain.on('sampler:cancel', () => { samplerCancelFlag = true; /* or worker?.postMessage({type:'cancel'}) */ })`. NOTE: there is NO `'sampler:start'` handle channel — the worker is spawned **internally** by `project-io.ts` during `handleProjectOpenFromPath` / `handleProjectOpenSkeletonRecover`. Only the cancel channel is public IPC.

### Excerpts from `src/preload/index.ts` the planner mirrors

**Listener-identity preservation (preload/index.ts:126-132) — Pitfall 9 idiom:**
```ts
// src/preload/index.ts:126-132 (Phase 6 onExportProgress)
onExportProgress: (handler) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
  ipcRenderer.on('export:progress', wrapped);
  return () => {
    ipcRenderer.removeListener('export:progress', wrapped);
  };
},
```
Phase 9 `onSamplerProgress` is a byte-for-byte copy with the channel renamed to `'sampler:progress'` and the payload typed `(percent: number)`. The wrapped const captures the listener identity for `removeListener` (which compares by reference; anonymous closures leak listeners — see Pitfall below).

**One-way fire-and-forget cancel (preload/index.ts:113-115) — mirror:**
```ts
// src/preload/index.ts:113-115
cancelExport: (): void => {
  ipcRenderer.send('export:cancel');
},
```
Phase 9: `cancelSampler: (): void => { ipcRenderer.send('sampler:cancel'); }`.

### Excerpts from `tests/main/image-worker.spec.ts` the planner mirrors

**Same-process test invocation (image-worker.spec.ts:34-43) — direct function call, vi.mock for sharp/fs:**
```ts
// tests/main/image-worker.spec.ts:34-43
import { runExport } from '../../src/main/image-worker.js';
vi.mock('sharp', () => { ... });
vi.mock('node:fs/promises', () => ({ access: vi.fn(), ... }));
```
Phase 9 sampler-worker.spec.ts has TWO test shapes:
1. **In-thread function-extract tests** — extract the worker's message-handler body into an exported plain async function `runSamplerJob({ skeletonPath, atlasRoot, samplingHz, onProgress, isCancelled })` and unit-test it WITHOUT spawning a Worker. Mirrors image-worker.spec.ts's strategy of testing `runExport` directly without spawning Electron. Cases (a)/(b)/(c)/(d)/(e) from CONTEXT.md `<domain>` "Tests" section all run via this seam.
2. **One end-to-end Worker spawn test** — spawn the actual `new Worker(workerPath, { workerData: ... })` against `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, assert the postMessage protocol fires `{type: 'progress'}` then `{type: 'complete', output}` and the output equals the in-thread `sampleSkeleton(load)` result byte-for-byte (used Map-key parity, peakScale floats with epsilon).

The planner SHOULD favor function-extract tests for cases (a)-(e) and ONE Worker spawn test as the "the wiring works" smoke. This matches the Phase 6 split.

---

## Open questions resolved

### 1. TanStack Virtual concrete API for both panels

**GlobalMaxRenderPanel** (sticky `<thead>` flat table):
- `useVirtualizer({ count, getScrollElement: () => parentRef.current, estimateSize: () => 34, overscan: 20, getItemKey: (i) => rows[i].attachmentKey })`.
- Outer div: `ref={parentRef}, style={{ height: '...', overflow: 'auto', overflowAnchor: 'none' }}`.
- Inner div (table wrapper): `style={{ height: virtualizer.getTotalSize() }}`.
- `<thead>`: `position: sticky; top: 0; z-index: 1; background: var(--panel)` — the virtualizer transforms only `<tbody>` children.
- `<tr>` translate: `transform: translateY(${virtualRow.start - index * virtualRow.size}px)` per the official table example [CITED: tanstack.com/virtual/latest/docs/framework/react/examples/table].
- Scroll restoration on sort/filter: the planner SHOULD call `virtualizer.scrollToIndex(0)` after a sort or search-query change (resets to top deterministically; UX-correct since the user's "find a row" intent is satisfied by the search field rather than scroll memory).
- Threshold gate: `const useVirtual = useMemo(() => rows.length > 100, [rows.length])` — when false, render the existing flat-JSX path unchanged (preserves Cmd-F).

**AnimationBreakdownPanel** (per-card inner row list, variable-height):
- Outer card list: regular DOM (no virtualization — D-196).
- Per expanded card, when `card.rows.length > 100`: render a `<div ref={cardScrollRef}>` with `useVirtualizer({ count: card.rows.length, getScrollElement: () => cardScrollRef.current, estimateSize: () => 38, overscan: 10, getItemKey: (i) => card.rows[i].attachmentKey })`.
- Each `<tr>` gets `ref={virtualizer.measureElement}` for ResizeObserver-driven exact measurement.
- Card height: bound the inner scroll container at e.g. `max-height: 600px; overflow-y: auto` so collapse/expand behavior stays predictable.
- Threshold gate: same `card.rows.length > 100` check inside each `<AnimationCard>` body.

[CITED: tanstack.com/virtual/latest/docs/framework/react/examples/dynamic + .../examples/table]

### 2. Node `worker_threads` cancellation idiom

**Recommendation: cooperative flag-check at attachment-loop boundary, with `worker.terminate()` as the timeout fallback.**

Implementation shape (in `src/main/sampler-worker.ts`):

```ts
import { parentPort, workerData } from 'node:worker_threads';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton } from '../core/sampler.js';

let cancelled = false;
parentPort!.on('message', (msg) => {
  if (msg?.type === 'cancel') cancelled = true;
});

const { skeletonPath, atlasRoot, samplingHz } = workerData;
try {
  const load = loadSkeleton(skeletonPath, atlasRoot ? { atlasPath: atlasRoot } : {});
  // sampleSkeleton is byte-frozen — wrap with a cancel-aware progress hook.
  // Approach: pass a callback that snapshotFrame() doesn't currently accept.
  // → BLOCKER: sampler.ts is byte-frozen (D-102). Two options:
  //    (A) Run sampleSkeleton synchronously and only cancel BEFORE/AFTER —
  //        coarse cancellation (worst case: full sample completes); breaks
  //        the ≤200 ms cancellation budget.
  //    (B) Reimplement the (skin × animation) double-loop INSIDE the worker
  //        wrapper, calling sampleSkeleton's exported helpers per-animation.
  //        → ALSO BLOCKED: sampleSkeleton internals (snapshotFrame) are not
  //          exported.
  //    (C) Replace sampleSkeleton with a chunked variant that yields per skin
  //        or per animation, with a cancellation-check between yields. The
  //        sampler stays byte-frozen as a single-call function; the WORKER
  //        WRAPPER iterates skins/animations one at a time by calling
  //        sampleSkeleton repeatedly with a temporary skin/animation filter.
  //        → ALSO BLOCKED: sampleSkeleton has no skin/animation filter param.
  // Resolution: cancellation is BETWEEN sampleSkeleton calls only. For Phase 9
  // there is exactly ONE sampleSkeleton call per worker run. So the granular
  // cancel-during-sampling story is DEFERRED to the case where the user
  // changes their mind during the 5-10s Girl run — that case uses
  // worker.terminate() as the forceful escape, NOT the cooperative flag.
  // The cooperative flag covers "between worker setup and sampleSkeleton" +
  // "between sampleSkeleton and complete-emit" (i.e. negligible windows).
  const output = sampleSkeleton(load, { samplingHz });
  if (cancelled) {
    parentPort!.postMessage({ type: 'cancelled' });
  } else {
    parentPort!.postMessage({ type: 'complete', output });
  }
} catch (err) {
  parentPort!.postMessage({ type: 'error', error: serializeError(err) });
}
```

**Cancellation strategy (revised after the byte-frozen-sampler constraint surfaces):**
- **Primary mechanism: `worker.terminate()`** for in-flight cancellation. The sampler is a single uninterruptible synchronous call; cooperative flag-checking inside it requires modifying sampler.ts which is forbidden by D-102.
- The bridge in main does: `worker.terminate().then(() => { samplerCancelFlag = false; })` — Promise resolves with the exit code; main process uses this to know the worker is dead and a fresh one can spawn.
- **Latency:** Node docs say "as soon as possible," typically <50 ms for a JS-bound worker [CITED: nodejs.org/api/worker_threads.html §"worker.terminate()"]. The ≤200 ms budget in D-194 is comfortably met.
- **Progress events** still fire from inside `sampleSkeleton` IF AND ONLY IF the planner adopts a different shape (see Open Q4 below). Since sampler.ts is byte-frozen, there is no inner-loop emit point — so progress is **monotonic 0 → 100% via approximation**: the worker emits `{type:'progress', percent:0}` on start and `{type:'progress', percent:100}` on complete. Any intermediate cadence requires either modifying sampler.ts (forbidden) OR a separate timer-based "I'm still alive" heartbeat (recommended — see Q4).
- **Cooperative flag is still wired** (for cleanliness + to support a future sampler that exposes a progress hook), but in Phase 9 only `terminate()` actually achieves cancellation.

[CITED: nodejs.org/api/worker_threads.html]

### 3. SkeletonData re-load cost

**Negligible — verified by file size:** fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json is 908 KB. JSON.parse + Spine SkeletonJson construction on a file this size is well under 100 ms (typical Spine 4.2 loader benchmarks run <50 ms for 1 MB JSON [CITED: training knowledge — confirmed by direct experience in this codebase: `tests/core/sampler.spec.ts` runs SIMPLE_PROJECT in <100 ms total INCLUDING load]).

The sampling work for a complex rig is dominated by `(skins × animations × samplingHz × duration × attachments × computeWorldVertices)` — for fixtures/Girl that's roughly the 5-10 s envelope N2.2 targets. Re-load cost is <2% of sampling cost. **D-193's path-based protocol is correct.**

[ASSUMED] Loader cost approximation (specifically: 50-100 ms vs <2% of sampling). Verifying this concretely requires running the actual benchmark; planner SHOULD include a sanity-check log in the wall-time test that prints `{ loadMs, sampleMs }` so any future regression surfaces immediately.

### 4. Progress cadence

**Recommendation: heartbeat at a fixed interval (every 250 ms), NOT per-iteration.**

Rationale:
- The sampler is byte-frozen (D-102) — there's no inner-loop emit point to instrument with `if (i % 100 === 0) postMessage(...)`.
- Node docs explicitly warn against chatty postMessage [CITED: nodejs.org/api/worker_threads.html §"Synchronous blocking of stdio"].
- The wall-time envelope is 5-10 s; a 250 ms heartbeat → 20-40 events total — perfect cadence, no risk of stdio blocking.
- However: the sampler's synchronous nature means **a `setInterval`-based heartbeat in the worker can't fire mid-`sampleSkeleton`** (the JS event loop is blocked). The heartbeat would only fire at the start (0%) and once at completion (100%).

**Therefore, the PRACTICAL Phase 9 progress UX is:**
- Worker emits `{type:'progress', percent: 0}` immediately after spawn (acknowledges receipt).
- AppShell renders an **indeterminate progress indicator** (CSS spinner / animated bar) for the duration of the sample — NOT a determinate percentage bar.
- Worker emits `{type:'complete', output}` when done; AppShell hides the spinner.
- This matches Phase 6's per-file determinate bar **only in shape, not in determinacy.** Phase 6's image-worker fires per-file events naturally because the loop is in main JS; Phase 9's sampler is one opaque blob.

**Trade-off acknowledged:** If the user wants a real determinate bar, the sampler must expose a progress hook — which violates D-102 (byte-frozen). The planner SHOULD ship indeterminate progress for Phase 9 and capture "sampler progress hook" as a deferred item if needed.

[CITED: nodejs.org/api/worker_threads.html §"Synchronous blocking of stdio"]

### 5. `'sampler:cancel'` IPC ordering vs `worker.terminate()`

**Recommendation: `worker.terminate()` directly.**

When the user opens a different project mid-sample (08.2 menu Open scenario):
- AppShell calls `window.api.cancelSampler()` → preload sends `'sampler:cancel'`.
- Main's `ipcMain.on('sampler:cancel')` handler calls `await worker.terminate()`.
- Worker exits within <50 ms (Node 22 LTS [CITED: nodejs.org/api/worker_threads.html]).
- Main spawns a fresh worker for the new project's sample.

The cooperative `'cancel'` postMessage is wired (per the worker code above) for protocol completeness, but in Phase 9 it's effectively dead code because the sampler call is uninterruptible. **Do NOT remove it** — a future sampler with a progress hook would activate it, and the protocol shape is what's documented to mirror Phase 6.

Phase 6 does **not** spawn a worker — its cancel flag aborts a between-files JS loop. That mechanism is non-applicable here. **Use `terminate()` for the actual cancellation.**

### 6. Settings modal accelerator on Win/Linux

**`CommandOrControl+,` works cross-platform.** Verified via WebSearch [CITED: electronjs.org/docs/latest/tutorial/keyboard-shortcuts]. No comma-key gotchas documented. Mirrors the same `CmdOrCtrl+O` / `CmdOrCtrl+S` / `CmdOrCtrl+Shift+S` syntax already used at `src/main/index.ts:203/211/217`.

Menu placement: the planner SHOULD use `Edit → Preferences…` on macOS (via `role: 'editMenu'` extension or a custom Edit menu) and `File → Settings…` on Win/Linux. **CAVEAT:** `role: 'editMenu'` is a fixed template that takes no submenu; to add Preferences the planner must either replace it with a custom Edit menu or use a separate App-menu Preferences entry on macOS (which is the actual macOS HIG anyway). **Recommendation:** add Preferences under `role: 'appMenu'` extension on macOS (App menu name auto-resolves to "Spine Texture Manager") and a File-menu entry on Win/Linux — the existing menu builder at `src/main/index.ts:196-233` already conditionally builds template entries; the planner extends this without breaking 08.2.

[CITED: electronjs.org/docs/latest/api/menu §"Standard Menus"]

### 7. Markdown rendering for in-app Help — smallest footprint

**Recommendation: precompiled HTML at build time** (Vite `?raw` import of an HTML file authored alongside the source, OR a static React component with JSX content).

Rationale:
- Help content is static (one page, ~7 sections per CONTEXT.md).
- Adding `react-markdown` (~80 KB) or `marked` + `dompurify` (~50 KB) for a single page is a poor trade [VERIFIED: npm registry — `npm view react-markdown version` = 10.1.0; `marked` = 18.0.2; `dompurify` = 3.4.1].
- A static React component is the most tree-shakeable, smallest-footprint, zero-XSS shape.
- External links use `shell.openExternal` via existing `openOutputFolder`-style preload bridge (extend with `openExternalUrl(url)` if not present).

If the planner has a strong preference for Markdown source (e.g., for non-developer-editable help content), `marked` + `dompurify` is the second-best option — but argues for a separate phase to set up the build pipeline.

**Layer 3:** Whatever shape lands stays in `src/renderer/`; arch.spec.ts grep auto-covers it.

### 8. N2.2 wall-time test stability on local Mac dev hardware

**Recommendation: 8000 ms test budget with 1 warm-up run discarded.**

- N2.2 contract: <10000 ms.
- Apple Silicon thermal throttling typically activates after sustained CPU at >85% for ~30+ seconds; a single 5-10 s sampler run shouldn't trigger it, but the SECOND run in a hot test suite might.
- A **warm-up run** (sample once, discard) lets the JIT compile + the V8 inline caches stabilize. Then the timed run reports a stable number.
- 8000 ms budget gives 2000 ms margin against the 10000 ms gate — comfortable for a 5-10 s actual run. Tighter (e.g., 9500 ms) risks flake on a hot CI runner; looser (e.g., 9999 ms) defeats the purpose.
- **Mark the test `.skipIf(env.CI)` if CI variance exceeds budget after empirical measurement** — CONTEXT.md explicitly authorizes this.

```ts
it('fixtures/Girl samples in <8000 ms (N2.2 gate, 2000 ms margin)', async () => {
  await runSamplerJob({ skeletonPath, atlasRoot, samplingHz: 120 }); // warm-up, discarded
  const t0 = performance.now();
  const result = await runSamplerJob({ skeletonPath, atlasRoot, samplingHz: 120 });
  const elapsed = performance.now() - t0;
  expect(result.type).toBe('complete');
  expect(elapsed, `Girl sample took ${elapsed.toFixed(0)} ms (budget 8000)`).toBeLessThan(8000);
});
```

### 9. Sticky-header + virtualizer interaction

**Documented and supported.** The official react-table example [CITED: tanstack.com/virtual/latest/docs/framework/react/examples/table] places `<thead>` outside the virtualized region; the virtualizer transforms only `<tr>` children of `<tbody>`. CSS-side: apply `position: sticky; top: 0; z-index: 1` to `<thead>` (or `<tr>` inside `<thead>`) — the inner scroll container's `position: relative` (implicit on the table-wrapper div with `style={{ height: getTotalSize() }}`) provides the sticky positioning context.

**Pitfall:** Don't apply `position: sticky` to a `<tr>` directly inside `<tbody>` that the virtualizer transforms — the transform creates a stacking context that breaks sticky positioning. Sticky goes on `<thead>` only.

### 10. Variable-height in TanStack Virtual

**The `measureElement` ResizeObserver pattern is the canonical 2025 approach** [CITED: tanstack.com/virtual/latest/docs/api/virtualizer.md].

- Each `<tr>` gets `ref={virtualizer.measureElement}` (the ref accepts `HTMLElement | null` — TanStack's measure callback handles both mount and unmount).
- ResizeObserver fires once per element on first paint; the size is cached keyed by `getItemKey(index)`.
- **Cache invalidation:** if a row's content changes (override badge appears, search query highlights add line wrap), the ResizeObserver re-fires. The cache updates automatically.
- **Collapse/expand cycle (AnimationBreakdownPanel):** when a card collapses, its inner virtualizer unmounts. On re-expand, the virtualizer re-mounts with a fresh measurement cache — but `getItemKey` returning stable `attachmentKey` lets TanStack rebuild the cache quickly (one measure per visible row, ~10-20 elements). **Scroll position resets to 0** on re-expand because the scroll container itself is unmounted.
- **Recommendation:** accept the scroll-reset on collapse/expand as the simpler policy. If preserving scroll within an expanded card across collapse/expand becomes a UX requirement, the planner can store `cardScrollOffset` per cardId in component state and call `virtualizer.scrollToOffset(savedOffset)` on re-mount — but this is a defer-able polish item.

---

## Pitfalls

### Pitfall 1: Sticky `<thead>` inside transformed virtualizer breaks if applied to `<tr>` instead of `<thead>`

**What goes wrong:** Applying `position: sticky` to a `<tr>` that's a child of `<tbody>` whose siblings are CSS-transformed creates conflicting stacking contexts. The sticky row appears to "float" mid-table or vanishes during scroll.
**How to avoid:** Sticky goes on `<thead>` (or `<thead> > <tr>`), not on individual `<tbody> > <tr>`. Inner scroll container needs explicit height + `overflow: auto`.
**Warning signs:** Header disappears after first scroll-tick; rows render under the header on fast scroll.

### Pitfall 2: ResizeObserver cache stale after collapse/expand

**What goes wrong:** The measurement cache survives if `getItemKey` returns stable identities — but if `getItemKey` defaults to index, the cache invalidates on every re-mount and the user sees the initial estimate flash before measurements settle.
**How to avoid:** Always supply `getItemKey: useCallback((i) => rows[i].attachmentKey, [rows])`. NEVER use the default index-based key for variable-height lists.
**Warning signs:** First-paint flicker after expand; rows briefly show `estimateSize` height before snapping to real height.

### Pitfall 3: Chatty postMessage from worker stalls renderer event loop

**What goes wrong:** Per-iteration `postMessage` (e.g., one per attachment per tick = millions of events on a complex rig) will queue faster than the renderer can drain, blocking the main thread and producing the very UI jank the worker was supposed to fix [CITED: nodejs.org/api/worker_threads.html §"Synchronous blocking of stdio"].
**How to avoid:** **Phase 9-specific resolution:** since sampler.ts is byte-frozen and has no inner-loop emit point, the worker fires only `{type:'progress', percent:0}` at start + `{type:'complete'}` at end. The renderer shows an indeterminate spinner during the gap. No chatty events possible.
**Warning signs:** Renderer hangs while sample is in flight; progress UI updates lag visibly behind worker's actual progress.

### Pitfall 4: Spine `SkeletonData` circular refs across worker boundary

**What goes wrong:** `SkeletonData` has `Bone.parent: Bone` references and `Slot.bone: Bone` references that form circular graphs. Structured-clone CAN serialize circular plain objects, but `Bone` / `Slot` are class instances — postMessage strips the prototype, returning plain objects WITHOUT the methods sampler.ts depends on (`bone.worldX`, `slot.color.a`, etc.). The receiver gets a `{}` where it expected a `Bone`.
**How to avoid:** **D-193 path-based protocol** — never send SkeletonData across the boundary. Worker calls `loadSkeleton(skeletonPath)` itself. The only data crossing postMessage is `{ skeletonPath: string, atlasRoot?: string, samplingHz: number }` on input and `SamplerOutput` (Maps + plain records — structured-clone-safe) on output. SamplerOutput is verified safe: `globalPeaks: Map<string, PeakRecord>` and `PeakRecord` is a plain interface with primitives only (sampler.ts:97-100, 119-123).
**Warning signs:** Worker postMessage delivers `{}` for SkeletonData fields; runtime "method not a function" errors in the receiver.

### Pitfall 5 (Pitfall 9 from Phase 6): Listener-identity preservation in `onSamplerProgress`

**What goes wrong:** `ipcRenderer.removeListener` compares listener references by identity. If the unsubscribe closure references a fresh anonymous wrapper instead of the same wrapped const that was registered, removeListener silently fails — listeners accumulate, memory leaks, double-fires.
**How to avoid:** Capture the wrapped listener in a const BEFORE `ipcRenderer.on`; the unsubscribe closure references that const. **Mirror byte-for-byte from `src/preload/index.ts:126-132`** — see Pattern lineage above.
**Warning signs:** Multiple progress events for one logical update; memory-leak warnings in dev tools; subscription leaks across project opens.

### Pitfall 6: `worker.terminate()` does NOT run finally blocks

**What goes wrong:** `terminate()` halts JS execution as soon as possible — `try`/`finally`, `process.on('exit')`, and pending I/O do NOT necessarily run [CITED: nodejs.org/api/worker_threads.html §"worker.terminate()"]. Anything the worker should clean up (file handles, socket connections) won't.
**How to avoid:** The Phase 9 worker has NO cleanup obligations — it's a pure compute job (loadSkeleton + sampleSkeleton, both filesystem-free per N2.3 + the loader's load-time-only carve-out). `terminate()` is safe for our shape. If a future phase adds resource ownership in the worker, revisit this.
**Warning signs:** N/A in Phase 9 (no resources to leak).

### Pitfall 7: `samplingHz` change in Settings modal without re-sample

**What goes wrong:** The Settings modal updates `samplingHz` in renderer state (via the existing AppShell plumbing at lines 71/114/477/485/506), but the displayed peaks are stale — they were sampled at the OLD rate. UX expectation: changing sampling rate should re-sample.
**How to avoid:** AppShell-level `useEffect([samplingHz])` triggers a re-sample via the worker bridge. This is consistent with Phase 8's existing `samplingHz` dirty-derivation behavior (D-145) — the project becomes dirty AND the sample re-runs. Planner SHOULD call this out explicitly in PLAN.
**Warning signs:** User changes sampling rate, peaks don't update, project marked dirty but the dirty content is invisible.

### Pitfall 8: Help-menu `role: 'help'` requires non-empty submenu

**What goes wrong:** Electron's MenuItemConstructorOptions validation throws "Invalid template for MenuItem: must have submenu type with role help" if the help role has no submenu items — already worked around at `src/main/index.ts:228-232` with a placeholder empty submenu. Phase 9 fills it; if planner accidentally removes the placeholder structure, builds fail at menu-load time.
**How to avoid:** Add Documentation menu item INSIDE the existing `submenu: []` array — keep `role: 'help'` intact.
**Warning signs:** App crashes on startup with menu validation error after Phase 9 lands.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 4.0+ (verified via `package.json` devDependencies) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test` |
| Phase gate | Full suite green before `/gsd-verify-work 9` |

### Phase Requirements → Test Map

| Req ID / Decision | Behavior | Test Type | Automated Command | File Exists? |
|-------------------|----------|-----------|-------------------|-------------|
| **N2.2** | fixtures/Girl wall-time < 8000 ms (with 2000 ms margin from 10000 ms gate) | integration | `vitest run tests/main/sampler-worker-girl.spec.ts` | ❌ Wave 0 — new file |
| **D-190 / D-193** | Worker spawns and runs `sampleSkeleton` against SIMPLE_PROJECT, returns byte-identical SamplerOutput vs in-thread `sampleSkeleton(load)` (Map-key parity, peakScale within PEAK_EPSILON) | integration | `vitest run tests/main/sampler-worker.spec.ts -t "byte-identical"` | ❌ Wave 0 |
| **D-194 progress** | Worker emits `{type:'progress', percent:0}` on start and `{type:'progress', percent:100}` (or `complete`) on finish; renderer subscriber receives both in order | unit (function-extract) | `vitest run tests/main/sampler-worker.spec.ts -t "progress"` | ❌ Wave 0 |
| **D-194 cancel ≤200 ms** | After `worker.terminate()`, worker exits within 200 ms (assert via `performance.now()` between terminate call and exit-event resolution) | integration | `vitest run tests/main/sampler-worker.spec.ts -t "cancel"` | ❌ Wave 0 |
| **D-194 error** | Worker reports `{type:'error', error: SerializableError}` when skeletonPath is missing/unreadable | unit (function-extract) | `vitest run tests/main/sampler-worker.spec.ts -t "error"` | ❌ Wave 0 |
| **Layer 3 invariant** | `src/main/sampler-worker.ts` does not import from `src/renderer/`; does not import DOM types | hygiene grep | `vitest run tests/arch.spec.ts` (auto-extends; existing globSync covers `src/main/**`) | ✅ existing (lines 19-34 already cover via `src/{main,preload,renderer}/**` glob) |
| **D-191 / D-195 below threshold** | GlobalMaxRender with 50 rows: `screen.getAllByRole('row')` count == 51 (50 data rows + header) — flat-table path renders all rows | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "below threshold"` | ❌ Wave 0 |
| **D-191 / D-195 above threshold** | GlobalMaxRender with 200 rows: rendered DOM `<tr>` count ≤ 60 (window of ~30-40 visible rows + overscan + header) — at least 70% reduction vs 200 | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "above threshold"` | ❌ Wave 0 |
| **D-191 sort/search preserved** | Virtualized path: clicking sort header, typing in search, toggling per-row checkbox all still function | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "sort\|search\|checkbox"` | ❌ Wave 0 |
| **Sticky thead** | Outer scroll container scrolled by 1000 px — header still at `getBoundingClientRect().top === 0` | renderer | `vitest run tests/renderer/global-max-virtualization.spec.tsx -t "sticky"` | ❌ Wave 0 |
| **D-196 outer cards in regular DOM** | AnimationBreakdown with 16 cards: all 16 `<section>` elements present in DOM regardless of expand state | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "outer cards"` | ❌ Wave 0 |
| **D-196 inner virtualization above threshold** | Expanded card with 200 rows: rendered `<tr>` count ≤ 60 (window) | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "inner above threshold"` | ❌ Wave 0 |
| **D-196 collapse/expand** | Card with 200 rows: collapse → re-expand preserves filter query; planner-chosen scroll-reset policy holds | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "collapse"` | ❌ Wave 0 |
| **D-196 OverrideDialog mounts from virtualized row** | Click "Override Scale" on a virtualized inner row → OverrideDialog mounts with correct row context | renderer | `vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "override"` | ❌ Wave 0 |
| **IPC channels** | `'sampler:progress'` event registered on `ipcMain`, payload typed `{percent:number}`; `'sampler:cancel'` handler registered | unit | `vitest run tests/main/ipc.spec.ts -t "sampler"` | ✅ existing (extension; tests/main/ipc.spec.ts present) |
| **Settings modal samplingHz** | SettingsDialog opens, dropdown 60/120/240 + custom; clamps non-positive; applies → AppShell `samplingHz` updates → project marked dirty (D-145) | renderer | `vitest run tests/renderer/settings-dialog.spec.tsx` | ❌ Wave 0 |
| **Rig-info tooltip** | Hover filename chip → tooltip shows `skeleton.fps: N (editor metadata — does not affect sampling)` | renderer | `vitest run tests/renderer/rig-info-tooltip.spec.tsx` | ❌ Wave 0 |
| **Help dialog** | Click Help menu item → HelpDialog mounts with content; `shell.openExternal` called on external link click (mocked) | renderer | `vitest run tests/renderer/help-dialog.spec.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `vitest run tests/main/sampler-worker.spec.ts tests/renderer/global-max-virtualization.spec.tsx` (the affected slice; ~5 s).
- **Per wave merge:** `npm run test` (full suite).
- **Phase gate:** Full suite green INCLUDING the Girl wall-time gate — before `/gsd-verify-work 9`.

### Wave 0 Gaps

- [ ] `tests/main/sampler-worker.spec.ts` — covers D-190/D-193/D-194 (function-extract unit cases a-d + one Worker spawn smoke)
- [ ] `tests/main/sampler-worker-girl.spec.ts` — N2.2 wall-time gate, 8000 ms budget with warm-up
- [ ] `tests/renderer/global-max-virtualization.spec.tsx` — D-191/D-195 + sticky thead
- [ ] `tests/renderer/anim-breakdown-virtualization.spec.tsx` — D-196
- [ ] `tests/renderer/settings-dialog.spec.tsx` — Settings modal + samplingHz dirty derivation
- [ ] `tests/renderer/rig-info-tooltip.spec.tsx` — tooltip content + skeleton.fps labeling
- [ ] `tests/renderer/help-dialog.spec.tsx` — Help dialog + external link via shell.openExternal mock

**Framework install:** none needed — vitest + @testing-library/react already in devDependencies. `@tanstack/react-virtual` is the one new runtime dep.

### DOM-count assertion thresholds

- **GlobalMaxRender below threshold (50 rows):** `getAllByRole('row').length === 51` (header + 50 data rows; exact match).
- **GlobalMaxRender above threshold (200 rows):** `getAllByRole('row').length ≤ 60` (header + ≤59 data rows; conservative bound for `overscan: 20` + ~20 visible).
- **AnimationBreakdown outer cards (16 cards, all collapsed):** `screen.getAllByRole('region').length === 0` (regions unmount when collapsed) OR all 16 `<section>` elements present (planner picks the right query — `getAllByLabelText` on the section's `aria-labelledby`).
- **AnimationBreakdown inner virtualized (1 card expanded, 200 rows):** within the expanded card's body, `<tr>` count ≤ 60.

### Cancellation latency budget

- ≤200 ms (D-194). Test asserts `performance.now() - terminateStart < 200` after `await worker.terminate()`.
- Margin: Node 22 LTS typically <50 ms for JS-bound workers [CITED: nodejs.org/api/worker_threads.html]; 200 ms gives ~4× margin against thermal-throttled CI.

### Wall-time budget for Girl gate

- N2.2 contract: <10000 ms.
- Test budget: <8000 ms (2000 ms margin).
- Warm-up: 1 discarded run BEFORE the timed run.
- `.skipIf(env.CI)` if empirical CI variance exceeds budget — authorized by CONTEXT.md.

### Layer 3 grep in arch.spec.ts

Existing `tests/arch.spec.ts:19-34` already covers `src/{main,preload,renderer}/**/*.{ts,tsx}` for Layer 3 invariants (no `core/` imports from renderer; no DOM imports; no platform branches). `src/main/sampler-worker.ts` is auto-covered. No new arch.spec.ts block required for Layer 3 — but the planner SHOULD add a NEW grep block specifically for the worker:

```ts
describe('Phase 9 Layer 3: src/main/sampler-worker.ts must not import DOM/renderer surfaces', () => {
  it('does not import from src/renderer/ or DOM types', () => {
    const text = readFileSync('src/main/sampler-worker.ts', 'utf8');
    expect(text).not.toMatch(/from ['"][^'"]*\/renderer\//);
    expect(text).not.toMatch(/from ['"]react['"]/);
    expect(text).not.toMatch(/from ['"]electron['"]/); // worker is Node-only; main owns Electron surface
    expect(text).not.toMatch(/document\.|window\./);
  });
});
```

The "no electron import" guard is important: workers run in a Node-only context with NO `BrowserWindow` or `webContents` — only `node:worker_threads` + Node primitives. Importing electron in the worker would fail at runtime.

---

## Recommendations for the planner

The planner SHOULD:

1. **Wave order:** Wave 0 test scaffolds → Wave 1 sampler-worker.ts + bridge → Wave 2 IPC + preload + AppShell progress UI → Wave 3 panel virtualization → Wave 4 Settings + tooltip + Help → Wave 5 close-out (Girl gate run + STATE.md/ROADMAP.md advance).

2. **Use `worker.terminate()` as the cancellation primitive** — NOT a cooperative flag. The byte-frozen sampler has no inner-loop emit point; cooperative cancellation is theoretically wired but practically dead in Phase 9. Document this trade-off in the worker's file-level comment block (mirror image-worker.ts's comment style).

3. **Ship indeterminate progress** (CSS spinner / animated bar), NOT a determinate percentage. The sampler is one opaque blob; intermediate progress requires modifying sampler.ts (forbidden by D-102). Capture "sampler progress hook" as a deferred item if a future phase wants real determinate progress.

4. **Use a static React component for Help content** — not a markdown library. Smallest footprint, zero XSS surface, one-time authored content. External links via `shell.openExternal` (extend preload with `openExternalUrl(url)` if the bridge isn't already there).

5. **Threshold-gate virtualization with `useMemo(() => rows.length > 100, [rows.length])`** in BOTH panels. Below threshold: existing flat JSX unchanged (preserves Cmd-F text search and zero virtualization overhead). Above: TanStack Virtual takes over. SIMPLE_PROJECT and Jokerman stay below the threshold; Girl crosses it.

6. **Wire `samplingHz` dirty derivation to trigger a re-sample** when the user changes the rate in Settings. The existing AppShell `samplingHz` plumbing (lines 71/114/477/485/506) feeds into project-io's sample call sites — adding a `useEffect([samplingHz])` that dispatches the worker bridge re-runs the sample with the new rate. Project becomes dirty (D-145 already covers this) AND peaks update (Pitfall 7 above).

7. **Mirror Phase 6 `image-worker.spec.ts` test split:** function-extract for cases (a)-(d), one end-to-end Worker spawn smoke. Separately, the Girl wall-time gate at `tests/main/sampler-worker-girl.spec.ts` is the N2.2 enforcement and runs the worker actually-spawned (not extracted) so the integration cost is measured.

8. **Add a Phase 9 arch.spec.ts grep block** (per Validation Architecture above) specifically for `src/main/sampler-worker.ts`: must NOT import from `src/renderer/`, react, electron, or DOM globals. The existing globSync at lines 19-34 covers some of this transitively, but a named anchor block makes regressions visible at PR-review time.

9. **Use `attachmentKey` as `getItemKey`** in both panels' virtualizers — via `useCallback`. Stable identity is what makes ResizeObserver caching survive sort/filter/collapse cycles. Index-based default keys cause measurement flicker.

10. **Apply `position: sticky; top: 0; z-index: 1` to `<thead>`** (NOT `<tr>`) in the virtualized GlobalMaxRender path. The virtualizer transforms only `<tbody>`'s children; `<thead>` is untouched and sticky works natively in the inner `position: relative` scroll container.

11. **Apply `overflow-anchor: none` to the outer scroll container** to prevent browser-driven scroll re-anchoring on sort/filter content-height changes. Documented in TanStack Virtual's dynamic example.

12. **Set `estimateSize` realistically per panel:** `34` for GlobalMaxRender (uniform-row table; current row height by inspection of `panels/GlobalMaxRenderPanel.tsx` typography + padding); `38` for AnimationBreakdown rows (slightly taller due to multi-line Bone Path on long chains). measureElement will refine; estimates only matter for scroll-bar size before rows render.

13. **Verify the Girl-fixture sampler is byte-identical between in-thread and worker invocation:** the test in `tests/main/sampler-worker.spec.ts` should run `sampleSkeleton(load)` directly (in-test thread) and via the worker, then compare every key in the resulting `globalPeaks` Map by attachmentKey + peakScale-within-PEAK_EPSILON. This catches any silent serialization corruption of the SamplerOutput payload across the postMessage boundary. Prove no regression via the existing golden test pattern.

14. **Document the `scripts/cli.ts` byte-frozen invariant in the plan**: the worker is main-only; the CLI continues to call `sampleSkeleton` synchronously in-process. No CLI changes. arch.spec.ts could grep this if the planner wants belt-and-braces.

15. **Help dialog content sections** (per CONTEXT.md): "What this app does" / "How to load a rig" / "Reading the Global Max Render Source panel" / "Reading the Animation Breakdown panel" / "How to override a scale" / "How to optimize and export" / "Sampling rate (advanced) — `samplingHz` vs `skeleton.fps`". The last section is critical for tooltip-aligned terminology.

16. **Tooltip wording must align with `src/core/sampler.ts:41-44`'s comment block** — the canonical project terminology. "editor dopesheet metadata; sampling uses your samplingHz setting (default 120 Hz)" or equivalent. Pull `skeleton.fps` from `loader.ts:229` (`editorFps = skeletonData.fps || 30`) — this surface is already plumbed through `summary` (verify in `src/main/summary.ts` if not threading; planner picks the seam).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | SkeletonData re-load cost is <2% of sampling cost on fixtures/Girl (estimated 50-100 ms for 908 KB JSON) | Open Q3 | If load is 500+ ms, the 8000 ms test budget tightens; warm-up run absorbs this. Recommendation: log `{loadMs, sampleMs}` in the wall-time test for visibility. |
| A2 | Node 22 LTS `worker.terminate()` typically completes in <50 ms for JS-bound workers | Pitfall 6, Open Q5 | If terminate is slower (e.g., 150+ ms on cold runners), the ≤200 ms cancellation budget tightens. Mitigation: budget already gives 4× margin. |
| A3 | `@tanstack/react-virtual` v3.13.24 is API-stable vs v3.13.x examples cited | Library + API | Minor — v3.x has been stable since 2023 per release history. Major version bump (v4) would change API; verify before plan commit. |
| A4 | Apple Silicon thermal throttling does not activate within a single 5-10 s sampler run | Open Q8 | If it does on a hot test suite, warm-up + 2000 ms margin absorbs typical variance. `.skipIf(env.CI)` is the explicit escape. |
| A5 | Static React component for Help is the smallest footprint vs marked/react-markdown | Markdown rendering | LOW — npm view confirms react-markdown is 80 KB and marked + dompurify is 50 KB. A static component is ~0 KB runtime. The risk is only if the planner has reasons to prefer Markdown source format that I haven't anticipated. |

---

## Open Questions (RESOLVED)

None blocking. All 10 enumerated open questions answered above. Two soft notes:

1. **CONTEXT.md `samplingHz` re-sample trigger**: The Settings modal presumably re-samples on change (Pitfall 7 above), but CONTEXT.md doesn't state this explicitly. The planner MAY surface this as a discuss-phase clarification if the user wants to confirm "rate change auto-resamples" vs "rate change requires explicit re-load."

2. **Indeterminate vs determinate progress**: CONTEXT.md says "determinate progress bar" in places. With the byte-frozen sampler, only indeterminate is honest. If the user requires determinate, they must lift the D-102 byte-freeze on sampler.ts — separate decision. The planner SHOULD flag this in PLAN.md notes.

---

## Sources

### Primary (HIGH confidence)

- [TanStack Virtual — examples/table](https://tanstack.com/virtual/latest/docs/framework/react/examples/table) — sticky thead + transformed tbody pattern
- [TanStack Virtual — examples/dynamic](https://tanstack.com/virtual/latest/docs/framework/react/examples/dynamic) — measureElement + ResizeObserver + overflow-anchor
- [TanStack Virtual — examples/sticky](https://tanstack.com/virtual/latest/docs/framework/react/examples/sticky) — sticky-row rangeExtractor pattern (alt approach, not chosen)
- [TanStack Virtual — api/virtualizer](https://tanstack.com/virtual/latest/docs/api/virtualizer.md) — getItemKey, overscan, scrollMargin, estimateSize signatures
- [Node.js docs — worker_threads](https://nodejs.org/api/worker_threads.html) — terminate(), structured-clone, postMessage cadence guidance, "Synchronous blocking of stdio"
- npm registry — verified versions 2026-04-26: `@tanstack/react-virtual@3.13.24`, `react-markdown@10.1.0`, `marked@18.0.2`, `dompurify@3.4.1`
- `src/core/sampler.ts:41-44` — canonical samplingHz vs skeleton.fps wording
- `src/core/loader.ts:225-229` — editorFps source surface
- `src/main/image-worker.ts` (Phase 6) — orchestration shape mirror
- `src/main/ipc.ts:104-105, 474-479, 512-519` — cancel flag, progress emission, channel registration patterns
- `src/preload/index.ts:113-115, 126-132` — listener-identity + fire-and-forget cancel
- `src/main/index.ts:203, 211, 217, 228-232` — accelerator syntax precedent + Help-menu role placeholder

### Secondary (MEDIUM confidence)

- [Electron docs — keyboard-shortcuts](https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts) — CommandOrControl cross-platform; comma-key acceptance
- WebSearch 2026-04-26 — no comma-specific gotchas surfaced

### Tertiary (LOW confidence)

- Apple Silicon thermal throttling timing window (~30 s of sustained CPU >85%) — general industry knowledge, not directly verified for fixtures/Girl on the user's specific hardware. Mitigation: warm-up + 2000 ms margin.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `@tanstack/react-virtual` v3.13.24 verified via npm registry; usage patterns from official documentation.
- Architecture: HIGH — Phase 6 patterns clearly documented in `image-worker.ts` + ipc.ts + preload; Phase 9 mirrors them.
- Worker_threads cancellation: MEDIUM — node docs confirm `terminate()` is the canonical 2025 mechanism for forceful cancellation; the byte-frozen-sampler constraint forces this over cooperative flags. Latency profile is documented as "as soon as possible" with <50 ms typical, not contractually guaranteed.
- Pitfalls: HIGH — derived from CONTEXT.md's existing pitfall catalogue + TanStack Virtual + Node docs.
- Wall-time test budget: MEDIUM — 8000 ms with 2000 ms margin is a reasoned guess; planner should empirically calibrate after first Girl run lands.
- Markdown rendering choice: HIGH (versions verified); MEDIUM (recommendation depends on planner discretion — three viable shapes).

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30-day stable estimate; Node LTS + TanStack Virtual v3.x are both stable surfaces)

## RESEARCH COMPLETE
