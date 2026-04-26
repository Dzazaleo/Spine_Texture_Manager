---
name: Phase 4 — Scale overrides Pattern Map
description: Per-file analog assignments for Phase 4 — maps each new / touched file to its closest existing codebase analog, with line-numbered excerpts the planner (and executor) copy from. Derived from 04-CONTEXT.md D-73..D-90.
phase: 4
---

# Phase 4: Scale overrides — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 7 (3 new + 4 touched)
**Analogs found:** 7 / 7
**Upstream context:** `04-CONTEXT.md` (no RESEARCH.md — user skipped)

## File Classification

| File | New/Touch | Role | Data Flow | Closest Analog | Match Quality |
|------|-----------|------|-----------|----------------|---------------|
| `src/core/overrides.ts` | NEW | core-utility (pure-TS math) | transform (stateless, pure function) | `src/core/analyzer.ts` | role-match (analyzer is stateful over rows; overrides is stateless primitives — closest of the 7 core files) |
| `src/renderer/src/modals/OverrideDialog.tsx` | NEW | modal component (hand-rolled) | controlled-input + dismiss events | `src/renderer/src/components/SearchBar.tsx` (controlled input + ESC) + `src/renderer/src/components/DropZone.tsx` (overlay wrapper shape) | role-close (no existing modals) |
| `tests/core/overrides.spec.ts` | NEW | vitest spec (pure-TS) | unit test | `tests/core/bones.spec.ts` module-hygiene block + a pure-compute describe | exact |
| `src/renderer/src/components/AppShell.tsx` | TOUCH | shell / state container | prop-threading (useState + useCallback) | itself — existing `activeTab` + `focusAnimationName` + `onJumpToAnimation`/`onFocusConsumed` pattern (lines 36-48) | exact (self-extend) |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | TOUCH | table-panel (sort / search / select) | request-response (table row events) | itself — existing Scale cell render (line 212) + `suppressNextChangeRef` click/change coordination (lines 161-189) | exact (self-extend) |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` | TOUCH | table-panel (collapsible cards) | request-response (button click, row event) | itself — Phase 3 D-69 disabled `Override Scale` button (lines 417-430) + existing Scale cell (line 408) | exact (self-extend) |
| `src/shared/types.ts` | TOUCH (discretion) | shared type shapes | none (erases at compile time) | existing `DisplayRow` + `BreakdownRow` interfaces (lines 30-74) | exact |

---

## Pattern Assignments

### 1. `src/core/overrides.ts` (NEW, core-utility, pure transform)

**Analog:** `src/core/analyzer.ts`

**Why this analog:** All 7 files in `src/core/` are pure-TS, DOM-free modules. `analyzer.ts` is the closest stylistically — it exports named pure functions, uses JSDoc with D-# decision citations, and has an N2.3-hygiene-clean import block (no `node:*`, no `sharp`). `bones.ts` / `bounds.ts` / `sampler.ts` all import from `@esotericsoftware/spine-core`, which `overrides.ts` MUST NOT do (D-75 + CLAUDE.md #5). `overrides.ts` is even simpler than `analyzer.ts` because it operates on primitives only, no row shapes.

**Header docblock pattern** (`analyzer.ts` lines 1-48): JSDoc opens with a one-liner phase + plan + D-# citation, then a prose rationale, then a "Callers:" block, then a per-export label spec. Mirror this shape for `overrides.ts` — one-liner ("Phase 4 — pure-TS clamping math for user-supplied percentage overrides (D-73..D-76)"), rationale paragraph citing D-75 (pure-TS, no React, no DOM, no spine-core, arch.spec.ts-enforced), then "Callers:" listing AppShell + both panels + future Phase 6 export.

**Named-export pattern** (`analyzer.ts` lines 136, 209):
```typescript
export function analyze(peaks: Map<string, PeakRecord>): DisplayRow[] {
  // ...
}

