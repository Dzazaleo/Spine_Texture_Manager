# Changelog

In-repo release history for Spine Texture Manager. Newest on top.
Per-release downloads + first-launch notes are on
[GitHub Releases](https://github.com/Dzazaleo/Spine_Texture_Manager/releases).

## v1.7.1 — Variant Export Sizing Fixes

- **Variant exports respect per-variant render demand.** Sub-1× scale
  variants whose art peaks above the source dimensions are no longer
  clipped to a stale source-size ceiling. The per-variant upper bound
  now tracks `1/scale` of the source so upscaled-region art exports at
  the size it actually renders at. Master-path exports are
  byte-identical to v1.7.0.
- **Reopened variants no longer show phantom green "savings".** The
  Peak column, savings chip, and tooltips now read from a single
  render-demand source of truth, eliminating the misleading
  source-vs-peak base mismatch that surfaced on reopen.
- Minor tooltip polish on the atlas dims-mismatch indicator.

## v1.7 — Multi-Scale Variant Export

- **Export Variant…** — from a single full-size Spine export, produce
  a scaled-down copy of a rig (smaller skeleton JSON + resized textures
  + scaled `.atlas`) in its own `{NAME}@{scale}x/` folder. Source files
  are never modified.
- **Right-sized to actual render demand.** Each variant is sized to
  its smaller rig's own peak render demand — not a naive uniform
  shrink — so textures stay crisp at the smaller size without wasting
  pixels.
- **Batch export.** Queue multiple scales (e.g. `0.5×`, `0.25×`) and
  export them all in one pass with live per-image progress and a
  per-folder success/failure summary; if one variant can't be written
  the rest still export.
- **Two-way sizing.** Set a variant by scale factor *or* by target
  width/height (aspect-locked); type one and the other updates.
- Variant scale rows and output location persist in the `.stmproj`
  project file. Pre-flight overwrite prompt protects existing folders.
- Full dual-runtime, dual-mode coverage: Spine 4.2 **and** 4.3,
  atlas-source **and** atlas-less.

## v1.6 — Spine 4.3 Runtime Port (Dual-Runtime)

- **Spine 4.3 skeleton support (dual-runtime).** The app now loads and
  correctly samples Spine 4.3 skeleton JSON in addition to Spine 4.2,
  routed by the detected skeleton version. A 4.3 file is no longer
  rejected with "re-export as Version 4.2" — it is first-class
  supported.
- Spine 4.2 behavior is byte-frozen (regression-gated); 4.3 sampling
  correctness is independently proven by a same-rig cross-runtime
  equivalence oracle.
- Unsupported versions still fail loudly with a typed error: Spine 4.1
  and earlier, and Spine 4.4 and later, are hard-rejected at load time.
