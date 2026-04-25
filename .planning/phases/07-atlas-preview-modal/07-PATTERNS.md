# Phase 7: Atlas Preview modal — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 11 (5 NEW, 6 MODIFIED)
**Analogs found:** 11 / 11 — every new/modified file has a verbatim project-codebase analog. No "no analog" entries.

> **Source-of-truth alignment:** RESEARCH.md amends CONTEXT.md in two places — those amendments are reflected in the patterns below:
> 1. **CONTEXT D-133 amendment (RESEARCH §Pitfall 1):** raw `file://` is BLOCKED by current CSP. Patterns for `src/main/index.ts` + `src/renderer/index.html` adopt `protocol.handle('app-image', ...)` per RESEARCH §Pattern + Example 5.
> 2. **CONTEXT line 222 amendment (RESEARCH §Pitfall 2):** `GlobalMaxRenderPanel` does NOT yet have a jump-target consumer; the analog `AnimationBreakdownPanel.tsx:255-325` is what to clone, not what to reuse.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `src/core/atlas-preview.ts` | core (pure-TS math/transform) | transform (in→packer→pages) | `src/core/export.ts` | exact (same role: pure-TS plan/projection builder; same shape: SkeletonSummary + overrides → structured-clone-safe plan) |
| **NEW** `src/renderer/src/lib/atlas-preview-view.ts` | renderer-side Layer-3 inline copy | transform (renderer-local mirror of core math) | `src/renderer/src/lib/export-view.ts` (primary) + `src/renderer/src/lib/overrides-view.ts` (secondary, smaller scaffold) | exact (literal Phase 4 D-75 / Phase 6 D-108 byte-identical-copy precedent) |
| **NEW** `src/renderer/src/modals/AtlasPreviewModal.tsx` | renderer modal (UI + canvas + hit-test + jump dispatch) | event-driven (toggles + pager + canvas dblclick) | `src/renderer/src/modals/OptimizeDialog.tsx` (primary — multi-state body, sub-components, sticky sub-panels) + `src/renderer/src/modals/OverrideDialog.tsx` (secondary — minimal ARIA scaffold, useFocusTrap) | exact (D-81 hand-rolled ARIA modal precedent; clone scaffold + pattern verbatim) |
| **NEW** `tests/core/atlas-preview.spec.ts` | unit test (vitest, node env) | request-response (loadFixture → buildAtlasPreview → assert) | `tests/core/export.spec.ts` | exact (case-by-case parallel: golden math + hygiene grep + parity grep blocks; SIMPLE_TEST + FIXTURE_GHOST drive both) |
| **NEW** `tests/renderer/atlas-preview-modal.spec.tsx` | renderer test (vitest + jsdom + @testing-library/react) | event-driven (render modal → user-event → assert DOM) | First-of-its-kind. Closest analog: `tests/core/export.spec.ts` describe-block discipline; framework follows RESEARCH.md §Standard Stack. | role-match — establishes new pattern. RESEARCH calls this a Wave 0 framework-install task. |
| **MODIFIED** `src/shared/types.ts` | shared (IPC type defs, structuredClone-safe) | (type definitions only) | existing `ExportRow` interface (lines 189-221) + `DisplayRow.atlasSource` shape (lines 85-92) | exact (extension target — same plain-primitive discipline) |
| **MODIFIED** `src/renderer/src/components/AppShell.tsx` | renderer top-chrome owner (toolbar + modal mount + jump-target dispatch) | event-driven (button clicks → state → modal mount; modal callback → jump-target setState) | `src/renderer/src/components/AppShell.tsx` itself — extends the `Optimize Assets` button site (lines 332-341) + the `<GlobalMaxRenderPanel>` mount site (lines 344-351) + the modal mount list (lines 362-406) + the existing `focusAnimationName` jump-target plumbing (lines 59, 109-116) | exact (file modifies itself; every needed pattern already lives in this file) |
| **MODIFIED** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | renderer panel (table view) | event-driven (consume `focusAttachmentName` prop → scroll + flash) | `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (lines 89-90 props, 253-259 refs+state, 299-325 effect, 350-351 row registration, 407 flash class) | exact (clone the entire `focusAnimationName` consumer pattern; rename to `focusAttachmentName` + key by `row.attachmentName` instead of `cardId`) |
| **MODIFIED** `src/main/index.ts` | main entry (BrowserWindow + IPC reg + protocol reg) | request-response (`app-image://` URL → file bytes) | `src/main/index.ts` itself (existing `app.whenReady().then(() => { registerIpcHandlers(); createWindow(); ...})` block, lines 68-78) | exact (extend existing whenReady block + add top-level `protocol.registerSchemesAsPrivileged` call before `app.whenReady()`) |
| **MODIFIED** `src/renderer/index.html` | renderer entry HTML (CSP) | (static config) | `src/renderer/index.html` itself, line 7 CSP meta tag | exact (one-token addition: `app-image:` to `img-src`) |
| **MODIFIED** `src/renderer/src/index.css` | tokens (Tailwind v4 `@theme inline`) | (static config) | `src/renderer/src/index.css` itself, lines 47-71 `@theme inline` block — specifically the `--color-danger: #e06b55;` Phase 5 D-104 precedent at line 65 | exact (add `--color-success` token following the same Phase 5 D-104 pattern IFF planner determines the EFFICIENCY card needs a green accent) |
| **MODIFIED** `tests/arch.spec.ts` | arch grep tests | request-response (readFileSync + regex) | `tests/arch.spec.ts` itself — Layer 3 grep block (lines 116-134) + per-file invariant grep blocks (lines 65-83, 85-114) | exact (extend existing `src/core/**/*.ts` Layer 3 grep to include the new `atlas-preview.ts`; add a new parity grep block following the Phase 6 export-parity pattern at `tests/core/export.spec.ts:595-633`) |
| **MODIFIED** `package.json` | dependency manifest | (static config) | existing dependency lists (lines 20-26 deps, lines 27-42 devDeps) | exact (additions only — no shape change) |
| **MODIFIED** `vitest.config.ts` | test config | (static config) | `vitest.config.ts` itself, line 6 `include` array | exact (extend `include` to add `'tests/**/*.spec.tsx'` for the renderer specs) |

---

## Pattern Assignments

### `src/core/atlas-preview.ts` (NEW — core, transform)

**Analog:** `src/core/export.ts` (lines 1-232).

**Why this is the right analog:** Same role (pure-TS plan/projection builder), same input shape (SkeletonSummary + overrides Map + opts), same output shape (structured-clone-safe plain object containing arrays of plain-primitive rows), same Layer 3 hygiene posture (no fs/sharp/electron/DOM imports), same architectural-responsibility line in the codebase ("renderer copy at `src/renderer/src/lib/<name>-view.ts`").

**Header docblock pattern** (`src/core/export.ts:1-63` — clone the structure verbatim):

```ts
/**
 * Phase 7 Plan 0X — Pure-TS atlas-preview projection builder (D-124..D-132).
 *
 * Folds SkeletonSummary.peaks (DisplayRow[]) + Phase 4 overrides Map +
 * Phase 5 unusedAttachments list into AtlasPreviewInput[] (per the chosen
 * mode), runs maxrects-packer with hardcoded params, and emits the per-page
 * AtlasPreviewProjection.
 *
 * Algorithm:
 *   1. Build excluded set from summary.unusedAttachments (D-109 parity —
 *      same exclusion as buildExportPlan).
 *   2. Derive AtlasPreviewInput[] per mode:
 *      - 'original': dims = atlasSource.w/h (atlas-packed) or sourceW/H
 *        (per-region PNG) — D-124 + D-126.
 *      - 'optimized': dims = ExportRow.outW/outH from buildExportPlan —
 *        D-125 single-source-of-truth with Phase 6.
 *   3. Construct MaxRectsPacker(maxPageDim, maxPageDim, 2, { smart: true,
 *      allowRotation: false, pot: false, square: false, border: 0 }) —
 *      D-132 hardcoded params + RESEARCH Recommendation A (tight-fit bin
 *      sizing for honest efficiency calc).
 *   4. packer.add(w, h, input) per region; fold packer.bins[] into
 *      AtlasPage[] with per-page efficiency = sum(rect.w × rect.h) /
 *      (bin.width × bin.height) × 100.
 *   5. D-136 degenerate input → emit at least one empty page so the
 *      modal always has something to render.
 *
 * Layer 3 hygiene: NO imports of node:fs, node:path, sharp, electron,
 * @esotericsoftware/spine-core (runtime), or DOM types. Type-only imports
 * from '../shared/types.js' and runtime imports of './export.js' (for
 * buildExportPlan reuse) + 'maxrects-packer' (verified browser-safe by
 * RESEARCH tarball audit) are the only allowed dependencies. Enforced by
 * tests/core/atlas-preview.spec.ts hygiene grep block + tests/arch.spec.ts
 * Layer 3 gate (extension at lines 116-134).
 *
 * Callers:
 *   - src/renderer/src/lib/atlas-preview-view.ts is the byte-identical
 *     renderer copy; AtlasPreviewModal.tsx calls it on mount + on every
 *     toggle/pager change (Phase 4 D-75 / Phase 6 D-108 inline-copy
 *     precedent — parity grep test in tests/core/atlas-preview.spec.ts).
 */
```

