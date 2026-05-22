/**
 * Phase 49 Plan 03 — V6 (EXPORT-01/05) drop-in faithfulness oracle, dual-runtime.
 *
 * Proves the WRITTEN `{NAME}@{s}x/` package is a faithful, loadable drop-in on a
 * 4.2 AND a 4.3 rig, via three assertions:
 *
 *   (a) GEOMETRY ORACLE (L-01) — reuse the Phase-48 oracle on the export path's
 *       actual input: parse(bake(source, s), scale=1) is field-identical to
 *       parse(source, SkeletonJson.scale=s) (excluding parse-assigned ids). The
 *       bake IS Spine's own scaling.
 *
 *   (b) CROSS-RESOLVE (L-02 (b)) — run handleExportVariant into a tmpdir, then
 *       load the WRITTEN package via loadSkeleton (atlas-source). The package
 *       must load without throwing and every textured `path:` region in the
 *       baked JSON must resolve in the loaded atlas (no unresolved-region error).
 *
 *   (c) s× WORLD-AABB (L-02 (c), the spike-003 bar — the ONLY sanctioned sample
 *       in the whole phase). Sample the LOADED variant package and the master
 *       (each through the real sampler, which follows the CLAUDE.md lifecycle
 *       state.update → state.apply → skeleton.update → updateWorldTransform(
 *       Physics.update) and computes each attachment's world-AABB via
 *       computeWorldVertices). Assert every attachment's variant world-AABB
 *       extent ≈ s × the master's — the bake is a TRUE similarity so the world
 *       geometry is exactly s× (spike 003). An independent DIRECT aggregate
 *       world-AABB (computeWorldVertices after updateWorldTransform on the pinned
 *       runtime) corroborates the sampler's per-attachment numbers.
 *
 * DUAL-RUNTIME HARNESS (REUSE — tests/scale-bake.spec.ts:54-117): co-import BOTH
 * spine-core specifiers (SANCTIONED in tests/) and pin the runtime per rig. The
 * write path is runtime-agnostic (RESEARCH §Flag 7 — no spine-core below bake);
 * this oracle parses via the co-imported runtimes directly (the Phase-48 pattern)
 * so it inherits that harness's already-proven dual-runtime correctness — no new
 * per-runtime build seam, no new entrypoint risk.
 *
 * D-06a #3 — NO silent skip: loud-fail with a clear `fixture not found` message
 * if a rig `.json`/`.atlas` is absent.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
// Both spine-core specifiers, co-imported on purpose (Analog B / Phase-48). sc43
// = canonical @esotericsoftware/spine-core@4.3.0; sc42 = the 4.2.111 npm alias.
// SANCTIONED in tests/ (scale-bake.spec.ts + runtime-distinctness.spec.ts).
import * as sc43 from '@esotericsoftware/spine-core';
import * as sc42 from 'spine-core-42';
import { bake } from '../../src/core/scale-bake.js';
import { loadSkeleton } from '../../src/core/loader.js';
import type { LoadResult } from '../../src/core/types.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { attachmentWorldAABB } from '../../src/core/bounds.js';
import type { OpaqueSkeletonData } from '../../src/core/runtime/types.js';
import { buildSummary } from '../../src/main/summary.js';
import {
  handleExportVariant,
  formatScaleToken,
} from '../../src/main/variant-export.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const S = 0.5;

const fakeEvt = { sender: { send: () => {} } };
const defaultAtlasOpts = { maxPageSize: 4096 as const, allowRotation: false, padding: 2 };

interface MatrixRig {
  rig: string; // repo-relative, no extension
  name: string;
  runtime: '4.2' | '4.3';
  pick: typeof sc42 | typeof sc43;
}

// A focused subset — the full 8-rig geometry oracle already runs in
// tests/scale-bake.spec.ts; here we prove the EXPORTED-PACKAGE faithfulness on
// one 4.2 + one 4.3 rig. Both have a packed PNG so the cross-resolve rides the
// atlas-source `.atlas` written into the package.
const MATRIX: readonly MatrixRig[] = [
  { rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST', name: 'SIMPLE_TEST', runtime: '4.2', pick: sc42 },
  { rig: 'fixtures/SLIDER_4_3/SLIDER-01', name: 'SLIDER-01', runtime: '4.3', pick: sc43 },
] as const;

// ---------------------------------------------------------------------------
// fieldMismatches — copied VERBATIM from tests/scale-bake.spec.ts:126-161 (it is
// not exported there). 1e-3 rel tolerance, SKIP set incl. parse-assigned ids,
// WeakSet cycle-break, array indices generalized to `[]`.
// ---------------------------------------------------------------------------
const near = (x: number, y: number) =>
  Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y));
const SKIP = new Set([
  'parent', 'children', 'bones', 'bone', 'target', 'source', 'slot', 'skin',
  'attachment', 'page', 'region', 'texture', 'rendererObject', 'renderObject',
  'timelineAttachment', 'data', '_parent', '_bones', '_bone', '_target',
  '_source', '_slot', '_skin', '_data', '_meshAttachment', 'sequence', 'name',
  'path', 'id', 'hash', 'assetId',
]);
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
    seen.add(a);
    if (Array.isArray(a) && Array.isArray(b)) {
      for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${p}[]`);
      return;
    }
    for (const k of Object.keys(a)) {
      if (SKIP.has(k) || typeof a[k] === 'function') continue;
      if (k in b) cmp(a[k], b[k], p ? `${p}.${k}` : k);
    }
  })(baked, ref, '');
  return [...mism.entries()].sort((a, b) => b[1] - a[1]).map(([pp, n]) => `${pp} (${n})`);
}

/** Parse a skeleton at the given scale via the rig's pinned runtime (Analog A /
 *  scale-bake.spec.ts:97-117). Single-arg TextureAtlas ctor (4.3.0 API);
 *  textures never attached (CLAUDE.md Fact #4 — zero pixel bytes read). */
