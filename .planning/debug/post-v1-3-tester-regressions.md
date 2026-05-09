---
slug: post-v1-3-tester-regressions
status: diagnosed
trigger: tester-feedback
created: 2026-05-07
updated: 2026-05-07
---

## CYCLE 2 RESOLUTION — root cause found (cluster 1, bugs a/b/c)

**Root cause:** `analyzer.ts` looks up `atlasSources`, `sourcePaths`, `canonicalDimsByRegion`, and `actualDimsByRegion` by `peak.attachmentName` (the spine attachment ENTRY name, e.g. `9_FRAME_0`). The loader populates all four maps keyed by **atlas region name** (e.g. `6/9_FRAME_0`). When a Spine attachment uses `path:` indirection (`entry.name !== att.path`), every lookup MISSES.

For Chicken's `SYMBOLS.json`: 249 of 531 spineable attachment bindings use `path:` indirection (e.g. slot `6_FRAME` → entry `9_FRAME_0` with `path: "6/9_FRAME_0"`). All 249 lose atlasSource + sourcePath + canonical/actual dims at the analyzer.

**Why each bug surfaces:**

| Bug | Surface | Mechanism |
|-----|---------|-----------|
| a, b: "atlas preview only shows optimized images" / "images missing" | `AtlasPreviewModal` Original mode | `deriveInputs` mode='original' iterates summary.peaks. Path-indirected peaks have `peak.atlasSource=undefined`, `peak.sourcePath=''`. In `AtlasCanvas` useEffect (AtlasPreviewModal.tsx:507-510), `sourceUrl = region.atlasSource?.pagePath ?? region.sourcePath = ''`; `sourceUrl ? loadImage(sourceUrl) : null` → `img=null` → no draw, no missing-placeholder (isMissing for empty key = false). Only the outline rectangle is drawn. Direct (non-indirected) attachments DO render their pixels — hence the "some regions render, most don't" partial-success pattern. |
| Optimized mode appears to work | `deriveInputs` mode='optimized' | `buildExportPlan` (export.ts:166) explicitly skips `if (!row.sourcePath) continue` — path-indirected rows are silently EXCLUDED from the plan, so they never reach the optimized projection. The user sees fewer regions but each has content. From the user's POV: "Optimized works." |
| c: "Optimize action failed to export images missing in the atlas" | `runExport` consumes `buildExportPlan` output | Same root cause — path-indirected rows are dropped at export.ts:166, so the export pipeline never attempts them. The user sees that "missing" images stay missing post-export. |

**Code citations:**
- Bug locus: `src/core/analyzer.ts:219-220` (analyze) and `src/core/analyzer.ts:341-348` (analyzeBreakdown).
- Loader-side keys (correct, by region name): `src/core/loader.ts:469` (sourceDims), `src/core/loader.ts:510` (sourcePaths), `src/core/loader.ts:557` (actualDimsByRegion), `src/core/loader.ts:604` (atlasSources). Region name = `att.path ?? entryName` (loader.ts:223; canonicalDimsByRegion).
- Sampler-side: `src/core/sampler.ts:247-248` (correctly resolves `regionName = attachment.region?.name` for sourceDims lookup) and line 261 (`attachmentName: entry.name`). Sampler is correct; analyzer's downstream lookups are wrong.
- Symptom site: `src/renderer/src/modals/AtlasPreviewModal.tsx:508-510` and the Optimized-mode skip at `src/core/export.ts:166`.

**Why the working fixtures don't reproduce:** Joker (5 path entries — likely PathConstraint, not attachment paths), Girl (5 — same), 3Queens (0 path-indirected attachments), SIMPLE_PROJECT (0). All four working fixtures have `entry.name === atlas region.name` for every binding. Chicken has 249 mismatches — uniquely vulnerable.

**Predicted minimal fix (DIAGNOSE-ONLY — do not apply):**

The sampler ALREADY resolves the atlas region name via `attachment.region?.name` (sampler.ts:247) — but discards it. Two layers of fix possible:

