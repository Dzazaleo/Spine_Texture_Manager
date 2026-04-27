---
phase: 09-complex-rig-hardening-polish
plan: 03
subsystem: renderer-virtualization
tags: [phase-9, wave-2, virtualization, tanstack-virtual, panel-globalmax]
requirements: [N2.2]
dependency_graph:
  requires:
    - "Plan 01 Wave 0 (commit 6c5ae4a) — @tanstack/react-virtual@3.13.24 dependency + 4 RED scaffolds in tests/renderer/global-max-virtualization.spec.tsx"
    - "Plan 02 Wave 1 (commit b426d64) — sampler-worker landed; N2.2 wall-time gate GREEN"
  provides:
    - "Threshold-gated TanStack Virtual integration in GlobalMaxRenderPanel.tsx (D-191/D-195 — N=100)"
    - "4 of 18 VALIDATION.md behaviors flipped Wave 0 RED → GREEN (rows 8-11)"
    - "jsdom polyfill recipe for useVirtualizer (offsetWidth/offsetHeight + ResizeObserver) — reusable by Plan 04"
  affects:
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (single-file refactor)"
    - "tests/renderer/global-max-virtualization.spec.tsx (Wave 0 RED → Wave 2 GREEN)"
tech_stack:
  added: []  # @tanstack/react-virtual@3.13.24 already added in Plan 01
  patterns:
    - "Threshold-gated render swap: useVirtual = sorted.length > 100 → flat-table or virtualized"
    - "Stable-identity getItemKey via useCallback over sorted[].attachmentKey (RESEARCH §Pitfall 2)"
    - "Sticky <thead> via Tailwind `sticky top-0 z-10` (Pitfall 1: NEVER on <tr>)"
    - "overflow-anchor:none inline style (no Tailwind utility) on outer scroll container"
    - "transform translateY(virtualRow.start - idx * virtualRow.size) — table-row basis fix"
    - "jsdom polyfill: HTMLElement.prototype offsetWidth/offsetHeight + ResizeObserver no-op"
key_files:
  modified:
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (+294 / -92 lines)"
    - "tests/renderer/global-max-virtualization.spec.tsx (+194 / -23 lines, 4 RED → 4 GREEN)"
key_decisions:
  - "Threshold N=100 LOCKED at the constant `VIRTUALIZATION_THRESHOLD` at module top (D-195)"
  - "Both render paths share an identical SortHeader column set + SelectAllCheckbox (reduces drift; Cmd-F still works in flat path)"
  - "Row component now accepts an optional `style?: CSSProperties` prop forwarded to <tr>; flat path leaves it undefined (zero behavioral change), virtualized path sets transform translateY"
  - "scrollToIndex(0) on sortCol/sortDir/query change in virtualized path (D-191 scroll restoration)"
  - "scrollToIndex(focusedIdx, align:'center') in virtualized path for the Phase 7 D-130 cross-panel jump"
  - "jsdom virtualizer test polyfill stubs HTMLElement.prototype.offsetWidth/offsetHeight (NOT just getBoundingClientRect — virtual-core's getRect uses offsetWidth/offsetHeight specifically)"
metrics:
  duration: ~12 min
  completed_date: 2026-04-26
  tasks: 2
  files_changed: 2
  red_tests_flipped_green: 4
---

# Phase 09 Plan 03: GlobalMaxRender Virtualization Summary

Threshold-gated TanStack Virtual row virtualization for `GlobalMaxRenderPanel` per D-191 / D-192 / D-195. Below N=100 rows: existing flat-table JSX renders unchanged (preserves Cmd-F text search and zero virtualization overhead). Above N=100: `useVirtualizer` from `@tanstack/react-virtual` takes over with stable `getItemKey` (attachmentKey), 20-row overscan, sticky `<thead>`, and `overflow-anchor: none` on the scroll container.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Refactor GlobalMaxRenderPanel.tsx to threshold-gated TanStack Virtual | `0f4c731` | src/renderer/src/panels/GlobalMaxRenderPanel.tsx |
| 2 | Author tests/renderer/global-max-virtualization.spec.tsx behaviors (Wave 0 RED → GREEN) | `200b94c` | tests/renderer/global-max-virtualization.spec.tsx |

## What Shipped

### Threshold-gated virtualization (Task 1)

Module-top constant `VIRTUALIZATION_THRESHOLD = 100` and a single derivation:

```ts
const useVirtual = sorted.length > VIRTUALIZATION_THRESHOLD;
```

The component body now derives the boolean once and the JSX returns either the existing flat-table render path (unchanged) or the new virtualized path. Both paths render identical column headers (8 cells: SelectAllCheckbox + 7 SortHeader) so sort + search + per-row checkbox semantics carry over verbatim.

The virtualized path follows the official TanStack Virtual table example with the 5 non-negotiables from RESEARCH §Pitfalls 1-2 + §Recommendations #9-12:

