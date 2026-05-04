# Phase 25: Missing Attachments In-Context Display - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 4 modified files + 2 test files
**Analogs found:** 4 / 4 (all files are self-analog — Phase 25 extends existing code in-place)

---

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `src/shared/types.ts` | model/contract | request-response (IPC) | Self (extend `DisplayRow` after `dimsMismatch` at line 139) | exact — prior optional-field additions (e.g. `atlasSource?`, `actualSourceW?`) |
| `src/main/summary.ts` | service/transform | batch (map-and-mark) | Self (replace filter at lines 89 + 113-119 with map+mark) | exact — `skippedNames` Set already in scope at both sites |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | component | request-response (render) | Self (extend `RowState` + `rowState()` + JSX at 4 sites) | exact — `'unused'` variant is the direct pattern to mirror |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | component | request-response (render) | Self + `GlobalMaxRenderPanel.tsx` (symmetric) | exact — identical `RowState`/`rowState()` pattern, same 4 JSX sites |
| `tests/core/summary.spec.ts` | test | batch | Self (G-02 block lines 226-281 — update assertions) | exact |
| `tests/renderer/global-max-missing-row.spec.tsx` | test | request-response | `tests/renderer/missing-attachments-panel.spec.tsx` | role-match — same RTL + vitest + jsdom idiom |

---

## Pattern Assignments

### `src/shared/types.ts` — add `isMissing?: boolean` to `DisplayRow`

**Analog site:** `src/shared/types.ts` lines 117-139 (existing optional-field additions)

**Pattern to follow — prior optional field with full JSDoc** (lines 117-139):
```typescript
// src/shared/types.ts:117-139
/**
 * Phase 6 Gap-Fix #2 — Atlas-page extraction metadata ...
 * Optional — undefined when the analyzer is invoked without an atlasSources map ...
 * All fields primitive — structuredClone-safe per file-top D-21 lock.
 */
atlasSource?: {
  pagePath: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
};
/**
 * Phase 22 DIMS-01 — true when actualSource differs from canonical by
 * more than 1px on EITHER axis. Always false when actualSourceW/H are
 * undefined (atlas-extract path).
 */
dimsMismatch: boolean;
```

**Insertion point:** After `dimsMismatch: boolean;` at line 139, before the closing `}` of `DisplayRow`.

**Exact text to insert:**
```typescript
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

**`BreakdownRow` (line 158):** `extends DisplayRow` — gains `isMissing` automatically. No change required.

**`SkeletonSummary.skippedAttachments` docblock** (around line 574-587): Update the `IMPORTANT — filter contract:` paragraph. The phrase "pre-filtered to EXCLUDE entries whose attachmentName ∈ skippedAttachments[*].name" must be changed to describe the new marking-not-filtering behavior.

---

### `src/main/summary.ts` — replace 2 filters with `isMissing` marking

**Analog site:** `src/main/summary.ts` lines 61-63 (existing `skippedNames` Set construction)

**Existing `skippedNames` Set** (lines 61-63 — unchanged, already in scope):
```typescript
// src/main/summary.ts:61-63
const skippedNames = new Set<string>(
  (load.skippedAttachments ?? []).map((s) => s.name),
);
```

**Site 1 — Current filter at line 89 (REMOVE):**
```typescript
// src/main/summary.ts:89 — CURRENT (to be replaced)
const peaksArray = peaksArrayRaw.filter((p) => !skippedNames.has(p.attachmentName));
```

**Site 1 — Replacement (map + mark):**
```typescript
// src/main/summary.ts:89 — AFTER Phase 25
const peaksArray = peaksArrayRaw.map((p) => ({
  ...p,
  isMissing: skippedNames.has(p.attachmentName) ? true : undefined,
}));
```

**Site 2 — Current filter block at lines 113-120 (REMOVE):**
```typescript
// src/main/summary.ts:113-120 — CURRENT (to be replaced)
const animationBreakdown = animationBreakdownRaw.map((card) => {
  const filteredRows = card.rows.filter((r) => !skippedNames.has(r.attachmentName));
  return {
    ...card,
    rows: filteredRows,
    uniqueAssetCount: filteredRows.length,
  };
});
```

**Site 2 — Replacement (map + mark, full count):**
```typescript
// src/main/summary.ts:113-120 — AFTER Phase 25
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

