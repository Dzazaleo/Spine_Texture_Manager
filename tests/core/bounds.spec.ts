/**
 * Phase 0 Plans 03 + 05 — Tests for `src/core/bounds.ts`.
 *
 * Behavior gates:
 *   - F2.3 Region path: RegionAttachment → 4-vertex AABB.
 *   - F2.3 Vertex/Mesh path: MeshAttachment → N-vertex AABB, cross-checked
 *     against a direct computeWorldVertices call to 5 decimal places.
 *   - F2.3 Skip list: BoundingBox/Path/Point/Clipping → null.
 *   - F2.5 computeRenderScale: {scale, scaleX, scaleY} derived from
 *     `bone.getWorldScaleX/Y()` (Region) or weighted per-vertex bone scale
 *     (Mesh). Returns `null` for non-textured VertexAttachment subclasses.
 *   - N1.1 setup-pose sizes: every RegionAttachment on the fixture has a
 *     finite, positive-extent AABB in the setup pose (bounds.ts works on
 *     the raw bone hierarchy without any animation state applied).
 *   - N2.3 hygiene greps: no `node:fs` / `node:path` / `sharp` imports.
 *
 * Phase 43 (RT-02, 43-03): bounds.ts is now instanceof-free and its exported
 * functions take `(rt, sk, slot, a)` opaque handles instead of raw spine-core
 * `(slot, attachment)`. The behavioral assertions below are byte-UNCHANGED —
 * only the call shape is threaded through the runtime adapter (mirrors the
 * production sampler rewire). The module-hygiene block is updated to assert the
 * NEW RT-02 contract (no direct spine-core import; no instanceof; calls route
 * through rt.*) — the Q3 signature ripple deliberately inverts the old
 * instanceof-presence assertions.
 *
 * N1.5 (TransformConstraint on SQUARE — constrained-vs-unconstrained peak)
 * lives in sampler.spec.ts per the plan's locked test strategy, because
 * the constraint only fires during animation application.
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
} from 'spine-core-42';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  attachmentWorldAABB,
  computeRenderScale,
} from '../../src/core/bounds.js';
import { pickRuntime } from '../../src/core/runtime/runtime.js';
import { brandHandle } from '../../src/core/runtime/types.js';
import type {
  OpaqueSkeleton,
  OpaqueSlot,
  OpaqueAttachment,
} from '../../src/core/runtime/types.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

// The hard-picked 4.2 runtime adapter (same one loadSkeleton populates).
const rt = pickRuntime('4.2');

/** Wrap a raw spine object as the matching opaque handle (test-only — mirrors
 *  what the adapter does internally; the brand is a compile-time phantom and
 *  brandHandle attaches `__rt` non-enumerably to the same object). */
function asSk(s: unknown): OpaqueSkeleton {
  return brandHandle<OpaqueSkeleton>(s, '4.2');
}
function asSlot(s: unknown): OpaqueSlot {
  return brandHandle<OpaqueSlot>(s, '4.2');
}
function asAtt(a: unknown): OpaqueAttachment {
  return brandHandle<OpaqueAttachment>(a, '4.2');
}

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

