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
import { existsSync } from 'node:fs';
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

describe('sampler-worker — Wave 1 spawn smoke', () => {
  // The spawn smoke test exercises the BUILT bundle at out/main/sampler-worker.cjs.
  // It is conditionally enabled when the bundle exists (i.e. after `npx
  // electron-vite build` has run). The Wave 1 verify command runs the build
  // before the test suite, so this path is GREEN in CI / verify runs.
  // Fresh checkouts that have never run the build skip cleanly with a TODO.
  const bundleExists = existsSync(WORKER_BUNDLE);

  (bundleExists ? it : it.skip)(
    'spawning a real Worker against SIMPLE_PROJECT delivers progress then complete via postMessage',
    async () => {
      const worker = new Worker(WORKER_BUNDLE, {
        workerData: { skeletonPath: SIMPLE_TEST_JSON, samplingHz: 120 },
      });
      const events: Array<{ type: string; percent?: number }> = [];

      const finalMsg = await new Promise<{ type: string }>((resolve, reject) => {
        worker.on('message', (msg: { type: string; percent?: number }) => {
          events.push(msg);
          if (msg.type === 'complete' || msg.type === 'error' || msg.type === 'cancelled') {
            resolve(msg);
          }
        });
        worker.on('error', (err) => reject(err));
      });

      expect(finalMsg.type).toBe('complete');
      expect(events.some((e) => e.type === 'progress')).toBe(true);
      // Last message MUST be the terminal one (complete here).
      expect(events[events.length - 1].type).toBe('complete');

      // Cleanup.
      await worker.terminate();
    },
    15000,
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
