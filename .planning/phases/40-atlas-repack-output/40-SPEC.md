# Phase 40: Atlas Repack Output — Specification

**Created:** 2026-05-14
**Ambiguity score:** 0.087 (gate: ≤ 0.20)
**Requirements:** 10 locked

## Goal

The Optimize Dialog gains an additive `loose | atlas | both` output-mode radio (default `loose`); selecting `atlas` or `both` emits a libgdx-format `.atlas` text file plus one or more composite page PNGs at the same output root used by loose export, packed by `maxrects-packer` from per-region pixel data that has already been transformed by the existing pre-pack quality knobs (`safetyBufferPercent`, `sharpenOnExport`, D-91 cap).

## Background

Today the Optimize Dialog ([src/renderer/src/modals/OptimizeDialog.tsx](src/renderer/src/modals/OptimizeDialog.tsx), 797 lines) emits only loose per-region PNGs via the [src/core/export.ts](src/core/export.ts) `buildExportPlan` → [src/main/image-worker.ts](src/main/image-worker.ts) sharp-resize pipeline. Animators who consume optimized regions in libgdx-format engines (Unity / Godot / custom spine-runtimes pipelines) currently round-trip the optimized PNGs back through the Spine editor to repack them — defeating the value prop of sizing-driven optimization. Per [[project_atlas_less_primary_workflow]], Esoteric officially recommends loose-images-+-project-file delivery, which puts our app's ideal pipeline position inside the build system *between* Spine-export and engine-pack — so adding atlas output closes the loop both for atlas-source-input and atlas-less-input workflows.

`maxrects-packer@2.7.3` is already a dependency (used today by [src/core/atlas-preview.ts](src/core/atlas-preview.ts) for the preview compositor only); no install step is required. The skeleton JSON is **invariant under repack** — source-confirmed against spine-ts 4.2.111 per [[project_spine_4_2_atlas_json_precedence]] — so only the `.atlas` and page PNG artifacts change.

## Requirements

1. **REPACK-01 — Additive output mode radio**: Optimize Dialog renders an output-mode radio with `loose | atlas | both` (default `loose`); the existing loose-PNG export pipeline is byte-identical to pre-Phase-40 behavior in the `loose` default.
   - Current: [src/renderer/src/modals/OptimizeDialog.tsx](src/renderer/src/modals/OptimizeDialog.tsx) has no output-mode control; all exports emit loose per-region PNGs.
   - Target: Radio group rendered above the existing export button; selection persisted to `.stmproj` via REPACK-07; `atlas` and `both` enable the repack code path; `loose` selection leaves the export branch unchanged.
   - Acceptance: A vitest fixture export under `loose` mode produces PNG bytes whose SHA256 matches the pre-Phase-40 baseline for [fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json](fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json); selecting `atlas` or `both` writes a `.atlas` file plus ≥ 1 page PNG.

