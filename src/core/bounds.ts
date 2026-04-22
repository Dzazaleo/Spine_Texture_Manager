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
import type { AABB, SourceDims } from './types.js';

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
 * Derive per-axis and peak scale factors for an attachment, given its world
 * AABB and source (pre-pack) dimensions.
 *
 *   scaleX = worldW / sourceW
 *   scaleY = worldH / sourceH
 *   scale  = max(scaleX, scaleY)    ← single-number peak reported per F2.5.
 *
 * Zero-dim guard (T-00-03-03): if `sourceDims.w` or `.h` is `0`, we return `0`
 * for that axis rather than `Infinity` / `NaN`. This keeps downstream
 * aggregation (peak tables, CLI rendering) from poisoning on malformed atlases.
 */
export function computeScale(
  aabb: AABB,
  sourceDims: SourceDims,
): { scaleX: number; scaleY: number; scale: number } {
  const worldW = aabb.maxX - aabb.minX;
  const worldH = aabb.maxY - aabb.minY;
  const scaleX = sourceDims.w > 0 ? worldW / sourceDims.w : 0;
  const scaleY = sourceDims.h > 0 ? worldH / sourceDims.h : 0;
  const scale = Math.max(scaleX, scaleY);
  return { scaleX, scaleY, scale };
}
