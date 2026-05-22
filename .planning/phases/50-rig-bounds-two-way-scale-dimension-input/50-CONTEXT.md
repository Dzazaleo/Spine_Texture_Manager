# Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the animator an intuitive way to choose a variant scale: anchor it to the rig's
overall **setup-pose bounding box** (W×H in px) and let them enter **either** a scale
factor **or** a target pixel dimension and see the other (two-way binding). This is a
pure **enrichment of the existing basic scale field** in `VariantDialog.tsx` (Phase 49
D-05) — it does not change the export engine, the bake, the sizing math, or the package
layout. Requirements: SCALEUI-01, SCALEUI-02.

**In scope:**
- Compute the rig's overall setup-pose bounding box (W×H px), dual-runtime (4.2 + 4.3),
  ourselves via the runtime adapter.
- Replace the basic numeric scale field with a two-way **factor ↔ target-pixel** control
  (both W and H editable, aspect-locked), wired to the existing single-scale variant
  export path.
- Surface the bbox W×H as the on-screen reference next to the control.

**Out of scope (later phases / locked elsewhere — do NOT build here):**
- Batch fan-out (N scales → N folders) and the `Scale | Output | Batch` tab structure —
  Phase 51.
- Any change to the export engine / bake / `buildExportPlan` / atlas-writer / package
  layout / folder naming — shipped in Phase 49 and reused unchanged.
- Anisotropic (per-axis) scaling — LOCKED uniform-only ([[project_phase6_default_scaling]]);
  this phase only chooses which *dimension* anchors the (still uniform) factor.
- Upscaling (`s ≥ 1`) as a user feature — the export edge rejects it (Phase 49 D-08).
- A per-skin chooser / skin dropdown for the bounds reference — possible future enrichment.

</domain>

<decisions>
## Implementation Decisions

