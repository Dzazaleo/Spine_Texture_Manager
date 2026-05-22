---
id: SEED-010
status: planted
planted: 2026-05-21
planted_during: post-v1.6 (Spine 4.3 Runtime Port / Dual-Runtime — shipped as v1.6.1)
trigger_when: Next milestone planning after v1.6. Gating spike is DONE (Spikes 001–003, all VALIDATED — `.planning/spikes/`): faithful in-app scale-bake is PROVEN feasible on the worst 4.3 rig + 4.2. Safe to plan the milestone.
scope: Large but DE-RISKED (new export mode + first-ever JSON write = a ~80-line JSON bake mirroring spine-core SkeletonJson.scale, with a decisive regression oracle; dual-runtime verified)
---

# SEED-010: Multi-Scale Per-Resolution Variant Exporter

**Source:** `/gsd-explore` session 2026-05-21 (plan file `i-have-an-idea-compressed-popcorn`).

## The idea

The animator exports a rig once at full size. Inside Spine Texture Manager they pick one or
more smaller scales (e.g. `1× → 0.26× / 0.5× / 0.83×`), and the app emits a **complete,
drop-in skeleton package at each scale, into its own folder** — scaled JSON + scaled atlas +
resized PNGs — each sized to the *peak render demand of that smaller rig*.

**Why it's valuable:** deployment target is **per-resolution variants** — one full-size master
fanned out into genuinely-smaller, self-consistent rigs (mobile vs desktop, @1x/@2x). Today the
animator hand-rescales and re-exports from the Spine editor per target, then re-optimizes. This
collapses that into one batch operation on the peak-scale engine the app already has. It is a
natural extension of the core: the app already knows the optimal texture size for the authored
rig; this asks "what's optimal if the rig were smaller?" and packages the answer.

## Locked decisions (from the explore session — do not relitigate)

| Decision | Choice | Notes |
|---|---|---|
| Output per folder | **Scaled JSON (always) + the user's chosen texture output** | Texture output still respects the existing `outputMode` toggle (loose PNGs / atlas / both) — NOT forced to all. The scaled JSON is the one new always-present artifact (capability the app has **never had**). |
| Scale lever | **No bone scale at all — full Spine-style similarity bake** (resolved 2026-05-21) | The bone-scale debate was a red herring. Root scaling is catastrophic (+316…+619%); pivot scaling leaves ±20–50% constraint residual. The faithful answer is a full geometry+timeline+constraint bake replicating `SkeletonJson.scale` (Spine handles the hard 4.3 remap correctly). Variant peak = s × master peak. See ★ BREAKTHROUGH in the gate. |
| How scales are chosen | **Two-way scale-factor ↔ target-dimension** field (enter either, see the other) | e.g. `0.256×` ↔ `512px tall` |
| Dimension basis | **Overall rig bounds** (setup-pose bounding box, shown W×H px) | Anchors the two-way binding |
| Batch vs single | Batch (N scales → N folders) is the goal; one-at-a-time is the MVP fallback | User pre-accepted the fallback |

## Key technical findings (grounded in the codebase, 2026-05-21)

1. **The app never mutates the source JSON — for anything.** Every load builds a *throwaway*
   in-memory skeleton via `load.runtime.makeSkeleton(...)`
   ([runtime-42.ts:194](../../src/core/runtime/runtime-42.ts), [runtime-43.ts:256](../../src/core/runtime/runtime-43.ts)),
   samples it, discards it. "Leave the original intact" is free regardless of approach.

2. **Peak is measured as *bone world scale*, not absolute world size.** Regions read
   `|bone.getWorldScaleX()|`; meshes use a world-area ratio
   ([bounds.ts:140](../../src/core/bounds.ts)). Consequence: Spine's built-in
   `SkeletonJson.scale` (scales *image sizes & positions*, not bone-scale ratios) would move
   **mesh** peaks but **not region** peaks — inconsistent, the **wrong lever**. A uniform scale
   on the **root bone `scaleX/scaleY`** propagates correctly to both → the confirmed right lever.
   See note `peak-is-bone-world-scale-not-absolute-size.md`.

3. **Root-scale-in-place == "insert a rig-parent bone" mathematically** (root at origin), but
   bone insertion is high-friction here (`readonly` bone arrays, `updateCache()` rebuild,
   index-shift, ×2 runtimes). Root-scale is a few lines and reversible (instance is discarded).

4. **NOT the existing per-attachment override.** Current override % + safety buffer
   ([overrides.ts:59](../../src/core/overrides.ts), [export.ts:185](../../src/core/export.ts))
   is a *quality dial at fixed display size* (same full rig, lower-res textures, full JSON).
   This feature is a *display-size dial emitting a self-consistent smaller package*. They
   compose: the override still applies on top of the scaled peak.