**Comment block update:** The Phase 21 G-02 comment at lines 108-112 says "filter each animation card's rows to drop stub-region attachments". Update to describe the new marking behavior.

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — extend RowState + 4 JSX sites

**Analog site:** `GlobalMaxRenderPanel.tsx` lines 172-179 (`RowState` + `rowState()`), lines 426-436 (left-accent), line 451-452 (name cell), lines 497-503 (ratio cell), lines 929-932 + 1047-1050 (call sites).

#### Change 1: `RowState` type (line 172)

**Current:**
```typescript
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:172
type RowState = 'under' | 'over' | 'unused' | 'neutral';
```

**After:**
```typescript
type RowState = 'under' | 'over' | 'unused' | 'neutral' | 'missing';
```

#### Change 2: `rowState()` predicate (lines 174-179)

**Current:**
```typescript
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:174-179
function rowState(peakRatio: number, isUnused: boolean): RowState {
  if (isUnused) return 'unused';
  if (peakRatio < 1.0) return 'under';
  if (peakRatio > 1.0) return 'over';
  return 'neutral';
}
```

**After (add `isMissing?` as FIRST check):**
```typescript
function rowState(peakRatio: number, isUnused: boolean, isMissing?: boolean): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakRatio < 1.0) return 'under';
  if (peakRatio > 1.0) return 'over';
  return 'neutral';
}
```

#### Change 3: `rowState()` call sites (lines 929-932 and 1047-1050)

There are two call sites. Both must thread `row.isMissing` as the third argument.

**Current (both sites):**
```typescript
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:929-932 (virtualizer path)
const state = rowState(
  row.effectiveScale,
  false,
);

// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:1047-1050 (flat-table path)
const state = rowState(
  row.effectiveScale,
  false,
);
```

**After (both sites):**
```typescript
const state = rowState(row.effectiveScale, false, row.isMissing);
```

Note: `isUnused` is `false` at both call sites in this panel (unused membership is tracked at summary level, not per-row in GlobalMaxRenderPanel's current render paths).

#### Change 4: Left-accent bar `<span>` (lines 426-436)

**Current:**
```tsx
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:426-436
<td className="w-1 p-0">
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
</td>
```

**After (add `'missing'` branch alongside `'unused'`):**
```tsx
<td className="w-1 p-0">
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
</td>
```

#### Change 5: Attachment name cell (lines 451-453)

**Current:**
```tsx
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:451-453
<td className="py-2 px-3 font-mono text-sm text-fg">
  {highlightMatch(row.attachmentName, query)}
</td>
```

**After (insert `⚠` span before name when `row.isMissing`):**
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg">
  {row.isMissing && (
    <span className="text-danger mr-1" aria-label="Missing PNG">
      ⚠
    </span>
  )}
  {highlightMatch(row.attachmentName, query)}
</td>
```

#### Change 6: Tinted ratio cell clsx (lines 497-503)

**Current:**
```tsx
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx:497-503
<td
  className={clsx(
    'py-2 px-3 font-mono text-sm text-right',
    state === 'under' && 'bg-success/10 text-success',
    state === 'over' && 'bg-warning/10 text-warning',
    state === 'unused' && 'bg-danger/10 text-danger',
    state === 'neutral' && 'text-fg',
  )}
```

**After (add `'missing'` branch mirroring `'unused'`):**
```tsx
<td
  className={clsx(
    'py-2 px-3 font-mono text-sm text-right',
    state === 'under' && 'bg-success/10 text-success',
    state === 'over' && 'bg-warning/10 text-warning',
    state === 'unused' && 'bg-danger/10 text-danger',
    state === 'missing' && 'bg-danger/10 text-danger',
    state === 'neutral' && 'text-fg',
  )}
```

---

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — symmetric to GlobalMaxRenderPanel

**Analog site:** `AnimationBreakdownPanel.tsx` lines 174-181 (`RowState` + `rowState()`), lines 659-669 (left-accent), lines 671-673 (name cell), lines 703-710 (ratio cell), lines 803 + 848 (call sites).

All 6 changes are symmetric to `GlobalMaxRenderPanel.tsx`. Copy exactly the same patterns.

#### Change 1: `RowState` type (line 174) — same as Global panel

**Current:** `type RowState = 'under' | 'over' | 'unused' | 'neutral';`
**After:** `type RowState = 'under' | 'over' | 'unused' | 'neutral' | 'missing';`

#### Change 2: `rowState()` predicate (lines 176-181) — same signature

**After:**
```typescript
function rowState(peakRatio: number, isUnused: boolean, isMissing?: boolean): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakRatio < 1.0) return 'under';
  if (peakRatio > 1.0) return 'over';
  return 'neutral';
}
```

#### Change 3: `rowState()` call sites (lines 803 and 848)

**Current (both):**
```typescript
// src/renderer/src/panels/AnimationBreakdownPanel.tsx:803
const state = rowState(row.effectiveScale, false);

