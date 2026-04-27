---
name: Phase 2 — Global Max Render Source panel Context
description: Locked decisions for Phase 2 — sortable/searchable per-attachment table replacing Phase 1's DebugPanel, with a pure-core analyzer folding sampler peaks into preformatted DisplayRows.
phase: 2
---

# Phase 2: Global Max Render Source panel — Context

**Gathered:** 2026-04-23
**Status:** Ready for planning
**Source:** `/gsd-discuss-phase 2` interactive session

<domain>
## Phase Boundary

Phase 2 is the **first real panel**. It replaces Phase 1's CLI-style `<pre>` DebugPanel with a proper sortable, searchable, selectable per-attachment table matching screenshot 1 of the approved plan. The table consumes the `SkeletonSummary.peaks[]` payload that already crosses IPC today; Phase 2 adds the pure-core `analyzer.ts` folding step, the `GlobalMaxRenderPanel` view component, and the `SearchBar` filter. The panel sits in the existing `DropZone` slot — no app shell, no sidebar, no toolbar chrome.

**In scope:**
- `src/core/analyzer.ts` — pure-TS core module, takes raw `PeakRecord[]` from `sampler.ts`, emits enriched `DisplayRow[]` (preformatted labels + raw numbers for sort). Owns the sort + projection that `src/main/summary.ts` currently does inline.
- `src/main/summary.ts` — refactored to delegate fold + sort + format to `src/core/analyzer.ts`. `SkeletonSummary.peaks[]` type changes from `PeakRecordSerializable[]` → `DisplayRow[]`.
- `src/shared/types.ts` — add `DisplayRow` interface; remove `PeakRecordSerializable` (or retain internally in core if analyzer emits it as an intermediate — planner's call).
- `src/renderer/panels/GlobalMaxRenderPanel.tsx` — hand-rolled `<table>` per F3.1, click-to-sort headers, sort arrow indicators, per-row checkbox + select-all + shift-click range + "N selected" count, zero-results row.
- `src/renderer/components/SearchBar.tsx` — case-insensitive substring filter on attachment name (F3.2 strict), clear-button (`✕`), ESC-clears-and-blurs.
- `src/renderer/src/App.tsx` — render `<GlobalMaxRenderPanel>` in the `status: 'loaded'` branch instead of `<DebugPanel>`.
- `scripts/cli.ts` — adapted if the summary.ts delegation changes the fold call; output remains byte-for-byte identical.
- Remove `src/renderer/src/components/DebugPanel.tsx` per Phase 1 D-16 ("replaced by GlobalMaxRenderPanel").
- Tests: `tests/core/analyzer.spec.ts` (DisplayRow shape, sort stability, preformat correctness), renderer tests for SearchBar filter + sort header click + select-all + shift-click range — planner's call on Testing Library vs RTL-free DOM.

**Out of scope (deferred to later phases):**
- Scale overrides, override badges, override dialog (Phase 4 — F5).
- Unused-attachment detection surfacing and analyzer enrichment (Phase 5 — F6). Do NOT add a `neverRendered` field to `DisplayRow` now.
- Optimize Assets export wiring from the selection set (Phase 6 — F8).
- Atlas Preview modal (Phase 7 — F7).
- Save/load project state (Phase 8 — F9).
- UI virtualization / sampler worker / complex-rig polish (Phase 9 — N2.2).
- App shell chrome (top toolbar, sidebar, multi-panel nav). Phase 3 decides.
- Animation Breakdown panel linkage (Phase 3 — F4). Phase 2 renders Source Animation as plain text + chip styling; Phase 3 upgrades to an interactive button when AnimationBreakdownPanel exists as a jump target.
- State library migration (Zustand/Jotai). Phase 1 D-20 deferred "revisit in Phase 2"; Phase 2 revisits and explicitly **keeps plain useState**. Re-evaluate in Phase 4 if overrides introduce cross-panel state.
- Skin/animation/slot-path search fields. F3.2 locks attachment-name-only.
- Fuzzy search, debouncing. `<150-row .filter()` is sub-ms; retrofit if Phase 9 profiling proves otherwise.
- Column visibility toggles, column reordering, multi-column sort.
- Keyboard row navigation (arrow keys, space to toggle selection). Nice-to-have; deferred unless Phase 9 polish pulls it in.

</domain>

<decisions>
## Implementation Decisions

### Table, Sort & Selection

- **D-28: Hand-rolled HTML `<table>`.** Plain `<table>` + `<thead>` + `<tbody>`, useState-driven sort comparator, ~100 lines. Zero new runtime deps. Matches the project's low-dep-bloat discipline (Phase 0 hand-rolled the CLI table in `scripts/cli.ts`; Phase 1 hand-rolled the drag handlers). Accessibility via native table semantics (sort headers use `aria-sort`, checkboxes use `<input type="checkbox">`, select-all gets `aria-label`).
- **D-29: Default sort — Scale descending.** On first render the table sorts by `peakScale` DESC. Biggest-scale rows surface first — these are the assets that most need a different target dim, which is the whole reason this tool exists. Animators scan top-down and see actionable rows immediately.
- **D-30: Click-to-sort headers, single-column.** Clicking any column header toggles between `asc` → `desc` → (no third click needed — next column click resets). Active column shows a `▲` / `▼` indicator next to the label (Unicode U+25B2 / U+25BC, `text-fg-muted` when inactive, `text-accent` when active). No multi-column sort in Phase 2.
- **D-31: Selection — full wiring, no batch action.** Per-row `<input type="checkbox">` in a dedicated leftmost column, bound to a `Set<attachmentKey>` in local state. Header row has a tri-state select-all checkbox (checked / unchecked / indeterminate via `ref.indeterminate = true`) that toggles the currently-filtered row set (not the global set — if a search is active, select-all operates on visible rows only). Shift-click on a row checkbox range-selects from the last-clicked row to the current one. A muted "N selected / M total" caption sits above the table. **No batch action buttons in Phase 2** — Phase 4 adds batch override, Phase 6 adds batch export. The selection state itself is Phase 2's deliverable.
- **D-32: State management — plain React useState (D-20 reaffirmed).** Sort column + direction, search query, selection `Set`, and derived filtered rows all live in `GlobalMaxRenderPanel`'s local state via `useState` + `useMemo`. No Zustand, no Jotai, no Context. Phase 1 D-20's deferred "revisit in Phase 2" is formally resolved: stay with useState. Re-open when Phase 4 overrides or Phase 8 save/load introduce cross-panel or persisted state.

### Analyzer Module

- **D-33: `src/core/analyzer.ts` — pure-TS core module, consumes raw `PeakRecord[]`.** Lives in `src/core/` per ROADMAP Phase 2 deliverable and CLAUDE.md fact #5 (`core/` is pure TS, no DOM, headless-testable via vitest). Signature: `analyze(peaks: Map<string, PeakRecord> | PeakRecord[]): DisplayRow[]`. No dependency on `src/shared/types.ts` (core stays above shared). Used by both `src/main/summary.ts` (IPC path) and `scripts/cli.ts` (CLI path) — one fold, tested once.
- **D-34: Analyzer owns fold + sort + format.** The current `src/main/summary.ts` fold (`[...peaks.values()].map(...).sort(...)`) moves into `core/analyzer.ts`. Sort key stays `(skinName, slotName, attachmentName)` — the byte-for-byte CLI contract. Analyzer also computes preformatted label strings (D-35). `summary.ts` in main becomes a thin caller: builds the skeleton header (bones / slots / attachments / skins / animations / elapsedMs) and sets `summary.peaks = analyze(peaks)`.
- **D-35: `DisplayRow` emits preformatted labels + raw numbers.** One derivation, tested once, renderer does zero formatting. Shape:
  ```ts
  interface DisplayRow {
    // keys + raw numbers (used for sort + selection)
    attachmentKey: string;      // `${skin}/${slot}/${attachment}` — stable selection ID
    skinName: string;
    slotName: string;
    attachmentName: string;
    animationName: string;      // 'Setup Pose (Default)' or animation name
    frame: number;
    peakScale: number;          // max(peakScaleX, peakScaleY) — the sort key for D-29
    peakScaleX: number;
    peakScaleY: number;
    worldW: number;
    worldH: number;
    sourceW: number;
    sourceH: number;
    time: number;               // seconds since animation start
    isSetupPosePeak: boolean;   // still useful for rendering Source column; NOT for Phase 5 'never rendered'
    // preformatted labels (D-35) — renderer copies these into cells verbatim
    originalSizeLabel: string;  // e.g. '64×64'  (Unicode × U+00D7)
    peakSizeLabel: string;      // e.g. '114×114' (toFixed(0) for whole-pixel rendering)
    scaleLabel: string;         // e.g. '1.780×' — three-decimal scale + trailing × (D-37)
    sourceLabel: string;        // 'Setup Pose (Default)' or animation name
    frameLabel: string;         // String(frame) — trivial but consistent
  }
  ```
- **D-36: No forward-layer scaffolding.** No `neverRendered`, no `overrideScale`, no `exportTargetW/H` fields in `DisplayRow` for Phase 2. Phase 5 adds `neverRendered: boolean` when it actually knows the semantics ('never rendered' ≠ `isSetupPosePeak` — a setup-pose attachment may still be visible on the canvas at t=0). Phase 4 adds override state in a separate `OverrideMap` keyed by `attachmentKey`, not embedded in rows. YAGNI discipline.

### Search / Filter

- **D-37: Case-insensitive substring match on attachment name only.** `row.attachmentName.toLowerCase().includes(query.trim().toLowerCase())`. Empty/whitespace query = all rows. F3.2 reads "filters rows by attachment name" — strictly honored. Searching across skin/animation/slot-path is a Phase 9 polish concern if demand surfaces.
- **D-38: No debounce.** Filter on every keystroke via `useMemo` over `DisplayRow[]`. Simple rig has 4 rows; complex rig (~80–150 rows) is still a sub-millisecond `.filter()` on any machine. Retrofit debounce only if Phase 9 profiling shows main-thread jank on a real rig.
- **D-39: Clear-button (`✕`) inside the SearchBar input.** A small `<button>` floated right inside the input's padding, visible only when query is non-empty. Clicking it resets the query and refocuses the input. `✕` character is Unicode U+2715; styled `text-fg-muted hover:text-fg`.
- **D-40: Match highlight in attachment-name cells.** When a query is active, wrap the matching substring in `<mark>` with `bg-accent/20 text-accent rounded-sm px-0.5` styling. Turns the panel into a visual scanner. Do not highlight matches in other columns (only the attachment-name cell is searched). Plain `String.split` + React fragments; no `dangerouslySetInnerHTML`, no HTML parsing.
- **D-41: Zero-results row.** When the filter yields an empty set, render a single full-width row inside `<tbody>` with muted text `No attachments match "<query>"`. Styled `text-fg-muted font-mono text-sm text-center py-8`. Select-all + "N selected" caption still render (both show 0 when there's nothing visible).
- **D-42: ESC clears query + blurs SearchBar.** `onKeyDown={e => { if (e.key === 'Escape' && query !== '') { e.preventDefault(); setQuery(''); } else if (e.key === 'Escape') { e.currentTarget.blur(); } }}`. Two-tap: first ESC clears, second ESC blurs. Standard power-user pattern.

### Panel Chrome & Column UX

- **D-43: In-place DropZone slot replacement — no app shell.** App.tsx's `status: 'loaded'` branch renders `<GlobalMaxRenderPanel summary={...} />` where it currently renders `<DebugPanel>`. DropZone still wraps the full window and still owns the idle / loading / error states. No top toolbar, no sidebar, no multi-panel nav. Phase 3 decides whether to grow an app shell or stay single-view; decoupling that decision from Phase 2 keeps scope tight. `GlobalMaxRenderPanel` owns its own internal header block: filename chip (left) + SearchBar (center/right) + selection count ("N selected / M total") (right).
- **D-44: Source Animation cell — plain text + chip style, no interactivity.** Render `row.sourceLabel` inside a `<span>` with chip styling: `inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono`. No `<button>`, no `onClick`. Phase 3 upgrades this to a button that jumps to the Animation Breakdown panel once that panel exists as a jump target. Building the button surface now with a no-op handler would create a broken-feeling click; the chip communicates "this is data, not an action" today.
- **D-45: Scale label — `1.780×` (three-decimal multiplier + trailing ×).** Multiplier matches animator mental model ("this asset is 2× its source"). Trailing Unicode × (U+00D7) anchors the unit visually. Three decimals (`toFixed(3)`) matches `scripts/cli.ts` renderTable line ~65 output (`rec.peakScale.toFixed(3)`). Sub-1 values render as `0.734×` — still reads as "smaller than source," which an animator understands.
- **D-46: Size labels — `W×H` with Unicode × (U+00D7), whole-pixel rounding.** Source size: `${sourceW}×${sourceH}` (the atlas metadata is integer-pixel). Peak size: `${worldW.toFixed(0)}×${worldH.toFixed(0)}` — whole pixels, no decimals. This tightens the column and matches the CLI header label "Source W×H / Peak W×H" byte-for-byte. No "px" suffix (redundant given the column header).
- **D-47: All cells `font-mono`.** Whole table uses JetBrains Mono via Tailwind `font-mono` utility. Numeric columns align visually (critical for scanning scales); text columns stay tabular. No mixed-font rendering. Row density: `py-2 px-3` per cell, ~32px row height. Matches the screenshot 1 aesthetic.
- **D-48: Setup Pose rows render identically to animation rows.** No muted text, no background tint, no italic. The "Setup Pose (Default)" chip in the Source Animation column already differentiates them visually; adding a second differentiator (muted text) would hide potentially-actionable rows (a Setup Pose attachment at 2.0× scale is just as interesting as an animated one).

### Claude's Discretion (not locked)

- Exact sort arrow glyph pair (`▲` / `▼` vs `↑` / `↓`) — use `▲`/`▼` (U+25B2 / U+25BC) as the recommended default; planner may swap if accessibility or rendering fidelity prefers the other.
- Exact ARIA wiring for sort headers (`aria-sort="ascending"` / `"descending"` / `"none"`) — follow WAI-ARIA table sort pattern.
- Exact chip styling for the filename header element (border / bg / rounded radius) — follow D-12/D-13 tokens (`border-border bg-panel rounded-md`).
- Whether the SearchBar is a controlled input or uses `useRef` + uncontrolled pattern — planner's call; both work with D-38 no-debounce filtering.
- Whether shift-click range-select anchors on the most recently CHECKED row or most recently CLICKED row — planner's call; VS Code and Finder both use "most recently clicked."
- Whether selection survives a sort change or a filter change — recommended: survives both (selection is keyed by `attachmentKey`, not row index, so selected rows remain selected regardless of display order / visibility). Planner may spec more formally.
- Exact column widths — planner's call; text cells (`Attachment`, `Skin`, `Source Animation`) flex; numeric cells (`Source W×H`, `Peak W×H`, `Scale`, `Frame`) size-to-content.
- Checkbox column styling (plain browser checkbox vs custom SVG) — browser default is fine for Phase 2; custom styling is Phase 9 polish.
- Tests for the renderer: Testing Library vs happy-dom + plain DOM assertions — planner's call. Existing Phase 0/1 tests are all vitest + Node; introducing RTL + jsdom is a dep add that the planner should weigh.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source of truth
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Phase 3 — Global Max Render Source panel (screenshot 1)" — canonical description of the fold shape `{ attachment, sourceSize, peakSize, peakScale, sourceAnimation, sourceFrame, sourceSkin }` and the "sortable table with search filter" requirement. Note: approved-plan Phase 3 == roadmap Phase 2 (roadmap compressed Phase 0 spike + Phase 1 scaffold differently).
- `~/.claude/plans/i-need-to-create-zesty-eich.md` §"Critical technical patterns & references" — reiterates that `computeWorldVertices` already carries the full constraint/physics math; analyzer consumes these numbers, doesn't recompute.

### Project instructions
- `CLAUDE.md` — fact #5 ("`core/` is pure TypeScript, no DOM. Headless-testable in Node via vitest.") locks the analyzer's location (D-33). Fact #4 ("The math phase does not decode PNGs") still applies — Phase 2 adds no image I/O.

### Requirements
- `.planning/REQUIREMENTS.md` §F3 — the three locked requirements:
  - F3.1 Sortable table: Asset, Original Size, Max Render Size, Scale, Source Animation/SetupPose, Frame.
  - F3.2 Search field filters rows by attachment name.
  - F3.3 Per-row checkbox for batch operations.
- `.planning/REQUIREMENTS.md` §F2 — unchanged from Phase 0; analyzer consumes `PeakRecord[]` which already reflects all F2 math.
- `.planning/ROADMAP.md` §"Phase 2 — Global Max Render Source panel" — deliverables (`analyzer.ts`, `GlobalMaxRenderPanel.tsx`, `SearchBar.tsx`) and exit criteria (SIMPLE_TEST.json produces a correct table; search correctly hides/shows rows).

### Phase 0/1 artifacts (Phase 2 consumers + refactor targets)
- `src/core/sampler.ts` — `sampleSkeleton(load, opts?): Map<string, PeakRecord>`. Analyzer's input source (via `[...peaks.values()]`). Do NOT modify Phase 0 math.
- `src/core/types.ts` — `PeakRecord` shape (source for `DisplayRow` projection). If `PeakRecord` grows a field, analyzer chooses whether to surface it in `DisplayRow`.
- `src/main/summary.ts` — **refactor target.** Fold + sort + format logic moves into `src/core/analyzer.ts` per D-34. Retain the skeleton-header projection (bones/slots/attachments byType/skins/animations); call `analyze(peaks)` for `summary.peaks`.
- `src/shared/types.ts` — add `DisplayRow` interface (D-35). Remove or deprecate `PeakRecordSerializable` (replaced by `DisplayRow` as the IPC-crossing row type). `SkeletonSummary.peaks[]` type changes accordingly.
- `src/renderer/src/App.tsx` — `status: 'loaded'` branch changes from `<DebugPanel summary={state.summary} />` to `<GlobalMaxRenderPanel summary={state.summary} />`.
- `src/renderer/src/components/DebugPanel.tsx` — **delete** per Phase 1 D-16 ("replaced by GlobalMaxRenderPanel").
- `scripts/cli.ts` — still prints the same byte-for-byte output, but its fold step now delegates to `core/analyzer.ts`'s preformatted `scaleLabel`/`originalSizeLabel`/`peakSizeLabel` so CLI + panel share the formatting contract. Manual smoke test: `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` output must remain unchanged (golden comparison in the plan's acceptance gate).
- `.planning/phases/00-core-math-spike/00-CONTEXT.md` §"CLI Contract (locked)" — the column set + "Setup Pose (Default)" label + Unicode × convention all carry forward into Phase 2's `DisplayRow` labels.
- `.planning/phases/01-electron-react-scaffold/01-CONTEXT.md` §"Implementation Decisions" — D-11 through D-27 all carry forward. Especially D-12/D-13/D-14 (color tokens), D-15 (`font-mono` = JetBrains Mono), D-20 (useState — now formally reaffirmed as D-32), D-23–D-27 (cross-platform discipline).

### External (for planner / researcher)
- [WAI-ARIA Table pattern](https://www.w3.org/WAI/ARIA/apg/patterns/table/) — `aria-sort` wiring on sortable headers, checkbox labels.
- [MDN `<mark>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/mark) — semantic match-highlight for D-40.
- [React `useMemo` docs](https://react.dev/reference/react/useMemo) — memoizing `filteredRows` and `sortedRows` derivations so re-renders stay O(n) per keystroke.
- [Tailwind `@theme` tokens reference](https://tailwindcss.com/docs/theme) — for any additional chip / mark tokens the planner introduces.

### Fixture (Phase 2 drop + verify target)
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — primary drop-test target. Expected `DisplayRow[]` count: 4 (CIRCLE, SQUARE, SQUARE2, TRIANGLE — one per `(skin, slot, attachment)` across the default skin).
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` — sibling atlas auto-loaded by `loader.ts`.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`src/core/sampler.ts` + `src/core/types.ts`** — `PeakRecord` shape is stable; analyzer consumes it directly. No changes to Phase 0 math.
- **`src/main/summary.ts`** — the current fold + sort + bucket logic is the seed for `analyzer.ts`. ~40 lines of projection + sort; move to core, call from main.
- **`scripts/cli.ts` renderTable** (lines 77–126) — the column-width computation and two-space separator pattern are reusable as inspiration for the hand-rolled `<table>` cell rendering, though the React table uses CSS column sizing rather than monospace padding.
- **Tailwind `@theme` tokens** (D-12 through D-15): `bg-panel`, `border-border`, `text-fg`, `text-fg-muted`, `text-accent`, `bg-accent/5`, `bg-accent/20`, `font-mono`, `font-sans` all already defined. Phase 2 adds no new tokens.
- **`src/renderer/src/components/DropZone.tsx`** — unchanged; still owns the full-window drag target + empty/loading/error states.
- **`src/renderer/src/App.tsx`** — the `AppState` discriminated union stays as-is. Only the `status: 'loaded'` render branch swaps `DebugPanel` for `GlobalMaxRenderPanel`.

### Established Patterns (from Phase 0/1)
- **Hand-rolled over deps** — Phase 0 hand-rolled the CLI table (`scripts/cli.ts`); Phase 1 hand-rolled drag handlers (no `react-dropzone`); Phase 2 hand-rolls the HTML `<table>` + sort + selection (no TanStack Table, no datagrid library). Consistent.
- **Preformatted labels vs raw numbers** — Phase 1's `PeakRecordSerializable` already separates `peakScale` (number for sort) from `toFixed(3)` rendering in `DebugPanel.renderTable`. `DisplayRow` formalizes this split: raw numbers + preformatted labels, one derivation, tested once in core.
- **Atomic commits per logical unit** — Phase 1 used `feat(01-ui):`, `chore(01-ui):` scopes. Phase 2 should mirror with `feat(02-panel):`, `refactor(02-panel):`.
- **Grep-literal-in-comments compliance** — Phase 1 repeatedly hit the "comment cites a forbidden-literal token → grep acceptance gate fails" footgun (Devs #3/#4 across 01-01, 01-02, 01-03, 01-04). Phase 2 planner should pre-emptively use prose over literals in comments when any plan acceptance gate is `! grep -q "literal"`.
- **Three-layer `core/` ↛ `renderer/` defense** (Layer 1 tsconfig exclude + Layer 2 bundler alias + Layer 3 `tests/arch.spec.ts`) — still active. `GlobalMaxRenderPanel` + `SearchBar` MUST NOT import from `src/core/*` directly; they consume `DisplayRow[]` via `window.api` IPC only. Layer 3 auto-scans new files.
- **`npm run typecheck` + `npm run test` green gate** — Phase 0's 47+1 + Phase 1's 57+1 gate stays. Phase 2 adds analyzer specs + SearchBar/panel specs; all must stay green before plan acceptance.

### Integration Points
- **IPC boundary** — `SkeletonSummary.peaks[]` type changes from `PeakRecordSerializable[]` → `DisplayRow[]`. `src/shared/types.ts` is the single source of truth. Both main (writer) and renderer (reader) consume it. `DisplayRow` is structuredClone-safe (primitives + strings; no classes, no Map, no Float32Array).
- **`src/core/analyzer.ts`** — new file, pure TS, no DOM, tested via `tests/core/analyzer.spec.ts`.
- **`src/renderer/panels/GlobalMaxRenderPanel.tsx`** — new directory `src/renderer/panels/`. Existing `src/renderer/src/components/` stays for cross-panel reusable UI primitives (SearchBar is a component, GlobalMaxRenderPanel is a panel composition).
- **`src/renderer/src/components/SearchBar.tsx`** — new reusable input; Phase 3's future panels can consume it. Keep props minimal: `value: string`, `onChange: (v: string) => void`, `placeholder?: string`.

### Constraints from Phase 0/1
- `core/` stays DOM-free. Analyzer imports from `src/core/types.ts` only — no `window`, no `document`, no `fetch`.
- N2.3 "Sampler hot loop does zero filesystem I/O" — unchanged. Analyzer doesn't touch `fs`; tests enforce via arch.spec.ts (Layer 3 already scans new files).
- D-23: no `process.platform` branches, no macOS-only APIs in Phase 2 code.
- D-25/D-26: no `/` literals in path contexts (N/A for Phase 2 — it handles no paths directly; paths come through `DisplayRow.attachmentKey` opaquely).
- Phase 1 locked `core/loader.ts` + `core/sampler.ts` as stable; Phase 2 MUST NOT modify them. If analyzer surfaces a need that would touch sampler output, the planner escalates and Phase 0 gets a scoped patch — do NOT silently extend.

</code_context>

<specifics>
## Specific Ideas

### `DisplayRow` interface (seeded for planner)

```ts
// src/shared/types.ts
export interface DisplayRow {
  // keys + raw numbers (sort + selection)
  attachmentKey: string;      // `${skin}/${slot}/${attachment}` — stable selection ID
  skinName: string;
  slotName: string;
  attachmentName: string;
  animationName: string;      // 'Setup Pose (Default)' or animation name
  frame: number;
  peakScale: number;
  peakScaleX: number;
  peakScaleY: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  time: number;
  isSetupPosePeak: boolean;
  // preformatted labels
  originalSizeLabel: string;  // '64×64'       (Unicode × U+00D7)
  peakSizeLabel: string;      // '114×114'
  scaleLabel: string;         // '1.780×'
  sourceLabel: string;        // 'Setup Pose (Default)' or animation name
  frameLabel: string;         // String(frame)
}
```

### Analyzer signature (seeded for planner)

```ts
// src/core/analyzer.ts
import type { PeakRecord } from './sampler.js';
import type { DisplayRow } from '../shared/types.js'; // or re-export from core

export function analyze(peaks: Map<string, PeakRecord>): DisplayRow[] {
  return [...peaks.values()]
    .map(toDisplayRow)
    .sort(byCliContract);
}

function toDisplayRow(p: PeakRecord): DisplayRow { /* preformat labels + copy raw numbers */ }
function byCliContract(a: DisplayRow, b: DisplayRow): number { /* (skin, slot, attachment) */ }
```

### `GlobalMaxRenderPanel` skeleton (seeded for planner)

```tsx
// src/renderer/panels/GlobalMaxRenderPanel.tsx
export function GlobalMaxRenderPanel({ summary }: { summary: SkeletonSummary }) {
  const [query, setQuery] = useState('');
  const [sortCol, setSortCol] = useState<SortCol>('peakScale');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClicked, setLastClicked] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterByName(summary.peaks, query),
    [summary.peaks, query],
  );
  const sorted = useMemo(
    () => sortBy(filtered, sortCol, sortDir),
    [filtered, sortCol, sortDir],
  );

  return (
    <div className="w-full max-w-6xl mx-auto p-8">
      <header className="flex items-center gap-4 mb-4">
        <FileChip path={summary.skeletonPath} />
        <SearchBar value={query} onChange={setQuery} />
        <SelectionCount selected={selected.size} total={sorted.length} />
      </header>
      <table className="w-full font-mono text-sm">
        <thead>
          <tr>
            <th><SelectAllCheckbox sorted={sorted} selected={selected} setSelected={setSelected} /></th>
            <SortHeader col="attachmentName" label="Attachment" {...sortProps} />
            <SortHeader col="skinName" label="Skin" {...sortProps} />
            <SortHeader col="sourceW" label="Source W×H" {...sortProps} />
            <SortHeader col="worldW" label="Peak W×H" {...sortProps} />
            <SortHeader col="peakScale" label="Scale" {...sortProps} />
            <SortHeader col="animationName" label="Source Animation" {...sortProps} />
            <SortHeader col="frame" label="Frame" {...sortProps} />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && query !== '' && <EmptyRow query={query} />}
          {sorted.map(row => (
            <Row
              key={row.attachmentKey}
              row={row}
              query={query}
              checked={selected.has(row.attachmentKey)}
              onToggle={(e) => toggleWithShift(e, row.attachmentKey, sorted, selected, setSelected, lastClicked, setLastClicked)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### SearchBar UX pattern

```tsx
// src/renderer/src/components/SearchBar.tsx
<div className="relative flex-1 max-w-md">
  <input
    type="search"
    value={value}
    placeholder="Filter by attachment name…"
    className="w-full bg-panel border border-border rounded-md px-3 py-1.5 text-sm font-mono
               focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
    onChange={(e) => onChange(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === 'Escape') {
        if (value !== '') { e.preventDefault(); onChange(''); }
        else { e.currentTarget.blur(); }
      }
    }}
  />
  {value !== '' && (
    <button
      aria-label="Clear search"
      onClick={() => onChange('')}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg"
    >
      ✕
    </button>
  )}
</div>
```

### Match-highlight rendering (D-40)

```tsx
function highlightMatch(name: string, query: string) {
  if (query === '') return name;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return name;
  const before = name.slice(0, idx);
  const match  = name.slice(idx, idx + query.length);
  const after  = name.slice(idx + query.length);
  return (<>{before}<mark className="bg-accent/20 text-accent rounded-sm px-0.5">{match}</mark>{after}</>);
}
```

### Expected SIMPLE_TEST.json output (fixture for plan acceptance)

With default sort (Scale DESC), empty search, no selections:

```
☐  Attachment          Skin      Source W×H   Peak W×H    Scale    Source Animation           Frame
☐  SQUARE2             default   96×96        192×192     2.000×   Setup Pose (Default)       —
☐  CIRCLE              default   64×64        114×114     1.780×   [animation-touching CIRCLE]  12
☐  TRIANGLE            default   80×80        88×88       1.100×   [animation-touching TRIANGLE]  4
☐  SQUARE              default   96×96        96×96       1.000×   Setup Pose (Default)       —
```

(Animation names + frame numbers depend on fixture contents; planner validates byte-for-byte against current CLI output via `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` before and after the analyzer refactor.)

### Reference screenshots

Screenshot 1 in `~/.claude/plans/i-need-to-create-zesty-eich.md` is the canonical visual reference. Warm-stone dark background, subtle borders, monospace numbers, orange accent on the search focus ring and sort indicator. All Phase 1 tokens already in place.

</specifics>

<deferred>
## Deferred Ideas

- **App shell chrome (top toolbar + sidebar nav).** Phase 3 reopens — if AnimationBreakdownPanel + Phase 2's panel need navigation, Phase 3 introduces the shell.
- **Source Animation as an interactive button.** Phase 3 (Animation Breakdown) turns the chip into a button that scrolls to / highlights the target animation card. D-44 reserves the visual surface for this upgrade.
- **Unused-attachment surfacing.** Phase 5 (F6). `DisplayRow` gets a `neverRendered: boolean` field then; Phase 5 distinguishes it from `isSetupPosePeak`.
- **Batch override dialog, double-click scale to override.** Phase 4 (F5). Consumes the Phase 2 `selected: Set<attachmentKey>` state.
- **Batch export from selection.** Phase 6 (F8). Consumes the Phase 2 selection state + Phase 4 overrides.
- **State library migration (Zustand / Jotai / Redux).** Phase 1 D-20 deferred; Phase 2 D-32 reaffirms useState. Re-open in Phase 4 if overrides introduce cross-panel persistent state, or Phase 8 if save/load JSON needs a canonical store shape.
- **Fuzzy search / multi-field filter / regex.** F3.2 is strict on "attachment name"; expand only if a real user asks.
- **Debounced search.** D-38 — retrofit only if Phase 9 profiling shows jank on a complex rig.
- **Multi-column sort.** Phase 9 polish at most; D-30 locks single-column.
- **Column visibility toggles, column reordering, column resize.** Phase 9 polish; not requested in F3.
- **Keyboard row navigation (arrow keys, space toggles selection).** Phase 9 polish unless explicitly raised.
- **UI virtualization for large row counts.** Phase 9 (N2.2) concern. D-28's hand-rolled table will need a drop-in windowing layer (`@tanstack/react-virtual` or hand-rolled) when a complex rig (~150+ rows) is profiled.
- **Custom-styled checkboxes.** Phase 9 polish; browser default is fine for Phase 2.
- **Highlighted matches in non-attachment columns.** Only attachment name is searched (D-37); no other columns need highlight.
- **Empty-state illustrations.** Zero-results state is a text-only row per D-41. A Spine icon or illustration could come in Phase 9 polish.
- **Settings modal for sampling rate / search defaults.** Phase 9 per ROADMAP.

</deferred>

---

*Phase: 02-global-max-render-source-panel*
*Context gathered: 2026-04-23 via `/gsd-discuss-phase 2`*
