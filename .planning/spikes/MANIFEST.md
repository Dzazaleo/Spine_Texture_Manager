# Spike Manifest

## Idea

Multi-scale per-resolution variant exporter (SEED-010): from one full-size Spine export, produce
faithful scaled-down rig variants (scaled JSON + atlas + textures) sized to the peak render demand of
each smaller rig. The lever question is settled (don't scale a bone — do a full similarity bake = what
`SkeletonJson.scale` does). These spikes prove the one remaining unknown: **can we replicate Spine's
scale bake as an in-app JSON→JSON transform, validated faithfully?**

## Requirements

(Decisions that emerged; non-negotiable for the real build.)

- Variant production = **full similarity bake**, NOT a bone scale (root explodes; pivot leaves
  constraint residual — see SEED-010). **PROVEN feasible (Spikes 001–003).**
- Variant peak = **s × master_peak** (exact; bake is a true similarity → no re-sampling). The sampler's
  `peakScale` is **invariant under the bake** (blind spot, Spike 003-B) — NEVER size by sampling a variant.
- Faithfulness bar: a scaled variant must behave **identically** to the master. **Met:** Spike 003 shows
  world-AABB == s× for all 119 DEMON attachments incl the constraint-driven R_ARM.
- Bake = mirror spine-core `SkeletonJson.scale` (~30 source-derived field rules). **Scaled-default
  injection required:** absent `physics.limit` (→5000×s) and `referenceScale` (→100×s) must be written.
- Exclude parse-assigned `id`/`hash` from any field-equality oracle.
- Must work across the **dual runtime** (4.2 + 4.3) — verified field-identical on DEMON 4.3 +
  SIMPLE/3Queens/TEST_01 (4.2, incl. all-four-constraint-types). atlas-less is satisfied by
  construction (bake is a pure JSON-field transform, atlas-independent).
- Build's regression oracle: `parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)`, run on a
  **deform-heavy fixture** too (DEMON 4.3 has NO deform → false confidence; deform lives at
  `animations[a].attachments[skin][slot][att].deform` on BOTH runtimes, deform curve is normalized).
- physics `x`/`y` are NOT length-scaled (only `limit`). Setup-side bake is complete; the finite
  remaining work is **constraint-TIMELINE curve channels** (IK `softness` curve cy; PATH
  `position`/`spacing` timelines in length mode) — does not affect world-space fidelity.

## Spikes

| # | Name | Type | Validates | Verdict | Tags |
|---|------|------|-----------|---------|------|
| 001 | fieldmap-autoderive | standard | A clean, complete per-field scaling rule emerges from diffing `SkeletonJson.scale` 1 vs s (no unexplained OTHER) | ✅ VALIDATED | scale, oracle, 4.3 |
| 002 | json-bake-roundtrip | standard | Hand-baked JSON @scale 1 ≡ original @`SkeletonJson.scale=s` (field-identical) on 4.3 + 4.2 | ✅ VALIDATED | scale, bake, oracle |
| 003 | end-to-end-fidelity | standard | Baked variant world-AABB == s × master for all attachments incl R_ARM | ✅ VALIDATED | scale, fidelity |