// src/renderer/src/panels/AnimationBreakdownPanel.tsx:848
const state = rowState(row.effectiveScale, false);
```

**After:**
```typescript
const state = rowState(row.effectiveScale, false, row.isMissing);
```

Note: `isUnused` is always `false` for AnimationBreakdownPanel (comment at lines 799-802 documents this). `isMissing` has no such restriction — stub rows appear in both global peaks and per-animation breakdown cards.

#### Changes 4, 5, 6: Left-accent, name cell, ratio cell (lines 659-669, 671-673, 703-710)

Apply exactly the same JSX modifications as GlobalMaxRenderPanel Changes 4, 5, 6 above. The current code at these lines is structurally identical to the Global panel counterparts (confirmed by reading both files).

---

### `tests/core/summary.spec.ts` — update G-02 block (lines 226-281)

**Analog:** The existing G-02 block at lines 233-281 documents the filter contract that Phase 25 removes. These tests must be **revised** (not added alongside), updating assertions from "absent" to "present with `isMissing: true`".

**Test framework pattern** (from `missing-attachments-panel.spec.tsx` lines 1-20):
```typescript
// @vitest-environment jsdom  (not needed for summary.spec.ts — Node environment)
import { afterEach, describe, expect, it } from 'vitest';
// No @testing-library/jest-dom — project convention: use not.toBeNull() / toBeDefined()
```

**Current G-02 assertion to revise** (line 261):
```typescript
// CURRENT — asserts filter drops TRIANGLE:
expect(filteredPeaks.find((p: any) => p.attachmentName === 'TRIANGLE')).toBeUndefined();
```

**After Phase 25 — assert marking instead of filtering:**
```typescript
// AFTER — assert TRIANGLE is present with isMissing: true
const trianglePeak = peaks.find((p: any) => p.attachmentName === 'TRIANGLE');
expect(trianglePeak).toBeDefined();
expect(trianglePeak!.isMissing).toBe(true);

// Non-stub rows have isMissing undefined (not false)
const circlePeak = peaks.find((p: any) => p.attachmentName === 'CIRCLE');
expect(circlePeak!.isMissing).toBeUndefined();
```

**New test cases to add in the G-02 block:**
```typescript
it('Phase 25: uniqueAssetCount equals full rows.length including missing rows', () => { ... });
it('Phase 25: isMissing boolean survives structuredClone', () => {
  const row = { attachmentName: 'TRIANGLE', isMissing: true } as any;
  const cloned = structuredClone(row);
  expect(cloned.isMissing).toBe(true);
});
```

---

### `tests/renderer/global-max-missing-row.spec.tsx` — new file (Wave 0 gap)

**Analog:** `tests/renderer/missing-attachments-panel.spec.tsx` — copy the RTL + vitest + jsdom setup idiom exactly.

**Setup pattern** (from `missing-attachments-panel.spec.tsx` lines 1-21):
```typescript
// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
// Do NOT import from @testing-library/jest-dom — project convention
import { GlobalMaxRenderPanel } from '../../src/renderer/src/panels/GlobalMaxRenderPanel';

