/**
 * Phase 48 Plan 04 — The decisive, sampling-free regression oracle for the
 * pure JSON->JSON similarity bake (`src/core/scale-bake.ts`).
 *
 * The oracle proves, across the full fixture matrix and three scale factors,
 * that:
 *
 *   parse(bake(orig, s), scale=1)  ===field-identical===  parse(orig, scale=s)
 *
 * i.e. baking the JSON ourselves and re-parsing it at scale 1 yields the EXACT
 * same SkeletonData as letting spine-core's own `SkeletonJson.scale` do the
 * scaling. Field-identity means our bake IS Spine's own scaling expressed on
 * the JSON we control. The reference side (`parse(orig, scale=s)`) is generated
 * LIVE every run — there are NO hand-computed golden numbers, which is exactly
 * why the authored fixtures are low-risk: any drift in the bake shows up as a
 * field divergence against spine-core's live behaviour.
 *
 * This is the proof for BAKE-01..04 and the standing gate that protects the
 * bake forever.
 *
 * Composition (PATTERNS Analogs A/B/C — all three are existing, CI-passing
 * test patterns promoted here):
 *   - Analog A (d13-43-load-smoke.spec.ts:118-123): build the TextureAtlas from
 *     `.atlas` TEXT with the SINGLE-ARG ctor (the 4.3.0 API), then parse
 *     directly with SkeletonJson over an AtlasAttachmentLoader. NEVER routes
 *     through `loadSkeleton`/the facade and NEVER probes a PNG (CLAUDE.md Fact
 *     #4 — the math/oracle reads zero pixel bytes).
 *   - Analog B (runtime-distinctness.spec.ts:38-47): co-import BOTH spine-core
 *     specifiers and pick the runtime by the rig's `skeleton.spine` major.minor.
 *     This both-specifier co-import is SANCTIONED in `tests/` (precedent: that
 *     file + d13-43-load-smoke.spec.ts); `tests/arch.spec.ts` RT-03 scans
 *     `src/**` only, so the oracle is exempt by construction.
 *   - Analog C (.planning/spikes/002-json-bake-roundtrip/bake.mjs:96-121):
 *     the cycle-safe deep-compare promoted VERBATIM as `fieldMismatches` (the
 *     1e-3 relative tolerance, the full SKIP set incl. id/hash/assetId, the
 *     WeakSet cycle-break; array indices generalized to `[]`).
 *
 * D-06a #3 — NO silent skip: a standing fixture-existence guard hard-fails with
 * a clear `fixture not found` message if any matrix fixture is absent. The
 * `isFileAbsent`/return-null ENOENT-skip idiom (green-wash) is FORBIDDEN here
 * because the matrix includes freshly-committed fixtures whose tracking must be
 * PROVEN — a missing file must be a loud failure, not a quiet skip.
 *
 * D-08 — the two-sided equality catches BOTH over- and under-scaling: any
 * field that is wrongly scaled (or wrongly left unscaled) on the bake side
 * diverges from the live reference. So the must-stay-unscaled negatives (the IK
 * mix-channel cy, the normalized deform mix bezier, physics x/y, the percent-
 * default path position) are covered BY CONSTRUCTION across >=2 scale factors
 * incl. a non-round one and an upscale — no separate negative assertions.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
// Both spine-core specifiers, co-imported on purpose (Analog B). sc43 = the
// canonical @esotericsoftware/spine-core@4.3.0 install; sc42 = the 4.2.111
// install behind the `spine-core-42` npm alias. SANCTIONED in tests/
// (runtime-distinctness.spec.ts precedent); arch.spec RT-03 scans src/** only.
import * as sc43 from '@esotericsoftware/spine-core';
import * as sc42 from 'spine-core-42';
// The bake under test (the .js extension convention; vitest setupFiles auto-
// resolves the .ts source).
import { bake } from '../src/core/scale-bake.js';

// tests/ is one level under the repo root (vs '..','..' for tests/runtime/).
const REPO_ROOT = resolve(__dirname, '..');

// The fixture matrix (PATTERNS MATRIX array). Each entry pins the spine-core
// runtime used for the per-version REFERENCE parse — the bake itself is
// runtime-agnostic (operates on raw JSON), only the reference parser is
// per-version. The pinned `runtime` matches each rig's actual `skeleton.spine`:
//   4.3.0x -> sc43, 4.2.x -> sc42 (verified against the fixtures on disk).
const MATRIX = [
  { rig: 'fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02', runtime: '4.3' as const }, // DEMON copy — all-types 4.3 + physics + slider(rotate) + mesh
  { rig: 'fixtures/SCALE_BAKE_4_2/TEST_01', runtime: '4.2' as const }, // deform-heavy all-four-types 4.2
  { rig: 'fixtures/SCALE_BAKE_4_2/TEST_03', runtime: '4.2' as const }, // 4.2 IK-softness-curve
  { rig: 'fixtures/SCALE_BAKE_PATH_43/PATH_FIXED', runtime: '4.3' as const }, // synthetic path-Fixed timeline
  { rig: 'fixtures/spineboy_4.3/spineboy-pro', runtime: '4.3' as const }, // TRACKED — IK-softness-curve
  { rig: 'fixtures/SLIDER_4_3/SLIDER-01', runtime: '4.3' as const }, // TRACKED — slider remap (property x -> spatial)
  { rig: 'fixtures/SIMPLE_PROJECT_43/skeleton2', runtime: '4.3' as const }, // TRACKED — 4.3 path setup
  { rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST', runtime: '4.2' as const }, // TRACKED — 4.2 baseline
];

// Non-round factor + upscale to exercise D-09 direction-agnosticism (the bake
// must scale UP just as faithfully as DOWN; a non-round factor defeats any
// accidental integer/round-number coupling).
const SCALES = [0.5, 0.26, 2.0];

/**
 * Build the atlas from TEXT and parse the JSON directly with SkeletonJson at
 * the given scale (Analog A, parametrized over scale + runtime module). The
 * SINGLE-ARG TextureAtlas ctor is the current spine-core 4.3.0 API
 * (TextureAtlas.d.ts:35 `constructor(atlasText: string)`); the obsolete
 * two-argument (text + loader) form in D-04/RESEARCH is stale. Textures are
 * never attached — the bake/oracle read zero pixel bytes (CLAUDE.md Fact #4), so the
 * `.atlas` text is all that is needed for region dims.
 */
