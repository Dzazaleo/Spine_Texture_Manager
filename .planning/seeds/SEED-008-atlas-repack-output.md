---
id: SEED-008
status: closed
planted: 2026-05-14
closed: 2026-05-15
planted_during: v1.5 / pre-Phase 40 (branch experiment/phase-40-atlas-repack)
closed_during: v1.5 / Phase 40 (Atlas Repack Output)
closing_phase: 40-atlas-repack-output
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

## Closure (2026-05-15 — Phase 40)

**Closed by**: Phase 40 — Atlas Repack Output.

**Requirements delivered**: REPACK-01 through REPACK-10 — see `.planning/phases/40-atlas-repack-output/40-SPEC.md` for the locked specification.

**Phase artifacts**:
- `40-SPEC.md` — locked 10 requirements (ambiguity score 0.087)
- `40-CONTEXT.md` — 7 user-locked decisions (D-01 through D-07 series)
- `40-RESEARCH.md` — libgdx format reference, maxrects-packer API, sharp composite pipeline, 16 landmines
- `40-PATTERNS.md` — 11 new-file analogs + 7 modified-file splice sites
- `40-VALIDATION.md` — per-task verification map + Wave 0 test list
- 9 PLAN.md files (40-01 through 40-09)
- Per-plan SUMMARY.md files recording execution outcomes

**Source code landed**:
- `src/core/repack.ts` — pure-TS pack-planning (REPACK-02, REPACK-06)
- `src/main/atlas-writer.ts` — libgdx `.atlas` text serializer (REPACK-04)
- `src/main/repack-worker.ts` — sharp orchestration + atomic-or-fail (REPACK-03, REPACK-05, REPACK-10)
- `src/main/atlas-paths.ts` — shared `deriveProjectName` + `pageFilename` between probe and worker
- `src/main/sharp-resize.ts` — shared resize+sharpen helper (D-03a)
- `src/main/ipc.ts` — `export:start` channel extended with `outputMode` + `atlasOpts`; `probeExportConflicts` extended to atlas-mode targets (REPACK-01, D-04)
- `src/main/image-worker.ts` — `runExport` widened with `writtenPaths` accumulator (D-04a)
- `src/renderer/src/modals/OptimizeDialog.tsx` — Output card + 3 atlas knobs (REPACK-01, D-01..D-01e)
- `src/renderer/src/components/AppShell.tsx` — atlas state threading + atlas-aware probe
- `src/preload/index.ts` + `index.d.ts` — IPC bridge widening
- `src/shared/types.ts` — 4 additive `ProjectFileV1` fields + `ExportProgressEvent.phase` (REPACK-07, D-05)
- `src/core/project-file.ts` — 4 validator pre-massage blocks (REPACK-07)

**Test coverage**:
- `tests/core/repack.spec.ts` — determinism, count preservation, page bounds, oversize pre-flight, rotation read-back
- `tests/main/atlas-writer.spec.ts` — libgdx round-trip via spine-core, field parity, rotation flag, blank-line discipline, defensive colon-check
- `tests/main/repack-worker.spec.ts` — atlas mode, both mode, sharp-emits-truth, pixel preservation, page count/bounds, oversize abort, atomic rollback contract, skin-aliased dedup, passthroughCopies packing
- `tests/main/ipc-export.spec.ts` — dispatch on each outputMode, validator rejection, both-mode rollback, atlas-mode probe coverage
- `tests/main/repack.loose-parity.spec.ts` — REPACK-01 SHA256 regression sentinel
- `tests/main/repack.parity.spec.ts` — REPACK-08 cross-loaderMode parity + REPACK-09 sharpen-invariant
- `tests/core/project-file.spec.ts` — extended for 4 new atlas fields
- `tests/renderer/optimize-dialog-output-card.spec.tsx` — Output card UI + UAT round 1/2/3 regression cases
- `tests/renderer/app-shell-atlas-state.spec.tsx` — AppShell atlas state threading
- `tests/preload/start-export-atlas-args.spec.ts` — widened preload bridge
- `tests/arch.spec.ts` — `core/repack.ts` auto-covered by existing core-purity grep

**UAT iterations**:
3 rounds of human verification surfaced and resolved:
- Round 1: dedup of duplicate region entries (initial overlap bug); rotation direction `+90` → `-90` (upside-down faces); atlas-mode summary count (0/N → real count); tooltip moved to label.
- Round 2: dedup key changed from `attachmentNames[0]` (slot-binding, shared across skins) → `outPath` (path-attribute, unique per source PNG); passthroughCopies now packed into atlas.
- Round 3: `probeExportConflicts` extended to atlas-mode targets; progress counter follows IPC `event.total` instead of static loose-mode local total.

**Locked invariants honored**:
- Skeleton JSON is invariant under repack (memory `project_spine_4_2_atlas_json_precedence`).
- atlas-source and atlas-less loaderModes produce SHA256-identical output (memory `project_strict_loadermode_separation`).
- No `project_format_version` bump (additive precedent).
- Sharp-emits-truth: packer receives the dims sharp actually emits, not buildExportPlan targets.
- Atomic-or-fail: oversize pre-flight + mid-write rollback via shared `Set<string>` accumulator.
- Locked REPACK-10 error string preserved verbatim across worker, IPC, and UI surfaces.
- `core/` purity preserved — `core/repack.ts` clean of sharp/fs/electron imports.

**Status flip rationale**: Per `40-SPEC.md` §Acceptance Criteria item 17 ("SEED-008 frontmatter `status:` flips from `dormant` to `closed` at phase close with breadcrumb to Phase 40") and SEED-008's own design contract ("This seed should be presented (or referenced) during: ... /gsd-complete-milestone v1.5 — final milestone gate"), this seed is closed concurrently with Phase 40's completion.