(F1, principled) Carry `regionName` (or the resolved atlas-region-name string) as a field on `PeakRecord` so the analyzer can use it for all four map lookups. Touches: PeakRecord type, sampler.ts lines 257-262 (and the ~5 other PeakRecord construction sites), analyzer.ts lines 219-220, 341-359. Single source of truth restored.

(F2, narrow) Have the loader build a `regionByAttachmentName` reverse-index by walking `skeletonData.skins` and folding `entry.name → att.path ?? entry.name`. Pass that into the analyzer alongside the existing maps. The analyzer first resolves attachmentName → regionName via the index, then keys all four map lookups by regionName. Localized to loader.ts (one new map) + analyzer.ts (one indirection). PeakRecord untouched.

F2 is mechanically smaller. F1 is closer to the spine-core idiom (the resolved region.name lives on the Attachment object already).

---

## CYCLE 2 — Cluster 1 hypothesis falsified by user testing

**New evidence (2026-05-07, post-cycle-1):**

1. **Bugs a/b/c reproduce on raw JSON load** (no `.stmproj` involved). Loader-mode toggle shows `atlas-source` correctly after fresh JSON load. ⇒ Cycle-1 cluster-1 hypothesis (`.stmproj` persistence race driving atlas-less mode) is INCOMPLETE — there's a second, independent cause for a/b/c.

2. **Bug is project-specific, not universal:**
   - Reproduces: `fixtures/Chicken/SYMBOLS.json`, tester's `/Users/leo/Downloads/export_test/` SYMBOLS.json, one other unnamed user project.
   - Does NOT reproduce: `fixtures/SIMPLE_PROJECT`, `fixtures/Joker`, `fixtures/Girl`, `fixtures/3Queens`.
   - All 4 working fixtures + Chicken use the modern `bounds:x,y,w,h` atlas format. No rotation, no offsets in any.

3. **Atlas Preview screenshot evidence (Chicken, page 2 of 13):**
   - All 7 region bounding-boxes for page 2 ARE drawn (the renderer KNOWS the regions exist).
   - Pixel CONTENT renders for only some regions; most appear as empty black rectangles.
   - View mode is "Original" (selected). In "Optimized" view the user reports images DO appear — hence bug (b) "atlas preview showing only optimized images" was the user's framing of: "Original view broken; Optimized view fine."

4. **Differences between working (3Queens) and broken (Chicken) atlases:**
   - Both: multi-page, modern bounds format, `pma:true`, non-power-of-2 page sizes, no rotation, no offsets.
   - Chicken: 13 pages, 301 regions, page sizes vary (4040, 4078, 4096, 3974, 2394 etc.), all SQUARE.
   - 3Queens: 6 pages, page sizes vary AND non-square (4094×4070, 4086×3292, 1160×2052).
   - Counter-intuitive: 3Queens has the wilder page-size variation but works. Chicken has square pages but fails.

5. **Chicken page 2 (`SYMBOLS_2.png`, 4040×4040) region list:**
   ```
   12/07  bounds:0,2720,1968,1320
   12/08  bounds:0,1398,1968,1320
   12/12  bounds:1970,2720,1968,1320
   12/13  bounds:0,76,1968,1320
   12/14  bounds:1970,1398,1968,1320
   12/15  bounds:1970,76,1968,1320
   7/MOELAS  bounds:3940,3896,100,144
   ```
   — 6 large regions tile the page; one tiny corner region. Per screenshot, the empty rectangles correspond visually to these 1968×1320 regions.

## Refined hypothesis (cycle 2)

**The "Original" atlas-preview view-mode renders region pixels by cropping from the atlas-page PNGs. For Chicken project, the crop step yields empty pixels for most regions while bounding-box outlines still draw correctly.**

Three sub-hypotheses to falsify:

H2.1 — **Page-image lookup is broken in atlas-preview-view.ts**: code may resolve only the FIRST atlas page (`SYMBOLS.png`) and fail to load `SYMBOLS_2..13.png`. Working fixtures may have all artwork on page 1 (need to verify Joker/Girl/3Queens region distribution). Failing case: regions on pages 2..N return empty.

