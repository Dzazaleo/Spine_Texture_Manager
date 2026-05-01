---
phase: 19
plan: 05
subsystem: renderer-animation-breakdown-panel
tags: [card-section-icon, row-coloring, search-lift-completion, wave-4]
status: complete
requires:
  - "Plan 19-01 — --color-success / --color-warning Tailwind tokens (independent of this plan; Tailwind utilities consumed via clsx literal branches)"
  - "Plan 19-03 — lifted query state in AppShell + interim OPTIONAL panel-prop posture (query?: string + onQueryChange?: (q: string) => void) + sticky-bar SearchBar wiring"
  - "Plan 19-04 — Wave 4 sibling (parallel file); established the row-state predicate + state-bar `<td>` + tinted ratio cell + REQUIRED-prop tightening + PanelTestHarness pattern that Plan 19-05 mirrors verbatim"
  - "Existing AnimationCard `<section>` wrapper at AnimationBreakdownPanel.tsx:415-422 (already conforms to D-05 — `border border-border rounded-md bg-panel`)"
  - "Existing virtualizer + sticky `<thead>` shared between flat-table + virtualized render paths via BreakdownTableHead()"
provides:
  - "Section-level play/film SVG glyph (UI-SPEC §3 lines 240-247) inside each AnimationCard's collapsed-card header — between caret span and animationName span; stroke-based, currentColor inheritance; `text-fg` parent span"
  - "Row state predicate module-top (`type RowState = 'under' | 'over' | 'unused' | 'neutral'` + `rowState(peakRatio: number, isUnused: boolean): RowState`) — co-located inline (Plan 19-04 hand-off note authorizes the duplication for renderer-tree-only two-callsite scope)"
  - "Per-row state computed at both BreakdownRowItem mount sites (flat + virtualized); isUnused is always false on this panel because per-animation rows do not surface global Unused Assets membership (that is a global-summary concept)"
  - "State-color left-accent `<td>` bar with literal-class clsx branches (`bg-success` / `bg-warning` / `bg-danger` / `bg-transparent`) per UI-SPEC §5 + Tailwind v4 discipline; aria-hidden span; w-1 column"
  - "Tinted ratio cell on Scale column with literal-class clsx branches (`bg-success/10 text-success` / `bg-warning/10 text-warning` / `bg-danger/10 text-danger` / `text-fg`); replaces the prior override-aware text-accent on this cell per the deliberate D-06 visual unification (override percent badge preserved below ratio for power-user signal)"
  - "Matching `<th aria-label='Row state indicator' />` as the FIRST `<th>` in BreakdownTableHead (single shared head; column count stays consistent); empty-state colSpan bumped 7 → 8"
  - "REQUIRED panel-prop posture (tightened from Plan 19-03 interim OPTIONAL): query: string + onQueryChange: (q: string) => void on AnimationBreakdownPanelProps; internal SearchBar JSX element + internal SearchBar import line + internal useState('') slot ALL REMOVED"
affects:
  - "Closes UI-02 surface for the Animation Breakdown panel — runs in parallel with Plan 19-04 (Global panel) since they touch different files"
  - "Future plans consuming bg-success / bg-warning / bg-success/10 / bg-warning/10 utilities — emitted at generation time (Plan 19-01 token foundation)"
tech-stack:
  added: []
  patterns:
    - "Section-icon glyph pattern (D-08) — verbatim inline SVG with stroke=currentColor inheritance + parent `<span>` that inherits `text-fg`"
    - "Row state predicate + state-bar `<td>`/`<span>` + tinted ratio cell with clsx literal-branch discipline (UI-SPEC §5 verbatim) — mirrors Plan 19-04's GlobalMaxRenderPanel implementation byte-for-byte"
    - "REQUIRED-prop tightening pattern — Plan 19-03 interim OPTIONAL → Plan 19-05 REQUIRED (mirrors Plan 19-04's tightening on the GlobalMaxRenderPanel side)"
    - "Test harness pattern for lifted-state contracts — controlled wrapper component holding query state + mounting the production SearchBar above the panel under test (PanelTestHarness in tests/renderer/anim-breakdown-virtualization.spec.tsx; mirrors Plan 19-04's PanelTestHarness in tests/renderer/global-max-virtualization.spec.tsx)"