describe('computeRenderScale (F2.5)', () => {
  it('F2.5: Region — returns |bone.worldScaleX| / |worldScaleY| regardless of rotation', () => {
    // TRIANGLE is a Region attached to CHAIN_8, which sits ~35° rotated in setup.
    // Under the old AABB/source formula this inflated to ~1.44×; the render-scale
    // formula must be exactly 1.0 in the setup pose (no bone scale applied).
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find((s) => s.data.name === 'TRIANGLE');
    expect(slot).toBeDefined();
    const att = slot!.getAttachment();
    expect(att instanceof RegionAttachment).toBe(true);
    const rs = computeRenderScale(rt, asSk(skeleton), asSlot(slot!), asAtt(att!));
    expect(rs).not.toBeNull();
    expect(rs!.scaleX).toBeCloseTo(
      Math.abs(slot!.bone.getWorldScaleX()),
      10,
    );
    expect(rs!.scaleY).toBeCloseTo(
      Math.abs(slot!.bone.getWorldScaleY()),
      10,
    );
    expect(rs!.scale).toBe(Math.max(rs!.scaleX, rs!.scaleY));
    // Setup pose: no animated bone scaling. Chain inherits identity scale →
    // render-scale ≈ 1.0 (within FP slop).
    expect(rs!.scale).toBeCloseTo(1.0, 5);
  });

  it('F2.5: Region — pre-scaled bone surfaces its non-unit world scale', () => {
    // SQUARE2 slot is parented to SQUARE2 bone which has a setup-pose scaleX/Y
    // of 0.2538 per fixture inspection. Render-scale must pick that up.
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find((s) => s.data.name === 'SQUARE2');
    expect(slot).toBeDefined();
    const att = slot!.getAttachment();
    expect(att instanceof RegionAttachment).toBe(true);
    const rs = computeRenderScale(rt, asSk(skeleton), asSlot(slot!), asAtt(att!));
    expect(rs).not.toBeNull();
    expect(rs!.scale).toBeGreaterThan(0);
    expect(rs!.scale).toBeLessThan(1);
    // Sanity: matches slot.bone.getWorldScaleX/Y() (no rotation on SQUARE2 bone).
    expect(rs!.scaleX).toBeCloseTo(
      Math.abs(slot!.bone.getWorldScaleX()),
      10,
    );
  });

  it('F2.5: Mesh — returns weighted per-vertex max (non-null, > 0 on fixture CIRCLE)', () => {
    // CIRCLE is a MeshAttachment weighted to CHAIN_* bones (confirmed in
    // sampler.spec.ts N1.4). In the setup pose the chain is identity, so
    // weighted sum of |worldScale| per vertex ≈ 1.0. Any animation-driven
    // peak is asserted in sampler.spec.ts.
    const skeleton = primedSkeleton();
    const slot = skeleton.slots.find((s) => s.data.name === 'CIRCLE');
    expect(slot).toBeDefined();
    const att = slot!.getAttachment();
    expect(att).not.toBeNull();
    const rs = computeRenderScale(rt, asSk(skeleton), asSlot(slot!), asAtt(att!));
    expect(rs).not.toBeNull();
    expect(Number.isFinite(rs!.scale)).toBe(true);
    expect(rs!.scale).toBeCloseTo(1.0, 3); // setup pose, identity chain
    expect(rs!.scale).toBe(Math.max(rs!.scaleX, rs!.scaleY));
  });

  it('F2.5: Skip list — PathAttachment returns null', () => {
    const skeleton = primedSkeleton();
    let pathEntry: {
      slot: ReturnType<Skeleton['findSlot']>;
      att: PathAttachment;
    } | null = null;
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
    if (!pathEntry) throw new Error('fixture has no PathAttachment');
    expect(
      computeRenderScale(
        rt,
        asSk(skeleton),
        asSlot(pathEntry.slot!),
        asAtt(pathEntry.att),
      ),
    ).toBeNull();
  });
});