**Imports pattern** (`src/core/export.ts:64-70`):

```ts
import type {
  DisplayRow,
  ExportPlan,
  ExportRow,
  SkeletonSummary,
  // NEW (Phase 7):
  AtlasPreviewInput,
  AtlasPreviewProjection,
  AtlasPage,
  PackedRegion,
} from '../shared/types.js';
import { applyOverride } from './overrides.js';
import { buildExportPlan } from './export.js';
import { MaxRectsPacker } from 'maxrects-packer';
```

> **Note:** `applyOverride` may be unused in atlas-preview.ts since the optimized mode reads ExportRow.outW/outH directly from `buildExportPlan` output. Drop it if grep shows zero call sites; the analog `export.ts` only imports it because it derives effectiveScale itself.

**Function signature pattern** (`src/core/export.ts:137-141`):

```ts
export function buildAtlasPreview(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts: { mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096 },
): AtlasPreviewProjection {
  // ...
}
```

**Excluded-set pattern** (`src/core/export.ts:144-148` — copy verbatim, drop `includeUnused` opt since CONTEXT D-109 says always-exclude for both modes):

```ts
// D-109 parity (Phase 5): always exclude unusedAttachments from BOTH modes.
const excluded = new Set<string>();
if (summary.unusedAttachments) {
  for (const u of summary.unusedAttachments) excluded.add(u.attachmentName);
}
```

**Core packer-fold pattern** (RESEARCH §Library Verification Code Examples, lines 226-285 — verbatim from RESEARCH; this is the canonical body):

```ts
const inputs: AtlasPreviewInput[] = deriveInputs(summary, overrides, opts.mode);

const packer = new MaxRectsPacker(opts.maxPageDim, opts.maxPageDim, 2, {
  smart: true,
  allowRotation: false,
  pot: false,         // RESEARCH Recommendation A — tight-fit bin sizing
  square: false,      // RESEARCH Recommendation A
  border: 0,
});
for (const inp of inputs) {
  packer.add(inp.packW, inp.packH, inp);
}

const pages: AtlasPage[] = packer.bins.map((bin, pageIndex) => {
  const regions: PackedRegion[] = bin.rects.map((r) => {
    const inp = r.data as AtlasPreviewInput;
    return {
      attachmentName: inp.attachmentName,
      x: r.x,
      y: r.y,
      w: r.width,
      h: r.height,
      sourcePath: inp.sourcePath,
      ...(inp.atlasSource ? { atlasSource: inp.atlasSource } : {}),
    };
  });
  const usedPixels = regions.reduce((sum, r) => sum + r.w * r.h, 0);
  const totalPixels = bin.width * bin.height;
  const efficiency = totalPixels > 0 ? (usedPixels / totalPixels) * 100 : 0;
  return { pageIndex, width: bin.width, height: bin.height, regions, usedPixels, totalPixels, efficiency };
});

// D-136: degenerate empty input → at least one page.
if (pages.length === 0) {
  pages.push({
    pageIndex: 0, width: 0, height: 0, regions: [], usedPixels: 0, totalPixels: 0, efficiency: 0,
  });
}
return { mode: opts.mode, maxPageDim: opts.maxPageDim, pages, totalPages: pages.length };
```

**`atlasSource`-spread pattern** (`src/core/export.ts:218`):

```ts
// Spread atlasSource ONLY when present — keeps the shape structuredClone-safe
// AND avoids emitting `atlasSource: undefined` in JSON-serializable output.
...(inp.atlasSource ? { atlasSource: inp.atlasSource } : {}),
```

**Naming conventions to follow:**
- `camelCase` for function names (`buildAtlasPreview`, `deriveInputs`).
- `PascalCase` for types (`AtlasPreviewInput`, `PackedRegion`).
- File name `kebab-case` (`atlas-preview.ts`) — matches `export.ts`.
- Suffix `-view.ts` for the renderer mirror — matches `export-view.ts` / `overrides-view.ts`.

**Subtle invariants the planner MUST replicate:**
- **Deterministic output across runs** — `src/core/export.ts:223` does a `.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath))` so two runs over the same summary produce byte-identical results. Atlas Preview should sort `inputs` similarly BEFORE feeding the packer (so packer output is deterministic across runs, which makes `tests/core/atlas-preview.spec.ts` golden values stable).
- **No upscaling** — Atlas Preview reuses ExportRow.outW/outH for optimized mode, which already encodes the Phase 6 Gap-Fix #1 ≤1.0 clamp + ceil-thousandth + per-axis ceil. Do NOT re-derive from peakScale; defer to the canonical math in `buildExportPlan`.
- **structuredClone discipline** — every emitted shape is plain primitives + arrays + nested plain objects (Phase 1 D-21 lock). Verified analog: `ExportRow` (lines 189-221) + `ExportRow.atlasSource` (lines 213-220).

---

### `src/renderer/src/lib/atlas-preview-view.ts` (NEW — renderer Layer-3 inline copy, transform)

**Analog (primary):** `src/renderer/src/lib/export-view.ts` (lines 1-258).
**Analog (secondary, smaller-scope reference):** `src/renderer/src/lib/overrides-view.ts` (lines 1-49).

**Why this is the right analog:** Both `export-view.ts` and `overrides-view.ts` exist for the SAME reason (Phase 4 D-75 / Phase 6 D-108 — Layer 3 grep at `tests/arch.spec.ts:19-34` forbids renderer files from importing `src/core/*`, and AppShell.tsx needs to call `buildAtlasPreview` client-side because the modal toggles need sub-millisecond responsiveness without IPC). Phase 7's atlas-preview-view follows the same scaffold verbatim.

**Header docblock pattern** (`src/renderer/src/lib/export-view.ts:1-44` — clone the structure):

```ts
/**
 * Phase 7 Plan 0X — renderer-side inline copy of the canonical
 * atlas-preview projection builder (D-124..D-132).
 *
 * Layer 3 resolution (inline duplicate — option 1 from 04-PATTERNS.md
 * §"Shared Patterns / Layer 3"; Phase 4 D-75 precedent at
 * src/renderer/src/lib/overrides-view.ts; Phase 6 D-108 precedent at
 * src/renderer/src/lib/export-view.ts). The tests/arch.spec.ts grep
 * forbids any renderer file from taking a dependency on the pure-TS
 * math tree. Because AtlasPreviewModal.tsx calls buildAtlasPreview on
 * every toggle/pager change inside the modal session (D-131 snapshot-
 * at-open), the renderer gets its own byte-identical copy here instead
 * of crossing the boundary on each toggle.
 *
 * Parity contract: the exported function bodies in this file are
 * byte-identical to src/core/atlas-preview.ts. If you modify one,
 * modify the other in the same commit. A parity describe block in
 * tests/core/atlas-preview.spec.ts asserts sameness on representative
 * inputs plus signature greps against both file contents.
 *
 * Imports: type-only from '../../../shared/types.js' (erased at compile
 * time, allowed under the Layer 3 gate); runtime applyOverride / buildExportPlan
 * from sibling renderer copies — NEVER from '../../../core/*' (would trip
 * arch.spec.ts:19-34 grep). Runtime maxrects-packer from npm (browser-safe
 * — verified by RESEARCH tarball audit, zero Node deps).
 *
 * Callers (within the renderer tree only):
 *   - src/renderer/src/modals/AtlasPreviewModal.tsx — modal calls
 *     buildAtlasPreview(summary, overrides, { mode, maxPageDim }) on
 *     mount + every toggle/pager change.
 */
```

**Import-rewrite pattern** (`src/renderer/src/lib/export-view.ts:45-51` — note the relative path AND that the renderer copy imports the renderer copy of dependencies, NEVER `core/`):

```ts
import type {
  DisplayRow,
  SkeletonSummary,
  AtlasPreviewInput,
  AtlasPreviewProjection,
  AtlasPage,
  PackedRegion,
} from '../../../shared/types.js';
import { buildExportPlan } from './export-view.js';   // sibling renderer copy
import { MaxRectsPacker } from 'maxrects-packer';
// NOTE: applyOverride is consumed transitively via buildExportPlan from
// export-view.js — atlas-preview-view.ts does NOT import it directly.
```