key-files:
  created: []
  modified:
    - "src/renderer/src/panels/AnimationBreakdownPanel.tsx (SearchBar import REMOVED; query/onQueryChange tightened to REQUIRED + destructured; internal useState('') slot REMOVED; internal `<SearchBar>` JSX element REMOVED; play/film SVG glyph in collapsed-card header; module-top RowState type + rowState() helper; state-bar `<td>` + tinted Scale cell in BreakdownRowItem; matching `<th aria-label='Row state indicator' />` in BreakdownTableHead; empty-state colSpan 7 → 8)"
    - "tests/renderer/anim-breakdown-virtualization.spec.tsx (Rule 3 fix — PanelTestHarness controlled wrapper threading the now-REQUIRED query/onQueryChange props + mounting the production SearchBar so existing getByLabelText queries keep resolving)"
decisions:
  - "Used row.effectiveScale (not row.peakRatio) as the state predicate input — same Rule 3 deviation as Plan 19-04 (peakRatio does not exist on this codebase's EnrichedBreakdownRow / DisplayRow shape; effectiveScale IS the override-aware peak ratio relative to source size). UI-SPEC §5 example was read literally; planner's intent is the ratio meaning, not the field name."
  - "Tinted the Scale ratio cell (the panel's `effectiveScale.toFixed(3)×` cell), not the Peak W×H cell — Scale is what semantically displays a ratio. Plan's `<DO NOT touch>` list explicitly preserves W×H, ratio is the only state-color target."
  - "Per UI-SPEC line 306, state-color trumps prior override-aware text-accent on the Scale cell (deliberate D-06 visual unification). Override percent badge (` • {row.override}%`) below the ratio still surfaces the override signal for power users. Title tooltip (`{override}% of source = {effectiveScale}×`) preserved verbatim."
  - "isUnused = false at both Row mount sites — AnimationBreakdownPanel rows are PER-ANIMATION peak rows; the unused-set lives on the global summary (GlobalMaxRenderPanel only). The plan's `<action>` body explicitly authorizes this fallback ('the unused state is unlikely to fire here and `isUnused` stays `false` for all rows in this panel')."
  - "Inlined the rowState helper instead of extracting to src/renderer/src/lib/row-state.ts — Plan 19-04 hand-off note explicitly allows duplication ('renderer-tree-only, no shared lib needed for two callsites'). Two callsites (GlobalMaxRenderPanel + AnimationBreakdownPanel) is below the threshold where shared-lib extraction adds value."
  - "Added PanelTestHarness wrapper component to tests/renderer/anim-breakdown-virtualization.spec.tsx — mirrors Plan 19-04's tests/renderer/global-max-virtualization.spec.tsx PanelTestHarness verbatim. The wrapper holds useState('') query state + mounts the production SearchBar above the panel; the SearchBar's `aria-label='Filter rows by attachment name'` is unchanged so existing getByLabelText query keeps resolving."
metrics:
  duration_minutes: 7
  tasks_completed: 2
  tasks_pending_user_action: 1
  completed_date: "in-progress (Task 3 checkpoint awaiting user dev-mode smoke verification)"
---

# Phase 19 Plan 05: Wave 4 Animation Breakdown Panel — Card Section Icon + Row Coloring + Search-Lift Completion (IN PROGRESS — Task 3 checkpoint)

Wave 4 plan adding the play/film section icon to each AnimationCard's collapsed-card header, state-color row bars + tinted ratio cells inside each card body, and completion of the lifted-search contract (panel-internal SearchBar + import + useState slot all REMOVED; props tightened from Plan 19-03 interim OPTIONAL to REQUIRED). Closes UI-02 for the Animation Breakdown panel. Runs in parallel with Plan 19-04 (Global panel) — different files, no shared edit. **Tasks 1-2 are committed atomically; Task 3 is a `checkpoint:human-verify` gate awaiting user dev-mode smoke verification.**

