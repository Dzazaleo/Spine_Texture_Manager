---
name: Phase 2 — Global Max Render Source Panel — Pattern Map
description: Per-file pattern assignments that map Phase 2 deliverables to their closest existing codebase analogs. Planner-consumed.
phase: 2
---

# Phase 2: Global Max Render Source Panel — Pattern Map

**Mapped:** 2026-04-23
**Files analyzed:** 10 (5 new, 4 modified, 1 deleted)
**Analogs found:** 10 / 10 (all files have a strong in-repo analog)
**Project skills scanned:** none (`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.claude/skills/` and `.agents/skills/` both absent — CLAUDE.md rules #1–#6 serve that role instead)

---

## File Classification

| New/Modified/Deleted File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/core/analyzer.ts` | core pure-TS module (fold + format) | transform: `Map<string, PeakRecord>` → `DisplayRow[]` | `src/main/summary.ts` (fold lines 55–77) + `src/core/sampler.ts` (core-module shape) | exact (logic is lifted from summary.ts) |
| `src/shared/types.ts` (modify) | IPC type module | none (types erase at compile-time) | existing `PeakRecordSerializable` in same file, lines 24–46 | exact — same file, same interface pattern |
| `src/main/summary.ts` (modify) | main-process projection thunk | IPC writer: `LoadResult` + `peaks Map` → `SkeletonSummary` | current `buildSummary` at lines 26–99 (refactor its body) | exact — same file, shrinks by ~25 lines |
| `src/renderer/panels/GlobalMaxRenderPanel.tsx` | renderer panel composition | IPC reader: `SkeletonSummary` prop → sorted/filtered/selected `<table>` | `src/renderer/src/components/DebugPanel.tsx` (shape) + `src/renderer/src/components/DropZone.tsx` (hooks + Tailwind literal pattern) | role-match (DebugPanel is the same-prop-shape predecessor) |
| `src/renderer/src/components/SearchBar.tsx` | reusable controlled-input component | event: `value: string → onChange` | `src/renderer/src/components/DropZone.tsx` (hook-callback, clsx, Tailwind-literal discipline) | role-match (closest reusable input/control component in repo) |
| `src/renderer/src/App.tsx` (modify) | top-level state machine wiring | render-branch swap | existing `App.tsx` lines 22, 69 (import + render site — the only two-line diff) | exact — same file |
| `scripts/cli.ts` (modify) | CLI entry | transform: analyzer output → stdout table | current `renderTable` at lines 77–126 (delegate fold to analyzer, keep padding/widths) | exact — same file |
| `src/renderer/src/components/DebugPanel.tsx` (DELETE) | obsolete after swap | — | Phase 1 D-16 ("replaced by GlobalMaxRenderPanel") | N/A — deletion |
| `tests/core/analyzer.spec.ts` (new) | vitest golden suite for pure-core module | — | `tests/core/summary.spec.ts` + `tests/core/loader.spec.ts` | exact — both test pure modules from the fixture |
| `tests/renderer/GlobalMaxRenderPanel.spec.ts*` / `SearchBar.spec.ts*` (new — planner's call per D-32 tail) | renderer DOM tests | — | **no analog in repo** — all current tests are Node-only vitest | **no analog** (see §No Analog Found) |

---

## Pattern Assignments

### 1. `src/core/analyzer.ts` — NEW — core pure-TS module (fold + format)

**Primary analog:** `src/main/summary.ts` lines 55–77 (the exact fold + sort to lift)
**Secondary analog:** `src/core/sampler.ts` lines 1–90 (core-module header + import style + export discipline)

#### Imports pattern (mirror `src/core/sampler.ts` lines 47–54 for type-only imports from sibling core files, no external deps)

```typescript
/**
 * Phase 2 — Per-attachment fold + preformat.
 *
 * Takes the sampler's `Map<string, PeakRecord>` and emits `DisplayRow[]` —
 * raw numbers (for sort + selection) paired with preformatted labels
 * (for renderer cells, one derivation, tested once).
 *
 * Pure, stateless, zero-I/O. Follows CLAUDE.md #5 (core/ is DOM-free).
 * Caller is src/main/summary.ts (IPC writer) and scripts/cli.ts (CLI).
 * ...
 */
import type { PeakRecord } from './sampler.js';
import type { DisplayRow } from '../shared/types.js';
```

Note: the existing `summary.ts` (line 24) already imports `PeakRecordSerializable` from `../shared/types.js` — crossing from main → shared is allowed. Core → shared is also allowed per the three-layer defense (arch.spec.ts only forbids `renderer → core`). Planner: confirm by re-reading arch.spec.ts if escalating.

#### Core fold + sort pattern — LIFTED verbatim from `src/main/summary.ts` lines 55–77

Current code (to move):

```typescript
// src/main/summary.ts:55–77 (CURRENT — moves to analyzer.ts)
const peaksArray: PeakRecordSerializable[] = [...peaks.values()]
  .map((p) => ({
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    slotName: p.slotName,
    attachmentName: p.attachmentName,
    animationName: p.animationName,
    time: p.time,
    frame: p.frame,
    peakScaleX: p.peakScaleX,
    peakScaleY: p.peakScaleY,
    peakScale: p.peakScale,
    worldW: p.worldW,
    worldH: p.worldH,
    sourceW: p.sourceW,
    sourceH: p.sourceH,
    isSetupPosePeak: p.isSetupPosePeak,
  }))
  .sort((a, b) => {
    if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
    if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
    return a.attachmentName.localeCompare(b.attachmentName);
  });
```

After refactor, the analyzer adds the D-35 preformatted labels after the raw copy:

```typescript
// src/core/analyzer.ts — NEW (additive on top of the lifted fold)
function toDisplayRow(p: PeakRecord): DisplayRow {
  return {
    // raw (lifted from summary.ts fold)
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    slotName: p.slotName,
    attachmentName: p.attachmentName,
    animationName: p.animationName,
    time: p.time,
    frame: p.frame,
    peakScaleX: p.peakScaleX,
    peakScaleY: p.peakScaleY,
    peakScale: p.peakScale,
    worldW: p.worldW,
    worldH: p.worldH,
    sourceW: p.sourceW,
    sourceH: p.sourceH,
    isSetupPosePeak: p.isSetupPosePeak,
    // preformatted (D-35, D-45, D-46) — single point of truth
    originalSizeLabel: `${p.sourceW}×${p.sourceH}`,
    peakSizeLabel: `${p.worldW.toFixed(0)}×${p.worldH.toFixed(0)}`,
    scaleLabel: `${p.peakScale.toFixed(3)}×`,
    sourceLabel: p.animationName, // already "Setup Pose (Default)" or anim name
    frameLabel: String(p.frame),
  };
}

export function analyze(peaks: Map<string, PeakRecord>): DisplayRow[] {
  return [...peaks.values()]
    .map(toDisplayRow)
    .sort(byCliContract);
}

function byCliContract(a: DisplayRow, b: DisplayRow): number {
  if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
  if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
  return a.attachmentName.localeCompare(b.attachmentName);
}
```

**Grep-literal-comments warning (from CONTEXT.md "Established Patterns"):** planner should NOT cite literal strings like `Setup Pose (Default)` or `×` inside analyzer.ts comments if any acceptance gate is a `grep -q "literal"` — use prose. The `'Setup Pose (Default)'` label is a value copy from `sampler.ts:72` (`SETUP_POSE_LABEL`), not a new literal.

**Unicode multiplication sign:** `src/renderer/src/components/DebugPanel.tsx:50, 62` and `scripts/cli.ts:82, 99` both use the literal `×` character. D-46 locks this on U+00D7. The analog uses the literal glyph in source; plan may prefer `×` escapes if any acceptance gate grep-filters the ASCII `x` character.

#### Error handling

Analyzer is pure over in-memory data; no error handling beyond what TypeScript's type system gives. Follows the `bounds.ts` / `sampler.ts` convention: defensive `continue`s are preserved in the caller (sampler), not duplicated here.

#### Hot-loop I/O discipline (N2.3)

Must not import from `node:fs`, `node:path`, `node:child_process`, `node:net`, `node:http`, `sharp`, or any PNG decode library. `tests/arch.spec.ts` does not yet grep-enforce this for analyzer.ts specifically — it inherits via `sampler.spec.ts` hygiene tests (see `tests/core/sampler.spec.ts` lines 22–24). **Planner recommendation:** extend the sampler.spec.ts source-grep hygiene test to also scan `src/core/analyzer.ts` for `node:` / `sharp` / `fs` imports, or add equivalent assertions inside `tests/core/analyzer.spec.ts`.

---

### 2. `src/shared/types.ts` — MODIFY — add `DisplayRow`, remove/retain `PeakRecordSerializable`

**Primary analog:** the existing `PeakRecordSerializable` interface in the same file, lines 19–46.

Current shape (the template `DisplayRow` extends + reformats):

```typescript
// src/shared/types.ts:19–46 (CURRENT)
/**
 * Flat, serializable mirror of `PeakRecord` from `src/core/sampler.ts`.
 * Every field is a primitive — safe to `structuredClone` across IPC.
 * Field set must stay byte-for-byte identical to PeakRecord minus class internals.
 */
export interface PeakRecordSerializable {
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  animationName: string;
  time: number;
  frame: number;
  peakScaleX: number;
  peakScaleY: number;
  peakScale: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
  isSetupPosePeak: boolean;
}
```

And the summary consumer (same file, line 64):

```typescript
// src/shared/types.ts:64 (CURRENT)
/** Sorted by (skinName, slotName, attachmentName) — matches CLI byte-for-byte. */
peaks: PeakRecordSerializable[];
```

**Change pattern (D-35):** add `DisplayRow` (superset of `PeakRecordSerializable` with 5 added `*Label` fields), flip `SkeletonSummary.peaks` to `DisplayRow[]`, and **delete** `PeakRecordSerializable` — per CONTEXT.md §"Integration Points" ("`DisplayRow` is structuredClone-safe (primitives + strings; no classes, no Map, no Float32Array)") and CONTEXT.md §Phase Boundary ("remove `PeakRecordSerializable`"). Keep the JSDoc lock comment — it still applies to `DisplayRow`.

**Comment header template to keep verbatim:** lines 1–17 (the structuredClone-safety + "flatten classes in summary.ts" paragraph) stay. The Api interface at lines 91–103 is unchanged.

---

### 3. `src/main/summary.ts` — MODIFY — delegate fold to analyzer

**Primary analog:** current `buildSummary` at lines 26–99 (same file, shrinks).

Current shape (keep header + skeleton projection lines 39–50, 79–98; delete lines 52–77 and replace with one call to `analyze`):

```typescript
// src/main/summary.ts:26–50 (KEEP — skeleton header projection)
export function buildSummary(
  load: LoadResult,
  peaks: Map<string, PeakRecord>,
  elapsedMs: number,
): SkeletonSummary {
  const { skeletonData } = load;

  // Count attachments across skins + bucket by spine-core class name.
  const byType: Record<string, number> = {};
  let attachmentCount = 0;
  for (const skin of skeletonData.skins) {
    for (const attachmentsPerSlot of skin.attachments) {
      if (attachmentsPerSlot === undefined || attachmentsPerSlot === null) continue;
      for (const attachment of Object.values(attachmentsPerSlot)) {
        attachmentCount++;
        const type = attachment.constructor.name;
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }
```

After refactor (the fold lines 55–77 collapse to one call):

```typescript
// src/main/summary.ts — AFTER (replace lines 52–77 with one call)
import { analyze } from '../core/analyzer.js';
// ...
const peaksArray = analyze(peaks);
// return { ..., peaks: peaksArray, ... } unchanged
```

**Import update:** `PeakRecordSerializable` import at line 23 becomes `DisplayRow` (or drops entirely if `analyze` is re-exported). The `import type { PeakRecord } from '../core/sampler.js'` at line 20 stays (needed for the function signature).

**Test gate preserved:** `tests/core/summary.spec.ts` (lines 55–66) asserts `(skinName, slotName, attachmentName)` sort order via a local resort; that test continues to pass because analyzer preserves the exact same comparator.

---

### 4. `src/renderer/panels/GlobalMaxRenderPanel.tsx` — NEW — panel composition

**Primary analog:** `src/renderer/src/components/DebugPanel.tsx` (same-prop-shape predecessor; provides header pattern, Tailwind token usage, and the component signature)
**Secondary analog:** `src/renderer/src/components/DropZone.tsx` (hook + clsx + literal-Tailwind discipline for interactive elements)

**Directory note:** new directory `src/renderer/panels/`. Phase 0/1 used only `src/renderer/src/components/`. CONTEXT.md §"Integration Points" locks this split: `panels/` for compositions (GlobalMaxRenderPanel), `src/renderer/src/components/` stays for reusable UI primitives (SearchBar, DropZone).

Wait — read the spec again. ROADMAP line 72 says `src/renderer/panels/GlobalMaxRenderPanel.tsx` but existing components live under `src/renderer/src/components/`. The Vite `src/renderer/src/` convention suggests the panel path should be **`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`** to match the vite `src/renderer/` root layout established in Phase 1 (see tsconfig.web.json and electron.vite.config.ts). Planner: resolve by checking the vite config `root` for renderer before locking path. Either way, `panels/` vs `components/` is a sibling directory split and the pattern is unchanged.

#### Imports pattern — mirror `DebugPanel.tsx` lines 27–30 + `DropZone.tsx` lines 29–31

```typescript
// DebugPanel.tsx:27–30 (CURRENT — mirror this)
import type {
  SkeletonSummary,
  PeakRecordSerializable,
} from '../../../shared/types.js';
```

New file should import:

```typescript
import { useState, useMemo, useRef, useEffect, useCallback, type MouseEvent } from 'react';
import clsx from 'clsx';
import type { SkeletonSummary, DisplayRow } from '../../../shared/types.js';
// Note the triple-dot: DebugPanel.tsx:30 uses `'../../../shared/types.js'`
// relative to src/renderer/src/components/. If the panel lives at
// src/renderer/src/panels/, the same relative depth (3 dots) applies.
import { SearchBar } from '../components/SearchBar';
```

**No imports from `src/core/*`** (three-layer defense / `tests/arch.spec.ts:20–33` active). DisplayRow crosses IPC via the shared/ barrel only.

#### Component signature — mirror `DebugPanel.tsx` lines 32–34 + 98

```typescript
// DebugPanel.tsx:32–34 + 98 (CURRENT — mirror this exactly)
export interface DebugPanelProps {
  summary: SkeletonSummary;
}
export function DebugPanel({ summary }: DebugPanelProps) { ... }
```

New file:

```typescript
export interface GlobalMaxRenderPanelProps {
  summary: SkeletonSummary;
}
export function GlobalMaxRenderPanel({ summary }: GlobalMaxRenderPanelProps) { ... }
```

#### Header layout — mirror `DebugPanel.tsx` lines 104–139 (same max-width + padding scaffold)

```tsx
// DebugPanel.tsx:104–139 (CURRENT — replace body, keep outer div shape)
return (
  <div className="w-full max-w-6xl mx-auto p-8">
    <header className="mb-6 font-mono text-sm text-fg">
      ...
    </header>
    <pre className="...">{tableText}</pre>
  </div>
);
```

New file reuses `w-full max-w-6xl mx-auto p-8` and the `font-mono text-sm text-fg` header typography. Replace `<pre>` with `<table>` + header chip/SearchBar/selection-count composition per CONTEXT.md §Specifics seed.

#### Hook + memo pattern — mirror `DropZone.tsx` lines 49–67 (useCallback discipline)

DropZone's `handleDrop` (lines 69–101) shows the pattern for event handlers with `useCallback`:

```typescript
// DropZone.tsx:69–101 (CURRENT — mirror this useCallback discipline)
const handleDrop = useCallback(
  async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // ...
  },
  [onLoad, onLoadStart],
);
```

New panel's shift-click range toggle and sort-click follow the same shape: `useCallback` with explicit deps, `e.preventDefault()` where needed, `setState` at the end.

Memoized derivations (`filteredRows`, `sortedRows`) go through `useMemo` per CONTEXT.md §Specifics seed. No existing `useMemo` analog in-repo; first use in the renderer. Reference: CONTEXT.md §Canonical References links the React docs.

#### Tailwind literal-class discipline — MANDATORY, mirror `DropZone.tsx` lines 109–116

```tsx
// DropZone.tsx:109–116 (CURRENT — the literal-class rule)
// All class strings are LITERAL — Pitfall 8 safe (Tailwind v4 scanner
// picks them up). Do not refactor to template strings like `ring-${color}`.
className={clsx(
  'w-full min-h-screen flex items-center justify-center',
  'bg-surface text-fg',
  'focus-visible:outline-2 focus-visible:outline-accent',
  isDragOver && 'ring-2 ring-accent bg-accent/5',
)}
```

**Rule for new panel/table cells:** every Tailwind class must be a static string literal — no `bg-${var}`, no computed arithmetic on class names. `clsx` handles conditionals (active sort column, selected row, etc.). This is Phase 1 Pitfall 8; arch.spec.ts doesn't enforce it but build-time utility emission silently drops non-literal classes.

#### Available design tokens (D-43 to D-47; no new tokens)

From `src/renderer/src/index.css` lines 46–62 (`@theme inline` block):
- `bg-surface` (stone-950 app bg), `bg-panel` (stone-900), `border-border` (stone-800)
- `text-fg` (stone-100), `text-fg-muted` (stone-400)
- `text-accent`, `bg-accent`, `bg-accent/5`, `bg-accent/20`, `ring-accent`, `outline-accent`
- `text-accent-muted` (orange-300)
- `font-mono` (JetBrains Mono self-hosted), `font-sans`

D-44 chip: `inline-block border border-border rounded-md px-2 py-0.5 text-xs font-mono`.
D-40 `<mark>`: `bg-accent/20 text-accent rounded-sm px-0.5`.
D-47 cell density: `py-2 px-3 font-mono` per cell.

All of these are already emitted by the Tailwind v4 scanner from Phase 1 consumers (DropZone + DebugPanel). Phase 2's new usages are all superset literals of those already-present ones; no new `@theme` entries, no config churn.

#### ARIA pattern

No in-repo analog — this is the first ARIA-heavy component. Reference the WAI-ARIA Table pattern link in CONTEXT.md §Canonical References (external). `aria-sort="ascending"/"descending"/"none"` on `<th>`; `aria-label` on select-all checkbox; `<mark>` is self-documenting (MDN).

---

### 5. `src/renderer/src/components/SearchBar.tsx` — NEW — reusable controlled input

**Primary analog:** `src/renderer/src/components/DropZone.tsx` (component shape, prop discipline, useCallback + Tailwind literal classes)

#### Imports + component signature (mirror `DropZone.tsx` lines 29–48)

```typescript
// DropZone.tsx:29–48 (CURRENT — mirror this component signature pattern)
import { useState, useCallback, type DragEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import type { LoadResponse } from '../../../shared/types.js';

export interface DropZoneProps {
  onLoad: (resp: LoadResponse, fileName: string) => void;
  onLoadStart: (fileName: string) => void;
  children: ReactNode;
}

export function DropZone({ onLoad, onLoadStart, children }: DropZoneProps) { ... }
```

New file follows identically:

```typescript
import { useCallback, type KeyboardEvent } from 'react';
import clsx from 'clsx';

export interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}

export function SearchBar({ value, onChange, placeholder }: SearchBarProps) { ... }
```

(Minimal props per CONTEXT.md §"Integration Points" line 188: "Keep props minimal: `value: string`, `onChange: (v: string) => void`, `placeholder?: string`.")

#### Event-handler pattern (D-42 ESC-clears-and-blurs) — mirror `DropZone.tsx` lines 69–101 useCallback shape

```tsx
// New — handleKeyDown (mirror the DropZone useCallback pattern)
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
```

#### Tailwind literal-class pattern (mirror `DropZone.tsx` lines 109–116; see §4 above)

CONTEXT.md §Specifics provides the UX seed at lines 309–336. All classes are literal strings — same Pitfall 8 rule.

#### NO `src/core/*` imports (arch.spec.ts Layer 3 enforces — `tests/arch.spec.ts:20–33`)

`SearchBar` imports only React types + `clsx`. Nothing from `src/core/`, nothing from `src/main/`.

---

### 6. `src/renderer/src/App.tsx` — MODIFY — swap DebugPanel → GlobalMaxRenderPanel

**Primary analog:** the current file itself.

Current file has two lines to flip (import at line 22, render at line 69):

```tsx
// src/renderer/src/App.tsx:22 (CURRENT)
import { DebugPanel } from './components/DebugPanel';
// CHANGE TO:
import { GlobalMaxRenderPanel } from './panels/GlobalMaxRenderPanel';

// src/renderer/src/App.tsx:69 (CURRENT)
{state.status === 'loaded' && <DebugPanel summary={state.summary} />}
// CHANGE TO:
{state.status === 'loaded' && <GlobalMaxRenderPanel summary={state.summary} />}
```

Everything else stays: `AppState` discriminated union (lines 28–32), the `useEffect` D-17 console echo (lines 50–55), all four render branches (lines 58–81). D-43 is faithful — DropZone still wraps the full window.

---

### 7. `scripts/cli.ts` — MODIFY — delegate fold to analyzer, preserve byte-for-byte output

**Primary analog:** the current file itself, `renderTable` at lines 77–126.

The sort block (lines 88–92) is what analyzer now owns. After refactor the CLI `renderTable` receives `DisplayRow[]` (already-sorted, already-formatted) instead of a `Map<string, PeakRecord>`:

```typescript
// scripts/cli.ts:77–126 (CURRENT — inner fold to replace)
function renderTable(peaks: Map<string, PeakRecord>): string {
  const rows: string[][] = [];
  rows.push([ 'Attachment', 'Skin', 'Source W×H', 'Peak W×H', 'Scale', 'Source Animation', 'Frame' ]);
  const sorted = [...peaks.values()].sort((a, b) => {
    if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
    if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
    return a.attachmentName.localeCompare(b.attachmentName);
  });
  for (const rec of sorted) {
    const worldW = rec.worldW.toFixed(1);
    const worldH = rec.worldH.toFixed(1);
    rows.push([
      `${rec.slotName}/${rec.attachmentName}`,
      rec.skinName,
      `${rec.sourceW}×${rec.sourceH}`,
      `${worldW}×${worldH}`,
      rec.peakScale.toFixed(3),
      rec.animationName,
      String(rec.frame),
    ]);
  }
  // ...column widths + two-space separator stays (lines 106–125)
}
```

**CRITICAL byte-for-byte preservation issues** (CONTEXT.md §Canonical References line 149 "CLI output must remain unchanged"):

1. CLI uses `rec.peakScale.toFixed(3)` (no trailing `×`). **DisplayRow.scaleLabel has trailing `×` per D-45** — CLI cannot use `scaleLabel`; it must still compute `row.peakScale.toFixed(3)` directly from the raw number, OR analyzer exposes two label variants. **Planner decision:** CLI reads `row.peakScale` (the raw number is still in `DisplayRow`) and calls `.toFixed(3)` itself. The preformatted `scaleLabel` is UI-only. This preserves CLI byte-for-byte.
2. CLI uses `worldW.toFixed(1)` (one decimal) vs panel uses `toFixed(0)` per D-46. Same resolution: CLI uses raw numbers, panel uses `peakSizeLabel`. **`DisplayRow` exposes BOTH** (raw + label) for exactly this reason.
3. `originalSizeLabel` uses the same `${w}×${h}` format the CLI already emits at line 99 — matches byte-for-byte.
4. `animationName` / `sourceLabel` are equal — also matches.

**Refactor shape:**

```typescript
// scripts/cli.ts — AFTER
import { analyze } from '../src/core/analyzer.js';

function renderTable(peaks: Map<string, PeakRecord>): string {
  const rows: string[][] = [];
  rows.push([ /* same header */ ]);
  const sorted = analyze(peaks); // <-- replaces the inline sort
  for (const rec of sorted) {
    const worldW = rec.worldW.toFixed(1);  // <-- stays .toFixed(1) for CLI; NOT rec.peakSizeLabel
    const worldH = rec.worldH.toFixed(1);
    rows.push([
      `${rec.slotName}/${rec.attachmentName}`,
      rec.skinName,
      `${rec.sourceW}×${rec.sourceH}`,  // equivalent to rec.originalSizeLabel — keep literal for byte-parity
      `${worldW}×${worldH}`,
      rec.peakScale.toFixed(3),  // <-- stays; NOT rec.scaleLabel (no trailing ×)
      rec.animationName,
      String(rec.frame),
    ]);
  }
  // ... rest unchanged
}
```

**Acceptance gate:** run `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, capture output before refactor, compare after refactor. `diff` must show zero bytes changed. CONTEXT.md §"Expected SIMPLE_TEST.json output" (lines 352–364) lists the current 4-row table (CIRCLE/SQUARE/SQUARE2/TRIANGLE).

---

### 8. `src/renderer/src/components/DebugPanel.tsx` — DELETE

Phase 1 D-16 locked: "replaced by GlobalMaxRenderPanel." After §6 (App.tsx swap) lands, this file has zero importers.

**Grep gate:** after deletion, `grep -rn 'DebugPanel' src/ tests/` should return zero matches. CONTEXT.md §"Grep-literal-in-comments compliance" applies — if any plan's acceptance gate greps for the literal `DebugPanel`, planner should ensure the deletion commit removes every reference including comments.

---

### 9. `tests/core/analyzer.spec.ts` — NEW — vitest golden suite for pure-core module

**Primary analog:** `tests/core/summary.spec.ts` (same test target shape — pure module from fixture)
**Secondary analog:** `tests/core/loader.spec.ts` (import discipline + fixture constant pattern)

#### Imports + fixture constant — mirror `summary.spec.ts` lines 17–23

```typescript
// tests/core/summary.spec.ts:17–23 (CURRENT — mirror this)
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
```

New file:

```typescript
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
```

#### Test structure — mirror `summary.spec.ts` lines 25–67 (describe + 3 it blocks)

```typescript
// summary.spec.ts:25–67 (CURRENT — mirror the describe/it rhythm)
describe('buildSummary (D-21, D-22)', () => {
  it('D-22: output survives structuredClone (no Map/class instances)', () => { ... });
  it('D-21: populates bones/slots/attachments/skins/animations from SkeletonData', () => { ... });
  it('D-16 sort: peaks[] sorted by (skinName, slotName, attachmentName)', () => { ... });
});
```

Translate to analyzer:

```typescript
describe('analyze (D-33, D-34, D-35)', () => {
  it('D-34 sort: DisplayRow[] sorted by (skinName, slotName, attachmentName)', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    const sorted = [...rows].sort((a, b) => {
      if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
      if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
      return a.attachmentName.localeCompare(b.attachmentName);
    });
    expect(rows).toEqual(sorted);
  });

  it('D-35: emits preformatted labels alongside raw numbers', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    for (const r of rows) {
      expect(r.originalSizeLabel).toBe(`${r.sourceW}×${r.sourceH}`);
      expect(r.peakSizeLabel).toBe(`${r.worldW.toFixed(0)}×${r.worldH.toFixed(0)}`);
      expect(r.scaleLabel).toBe(`${r.peakScale.toFixed(3)}×`);
      expect(r.frameLabel).toBe(String(r.frame));
      expect(r.sourceLabel).toBe(r.animationName);
    }
  });

  it('D-22 structuredClone-safe: every DisplayRow field is a primitive', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    const cloned = structuredClone(rows);
    expect(cloned).toEqual(rows);
  });

  it('D-33: returns 4 rows for SIMPLE_TEST (CIRCLE/SQUARE/SQUARE2/TRIANGLE)', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const rows = analyze(peaks);
    expect(rows.length).toBe(4);
    const names = rows.map((r) => r.attachmentName).sort();
    expect(names).toEqual(['CIRCLE', 'SQUARE', 'SQUARE2', 'TRIANGLE']);
  });
});
```

**Perf gate:** `summary.spec.ts` has no explicit perf gate (buildSummary is trivial). Analyzer should inherit N2.1 implicitly through `sampler.spec.ts` lines 22 ("N2.1 perf gate — full sampler run on SIMPLE_TEST completes in < 500 ms"). No new perf assertion required for analyzer alone.

#### Hot-loop grep hygiene — mirror `sampler.spec.ts` lines 22–24

Optionally add:

```typescript
it('N2.3: analyzer.ts has no node:/sharp/fs imports', () => {
  const src = readFileSync(path.resolve('src/core/analyzer.ts'), 'utf8');
  expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)/);
  expect(src).not.toMatch(/from ['"]sharp['"]/);
});
```

(Pattern lifted from `tests/core/sampler.spec.ts`; planner may consolidate into a single hygiene spec.)

---

### 10. Renderer tests (planner's call per D-32 tail; marked "no analog" below)

See §No Analog Found.

---

## Shared Patterns (cross-cutting, apply to all relevant files)

### A. Layer-3 architectural defense (arch.spec.ts)

**Source:** `tests/arch.spec.ts:20–33` (grep for `/core/|@core`)
**Apply to:** `src/renderer/panels/GlobalMaxRenderPanel.tsx` and `src/renderer/src/components/SearchBar.tsx` — both MUST pass the existing grep. The test auto-scans `src/renderer/**/*.{ts,tsx}`, so no test changes are required for new renderer files; they're scanned the moment they're created.

```typescript
// tests/arch.spec.ts:20–33 (CURRENT — still live in Phase 2)
const files = globSync('src/renderer/**/*.{ts,tsx}');
const offenders: string[] = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  if (/from ['"][^'"]*\/core\/|from ['"]@core/.test(text)) {
    offenders.push(file);
  }
}
expect(offenders, ...).toEqual([]);
```

### B. Portability (D-23)

**Source:** `tests/arch.spec.ts:36–49`
**Apply to:** all new files (automatically scanned). No `process.platform`, `os.platform()`, or macOS-only `BrowserWindow` options (`titleBarStyle`, `trafficLightPosition`, `vibrancy`, `visualEffectState`). Phase 2's panel + SearchBar are pure UI — this constraint is trivially satisfied but the grep runs regardless.

### C. Tailwind v4 literal-class rule (Pitfall 8)

**Source:** `src/renderer/src/components/DropZone.tsx:109–116` (inline comment + clsx pattern)
**Apply to:** `GlobalMaxRenderPanel.tsx`, `SearchBar.tsx`, any new sub-components or `Row`/`SortHeader` helpers. All Tailwind classes must be static string literals; use `clsx` for conditionals; never use template-string interpolation on class names.

### D. structuredClone safety at the IPC boundary (D-22)

**Source:** `src/shared/types.ts:7–11` (JSDoc lock comment) + `tests/core/summary.spec.ts:27–32` (enforcement)
**Apply to:** `DisplayRow` definition in `src/shared/types.ts` — every field must be a primitive (`string`, `number`, `boolean`). No classes, no Map, no Float32Array. `tests/core/analyzer.spec.ts` should preserve the structuredClone round-trip assertion.

### E. Byte-for-byte CLI preservation (D-34 contract with `scripts/cli.ts`)

**Source:** CONTEXT.md §Canonical References line 149 + §Specifics lines 352–364
**Apply to:** `scripts/cli.ts` refactor. Acceptance gate: capture `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` output before and after; `diff` must be empty. CLI uses raw `DisplayRow` numbers (`.peakScale.toFixed(3)`, `.worldW.toFixed(1)`) — NOT the `*Label` fields — because CLI's historical format differs from the panel's D-45/D-46 formatting.

### F. CLAUDE.md facts #1–#6 (load-bearing invariants)

Relevant to Phase 2:
- **#3 (locked tick lifecycle):** untouched — analyzer sits downstream of the sampler, does NOT resample.
- **#4 (no PNG decode):** untouched — analyzer is pure-TS on in-memory peak data.
- **#5 (core/ is pure TS, no DOM, headless-testable):** **DIRECT IMPACT** — `src/core/analyzer.ts` must not import React, DOM types, `window`, `document`, or browser APIs. Enforced by the vitest Node test environment (any DOM import fails to resolve in Node vitest).
- **#6 (default 120 Hz sampler rate):** untouched.

### G. Atomic-commit scope convention (CONTEXT.md §"Established Patterns")

**Source:** Phase 1 convention (`feat(01-ui):`, `chore(01-ui):`).
**Apply to:** Phase 2 commits should use `feat(02-panel):`, `refactor(02-panel):`, `chore(02-panel):`, `test(02-panel):`. Planner should spec commit boundaries at logical points: (1) analyzer + test green (RED-then-GREEN), (2) summary.ts refactor, (3) types.ts + IPC flip, (4) SearchBar, (5) GlobalMaxRenderPanel, (6) App.tsx swap + DebugPanel deletion, (7) cli.ts refactor + smoke assertion.

### H. Grep-literal-in-comments compliance (CONTEXT.md §"Established Patterns" lines 179–180)

**Source:** Phase 1 repeated footgun — comments citing forbidden literals tripped acceptance gates (Devs #3/#4 in 01-01..01-05).
**Apply to:** all new comments and JSDoc. Prefer prose over literal citation. If an acceptance gate is `! grep -q "DebugPanel"` after deletion, no comment in any other Phase 2 file may include the literal string `DebugPanel` (even in a "replaced by" note — use prose like "the prior debug component").

### I. JetBrains Mono font availability

**Source:** `src/renderer/src/index.css:33–41` (`@font-face`) + `src/renderer/src/index.css:61` (`--font-mono` definition).
**Apply to:** all numeric cells per D-47. `font-mono` utility resolves to JetBrains Mono; no additional font wiring needed in Phase 2. CSS already self-hosted and build-proven in Phase 1 (`01-03-SUMMARY.md`).

---

## No Analog Found

Files / patterns with no close match in the codebase. Planner should rely on CONTEXT.md §Specifics + RESEARCH.md + external references (MDN, WAI-ARIA) for these.

| File/Pattern | Role | Data Flow | Reason |
|---|---|---|---|
| Renderer DOM tests (`tests/renderer/*.spec.ts*` or `src/renderer/**/__tests__/*`) | DOM assertion suite for `GlobalMaxRenderPanel` + `SearchBar` | DOM testing | All current vitest tests are Node-only (no jsdom, no Testing Library, no happy-dom). Adding RTL or happy-dom is a dependency add. **CONTEXT.md §"Claude's Discretion" line 118 explicitly flags this as planner's call.** Planner recommendation: happy-dom + plain DOM assertions (lighter dep add than RTL). |
| `useMemo` in renderer code | memoized derivation | — | No existing consumer of `useMemo` in the renderer. Use the standard React pattern from the React docs link in CONTEXT.md §Canonical References. The closest analog for memoization discipline in-repo is `sampler.ts`'s allocation-free fold pattern (lines 203–263) — not directly translatable but the same "derive once, re-read many" mindset applies. |
| ARIA table-sort wiring (`aria-sort`, `role="checkbox"`) | accessibility | — | First accessibility-critical component in the repo. Follow WAI-ARIA Table pattern (external link in CONTEXT.md §Canonical References). No in-repo analog; no enforcement test. Planner's call whether to add an arch.spec.ts-style `aria-sort` presence check. |
| Shift-click range selection | event-driven state | — | No analog. Algorithm is straightforward: anchor on `lastClicked`, index into `sorted[]`, range-add keys to `Set`. CONTEXT.md §"Claude's Discretion" line 114 recommends "most recently CLICKED" semantics (VS Code / Finder convention). |
| Match-highlight via `<mark>` + string split | React fragment rendering | — | No analog. CONTEXT.md §Specifics lines 340–350 seeds the pattern; follows React's standard keyed-fragment idiom. No `dangerouslySetInnerHTML`, no HTML parsing. |

---

## Project-Skill Rules Consulted

- **`.claude/skills/`:** not present (directory absent)
- **`.agents/skills/`:** not present (directory absent)
- **`CLAUDE.md`:** consulted (facts #1–#6, especially #5 — "core/ is pure TypeScript, no DOM"). Captured under §Shared Patterns F.
- **Approved plan at `~/.claude/plans/i-need-to-create-zesty-eich.md`:** referenced via CONTEXT.md §Canonical References; planner must read §"Phase 3 — Global Max Render Source panel (screenshot 1)" for the canonical table-shape description before writing PLAN.md.

---

## Metadata

- **Analog search scope:** `src/core/`, `src/main/`, `src/renderer/src/components/`, `src/renderer/src/App.tsx`, `src/shared/`, `scripts/`, `tests/core/`, `tests/arch.spec.ts`
- **Files scanned (full reads):** 11 (summary.ts, types.ts, sampler.ts, core/types.ts, DebugPanel.tsx, DropZone.tsx, App.tsx, cli.ts, arch.spec.ts, summary.spec.ts, ipc.spec.ts)
- **Files scanned (partial, targeted):** 3 (loader.ts head, bounds.ts head, sampler.spec.ts head)
- **Strong-analog coverage:** 10/10 files have at least one same-role in-repo analog; 1 gap (renderer DOM tests) is an explicit planner-discretion item from CONTEXT.md D-32.
- **Pattern extraction date:** 2026-04-23
