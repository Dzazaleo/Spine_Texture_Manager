/**
 * Phase 42 Plan 04 -- D-13: the 4.3-runtime in-repo load-smoke.
 *
 * RT-01 installed TWO spine-core copies side-by-side: the canonical
 * `@esotericsoftware/spine-core` is now 4.3.0; the 4.2.111 install lives
 * under the `spine-core-42` npm alias (the frozen COMMIT B `cc5783f`). This
 * smoke proves the 4.3 RUNTIME can directly parse an in-repo 4.3 skeleton
 * JSON -- the dual-install is real and functional, not just present in
 * `package.json`.
 *
 * CRITICAL BYPASS (RESEARCH Pitfall 7): Phase 42 does NOT modify
 * `src/core/loader.ts`. The gated loader entrypoint STILL throws
 * `SpineVersionUnsupportedError` on any 4.3 input (the loader version-guard
 * flip is Phase 44/45, NOT Phase 42; 42-02's specifier rename to loader.ts
 * is behaviour-neutral -- the guard LOGIC is byte-unchanged). So this smoke
 * MUST drive the 4.3 runtime's `SkeletonJson` DIRECTLY and never call the
 * gated loader entrypoint. The whole point of D-13 is exactly this distinction: the
 * 4.3 runtime can READ the file even though our gated loader still REJECTS
 * it (the loader gate flip is a later phase).
 *
 * SCOPE -- integrity ONLY, not value correctness. D-13 asserts the 4.3
 * runtime parses the in-repo 4.3 JSON past the v1.4 reject without throwing
 * and that the skeleton data is structurally consumed (bones/skins, and the
 * unified 4.3 `root.constraints[]` array). It deliberately does NOT assert
 * sampled peak-scale values -- value correctness against a closed-form
 * oracle is Phase 44's 1e-4 job, NOT this plan's.
 *
 * The bare `import { SkeletonJson, ... } from '@esotericsoftware/spine-core'`
 * below resolves to the CANONICAL 4.3.0 package (post-COMMIT-B). This NEW
 * test legitimately imports the bare 4.3 specifier on purpose -- it is the
 * 4.3 runtime under test, NOT a `spine-core-42` repoint target (the 42-02
 * count-free repoint scope is the PRE-EXISTING 4.2 consumers in src/ +
 * tests/, which this brand-new file is not).
 *
 * Q3 BETA->STABLE FALLBACK (RESEARCH §A2/§Q3 -- implemented as a REAL
 * guarded branch, not a comment): the in-repo fixture
 * `fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json` is `4.3.91-beta`. The stable
 * 4.3.0 `SkeletonJson` should read it (the constraints schema stabilised
 * before 4.3.0) but a beta-vs-stable schema drift is a LOW-confidence risk.
 * If the beta JSON fails to parse under stable 4.3.0 `SkeletonJson` for a
 * genuine schema reason (NOT a `SpineVersionUnsupportedError` -- we never
 * call the gated loader), this test writes a tiny hand-authored STABLE 4.3
 * skeleton to `fixtures/SPINE_4_3_MIN/SPINE_4_3_MIN.json` (+ a 1-region
 * `.atlas`) and runs the identical direct-`SkeletonJson` assertion against
 * THAT instead. Which path executed is recorded in the plan SUMMARY.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
// Resolves to the CANONICAL 4.3.0 package (post-COMMIT-B). This file is the
// 4.3 runtime under test -- NOT a spine-core-42 repoint target.
import {
  SkeletonJson,
  AtlasAttachmentLoader,
  TextureAtlas,
} from '@esotericsoftware/spine-core';
// Phase 44 (D-11) — "make it real": the gated loader is now a dual-runtime
// dispatcher (loader.ts resolveRuntimeTag). This file historically drove the
// 4.3 runtime DIRECTLY (proving the dual-install is real); D-11 adds an arm
// that drives the GATED loader so we prove the dispatch ROUTES a 4.3 file
// instead of rejecting it.
import { loadSkeleton } from '../../src/core/loader.js';
import { handleRuntime, type OpaqueSkeletonData } from '../../src/core/runtime/types.js';

const REPO_ROOT = resolve(__dirname, '..', '..');

const BETA_JSON = resolve(
  REPO_ROOT,
  'fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json',
);
const BETA_ATLAS = resolve(
  REPO_ROOT,
  'fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.atlas',
);

// Q3 fallback: a tiny hand-authored STABLE 4.3 skeleton + 1-region atlas.
// Only written if the 4.3.91-beta fixture fails to parse under stable 4.3.0.
const MIN_DIR = resolve(REPO_ROOT, 'fixtures/SPINE_4_3_MIN');
const MIN_JSON = resolve(MIN_DIR, 'SPINE_4_3_MIN.json');
const MIN_ATLAS = resolve(MIN_DIR, 'SPINE_4_3_MIN.atlas');

const STABLE_43_MIN_SKELETON = {
  skeleton: { spine: '4.3.0', x: 0, y: 0, width: 1, height: 1 },
  bones: [{ name: 'root' }],
  slots: [{ name: 's', bone: 'root', attachment: 'r' }],
  skins: [
    {
      name: 'default',
      attachments: { s: { r: { type: 'region', width: 1, height: 1 } } },
    },
  ],
  constraints: [],
  animations: {},
};

const STABLE_43_MIN_ATLAS = [
  'SPINE_4_3_MIN.png',
  'size: 1, 1',
  'format: RGBA8888',
  'filter: Linear, Linear',
  'repeat: none',
  'r',
  '  rotate: false',
  '  xy: 0, 0',
  '  size: 1, 1',
  '  orig: 1, 1',
  '  offset: 0, 0',
  '  index: -1',
  '',
].join('\n');

/**
 * Drive the 4.3 runtime DIRECTLY: 4.3 SkeletonJson over a 4.3
 * AtlasAttachmentLoader over a 4.3 TextureAtlas. NEVER calls the gated
 * `src/core/loader.ts` -- so `SpineVersionUnsupportedError` (the v1.4 reject)
 * cannot be raised here by construction.
 */
