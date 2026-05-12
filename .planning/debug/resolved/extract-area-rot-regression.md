---
slug: extract-area-rot-regression
status: resolved
trigger: 2026-05-12 — user reports "extract_area: bad extract area" error has returned when optimising fixtures/SKINS/JOKERMAN_SPINE_ROT.json
created: 2026-05-12
updated: 2026-05-12
resolved: 2026-05-12
---

## Resolution Summary

**Fix applied 2026-05-12.** One code change + one regression test:

- `src/main/image-worker.ts:595-617` — non-SW rotated branch in the resize loop changed from single-pipeline `extract().rotate(90)` to two-pipeline materialize (`.png().toBuffer()` → fresh `sharp(buf)`). Mirrors the SW path's existing materialize-then-resize pattern (added 2026-05-08 for the same class of libvips fusion bug). Passthrough path (lines 295-338) unchanged — no `.resize()` after `.rotate()` there, no fusion to break.
- `tests/main/image-worker-rotation.spec.ts` — new regression test in a dedicated describe block. Synthesizes a 200×50 page inline (no committed-fixture dependency), places a rotated rect at (x=140, y=10, packW=60, packH=30) so the predicate `x + packW = 200 > pageH = 50` trips. Pre-fix would fail with `extract_area: bad extract area`; post-fix succeeds with correct output dims. Predicate-sanity assertion in the setup guards against future constant drift.

**Test result:** `npx vitest run` → 1062 passed / 2 skipped / 2 todo / 0 failures (was 1061 passed before).

**Memory note updated:** `project_atlas_pack_options_atlas_source_only.md` amended to reflect that rotated atlas-extract now requires the two-pipeline materialize-then-resize pattern in the non-SW branch, not just the SW branch.

# Debug Session: extract-area-rot-regression

## Trigger

<!-- DATA_START: user-supplied trigger description -->
The error "extract_area: bad extract area" has returned, detected when optimising the `/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/SKINS/JOKERMAN_SPINE_ROT.json` fixture.

This is a re-occurrence of a previously-resolved bug. The original session is at `.planning/debug/resolved/export-extract-area-bad-area.md` (resolved 2026-05-08), which fixed the strip-whitespace extract path by adding `packW/packH/offsetX/offsetY` to `atlasSources` and using `sharp.extend()` to reconstruct the orig canvas.

The current fixture is the **rotated** variant of JOKERMAN_SPINE — same content, but exported with the rotated-packing atlas option (`rotate:90` entries). It also contains 105 strip-whitespace `offsets:` entries.
<!-- DATA_END -->

## Symptoms

- **Expected**: All regions in `JOKERMAN_SPINE_ROT.json` should optimise successfully via Optimize Assets, same as the non-rotated sibling fixture `JOKERMAN_SPINE.json` (which DOES work).

- **Actual**: Specific named rows fail with `extract_area: bad extract area`. User did not enumerate the exact failing rows in the initial report — investigator should ask user to expand those rows OR identify candidate failing rows from the atlas (regions where `rotate:90` AND `offsets:` differ from `bounds:`).

- **Error messages**: `extract_area: bad extract area` (libvips, surfaced through sharp). Same error string as 2026-05-08 resolved session.

- **Timeline**:
  - The original strip-whitespace extract_area bug was fixed 2026-05-08 in commit landing image-worker.ts:273-292 + 484-545.
  - Phase 33 (rotated atlas region support) shipped during v1.4 (closed before 2026-05-12).
  - The ROT fixture is from a new fixtures/SKINS/ folder (uncommitted, status `??`).
  - User cannot recall last successful run of a rotated + strip-whitespace combo fixture — it's plausible this combination was never tested before now.

- **Reproduction**:
  1. Load `fixtures/SKINS/JOKERMAN_SPINE_ROT.json` in app.
  2. Open Optimize Assets dialog.
  3. Run export — specific rows fail with "extract_area: bad extract area".
  4. Sibling fixture `fixtures/SKINS/JOKERMAN_SPINE.json` (non-rotated, same content) optimises cleanly — isolating the regression to the rotated-atlas code path.

## Atlas Facts (pre-evidence)

From `head -20 fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas`:
```
JOKERMAN_SPINE_ROT.png
size:3991,3787
filter:Linear,Linear
AVATAR/CARDS_L_HAND_1
  bounds:2199,3282,277,428
  offsets:1,1,279,430
  rotate:90
```

