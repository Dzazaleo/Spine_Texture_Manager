# Phase 25: Missing Attachments In-Context Display — Research

**Researched:** 2026-05-04
**Domain:** TypeScript type extension + main-process summary logic + React renderer panels
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: `isMissing?: boolean` added to `DisplayRow`.** Main process sets `isMissing: true` on stub rows when building `peaksArray` and `animationBreakdown` card rows in `summary.ts`. Both `GlobalMaxRenderPanel` and `AnimationBreakdownPanel` read it directly — no renderer-side name lookup or extra `Set` computation. IPC contract is explicit and type-safe.
- **D-02: Stub data renders as-is; ⚠ + red accent carry the signal.** All cells (peakScale, worldW×H, sourceW×H, Peak W×H) render their values normally. No special-case branches per cell. The `⚠` icon beside the attachment name and the red left-border accent communicate "this data is unreliable" without complicating the cell renderers.
- **D-03: Missing rows are fully interactive.** Checkbox and override button both work normally. Overrides on missing-attachment rows persist in the project file. No special-casing in row click handlers or override dialog invocation.
- **D-04: MissingAttachmentsPanel stays exactly where it is.** No position change. In-context red-accent rows are additive.

### Claude's Discretion

- **`'missing'` RowState variant**: Extend `type RowState = 'under' | 'over' | 'unused' | 'neutral'` with `| 'missing'`. The `rowState()` predicate should return `'missing'` before any other check when `isMissing === true`. The left-accent bar uses `bg-danger` (same color as `'unused'`). The ⚠ icon renders beside `attachmentName` in the name cell — use the existing `text-danger` token.
- **Icon choice**: Use a simple Unicode `⚠` character (`text-danger`) beside the attachment name, consistent with the danger-accent idiom already used in `MissingAttachmentsPanel`. No new SVG icon component needed.
- **`AnimationBreakdownPanel` row shape**: `BreakdownRow extends DisplayRow`, so `isMissing` flows through automatically once `DisplayRow` gains the field. The enrichment in `AnimationBreakdownPanel` passes through without changes to the enrichment logic.

### Deferred Ideas (OUT OF SCOPE)

- Phase 26 tab system (capturing tab-system redesign for Global / Unused / Animation tabs)
- `border-warning` token addition
- "Never rendered" greyed section for deliberately unchecked attachments
- Any changes to the export pipeline for missing-attachment rows
- Changes to MissingAttachmentsPanel behavior or content
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-03 | Rows whose attachment PNG was missing at load time remain visible in Global Max Render Source + Animation Breakdown panels, marked with a red left-border accent and a danger-triangle (⚠) icon beside the attachment name — not filtered out. | Verified filter removal sites at summary.ts:89 + summary.ts:114; verified `RowState` extension pattern; verified `DisplayRow` type surface at types.ts:54; verified JSX modification sites in both panels. |
</phase_requirements>

---

## Summary

Phase 25 is a targeted additive change across four files: one shared type, one main-process function, and two renderer panel components. The Phase 21 Plan 21-10 implementation introduced a filter at two sites in `summary.ts` that removed stub-region rows from `peaks` and `animationBreakdown.rows`, surfacing them exclusively through `MissingAttachmentsPanel`. Phase 25 reverses that decision at the summary layer by removing the two filters and instead marking each stub row with `isMissing: true` on the existing `DisplayRow` interface.

The renderer change is equally contained: both `GlobalMaxRenderPanel` and `AnimationBreakdownPanel` already share an identical `RowState` type + `rowState()` predicate pattern, a left-accent bar driven by that state, and a tinted ratio cell. Both panels need the `'missing'` variant added to these four elements. The visual treatment (red `bg-danger` left bar, `⚠` character in `text-danger` before the attachment name) is fully specified in the UI-SPEC.md and uses only pre-existing design tokens.

The change is backward-compatible: `isMissing?: boolean` is optional, undefined is falsy, and the IPC payload shape adds one optional boolean field that older summary payloads (canonically impossible in this app since main and renderer are bundled together) would simply omit.

