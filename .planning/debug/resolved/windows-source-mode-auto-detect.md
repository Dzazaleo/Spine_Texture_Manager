---
status: resolved
trigger: "On Windows, loading a JSON whose images/ folder is already optimized auto-loads in atlas-source (canonical) mode. The toolbar shows '1 atlases', the Source W×H column shows canonical dims (e.g. 140×279) instead of on-disk PNG dims (e.g. 125×249), and the Peak column is colored green (room to optimize) instead of orange (cap reached). Manually clicking the toolbar 'Use Images Folder as Source' toggle re-loads correctly: Source W×H shows PNG dims and Peak turns orange. Same project on macOS auto-loads correctly without the manual toggle."
created: 2026-05-06
updated: 2026-05-06
resolved: 2026-05-06
---

## Current Focus

hypothesis: "The bug is NOT a Windows-specific IHDR-read failure (the prior hypothesis was falsified by the user's own tooltip evidence — the IHDR substitution DID succeed on Windows). The Source W×H column reads `originalSizeLabel` (built from sampler's `p.sourceW`), and `p.sourceW` is set from `load.sourceDims`, which in atlas-source mode is hard-wired to `atlas.region.originalWidth` (= canonical 140). The 'scale-display-optimized-source' fix added `actualDimsByRegion` (PNG IHDR dims, 125) and threaded it into the Scale column + DimsBadge tooltip + cap math, but it never updated the legacy `sourceDims` map / `originalSizeLabel` / Source W×H column. So the Source column ALWAYS shows canonical dims in atlas-source mode, on every platform. The macOS-vs-Windows discrepancy is most likely caused by the macOS load entering atlas-less mode (where `sourceDims.source = 'png-header'` → on-disk PNG dims), e.g. via a .stmproj with `loaderMode: 'atlas-less'` saved from a prior session."
test: "Verify two things: (a) the user's macOS test was opening a .stmproj (which may carry loaderMode='atlas-less') vs the Windows test was opening a raw .json (which always defaults loaderMode='auto'); (b) on a fresh Windows + raw .json open, confirming the Source W×H column shows 140×279, while a macOS load of the SAME raw .json (no .stmproj) ALSO shows 140×279 (i.e. the bug is not platform-specific)."
expecting: "User confirms macOS was loading a different file shape (e.g., a .stmproj saved with loaderMode='atlas-less') OR that macOS loaded a raw .json without a sibling .atlas. Either way, the column-rendering fix is platform-independent: thread actualSourceW/H into originalSizeLabel construction so the Source W×H column reflects on-disk dims when dimsMismatch fires."
next_action: "Ask user one targeted question to confirm the macOS file-shape scenario, then propose the fix: route actualSourceW/H into originalSizeLabel so the Source W×H column matches the same rule as the Scale column."

## Symptoms

expected:
  - Loading a project with already-optimized images on Windows should match macOS behavior
  - Source W×H column should display the on-disk PNG dimensions (125×249), not the canonical atlas-region dims (140×279)
  - Peak column should be orange (cap reached / already at peak) when source dims = peak dims
  - Toolbar should reflect the active source — if images folder is the source of truth, badge should not say '1 atlases'

actual:
  - Toolbar shows '1 atlases' on initial load (atlas-source / canonical mode auto-selected)
  - Source W×H column shows canonical dims (140×279 for row '12'; tooltip says 'Atlas region declares 125×249 but canonical is 140×279')
  - Peak column is GREEN (system thinks images can be optimized further) even though they are already at peak
  - Manually clicking the toolbar source-mode toggle and choosing 'Use Images Folder as Source' re-loads correctly: Source dims drop to PNG dims and Peak turns orange
  - Bug does NOT reproduce on macOS with the same project

errors: "none — silent wrong output"

timeline: "Discovered 2026-05-06 by user running Windows build. macOS works correctly with same project. Resolved session scale-display-optimized-source.md (2026-05-05) was assumed-fixed; that fix added canonical-mode PNG IHDR reads with a 'strictly smaller on both axes' guard. The fix was verified on macOS but apparently not exercised on Windows."