function parseAt(
  jsonText: string,
  atlasText: string,
  scale: number,
  Spine: typeof sc42 | typeof sc43,
): unknown {
  // `Spine` is one of the two sanctioned runtime modules (call-site contract),
  // but TS collapses `typeof sc42 | typeof sc43` constructor unions to the
  // INTERSECTION of their param types (AttachmentLoader42 & AttachmentLoader43,
  // TextureAtlas42 & TextureAtlas43 — both unsatisfiable: the 4.2/4.3
  // newRegionAttachment arities + protected Texture._image diverge), even though
  // each runtime branch is internally consistent at construction time. Localize
  // an `any` to the build site to sidestep the union-of-modules typing hazard
  // (same class as the shared-42-base-subclass dual-runtime note); the param
  // type above still guarantees only sc42/sc43 reach here.
  const S = Spine as any;
  const atlas = new S.TextureAtlas(atlasText); // single-arg ctor
  const sj = new S.SkeletonJson(new S.AtlasAttachmentLoader(atlas));
  sj.scale = scale; // the reference side uses SkeletonJson's OWN scaling
  return sj.readSkeletonData(JSON.parse(jsonText));
}

// Cycle-safe deep-compare — promoted VERBATIM from the validated spike
// bake.mjs:96-121. `near` = the L-04 ~1e-3 relative tolerance. The SKIP set
// excludes object references (parent/children/bone/target/...) and the
// parse-assigned identity fields (name/path/id/hash/assetId) that are NOT
// scale-dependent. The WeakSet on the a-side breaks the parent<->child cycles
// in SkeletonData; array indices are generalized to `[]` so a single mismatch
// path aggregates a count across all elements.
const near = (x: number, y: number) =>
  Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y)); // L-04 1e-3 rel tol
