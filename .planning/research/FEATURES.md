# Feature Research

**Domain:** Spine 4.3 skeleton/animation behaviors that affect peak world-space render scale (dual-runtime port, v1.6)
**Researched:** 2026-05-16
**Confidence:** HIGH (verified against `@esotericsoftware/spine-core@4.3.0` and `@esotericsoftware/spine-player@4.3.0` STABLE npm tarballs — compiled `dist/*.js` + `*.d.ts`, the exact artifacts the app will consume)

## Scope Note

This is NOT a market-feature landscape. "Feature" here = **a Spine 4.3 runtime behavior the sampler/bounds layer must handle to keep computing the CORRECT peak world-space render scale** — the app's entire value proposition. Categories are mapped to the GSD template as:

- **Table Stakes** = behaviors the sampler/bounds MUST handle for correct peak scale (a miss here = wrong texture sizing = the product is broken for 4.3 rigs).
- **Differentiators** = behaviors that are nice-to-verify-explicitly but propagate for free (low-cost confidence, not new code).
- **Anti-Features** = 4.3 surface that is explicitly OUT of scope (rendering, authoring, format translation).

Every finding is tagged **geometry-affecting** (changes `computeWorldVertices` output → changes peak scale) or **geometry-invariant** (no effect on world vertices → no effect on peak scale).

---

## Verification Provenance

| Source | What it established | Confidence |
|--------|---------------------|------------|
| `npm view @esotericsoftware/spine-core@latest` → `4.3.0`; `@esotericsoftware/spine-player@latest` → `4.3.0` | 4.3.0 STABLE is published; SEED-006 trigger fired; PORT-04 collapses to an alias bump | HIGH |
| `spine-core@4.3.0` tarball `dist/SkeletonJson.js` (compiled stable) | Unified `root.constraints[]` parse with `type` discriminator; slider parse; IK `scaleY`→`ScaleYMode` enum; NO `root.ik`/`root.transform`/`root.path`/`root.physics` reads anywhere | HIGH |
| `spine-core@4.3.0` `dist/Slider.js` + `Slider.d.ts` + `SliderData.d.ts` + `SliderPose.d.ts` | Slider semantics: applies a whole animation; `update(skeleton, physics)` is a Constraint | HIGH |
| `spine-core@4.3.0` `dist/Skeleton.js` (`updateCache`, `updateWorldTransform`, `setupPose*`) | Slider is sorted into `_updateCache` and driven by `updateWorldTransform` exactly like IK/Transform/Path/Physics | HIGH |
| `spine-core@4.3.0` `dist/Slot.d.ts` + `SlotPose.d.ts` + `Posed.d.ts` | `Slot` has NO `getAttachment()`; binding is `slot.pose.attachment` (the `SlotPose.attachment` property) | HIGH |
| `spine-core@4.3.0` `dist/AnimationState.d.ts` + `SkeletonData.d.ts` | `setAnimation(...)` (no `setAnimationWith`); `skeletonData.version` from `skeleton.spine` | HIGH |
| `spine-core@4.3.0` `dist/attachments/RegionAttachment.d.ts` + `Attachment.d.ts` (VertexAttachment is now in Attachment.d.ts) | The two `computeWorldVertices` signature changes (final stable arg order) | HIGH |
| `spine-runtimes/4.3` CHANGELOG (WebFetch) + esotericsoftware.com/spine-versioning (WebFetch) | Three-stage IK rename history; **major.minor must match between editor export and runtime** (no 4.2↔4.3 cross-load) | HIGH |
| `spine-player@4.3.0` `dist/Player.d.ts` + `package.json` | `SpinePlayerConfig` surface stable vs 4.2; only dep bump is `spine-webgl` 4.2.111→4.3.0 | HIGH |

---

## Feature Landscape

### Table Stakes (Sampler/Bounds MUST Handle for Correct Peak Scale)

