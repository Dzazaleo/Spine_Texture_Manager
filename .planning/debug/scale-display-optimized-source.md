---
status: resolved
trigger: "Scale column shows ~0.5x instead of 1.000x when source images are already at peak dims; Optimize dialog shows already-optimized images as needing further downscaling"
created: 2026-05-05
updated: 2026-05-05
---

## Current Focus

hypothesis: "In canonical (atlas-source) mode the loader derives actualDimsByRegion from atlas.region.originalWidth/Height (= canonicalW), never reading on-disk PNG dims. When the user pre-optimizes images to match the export target, the system cannot detect that the on-disk file is already at optimal size."
test: "Load a project in canonical mode whose images/ folder contains PNGs smaller than the atlas region dims. Verify Scale column and passthrough classification."
expecting: "After fix: Scale = 1.000x for attachments whose on-disk PNG = outW; Optimize shows those as passthrough COPY rows."
next_action: "DONE — fix applied, type signature corrected, AnimationBreakdownPanel sibling-fix added, fresh build produced."

## Symptoms

expected:
  - When source image dims = peak dims (e.g., L_ARM_TOP source 263x395, peak 263x395), scale column shows 1.000x
  - Optimize dialog reads actual file dims from disk (the already-optimized PNGs), not atlas/canonical dims
  - No repeated downscaling when already-optimized images are the source

actual:
  - Scale column shows 0.484x for L_ARM_TOP despite source=263x395 and peak=263x395
  - Scale appears calculated as peak_dims / canonical_dims (full-atlas dims), not peak_dims / source_dims
  - Optimize dialog shows L_ARM_TOP as 542x816 → 263x395 (~2.1x smaller), reading canonical dims from atlas instead of actual file
  - 47 of 75 images flagged for resize even though they are already at optimal dims

errors: "none — silent wrong output"

timeline: "User suspects regression; changed source to Images folder of already-optimized images and scale display did not update. After first fix-pass user reported bugs persist; second pass investigation found stale renderer build."

reproduction:
  - Load a Spine project backed by a full-size atlas
  - Run Optimize Assets to produce optimized images in a local Images folder
  - Change project source to point to the Images folder containing already-optimized PNGs
  - Observe: scale column still shows ~0.5x instead of 1.000x for all optimized assets
  - Observe: Optimize dialog still shows all images as needing resize

## Evidence

- loader.ts line 553-566: in atlas-source (canonical) mode, actualDimsByRegion was populated from atlas.region.originalWidth/Height (= canonicalW), NOT from on-disk PNG reads. Phase 22.1 G-01 D-01 intentionally removed PNG reads in canonical mode to fix a TexturePacker-scaling stale-data bug. Side effect: pre-optimized images on disk are invisible to the system.
- export-view.ts line 328: passthrough predicate was `outW === acc.row.sourceW`. In canonical mode sourceW = canonicalW (e.g. 542). outW = ceil(canonicalW * effScale) = ceil(542 * 0.484) = 263. 263 !== 542 → resize row, even though the actual on-disk file is already 263 pixels wide.
- computeExportDims returned effScale = outW/canonicalW = 263/542 = 0.484. This is what the Scale column displayed. The user expected outW/actualSourceW = 263/263 = 1.000x.
- sampler.ts line 343: sourceW = sd.w from sourceDims map. In canonical mode sourceDims comes from atlas.region.originalWidth = canonicalW = 542. Correct for the sampler's scale computation but misleads the display.
- GlobalMaxRenderPanel showed row.effectiveScale (canonical-relative) not source-relative scale.

### Round 2 evidence (after user reported "fix did not work")

- `out/renderer/assets/index-BQdBMoW9.js` was last modified May 1 21:36; `out/main/index.cjs` was rebuilt May 5 14:31. The user was running a stale renderer build (no `displayScale` field in the bundled JS) while the main process had the new loader code. `grep -c displayScale out/renderer/.../index-*.js` returned 0 against the stale bundle, vs 14 against the freshly rebuilt bundle.
- TypeScript signature on `computeExportDims` declared the return type as `{ effScale; outW; outH }` but the body returned `{ effScale, outW, outH, displayScale }`. `tsc --noEmit -p tsconfig.web.json` reported `TS2353: Object literal may only specify known properties, and 'displayScale' does not exist in type ...` and a corresponding `TS2339: Property 'displayScale' does not exist on type ...` at GlobalMaxRenderPanel.tsx:222. esbuild/Vite ignored the type errors at runtime, but the type signature was nonetheless inconsistent.
- `AnimationBreakdownPanel.enrichCardsWithEffective` did NOT destructure `displayScale` and the per-animation Scale column still rendered `row.effectiveScale.toFixed(3)` (canonical-relative). Sibling panel inconsistency — would have re-emerged the same bug for users who looked at the per-animation breakdown rather than the global panel.

