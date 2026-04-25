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

---

## Round 2 — Step 2 collision-guard fixes (2026-04-25)

**Trigger:** Human-verify Step 2 surfaced two further regressions while
re-testing the export flow against the Girl/Jokerman style projects.

**Round 2 commits:**
- `d8b53c8` fix(06-gap2): per-row source-vs-output collision guard prevents overwriting source PNGs/atlas pages
- `ebe57cf` fix(06-gap2): clearer AtlasNotFoundError message — explain why atlas is required

### Bug #4 — Source-vs-output collision guard misses parent-of-images outDir

**Reproduction (user-confirmed):** drop a project whose source PNGs live at
`<skeletonDir>/images/<region>.png` (e.g. `fixtures/Girl/`), click Optimize,
pick the SKELETON folder (NOT the images folder) as outDir, click Start.
The export writes `<outDir>/images/<regionName>.png` directly OVER the
source files in `<skeletonDir>/images/`. Source images destroyed in place;
no safety prompt.

**Root cause:** the existing `isOutDirInsideSourceImages` check in
`src/main/ipc.ts handleStartExport` only catches the case where `outDir ==
sourceImagesDir` OR `outDir is INSIDE sourceImagesDir`. It does NOT catch
the inverse: `outDir + '/images/' would land ON sourceImagesDir`. When the
user picks the parent of source-images, the guard sees outDir as OUTSIDE
source-images and approves; the worker then writes to
`<outDir>/images/...` which IS the source-images folder.

**Fix — defense in depth at TWO layers (per-row collision detection):**

**Layer A (IPC pre-flight in `src/main/ipc.ts`):** for each row in
`validPlan.rows`, compare `path.resolve(outDir, row.outPath)` against:
1. `path.resolve(row.sourcePath)` — per-region PNG case
2. `path.resolve(row.atlasSource.pagePath)` — atlas-packed projects case

Either equality fails fast with `kind: 'overwrite-source'` BEFORE setting
`exportInFlight`, so a guard rejection does not poison the flag for
follow-up calls. The original `isOutDirInsideSourceImages` check stays as
a friendlier early-exit message for the "user picked the images folder
itself" case (clearer error than per-row when the user names the source
folder explicitly).

**Layer B (image-worker per-row in `src/main/image-worker.ts`):** the same
comparison runs at the top of the per-row loop, BEFORE `fs.access`. On
hit, emit a per-row `'overwrite-source'` error and `continue` to the next
row (D-116 skip-on-error continuation). Belt-and-suspenders against any
future caller that bypasses the IPC layer (`runExport` is invoked
directly from tests).

**Type updates:**
- `ExportError['kind']` union: `+ 'overwrite-source'`
- `ExportResponse` error kind union: `+ 'overwrite-source'`
- `OptimizeDialog` renders any `ExportError` by reading `.message` only —
  no kind-specific switch elsewhere drops unknown kinds; the new kind
  surfaces cleanly in the existing error display.