## Tasks Completed (1-2)

| Task | Name                                                                                                                                                          | Commit  | Files                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Add play/film SVG glyph in collapsed-card header + remove internal SearchBar (element + import + useState) + tighten query props OPTIONAL → REQUIRED          | af761b2 | src/renderer/src/panels/AnimationBreakdownPanel.tsx, tests/renderer/anim-breakdown-virtualization.spec.tsx  |
| 2    | Add row state-color bar + tinted ratio cell (D-06)                                                                                                            | 1b30366 | src/renderer/src/panels/AnimationBreakdownPanel.tsx                                                         |

## Tasks Pending (3)

| Task | Name                                                                                                | Type                       | Awaiting                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 3    | Dev-mode smoke check — Animation Breakdown card icons + row coloring + lifted search                | checkpoint:human-verify    | User runs `npm run dev`, opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, switches to Animation Breakdown tab, walks the 7-step verify protocol from plan §`<how-to-verify>` |

The Task 3 checkpoint payload is returned to the orchestrator. A continuation agent will land a docs commit acknowledging dev-mode smoke approval + finalize this SUMMARY.md once the user signs off.

## What Landed (Tasks 1-2)

### Task 1 — Play/film section glyph + internal SearchBar removal + REQUIRED props (commit `af761b2`)

Edits inside `src/renderer/src/panels/AnimationBreakdownPanel.tsx`:

- **Edit A — REMOVED the SearchBar import line** `import { SearchBar } from '../components/SearchBar';` (no longer used after Edit C removes the JSX element). Avoids dead-code warning under noUnusedLocals.
- **Edit B — Tightened panel props.** `query: string` and `onQueryChange: (q: string) => void` are now REQUIRED on `AnimationBreakdownPanelProps` (was OPTIONAL with `?` per Plan 19-03 interim posture). JSDoc rewritten to drop the "interim OPTIONAL" cadence and cite the Plan 19-05 closure.
- **Edit B-extra — Function signature.** Destructured `query` + `onQueryChange` alongside the existing destructure (`summary`, `focusAnimationName`, `onFocusConsumed`, `overrides`, `onOpenOverrideDialog`).
- **Edit C — REMOVED panel-internal `const [query, setQuery] = useState('');` slot.** The component now consumes `query` as a prop (lifted to AppShell per Plan 19-03 D-04). Inline comment cites the removal rationale + notes that `onQueryChange` is destructured but never invoked from this panel — the sticky-bar SearchBar in AppShell calls it directly through AppShell's binding.
- **Edit C-extra — REMOVED panel-internal `<SearchBar>` JSX element** from the panel's outer header at lines 341-349. The `<h2>Animation Breakdown</h2>` heading is preserved per UI-SPEC §"Copywriting Contract" line 590.
- **Edit D — Play/film SVG glyph in AnimationCard collapsed-card header.** Inserted after the caret span and before the animationName span per UI-SPEC §3 lines 240-247: `<span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5 text-fg">` wrapping `<svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5"><rect x="3" y="3" width="14" height="14" rx="2" /><path d="M9 7 l4 3 -4 3 z" /></svg></span>`. The caret stays (distinct purpose: expand/collapse indicator); play/film is the section-level category icon per D-08.

The AnimationCard `<section>` className at lines 415-422 (`border border-border rounded-md bg-panel overflow-hidden`) is preserved verbatim — already conforms to D-05.

Edit inside `tests/renderer/anim-breakdown-virtualization.spec.tsx` (Rule 3 fix):