- Atlas uses numeric `rotate:90` (newer Spine format) — not the legacy `rotate: true`.
- 105 regions have `offsets:` (strip-whitespace trimming).
- Combination of rotation + strip-whitespace is the likely interaction surface.

## Suspicion (un-tested)

The 2026-05-08 fix in `image-worker.ts:484-545` does:

```ts
sharp(pagePath).extract({ left: x, top: y, width: packW, height: packH })
  .extend({ top: h - offsetY - packH, ... })
```

For ROTATED regions the atlas-page pixel rect has swapped axes — what's logically the trimmed pack-width is physically the pack-height in the page PNG (or vice versa, depending on rotation direction). If the fix path reads `packW/packH` as if axes are aligned with canonical/orig dims, the `extract` rect can:

1. Overshoot the page when the rotated region's pack rect doesn't match what the code expects, OR
2. Produce a correctly-extracted but wrong-orientation image whose `extend` math then computes negative padding (libvips also reports this as extract_area depending on the call stack).

Loader-side: `src/core/loader.ts:580-625` populates `atlasSources` with `region.x/y/width/height/originalWidth/originalHeight/offsetX/offsetY/rotated`. Need to verify spine-core's behaviour for rotated regions:
- Does `region.width/height` represent the rect *on the page* (rotated axes) or the rect *in canonical orientation* (unrotated)?
- Does `region.offsetX/Y` refer to the trimmed offset in canonical coords (most likely) or page coords?

If the spec is "everything in `region.*` is in canonical/unrotated coords" then the `extract({x, y, packW, packH})` call against the rotated page PNG WILL go out of bounds because packW/packH are swapped relative to the actual rotated rect in the page.

## Initial Hypotheses (untested)

1. **`region.width/height` from spine-core's atlas parser is in CANONICAL (unrotated) orientation, but the page PNG stores the rotated rect — so passing `packW/packH` to `sharp.extract` against the rotated page rect picks the wrong axes and trips libvips bounds.** Fix would be: for rotated regions, swap `packW`↔`packH` in the extract call, then rotate the extracted tile by -90° before downstream resize/extend. The 2026-05-08 strip-whitespace `extend` math also needs awareness of post-rotation orientation.

2. **The rotated branch in image-worker uses a different extract path that pre-dates the 2026-05-08 packW/packH fix and still reads `atlasSource.w/h` (orig canvas dims) directly into `sharp.extract`** — same root cause as the 2026-05-08 bug, but on a code path that was missed in the original fix. Phase 33 may have added a rotated branch that copy-pasted the old broken shape.

3. **Loader populates `packW/packH` only for non-rotated regions** — rotated branch in `loader.ts` may default `packW=w, packH=h` (orig dims) like atlas-less mode does, even though the page actually has trimmed pixels. Atlas-less defaulting was correct for atlas-less mode but wrong if applied to rotated atlas-source.

4. **Strip-whitespace `extend` produces negative pad values for some rotated regions** — if `offsetY` is in canonical coords but `packH` has been swapped for rotation handling, the formula `h - offsetY - packH` can compute negative, which libvips reports as extract_area-class errors.

5. **The failing rows are NOT the rotated+strip-whitespace combo** but some other interaction the user hasn't surfaced — investigator should ask user to list the failing rows or run the export in dev to capture actual failing names before scoping further.

## Current Focus