| Feature | Why Required (peak-scale impact) | Complexity | Geometry | Notes |
|---------|----------------------------------|------------|----------|-------|
| **Dual-runtime version routing** (4.2 JSON → spine-core@4.2.111; 4.3 JSON → @4.3.0) | 4.3 `SkeletonJson` reads constraints **only** from `root.constraints`; it never reads `root.ik`/`root.transform`/`root.path`/`root.physics`. A 4.2-shaped JSON in the 4.3 runtime **silently loses every constraint** (no throw — keys ignored) → IK/Transform/Path bones don't move → undersized textures. Symmetrically, 4.2 runtime + 4.3 JSON is the existing v1.4 failure. Esoteric is explicit: "The major and minor version … must always match." | HIGH | n/a (routing) | Mandatory, not optional. Confirms locked Design Fact 1. The router is the load-bearing new component. |
| **Detection signal: `skeleton.spine` semver, with `root.constraints` as schema-fallback** | The router must decide 4.2-vs-4.3 BEFORE handing JSON to either runtime. `skeleton.spine` (parsed by 4.3 into `skeletonData.version`) is primary; presence of top-level `constraints[]` array is the unforgeable schema marker (a 4.3 rig mis-stamped `4.2.x` still has `root.constraints`). | LOW | n/a | Reuse the EXISTING `checkSpineVersion` + `checkSpine43Schema` predicates in `src/core/loader.ts` (Phase 32) — **invert** them from rejecters to a 3-way dispatcher (`<4.2` reject / `4.2.x` → 4.2 runtime / `>=4.3` or `constraints[]` present → 4.3 runtime). See "Detection Reconciliation" below. |
| **Slider constraint propagation through `updateWorldTransform`** | `Slider.update(skeleton, physics)` calls `animation.apply(skeleton, p.time, …)` — it applies an **entire target animation** that can contain bone/transform timelines. Before applying it calls `bones[indices[i]].appliedPose.modifyLocal(skeleton)` on every bone the slider's animation touches. If a slider drives a bone that scales/moves an attachment, peak scale changes. **A slider whose target animation has bone timelines is geometry-affecting.** | MEDIUM (validation) | **Geometry-affecting** (when target animation has bone/transform/deform timelines); geometry-invariant only if target animation is pure color/draw-order | **PORT-03 is fixture-only, NOT new sampler code** — see verdict below. |
| **5 sampler API renames** (`setToSetupPose`→`setupPose`; `setSlotsToSetupPose`→`setupPoseSlots`; `state.setAnimationWith(i,anim,loop)`→`state.setAnimation(i,anim,loop)`; `slot.getAttachment()`→`slot.pose.attachment`; lifecycle types thread `Pose`/`Posed`) | The sampler lifecycle (`state.update→state.apply→skeleton.update→skeleton.updateWorldTransform`) is unchanged in shape, but every method name in `core/sampler.ts` differs in 4.3. A wrong/missing call = no animation applied = peak scale collapses to setup-pose values. | MEDIUM | n/a (API shape) | PORT-01. The visibility-pass (`slot.getAttachment() === null` skip at `sampler.ts:609`, and the v1.3 skin-manifest Pass 1.5) MUST switch to `slot.pose.attachment`. `setAnimationWith` does NOT exist in 4.3 — `setAnimation` is overloaded `(i, Animation, loop?)`. |
| **2 `computeWorldVertices` signature changes** in `core/bounds.ts` | Peak scale = max over time of attachment world-vertex AABB. Wrong arg order → garbage world vertices → wrong/zero peak. **4.3.0-stable final shapes:** `RegionAttachment.computeWorldVertices(slot, vertexOffsets, worldVertices, offset, stride)` — `vertexOffsets` is the **2nd** arg (not last); `VertexAttachment.computeWorldVertices(skeleton, slot, start, count, worldVertices, offset, stride)` — `skeleton` is the **1st** arg. | MEDIUM | n/a (API shape) | PORT-02. **Beta-vs-stable drift:** SEED-006 said RegionAttachment adds `vertexOffsets` as the *last* arg — stable puts it **2nd**. SEED-006's "VertexAttachment adds `skeleton` first arg" is correct. Note `VertexAttachment` no longer has its own `.d.ts` — it lives in `attachments/Attachment.d.ts` (consolidated). |
| **IK `scaleYMode` enum (final stable shape, NOT `uniform` bool, NOT `scaleY` number)** | IK with `compress`/`stretch` sets `BonePose.scaleX`; `scaleYMode` controls how `scaleY` co-varies (`None`=unchanged, `Uniform`=×scaleX preserve aspect, `Volume`=÷scaleX preserve area). `Volume`/`Uniform` modes change the bone's world scaleY → change attachment world height → **change peak scale** for any rig whose IK chain stretches/compresses a textured bone. | LOW (handled by runtime) | **Geometry-affecting** (only when IK actually stretches/compresses AND mode≠None) | The 4.3 runtime computes this internally inside `updateWorldTransform`; the app does nothing special — BUT it must NOT assume 4.2 IK semantics. JSON key is still `scaleY` (string enum value), parsed via `Utils.enumValue(ScaleYMode, …)`. See "IK rename — final stable shape". |

### Differentiators (Verify Explicitly, but Propagate For Free)

These cost a fixture/assertion, not new sampler code. They de-risk the "correct peak scale" claim for 4.3 rigs.