- **PanelTestHarness wrapper.** Replaced the bare `renderPanel` factory with a `PanelTestHarness` controlled component holding `useState('')` query state + mounting the production `SearchBar` component above the panel, threading the lifted state down via the now-REQUIRED `query` / `onQueryChange` props. Preserves the existing test query `getByLabelText(/filter rows by attachment name/i)` verbatim because the SearchBar's `aria-label="Filter rows by attachment name"` is unchanged. Imports `useState` from `react` and `SearchBar` from `../../src/renderer/src/components/SearchBar`. Mirrors Plan 19-04's PanelTestHarness in `tests/renderer/global-max-virtualization.spec.tsx` byte-for-byte.

### Task 2 — Row state-color bar + tinted ratio cell (commit `1b30366`)

Edits inside `src/renderer/src/panels/AnimationBreakdownPanel.tsx`:

- **Edit A — RowState type + rowState() module helper.** Added `type RowState = 'under' | 'over' | 'unused' | 'neutral';` and `function rowState(peakRatio: number, isUnused: boolean): RowState` returning the 4-way state per UI-SPEC §5. Defined at module top alongside the existing pure helpers (above EMPTY_OVERRIDES). Inline comment notes the per-animation `isUnused = false` invariant.
- **Edit B — Per-row state computation at both BreakdownRowItem mount sites.** The flat-table path (around line 754) and the virtualized path (around line 793) both compute `const state = rowState(row.effectiveScale, false);` and pass it as a new `state={state}` prop to `<BreakdownRowItem>`. Note: `row.effectiveScale` is used (not the spec's `row.peakRatio` placeholder) — same Rule 3 deviation as Plan 19-04 (peakRatio does not exist on the codebase's EnrichedBreakdownRow shape; effectiveScale IS the override-aware peak ratio relative to source size). isUnused is always false on this panel — per-animation rows do not surface global Unused Assets membership.
- **Edit C — BreakdownRowItemProps `state: RowState` field.** Added the new prop to the interface with a JSDoc citing the predicate input.
- **Edit D — BreakdownRowItem JSX state-bar `<td>`.** Prepended a new `<td className="w-1 p-0">` with a `<span>` carrying `clsx` literal-branch state classes (`bg-success` / `bg-warning` / `bg-danger` / `bg-transparent`) per UI-SPEC §5. `aria-hidden="true"` on the span; the bar adds a 4px column.
- **Edit E — Tinted Scale ratio cell.** Replaced the prior `clsx('py-2 px-3 font-mono text-sm text-right', row.override !== undefined ? 'text-accent' : 'text-fg')` on the Scale cell at lines 598-612 with the 4-way state-aware shape: `bg-success/10 text-success` / `bg-warning/10 text-warning` / `bg-danger/10 text-danger` / `text-fg`. The override percent badge (` • {row.override}%`) below the ratio is preserved — surfaces the override signal even though the ratio cell color is now state-driven (deliberate D-06 visual unification per UI-SPEC line 306).
- **Edit F — Matching `<th aria-label="Row state indicator" />` in `BreakdownTableHead`.** Inserted as the first `<th>` (single shared head between flat + virtualized paths). Empty visual cell carrying only the column-spacing `w-1 p-0` and the a11y label.
- **Edit G — Empty-state colSpan 7 → 8.** The `<td colSpan={7}>` empty-state row is bumped to `colSpan={8}` to keep alignment with the new 8-column shape.

Tailwind v4 literal-class discipline preserved (Pitfall 3 + 8): every clsx branch is a string literal — no template-string interpolation, no programmatic class construction. Verified by grep: zero `${...}` interpolations of any `bg-(success|warning|danger)` class without `/10`.

## Verification (post-Task-2)

All plan-level acceptance gates green at end of Task 2:

| Gate                                                                                                                                                  | Result                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `grep -F '<rect x="3" y="3" width="14" height="14" rx="2" />' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                    | PASS                                  |
| `grep -F '<path d="M9 7 l4 3 -4 3 z" />' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                                         | PASS                                  |
| `grep -F 'Animation Breakdown' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                                                   | PASS (h2 preserved)                   |
| `grep -F '<SearchBar' src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns nothing                                                            | PASS (internal JSX element removed)   |
| `grep -F "const [query, setQuery] = useState('');" src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns nothing                               | PASS (internal slot removed)          |
| `grep -F 'border border-border rounded-md bg-panel overflow-hidden' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                              | PASS (existing AnimationCard wrapper preserved) |
| `grep -E "from ['\"].*src/core" src/renderer/src/panels/AnimationBreakdownPanel.tsx` returns nothing                                                  | PASS (Layer 3 invariant preserved)    |
| `grep -F "type RowState = 'under' | 'over' | 'unused' | 'neutral'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                               | PASS                                  |
| `grep -F "state === 'under' && 'bg-success'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                                     | PASS                                  |
| `grep -F "state === 'over' && 'bg-warning'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                                      | PASS                                  |
| `grep -F "state === 'unused' && 'bg-danger'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                                     | PASS                                  |
| `grep -F "state === 'neutral' && 'bg-transparent'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                               | PASS                                  |
| `grep -F "state === 'under' && 'bg-success/10 text-success'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                     | PASS                                  |
| `grep -F "state === 'over' && 'bg-warning/10 text-warning'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                      | PASS                                  |
| `grep -F "state === 'unused' && 'bg-danger/10 text-danger'" src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                      | PASS                                  |
| `grep -F 'aria-label="Row state indicator"' src/renderer/src/panels/AnimationBreakdownPanel.tsx`                                                      | PASS                                  |
| `grep -E '\$\{.*\}' .../AnimationBreakdownPanel.tsx \| grep -E "bg-(success\|warning\|danger)" \| grep -v "/10"` returns nothing                      | PASS (no template-string interpolation of bg-* state classes) |
| `npx tsc --noEmit`                                                                                                                                    | PASS (exits 0)                        |
| `npm test -- tests/arch.spec.ts` (Layer 3 grep gate)                                                                                                  | PASS (12/12)                          |
| `npm test`                                                                                                                                            | 534 passed / 1 pre-existing fail / 2 skipped / 2 todo (538 + 1 = 539 total — Plan 19-05 introduces zero new failures; same `tests/main/sampler-worker-girl.spec.ts` warm-up assertion fail as documented in 19-01 SUMMARY) |
| `npm test -- tests/renderer/anim-breakdown-virtualization.spec.tsx`                                                                                   | PASS (4/4 tests pass after PanelTestHarness fix) |
| Dev-mode smoke (Task 3)                                                                                                                                | PENDING — awaiting user verification  |

## Deviations from Plan

### Rule 3 — Used `row.effectiveScale` for state predicate input (not `row.peakRatio`)

**Found during:** Task 2 Edit B.

**Issue:** UI-SPEC §5 + Plan Edit A show `rowState(row.peakRatio, ...)` and `row.peakRatio.toFixed(2)×`. The field `peakRatio` does not exist on `BreakdownRow` or `EnrichedBreakdownRow` in this codebase. The closest analog is `effectiveScale` (the override-aware peak scale; equals `peakScale × (override / 100)` when override is set, else `peakScale`). Semantically `effectiveScale` IS the ratio relative to source size that the spec describes (1.0× threshold).

**Fix:** Used `row.effectiveScale` everywhere the spec said `row.peakRatio`. The `rowState` helper signature is `rowState(peakRatio: number, isUnused: boolean)` — the parameter name preserves the spec terminology even though the caller passes `effectiveScale`. The thresholds (`< 1.0` / `> 1.0`) work unchanged since `effectiveScale` is already a ratio in the same dimensionless space. Identical deviation to Plan 19-04's GlobalMaxRenderPanel implementation (same Rule 3 documented in 19-04-SUMMARY.md §Deviations).

**Files modified:** src/renderer/src/panels/AnimationBreakdownPanel.tsx (Task 2).

**Commit:** 1b30366.

### Rule 3 — Tinted Scale cell, not Peak W×H cell (line range in plan was a placeholder)

**Found during:** Task 2 Edit E.

