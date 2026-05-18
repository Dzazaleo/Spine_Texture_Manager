/**
 * Phase 46 Plan 02 — PERF-01 4.3-specific wall-time regression budget.
 *
 * Subject: the redistributable in-repo complex 4.3 rig
 *   fixtures/spineboy_4.3/spineboy-pro.json
 *   (spine 4.3.01 — no `-beta`; 67 bones / 52 slots / 11 anims / 14 constraints).
 *
 * This is a genuine regression detector for the 4.3 three-pose sampler path:
 * constraints are exactly where 4.3's per-tick cost diverges from 4.2, so
 * spineboy-pro's 14 constraints + 67 bones is that workout (D-08). 4.3-vs-4.2
 * parity is NOT assumed — the 4.2 reference rig's 606 ms (Phase 9 N2.2) is a
 * *reference*, not a 4.3 ceiling; the budget reflects measured 4.3 reality.
 *
 * CI-ENABLED ON PURPOSE (D-07/D-09 — strictly stronger than the prior 4.2
 * reference-rig gate). The sibling Phase-9 N2.2 spec is CI-suppressed because
 * its 4.2 reference rig is a gitignored licensed third-party asset that does
 * not exist on CI runners. spineboy-pro is an owner-authored, redistributable,
 * committed in-repo fixture (no licensed third-party assets), so this gate
 * runs on EVERY CI matrix job — there is NO CI-suppression here. The prior
 * 4.2 gate avoided CI run-to-run variance by suppressing on CI entirely;
 * PERF-01 cannot suppress, so the 3× multiplicative margin must absorb that
 * variance instead (RESEARCH.md §"PERF-01 Budget").
 *
 * Captured warmed measurement on spineboy-pro 4.3 (see BUDGET below):
 *   measured = 493 ms  (2026-05-18, darwin arm64 / Apple Silicon, local dev)
 *   — the worst-case warmed wall-time under FULL-SUITE contention (the env
 *   this CI-enabled gate actually runs in: `npm run test` = `vitest run`,
 *   shared worker pool, CPU oversubscription). Isolated single-spec timing
 *   is ~120–126 ms, but `runSamplerJob` is CPU-bound and the gate must be
 *   anchored on its real (contended) execution reality, not isolation.
 *
 * Analog: the Phase-9 N2.2 4.2 reference-rig spec (verbatim clone — 3 edits +
 * 1 deletion + the CI-enabled BUDGET constant; warm-up/timed/safety-net shape
 * preserved).
 */
import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { runSamplerJob } from '../../src/main/sampler-worker.js';

const SKELETON_PATH = resolve(
  __dirname,
  '../../fixtures/spineboy_4.3/spineboy-pro.json',
);

// PERF-01 budget (D-09). Captured warmed measurement on spineboy-pro 4.3:
//   measured = 493 ms  (2026-05-18, darwin arm64 / Apple Silicon, local dev)
//   ratio to the 4.2 reference rig's 606 ms ≈ 0.81×  (descriptive only —
//   different rig + different Spine version; NOT a pass/fail gate; D-08)
// BUDGET = ⌈measured × 3⌉ = ⌈493 × 3⌉ = 1479. The 3× multiplicative margin
// (RESEARCH.md §"PERF-01 Budget"): there is NO fixed requirement budget to
// subtract from (the N2.2 606 ms is a reference, not a 4.3 ceiling — D-08),
// so the ceiling is measured×margin, not budget−margin.
//
// MEASUREMENT ENVIRONMENT (auditable derivation — escalation clause):
//   Step-1 isolated single-spec timing was ~120–126 ms (6 warmed vitest
//   samples, <1.1× spread). But this gate is CI-ENABLED and its REAL
//   execution environment is the full `npm run test` (= `vitest run`) suite:
//   a shared worker thread pool with CPU oversubscription. `runSamplerJob`
//   is CPU-bound, so under full-suite contention the same warmed call takes
//   far longer. Five full `tests/main/` suite samples: 210 / 380 / 400 /
//   469 / 493 ms (~2.3× spread, driven by nondeterministic worker-pool
//   scheduling — NOT algorithmic). `measured` is anchored on the worst-case
//   contended sample (493 ms) so the gate reflects "measured 4.3 reality"
//   in the env it actually runs in (the plan's own truth + D-09), not the
//   structurally-too-low isolated number. The 3× margin is kept (NOT
//   lowered — escalation clause forbids <3×; NOT raised to 4× either —
//   anchoring on the worst-case CONTENDED sample already absorbs the
//   worker-pool scheduling spread, so 3× over that ceiling is robust).
//
// 3× catches a real >3× algorithmic regression in the 4.3 three-pose path
// (a per-tick tripling → ~1500 ms+ contended → trips 1479) while being
// non-flaky under realistic full-suite CPU contention. CI-ENABLED (no
// CI-suppression) because the rig is redistributable (D-07); the margin —
// not a CI-skip — absorbs CI run-to-run variance.
const BUDGET = 1479;

describe('sampler-worker — PERF-01 4.3 wall-time budget (fixtures/spineboy_4.3, CI-enabled)', () => {
  it(
    'fixtures/spineboy_4.3/spineboy-pro.json samples in <1479 ms (= ⌈measured×3⌉) with 1 warm-up run discarded, CI-enabled',
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
        `spineboy-pro 4.3 sample took ${elapsed.toFixed(0)} ms (BUDGET ${BUDGET} ms = ⌈measured×3⌉; measured 493 ms 2026-05-18)`,
      ).toBeLessThan(BUDGET);

      // Diagnostic logging per RESEARCH §"Code Examples" Pattern 3 — surfaces a
      // future regression if 4.3 three-pose per-tick cost creeps up, and
      // records the descriptive ratio to the 4.2 Girl 606 ms reference.
      // eslint-disable-next-line no-console
      console.log(`[PERF-43] spineboy-pro 4.3: ${elapsed.toFixed(0)} ms (${(elapsed/606).toFixed(2)}× the 4.2 Girl 606 ms ref)`);
    },
    30_000, // 30 s safety net — vitest default 5 s is too tight for warm-up + timed run
  );
});
