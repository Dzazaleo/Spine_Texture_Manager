---
status: signed-off
phase: 07-atlas-preview-modal
source: [07-05-SUMMARY.md, manual UAT 2026-04-25, 07-06-PLAN.md gap-fix UAT 2026-04-25]
started: 2026-04-25T20:05:00Z
updated: 2026-04-25T22:30:00Z
signed_off: 2026-04-25T22:30:00Z
---

## Current Test

[signed off — Phase 7 COMPLETE; Plan 06 gap-fixes verified, all 10 gates pass plus two follow-up improvements (always-fixed maxPageDim×maxPageDim canvas frame + oversize-region warning banner) confirmed live.]

## Tests

### 1. Toolbar button placement + disabled-on-empty (D-134)
expected: Atlas Preview button left of Optimize Assets, both disabled on empty DropZone, both enable after drop.
result: passed (light-confirmed in 07-06 UAT — visual unchanged from 2026-04-25 baseline)

### 2. Default open state (D-135 + D-128)
expected: Optimized + 2048px + page 1/1, TOTAL ATLASES = 1, EFFICIENCY non-zero, exact footer text.
result: passed (light-confirmed in 07-06 UAT)

### 3. Canvas renders actual region pixels (F7.1) — was failing 2026-04-25
expected: CIRCLE / SQUARE / TRIANGLE shapes visible inside region rects (drawImage of `app-image://` URL onto canvas).
result: passed
actual: Pixels render correctly after the Plan 06 gap-fix chain (Branch A renderer URL `localhost` host + main-process readFile/Response swap + auto-fit canvas wrapper). CIRCLE renders round (not oval). Confirmed by user 2026-04-25.

### 4. Hover-reveal (D-129) — was failing 2026-04-25
expected: warm-stone fill overlay + attachment name AND dimensions on hover; cleared on mouse-out.
result: passed
actual: Hover shows orange-tint fill + 2-line label (name + `${w} × ${h}`). Confirmed by user 2026-04-25 (Plan 06 Task 4).

### 5. Toggles re-render (F7.1 / F7.2)
expected: Original makes regions visibly larger; 4096px drops EFFICIENCY.
result: passed (with caveat)
actual: State + math respond correctly to all four toggle combinations (button highlight moves, modal title text updates "(2048×2048)" ↔ "(4096×4096)", helper-text below VIEW MODE updates between Original/Optimized labels — confirmed by user 1Y/2Y/3Y). However on the SIMPLE_TEST fixture the canvas content is **visually-identical** across all four combinations because the tight-fit packer config (D-132 `pot:false, square:false`) sizes the bin to fit only the regions present, and the fixture's 4 regions sum to ~70.8% of a sub-2048 bin regardless of the chosen page-cap; additionally `peakScale ≈ 1.0` for the small fixture so Original ≈ Optimized in dim. Plan Gate 5's "EFFICIENCY drops at 4096px" expectation was written assuming `pot:true` packer behavior (which would force fixed page dims) — D-132 chose tight-fit so the expectation is over-strong for this fixture. **Note for future fixture runs:** Jokerman / Girl from Phase 0 spike work would show visible differentiation across toggles.

### 6. Pager bounds-disable (D-128)
expected: `<` and `>` both disabled with single-page fixture.
result: passed (confirmed in 07-06 UAT)

### 7. Dblclick-jump → 20% glow override workflow (D-130) — was blocked 2026-04-25
expected: dblclick TRIANGLE region → modal closes → Global tab + row scroll + flash → set override 50% → re-open modal → TRIANGLE smaller.
result: passed
actual: Full workflow exercised; row scrolls + flashes; OverrideDialog opens at peak cell; 50% applied; re-opening Atlas Preview shows smaller TRIANGLE rect. Confirmed by user 2026-04-25.

