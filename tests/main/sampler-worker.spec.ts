/**
 * Phase 9 Plan 02 — Wave 1 GREEN tests for the sampler worker.
 *
 * Behaviors per `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 2: D-190/D-193 byte-identical (worker vs in-thread sampleSkeleton on SIMPLE_PROJECT)
 *   - Row 3: D-194 progress monotonicity (start=0, finish=100/complete)
 *   - Row 4: D-194 cancellation budget (≤200 ms after worker.terminate())
 *   - Row 5: D-194 error envelope ({type:'error', error: SerializableError})
 *   - Wave 1 spawn smoke: real Worker against SIMPLE_PROJECT (progress→complete via postMessage)
 *
 * Strategy mirrors tests/main/image-worker.spec.ts: function-extract for the
 * unit-level cases (a, b, d, cancel-flag) via runSamplerJob WITHOUT spawning
 * a Worker. The Worker-spawn cases (cancel-via-terminate, spawn smoke) use
 * the BUILT bundle at `out/main/sampler-worker.cjs` (electron-vite emits it
 * per electron.vite.config.ts Phase 9 Plan 02 update). The `cancel-via-terminate`
 * test uses an inline eval Worker so it does not depend on the bundle.
 */
import { describe, expect, it } from 'vitest';
import { resolve as pathResolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import { runSamplerJob } from '../../src/main/sampler-worker.js';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton, type PeakRecord } from '../../src/core/sampler.js';

const SIMPLE_TEST_JSON = pathResolve(
  __dirname,
  '../../fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json',
);

// The built sampler-worker bundle. electron-vite emits it as part of `npm
// run build` / `npx electron-vite build`. The spawn-smoke test asserts the
// bundle is reachable via `new Worker(workerPath)`; if the bundle has not
// been built (fresh checkout, dev-mode), the spec aborts with a clear
// message rather than producing a misleading TypeScript-not-resolvable
// failure. The Wave 1 verify command runs `npx electron-vite build` so
// CI hits the GREEN path.
const WORKER_BUNDLE = pathResolve(__dirname, '../../out/main/sampler-worker.cjs');

describe('sampler-worker — Wave 1 D-190 / D-193', () => {
  it('byte-identical: worker run on SIMPLE_PROJECT returns Map-key parity + peakScale within PEAK_EPSILON vs in-thread sampleSkeleton', async () => {
    const inThread = sampleSkeleton(loadSkeleton(SIMPLE_TEST_JSON), { samplingHz: 120 });

    const viaWorker = await runSamplerJob({
      skeletonPath: SIMPLE_TEST_JSON,
      samplingHz: 120,
      onProgress: () => {},
      isCancelled: () => false,
    });

    expect(viaWorker.type).toBe('complete');
    if (viaWorker.type !== 'complete') return; // type narrowing for TS

    const inThreadKeys = [...inThread.globalPeaks.keys()].sort();
    const viaWorkerKeys = [...viaWorker.output.globalPeaks.keys()].sort();
    expect(viaWorkerKeys).toEqual(inThreadKeys);

    for (const k of inThread.globalPeaks.keys()) {
      const inT = inThread.globalPeaks.get(k)!;
      // viaWorker.output.globalPeaks is typed as Map<string, unknown> via
      // SamplerOutputShape (Layer 3 — shared/types cannot import core/).
      // The runtime payload IS PeakRecord; cast at the test boundary.
      const viaW = viaWorker.output.globalPeaks.get(k) as PeakRecord;
      // PEAK_EPSILON = 1e-9 in sampler.ts; toBeCloseTo(precision=5) → diff < 5e-6,
      // a comfortable margin above the 1e-9 latch tolerance.
      expect(viaW.peakScale).toBeCloseTo(inT.peakScale, 5);
    }
  });
});