1. **Sticky `<thead>`** via Tailwind `sticky top-0 z-10` — applied to `<thead>`, NEVER to `<tr>` inside `<tbody>` (Pitfall 1: transforms break sticky stacking context).
2. **`overflow-anchor: none`** inline style on the outer scroll container (no Tailwind utility — RESEARCH §Recommendations #11 prevents browser re-anchoring on sort/filter content-height changes).
3. **`getItemKey: useCallback((i) => sorted[i].attachmentKey, [sorted])`** — stable identity. Index-based default keys cause measurement-cache flicker on sort/filter (Pitfall 2).
4. **Row translate** `transform: translateY(${virtualRow.start - idx * virtualRow.size}px)` — the `idx * size` subtraction is REQUIRED for `<tr>` rendering per the official table example (table-row translate basis is the row's INITIAL position, not absolute scroll offset).
5. **Inner total-height spacer** `<div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>` so the scrollbar reflects the full virtual row count.

Two `useEffect`s preserve cross-panel UX in the virtualized path:

- On `sortCol`/`sortDir`/`query` change: `virtualizer.scrollToIndex(0)` snaps the user to the top so search-driven row-finding works (D-191 scroll restoration).
- On `focusAttachmentName` change: `virtualizer.scrollToIndex(idx, { align: 'center' })` for the Phase 7 D-130 Atlas-Preview-dblclick → row-flash jump. The existing `registerRowRef` + `isFlashing` machinery continues to handle the visual flash once the row is mounted.

The Row sub-component gained an optional `style?: CSSProperties` prop, forwarded to the `<tr>` element. The flat-table path leaves it undefined (zero behavioral change); the virtualized path sets the translateY transform.

### Test scaffolds flipped GREEN (Task 2)

The Wave 0 RED scaffold (Plan 01 commit `2e4fb71`) had 4 `expect(true).toBe(false)` placeholders. Task 2 replaced them with real assertions matching VALIDATION.md rows 8-11:

| Row | Behavior | Assertion |
|----:|----------|-----------|
| 8 | Below threshold (50 rows) | `screen.getAllByRole('row').length === 51` (header + 50 data rows) |
| 9 | Above threshold (200 rows) | `≤60` AND `<60` (≥70% reduction) AND `>1` (window emitted) |
| 10 | Sort/search/checkbox preserved | Click sort header + type into search + toggle per-row checkbox — all without throwing |
| 11 | Sticky thead | `<thead>.className` contains `sticky` and `top-0` (Tailwind utilities; visual sticky verified manually per VALIDATION.md) |

### jsdom polyfill recipe for useVirtualizer (reusable for Plan 04)

`@tanstack/virtual-core`'s `observeElementRect` reads `element.offsetWidth` and `element.offsetHeight` (NOT `getBoundingClientRect`) — see `node_modules/@tanstack/virtual-core/dist/esm/index.js:2-5` (`const getRect = (element) => { offsetWidth, offsetHeight }`). jsdom defaults both to 0, which makes the virtualizer emit zero virtual items. The polyfill stubs all of:

```ts
HTMLElement.prototype.offsetWidth   // → 600
HTMLElement.prototype.offsetHeight  // → 800
HTMLElement.prototype.clientWidth   // → 600
HTMLElement.prototype.clientHeight  // → 800
globalThis.ResizeObserver           // → no-op stub
```

Plan 04 (`anim-breakdown-virtualization.spec.tsx`) can copy this beforeAll block verbatim.

## Verification Results

| Gate | Expected | Actual | Status |
|------|----------|--------|--------|
| `npx tsc --noEmit -p tsconfig.web.json` | exits 0 | exits 0 | ✅ |
| `grep -n useVirtualizer src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | match | match @ line 63 | ✅ |
| `grep -n overflowAnchor src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | match | match @ line 771 | ✅ |
| `grep -n getItemKey src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | match | match @ lines 613, 628 | ✅ |
| `vitest run tests/renderer/global-max-virtualization.spec.tsx` | 4 GREEN | 4 GREEN | ✅ |
| Below-threshold row 8 assertion | 51 rows | 51 rows | ✅ |
| Above-threshold row 9 assertion | ≤60 rows | ≤60 rows AND ≥70% reduction | ✅ |
| Sort/search/checkbox row 10 | no throw | no throw + 1 selected | ✅ |
| Sticky thead row 11 | className `sticky top-0` | match | ✅ |
| `npm run test` regression check | no Plan-03-caused regressions | 311 pass / 11 fail (all 11 are Wave 0 RED scaffolds for Plans 04-07, NOT regressions) | ✅ |
| Plan-02 baseline tests still GREEN | 307+ pass | 311 pass (+4 from this plan) | ✅ |

## DOM Count Delta

- **Pre-Plan-03 (200-row hypothetical):** `<table>` would render 200+ `<tr>` (header + 200 data rows). Naive React renders all 200 — measurable scroll/sort hitches above ~150 rows.
- **Post-Plan-03 (200-row test):** `<table>` renders ≤60 `<tr>` (header + window of ~30-40 + 20 overscan). Confirmed via `screen.getAllByRole('row').length` assertion.
- **Threshold (D-195 LOCKED at N=100):** SIMPLE_PROJECT (~3 attachments × 1 skin), Jokerman (small rig) stay below; Girl (~80 attachments × multiple skins → 200-300 rows when expanded by skin filter) crosses.

## Test Count Delta

- Wave 0 (Plan 01): scaffolded 4 RED tests in `global-max-virtualization.spec.tsx`.
- Wave 2 (Plan 03, this summary): same 4 tests now GREEN.
- Net suite delta: +4 GREEN (307 → 311 passing) with no regressions.

## Manual UAT Checklist (for Plan 08 close-out)

The following CANNOT be verified in jsdom (no real layout / paint pipeline) and must be exercised in `npm run dev` against the live Electron app:

- [ ] Load `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` via Cmd+O — panel renders >100 rows.
- [ ] Scroll the panel — rows recycle smoothly (no DevTools-Performance dropped frames).
- [ ] Click a column header — virtualizer snaps to top; rows re-sort and the visible window updates.
- [ ] Type into the search field — list narrows; the visible window reflects the filtered subset.
- [ ] Override Scale via dblclick on the Scale cell — OverrideDialog mounts with the correct row context (cross-validates Row's onDoubleClick wiring through the virtualized path).
- [ ] Atlas Preview dblclick → Global Max table jumps to the matching row (Phase 7 D-130 cross-panel jump in the virtualized path).
- [ ] Sticky `<thead>` stays at the top of the scroll container during vertical scroll (visual contract; jsdom does not implement position:sticky layout).
- [ ] Resize the window — virtualizer's ResizeObserver re-measures; visible window updates without flicker.

## Deviations from Plan

### No Rule 1/2/3 deviations

Both tasks executed exactly as written in the plan. The PATTERNS.md after-shape was verbatim usable; the only minor adaptation was extracting the table header as duplicated JSX in both render paths (vs the plan's hint of a `tableHeader` const) — this kept the diff minimal and avoided accidentally re-rendering the SelectAllCheckbox / SortHeader closures.

### One process discovery (logged for Plan 04)

**`offsetWidth`/`offsetHeight` polyfill, NOT just `getBoundingClientRect`:** the plan's RESEARCH §Q9 referenced "scrollTop polyfill". The actual virtualizer integration revealed that `@tanstack/virtual-core`'s `getRect` helper reads `offsetWidth`/`offsetHeight` directly — a `getBoundingClientRect` polyfill alone is insufficient. The fix shipped here (stub `HTMLElement.prototype.offsetWidth/offsetHeight` to 600/800) is the canonical recipe for any vitest+jsdom test that mounts a useVirtualizer. Plan 04 (anim-breakdown-virtualization) can copy the beforeAll block verbatim.

## Authentication Gates

None encountered. Pure renderer-only refactor; no IPC, no external services.

## Self-Check: PASSED

- ✅ FOUND: src/renderer/src/panels/GlobalMaxRenderPanel.tsx (modified)
- ✅ FOUND: tests/renderer/global-max-virtualization.spec.tsx (modified, 4 RED → 4 GREEN)
- ✅ FOUND: commit 0f4c731 (Task 1 — feat: TanStack Virtual integration)
- ✅ FOUND: commit 200b94c (Task 2 — test: flip Wave 0 RED → GREEN)
- ✅ src/renderer/src/panels/GlobalMaxRenderPanel.tsx imports `useVirtualizer` from `@tanstack/react-virtual`
- ✅ src/renderer/src/panels/GlobalMaxRenderPanel.tsx contains `getItemKey` useCallback wrapping `sorted[i].attachmentKey`
- ✅ src/renderer/src/panels/GlobalMaxRenderPanel.tsx applies `sticky top-0 z-10` to `<thead>` (NOT `<tr>`)
- ✅ src/renderer/src/panels/GlobalMaxRenderPanel.tsx applies `overflowAnchor: 'none'` to the outer scroll container
- ✅ src/renderer/src/panels/GlobalMaxRenderPanel.tsx virtualized rows receive `transform: translateY(${virtualRow.start - idx * virtualRow.size}px)`
- ✅ `npx tsc --noEmit -p tsconfig.web.json` exits 0
- ✅ `vitest run tests/renderer/global-max-virtualization.spec.tsx` reports 4/4 GREEN
- ✅ `npm run test` shows no Plan-03-caused regressions (311 pass; 11 fail are all Wave 0 RED scaffolds for Plans 04/05/06/07)
