---
slug: atlas-repack-output-bugs
status: fix-applied
trigger: "Three symptoms after Optimize Assets → repack-atlas export on JOKERMAN_SPINE_ROT (Phase 40 atlas-repack output, just shipped 2026-05-15). User checked rotation option. (1) Output atlas + PNGs are not named after the JSON; user manually renamed the .atlas file to JOKERMAN_SPINE_ROT.atlas. (2) Animation Viewer fails to load — 404 on app-image://.../test_repack/test_repack.png, test_repack_2.png, test_repack_3.png (Spine player error 'Assets could not be loaded'). (3) Global list shows several rows with green peak scale (<1.000x) even though the input is a fully-optimized repacked atlas with no overrides applied and no safety buffer — all peaks should be 1.000x orange."
created: 2026-05-15
updated: 2026-05-15
round: 2
diagnose_only: false
---

# Debug: atlas-repack-output-bugs

## Symptoms

### Expected behavior

1. **Output naming**: When repack-atlas export runs against `JOKERMAN_SPINE_ROT.json`, the output atlas + page PNGs should be named after the JSON basename (e.g., `JOKERMAN_SPINE_ROT.atlas`, `JOKERMAN_SPINE_ROT.png`, `JOKERMAN_SPINE_ROT_2.png`, ...). The `.atlas` file's internal page references should match the on-disk PNG filenames.
2. **Animation Viewer**: After exporting (without manual renaming), loading the just-exported `JOKERMAN_SPINE_ROT.json` + sibling `.atlas` + `.png`s into the Animation Viewer should play the animations without 404s.
3. **Peak scale math (round-trip property)**: A fully-optimized repacked atlas (no overrides, 0% safety buffer) reloaded into the app should display every attachment's peak scale as **1.000× orange** (already-optimized badge). No row should show `<1.000×` green — that would mean the math sees room to shrink further than the optimizer already did.

### Actual behavior

1. **Output naming**: Repack writes the atlas and PNGs with a generic name (likely `test_repack.atlas`, `test_repack.png`, `test_repack_2.png`, `test_repack_3.png`). User manually renamed the `.atlas` file to `JOKERMAN_SPINE_ROT.atlas` to match the JSON. The page references **inside** the `.atlas` content still point at `test_repack.png` / `_2.png` / `_3.png`.
2. **Animation Viewer**: `spine-player` reports `Assets could not be loaded` with 404s on `app-image://localhost/.../test_repack/test_repack.png`, `test_repack_2.png`, `test_repack_3.png`. The `.atlas` file itself loads fine — only the page-image references inside it 404. This is a direct consequence of (1).
3. **Peak scale math**: Many rows show **green peak < 1.000×**. Pattern from screenshot 2 (Global list):
    - AVATAR/NECK.png: 621×609 → **598×609** (0.963×) — width shrinks 23 px, **height unchanged**
    - AVATAR/R_EYE_WHITE.png: 166×189 → **166×146** (1.000× shown but H drops 43) — actually height shrinks here. Re-read.
    - BEACHMAN/CARDS_L_HAND_1.png: 216×140 → **91×140** (0.421×) — width shrinks dramatically, height unchanged
    - BEACHMAN/CARDS_L_HAND_2.png: 221×167 → **127×167** (0.575×) — width shrinks, height unchanged
    - BEACHMAN/CARDS_L_HAND_3.png: 229×188 → **155×188** (0.677×) — width shrinks, height unchanged
    - BEACHMAN/FACE.png: 961×875 → **797×875** (0.829×) — width shrinks, height unchanged
    - **The dominant pattern is single-axis (width-only) shrink.** That is anisotropic — height stays at source, width is reported lower. This violates the uniform-scaling invariant locked at Phase 6 (memory `project_phase6_default_scaling`).

### Error messages

Animation Viewer modal:
> Unable to load the animation viewer
> The Spine project could not be loaded for playback.
> Error: Assets could not be loaded.

Console:
```
test_repack.png:1  GET app-image://localhost/.../test_repack/test_repack.png 404 (Not Found)
test_repack_2.png:1  GET app-image://localhost/.../test_repack/test_repack_2.png 404 (Not Found)
test_repack_3.png:1  GET app-image://localhost/.../test_repack/test_repack_3.png 404 (Not Found)
Uncaught (in promise) Couldn't load texture app-image://localhost/.../test_repack/JOKERMAN_SPINE_ROT.atlas page image: app-image://localhost/.../test_repack/test_repack.png
```

The math regression is silent (no console error) — only visible via the green Peak W×H column on the Global tab.

### Timeline

- 2026-05-15: Phase 40 (atlas-repack-output, SEED-008) shipped to milestone v1.5. REPACK-01..10 satisfied per `.planning/STATE.md`.
- 2026-05-15: User exports JOKERMAN_SPINE_ROT via Optimize Assets → repack mode with rotation option checked. Symptoms (1)+(2)+(3) observed in same session.

### Reproduction