function parseAt(
  jsonText: string,
  atlasText: string,
  scale: number,
  Spine: typeof sc42 | typeof sc43,
): unknown {
  // TS collapses the typeof-module union constructor params to an unsatisfiable
  // intersection; localize an `any` at the build site (the documented Phase-48
  // union-seam idiom). Each runtime branch is internally consistent.
  const Sp = Spine as any;
  const atlas = new Sp.TextureAtlas(atlasText);
  const sj = new Sp.SkeletonJson(new Sp.AtlasAttachmentLoader(atlas));
  sj.scale = scale;
  return sj.readSkeletonData(JSON.parse(jsonText));
}

/** Build a real SkeletonSummary headlessly (atlas-source). */
function buildRigSummary(skeletonPath: string): SkeletonSummary {
  const load = loadSkeleton(skeletonPath);
  return buildSummary(load, sampleSkeleton(load), 0);
}

/** Direct aggregate world-AABB of the whole skeleton, computed VERSION-AGNOSTIC
 *  through the loader's runtime ADAPTER (load.runtime) — primes the skeleton via
 *  the CLAUDE.md lifecycle (setupPose → updateWorldTransform(Physics.pose), the
 *  setup-pose snapshot the sampler uses) and unions every textured attachment's
 *  world-AABB via `attachmentWorldAABB` (which calls computeWorldVertices behind
 *  the adapter). Independent corroboration of the sampler's per-attachment
 *  worldW/worldH numbers. Using the adapter (NOT the raw runtime ctor) sidesteps
 *  the 4.2/4.3 Skeleton API divergence (setToSetupPose vs setupPose, RegionAttachment
 *  region access) — the shared-42-base / dual-runtime hazard. */
