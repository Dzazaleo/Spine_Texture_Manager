---
slug: variant-peaks-differ-green
status: resolved
trigger: 2026-05-25 — user confused why an EXPORTED VARIANT (e.g. @0.5x, @0.1x), reopened in the app, still shows Peak < Source savings (green-tinted Peak cells) instead of being "already optimized"; and why some rows look like Peak == Source yet are still green
created: 2026-05-25
updated: 2026-05-25
goal: find_root_cause_only
---

# Debug Session: variant-peaks-differ-green

## Trigger

<!-- DATA_START: user-supplied trigger description -->
why does the app reading of peaks differ from source when a variant is made? Should,'t the variant images be optimized? Sometimes the peak and source are the same, but the peak is colored green, as if it could get optimized. First two screenshors are from /Users/leo/Downloads/42/SKINS_SPINE_V02.json and /Users/leo/Downloads/42/SKINS_SPINE_V02.json

The other two screenshots are from /Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json and  /Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json

Investigate, and report using simple terms in your explanation
<!-- DATA_END -->

## Symptoms

- **Expected**: After exporting a scaled VARIANT of a skeleton (e.g. `@0.5x`), reopening that variant JSON in the app should show its textures as "already right-sized" — Peak ≈ Source, ~no green savings — because (the user reasons) the variant was just produced by the app and "should be optimized."
- **Actual**:
  1. The reopened variant STILL shows many rows where **Peak W×H < Source W×H** (green-tinted Peak cells, Scale < 1.000×), i.e. the app reports there is still savings to be had.
  2. The variant's overall "pixel savings" chip is LOWER than the master's but NOT zero (TEST_ARMAN: master **83.4%** → variant @0.5x **20.6%**; the 42 rig: master **8.5%** vs another view **11.8%**).
  3. Some rows appear to show **Peak == Source numerically yet are still colored green** ("as if it could get optimized").