afterEach(cleanup);
```

**Test cases required (from RESEARCH.md §Test Strategy):**
```typescript
describe('Phase 25: GlobalMaxRenderPanel missing row', () => {
  it('rowState returns "missing" when isMissing=true', () => { ... });
  it('rowState returns "missing" even when isUnused=true (missing checked first)', () => { ... });
  it('renders ⚠ icon for isMissing row in name cell', () => {
    // render row with isMissing: true
    // expect(screen.getByLabelText('Missing PNG')).not.toBeNull();
  });
  it('non-missing row has no ⚠ icon', () => {
    // render row with isMissing: undefined
    // expect(screen.queryByLabelText('Missing PNG')).toBeNull();
  });
});
```

---

## Shared Patterns

### `bg-danger` / `text-danger` Danger Token
**Source:** `src/renderer/src/panels/MissingAttachmentsPanel.tsx` lines 62-66
**Apply to:** All `'missing'` state branches in both panels
```tsx
// MissingAttachmentsPanel.tsx:62-66 — established danger-accent idiom
<span
  className="inline-block w-1 h-4 bg-danger flex-shrink-0"
  aria-hidden="true"
/>
<span className="font-semibold text-danger">
  {count} attachment{plural} missing PNG{plural}
</span>
```
Phase 25 reuses `bg-danger` and `text-danger` tokens — same hex `#e06b55`. No new tokens.

### clsx Literal-Branch Pattern (Tailwind v4 discipline)
**Source:** `GlobalMaxRenderPanel.tsx` lines 428-435 and `AnimationBreakdownPanel.tsx` lines 661-669
**Apply to:** Every new `state === 'missing'` clsx branch
```tsx
// Tailwind v4 requires literal class strings — no template interpolation
state === 'missing' && 'bg-danger',       // left-accent bar
state === 'missing' && 'bg-danger/10 text-danger',  // ratio cell
```
Never write `state === 'missing' && \`bg-${color}\`` — Tailwind v4 purges non-literal class strings.

### Optional Boolean Field Pattern (IPC / structuredClone-safe)
**Source:** `src/shared/types.ts` lines 109-116 (`atlasSource?`) and lines 133-135 (`actualSourceW?`)
**Apply to:** `isMissing?: boolean` field addition
```typescript
// Pattern: optional means "undefined === falsy" — no `false` sentinel needed
isMissing?: boolean;
// Set as: isMissing: skippedNames.has(name) ? true : undefined
// (not `false` — keeps the JSON payload lean; undefined is omitted by structuredClone)
```

### Spread-Based Enrichment Pass-Through
**Source:** `GlobalMaxRenderPanel.tsx:enrichWithEffective` (verified `...row` spread at ~line 224)
**Apply to:** Confirms `isMissing` flows through both `enrichWithEffective` and `enrichCardsWithEffective` automatically — no changes to those functions required.
```typescript
return {
  ...row,          // isMissing passes through here automatically
  effectiveScale: effScale,
  effExportW: outW,
  effExportH: outH,
  override,
};
```

### RTL Test Convention (no jest-dom)
**Source:** `tests/renderer/missing-attachments-panel.spec.tsx` lines 1-20
**Apply to:** New `tests/renderer/global-max-missing-row.spec.tsx`
```typescript
// Project convention: vitest + @testing-library/react + jsdom
// Assertions use not.toBeNull() / toBeDefined() — NOT jest-dom matchers
// Example: expect(screen.getByLabelText('Missing PNG')).not.toBeNull();
// Never: expect(element).toBeInTheDocument();
```

---

## No Analog Found

None. All 4 files to be modified have direct in-file analogs (existing patterns to extend). The new test file has a role-match analog in `tests/renderer/missing-attachments-panel.spec.tsx`.

---

## Critical Ordering Constraints

1. **`isMissing` must be the FIRST check in `rowState()`** — before `isUnused`, before ratio comparisons. A row that is both missing and unused must return `'missing'` not `'unused'`.
2. **4 JSX changes per panel are coupled** — RowState type, rowState() body, left-accent clsx, name cell icon, ratio cell clsx. Missing any one breaks visual symmetry (Pitfall 2 in RESEARCH.md).
3. **`uniqueAssetCount` must use `rows.length`** (full mapped array), not `filteredRows.length` — the contractual invariant in `AnimationBreakdown` docblock at `src/shared/types.ts:176`.
4. **G-02 tests must be updated** (not left as-is) — they currently assert "TRIANGLE absent from peaks" which is the behavior Phase 25 removes. Leaving old assertions passing would be a false negative.

---

## Metadata

**Analog search scope:** `src/shared/`, `src/main/`, `src/renderer/src/panels/`, `tests/`
**Files scanned:** 6 source files read directly
**Pattern extraction date:** 2026-05-04
