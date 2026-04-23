---
name: Phase 3 — Animation Breakdown panel Context
description: Locked decisions for Phase 3 — collapsible per-animation cards listing attachments affected by each animation's keyframes, a Setup Pose (Default) baseline card, Bone Path rendering, disabled-until-Phase-4 Override button, cross-card search, and a top-tab AppShell that resolves Phase 2's deferred app-shell question.
phase: 3
---

# Phase 3: Animation Breakdown panel — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 3` interactive session

<domain>
## Phase Boundary

Phase 3 introduces the **Animation Breakdown** panel (F4) alongside Phase 2's Global Max Render Source panel. A new `AppShell` component hosts a top-tab navigation that switches between the two panels. The Animation Breakdown panel renders a series of collapsible cards — one "Setup Pose (Default)" top card plus one card per animation in the skeleton. Each animation card lists only the attachments that animation's keyframes meaningfully affect (via scale-delta or AttachmentTimeline). Rows show Attachment | Bone Path | Source W×H | Scale | Peak W×H | Frame | [Override]. The Override button is rendered but disabled — Phase 4 wires the dialog. Phase 2's Source Animation chip upgrades to a jump-target button (resolves Phase 2 D-44).

**In scope:**
- `src/renderer/src/components/AppShell.tsx` — owns the filename chip (moved out of GlobalMaxRenderPanel), the tab strip, and the `activeTab` useState. Renders the active panel as children. Exposes a callback to panels so Phase 2's Source Animation chip can request `{ activeTab: 'animation', focusAnimationName: string }`.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — new panel. Renders Setup Pose card first, then one card per animation in skeleton JSON order. Owns useState for card collapse state (keyed by card ID), cross-card SearchBar query, and the `focusAnimationName` prop from AppShell (scroll + auto-expand).
- `src/core/sampler.ts` — **extended** to emit both the existing global peak map AND a new per-animation peak map. Single sampling pass; both outputs populated in one tick-lifecycle traversal.
- `src/core/analyzer.ts` — **augmented** with a sibling projection that folds the per-animation sampler output into a structured `AnimationBreakdown[]` shape (preformatted labels + raw numbers + Bone Path). Keeps Phase 2's existing `analyze()` export intact.
- `src/core/bones.ts` — **new small pure module** exposing `boneChainPath(slot: Slot): string[]` — returns `[root, ..., slot.bone.name, slotName, attachmentName]`. Pure delegation over spine-core's `Bone.parent` traversal; unit-tested via vitest. Alternatively, the planner may fold this into analyzer.ts if it stays below ~20 lines.
- `src/shared/types.ts` — add `AnimationBreakdown` interface + `BreakdownRow` interface. `SkeletonSummary.animationBreakdown: AnimationBreakdown[]` added to IPC payload. All shapes primitives-only (structuredClone-safe).
- `src/renderer/src/App.tsx` — the `status: 'loaded'` branch renders `<AppShell summary={...}>...</AppShell>` instead of `<GlobalMaxRenderPanel>` directly.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — **touched** only to upgrade the Source Animation cell from a chip (`<span>`) to a `<button>` that calls AppShell's jump callback (D-44 resolution).
- `src/renderer/src/components/SearchBar.tsx` — **reused** as-is by the new panel; no changes.
- `scripts/cli.ts` — **unchanged output**. If the sampler API shape changes, cli.ts adapts its call but produces byte-for-byte identical text (CLI has no animation-breakdown view; it remains a global-peak table).
- Tests:
  - `tests/core/sampler.spec.ts` — augmented with per-animation output assertions (N1.6 determinism extends: two runs produce bit-identical per-animation maps).
  - `tests/core/analyzer.spec.ts` — augmented with `AnimationBreakdown[]` fold assertions against SIMPLE_TEST fixture.
  - `tests/core/bones.spec.ts` — new, verifies Bone Path traversal on CHAIN_2..8 + TransformConstraint-driven bones.
  - `tests/arch.spec.ts` — existing Layer 3 defense auto-scans new files (AppShell, AnimationBreakdownPanel, bones.ts analyzer additions) for `src/core/*` boundary violations.

**Out of scope (deferred to later phases):**
- **Actual override dialog wiring + scale input** — Phase 4 (F5). The button renders disabled with tooltip in Phase 3.
- **Override badge rendering on rows** — Phase 4 consumes both the Global panel rows and the Animation Breakdown rows; both get the badge treatment at that time.
- **Unused attachment detection / cross-animation never-rendered flag** — Phase 5 (F6). The "affected" criterion here is per-animation, not cross-animation; the two are orthogonal.
- **Atlas Preview modal** — Phase 7.
- **Optimize Assets export** — Phase 6.
- **Save/Load session state** — Phase 8 (F9). Collapse state, active tab, search queries all reset on new skeleton drop / app reload.
- **UI virtualization for long card lists** — Phase 9 (N2.2). Collapsed-by-default default keeps most cards DOM-cheap; expanding Girl's 15 animations × ~10 affected attachments averages out fine. Retrofit windowing in Phase 9 if profiling shows jank.
- **Sampler worker thread** — Phase 9 (N2.2). The extended per-animation output roughly doubles the per-tick accounting cost (two peak maps instead of one); simple rig budget ~2.5 ms → estimated ~4–5 ms, still 100× under the N2.1 500 ms gate. Complex rig (Girl: 15 anims × 145 attachments) remains the Phase 9 worker-thread trigger.
- **Keyboard row navigation (arrow keys, Space to expand/collapse cards)** — Phase 9 polish.
- **Rig-info tooltip** (skeleton.fps metadata) — Phase 9.
- **Per-card sort customization, multi-card simultaneous view, side-by-side diff of two animations** — not requested; roadmap does not promise.
- **Settings modal** — Phase 9.
- **Persisting tab state / expand state across app reloads** — Phase 8.

