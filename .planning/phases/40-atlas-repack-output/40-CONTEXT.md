# Phase 40: Atlas Repack Output - Context

**Gathered:** 2026-05-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The Optimize Dialog gains an additive `loose | atlas | both` output-mode radio (default `loose`); selecting `atlas` or `both` emits a libgdx-format `.atlas` text file plus one or more composite page PNGs at the same output root used by loose export, packed by `maxrects-packer` from per-region pixel data that has already been transformed by the existing pre-pack quality knobs (`safetyBufferPercent`, `sharpenOnExport`, D-91 cap).

This discussion captures the implementation decisions that downstream agents (researcher, planner, executor) need on top of the requirements that `40-SPEC.md` already locks.

</domain>

<spec_lock>
## Requirements (locked via SPEC.md)

**10 requirements are locked.** See `40-SPEC.md` for full requirements, boundaries, and acceptance criteria.

Downstream agents MUST read `40-SPEC.md` before planning or implementing. Requirements are not duplicated here.

**In scope (from SPEC.md):**
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

**Out of scope (from SPEC.md):**
- Skeleton JSON modification (JSON is invariant under repack per [[project_spine_4_2_atlas_json_precedence]])
- `.stmproj` schema version bump (additive precedent only)
- `buildExportPlan` signature changes
- Atlas filter / format / repeat tuning (emitted as constants)
- Multi-output-folder selection (always same root as loose)
- Cross-mode loose-vs-atlas pixel equivalence on a per-pixel basis
- Pack-layout determinism across `maxrects-packer` versions
- Atlas-mode preview wiring in AtlasPreviewModal (locked decoupled per D-02 below)
- Trimmed-region whitespace optimization beyond loose mode

</spec_lock>

<decisions>
## Implementation Decisions

### OptimizeDialog field layout (user-locked)