H2.2 — **Page-image cache key collision**: page PNGs share a basename prefix (`SYMBOLS_*`); a path/URL building step might collapse them or hit a stale cache key.

H2.3 — **`bounds` parsing converts `x,y,w,h` but renderer expects atlas-legacy `x,y,w,h` with bottom-left origin** (Spine atlases ARE top-left, but a recent change might have inverted Y for one code path). Edge regions on large pages (high Y values) would render fine; low-Y regions would crop into negative coords. Needs Y-coord cross-check.

Need to read:
- `src/renderer/src/lib/atlas-preview-view.ts` (222 lines) — view-mode rendering
- `src/renderer/src/modals/AtlasPreviewModal.tsx` (686 lines) — page-switching + image-source
- `src/core/atlas-preview.ts` (231 lines) — region geometry
- Phase 24 commit: `panel-semantics-unused-assets-rewrite-atlas-savings-metric` — most recent atlas-preview rewrite, prime suspect

Cycle-2 priority: bug a/b/c (Original-view rendering broken for multi-page projects).
Bug d remains unverified (need user's literal error text).
Bug e diagnosis from cycle 1 stands (page→canonical override-cap unit mismatch).

---


# Post-v1.3 tester regressions (5-bug cluster)

## Symptoms (verbatim from user)

<DATA_START>
Tester reproductions on `/Users/leo/Downloads/export_test/export_test/SYMBOLS.json` (v1.3.0 build):

a) Images missing on the atlas preview.
b) Atlas preview showing only optimized images.
c) Optimize action failed to export images missing in the atlas.
d) Loading a project made from atlas issued an error about missing atlas-less source — project did not open.
e) An image with `dims = peak`, when clicked override, showed a percentage of 74.82% (project path: 4/CROSS_GEM.png).
<DATA_END>

## Tester project — observed state

Project directory: `/Users/leo/Downloads/export_test/export_test/`

Files present:
- `SYMBOLS.json`, `SYMBOLS.atlas`, `SYMBOLS.png`, `SYMBOLS_2..13.png` (atlas pages)
- `SYMBOLS.stmproj` (saved project state)
- `images/` directory with subfolders `1/ 2/ 3/ 4/ 5/ EGGS/ MOON/ PICK_EFFECT/`

`SYMBOLS.stmproj` content (key fields):
```json
{
  "version": 1,
  "skeletonPath": "SYMBOLS.json",
  "atlasPath": "SYMBOLS.atlas",
  "imagesDir": null,
  "loaderMode": "atlas-less",     // contradictory with atlasPath set
  "overrides": { "L": 900, "3/COFFIN": 900, "3/LID": 53 },
  "samplingHz": 120,
  "sharpenOnExport": false
}
```

CROSS_GEM evidence (bug e): present at `images/4/CROSS_GEM.png` AND in `SYMBOLS.atlas` as region `4/CROSS_GEM`.

## Root-cause analysis — Cluster 1 (bugs a, b, c, d)

**Bugs a, b, c are NOT separate bugs.** They are the symptom of the project running in atlas-less mode while the user expects atlas-source mode. The atlas-less loader path:
- only enumerates regions whose PNG exists at `<skeletonDir>/images/<regionName>.png`
- the rest go to `LoadResult.skippedAttachments` (surfaced in MissingAttachmentsPanel) — NOT into `summary.peaks`
- atlas-preview reads `summary.peaks` (`src/core/atlas-preview.ts:188-208`)
- buildExportPlan reads `summary.peaks` (`src/core/export.ts:164`)

So once the project loads in atlas-less mode, the user sees only the regions whose PNG exists in `images/` (the already-optimized ones from a prior export). Hence:
- a) "images missing" — the not-yet-optimized regions are absent from the preview
- b) "only optimized images" — same fact, different framing
- c) "Optimize failed to export images missing in the atlas" — buildExportPlan can't see them either

**Therefore cluster 1 reduces to one question: how did `loaderMode='atlas-less'` get persisted for a project the user "made from atlas"?**

