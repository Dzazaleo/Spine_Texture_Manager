# Phase 24: Panel semantics — Unused Assets rewrite + atlas-savings metric - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Rewrite the Unused Assets detector so it reports physically orphaned image files (PNGs in `images/` that the rig does not reference), extract the Unused Assets section from GlobalMaxRenderPanel into its own standalone panel, replace the misleading MB savings callout with a real pixel-area savings % chip in the GlobalMaxRenderPanel header, and update the AtlasNotFoundError message to mention the Images Folder toggle.

**In scope:**
- PANEL-01: Orphaned PNG detection — images-folder-vs-rig delta (not atlas-vs-JSON delta)
- PANEL-02: Standalone collapsible Unused Assets sibling panel; hidden when 0 orphans, expanded when N > 0
- OPT-03: Pixel-area savings % chip in GlobalMaxRenderPanel header (replacing MB callout)
- PANEL-04: AtlasNotFoundError message updated to mention "Use Images Folder as Source" toggle

**Out of scope:**
- "Not Exported" section (attachments in rig but no image) — undecidable in atlas-less mode; deferred
- "Never rendered" attachments (old `findUnusedAttachments` semantics) — replaced entirely
- Phase 25 scope (missing-attachment in-context display in main panels)
- Any changes to the export pipeline, ConflictDialog, or override system

</domain>

<decisions>
## Implementation Decisions

### Orphaned file detection — PANEL-01 (LOCKED 2026-05-04)
- **D-01: "Unused" redefined as physically orphaned.** An image file is orphaned when it exists on disk but the rig has NO attachment referencing it. An image referenced in setup pose (but not in any animation) is NOT orphaned — if the rig has an attachment for it, it is used. The old `findUnusedAttachments` behavior (atlas-vs-JSON region delta + "never rendered in animations" filter) is **removed entirely** and replaced by this file-system-vs-rig comparison.

- **D-02: Detection algorithm.** Three steps:
  1. Read `images/` folder → collect PNG filenames, strip `.png` extension
  2. Build "in-use" name set (depends on mode):
     - **Atlas-mode**: union of `load.atlas.regions[*].name` (only textured, exported things)
     - **Atlas-less mode**: union of textured attachment names from `load.skeletonData.skins[*].attachments`, using `load.sourceDims` presence as the non-textured filter (same proxy as the old `findUnusedAttachments:112` — attachments with no `sourceDims` entry are BoundingBox/Path/Clipping/Point and are excluded)
  3. Orphaned = PNG filenames NOT in the in-use set

- **D-03: Both atlas-mode and atlas-less mode supported.** Scan `images/` when it exists, regardless of project mode:
  - Atlas-mode with `images/`: catches PNGs manually added to `images/` that were never included in the atlas (compare filenames vs atlas region names)
  - Atlas-less mode: compare filenames vs rig attachment names (textured only)
  - No `images/` folder → 0 orphaned files → panel hidden

- **D-04: No "Not Exported" section.** The Spine JSON alone cannot distinguish "deliberately unchecked in Spine editor export" from "PNG was accidentally deleted." The `.atlas` file is the manifest that makes this distinction possible (atlas region present = expected; not in atlas = not exported), but in atlas-less mode there is no atlas. Decision: show only physically present orphaned files. Attachments in the rig with no image are not surfaced in this panel.

- **D-05: Layer-3 invariant preserved.** The orphan detection logic is split:
  - **Pure helper** in `src/core/usage.ts` (new function, replaces `findUnusedAttachments`): takes `(imagesFolderFiles: string[], inUseNames: Set<string>)` → returns `string[]` of orphaned basenames. Zero I/O, zero DOM.
  - **I/O layer** in `src/main/summary.ts`: reads `images/` dir via `fs.readdirSync`, builds the in-use Set from `load.atlas` or `load.skeletonData`, calls the pure helper, augments each orphaned filename with `fs.statSync` for bytes-on-disk.

### Unused Assets panel behavior — PANEL-02 (LOCKED 2026-05-04)
- **D-06: Hidden when 0, expanded when N > 0.** When `orphanedFiles.length === 0`, the panel is **not rendered at all** — no empty/collapsed state. When one or more orphaned files are detected, the panel renders expanded by default. "Collapsed by default when empty" in PANEL-02 is interpreted as "not rendered when empty."

- **D-07: Panel position.** Global Max Render Source → **Unused Assets** → Animation Breakdown. Rationale: "what renders at peak scale" → "what's dead weight on disk" → "per-animation detail."

### OPT-03 — Atlas savings metric (LOCKED 2026-05-04)
- **D-08: Pixel-area savings % replaces MB callout.** The old "X MB potential savings" callout in the Unused Assets section header is removed. In its place, a right-aligned chip/badge is added to the **GlobalMaxRenderPanel section header** showing the pixel-area savings %.

