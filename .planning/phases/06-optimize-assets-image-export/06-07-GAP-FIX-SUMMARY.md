---
phase: 6
plan: gap-fix-07
subsystem: optimize-assets-image-export
type: gap-fix
parent: 06-07-VALIDATION (human-verify Step 1)
tags: [export, image-worker, atlas-extract, downscale-only, dialog-state]
date: 2026-04-25
duration: ~50 min
commits:
  - 5242703  fix(06-gap): clamp effectiveScale to ≤1.0 in buildExportPlan
  - 6812b97  feat(06-gap): add atlasSource to DisplayRow + populate from TextureAtlas
  - 3c30644  feat(06-gap): thread atlasSource through ExportRow + buildExportPlan
  - acdf7c1  feat(06-gap): image-worker extracts from atlas page when per-region PNG missing
  - c8465c6  test(06-gap): atlas-extract integration spec on Jokerman fixture
  - 5b834ef  fix(06-gap): OptimizeDialog keys rowStatuses by index, not outPath
verification:
  vitest_full: 184 passed | 1 skipped (was 172 baseline; +12 new tests)
  arch_spec: 9/9 GREEN
  electron-vite_build: green
  cli_byte_equivalence: identical except expected timing-line variance
  typecheck: pre-existing scripts/probe-per-anim.ts error (out of scope)
---

# Phase 6 Plan 07 Gap-Fix Summary — Human-Verify Step 1 Re-Test Bundle

**One-liner:** Three correctness fixes surfaced during human-verify Step 1 — clamp effectiveScale to source-dim ceiling, support atlas-packed projects via sharp.extract fallback, and key per-row UI state by index instead of outPath.

## Bug #1 — effectiveScale must be clamped to ≤ 1.0 (downscale-only invariant)

**Surfaced by:** Human-verify Step 1 visual review of pre-flight dialog showing 1.5×/2× upscaled output dims for some attachments.

**User intent (LOCKED):** Source PNG dimensions are the ceiling for any export. Even when the sampler reports a `peakScale` of 5× or 15× (e.g. an attachment dramatically zoomed in animation), the optimized output is always ≤ source dims. Images can only be reduced, never extrapolated. Cited memory: "Phase 6 export sizing LOCKED uniform-only" — anisotropic export breaks Spine UV sampling, AND extrapolating pixels libvips never had degrades quality vs simply shipping the source.

**Fix:** Apply `effScale = Math.min(rawEffScale, 1)` after the override/peakScale resolution and BEFORE the dedup keep-max comparison. Both the canonical `src/core/export.ts` and the byte-identical renderer copy `src/renderer/src/lib/export-view.ts` get the same clamp. JSDoc on `buildExportPlan` documents the new invariant.

**Critical placement detail:** clamp must run BEFORE dedup keep-max — otherwise two attachments sharing a source PNG with peaks 0.8 and 5.0 would dedup-promote the unclamped 5.0 row and emit upscaled output. With clamp first, max(0.8, 1.0) = 1.0 → outW = sourceW.

**Test deltas:**
- `tests/core/export.spec.ts`:
  - `peakScale 1.5 with no override → outW = sourceW (NOT 1.5×)`
  - `peakScale 5.0 (extreme zoom) still clamps to 1.0`
  - `Gap-Fix #1 dedup interaction: two attachments share source PNG with peaks 0.8 and 5.0 → both clamp to 1.0`
  - `Gap-Fix #1 parity: peakScale 1.5 produces outW = sourceW in BOTH core and renderer copies` (deepEqual sameness)

**Files modified:**
- `src/core/export.ts` — clamp + JSDoc + file-header narrative
- `src/renderer/src/lib/export-view.ts` — byte-identical renderer copy
- `tests/core/export.spec.ts` — 5 new test cases

**Commit:** 5242703

---

## Bug #2 — Atlas-only projects fail because per-region source PNGs don't exist

**Surfaced by:** Human-verify Step 1 attempt to optimize the Jokerman fixture — every row failed with `'missing-source'` because the loader synthesized `<skeletonDir>/images/AVATAR/L_EYE.png` and similar paths that DO NOT EXIST. Atlas-packed Spine projects ship only the atlas page PNGs (e.g. `JOKERMAN_SPINE.png`); per-region pixels live INSIDE those pages at coordinates declared by `bounds:` lines in the `.atlas`.

**User-approved approach (locked at gap-fix briefing):** Extract regions from atlas pages via `sharp.extract({left, top, width, height})` then resize. First-pass scope refuses rotated regions (`region.degrees !== 0`) with a clear typed error (`'rotated-region-unsupported'`); Jokerman has 0 rotated regions; rotated-handling is deferred to a follow-up phase if real rotated assets arrive.

**Architecture:**

1. **Loader (Step 2a)** — `LoadResult` gains `atlasSources: Map<regionName, {pagePath, x, y, w, h, rotated}>`. Populated for EVERY atlas region. `pagePath` resolves against the `.atlas` file's directory (NOT under `images/`), since atlas page PNGs sit beside the `.atlas` on disk. SOURCE-orig dims (`originalWidth/originalHeight`) are stored as `w/h` so consumers branch on `rotated` rather than re-deriving the swap.