**Primary recommendation:** Execute as a two-plan phase — Plan 25-01 covers the data layer (types.ts + summary.ts), Plan 25-02 covers the renderer layer (both panels). Tests are added in the plan where the behavior is introduced.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mark stub rows as missing | API / Backend (main process) | — | `summary.ts` owns the `DisplayRow` assembly; `skippedNames` Set is already built here |
| Propagate `isMissing` across IPC | Shared types (`src/shared/types.ts`) | — | `DisplayRow` is the IPC-crossing contract; adding the optional field here is the boundary |
| Visual danger signal in Global panel | Frontend (renderer) | — | `GlobalMaxRenderPanel.tsx` owns its `RowState` + JSX |
| Visual danger signal in Breakdown panel | Frontend (renderer) | — | `AnimationBreakdownPanel.tsx` owns its `RowState` + JSX |
| Missing attachment summary list | Frontend (renderer) | — | `MissingAttachmentsPanel.tsx` — UNCHANGED, not touched |

---

## Standard Stack

No new packages are introduced. This phase uses the project's existing stack exclusively.

| Library | Version | Purpose | Role in Phase 25 |
|---------|---------|---------|-----------------|
| TypeScript | existing | Type system | `DisplayRow` interface extension |
| React | existing | UI rendering | JSX modifications in both panels |
| clsx | existing | Conditional className composition | New `'missing'` branches in left-accent + ratio cell |
| Tailwind v4 | existing | CSS utility framework | `bg-danger`, `text-danger`, `mr-1` — all pre-existing tokens |

**No npm install step required.** [VERIFIED: grep for package.json shows all these are already present]

---

## Architecture Patterns

### System Architecture Diagram

```
LoadResult.skippedAttachments (Phase 21 Plan 21-09)
         │
         ▼
summary.ts:buildSummary()
  ├── Build skippedNames Set (line 61-63)  ← UNCHANGED
  ├── peaksArrayRaw = analyze(...)          ← UNCHANGED
  ├── [PHASE 25] peaksArray = peaksArrayRaw.map(p => ({
  │     ...p, isMissing: skippedNames.has(p.attachmentName) || undefined
  │   }))                                  ← replaces filter at line 89
  ├── [PHASE 25] animationBreakdown = animationBreakdownRaw.map(card => ({
  │     ...card,
  │     rows: card.rows.map(r => ({
  │       ...r, isMissing: skippedNames.has(r.attachmentName) || undefined
  │     })),
  │     uniqueAssetCount: card.rows.length ← full count, no filter
  │   }))                                  ← replaces filter at line 114
  └── skippedAttachments: load.skippedAttachments ?? []  ← UNCHANGED (still feeds MissingAttachmentsPanel)
         │
         ▼ IPC (structuredClone-safe — isMissing is an optional boolean primitive)
         │
  ┌──────┴──────────────────────────────────────────┐
  │                                                  │
  ▼                                                  ▼
GlobalMaxRenderPanel.tsx                 AnimationBreakdownPanel.tsx
  enrichWithEffective() → EnrichedRow      enrichCardsWithEffective() → EnrichedBreakdownRow
  (isMissing passes through spread)        (isMissing passes through spread via BreakdownRow extends DisplayRow)
  │                                          │
  rowState(effectiveScale, isUnused,         rowState(effectiveScale, false,
           row.isMissing)                             row.isMissing)
  → RowState: 'missing' | ...              → RowState: 'missing' | ...
  │                                          │
  JSX: left-accent bg-danger                JSX: left-accent bg-danger
       name cell: ⚠ + name text                  name cell: ⚠ + name text
       ratio cell: bg-danger/10 text-danger       ratio cell: bg-danger/10 text-danger
  │                                          │
  ▼                                          ▼
MissingAttachmentsPanel (position unchanged, content unchanged — additive display only)
```

### Recommended File Structure (4 files modified, no new files)

```
src/
├── shared/
│   └── types.ts                       # Add isMissing?: boolean to DisplayRow (line ~139)
├── main/
│   └── summary.ts                     # Replace 2 filters with isMissing marking (lines 89, 114)
└── renderer/src/panels/
    ├── GlobalMaxRenderPanel.tsx        # RowState + rowState() + left-accent + name cell + ratio cell
    └── AnimationBreakdownPanel.tsx     # Same 4 changes, symmetric
```

---

## Verified Code Patterns

### Pattern 1: Filter Removal + isMissing Marking in summary.ts

**Current (line 89) — to be replaced:**
```typescript
// [VERIFIED: src/main/summary.ts:89]
const peaksArray = peaksArrayRaw.filter((p) => !skippedNames.has(p.attachmentName));
```

