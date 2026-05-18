// tests/runtime43/baseline-driver.ts
// Phase 43 Plan 05 — the shared driver that:
//   (1) assembles a LoadResult-shaped object so `sampleSkeleton` runs the 4.3
//       owner rig THROUGH runtime-43 (the core loader hard-picks 4.2 — D-02 —
//       so the 4.3 fixture cannot go through `loadSkeleton`; it is driven
//       directly via pickRuntime('4.3') + the runtime-43 parse seam, mirroring
//       load43.ts);
//   (2) loads the 4.2-sibling `skeleton2_42.json` via pickRuntime('4.2') + the
//       runtime-42 parse seam — the SAME-session same-hash (`mFDzgNETPHo`)
//       known-good geometry source for the A1 empirical validation. The sibling
//       is READ-ONLY here and is NOT committed (Phase-44 ORCL-01-reserved —
//       D-05); it is never added to git by this plan.
//
// Anti-confusion note: the 4.3 own-baseline (tests/runtime43/baselines/) is a
// SEPARATE store, NOT golden-shared with the frozen SAFE-01 corpus (D-01). The
// A1 / D-03 tolerances here are 1e-4 (same-hash cross-runtime geometry) and are
// DISTINCT from SAFE-02's strict byte-equal gate (Plan 03 owns SAFE-02; it
// stays strict and is untouched by this driver).
import { readFileSync, readdirSync } from 'node:fs';
import * as path from 'node:path';
import { pickRuntime } from '../../src/core/runtime/runtime.js';
import type { SpineRuntime } from '../../src/core/runtime/runtime.js';
import type {
  OpaqueSkeletonData,
  OpaqueAttachment,
} from '../../src/core/runtime/types.js';
import type { LoadResult, SourceDims, AABB } from '../../src/core/types.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import type { SamplerOutput } from '../../src/core/sampler.js';
import { attachmentWorldAABB } from '../../src/core/bounds.js';
import { tryLoad43 } from './load43.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

// The 4.2-sibling (Phase-44 ORCL-01-reserved). READ-ONLY known-good geometry
// for the A1 empirical proof — NOT committed by Plan 05 (D-05).
const SIBLING_42_JSON = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2_42.json',
);
const SIBLING_42_ATLAS = path.resolve(
  REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2_42.atlas',
);

/** The atlas regions that carry `rotate:90` in skeleton2.atlas /
 *  skeleton2_42.atlas (verified identical geometry in both). These exercise
 *  the PORT-03 4.3 rotated-region re-expression (Approach A no-op candidate). */
export const ROTATED_REGION_NAMES = ['TRIANGLE', 'rect'] as const;

/** The TransformConstraint-bearing slot/attachment for the D-03 canary
 *  (skeleton2.json has a `transform` constraint CHAIN_8 on SQUARE). */
export const CONSTRAINT_CANARY_REGION = 'SQUARE';

/** Loaded runtime + parsed skeletonData for one runtime/fixture pair. */
export interface LoadedPair {
  rt: SpineRuntime;
  skeletonData: OpaqueSkeletonData;
}

/**
 * Build a `sourceDims` map from the parsed atlas regions, mirroring how
 * `loader.ts:529-565` derives it (origW/origH preferring atlas-orig, else
 * atlas-bounds). The sampler only consumes `sourceDims` for the mesh
 * hull-area path; the owner rig is region-only, so any honest dims suffice —
 * but we replicate the loader's exact derivation so the 4.3 sample is faithful.
 */
function buildSourceDims(atlasText: string): Map<string, SourceDims> {
  const sourceDims = new Map<string, SourceDims>();
  // Parse the libgdx atlas text directly (the parsed OpaqueAtlas has no public
  // region enumeration on the facade; the .atlas text is the authoritative
  // source the loader itself reads region dims from).
  const lines = atlasText.split(/\r?\n/);
  let i = 0;
  // skip page header: first line = page filename, then key:value until a blank
  // or a region-name line. The region block starts after the page properties.
  // Page header lines contain ':' (size:, filter:, etc.); the page filename is
  // line 0. A region name is a bare line with no ':' following the header.
  // Skip line 0 (page file) then any "key:value" header lines.
  i = 1;
  while (i < lines.length && lines[i].includes(':')) i++;
  while (i < lines.length) {
    const name = lines[i]?.trim();
    i++;
    if (!name) continue;
    let boundsW = 0;
    let boundsH = 0;
    let origW = 0;
    let origH = 0;
    let hasOrig = false;
    // consume this region's "  key:value" indented lines
    while (i < lines.length && lines[i].includes(':')) {
      const line = lines[i].trim();
      const [key, val] = line.split(':');
      const nums = (val ?? '').split(',').map((s) => parseInt(s.trim(), 10));
      if (key === 'bounds') {
        boundsW = nums[2] ?? 0;
        boundsH = nums[3] ?? 0;
      } else if (key === 'offsets') {
        origW = nums[2] ?? 0;
        origH = nums[3] ?? 0;
        hasOrig = true;
      } else if (key === 'orig') {
        origW = nums[0] ?? 0;
        origH = nums[1] ?? 0;
        hasOrig = true;
      }
      i++;
    }
    const w = hasOrig ? origW : boundsW;
    const h = hasOrig ? origH : boundsH;
    const hasExplicitOrig = hasOrig && (origW !== boundsW || origH !== boundsH);
    sourceDims.set(name, {
      w,
      h,
      source: hasExplicitOrig ? 'atlas-orig' : 'atlas-bounds',
    });
  }
  return sourceDims;
}