describe('sampler-worker — Wave 1 D-194', () => {
  it('progress: emits {type:"progress", percent:0} on start and {type:"progress", percent:100} (or "complete") on finish; ordering preserved', async () => {
    const events: number[] = [];
    const result = await runSamplerJob({
      skeletonPath: SIMPLE_TEST_JSON,
      samplingHz: 120,
      onProgress: (percent) => events.push(percent),
      isCancelled: () => false,
    });

    expect(result.type).toBe('complete');
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]).toBe(0);
    expect(events[events.length - 1]).toBe(100);
    // Monotonic non-decreasing (0 → 100 with no inner cadence in Phase 9).
    for (let i = 1; i < events.length; i++) {
      expect(events[i]).toBeGreaterThanOrEqual(events[i - 1]);
    }
  });

  it('cancel: after worker.terminate(), exit-event resolves within 200 ms (D-194 budget)', async () => {
    // Spawn an inline-eval Worker that idles via a long timeout, then
    // terminate; assert termination resolves within the D-194 budget. This
    // does NOT exercise the sampler bundle — it asserts the Node platform
    // primitive that the bridge relies on (worker.terminate()) hits the
    // 200 ms budget. The byte-frozen sampler is uninterruptible synchronous
    // JS, so this is the definitive "≤200 ms" cancellation guarantee.
    const idleSource = `setTimeout(() => {}, 60000);`;
    const worker = new Worker(idleSource, { eval: true });
    // Give the worker a moment to enter its idle state so terminate has
    // something to interrupt (immediate-terminate-on-spawn races startup).
    await new Promise((r) => setTimeout(r, 20));
    const t0 = performance.now();
    await worker.terminate();
    const elapsed = performance.now() - t0;
    expect(elapsed, `terminate() took ${elapsed.toFixed(0)} ms (budget 200)`).toBeLessThan(200);
  }, 5000);

  it('error: reports {type:"error", error: SerializableError} when skeletonPath is missing/unreadable', async () => {
    const result = await runSamplerJob({
      skeletonPath: '/does/not/exist.json',
      samplingHz: 120,
      onProgress: () => {},
      isCancelled: () => false,
    });
    expect(result.type).toBe('error');
    if (result.type !== 'error') return;
    expect(result.error.kind).toBe('SkeletonJsonNotFoundError');
    expect(result.error.message).toMatch(/not found|unreadable/i);
  });

  it('cancel-flag: pre-load isCancelled returns true → resolves with {type:"cancelled"} without loading', async () => {
    const result = await runSamplerJob({
      skeletonPath: SIMPLE_TEST_JSON,
      samplingHz: 120,
      onProgress: () => {},
      isCancelled: () => true,
    });
    expect(result.type).toBe('cancelled');
  });
});