</domain>

<decisions>
## Implementation Decisions

### AppShell & tab navigation

- **D-49: Top-tab AppShell resolves Phase 2 D-43 app-shell deferral.** A new `src/renderer/src/components/AppShell.tsx` hosts a horizontal tab strip at the top of the loaded view: `[ Global ] [ Animation Breakdown ]`. The filename chip moves from GlobalMaxRenderPanel's internal header up into AppShell, so both panels present consistent chrome. DropZone still wraps the whole window and still owns idle/loading/error states. The tab strip sits above the SearchBar level; each panel owns its own SearchBar + panel-specific chrome inside the tab body. Scrolled-stack, sidebar, and toggle-button alternatives explicitly rejected — top tabs scale cleanly to additional phases (Phase 5 Unused, Phase 7 Atlas Preview could register as more tabs).
- **D-50: AppShell state is plain useState, resets on new skeleton drop.** `useState<'global' | 'animation'>('global')` lives in AppShell. Default tab on first load and after every new drop is `'global'` — the overview comes before the drill-down. No persistence to localStorage; Phase 8's Save/Load domain owns cross-session persistence. Consistent with Phase 2 D-32's no-Zustand stance.
- **D-51: Tab labels are plain text, Global first.** `Global` | `Animation Breakdown`. Matches the roadmap taxonomy; no icons (no-new-deps discipline); Global first because it's the overview and matches phase ordering. Tab-switch state survives rerenders but not a new drop.
- **D-52: AppShell exposes a jump callback.** AppShell passes a `onJumpToAnimation: (animationName: string) => void` prop (or equivalent) down to GlobalMaxRenderPanel. Calling it sets `{ activeTab: 'animation', focusAnimationName }` in AppShell's state. AnimationBreakdownPanel reads `focusAnimationName` via prop, scrolls the matching card into view, auto-expands it if collapsed, and flashes it briefly (D-65). After the flash, AppShell clears `focusAnimationName` so manual nav still works.

### Per-animation data flow

- **D-53: Sampler emits BOTH global peaks and per-animation peaks in a single pass.** `src/core/sampler.ts`'s `sampleSkeleton` return shape extends from `Map<string, PeakRecord>` to `{ globalPeaks: Map<string, PeakRecord>, perAnimation: Map<string, PeakRecord> }` (or planner-chosen equivalent structure — named fields preferred over tuples). `globalPeaks` key format unchanged: `${skin}/${slot}/${attachment}`. `perAnimation` key format: `${animation}/${skin}/${slot}/${attachment}` — entries populated ONLY for attachments flagged "affected" in that animation per D-56. Setup-pose pass does not populate `perAnimation` (the Setup Pose card derives from `globalPeaks` filtered to setup-pose-originated records + skeleton traversal; see D-60).
- **D-54: "Affected" criterion: scale-delta > 1e-6 OR AttachmentTimeline names the attachment.** An attachment appears in animation X's card if EITHER (a) its computed peakScale during animation X differs from its setup-pose peakScale by more than 1e-6 (matches the sampler's existing PEAK_EPSILON; captures bone-scale, weighted-mesh deforms, TransformConstraints, IK, PathConstraints, Physics — all carried through `computeWorldVertices` per CLAUDE.md rule #2), OR (b) animation X has an `AttachmentTimeline` keyed to this attachment name on this slot (captures pure-visibility-swap animations like 'blink'). Either signal is sufficient. Scale-delta-only would miss blink; AttachmentTimeline-only would miss pure scale changes. Both together, zero false positives.
- **D-55: Detection lives in the sampler, not the analyzer.** The sampler already iterates every tick and already has each animation object in scope for the tick loop. Adding a per-tick delta check against setup-pose peakScale is cheap (~1 subtraction + 1 compare per attachment per tick). AttachmentTimeline scan is one pre-loop pass per animation (`anim.timelines.filter(t => t instanceof AttachmentTimeline)`). Moving this to analyzer would force re-sampling or per-tick record retention, blowing memory. Sampler owns detection; analyzer consumes a clean `perAnimation` map.

### Row granularity & columns (matches Phase 2's per-texture framing)

- **D-56: Row dedupe per animation card: one row per unique attachment name.** Matches Phase 2's gap-fix B semantic ("right-size textures per asset — one row = one unique texture"). Tiebreaker within animation: max `peakScale`, then deterministic `(skinName, slotName)` lexicographic. The winning (skin, slot) tuple's values populate the row's columns; the dedupe collapses multi-skin / multi-slot reuse to a single visible row.
- **D-57: Row columns (seven): Attachment | Bone Path | Source W×H | Scale | Peak W×H | Frame | [Override].** Mirrors Phase 2's column set with Bone Path inserted between Attachment and Source W×H, and the [Override] button appended. Value formatting reuses Phase 2 D-35/D-45/D-46: originalSizeLabel (`64×64`, Unicode ×), peakSizeLabel (`114×114` toFixed(0)), scaleLabel (`1.780×` toFixed(3) + Unicode ×). frameLabel is `String(frame)` for animation rows, `—` (em dash U+2014) for Setup Pose card rows (D-60).
- **D-58: Card order = skeleton JSON animation order.** Iterate `skeletonData.animations` directly; zero sorting. Matches the order animators see in the Spine editor dopesheet — predictable. Setup Pose (Default) card is separate and always rendered FIRST above the animation card list. Alphabetical / active-count / max-scale orderings explicitly rejected.
- **D-59: Row sort within a card = Scale DESC, LOCKED.** Matches Phase 2 D-29's top-level default. The highest-scale (most-actionable) attachment surfaces at the top of every card. Row sort is NOT user-adjustable in Phase 3 — click-to-sort headers per card would create 20+ sort controls on a complex rig, too noisy. Global per-panel sort picker rejected too (premature complexity). Phase 9 may reopen.

