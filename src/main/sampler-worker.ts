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
 *   This file imports ONLY from node:worker_threads + ../core/* +
 *   ../shared/types — NO electron, NO react, NO src/renderer/, NO DOM globals.
 *   Enforced by tests/arch.spec.ts Phase 9 named-anchor block (Wave 0
 *   landed the assertion; this Wave 1 author is what makes it pass).
 *
 * IMPORT NOTE for Workers:
 *   Node's worker_threads runs this file as a STANDALONE entrypoint. The
 *   imports must be resolvable in the production bundle — electron-vite
 *   emits this file as a separate bundle (see electron.vite.config.ts
 *   updates in Task 1). In dev, electron-vite's HMR + tsx loader handle
 *   the .ts → .js resolution.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { loadSkeleton } from '../core/loader.js';
import { sampleSkeleton, type SamplerOutput } from '../core/sampler.js';
import { SpineLoaderError, SpineVersionUnsupportedError } from '../core/errors.js';
import type {
  SamplerOutputShape,
  SamplerWorkerData,
  SamplerWorkerInbound,
  SamplerWorkerOutbound,
  SerializableError,
} from '../shared/types.js';

// Re-export the real SamplerOutput from core for downstream main-side consumers
// (the bridge + project-io). The shared/types.ts SamplerOutputShape is the
// type the renderer compiles against; this module is main-only so it can
// reference the precise core type for the runSamplerJob return.
export type { SamplerOutput };

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
  /**
   * Phase 21 D-08 — propagate per-project loader mode into the worker.
   * Optional for backward-compat (undefined → atlas-by-default semantics).
   */
  loaderMode?: 'auto' | 'atlas-less';
  onProgress: (percent: number) => void;
  isCancelled: () => boolean;
}): Promise<SamplerWorkerOutbound> {
  try {
    params.onProgress(0);

    if (params.isCancelled()) return { type: 'cancelled' };

    // Phase 21 D-08 — thread loaderMode through to the loader so atlas-less
    // override survives the worker boundary.
    const loaderOpts: { atlasPath?: string; loaderMode?: 'auto' | 'atlas-less' } = {};
    if (params.atlasRoot) loaderOpts.atlasPath = params.atlasRoot;
    if (params.loaderMode) loaderOpts.loaderMode = params.loaderMode;
    const load = loadSkeleton(params.skeletonPath, loaderOpts);

    if (params.isCancelled()) return { type: 'cancelled' };

    // The byte-frozen sampler (D-102) — single uninterruptible call.
    // Cooperative flag-check is impossible inside this call without
    // modifying sampler.ts. terminate() from the bridge is the actual
    // cancellation mechanism for in-flight cancels (see file header).
    const output: SamplerOutput = sampleSkeleton(load, { samplingHz: params.samplingHz });

    if (params.isCancelled()) return { type: 'cancelled' };

    params.onProgress(100);
    // Cast SamplerOutput → SamplerOutputShape: the SamplerOutput's `globalPeaks
    // / perAnimation / setupPosePeaks` are Map<string, PeakRecord>; the shape
    // declares the same triple of Map<string, unknown>. Structurally identical
    // — the cast through `unknown` is safe and lets shared/types stay
    // independent of src/core/* (Layer 3 invariant + tsconfig.web.json's
    // src/core/** exclude).
    return { type: 'complete', output: output as unknown as SamplerOutputShape };
  } catch (err) {
    return {
      type: 'error',
      error: serializeError(err),
    };
  }
}

function serializeError(err: unknown): SerializableError {
  // Phase 12 / Plan 05 (D-21) — F3 Spine version guard. The version-error
  // envelope arm carries `detectedVersion` beyond `{kind, message}`; the
  // generic SpineLoaderError forwarder below cannot populate it. Branch
  // first so 3.x rigs reaching the sampler worker surface the typed
  // envelope correctly. (Reachable when `runSamplerInWorker` is called
  // before any main-side version check fires — the worker re-loads the
  // skeleton path internally per D-193.)
  if (err instanceof SpineVersionUnsupportedError) {
    return {
      kind: 'SpineVersionUnsupportedError',
      message: err.message,
      detectedVersion: err.detectedVersion,
    };
  }
  if (err instanceof SpineLoaderError) {
    // Forward .name as the discriminator. T-01-02-02 information-disclosure
    // mitigation: only kind + message; never the stack trace. The
    // 'SkeletonNotFoundOnLoadError' arm of SerializableError carries 7
    // recovery fields and is constructed by hand in project-io.ts only —
    // the worker NEVER produces that arm; cast to the non-recovery union.
    // 'SpineVersionUnsupportedError' is excluded too (handled above) so the
    // cast remains type-safe under the Phase 12 union extension.
    return {
      kind: err.name as Exclude<
        SerializableError['kind'],
        'SkeletonNotFoundOnLoadError' | 'SpineVersionUnsupportedError'
      >,
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
  const port = parentPort;
  port.on('message', (msg: SamplerWorkerInbound) => {
    if (msg?.type === 'cancel') cancelled = true;
  });

  const data = workerData as SamplerWorkerData;
  void runSamplerJob({
    skeletonPath: data.skeletonPath,
    atlasRoot: data.atlasRoot,
    samplingHz: data.samplingHz,
    loaderMode: data.loaderMode, // Phase 21 D-08
    onProgress: (percent) =>
      port.postMessage({ type: 'progress', percent } satisfies SamplerWorkerOutbound),
    isCancelled: () => cancelled,
  }).then((result) => {
    port.postMessage(result);
    // After posting the final message, exit cleanly. The bridge's worker.on('exit')
    // handler clears samplerWorkerHandle. process.exit(0) is intentional — it
    // prevents the worker's event loop from keeping the process alive after
    // the sample completes (no other event sources are wired).
    process.exit(0);
  });
}