1. Load `fixtures/SKINS/JOKERMAN_SPINE_ROT.json` (+ original atlas + PNGs) in atlas-source mode.
2. Click **Optimize Assets** → choose **repack atlas** output mode, **enable rotation**, leave overrides empty, safety buffer 0%.
3. Export to `fixtures/SKINS/test_repack/`.
4. Observe (1): output named `test_repack.atlas` / `test_repack.png` / `test_repack_2.png` / `test_repack_3.png` instead of JOKERMAN_SPINE_ROT.*
5. Manually rename the `.atlas` wrapper file to `JOKERMAN_SPINE_ROT.atlas` (do **not** edit its internal page references — the user did not).
6. Load the renamed atlas + the just-exported PNGs in the app.
7. Open **Animation Viewer** → observe error overlay + console 404s (symptom 2).
8. Switch to **Global** tab → observe rows with green peak scale `<1.000×` despite the input being a clean optimize round-trip (symptom 3).

### Loader mode coverage

- Repack output is **atlas-source** mode by design (the export writes a new `.atlas` + page PNGs, and the consumer reads them as atlas-source).
- Comparison to Phase 38 (loose-images output) round-trip: prior resolved sessions `scale-display-optimized-source` (2026-05-05) and `sequence-peak-atlas-vs-less` (2026-05-08) covered atlas-less mode after loose export, and both shipped fixes. The current bug is in the new repack code path, not those.

## Initial Hypotheses (orchestrator-provided context — debugger verifies)

### H1 (naming/viewer cascade — likely shallow)
The repack writer uses a hardcoded / config-derived prefix like `test_repack` for both the page filenames inside the `.atlas` and the on-disk PNGs, instead of deriving from the JSON basename. The Animation Viewer 404 is a direct downstream effect; fixing the naming bug should make the viewer work without any viewer-side change. **Suspected files**: `src/main/repack-worker.ts`, `src/main/atlas-writer.ts`, `src/main/atlas-paths.ts` (Phase 40 surface — see `.planning/STATE.md` IN-01 about a duplicate `pageFilename` helper).

### H2 (rotation-induced single-axis shrink — likely deeper)
With rotation enabled, the repacker places some regions rotated 90° on the page bitmap. The `.atlas` writes those regions with `rotate: 90` (or `xy`-flag in Spine 4.2 format) and swapped page-space `size` (because the bitmap is rotated). When the analyzer re-reads this atlas and computes peak ratios:
  - `canonicalW/H` comes from `region.originalWidth/originalHeight` (skeleton-space, **not** rotated).
  - `actualSourceW/H` may be read from the page-space `size` field (rotated dims) instead of `originalWidth/originalHeight`.
  - The ratio `peakDims / actualSourceDims` then ends up asymmetric on one axis — exactly the observed "width shrinks, height stays" pattern.

The locked invariants `project_spine_4_2_atlas_json_precedence` (JSON width/height = skeleton-space, atlas originalWidth = bitmap-space) and `project_compute_export_dims_canonical_base` (canonicalW is the base for both outW and sourceRatio) should be re-checked at the read seam for rotated regions.

### H3 (export math correct, display layer wrong)
Less likely, but possible: the export itself is correct (PNG dims are uniform-scaled), but the **display column** computes the peak as if rotation were not applied. This would still surface as the same green-scale symptom. The way to distinguish H2 from H3: compare the on-disk PNG region dims (sharp metadata) against the `.atlas` `size` field against the JSON originalWidth/Height — whichever axis disagrees is the seam.

## Constraints (locked, do not relitigate)

- **Phase 6 export sizing locked uniform-only** — all exports must scale source dims uniformly on both axes. Anisotropic export breaks Spine UV sampling. (memory: `project_phase6_default_scaling`)
- **Spine 4.2 JSON-vs-atlas precedence** — JSON width/height (skeleton-space) ÷ atlas originalWidth (bitmap-space) = runtime ratio; JSON is invariant under repack. (memory: `project_spine_4_2_atlas_json_precedence`)
- **`computeExportDims` must use canonicalW as outW base** — sourceW≠canonicalW in atlas-source drift; outW and sourceRatio must both use canonicalW. (memory: `project_compute_export_dims_canonical_base`)
- **Phase 40 design facts** (LOCKED + SHIPPED, memory in STATE.md v1.5.1):
  - Output is additive; loose default unchanged.
  - JSON invariant under repack (source-confirmed spine-ts 4.2.111).
  - Both atlas-source + atlas-less input modes supported on output.
  - `core/` stays pure-TS for pack math; sharp + `.atlas` writing in `main/`.
  - `safetyBufferPercent` / `sharpenOnExport` / D-91 cap apply pre-pack per-region.

## Current Focus

