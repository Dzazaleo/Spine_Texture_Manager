# Phase 19: UI improvements (UI-01..05) - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Renderer-only UI refresh closing tester feedback against the v1.0/v1.1 surface. Five LOCKED requirements (UI-01..UI-05): persistent sticky header, card-based section layout with semantic state colors, modal redesign with summary tiles + cross-nav, quantified `X.XX MB potential savings` callout for unused attachments, primary/secondary button hierarchy elevating Optimize Assets as the CTA.

In scope: `src/renderer/` source files. New Tailwind v4 `@theme inline` tokens (--color-success, --color-warning) literal-hex-picked for ≥4.5:1 WCAG AA contrast on `--color-panel`. ONE main-side touchpoint: extend `UnusedAttachment` shape with `bytesOnDisk: number` (computed via `fs.statSync` against existing `load.sourcePaths`) — closes UI-04.

Out of scope (NEW capabilities — not this phase):
- Documentation Builder feature itself (Phase 20 — only a disabled placeholder button is added in Phase 19 to lock cluster placement)
- Atlas-less mode / synthetic atlas (Phase 21)
- Override-cap dims-badge (Phase 22)
- Math core changes (Layer 3 invariant: `src/core/` untouched; tests/arch.spec.ts gate auto-enforces)
- Modal lifecycle/scaffold changes — 5-modal ARIA pattern (role=dialog + aria-modal=true + useFocusTrap) preserved verbatim

</domain>

<decisions>
## Implementation Decisions

### Sticky Header Composition (UI-01, UI-05)