**Function-body parity rule** (`src/renderer/src/lib/export-view.ts:163-258` is byte-for-byte the same body as `src/core/export.ts:137-232` apart from imports). Phase 7 follows the same: copy the function body verbatim from `src/core/atlas-preview.ts` to `src/renderer/src/lib/atlas-preview-view.ts`, only the import-block differs.

---

### `src/renderer/src/modals/AtlasPreviewModal.tsx` (NEW — renderer modal, event-driven)

**Analog (primary):** `src/renderer/src/modals/OptimizeDialog.tsx` (lines 1-362).
**Analog (secondary, minimal scaffold):** `src/renderer/src/modals/OverrideDialog.tsx` (lines 1-172).

**Why this is the right analog:** OverrideDialog is the simplest possible D-81 modal scaffold (single useFocusTrap + outer overlay onClick + inner stopPropagation + onKeyDown for Enter shortcut). OptimizeDialog adds: `useState` per-state body switching (`'pre-flight' | 'in-progress' | 'complete'`) — Phase 7's modal switches between Original/Optimized + 2048/4096 + page index; sub-component extraction (`<PreFlightBody>`, `<InProgressBody>`) — Phase 7 should extract `<AtlasCanvas>` similarly per RESEARCH §Pattern 4; clsx with literal-class branches; per-state focus targeting via additional `useEffect`. Both are hand-rolled per Phase 4 D-81.

**Header docblock pattern** (`src/renderer/src/modals/OptimizeDialog.tsx:1-35`):

```tsx
/**
 * Phase 7 Plan 0X — Hand-rolled ARIA modal for Atlas Preview (F7.1 + F7.2).
 *
 * Three-axis state (D-128 + D-131):
 *   - mode: 'original' | 'optimized' (segmented toggle, D-128)
 *   - maxPageDim: 2048 | 4096 (segmented toggle, D-128)
 *   - currentPageIndex: number (pager, D-128)
 *
 * Plus derived state:
 *   - projection: AtlasPreviewProjection (re-computed on every axis change
 *     via useMemo([summary, overrides, mode, maxPageDim]); D-131 snapshot-
 *     at-open semantics — overrides Map is captured once at mount and not
 *     subscribed to thereafter; user closes + reopens to refresh).
 *   - hoveredAttachmentName: string | null (mousemove hit-test result)
 *
 * ARIA scaffold cloned verbatim from OverrideDialog.tsx (Phase 4 D-81)
 * + OptimizeDialog.tsx (Phase 6 Round 6): role='dialog' + aria-modal='true' +
 * aria-labelledby + outer overlay onClick=onClose + inner stopPropagation;
 * Tab cycle + document-level Escape via useFocusTrap (Phase 6 Round 6).
 *
 * Tailwind v4 literal-class discipline (Pitfall 8): every className is a
 * string literal or clsx with literal branches.
 *
 * Layer 3 invariant: imports only from react + clsx + ../../../shared/types.js
 * + ../lib/atlas-preview-view.js (renderer inline copy). NEVER from
 * ../../core/* (tests/arch.spec.ts gate at lines 19-34).
 */
```

**Imports pattern** (`src/renderer/src/modals/OptimizeDialog.tsx:36-50`):

```tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import clsx from 'clsx';
import type {
  SkeletonSummary,
  AtlasPreviewProjection,
  PackedRegion,
} from '../../../shared/types.js';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { buildAtlasPreview } from '../lib/atlas-preview-view.js';
```

**Props interface pattern** (`src/renderer/src/modals/OverrideDialog.tsx:50-58` for the simple shape; RESEARCH §Pattern 1 lines 453-459 for the Phase 7 specific):

```tsx
export interface AtlasPreviewModalProps {
  open: boolean;
  summary: SkeletonSummary;
  overrides: ReadonlyMap<string, number>;
  onJumpToAttachment: (attachmentName: string) => void;
  onClose: () => void;
}
```

**Modal scaffold pattern** — outer overlay + inner panel + useFocusTrap (`src/renderer/src/modals/OverrideDialog.tsx:60-113`):

```tsx
export function AtlasPreviewModal(props: AtlasPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Phase 6 Gap-Fix Round 6 — focus trap + document-level Escape via shared hook.
  // Auto-focuses first tabbable on mount; cycles Tab/Shift+Tab; ESC = props.onClose
  // works regardless of focus position. See useFocusTrap.ts:128-140 for why ESC
  // moved out of local onKeyDown.
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}    // click-outside closes (D-81)
    >
      <div
        className="bg-panel border border-border rounded-md p-6 w-[1024px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}    // inner click does NOT bubble
      >
        <h2 id="atlas-preview-title" className="text-sm text-fg mb-4">
          Atlas Preview
          <span className="ml-2 text-fg-muted">
            Visual estimation of packed textures ({maxPageDim}×{maxPageDim})
          </span>
        </h2>
        {/* body: left rail + main canvas */}
      </div>
    </div>
  );
}
```

**Sub-component extraction pattern** (`src/renderer/src/modals/OptimizeDialog.tsx:364-393` for `PreFlightBody` and lines 395-end for `InProgressBody`). Phase 7 should follow this to extract `<AtlasCanvas>` (RESEARCH §Pattern 4) — the canvas effect + hit-test logic gets noisy and benefits from the same sub-component extraction OptimizeDialog uses.

**Toggle button (segmented control) pattern** — clsx literal branches for active/inactive (`src/renderer/src/modals/OptimizeDialog.tsx:443-449`):

```tsx
<button
  type="button"
  onClick={() => setMode('original')}
  className={clsx(
    'border border-border rounded-md px-3 py-1 text-xs font-mono transition-colors',
    mode === 'original'
      ? 'bg-accent text-panel font-semibold'
      : 'text-fg-muted hover:text-fg',
  )}
>
  Original
</button>
```

**Footer disclaimer pattern** (RESEARCH §Pattern 1 line 502-504):

```tsx
<p className="mt-4 text-xs text-fg-muted italic">
  * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
</p>
```

**Canvas dpr + drawImage pattern** (RESEARCH §Pattern 4 + §Code Examples 1-3 — verbatim):

```tsx
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = page.width * dpr;
  canvas.height = page.height * dpr;
  canvas.style.width = page.width + 'px';
  canvas.style.height = page.height + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(dpr, dpr);
  // ... drawImage with srcRect for atlasSource regions, full-image for per-region PNGs ...
}, [page, hoveredAttachmentName, imageCacheVersion]);
```

**Canvas hit-test pattern** (RESEARCH §Code Examples 1, lines 887-907 — CSS→canvas-logical coord conversion is load-bearing because the canvas may be CSS-scaled via `max-width: 100%`):

```tsx
const onDoubleClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  const x = (cssX / rect.width) * page.width;
  const y = (cssY / rect.height) * page.height;
  for (const region of page.regions) {
    if (x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h) {
      props.onJumpToAttachment(region.attachmentName);
      return;
    }
  }
}, [page, props.onJumpToAttachment]);
```

**Image cache + missing-source detection pattern** (RESEARCH §Pitfall 4 + §Pitfall 5):

