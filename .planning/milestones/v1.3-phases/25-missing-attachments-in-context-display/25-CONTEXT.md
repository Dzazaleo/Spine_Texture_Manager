# Phase 25: Missing attachments in-context display - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Reverse the Phase 21 Plan 21-10 filter that hides stub-region rows from Global Max Render Source and Animation Breakdown panels. After Phase 25, rows whose source PNG was missing at load time remain visible in both main panels, marked with a red left-border accent and a danger-triangle icon (⚠) beside the attachment name. The dedicated MissingAttachmentsPanel (above Global) continues to show its summary list — in-context red-accent rows are additive, not a replacement.

**In scope:**
- PANEL-03: Missing attachment rows remain visible in Global Max Render Source + Animation Breakdown panels with red left-border accent + ⚠ icon
- Remove filter at `summary.ts:89` (peaks) and `summary.ts:114` (breakdown card rows)
- Add `isMissing?: boolean` field to `DisplayRow` — main process sets it on stub rows
- Add a new `'missing'` RowState variant in `GlobalMaxRenderPanel` + `AnimationBreakdownPanel` to drive the red accent bar + ⚠ icon
- MissingAttachmentsPanel position unchanged (above Global)

**Out of scope:**
- Phase 26 tab-system (captured as separate todo)
- Any changes to the export pipeline for missing-attachment rows
- Changes to MissingAttachmentsPanel behavior or content
- Removing or replacing the MissingAttachmentsPanel

</domain>

<decisions>
## Implementation Decisions

### isMissing marker — where to mark stub rows (LOCKED 2026-05-04)
- **D-01: `isMissing?: boolean` added to `DisplayRow`.** Main process sets `isMissing: true` on stub rows when building `peaksArray` and `animationBreakdown` card rows in `summary.ts`. Both `GlobalMaxRenderPanel` and `AnimationBreakdownPanel` read it directly — no renderer-side name lookup or extra `Set` computation. IPC contract is explicit and type-safe.

### Stub data display (LOCKED 2026-05-04)
- **D-02: Stub data renders as-is; ⚠ + red accent carry the signal.** The 1×1 stub region produces technically real but meaningless scale/dims values. All cells (peakScale, worldW×H, sourceW×H, Peak W×H) render their values normally. No special-case branches per cell. The `⚠` icon beside the attachment name and the red left-border accent communicate "this data is unreliable" without complicating the cell renderers.

### Missing row interactivity (LOCKED 2026-05-04)
- **D-03: Missing rows are fully interactive.** Checkbox and override button both work normally. Overrides on missing-attachment rows persist in the project file — useful when the animator plans to add the PNG later and wants the override pre-set. No special-casing in row click handlers or override dialog invocation.

### MissingAttachmentsPanel position (LOCKED 2026-05-04)
- **D-04: MissingAttachmentsPanel stays exactly where it is.** No position change. The panel (above GlobalMaxRenderPanel) continues to surface the full list of missing attachments + expected PNG paths at a glance — without requiring the animator to scroll through both main panels to discover which rows are affected. In-context red-accent rows are additive.

### Claude's Discretion
- **`'missing'` RowState variant**: Extend `type RowState = 'under' | 'over' | 'unused' | 'neutral'` with `| 'missing'`. The `rowState()` predicate should return `'missing'` before any other check when `isMissing === true`. The left-accent bar uses `bg-danger` (same color as `'unused'`). The ⚠ icon renders beside `attachmentName` in the name cell — use the existing `text-danger` token.
- **Icon choice**: Use a simple Unicode `⚠` character (`text-danger`) beside the attachment name, consistent with the danger-accent idiom already used in `MissingAttachmentsPanel`. No new SVG icon component needed.
- **`AnimationBreakdownPanel` row shape**: `BreakdownRow extends DisplayRow`, so `isMissing` flows through automatically once `DisplayRow` gains the field. The enrichment in `AnimationBreakdownPanel` passes through without changes to the enrichment logic.

### Reviewed Todos (not folded)
- `2026-04-24-phase-4-code-review-follow-up.md` — Phase 4 code quality carry-forwards (QA-01..QA-04). Assigned to Phase 27. Unrelated to Phase 25.
- `2026-05-04-phase-26-tab-system-global-unused-animation.md` — Tab-system redesign for Phase 26. Out of scope for Phase 25; captured as Phase 26 seed.
- `2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` — Phase 20 cross-platform DnD UAT; host-blocked; unrelated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 25 Source Documents
- `.planning/ROADMAP.md §Phase 25` — official scope, 3 success criteria, dependency on Phase 21
- `.planning/REQUIREMENTS.md` PANEL-03 (line ~17) — normative requirement text

### Filter removal sites (both must be modified)
- `src/main/summary.ts:89` — `peaksArray = peaksArrayRaw.filter((p) => !skippedNames.has(p.attachmentName))` — REMOVE this filter; instead mark `isMissing: true` on stub rows
- `src/main/summary.ts:114` — `filteredRows = card.rows.filter((r) => !skippedNames.has(r.attachmentName))` — REMOVE this filter; instead mark `isMissing: true` on stub rows

### Type surface
- `src/shared/types.ts:54` — `DisplayRow` interface: add `isMissing?: boolean` field
- `src/shared/types.ts:158` — `BreakdownRow extends DisplayRow` — gains `isMissing` automatically; no change needed

