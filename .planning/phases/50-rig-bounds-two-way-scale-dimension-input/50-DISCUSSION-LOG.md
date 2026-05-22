# Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 50-rig-bounds-two-way-scale-dimension-input
**Areas discussed:** Dimension axis model, Rig-bounds skin scope, Rounding & lock behavior, Tabs vs enrich inline

---

## Dimension axis model

| Option | Description | Selected |
|--------|-------------|----------|
| Both W & H editable | bbox W and H both editable + factor; edit any one, the other two follow (aspect-locked) | ✓ |
| Longest edge only | factor + single "longest edge" target px; WxH read-only | |
| Width-only | factor + target width px; height read-only | |

**User's choice:** Both W & H editable
**Notes:** Scaling stays uniform — this only chooses which dimension anchors the factor. Both-editable subsumes longest-edge/width-only and covers "fit to N wide" and "fit to N tall" directly.

**Follow-up (over-range / upscale behavior):**

| Option | Description | Selected |
|--------|-------------|----------|
| Allow + disable Export + hint | let them type a value ≥ bbox, recompute the ≥1 factor, disable Export + inline "variants are scaled-down" hint (matches existing D-08 pre-check) | ✓ |
| Hard-clamp to just-under-1 | silently clamp to largest valid down-scale; field fights typing | |
| You decide | Claude picks | |

**User's choice:** Allow + disable Export + hint

---

## Rig-bounds skin scope

| Option | Description | Selected |
|--------|-------------|----------|
| Default skin (what you see) | union each slot's setup-pose-bound attachment (what aggregateWorldAABB does today) | |
| Union across ALL skins | iterate every skin manifest, union every declared attachment at setup-pose transform | ✓ |
| Active/selected skin | anchor to the currently-selected skin | |

**User's choice:** Always all-skins manifest union (computed ourselves, NOT read from JSON)
**Notes:** Long discussion. Key turning points:
- User raised: what if every attachment is invisible in setup pose, visible only in animation? → default-skin returns empty.
- User raised the decisive case: a full-body rig whose setup pose shows ONLY the eyes → default-skin (even with an empty-fallback) shows a tiny, confidently-wrong number, because the setup pose is non-empty. Only the all-skins manifest union (which measures every skin-declared attachment, including animation-only ones) reports the true full-body size.
- User then noticed the JSON `skeleton.width/height` header and asked whether we even need to compute it. Concluded NO: those fields are nonessential (often absent), are the editor's setup-pose-visible subset (eyes-only trap), and inherit broken-rig pathologies (DEMON variants all report 218×400 in miscalibrated editor space). We compute ourselves from the runtime — same principle as ignoring `fps`. Editor field kept only as a test cross-check.
- Feasibility verified live: sampler Pass 1.5 already does the manifest union dual-runtime (`rt.skinEntries` + `attachmentWorldAABB`, no skeleton mutation).

---

## Rounding & lock behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Honor the typed pixels | use exact factor s = px/bbox; factor is a 4-decimal readout; folder uses the real factor | ✓ |
| Snap to round factor | snap to nearest tidy factor (0.05 steps); pixels shift to match | |

**User's choice:** Honor the typed pixels (after asking for a recommendation)
**Notes:** Model locked: factor `s` is the single source of truth (export consumes it); last-edited field sets `s`; all fields re-derive from `s` (aspect-locked, no drift). Typed pixels honored exactly; factor shown to 4 decimals (matches the `@0.xxxx` folder token); pixels shown as whole numbers. Rejected snapping — silently changing the user's number feels broken, and tidy folder tokens are cosmetic (Phase 49 already renders arbitrary factors).

---

## Tabs vs enrich inline

| Option | Description | Selected |
|--------|-------------|----------|
| Enrich inline, defer tabs | keep single-pane VariantDialog; enrich the Scale card in place; tabs (Scale\|Output\|Batch) deferred to Phase 51 with Batch | ✓ |
| Introduce tabs now | add Scale\|Output tab structure this phase; Batch tab in Phase 51 | |

**User's choice:** Enrich inline, defer tabs
**Notes:** Added content (one bbox line + two px fields) doesn't yet justify tab chrome; Phase 51's Batch is the real trigger (three real sections at once). Pure in-place enrichment, no structural refactor — honors Phase 49 D-05/D-06.

---

## Claude's Discretion

- Where the bbox computation physically lives & how it reaches the Layer-3 renderer (recommended: compute once in `summary.ts` via `load.runtime`, attach `{w,h}` to `SkeletonSummary`).
- Exact field layout / copy / widths of the enriched Scale card (match existing Tailwind literal-class idiom).
- Live-update cadence (onChange vs onBlur) for the coupled fields.
- Number-format helpers (reuse the inline `toFixed(4)` normalization).
- Whether to expose the bbox origin (x/y) — not required; only `{w,h}` needed.

## Deferred Ideas

- `Scale | Output | Batch` tabbed dialog — Phase 51.
- Batch (N scales → N folders) — Phase 51.
- Per-skin chooser / skin dropdown for the bounds reference — future enrichment.
- Anisotropic / per-axis scaling — out (uniform-only LOCKED).
- Upscaling (s ≥ 1) as a user feature — out of v1.7 scope.
- bbox origin (x/y) display / live "what-if" texture-size preview — Future Requirements.
