# Phase 46: Slider Constraint Validation + 4.3 Performance Budget - Research

**Researched:** 2026-05-18
**Domain:** Spine 4.3 `SliderConstraint` runtime semantics + closed-form oracle derivation; wall-time perf-budget gating
**Confidence:** HIGH (closed form derived from the in-repo `@esotericsoftware/spine-core@4.3.0` source — the authoritative runtime, not training data or stale docs)

## Summary

This phase is **two independent soundness proofs**, not a feature. There is **no new `core/` source** in scope — the *absence* of slider-specific sampler code is itself the deliverable (SLIDER-02 SC#2). The four artifacts are: (1) one closed-form vitest test (SLIDER-02), (2) one CI-enabled perf-budget vitest test (PERF-01), (3) `fixtures/SLIDER_4_3/NOTES.txt` (owner-authored, editor-observed), and (4) one owner-export §-spec covering the NOTES.txt action + the (already-done) spineboy version-align acceptance token.

The single highest-value finding: **the committed `fixtures/SLIDER_4_3/SLIDER-01.json` closed form IS hand-derivable from documented Spine 4.3 semantics** — the D-06 escape hatch is **NOT triggered**. The exact formula was read from `node_modules/@esotericsoftware/spine-core/dist/Slider.js:61-62` + `SliderData.js` + `SkeletonJson.js:319-340` + `TransformConstraintData.js:172-177` (the `FromX.value` source). The mechanism resolves to a clean closed form: at the peak frame, **`slider_bone` world scaleX = scaleY = 4.0** (derivation in §"Closed-Form Slider Oracle"). The committed rig's actual mechanism differs materially from both the `42-OWNER-EXPORT-SPEC.md` §3 stale "peak=200" ground truth (correctly declared STALE by D-02) **and** from the CONTEXT.md `<specifics>` narrative (which describes a `slide` animation driving translate-X 0→200 — that animation EXISTS in the rig but is **never driven by the slider**; the slider references the `scale` animation only). The closed form is derived from the JSON as-committed, exactly as D-02 instructs.

PERF-01 is mechanically a clone of `tests/main/sampler-worker-girl.spec.ts` driving `runSamplerJob` on the delivered `fixtures/spineboy_4.3/spineboy-pro.json` (verified token `4.3.01`, 67/52/11/14), but **CI-enabled** (no `it.skipIf(process.env.CI)`) because the rig is redistributable. D-11 is resolved by construction (token verified, no `-beta`). The budget is `measured × margin`; recommended margin **3×** (justified in §"PERF-01 Budget").

**Primary recommendation:** Derive the SLIDER-02 test against the literal **`4.0`** (slider_bone world scaleX/Y at the peak), `toBeCloseTo(4.0, 5)`, with the full §-derivation pasted into a test comment per the `tests/core/overrides.spec.ts` convention. Clone `buildLoad43()` → `buildLoadSlider43()` and `sample()` to drive the unchanged loader→sampler path; the peak appears in `globalPeaks` keyed by the `square` slot/attachment. PERF-01: clone the Girl spec, drop the `skipIf`, set `BUDGET = measured × 3`, log `[PERF-43]`.

## <user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Slider Oracle Basis (SLIDER-01)**
- **D-01:** Keep the committed `fixtures/SLIDER_4_3/SLIDER-01.{json,atlas,png}` (spine `4.3.02`) **as-is**. Do NOT force a re-export to the `42-OWNER-EXPORT-SPEC.md` §3 idealized shape.
- **D-02:** The §3 recorded ground truth (`peak local X = 200`, `x(t)=200·t`, "1:2 linear sliderValue→X") is **declared STALE**. The committed fixture's mechanism: the `drive` slider constraint references the **`scale` animation**, driven by `slider_bone.x` (`local: true`) × `scale: 0.005`; the rig also has a `slide` animation (translate X 0→200) and a `scale` animation (scale 1→4×). The real closed form is whatever documented Spine 4.3 `SliderConstraint` time-mapping semantics yield for *this* rig — derived from the actual JSON, not from §3.
- **D-03:** The owner adds `fixtures/SLIDER_4_3/NOTES.txt` recording the Spine 4.3 editor-observed peak at the peak frame (bone local X and/or world scale, whichever the closed form targets).

**SLIDER-02 Independence Rigor**
- **D-04:** The test's asserted constant is a **hand-derived literal** computed from the SLIDER-01.json keyframes + the documented 4.3 `SliderConstraint` formula, with the **full derivation written in a comment** (matches the codebase golden/closed-form convention; self-contained, CI-runnable without re-reading the editor).
- **D-05:** Independence is **triangulated, not circular**: hand-derived literal == owner's editor-observed `NOTES.txt` value == sampled peak from the unchanged path. Three sources, three implementations (hand-math, Esoteric editor, our runtime-43) — agreement is the proof.
- **D-06:** **Escape hatch (NOT the default):** only if the committed fixture's closed form is genuinely ambiguous / not hand-derivable does the phase escalate to an owner re-export of a §3-style minimal rig. Default is D-01..D-05. **[RESEARCH FINDING: D-06 NOT triggered — the closed form is unambiguously hand-derivable; see §Closed-Form Slider Oracle.]**

**PERF-01 Complex Rig & Budget**
- **D-07:** PERF-01's subject is an owner-authored, redistributable, in-repo complex 4.3 rig. **DELIVERED + VERSION-ALIGNED:** `fixtures/spineboy_4.3/spineboy-pro.{json,atlas,png}` (Spine Boy; 67 bones, 52 slots, 11 anims, 1 skin, 14 constraints, 255 KB JSON). Verified `skeleton.spine` = `4.3.01` (no `-beta`); committable / NOT gitignored → CI-enforceable.
- **D-08:** "Complex" = computationally complex. spineboy-pro's 14 constraints + 67 bones is a strong 4.3 three-pose workout. Lighter than Girl in raw size (255 KB vs 972 KB) — acceptable; the 4.2 606 ms is a reference, not a same-rig requirement. Record as-measured wall-time + ratio-to-606ms; do not inflate the rig.
- **D-11 (RESOLVED — no longer a researcher action):** the original `4.3.75-beta`/`4.3.0`-parser fidelity risk is eliminated by construction. spineboy-pro re-exported at `spine 4.3.01` (verified token, structure byte-equivalent in counts: 67/52/11/14). Researcher need only re-confirm the token in passing; no parse-fidelity investigation, no fallback path. **[RESEARCH FINDING: token re-confirmed = `4.3.01`.]**
- **D-09:** The budget is an absolute-ms ceiling in a vitest perf test, structurally mirroring `tests/main/sampler-worker-girl.spec.ts` (1 discarded warm-up + 1 timed `runSamplerJob`, `console.log` diagnostic, ceiling = measured × margin). Because the rig is redistributable (D-07), the test is **CI-enabled (no `skipIf(CI)`)**. The measured 4.3 wall-time and its ratio to 606 ms are recorded narratively in PROJECT.md at phase close.

**Owner-Export Pipeline**
- **D-10:** The bundled owner-export pass is two small actions: (a) version-align re-export of `spineboy-pro` at the `4.3.0x` editor token (DONE — token verified `4.3.01`; spec records the acceptance token only); (b) `fixtures/SLIDER_4_3/NOTES.txt` (the Spine-4.3-editor-observed slider peak). Researcher/planner authors one precise §-spec covering both, modeled on `42-OWNER-EXPORT-SPEC.md`.

### Claude's Discretion

The researcher/planner has latitude on: exact test file layout/names, the precise margin multiplier for D-09 (justify from measured variance), and the owner-export §-spec wording — provided D-01..D-10 invariants hold. (User explicitly delegated the slider-oracle-basis and SLIDER-02-independence decisions; D-01..D-06 are locked under that delegation.)

### Deferred Ideas (OUT OF SCOPE)

- **Re-exporting SLIDER-01 to the §3-exact idealized shape** — only triggered by D-06's escape hatch (NOT triggered). Not the default; not its own phase.
- **Exposing the slider as a user-facing animator control** — explicitly out of scope per REQUIREMENTS.md ("Slider is sampled for peak-scale only, not exposed as an animator control").
- **A general 4.3 perf regression harness across all 4.3 fixtures** — Phase 46 needs ONE complex rig + ONE budget gate. A broader perf matrix is a future-milestone idea.

</user_constraints>

## <phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SLIDER-01 | A minimal slider rig (a slider drives one bone over a known time window) is committed in-repo from a 4.3 editor export. | **Already satisfied by construction.** `fixtures/SLIDER_4_3/SLIDER-01.{json,atlas,png}` is committed (commit `1ff8107`, Phase 44 Plan 01), token `4.3.02`, routes to runtime-43 via `resolveRuntimeTag` (minor===3 → '4.3'). Phase 46's only SLIDER-01 action is the D-03 `NOTES.txt` addition + the §-spec. The rig itself is authoritative and unchanged (D-01). |
| SLIDER-02 | A closed-form test asserts the sampled peak for the slider rig equals the independently-derived analytical value, confirming slider effect propagates via the existing `updateWorldTransform(Physics.update)` path with no slider-specific sampler code. | Closed form fully derived (§Closed-Form Slider Oracle): peak `slider_bone` world scaleX = scaleY = **4.0**. Test pattern: clone `buildLoad43()`→`buildLoadSlider43()` + `sample()`, assert `globalPeaks` `square` peak `toBeCloseTo(4.0, 5)`. SC#2 (zero slider code) provable by git-diff scope (§Zero-Slider-Code Invariant). |
| PERF-01 | 4.3 sampler wall-time is measured on a complex 4.3 rig against the N2.2 606 ms contract and a 4.3-specific regression budget is recorded (4.3's three-pose model is heavier per tick — parity is not assumed). | Subject delivered + verified (`spineboy-pro.json`, token `4.3.01`, 67/52/11/14). Test pattern: clone `sampler-worker-girl.spec.ts`, drop `skipIf(CI)`, `runSamplerJob({samplingHz:120})`, BUDGET = measured × 3 (§PERF-01 Budget). Narrative ratio-to-606ms in PROJECT.md phase-close. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Slider constraint propagation | `@esotericsoftware/spine-core@4.3.0` (vendored runtime) | `core/runtime/runtime-43.ts` (adapter) | The slider math lives entirely in `Slider.update()` inside spine-core; the adapter only exposes opaque handles + `boneAxisScale`. Our code computes nothing slider-specific (the whole point of SLIDER-02 SC#2). |
| Peak-scale measurement (region attachment) | `core/bounds.ts` `computeRenderScale` → `boneAxisScales` | `core/runtime/runtime-43.ts` `boneAxisScale` | `square` is a RegionAttachment → peak = `|bone.appliedPose.getWorldScaleX/Y()|`. Pure post-constraint read; unchanged by this phase. |
| Sample loop / lifecycle | `core/sampler.ts` `sampleSkeleton` | — | Iterates every animation at 120 Hz with the LOCKED tick order; the slider constraint fires inside `updateWorldTransform('update')`. Unchanged. |
| Version dispatch | `core/loader.ts` `resolveRuntimeTag` | `core/runtime/runtime.ts` `pickRuntime` | `4.3.0x`/`4.3.02` tokens → tag '4.3' → runtime-43. Unchanged; feeding the JSON through the normal loader IS part of the proof. |
| Wall-time measurement | `src/main/sampler-worker.ts` `runSamplerJob` | `core/sampler.ts` | The PERF-01 entrypoint (worker-thread wall-time). Unchanged. |
| Test harness (closed form + budget) | `tests/runtime43/` (SLIDER-02) + `tests/main/` (PERF-01) | `tests/runtime43/baseline-driver.ts` (driver clone) | The ONLY new code in the phase is test code + a driver clone + NOTES.txt + the §-spec. No `core/` source. |

## Closed-Form Slider Oracle (SLIDER-02, D-02 / D-04 / D-05) — THE highest-value finding

> This section is the planner's source for the SLIDER-02 test literal + the comment derivation. Paste the derivation block verbatim into the test comment per the `tests/core/overrides.spec.ts` convention.

### Step 0 — The committed rig as-is (NOT §3, NOT the CONTEXT narrative)

`fixtures/SLIDER_4_3/SLIDER-01.json` (verbatim, the authoritative source per D-01):

```jsonc
"skeleton": { "spine": "4.3.02", "x": -5, "y": -5, "width": 10, "height": 10 }
"bones":  [ { "name": "root" }, { "name": "slider_bone", "parent": "root" } ]
"slots":  [ { "name": "square", "bone": "slider_bone", "attachment": "square" } ]
"constraints": [ {
    "type": "slider", "name": "drive",
    "animation": "scale",            // ← references the `scale` animation (NOT `slide`)
    "bone": "slider_bone",
    "property": "x",                 // ← source = slider_bone LOCAL x (local:true)
    "scale": 0.005, "local": true
    // NO "from", NO "to", NO "offset", NO "loop", NO "mix", NO "additive" keys
} ]
"skins": [ { "name": "default", "attachments": {
    "square": { "square": { "width": 10, "height": 10 } } } } ]   // ← RegionAttachment 10×10
"animations": {
  "scale": { "bones": { "slider_bone": { "scale": [ {}, { "time": 1, "x": 4, "y": 4 } ] } } },
  "slide": { "bones": { "slider_bone": { "translate": [ {}, { "time": 1, "x": 200 } ] } } }
}
```

**Critical correction to the CONTEXT.md `<specifics>` narrative:** the narrative says "the closed form must account for slider-drives-animation-*time* semantics... source bone property × scale → playback time into the referenced animation." That mechanism is correct, but the narrative's framing implies the `slide`→translate-X-0→200 path matters. **It does not.** The slider references the `scale` animation. The `slide` animation exists in the JSON but is **never the slider's target** and is sampled by our sampler only as a *separate independent animation pass* (it just translates the bone; translation does not change region world *scale*, so it does not raise the scaleX/Y peak). The closed form is governed entirely by the `scale` animation + the slider's self-referential X-feedback loop. This is exactly what D-02 means by "derive from the actual JSON, not from §3" — and here, not from the narrative either.

### Step 1 — The exact runtime formula (source-verified, HIGH confidence)

`Slider.update()` — `node_modules/@esotericsoftware/spine-core/dist/Slider.js:51-72` [VERIFIED: in-repo spine-core@4.3.0 source]:

```js
update(skeleton, physics) {
  const p = this.appliedPose;
  if (p.mix === 0) return;                                  // mix default = 1 (see Step 2)
  const data = this.data, animation = data.animation, bone = this.bone;
  if (bone !== null) {
    if (!bone.active) return;
    if (data.local) bone.appliedPose.validateLocalTransform(skeleton);
    p.time = data.offset
      + (data.property.value(skeleton, bone.appliedPose, data.local, Slider.offsets)
         - data.property.offset) * data.scale;              // ← THE mapping formula
    if (data.loop) p.time = animation.duration + (p.time % animation.duration);
    else           p.time = Math.max(0, p.time);            // loop=false → clamp ≥ 0
  }
  // ... apply `scale` animation at p.time onto slider_bone:
  animation.apply(skeleton, p.time, p.time, data.loop, null, p.mix, false, data.additive, false, true);
}
```

`FromX.value()` for `property:"x"` with `local:true` — `TransformConstraintData.js:172-177` [VERIFIED]:

```js
class FromX extends FromProperty {
  value(skeleton, source, local, offsets) {
    return local
      ? source.x + offsets[TransformConstraintData.X]   // local:true → source.x + 0  (offsets all 0)
      : (.../*world path — not taken*/);
  }
}
```

So with `local:true` and the static `Slider.offsets = [0,0,0,0,0,0]`: **`data.property.value(...) = slider_bone.appliedPose.x`** (the bone's *local* X in this tick's applied pose).

### Step 2 — Resolve every parsed default (source-verified)

JSON slider parse — `SkeletonJson.js:319-340` [VERIFIED]:

| Field | Code | Rig has key? | Resolved value |
|-------|------|--------------|----------------|
| `data.additive` | `getValue(constraintMap,"additive",false)` | no | `false` |
| `data.loop` | `getValue(constraintMap,"loop",false)` | no | `false` |
| `data.setupPose.time` | `getValue(constraintMap,"time",0)` | no | `0` |
| `data.setupPose.mix` | `getValue(constraintMap,"mix",1)` | no | **`1`** (so `p.mix===0` guard does NOT early-return) |
| `propertyScale` | `propertyScale("x", this.scale)` → returns `this.scale` | n/a | `this.scale` = `SkeletonJson.scale` default = **`1`** (`SkeletonJson.js:54`) |
| `data.property.offset` | `getValue(constraintMap,"from",0) * propertyScale` | no `from` | `0 * 1 =` **`0`** |
| `data.offset` | `getValue(constraintMap,"to",0)` | no `to` | **`0`** |
| `data.scale` | `getValue(constraintMap,"scale",1) / propertyScale` | `scale:0.005` | `0.005 / 1 =` **`0.005`** |
| `data.local` | `getValue(constraintMap,"local",false)` | `local:true` | `true` |

[VERIFIED: `propertyScale` returns `scale` for `"x"`/`"y"`, else `1` — `SkeletonJson.js:510-516`; `SkeletonJson.scale = 1` default — `SkeletonJson.js:54`]

### Step 3 — Substitute into the formula

```
p.time = data.offset + (FromX.value − data.property.offset) * data.scale
       = 0           + (slider_bone.appliedPose.x − 0)       * 0.005
       = 0.005 * slider_bone.appliedPose.x
then  p.time = Math.max(0, p.time)            // loop=false
```

The slider then applies the **`scale` animation** at `p.time` (seconds) onto `slider_bone`. The `scale` animation timeline is `[ {}, { time:1, x:4, y:4 } ]` — keyframe at t=0 is the implicit identity (`scale x=1,y=1` — empty `{}` = setup), keyframe at t=1.0 s is `scale x=4, y=4`, default **linear** interpolation (no `curve` field → linear; `SkeletonJson.js` only attaches a bezier when `keyMap.curve` is present). `Animation.duration` = highest keyed time = **1.0 s** (in seconds — CLAUDE.md Fact 1; `Animation.js:53` "duration ... in seconds"). [VERIFIED]

So the `scale` animation, evaluated at time `τ` seconds (clamped to [0, duration] since loop=false; `Animation.apply` uses the last frame beyond duration), yields:

```
slider_bone.scaleX(τ) = slider_bone.scaleY(τ) = 1 + 3 * clamp(τ, 0, 1)      // linear 1→4 over 0→1 s
```

### Step 4 — Solve the self-referential feedback fixed point

Here is the subtlety that makes this rig a genuine slider proof: the slider's *source* is `slider_bone.x` (local), and its *target effect* is the `scale` animation applied to `slider_bone`. The `scale` animation keys **only `scale`**, never `translate` — so it does **not** write `slider_bone.x`. Therefore `slider_bone.appliedPose.x` is **not** fed back by the slider itself within a tick. Its only driver across the sample is the *separate* per-animation pass:

- In the **`scale` animation** sample pass: the sampler applies the `scale` animation to `slider_bone` (scale 1→4) via `AnimationState`. The `scale` animation does **not** key translate, so `slider_bone.appliedPose.x` stays at its setup value **`0`** (bones[1] `slider_bone` has no setup `x`, default 0). → `p.time = 0.005 * 0 = 0` → slider applies the `scale` animation at time **0** → contributes `scale = 1` (identity). The *direct* AnimationState application of the `scale` animation (track 0) is what actually scales the bone 1→4 across this pass. The slider here is a **no-op confirmer** (it re-applies `scale` at t=0 = identity, on top of the track-0 application). Peak scaleX/Y in the `scale` pass = **4.0** at t = 1.0 s (from the track-0 `scale` animation).

- In the **`slide` animation** sample pass: the sampler applies the `slide` animation (translate `slider_bone.x` 0→200) via AnimationState track 0. Now `slider_bone.appliedPose.x` ramps 0→200 over 0→1 s. The slider reads it: `p.time = 0.005 * x`. At the end of the pass `x = 200` → `p.time = 0.005 * 200 = 1.0` s → the slider applies the **`scale` animation at time 1.0 s** → `scale = 4.0`. So in the `slide` pass the slider *converts the bone's X translation into a scale via the referenced `scale` animation*. Peak scaleX/Y in the `slide` pass = **4.0** (reached as x→200 ⇒ p.time→1.0 s ⇒ scale→4). The translation itself (x up to 200) does **not** change region *scale* — `computeRenderScale` for a RegionAttachment is `|bone.appliedPose.getWorldScaleX/Y()|`, which is pure scale, translation-invariant.

**Both passes peak at world scaleX = scaleY = 4.0.** `globalPeaks` is the max across *all* animations and skins (`sampler.ts:103` "peak across all animations and skins"), so:

```
╔══════════════════════════════════════════════════════════════════════╗
║  CLOSED-FORM GROUND TRUTH (hand-derived, D-04):                        ║
║                                                                        ║
║    slider_bone has NO parent scale (root is identity).                 ║
║    `square` is a RegionAttachment (10×10) on slider_bone.              ║
║    computeRenderScale(region) = |bone.appliedPose.getWorldScaleX/Y()|. ║
║                                                                        ║
║    Peak slider_bone world scaleX = scaleY                              ║
║      = 1 + 3 * clamp(p.time, 0, 1)  at the peak frame                  ║
║      = 1 + 3 * 1.0                                                      ║
║      = 4.0                                                             ║
║                                                                        ║
║    globalPeaks[`<skin>`/square/square].peakScale  ==  4.0              ║
║    (peakScaleX == peakScaleY == 4.0; peakScale = max(x,y) = 4.0)       ║
╚══════════════════════════════════════════════════════════════════════╝
```

The asserted literal is **`4.0`**. Source area is 10×10 (region); the render-scale is bone-scale-only for regions, so the peak is purely the world scale magnitude `4.0` — independent of the 10×10 region dimensions (those cancel in `boneAxisScales`, which reads bone world scale directly, not an area ratio).

### Step 4-note — Why this is a *genuine* slider proof and not a tautology

A skeptic could ask: "if the `scale` pass peaks at 4.0 purely from the track-0 `scale` animation, does the slider matter?" Yes — the **`slide` pass is the load-bearing slider proof**. In the `slide` pass there is *no scale animation on track 0* (only translate). The bone reaches scale 4.0 **solely because the slider read `slider_bone.x` (→200), mapped it through `p.time = 0.005·x` (→1.0 s), and applied the referenced `scale` animation at that time**. If the slider constraint did NOT propagate through `updateWorldTransform(Physics.update)` (the exact failure mode SLIDER-02 guards against — a 4.3 slider silently doing nothing, the way a 4.2 runtime mis-loading 4.3 yields zero constraints with no error), the `slide` pass would peak at scale **1.0** (no scale animation, just translation), and the test would fail. The closed form `4.0` is therefore a true `peak == analytical-value` assertion, not a self-referential "it runs."

### Step 5 — D-05 triangulation contract (what the owner reads into NOTES.txt)

Three sources MUST agree within tolerance:

1. **Hand-derived literal:** `4.0` (this section).
2. **Editor-observed (`NOTES.txt`, owner action D-03):** the owner opens `SLIDER-01.spine` (or the exported JSON) in the **Spine 4.3 editor**, plays/scrubs the **`slide` animation** to its end frame (t = 1.0 s, where `slider_bone.x` = 200), and reads off **`slider_bone`'s world scaleX and scaleY** at that frame from the editor's transform readout (Esoteric's own reference runtime). Expected: both ≈ **4.0**. The owner records in `fixtures/SLIDER_4_3/NOTES.txt`: the animation name (`slide`), the peak frame/time (t = 1.0 s, frame 30 @ 30 fps editor dopesheet), the source property at peak (`slider_bone` local X = 200), and the observed `slider_bone` world scaleX / scaleY (≈ 4.0). Units: world scale is a dimensionless multiplier.
3. **Sampled `globalPeaks` peak:** from `sample(buildLoadSlider43().load)` — `globalPeaks` entry for the `square` slot/attachment, `.peakScale` (and `.peakScaleX`/`.peakScaleY`).

The SLIDER-02 test asserts (1) ≡ (3) directly in code (`toBeCloseTo(4.0, 5)`). The test ALSO (D-05) reads `fixtures/SLIDER_4_3/NOTES.txt`, parses the owner's recorded peak number, and asserts it equals `4.0` within tolerance — making the triangulation a *machine-checked* three-way agreement, not a prose claim. (Recommended: a tolerant numeric extraction from NOTES.txt — e.g. a regex for the recorded scale value — with a loud failure if NOTES.txt is missing or the number is absent, mirroring the `load43.ts` loud-or-skip contract: a missing NOTES.txt is a verification-integrity failure at Phase 46, NOT a Wave-0 skip, because D-03 commits it as part of this phase.)

### Step 6 — Tolerance

The codebase closed-form convention is `expect(x).toBeCloseTo(literal, 5)` (5 decimal places ≈ ±5e-6) — verified across `tests/core/overrides.spec.ts:111-231` (12 assertions all at precision `5`). The cross-runtime geometry tolerance (`runtime43-*.spec.ts`) is `1e-4`. **Recommendation:** assert the hand-derived literal with `toBeCloseTo(4.0, 5)` (the closed form is exact arithmetic — `1 + 3*1 = 4` — so the float result should be `4.0` to full double precision; precision 5 is the established convention and is comfortably loose enough for the linear interpolation + the 120 Hz frame-grid landing exactly on t = 1.0 s). For the NOTES.txt triangulation arm, use a looser `1e-2` (editor readouts are display-rounded) — i.e. `Math.abs(notesValue - 4.0) < 1e-2`.

### D-06 escape-hatch determination

**D-06 is NOT triggered.** The closed form is unambiguous and hand-derivable from documented Spine 4.3 `SliderConstraint` semantics (source-verified formula in Step 1, every default resolved in Step 2, every arithmetic step shown in Steps 3-4). The default path (D-01..D-05) holds. No owner re-export of a §3-style rig is needed; the committed rig stays as-is per D-01.

## Standard Stack

No new libraries. This phase consumes the already-pinned, already-installed stack.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-core` | `4.3.0` | Owns ALL slider math (`Slider`/`SliderData`/`SliderPose`); the closed-form ground truth was read from its source | Canonical 4.3 runtime (RT-01); the proof is that *its* unchanged path carries the slider [VERIFIED: package.json + node_modules] |
| `spine-core-42` (alias) | `@esotericsoftware/spine-core@4.2.111` | Side-by-side 4.2 runtime (irrelevant to this phase — slider is 4.3-only) | Dual-runtime invariant [VERIFIED: package.json] |
| `vitest` | `^4.0.0` | Test runner for both the closed-form and perf gates | Established project test framework [VERIFIED: package.json] |

### Supporting (in-repo, reused — NOT new code)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `tests/runtime43/baseline-driver.ts` `buildLoad43` / `sample` | The clone target for the SLIDER-02 driver | Clone `buildLoad43()`→`buildLoadSlider43()` (point at `fixtures/SLIDER_4_3/SLIDER-01.*`); reuse `sample()` verbatim |
| `tests/runtime43/load43.ts` (`tryLoad43`) | Loud-or-skip presence contract (ENOENT → Wave-0 skip; broken pickRuntime → PROPAGATE) | The slider driver clone copies this contract for `fixtures/SLIDER_4_3/` |
| `tests/runtime43/slider43-smoke.spec.ts` | Existing `RIG_DIR` directory-scan + `pickRuntime('4.3')` resolution pattern | Reuse its filename-resolution shape; extend past load into sample + peak assertion |
| `tests/main/sampler-worker-girl.spec.ts` | The structural analog for the PERF-01 gate | Clone verbatim, drop `it.skipIf(process.env.CI)`, repoint path, set new BUDGET, change log tag to `[PERF-43]` |
| `src/main/sampler-worker.ts` (`runSamplerJob`) | Wall-time measurement entrypoint | PERF-01 drives this directly (worker-thread sampler path) |

**Installation:** None. `npm ci` from the committed lockfile already provides everything.

**Version verification:**
```
@esotericsoftware/spine-core  → 4.3.0   [VERIFIED: node_modules/@esotericsoftware/spine-core/package.json:3]
spineboy-pro.json skeleton.spine → 4.3.01  [VERIFIED: python3 json read, 2026-05-18]
SLIDER-01.json skeleton.spine    → 4.3.02  [VERIFIED: Read, 2026-05-18]
```

## Architecture Patterns

### System Architecture Diagram

```
SLIDER-02 (closed-form proof)
─────────────────────────────
 fixtures/SLIDER_4_3/SLIDER-01.json  (committed, token 4.3.02, UNCHANGED — D-01)
        │
        ▼
 buildLoadSlider43()  ── clone of buildLoad43() ──┐
   • tryLoad43-style ENOENT loud-or-skip          │  reads SLIDER-01.{json,atlas}
   • pickRuntime('4.3')  ◄── proves dispatch       │  (filename via dir scan)
   • rt.makeAtlas / rt.parseSkeleton / rt.applyRotatedRegionFix
        │
        ▼  LoadResult{ runtime, skeletonData, sourceDims, editorFps }
 sample(load) = sampleSkeleton(load)   [core/sampler.ts — UNCHANGED]
   per animation (`scale`, `slide`):
     setupPose → setAnimation → updateWorldTransform('reset')
     for t in [0 .. duration] step 1/120:
       stateUpdate → stateApply → skeletonUpdate
       → updateWorldTransform('update')   ◄══ Slider.update() fires HERE
                                              p.time = 0.005 · slider_bone.x
                                              applies `scale` anim @ p.time
       → snapshotFrame → computeRenderScale(region)=|bone.appliedPose.WorldScaleX/Y|
        │
        ▼
 SamplerOutput.globalPeaks[<skin>/square/square].peakScale
        │
        ▼
 expect(peak).toBeCloseTo(4.0, 5)            ◄── hand-derived literal (D-04)
 expect(parseNotesTxt()).toBeCloseTo(4.0, ~1e-2) ◄── editor triangulation (D-05)

PERF-01 (wall-time budget)
──────────────────────────
 fixtures/spineboy_4.3/spineboy-pro.json  (committed, token 4.3.01, 67/52/11/14)
        │
        ▼
 runSamplerJob({ skeletonPath, samplingHz:120, onProgress, isCancelled })
   [src/main/sampler-worker.ts — drives core/sampler.ts via worker path]
        │
   warm-up run (discarded)  →  timed run  →  elapsed ms
        │
        ▼
 expect(elapsed).toBeLessThan(measured × 3)   ◄── absolute-ms ceiling (D-09)
 console.log('[PERF-43] spineboy-pro 4.3: N ms (M× the 4.2 606 ms ref)')
 [CI-ENABLED — NO it.skipIf(process.env.CI); rig is redistributable, D-07]
```

### Recommended Test File Layout (Claude's discretion — D-09/SLIDER-02 latitude)

```
tests/
├── runtime43/
│   ├── baseline-driver.ts          # ADD buildLoadSlider43() (clone of buildLoad43)
│   └── slider43-closedform.spec.ts # NEW — SLIDER-02 closed-form + NOTES.txt triangulation
└── main/
    └── sampler-worker-spineboy43.spec.ts  # NEW — PERF-01 (clone of -girl.spec.ts, CI-enabled)
fixtures/SLIDER_4_3/NOTES.txt        # NEW — owner-authored (D-03), §-spec'd
.planning/phases/46-.../46-OWNER-EXPORT-SPEC.md  # NEW — §-spec (D-10), modeled on 42-OWNER-EXPORT-SPEC.md
```

(Keep `slider43-smoke.spec.ts` as-is — it is the Phase-44 load-no-throw layer; the new closed-form spec is the *separate* layer it deliberately deferred. Do not modify the smoke.)

### Pattern 1: Clone `buildLoad43()` for the slider driver
**What:** Add `buildLoadSlider43()` to `baseline-driver.ts` — a faithful `buildLoad43()` clone pointing at `fixtures/SLIDER_4_3/SLIDER-01.*` with directory-scan filename resolution and the `load43.ts` loud-or-skip contract.
**When to use:** SLIDER-02 test setup.
**Example:**
```ts
// Source: tests/runtime43/baseline-driver.ts:128-157 (buildLoad43) — clone, repoint to SLIDER_4_3
export function buildLoadSlider43(): { load: LoadResult; rt: SpineRuntime } | null {
  // resolve SLIDER-01.json/.atlas by dir scan (filenames are owner discretion;
  // only the SLIDER_4_3/ dir name is locked) — same pattern as slider43-smoke.ts:42-71
  // ENOENT → null (Wave-0 skip); broken pickRuntime('4.3') → PROPAGATE (integrity)
  const rt = pickRuntime('4.3');
  const atlas = rt.makeAtlas(atlasText);
  const skeletonData = rt.parseSkeleton(json, atlas, /*atlasLess*/ false);
  rt.applyRotatedRegionFix(skeletonData);
  const sourceDims = buildSourceDims(atlasText);  // reuse the helper
  const load: LoadResult = { /* same minimal shape as buildLoad43; editorFps:30 */ };
  return { load, rt };
}
```

### Pattern 2: Closed-form assertion + NOTES.txt triangulation
**What:** Sample, pull the `square` peak from `globalPeaks`, assert against the hand-derived literal, then assert the parsed NOTES.txt value agrees.
**Example:**
```ts
// Source: tests/core/overrides.spec.ts:111 (toBeCloseTo,5 convention)
//       + tests/runtime43/runtime43-d03.spec.ts:32-48 (buildLoad43 + sample + globalPeaks pull)
const built = buildLoadSlider43();
if (built == null) { expect(true).toBe(true); return; }   // legit Wave-0 ENOENT only
const out = sample(built.load);
const rec = [...out.globalPeaks.values()].find(r => r.attachmentName === 'square');
expect(rec, 'square must appear in SLIDER_4_3 globalPeaks').toBeDefined();
// Hand-derived: p.time = 0.005 * slider_bone.x ; `scale` anim 1→4 linear over 0→1s
//   `slide` pass: x→200 ⇒ p.time→1.0s ⇒ scaleX=scaleY = 1 + 3*1 = 4.0  (full derivation in header)
expect(rec!.peakScale).toBeCloseTo(4.0, 5);
expect(rec!.peakScaleX).toBeCloseTo(4.0, 5);
expect(rec!.peakScaleY).toBeCloseTo(4.0, 5);
// D-05 triangulation: editor-observed value in NOTES.txt must agree
const notesPeak = parseNotesScale(readFileSync(NOTES_TXT, 'utf8')); // loud if missing (NOT Wave-0 — D-03 commits it)
expect(Math.abs(notesPeak - 4.0)).toBeLessThan(1e-2);
```

### Pattern 3: CI-enabled perf gate (the ONE deviation from the Girl analog)
**What:** Verbatim clone of `sampler-worker-girl.spec.ts` with `it.skipIf(process.env.CI)` removed.
**Example:**
```ts
// Source: tests/main/sampler-worker-girl.spec.ts:27-62 — DROP the .skipIf wrapper
it(  // ← plain it(...), NOT it.skipIf(process.env.CI)(...)  — D-07 rig is redistributable
  'fixtures/spineboy_4.3/spineboy-pro.json samples in <BUDGET ms with 1 warm-up discarded',
  async () => {
    const warm = await runSamplerJob({ skeletonPath: SPINEBOY, samplingHz:120, onProgress(){}, isCancelled:()=>false });
    expect(warm.type).toBe('complete');
    const t0 = performance.now();
    const r = await runSamplerJob({ skeletonPath: SPINEBOY, samplingHz:120, onProgress(){}, isCancelled:()=>false });
    const ms = performance.now() - t0;
    expect(r.type).toBe('complete');
    expect(ms, `spineboy-pro 4.3 took ${ms.toFixed(0)} ms (budget = measured×3)`).toBeLessThan(BUDGET);
    console.log(`[PERF-43] spineboy-pro 4.3: ${ms.toFixed(0)} ms (${(ms/606).toFixed(2)}× the 4.2 Girl 606 ms ref)`);
  },
  30_000,  // same 30 s safety net
);
```

### Anti-Patterns to Avoid
- **Deriving the closed form from `42-OWNER-EXPORT-SPEC.md` §3 or the CONTEXT `<specifics>` narrative:** §3's `peak=200` is STALE (D-02); the narrative's `slide`-translate framing is a red herring (the slider references `scale`, not `slide`). Derive ONLY from the committed JSON + the source formula. (This research did exactly that.)
- **Adding any slider-specific code to `core/`:** SLIDER-02 SC#2 is that NONE is needed. The proof is the closed-form test passing against an unchanged `core/`. Any `slider`/`Slider` symbol added to `src/core/` would invert the proof.
- **Keeping `it.skipIf(process.env.CI)` on the PERF-01 test:** the whole point of D-07/D-09 (vs the Girl gate) is that this rig IS redistributable, so CI must run it. Copying the skip would silently weaken the gate to the exact thing it improves on.
- **Forcing `pickRuntime('4.3')` explicitly in SLIDER-02 instead of letting the loader dispatch:** feeding the JSON through the normal loader/`resolveRuntimeTag` IS part of the proof that dispatch + the unchanged path carries the slider. (The `buildLoad43` clone already uses `pickRuntime('4.3')` directly, which is the established baseline-driver pattern — acceptable because the smoke + ORCL-02 already prove `4.3.0x`-token dispatch; the closed-form test's job is the *peak math*, not re-proving dispatch. Do NOT additionally hand-tune the runtime.)
- **Tightening the perf BUDGET to a hand-picked round number below `measured × margin`:** D-09 says ceiling = measured × margin. A too-tight ceiling makes the gate flaky on slower CI runners (the exact failure the Girl gate's `skipIf` was avoiding — here we can't skip, so the margin must absorb CI variance).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slider time-mapping math | A reimplementation of `p.time = offset + (prop − from)·scale` in `core/` | The unchanged spine-core `Slider.update()` | The entire SLIDER-02 thesis (SC#2) is that NO slider code is needed; reimplementing it would *disprove* the requirement and add a divergence surface |
| Fixture load + sample harness | A bespoke skeleton loader for the slider rig | Clone `buildLoad43()` + reuse `sample()` | The driver + loud-or-skip contract are battle-tested across 5 runtime43 spec files; a fresh loader risks the green-washing failure modes `load43.ts` already solved |
| Perf measurement scaffold | A new timing harness | Clone `sampler-worker-girl.spec.ts` | Warm-up-discard + timed-run + 30 s safety-net + diagnostic-log shape is already validated (Phase 9 N2.2) |
| Wall-time entrypoint | Driving `sampleSkeleton` directly with a hand-built LoadResult for PERF-01 | `runSamplerJob` (the worker entrypoint) | PERF-01's contract is *worker-thread* wall-time (the real user path); the Girl analog uses `runSamplerJob` for exactly this reason |

**Key insight:** This phase's correctness comes from changing **nothing** in `core/`. Every line of new code is a *test* or a *driver clone* or *owner-authored fixture metadata*. The hardest part (the closed form) is pure arithmetic over source-verified constants — already done in this document.

## Runtime State Inventory

Not applicable — this is a greenfield-test phase (new test files + a NOTES.txt + a §-spec). No rename/refactor/migration; no stored data, live-service config, OS-registered state, secrets, or build artifacts are touched. The committed fixtures already exist (Phase 44 Plan 01) and are explicitly unchanged (D-01). **None — verified by scope analysis (no `core/`/`src/` source edits; only `tests/`, `fixtures/SLIDER_4_3/NOTES.txt`, and `.planning/` additions).**

## Common Pitfalls

### Pitfall 1: Deriving the closed form from the wrong rig description
**What goes wrong:** Using §3's `peak=200`/`x(t)=200·t` (STALE per D-02) or the CONTEXT `<specifics>` narrative's "slide animation translates X 0→200" framing as if the slider drives translation.
**Why it happens:** Two upstream documents (§3 + the CONTEXT narrative) describe a *different* mechanism than the committed JSON. §3 predates the actual export; the narrative correctly notes the slider-drives-animation-*time* semantic but its mention of the `slide` animation obscures that the slider references `scale`, not `slide`.
**How to avoid:** Derive ONLY from `fixtures/SLIDER_4_3/SLIDER-01.json` as-committed + the source formula. The slider's `"animation": "scale"` field is dispositive. This research did this; the literal is `4.0`, not `200`.
**Warning signs:** A planned test asserting `≈200`, or any reference to `x(t)=200·t` as the ground truth, or treating the `slide` animation as the slider's target.

### Pitfall 2: Treating a missing NOTES.txt as a Wave-0 skip
**What goes wrong:** The SLIDER-02 test silently passes (or skips) when `fixtures/SLIDER_4_3/NOTES.txt` is absent, green-washing the D-05 triangulation.
**Why it happens:** The `load43.ts` loud-or-skip pattern treats ENOENT as a legit Wave-0 skip for *the rig* (Plan-05-owned in Phase 44). But NOTES.txt is committed *by Phase 46 itself* (D-03), so its absence is a verification-integrity failure, NOT a Wave-0 skip.
**How to avoid:** In the SLIDER-02 test, a missing/empty NOTES.txt (or one with no parseable scale number) must **throw/fail loudly**, not skip — distinct from the rig-ENOENT Wave-0 arm. Mirror the explicit comment style in `slider43-smoke.spec.ts:78-84` ("a null here is a verification-integrity failure, not a Wave-0 skip").
**Warning signs:** The test passing in a tree where `fixtures/SLIDER_4_3/NOTES.txt` does not exist.

### Pitfall 3: Perf BUDGET flakiness on CI (no skip escape)
**What goes wrong:** The CI-enabled PERF-01 test fails intermittently on slower/loaded CI runners.
**Why it happens:** Unlike the Girl gate (which can `skipIf(CI)`), PERF-01 MUST run on CI (D-07/D-09). CI runners have higher run-to-run variance than the dev machine where `measured` is captured.
**How to avoid:** Set BUDGET = measured × **3** (see §PERF-01 Budget for the variance justification from the Girl analog). Capture `measured` on a warmed run locally; document the measured value + the chosen margin in the test comment and PROJECT.md. The 30 s vitest safety-net timeout stays (warm-up + timed run).
**Warning signs:** `[PERF-43]` log values within ~1.5× of BUDGET on CI; any red on a green-source commit.

### Pitfall 4: Sampling rate missing the peak
**What goes wrong:** The 120 Hz sample grid never lands on the exact frame where the slider-driven scale peaks.
**Why it happens (and why it does NOT here):** The peak occurs at the animation's terminal frame (t = 1.0 s, where `slide` reaches x=200 ⇒ p.time=1.0 s ⇒ scale=4). The sampler loop is `for (t = 0; t <= duration + 1e-9; t += dt)` (`sampler.ts:322`) — the `+ 1e-9` epsilon **explicitly catches the terminal-frame peak**, and 1.0 s is an exact multiple of dt=1/120 s (120 steps land exactly on t=1.0). The `scale` ramp is linear and monotonic 1→4, so its max is strictly at the endpoint. **No higher sampling rate is needed; 120 Hz (CLAUDE.md Fact 6) catches this peak exactly.** Justification: the slider mechanism here produces a *monotone* scale ramp with the peak at the keyed terminal frame, which the loop's terminal-epsilon is designed for — there is no sub-frame easing overshoot (no `curve` in the `scale` keyframes → linear). If a future slider rig used a bezier curve with overshoot, 120 Hz would still be the project default and the terminal-epsilon plus dense grid catches monotone and mildly-curved peaks; this rig is the simplest (linear) case.
**Warning signs:** A sampled peak slightly below 4.0 (would indicate the grid missed t=1.0 — not expected here, but the test's `toBeCloseTo(...,5)` would catch a gross miss).

## Code Examples

All patterns are in §"Architecture Patterns" (Patterns 1-3) with verified source citations. Key source-of-truth excerpts:

### The slider formula (the entire closed-form basis)
```js
// Source: node_modules/@esotericsoftware/spine-core/dist/Slider.js:61-62  [VERIFIED in-repo]
p.time = data.offset
  + (data.property.value(skeleton, bone.appliedPose, data.local, Slider.offsets) - data.property.offset) * data.scale;
// For SLIDER-01: offset=0, FromX.value(local)=slider_bone.x, property.offset=0, scale=0.005
//   ⇒ p.time = 0.005 * slider_bone.x   (then Math.max(0, p.time) since loop=false)
```

### The peak the test reads (region → bone world scale)
```ts
// Source: src/core/bounds.ts:148-151 (region → boneAxisScales) + :400-407
//         + src/core/runtime/runtime-43.ts:448-486 (boneAxisScale reads bone.appliedPose.getWorldScaleX/Y)
if (kind === 'region') return boneAxisScales(rt, slot);   // |bone.appliedPose.getWorldScaleX/Y()|
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| §3 idealized SLIDER rig (`peak=200`, direct 1:2 sliderValue→X map) | Committed real 4.3 rig: slider→`scale`-animation via `p.time=0.005·x`; closed form = world scale **4.0** | Phase 44 Plan 01 export (commit `1ff8107`); formalized D-02 in Phase 46 CONTEXT (2026-05-18) | The Phase-46 test asserts `4.0`, not `200`. §3 ground truth is dead. |
| Slider validation deferred (Phase 44 smoke = load-no-throw only) | Phase 46 adds the closed-form peak layer (SLIDER-02) the smoke deliberately omitted | Phase 44 CONTEXT D-02 deferred it; Phase 46 implements it | `slider43-smoke.spec.ts` stays; `slider43-closedform.spec.ts` is the new layer. |
| Perf gate local-only (`it.skipIf(process.env.CI)` — Girl rig gitignored) | CI-enabled perf gate (spineboy-pro is redistributable) | Phase 46 D-07/D-09 | Strictly stronger than the Girl N2.2 gate; runs on every CI matrix job. |
| `4.3.75-beta` perf rig (parser-fidelity risk) | `4.3.01` version-aligned rig (same proven `4.3.0x` parse path as Phase-44 ORCL-02 fixtures) | Owner re-export 2026-05-18 (D-11 resolved by construction) | No false-green-budget risk; token verified `4.3.01`. |

**Deprecated/outdated:**
- `42-OWNER-EXPORT-SPEC.md` §3 "Resulting closed-form ground truth ... peak ... +200 at t=1.0s": **STALE** (D-02). Read §3 ONLY for the historical never-run NOTES.txt fallback-clause intent. Phase 46 executes that fallback clause via D-03.
- The CONTEXT.md `<specifics>` framing implying the `slide` (translate 0→200) animation is the slider's mechanism: **misleading**. The slider references the `scale` animation; `slide` is a separate independent animation pass. The closed form is governed by the `scale` animation + the slider X-feedback (final value still `4.0`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Animation.apply` for the `scale` timeline beyond `duration` (loop=false) uses the last keyed frame (scale=4), so `p.time` clamped at/above 1.0 s yields scale 4.0 (not 1.0 or wrap). | Closed-Form Step 4 | LOW — `Slider.update` does `Math.max(0,p.time)` (no upper clamp) for loop=false; `Animation.apply` with `loop=false` uses last frame for time≥duration (standard spine-ts contract, `Animation.js:100` "the last frame is used"). If the editor's slider applied differently, the sampled value would diverge from 4.0 and the test would fail loudly — surfacing the discrepancy rather than green-washing. The D-05 NOTES.txt triangulation is the independent cross-check that catches any such misread. |
| A2 | The 120 Hz grid lands exactly on t=1.0 s (1.0 / (1/120) = 120 integer steps) so the terminal peak is sampled exactly. | Pitfall 4 | LOW — arithmetically exact (120 is integral); plus the loop's `+1e-9` terminal epsilon (`sampler.ts:322`) independently guarantees the terminal frame is evaluated. |
| A3 | spineboy-pro's measured wall-time will be in the same order of magnitude as Girl's 606 ms (4.3 three-pose model heavier per tick, but spineboy-pro is ~3.8× smaller JSON than Girl). | PERF-01 Budget | MEDIUM — the *actual* measured value is captured at plan/execute time, not assumed; the budget is `measured × 3` regardless of the absolute value, so this assumption only affects the *narrative* ratio-to-606ms (D-08 explicitly says record as-measured, no inflation). Not a correctness risk. |
| A4 | The editor-observed `slider_bone` world scaleX/Y at the `slide` animation's end frame ≈ 4.0 (Esoteric's reference runtime computes the same slider→scale mapping). | Closed-Form Step 5 (D-05) | LOW — this is the *whole point* of triangulation: if the editor disagrees with hand-math, that is a real finding D-05 is designed to surface, not a research error. The owner reads the actual editor value into NOTES.txt; the test asserts agreement. |

## Open Questions (RESOLVED)

1. **Does the `slide` animation's translation (x up to 200) ever inflate the world AABB enough to matter for `globalPeaks`?**
   - What we know: `globalPeaks` peak for a RegionAttachment is `computeRenderScale` = bone world scaleX/Y (translation-invariant). Translation moves the AABB but does not change render *scale*. So the slider-driven scale (→4.0) is the peak, not the translation.
   - What's unclear: nothing material — `computeRenderScale` for `kind==='region'` is unambiguously `boneAxisScales` (bounds.ts:149-151), no AABB-size term.
   - Recommendation: assert `peakScale`/`peakScaleX`/`peakScaleY` (all 4.0); do NOT assert any AABB/position quantity.
   - **RESOLVED:** Nothing material — the region peak IS the bone world scale, not an AABB/position term. `computeRenderScale` for `kind==='region'` is unambiguously `boneAxisScales` (`bounds.ts:149-151`, cited above), with no AABB-size or translation term; the `slide` x→200 translation is therefore scale-invariant and cannot inflate the peak. The SLIDER-02 closed-form test (46-01 Task 3) accordingly asserts `peakScale`/`peakScaleX`/`peakScaleY` (all `toBeCloseTo(4.0, 5)`), never any bone position or AABB quantity — matching this recommendation exactly. No open planning decision.

2. **Exact `measured` value for the PERF-01 budget.**
   - What we know: the test must capture it at plan/execute time (a warmed `runSamplerJob` on spineboy-pro); BUDGET = measured × 3.
   - What's unclear: the absolute ms (depends on the run machine).
   - Recommendation: the plan's first PERF-01 task captures `measured` (run the warmed sample once, read the `[PERF-43]` value), then hardcodes `BUDGET = Math.ceil(measured * 3)` with a comment recording the captured value, date, and machine. Record measured + ratio-to-606ms in PROJECT.md at phase close (D-08/D-09).
   - **RESOLVED (by design — D-09):** The exact `measured` ms is intentionally NOT a plan-time literal — it is machine-dependent and is captured at *execute* time by the 46-02 Task 1 Step 1 warmed `runSamplerJob` throwaway script (one discarded warm-up + one timed run on `fixtures/spineboy_4.3/spineboy-pro.json`), after which `BUDGET = ⌈measured × 3⌉` (`Math.ceil(measured * 3)`) is hardcoded as an integer literal with the captured `measured` ms + date + machine recorded in-comment. This is the locked D-09 contract ("ceiling = measured × margin"; CONTEXT.md D-09), fully encoded in 46-02 Task 1 — NOT an open planning gap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-core` | Slider math + sampler | ✓ | 4.3.0 | — |
| `vitest` | Both test gates | ✓ | ^4.0.0 | — |
| `fixtures/SLIDER_4_3/SLIDER-01.{json,atlas,png}` | SLIDER-02 | ✓ | token 4.3.02, committed `1ff8107` | — |
| `fixtures/spineboy_4.3/spineboy-pro.{json,atlas,png}` | PERF-01 | ✓ | token 4.3.01, committable (NOT gitignored) | — |
| `fixtures/SLIDER_4_3/NOTES.txt` | SLIDER-02 D-05 triangulation | ✗ | — | **No code fallback — owner action D-03 MUST produce it; the §-spec (D-10) is the delivery vehicle.** |
| Spine 4.3 editor | Owner reads NOTES.txt peak | (owner host) | 4.3.0x build | — (human/owner step, not a CI dependency) |

**Missing dependencies with no fallback:**
- `fixtures/SLIDER_4_3/NOTES.txt` — owner-authored per D-03; the Phase 46 plan MUST include the owner-export §-spec task (D-10) and a checkpoint that NOTES.txt exists + is parseable before SLIDER-02 can pass. This is the only true external dependency (a human reading the Spine editor).

**Missing dependencies with fallback:** None.

## Validation Architecture

> Nyquist is enabled for this run (`workflow.nyquist_validation` not false). This whole phase IS a validation proof — the section below is the concrete spec the downstream VALIDATION.md is generated from.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest `^4.0.0` |
| Config file | `vitest.config.ts` (existing — verified by the 1244-test suite in STATE.md) |
| Quick run command | `npx vitest run tests/runtime43/slider43-closedform.spec.ts tests/main/sampler-worker-spineboy43.spec.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SLIDER-01 | The 4.3 slider rig is committed in-repo & parses through runtime-43 | smoke (already covered) | `npx vitest run tests/runtime43/slider43-smoke.spec.ts` | ✅ (Phase 44) |
| SLIDER-02 (peak) | Sampled `globalPeaks` `square` peakScale == hand-derived literal `4.0` within `toBeCloseTo(...,5)` | closed-form unit | `npx vitest run tests/runtime43/slider43-closedform.spec.ts` | ❌ Wave 0 |
| SLIDER-02 (triangulation, D-05) | Owner editor-observed value in `fixtures/SLIDER_4_3/NOTES.txt` == `4.0` within `1e-2` (loud-fail if NOTES.txt absent/unparseable) | closed-form unit | (same file, additional `expect`) | ❌ Wave 0 |
| SLIDER-02 (SC#2, zero slider code) | No slider-specific symbol in `src/core/` (git-diff scope OR structural: the closed-form test passes against unchanged `core/`) | structural assertion | `git diff --name-only <phase-base>..HEAD -- src/core/ \| wc -l` == 0 (see §Zero-Slider-Code Invariant) | ❌ Wave 0 |
| PERF-01 | `runSamplerJob` on spineboy-pro (warm-up discarded) < `measured × 3` ms, CI-enabled | perf integration | `npx vitest run tests/main/sampler-worker-spineboy43.spec.ts` | ❌ Wave 0 |

### Sampling Rate
- **Sampler rate:** 120 Hz default (CLAUDE.md Fact 6; `sampler.ts:148` `samplingHz ?? DEFAULT_SAMPLING_HZ`). **No higher rate needed** — the slider-driven scale peak is a *monotone linear* ramp peaking at the keyed terminal frame (t=1.0 s); the sampler loop's `t <= duration + 1e-9` terminal epsilon (`sampler.ts:322`) plus the exact 120-step landing on 1.0 s guarantees the peak is sampled. Higher Nyquist rates would not change the result (no sub-frame easing overshoot — the `scale` keyframes have no `curve` → linear). Both tests run at the 120 Hz default.
- **Per task commit:** `npx vitest run tests/runtime43/slider43-closedform.spec.ts` (and the perf spec once added).
- **Per wave merge:** `npm run test` (full suite — confirm no regression; the 11 pre-existing `tests/renderer/*` MixBlend IMPORT failures are Phase-47-owned, NOT this phase's — trust targeted gates per memory `project_renderer_mixblend_preexisting_failure`).
- **Phase gate:** Full suite green (modulo the documented pre-existing MixBlend import-failures) + both new gates green + NOTES.txt present/parseable + zero-`src/core/`-diff, before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/runtime43/slider43-closedform.spec.ts` — covers SLIDER-02 (closed-form peak + D-05 NOTES.txt triangulation)
- [ ] `tests/runtime43/baseline-driver.ts` — ADD `buildLoadSlider43()` (clone of `buildLoad43()`, repointed to `fixtures/SLIDER_4_3/SLIDER-01.*`, dir-scan filename resolution, `load43.ts` loud-or-skip contract)
- [ ] `tests/main/sampler-worker-spineboy43.spec.ts` — covers PERF-01 (clone of `sampler-worker-girl.spec.ts`, `it.skipIf` REMOVED, repointed to spineboy-pro, BUDGET = measured×3, `[PERF-43]` log)
- [ ] `fixtures/SLIDER_4_3/NOTES.txt` — owner-authored (D-03), produced via the §-spec; SLIDER-02 D-05 arm depends on it
- [ ] `46-OWNER-EXPORT-SPEC.md` — the D-10 §-spec (two actions: spineboy version-align acceptance token [already DONE — spec records `4.3.01`]; NOTES.txt value/frame/units)
- [ ] Framework install: none — vitest already present.

### Zero-Slider-Code Invariant (SLIDER-02 SC#2) — how a plan proves it

Two complementary, both recommended:
1. **Structural (primary, automatic):** the closed-form test passes with the literal `4.0` against an **unchanged `core/`**. If the slider did not propagate through the existing `updateWorldTransform(Physics.update)` path with zero slider-specific code, the `slide`-pass peak would be `1.0` (no scale animation, only translation) and the test would fail. A green closed-form test on unmodified `core/` *is* the proof that no slider code was needed.
2. **Scope check (secondary, explicit):** a plan task / verification step asserts `git diff --name-only <phase-base-sha>..HEAD -- src/core/` is empty (no `src/core/` file changed by the phase) — making "zero slider-specific sampler code" a *machine-checked* fact, not just an emergent property. (The phase's only edits are under `tests/`, `fixtures/SLIDER_4_3/NOTES.txt`, and `.planning/`.) This mirrors the codebase's "thread identity / structural fact over inference" preference (memory `feedback_explicit_identity_over_inference`).

## PERF-01 Budget (D-09 margin justification)

**Margin recommendation: 3× (BUDGET = ⌈measured × 3⌉).**

Justification from the structural analog (`tests/main/sampler-worker-girl.spec.ts`):
- The Girl gate sets its ceiling as **`requirement_budget − fixed_margin`**: 10000 ms N2.2 requirement − 2000 ms margin = 8000 ms ceiling, with the *actual* measured value ≈ 606 ms (PROJECT.md). That is a ~13× headroom over measured (8000 / 606) — i.e. the Girl gate is extremely loose because it had a generous fixed requirement budget to subtract from.
- PERF-01 has **no fixed requirement budget to subtract from** (the N2.2 606 ms is a *reference*, not a 4.3 ceiling — D-08). So the ceiling must be derived as `measured × margin`, not `budget − margin`. A multiplicative margin is the correct shape when there is no absolute requirement number.
- The Girl spec also explicitly authorizes `skipIf(CI)` precisely *because* "empirical CI variance exceeds budget" — i.e. the project has already observed that CI run-to-run variance for the sampler wall-time is significant. Since PERF-01 **cannot** skip on CI (D-07/D-09), the margin must absorb that variance instead. The Girl gate's own 2000 ms-on-606 ms-measured posture (≈3.3× of measured as the absolute slack it tolerated locally, and ~13× as the ceiling) shows the project's comfort zone for sampler-timing slack is well above 2×.
- **3×** is a deliberate midpoint: comfortably above the typical 1.5-2× CI-vs-dev wall-time variance for CPU-bound Node work, below the Girl gate's ~13× looseness (which would make PERF-01 useless as a regression detector). It catches a real regression (a >3× slowdown is a genuine algorithmic regression in the 4.3 three-pose path) while not flaking on a loaded CI runner. The exact `measured` is captured at plan/execute time; the comment records `measured`, the date, the machine, and `BUDGET = measured × 3`.
- Record narratively in PROJECT.md at phase close (D-09): `4.3 spineboy-pro = N ms = K× the 4.2 Girl 606 ms reference` (K is descriptive only — different rig, different version; not a pass/fail gate).

If, at execute time, run-to-run variance on the target CI is observed to exceed 3× (unlikely for this CPU-bound workload but possible on heavily-shared runners), the planner/executor may raise to 4× with a recorded justification — D-09 leaves the multiplier to Claude's discretion provided it is justified from measured variance. Do **not** lower below 3× (re-introduces the flakiness the Girl gate's skip was avoiding).

## Owner-Export §-Spec (D-10) — content the planner must author

Model on `42-OWNER-EXPORT-SPEC.md` structure (a numbered §, a table row mapping artifact→action→target path, an explicit acceptance check, a checklist). The Phase-46 §-spec has **two actions**:

**Action (a) — spineboy-pro version-align (ALREADY DONE; spec records the acceptance token only):**
- Artifact: `fixtures/spineboy_4.3/spineboy-pro.{json,atlas,png}`
- Action: re-export at the `4.3.0x` editor build (DONE 2026-05-18).
- Acceptance: `skeleton.spine` == `4.3.01` (verified, no `-beta`); structure 67 bones / 52 slots / 11 anims / 14 constraints (verified); committable / NOT gitignored (verified). **Status: PASSED — the §-spec records this as already-accepted, no owner action remaining.**

**Action (b) — `fixtures/SLIDER_4_3/NOTES.txt` (owner action, the real remaining work):**
- Artifact: `fixtures/SLIDER_4_3/NOTES.txt` (new).
- Action: open the SLIDER-01 rig in the **Spine 4.3 editor**, select/play the **`slide`** animation, scrub to its **end frame (time = 1.0 s; frame 30 at the editor's default 30 fps dopesheet)**, and read off the editor's transform readout for **`slider_bone`**. Record:
  - The animation observed: `slide`
  - Peak frame / time: t = 1.0 s (frame 30 @ 30 fps editor dopesheet — note: dopesheet fps is editor metadata only, CLAUDE.md Fact 1; the runtime time is the 1.0 s)
  - Source property at the peak: `slider_bone` **local X = 200**
  - **Observed `slider_bone` world scaleX and world scaleY at that frame** (expected ≈ **4.0** each) — this is THE number SLIDER-02's D-05 arm parses
  - Units: world scale is a dimensionless multiplier; local X is in skeleton units
- Acceptance: NOTES.txt exists at `fixtures/SLIDER_4_3/NOTES.txt`, contains a parseable numeric scale value, and that value agrees with the hand-derived `4.0` within `1e-2`. The SLIDER-02 test enforces this (loud-fail if absent/unparseable — Pitfall 2).
- Format guidance for the owner: free-text is fine (mirrors §3's "document the actual numbers ... in a `NOTES.txt`"), but the world-scale value must be machine-extractable (e.g. a line like `slider_bone world scaleX = 4.000, scaleY = 4.000 at slide t=1.0s (slider_bone.x=200)`). The §-spec should give the owner this exact suggested line so the test's parser is trivial and robust.

The §-spec should also restate the D-05 triangulation purpose so the owner understands *why* the editor read matters (it is the independent third leg: hand-math ≡ editor ≡ our runtime).

## Sources

### Primary (HIGH confidence)
- `node_modules/@esotericsoftware/spine-core/dist/Slider.js` (lines 51-72) — the exact `Slider.update()` time-mapping formula `p.time = offset + (property.value − property.offset)·scale`; loop/clamp behavior. [VERIFIED: in-repo spine-core@4.3.0]
- `node_modules/@esotericsoftware/spine-core/dist/SliderData.js` — slider data field defaults (`scale=0`, `offset=0`, `local=false`, `loop=false`). [VERIFIED]
- `node_modules/@esotericsoftware/spine-core/dist/SliderPose.js` — `time`/`mix` pose fields. [VERIFIED]
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js` (lines 319-340, 485-516, 54) — the JSON slider parse: `mix` default `1`, `from`/`to`→`property.offset`/`offset`, `scale / propertyScale`, `propertyScale("x")=this.scale`, `SkeletonJson.scale=1`. [VERIFIED]
- `node_modules/@esotericsoftware/spine-core/dist/TransformConstraintData.js` (lines 119-177) — `FromX.value()` returns `source.x + offsets[X]` when `local` (offsets all 0 ⇒ `slider_bone.x`). [VERIFIED]
- `node_modules/@esotericsoftware/spine-core/dist/Animation.js` (lines 40-117) — `duration` is in seconds; `loop=false` ⇒ last frame used beyond duration. [VERIFIED]
- `fixtures/SLIDER_4_3/SLIDER-01.json` — the authoritative committed rig (D-01); every keyframe + the `drive` constraint block read verbatim. [VERIFIED: Read 2026-05-18]
- `fixtures/spineboy_4.3/spineboy-pro.json` — `skeleton.spine` = `4.3.01`, 67/52/11/14 (D-07/D-11 token re-confirmed). [VERIFIED: json read 2026-05-18]
- `src/core/sampler.ts` (lines 148-356), `src/core/bounds.ts` (lines 140-173, 400-407), `src/core/loader.ts` (lines 237-287), `src/core/runtime/runtime-43.ts` (lines 448-486), `tests/runtime43/baseline-driver.ts` (lines 121-185), `tests/runtime43/slider43-smoke.spec.ts`, `tests/main/sampler-worker-girl.spec.ts`, `tests/core/overrides.spec.ts` (lines 1-40, 111-231) — sampler lifecycle, region peak path, dispatch, driver clone target, closed-form `toBeCloseTo(...,5)` convention. [VERIFIED: Read 2026-05-18]
- `.planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-OWNER-EXPORT-SPEC.md` (§3) — historical SLIDER-01 intent + the never-run NOTES.txt fallback clause (executed by D-03); §3 ground truth confirmed STALE. [VERIFIED: Read 2026-05-18]

### Secondary (MEDIUM confidence)
- Spine User Guide — "Sliders" (`en.esotericsoftware.com/spine-sliders`): confirms the conceptual mechanism — a source bone "determines the frame of the animation to display"; "Property is used to map the range of a transform to the frames of the animation"; left numbers = bone range limits, right numbers = first/last animation frame; `Local` toggles local vs world source transform. Corroborates the source-verified formula's *intent*; the precise formula + seconds-units come from the runtime source (primary). [CITED]

### Tertiary (LOW confidence)
- None. (The official user-guide page did not include the explicit formula; the runtime source is the authoritative ground truth and was read directly — no unverified web-only claims were used for the closed form.)

## Metadata

**Confidence breakdown:**
- Closed-form slider oracle (the literal `4.0` + derivation): **HIGH** — every constant resolved from in-repo spine-core@4.3.0 source; the formula, every parsed default, and the linear-interpolation peak are source-verified; arithmetic is exact (`1 + 3·1 = 4`). The only residual is A1 (last-frame-beyond-duration behavior), which is standard spine-ts contract and additionally caught by the D-05 triangulation if wrong.
- Standard stack: **HIGH** — no new deps; all versions verified against node_modules + package.json.
- Architecture / test patterns: **HIGH** — clone targets (`buildLoad43`, `sampler-worker-girl.spec.ts`, `overrides.spec.ts` convention) read verbatim; the sampler lifecycle + region→bone-scale path source-confirmed.
- PERF-01 margin (3×): **MEDIUM** — justified from the Girl analog's documented variance posture + CI-no-skip constraint; the absolute `measured` is intentionally captured at execute time (not assumed), so the margin shape (multiplicative ×3) is the load-bearing recommendation, not the absolute number.
- D-06 escape-hatch determination (NOT triggered): **HIGH** — the closed form is unambiguously hand-derivable; the default D-01..D-05 path holds.

**Research date:** 2026-05-18
**Valid until:** ~2026-06-17 (30 days — stable: pinned spine-core@4.3.0, committed fixtures, no fast-moving external surface). Re-verify only if spine-core is bumped or the SLIDER-01/spineboy-pro fixtures are re-exported.