Analysis trail:
- `setLoaderMode` is called in only 2 places (besides `useState` init):
  1. `mountOpenResponse` line 1080 — restores from `project.loaderMode` (whatever was saved)
  2. The toggle button at AppShell.tsx:1566:
     ```tsx
     setLoaderMode(effectiveSummary.atlasPath === null ? 'auto' : 'atlas-less');
     ```
- Toggle state mutation is IMMEDIATE (synchronous setState) — UI flips before resample completes.
- Resample fires via `useEffect` deps `[samplingHzLocal, loaderMode]` (line 1373) — **async**.
- `buildSessionState` (line 715) reads `summary.atlasPath` (from `summary` prop) and `loaderMode` (local state). After toggle, `loaderMode` is `'atlas-less'`. Until resample completes, `summary.atlasPath` is still set ('SYMBOLS.atlas'). **State is briefly inconsistent.**
- Auto-save fires on Optimize completion (line 1818): `void window.api.saveProject(buildSessionState(), currentProjectPath)`.
- If user toggled to atlas-less, then ran Optimize before the resample landed (or if the resample failed silently — line 1357: `// ok:false: silent — leave the existing summary in place`), the saved .stmproj captures the inconsistency: `atlasPath='SYMBOLS.atlas'` AND `loaderMode='atlas-less'`. Exactly what tester's file shows.

Note: the toggle path itself works; the persistence-during-transition is the bug. The user might also have toggled deliberately. Either way, the .stmproj NEEDS `atlasPath` and `loaderMode` to be consistent — currently nothing enforces this.

**For bug d ("project did not open"):** the precise loader path on reopen is:
1. `materializeProjectFile`: `imagesDir=null` stays null; `atlasPath='SYMBOLS.atlas'` resolved to absolute.
2. `handleProjectOpenFromPath` (project-io.ts:414-420): when `loaderMode==='atlas-less'`, INTENTIONALLY OMITS atlasPath so loader picks D-08 synthesis branch.
3. Loader D-08 (`src/core/loader.ts:304-317`): `dirOfImages = path.join(path.dirname(skeletonPath), 'images')` — hardcoded; does NOT consult `materialized.imagesDir`.
4. `synthesizeAtlasText`: probes `imagesDir` exists. For tester's project, `/Users/leo/Downloads/export_test/export_test/images` DOES exist.
5. Per-region PNG read inside synthesizeAtlasText (line 162): tolerates missing PNGs (emits 1×1 stub + `missingPngs` list since Plan 21-09 G-01).
6. Therefore loader should NOT throw `MissingImagesDirError`.

**There IS a divergence between the user's reported error and the code I read.** Possibilities:
- The actual error message the user saw could be a DIFFERENT error (e.g. `RotatedRegionUnsupportedError`, `AtlasParseError`, sampler-worker failure) and the user's natural-language summary "missing atlas-less source" loosely matched the most-relevant text.
- The synthesizer DOES throw `MissingImagesDirError` only when `!imagesDirExists && regionPaths.size > 0`. We have not verified `regionPaths.size > 0` for SYMBOLS.json or that imagesDir is genuinely a directory at sample time (e.g., a symlink-to-file edge case is possible).
- The error could be coming from the sampler worker spawn (e.g. PNG IHDR read inside the worker hits a permission issue), not the synthesizer.

To verify bug d's exact failure mode we need:
- The literal error text the user saw, OR
- A direct repro running on the tester's exact project.

## Root-cause analysis — Cluster 2 (bug e)

**Site:** `src/renderer/src/components/AppShell.tsx:504-520` — the override-dialog `currentPercent` prefill.

```tsx
const peak = summary.peaks.find((p) => p.attachmentName === row.attachmentName);
let currentPercent = 100;
if (peak !== undefined && peak.peakScale > 0) {
  const stored = overrides.get(row.attachmentName);
  const overrideFrac = stored !== undefined ? clampOverride(stored) / 100 : 1;
  const canonW = peak.canonicalW ?? peak.sourceW;
  const canonH = peak.canonicalH ?? peak.sourceH;
  const sourceRatio =
    peak.dimsMismatch && peak.actualSourceW !== undefined && peak.actualSourceH !== undefined && canonW > 0 && canonH > 0
      ? Math.min(peak.actualSourceW / canonW, peak.actualSourceH / canonH)
      : Infinity;
  const cappedRaw = Math.min(peak.peakScale * overrideFrac, 1, sourceRatio);
  currentPercent = parseFloat(((cappedRaw / peak.peakScale) * 100).toFixed(2));
  currentPercent = clampOverride(currentPercent);
}
```

