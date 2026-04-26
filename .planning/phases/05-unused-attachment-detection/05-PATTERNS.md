# Phase 5: Unused attachment detection — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 8 (4 new, 4 modified)
**Analogs found:** 8 / 8

Every new or modified file in Phase 5 has a direct analog already shipping in the codebase. Zero new file-shapes, zero new boundaries, zero new conventions. The planner should treat this document as a set of "clone-this-file-shape" instructions — each Phase 5 artifact mirrors a listed analog with explicit, narrow deltas.

> **Path correction (RESEARCH.md discrepancy):** RESEARCH.md repeatedly refers to `tests/main/summary.spec.ts`, but that directory does not exist. The canonical location is `tests/core/summary.spec.ts` (verified by `ls`). All references below use the correct path.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/usage.ts` (NEW) | core-analyzer | transform (Map→Array) | `src/core/analyzer.ts` | exact (role + data flow) |
| `src/shared/types.ts` (MOD) | shared-types | IPC contract | `src/shared/types.ts` (`AnimationBreakdown` block) | self-extension (Phase 3 precedent) |
| `src/main/summary.ts` (MOD) | projection | request-response | `src/main/summary.ts` (`analyzeBreakdown` wiring) | self-extension (Phase 3 precedent) |
| `src/renderer/src/index.css` (MOD) | design-tokens | build-time | `src/renderer/src/index.css` (D-14 `--color-accent` add) | self-extension |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MOD) | panel-component | render-time | Same file (existing `<section>` + `<table>` composition) | self-extension |
| `tests/core/usage.spec.ts` (NEW) | unit-test | fixture-load + assert | `tests/core/analyzer.spec.ts` | exact (pure-TS analyzer spec) |
| `tests/core/summary.spec.ts` (MOD) | unit-test | fixture-load + assert | `tests/core/summary.spec.ts` (F4.1/F4.2 block) | self-extension |
| `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.{json,atlas}` (NEW) | fixture | static data | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.{json,atlas}` | fork |

---

## Pattern Assignments

### 1. `src/core/usage.ts` (NEW — core-analyzer, transform)

**Analog:** `src/core/analyzer.ts`

Both modules are pure-TS transforms that consume sampler output + loader data and emit `structuredClone`-safe `shared/types.ts` row arrays. `usage.ts` performs **Set arithmetic** (defined∖used) instead of `analyzer.ts`'s **fold + dedup**, but the module shape — imports, JSDoc conventions, named exports, arch-compliance — is identical.

**Imports pattern — mirror `src/core/analyzer.ts:49-56`:**

```ts
import type { LoadResult } from './types.js';
import type { SamplerOutput } from './sampler.js';
import type { UnusedAttachment } from '../shared/types.js';
```

**Deltas vs analyzer.ts:**
- Analyzer imports `SkeletonData` + `Slot` from `@esotericsoftware/spine-core` (needed for `boneChainPath`). `usage.ts` does NOT need spine-core types directly — `LoadResult.skeletonData.skins` resolves spine-core types transitively through `./types.js`, which is the `src/core/*` boundary-safe re-export surface.
- Analyzer imports `PeakRecord` (value-less; type-only). `usage.ts` reads `PeakRecord.attachmentName` via `SamplerOutput.globalPeaks.values()` — no direct `PeakRecord` import needed if you destructure inline, or import as type-only for clarity.

**JSDoc header pattern — mirror `src/core/analyzer.ts:1-48`:**

The analyzer header contains: (a) phase+plan citation on line 1, (b) purpose statement, (c) "Pure, stateless, zero-I/O" promise with N2.3 reference, (d) explicit dedup-by-attachmentName policy docblock with D-# citations, (e) "Callers" bullet list, (f) sort/label spec block. Phase 5's `usage.ts` must carry the same 6 sections with D-92/D-93/D-96/D-98/D-100/D-107 citations (not D-33/D-34/D-35).

**Core pattern — Set arithmetic (NEW, no analyzer parallel):**

```ts
// 1. Used set — one-liner per RESEARCH Finding #2.
const usedNames = new Set<string>();
for (const peak of sampler.globalPeaks.values()) {
  usedNames.add(peak.attachmentName);
}

// 2. Defined set — MIRROR summary.ts:40-49 iteration verbatim.
//    (see "Shared iteration pattern" below for the exact shape)

// 3. Set difference + D-98 aggregation.
for (const [name, entry] of defined) {
  if (usedNames.has(name)) continue; // D-93 automatic (Finding #5).
  // ... aggregate max dims + sourceLabel per D-98 ...
}

// 4. Sort by attachmentName ASC (D-107, matches Phase 4 D-91).
rows.sort((a, b) => a.attachmentName.localeCompare(b.attachmentName));
```

