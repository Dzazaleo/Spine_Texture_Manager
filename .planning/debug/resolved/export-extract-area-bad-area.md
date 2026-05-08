---
slug: export-extract-area-bad-area
status: resolved
trigger: 2026-05-08 — user-reported export failures with sharp "extract_area: bad extract area" error on small/strip-whitespace atlas regions
created: 2026-05-08
updated: 2026-05-08
resolved: 2026-05-08
---

## Resolution Summary

**Fix applied 2026-05-08.** Three code files + six test fixture/literal updates + two new regression tests:

- `src/core/types.ts` + `src/shared/types.ts` — atlasSources Map value type and 5 inline `atlasSource` shapes gained `packW`, `packH`, `offsetX`, `offsetY`.
- `src/core/loader.ts:580-625` — both branches (atlas-less + canonical) populate the four new fields. Atlas-less defaults to `packW=w, packH=h, offsetX=offsetY=0`. Canonical reads `region.width/height/offsetX/offsetY` from spine-core.
- `src/main/image-worker.ts:273-292` (passthrough atlas-extract) — extract trimmed rect, conditionally extend back to orig canvas.
- `src/main/image-worker.ts:484-545` (resize-row atlas-extract) — same, but materialize the extend output to a Buffer first because sharp's pipeline runs `extend` AFTER `resize` regardless of chain order. Without the round-trip the output is `(resize_target + 2 * pad)`, not `resize_target`.
- `src/renderer/src/modals/AtlasPreviewModal.tsx:541-573` — drawImage uses trimmed src rect (`a.x, a.y, a.packW, a.packH`) + offset dst position (`region.x + offsetX*scaleX`, `region.y + (h - offsetY - packH)*scaleY`). For non-Strip-Whitespace regions all four new fields collapse to identity → byte-identical to pre-fix behaviour.
- 5 existing test literals updated with new fields (Jokerman/non-SW: `packW=w, packH=h, offsets=0`).
- `tests/core/loader-strip-whitespace.spec.ts` (new, 2 tests): locks loader behaviour for SW fixture + atlas-less defaults.
- `tests/main/image-worker.strip-whitespace.spec.ts` (new, 2 tests): resize branch (96×96) + passthrough branch (orig 500×500 with corner-transparent / center-opaque pixel checks).

**Test result:** `npx vitest run` → 967 passed (was 962 before fix) / 3 skipped / 2 todo / 0 failures.

**Memory note updated:** `project_atlas_pack_options_atlas_source_only.md` now correctly states SW is fully handled in BOTH bone-math and export paths, with file references and the latent-since-Phase-6 history noted.

**One manual UAT check the user should run:**
1. Open `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` → Optimize Assets → all 91 regions should succeed (was 86/91).
2. Open `fixtures/spine_stripWS/EXPORT/skeleton.json` → Optimize Assets → 1/1 should succeed; output PNG should be 96×96 with the red square correctly centered.
3. Atlas Preview on the SW fixture → red square renders centered in its tile, not top-left aligned.

The "silent failure" UI behaviour on skeleton.json (no per-row error label) is intentional — `OptimizeDialog.tsx:770` gates error text on click-to-expand. Falsified during diagnosis. Auto-expand-on-error could be a separate UX nicety but is outside this fix.



# Debug Session: export-extract-area-bad-area

## Trigger

<!-- DATA_START: user-supplied trigger description -->
Some images are failing to be exported with error "extract_area: bad extract area" (see screenshot 1). This happens in `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` — 5 of 91 images fail; visible failures: `images/L_EYE_WHITE.png` (196×140 → 40×29) and `images/L_EYE.png` (94×86 → 20×18).

Also happens with the only image in `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/spine_stripWS/EXPORT/skeleton.json` — `images/square.png` (500×500 → 96×96) — but in this case the row does NOT show the "extract_area: bad extract area" message; it just fails (0 of 1 succeeded, no error label rendered next to the row — see screenshot 3). Only the warning glyph + "1 failed in 0.0s" tally indicates the failure.