### Renderer panels (both must handle isMissing)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:167-182` — `RowState` type + `rowState()` predicate: add `'missing'` variant; check `isMissing` first
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:416-432` — row JSX left-accent `<td>`: add `state === 'missing' && 'bg-danger'` branch
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:452` — attachment name cell: render `⚠` icon when `row.isMissing`
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx:162+` — `RowState` type + `rowState()` predicate: same `'missing'` variant + `isMissing` check
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx:655+` — row JSX left-accent + attachment name cell: same treatment as Global panel

### Unchanged (Phase 25 does NOT touch these)
- `src/renderer/src/panels/MissingAttachmentsPanel.tsx` — unchanged; position unchanged; additive
- `src/core/loader.ts`, `src/core/sampler.ts`, `src/core/export.ts` — Layer 3 invariant preserved; Phase 25 is summary.ts + shared types + renderer only
- `src/main/ipc.ts`, `src/preload/index.ts` — IPC channel shape unchanged; `DisplayRow` payload gains one optional boolean field (backward-compatible)

### Locked Invariants
- **CLAUDE.md fact #5** (`core/` is pure TypeScript, no DOM) — all Phase 25 changes in `src/main/summary.ts` + `src/shared/types.ts` + renderer panels; `src/core/` untouched
- **Phase 6 D-110** (uniform-only export scaling) — not touched
- **Memory `project_layout_fragility_root_min_h_screen.md`** — AppShell `min-h-screen` invariant unchanged; no layout changes
- **Phase 21 `skippedAttachments`** — field preserved on `SkeletonSummary`; `MissingAttachmentsPanel` reads it unchanged

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RowState` type + `rowState()` predicate in `GlobalMaxRenderPanel.tsx:167-182` — extend with `'missing'` variant; same predicate signature, same left-accent `bg-danger` color used by `'unused'`
- `AnimationBreakdownPanel.tsx:162+` — same `RowState` / `rowState()` pattern; extend identically
- `MissingAttachmentsPanel.tsx` — `border-danger` + `text-danger` + `⚠` character pattern; reuse in row name cell
- `src/main/summary.ts:61-62` — `skippedNames` Set already built from `load.skippedAttachments`; reuse this Set at the mark step instead of the filter step

### Established Patterns
- **`isMissing` marking site**: In `summary.ts`, after computing `peaksArrayRaw`, map over results and add `isMissing: skippedNames.has(p.attachmentName)` before returning, then remove the filter. Same for breakdown card rows.
- **`BreakdownRow extends DisplayRow`** — `isMissing` flows through `AnimationBreakdownPanel` automatically once the base type gains the field
- **Left-accent bar `bg-danger`** — already used for `'unused'` state; reusing the same color for `'missing'` is intentional (both are danger-severity signals; the icon differentiates them)
- **Unicode ⚠ inline** — consistent with `MissingAttachmentsPanel`'s plain-text warning pattern; no SVG component needed

### Integration Points
- `src/main/summary.ts:87-120` — filter removal + `isMissing` marking (2 sites)
- `src/shared/types.ts` `DisplayRow` — add `isMissing?: boolean`
- `GlobalMaxRenderPanel.tsx` — `RowState` extension + left-accent branch + name cell icon
- `AnimationBreakdownPanel.tsx` — same `RowState` extension + left-accent branch + name cell icon
- No AppShell changes required (MissingAttachmentsPanel position unchanged)

### Files Not Touched
- `src/core/` — Phase 25 is purely a summary.ts + types + renderer change
- `src/renderer/src/panels/MissingAttachmentsPanel.tsx` — unchanged
- `src/renderer/src/panels/UnusedAssetsPanel.tsx` — unchanged
- `src/main/ipc.ts`, `src/preload/index.ts` — IPC contract backward-compatible

</code_context>

<specifics>
## Specific Ideas

- **Additive, not replacement**: The in-context red-accent rows supplement MissingAttachmentsPanel — both are visible simultaneously. The panel gives the full list at a glance; the in-context rows show scale context around each missing attachment.
- **⚠ icon beside name**: A simple Unicode `⚠` character in `text-danger` before (or after) the attachment name in the name cell. Consistent with the existing danger-accent idiom.
- **`'missing'` checked first in rowState()**: `if (row.isMissing) return 'missing'` should be the FIRST check, before `isUnused`, `peakRatio < 1.0`, etc. Missing rows are unambiguously dangerous regardless of their stub scale data.
- **Override persists for future use**: If an animator sets an override on a missing-attachment row (expecting to add the PNG later), the override is stored in `.stmproj` normally. When the PNG is eventually provided and the project is re-loaded, the override applies immediately.

</specifics>

<deferred>
## Deferred Ideas

- **Phase 26 tab system** — replacing the stacked panel layout with Global / Unused / Animation tabs. Captured in `.planning/todos/pending/2026-05-04-phase-26-tab-system-global-unused-animation.md`. Depends on Phase 25 finalizing row shapes before tab layout is applied.
- **`border-warning` token** — MissingAttachmentsPanel currently uses `border-danger` (red) per Plan 21-10 ISSUE-010 comment, noting that `border-warning` (amber/yellow) would be more semantically correct for a warning vs an error. Phase 25 continues this convention rather than introducing a new token. A future polish phase could add `border-warning`.
- **"Never rendered" greyed section** — attachments in the rig with no image (deliberately unchecked in Spine editor). Deferred from Phase 24 as undecidable in atlas-less mode. Still out of scope for Phase 25.

</deferred>

---

*Phase: 25-missing-attachments-in-context-display*
*Context gathered: 2026-05-04*
