---
name: Phase 4 — Scale overrides Context
description: Locked decisions for Phase 4 — per-attachment percentage override of peak scale, clamped at source max, badged inline in both panels, with opportunistic batch-via-selection on the Global panel. Session-scoped useState in AppShell; Phase 8 later wires persistence.
phase: 4
---

# Phase 4: Scale overrides — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 4` interactive session

<domain>
## Phase Boundary

Phase 4 introduces **scale overrides** (F5) — the animator can set a per-attachment percentage scale override that clamps at source-max and is badged inline across both panels. Ships `src/core/overrides.ts` (pure-TS model + clamping), `src/renderer/src/modals/OverrideDialog.tsx` (percentage input dialog), and inline scale-cell badging on both `GlobalMaxRenderPanel` and `AnimationBreakdownPanel`. Override state lives in `AppShell` alongside `activeTab` + `focusAnimationName` — plain `useState<Map<attachmentName, overridePercent>>`, session-scoped, reset on new skeleton drop (Phase 8 owns cross-session persistence).

**In scope:**
- `src/core/overrides.ts` — **new pure-TS module**. Exports: `clampOverride(percent: number): number` (clamps integer input to [1, 100]), `applyOverride(peakScale: number, overridePercent: number): { effectiveScale: number, clamped: boolean }` (returns `peakScale × overridePercent / 100` with a `clamped` flag when the raw input exceeded 100). No React, no DOM, no spine-core dependency — pure number math over primitives. Unit-tested via vitest.
- `src/renderer/src/modals/OverrideDialog.tsx` — **new**. Percentage input modal with integer `<input type="number" min=1 max=100>` + `%` suffix label, Apply / Cancel / Reset buttons, ESC-closes, click-outside-closes, focus-trap, Enter-to-apply. Reads current override value on open (defaults to 100 if not overridden). Dialog title branches on scope: `"Override scale — {attachmentName}"` (single) vs `"Override scale — {N} selected rows"` (batch).
- `src/renderer/src/components/AppShell.tsx` — **extension target**. Owns a new `overrides: Map<string, number>` state alongside `activeTab` + `focusAnimationName`. Exposes `onOpenOverrideDialog(row: DisplayRow | BreakdownRow, selectedKeys?: Set<string>)` and `onApplyOverride(scope: string[], percent: number)` and `onClearOverride(scope: string[])` callbacks to children. Branches batch vs single based on whether the triggering row's `attachmentName` is in a `selectedKeys` set of size > 1.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — **touched**. (a) Add `onDoubleClick` on the Scale cell (`<td>`) that calls `onOpenOverrideDialog(row, selectedRowKeys)`. (b) Render scale-cell inline override badge when `overrides.get(row.attachmentName)` is set. (c) Recompute `Peak W×H` cell to reflect the override. Selection-set and sort/search logic unchanged.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — **touched**. (a) Wire the Phase 3 D-69 disabled Override button to `onClick={() => onOpenOverrideDialog(row)}` — remove `disabled`, remove `title="Coming in Phase 4"`, remove `opacity-50 cursor-not-allowed`. (b) Add `onDoubleClick` on the Scale cell. (c) Render scale-cell inline override badge + recomputed Peak W×H. No selection UI on this panel — always per-row. No batch path.
- `src/shared/types.ts` — **extension target**. Add `OverrideRecord` (or inline the `Map` shape). Extend `DisplayRow` + `BreakdownRow` with optional pre-formatted `overrideLabel?: string` and raw `overridePercent?: number` + `effectiveScale?: number` + `effectivePeakW?: number` + `effectivePeakH?: number` — OR keep the overrides layer entirely renderer-side via a derived-selector pattern (planner's call, see Claude's Discretion). Either is acceptable as long as Phase 6 can consume the effective dims without re-sampling.
- Tests:
  - `tests/core/overrides.spec.ts` — **new**. `clampOverride(200)` → 100; `clampOverride(50)` → 50; `clampOverride(0)` → 1; `clampOverride(-5)` → 1; `applyOverride(1.78, 50)` → `{ effectiveScale: 0.89, clamped: false }`; `applyOverride(1.78, 200)` → `{ effectiveScale: 1.78, clamped: true }`; `applyOverride(0.6, 50)` → `{ effectiveScale: 0.3, clamped: false }`.
  - `tests/arch.spec.ts` — Layer 3 auto-scans new files (`overrides.ts`, `OverrideDialog.tsx`) for `src/core/*` boundary violations. No new arch entries needed; the existing grep pattern picks them up.
  - Renderer dialog/badge tests — planner's call, consistent with Phase 3's decision on Testing Library vs happy-dom. Must include: dialog opens on double-click, Apply writes, Reset clears, batch mode heading differs, clamp shows in the stored value, badge renders correctly.

**Out of scope (deferred to later phases):**
- **Cross-session persistence of overrides** — Phase 8 (F5.4 + F9.1). Session state resets on new drop or app reload.
- **Phase 6 export consumption of overrides** — Phase 6 wires `src/core/export.ts` to read the overrides map and compute target dims as `source × effectiveScale`. Phase 4 just makes the data available in a predictable shape.
- **Phase 7 atlas preview consumption** — Phase 7 reads the same overrides map to compute before/after packed dims.
- **Undo/redo history for overrides** — not requested; Reset + single-value replacement is the only rollback in Phase 4.
- **Import/export overrides as JSON standalone** — Phase 8's session state owns this.
- **Animation Breakdown per-panel batch selection** — this panel has no checkbox column and none is added. Per-row only on Animation Breakdown.
- **Batch-action toolbar / bulk-edit sheet** — the opportunistic "double-click into selection" pattern is the only batch affordance (D-77). Phase 9 polish could add a dedicated toolbar if user testing flags the pattern as unclear.
- **Override presets / common scale values (25/50/75%)** — not requested; the input field accepts any integer in [1, 100].
- **Per-skin / per-slot / per-animation overrides** — overrides are per unique attachment name ONLY (matches Phase 2/3 dedup semantics). Rejected framings: override by (skin, slot, attachment) triple, override by animation, override by bone chain. Rationale: the whole app is built on the "one texture = one row" framing; overrides follow that contract.
- **Keyboard-only override input flow on the table** (e.g., press O on focused row to open dialog) — Phase 9 polish.
- **Inline edit directly in Scale cell (no dialog)** — rejected; dialog gives clear Apply/Cancel/Reset + clamp feedback + batch-heading affordance.
- **CLI output of overrides** — `scripts/cli.ts` stays byte-for-byte identical. Overrides are a renderer-only concern until Phase 6 export.