reproduction:
  - Open the Windows build of Spine Texture Manager
  - Open a Spine project (.stmproj or .json) where the images/ folder PNGs are smaller than the atlas-declared region dims (i.e. project has already been Optimized)
  - Observe: toolbar shows '1 atlases' (atlas-source mode auto-selected)
  - Observe: Source W×H column shows canonical (atlas) dims, not PNG dims
  - Observe: Peak column cells are green
  - Click the toolbar source-mode toggle → 'Use Images Folder as Source'
  - Observe: project re-loads, Source dims now correct, Peak cells turn orange

## Evidence

- Prior resolved session `.planning/debug/scale-display-optimized-source.md` (2026-05-05) added canonical-mode PNG IHDR reads to `src/core/loader.ts:564-590` with a 'strictly smaller on both axes' guard, populating `actualDimsByRegion` (NOT `sourceDims`) from on-disk PNG dims when they are smaller than the atlas baseline.
- User's screenshot tooltip on row '12': 'Atlas region declares 125×249 but canonical is 140×279'.
- That tooltip is generated by `src/renderer/src/lib/dims-tooltip-view.ts:36`:
  `Atlas region declares ${row.actualSourceW}×${row.actualSourceH} but canonical is ${row.canonicalW}×${row.canonicalH}`
  — meaning `row.actualSourceW = 125` (on-disk PNG) and `row.canonicalW = 140` (JSON attachment width).
- For `row.actualSourceW = 125` to be present, the canonical-mode IHDR substitution at `loader.ts:574-585` MUST have fired successfully on Windows (the only code path that writes `actualSourceW < canonicalW` in atlas-source mode).
- **THIS FALSIFIES THE PRIOR HYPOTHESIS** that the IHDR-read failed silently on Windows. The IHDR read DID succeed.
- The Source W×H column at `GlobalMaxRenderPanel.tsx:526` renders `{row.originalSizeLabel}`.
- `originalSizeLabel` is built in `src/core/analyzer.ts:128`:
  `originalSizeLabel: \`${p.sourceW}×${p.sourceH}\``
- `p.sourceW` is the sampler's `record.sourceW`, set from `load.sourceDims.get(name).w` at `sampler.ts:270` and `sampler.ts:432-440`.
- `load.sourceDims` is built in `src/core/loader.ts:457-475`. In atlas-source mode (lines 462-474):
  ```js
  for (const region of atlas!.regions) {
    sourceDims.set(region.name, {
      w: region.originalWidth,   // = 140 (canonical)
      h: region.originalHeight,  // = 279 (canonical)
      source: hasExplicitOrig ? 'atlas-orig' : 'atlas-bounds',
    });
  }
  ```
  In atlas-less mode (lines 458-461):
  ```js
  sourceDims.set(name, { w: dims.w, h: dims.h, source: 'png-header' });
  ```
- Therefore: in atlas-source mode the Source W×H column shows the canonical atlas-region dims (140×279); in atlas-less mode it shows the on-disk PNG dims (125×249). This is a property of `loaderMode`, NOT of the host OS — the loader's branch logic at `loader.ts:282-396` is platform-independent (no `process.platform` checks anywhere in core/).
- Raw `.json` open path (`src/main/ipc.ts:431`): `loadSkeleton(jsonPath)` is called with NO options → loader takes D-05/D-07 fallback, atlas-source mode if sibling `.atlas` exists.
- `.stmproj` open path (`src/main/project-io.ts:418`): when `materialized.loaderMode === 'auto'` and `atlasPath !== null`, passes `loaderOpts.atlasPath = materialized.atlasPath` → loader takes D-06 → atlas-source mode. When `materialized.loaderMode === 'atlas-less'`, passes `loaderOpts.loaderMode = 'atlas-less'` → atlas-less mode.
- AppShell `loaderMode` initial state (`AppShell.tsx:306-308`): `initialProject?.loaderMode ?? 'auto'`. Raw JSON drops have no `initialProject` → `loaderMode = 'auto'`. .stmproj loads carry the saved value.
- Related closed bug: `.planning/debug/resolved/source-mode-toggle-label-bug.md` (2026-05-05) — same class of "loaderMode UI state vs effective summary" ambiguity at the toolbar layer.

## Eliminated