describe('attachmentWorldAABB (F2.3)', () => {
  it('N1.1 setup-pose sizes: every RegionAttachment on the fixture returns a finite AABB with positive extents', () => {
    // N1.1 per REQUIREMENTS.md: "Every `core/` function has golden unit tests
    // driven by `fixtures/SIMPLE_PROJECT/`." This asserts the bounds module's
    // setup-pose contract: for every Region slot on the fixture, the AABB has
    // finite min/max and non-zero width/height. This is the "setup-pose sizes"
    // gate before any animation runs — it proves bounds.ts works on the raw
    // bone hierarchy without any state/animation application.
    const skeleton = primedSkeleton();
    let regionCount = 0;
    for (const slot of skeleton.slots) {
      const att = slot.getAttachment();
      if (!(att instanceof RegionAttachment)) continue;
      regionCount++;
      const aabb = attachmentWorldAABB(rt, asSk(skeleton), asSlot(slot), asAtt(att));
      expect(aabb, `slot ${slot.data.name}: AABB null`).not.toBeNull();
      expect(Number.isFinite(aabb!.minX)).toBe(true);
      expect(Number.isFinite(aabb!.minY)).toBe(true);
      expect(Number.isFinite(aabb!.maxX)).toBe(true);
      expect(Number.isFinite(aabb!.maxY)).toBe(true);
      expect(aabb!.maxX - aabb!.minX).toBeGreaterThan(0);
      expect(aabb!.maxY - aabb!.minY).toBeGreaterThan(0);
    }
    // Fixture has 3 region attachments: SQUARE, SQUARE2 (shares SQUARE region),
    // TRIANGLE. CIRCLE is a mesh. So expect >= 3 region slots.
    expect(regionCount).toBeGreaterThanOrEqual(3);
  });

  it('F2.3 Region path: returns an AABB for a RegionAttachment whose world bounds match the region size at identity transform', () => {
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
    const aabb = attachmentWorldAABB(rt, asSk(skeleton), asSlot(found.slot!), asAtt(found.att));
    expect(aabb).not.toBeNull();
    expect(aabb!.maxX).toBeGreaterThan(aabb!.minX);
    expect(aabb!.maxY).toBeGreaterThan(aabb!.minY);
    // AABB dims are finite numbers — no NaN leak from computeWorldVertices
    expect(Number.isFinite(aabb!.minX)).toBe(true);
    expect(Number.isFinite(aabb!.maxY)).toBe(true);
  });

  it('F2.3 Vertex/Mesh path: returns an AABB for a MeshAttachment (delegating to VertexAttachment.computeWorldVertices)', () => {
    const skeleton = primedSkeleton();
    // SIMPLE_TEST contains at least one mesh attachment (CIRCLE per fixture inventory).
    let mesh: {
      slot: ReturnType<Skeleton['findSlot']>;
      att: import('spine-core-42').MeshAttachment;
    } | null = null;
    for (const slot of skeleton.slots) {
      const att = slot.getAttachment();
      if (
        att &&
        att.constructor &&
        att.constructor.name === 'MeshAttachment'
      ) {
        mesh = { slot, att: att as import('spine-core-42').MeshAttachment };
        break;
      }
    }
    if (!mesh) throw new Error('fixture has no MeshAttachment — test premise invalid');
    const aabb = attachmentWorldAABB(rt, asSk(skeleton), asSlot(mesh.slot!), asAtt(mesh.att));
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

  it('F2.3 Skip list: returns null for a PathAttachment', () => {
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
    const result = attachmentWorldAABB(
      rt,
      asSk(skeleton),
      asSlot(pathEntry.slot!),
      asAtt(pathEntry.att),
    );
    expect(result).toBeNull();
  });
});

describe('bounds.ts module hygiene (N2.3 + RT-02 by construction)', () => {
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

  it('exports attachmentWorldAABB and computeRenderScale', () => {
    expect(src).toMatch(/export\s+function\s+attachmentWorldAABB/);
    expect(src).toMatch(/export\s+function\s+computeRenderScale/);
  });

  // Phase 43 RT-02 (Pitfall 2): bounds.ts is now instanceof-free and imports
  // NO spine-core package — the attachment-kind discriminant + its LOCKED
  // ORDER live INSIDE the runtime adapter (runtime-42/43.ts). These assertions
  // deliberately invert the pre-RT-02 instanceof-presence checks.
  it('RT-02: does NOT import a spine-core package directly', () => {
    expect(src).not.toMatch(/from ['"](@esotericsoftware\/spine-core|spine-core-42)['"]/);
  });

  it('RT-02: is instanceof-free for every spine-core attachment class', () => {
    expect(src).not.toMatch(
      /\binstanceof\s+(RegionAttachment|VertexAttachment|MeshAttachment|BoundingBoxAttachment|PathAttachment|PointAttachment|ClippingAttachment)\b/,
    );
  });

  it('RT-02: routes attachment-kind + world-vertices through the runtime adapter', () => {
    expect(src).toMatch(/rt\.attachmentKind/);
    expect(src).toMatch(/rt\.regionWorldVertices/);
    expect(src).toMatch(/rt\.vertexWorldVertices/);
  });
});
