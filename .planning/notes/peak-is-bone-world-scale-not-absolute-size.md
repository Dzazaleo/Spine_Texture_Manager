---
title: Peak is measured as bone world scale, not absolute world size
date: 2026-05-21
context: /gsd-explore — Multi-Scale Per-Resolution Variant Exporter (SEED-010)
tags: [peak-calc, scaling, sampler, gotcha]
---

# Peak is measured as *bone world scale*, not absolute world size

## The fact

The per-attachment peak the app computes is, for **region** attachments, `|bone.getWorldScaleX()|`
/ `|bone.getWorldScaleY()|`, and for **mesh** attachments a world-area ratio
(`sqrt(worldArea / sourceArea)`). See [bounds.ts:140 `computeRenderScale`](../../src/core/bounds.ts)
and the region path's `boneAxisScales`. It is **not** the absolute world pixel extent of the
attachment.

## Why it matters (the gotcha)

Any future "scale the rig" feature must scale via a lever that changes **bone world scale**, or the
peak measurement won't see it.

- **Spine's built-in `SkeletonJson.scale`** (parse-time) scales *bone positions, image sizes, and
  translations* — but **not** bone `scaleX/scaleY` ratios. Under it: a **mesh** peak moves (its
  world vertices shrink), but a **region** peak does **not** (its bone world scale is unchanged).
  → Inconsistent across attachment types. **Wrong lever for this app.**

- **Root bone `scaleX/scaleY`** (set on the in-memory skeleton before `updateWorldTransform`)
  propagates into every descendant's world transform → moves **both** region and mesh peaks
  consistently. **Correct lever.**

## Caveat that follows from this (empirically confirmed — not subtle)

Because the lever is bone-scale (not a full geometric bake), transform/IK/path constraint
**world-length offsets stay fixed constants** under scaling. On a down-scaled rig those offsets are
relatively magnified, so constraints **fight the shrink** and constrained bones don't scale down.
The user measured this directly (2026-05-21): root-scaling a **4.3-constrained** rig sent a
constrained attachment's peak from the expected **~0.1 to ~0.7** (7×). Same hazard family as memory
`project_root_vs_parent_scale_world_constraint_miscalibration` (DEMON). So: never assume `peak × s`,
and **root-scale alone is NOT a faithful shrink for constrained rigs.**

**Empirical follow-up (DEMON 4.3, 2026-05-21 — `.planning/debug/_repro_multiscale_*.mjs`,
`_probe_sjscale_constraints.mjs`):**
- Scaling **root** is catastrophic (R_ARM +316…+619%); scaling the natural **pivot bone** avoids the
  catastrophe but leaves ±20–50% constraint residual; naive offset co-scaling makes it WORSE.
- **Resolution = don't scale a bone at all.** Spine's own `SkeletonJson.scale` does a correct full
  similarity bake including the hard 4.3 transform-constraint remap, via a deterministic rule:
  spatial fields ×s; angles/percents ×1; remap slopes `to[].scale` ×(s_target/s_source) — the
  spatial→angle slope goes ×1/s (the term the naive fix missed).
- **Consequence for measurement:** finding #2 (peak = bone world scale) still holds for the MASTER,
  but it stops being a design constraint — a multi-scale variant is produced by a full bake and its
  peak is computed arithmetically as `s × master_peak` (the bake is a proven true similarity → exact
  linearity). The variant is never sampled, so the bone-world-scale blind spot never bites. See
  SEED-010 ★ BREAKTHROUGH.

## Pointers

- [bounds.ts:140](../../src/core/bounds.ts) — `computeRenderScale` (region = bone world scale; mesh = area ratio)
- [sampler.ts:133](../../src/core/sampler.ts) — `sampleSkeleton` lifecycle
- [runtime-42.ts:194](../../src/core/runtime/runtime-42.ts) / [runtime-43.ts:256](../../src/core/runtime/runtime-43.ts) — throwaway `makeSkeleton`
- SEED-010 — the feature this finding gates