Possibly-related observation in screenshot 2: the single image in `skeleton.json` is a 500×500 PNG that was exported from Spine with **Strip Whitespace** turned ON. The actual opaque pixels are ~100×100 centred in the 500×500 transparent canvas. However, in Atlas Preview, the red square is **NOT centred** — it is aligned to the top-left corner of the page tile.
<!-- DATA_END -->

## Symptoms

- **Expected**:
  1. All atlas regions export successfully — including small regions and regions whose source PNG was authored with Strip Whitespace (Spine packs these as a small opaque rect inside a larger transparent PNG; the .atlas file records the offset + original size in the `offsets` / `orig` fields).
  2. When export fails, the failure row should always render the underlying error message (consistent UX between TEST_03 and skeleton.json).
  3. In Atlas Preview, a Strip-Whitespace-authored region should render its opaque pixels at the position the .atlas region rect specifies, NOT shifted to the top-left corner of the page tile.

- **Actual**:
  1. TEST_03 export: 86 of 91 succeed, 5 fail with `extract_area: bad extract area` (visible failures: L_EYE_WHITE.png 196×140→40×29 and L_EYE.png 94×86→20×18). The 3 unseen failures are scrolled off-screen. Total fail count `5 failed`, succeeded `86`.
  2. skeleton.json export: 0 of 1 succeeds. `images/square.png` (500×500 → 96×96) fails silently — error message NOT rendered on the row, only a warning glyph + the "1 failed" tally.
  3. Atlas Preview shows the Strip-Whitespace red square aligned to top-left of its tile instead of centred where the original 500×500 canvas would put it.

- **Error messages**:
  - `extract_area: bad extract area` (from sharp/libvips, on TEST_03 rows L_EYE_WHITE + L_EYE + 3 others)
  - No error rendered on skeleton.json `square.png` row, despite `1 failed`.

- **Timeline**: User reports this is a **recent regression** — was working in a prior version.

- **Reproduction**:
  1. Load `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json`, run Optimize Assets export → 5 fail with extract_area error.
  2. Load `fixtures/spine_stripWS/EXPORT/skeleton.json`, run Optimize Assets export → 1/1 fails silently.
  3. In Atlas Preview, observe square.png renders top-left aligned instead of centered — possibly the same root-cause as the export failures.

## Suspicion (un-tested)

The common thread is **Strip-Whitespace-authored atlas regions** — i.e., regions where the source PNG canvas is larger than the atlas region rect because Spine cropped the transparent pixels at export. The .atlas format records this via the `offsets:` and `orig:` fields. The user has confirmed `square.png` uses Strip Whitespace; status of the L_EYE files is unknown and the debugger should inspect `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.atlas` to confirm.

If the export-pipeline's `extract()` rect is computed from `orig` (canvas) dims but applied to the cropped atlas-source PNG (or vice versa), the rect can land out-of-bounds and trip libvips' bounds check. Memory record `project_atlas_pack_options_atlas_source_only.md` (locked 2026-05-06) claims "strip whitespace fully handled (atlas-orig + isotropic correction)" — but this regression suggests that handling has broken since the lock, OR the strip-whitespace path through atlas-less and atlas-source modes diverged in v1.3 work.

The Atlas Preview top-left misalignment (screenshot 2) strongly suggests the offset is being dropped at the renderer too — either both paths share a bug or the same data shape is being misinterpreted in two places.

## Initial Hypotheses (untested)

1. **`extract()` rect is computed in canonical/orig coordinates but applied to the trimmed atlas PNG.** When Strip Whitespace is on, the atlas region rect (x,y,w,h in the .atlas) is in atlas-page space and matches the trimmed pixel data; the `orig` field is the original PNG canvas size. If export reads `orig` then calls `sharp(...).extract({...orig...})` against the trimmed image, the rect is out of bounds → `extract_area: bad extract area`.

2. **Atlas-source mode passes through canonical dims but the trimmed image lacks the surrounding transparent canvas.** The atlas page PNG only contains the cropped opaque rect; reconstructing the original 500×500 canvas requires positioning that rect at `offsetX, offsetY` inside a fresh transparent canvas. If that compositing step was removed/skipped, downstream extract math fails.

3. **Atlas Preview offset bug is the SAME root cause** — wherever the export pipeline drops the strip-whitespace `offsets`, the renderer probably reads from the same source-of-truth and also drops them. Fixing one fixes the other.

