# Phase 29: Per-region dedup + override-region semantics + atlas-preview pack-page accuracy — Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Re-key the **Global Max Render Source panel** and **Atlas Preview modal** from `attachmentName` to `regionName` so that one row = one source PNG across the four user-named surfaces (Global / Atlas Preview / Optimize / exported folder). Flip override storage from `Map<attachmentName, number>` to `Map<regionName, number>` so a user override on `5/7.png → 4×4` actually reaches the export pipeline (closes the correctness bug confirmed in `.planning/debug/path-indirected-duplicate-rows.md` 2026-05-07: overriding `5/7` to ~0% produced an exported `5/7.png` at 273×309, ignoring the override entirely because non-overridden siblings won the per-region max).

Migrate ~8+ existing `summary.peaks.find(p => p.attachmentName === X)` call sites; expose a new IPC field `summary.regions: RegionRow[]` alongside the unchanged `summary.peaks` (per-attachment data preserved for AnimationBreakdownPanel + CLI). Commit a stripped Chicken-derived regression fixture (<1MB) under `fixtures/` exercising path-indirection across analyzer + atlas-preview + export.

**In scope:**
- Analyzer: produce both `summary.peaks` (per-attachment, unchanged) AND `summary.regions: RegionRow[]` (per-region with `contributingAttachments[]` carrying full per-attachment detail).
- `src/shared/types.ts`: new `RegionRow` interface; `AtlasPreviewInput` + `PackedRegion` re-keyed to `regionName` + `attachmentNames[]`; mirrors `ExportRow.attachmentNames` precedent.
- Global Max Render panel: consumes `summary.regions`; row label format `{regionName}.png` with `images/` prefix stripped; `(used by N attachments)` indicator + hover tooltip listing contributors when `N > 1`.
- Atlas Preview modal: one tile per region (both Original + Optimized modes); hover tooltip = `{regionName}.png` + contributor count + dims; dblclick → `onJumpToRegion(regionName)` retargeted from `onJumpToAttachment`.
- AppShell override storage: `Map<regionName, number>` in memory; `.stmproj` persists with regionName keys (shape unchanged — just key meaning shifts).
- `project-io.ts` migration seam: at every load (mountOpenResponse / mainOpen / locate-skeleton-recovery / resample), translate v1.3-era `attachmentName` keys → `regionName` keys; lex-smallest contributing attachment wins on collision; orphans dropped + counted in the existing stale-override banner (D-150 pattern extended).
- AnimationBreakdownPanel: per-card per-attachment dedup **unchanged** (REGION-06 — drill-down is the surface where per-attachment detail lives).
- Migrate ~8+ call sites currently keyed on `attachmentName`: AppShell.tsx:512 + 1037, atlas-preview.ts:193, atlas-preview-view.ts:184, project-io.ts:530 + 804 + 1001, doc-export.ts:274 — each switches to region-keyed lookup or to `summary.regions`.
- Regression fixture: stripped Chicken subset under `fixtures/Chicken-Min/` (or equivalent) with target <1MB committed; vitest suite includes a path-indirection test exercising per-region dedup across analyzer + atlas-preview + export. Full 152MB Chicken stays gitignored.