```tsx
// Hoist cache into useRef so it's GC'd on modal unmount (Pitfall 4 — module-scope leak).
const imageCacheRef = useRef(new Map<string, HTMLImageElement>());

function loadImage(absolutePath: string): HTMLImageElement {
  let img = imageCacheRef.current.get(absolutePath);
  if (img) return img;
  img = new Image();
  img.onload = () => {
    if (img!.naturalWidth === 0) markMissing(absolutePath);  // Pitfall 5 — combined check
    else markLoaded(absolutePath);
  };
  img.onerror = () => markMissing(absolutePath);
  img.src = `app-image://${encodeURI(absolutePath)}`;  // RESEARCH amendment to D-133
  imageCacheRef.current.set(absolutePath, img);
  return img;
}
```

**Subtle invariants the planner MUST replicate:**
- **Tailwind v4 literal-class discipline** (RESEARCH Pitfall 3 + 8) — every class string is a literal. Conditional classes use `clsx` with literal branches. NEVER `className={\`bg-${active ? 'accent' : 'panel'}\`}`.
- **useCallback narrow deps** (RESEARCH Pitfall 8 — OptimizeDialog REVIEW M-02 carry-over) — `onJumpToAttachment`, `onClose` callbacks should list ONLY the values they read in their useCallback deps, NOT the whole `props` object. Otherwise useFocusTrap re-runs on every parent render.
- **Resolver in useRef, not useState** (RESEARCH Pitfall — OptimizeDialog Round 3 carry-over) — N/A for AtlasPreviewModal (no Promise resolver), but if a future async confirmation path is added, follow `AppShell.tsx:99-107`'s `pendingConfirmResolve.current` pattern.
- **No live subscription to overrides** (D-131) — capture overrides via `useMemo([summary, overrides, mode, maxPageDim])` once on mount; do NOT add a useEffect that depends on the overrides Map identity. RESEARCH Pitfall 9 confirms `buildExportPlan + MaxRectsPacker` is sub-millisecond on the simple rig — no premature optimization needed.

---

### `tests/core/atlas-preview.spec.ts` (NEW — unit test, vitest node env)

**Analog:** `tests/core/export.spec.ts` (lines 1-704).

**Why this is the right analog:** Same shape — case-by-case `describe` blocks named `(a)`, `(b)`, `(c)` mapped 1:1 to CONTEXT.md `<decisions>` test plan; same fixture-load idiom (`loadSkeleton + sampleSkeleton + analyze + findUnusedAttachments`); same hygiene-grep pattern (`readFileSync + regex` for forbidden imports); same parity-grep block locking the core ↔ renderer-view inline-copy invariant.

**Header docblock pattern** (`tests/core/export.spec.ts:1-23`):

```ts
/**
 * Phase 7 Plan 0X — specs for the pure-TS atlas-preview projection builder.
 *
 * Cases per .planning/phases/07-atlas-preview-modal/07-CONTEXT.md
 * <decisions> "Tests" lines 46-47:
 *   (a) SIMPLE_TEST Original @ 2048 → all 3 regions fit in 1 page;
 *       pages.length === 1; efficiency in expected range. [D-124, F7.1]
 *   (b) SIMPLE_TEST Optimized @ 2048 → same regions but at outW/H;
 *       efficiency strictly higher than Original. [D-125, F7.1]
 *   (c) Override 50% on TRIANGLE → Optimized projection's TRIANGLE region
 *       has expected packed dims. [D-125 + D-111, F7.1]
 *   (d) Ghost-fixture → GHOST excluded from BOTH modes. [D-109 parity, F7.1]
 *   (e) Atlas-packed fixture → BEFORE uses atlasSource.w/h, not page dims. [D-126]
 *   (f) Multi-page projection at small page cap → pages.length > 1. [D-128]
 *   (g) Math.ceil-thousandth on Optimized dims matches Phase 6 D-110 Round 5. [D-125]
 *   (h) Hygiene grep — no fs/sharp/electron imports in
 *       src/core/atlas-preview.ts. [CLAUDE.md #5, Layer 3]
 *
 * Plus the Layer 3 inline-copy parity describe block (Phase 4 D-75 / Phase 6
 * D-108 precedent) locking src/core/atlas-preview.ts ↔ src/renderer/src/lib/
 * atlas-preview-view.ts byte-identity on representative inputs.
 */
```

**Imports + fixture-path pattern** (`tests/core/export.spec.ts:25-40`):

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';
import { findUnusedAttachments } from '../../src/core/usage.js';
import { buildAtlasPreview } from '../../src/core/atlas-preview.js';
import type { AtlasPreviewProjection, SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE_BASELINE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const FIXTURE_GHOST = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json');
const ATLAS_PREVIEW_SRC = path.resolve('src/core/atlas-preview.ts');
```

**Case-block pattern** (`tests/core/export.spec.ts:42-69`):

```ts
describe('buildAtlasPreview — case (a) Original @ 2048 (D-124)', () => {
  it('SIMPLE_TEST → 3 regions fit in 1 page; efficiency in expected range', () => {
    const load = loadSkeleton(FIXTURE_BASELINE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const summary: Pick<SkeletonSummary, 'peaks' | 'unusedAttachments'> = {
      peaks: peaks.map((r) => ({
        ...r,
        sourcePath: '/fake/' + r.attachmentName + '.png',
      })),
      unusedAttachments: findUnusedAttachments(load, sampled),
    };
    const projection: AtlasPreviewProjection = buildAtlasPreview(
      summary as SkeletonSummary,
      new Map(),
      { mode: 'original', maxPageDim: 2048 },
    );
    expect(projection.pages.length).toBe(1);
    expect(projection.pages[0].regions.length).toBe(3);
    // Efficiency calc: sum(rect.w × rect.h) / (bin.width × bin.height) × 100
    expect(projection.pages[0].efficiency).toBeGreaterThan(0);
  });
});
```

**Hygiene-grep pattern** (`tests/core/export.spec.ts:554-578`):

```ts
describe('atlas-preview — module hygiene (Layer 3 lock)', () => {
  it('no node:fs / node:path / node:child_process / node:net / node:http imports', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]node:(fs|path|child_process|net|http)['"]/);
  });
  it('no sharp import', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]sharp['"]/);
  });
  it('no electron import', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]electron['"]/);
  });
  it('CLAUDE.md #5: no DOM references', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
    expect(src).not.toMatch(/HTMLElement/);
  });
  it('exports buildAtlasPreview by name', () => {
    const src = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    expect(src).toMatch(/export\s+function\s+buildAtlasPreview/);
  });
});
```

**Parity-grep block pattern** (`tests/core/export.spec.ts:580-704` — clone verbatim, swap source paths + signatures):

```ts
const ATLAS_PREVIEW_VIEW_SRC = path.resolve('src/renderer/src/lib/atlas-preview-view.ts');