- **D-09: Data source.** `savingsPctMemo` already computed in `AppShell.tsx:702-712` via `buildExportPlan(effectiveSummary, overrides)`. Thread it to `GlobalMaxRenderPanel` as a new prop `savingsPct?: number | null`. When `null` (empty plan, no attachments), the chip is not rendered.

- **D-10: Semantics.** The chip answers: "If you run Optimize Assets now, the *used* attachment images shrink by X% total pixel area." Orphaned files are NOT counted — they have no peak entry, no export plan row, and are not copied during export. The chip is purely about the rig's used attachments.

- **D-11: Orphaned files metric in Unused Assets panel header.** The panel header shows the count of orphaned files ("N orphaned files"). File size total (bytes) shown alongside the count in the header (via `formatBytes`). This replaces the old MB callout with a count+bytes that is semantically honest: it's disk cleanup info, not optimization savings.

### AtlasNotFoundError — PANEL-04 (LOCKED 2026-05-04)
- **D-12: Message update only.** Add one sentence to `src/core/errors.ts:44-48` mentioning "Use Images Folder as Source" toggle as an alternative recovery path. No class/field/name changes — only the human-readable `super(...)` string gains a third line. Existing tests that assert on class name, `searchedPath`, and `skeletonPath` fields pass unchanged.

### Claude's Discretion
- **Orphaned file table columns:** Filename (basename, no `.png` extension), file size on disk (`formatBytes`). No "Defined In" column (the file is not in the rig at all). Search filter consistent with other panels (substring match on filename).
- **IPC type rename:** `SkeletonSummary.unusedAttachments?: UnusedAttachment[]` → `orphanedFiles?: OrphanedFile[]` (new minimal type: `{ filename: string; bytesOnDisk: number }`). `UnusedAttachment` type and `findUnusedAttachments` are removed. All consumers of `unusedAttachments` (GlobalMaxRenderPanel renderer, summary.ts writer) are updated.
- **`savingsPct` chip hidden when null:** No "0.0%" shown — chip is simply absent when `savingsPctMemo` returns null.
- **Atlas-less mode `skippedAttachments` interaction:** Orphaned files (files in `images/` with no rig attachment) are SEPARATE from `skippedAttachments` (rig attachments with no PNG). They do not overlap and are not de-duplicated — they represent opposite directions of the file-vs-rig delta.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 24 Source Documents
- `.planning/ROADMAP.md §Phase 24` — official scope, 4 success criteria, dependency on Phase 21 + 23
- `.planning/REQUIREMENTS.md` PANEL-01, PANEL-02, OPT-03, PANEL-04 — normative requirement text

### Core logic to replace
- `src/core/usage.ts` — entire `findUnusedAttachments` function (lines 76–end) is replaced by a new `findOrphanedFiles(imagesFolderFiles: string[], inUseNames: Set<string>): string[]` pure helper
- `src/core/errors.ts:27-51` — `AtlasNotFoundError` constructor; add toggle tip at lines 44-48

### Main-process I/O layer
- `src/main/summary.ts:137-157` — `findUnusedAttachments` call site + `bytesOnDisk` augmentation; entirely rewritten for orphan detection with `fs.readdirSync` + `fs.statSync`

### Renderer panels
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:648-687` — `unusedAttachments` / `unusedNameSet` / `aggregateBytes` / `filteredUnused` memos: all removed
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:856-907` — unused section JSX block: entirely removed; replaced by `savingsPct` chip in section header
- A new `src/renderer/src/panels/UnusedAssetsPanel.tsx` (or equivalent) is created for the extracted standalone panel

### AppShell threading
- `src/renderer/src/components/AppShell.tsx:702-712` — `savingsPctMemo`: already computed; add as prop to `<GlobalMaxRenderPanel savingsPct={savingsPctMemo} />`
- `src/renderer/src/components/AppShell.tsx` — add `<UnusedAssetsPanel orphanedFiles={summary.orphanedFiles ?? []} />` between GlobalMaxRenderPanel and AnimationBreakdownPanel in the render tree

### Types
- `src/shared/types.ts:203` — `UnusedAttachment` interface: removed/replaced by `OrphanedFile { filename: string; bytesOnDisk: number }`
- `src/shared/types.ts:590` — `SkeletonSummary.unusedAttachments?: UnusedAttachment[]`: renamed to `orphanedFiles?: OrphanedFile[]`