Trace for CROSS_GEM (no stored override):
- `overrideFrac = 1`
- "dims = peak" displayed → `originalSizeLabel = ${actualSourceW ?? sourceW}×${actualSourceH ?? sourceH}` and `peakSizeLabel = ${worldW}×${worldH}` are visually equal → `worldW ≈ actualSourceW`, so `peakScale = worldW/sourceW ≈ actualSourceW/sourceW`.
- For atlas-source mode, the loader sets `actualSourceW = region.originalWidth` (atlas-derived). `sourceW` = same atlas value (passed through analyzer's `p.sourceW`). So `peakScale ≈ 1.0`.
- `dimsMismatch` is true when `|actualSourceW - canonicalW| > 1` — true for CROSS_GEM (atlas-page-scaled vs JSON canonical).
- `sourceRatio = min(actualSourceW/canonW, actualSourceH/canonH)` — fractional, e.g. ~0.7482.
- `cappedRaw = min(1.0 × 1, 1, 0.7482) = 0.7482`
- `currentPercent = (0.7482 / 1.0) × 100 = 74.82%` ← **matches user's observation**.

**Why this is wrong:** the user-perceived "100%" means "ship at exactly the world demand the sampler observed." The cap at line 515 enforces "outW ≤ canonicalW" (defensive: don't extrapolate beyond design dims), but for the atlas-source path where `actualSourceW = region.originalWidth < canonicalW`, this cap binds even when there is no real over-allocation risk — the sampler's `peakScale` is already region-relative.

**This is exactly the locked invariant cited in `project_peak_anchored_invariants.md`:** "mesh peakScale needs page→canonical correction in hullAreaRatio". The peakScale in atlas-source mode should be canonical-relative for math to compose with the canonical-relative cap. Either:
- **(F1)** Apply page→canonical correction at the sampler/analyzer boundary so peakScale is canonical-relative in BOTH modes (memory-aligned; preserves all downstream math).
- **(F2)** Detect "no cap actually binding" (peak demand within actual source) at the prefill site only, and short-circuit to 100% (renderer-only patch).

F1 is the principled fix per the locked invariant. F2 is a renderer band-aid that may leave the cap drift visible elsewhere (export plan, OptimizeDialog).

## Locked invariants (do NOT relitigate — see CLAUDE.md + memory)

- Strict `loaderMode` separation (atlas-source vs atlas-less are self-contained; locked 2026-05-06).
- `computeExportDims` must use `canonicalW` as outW base.
- Peak-anchored override invariants: peakScale page→canonical correction; canonical-relative applyOverride; Peak column shows world demand not export dims.
- Phase 6 export sizing: uniform-only on both axes.

## Current Focus

```yaml
hypothesis: "CYCLE 2 ROOT CAUSE — Cluster 1 (bugs a/b/c): analyzer.ts (lines 219-220 and 341-359) keys atlasSources/sourcePaths/canonicalDims/actualDims lookups by peak.attachmentName (= entry.name from skin), but the loader populates all four maps by region.name (= att.path ?? entry.name). Path-indirected attachments (entry.name != path) lose all four lookups. Chicken has 249 such bindings — explains partial-success rendering in Original mode (only direct attachments draw pixels) and silent exclusion from Optimized mode (export.ts:166 skips rows with empty sourcePath)."
test: "ROOT CAUSE FOUND. Verified by: (1) reading all four loader keying sites; (2) reading sampler's attachmentName assignment (entry.name not regionName); (3) reading analyzer's two lookup sites; (4) tracing the canvas's empty-sourceUrl branch; (5) finding the export.ts:166 silent-skip; (6) counting 249 indirected bindings in Chicken vs 0 in working fixtures."
next_action: "Hand off to user for fix selection (F1 vs F2). Bug e diagnosis from cycle 1 stands. Bug d still requires literal error text."
reasoning_checkpoint:
  hypothesis: "analyzer.ts looks up loader-side maps by peak.attachmentName, but loader keys them by region.name (= att.path ?? entry.name). For attachments where path != entry.name, all four lookups MISS, producing peaks with no atlasSource, no sourcePath, no canonical dims, and no actual dims. Original-mode atlas preview falls through to 'undefined ?? \"\"' and skips drawImage; Optimized-mode export plan filters out rows with empty sourcePath at export.ts:166."
  confirming_evidence:
    - "fixtures/Chicken/SYMBOLS.json: 249 attachments use path != entry.name (e.g. slot=6_FRAME, entry=9_FRAME_0, path=6/9_FRAME_0). 0 in 3Queens, SIMPLE_PROJECT, Joker, Girl."
    - "Loader keys: loader.ts:223 (regionName=att.path??entryName) used for canonicalDims; loader.ts:469/510/557/604 use region.name (also = att.path??entry.name in spine-ts) for sourceDims/sourcePaths/actualDimsByRegion/atlasSources."
    - "Analyzer keys: analyzer.ts:219-220 + 341-348 use peak.attachmentName for all four lookups."
    - "Sampler emits peak.attachmentName = entry.name (sampler.ts:261) which is the SKIN entry name, not the atlas region name."
    - "export.ts:166 explicit `if (!row.sourcePath) continue` — rows with empty sourcePath are silently dropped from buildExportPlan output."
    - "AtlasCanvas at AtlasPreviewModal.tsx:508-548: empty sourceUrl produces `img=null`, skips both content-draw and missing-placeholder branches; only the outline at lines 555-561 is drawn."
  falsification_test: "If the hypothesis is wrong, fixing the analyzer to look up by region.name instead of attachmentName would NOT make Chicken's path-indirected attachments render in Original mode. Conversely, manually patching the analyzer to resolve regionName via the skin's path field for one attachment should produce visible pixel content for that attachment specifically."
  fix_rationale: "F2 (loader builds attachmentName→regionName reverse-index, analyzer indirects through it) addresses the keying mismatch directly without changing PeakRecord shape. F1 (carry regionName on PeakRecord) is the more principled long-term fix — the resolved region.name lives on Attachment objects in spine-ts, so the sampler is discarding information it already has."
  blind_spots: "Have not run the codebase to empirically confirm Chicken renders 282 of 531 with images and 249 outline-only. Have not confirmed the exact dedup behavior in analyze.ts when two peaks for two different entry names collide on the same atlas region (Chicken's `4/CROSS_GEM` vs `12/05` — distinct entry names so no dedup collision in this case, but a fixture where two slots share one atlas region would test this). Bug d's relationship to this issue is unverified — d may be downstream (path-indirected attachment fails sampler dims lookup → ProjectFileParseError or sampler crash) but cycle-1 diagnosis pointed at .stmproj inconsistency which is orthogonal."
```

## Evidence

- timestamp: 2026-05-07T00:00:00Z
  finding: ".stmproj at /Users/leo/Downloads/export_test/export_test/SYMBOLS.stmproj has internally contradictory state: loaderMode=atlas-less, atlasPath=SYMBOLS.atlas, imagesDir=null."
  source: "direct file read"

- timestamp: 2026-05-07T00:00:00Z
  finding: "All 5 callers of loaderMode-thread (project-io.ts Sites 1, 3, 4, 5 + sampler-worker.ts) correctly omit atlasPath when loaderMode==='atlas-less' so the loader's D-08 synthesis branch fires (line 304 of loader.ts). Loader hardcodes dirOfImages=<skeletonDir>/images. For tester's project this dir exists with subfolders, so MissingImagesDirError should NOT throw."
  source: "src/main/project-io.ts:414-420, 710-715, 913-921; src/main/sampler-worker.ts:113-119; src/core/loader.ts:304-317; src/core/synthetic-atlas.ts:128-151"

- timestamp: 2026-05-07T00:00:00Z
  finding: "AppShell.tsx:1566 setLoaderMode(effectiveSummary.atlasPath === null ? 'auto' : 'atlas-less') — toggle is functional but synchronous mutation of loaderMode while summary.atlasPath update is async via useEffect [samplingHzLocal, loaderMode] (line 1373). Inconsistent (atlasPath, loaderMode) is persistable via buildSessionState (line 715) which reads both from independent sources. Optimize completion auto-save (line 1818) is fire-and-forget — can capture the transient inconsistent state."
  source: "src/renderer/src/components/AppShell.tsx:715-756, 1296-1373, 1565-1568, 1818"

- timestamp: 2026-05-07T00:00:00Z
  finding: "atlas-preview projection (src/core/atlas-preview.ts:188-208) and buildExportPlan (src/core/export.ts:164) both consume summary.peaks. In atlas-less mode, summary.peaks contains only regions whose PNG exists in imagesDir; missing-PNG regions go to summary.skippedAttachments. Hence bugs a/b/c are downstream symptoms of bug d (loaderMode='atlas-less' active when atlas-source intended)."
  source: "src/core/atlas-preview.ts:188-208; src/core/export.ts:164; src/core/loader.ts:622-642"

- timestamp: 2026-05-07T00:00:00Z
  finding: "Bug e numerical trace: peak.peakScale ≈ 1.0 (worldW ≈ actualSourceW for 'dims=peak' rows), peak.dimsMismatch=true (atlas page packed at scale ≠ canonical), peak.actualSourceW/canonW ≈ 0.7482 (page→canonical scale factor). Math at AppShell.tsx:515 is min(peakScale * 1, 1, 0.7482) = 0.7482; currentPercent = (0.7482/1.0) × 100 = 74.82%. Matches observed value exactly."
  source: "src/renderer/src/components/AppShell.tsx:504-520; src/core/analyzer.ts:97-149; src/core/loader.ts:554-562"

- timestamp: 2026-05-07T-cycle2
  finding: "Chicken SYMBOLS.json has 249 path-indirected attachments (entry.name != att.path) out of 531 spineable bindings. Sample: slot=6_FRAME, entry=9_FRAME_0, path=6/9_FRAME_0. The atlas declares region '6/9_FRAME_0'; the sampler emits peak.attachmentName='9_FRAME_0' (entry.name); analyzer.ts:220 looks up atlasSources by '9_FRAME_0' → MISS (atlasSources is keyed by '6/9_FRAME_0'). Result: 249 peaks have peak.atlasSource=undefined, peak.sourcePath='', peak.canonicalW/H=peak.sourceW/H fallback, peak.actualSourceW/H=undefined. Working fixtures (3Queens, SIMPLE_PROJECT, Joker, Girl) have ZERO path-indirected attachment bindings."
  source: "src/core/loader.ts:223 (regionName = att.path ?? entryName), src/core/loader.ts:469/510/557/604 (all four maps keyed by region.name), src/core/sampler.ts:261 (attachmentName=entry.name), src/core/analyzer.ts:219-220+341-348 (lookups by p.attachmentName); fixtures/Chicken/SYMBOLS.json + .atlas"

- timestamp: 2026-05-07T-cycle2
  finding: "Original-mode renderer trace for path-indirected attachment: AtlasPreviewModal.tsx:508 sourceUrl = region.atlasSource?.pagePath ?? region.sourcePath = undefined ?? '' = ''. Line 510 img = sourceUrl ? loadImage(sourceUrl) : null = null. Lines 511-548 first branch (img truthy) skipped, second branch (isMissing) skipped because missingPaths.has('') is false. Only the bottom outline (lines 555-561) is drawn. Matches user's screenshot: outlines visible, pixel content absent for affected regions."
  source: "src/renderer/src/modals/AtlasPreviewModal.tsx:507-563"

- timestamp: 2026-05-07T-cycle2
  finding: "Optimized-mode silently excludes path-indirected rows: src/core/export.ts:166 has 'if (!row.sourcePath) continue' inside the bySourcePath grouping loop. The 249 indirected peaks all have sourcePath='', so they're skipped wholesale before plan emission. plan.rows + plan.passthroughCopies contain only the 282 direct peaks. deriveInputs (atlas-preview.ts:181) iterates only those, producing a smaller-but-complete optimized projection — explains why the user sees Optimized as 'working'."
  source: "src/core/export.ts:166; src/core/atlas-preview.ts:181-208"

## Eliminated

- "loaderMode persistence simply ignores active state" — eliminated. The save path correctly persists `state.loaderMode` (project-file.ts:314). The bug is upstream: the (atlasPath, loaderMode) pair is allowed to drift inconsistently in AppShell state.
- "atlas-preview has its own atlas-less filter" — eliminated. atlas-preview reads `summary.peaks` only; no loaderMode-conditional filtering.
- "buildExportPlan has its own atlas-less filter" — eliminated. Same as above.
- (Cycle 2) **H2.1 — atlas-preview-view.ts only loads first atlas page** — eliminated. The page PNG path is correctly carried per-region via `peak.atlasSource.pagePath = path.resolve(path.join(atlasDir, region.page.name))` (loader.ts:605); no first-page bias in the renderer (atlas-preview-modal.tsx:191).
- (Cycle 2) **H2.2 — page-image cache key collision** — eliminated. Cache key is full absolute path (atlas-preview-modal.tsx:147); paths differ per page (`/.../SYMBOLS.png`, `/.../SYMBOLS_2.png`, ...). No collision.
- (Cycle 2) **H2.3 — Y-coordinate origin inversion regression** — eliminated. `region.atlasSource.x/y/w/h` are the spine-ts atlas-region coords (top-left origin, matching libgdx/Spine convention) and pass directly to `ctx.drawImage` srcRect (top-left). Both producer and consumer agree.

## Resolution

### Cluster 1 — proposed fixes (3 layers; defense-in-depth):

1. **(L1) Make `buildSessionState` self-consistent.** When `loaderMode === 'atlas-less'`, write `atlasPath: null`. When `loaderMode === 'auto'`, write `atlasPath: summary.atlasPath`. This is the minimal one-line fix that prevents the contradictory `.stmproj` state from being saved.

2. **(L2) Make the validator reject the inconsistent pair.** In `validateProjectFile` (src/core/project-file.ts), reject the combination `loaderMode === 'atlas-less' && atlasPath !== null`. Surfaces as `ProjectFileParseError` on Open. Prevents already-saved bad files from blocking forever.

3. **(L3) Healing migrate.** On Open, if a v1 file shows `loaderMode='atlas-less'` AND `atlasPath !== null`, snap to a coherent state — the safer choice given user's "made from atlas" report is to flip `loaderMode='auto'` (atlas-source semantics) and keep `atlasPath` as the source of truth. This rescues the tester's existing .stmproj without destroying their overrides.

For bug d's exact failure mode: need the literal error text from tester. If the L3 healing migrate is applied, the tester's project will reopen in atlas-source mode regardless of the precise throw site — bug d may be auto-resolved.

### Cluster 2 — proposed fixes:

- **(F1, principled)** Apply page→canonical correction to `peakScale` in atlas-source mode at the sampler/analyzer boundary so peakScale is always canonical-relative. The compute is `peakScale_canonical = peakScale_region * (actualSourceW / canonicalW)`. After this fix, the override prefill math at AppShell.tsx:515 produces correct 100% for "dims = peak" rows. ALSO fixes any downstream Phase 22 cap-binding inconsistencies (OptimizeDialog "Capped" indicator, etc).
- **(F2, narrow)** Patch only the prefill at AppShell.tsx:504-520 to detect "no cap binds" (peak.peakScale * overrideFrac ≤ sourceRatio AND ≤ 1) and surface 100% directly. Lower risk; doesn't touch sampler math.

Recommend F1 — aligned with the locked invariant `project_peak_anchored_invariants.md`.
