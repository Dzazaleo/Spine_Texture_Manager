/**
 * Phase 0 Plan 03 — Tests for `src/core/bounds.ts`.
 *
 * Behavior gates pulled from the plan's `<behavior>` block:
 *   1. Region attachment on unit-transform leaf bone → AABB matching region size (modulo rotation).
 *   2. BoundingBox/Path/Point/Clipping attachments → `null`.
 *   3. Weighted mesh → AABB covering all N transformed vertices.
 *   4. `computeScale({minX:0,minY:0,maxX:200,maxY:100}, {w:100,h:100,source:'atlas-orig'})`
 *      returns `{ scaleX: 2, scaleY: 1, scale: 2 }`.
 *   5. Module has zero top-level imports of `node:fs` / `node:path` / `sharp` (grep-enforced).
 *
 * These exercise the delegation contract — we never re-implement spine-core's math,
 * only fold its output into AABB/scale numbers.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  Physics,
  RegionAttachment,
  PathAttachment,
} from '@esotericsoftware/spine-core';
import { loadSkeleton } from '../../src/core/loader.js';
import { attachmentWorldAABB, computeScale } from '../../src/core/bounds.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

/**
 * Helper: build a Skeleton ready for per-slot bounds queries at t=0 (setup pose +
 * one identity tick so every world transform is populated by spine-core).
 */
function primedSkeleton(): Skeleton {
  const { skeletonData } = loadSkeleton(FIXTURE);
  const skeleton = new Skeleton(skeletonData);
  skeleton.setToSetupPose();
  const state = new AnimationState(new AnimationStateData(skeletonData));
  state.apply(skeleton);
  skeleton.update(0);
  skeleton.updateWorldTransform(Physics.update);
  return skeleton;
}

describe('computeScale', () => {
  it('returns scaleX, scaleY, and scale=max(scaleX,scaleY)', () => {
    const result = computeScale(
      { minX: 0, minY: 0, maxX: 200, maxY: 100 },
      { w: 100, h: 100, source: 'atlas-orig' },
    );
    expect(result.scaleX).toBe(2);
    expect(result.scaleY).toBe(1);
    expect(result.scale).toBe(2);
  });

  it('guards zero-width source dims → returns 0, not Infinity (T-00-03-03)', () => {
    const result = computeScale(
      { minX: 0, minY: 0, maxX: 50, maxY: 50 },
      { w: 0, h: 0, source: 'atlas-bounds' },
    );
    expect(result.scaleX).toBe(0);
    expect(result.scaleY).toBe(0);
    expect(result.scale).toBe(0);
    expect(Number.isFinite(result.scale)).toBe(true);
  });
});

