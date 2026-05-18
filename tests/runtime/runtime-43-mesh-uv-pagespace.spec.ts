/**
 * Orchestrator-directed CORE FIX — Phase 44 ORCL-02 undersize defect.
 *
 * THE BUG (caught by Phase 44's ORCL-02 cross-runtime HARD gate): every
 * weighted/region MESH sampled through runtime-43 is ~2.25× UNDERSIZED vs the
 * byte-trusted runtime-42 path. This is the silent-undersize-ships failure
 * class the product exists to prevent.
 *
 * ROOT CAUSE (verified against the pinned @esotericsoftware/spine-core@4.3.0
 * source in node_modules — MeshAttachment.d.ts:41 + MeshAttachment.js:118):
 *   - `MeshAttachment.regionUVs` in 4.3.0 is "normalized WITHIN the texture
 *     region" (region-space [0,1] inside the sub-rect), NOT page-space.
 *   - `bounds.ts` `hullAreaRatio` (lines 223-226) requires PAGE-normalized UVs
 *     (`sv[i] = uvs[i] * pageW`).
 *   - runtime-42 returns `att.uvs` — spine-core-42's parse-time PAGE-space UVs.
 *   - runtime-43's `attachmentUVs` MeshAttachment branch returned the RAW
 *     region-space `ma.regionUVs`, so `hullAreaRatio` divided world-area by a
 *     source-area inflated by (page/region)² → mesh peakScale collapsed.
 *
 * THE PROBE: drive the CIRCLE weighted mesh through BOTH runtimes at setup
 * pose (the same-hash same-geometry ORCL pair:
 * fixtures/SIMPLE_PROJECT_43/skeleton2_42.json via pickRuntime('4.2') and
 * fixtures/SIMPLE_PROJECT_43/skeleton2.json via pickRuntime('4.3')) and assert
 * the mesh's `computeRenderScale` is cross-runtime equal within 1e-4 — the
 * exact ORCL-02 equivalence the product depends on, as a focused core unit
 * test (NOT the full sampler, NOT the 44-04 ORCL-02 spec).
 *
 * RED→GREEN: before the runtime-43.ts `attachmentUVs` MeshAttachment-branch
 * fix, the 4.3 scale is ~2.25× smaller than 4.2 (the relative-divergence
 * assertion fails RED). After the fix (return page-space UVs via
 * `MeshAttachment.computeUVs`), the two scales are equal within 1e-4 (GREEN).
 *
 * LANE: test-only, NOT under tests/runtime43/ (44-04's lane) and NOT under
 * tests/core|main/ (44-03's lane). vitest.config.ts auto-discovers
 * tests/**\/*.spec.ts — no config change.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { pickRuntime } from '../../src/core/runtime/runtime.js';
import type { SpineRuntime } from '../../src/core/runtime/runtime.js';
import type {
  OpaqueSkeleton,
  OpaqueSkeletonData,
  OpaqueAttachment,
} from '../../src/core/runtime/types.js';
import { computeRenderScale } from '../../src/core/bounds.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const SK43_JSON = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.json',
);
const SK43_ATLAS = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.atlas',
);
// The 4.2-sibling — same-hash same-geometry known-good 4.2 leg of the ORCL
// pair (read-only here; 44-04 owns committing it for ORCL-02 proper).
const SK42_JSON = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2_42.json',
);
const SK42_ATLAS = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2_42.atlas',
);

const CIRCLE_MESH = 'CIRCLE';

function isFileAbsent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

interface Loaded {
  rt: SpineRuntime;
  skeletonData: OpaqueSkeletonData;
}

/**
 * Parse a fixture through the requested runtime facade (the same parse seam
 * load43.ts / baseline-driver.ts use, inlined here to stay out of the
 * tests/runtime43/ lane). Returns null ONLY on a genuinely absent fixture
 * (legit Wave-0 ENOENT skip); a broken pickRuntime PROPAGATES (a null runtime
 * is a verification-integrity failure, never a silent skip).
 */
function tryLoad(
  tag: '4.2' | '4.3',
  jsonPath: string,
  atlasPath: string,
): Loaded | null {
  const rt = pickRuntime(tag);
  if (rt == null) {
    throw new Error(
      `tryLoad: pickRuntime('${tag}') returned null — the runtime adapter ` +
        'must be resolvable. A null here is a verification-integrity ' +
        'failure, not a Wave-0 skip.',
    );
  }
  let json: unknown;
  let atlasText: string;
  try {
    json = JSON.parse(readFileSync(jsonPath, 'utf8'));
    atlasText = readFileSync(atlasPath, 'utf8');
  } catch (err) {
    if (isFileAbsent(err)) return null;
    throw err;
  }
  const atlas = rt.makeAtlas(atlasText);
  const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
  rt.applyRotatedRegionFix(skeletonData);
  return { rt, skeletonData };
}