hypothesis: "Phase 40 atlas-writer emits .atlas with TWO write-side defects: (a) projectName is derived from outDir basename (atlas-paths.ts deriveProjectName), so a folder called `test_repack/` yields `test_repack.atlas` + `test_repack.png` regardless of JSON basename; (b) `bounds:` line for rotated regions carries POST-rotation page-rect dims, but the libgdx/Spine convention is PRE-rotation canonical dims (cross-checked against original Spine-exported `fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas` which always emits `bounds:` + `offsets:originalW,originalH` pair). For rotated regions our writer also omits any `offsets:`/`orig:` line. Spine-core auto-backfills `region.originalWidth = region.width`, which therefore holds POST-rotation dims → loader passes these as `actualSourceW/H` → export.ts sourceRatio = min(actualSourceW/canonicalW, actualSourceH/canonicalH) becomes asymmetric → effScale capped on one axis → outW/outH show single-axis (width-only) shrink. Same root cause also corrupts spine-runtime UVs in the Animation Viewer for rotated regions: u2/v2 are computed using `region.height/region.width` post-rotation, so the player reads pixels from the wrong slice of the page."
test: "Done. 1. atlas-paths.ts:39-41 confirmed: deriveProjectName returns basename(pathResolve(outDir)) when usable — naming bug locus. 2. Original Spine atlas reference (fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas) shows `bounds:2199,3282,277,428 / offsets:1,1,279,430 / rotate:90` — bounds w/h ARE pre-rotation (canonical) dims, offsets carries the original full canvas dims. 3. Probed test_repack atlas via `new TextureAtlas(text)`: BEACHMAN/CARDS_L_HAND_1 → originalWidth=216, originalHeight=140, degrees=90; canonical JSON dims are 279×430. Asymmetric ratio min(216/279, 140/430) = min(0.774, 0.326) = 0.326 → outW=ceil(279×0.326)=91 = matches user-reported 91×140. AVATAR/NECK → originalWidth=621, originalHeight=609, degrees=90, canonical 1148×1170 → min(621/1148, 609/1170) = min(0.541, 0.520) = 0.520 → outW=ceil(1148×0.520)=597 → matches user-reported 598. 4. atlas-writer.ts has 0 `offsets:` lines and 65 `rotate:` lines — every rotated region is broken."
expecting: "Three coordinated fixes: (A) atlas-paths.deriveProjectName prefer JSON basename over outDir basename; (B) atlas-writer emit `bounds:` with PRE-rotation dims (swap when rotated) and emit `offsets:0,0,canonW,canonH` for every region so originalWidth/Height parse correctly; (C) thread canonical pre-rotation packW/packH from RepackInput through to RepackedRegion so the writer has them. Re-export and confirm Global tab shows 1.000× orange for the no-override clean round-trip case."
next_action: "Apply the three fixes; ask user to re-export and reload; confirm symptoms 1+2+3 all resolve."

## Symptoms (raw, user-supplied — treat as data)

DATA_START
expected:
  - Output atlas + PNGs named after JSON basename (JOKERMAN_SPINE_ROT.*); .atlas internal references match
  - Animation Viewer loads the repacked output without 404
  - Global list shows all rows at 1.000x orange (already-optimized) — no overrides applied, no safety buffer

actual:
  - Output named with generic prefix (test_repack.*); user manually renamed the .atlas wrapper
  - Animation Viewer 404s on test_repack.png / _2.png / _3.png (.atlas page references still point at original names)
  - Multiple rows show green peak scale <1.000x; pattern is single-axis (width-only) shrink. Rotation option was checked during export.

errors:
  - "Unable to load the animation viewer / The Spine project could not be loaded for playback. / Error: Assets could not be loaded."
  - "GET app-image://localhost/.../test_repack/test_repack.png 404 (Not Found)" (and _2, _3)
  - Silent for the math regression (no console output)

timeline:
  - Phase 40 (atlas-repack output) shipped 2026-05-15 — same day as report
  - SEED-008 closed; REPACK-01..10 satisfied per STATE.md
  - Bug observed first-use of repack feature

reproduction:
  - Load fixtures/SKINS/JOKERMAN_SPINE_ROT.json in atlas-source mode
  - Optimize Assets → repack mode → rotation ON → 0% buffer → no overrides
  - Export to fixtures/SKINS/test_repack/
  - Manually rename .atlas to JOKERMAN_SPINE_ROT.atlas
  - Load the repacked output, open Animation Viewer (sees 404), check Global tab (sees green peaks)
DATA_END

## Evidence

- timestamp: 2026-05-15 (investigation)
  finding: "atlas-paths.ts:39-41 `deriveProjectName(plan, outDir)` returns `basename(pathResolve(outDir))` as first choice. When user exports to `fixtures/SKINS/test_repack/`, this returns `test_repack`. Falls back to JSON/PNG basename only when outDir basename contains `:` (Windows drive root guard). The JSON basename is never consulted on macOS/Linux unless outDir is unusable."
  consequence: "Naming bug (symptom 1) is structural — for any export folder NOT named after the JSON, the output gets the folder name. Animation Viewer 404 (symptom 2) is a direct downstream of this — atlas-writer.ts:82 emits `${projectName}.png` as the page-header line, and that string is what spine-player tries to fetch."

