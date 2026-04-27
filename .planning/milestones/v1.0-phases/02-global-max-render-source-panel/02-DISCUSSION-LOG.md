# Phase 2: Global Max Render Source panel — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 02-global-max-render-source-panel
**Areas discussed:** Table/sort/selection, Analyzer module shape, Search/filter behavior, Panel chrome & column UX

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Table, sort & selection | Hand-rolled vs library; default sort; F3.3 checkbox scope; revisit D-20 useState. | ✓ |
| Analyzer module shape | Location, input type, output shape, relationship to `src/main/summary.ts`. | ✓ |
| Search / filter behavior | Match semantics, fields, debounce, highlight, clear, empty state, ESC. | ✓ |
| Panel chrome & column UX | App shell vs in-place; Source Animation cell; scale/size formatting; typography. | ✓ |

**User's choice:** All four selected (multiSelect).
**Notes:** No additional gray areas requested after the initial set.

---

## Area 1 — Table, sort & selection

### Table implementation

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-rolled `<table>` | Plain HTML + useState sort comparator. ~100 lines, zero new deps. | ✓ |
| TanStack Table | Headless; earns its keep only at Phase 9 (virtualization + multi-sort). | |
| DataGrid library (AG Grid / MUI) | Full-featured but heavy + fights Tailwind. | |

**User's choice:** Hand-rolled (recommended).
**Notes:** Matches the project's hand-rolled pattern (`scripts/cli.ts`, Phase 1 drag handlers).

### Default sort

| Option | Description | Selected |
|--------|-------------|----------|
| Scale descending | Biggest-scale rows first — actionable. | ✓ |
| Attachment A→Z | Alphabetical, predictable, buries the interesting rows. | |
| Skin → slot → attachment (current) | Matches pre-sort already done in summary.ts + CLI. | |

**User's choice:** Scale descending (recommended).

### F3.3 checkbox scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full UI wiring, no batch op | Checkboxes + select-all (tri-state) + shift-click range + "N selected" count. No batch action buttons. | ✓ |
| Checkbox column only | Minimal — `Set<attachmentKey>` in state, no select-all, no shift-click. | |
| Defer checkboxes to Phase 4 | Ship without selection UI. Violates F3.3. | |

**User's choice:** Full UI wiring (recommended).
**Notes:** Phase 4 adds batch override, Phase 6 adds batch export — both consume this selection state.

### State management (revisits D-20)

| Option | Description | Selected |
|--------|-------------|----------|
| Plain useState | Keep D-20 discipline. Sort/filter/selection local to panel. | ✓ |
| Zustand | Tiny global store; justifiable for Phase 4 cross-panel state. | |
| Jotai | Atomic; nice for derived filter state. | |

**User's choice:** Plain useState (recommended). D-20 formally reaffirmed as D-32.

---

## Area 2 — Analyzer module shape

### Location + input

| Option | Description | Selected |
|--------|-------------|----------|
| `src/core/` + raw `PeakRecord[]` | Pure-TS in core, consumed by CLI + main. | ✓ |
| `src/core/` + `PeakRecordSerializable[]` | Core-pure but dependent on shared/types.ts. | |
| `src/main/` only | Main-process code; CLI would duplicate logic. | |

**User's choice:** core/ + raw PeakRecord[] (recommended).
**Notes:** Matches ROADMAP's explicit `src/core/analyzer.ts` naming and CLAUDE.md fact #5.

### Output shape

| Option | Description | Selected |
|--------|-------------|----------|
| Enriched `DisplayRow` | Preformatted labels (`originalSizeLabel`, `peakSizeLabel`, `scaleLabel`, `sourceLabel`) + raw numbers. | ✓ |
| Pass-through rows | Identical to PeakRecordSerializable renamed. | |
| Raw numbers + formatter helpers | Scatters formatting. | |

**User's choice:** Enriched DisplayRow (recommended).
**Notes:** One derivation, tested once; renderer does zero formatting.

### Forward-layer for future phases

| Option | Description | Selected |
|--------|-------------|----------|
| Nothing beyond F3 | No stubs. Phase 4/5/6 add their own fields when they land. | ✓ |
| `neverRendered: false` stub | Reserve the field for Phase 5. | |
| Full seeding for Phases 4–6 | Premature; strong YAGNI. | |

**User's choice:** Nothing beyond F3 (recommended).

### Relationship to `src/main/summary.ts`

| Option | Description | Selected |
|--------|-------------|----------|
| `summary.ts` delegates to analyzer | Move fold+sort+format into core. `SkeletonSummary.peaks[]` type → `DisplayRow[]`. DebugPanel removed. | ✓ |
| Keep both, analyzer runs in renderer | summary.ts stays, renderer projects. Extra per-render cost. | |
| summary.ts stays, analyzer adds-only | Two folders of folding code. Drift risk. | |

**User's choice:** summary.ts delegates (recommended).
**Notes:** DebugPanel removed per Phase 1 D-16 ("replaced by GlobalMaxRenderPanel"). CLI output must remain byte-for-byte identical.

