---
status: partial
phase: 07-atlas-preview-modal
source: [07-05-SUMMARY.md, manual UAT 2026-04-25]
started: 2026-04-25T20:05:00Z
updated: 2026-04-25T20:15:00Z
---

## Current Test

[paused — gaps documented, awaiting `/gsd-plan-phase 7 --gaps` to scope fix plan]

## Tests

### 1. Toolbar button placement + disabled-on-empty (D-134)
expected: Atlas Preview button left of Optimize Assets, both disabled on empty DropZone, both enable after drop.
result: passed

### 2. Default open state (D-135 + D-128)
expected: Optimized + 2048px + page 1/1, TOTAL ATLASES = 1, EFFICIENCY non-zero, exact footer text.
result: passed

### 3. Canvas renders actual region pixels (F7.1)
expected: CIRCLE / SQUARE / TRIANGLE shapes visible inside region rects (drawImage of `app-image://` URL onto canvas).
result: failed
actual: Region rects are drawn but contain NO image pixels — only solid fill. One rect appears stretched (aspect ratio mismatch — possibly the projection scaling is off).

### 4. Hover-reveal (D-129)
expected: warm-stone fill overlay + attachment name AND dimensions on hover; cleared on mouse-out.
result: failed
actual: Hover shows only the attachment name. Dimensions (W×H) are missing from the hover label.

### 5. Toggles re-render (F7.1 / F7.2)
expected: Original makes regions visibly larger; 4096px drops EFFICIENCY (page area doubled).
result: passed

### 6. Pager bounds-disable (D-128)
expected: `<` and `>` both disabled with single-page fixture.
result: skipped (untested — user paused after Gate 4)

### 7. Dblclick-jump → 20% glow override workflow (D-130)
expected: dblclick TRIANGLE region → modal closes → Global tab + row scroll + flash → set override 50% → re-open modal → TRIANGLE smaller.
result: blocked
actual: Cannot test — depends on Gate 3 (clickable image rects must render first).

### 8. Snapshot-at-open semantics (D-131)
expected: close modal, change override, re-open, values updated.
result: skipped (untested)

### 9. Missing-source UX (D-137)
expected: rename `CIRCLE.png` to `.bak` → muted bg + ⚠ glyph in terracotta.
result: skipped (untested — depends on Gate 3 baseline working)

### 10. No regressions in earlier phase paths
expected: Source Animation jump, OverrideDialog, OptimizeDialog, batch select/sort/search, breakdown cards still work.
result: skipped (untested)

## Summary

total: 10
passed: 3
failed: 2
blocked: 1
pending: 4
skipped: 0

## Gaps

### Gap 1 — Canvas region pixels do not render (Gate 3, F7.1)
severity: blocking
root_cause: hypothesis — `app-image://` protocol handler (Plan 07-03) registers the scheme, but either:
  - (a) the renderer is not constructing valid `app-image:///abs/path/region.png` URLs, OR
  - (b) `<img>.onload` never fires (CSP blocks the actual fetch), OR
  - (c) `drawImage(<img>, sx, sy, sw, sh, dx, dy, dw, dh)` source-rect args are wrong (e.g. atlas-page-coords mistaken for image-coords).
investigate:
  - Open DevTools → Console for any `Refused to load image` CSP errors.
  - Open DevTools → Network panel; check if `app-image://...` requests fire and what status they return.
  - Console-log the full URL passed to `<img>.src` from inside `AtlasPreviewModal` to verify path correctness.
  - Verify the source rect (sx/sy/sw/sh) being passed to `drawImage` matches the source PNG's region within its atlas page, not the canonical preview projection.

### Gap 2 — Region rects appear stretched / wrong aspect ratio (Gate 3, F7.1)
severity: blocking (likely same root cause as Gap 1, or related)
root_cause: hypothesis — projection scale may apply different X/Y factors to the rect dimensions before draw, OR the canvas backing-store is not square (2048×2048) but the parent flex container is non-square.
investigate:
  - Verify `<canvas width=2048 height=2048>` is explicitly set on the element (not just CSS-sized).
  - Verify the projection emits square page coords (CONTEXT D-135 says 2048×2048).

### Gap 3 — Hover label missing dimensions (Gate 4, D-129)
severity: minor (single-string addition)
root_cause: hover overlay renders attachment name only; no `W × H` line.
fix: in the hover overlay JSX inside `src/renderer/src/modals/AtlasPreviewModal.tsx`, append a second line with the region's projected width × height (in pixels, rounded). Source comes from the projection's `PackedRegion.w/h`.

### Gap 4 — Modal needs to fit viewport (auto-scale) — out of original scope but blocking visual UX
severity: design-issue
root_cause: at small window sizes the canvas (2048×2048 backing-store rendered at 1:1 CSS px) overflows the modal, producing an internal scrollbar. The atlas preview is informational only — its display size should track the available viewport, not the atlas backing-store.
investigate / decide:
  - Is this a Phase 7 D-decision that needs to be added (e.g., D-138: "modal canvas display-size auto-fits the modal content area; backing-store stays at atlas page resolution for crisp drawImage; aspect ratio preserved")?
  - Or is this acceptable for the current scope and revisited later?
  - User's intent (from feedback): scrollbar is wrong; the canvas should auto-scale.
fix-direction (if accepted):
  - Keep `<canvas width=pageDim height=pageDim>` (backing-store) for `drawImage` fidelity.
  - Wrap canvas in a flex/aspect-ratio container that sizes to `min(available-modal-content-width, available-modal-content-height)` while preserving 1:1 aspect.
  - Apply `style={{ width: '100%', height: '100%', objectFit: 'contain' }}` (or equivalent CSS) so the canvas DOM size shrinks to fit.

### Gap 5 — Gates 6, 7, 8, 9, 10 not yet verified
severity: tracking
note: Gate 7 is blocked by Gap 1. Gates 6, 8, 9, 10 were not reached. After Gaps 1–4 are closed, re-run UAT from Gate 6 onward.