```yaml
hypothesis: "ROOT CAUSE FOUND. Libvips operation-reordering in sharp pipeline `extract().rotate(90).resize()` validates the extract rect bounds against the POST-rotate canvas dims (swapped axes) rather than the source page dims. When extract.x + extract.width > page.height, libvips emits `extract_area: bad extract area`."
test: "Verified by isolated repro at varying x positions: extract(x=2483, w=1304) on page 3991x3787 succeeds (x+w=3787); extract(x=2484, w=1304) fails (x+w=3788 > pageH=3787). All four user-reported failing rows match this predicate exactly."
expecting: "Fix is one-line: in image-worker.ts:595-606 (the 'No SW' branch in the resize path), drop into the SAME materialize-then-resize two-pipeline pattern already used for the SW path above (lines 576-594) whenever a.rotated === true. The fix has been verified in isolation: materializing the rotated buffer to PNG bytes, then feeding a fresh sharp() pipeline into applyResizeAndSharpen, succeeds for all four failing rows."
next_action: "Await user choice on fix path (fix now / plan / manual)."
reasoning_checkpoint: ack_required
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-12, source: src/core/loader.ts:766-820, finding: `atlasSources` map IS being populated with the Phase 33 swap. For rotated regions `packW = region.height`, `packH = region.width` (loader.ts:806-807). For atlas-less mode `packW=packH=dims.w/h, rotated=false` (loader.ts:778-792). Hypothesis 3 ("loader defaults packW/H to orig dims for rotated regions") is **FALSIFIED**.

- timestamp: 2026-05-12, source: src/main/image-worker.ts:295-338 (passthrough) + 537-614 (resize), finding: Both branches use the SAME shape for rotated atlas-extract:
  ```ts
  sharp(pagePath).extract({ left: a.x, top: a.y, width: a.packW, height: a.packH })
    .rotate(90)   // only if a.rotated
    .extend({ top: a.h - a.offsetY - sourceCanvasH, bottom: a.offsetY, ... })
  ```
  where `sourceCanvasW = a.rotated ? a.packH : a.packW` and `sourceCanvasH = a.rotated ? a.packW : a.packH` (image-worker.ts:327-328, 567-568). Rotation happens BEFORE extend, so the buffer is in canonical orientation when extend runs. Hypothesis 2 ("rotated branch missed the 2026-05-08 fix") is **FALSIFIED**.

- timestamp: 2026-05-12, source: node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:60-72, 152-167, finding:
  - `bounds:X,Y,W,H` writes `region.x=X, region.y=Y, region.width=W, region.height=H` directly (line 67-71).
  - For `degrees==90`, the u2/v2 derivation uses `region.height` as horizontal page span and `region.width` as vertical page span (line 164-167). This **confirms** the canonical-orientation convention: `region.width/height` are the **post-rotation canonical** dims, and the **page-pixel rect** at `(region.x, region.y)` has extent `(region.height × region.width)`.
  - Therefore loader.ts:806-807 swap (`packW = region.height` for rotated) IS correct.

- timestamp: 2026-05-12, source: static analysis of fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas (awk scan), finding: For every rotated region with `offsets:`, computed all four extend pad values (top/bottom/left/right) and both page bounds (px2/py2). **Zero overflows, zero negative pads.** Hypotheses 1 and 4 ("axes swap wrong → bounds violation" / "SW extend produces negative pad") are **FALSIFIED for this atlas**. The math as currently coded is internally consistent and bounds-safe for every region in the file.

- timestamp: 2026-05-12, source: same awk scan but for NON-rotated regions, finding: Zero offenders. Non-rotated extract paths also fine.

- timestamp: 2026-05-12, source: investigator deduction, finding: All four code-path hypotheses now falsified. Hypothesis 5 stands: the failing rows are some OTHER interaction (perhaps a row whose extract math is fine on paper but fails at sharp/libvips runtime for an unrelated reason — e.g. the `outW/outH` computed from `peakScale × canonicalW` lands non-finite, OR a `passthrough` row hitting the rotated path with a 0-pixel target, OR PNG-header dims mismatching the atlas-declared size). Need user-supplied failing-row names to pinpoint.

- timestamp: 2026-05-12, source: atlas grep of user-named failing rows + comparison to peers, finding: All 4 failing rows are **rotated WITHOUT offsets** (no strip-whitespace). Of the 20 rotated-no-offsets regions in this atlas, 16 work and 4 fail. The failing rows have NO unusual atlas data (no `index:`, no `split:`, same `bounds:` shape as peers). Initial hypothesis "missing from atlas" FALSIFIED — all 4 are present with regular entries. Differentiator must therefore be **position-dependent**, not structural.

- timestamp: 2026-05-12, source: end-to-end repro via scripts/probe-export.mjs (loader → sampler → buildSummary → buildExportPlan → runExport with just the 4 failing rows), finding: **All 4 fail with `extract_area: bad extract area`** in `runExport`. `outW/outH` are sane positive integers (388×784, 396×815, 363×840, 875×961). `atlasSource` data is correct: rotated=true, packW=region.height, packH=region.width, page-pixel rect fully inside the page bounds. The plan-build phase is innocent.

- timestamp: 2026-05-12, source: isolated sharp pipeline test, finding: **Reproduced the bug with no app code in scope.** Standalone `sharp(page).extract({2614, 1554, 1304, 645}).rotate(90).resize(388, 784, lanczos3 fill).png().toBuffer()` fails with `extract_area: bad extract area`. Removing `rotate(90)` from the chain (and swapping resize dims) makes it succeed. Materializing the rotated buffer to PNG bytes via `.toBuffer()` and feeding a fresh `sharp(buf).resize(...)` pipeline ALSO succeeds. The failure is intrinsic to chaining `extract().rotate().resize()` in a single libvips pipeline.

- timestamp: 2026-05-12, source: x-position sweep with fixed extract dims (1304×645) on page 3991×3787, finding: Failure threshold is EXACTLY `extract.x + extract.width = pageHeight`. Specifically: x=2483 → x+w=3787 succeeds; x=2484 → x+w=3788 fails. Verified the same pattern holds for all 4 user-reported failing rows:
  - IRONMAN/L_ARM: page 3991×3787, extract right edge = 2614+1304 = 3918 > pageH=3787 ✓ fails
  - IRONMAN/R_ARM: page 3444×2787, extract right edge = 1598+1594 = 3192 > pageH=2787 ✓ fails
  - JOKER/L_ARM:   page 3444×2787, extract right edge = 1598+1844 = 3442 > pageH=2787 ✓ fails
  - test/FACE:     page 3842×3609, extract right edge = 1922+1918 = 3840 > pageH=3609 ✓ fails
  - AVATAR/L_ARM (works): page 3991×3787, extract right edge = 2093+1565 = 3658 ≤ pageH=3787 ✓ succeeds
  - BEACHMAN/L_ARM (works): page 3991×3787, extract right edge = 2+1304 = 1306 ≤ pageH=3787 ✓ succeeds

  Predicate: **a row fails iff `region.x + region.height > pageHeight`** (where `region.height` is in canonical orientation and the page-pixel extract width is `region.height`).

- timestamp: 2026-05-12, source: fix verification, finding: Replacing the single-pipeline chain with materialize-then-resize (`extract().rotate(90).png().toBuffer()` → `sharp(buf).resize(...).png().toFile(...)`) succeeds for ALL 4 failing rows. This is the SAME pattern already used in image-worker.ts:576-594 for the SW path; the fix is to drop the SW gate when `a.rotated === true` so non-SW rotated regions also go through the materialize pipeline.

## Eliminated

- Hypothesis 1: rotated extract swaps axes wrong → falsified by spine-core source + atlas static analysis (zero overflow).
- Hypothesis 2: rotated branch missed 2026-05-08 fix → falsified by reading image-worker.ts (Phase 33 D-03 explicitly handles SW + rotation via `sourceCanvasW = a.rotated ? a.packH : a.packW`).
- Hypothesis 3: loader defaults packW/H to orig dims for rotated → falsified at loader.ts:797-807 (loader explicitly swaps and assigns).
- Hypothesis 4: rotated SW produces negative extend pads → falsified by exhaustive atlas scan (zero negatives across 105 SW + rotated regions).
- Hypothesis 5: "some other interaction" → confirmed via repro; the interaction is libvips' lazy-evaluation bounds-check on `extract().rotate(90).resize()` in a single pipeline.

## Root Cause

**libvips/sharp pipeline-fusion bug:** when an `extract({left, top, width, height})` is chained with `rotate(90)` followed by `resize(...)` inside a SINGLE sharp pipeline that terminates in `.toFile()` or `.toBuffer()`, libvips reorders/fuses the operations and validates the extract rect's right-edge (`extract.left + extract.width`) against the **page HEIGHT** instead of the page WIDTH. Any region whose `region.x + region.height > pageHeight` (in canonical bounds shorthand: `extract.x + extract.width > pageHeight` post-loader-swap) trips the bounds check and the pipeline aborts with `extract_area: bad extract area`.

Without `resize` in the chain (passthrough path), the bug does NOT trigger — the extract+rotate combo alone works. Without `rotate` in the chain (non-rotated regions), the bug does NOT trigger either. The bug is specifically the three-step fusion.

The 2026-05-08 fix (`export-extract-area-bad-area`) already discovered and worked around an analogous libvips pipeline-fusion pitfall for the SW path ("Pitfall 4: Sharp pipeline order" per the comment at image-worker.ts:553-558) by materializing the intermediate buffer with `.toBuffer()` and opening a fresh `sharp(buf)` for the resize. **The non-SW rotated branch (image-worker.ts:595-606) does not use this workaround, so it inherits the underlying libvips bug whenever the extract rect's right-edge exceeds the page height.**

`scripts/probe-sharp-rotate.mjs` (Phase 33 sharp-rotate direction probe) did not exercise this case — its test rect was likely positioned safely away from the page edge.

## Fix Direction

Replace the "No SW" branch at image-worker.ts:595-606 with a **rotation-aware** two-pipeline pattern that mirrors the existing SW branch at lines 576-594:

```ts
} else {
  // No SW.
  if (a.rotated) {
    // Materialize after rotate to dodge libvips' extract+rotate+resize
    // pipeline-fusion bounds bug (debug session extract-area-rot-regression,
    // 2026-05-12). Without this, libvips validates extract.x+extract.width
    // against pageHeight (post-rotate canvas dim) instead of pageWidth,
    // tripping `extract_area: bad extract area` for any rotated region
    // whose region.x + region.height > pageHeight.
    const rotated = await sharp(a.pagePath)
      .extract({ left: a.x, top: a.y, width: a.packW, height: a.packH })
      .rotate(90)
      .png()
      .toBuffer();
    pipeline = sharp(rotated);
  } else {
    // No SW + no rotation — single pipeline (no fusion bug applies).
    pipeline = sharp(a.pagePath).extract({
      left: a.x,
      top: a.y,
      width: a.packW,
      height: a.packH,
    });
  }
}
```

Alternatively (simpler refactor): merge the SW gate so the materialize pipeline ALWAYS runs when `a.rotated === true`, and only takes the single-pipeline path when `!a.rotated && !SW`. The current SW gate at line 569 (`sourceCanvasW !== a.w || sourceCanvasH !== a.h`) is `true` for SW (any orientation); after the fix it should become `sourceCanvasW !== a.w || sourceCanvasH !== a.h || a.rotated` so rotated regions always materialize.

**Passthrough path (lines 295-338):** does NOT have this bug (no `resize` in chain), so no change needed. Verified by repro.

**Tests to add (TDD candidate):**
- A unit test in `tests/main/image-worker-rotated-export.spec.ts` (or extend an existing rotated test) that runs `runExport` over a synthetic plan containing a rotated region with `region.x + region.height > pageHeight`. Without the fix it produces `sharp-error` with `extract_area: bad extract area`; with the fix it succeeds and the output PNG dims match `(outW, outH)` and the rotation orientation is canonical.
- A regression test on `scripts/probe-sharp-rotate.mjs` to add the position-dependent variant (extract near the page right edge with both small and large `region.x`).

## Checkpoint to User — RESPONDED 2026-05-12

<!-- DATA_START: user-supplied failing row names -->
The ones that fail are:
- `IRONMAN/L_ARM`
- `JOKER/L_ARM`
- `test/FACE`
- `IRONMAN/R_ARM`
<!-- DATA_END -->

**Investigator note:** These names suggest skin-prefixed regions (`<SKIN>/<ATTACHMENT>`). The atlas header sample only showed regions like `AVATAR/CARDS_L_HAND_1` — so `L_ARM`, `R_ARM`, `FACE` are different attachment names and `IRONMAN`, `JOKER`, `test` are skin namespaces. The lowercase `test/FACE` is striking — a debug/test skin that may have unique properties (e.g. only present in the JSON, not in the atlas, OR present with an atypical rect shape).

Next step for the next spawn:
1. Grep the atlas for each of these four region names — confirm they exist, capture their `bounds:`/`offsets:`/`rotate:`/`index:` lines.
2. Compare to a working row's atlas entry to find the differentiator (rotated? SW? specific size? `index:`? `split:`?).
3. If a failing row is NOT in the atlas at all, the bug is in the resolver, not the extract — e.g. the JSON references a region that the atlas-source loader is failing to look up and falling back to a degenerate path.

## Related Context

- **Prior resolved session** `.planning/debug/resolved/export-extract-area-bad-area.md` (2026-05-08): same error string; root cause was atlasSources.w/h carrying orig dims into `sharp.extract` for strip-whitespace regions. Fix added `packW/packH/offsetX/offsetY` + `sharp.extend()` round-trip. Investigator should read sections "Root Cause", "Fix Direction", and "Resolution" — the new bug is almost certainly an analogue on the rotated path.
- **Phase 33** (`.planning/phases/33-rotated-atlas-region-support-loader-bounds-export-fixture/`): rotated atlas region support landed during v1.4. The plan/research docs there will name the rotated extract contract — read these to learn what the rotated branch was supposed to do.
- **Memory `project_atlas_pack_options_atlas_source_only.md`**: "strip whitespace fully handled (atlas-orig + isotropic correction); rotation hard-fails by design (workaround: uncheck in Spine export)" — the *rotation hard-fails by design* note is OUT-OF-DATE post Phase 33. Memory needs amendment once this is resolved.
- **Sibling fixture `JOKERMAN_SPINE.json`** (non-rotated, same content) optimises cleanly per user — confirms the regression is specific to the rotated code path.