- **D-01:** Add a new bordered "Output" card immediately above the existing "Quality" card (mirrors the visual pattern at [OptimizeDialog.tsx:437](src/renderer/src/modals/OptimizeDialog.tsx#L437)). Layout reads top-down: Stats tiles → **Output card** → Quality card → footer buttons.
- **D-01a:** The `loose | atlas | both` radio is the first control inside the Output card.
- **D-01b:** The 3 atlas knobs (`atlasMaxPageSize`, `atlasAllowRotation`, `atlasPadding`) are **hidden** when `loose` is selected; they reveal inside the Output card when `atlas` or `both` is selected. Cleanest default state — zero visual cost for users who never use atlas mode.
- **D-01c:** `atlasMaxPageSize` renders as a native `<select>` dropdown with options `1024 / 2048 / 4096 / 8192` (default `4096`). Discrete-choice nature matches the field; no validation surface.
- **D-01d:** `atlasAllowRotation` renders as a checkbox with a hover tooltip explaining "Packer may rotate regions 90° for tighter packing." (Checkbox style follows the existing `sharpenOnExport` pattern at [OptimizeDialog.tsx:476-489](src/renderer/src/modals/OptimizeDialog.tsx#L476-L489).)
- **D-01e:** *Claude-decided per delegation* — `atlasPadding` renders as a number input clamped to 0..16 px (default `2`), following the existing `safetyBufferPercent` pattern at [OptimizeDialog.tsx:450-468](src/renderer/src/modals/OptimizeDialog.tsx#L450-L468) (textbox + suffix unit label "px").

### AtlasPreviewModal integration (user-locked)

- **D-02:** AtlasPreviewModal **stays decoupled** from the new atlas-output mode. The existing input-side preview path is untouched; the "→ Atlas Preview" cross-nav button at [OptimizeDialog.tsx:522-532](src/renderer/src/modals/OptimizeDialog.tsx#L522-L532) keeps its current behavior regardless of selected output mode. Wiring a pack-plan preview into AtlasPreviewModal is explicitly **deferred to a future phase**.
- **D-02a:** *Claude-discretion (deferred to planner)* — whether `core/repack.ts` and `core/atlas-preview.ts` share a common `maxrects-packer` wrapper, or each consumer wraps the packer independently. Planner decides based on actual duplication surface that emerges during REPACK-02 implementation. Default lean: stay independent unless a shared helper meaningfully reduces code; the two consumers have different input shapes (AtlasPreviewInput[] vs post-quality-knob region dims) and different output shapes.

### main/ worker structure & IPC (Claude-decided per delegation)

- **D-03:** Add a sibling `src/main/repack-worker.ts` instead of inlining atlas-mode work into `image-worker.ts`. Rationale: `image-worker.ts` (679 lines) already does one thing well (per-region resize + atomic write); atlas mode adds a fundamentally different stage (multi-region composite + libgdx text serialization). Mixing them violates single-responsibility and pushes the file past 1100 lines.
- **D-03a:** The per-region sharp-resize step is **extracted into a shared helper** (location: planner's call — either exported from `image-worker.ts` or split into a new `main/sharp-resize.ts`) so `image-worker.ts` and `repack-worker.ts` are byte-aligned without duplication.
- **D-03b:** A separate `src/main/atlas-writer.ts` owns the libgdx `.atlas` text serialization (mirrors SPEC.md REPACK-04 suggestion). Keeps the writer testable in isolation and isolates the libgdx format details from the composite path.
- **D-04:** **Extend the existing `export:start` IPC channel** with positional args `outputMode: 'loose' | 'atlas' | 'both'` and `atlasOpts: { maxPageSize, allowRotation, padding }` rather than adding a new `export:start-repack` channel. Rationale: continues the established positional-arg precedent (`allowOverwrite` added Phase 23 round-3, `sharpenEnabled` added Phase 28), keeps the preload surface stable, and lets `both` mode dispatch trivially from a single IPC call.
- **D-04a:** The handler dispatches: `loose` → `runExport` only; `atlas` → `runRepack` only; `both` → `runExport` then `runRepack` with a **shared rollback list** (Claude-discretion: tracked as a `Set<string>` of all written paths, finally-block deletes all on any throw).
- **D-05:** **`ExportProgressEvent` gains an additive `phase: 'resize' | 'composite'` field.** Resize-phase events fire `0..N-1` (one per region); composite-phase events fire `0..P-1` (one per page). Rationale: the two stages do qualitatively different work — compositing a 4096² page can take meaningfully longer than a single region resize, so a unified counter would jump and the indeterminate-spinner-at-end approach would look like a hang on large atlases. Additive field — existing renderer code can ignore `phase` and still process the resize-phase event stream.

### Vitest SHA256 fixture strategy (Claude-decided per delegation)

- **D-06:** **Hybrid baseline storage**: a JSON sidecar at `tests/fixtures/repack-baselines.json` holds SHA256 for every output file (`.atlas` + each page PNG); the `.atlas` text files themselves are committed under `tests/fixtures/repack-expected/{fixtureName}.atlas` for diff-ability when a test fails. Page PNG bytes are **not** committed (would be MB each at 4096², not human-diffable anyway). On test failure: text diff for `.atlas`, hash-mismatch report for PNGs.
- **D-06a:** Test layout: REPACK-08 cross-loaderMode parity test loads `SIMPLE_TEST.json` once under `loaderMode='auto'` and once under `loaderMode='atlas-less'`, asserts SHA256-identical `.atlas` text AND SHA256-identical page-PNG bytes for the same override set.
- **D-07:** **Refresh policy: both manual script + env flag.** `npm run repack:refresh-baselines` regenerates the SHA sidecar + committed `.atlas` files from current dep versions (use when intentionally bumping `sharp` / `libvips` / `maxrects-packer`). `UPDATE_FIXTURES=1` env flag during a vitest run writes actual hashes into the baseline file in-place (matches vitest/Jest `--updateSnapshot` muscle memory). **CI stays loud** — neither path runs in CI; flag is dev-only.

### Claude's Discretion

The following implementation details are left to the planner / executor:

- **Packer-sharing strategy** (D-02a): independent vs shared `maxrects-packer` wrapper between `core/repack.ts` and `core/atlas-preview.ts`.
- **Shared resize helper location** (D-03a): exported from `image-worker.ts` or split into a sibling module.
- **Rollback list mechanism** (D-04a): exact data structure tracking written paths; default is a `Set<string>` accumulator in the IPC handler with a finally-block cleanup.
- **`.atlas` text formatting details** (D-03b): exact whitespace/newline conventions inside the libgdx-compatible format are planner's call as long as the spine-runtimes `AtlasReader` round-trip in REPACK-04 passes.
- **OptimizeDialog atlas-knobs reveal mechanism** (D-01b): plain conditional render vs slide-down transition — planner picks based on existing animation patterns in the codebase.
- **Tooltip primitive for atlasAllowRotation** (D-01d): use whatever tooltip mechanism already exists in the renderer (planner scouts) rather than introducing a new dependency.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec, seed, and roadmap (load first)
- `.planning/phases/40-atlas-repack-output/40-SPEC.md` — **Locked requirements (REPACK-01..10), boundaries, acceptance criteria.** Must be read before planning.
- `.planning/seeds/SEED-008-atlas-repack-output.md` — Locked design facts from pre-Phase-40 scoping (additive output mode, JSON invariance, loaderMode parity, 4 additive stmproj fields, core/+main/ split, pre-pack invariants).
- `.planning/ROADMAP.md` — Phase 40 entry in v1.5.
- `.planning/REQUIREMENTS.md` — REPACK-01..10 namespace.

### Memory references (durable project facts)
- `memory/project_spine_4_2_atlas_json_precedence.md` — **JSON is invariant under repack.** Source-confirmed against spine-ts 4.2.111. No `.json` rewrite path needed.
- `memory/project_strict_loadermode_separation.md` — atlas-source and atlas-less are self-contained on the input side; output is mode-agnostic. Drives REPACK-08 parity test design.
- `memory/project_atlas_less_primary_workflow.md` — Esoteric officially recommends loose-images-+-project-file delivery; our app sits between Spine export and engine pack. Motivates atlas-mode output for atlas-less input.
- `memory/project_atlas_pack_options_atlas_source_only.md` — Input-side rotation hard-fails by design; output-side rotation is the *opposite* path (rebuild a fresh atlas, rotation is opt-in via `atlasAllowRotation`).
- `memory/project_pma_no_op_in_current_stack.md` — `sharp@0.34` + `libvips@8.17` auto-handle PMA. `scripts/pma-probe.mjs` applies to repack output.
- `memory/project_v131_shipped.md` — Confirms v1.5 still in_progress; Phase 40 closes it before `/gsd-complete-milestone v1.5`.

### Code anchors (read on the way into planning)
- `src/renderer/src/modals/OptimizeDialog.tsx` (797 lines) — Insertion point for the new Output card (D-01).
- `src/core/export.ts` — `buildExportPlan` is the pre-pack quality-knob pipeline (REPACK-09). Signature is unchanged in Phase 40.
- `src/main/image-worker.ts` (679 lines) — `runExport` entry; resize helper extraction lives here per D-03a.
- `src/main/ipc.ts` — `export:start` handler at line 703 is the IPC extension site per D-04.
- `src/core/atlas-preview.ts` — Existing `maxrects-packer` consumer; relevant for D-02a packer-sharing question.
- `src/renderer/src/modals/AtlasPreviewModal.tsx` — Existing preview modal; **unchanged** per D-02.
- `src/shared/types.ts` (lines 1042-1060) — `ProjectFileV1` additive-field precedent (`loaderMode`, `sharpenOnExport`, `safetyBufferPercent`); template for the 4 new repack fields per REPACK-07.
- `src/core/project-file.ts` — Validator that pre-massages missing fields to defaults.
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (+ `.atlas`, `.png`) — Primary regression fixture.
- `scripts/pma-probe.mjs` — PMA sentinel; runs against repack output per REPACK-05 acceptance.
- `package.json` — Confirms `maxrects-packer@2.7.3`, `sharp@0.34`, `libvips@8.17` pins.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`maxrects-packer@2.7.3`** is already a dependency, currently consumed only by `src/core/atlas-preview.ts` for the in-app preview compositor. No install step is required. The packer's API surface is the same one `core/repack.ts` will use.
- **`buildExportPlan` (in `core/export.ts`)** already applies all three pre-pack quality knobs per-region (`safetyBufferPercent`, `sharpenOnExport`, D-91 cap). Atlas mode consumes its output unchanged.
- **`regionName` keying** ([export.ts:212](src/core/export.ts#L212)) is the Phase 29 D-04 locked primary key for overrides and exclusions; this is the canonical name to use in `.atlas` region entries.
- **Atomic-write idiom** ([image-worker.ts:254-304](src/main/image-worker.ts#L254-L304)) is the pattern repack-worker.ts reuses for `.tmp + rename` artifact writes.
- **`ExportProgressEvent` stream** (one-way `evt.sender.send('export:progress', ...)` at [ipc.ts:668](src/main/ipc.ts#L668)) is the channel D-05 extends with the `phase` field.
- **OptimizeDialog control patterns**: existing `safetyBufferPercent` textbox+suffix pattern (L450-468), `sharpenOnExport` checkbox+label pattern (L476-489), and bordered "Quality" card pattern (L437) drive D-01 layout.

### Established Patterns
- **`core/` purity** — pack-planning math (`maxrects-packer`) MUST stay in `core/` with no DOM, sharp, or Electron imports; vitest-testable headlessly.
- **`main/` boundary** — sharp invocations + `.atlas` text writing MUST stay in `main/` (same boundary as today's loose export).
- **Sharp-emits-truth invariant** — pack input dims MUST be the dims sharp actually emits (read back from the sharp Buffer via `.metadata()`), not the `buildExportPlan` target dims. The packer cannot lay out a region the bytes don't match.
- **Additive `.stmproj` fields, no schema bump** — `loaderMode`, `sharpenOnExport`, `safetyBufferPercent` all shipped this way (precedent at [types.ts:1042-1060](src/shared/types.ts#L1042-L1060)). The 4 new atlas fields follow the same pre-massage-to-defaults validator path.
- **Atomic-or-fail** — failed exports MUST leave the output directory in its pre-export state. Loose mode has this contract today; D-04a extends it to atlas mode via a shared rollback list. `both` mode rolls back BOTH stages' artifacts.

### Integration Points
- **IPC layer**: `export:start` handler at [ipc.ts:703](src/main/ipc.ts#L703) — extended per D-04.
- **Renderer wire-up**: OptimizeDialog props gain `outputMode` + `atlasOpts` (with defaults from `.stmproj`); the existing onStart callback at [OptimizeDialog.tsx:278](src/renderer/src/modals/OptimizeDialog.tsx#L278) threads them through to `window.electron.invoke('export:start', ...)`.
- **`.stmproj` validator**: `src/core/project-file.ts` pre-massages missing atlas fields to defaults (REPACK-07).
- **Output dir**: same root as loose export; sibling files. `{projectName}.atlas`, `{projectName}.png`, `{projectName}_2.png`, … `{projectName}_N.png` are written alongside loose region PNGs in `both` mode.

</code_context>

<specifics>
## Specific Ideas

- **Atlas page PNG naming convention**: `{projectName}.png` / `{projectName}_2.png` / `{projectName}_N.png` — locked in SPEC.md REPACK-05. The `.atlas` file is `{projectName}.atlas`.
- **`.atlas` region entries use `regionName`** (Phase 29 D-04 key) — confirmed in [export.ts:212](src/core/export.ts#L212). This is the canonical key throughout the export pipeline; downstream agents should not introduce a different naming convention.
- **Tooltip wording for `atlasAllowRotation`**: "Packer may rotate regions 90° for tighter packing." (D-01d) — final copy is planner's call but should preserve the intent.
- **Oversize-region abort error string is locked** in SPEC.md REPACK-10: `"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."` — preserve verbatim in the OptimizeDialog toast.
- **CI must stay loud on baseline mismatch.** Neither `npm run repack:refresh-baselines` nor `UPDATE_FIXTURES=1` runs in CI per D-07. If CI fails, the dev intentionally bumped a dep and must rerun the refresh script locally and commit.

</specifics>

<deferred>
## Deferred Ideas

- **Pack-plan preview in AtlasPreviewModal** — D-02 explicitly defers this. Future phase could wire AtlasPreviewModal to render the planned output pack (using `core/repack.ts`) when atlas/both is selected. Out of Phase 40 scope.
- **`ExportOptions` refactor (IPC)** — D-04 keeps positional-arg precedent; refactoring `export:start` to a single options object is a worthwhile cleanup but belongs in its own hygiene phase, not Phase 40 scope.
- **Multi-output-folder selection** — SPEC.md out-of-scope. Atlas + page PNGs always go to the same root as loose output.
- **Atlas filter / format / repeat exposed as `.stmproj` fields** — SPEC.md out-of-scope. Emitted as constants (`Linear,Linear`, `RGBA8888`, `repeat: none`).

### Reviewed Todos (not folded)
None — `gsd-sdk query todo.match-phase 40` returned zero matches.

</deferred>

---

*Phase: 40-atlas-repack-output*
*Context gathered: 2026-05-14*
