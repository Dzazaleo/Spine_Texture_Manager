---
phase: 19
plan: 04
subsystem: renderer-global-max-panel
tags: [card-layout, row-coloring, mb-savings-callout, search-lift-completion, wave-4, ui-04-dormant-pending-design-pivot]
status: complete
requires:
  - "Plan 19-01 — formatBytes helper + bytesOnDisk?: number on UnusedAttachment + --color-success/--color-warning Tailwind tokens"
  - "Plan 19-02 — main-side fs.statSync writer populating bytesOnDisk"
  - "Plan 19-03 — lifted query state in AppShell + interim OPTIONAL panel-prop posture (query?: string + onQueryChange?: (q: string) => void) + sticky-bar SearchBar wiring"
  - "Existing virtualizer + sticky <thead> + clsx literal-branch row-class pattern + unusedAttachments derive at GlobalMaxRenderPanel.tsx"
provides:
  - "Card-wrapped Global panel — outer <section className='border border-border rounded-md bg-panel p-4 mb-4'> per D-05 (UI-SPEC §4)"
  - "Section header with ruler SVG glyph (UI-SPEC §3 lines 232-238) + locked title 'Global Max Render Scale' (Copywriting Contract line 589) + preserved selected/total metadata"
  - "Row state predicate (rowState(peakRatio, isUnused) → 'under' | 'over' | 'unused' | 'neutral') driving (a) state-color left-accent <td>/<span> bar with literal-class branches (bg-success / bg-warning / bg-danger / bg-transparent) per UI-SPEC §5 + Tailwind v4 discipline; (b) tinted ratio cell with bg-{state}/10 text-{state} branches"
  - "Matching <th aria-label='Row state indicator' /> in BOTH thead instances (virtualized + flat) keeping column count consistent; empty-state colSpan bumped from 8 → 9"
  - "MB-savings callout: aggregateBytes = unusedAttachments.reduce((acc, u) => acc + (u.bytesOnDisk ?? 0), 0) — uses (u.bytesOnDisk ?? 0) fallback per orchestrator's revision-pass lock for the OPTIONAL bytesOnDisk?: number field; renders `{formatBytes(aggregateBytes)} potential savings` when aggregateBytes > 0, falls back to count-only `N unused attachment(s)` when aggregateBytes === 0 (D-15 atlas-packed case) per UI-SPEC §11"
  - "Stroke-based SVG warning-triangle glyph (UI-SPEC §3 lines 254-259) replacing the prior `⚠` Unicode glyph in the unused-section header; text-danger color inherited via currentColor"
  - "REQUIRED panel-prop posture (tightened from Plan 19-03 interim OPTIONAL): query: string + onQueryChange: (q: string) => void on GlobalMaxRenderPanelProps; internal SearchBar JSX element + internal SearchBar import line + internal useState('') slot ALL REMOVED"
affects:
  - "Plan 19-05 (AnimationBreakdownPanel — Wave 4 sibling) — independent file but mirrors the same row-coloring pattern + interim-prop tightening + internal SearchBar removal on the AnimationBreakdownPanel side"
  - "Future plans consuming bg-success/bg-warning/bg-success/10/bg-warning/10 utilities — emitted at generation time (Plan 19-01 token foundation)"
tech-stack:
  added: []
  patterns:
    - "Card wrapper at panel section level (D-05 verbatim — `border border-border rounded-md bg-panel p-4 mb-4`)"
    - "Row state predicate + state-bar <td>/<span> + tinted ratio cell with clsx literal-branch discipline (UI-SPEC §5 verbatim)"
    - "Locked SVG glyph trio (ruler + warning triangle) — stroke-based with currentColor inheritance, no fills, hand-rolled to fit warm-stone aesthetic"
    - "(field?? 0) reduce-fallback for OPTIONAL primitive IPC fields (mirrors structuredClone-safety D-21 docblock + planner's revision-pass lock)"
    - "REQUIRED-prop tightening pattern — Plan 19-03 interim OPTIONAL → Plan 19-04 REQUIRED (mirrored by Plan 19-05 on the AnimationBreakdownPanel side)"
    - "Test harness pattern for lifted-state contracts — controlled wrapper component holding query state + mounting the production SearchBar above the panel under test (PanelTestHarness in tests/renderer/global-max-virtualization.spec.tsx)"