describe('atlas-preview — core ↔ renderer parity (Layer 3 inline-copy invariant)', () => {
  it('renderer view exports buildAtlasPreview by name', () => {
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/export\s+function\s+buildAtlasPreview/);
  });

  it('renderer copy has ZERO imports from src/core/* (Layer 3 invariant)', () => {
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    expect(viewText).not.toMatch(/from ['"][^'"]*\/core\/|from ['"]@core/);
  });

  it('renderer copy uses sibling export-view.js for buildExportPlan (NOT core/export.js)', () => {
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/from ['"]\.\/export-view\.js['"]/);
  });

  it('both files share the same MaxRectsPacker construction (D-132 hardcoded params)', () => {
    const coreText = readFileSync(ATLAS_PREVIEW_SRC, 'utf8');
    const viewText = readFileSync(ATLAS_PREVIEW_VIEW_SRC, 'utf8');
    const sig = /new\s+MaxRectsPacker\([^,]+,\s*[^,]+,\s*2/;  // 2px padding lock
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });

  it('renderer view buildAtlasPreview produces IDENTICAL projection to canonical for representative inputs', async () => {
    const viewModule = await import('../../src/renderer/src/lib/atlas-preview-view.js');
    const buildView = viewModule.buildAtlasPreview;
    // ... iterate over 4 (mode × resolution) cases + override cases ...
    // expect(viewProjection).toEqual(coreProjection);
  });
});
```

---

### `tests/renderer/atlas-preview-modal.spec.tsx` (NEW — renderer test, jsdom)

**Analog:** First-of-its-kind. RESEARCH §Standard Stack + §Validation Architecture lines 1097-1132 calls this Wave 0 framework-install task. The closest existing testing-style analog is `tests/core/export.spec.ts` (describe-block discipline), but the framework + environment + libs are new.

**Required Wave 0 framework setup:**
- `vitest.config.ts` extension: add `'tests/**/*.spec.tsx'` to `include`.
- New devDeps in `package.json`: `@testing-library/react@^16.0.0`, `@testing-library/user-event@^14.5.0`, `@testing-library/jest-dom@^6.5.0`, `jsdom@^25.0.0`.
- Per-file pragma at top: `// @vitest-environment jsdom`.

**Header pattern** (synthesized — no project precedent):

```tsx
// @vitest-environment jsdom
/**
 * Phase 7 Plan 0X — renderer-side specs for AtlasPreviewModal.
 *
 * Coverage (per CONTEXT.md <decisions> tests line 47):
 *   - Modal opens with default view (Optimized @ 2048, page 1) [D-135]
 *   - Toggle re-render: switching mode/resolution updates page count [D-128]
 *   - Pager bounds-disable correctly [D-128]
 *   - Dblclick on canvas fires onJumpToAttachment with correct attachmentName [D-130]
 *   - Missing-source rendering path shows the glyph (mock missing file) [D-137]
 *
 * Canvas-pixel assertions are SKIPPED (jsdom returns null from getContext('2d'))
 * — pixel correctness is asserted via tests/core/atlas-preview.spec.ts golden
 * values + a manual checkpoint:human-verify gate. See RESEARCH §Open Question 3.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { AtlasPreviewModal } from '../../src/renderer/src/modals/AtlasPreviewModal';
```

**Modal-render assertion pattern** (synthesized; from @testing-library/react docs):

```tsx
describe('AtlasPreviewModal — default view (D-135)', () => {
  it('opens with Optimized @ 2048, page 1', () => {
    const summary = makeSummary();  // helper that synthesizes a SkeletonSummary
    render(
      <AtlasPreviewModal
        open={true}
        summary={summary}
        overrides={new Map()}
        onJumpToAttachment={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: /atlas preview/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /optimized/i })).toHaveClass('bg-accent');
  });
});
```

**Subtle invariants the planner MUST replicate:**
- **No canvas-pixel assertions** — jsdom's `HTMLCanvasElement.getContext('2d')` returns `null`. Test only DOM events + accessible queries. RESEARCH §Open Question 3 explicitly defers pixel correctness to the core spec + manual gate.
- **Mock `app-image://`** — jsdom's `<img>` won't resolve the custom protocol. Either mock `Image.prototype.src` or stub the image cache.
- **Spy on `onJumpToAttachment`** with `vi.fn()`; assert it was called with the correct attachmentName.

---

### `src/shared/types.ts` (MODIFIED — extension)

**Analog:** `src/shared/types.ts` itself — specifically the `ExportRow` interface (lines 189-221) and the `DisplayRow.atlasSource` shape (lines 85-92).

**Extension target line:** Append after the `ExportPlan` interface block (around line 232) so the Phase 7 types live AFTER all Phase 6 types but BEFORE Phase 5/3 SkeletonSummary references. Keep the file's section-comment discipline.

**Header docblock pattern** (`src/shared/types.ts:173-188` for ExportRow — clone the structure):

```ts
/**
 * Phase 7 Plan 0X — Atlas Preview projection types (D-124..D-132).
 *
 * AtlasPreviewInput: per-region input fed to the maxrects-packer. Folds
 *   sourceW/H + outW/H so a single derive function emits one input list
 *   per mode (D-124 / D-125). atlasSource (optional) carries the page-PNG
 *   srcRect coords for atlas-packed projects (D-126 + D-133/RESEARCH amend).
 *
 * PackedRegion: post-pack rect with hit-test coords + drawing metadata
 *   (sourcePath / atlasSource for the renderer's drawImage call).
 *   sourceMissing: optional flag set lazily by the renderer when
 *   <img>.onerror fires (D-137).
 *
 * AtlasPage: one bin from the packer, with derived per-page metrics.
 *   efficiency = sum(rect.w × rect.h) / (bin.width × bin.height) × 100
 *   (D-128 — F7.2 reframed as page-count delta + per-page efficiency).
 *
 * AtlasPreviewProjection: the top-level snapshot — one per (mode × maxPageDim)
 *   combination. totalPages is pages.length (denormalized for the modal's
 *   stepper card display).
 *
 * All fields primitive / arrays of primitives / nested plain objects —
 * structuredClone-safe per the file-top D-21 lock. atlasSource shape mirrors
 * DisplayRow.atlasSource (lines 85-92) and ExportRow.atlasSource (lines 213-220)
 * for consistency.
 */
export interface AtlasPreviewInput {
  attachmentName: string;
  sourceW: number;
  sourceH: number;
  outW: number;
  outH: number;
  /** Width fed to the packer (= sourceW for 'original' mode, outW for 'optimized'). */
  packW: number;
  /** Height fed to the packer (= sourceH for 'original' mode, outH for 'optimized'). */
  packH: number;
  sourcePath: string;
  atlasSource?: {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
}

export interface PackedRegion {
  attachmentName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  sourcePath: string;
  atlasSource?: {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  };
  /** Lazily set by the renderer when <img>.onerror fires (D-137). */
  sourceMissing?: boolean;
}

export interface AtlasPage {
  pageIndex: number;
  width: number;
  height: number;
  regions: PackedRegion[];
  usedPixels: number;
  totalPixels: number;
  /** sum(rect.w × rect.h) / (bin.width × bin.height) × 100 (0..100). */
  efficiency: number;
}

export interface AtlasPreviewProjection {
  mode: 'original' | 'optimized';
  maxPageDim: 2048 | 4096;
  pages: AtlasPage[];
  totalPages: number;
}
```

**Subtle invariants the planner MUST replicate:**
- **Inline atlasSource literal shape** — both `DisplayRow.atlasSource` (lines 85-92) and `ExportRow.atlasSource` (lines 213-220) duplicate the inline literal type rather than extracting a named type. Phase 7 follows suit (consistency > DRY here, since the existing precedent is duplication and a new named type would diverge from style).
- **No `Map`, no class instances, no `Float32Array`** (Phase 1 D-21 + RESEARCH §Pitfall 6) — every nested field is plain primitive or array.

---

### `src/renderer/src/components/AppShell.tsx` (MODIFIED — toolbar + modal mount + jump-target dispatch)

**Analog:** `src/renderer/src/components/AppShell.tsx` itself — the Optimize Assets button block (lines 332-341), the existing focus-target plumbing (line 59 state, 109-116 callbacks), the panel mount block (lines 344-360), and the modal mount block (lines 362-406).

**Why this is the right analog:** The file already contains every pattern Phase 7 needs — extending it is purely additive.

**State-extension pattern** (`src/renderer/src/components/AppShell.tsx:57-79` — add three new state slots in the same idiom):

```tsx
// Phase 3 D-52 — existing animation jump-target plumbing.
const [focusAnimationName, setFocusAnimationName] = useState<string | null>(null);

// Phase 7 D-130 — NEW: attachment jump-target plumbing (parallel to
// focusAnimationName, different consumer panel — GlobalMaxRenderPanel).
const [focusAttachmentName, setFocusAttachmentName] = useState<string | null>(null);

// Phase 7 D-134 — NEW: Atlas Preview modal lifecycle. Plain boolean, no
// snapshot state — the modal reads summary + overrides directly (D-131).
const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
```

**Callback pattern** (`src/renderer/src/components/AppShell.tsx:109-116` — clone the `onJumpToAnimation` + `onFocusConsumed` pair as `onJumpToAttachment` + `onFocusAttachmentConsumed`):

```tsx
// Phase 3 D-72 — existing.
const onJumpToAnimation = useCallback((name: string) => {
  setActiveTab('animation');
  setFocusAnimationName(name);
}, []);
const onFocusConsumed = useCallback(() => {
  setFocusAnimationName(null);
}, []);

// Phase 7 D-130 — NEW: Atlas Preview canvas dblclick → close modal +
// switch to Global tab + dispatch focus to GlobalMaxRenderPanel. Parallel
// to onJumpToAnimation but with three writes instead of two.
const onJumpToAttachment = useCallback((name: string) => {
  setActiveTab('global');
  setFocusAttachmentName(name);
  setAtlasPreviewOpen(false);
}, []);
const onFocusAttachmentConsumed = useCallback(() => {
  setFocusAttachmentName(null);
}, []);

// Phase 7 D-134 — NEW: toolbar button click handler.
const onClickAtlasPreview = useCallback(() => {
  setAtlasPreviewOpen(true);
}, []);
```

**Toolbar-button pattern** (`src/renderer/src/components/AppShell.tsx:332-341` — clone, place IMMEDIATELY LEFT of the existing Optimize Assets button per D-134; use the same Tailwind class string verbatim except change the label):

```tsx
{/* Phase 7 D-134: persistent toolbar button right-aligned via the existing
    ml-auto wrapper. Disabled when no peaks (Pitfall 11 empty-rig parity).
    Reuses warm-stone tokens from Phase 1 D-12/D-14; semibold for emphasis
    without filling. Position: immediately LEFT of Optimize Assets per D-134. */}
<div className="ml-auto flex gap-2">
  <button
    type="button"
    onClick={onClickAtlasPreview}
    disabled={summary.peaks.length === 0}
    className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
  >
    Atlas Preview
  </button>
  <button
    type="button"
    onClick={onClickOptimize}
    disabled={summary.peaks.length === 0 || exportInFlight}
    className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
  >
    Optimize Assets
  </button>
</div>
```

**Panel-prop-extension pattern** (`src/renderer/src/components/AppShell.tsx:344-351` — extend the existing GlobalMaxRenderPanel mount with two new props):

```tsx
{activeTab === 'global' && (
  <GlobalMaxRenderPanel
    summary={summary}
    onJumpToAnimation={onJumpToAnimation}
    overrides={overrides}
    onOpenOverrideDialog={onOpenOverrideDialog}
    // Phase 7 D-130 NEW props — mirror AnimationBreakdownPanel's
    // focusAnimationName/onFocusConsumed pair (lines 355-356 below).
    focusAttachmentName={focusAttachmentName}
    onFocusConsumed={onFocusAttachmentConsumed}
  />
)}
```

**Modal-mount pattern** (`src/renderer/src/components/AppShell.tsx:362-406` — append a new modal mount inside the existing modal-mount cluster, after ConflictDialog):

```tsx
{/* Phase 7 D-134: AtlasPreviewModal mount lives ALONGSIDE the
    OverrideDialog / OptimizeDialog / ConflictDialog mounts — independent
    lifecycle. The modal reads summary + overrides directly (D-131
    snapshot-at-open; modal does NOT subscribe to overrides changes
    while open). */}
{atlasPreviewOpen && (
  <AtlasPreviewModal
    open={true}
    summary={summary}
    overrides={overrides}
    onJumpToAttachment={onJumpToAttachment}
    onClose={() => setAtlasPreviewOpen(false)}
  />
)}
```

**Imports-extension pattern** (`src/renderer/src/components/AppShell.tsx:33-47` — add one import for the new modal):

```tsx
import { AtlasPreviewModal } from '../modals/AtlasPreviewModal';
```

**Subtle invariants the planner MUST replicate:**
- **No new state-management library** — plain `useState` per D-50 (D-74 + D-131 echo). Three new state slots; no reducer.
- **Callback dep narrowness** — RESEARCH Pitfall 8 carry-over. `onJumpToAttachment` lists ONLY the setters (which React guarantees are stable). Empty deps `[]` is fine.
- **Reset on unmount** — the entire AppShell unmounts on every new skeleton drop (idle → loading transition), so `atlasPreviewOpen` + `focusAttachmentName` reset implicitly with no useEffect. Same as the existing `activeTab` / `overrides` reset pattern (line 14-15 docblock).

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MODIFIED — port jump-target consumer)