**Exported function signature — mirror `src/core/analyzer.ts:136, 209`:**

Analyzer exports named functions with a plain primitive/array return and JSDoc blocks above each. Copy this style — no default exports, no class wrappers:

```ts
export function findUnusedAttachments(
  load: LoadResult,
  sampler: SamplerOutput,
): UnusedAttachment[] {
  // ...
}
```

**Arch.spec.ts compliance grep patterns** — `usage.ts` must NOT trip:

1. **Layer 3 (tests/arch.spec.ts:19-33)** — grep `from ['"][^'"]*\/core\/|from ['"]@core` scans `src/renderer/**/*.{ts,tsx}`. `usage.ts` lives in `src/core/`, so it is not scanned by this rule — but the **new panel section markup must not import from `src/core/*`**. The panel imports `UnusedAttachment` from `../../../shared/types.js` (allowed) NOT from `../../../core/usage.js` (forbidden).
2. **Portability (tests/arch.spec.ts:36-49)** — grep `process\.platform|os\.platform\(\)|titleBarStyle|trafficLightPosition|vibrancy:|visualEffectState`. `usage.ts` has zero platform code.
3. **N2.3 filesystem hygiene (self-imposed, mirrors `tests/core/analyzer.spec.ts:190-194`)** — `usage.ts` must pass this grep in its own spec:

   ```ts
   expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
   expect(src).not.toMatch(/from ['"]sharp['"]/);
   ```

