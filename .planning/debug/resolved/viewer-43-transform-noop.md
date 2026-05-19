---
slug: viewer-43-transform-noop
status: resolved
created: 2026-05-19
updated: 2026-05-19
resolved: 2026-05-19
diagnose_only: false
consolidated_into: .planning/debug/resolved/viewer-43-42-constraint-parse.md
trigger: |
  DATA_START
  i added a new fixture called DEMON at /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/DEMON/SKINS_SPINE_V02.json

  For this debug session, consider the skins FULL_SKINS/ANGEL and FULL_SKINS/DEMON only.

  this is a rig made in 4.2 that i re-exported to v4.3. I added a transform constraint
  (R_IK_HEEL-to-R_IK_WRIST) and a slider (con). Then i reduced the rig scale to about 0.1
  to run in the app. Issues found:

  a) the transform constraint is not displaying properly: When R_IK_HEEL bone moves up in
  tY, it should affect tY and rotation of the R_IK_WRIST bone (as seen in the preview panel
  in the editor, or in the animation timelines, or even the setup pose, while moving the
  bone). But viewing the animations in the app's Animation Viewer, specifically in the
  animations drive and con, where these bones are moving, while the R_IK_HEEL moves, the
  R_IK_WRIST doesn't.
  DATA_END
---

# Debug: viewer-43-transform-noop

## Symptoms

### Expected behavior
In the app's **Animation Viewer**, playing the `drive` or `con` animation on the
`fixtures/DEMON/SKINS_SPINE_V02.json` fixture (skins **FULL_SKINS/ANGEL** and
**FULL_SKINS/DEMON** only) should show the `R_IK_HEEL`→`R_IK_WRIST` transform
constraint applied: when `R_IK_HEEL` moves up in tY, `R_IK_WRIST` should follow
in **both tY and rotation** — exactly as it renders in the Spine editor preview
panel, the animation timelines, and the setup pose when dragging the bone.

### Actual behavior
Animation Viewer **opens and plays cleanly, NO error overlay** (owner-confirmed
2026-05-19). The single visible defect: while `R_IK_HEEL` moves through the
`drive`/`con` animations, `R_IK_WRIST` stays put — the transform constraint is a
**silent no-op** in the viewer's render. Core analysis (Source Dimensions /
Scale table) is **not confirmed affected**; owner only inspected the viewer
("only viewer wrong / not sure").

### Error messages
None. No error overlay, no "constraint not found". This is the discriminator vs
the related `viewer-43-42-constraint-parse` session (which threw hard errors).

### Timeline
New fixture (added 2026-05-19). Rig authored in Spine 4.2, **re-exported to
4.3** — `"spine": "4.3.02"`. The fixture uses the **4.3-native unified
`constraints[]` array** (verified: no 4.2-format top-level
`transform`/`ik`/`path`/`physics` keys). v1.6 (Spine 4.3 dual-runtime port) is
milestone_complete; Animation Viewer is single-runtime spine-player@**4.3.0**
(Phase 47).

### Reproduction
1. `npm run dev` (Electron dev app, current `main`, head `15bf5e8`).
2. Load `fixtures/DEMON/SKINS_SPINE_V02.json` (sibling `.atlas` + 3 `.png`
   pages present; rig pre-scaled to ~0.1 by owner).
3. Select skin **FULL_SKINS/ANGEL** or **FULL_SKINS/DEMON**.
4. Open the Animation Viewer; play animation **`drive`** or **`con`**.
5. Observe: `R_IK_HEEL` animates; `R_IK_WRIST` does NOT follow (no tY, no
   rotation). Editor/timeline/setup-pose show it following correctly.

Headless repro (no WebGL, deterministic):
`node .planning/debug/_repro_viewer_43_transform_noop.mjs` and the four
`_repro{2..5}*.mjs` siblings — all drive the EXACT spine-core@4.3.0 bundled in
spine-player@4.3.0.