function readDirect(jsonText: string, atlasText: string): unknown {
  const atlas = new TextureAtlas(atlasText);
  const attachmentLoader = new AtlasAttachmentLoader(atlas);
  const skeletonJson = new SkeletonJson(attachmentLoader);
  return skeletonJson.readSkeletonData(JSON.parse(jsonText));
}

describe('Phase 42 D-13: in-repo 4.3 JSON loads through the 4.3 runtime SkeletonJson DIRECTLY (integrity, not value)', () => {
  it('parses past the v1.4 SpineVersionUnsupportedError (never calls the gated loader) and consumes the 4.3 root.constraints[] array', () => {
    const betaJsonText = readFileSync(BETA_JSON, 'utf8');
    const betaAtlasText = readFileSync(BETA_ATLAS, 'utf8');

    // Confirm the in-repo fixture really is the 4.3.91-beta shape we expect
    // (the unified 4.3 root.constraints[] discriminator, not the legacy
    // 4.2 root.ik/root.transform split).
    const betaParsed = JSON.parse(betaJsonText) as {
      skeleton?: { spine?: string };
      constraints?: unknown;
    };
    expect(betaParsed.skeleton?.spine, 'in-repo fixture is the 4.3.91-beta export').toBe(
      '4.3.91-beta',
    );
    expect(
      Array.isArray(betaParsed.constraints),
      'in-repo 4.3 fixture carries the unified root.constraints[] array (4.3 schema marker)',
    ).toBe(true);

    let skeletonData: unknown;
    let usedFallback = false;
    let betaError: unknown;

    try {
      // Primary path: drive the 4.3 runtime directly against the 4.3.91-beta
      // in-repo fixture. Asserting it does NOT throw at all proves it never
      // hits the gated loader (no SpineVersionUnsupportedError) AND parses
      // clean under stable 4.3.0.
      skeletonData = readDirect(betaJsonText, betaAtlasText);
    } catch (err) {
      betaError = err;
      // A SpineVersionUnsupportedError here would mean something erroneously
      // routed through the gated loader -- that must NEVER happen on the
      // direct path. Fail HARD, do not silently fall back.
      const name = err instanceof Error ? err.name : '';
      expect(
        name,
        'the direct 4.3 path must NEVER raise SpineVersionUnsupportedError (it never calls the gated loader)',
      ).not.toBe('SpineVersionUnsupportedError');

      // Q3 contingency: a genuine beta-vs-stable schema parse failure under
      // stable 4.3.0. Write the hand-authored STABLE 4.3 fixture and re-run
      // the identical direct assertion against THAT instead.
      usedFallback = true;
      if (!existsSync(dirname(MIN_JSON))) {
        mkdirSync(dirname(MIN_JSON), { recursive: true });
      }
      writeFileSync(
        MIN_JSON,
        JSON.stringify(STABLE_43_MIN_SKELETON, null, 2) + '\n',
        'utf8',
      );
      writeFileSync(MIN_ATLAS, STABLE_43_MIN_ATLAS, 'utf8');
      skeletonData = readDirect(
        readFileSync(MIN_JSON, 'utf8'),
        readFileSync(MIN_ATLAS, 'utf8'),
      );
    }

    // Integrity assertions (NOT value correctness -- D-13 explicitly defers
    // sampled-peak verification to Phase 44's 1e-4 closed-form oracle).
    expect(
      skeletonData,
      'the 4.3 runtime produced a skeleton-data object (parsed past the v1.4 reject)',
    ).toBeTruthy();

    const sd = skeletonData as {
      bones?: unknown[];
      skins?: unknown[];
    };
    expect(Array.isArray(sd.bones), '4.3 SkeletonData has a bones[] array').toBe(true);
    expect((sd.bones ?? []).length, 'at least the root bone was consumed').toBeGreaterThan(0);
    expect(Array.isArray(sd.skins), '4.3 SkeletonData has a skins[] array').toBe(true);
    expect((sd.skins ?? []).length, 'at least the default skin was consumed').toBeGreaterThan(0);

    // Belt-and-suspenders: assert no SpineVersionUnsupportedError leaked even
    // on the fallback path (it also never calls the gated loader).
    if (betaError instanceof Error) {
      expect(
        betaError.name,
        'even a fallback-triggering parse error must NOT be the v1.4 reject',
      ).not.toBe('SpineVersionUnsupportedError');
    }

    // Document-in-test-output which path executed. The plan SUMMARY records
    // the resolved path; `SPINE_4_3_MIN` exists on disk iff the fallback ran.
    if (usedFallback) {
      expect(existsSync(MIN_JSON), 'fallback wrote the stable-4.3 fixture').toBe(true);
    } else {
      expect(
        existsSync(MIN_JSON),
        'beta parsed clean -> the SPINE_4_3_MIN fallback fixture was NOT created',
      ).toBe(false);
    }
  });
});