**Issue:** Plan Edit D references a generic "ratio cell" with the example `{row.peakRatio.toFixed(2)×}`. The closest cell in this panel that semantically renders a ratio is the Scale cell (the `effectiveScale.toFixed(3)×` cell at lines 598-612). The Peak W×H cell (lines 619-627) is dimensions, not a ratio.

**Fix:** Tinted the Scale cell since it semantically displays a ratio. The Peak W×H cell at 619-627 was left untouched — it continues using the existing `row.override !== undefined ? 'text-accent' : 'text-fg'` clsx branch. Plan §`<action>` "DO NOT touch" explicit list does not name the W×H cell, but the symmetry with Plan 19-04's same decision (Plan 19-04-SUMMARY.md §Deviations Rule 3 #2) makes the choice unambiguous.

**Files modified:** src/renderer/src/panels/AnimationBreakdownPanel.tsx (Task 2).

**Commit:** 1b30366.

### Rule 3 — Added test harness PanelTestHarness wrapper (test side fix for REQUIRED-prop tightening)

**Found during:** Task 1 verification → ran `npm test -- tests/renderer/anim-breakdown-virtualization.spec.tsx`, found all 4 tests failing because the existing `renderPanel` factory mounted the panel without `query` / `onQueryChange` (now REQUIRED after Task 1) → `query.trim()` crashed in `filterCardsByAttachmentName`.

**Issue:** Tightening the panel props from OPTIONAL to REQUIRED breaks the existing test renderer. Additionally, the "filter query preserved" test queries the SearchBar via `getByLabelText(/filter rows by attachment name/i)` — but the panel-internal SearchBar element is removed in Task 1. The lookup must now resolve to the lifted (sticky-bar) SearchBar instance.