export function analyzeBreakdown(
  perAnimation: Map<string, PeakRecord>,
  // ...
): AnimationBreakdown[] {
```
Copy exactly. `overrides.ts` exports `clampOverride(percent: number): number` and `applyOverride(peakScale: number, overridePercent: number): { effectiveScale: number; clamped: boolean }`. Per-function JSDoc citing the specific D-# (D-79 for clamp, D-82 for apply-with-clamped-flag).

**Imports — zero-import rule.** `overrides.ts` has NO imports. Not `spine-core` (D-75), not `./types.js` (it operates on primitives — no shared types needed), not `node:*`. The file should be <40 lines of pure math. The 04-CONTEXT.md §<specifics> seed sketch at lines 214-244 is roughly correct — copy the shape, keep the exact JSDoc style matched to `analyzer.ts`.

**Anti-pattern to avoid:**
- Do NOT import `DisplayRow` or `BreakdownRow` from `../shared/types.js`. `overrides.ts` works on raw `peakScale: number` + `overridePercent: number` — the renderer assembles rows. Keeping the core function primitive-only means Phase 6 `export.ts` can feed it any peak-scale source without row-shape coupling.
- Do NOT add `clampOverride(percent: number, min: number, max: number)` — hard-code [1, 100] per D-78. Flexibility is a future-Phase concern.
- Do NOT return `null` for invalid input; `clampOverride` snaps non-finite / <1 to 1 (D-79). Silent clamp is the contract.

---

### 2. `src/renderer/src/modals/OverrideDialog.tsx` (NEW, modal component, controlled-input)

**Analog 1 — controlled input + focus + ESC/Enter:** `src/renderer/src/components/SearchBar.tsx` (all 72 lines)

**Analog 2 — overlay shape + hand-rolled-over-deps discipline:** `src/renderer/src/components/DropZone.tsx` (lines 103-120 for the wrapping overlay div; lines 51-101 for event handlers). DropZone is the codebase's only precedent for a full-viewport React overlay.

**Why these two:** The project has zero existing modals; the `modals/` folder does not exist yet (create it). SearchBar gives the exact controlled-input pattern (value + onChange + ESC + focus handling); DropZone gives the overlay-container pattern (Tailwind `fixed`-esque wrapper, hand-rolled per D-28). Both use `useCallback` for handlers, both are strict about literal Tailwind classes (no template strings).

**Header docblock pattern** (SearchBar lines 1-22): One-liner phase + plan, then UX refinement bullets, then Tailwind v4 literal-class discipline note. Mirror this — "Phase 4 — hand-rolled percentage-input modal (D-77..D-81). Hand-rolled over `react-modal` / `@radix-ui/react-dialog` per D-28."

**Controlled input + ESC handling** (SearchBar lines 31-58):
```typescript
export function SearchBar({ value, onChange, placeholder }: SearchBarProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Escape') return;
      if (value !== '') {
        e.preventDefault();
        onChange('');
      } else {
        e.currentTarget.blur();
      }
    },
    [value, onChange],
  );

  return (
    <div className="relative flex-1 max-w-md">
      <input
        type="text"
        value={value}
        placeholder={placeholder ?? 'Filter by attachment name…'}
        className="w-full bg-panel border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent placeholder:text-fg-muted"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Filter rows by attachment name"
      />
```
Mirror the input className pattern: `bg-panel border border-border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent`. Change `type="text"` → `type="number" min={1} max={100} step={1}`. The input should be a controlled component with internal `useState` for the string value (allows the user to type `200` and see it before clamp on Apply per D-79).

**Overlay + click-outside-closes** (DropZone lines 103-120):
```typescript
return (
  <div
    onDragEnter={handleDragEnter}
    // ... (event handlers)
    className={clsx(
      'w-full min-h-screen flex items-center justify-center',
      'bg-surface text-fg',
      'focus-visible:outline-2 focus-visible:outline-accent',
      isDragOver && 'ring-2 ring-accent bg-accent/5',
    )}
  >
    {children}
  </div>
);
```
For the dialog, replace `w-full min-h-screen` with `fixed inset-0 z-50 flex items-center justify-center bg-black/40`. Attach `onClick={props.onCancel}` on the overlay div; nest an inner `<div onClick={(e) => e.stopPropagation()}>` for the dialog body (seeded correctly in 04-CONTEXT.md §<specifics> line 289-294).

**Focus-management pattern** (none exists in codebase — hand-roll per D-81 discretion item): use `useRef<HTMLInputElement>` + `useEffect` that focuses + `.select()`s the input when `props.open` flips true. The seed sketch at 04-CONTEXT.md lines 262-269 is correct. Do NOT pull in `@radix-ui/react-focus-scope` — hand-rolled is <30 lines, well under the 60-line threshold called out in Claude's Discretion.

**ARIA pattern** (seed sketch lines 283-287): `role="dialog"`, `aria-modal="true"`, `aria-labelledby={titleId}`. No codebase analog — these come from the WAI-ARIA Modal Dialog external reference cited in 04-CONTEXT.md canonical_refs.

**Button styling tokens** (04-CONTEXT.md §Reusable Assets lines 176-179 confirm):
- Reset / Cancel (tertiary / secondary): `border border-border rounded-md px-3 py-1 text-xs font-mono` (matches Phase 3 chip style, see `AnimationBreakdownPanel.tsx` line 426 pre-opacity).
- Apply (primary): `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold`. The `text-panel` on top of `bg-accent` is an intentional inversion — background becomes foreground — to make Apply visually dominant.

**Tailwind v4 literal-class discipline** (SearchBar line 19-22, DropZone line 109-116): EVERY className is a string literal OR a clsx conditional with literal branches. NEVER template-interpolated. Tailwind v4's scanner misses concatenated class names. This is "Pitfall 8" cited in both analogs.

**Anti-patterns to avoid:**
- Do NOT import from `src/core/*` — the dialog is pure renderer. `applyOverride` / `clampOverride` are called from the panel / AppShell paths where the cell renders, not from the dialog.
- Do NOT use `<dialog>` native element — Electron's BrowserWindow + Chromium has quirky default styling on `<dialog>` (close-on-ESC native, modal stacking with z-index caveats). Use `<div role="dialog">` per the seed sketch (hand-rolled matches D-28 discipline).
- Do NOT render the dialog always-mounted-with-CSS-hide (`display: none`). Early-return `null` when `!props.open` per the seed sketch line 271 — matches React's controlled-mount pattern, no stale state across opens.
- Do NOT use `e.stopPropagation()` inside the input's onKeyDown — it breaks Tab focus trap. Enter/Escape handling at the container level (per seed sketch line 278-281) is the right layer.

---

### 3. `tests/core/overrides.spec.ts` (NEW, vitest spec, pure-TS)

**Analog:** `tests/core/bones.spec.ts` — specifically the module-hygiene describe block (lines 75-81) for the N2.3 grep pattern, and `tests/core/bounds.spec.ts` lines 267-298 for the broader hygiene pattern including export presence.

**Why this analog:** `bones.spec.ts` is the simplest existing spec with both behavior-assertions and grep-hygiene. `bounds.spec.ts` has the richest hygiene block (7 grep checks including export-presence). `overrides.spec.ts` is even simpler than both because it doesn't need the `primedSkeleton()` helper — `clampOverride` and `applyOverride` are pure number functions. Skip the loader / spine-core imports entirely.

**File-level pattern** (`bones.spec.ts` lines 1-36):
```typescript
/**
 * Phase 3 Plan 01 — Tests for src/core/bones.ts (D-68).
 *
 * Behavior gates:
 *   - F4.3 Bone Path — boneChainPath returns [...]
 *   - Fixture verifications on SIMPLE_TEST (...)
 *   - N2.3 hygiene — the module has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
```
Mirror the header shape: "Phase 4 Plan NN — Tests for src/core/overrides.ts (D-75, D-79, D-84)." Behavior gates list the exact cases enumerated in 04-CONTEXT.md line 26 (the 7 specific assertions). Hygiene gate lists N2.3 + a *no spine-core* grep (new for this phase since D-75 forbids it).

**Pure-function assertions** (pattern similar to `bounds.spec.ts` but simpler — no fixture loading):
```typescript
describe('clampOverride (D-79)', () => {
  it('D-79: clamps 200 → 100 (silent source-max clamp)', () => {
    expect(clampOverride(200)).toBe(100);
  });
  it('D-79: clamps 0 → 1 (lower bound)', () => {
    expect(clampOverride(0)).toBe(1);
  });
  // ... etc per CONTEXT line 26
});

describe('applyOverride (D-82, D-84)', () => {
  it('D-82: applyOverride(1.78, 50) → { effectiveScale: 0.89, clamped: false }', () => {
    const result = applyOverride(1.78, 50);
    expect(result.effectiveScale).toBeCloseTo(0.89, 5);
    expect(result.clamped).toBe(false);
  });
  it('D-84: applyOverride(1.78, 200) → { effectiveScale: 1.78, clamped: true } (silent clamp still badges)', () => {
    const result = applyOverride(1.78, 200);
    expect(result.effectiveScale).toBeCloseTo(1.78, 5);
    expect(result.clamped).toBe(true);
  });
});
```
Use `toBeCloseTo(expected, precision)` for floating-point — the `bounds.spec.ts` uses `toBeCloseTo(value, 5)` (5 decimal places) extensively (lines 68, 226). Pick 5 for Phase 4 too.

**Module-hygiene block** (`bones.spec.ts` lines 75-81, `bounds.spec.ts` lines 267-298):
```typescript
describe('overrides — module hygiene (N2.3 by construction)', () => {
  const src = readFileSync(path.resolve('src/core/overrides.ts'), 'utf8');

  it('N2.3: no node:fs / node:path / node:child_process / sharp / node:http / node:net imports', () => {
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });

  it('D-75: no @esotericsoftware/spine-core import (pure primitives only)', () => {
    expect(src).not.toMatch(/from ['"]@esotericsoftware\/spine-core['"]/);
  });

  it('D-75: no React / DOM import', () => {
    expect(src).not.toMatch(/from ['"]react['"]/);
    expect(src).not.toMatch(/from ['"]react-dom['"]/);
  });

  it('exports clampOverride and applyOverride', () => {
    expect(src).toMatch(/export\s+function\s+clampOverride/);
    expect(src).toMatch(/export\s+function\s+applyOverride/);
  });
});
```
The `readFileSync` + regex-grep pattern is the canonical project contract for architecture-by-file-content — lives in both core specs and `tests/arch.spec.ts`. Keep using it.

**Anti-patterns to avoid:**
- Do NOT import from `@esotericsoftware/spine-core` in this spec. `overrides.ts` is primitive-only; the spec is too. No `primedSkeleton()`, no `loadSkeleton()`.
- Do NOT write the spec in `tests/renderer/` — it's a pure-core spec. Goes in `tests/core/`.
- Do NOT assert on `toFixed(3)` string formatting in this spec. Label formatting happens in the renderer (or in `analyzer.ts` if planner picks discretion option B). `overrides.ts` returns raw numbers.

---

### 4. `src/renderer/src/components/AppShell.tsx` (TOUCH, shell / state container)

**Analog:** itself — the existing `activeTab` + `focusAnimationName` + `onJumpToAnimation`/`onFocusConsumed` pattern at lines 36-48 is the exact template for the three new callbacks.

**Existing state pattern** (lines 37-48):
```typescript
// D-50: plain useState; default 'global' on every mount (i.e. every new drop).
const [activeTab, setActiveTab] = useState<ActiveTab>('global');
// D-52: jump-target; null means no pending focus.
const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

const onJumpToAnimation = useCallback((name: string) => {
  setActiveTab('animation');
  setFocusAnimationName(name);
}, []);

const onFocusConsumed = useCallback(() => {
  setFocusAnimationName(null);
}, []);
```
Mirror exactly for overrides. Add three new state groups alongside these:
```typescript
// D-74: plain useState; resets on every mount (i.e. every new drop).
const [overrides, setOverrides] = useState<Map<string, number>>(new Map());
// D-77 dialog lifecycle — null means dialog closed.
const [dialogState, setDialogState] = useState<{
  scope: string[];
  currentPercent: number;
  anyOverridden: boolean;
} | null>(null);

const onOpenOverrideDialog = useCallback(
  (row: DisplayRow | BreakdownRow, selectedKeys?: Set<string>) => {
    const inSelection =
      selectedKeys?.has(row.attachmentName) && selectedKeys.size > 1;
    const scope = inSelection ? [...selectedKeys!] : [row.attachmentName];
    // ...
  },
  [overrides],
);
```
The full seed lives at 04-CONTEXT.md lines 342-380; it's structurally correct. Note `onOpenOverrideDialog`'s dependency on `overrides` is load-bearing (reads current values to compute `currentPercent` + `anyOverridden`); `onApplyOverride` and `onClearOverride` use the functional `setOverrides((prev) => ...)` form and have empty dep arrays.

**Prop-threading pattern** (lines 73-87):
```tsx
<main className="flex-1 overflow-auto">
  {activeTab === 'global' && (
    <GlobalMaxRenderPanel
      summary={summary}
      onJumpToAnimation={onJumpToAnimation}
    />
  )}
  {activeTab === 'animation' && (
    <AnimationBreakdownPanel
      summary={summary}
      focusAnimationName={focusAnimationName}
      onFocusConsumed={onFocusConsumed}
    />
  )}
</main>
```
Add `overrides={overrides}` + `onOpenOverrideDialog={onOpenOverrideDialog}` to BOTH panel renders. Render the `<OverrideDialog>` below `<main>` as a conditional:
```tsx
{dialogState !== null && (
  <OverrideDialog
    open={true}
    scope={dialogState.scope}
    currentPercent={dialogState.currentPercent}
    anyOverridden={dialogState.anyOverridden}
    onApply={(percent) => onApplyOverride(dialogState.scope, percent)}
    onClear={() => onClearOverride(dialogState.scope)}
    onCancel={() => setDialogState(null)}
  />
)}
```
Dialog lives OUTSIDE the tab-switch so it persists when the user triggers a dialog open via double-click on Global and then (somehow) the tab flips — but in practice dialog is always closed by Apply / Cancel / ESC before a tab change. The AppShell mounting scope is correct: both panels can open the same dialog state.

**Reset on new drop** (implicit via component remount — AppShell unmounts when `AppState` transitions through idle/loading; D-74 matches D-50's rationale). No explicit `useEffect(() => setOverrides(new Map()), [])` needed — the map state is born empty on each mount.

**Imports to add** (current lines 23-27):
```typescript
import { useCallback, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import type { SkeletonSummary } from '../../../shared/types.js';
```
Add:
- `DisplayRow` + `BreakdownRow` from `../../../shared/types.js` (needed in `onOpenOverrideDialog` param type).
- `OverrideDialog` from `../modals/OverrideDialog`.
- `clampOverride` from... **WAIT — Layer 3 violation risk:** AppShell is `src/renderer/`; `clampOverride` is in `src/core/`. The `tests/arch.spec.ts` grep at lines 24-28 will FAIL on any `from '/core/'` import in `src/renderer/`. See Shared Patterns §Layer 3 for the resolution.

**Anti-patterns to avoid:**
- Do NOT replace the `Map<string, number>` with a `Record<string, number>` — the `Map` is the established data structure per D-73 + D-74 + D-76 (the `.has(name)` / `.delete(name)` / `.set(name, value)` API is exactly what AppShell uses).
- Do NOT move overrides state down into the panels — AppShell is the closest common ancestor; panel-level state wouldn't cross-render between Global and Animation Breakdown.
- Do NOT `useContext` or a Provider — D-74 reaffirms D-32 (plain useState, no Context).

---

### 5. `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (TOUCH, table-panel)

**Analog:** itself — the existing Scale cell render at line 212 + the `suppressNextChangeRef` click/change coordination at lines 161-189 + the existing per-row `Row` component structure lines 161-232.

**Existing Scale cell** (line 212):
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">{row.scaleLabel}</td>
```
Target shape (per 04-CONTEXT.md lines 385-399 + D-82/D-83/D-85):
```tsx
<td
  className={clsx(
    'py-2 px-3 font-mono text-sm text-right',
    override != null ? 'text-accent' : 'text-fg',
  )}
  onDoubleClick={() => onOpenOverrideDialog(row, selected)}
  title={
    override != null
      ? `Peak ${row.scaleLabel} × ${override}% = ${effectiveLabel}`
      : undefined
  }
>
  {effectiveLabel}
  {override != null && <span> • {override}%</span>}
</td>
```
Where `override = overrides.get(row.attachmentName)`, `effectiveScale = override != null ? applyOverride(row.peakScale, override).effectiveScale : row.peakScale`, `effectiveLabel = effectiveScale.toFixed(3) + '×'`.

**Peak W×H cell — D-83 same treatment** (line 211):
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">{row.peakSizeLabel}</td>
```
Becomes:
```tsx
<td className={clsx(
  'py-2 px-3 font-mono text-sm text-right',
  override != null ? 'text-accent' : 'text-fg',
)}>
  {override != null
    ? `${Math.round(row.worldW * (override / 100))}×${Math.round(row.worldH * (override / 100))}`
    : row.peakSizeLabel}
</td>
```
Reuse the `toFixed(0)` convention from `analyzer.ts` line 85 (`${p.worldW.toFixed(0)}×${p.worldH.toFixed(0)}`) — keep visual consistency. Actually — prefer `(row.worldW * override / 100).toFixed(0)` for arithmetic identity with the existing non-override format.

**`suppressNextChangeRef` + double-click compatibility** (lines 161-189, 288-289) — CRITICAL:
```typescript
// W-01 shift-click suppression flag: when the label onClick sees shiftKey and
// runs range-select, it writes the clicked row's key here; the subsequent
// native onChange on that input reads the flag and returns early so the
// single-toggle does not undo the range state.
const suppressNextChangeRef = useRef<string | null>(null);
```
The `onDoubleClick` on the Scale `<td>` fires INDEPENDENTLY of the checkbox's click/change chain. Browsers emit `dblclick` after two `click` events on the same element within ~500ms; but the Scale `<td>` is a SIBLING of the checkbox `<td>`, not a descendant. So:
- Clicking the checkbox `<td>`: fires `label.onClick` → shift-check → `input.onChange` → suppress-or-toggle. The Scale cell's `onDoubleClick` is NOT triggered.
- Double-clicking the Scale `<td>`: fires two `click` events on the Scale `<td>` + then `dblclick`. None of those bubble into the checkbox `<td>`. `suppressNextChangeRef` is not touched.

**Net: no conflict.** Double-click on Scale is fully orthogonal to the Phase 2 shift-click path. The risk D-91 flags is real but defused by the sibling-cell layout (table cells don't share event context). Planner can add a test that double-clicks while holding Shift to confirm; expected behavior: dialog opens, selection unchanged (because the double-click target isn't the checkbox).

**BUT — one subtlety:** Browsers fire `click` twice before `dblclick`. If future planners ever attach `onClick` to the Scale `<td>`, those clicks will fire before the dialog opens. Currently there is no `onClick` on the Scale `<td>` — keep it that way. `onDoubleClick` only.

**Row component prop extension** (lines 150-160):
```typescript
interface RowProps {
  row: DisplayRow;
  query: string;
  checked: boolean;
  onToggle: (key: string) => void;
  onRangeToggle: (key: string) => void;
  suppressNextChangeRef: MutableRefObject<string | null>;
  onJumpToAnimation?: (animationName: string) => void;
}
```
Add:
```typescript
override: number | undefined;   // overrides.get(row.attachmentName)
onOpenOverrideDialog: (row: DisplayRow, selectedKeys: Set<string>) => void;
selectedKeys: ReadonlySet<string>; // pass-through for batch detection
```
At the main-component level (line 274-298) pass `override={overrides.get(row.attachmentName)}` per row — this forces re-render of affected rows when overrides change; `React.memo` is NOT used in this panel, so the whole tbody re-renders on any overrides change anyway (fine for <200 rows).

**Sort comparator update** (lines 65-82) — 04-CONTEXT.md line 132 flags the D-29 interplay:
> overrides don't change sort default; however the sort COMPARATOR reads the EFFECTIVE scale (peak × override/100 if overridden).

Update `compareRows`:
```typescript
case 'peakScale': {
  const aEff = aOverride != null ? a.peakScale * aOverride / 100 : a.peakScale;
  const bEff = bOverride != null ? b.peakScale * bOverride / 100 : b.peakScale;
  return aEff - bEff;
}
```
This requires passing `overrides` INTO `sortRows` / `compareRows`. Alternatively: derive an `effectiveRows: DisplayRow & { effectiveScale: number }[]` before the sort+filter chain (via `useMemo` on `[filtered, overrides]`) and let the existing comparator read `.effectiveScale`. Planner picks — the derived-row approach is cleaner.

**Anti-patterns to avoid:**
- Do NOT add `onClick` on the Scale `<td>` — the double-click event is the ONLY trigger per D-77. A bare click would fire twice during any double-click attempt.
- Do NOT memoize `Row` with `React.memo` just because the panel now has more props. Phase 2 deliberately didn't memoize (it works fine for <200 rows); a memo-wrap would require custom prop comparisons for the `overrides` map reference.
- Do NOT import from `src/core/*` — see Shared Patterns §Layer 3.

---

### 6. `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (TOUCH, collapsible-cards panel)

**Analog 1:** itself — the Phase 3 D-69 disabled Override button at lines 417-430.

**Analog 2:** the Scale cell at line 408 (symmetric to the Global panel treatment).

**D-69 Override button unlock** (lines 417-430):
```tsx
{/* D-69: Override button rendered disabled to reserve Column 7
    real estate. Phase 4 wires the dialog; removing `disabled`
    plus attaching an onClick is the only mechanical change
    Phase 4 needs to make. */}
