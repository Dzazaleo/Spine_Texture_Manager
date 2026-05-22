// src/core/setup-bounds.ts — Phase 50 Plan 01 (SCALEUI-02).
//
// Layer-3-pure setup-pose ALL-SKINS bounding-box reference. Computes the rig's
// overall world-space extent (W×H px) at rest, the data the Wave-2 two-way
// control (50-02) reads as its reference axes.
//
// Design (LOCKED decisions — do not relitigate):
//   D-05  We COMPUTE the bbox ourselves from runtime geometry; we NEVER read the
//         untrusted editor `skeleton.width/height` header (it is editor metadata
//         like `fps`, default-padded and not runtime-binding).
//   D-06  The bbox is the ALL-SKINS MANIFEST UNION at setup-pose bone transforms
//         — every skin's manifest (sampler.ts Pass-1.5 pattern), NOT just the
//         live setup-pose slot bindings. This avoids the "eyes-only setup" trap
//         where a rig binds only a tiny attachment at rest but is full-body sized.
//         Measures WITHOUT mutating slot bindings (project_sampler_visibility_invariant).
//   D-07  The skeleton is materialized dual-runtime via `load.runtime.makeSkeleton`
//         ONLY — never a hardcoded `new Skeleton` ctor (REG-47-01 /
//         project_shared_42base_subclass_43_dualruntime_hazard). A loud null-guard
//         on `load.runtime`.
//
// This GENERALIZES the proven `aggregateWorldAABB` body
// (tests/main/variant-dropin-faithful.spec.ts:153-180): same REG-47-01-safe
// lifecycle + null-guard, with the slot-bindings inner loop swapped for the
// all-skins manifest union (D-06).
//
// CLAUDE.md #2: the per-attachment AABB math (computeWorldVertices etc.) lives in
// `attachmentWorldAABB` — we do NOT reimplement it; we only union its results.
import { attachmentWorldAABB } from './bounds.js';
import type { LoadResult } from './types.js';
import type { OpaqueSkeletonData } from './runtime/types.js';

/**
 * Compute the rig's setup-pose all-skins bounding box (W×H px) via the
 * loader-picked dual-runtime adapter.
 *
 * @returns `{ w, h }` finite extents, or `null` for a degenerate rig (no textured
 *          region/mesh attachment in ANY skin). `null` — not a non-finite
 *          `-Infinity` — is the contract: the value crosses IPC via the
 *          SkeletonSummary `structuredClone` ferry, where a non-finite number
 *          would corrupt the renderer (T-50-FIN / RESEARCH Pitfall 1).
 */
export function computeSetupPoseBounds(load: LoadResult): { w: number; h: number } | null {
  const rt = load.runtime;
  if (rt == null) {
    // REG-47-01 contract: the loader must populate load.runtime. Loud, never
    // silent — a missing adapter is a wiring bug, not a degenerate rig.
    throw new Error('computeSetupPoseBounds: load.runtime missing (loader must bind it)');
  }
  const skeletonData = load.skeletonData as unknown as OpaqueSkeletonData;

  // REG-47-01-safe lifecycle (CLAUDE.md #3 setup-pose pass) via the adapter —
  // NEVER `new Skeleton` (D-07). 'pose' maps to Physics.pose in both adapters.
  const sk = rt.makeSkeleton(skeletonData);
  rt.setupPoseSlots(sk);                // 4.2 setSlotsToSetupPose | 4.3 setupPoseSlots
  rt.setupPose(sk);                     // 4.2 setToSetupPose       | 4.3 setupPose
  rt.updateWorldTransform(sk, 'pose');  // 'pose' -> Physics.pose

  const slots = rt.slots(sk);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let measured = 0;

  // ALL-SKINS MANIFEST UNION (D-06) — every skin's manifest, NOT live slot
  // bindings. Pass-1.5 pattern (sampler.ts:238-251); measures WITHOUT mutating
  // slot bindings (project_sampler_visibility_invariant). World transforms from
  // the setup-pose pass above are current; attachmentWorldAABB accepts arbitrary
  // (slot, attachment) params with no slot.setAttachment mutation needed.
  for (const skin of rt.skins(skeletonData)) {
    for (const entry of rt.skinEntries(skin)) {
      const slot = slots[entry.slotIndex];
      if (slot === undefined) continue;  // defensive (skin/skeleton drift)
      const att = entry.attachment;
      if (att == null) continue;
      const aabb = attachmentWorldAABB(rt, sk, slot, att);
      if (aabb === null) continue;       // skip-list: bbox/path/point/clipping — no texture
      measured++;
      if (aabb.minX < minX) minX = aabb.minX;
      if (aabb.maxX > maxX) maxX = aabb.maxX;
      if (aabb.minY < minY) minY = aabb.minY;
      if (aabb.maxY > maxY) maxY = aabb.maxY;
    }
  }

  // DEGENERATE GUARD (T-50-FIN / Pitfall 1): no textured attachment in any skin
  // -> the Infinity sentinels never moved -> maxX-minX === -Infinity (non-finite).
  // Returning that pushes a non-finite value across IPC and breaks the
  // SkeletonSummary structuredClone contract (summary.spec.ts). Return null.
  if (measured === 0) return null;
  return { w: maxX - minX, h: maxY - minY };
}