/**
 * Assemble a minimal LoadResult so `sampleSkeleton` drives the 4.3 owner rig
 * through runtime-43. Only the fields the sampler reads are populated
 * (`runtime`, `skeletonData`, `sourceDims`, `editorFps`); the rest are
 * structurally-valid empty defaults. Returns `null` ONLY when the 4.3 fixture
 * is genuinely absent (legit Wave-0 ENOENT skip — load43.ts contract). A
 * broken pickRuntime PROPAGATES (verification-integrity — load43.ts).
 */
export function buildLoad43(): { load: LoadResult; rt: SpineRuntime } | null {
  const loaded = tryLoad43();
  if (loaded == null) return null; // legit Wave-0: Plan 05 owns the fixture
  const atlasText = readFileSync(
    path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.atlas'),
    'utf8',
  );
  const sourceDims = buildSourceDims(atlasText);
  const load: LoadResult = {
    skeletonPath: path.resolve(
      REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.json',
    ),
    atlasPath: path.resolve(
      REPO_ROOT, 'fixtures/SIMPLE_PROJECT_43/skeleton2.atlas',
    ),
    // The sampler treats skeletonData opaquely (casts to OpaqueSkeletonData and
    // routes every read through load.runtime). The structural `SkeletonData`
    // shape is satisfied by the runtime-43-parsed handle at runtime.
    skeletonData: loaded.skeletonData as unknown as LoadResult['skeletonData'],
    atlas: undefined as unknown as LoadResult['atlas'],
    sourceDims,
    sourcePaths: new Map(),
    atlasSources: new Map(),
    canonicalDimsByRegion: new Map(),
    actualDimsByRegion: new Map(),
    editorFps: 30, // skeleton2.json has no `skeleton.fps` → Spine's default 30
    runtime: loaded.rt,
  };
  return { load, rt: loaded.rt };
}

/**
 * Load the 4.2-sibling (`skeleton2_42.json`) via pickRuntime('4.2') + the
 * runtime-42 parse seam — the A1 known-good. READ-ONLY; never committed by
 * Plan 05 (D-05). Returns `null` only on ENOENT (Wave-0 skip).
 */
export function loadSibling42(): LoadedPair | null {
  let json: unknown;
  let atlasText: string;
  try {
    json = JSON.parse(readFileSync(SIBLING_42_JSON, 'utf8'));
    atlasText = readFileSync(SIBLING_42_ATLAS, 'utf8');
  } catch (err) {
    if (
      typeof err === 'object' &&
      err != null &&
      (err as { code?: string }).code === 'ENOENT'
    ) {
      return null;
    }
    throw err;
  }
  const rt = pickRuntime('4.2');
  const atlas = rt.makeAtlas(atlasText);
  const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
  rt.applyRotatedRegionFix(skeletonData);
  return { rt, skeletonData };
}

/**
 * Build a 4.2 LoadResult for the sibling so `sampleSkeleton` runs it through
 * runtime-42 (the byte-trusted path) — used by the D-03 SQUARE post-constraint
 * canary as the expected reference.
 */
export function buildLoadSibling42(): { load: LoadResult; rt: SpineRuntime } | null {
  const pair = loadSibling42();
  if (pair == null) return null;
  const atlasText = readFileSync(SIBLING_42_ATLAS, 'utf8');
  const sourceDims = buildSourceDims(atlasText);
  const load: LoadResult = {
    skeletonPath: SIBLING_42_JSON,
    atlasPath: SIBLING_42_ATLAS,
    skeletonData: pair.skeletonData as unknown as LoadResult['skeletonData'],
    atlas: undefined as unknown as LoadResult['atlas'],
    sourceDims,
    sourcePaths: new Map(),
    atlasSources: new Map(),
    canonicalDimsByRegion: new Map(),
    actualDimsByRegion: new Map(),
    editorFps: 30,
    runtime: pair.rt,
  };
  return { load, rt: pair.rt };
}

