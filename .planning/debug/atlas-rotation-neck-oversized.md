---
slug: atlas-rotation-neck-oversized
status: resolved
trigger: 2026-05-19 — user-reported NECK.png renders oversized in atlas-source optimized export (rotation + 2px padding), correct in atlas-less
created: 2026-05-19
updated: 2026-05-19
resolved: 2026-05-19
---

# Debug Session: atlas-rotation-neck-oversized

## Trigger

<!-- DATA_START: user-supplied trigger description -->
i'm testing the export made at /Users/leo/Downloads/TEST from the fixture /Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/SKINS/JOKERMAN_SPINE_ROT.json

Screenshot1: is the animation preview of the optimized export (atlas). Notice the large neck of the character. This should not be happening. The texture in question is NECK.png across all skins.

Screenshot2: is the animation preview of the optimized export (atlas-less): The neck is in the right size and position. This is the correct display, nothing wrong here.

I used rotation and padding 2px in the optimise settings dialog. Investigate the root cause
<!-- DATA_END -->

## Symptoms

- **Expected**: The atlas-source optimized export should render NECK.png at the same correct size/position as the atlas-less optimized export (Screenshot2 — neck is anatomically correct, tucked under the head).
- **Actual**: In the atlas-source optimized export (Screenshot1), NECK.png renders grossly oversized — the character's neck balloons out far wider/taller than the head and shoulders. Reproduces across **all skins** (screenshot shows skin BEACHMAN, animation BLINK, frame 2). Rig bounds reported identically (1829 × 2382 u) in both screenshots, so the divergence is in the attachment's render scale / UV mapping, not the skeleton transform.
- **Error messages**: None. Pure visual rendering bug — no crash, no console error reported.
- **Timeline**: Surfaced while testing a fresh optimized export of `fixtures/SKINS/JOKERMAN_SPINE_ROT.json` (fixture name contains "ROT" → rotation-relevant rig). Optimize settings dialog had **rotation enabled** and **padding = 2px**. Atlas-less leg of the same export is correct.
- **Reproduction**:
  1. Load fixture `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/SKINS/JOKERMAN_SPINE_ROT.json`.
  2. Open Optimize Assets, enable **rotation**, set **padding = 2px**.
  3. Export to `/Users/leo/Downloads/TEST` (both atlas-source and atlas-less legs produced).
  4. Open the animation preview of the **atlas-source** optimized export → NECK is oversized.
  5. Open the animation preview of the **atlas-less** optimized export → NECK is correct.

## Divergence Context

- **atlas-less leg = CORRECT**, **atlas-source leg = WRONG**. This isolates the fault to the atlas-source-only path: atlas repack + atlas/JSON-rewrite, NOT the shared core sampler math (atlas-less reuses the same skeleton math and is fine).
- Optimize settings in play: **rotation = ON**, **padding = 2px**. Per project memory, atlas-pack rotation + whitespace options are **atlas-source-only**; atlas-less is unaffected by both → consistent with the observed divergence.
- Project memory `project_strict_loadermode_separation`: atlas-source and atlas-less are self-contained; `load.atlasPath` gates every read of the opposite artifact set. The bug must live in atlas-source-specific export code.
- Project memory `project_spine_4_2_atlas_json_precedence`: JSON width/height (skeleton-space) ÷ atlas originalWidth (bitmap-space) = runtime ratio; JSON is invariant under repack. A rotated region in the repacked atlas changes the atlas-side dims/orientation — if the rewritten atlas region (or the rewritten JSON attachment size) does not account for the 90° swap of width/height for a rotated region, the runtime ratio for NECK inflates → oversized render.
- Project memory `project_compute_export_dims_canonical_base` / `project_peak_anchored_invariants`: export-dim math must use canonical dims as the base and is canonical-relative; a rotation-induced W/H swap that bypasses the canonical correction is a prime suspect.

## Initial Hypotheses (untested)

1. **Rotated-region W/H swap not propagated to the rewritten atlas region or JSON attachment size for atlas-source export.** When NECK is packed rotated 90° in the optimized atlas, the new atlas entry's `size`/`xy`/`rotate` and/or the rewritten JSON attachment `width`/`height` keep pre-rotation orientation, so the runtime ratio (JSON dims ÷ atlas originalWidth) is computed against a swapped/wrong basis → NECK renders oversized. Atlas-less skips repack entirely → unaffected.
2. **Padding (2px) folded into the region's effective size on the rotated axis**, double-counted or applied to the wrong axis when the region is rotated, scaling NECK up. Would only manifest atlas-source (atlas-less has no atlas region rects).
3. **`originalWidth`/`originalHeight` (pre-strip / pre-pad) vs packed `width`/`height` mismatch specifically on rotated regions** in the atlas rewriter — the rotated region's "original" dims may be written swapped, so the JSON-vs-atlas precedence ratio (memory: source-confirmed) blows up for NECK only.
4. **NECK-specific geometry** (e.g., NECK.png is the region whose source aspect ratio makes a W/H swap most visually dramatic, or it is a mesh whose page-space UVs are not recomputed after rotation — cf. `project_runtime43_mesh_uv_pagespace`, though that was 4.3; verify the runtime tag of this fixture). Other regions may be subtly off too but NECK is the visible one.

