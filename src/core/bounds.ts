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

  // 3) MeshAttachment — best-fit affine SVD stretch (iteration-5).
  if (attachment instanceof MeshAttachment) {
    const n = attachment.worldVerticesLength;
    if (n <= 0) return null;
    const wv = new Float32Array(n);
    attachment.computeWorldVertices(slot, 0, n, wv, 0, 2);
    return affineStretch(attachment, wv)
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
 * Best-fit affine stretch via 2×2 SVD (iteration-5 mesh formula).
 *
 *   A = argmin_A ‖ W − A·S ‖²        (normal equations, post-centering)
 *   SVD(A) = U·Σ·Vᵀ, Σ = diag(σ₁, σ₂) with σ₁ ≥ σ₂ ≥ 0
 *   peakScaleX = σ₁   (major stretch — longer-axis)
 *   peakScaleY = σ₂   (minor stretch — shorter-axis)
 *   peakScale  = σ₁
 *
 * Where `S` is the 2×N matrix of centered source positions
 * (`attachment.uvs × (pageW, pageH)`) and `W` is the 2×N matrix of centered
 * world vertex positions (from `computeWorldVertices`). `A` is the best-fit
 * 2×2 linear map capturing the mesh's overall deformation; its singular
 * values are rotation-invariant and encode the stretch along the mesh's
 * principal deformation axes.
 *
 * Rationale (supersedes iter-4 isotropic hull_sqrt AND the earlier iter-5
 * attempt using min-area OBB): hull_sqrt collapses anisotropic deformation
 * (`2× in X, 0.5× in Y` reads as ≈1.0). The OBB-of-hull approach recovers
 * anisotropy but is dominated by hull-outlier vertices, over-reporting
 * attachments like AVATAR/LEGS (OBB: 1.584 vs user's expected 1.07 range).
 * SVD-of-best-fit-affine is outlier-robust because every vertex contributes
 * linearly to the normal equations — a single extreme vertex can't hijack
 * the fit the way it hijacks a hull extent.
 *
 * Properties:
 *   - Rigid rotation yields σ₁ = σ₂ = 1.0 (A is orthogonal).
 *   - Uniform scale λ yields σ₁ = σ₂ = λ.
 *   - Anisotropic a × b (source-X × source-Y) yields σ₁ = max(a,b), σ₂ = min.
 *   - Non-affine deformation yields the least-squares BEST AFFINE
 *     APPROXIMATION of the mesh's stretch — what a single resize would
 *     need to cover.
 *
 * Returns `null` if the mesh lacks a region or atlas page, or if the
 * source-positions matrix is degenerate (collinear). Caller falls back to
 * the weighted-sum formula.
 */
function affineStretch(
  attachment: MeshAttachment,
  worldVertices: Float32Array,
): { scale: number; scaleX: number; scaleY: number } | null {
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
  const n = worldVertices.length;
  if (!uvs || uvs.length < n || n < 6) return null;

  const numVerts = n >> 1;

  // Centroids of source and world positions.
  let scx = 0, scy = 0, wcx = 0, wcy = 0;
  for (let i = 0; i < numVerts; i++) {
    const ix = i * 2;
    scx += (uvs[ix] as number) * pageW;
    scy += (uvs[ix + 1] as number) * pageH;
    wcx += worldVertices[ix]!;
    wcy += worldVertices[ix + 1]!;
  }
  scx /= numVerts;
  scy /= numVerts;
  wcx /= numVerts;
  wcy /= numVerts;

  // Assemble the normal-equation sums over CENTERED positions.
  //   S·Sᵀ = [[Sxx, Sxy], [Sxy, Syy]]   (source Gram)
  //   W·Sᵀ = [[Cxx, Cxy], [Cyx, Cyy]]   (cross-correlation)
  let Sxx = 0, Syy = 0, Sxy = 0;
  let Cxx = 0, Cxy = 0, Cyx = 0, Cyy = 0;
  for (let i = 0; i < numVerts; i++) {
    const ix = i * 2;
    const sx = (uvs[ix] as number) * pageW - scx;
    const sy = (uvs[ix + 1] as number) * pageH - scy;
    const wx = worldVertices[ix]! - wcx;
    const wy = worldVertices[ix + 1]! - wcy;
    Sxx += sx * sx;
    Syy += sy * sy;
    Sxy += sx * sy;
    Cxx += wx * sx;
    Cxy += wx * sy;
    Cyx += wy * sx;
    Cyy += wy * sy;
  }

  const detS = Sxx * Syy - Sxy * Sxy;
  if (detS < 1e-9) return null; // collinear source — fit undefined

  // (S·Sᵀ)⁻¹ entries.
  const invS00 = Syy / detS;
  const invS01 = -Sxy / detS;
  const invS11 = Sxx / detS;

  // A = (W·Sᵀ) · (S·Sᵀ)⁻¹
  const A11 = Cxx * invS00 + Cxy * invS01;
  const A12 = Cxx * invS01 + Cxy * invS11;
  const A21 = Cyx * invS00 + Cyy * invS01;
  const A22 = Cyx * invS01 + Cyy * invS11;

  // Singular values of 2×2 A via closed form:
  //   σ₁² + σ₂² = ‖A‖_F² = A11² + A12² + A21² + A22²
  //   σ₁·σ₂ = |det A|
  // So σ² = (‖A‖_F² ± √(‖A‖_F⁴ − 4·det²)) / 2.
  const frobSq = A11 * A11 + A12 * A12 + A21 * A21 + A22 * A22;
  const detA = A11 * A22 - A12 * A21;
  const disc = Math.max(0, frobSq * frobSq - 4 * detA * detA);
  const sqrtDisc = Math.sqrt(disc);
  const s1sq = (frobSq + sqrtDisc) * 0.5;
  const s2sq = Math.max(0, (frobSq - sqrtDisc) * 0.5);
  const major = Math.sqrt(s1sq);
  const minor = Math.sqrt(s2sq);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;

  // Convention: scaleX holds the longer-axis stretch (σ₁), scaleY the
  // shorter-axis (σ₂). The axes are the mesh's INTRINSIC deformation
  // principal axes (post-SVD), not world X/Y.
  return { scale: major, scaleX: major, scaleY: minor };
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