2. **REPACK-02 — maxrects-packer integration in core/**: Pack-planning math lives in pure-TS `core/`, headless-testable via vitest.
   - Current: [src/core/atlas-preview.ts](src/core/atlas-preview.ts) uses `maxrects-packer` only for the in-app preview compositor; no export-path consumer.
   - Target: A new core module (`src/core/repack.ts` or similar) exposes a pure-TS function taking per-region pixel-dimension inputs + atlas options (`atlasMaxPageSize`, `atlasPadding`, `atlasAllowRotation`) and returning a deterministic page layout (page index, region xy, rotation per region). No DOM, no sharp, no Electron — `core/` purity constraint preserved.
   - Acceptance: `tests/core/repack.spec.ts` asserts: (a) identical inputs produce identical pack-output layouts (determinism); (b) output region count equals input region count; (c) every output region fits within its page bounds.

3. **REPACK-03 — Sharp per-region transforms in main/**: Per-region trim + page composition uses sharp in `main/`, mirroring today's loose-export boundary.
   - Current: [src/main/image-worker.ts](src/main/image-worker.ts) performs sharp resize per region for loose export; no composition pipeline exists.
   - Target: Either `image-worker.ts` is extended, or a sibling `repack-worker.ts` is added, to: (a) sharp-resize each region per `buildExportPlan` dims, (b) read the actual emitted dims back from the sharp Buffer, (c) pass actual dims to the `core/repack.ts` packer, (d) sharp-composite each region onto its assigned page at the packer-computed xy. The **Sharp-emits-truth** invariant holds: the packer NEVER sees a dim sharp did not actually produce.
   - Acceptance: For a known fixture, the pixel value at (x, y) inside a page PNG matches the corresponding pixel (after atlas-coord lookup) in the loose-mode PNG for that region — proving pack-and-composite preserves source pixels exactly.

4. **REPACK-04 — libgdx `.atlas` text writer**: A `.atlas` file in libgdx-runtime-compatible format is written alongside page PNGs.
   - Current: No `.atlas` writer exists in `main/`.
   - Target: A new main module (`src/main/atlas-writer.ts` or similar) writes a libgdx-format `.atlas` file with: a per-page header block (filename, size, format=`RGBA8888`, filter=`Linear,Linear`, repeat=`none`) and per-region entries (name, xy, size, orig, offset, index, rotate). Region order matches the input region order from `buildExportPlan`.
   - Acceptance: Output `.atlas` is parseable by the spine-runtimes AtlasReader path (reuse the existing reader used by [src/core/atlas-preview.ts](src/core/atlas-preview.ts) or write a focused unit test); parsed region count matches input region count; all region names, dims, and rotation flags match the pack-plan output.

5. **REPACK-05 — Page-PNG composite writer (multi-page if overflow)**: For each pack-planned page, sharp composites all assigned regions onto a transparent canvas, written as a sibling file to the existing loose output directory.
   - Current: No composite-page PNG writer exists.
   - Target: For pack-plan with N pages, write `{projectName}.png`, `{projectName}_2.png`, … `{projectName}_N.png` as siblings of the existing loose output dir (per round-1 decision: same root, sibling files). Each PNG ≤ `atlasMaxPageSize` × `atlasMaxPageSize`. Canvas is fully transparent; only region pixels are written. PMA preservation matches the existing loose-PNG path (sharp 0.34 + libvips 8.17 auto-handle per [[project_pma_no_op_in_current_stack]]).
   - Acceptance: Output page count equals pack-plan page count; each PNG ≤ `atlasMaxPageSize` on both axes; `scripts/pma-probe.mjs` PMA sentinel passes when re-run against the repack output path.

6. **REPACK-06 — Rotation handling (user-settable, default off)**: Region 90° rotation is opt-in via `atlasAllowRotation`; default is no rotation, matching the conservative input-side rule.
   - Current: Rotation-on-input hard-fails by design (per [[project_atlas_pack_options_atlas_source_only]]); no rotation logic in the output path.
   - Target: `atlasAllowRotation: boolean` (default `false`). When `false`, `maxrects-packer` is constrained to axis-aligned packing; all `.atlas` entries write `rotate: false`. When `true`, the packer may rotate regions 90° to improve fill; sharp rotates the region buffer accordingly before composition; matching `.atlas` entries write `rotate: 90`.
   - Acceptance: With `atlasAllowRotation=false`, no `.atlas` entry across any fixture has `rotate: 90`; with `atlasAllowRotation=true`, the output `.atlas` round-trips through the libgdx-format reader with correct dims for rotated entries (parsed region width/height swapped vs unrotated case).

7. **REPACK-07 — `.stmproj` additive fields (4, no schema bump)**: Four additive fields persist repack settings per project; no `project_format_version` bump.
   - Current: `ProjectFileV1` in [src/shared/types.ts](src/shared/types.ts) has the additive precedent (`loaderMode`, `sharpenOnExport`, `safetyBufferPercent` shipped without version bumps per [src/shared/types.ts:1048-1060](src/shared/types.ts#L1048-L1060)).
   - Target: `ProjectFileV1` gains: `atlasOutputMode: 'loose' | 'atlas' | 'both'` (default `'loose'`); `atlasMaxPageSize: 1024 | 2048 | 4096 | 8192` (default `4096`); `atlasAllowRotation: boolean` (default `false`); `atlasPadding: number` (range 0–16 px, default `2`). The [src/core/project-file.ts](src/core/project-file.ts) validator pre-massages missing fields to defaults. **`project_format_version` is NOT bumped.**
   - Acceptance: `tests/core/project-file.spec.ts` proves: (a) a v1.5-era `.stmproj` written pre-Phase-40 round-trips losslessly with all 4 fields pre-massaged to defaults; (b) a v1.5-era `.stmproj` written post-Phase-40 with all 4 fields populated round-trips losslessly; (c) `project_format_version` is unchanged before vs after Phase 40 in saved fixtures.

8. **REPACK-08 — atlas-source + atlas-less loaderMode parity on output**: Both input loaderModes produce byte-identical repack output for the same optimized region set.
   - Current: `loaderMode` gates only input-side reads per [[project_strict_loadermode_separation]]; no output-side parity test exists.
   - Target: For [fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json](fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json) loaded under `atlas-source` mode and the same project loaded under `atlas-less` mode (with identical override map and quality knobs), running atlas-mode export under each produces SHA256-identical `.atlas` text and SHA256-identical page PNG bytes.
   - Acceptance: `tests/core/repack.spec.ts` asserts `SHA256(.atlas)` matches across modes AND `SHA256(page PNG)` matches across modes for the same fixture + override set.

9. **REPACK-09 — Pre-pack quality knobs apply per-region**: `safetyBufferPercent`, `sharpenOnExport`, and the D-91 cap each transform per-region pixel data **before** packing; pack geometry is purely mechanical.
   - Current: All three knobs apply per-region in [src/core/export.ts](src/core/export.ts) `buildExportPlan` for loose export ([src/core/export.ts:83-93](src/core/export.ts#L83-L93), [src/core/export.ts:167-245](src/core/export.ts#L167-L245)).
   - Target: Atlas and `both` modes feed the post-quality-knob region buffer to the packer; no knob alters pack-layout behavior beyond changing each region's input dimensions. `buildExportPlan` signature is unchanged.
   - Acceptance: For a fixed region set, varying `safetyBufferPercent` (e.g. 0% → 5%) changes per-region dims in the `.atlas` entries by the expected scaled amount; toggling `sharpenOnExport` produces byte-different PNG pixels but identical pack layout when dims are unchanged (`SHA256(.atlas)` invariant across sharpen toggle).

10. **REPACK-10 — Atomic-or-fail contract**: Oversize regions abort cleanly; mid-write failures roll back all artifacts.
    - Current: Loose export has an atomic-or-fail contract (no orphan partial files on cancel/failure); no equivalent contract exists for repack.
    - Target: (a) **Oversize detection at pack-plan time** — if any region's post-quality-knob dims exceed `atlasMaxPageSize` on either axis, abort BEFORE any file is written; OptimizeDialog surfaces a structured error: `"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."` (b) **Mid-execution failure** — if any sharp/atlas-writer call fails partway through, delete every `.atlas` and page PNG produced by this export run before exit; the output directory is in its pre-export state. In `both` mode, loose PNGs written during the same export are also rolled back.
    - Acceptance: Unit test with a fixture rigged so one region exceeds the cap → export aborts with the expected error string; NO `.atlas` or page PNG exists in the output dir after the failed export. Integration test with a simulated sharp failure on page 2 of 3 → no `.atlas` or page PNG remains in the output dir.

## Boundaries

**In scope:**
- Output-mode radio in OptimizeDialog (`loose | atlas | both`, default `loose`)
- `core/` pure-TS pack-planning module wrapping `maxrects-packer`
- `main/` sharp orchestration: per-region resize → packer input → per-page composite
- `main/` libgdx-format `.atlas` text writer
- Multi-page PNG output (sibling files to existing loose output dir)
- User-settable rotation (default off) and user-settable page-size cap (default 4096)
- 4 additive `.stmproj` fields with validator pre-massage (no schema bump)
- Oversize-region pre-flight abort + mid-write rollback (atomic-or-fail)
- SHA256-based regression tests for loose-mode parity + cross-loaderMode parity
- SEED-008 frontmatter `status:` flip from `dormant` to `closed` at phase close

**Out of scope:**
- **Skeleton JSON modification** — JSON is invariant under repack per [[project_spine_4_2_atlas_json_precedence]] (source-confirmed against spine-ts 4.2.111). No `.json` rewrite path.
- **`.stmproj` schema version bump** — pure additive fields follow the `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent.
- **`buildExportPlan` signature changes** — quality-knob math is preserved as-is; pack consumes its output.
- **Atlas filter / format / repeat tuning** — emitted as constants (`Linear,Linear`, `RGBA8888`, `repeat: none`); not exposed as `.stmproj` fields per round-2 minimal-4-field decision.
- **Multi-output-folder selection** — atlas + page PNGs always go to the same root as loose output (per round-1 decision).
- **Cross-mode loose-vs-atlas pixel equivalence on a per-pixel basis** — sharp composite onto a transparent canvas may differ trivially from sharp-emitted standalone PNG due to libvips composite paths; REPACK-03 only requires *atlas-coord-mapped equivalence*, not byte-identical PNG files across modes.
- **Pack-layout determinism across maxrects-packer versions** — determinism is tested against the pinned `maxrects-packer@2.7.3`; bumping the dep is out of scope and would trigger a regression-fixture refresh.
- **Atlas-mode preview in the dialog before export** — preview lives in [src/renderer/src/modals/AtlasPreviewModal.tsx](src/renderer/src/modals/AtlasPreviewModal.tsx) (existing); wiring its UI to read the new fields is a discuss-phase decision, not a SPEC requirement.
- **Trimmed-region whitespace optimization beyond what loose mode already does** — pack uses the same per-region pixel data loose mode writes; no extra trim pass.

## Constraints

- **`core/` purity** — pack-planning math (`maxrects-packer` usage) MUST stay in `core/` with no DOM, sharp, or Electron imports; headless vitest-testable.
- **`main/` boundary** — sharp invocations + `.atlas` text writing MUST stay in `main/` (same boundary as today's loose export).
- **Sharp-emits-truth invariant** — pack input dims MUST be the dims sharp actually emits, not the `buildExportPlan` target dims; packer cannot lay out a region the bytes don't match.
- **PMA preservation** — existing PMA contract holds (`sharp@0.34` + `libvips@8.17` auto-handle per [[project_pma_no_op_in_current_stack]]); `scripts/pma-probe.mjs` sentinel applies to repack output.
- **maxrects-packer version pinned** — `maxrects-packer@2.7.3` (already in `package.json`); SHA256 regression fixtures are valid only for this pinned version.
- **No `project_format_version` bump** — follows the `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent for additive `.stmproj` fields.
- **Atomic-or-fail** — failed exports MUST leave the output directory in its pre-export state (matches existing loose-export contract).
- **macOS + Windows only** — Linux is deferred per [[project_linux_deferred]]; no Linux-specific test surface.

## Acceptance Criteria

- [ ] Optimize Dialog renders a `loose | atlas | both` radio (default `loose`).
- [ ] Selecting `loose` produces PNG bytes whose SHA256 matches the pre-Phase-40 baseline for the SIMPLE_TEST.json fixture (byte-identical regression guard).
- [ ] Selecting `atlas` produces exactly one `.atlas` text file plus ≥ 1 page PNG at the same output root.
- [ ] Selecting `both` produces all of the above plus the full loose-mode PNG set in the same output directory.
- [ ] `core/repack.ts` (or equivalent) contains no DOM / sharp / Electron imports and is vitest-tested headlessly.
- [ ] Output `.atlas` is parseable by the existing spine-runtimes AtlasReader path; parsed region count equals input region count.
- [ ] Page PNG count = pack-planned page count; each PNG ≤ `atlasMaxPageSize` on both axes.
- [ ] `ProjectFileV1` gains exactly 4 additive fields (`atlasOutputMode`, `atlasMaxPageSize`, `atlasAllowRotation`, `atlasPadding`) with the specified defaults.
- [ ] `project_format_version` is unchanged in saved fixtures before vs after Phase 40.
- [ ] A pre-Phase-40 `.stmproj` round-trips losslessly through the post-Phase-40 validator (missing fields → defaults).
- [ ] Loading SIMPLE_TEST.json under `atlas-source` vs `atlas-less` loaderMode produces SHA256-identical `.atlas` and SHA256-identical page PNG output for the same override set.
- [ ] With `atlasAllowRotation=false`, no `.atlas` entry has `rotate: 90` across any fixture.
- [ ] Varying `safetyBufferPercent` changes per-region `.atlas` dims as expected; toggling `sharpenOnExport` does NOT alter pack layout (`SHA256(.atlas)` invariant when dims unchanged).
- [ ] An oversize-region export attempt aborts at pack-plan time with the structured error and leaves NO `.atlas` or page PNG on disk.
- [ ] A simulated sharp failure mid-composite leaves NO `.atlas` or page PNG on disk (atomic rollback).
- [ ] `scripts/pma-probe.mjs` PMA sentinel passes against page PNG output.
- [ ] SEED-008 frontmatter `status:` flips from `dormant` to `closed` at phase close with breadcrumb to Phase 40.

## Ambiguity Report

| Dimension          | Score | Min  | Status | Notes                                                                 |
|--------------------|-------|------|--------|-----------------------------------------------------------------------|
| Goal Clarity       | 0.90  | 0.75 | ✓      | Additive radio + libgdx .atlas + maxrects-packer; failure modes locked |
| Boundary Clarity   | 0.92  | 0.70 | ✓      | 4 stmproj fields, multi-page strategy, rotation default, output path  |
| Constraint Clarity | 0.92  | 0.65 | ✓      | Sharp-emits-truth invariant, atomic-or-fail, PMA preserved            |
| Acceptance Criteria| 0.92  | 0.70 | ✓      | SHA256 fixture comparison + 17 pass/fail criteria                     |
| **Ambiguity**      | 0.087 | ≤0.20| ✓      |                                                                       |

## Interview Log

| Round | Perspective       | Question summary                                  | Decision locked                                                                 |
|-------|-------------------|---------------------------------------------------|---------------------------------------------------------------------------------|
| 1     | Researcher        | Multi-page strategy when regions exceed cap?      | User-settable `atlasMaxPageSize` (1024/2048/4096/8192, default 4096); multi-page spill |
| 1     | Researcher        | Does packer rotate regions 90° to pack tighter?   | User-settable `atlasAllowRotation`, default `false`                             |
| 1     | Researcher        | Where do `.atlas` + page PNG(s) write?            | Same root as loose, sibling files                                               |
| 2     | Simplifier        | Which set of additive `.stmproj` fields?          | Minimal 4-field set: outputMode, maxPageSize, allowRotation, padding (default 2 px) |
| 2     | Boundary Keeper   | What proves byte-unchanged loose + cross-mode parity? | SHA256 fixture comparison via vitest (sharp/libvips pinned in package.json — Claude-decided) |
| 3     | Failure Analyst   | Region exceeds atlasMaxPageSize — what happens?   | Abort at pack-plan time with structured error; no partial files                 |
| 3     | Failure Analyst   | sharp dim drift vs buildExportPlan dims?          | Sharp-emits-truth: packer reads actual sharp output dims (Claude-decided per pinned versions) |
| 3     | Failure Analyst   | sharp fails mid-composite — cleanup contract?     | Atomic abort: delete all `.atlas` + page PNG artifacts; rollback loose in `both` mode |

---

*Phase: 40-atlas-repack-output*
*Spec created: 2026-05-14*
*Next step: /gsd-discuss-phase 40 — implementation decisions (sharp composite ordering, repack-worker.ts vs image-worker.ts extension, OptimizeDialog field layout, error-toast wording, vitest fixture strategy)*