**After Phase 25:**
```typescript
// Source: 25-CONTEXT.md §Canonical References + 25-UI-SPEC.md §summary.ts Data Contract
const peaksArray = peaksArrayRaw.map((p) => ({
  ...p,
  isMissing: skippedNames.has(p.attachmentName) ? true : undefined,
}));
```

**Current (lines 113-119) — to be replaced:**
```typescript
// [VERIFIED: src/main/summary.ts:113-119]
const animationBreakdown = animationBreakdownRaw.map((card) => {
  const filteredRows = card.rows.filter((r) => !skippedNames.has(r.attachmentName));
  return {
    ...card,
    rows: filteredRows,
    uniqueAssetCount: filteredRows.length,
  };
});
```

**After Phase 25:**
```typescript
const animationBreakdown = animationBreakdownRaw.map((card) => {
  const rows = card.rows.map((r) => ({
    ...r,
    isMissing: skippedNames.has(r.attachmentName) ? true : undefined,
  }));
  return {
    ...card,
    rows,
    uniqueAssetCount: rows.length,
  };
});
```

Note: `uniqueAssetCount` now equals `rows.length` (all rows, including missing ones). Previously it equaled `filteredRows.length` (excluding missing). This changes the count displayed in breakdown card headers — now showing the full count including missing attachments. This is intentional: the card header count should reflect all attachments in that animation, not a filtered subset.

### Pattern 2: RowState Extension (both panels — identical)

**Current (GlobalMaxRenderPanel.tsx:172-178) — verified by grep:**
```typescript
// [VERIFIED: grep output shows line 172]
type RowState = 'under' | 'over' | 'unused' | 'neutral';

function rowState(peakRatio: number, isUnused: boolean): RowState {
  if (isUnused) return 'unused';
  if (peakRatio < 1.0) return 'under';
  if (peakRatio > 1.0) return 'over';
  return 'neutral';
}
```

**After Phase 25 (both panels):**
```typescript
// Source: 25-UI-SPEC.md §RowState type extension
type RowState = 'under' | 'over' | 'unused' | 'neutral' | 'missing';

function rowState(peakRatio: number, isUnused: boolean, isMissing?: boolean): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakRatio < 1.0) return 'under';
  if (peakRatio > 1.0) return 'over';
  return 'neutral';
}
```

### Pattern 3: Left-Accent Bar JSX (both panels — symmetric)

**Current (GlobalMaxRenderPanel.tsx:426-436) — verified by grep:**
```tsx
// [VERIFIED: src/renderer/src/panels/GlobalMaxRenderPanel.tsx:428-435]
<span
  className={clsx(
    'inline-block w-1 h-full',
    state === 'under' && 'bg-success',
    state === 'over' && 'bg-warning',
    state === 'unused' && 'bg-danger',
    state === 'neutral' && 'bg-transparent',
  )}
  aria-hidden="true"
/>
```

**After Phase 25 (both panels):**
```tsx
// Source: 25-UI-SPEC.md §Left-accent bar
<span
  className={clsx(
    'inline-block w-1 h-full',
    state === 'under' && 'bg-success',
    state === 'over' && 'bg-warning',
    state === 'unused' && 'bg-danger',
    state === 'missing' && 'bg-danger',
    state === 'neutral' && 'bg-transparent',
  )}
  aria-hidden="true"
/>
```

### Pattern 4: Attachment Name Cell ⚠ Icon (both panels)

**Current (GlobalMaxRenderPanel.tsx:451-453):**
```tsx
// [VERIFIED: src/renderer/src/panels/GlobalMaxRenderPanel.tsx:451-453]
<td className="py-2 px-3 font-mono text-sm text-fg">
  {highlightMatch(row.attachmentName, query)}
</td>
```

**After Phase 25 (both panels):**
```tsx
// Source: 25-UI-SPEC.md §Attachment name cell
<td className="py-2 px-3 font-mono text-sm text-fg">
  {row.isMissing && (
    <span className="text-danger mr-1" aria-label="Missing PNG">
      ⚠
    </span>
  )}
  {highlightMatch(row.attachmentName, query)}
</td>
```

### Pattern 5: Tinted Ratio Cell Extension (both panels)

**Current (GlobalMaxRenderPanel.tsx:497-503):**
```tsx
// [VERIFIED: src/renderer/src/panels/GlobalMaxRenderPanel.tsx:497-503]
state === 'under' && 'bg-success/10 text-success',
state === 'over' && 'bg-warning/10 text-warning',
state === 'unused' && 'bg-danger/10 text-danger',
state === 'neutral' && 'text-fg',
```