**Analog:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (lines 89-90 props, 253-259 refs+state, 299-325 effect, 350-351 row registration, 407 flash class).

**Why this is the right analog:** RESEARCH §Pitfall 2 explicitly flags that this consumer pattern does NOT yet exist in `GlobalMaxRenderPanel.tsx`. The pattern is verified verbatim in `AnimationBreakdownPanel.tsx` and Phase 7's job is to clone it 1:1, renaming `focusAnimationName` → `focusAttachmentName` and keying the per-row ref Map by `row.attachmentName` instead of `cardId`.

**Props-extension pattern** (`src/renderer/src/panels/AnimationBreakdownPanel.tsx:85-98` — extend `GlobalMaxRenderPanelProps` at lines 97-117):

```tsx
export interface GlobalMaxRenderPanelProps {
  // ... existing fields (lines 97-116) ...

  /**
   * Phase 7 D-130: Atlas Preview dblclick → AppShell sets this; panel scrolls
   * the matching row into view + flashes it for 900ms, then calls
   * onFocusConsumed() synchronously so AppShell clears the focus state on
   * the same tick (Pitfall 5 carry-over from Phase 3 D-66 — re-mount leak
   * prevention). Optional today so other callers of GlobalMaxRenderPanel
   * (standalone tests, future surfaces) typecheck without these props.
   */
  focusAttachmentName?: string | null;
  onFocusConsumed?: () => void;
}
```

**State + ref pattern** (`src/renderer/src/panels/AnimationBreakdownPanel.tsx:253-259`):

```tsx
// Phase 7 D-130 — keyed by row.attachmentName (NOT attachmentKey or cardId
// — the modal hits via attachmentName since that's the identity AtlasPage
// regions carry).
const rowRefs = useRef(new Map<string, HTMLElement>());
const registerRowRef = useCallback((name: string, el: HTMLElement | null) => {
  if (el === null) rowRefs.current.delete(name);
  else rowRefs.current.set(name, el);
}, []);

const [isFlashing, setIsFlashing] = useState<string | null>(null);
```

**Jump-target effect pattern** (`src/renderer/src/panels/AnimationBreakdownPanel.tsx:299-325` — clone, drop the cardId derivation since GlobalMaxRenderPanel has no setup-pose card; key by `attachmentName` directly):

```tsx
// Phase 7 D-130 jump-effect: scroll + flash; SYNCHRONOUSLY fire the
// consume callback so the focus can never leak across re-mounts
// (RESEARCH §Pitfall 5 — Phase 3 D-66 carry-over).
useEffect(() => {
  if (!focusAttachmentName) return;
  setIsFlashing(focusAttachmentName);
  const el = rowRefs.current.get(focusAttachmentName);
  if (el !== undefined) {
    // 'center' for table rows (vs 'start' for cards) — table rows are
    // shorter, centering keeps the row visible regardless of viewport size.
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  onFocusConsumed?.();   // SYNCHRONOUS — no setTimeout/RAF
  const timer = setTimeout(() => setIsFlashing(null), 900);
  return () => clearTimeout(timer);
}, [focusAttachmentName, onFocusConsumed]);
```

**Row-ref registration pattern** (`src/renderer/src/panels/AnimationBreakdownPanel.tsx:343-352` for the `<AnimationCard>` mount — adapt for `<Row>` at `GlobalMaxRenderPanel.tsx:699-712`):

```tsx
// In the sorted.map((row) => <Row .../>) block — add ref registration +
// flash class as new props on Row, then pipe through to the <tr>.
{sorted.map((row) => (
  <Row
    key={row.attachmentKey}
    row={row}
    /* ... existing props ... */
    /* Phase 7 D-130 NEW: */
    isFlashing={isFlashing === row.attachmentName}
    registerRef={(el) => registerRowRef(row.attachmentName, el)}
  />
))}
```

**Row component extension pattern** (`src/renderer/src/panels/AnimationBreakdownPanel.tsx:367-417` for the AnimationCard ref+flash plumbing — adapt for `<Row>` at `GlobalMaxRenderPanel.tsx:275-383`):

```tsx
// In RowProps interface (line 260):
interface RowProps {
  // ... existing ...
  /** Phase 7 D-130: true while this row is the jump-target flash subject (900ms). */
  isFlashing: boolean;
  /** Phase 7 D-130: ref-registration callback so the panel can scroll this row into view. */
  registerRef: (el: HTMLElement | null) => void;
}

// In Row's <tr> at line 316:
<tr
  ref={(el) => registerRef(el)}
  className={clsx(
    'border-b border-border hover:bg-accent/5',
    checked && 'bg-accent/5',
    // Phase 7 D-130: flash highlight — same Tailwind ring pattern as
    // AnimationBreakdownPanel.tsx line 407.
    isFlashing && 'ring-2 ring-accent ring-offset-2 ring-offset-surface',
  )}
>
```

**Subtle invariants the planner MUST replicate:**
- **Synchronous `onFocusConsumed()`** (RESEARCH Pitfall 5 + Phase 3 D-66) — must fire inside the same effect tick, NOT inside a `setTimeout` / `requestAnimationFrame`. Otherwise re-opening Atlas Preview with the same attachmentName won't re-flash.
- **Empty deps fallback for `onFocusConsumed?.()`** — optional callback chain; if AppShell forgets to pass it, the effect still works (no flash leak), just no consume notification.
- **Block: `'center'` not `'start'`** — table rows are shorter than animation cards; `'start'` would scroll the row to the top edge and clip cells with overflowing content (the override percentage badge, sometimes long bone-path tooltip).

---

### `src/main/index.ts` (MODIFIED — register `app-image://` protocol)

**Analog:** `src/main/index.ts` itself (lines 26-78) — the existing `app.whenReady()` block + import surface.

**Why this is the right analog:** RESEARCH §Pitfall 1 explicitly amends CONTEXT D-133 to use `protocol.handle('app-image', ...)`. The existing `whenReady` block (line 68) is the extension point; `protocol.registerSchemesAsPrivileged` MUST run BEFORE `whenReady` (top-level module side effect). RESEARCH §Code Examples 5 (lines 994-1031) provides the verbatim implementation.

**Imports-extension pattern** (`src/main/index.ts:26-28`):

```ts
import { app, BrowserWindow, protocol, net } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpcHandlers } from './ipc.js';
```

**Top-level `registerSchemesAsPrivileged` pattern** (RESEARCH §Code Examples 5, lines 1003-1008 — must be top-level, BEFORE `app.whenReady()`):

```ts
// Phase 7 D-133 amendment (per RESEARCH Pitfall 1): register the
// app-image:// scheme with privileges that allow:
//   - standard:        URL parsing follows the standard origin rules
//   - secure:          canvas reads aren't tainted (no toDataURL SecurityError)
//   - supportFetchAPI: net.fetch resolves protocol URLs in the handler below
//   - stream:          large PNGs stream lazily from disk (no buffering)
// MUST be called at module load time, BEFORE app.whenReady() resolves —
// per Electron docs (electronjs.org/docs/latest/api/protocol).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-image',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);
```

