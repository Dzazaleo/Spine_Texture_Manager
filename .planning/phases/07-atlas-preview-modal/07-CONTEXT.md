---
name: Phase 7 — Atlas Preview modal Context
description: Locked decisions for Phase 7 — visualize what the optimized atlas WOULD look like via maxrects-packer projection, with toggles for Original/Optimized view + 2048/4096 page-resolution cap + per-page pager. Single-page-at-a-time canvas rendering with actual region pixels drawn into packed slots; default outline-only with hover-reveal of fill+label. Per-page efficiency % + total page count are headline metrics; file-size estimation explicitly de-scoped. Dblclick a region rect closes modal and jumps to the matching row in Global Max Render Source panel via Phase 3 D-72's existing jump-target system. Snapshot-at-open semantics tied to AppShell.overrides Map. Hand-rolled ARIA modal cloning OverrideDialog + OptimizeDialog scaffold. Sampler stays LOCKED. CLI stays byte-for-byte unchanged.
phase: 7
---

# Phase 7: Atlas Preview modal — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 7` interactive session

<domain>
## Phase Boundary

Phase 7 introduces an **Atlas Preview modal** (F7) — a visualization-only surface that projects what the rig's atlas WOULD look like under two scenarios (Original = source-dim re-pack, Optimized = post-Phase-6 export-dim re-pack) and two resolution caps (2048px / 4096px max page dim). Uses `maxrects-packer` to compute the packing layout, renders each page as a 2D canvas with actual region pixel content drawn into packed slots, and surfaces per-page fill efficiency + total page count as the headline metrics. Reuses Phase 6's `buildExportPlan` output as the AFTER input — single source of truth for "what optimize would produce."

Crucially, **F7.2's "estimated file-size delta" is explicitly de-scoped** by user decision (see D-127 below) — the readout is dims + page count + per-page efficiency only. No bytes shown. Reframing rationale: we don't know output bytes without running sharp, and the page-count delta at a given resolution cap already conveys the savings story (e.g., "Original needs 4 pages @ 2048, Optimized needs 1 page @ 2048" is more meaningful than "~17 MB → ~3 MB ± 50%").