/**
 * Compute the CIRCLE mesh's `computeRenderScale` at setup pose, mirroring
 * sampler Pass 1's lifecycle exactly (setSkin → setupPoseSlots → setupPose →
 * updateWorldTransform('pose')) then matching the slot to the attachment via
 * the skin manifest (skinEntries().slotIndex) — the
 * project_sampler_visibility_invariant principle (a skin-declared attachment
 * is measured even with no setup binding). Returns the isotropic mesh scale.
 */
function circleMeshRenderScale(loaded: Loaded): number | null {
  const { rt, skeletonData } = loaded;
  const skeleton: OpaqueSkeleton = rt.makeSkeleton(skeletonData);
  const state = rt.makeAnimationState(skeletonData);
  for (const skin of rt.skins(skeletonData)) {
    rt.setSkin(skeleton, skin);
    rt.setupPoseSlots(skeleton);
    rt.setupPose(skeleton);
    rt.clearTracks(state);
    rt.updateWorldTransform(skeleton, 'pose');
    const slots = rt.slots(skeleton);
    for (const entry of rt.skinEntries(skin)) {
      const a: OpaqueAttachment = entry.attachment;
      if (rt.attachmentKind(a) !== 'mesh') continue;
      if (rt.attachmentName(a) !== CIRCLE_MESH) continue;
      const slot = slots[entry.slotIndex];
      if (slot == null) continue;
      const rs = computeRenderScale(rt, skeleton, slot, a);
      if (rs != null) return rs.scale;
    }
  }
  return null;
}

describe('ORCL-02 core-fix: runtime-43 mesh attachmentUVs page-space (CIRCLE weighted mesh cross-runtime equivalence)', () => {
  const l42 = tryLoad('4.2', SK42_JSON, SK42_ATLAS);
  const l43 = tryLoad('4.3', SK43_JSON, SK43_ATLAS);

  it('both ORCL legs load (the cross-runtime pair is present — not a Wave-0 skip)', () => {
    expect(
      l42,
      'fixtures/SIMPLE_PROJECT_43/skeleton2_42.{json,atlas} (4.2 leg) must exist',
    ).not.toBeNull();
    expect(
      l43,
      'fixtures/SIMPLE_PROJECT_43/skeleton2.{json,atlas} (4.3 leg) must exist',
    ).not.toBeNull();
  });

  it('the CIRCLE mesh resolves a non-null render scale on BOTH runtimes', () => {
    expect(l42).not.toBeNull();
    expect(l43).not.toBeNull();
    const s42 = circleMeshRenderScale(l42!);
    const s43 = circleMeshRenderScale(l43!);
    expect(s42, 'runtime-42 CIRCLE mesh scale must be a positive number').toBeTypeOf('number');
    expect(s43, 'runtime-43 CIRCLE mesh scale must be a positive number').toBeTypeOf('number');
    expect(s42! > 0).toBe(true);
    expect(s43! > 0).toBe(true);
  });

  it('runtime-43 CIRCLE mesh peakScale is cross-runtime EQUAL to runtime-42 within 1e-4 (the ORCL-02 HARD equivalence)', () => {
    expect(l42).not.toBeNull();
    expect(l43).not.toBeNull();
    const s42 = circleMeshRenderScale(l42!)!;
    const s43 = circleMeshRenderScale(l43!)!;

    // Diagnostic context: pre-fix, s43 ≈ s42 / 2.25 (region-space UVs inflate
    // hullAreaRatio's sourceArea by ~(page/region)²). The relative-divergence
    // form catches the bug (RED) AND legit cross-engine float noise stays
    // green (GREEN) — the tolerance is NOT widened to mask the defect.
    // eslint-disable-next-line no-console
    console.log(
      '[orcl-02-core-fix] CIRCLE mesh scale 4.2 =', s42,
      '/ 4.3 =', s43,
      '/ rel-divergence =', Math.abs(s43 - s42) / s42,
    );

    const relDivergence = Math.abs(s43 - s42) / s42;
    expect(
      relDivergence < 1e-4,
      `runtime-43 CIRCLE mesh scale (${s43}) diverged from runtime-42 ` +
        `(${s42}) by ${(relDivergence * 100).toFixed(2)}% — the ORCL-02 ` +
        'silent-undersize defect. runtime-43 attachmentUVs MeshAttachment ' +
        'branch must return PAGE-space UVs (MeshAttachment.computeUVs), not ' +
        'the raw region-space ma.regionUVs.',
    ).toBe(true);
  });
});