**After Phase 25 (both panels):**
```tsx
// Source: 25-UI-SPEC.md §Tinted ratio cell
state === 'under' && 'bg-success/10 text-success',
state === 'over' && 'bg-warning/10 text-warning',
state === 'unused' && 'bg-danger/10 text-danger',
state === 'missing' && 'bg-danger/10 text-danger',
state === 'neutral' && 'text-fg',
```

### Pattern 6: rowState Call Sites (both panels)

**GlobalMaxRenderPanel** — the `state` variable is computed per-row in the `BreakdownRowItem` props pre-compute:
```typescript
// [VERIFIED: grep shows rowState calls at lines 803, 848 in AnimationBreakdownPanel]
// GlobalMaxRenderPanel: rowState is called with effectiveScale + isUnused
const state = rowState(row.effectiveScale, isUnused, row.isMissing);
```

**AnimationBreakdownPanel** — `isUnused` is always `false` for breakdown rows:
```typescript
// Source: 25-UI-SPEC.md §rowState Call-Site Updates
const state = rowState(row.effectiveScale, false, row.isMissing);
```

### Pattern 7: DisplayRow Type Extension

**Add to `src/shared/types.ts` after `dimsMismatch` field (line ~139):**
```typescript
// Source: 25-UI-SPEC.md §DisplayRow type extension
/**
 * Phase 25 — true when this row's source PNG was missing at load time and
 * a 1×1 stub region was synthesized (Phase 21 Plan 21-09). Drives the
 * 'missing' RowState variant in both GlobalMaxRenderPanel and
 * AnimationBreakdownPanel (red left-border accent + ⚠ icon beside name).
 * Optional/undefined is equivalent to false — backward-compatible with
 * existing IPC payloads.
 */
isMissing?: boolean;
```

`BreakdownRow extends DisplayRow` at line 158 — gains `isMissing` automatically, no change needed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Danger color token | Custom hex string | `bg-danger` / `text-danger` (existing token `#e06b55`) | Token already defined in `index.css @theme inline`; hand-rolling breaks the design system |
| Warning icon | SVG component | Unicode `⚠` (U+26A0) | `MissingAttachmentsPanel` already uses this pattern; zero import cost; readable inline |
| Renderer-side missing-name lookup | `Set<string>` from `summary.skippedAttachments` | `row.isMissing` from `DisplayRow` | D-01 explicitly locks the IPC approach; renderer-side computation would be redundant and fragile |
| Separate "missing" filter | Custom pre-render filter | Let all rows render, use `RowState` to gate CSS | Rows are already in the IPC payload; filtering again in the renderer defeats the purpose |

**Key insight:** The design system already has everything needed for this visual treatment. `bg-danger` and `text-danger` are established; `⚠` is established in `MissingAttachmentsPanel`; the left-accent bar and ratio cell patterns are established in both panels. Phase 25 is purely additive to existing patterns.

---

## Common Pitfalls

### Pitfall 1: Updating `uniqueAssetCount` to match the new (full) row count

**What goes wrong:** If `uniqueAssetCount` is left as `filteredRows.length` from the old code, the card header shows a count smaller than the actual number of rows rendered. The docblock at `src/shared/types.ts:173-175` states `uniqueAssetCount === rows.length` as the contractual invariant.

**Why it happens:** The Phase 21 code set `uniqueAssetCount: filteredRows.length` because filteredRows was the complete set after dropping missing rows. With missing rows now included, `rows.length` is the correct source.

**How to avoid:** After the `map()` replacement, set `uniqueAssetCount: rows.length` using the newly mapped (full) rows array.

**Warning signs:** Breakdown card headers show a count lower than the visible rows in the expanded card.

### Pitfall 2: Missing the ratio cell tinted treatment for `'missing'`

**What goes wrong:** The left-accent bar gets `bg-danger` but the ratio cell still has no background tint for `state === 'missing'`, breaking the visual symmetry with the `'unused'` treatment.

**Why it happens:** The ratio cell clsx block has four branches (under/over/unused/neutral) — it's easy to add the accent branch and forget the ratio cell branch.

**How to avoid:** The UI-SPEC explicitly specifies `bg-danger/10 text-danger` for the ratio cell on missing rows. Treat the ratio cell as a required fourth modification alongside the left-accent, name cell, and RowState extension.

