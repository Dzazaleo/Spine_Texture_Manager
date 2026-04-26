---
phase: 09-complex-rig-hardening-polish
plan: 02
type: execute
wave: 1
depends_on: ["09-01"]
files_modified:
  - src/main/sampler-worker.ts
  - src/main/sampler-worker-bridge.ts
  - src/main/ipc.ts
  - src/main/project-io.ts
  - src/preload/index.ts
  - src/shared/types.ts
  - src/renderer/src/components/AppShell.tsx
  - tests/main/sampler-worker.spec.ts
  - tests/main/sampler-worker-girl.spec.ts
  - tests/main/ipc.spec.ts
  - electron.vite.config.ts
autonomous: true
requirements: [N2.2]
tags: [phase-9, wave-1, worker_threads, sampler, ipc, n2-2-gate]

must_haves:
  truths:
    - "fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms wall-time on local hardware (with 1 warm-up run discarded), passing the N2.2 exit gate"
    - "Sampling runs on a real Node worker_threads Worker — `grep -rn 'worker_threads\\|new Worker' src/` returns matches in src/main/sampler-worker-bridge.ts (and possibly src/main/sampler-worker.ts)"
    - "SamplerOutput from worker run is byte-identical to in-thread sampleSkeleton on SIMPLE_PROJECT (Map-key parity + peakScale within PEAK_EPSILON 1e-5)"
    - "Worker emits {type:'progress', percent:0} on start and resolves with {type:'complete', output} on success or {type:'cancelled'} after worker.terminate() within 200 ms"
    - "Renderer subscribes via window.api.onSamplerProgress and shows an indeterminate spinner during sampling; spinner clears on complete/cancelled/error"
    - "src/main/sampler-worker.ts does NOT import from electron, react, src/renderer/, or DOM globals (Layer 3 invariant — tests/arch.spec.ts Phase 9 anchor block flips from early-return to assertion-passing)"
    - "src/core/sampler.ts and scripts/cli.ts are byte-identical to commit eb97923 baseline (D-102 byte-frozen invariant preserved)"
  artifacts:
    - path: "src/main/sampler-worker.ts"
      provides: "node:worker_threads worker that calls loadSkeleton + sampleSkeleton inside the worker process"
      contains: "import { parentPort, workerData } from 'node:worker_threads'"
    - path: "src/main/sampler-worker-bridge.ts"
      provides: "Promise-wrapped Worker spawn + progress relay + cancel via terminate()"
      contains: "new Worker"
    - path: "src/main/ipc.ts"
      provides: "ipcMain.on('sampler:cancel') handler"
      contains: "ipcMain.on('sampler:cancel'"
    - path: "src/preload/index.ts"
      provides: "onSamplerProgress + cancelSampler bridges"
      contains: "onSamplerProgress"
    - path: "src/shared/types.ts"
      provides: "Api interface gains onSamplerProgress + cancelSampler"
      contains: "onSamplerProgress"
    - path: "src/renderer/src/components/AppShell.tsx"
      provides: "Indeterminate sampling spinner + onSamplerProgress useEffect subscription with Pitfall 9 cleanup"
  key_links:
    - from: "src/main/project-io.ts:437-441 + :640-643"
      to: "src/main/sampler-worker-bridge.ts (runSamplerInWorker)"
      via: "await runSamplerInWorker({ skeletonPath, atlasRoot, samplingHz }, mainWindow.webContents)"
      pattern: "runSamplerInWorker"
    - from: "src/main/sampler-worker-bridge.ts"
      to: "src/main/sampler-worker.ts"
      via: "new Worker(workerPath, { workerData: { skeletonPath, atlasRoot, samplingHz } })"
      pattern: "new Worker"
    - from: "src/preload/index.ts onSamplerProgress"
      to: "src/main/ipc.ts emit + bridge.ts forward"
      via: "ipcRenderer.on('sampler:progress', wrapped) — listener-identity preserved (Pitfall 9)"
      pattern: "sampler:progress"
    - from: "src/renderer/src/components/AppShell.tsx useEffect"
      to: "window.api.onSamplerProgress"
      via: "subscription wrapped const + return unsubscribe (Pitfall 9 + 15)"
      pattern: "onSamplerProgress"
---

<objective>
Land the Phase 9 N2.2 exit gate. This is the largest plan in the phase (3 tasks, ~50% context budget). It introduces the project's first true `worker_threads` Worker, mirrors the Phase 6 IPC + preload pattern verbatim for the new `'sampler:progress'` + `'sampler:cancel'` channels, refactors the two sample call sites in `src/main/project-io.ts` to dispatch through the new bridge, and adds the indeterminate sampling spinner to AppShell. By the end of this plan, `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` MUST sample in <8000 ms wall-time and the spec at `tests/main/sampler-worker-girl.spec.ts` MUST go GREEN.

