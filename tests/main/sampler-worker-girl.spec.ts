/**
 * Phase 9 Plan 02 — Wave 1 N2.2 wall-time gate (fixtures/Girl).
 *
 * Behavior per `.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md`:
 *   - Row 1: N2.2 — fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json wall-time < 8000 ms
 *     (10000 ms requirement budget − 2000 ms margin) with 1 warm-up run discarded.
 *
 * CONTEXT.md authorizes `.skipIf(env.CI)` if empirical CI variance exceeds budget;
 * the LOCAL `npm run test` gate is non-negotiable.
 *
 * Analog: tests/main/image-worker.integration.spec.ts (real-bytes, no mocks).
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { runSamplerJob } from '../../src/main/sampler-worker.js';

const SKELETON_PATH = resolve(
  __dirname,
  '../../fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json',
);

describe('sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl)', () => {
  // CONTEXT.md authorizes .skipIf(env.CI) if empirical CI variance exceeds
  // budget; Wave 1 leaves the test active locally + on CI. Promote to
  // .skipIf(process.env.CI) only after empirical CI variance is observed.
  // Local `npm run test` is the non-negotiable gate.
  it(
    'fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms (10000 ms budget, 2000 ms margin) with 1 warm-up run discarded',
    async () => {
      // Warm-up run — JIT compilation + V8 inline-cache stabilization.
      // Result discarded; only the timing of the warmed run below matters.
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
      // if total time creeps up across phases.
      // eslint-disable-next-line no-console
      console.log(`[N2.2] Girl sample: ${elapsed.toFixed(0)} ms total`);
    },
    30_000, // 30 s safety net — vitest default 5 s is too tight for warm-up + timed run
  );
});