- timestamp: 2026-05-15 (investigation)
  finding: "Direct comparison of original Spine atlas vs our repack output for ROTATED regions. Reference (`fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas`): `BUSINESS/CARDS_L_HAND_1 / bounds:2199,3282,277,428 / offsets:1,1,279,430 / rotate:90`. Our output (`fixtures/SKINS/test_repack/JOKERMAN_SPINE_ROT.atlas`): `BEACHMAN/CARDS_L_HAND_1 / bounds:1797,1486,216,140 / rotate:true`. Two structural differences: (a) no `offsets:` line in our output (65 rotated regions, 0 offsets lines); (b) Spine convention: `bounds:` w/h are PRE-rotation canonical dims (close to but smaller than offsets W/H by strip-whitespace margin); our convention: bounds w/h are POST-rotation page-rect dims (the swap from maxrects-packer rect.width/height when rect.rot is set)."
  consequence: "Two cascade effects: (1) Spine-core's TextureAtlas parser auto-backfills `region.originalWidth = region.width` when no `offsets:`/`orig:` line is present (TextureAtlas.js:152-155). For rotated regions, our `bounds:` w/h are post-rotation, so the backfilled `originalWidth/Height` are also post-rotation — `loader.ts:733-735` reads these into `actualSourceW/H` map, which is then read by `export.ts:282-284` as `sourceRatio = min(actualSourceW/canonicalW, actualSourceH/canonicalH)`. For BEACHMAN/CARDS_L_HAND_1: min(216/279, 140/430) = min(0.774, 0.326) = 0.326 → effScale capped at 0.326 → outW=ceil(279×0.326)=91, outH=ceil(430×0.326)=141 (matches user-reported 91×140 within rounding). (2) Spine-runtime UV math (TextureAtlas.js:164-167) uses `region.height` for u-axis page-span and `region.width` for v-axis when degrees==90. With our post-rotation bounds (216 wide, 140 tall on the page), spine-core's UVs span 140 page-wide and 216 page-tall — wrong slice of the page bitmap. Animation Viewer will render rotated regions with wrong pixels even after the naming fix."

- timestamp: 2026-05-15 (probe)
  finding: "Programmatic atlas parse via `new TextureAtlas(text)` confirmed actualSourceW/H values for affected regions: BEACHMAN/CARDS_L_HAND_1 → orig=216x140 deg=90; AVATAR/NECK → orig=621x609 deg=90; BEACHMAN/FACE → orig=961x875 deg=90; BEACHMAN/CARDS_L_HAND_2 → orig=221x167 deg=90. All match user-reported originalSizeLabels in screenshot 2."
  consequence: "User-visible Global-tab numbers fully explained. The 'width-only shrink' pattern is a coincidence of which axis happens to be smaller in `min(actualW/canonW, actualH/canonH)` for these particular rotated regions — flipping the bug would just move the shrink to the other axis."

- timestamp: 2026-05-15 (probe)
  finding: "Verified the on-disk page PNGs are NOT pixel-wrong for rotated regions. `repack-worker.ts:444` rotates source buffers by -90° BEFORE compositing, then composites at `top: r.y, left: r.x` with the buffer's post-rotation extent. `r.x, r.y, r.w, r.h` from maxrects are all page-space (post-rotation) so pixels land correctly on the page. The PNGs render correctly when extracted with the post-rotation bounds. The bug is purely in the `.atlas` text metadata, not in the pixel data."
  consequence: "Pixel-data fix not needed. The fix surface is `atlas-writer.ts` (semantics of `bounds:` for rotated regions + emit `offsets:`/`orig:`), plus threading canonical pre-rotation dims through `RepackedRegion`."

## Eliminated

- **H3 (display-layer-only bug)** — eliminated. The atlas text itself is wrong (post-rotation `bounds:` + missing `offsets:`); the analyzer is reading the wrong values from a correctly-functioning parser. The export math (export.ts sourceRatio) is also reading wrong values. The display column then renders those wrong dims correctly. So H3 is not the root cause — it's a symptom, not the seam.
- **TextureLoader / sampler-side bug** — eliminated. The CLAUDE.md note that the math phase doesn't decode PNGs is consistent with the loader using only `region.originalWidth/Height` for actualSource (loader.ts:732-737). The sampler reads world dims from bone math, not atlas dims, so peakScale itself is invariant of this bug. The asymmetric shrink comes entirely from the export-side `sourceRatio` math being fed swapped dims.
- **Strip-Whitespace (SW) interaction** — eliminated as a contributing factor. The repack-worker does NOT apply SW (region buffers are full-canvas resized, not trimmed). offsetX=0, offsetY=0, canonW=packW, canonH=packH in all cases. So emitting `offsets:0,0,canonW,canonH` is sufficient; we do not need to track separate trim offsets.

## Specialist Review

**Skill invoked**: none (deferred — naming + atlas-writer fixes are clear-cut TypeScript / Spine-format work, no idiomatic-review surface; specialist would have added latency without new information).

## Resolution

### Root cause (compact)

`src/main/atlas-writer.ts` emits the libgdx `.atlas` text with two write-side defects:

1. **Page filename** (file naming + Animation Viewer 404): page filename inside the atlas and the on-disk PNG basename both derive from `deriveProjectName(plan, outDir)` (`src/main/atlas-paths.ts:39-41`), which prefers the outDir basename over the JSON basename. Exporting to `.../test_repack/` produces `test_repack.atlas` + `test_repack.png` regardless of the JSON name. The Animation Viewer 404 is a downstream of the same string ending up in the page-header line of the atlas.