---

## Area 3 — Search / filter behavior

### Match semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive substring | `.toLowerCase().includes()`. What animators expect. | ✓ |
| Case-insensitive prefix | Misses mid-string matches. | |
| Fuzzy (fuse.js) | Adds dep; not asked for in F3.2. | |

**User's choice:** Case-insensitive substring (recommended).

### Fields searched

| Option | Description | Selected |
|--------|-------------|----------|
| Attachment name only | Strict F3.2. | ✓ |
| Attachment + skin + animation | Wider net. | |
| Attachment + slot path | Niche. | |

**User's choice:** Attachment only (recommended).

### Debounce

| Option | Description | Selected |
|--------|-------------|----------|
| No debounce, filter-on-keystroke | Sub-ms on ≤150 rows; retrofit at Phase 9 if needed. | ✓ |
| Debounce 150ms | Safer for future complex rigs. | |
| Debounce + rAF | Overkill. | |

**User's choice:** No debounce (recommended).

### UX bits (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Clear-button `✕` in SearchBar | Standard pattern. | ✓ |
| `<mark>` match highlight | `bg-accent/20 text-accent rounded-sm`. Visual scanner. | ✓ |
| Empty-state row | `No attachments match "<query>"`. | ✓ |
| ESC clears focus + query | Two-tap: first ESC clears, second ESC blurs. | ✓ |

**User's choice:** All four selected.

---

## Area 4 — Panel chrome & column UX

### App layout approach

| Option | Description | Selected |
|--------|-------------|----------|
| In-place replacement | DropZone still owns drag/empty/loading/error. `GlobalMaxRenderPanel` slots into the `loaded` branch. No shell. | ✓ |
| Introduce app shell | Top toolbar + sidebar nav now; plug future panels in. | |
| Panel inside DebugPanel container | Halfway option. Incoherent. | |

**User's choice:** In-place replacement (recommended).
**Notes:** Phase 3 decides whether to grow a shell.

### Source Animation cell rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text + chip styling | No onClick. Phase 3 upgrades to a button when AnimationBreakdownPanel exists as a jump target. | ✓ |
| Button with no-op onClick | Feels broken. | |
| Button + disabled chip | Honest about future but uglier. | |

**User's choice:** Plain text + chip (recommended).

### Scale + size formatting

| Option | Description | Selected |
|--------|-------------|----------|
| Scale `1.780×`, size `64×64` | Animator mental model (multiplier). Matches CLI `toFixed(3)`. Unicode × (U+00D7). | ✓ |
| Scale `178%`, size `64×64 px` | Percentage + px suffix. | |
| Scale `1.780` (bare), size `64×64` | Current CLI style. Unlabeled scale. | |

**User's choice:** `1.780×` + `64×64` (recommended).

### Typography + Setup Pose row treatment

| Option | Description | Selected |
|--------|-------------|----------|
| All cells `font-mono`, Setup Pose uniform | JetBrains Mono across all columns. Setup Pose rows differentiated only via Source column chip. | ✓ |
| Hybrid mono (numbers) + sans (names) | Mixed-font tables are a known eye-strain source. | |
| All mono + Setup Pose row muted | Hides potentially-actionable rows. | |

**User's choice:** All mono + Setup Pose uniform (recommended).

---

## Claude's Discretion

- Exact sort-arrow glyphs (`▲`/`▼` recommended; planner may swap for `↑`/`↓`).
- ARIA wiring for sort headers (follow WAI-ARIA table sort pattern).
- Filename chip styling details (follow D-12/D-13 tokens).
- Controlled vs uncontrolled SearchBar input.
- Shift-click range-select anchor: most-recently-clicked (VS Code / Finder convention).
- Selection survives sort + filter (keyed by `attachmentKey`).
- Column width strategy: text columns flex, numeric columns size-to-content.
- Default browser checkbox styling (custom SVG is Phase 9 polish).
- Testing approach: Testing Library vs happy-dom + plain DOM assertions (planner's call — existing tests are all vitest + Node).

## Deferred Ideas

- App shell chrome → Phase 3 reopens.
- Source Animation as interactive button → Phase 3.
- Unused-attachment surfacing (F6) → Phase 5.
- Batch override dialog + double-click scale (F5) → Phase 4.
- Batch export from selection (F8) → Phase 6.
- State library migration → Phase 4 or Phase 8 if cross-panel or persisted state emerges.
- Fuzzy search / multi-field / regex → reopen only on real user demand.
- Debounced search → Phase 9 if profiling demands.
- Multi-column sort, column visibility, column reorder/resize → Phase 9 polish.
- Keyboard row navigation (arrow keys, space) → Phase 9 polish.
- UI virtualization → Phase 9 (N2.2 complex-rig gate).
- Custom-styled checkboxes, empty-state illustrations → Phase 9 polish.
- Settings modal (sampling rate, search defaults) → Phase 9.
