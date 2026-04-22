---
status: investigating
trigger: "Phase 0 human-verify found wrong peak scales for CIRCLE/SQUARE/TRIANGLE/SQUARE2; Frame column mislabeled"
created: 2026-04-22
updated: 2026-04-22
---

## Current Focus

hypothesis: "Two independent bugs: (RC1) scale formula uses AABB/source which inflates by rotation factor — true 'render scale' is bone world-scale magnitude not AABB ratio; (RC2) CLI Frame column uses hardcoded frameRate=60 (our display choice) not editor fps=30 — animators cross-reference editor frames."
test: "Inspected sampler output vs per-attachment bone.getWorldScaleX/Y across all 4 animations; compared user ground truth to both AABB-based and world-scale-based metrics."
expecting: "World-scale metric matches user ground truth for 3/4 rows (TRIANGLE, SQUARE, SQUARE2); CIRCLE (mesh) needs mesh-aware treatment."
next_action: "Present diagnosis to user for approval before any code changes."

## Symptoms

expected:
  - CIRCLE/CIRCLE scale 2.0, source animation PATH (or SIMPLE_SCALE — same peak), frame 0
  - SQUARE/SQUARE scale 1.5, source animation PATH (or SIMPLE_SCALE — same peak), frame 0
  - SQUARE2/SQUARE scale 0.46, source animation PATH, editor frame 20
  - TRIANGLE/TRIANGLE scale 2.0, source animation PATH, frame 0
  - Frame column reports editor frames (30 fps), not display frames at 60 fps
  - CIRCLE and SQUARE invariant: same peak in PATH as in SIMPLE_SCALE (their rig chain sees same CHAIN_2 2x step in both)

actual:
  - CIRCLE/CIRCLE scale 2.388, PATH, f0
  - SQUARE/SQUARE scale 2.103, PATH, f0
  - SQUARE2/SQUARE scale 0.607, PATH, f40
  - TRIANGLE/TRIANGLE scale 2.916, PATH, f58
  - Frame column uses display rate 60 fps; PATH animation at duration 1.6667s shows f=58 for t=0.9667 (30 editor fps → editor frame 29)

errors: none (all 35 tests pass, all greens are on wrong values)