## Current Focus

```yaml
hypothesis: RESOLVED — root cause confirmed and fixed (REPACK-12). The repack pipeline discarded the SOURCE atlas's strip-whitespace metadata; buildAtlasText emitted offsets:0,0,packedW,packedH, collapsing originalWidth onto the trimmed+resized size. Fix threads the source logical canvas + trim offsets through RepackInput/RepackedRegion, SCALED by the same per-axis factor the pixels were resized by, and emits them in buildAtlasText — preserving the source original→packed PROPORTION (and thus render size) across repack.
test: Reloaded BOTH the SOURCE fixture and the REPACK-12-rewritten export through the real loader; compared NECK origW/packW render invariant across all 7 skins.
expecting: SOURCE invariant preserved within ~1%. CONFIRMED — SOURCE 1.6146 vs fixed 1.6141 (Δ0.03%); 48/48 targeted + parity tests green; no type regression in changed files.
next_action: DONE — fix verified and committed atomically (bug fix only; no version/tag/push). NOTE: the originally-recorded acceptance "ratio==1.0 / originalWidth==1148" was UNSATISFIABLE for a downscaled export (the optimizer intentionally downscales NECK by effScale≈0.53); corrected to proportion-preservation, owner-approved. Do not relitigate.
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-19 — **Fixture runtime tag = Spine 4.2.43.** `fixtures/SKINS/JOKERMAN_SPINE_ROT.json` `skeleton.spine == "4.2.43"`. This is a 4.2 runtime. No 4.3-specific reasoning applies; `project_runtime43_mesh_uv_pagespace` is 4.3-only and is NOT relevant here. NECK is a `region` attachment (not a mesh) — Hypothesis 4's mesh-UV sub-theory eliminated.
- timestamp: 2026-05-19 — **JSON attachment dims are invariant under repack (as expected).** `AVATAR/NECK` attachment in BOTH source fixture and rewritten atlas-source export JSON: `{ "x":392.76, "y":-19.4, "rotation":-90, "width":1148, "height":1170 }` (identical, all skins, src line 688 / export line 688). The `"rotation":-90` here is the **attachment placement rotation** (skeleton-space authoring), NOT atlas-pack rotation — unchanged, not the fault. JSON side is clean → fault is on the atlas side. (Confirms `project_spine_4_2_atlas_json_precedence`: JSON invariant.)
- timestamp: 2026-05-19 — **SOURCE fixture atlas was Spine-exported WITH strip-whitespace.** `fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas` (new/4.3-style format, the optimizer INPUT), region `AVATAR/NECK`:
  - `bounds:3206,2201,711,783` → packed (whitespace-stripped) rect = 711×783 in page space
  - `offsets:229,190,1148,1170` → offsetX=229, offsetY=190, **originalW=1148, originalH=1170** (the logical/untrimmed source size — what the runtime-ratio formula uses)
  - `rotate:90`
  Identical for every skin's NECK (`BEACHMAN/NECK`, `JOKER/NECK`, `test/NECK`, …). So loading the *source* fixture renders NECK correctly: ratio = JSON 1148 / atlas.originalWidth 1148 = 1.0.
- timestamp: 2026-05-19 — **REWRITTEN atlas-source export DESTROYED the original-size metadata.** `/Users/leo/Downloads/TEST/JOKERMAN_SPINE_ROT.atlas`, region `AVATAR/NECK`:
  - `bounds:1239,1783,609,621`
  - `offsets:0,0,609,621`  ← offsetX/Y zeroed AND originalW/H collapsed to the TRIMMED 609×621
  - `rotate:true`
  The optimizer wrote the trimmed/optimized size as the original size. Same defect on every skin's NECK and (by code path) every strip-whitespace-trimmed region.
- timestamp: 2026-05-19 — **Atlas-less loose PNG actual pixel dims = 609×621.** `sips` on `/Users/leo/Downloads/TEST/images/{AVATAR,BEACHMAN,JOKER}/NECK.png` → all `pixelWidth:609 pixelHeight:621`. The optimized output bitmap IS the trimmed size; that is correct for atlas-less (synthetic-atlas identity mapping makes originalWidth == png-header == 609, self-consistent vs JSON authoring). The atlas-less leg never reads the `.atlas`.
- timestamp: 2026-05-19 — **Runtime-ratio impact computed.** Per `project_spine_4_2_atlas_json_precedence`: runtime ratio = JSON width ÷ atlas originalWidth.
  - CORRECT (source atlas / atlas-less): 1148 / 1148 = **1.0** → NECK at intended size.
  - WRONG (rewritten atlas-source): 1148 / 609 = **1.885×** → NECK inflated ~1.88× on both axes (621 vs 1170 ≈ 1.884 confirms isotropic), exactly matching the user's "grossly oversized neck" screenshot.
- timestamp: 2026-05-19 — **Code path traced — where the metadata is lost.**
  - `src/main/repack-worker.ts:281-297`: `loadRegionSource(row)` extracts the trimmed rect from the page (atlas-source fallback), resizes, then `const meta = await sharp(resized).metadata(); packW = meta.width; packH = meta.height;` → packW/packH = **trimmed/optimized dims (609×621)**.
  - `src/core/repack.ts:46-50`: `RepackInput = { regionName, packW, packH }` — **no field for original (untrimmed) size or trim offsets**. The 1148×1170 + offset 229,190 are dropped here.
  - `src/core/repack.ts:174-175`: `RepackedRegion.origW = inp.packW; origH = inp.packH` — "PRE-rotation canonical" = the packed dims, NOT logical original.
  - `src/main/atlas-writer.ts:112,120`: emits `bounds:${x},${y},${origW},${origH}` and **`offsets:0,0,${origW},${origH}`** unconditionally. The module doc (lines 38-46) explicitly assumes *"Repack does NOT apply strip-whitespace, so offsetX = offsetY = 0 and originalW/H == bounds.W/H == origW/origH"* — **this assumption is FALSE when the SOURCE atlas was strip-whitespace-exported** (Spine trimmed it before our optimizer ever ran).
  - `src/core/loader.ts:781-794` & `:873-881`: atlas-source mode sets `actualSourceW = region.originalWidth`; `hasExplicitOrig = origW !== packedW` → `false` (both 609) → ratio computed against 609. This is the consumer that inflates the render.

## Eliminated

- **Hypothesis 1 (rotated W/H swap not propagated) — eliminated as the *primary* cause.** `atlas-writer.ts` handles rotation correctly: it emits pre-rotation canonical `bounds`/`offsets` plus a `rotate:true` flag, and the spine-core parser derives post-rotation UVs from the flag (REPACK-06, verified 2026-05-15). The rotated NECK's `rotate:true` line is present and correct in the export. Rotation is NOT mis-propagated. (The true fault is orthogonal: original-size loss, which would occur for a strip-whitespace-trimmed region even with rotation OFF.)
- **Hypothesis 2 (2px padding folded into region size on rotated axis) — eliminated.** `buildAtlasText` writes `origW/origH` (not `w/h`) into `bounds`/`offsets`; packer padding affects only `x/y` placement and the page extent, never the emitted region dims. Padding=2px is not in the inflation path. The inflation factor (1.885×) exactly equals the source trim ratio (1148/609), not anything padding-derived.
- **Hypothesis 4 (NECK-specific mesh/UV geometry) — eliminated.** NECK is a `region` attachment, fixture is Spine 4.2.43, no mesh page-space-UV issue. NECK is merely the most *visible* instance because its source trim ratio (1148→609 ≈ 1.88×) is the largest in the rig; every strip-whitespace-trimmed region is oversized by its own trim factor (e.g. BODY `offsets:...,1942,994` vs trimmed dims, FACE, LEGS — all subtly oversized too, NECK is just the egregious one).

## Resolution

**root_cause**: The atlas-source repack pipeline assumes the source atlas is NOT strip-whitespace-trimmed. `RepackInput`/`RepackedRegion` carry only the *packed/trimmed* dims (`packW`/`packH`, read back from sharp metadata of the resized region), with **no field for the source atlas's logical original size or trim offsets**. `buildAtlasText` then unconditionally emits `offsets:0,0,packedW,packedH`, overwriting `originalWidth/Height` with the trimmed size. The fixture's source atlas WAS Spine-exported with strip-whitespace (NECK: `offsets:229,190,1148,1170`, packed `711×783`), so on reload of the optimized atlas-source export, `loader.ts` reads `region.originalWidth = 609` instead of `1148`, and the runtime ratio (JSON dims ÷ atlas originalWidth, per `project_spine_4_2_atlas_json_precedence`) inflates to 1148/609 ≈ 1.885× → NECK renders ~1.88× oversized across all skins. The atlas-less leg is correct because it never reads the `.atlas`; its synthetic-atlas path builds a self-consistent identity mapping from the loose PNG's IHDR dims (`originalWidth == png-header == 609`), which resolves correctly against the JSON's authoring intent.

**fix** (REPACK-12, applied): Thread the source atlas's logical canvas size + trim offsets through the repack pipeline, SCALED by the same per-axis factor the trimmed pixels were resized by, so `buildAtlasText` emits `offsets:scaledOffsetX,scaledOffsetY,scaledOrigW,scaledOrigH` — preserving the source's original→packed PROPORTION (the quantity the runtime uses to derive render size) rather than collapsing `originalWidth` onto the trimmed+resized size. Specifically: `RepackInput` gains optional `srcOrigW/srcOrigH/srcOffsetX/srcOffsetY`; `RepackedRegion` gains `origCanvasW/origCanvasH/offsetX/offsetY` (defaulting to packed dims + 0 offsets → byte-identical pre-fix line when the source had no strip-whitespace); `repack-worker.ts` adds `scaleSourceMeta(atlasSource, packW, packH)` (sx=packW/sourceCanvasW, sy=packH/sourceCanvasH on canonical-orientation trimmed dims) populated **only when `row.atlasSource` is present** (atlas-less path provably untouched — strict loaderMode separation); `atlas-writer.ts` emits the carried offsets (`bounds:` line UNCHANGED → REPACK-06 rotation byte-baseline preserved).

**acceptance_criterion_correction**: The originally-recorded acceptance ("rewritten `.atlas` NECK `offsets` originalW/H == source 1148×1170; reload ratio == 1.0") is MATHEMATICALLY UNSATISFIABLE for a downscaled export. "Optimize Assets" intentionally downscales NECK by `effScale ≈ 0.53` (packed 711×783 → 609×621; logical 1148×1170 → 983×928), so `originalWidth` cannot remain 1148 against 609-px packed bytes while staying internally consistent. The "ratio == 1.0" framing only ever held for the un-downscaled SOURCE atlas. The correct, **owner-approved** invariant is original→packed PROPORTION preservation (= render-size preservation). Do not relitigate toward "restore originalWidth to 1148".

**verification** (owner-approved acceptance): Reloaded BOTH the SOURCE fixture and the REPACK-12-rewritten export through the **real loader** and compared NECK's render-size invariant `originalWidth/packedWidth` across **all 7 skins**: SOURCE (correct ref) 711×783 / 1148×1170 → origW/packW **1.6146**, origH/packH **1.4943**; REPACK-12 rewritten 609×621 / 983×928 → **1.6141** (Δ0.0005, 0.03%) / **1.4944** (Δ0.0001) — invariant preserved sub-pixel across every skin ⇒ NECK renders at the SAME relative size as the correct SOURCE / atlas-less leg. REPACK-12 emits `offsets:196,151,983,928` for NECK (was the broken `offsets:0,0,609,621`). Back-compat proven: non-strip-whitespace regions still emit byte-identical `offsets:0,0,origW,origH` (all pre-existing atlas-writer tests + REPACK-06 rotation byte-baseline green). Independent re-verification gate (orchestrator, post-checkpoint): targeted suite — `tests/main/atlas-writer.spec.ts`, `tests/core/repack.spec.ts`, `tests/main/repack-worker.spec.ts`, `tests/main/repack.parity.spec.ts`, `tests/main/repack.loose-parity.spec.ts` → **48/48 passed** (incl. +2 new strip-whitespace round-trip regression tests); none of the 3 changed source files appear in `typecheck:node` errors → no type regression. The single full-suite failure (`tests/runtime43/slider43-closedform.spec.ts` SC#2) was reproduced on pristine `main` with zero of this fix's changes — a stale Phase-46 git-scope assertion tripped by the already-committed loader fix `e7db8fe` (asserts on `errors.ts`/`loader.ts`, which this fix does not touch) — proven pre-existing + unrelated.

**files_changed** (applied, committed atomically): `src/core/repack.ts` (RepackInput optional srcOrig*/srcOffset* + RepackedRegion origCanvasW/H/offsetX/Y carry-through with packed-dim defaults), `src/main/repack-worker.ts` (scaleSourceMeta + populate from row.atlasSource at both the resize and passthrough loops), `src/main/atlas-writer.ts` (emit carried offsets line; bounds line unchanged), `tests/main/atlas-writer.spec.ts` (+2 strip-whitespace metadata round-trip regression tests + updated expectations). No loader-side change was needed (atlasSource metadata already available on `row.atlasSource`). Scope: bug fix only — no version bump, no tag, no push, no STATE/milestone change (v1.6 remains HELD; this removes a UAT blocker).