| Feature | Value Proposition | Complexity | Geometry | Notes |
|---------|-------------------|------------|----------|-------|
| **Slider fixture** exercising a slider whose target animation scales/moves a textured bone | Proves the free-propagation claim with a regression assertion (`peak(slider-driven) > peak(setup)`), mirroring the Phase 37 InheritTimeline `peak(detached) > peak(baseline)` precedent | LOW | geometry-affecting (by construction of the fixture) | PORT-03. Build a minimal 4.3 rig: slider → animation with a `scale`/`translate` bone timeline on a region-bearing bone. Assert peak strictly exceeds setup-pose peak. |
| **Transform-constraint multi-property mapping fixture** (single source property → multiple typed targets, with `clamp`) | 4.3 transform constraints map one source property to many typed targets (`FromX`→`ToScaleY`, etc.) with `clamp`. The world output is still computed inside `updateWorldTransform` (free), but the JSON shape is entirely new (`properties: { <from>: { offset, to: { <to>: {offset,max,scale} } } }`). A fixture confirms the 4.3 runtime + our sampler produce sane peak scale for the new mapping. | LOW | geometry-affecting (if a target is a scale/translate of a textured bone); free via `updateWorldTransform` | No new sampler code. The SIMPLE_TEST 4.2 fixture has a classic `TransformConstraint`; a 4.3 analog with a typed multi-map is the validation. |
| **Dual CI matrix** (4.2.x + 4.3.x rigs side-by-side, both green) | The 4.2 regression gate (`SIMPLE_TEST.json` stays green) is a locked design fact; a parallel 4.3 fixture proves the router + 4.3 runtime path. | MEDIUM | n/a | Mirrors the Phase 39 "both hosts green" discipline. |
| **spine-player 4.3.0 viewer bump** | Sibling-align the in-app Spine Animation Viewer (v1.5.1) with the ported core. `SpinePlayerConfig` surface (`jsonUrl`/`atlasUrl`/`rawDataURIs`/`alpha`/`backgroundColor`/`showControls`) and the `SpinePlayer(parent, config)` ctor are **API-stable** vs 4.2.111 → drop-in. Only transitive change is `@esotericsoftware/spine-webgl` 4.2.111→4.3.0. | LOW | n/a (rendering) | The viewer's straight-alpha config (`alpha?: boolean`) is unchanged. Regression pass = re-run the Phase 41 basic-render UAT on a 4.3 rig. The viewer embeds its OWN spine-core (via spine-webgl) — independent of the package-aliased `core/` spine-core@4.3.0; no shared-singleton risk. |

### Anti-Features (Explicitly OUT of Scope)

