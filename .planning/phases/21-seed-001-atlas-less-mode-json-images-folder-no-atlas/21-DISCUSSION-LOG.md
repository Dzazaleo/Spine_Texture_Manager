# Phase 21: SEED-001 atlas-less mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 21-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
**Areas discussed:** Region inventory source, atlasPath shape, Missing-PNG semantics, Detection trigger + .stmproj persistence, Atlas+images-both-present priority + override (added mid-discussion)

---

## Region Inventory Source

| Option | Description | Selected |
|--------|-------------|----------|
| JSON-driven | Walk skeletonData.skins[*].attachments; synthesize one region per referenced attachment name. Orphan PNGs in images/ are NOT atlas regions. | ✓ |
| Folder-driven | Walk images/**/*.png; synthesize a region for every PNG. Mirrors how a packed atlas can carry unreferenced regions. | |
| Hybrid | JSON-driven atlas + LoadResult.unreferencedImagePaths field for Phase 999.6 to consume. | |

**User's choice:** JSON-driven (Recommended).
**Notes:** User asked for plain-English explanation before locking. Rationale recap: keeps Phase 21 focused on "make loader work without .atlas"; orphan-detection is a different feature with its own UI surface (Phase 999.6), which can do its own dedicated images/-vs-JSON scan; less I/O during load.

---

## Subfolder-Nested Region Names

| Option | Description | Selected |
|--------|-------------|----------|
| Support nested paths | Region name carries slash-delimited path; synthesizer reads images/<region.name>.png recursively. Mirrors loader.ts:260 convention. | ✓ |
| Top-level only | Only PNG files directly in images/. Subfolder names error out. | |
| You decide | Whatever is consistent with existing loader convention. | |

**User's choice:** Support nested paths.

---

## LoadResult.atlasPath Shape

| Option | Description | Selected |
|--------|-------------|----------|
| string \| null | atlasPath = null in atlas-less mode. ProjectFileV1 already permits null per project-io.ts:840. | ✓ |
| Add atlasMode discriminator | atlasMode: 'packed' \| 'synthesized' alongside atlasPath. More type-safe but adds a field to thread through summary, renderer, .stmproj. | |
| Synthetic sentinel string | atlasPath = '<imagesDir>/<synthesized>'. Avoids type changes but bug-prone (consumers expect a real readable file). | |

**User's choice:** string | null (Recommended).

---

## Missing-PNG Semantics (revised after user question)

**Initial proposal (rejected):** New typed error MissingRegionPngError thrown when any JSON-referenced PNG is missing.

**User question:** "If the user unchecks Export option from an attachment in the spine editor (meaning he doesn't need that image in the exported project), that texture won't be flagged as missing, correct?"

**Reconciliation:** The initial proposal would regress a real artist workflow. Spine's "Export" checkbox legitimately strips per-region PNGs in the canonical .json + .atlas flow (atlas doesn't contain that region; AtlasAttachmentLoader returns null; attachment becomes invisible at render; Phase 19 UI-02 surfaces it as "unused attachment" with no error). Atlas-less mode must mirror this behavior or it punishes a deliberate choice.

| Option | Description | Selected |
|--------|-------------|----------|
| Per-region: silent skip; Catastrophic: typed error (MissingImagesDirError) | JSON-referenced PNG missing → skip the region; spine-core returns null for the attachment (canonical-Export-excluded path). Catastrophic case (images/ missing or empty AND JSON references >0 regions) → throw new MissingImagesDirError. | ✓ |
| Per-region: silent skip; Catastrophic: reuse AtlasNotFoundError | Same per-region behavior, but reuse AtlasNotFoundError for catastrophic. Confusing message. | |
| Per-region: warn-and-skip with visible log | Silent skip + new LoadResult.atlasLessSkipped[] field. Probably duplicates Phase 19 UI-02. | |

**User's choice:** Per-region: silent skip; Catastrophic: typed error (Recommended).

---

## Error List Format (Catastrophic Case)

| Option | Description | Selected |
|--------|-------------|----------|
| List all missing | Multi-line message listing every missing PNG. Better UX when several files are missing. | ✓ |
| Fail at first missing | Throw on first missing PNG. Faster but worse UX. | |

**User's choice:** List all missing.

---

## Detection Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect: missing sibling .atlas | Reuse existing failure point at loader.ts:189-193 — atlas unreadable → fall through to synthesis. Zero new flags. | ✓ |
| Explicit LoaderOptions.mode flag | opts.mode?: 'auto' \| 'packed' \| 'atlas-less'. Caller chooses. | |
| Auto-detect + persisted mode flag in .stmproj | Auto-detect on first load + write mode field for unambiguous re-open. | |