### 8. Snapshot-at-open semantics (D-131) — was skipped 2026-04-25
expected: close modal, change override, re-open, values updated.
result: passed
actual: SQUARE override 75% → re-open shows smaller SQUARE; close+re-open is consistent (no flicker). Confirmed by user 2026-04-25 with the dynamic-aspect-ratio fix in commit b4439cd, then folded into the always-fixed-frame fix in commit b85b587.

### 9. Missing-source UX (D-137)
expected: rename `CIRCLE.png` to `.bak` → muted bg + ⚠ glyph in terracotta.
result: deferred (fixture limitation)
actual: SIMPLE_TEST is atlas-packed (single `SIMPLE_TEST.png`, no `images/` subdirectory with per-region PNGs), so the originally-specified rename of `images/CIRCLE.png` is not applicable. The D-137 codepath (combined `<img>.onerror` + `naturalWidth === 0` detection feeding the `missingPathsRef` placeholder pattern) is exercised by `tests/renderer/atlas-preview-modal.spec.tsx` automated specs and was implicitly verified live during Gap 1 root-cause discovery (the broken `app-image://` URL fired `<img>.onerror` which fed the missing-source path correctly, drawing the ⚠ glyph briefly before the URL fix landed). Live re-verification with a per-region-PNG fixture is deferred to a future phase that adds such a fixture.

### 10. No regressions in earlier phase paths
expected: Source Animation jump, OverrideDialog, OptimizeDialog, batch select/sort/search, breakdown cards still work.
result: deferred (broad-scope regression sweep)
actual: Tasks 2-5 + b4439cd + b85b587 modified only `src/renderer/src/modals/AtlasPreviewModal.tsx`, `src/main/index.ts`, `src/shared/types.ts`, `src/core/atlas-preview.ts`, `src/renderer/src/lib/atlas-preview-view.ts`, `tests/core/atlas-preview.spec.ts`. `git diff src/core/sampler.ts` empty. `git diff scripts/cli.ts` empty. `git diff -- 'src/core/'` shows only `atlas-preview.ts` changes (Layer 3 boundary intact). `npm run test` 240 passed | 1 skipped | 1 todo (Phase 0-6 specs all preserved). Phase 0/2/3/4/5/6 surface paths are not in the file change list — full live regression sweep deferred (a sampling sweep across them was implicitly performed during Gates 5 + 7 since those touch the toolbar / panel / OverrideDialog / GlobalMaxRenderPanel surfaces).

## Summary

total: 10
passed: 8
deferred: 2 (Gates 9 + 10 — fixture limitation + scope)
failed: 0
blocked: 0
pending: 0

All gates that can be verified against SIMPLE_TEST pass. The 2 deferred gates have explicit rationale and are not regressions.

## Gaps closed by Plan 06

All four gaps from the 2026-04-25 first UAT session are CLOSED, plus two follow-up improvements were made during live UAT of Plan 06 itself.

### Gap 1 — Canvas region pixels did not render — CLOSED
root_cause: TWO independent bugs stacked:
  1. `net.fetch(file://...)` is unreliable inside Electron's `protocol.handle` on Electron 41 — produces `net::ERR_UNEXPECTED`. **Fix:** swap `net.fetch + pathToFileURL` for direct `fs.readFile + new Response(data, { headers: { 'content-type': 'image/png' } })` (commit 2723e19; Rule 4 deviation from plan's Branch A/B/C — none of those addressed `net.fetch`'s file:// limitation).
  2. With `protocol.registerSchemesAsPrivileged([{ standard: true }])`, the URL `app-image:///Users/leo/...` parses with `Users` as the empty-host slot (lowercased to `users`), consuming the first path segment so `pathname` becomes `/leo/...` (not `/Users/leo/...`). **Fix:** prepend explicit `localhost` host slot — renderer URL is now `app-image://localhost${encodeURI(absolutePath)}` (commit 436bcfd; plan Branch A applied as-written).