key-files:
  created: []
  modified:
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (formatBytes import; SearchBar import REMOVED; card wrapper + section-icon header; internal useState('') slot REMOVED; query/onQueryChange tightened to REQUIRED + destructured; RowState type + rowState() helper at module top; unusedNameSet derive; aggregateBytes derive; per-row state computed at both Row mount sites; state-bar <td> + tinted ratio cell in Row JSX; <th aria-label='Row state indicator' /> in both thead instances; empty-state colSpan 8 → 9; ⚠ replaced with stroke-based SVG triangle; count-only copy → conditional MB-savings callout)"
    - "tests/renderer/global-max-virtualization.spec.tsx (Rule 3 fix — added PanelTestHarness controlled wrapper threading the now-REQUIRED query/onQueryChange props + mounting the production SearchBar so existing getByLabelText queries keep resolving)"
decisions:
  - "Used row.effectiveScale (not row.peakRatio) as the state predicate input — `peakRatio` does not exist on DisplayRow/EnrichedRow in this codebase; effectiveScale is the override-aware peak scale and IS the ratio the spec describes (1.0× source threshold). UI-SPEC §5 example was read literally; planner's intent is the ratio meaning, not the field name."
  - "Tinted the Scale cell (the panel's existing `effectiveScale.toFixed(3)×` cell at row 403-417), not the Peak W×H cell, since the Scale cell is what semantically displays a 'ratio'. Plan's Edit D citation of lines 385-393 was based on stale line numbers; the JSX shape that uses `row.peakRatio.toFixed(2)×` clearly maps to the Scale cell."
  - "Per UI-SPEC line 306, state-color trumps prior override-aware text-accent on the Scale cell (deliberate D-06 visual unification). Override percent badge (` • {row.override}%`) below the ratio still surfaces the override signal for power users. Title tooltip (`{override}% of source = {effectiveScale}×`) preserved verbatim."
  - "Test harness for lifted-state contracts: introduced PanelTestHarness wrapper component holding query useState + the production SearchBar component, threading down to the panel via REQUIRED query/onQueryChange. Preserves existing getByLabelText(/filter rows by attachment name/i) lookup verbatim (SearchBar's aria-label is unchanged)."
metrics:
  duration_minutes: 9
  tasks_completed: 3
  tasks_pending_user_action: 1
  completed_date: "in-progress (Task 4 checkpoint awaiting user dev-mode smoke verification)"
---

# Phase 19 Plan 04: Wave 4 Global Panel — Card Wrap + Row Coloring + MB-Savings Callout + Search-Lift Completion (IN PROGRESS — Task 4 checkpoint)

Wave 4 plan converting the Global panel into the locked card layout with the ruler section icon, state-color row bars + tinted ratio cells, MB-savings callout via formatBytes(aggregateBytes) using `(u.bytesOnDisk ?? 0)` fallback, the locked stroke-based SVG warning triangle replacing the `⚠` glyph, and completion of the lifted-search contract (panel-internal SearchBar + import + useState slot all REMOVED; props tightened from interim OPTIONAL to REQUIRED). **Tasks 1-3 are committed atomically; Task 4 is a `checkpoint:human-verify` gate awaiting user dev-mode smoke verification.**

## Tasks Completed (1-3)

| Task | Name                                                                                                                                          | Commit  | Files                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| 1    | Wrap panel in card + ruler section icon + remove internal SearchBar (element + import + useState) + tighten query props OPTIONAL → REQUIRED   | 3d42e42 | src/renderer/src/panels/GlobalMaxRenderPanel.tsx                                   |
| 2    | Add row state-color bar + tinted ratio cell (D-06)                                                                                            | 70b7017 | src/renderer/src/panels/GlobalMaxRenderPanel.tsx                                   |
| 3    | Replace ⚠ glyph + add MB-savings callout (UI-04 + D-13/D-14/D-15)                                                                              | c00c5e1 | src/renderer/src/panels/GlobalMaxRenderPanel.tsx, tests/renderer/global-max-virtualization.spec.tsx |