// --- XTRA-01 / XTRA-02 cross-runtime drivers (Phase 44 Plan 01, D-03) ---------
// Faithful clones of buildLoad43 (lines 128-157) with ONLY the fixture dir
// swapped. The owner-rig internal filenames are NOT locked (only the dir names
// fixtures/XTRA0{1,2}_4_3/ are — D-01 / CONTEXT Claude's Discretion), so the
// .json / .atlas are resolved by scanning the directory (readdirSync), never
// by a hardcoded assumed filename. The loud-or-skip presence-guard contract
// from load43.ts:34-72 is preserved verbatim: a broken pickRuntime('4.3')
// PROPAGATES (verification-integrity failure, NOT a Wave-0 skip); only a
// genuinely absent/empty rig directory returns null (legit Wave-0 fixture
// absence). buildSourceDims / rt.makeAtlas / rt.parseSkeleton /
// rt.applyRotatedRegionFix are IDENTICAL to buildLoad43.

function isFileAbsent(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err != null &&
    (err as { code?: string }).code === 'ENOENT'
  );
}

/**
 * Resolve the single `.json` and single `.atlas` inside an owner rig dir by
 * scanning its contents (the owner filenames are Claude's-Discretion, only the
 * dir name is locked). Returns `null` ONLY when the directory itself is absent
 * (legit Wave-0 ENOENT skip — load43.ts:34-72 contract). A directory that
 * exists but is missing its `.json`/`.atlas` is a malformed rig, NOT a skip —
 * it throws (the loud-over-silent posture; a half-exported rig must fail loud,
 * never green-wash as "fixture absent").
 */
function resolveRigFiles(
  dirAbs: string,
): { jsonPath: string; atlasPath: string } | null {
  let entries: string[];
  try {
    entries = readdirSync(dirAbs);
  } catch (err) {
    if (isFileAbsent(err)) return null; // legit Wave-0: owner rig dir absent
    throw err;
  }
  const jsons = entries.filter((f) => f.toLowerCase().endsWith('.json'));
  const atlases = entries.filter((f) => f.toLowerCase().endsWith('.atlas'));
  if (jsons.length === 0 && atlases.length === 0) return null; // empty → Wave-0
  if (jsons.length !== 1) {
    throw new Error(
      `resolveRigFiles: expected exactly one .json in ${dirAbs}, found ` +
        `${jsons.length} (${jsons.join(', ') || 'none'}) — malformed owner ` +
        'rig, NOT a Wave-0 skip (loud-over-silent: a half-exported rig must ' +
        'fail loud).',
    );
  }
  if (atlases.length !== 1) {
    throw new Error(
      `resolveRigFiles: expected exactly one .atlas in ${dirAbs}, found ` +
        `${atlases.length} (${atlases.join(', ') || 'none'}) — malformed ` +
        'owner rig, NOT a Wave-0 skip.',
    );
  }
  return {
    jsonPath: path.resolve(dirAbs, jsons[0]),
    atlasPath: path.resolve(dirAbs, atlases[0]),
  };
}

/**
 * Assemble a minimal LoadResult so `sampleSkeleton` drives an owner XTRA rig
 * through runtime-43. VERBATIM clone of buildLoad43 — only the fixture dir
 * differs (resolved by directory scan, not a hardcoded filename). Loud-or-skip:
 * pickRuntime('4.3') failure PROPAGATES (verification-integrity, NOT a skip);
 * only a genuinely absent rig directory returns null (legit Wave-0
 * fixture-absence — load43.ts:34-72 contract).
 */