**User's choice:** Auto-detect: missing sibling .atlas (Recommended).

---

## Explicit-atlasPath Strict vs Forgiving

| Option | Description | Selected |
|--------|-------------|----------|
| Strict: throw AtlasNotFoundError | When opts.atlasPath is explicitly named but unreadable, throw. Atlas-less only triggers when nobody named an atlas. Honors ROADMAP success criterion #5. | ✓ |
| Forgiving: fall through to atlas-less | Try synthesis even when explicit atlas path is missing. Silently does something different than asked. | |

**User's choice:** Strict (Recommended). User initially asked "Explain in plain english what you're asking" and the question was re-posed with concrete decision rules.

---

## Atlas + images/ Both Present (added mid-discussion per user question)

**User question:** "What happens when the user has atlas and images folder both in the same location with the json? What gets priority? The atlas? What if the user wants to test with images folder instead, while keeping the atlas present in the folder? He should be able to choose what is the source."

| Option | Description | Selected |
|--------|-------------|----------|
| Atlas-by-default + user-overridable | Atlas wins by default (current behavior, no canonical-flow regression). Per-project loaderMode override forces atlas-less even when atlas is present. Persisted in .stmproj. | ✓ |
| Atlas-by-default, no override | Atlas wins. No way to force atlas-less. Cleanest implementation. | |
| Auto-detect by recency | Compare mtime of .atlas vs newest PNG. Risky heuristic. | |

**User's choice:** Atlas-by-default + user-overridable (Recommended).

---

## Override UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Per-project toggle in .stmproj | loaderMode: 'auto' \| 'atlas-less' field in ProjectFileV1. Surfaced via menu item or Project Settings inline checkbox. Persists across reload, scoped to project. | ✓ |
| Global app setting | Settings dialog: "Prefer images folder over atlas when both present". Applies globally. Bad fit for project-specific decisions. | |
| Defer the UI | Implement LoaderOptions.mode + .stmproj field, no UI yet. | |

**User's choice:** Per-project toggle in .stmproj (Recommended).

---

## Phase 21 vs Phase 22 Scoping (added mid-discussion per user question)

**User question:** Pre-reduced source images (manually scaled in Photoshop or via Spine editor's global-scale export option) — how does the app handle max render scale calculation? Spine 3.8 with "Nonessential data" checked stored original dims in JSON; does 4.2 work the same? If images folder and canonical dims differ, a badge should appear.

**Reconciliation:** This is exactly Phase 22 (SEED-002, dims-badge + override-cap). Phase 22's DIMS-02 specifies the badge + tooltip; DIMS-03 specifies the export-cap math. The seed authors explicitly sequenced 21 → 22 on 2026-04-25 with "do not bundle, do not invert" because Phase 22 cannot exist without Phase 21's png-header.ts, but Phase 21 alone supplies the plumbing without exposing dim-drift to the user. Bundling would inflate Phase 21 ~2-3× and entangle two distinct concerns.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate — 21 plumbing, 22 consumer | Phase 21 = png-header.ts + synthetic-atlas.ts + loader path + atlas-less round-trip. Phase 22 = DisplayRow drift fields + badge UI + export-cap math + already-optimized exclusion. Original SEED authors' intent. | ✓ |
| Bundle 21+22 into one phase | Land plumbing + consumer together. Phase ~2-3× larger; risks scope creep into 999.4/999.6. | |

**User's choice:** Keep separate (Recommended).

---

## Claude's Discretion

- Exact placement of `loaderMode` toggle UI (menu vs inline checkbox vs Project Settings panel) — pick consistent with existing patterns.
- Synthetic atlas construction approach (text-based vs direct object) — recommend text-based; planner spikes if pushback.
- `MissingImagesDirError` message format (single multi-line vs structured list field) — planner picks consistent with AtlasParseError shape.

## Deferred Ideas

- **Dim-drift badge + export-cap math** — Phase 22 (SEED-002). Already roadmapped.
- **Orphan-PNG detection** — Phase 999.6.
- **Atlas-savings report inside OptimizeDialog** — Phase 999.4.
- **Recency-based auto-detection** — rejected (mtime fidelity issues across OSes/copies).

## Spine 4.2 Research Item Surfaced

Spine 3.8 with "Nonessential data" checked stored original region dims in JSON. Does 4.2 do the same? If yes, atlas-less mode can detect canonical-vs-actual drift even without a packed atlas; if no, drift detection requires explicit user input. **This is a Phase 22 concern, but the Phase 21 planner should answer it so Phase 22 starts on firm ground.**
