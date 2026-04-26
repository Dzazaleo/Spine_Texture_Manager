# Phase 4: Scale overrides — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-24
**Phase:** 04-scale-overrides
**Areas discussed:** Dialog trigger + input UX, Override badge visuals, Batch override via Phase 2 selection

---

## Gray area selection

The user was presented with 4 candidate gray areas and chose 3 to discuss:

| Option | Description | Selected |
|--------|-------------|----------|
| Override storage + keying | Where state lives, attachment-name vs triple keying, clear semantics | |
| Dialog trigger + input UX | Double-click vs button, input type, clamp feedback, clear semantics | ✓ |
| Override badge visuals | Where badge renders on each panel, what it communicates, clamp-to-100 case | ✓ |
| Batch override via Phase 2 selection | Opportunistic batch via existing selection set, or defer | ✓ |

**Skipped area (Claude's Discretion, locked by carry-forward):** Override storage + keying. Phase 2 gap-fix B + Phase 3 D-56 already lock the "one row per unique attachment name" semantics; override key follows. State lives in AppShell (matches Phase 3 D-50 for focusAnimationName + activeTab). `src/core/overrides.ts` is pure-TS math only (CLAUDE.md #5). Clear = delete from map (no sentinel).

---

## Dialog trigger + input UX

### Question 1 — Trigger mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Both: dbl-click Scale cell + Override button | F5.1 literal (double-click) + F4.4 literal (button) both honored. Global panel gets double-click only (no Override column there); Animation Breakdown gets both. | ✓ |
| Button only on both panels | Add Override column to Global panel; skip double-click. More discoverable but violates F5.1's literal wording. | |
| Double-click only | Remove the Phase 3 D-69 disabled button placeholder. Cleaner rows but churns Phase 3 layout. | |

**User's choice:** Both: dbl-click Scale cell + Override button
**Notes:** Phase 3 already reserved the button; unlocking it is cleanest. Double-click on Scale cell honors F5.1.

### Question 2 — Input control

| Option | Description | Selected |
|--------|-------------|----------|
| Text input with % suffix, integer (Recommended) | `<input type="number" min=1 max=100>` + static `%` label. Integer 1–100. Keyboard-first. | ✓ |
| Text input with decimal precision | Same but allow 50.5% etc. More granular, slight validation complexity. | |
| Slider + live numeric readout | Horizontal slider + value readout. Visual but slower than typing. | |
| Spinbox (↑↓ arrows, step 5%) | Pro-tool feel; heavier than plain number input. | |

**User's choice:** Text input with % suffix, integer
**Notes:** Matches hand-rolled-over-deps discipline. 1-point precision sufficient for image-dim targeting.

### Question 3 — Clamp behavior at >100%

| Option | Description | Selected |
|--------|-------------|----------|
| Accept + silent clamp on Apply (Recommended) | User types 200, Apply stores 100; inline helper "Max = 100% (source dimensions)". | ✓ |
| Type-guard: reject >100 while typing | Browser caps keystrokes via `max=100`. Feels restrictive for paste/overshoot. | |
| Accept + flag with warning | Toast or inline warning explaining the cap. Teaches user but adds toast system. | |

**User's choice:** Accept + silent clamp on Apply
**Notes:** No mid-type interruption; badge will show the clamped value so the user sees the rule applied.

### Question 4 — Remove existing override

| Option | Description | Selected |
|--------|-------------|----------|
| 'Reset' button in dialog (Recommended) | Tertiary 'Reset to 100%' button visible when row is overridden. Apply with 100 also works. | ✓ |
| Set to 100% to clear (only) | No dedicated button; type 100 and Apply. Minimal UI, less discoverable. | |
| Right-click row → Clear override | Context menu. New interaction pattern not used elsewhere. | |

**User's choice:** 'Reset' button in dialog
**Notes:** Makes the clear affordance discoverable. Button only visible when at least one row in scope is overridden.

---

## Override badge visuals

### Question 1 — Where the badge renders

| Option | Description | Selected |
|--------|-------------|----------|
| Inline inside the Scale cell (Recommended) | `0.890× • 50%` in Scale cell; orange-accent. No new column, no row-height churn. | ✓ |
| New column between Scale and Peak W×H | Explicit but widens the table and pushes Phase 3 to 8 columns. | |
| Small chip next to attachment name | Tag chip after name cell. Decouples badge from Scale value it mutates. | |

**User's choice:** Inline inside the Scale cell
**Notes:** Keeps badge visually anchored to the value it modifies.

### Question 2 — What the badge communicates

| Option | Description | Selected |
|--------|-------------|----------|
| Override % + recomputed Scale (Recommended) | Cell shows NEW scale (peak × override/100) with % suffix. Peak W×H and Scale both reflect the override. Orange-accent. | ✓ |
| Original peak preserved, badge added | Scale cell keeps original peak + chip `[OVR 50%]`. Preserves reference but requires Peak W×H disambiguation. | |
| Icon + hover tooltip | Orange dot + hover tooltip with detail. Low visual noise but invisible to first-time users. | |

**User's choice:** Override % + recomputed Scale
**Notes:** Matches roadmap exit criterion "50% on TRIANGLE halves its target dims everywhere."

### Question 3 — 200% clamped to 100% case

| Option | Description | Selected |
|--------|-------------|----------|
| Show as overridden at 100% (Recommended) | Badge reads '100%' — the value after clamp. Still orange. Preserves user-intent history. | ✓ |
| Hide badge — treat as no-op | 100% = peak, so don't badge. Cleaner scan but loses intent. | |
| Show badge with 'clamped' marker | '100% (clamped)' in distinct color. Most explicit; extra CSS. | |

**User's choice:** Show as overridden at 100%
**Notes:** F5.3 says overrides are badged; user touched this row, so it's overridden regardless of final value.

---

## Batch override via Phase 2 selection

### Question 1 — Wire batch?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer batch — per-row override only (Recommended) | Phase 4 ships only single-row overrides. Phase 2 selection stays dormant. | |
| Wire batch apply via selection + toolbar | Add `[Override ×N selected]` button above the table; moderate scope creep. | |
| Wire batch but only on Global panel | Smallest batch footprint. | |
| **(User's freeform)** Opportunistic batch via select-then-dblclick | User shift-clicks to select, double-clicks one selected row, types value → OK applies to every selected row. No new toolbar. | ✓ |

**User's choice:** Freeform — "Defer, unless easy like this: user shift-clicks multiple rows to select them (behaviour already existent) and double-clicks one row, types override value - OK applies same value to every selected row."
**Notes:** Pragmatic compromise: no new toolbar UI, piggyback on existing selection handlers. Dialog heading branches on scope size; Apply writes N map entries; Reset clears N. Cost: ~20–30 lines in AppShell's `onOpenOverrideDialog` callback + dialog title variant.

### Question 2 — Clicked row NOT in selection case

| Option | Description | Selected |
|--------|-------------|----------|
| Per-row only — ignore selection (Recommended) | Double-click target is the scope. Unselected click → single-row. | ✓ |
| Always apply to selection + clicked row | `{selection ∪ clicked}`. Risks accidental cross-apply. | |
| Prompt user which scope | Dialog offers a toggle. Most explicit; adds decision friction every time. | |

**User's choice:** Per-row only — ignore selection
**Notes:** Simple rule: "your double-click target is the scope." Zero surprise.

### Question 3 — Batch reset scope

| Option | Description | Selected |
|--------|-------------|----------|
| Reset all selected (Recommended) | Symmetrical with Apply; if dialog scope is 4 rows, Reset clears all 4. | ✓ |
| Reset only the clicked row | Asymmetric escape hatch. Confusing. | |

**User's choice:** Reset all selected
**Notes:** Apply and Reset share the same scope — predictable.

---

## Claude's Discretion

- IPC shape for override-enriched fields (core-enriched rows vs renderer-derived selector) — planner's call, recommend renderer-side derivation.
- Dialog file location (`src/renderer/src/modals/` vs `components/`) — folder doesn't exist yet; planner creates.
- Badge micro-component vs inline fragments — planner's call.
- Dialog overlay styling + animation — planner follows warm-stone + orange-accent tokens.
- Focus-trap implementation (hand-rolled vs library) — hand-rolled preferred per Phase 2 D-28 unless >60 lines.
- Override button on Animation Breakdown — keep Phase 3 chip styling, drop dimming.
- Scale-cell double-click vs Phase 2 click/range-select coexistence — planner verifies no event-propagation conflicts.
- Renderer test approach (Testing Library vs happy-dom) — inherited open from Phase 2/3.

## Deferred Ideas

- Cross-session persistence (Phase 8).
- Phase 6 export consumption.
- Phase 7 atlas preview consumption.
- Undo/redo history.
- Override presets (quick buttons).
- Per-(skin, slot, attachment) overrides (rejected — violates D-73).
- Per-animation overrides.
- Animation Breakdown batch UI.
- Keyboard shortcut to open dialog.
- Inline Scale-cell editing.
- CLI override flags.
- Toast/warning for clamp case.
- Dialog open/close animations.
- Batch-action toolbar above Global panel (rejected — D-86 opportunistic pattern is the only batch affordance).
