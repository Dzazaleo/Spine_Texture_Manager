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

import type { AABB } from './types.js';
import type { SpineRuntime } from './runtime/runtime.js';
import type {
  OpaqueSkeleton,
  OpaqueSlot,
  OpaqueAttachment,
} from './runtime/types.js';

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
  rt: SpineRuntime,
  sk: OpaqueSkeleton,
  slot: OpaqueSlot,
  a: OpaqueAttachment,
): AABB | null {
  // The kind discriminant + its LOCKED ORDER (Region → skip-list → mesh/vertex)
  // lives INSIDE the adapter's `attachmentKind` (runtime-42/43.ts) — bounds.ts
  // is now instanceof-free (RT-02 / Pitfall 2). Math byte-UNCHANGED.
  const kind = rt.attachmentKind(a);

  // 1) Region — 4 vertices.
  if (kind === 'region') {
    return aabbFromFloat32(rt.regionWorldVertices(slot, a), 4);
  }

  // 2) Skip list — no source texture to size (BoundingBox/Path/Point/Clipping).
  if (kind === 'skip') {
    return null;
  }

  // 3) Mesh / generic VertexAttachment (covers MeshAttachment and any future
  //    pixel-carrying VertexAttachment subtype).
  if (kind === 'mesh' || kind === 'vertex') {
    const v = rt.vertexWorldVertices(sk, slot, a);
    if (v.length <= 0) return null;
    return aabbFromFloat32(v, v.length / 2);
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
  rt: SpineRuntime,
  sk: OpaqueSkeleton,
  slot: OpaqueSlot,
  a: OpaqueAttachment,
): { scale: number; scaleX: number; scaleY: number } | null {
  const kind = rt.attachmentKind(a);

  // 1) Region — source pixels transform by slot.bone only.
  if (kind === 'region') {
    return boneAxisScales(rt, slot);
  }

  // 2) Skip list — non-textured VertexAttachment subclasses.
  if (kind === 'skip') {
    return null;
  }

  // 3) MeshAttachment — convex-hull area-ratio (iteration-4).
  if (kind === 'mesh') {
    const wv = rt.vertexWorldVertices(sk, slot, a);
    if (wv.length <= 0) return null;
    return hullAreaRatio(rt, a, wv)
      ?? weightedSumMeshRenderScale(rt, slot, a);
  }

  // 4) Generic VertexAttachment — future pixel-bearing subtypes without
  //    `triangles[]`. Fall back to weighted per-vertex bone-scale sum.
  if (kind === 'vertex') {
    return weightedSumMeshRenderScale(rt, slot, a);
  }

  return null;
}

/**
 * Convex-hull area-ratio render-scale (iteration-4 mesh formula).
 *
 *   peakScale(mesh) = sqrt( area(hull(worldVertices)) / area(hull(sourceVertices)) )
 *
 * Source vertices are `attachment.uvs` (page-normalized) scaled by atlas page
 * pixel dimensions — the same basis `computeWorldVertices` uses at identity
 * so ratio ≈ 1.0 at setup pose. Isotropic by construction → scaleX = scaleY.
 *
 * Rationale (GAP-FIX iter-2 table validated winner): the weighted-sum formula
 * (iter-1) false-positived shared-bone spillover; the per-triangle max-area
 * formula (iter-3) over-reported local boundary-triangle stretches the user
 * doesn't see in the editor. Hull area captures the mesh's OVERALL
 * deformation footprint — what a dummy texture must cover — without
 * amplifying local triangle curl at weighted-bone joints. Matched user
 * ground truth across all three fixtures: BODY 1.07, R_ARM 1.319, uniform
 * 1.6× → 1.606.
 *
 * Known limit (accepted, flagged in GAP-FIX): isotropic. "Stretched 2× in X,
 * 0.5× in Y" reports ≈ 1.0 (same area as identity) — indistinguishable from
 * "no deformation." A future iteration adds per-axis split via OBB aspect
 * or edge projections.
 *
 * Returns `null` if the mesh lacks a region or atlas page (source area
 * undefined). Caller falls back to the weighted-sum formula.
 */
function hullAreaRatio(
  rt: SpineRuntime,
  a: OpaqueAttachment,
  worldVertices: Float32Array,
): { scale: number; scaleX: number; scaleY: number } | null {
  // Region meta routed through the adapter (Pitfall 4 / PORT-02): 4.2 reads
  // attachment.region.{page,originalWidth/Height} + attachment.width/height;
  // 4.3 resolves the same via sequence.regions[idx]. The adapter normalizes
  // both to { pageW, pageH, originalW, originalH, canonW, canonH }. The
  // page-resolution defensive guard (.page ?? .texture.page) lives inside the
  // adapter's attachmentRegionMeta.
  const meta = rt.attachmentRegionMeta(a);
  const pageW = meta?.pageW ?? 0;
  const pageH = meta?.pageH ?? 0;
  if (pageW <= 0 || pageH <= 0) return null;

  const uvs = rt.attachmentUVs(a);
  const n = worldVertices.length;
  if (!uvs || uvs.length < n || n < 6) return null;

  // Build the source-space buffer (uvs × page dims) in a scratch Float32Array.
  const sv = new Float32Array(n);
  for (let i = 0; i < n; i += 2) {
    sv[i] = (uvs[i] as number) * pageW;
    sv[i + 1] = (uvs[i + 1] as number) * pageH;
  }

  const worldArea = hullArea(worldVertices, n >> 1);
  const sourceArea = hullArea(sv, n >> 1);
  if (sourceArea <= 1e-12) return null;

  const ratio = worldArea / sourceArea;
  if (!(ratio > 0)) return null; // NaN/Infinity guard

  // Peak-anchored invariant (2026-05-05): correct the source-area basis from
  // current-page-pixel-space to canonical-page-pixel-space when the loader
  // detected a pre-optimized region (region.originalWidth/Height < the
  // canonical attachment width/height declared in the JSON skin). Without
  // this correction, sourceArea shrinks with the on-disk PNG → peakScale
  // grows → the panel's Peak W×H column "follows the source" instead of
  // staying invariant. The fix scales sv hull area back to the canonical
  // pixel basis so peakScale measures world-AABB vs canonical-AABB,
  // independent of the texture resolution actually loaded.
  //
  // Region attachments don't need this — boneAxisScales (above) is purely
  // bone-driven and already invariant of texture dims. The bug is mesh-only
  // because hullAreaRatio is the only path that uses page-pixel space as
  // the source basis.
  //
  // Atlas page dims and the attachment's declared canonical dims diverge in
  // two scenarios:
  //   (a) atlas-less mode + shrunk PNG: page=PNG, both shrink together, but
  //       the JSON's att.width/height stays at canonical → ratio binds.
  //   (b) canonical atlas re-packed with shrunk originals: same idea.
  // In both cases the correction factor is (att.width × att.height) /
  // (region.originalWidth × region.originalHeight). When dims agree
  // (canonical, no drift), the factor is 1.0 — no change to existing
  // behavior. spine-core 4.2 ships attachment.width/height on Mesh as the
  // canonical pixel dims from JSON; region.originalWidth/Height tracks the
  // on-disk basis the page is in.
  const canonW = meta?.canonW ?? 0;
  const canonH = meta?.canonH ?? 0;
  const origW = meta?.originalW ?? 0;
  const origH = meta?.originalH ?? 0;
  let scale = Math.sqrt(ratio);
  if (canonW > 0 && canonH > 0 && origW > 0 && origH > 0) {
    // Isotropic correction: sourceArea_canonical = sourceArea_page × (canon/orig)^2.
    // peakScale = sqrt(world / sourceArea_canonical) = sqrt(world/sourceArea_page) × (orig/canon).
    // Use the geometric mean across both axes for non-square shrinks.
    const correction = Math.sqrt((origW * origH) / (canonW * canonH));
    scale *= correction;
  }
  // Isotropic: sqrt(area-ratio) is a scalar, so X/Y are reported equal.
  return { scale, scaleX: scale, scaleY: scale };
}

/**
 * Convex hull area via Andrew's monotone chain on an index permutation (no
 * allocations per-vertex). Returns the polygon area of the hull.
 *
 * Points come from a flat `Float32Array` of `[x0, y0, x1, y1, ...]` with
 * `numPoints` pairs to consume. Indices are sorted by (x, y); the lower and
 * upper hulls are built into a reused `hullIdx` buffer; the shoelace sum is
 * computed directly from the ordered indices.
 */
function hullArea(buf: Float32Array, numPoints: number): number {
  if (numPoints < 3) return 0;
  // Sort an index array by (x asc, y asc). `Int32Array.sort` takes a
  // comparator; the comparator reads (x, y) from the flat buffer.
  const idx = new Int32Array(numPoints);
  for (let i = 0; i < numPoints; i++) idx[i] = i;
  // `Array` sort (Int32Array.sort lacks a stable comparator across engines
  // historically; for Jokerman-scale meshes this is fine — swap to a typed
  // radix if profiling flags it).
  const idxArr: number[] = Array.from(idx);
  idxArr.sort((a, b) => {
    const ax = buf[a * 2]!;
    const bx = buf[b * 2]!;
    if (ax !== bx) return ax - bx;
    return buf[a * 2 + 1]! - buf[b * 2 + 1]!;
  });

  // `hullIdx` holds the current lower-then-upper hull indices.
  const hullIdx = new Int32Array(numPoints * 2);
  let h = 0;
  // Lower hull.
  for (let k = 0; k < numPoints; k++) {
    const i = idxArr[k]!;
    while (h >= 2 && cross(buf, hullIdx[h - 2]!, hullIdx[h - 1]!, i) <= 0) h--;
    hullIdx[h++] = i;
  }
  // Upper hull.
  const lowerEnd = h + 1;
  for (let k = numPoints - 2; k >= 0; k--) {
    const i = idxArr[k]!;
    while (h >= lowerEnd && cross(buf, hullIdx[h - 2]!, hullIdx[h - 1]!, i) <= 0) h--;
    hullIdx[h++] = i;
  }
  // Last point equals first — drop it for shoelace.
  const m = h - 1;
  if (m < 3) return 0;

  // Shoelace over ordered hull.
  let sum = 0;
  for (let k = 0; k < m; k++) {
    const a = hullIdx[k]!;
    const b = hullIdx[k + 1 === m ? 0 : k + 1]!;
    sum += buf[a * 2]! * buf[b * 2 + 1]! - buf[b * 2]! * buf[a * 2 + 1]!;
  }
  return Math.abs(sum) * 0.5;
}

/** 2D cross product `(p1 - p0) × (p2 - p0)` given point indices into a flat buffer. */
function cross(buf: Float32Array, p0: number, p1: number, p2: number): number {
  const ax = buf[p1 * 2]! - buf[p0 * 2]!;
  const ay = buf[p1 * 2 + 1]! - buf[p0 * 2 + 1]!;
  const bx = buf[p2 * 2]! - buf[p0 * 2]!;
  const by = buf[p2 * 2 + 1]! - buf[p0 * 2 + 1]!;
  return ax * by - ay * bx;
}

/**
 * Weighted per-vertex bone-scale fallback (iteration-1 mesh formula). Kept for
 * future VertexAttachment subtypes that lack `triangles[]` — MeshAttachment
 * always ships triangles, so this path is currently unreachable in practice.
 */
function weightedSumMeshRenderScale(
  rt: SpineRuntime,
  slot: OpaqueSlot,
  a: OpaqueAttachment,
): { scale: number; scaleX: number; scaleY: number } {
  // generic-VertexAttachment per-influence path: unreachable for
  // MeshAttachment (triangles[] always present, bounds.ts:360 docstring —
  // computeRenderScale's `kind === 'mesh'` branch never falls here; only the
  // `kind === 'vertex'` future-subtype branch can, and SAFE-02's frozen corpus
  // contains no such attachment so it stays byte-green). If a future
  // triangulation-less VertexAttachment subtype reaches here, it needs a
  // per-bone adapter accessor (the 43 interface exposes boneAxisScale(slot)
  // only — out of scope; flagged). The narrow structural reads below are the
  // verbatim relocation of the original per-influence math (skeletonBones from
  // slot.bone.skeleton.bones, exactly as the pre-RT-02 source); it is dead
  // code on the frozen corpus and is byte-inert.
  const att = a as unknown as {
    bones: number[] | null | undefined;
    vertices: ArrayLike<number>;
    worldVerticesLength: number;
  };
  const bones = att.bones;
  if (!bones) return boneAxisScales(rt, slot);

  const skeletonBones = (slot as unknown as {
    bone: {
      skeleton: {
        bones: Array<{ getWorldScaleX(): number; getWorldScaleY(): number }>;
      };
    };
  }).bone.skeleton.bones;
  const verts = att.vertices;
  let maxX = 0;
  let maxY = 0;
  let v = 0;
  let b = 0;
  const numVerts = att.worldVerticesLength >> 1;
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
  rt: SpineRuntime,
  slot: OpaqueSlot,
): { scale: number; scaleX: number; scaleY: number } {
  // 4.2: |bone.getWorldScaleX/Y()|; 4.3: |bone.appliedPose.getWorldScaleX/Y()|
  // (D-03 structural defense lives inside runtime-43.boneAxisScale).
  const { x: scaleX, y: scaleY } = rt.boneAxisScale(slot);
  return { scaleX, scaleY, scale: Math.max(scaleX, scaleY) };
}