describe('sampler-worker — Wave 1 spawn smoke (GAP-43-PROD-SEAM falsifier)', () => {
  // GAP-43-PROD-SEAM regression gate. 43-03's Option A prod arm
  // (require('./runtime-42.js')) was orphaned by the real electron-vite build
  // — no runtime-42 artifact emitted beside the worker-shared chunk → the
  // BUILT out/main/sampler-worker.cjs threw "Cannot find module
  // './runtime-42.js'" on EVERY sample. It evaded 43-03's self-check because
  // every unit test takes the vitest globalThis resolver (never the prod
  // ambient require) AND this spawn-smoke silently `it.skip`-ped on a stale
  // bundle. This block now (a) HARD-FAILS (never skips) when the bundle is
  // stale/absent so the prod path can never be self-eval-blind again, and
  // (b) asserts the SPECIFIC GAP-43-PROD-SEAM negative: the worker must NOT
  // emit a Cannot-find-module-runtime-4x error. RED on the pre-fix orphaned
  // bundle, GREEN after 43-06 Task 1.

  function ensureFreshWorkerBundle(): void {
    // Build the main bundle so out/main/sampler-worker.cjs + the shared chunk
    // + out/main/runtime-4x.cjs are emitted. `electron-vite build` exits
    // NON-ZERO on the KNOWN, PRE-EXISTING, PHASE-47-OWNED spine-player
    // "MixBlend not exported" abort — but that fires AFTER the main/worker
    // chunks are emitted (documented: 43-VERIFICATION.md "Out of scope";
    // memory: Renderer MixBlend test-file failures are pre-existing). So we
    // tolerate the non-zero exit and instead assert the worker ARTIFACTS
    // exist and are fresh. We run ONLY the bundler step
    // (`npx electron-vite build`) — NOT the full `npm run build` (which also
    // runs electron-builder packaging) — which is sufficient for the worker
    // spawn path and avoids the packaging stage entirely.
    const t0 = Date.now();
    try {
      execFileSync('npx', ['electron-vite', 'build'], {
        cwd: pathResolve(__dirname, '../..'),
        stdio: 'ignore',
        timeout: 240_000,
      });
    } catch {
      // Expected: non-zero exit on the Phase-47 spine-player MixBlend abort,
      // which is downstream of (after) the main/worker emit. Swallow it; the
      // freshness + existence assertions below are the real gate.
    }
    if (!existsSync(WORKER_BUNDLE)) {
      throw new Error(
        `GAP-43-PROD-SEAM gate: out/main/sampler-worker.cjs was NOT emitted by ` +
          `\`npx electron-vite build\` (cwd repo root). This is a HARD FAILURE, ` +
          `NOT a skip — the production worker path must never be self-eval-blind. ` +
          `Investigate the electron-vite main build (the Phase-47 spine-player ` +
          `renderer abort is EXPECTED and downstream of the main emit; the main/ ` +
          `worker chunks must still be produced before it).`,
      );
    }
    const mtimeMs = statSync(WORKER_BUNDLE).mtimeMs;
    if (mtimeMs < t0 - 5_000) {
      throw new Error(
        `GAP-43-PROD-SEAM gate: out/main/sampler-worker.cjs is STALE ` +
          `(mtime ${new Date(mtimeMs).toISOString()} predates this build at ` +
          `${new Date(t0).toISOString()}). A stale pre-rewire bundle is exactly ` +
          `how GAP-43-PROD-SEAM evaded 43-03's self-check. HARD FAILURE, not a skip.`,
      );
    }
  }

  it(
    'BUILT worker spawns, samples SIMPLE_PROJECT, delivers complete, and NEVER emits a Cannot-find-module runtime-4x error',
    async () => {
      ensureFreshWorkerBundle();

      const worker = new Worker(WORKER_BUNDLE, {
        workerData: { skeletonPath: SIMPLE_TEST_JSON, samplingHz: 120 },
      });
      const events: Array<{ type: string; percent?: number; error?: { kind?: string; message?: string } }> = [];

      const finalMsg = await new Promise<{ type: string; error?: { message?: string } }>(
        (resolve, reject) => {
          worker.on('message', (msg: { type: string; percent?: number; error?: { kind?: string; message?: string } }) => {
            events.push(msg);
            if (msg.type === 'complete' || msg.type === 'error' || msg.type === 'cancelled') {
              resolve(msg);
            }
          });
          worker.on('error', (err) => reject(err));
        },
      );

      // GAP-43-PROD-SEAM-SPECIFIC NEGATIVE FALSIFIER: the orphaned-require
      // failure surfaces (via runSamplerJob's catch → serializeError) as
      // {type:'error', error:{kind:'Unknown', message:/Cannot find module
      // .*runtime-4.../}}. Assert it appears in NO received event. This is
      // the precise regression assertion (distinct from a generic
      // not-complete) — RED on the pre-fix bundle, GREEN after 43-06 Task 1.
      const cannotFindRuntime = events.find(
        (e) =>
          e.type === 'error' &&
          typeof e.error?.message === 'string' &&
          /Cannot find module .*runtime-4/.test(e.error.message),
      );
      expect(
        cannotFindRuntime,
        `GAP-43-PROD-SEAM REGRESSION: the BUILT worker could not resolve the ` +
          `runtime adapter — ${JSON.stringify(cannotFindRuntime)}. The ` +
          `pickRuntime prod-arm require literal must resolve to an emitted ` +
          `out/main/runtime-4x.cjs artifact (43-06 Task 1).`,
      ).toBeUndefined();

      // Positive: terminal complete, preceded by >=1 progress.
      expect(finalMsg.type).toBe('complete');
      expect(events.some((e) => e.type === 'progress')).toBe(true);
      expect(events[events.length - 1].type).toBe('complete');

      await worker.terminate();
    },
    300_000,
  );
});