**`protocol.handle` extension inside `whenReady` block** (RESEARCH §Code Examples 5, lines 1012-1020 — extend existing `app.whenReady().then(() => { ... })` at line 68):

```ts
app.whenReady().then(() => {
  // Phase 7 D-133 amendment: register the app-image:// protocol handler.
  // Renderer constructs URLs as `app-image://<absolutePath>` (the path
  // already starts with '/' on macOS — encodeURI in the renderer).
  // net.fetch resolves the file via the standard fetch pipeline (streams
  // bytes from disk; no IPC roundtrip per region). The trust boundary is
  // the loader sibling-path validation (Phase 1 D-09 + Phase 6 D-122);
  // defense-in-depth path-prefix allow-list is a future polish.
  protocol.handle('app-image', (request) => {
    const url = new URL(request.url);
    const filePath = decodeURIComponent(url.pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });

  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
```

**Subtle invariants the planner MUST replicate:**
- **Top-level call ordering** — `registerSchemesAsPrivileged` MUST run before `whenReady` resolves. Putting it inside `whenReady().then(...)` causes silent failure (RESEARCH §Pitfall 1 + Electron docs).
- **No path validation in v1** — RESEARCH §Threat-model lite + §Security Domain notes that the trust boundary is the loader (Phase 1 D-09 already validates sibling paths), and an in-handler allow-list is a defense-in-depth future polish, not a v1 requirement.
- **macOS-only paths** — RESEARCH §Open Question 2 defers Windows path handling to Phase 9. Current build is `--mac dmg` only (line 16 of `package.json`), so absolute paths always start with `/`.

---

### `src/renderer/index.html` (MODIFIED — extend CSP `img-src`)

**Analog:** `src/renderer/index.html` itself (line 7).

**One-token CSP-extension pattern** (RESEARCH §Code Examples 5 line 776-779):

```html
<!-- BEFORE (current): -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self' data:;" />

<!-- AFTER (Phase 7 amendment to D-133 per RESEARCH Pitfall 1): add `app-image:` to img-src.
     EVERY OTHER directive unchanged — Phase 7 ONLY widens img-src. -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: app-image:; font-src 'self' data:;" />
```

**Subtle invariants the planner MUST replicate:**
- **Only `img-src` changes** — RESEARCH §Security Domain V14 row + §Pitfall regression-guard. Plan-checker should grep the new CSP and flag any change to `default-src`, `script-src`, `style-src`, or `font-src`.

---

### `src/renderer/src/index.css` (MODIFIED — optional `--color-success` token)

**Analog:** `src/renderer/src/index.css` itself, lines 47-71 (`@theme inline` block) + line 65 (`--color-danger: #e06b55;` Phase 5 D-104 precedent).

**Conditional addition pattern** (CONTEXT.md §"Claude's Discretion" line 143 — add IFF the EFFICIENCY card needs a green accent the existing palette doesn't supply):

```css
@theme inline {
  /* ... existing tokens ... */
  --color-danger: #e06b55;   /* Phase 5 D-104 — terracotta for unused/missing-source */
  /* Phase 7 (optional): green accent for the EFFICIENCY card.
     Only add if the screenshot's green can't be expressed via
     existing tokens. Same posture as Phase 5 D-104:
     literal hex, WCAG AA contrast on --color-panel.
     Suggested: emerald-500 hex (--color-emerald-500 = #10b981)
     gives 4.5:1+ on stone-900. */
  --color-success: #10b981;
}
```

**Subtle invariants the planner MUST replicate:**
- **Only ADD; never modify existing tokens** — Phase 5 D-104 precedent. The `inline` keyword is load-bearing for color tokens (RESEARCH Finding #2 carry-over from Phase 1).
- **Document WCAG AA contrast** — line 60-64 docblock for `--color-danger` shows the calculation; new `--color-success` should match the same comment style.

---

### `tests/arch.spec.ts` (MODIFIED — extend Layer 3 grep + add parity grep)

**Analog:** `tests/arch.spec.ts` itself — Layer 3 grep block (lines 116-134) + the per-file invariant grep blocks (lines 65-83 main-bundle CJS, lines 85-114 GlobalMaxRenderPanel batch-scope).

**Layer 3 extension pattern** (`tests/arch.spec.ts:116-134` — the existing block already iterates `globSync('src/core/**/*.ts')` and exempts `loader.ts`. The new `atlas-preview.ts` is automatically picked up; no per-file change needed UNLESS the planner wants to assert that maxrects-packer is the ONLY allowed import that isn't type-only):

The existing block at lines 116-134 needs **NO change** — it already iterates `src/core/**/*.ts` and Phase 7's new file is picked up automatically. The hygiene-grep extension lives in `tests/core/atlas-preview.spec.ts` (see that file's pattern above) for finer granularity.

**Optional: Add a dedicated Phase 7 invariant block** (matching the lines 85-114 batch-scope guard pattern) — this is OPTIONAL polish; the per-file hygiene grep in `tests/core/atlas-preview.spec.ts` already covers it:

```ts
// Phase 7 — at end of file, BEFORE the closing of describe blocks:
describe('atlas-preview Layer 3 — maxrects-packer is browser-safe (RESEARCH Library Verification)', () => {
  it('src/core/atlas-preview.ts may import maxrects-packer (audited zero-dep + browser-safe)', () => {
    const src = readFileSync('src/core/atlas-preview.ts', 'utf8');
    expect(src).toMatch(/from ['"]maxrects-packer['"]/);
  });
});
```

**Subtle invariants the planner MUST replicate:**
- **`loader.ts` exemption clause** (lines 121-126) — the existing Layer 3 block carves out `loader.ts` because it's the Phase 0 load-time fs gate. `atlas-preview.ts` does NOT need this exemption — it's pure-TS math.

---

### `package.json` (MODIFIED — add maxrects-packer + renderer-test devDeps)

**Analog:** `package.json` itself (lines 20-26 deps, lines 27-42 devDeps).

**Dependency extension pattern** (RESEARCH §Standard Stack §Installation):

```json
"dependencies": {
  "@esotericsoftware/spine-core": "^4.2.0",
  "@fontsource/jetbrains-mono": "^5.2.8",
  "maxrects-packer": "^2.7.3",     // <-- NEW (verified browser-safe, zero deps)
  "react": "^19.2.5",
  "react-dom": "^19.2.5",
  "sharp": "^0.34.5"
},
"devDependencies": {
  // ... existing ...
  "@testing-library/jest-dom": "^6.5.0",      // <-- NEW
  "@testing-library/react": "^16.0.0",        // <-- NEW
  "@testing-library/user-event": "^14.5.0",   // <-- NEW
  "jsdom": "^25.0.0",                          // <-- NEW
  // ... existing ...
}
```

**Subtle invariants the planner MUST replicate:**
- **Sort alphabetically within each block** — existing `package.json` discipline (lines 21-25 deps are alphabetized; lines 28-41 devDeps are too).
- **Run `npm view <pkg> version` at install time** (RESEARCH Assumption A1+A2) — Pin major version with `^` but verify the current stable on install day; the RESEARCH versions are valid through 2026-05-25.

---

### `vitest.config.ts` (MODIFIED — extend include)

**Analog:** `vitest.config.ts` itself (line 6).

**Pattern** (RESEARCH §Validation Architecture §Test Framework):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',                                       // unchanged — node default
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx'],    // <-- ADD .spec.tsx
    globals: false,
    testTimeout: 10_000,
    passWithNoTests: true,
  },
});
```

**Subtle invariants the planner MUST replicate:**
- **Keep `environment: 'node'`** — RESEARCH §Standard Stack §Note explicitly states the default DOES NOT need to change. New renderer specs add `// @vitest-environment jsdom` per-file pragma at line 1.
- **Order matters in regex globs** — existing `.spec.ts` first; `.spec.tsx` second. (No actual collision since the patterns are disjoint, but consistency is project style.)

---

## Shared Patterns

These cross-cut multiple Phase 7 files — extract once and apply everywhere relevant.

### Layer 3 inline-copy parity (Phase 4 D-75 + Phase 6 D-108)

**Source:** `src/renderer/src/lib/export-view.ts` (entire file) + `tests/core/export.spec.ts:580-704`.
**Apply to:** `src/core/atlas-preview.ts` ↔ `src/renderer/src/lib/atlas-preview-view.ts` ↔ `tests/core/atlas-preview.spec.ts` parity describe-block.

