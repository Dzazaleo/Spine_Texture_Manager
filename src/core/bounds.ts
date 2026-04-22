/**
 * Phase 0 Plan 03 — Per-attachment world AABB + scale math.
 *
 * Pure, stateless, zero-I/O math module. The sampler calls `attachmentWorldAABB`
 * every tick × every visible slot, so this is the inner-loop workhorse of Phase 0.
 *
 * Contract (locked in 00-CONTEXT.md "Per-attachment AABB (locked)"):
 *   - RegionAttachment:  delegate to `attachment.computeWorldVertices(slot, wv, 0, 2)`
 *                        — 4 vertices → AABB from min/max of those 4 (x,y) pairs.
 *   - MeshAttachment + any other VertexAttachment with pixels:
 *                        delegate to `attachment.computeWorldVertices(slot, 0, N, wv, 0, 2)`
 *                        where N = `worldVerticesLength` (= 2 × vertex count).
 *   - BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment:
 *                        return `null` — no source texture to scale.
 *
 * Precondition (caller responsibility — not checked here for perf):
 *   The caller MUST have run `skeleton.updateWorldTransform(Physics.update)` since
 *   the last bone/constraint mutation. This function does NOT re-run the transform
 *   pipeline; it only reads post-transform bone state via spine-core's
 *   `computeWorldVertices`. Per CLAUDE.md #2: that call already accounts for
 *   the bone chain, slot scale, weighted-mesh bone influences, IK,
 *   TransformConstraints, PathConstraints, PhysicsConstraints, and DeformTimelines.
 *   We do NOT re-implement any of that.
 *
 * I/O rule (N2.3): this module imports nothing from `node:fs`, `node:path`,
 * `node:child_process`, `node:net`, `node:http`, or the PNG-decode library
 * (deferred to Phase 8 by design) — enforced by tests under
 * `tests/core/bounds.spec.ts` and by spec grep in the plan.
 */

import {
  RegionAttachment,
  VertexAttachment,
  BoundingBoxAttachment,
  PathAttachment,
  PointAttachment,
  ClippingAttachment,
  type Slot,
  type Attachment,
} from '@esotericsoftware/spine-core';
import type { AABB } from './types.js';

/**
 * Compute the world-space AABB of a single attachment on a slot.
 *
 * Returns `null` for non-textured attachments (BoundingBox, Path, Point, Clipping).
 *
 * NOTE on instanceof ordering — it is deliberate and MUST NOT be reordered:
 *   1. `RegionAttachment` (most common, independent branch).
 *   2. The four non-textured VertexAttachment subclasses (skip list). These
 *      are all subclasses of `VertexAttachment`, so they MUST be filtered
 *      BEFORE the generic `VertexAttachment` fallthrough; otherwise the
 *      generic branch would incorrectly try to allocate & fill a world-vertices
 *      buffer for attachments that carry no pixel data.
 *   3. `VertexAttachment` — catch-all for MeshAttachment and any future
 *      pixel-carrying VertexAttachment subtype.
 */
export function attachmentWorldAABB(
  slot: Slot,
  attachment: Attachment,
): AABB | null {
  // 1) Region — 4 vertices.
  if (attachment instanceof RegionAttachment) {
    const v = new Float32Array(8);
    attachment.computeWorldVertices(slot, v, 0, 2);
    return aabbFromFloat32(v, 4);
  }

  // 2) Skip list — no source texture to size (return null BEFORE the generic
  //    VertexAttachment branch, because these all extend VertexAttachment).
  if (
    attachment instanceof BoundingBoxAttachment ||
    attachment instanceof PathAttachment ||
    attachment instanceof PointAttachment ||
    attachment instanceof ClippingAttachment
  ) {
    return null;
  }

  // 3) Generic VertexAttachment (covers MeshAttachment and any future
  //    pixel-carrying VertexAttachment subtype).
  if (attachment instanceof VertexAttachment) {
    const n = attachment.worldVerticesLength;
    if (n <= 0) return null;
    const v = new Float32Array(n);
    attachment.computeWorldVertices(slot, 0, n, v, 0, 2);
    return aabbFromFloat32(v, n / 2);
  }

  return null;
}

/**
 * Fold a flat Float32Array of `(x, y)` pairs into an AABB.
 *
 * @param buf         World-vertices buffer; length MUST be `vertexCount * 2`.
 * @param vertexCount Number of (x, y) pairs to consume from the front of `buf`.
 *                    RegionAttachment always yields 4; VertexAttachment yields
 *                    `worldVerticesLength / 2`.
 *
 * Why Infinity sentinels: starting with `+/-Infinity` avoids a branch on the
 * first iteration and lets us express "empty set" as `{minX:Infinity, maxX:-Infinity}`.
 * The caller guards against empty buffers (`n <= 0`) above, so the returned
 * AABB has real finite bounds for any real attachment.
 */