### Setup Pose card

- **D-60: Setup Pose (Default) top card lists every attachment in the skeleton at its setup-pose peak.** Baseline reference — "what does the rig look like with no animation playing." Includes attachments that no animation ever affects (they'd otherwise have no visible home on this panel). Same dedupe rule (one row per unique attachment name, tiebreaker max peakScale then (skin, slot)). Same column set; Frame column renders `—` (em dash) because there's no frame number in a static pose. Same Scale DESC sort — SQUARE2's pre-scaled `2.000×` setup-pose scale puts it at the top on SIMPLE_TEST, matching animator expectation.
- **D-61: Setup Pose card cannot be "empty".** Every skeleton has at least one attachment in setup pose. The "No assets referenced" state is an animation-card-only concern (D-62).
- **D-62: "No assets referenced" triggers when animation's affected set is empty.** If `perAnimation` has zero keys starting with `${animationName}/`, the card renders the expanded (or collapsed) view with a single muted-text row: `No assets referenced`. Styled `text-fg-muted font-mono text-sm text-center py-8` — identical to Phase 2 D-41 zero-results row. Collapsed header still renders the animation name + `— No assets referenced` in place of the asset count. Clicking to expand is allowed (clarity > hiding the affordance) but the expanded card contains only the empty-state row.

### Card expand/collapse UX

- **D-63: Default expand state — Setup Pose expanded, all animation cards collapsed.** Setup Pose is the baseline reference animators want to see first. Animation cards default collapsed so the panel opens compact — on rigs like Girl (15 animations) the whole panel fits on-screen without scroll until the user starts drilling in. Simple rig (5 animations) also benefits — compact overview before expand.
- **D-64: Expand state is `useState<Set<string>>` keyed by `cardId`, stored in AnimationBreakdownPanel.** Survives tab switches (state lives above the tab body); resets on new skeleton drop (the panel unmounts with AppShell when AppState transitions through idle/loading). `cardId` is `"setup-pose"` for the top card, `"anim:${animationName}"` for each animation card. The Set holds currently-expanded card IDs; default initialization is `new Set(["setup-pose"])`. No localStorage persistence.
- **D-65: Collapsed card header: `▸ {name} — {N} unique assets referenced`** (or `— No assets referenced` when empty). Unicode right-pointing caret `▸` (U+25B8) for collapsed, `▾` (U+25BE) for expanded. Caret left-aligned, animation name next, then em-dash + asset count. Entire header row is a `<button>` for accessibility (native keyboard activation, focus ring, aria-expanded). `N unique assets referenced` wording matches approved-plan prose verbatim. Asset count = length of the dedup'd row list for that card. For Setup Pose card, the asset count is the total attachment count (since all attachments are listed).
- **D-66: Jump-target cards get a brief flash highlight.** When AppShell passes `focusAnimationName`, the panel scrolls the target card into view, adds it to the expanded Set, and applies a temporary `ring-2 ring-accent` class for ~1 second before removing it. After the flash, the panel clears `focusAnimationName` in AppShell (via callback) so manual navigation state stays clean.

### Bone Path

- **D-67: Bone Path = full bone chain, mid-ellipsis on overflow, hover reveals full path.** Format: `root → CTRL → CHAIN_2 → ... → CHAIN_8 → slotName → attachmentName`. Unicode right arrow `→` (U+2192) as separator (matches approved-plan prose `source → scale → peak`). CSS truncation via a hand-rolled mid-ellipsis routine: if rendered width exceeds column width, keep root and last N tokens, replace middle with `…` (U+2026). The row's `<td>` also carries a `title={fullPath}` attribute so hovering reveals the untruncated chain — consistent with Phase 2's native-tooltip approach. Styled `font-mono text-xs text-fg-muted` — lighter than the attachment-name cell to de-emphasize structural information.
- **D-68: Bone Path computation lives in `src/core/bones.ts`** (or folded into analyzer.ts at planner's discretion if under ~20 lines). Signature: `function boneChainPath(slot: Slot, attachmentName: string): string[]`. Traverses `slot.bone` up through `Bone.parent` chain to the root, reverses, appends `slot.data.name`, appends `attachmentName`. Pure delegation over spine-core API; no math. Tested on SIMPLE_TEST fixture: CIRCLE on CHAIN_8 produces `['root','CTRL','CHAIN_2','CHAIN_3','CHAIN_4','CHAIN_5','CHAIN_6','CHAIN_7','CHAIN_8','CIRCLE_slot_or_similar','CIRCLE']`.

### Override button (Phase 4 deferral)

- **D-69: Override button rendered with `disabled={true}` + `title="Coming in Phase 4"`.** Reserves the Column 7 visual real estate so Phase 4 is pure wire-up (no layout re-shuffling). Button uses the existing Phase 2 `border-border rounded-md px-2 py-0.5 text-xs font-mono` chip style, dimmed to `opacity-50 cursor-not-allowed`. Clicking does nothing (native HTML disabled semantics prevent click firing). No stub dialog, no placeholder modal — those would be churn that Phase 4 has to delete.

### Cross-card search

- **D-70: Panel header SearchBar filters attachment names across all cards.** Reuses `src/renderer/src/components/SearchBar.tsx` (zero changes). Placed in AnimationBreakdownPanel's header next to the panel title. Filter logic: for each card's row list, apply the same case-insensitive substring match on `attachmentName` (Phase 2 D-37). A card with zero matching rows renders its collapsed header with an "N / M match" indicator style (`2 / 8 unique assets — filtered`) and, when expanded, only shows matching rows with match-highlighting (reuse Phase 2 D-40 `<mark>` utility). An empty search query shows all rows in all cards (no filtering). No debounce (Phase 2 D-38 reasoning carries forward: per-keystroke `.filter()` on a few-hundred-row total is sub-ms).
- **D-71: Auto-expand cards with matching rows when search is active.** When search query is non-empty, any card whose filtered row list is non-empty auto-expands (even if the user had collapsed it). When query clears, cards revert to their user-chosen expand state (not the initial default — preserve user intent). Implemented as a derived Set: `effectiveExpanded = query === '' ? userExpanded : new Set([...userExpanded, ...cardsWithMatches])`. This is a pragmatic UX: search is pointless if matches hide inside collapsed cards.

### Phase 2 Source Animation chip upgrade (D-44 resolution)

- **D-72: Source Animation cell in GlobalMaxRenderPanel becomes a `<button>`.** Clicking calls `onJumpToAnimation(row.sourceLabel)` (new prop passed from AppShell). Setup Pose rows (`row.sourceLabel === 'Setup Pose (Default)'`) call the same callback with `'Setup Pose (Default)'` — which the panel interprets as "jump to Setup Pose card." Visual style stays the chip style from Phase 2 D-44, plus `hover:bg-accent/10 cursor-pointer` and a focus ring. aria-label set to `Jump to ${sourceLabel} in Animation Breakdown`. Non-interactive visual behavior from Phase 2 stays as the fallback when no handler is provided (component stays decoupled if ever rendered outside AppShell).

### Claude's Discretion (not locked)

- Exact sampler return type shape (object with named fields vs tuple vs class instance) — planner's call; named-field object recommended for structuredClone compatibility and readable destructuring.
- Whether `bones.ts` is a separate module or folded into `analyzer.ts` — planner's call; if under ~20 lines of pure logic, folding into analyzer is fine.
- Flash-highlight duration (~800ms vs ~1200ms) — planner picks a reasonable value; aesthetic call.
- Exact focus-ring / flash CSS class choice (`ring-2 ring-accent` vs `bg-accent/20` pulse) — planner picks; follow D-12/D-13 color tokens.
- Whether the expand-all-on-search state persists after the query clears, or reverts — D-71 specifies reverts; planner may refine with a "smart revert" (only auto-collapse cards that were auto-expanded by search, not ones user manually expanded during search).
- Tab keyboard shortcuts (e.g., `Cmd/Ctrl+1` for Global, `Cmd/Ctrl+2` for Animation) — nice-to-have, not locked; Phase 9 polish candidate.
- Tab strip visual style: underline-indicator vs pill-style active-tab — planner's call; follow warm-stone + orange-accent tokens.
- The precise ARIA pattern for collapsible cards (native `<details>/<summary>` vs hand-rolled `<button aria-expanded>`) — planner's call; hand-rolled `<button>` gives tighter CSS control, `<details>` gives free keyboard support. Either is acceptable.
- Whether Bone Path truncation is CSS-only (`text-overflow: ellipsis` with end-ellipsis) or hand-rolled mid-ellipsis — D-67 specifies mid-ellipsis but planner may escalate if CSS container queries make it complex; end-ellipsis is acceptable fallback.
- Renderer test approach (Testing Library vs happy-dom plain DOM) — Phase 2 left this open; Phase 3 inherits the open decision. Planner's call, consistent with Phase 2 choice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Phase 4 — Animation Breakdown panel (screenshot 3)" — canonical description of per-animation collapsible cards, `N unique assets referenced` / `No assets referenced` header, per-attachment row with Bone Path + `source → scale → peak` + Frame N + Override Scale button, plus Setup Pose (Default) top card. Note: approved-plan Phase 4 == roadmap Phase 3 (approved-plan and roadmap numbering differ; roadmap is authoritative for phase ordering).
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Critical technical patterns & references" — reiterates that `computeWorldVertices` after `updateWorldTransform(Physics.update)` already carries all bone-chain / constraint / physics math. Phase 3 consumes these; zero new runtime math.

### Project instructions
- `CLAUDE.md` — fact #2 (`computeWorldVertices` handles all constraint + physics math; do not reimplement) locks the scale-delta "affected" test on sampler-emitted peakScale values, not hand-rolled re-computation. Fact #3 (locked tick lifecycle) stays inviolate when the sampler is extended. Fact #5 (`core/` pure TS, no DOM) locks `src/core/bones.ts` + the analyzer additions.

### Requirements
- `.planning/REQUIREMENTS.md` §F4 — the four locked requirements:
  - F4.1 Collapsible per-animation cards with unique asset count (or "No assets referenced") → D-62, D-65.
  - F4.2 "Setup Pose (Default)" top card → D-60, D-61.
  - F4.3 Per-row Bone Path + `source → scale → peak → frame` → D-57, D-67.
  - F4.4 Per-row Override Scale button → D-69 (present + disabled for Phase 3; Phase 4 wires dialog).
- `.planning/REQUIREMENTS.md` §F2 — unchanged; the per-animation peak data comes from spine-core math Phase 0 already nailed down.
- `.planning/ROADMAP.md` §"Phase 3 — Animation Breakdown panel" — deliverables (AnimationBreakdownPanel.tsx, Setup Pose top card, "No assets referenced" state) and exit criteria (every animation renders its own card; animations with no activity render empty state).

### Phase 0/1/2 artifacts (Phase 3 consumers + extension targets)
- `src/core/sampler.ts` — **extension target.** Must emit both `globalPeaks` and `perAnimation` maps in a single pass. Must detect "affected" via scale-delta OR AttachmentTimeline per D-54. PEAK_EPSILON (1e-9) already defined — consider reusing or introducing SCALE_DELTA_EPSILON = 1e-6 per D-54.
- `src/core/types.ts` — `SampleRecord` stable; `PeakRecord` extends it. The new per-animation shape reuses these.
- `src/core/analyzer.ts` — **augmentation target.** Phase 2's `analyze(peaks): DisplayRow[]` stays intact. Add a sibling projection `analyzeBreakdown(perAnimation, skeletonData): AnimationBreakdown[]` (name at planner's discretion) that folds per-animation peaks + Bone Path into cards. Setup Pose card construction may need access to `skeletonData` for the full attachment list across skins (D-60 baseline reference).
- `src/core/bones.ts` — **new.** Bone Path traversal (D-68).
- `src/main/summary.ts` — **extension target.** Builds `SkeletonSummary.animationBreakdown` via the new analyzer export alongside the existing `peaks` field. Both fields on the same payload.
- `src/shared/types.ts` — **extension target.** Add `AnimationBreakdown` + `BreakdownRow` (or equivalent) interfaces. Update `SkeletonSummary` to include `animationBreakdown: AnimationBreakdown[]`.
- `src/renderer/src/App.tsx` — wraps the `status: 'loaded'` branch in `<AppShell summary={state.summary}>`. Children remain the panel components; AppShell owns the tab state and passes active tab down.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — **touched** only for D-72 Source Animation chip → button upgrade. Otherwise unchanged.
- `src/renderer/src/components/SearchBar.tsx` — **reused** as-is.
- `scripts/cli.ts` — adapts to the sampler's new return shape if needed; output stays byte-for-byte identical (CLI has no animation-breakdown view).
- `.planning/phases/00-core-math-spike/00-CONTEXT.md` §"CLI Contract (locked)" — Unicode × + "Setup Pose (Default)" label still authoritative.
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md` §"Implementation Decisions" — D-11 through D-27 carry forward (color tokens, font-mono = JetBrains Mono, useState, cross-platform discipline, three-layer defense).
- `.planning/phases/02-global-max-render-source-panel/02-CONTEXT.md` §"Implementation Decisions" — D-28 through D-48 all relevant. Especially:
  - **D-28** (hand-rolled over deps) — Phase 3 hand-rolls AppShell tabs + collapsible cards, no accordion library.
  - **D-29** (default sort Scale DESC) — Phase 3 D-59 mirrors this per-card.
  - **D-32** (plain useState) — D-50/D-64 reaffirm.
  - **D-35** (DisplayRow preformatted labels + raw numbers) — Phase 3's `BreakdownRow` inherits the same split.
  - **D-37 / D-38 / D-40 / D-41** (search, no debounce, match highlight, zero-results row) — reused.
  - **D-43** (app-shell deferred) — **D-49 resolves it.**
  - **D-44** (Source Animation chip deferred to interactive button) — **D-72 resolves it.**
  - **D-45 / D-46** (Scale label, size labels) — reused verbatim.
  - **D-47** (font-mono everywhere) — reused.

### spine-core API reference (for researcher / planner)
- `@esotericsoftware/spine-core` `AttachmentTimeline` class — used in D-54 for pure-visibility-swap detection. `animation.timelines: Timeline[]`; filter via `instanceof AttachmentTimeline`. Each `AttachmentTimeline` exposes `slotIndex` and a frames array of attachment names keyed at specific times.
- `@esotericsoftware/spine-core` `Bone.parent: Bone | null` — root bone has null parent. Used in D-68 for Bone Path traversal.
- `@esotericsoftware/spine-core` `Slot.bone` + `Slot.data.name` — used for Bone Path leaf-construction per D-68.
- Spine 4.2 API reference: <http://esotericsoftware.com/spine-api-reference> — canonical docs.

### External
- [WAI-ARIA Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) — accessibility wiring for collapsible card headers (aria-expanded, keyboard activation).
- [WAI-ARIA Tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) — tab-strip keyboard navigation (arrow keys, Home/End) for AppShell.
- [MDN `<details>/<summary>`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/details) — alternative collapse implementation; planner evaluates.
- [React `useMemo` docs](https://react.dev/reference/react/useMemo) — derived `filteredCards` / `sortedRowsPerCard` memoization keeps re-renders O(n_rows) per keystroke.

### Fixtures (Phase 3 drop + verify targets)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — primary drop-test target. Expected output: Setup Pose card with 3 rows (CIRCLE, SQUARE, TRIANGLE — dedup'd from 4 peak records by D-56); one animation card per animation in fixture; each animation card lists only attachments affected per D-54. Animation cards with no activity render "No assets referenced."
- `fixtures/Jokerman/` and `fixtures/Girl/` — complex-rig human-verify targets. Girl's 15 animations × 145 attachments exercise the collapse-by-default scaling decision (D-63) and the per-animation dedupe behavior at scale.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/renderer/src/components/SearchBar.tsx`** — reused verbatim in AnimationBreakdownPanel header (D-70). No prop changes; it's already a pure controlled input with clear button + ESC-clears wire-up.
- **`src/core/analyzer.ts`** — existing `analyze()` + dedup pattern is the template for the new `analyzeBreakdown()`. Same preformatted-labels + raw-numbers split (Phase 2 D-35). Same dedup-by-attachment-name logic (Plan 02-03 gap-fix B).
- **`src/core/sampler.ts`** — locked tick lifecycle stays. Extension point is the inner `snapshotFrame` call where we already have each attachment's computed scale in scope. Per-animation peak tracking piggybacks on that.
- **`src/main/summary.ts`** — skeleton header projection stays. Adds a second `analyzeBreakdown()` call alongside `analyze()`. IPC envelope picks up one more field.
- **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** — reference implementation for hand-rolled table with sort + select + dedup. Phase 3 borrows the table-cell styling conventions (`font-mono`, `py-2 px-3`, chip styling for Source Animation). The panel itself is touched ONLY for D-72 chip → button upgrade.
- **`src/renderer/src/components/DropZone.tsx`** — unchanged; wraps the whole AppState machine.
- **Tailwind `@theme` tokens** (`bg-panel`, `border-border`, `text-fg`, `text-fg-muted`, `text-accent`, `bg-accent/5`, `bg-accent/20`, `font-mono`, `ring-accent`) — all defined. Phase 3 may add a `.ring-focus` or `.card-collapsed` utility class if convenient, but no new @theme tokens needed.

### Established Patterns (from Phase 0/1/2)
- **Hand-rolled over deps** — Phase 0 hand-rolled the CLI table; Phase 1 hand-rolled drag handlers; Phase 2 hand-rolled the sortable/selectable table; Phase 3 hand-rolls tabs + collapsible cards + Bone Path truncation. Zero new runtime dependencies expected.
- **Preformatted labels + raw numbers** — Phase 2's `DisplayRow` + `BreakdownRow` pattern: renderer does zero formatting; core emits ready-to-render strings alongside raw numbers for any sort decision.
- **Three-layer `core/` ↛ `renderer/` defense** — Layer 1 (tsconfig exclude) + Layer 2 (bundler alias absence) + Layer 3 (arch.spec.ts) still live. Phase 3's new files (AppShell, AnimationBreakdownPanel, bones.ts) MUST comply. Layer 3 auto-scans new files. Renderer MUST consume `BreakdownRow[]` via `window.api` IPC only, never via direct core import.
- **Locked tick lifecycle** — CLAUDE.md rule #3's `state.update → state.apply → skeleton.update → skeleton.updateWorldTransform(Physics.update)` ordering MUST NOT be broken when extending the sampler. The arch.spec.ts grep gate + sampler.spec.ts's locked-order assertion already enforce this; extend the assertions, don't rewrite them.
- **Grep-literal-in-comments compliance** — Phase 1 + Phase 2 repeatedly hit the "comment cites a forbidden-literal token → grep acceptance gate fails" footgun. Phase 3 planner pre-emptively writes prose over literal tokens for any `! grep -q "X"` gate.
- **Atomic commits per logical unit** — Phase 2 used `feat(02-panel):`, `refactor(02-panel):`. Phase 3 should mirror: `feat(03-breakdown):`, `refactor(03-breakdown):`, `fix(03-breakdown):` as scopes.
- **Test gating: `npm run typecheck` + `npm run test`** — Phase 2 closed at 66 + 1 skip. Phase 3 plans should land at 70+ + 1 skip (adding sampler per-animation + analyzer breakdown + bones.ts + panel specs).
- **Human-verify-is-load-bearing** — Phase 1 (sandbox/ESM preload) and Phase 2 (Node 24 CJS main + per-slot-vs-per-texture dedupe) both caught critical bugs at human-verify that evaded every automated gate. Phase 3 ships with an equivalent `checkpoint:human-verify` gate on the final plan: drop SIMPLE_TEST.json, verify tab switching, card expand/collapse, Setup Pose card contents, empty-state animation, Bone Path rendering, Override button disabled tooltip, Source Animation chip jump-to behavior.

### Integration Points
- **AppShell ↔ Panel jump callback** — AppShell exposes `onJumpToAnimation(animationName: string): void` to children. GlobalMaxRenderPanel receives it via prop. AnimationBreakdownPanel receives `focusAnimationName: string | null` via prop + an `onFocusConsumed: () => void` callback. Minimal prop surface area.
- **IPC payload extension** — `SkeletonSummary.animationBreakdown: AnimationBreakdown[]` is a new structured-clone-safe field. All primitives / plain objects / arrays; no classes or Maps. Both main-process writer and renderer reader consume the `src/shared/types.ts` interface.
- **Sampler signature change** — breaking change inside the core module boundary. Callers today: `src/main/summary.ts`, `scripts/cli.ts`, `src/core/analyzer.ts` (implicitly via the IPC path), tests in `tests/core/sampler.spec.ts`. All four updated in lock-step with the sampler change.
- **AnimationBreakdownPanel layout** — lives in `src/renderer/src/panels/` next to GlobalMaxRenderPanel (established in Phase 2). Components shared across panels (SearchBar, future chrome) stay in `src/renderer/src/components/`.

### Constraints from Phase 0/1/2
- `core/` stays DOM-free (fact #5). Analyzer, bones.ts, sampler additions all pure TS.
- N2.3 zero filesystem I/O in sampler hot loop — unchanged. Extending the sampler's data emission does not introduce I/O. arch.spec.ts already scans for `node:fs` / `node:path` / `sharp` in `src/core/*`.
- D-23 no `process.platform` branches, no macOS-only APIs anywhere in Phase 3 code.
- D-25 / D-26 no `/` literals in path contexts — N/A (Phase 3 handles no filesystem paths).
- Locked tick lifecycle (CLAUDE.md rule #3) — preserved; sampler extension adds data capture inside the existing lifecycle, doesn't reorder.
- Phase 1 locked `loader.ts` as stable; Phase 2 locked `sampler.ts` as stable. **Phase 3 REOPENS `sampler.ts` for the per-animation output extension** — this is an intentional scope-expansion signed off by this CONTEXT (D-53 / D-55). The test suite's sampler contracts (locked lifecycle, PEAK_EPSILON, N1.6 determinism) remain; new assertions layer on top. If an unexpected second need for sampler extension arises during Phase 3 execution, the planner should escalate rather than silently widen.
- **Electron runtime caveats preserved:** `main` bundle must stay CJS (Plan 02-03 commit `9424903` + arch.spec guards), `preload` bundle must stay CJS (Plan 01-05 commit `b5d6988` + arch.spec guards). `ELECTRON_RUN_AS_NODE=1` must be scrubbed from user shell for `npm run dev`. These carry into Phase 3's dev/build cycle.

</code_context>

<specifics>
## Specific Ideas

### Extended sampler shape (seeded for planner)

```ts
// src/core/sampler.ts
export interface SamplerOutput {
  globalPeaks: Map<string, PeakRecord>;          // key: ${skin}/${slot}/${attachment} — unchanged semantics
  perAnimation: Map<string, PeakRecord>;         // key: ${animation}/${skin}/${slot}/${attachment}
                                                 //   entries only for "affected" attachments per D-54
}

export function sampleSkeleton(
  load: LoadResult,
  opts: SamplerOptions = {},
): SamplerOutput {
  // ... locked lifecycle unchanged ...
  // During each animation's tick loop, also capture into perAnimation whenever
  //   scale-delta > 1e-6 OR the attachment is named by an AttachmentTimeline.
}
```

### AnimationBreakdown shape (seeded for planner)

```ts
// src/shared/types.ts
export interface AnimationBreakdown {
  cardId: string;                // 'setup-pose' OR `anim:${animationName}`
  animationName: string;         // 'Setup Pose (Default)' for the top card
  isSetupPose: boolean;
  uniqueAssetCount: number;      // length of rows[] (zero when empty)
  rows: BreakdownRow[];          // empty array = "No assets referenced"
}

export interface BreakdownRow {
  // keys + raw numbers (sort + future selection)
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  bonePath: string[];            // raw bone chain for programmatic use
  animationName: string;
  frame: number;
  peakScale: number;             // sort key (DESC per D-59)
  peakScaleX: number;
  peakScaleY: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  time: number;
  // preformatted labels
  bonePathLabel: string;         // 'root → CTRL → CHAIN_2 → ... → CHAIN_8 → slot → attachment'
  originalSizeLabel: string;
  peakSizeLabel: string;
  scaleLabel: string;
  sourceLabel: string;
  frameLabel: string;            // '—' (em dash) for setup-pose rows, String(frame) otherwise
}
```

### AppShell skeleton (seeded for planner)

```tsx
// src/renderer/src/components/AppShell.tsx
export function AppShell({ summary }: { summary: SkeletonSummary }) {
  const [activeTab, setActiveTab] = useState<'global' | 'animation'>('global');
  const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

  const jumpToAnimation = useCallback((name: string) => {
    setActiveTab('animation');
    setFocusAnimationName(name);
  }, []);

  const clearFocus = useCallback(() => setFocusAnimationName(null), []);

  return (
    <div className="w-full h-full flex flex-col">
      <header className="flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
        <FileChip path={summary.skeletonPath} />
        <nav className="flex gap-1" role="tablist">
          <TabButton active={activeTab === 'global'} onClick={() => setActiveTab('global')}>Global</TabButton>
          <TabButton active={activeTab === 'animation'} onClick={() => setActiveTab('animation')}>Animation Breakdown</TabButton>
        </nav>
      </header>
      <main className="flex-1 overflow-auto">
        {activeTab === 'global' && (
          <GlobalMaxRenderPanel summary={summary} onJumpToAnimation={jumpToAnimation} />
        )}
        {activeTab === 'animation' && (
          <AnimationBreakdownPanel
            summary={summary}
            focusAnimationName={focusAnimationName}
            onFocusConsumed={clearFocus}
          />
        )}
      </main>
    </div>
  );
}
```

### AnimationBreakdownPanel skeleton (seeded for planner)

```tsx
// src/renderer/src/panels/AnimationBreakdownPanel.tsx
export function AnimationBreakdownPanel({
  summary,
  focusAnimationName,
  onFocusConsumed,
}: {
  summary: SkeletonSummary;
  focusAnimationName: string | null;
  onFocusConsumed: () => void;
}) {
  const [query, setQuery] = useState('');
  const [userExpanded, setUserExpanded] = useState<Set<string>>(new Set(['setup-pose']));

  const filteredCards = useMemo(
    () => filterCardsByAttachmentName(summary.animationBreakdown, query),
    [summary.animationBreakdown, query],
  );

  const effectiveExpanded = useMemo(() => {
    if (query === '') return userExpanded;
    const cardsWithMatches = filteredCards.filter(c => c.rows.length > 0).map(c => c.cardId);
    return new Set([...userExpanded, ...cardsWithMatches]);
  }, [query, userExpanded, filteredCards]);

  // Jump-target effect: scroll + auto-expand + flash + clear focus
  useEffect(() => {
    if (!focusAnimationName) return;
    const cardId = focusAnimationName === 'Setup Pose (Default)' ? 'setup-pose' : `anim:${focusAnimationName}`;
    setUserExpanded(prev => new Set([...prev, cardId]));
    // scroll + flash handled by a ref + className transition ...
    const flashTimer = setTimeout(onFocusConsumed, 1000);
    return () => clearTimeout(flashTimer);
  }, [focusAnimationName, onFocusConsumed]);

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="flex items-center gap-4 mb-4">
        <h2 className="text-lg">Animation Breakdown</h2>
        <SearchBar value={query} onChange={setQuery} placeholder="Filter rows across cards…" />
      </header>
      <div className="flex flex-col gap-3">
        {filteredCards.map(card => (
          <AnimationCard
            key={card.cardId}
            card={card}
            expanded={effectiveExpanded.has(card.cardId)}
            onToggle={() => toggleCard(card.cardId, setUserExpanded)}
            query={query}
            isFlashing={focusAnimationName != null && matchesFocus(card, focusAnimationName)}
          />
        ))}
      </div>
    </div>
  );
}
```

### Expected SIMPLE_TEST.json animation breakdown (fixture for plan acceptance)

With default expand state (Setup Pose only), no search, fresh drop:

```
┌─ filename: SIMPLE_TEST.json ──────────────────────────┐
│ [ Global ] [ Animation Breakdown (active) ]           │
├───────────────────────────────────────────────────────┤
│ Animation Breakdown        [ search box             ] │
│                                                       │
│ ▾ Setup Pose (Default) — 3 unique assets referenced   │
│   ┌──────────┬──────────────────────┬───────┬───────┐ │
│   │ Attach.  │ Bone Path            │ Scale │ ...   │ │
│   ├──────────┼──────────────────────┼───────┼───────┤ │
│   │ SQUARE   │ root→CTRL→…→SQUARE2  │ 2.000×│ ...   │ │  (dedup winner picks SQUARE2)
│   │ CIRCLE   │ root→CTRL→CHAIN_…    │ 1.000×│ ...   │ │
│   │ TRIANGLE │ root→CTRL→…→TRI_slot │ 1.000×│ ...   │ │
│   └──────────┴──────────────────────┴───────┴───────┘ │
│                                                       │
│ ▸ [anim_name_1] — N unique assets referenced          │  (collapsed by default)
│ ▸ [anim_name_2] — N unique assets referenced          │
│ ▸ [anim_name_3] — No assets referenced                │  (empty-state trigger)
│ ...                                                   │
└───────────────────────────────────────────────────────┘
```

### Setup Pose card contents on SIMPLE_TEST (dedup'd)

Per D-56 dedupe-by-attachment-name with tiebreaker max peakScale then (skin, slot):
- CIRCLE (default skin, on CHAIN_8 slot) — setup-pose peakScale ≈ 1.0× (or the exact value from sampler golden; aligned with Phase 2 global-peak dedupe winner)
- SQUARE (default skin, pre-scaled bone wins) — setup-pose peakScale = 2.000× (SQUARE2's bone scale)
- TRIANGLE (default skin) — setup-pose peakScale ≈ 1.0×

3 rows total, matching Phase 2's post-dedupe count (which is the canonical "unique textures" metric per gap-fix B).

### Reference screenshot

Approved plan's "screenshot 3" (as referenced in `~/.claude/plans/i-need-to-create-zesty-eich.md` §Phase 4) is the canonical visual reference. Warm-stone dark background, orange-accent active-tab underline, monospace row cells, `▸/▾` caret headers, muted Bone Path cells, disabled override button chip.

</specifics>

<deferred>
## Deferred Ideas

- **Actual override dialog + scale input flow.** Phase 4 (F5). D-69's disabled button becomes wire-up here.
- **Override badge rendering across rows.** Phase 4 consumes both panels.
- **Cross-animation unused attachment flag / "never rendered" section.** Phase 5 (F6). Orthogonal to the per-animation "affected" criterion (D-54).
- **Atlas Preview modal.** Phase 7.
- **Optimize Assets export flow.** Phase 6. Phase 2's selection set is still the target; Phase 3 doesn't add new selection UX.
- **Save/Load session state (tab state, expand state, search query persistence).** Phase 8.
- **UI virtualization for long card lists / large row-per-card counts.** Phase 9 (N2.2). Collapsed-by-default helps today; windowing is a real concern on Girl (15 × ~10 expanded rows) only when all expanded at once.
- **Sampler worker thread.** Phase 9. Per-animation emission roughly doubles per-tick cost; still well under N2.1 simple-rig gate, but complex-rig N2.2 gate may push us there.
- **Keyboard shortcuts:** `Cmd/Ctrl+1` / `Cmd/Ctrl+2` for tab switching; `ArrowUp/Down` for card focus; `Space` or `Enter` to expand/collapse. Phase 9 polish.
- **Per-card sort customization.** D-59 locks Scale-DESC; retrofit only on explicit user ask.
- **Side-by-side animation comparison.** Not requested; potential future feature.
- **Rig-info tooltip showing `skeleton.fps` (editor metadata).** Phase 9.
- **Settings modal for sampling rate, default expand state, search defaults.** Phase 9.
- **Nyquist-style / second-order "affected" signals** (e.g., a bone that's animated but whose effective scale-delta is zero due to compensating constraints) — D-54's scale-delta + AttachmentTimeline combo catches the actionable cases; more exotic signals are a Phase 9 refinement if real user data surfaces a miss.
- **`isNeverActive` / Phase 5 unused flag bubbled into Animation Breakdown.** Phase 5 may add a visual hint on Setup Pose card rows that no animation touches; deferred until Phase 5 actually computes that boolean.

</deferred>

---

*Phase: 03-animation-breakdown-panel*
*Context gathered: 2026-04-23 via `/gsd-discuss-phase 3`*
