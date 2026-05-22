---
spike: 002
name: json-bake-roundtrip
type: standard
validates: "Given the SkeletonJson.scale field rules applied as a raw-JSON transform, when the baked JSON is loaded at scale 1, then its SkeletonData is field-identical to the original loaded at SkeletonJson.scale=s — on 4.3 + 4.2"
verdict: VALIDATED
related: [001]
tags: [scale, bake, oracle, dual-runtime]
---

# Spike 002: json-bake-roundtrip

## What This Validates

A pure JSON→JSON transform (`bake(json, s)`) that mirrors spine-core's `SkeletonJson.scale` field
rules produces, when re-loaded at scale 1, a `SkeletonData` **field-identical** to the original
loaded at `SkeletonJson.scale = s`. The oracle is sampling-free and decisive: equality means the bake
*is* Spine's own scaling, expressed on the JSON we control.

## How to Run

```bash
npx tsx .planning/spikes/002-json-bake-roundtrip/bake.mjs   # runs the oracle on 4.3 + 4.2 + odd factor
```
`baker.mjs` exports the validated `bake(json, s)` (reused by Spike 003).

## What to Expect

`✅ FIELD-IDENTICAL` for each target, then `✅ ALL ORACLES PASSED`.

## Research

The bake rules were transcribed directly from `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js`
(every `* this.scale` read) — the authoritative spec. ~30 rules. Highlights:
- bones `x/y/length` ×s; `scaleX/Y/rotation/shear*` unchanged.
- transform constraint offsets `x/y` ×s; remap `to[].offset/max` ×toScale; `to[].scale` ×toScale/fromScale
  (spatial→angle slope ⇒ ×1/s).
- region `x/y/width/height` ×s; mesh `width/height` + vertices (weighted: positions only) ×s.
- timelines: `translate*`/deform values + bezier **cy** control points ×s; ik `softness` ×s.
- 4.2 differs only in schema shape (split `transform/ik/path/physics[]` vs 4.3 unified `constraints[]`,
  and no property-remap) — same value rules.

## Results — VALIDATED ✓

```
4.3 DEMON  (all constraints, mesh, physics, slider) @ s=0.5  → ✅ FIELD-IDENTICAL
4.2 SIMPLE_PROJECT (transform constraint, chain)    @ s=0.5  → ✅ FIELD-IDENTICAL
4.3 DEMON  @ odd factor 0.26                                 → ✅ FIELD-IDENTICAL
```

## Investigation Trail

1. First run: **2 mismatches** — `physics.limit` (139×) and `referenceScale` (1×). Root cause: spine
   scales the **default** value (`getValue(map,"limit",5000) * scale`), so an *absent* field still
   becomes `default × s` in the parse. **Rule discovered:** fields with a scaled non-zero default
   must be *injected* (set to `default × s`) when absent, not merely scaled-if-present. (Defaults of 0
   need no injection — `0 × s = 0`.) Fixed → field-identical.
2. Generalized the baker to both schemas (4.3 unified `constraints[]` + 4.2 split arrays); 4.2 oracle
   passed unchanged.
3. atlas-less: the bake is a **pure JSON-field transform, atlas-independent by construction** — the
   scaled geometry fields are loader-mode-invariant, so no separate atlas-less risk (the loader's
   atlas only affects texture binding, not the fields the bake touches).

## 4.2 Coverage Extension (`coverage-42.mjs`) — and why DEMON alone wasn't enough

Ran the oracle + world-AABB fidelity on the heaviest 4.2 rigs. **DEMON 4.3 turned out to have ZERO
deform timelines**, so the deform path was never exercised there (false confidence) — the 4.2 rigs
caught real gaps:

1. **Deform container key.** Deform timelines live at `animations[a].attachments[skin][slot][attachment].deform`
   on **both** 4.2 and 4.3 (NOT `anim.deform`, which I'd assumed). Fixed → 3Queens (tf31/ik12) and
   TEST_01 (tf15/ik8/path14/phys51 — all four types) became **FIELD-IDENTICAL**.
2. **Deform curve is normalized** (0..1 mix, `cscale=1`) → must NOT be scaled (unlike translate curves).
3. **Physics `x`/`y` are NOT scaled** by spine (only `limit` is) — was over-scaling. Fixed.

**Results after fixes:**

| Rig | Constraints | Oracle | Fidelity (world-AABB == s) |
|-----|-------------|--------|-----------------------------|
| TEST_01 (4.2) | tf15 ik8 path14 phys51 | ✅ FIELD-IDENTICAL | 144/144 |
| 3Queens (4.2) | tf31 ik12 | ✅ FIELD-IDENTICAL | (n/a — read-only dir) |
| Girl (4.2) | tf15 ik8 path14 | ⚠ 1 narrow gap | 147/147 |

**The one remaining gap (Girl):** the `IkConstraintTimeline`'s **`softness` curve channel** — softness
is a length (scales ×s) but its bezier curve channel isn't yet scaled (and the paired `mix` channel
must stay unscaled). This is **constraint-timeline curve-channel** handling — finite and known. It does
**NOT** affect world-space fidelity (Girl is 147/147), only strict field-identity between keyframes.

## Signal for the Build

- The bake is ~80 lines + the source-derived rule table. **Watch the scaled-default injection**
  (`limit`, `referenceScale`) — easy to miss.
- Path `position/spacing` are mode-dependent (percent vs length) — handled; verify on a path rig that
  uses length mode (DEMON's pass; add a length-mode path fixture to the build's test matrix).
- `slider` remap slope (`scale / propertyScale`, 4.3) was not exercised by these rigs — cover in the
  build if slider constraints are in scope.
- **Constraint-TIMELINE channels** are the finite remaining work: IK `softness` timeline curve
  channel (scale its cy; leave the `mix` channel), and PATH `position`/`spacing` timeline values+curves
  in length/proportional mode. The setup-side equivalents are done; the timeline-side curve channels
  need the same channel-aware treatment. None affect world-space fidelity.
- Exclude parse-assigned `id`/`hash` from any field-equality check.
- **Keep the oracle as a CI regression test** (`parse(bake(orig,s),1)` ≡ `parse(orig,scale=s)`), run
  across a fixture matrix incl. a deform-heavy rig — DEMON alone gives false confidence (no deform).