### Two-Way Scale↔Dimension Input (SCALEUI-01)
- **D-01:** **Both W and H are editable, plus the factor — aspect-locked.** The control
  exposes three coupled inputs: scale factor, target width (px), target height (px).
  Editing any one re-derives the other two. Scaling stays **uniform** — this only chooses
  which dimension the user anchors against, never anisotropic scaling. ("Longest-edge
  only" and "width-only" were rejected — both-editable subsumes them and covers "fit to
  N wide" and "fit to N tall" directly.)
- **D-02:** **The scale factor `s` is the single source of truth** (it is what the
  export/bake consumes). The W/H pixel fields are *views* of `s` (`px = s × bboxAxis`).
  The **last-edited field sets `s`**, then all fields re-derive from `s` — aspect-locked,
  with **no round-trip drift** on the edited axis.
- **D-03:** **Typed pixel targets are honored EXACTLY** — typing a target W (or H) sets
  `s = px ÷ bboxAxis` and that exact `s` is what exports. We do **NOT** snap to "nice"
  round factors (rejected — silently changing the user's typed number feels broken; tidy
  folder tokens are cosmetic and Phase 49 already renders arbitrary factors like `@0.26x`).
  **Display precision:** factor shown rounded to **4 decimals** (`Number(s.toFixed(4))` —
  byte-identical to the existing `@0.xxxx` folder-token normalization in
  `variant-export.ts` `formatScaleToken` / the inline copy at `VariantDialog.tsx:267`);
  pixels shown as **whole numbers** (round for display).
- **D-04:** **Over-range (upscale) guard.** If a typed W or H ≥ its bbox dimension
  (i.e. `s ≥ 1`), **allow the entry**, recompute the (≥1) factor for display, but
  **disable Export** and show the existing inline "variants are scaled-down" hint.
  This reuses the Phase 49 D-08 cheap renderer pre-check; the **authoritative** reject
  remains the main-side `VariantScaleError` guard. (Hard-clamping mid-edit was rejected —
  it fights the user's typing.)

### Rig-Bounds Reference (SCALEUI-02)
- **D-05:** **We COMPUTE the bbox ourselves via the runtime — we do NOT read the JSON
  `skeleton.width/height` header.** Rationale: those fields are **nonessential export
  data** (only present when "Nonessential data" is checked — same class as `fps`, which
  CLAUDE.md #1 already tells us to ignore), are the **editor's setup-pose-*visible*
  subset** (re-introduces the eyes-only failure below), and **inherit broken-rig
  pathologies** (all three DEMON variants report the same `218 × 400` at `x:1961,y:-4062`
  — editor coordinate space [[project_root_vs_parent_scale_world_constraint_miscalibration]]).
  Same principle as CLAUDE.md #1/#2: editor metadata is untrusted; measure geometry from
  the runtime.
- **D-06:** **Method = ALL-SKINS MANIFEST UNION at setup-pose bone transforms.** For every
  skin-declared attachment (iterate **every** skin's manifest, not just the setup-pose
  slot bindings), measure its world-AABB at the setup-pose bone transform and union them;
  report `{w, h}`. This is the **faithful reading of "overall setup-pose bounding box"** =
  the whole rig at rest, and is **robust to both the all-hidden setup pose AND the
  partially-hidden (e.g. "setup shows only the eyes, body revealed in animation") case** —
  which the default-skin-only / default-skin-with-empty-fallback approaches both get
  wrong (a non-empty eyes-only setup would show a tiny, confidently-wrong number).
  Reuses the sampler's **Pass 1.5 primitives** (`rt.skinEntries(skin)` +
  `attachmentWorldAABB(rt, sk, slot, att)`), which measure any attachment **without
  mutating slot bindings** ([[project_sampler_visibility_invariant]]).
  *Accepted tradeoff:* a rig with dramatically different-sized alternate skins shows the
  **largest** envelope across skins — acceptable (it's a factor-picking anchor, never
  export-affecting; the peak sampler sizes each texture independently).
- **D-07:** **Dual-runtime (4.2 + 4.3) via the `load.runtime` adapter** —
  `makeSkeleton` → `setupPoseSlots` → `setupPose` → `updateWorldTransform('pose')` →
  union. **NEVER** a hardcoded `Skeleton` ctor (the REG-47-01 cross-runtime landmine —
  [[project_reg4701_buildsummary_cross_runtime_fixed]], [[project_shared_42base_subclass_43_dualruntime_hazard]]).
  Proven feasible: the Phase 49 oracle's `aggregateWorldAABB`
  (`tests/main/variant-dropin-faithful.spec.ts:144-180`) already computes the dual-runtime
  setup-pose AABB version-agnostically — this phase **generalizes that helper** (slot-
  bindings → manifest union) into a reusable, Layer-3-pure `core/` function.
- **D-08:** **Editor `skeleton.width/height` kept ONLY as a researcher/test cross-check
  oracle** where present — expect close agreement with our computed value on a *normal*
  rig (e.g. `fixtures/SIMPLE_PROJECT_43/skeleton2.json` reports `1399.308 × 2146.156`).
  Useful as a sanity assertion, never as the source.

### Dialog Layout
- **D-09:** **Enrich the Scale card INLINE in the existing single-pane `VariantDialog`.**
  Replace the basic numeric field (`VariantDialog.tsx:299-331`) with the bbox-reference
  line + the factor/W/H two-way control, in place. **Defer the `Scale | Output | Batch`
  tabs to Phase 51** (introduced alongside Batch as one coherent change). The added
  content (one bbox line + two px fields) does not yet justify tab chrome; a single pane
  shows size + output + quality at a glance for a one-shot export. Pure in-place
  enrichment, **no structural refactor** — honors Phase 49 D-05 ("enrich the SAME control
  in place") and D-06 ("tabs land when content justifies").

### Claude's Discretion
- **Where the bbox computation physically lives & how it reaches the renderer.** The
  computation is a Layer-3-pure `core/` function (no DOM/sharp — `tests/arch.spec.ts`).
  The renderer (Layer-3) **cannot** call `core/`/runtime directly, so the `{w, h}` must be
  surfaced to it. *Recommended seam:* compute **once at summary-build time**
  (`src/main/summary.ts`, via `load.runtime`) and attach `{w, h}` to `SkeletonSummary`
  (already passed into `VariantDialog`) — avoids a per-keystroke IPC round-trip and
  re-uses the existing summary handoff. (A dedicated IPC is the alternative.) Researcher/
  planner pick the cleanest.
- **Exact field layout / copy / widths** of the enriched Scale card — match the existing
  `OptimizeDialog`/`VariantDialog` Tailwind literal-class idiom (Pitfall 8: literal class
  strings only).
- **Live-update cadence** (onChange vs onBlur) for the coupled fields; tolerate
  intermediate states while typing.
- **Number-format helpers** — reuse the inline `toFixed(4)` normalization already in
  `VariantDialog.tsx:267` rather than importing the Node-only `formatScaleToken`.
- Whether to expose the bbox origin (x/y) — **not required**; only `{w, h}` is needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 50 requirements & roadmap
- `.planning/REQUIREMENTS.md` — **SCALEUI-01** (line 43, two-way factor↔px), **SCALEUI-02**
  (line 44, setup-pose bbox reference); Traceability rows 78-79 (both → Phase 50).
- `.planning/ROADMAP.md` §"Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input" — goal,
  depends-on (Phase 49), SC#1 (two-way binding) + SC#2 (setup-pose bbox dual-runtime), the
  2 TBD plan stubs (50-01 bbox compute, 50-02 two-way control), "UI hint: yes", and the
  note that the two-way UX (per-axis vs longest-edge, rounding/lock) was the open discuss
  decision (now resolved here).

### Phase 49 carry-forwards (the control + dialog this enriches)
- `.planning/phases/49-single-scale-variant-export/49-CONTEXT.md` — **D-05** (Phase 50
  enriches the SAME control in place; don't over-build), **D-06** (single-pane tab-ready;
  tabs at 50/51 when content justifies), **D-08** (export edge rejects `s ≥ 1`),
  L-01..L-05 locked carry-forwards.
- `src/renderer/src/modals/VariantDialog.tsx` — the dialog to enrich; the **basic scale
  field at `:299-331`** is what D-09 replaces; the inline 4-decimal scale-token
  normalization at `:267`; `SkeletonSummary` already arrives as `props.summary`.

### The bbox computation primitives to reuse (dual-runtime, Layer-3-pure)
- `tests/main/variant-dropin-faithful.spec.ts:144-180` — `aggregateWorldAABB(load)`: the
  **proven dual-runtime setup-pose AABB** (makeSkeleton → setupPoseSlots → setupPose →
  updateWorldTransform('pose') → union of `attachmentWorldAABB`). D-06 generalizes this
  from slot-bindings to the all-skins manifest union.
- `src/core/sampler.ts:188-267` — **Pass 1.5 (per-skin manifest pass):** `rt.skinEntries(skin)`
  + `attachmentWorldAABB` measure every skin-declared attachment **without mutating the
  skeleton** — the exact pattern the manifest-union bbox reuses.
- `src/core/bounds.ts:54-84` — `attachmentWorldAABB(rt, sk, slot, a)`: per-attachment world
  AABB (returns `null` for skip-list path/bbox/point/clipping). Pure, zero-I/O.
- `src/core/runtime/runtime.ts` (+ `runtime-42.ts` / `runtime-43.ts`) — the `SpineRuntime`
  facade: `makeSkeleton`, `setupPose`, `setupPoseSlots`, `updateWorldTransform`, `slots`,
  `slotAttachment`, `skinEntries`, `skinName`, `slotName`, `attachmentKind`,
  `regionWorldVertices`, `vertexWorldVertices`. All bbox math goes through this adapter.

### Where to surface the bbox + the IPC/summary seam
- `src/shared/types.ts:756+` — `SkeletonSummary` (passed into `VariantDialog`); the
  recommended carrier for the computed `{w, h}`.
- `src/main/summary.ts` — where `SkeletonSummary` is built from `load`; the recommended
  place to compute the bbox once via `load.runtime.makeSkeleton` (REG-47-01-safe handoff).
- `src/main/variant-export.ts` — `formatScaleToken` (the canonical 4-decimal `@s x` token);
  the export edge + `VariantScaleError` (D-04's authoritative gate).

### Architecture / purity
- `tests/arch.spec.ts` — Layer-3 purity gate. The bbox function lives in `core/` (pure, no
  DOM/Electron/sharp). The renderer reads the precomputed `{w, h}`; it must NOT import
  `core/`.

### Memory landmines to honor
- [[project_sampler_visibility_invariant]] — the manifest pass (Pass 1.5) is the correct
  primitive; visibility (slot=null / alpha 0) is runtime-mutable; measure ALL skin-declared
  attachments. Don't re-derive — reuse.
- [[project_reg4701_buildsummary_cross_runtime_fixed]] / [[project_shared_42base_subclass_43_dualruntime_hazard]]
  — materialize skeletons ONLY via `load.runtime.makeSkeleton`; never a hardcoded 4.2
  `Skeleton` ctor (silent 4.3 `reading 'r'` / signature-divergence failures).
- [[project_phase6_default_scaling]] — scaling is uniform-only; the two-way input never
  implies anisotropic scaling.
- [[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]] — if the bbox path
  routes through the runtime facade, verify it resolves under every entrypoint
  (vitest/built worker/`npm run cli`).
- [[feedback_verify_whole_ci_surface_locally]] / [[feedback_release_yml_diverges_from_ci_yml]]
  — local green ≠ CI green; release.yml is a separate gate.
- [[feedback_new_committed_fixtures_need_safe01_denylist]] — if any NEW fixture dir is
  committed for bbox tests, co-extend `SAFE01_EXCLUDED_PREFIXES` (no new golden) and prove
  it git-tracked.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`aggregateWorldAABB`** (`tests/main/variant-dropin-faithful.spec.ts:144-180`) — the
  proven dual-runtime setup-pose AABB; generalize (slot-bindings → manifest union) into a
  reusable `core/` function.
- **Sampler Pass 1.5** (`sampler.ts:188-267`) — `rt.skinEntries` + `attachmentWorldAABB`
  measure every skin-declared attachment without skeleton mutation: the manifest-union
  pattern, ready to lift.
- **`attachmentWorldAABB`** (`bounds.ts:54-84`) — the per-attachment AABB workhorse.
- **`VariantDialog` Scale card** (`VariantDialog.tsx:299-331`) — the field to enrich in
  place; the dialog already receives `SkeletonSummary`, `scale`, `onScaleChange`.
- **`SkeletonSummary`** (`shared/types.ts`) — already crosses to the renderer; the carrier
  for the precomputed `{w, h}`.

### Established Patterns
- **Layer-3 purity** (`tests/arch.spec.ts`) — bbox math in `core/` (pure); renderer reads
  the precomputed number; renderer never imports `core/`.
- **Runtime adapter for ALL spine API** — dual-runtime via `load.runtime`; never a raw
  spine-core ctor.
- **Single source of truth + derived views** — the existing scale field is the seam; the
  enriched control keeps `s` canonical and derives px (D-02).
- **4-decimal scale normalization** — `Number(s.toFixed(4))` (`VariantDialog.tsx:267` /
  `variant-export.ts` `formatScaleToken`).

### Integration Points
- `summary.ts` (compute `{w, h}` once via `load.runtime`) → `SkeletonSummary.{w,h}` → IPC →
  `VariantDialog` reads it as the bbox reference → the two-way control maps `s ↔ W/H` →
  `onScaleChange(s)` → existing Phase 49 `window.api.exportVariant(summary, s, …)` path
  (unchanged).

</code_context>

<specifics>
## Specific Ideas

- **"How big is my rig?" → answer with the whole rig at rest.** The displayed W×H is the
  whole-rig setup-pose envelope (all skins), not the setup-pose-visible subset — chosen
  specifically so a rig that "shows only the eyes" in setup pose still reports its true
  full-body size.
- **"What you type is what you get."** Typed pixel targets are honored exactly; the factor
  is just a readout. The two-way input exists so the animator can think in pixels
  ("fit to 512 for the mobile atlas").
- **Cross-check oracle.** On a normal rig our computed bbox should land close to Spine's
  editor `skeleton.width/height` (e.g. `skeleton2.json` 1399×2146) — a clean validation
  assertion for the researcher.

### Research flags (for the phase researcher — not user decisions)
- Confirm the cleanest seam to surface `{w, h}` to the Layer-3 renderer (compute in
  `summary.ts` onto `SkeletonSummary` vs a dedicated IPC) — recommended: compute once at
  summary-build time, cache on the summary (no per-keystroke recompute).
- Verify the manifest-union computation resolves dual-runtime (4.2 + 4.3) and across every
  entrypoint that builds a summary (vitest / built worker / `npm run cli`).
- Decide degenerate handling: a rig with **zero** textured attachments in any skin (only
  bbox/path/point/clipping) → no measurable bbox; surface a graceful "no setup-pose
  geometry" state (factor-only input still works).
- Cross-check our computed bbox vs editor `skeleton.width/height` on fixtures where present.

</specifics>

<deferred>
## Deferred Ideas

- **`Scale | Output | Batch` tabbed dialog** — Phase 51, introduced alongside Batch as one
  coherent change (D-09).
- **Batch (N scales → N folders)** — Phase 51.
- **Per-skin chooser / skin dropdown** for the bounds reference (size against a specific
  skin instead of the all-skins envelope) — possible future enrichment; not needed now.
- **Anisotropic / per-axis scaling** — out (uniform-only LOCKED).
- **Upscaling (`s ≥ 1`) as a user feature** — out of v1.7 scope (export edge rejects it).
- **Showing the bbox origin (x/y) / a live "what-if" texture-size preview** — Future
  Requirements.

None of the discussion strayed outside the phase domain — no scope creep to redirect.

</deferred>

---

*Phase: 50-rig-bounds-two-way-scale-dimension-input*
*Context gathered: 2026-05-22*