### Locked Invariants
- **CLAUDE.md fact #5** (`core/` is pure TypeScript, no DOM, no I/O) — `findOrphanedFiles` in `src/core/usage.ts` takes its file list as a parameter; `fs.readdirSync` stays in `src/main/summary.ts`
- **Phase 6 D-110** (uniform-only export scaling) — not touched by Phase 24
- **Memory `project_layout_fragility_root_min_h_screen.md`** — AppShell `min-h-screen` invariant unchanged; new panel inserted between existing panels with no layout changes to the root
- **Phase 21 `skippedAttachments`** — unchanged; `MissingAttachmentsPanel` continues to surface rig attachments whose PNGs were not found at load time; orphaned files (D-01) are a separate concept and separate IPC field

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `formatBytes` at `src/renderer/src/lib/format-bytes.ts` — already used in GlobalMaxRenderPanel for the `aggregateBytes` callout; reuse in UnusedAssetsPanel header for total orphaned bytes
- `savingsPctMemo` at `AppShell.tsx:702-712` — already wired to DocumentationBuilderDialog via `exportPlanSavingsPct` prop; thread same value to GlobalMaxRenderPanel
- `MissingAttachmentsPanel.tsx` — closest structural analog for the new `UnusedAssetsPanel`; same collapsible-panel pattern, same danger-accent header style
- `GlobalMaxRenderPanel.tsx:862-907` (unused section JSX) — the table + search pattern is the starting point for the UnusedAssetsPanel table

### Established Patterns
- **5-modal ARIA scaffold / hand-rolled panels** — UnusedAssetsPanel follows the established collapsible-section pattern in the main panels (no new pattern needed)
- **`?? []` null-coalesce on optional IPC fields** — `orphanedFiles?: OrphanedFile[]` is optional (same as `unusedAttachments?`); renderer must coalesce before `.length` and `.map`
- **`fs.statSync` in summary.ts** — Phase 19 (Plan 19-01) established the pattern of augmenting core output with `bytesOnDisk` via `fs.statSync` in `summary.ts`; Phase 24 reuses this pattern for orphaned files

### Integration Points
- `AppShell.tsx` render tree between `<GlobalMaxRenderPanel>` and `<AnimationBreakdownPanel>` — insert `<UnusedAssetsPanel orphanedFiles={summary.orphanedFiles ?? []} />`
- `AppShell.tsx:<GlobalMaxRenderPanel>` — add `savingsPct={savingsPctMemo}` prop
- `src/main/summary.ts:buildSummary` return value — replace `unusedAttachments` field with `orphanedFiles`
- `src/core/usage.ts` — replace exported `findUnusedAttachments` with `findOrphanedFiles`; all import sites update automatically (only `src/main/summary.ts` imports it)

### Files Not Touched
- `src/core/sampler.ts`, `src/core/loader.ts`, `src/core/export.ts` — Phase 24 is purely a panel + summary rewrite
- `src/renderer/src/panels/MissingAttachmentsPanel.tsx` — unchanged; `skippedAttachments` concept is separate
- `src/renderer/src/modals/OptimizeDialog.tsx` — already has `savingsPct` (lines 309-355); no changes needed
- `src/main/ipc.ts`, `src/preload/index.ts` — IPC channel shape is the same; only the `SkeletonSummary` payload field name changes (`unusedAttachments` → `orphanedFiles`)

</code_context>

<specifics>
## Specific Ideas

- **"Unused" = file on disk the rig doesn't reference.** The user's mental model: orphaned files are wasteful because they take disk space and potentially memory, but the optimizer ignores them entirely. The Unused Assets panel is a cleanup aid, not an optimization metric.
- **Orphaned files vs optimization savings are independent metrics.** The savings % chip in GlobalMaxRenderPanel is about the rig's used attachments only. Orphaned files are not counted toward savings and are not copied during export. The panel communicates this separation clearly.
- **Atlas-as-manifest insight.** The `.atlas` file is the authority on what was exported. Without it (true atlas-less mode), you cannot tell "deliberately not exported" from "accidentally deleted." This design correctly avoids surfacing a "Not Exported" section that would be unreliable in atlas-less mode.
- **Detection runs in both modes when `images/` exists.** The user specifically called out the atlas-mode edge case (PNG manually added to `images/` that was never in the atlas). Both modes use the same images-folder-scan approach; only the name authority differs.

</specifics>

<deferred>
## Deferred Ideas

- **Atlas-unused-region detection** — an atlas page region that no rig attachment references. User noted this is very unlikely in practice ("having an unused image in an exported atlas is very unlikely"). Not in Phase 24.
- **"Not Exported" greyed section** — rig attachments with no physical image (deliberately unchecked in Spine editor). Technically feasible in atlas-mode (atlas = manifest; not-in-atlas = not exported). Deferred because: (1) undecidable in atlas-less mode, (2) user confirmed "Only Missing Images matter" for Phase 24.
- **Orphaned file deletion affordance** — a "Delete all orphaned" or per-row delete button in the UnusedAssetsPanel. Not requested; future UX enhancement.

### Reviewed Todos (not folded)
- `2026-04-24-phase-4-code-review-follow-up.md` — Phase 4 panel code quality carry-forwards (QA-01..QA-04). Assigned to Phase 27. Unrelated to Phase 24 panel semantics.
- `2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — Phase 20 cross-platform DnD UAT; host-blocked; unrelated to Phase 24.

</deferred>

---

*Phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric*
*Context gathered: 2026-05-04*