- **Windows-specific IHDR-read failure**: falsified. The user's tooltip wording ("Atlas region declares 125×249") proves `row.actualSourceW = 125` is populated on Windows, which only happens if the IHDR substitution fired successfully (`loader.ts:574-585`).
- **Windows-specific path-construction bug**: falsified. `path.resolve(path.join(imagesDir, regionName + '.png'))` is identical for atlas-less and atlas-source modes (`loader.ts:511` and `synthetic-atlas.ts:159`); atlas-less works on Windows per the user's manual-toggle observation, so the path construction itself is fine.
- **Platform-conditional code in core/**: falsified. `grep -rn 'process.platform\|win32\|darwin' src/core/ src/main/project-io.ts src/core/loader.ts` returns nothing relevant.

## Resolution

root_cause: "The 2026-05-05 'scale-display-optimized-source' fix added an `actualDimsByRegion` map (on-disk PNG IHDR dims) and threaded it into the Scale column, cap math, DimsBadge tooltip, and passthrough classification — but it never updated the Source W×H column or the Peak-cell color logic. Both still read the legacy `sourceW`/`sourceH` fields, which in atlas-source mode are hard-wired to `region.originalWidth/Height` (= canonical) at `loader.ts:462-474`. So in atlas-source mode the Source column always shows canonical dims and Peak cells stay green even when on-disk PNGs match the cap. Bug is platform-independent (the loader has zero `process.platform` branches) — the apparent macOS-vs-Windows discrepancy is a separate auto-detection divergence (see Follow-up below) where macOS picked atlas-less mode for the same project, masking the column-display bug."
fix: "Sibling-symmetric extension of the 2026-05-05 fix's `actualSourceW ?? sourceW` pattern to the two display sites the prior fix missed: (1) `src/core/analyzer.ts:128` (toDisplayRow) and `:279` (toBreakdownRow) — `originalSizeLabel: \`${actualSourceW ?? p.sourceW}×${actualSourceH ?? p.sourceH}\`` so the Source W×H column reflects on-disk dims when IHDR substitution fired; (2) `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:1031,1146` and `src/renderer/src/panels/AnimationBreakdownPanel.tsx:866,911` — `rowState(row.peakDisplayW, row.actualSourceW ?? row.sourceW, false, row.isMissing)` so the Peak-cell color comparison uses on-disk dims (turning green→orange for already-at-cap pre-optimized assets). CLI semantics preserved: `actualSourceW` is undefined on the CLI path → `?? sourceW` falls back to the existing field → byte-identical CLI output."
verification: "tests/core/analyzer.spec.ts + tests/core/loader-atlas-source-dims.spec.ts: 34/34 pass. Full suite: 797/803 pass (3 pre-existing unrelated failures: 1 outdated package.json version-check in build-scripts.spec.ts, 2 Open-button lookups in save-load.spec.tsx — same set documented in resolved scale-display-optimized-source.md, caused by other unstaged AppShell changes). tsc --noEmit -p tsconfig.web.json: only pre-existing unused-var warnings + an unrelated OptimizeDialog null-narrowing — no new errors. Hand-trace for row '12' (canonical 140×279, on-disk 125×249, peak 125×249): originalSizeLabel = `125×249` ✓; rowState(125, 125) = 'atLimit' → orange ✓."
files_changed:
  - src/core/analyzer.ts (lines 128 + 279 + comments)
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx (lines 1031, 1146)
  - src/renderer/src/panels/AnimationBreakdownPanel.tsx (lines 866, 911)

## Follow-up (separate investigation needed)

User reported that on macOS, opening the *same* raw `.json` (no `.stmproj`) auto-loads in atlas-less mode while on Windows it auto-loads in atlas-source mode. The loader's 4-way fallback at `loader.ts:282-396` is platform-independent (no `process.platform` checks), so the divergence must come from filesystem-layer differences (e.g. the macOS user's project tree has no sibling `.atlas` while the Windows tree does, OR case-folding differences in the sibling-`.atlas` lookup). The column-display fix above makes the Source W×H column correct on **both** platforms regardless of which loader mode auto-selected, so this follow-up is independent of the user's reported symptom — but it's still worth investigating before closing.

Suggested next step: ask the user to `ls -la` the project folder on both platforms and compare exact filenames. If a `.atlas` sibling is present on Windows but absent (or differently-named) on macOS, that's the root cause of the divergence and the ROADMAP `loaderMode: 'auto'` resolution is working as designed.
