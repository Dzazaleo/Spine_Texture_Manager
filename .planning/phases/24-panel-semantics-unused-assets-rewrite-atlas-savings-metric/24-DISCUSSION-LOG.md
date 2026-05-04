# Phase 24: Panel semantics — Unused Assets rewrite + atlas-savings metric - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
**Areas discussed:** Atlas-mode behavior, OPT-03 metric, Panel ordering

---

## Atlas-mode behavior

### Q1: Should the panel scan images/ in atlas-mode too (when images/ exists)?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — scan images/ in both modes | Compare filenames vs atlas region names in atlas-mode; catches PNGs added manually that were never in the atlas | ✓ |
| Atlas-less only | Simpler; only meaningful in atlas-less mode | |

**User's choice:** Yes — both modes
**Notes:** User raised edge case: "what if an image is missing from the atlas?" This led to the decision to scan `images/` regardless of mode. Atlas-mode uses atlas region names as the in-use authority.

---

### Q2: When images/ doesn't exist, what does the panel do?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide entirely | No folder = nothing to scan = no panel | ✓ (implicit) |
| Show collapsed with empty state | Always present as a sibling with 0 count | |

**User's choice:** "If no unused assets are detected, Unused panel must be collapsed."
**Notes:** Interpreted as: panel hidden when 0 orphaned files. User later explicitly confirmed hiding entirely when 0.

---

### Q3 (chat mode): Should we differentiate deliberately unexported vs orphaned?

**User's question:** Can the JSON distinguish attachments that were deliberately unchecked in the Spine editor export from ones that are actually missing?

**Discussion summary:**
- User wanted to show two sections: (a) files physically present but unused — prominent; (b) attachments in rig but not exported — greyed out
- Analysis revealed: the JSON alone cannot make this distinction. The `.atlas` file is the manifest (atlas region present = exported; not in atlas = not exported). In atlas-less mode (no atlas), all missing images look identical.
- User's company tool works because it uses the atlas as the manifest even in "unpack images" mode.
- **Decision:** Skip "Not Exported" section entirely. "Only Missing Images matter."

---

### Q4: "Unused" semantic clarification (chat mode)

**User's clarification:** "Unused is an image that never touches the rig, but exists in the images folder or in the atlas anyway."

This redefined "unused" from the old `findUnusedAttachments` semantics (atlas-vs-JSON delta, "never rendered in animations") to the new orphan definition (physical file with no rig attachment reference).

Key point: **An attachment visible only in setup pose is NOT unused.** If the rig has an attachment for it, the file is used.

---

## OPT-03 metric

### Q1: What should the new savings metric show?

| Option | Description | Selected |
|--------|-------------|----------|
| Pixel-area savings % | Same formula as OptimizeDialog's savingsPct; from AppShell's existing savingsPctMemo | ✓ |
| Orphaned PNG count + bytes | Count + disk bytes of orphaned files; simple, relevant to the Unused Assets panel | |
| Just the count | No bytes, no savings framing | |

**User's choice:** Pixel-area savings % (Recommended)
**Notes:** User confirmed "Both on Global and OptimizeDialog" — wants it shown in the GlobalMaxRenderPanel header AND already present in OptimizeDialog.

---

### Q2: Where should the savings % live in GlobalMaxRenderPanel?

| Option | Description | Selected |
|--------|-------------|----------|
| Panel header chip | Right-aligned chip/badge in the section title bar | ✓ |
| Summary row above the table | One-line row between header and table | |

**User's choice:** Panel header chip (Recommended)

---

### Q3 (chat mode): Do orphaned files count toward the savings %?

**User's question:** If the app ignores orphaned files on export, does that affect the %?

**Answer provided:** No. Orphaned files have no peak entry, no export plan row, and are not copied during export. The savings % is computed from `buildExportPlan` which only processes rig-referenced attachments. The two metrics are independent:
- Savings % chip = optimization gain on the rig
- Unused Assets panel = disk cleanup for orphaned files

---

## Panel ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Global → Unused Assets → Animation Breakdown | Orphaned files secondary to peaks but more important than per-animation detail | ✓ |
| Global → Animation Breakdown → Unused Assets | Animation Breakdown stays adjacent to Global; Unused at bottom | |

**User's choice:** Global → Unused Assets → Animation Breakdown (Recommended)

---

### Q (post-discussion): Should we hide the panel entirely when 0 orphaned files?

**User's question:** "If there aren't any unused assets detected, should we hide that panel?"

**Decision:** Yes — hide entirely when 0. No visual noise for clean projects. Panel appears dynamically when orphans are detected.

---

## Claude's Discretion

- Orphaned file table columns: Filename, file size (via `formatBytes`). No "Defined In" column.
- IPC type rename: `unusedAttachments?: UnusedAttachment[]` → `orphanedFiles?: OrphanedFile[]`
- `savingsPct` chip hidden (not shown as 0%) when `savingsPctMemo` returns null
- Non-textured attachment filter: use `load.sourceDims` presence as proxy (same as old `findUnusedAttachments:112`)

## Deferred Ideas

- **Atlas-unused-region detection:** Atlas region that no rig attachment references. User: "very unlikely to happen." Deferred.
- **"Not Exported" greyed section:** Rig attachments with no image. Technically possible in atlas-mode. Deferred — user confirmed "Only Missing Images matter."
- **Orphaned file deletion affordance:** Delete button in the panel. Not requested.