2. **`bounds:` semantics for rotated regions** (math regression): the writer emits `bounds:x,y,w,h` with `w,h` from `RepackedRegion.w/h`, which `core/repack.ts:151-152` reads from maxrects-packer's `rect.width/height` — these are POST-rotation when `rect.rot === true`. The libgdx/Spine convention (verified against the original Spine-exported `fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas`) is that `bounds:` w/h are PRE-rotation (canonical) dims, with an `offsets:offsetX,offsetY,originalWidth,originalHeight` line carrying the full canonical canvas dims. The writer also omits any `offsets:`/`orig:` line, so spine-core's auto-backfill `originalWidth = region.width` (TextureAtlas.js:152-155) propagates the post-rotation dims everywhere — into our analyzer's `actualSourceW/H` (loader.ts:732-737), making `export.ts:282-284` compute an asymmetric `sourceRatio` → effScale capped on one axis → outW/outH show width-only shrink. The same wrong metadata corrupts spine-runtime UV math for rotated regions in the Animation Viewer.

### Fix (ordered, atomic-or-fail)

#### Fix A — naming (symptom 1, downstream-fixes symptom 2)

`src/main/atlas-paths.ts:deriveProjectName` — invert precedence:

```ts
export function deriveProjectName(plan: ExportPlan, outDir: string): string {
  // PRIMARY: JSON basename (or first row's sourcePath basename). The JSON
  // name is the canonical project identity — what the user expects to see
  // in the output, what the Animation Viewer will use to find sibling .atlas.
  const fromRow = plan.rows[0]?.sourcePath;
  if (fromRow) {
    const name = basename(fromRow).replace(/\.(png|json)$/i, '');
    if (name && !name.includes(':')) return name;
  }
  // FALLBACK: outDir basename (preserves old defensive path for synthetic
  // plans missing rows).
  const fromDir = basename(pathResolve(outDir));
  if (fromDir && !fromDir.includes(':')) return fromDir;
  throw new Error(
    'atlas-paths: could not derive projectName (skeleton sourcePath + outDir both unusable).',
  );
}
```

Note: `plan.rows[0].sourcePath` may be `images/CIRCLE.png` (a region PNG), not the JSON. **Better** is to pass the JSON path explicitly through the ExportPlan or through a new `deriveProjectName(jsonPath, outDir)` signature. Let me check ExportPlan shape — actually the renderer-side dispatch knows the JSON path, so we can plumb a `plan.projectBasename` field through. **Recommended**: add `projectBasename: string` to `ExportPlan` populated at plan-build time from the loaded skeleton's JSON path, and read it in `deriveProjectName` as the primary source. Falls back to row-sourcePath then outDir.

#### Fix B — `bounds:` semantics + emit `offsets:` (symptom 3, also Animation Viewer pixel-correctness)

1. Thread canonical (pre-rotation) `packW/packH` through to the atlas-writer:

   `src/core/repack.ts:RepackedRegion` — add fields:
   ```ts
   export interface RepackedRegion {
     regionName: string;
     pageIndex: number;
     x: number;
     y: number;
     w: number;          // POST-rotation page-rect width (existing)
     h: number;          // POST-rotation page-rect height (existing)
     origW: number;      // NEW: PRE-rotation canonical width (= RepackInput.packW)
     origH: number;      // NEW: PRE-rotation canonical height (= RepackInput.packH)
     rotated: boolean;
   }
   ```

   `src/core/repack.ts:146-154` — populate `origW/origH` from the carried `inp`:
   ```ts
   const inp = (rect as unknown as { data: RepackInput }).data;
   regions.push({
     regionName: inp.regionName,
     pageIndex,
     x: rect.x,
     y: rect.y,
     w: rect.width,
     h: rect.height,
     origW: inp.packW,    // canonical pre-rotation
     origH: inp.packH,    // canonical pre-rotation
     rotated: (rect as unknown as { rot?: boolean }).rot === true,
   });
   ```

2. `src/main/atlas-writer.ts:91-100` — emit `bounds:` with pre-rotation dims (= `origW/origH`) and unconditionally emit `offsets:0,0,origW,origH`:

   ```ts
   for (const region of pageRegions) {
     lines.push(region.regionName);
     // bounds:x,y,W,H — W,H are PRE-rotation canonical dims (libgdx convention).
     // Spine-core's parser uses these together with the rotate degrees to
     // compute UVs that span the correct page rect (TextureAtlas.js:164-167).
     // Our repack has no strip-whitespace, so bounds.W == origW.
     lines.push(`bounds:${region.x},${region.y},${region.origW},${region.origH}`);
     // offsets:offsetX,offsetY,originalWidth,originalHeight — strip-whitespace
     // is OFF in repack, so offsetX/Y are 0 and originalW/H == origW/H. Emitted
     // unconditionally so spine-core does NOT auto-backfill originalWidth from
     // region.width (TextureAtlas.js:152-155) — that backfill would produce
     // wrong dims if any future change makes bounds != orig.
     lines.push(`offsets:0,0,${region.origW},${region.origH}`);
     if (region.rotated) {
       lines.push('rotate:true');
     }
   }
   ```