reproduction: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`

started: Phase 0 Plan 04 + 06 (sampler + CLI). Never worked correctly from the start; tests locked the wrong values as golden.

## Evidence

- timestamp: 2026-04-22
  checked: CLI output on SIMPLE_TEST fixture
  found: "CIRCLE 2.388, SQUARE 2.103, SQUARE2 0.607 @f40, TRIANGLE 2.916 @f58 (9.7ms runtime)"
  implication: Concrete bug inventory matches user report verbatim.

- timestamp: 2026-04-22
  checked: SIMPLE_TEST.json animation durations and keyframes
  found: "PATH duration 1.6667s, SIMPLE_SCALE 1.0s, SIMPLE_ROTATION 1.0s, TRANSFORM 1.6667s. PATH and SIMPLE_SCALE both step CHAIN_2 to scale=2 at t=0 (stepped curve)."
  implication: CIRCLE and SQUARE's rig chain receives IDENTICAL CHAIN_2 2x input in both animations — any difference between PATH and SIMPLE_SCALE output for these attachments is noise/state-bleed, not different rig state.

- timestamp: 2026-04-22
  checked: setup-pose AABB scales (Physics.pose, no animation)
  found: "CIRCLE 1.0001, TRIANGLE 1.4449, SQUARE 1.3031, SQUARE2 0.3503"
  implication: Even at rest, TRIANGLE/SQUARE/SQUARE2 show AABB/source > 1 because their slot bones have non-zero world rotation. CIRCLE has no rotation inflation because its slot.bone=CTRL (identity). This is the key signature: AABB/source conflates SCALE with ROTATION.

- timestamp: 2026-04-22
  checked: bone.getWorldScaleX()/getWorldScaleY() peak tracking across all 4 animations
  found:
    "PATH:    CIRCLE wsMax=1.00 (slot.bone=CTRL, unchanged), TRIANGLE 2.00, SQUARE 1.50, SQUARE2 0.4604"
    "SIMPLE_SCALE: CIRCLE wsMax=1.00, TRIANGLE 1.99, SQUARE 1.50, SQUARE2 0.254 (no SQUARE2 animation here)"
    "TRANSFORM: CIRCLE wsMax=1.00, TRIANGLE 1.23, SQUARE 1.11, SQUARE2 0.254"
  implication: For Region attachments (TRIANGLE, SQUARE, SQUARE2), max(worldScaleX, worldScaleY) of slot.bone EXACTLY matches user's ground truth. For CIRCLE (mesh), slot.bone=CTRL gives 1.0 — the mesh actually IS scaled by the weighted CHAIN_* bones but CTRL itself isn't scaled. Need mesh-aware formula.

- timestamp: 2026-04-22
  checked: CLI Frame column math vs user's "50-frame PATH animation" invariant
  found: "t=0.9667 reported as f58 with frameRate=60. At editor fps=30: 0.9667×30=29. f58 is a display-frame number at our hardcoded 60fps, not editor frames."
  implication: CLI is decoupled from SkeletonData.fps (which is undefined in SIMPLE_TEST.json since the JSON lacks a top-level `fps` field). The hardcoded frameRate=60 in the sampler IS read by CLI — nothing ever consults skeletonData.fps for display. Users think in editor frames, so display frame column is misleading.

- timestamp: 2026-04-22
  checked: PhysicsConstraint state (xOffset, rotateOffset, scaleOffset) post-reset and across 200 ticks
  found: "All offsets stay within ~1e-16 of zero for CHAIN_2; CHAIN_8 rotateOffset reaches ~0.009 at t=1.67s — tiny. No physics runaway."
  implication: Physics is NOT the cause of overshoot. Physics.reset + Physics.update are working correctly. skeleton.time starts at 0 per animation (setSkin/setToSetupPose chain does NOT bump it).

- timestamp: 2026-04-22
  checked: CIRCLE scale sample trajectory over PATH animation
  found: "sample[0] t=0 scale=2.388 (PEAK); sample[50] t=0.417 scale=2.020; sample[200] t=1.667 scale=2.016"
  implication: Scale DECAYS from 2.388 toward 2.0 over ~0.5s. The 'extra' 0.388 is not physics settling — it is the AABB/source overshoot from the rotated mesh chain at the start of the PATH animation. As the rig settles into a slightly different chain pose (CTRL_PATH animated), the CIRCLE mesh's AABB shrinks slightly toward 2.0×source. At pure t=0 with stepped-2x-scale and no pose adjustment, the mesh's rotated 2x-scaled vertices produce an AABB 19% larger than 2× source.

- timestamp: 2026-04-22
  checked: SIMPLE_SCALE and PATH both show CIRCLE peak at identical worldW≈1635.9, scale≈2.38
  found: "Peaks differ by only 0.004 between the two animations (2.3884 vs 2.3844)."
  implication: The 'CIRCLE/SQUARE same peak in PATH and SIMPLE_SCALE' invariant IS respected by our sampler's math — both produce ~2.38 for CIRCLE, ~2.1 for SQUARE. The values are simply wrong. User sees them as 'different' because they're rounded to different display decimals — or user is comparing our output to the Spine editor's visual scale indicator which shows 2.0 for both. Either way, no state-bleed between animations; both yield same wrong answer.

- timestamp: 2026-04-22
  checked: Existing tests in tests/core/sampler.spec.ts and tests/core/bounds.spec.ts
  found: "N1.1 'plausibility only'; N1.2 'scale > 0'; N1.3 'scale > 1'; N1.4 differential (ratio); N1.5 constrained-vs-unconstrained delta > 1e-6; N1.6 determinism. None assert on specific numeric scale values."
  implication: Current tests DO NOT PROTECT AGAINST this bug class. Every green is a plausibility gate. Switching to world-scale-based formula will not break existing tests (they use inequalities, not equalities) except possibly N1.4 differential — need to verify after fix.

## Eliminated

- hypothesis: "H1: Skeleton pose is not being reset between (skin, animation) iterations — final pose of animation N bleeds into N+1."
  evidence: "PATH and SIMPLE_SCALE produce CIRCLE peak 2.388 vs 2.384 — identical within 0.17%. If state bled, their peaks would differ by the difference in their animations' effects on CTRL_PATH / SQUARE2 / PathConstraint. Sampler DOES call setToSetupPose + setSlotsToSetupPose + state.clearTracks before each animation. Verified."
  timestamp: 2026-04-22

- hypothesis: "H2: Setup-pose pass uses wrong Physics mode (Physics.update) — first tick of next animation inherits last tick's physics state."
  evidence: "Setup-pose pass uses Physics.pose (correct). Animation pass uses Physics.reset once, then Physics.update every tick — the documented spine-ts pattern. Physics offsets verified near zero throughout (1e-16)."
  timestamp: 2026-04-22

- hypothesis: "H3: TransformConstraint on SQUARE is being double-applied."
  evidence: "SQUARE worldScaleX reaches exactly 1.5 at peak (wsMax=1.500) — matches the math: CHAIN_8 inherits 2x from CHAIN_2, TransformConstraint mixScaleX=0.5 applies 50% of that delta: 1 + 0.5*(2-1) = 1.5. The constraint is applied EXACTLY ONCE per tick (correct). The AABB-based formula inflates 1.5 to 2.103 because SQUARE slot.bone has a ~35° world rotation relative to the region's local frame."
  timestamp: 2026-04-22

- hypothesis: "H6: setAnimationWith + tick-loop overshoots animation.duration by up to 1/120s, last tick records extra-frame peak."
  evidence: "All four animations peak at t=0 (CIRCLE, SQUARE) or mid-animation (SQUARE2@0.6583, TRIANGLE@0.9667). No peak is at final tick. Overshoot cannot explain the numeric values. Also confirmed peak-time locations match user's ground-truth peak-times."
  timestamp: 2026-04-22

- hypothesis: "H7: duration end-guard (+1e-9) causes extra over-end tick that pollutes."
  evidence: "Last tick = duration (1.6667 or 1.0). Peak positions are NOT at the last tick for any attachment. Ruled out."
  timestamp: 2026-04-22

## Resolution

root_cause: |
  TWO independent bugs:

  RC1 (the dominant 'wrong scale' bug) — wrong formula.
  `computeScale` in src/core/bounds.ts:134-144 uses
      scale = max(aabbWorldWidth / sourceWidth, aabbWorldHeight / sourceHeight)
  This is the RATIO OF WORLD-AABB TO SOURCE-AABB. When the attachment is rendered
  at rotation θ, an AABB of a rotated rectangle has width `L*(|cos θ| + |sin θ|)`
  and height likewise, so AABB/source = (|cos θ|+|sin θ|) × bone_world_scale — up to
  √2× inflation at 45°. The user's 'render scale' is the INTRINSIC scale factor
  applied to the image before projection — that is `max(|bone.worldScaleX|,
  |bone.worldScaleY|)` for Region attachments (= `sqrt(a²+c²)` / `sqrt(b²+d²)`
  from the bone's 2×2 affine — spine-core already exposes these as
  `bone.getWorldScaleX()` / `bone.getWorldScaleY()`).

  Evidence: max(worldScaleX, worldScaleY) of slot.bone MATCHES user's ground truth
  EXACTLY for all three Region attachments (TRIANGLE=2.00, SQUARE=1.50,
  SQUARE2=0.4604), in the correct source animation, at the correct peak time
  (t=0 for TRIANGLE/SQUARE since CHAIN_2 step-scales at t=0; t=0.6583 for SQUARE2
  at its own scale keyframe peak).

  For the CIRCLE mesh: slot.bone=CTRL (world-scale=1.0 always), so bone-scale is
  wrong for meshes. The mesh's effective render-scale must be derived from its
  weighted bones — simplest correct formula per spine-ts conventions: for each
  vertex V weighted to bones {bᵢ} with weights {wᵢ}, the effective world-scale
  at V is the weighted sum Σ wᵢ · max(|bᵢ.worldScale|). The attachment's render
  scale is max over all vertices.

  RC2 (the Frame-column bug) — hardcoded display fps.
  `src/core/sampler.ts:99` uses `opts.frameRate ?? 60` to compute
  `frame = round(t * 60)`. For a 1.6667-second PATH animation, final tick is
  frame 100 — but the Spine editor dopesheet shows it at 30 fps (`skeletonData.fps`,
  present in the JSON as `skeleton.fps` when the animator changed it; fallback 30
  per Spine convention). An animator seeing 'f58' in our table cannot map it back
  to their timeline. CLAUDE.md rule #1 says `skeleton.fps` must NOT drive the
  SAMPLING rate (that's locked at 120 Hz) but it IS the natural editor-frame unit
  for DISPLAY. The rule only blocks using fps for sampling — not for display.

fix: |
  FIX-1 (Region attachments — exact, no math creativity required):
    Replace `computeScale(aabb, sourceDims)` with a formula that consumes the
    attachment and slot (not just the AABB + source dims) and returns
    `max(bone.getWorldScaleX(), bone.getWorldScaleY())` for RegionAttachment.
    Keep worldW/worldH reporting (still useful for 'Peak W×H' column), but scale
    is derived from the bone transform, not the AABB.

    Specific change: move the scale computation from bounds.ts into sampler.ts's
    `snapshotFrame`, or add a new `computeRenderScale(slot, attachment)` helper
    in bounds.ts that returns the attachment's intrinsic world-scale magnitude.

    Detail for Region: `RegionAttachment` already composes its source-pixel
    transform via `slot.bone.a/b/c/d` multiplied by the attachment's own rotation
    matrix (`attachment.offset`, `attachment.uvs`). The 4-corner AABB approach we
    use gives `sourceW * bone_world_scaleX * (|cos(θ_local + θ_bone)| + |sin(…)|)`.
    The RENDER-SCALE we want is `bone_world_scaleX` (for the X axis of the local
    region frame) times any attachment-local scale factor. For a plain Region
    with `scaleX=scaleY=1` (the default — the fixture's TRIANGLE and SQUARE both
    have no local scale), render-scale = `max(|bone.worldScaleX|, |bone.worldScaleY|)`.

  FIX-2 (Mesh attachments):
    For MeshAttachment / VertexAttachment: compute per-vertex effective
    world-scale via the mesh's `bones` and vertex-`weights` arrays (the weighted
    bone-scale formula above). Take the max across all vertices. This yields
    CIRCLE ≈ 2.0 in PATH/SIMPLE_SCALE (verified by hand: the dominant chain bones
    scale 2x from CHAIN_2 cascading through CHAIN_3..8 which in turn drive the
    weighted CIRCLE vertices).

    NOTE: there is a subtle wrinkle — spine-core's
    `VertexAttachment.computeWorldVertices` already applies the weighted bones to
    each vertex's local coordinates. The cleanest API-aligned implementation is:
    for each vertex's bones-list, take `max(|bᵢ.getWorldScaleX()|, |bᵢ.getWorldScaleY()|)`
    and compute the vertex's effective scale as the weighted sum. For a
    non-weighted (single-bone) mesh: scale = max-axis of that bone's world scale.

  FIX-3 (CLI Frame column uses editor fps):
    1. Loader already reads skeleton JSON as parsed object (loader.ts:140). The
       raw `skeleton.fps` from the JSON maps onto `skeletonData.fps` by
       spine-core's SkeletonJson.js:73 if present. In SIMPLE_TEST it's absent →
       `skeletonData.fps` is `undefined` in our fixture.
    2. Plumb `editorFps = skeletonData.fps ?? 30` (30 is Spine's default per the
       spec) from loader/sampler through to the CLI. Reading `skeletonData.fps`
       FOR DISPLAY PURPOSES ONLY does NOT violate CLAUDE.md rule #1 — rule #1
       specifically bans using fps to drive SAMPLING.
    3. In sampler: change `frame = round(t * frameRate)` to `frame = round(t * editorFps)`.
       Remove the hardcoded 60 fallback (or keep only as last-resort default).
    4. Update the module-hygiene grep test `expect(src).not.toMatch(/skeleton\.fps/)`
       in sampler.spec.ts — it was always a misinterpretation of CLAUDE.md rule #1
       (which forbids fps for sampling, not for display plumbing). Replace with a
       tighter assertion: `expect(src).not.toMatch(/samplingHz.*fps|fps.*samplingHz/)`
       or similar — whatever proves fps doesn't influence sampling dt.

  FIX-4 (Loader exposes editorFps):
    Tiny change: add `editorFps: skeletonData.fps || 30` to LoadResult (or expose
    `skeletonData.fps` directly, same thing). Loader already parses it (it's on
    `skeletonData.fps` after readSkeletonData runs).

verification:
  - After fix, re-run CLI; verify each row matches user's ground truth exactly:
      CIRCLE 2.0 / PATH or SIMPLE_SCALE / f0
      SQUARE 1.5 / PATH or SIMPLE_SCALE / f0
      SQUARE2 0.46 / PATH / f20  (editor frames at fps=30)
      TRIANGLE 2.0 / PATH / f0   (user expected f0 — CHAIN_2 steps at t=0, propagates through the chain so TRIANGLE's bone reaches 2.0x scale at t=0 instantly)
  - Add numeric golden tests: for each of the 4 peak records, assert scale is
    within 1e-3 of the expected ground-truth value. This PREVENTS REGRESSION of
    the entire bug class.
  - Keep existing differential/plausibility tests (N1.4 differential still holds
    under new formula: doubling CHAIN_5 still produces a much larger mesh scale).
  - Confirm the 'same peak across PATH and SIMPLE_SCALE' invariant for CIRCLE
    and SQUARE with an explicit `peakPath.scale === peakScale.scale` assertion
    (or within 1e-9). This invariant is a structural property that protects
    against future state-bleed bugs.

files_changed:
  - src/core/bounds.ts (primary scale formula — ~30 LOC change)
  - src/core/sampler.ts (call site + editorFps plumbing — ~15 LOC change)
  - src/core/loader.ts (expose editorFps in LoadResult — ~3 LOC)
  - src/core/types.ts (add `editorFps: number` to LoadResult interface — ~2 LOC)
  - scripts/cli.ts (Frame column reads editorFps from load — ~2 LOC)
  - tests/core/sampler.spec.ts (tighten scale assertions from plausibility to numeric goldens; also relax skeleton.fps grep test — ~20 LOC)
  - tests/core/bounds.spec.ts (update computeScale contract tests — ~15 LOC)