**Out of scope:**
- Sampler changes (memory `project_sampler_visibility_invariant.md` — sampler measures all skin-declared attachments; dedup happens strictly downstream).
- New `load.atlasPath` branches (memory `project_strict_loadermode_separation.md` — `regionName` is already populated in both atlas-source + atlas-less modes).
- `src/core/` DOM/sharp/electron imports (Layer 3 invariant).
- Export math changes — `outW = ceil(canonicalW × effScale)` invariant preserved (memory `project_compute_export_dims_canonical_base.md`); exported folder already conforms (Surface #4 in debug audit).
- `.stmproj` schema-version bump (override field shape unchanged; only key meaning shifts; consistent with Phase 8 D-146 + Phase 21/22/28 additive precedents).
- Safety buffer (Phase 30) and Animation Breakdown collapse defaults (Phase 31).

</domain>

<decisions>
## Implementation Decisions

### Data Shape (IPC + Types)

- **D-01:** **Add `summary.regions: RegionRow[]` alongside the unchanged `summary.peaks: DisplayRow[]`.** `peaks` stays per-attachment (preserves CLI golden output for SIMPLE_PROJECT byte-for-byte; AnimationBreakdownPanel + setup-pose card unchanged; sampler tests untouched). `regions` is the new per-region view. Global Max Render panel + Atlas Preview switch to `summary.regions`. Cost: ~2× lightweight rows on IPC for path-indirected projects (Chicken: 533 regions / 301 attachments — both small fixed structs). CLI path-indirected output legitimately changes (no golden lock outside SIMPLE_PROJECT).

- **D-02:** **`RegionRow.contributingAttachments[]` carries full per-attachment detail per name.** Each entry: `{ attachmentName, skinName, slotName, peakScale, animationName, time, frame, isSetupPosePeak }`. Powers REGION-05 attribution (winner = entry whose `peakScale === row.peakScale`, lex-tiebreak on `attachmentName`) AND lets the Global panel hover tooltip + Atlas Preview tooltip render the breakdown without crossing IPC for a second lookup. Typically 1–3 entries per region.

- **D-03:** **`AtlasPreviewInput` + `PackedRegion` re-keyed to `regionName` + `attachmentNames: string[]`** (mirrors `ExportRow.attachmentNames` precedent at `src/shared/types.ts:240`). One tile per region in both Original + Optimized modes — cleanly fixes PREVIEW-01 (Chicken: 13 pages, not 14). The optimized-mode tile-expansion loop at `src/core/atlas-preview.ts:191-207` collapses from "one tile per `attachmentNames[i]`" → "one tile per region (with `attachmentNames[]` for hit-test attribution)".

- **D-04:** **Override storage `Map<regionName, number>` in memory and on disk.** AppShell.tsx:331 init + project-io serialize/materialize all speak `regionName`. `.stmproj` v1 schema: the existing `overrides` field shape (`Record<string, number>`) is unchanged — only the key semantics shift from `attachmentName` to `regionName`. Single source of truth. No schema-version bump (Phase 8 D-146 + Phase 21/22/28 additive-only precedent).

### Override Migration (v1.3-era .stmproj → v1.3.1)

- **D-05:** **Silent migration with deterministic collision rule.** On every load: for each existing override key, look up the `attachmentName → regionName` mapping (peaks already carry `regionName`). Re-key to `regionName`. Collision rule = **lex-smallest contributing `attachmentName` wins** — matches REGION-05 winning-attachment lex-tiebreak. Orphan keys (attachment no longer in rig) dropped + counted toward the stale-override banner. Project NOT marked dirty by migration alone. On next deliberate save, the file is rewritten with `regionName` keys; round-trip identity preserved. No blocking dialogs.

- **D-06:** **Migration runs at the project-io.ts seam, mirroring D-150.** Three load paths must thread the migration: `mountOpenResponse` (~line 530), main-side `mainOpen` (~line 802), and locate-skeleton-recovery (~line 999). Renderer receives an already-migrated `Map<regionName, number>`. The existing stale-override banner state (Phase 8 D-150, AppShell.tsx:1713) extends to also report `migratedKeyCount` — copy: `"Updated N overrides to per-region keys."` Same dismissable, non-blocking surface.

### Atlas Preview Click Attribution (REGION-02)

- **D-07:** **Hover tooltip = name + contributor count; dblclick jumps to Global panel region row.** Hover sets `hoveredRegionName` (replaces `hoveredAttachmentName` at AtlasPreviewModal.tsx:100); the existing `HoverTooltip` (lines 656-684) renders `{regionName}.png` (line 1, font-semibold), dims (line 2, today's behavior), and a conditional third line `used by N attachments` only when contributors.length > 1. Dblclick retargets `onJumpToAttachment(name)` → `onJumpToRegion(regionName)` (a new prop) navigating to the region row in the Global panel. Modal stays lean; no new click-pin UX. Per-attachment list lives on the destination Global row's hover tooltip (D-08).

### Drill-Down Surface for Per-Attachment Detail (REGION-06)

- **D-08:** **Global row badge + hover tooltip; AnimationBreakdownPanel unchanged.** When `contributingAttachments.length > 1`, the Global row shows a subtle `(used by N attachments)` indicator next to the row label. Hovering the row (or the badge) reveals a tooltip listing each contributor with its per-attachment `peakScale` (data already on the row from D-02). Quick attribution surface; zero new expand/collapse pattern. AnimationBreakdownPanel is the deep drill-down for REGION-06 — full per-animation × per-attachment breakdown.

- **D-09:** **AnimationBreakdownPanel per-card dedup stays attachmentName-keyed.** The 4-surface invariant ("N rows everywhere") applies to the four user-named surfaces (Global / Atlas Preview / Optimize / exported folder). AnimationBreakdownPanel is the explicit drill-down where per-attachment detail (mesh, weight maps, slot bindings, per-bone-chain peaks) lives — that's the contract verbatim from the debug session: *"Per-attachment-name detail belongs in a drill-down."* Within an animation card, path-indirected projects will show the same source PNG under multiple attachment-name rows — that's by design, not a bug. Zero panel changes for this phase.

### Claude's Discretion (resolved at planning time)

- Exact copy for the Global row `(used by N attachments)` indicator — could be `(N contributors)` or `(× N)` chip; picks the wording that fits the Phase 26.1/26.2 visual-polish system.
- Exact copy for the migration banner — `"Updated N overrides to per-region keys"` is a draft; the planner picks the final wording aligned with Phase 19 quantified-callout style.
- Stripped Chicken fixture stripping strategy — replace each PNG with a 1×1 stub vs 16×16 stub vs JSON+atlas only with no PNGs (atlas-source mode only). Pick the smallest fixture that exercises path-indirection in analyzer + atlas-preview + export simultaneously. Target <1MB committed (REGION-07).
- OptimizeDialog "used by N attachments" annotation on the file row — Surface Audit flagged this as a "minor copy/UX" tweak. The planner decides whether to fold it into this phase or note it as a v1.4 polish item; the data is available regardless.
- The new `onJumpToRegion(regionName)` prop wiring — could replace `onJumpToAttachment` outright or run alongside (deprecation path); planner picks based on the migrated call sites.
- Whether `RegionRow` is a new top-level interface or a structural variant of `DisplayRow` (extends with `regionName` + `contributingAttachments[]` + drops a few attachment-specific fields); the planner picks based on field overlap.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Roadmap & State (project-level constraints)
- `.planning/ROADMAP.md` lines 670-699 — Phase 29 entry: goal, dependencies (Phase 22.1 + Phase 24 + Phase 28), 7 success criteria, PREVIEW-01 fold rationale, 5 constraints to preserve.
- `.planning/REQUIREMENTS.md` lines 13-21 + 39-41 — REGION-01..07 + PREVIEW-01 (8 REQs total, all routed to this phase).
- `.planning/STATE.md` — current position (Phase 29 pending /gsd-discuss-phase 29 then /gsd-plan-phase 29).
- `.planning/PROJECT.md` — full project memory carries forward.

### Debug Session (the falsification + locked decisions)
- `.planning/debug/path-indirected-duplicate-rows.md` — full investigation. § Surface Audit (4-surface conformance table), § Multi-surface impact summary (8+ call site list), § User Decision (verbatim Option B + 4-surface invariant), § Resolution (locked decisions). MUST READ before planning — the audit identifies every code locus this phase touches.

### Phase Loci — Data Shape (IPC + types)
- `src/shared/types.ts:54-150` — `DisplayRow` interface (per-attachment; unchanged for `summary.peaks`).
- `src/shared/types.ts:232-280` — `ExportRow` (already region-keyed via `sourcePath`; `attachmentNames[]` precedent for D-03).
- `src/shared/types.ts:461-499` — `AtlasPreviewInput` + `PackedRegion` (D-03 target; both re-keyed).
- `src/shared/types.ts:540-560` — `Summary` interface root (gains `regions: RegionRow[]` field per D-01).
- `src/shared/types.ts` (file-top docblock) — D-21 lock: every IPC type must be `structuredClone`-safe (primitives + arrays of primitives + plain objects). `RegionRow` + `contributingAttachments[]` must comply.

### Phase Loci — Analyzer (region-keyed fold)
- `src/core/analyzer.ts:183-190` — `dedupByAttachmentName` (existing per-attachment fold; preserved).
- `src/core/analyzer.ts:203-280` — `analyze(peaks, ...)` returns `DisplayRow[]` today; gains a sibling that returns `RegionRow[]` for `summary.regions`.
- `src/core/analyzer.ts:329-432` — `analyzeBreakdown` (AnimationBreakdownPanel data; D-09 says NO changes to this function's per-card dedup contract).
- `src/core/analyzer.ts:220, 350` — `lookupKey = p.regionName ?? p.attachmentName` precedent for region-name resolution; the new fold uses `regionName` as the dedup key directly.

### Phase Loci — Atlas Preview (PREVIEW-01 + REGION-02)
- `src/core/atlas-preview.ts:166-231` — `deriveInputs` (D-03 + PREVIEW-01 fix locus; the optimized-mode `attachmentNames[i]` expansion loop at lines 191-207 collapses to per-region).
- `src/renderer/src/lib/atlas-preview-view.ts:184-205` — renderer mirror (must change in lockstep).
- `src/renderer/src/modals/AtlasPreviewModal.tsx:100-684` — host of `hoveredAttachmentName` state (line 100), `onJumpToAttachment` prop (line 70), HoverTooltip subcomponent (line 656); D-07 retargets all three to region-keyed.

### Phase Loci — Override Storage + Migration (REGION-04 + D-05/D-06)
- `src/renderer/src/components/AppShell.tsx:331` — `overrides: Map<string, number>` init (D-04: `Map<regionName, number>`).
- `src/renderer/src/components/AppShell.tsx:512` — peak lookup in OverrideDialog (`summary.peaks.find(p => p.attachmentName === row.attachmentName)`); migrates to regionName-keyed lookup.
- `src/renderer/src/components/AppShell.tsx:1037` — effective-summary aggregation (`overrides.has(name)`); migrates to regionName.
- `src/renderer/src/components/AppShell.tsx:1713-1740` — existing stale-override banner UI (D-150 surface; D-06 extends with migration count).
- `src/main/project-io.ts:526-540` — D-150 stale-key intersect on `mountOpenResponse` (D-06 migration locus #1).
- `src/main/project-io.ts:802` — D-150 intersect on `mainOpen` (D-06 migration locus #2).
- `src/main/project-io.ts:999` — D-150 intersect on locate-skeleton-recovery (D-06 migration locus #3).

### Phase Loci — Other Migrating Call Sites
- `src/main/doc-export.ts:274` — "optimized assets" count for documentation builder (`summary.peaks.find(p => p.attachmentName === ...)`); migrate to region-keyed.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — consumes `summary.breakdown` (per-attachment); D-09 says NO changes.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — primary consumer; switches from `summary.peaks` to `summary.regions`.

### Phase Loci — CLI (golden output preservation)
- `scripts/cli.ts:78-130` — `renderTable(peaks)` calls `analyze(peaks)` directly. SIMPLE_PROJECT golden test is byte-locked (D-102); SIMPLE_PROJECT has no path indirection so the golden is preserved verbatim. Path-indirected fixtures are NOT byte-locked (legitimate output change post-dedup).

### Locked Memory & Project Invariants (must respect)
- `project_sampler_visibility_invariant.md` — sampler unchanged; per-region dedup happens strictly downstream in analyzer + atlas-preview + UI.
- `project_strict_loadermode_separation.md` — `regionName` is already populated in both modes; no new `load.atlasPath` branches.
- `project_compute_export_dims_canonical_base.md` — export math `outW = ceil(canonicalW × effScale)` untouched.
- `project_phase6_default_scaling.md` — uniform-only export scaling preserved.
- `feedback_explain_git.md` — narrate every git step in plain English (planner-level reminder).
- `feedback_layout_bugs_request_screenshots_early.md` — for the Global panel `(used by N attachments)` indicator + Atlas Preview tooltip layout, ask the user for a screenshot if jsdom-only iteration drifts.
- Phase 6 D-110 / D-91 — uniform-only export, source-dim cap, hard cap on both axes.
- Phase 8 D-146 — `.stmproj` schema-version stays at `1` for additive-shape changes (this phase qualifies — only key meaning shifts).
- Phase 8 D-150 — stale-override-key drop precedent at IPC seam (D-06 mirrors).
- Phase 22.1 — POST-override passthrough partition (must continue to work after override storage flips to regionName).

### Backlog
- No backlog items folded into this phase.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ExportRow.attachmentNames: string[]`** at `src/shared/types.ts:240` — exact precedent for the new `AtlasPreviewInput.attachmentNames[]` + `PackedRegion.attachmentNames[]`. ExportRow already shows that "one row per region with attachmentNames array for traceability" is structuredClone-safe and works across IPC.
- **`PeakRecord.regionName`** populated by `src/core/sampler.ts` in both atlas-source and atlas-less modes — no loader work needed; the dedup key is already there at the analyzer boundary.
- **D-150 stale-override drop pattern** at `src/main/project-io.ts:526, 802, 999` + AppShell banner state (line 1713) — D-06 reuses the same load-time intersection points and the same banner surface, just adding a `migratedKeyCount` field alongside `staleCount`.
- **`hoveredAttachmentName` state machine** at `src/renderer/src/modals/AtlasPreviewModal.tsx:100, 281, 555, 613` — D-07 substitutes `hoveredRegionName`; the linear-scan hit-test (RESEARCH §Code Examples 2 / O(N) acceptable) is unchanged.
- **`HoverTooltip` subcomponent** at `src/renderer/src/modals/AtlasPreviewModal.tsx:656-684` — keeps its existing position-flip + estimated-dim layout; D-07 just adds a third line `used by N attachments` when N > 1.
- **`onJumpToAttachment` prop pattern** at `src/renderer/src/modals/AtlasPreviewModal.tsx:70, 286` — clone the same wiring for `onJumpToRegion(regionName)`.
- **`pickHigherPeak` + `dedupByAttachmentName`** at `src/core/analyzer.ts:160-190` — direct templates for the new `dedupByRegionName` (same shape, different key, same tie-break logic mirroring REGION-05 lex-tiebreak).
- **`buildExportPlan` per-region max behavior** at `src/core/export.ts:163-235` — already does the per-region max across `bySourcePath`; this phase makes the OVERRIDE side speak the same key, so the two halves finally meet (closes the correctness bug).

### Established Patterns
- **Layer 3 invariant** — `src/core/` stays DOM/sharp/electron-free. Analyzer changes (D-01, D-02) are pure-TS. Atlas-preview changes (D-03) are pure-TS in `src/core/atlas-preview.ts`; renderer mirror in `src/renderer/src/lib/atlas-preview-view.ts`.
- **`structuredClone`-safe IPC types** (D-21 lock) — `RegionRow.contributingAttachments[]` is plain objects of primitives. No class instances, no functions, no Maps.
- **Phase 6 D-110 uniform-only export** — D-04/D-05 don't touch export math. Override-on-region multiplies the canonical scale uniformly per the existing pipeline.
- **Tailwind v4 literal-class discipline (Pitfall 8)** — every `className` is a string literal. The new Global row badge follows this. No template interpolation.
- **Phase 24 alert-bar precedent** at `src/renderer/src/components/AppShell.tsx` (`MissingAttachments` + `UnusedAssets` cluster above `activeTab === 'X'` blocks per project memory `project_alert_bars_top_on_both_tabs.md`) — the migration banner extension lives in the same band.
- **Phase 8 D-150 banner UX** (`stale-override-notice`) — the visual treatment + dismissal UX template for D-06's migration-banner extension.
- **Phase 22 G-01 stub-region precedent** — for the stripped Chicken fixture, replacing PNGs with stubs is an established pattern (1×1 stubs for missing PNGs).

### Integration Points
- **`summary` payload across IPC** — `summary.regions` is added to the structuredClone payload sent from main → renderer. New field; no replacement of `peaks`. Field order in `Summary` interface follows existing convention (after `peaks`, before `breakdown`).
- **OverrideDialog ↔ overrides Map** — OverrideDialog opens for a row (now a region row); writes `overrides.set(row.regionName, value)`. UX is unchanged from the user's perspective; the key under the hood flips.
- **Atlas Preview ↔ Global panel jump** — `onJumpToRegion` prop traverses the modal → AppShell hierarchy the same way `onJumpToAttachment` does; lookup target is the region row in the Global panel's table.
- **`.stmproj` validate / serialize / materialize** — three-touch pattern at `src/core/project-file.ts` (Phase 8 D-146 lock). Override field shape unchanged; migration logic lives in `src/main/project-io.ts` post-materialize, before sending to renderer.
- **Stale-override banner ↔ migration banner** — `staleOverrideNotice` at `src/renderer/src/components/AppShell.tsx:1713` extends with a `migratedCount` field (or a sibling `overrideMigrationNotice` slot). Same dismissal contract; same visual band.

</code_context>

<specifics>
## Specific Ideas

- **The repro that drives this phase** — debug session 2026-05-07 § Resolution: user overrode `5/7` to ~0% (4×4 / 0.011×) in Global panel; exported `5/7.png` came out at 273×309 (the per-region max across `5/5/5/7/7` + `5/5/7/7` + `5/7`). The Optimize dialog row showed `images/5/7.png 378×428 → 273×309 ~1.4x smaller` — completely ignoring the user's 4×4 override. Two screenshots in the debug session prove this. The success-criterion for this phase is: that same override produces an exported `5/7.png` at 4×4.
- **Chicken regression fixture** — full Chicken is 152MB and gitignored (`fixtures/Chicken/SYMBOLS.json` 369KB / 533 atlas regions / authored attachment names like `5/5/5/7/7`, `5/5/7/7`, `5/7`, `5/5/7/BLOOD_DROP`). Stripped fixture target: <1MB committed. The path-indirected attachment names + matching `path` field references must survive the strip; PNG content does not (stubs sufficient for analyzer + atlas-preview tests; for export tests the planner picks whether the strip preserves a tiny PNG slice or relies on atlas-source mode).
- **`(used by N attachments)` indicator copy** — keep it tight: a parenthetical subtext or a small `× N` chip, not a sentence. Phase 19 quantified-callout style is the visual reference.
- **AnimationBreakdownPanel = drill-down** — the explicit user contract from the debug session: *"Per-attachment-name detail (mesh/weight-map variation) belongs in a drill-down, not as separate top-level rows."* AnimationBreakdownPanel IS that drill-down. Within an animation card, path-indirected projects legitimately show multiple rows for one source PNG — that's per-attachment detail by design.
- **Lex-tiebreak precedent** — REGION-05 ("ties break deterministically on attachmentName lex order") is the ONE rule that determines: (a) winning attachment for Source Animation + Frame columns; (b) lex-smallest contributor wins on override migration collisions; (c) lex-smallest contributor wins on equal-peak attribution. Same rule, three uses.

</specifics>

<deferred>
## Deferred Ideas

- **OptimizeDialog "used by N attachments" annotation on the file row** — Surface Audit flagged this as "minor copy/UX": the dialog's per-file row could surface contributor count (e.g. `images/5/7.png — used by 3 attachments`). Pure rendering tweak; data is available regardless. Folded into Claude's Discretion; planner decides whether to include in this phase or defer to a later visual-polish phase.
- **Click-pin popover in Atlas Preview tile** — discussed and rejected for v1.3.1 (Option C in Area 3). Single-click pinning a popover with full contributor list. Could be revisited if hover tooltip + dblclick UX proves insufficient based on user feedback post-ship.
- **Atlas Preview tile expand-on-hover** — discussed and rejected (Option B in Area 3). Same trade-off as above; defers to user-feedback signal.
- **Expandable Global panel rows** — discussed and rejected for v1.3.1 (Option B in Area 4). Each row gains a chevron + sub-table of contributors. The badge + hover tooltip (D-08) covers the inspect path with less UI surface; expandable rows revisit if/when the badge/tooltip pattern proves insufficient.
- **AnimationBreakdownPanel switch to per-region dedup** — discussed and rejected (Option B in Area 4). Would lose REGION-06 per-attachment detail; runs counter to the debug session's locked contract.
- **Per-card view toggle in AnimationBreakdownPanel** — discussed and rejected (Option C in Area 4). Adds yet another piece of UI state; cards behave inconsistently across animations.
- **Migration banner copy variations** — exact wording for "Updated N overrides to per-region keys" vs alternatives is Claude's discretion at planning time.
- **Schema-version bump for `.stmproj`** — explicitly NOT done. The override field shape stays `Record<string, number>`; only key meaning shifts. Consistent with Phase 8 D-146 + Phase 21/22/28 additive-only precedents.
- **CLI golden output update for path-indirected fixtures** — if any existing CLI golden test exercises path indirection (none currently — SIMPLE_PROJECT has no path indirection), it'd need a regen. Planner audits.

</deferred>

---

*Phase: 29-per-region-dedup-override-region-semantics-atlas-preview-pac*
*Context gathered: 2026-05-07*