function aabbFromFloat32(buf: Float32Array, vertexCount: number): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const x = buf[i * 2]!;
    const y = buf[i * 2 + 1]!;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Derive the intrinsic render-scale applied to an attachment's source pixels,
 * independent of any rotation that widens the world-space AABB.
 *
 *   - RegionAttachment: the attachment's source pixels are stretched by the
 *     slot bone's world scale. Per-axis magnitudes are the canonical
 *     `|bone.getWorldScaleX()|` / `|bone.getWorldScaleY()|` (which spine-core
 *     derives from the bone's 2×2 affine as `sqrt(a²+c²)` / `sqrt(b²+d²)`).
 *   - Mesh / VertexAttachment: per-vertex effective world-scale is the
 *     weighted sum of influencing bones' `|worldScaleX|` / `|worldScaleY|`
 *     (weights normalize to 1 per vertex by construction; we still take
 *     literal `Σ wᵢ |bᵢ.worldScale|` without renormalizing because that's the
 *     same composition computeWorldVertices uses for positions). We return
 *     the MAX across vertices so the peak reflects the most-stretched vertex.
 *   - Non-textured VertexAttachment subclasses (BoundingBox, Path, Point,
 *     Clipping): return `null`.
 *
 * Rationale: the prior `computeScale(aabb, sourceDims)` implementation used
 * `worldAABB_W/sourceW` as scale, which for a rotated attachment inflates
 * scale by up to √2 (rotation widens the AABB). `computeRenderScale` isolates
 * the actual scaling applied before rotation — which is what an animator
 * needs to right-size a source texture. Peak AABB W×H is still reported
 * separately via `attachmentWorldAABB` for layout purposes.
 *
 * Precondition (caller responsibility): same as `attachmentWorldAABB` — a
 * prior `skeleton.updateWorldTransform(Physics.update)` must have been run
 * so bone `a/b/c/d/worldX/worldY` are current.
 */
export function computeRenderScale(
  slot: Slot,
  attachment: Attachment,
): { scale: number; scaleX: number; scaleY: number } | null {
  // 1) Region — source pixels transform by slot.bone only.
  if (attachment instanceof RegionAttachment) {
    return boneAxisScales(slot);
  }

  // 2) Skip list — non-textured VertexAttachment subclasses.
  if (
    attachment instanceof BoundingBoxAttachment ||
    attachment instanceof PathAttachment ||
    attachment instanceof PointAttachment ||
    attachment instanceof ClippingAttachment
  ) {
    return null;
  }

  // 3) VertexAttachment (mesh) — weighted per-vertex.
  if (attachment instanceof VertexAttachment) {
    const bones = attachment.bones;
    // Non-weighted mesh: all vertices live in slot.bone's local frame.
    if (!bones) return boneAxisScales(slot);

    const skeletonBones = slot.bone.skeleton.bones;
    const verts = attachment.vertices;
    let maxX = 0;
    let maxY = 0;
    let v = 0; // cursor into `bones`      — `[n, boneIdx, boneIdx, …]` per vertex
    let b = 0; // cursor into `vertices`   — `[x, y, weight]` per bone-influence
    const numVerts = attachment.worldVerticesLength >> 1;
    for (let i = 0; i < numVerts; i++) {
      const n = bones[v++]!;
      let vx = 0;
      let vy = 0;
      for (let j = 0; j < n; j++, v++, b += 3) {
        const bone = skeletonBones[bones[v]!]!;
        const weight = verts[b + 2] as number;
        vx += Math.abs(bone.getWorldScaleX()) * weight;
        vy += Math.abs(bone.getWorldScaleY()) * weight;
      }
      if (vx > maxX) maxX = vx;
      if (vy > maxY) maxY = vy;
    }
    return { scaleX: maxX, scaleY: maxY, scale: Math.max(maxX, maxY) };
  }

  return null;
}

function boneAxisScales(
  slot: Slot,
): { scale: number; scaleX: number; scaleY: number } {
  const bone = slot.bone;
  const scaleX = Math.abs(bone.getWorldScaleX());
  const scaleY = Math.abs(bone.getWorldScaleY());
  return { scaleX, scaleY, scale: Math.max(scaleX, scaleY) };
}
