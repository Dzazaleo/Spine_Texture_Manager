/**
 * Phase 9 Plan 01 — Wave 0 RED scaffolds for the sampler worker.
 *
 * Behaviors claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 2: D-190/D-193 byte-identical (worker vs in-thread sampleSkeleton on SIMPLE_PROJECT)
 *   - Row 3: D-194 progress monotonicity (start=0, finish=100/complete)
 *   - Row 4: D-194 cancellation budget (≤200 ms after worker.terminate())
 *   - Row 5: D-194 error envelope ({type:'error', error: SerializableError})
 *   - Wave 1 spawn smoke: real Worker against SIMPLE_PROJECT (progress→complete via postMessage)
 *
 * Wave 0 design rule: scaffolds are RED-by-design (`expect(true).toBe(false)`)
 * with TODO comments documenting the Wave 1 implementation contract. Wave 1+
 * executors verify their work by FLIPPING these scaffolds to GREEN one at a time.
 *
 * Analog: tests/main/image-worker.spec.ts (mock + describe shape, function-extract
 * strategy per RESEARCH §Pattern lineage).
 */
import { describe, expect, it } from 'vitest';

describe('sampler-worker — Wave 1 D-190 / D-193', () => {
  it('byte-identical: worker run on SIMPLE_PROJECT returns Map-key parity + peakScale within PEAK_EPSILON vs in-thread sampleSkeleton', () => {
    // TODO Wave 1: import { runSamplerJob } from '../../src/main/sampler-worker.js';
    //   const inThread = sampleSkeleton(loadSkeleton(SIMPLE_TEST_JSON), { samplingHz: 120 });
    //   const viaWorker = await runSamplerJob({ skeletonPath: SIMPLE_TEST_JSON, samplingHz: 120 });
    //   expect(viaWorker.type).toBe('complete');
    //   expect([...viaWorker.output.globalPeaks.keys()].sort())
    //     .toEqual([...inThread.globalPeaks.keys()].sort());
    //   for (const k of inThread.globalPeaks.keys()) {
    //     expect(viaWorker.output.globalPeaks.get(k)!.peakScale)
    //       .toBeCloseTo(inThread.globalPeaks.get(k)!.peakScale, 5);
    //   }
    expect(true, 'Wave 1 implementation pending — runSamplerJob not yet exported').toBe(false);
  });
});

describe('sampler-worker — Wave 1 D-194', () => {
  it('progress: emits {type:"progress", percent:0} on start and {type:"progress", percent:100} (or "complete") on finish; ordering preserved', () => {
    // TODO Wave 1: progressEvents.length >= 2; first.percent === 0; last is 100 or {type:'complete'}.
    expect(true, 'Wave 1: progress event sequence not yet wired').toBe(false);
  });

  it('cancel: after worker.terminate(), exit-event resolves within 200 ms (D-194 budget)', () => {
    // TODO Wave 1: const t0 = performance.now(); await worker.terminate();
    //   await once(worker, 'exit'); expect(performance.now() - t0).toBeLessThan(200);
    expect(true, 'Wave 1: terminate() round-trip not yet measurable').toBe(false);
  });

  it('error: reports {type:"error", error: SerializableError} when skeletonPath is missing/unreadable', () => {
    // TODO Wave 1: runSamplerJob({ skeletonPath: '/does/not/exist.json', samplingHz: 120 })
    //   resolves to { type: 'error', error: { kind: 'SkeletonJsonNotFoundError', message: ... } }.
    expect(true, 'Wave 1: error envelope not yet wired').toBe(false);
  });
});

describe('sampler-worker — Wave 1 spawn smoke', () => {
  it('spawning a real Worker against SIMPLE_PROJECT delivers progress then complete via postMessage', () => {
    // TODO Wave 1: const worker = new Worker(workerPath, { workerData: { skeletonPath: SIMPLE_TEST_JSON, samplingHz: 120 } });
    //   const events: unknown[] = [];
    //   worker.on('message', (m) => events.push(m));
    //   await once(worker, 'exit');
    //   expect(events.some((e) => e.type === 'progress')).toBe(true);
    //   expect(events.at(-1).type).toBe('complete');
    expect(true, 'Wave 1: new Worker(workerPath, { workerData: ... }) not yet authored').toBe(false);
  });
});