- **Error messages**: None. Pure read-model / display-semantics question. No crash.
- **Timeline**: Surfaced now (2026-05-25), just after the v1.7 multi-scale variant exporter milestone shipped. This is the first close look at *reopening* an exported variant and comparing its Peak/Source readout to the master's.
- **Reproduction**:
  1. Open master `/Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json` → Global tab shows 324 regions, **83.4% pixel savings**; CROWN_ANIM_HD/* rows are deep green (957×928 → 422×409, 0.441×).
  2. Open variant `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json` → 324 regions, **20.6% pixel savings**; CROWN rows no longer hugely green, but many other rows are mildly green (~0.99×) and a few are clearly green (GRAND 0.846×, L_SKIRT 0.877×).
  3. Second pair (0.1x variant): master `/Users/leo/Downloads/42/SKINS_SPINE_V02.json` vs variant `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json`.

## Divergence Context

- **Files confirmed on disk** (orchestrator verified):
  - TEST_ARMAN (clean master/variant pair, both 324 regions — screenshots 3 & 4):
    - master `/Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json`
    - variant `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json`
  - 42 rig:
    - master `/Users/leo/Downloads/42/SKINS_SPINE_V02.json` (+ `.atlas` + 3 `.png` pages → **atlas-source** rig)
    - variant `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json`
  - NOTE: the user's trigger pasted the V02 path twice (typo) for "the first two screenshots." Screenshots 1 (23 regions, JOKERMAN skin) and 2 (51 regions, ANGEL/DEMON skins) look like two DIFFERENT rigs/skin-views, not obviously the V02 master/variant — treat the **TEST_ARMAN pair as the authoritative, verifiable comparison**; use the V02↔V02@0.1x pair as a cross-check (esp. for the atlas-source `actualSourceW` drift theory, since V02 has a real `.atlas`).
- **Key architecture fact (orchestrator pre-read of `src/main/variant-export.ts`)**: variant export does NOT merely uniform-scale the rig. Its plan is built by:
  `plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {...})`
  i.e. it runs the **same optimizer/export-plan builder as "Optimize Assets"** on the master peaks scaled by `s` (variant_peak = s × master_peak, per file header L-02). So the variant's emitted PNGs ARE peak-right-sized at export time — the variant is "optimized." The geometry JSON itself comes from `bake(skeletonJson, s)` (uniform similarity bake of all coordinates by `s`).
- **Two distinct operations the user is likely conflating** — confirm and explain in simple terms:
  - **Export Variant** = scaled DELIVERABLE copy of the whole rig (geometry baked ×s) whose textures are also peak-optimized at ×s.
  - **Optimize Assets** = the right-sizing optimizer itself (the green savings the table shows = what THIS would recover).
- Relevant project memories: `project_compute_export_dims_canonical_base` (sourceW≠canonicalW in atlas-source drift; outW + sourceRatio both use canonicalW), `project_peak_anchored_invariants` ("Peak column shows world demand, NOT export dims"; applyOverride is canonical-relative), `project_phase6_default_scaling` (uniform-only export sizing), `project_multi_scale_peak_bone_world_scale` (variant = full SkeletonJson.scale bake; variant_peak = s × master_peak).

## Initial Hypotheses (untested — verify against the ACTUAL files + code)

1. **"Optimized variant still shows savings" is mostly a RE-MEASUREMENT + ROUNDING artifact, not recoverable savings.** When the variant is reopened, the app RE-SAMPLES peak world-scale from scratch on the baked rig and RE-DERIVES source dims. The export plan rounds export dims UP (`Math.ceil`) and clamps ≤ source / never upscales; on reopen the freshly measured peak lands a hair BELOW the rounded source dim for almost every attachment → perpetual ~0.99× (green) that is not actually recoverable. PREDICTION: the bulk of the variant's green rows are 0.985–0.999×, and re-exporting/re-optimizing the variant would NOT meaningfully shrink them further (savings asymptote, not a real loss). → Verify the ceil/clamp in `buildExportPlan` / `computeExportDims` and the peak re-derivation; check the variant's row scales cluster just under 1.0.

2. **83.4% → 20.6% drop is REAL and CORRECT: the variant export already collapsed the giant over-sizes.** Master CROWN_ANIM_HD/* (957×928 → 422×409 = 0.441×, ~80% per-frame savings) is ~80+ of the 324 regions and dominates the master's pixel-area savings. The variant exported those frames peak-right-sized, so on reopen CROWN source ≈ peak → ~0% savings each, dragging the aggregate down to the residual of the OTHER regions (~20%). → Verify by diffing master vs variant JSON `width`/`height` for a CROWN frame: is variant CROWN ≈ master_peak × s (optimized) and NOT master_source × s (uniform)?

3. **"Peak == Source numerically but still green" = display-rounding + actualSourceW comparison mismatch (two sub-causes).** In `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`: `rowState(peakDisplayW, actualSourceW ?? sourceW)` returns `'under'` (GREEN) when `peakDisplayW < actualSourceW`, `'atLimit'` (yellow) when equal. (a) The Peak W×H cell shows INTEGER dims but the tint/Scale derive from the UNROUNDED float — so a row can DISPLAY "N×M / N×M" yet be green because the true peak is N−0.4 (rounds to N for display) < source N. (b) The color compares against **`actualSourceW`** (canonical / atlas-original), which can DIFFER from the displayed `sourceW` (atlas-source drift) — so the Source column shows one number while the green/yellow decision uses another. → Confirm which sub-cause fires on the user's actual green-but-equal rows (the 42 atlas-source rig is the best probe for sub-cause (b)).

4. **Possible genuine inconsistency to rule in/out: variant JSON `width`/`height` (uniform-baked = master_source × s) vs variant PNG pixels (optimizer-written = master_peak × s) disagree, and reopen reads "source" from one and "peak" from the other → savings reappear.** This is the one candidate that could be a real defect rather than expected/aesthetic. → Diff the variant JSON attachment dims against the actual variant PNG IHDR dims (and atlas, if present) for a known-oversized attachment; determine which the loader treats as "Source W×H" on reopen (atlas-less synthetic-atlas from PNG IHDR vs JSON width/height).

## Current Focus

```yaml
hypothesis: RESOLVED. H2 + H3a + H1 confirmed (all expected-by-design). H4 CONFIRMED as a real defect, with a sharper diagnosis than H4 stated — see Resolution. The spurious green is NOT a re-measurement asymptote; it is a structural mismatch between the variant's two halves for attachments authored SMALLER than they render (peakScale > 1).
test: (done) Diffed master vs variant JSON width/height; read variant atlas bounds/offsets + loose-PNG pixels; traced loader.ts source-dim derivation, export.ts/export-view.ts computeExportDims, GlobalMaxRenderPanel rowState; replicated the exact panel green/yellow decision on real loader+sampler output for both rigs; ran a re-optimize-the-variant probe.
expecting: (met) variant JSON dims = master_source × s (uniform bake); variant atlas/PNG dims = master_peak × s (optimizer); the two AGREE when peakScale ≤ 1 (→ yellow at-limit, correct) and DISAGREE when peakScale > 1 (→ spurious green). Re-optimizing the variant would shrink those PNGs toward the JSON's authored size, which would UNDER-size them for the baked rig's real render demand.
next_action: none — root cause found; goal is find_root_cause_only. Report written in plain terms. Fix NOT applied.
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-25 — **(orchestrator seed) Variant export reuses the optimizer.** `src/main/variant-export.ts`: `plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {...})`. File header states "L-02: variant_peak = s × master_peak by arithmetic (scaleSummaryPeaks)" and geometry via `bake(skeletonJson, s)` from `src/core/scale-bake.js`. ⇒ a freshly exported variant's textures are peak-right-sized (optimized) at export time; the geometry JSON is a uniform similarity bake.
- timestamp: 2026-05-25 — **(orchestrator seed) Peak-cell color rule.** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`: `rowState(peakDisplayW, sourceW)` → GREEN when `peakDisplayW < sourceW`, YELLOW when `===`. Called as `rowState(row.peakDisplayW, row.actualSourceW ?? row.sourceW, ...)`.
- timestamp: 2026-05-25 — **(orchestrator seed) On-disk artifacts.** 42 master is atlas-source; both variants confirmed to contain a real `.atlas` + loose `images/` (atlas-source on reopen).
- timestamp: 2026-05-25 — **VARIANT FOLDER LAYOUT (enumerated).** `TEST_ARMAN/variant/SYMBOLS@0.5x/` = `SYMBOLS.json` + `SYMBOLS.atlas` + 2 packed PNG pages (`SYMBOLS.png`, `SYMBOLS_2.png`) + a loose `images/` tree. `42/SKINS_SPINE_V02@0.1x/` = `.json` + `.atlas` + 1 packed PNG + loose `images/` (ANGEL/, DEMON/). Both are **atlas-source on reopen** (sibling `.atlas` present), so "Source W×H" derives from the atlas, NOT from PNG IHDR.
- timestamp: 2026-05-25 — **★ THE SPLIT: variant JSON dims ≠ variant atlas/PNG dims (the core finding).** For ARMAN CROWN_ANIM_HD/00: master JSON `width×height` = 957×928; variant JSON = **478.5×464 = exactly master_source × 0.5** (uniform bake). But the variant ATLAS region `bounds:890,477,211,205` + `offsets:0,0,211,205` and the variant loose PNG IHDR = **211×205 = master_peak (421×408) × 0.5** (optimizer output). The two halves of the SAME variant disagree. For STAR: JSON 116×115.5 (=232×0.5) vs atlas/PNG 148×147 (=peak 414×0.5). For GRAND: JSON 208.5×63 (=417×0.5) vs atlas/PNG 247×75 (=master_peak 492.9×0.5).
- timestamp: 2026-05-25 — **WHY they diverge (source vs peak base).** `bake(sourceJson, s)` (src/core/scale-bake.ts) scales the JSON `width`/`height` by `s` → SOURCE-based dims. `scaleSummaryPeaks(summary, s)` (src/core/scale-summary-peaks.ts) scales ONLY `peakScale` by `s` and LEAVES canonicalW/sourceW at MASTER size; `buildExportPlan` then writes the PNG at `outW = ceil(canonicalW × min(s·peakScale, 1, sourceRatio))` (export.ts:403). For ARMAN GRAND: master canonicalW=417, master peakScale=1.182 → outW = ceil(417 × (0.5×1.182)) = ceil(246.5) = **247** = PEAK-based. So PNG = master_peak × s, JSON = master_source × s. They only AGREE when peakScale ≤ 1 (then peak ≤ canonical, both clamp to peak).
- timestamp: 2026-05-25 — **Loader source-derivation on reopen (atlas-source).** src/core/loader.ts:776-794 + 873-881: in atlas-source mode BOTH `sourceDims` and `actualDimsByRegion` come from `region.originalWidth/Height` (the atlas `offsets:`/orig line). `canonicalDimsByRegion` comes from JSON `width`/`height` (D-01). So on reopening the ARMAN variant: Source column (`actualSourceW`) = 247 (atlas), canonicalW = 208.5 (JSON). They differ → `dimsMismatch=true`.
- timestamp: 2026-05-25 — **Panel peak/color math (replicated on real loader+sampler output).** `computeExportDims` (src/renderer/src/lib/export-view.ts:270-272): `peakDisplayEff = min(safeScale(peakScale), 1, sourceRatio)`, `peakDisplayW = ceil(canonicalW × peakDisplayEff)`. For reopened ARMAN GRAND: re-measured peakScale≈1.182 (rig baked, geometry preserved), canonicalW=208.5, sourceRatio=247/208.5=1.185 → `peakDisplayEff = min(1.182, 1, 1.185) = 1.0` (clamps at canonical) → peakDisplayW = ceil(208.5×1.0)=**209**. `rowState(209, actualSourceW=247)` → 209 < 247 → **GREEN, displayScale 209/247 = 0.846×** — EXACTLY the user's reported GRAND 0.846×. For CROWN (peakScale 0.44 < 1): peakDisplayW = ceil(478.5×0.44)=211 == actualSourceW 211 → **YELLOW** (the "no longer hugely green" the user saw). Repro script: scripts/_repro_panel_state.mts (deleted after run).
- timestamp: 2026-05-25 — **State distribution (both rigs, replicated).** ARMAN @0.5x (324 regions): **57 spurious-green (peakScale>1)** + 56 rounding-green (peakScale≤1, cluster 0.50–0.998× — the H1 asymptote) + 211 YELLOW at-limit + 0 neutral. 42 @0.1x (51 regions): **22 spurious-green** + 3 rounding-green + 26 YELLOW. The user's flagged rows reproduce EXACTLY: ARMAN GRAND 0.846×, ARMAN L_SKIRT 0.877×, and 42 ANGEL/L_SKIRT 0.877×. The spurious-green class (peakScale>1) is the dominant visible green; it is the bug.
- timestamp: 2026-05-25 — **Re-optimize probe (would the green actually shrink anything?).** Running `buildExportPlan` on the REOPENED ARMAN variant: GRAND → RESIZE to 209×63 (from 247), CARD_1_C → 327 (from 435), "11" → 247 (from 459). So the green is NOT cosmetic — a re-optimize WOULD rewrite these PNGs SMALLER, down to the JSON's authored (canonical) size. BUT the baked rig actually RENDERS GRAND up to ~247px (peak 492.9×0.5), so shrinking to 209 would UNDER-size the texture (runtime upscales it → quality loss). Repro: scripts/_repro_reoptimize.mts (deleted after run). ⇒ the spurious green points at a shrink that should NOT be taken; it is a misleading read, and re-optimizing the variant is actively harmful for peakScale>1 attachments.
- timestamp: 2026-05-25 — **Master is internally consistent (bug is variant-only).** On the MASTER ARMAN, GRAND canonicalW=417 == atlas-orig 417 → no dimsMismatch; peakScale 1.182 clamps to 1.0 → peakDisplay 417 == source 417 → YELLOW/passthrough (correct). The JSON-vs-atlas split exists ONLY in the variant, because the variant builds geometry from source-dims (bake) and pixels from peak-dims (scaleSummaryPeaks+buildExportPlan).

## Eliminated

- **H3 sub-cause (a) "integer-display-of-sub-1.0-float" is NOT the user's green-but-equal cause.** `peakDisplayW` is itself a `Math.ceil(...)` integer (export-view.ts:271) and `rowState` compares two integers — there is no hidden float. A row that shows "N×M / N×M" is YELLOW, not green. The user's "Peak == Source but green" rows are actually **Source(atlas)=247 vs Peak(canonical-clamped)=209** — the two NUMBERS differ, but they look "the same size" to the eye at small deltas, and the Scale reads 0.846×. So the real mechanism is H3 sub-cause (b) — the green/yellow decision compares against `actualSourceW` (atlas) while Peak is computed from `canonicalW` (JSON) — generalized into the H4 split. (Sub-cause (a) remains theoretically possible for a genuine sub-pixel peak but did not fire on any observed row.)
- **H1 as the PRIMARY explanation — downgraded.** The ceil/clamp rounding asymptote is REAL and explains the 56/324 (ARMAN) and 3/51 (42) mildly-green peakScale≤1 rows clustered just under 1.0 — those are benign and not recoverable. But it is NOT the explanation for the user's clearly-green rows (GRAND, L_SKIRT). Those are the peakScale>1 spurious-green class (H4).

## Resolution

```yaml
root_cause: >
  For attachments whose artwork is drawn SMALLER than it is rendered at runtime
  (peakScale > 1), a variant package is internally inconsistent: its geometry
  JSON stores SOURCE-based dimensions (bake scales JSON width/height by s) while
  its texture PNGs are written at PEAK-based dimensions (scaleSummaryPeaks scales
  only peakScale, then buildExportPlan sizes the PNG at canonicalW × s·peakScale,
  which for peakScale>1 exceeds canonicalW × s). On reopen of the (atlas-source)
  variant, the Source column reads the larger atlas/PNG size while the Peak column
  is computed from the smaller JSON size and clamped at canonical — so the panel
  reports a "savings" (green, e.g. GRAND 0.846×, L_SKIRT 0.877×) that does not
  actually exist as safe recoverable headroom; taking it (re-optimizing the
  variant) would under-size the texture below the baked rig's true render demand.
  The other two surprises are correct-by-design: (1) the variant IS optimized at
  export time — the 83.4%→20.6% drop is the master's giant over-sizes (CROWN
  957→211, now at-limit) being collapsed; (2) the faint ~0.99× greens are a
  benign ceil/clamp re-measurement asymptote, not recoverable savings.
defect_locus: >
  src/core/scale-summary-peaks.ts (scales peakScale but leaves source/canonical at
  master size) combined with src/core/scale-bake.ts (scales JSON dims by s) — the
  two produce different size bases for peakScale>1 attachments. Surfaces in the
  Global panel via src/renderer/src/lib/export-view.ts computeExportDims +
  src/renderer/src/panels/GlobalMaxRenderPanel.tsx rowState, where Source=atlas
  (peak·s) is compared against Peak=ceil(canonical·s × min(peakScale,1,sourceRatio)).
fix_direction_high_level: >
  NOT APPLIED (goal: find_root_cause_only). High-level options for the team:
  (A) Reconcile the variant's two halves so JSON canonical and atlas-orig agree
      for peakScale>1 attachments — e.g. have the variant's geometry bake carry
      the SAME peak-anchored dims the optimizer wrote to the atlas (so canonical
      == atlas-orig == peak·s, and the row reads yellow/at-limit like the master).
  (B) Or make the reopen read-model treat a variant's atlas-orig as the canonical
      truth when atlas-orig > JSON-canonical (i.e. clamp Peak against the atlas
      size, not the smaller JSON size), so an over-authored attachment shows
      Peak == Source (yellow) rather than phantom green.
  (C) Minimum non-destructive guard: ensure "re-optimize a variant" can never
      shrink a PNG below the baked rig's true peak render demand (the harmful
      shrink the re-optimize probe demonstrated).
  Recommend a brief design discussion before coding — (A) keeps the package
  self-consistent and is the cleanest, but touches the bake/plan contract that
  v1.7 locked; (B) is renderer-only and lower-risk but leaves the on-disk JSON/PNG
  size split in place.
fix: not applied
```
