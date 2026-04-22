# Requirements

## Functional requirements

### F1 — Skeleton loading
- F1.1 Load a Spine 4.2+ skeleton JSON via `spine-core` `SkeletonJson.readSkeletonData`.
- F1.2 Auto-detect companion assets next to the JSON: `.atlas` file and/or an `images/` folder.
- F1.3 Use a stub `TextureLoader` so PNG decoding is not required for the math phase.
- F1.4 Surface a clear error when neither atlas nor images folder is available.
- F1.5 Future: support Spine 4.3+ via versioned loader adapters.

### F2 — Per-attachment peak render-scale computation
- F2.1 For each `(attachment, skin)` pair, compute the peak world-space AABB across all animations at a configurable sampling rate (default 120 Hz).
- F2.2 When an attachment has no animation timeline touching it, report its setup-pose peak instead.
- F2.3 Support `RegionAttachment` (4 world vertices) and `MeshAttachment`/`VertexAttachment` (N world vertices, including weighted meshes).
- F2.4 Correctly reflect all of the following in peak scale (verified to be handled by `computeWorldVertices` after `updateWorldTransform(Physics.update)`): bone-chain scale, slot scale, weighted-mesh bone influences, IK constraints, TransformConstraints, PathConstraints, Physics constraints (4.2), DeformTimeline offsets.
- F2.5 Report `scaleX`, `scaleY`, and `scale = max(scaleX, scaleY)` separately.
- F2.6 Record source animation name, source frame/time, and source skin for every peak.
- F2.7 Resolve each attachment's source (canonical) dimensions via: (a) `.atlas` region `orig` size, (b) PNG metadata via sharp, (c) fallback to `RegionAttachment.width/height`. Warn on cross-source mismatch.

### F3 — Global Max Render Source panel (screenshot 1)
- F3.1 Sortable table: Asset, Original Size, Max Render Size, Scale, Source Animation/SetupPose, Frame.
- F3.2 Search field filters rows by attachment name.
- F3.3 Per-row checkbox for batch operations.

### F4 — Animation Breakdown panel (screenshot 3)
- F4.1 Collapsible per-animation cards, each showing unique asset count (or "No assets referenced").
- F4.2 "Setup Pose (Default)" shown as its own top card.
- F4.3 Per-row Bone Path shown, plus `source → scale → peak → frame`.
- F4.4 Per-row "Override Scale" button opens the override dialog.

### F5 — Scale overrides
- F5.1 Double-click any peak scale → dialog accepting a percentage (100% = peak itself).
- F5.2 `< 100%` shrinks, `> 100%` upscales but is clamped at source max (never beyond canonical dimensions).
- F5.3 Overrides visually badged on affected rows across all panels.
- F5.4 Overrides persist in saved project state.

### F6 — Unused attachment detection
- F6.1 Flag attachments defined in skins that are never rendered (active slot with non-zero alpha) in any animation in any skin.
- F6.2 Surface as its own panel section.

### F7 — Atlas Preview modal
- F7.1 Before/after side-by-side atlas visualization using a packer (e.g., `maxrects-packer`).
- F7.2 Show dimensions and estimated file-size delta.

### F8 — Optimize Assets (image export)
- F8.1 Export button opens a folder picker.
- F8.2 For each attachment, `sharp.resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })` and write to `<out>/images/<path>.png`.
- F8.3 Preserve directory structure of the source `images/` layout.
- F8.4 Never modify original source files.
- F8.5 Progress UI with per-file error surfacing.

### F9 — Save/Load project state
- F9.1 Session JSON contains: skeleton path, atlas/images root, overrides, settings (sampling rate).
- F9.2 Load restores overrides and settings; recomputes peaks.

## Non-functional requirements

### N1 — Correctness
- N1.1 Every `core/` function has golden unit tests driven by `fixtures/SIMPLE_PROJECT/`.
- N1.2 Simple leaf-bone attachment: peak matches hand-computed `source × scale`.
- N1.3 Bone-chain attachment: peak matches `source × product(chain scales) × slot scale`.
- N1.4 Weighted-mesh attachment: peak matches weighted-sum formula.
- N1.5 TransformConstraint-driven bone: peak reflects the constraint automatically.
- N1.6 PhysicsConstraint: deterministic peak across repeated sampler runs (given `Physics.reset` at start).

### N2 — Performance
- N2.1 Simple rig samples in < 500 ms.
- N2.2 Complex rig (~80 attachments, ~16 animations) samples in < 10 s on the main thread; move to worker if slower.
- N2.3 Sampler hot loop does zero filesystem I/O (stub TextureLoader). _Foundations laid in plan 00-01 (vitest installed, no `fs` transitive dep forced into `core/`); sampler + enforcement test land in plans 00-04 and 00-05._

### N3 — Quality preservation
- N3.1 Optimize Assets uses Lanczos3 resampling, PNG compression level 9, alpha preserved.
- N3.2 Output files must be visually indistinguishable from Photoshop-Lanczos output at the same target dims.

### N4 — Portability
- N4.1 Ships as signed `.dmg` (macOS) and `.exe` (Windows) at minimum.
- N4.2 No native compilation required for end users beyond what Electron + sharp bundles provide.

## Out of scope (initial milestone)

- Spine binary (`.skel`) loading — JSON only for v1. (SkeletonBinary can be added in a later milestone if requested.)
- Editing the skeleton or atlas in place (we only produce a new `images/` folder).
- Re-packing the atlas into a new `.atlas` file (we only resize the images; the user re-runs Spine's atlas pack on the new images).
- Multi-skin combined-skin compositing (we sample per-individual-skin in v1).

## Assumptions

- Atlas file, if provided, is plain text (not binary); Spine's current default.
- Source images are PNG with alpha. Other formats are a later-milestone concern.
- User can run Spine's own atlas packer after "Optimize Assets" to re-pack the new images.
