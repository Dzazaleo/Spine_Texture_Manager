/**
 * Phase 42 Plan 05 Task 1 — RT-01 / ROADMAP-Phase-42-Success-Criterion-#2
 * automated regression lock (the runtime-distinctness test).
 *
 * ROADMAP SC #2 (a non-negotiable Phase-42 contract): "...a
 * runtime-distinctness test asserts `adapter42.version !== adapter43.version`
 * and that `Slider`/`BonePose` exist only in the 4.3 module." The dual-install
 * itself is functionally correct and independently verified, but the
 * ROADMAP-contracted AUTOMATED regression test was collaterally removed by the
 * Option-1 re-plan commit `c87a95f` (the re-plan note documented only the
 * orthogonal `typecheck:web`->`typecheck:node` narrowing; the
 * distinctness-test removal was undocumented scope reduction). This file
 * RESTORES that regression lock as a gap-closure follow-up (42-05). It is
 * small, behavior-neutral, ancestry-irrelevant, and perturbs NO frozen commit.
 *
 * BOTH-SPECIFIER CO-IMPORT IS ON PURPOSE: this file legitimately imports BOTH
 * `@esotericsoftware/spine-core` (the canonical 4.3.0 install) AND
 * `spine-core-42` (the 4.2.111 npm-alias install, the frozen COMMIT B
 * `cc5783f`) — it is the runtime-distinctness probe, NOT a `spine-core-42`
 * repoint target and NOT a `src/**` both-specifier co-mingle violation. The
 * RT-03 backstop arch anchor in tests/arch.spec.ts is `src/**`-scoped ONLY
 * (it does NOT sweep `tests/**`); the already-green sibling
 * `tests/runtime/d13-43-load-smoke.spec.ts` establishes the sanctioned
 * `tests/` co-import idiom. This is the same idiom, extended to additionally
 * import the 4.2 alias so the two installs can be compared head-to-head.
 *
 * VERSION SOURCE: `version` is NOT an exported module constant in spine-core —
 * it MUST be read from the RESOLVED `package.json` (a non-forgeable artifact),
 * not from the module namespace. `createRequire(import.meta.url)` resolves the
 * package.json of each install via its specifier.
 *
 * SCOPE: test-only. Changes NO production code, adds NO dependency (it imports
 * already-installed, lockfile-integrity-pinned packages from the frozen
 * COMMIT B), and perturbs NO frozen commit. `vitest.config.ts:15`
 * (`include: ['tests/**\/*.spec.ts', ...]`) auto-discovers this file — no
 * vitest config change is needed or permitted.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
// Resolves to the CANONICAL 4.3.0 install (post-COMMIT-B). NOT a
// spine-core-42 repoint target — this is the 4.3 runtime under test.
import * as sc43 from '@esotericsoftware/spine-core';
// The 4.2.111 install behind the `spine-core-42` npm alias
// (`spine-core-42` = `npm:@esotericsoftware/spine-core@4.2.111`; its
// package.json `name` is still `@esotericsoftware/spine-core`, its `version`
// is `4.2.111`). Imported ON PURPOSE — this is the distinctness probe.
import * as sc42 from 'spine-core-42';

const require = createRequire(import.meta.url);

// version is NOT a module export — read it from the RESOLVED package.json of
// each install (a non-forgeable artifact, robust to a botched lockfile that
// would silently collapse spine-core-42 onto 4.3.0).
const v43 = (
  require('@esotericsoftware/spine-core/package.json') as { version: string }
).version;
const v42 = (
  require('spine-core-42/package.json') as { version: string }
).version;

const sc43Rec = sc43 as unknown as Record<string, unknown>;
const sc42Rec = sc42 as unknown as Record<string, unknown>;

// The two ROADMAP-named, non-negotiable 4.3-only symbols, plus the
// live-confirmed supporting Pose-architecture symbols (a stronger lock).
// `Pose` is DELIBERATELY NOT asserted — it resolved to `undefined` in the
// live 4.3.0 module; asserting it would false-fail.
const CONTRACT_43_ONLY = ['Slider', 'BonePose', 'Posed', 'SlotPose'] as const;

// Log the actual resolved export surface BEFORE asserting, so a future export
// rename (e.g. `Slider`/`BonePose` renamed upstream) fails LOUDLY with a
// visible diff in the test output, not as a mystery `toBeUndefined` failure.
const CONTRACT_PROBE = [
  'Slider',
  'BonePose',
  'Pose',
  'Posed',
  'SlotPose',
  'Skeleton',
] as const;
// eslint-disable-next-line no-console
console.log(
  '[runtime-distinctness] resolved versions:',
  JSON.stringify({ v43, v42 }),
  '\n[runtime-distinctness] sc43 contract-symbol surface:',
  JSON.stringify(
    Object.fromEntries(
      CONTRACT_PROBE.map((k) => [k, typeof sc43Rec[k]]),
    ),
  ),
  '\n[runtime-distinctness] sc42 contract-symbol surface:',
  JSON.stringify(
    Object.fromEntries(
      CONTRACT_PROBE.map((k) => [k, typeof sc42Rec[k]]),
    ),
  ),
  '\n[runtime-distinctness] Object.keys(sc43).length =',
  Object.keys(sc43Rec).length,
  '/ Object.keys(sc42).length =',
  Object.keys(sc42Rec).length,
);

describe('RT-01 / ROADMAP Phase-42 SC #2: spine-core dual-install runtime-distinctness regression lock', () => {
  it('both spine-core installs resolve under vitest (the dual-install is real, not just declared in package.json)', () => {
    // The very act of the two top-level `import * as` lines resolving without
    // throwing is the primary proof; assert non-null module objects to make
    // it explicit.
    expect(sc43).toBeTypeOf('object');
    expect(sc43).not.toBeNull();
    expect(sc42).toBeTypeOf('object');
    expect(sc42).not.toBeNull();
  });

  it('the two .version values differ (4.3.0 vs 4.2.111) — the adapter42.version !== adapter43.version contract', () => {
    // Exact pins catch a silent dependency drift (e.g. a botched lockfile
    // rewrite collapsing spine-core-42 onto 4.3.0); the `!==` is the verbatim
    // ROADMAP language.
    expect(v43).toBe('4.3.0');
    expect(v42).toBe('4.2.111');
    expect(v43).not.toBe(v42);
  });

  it('Slider/BonePose (+ supporting Pose-arch symbols) are exported from 4.3 and ABSENT from spine-core-42', () => {
    // (c) The 4.3 module exports the ROADMAP-named symbols + the
    // live-confirmed supporting Pose-architecture symbols.
    for (const sym of CONTRACT_43_ONLY) {
      expect(
        typeof sc43Rec[sym],
        `4.3 module must export ${sym} (ROADMAP SC #2 — a future upstream ` +
          `rename surfaces in the [runtime-distinctness] console.log above)`,
      ).not.toBe('undefined');
    }

    // (d) Those symbols are ABSENT from spine-core-42 (4.2.111 predates the
    // Pose-architecture rewrite — live-confirmed all `undefined`).
    for (const sym of CONTRACT_43_ONLY) {
      expect(
        sc42Rec[sym],
        `spine-core-42 (4.2.111) must NOT export ${sym} (it predates the ` +
          `4.3 Pose-architecture rewrite)`,
      ).toBeUndefined();
    }
  });

  it('a class in BOTH installs is a distinct reference per module (Pitfall 4 dual-universe smoke)', () => {
    // (e) `Skeleton` is present in BOTH installs; it MUST NOT be the same
    // reference across the two modules — proving two genuinely distinct
    // module instances, not one hoisted/de-duplicated copy.
    expect(sc43Rec.Skeleton).toBeTypeOf('function');
    expect(sc42Rec.Skeleton).toBeTypeOf('function');
    expect(sc43Rec.Skeleton).not.toBe(sc42Rec.Skeleton);
  });
});