| Feature | Why It Looks In-Scope | Why It's Out | Alternative |
|---------|-----------------------|--------------|-------------|
| **4.3→4.2 schema shim / format translation** | "Just convert `root.constraints[]` back to four arrays so the 4.2 runtime handles everything" | SEED-003 Option B — HIGH trap risk; cannot model `slider` (no 4.2 analog); brittle vs beta drift. Superseded by the real dual-runtime port. PROJECT.md "Out of scope" excludes it. | Dual-runtime routing (route, don't translate). |
| **Rendering / drawing 4.3 skeletons in `core/`** | The runtime ships `SkeletonRendererCore`, clipping, blend modes | The math phase does not decode PNGs or render (CLAUDE.md #4/#5; Layer-3 invariant). Rendering belongs to the spine-player viewer only. | Viewer (spine-player) handles all rendering; `core/` stays render-free. |
| **Authoring / writing 4.3 JSON** | `SkeletonJson` can round-trip | The app reads skeletons and writes images/atlases, never skeleton JSON (locked: JSON invariant under repack). | No change — atlas-repack writes `.atlas`+PNG only. |
| **`.skel` binary 4.3 loader** | `SkeletonBinary.js` ships in the 4.3 tarball | `.skel` deferred since v1.0 (PROJECT.md "Out of scope"). 4.3's binary format also changed; do not expand scope. | JSON-only, both runtimes. |
| **Slider-as-UI-control / interactive slider** | Sliders are an editor authoring feature for interactive rigs | The sampler samples animations deterministically at 120 Hz; it does not expose interactive controls. A slider's effect is captured by sampling its driven animation across time like any other timeline. | Sample normally; the slider's `update()` runs every tick inside `updateWorldTransform`. |
| **Combined-skin / runtime-skin compositing for 4.3** | 4.3 `Skin.constraints` adds skin-scoped constraints | Per-individual-skin sampling is the locked contract (combined-skin out of scope, PROJECT.md Constraints). 4.3's skin-required-constraint gating (`updateCache` line 174-177) is handled by the runtime per-skin already. | Keep per-skin sampling loop; the runtime's `updateCache` re-derives active constraints per `skeleton.skin`. |

---

## Detailed Findings (Source-Backed)

### 1. Unified constraint model — what types exist in 4.3.0 stable

`SkeletonJson.js` (stable) iterates `root.constraints[]` and switches on `getValue(constraintMap, "type", false)`. The **exact** set of `type` discriminators in 4.3.0 stable:

| `type` | Class loaded | Geometry | Semantic change vs 4.2? |
|--------|--------------|----------|--------------------------|
| `"ik"` | `IkConstraintData` | geometry-affecting | Behavior same; `uniform` bool → `scaleYMode` enum (see §3). World-transform output **unchanged for default `None` mode**; `Uniform`/`Volume` modes are new co-scaling options that only differ if authored. |
| `"transform"` | `TransformConstraintData` | geometry-affecting | Single→multi typed-property mapping with `clamp` (see §4). Same world math primitives; richer routing. |
| `"path"` | `PathConstraintData` | geometry-affecting | No semantic change found; same `position/spacing/mixRotate/mixX/mixY`. |
| `"physics"` | `PhysicsConstraintData` | geometry-affecting | Adds `*Global` flags (`inertiaGlobal`, `strengthGlobal`, …) — new options, default `false` = 4.2-equivalent behavior. Core sim unchanged. |
| **`"slider"`** | `SliderData` | **geometry-affecting (driven-animation dependent)** | **NEW — confirmed present in 4.3.0 stable.** No 4.2 analog. See §2. |

**Verdict on "did any 4.2 constraint behavior change semantically (not just JSON shape)?":** No regression for default-authored 4.2-equivalent rigs. The only behavioral *additions* are opt-in (IK `Uniform`/`Volume` co-scale modes, physics `*Global` flags, transform multi-map+clamp). A 4.2 rig re-exported as "Version 4.2" never carries these — and goes through the 4.2 runtime anyway under dual-runtime routing, so the question is moot for the retained path. For native 4.3 rigs, all of these are computed for free inside `updateWorldTransform`.

### 2. Slider constraint — the propagation verdict (PORT-03 driver)

**What it does (from `Slider.js` stable source):**

```
update(skeleton, physics) {
  const p = this.appliedPose;
  if (p.mix === 0) return;
  // optionally derive p.time from a driver bone's transform property
  // then:
  for (each bone the target animation touches) bone.appliedPose.modifyLocal(skeleton);
  animation.apply(skeleton, p.time, p.time, data.loop, null, p.mix, false, data.additive, false, true);
}
```

A Slider **applies an entire target `Animation` to the skeleton at a computed time**, mixed by `p.mix`. If that animation contains bone/transform/deform timelines, **bones move → `computeWorldVertices` output changes → peak scale changes**. So a slider is **geometry-affecting whenever its target animation has geometry timelines** (and geometry-invariant only if the target animation is pure color/draworder — analogous to the RGBA-timeline carve-out).

**Is it free via `updateWorldTransform`? — YES. Source proof:**

1. `Skeleton.updateCache()` (stable, line 168-179) iterates **all** `this.constraints` (the unified list, including sliders) and calls `constraint.sort(this)` for each active one.
2. `Slider.sort()` (stable) does `skeleton._updateCache.push(this)` and registers the bones its animation touches as constrained, so they are re-sorted into the cache **after** the slider.
3. `Skeleton.updateWorldTransform(physics)` (stable, line 219-229) iterates `this._updateCache` and calls `updateable.update(this, physics)` on each entry — invoking `Slider.update(skeleton, physics)` in dependency order, then recomputing downstream bone world transforms.

**This is the IDENTICAL mechanism IK / Transform / Path / Physics use** (all are `Constraint` subclasses sorted into `_updateCache` and driven by `updateWorldTransform`). The existing sampler call `skeleton.updateWorldTransform(Physics.update)` (CLAUDE.md fact #2/#3) propagates slider effects with **zero new apply step**.

> **PORT-03 verdict: FIXTURE-ONLY. No slider-specific apply code in the sampler.** Requirement: a dedicated 4.3 fixture whose slider drives a bone-scaling/translating animation on a region-bearing bone, plus a strict assertion `peak(slider-active) > peak(setup-pose)` (Phase 37 InheritTimeline precedent). The one precondition — the unified constraint list must be loaded — is satisfied automatically by the 4.3 runtime (it always reads `root.constraints`).

**`SliderTimeline` / `SliderMixTimeline` (from `Animation.js` stable):** these are themselves **geometry-invariant** — `SliderTimeline.apply()` writes only `constraint.pose.time`; `SliderMixTimeline.apply()` writes only `constraint.pose.mix`. They are scalar-on-SliderPose writers (exactly like RGBA timelines write only color). The **geometry effect is entirely indirect**, realized when `Slider.update()` consumes `pose.time`/`pose.mix` during `updateWorldTransform`. The sampler must therefore (a) apply these timelines via the normal `state.apply(skeleton)` (free — they are in `animation.timelines`), and (b) call `updateWorldTransform` (already does). Both already happen in the existing lifecycle.

**Slider driver-bone subtlety (for fixture design):** if `SliderData.bone != null`, slider time is derived from a bone's transform property (`data.property.value(...)`) instead of `SliderPose.time`. The fixture should cover the simpler "no driver bone, time set by SliderTimeline" case first (deterministic under the 120 Hz sampler); a driver-bone variant is a stronger but optional second fixture.

### 3. IK `uniform` → `scaleY` → `scaleYMode` — the FINAL stable shape

Three-stage history (CHANGELOG + source confirm):

| Stage | Shape | Notes |
|-------|-------|-------|
| 4.2 | `uniform: boolean` | Old behavior. |
| 4.3.73-beta | `scaleY: number`/enum | SEED-003's documented mid-beta rename. **Stale — do not target this.** |
| **4.3.0 STABLE** | **`scaleYMode` setter/getter + `ScaleYMode` enum** `{ None=0, Uniform=1, Volume=2 }` | Final. `IkConstraintData._scaleYMode`. JSON key is still `"scaleY"` (string enum value), parsed via `Utils.enumValue(ScaleYMode, scaleY)` when present; absent ⇒ default `None`. |

**Does it change IK world-transform output for existing 4.2-shaped IK semantics?** **No.** The default mode is `None` ("scaleY is not changed"), which reproduces 4.2 non-`uniform` behavior. 4.2 `uniform:true` maps to `Uniform`. The world matrix math (two-bone IK solver, compress/stretch) is unchanged; `scaleYMode` only governs whether `scaleY` co-varies when compress/stretch perturb `scaleX`. **Peak-scale impact: only for rigs that (a) have IK with compress/stretch active AND (b) authored `Uniform`/`Volume`.** Computed for free inside `updateWorldTransform`. **Beta-vs-stable drift vs SEED-003/006: SEED docs say "`uniform`→`scaleY` number" — stable is actually `scaleYMode`/`ScaleYMode` enum. Do not write port code against the beta `scaleY` number.**

### 4. Transform constraints — single→multiple typed properties with clamp

Stable `SkeletonJson.js` parses `constraintMap.properties` as a map of `<from-property> → { offset, to: { <to-property>: { offset, max, scale } } }`, building `FromRotate/FromX/FromY/FromScaleX/FromScaleY/FromShearY` → `ToRotate/ToX/ToY/ToScaleX/ToScaleY/ToShearY` chains, plus `data.clamp`, `data.localSource`, `data.localTarget`, `data.additive`. **Peak-scale-relevant world output vs 4.2:** the *primitives* (rotate/translate/scale/shear of a constrained bone) are the same world operations 4.2 had; 4.3 adds richer **routing** (one source property can now drive several typed targets, with clamping). The resulting bone world transform still flows through `updateWorldTransform` → `computeWorldVertices` exactly as before. **No new sampler/bounds code; behavior is free.** Only the JSON shape is new — and only the 4.3 runtime parses it, which it does natively. Validation = a 4.3 transform-constraint fixture (differentiator, not table-stakes code).

### 5. New timeline types in 4.3 beyond Slider*

The only **new** timeline classes that matter are `SliderTimeline` + `SliderMixTimeline` (both geometry-invariant scalar writers; geometry realized indirectly via `Slider.update()` — §2). The constraint timelines were refactored into a `ConstraintTimeline1` family (`IkConstraintTimeline`, `TransformConstraintTimeline`, `PathConstraintPositionTimeline`, …, `PhysicsConstraintTimeline`) but these are **shape refactors of existing 4.2 timeline behaviors**, all driven via the normal `state.apply(skeleton)` + `updateWorldTransform` path the sampler already uses. **No new geometry-affecting timeline type requires sampler changes** — the slider's *constraint* (not its timeline) is the only new geometry pathway, and it is free (§2). The v1.5 Phase 37 coverage discipline (RGBA2/Inherit audited geometry-invariant vs geometry-affecting) should be re-run conceptually for the 4.3 timeline set, but source review found no new geometry-affecting **timeline** beyond the slider-via-constraint indirection.

### 6. Does 4.3 runtime read 4.2 JSON? Detection signal & reconciliation

**Back-compat: NO.** Source-proven: 4.3.0 `SkeletonJson.readSkeletonData` reads only `root.{skeleton,bones,slots,constraints,skins,events,animations}`. It **never** references `root.ik`/`root.transform`/`root.path`/`root.physics`. A 4.2-shaped JSON loads **without error** but with **zero constraints** → IK/Transform/Path/Physics bones stay at setup pose → peak scale undersized → silent wrong output (worse than a throw). Esoteric's official statement (spine-versioning): *"The major and minor version for the Spine editor used to export JSON or binary data must always match the Spine Runtimes version … the Spine Runtimes will not be able to read the data."* This **confirms** locked Design Facts 1 & 2: dual-runtime is mandatory; the 4.2 path must be retained for 4.2 rigs (a 4.3 runtime cannot serve them correctly). The SEED-003 "⚠️ 4.3 runtime + 4.2 JSON — Esoteric claims compat" line is **falsified at the source level** — there is no constraint back-compat; route, don't fall back.

**Precise detection signal in 4.3.0 stable:**
- **Primary:** `skeleton.spine` semver. 4.3 sets `skeletonData.version = skeletonMap.spine`. Parse `major.minor`: `4.2` → 4.2 runtime; `>= 4.3` (or `>= 5`) → 4.3 runtime; `< 4.2` → reject (unchanged Phase 12 contract).
- **Schema fallback (unforgeable):** presence of a top-level `constraints` **array** ⇒ 4.3 schema regardless of a possibly-mis-stamped `skeleton.spine`. This is the exact signal `checkSpine43Schema` already detects. (Inverse risk — a 4.2 rig with NO constraints has no `root.constraints` and a `4.2.x` version, correctly routes to 4.2; a 4.3 rig always has `root.constraints` even if empty per the editor.)

**Reconciliation with existing `src/core/loader.ts` (Phase 32):**

| Predicate (today, v1.4) | Today's behavior | v1.6 dual-runtime change |
|--------------------------|------------------|---------------------------|
| `checkSpineVersion(version, path)` | throws for `< 4.2` AND for `>= 4.3` (strict-cut rejecter) | **Keep the `< 4.2` reject. Remove the `>= 4.3` throw → instead return a routing decision** (`'4.2'` \| `'4.3'`). |
| `checkSpine43Schema(parsed, path)` | throws if top-level `constraints[]` present (rejecter) | **Invert: `constraints[]` present → route to 4.3 runtime** (was: throw `SpineVersionUnsupportedError('4.3-schema')`). |
| `SpineVersionUnsupportedError` "re-export as Version 4.2" copy | shown for any `>= 4.3` | **Now wrong for the supported 4.3 path** — narrow to genuinely-unsupported (`< 4.2`, or `>= 5` / future). PROJECT.md target feature explicitly calls out updating this copy. |

The two predicates are **pure string/object inspection (Layer-3 safe)** and already unit-tested independently — the port reshapes them from boolean throw-guards into a discriminated routing function (`detectRuntime(parsed): '4.2' | '4.3' | reject`). This is the lowest-risk part of PORT-01.

### 7. Sampler-relevant API — FINAL stable names (reconciling SEED-006 beta names)

| Concern | 4.2 (current `core/`) | **4.3.0 STABLE (verified)** | SEED-006 said | Drift? |
|---------|------------------------|------------------------------|----------------|--------|
| Setup-pose (all) | `skeleton.setToSetupPose()` | `skeleton.setupPose()` | `setupPose()` | none ✓ |
| Setup-pose (slots) | `skeleton.setSlotsToSetupPose()` | `skeleton.setupPoseSlots()` | `setupPoseSlots()` | none ✓ |
| Setup-pose (bones) | `skeleton.setBonesToSetupPose()` | `skeleton.setupPoseBones()` | (not listed) | new name to note |
| Set animation by object | `state.setAnimationWith(0, anim, false)` | `state.setAnimation(0, anim, false)` (overloaded; accepts `Animation` or name) | `state.setAnimation(...)` | none ✓ — **`setAnimationWith` does not exist in 4.3** |
| Attachment binding read (visibility pass) | `slot.getAttachment()` | **`slot.pose.attachment`** (`SlotPose.attachment: Attachment \| null`; `Slot` extends `Posed<SlotData,SlotPose>`, no `getAttachment` method) | `slot.pose.attachment` | none ✓ |
| AnimationState lifecycle | `state.update(dt)` / `state.apply(skeleton)` | **identical** (`update(delta)`, `apply(skeleton): boolean`) | "likely-unchanged" | confirmed unchanged ✓ |
| World-transform tick | `skeleton.update(dt)` / `skeleton.updateWorldTransform(Physics.update\|reset\|pose)` | **identical signature**; `Physics` enum unchanged | (implied unchanged) | confirmed unchanged ✓ |
| Bone world matrix read (if bounds touches it) | `bone.a/b/c/d`, `bone.worldX/Y` | now on `bone.appliedPose` (`BonePose.a/b/c/d`, `worldX/worldY`, `getWorldScaleX/Y()`) | "`Pose`/`Posed` thread through" | **note: if `bounds.ts` reads bone world fields directly, add `.appliedPose`** — current `bounds.ts` only calls `attachment.computeWorldVertices(slot,…)` so this is likely not hit, but verify the `MeshAttachment` hull path. |
| Slot color (RGBA invariance, Phase 37) | `slot.color` / `slot.darkColor` | `slot.pose.color` / `slot.pose.darkColor` (on `SlotPose`) | (not listed) | **drift to note** — if any sampler/bounds code reads `slot.color` it must become `slot.pose.color` in 4.3. |

**Net SEED-006 reconciliation:** SEED-006's 5 sampler renames are directionally correct, with these stable corrections: (a) `setAnimationWith`→`setAnimation` is a *removal+overload*, not a rename of a still-existing method; (b) `slot.pose.attachment` confirmed exact; (c) add `setupPoseBones` if used; (d) **NEW finding not in SEED-006**: `slot.color`/`slot.darkColor` → `slot.pose.color`/`slot.pose.darkColor` (Pose API also moved slot color — relevant to Phase 37's RGBA-invariance code if it reads slot color). PORT-02's RegionAttachment `vertexOffsets` is the **2nd** arg, not last (SEED-006 had it last).

---

## Feature Dependencies

```
Dual-runtime version router  (NEW load-bearing component)
    └──requires──> npm package aliasing (spine-core-43 → @esotericsoftware/spine-core@4.3.0)
    └──requires──> inverted checkSpineVersion + checkSpine43Schema → detectRuntime() dispatcher
                       └──gates──> 4.2 path (spine-core@4.2.111, UNCHANGED — regression-locked by SIMPLE_TEST.json)
                       └──gates──> 4.3 path
                                       └──requires──> PORT-01 (5 sampler renames + slot.pose threading)
                                       └──requires──> PORT-02 (2 computeWorldVertices signatures, stable arg order)
                                       └──enables───> PORT-03 (slider fixture — fixture-only, no sampler code)

Runtime-dispatch abstraction (core/, Layer-3 pure)
    └──conflicts──> direct `import { Skeleton } from '@esotericsoftware/spine-core'` (single-import assumption)
        (must become a per-version-resolved module boundary; both runtimes share class NAMES but are
         different module instances → no cross-runtime instanceof; the abstraction must keep each
         runtime's objects within its own runtime's call graph)

spine-player 4.3.0 viewer bump  ──independent──>  core/ spine-core@4.3.0
    (player embeds its own spine-core via spine-webgl@4.3.0; no shared singleton; bump them
     sibling-aligned for consistency, but they are not coupled at runtime)
```

### Dependency Notes

- **Router requires npm aliasing:** both runtimes share package name `@esotericsoftware/spine-core` at different versions. Use a package alias (e.g. `"spine-core-43": "npm:@esotericsoftware/spine-core@4.3.0"`) so `core/` can import both. PORT-04 collapses to this `package.json` edit (4.3.0 is published — confirmed).
- **`instanceof` hazard (NEW, not in SEED-006):** with two spine-core module instances, a `Skeleton`/`RegionAttachment`/`VertexAttachment` from runtime A is **not `instanceof`** the class from runtime B. `core/bounds.ts` branches on `attachment instanceof RegionAttachment` / `instanceof VertexAttachment` / `instanceof MeshAttachment`. The dispatch abstraction MUST resolve each skeleton's attachments against the **same runtime instance** that loaded it (don't import the class from one runtime and test objects produced by the other). This is the single highest-risk correctness pitfall of the dual-runtime shape — flag for PITFALLS.
- **4.2 path is frozen:** locked Design Fact 2. `SIMPLE_TEST.json` (4.2) must stay byte-identical green. The router's `4.2.x` arm calls the unchanged 4.2 code.
- **PORT-03 is fixture-only:** the slider verdict (§2) removes slider apply-step code from scope. PORT-03's cost is one fixture + one strict assertion, not sampler logic.
- **Viewer is decoupled:** spine-player bump is a low-risk sibling alignment, not a dependency of the core port.

## MVP Definition

### Launch With (v1.6)

- [ ] **npm package aliasing** — both spine-core 4.2.111 + 4.3.0 resolvable (PORT-04, ~1 line).
- [ ] **`detectRuntime()` dispatcher** — invert the two existing loader predicates into a 3-way route; update the wrong "re-export as 4.2" copy. (PORT-01 part A; lowest-risk, Layer-3 safe.)
- [ ] **Runtime-dispatch abstraction in `core/`** — per-version module boundary; `instanceof` resolved within the loading runtime. (Layer-3 invariant preserved per locked Design Fact 4.)
- [ ] **PORT-01 sampler renames** behind the 4.3 arm — `setupPose`/`setupPoseSlots`/`setupPoseBones`, `setAnimation`, `slot.pose.attachment`, `slot.pose.color` if touched.
- [ ] **PORT-02 bounds signatures** behind the 4.3 arm — `RegionAttachment.computeWorldVertices(slot, vertexOffsets, wv, off, stride)`; `VertexAttachment.computeWorldVertices(skeleton, slot, start, count, wv, off, stride)`.
- [ ] **4.2 regression gate green** — `SIMPLE_TEST.json` unchanged output (locked).
- [ ] **4.3 slider fixture** — minimal 4.3 rig, slider drives a bone-scaling animation on a region bone, assert `peak(slider) > peak(setup)` (PORT-03, fixture-only).
- [ ] **Dual CI matrix** — 4.2.x + 4.3.x rigs both green.

### Add After Validation (v1.6.x)

- [ ] **spine-player 4.3.0 viewer bump** + Phase 41 basic-render regression on a 4.3 rig (decoupled; can land same milestone or fast-follow).
- [ ] **4.3 transform-constraint multi-map fixture** — confirms the new typed-routing path produces sane peak scale (differentiator confidence).
- [ ] **IK `scaleYMode` Uniform/Volume fixture** — confirms co-scale modes change peak scale as expected (only matters for rigs that author it).

### Future Consideration (post-v1.6)

- [ ] **4.2 deprecation decision** — once dual-runtime is mature, decide whether to drop the 4.2 runtime (PROJECT.md v1.7 candidate). Defer: 4.2-rig users still exist and are protected.
- [ ] **`.skel` binary 4.3 loader** — still deferred (out of scope since v1.0).
- [ ] **Slider driver-bone fixture variant** — bone-property-driven slider time (stronger but not required for the core verdict).

## Feature Prioritization Matrix

| Feature | Correctness Value | Implementation Cost | Priority |
|---------|-------------------|---------------------|----------|
| Dual-runtime router (invert predicates) | HIGH (wrong route = silent wrong sizing) | LOW (predicates exist; pure-TS) | P1 |
| npm aliasing (PORT-04) | HIGH (enables everything) | LOW (1 line) | P1 |
| Runtime-dispatch abstraction + instanceof safety | HIGH (cross-runtime instanceof = silent skip) | MEDIUM | P1 |
| PORT-01 sampler renames | HIGH (wrong API = setup-pose-only peak) | MEDIUM | P1 |
| PORT-02 bounds signatures | HIGH (wrong args = garbage/zero peak) | MEDIUM | P1 |
| 4.2 regression gate | HIGH (locked; protects shipped users) | LOW (reuse SIMPLE_TEST) | P1 |
| PORT-03 slider fixture | HIGH (validates the whole 4.3 value claim) | LOW (fixture-only, no code) | P1 |
| Dual CI matrix | MEDIUM (proves both paths) | MEDIUM | P2 |
| spine-player 4.3.0 bump | MEDIUM (sibling alignment) | LOW (drop-in; API stable) | P2 |
| Transform multi-map fixture | MEDIUM (confidence) | LOW | P2 |
| IK scaleYMode fixture | LOW (rare authored case) | LOW | P3 |

## Sources

- `npm view @esotericsoftware/spine-core@latest` → `4.3.0`; `@esotericsoftware/spine-player@latest` → `4.3.0` (verified 2026-05-16) — HIGH
- `@esotericsoftware/spine-core@4.3.0` npm tarball — compiled `dist/SkeletonJson.js`, `Slider.js`, `Skeleton.js`, `Animation.js`, and `.d.ts` for `Slot`, `SlotPose`, `Posed`, `AnimationState`, `SkeletonData`, `IkConstraintData`, `SliderData`, `SliderPose`, `attachments/RegionAttachment`, `attachments/Attachment` — HIGH (this is the exact artifact the app consumes; STABLE, not beta)
- `@esotericsoftware/spine-player@4.3.0` npm tarball — `dist/Player.d.ts`, `package.json` (dep = `spine-webgl@4.3.0`) — HIGH
- [spine-runtimes `4.3` branch CHANGELOG](https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3/CHANGELOG.md) — three-stage IK rename history (`uniform`→`scaleY`→`scaleYMode`), unified constraint model, slider, Pose API refactor — HIGH
- [Spine Versioning guide](https://en.esotericsoftware.com/spine-versioning) — "major.minor must match between editor export and runtime" → no 4.2↔4.3 cross-load (falsifies SEED-003's "4.3 runtime + 4.2 JSON compat" line) — HIGH
- [spine-editor#891](https://github.com/EsotericSoftware/spine-editor/issues/891) — 4.3→4.2 IK timeline scrambling on downgrade (informs "tell users to re-export as 4.2" caveat — beta-era bug; verify against fixture if surfaced) — MEDIUM
- `.planning/seeds/SEED-006-spine-4.3-runtime-port.md`, `.planning/seeds/SEED-003-spine-4.3-compatibility.md`, `.planning/PROJECT.md`, `CLAUDE.md`, `src/core/loader.ts`, `src/core/sampler.ts`, `src/core/bounds.ts` (in-repo) — HIGH

---
*Feature research for: Spine 4.3 dual-runtime port — peak-render-scale correctness surface*
*Researched: 2026-05-16*