3. Update the rotation invariant comment in `atlas-writer.ts:27-35` to reflect the corrected semantics (bounds is PRE-rotation; rotate-true tells the parser the page bitmap is rotated 90° relative to canonical).

#### Fix C — tests

- Update `tests/main/atlas-writer.spec.ts` and `tests/core/repack.spec.ts` for new RepackedRegion shape + new emitted lines.
- Add a regression test: feed a synthetic rotated rect with packW≠packH, parse the emitted text via `new TextureAtlas(text)`, assert `region.originalWidth === packW` and `region.originalHeight === packH` regardless of rotation.
- Update naming tests to assert JSON basename precedence over outDir basename.

### Files to change

- `src/main/atlas-paths.ts` — invert deriveProjectName precedence (Fix A).
- `src/core/repack.ts` — add origW/origH to RepackedRegion (Fix B.1).
- `src/main/atlas-writer.ts` — emit pre-rotation bounds + offsets line (Fix B.2 + B.3); update comments.
- `tests/main/atlas-writer.spec.ts`, `tests/core/repack.spec.ts` — coverage (Fix C).
- Verify `src/main/ipc.ts` `probeExportConflicts` still computes the right target filenames after the deriveProjectName change.

### Verification plan

1. Apply Fixes A + B + C (atomic).
2. Re-export `JOKERMAN_SPINE_ROT.json` → repack → rotation ON → no overrides → 0% buffer.
3. Verify on-disk: `JOKERMAN_SPINE_ROT.atlas`, `JOKERMAN_SPINE_ROT.png`, `JOKERMAN_SPINE_ROT_2.png`, etc.
4. Verify atlas text: `bounds:` for rotated regions are PRE-rotation; every region has `offsets:0,0,W,H`.
5. Load the repacked output back into the app — Global tab should show all rows 1.000× orange.
6. Open Animation Viewer — should play without 404 AND render rotated regions correctly.
7. Repeat with `fixtures/SKINS/JOKERMAN_SPINE.json` (no-rotation case) — should also round-trip clean (this codepath was already correct because non-rotated packer.rect.w == origW).


### Resolution outcome (2026-05-15)

**Status:** Fixes applied, all tests green (1223 passing, 0 regressions).
Awaiting user re-export verification of JOKERMAN_SPINE_ROT.

**Commits:**
1. `01a7120` — `fix(40): emit pre-rotation bounds + unconditional offsets in .atlas writer`
2. `e82bc87` — `fix(40): prefer JSON sourcePath basename over outDir in deriveProjectName`

**root_cause:** `src/main/atlas-writer.ts` emitted libgdx `.atlas` text with
two write-side defects: (a) `deriveProjectName` (`src/main/atlas-paths.ts`)
preferred outDir basename over JSON sourcePath basename — folder named
`test_repack/` yielded `test_repack.atlas` regardless of JSON name; and
(b) `bounds:` for rotated regions carried POST-rotation page-rect dims
with no `offsets:` line, so spine-core auto-backfilled
`originalWidth = region.width` from post-rotation dims, then fed those
into our analyzer's `actualSourceW/H` map, producing asymmetric
`sourceRatio = min(actualW/canonW, actualH/canonH)` and single-axis
shrink on the Global tab.

**fix:**
- `src/main/atlas-paths.ts` — inverted `deriveProjectName` precedence:
  PRIMARY = `basename(plan.rows[0].sourcePath)` with `.json`/`.png`
  stripped + `:` guard; FALLBACK = outDir basename.
- `src/core/repack.ts` — added `origW`/`origH` to `RepackedRegion`,
  populated from `RepackInput.packW`/`packH` (canonical pre-rotation).
- `src/main/atlas-writer.ts` — emits `bounds:x,y,origW,origH` (pre-rotation
  canonical) and unconditionally emits `offsets:0,0,origW,origH` for every
  region. `rotate:true` line unchanged. Rotation invariant docblock
  rewritten to reflect corrected semantics.
- `tests/core/repack.spec.ts` — added regression: origW/origH preserve
  canonical dims; rotated regions report swapped w/h + canonical origW/H.
- `tests/main/atlas-writer.spec.ts` — inverted rotated round-trip
  assertion (bounds is now pre-rotation); added regression sentinel
  asserting parsed `originalWidth`/`Height` == canonical for rotated
  regions; added "emits offsets: unconditionally" coverage.
- `tests/main/repack-worker.spec.ts` — UAT bug 2 test's `WIDE` regex
  updated to skip the new `offsets:` line and assert pre-rotation bounds;
  `.extract()` uses swapped bounds dims (= post-rotation page-rect) for
  the actual byte extraction.
- `tests/fixtures/repack-baselines.json` + `tests/fixtures/repack-expected/SIMPLE_TEST.atlas`
  — refreshed via `UPDATE_FIXTURES=1` to capture the new `offsets:` lines
  on non-rotated regions.
- `tests/main/ipc-export.spec.ts` — UAT Round 3 tests now use
  `sourcePath: '/proj/test_repack.json'` so the new precedence still
  derives `test_repack` for the existing conflict-probe sentinels;
  docblock updated.
