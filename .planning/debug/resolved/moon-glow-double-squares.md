---
slug: moon-glow-double-squares
status: resolved
trigger: "Testing fixtures/Chicken/SYMBOLS.json in the app — strange double squares around the moon in the Animation Viewer. Suspected premultiply-alpha or blend-mode rendering error. Spine editor renders it cleanly. Textures: fixtures/Chicken/images/MOON/MINOR"
created: 2026-05-23
updated: 2026-05-23
---

# Debug Session: moon-glow-double-squares

## Symptoms

> NOTE TO INVESTIGATOR: The user attached two screenshots that you CANNOT see.
> They are described in full below — treat these descriptions as the ground truth
> of the visual symptom.

### Expected behavior (Spine editor — screenshot 2, "MINOR" skin)
- Clean blue moon: a soft blue radial **glow ring** around a textured blue moon
  sphere, with gold "MINOR" lettering across it.
- On the checkered transparency background, the glow **fades smoothly to fully
  transparent**. There are NO visible rectangular shapes / boxes anywhere — the
  soft glow has no hard edges.

### Actual behavior (the app's Animation Viewer — screenshot 1, "MEGA" skin)
- Animation: `13/IDLE`, Skin: `MEGA`, frame `f 13`, Zoom 100%, Rig bounds 402×402.
- Purple moon with a bright magenta glowing ring and gold/purple "MEGA" lettering.
- **THE BUG:** behind/around the moon there are **two overlapping, rotated,
  semi-transparent SQUARE quads** — clearly visible grayish-blue translucent
  rectangles, offset/rotated relative to each other so they form a star/octagon
  outline behind the circular glow. These are the **rectangular texture-quad
  bounds of the glow attachment(s) becoming visible** — the part of the texture
  that should be fully transparent is instead rendering as a visible translucent box.

### Suspected cause (user's hypothesis)
Premultiplied-alpha mismatch OR per-slot blend-mode not being applied during
rendering. User explicitly flagged "premultiply alpha or blending mode issue."

## Reproduction
1. Launch the app (`npm run dev`).
2. Load `fixtures/Chicken/SYMBOLS.json` (Spine **4.2.43**, atlas-source mode:
   `SYMBOLS.atlas` + `SYMBOLS*.png` present).
3. Open the Animation Viewer, select animation `13/IDLE`, skin `MEGA`.
4. Observe the double translucent squares around the moon glow.

## Seed evidence (gathered by orchestrator before spawning — verify, don't trust blindly)

- **SYMBOLS.json is `"spine": "4.2.43"`** → routes through the **4.2-leg** of the
  dual-runtime viewer (spine-player-42 / spine-webgl-42 per project memory
  `project_phase47_viewer_single_runtime_design_gap`). The frozen viewer modal
  is `AnimationPlayerModal42.tsx` (see memory `project_42leg_byteverbatim_broken_frame_readout`).
- **Atlas header declares `pma:true`** (`fixtures/Chicken/SYMBOLS.atlas` line 4).
  So the packed PNG is premultiplied. The WebGL renderer MUST be told
  `premultipliedAlpha = true` for these pages, or transparent edges show as boxes.
- **The moon symbol uses non-normal blend modes.** Relevant slots in SYMBOLS.json:
  - `10_MOON` → **blend: additive**
  - `10_MOON2` → blend: normal
  - `MOON-GLOW-NORMAL` → blend: normal
  - `MOON-VS2-MOON_BASE` → blend: normal
  - The skeleton has ~75 slots with additive/screen/multiply blend overall.
- **Leading hypothesis (H1): the viewer is NOT applying per-slot blendMode**, so
  additive glow quads (which should add ~zero in their transparent regions) are
  drawn with plain `normal` alpha blending → their rectangular bounds appear as
  translucent boxes. The two squares = two stacked glow attachments.
- **Alt hypothesis (H2): PMA mismatch** — atlas is `pma:true` but the texture is
  uploaded / shader-sampled as straight alpha (or premultipliedAlpha flag not
  set on the spine renderer), producing visible quad edges. PMA mismatch usually
  shows as dark fringing/halos rather than full solid boxes, so H1 is favored —
  but BOTH may compound. Confirm which.