**Tests added (5 new):**
- `tests/main/ipc-export.spec.ts`:
  - parent-of-source-images outDir → reject with `'overwrite-source'` (NOT `'invalid-out-dir'` — locks the discriminator so a future regression can't silently downgrade)
  - multi-row plan with one safe + one colliding row → reject with `'overwrite-source'` and message naming the colliding file
  - atlas-page collision → reject with `'overwrite-source'` and message mentioning "atlas page"
  - genuinely safe outDir (`/tmp/foo`) → no false-reject (happy path stays GREEN)
- `tests/main/image-worker.spec.ts`:
  - direct `runExport` with 3 rows where row 1 collides → row 1 gets `'overwrite-source'`, rows 0 and 2 still process normally (D-116 honored)

**Files modified:**
- `src/main/ipc.ts` — Layer A per-row pre-flight collision check + JSDoc
- `src/main/image-worker.ts` — Layer B in-loop defense-in-depth check + file-header docblock update
- `src/shared/types.ts` — `'overwrite-source'` added to both `ExportError['kind']` and `ExportResponse` error kind unions, with explanatory JSDoc
- `tests/main/ipc-export.spec.ts` — 4 new test cases under a Bug #4 describe block
- `tests/main/image-worker.spec.ts` — 1 new test case under a Bug #4 describe block

### Bug #5 (partial fix) — Improve atlas-not-found error message

**Surfaced by:** human-verify Step 2 dragging in a bare `.json` (no
sibling `.atlas`). The existing message read:
```
No atlas file found beside skeleton JSON.
  Skeleton: <path>
  Expected atlas at: <path>.atlas
```
Technically correct but did not tell the user WHY they need an atlas or
that this is a Spine convention.

**Fix:** expanded the human message in `src/core/errors.ts`
`AtlasNotFoundError`:
```
Spine projects require an .atlas file beside the .json (carries region
metadata that the skeleton JSON alone does not have). Re-export from
the Spine editor with the atlas included.
  Skeleton: <path>
  Expected atlas at: <path>.atlas
```

The class, `.name` field, and typed `searchedPath` / `skeletonPath`
properties are unchanged — only the human message expanded. All existing
tests asserting on `instanceof AtlasNotFoundError` / `err.name` /
`err.searchedPath` / `err.skeletonPath` continue to pass byte-for-byte.

**Tests added (1 new):**
- `tests/core/loader.spec.ts`:
  - `Gap-Fix Round 2 Bug #5: AtlasNotFoundError message explains WHY the atlas is required (re-export hint)` — locks the substantive cues (`/Spine projects require an \.atlas file/`, `/Re-export from the Spine editor/`) without overconstraining wording

**Files modified:**
- `src/core/errors.ts` — `AtlasNotFoundError` constructor message expanded with WHY + remediation hint; class signature unchanged
- `tests/core/loader.spec.ts` — 1 new test case asserting the substantive cues

**Out of scope:** a tracked follow-up for true atlas-less mode (Phase 6.1)
is being scoped separately by the user — Round 2 only improves the error
UX, not the underlying capability.

### Round 2 Verification

| Check                              | Result |
| ---------------------------------- | ------ |
| `npm test`                         | 190 passed | 1 skipped (was 184 baseline; +6 new tests) |
| `npm test -- tests/arch.spec.ts`   | 9/9 GREEN |
| `npx electron-vite build`          | green |
| `npm run typecheck:web`            | clean |
| `npm run typecheck:node`           | pre-existing `scripts/probe-per-anim.ts` error (out of scope, inherited from Round 1) |
| `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0; output unchanged (timing-line variance only) |

### Round 2 Self-Check: PASSED

Files modified (verified via `git diff --name-only HEAD~2 HEAD`):
- FOUND: src/core/errors.ts
- FOUND: src/main/image-worker.ts
- FOUND: src/main/ipc.ts
- FOUND: src/shared/types.ts
- FOUND: tests/core/loader.spec.ts
- FOUND: tests/main/image-worker.spec.ts
- FOUND: tests/main/ipc-export.spec.ts

Round 2 commits exist (verified via `git log --oneline -3`):
- FOUND: d8b53c8 fix(06-gap2): per-row source-vs-output collision guard
- FOUND: ebe57cf fix(06-gap2): clearer AtlasNotFoundError message

---

## Round 3 — Step 2 overwrite UX (2026-04-25)

**Trigger:** the Round 2 collision guard, while functionally safe,
proved over-cautious in the Step 2 re-test. Picking the SKELETON folder
as outDir was rejected on folder-position alone even when no `images/`
subfolder yet existed — a common organizational pattern (animator
exports to `<projectFolder>/images-optimized/` or to the skeleton folder
itself with the expectation that the tool creates `images/` fresh). The
user clarified the real invariant we want to protect: **never silently
overwrite an existing file**, regardless of its relationship to the
source-images folder.

**Round 3 commits:**
- `77296b2` feat(06-gap3): split export IPC into probe + start; add overwrite flag; relax folder-position guard
- `892b5a1` feat(06-gap3): ConflictDialog modal + AppShell probe-then-confirm overwrite flow
- (this commit) docs(06-gap3): append round 3 (overwrite UX) to gap-fix summary

### Old contract (Round 2) — REMOVED

`handleStartExport` rejected ANY plan whose outDir was equal to OR a
child of OR the parent of the source-images directory, on
folder-position alone. The per-row collision check inside
`runExport` ALWAYS fired regardless of user intent.

### New contract (Round 3)

`handleStartExport` rejects on folder-position alone in ONE case only:
**outDir IS the source-images folder itself**. Every output would
collide; not a useful confirmation prompt — the user must pick a
different folder regardless. Even with `overwrite=true`, this case
cannot be rescued.

For every other case (parent of `images/`, sibling, anywhere
genuinely safe), the renderer drives a probe-then-confirm flow:

1. User clicks Optimize toolbar button → AppShell picks output dir →
   builds the plan → mounts OptimizeDialog (no probe yet — the dialog
   is still a "review before committing" surface).
2. User clicks Start inside OptimizeDialog → OptimizeDialog calls the
   new `onConfirmStart` prop (AppShell hook).
3. AppShell calls `api.probeExportConflicts(plan, outDir)`. If empty
   list, resolves `{ proceed: true, overwrite: false }` immediately.
4. If conflicts exist, AppShell mounts ConflictDialog with the precise
   list of paths. The user sees the exact files at risk and chooses:
   - **Cancel** → close both dialogs, no export
   - **Pick different folder** → re-pick + rebuild plan + re-evaluate
   - **Overwrite all** → resolve `{ proceed: true, overwrite: true }`
5. OptimizeDialog only flips to in-progress AFTER `onConfirmStart`
   resolves with `proceed: true`. `startExport(plan, outDir, overwrite)`
   forwards the flag.

### Backend wire format

**New IPC channel:** `'export:probe-conflicts'`
- Renderer → main: `{ plan, outDir }`
- Main → renderer: `{ ok: true, conflicts: string[] }` OR
  `{ ok: false, error: { kind: 'invalid-out-dir' | 'Unknown', message } }`
- The `'invalid-out-dir'` branch fires only for the hard-reject case
  (outDir IS source-images-dir).
- `conflicts` is the deduped, sorted list of absolute paths that would
  be overwritten. Three sources covered:
  1. Resolved output equals row.sourcePath (per-region PNG case)
  2. Resolved output equals row.atlasSource.pagePath (atlas-packed)
  3. Resolved output exists on disk via `fs.access(F_OK)` (any
     pre-existing PNG, even if unrelated — we don't silently destroy
     user files just because they happen to live where we'd write)
- Existence probes run in parallel via `Promise.all`. No
  `exportInFlight` mutation; safe to call repeatedly.

**Updated `'export:start'` channel:** gains an `overwrite` 3rd arg.
- When omitted/false, main re-runs the probe as defense-in-depth and
  rejects with `'overwrite-source'` carrying the precise `conflicts`
  list. The renderer's probe-then-confirm flow ensures we never reach
  this branch in normal operation; this is the safety net for any
  caller that bypasses the renderer.
- When true, main bypasses the per-row collision check AND forwards
  `allowOverwrite=true` to `runExport` (which has its own
  defense-in-depth check, also gated on the flag).
- The hard-reject case (outDir IS source-images-dir) cannot be
  rescued by `overwrite=true`.

**Type updates:**
- `Api.probeExportConflicts(plan, outDir)` added.
- `Api.startExport` signature: optional 3rd arg `overwrite?: boolean`.
- `ExportResponse` `'overwrite-source'` branch gains `conflicts?: string[]`.
- New `ProbeConflictsResponse` discriminated union.
- `ExportError['kind']` 'overwrite-source' JSDoc updated to reference
  the Round 3 gating model.

### New ConflictDialog component

`src/renderer/src/modals/ConflictDialog.tsx` — hand-rolled ARIA modal
(D-81 pattern, same as OverrideDialog and OptimizeDialog):
- `role='dialog'` + `aria-modal='true'` + `aria-labelledby`
- ESC closes (Cancel); overlay click closes (Cancel)
- Auto-focuses the safest button (Cancel) — user must Tab to reach
  the destructive Overwrite-all option
- No Enter shortcut on the dialog (intentional: Enter must NOT
  default to overwrite; the user must explicitly click)
- Conflict list scrollable (max-h-[12rem] overflow-auto), each path
  rendered truncate-with-ellipsis with `title=path` so the full path
  surfaces on hover
- Footer order: **Cancel | Pick different folder | Overwrite all**.
  Destructive action sits RIGHTMOST per platform convention; same
  orange-accent treatment as OptimizeDialog's Start button so it's
  visually identifiable as primary-but-dangerous.

### AppShell wiring

- `pickOutputDir()` helper extracted for reuse by ConflictDialog's
  Pick-different-folder handler.
- `conflictState` useState + `pendingConfirmResolve` useRef track the
  in-flight ConflictDialog and the OptimizeDialog promise it resolves.
  The resolver lives in a ref (not state) because it's consumed
  exactly once and the consumer (button click handlers) needs the
  latest value synchronously without going through a re-render —
  storing it in state would risk stale-closure bugs.
- `onConfirmStart` implements the probe-then-confirm pipeline.
- Three click handlers (`onConflictCancel`, `onConflictOverwrite`,
  `onConflictPickDifferent`) each resolve the pending promise with
  the user's decision and close the appropriate dialogs.

### Tests

**Updated (Round 2 → Round 3):**
- `tests/main/ipc-export.spec.ts`: round-2 collision tests now read
  the new `conflicts: string[]` payload format instead of the old
  per-row "Output would overwrite source PNG" message format. The
  "child-of-source-images-dir" rejection test was UPDATED to assert
  the new contract (now permitted because no actual collision exists
  in the unit-test mock environment); the discriminator is preserved
  ('overwrite-source' for actual collisions, 'invalid-out-dir' for
  the hard-reject case).

**New (8 in ipc-export.spec.ts + 2 in image-worker.spec.ts = 10 total):**
- probeExportConflicts returns conflicting paths without side effects
- probeExportConflicts returns empty list when no conflicts exist
- probeExportConflicts surfaces a pre-existing PNG at the resolved
  output (any-collision case via `fs.access(F_OK)`)
- handleStartExport with `overwrite=false` AND conflicts → rejects
  with 'overwrite-source' (defense-in-depth)
- handleStartExport with `overwrite=true` AND conflicts → proceeds
- handleStartExport rejects when outDir IS source-images-dir even
  with `overwrite=true` (hard-reject)
- Round 3: parent-of-images outDir with NO existing images/ subfolder
  is ALLOWED (no false-reject; the round-2 over-cautious behavior
  is gone)
- handleProbeExportConflicts hard-rejects when outDir IS
  source-images-dir (no proceed-with-overwrite escape hatch)
- runExport with `allowOverwrite=true` bypasses the per-row collision
  check (proceeds without overwrite-source)
- runExport with `allowOverwrite=false` (default) preserves the
  Round 2 collision protection

**No new automated test for ConflictDialog itself** — the renderer
modal test harness gap (no Testing Library / happy-dom) called out
in Round 1+2 stays unaddressed. Manual re-test scenarios cover this.

### Files modified

- `src/main/ipc.ts` — new `probeExportConflicts` pure helper +
  `handleProbeExportConflicts` IPC entry; `handleStartExport` gains
  `overwrite` param (default false); per-row collision check moved
  into `probeExportConflicts`; defense-in-depth probe re-run inside
  `handleStartExport` when `overwrite=false`; `isOutDirInsideSourceImages`
  helper retained but unreferenced (kept live via `void` operator
  for noUnusedLocals); `'export:probe-conflicts'` channel wired in
  `registerIpcHandlers`; `'export:start'` forwards `overwrite` arg.
- `src/main/image-worker.ts` — `runExport` gains `allowOverwrite`
  param (default false) gating the per-row collision check;
  preserves Round 2 behaviour on direct invocation.
- `src/preload/index.ts` — `probeExportConflicts` contextBridge
  method added; `startExport` forwards `overwrite` arg.
- `src/shared/types.ts` — `ExportResponse` 'overwrite-source' branch
  gains `conflicts?: string[]`; new `ProbeConflictsResponse` type;
  `Api` gains `probeExportConflicts`; `startExport` gains optional
  `overwrite` arg.
- `src/renderer/src/modals/ConflictDialog.tsx` — NEW FILE; hand-rolled
  ARIA modal for the overwrite-confirmation flow.
- `src/renderer/src/modals/OptimizeDialog.tsx` — new optional
  `onConfirmStart` prop; `onStart` awaits the parent's confirmation
  before flipping to in-progress; `startExport` call forwards the
  resolved overwrite flag.
- `src/renderer/src/components/AppShell.tsx` — `pickOutputDir()`
  helper extracted; `conflictState` + `pendingConfirmResolve` ref
  added; `onConfirmStart` + 3 ConflictDialog click handlers
  implemented; ConflictDialog mount stacked alongside OptimizeDialog.
- `tests/main/ipc-export.spec.ts` — 8 new tests + 1 round-2 test
  updated; round-2 collision tests updated to read new conflicts
  payload; `vi.mock('node:fs/promises')` added with default ENOENT
  for `access` and `mockReset` in `beforeEach` to prevent leak.
- `tests/main/image-worker.spec.ts` — 2 new tests for the
  `allowOverwrite` parameter (true bypass + false default).
- `.planning/phases/06-optimize-assets-image-export/06-07-GAP-FIX-SUMMARY.md`
  — Round 3 section appended (this section).

### Round 3 Verification

| Check                              | Result |
| ---------------------------------- | ------ |
| `npm test`                         | 200 passed | 1 skipped (was 190 baseline; +10 new tests) |
| `npm test -- tests/arch.spec.ts`   | 9/9 GREEN |
| `npx electron-vite build`          | green (renderer 621.41 kB; +5.77 kB for ConflictDialog + AppShell additions) |
| `npm run typecheck:web`            | clean |
| `npm run typecheck:node`           | pre-existing `scripts/probe-per-anim.ts` error (out of scope, inherited from Rounds 1+2) |
| `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0; output unchanged (timing-line variance only) |

### Manual Re-Test Scenarios for Step 2 (User)

If all six scenarios pass, mark `06-07-VALIDATION.md` Step 2 as PASSED.

1. Drop `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json`, click Optimize,
   pick `fixtures/Girl/` (skeleton folder, where `images/` ALREADY
   exists with source PNGs). Expect:
   - OptimizeDialog opens in pre-flight (no probe yet).
   - Click Start → ConflictDialog opens listing the ~75 collision paths
     (each source PNG at risk).
   - All three buttons functional and visibly distinct.
2. Same setup but click Cancel in ConflictDialog → both dialogs close,
   no export performed, source PNGs untouched.
3. Same setup but click Pick different folder → ConflictDialog closes,
   OS picker re-opens. Pick `/tmp/safe` → no ConflictDialog (safe
   folder), straight to OptimizeDialog re-mount → Start → normal flow.
4. Same setup but click Overwrite all → ConflictDialog closes,
   OptimizeDialog flips to in-progress, export proceeds; source images
   in `fixtures/Girl/images/` get overwritten by optimized versions.
   (Have a backup before running this test.)
5. Drop the same JSON, pick `/tmp/freshdir/` (no images/ subfolder
   exists yet) → no ConflictDialog → OptimizeDialog opens straight
   into pre-flight → Start → normal flow. Confirms the Round 3 relaxed
   contract: parent-of-images outDir is permitted when no actual
   collision exists.
6. Drop the same JSON, pick `fixtures/Girl/images/` (the
   source-images-dir ITSELF) → hard reject with the friendlier
   `'invalid-out-dir'` error message ("Output directory IS the source
   images folder…"). NO ConflictDialog opens (every output would
   collide; not a useful confirmation prompt).

### Round 3 Self-Check: PASSED

Files modified (verified via `git diff --name-only HEAD~2 HEAD`):
- FOUND: src/main/image-worker.ts
- FOUND: src/main/ipc.ts
- FOUND: src/preload/index.ts
- FOUND: src/renderer/src/components/AppShell.tsx
- FOUND: src/renderer/src/modals/ConflictDialog.tsx
- FOUND: src/renderer/src/modals/OptimizeDialog.tsx
- FOUND: src/shared/types.ts
- FOUND: tests/main/image-worker.spec.ts
- FOUND: tests/main/ipc-export.spec.ts

Round 3 commits exist (verified via `git log --oneline -3`):
- FOUND: 77296b2 feat(06-gap3): split export IPC into probe + start
- FOUND: 892b5a1 feat(06-gap3): ConflictDialog modal + AppShell probe-then-confirm overwrite flow
- (this commit) docs(06-gap3): append round 3 (overwrite UX)

---

## Round 4 — F_OK is the only collision gate (2026-04-25)

**Trigger:** the user dropped the Girl atlas-only project, manually
deleted the `images/` subfolder beside the skeleton, picked the
skeleton folder as outDir, and the ConflictDialog STILL opened listing
~75 collisions. No file existed on disk to be overwritten — the modal
was a false positive.

**Root cause:** the Round 2/3 collision-detection pipeline ran THREE
synchronous checks per row before the F_OK probe:
1. `path.resolve(row.sourcePath) === resolvedOut`
2. `path.resolve(row.atlasSource.pagePath) === resolvedOut`
3. `await fs.access(resolvedOut, F_OK)`

Checks #1 and #2 fired even when the file didn't actually exist on
disk. The loader unconditionally constructs `sourcePath` as
`<skeletonDir>/images/<regionName>.png` for atlas-only projects (the
atlas-extract fallback path that the worker resolves only at write
time). Any outDir whose `outDir + outPath` resolved to that same string
triggered the alarm regardless of whether the file was actually there.

**Fix — F_OK is the only correct gate:** collision means "would
clobber a file that currently exists on disk". Existence is the only
correct signal. Both layers simplified:

- `src/main/ipc.ts probeExportConflicts` — checks #1 and #2 deleted.
  Per row: a single `await fs.access(resolvedOut, F_OK)` returns the
  resolved path (or null). All probes still kicked off in parallel
  via `Promise.all`. Side-effect-free, no `exportInFlight` mutation.
- `src/main/image-worker.ts runExport` — same simplification at the
  per-row defense-in-depth gate. The `allowOverwrite=true` bypass
  remains (Round 3 contract: renderer "Overwrite all" branch). Error
  message updated from "Refusing to overwrite source: ..." to
  "Refusing to overwrite existing file: ..." — the strictly accurate
  description now that the gate is existence-only.

**Round 4 commits:**
- `cbf210c` fix(06-gap4): F_OK existence is the only collision gate; remove string-match false-positives
- `7b09b3d` test(06-gap4): update overwrite tests for F_OK gate; add regression for empty parent-of-images
- (this commit) docs(06-gap4): append round 4 (F_OK collision gate) to gap-fix summary

### Tests

**Updated (Round 3 → Round 4) in `tests/main/ipc-export.spec.ts`:**
- `rejects with overwrite-source when outDir is parent-of-source-images`
  — now mocks fs.access to RESOLVE so the F_OK probe surfaces the
  conflict.
- `rejects with overwrite-source when ANY row would collide` — uses
  `mockImplementation` to resolve only for the BAD row's resolved out
  and reject for the SAFE row, locking the multi-row partial-collision
  contract.
- `rejects with overwrite-source when atlas page would be overwritten`
  — same mockResolvedValue. Atlas-page collision is now indistinguishable
  from any other resolved-output existence collision (the F_OK probe
  doesn't care whether the file is the atlas page, a per-region PNG,
  or a totally unrelated file under the same name).
- `probeExportConflicts returns the list of conflicting paths` —
  mockResolvedValue so the probe returns one entry.
- `handleStartExport with overwrite=false AND conflicts → rejects` —
  mockResolvedValue so the defense-in-depth probe surfaces a conflict.

**Updated (Round 3 → Round 4) in `tests/main/image-worker.spec.ts`:**
- Default `vi.mock('node:fs/promises')` mock for `access` switched to
  mode-based dispatch: `F_OK` (mode 0) probes reject by default
  (no pre-existing files); `R_OK` (mode 4) probes resolve (sources
  readable). Same dispatch mirrored in `restoreDefaultMocks()`.
  Keeps cases (a)-(f) untouched while letting round-2/3 tests opt-in
  to a surfaced collision.
- Case (b) `missing-source` mock extended to also reject F_OK (else
  the F_OK gate fires before the R_OK throw it's testing).
- Round-2 per-row collision test renamed to "row whose resolved
  output exists on disk" and refactored to drive the gate via F_OK
  resolve on the colliding resolved-out (not via sourcePath string
  match — that mechanism is gone).
- Round-3 `allowOverwrite=false` default-protection test refactored
  similarly (F_OK resolves for the resolved out → collision surfaces).

**New (1) in `tests/main/ipc-export.spec.ts`:**
- `Round 4: conflicts are F_OK-gated, not string-match (parent-of-images
  outDir is OK when images/ subfolder is empty)` — drops a plan whose
  row's `sourcePath` string would have matched the resolved out under
  the OLD round-3 contract, mocks `fs.access` to reject (ENOENT) so the
  F_OK probe finds nothing, asserts `probeExportConflicts` returns `[]`.
  This is the regression-lock for the Girl atlas-only bug.

### Files modified

- `src/main/ipc.ts` — `probeExportConflicts` simplified (3 checks → 1
  F_OK probe per row); narrative comment updated.
- `src/main/image-worker.ts` — per-row F_OK gate replaces the round-2/3
  string-match checks; comment updated; error message updated.
- `tests/main/ipc-export.spec.ts` — 5 round-2/3 tests updated to
  drive collisions via F_OK mock; 1 new Round 4 regression test added.
- `tests/main/image-worker.spec.ts` — default `access` mock + helper
  switched to mode-based dispatch; case (b), round-2 per-row collision,
  and round-3 default-protection tests updated for the F_OK contract.
- `.planning/phases/06-optimize-assets-image-export/06-07-GAP-FIX-SUMMARY.md`
  — Round 4 section appended (this section).

### Round 4 Verification

| Check                              | Result |
| ---------------------------------- | ------ |
| `npm test`                         | 201 passed | 1 skipped (was 200 baseline; +1 new Round 4 regression test) |
| `npm test -- tests/arch.spec.ts`   | 9/9 GREEN |
| `npx electron-vite build`          | green (renderer 621.41 kB, unchanged from Round 3) |
| `npm run typecheck:web`            | clean |
| `npm run typecheck:node`           | pre-existing `scripts/probe-per-anim.ts` error (out of scope, inherited from Rounds 1–3) |
| `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` | exit 0; output unchanged (timing-line variance only) |

### Manual Re-Test Scenarios for Step 2 — Round 4 (User)

If both scenarios pass, the Girl atlas-only bug is verified fixed.

1. Drop `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (or any
   atlas-only project), MANUALLY delete the `images/` subfolder beside
   the skeleton, click Optimize, pick the skeleton folder as outDir,
   click Start. Expect:
   - NO ConflictDialog opens (the F_OK probe finds no existing files).
   - OptimizeDialog flips straight to in-progress.
   - Export proceeds; fresh `images/` subfolder created with optimized PNGs.
2. Drop the same project but DO NOT delete `images/`. Click Optimize,
   pick the skeleton folder, click Start. Expect:
   - ConflictDialog opens listing the existing files in `images/`.
   - Cancel / Pick different folder / Overwrite all all functional
     per Round 3 contract.

### Round 4 Self-Check: PASSED

Files modified (verified via `git diff --name-only HEAD~2 HEAD`):
- FOUND: src/main/image-worker.ts
- FOUND: src/main/ipc.ts
- FOUND: tests/main/image-worker.spec.ts
- FOUND: tests/main/ipc-export.spec.ts

Round 4 commits exist (verified via `git log --oneline -2`):
- FOUND: cbf210c fix(06-gap4): F_OK existence is the only collision gate
- FOUND: 7b09b3d test(06-gap4): update overwrite tests for F_OK gate
- (this commit) docs(06-gap4): append round 4 (F_OK collision gate)