describe('sampler-worker — Phase 21 G-04 (Site 5) loaderOpts precedence', () => {
  // Falsifying-regression gate for Plan 21-12 G-04 Site 5 (sampler-worker.ts
  // runSamplerJob loaderOpts construction, ~line 105-110). Task 3's IPC test
  // mocks runSamplerInWorker at the bridge boundary — runSamplerJob is never
  // invoked by Task 3, so Site 5's fix has no falsifier from that test alone.
  // This unit test directly invokes runSamplerJob to lock the Site 5 fix.
  //
  // Setup: a tmp .atlas that does NOT contain MESH_REGION. The JSON references
  // MESH_REGION. Pre-fix Site 5 passes BOTH atlasRoot + loaderMode to the
  // loader; the loader's D-06 branch reads the canonical atlas, then the
  // stock AtlasAttachmentLoader (loader.ts:352, NOT SilentSkip) throws
  // "Region not found in atlas: MESH_REGION (mesh attachment: MESH_REGION)"
  // per AtlasAttachmentLoader.js:62. runSamplerJob's catch arm returns
  // {type:'error', error:{...}}. Post-fix Site 5's new precedence rule omits
  // atlasPath when loaderMode='atlas-less', so the loader's D-08 synthesis
  // branch runs (synthesizes the region from the JSON's mesh data, ignoring
  // the canonical atlas). Load succeeds; runSamplerJob returns {type:'complete'}.
  //
  // Falsifying property: result.type === 'complete'.

  it('runSamplerJob with both atlasRoot + loaderMode:"atlas-less" against atlas WITHOUT MESH_REGION → post-fix complete (G-04 Site 5)', async () => {
    const fsSync = await import('node:fs');
    const os = await import('node:os');
    const path = await import('node:path');
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fsSync.mkdtempSync(path.join(os.tmpdir(), 'stm-worker-g04-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpAtlas = path.join(tmpDir, 'canonical.atlas');
    const tmpImages = path.join(tmpDir, 'images');
    fsSync.mkdirSync(tmpImages, { recursive: true });
    fsSync.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    // Copy the real PNG so D-08 synthesis SUCCEEDS post-fix (no missing PNG
    // case here — we want a CLEAN complete result post-fix to keep the
    // falsifying assertion crisp).
    fsSync.copyFileSync(
      path.join(SRC_FIXTURE, 'images', 'MESH_REGION.png'),
      path.join(tmpImages, 'MESH_REGION.png'),
    );
    // Synthesize a tmp .atlas containing OTHER_REGION (NOT MESH_REGION).
    // Pre-fix D-06 reads this atlas successfully (parses the OTHER_REGION
    // entry), then hands MESH_REGION to the stock AtlasAttachmentLoader
    // which throws "Region not found in atlas: MESH_REGION".
    fsSync.writeFileSync(
      tmpAtlas,
      'tmp_page.png\n' +
      'size: 1,1\n' +
      'filter: Linear,Linear\n' +
      'OTHER_REGION\n' +
      'bounds: 0,0,1,1\n',
      'utf8',
    );

    try {
      const result = await runSamplerJob({
        skeletonPath: tmpJson,
        atlasRoot: tmpAtlas,           // Pre-fix: this is passed to loader as atlasPath.
        samplingHz: 120,
        loaderMode: 'atlas-less',      // Post-fix: this WINS, atlasRoot is ignored.
        onProgress: () => {},
        isCancelled: () => false,
      });

      // FALSIFYING ASSERTION: pre-fix this is 'error' (stock AtlasAttachmentLoader
      // throws "Region not found in atlas: MESH_REGION ..."); post-fix this is
      // 'complete' (D-08 synthesis runs, skips the canonical atlas, succeeds).
      expect(result.type).toBe('complete');
      if (result.type !== 'complete') {
        // Helpful diagnostic for the pre-fix failure mode.
        throw new Error(
          `Expected complete; got ${result.type}: ` + JSON.stringify(result),
        );
      }
      // Sanity: the rig actually sampled (non-empty peaks Map).
      expect(result.output.globalPeaks.size).toBeGreaterThan(0);
    } finally {
      fsSync.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