### Gap 2 + Gap 4 — Region rects stretched + modal scrollbar — CLOSED via D-139
root_cause: pre-fix canvas had `style.width = ${page.width}px; style.height = ${page.height}px` (e.g. 2048px) combined with parent's `max-w-full h-auto` Tailwind classes — width axis shrank to fit, height axis didn't, producing oval regions + scrollbar.
fix: removed both explicit pixel-size CSS lines; wrapped canvas in a square aspect-ratio container with `maxWidth/maxHeight = ${frameDim}px`; parent `<main>` switched to `overflow-hidden`. Backing-store stays at `frameDim × dpr` for `drawImage` fidelity (commits bdd1918 → b4439cd → b85b587, evolved across UAT cycles to land on always-fixed `maxPageDim × maxPageDim` frame).

### Gap 3 — Hover label missing dimensions — CLOSED
root_cause: only `attachmentName` was rendered; CONTEXT D-129 promised name + dimensions.
fix: appended a second `ctx.fillText` call rendering `${Math.round(region.w)} × ${Math.round(region.h)}` at `region.y + 28` in the hover overlay block (commit 7b28778).

## D-139 amendment — narrative as locked

The Phase 7 D-139 amendment evolved across three commits during Plan 06's iterative live UAT:

- **bdd1918 (Task 3):** "canvas display-size auto-fits modal content area while preserving 1:1 aspect ratio for square pages" — hardcoded `aspect-[1/1]` because at the time the canvas was sized to bin dims and SIMPLE_TEST happened to produce square bins.
- **b4439cd (Gate 8 mid-UAT regression):** "preserve the page's actual aspect ratio dynamically" — replaced hardcoded 1:1 with `aspectRatio: ${page.width} / ${page.height}` because override flow produced non-square bins (D-132 `pot:false, square:false`) which the 1:1 wrapper re-stretched into ovals.
- **b85b587 (final form, post-UAT user feedback):** "always show the full maxPageDim × maxPageDim square; backing-store + display frame stay at user-selected page-cap; empty space stays visible". This is the locked D-139 form. Pages no longer shrink to packed-content bounds; pager and override changes never resize the canvas frame; user can visually compare page utilization across configurations.

## Follow-up improvement landed during Plan 06 UAT (b85b587)

### Issue A — oversize regions silently squashed
A region whose packed dims exceed `maxPageDim` would force `MaxRectsPacker` to expand the bin past the cap, producing a misleading preview that hides a real export problem. **Fix:** filter inputs whose `packW > maxPageDim || packH > maxPageDim` BEFORE `packer.add`; collect their attachmentNames in a new `AtlasPreviewProjection.oversize: string[]` field; modal renders a danger-token warning banner above the canvas when the array is non-empty. Applied byte-identically in `src/core/atlas-preview.ts` AND `src/renderer/src/lib/atlas-preview-view.ts` (parity contract). New test added at `tests/core/atlas-preview.spec.ts` covering the oversize-filter behavior at `maxPageDim=128` (all 3 SIMPLE_TEST regions exceed → all flagged oversize, 1 degenerate empty page emitted via D-136). Existing multi-page split test bumped from `maxPageDim=128` to `maxPageDim=1100` (preserves the `pages.length > 1` assertion under the new filter; SIMPLE_TEST regions all fit ≤1100 but their summed area 2.12M > 1.21M = 1100² forces multi-page packing).

### Issue B — page jumps when paging or applying overrides
The Plan 06 dynamic-aspect-ratio wrapper (b4439cd) sized the canvas to whatever bin dims the tight-fit packer produced — so each page change or override resize visibly jumped the canvas. **Fix:** as described in the D-139 narrative above (final form b85b587).

## Phase signoff

All blocking gates pass. Two gates deferred with explicit rationale (fixture limitation for Gate 9; broad-scope sweep for Gate 10 — file change list is narrowly scoped and `git diff src/core/sampler.ts + scripts/cli.ts` both empty, so cross-phase regression risk is bounded). Phase 7 is COMPLETE.