Purpose: D-189 + D-190 + D-193 + D-194 land here. Per D-190 the worker is built UNCONDITIONALLY (overrides ROADMAP's "if profiling shows jank" language). Per D-193 the protocol is path-based — `SkeletonData` NEVER crosses the postMessage boundary because Spine class instances lose their prototypes through structured-clone (Pitfall 4). Per D-194 the cancellation primitive is `worker.terminate()` (not a cooperative flag — RESEARCH §Q5 + §Recommendations #2: the byte-frozen sampler has no inner-loop emit point, so cooperative cancel is dead code in Phase 9 but wired for protocol-completeness).

Output:
- `src/main/sampler-worker.ts` (NEW, ~120 lines including file-level comment)
- `src/main/sampler-worker-bridge.ts` (NEW, ~80 lines) OR an inline shape inside `src/main/ipc.ts` (planner picks dedicated file for testability)
- `src/main/ipc.ts` extended with `'sampler:cancel'` handler + module-level `samplerWorkerHandle` ref
- `src/main/project-io.ts` lines 437-441 + 640-643 refactored to call `runSamplerInWorker(...)` instead of in-thread `sampleSkeleton`
- `src/preload/index.ts` extended with `onSamplerProgress` + `cancelSampler` (Pitfall 9 listener-identity preservation)
- `src/shared/types.ts` `Api` interface extended with the 2 new methods
- `src/renderer/src/components/AppShell.tsx` extended with: (a) `useEffect` subscribing to `onSamplerProgress` (Pitfall 9 cleanup), (b) `samplingInFlight` boolean state, (c) indeterminate CSS spinner overlay shown while sampling, (d) cancel hook fired before opening a different project mid-sample
- `electron.vite.config.ts` updated so the worker file emits as a separate bundle that Node's `new Worker(...)` can spawn (mirrors how the preload is emitted as `.cjs`)
- All Wave 0 RED scaffolds in `tests/main/sampler-worker.spec.ts`, `tests/main/sampler-worker-girl.spec.ts`, and the `'sampler:cancel'` block in `tests/main/ipc.spec.ts` flip GREEN
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md
@.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md
@CLAUDE.md
@src/main/image-worker.ts
@src/main/ipc.ts
@src/main/project-io.ts
@src/preload/index.ts
@src/shared/types.ts
@src/renderer/src/components/AppShell.tsx
@src/core/sampler.ts
@src/core/loader.ts
@tests/main/image-worker.spec.ts

<interfaces>
<!-- Phase 6 image-worker pattern + sampler entrypoint contract — what the executor MUST mirror. -->

From src/core/sampler.ts (BYTE-FROZEN — D-102; do not modify):
```ts
export function sampleSkeleton(load: LoadResult, opts: { samplingHz?: number } = {}): SamplerOutput;
export const DEFAULT_SAMPLING_HZ = 120;
// SamplerOutput = { globalPeaks: Map<attachmentKey, PeakRecord>, perAnimation: Map<...>, ... };
// PeakRecord is a plain object with primitives only — structured-clone-safe.
```

From src/core/loader.ts:225-239 (BYTE-FROZEN — D-102; do not modify):
```ts
const editorFps = skeletonData.fps || 30;
return { skeletonData, atlas, skeletonPath, atlasPath, editorFps, ... };
```

From src/main/image-worker.ts:97-103 (cooperative-cancel pattern — analog at Phase 6):
```ts
for (let i = 0; i < plan.rows.length; i++) {
  if (isCancelled()) { bailedOnCancel = true; break; }
  // ...
}
```

From src/main/ipc.ts:104-105 (module-level cancel state — analog):
```ts
let exportInFlight = false;
let exportCancelFlag = false;
```

From src/main/ipc.ts:471-482 (progress emission via evt.sender.send — analog):
```ts
const summary = await runExport(
  validPlan, outDir,
  (e) => { try { evt.sender.send('export:progress', e); } catch { /* webContents gone */ } },
  () => exportCancelFlag,
  overwrite,
);
```

From src/main/ipc.ts:515-519 (cancel channel — analog):
```ts
ipcMain.on('export:cancel', () => {
  exportCancelFlag = true;
});
```

From src/preload/index.ts:113-115 + :126-132 (one-way cancel + listener-identity-preserved subscription — analogs):
```ts
cancelExport: (): void => { ipcRenderer.send('export:cancel'); },
onExportProgress: (handler) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
  ipcRenderer.on('export:progress', wrapped);
  return () => { ipcRenderer.removeListener('export:progress', wrapped); };
},
```

From src/main/project-io.ts:437-441 (call site #1 — TO REFACTOR):
```ts
// 7. Re-sample. F9.2 "recomputes peaks". samplingHz threads from
//    materializeProjectFile (D-146 default 120 when null on disk).
const t0 = performance.now();
const samplerOutput = sampleSkeleton(load, { samplingHz: materialized.samplingHz });
const elapsedMs = Math.round(performance.now() - t0);
```

From src/main/project-io.ts:640-643 (call site #2 — TO REFACTOR):
```ts
const t0 = performance.now();
const samplerOutput = sampleSkeleton(load, { samplingHz });
const elapsedMs = Math.round(performance.now() - t0);
const summary = buildSummary(load, samplerOutput, elapsedMs);
```

From src/shared/types.ts (Api interface — TO EXTEND with onSamplerProgress + cancelSampler):
```ts
export interface Api {
  // ... existing 20+ methods ...
  onExportProgress: (handler: (event: ExportProgressEvent) => void) => () => void;
  cancelExport: () => void;
  // NEW Phase 9 D-194:
  onSamplerProgress: (handler: (percent: number) => void) => () => void;
  cancelSampler: () => void;
}
```

From src/renderer/src/components/AppShell.tsx existing IPC subscription pattern (mirror for Phase 9):
```ts
// Existing 8.2 D-175 listener pattern — Pitfall 9 cleanup (used elsewhere in App.tsx
// for onMenuOpen / onMenuSave / etc):
useEffect(() => {
  const unsubscribe = window.api.onMenuOpen(() => onClickOpen());
  return unsubscribe;
}, [onClickOpen]);
```
</interfaces>

<worker_protocol_specification>
<!-- The exact discriminated union that crosses the postMessage boundary. Embed verbatim
     in src/main/sampler-worker.ts so the executor doesn't have to reconstruct it. -->

Worker → main:
```ts
type SamplerWorkerOutbound =
  | { type: 'progress'; percent: number }
  | { type: 'complete'; output: SamplerOutput }
  | { type: 'cancelled' }
  | { type: 'error'; error: SerializableError };
```

Main → worker:
```ts
type SamplerWorkerInbound = { type: 'cancel' };
```

workerData (input to the worker on spawn):
```ts
type SamplerWorkerData = {
  skeletonPath: string;        // absolute path; worker re-loads JSON itself
  atlasRoot?: string;          // optional override; default = skeleton sibling lookup
  samplingHz: number;          // 60 / 120 / 240 / custom; default 120 per CLAUDE.md fact #6
};
```

These types live in `src/shared/types.ts` (extending the existing types module) so the worker, the bridge, and downstream consumers all reference the same shape. Add them to types.ts before authoring the worker.
</worker_protocol_specification>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Author src/main/sampler-worker.ts + src/main/sampler-worker-bridge.ts (greenfield worker_threads spawn)</name>
  <files>
    src/shared/types.ts,
    src/main/sampler-worker.ts,
    src/main/sampler-worker-bridge.ts,
    electron.vite.config.ts
  </files>
  <read_first>
    - src/main/image-worker.ts (full file — file-level comment style + cooperative-cancel pattern + error envelope shape; THE CANONICAL ANALOG even though it is NOT a real worker_threads Worker)
    - src/core/sampler.ts:1-141 (sampleSkeleton signature + DEFAULT_SAMPLING_HZ + the byte-frozen invariant block-comment at :41-44 — the worker WRAPS this without modification)
    - src/core/loader.ts:130-240 (loadSkeleton signature + editorFps surface)
    - src/shared/types.ts:480-535 (SerializableError discriminated union — error envelope the worker emits)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Q2 Node worker_threads cancellation" + §"Q3 SkeletonData re-load cost" + §"Q4 Progress cadence" + §"Pitfall 4 SkeletonData circular refs" + §"Pitfall 6 worker.terminate does NOT run finally blocks")
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/main/sampler-worker.ts" + §"src/main/sampler-worker-bridge.ts" — the greenfield shape + the postMessage protocol)
    - electron.vite.config.ts (current main bundle config — worker entry point must be added so `new Worker(workerPath)` resolves to the built artifact at runtime)
  </read_first>
  <behavior>
    - Worker spawn: `new Worker(workerPath, { workerData: { skeletonPath, atlasRoot, samplingHz } })` succeeds in production (built bundle) AND in tests (vitest + tsx ESM resolution)
    - Path-based protocol (D-193): the worker calls `loadSkeleton` + `sampleSkeleton` itself; SkeletonData NEVER crosses postMessage
    - `runSamplerJob({ skeletonPath, atlasRoot, samplingHz, onProgress, isCancelled })` is exported as a plain async function from sampler-worker.ts so vitest can unit-test it WITHOUT spawning a Worker (mirrors image-worker.spec.ts strategy)
    - Worker emits `{type:'progress', percent:0}` immediately on start (acknowledges receipt) and `{type:'complete', output}` when done; intermediate progress is INDETERMINATE per RESEARCH §Q4 (sampler is byte-frozen — no inner-loop emit point)
    - Cancel via cooperative flag is wired (`parentPort.on('message', msg => { if (msg?.type === 'cancel') cancelled = true; })`) but in Phase 9 only `worker.terminate()` from the bridge actually stops in-flight work — documented in the file-level block-comment per RESEARCH §Recommendations #2
    - Error envelope: worker catches SpineLoaderError + Error and posts `{type:'error', error: { kind, message }}` — never a stack trace (T-01-02-02 information disclosure)
    - Layer 3 invariant: worker imports ONLY from `node:worker_threads`, `node:path`, `../core/loader.js`, `../core/sampler.js`, `../shared/types.js` — NO `electron`, NO `react`, NO `src/renderer/`, NO DOM globals
    - Bridge `runSamplerInWorker(params, webContents)` returns a Promise resolving to `{type:'complete'|'cancelled'|'error', ...}`; relays progress events to `webContents.send('sampler:progress', percent)` defensively (try/catch — webContents may be gone)
    - Module-level `samplerWorkerHandle: Worker | null` is exported (or set via setter) so `'sampler:cancel'` IPC handler can call `samplerWorkerHandle?.terminate()` from a different module
    - `worker.terminate()` from the bridge resolves the Promise with `{type:'cancelled'}` within ≤200 ms
  </behavior>
  <action>
### Step 1: Extend `src/shared/types.ts`

Add the 4 new types BEFORE the `Api` interface declaration:

```ts
/**
 * Phase 9 D-193 + D-194 — sampler-worker postMessage protocol types.
 * Worker → main: discriminated union of progress/complete/cancelled/error.
 * Main → worker: cancel-only.
 * workerData: path-based input — SkeletonData NEVER crosses postMessage
 * (Pitfall 4: Spine class instances lose their prototypes through
 * structured-clone). The worker calls loadSkeleton itself.
 *
 * Note: SamplerOutput's globalPeaks is a Map<string, PeakRecord> where
 * PeakRecord is a plain interface with primitives only (sampler.ts:97-100,
 * 119-123) — structured-clone-safe. Maps are explicitly clonable per
 * the structured-clone algorithm.
 */
export type SamplerWorkerOutbound =
  | { type: 'progress'; percent: number }
  | { type: 'complete'; output: SamplerOutput }
  | { type: 'cancelled' }
  | { type: 'error'; error: SerializableError };

export type SamplerWorkerInbound = { type: 'cancel' };

export interface SamplerWorkerData {
  skeletonPath: string;
  atlasRoot?: string;
  samplingHz: number;
}

// SamplerOutput is already exported from src/core/sampler.ts; re-export here
// for the worker's import surface so the worker file does NOT need to import
// from src/core/* — but the worker is in src/main/ which CAN import core/.
// This type alias just makes the protocol self-contained.
import type { SamplerOutput } from '../core/sampler.js';
```

If `SamplerOutput` is not currently exported from `src/core/sampler.ts`, do NOT modify sampler.ts (D-102 byte-frozen). Instead, define a structurally-compatible interface in types.ts:

```ts
// If sampler.ts does not export SamplerOutput, declare the structural
// shape here (mirroring what sampler.ts:97-141 actually returns). This
// is read-only metadata — the byte-frozen sampler.ts is the canonical
// source.
export interface SamplerOutputShape {
  globalPeaks: Map<string, /* PeakRecord */ unknown>;
  perAnimation: Map<string, Map<string, unknown>>;
  // ... fill from sampler.ts return type when authoring
}
```

(In practice, sampler.ts likely DOES export SamplerOutput — verify with `grep -n "export" src/core/sampler.ts`. If yes, just import it. If no, the structural shape above is the fallback.)

Also extend the `Api` interface:
```ts
export interface Api {
  // ... existing methods ...

  /**
   * Phase 9 D-194 — subscribe to streaming sampler progress events.
   * Returns an unsubscribe function. Pitfall 9 listener-identity preservation
   * (mirrors onExportProgress at preload/index.ts:126-132).
   *
   * Progress is INDETERMINATE per RESEARCH §Q4: percent is 0 on start and
   * 100 on complete; intermediate values do not arrive because the byte-frozen
   * sampler has no inner-loop emit point. The renderer SHOULD show an
   * indeterminate spinner, not a determinate progress bar.
   */
  onSamplerProgress: (handler: (percent: number) => void) => () => void;

  /**
   * Phase 9 D-194 — fire-and-forget cancel signal. Main routes this to
   * samplerWorkerHandle?.terminate() (RESEARCH §Q5: terminate() is the
   * actual cancellation mechanism since the byte-frozen sampler has no
   * inner-loop flag-check point).
   */
  cancelSampler: () => void;
}
```

### Step 2: Author `src/main/sampler-worker.ts`

```ts
/**
 * Phase 9 Plan 02 — Sampler worker (Node `worker_threads`).
 *
 * D-190: built UNCONDITIONALLY (overrides ROADMAP "if profiling shows jank").
 * D-193: PATH-BASED protocol — workerData is { skeletonPath, atlasRoot,
 *   samplingHz }; the worker re-loads the JSON inside the worker process.
 *   SkeletonData NEVER crosses the postMessage boundary (Pitfall 4: Spine
 *   class instances lose their prototypes through structured-clone).
 * D-194: emits {type:'progress', percent} events + supports {type:'cancel'}
 *   inbound; mirrors the Phase 6 'export:progress' + 'export:cancel' shape
 *   (but the underlying mechanism differs — see CANCELLATION below).
 *
 * Two surfaces exported:
 *   1. The worker entrypoint (parentPort.on('message') wiring at module load
 *      time — runs only when Node's worker_threads instantiates this file
 *      via `new Worker(workerPath, { workerData })`).
 *   2. `runSamplerJob({ skeletonPath, atlasRoot, samplingHz, onProgress,
 *      isCancelled })` — a plain async function that vitest unit-tests can
 *      invoke WITHOUT spawning a Worker. Mirrors image-worker.spec.ts's
 *      `runExport` strategy (RESEARCH §Pattern lineage).
 *
 * CANCELLATION (RESEARCH §Q5 + §Recommendations #2):
 *   The byte-frozen sampler (D-102) is one uninterruptible synchronous call;
 *   cooperative flag-checking inside it would require modifying sampler.ts
 *   which is forbidden. Therefore:
 *     - Cooperative flag IS wired (parentPort listens for {type:'cancel'}
 *       and sets a module-level `cancelled` flag).
 *     - The flag is checked BEFORE and AFTER the sampleSkeleton() call only.
 *       If cancel arrives mid-sample, the flag is read AFTER the sample
 *       completes (negligible window; the user sees a delayed-but-eventual
 *       'cancelled' response).
 *     - The PRACTICAL cancellation mechanism is `worker.terminate()` from
 *       the bridge (sampler-worker-bridge.ts). Node's terminate() halts JS
 *       execution as soon as possible (typically <50 ms for JS-bound
 *       workers, comfortably under the ≤200 ms D-194 budget).
 *     - terminate() does NOT run try/finally blocks (Pitfall 6). The worker
 *       owns no resources (pure compute job — N2.3 forbids fs I/O in the
 *       sampler hot loop) so this is safe.
 *
 * PROGRESS (RESEARCH §Q4):
 *   The byte-frozen sampler has no inner-loop emit point. The worker emits
 *   `{type:'progress', percent:0}` on start (acknowledges receipt) and
 *   `{type:'complete', output}` on finish — there is no intermediate cadence.
 *   The renderer shows an INDETERMINATE spinner per RESEARCH §Recommendations
 *   #3, not a determinate progress bar.
 *
 * LAYER 3 INVARIANT:
 *   This file imports ONLY from node:worker_threads + node:path + ../core/* +
 *   ../shared/types — NO electron, NO react, NO src/renderer/, NO DOM globals.
 *   Enforced by tests/arch.spec.ts Phase 9 named-anchor block (Wave 0
 *   landed the assertion; this Wave 1 author is what makes it pass).
 *
 * IMPORT NOTE for ESM workers:
 *   Node's worker_threads runs this file as a STANDALONE entrypoint. The
 *   imports must be resolvable in the production bundle — electron-vite
 *   emits this file as a separate bundle (see electron.vite.config.ts
 *   updates in Task 1). In dev, electron-vite's HMR + tsx loader handle
 *   the .ts → .js resolution.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton, type SamplerOutput } from '../core/sampler.js';
import { SpineLoaderError } from '../core/errors.js';
import type {
  SamplerWorkerData,
  SamplerWorkerInbound,
  SamplerWorkerOutbound,
  SerializableError,
} from '../shared/types.js';

let cancelled = false;

/**
 * Plain async function — vitest unit-tests invoke this directly without
 * spawning a Worker. Mirrors image-worker.spec.ts strategy.
 *
 * onProgress + isCancelled are injected so this function works both inside
 * the Worker (callbacks bridge to parentPort) and inside vitest (callbacks
 * are vi.fn mocks).
 */
export async function runSamplerJob(params: {
  skeletonPath: string;
  atlasRoot?: string;
  samplingHz: number;
  onProgress: (percent: number) => void;
  isCancelled: () => boolean;
}): Promise<SamplerWorkerOutbound> {
  try {
    params.onProgress(0);

    if (params.isCancelled()) return { type: 'cancelled' };

    const load = loadSkeleton(
      params.skeletonPath,
      params.atlasRoot ? { atlasPath: params.atlasRoot } : {},
    );

    if (params.isCancelled()) return { type: 'cancelled' };

    // The byte-frozen sampler (D-102) — single uninterruptible call.
    // Cooperative flag-check is impossible inside this call without
    // modifying sampler.ts. terminate() from the bridge is the actual
    // cancellation mechanism for in-flight cancels (see file header).
    const output: SamplerOutput = sampleSkeleton(load, { samplingHz: params.samplingHz });

    if (params.isCancelled()) return { type: 'cancelled' };

    params.onProgress(100);
    return { type: 'complete', output };
  } catch (err) {
    return {
      type: 'error',
      error: serializeError(err),
    };
  }
}

function serializeError(err: unknown): SerializableError {
  if (err instanceof SpineLoaderError) {
    // Forward .name as the discriminator. T-01-02-02 information-disclosure
    // mitigation: only kind + message; never the stack trace.
    return {
      kind: err.name as Exclude<SerializableError['kind'], 'SkeletonNotFoundOnLoadError'>,
      message: err.message,
    };
  }
  return {
    kind: 'Unknown',
    message: err instanceof Error ? err.message : String(err),
  };
}

// ---------------------------------------------------------------------------
// Worker entrypoint — runs ONLY when this file is loaded as the entry of
// `new Worker(workerPath, { workerData })`. parentPort is null in normal
// imports (e.g. when vitest imports runSamplerJob directly), so the wiring
// below short-circuits cleanly during unit tests.
// ---------------------------------------------------------------------------
if (parentPort !== null) {
  parentPort.on('message', (msg: SamplerWorkerInbound) => {
    if (msg?.type === 'cancel') cancelled = true;
  });

  const data = workerData as SamplerWorkerData;
  void runSamplerJob({
    skeletonPath: data.skeletonPath,
    atlasRoot: data.atlasRoot,
    samplingHz: data.samplingHz,
    onProgress: (percent) => parentPort!.postMessage({ type: 'progress', percent } satisfies SamplerWorkerOutbound),
    isCancelled: () => cancelled,
  }).then((result) => {
    parentPort!.postMessage(result);
    // After posting the final message, exit cleanly. The bridge's worker.on('exit')
    // handler clears samplerWorkerHandle. process.exit(0) is intentional — it
    // prevents the worker's event loop from keeping the process alive after
    // the sample completes (no other event sources are wired).
    process.exit(0);
  });
}
```

### Step 3: Author `src/main/sampler-worker-bridge.ts`

```ts
/**
 * Phase 9 Plan 02 — Sampler worker bridge.
 *
 * Spawns src/main/sampler-worker.ts as a Node worker_threads Worker, relays
 * progress events to the renderer via webContents.send('sampler:progress', ...),
 * and exposes a module-level Worker handle so the 'sampler:cancel' IPC
 * handler in src/main/ipc.ts can call .terminate() to abort in-flight work.
 *
 * Mirrors src/main/ipc.ts:471-482 (the runExport invocation site) at the
 * orchestration layer; the WORKER SPAWN itself is greenfield (the project's
 * first true worker_threads usage).
 *
 * Cancellation: D-194 + RESEARCH §Q5 — terminate() resolves the in-flight
 * Promise with {type:'cancelled'}, typically within <50 ms (≤200 ms budget).
 *
 * The path resolution to the built worker bundle differs between dev (vite
 * dev server: src/main/sampler-worker.ts compiled on-the-fly) and prod
 * (out/main/sampler-worker.cjs emitted by electron-builder). Use
 * `import.meta.url` + `URL` resolution OR a hard-coded relative path that
 * works for the built bundle. See electron.vite.config.ts updates in
 * Step 4 below.
 */
import { Worker } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname } from 'node:path';
import type {
  SamplerWorkerData,
  SamplerWorkerOutbound,
} from '../shared/types.js';

// Module-level handle. Read by the 'sampler:cancel' IPC handler in
// src/main/ipc.ts (which calls samplerWorkerHandle?.terminate()).
// The bridge sets it on spawn and clears it on resolve/reject.
let samplerWorkerHandle: Worker | null = null;

export function getSamplerWorkerHandle(): Worker | null {
  return samplerWorkerHandle;
}

/**
 * Spawn the sampler worker, await its outcome, relay progress to webContents.
 *
 * Returns the discriminated-union outcome verbatim from the worker. The
 * caller (src/main/project-io.ts) decides what to do with each kind:
 *   - 'complete' → use output.globalPeaks, build the summary, return ok:true
 *   - 'cancelled' → return ok:false with kind:'Unknown' message:'Sampling cancelled.'
 *   - 'error' → forward error envelope to renderer
 */
export function runSamplerInWorker(
  params: SamplerWorkerData,
  webContents: Electron.WebContents | null,
): Promise<SamplerWorkerOutbound> {
  return new Promise<SamplerWorkerOutbound>((resolve) => {
    // Resolve the worker bundle path. In production the file is emitted as
    // out/main/sampler-worker.cjs (electron-vite config); in dev the dev
    // server serves src/main/sampler-worker.ts via tsx.
    const here = dirname(fileURLToPath(import.meta.url));
    const workerPath = pathResolve(here, 'sampler-worker.cjs');

    let worker: Worker;
    try {
      worker = new Worker(workerPath, { workerData: params });
    } catch (err) {
      resolve({
        type: 'error',
        error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
      });
      return;
    }

    samplerWorkerHandle = worker;

    worker.on('message', (msg: SamplerWorkerOutbound) => {
      if (msg.type === 'progress') {
        // Defensive try/catch — webContents may be gone if the renderer
        // closed mid-sample (mirrors src/main/ipc.ts:474-479 'export:progress'
        // emission pattern).
        try {
          webContents?.send('sampler:progress', msg.percent);
        } catch {
          /* webContents gone */
        }
        return;
      }
      // complete / cancelled / error — final messages.
      samplerWorkerHandle = null;
      resolve(msg);
      void worker.terminate();
    });

    worker.on('error', (err) => {
      samplerWorkerHandle = null;
      resolve({
        type: 'error',
        error: { kind: 'Unknown', message: err.message },
      });
    });

    worker.on('exit', () => {
      // If the worker exits BEFORE posting a final message (terminate() from
      // ipc.ts cancel handler races the message), resolve with 'cancelled'.
      // Subsequent message events are no-ops because the Promise is single-shot.
      if (samplerWorkerHandle === worker) {
        samplerWorkerHandle = null;
        resolve({ type: 'cancelled' });
      }
    });
  });
}
```

### Step 4: Update `electron.vite.config.ts`

The worker file MUST be emitted as a separate bundle so `new Worker(workerPath)` resolves at runtime. Mirror how the preload is emitted as `.cjs`:

```ts
// In the existing main.build.rollupOptions.input config (or equivalent):
{
  main: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          // Phase 9 Plan 02 D-190 — sampler worker emitted as a separate
          // bundle so new Worker(...) can spawn it at runtime. Mirrors
          // how the preload is emitted as a separate bundle.
          'sampler-worker': resolve(__dirname, 'src/main/sampler-worker.ts'),
        },
        output: {
          // Existing config — ensure entry chunks emit as .cjs (workers
          // run as Node modules; the existing main bundle is already CJS).
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  // ... preload + renderer configs unchanged ...
}
```

After the build runs, `out/main/sampler-worker.cjs` MUST exist. The bridge's `pathResolve(here, 'sampler-worker.cjs')` resolves to this file in production; in dev electron-vite's HMR handles the .ts entry directly.

If the existing `electron.vite.config.ts` does NOT use `rollupOptions.input` (it might use a single-entry shorthand), refactor to the multi-input shape above. Run `npx electron-vite build` and verify `out/main/sampler-worker.cjs` exists in the build output.
  </action>
  <verify>
    <automated>npm run test tests/main/sampler-worker.spec.ts -- -t "byte-identical|progress|cancel|error" && npx tsc --noEmit -p tsconfig.node.json && grep -q "import { parentPort, workerData } from 'node:worker_threads'" src/main/sampler-worker.ts && grep -q "new Worker" src/main/sampler-worker-bridge.ts && ! grep -E "from ['\"]electron['\"]|from ['\"]react['\"]|from ['\"][^'\"]*\/renderer\/" src/main/sampler-worker.ts && npx electron-vite build && test -f out/main/sampler-worker.cjs</automated>
  </verify>
  <acceptance_criteria>
    - `src/main/sampler-worker.ts` exists; line count ≥ 80; contains `import { parentPort, workerData } from 'node:worker_threads'`
    - `src/main/sampler-worker.ts` does NOT contain `from 'electron'`, `from 'react'`, or any path matching `\/renderer\/`
    - `src/main/sampler-worker.ts` exports `runSamplerJob` as a named export (vitest unit-tests can import it directly)
    - `src/main/sampler-worker-bridge.ts` exists; contains `new Worker` and `runSamplerInWorker` exports
    - `src/main/sampler-worker-bridge.ts` exports `getSamplerWorkerHandle` (used by ipc.ts cancel handler in Task 2)
    - `src/shared/types.ts` exports `SamplerWorkerOutbound`, `SamplerWorkerInbound`, `SamplerWorkerData` and the `Api` interface contains `onSamplerProgress` + `cancelSampler`
    - `electron.vite.config.ts` declares `sampler-worker` as a second main-bundle input
    - `npx tsc --noEmit -p tsconfig.node.json` exits 0
    - `npx electron-vite build` exits 0; `out/main/sampler-worker.cjs` exists in the build output
    - `tests/main/sampler-worker.spec.ts` cases (a) byte-identical, (b) progress, (c) cancel, (d) error — at least the function-extract subset (a/b/d) flip GREEN; the spawn-smoke + cancel-via-terminate cases may stay RED until Task 2 lands the bridge wiring (acceptable interim state — Task 3 closes them)
    - `src/core/sampler.ts` and `scripts/cli.ts` are byte-identical to commit eb97923 baseline (`git diff eb97923 -- src/core/sampler.ts scripts/cli.ts` exits 0 with empty output)
  </acceptance_criteria>
  <done>The greenfield worker_threads worker + its bridge ship; runSamplerJob is unit-testable; the worker bundle emits at out/main/sampler-worker.cjs; tests/arch.spec.ts Phase 9 anchor block now hits real assertions (the file exists) and PASSES; D-102 byte-frozen invariants preserved.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire the IPC channels + refactor project-io.ts call sites + extend preload + AppShell spinner UI</name>
  <files>
    src/main/ipc.ts,
    src/main/project-io.ts,
    src/preload/index.ts,
    src/renderer/src/components/AppShell.tsx,
    tests/main/ipc.spec.ts
  </files>
  <read_first>
    - src/main/ipc.ts:104-105 + :471-482 + :515-519 (cancel-flag, progress emission, channel registration patterns — analogs)
    - src/main/project-io.ts:280-468 (handleProjectOpenFromPath full body — call site #1 at :437-441)
    - src/main/project-io.ts:540-669 (handleProjectReloadWithSkeleton full body — call site #2 at :640-643)
    - src/preload/index.ts:113-115 + :126-132 (cancelExport + onExportProgress — exact byte-for-byte mirrors except channel + payload)
    - src/renderer/src/components/AppShell.tsx full file (existing IPC subscription patterns; filename chip area; staleOverrideNotice banner area for spinner placement)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"src/main/ipc.ts (MOD)" + §"src/preload/index.ts (MOD)" + §"src/main/project-io.ts (MOD)" + §"src/renderer/src/components/AppShell.tsx (MOD)" — verbatim before/after excerpts)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Pitfall 5 listener identity" + §"Q4 indeterminate progress")
    - tests/main/ipc.spec.ts (existing Map captor at :25-77 + 'menu:notify-state' test pattern at :101-114 — analogs for the new sampler:cancel test)
  </read_first>
  <behavior>
    - `'sampler:cancel'` IPC channel registered on ipcMain.on; handler calls `getSamplerWorkerHandle()?.terminate()` and is idempotent (no-op when no worker is in flight)
    - `'sampler:progress'` events emit from the bridge's worker.on('message') handler; renderer subscribes via `window.api.onSamplerProgress`
    - `src/main/project-io.ts` lines 437-441 + 640-643 dispatch through `runSamplerInWorker(...)` instead of in-thread `sampleSkeleton(...)`; both return paths preserve the existing `buildSummary(load, samplerOutput, elapsedMs)` signature
    - `src/preload/index.ts` exposes `onSamplerProgress` + `cancelSampler` with Pitfall 9 listener-identity preservation
    - `AppShell.tsx`: while `samplingInFlight === true`, an indeterminate CSS spinner is visible (not a determinate progress bar — RESEARCH §Q4); spinner clears on `complete` / `cancelled` / `error`
    - Cancel hook: when AppShell.onClickOpen is invoked while `samplingInFlight`, it calls `window.api.cancelSampler()` BEFORE dispatching the new open (08.2 menu Open mid-sample scenario)
    - Wave 0 RED scaffolds in tests/main/ipc.spec.ts ('Phase 9 D-194 — sampler IPC channels' describe block) flip GREEN
    - tests/main/sampler-worker.spec.ts Worker-spawn smoke test + cancel-via-terminate test flip GREEN
  </behavior>
  <action>
### Edit 1: `src/main/ipc.ts` — add `'sampler:cancel'` handler

Inside `registerIpcHandlers()`, AFTER the existing `'export:cancel'` handler (around line 519), APPEND:

```ts
// Phase 9 Plan 02 D-194 — forceful sampler cancel via worker.terminate().
// The byte-frozen sampler (D-102) has no inner-loop emit point so cooperative
// flag-checking is impossible. terminate() halts JS execution as soon as
// possible (typically <50 ms; ≤200 ms budget per D-194). Pitfall 6: terminate
// does NOT run finally blocks — Phase 9 worker has no resources to clean up
// (pure compute job per N2.3) so this is safe.
//
// Trust boundary (T-09-02-IPC-01): renderer-origin one-way send with no
// payload. Idempotent: if no worker is in flight, terminate() is a no-op.
// We do NOT additionally validate evt.sender — the contextBridge surface
// only exposes cancelSampler() to the trusted renderer; auto-mounting at
// app.whenReady ensures only the main BrowserWindow's webContents can fire
// this channel.
ipcMain.on('sampler:cancel', () => {
  const handle = getSamplerWorkerHandle();
  if (handle !== null) {
    void handle.terminate();
  }
});
```

Add the import at the top of ipc.ts (after the existing project-io imports, around line 54):
```ts
import { getSamplerWorkerHandle, runSamplerInWorker } from './sampler-worker-bridge.js';
```

### Edit 2: `src/main/project-io.ts` — refactor lines 437-441

Replace:
```ts
// 7. Re-sample. F9.2 "recomputes peaks". samplingHz threads from
//    materializeProjectFile (D-146 default 120 when null on disk).
const t0 = performance.now();
const samplerOutput = sampleSkeleton(load, { samplingHz: materialized.samplingHz });
const elapsedMs = Math.round(performance.now() - t0);
```

With:
```ts
// 7. Re-sample. F9.2 "recomputes peaks". samplingHz threads from
//    materializeProjectFile (D-146 default 120 when null on disk).
//
// Phase 9 Plan 02 D-190 + D-193 — sampling offloaded to a worker_threads
// Worker (path-based protocol; SkeletonData never crosses postMessage).
// The `load` variable above is preserved for buildSummary's load-time
// metadata (skeletonPath, atlasPath, editorFps); only sampleSkeleton is
// moved to the worker. The small load duplication is the cost of D-193's
// no-circular-refs protocol (RESEARCH §Q3: <2% overhead vs sampling cost).
const t0 = performance.now();
const samplerResult = await runSamplerInWorker(
  {
    skeletonPath: materialized.skeletonPath,
    atlasRoot: materialized.atlasPath !== null ? materialized.atlasPath : undefined,
    samplingHz: materialized.samplingHz,
  },
  BrowserWindow.getAllWindows()[0]?.webContents ?? null,
);
if (samplerResult.type !== 'complete') {
  return {
    ok: false,
    error: samplerResult.type === 'cancelled'
      ? { kind: 'Unknown', message: 'Sampling cancelled.' }
      : samplerResult.error,
  };
}
const samplerOutput = samplerResult.output;
const elapsedMs = Math.round(performance.now() - t0);
```

Add the imports at the top of project-io.ts:
```ts
import { BrowserWindow } from 'electron';
import { runSamplerInWorker } from './sampler-worker-bridge.js';
```

(Note: BrowserWindow may already be imported via another module; verify with grep before adding the import.)

Apply the SAME refactor to lines 640-643 inside `handleProjectReloadWithSkeleton`. The replacement uses `a.newSkeletonPath` for skeletonPath and `samplingHz` (the local variable) instead of `materialized.samplingHz`:

```ts
const t0 = performance.now();
const samplerResult = await runSamplerInWorker(
  {
    skeletonPath: a.newSkeletonPath,
    atlasRoot: undefined, // F1.2 sibling auto-discovery applies (D-152)
    samplingHz,
  },
  BrowserWindow.getAllWindows()[0]?.webContents ?? null,
);
if (samplerResult.type !== 'complete') {
  return {
    ok: false,
    error: samplerResult.type === 'cancelled'
      ? { kind: 'Unknown', message: 'Sampling cancelled.' }
      : samplerResult.error,
  };
}
const samplerOutput = samplerResult.output;
const elapsedMs = Math.round(performance.now() - t0);
const summary = buildSummary(load, samplerOutput, elapsedMs);
```

The function signatures of `handleProjectOpenFromPath` and `handleProjectReloadWithSkeleton` MUST stay unchanged — they were `async` already, so the new `await runSamplerInWorker(...)` is a drop-in.

`buildSummary(load, samplerOutput, elapsedMs)` invocation is preserved verbatim — the worker returns the same SamplerOutput shape that in-thread sampleSkeleton returns (D-193 + Pitfall 4: the worker re-loads the JSON; the output crosses postMessage as a structured-cloned Map of plain records).

### Edit 3: `src/preload/index.ts` — add `onSamplerProgress` + `cancelSampler`

After the existing `onExportProgress` definition (around line 132), APPEND:

```ts
// -------------------------------------------------------------------------
// Phase 9 Plan 02 D-194 — sampler progress + cancel bridges. Mirror byte-
// for-byte the export pattern at lines 113-115 + 126-132 (channel renames
// and payload type only).
// -------------------------------------------------------------------------

/**
 * Phase 9 D-194 — subscribe to streaming sampler progress events.
 * Returns an unsubscribe function. Pitfall 9 listener-identity preservation:
 * the wrapped const is captured BEFORE ipcRenderer.on so removeListener
 * targets the SAME reference.
 *
 * Progress is INDETERMINATE per RESEARCH §Q4: the byte-frozen sampler has
 * no inner-loop emit point, so percent is 0 on start and 100 on complete
 * — no intermediate values. The renderer SHOULD show an indeterminate
 * spinner.
 */
onSamplerProgress: (handler: (percent: number) => void) => {
  const wrapped = (_evt: Electron.IpcRendererEvent, percent: number) => handler(percent);
  ipcRenderer.on('sampler:progress', wrapped);
  return () => {
    ipcRenderer.removeListener('sampler:progress', wrapped);
  };
},

/**
 * Phase 9 D-194 — fire-and-forget cancel signal. Main routes this to
 * worker.terminate() (RESEARCH §Q5 — actual cancellation primitive).
 */
cancelSampler: (): void => {
  ipcRenderer.send('sampler:cancel');
},
```

These methods MUST appear inside the literal `api: Api` object that contextBridge exposes — the closed-list surface enforcement (preload/index.ts:50) means a method declared on the `Api` interface but missing from the literal `api = { ... }` object will not be reachable from the renderer.

### Edit 4: `src/renderer/src/components/AppShell.tsx` — sampling spinner + cancel hook

Add a new state variable near the top of the component (after the existing `useState` declarations around line 130):

```ts
// Phase 9 Plan 02 D-194 — sampling-in-flight UI surface. Indeterminate
// progress per RESEARCH §Q4 (byte-frozen sampler has no inner-loop emit
// point; intermediate percent values do not arrive).
const [samplingInFlight, setSamplingInFlight] = useState<boolean>(false);
```

Add the IPC subscription useEffect (mirror the existing menu-listener pattern):

```ts
// Phase 9 Plan 02 D-194 — subscribe to sampler progress events.
// Pitfall 9 + 15 (RESEARCH): cleanup MUST return the unsubscribe closure;
// the wrapped const inside preload preserves listener identity so
// removeListener actually removes the subscription.
//
// Progress is indeterminate (0 → 100, no intermediate ticks). We toggle
// samplingInFlight on receipt of `0` (sampling started) and clear it on
// `100` (sampling completed). On cancel/error the bridge does NOT emit
// a final progress event — clearing happens via the project-open
// continuation (the open returns ok:false; setSamplingInFlight(false)
// runs in the open's catch arm — see onClickOpen below).
useEffect(() => {
  const unsubscribe = window.api.onSamplerProgress((percent) => {
    if (percent === 0) setSamplingInFlight(true);
    else if (percent >= 100) setSamplingInFlight(false);
  });
  return unsubscribe;
}, []);
```

Update `onClickOpen` (the existing toolbar-Open / menu-Open handler) to fire `cancelSampler` BEFORE dispatching a new open if a sample is currently in flight:

```ts
const onClickOpen = useCallback(async () => {
  // Phase 9 Plan 02 D-194 — if a sample is in flight (e.g., user clicked
  // Cmd+O via the 08.2 menu while the previous Open's sample is still
  // running), abort the in-flight sample first. Otherwise the new Open's
  // sample contests for the same module-level samplerWorkerHandle, and
  // the user briefly sees stale peaks from the old project.
  if (samplingInFlight) {
    window.api.cancelSampler();
    // Optimistic UI clear — the cancelled response will arrive shortly via
    // the open's ok:false branch but clearing immediately gives crisper UX.
    setSamplingInFlight(false);
  }
  // ... existing onClickOpen body unchanged ...
}, [samplingInFlight, /* existing deps */]);
```

Surface the spinner UI in the header area (just above the existing `<header>` content or as a thin strip below it; mirror the staleOverrideNotice banner shape at AppShell.tsx:866-891 for stylistic consistency):

```tsx
{/* Phase 9 Plan 02 D-194 — indeterminate sampling spinner. Surfaces while
    a sample is in flight (worker spawn → sampleSkeleton → complete/cancel).
    Indeterminate CSS animation per RESEARCH §Q4 (no determinate percent
    available because sampler is byte-frozen — no inner-loop emit point). */}
{samplingInFlight && (
  <div
    role="status"
    aria-live="polite"
    aria-label="Sampling skeleton"
    className="border-b border-border bg-panel px-6 py-2 text-xs text-fg-muted flex items-center gap-2"
  >
    <span
      className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin"
      aria-hidden="true"
    />
    <span>Sampling skeleton…</span>
  </div>
)}
```

If `animate-spin` is not in the existing Tailwind config, use a plain CSS class on a small inline style. The exact spinner styling is planner discretion within the constraint that it MUST be indeterminate (RESEARCH §Recommendations #3).

### Edit 5: `tests/main/ipc.spec.ts` — flip the Wave 0 RED scaffold to GREEN

Update the `'Phase 9 D-194 — sampler IPC channels'` describe block to actually exercise the registration:

```ts
describe("Phase 9 D-194 — sampler IPC channels", () => {
  it("sampler:cancel handler is registered on ipcMain.on", async () => {
    registerIpcHandlers();
    expect(ipcMainOnHandlers.has('sampler:cancel')).toBe(true);
  });

  it("sampler:cancel handler invocation does not throw when no worker is in flight", async () => {
    registerIpcHandlers();
    const handler = ipcMainOnHandlers.get('sampler:cancel');
    expect(handler).toBeDefined();
    // No worker spawned — terminate() is a no-op via getSamplerWorkerHandle()=null
    expect(() => handler!({} as unknown)).not.toThrow();
  });
});
```

Mock `./sampler-worker-bridge.js` so `getSamplerWorkerHandle` returns null in this test:
```ts
vi.mock('../../src/main/sampler-worker-bridge.js', () => ({
  getSamplerWorkerHandle: vi.fn(() => null),
  runSamplerInWorker: vi.fn(),
}));
```
  </action>
  <verify>
    <automated>npm run test tests/main/ipc.spec.ts -- -t "sampler" && npm run test tests/main/sampler-worker.spec.ts && grep -q "ipcMain.on('sampler:cancel'" src/main/ipc.ts && grep -q "onSamplerProgress" src/preload/index.ts && grep -q "cancelSampler" src/preload/index.ts && grep -q "runSamplerInWorker" src/main/project-io.ts && grep -q "samplingInFlight" src/renderer/src/components/AppShell.tsx && npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json</automated>
  </verify>
  <acceptance_criteria>
    - `src/main/ipc.ts` contains exactly one `ipcMain.on('sampler:cancel'` registration; handler body calls `getSamplerWorkerHandle()?.terminate()` (or `handle.terminate()` after a null check)
    - `src/main/ipc.ts` imports `getSamplerWorkerHandle` and `runSamplerInWorker` from `./sampler-worker-bridge.js`
    - `src/main/project-io.ts` no longer contains direct `sampleSkeleton(load, ...)` calls inside `handleProjectOpenFromPath` or `handleProjectReloadWithSkeleton`; instead contains `await runSamplerInWorker(...)` at lines (formerly) 440 and 641
    - `src/preload/index.ts` `api` literal contains `onSamplerProgress` and `cancelSampler` methods (NOT just declared on the Api interface)
    - `src/preload/index.ts` `onSamplerProgress` body captures a `wrapped` const before `ipcRenderer.on('sampler:progress', wrapped)` and the unsubscribe closure references the SAME `wrapped` reference (Pitfall 9)
    - `src/renderer/src/components/AppShell.tsx` contains `useState<boolean>(false)` for `samplingInFlight`, a `useEffect` calling `window.api.onSamplerProgress`, and an indeterminate spinner JSX block guarded by `{samplingInFlight && ...}`
    - `src/renderer/src/components/AppShell.tsx` `onClickOpen` body invokes `window.api.cancelSampler()` when `samplingInFlight` is true (cancel-on-mid-sample-open hook)
    - `npm run test tests/main/ipc.spec.ts -- -t "sampler"` reports both new tests GREEN
    - `npm run test tests/main/sampler-worker.spec.ts` flips the function-extract cases (a/b/d) GREEN; the spawn-smoke (e) + cancel-via-terminate (c) tests also GREEN now that the bridge is wired
    - `npx tsc --noEmit -p tsconfig.node.json && npx tsc --noEmit -p tsconfig.web.json` both exit 0
    - `git diff eb97923 -- src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts` exits 0 with empty output (D-102 byte-frozen invariants preserved)
  </acceptance_criteria>
  <done>The IPC layer is fully wired; project-io dispatches sampling through the worker; the renderer subscribes to progress + can cancel; sampling spinner appears during sample runs. The Wave 0 RED scaffolds for the IPC layer + the function-extract worker tests are GREEN. The N2.2 gate test (sampler-worker-girl.spec.ts) is now WIRED but may still be RED until Task 3 finalizes the wall-time pass.</done>
</task>

<task type="auto">
  <name>Task 3: Validate the N2.2 gate against fixtures/Girl + close the wave</name>
  <files>tests/main/sampler-worker-girl.spec.ts</files>
  <read_first>
    - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (§"N2.2 Wall-Time Budget" + §"Manual-Only Verifications" — exact 8000 ms budget, 2000 ms margin, 1 warm-up run discarded, .skipIf(env.CI) permitted)
    - .planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md (§"Q8 N2.2 wall-time test stability" — exact test shape; §"A1 SkeletonData re-load cost" — log {loadMs, sampleMs} for visibility per Recommendation #13)
    - .planning/phases/09-complex-rig-hardening-polish/09-PATTERNS.md (§"tests/main/sampler-worker-girl.spec.ts" — analog reference)
    - tests/main/image-worker.integration.spec.ts (closest in-repo integration analog — real bytes, no mocks)
    - src/main/sampler-worker.ts (Task 1 — runSamplerJob signature)
    - fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json (verify exists; 908 KB)
  </read_first>
  <action>
Replace the Wave 0 RED scaffold in `tests/main/sampler-worker-girl.spec.ts` with the actual N2.2 gate test:

```ts
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { runSamplerJob } from '../../src/main/sampler-worker.js';

const SKELETON_PATH = resolve(__dirname, '../../fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json');

// CONTEXT.md authorizes .skipIf(env.CI) if empirical CI variance exceeds budget.
// Wave 1 author: leave this as a plain `it(...)` initially; if local runs are
// stable but CI is flaky after merge, follow up with `.skipIf(process.env.CI)`.
//
// Local `npm run test` is the non-negotiable gate per CONTEXT.md.
describe('Phase 9 N2.2 wall-time gate (fixtures/Girl)', () => {
  it(
    'fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms (10000 ms budget, 2000 ms margin) with 1 warm-up run discarded',
    async () => {
      // Warm-up run — JIT compilation + V8 inline-cache stabilization.
      // Result discarded; only the timing matters for the warmed run below.
      const warmup = await runSamplerJob({
        skeletonPath: SKELETON_PATH,
        samplingHz: 120,
        onProgress: () => {},
        isCancelled: () => false,
      });
      expect(warmup.type, 'warm-up run must complete (not error/cancel)').toBe('complete');

      // Timed run.
      const t0 = performance.now();
      const result = await runSamplerJob({
        skeletonPath: SKELETON_PATH,
        samplingHz: 120,
        onProgress: () => {},
        isCancelled: () => false,
      });
      const elapsed = performance.now() - t0;

      expect(result.type, 'timed run must complete').toBe('complete');
      expect(
        elapsed,
        `Girl sample took ${elapsed.toFixed(0)} ms (budget 8000 ms; N2.2 gate 10000 ms with 2000 ms margin)`,
      ).toBeLessThan(8000);

      // Diagnostic logging per RESEARCH §A1 — surfaces a future regression
      // if loadMs creeps up to a substantial fraction of total time.
      console.log(`[N2.2] Girl sample: ${elapsed.toFixed(0)} ms total`);
    },
    { timeout: 30_000 }, // 30 s safety net — vitest default 5 s is too tight
  );
});
```

Run `npm run test tests/main/sampler-worker-girl.spec.ts` locally. The test MUST GREEN. If the warmed run lands above 8000 ms:

1. **First diagnosis path:** check whether the loader is the bottleneck. Add temporary logging inside `runSamplerJob` (around the `loadSkeleton` call) to print `loadMs` separately. If loadMs > 1000 ms, the path-based protocol's re-load cost is higher than RESEARCH §A1 estimated and the budget needs renegotiation with the user.

2. **Second diagnosis path:** check whether the sampler hot-loop has a latent regression vs prior phases. `git diff eb97923 -- src/core/sampler.ts` MUST be empty (D-102). If it's not, this plan has illegally modified the byte-frozen sampler — revert.

3. **If 8000 ms is unattainable on local hardware:** stop and report to the user. The 8000 ms budget assumes the 10000 ms hard contract holds; if reality says otherwise, the user must decide whether to relax the budget or investigate further (potentially out of scope for this plan).

**Do NOT submit a workaround that lets the test pass via skip / mocking / fixture downsizing.** The N2.2 gate is the phase exit criterion; gaming it invalidates the entire phase.

After GREEN locally, run the full suite: `npm run test`. Expectation:
- All 7 new test files (Wave 0 RED scaffolds) — at least the Plan 02 sub-set (sampler-worker.spec.ts, sampler-worker-girl.spec.ts, ipc.spec.ts sampler block) GREEN.
- Other Phase 9 test files (virtualization, settings-dialog, rig-info-tooltip, help-dialog) STILL RED — those are Wave 2+ targets.
- Pre-existing 275+1 tests STILL GREEN.
- Total: ≥ pre-existing-GREEN-count + Plan 02 GREEN-count, with a smaller RED set than after Wave 0.

Run `npx electron-vite build` to confirm the worker bundle still emits cleanly. Run `npm run dev` (manual, planner does NOT include this in automated verify) to do a smoke check that the Electron app starts and a sample run completes — this is part of the manual UAT in Plan 08.
  </action>
  <verify>
    <automated>npm run test tests/main/sampler-worker-girl.spec.ts && npm run test 2>&1 | tail -3 | grep -E "passed"</automated>
  </verify>
  <acceptance_criteria>
    - `tests/main/sampler-worker-girl.spec.ts` no longer contains the `expect(true).toBe(false)` RED placeholder; instead contains a real `runSamplerJob` invocation against `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`
    - `npm run test tests/main/sampler-worker-girl.spec.ts` exits 0 and the test reports `elapsed < 8000` ms in the success path
    - `npm run test` overall reports `Tests` count ≥ pre-existing baseline + the Plan 02 GREEN count; Plan 02-related Phase 9 tests (sampler-worker.spec.ts function-extract cases + Worker spawn smoke + sampler-worker-girl.spec.ts + ipc.spec.ts sampler block) are GREEN
    - The console output during the test run includes `[N2.2] Girl sample: <N> ms total` (diagnostic log per RESEARCH §A1)
    - `npx electron-vite build` exits 0; `out/main/sampler-worker.cjs` size > 0
    - `git diff eb97923 -- src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts` exits 0 with empty diff (byte-frozen invariants preserved)
  </acceptance_criteria>
  <done>The N2.2 exit gate is GREEN against fixtures/Girl. The Phase 9 worker_threads + IPC + AppShell spinner stack ships. Plan 02 closes Wave 1; Wave 2 (virtualization) can begin.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer → main: `'sampler:cancel'` | Renderer-origin one-way send; payload-less. The contextBridge surface only exposes cancelSampler() to the trusted renderer. |
| main → worker: `workerData` | `{ skeletonPath, atlasRoot, samplingHz }` via worker_threads workerData. Originates from project-io.ts (main's own validated state, NOT directly from renderer in raw form — the renderer's project-open args have already passed handleProjectOpenFromPath's existing extension/length validation at lines 306-318). |
| worker → main: `postMessage` outbound | `{ type: 'progress' | 'complete' | 'cancelled' | 'error', ... }` discriminated union. Worker is trusted (we authored it; runs in the same Electron process tree). |
| main → renderer: `'sampler:progress'` | Main-origin one-way send; payload `{ percent: number }`. Renderer should treat as untrusted (defense in depth) but the surface is owned by us. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-02-WORKER-01 | Tampering | worker `skeletonPath` workerData | mitigate | The worker calls `loadSkeleton(skeletonPath, ...)` which is `loadSkeleton`'s normal entry. Loader validates the JSON via SkeletonJson.readSkeletonData; malformed input throws SkeletonJsonNotFoundError or AtlasParseError, surfaced via `{type:'error', error}`. The worker does NOT `require()` skeletonPath as code — only loadSkeleton (a JSON parse + validation pipeline) consumes it. |
| T-09-02-WORKER-02 | Information Disclosure | worker error envelope | mitigate | `serializeError` (sampler-worker.ts) forwards `{kind, message}` only — never the stack trace. Mirrors src/main/ipc.ts:88-94 KnownErrorKind narrowing (T-01-02-02 inheritance). |
| T-09-02-IPC-01 | Spoofing / Tampering | `'sampler:cancel'` IPC | accept | One-way fire-and-forget send. Idempotent: terminate() on null handle is a no-op. The contextBridge surface only exposes cancelSampler() to the main BrowserWindow's trusted renderer; an attacker would need to compromise the renderer process before reaching this channel, at which point they have full UI capability anyway. RESEARCH §"Trust-boundary input validation" notes: payload-less one-way channels do not require additional sender validation beyond the contextBridge closed-list. |
| T-09-02-IPC-02 | Denial of Service | `'sampler:cancel'` flood | accept | `worker.terminate()` on a non-existent handle is a no-op (early-returns when getSamplerWorkerHandle() === null). A flood of cancels does nothing; no resource exhaustion path. |
| T-09-02-WORKER-03 | Denial of Service | worker hang / infinite loop in sampler | mitigate | The byte-frozen sampler is bounded: `(skins × animations × samplingHz × duration × attachments × computeWorldVertices)` is finite. A malformed JSON triggering an infinite Spine loop is theoretically possible but no such case is known in 4.2; if surfaced, the user can `cancelSampler()` to terminate. The 30 s vitest test timeout is a backstop in test runs. |
| T-09-02-IPC-03 | Information Disclosure | `'sampler:progress'` payload | accept | Just an integer percent; no sensitive content. |
| T-09-02-LAYER3 | Spoofing | Layer 3 violation in worker | mitigate | tests/arch.spec.ts Phase 9 named-anchor block (Wave 0 landed) asserts the worker does NOT import from `electron`, `react`, `src/renderer/`, or DOM globals. Wave 1 author honors this; CI catches future regressions. |
| T-09-02-WORKER-04 | Tampering | Worker bundle path resolution | mitigate | `pathResolve(here, 'sampler-worker.cjs')` resolves relative to the bridge's own module URL (via `import.meta.url` + `fileURLToPath`). Production bundle: `out/main/sampler-worker.cjs` lives next to `out/main/index.cjs`. No user-controlled path component. |
</threat_model>

<verification>
After Task 3:
1. `npm run test tests/main/sampler-worker-girl.spec.ts` GREEN with elapsed < 8000 ms
2. `npm run test tests/main/sampler-worker.spec.ts` GREEN (all cases a-e)
3. `npm run test tests/main/ipc.spec.ts` GREEN (existing tests + Phase 9 sampler block)
4. `npm run test tests/arch.spec.ts` GREEN (Phase 9 anchor block hits real assertions, all pass)
5. `npm run test 2>&1 | tail -5` shows total GREEN count > pre-existing baseline; no regressions
6. `git diff eb97923 -- src/core/sampler.ts scripts/cli.ts` is empty
7. `npx electron-vite build` exits 0 and `out/main/sampler-worker.cjs` exists
8. `grep -rn "worker_threads" src/main/` returns matches in sampler-worker.ts (and possibly sampler-worker-bridge.ts)
9. Manual smoke (NOT automated): `npm run dev`, drag fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json into the app, observe the indeterminate spinner during sampling and the table populating after — confirms end-to-end UX works
</verification>

<success_criteria>
- [ ] `src/main/sampler-worker.ts` exists; imports node:worker_threads; exports runSamplerJob; Layer 3 clean
- [ ] `src/main/sampler-worker-bridge.ts` exists; spawns the worker; relays progress; exposes getSamplerWorkerHandle for cancel
- [ ] `src/main/ipc.ts` registers `'sampler:cancel'` handler that terminates the worker
- [ ] `src/main/project-io.ts` lines 437-441 + 640-643 dispatch through runSamplerInWorker
- [ ] `src/preload/index.ts` exposes onSamplerProgress + cancelSampler with Pitfall 9 listener-identity
- [ ] `src/shared/types.ts` Api interface extended; SamplerWorker* types declared
- [ ] `src/renderer/src/components/AppShell.tsx` shows indeterminate spinner during sampling; cancels on mid-sample Open
- [ ] `electron.vite.config.ts` emits sampler-worker.cjs as a separate main bundle
- [ ] N2.2 gate test GREEN: fixtures/Girl wall-time < 8000 ms
- [ ] All Wave 0 RED scaffolds for Plan 02 surfaces flip GREEN
- [ ] D-102 byte-frozen invariants preserved (sampler.ts, cli.ts, loader.ts, project-file.ts diffs vs eb97923 all empty)
- [ ] `<threat_model>` block present (above) — STRIDE register covers worker payload, error envelope, IPC, Layer 3
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-02-SUMMARY.md` summarizing:
- Wall-time measurement against fixtures/Girl (state the elapsed ms from the diagnostic log)
- Locked file diffs vs eb97923 baseline (empty for sampler.ts / cli.ts / loader.ts / project-file.ts)
- New file line counts (sampler-worker.ts, sampler-worker-bridge.ts)
- Test count delta (GREEN before vs after this plan)
- Confirmation that Wave 2 (virtualization) is unblocked
</output>
