# Phase 29: Per-region dedup + override-region semantics + atlas-preview pack-page accuracy — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 29-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 29-per-region-dedup-override-region-semantics-atlas-preview-pac
**Areas discussed:** Data shape, Override migration, Atlas Preview UX, Drill-down surface

---

## Data shape (4 questions)

### Q1: How should summary.peaks vs the new region-deduped view be exposed across the IPC boundary?

| Option | Description | Selected |
|--------|-------------|----------|
| Add summary.regions alongside peaks | summary.peaks stays per-attachment unchanged; NEW summary.regions: RegionRow[] = one entry per regionName with peakScale=max across contributors, winnerAttachmentName, contributingAttachments[]. Cost: ~2x lightweight rows on IPC for path-indirected projects. | ✓ |
| Replace peaks with region-deduped DisplayRow[] | analyze() returns 1 entry per region; per-attachment detail moves into contributingAttachments[]. CLI output changes for path-indirected projects. AnimationBreakdownPanel rewires. 8+ call sites all migrate at once. | |
| Keep peaks per-attachment; consumers fold themselves | summary.peaks unchanged. Each consumer calls a shared dedupByRegion(peaks) helper at render time. Risk: dedup logic in 2+ places; 8+ call sites still keyed on attachmentName may quietly become wrong under path indirection. | |

**User's choice:** Add summary.regions alongside peaks (Recommended)

### Q2: What should contributingAttachments[] on a RegionRow carry for downstream surfaces?

| Option | Description | Selected |
|--------|-------------|----------|
| Full per-attachment detail per name | Each entry: { attachmentName, skinName, slotName, peakScale, animationName, time, frame, isSetupPosePeak }. Powers REGION-05 attribution + lets Atlas Preview popover render breakdown without crossing IPC for second lookup. | ✓ |
| Just the names list + winner pointer | RegionRow has contributingAttachments: string[] + winnerAttachmentName: string. UI re-derives the rest from summary.peaks via name lookup. Smaller payload. | |
| Names + peakScale per name only | Middle ground: { attachmentName, peakScale } per entry. Animation/frame attribution still requires a peaks lookup. | |

**User's choice:** Full per-attachment detail per name (Recommended)

### Q3: AtlasPreviewInput + PackedRegion currently key on attachmentName. Under per-region dedup, what's the cleanest shape?

| Option | Description | Selected |
|--------|-------------|----------|
| regionName + attachmentNames[] on both | AtlasPreviewInput.regionName replaces attachmentName; AtlasPreviewInput.attachmentNames: string[] carries every attachment that resolves to this region. Click hit-test reads packed.regionName + packed.attachmentNames[] for popover/drill-down. | ✓ |
| Keep attachmentName as primary, add regionName + attachmentNames[] | Backward-compatible field add. Risk: ambiguous semantics; field outlives its purpose. | |
| regionName only; renderer indexes contributingAttachments[] from RegionRow | Smaller IPC payload but couples preview view to summary.regions in renderer. | |

**User's choice:** regionName + attachmentNames[] on both (Recommended)

### Q4: Override storage today is overrides: Map<string, number> keyed by attachmentName. Under per-region semantics, how should it be keyed in memory + on disk?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-key as Map<regionName, number> in memory and on disk | Single source of truth. AppShell + project-io both speak regionName. .stmproj v1 schema: overrides field shape unchanged but keys now mean regionName. | ✓ |
| Keep attachmentName-keyed in memory, region-keyed on disk | Two translation layers + 'which attachmentName wins' rule on collision. Brittle. | |
| Keep attachmentName everywhere; broadcast to siblings at export-build time | buildExportPlan walks contributingAttachments[]. Round-trip identity muddied; OverrideDialog UX still picks one attachmentName as canonical. | |

**User's choice:** Re-key as Map<regionName, number> in memory and on disk (Recommended)

---

## Override migration (2 questions)

### Q5: When a v1.3-era .stmproj loads with override keys that don't equal a regionName (path-indirected case), what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Silent migration with deterministic collision rule | On load: re-key to regionName. Collision rule = lex-smallest contributing attachmentName wins. Orphan keys dropped. Round-trip identity preserved on save. No user-facing UI. | ✓ |
| Silent migration + one-time toast on first load | Same migration logic + non-blocking toast on first load. Toast dismisses on click. | |
| Migrate non-conflicts silently; dialog for collisions | Blocking dialog listing each collision pair with per-pair pick. Heavyweight UX for rare case. | |
| Drop all path-indirected overrides; toast user to re-set | Drop overrides whose key is an attachmentName ≠ regionName + one-time toast. Aggressive but accurate. | |

**User's choice:** Silent migration with deterministic collision rule (Recommended)

### Q6: Where in the load pipeline should the migration run, and does it surface a notice?