5. **Reusable scaffolding for 2 of 3 output artifacts.** Textures: existing export pipeline
   ([image-worker.ts](../../src/main/image-worker.ts), `buildExportPlan`). Atlas: repack path
   ([atlas-writer.ts:84](../../src/main/atlas-writer.ts)) already *writes* a `.atlas` matching
   resized pages. **The only fully-new artifact is the scaled skeleton JSON.**

## The gate (BLOCKING): faithfulness on constrained rigs

**Empirical red flag (user, 2026-05-21):** root-scaling a rig with complex **4.3** constraints sent
a constrained attachment's peak from the expected **~0.1 to ~0.7** (a 7× error). A *tiny* drift is
acceptable; this is not. **No use shipping a variant that animates differently from what the
animator built.** This is the make-or-break question for the whole feature, and it hits exactly the
lever this idea relies on.

**The core tension — measurability vs faithfulness:**
- The app measures peak as **bone world scale** (finding #2). The ONLY lever that moves it is
  **root-bone scale**. But root-scale leaves transform/IK/path constraint **world-length offsets**
  as fixed constants → on a down-scaled rig those offsets are relatively magnified → constraints
  "fight" the shrink → constrained bones don't scale down (the 0.1→0.7 explosion). Same hazard
  family as `project_root_vs_parent_scale_world_constraint_miscalibration`.
- A **true similarity bake** (scale all coords AND offsets by s) animates faithfully — but it
  leaves bone `scaleX/scaleY` unchanged, so the bone-world-scale measurement **can't see it**
  (reads full peak, not s×). Faithful-but-unmeasurable.

**EMPIRICAL RESULTS — DEMON 4.3, all 4 constraint types, 2026-05-21**
(diagnostics: `.planning/debug/_repro_multiscale_pivot.mjs`, `_repro_multiscale_hybrid.mjs`).
Controlled test, net rig scale held equal — only the scale pivot varies:

| Lever | rest of rig (119 attach.) | constraint-driven `R_ARM` |
|---|---|---|
| **Scale root** | faithful | **+316% … +619%** 💥 catastrophic (variant texture *bigger* than the full-size original) |
| **Scale natural pivot bone** (`CTRL_DEMON`) | **115/119 faithful (<2%)** | drifts −23% … +52% (bounded, no catastrophe) |
| **Pivot + naive co-scale of constraint world-offsets** | 113/119 | **WORSE → +331% … +654%** (naive field-scaling backfires) |

Conclusions:
1. **Root scaling is DEAD** — reproduces the user's 0.1→0.7 and is catastrophic. `skeleton.scaleX`
   is applied pre-constraint too → almost certainly the same failure (treat as dead, low priority to
   confirm).
2. **Scaling the rig's natural pivot bone is the viable lever** — no catastrophe; the whole rig is
   faithful EXCEPT constraint-driven attachments, which drift ±20–50% (sometimes undersized = mild
   blur risk). Validates the user's "don't touch root" instinct with data.
3. **The residual is NOT fixable by naive offset-scaling.** The 4.3 transform-constraint
   property-remap (`source` + per-row `offset`/`clamp` + `to[].offset/max`; e.g.
   `R_IK_HEEL-to-R_IK_WRIST` hard-codes world-Y ≈ −4000) resists simple field multiplication — the
   attempt made R_ARM *worse*. Note the SAME `max` key is a world coord in one constraint and a
   `100` percent in another → no blanket rule. Correct handling needs the real spine-core 4.3 remap
   semantics (local-vs-world, meaning of `offset`/`clamp`).
4. **Why it's fundamentally hard:** a constraint bakes absolute world coords for ONE authored scale;
   any rescale moves the source bone relative to those constants. There is NO native Spine
   "post-solve uniform scale" deploy path (`skeleton.scaleX` is pre-constraint), so a fully-faithful
   variant of a constraint-heavy rig requires re-deriving the constraint params — exactly what the
   Spine editor does on export-at-scale.

### ★ BREAKTHROUGH (2026-05-21 — `.planning/debug/_probe_sjscale_constraints.mjs`)

Spine's OWN scaling (`SkeletonJson.scale = s`, the same logic the editor's JSON-export "Scale" field
uses) handles the full rig **including the hard 4.3 transform-constraint remap**, via a precise,
deterministic rule. Verified on `R_IK_HEEL-to-R_IK_WRIST` at s=0.5:

| Field kind | Rule | Example (s=0.5) |
|---|---|---|
| Spatial (positions, lengths, world-space `offset`/`max`) | **× s** | `-4016 → -2008`, `-3866 → -1933` |
| Angles & percentages (rotate offset/max, the `100`s) | **× 1** | `-99` unchanged |
| Remap slope `to[].scale` | **× (s_target / s_source)** | spatial→rotate slope `-0.32 → -0.64` (×1/s) |

