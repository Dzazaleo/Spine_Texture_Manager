---
status: resolved
trigger: "When a Spine project has all three artifacts in the same folder (json + .atlas + images/ folder of pre-optimized PNGs), loading in atlas-source mode reads PNG IHDR bytes from the images/ folder and overrides actualDimsByRegion to those smaller PNG dims when both axes are strictly smaller than the atlas. This causes the DimsBadge yellow warning icon to fire (actualSourceW = PNG dim ≠ canonicalW = JSON dim). User's expected mental model: each loaderMode is self-contained — atlas-source ignores images/, atlas-less ignores .atlas. Bug reproduces on both macOS and Windows."
created: 2026-05-06
updated: 2026-05-06
resolved: 2026-05-06
---

## Symptoms

expected:
  - In atlas-source mode, only `.atlas` + atlas-page PNG are read for source-of-truth dims; the sibling `images/` folder is ignored entirely.
  - In atlas-less mode (mirror), only the `images/` folder is read; any sibling `.atlas` is ignored.
  - The DimsBadge yellow warning fires only for genuine source-of-truth disagreements within the active mode.

actual:
  - Atlas-source mode peeks into the sibling `images/` folder via `readPngDims(sourcePaths.get(region.name))` and overrides `actualSourceW/H` to the smaller PNG dims when both axes are strictly smaller than `atlas.region.originalWidth/Height`.
  - For a project with optimized images in `images/` (smaller than atlas), `actualSourceW` becomes the PNG dim → mismatches against `canonicalW` (= JSON `att.width`, equal to atlas-original dim) → DimsBadge yellow warning fires unexpectedly.
  - Bug is platform-independent — the loader has zero `process.platform` branches.

errors: "none — silent wrong output (warning fires when it shouldn't)"

## Evidence

- `src/core/loader.ts:561-590` (pre-fix): the `else` branch (atlas-source mode) populated `actualDimsByRegion` with atlas dims as a baseline, then attempted `readPngDims(sourcePaths.get(region.name))` and overrode to PNG dims when strictly smaller on both axes. This is the cross-mode bleed.
- The override was added by the resolved `scale-display-optimized-source.md` debug session (2026-05-05) to enable a "load pre-optimized images via atlas-source mode" workflow — but Phase 21 already provides the correct workflow for that case (toggle to atlas-less mode), so the cross-mode bleed was redundant and broke the user's stated mode-separation invariant.
- Tests `tests/core/loader-atlas-source-dims.spec.ts` Tests 1-2 + `tests/core/loader.spec.ts` "DIMS-01 atlas-source mode" lock the old cross-mode behavior into the contract (CIRCLE: PNG 420 wins over atlas 699; SQUARE: PNG 890 wins over atlas 1000). Those tests were updated as part of this fix.
- The downstream `effectiveSourceW = actualSourceW < canonicalW ? actualSourceW : sourceW` check in `src/core/export.ts:276-284` and `src/renderer/src/lib/export-view.ts:366-374` defensively falls back to `sourceW` when `actualSourceW >= canonicalW`, so removing the override is safe — passthrough COPY classification simply moves entirely to atlas-less mode.

## Eliminated

- **Windows-specific path-resolution failure**: falsified by the prior session (`windows-source-mode-auto-detect.md`). The IHDR read works on Windows; the cross-mode override was firing on both platforms.
- **Source W×H column display bug**: separate concern, fixed in commit `0e329d8` (sibling-symmetric `actualSourceW ?? sourceW` extension). That fix is a no-op in atlas-source mode after this loader fix (since `actualSourceW = sourceW = atlas dim`), but stays in place as defensive consistency for atlas-less mode.

## Resolution

root_cause: "The 2026-05-05 'scale-display-optimized-source' fix enabled a cross-mode peek where atlas-source mode would read PNG IHDR bytes from the sibling images/ folder and override actualDimsByRegion to those smaller dims. The fix was meant to support a 'load pre-optimized images via atlas-source mode' shortcut, but it violated the user's mental model of strict mode separation (atlas-source = atlas only, atlas-less = images/ only) and caused the DimsBadge yellow warning to fire whenever both artifacts coexisted in the project folder."
fix: "Remove the cross-mode override. In atlas-source mode, populate actualDimsByRegion exclusively from atlas.region.originalWidth/Height — no PNG IHDR reads, no images/ peek. To use pre-optimized images as the source of truth, the user toggles to atlas-less mode (Phase 21 D-05/D-07 path). Files: src/core/loader.ts (lines 561-590 simplified). Test contract updates: tests/core/loader-atlas-source-dims.spec.ts (Tests 1-2 flipped to lock atlas-only contract); tests/core/loader.spec.ts (DIMS-01 atlas-source test flipped). Net code change is a deletion + comment rewrite."
verification: "Targeted: tests/core/loader-atlas-source-dims.spec.ts + tests/core/loader.spec.ts + tests/core/analyzer.spec.ts + tests/core/export.spec.ts: 114/114 pass. DimsBadge + passthrough: tests/renderer/optimize-dialog-passthrough.spec.tsx + tests/renderer/dims-tooltip-view.spec.ts: 13/13 pass. Full suite: 797/803 pass (3 pre-existing unrelated failures: build-scripts version-check + 2 save-load Open-button lookups)."
files_changed:
  - src/core/loader.ts (lines 561-590; PNG-read override branch removed)
  - tests/core/loader-atlas-source-dims.spec.ts (Tests 1-2 flipped)
  - tests/core/loader.spec.ts (DIMS-01 atlas-source test flipped)

## Trade-off (acknowledged)

After this fix, the **COPY-passthrough optimization** (where pre-optimized images get byte-copied during Optimize instead of re-encoded) only fires in atlas-less mode. To use that workflow, the user toggles the toolbar source-mode button to "Use Images Folder as Source" before running Optimize. This is consistent with the user-stated rule that each loaderMode is self-contained.

## Cross-references

- `.planning/debug/resolved/scale-display-optimized-source.md` (2026-05-05) — the prior debug session that introduced the cross-mode bleed. Round 1 of that session also added an unrelated and still-correct `displayScale = outW/actualSourceW` field for the Scale column, which remains in place.
- `.planning/debug/resolved/windows-source-mode-auto-detect.md` (2026-05-06) — the immediately preceding investigation. Falsified the "Windows-specific" framing and surfaced the Source W×H column sibling-miss; this session is the deeper corrective.
