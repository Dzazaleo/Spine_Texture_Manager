---
slug: atlas-preview-clipping-edges
status: resolved
trigger: 2026-05-05 — user-reported visual clipping in Atlas Preview modal
created: 2026-05-05
updated: 2026-05-05
---

# Debug Session: atlas-preview-clipping-edges

## Trigger

<!-- DATA_START: user-supplied trigger description -->
The atlas preview is clipping some images. For example the hat (JOKER/HAT_FRONT, 768×486 per tooltip) is clipped at the top of the canvas, and the yellow image at its left (large yellow neon square outline, bottom-left area) is a square but renders as a rectangle. The problem seems to happen at the canvas edges only, but the user is not 100% sure.
<!-- DATA_END -->

## Symptoms

- **Expected**: Atlas preview should render every region inside the 2048×2048 page bounds without truncation, preserving each region's source aspect ratio.
- **Actual** (from screenshot, Page 2/4 in Optimized view at 2048px atlas resolution):
  1. JOKER/HAT_FRONT (768×486 per hover tooltip) appears clipped along the top edge of the canvas — the upper portion of the hat is cut off.
  2. A yellow neon-bordered square in the bottom-left quadrant is rendering as a tall rectangle (visibly non-square), even though the user expects a square asset.
  3. Bottom-row regions (smudge particle thumbnails) also appear truncated near the bottom edge.
- **Error messages**: None reported. Pure visual rendering bug.
- **Timeline**: Surfaced after recent atlas-preview hover-tooltip work — commits 125fb4a (floating cursor tooltip) and 3d5d51c (centered hover label) — both touching `src/core/atlas-preview.ts` + `src/renderer/src/lib/atlas-preview-view.ts`.
- **Reproduction**: Open the Atlas Preview modal in Optimized view, page through to Page 2/4. Compare on-canvas region rectangles to their declared dimensions.

## View Mode Context

- View Mode: **Optimized** (showing calculated max render sizes)
- Atlas Resolution: **2048px**
- Page **2 / 4**, efficiency 87.7%, 12.3% empty space
- 4 atlas pages, 77 regions, 85.8% utilization overall

## Initial Hypotheses (untested)

1. **Off-by-one or float-truncation in the page→canvas mapping** in `src/core/atlas-preview.ts` packing or layout — regions whose pack position + size exceed the page bounds are silently clipped at the canvas edge instead of being correctly positioned/sized.
2. **Aspect-ratio drift** in the renderer at `src/renderer/src/lib/atlas-preview-view.ts` — the yellow-square-→-rectangle distortion suggests width and height are being scaled by different factors (anisotropic scale) for at least some regions.
3. **Recent hover-tooltip commits introduced a layout offset** — 125fb4a or 3d5d51c may have changed canvas dimensions, viewBox, or transform that shifts the entire content up/left, producing clipping at top + bottom edges and possibly stretching certain regions.
4. **Optimized-view pack uses canonical (json) dims while renderer uses source (atlas page) dims** (or vice-versa) — this would explain why some regions look correct and others (specifically those at edges with mismatched canonical vs source dims) look distorted/clipped.

## Current Focus

```yaml
hypothesis: CONFIRMED — AtlasCanvas CSS layout bug.
test: Analyzed AtlasPreviewModal.tsx canvas container CSS.
expecting: w-full on aspect-[1/1] container prevents height-constraint from reducing width.
next_action: RESOLVED — fix applied.
reasoning_checkpoint: null
tdd_checkpoint: null
```

## Evidence

- timestamp: 2026-05-05T00:00:00Z
  finding: >
    AtlasPreviewModal.tsx line 626: `<div className="aspect-[1/1] w-full max-w-full max-h-full">`.
    `w-full` (width: 100%) is explicit. CSS aspect-ratio + max-height clamping does NOT reduce
    an explicit width — height is clamped to 100% of parent but width stays at 100% of parent.
    Result: when available height < available width, the CSS canvas element is non-square
    (wider than tall), causing the 2048×2048 backing store to be displayed with anisotropic
    scale. Squares in canvas coords appear as rectangles in display.
  source: src/renderer/src/modals/AtlasPreviewModal.tsx:626

- timestamp: 2026-05-05T00:00:00Z
  finding: >
    The outer container `w-full h-full flex items-center justify-center` centers the inner
    div. When `w-full` forces the aspect-ratio square to be wider than the available height,
    the square overflows vertically. The parent `flex-1 overflow-hidden` clips the overflow.
    `items-center` centers the overflow equally top and bottom — producing clipping at BOTH
    top AND bottom edges. This explains HAT_FRONT clipped at top + smudge thumbnails clipped
    at bottom.
  source: src/renderer/src/modals/AtlasPreviewModal.tsx:624-644

## Eliminated

- Hypothesis 1 (pack logic float-truncation): Eliminated. The packer is bounded at maxPageDim.
  No pack-coordinate arithmetic produces out-of-bounds rects.
- Hypothesis 4 (canonical vs source dim mismatch in pack): Eliminated. The drawImage source
  crop uses atlasSource dims correctly. The distortion is purely CSS layout.
- Recent tooltip commits (3d5d51c, 125fb4a) as direct cause: Eliminated as primary cause.
  The tooltip commits touched canvas DRAWING code, not the container layout. The layout bug
  may have pre-existed; the screenshot was taken after those commits but the layout was not
  changed by them.

## Resolution

- **root_cause**: `AtlasPreviewModal.tsx` line 626 used `aspect-[1/1] w-full max-w-full max-h-full`
  on the canvas sizing container. `width: 100%` is explicit and CSS does not reduce an explicit
  width when `max-height` clamps the height to maintain aspect ratio. Result: when available
  height < available width, the CSS canvas element is non-square (wider than tall) →
  anisotropic display of the square backing store → squares rendered as rectangles + top/bottom
  content clipped by `overflow-hidden` on the parent flex container.

- **fix**: Changed `w-full` to `h-full` on line 626 of `AtlasPreviewModal.tsx`. With
  `aspect-[1/1] h-full max-w-full max-h-full`, the element is height-driven: it fills the
  available height, then `aspect-ratio: 1/1` derives width = height, and `max-w-full` prevents
  exceeding the available width. This always produces the largest square that fits within the
  available rectangular space — no overflow, no clipping, no aspect-ratio distortion.

- **files_changed**:
  - `src/renderer/src/modals/AtlasPreviewModal.tsx` line 626: `w-full` → `h-full`