</domain>

<decisions>
## Implementation Decisions

### Override storage & keying (locked via carry-forward)

- **D-73: Override key = unique `attachmentName` (string).** Matches the dedup semantics locked in Phase 2 gap-fix B and Phase 3 D-56 ("one row per unique texture"). Setting 50% on `TRIANGLE` applies to every row in every panel whose `attachmentName === 'TRIANGLE'`, regardless of which `(skin, slot)` tuple rendered the dedup winner. Rejected alternatives: `${skin}/${slot}/${attachmentName}` triple (would diverge from Phase 2/3 row granularity), `attachmentKey` composite (same problem). This is the whole point of the dedup: texture-level decisions, not slot-level.
- **D-74: Override state lives in `AppShell`.** `useState<Map<string, number>>(new Map())` alongside the existing `activeTab` and `focusAnimationName`. State position chosen because both panels need to read overrides and the dialog's Apply writes back into it — AppShell is the closest common ancestor. No Zustand, no Context, no Provider — matches Phase 2 D-32 and Phase 3 D-50. Resets to empty on new skeleton drop (AppShell unmounts when AppState transitions through idle/loading, same as Phase 3's collapse state per D-64). Phase 8 will add `localStorage` or session-file persistence — Phase 4 does NOT introduce any persistence layer.
- **D-75: `src/core/overrides.ts` is pure-TS clamping math only.** Exports `clampOverride(percent: number): number` (integer clamp to [1, 100]) and `applyOverride(peakScale: number, overridePercent: number): { effectiveScale: number, clamped: boolean }`. No `useState`, no React, no DOM, no spine-core. Per CLAUDE.md rule #5: `core/` stays DOM-free. The React layer owns the map; `core/` owns the number math. Layer 3 arch.spec.ts enforces.
- **D-76: "Clearing" an override = removing the key from the map.** Dialog's Reset button, or Apply with value 100, both result in `overrides.delete(attachmentName)`. A key-absent entry is semantically identical to "no override" — no special sentinel, no `null` marker. This keeps the map small on rigs with few overrides and makes the has-override check a single `map.has(name)` call.

### Dialog trigger + input UX

