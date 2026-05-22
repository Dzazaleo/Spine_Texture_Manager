---
spike: 003
name: end-to-end-fidelity
type: standard
validates: "Given the baked variant sampled through the real pipeline, when compared to the master, then every attachment's world-AABB == s × master (incl R_ARM) and peakScale stays ×1 (blind spot)"
verdict: VALIDATED
related: [001, 002]
tags: [scale, fidelity, sampler, blind-spot]
---

# Spike 003: end-to-end-fidelity

## What This Validates

Sampling the baked variant through the **real app pipeline** (`loadSkeleton` + `sampleSkeleton`)
proves two things at once:
- **(A) Fidelity:** every attachment's world-space AABB is exactly `s × master` — the baked rig is a
  true similarity (identical-but-smaller), *including the constraint-driven `R_ARM`* that exploded
  +300…+600% under bone-scaling.
- **(B) Blind spot:** the sampler's `peakScale` (bone-world-scale) stays `×1` under the bake, so the
  build must size textures as `s × master_peak` arithmetically, **never** by sampling the variant.

## How to Run

```bash
npx tsx .planning/spikes/003-end-to-end-fidelity/fidelity.mjs
```

## Results — VALIDATED ✓

```
attachments compared: 119
(A) world-AABB ratio == s :   119/119 within 2% of 0.5
(B) peakScale ratio == 1  :   119/119 within 3% of 1.0

R_ARM:  world-AABB ×0.500   peakScale 0.1767 → 0.1767 (×1.000)
```

`R_ARM` — the bone-scale victim — is now **exactly 0.5×** in world space (perfectly faithful), while
its `peakScale` is unchanged (the blind spot). Both findings demonstrated on one attachment.

## Investigation Trail

- Built the variant via the Spike-002 `bake()` written to a temp JSON, then loaded it through the
  *production* `loadSkeleton`/`sampleSkeleton` path (not a bypass) — so this also smoke-tests that a
  baked file round-trips through the real loader on both atlas resolution and sampling.
- Frame alignment was a non-issue: a uniform similarity preserves animation dynamics, so master and
  variant peak at the same frame and the world-AABB ratio is a clean `s` everywhere.

## Signal for the Build

- **Architecture confirmed:** sample the master once → `variant_peak = s × master_peak` → resize
  textures + scaled atlas (existing pipeline) → bake the JSON (Spike 002). No re-sampling of variants.
- **Do NOT** feed a baked variant back through the sampler for sizing — `peakScale` is invariant under
  the coord bake (blind spot B). This is the one trap to encode in the build (and a good regression
  test).