| Option | Description | Selected |
|--------|-------------|----------|
| project-io.ts seam, mirroring D-150 + extend banner | Migration runs main-side at every load (lines 526, 802, 999). Renderer receives already-migrated Map. Project NOT marked dirty. Extend stale-override banner with migration count. | ✓ |
| project-io.ts seam, fully silent (no banner) | Same migration locus, no UI notice. Zero extra UX surface. | |
| Renderer-side migration on materialize | Migration in AppShell on initialProject hydration. Diverges from D-150 precedent; resample / mountOpenResponse / locate-skeleton-recovery each have their own materialize path. | |

**User's choice:** project-io.ts seam, mirroring D-150 + extend banner (Recommended)

---

## Atlas Preview UX (1 question)

### Q7: Under the new per-region tiles, what's the click/hover behavior?

| Option | Description | Selected |
|--------|-------------|----------|
| Hover tooltip = name + count; dblclick jumps to region row | Hover shows '{regionName}.png · used by N attachments' (compact). Dblclick retargets onJumpToAttachment → onJumpToRegion(regionName). Per-attachment detail surfaces in Global panel drill-down. | ✓ |
| Hover tooltip lists every contributor with per-attachment peak | Hover popover expands to show full contributingAttachments[] inline. Tooltip can grow tall on edge cases. | |
| Single-click pins a popover; dblclick jumps | Click pins a popover next to tile listing contributors. Dblclick still jumps. Introduces a brand-new modal-within-modal pattern. | |

**User's choice:** Hover tooltip = name + count; dblclick jumps to region row (Recommended)

---

## Drill-down surface (2 questions)

### Q8: How should per-attachment detail surface for region rows that aggregate multiple contributors?

| Option | Description | Selected |
|--------|-------------|----------|
| Global row badge + hover tooltip; AnimationBreakdownPanel unchanged | Subtle '(used by N attachments)' indicator when contributingAttachments.length > 1. Hover reveals tooltip listing each contributor with per-attachment peak. AnimationBreakdownPanel stays per-attachment. | ✓ |
| Expandable Global rows + chevron | Each Global row gains chevron expand; sub-table of contributingAttachments[] with per-attachment peakScale + animation + frame. Introduces new expand/collapse pattern + state management. | |
| Minimal: rely on AnimationBreakdownPanel only | Global row shows '(used by N attachments)' subtext only. To see per-attachment names + peaks, switch to Animation Breakdown tab. AnimationBreakdownPanel doesn't currently filter by region. | |

**User's choice:** Global row badge + hover tooltip; AnimationBreakdownPanel unchanged (Recommended)

### Q9: AnimationBreakdownPanel today dedups per-card by attachmentName. Path-indirected projects will show 'duplicate-looking' rows within a card. Keep the per-card contract as-is, or also switch to per-region?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep per-card per-attachment dedup as today | AnimationBreakdownPanel stays attachmentName-deduped. The 4-surface invariant applies to four user-named surfaces (Global / Atlas Preview / Optimize / exported folder). AnimationBreakdownPanel is the explicit drill-down. Satisfies REGION-06 cleanly with zero panel changes. | ✓ |
| Switch per-card to per-region dedup, with sub-row contributors | Each animation card lists region rows; per-attachment contributors fold under a region row. Panel rewrite. | |
| Add a per-card view toggle (per-attachment / per-region) | User picks per-card display mode at panel header. Persists yet another piece of UI state. | |

**User's choice:** Keep per-card per-attachment dedup as today (Recommended)

---

## Claude's Discretion

- Exact copy for the Global row `(used by N attachments)` indicator — Phase 26.1/26.2 visual-polish system reference.
- Exact copy for the migration banner — `"Updated N overrides to per-region keys"` is a draft.
- Stripped Chicken fixture stripping strategy — 1×1 vs 16×16 stub PNGs vs JSON+atlas only with no PNGs (atlas-source-mode tests). Pick smallest that exercises path-indirection across analyzer + atlas-preview + export. Target <1MB.
- OptimizeDialog "used by N attachments" annotation on the file row — fold into this phase or defer to v1.4 polish.
- `onJumpToRegion` prop wiring — replace `onJumpToAttachment` outright or run alongside (deprecation path).
- Whether `RegionRow` is a new top-level interface or a structural variant of `DisplayRow`.

## Deferred Ideas

- OptimizeDialog "used by N attachments" annotation (folded into Claude's Discretion).
- Click-pin popover in Atlas Preview tile (rejected; revisit on user-feedback signal).
- Atlas Preview tile expand-on-hover (rejected; revisit on user-feedback signal).
- Expandable Global panel rows (rejected; revisit if badge+tooltip insufficient).
- AnimationBreakdownPanel switch to per-region dedup (rejected; would lose REGION-06 per-attachment detail).
- Per-card view toggle in AnimationBreakdownPanel (rejected; UI-state bloat).
- Schema-version bump for `.stmproj` (explicitly NOT done; key meaning shift only).
- CLI golden output update for path-indirected fixtures (planner audits).