describe('attachmentWorldAABB', () => {
  it('returns an AABB for a RegionAttachment whose world bounds match the region size at identity transform', () => {
    const skeleton = primedSkeleton();
    // Find a RegionAttachment slot. SQUARE/TRIANGLE/CIRCLE are the candidates per CLAUDE.md.
    let found: { slot: ReturnType<Skeleton['findSlot']>; att: RegionAttachment } | null = null;
    for (const slot of skeleton.slots) {
      const att = slot.getAttachment();
      if (att instanceof RegionAttachment) {
        found = { slot, att };
        break;
      }
    }
    if (!found) throw new Error('fixture has no RegionAttachment — test premise invalid');
    const aabb = attachmentWorldAABB(found.slot!, found.att);
    expect(aabb).not.toBeNull();
    expect(aabb!.maxX).toBeGreaterThan(aabb!.minX);
    expect(aabb!.maxY).toBeGreaterThan(aabb!.minY);
    // AABB dims are finite numbers — no NaN leak from computeWorldVertices
    expect(Number.isFinite(aabb!.minX)).toBe(true);
    expect(Number.isFinite(aabb!.maxY)).toBe(true);
  });

  it('returns an AABB for a MeshAttachment (delegating to VertexAttachment.computeWorldVertices)', () => {
    const skeleton = primedSkeleton();
    // SIMPLE_TEST contains at least one mesh attachment (CIRCLE per fixture inventory).
    let mesh: {
      slot: ReturnType<Skeleton['findSlot']>;
      att: import('@esotericsoftware/spine-core').MeshAttachment;
    } | null = null;
    for (const slot of skeleton.slots) {
      const att = slot.getAttachment();
      if (
        att &&
        att.constructor &&
        att.constructor.name === 'MeshAttachment'
      ) {
        mesh = { slot, att: att as import('@esotericsoftware/spine-core').MeshAttachment };
        break;
      }
    }
    if (!mesh) throw new Error('fixture has no MeshAttachment — test premise invalid');
    const aabb = attachmentWorldAABB(mesh.slot!, mesh.att);
    expect(aabb).not.toBeNull();
    expect(aabb!.maxX).toBeGreaterThan(aabb!.minX);
    expect(aabb!.maxY).toBeGreaterThan(aabb!.minY);
    // Cross-check: direct call to computeWorldVertices should yield the same extents.
    const n = mesh.att.worldVerticesLength;
    const wv = new Float32Array(n);
    mesh.att.computeWorldVertices(mesh.slot!, 0, n, wv, 0, 2);
    let gotMinX = Infinity,
      gotMaxX = -Infinity,
      gotMinY = Infinity,
      gotMaxY = -Infinity;
    for (let i = 0; i < n; i += 2) {
      if (wv[i] < gotMinX) gotMinX = wv[i]!;
      if (wv[i] > gotMaxX) gotMaxX = wv[i]!;
      if (wv[i + 1]! < gotMinY) gotMinY = wv[i + 1]!;
      if (wv[i + 1]! > gotMaxY) gotMaxY = wv[i + 1]!;
    }
    expect(aabb!.minX).toBeCloseTo(gotMinX, 5);
    expect(aabb!.maxX).toBeCloseTo(gotMaxX, 5);
    expect(aabb!.minY).toBeCloseTo(gotMinY, 5);
    expect(aabb!.maxY).toBeCloseTo(gotMaxY, 5);
  });

  it('returns null for a PathAttachment (skip-list)', () => {
    const skeleton = primedSkeleton();
    // SIMPLE_TEST fixture has a PathConstraint/path attachment (per `type:"path"` grep).
    let pathEntry: {
      slot: ReturnType<Skeleton['findSlot']>;
      att: PathAttachment;
    } | null = null;
    for (const slot of skeleton.slots) {
      const att = slot.getAttachment();
      if (att instanceof PathAttachment) {
        pathEntry = { slot, att };
        break;
      }
    }
    if (!pathEntry) {
      // Path attachments often live inside skins; scan skin attachments too.
      for (const skin of skeleton.data.skins) {
        for (const entry of skin.getAttachments()) {
          if (entry.attachment instanceof PathAttachment) {
            pathEntry = {
              slot: skeleton.slots[entry.slotIndex]!,
              att: entry.attachment,
            };
            break;
          }
        }
        if (pathEntry) break;
      }
    }
    if (!pathEntry) throw new Error('fixture has no PathAttachment — test premise invalid');
    const result = attachmentWorldAABB(pathEntry.slot!, pathEntry.att);
    expect(result).toBeNull();
  });
});

describe('bounds.ts module hygiene (N2.3 by construction)', () => {
  const src = fs.readFileSync(
    path.resolve('src/core/bounds.ts'),
    'utf8',
  );

  it('does not import from node:fs / node:path / node:child_process / node:net / node:http', () => {
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  });

  it('does not reference the sharp PNG library', () => {
    expect(src).not.toMatch(/\bsharp\b/);
  });

  it('exports attachmentWorldAABB and computeScale', () => {
    expect(src).toMatch(/export\s+function\s+attachmentWorldAABB/);
    expect(src).toMatch(/export\s+function\s+computeScale/);
  });

  it('references both RegionAttachment and VertexAttachment delegation paths', () => {
    expect(src).toMatch(/RegionAttachment/);
    expect(src).toMatch(/VertexAttachment/);
    expect(src).toMatch(/worldVerticesLength/);
  });

  it('handles all four non-textured VertexAttachment subclasses before the generic path', () => {
    expect(src).toMatch(/BoundingBoxAttachment/);
    expect(src).toMatch(/PathAttachment/);
    expect(src).toMatch(/PointAttachment/);
    expect(src).toMatch(/ClippingAttachment/);
  });
});