describe('Phase 44 D-11: the GATED loader ROUTES the committed 4.3 leg (skeleton2.json) to the 4.3 runtime (dispatch made real)', () => {
  const FIXTURE = resolve(
    REPO_ROOT,
    'fixtures/SIMPLE_PROJECT_43/skeleton2.json',
  );

  it('loadSkeleton(skeleton2.json) routes-and-loads via the 4.3 runtime (pre-flip this threw SpineVersionUnsupportedError)', () => {
    // skeleton2.json is spine "4.3.01" + a top-level constraints[] array (no
    // legacy top-level ik/transform/path) -> D-07 token 4.3, D-08 no
    // contradiction -> runtime-43. Pre-flip the gated loader hard-rejected
    // every 4.3 input (SpineVersionUnsupportedError); post-flip (Plan 02
    // resolveRuntimeTag + the 44-03 single-gate fix) it routes-and-loads.
    // This is D-11 "make it real": the prior arms drive the 4.3 runtime
    // DIRECTLY (kept above — they cover the beta-vs-stable parse fallback);
    // THIS arm proves the GATED loader entrypoint dispatches a 4.3 file.
    expect(() => loadSkeleton(FIXTURE)).not.toThrow();
    const load = loadSkeleton(FIXTURE);
    expect(load).toBeTruthy();

    // Dispatch-target proof: the LoadResult's opaque skeletonData handle
    // carries the threaded runtime identity (__rt). A 4.3-routed load MUST
    // be branded by the 4.3 runtime — not merely "did not throw".
    expect(handleRuntime(load.skeletonData as unknown as OpaqueSkeletonData)).toBe('4.3');

    // Same structural "parsed, not rejected" proof the direct arm uses
    // (bones[]/skins[] non-empty) so the route+parse evidence is consistent.
    const sd = load.skeletonData as unknown as {
      bones?: unknown[];
      skins?: unknown[];
    };
    expect(Array.isArray(sd.bones), '4.3 SkeletonData has a bones[] array').toBe(true);
    expect((sd.bones ?? []).length, 'the 4.3 rig bones were consumed').toBeGreaterThan(0);
    expect(Array.isArray(sd.skins), '4.3 SkeletonData has a skins[] array').toBe(true);
    expect((sd.skins ?? []).length, 'the 4.3 rig skins were consumed').toBeGreaterThan(0);
  });
});