4. **skeleton.json silent failure is a UI rendering bug, not a different export bug** — the underlying extract_area error is the same as TEST_03; the per-row error label simply isn't rendering for atlas-less or single-image cases. Worth confirming via main-process logs.

5. **Recent v1.3 atlas-less work (Phase 21) refactored atlas-source loader paths and a Strip-Whitespace branch slipped through unguarded.** Memory note `project_strict_loadermode_separation.md` locked 2026-05-06 — strict atlas-source vs atlas-less separation; if a shared helper was inadvertently dropped from atlas-source, strip-whitespace in atlas-source mode would fail.

## Current Focus

```yaml
hypothesis: confirmed — Hypothesis #1 + #2 + #3. atlasSources map stores originalWidth/originalHeight (orig canvas dims) under keys `w`/`h`; image-worker passes them directly to sharp.extract() against the trimmed atlas page PNG → out-of-bounds rect.
test: read .atlas files for both fixtures, then read loader.ts:564-613 and image-worker.ts:480-509.
expecting: confirmed (see Evidence E1–E7).
next_action: apply fix at loader.ts + image-worker.ts + AtlasPreviewModal.tsx (drawImage). Hypothesis #4 dismissed (UI behaviour is intentional click-to-expand, not a bug).
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-08T15:00:00
  source: fixtures/spine_stripWS/EXPORT/skeleton.atlas (entire file)
  finding: |
    ```
    skeleton.png
    size:64,64
    filter:Linear,Linear
    square
      bounds:0,0,64,64
      offsets:218,218,500,500
    ```
    Page is 64×64. Region `square` has trimmed bounds 64×64 (entire page) but `offsets:` declares orig 500×500, offset (218,218). Confirms Strip Whitespace is on for this fixture (E1).
  weight: high

- timestamp: 2026-05-08T15:01:00
  source: fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.atlas (grep L_EYE/L_EYE_WHITE)
  finding: |
    `L_EYE`: bounds:0,3810,**92,84** + offsets:1,1,**94,86** → orig 94×86, trimmed 92×84.
    `L_EYE_WHITE`: bounds:182,3756,**194,138** + offsets:1,1,**196,140** → orig 196×140, trimmed 194×138.
    Both are Strip-Whitespace regions; trimmed and orig differ by 1–2px in each axis (E2).
  weight: high

- timestamp: 2026-05-08T15:02:00
  source: src/core/loader.ts:600-613
  finding: |
    Atlas-source branch of `atlasSources.set(...)` populates the map with:
    ```ts
    atlasSources.set(region.name, {
      pagePath: ...,
      x: region.x,
      y: region.y,
      w: region.originalWidth,   // ← orig canvas dim, NOT trimmed page dim
      h: region.originalHeight,  // ← orig canvas dim, NOT trimmed page dim
      rotated,
    });
    ```
    Per spine-core TextureAtlas.d.ts: `region.x/y` are page coords, `region.width/height` are trimmed bounds, `region.originalWidth/Height` are orig canvas dims, `region.offsetX/Y` are bottom-left offsets of trimmed inside orig. The loader stores orig dims under `w/h` and DROPS `offsetX/Y` and trimmed `width/height` entirely (E3).
  weight: high

- timestamp: 2026-05-08T15:03:00
  source: src/main/image-worker.ts:480-509 (resize-row atlas-extract branch)
  finding: |
    ```ts
    sharp(row.atlasSource.pagePath).extract({
      left: row.atlasSource.x,
      top: row.atlasSource.y,
      width: row.atlasSource.w,    // ← orig (500 for `square`), but page is 64×64
      height: row.atlasSource.h,
    })
    ```
    Code comment claims "for non-rotated regions these match the packed bounds W/H exactly" — TRUE only when orig == bounds (no Strip Whitespace). For Strip-Whitespace regions the rect overshoots the page → libvips `extract_area: bad extract area` (E4).
  weight: high

- timestamp: 2026-05-08T15:04:00
  source: src/main/image-worker.ts:273-282 (passthrough atlas-extract branch)
  finding: |
    Passthrough branch has the SAME shape as the resize branch — pulls `row.atlasSource.x/y/w/h` directly, would also fail for any Strip-Whitespace region that lands in `passthroughCopies[]`. Currently the failing fixtures land in `rows[]` (effective scale < 1.0 → outW < sourceW), but a 100% override would put a Strip-Whitespace region into the passthrough branch and trigger the same failure (E5).
  weight: medium

- timestamp: 2026-05-08T15:05:00
  source: src/renderer/src/modals/AtlasPreviewModal.tsx:535-564
  finding: |
    drawImage 9-arg form for atlas-packed regions:
    ```ts
    ctx.drawImage(
      img,
      region.atlasSource.x,
      region.atlasSource.y,
      region.atlasSource.w,    // ← orig (500), but page PNG is 64×64
      region.atlasSource.h,
      region.x, region.y,      // tile position
      region.w, region.h,      // tile dims
    );
    ```
    Canvas drawImage clips srcRect at the source image edge rather than throwing — so the upper-left 64×64 pixels of `skeleton.png` get drawn into a tile whose layout assumes 500×500 worth of content. That's why the red square appears top-left aligned instead of centered (the drop-in 64×64 trimmed pixels render at offset (0,0) rather than (218,218)). Same root cause as export — confirms Hypothesis #3 (E6).
  weight: high

- timestamp: 2026-05-08T15:06:00
  source: src/renderer/src/modals/OptimizeDialog.tsx:705-774
  finding: |
    Per-row error message rendering is **gated on `expanded && errMsg`** (line 770) — `expandedErrors` is a Set the user toggles by clicking the row. Default is collapsed. The TEST_03 visible errors must have been click-expanded by the user; `square.png` was simply left collapsed. This is intentional click-to-expand UX, NOT a missing-error bug. Hypothesis #4 falsified (E7).
  weight: medium

- timestamp: 2026-05-08T15:07:00
  source: git log -L 600,615:src/core/loader.ts
  finding: |
    The `w: region.originalWidth, h: region.originalHeight` shape was introduced in commit `6812b97 feat(06-gap): add atlasSource to DisplayRow + populate from TextureAtlas in loader` (Phase 6 Gap-Fix #2). The bug has been latent since Phase 6 — not a recent regression in code; the regression in BEHAVIOUR is just that the user only just exercised Strip-Whitespace fixtures. Memory `project_atlas_pack_options_atlas_source_only.md`'s "strip whitespace fully handled" lock from 2026-05-06 is **factually incorrect** for atlas-source mode (E8).
  weight: medium

## Eliminated

- **Hypothesis #4** (silent-failure UI bug): the per-row error message IS captured by `setRowErrors` (OptimizeDialog.tsx:172-179) — it just doesn't render until the user clicks the row to expand. TEST_03 shows messages because user clicked those rows; skeleton.json's single row was left collapsed. Behaviour is intentional. Not a bug, possibly a UX paper-cut (auto-expand-on-error could be a separate enhancement).

- **Hypothesis #5** (recent v1.3 refactor): git blame shows the broken atlasSources shape goes back to Phase 6 Gap-Fix #2 commit `6812b97`. v1.3 did NOT touch this. The "recent regression" in user perception is exposure-driven, not code-driven.

## Root Cause

The atlas-source extract pipeline confuses **orig canvas dims** (`originalWidth/originalHeight`, what canonical/JSON math speaks in) with **trimmed page bounds** (`width/height`, the actual pixel rect that exists in the atlas page PNG).

When Spine's "Strip Whitespace" export option is enabled, these two differ — Spine crops transparent pixels and records the trimming via `offsets:offsetX,offsetY,origW,origH` in the .atlas. spine-core's TextureAtlas parser exposes BOTH dims (`region.width/height` = trimmed bounds; `region.originalWidth/Height` = orig canvas) plus the offset (`region.offsetX/Y`).

`src/core/loader.ts:608-609` populates the `atlasSources` map's `w/h` keys with `region.originalWidth/originalHeight` (orig). It also drops `region.width/height` (trimmed) and `region.offsetX/Y` entirely. Two consumers then use these values incorrectly:

1. **`src/main/image-worker.ts:480-509`** (resize-row atlas-extract branch) and **`273-282`** (passthrough atlas-extract branch) both pass `atlasSource.w/h` straight into `sharp.extract({width, height})`. For Strip-Whitespace regions the rect overshoots the page PNG → libvips raises `extract_area: bad extract area`.

2. **`src/renderer/src/modals/AtlasPreviewModal.tsx:541-551`** passes `atlasSource.w/h` as the `drawImage` srcRect dims. Canvas silently clips, so the upper-left chunk of the page renders at the tile origin instead of the correctly-offset trimmed pixels — visual top-left misalignment in screenshot 2.

The bug has been latent since Phase 6 Gap-Fix #2 (commit `6812b97`). It only surfaces when a user loads a project whose .atlas was exported with Strip Whitespace enabled AND has no per-region PNGs in `images/` (forcing the atlas-extract code path instead of `copyFile`). Both failing fixtures meet both conditions.

## Fix Direction

The data-shape change at the `atlasSources` map needs to expose the trimming explicitly. Recommend adding four fields:

```ts
// src/core/loader.ts (and src/core/types.ts)
atlasSources.set(region.name, {
  pagePath: ...,
  // Pixel rect that exists inside the page PNG (sharp.extract args):
  x: region.x,
  y: region.y,
  packW: region.width,           // trimmed bounds (was missing)
  packH: region.height,          // trimmed bounds (was missing)
  // Offset of trimmed rect inside orig canvas (libgdx convention: from bottom-left):
  offsetX: region.offsetX,        // was missing
  offsetY: region.offsetY,        // was missing
  // Orig canvas dims (canonical/JSON coords speak in these):
  w: region.originalWidth,       // unchanged
  h: region.originalHeight,      // unchanged
  rotated,
});
```

Then in **image-worker.ts** (both branches, lines 274-282 and 489-495):

```ts
const a = row.atlasSource;
let pipeline = sharp(a.pagePath).extract({
  left: a.x,
  top: a.y,
  width: a.packW,
  height: a.packH,
});
// If the source has trimmed transparent padding, reconstitute the orig canvas
// so downstream resize math (which targets canonical/orig dims) is correct.
if (a.packW !== a.w || a.packH !== a.h) {
  // libgdx offsets are from bottom-left; sharp.extend padding is top/right/bottom/left.
  pipeline = pipeline.extend({
    top: a.h - a.offsetY - a.packH,
    bottom: a.offsetY,
    left: a.offsetX,
    right: a.w - a.offsetX - a.packW,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}
// resize-row: continue with applyResizeAndSharpen(pipeline, outW, outH, effScale, sharpenEnabled)
// passthrough-row: pipeline.toFile(tmpPath)  (no resize — orig-sized PNG written verbatim)
```

For the **passthrough atlas-extract** branch the resulting file is the orig-sized canvas (e.g. 500×500) — same as a per-region PNG export from Spine without Strip Whitespace. That matches the byte-copy mental model ("ship the source pixels at original dims").

For **AtlasPreviewModal.tsx:541-551** the fix is symmetric — draw the trimmed pixels at the offset position inside the tile, not at the tile origin:

```ts
const a = region.atlasSource;
const scaleX = region.w / a.w;
const scaleY = region.h / a.h;
const dstX = region.x + a.offsetX * scaleX;
// libgdx offsetY is from bottom; canvas is y-down:
const dstY = region.y + (a.h - a.offsetY - a.packH) * scaleY;
ctx.drawImage(
  img,
  a.x, a.y, a.packW, a.packH,            // src: trimmed page rect
  dstX, dstY, a.packW * scaleX, a.packH * scaleY,  // dst: positioned inside tile
);
```

For non-Strip-Whitespace regions `packW===w && packH===h && offsetX===0 && offsetY===0`, so `dstX==region.x, dstY==region.y, dstW==region.w, dstH==region.h` — byte-identical to current behaviour. No regression risk for the common path.

### Test plan

1. Add unit test in `tests/loader.spec.ts`: load `fixtures/spine_stripWS/EXPORT/skeleton.json`, assert `atlasSources.get('square')` carries `packW:64, packH:64, w:500, h:500, offsetX:218, offsetY:218`.
2. Add export-pipeline integration test: run `runExport` against a single-row plan for `square.png` outW=96 outH=96 → assert produced PNG is 96×96 and a manual ImageDecode of the four corners shows transparent pixels (the trimmed opaque pixels land in the centre).
3. Add UAT step: re-run Optimize Assets on `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` → all 91 regions succeed.
4. Add UAT step: open AtlasPreview on `spine_stripWS` skeleton → red square renders centred in its tile, not top-left aligned.
5. Memory update: amend `project_atlas_pack_options_atlas_source_only.md` to reflect that Strip-Whitespace handling required a fix in atlas-source mode at `loader.ts:608-609 + image-worker.ts:489-495 + AtlasPreviewModal.tsx:541` and is now ACTUALLY working (point to this debug session).

### Specialist hint

`typescript` — the fix is concentrated in TS files and does not require a platform-specific specialist. The libvips invariant (extract rect must be inside the source image) is documented; the sharp `extend` API is the standard fix for transparent-canvas reconstruction. Optional double-check: `typescript-expert` skill could review the type-shape change in `core/types.ts` for breakage of consumers (analyzer.ts, atlas-preview.ts, export.ts) — all currently read only `pagePath`, `x`, `y`, `w`, `h`, `rotated`, so adding new fields is additive and non-breaking.

## Resolution

```yaml
status: root-cause-found
goal: find_and_fix
fix_applied: false
root_cause: |
  src/core/loader.ts:608-609 stores region.originalWidth/originalHeight (orig canvas dims)
  under the atlasSources map's `w`/`h` keys and drops region.width/height (trimmed page
  bounds) + region.offsetX/Y (libgdx-convention bottom-left offsets) entirely. Three
  consumers then misuse these dims as if they were the trimmed rect: image-worker.ts
  resize-row extract (line 489-495), image-worker.ts passthrough extract (line 273-282),
  and AtlasPreviewModal.tsx drawImage (line 541-551). For Strip-Whitespace-authored atlases
  these dims overshoot the actual page PNG → libvips raises "extract_area: bad extract
  area" in the export branches and canvas drawImage silently clips in the preview branch.
fix: |
  Not yet applied — proposed three-file change above. Awaiting orchestrator's user-fix-mode
  decision (apply now / plan / manual).
specialist_hint: typescript
notes: |
  - Bug latent since Phase 6 Gap-Fix #2 commit 6812b97 (~2026-04-25). Surfaces only on
    Strip-Whitespace atlases without per-region PNGs in images/ (both failing fixtures
    meet both conditions). User's "recent regression" perception is exposure-driven,
    not code-driven.
  - Memory `project_atlas_pack_options_atlas_source_only.md`'s "strip whitespace fully
    handled" lock from 2026-05-06 needs amendment after the fix lands.
  - Hypothesis #4 (silent-failure UI bug) FALSIFIED — error messages are click-to-expand
    by design (OptimizeDialog.tsx:770). Optional UX enhancement: auto-expand on error.
```

## Related Context

- Memory `project_atlas_pack_options_atlas_source_only.md` (2026-05-06): "strip whitespace fully handled (atlas-orig + isotropic correction)" — pre-regression claim. **Falsified by E1–E6 above.**
- Memory `project_strict_loadermode_separation.md` (2026-05-06): atlas-source vs atlas-less are self-contained; load.atlasPath gates every read. Atlas-less branch (loader.ts:589-598) sets `w/h` from the synthesizer's per-PNG dims and `x=0, y=0` — atlas-less mode is unaffected by this bug (no `offsets:` field in synthetic atlases).
- Memory `project_compute_export_dims_canonical_base.md`: computeExportDims uses canonicalW as outW base — Strip Whitespace makes canonicalW (orig) ≠ atlas-source pixel W. Confirmed: outW math is correct (canonical-relative); the bug is purely in the extract step that produces the input pixels for that resize.
- Resolved session `atlas-preview-clipping-edges` (2026-05-05) — different bug (CSS layout in modal), not related.
- Recent v1.3 phases touching loader / export: Phase 21 (atlas-less mode), Phase 22 (dims badge + override-cap with passthroughCopies), Phase 22.1, Phase 28 (PMA preservation work — falsified to no-op), Phase 29+ (loader-ux fixes in v1.3.1). None touched the offending atlas-source loader block.
