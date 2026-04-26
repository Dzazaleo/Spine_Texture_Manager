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
 * (out/main/sampler-worker.cjs emitted by electron-vite). We resolve relative
 * to `__dirname` (CJS — the main bundle is emitted as .cjs per
 * electron.vite.config.ts), so production resolution lands at
 * out/main/sampler-worker.cjs and dev resolution lands at
 * out/main/sampler-worker.cjs (same — electron-vite still emits the bundles
 * for dev mode; only the renderer is HMR-served).
 */
import { Worker } from 'node:worker_threads';
import { resolve as pathResolve } from 'node:path';
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
    // Resolve the worker bundle path relative to this file. In production
    // (electron-vite build), the main bundle emits as out/main/index.cjs
    // and the worker as out/main/sampler-worker.cjs; both share the same
    // __dirname. In tests we never reach this code path — vitest invokes
    // runSamplerJob directly without spawning a Worker (see
    // tests/main/sampler-worker.spec.ts function-extract strategy), and
    // the integration smoke test passes an explicit absolute workerPath
    // via a separate seam (the test's Worker construction).
    const workerPath = pathResolve(__dirname, 'sampler-worker.cjs');

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
    let settled = false;
    const settle = (msg: SamplerWorkerOutbound) => {
      if (settled) return;
      settled = true;
      if (samplerWorkerHandle === worker) samplerWorkerHandle = null;
      resolve(msg);
    };

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
      // complete / cancelled / error — final message.
      settle(msg);
      void worker.terminate();
    });

    worker.on('error', (err: unknown) => {
      settle({
        type: 'error',
        error: { kind: 'Unknown', message: err instanceof Error ? err.message : String(err) },
      });
    });

    worker.on('exit', () => {
      // If the worker exits BEFORE posting a final message (terminate() from
      // the cancel handler races the message), resolve with 'cancelled'.
      // If the Promise already settled via a 'message' event, settle() is
      // a no-op via the `settled` flag.
      settle({ type: 'cancelled' });
    });
  });
}