- The user pointed at `fixtures/Chicken/images/MOON/MINOR/` containing
  `BLUE.png`, `BLUE_GLOW.png`, `MINOR.png` — `BLUE_GLOW` is the soft glow layer.
  NOTE: app is in **atlas-source mode** here (SYMBOLS.atlas exists), so loose
  images under images/ may not be the bytes actually rendered — verify loaderMode.

## Investigation focus
The bug is in the **Animation Viewer render path**, NOT in core/ math (this is a
pure rendering artifact; the math/sizing pipeline is unaffected). Look at how the
viewer constructs its spine renderer:
- Where premultipliedAlpha is (or isn't) set when creating the
  SkeletonRenderer / atlas TextureAtlas / GL texture upload.
- Whether `slot.data.blendMode` (additive/screen/multiply) is honored by the
  renderer, or whether the frozen modal's render loop only does normal blending.
- Compare the 4.2-leg viewer wiring against a known-correct spine-webgl example.

## Evidence

- timestamp: 2026-05-23 (orchestrator recon)
  observation: atlas pma:true; 10_MOON slot blend=additive; SYMBOLS.json spine 4.2.43; ~75 non-normal-blend slots; viewer is 4.2-leg frozen modal.

- timestamp: 2026-05-23 (investigation — H1 per-slot blendMode ELIMINATED)
  observation: spine-webgl-42 `SkeletonRenderer.js:155-158` DOES read `slot.data.blendMode`
  and calls `batcher.setBlendMode(blendMode, premultipliedAlpha)` on every slot whose
  blend differs from the running mode. Per-slot blend is fully honored. H1 is false —
  the viewer is NOT ignoring blendMode. The "double squares" are not from additive quads
  being drawn as normal blend.

- timestamp: 2026-05-23 (investigation — H2 CONFIRMED as root cause)
  observation: `AnimationPlayerModal42.tsx:508-523` hardcodes `premultipliedAlpha: false`
  in the SpinePlayerConfig, with a comment asserting "Chrome/Electron's PNG decoder
  UN-premultiplies during the Image-element decode path, so the in-memory texture is
  always straight alpha." THAT COMMENT IS FACTUALLY WRONG.

- timestamp: 2026-05-23 (investigation — texture upload path source-read)
  observation: spine-webgl-42 `GLTexture.js:86-88`:
    `if (GLTexture.DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL) gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);`
    `gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this._image);`
  `DISABLE_UNPACK_PREMULTIPLIED_ALPHA_WEBGL` defaults to `false`, so the `pixelStorei`
  line NEVER executes, and WebGL's `UNPACK_PREMULTIPLY_ALPHA_WEBGL` stays at its DEFAULT
  of `false`. Net: WebGL does NOT premultiply on upload — the PNG bytes are uploaded
  VERBATIM. Whatever encoding the PNG has ON DISK is exactly what lands in the GPU texture.
  The modal comment's claim that the decoder un-premultiplies is the inverted/incorrect
  reading. (App/runtime never set DISABLE_UNPACK anywhere — grep confirms.)

- timestamp: 2026-05-23 (investigation — on-disk encoding measured, sharp raw RGBA)
  observation: `fixtures/Chicken/SYMBOLS.png` (4096×4096, all 13 atlas pages `pma:true`)
  is PREMULTIPLIED on disk: of 86,887 sampled fully-transparent pixels (alpha<8), max
  RGB seen is 7 (~0); only 4% have RGB>4 (filter dithering). A straight-alpha PNG keeps
  original color in transparent regions (RGB up to 255). Contrast `SIMPLE_TEST.png`
  (atlas has NO `pma` flag): transparent pixels retain RGB up to 199, 42% have RGB>4 →
  STRAIGHT alpha. So the two fixtures have OPPOSITE encodings.

- timestamp: 2026-05-23 (investigation — numerical artifact proof)
  observation: spine-webgl-42 `PolygonBatcher.js:81-89` blendModesGL[normal=0] =
  {srcRgb:SRC_ALPHA, srcRgbPma:ONE, dstRgb:ONE_MINUS_SRC_ALPHA}; [additive=1] =
  {srcRgb:SRC_ALPHA, srcRgbPma:ONE, dstRgb:ONE}. `setBlendMode` picks
  `srcRgbPma` when premultipliedAlpha=true, else `srcRgb`. SkeletonRenderer.js:136-140
  also premultiplies the vertex color by alpha ONLY when premultipliedAlpha=true.
  For a PMA texture rendered with flag=false the shader multiplies the already-premultiplied
  texel by srcAlpha a SECOND time AND the dst term is no longer matched to the texel
  encoding. Simulated faint-glow texel (straight color 1.0 @ alpha 0.15 over #232732 bg):
    editor-correct visible channel = 0.3166
    FIXED  (flag=true,  PMA tex)   = 0.3166  ← exact match to editor (normal AND additive)
    BUGGY  (flag=false, PMA tex)   = 0.1891  ← divergent (double-darken / quad wash)
  The mismatch leaves a faint, nonzero contribution across the WHOLE rectangular quad
  footprint of each glow attachment = the visible translucent "boxes". Two stacked/rotated
  glow attachments → the two overlapping squares the user sees.

- timestamp: 2026-05-23 (investigation — why flag=true once broke SIMPLE_TEST = the trap)
  observation: The modal comment "premultipliedAlpha:true caused a white ring on
  SIMPLE_TEST" was a REAL observation — but SIMPLE_TEST is a STRAIGHT-alpha atlas, so
  flag=false is correct for IT. The author over-generalized one fixture's correct setting
  into a hardcoded constant. The correct value is per-atlas: it must track the atlas
  `pma` flag. Hardcoding either literal breaks the other encoding. NOTE: spine-player's
  OWN default is `premultipliedAlpha = true` (Player.js:14071
  `if (config.premultipliedAlpha === void 0) config.premultipliedAlpha = true`); the
  modal's explicit `false` is the deliberate override that breaks pma:true atlases.

- timestamp: 2026-05-23 (investigation — fix lever confirmed for 4.2 leg)
  observation: 4.2 Player.js:14586 `renderer.drawSkeleton(skeleton, config.premultipliedAlpha)`
  — the config key is live and honored. Setting `config.premultipliedAlpha` to the atlas
  pma flag fully corrects the 4.2 leg. spine-player loads + parses the atlas itself, but
  the renderer flag is NOT auto-derived from it in 4.2 (it comes from config), so we must
  supply it.

- timestamp: 2026-05-23 (investigation — 4.3 leg has a PARALLEL but DEEPER latent bug)
  observation: 4.3 differs structurally. spine-core@4.3 `TextureAtlas.js:55-56` DOES parse
  `page.pma` from the atlas text, and `GLTexture.js:88` uses it:
  `gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL, !this.pma)`. BUT the eager
  `AssetManagerBase.loadTextureAtlas` (185-230) calls `loadTexture` per page WITHOUT
  seeding `texturePmaInfo` first, so `loadTexture` (144) reads `pma=undefined` →
  `new GLTexture(ctx, image, undefined)` → `!undefined === true` → WebGL PREMULTIPLIES an
  already-premultiplied PNG = DOUBLE-premultiply (worse than the 4.2 case). The 4.3
  `SpinePlayerConfig` no longer exposes `premultipliedAlpha` (removed in 4.3.0), and the
  4.3 batcher `setBlendMode(blendMode)` auto-derives PMA from the bound texture's `.pma` —
  so the fix lever for 4.3 is the TEXTURE LOADER pma, not a config key. The 4.3 leg has
  NO live repro here (SYMBOLS.json is 4.2.43 → routes to the 4.2 leg). Treat the 4.3 fix
  as a SEPARATE follow-up (different mechanism, no current repro, needs a texturePmaInfo /
  loader-pma workaround on the frozen 4.3 modal). Documented so it is not lost.

## Eliminated

- **H1 (per-slot blendMode not applied)** — FALSIFIED. spine-webgl-42 SkeletonRenderer
  reads `slot.data.blendMode` and routes it to `batcher.setBlendMode` per slot
  (SkeletonRenderer.js:155-158). Blend modes ARE honored. The artifact is not caused by
  additive quads being drawn with normal blending.
- **"Chrome/Electron decoder un-premultiplies" (the in-code comment's premise)** —
  FALSIFIED by GLTexture.js source: UNPACK_PREMULTIPLY_ALPHA_WEBGL stays at WebGL default
  false; texImage2D uploads PNG bytes verbatim; on-disk SYMBOLS.png is measurably
  premultiplied → GPU texture is premultiplied.
- **Bug is in core/ math** — out of scope and unaffected; this is a pure render-config bug.

## Current Focus

hypothesis: ROOT CAUSE CONFIRMED — the Animation Viewer hardcodes `premultipliedAlpha:false`
(4.2 leg) instead of deriving the flag from the atlas `pma` declaration. SYMBOLS.atlas is
`pma:true` and SYMBOLS.png is premultiplied on disk; the WebGL upload preserves the
premultiplied bytes; rendering them with the straight-alpha blend pipeline (flag=false)
double-darkens and leaves a faint wash across each glow attachment's rectangular quad
footprint = the visible "double squares".
test: (done) source-read both blend + upload paths; measured on-disk PNG encoding;
numerically reproduced the divergence and showed flag=true exactly matches the editor;
confirmed the live config lever (Player.js:14586).
expecting: (met) flag must track the atlas pma flag, not be a hardcoded literal.
next_action: apply the FIX below (4.2 leg) and re-verify visually; file the 4.3-leg parallel
defect as a follow-up.
reasoning_checkpoint:
tdd_checkpoint:

## PART 2 — ATLAS-LESS squares (separate root cause, found 2026-05-23 post-fix UAT)

status: fix_applied (Option A — GPU-upload premultiply; user-chosen 2026-05-23; awaiting visual UAT)

FIX APPLIED (Option A, AnimationPlayerModal42.tsx, 3 edits):
  1. compute `isAtlasLess = summary.atlasPath === null || loaderMode === 'atlas-less'` once
     in the load effect (mirrors buildAssetFeed:363).
  2. `premultipliedAlpha: isAtlasLess ? true : props.summary.premultipliedAlpha` — atlas-less
     textures become premultiplied (see #3) so the flag is true; atlas-source keeps the atlas
     pma flag (PART 1).
  3. right after `new SpinePlayer(...)`, for atlas-less only:
     `player.context.gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)`. The ctor's
     synchronous initialize() (Player.js:97) creates the GL context and only STARTS async
     texImage2D, so this lands before every upload → WebGL premultiplies the loose straight
     images on upload (exactly what the Spine editor does). Atlas-source untouched (pages are
     already premult on disk; double-premult would be wrong).
GATES green 2026-05-23: typecheck:web + typecheck:node CLEAN; `npm run test` 152 files /
  1540 passed / 11 skipped / 2 todo.
PENDING: visual UAT — atlas-less squares GONE on BAR (3/PRIZE) + moon (MINOR); atlas-source
  still clean (no regression); SIMPLE_TEST (straight atlas-source) no white ring.

(historical — root cause / options below)

After the PART 1 fix, atlas MODE is CLEAN (user-confirmed). But ATLAS-LESS still shows
the squares (worse on `screen`/`multiply` slots, e.g. fixtures/Chicken/images/3/BAR.png).
Console proves the modal renders atlas-less with `computedPremultipliedAlpha: false`,
`isSyntheticFeed: true` — so PART 1's flag is innocent here (and was a no-op for atlas-less).

ROOT CAUSE (proven by headless composite + spine-webgl source):
- The atlas-less loose images were extracted by the Spine atlas UNPACKER with **Alpha: Auto**,
  which UN-premultiplies a pma:true atlas. Un-premultiplying divides color by tiny alpha →
  formerly-transparent padding becomes **high color at very low alpha** (measured on BAR.png:
  maxRGB@alpha=0 is 0 (clean) but maxRGB@alpha1-7 is 255; ~19k px at alpha 8-60 carry avg
  color 242). The images are genuinely STRAIGHT (verified) and composite CLEAN under NORMAL
  blend (`out=src*a+bg*(1-a)`, frame deviation ~1.2).
- BUT Spine's blend-mode GL table (spine-webgl-42 PolygonBatcher.js:81-85) defines
  **screen** = `{srcRgb: ONE, srcRgbPma: ONE, dst: ONE_MINUS_SRC_COLOR}` and
  **multiply** = `{srcRgb: DST_COLOR, ...}` — the source color factor is **NOT alpha-gated**
  (and screen is `ONE` in BOTH pma and non-pma columns, so `premultipliedAlpha` can't fix it).
  These modes are MATHEMATICALLY DESIGNED FOR PREMULTIPLIED TEXTURES (where transparent==rgb 0).
  Feeding a straight texture (high color in transparent regions) makes screen/multiply FLOOD
  the whole quad with that color → the bright square. (BAR slot blend = `screen`; ~75 slots
  use additive/screen/multiply.) Headless screen-blend sim reproduced the exact flood for a
  straight tex and was CLEAN for a premultiplied tex — matching the editor.
- The Spine EDITOR renders the same loose images cleanly because it PREMULTIPLIES straight
  images on load. spine-player (our viewer) uploads them VERBATIM (UNPACK_PREMULTIPLY_ALPHA_WEBGL
  stays false; GLTexture.js:86-87 only ever sets it to false, never true) → straight on GPU →
  screen/multiply flood. The moon's fainter square is the NORMAL-blend version of the same
  lossy halo (milder; normal IS alpha-gated).

This is a genuine atlas-less limitation: **Spine's PMA-based blend modes require premultiplied
textures.** Atlas-less is the PRIMARY workflow (project_atlas_less_primary_workflow), so it
should match the editor by premultiplying loose textures before/at GPU upload.

FIX OPTIONS (pick one — see chat):
  A. GPU-upload premultiply (cheap, matches editor): for atlas-less, right after
     `new SpinePlayer(...)` set `player.context.gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL,
     true)` (constructor creates context @Player.js:195 BEFORE async texImage2D @216, so timing
     works) AND set `config.premultipliedAlpha = true` for atlas-less. Touches the frozen modal's
     GL setup; timing-sensitive on spine-player internals.
  B. Main-side premultiply: premultiply each region PNG in `getViewerAssetFeed` (sharp raw),
     serve premultiplied bytes + synthetic atlas `pma:true` + config true. Robust, no GL/timing
     fragility, but premultiplies N images per viewer-open (305 here) — needs perf care/caching.
  C. Accept as known limitation + document (atlas-less needs PMA-exported images).

## Resolution

root_cause: The Animation Viewer renders with a hardcoded straight-alpha pipeline
(`premultipliedAlpha: false` in the 4.2-leg `AnimationPlayerModal42.tsx:523`), ignoring the
atlas `pma` flag. `fixtures/Chicken/SYMBOLS.atlas` declares `pma:true` and `SYMBOLS.png`
is genuinely premultiplied on disk; spine-webgl uploads the PNG verbatim
(UNPACK_PREMULTIPLY_ALPHA_WEBGL stays at its WebGL default of false), so the GPU texture
stays premultiplied. Blending a premultiplied texture through the straight-alpha pipeline
double-applies source alpha and mismatches the dst factor, leaving a faint nonzero
contribution across each glow attachment's full rectangular quad — the visible "double
squares". The bug is mis-attributable: the in-code comment claims the OS decoder
un-premultiplies (it does not) and the value was over-generalized from SIMPLE_TEST, which
is a straight-alpha atlas where false happens to be correct. Per-slot blendMode (H1) is a
red herring — it is correctly honored. The 4.3 leg carries a PARALLEL, deeper latent
variant (double-premultiply via an unseeded texturePmaInfo) with no live repro — separate
follow-up.

fix: APPLIED 2026-05-23 (4.2 leg; the live repro). Derives the flag from the atlas `pma`
declaration at load time and threads it to the viewer config. Edits made (5 files):
  - src/shared/types.ts — added required `premultipliedAlpha: boolean` to SkeletonSummary
    (sibling to runtimeTag, documented).
  - src/main/summary.ts — reads `load.atlasPath` text (when non-null) and sets
    `premultipliedAlpha` = any line normalizing to `pma:true` (whitespace-robust); `false`
    on atlas-less / read failure / no pma line. Emitted next to `runtimeTag`.
  - src/renderer/src/modals/AnimationPlayerModal42.tsx — replaced the wrong "decoder
    un-premultiplies" comment + hardcoded `false` with
    `props.summary.atlasPath !== null && props.loaderMode !== 'atlas-less' &&
    props.summary.premultipliedAlpha`. The `!isAtlasLess` guard (mirrors buildAssetFeed)
    forces `false` whenever the SYNTHESIZED (always-straight) atlas is actually rendered —
    confirmed src/core/synthetic-atlas.ts emits NO pma line — so toggling a pma:true project
    to atlas-less can't reintroduce the artifact.
  - tests/core/documentation.spec.ts — added the now-required field to the drift-helper stub.
  - tests/main/summary.spec.ts — NEW regression block (4 tests): straight atlas→false,
    pma:true atlas→true, atlas-less→false, structuredClone-safe boolean.
GATES (green 2026-05-23): typecheck:node CLEAN, typecheck:web CLEAN, full `npm run test`
  152 files / 1536 passed / 11 skipped (pre-existing MixBlend import skips) / 2 todo.
PENDING: VISUAL UAT by user (GPU render can't be verified headlessly) — load SYMBOLS.json
  (4.2.43) MEGA skin → squares GONE; load SIMPLE_TEST → no white-ring regression.
ORIGINAL 3-edit plan (for reference):
  1. src/shared/types.ts — add `premultipliedAlpha: boolean` to `SkeletonSummary`
     (sibling to `runtimeTag`; structuredClone-safe; documents the render contract).
  2. src/main/summary.ts — at the existing sibling-atlas fs probe (~lines 536-541, where
     `hasAtlasFile` is computed), if the `.atlas` file exists read its text and set
     `premultipliedAlpha` = the first `pma:` line equals `true`. Default `false` when no
     atlas file / no `pma` line / atlas-less (synth atlas is straight). Emit the field in
     the returned summary (~line 559, next to `runtimeTag: rt.tag`). This is the Layer-3
     I/O layer (already does fs reads here) — no core/ change.
  3. src/renderer/src/modals/AnimationPlayerModal42.tsx:523 — replace
     `premultipliedAlpha: false,` with `premultipliedAlpha: props.summary.premultipliedAlpha,`
     and replace the now-incorrect comment (lines 514-522) with the true mechanism
     (the GPU texture matches the on-disk PNG encoding; flag must track atlas pma).
VERIFY: `npm run test` + typecheck:web/node; then VISUAL UAT — load SYMBOLS.json (4.2.43),
  Animation Viewer, MEGA skin → squares GONE; AND load SIMPLE_TEST (straight atlas) → no
  white-ring regression (it stays flag=false because its atlas omits `pma`). Per memory
  `feedback_layout_bugs_request_screenshots_early` / `feedback_uat_opened_is_not_rendered`,
  confirm the actual RENDERED end-state via screenshot, not a load proxy.
FOLLOW-UP (separate, no live repro): 4.3 leg double-premultiply — needs a loader-pma /
  texturePmaInfo workaround on the frozen `AnimationPlayerModal.tsx`; will surface on any
  4.3 `pma:true` atlas. File as its own debug/issue.
NOTE: the new committed-fixture `fixtures/Chicken/` (json+atlas, no PNG per
  `project_rigs_committable_json_atlas_only_no_png`) must co-extend the SAFE-01 denylist
  (`SAFE01_EXCLUDED_PREFIXES` in tests/safe01/discover-fixtures.ts) per memory
  `feedback_new_committed_fixtures_need_safe01_denylist` — but note SYMBOLS.png IS present
  in the working tree here (4096² packed atlas), so confirm what is actually git-tracked
  before committing.

specialist_hint: react