### Scope constraints (owner-imposed — honor exactly)
- Only skins `FULL_SKINS/ANGEL` and `FULL_SKINS/DEMON`.
- Only animations `drive` and `con` (where these bones move).

## Current Focus

```yaml
hypothesis: "spine-core@4.3.0's SkeletonJson transform-constraint parser
  defaults `mixY` to `setup.mixX` (chained default). The DEMON constraint's
  `properties` block declares a `y` output but NO `x` output, so `mixX` is
  never assigned and stays at the TransformConstraintPose default of 0;
  therefore `mixY` resolves to 0 and the only render-relevant output of the
  constraint (the ToY translation that drives R_IK_WRIST's IK-target world
  position) is silently zeroed. The ToRotate output works but is invisible
  because R_IK_WRIST is a childless IK-target control bone whose ROTATION is
  irrelevant to render — only its POSITION feeds the R_WRIST_IK / R_IK_WRIST
  IK constraints that move the visible arm."
test: "Headless: parse DEMON with spine-core@4.3.0, run drive/con through the
  full SpinePlayer lifecycle, trace R_IK_WRIST + the IK-driven arm chain
  (R_ARM_BOT/R_SHOULDER2) with mixY at its parsed default vs forced to 1."
expecting: "Baseline: R_IK_WRIST world position frozen + arm chain frozen.
  Force appliedPose.mixY=1: R_IK_WRIST.worldY animates and the IK arm chain
  comes alive (matches expected editor behavior)."
reasoning_checkpoint: "CONFIRMED — see Evidence 2026-05-19 repro 5. Root cause
  is the spine-core@4.3.0 `mixY ← mixX` chained parse default with no `x`
  output. Awaiting owner fix-direction decision (fix options below)."
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-05-19 — Fixture is `"spine": "4.3.02"`. Top-level JSON keys:
  `skeleton, bones, slots, constraints, skins, animations`. `constraints` is a
  4.3-native flat array, len **178**. NO 4.2-format `transform`/`ik`/`path`/
  `physics` top-level objects ⇒ this fixture does NOT trigger the
  `viewer-43-42-constraint-parse` design gap (no "constraint not found").
- timestamp: 2026-05-19 — The constraint under investigation (first transform
  entry in `constraints[]`):
  `{"type":"transform","name":"R_IK_HEEL-to-R_IK_WRIST","source":"R_IK_HEEL",
  "bones":["R_IK_WRIST"],"properties":{"y":{"offset":-4016.194,"to":{
  "rotate":{"offset":-66.94341,"max":-99,"scale":-0.3205659},
  "y":{"offset":-3866.2644,"max":-3846.2644,"scale":0.2}}}},"clamp":true}`.
  This is the **NEW Spine 4.3 property-mapping** transform-constraint shape
  (input bone-property `y` of `source` mapped → output `rotate`+`y` of target
  bone, with per-output offset/scale/max + global `clamp:true`). It has NO
  4.2-equivalent (`target`/`mixRotate`/`mixX`/`local`/`relative` shape).
  Note: there is **no `x` output** and **no top-level `mixX`/`mixY`/`mixRotate`
  keys** in the JSON.
- timestamp: 2026-05-19 — A 4.3-native **`slider`** constraint also present and
  is the FIRST constraints[] entry:
  `{"type":"slider","name":"con","animation":"con","time":0.6329754,"mix":0,
  "bone":"L_IK_WRIST","property":"rotate","scale":0.008,"local":true}`. The
  `con` animation is slider-driven (a 4.3-only construct). Relevant because one
  of the two affected animations is `con`.
- timestamp: 2026-05-19 — Bones `R_IK_HEEL` and `R_IK_WRIST` both exist in the
  rig. There is also an `ik` constraint `L_IK_WRIST` and others on the L side;
  watch for constraint-order / competing-constraint interactions on R_IK_WRIST.
- timestamp: 2026-05-19 — Owner clarifications: (Q1) Animation Viewer **opens &
  plays, no error**, only R_IK_WRIST fails to follow. (Q2) Only the viewer
  inspected; core scale table not confirmed wrong ("not sure").
- timestamp: 2026-05-19 — Architecture (carried from
  `viewer-43-42-constraint-parse`, root-caused 2026-05-18): the Animation
  Viewer is **single-runtime spine-player@4.3.0** — `AnimationPlayerModal.tsx`
  (~:613) feeds **raw project JSON** to `new SpinePlayer(container, config)`,
  whose bundled `spine-core@4.3.0` re-parses it, bypassing the app core's
  dual-runtime `pickRuntime` router. For a 4.3 fixture this parse SUCCEEDS
  (hence no error) — so the fault is in spine-core@4.3.0's *handling/applying*
  of the new property-mapping transform constraint at render time, OR in how
  AnimationPlayerModal configures the player, NOT a parse-registration miss.
- timestamp: 2026-05-19 — Installed versions: `@esotericsoftware/spine-player
  @4.3.0`, `spine-webgl@4.3.0`, `spine-core@4.3.0` (the viewer runtime). Data
  is `4.3.02`. spine-core@4.3.0 **fully implements** the new 4.3
  property-mapping transform constraint: `SkeletonJson.js` parses
  `source`/`properties`/`{input}.to.{output}`/`offset`/`scale`/`max`/`clamp`
  (lines 160–252), and `TransformConstraint.js update()` applies it via
  `FromY.value` + `ToRotate.apply`/`ToY.apply` with the `clamp` branch. So this
  is **NOT** an unimplemented-schema or parse-registration miss → eliminates
  investigation axis (a).
- timestamp: 2026-05-19 — REPRO 1 (`_repro_viewer_43_transform_noop.mjs`):
  fed raw DEMON JSON to spine-core@4.3.0, ran `drive` & `con` × {ANGEL,DEMON}
  through `state.update→state.apply→skeleton.update→updateWorldTransform(
  Physics.update)`. `R_IK_HEEL.worldY` oscillates correctly every frame;
  `R_IK_WRIST` world transform is **byte-identical** at every timestamp /
  animation / skin (`wx=2112.70 wy=-3864.81`). Parsed
  `setupPose.mixRotate=1`, `setupPose.mixY=0`, `setupPose.mixX=0`;
  `from[0]=FromY(offset -4016.194)`, `to=[ToRotate(off -66.94 max -99
  scale -0.32), ToY(off -3866.26 max -3846.26 scale 0.2)]`.
- timestamp: 2026-05-19 — REPRO 2 (`_repro2_clamp_trace.mjs`): the constraint
  math is CORRECT and LIVE. Per-frame `ToRotate` clamped value varies
  `-67.2 → -85.7 → -95.1 → -70.5` with **mix=1**; `ToY` mix=0. So `ToRotate`
  IS applied with a varying value every frame; `clamp:true` is not collapsing
  it → eliminates the clamp-collapse and dead-math hypotheses.
- timestamp: 2026-05-19 — REPRO 4 (`_repro4_guard.mjs`): the
  `TransformConstraint.update()` early-return guard does **NOT** fire —
  `appliedPose.mixRotate=1` at update() time, constraint RUNS every frame
  (`pose === appliedPose`, not switched to constrainedPose; no transform
  timeline keys it — `con` has only TranslateTimeline, `drive` only
  SliderMixTimeline). Eliminates the guard-skip and
  appliedPose-reset-to-zero hypotheses.
- timestamp: 2026-05-19 — REPRO 3 (`_repro3_updatecache.mjs`): `_updateCache`
  step 12 = `BonePose<R_IK_WRIST>`, step 13 = TransformConstraint
  `R_IK_HEEL-to-R_IK_WRIST`. R_IK_WRIST `rot=-84.32` BEFORE (step 12) and
  UNCHANGED AFTER (step 13), and stays -84.32 for all remaining 314 cache
  entries → NOT a downstream-overwrite / constraint-ordering problem; the
  constraint genuinely produces no change to R_IK_WRIST's WORLD POSITION.
- timestamp: 2026-05-19 — REPRO 5 (`_repro5_topology.mjs`) — **ROOT CAUSE
  ISOLATED**. Topology: `R_IK_WRIST` is a **childless leaf** bone that is the
  **IK target** of `R_WRIST_IK` (drives R_SHOULDER2/3) and `R_IK_WRIST`
  (drives R_ARM_BOT). For an IK target control bone only its WORLD POSITION
  matters to render; its rotation is irrelevant. BASELINE (as parsed,
  `mixY=0`): R_IK_WRIST world position frozen, IK arm chain
  (R_ARM_BOT/R_SHOULDER2) **completely frozen**. FORCE `appliedPose.mixY=1`
  every frame: R_IK_WRIST.worldY animates (`-3866→-3854→-3848`) AND the IK
  arm chain **comes alive** (R_ARM_BOT `2102→2114→2117`, rot
  `-78→-92→-96`) — the expected editor behavior. Confirms the defect is the
  silenced `ToY` output.
- timestamp: 2026-05-19 — Parse-defect locus (spine-core@4.3.0
  `SkeletonJson.js` ~lines 238–250): per-output mix defaults are
  `if (rotate) setup.mixRotate = getValue(map,"mixRotate",1)`,
  `if (x) setup.mixX = getValue(map,"mixX",1)`,
  **`if (y) setup.mixY = getValue(map,"mixY", setup.mixX)`**. When a
  `properties` block has a `y` output but NO `x` output, `setup.mixX` is
  never assigned and remains the `TransformConstraintPose` field default
  **0** (`TransformConstraintPose.js:34 mixX = 0`), so `mixY ← 0`. The Spine
  editor does not emit `mixX`/`mixY` keys when they equal its own intended
  default (active = 1), so the JSON has no override to rescue it. This is a
  **spine-core@4.3.0 JSON parse chained-default defect** for the
  y-output-without-x-output case.

## Related (distinct) session

`.planning/debug/viewer-43-42-constraint-parse.md` (status: root-caused,
CLOSED) — same viewer, but that bug is the **single-runtime-4.3-viewer cannot
read 4.2-FORMAT JSON** design gap (hard "constraint not found" throw, owned by
Phase 47 discuss→plan). **This session is different**: DEMON is 4.3-format,
parses fine, viewer plays — the 4.3-native property-mapping transform
constraint is a silent no-op. Do NOT conflate; do NOT re-derive that
architecture from scratch (reuse the AnimationPlayerModal single-runtime fact).

## Eliminated

- **Axis (a) — spine-core@4.3.0 does not implement the new 4.3 property-mapping
  transform constraint.** FALSE. Parse + apply are fully implemented and
  exercised (Evidence: installed-version inspection + repro 2 shows live
  ToRotate math).
- **Editor-vs-runtime version skew (4.3.02 data vs 4.3.0 runtime) causes a
  parse mismatch.** FALSE. The constraint parses to the correct From/To
  structure with correct offsets/scales (repro 1/2); skew is not the fault.
- **`clamp:true` collapses the output to a constant.** FALSE. Per-frame
  clamped value varies correctly (repro 2).
- **`TransformConstraint.update()` early-return guard skips the constraint /
  appliedPose reset to zero.** FALSE. `appliedPose.mixRotate=1` at update()
  time, constraint runs every frame (repro 4).
- **Downstream constraint-ordering: another constraint overwrites R_IK_WRIST
  after the transform constraint.** FALSE. R_IK_WRIST world transform is
  unchanged BY the transform constraint itself and untouched by all 314
  subsequent cache entries (repro 3).
- **AnimationPlayerModal player misconfiguration (skin/physics/mix).** Not the
  root cause — the defect reproduces in a bare headless spine-core@4.3.0
  lifecycle with no player involved (repro 1–5). (Player default-animation is
  `animations[0]`=`DANCE2`, but the owner explicitly selects drive/con — not
  relevant to the no-op.)
- **The `con` slider / slider-driven `drive` chain is the culprit.** FALSE.
  The no-op reproduces identically in `con` (slider mix stays 0) and in
  `drive` (slider mix ramps 0→0.7); the frozen output is independent of the
  slider state (repro 1).

## Resolution

**ROOT CAUSE (confirmed):** `@esotericsoftware/spine-core@4.3.0`
`SkeletonJson.readSkeletonData` transform-constraint parser uses a chained
mix default `setup.mixY = getValue(map, "mixY", setup.mixX)`. The DEMON
`R_IK_HEEL-to-R_IK_WRIST` constraint's `properties` block defines a `y`
output but no `x` output and no explicit `mixX`/`mixY` keys, so `setup.mixX`
stays at the field default `0` and `mixY` resolves to `0`. The constraint's
`ToY` (position) output — the **only render-relevant output**, because
`R_IK_WRIST` is a childless IK-target control bone whose rotation does not
affect render and whose position drives the visible arm via the
`R_WRIST_IK`/`R_IK_WRIST` IK constraints — is therefore silently zeroed,
freezing the arm. The `ToRotate` output works but is invisible. The Spine
editor renders it correctly because it treats a declared output as active
(mix 1) and omits the now-default-equal `mixX`/`mixY` keys from the export,
giving the runtime no override to recover the intended value.

**This is an upstream spine-core@4.3.0 parse defect**, surfaced because the
Animation Viewer feeds raw JSON to spine-player@4.3.0's bundled spine-core
(single-runtime path). It is data-shape-specific: any 4.3 transform
constraint with a `y` output, no `x` output, and no explicit `mixY` key is
affected.

**OUTCOME — RESOLVED 2026-05-19 (Owner Option A — JSON normalization shim).**

This investigation was consolidated into the `viewer-43-42-constraint-parse`
lineage (same Animation-Viewer/constraint surface): the original 4.2-JSON
design gap was independently closed by the shipped DV-1 dual-runtime viewer
router (`AnimationPlayerModalRouter.tsx`), and this `mixY` chained-default
collapse is its residual 4.3-leg defect. The full root cause, the
typescript-specialist review, the schema reconciliation (verified
`mixShearY` is an *unconditional* `1`, NOT chained → correctly excluded), the
per-runtime verification matrix, and the atomic commit are recorded in:

→ **`.planning/debug/resolved/viewer-43-42-constraint-parse.md`** (status:
resolved)

**Fix:** `src/shared/spine43-constraint-mix-normalize.ts` — a spine-core-free,
DOM-free JSON-normalization shim injecting `mixY:1`/`mixScaleY:1` only when the
secondary-axis output is present, the primary-axis output absent, and the key
omitted (idempotent; never overwrites an author mix). Wired into BOTH 4.3
seams: `runtime-43.ts:parseSkeleton` (app-core Scale table) and
`AnimationPlayerModal.tsx`'s spine-player@4.3.0 feed (4.3 viewer leg). 4.2
projects route to the 4.2 leg and are unaffected.

**Commit:** `7003ad8` — `fix(viewer): normalize Spine 4.3 chained mix{Y,ScaleY}
defaults` (atomic, owner-classified post-v1.6-completion fix, class parity
with `e7db8fe`; not pushed, per project memory).

**Verified:** R_IK_WRIST world position DEAD (Δ=0.00) → ALIVE (Δy≈15.77 drive
/ 19.62 con) across FULL_SKINS/{ANGEL,DEMON} × {drive,con}, all 4 combos;
1378 vitest pass (lone `slider43-closedform` SC#2 failure is pre-existing,
reproduces with this fix fully stashed); CLI runtime-43 + runtime-42 clean;
19 author-explicit-mix transforms byte-untouched.

The throwaway `_repro*.mjs` diagnostics have been deleted (this cleanup pass).