4. **DOM-free (implied by CLAUDE.md Fact #5)** — grep for `document\.|window\.|HTMLElement|React` in `usage.ts` should yield nothing.

---

### 2. Shared iteration pattern: `skin.attachments` walk (CANONICAL)

**Source of truth:** `src/main/summary.ts:40-49` — this is the **only** place in the codebase that walks `skin.attachments` today, and it is the verbatim pattern `usage.ts` must mirror per RESEARCH Finding #1.

**Excerpt from `src/main/summary.ts:32-49`:**

```ts
// Count attachments across skins + bucket by spine-core class name.
// Walks `skin.attachments` — an array (per slot index) of `StringMap<Attachment>`
// where `StringMap<T>` is spine-core's plain indexed-object alias
// (`{ [key: string]: T }`, NOT a JS Map — see node_modules/@esotericsoftware/
// spine-core/dist/Utils.d.ts:31). We use `Object.values` to enumerate the
// attachments per slot regardless of key name.
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

**Delta for `usage.ts`:** the analyzer needs the **attachment NAME (map key)** per RESEARCH Finding #5 Pitfall 3 — use `Object.entries(attachmentsPerSlot)` instead of `Object.values(...)`, and additionally filter by `load.sourceDims.get(name) !== undefined` per Finding #3 / Pitfall 4 to exclude non-textured attachments:

```ts
// Adapted for usage.ts — add sourceDims filter + name capture:
for (const skin of load.skeletonData.skins) {
  for (const attachmentsPerSlot of skin.attachments) {
    if (attachmentsPerSlot === undefined || attachmentsPerSlot === null) continue;
    for (const [attachmentName] of Object.entries(attachmentsPerSlot)) {
      // Pitfall 4 — skip non-textured (Path / Clipping / BoundingBox / Point).
      const dims = load.sourceDims.get(attachmentName);
      if (dims === undefined) continue;
      // ... accumulate into defined Map<attachmentName, { definedIn, sourceDimsByVariant }> ...
      // Pitfall 7 — preserve skin-iteration order in definedIn, do NOT sort.
    }
  }
}
```

**Why this pattern, not `Skin#getAttachments()`:** RESEARCH Finding #1 — the `summary.ts:40-49` pattern is already shipping and tested. The `getAttachments()` alternative allocates a `SkinEntry[]`. For parity and review-ease, mirror the direct walk.

---

### 3. `src/shared/types.ts` (MOD — IPC contract extension)

**Analog:** The `AnimationBreakdown` / `BreakdownRow` extension landed in Phase 3 inside this same file. Phase 5 follows the identical shape.

**Excerpt from `src/shared/types.ts:69-116` (Phase 3 precedent):**

```ts
/**
 * Phase 3 Plan 01 — Row shape consumed by the per-animation cards.
 *
 * Extends DisplayRow with the two Bone Path fields required by F4.3. All
 * fields primitive — structuredClone-safe. Preformatted in src/core/analyzer.ts;
 * renderer does zero formatting.
 * ...
 */
export interface BreakdownRow extends DisplayRow {
  /** Raw bone chain: [rootName, ...ancestorNames, slotBoneName, slotName, attachmentName]. */
  bonePath: string[];
  /** Preformatted bone-chain label using U+2192 (right arrow) space-flanked separator. */
  bonePathLabel: string;
}

/**
 * Phase 3 Plan 01 — A single card in the Animation Breakdown panel.
 * ...
 */
export interface AnimationBreakdown {
  cardId: string;
  animationName: string;
  isSetupPose: boolean;
  uniqueAssetCount: number;
  rows: BreakdownRow[];
}

export interface SkeletonSummary {
  // ... existing fields ...
  peaks: DisplayRow[];
  /** Phase 3: static-pose card first (cardId === 'setup-pose'), then one card per animation in JSON order. */
  animationBreakdown: AnimationBreakdown[];
  /** `loadSkeleton + sampleSkeleton` wall-clock time in ms. */
  elapsedMs: number;
}
```

**Deltas for Phase 5:**
- Add a new `UnusedAttachment` interface **before** `SkeletonSummary` (conventional top-to-bottom ordering in this file: primitive row types first, then compound container types).
- The interface must use only primitives / string arrays — no `Set`, no `Map`, no class instances (file-top docblock at `src/shared/types.ts:1-17` locks this as the D-21 contract; RESEARCH Pitfall 8 reaffirms).
- Extend `SkeletonSummary` with `unusedAttachments: UnusedAttachment[];` — one new line, placed alongside the existing `animationBreakdown` field.
- JSDoc must cite D-92 / D-96 / D-98 / D-101 (not D-67 / F4.3 which belong to Phase 3).
- CONTEXT.md §specifics:240-255 seeds the exact field list — copy it verbatim (including primitive types, JSDoc, ordering).

---

### 4. `src/main/summary.ts` (MOD — projection extension)

**Analog:** This file's own Phase 3 extension pattern at `src/main/summary.ts:56-67`.

**Excerpt from `src/main/summary.ts:56-89` (Phase 3 `analyzeBreakdown` wiring):**

```ts
// Phase 3 Plan 01 — fold the per-animation + setup-pose sampler maps into
// AnimationBreakdown[] (F4.1/F4.2/F4.3). boneChainPath walks slot.bone.parent
// so we materialize a Skeleton here — SkeletonData alone does not carry
// Bone.parent wiring; spine-core's Skeleton constructor resolves it. Cheap
// (<1 ms on SIMPLE_TEST), runs once per load.
const skeleton = new Skeleton(load.skeletonData);
const animationBreakdown = analyzeBreakdown(
  sampled.perAnimation,
  sampled.setupPosePeaks,
  load.skeletonData,
  skeleton.slots,
);

return {
  // ... other fields ...
  peaks: peaksArray,
  animationBreakdown,
  elapsedMs,
};
```

**Deltas for Phase 5:**
- Add `import { findUnusedAttachments } from '../core/usage.js';` alongside the existing `import { analyze, analyzeBreakdown } from '../core/analyzer.js';` at the top.
- Insert **after** the `animationBreakdown` assignment (~line 67), **before** the `return {` (~line 69):

  ```ts
  // Phase 5 Plan 01 — F6.1 defined∖used detection. Pure projection; no business
  // logic in summary.ts per D-35 / D-100. The core module owns the algorithm.
  const unusedAttachments = findUnusedAttachments(load, sampled);
  ```

- Add `unusedAttachments,` to the return object literal alongside `animationBreakdown`.
- No `new Skeleton(...)` materialization needed — unlike `analyzeBreakdown` which needs `skeleton.slots` for bone-chain walking, `findUnusedAttachments` consumes only `load.skeletonData.skins` + `sampled.globalPeaks` + `load.sourceDims` (all already on the `load` + `sampled` params).
- Summary remains a projection layer — zero logic, just one function call + one field assignment, exactly mirroring the Phase 3 `analyzeBreakdown` wiring.

---

### 5. `src/renderer/src/index.css` (MOD — design-token extension)

**Analog:** The Phase 1 D-14 `--color-accent` addition inside the same `@theme inline` block at `src/renderer/src/index.css:46-62`.

**Excerpt from `src/renderer/src/index.css:43-62`:**

```css
/* Design tokens — `inline` is LOAD-BEARING for color tokens (RESEARCH Finding #2).
   Colors reference Tailwind's built-in stone and orange palette variables,
   which are resolved at utility-generation time rather than render time. */
@theme inline {
  /* Neutrals — warm stone base, two layers (D-12, D-13) */
  --color-surface:   var(--color-stone-950);
  --color-panel:     var(--color-stone-900);
  --color-border:    var(--color-stone-800);
  --color-fg:        var(--color-stone-100);
  --color-fg-muted:  var(--color-stone-400);

  /* Accent — Spine-adjacent orange (D-14) */
  --color-accent:        var(--color-orange-500);
  --color-accent-muted:  var(--color-orange-300);

  /* Typography (D-15) — literal strings; inline is a no-op on these but
     keeping them in the same block for proximity. */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
```

**Deltas for Phase 5:**
- Add **one line** inside the existing `@theme inline` block, after the `--color-accent-muted` line (line 56) and before the Typography comment (line 58):

  ```css
  /* Warning — terracotta for unused attachment surface (D-104) */
  --color-danger:        #e06b55;
  ```

- **Use a literal hex, not a `var(--color-red-500)` reference** (RESEARCH Anti-Pattern note): Tailwind v4 doesn't expose `--color-red-500` as a CSS var inside `@theme inline`; the literal is the correct form when the pick sits outside the default palette shades. RESEARCH Finding #7 picks `#e06b55` (5.33:1 contrast on `--color-panel`, passes WCAG AA, visually distinct from `--color-accent`).
- Also extend the emitted-utilities comment block at lines 23-27 to mention `text-danger`, `bg-danger`, `border-danger`.
- Pitfall 5: Tailwind v4 may require one `npm run dev` restart after adding the token for new utility classes to emit. Document this in the plan's execution flow.

---

### 6. `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MOD — section insert above table)

**Analog:** The panel's own existing composition — SearchBar header block + `<table>` block — already sits inside a `<div className="w-full max-w-6xl mx-auto p-8">` wrapper at lines 542-643.

**Current layout anchor (excerpt from `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:542-550`):**

```tsx
return (
  <div className="w-full max-w-6xl mx-auto p-8">
    <header className="mb-4 flex items-center gap-4">
      <SearchBar value={query} onChange={setQuery} />
      <span className="text-fg-muted font-mono text-sm ml-auto">
        {selected.size} selected / {sorted.length} total
      </span>
    </header>
    <table className="w-full border-collapse">
      {/* ... existing peak table ... */}
    </table>
  </div>
);
```

**Insertion point:** between the closing `</header>` (~line 549) and the opening `<table>` (~line 550). The new `<section>` is a sibling of the existing header + table, nested directly inside the outer wrapping `<div>`.

**Existing filter pipeline pattern to mirror (lines 444-455):**

```tsx
const enriched = useMemo(
  () => enrichWithEffective(summary.peaks, overridesMap),
  [summary.peaks, overridesMap],
);
const filtered = useMemo(
  () => filterByName(enriched, query),
  [enriched, query],
);
```

**Delta filter helper — MIRROR `filterByName` (lines 160-164) for the unused list:**

```tsx
const filteredUnused = useMemo(
  () => {
    const q = query.trim().toLowerCase();
    if (q === '') return summary.unusedAttachments.slice();
    return summary.unusedAttachments.filter((u) => u.attachmentName.toLowerCase().includes(q));
  },
  [summary.unusedAttachments, query],
);
```

**Section markup — follows the compact-table pattern from the main table but with 3 columns, no sort headers, no checkboxes, no highlightMatch:**

```tsx
{/* Phase 5 Plan 02 — F6.2 unused attachment section. Renders ABOVE the peak
    table when summary.unusedAttachments is non-empty (D-103). Header uses
    text-danger (D-104/D-105); row cells stay text-fg/text-fg-muted per
    D-105 (red scope is header-only). Filter inherited from existing query
    state per D-107; RESEARCH Pitfall 6 — render section chrome whenever
    summary.unusedAttachments.length > 0 (not dependent on filter result). */}
{summary.unusedAttachments.length > 0 && (
  <section className="mb-6 border-b border-border pb-4" aria-label="Unused attachments">
    <header className="flex items-center gap-2 mb-2 text-danger font-mono text-sm font-semibold">
      <span aria-hidden="true">⚠</span>
      <span>
        {filteredUnused.length === 1
          ? '1 unused attachment'
          : `${filteredUnused.length} unused attachments`}
      </span>
    </header>
    <table className="w-full border-collapse">
      <thead>
        <tr className="bg-panel">
          <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">Attachment</th>
          <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">Source Size</th>
          <th className="py-2 px-3 font-mono text-xs font-semibold border-b border-border text-left text-fg">Defined In</th>
        </tr>
      </thead>
      <tbody>
        {filteredUnused.length === 0 ? (
          <tr>
            <td colSpan={3} className="text-fg-muted font-mono text-sm text-center py-4">(no matches)</td>
          </tr>
        ) : filteredUnused.map((u) => (
          <tr key={u.attachmentName} className="border-b border-border">
            <td className="py-2 px-3 font-mono text-sm text-fg">{u.attachmentName}</td>
            <td className="py-2 px-3 font-mono text-sm text-fg-muted"
                title={u.dimVariantCount > 1 ? /* planner picks multi-skin breakdown string */ undefined : undefined}>
              {u.sourceLabel}
            </td>
            <td className="py-2 px-3 font-mono text-sm text-fg-muted">{u.definedInLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}
```

**Deltas vs peak table (intentional simplifications):**
- No `<SortHeader>` (D-107 — display-only, no sort controls).
- No `<SelectAllCheckbox>` + row checkboxes (D-107 — no selection).
- No `highlightMatch()` on the attachment name (D-107 — planner's call; not required by D-107 text but consistent with "display-only" framing. Alternate: inherit highlight for filter-cue parity with peak table — Claude's Discretion).
- No `onDoubleClick` override triggers (D-99 — unused rows don't hit the Scale cell path).
- `<thead>` columns use plain `<th>` with the standard `py-2 px-3 font-mono text-xs font-semibold border-b border-border` shell mirroring the `SortHeader` chrome (lines 230-251) minus the `<button>` + arrow.

**Props signature delta:**
- `GlobalMaxRenderPanelProps` at lines 90-110 currently reads `summary.peaks`, `summary.animationBreakdown`, etc. transitively through `summary: SkeletonSummary`. No new prop added — the panel already receives `summary`, and the new `summary.unusedAttachments` field is reachable for free per D-101.

**Arch-spec regression-guard note:** There is already a grep-anchor guard at `tests/arch.spec.ts:85-114` for this file (locks the `selectedAttachmentNames` contract). The Phase 5 changes add **new** markup but must not alter the `selectedAttachmentNames` wiring — the section insertion is orthogonal to the batch-scope invariant.

---

### 7. `tests/core/usage.spec.ts` (NEW — pure-TS spec)

**Analog:** `tests/core/analyzer.spec.ts` — the canonical pure-TS `core/*` spec shape.

**Setup pattern — mirror `tests/core/analyzer.spec.ts:12-21`:**

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { findUnusedAttachments } from '../../src/core/usage.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const USAGE_SRC = path.resolve('src/core/usage.ts');
```

**Test-case shape for fixture-driven assertions — mirror `analyzer.spec.ts:23-87`:**

```ts
describe('findUnusedAttachments (D-92/D-93/D-98/D-100)', () => {
  it('SIMPLE_TEST baseline: returns empty — every CIRCLE/SQUARE/TRIANGLE renders', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const rows = findUnusedAttachments(load, sampled);
    expect(rows).toEqual([]);
  });

  it('ghost-def smoke (D-95): SIMPLE_TEST_GHOST returns exactly 1 row { attachmentName: "GHOST" }', () => {
    const load = loadSkeleton(FIXTURE_GHOST);
    const sampled = sampleSkeleton(load);
    const rows = findUnusedAttachments(load, sampled);
    expect(rows.length).toBe(1);
    expect(rows[0].attachmentName).toBe('GHOST');
    expect(rows[0].sourceW).toBe(64);
    expect(rows[0].sourceH).toBe(64);
    expect(rows[0].definedIn).toEqual(['default']);
    expect(rows[0].sourceLabel).toBe('64×64');
  });
  // ... D-93 cross-skin / D-98 dim divergence / D-92 alpha-zero cases ...
});
```

**Synthetic skeleton pattern for cross-skin cases — mirror `analyzer.spec.ts:89-189` (the multi-skin dedup test):**

Analyzer tests construct synthetic `Map<string, PeakRecord>` inputs directly (lines 94-131). `usage.ts` tests that exercise the cross-skin D-93/D-98 paths similarly construct minimal synthetic `LoadResult` + `SamplerOutput` in-memory. RESEARCH Finding #4 recommends in-memory synthesis via `new SkeletonData() / new Skin() / new SlotData() / new BoneData()` for D-93/D-98/D-92 cases (d/e/f); see RESEARCH §Finding #4 for the sketch.

**N2.3 hygiene test — mirror `analyzer.spec.ts:190-194` verbatim:**

```ts
it('N2.3: src/core/usage.ts has no node:fs / node:path / node:child_process / sharp / node:http / node:net imports', () => {
  const src = readFileSync(USAGE_SRC, 'utf8');
  expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  expect(src).not.toMatch(/from ['"]sharp['"]/);
});
```

**Deltas vs analyzer.spec.ts:**
- No `Skeleton.slots` materialization (analyzer.spec.ts:201 constructs a `new Skeleton(load.skeletonData)` for `analyzeBreakdown`; `findUnusedAttachments` doesn't need it).
- Goldens are name-lists + dim ints, not peakScale floats — no `toBeGreaterThan(1.0)` style assertions.
- Skip the `structuredClone` round-trip test here — that is tested at the `SkeletonSummary` boundary in `tests/core/summary.spec.ts` (covers `unusedAttachments` too once extended).

---

### 8. `tests/core/summary.spec.ts` (MOD — field shape assertion)

**Analog:** The Phase 3 `F4.1/F4.2: animationBreakdown populated ...` block at lines 71-88.

**Excerpt from `tests/core/summary.spec.ts:71-88`:**

```ts
it('F4.1/F4.2: animationBreakdown populated with setup-pose + one card per animation; structuredClone-safe', () => {
  const load = loadSkeleton(FIXTURE);
  const sampled = sampleSkeleton(load);
  const s = buildSummary(load, sampled, 0);
  expect(Array.isArray(s.animationBreakdown)).toBe(true);
  expect(s.animationBreakdown.length).toBe(load.skeletonData.animations.length + 1);
  expect(s.animationBreakdown[0].cardId).toBe('setup-pose');
  expect(s.animationBreakdown[0].isSetupPose).toBe(true);
  for (let i = 1; i < s.animationBreakdown.length; i++) {
    expect(s.animationBreakdown[i].cardId.startsWith('anim:')).toBe(true);
    expect(s.animationBreakdown[i].isSetupPose).toBe(false);
  }
  // T-03-01-01: structured clone invariant holds for the new field.
  const cloned = structuredClone(s.animationBreakdown);
  expect(cloned).toEqual(s.animationBreakdown);
});
```

**Deltas for Phase 5:**
- Add a new `it('F6.2: unusedAttachments present + empty on SIMPLE_TEST + structuredClone-safe', ...)` block after the Phase 3 test (around line 88).
- Assertions: `expect(Array.isArray(s.unusedAttachments)).toBe(true)`, `expect(s.unusedAttachments).toEqual([])` (SIMPLE_TEST baseline has no unused), `expect(structuredClone(s.unusedAttachments)).toEqual(s.unusedAttachments)`.
- The existing `D-22: output survives structuredClone (no Map/class instances)` test at lines 26-32 implicitly covers the new field once added — no change needed; the existing `expect(cloned).toEqual(summary)` passes as long as `unusedAttachments` contains only primitives (Pitfall 8).

---

### 9. `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.{json,atlas}` (NEW — forked fixture)

**Analog:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.{json,atlas,png}`.

**Atlas source shape (excerpt from `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas`):**

```
SIMPLE_TEST.png
size:1839,1464
filter:Linear,Linear
CIRCLE
bounds:1004,2,699,699
SQUARE
bounds:2,462,1000,1000
TRIANGLE
bounds:1004,703,833,759
```

**Delta atlas entry for SIMPLE_TEST_GHOST.atlas — append to end:**

```
GHOST
bounds:0,0,64,64
```

Per RESEARCH Pitfall 2: no `orig:` line needed. The loader accepts `atlas-bounds` provenance. The page-header `SIMPLE_TEST.png` reference can stay unchanged — the GHOST bounds point at a region inside the existing PNG; we don't need to render it because the loader consumes atlas metadata, not pixels (CLAUDE.md #4 — math phase does not decode PNGs).

**JSON delta — RESEARCH Finding #4 minimal mutation:**

Fork `SIMPLE_TEST.json` to `SIMPLE_TEST_GHOST.json`. Locate the `default` skin's CIRCLE slot entry (around line 120 of SIMPLE_TEST.json) and add a second key `"GHOST"` inside the CIRCLE slot's attachment dict:

```jsonc
// Before (SIMPLE_TEST.json):
"CIRCLE": {
  "CIRCLE": { /* ... existing CIRCLE mesh ... */ }
}

// After (SIMPLE_TEST_GHOST.json):
"CIRCLE": {
  "CIRCLE": { /* ... existing CIRCLE mesh unchanged ... */ },
  "GHOST":  { "width": 64, "height": 64 }   // registered, never rendered
}
```

**Requirements the planner MUST honor (from RESEARCH Finding #4):**
1. GHOST lives inside a slot's attachment dict (CIRCLE is convenient) but is NOT the slot's `attachment` default (the slot's `attachment` stays `"CIRCLE"` at `SIMPLE_TEST.json:83`).
2. No animation's `slots.*.attachment` timeline names `"GHOST"`.
3. The atlas fork MUST include the GHOST region entry, else the `load.sourceDims.get("GHOST") !== undefined` filter in `usage.ts` silently drops it and the test fails with zero unused observed (hiding the behavior, not revealing the bug).

**Also update** `SIMPLE_TEST_GHOST.atlas` page-header `SIMPLE_TEST.png` to `SIMPLE_TEST_GHOST.png` and fork the PNG file (or symlink — loader is path-agnostic; it only reads atlas metadata per CLAUDE.md #4). Simpler: keep the `SIMPLE_TEST.png` page header and point the atlas at a shared PNG — the loader doesn't verify PNG existence in the hot path. Planner picks.

---

## Shared Patterns (cross-cutting)

### Preformatted labels + raw numbers (D-35, reaffirmed by D-98)

**Source:** `src/core/analyzer.ts:65-90` (`toDisplayRow`), `src/shared/types.ts:30-51` (`DisplayRow` field list).

**Apply to:** `UnusedAttachment` interface + `findUnusedAttachments` row builder. Every aggregated row must carry BOTH raw numeric fields (`sourceW`, `sourceH`, `dimVariantCount`) AND preformatted string labels (`sourceLabel`, `definedInLabel`). Renderer does zero formatting (CONTEXT.md D-35 + D-98).

**Excerpt from `src/core/analyzer.ts:84-88`:**

```ts
// preformatted labels (D-35, D-45, D-46) — single point of truth
originalSizeLabel: `${p.sourceW}×${p.sourceH}`,
peakSizeLabel: `${p.worldW.toFixed(0)}×${p.worldH.toFixed(0)}`,
scaleLabel: `${p.peakScale.toFixed(3)}×`,
sourceLabel: p.animationName,
frameLabel: String(p.frame),
```

**Delta for `usage.ts`:**

```ts
const sourceLabel = variantCount === 1
  ? `${maxW}×${maxH}`                           // D-45/D-46 `${w}×${h}` (U+00D7 multiplication sign)
  : `${maxW}×${maxH} (${variantCount} variants)`; // D-98 variant-count indicator

const definedInLabel = definedIn.join(', ');    // planner picks truncation threshold per CONTEXT Claude's Discretion
```

### structuredClone-safety (D-21, D-22)

**Source:** `src/shared/types.ts:1-17` header docblock, enforced by `tests/core/summary.spec.ts:26-32`.

**Apply to:** `UnusedAttachment` interface. Every field must be primitive / plain array / plain object. No `Set`, no `Map`, no class instances. RESEARCH Pitfall 8 specifically calls out the risk of a transient `Set<string>` leaking into the returned row.

### Font-mono everywhere (D-47, Phase 2)

**Source:** Every table cell in `GlobalMaxRenderPanel.tsx:325-371` uses `font-mono text-sm` or `font-mono text-xs`.

**Apply to:** The new Unused section's `<thead>` + `<tbody>` cells. Header uses `font-mono text-sm font-semibold` (matches existing section headers); body cells use `font-mono text-sm text-fg` and `font-mono text-sm text-fg-muted` per D-105.

### Warm-stone palette inheritance (D-12, D-13)

**Source:** `src/renderer/src/index.css:47-52` — neutrals come from `var(--color-stone-950)` ... `var(--color-stone-400)`.

**Apply to:** The new section's border (`border-border` → `--color-stone-800`), header bg (none — transparent over panel), body text (`text-fg` → `--color-stone-100`, `text-fg-muted` → `--color-stone-400`). Only the header glyph + count use `text-danger`.

### Hand-rolled over deps (D-28)

**Source:** All Phase 2/3/4 UI uses Unicode glyphs + inline JSX, no icon library.

**Apply to:** The warning glyph — use Unicode `⚠` (U+26A0). RESEARCH Finding #7 notes a possible JetBrains Mono baseline quirk; the inline SVG fallback is 8 lines of JSX if human-verify flags it.

### Atomic commit convention (inherited from Phase 4)

**Source:** Phase 4 commit log used `feat(04-overrides):` / `refactor(04-overrides):` / `docs(04):` prefixes (visible in `git log`).

**Apply to:** Phase 5 planner uses `feat(05-unused):`, `refactor(05-unused):`, `fix(05-unused):`, `docs(05):` prefixes for one-commit-per-logical-unit atomicity.

---

## No Analog Found

None. Every Phase 5 artifact has a direct analog in the codebase. This is the expected outcome per CONTEXT.md §code_context "Phase 5 is a compose-existing-primitives feature. Zero new libraries, zero new patterns, zero new boundaries."

---

## Arch.spec.ts Layer-3 Compliance Checklist for `src/core/usage.ts`

| Check | Grep Pattern | Location | `usage.ts` Compliance |
|-------|--------------|----------|------------------------|
| No renderer imports core | `/from ['"][^'"]*\/core\/\|from ['"]@core/` | tests/arch.spec.ts:25 | N/A — `usage.ts` IS in `src/core/`. Violation would be the NEW PANEL importing `src/core/usage`. Panel must import `UnusedAttachment` ONLY from `src/shared/types.ts`. |
| No platform-specific code | `/process\.platform\|os\.platform\(\)\|titleBarStyle\|trafficLightPosition\|vibrancy:\|visualEffectState/` | tests/arch.spec.ts:39 | Clean — zero platform code in pure-TS Set arithmetic. |
| No filesystem imports | `/from ['"]node:(fs\|path\|child_process\|net\|http)['"]/` + `/from ['"]sharp['"]/` | tests/core/analyzer.spec.ts:191-193 (Phase 5 spec replicates) | Clean — `usage.ts` consumes pre-loaded `LoadResult`, no I/O. |
| No DOM imports | (implied by CLAUDE.md #5) | self-enforced | Clean — no `document` / `window` / React symbol. |
| No spine-core runtime imports | (self-imposed, mirrors `src/core/analyzer.ts`) | planner writes spec | `usage.ts` uses type-only imports from `./types.js` + `./sampler.js` + `../shared/types.js`. No `@esotericsoftware/spine-core` value imports. |

**Forbidden literals (RESEARCH "Grep-literal-in-comments compliance" / CLAUDE.md Phase 2 lessons):**

Because `tests/arch.spec.ts:39` greps for platform tokens in file CONTENT (not imports), a JSDoc comment like `// e.g., process.platform === 'darwin' — not used here` would trip the grep. Write prose that avoids the forbidden substrings entirely. Do NOT write `process.platform` even in a docblock as an example-of-what-not-to-do.

---

## Metadata

**Analog search scope:**
- `src/core/*.ts` (analyzer.ts = primary analog)
- `src/main/summary.ts` (iteration canonical reference)
- `src/shared/types.ts` (IPC contract extension precedent)
- `src/renderer/src/index.css` (token extension precedent)
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (host panel)
- `tests/core/*.spec.ts` (test shapes)
- `tests/arch.spec.ts` (Layer 3 boundary rules)
- `fixtures/SIMPLE_PROJECT/*` (fork targets)

**Files scanned:** 11 source files + 3 spec files + 2 fixture files + 1 arch spec = 17 files directly read for pattern extraction.

**Pattern extraction date:** 2026-04-24