**Fix:** Added a `PanelTestHarness` controlled wrapper component to the test file (mirroring Plan 19-04's pattern verbatim): holds `useState('')` query state, mounts the production `SearchBar` component above the panel under test, and threads the lifted state down via REQUIRED `query` / `onQueryChange` props. The SearchBar's `aria-label="Filter rows by attachment name"` is unchanged so the existing `getByLabelText(...)` query keeps resolving. Imports `useState` from `react` and `SearchBar` from `../../src/renderer/src/components/SearchBar`. After fix: 4/4 tests pass.

**Files modified:** tests/renderer/anim-breakdown-virtualization.spec.tsx (Task 1).

**Commit:** af761b2.

## Authentication Gates

None — Plan 19-05 is renderer-only UI refresh; no auth surface touched.

## Pre-existing Test Failure (Out of Scope)

`tests/main/sampler-worker-girl.spec.ts` ("Wave 1 N2.2 wall-time gate") fails at the warm-up assertion (`expected 'error' to be 'complete'`) on the Girl fixture sampler-worker. **Verified pre-existing** — same fail mode documented in 19-01-SUMMARY.md §"Pre-existing Test Failure (Out of Scope)" and 19-04-SUMMARY.md §"Pre-existing Test Failure (Out of Scope)". Plan 19-05 modifies only `AnimationBreakdownPanel.tsx` + a renderer test file; nothing in either touches the sampler-worker path. Plan 19-05 introduces zero new test failures.

Adjusted vitest count: 534 passing + 1 pre-existing fail + 2 skipped + 2 todo (539 total).

## Task 3 Checkpoint Status

**Type:** `checkpoint:human-verify`
**Reason:** UI-02 row-state coloring + the locked play/film SVG glyph rendering + the lifted-search functional contract are visual claims with no automated test surface in this codebase (CLAUDE.md notes no Electron headless harness, and the verification Tailwind utilities resolve at generation time — `bg-success/10` etc. only render correctly at dev-server build time).

**What needs to happen:**
1. User runs `npm run dev` from project root.
2. User opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.
3. User switches to the Animation Breakdown tab.
4. User walks the 7-step verify protocol from plan §`<how-to-verify>`:
   - Each AnimationCard's collapsed header shows: caret (▸ or ▾) → play/film SVG glyph (rounded square with right-pointing triangle) → animation name → count label
   - Expand at least one AnimationCard; rows show state-color left bars + tinted ratio cells (green/yellow/transparent)
   - Sticky-bar SearchBar (from Plan 19-03) drives panel filter across all AnimationCards
   - No duplicate SearchBar visible inside the Animation Breakdown panel header — only the `Animation Breakdown` `<h2>` heading
5. User approves (or rejects with specific failure description).
6. Continuation agent lands a docs-only commit acknowledging dev-mode smoke approval + appends a final "## Dev-Mode Smoke Approval" section to this SUMMARY.md.

This SUMMARY.md is **not yet finalized** — the continuation agent will:
- Append a `## Dev-Mode Smoke Approval` section with date + sign-off.
- Update `status` frontmatter from `in-progress-at-task-3-checkpoint` to `complete`.
- Update `metrics.completed_date` from `in-progress (...)` to the actual completion date.
- Append a `## Self-Check: PASSED` section verifying all commits exist + the modified files exist.

## Hand-off Notes for Downstream Plans

- **Plans 19-06 / 19-07 (modal summary tiles + cross-nav, if planned):** Independent of this plan; consume Plan 19-03's locked prop names (`onOpenAtlasPreview`, `onOpenOptimizeDialog`).
- **Future polish plans:** Sticky-bar element height harmonization (Plan 19-03 dev-smoke deferred item) is unchanged by this plan. Animation Breakdown panel does not exhibit the GlobalMaxRenderPanel's "panel-internal SearchBar typing causes layout shift" symptom (per 19-03-SUMMARY.md §"New findings outside scope") — that was Global-panel-specific.

## Self-Check (Tasks 1-2 only — Task 3 self-check appended by continuation agent)

Verified files exist + were modified per task scope:
- FOUND: `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (modified in Tasks 1, 2)
- FOUND: `tests/renderer/anim-breakdown-virtualization.spec.tsx` (modified in Task 1)

Verified commits exist on `worktree-agent-ae8a3f30ec3ad8936` branch:
- FOUND: `af761b2` — feat(19-05): add play/film section glyph + remove internal SearchBar + tighten query props to REQUIRED
- FOUND: `1b30366` — feat(19-05): add row state-color bar + tinted ratio cell (D-06)

Tasks 1-2 self-check: PASSED.

## Dev-Mode Smoke Approval

**Date:** 2026-05-01
**Result:** Approved

User ran `npm run dev`, opened the Jokerman fixture, switched to the Animation Breakdown tab, and visually verified:
- Each AnimationCard collapsed-card header shows: caret → play/film SVG glyph (rounded square + right-pointing triangle) → animation name → count label — PASS
- Expanded rows show state-color left bars + tinted ratio cells (green when scale < 1.0×, warm-honey when > 1.0×, transparent when = 1.0×) — PASS
- No duplicate SearchBar inside the panel; only the `Animation Breakdown` `<h2>` heading is visible — PASS
- Sticky-bar SearchBar (from Plan 19-03) filters rows across all AnimationCards — PASS
- Query persists across Global ↔ Animation Breakdown tab switches — PASS (this closes the Wave 3 step-10 regression)

**Cross-cutting Wave 3 step-10 regression — RESOLVED.** Removing the per-panel `useState('')` slots and the per-panel `<SearchBar>` elements (in both Plans 19-04 and 19-05), plus tightening `query?: string` → `query: string` and `onQueryChange?: (q: string) => void` → `onQueryChange: (q: string) => void` on both panel prop interfaces, makes the AppShell-lifted `query` state the single source of truth that both panels consume via `props.query`.

## Self-Check: PASSED

All three commits verified on main after worktree merge:
- af761b2 — feat(19-05): add play/film section glyph + remove internal SearchBar + tighten query props to REQUIRED
- 1b30366 — feat(19-05): add row state-color bar + tinted ratio cell (D-06)
- 0a289cd — docs(19-05): in-progress summary at Task 3 checkpoint

Plan 19-05 complete.
