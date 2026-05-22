---
spike: 001
name: fieldmap-autoderive
type: standard
validates: "Given DEMON parsed at SkeletonJson.scale 1 vs s, when the two SkeletonData graphs are deep-diffed, then a clean complete per-field scaling rule emerges with zero unexplained ratios"
verdict: VALIDATED
related: []
tags: [scale, oracle, 4.3]
---

# Spike 001: fieldmap-autoderive

## What This Validates

Given DEMON (Spine 4.3, all 4 constraint types) parsed at `SkeletonJson.scale = 1` vs `= 0.5`,
when the two parsed `SkeletonData` graphs are deep-diffed (cycle-safe), then **a clean, complete
per-field scaling rule emerges** — every changed numeric field classifies as `×s` / `×1/s` / `×s²`
(etc.), with **no unexplained `OTHER`** and no chaotic context-dependence. This is the kill-switch:
if Spine's own scaling were ad-hoc, replicating it would be infeasible.

## How to Run

```bash
npx tsx .planning/spikes/001-fieldmap-autoderive/derive.mjs
```

## What to Expect

A classification of every changed generalized field-path into UNEXPLAINED / CONTEXT-DEPENDENT /
CLEAN, plus a kill-switch read.

## Results — VALIDATED ✓

```
changed generalized field-paths: 5946
UNEXPLAINED (OTHER / 0→x): 0
CONTEXT-DEPENDENT: 0
CLEAN (single explainable ratio per path): 5946
```

**A deterministic scaling rule exists** across the entire 4.3 schema: bones (x/y/length),
mesh/path vertices, all constraint params, and **animation timeline values + bezier curve control
points** all scale by clean factors (overwhelmingly `×s`; the transform-constraint remap slope is the
only `×1/s`).

## Investigation Trail

1. First pass reported **33 UNEXPLAINED** fields — *all* of them `skins[].attachments[].*.id` (and
   `.sourceMesh.id`), with non-clean ratios (~1.5–1.99). These are **parse-time identifiers Spine
   assigns** — they don't exist in the source JSON, so they're (a) irrelevant to a JSON→JSON bake and
   (b) **must be excluded from the oracle** in Spike 002 (both sides recompute their own ids).
   Added `id`/`hash`/`assetId` to the diff skip-list → **0 unexplained**.

2. **Subtle caveat for the bake (Spike 002):** the diff filters `×1` (unchanged) fields, which *hid*
   one genuinely context-dependent field — the transform-constraint remap slope
   `properties[].to[].scale`. It is `×(s_target / s_source)`: **×1/s** for a spatial→angle mapping
   (the `R_IK_HEEL-to-R_IK_WRIST` rotate slope, confirmed in
   `.planning/debug/_probe_sjscale_constraints.mjs`) but **×1** for spatial→spatial. So a *pure*
   path→ratio table is **almost** sufficient — this one field needs light semantics (look at the
   source/target property kind). The Spike 002 oracle enforces this automatically (a wrong slope =
   a field mismatch).

## Signal for Spike 002

- The bake = mirror `SkeletonJson.scale`. **Read spine-core's `SkeletonJson` source** for the exact
  set of `* this.scale` reads — that's the authoritative field list (more reliable than re-deriving
  from a value diff).
- **Exclude `id`/`hash`/parse-assigned fields** from the field-identical oracle.
- Watch the **transform-constraint remap slope** (`to[].scale`) and **bezier curve control points**
  (value-axis scales, time-axis doesn't) — the two non-trivial spots.