- `tests/main/repack.parity.spec.ts` + `repack.loose-parity.spec.ts` —
  stale "outDir-derived projectName" comments updated to reflect new
  sourcePath-preferred precedence (no fixture changes; FIXTURE_PNG
  basename matches outDir basename so both yield SIMPLE_TEST).

**verification (automated):** `npm test -- --run` → 111 test files, 1223
tests passing, 0 regressions. Baseline before any change: 1220 tests.
Net +3 tests (new origW/origH coverage + offsets: coverage + parsed
originalWidth/Height regression sentinel).

**verification (manual, user-driven):** awaiting re-export of
`fixtures/SKINS/JOKERMAN_SPINE_ROT.json` → repack-atlas → rotation ON →
0% buffer → no overrides → fresh output folder. Then reload and check:
1. Output filenames: `JOKERMAN_SPINE_ROT.atlas`, `JOKERMAN_SPINE_ROT.png`,
   `JOKERMAN_SPINE_ROT_2.png`, ... (no manual rename needed).
2. Animation Viewer plays without 404s; rotated regions render correctly
   (no upside-down or wrong-pixel slices).
3. Global tab: all rows show 1.000× orange (already-optimized badge); no
   green `<1.000×` rows.

**files_changed:**
- `src/main/atlas-paths.ts`
- `src/core/repack.ts`
- `src/main/atlas-writer.ts`
- `tests/core/repack.spec.ts`
- `tests/main/atlas-writer.spec.ts`
- `tests/main/repack-worker.spec.ts`
- `tests/main/ipc-export.spec.ts`
- `tests/main/repack.parity.spec.ts`
- `tests/main/repack.loose-parity.spec.ts`
- `tests/fixtures/repack-baselines.json`
- `tests/fixtures/repack-expected/SIMPLE_TEST.atlas`

---

### Resolution outcome — Round 2 (2026-05-15, naming re-fix)

**Status:** Round 2 fix applied; all tests green (1231 passing, 0 regressions,
+8 net from new atlas-paths regression coverage). Awaiting user re-export of
JOKERMAN_SPINE_ROT.

**Trigger:** User verified the rotation/math fix from commit `01a7120` works
on real input, but reported the naming fix from commit `e82bc87` is still
broken. New evidence: exporting `JOKERMAN_SPINE_ROT.json` produced `BODY.atlas`
+ `BODY.png` + `BODY_2.png` + `BODY_3.png` — the basename of the first
attachment PNG (BEACHMAN/BODY.png), NOT the JSON.

**Round-1 fix was based on a false assumption.** The docblock at
`src/main/atlas-paths.ts:54-65` asserted that `plan.rows[0].sourcePath` in
atlas-source mode shares a basename with the JSON. In reality, in
atlas-source mode `rows[0].sourcePath` is a per-attachment PNG path
(`images/BEACHMAN/BODY.png`), not the skeleton JSON. The two are
divergent — the equivalence the docblock claimed does not hold.

**Round-2 root cause:** missing explicit channel for the skeleton identity
from plan-build time to atlas-write time. `buildExportPlan` had every piece
of context it needed (caller passes `summary.skeletonPath`), but did not
thread it onto the returned `ExportPlan`. `deriveProjectName` was left
inferring the identity from per-region row data, which is fundamentally
ambiguous in atlas-source mode.

**Round-2 fix (single atomic change with mechanical fanout):**
- `src/shared/types.ts` — added required `skeletonPath: string` field to
  `ExportPlan` interface. Docblock notes the field is set by
  `buildExportPlan` from `BuildExportPlanOptions.skeletonPath` at plan-build
  time and is the canonical source identity for atlas-mode output naming.
- `src/core/export.ts` — added required `skeletonPath: string` to
  `BuildExportPlanOptions`; `opts` parameter is now required (was optional);
  returned plan carries `skeletonPath: opts.skeletonPath`. The locked
  parity contract with the renderer mirror means both files must update
  together (enforced by `tests/core/export.spec.ts` parity describe block).
- `src/renderer/src/lib/export-view.ts` — mirrors the core change byte-for-
  byte (same field, same signature, same return shape).
- `src/main/atlas-paths.ts` — `deriveProjectName` rewritten: PRIMARY reads
  `plan.skeletonPath` basename (strip `.json` case-insensitive, `:` guard);
  FALLBACK is outDir basename (defensive for synthetic test plans). The
  broken per-row heuristic is removed. Docblock now explains both the
  corrected provenance source and the round-1 failure mode for future
  readers.
- All `buildExportPlan` call sites updated to thread the skeleton path:
  - `src/renderer/src/components/AppShell.tsx` — 4 call sites (lines
    787, 936, 1072, 1205) read `summary.skeletonPath` or
    `effectiveSummary.skeletonPath` from the in-scope summary.
  - `src/core/atlas-preview.ts` + `src/renderer/src/lib/atlas-preview-view.ts`
    — the `buildAtlasPreview` indirect call sites pass `summary.skeletonPath`.