function aggregateWorldAABB(load: LoadResult): { w: number; h: number } {
  // Mirror the production sampler's rt-null-check + skeletonData cast
  // (sampler.ts:140-146): runtime is optional on LoadResult and skeletonData is
  // the spine-core SkeletonData (cast to the opaque handle for the adapter).
  const rt = load.runtime;
  if (rt == null) throw new Error('aggregateWorldAABB: load.runtime missing');
  const skeletonData = load.skeletonData as unknown as OpaqueSkeletonData;
  // makeSkeleton returns an OpaqueSkeleton handle; all subsequent adapter calls
  // take that handle (the adapter unwraps internally).
  const sk = rt.makeSkeleton(skeletonData);
  rt.setupPoseSlots(sk);
  rt.setupPose(sk);
  // CLAUDE.md Fact #3 lifecycle (setup-pose pass: setupPose →
  // updateWorldTransform). 'pose' maps to Physics.pose in both adapters.
  rt.updateWorldTransform(sk, 'pose');
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const slot of rt.slots(sk)) {
    const att = rt.slotAttachment(slot);
    if (!att) continue;
    const aabb = attachmentWorldAABB(rt, sk, slot, att);
    if (!aabb) continue; // skip-list (path/bbox/point/clipping)
    if (aabb.minX < minX) minX = aabb.minX;
    if (aabb.maxX > maxX) maxX = aabb.maxX;
    if (aabb.minY < minY) minY = aabb.minY;
    if (aabb.maxY > maxY) maxY = aabb.maxY;
  }
  return { w: maxX - minX, h: maxY - minY };
}