- **D-77: Dialog trigger = BOTH `onDoubleClick` on Scale cell AND Override button click.** F5.1 literal ("double-click any peak scale") + F4.4 literal (per-row Override Scale button) are both honored. Global panel gets ONLY `onDoubleClick` (no Override column exists there, and none is added). Animation Breakdown panel gets BOTH — Phase 3 D-69 pre-reserved the button in Column 7, so we unlock it; the Scale cell also gets a double-click handler for consistency with Global. Both trigger paths call `onOpenOverrideDialog(row, selectedKeys?)` on AppShell.
- **D-78: Dialog input = `<input type="number" min="1" max="100" step="1">` + static `%` suffix label.** Integer-only (no decimal precision — F5's requirement is "a percentage", not fractional precision). Auto-select the input's current value on open for easy retype. Placeholder: `100`. Rationale for integer: simpler validation, matches the hand-rolled-over-deps discipline (Phase 2 D-28), and 1-point precision is enough for image-dimension targeting where the output is rounded pixels anyway. **SUPERSEDED 2026-04-24 at human-verify by D-91 — see 04-03-SUMMARY.md §Deviations. The percent-as-fraction-of-peak interpretation is replaced by percent-as-fraction-of-source-dimensions; the dialog input semantics stay similar (integer, clamped [1,100]) but the math has new meaning.**
- **D-79: Clamp behavior = accept + silent clamp on Apply at 100% cap.** User can type `200`, dialog accepts the typed value visually, but `clampOverride(200)` on Apply stores `100`. No modal/toast/warning popup. Inline helper text under the input permanently reads: `Max = 100% (source dimensions)`. Rationale: F5.2's "clamped at source max" is satisfied without the user getting interrupted mid-type. The badge will visibly reflect `100%` (not `200%`) so they see the clamp happened. Rejected: type-guarded input that blocks typing (feels restrictive when pasting or overshooting); warning toast (adds a new toast system for one case). **SUPERSEDED 2026-04-24 at human-verify by D-91 — see 04-03-SUMMARY.md §Deviations. The silent clamp behavior is preserved, but "Max = 100% (source dimensions)" is now literally true: 100% means source dimensions, not 100% of peak. Under the old model the helper text was aspirational/misleading; the user flagged that "resetting to 100% currently resets to peak value instead" — the new model fixes that.**
- **D-80: Remove an override = dedicated "Reset to 100%" button in dialog.** Visible only when the row is currently overridden (`overrides.has(attachmentName)` — or for batch, at least one selected row has an override). Click → removes key(s) from the map, closes dialog. Alternative paths also work (Apply with value 100 → same D-76 semantics) but the button makes the affordance discoverable. Button position: tertiary action, left of Apply/Cancel; styled muted-border so Apply remains the primary visual emphasis. Not rendered when no row in scope is overridden — zero-noise for non-overridden rows.
- **D-81: Dialog accessibility + keyboard wiring.** ESC closes (discards input). Click outside overlay closes (discards). Enter inside input triggers Apply. Tab cycles: input → Reset (if visible) → Cancel → Apply. Apply is default-focused when dialog opens on a non-overridden row; input is focused with value auto-selected on any open (overridden or not). Focus-trap keeps keyboard inside the modal. `role="dialog"` + `aria-modal="true"` + `aria-labelledby={titleId}`.

### Override badge visuals

- **D-82: Badge renders INLINE inside the Scale cell.** Format: `{effectiveScaleLabel} • {overridePercent}%`. Example: peak 1.780× at 50% override renders as `0.890× • 50%`. Unicode bullet `•` (U+2022) as separator. Orange-accent color on both tokens (`text-accent` utility). Non-overridden rows render as today: `1.780×` alone in `text-fg`. Rejected alternatives: separate Override column (would shift Phase 3's 7-column layout to 8 and push layout work onto an already-shipped panel), chip next to attachment name (decouples badge from the value it modifies). Inline badge keeps the visual anchor on the Scale column where the animator is scanning.
- **D-83: Peak W×H column ALSO reflects the override.** Phase 4 displays EFFECTIVE dims, not original peak dims. A 50% override on TRIANGLE with peak 114×114 renders Peak W×H as `57×57`. Per F5.3 "visually badged on affected rows" + roadmap exit criterion "Setting 50% on TRIANGLE halves its target dims everywhere" — "everywhere" means every dimension readout reflects the override. Peak W×H cell also gets orange-accent color when overridden to visually echo the Scale cell badge. Raw peak dims remain in the DisplayRow for the hover-title attribute (if planner wants to expose them on hover) and for Phase 6 export's reference.
- **D-84: Clamped-at-100% override is still badged.** User sets 200% → stored as 100. Scale cell renders `{peakScaleLabel} • 100%` in orange-accent. Peak W×H unchanged (source-max = peak at 100%). Rationale: F5.3 says overrides are visually badged; the user touched this row, so it's user-modified regardless of whether the clamp made the effective value equal the peak. This also makes the clamp visible — the user sees `100%` in the badge, not their typed `200%`, which communicates the rule was applied. Rejected: hide badge (loses user-intent history), explicit "(clamped)" marker (adds special-case CSS for a cosmetic distinction the animator doesn't need to act on).
- **D-85: Hover tooltip on the Scale cell shows the raw peak + override math.** When `overrides.has(attachmentName)`, the `<td>`'s `title={...}` attribute reads e.g. `Peak 1.780× × 50% = 0.890×`. Matches Phase 2's hover-disclosure pattern for deeper detail. Non-overridden rows keep the existing title (or omit title entirely). Low cost, no new component.

### Batch override via Phase 2 selection (opportunistic)

- **D-86: Batch path opens ONLY when the triggering row's `attachmentName` is in the Global panel's `selectedKeys` set of size > 1.** Single rule: if the user double-clicks (or presses Override button) on a row that's in the current selection AND the selection has 2+ members, the dialog opens in batch mode with all selected rows as scope. Any other case = per-row. Keeps the mental model dead simple: "the row you click is the scope." No batch toolbar, no bulk-edit sheet, no scope-selector inside the dialog. Animation Breakdown panel has no selection UI → always per-row there.
- **D-87: "Clicked row NOT in selection" = per-row (ignore selection).** Explicit tiebreaker for the ambiguous case. User selected 3 unrelated rows, then double-clicks a 4th row that isn't selected → dialog overrides ONLY that 4th row. The 3 selected rows are untouched. No popup asking "this row or all selected?" — we always trust the double-click target. Rejected: apply to {selection ∪ clicked} (accidentally spreads overrides); prompt-for-scope (extra friction on every click).
- **D-88: Dialog heading + Apply + Reset all operate on the scope set.** Single-row mode: heading `"Override scale — {attachmentName}"`, Apply writes one map entry, Reset clears one. Batch mode: heading `"Override scale — {N} selected rows"` (e.g., `"Override scale — 4 selected rows"`), Apply writes N map entries with the same percent, Reset clears all N. Symmetry: if the dialog's scope is 4 rows, BOTH Apply and Reset affect all 4. Rejected asymmetric Reset ("only the clicked row") — confusing.
- **D-89: Phase 2 checkboxes stay visible and functional as-is.** No hiding, no conditional rendering, no deprecation. Phase 2 shipped them (D-31) and human-verify signed off. They become a live affordance in Phase 4 via the opportunistic batch path. Empty selection = no-op on batch; non-empty selection primes the batch affordance. Consistent with "keep the shipped UX stable."
- **D-90: Batch does not reopen on Animation Breakdown panel.** Selection UI only exists on Global panel — Animation Breakdown's row list is a read-only browse view per Phase 3. If the user wants batch, they use the Global panel. This keeps Animation Breakdown's layout stable and avoids adding a checkbox column that would conflict with the collapsible-card density goal (Phase 3 D-63).

### New semantics (added at human-verify 2026-04-24)

- **D-91: Override percent = target effective scale as fraction of SOURCE dimensions.** Supersedes D-78 and D-79. Resolution to the gap surfaced at 04-03 human-verify: "The override panel states 'Max = 100% (source dimensions)' but this is not true - resetting to 100% currently resets to peak value instead. User has no way to increase value past calculated peak. My suggestion is: let user type the value it wants (e.g., 500%) and the texture size may increase until it hits source dimensions (canonical dimensions must be the absolute maximum, never to be surpassed)." Locked rules under D-91:
  - `applyOverride(percent)` returns `effectiveScale = clampOverride(percent) / 100`. Peak scale is no longer part of the math.
  - No override set on a row → effective scale = peakScale (the floor-free, engine-computed default).
  - Override set to X% → effective scale = X / 100, regardless of peak (user may intentionally under-size below peak for quality tradeoffs).
  - Peak W×H column shows `sourceW/H × percent/100` on overridden rows (source dims are the canonical absolute max).
  - Silent clamp semantics carry forward: any input is clamped to `[1, 100]` on Apply. Helper text `Max = 100% (source dimensions)` is now literally true.
  - Dialog gets TWO reset buttons (supersedes D-80's single-Reset contract):
    - "Reset to peak" — clears the override via `onClear`. Visible only when scope has an existing override.
    - "Reset to source (100%)" — sets override to 100 via `onApply(100)`. Always visible.
  - Dialog prefill (supersedes the original D-77 "current override or 100" rule):
    - Overridden row → existing override value.
    - Non-overridden row → `Math.round(peakScale * 100)` (shows current effective as the starting point).
    - Batch scope → same rule applied to the clicked row.
  - Scale-cell hover tooltip format: `{X}% of source = {effectiveScale:.3f}×` (drops the old D-85 `Peak N× × Y% =` prefix — peak is no longer part of the equation for overridden rows).
  - Global panel default sort: `(attachmentName, asc)` so the just-edited row stays visible (resolution to a user-flagged UX paper cut at human-verify: "the default sorting should be by name, not by scale").
  - Gap A bug fix: the outbound `onOpenOverrideDialog` contract uses attachment **name**, not attachment **key**. Panels that track selection by key (e.g., GlobalMaxRenderPanel) convert the set to a name-set at the invocation site.

### Claude's Discretion (not locked)

- **Whether override-enriched fields live on `DisplayRow`/`BreakdownRow` at the IPC/core boundary OR are computed purely renderer-side via a derived selector.** Two viable approaches:
  - (A) Core/analyzer emits rows WITHOUT override info (as today); renderer derives `effectiveScale`, `effectivePeakLabel`, `overrideLabel` via a `useMemo` selector that takes `rows + overridesMap`. Keeps core oblivious to overrides — cleaner boundary.
  - (B) Core/analyzer takes `overridesMap` as a second argument and emits enriched rows with optional `overrideLabel`, `effectiveScale`, etc. Single source of truth for label formatting (matches Phase 2 D-35), but couples `core/` to a UI-mutable concept.
  - **Planner's call** — lean toward (A) for boundary cleanliness; it means `core/` stays oblivious and the renderer owns the cosmetic layer. Phase 6 export reads `overridesMap + peaks` directly and computes effective dims via `applyOverride()` from `overrides.ts` — it doesn't need pre-enriched rows.
- **Dialog component file location** — `src/renderer/src/modals/OverrideDialog.tsx` is declared in the roadmap deliverables, but the project has no `modals/` folder yet. Planner creates it. Alternative: live under `components/` if planner judges a dedicated subfolder premature (currently only one modal; Phase 6 OptimizeDialog and Phase 7 AtlasPreviewModal will add more).
- **Exact badge rendering markup** — plain React fragments vs a tiny `<OverrideBadge />` component in `components/`. Either is fine. Given the badge is used in two cells (Scale + Peak W×H) and on two panels, a micro-component is likely cleaner.
- **Dialog overlay styling** — backdrop color (`bg-black/40` vs `bg-panel/80`), backdrop blur (yes/no), entrance animation (instant vs fade). Follow warm-stone tokens. Planner picks; follow D-12/D-14 palette.
- **Focus-trap implementation** — hand-rolled with `useEffect` + `tabIndex` management, or adopt `react-aria` / `@radix-ui/react-focus-scope`. Hand-rolled fits Phase 2 D-28 discipline; dependency is only acceptable if hand-rolled runs >60 lines of boilerplate.
- **Dialog enter/exit animation** — instant vs CSS transition. Planner picks; keep lightweight.
- **Whether the Override button on Animation Breakdown keeps Phase 3's chip styling or gets primary button styling.** Phase 3 D-69 left it chip-styled (`border-border rounded-md px-2 py-0.5 text-xs font-mono`). Recommend keep chip style for consistency; drop the `opacity-50 cursor-not-allowed` dimming so it reads as active.
- **Scale cell double-click event handling detail** — stopPropagation for shift-click range select (Phase 2 D-31) is a concern. Planner verifies that double-click doesn't trigger the range-select side-effect (double-click fires onClick twice first; existing suppressNextChangeRef pattern may already handle this).
- **Renderer test approach (Testing Library vs happy-dom plain DOM)** — Phase 2 left this open; Phase 3 inherited; Phase 4 inherits again. Planner picks, consistent with whatever the test suite currently uses (if anything). `overrides.spec.ts` is pure-TS, runs in vitest with no DOM either way.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Phase 5 — Scale overrides" — canonical description of the override dialog, percentage-as-fraction-of-peak semantics, source-max clamp, badge across panels. Approved-plan numbering vs roadmap numbering: approved-plan "Phase 5" == roadmap Phase 4 (the approved plan has an extra derisk phase upstream). Roadmap is authoritative for phase ordering; approved plan is authoritative for technical shape.

### Project instructions
- `CLAUDE.md` — rule #5 (`core/` pure TS, no DOM) locks `src/core/overrides.ts` as a pure-math module. Rule #6 (default sampler rate) is unaffected — Phase 4 introduces no sampling changes.

### Requirements
- `.planning/REQUIREMENTS.md` §F5 — the four locked requirements:
  - F5.1 Double-click peak scale → dialog accepting a percentage → D-77, D-78.
  - F5.2 <100% shrinks, >100% clamps to 100% source max → D-79 (accept + silent clamp), D-84 (badge still shown at 100%).
  - F5.3 Overrides visually badged on affected rows across all panels → D-82 (inline scale-cell badge), applied on both GlobalMaxRenderPanel and AnimationBreakdownPanel.
  - F5.4 Overrides persist in saved project state → out of scope for Phase 4; Phase 8 consumes the AppShell map via `src/main/session.ts` (or similar). Phase 4 ships session-scoped useState only per the roadmap exit criteria.
- `.planning/REQUIREMENTS.md` §F8 — Phase 6 will consume the overrides map to compute export target dims (`source × applyOverride(peakScale, percent).effectiveScale`). Phase 4 does NOT wire Phase 6; Phase 4 just publishes the data shape Phase 6 needs.
- `.planning/ROADMAP.md` §"Phase 4: Scale overrides" — deliverables (`src/core/overrides.ts`, `src/renderer/modals/OverrideDialog.tsx`, override badges across both panels) and exit criteria (50% on TRIANGLE halves target dims; 200% clamps to 100%; session persistence only).

### Phase 0/1/2/3 artifacts (Phase 4 consumers + extension targets)
- `src/core/analyzer.ts` — `analyze()` + `analyzeBreakdown()` stable. Phase 4 does NOT modify core analyzer output unless planner chooses Claude's Discretion option (B) for enriched rows; recommended (A) keeps analyzer oblivious.
- `src/core/sampler.ts` — LOCKED. Phase 4 does not touch the sampler.
- `src/core/bones.ts` — LOCKED. Phase 4 does not touch bone path logic.
- `src/main/summary.ts` — stable. Phase 4 does not modify the main-process summary projection.
- `src/shared/types.ts` — **extension target** IF planner picks Claude's Discretion option (B) enriched rows. Add `OverrideRecord` + extend `DisplayRow` + `BreakdownRow` with optional override fields. IF planner picks option (A), no changes to `types.ts`.
- `src/renderer/src/components/AppShell.tsx` — **extension target**. Add `overrides: Map<string, number>` state + three callbacks (`onOpenOverrideDialog`, `onApplyOverride`, `onClearOverride`). Passes overrides map + callbacks down to both panels.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — **touched**. Scale cell gets `onDoubleClick`. Scale cell + Peak W×H cell render override badges when `overrides.has(row.attachmentName)`.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — **touched**. Phase 3 D-69 disabled Override button gets unlocked (`disabled` removed, tooltip updated, opacity restored). Scale cell gets `onDoubleClick`. Scale + Peak cells render badges.
- `src/renderer/src/components/SearchBar.tsx` — unchanged.
- `src/renderer/src/components/DropZone.tsx` — unchanged.
- `scripts/cli.ts` — **unchanged**. CLI output stays byte-for-byte identical. Overrides are a renderer-only concern until Phase 6.
- `.planning/phases/00-core-math-spike/00-CONTEXT.md` §"CLI Contract (locked)" — CLI still authoritative; Phase 4 does not touch.
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md` — D-11..D-27 carry (color tokens, warm-stone + orange-accent, font-mono, useState, three-layer defense). Especially D-12 / D-14 palette for the dialog + badge styling.
- `.planning/phases/02-global-max-render-source-panel/02-CONTEXT.md` — D-28..D-48 carry. Especially:
  - **D-28** (hand-rolled over deps) — dialog hand-rolled; no `react-modal` / `@radix-ui/react-dialog` library.
  - **D-29** (default sort Scale DESC) — overrides don't change sort default; however the sort COMPARATOR reads the EFFECTIVE scale (peak × override/100 if overridden). Planner must update the comparator to use effective scale so 50%-overridden high-peak rows sort below 100%-kept lower-peak rows when that's the actual ordering the animator cares about. **Decision check: is sort by effective scale or by peak?** — defer this to planner, recommend effective scale since the whole panel becomes "effective render plan."
  - **D-31** (selection set Set<attachmentKey>) — Phase 4 READS this set to detect batch mode per D-86. Does not modify selection behavior.
  - **D-32** (plain useState) — D-74 reaffirms.
  - **D-35** (preformatted labels + raw numbers) — Phase 4 adds `overrideLabel` + `effectiveScale` following the same pattern.
  - **D-37 / D-38 / D-40 / D-41** (search, no debounce, match highlight, zero-results row) — Phase 4 does NOT touch search/filter.
  - **D-45 / D-46** (Scale label `1.780×` toFixed(3) + Unicode ×, size labels `64×64`) — badge formatting reuses these helpers. Effective scale formatted the same way.
  - **D-47** (font-mono everywhere) — badge renders in font-mono.
- `.planning/phases/03-animation-breakdown-panel/03-CONTEXT.md` — D-49..D-72 carry. Especially:
  - **D-56** (row dedup by attachment name) — overrides key = attachment name matches this.
  - **D-57** (7-column layout with Override button in column 7) — Phase 4 keeps the layout; Override button becomes interactive.
  - **D-69** (Override button rendered disabled in Phase 3) — **D-77 resolves by unlocking it.** Remove `disabled`, remove `title="Coming in Phase 4"`, remove `opacity-50 cursor-not-allowed`.
  - **D-72** (Source Animation cell = jump-target button) — unrelated but same pattern of upgrading a Phase 2/3 placeholder to a live affordance.
  - **D-50** (AppShell state = plain useState, resets on new drop) — D-74 follows the same pattern for overrides state.

### spine-core API reference (for researcher / planner)
- N/A. Phase 4 does not touch spine-core APIs. The entire phase lives at the React + pure-TS-math boundary. No sampler extension, no world-vertex computation, no attachment/slot/bone manipulation.

### External
- [WAI-ARIA Modal Dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) — accessibility wiring for OverrideDialog (`role="dialog"`, `aria-modal="true"`, focus-trap, ESC, `aria-labelledby`).
- [MDN `<input type="number">`](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input/number) — integer input validation semantics, `min`/`max`/`step` attributes.
- [React `useCallback` + `useMemo` docs](https://react.dev/reference/react/useCallback) — callback identity for passing `onOpenOverrideDialog` etc. down two panel levels; memoize derived `effectiveRows` per `(rows, overrides)` pair.

### Fixtures (Phase 4 drop + verify targets)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — primary drop-test target. Expected override behavior:
  - Open dialog on TRIANGLE's Scale cell (Global panel or Setup Pose card) → type `50` → Apply → Scale cell reads `{peakScale × 0.5}× • 50%` in orange. Peak W×H cell halves. Badge appears on EVERY row where `attachmentName === 'TRIANGLE'` across both panels (Global + every Animation Breakdown card where TRIANGLE is affected + Setup Pose card).
  - Open dialog on SQUARE → type `200` → Apply → badge shows `{peakScale × 1.0}× • 100%` (clamped). Peak W×H unchanged from source max.
  - Open dialog on TRIANGLE again → Reset button visible → click → badge disappears everywhere.
  - Global panel: select 2 rows via checkbox → double-click one selected row → dialog heading reads "Override scale — 2 selected rows" → type 75 → Apply → both selected rows get 75% badges.
- Complex rigs (`fixtures/Jokerman/`, `fixtures/Girl/`) — human-verify targets for dialog latency on 100+ attachment scroll-then-click flows and batch select-20 apply flows.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/renderer/src/components/AppShell.tsx`** — extension home for `overrides: Map<string, number>` state. Same file that owns `activeTab` + `focusAnimationName`. Adding three callbacks (`onOpenOverrideDialog`, `onApplyOverride`, `onClearOverride`) fits the existing pattern. Pass down to both panels through existing prop channels.
- **`src/renderer/src/components/SearchBar.tsx`** — template for how hand-rolled controlled inputs work in this codebase. The dialog's `<input type="number">` follows the same controlled-input + focus + ESC-handling pattern.
- **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** — reference for hand-rolled table cell event handlers (click, shift-click, label+onClick coordination, `suppressNextChangeRef` anti-double-fire). Phase 4's `onDoubleClick` on Scale cell must coexist with the existing selection handlers; planner verifies no event-propagation conflicts (the Phase 2 anti-double-fire flag already exists; double-click is a distinct event from click so should not conflict, but planner tests).
- **`src/renderer/src/panels/AnimationBreakdownPanel.tsx`** — reference for the chip-style Override button (Phase 3 D-69 stub). Phase 4 unlocks it: remove `disabled`, update `onClick` to `onOpenOverrideDialog(row)`, update `title` from "Coming in Phase 4" to e.g. "Override scale" (or omit title; the button text is already "Override Scale").
- **`src/core/analyzer.ts`** — template for pure-TS modules in `core/`. `src/core/overrides.ts` follows the same pattern: named exports, JSDoc with D-# citations, no imports from `spine-core` (overrides.ts is pure math on primitives).
- **Tailwind `@theme` tokens** — all existing tokens cover Phase 4 needs:
  - Badge: `text-accent` (orange), `font-mono`, `•` bullet inline.
  - Dialog overlay: `bg-panel/80` or `bg-black/40` backdrop.
  - Dialog container: `bg-panel border border-border rounded-md`.
  - Input focus ring: `ring-2 ring-accent` (already used in SearchBar).
  - Button styles: existing chip style `border-border rounded-md px-2 py-0.5 text-xs font-mono` for Reset/Cancel; `bg-accent text-panel` for primary Apply.
  - No new `@theme` tokens needed.

### Established Patterns (from Phase 0/1/2/3)
- **Hand-rolled over deps** — dialog is hand-rolled `<div role="dialog">` + focus-trap. Zero new runtime dependencies.
- **Preformatted labels + raw numbers** — `overrideLabel: string` + `overridePercent: number` + `effectiveScale: number` all present. Renderer does no formatting in JSX; selector memo or analyzer handles label construction.
- **Three-layer `core/` ↛ `renderer/` defense** — Phase 4's new files (`src/core/overrides.ts`, `src/renderer/src/modals/OverrideDialog.tsx`) MUST comply. Layer 3 arch.spec.ts auto-scans.
- **Grep-literal-in-comments compliance** — dialog + overrides.ts comments must avoid literal tokens that trip the arch.spec.ts grep gates. Phase 1/2/3 all hit this; Phase 4 planner pre-emptively writes prose over forbidden-literal tokens.
- **Atomic commits per logical unit** — use `feat(04-overrides):`, `refactor(04-overrides):`, `fix(04-overrides):`. Mirror Phase 2's `feat(02-panel):` style.
- **Test gating: `npm run typecheck` + `npm run test`** — Phase 3 closed at 70+ + 1 skip. Phase 4 plans target 75+ + 1 skip (adding overrides.spec + dialog spec + panel interaction specs).
- **Human-verify-is-load-bearing** — Phase 4 ships with a `checkpoint:human-verify` on the final plan. Interactive checks: dialog opens via double-click + button, integer-only input, 50% halves dims everywhere, 200% clamps+badges at 100%, Reset clears, batch mode via 2+ selected rows works, Animation Breakdown Override button is now live, CLI output unchanged, `.dmg` build still works.

### Integration Points
- **AppShell ↔ Panel callbacks (three new):**
  - `onOpenOverrideDialog(row: DisplayRow | BreakdownRow, selectedKeys?: Set<string>): void` — opens the dialog; AppShell decides single vs batch scope based on `selectedKeys.has(row.attachmentName) && selectedKeys.size > 1`.
  - `onApplyOverride(scope: string[], percent: number): void` — writes N entries into the overrides map (clamping via `overrides.ts`).
  - `onClearOverride(scope: string[]): void` — deletes N entries from the map.
- **Panel ↔ Badge renders** — panels receive `overrides: Map<string, number>` prop from AppShell. For each row, check `overrides.get(row.attachmentName)`; if set, render the badge + recompute effective dims via `applyOverride()` from `src/core/overrides.ts`.
- **Phase 6 export hookup (future)** — `src/core/export.ts` (Phase 6) will take `(rows: DisplayRow[], overrides: Map<string, number>)` and compute target dims via `applyOverride()`. Phase 4 exports this function already so Phase 6 is pure consumer.
- **Dialog lifecycle** — owned by AppShell via a `dialogState: { open: boolean, scope: string[], currentPercent: number } | null` state. Dialog component is rendered conditionally. AppShell passes state + close callback; dialog is a controlled component.

### Constraints from Phase 0/1/2/3
- `core/` stays DOM-free (CLAUDE.md #5). `overrides.ts` is pure number math.
- N2.3 zero filesystem I/O in hot loops — unaffected.
- D-23 no `process.platform` branches — unaffected.
- Locked tick lifecycle (CLAUDE.md #3) — unaffected; Phase 4 doesn't sample.
- Phase 1/2 Electron runtime caveats preserved: main bundle stays CJS, preload stays CJS. Phase 4 does not touch `electron.vite.config.ts` or `src/main/index.ts` unless a build-boundary regression surfaces.
- **Sampler stays LOCKED as of Phase 3.** Phase 4 introduces zero sampler changes. If planner surfaces a second need to reopen the sampler, escalate rather than silently widen — the data Phase 4 needs is already emitted by the existing `analyze()` + `analyzeBreakdown()` projections.

</code_context>

<specifics>
## Specific Ideas

### `src/core/overrides.ts` shape (seeded for planner)

```ts
// src/core/overrides.ts — pure-TS, DOM-free, no spine-core imports.

/**
 * Clamp a user-supplied percentage into the valid range [1, 100].
 * Integer input only per D-78; non-finite or <1 values snap to 1;
 * values >100 snap to 100 (F5.2 source-max clamp).
 */
export function clampOverride(percent: number): number {
  if (!Number.isFinite(percent)) return 1;
  const int = Math.round(percent);
  if (int < 1) return 1;
  if (int > 100) return 100;
  return int;
}

/**
 * Apply an override percentage to a peak scale value.
 * Returns { effectiveScale, clamped } where clamped is true if the
 * raw input (pre-clamp) exceeded 100. Rows with clamped=true still
 * render a badge per D-84.
 */
export function applyOverride(
  peakScale: number,
  overridePercent: number,
): { effectiveScale: number; clamped: boolean } {
  const clamped = overridePercent > 100;
  const safe = clampOverride(overridePercent);
  return { effectiveScale: peakScale * safe / 100, clamped };
}
```

### `OverrideDialog.tsx` skeleton (seeded for planner)

```tsx
// src/renderer/src/modals/OverrideDialog.tsx
interface OverrideDialogProps {
  open: boolean;
  scope: string[];                       // attachmentNames in scope (1 = single, 2+ = batch)
  currentPercent: number;                // 100 if not overridden, else current value
  anyOverridden: boolean;                // controls Reset button visibility
  onApply: (percent: number) => void;
  onClear: () => void;
  onCancel: () => void;
}

export function OverrideDialog(props: OverrideDialogProps) {
  const [inputValue, setInputValue] = useState(String(props.currentPercent));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (props.open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [props.open]);

  if (!props.open) return null;

  const title = props.scope.length === 1
    ? `Override scale — ${props.scope[0]}`
    : `Override scale — ${props.scope.length} selected rows`;

  const apply = () => props.onApply(Number(inputValue));
  const keyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') apply();
    if (e.key === 'Escape') props.onCancel();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="override-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onCancel}
    >
      <div
        className="bg-panel border border-border rounded-md p-6 min-w-[360px] font-mono"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keyDown}
      >
        <h2 id="override-title" className="text-sm text-fg mb-4">{title}</h2>
        <label className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="number"
            min={1}
            max={100}
            step={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="bg-panel border border-border rounded-md px-2 py-1 w-24 text-fg focus:ring-2 focus:ring-accent"
          />
          <span className="text-fg-muted text-sm">%</span>
        </label>
        <p className="text-fg-muted text-xs mt-2">Max = 100% (source dimensions)</p>
        <div className="flex gap-2 mt-6 justify-end">
          {props.anyOverridden && (
            <button
              onClick={props.onClear}
              className="border border-border rounded-md px-3 py-1 text-xs text-fg-muted hover:text-fg"
            >
              Reset to 100%
            </button>
          )}
          <button
            onClick={props.onCancel}
            className="border border-border rounded-md px-3 py-1 text-xs"
          >
            Cancel
          </button>
          <button
            onClick={apply}
            autoFocus={!props.anyOverridden}
            className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
```

### AppShell extension (seeded for planner)

```tsx
// src/renderer/src/components/AppShell.tsx (diff sketch)
const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
const [dialogState, setDialogState] = useState<{
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
} | null>(null);

const onOpenOverrideDialog = useCallback(
  (row: DisplayRow | BreakdownRow, selectedKeys?: Set<string>) => {
    const inSelection = selectedKeys?.has(row.attachmentName) && selectedKeys.size > 1;
    const scope = inSelection ? [...selectedKeys!] : [row.attachmentName];
    const currentPercent = overrides.get(row.attachmentName) ?? 100;
    const anyOverridden = scope.some((name) => overrides.has(name));
    setDialogState({ scope, currentPercent, anyOverridden });
  },
  [overrides],
);

const onApplyOverride = useCallback((scope: string[], percent: number) => {
  const clamped = clampOverride(percent);
  setOverrides((prev) => {
    const next = new Map(prev);
    for (const name of scope) next.set(name, clamped);
    return next;
  });
  setDialogState(null);
}, []);

const onClearOverride = useCallback((scope: string[]) => {
  setOverrides((prev) => {
    const next = new Map(prev);
    for (const name of scope) next.delete(name);
    return next;
  });
  setDialogState(null);
}, []);
```

### Scale cell badge rendering (seeded for planner)

```tsx
// In both panels' Scale <td>:
const override = overrides.get(row.attachmentName);
const { effectiveScale } = override != null
  ? applyOverride(row.peakScale, override)
  : { effectiveScale: row.peakScale };
const effectiveLabel = `${effectiveScale.toFixed(3)}×`;

<td
  className={clsx('font-mono', override != null && 'text-accent')}
  onDoubleClick={() => onOpenOverrideDialog(row, selectedKeys)}
  title={override != null ? `Peak ${row.scaleLabel} × ${override}% = ${effectiveLabel}` : undefined}
>
  {effectiveLabel}
  {override != null && <span> • {override}%</span>}
</td>
```

### Expected SIMPLE_TEST.json human-verify flow

1. Drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.
2. Switch to Global panel; double-click TRIANGLE's Scale cell → dialog opens with title "Override scale — TRIANGLE", input focused at value 100.
3. Type `50`, hit Enter → dialog closes; TRIANGLE's Scale cell reads `0.500× • 50%` in orange-accent (assuming peak 1.000); Peak W×H halves.
4. Switch to Animation Breakdown → every card that lists TRIANGLE shows the same badge on TRIANGLE's row; Setup Pose card's TRIANGLE row shows `0.500× • 50%` too.
5. Back to Global; double-click SQUARE → type `200` → Apply → badge reads `{peak}× • 100%` (clamped silently). Peak W×H unchanged.
6. Open SQUARE's dialog again → Reset to 100% button visible → click → badge disappears from every panel. Re-verify Animation Breakdown SQUARE rows are un-badged.
7. Ctrl/Cmd-click CIRCLE + TRIANGLE in Global to select both (via existing Phase 2 checkboxes) → double-click CIRCLE's Scale cell → dialog title reads "Override scale — 2 selected rows" → type 75 → Apply → both rows now show `{peak × 0.75}× • 75%` in orange.
8. Re-open the same dialog (double-click CIRCLE again while still selected) → Reset → both selected rows cleared in one action.
9. Unselect both → double-click only SQUARE → dialog title reads "Override scale — SQUARE" (single-row because SQUARE not in selection set).

### Reference screenshot

Approved plan's "screenshot 2" (override dialog) is the canonical visual reference for the percentage-input dialog. Warm-stone modal panel, orange Apply button, monospace input + % suffix, minimal chrome.

</specifics>

<deferred>
## Deferred Ideas

- **Cross-session persistence of overrides.** Phase 8 (F5.4 + F9.1). Phase 4 ships session-scoped useState only; the overrides map is a natural field to include in the Phase 8 session JSON.
- **Phase 6 export consumption.** Phase 6 reads the overrides map + `applyOverride()` from Phase 4's `src/core/overrides.ts`.
- **Phase 7 atlas preview consumption.** Phase 7 reads the same map for before/after packed dims.
- **Undo/redo history.** Not requested; Reset + retype is the rollback in Phase 4.
- **Override presets (25/50/75% quick buttons).** Not requested; integer field is the only input. Add as Phase 9 polish if user feedback asks.
- **Per-(skin, slot, attachment) triple override.** Rejected per D-73. The whole app runs on "one texture = one row" semantics; overrides follow.
- **Per-animation override.** Not requested; overrides are a render-target concern, not an animation concern.
- **Animation Breakdown selection/batch UI.** Phase 3 D-57 locks the 7-column layout with no checkbox column. Deferred to a polish phase if batch on that panel becomes useful.
- **Keyboard shortcut to open override dialog on focused row (e.g., `O` key).** Phase 9 polish.
- **Inline Scale-cell editing (no dialog).** Rejected; dialog provides clamp feedback + batch heading + Reset affordance in one UX.
- **CLI override flags (e.g., `--override TRIANGLE=50`).** Not requested; CLI is the read-only derisk tool, not an edit surface.
- **Toast / warning system for the clamp case.** Rejected per D-79; inline helper text + badge value suffice. Reopen if user testing flags the clamp as invisible.
- **Animations on dialog open/close.** Planner's call under Claude's Discretion; default to instant or lightweight CSS fade.
- **Focus-ring & hover transitions on the badge.** Planner's call; pure cosmetic polish within warm-stone + orange-accent tokens.
- **Batch-action toolbar above Global panel (multi-select with `[Override ×N]` button header).** Rejected per D-86; the "double-click into selection" pattern is the only batch affordance. Reopen only if user testing shows the discovery of batch is too hidden.

### Reviewed Todos (not folded)
- None. No pending todos matched Phase 4 scope.

</deferred>

---

*Phase: 04-scale-overrides*
*Context gathered: 2026-04-24 via `/gsd-discuss-phase 4`*