- `tests/main/atlas-paths.spec.ts` — NEW dedicated regression spec for
  `deriveProjectName` + `pageFilename`. 8 cases including the exact
  reproduction (`skeletonPath: '/abs/path/JOKERMAN_SPINE_ROT.json'`,
  `rows[0].sourcePath: '/abs/path/images/BEACHMAN/BODY.png'`, outDir
  `/tmp/test_repack/` → returns `'JOKERMAN_SPINE_ROT'`, NOT `'BODY'`, NOT
  `'test_repack'`).
- All synthetic `ExportPlan` literals across ~16 test files updated to
  include `skeletonPath: '/proj/test.json'` (or a value derived from
  `FIXTURE_PNG` where SHA256 baselines depend on a specific projectName).
- `tests/core/export.spec.ts` (~50 buildExportPlan call updates) +
  `tests/regression/path-indirection.spec.ts`, +6 other test files —
  the new required 3rd-arg `BuildExportPlanOptions` opts with
  `skeletonPath` is threaded through every call site (TypeScript caught
  all of them; no silent bypasses possible).
- `tests/main/ipc-export.spec.ts` — UAT Round 3 tests now drive
  projectName via `skeletonPath` (5 blocks rewritten); docblock updated
  to reflect round-2 contract and note round-1's failure mode.
- `tests/main/repack.loose-parity.spec.ts` + `tests/main/repack.parity.spec.ts`
  — `makePlan` helpers' `skeletonPath` default updated; outdated
  precedence comments refreshed.

**Files changed (round 2):**
- `src/shared/types.ts`
- `src/core/export.ts`
- `src/renderer/src/lib/export-view.ts`
- `src/main/atlas-paths.ts`
- `src/core/atlas-preview.ts`
- `src/renderer/src/lib/atlas-preview-view.ts`
- `src/renderer/src/components/AppShell.tsx`
- `tests/main/atlas-paths.spec.ts` (new)
- `tests/core/export.spec.ts`
- `tests/core/atlas-preview.spec.ts`
- `tests/core/export-rotation-dims.spec.ts`
- `tests/core/loader-atlas-less.spec.ts`
- `tests/core/loader-dims-mismatch.spec.ts`
- `tests/core/sequence-attachment-fanout.spec.ts`
- `tests/regression/path-indirection.spec.ts`
- `tests/main/ipc-export.spec.ts`
- `tests/main/repack-worker.spec.ts`
- `tests/main/repack.parity.spec.ts`
- `tests/main/repack.loose-parity.spec.ts`
- `tests/main/image-worker.spec.ts`
- `tests/main/image-worker.passthrough.spec.ts`
- `tests/main/image-worker.atlas-extract.spec.ts`
- `tests/main/image-worker.integration.spec.ts`
- `tests/main/image-worker.strip-whitespace.spec.ts`
- `tests/main/image-worker.sharpen.spec.ts`
- `tests/main/image-worker-rotation.spec.ts`
- `tests/renderer/optimize-dialog-passthrough.spec.tsx`
- `tests/renderer/optimize-dialog-passthrough-rows.spec.tsx`
- `tests/renderer/optimize-dialog-output-card.spec.tsx`
- `tests/renderer/optimize-dialog-buffer.spec.tsx`
- `tests/renderer/optimize-dialog-auto-expand-error.spec.tsx`

**Lesson learned:** when a fix relies on inference from data that is
mode-divergent (atlas-source vs atlas-less mode here), thread the
canonical identity explicitly through the data structure instead of
re-inferring it at the consumer. The round-1 docblock claimed an
equivalence (`plan.rows[0].sourcePath` basename ≈ JSON basename in both
modes) that holds in atlas-less mode but fails in atlas-source mode. The
right shape is a single source of truth on the plan itself — set once at
plan-build time where the unambiguous skeleton path is known
(`summary.skeletonPath`), then read directly by every consumer without
re-inference. TypeScript's required-field enforcement converts this from
a runtime contract into a compile-time one.

**verification (automated):** `npm test -- --run` → 112 test files, 1231
tests passing, 0 regressions. Baseline before round 2: 1223 tests (after
round 1). Net +8 tests (new `tests/main/atlas-paths.spec.ts` regression
sentinel covering both the round-1 falsification case and the round-2
fix).

**verification (manual, user-driven):** awaiting re-export of
`fixtures/SKINS/JOKERMAN_SPINE_ROT.json` → repack-atlas → rotation ON →
0% buffer → no overrides → fresh output folder. Expected:
1. Output filenames: `JOKERMAN_SPINE_ROT.atlas`, `JOKERMAN_SPINE_ROT.png`,
   `JOKERMAN_SPINE_ROT_2.png`, `JOKERMAN_SPINE_ROT_3.png` (NOT
   `BODY.*`, NOT `test_repack.*`).
2. `.atlas` internal page-header lines reference `JOKERMAN_SPINE_ROT.png`
   / `_2.png` / `_3.png` to match on-disk filenames.
3. Animation Viewer plays without 404s (downstream of fix 1).
4. Global tab: all rows show 1.000× orange (unchanged from round 1 —
   verified working by user).