<button
  type="button"
  disabled
  title="Coming in Phase 4"
  aria-label="Override Scale (disabled until Phase 4)"
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg opacity-50 cursor-not-allowed focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
>
  Override Scale
</button>
```
Target (per D-77 + Claude's Discretion on chip style lines 90-91 of 04-CONTEXT.md):
```tsx
<button
  type="button"
  onClick={() => onOpenOverrideDialog(row)}
  aria-label={`Override scale for ${row.attachmentName}`}
  className="inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono text-fg hover:bg-accent/10 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
>
  Override Scale
</button>
```
Mechanical diff: remove `disabled`, remove `title="Coming in Phase 4"`, remove `opacity-50 cursor-not-allowed`, update `aria-label`, add `onClick`, add `hover:bg-accent/10` (mirrors the Global panel's Source Animation button at line 219 — same chip-style affordance treatment). Chip styling is KEPT per the discretion recommendation.

**Scale cell double-click** (line 407-409):
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">
  {row.scaleLabel}
</td>
```
Same treatment as Global panel (see file 5 above): wrap with override-aware className, add `onDoubleClick={() => onOpenOverrideDialog(row)}` (no selectedKeys — D-90 no batch on this panel), add `title` with override math, render effective label + badge span. No selection interaction here — pass `undefined` for the batch param, or omit it entirely (AppShell defaults to per-row when selectedKeys is absent).

