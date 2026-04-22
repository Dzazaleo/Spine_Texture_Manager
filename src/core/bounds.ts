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
  MeshAttachment,
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
 *     `|bone.getWorldScaleX()|` / `|bone.getWorldScaleY()|`.
 *   - MeshAttachment (iteration-3, GAP-FIX "Followup 2026-04-22"):
 *     `peakScale = max over triangles T of sqrt(world_area(T) / source_area(T))`.
 *     World area uses post-transform vertex positions; source area uses the
 *     mesh's page-normalized `uvs` scaled by atlas-page pixel dimensions.
 *     Isotropic by construction → `scaleX = scaleY = scale` (no X/Y split
 *     until a future iteration introduces per-axis edge projections).
 *   - Other (non-Mesh) VertexAttachment subtypes with no `triangles[]`:
 *     fall back to the weighted per-vertex bone-scale sum (iteration-1
 *     formula). NOTE: MeshAttachment always ships `triangles[]`, so this
 *     fallback only triggers for future VertexAttachment subtypes that gain
 *     pixel data without a triangulation.
 *   - Non-textured VertexAttachment subclasses (BoundingBox, Path, Point,
 *     Clipping): return `null`.
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

  // 3) MeshAttachment — per-triangle max area-ratio (iteration-3).
  if (attachment instanceof MeshAttachment) {
    const n = attachment.worldVerticesLength;
    if (n <= 0) return null;
    const wv = new Float32Array(n);
    attachment.computeWorldVertices(slot, 0, n, wv, 0, 2);
    return perTriangleMaxAreaRatio(attachment, wv)
      ?? weightedSumMeshRenderScale(slot, attachment);
  }

  // 4) Generic VertexAttachment — future pixel-bearing subtypes without
  //    `triangles[]`. Fall back to weighted per-vertex bone-scale sum.
  if (attachment instanceof VertexAttachment) {
    return weightedSumMeshRenderScale(slot, attachment);
  }

  return null;
}

/**
 * Per-triangle max-area-ratio render-scale (iteration-3 mesh formula).
 *
 * For every triangle T in the mesh:
 *   r(T) = sqrt( world_area(T) / source_area(T) )
 *   - world_area(T)  uses post-transform vertex positions (from `worldVertices`).
 *   - source_area(T) uses the mesh's page-normalized `uvs` scaled by the atlas
 *     page's pixel dimensions — the same basis `computeWorldVertices` uses
 *     for mesh positions at identity, so ratio ≈ 1.0 at setup pose.
 * Return `max(r)` across triangles. Isotropic by design → scaleX = scaleY = scale.
 *
 * Rationale (GAP-FIX "Followup 2026-04-22"): the weighted-sum formula
 * false-positives shared-bone spillover (BODY mesh reporting R_ARM's 1.319×
 * because a few vertices are rigged to the shoulder bone, even though the
 * mesh as a whole barely deforms). Reading triangle areas from actual world
 * vertex positions — AFTER bone weighting — captures local stretch where it
 * happens and ignores small-weight bone influences that move vertices
 * negligibly.
 *
 * Returns `null` if per-triangle computation is not possible (missing
 * `triangles[]`, missing region, or zero-sized page). Caller falls back to
 * the weighted-sum formula in those cases.
 */
function perTriangleMaxAreaRatio(
  attachment: MeshAttachment,
  worldVertices: Float32Array,
): { scale: number; scaleX: number; scaleY: number } | null {
  const triangles = attachment.triangles;
  if (!triangles || triangles.length < 3) return null;

  // Defensive: spine-core 4.2 ships `TextureAtlasRegion` with a direct
  // `.page` field. Older / alternative region shapes nest the page under
  // `.texture.page`. Guard both so a rehomed region type doesn't trip us.
  const region = attachment.region as
    | {
        page?: { width?: number; height?: number };
        texture?: { page?: { width?: number; height?: number } };
      }
    | null;
  const page = region?.page ?? region?.texture?.page;
  const pageW = page?.width ?? 0;
  const pageH = page?.height ?? 0;
  if (pageW <= 0 || pageH <= 0) return null;

  const uvs = attachment.uvs;
  if (!uvs || uvs.length < 6) return null;

  let maxRatio = 0;
  for (let ti = 0; ti < triangles.length; ti += 3) {
    const i0 = triangles[ti]! * 2;
    const i1 = triangles[ti + 1]! * 2;
    const i2 = triangles[ti + 2]! * 2;

    const wx0 = worldVertices[i0]!;
    const wy0 = worldVertices[i0 + 1]!;
    const wx1 = worldVertices[i1]!;
    const wy1 = worldVertices[i1 + 1]!;
    const wx2 = worldVertices[i2]!;
    const wy2 = worldVertices[i2 + 1]!;
    // 2× world triangle area (signed; take |.| below).
    const worldDouble =
      (wx1 - wx0) * (wy2 - wy0) - (wx2 - wx0) * (wy1 - wy0);

    const sx0 = (uvs[i0] as number) * pageW;
    const sy0 = (uvs[i0 + 1] as number) * pageH;
    const sx1 = (uvs[i1] as number) * pageW;
    const sy1 = (uvs[i1 + 1] as number) * pageH;
    const sx2 = (uvs[i2] as number) * pageW;
    const sy2 = (uvs[i2 + 1] as number) * pageH;
    const srcDouble =
      (sx1 - sx0) * (sy2 - sy0) - (sx2 - sx0) * (sy1 - sy0);

    // Skip degenerate (collinear or zero-area) source triangles — they can't
    // yield a meaningful ratio and would divide-by-zero.
    const srcAbs = Math.abs(srcDouble);
    if (srcAbs <= 1e-12) continue;
    const ratio = Math.abs(worldDouble) / srcAbs;
    if (ratio > maxRatio) maxRatio = ratio;
  }

  // All triangles degenerated (shouldn't happen on real meshes) — caller
  // will fall back to weighted-sum.
  if (maxRatio <= 0) return null;

  const scale = Math.sqrt(maxRatio);
  // Isotropic: sqrt(area-ratio) is a scalar, so X/Y are reported equal.
  // A future iteration may split per-axis via edge-projection ratios.
  return { scale, scaleX: scale, scaleY: scale };
}

/**
 * Weighted per-vertex bone-scale fallback (iteration-1 mesh formula). Kept for
 * future VertexAttachment subtypes that lack `triangles[]` — MeshAttachment
 * always ships triangles, so this path is currently unreachable in practice.
 */
function weightedSumMeshRenderScale(
  slot: Slot,
  attachment: VertexAttachment,
): { scale: number; scaleX: number; scaleY: number } {
  const bones = attachment.bones;
  if (!bones) return boneAxisScales(slot);

  const skeletonBones = slot.bone.skeleton.bones;
  const verts = attachment.vertices;
  let maxX = 0;
  let maxY = 0;
  let v = 0;
  let b = 0;
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

function boneAxisScales(
  slot: Slot,
): { scale: number; scaleX: number; scaleY: number } {
  const bone = slot.bone;
  const scaleX = Math.abs(bone.getWorldScaleX());
  const scaleY = Math.abs(bone.getWorldScaleY());
  return { scaleX, scaleY, scale: Math.max(scaleX, scaleY) };
}