The slope cross-term (`×1/s` for spatial→angle) is exactly what the naive offset-only fix missed —
that's why the earlier hybrid exploded. With the full rule, the scaled rig is **mathematically a
uniform similarity of the master → identical behavior, smaller** (meets the user's bar by
construction). This also scales setup pose, all translate/deform timelines, IK softness, path
lengths, physics — the whole schema.

### ★★ PROVEN by spike (2026-05-21 — `.planning/spikes/`, all VALIDATED)

- **001** — a clean, complete, deterministic scaling rule exists across the whole 4.3 schema (0
  unexplained fields of 5946; the only OTHERs were parse-time `id`s).
- **002** — a ~80-line JSON→JSON bake mirroring `SkeletonJson.scale` is **field-identical** to Spine's
  own scaling on **DEMON 4.3** (all constraint types, mesh, physics, slider), **SIMPLE_PROJECT 4.2**,
  and an odd factor (0.26). Found + fixed the one non-obvious rule: **scaled-default injection**
  (`physics.limit`→5000×s, `referenceScale`→100×s when absent).
- **003** — the baked variant is geometrically **exactly s×** for all 119 attachments incl the
  constraint-driven `R_ARM` (world-AABB ×0.500 — the attachment that exploded +300…+600% under
  bone-scaling). Also confirmed the **measurement blind spot**: `peakScale` stays ×1 under the bake.

**Decisive regression oracle for the build:** `parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)`.

### Revised architecture (supersedes the pivot/safety-detector plan)

**Don't scale a bone at all.** Produce the variant via a **full Spine-style similarity bake**:
1. **Sample the master ONCE** (app already does) → `base_peaks`.
2. **variant_peak = s × base_peak** — exact, no re-sampling, no constraint distortion (the bake is a
   proven true similarity, so peaks are exactly linear). Sidesteps the bone-world-scale measurement
   blind spot entirely (we never sample the variant).
3. **Resize textures** to `variant_peak` (reuse existing export pipeline) + **scaled atlas** (reuse
   `atlas-writer`).
4. **Scaled JSON = a JSON→JSON transform replicating `SkeletonJson.scale`'s field rules** (the table
   above) across setup + timelines + all constraint types, for 4.2 AND 4.3. This is the one
   substantial new piece; Spine's open-source `SkeletonJson` is the authoritative spec.

**Decisive validation oracle (sampling-free):** our hand-baked JSON loaded at scale 1 must produce
**field-identical `SkeletonData`** to the original loaded at `SkeletonJson.scale = s`. The per-field
scaling map can even be **auto-derived** by diffing Spine's scale=1 vs scale=s parse (the probe
already does this for one constraint — generalize it).

**Constraint-safety detector → demoted to a defensive backstop** (flag any field the bake doesn't
recognize), no longer the primary answer. We can ship faithful variants, not flags.

**Remaining unknowns for the spike/plan:** completeness of the field map across every 4.2/4.3
construct (sequences, clipping, shear, path percent-vs-length modes, physics); confirm the oracle
holds end-to-end on DEMON + a 4.2 rig + atlas-less; decide build approach (mutate raw JSON dict
guided by the auto-derived map, vs a serializer). Cost is bounded and fully spec'd by Spine source.

## Rough phasing (if it graduates to a milestone)

1. **Sampler root-scale + constraint-offset correction** — `rigScale?: number` on `SamplerOptions`,
   applied to the throwaway root before first `updateWorldTransform`, **plus** the per-constraint-type
   world-length offset co-scaling (the hybrid). This is the heart of the feature *and* its biggest
   risk — gated on the spike. Also a standalone "what-if" peak preview.
2. **Constraint-safety detector** — flag rigs whose constraints can't be proven scale-faithful;
   warn/exclude. May be merged into (1) depending on spike outcome.
3. **Rig-bounds + two-way scale↔dims** — setup-pose bounding box + factor↔dimension binding.
4. **Scaled-JSON writer** — hybrid-corrected JSON (root scale + scaled offsets), dual-runtime,
   dual-mode. Do not start before the spike.
5. **Batch orchestration** — N scales → N folders, reusing export + atlas-write per scale,
   respecting the user's `outputMode` (loose / atlas / both).

Deferred to plan-time: folder naming convention; per-scale override sharing vs independence;
optional runtime-`skeleton.scaleX` "variant note" for engines that scale at load.

## Related

- `project_root_vs_parent_scale_world_constraint_miscalibration` (memory) — prior hard-won proof
  that scale placement vs constraint world-offsets is treacherous; directly informs the gate.
- [[project-multi-scale-peak-bone-world-scale]] (memory)
- SEED-007 (split overrides per loaderMode) — the per-mode export-UX precedent this must respect.