function buildLoadXtra(
  dirRel: string,
): { load: LoadResult; rt: SpineRuntime } | null {
  // pickRuntime('4.3') must succeed — any failure is a verification-integrity
  // defect, NOT a Wave-0 skip: let it propagate (no catch). Mirrors
  // load43.ts:51-58.
  const rt = pickRuntime('4.3');
  if (rt == null) {
    throw new Error(
      `buildLoadXtra(${dirRel}): pickRuntime('4.3') returned null — ` +
        'runtime-43 must be resolvable. A null here is a ' +
        'verification-integrity failure, not a Wave-0 skip.',
    );
  }
  const dirAbs = path.resolve(REPO_ROOT, dirRel);
  const files = resolveRigFiles(dirAbs);
  if (files == null) return null; // legit Wave-0: owner rig not yet exported
  let json: unknown;
  let atlasText: string;
  try {
    json = JSON.parse(readFileSync(files.jsonPath, 'utf8'));
    atlasText = readFileSync(files.atlasPath, 'utf8');
  } catch (err) {
    if (isFileAbsent(err)) return null; // race: file vanished mid-scan
    throw err; // parse defect / runtime bug → PROPAGATE (never a silent skip)
  }
  const atlas = rt.makeAtlas(atlasText);
  const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
  rt.applyRotatedRegionFix(skeletonData);
  const sourceDims = buildSourceDims(atlasText);
  const load: LoadResult = {
    skeletonPath: files.jsonPath,
    atlasPath: files.atlasPath,
    // The sampler treats skeletonData opaquely (casts to OpaqueSkeletonData and
    // routes every read through load.runtime). The structural `SkeletonData`
    // shape is satisfied by the runtime-43-parsed handle at runtime.
    skeletonData: skeletonData as unknown as LoadResult['skeletonData'],
    atlas: undefined as unknown as LoadResult['atlas'],
    sourceDims,
    sourcePaths: new Map(),
    atlasSources: new Map(),
    canonicalDimsByRegion: new Map(),
    actualDimsByRegion: new Map(),
    editorFps: 30, // owner rigs have no `skeleton.fps` → Spine's default 30
    runtime: rt,
  };
  return { load, rt };
}

/**
 * XTRA-01 (multi-map TransformConstraint rig) through runtime-43 via the
 * sampler. Clone of buildLoad43 — only the fixture dir differs. Loud-or-skip:
 * pickRuntime('4.3') failure PROPAGATES (verification-integrity, NOT a skip);
 * only a genuinely absent rig directory returns null (legit Wave-0
 * fixture-absence).
 */
export function buildLoadXtra01(): { load: LoadResult; rt: SpineRuntime } | null {
  return buildLoadXtra('fixtures/XTRA01_4_3');
}

/**
 * XTRA-02 (4.3 IK `scaleYMode` Uniform + Volume rig) through runtime-43 via the
 * sampler. Clone of buildLoad43 — only the fixture dir differs. Same
 * loud-or-skip contract as buildLoadXtra01.
 */
export function buildLoadXtra02(): { load: LoadResult; rt: SpineRuntime } | null {
  return buildLoadXtra('fixtures/XTRA02_4_3');
}

/**
 * Compute setup-pose world-quad AABBs, keyed by the attachment's region name,
 * for every skin-declared RegionAttachment whose region name is in
 * `regionFilter`. Mirrors sampler Pass 1's lifecycle exactly
 * (setSkin → setupPoseSlots → setupPose → updateWorldTransform('pose')) then
 * walks live slots and computes the world AABB via the shared bounds math
 * (`attachmentWorldAABB`) — the SAME code path the sampler uses, so the AABB
 * is the real world demand, not a re-derived approximation.
 *
 * The slot is matched to the attachment by `skinEntries().slotIndex` (the
 * skin manifest) so we measure exactly the rotated-region attachments
 * regardless of setup-pose binding (the project_sampler_visibility_invariant
 * principle — a skin-declared attachment is measured even if no setup binding
 * activates it).
 */
export function regionAABBsAtSetupPose(
  pair: LoadedPair,
  regionFilter: ReadonlySet<string>,
): Map<string, AABB> {
  const { rt, skeletonData } = pair;
  const out = new Map<string, AABB>();
  const skeleton = rt.makeSkeleton(skeletonData);
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
      if (rt.attachmentKind(a) !== 'region') continue;
      const meta = rt.attachmentRegionMeta(a);
      const regionName = meta?.name;
      if (regionName == null || !regionFilter.has(regionName)) continue;
      const slot = slots[entry.slotIndex];
      if (slot == null) continue;
      const aabb = attachmentWorldAABB(rt, skeleton, slot, a);
      if (aabb != null) out.set(regionName, aabb);
    }
  }
  return out;
}

/** Run the full sampler through the given LoadResult (its runtime). */
export function sample(load: LoadResult): SamplerOutput {
  return sampleSkeleton(load);
}

/** Find SQUARE's globalPeaks peakScale (the D-03 post-constraint canary
 *  target). Key shape: `${skinName}/${slotName}/${attachmentName}`. */
export function squarePeakScale(out: SamplerOutput): number | null {
  for (const [key, rec] of out.globalPeaks) {
    if (key.split('/').some((seg) => seg === CONSTRAINT_CANARY_REGION)) {
      return rec.peakScale;
    }
  }
  return null;
}