## Tasks Pending (4)

| Task | Name                                                                                                | Type                       | Awaiting                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 4    | Dev-mode smoke check — Global panel card layout + row coloring + MB-savings callout                  | checkpoint:human-verify    | User runs `npm run dev`, opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, switches to Global panel, walks the 9-step verify protocol from plan §`<how-to-verify>` |

The Task 4 checkpoint payload is returned to the orchestrator. A continuation agent will land a docs commit acknowledging dev-mode smoke approval + finalize this SUMMARY.md once the user signs off.

## What Landed (Tasks 1-3)

### Task 1 — Card wrap + section icon + internal SearchBar removal + REQUIRED props (commit `3d42e42`)

Edits inside `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`:

- **Edit A — formatBytes import.** Added `import { formatBytes } from '../lib/format-bytes';` next to existing relative imports. Used in Task 3.
- **Edit B — Card wrapper.** Wrapped the panel content in `<section className="border border-border rounded-md bg-panel p-4 mb-4">` per D-05 (UI-SPEC §4). The existing outer `<div className="w-full max-w-6xl mx-auto p-8">` STAYS — the new card lives INSIDE it, the virtualizer's overflow-auto container stays INSIDE the card.
- **Edit C — Section header.** Replaced the existing `<header>` (search box + count chip) with the locked icon-bearing header per UI-SPEC §3: ruler SVG glyph (`<rect x="2" y="6" width="16" height="8" rx="1" /><path d="M5 6 v3 M8 6 v2 M11 6 v3 M14 6 v2 M17 6 v3" />`), title text `Global Max Render Scale` (Copywriting Contract line 589), preserved right-side `{selected.size} selected / {sorted.length} total` metadata via `ml-auto`.
- **Edit C-extra — REMOVED the SearchBar import line** `import { SearchBar } from '../components/SearchBar';` per orchestrator's revision-pass fix (checker WARNING 6) — no longer used after Edit C removed the JSX element. Avoids dead-code TS warning under noUnusedLocals.
- **Edit D — REMOVED panel-internal `const [query, setQuery] = useState('');` slot.** The component now consumes `query` as a prop (lifted to AppShell per Plan 19-03 D-04). Inline comment cites the removal rationale.
- **Edit E — Tightened panel props.** `query: string` and `onQueryChange: (q: string) => void` are now REQUIRED on `GlobalMaxRenderPanelProps` (was OPTIONAL with `?` per Plan 19-03 interim posture). Function signature updated to destructure both new props alongside the existing destructure; JSDoc rewritten to drop the "interim OPTIONAL" cadence and cite the Plan 19-04 closure.

CLAUDE.md fact #1 wording (rig-info tooltip skeleton.fps line) is unaffected by this plan — that text lives in AppShell, not in this panel.

### Task 2 — Row state-color bar + tinted ratio cell (commit `70b7017`)

Edits inside `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`:

