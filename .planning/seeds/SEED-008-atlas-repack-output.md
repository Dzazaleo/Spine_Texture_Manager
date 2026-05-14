---
id: SEED-008
status: dormant
planted: 2026-05-14
planted_during: v1.5 / pre-Phase 40 (branch experiment/phase-40-atlas-repack)
trigger_when: Phase 40 (Atlas Repack Output) — unblocks /gsd-complete-milestone v1.5
scope: Medium
---

# SEED-008: Atlas Repack Output — pack optimized regions into .atlas + composite PNG

## Why This Matters

Today the Optimize Dialog emits loose per-region PNGs. Most consuming pipelines
(Unity/Godot/custom engines via spine-runtimes) want a packed `.atlas` + page
PNG(s) — and animators currently round-trip back through Spine just to repack
optimized regions, which defeats the value prop of sizing-driven optimization.

Adding a libgdx-format atlas output mode closes that loop: animators can ship
the optimized atlas directly. It also unlocks the "atlas-less ➜ atlas" delivery
upgrade for projects that started with loose-images workflow (the
Esoteric-recommended primary workflow per [[project_atlas_less_primary_workflow]]).

Critically, the JSON is **invariant under repack** — source-confirmed against
spine-ts 4.2.111 (see [[project_spine_4_2_atlas_json_precedence]]). Skeleton JSON
references regions by name; runtime reads dims from atlas. So repack changes
only `.atlas` + page PNG(s); the project's `.json` ships untouched.

## When to Surface

**Trigger:** Phase 40 of v1.5 — already scaffolded on
`experiment/phase-40-atlas-repack`. This seed exists to encode the locked
decisions before `/gsd-spec-phase 40` runs, so spec/discuss don't relitigate.

This seed should be presented (or referenced) during:
- `/gsd-spec-phase 40` — lock REPACK-01..09 requirements
- `/gsd-discuss-phase 40` — answer "what's already decided?"
- `/gsd-complete-milestone v1.5` — final milestone gate

## Scope Estimate

**Medium** — one phase. Pack math (maxrects-packer) is core/ pure-TS; sharp
per-region trim/rotate/composition is main/. UI is a single radio group in the
existing Optimize Dialog. `.stmproj` schema unchanged (additive fields,
precedent: `loaderMode`, `sharpenOnExport`).

## Locked Design Facts (do not relitigate)

1. **Output mode is ADDITIVE** — radio `loose | atlas | both`, default `loose`.
   Existing loose-PNG output untouched in this default.
2. **JSON is INVARIANT under repack** — source-confirmed against spine-ts
   4.2.111; see [[project_spine_4_2_atlas_json_precedence]]. No JSON rewrite
   path needed.
3. **Both input loaderModes supported** — `atlas-source` and `atlas-less` both
   feed the repack pipeline. Per [[project_strict_loadermode_separation]],
   each mode stays self-contained on the input side; output is mode-agnostic.
4. **7 additive `.stmproj` fields, no schema bump** — precedent: `loaderMode`
   and `sharpenOnExport` shipped as additive in v1.2 / v1.3 without
   `project_format_version` bump.
5. **`core/` stays pure-TS** — pack math (maxrects-packer is already in
   `package.json`) lives in core/, headless-testable via vitest.
6. **sharp + `.atlas` text writing live in `main/`** — same boundary as
   today's PNG export pipeline ([src/main/image-worker.ts](src/main/image-worker.ts)).
7. **Pre-pack invariants preserved** — `safetyBufferPercent`,
   `sharpenOnExport`, and D-91 cap all apply **per-region before packing**.
   Pack layout is purely geometric; no quality knobs interact with packing.

## REQ-ID Namespace

**REPACK-01..09** (tentative; `/gsd-spec-phase 40` finalizes). Suggested split:

- REPACK-01 — additive output mode radio (loose | atlas | both)
- REPACK-02 — maxrects-packer integration in core/
- REPACK-03 — sharp per-region trim + composition in main/
- REPACK-04 — libgdx `.atlas` text writer
- REPACK-05 — page-PNG composite writer (multi-page if overflow)
- REPACK-06 — rotation handling (carry [[project_atlas_pack_options_atlas_source_only]] rules)
- REPACK-07 — `.stmproj` additive fields (×7, no schema bump)
- REPACK-08 — atlas-source + atlas-less both produce identical output for same regions
- REPACK-09 — pre-pack quality knobs (safetyBuffer, sharpen, D-91) apply per-region

## Breadcrumbs

Code already in place that this phase will extend:

- [src/core/synthetic-atlas.ts](src/core/synthetic-atlas.ts) — atlas-less synthesis;
  closest analog for in-memory atlas region modeling
- [src/core/export.ts](src/core/export.ts) — current loose-export pipeline; extension
  point for the `mode: 'atlas' | 'both'` branches
- [src/core/atlas-preview.ts](src/core/atlas-preview.ts) — atlas preview compositor;
  reusable geometry for the pack visualization
- [src/main/image-worker.ts](src/main/image-worker.ts) — sharp worker; per-region
  trim + composite belongs alongside existing per-region resize
- [src/shared/types.ts](src/shared/types.ts) — `loaderMode` + `sharpenOnExport`
  precedent for the 7 additive `.stmproj` fields
- [package.json](package.json) — `maxrects-packer` already a dep (no install step)
- [src/renderer/src/modals/AtlasPreviewModal.tsx](src/renderer/src/modals/AtlasPreviewModal.tsx) —
  existing atlas-preview UI; reference for visualization affordances
- Related memories: [[project_spine_4_2_atlas_json_precedence]],
  [[project_strict_loadermode_separation]],
  [[project_atlas_less_primary_workflow]],
  [[project_atlas_pack_options_atlas_source_only]]

## Notes

- Branch `experiment/phase-40-atlas-repack` is already checked out with 3
  housekeeping renames staged (debug docs moved to `resolved/`). Leave them
  staged — they roll into Phase 40's first atomic commit.
- STATE.md shows v1.5 `milestone_complete` as of 2026-05-13 (Phase 39). Phase 40
  is being inserted before `/gsd-complete-milestone v1.5` runs; expect STATE.md
  counters to need a manual nudge (precedent: [[project_gsd_phase_complete_state_miscount]]).
- Next concrete step: `/gsd-spec-phase 40` to lock REPACK-01..09.