- **D-01:** Visible load-summary card uses UI-01 verbatim wording: `N skeletons / N atlases / N regions`. Rig-info hover tooltip preserved unchanged for the deeper bones/slots/attachments/animations/skins/`skeleton.fps` breakdown (CLAUDE.md fact #1 wording lock at AppShell.tsx:1131 stays).
- **D-02:** Tabs (Global / Animation Breakdown) stay inside the single sticky bar row. Layout left-to-right: branded title → load-summary card → tab strip → search box → button cluster. Single sticky surface, single z-context.
- **D-03:** Documentation button rendered as visible disabled placeholder. `aria-disabled="true"` + tooltip/title text `Available in v1.2 Phase 20`. Phase 20 enables by removing the disabled flag and wiring `onClick`. Locks the UI-01 cluster shape now so Phase 20 doesn't have to retrofit.
- **D-04:** Search box anchors in the right cluster, immediately LEFT of the action buttons, separated by a small gap. Reuses the existing `SearchBar` component (src/renderer/src/components/SearchBar.tsx) verbatim.
- **D-20 (Implementation):** `position: sticky` wrapper on the `<header>` element at AppShell.tsx:1090. `top-0 z-20 bg-panel border-b border-border` token reuse — no new tokens needed for the sticky surface itself. Existing `<main className="flex-1 overflow-auto">` (AppShell.tsx:1279) is the scroll container — sticky containment works because `<header>` is a flex sibling, not nested inside the scroller.

### Card Layout + State-Color Palette (UI-02)

- **D-05:** Card scope = whole panel per section. Global panel renders as a single card (rounded border + `bg-panel` + padding). Animation Breakdown renders one card per `cardId` (one card per `summary.animationBreakdown[i]`). Unused Assets is its own callout card. Tables PRESERVED inside cards — virtualizer path at GlobalMaxRenderPanel.tsx:759 unchanged.
- **D-06:** Row state coloring depth = left accent bar (1-2px wide via `inline-block w-1` pattern) in green/yellow/red + tinted ratio cell. Rest of row neutral. Mirrors the existing banner pattern at AppShell.tsx:1227 (`bg-accent` left bar) and AppShell.tsx:1258 (`bg-danger` left bar).
- **D-07:** Add `--color-success` and `--color-warning` as literal-hex tokens in `@theme inline` block at index.css:47-71. Picked for ≥4.5:1 WCAG AA contrast on `--color-panel` (#1c1917). Researcher MUST verify contrast ratios and propose specific hex values — mirrors the D-104→`--color-danger` (#e06b55) approach where Tailwind palette refs were rejected because default shades failed the 4.5:1 bar.
- **D-08:** `Color-coded category icons` (UI-02 wording) = section-level icons only on the 3 callout headers. One inline SVG glyph per: Global Max (e.g. ruler/measure), Animation Breakdown (e.g. play/film), Unused Assets (existing `⚠` glyph at GlobalMaxRenderPanel.tsx:722 stays). Hand-rolled SVG, no icon library dependency added.

### Modal Redesign — Summary Tiles + Cross-Nav (UI-03)

- **D-09:** OptimizeDialog summary tiles (3 tiles, top of dialog body):
  - Tile 1: `{N} Used Files` — `plan.rows.length`
  - Tile 2: `{N} to Resize` — count of `plan.rows` where `outW < sourceW`
  - Tile 3: `Saving est. {X.X}% pixels` — `(1 - sum(outW*outH) / sum(sourceW*sourceH)) * 100`
  All three derive from the existing `ExportPlan` (no new IPC, no new shape). Computed in-render from `props.plan` at the top of `OptimizeDialog`.
- **D-10:** AtlasPreviewModal summary tiles (3 tiles, top of dialog body):
  - Tile 1: `{N} Pages` — `projection.pages.length`
  - Tile 2: `{N} Regions` — `projection.regions.length`
  - Tile 3: `{X.X}% Utilization` — `sum(region area) / sum(page area) * 100`
  All from existing `AtlasPreviewProjection` at AtlasPreviewModal.tsx:59-62. Tiles do NOT mutate when the `mode: 'original' | 'optimized'` toggle flips — they reflect whichever projection is currently rendered (the projection memo already re-derives on toggle change).
- **D-11:** Cross-nav = sequential mount only. Clicking the `Atlas Preview` cross-nav button inside OptimizeDialog calls `onClose()` THEN `setAtlasPreviewOpen(true)` (and vice versa). Single modal mounted at a time. 5-modal ARIA scaffold (role=dialog + aria-modal=true + useFocusTrap) preserved verbatim — each modal still owns its own focus trap.
- **D-12:** Cross-nav button anchored at footer LEFT. OptimizeDialog footer at OptimizeDialog.tsx:308 flips from `flex gap-2 mt-6 justify-end` to `flex gap-2 mt-6 justify-between`. Primary actions (Cancel/Start, Cancel, Open output folder/Close depending on state) stay clustered right.

### Unused-Savings Quantification (UI-04)

- **D-13:** Compute on-disk PNG bytes main-side at load. Extend `UnusedAttachment` shape (src/shared/types.ts:156-171) with `bytesOnDisk: number`. `summary.ts` `analyze()` (src/main/summary.ts:62) already has `load.sourcePaths: Map<regionName, absPath>` in scope — add `fs.statSync(path).size` per unused source path during summary build. structuredClone-safe (primitive number — D-21 docblock lock preserved).
- **D-14:** Display format = auto-scale per OS file-size convention:
  - bytes < 1024 → `{N} B` (defensive only — unlikely)
  - < 1 MB → `{X} KB` (0 decimals)
  - < 1 GB → `{X.XX} MB` (2 decimals — UI-04 verbatim shape for typical projects)
  - ≥ 1 GB → `{X.XX} GB` (2 decimals)
  Renderer-side formatting helper. UI-04 success criterion 4 wording (`X.XX MB potential savings`) is the default surface for typical project sizes.
- **D-15:** Atlas-packed projects (source path resolves to a shared atlas page rather than a per-region PNG) get `bytesOnDisk = 0` per unused row. Renderer callout displays count only (`N unused attachments`) when the aggregate sum is 0 — no MB suffix. Honest about the no-savings reality (unused regions inside a shared atlas don't reduce file size unless atlas is repacked, which Phase 6 Optimize doesn't do).
- **D-16:** Static at load. `UnusedAttachment.bytesOnDisk` populated once during summary build; refreshes only when a new skeleton loads (drag/drop, Open, locate-skeleton recovery). Phase 4 overrides cannot change unused-set membership (sampler visibility = `slot.color.a > 0` at ≥1 tick; overrides only multiply peak ratio, not visibility), so no override-driven recompute. Note for downstream: **D-09 OptimizeDialog Pixel Savings % tile DOES auto-refresh per Optimize click** because `ExportPlan` is rebuilt from current overrides each time `onClickOptimize` runs (AppShell.tsx:459) — that path needs no new logic.

### Primary/Secondary Button Hierarchy (UI-05)

- **D-17:** Primary CTA (Optimize Assets) = filled treatment. Class string: `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`. Reuses the existing OptimizeDialog `Start` button pattern at OptimizeDialog.tsx:323 verbatim — no new tokens, no new pattern. Tailwind v4 literal-class discipline preserved (Pitfall 8).
- **D-18:** Secondary buttons (Atlas Preview, Documentation, Save, Open) keep the existing outlined warm-stone treatment from AppShell.tsx:1165: `border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent`. Documentation button adds `aria-disabled="true"` plus the placeholder hint per D-03.
- **D-19:** Right cluster button order: `Search | Atlas Preview | Documentation | Optimize Assets | Save | Open`. Documentation slots between Atlas Preview and Optimize; existing Atlas Preview → Optimize → Save → Open relative order from AppShell.tsx:1161-1197 preserved.

### Claude's Discretion

- Sticky bar background opacity / blur effects: not specified by UI-01..05. Use solid `bg-panel` (no backdrop-blur) for simplicity and Electron rendering parity across macOS/Windows/Linux.
- Card border radius value: use `rounded-md` to match the existing modal/button pattern.
- Tile layout inside modals: 3 equal-width tiles in a `flex gap-3` row above the existing body. Token reuse: `bg-panel` (or a slightly lighter shade derived from `--color-stone-800` if visual separation needs it).
- Section-icon glyph choices (D-08): pick simple stroke-based SVG icons that fit the warm-stone aesthetic. Researcher proposes specifics; planner locks final glyphs.

### Folded Todos

None — `gsd-sdk query todo.match-phase 19` returned `count: 0`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase contract

- `.planning/REQUIREMENTS.md` §UI-01..UI-05 (lines 37-41) — five locked acceptance criteria; verbatim wording is the test surface.
- `.planning/ROADMAP.md` §"Phase 19: UI improvements (UI-01..05)" (lines 327-352) — Goal, Depends on, Background, Scope, Severity, Success Criteria (5 numbered items at lines 344-348).
- `CLAUDE.md` — fact #5 (`core/` is pure TypeScript, no DOM); fact #1 (rig-info tooltip `skeleton.fps` wording lock).

### Renderer surface (existing files this phase modifies)

- `src/renderer/src/components/AppShell.tsx:1088-1199` — current `<header>` chrome that becomes the new sticky bar. Tab strip (1136-1149), button cluster (1155-1198), filename chip + rig-info tooltip (1099-1135) all live here.
- `src/renderer/src/index.css:47-71` — `@theme inline` token block. Add `--color-success` + `--color-warning` here; preserve the existing literal-hex `--color-danger: #e06b55` rationale (D-104).
- `src/renderer/src/components/SearchBar.tsx` — reused verbatim in the sticky header (D-04).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — wraps in card per D-05; row left-bar coloring per D-06; unused callout MB-savings figure per D-13/D-14/D-15.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — wraps in cards (one per `cardId`) per D-05; row state coloring per D-06.
- `src/renderer/src/modals/OptimizeDialog.tsx:269-362` — summary tiles per D-09; cross-nav button per D-12.
- `src/renderer/src/modals/AtlasPreviewModal.tsx` — summary tiles per D-10; cross-nav button per D-12.

### Main + shared (single touchpoint)

- `src/shared/types.ts:156-171` (`UnusedAttachment`) — extend with `bytesOnDisk: number` per D-13. structuredClone-safety (D-21 docblock at lines 153-154) preserved — primitive number only.
- `src/main/summary.ts:56-75` — `analyze()` already has `load.sourcePaths` in scope; add `fs.statSync` per unused row.
- `src/shared/types.ts:474` (`SkeletonSummary.unusedAttachments?: UnusedAttachment[]`) — declaration unchanged; the new field flows transparently through structuredClone IPC.

### Locked invariants (do not violate)

- `tests/arch.spec.ts` (Layer 3 grep gate) — renderer NEVER imports `src/core/*`. This phase doesn't introduce any such import; the new `bytesOnDisk` is computed main-side and arrives via the existing `SkeletonSummary` IPC payload.
- 5-modal ARIA scaffold (verbatim across OverrideDialog, OptimizeDialog, AtlasPreviewModal, SaveQuitDialog, SettingsDialog, HelpDialog, UpdateDialog) — `role="dialog"` + `aria-modal="true"` + outer overlay onClick=onClose + inner stopPropagation + useFocusTrap. Preserve verbatim.
- Tailwind v4 literal-class discipline (RESEARCH Pitfall 3 + 8) — every className is a string literal or clsx with literal branches. No template-string interpolation.

### Reference implementations (reuse verbatim)

- `src/renderer/src/modals/OptimizeDialog.tsx:323` — filled primary-CTA pattern (`bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold disabled:opacity-50`). D-17 reuses this verbatim for the sticky-header Optimize Assets button.
- `src/renderer/src/components/AppShell.tsx:1165` — outlined secondary-button pattern. D-18 reuses verbatim.
- `src/renderer/src/components/AppShell.tsx:1227` (`bg-accent` left bar) and 1258 (`bg-danger` left bar) — banner left-accent-bar pattern. D-06 row state coloring follows this shape with `bg-success` / `bg-warning` / `bg-danger` swap-ins.
- `src/renderer/src/index.css:64` — `--color-danger: #e06b55` rationale (literal hex picked for 5.33:1 contrast on `--color-panel`; rejected Tailwind defaults #c94a3b/#b84a3a which failed at 3.77/3.40:1). D-07 mirrors this approach for `--color-success` / `--color-warning`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `SearchBar` component (src/renderer/src/components/SearchBar.tsx) — fully reused in sticky header per D-04. No changes.
- `useFocusTrap` hook (src/renderer/src/hooks/useFocusTrap.ts) — every modal already uses this; cross-nav per D-11 doesn't change focus-trap ownership (sequential mount → trap is destroyed/recreated per modal as today).
- Filled-primary-CTA pattern at OptimizeDialog.tsx:323 — verbatim reuse for sticky-header Optimize button per D-17.
- Outlined-secondary pattern at AppShell.tsx:1165 — verbatim reuse for Atlas Preview / Documentation / Save / Open per D-18.
- Banner left-bar pattern at AppShell.tsx:1227 + 1258 — pattern for D-06 row state coloring.

### Established Patterns

- Tailwind v4 `@theme inline` token block (index.css:47-71) — the canonical place to add new color tokens. `inline` keyword is LOAD-BEARING for color tokens (RESEARCH Finding #2 — utility classes resolve at generation time, not render time).
- Literal-hex tokens for non-default-palette colors (`--color-danger: #e06b55`) — pattern D-07 follows for `--color-success` and `--color-warning`.
- Plain useState modal lifecycle (e.g. `atlasPreviewOpen` at AppShell.tsx:158) — D-11 cross-nav sequential mount uses this pattern verbatim.
- `useMemo` for dialog projections (AtlasPreviewModal.tsx:80+) — D-10 utilization % is a one-line addition to the existing projection memo.
- `structuredClone`-safe summary IPC (src/shared/types.ts D-21 docblock) — D-13 `bytesOnDisk: number` is primitive, fits cleanly.

### Integration Points

- AppShell.tsx `<header>` at line 1090 → wrapped in sticky positioning; tab strip + search + buttons reorganized inside (D-01, D-02, D-04, D-19).
- AppShell.tsx button cluster at lines 1155-1198 → reordered + Documentation button slotted in + Optimize Assets gets filled treatment (D-03, D-17, D-18, D-19).
- `analyze()` in src/main/summary.ts:62 → add per-unused-row `fs.statSync` call (D-13). Single touchpoint outside renderer.
- `UnusedAttachment` shape in src/shared/types.ts:156-171 → add `bytesOnDisk: number` field (D-13).
- OptimizeDialog body region at OptimizeDialog.tsx:286-306 → prepend a 3-tile summary row above the existing pre-flight/in-progress body (D-09).
- AtlasPreviewModal body → prepend a 3-tile summary row mirroring OptimizeDialog (D-10).
- Both modal footers → add cross-nav button on the LEFT, flip footer to `justify-between` (D-11, D-12).

</code_context>

<specifics>
## Specific Ideas

- The existing rig-info tooltip wording (`skeleton.fps: N (editor metadata — does not affect sampling)` at AppShell.tsx:1131) is load-bearing per CLAUDE.md fact #1 + sampler.ts:41-44. D-01 explicitly preserves this verbatim — the new visible load-summary card uses different wording (`N skeletons / N atlases / N regions`) and lives separately.
- UI-03 example numbers (`544 Used Files / 433 to Resize / Saving est. 77.7% pixels`) come from the user's tester-feedback context. D-09 derives the same shape from existing `ExportPlan` data — no new IPC, no extra computation cost on Optimize-click.
- The user explicitly confirmed (via clarification round on D-16) that overrides cannot change unused-set membership; the OptimizeDialog Pixel Savings % tile (D-09) auto-refreshes per Optimize click via existing ExportPlan rebuild — no new logic for that path.

</specifics>

<deferred>
## Deferred Ideas

None surfaced during discussion that fall outside Phase 19 scope. All gray areas resolved within UI-01..UI-05 boundary; all locked invariants (Layer 3, ARIA scaffold, Tailwind literal-class discipline, structuredClone safety) preserved.

Phase 20 (Documentation Builder) will:
- Wire the now-disabled Documentation button by removing the `aria-disabled` flag and adding the `onClick` handler.
- Reuse Phase 19's sticky-header pattern + 3-tile summary modal pattern + outlined-secondary button treatment without retrofitting.

</deferred>

---

*Phase: 19-ui-improvements-ui-01-05*
*Context gathered: 2026-05-01*