- **Edit A — RowState type + rowState() module helper.** Added `type RowState = 'under' | 'over' | 'unused' | 'neutral';` and `function rowState(peakRatio: number, isUnused: boolean): RowState` returning the 4-way state per UI-SPEC §5. Defined at module top alongside the existing pure helpers (above EMPTY_OVERRIDES).
- **Edit B — unusedNameSet derive.** Inside the component, after the existing `unusedAttachments` derive, added a `useMemo`-cached `Set<string>` of unused attachment names for O(1) per-row state lookup.
- **Edit C — Per-row state computation at both Row mount sites.** The virtualized path (line ~919) and flat-table path (line ~1033) both compute `const state = rowState(row.effectiveScale, unusedNameSet.has(row.attachmentName));` and pass it as a new `state={state}` prop to `<Row>`. Note: `row.effectiveScale` is used (not the spec's `row.peakRatio` placeholder) because `peakRatio` does not exist on this codebase's `EnrichedRow`/`DisplayRow` shape; `effectiveScale` IS the override-aware peak ratio relative to the source size. Decision logged in frontmatter `decisions:`.
- **Edit D — RowProps `state: RowState` field.** Added the new prop to the `RowProps` interface.
- **Edit E — Row JSX state-bar `<td>`.** Prepended a new `<td className="w-1 p-0">` with a `<span>` carrying `clsx` literal-branch state classes (`bg-success` / `bg-warning` / `bg-danger` / `bg-transparent`) per UI-SPEC §5. `aria-hidden="true"` on the span; the bar adds a 4px column.
- **Edit F — Tinted Scale ratio cell.** Replaced the prior `clsx('py-2 px-3 font-mono text-sm text-right', row.override !== undefined ? 'text-accent' : 'text-fg')` on the Scale cell at line ~403-417 with the 4-way state-aware shape: `bg-success/10 text-success` / `bg-warning/10 text-warning` / `bg-danger/10 text-danger` / `text-fg`. The override percent badge (` • {row.override}%`) below the ratio is preserved — surfaces the override signal even though the ratio cell color is now state-driven (deliberate D-06 visual unification per UI-SPEC line 306).
- **Edit G — Matching `<th aria-label="Row state indicator" />` in BOTH thead instances.** Inserted as the first `<th>` in the virtualized sticky thead (~line 851) and in the flat-table thead (~line 960). Empty visual cell carrying only the column-spacing `w-1 p-0` and the a11y label.
- **Edit H — Empty-state colSpan 8 → 9.** The `<td colSpan={8}>` empty-state row in the flat-table path is bumped to `colSpan={9}` to keep alignment with the new 9-column shape.

Tailwind v4 literal-class discipline preserved (Pitfall 3 + 8): every clsx branch is a string literal — no template-string interpolation, no programmatic class construction. Verified by grep: zero `${...}` interpolations of any `bg-(success|warning|danger)` class without `/10`.

### Task 3 — ⚠ replacement + MB-savings callout + test-harness Rule 3 fix (commit `c00c5e1`)

Edits inside `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`:

- **Edit A — aggregateBytes derive.** Inside the component, immediately below `unusedNameSet`, added `const aggregateBytes = unusedAttachments.reduce((acc, u) => acc + (u.bytesOnDisk ?? 0), 0);`. The `(u.bytesOnDisk ?? 0)` fallback is the orchestrator's revision-pass lock (checker BLOCKER 2 fix) — handles the OPTIONAL `bytesOnDisk?: number` field per Plan 19-01. When every row has `bytesOnDisk === 0` (atlas-packed projects per D-15) or all rows have the field absent (defensive), `aggregateBytes` resolves to 0.
- **Edit B — Replace `⚠` Unicode glyph.** The existing `<span aria-hidden="true">⚠</span>` inside the unused-section header is replaced with `<span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5">` wrapping the locked stroke-based SVG warning triangle per UI-SPEC §3 lines 254-259: `<path d="M10 3 L18 16 L2 16 Z" />` (triangle) + `<path d="M10 8 v4 M10 14.5 v0.01" />` (exclamation). `stroke="currentColor"` lets the glyph inherit `text-danger` from the parent `<header>` — no token plumbing needed.
- **Edit C — MB-savings conditional.** Replaced the count-only inner `<span>` with the verbatim UI-SPEC §11 conditional:
  ```tsx
  {aggregateBytes > 0 ? (
    <span className="text-fg-muted font-mono">
      <span className="font-semibold text-fg">{formatBytes(aggregateBytes)}</span>
      {' '}potential savings
    </span>
  ) : (
    <span className="text-fg-muted font-mono">
      {filteredUnused.length === 1
        ? '1 unused attachment'
        : `${filteredUnused.length} unused attachments`}
    </span>
  )}
  ```
  Strict-equality threshold (`aggregateBytes > 0`) per D-15: any non-zero aggregate renders MB-savings; zero falls back to count-only honest copy.

Edit inside `tests/renderer/global-max-virtualization.spec.tsx` (Rule 3 fix):

- **PanelTestHarness wrapper.** Replaced the bare `renderPanel` factory with a `PanelTestHarness` controlled component holding `useState('')` query state + mounting the production `SearchBar` component above the panel, threading the lifted state down via the now-REQUIRED `query` / `onQueryChange` props. Preserves the existing test query `getByLabelText(/filter rows by attachment name/i)` verbatim because the SearchBar's `aria-label="Filter rows by attachment name"` is unchanged. Imports `useState` from `react` and `SearchBar` from `../../src/renderer/src/components/SearchBar`.

## Verification (post-Task-3)

All plan-level acceptance gates green at end of Task 3:

| Gate                                                                                                                                                                             | Result                                |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `grep -F "import { formatBytes } from '../lib/format-bytes'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                   | PASS                                  |
| `grep -F 'border border-border rounded-md bg-panel p-4 mb-4' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                   | PASS                                  |
| `grep -F '<rect x="2" y="6" width="16" height="8" rx="1" />' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                   | PASS                                  |
| `grep -F 'M5 6 v3 M8 6 v2 M11 6 v3 M14 6 v2 M17 6 v3' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                          | PASS                                  |
| `grep -F 'Global Max Render Scale' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                             | PASS                                  |
| `grep -F "const [query, setQuery] = useState('');" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns nothing                                                             | PASS                                  |
| `grep -F '<SearchBar' src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns nothing                                                                                          | PASS                                  |
| `grep -F "from '../components/SearchBar'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns nothing                                                                      | PASS                                  |
| `grep -F 'query: string;' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                      | PASS                                  |
| `grep -F 'query?: string' src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns nothing                                                                                      | PASS                                  |
| `grep -F 'onQueryChange: (q: string) => void;' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                 | PASS                                  |
| `grep -F "type RowState = 'under' | 'over' | 'unused' | 'neutral'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                              | PASS                                  |
| `grep -F "state === 'under' && 'bg-success'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                    | PASS                                  |
| `grep -F "state === 'over' && 'bg-warning'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                     | PASS                                  |
| `grep -F "state === 'unused' && 'bg-danger'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                    | PASS                                  |
| `grep -F "state === 'neutral' && 'bg-transparent'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                              | PASS                                  |
| `grep -F "state === 'under' && 'bg-success/10 text-success'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                    | PASS                                  |
| `grep -F "state === 'over' && 'bg-warning/10 text-warning'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                     | PASS                                  |
| `grep -F "state === 'unused' && 'bg-danger/10 text-danger'" src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                     | PASS                                  |
| `grep -F 'aria-label="Row state indicator"' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                    | PASS                                  |
| `grep -F 'M10 3 L18 16 L2 16 Z' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                 | PASS                                  |
| `grep -F 'M10 8 v4 M10 14.5 v0.01' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                              | PASS                                  |
| `grep -F 'formatBytes(aggregateBytes)' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                          | PASS                                  |
| `grep -F 'potential savings' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                    | PASS                                  |
| `grep -F 'aggregateBytes > 0 ?' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                 | PASS                                  |
| `grep -F '(u.bytesOnDisk ?? 0)' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                 | PASS                                  |
| `grep -F '<span aria-hidden="true">⚠</span>' src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns nothing                                                                    | PASS                                  |
| `grep -F 'unusedAttachments.reduce' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                             | PASS                                  |
| `grep -F '1 unused attachment' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                  | PASS                                  |
| `grep -F 'unused attachments' src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                                                                                                   | PASS                                  |
| `grep -E "from ['\"].*src/core" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns nothing                                                                                 | PASS (Layer 3 invariant preserved)    |
| `npx tsc --noEmit`                                                                                                                                                                | PASS (exits 0)                        |
| `npm test`                                                                                                                                                                         | 534 passed / 1 pre-existing fail / 2 skipped / 2 todo (538 + 1 = 539 total — Plan 19-04 introduces zero new failures; same `tests/main/sampler-worker-girl.spec.ts` warm-up assertion fail as documented in 19-01 SUMMARY) |
| `npm test -- tests/arch.spec.ts` (Layer 3 grep gate)                                                                                                                              | PASS (12/12)                          |
| Dev-mode smoke (Task 4)                                                                                                                                                            | PENDING — awaiting user verification  |

## Deviations from Plan

### Rule 3 — Used `row.effectiveScale` for state predicate input (not `row.peakRatio`)

**Found during:** Task 2 Edit C.

**Issue:** UI-SPEC §5 + Plan Edit D show `row.peakRatio.toFixed(2)×` and `rowState(row.peakRatio, ...)`. The field `peakRatio` does not exist on `DisplayRow` or `EnrichedRow` in this codebase. The closest analog is `effectiveScale` (the override-aware peak scale; equals `peakScale × (override / 100)` when override is set, else `peakScale`). Semantically `effectiveScale` IS the ratio relative to source size that the spec describes (1.0× threshold).

**Fix:** Used `row.effectiveScale` everywhere the spec said `row.peakRatio`. The `rowState` helper signature is `rowState(peakRatio: number, isUnused: boolean)` — the parameter name preserves the spec terminology even though the caller passes `effectiveScale`. The thresholds (`< 1.0` / `> 1.0`) work unchanged since `effectiveScale` is already a ratio in the same dimensionless space.

**Files modified:** src/renderer/src/panels/GlobalMaxRenderPanel.tsx (Task 2).

**Commit:** 70b7017.

### Rule 3 — Tinted Scale cell, not Peak W×H cell (line range in plan was stale)

**Found during:** Task 2 Edit F.

**Issue:** Plan Edit D references "the existing peakRatio cell at lines 385-393". In the current file, lines 385-393 actually contain the Peak W×H cell (`{`${row.effExportW}×${row.effExportH}`}`), not the ratio cell. The Scale cell (which displays `effectiveScale.toFixed(3)×` — the closest analog to the spec's `row.peakRatio.toFixed(2)×`) lives at lines 403-417.

**Fix:** Tinted the Scale cell (the `effectiveScale.toFixed(3)×` cell) since that's the cell that semantically displays a ratio. The Peak W×H cell at 385-393 was left untouched — it continues using the existing `row.override !== undefined ? 'text-accent' : 'text-fg'` clsx branch (Plan §`<action>` "DO NOT touch" item explicitly preserves the W×H cell).

**Files modified:** src/renderer/src/panels/GlobalMaxRenderPanel.tsx (Task 2).

**Commit:** 70b7017.

### Rule 3 — Added test harness PanelTestHarness wrapper (test side fix for REQUIRED-prop tightening)

**Found during:** Task 1 verification → ran `npm test`, found `tests/renderer/global-max-virtualization.spec.tsx` failing because the existing `renderPanel` factory mounted the panel without `query` / `onQueryChange` (now REQUIRED after Task 1).

**Issue:** Tightening the panel props from OPTIONAL to REQUIRED breaks the existing test renderer. Additionally, the "sort/search/checkbox" test queries the SearchBar via `getByLabelText(/filter rows by attachment name/i)` — but the panel-internal SearchBar element is removed in Task 1. The lookup must now resolve to the lifted (sticky-bar) SearchBar instance.

**Fix:** Added a `PanelTestHarness` controlled wrapper component to the test file (mirroring AppShell's lifted-state contract): holds `useState('')` query state, mounts the production `SearchBar` component above the panel under test, and threads the lifted state down via REQUIRED `query` / `onQueryChange` props. The SearchBar's `aria-label="Filter rows by attachment name"` is unchanged so the existing `getByLabelText(...)` query keeps resolving. Imports `useState` from `react` and `SearchBar` from `../../src/renderer/src/components/SearchBar`.

**Files modified:** tests/renderer/global-max-virtualization.spec.tsx (Task 3).

**Commit:** c00c5e1.

## Authentication Gates

None — Plan 19-04 is renderer-only UI refresh; no auth surface touched.

## Pre-existing Test Failure (Out of Scope)

`tests/main/sampler-worker-girl.spec.ts` ("Wave 1 N2.2 wall-time gate") fails at the warm-up assertion (`expected 'error' to be 'complete'`) on the Girl fixture sampler-worker. **Verified pre-existing** — same fail mode documented in 19-01 SUMMARY §"Pre-existing Test Failure (Out of Scope)". Plan 19-04 modifies only `GlobalMaxRenderPanel.tsx` + a renderer test file; nothing in either touches the sampler-worker path. Plan 19-04 introduces zero new test failures.

Adjusted vitest count: 534 passing + 1 pre-existing fail + 2 skipped + 2 todo (539 total).

## Task 4 Checkpoint Status

**Type:** `checkpoint:human-verify`
**Reason:** UI-02 row-state coloring + the locked SVG glyphs + UI-04 MB-savings callout text are visual claims with no automated test surface in this codebase (CLAUDE.md notes no Electron headless harness, and the verification Tailwind utilities resolve at generation time — `bg-success/10` etc. only render correctly at dev-server build time).

**What needs to happen:**
1. User runs `npm run dev` from project root.
2. User opens `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`.
3. User switches to the Global panel (already the default tab).
4. User walks the 9-step verify protocol from plan §`<how-to-verify>`:
   - Card wrapper visible (1px warm-stone border)
   - Ruler section icon visible left of "Global Max Render Scale"
   - Rows show state-color bars + tinted ratio cells (green / yellow / transparent / red-for-unused)
   - ⚠ Unicode glyph replaced with stroke-based SVG warning triangle in unused-section
   - Unused callout shows `X.XX MB potential savings` (or count-only fallback for atlas-packed)
   - Sticky-bar SearchBar (from Plan 19-03) drives panel filter
   - No duplicate SearchBar inside the Global panel
5. User approves (or rejects with specific failure description).
6. Continuation agent lands a docs-only commit acknowledging dev-mode smoke approval + appends a final "## Dev-Mode Smoke Approval" section to this SUMMARY.md.

This SUMMARY.md is **not yet finalized** — the continuation agent will:
- Append a `## Dev-Mode Smoke Approval` section with date + sign-off.
- Update `status` frontmatter from `in-progress-at-task-4-checkpoint` to `complete`.
- Update `metrics.completed_date` from `in-progress (...)` to the actual completion date.
- Append a `## Self-Check: PASSED` section verifying all three commits exist + the modified file exists.

## Hand-off Notes for Downstream Plans

- **Plan 19-05 (AnimationBreakdownPanel — Wave 4 sibling, parallel to this plan):**
  - Mirror Task 1 + Task 2 patterns on the AnimationBreakdownPanel side: card-per-cardId wrap, play/film SVG section icon, row state-color bar + tinted ratio cell, REMOVE internal SearchBar element + import + useState slot, tighten `query?: string` / `onQueryChange?: (q: string) => void` → REQUIRED on `AnimationBreakdownPanelProps`.
  - The `rowState` helper landed at module top in GlobalMaxRenderPanel.tsx is exported from a private path. Plan 19-05 should either co-locate an identical helper inside AnimationBreakdownPanel.tsx OR (preferred) extract `rowState` to `src/renderer/src/lib/row-state.ts` as a shared pure helper.
  - Apply the same `(u.bytesOnDisk ?? 0)` reduce-fallback if AnimationBreakdownPanel surfaces unused-attachment aggregates (it currently does not — only Global panel has the unused-section callout per existing structure).

- **Plan 19-06 / 19-07 (modal summary tiles + cross-nav):** Independent of this plan; consume Plan 19-03's locked prop names (`onOpenAtlasPreview`, `onOpenOptimizeDialog`).

## Self-Check (Tasks 1-3 only — Task 4 self-check appended by continuation agent)

Verified files exist + were modified per task scope:
- FOUND: `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (modified in Tasks 1, 2, 3)
- FOUND: `tests/renderer/global-max-virtualization.spec.tsx` (modified in Task 3)

Verified commits exist on `worktree-agent-a506471690f72080d` branch:
- FOUND: `3d42e42` — feat(19-04): wrap Global panel in card + ruler section icon + remove internal SearchBar + tighten query props to REQUIRED
- FOUND: `70b7017` — feat(19-04): add row state-color bar + tinted ratio cell (D-06)
- FOUND: `c00c5e1` — feat(19-04): replace ⚠ glyph + add MB-savings callout (UI-04 + D-13/D-14/D-15)

Tasks 1-3 self-check: PASSED.

## Dev-Mode Smoke Approval

**Date:** 2026-05-01
**Result:** Approved with one verification deferred to Phase 21+

User ran `npm run dev`, opened the Jokerman atlas-packed fixture, and visually verified:
- Card wrapper around Global panel content — PASS
- Ruler SVG section glyph left of `Global Max Render Scale` heading — PASS
- Row state-color left bars + tinted ratio cells (green / warm-honey / transparent) — PASS
- `⚠` Unicode glyph replaced with stroke-based SVG warning triangle in unused-attachments header — PASS
- Sticky-bar SearchBar drives Global panel filtering, no panel-internal duplicate SearchBar — PASS
- Query persists across Global ↔ Animation Breakdown tab switches — PASS

**MB-savings callout (UI-04) — DORMANT pending design pivot.**

The `X.XX MB potential savings` copy was implemented per plan but did not visually fire on the test project (Jokerman). Two compounding reasons:

1. **Loader limitation:** the current loader at `src/core/loader.ts:257` builds `sourcePaths` by joining `path.dirname(skeletonPath) + '/images/' + regionName + '.png'`. All bundled fixtures (Jokerman, Girl, SIMPLE_PROJECT, EXPORT_PROJECT, SPINE_3_8_TEST) are atlas-packed — regions live inside the atlas page PNGs, not as individual per-region files in an `images/` sibling. The app does not currently support `.json + images/` projects (no atlas) — that is the planned scope of Phase 21 (SEED-001 atlas-less mode). With today's loader, every project triggers the D-15 `bytesOnDisk = 0 → count-only fallback`.

2. **Design pivot (user, 2026-05-01):** the unused-attachment MB-savings metric is the *wrong* metric. Animators intentionally exclude attachments from export — those bytes are not "savings." The valuable savings metric is **post-optimization atlas pixel-area savings** (analogous to the old 3.8 app's `Saving est. 77.7% pixels` shown inside OptimizeDialog), which belongs in OptimizeDialog (Wave 5+ territory), NOT in the Global panel unused-attachment callout.

**Disposition for Phase 19:** Code stays as-shipped — the `(u.bytesOnDisk ?? 0)` reader is correct plumbing and will start producing valid totals automatically when Phase 21's per-region loader lands. We do NOT remove the callout in Phase 19 because the unused-attachment count-only fallback (`N unused attachment(s)`) is unchanged from the prior shipped UX and remains useful as a count indicator.

**Follow-up captured for v1.3 / Phase 21+:**
- Decide whether to KEEP the unused-attachment count callout (informational) or REMOVE it entirely from the Global panel.
- Add a true post-optimization atlas-savings report to OptimizeDialog (% pixels saved + before/after byte totals), modeled on the old 3.8 app's `Saving est. X.X% pixels` chip visible in the user's reference screenshot.
- This requires Phase 21 (atlas-less loader, so bytesOnDisk has real values) AND a post-generation report path inside OptimizeDialog.

## Self-Check: PASSED

All four commits verified on main after worktree merge:
- 3d42e42 — feat(19-04): wrap Global panel in card + ruler section icon + remove internal SearchBar + tighten query props to REQUIRED
- 70b7017 — feat(19-04): add row state-color bar + tinted ratio cell (D-06)
- c00c5e1 — feat(19-04): replace ⚠ glyph + add MB-savings callout (UI-04 + D-13/D-14/D-15)
- ba6a3ed — docs(19-04): in-progress summary at Task 4 checkpoint

Plan 19-04 complete (visible UI changes verified; UI-04 MB-savings dormant pending Phase 21 + design pivot).