**Warning signs:** Code review shows ratio cell clsx block still has only 4 branches after the change.

### Pitfall 3: `'missing'` check must be FIRST in `rowState()`

**What goes wrong:** If `isMissing` is checked after `isUnused`, a row that is both missing AND unused (theoretically possible since stub regions can appear in skins) would return `'unused'` instead of `'missing'`, showing the wrong visual signal (no ⚠ icon).

**Why it happens:** The natural reading order mirrors the existing function structure — adding `missing` at the bottom is an easy mistake.

**How to avoid:** The function signature starts with `if (isMissing) return 'missing'` as the very first check. CONTEXT.md and UI-SPEC both explicitly state this ordering requirement.

**Warning signs:** Test for a row where `isMissing=true` and `isUnused=true` returns `'unused'` instead of `'missing'`.

### Pitfall 4: `SkeletonSummary` comment block needs updating

**What goes wrong:** The `SkeletonSummary.skippedAttachments` docblock at `src/shared/types.ts:574-587` currently states:
> `peaks / animationBreakdown.rows / orphanedFiles are pre-filtered by src/main/summary.ts to EXCLUDE entries whose attachmentName ∈ skippedAttachments[*].name`

After Phase 25 this is no longer true — peaks and animationBreakdown.rows include the stub rows (marked with `isMissing`). Leaving the old comment is misleading.

**How to avoid:** Update the `IMPORTANT — filter contract:` paragraph in the `skippedAttachments` docblock to describe the new marking-instead-of-filtering behavior.

**Warning signs:** The comment says "pre-filtered to EXCLUDE" but the actual code now marks rows with `isMissing: true` and includes them.

### Pitfall 5: AnimationBreakdownPanel's `BreakdownRowItemProps` — `state` type must be updated

**What goes wrong:** `BreakdownRowItemProps` at line ~630 types its `state` field as `RowState`. If the `RowState` type is extended but the `BreakdownRowItemProps.state` field isn't re-read from the updated type, TypeScript may still accept the old literal union without `'missing'` if the type is inlined rather than referenced.

**How to avoid:** Confirm that `BreakdownRowItemProps` (and any equivalent props interface in GlobalMaxRenderPanel for `BreakdownRowItem`) uses the module-local `RowState` type alias, not an inlined string union. Both panels use `state: RowState` which references the module-local type — extending `RowState` automatically updates the prop type.

---

## `isMissing` Propagation Through `EnrichedRow`

Both panels use a spread-based enrichment:

```typescript
// GlobalMaxRenderPanel enrichWithEffective
return rows.map((row) => {
  const override = overrides.get(row.attachmentName);
  const { effScale, outW, outH } = computeExportDims(...);
  return {
    ...row,          // <-- isMissing passes through here
    effectiveScale: effScale,
    effExportW: outW,
    effExportH: outH,
    override,
  };
});
```

The `...row` spread includes `isMissing` since it is part of `DisplayRow`. No change to `enrichWithEffective` or `enrichCardsWithEffective` is required. [VERIFIED: grep of enrichWithEffective shows `...row` spread at line ~225]

---

## Test Strategy

### Existing Tests That Must Pass (no regressions)

- `tests/core/summary.spec.ts` — the `describe('Phase 21 G-02 — skippedAttachments cascade')` block currently verifies that TRIANGLE is **absent** from peaks after filtering. After Phase 25, the filter is removed — these tests must be **updated** to verify that TRIANGLE is **present** in peaks with `isMissing: true`, not absent.
- `tests/renderer/missing-attachments-panel.spec.tsx` — MissingAttachmentsPanel is unchanged; these tests must continue to pass unchanged.

### New Tests Required

**Plan 25-01 (data layer) — `tests/core/summary.spec.ts` additions:**

| Behavior | Test Name |
|----------|-----------|
| Stub rows appear in peaks with `isMissing: true` | `Phase 25: stub row marked isMissing=true in peaksArray` |
| Non-stub rows have `isMissing` undefined (not false) | `Phase 25: non-stub rows have isMissing undefined` |
| Stub rows appear in breakdown card rows with `isMissing: true` | `Phase 25: stub row marked isMissing=true in animationBreakdown card rows` |
| `uniqueAssetCount` reflects full row count including missing | `Phase 25: uniqueAssetCount equals full rows.length including missing rows` |
| `isMissing` survives `structuredClone` (D-22 pattern) | `Phase 25: isMissing boolean survives structuredClone` |