A novel UX gesture lands here: **double-click a region rect in the canvas → modal closes → AppShell jumps to the matching row in Global Max Render Source panel + flashes it** (reusing Phase 3 D-72's existing cross-panel jump-target system). User then double-clicks the peak cell to open OverrideDialog (Phase 4 D-69) and edit the override. Re-opening the modal snapshots the new plan and visibly shrinks the affected region's rect.

Ships `src/core/atlas-preview.ts` (pure-TS plan builder folding `summary.peaks` + `summary.unusedAttachments` + `overrides` Map into `AtlasPreviewInput[]` per scenario × resolution combination, then invoking maxrects-packer to produce `AtlasPreviewProjection { pages: AtlasPage[] }` with `AtlasPage { width, height, regions: PackedRegion[], usedPixels, totalPixels, efficiency }`), `src/renderer/src/lib/atlas-preview-view.ts` (Layer 3 byte-identical renderer copy if maxrects-packer's API allows pure-TS use; if it pulls in Node deps, the projection runs in main and ships back via IPC — planner picks based on Context7 verification), `src/renderer/src/modals/AtlasPreviewModal.tsx` (hand-rolled ARIA modal cloning OverrideDialog + OptimizeDialog scaffold; left-rail control panel + main-view canvas; canvas hit-testing for dblclick → onJumpToAttachment callback), and an AppShell toolbar button entry next to "Optimize Assets" plus extension of the existing Phase 3 D-72 jump-target system to accept Atlas Preview as a source.

Sampler stays LOCKED. CLI stays byte-for-byte unchanged (Phase 5 D-102). OptimizeDialog + Override dialogs + panel components stay structurally untouched (only the AppShell jump-target prop wiring extends slightly to recognize Atlas Preview as a source). Layer 3 (`src/core/*` DOM/fs-free) preserved — the renderer reads source PNG bytes directly via `file://` + canvas `drawImage` (no IPC for pixel data; single page-PNG decode reused via srcRect for atlas-packed rigs).

**In scope:**
- `src/core/atlas-preview.ts` — **new pure-TS module**. Exports `buildAtlasPreview(summary: SkeletonSummary, overrides: Map<string, number>, opts: { mode: 'original' | 'optimized', maxPageDim: 2048 | 4096 }): AtlasPreviewProjection`. Folds the existing inputs into the per-region dim list per the chosen mode (Original = `sourceW/H` for per-region-PNG projects, `atlasSource.w/h` for atlas-packed; Optimized = `outW/H` from Phase 6 `buildExportPlan` semantics), invokes maxrects-packer with hardcoded params (2px padding, no rotation, smart heuristic), returns the page projection. Pure number/object math; no `fs`, no `sharp`, no Electron — IF maxrects-packer is browser-safe (planner verifies via Context7).
- `src/shared/types.ts` — **extension target**. Add `AtlasPreviewInput` (`{ attachmentName, sourceW, sourceH, outW, outH, sourcePath, atlasSource? }` — derived from ExportRow shape but with both source AND output dims so a single input list serves both modes), `PackedRegion` (`{ attachmentName, x, y, w, h, sourcePath, atlasSource?, sourceMissing?: boolean }` — hit-testable + drawable), `AtlasPage` (`{ pageIndex, width, height, regions: PackedRegion[], usedPixels, totalPixels, efficiency }`), `AtlasPreviewProjection` (`{ mode, maxPageDim, pages: AtlasPage[], totalPages }`). All structuredClone-safe (per Phase 1 D-21 lock).
- `src/renderer/src/lib/atlas-preview-view.ts` — Layer 3 inline copy of `buildAtlasPreview` IF maxrects-packer is renderer-safe (Phase 4 D-75 + Phase 6 D-108 precedent). The renderer needs to call it on every mode/resolution toggle; an IPC round-trip per toggle would feel sluggish. If maxrects-packer pulls in Node deps that break Layer 3, fall back to: main computes projection, renderer requests via `api.computeAtlasPreview(input, opts)` → IPC. Planner determines via Context7 + a small spike against the package.
- `src/renderer/src/modals/AtlasPreviewModal.tsx` — **new**. Hand-rolled ARIA modal (Phase 4 D-81 pattern: `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + focus-trap + ESC + click-outside + Tab cycles). Layout matches user-supplied screenshot:
  - **Header:** title `"Atlas Preview"` + sub-line `"Visual estimation of packed textures (NxN)"` (where NxN = currently selected resolution cap) + close X button (top-right).
  - **Left rail (sticky panel):**
    - `VIEW MODE` segmented toggle: `Original` / `Optimized` (warm-stone accent fill on active).
    - Caption under toggle (mode-dependent): `"Showing source/unoptimized sizes"` for Original, `"Showing calculated max render sizes"` for Optimized.
    - `ATLAS RESOLUTION` segmented toggle: `2048px` / `4096px`.
    - `ATLAS PAGE` stepper: `<` button + `N / total` + `>` button. Disabled at bounds.
    - `TOTAL ATLASES` info card: large numeric.
    - `EFFICIENCY (PAGE N)` info card: percentage + sub-line `"X% Empty Space"`.
  - **Main view (right):** single `<canvas>` rendered at the chosen resolution cap (scaled to fit modal pane via CSS `max-width: 100%; height: auto`). Each region drawn via `drawImage` at packed coords. Default: rect outline only (no fill, no label). Hover: colored fill (warm-stone accent at low opacity) + label overlay (attachment name) on the hovered region.
  - **Footer:** italic note `"* Preview assumes 2px padding and no rotation. Actual export engine may vary slightly."`
  - **Dblclick gesture on canvas:** hit-test against `pages[currentPageIndex].regions[]`, find the rect containing click coords, invoke `onJumpToAttachment(attachmentName)` callback prop, which the AppShell wires to its existing jump-target system (D-130 below).
- `src/renderer/src/components/AppShell.tsx` — **touched**. Add toolbar button `"Atlas Preview"` next to existing `"Optimize Assets"` button (D-117 right-aligned next to filename chip). Enabled when `summary` is loaded. Click handler: snapshot the override map + summary into modal props (D-131 below), mount `<AtlasPreviewModal />`. Extend the existing Phase 3 jump-target system (D-72) to accept `'atlas-preview'` as a `from` source — when AtlasPreviewModal calls `onJumpToAttachment(attachmentName)`, AppShell sets `activeTab='global'` + dispatches the existing jumpTarget event for GlobalMaxRenderPanel + unmounts the modal. No new pattern — just one more producer of an existing event shape.
- `src/renderer/src/index.css` — **untouched**. Reuses warm-stone tokens + `--color-danger` (Phase 5 D-104) for the missing-source glyph. Modal accent for active toggles uses existing `--color-accent` (Phase 1 D-12/D-14). May add a single `--color-success` token if planner finds the existing palette doesn't cover the green efficiency-card accent shown in the screenshot — planner's call (Phase 5 D-104 precedent for adding a token).
- `package.json` — adds `maxrects-packer` (planner picks version after Context7 verification; ROADMAP names this lib so the choice is locked at the lib-name level). Pure JS package — no native binaries; should not require asarUnpack (verify in planning).
- Tests:
  - `tests/core/atlas-preview.spec.ts` — **new**. Cases: (a) SIMPLE_TEST Original @ 2048 → all 3 regions fit in 1 page; pages.length === 1; efficiency in expected range; (b) SIMPLE_TEST Optimized @ 2048 → same regions but at outW/H; efficiency strictly higher than Original (regions are smaller); (c) override 50% on TRIANGLE → Optimized projection's TRIANGLE region has expected packed dims; (d) ghost-fixture (Phase 5) → GHOST excluded from BOTH modes (parity with D-109 — atlas preview reads same exclusion); (e) atlas-packed fixture (Jokerman if available, else synthesized) → Original uses atlasSource.w/h, not page dims; (f) multi-page projection at small page cap → pages.length > 1, regions split deterministically; (g) Math.ceil-thousandth on Optimized dims matches Phase 6 D-110 Round 5 amendment; (h) hygiene grep — no `fs`/`sharp`/Electron imports in `src/core/atlas-preview.ts`.
  - `tests/renderer/atlas-preview-modal.spec.tsx` (or similar — Phase 4/6 left renderer test framework choice open; planner picks consistent with prior decision) — modal opens with default view (Optimized @ 2048, page 1), toggles fire re-render, pager bounds-disable correctly, dblclick on canvas fires `onJumpToAttachment` with correct attachmentName, missing-source rendering path shows the glyph (mock missing file).
  - `tests/arch.spec.ts` — Layer 3 grep extends to `src/core/atlas-preview.ts`. If `src/renderer/src/lib/atlas-preview-view.ts` is created (Layer 3 inline copy), add a parity grep similar to the Phase 4 overrides + Phase 6 export parity tests.

**Out of scope (deferred to later phases or explicit Out of Scope per REQUIREMENTS.md):**
- **Atlas re-packing (writing a new `.atlas` file).** REQUIREMENTS.md "Out of scope". Phase 7 is preview-only; the user re-runs Spine's atlas packer post-Optimize Assets.
- **File-size estimate (F7.2 "estimated file-size delta").** Explicitly de-scoped by user decision (D-127). Page count + dims + per-page efficiency are the only metrics. F7.2 reframed.
- **Sample-based file-size extrapolation.** No sharp invocation in Phase 7. Atlas Preview stays out of the sharp dependency path; only Phase 6's image-worker decodes pixels.
- **User-configurable packer params** (rotation toggle, padding slider, smart heuristic alternatives). Hardcoded at 2px padding, no rotation, smart heuristic. Footer disclaimer sets expectations.
- **Atlas page export.** No "export this preview as a PNG" button. Visualization only.
- **Export of the per-region rectangles list as a CSV / report.** Not requested.
- **Live-reactive override updates.** Modal is snapshot-at-open (D-131). User closes + reopens to refresh after editing overrides.
- **Multiple resolution options beyond 2048 / 4096.** No 1024, no 8192, no custom input. Two discrete options match the screenshot.
- **Side-by-side Original + Optimized view.** Single-mode view with toggle (per user clarification — the screenshot is the canonical layout).
- **Auto-open OverrideDialog after dblclick-jump.** User chose "just focus + flash row" (D-129 sub-decision). Two-gesture workflow: dblclick rect → row flashes; user dblclicks peak → OverrideDialog opens.
- **Honor originating tab on dblclick-jump.** Always lands on Global Max Render Source panel (D-129). Animation Breakdown's per-animation row ambiguity makes "wherever I came from" impractical.
- **Drag-to-zoom or pinch-zoom on canvas.** Canvas scales to fit modal pane via CSS. No interactive zoom.
- **Region search / filter inside the modal.** SearchBar (Phase 2) lives in panels; not duplicated in the modal.
- **Atlas-packed projects at default rotation behavior.** atlasSource regions enter the BEFORE re-pack at their declared (w, h) regardless of whether the original atlas had rotated them. Rotation is uniformly off in the projection.
- **CLI atlas-preview command.** D-102 byte-for-byte lock.
- **Multi-tab / multi-window atlas previews.** App is single-window for v1.
- **Animation Breakdown panel changes.** No.
- **OverrideDialog changes.** No.

</domain>

<decisions>
## Implementation Decisions

### Data sources + projection inputs (Area 1)

- **D-124: BEFORE view = re-pack source PNGs at original dims.** "Original" mode feeds the maxrects-packer with each region's source dims (per-region-PNG projects: `sourceW × sourceH`; atlas-packed projects: `atlasSource.w × atlasSource.h`). Re-pack is performed even when a real `.atlas` file exists — apples-to-apples comparison with the AFTER projection (same packer, same params, only the input dims differ). Works uniformly for atlas-less projects (SEED-001 future case) and atlas-packed projects (Jokerman). Rejected: read existing .atlas page dims as BEFORE (asymmetric with AFTER; doesn't work for atlas-less rigs); both side-by-side (more UI surface; toggle pattern is cleaner per user clarification).

- **D-125: AFTER view = ExportRow.outW × outH (post-Phase-6 optimization).** "Optimized" mode reads the exact output dims that Phase 6's `buildExportPlan` would write. Reflects current user overrides + Phase 5 unused exclusion + ceil-thousandth math (Phase 6 D-110 Round 5 amendment). Atlas Preview literally previews the bytes Optimize Assets will produce. Single source of truth: same plan/derived-values feed OptimizeDialog and AtlasPreviewModal. Rejected: recompute from peakScale ignoring overrides (less useful — live preview should reflect user decisions).

- **D-126: Atlas-packed projects use atlasSource.w × atlasSource.h for BEFORE.** Per-region declared source dims enter the re-pack as if each region were a standalone PNG. BEFORE shows what a hypothetical "unpack + re-pack at source dims" atlas would look like — same conceptual model as per-region-PNG projects. Apples-to-apples symmetric with the AFTER projection. Rejected: existing page dims as BEFORE for atlas-packed (breaks symmetry with AFTER pack params; conflates packing decisions with source-dim decisions); skip atlas-packed projects entirely (Jokerman support is in scope; hybrid would confuse the toggle UX).

### View modes + UI controls (Area 2)

- **D-127: F7.2 file-size estimate explicitly de-scoped — dims + page count + per-page efficiency only.** No bytes shown anywhere in the modal. F7.2's literal "estimated file-size delta" is reinterpreted as "projected atlas dims + page count" — both of which the user can compare across the Original/Optimized toggle to see the savings story. Honest about what we don't know without running sharp; avoids defending estimation accuracy. **Requirement reinterpretation flagged for Phase 7 acceptance review** — verifier should accept the page-count delta as the F7.2 evidence rather than expecting a byte readout. Rejected: heuristic estimate (off by 2-3x on transparency-heavy PNGs; misleading), sample-based extrapolation (pulls sharp into Phase 7's path; adds first-open latency), source-bytes-only (asymmetric BEFORE has bytes, AFTER doesn't).

- **D-128: BEFORE/AFTER is a segmented toggle (`Original` / `Optimized`), not side-by-side.** Plus a separate `ATLAS RESOLUTION` toggle (`2048px` / `4096px`) for the max page dim cap. Four view combinations accessible via the two toggles: Original@2048, Original@4096, Optimized@2048, Optimized@4096. User flips between them to see the savings story across resolutions. Plus a `<` `N / total` `>` pager for navigating multi-page projections (one page rendered at a time in the main view). Cards show `TOTAL ATLASES: N` (headline metric) and `EFFICIENCY (PAGE N): X%` (per-page fill). Rejected: side-by-side comparison (fits less per page; harder to compare at a glance); third resolution option (1024 / 8192 / custom — not requested; two discrete options match shipping pipelines).

- **D-129: Canvas rendering = 2D canvas, single-page view, default outline-only with hover-reveal.** Each page's `<canvas>` element sized to `(maxPageDim × maxPageDim)` CSS pixels (scaled to fit modal pane). Each `PackedRegion` drawn in two layers: (1) `drawImage` of the source PNG content into the packed (x, y, w, h) slot via `(srcImg, 0, 0, sourceW, sourceH, packedX, packedY, packedW, packedH)` — the source image is downsampled by the canvas to fit the packed slot, visually approximating what sharp will produce; (2) `strokeRect` outline at packed coords for the rectangle visibility. **Hover state** (mousemove hit-testing): the hovered region gets a colored fill overlay (warm-stone accent at low opacity, e.g., `rgba(255, 156, 73, 0.25)`) + the attachment name overlaid as text in the rect. Clean default scan; identity revealed on demand. Rejected: HTML/SVG divs (more DOM weight; no native pixel rendering for region content); table-only (no spatial visualization — defeats "Atlas Preview"); always-visible labels + colored fills (cluttered at 100+ regions).

- **D-130: Canvas dblclick gesture jumps to the texture's row in Global Max Render Source panel via Phase 3 D-72's existing jump-target system.** Hit-test on dblclick: loop `pages[currentPageIndex].regions[]`, find the rect containing the click coords. Invoke `onJumpToAttachment(attachmentName)` callback prop. AppShell wires this to its existing jump-target system (Phase 3 D-72 — used for Source Animation chip → Animation Breakdown jump): set `activeTab='global'` + dispatch jumpTarget event with `{ panel: 'global', attachmentName, ts: Date.now() }`, then unmount the modal. GlobalMaxRenderPanel sees the jumpTarget prop, scrolls the matching row into view, and flashes it (existing animation). User then double-clicks the peak cell themselves to open OverrideDialog (Phase 4 D-69) — **two-gesture workflow per user choice**: dblclick rect → row focused; user dblclicks peak → dialog opens. Re-opening the modal after applying an override snapshots the new plan (D-131) and the affected region's rect visibly shrinks. Rejected: auto-open OverrideDialog on landing (jarring multi-state transition; user is not in control of when the dialog appears); honor originating tab (Animation Breakdown shows same texture in N rows — ambiguous which to focus; Global is the canonical override path with one row per texture).

### Packer params + library (Area 2 cont.)

- **D-132: Packer = `maxrects-packer` (npm) with hardcoded params: 2px padding, no rotation, smart heuristic.** Library named in ROADMAP. Hardcoded config matches the screenshot's footer disclaimer (`"* Preview assumes 2px padding and no rotation. Actual export engine may vary slightly."`). No user-facing controls beyond the resolution toggle. Planner verifies via Context7 that maxrects-packer is browser-safe (no Node deps); if it pulls in fs/path, the projection runs in main and ships pages back via IPC (single round-trip per mode×resolution combination — 4 combinations precomputed on modal open is acceptable). Rejected: expose padding / rotation toggles (more UI surface; defeats the "preview" framing — actual export uses Spine's packer which the user runs themselves post-export).

### Pixel rendering source (Area 2 cont., Claude's discretion)

- **D-133 [discretion]: Renderer loads source PNG bytes directly via `file://` + canvas `drawImage`.** Per-region-PNG projects: `<img src="file:///abs/path/region.png">` per region (or shared cache keyed by sourcePath); drawn into the canvas via `drawImage(img, 0, 0, sourceW, sourceH, packedX, packedY, packedW, packedH)`. Atlas-packed projects: load each unique `atlasSource.pagePath` once (cached by URL); drawn via `drawImage(pageImg, atlasSource.x, atlasSource.y, atlasSource.w, atlasSource.h, packedX, packedY, packedW, packedH)` — srcRect crops the region from the page atlas. Single page-PNG decode reused across all regions on that page. Smallest IPC footprint; matches existing skeleton-load pattern (preload already grants file paths). Requires `webSecurity` to allow `file://` images, which the existing app already does (skeleton + atlas + per-region PNGs all load via file paths). Rejected: main returns base64 dataURLs per region (large IPC payload at 200+ regions; unnecessary memory churn); main returns raw RGBA via sharp.raw() (heaviest payload; pulls sharp into the preview path).

### Trigger + dialog flow (Area 4)

- **D-134: Modal trigger = persistent AppShell toolbar button "Atlas Preview" next to "Optimize Assets" (Phase 6 D-117).** Two siblings in AppShell top chrome (right of filename chip): `Atlas Preview` + `Optimize Assets`. Both enabled when `summary` is loaded; both visible from any tab. Click on `Atlas Preview` opens the modal directly with default view. Rejected: inside OptimizeDialog as a sub-action (less discoverable; couples preview to export intent — user might want to preview before committing to optimize); both-toolbar-AND-OptimizeDialog (extra surface for marginal gain; deferred).

- **D-135: Default view on open = Optimized @ 2048, page 1.** Mobile-pipeline realistic (most ship 2k-capped atlases). Likely to show multi-page projection on real rigs (motivating reason to inspect). User toggles to 4096 to see "what if I went bigger" or to Original to compare. Rejected: Optimized @ 4096 (more impressive headline but less realistic); Original @ 4096 (reveal-style; less direct than leading with the headline result).

- **D-131: Snapshot-at-open semantics — modal reads `buildAtlasPreview(summary, overrides, opts)` once on mount + on every toggle/pager change within the open session.** Modal does NOT subscribe to AppShell.overrides changes while open (focus-trap + click-outside-closes block override edits behind the modal anyway). User closes the modal + edits an override + reopens to see the refreshed plan. Matches OptimizeDialog's pre-flight snapshot pattern (Phase 6 D-118). Rejected: live-reactive subscription (adds complexity without unlocking a real workflow given the modal blocks panel interaction).

- **D-136: Edge case — empty pack at degenerate input → always render at least page 1.** If `summary.peaks.length === 0` (no rendered attachments — possible on degenerate fixtures), render an empty page-1 canvas with `EFFICIENCY: 0%` and `TOTAL ATLASES: 1`. No special-case modal-fails-to-open path; predictable UX. SIMPLE_TEST (3 regions on a 2048 canvas) just looks sparse — that's fine. Rejected: empty-state message (extra branching for a near-impossible degenerate case; emptiness is self-evident).

### Missing-source handling (Area 5)

- **D-137: Missing source PNG → render rect outline + muted placeholder pattern + ⚠ glyph + hover tooltip "Source missing: <path>".** Modal still opens; pack math still works (only dims matter for packing — sourceW/H is on the SkeletonSummary and doesn't depend on the file existing). The visual broken-image affordance lets the user see exactly which regions have problems without the modal failing wholesale. `--color-danger` (Phase 5 D-104) for the glyph. Detection: renderer attempts `<img src="file://...">` per unique path; `onerror` flips a per-region `sourceMissing: true` flag in the rendering state. Rejected: skip missing regions silently (misleading — fewer pages shown than reality); refuse to open modal if any source missing (too brittle for partial-failure workflows; user might want to preview what they have).

### Accessibility (Area 5, Claude's discretion)

- **D-138 [discretion]: Modal chrome a11y-compliant; canvas itself is decorative with summary aria-label.** ARIA modal pattern (Phase 4 D-81) on the dialog root. Left rail controls (mode toggle, resolution toggle, pager, info cards) are standard `<button>` / `<segmented>` elements with proper labels — keyboard users navigate via Tab/Enter/arrow keys. The `<canvas>` element gets `role="img"` + `aria-label="Packed atlas page N of M, X regions, Y% efficiency"` (single description summarizing what's drawn). Hover-only labels on the canvas are visual-only — screen reader users get the page count + efficiency from the cards, which conveys the primary metrics. Pragmatic posture matches industry norms for atlas viewers (Spine's editor itself has no canvas a11y). Region-level keyboard navigation deferred to a later polish phase if requested. Rejected: full canvas a11y with regions-on-this-page drawer (significantly more UI surface; nice-to-have rather than required for a preview-only modal).

### Claude's Discretion (additional planner guardrails)

- **Toolbar button styling.** Reuse warm-stone tokens (Phase 1 D-12/D-14). Label `"Atlas Preview"`. Position: AppShell top chrome, right-aligned, immediately left of `"Optimize Assets"` button. Icon optional (small map glyph in screenshot — planner picks: Unicode glyph or none).

- **Renderer test framework.** Phase 4 + Phase 6 left this open; planner picks consistent with prior phase choice. Core atlas-preview.spec.ts is pure-TS in vitest regardless.

- **Modal component structure.** Hand-rolled per Phase 4 D-81. Single file `src/renderer/src/modals/AtlasPreviewModal.tsx`. May extract small subcomponents (LeftRail, AtlasCanvas, InfoCard) inline or to `src/renderer/src/components/` if any are reused — planner's call.

- **Layer 3 boundary for maxrects-packer.** Planner verifies via Context7 + a small spike: if maxrects-packer is browser-safe pure JS, run the projection in `src/core/atlas-preview.ts` + Layer 3 inline copy at `src/renderer/src/lib/atlas-preview-view.ts` (Phase 4 D-75 + Phase 6 D-108 precedent — parity grep test locks the two copies against drift). If maxrects-packer pulls in Node deps that break Layer 3, fall back to: main computes projection via IPC `api.computeAtlasPreview(input, opts)`, renderer caches all 4 mode×resolution combinations on modal open. Either is acceptable; user has not expressed a preference. Pure-renderer is preferred for snappy toggle interactions.

- **Hover hit-testing performance.** Mousemove fires 60+ Hz; hit-testing N regions per event is O(N). At 200+ regions per page, naive linear scan is ~6,000 checks/sec — fine for modern hardware but planner can optimize via spatial index (R-tree, grid bucketing) if profiling shows jank. Recommendation: ship naive O(N) first; optimize only if needed.

- **Canvas device-pixel-ratio.** Renderer sets `canvas.width = maxPageDim * window.devicePixelRatio` + `canvas.style.width = maxPageDim + 'px'` for retina-crisp rendering. Standard browser canvas pattern.

- **Image cache lifecycle.** Source PNG `<img>` cache keyed by absolute path persists across mode toggles (same images apply to both Original and Optimized — only the dest dims change). Cleared on modal unmount. May leverage browser's native image cache via consistent `src` URLs.

- **Missing-source detection** runs lazily on first canvas render per region (via `<img>.onerror`). Subsequent toggles within the same session reuse the cached missing flag — no re-attempt to reload until modal closes + reopens.

- **Threat-model lite.**
  - File:// images load only from paths the loader has already validated as siblings of the dropped JSON (existing trust boundary). No new path-traversal surface.
  - Canvas dblclick → onJumpToAttachment receives an attachmentName from the trusted summary list (not user input). No injection surface.
  - maxrects-packer is fed numeric dims only (no string content from atlas) — no prototype-pollution surface from the input shape.
  - No network I/O. No telemetry. Modal is local-only.

- **`--color-success` token addition (if needed).** The screenshot's EFFICIENCY card has a green accent. If the existing warm-stone palette doesn't have a green token, planner may add `--color-success` to `src/renderer/src/index.css` (Phase 5 D-104 precedent for adding `--color-danger`). Otherwise the card uses muted stone.

- **OptimizeDialog interaction.** OptimizeDialog stays untouched. The Atlas Preview button is independent — clicking it while OptimizeDialog is open is not a supported flow (OptimizeDialog blocks click-outside; user must close OptimizeDialog first to access toolbar).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Phase 7" — approved-plan numbering offset; canonical narrative for the Atlas Preview modal + maxrects-packer + before/after visualization.

### Project instructions
- `CLAUDE.md` — rule #5 (`src/core/*` is pure TS, no DOM, no fs) — `src/core/atlas-preview.ts` is the projection builder ONLY; no DOM/fs imports. Rule #4 (math phase doesn't decode PNGs) — Phase 7 doesn't decode PNGs in `core/`; the renderer uses canvas drawImage which is browser-native. Rule #3 (sampler tick lifecycle) — Phase 7 makes ZERO sampler changes.

### Requirements
- `.planning/REQUIREMENTS.md` §F7 (Atlas Preview modal):
  - **F7.1** Before/after side-by-side atlas visualization using a packer (e.g., `maxrects-packer`) → reframed as toggle-switched (D-128) per user clarification; same content, different layout.
  - **F7.2** Show dimensions and estimated file-size delta → **REINTERPRETED**: dims + page count + per-page efficiency only (D-127). File-size estimate explicitly de-scoped. Verifier accepts page-count delta across mode toggle as the F7.2 evidence.

### Locked Phase 6 export math (single source of truth for AFTER dims)
- `.planning/phases/06-optimize-assets-image-export/06-CONTEXT.md`:
  - **D-108** — per-sourcePath dedup with `max(effectiveScale)`. Atlas Preview reads the same deduped ExportRow shape so per-region rendering is unambiguous.
  - **D-109** — unused exclusion via `summary.unusedAttachments`. Atlas Preview applies the same exclusion to BOTH modes (Original and Optimized) for parity.
  - **D-110 Round 5 amendment** — ceil + ceil-thousandth scale for output dims. Atlas Preview's Optimized mode uses these exact dims for packed slot sizes.
  - **D-111** — effective scale resolution: `applyOverride(percent)` from `src/core/overrides.ts`. Atlas Preview reads the same `overrides` Map AppShell owns.

### Locked override math
- `.planning/phases/04-scale-overrides/04-CONTEXT.md`:
  - **D-91** — `applyOverride(percent) → { effectiveScale: clampedPercent / 100 }`. With override → effective = X / 100; no override → effective = peakScale. Atlas Preview consumes resolved effectiveScale via Phase 6's plan-builder semantics.
  - **D-75/D-76** — `clampOverride` clamps to [1, 100]. Renderer copy at `src/renderer/src/lib/overrides-view.ts` is byte-identical (Layer 3 precedent for Atlas Preview's optional renderer-copy).
  - **D-69** — Double-click peak opens OverrideDialog. Atlas Preview's dblclick-jump lands on the row; user double-clicks peak themselves to fire D-69 (two-gesture workflow per D-130).

### Locked unused-attachment surface
- `.planning/phases/05-unused-attachment-detection/05-CONTEXT.md`:
  - **D-99** — Unused and peak rows are disjoint. Atlas Preview reads the disjoint sets to subtract `summary.unusedAttachments` from BOTH mode projections.
  - **D-101** — `summary.unusedAttachments: UnusedAttachment[]` shape. Available on existing IPC payload — no new channel.
  - **D-104** — `--color-danger #e06b55` `@theme` token reusable for missing-source ⚠ glyph in Atlas Preview canvas (D-137).

### Locked IPC + AppShell patterns
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md`:
  - **D-21** — SkeletonSummary is the locked IPC payload; everything is structuredClone-safe. AtlasPreviewInput / PackedRegion / AtlasPage / AtlasPreviewProjection follow this rule — plain primitives + arrays + nested plain objects.
  - **D-12 / D-14** — Tailwind v4 warm-stone tokens. Atlas Preview reuses `--color-accent` for active toggle fill, warm-stone for chrome, no new tokens unless `--color-success` is needed for the EFFICIENCY card green accent.
- `.planning/phases/03-animation-breakdown-panel/03-CONTEXT.md`:
  - **D-49 / D-50** — AppShell owns top chrome. Atlas Preview toolbar button goes here next to Phase 6's Optimize Assets button (D-134).
  - **D-72** — Cross-panel jump-target system (Source Animation chip → Animation Breakdown). Atlas Preview's dblclick-jump REUSES this exact mechanism with `'global'` as the destination panel and `'atlas-preview'` as the source — extension is one more event producer, not a new pattern (D-130).

### Locked modal pattern
- `.planning/phases/04-scale-overrides/04-CONTEXT.md` §"Dialog accessibility + keyboard wiring":
  - **D-81** — Modal ARIA pattern: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus-trap, ESC closes, click-outside closes, Tab cycles. AtlasPreviewModal clones this pattern. Hand-rolled — no modal library. Same warm-stone token vocabulary.
- `.planning/phases/06-optimize-assets-image-export/06-CONTEXT.md`:
  - **D-117** — Persistent AppShell toolbar button entry point. Atlas Preview button (D-134) sits adjacent to Optimize Assets button — same pattern, same enable-when-summary-loaded semantics.
  - **D-118** — Two-step UX with snapshot-at-open. Atlas Preview is single-step (no folder picker; modal opens directly) but inherits the snapshot-at-open semantics (D-131).

### CLI lock
- `.planning/phases/05-unused-attachment-detection/05-CONTEXT.md` **D-102** — `scripts/cli.ts` stays byte-for-byte. Atlas Preview is renderer-only; no `--atlas-preview` flag.

### Architecture boundary
- `tests/arch.spec.ts` — Layer 3 grep guard. `src/core/*` forbidden imports (current list: sharp, node:fs, fs/promises, DOM types) extends with maxrects-packer's transitive deps if any leak. If maxrects-packer is browser-safe, `src/core/atlas-preview.ts` is allowed to import it; if not, the projection moves to main and `src/core/atlas-preview.ts` only exports types + the input-derivation function (planner picks at planning time).

### External docs (planner verifies via Context7)
- `https://www.npmjs.com/package/maxrects-packer` — packer API; constructor params (padding, allowRotation, square, smart heuristic); `.add(width, height, data)` + `.bins[]` output shape; pure JS / Node-deps audit.
- `https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage` — canvas drawImage with srcRect (9-arg form) for cropping atlas-page regions.
- `https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/onerror` — `<img>.onerror` for missing-source detection.
- `https://www.electronjs.org/docs/latest/tutorial/security#csp-meta-tag` — file:// image-src CSP allowance (verify existing CSP from Phase 1 D-13 covers it).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/overrides.ts` — `applyOverride(percent)` for resolving effectiveScale. Atlas Preview's Optimized mode reads ExportRow.outW/H which already incorporate this — no direct call needed in `src/core/atlas-preview.ts`.
- `src/core/export.ts` — `buildExportPlan(summary, overrides)` produces the canonical ExportRow[] with sourcePath, atlasSource, outW, outH. Atlas Preview's Optimized projection consumes this directly. Single source of truth.
- `src/shared/types.ts` — Phase 1 D-21 lock for IPC types. Phase 7 extends here with AtlasPreviewInput, PackedRegion, AtlasPage, AtlasPreviewProjection. Same plain-primitive discipline. ExportRow already exposes sourcePath + atlasSource which Atlas Preview needs for pixel rendering (D-133).
- `src/renderer/src/components/AppShell.tsx` — owns top chrome + toolbar buttons + jump-target dispatch (Phase 3 D-72). Atlas Preview adds one more toolbar button (D-134) and one more jump-target source (D-130) — both extension points already exist.
- `src/renderer/src/modals/OverrideDialog.tsx` + `OptimizeDialog.tsx` + `ConflictDialog.tsx` — three precedents for hand-rolled ARIA modals. AtlasPreviewModal clones the scaffold (D-81 pattern).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — already exposes the jumpTarget consumption pattern (Phase 3 D-72). Atlas Preview's dblclick lands here; no new code in the panel.
- `src/renderer/src/index.css` `--color-danger` (Phase 5 D-104) — missing-source ⚠ glyph. `--color-accent` (Phase 1) — active toggle fill.

### Established Patterns
- **Pure-TS core ↔ DOM/I/O outer (Layer 3 arch.spec.ts).** Phase 7 preserves this: `src/core/atlas-preview.ts` has no fs/sharp/Electron; canvas + DOM work lives in `src/renderer/src/modals/AtlasPreviewModal.tsx`. Layer 3 inline-copy precedent (Phase 4 D-75 + Phase 6 D-108) applies if maxrects-packer is browser-safe.
- **IPC types extend `src/shared/types.ts` with structuredClone-safe shapes** — no Map, no class instances, no Float32Array.
- **Modals are hand-rolled** (no library deps per Phase 4 D-81). AtlasPreviewModal continues the pattern.
- **Tailwind v4 `@theme inline` warm-stone tokens.** No new tokens needed unless `--color-success` is added for the EFFICIENCY card green (planner's call).
- **CLI byte-for-byte unchanged** — `scripts/cli.ts` does not learn atlas-preview.
- **Cross-panel jump-target system (Phase 3 D-72).** AtlasPreviewModal extends the producer set (`'atlas-preview'` joins `'source-animation-chip'`); consumer panels unchanged.
- **File:// image loading** — existing precedent (skeleton + atlas + per-region PNGs all load via file paths in the renderer-side `<img>` and `drawImage` paths). Atlas Preview's pixel rendering reuses this trust boundary.

### Integration Points
- AppShell `<button>Atlas Preview</button>` → click handler → snapshot `summary` + `overrides` → mount `<AtlasPreviewModal {...} onJumpToAttachment={(name) => { setActiveTab('global'); dispatchJumpTarget({ panel: 'global', attachmentName: name, ts: Date.now() }); setAtlasPreviewOpen(false); }} />`. Two-line addition to AppShell + new button render.
- `<AtlasPreviewModal>` internally:
  - On mount + on toggle/pager change: call `buildAtlasPreview(summary, overrides, { mode, maxPageDim })` from either `src/renderer/src/lib/atlas-preview-view.ts` (Layer 3 inline copy if maxrects-packer is browser-safe) OR `await api.computeAtlasPreview(input, opts)` (IPC fallback).
  - Render canvas: lazy-load each unique sourcePath / atlasSource.pagePath via `<img>` (cached); `useEffect` triggers `drawImage` after image load + on projection change.
  - Hover: mousemove handler does linear-scan hit-test against `currentPage.regions[]`; updates hovered region state; canvas re-renders with overlay.
  - Dblclick: same hit-test; calls `onJumpToAttachment(region.attachmentName)`.
  - Close: ESC / X button / click-outside (Phase 4 D-81).

</code_context>

<specifics>
## Specific Ideas

- **User-supplied screenshot is the canonical layout reference.** Header (title + sub-line + close X), left rail (VIEW MODE toggle + caption + ATLAS RESOLUTION toggle + ATLAS PAGE pager + TOTAL ATLASES card + EFFICIENCY card), main view (single canvas with packed regions drawn from actual texture pixels), footer disclaimer ("* Preview assumes 2px padding and no rotation. Actual export engine may vary slightly."). Toggle styling: segmented control with warm-stone accent fill on active option. Cards: dark panel with large numeric + sub-line.
- **The "20% glow override" concrete example** (user-supplied workflow): user opens Atlas Preview → sees a glow texture taking too much space even at the optimized 55% → recognizes it's a screen-blend background effect (visually safe to over-reduce) → double-clicks the rect → modal closes → app focus jumps to the glow's row in Global Max Render Source panel + flashes → user double-clicks peak → enters 20% in OverrideDialog → applies → reopens Atlas Preview → glow rect is visibly smaller; total page count may have dropped. This is the canonical user story for D-130's UX rationale.
- **Per-page efficiency calculation:** `efficiency = sum(region.w × region.h) / (page.width × page.height)` × 100. Sub-line shows `100% - efficiency` as "Empty Space" for visual contrast. Both numbers come from the same `AtlasPage` shape.
- **maxrects-packer "smart" heuristic** (per the package's docs — planner verifies via Context7): adaptive bin sizing that picks the smallest bin that fits all input. For Atlas Preview's fixed page-dim cap, `smart: true` enables incremental bin growth up to the cap before spilling to a new page — better packing than naive next-fit.
- **Atlas-page extraction for Jokerman** (atlas-packed projects): each unique `atlasSource.pagePath` is loaded once via `<img>`, drawn N times via `drawImage(pageImg, atlasSource.x, atlasSource.y, atlasSource.w, atlasSource.h, packedX, packedY, packedW, packedH)` — srcRect crops the region from the page atlas. Browser canvas handles the source-rect crop natively; no custom decoding needed.
- **Default canvas sizing:** main-view canvas styled to fit the modal's right pane via CSS (`max-width: 100%; height: auto`). Internal canvas dimensions = `maxPageDim × window.devicePixelRatio` for retina-crisp rendering. Source dims passed to `drawImage` are unscaled (canvas context handles the scaling).

</specifics>

<deferred>
## Deferred Ideas

- **Atlas re-pack (writing a new `.atlas` file).** REQUIREMENTS.md "Out of scope". User runs Spine's atlas packer post-Optimize Assets. Atlas Preview is preview-only.
- **File-size estimate (F7.2).** De-scoped per D-127. If a future user reports needing it, sample-extrapolation via sharp on N representative regions is the lowest-cost path. Phase 9 polish or its own phase.
- **User-configurable packer params** (rotation, padding, smart heuristic alternatives). Phase 9 polish if requested.
- **Atlas page export.** "Export this preview as a PNG" button. Not requested.
- **Live-reactive override updates while modal is open.** Modal blocks panel interaction (focus-trap); deferred unless workflow changes.
- **More resolution options** (1024 / 8192 / custom). Two discrete options match shipping pipelines.
- **Side-by-side comparison view.** Toggle pattern is the locked layout per user clarification.
- **Auto-open OverrideDialog after dblclick-jump.** Two-gesture workflow chosen for control. Future polish if user requests one-gesture flow.
- **Honor originating tab on dblclick-jump.** Always lands on Global panel (D-129). Animation Breakdown ambiguity makes "wherever I came from" impractical.
- **Drag-to-zoom / pinch-zoom on canvas.** CSS scaling only. Future polish.
- **Region search inside the modal.** SearchBar lives in panels; not duplicated.
- **CLI atlas-preview command.** D-102 byte-for-byte lock.
- **Multi-tab / multi-window atlas previews.** App is single-window for v1.
- **Region-level keyboard navigation** (Tab through canvas regions). Deferred per D-138 — left-rail controls cover keyboard users for primary metrics.
- **`AtlasPreviewProjection` caching across modal sessions.** Snapshot-at-open recomputes on each open. Future polish if perf shows latency.
- **Multi-JSON shared-images preview** (mirrors Phase 6's deferred multi-JSON export). Same architecture extends naturally; defer with Phase 6's deferred item.

</deferred>

---

*Phase: 07-atlas-preview-modal*
*Context gathered: 2026-04-25 via /gsd-discuss-phase 7*