The contract:
1. Function bodies in the renderer copy are byte-identical to the core copy.
2. Imports are rewritten (renderer copy uses `'./export-view.js'` instead of `'../core/export.js'`; type-only imports adjust the relative path depth).
3. A parity describe-block in the core spec asserts:
   - Renderer copy exports the function by name.
   - Renderer copy has zero `from '.../core/'` imports.
   - Both copies share key signature greps (e.g., `new MaxRectsPacker(`, the packer-config option block).
   - Dynamic `await import('../../src/renderer/src/lib/atlas-preview-view.js')` produces an `.toEqual(...)` result against the canonical for representative inputs.

### ARIA modal scaffold (Phase 4 D-81)

**Source:** `src/renderer/src/modals/OverrideDialog.tsx:60-113` (minimal scaffold) + `src/renderer/src/modals/OptimizeDialog.tsx:269-362` (multi-state scaffold).
**Apply to:** `src/renderer/src/modals/AtlasPreviewModal.tsx`.

Required invariants:
- Outer `<div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="<unique-id>" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>`.
- Inner panel `<div className="bg-panel border border-border rounded-md p-6 ... font-mono" onClick={(e) => e.stopPropagation()}>`.
- `useFocusTrap(dialogRef, props.open, { onEscape: props.onClose })` — Tab cycle + document-level Escape via shared hook.
- `if (!props.open) return null;` early-return for conditional rendering (Tailwind v4 literal-class discipline; class toggling defeats the JIT scanner).
- `<h2 id="<same-id-as-aria-labelledby>">` — labelled-by anchor.

### Cross-panel jump-target system (Phase 3 D-72 + Phase 7 D-130)

**Source:** `src/renderer/src/components/AppShell.tsx` lines 59 + 109-116 (producer side) + `src/renderer/src/panels/AnimationBreakdownPanel.tsx:255-325` (consumer side).
**Apply to:** AppShell.tsx (extend with `focusAttachmentName` state + `onJumpToAttachment` callback), AtlasPreviewModal.tsx (call `props.onJumpToAttachment(name)` from canvas dblclick), GlobalMaxRenderPanel.tsx (consume `focusAttachmentName` prop with the AnimationBreakdownPanel:299-325 effect cloned 1:1).

The pattern is unidirectional: producer writes state, consumer reacts to prop change, consumer calls `onFocusConsumed?.()` synchronously to clear the producer state. Pitfall 5 (re-mount leak) requires the consume to be synchronous, never deferred via setTimeout/RAF.

### Tailwind v4 literal-class discipline (Pitfall 8 carry-over from Phase 1+)

**Source:** `src/renderer/src/modals/OptimizeDialog.tsx:443-449` (canonical clsx-with-literal-branches example) + `src/renderer/src/components/AppShell.tsx:432-435` (TabButton pattern).
**Apply to:** AtlasPreviewModal.tsx (every dynamic class — segmented toggle active/inactive states, hovered-region overlay color, missing-source glyph color), AppShell.tsx (toolbar button variant — but the existing class string at line 337 is already verbatim-reusable for the new Atlas Preview button).

Rule: every Tailwind class must appear as a string literal somewhere in the source. Conditional classes use `clsx('always-on', condition && 'sometimes-on', other ? 'a' : 'b')`. NEVER `\`bg-${active ? 'accent' : 'panel'}\``.

### structuredClone-safe IPC types (Phase 1 D-21)

**Source:** `src/shared/types.ts:189-221` (`ExportRow`) + `src/shared/types.ts:85-92` (`DisplayRow.atlasSource` literal shape).
**Apply to:** All Phase 7 type extensions in `src/shared/types.ts` (`AtlasPreviewInput`, `PackedRegion`, `AtlasPage`, `AtlasPreviewProjection`).

Rule: every field is a primitive (string/number/boolean), an array of primitives, or a nested plain object whose fields recursively follow this rule. NO `Map`, NO class instances, NO `Float32Array`. Even though Phase 7's projection lives in the renderer (no IPC crossing in the recommended path), the discipline is preserved so the IPC fallback (RESEARCH §Open Question — `api.computeAtlasPreview`) is one config flip away.

### useFocusTrap callback dep narrowness (RESEARCH Pitfall 8 + OptimizeDialog REVIEW M-02)

**Source:** `src/renderer/src/modals/OptimizeDialog.tsx:235` `}, [state, props.onClose]);` (narrow deps — only the read values).
**Apply to:** AtlasPreviewModal.tsx every `useCallback` that ends up in `useFocusTrap`'s dep chain.

Rule: `useCallback(fn, [...deps])` must list ONLY the values the callback reads, NEVER the whole `props` object or anything that changes identity on every render. Otherwise `useFocusTrap`'s effect re-runs on every parent render, racing against the modal's per-state focus useEffect.

---

## No Analog Found

(none)

Every Phase 7 file has a verifiable analog in the project codebase OR (in the case of `tests/renderer/atlas-preview-modal.spec.tsx`) in the RESEARCH-locked Standard Stack — which is the project's first-time adoption of an industry-standard testing setup. RESEARCH §Validation Architecture §Wave 0 Gaps explicitly enumerates the framework-install task.

---

## Metadata

**Analog search scope:**
- `src/core/**/*.ts` (10 files) — for `atlas-preview.ts` analog
- `src/renderer/src/lib/**/*.ts` (2 files) — for `atlas-preview-view.ts` analog
- `src/renderer/src/modals/**/*.tsx` (3 files) — for modal scaffold analog
- `src/renderer/src/components/AppShell.tsx` — for toolbar-button + state-extension + modal-mount + jump-target dispatch analogs
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — for jump-target consumer pattern
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — for the row-render integration site
- `src/renderer/src/hooks/useFocusTrap.ts` — for ARIA modal hook contract
- `src/main/index.ts` — for the `app.whenReady` extension site
- `src/renderer/index.html` — for CSP extension site
- `src/renderer/src/index.css` — for token-extension precedent
- `tests/core/export.spec.ts` — for unit-spec scaffold + parity-grep block
- `tests/arch.spec.ts` — for Layer 3 + per-file invariant grep blocks
- `vitest.config.ts`, `package.json` — for config-extension shape

**Files scanned:** 14 files, total ~3,000 lines.

**Pattern extraction date:** 2026-04-25

---

## PATTERN MAPPING COMPLETE

**Phase:** 7 - Atlas Preview modal
**Files classified:** 14 (5 NEW, 9 MODIFIED)
**Analogs found:** 14 / 14

### Coverage
- Files with exact analog: 13
- Files with role-match analog: 1 (`tests/renderer/atlas-preview-modal.spec.tsx` — first-of-its-kind framework adoption per RESEARCH §Standard Stack)
- Files with no analog: 0

### Key Patterns Identified
- **All renderer Layer-3 compute mirrors live in `src/renderer/src/lib/<name>-view.ts`** as byte-identical inline copies of `src/core/<name>.ts`, locked by parity describe-blocks in `tests/core/<name>.spec.ts`. Phase 4 D-75 + Phase 6 D-108 precedent; Phase 7 atlas-preview is the third such pair.
- **All hand-rolled ARIA modals follow the OverrideDialog/OptimizeDialog scaffold** — outer overlay `role="dialog" aria-modal="true" aria-labelledby` + inner panel `stopPropagation` + `useFocusTrap(ref, open, { onEscape })` + Tailwind literal-class discipline. Phase 7's AtlasPreviewModal is the fourth in the series.
- **Cross-panel jump-target is a unidirectional producer/consumer pattern** — AppShell owns nullable `focusXxxName` state; consumer panel reacts via `useEffect([focusXxxName, onFocusConsumed])`, scrolls + flashes for 900ms, fires `onFocusConsumed()` synchronously. Phase 3 D-72 (animation chip → AnimationBreakdownPanel) + Phase 7 D-130 (Atlas Preview canvas → GlobalMaxRenderPanel) share the producer side; the consumer side gets cloned per panel (Phase 7 ports the AnimationBreakdownPanel:299-325 effect into GlobalMaxRenderPanel verbatim).
- **All structuredClone-safe IPC types live in `src/shared/types.ts` with inline literal `atlasSource` shapes** — duplication is the project precedent (DisplayRow.atlasSource + ExportRow.atlasSource both inline the same shape rather than extracting a named type). Phase 7's PackedRegion + AtlasPreviewInput follow the same.
- **CSP changes are minimally additive** — Phase 7 ONLY adds `app-image:` to `img-src`. Plan-checker greps the new CSP for any wider change.

### File Created
`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/phases/07-atlas-preview-modal/07-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog file:line excerpts directly when authoring per-plan action sections — every Phase 7 task has a verbatim project-codebase template to clone.