**Plan 25-02 (renderer layer) — new spec file `tests/renderer/global-max-missing-row.spec.tsx`:**

| Behavior | Test Name |
|----------|-----------|
| Missing row shows `⚠` icon in name cell | `Phase 25: GlobalMaxRenderPanel renders ⚠ icon for isMissing row` |
| Missing row has `bg-danger` left-accent class (via RowState) | `Phase 25: rowState returns 'missing' when isMissing=true` |
| Missing row checked first (over isUnused) in rowState | `Phase 25: rowState returns 'missing' even when isUnused=true` |
| Non-missing row has no ⚠ icon | `Phase 25: non-missing row has no ⚠ icon` |

Or alternatively, expand `tests/renderer/global-max-virtualization.spec.tsx` if the file already contains row-rendering tests.

**Note:** The project testing convention (from `missing-attachments-panel.spec.tsx`) uses `@testing-library/react` + `vitest` + `jsdom` with `not.toBeNull()` assertions, NOT `@testing-library/jest-dom` matchers. Follow this pattern.

### Test Framework Reference

| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vite.config.ts` / `vitest` section |
| Quick run command | `npm run test -- --run tests/core/summary.spec.ts tests/renderer/global-max-missing-row.spec.tsx` |
| Full suite command | `npm run test` |

---

## Existing G-02 Tests — Required Update

The G-02 UNIT test at `tests/core/summary.spec.ts:233-281` verifies the **old** filter behavior:

```typescript
// Current assertion (must be REVISED in Plan 25-01):
expect(filteredPeaks.find((p: any) => p.attachmentName === 'TRIANGLE')).toBeUndefined();
```

This test verified the filter contract that Phase 25 removes. After Phase 25, the correct assertions are:
1. TRIANGLE IS present in peaks (not undefined)
2. TRIANGLE has `isMissing: true`
3. CIRCLE and SQUARE have `isMissing` undefined

The test comment block must be updated to reflect the new marking-not-filtering behavior.

---

## Files to Modify (4 files total)

| File | Change Type | Specific Sites |
|------|------------|----------------|
| `src/shared/types.ts` | Interface extension | Add `isMissing?: boolean` after `dimsMismatch` (~line 139); update `skippedAttachments` docblock to remove "pre-filtered to EXCLUDE" language |
| `src/main/summary.ts` | Logic change | Line 89: replace filter with map+mark; Lines 113-119: replace filter+count with map+mark+full-length count; update comment block |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | Extend predicate + JSX | RowState type + rowState() + rowState() call site + left-accent clsx + name cell ⚠ + ratio cell clsx |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | Extend predicate + JSX | Same 4 changes, symmetric |

## Files NOT Modified

| File | Reason |
|------|--------|
| `src/renderer/src/panels/MissingAttachmentsPanel.tsx` | Additive only — panel stays unchanged |
| `src/core/loader.ts` | Layer 3 invariant |
| `src/core/sampler.ts` | Layer 3 invariant |
| `src/core/export.ts` | Layer 3 invariant |
| `src/main/ipc.ts` | IPC channel shape unchanged; DisplayRow gains one optional boolean (backward-compatible) |
| `src/preload/index.ts` | Unchanged |
| `src/renderer/src/panels/UnusedAssetsPanel.tsx` | Unchanged |

---

## Open Questions

1. **G-02 UNIT test revision scope**
   - What we know: `tests/core/summary.spec.ts:233-281` locks the filter contract that Phase 25 removes; the INTEGRATION test at line 283 also checks filter behavior indirectly.
   - What's unclear: Whether to modify the existing G-02 tests in-place or add new Phase-25-specific tests alongside them (with the old tests deleted or updated).
   - Recommendation: Update the G-02 tests in-place, changing their assertions from "absent" to "present with `isMissing: true`"; update the test description string to reflect the new behavior. The description currently says "drops skipped names from peaks" — change to "marks skipped names as isMissing:true in peaks".

2. **`uniqueAssetCount` visible impact**
   - What we know: Breakdown card headers show `uniqueAssetCount` (e.g., "3 assets"). After Phase 25, this count increases by the number of missing attachments per card.
   - What's unclear: Whether animators will find the higher count confusing (it now includes stub rows they can see but whose data is unreliable).
   - Recommendation: The CONTEXT.md D-02 locks that stub data renders as-is with the ⚠ signal; the count change is an honest reflection of what's in the card. No special-casing needed. If the user finds it confusing in UAT, it can be addressed in a gap-closure plan.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 25 is purely a code/config change across 4 TypeScript/TSX files. No external CLI tools, services, runtimes, or databases are required beyond the project's existing Node.js + npm environment.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (existing) |
| Config file | `vite.config.ts` (vitest section) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PANEL-03 | Stub rows present in `peaksArray` with `isMissing: true` | unit | `npm run test -- --run tests/core/summary.spec.ts` | ✅ (needs update) |
| PANEL-03 | Stub rows present in `animationBreakdown.card.rows` with `isMissing: true` | unit | `npm run test -- --run tests/core/summary.spec.ts` | ✅ (needs update) |
| PANEL-03 | `GlobalMaxRenderPanel` renders ⚠ for `isMissing` rows | unit/RTL | `npm run test -- --run tests/renderer/global-max-missing-row.spec.tsx` | ❌ Wave 0 |
| PANEL-03 | `rowState()` returns `'missing'` first when `isMissing=true` | unit | included in above | ❌ Wave 0 |
| PANEL-03 | MissingAttachmentsPanel still renders unchanged (regression) | unit/RTL | `npm run test -- --run tests/renderer/missing-attachments-panel.spec.tsx` | ✅ (no change needed) |

### Sampling Rate
- **Per task commit:** `npm run test -- --run tests/core/summary.spec.ts tests/renderer/missing-attachments-panel.spec.tsx`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work 25`