## Eliminated

- Atlas-less mode (loaderMode='atlas-less'): NOT the user's scenario. User left the project in canonical mode (sibling .atlas still exists). The "Images folder" they referenced is the images/ subfolder, not a loaderMode change.
- Bug in peakScale computation: peakScale = bone world scale = 0.484 is CORRECT — the rig authors the attachment at 48.4% of canonical size. The issue is purely display + passthrough detection.
- Regression: this is a structural gap. The Phase 22.1 G-01 fix was correct for its use case but didn't account for the "pre-optimized images" workflow.
- Round 2: Logic error in fix — the math is correct (verified by hand-tracing L_ARM_TOP through computeExportDims; sourceRatio cap binds, outW = actualSourceW = 263, displayScale = 1.000).

## Resolution

root_cause: "Two coupled defects: (A) Original code path: in canonical mode, the loader derived actualSourceW from atlas.region.originalWidth (= canonicalW = 542) rather than reading PNG IHDR bytes; passthrough predicate compared outW to canonicalW so already-optimized PNGs always fell through to the resize branch. (B) Round-2 (why the first fix appeared not to work): user ran a stale renderer build — `out/renderer/assets/index-*.js` dated May 1 21:36 had zero references to `displayScale`, while `out/main/` had been rebuilt May 5 14:31 with the new loader. The TypeScript return-type of `computeExportDims` was also missing `displayScale`, which is harmless at runtime under esbuild but signaled the inconsistency. AnimationBreakdownPanel was missed entirely by the first pass."
fix: "Round-1 + Round-2 changes:
  Round 1 (already on disk): (1) src/core/loader.ts: canonical-mode PNG IHDR reads re-enabled with a 'strictly smaller on both axes' guard — PNG dims replace atlas dims only when the on-disk file is smaller than the atlas baseline. (2) src/core/export.ts: passthrough predicate uses effectiveSourceW (= actualSourceW when PNG < canonicalW, else sourceW). (3) src/renderer/src/lib/export-view.ts: same passthrough predicate fix plus displayScale = outW/actualSourceW added to computeExportDims return. (4) src/renderer/src/panels/GlobalMaxRenderPanel.tsx: Scale column and rowState use displayScale (source-relative) instead of effectiveScale (canonical-relative).
  Round 2 (this session): (5) src/renderer/src/lib/export-view.ts: corrected `computeExportDims` return-type annotation to include `displayScale: number` (TS2353 cleared). (6) src/renderer/src/panels/AnimationBreakdownPanel.tsx: sibling-symmetric fix — destructure displayScale from computeExportDims, add it to EnrichedBreakdownRow, render `row.displayScale.toFixed(3)` in the Scale column, pass displayScale into rowState (both virtualized and non-virtualized branches). (7) Ran `npx electron-vite build` to produce a fresh `out/renderer/assets/index-BTjWjPlh.js` containing 14 displayScale references (was 0 in stale bundle). User must restart the running Electron app to pick up the new bundles."
verification: "Tests: 371/373 pass (1 skipped, 1 todo) across tests/core/ + key tests/renderer/. Pre-existing failures (3) in tests/renderer/atlas-preview-modal.spec.tsx + tests/renderer/save-load.spec.tsx are reproduced byte-identically by reverting only my Round-2 changes — caused by other unstaged AppShell.tsx modifications, not by this debug fix. Bundle verification: out/main/chunks/sampler-*.cjs contains the canonical-mode `dims.width < atlasW` guard; out/renderer/assets/index-BTjWjPlh.js contains 14 displayScale references. Hand-trace for L_ARM_TOP (canonical 542×816, on-disk 263×395, peakScale 0.484): sourceRatio = min(263/542, 395/816) = 0.4841, effScale = 0.484, outW = ceil(542×0.484) = 263, displayScale = 263/263 = 1.000 ✓; isPassthrough = (263===263 && 395===395) = true → row classified as passthrough COPY ✓."
files_changed:
  - src/core/loader.ts
  - src/core/export.ts
  - src/renderer/src/lib/export-view.ts
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx (Round 2)
tests_updated:
  - tests/core/loader-atlas-source-dims.spec.ts
  - tests/core/loader.spec.ts
  - tests/core/export.spec.ts

## Specialist Review

(Not invoked in Round 2 — root cause was build/plumbing rather than language-specific, and Round 1 already had specialist coverage for the math-side fix.)