**Peak W×H cell update** (line 410-412): same as Global panel file 5 — override-aware coloring + effective dims.

**BreakdownTable component prop extension** (lines 335-338):
```typescript
interface BreakdownTableProps {
  rows: readonly BreakdownRow[];
  query: string;
}
```
Add `overrides: ReadonlyMap<string, number>` + `onOpenOverrideDialog: (row: BreakdownRow) => void`. Thread from `AnimationBreakdownPanel` props (add there too) down through `AnimationCard` (which just needs to pass through — it doesn't render cells itself) into `BreakdownTable`.

**Anti-patterns to avoid:**
- Do NOT add a selection column to this panel (D-90). If the planner is tempted to mirror Global's batch UX, stop. Animation Breakdown is per-row ONLY.
- Do NOT change the 7-column header layout at lines 343-388. D-57 locks it.
- Do NOT drop the chip styling — the discretion note at 04-CONTEXT.md line 90 explicitly recommends keeping it. Only remove the DIMMING (`opacity-50`), not the entire class string.

---

### 7. `src/shared/types.ts` (TOUCH, shared types — discretion choice)

**Analog:** existing `DisplayRow` (lines 30-51) + `BreakdownRow` (lines 69-74) shapes.

**Claude's Discretion (04-CONTEXT.md lines 81-84):** Two options.

**Option A (recommended — keeps core oblivious):** No changes to `types.ts`. Override-derived fields (`effectiveScale`, `overrideLabel`, `effectivePeakW`, `effectivePeakH`) are computed renderer-side via a `useMemo((rows, overrides) => ...)` selector in each panel. `src/core/analyzer.ts` stays byte-identical. This is the boundary-clean choice per CLAUDE.md #5 intent.

**Option B (only if planner has a strong reason):** Extend `DisplayRow` + `BreakdownRow` with optional fields:
```typescript
export interface DisplayRow {
  // ... existing 20 fields ...
  /** Phase 4 D-82: set only when overrides.has(attachmentName). */
  overridePercent?: number;
  /** Phase 4 D-82: peakScale × overridePercent / 100. */
  effectiveScale?: number;
  /** Phase 4 D-82 preformatted label: "0.890× • 50%" or "1.780×" (no-override). */
  overrideLabel?: string;
}
```
Plus an `OverrideRecord` shape for the map:
```typescript
export interface OverrideRecord {
  /** Map of attachmentName → clamped integer percent [1, 100]. */
  percents: ReadonlyMap<string, number>;
}
```
Option B couples `analyzer.ts` to overrides (takes a second arg; emits enriched rows). Probably worse unless Phase 6 export benefits from it.

**Existing preformatted-label convention** (lines 46-50):
```typescript
originalSizeLabel: string;
peakSizeLabel: string;
scaleLabel: string;
sourceLabel: string;
frameLabel: string;
```
These were the D-35 "preformatted labels, single point of truth" concession. Option B would extend this pattern; Option A would leave it alone and the renderer's selector becomes the formatter for override-enriched labels.

**Planner decision criteria:**
- Pick A if: the renderer selector is <30 lines per panel and readability is fine.
- Pick B if: Phase 6 export would duplicate the same `applyOverride()` call and pre-enriched rows materially reduce that duplication. (Unlikely — Phase 6 works on raw peakScale + overrides map directly per CONTEXT line 113.)

**Anti-patterns to avoid:**
- Do NOT add REQUIRED override fields (always-set). That breaks byte-for-byte CLI parity since the CLI path doesn't know about overrides.
- Do NOT add an override field to `SkeletonSummary` itself (e.g., `summary.overrides`). Overrides are renderer-owned session state; they never cross IPC in Phase 4. (Phase 8 will change this.)

---

## Shared Patterns

### Layer 3 (core/ ↛ renderer/) — CRITICAL for AppShell + Panels

**Source:** `tests/arch.spec.ts` lines 19-34. The grep regex is `from ['"][^'"]*\/core\/|from ['"]@core`.

**The constraint:** NO file under `src/renderer/` may contain an import from `src/core/*`. This means AppShell CANNOT import `clampOverride` or `applyOverride` directly from `src/core/overrides.ts`.

**Existing precedent — what do the panels do today?** Today, nothing in `src/renderer/` computes anything from core — `analyzer.ts` runs in the main process (`src/main/summary.ts` calls it), and results cross IPC as the fully preformatted `DisplayRow[]` / `BreakdownRow[]`. The renderer never computes scale math.

**Phase 4's new problem:** `onApplyOverride` in AppShell needs to `clampOverride(percent)` before storing. The Scale cell's `onDoubleClick` handler + the Peak W×H cell both need `applyOverride(peakScale, percent)` at render time.

**Three resolution paths — pick one in the plan:**

1. **Inline the math.** `clampOverride` is 6 lines; `applyOverride` is 4. Duplicate both into AppShell (for clamp-on-apply) and into a renderer-side `src/renderer/src/lib/overrides-view.ts` (for render-time effective-scale computation). Add grep-assertions in tests that both copies match `src/core/overrides.ts` byte-for-byte. **Downside:** duplication. **Upside:** arch.spec.ts passes without changes.

2. **Loosen Layer 3 to explicitly allow `src/core/overrides.ts`** with a whitelist. `tests/arch.spec.ts` regex becomes `from ['"][^'"]*\/core\/(?!overrides)` (negative lookahead). **Downside:** carves a hole in the architectural defense for a single module. **Upside:** the `core/` single-source-of-truth stays intact. This is a DECISION for the planner to escalate if taken — it alters a locked Phase 1/2/3 invariant.

3. **Move `overrides.ts` to `src/shared/overrides.ts`.** `shared/` is already importable by renderer (via `shared/types.ts`). **Downside:** violates CLAUDE.md #5's "core/ is pure TS" aesthetic inversion (shared isn't documented as the math home). **Upside:** one move, no regex changes, no duplication.

**Planner recommendation:** Start with option 1 (inline). If the duplication feels egregious to the planner after writing, escalate option 2 with a one-line note to the user — loosening arch.spec.ts is a one-line regex change but it's a LOCKED invariant so it demands explicit user consent.

**04-CONTEXT.md alignment:** The CONTEXT file is silent on this specific tension. The seed sketches at lines 342-399 casually reference `clampOverride` + `applyOverride` in both AppShell and the Scale cell without calling out the Layer 3 constraint. **The planner MUST surface this in the plan doc.**

---

### Tailwind `@theme` token usage

**Source:** `src/renderer/src/index.css` lines 46-62.

**Available tokens** (every one needed for Phase 4 is already defined; no new tokens required):
```css
--color-surface:   var(--color-stone-950);   /* app background */
--color-panel:     var(--color-stone-900);   /* drop zone + debug panel + dialog body */
--color-border:    var(--color-stone-800);   /* separators, borders */
--color-fg:        var(--color-stone-100);   /* primary text */
--color-fg-muted:  var(--color-stone-400);   /* secondary text, helper text */
--color-accent:        var(--color-orange-500);   /* override badge, active state, ring */
--color-accent-muted:  var(--color-orange-300);   /* inline error text */
--font-sans: ui-sans-serif, ...
--font-mono: "JetBrains Mono", ...
```

**Utility-class patterns these emit** (names used across all analogs):
- Dialog container: `bg-panel border border-border rounded-md`
- Dialog overlay: `fixed inset-0 z-50 flex items-center justify-center bg-black/40`
- Input focus ring: `focus:outline-none focus:ring-2 focus:ring-accent` (SearchBar line 56)
- Badge color: `text-accent` + `font-mono`
- Chip-style button: `border border-border rounded-md px-2 py-0.5 text-xs font-mono` (AnimationBreakdownPanel line 426 pre-opacity)
- Primary button: `bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold`
- Helper text: `text-fg-muted text-xs`
- Hover on interactive chip: `hover:bg-accent/10` (GlobalMaxRenderPanel line 219)
- Hover on table row: `hover:bg-accent/5` (line 192)

**Literal-class discipline** (DropZone line 109-116, SearchBar line 19-22, AppShell lines 18-22):
- EVERY className is a literal string OR a `clsx()` with literal branches.
- NEVER `className={`text-${color}`}` or `className={'px-' + padding}`.
- Tailwind v4's scanner extracts class literals at build time; template interpolation breaks it silently.

**Two-weight typography** (AppShell lines 96-97, AnimationBreakdownPanel lines 47-49):
- Only font-normal (400) and font-semibold (600) exist in the design system.
- Weight 500 is FORBIDDEN. Apply weight 400 (default or `font-normal`) to body / input text; weight 600 (`font-semibold`) to primary buttons, active tabs, card headers.

---

### `useCallback` + prop-threading

**Source:** `AppShell.tsx` lines 41-48 (AppShell → panels) + `GlobalMaxRenderPanel.tsx` lines 300-360 + `AnimationBreakdownPanel.tsx` lines 181-188.

**Convention:** Every callback that crosses a component boundary is wrapped in `useCallback`. Dep arrays list only the state/props the callback closes over. Empty dep arrays for callbacks that only use `setState` functional form (`setX((prev) => ...)`).

**Example — AppShell's existing pattern** (lines 41-48):
```typescript
const onJumpToAnimation = useCallback((name: string) => {
  setActiveTab('animation');
  setFocusAnimationName(name);
}, []);

const onFocusConsumed = useCallback(() => {
  setFocusAnimationName(null);
}, []);
```
Both have empty deps because they only call setState. Phase 4's `onApplyOverride` + `onClearOverride` follow this exactly; `onOpenOverrideDialog` has `[overrides]` dep because it reads current map values for `currentPercent` / `anyOverridden`.

**Panel-internal callbacks** (GlobalMaxRenderPanel lines 313-322):
```typescript
const handleToggleRow = useCallback(
  (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    setLastClicked(key);
  },
  [selected],
);
```
When panel-internal callbacks build on `overrides` + dialog open, prefer passing the AppShell-level callbacks straight through (don't wrap each panel's proxy in a new useCallback — just pass the prop through).

**Depth: two levels.** AppShell → Panel → Row. The Row sub-component in GlobalMaxRenderPanel takes its props directly (lines 161-189 don't re-wrap). Same for BreakdownTable in AnimationBreakdownPanel (line 325 passes straight through from AnimationCard → BreakdownTable). Keep this — no unnecessary wrapping.

---

### vitest pure-TS spec structure

**Source:** `tests/core/bones.spec.ts` (82 lines, smallest existing core spec) + `tests/core/bounds.spec.ts` hygiene block (lines 267-298).

**Three-section layout:**
1. **Behavior gates** — `describe('<exported function name> (D-# / F-#)', () => { ... it(...) ... })`. One describe per exported function. One `it(...)` per concrete assertion case.
2. **Cross-check assertions** (if applicable) — for functions that can be verified against a known-good path. `overrides.ts` doesn't need this (pure arithmetic).
3. **Module hygiene** — `describe('<module> — module hygiene (N2.3 by construction)', () => { ... })` with `readFileSync` + regex asserts for forbidden imports and export presence.

**Assertion style:**
- `expect(value).toBe(expected)` for exact equality on integers / strings / booleans.
- `expect(value).toBeCloseTo(expected, 5)` for floating-point (5 decimals is the project standard — bounds.spec.ts line 68, 226).
- `expect(src).toMatch(/regex/)` / `.not.toMatch(/regex/)` for module-content greps.

**Test-file naming:** `tests/core/<module-basename>.spec.ts`. So `tests/core/overrides.spec.ts`.

**Per CLAUDE.md Commands section:** `npm run test` runs all. Phase 3 closed at 70+ specs + 1 skip; Phase 4 planner targets 75+.

---

## Event-Propagation Compatibility Notes (D-91)

04-CONTEXT.md lines 90-91 (Claude's Discretion) flags the concern; the audit below confirms compatibility.

### Scale-cell `onDoubleClick` vs Phase 2 checkbox click chain

**Phase 2 click chain** (GlobalMaxRenderPanel lines 161-189, `suppressNextChangeRef` on line 288):
```
User shift-clicks checkbox cell (<td> containing <label><input type="checkbox">):
  1. mousedown on label
  2. click on label → handleLabelClick(e) → if e.shiftKey, set suppressNextChangeRef = row.attachmentKey, run onRangeToggle
  3. click bubbles to input → fires onChange (synthetic from label-to-input focus)
  4. handleChange: reads suppressNextChangeRef, if matches key, skip single-toggle; else run onToggle

User double-clicks checkbox cell:
  1. first click: same as above single-click (step 1-4)
  2. second click: same as above single-click (step 1-4) — selection state flips TWICE, net zero
  3. dblclick fires on label — currently unhandled, no-op
```

**Phase 4 addition — Scale cell** (adjacent sibling `<td>` at line 212):
```
User double-clicks Scale cell:
  1. first click on <td> — no handler attached, bubbles to <tr>, <tbody>, etc. No suppression flag touched. Selection unchanged.
  2. second click on <td> — same as above.
  3. dblclick on <td> → onDoubleClick(e) → onOpenOverrideDialog(row, selected)

User shift-double-clicks Scale cell:
  1. first click on <td> — shiftKey=true, no handler, no selection change (Scale cell has no shift handler).
  2. second click — same.
  3. dblclick on <td> — dialog opens. Selection state unchanged.
```

**Net: no interaction.** Scale `<td>` and checkbox `<td>` are sibling cells in the same `<tr>`; events on one don't reach handlers on the other. `suppressNextChangeRef` is ONLY read by the checkbox's `handleChange` and ONLY written by the checkbox's `handleLabelClick`. Double-click on Scale touches neither.

**One edge case to test** (planner should add a test): the `onDoubleClick` handler calls `onOpenOverrideDialog(row, selected)`. `selected` is the live Phase 2 selection `Set<string>`. If the user has 3 rows selected INCLUDING the Scale cell's row, D-86 opens batch mode. If the user has 3 rows selected but the Scale cell's row is NOT among them, D-87 opens single-row mode. The passed `selected` set does not need to be filtered by the panel — AppShell's `onOpenOverrideDialog` logic (seed sketch line 353) does the `.has(row.attachmentName) && size > 1` check.

**Two additional propagation-safety checks:**
- The Source Animation chip at GlobalMaxRenderPanel line 215 uses `onClick` (not double-click). No collision — different event types.
- The Override Scale button at AnimationBreakdownPanel line 421 (post-unlock) uses `onClick`. The adjacent Scale cell's `onDoubleClick` does not interfere — the button is in a different `<td>`.

---

## No Analog Found

None. All 7 files have at least a role-close match in the existing codebase.

Closest thing to "no analog": `src/renderer/src/modals/OverrideDialog.tsx` — no existing modals live in the project, so the analog is composed from two pieces (SearchBar + DropZone). This is still strong — both pieces handle the exact mechanics needed (controlled input, keyboard handling, overlay, hand-rolled discipline).

---

## Metadata

**Analog search scope:**
- `src/core/` (7 files) — for overrides.ts analog
- `src/renderer/src/components/` (3 files) — for OverrideDialog.tsx analog
- `src/renderer/src/panels/` (2 files) — for panel touch patterns
- `src/shared/` (1 file) — for types extension
- `tests/core/` (7 files) — for spec pattern
- `tests/arch.spec.ts` — for Layer 3 regex

**Files scanned in detail:** 9 (analyzer, AppShell, SearchBar, DropZone, GlobalMaxRenderPanel, AnimationBreakdownPanel, bones.spec, bounds.spec, arch.spec, index.css, types).

**Pattern extraction date:** 2026-04-24.

**Grep / glob operations:** 2 (list dirs; wc -l).

**Read operations:** 9 (all non-overlapping full-file reads on files <500 lines).