### Wave 0 Gaps
- [ ] `tests/renderer/global-max-missing-row.spec.tsx` — covers PANEL-03 renderer layer (rowState `'missing'` + ⚠ icon rendering in GlobalMaxRenderPanel; optionally AnimationBreakdownPanel too)

*(MissingAttachmentsPanel and summary.spec.ts infrastructure exist; only the new renderer spec is a Wave 0 gap)*

---

## Security Domain

No security surface changes. Phase 25 adds one optional boolean field to an existing IPC type — no new input validation, authentication, cryptography, or access control surface introduced. ASVS V5 (Input Validation) is not triggered by adding a read-only boolean derived from main-process-owned data.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `EnrichedRow = DisplayRow & {...}` spread includes `isMissing` automatically without enrichment function changes | Architecture Patterns | If enrichment uses an explicit field list rather than spread, `isMissing` would be dropped; mitigated by verified grep showing `...row` spread in both functions |
| A2 | `BreakdownRowItemProps.state: RowState` uses the module-local type alias, not an inlined string union | Common Pitfalls | If inlined, TypeScript may not flag passing `'missing'` at call sites; verified indirectly by the code structure |

All other claims are verified directly against the source files read in this session.

---

## Sources

### Primary (HIGH confidence — verified against source files)
- `src/main/summary.ts` — filter sites at lines 89 and 113-119 verified by Read tool + grep
- `src/shared/types.ts` — `DisplayRow` interface at line 54, `BreakdownRow extends DisplayRow` at line 158 verified by Read tool
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — `RowState` at line 172, `rowState()` at line 174, left-accent JSX at lines 426-436, name cell at line 451-453, ratio cell at lines 497-503 verified by Read tool
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — `RowState` at line 174, `rowState()` at line 176, left-accent JSX at lines 661-669, name cell at line 671-673, ratio cell at lines 704-710, call sites at lines 803 and 848 verified by Read tool
- `.planning/phases/25-missing-attachments-in-context-display/25-CONTEXT.md` — all decisions verified
- `.planning/phases/25-missing-attachments-in-context-display/25-UI-SPEC.md` — all JSX patterns verified
- `tests/core/summary.spec.ts` — G-02 test block at lines 226-326 verified by Read tool
- `tests/renderer/missing-attachments-panel.spec.tsx` — test conventions verified by Read tool

### Secondary (MEDIUM confidence)
- Project conventions inferred from multiple test files (no `@testing-library/jest-dom`, `not.toBeNull()` pattern)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages, all patterns verified in source files
- Architecture: HIGH — all 4 modification sites verified by line number with grep confirmation
- Pitfalls: HIGH — derived from reading the actual source + G-02 test contract

**Research date:** 2026-05-04
**Valid until:** This is a single-milestone feature with locked decisions; research is valid for the lifetime of Phase 25 execution (no external dependencies to go stale).
