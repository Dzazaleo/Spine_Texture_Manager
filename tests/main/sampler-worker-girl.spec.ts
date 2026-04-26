/**
 * Phase 9 Plan 01 — Wave 0 RED scaffold for the N2.2 wall-time gate.
 *
 * Behavior claimed from `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 1: N2.2 — fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json wall-time < 8000 ms
 *     (10000 ms requirement budget − 2000 ms margin) with 1 warm-up run discarded.
 *
 * CONTEXT.md authorizes `.skipIf(env.CI)` if Wave 1 measures unacceptable CI variance;
 * the LOCAL `npm run test` gate is non-negotiable.
 *
 * Analog: tests/main/image-worker.integration.spec.ts (real-bytes, no mocks).
 */
import { describe, expect, it } from 'vitest';

describe('sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl)', () => {
  // .skipIf(env.CI) is permitted per CONTEXT.md if CI variance exceeds budget;
  // Wave 1 may add it after empirical measurement. Local `npm run test` is the
  // non-negotiable gate.
  it('fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms (10000 ms budget, 2000 ms margin) with 1 warm-up run discarded', () => {
    // TODO Wave 1:
    //   const skeletonPath = path.resolve(__dirname, '../../fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json');
    //   await runSamplerJob({ skeletonPath, samplingHz: 120 }); // warm-up
    //   const t0 = performance.now();
    //   const result = await runSamplerJob({ skeletonPath, samplingHz: 120 });
    //   const elapsed = performance.now() - t0;
    //   expect(result.type).toBe('complete');
    //   expect(elapsed, `Girl sample took ${elapsed.toFixed(0)} ms`).toBeLessThan(8000);
    expect(true, 'Wave 1: runSamplerJob not yet exported; Girl gate pending').toBe(false);
  });
});