2. **Analyzer (Step 2a)** — `analyze` and `analyzeBreakdown` thread the optional `atlasSources` map through; `DisplayRow.atlasSource?` and `BreakdownRow.atlasSource?` get populated alongside `sourcePath`.

3. **Summary (Step 2a)** — `src/main/summary.ts` wires `load.atlasSources` into both `analyze` + `analyzeBreakdown` calls.

4. **ExportRow (Step 2b)** — `ExportRow.atlasSource?` (optional) carries through `buildExportPlan`. Both `src/core/export.ts` and the renderer copy `src/renderer/src/lib/export-view.ts` thread the field from the winning DisplayRow.

5. **Image-worker (Step 2c)** — Pre-flight decision tree:
   - per-region PNG exists → use `sourcePath` (existing path, unchanged for EXPORT_PROJECT-style fixtures)
   - per-region PNG missing AND `atlasSource` present → atlas-extract fallback
   - per-region PNG missing AND `atlasSource.rotated === true` → `'rotated-region-unsupported'` typed error
   - per-region PNG missing AND atlas page also missing → `'missing-source'` against the PAGE path (clearer for the user than a path that was never supposed to exist)
   - per-region PNG missing AND no `atlasSource` → `'missing-source'` (today's behavior)

   Sharp pipeline branches at the resize call:
   ```
   sharp(atlasSource.pagePath)
     .extract({ left, top, width, height })  // crop region from page
     .resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' })
     .png({ compressionLevel: 9 })
     .toFile(tmpPath)
   ```
   The atomic-write protocol (D-121: write to `.tmp` then rename) is preserved across both branches.

6. **Type union (Step 2b)** — `ExportError['kind']` gains `'rotated-region-unsupported'`.

**Test deltas:**
- `tests/core/loader.spec.ts`:
  - `SIMPLE_TEST → atlasSources populated for all 3 regions` (shape + types)
  - `Jokerman → atlasSources resolves L_EYE to JOKERMAN_SPINE.png at 1032,3235 (171×171)` + BODY → `_2.png`
  - `no-rotated-regions invariant lock` for all in-repo fixtures (locks the first-pass scope; if a fixture introduces a rotated region, this test FAILS to force explicit handling)
- `tests/core/export.spec.ts`:
  - `ExportRow.atlasSource is populated when DisplayRow has atlasSource set`
  - `ExportRow.atlasSource is undefined when DisplayRow has no atlasSource`
- `tests/main/image-worker.atlas-extract.spec.ts` (NEW FILE):
  - `AVATAR/L_EYE 171×171 atlas-extract → 86×86 output PNG with correct dims and alpha preserved` (real-bytes round-trip on Jokerman)
  - `Rotated atlas region → emits 'rotated-region-unsupported'` (no partial output)
  - `atlas page missing AND per-region PNG missing → 'missing-source' against page path`

**Files modified:**
- `src/shared/types.ts` — DisplayRow.atlasSource, ExportRow.atlasSource, ExportError['kind']
- `src/core/types.ts` — LoadResult.atlasSources
- `src/core/loader.ts` — populate atlasSources from `region.page.name + region.x/y/originalWidth/originalHeight + region.degrees`
- `src/core/analyzer.ts` — thread atlasSources through analyze + analyzeBreakdown
- `src/core/export.ts` — thread atlasSource through to ExportRow
- `src/renderer/src/lib/export-view.ts` — byte-identical renderer copy
- `src/main/summary.ts` — wire load.atlasSources to analyzer calls
- `src/main/image-worker.ts` — pre-flight decision tree + sharp pipeline branch
- `tests/core/loader.spec.ts` — 3 new test cases
- `tests/core/export.spec.ts` — 2 new test cases
- `tests/main/image-worker.atlas-extract.spec.ts` — NEW FILE, 3 integration cases

**Commits:** 6812b97, 3c30644, acdf7c1, c8465c6

---

## Bug #3 — OptimizeDialog rowStatuses key mismatch (errors not surfaced per-row)

**Surfaced by:** Human-verify Step 1 — every row stayed `○` idle in the per-file checklist UI even when the export ran to completion with successes and errors. Errors were collected in `summary.errors` (visible in the post-export summary line) but the per-row indicators never flipped from `○` to `✓` or `⚠`.

**Root cause:** `OptimizeDialog.tsx:87` wrote `rowStatuses.set(event.outPath, event.status)` where `event.outPath` is the ABSOLUTE resolved path emitted by image-worker. Line 329 read `props.rowStatuses.get(row.outPath)` where `row.outPath` is the RELATIVE `'images/AVATAR/BODY.png'` from `buildExportPlan`. Keys never matched. Same bug applied to `rowErrors` (line 95) and `expandedErrors` (line 204/331).

**Fix:** Key all three structures by row INDEX (number) instead. Index is unambiguous, doesn't depend on absolute-vs-relative path normalization, and is already on every progress event (`event.index`).

Specifically:
- `rowStatuses: Map<string, RowStatus>` → `Map<number, RowStatus>`
- `rowErrors: Map<string, string>` → `Map<number, string>`
- `expandedErrors: Set<string>` → `Set<number>`
- Write sites in `onExportProgress` use `event.index`
- Read site in `InProgressBody` iterates `plan.rows.map((row, rowIndex) => ...)`
- `onToggleExpand` callback signature flips from `(outPath: string)` to `(rowIndex: number)`

The type changes are local to `OptimizeDialog.tsx` — `props.rowStatuses` is not exposed to the parent AppShell (it's internal state).

**Test deltas:** No automated test (the renderer modal lacks a Testing Library / happy-dom harness; Phase 4 D-83/D-86 left this open and Phase 6 followed suit). The fix is verified by re-running the human-verify Step 1 manual checks listed below.

**Files modified:**
- `src/renderer/src/modals/OptimizeDialog.tsx` — state declarations, useEffect write sites, onToggleExpand callback, InProgressBody signature + iteration

**Commit:** 5b834ef

---

## Verification

| Gate                          | Result                                          |
| ----------------------------- | ----------------------------------------------- |
| `npm test` (full vitest)      | **184 passed | 1 skipped** (was 172; +12 new)   |
| `npm test -- tests/arch.spec.ts` | **9/9 GREEN** (Layer 3 invariant intact)     |
| `npx electron-vite build`     | **green** (main 37.69 kB, preload 2.74 kB, renderer 615.64 kB) |
| `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0; output byte-equal except elapsed-ms timing line (expected wall-clock variance) |
| `npm run typecheck`           | pre-existing `scripts/probe-per-anim.ts` error unrelated to gap-fix work (out of scope per gap-fix briefing) |

## Remaining Manual-Verify Steps (User Re-Test)

The original `06-07-VALIDATION.md` Step 1 covered 7 manual checks. Step 1 surfaced these 3 bugs which are now fixed; the user still needs to re-run the following 6 manual-verify steps:

1. **Re-run human-verify Step 1 with EXPORT_PROJECT** — confirm pre-flight dialog shows downscale ratios only (no `~ 1.5x smaller` going the wrong way), per-file checklist flips `○ → ✓` for each row as the export proceeds, and the post-export summary line reads `4 succeeded, 0 failed in Xs`.

2. **Re-run human-verify Step 1 with Jokerman atlas-only fixture** — confirm:
   - Pre-flight dialog shows all 23 atlas regions (1 page × 19 regions + page 2 × 1 + page 3 × 1, deduped per `attachmentName`).
   - Export proceeds without `'missing-source'` errors (atlas-extract fallback fires).
   - Output `images/AVATAR/L_EYE.png`, `images/AVATAR/BODY.png`, etc. exist with correct downscaled dims.
   - Open output folder shows the expected directory tree (`images/AVATAR/...`).

3. **Override interaction re-test** — set an override of 200% on a CIRCLE attachment with peakScale 0.5 → confirm the export writes CIRCLE.png at 100% of source dims (NOT 200%); the override resolution path goes through `applyOverride` (Phase 4 D-91 already clamps to 100%) THEN through the new ≤1.0 clamp.

4. **Per-file error visibility** — temporarily move one source PNG away (e.g. `mv images/SQUARE.png /tmp/SQUARE.png`), re-run export → confirm the SQUARE row in the per-file checklist now flips to `⚠` in `--color-danger`, click expands inline showing the missing-source error message; other rows still flip to `✓`.

5. **Cancel mid-export re-test** — re-run export with the Jokerman fixture (slowest), click Cancel halfway → confirm the in-flight file finishes, no further files start, the dialog flips to complete state with summary line including "cancelled", and the partial output files remain on disk (D-115 contract).

6. **Open output folder + Close** — after a successful export, confirm "Open output folder" reveals the directory in Finder, and "Close" dismisses the dialog cleanly.

If all 6 re-tests pass, mark `06-07-VALIDATION.md` Step 1 as PASSED and proceed to Step 2.

## Known Stubs

None. All fixes are wired end-to-end with no placeholder behavior.

## TDD Gate Compliance

This was a gap-fix sweep, not a TDD plan — `type: gap-fix` not `type: tdd`. RED/GREEN/REFACTOR gate enforcement does not apply. However each bug-fix commit landed alongside its tests:
- Bug #1: 5 test cases co-committed with the fix
- Bug #2: 5 test cases (loader + export + image-worker integration) co-committed across the 4-commit sequence
- Bug #3: no automated test (renderer modal harness gap; documented in human re-test plan above)

## Self-Check: PASSED

Files created:
- FOUND: tests/main/image-worker.atlas-extract.spec.ts

Commits exist (verified via `git log --oneline -7`):
- FOUND: 5242703 fix(06-gap): clamp effectiveScale to ≤1.0
- FOUND: 6812b97 feat(06-gap): add atlasSource to DisplayRow
- FOUND: 3c30644 feat(06-gap): thread atlasSource through ExportRow
- FOUND: acdf7c1 feat(06-gap): image-worker extracts from atlas page
- FOUND: c8465c6 test(06-gap): atlas-extract integration spec
- FOUND: 5b834ef fix(06-gap): OptimizeDialog keys rowStatuses by index