describe('handleExportVariant — V6 drop-in faithfulness oracle (EXPORT-01/05)', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-faithful-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const { rig, name, runtime, pick } of MATRIX) {
    const label = `${name} [${runtime}]`;
    const skeletonPath = path.resolve(REPO_ROOT, rig + '.json');
    const atlasPath = path.resolve(REPO_ROOT, rig + '.atlas');

    // D-06a #3 — loud-fail if a committed fixture is absent (no silent skip).
    it(`fixture present: ${label}`, () => {
      expect(fs.existsSync(skeletonPath), `fixture not found: ${rig}.json`).toBe(true);
      expect(fs.existsSync(atlasPath), `fixture not found: ${rig}.atlas`).toBe(true);
    });

    it(`(a) geometry oracle: parse(bake,1) ≡ parse(orig,scale=${S}) for ${label}`, () => {
      const jsonText = fs.readFileSync(skeletonPath, 'utf8');
      const atlasText = fs.readFileSync(atlasPath, 'utf8');
      const orig = JSON.parse(jsonText);
      // our side: bake the raw JSON ourselves, parse at scale 1.
      const baked = parseAt(JSON.stringify(bake(orig, S)), atlasText, 1, pick);
      // live reference: spine-core's own SkeletonJson.scale (do NOT mutate orig).
      const ref = parseAt(jsonText, atlasText, S, pick);
      expect(
        fieldMismatches(baked, ref),
        `geometry field-identity broke @ s=${S} for ${label}`,
      ).toEqual([]);
    });

    it(`(b) cross-resolve: the written ${name}@${formatScaleToken(S)}x/ package loads via loadSkeleton (${label})`, async () => {
      const summary = buildRigSummary(skeletonPath);
      const res = await handleExportVariant(
        fakeEvt, summary, S, tmpDir, false, false, 'both', defaultAtlasOpts,
      );
      expect(
        res.ok,
        `variant export should succeed for ${label}; got: ${
          res.ok ? 'ok' : (res as { error: { message: string } }).error.message
        }`,
      ).toBe(true);

      const outDir = path.join(tmpDir, `${name}@${formatScaleToken(S)}x`);
      // Load the WRITTEN package atlas-source — must not throw; regions resolve.
      // Load the WRITTEN package atlas-source — must not THROW. An unresolved
      // region (a baked `path:` not present in the repacked .atlas) throws at
      // parse via the AtlasAttachmentLoader, so a clean load IS the cross-resolve
      // proof. (The deeper "regions render correctly" proof is assertion (c),
      // which samples the loaded package; per-runtime RegionAttachment region
      // accessors diverge across 4.2/4.3, so we do NOT inspect the raw field.)
      let loaded: LoadResult | null = null;
      expect(() => {
        loaded = loadSkeleton(path.join(outDir, `${name}.json`), {
          atlasPath: path.join(outDir, `${name}.atlas`),
        });
      }, `the written ${label} package must load via loadSkeleton without throwing`).not.toThrow();
      expect(loaded, `loadSkeleton returned a result for ${label}`).not.toBeNull();
      // The loaded skeleton has at least one textured attachment (the rig is not
      // empty — proves the cross-resolve actually wired regions, not a no-op).
      const skinAttachments = (loaded as unknown as LoadResult).skeletonData as unknown as {
        skins: Array<{ attachments: Array<Record<string, unknown> | null | undefined> }>;
      };
      let texturedCount = 0;
      for (const skin of skinAttachments.skins) {
        for (const perSlot of skin.attachments) {
          if (!perSlot) continue;
          for (const att of Object.values(perSlot) as Array<{ constructor?: { name?: string } }>) {
            const cls = att?.constructor?.name;
            if (cls === 'RegionAttachment' || cls === 'MeshAttachment') texturedCount++;
          }
        }
      }
      expect(texturedCount, `loaded ${label} package has ≥1 textured attachment`).toBeGreaterThanOrEqual(1);
    });

    it(`(c) s× world-AABB on the LOADED package == ${S}× master (spike-003 bar) for ${label}`, async () => {
      // Export, then sample BOTH the master (source fixture) and the variant
      // (written package) through the real sampler — the ONLY sanctioned sample
      // in the phase. The sampler internally runs the CLAUDE.md lifecycle and
      // computes each attachment's world-AABB via computeWorldVertices.
      const summary = buildRigSummary(skeletonPath);
      const res = await handleExportVariant(
        fakeEvt, summary, S, tmpDir, false, false, 'both', defaultAtlasOpts,
      );
      expect(res.ok, `variant export should succeed for ${label}`).toBe(true);
      const outDir = path.join(tmpDir, `${name}@${formatScaleToken(S)}x`);

      const masterPeaks = sampleSkeleton(loadSkeleton(skeletonPath)).globalPeaks;
      const variantPeaks = sampleSkeleton(
        loadSkeleton(path.join(outDir, `${name}.json`), {
          atlasPath: path.join(outDir, `${name}.atlas`),
        }),
      ).globalPeaks;

      // Per-attachment world-AABB ratio == S for every measurable attachment
      // (spike 003: the baked rig is a true similarity → world geometry exactly
      // S×; tolerance accommodates float noise, NOT a sizing approximation).
      let compared = 0;
      for (const [key, mr] of masterPeaks) {
        const vr = variantPeaks.get(key);
        if (!vr || mr.worldW <= 1e-6) continue;
        compared++;
        expect(
          vr.worldW / mr.worldW,
          `world-AABB width ratio != ${S} for ${key} (${label})`,
        ).toBeCloseTo(S, 2);
        if (mr.worldH > 1e-6) {
          expect(
            vr.worldH / mr.worldH,
            `world-AABB height ratio != ${S} for ${key} (${label})`,
          ).toBeCloseTo(S, 2);
        }
      }
      expect(compared, `at least one attachment world-AABB compared for ${label}`).toBeGreaterThanOrEqual(1);

      // Independent corroboration — DIRECT aggregate world-AABB via the loader's
      // runtime adapter: setupPose → updateWorldTransform(Physics.pose) +
      // attachmentWorldAABB (computeWorldVertices behind the adapter). Loaded
      // atlas-source from disk (master fixture + written variant package) so the
      // path runs version-agnostically through load.runtime.
      const mAabb = aggregateWorldAABB(loadSkeleton(skeletonPath));
      const vAabb = aggregateWorldAABB(
        loadSkeleton(path.join(outDir, `${name}.json`), {
          atlasPath: path.join(outDir, `${name}.atlas`),
        }),
      );
      if (mAabb.w > 1e-6) {
        expect(vAabb.w / mAabb.w, `direct aggregate world-AABB width != ${S}× for ${label}`).toBeCloseTo(S, 2);
      }
      if (mAabb.h > 1e-6) {
        expect(vAabb.h / mAabb.h, `direct aggregate world-AABB height != ${S}× for ${label}`).toBeCloseTo(S, 2);
      }
    });
  }
});