const SKIP = new Set([
  'parent', 'children', 'bones', 'bone', 'target', 'source', 'slot', 'skin',
  'attachment', 'page', 'region', 'texture', 'rendererObject', 'renderObject',
  'timelineAttachment', 'data', '_parent', '_bones', '_bone', '_target',
  '_source', '_slot', '_skin', '_data', '_meshAttachment', 'sequence', 'name',
  'path', 'id', 'hash', 'assetId',
]); // exclude refs + parse-assigned ids (L-04)

/**
 * Returns the list of mismatched field paths (empty = field-identical). Each
 * entry is `path (count)`, sorted by descending count.
 */
function fieldMismatches(baked: unknown, ref: unknown): string[] {
  const seen = new WeakSet<object>();
  const mism = new Map<string, number>();
  (function cmp(a: any, b: any, p: string) {
    if (typeof a === 'number' && typeof b === 'number') {
      if (!near(a, b)) mism.set(p, (mism.get(p) ?? 0) + 1);
      return;
    }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
    if (seen.has(a)) return;
    seen.add(a); // WeakSet on the a-side breaks cycles
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${p}[]`);
      return;
    }
    for (const k of Object.keys(a)) {
      if (SKIP.has(k) || typeof a[k] === 'function') continue;
      if (k in b) cmp(a[k], b[k], p ? `${p}.${k}` : k);
    }
  })(baked, ref, '');
  return [...mism.entries()].sort((a, b) => b[1] - a[1]).map(([path, n]) => `${path} (${n})`);
}

// ---------------------------------------------------------------------------
// STANDING GUARD (D-06a #3): hard-fail (never conditionally skip) if any matrix
// fixture is absent. The two-sided field-identity oracle below is only meaningful if every
// fixture it reads is actually committed; a missing fixture must be a loud
// failure, never a green-washed skip.
// ---------------------------------------------------------------------------
describe('Phase 48 oracle: matrix fixtures are present (D-06a #3 — hard-fail, no skip)', () => {
  for (const { rig } of MATRIX) {
    it(`fixture present: ${rig}`, () => {
      expect(existsSync(resolve(REPO_ROOT, rig + '.json')), `fixture not found: ${rig}.json`).toBe(true);
      expect(existsSync(resolve(REPO_ROOT, rig + '.atlas')), `fixture not found: ${rig}.atlas`).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// THE ORACLE: field-identity across the matrix x scales.
// ---------------------------------------------------------------------------
describe('Phase 48 oracle: parse(bake(orig,s),1) is field-identical to parse(orig,scale=s)', () => {
  for (const { rig, runtime } of MATRIX) {
    const Spine = runtime === '4.3' ? sc43 : sc42;
    for (const s of SCALES) {
      it(`field-identity: ${rig} @ s=${s}`, () => {
        const jsonText = readFileSync(resolve(REPO_ROOT, rig + '.json'), 'utf8');
        const atlasText = readFileSync(resolve(REPO_ROOT, rig + '.atlas'), 'utf8');
        const orig = JSON.parse(jsonText);
        // bake -> parse@1 (our side): bake the raw JSON ourselves, then parse at scale 1.
        const baked = parseAt(JSON.stringify(bake(orig, s)), atlasText, 1, Spine);
        // orig -> parse@s (LIVE reference): let spine-core's own SkeletonJson.scale do it.
        // Pass the ORIGINAL jsonText (parseAt re-JSON.parses it) — do NOT mutate `orig`.
        const ref = parseAt(jsonText, atlasText, s, Spine);
        expect(fieldMismatches(baked, ref), `field-identity broke @ s=${s} for ${rig}`).toEqual([]);
      });
    }
  }
});
