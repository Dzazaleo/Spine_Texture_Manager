# Phase 7: Atlas Preview Modal — Research

**Researched:** 2026-04-25
**Domain:** Electron renderer-side 2D-canvas visualization + bin-packing projection (`maxrects-packer`) of skeleton attachment dims into Original/Optimized × 2048/4096 atlas pages.
**Confidence:** HIGH

## Summary

Phase 7 ships a hand-rolled ARIA modal (`AtlasPreviewModal.tsx`) that visualizes what the rig's atlas WOULD look like under two scenarios (Original = source-dim re-pack, Optimized = post-Phase-6 export-dim re-pack) at two resolution caps (2048 / 4096). It uses `maxrects-packer` (npm v2.7.3, **zero deps, browser-safe — verified by tarball audit**) to project regions into pages, then 2D-canvas `drawImage` to render actual region pixels into packed slots. The headline metrics are total pages and per-page fill efficiency. **F7.2's file-size delta is REINTERPRETED per CONTEXT D-127** to dims + page count + per-page efficiency — no bytes shown.

Three architectural facts shape the plan:

1. **maxrects-packer is browser-safe** (verified — Section "Library Verification" below), so the canonical projection lives in `src/core/atlas-preview.ts` with a Layer-3-byte-identical inline copy in `src/renderer/src/lib/atlas-preview-view.ts` (Phase 4 D-75 / Phase 6 D-108 precedent). No IPC fallback needed.
2. **The renderer has never decoded a PNG before.** The existing `loader.ts` reads `.json` + `.atlas` via main-side `node:fs`; no `<img>` or canvas uses `file://` today. Phase 7 is the FIRST PNG-in-renderer path. The current CSP `img-src 'self' data:` (in `src/renderer/index.html:7`) **does NOT permit `file://` images** — CONTEXT.md D-133's "the existing app already does (file:// images load)" claim is a codebase contradiction. The plan must either (a) loosen CSP to add `file:` to `img-src`, or (b) follow Electron's official recommendation and serve PNG bytes via a custom `protocol.handle('app-image://...')` registered in main. Option (b) is the lower-risk, security-aligned choice.
3. **The "jump to row in Global Max Render Source panel" gesture (D-130) is a NEW jump-target consumer.** CONTEXT.md states "GlobalMaxRenderPanel — already exposes the jumpTarget consumption pattern" — **incorrect**. The pattern exists ONLY in `AnimationBreakdownPanel.tsx` (lines 299-325, the `focusAnimationName` + `onFocusConsumed` + flash effect). `GlobalMaxRenderPanel.tsx` has no scroll/flash mechanism today. Phase 7 must port that pattern (renamed `focusAttachmentName` + per-row ref map) to `GlobalMaxRenderPanel.tsx` — a small extension, not zero work.

**Primary recommendation:** Install `maxrects-packer@^2.7.3`, build `src/core/atlas-preview.ts` as a pure-TS projection (no DOM, no fs, no spine-core runtime), mirror byte-identically into `src/renderer/src/lib/atlas-preview-view.ts` (parity grep test in Wave 0). For the renderer's pixel-rendering path, register `protocol.handle('app-image', ...)` in main and have the renderer build URLs as `app-image:///<absolute-path>`; this preserves sandbox=true + secure CSP, requires no CSP weakening, and avoids the IPC roundtrip per region. Add the missing `focusAttachmentName` jump-target consumer to `GlobalMaxRenderPanel.tsx` cloning the AnimationBreakdownPanel pattern. Renderer test framework: vitest + jsdom + @testing-library/react (canvas limitations notwithstanding — gate canvas-pixel tests behind a `node-canvas` opt-in or use vitest's `browser` mode for the canvas hit-test specs).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data sources + projection inputs (Area 1)**
- **D-124:** BEFORE view = re-pack source PNGs at original dims. "Original" mode feeds maxrects-packer with each region's source dims (per-region-PNG: `sourceW × sourceH`; atlas-packed: `atlasSource.w × atlasSource.h`). Re-pack performed even when a real `.atlas` exists — apples-to-apples symmetry with AFTER.
- **D-125:** AFTER view = `ExportRow.outW × outH` (post-Phase-6 optimization). "Optimized" mode reads exact output dims that `buildExportPlan` produces. Reflects current overrides + Phase 5 unused exclusion + ceil-thousandth math.
- **D-126:** Atlas-packed projects use `atlasSource.w × atlasSource.h` for BEFORE. Per-region declared source dims enter the re-pack as if each region were standalone PNG. Symmetric with AFTER.

**View modes + UI controls (Area 2)**
- **D-127:** F7.2 file-size estimate **EXPLICITLY DE-SCOPED** — dims + page count + per-page efficiency only. No bytes anywhere. F7.2 reframed as "projected atlas dims + page count" — verifier accepts page-count delta as F7.2 evidence.
- **D-128:** BEFORE/AFTER is segmented toggle (`Original` / `Optimized`), NOT side-by-side. Plus separate `ATLAS RESOLUTION` toggle (`2048px` / `4096px`). Plus `<` `N / total` `>` pager for multi-page projections. Cards: `TOTAL ATLASES: N` + `EFFICIENCY (PAGE N): X%`.
- **D-129:** Canvas rendering = 2D canvas, single-page view, default outline-only with hover-reveal. drawImage of source PNG content into packed slot (canvas downsamples) + strokeRect outline. Hover state: colored fill (warm-stone accent low-opacity) + label overlay.
- **D-130:** Canvas dblclick gesture jumps to texture's row in Global Max Render Source panel via Phase 3 D-72 jump-target system. Hit-test on dblclick → `onJumpToAttachment(attachmentName)` → AppShell sets activeTab='global' + dispatches jumpTarget event → modal unmounts. **Two-gesture workflow:** dblclick rect → row focused; user dblclicks peak → OverrideDialog opens.

**Packer + library (Area 2 cont.)**
- **D-132:** Packer = `maxrects-packer` (npm) with hardcoded params: 2px padding, no rotation, smart heuristic. No user-facing packer controls beyond resolution toggle.

**Trigger + dialog flow (Area 4)**
- **D-134:** Modal trigger = persistent AppShell toolbar button "Atlas Preview" next to "Optimize Assets" (D-117). Both enabled when summary loaded.
- **D-135:** Default view on open = Optimized @ 2048, page 1. Mobile-pipeline realistic.
- **D-131:** Snapshot-at-open semantics — modal reads `buildAtlasPreview(summary, overrides, opts)` once on mount + on every toggle/pager change within the open session. NO subscription to AppShell.overrides changes.
- **D-136:** Edge case — empty pack at degenerate input → render at least page 1 with `EFFICIENCY: 0%` and `TOTAL ATLASES: 1`.

**Missing-source handling (Area 5)**
- **D-137:** Missing source PNG → render rect outline + muted placeholder pattern + ⚠ glyph + hover tooltip "Source missing: <path>". Modal still opens; pack math still works (only dims matter). Detection: `<img>.onerror` flips per-region `sourceMissing: true`.

### Claude's Discretion

- **D-133 [discretion]:** Renderer loads source PNG bytes directly via `file://` + canvas `drawImage`. Per-region projects: `<img src="file:///abs/path/region.png">` per region (cached). Atlas-packed projects: load each unique `atlasSource.pagePath` once; `drawImage(pageImg, atlasSource.x, atlasSource.y, atlasSource.w, atlasSource.h, packedX, packedY, packedW, packedH)` — srcRect crops region from page atlas. **⚠ This decision is BLOCKED by the current CSP — see "Open Question 7" / "Pitfall 1" below. Planner must amend D-133 to either loosen CSP OR adopt a custom `app-image://` protocol.handle scheme.**
- **D-138 [discretion]:** Modal chrome a11y-compliant; canvas decorative with summary aria-label. Region-level keyboard navigation deferred.

**Other discretion areas (verbatim from CONTEXT.md):**
- Toolbar button styling (warm-stone tokens, label "Atlas Preview", right-of "Optimize Assets").
- Renderer test framework (Phase 4 + 6 left open; planner picks consistent — see "Validation Architecture" below).
- Modal component structure (single file vs sub-components — planner's call).
- Layer 3 boundary for maxrects-packer (verify browser-safety; preferred renderer-pure path) — **VERIFIED PURE; pure-renderer recommended.**
- Hover hit-testing performance (linear scan O(N) acceptable; spatial index only if profiling shows jank).
- Canvas DPR pattern.
- Image cache lifecycle.
- Missing-source detection runs lazily on first render; per-session cache.
- Threat-model lite (file-validated paths, no path-traversal, no prototype pollution, no network).
- `--color-success` token addition if needed.
- OptimizeDialog interaction (untouched; modals don't co-exist).

### Deferred Ideas (OUT OF SCOPE)

- Atlas re-pack (writing new `.atlas` file) — REQUIREMENTS.md "Out of scope".
- File-size estimate (F7.2 literal) — de-scoped per D-127. Future polish via sharp sample-extrapolation if requested.
- User-configurable packer params (rotation/padding/smart alternatives) — Phase 9 polish.
- Atlas page export ("Export this preview as PNG") — not requested.
- Live-reactive override updates while modal open — modal blocks panel interaction.
- More resolution options (1024 / 8192 / custom).
- Side-by-side comparison view — toggle pattern locked.
- Auto-open OverrideDialog after dblclick-jump — two-gesture workflow chosen.
- Honor originating tab on dblclick-jump — always Global panel.
- Drag-to-zoom / pinch-zoom on canvas — CSS scaling only.
- Region search inside modal.
- CLI atlas-preview command — D-102 byte-for-byte lock.
- Multi-tab / multi-window atlas previews.
- Region-level keyboard navigation.
- AtlasPreviewProjection caching across modal sessions.
- Multi-JSON shared-images preview.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F7.1 | Before/after side-by-side atlas visualization using a packer (e.g., `maxrects-packer`) | **Reframed per D-128** to toggle-switched (Original / Optimized) — same content, different layout. Library audit confirms `maxrects-packer@2.7.3` is browser-safe (zero Node deps; verified). API shape (constructor, `add()`, `bins[]`) documented in "Library Verification" + "Code Examples" sections below. |
| F7.2 | Show dimensions and estimated file-size delta | **REINTERPRETED per D-127:** dims + page count + per-page efficiency only. No bytes shown. Verifier accepts page-count delta across the Original/Optimized toggle as the F7.2 evidence. Per-page efficiency calc: `efficiency = sum(rect.w × rect.h) / (bin.width × bin.height) × 100`. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Rule | What it requires of Phase 7 |
|------|----------------------------|
| **#3 (sampler tick lifecycle)** | Phase 7 must NOT touch `src/core/sampler.ts`. Atlas Preview consumes pre-computed `summary.peaks` only. **Verified:** plan in CONTEXT.md is renderer-only + new `src/core/atlas-preview.ts`; sampler stays LOCKED. |
| **#4 (math phase doesn't decode PNGs)** | `src/core/atlas-preview.ts` MUST NOT decode pixels. PNG decode happens via browser-native canvas `drawImage` (renderer side only). `core/atlas-preview.ts` deals only with numeric dims. |
| **#5 (`core/` is pure TypeScript, no DOM)** | `src/core/atlas-preview.ts` cannot import `node:fs`, `sharp`, electron, DOM types, or anything that pulls in DOM. **Verified:** `maxrects-packer` is pure JS with zero deps (Section "Library Verification" below) — safe to import in core. The Layer 3 grep test (`tests/arch.spec.ts:116-134`) extends to scan the new file. |
| **#6 (default sampler rate 120 Hz)** | Untouched. |
| **GSD workflow** | Phase 7 plans land in `.planning/phases/07-atlas-preview-modal/`; phases execute strictly in order. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pack-projection math (Original/Optimized × 2048/4096 → AtlasPage[]) | `src/core/atlas-preview.ts` (Layer 3 pure-TS) | `src/renderer/src/lib/atlas-preview-view.ts` (Layer 3 byte-identical inline copy) | Pure number/object math; reuses existing Layer 3 inline-copy precedent (Phase 4 D-75, Phase 6 D-108) so the renderer toggles are snappy without IPC. Verified `maxrects-packer` is browser-safe. |
| Modal chrome (ARIA dialog, focus-trap, ESC, click-outside, Tab cycle) | Renderer modal `src/renderer/src/modals/AtlasPreviewModal.tsx` | Shared hook `src/renderer/src/hooks/useFocusTrap.ts` (existing) | Hand-rolled per Phase 4 D-81; clones OverrideDialog/OptimizeDialog scaffold. Hook already exists from Phase 6 Round 6. |
| Canvas pixel rendering (drawImage of region content, strokeRect outline, hover overlay) | Renderer | None (browser-native API) | drawImage's 9-arg form crops srcRect from `<img>` natural pixel space — atlas-packed projects load 1 page PNG and srcRect-crop N regions; per-region projects load 1 PNG per region. **Blocked by current CSP — see Pitfall 1.** |
| Local PNG bytes → renderer | Main process via `protocol.handle('app-image', ...)` | None | Replaces D-133's raw `file://` approach due to CSP `img-src 'self' data:` not permitting file:. Recommended Electron pattern (verified — Section "Electron CSP + file:// pattern" below). |
| Canvas dblclick → AppShell jump-target → Global panel | Modal callback `onJumpToAttachment(name)` | AppShell extension (new prop on `GlobalMaxRenderPanel.tsx`: `focusAttachmentName` + `onFocusConsumed`) | The pattern exists in `AnimationBreakdownPanel.tsx:299-325` but **not yet** in `GlobalMaxRenderPanel.tsx`. Port the same scroll+flash logic, keyed on `attachmentName` instead of `cardId`. |
| Maxrects-packer integration (constructor + `add()` per region + read `bins[]`) | `src/core/atlas-preview.ts` | None | Pure-TS; no DOM/fs/electron. |
| Hit-testing dblclick coords against `pages[i].regions[]` | Renderer | None | O(N) linear scan acceptable per CONTEXT.md (modern hardware, ≤200 regions typical). Spatial index only if profiling shows jank. |

## Library Verification

### maxrects-packer — pure-JS, browser-safe (HIGH confidence)

**Source:** Verified by tarball audit on 2026-04-25.

```bash
$ npm view maxrects-packer
maxrects-packer@2.7.3 | MIT | deps: none | versions: 28
unpackedSize: 370.5 kB
```

**Audit method:** Downloaded the published tarball + grepped every JS/TS file under `dist/`, `lib/`, `src/` for forbidden imports:

```bash
# In /tmp/mrp-probe (verified by researcher):
$ grep -RE "require\(['\"](fs|path|crypto|os|stream|child_process|node:)" \
    package/dist package/lib package/src
# zero matches across 870-line dist/maxrects-packer.js + 857-line .mjs +
# all lib/ and src/ files.
```

**Conclusion:** maxrects-packer 2.7.3 is safe to import from `src/core/atlas-preview.ts` without breaking Layer 3. The arch.spec.ts grep gate (lines 116-134) currently forbids `sharp` / `node:fs` / `fs/promises` — `maxrects-packer` does not match.

**Package layout:**
- `main: dist/maxrects-packer.js` (CommonJS, 870 lines)
- `module: dist/maxrects-packer.mjs` (ES module, 857 lines)
- `types: dist/maxrects-packer.d.ts` (single-file `.d.ts`)
- `engines: { node: ">=4.0.0" }` (irrelevant — runs in browser)
- License: MIT
- Last published: > 1 year before 2026-04-25 (stable, low-churn)

### maxrects-packer — API shape (HIGH confidence)

Constructor signature:

```ts
constructor(
  width?: number,    // page max width (default 4096)
  height?: number,   // page max height (default 4096)
  padding?: number,  // padding between rects (default 0)
  options?: IOption  // see below
);
```

`IOption` interface (verified from `dist/maxrects-packer.d.ts`):

```ts
interface IOption {
  smart?: boolean;        // default true — start at 0×0 and grow up to maxW/maxH cap
  pot?: boolean;          // default true — round bin size up to power of 2
  square?: boolean;       // default false (in MaxRectsPacker class) / true (in MaxRectsBin defaults)
  allowRotation?: boolean; // default false
  tag?: boolean;          // default false — tag-based group packing
  exclusiveTag?: boolean; // default true
  border?: number;        // default 0 — atlas edge spacing (DIFFERENT from padding)
  logic?: PACKING_LOGIC;  // 0=MAX_AREA, 1=MAX_EDGE (default = MAX_EDGE)
}
```

Add API (three overloads):

```ts
packer.add(width: number, height: number, data: any): T;
packer.add(rect: T): T;                    // T extends IRectangle = { width, height, x, y, [k:string]:any }
packer.addArray(rects: T[]): void;
```

Output: `packer.bins: Bin<T>[]`. Each `Bin` has:

```ts
interface IBin {
  width: number;
  height: number;
  maxWidth: number;
  maxHeight: number;
  freeRects: IRectangle[];
  rects: T[];           // each rect has { x, y, width, height, rot, data, oversized? }
  options: IOption;
}
```

Each rect after pack:

```ts
interface IRectangle {
  width: number;
  height: number;
  x: number;
  y: number;
  rot?: boolean;        // true if rotated (always false here since allowRotation: false)
  oversized?: boolean;  // true if rect.width > maxWidth || rect.height > maxHeight
  data?: any;           // whatever you passed as the 3rd arg / rect.data
}
```

**Smart heuristic semantics (CONTEXT.md Open Question 3 — RESOLVED):** With `smart: true`, each new bin starts at width=0, height=0 and grows incrementally as rects are added, capped at `maxWidth` × `maxHeight`. When a rect can't fit even at the cap, a new bin (page) is created. CONTEXT.md's interpretation ("incremental bin growth up to the cap before spilling to a new page") is **correct**.

**Oversized handling (CONTEXT.md Open Question 4 — RESOLVED):** A rect with `width > maxWidth || height > maxHeight` is placed alone in its own bin via `OversizedElementBin<T>` (verified at `package/src/maxrects-packer.ts:`). Each such rect becomes its own page; the page's bin.width = rect.width, bin.height = rect.height. The `oversized: true` flag is set on the rect. **Plan must check this flag** so the canvas renders the rect (still useful diagnostic) and the efficiency calc handles it (efficiency = 100% trivially since the bin equals the rect).

**Pot/square defaults (NEW — not raised in CONTEXT.md):** With smart+pot+square defaults, a small rig at maxWidth=2048 might report `bin.width=512, bin.height=512` if all rects fit in a 512² area. This is FINE for the efficiency metric (sum-of-rect-areas / bin-area still meaningful) but DIFFERENT from rendering an actual 2048×2048 atlas page. Decision needed:

| Option | Pros | Cons |
|--------|------|------|
| **A. `pot: false, square: false`** (recommended) | Bin.width × bin.height tightly tracks packed content; efficiency calc + canvas size both reflect "minimal box around the regions"; matches the screenshot's variable-aspect layout. | Diverges from Spine atlas-pack defaults. |
| **B. Keep `pot: true, square: true`** | Bin reported as power-of-2 square = visually closer to a real exported atlas page. | A rig that fits in 800×600 will report bin=1024×1024, leaving extra empty space the user did not ask for; efficiency drops artificially. |
| **C. `pot: true, square: false`** (Spine compat) | Pages always pot-aligned (power-of-2 width/height) — most realistic vs Spine's atlas packer. | Same artificial-empty-space concern, less symmetric. |

**Recommendation: Option A (`pot: false, square: false`).** The user's screenshot does NOT show a square page; the Atlas Preview is a *projection*, not a real export. The footer disclaimer ("Actual export engine may vary slightly") covers any pot-vs-non-pot delta. Tight-fit bin sizing also makes per-page efficiency more honest. *Planner: confirm with user during plan-checker if you disagree with the recommendation.*

### maxrects-packer — usage example (verified pattern)

```ts
// src/core/atlas-preview.ts (sketch — pure-TS; no DOM, no fs)
import { MaxRectsPacker } from 'maxrects-packer';
import type { SkeletonSummary, AtlasPreviewInput, AtlasPreviewProjection, AtlasPage, PackedRegion }
  from '../shared/types.js';
import { buildExportPlan } from './export.js';

export function buildAtlasPreview(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts: { mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096 },
): AtlasPreviewProjection {
  // 1. Derive AtlasPreviewInput[] per mode.
  //    Excluded: summary.unusedAttachments (D-109 parity).
  //    For 'optimized': run buildExportPlan(summary, overrides) once and read outW/outH per row.
  //    For 'original':  read sourceW/sourceH (per-region) or atlasSource.w/atlasSource.h (atlas-packed).
  const inputs: AtlasPreviewInput[] = deriveInputs(summary, overrides, opts.mode);

  // 2. Pack.
  const packer = new MaxRectsPacker(opts.maxPageDim, opts.maxPageDim, 2 /* padding D-132 */, {
    smart: true,         // D-132 smart heuristic
    allowRotation: false, // D-132 no rotation
    pot: false,          // recommendation A above (tight-fit bin sizing)
    square: false,       // recommendation A above
    border: 0,
  });
  for (const inp of inputs) {
    packer.add(inp.packW, inp.packH, inp);  // 3rd arg is `data` — survives onto rect.data
  }

  // 3. Fold into AtlasPage[] + per-page efficiency.
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
}
```

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `maxrects-packer` | `^2.7.3` | 2D bin-packing projection of region dims into Original/Optimized atlas pages | Named in ROADMAP §Phase 7 + REQUIREMENTS F7.1. MIT, zero deps, browser-safe (verified). 5+ year stable API. Successor of go/c++ ports of MaxRects-BSSF (Jukka Jylänki's 2010 paper). [VERIFIED: npm registry] |

### Supporting (already in package.json — no changes needed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `react` | `^19.2.5` | Modal component | All renderer UI |
| `clsx` | `^2.1.1` | Conditional classNames in modal | Standard project pattern (Phase 4 D-81 + Phase 6) |
| `electron` | `^41.3.0` | `protocol.handle('app-image', ...)` for serving local PNG bytes | Main process (Pitfall 1 mitigation) |

### Renderer-test addition (RECOMMENDED — see Validation Architecture)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `@testing-library/react` | `^16.0.0` | Render `<AtlasPreviewModal>` in unit tests | Standard for React 19. Pairs with vitest. |
| `@testing-library/user-event` | `^14.5.0` | Simulate Tab/ESC/dblclick | Pairs with @testing-library/react. |
| `@testing-library/jest-dom` | `^6.5.0` | Matchers like `toBeVisible()` | Optional but standard. |
| `jsdom` | `^25.0.0` | vitest renderer environment | Industry-standard. happy-dom is faster but less complete (canvas is a stub in both, see "Canvas testing limitation" below). |

**Note:** vitest already supports `environment: 'jsdom'` via per-file pragma `// @vitest-environment jsdom` so the existing `vitest.config.ts:5` `environment: 'node'` default does NOT need to change. New renderer specs add the pragma at the top.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `maxrects-packer` | `bin-packing` (npm — Jakes Gordon's 2011 algo, port) | Older, no TypeScript types, less actively maintained, only 2 strategies. Maxrects is the textbook winner. |
| `maxrects-packer` | Hand-rolled MaxRects-BSSF | ~300 lines of well-documented packing math; reinventing the wheel for a Phase-7 preview is a violation of "Don't Hand-Roll" (this section below). |
| `protocol.handle('app-image://...')` | Loosen CSP `img-src 'self' file: data:` | Works but contradicts Electron's official security guidance + D-21 trust-boundary discipline. Custom protocol is the documented workaround. |
| `protocol.handle('app-image://...')` | IPC `api.readImageBytes(path) → Uint8Array` + renderer-side `Blob` + `URL.createObjectURL(blob)` | Higher memory churn (full PNG bytes ferried per region; ~100 KB×200 = 20 MB on a complex rig); slower (IPC roundtrip per region). protocol.handle streams bytes lazily from disk via `net.fetch` — same memory profile as today's `<img src=...>` would have. |
| `jsdom` | `happy-dom` | happy-dom is faster but has shallower DOM event support; @testing-library/react integration is more battle-tested on jsdom. |
| @testing-library/react | Hand-rolled component snapshots | More boilerplate; fragile against Tailwind class shuffles. |

### Installation

```bash
npm install maxrects-packer
npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

**Version verification (2026-04-25):**
- `npm view maxrects-packer version` → `2.7.3` (last published > 1 year prior)
- `@testing-library/react@^16` (React 19 compatible — confirm during plan execution via `npm view`)
- `jsdom@^25` (matches Node 24 + vitest 4 — confirm during plan execution)

[VERIFIED: npm registry on 2026-04-25 for maxrects-packer]
[ASSUMED] testing-library/jsdom version pins — planner must run `npm view ... version` at install time to confirm current stable.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ User clicks "Atlas Preview" in AppShell toolbar                             │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │ AppShell snapshots summary + overrides Map
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ <AtlasPreviewModal open=true summary={...} overrides={...}                  │
│                    onJumpToAttachment={(name) => ...}                       │
│                    onClose={...} />                                         │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │ on mount + on every toggle/pager change:
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ src/renderer/src/lib/atlas-preview-view.ts                                  │
│   buildAtlasPreview(summary, overrides, { mode, maxPageDim })               │
│   = byte-identical inline copy of src/core/atlas-preview.ts                 │
│     (Phase 4 D-75 / Phase 6 D-108 precedent; parity grep test in Wave 0)    │
│                                                                             │
│   1. Derive AtlasPreviewInput[] per mode:                                   │
│      • mode=original: input dims = sourceW/H (per-region) or                │
│                       atlasSource.w/atlasSource.h (atlas-packed)            │
│      • mode=optimized: invoke buildExportPlan(summary, overrides) → use     │
│                        ExportRow.outW/outH per row (D-110 ceil-thousandth)  │
│      Both modes: subtract summary.unusedAttachments (D-109 parity)          │
│   2. Construct MaxRectsPacker(maxPageDim, maxPageDim, 2 /*padding*/,        │
│                              { smart:true, allowRotation:false,             │
│                                pot:false, square:false, border:0 })         │
│   3. packer.add(w, h, input) per region                                     │
│   4. Fold packer.bins[] → AtlasPage[] with per-page efficiency calc         │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │ AtlasPreviewProjection = { mode, maxPageDim, pages, totalPages }
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ <AtlasCanvas page={projection.pages[currentPageIndex]} />                   │
│                                                                             │
│   useEffect: for each region in page.regions:                               │
│     • Look up <img> in source-image cache, keyed by                         │
│       region.sourcePath || region.atlasSource.pagePath                      │
│     • If missing in cache: create <img>; subscribe onload + onerror;        │
│       set src = `app-image:///${path}` (NOT file:// — see Pitfall 1)        │
│     • On image load: ctx.drawImage(img, srcX, srcY, srcW, srcH,             │
│                                    region.x, region.y, region.w, region.h) │
│       (per-region: srcX=0,srcY=0,srcW=sourceW,srcH=sourceH;                 │
│        atlas-packed: srcX=atlasSource.x, srcY=.y, srcW=.w, srcH=.h)         │
│     • On image error: render placeholder pattern + ⚠ glyph (D-137)          │
│     • Always: ctx.strokeRect outline + (if hovered) fill overlay + label    │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │ User dblclicks a region rect on canvas:
                      │   1. Hit-test (linear scan O(N)) finds region under click
                      │   2. Modal calls onJumpToAttachment(region.attachmentName)
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ AppShell.onJumpToAttachment(name):                                          │
│   1. setActiveTab('global')                                                 │
│   2. setFocusAttachmentName(name)         ← NEW state, mirrors              │
│                                              focusAnimationName             │
│   3. setAtlasPreviewOpen(false)                                             │
└─────────────────────┬───────────────────────────────────────────────────────┘
                      │ Modal unmounts; Global panel re-renders with new prop:
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ <GlobalMaxRenderPanel focusAttachmentName={name} onFocusConsumed={...} />   │
│                                                                             │
│   useEffect (NEW; cloned from AnimationBreakdownPanel:299-325):             │
│     1. find row el via rowRefs.current.get(name)                            │
│     2. el.scrollIntoView({ behavior: 'smooth', block: 'start' })            │
│     3. setIsFlashing(name)  // 900ms timer                                  │
│     4. onFocusConsumed() synchronously                                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── core/
│   └── atlas-preview.ts                # NEW — pure-TS pack projection
├── shared/
│   └── types.ts                        # extend with AtlasPreviewInput/PackedRegion/
│                                       # AtlasPage/AtlasPreviewProjection
├── main/
│   ├── index.ts                        # extend: registerSchemesAsPrivileged + protocol.handle
│   └── ipc.ts                          # untouched (no new IPC channel; pixels via custom protocol)
├── renderer/
│   ├── index.html                      # CSP: extend img-src to allow 'app-image:'
│   └── src/
│       ├── components/
│       │   └── AppShell.tsx            # +Atlas Preview toolbar button + modal mount + focusAttachmentName
│       ├── lib/
│       │   └── atlas-preview-view.ts   # NEW — byte-identical inline copy of core/atlas-preview.ts
│       ├── modals/
│       │   └── AtlasPreviewModal.tsx   # NEW — main modal
│       └── panels/
│           └── GlobalMaxRenderPanel.tsx # +focusAttachmentName + onFocusConsumed + per-row refs + flash effect
└── tests/
    ├── arch.spec.ts                    # extend Layer 3 grep + parity grep
    ├── core/
    │   └── atlas-preview.spec.ts       # NEW
    └── renderer/                       # NEW directory
        └── atlas-preview-modal.spec.tsx # NEW (with `// @vitest-environment jsdom`)
```

### Pattern 1: Hand-rolled ARIA modal scaffold (clone OverrideDialog + OptimizeDialog)

**Source:** `src/renderer/src/modals/OverrideDialog.tsx:100-170` + `src/renderer/src/modals/OptimizeDialog.tsx:269-362` (both verbatim from project codebase, 2026-04-25).

```tsx
// src/renderer/src/modals/AtlasPreviewModal.tsx (sketch)
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFocusTrap } from '../hooks/useFocusTrap';

export interface AtlasPreviewModalProps {
  open: boolean;
  summary: SkeletonSummary;
  overrides: ReadonlyMap<string, number>;
  onJumpToAttachment: (attachmentName: string) => void;
  onClose: () => void;
}

export function AtlasPreviewModal(props: AtlasPreviewModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Phase 6 Round 6 hook (src/renderer/src/hooks/useFocusTrap.ts) handles:
  //   - auto-focus first tabbable on mount
  //   - Tab/Shift+Tab focus cycle (re-queried on each press for dynamic content)
  //   - document-level Escape handler
  //   - focus-restore on unmount
  useFocusTrap(dialogRef, props.open, { onEscape: props.onClose });

  if (!props.open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atlas-preview-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={props.onClose}  // click-outside closes (D-81)
    >
      <div
        className="bg-panel border border-border rounded-md p-6 w-[1024px] max-w-[95vw] max-h-[90vh] flex flex-col font-mono"
        onClick={(e) => e.stopPropagation()}  // inner click does NOT bubble
      >
        <h2 id="atlas-preview-title" className="text-sm text-fg mb-4">
          Atlas Preview
          <span className="ml-2 text-fg-muted">
            Visual estimation of packed textures ({maxPageDim}×{maxPageDim})
          </span>
        </h2>

        <div className="flex flex-1 gap-4 overflow-hidden">
          {/* LEFT RAIL: VIEW MODE toggle, ATLAS RESOLUTION toggle, ATLAS PAGE pager,
              TOTAL ATLASES card, EFFICIENCY card */}
          <aside className="w-56 flex flex-col gap-3">…</aside>

          {/* MAIN VIEW: <AtlasCanvas /> with hover hit-test + dblclick gesture */}
          <main className="flex-1 overflow-auto">…</main>
        </div>

        <p className="mt-4 text-xs text-fg-muted italic">
          * Preview assumes 2px padding and no rotation. Actual export engine may vary slightly.
        </p>
      </div>
    </div>
  );
}
```

**Key invariants from the existing modals (do not deviate):**
- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` → MUST be set on the OUTER overlay div (the `fixed inset-0` one). This matches OverrideDialog.tsx:103-105, OptimizeDialog.tsx:272-274.
- The OVERLAY div has `onClick={onClose}` (click-outside closes); the INNER panel div has `onClick={(e) => e.stopPropagation()}` (intercept). This pattern is in BOTH precedents.
- ESC handling: pass `onEscape: props.onClose` to `useFocusTrap`. Do NOT add a local `onKeyDown={Escape}` handler — Round 6 hoisted it. (See useFocusTrap.ts:128-140 for why.)
- Tab cycle: `useFocusTrap` handles it — no manual Tab logic needed.
- Auto-focus: hook focuses first tabbable on mount. If a specific button (e.g., the resolution toggle's Optimized button) should be the initial focus target, add a per-state `useEffect` mirroring OptimizeDialog.tsx:147-151.
- Tailwind v4 literal-class discipline (Pitfall 8): every className is a string literal (no template interpolation, no concatenation). Conditional classes via `clsx` with literal branches. **Never** template-interpolate dynamic values into a `className`.

### Pattern 2: Layer 3 byte-identical inline copy (Phase 4 D-75 + Phase 6 D-108)

**Source:** `src/renderer/src/lib/overrides-view.ts` + `src/renderer/src/lib/export-view.ts`.

The renderer cannot import from `src/core/*` (Layer 3 grep at `tests/arch.spec.ts:19-34`). Two viable resolutions:

| Resolution | Used In | Cost |
|------------|---------|------|
| **Inline duplicate (chosen)** | Phase 4 D-75 (`overrides-view.ts`), Phase 6 D-108 (`export-view.ts`) | ~50-150 lines duplicated per copy. Parity test in `tests/core/<name>.spec.ts` does a `readFileSync` + grep on representative inputs to assert function bodies are byte-identical. |
| Loosen arch.spec | Rejected in Phase 4 | Carving a per-file hole in a project invariant. |
| Move to `src/shared/` | Rejected in Phase 4 | Inverts the core-vs-shared convention (shared is for IPC types, not runtime). |

**Phase 7 follows Phase 6's pattern verbatim:** `src/core/atlas-preview.ts` is the canonical source; `src/renderer/src/lib/atlas-preview-view.ts` is the byte-identical copy. The parity check in `tests/core/atlas-preview.spec.ts` MUST:

```ts
// Pattern from tests/core/overrides.spec.ts (verified existing in repo)
import { readFileSync } from 'node:fs';
const CORE = readFileSync('src/core/atlas-preview.ts', 'utf8');
const VIEW = readFileSync('src/renderer/src/lib/atlas-preview-view.ts', 'utf8');

it('renderer copy contains the same buildAtlasPreview function body', () => {
  // grep for canonical function signatures and key token sequences
  const sig = /export function buildAtlasPreview\([^)]+\)/;
  expect(CORE).toMatch(sig);
  expect(VIEW).toMatch(sig);
});

it('renderer copy does NOT import from core', () => {
  expect(VIEW).not.toMatch(/from ['"].*\/core\//);
  expect(VIEW).not.toMatch(/from ['"]@core/);
});
```

### Pattern 3: GlobalMaxRenderPanel jump-target consumer (clone from AnimationBreakdownPanel)

**Source:** `src/renderer/src/panels/AnimationBreakdownPanel.tsx:299-325` (verbatim).

The pattern to clone:

```tsx
// Existing in AnimationBreakdownPanel — clone into GlobalMaxRenderPanel
const cardRefs = useRef(new Map<string, HTMLElement>());
const registerCardRef = useCallback((cardId: string, el: HTMLElement | null) => {
  if (el === null) cardRefs.current.delete(cardId);
  else cardRefs.current.set(cardId, el);
}, []);

const [isFlashing, setIsFlashing] = useState<string | null>(null);

useEffect(() => {
  if (focusAnimationName === null) return;
  const cardId = focusAnimationName === 'Setup Pose (Default)' ? 'setup-pose' : `anim:${focusAnimationName}`;
  setUserExpanded((prev) => new Set([...prev, cardId]));
  setIsFlashing(cardId);
  const el = cardRefs.current.get(cardId);
  if (el !== undefined) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  onFocusConsumed();  // SYNCHRONOUSLY clear the focus prop in parent (Pitfall 5 — re-mount leak)
  const timer = setTimeout(() => setIsFlashing(null), 900);
  return () => clearTimeout(timer);
}, [focusAnimationName, onFocusConsumed]);
```

**Phase 7 adaptation for GlobalMaxRenderPanel:**

```tsx
// src/renderer/src/panels/GlobalMaxRenderPanel.tsx — extension sketch
export interface GlobalMaxRenderPanelProps {
  // ... existing props ...
  /** Phase 7 D-130: Atlas Preview dblclick → AppShell sets this; panel scrolls + flashes the matching row. */
  focusAttachmentName?: string | null;
  onFocusConsumed?: () => void;
}

// Inside component body:
const rowRefs = useRef(new Map<string, HTMLElement>());
const registerRowRef = useCallback((name: string, el: HTMLElement | null) => {
  if (el === null) rowRefs.current.delete(name);
  else rowRefs.current.set(name, el);
}, []);
const [isFlashing, setIsFlashing] = useState<string | null>(null);

useEffect(() => {
  if (!focusAttachmentName) return;
  setIsFlashing(focusAttachmentName);
  const el = rowRefs.current.get(focusAttachmentName);
  if (el !== undefined) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); // 'center' for table rows
  onFocusConsumed?.();
  const timer = setTimeout(() => setIsFlashing(null), 900);
  return () => clearTimeout(timer);
}, [focusAttachmentName, onFocusConsumed]);

// In <Row /> render: pass `ref` to register; apply isFlashing class.
// The existing <tr> at line 316 needs `ref={(el) => registerRowRef(row.attachmentName, el)}`
// and a conditional class like clsx(..., isFlashing === row.attachmentName && 'animate-flash')
```

**Pitfall (carry-over from Phase 3 D-66):** `onFocusConsumed()` MUST fire synchronously inside the same effect tick. Otherwise an Atlas Preview re-open with the same attachmentName won't re-flash (the parent's prop value didn't change, no effect fire). The existing AnimationBreakdownPanel pattern already follows this contract.

### Pattern 4: Canvas device-pixel-ratio + drawImage (verified MDN)

```tsx
// src/renderer/src/modals/AtlasPreviewModal.tsx — AtlasCanvas sub-component sketch
function AtlasCanvas({ page, ...props }: AtlasCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    // CSS pixels: canvas fills the modal pane (max-width: 100% via CSS below).
    // We size the canvas backing store at page.width × dpr so HiDPI displays render crisp pixels.
    canvas.width = page.width * dpr;
    canvas.height = page.height * dpr;
    canvas.style.width = page.width + 'px';   // CSS pixel size (may be scaled by max-width: 100%)
    canvas.style.height = page.height + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);  // normalize coords back to CSS pixels — drawImage args use CSS pixels

    // Clear + draw each region:
    ctx.clearRect(0, 0, page.width, page.height);
    for (const region of page.regions) {
      // Look up cached <img>; fall back to placeholder if missing.
      const img = imageCache.get(region.sourcePath || region.atlasSource?.pagePath || '');
      if (img && img.complete && img.naturalWidth > 0) {
        if (region.atlasSource) {
          // Atlas-packed: srcRect crops region from page atlas
          ctx.drawImage(
            img,
            region.atlasSource.x, region.atlasSource.y, region.atlasSource.w, region.atlasSource.h,
            region.x, region.y, region.w, region.h,
          );
        } else {
          // Per-region PNG: full image scaled to slot
          ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight,
                             region.x, region.y, region.w, region.h);
        }
      } else if (img && img.complete && img.naturalWidth === 0) {
        // Missing/decode-failed (D-137): muted pattern + ⚠ glyph
        drawPlaceholder(ctx, region);
      }
      // Always: outline + (if hovered) overlay
      ctx.strokeStyle = isHovered(region) ? 'var(--color-accent)' : 'rgba(255,255,255,0.4)';
      ctx.strokeRect(region.x, region.y, region.w, region.h);
      if (isHovered(region)) {
        ctx.fillStyle = 'rgba(249, 115, 22, 0.25)';  // accent low-opacity
        ctx.fillRect(region.x, region.y, region.w, region.h);
        // … draw label text
      }
    }
  }, [page, hoveredAttachmentName, /* image cache version */]);

  return <canvas ref={canvasRef} className="max-w-full h-auto" onMouseMove={hitTest} onDoubleClick={onDblclick} />;
}
```

**Key fact:** `drawImage`'s 9-arg form `drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)` reads `sx/sy/sWidth/sHeight` in the source image's natural pixel space (CSS pixels = 1:1 with image natural pixels for our case). No DPR multiplication needed for source coords — `ctx.scale(dpr, dpr)` only normalizes destination coords. [VERIFIED: developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/drawImage]

**Pitfall:** Don't draw before `img.complete && img.naturalWidth > 0`. The `<img>.onload` event re-triggers the draw effect via state.

### Anti-Patterns to Avoid

- **Hand-rolling MaxRects-BSSF.** Pure premature engineering. The whole point of `maxrects-packer` is that this is solved.
- **Decoding PNGs in `src/core/atlas-preview.ts`.** Violates CLAUDE.md rule #4 + Layer 3 arch grep. Pixel decode is browser-native via canvas.
- **Reading raw `file://` URLs in renderer.** CSP blocks it (current `img-src 'self' data:`). Use protocol.handle (Pitfall 1).
- **Subscribing to AppShell.overrides while modal open.** Violates D-131 snapshot-at-open. Modal blocks panel interaction anyway.
- **Auto-opening OverrideDialog after dblclick-jump.** D-130 explicitly chose two-gesture workflow.
- **Live-resizing canvas backing store on every mousemove.** Resizing the canvas wipes the buffer + costs a full re-render. Only resize on toggle/pager change.
- **Re-querying tabbable elements on every key-down outside the focus-trap hook.** The hook handles this; reaching around it (e.g., reading `dialogRef.current.querySelectorAll('button')` in a custom keyDown) creates a race against the hook's own re-query.
- **Storing the resolver of a Promise in React state instead of a ref.** Plain anti-pattern in OptimizeDialog Round 3 (AppShell.tsx:99-107) flagged this — re-renders create stale closures. Use `useRef` for one-shot promise resolvers.
- **Computing efficiency as `usedPixels / maxPageDim²` instead of `usedPixels / (bin.width × bin.height)`.** With smart heuristic, `bin.width × bin.height` is the actual occupied size; using `maxPageDim²` always artificially deflates efficiency.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 2D bin packing | Hand-rolled MaxRects | `maxrects-packer` | 870-line library, MIT, zero deps, 5+ years of bug-fixing on edge cases (rotation, oversized rects, smart growth, free-rect splitting). Reinventing for a preview violates Don't Hand-Roll. |
| ARIA modal scaffold | Custom focus-trap | `useFocusTrap` (already in `src/renderer/src/hooks/`) | Phase 6 Round 6 already debugged Tab cycle + document-level ESC + focus restore. Reuse. |
| `<img>` element loading + onerror | Custom retry/cache | Browser-native `<img>` + simple `Map<path, HTMLImageElement>` cache | Browser already has the network/decode/error path. Adding retries violates D-137's "lazy detect; cache flag for the session" semantics. |
| Local file → renderer image bytes | Read via IPC + dataURL | `protocol.handle('app-image', ...)` + `net.fetch(pathToFileURL(...))` | Electron's official recommendation. Streams from disk lazily; no IPC churn. Per-region payload doesn't cross the IPC bridge. |
| Power-of-2 / square bin sizing | Custom rounding | `maxrects-packer`'s `pot` + `square` options | Already implemented in the lib. Just configure. |
| Atlas page atlas-extract (srcRect crop from page PNG) | Custom decode + crop | `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` 9-arg form | Browser-native; handles all PNG/JPEG/WebP. |
| Cross-panel jump-target system | Custom event bus | Existing `focusAttachmentName` prop pattern (clone from `AnimationBreakdownPanel:299-325`) | The pattern works; just add it to the second panel. Adding pubsub for one new producer is over-engineering. |
| Renderer test environment | Custom DOM mock | `jsdom` (industry standard, vitest-compatible) | Mature, supports React 19, supports @testing-library/react. |

**Key insight:** Phase 7's domain (atlas projection) is decades-old solved territory. Every line that calls a library is a line the project doesn't have to debug, and the library has zero deps so the supply-chain footprint is one tarball.

## Runtime State Inventory

> Phase 7 is a NET-NEW feature, not a rename/refactor. This section is included for completeness in the form CONTEXT.md expects, but every category is "None — verified."

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by repo grep. Phase 7 introduces no persistent storage. The modal is snapshot-at-open (D-131); state lives only for the open session. | None |
| Live service config | None — verified. No external services touched. | None |
| OS-registered state | None — verified. No new Windows tasks, launchd plists, etc. | None |
| Secrets/env vars | None — verified. No new secrets. | None |
| Build artifacts | One — `package-lock.json` will gain `maxrects-packer` (+ test deps). After install, `npm ci` consumers will fetch the new tarball. | Add to package.json + commit lock file. |

## Common Pitfalls

### Pitfall 1: file:// URLs do NOT load under the current CSP `img-src 'self' data:` (HIGH confidence; CODEBASE CONTRADICTS CONTEXT.md D-133)

**What goes wrong:** D-133 says "Renderer loads source PNG bytes directly via `file://` + canvas `drawImage`. […] the existing app already does (skeleton + atlas + per-region PNGs all load via file paths)." This is **not accurate** — the existing app reads `.json` and `.atlas` via main-process `node:fs` (`src/core/loader.ts:101,117`), then sends a structured-cloned summary across IPC. **The renderer has never decoded a PNG and has never made a `file://` request.** The CSP at `src/renderer/index.html:7` is:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self' data:;" />
```

`img-src 'self' data:` does NOT include `file:`, so an `<img src="file:///abs/path.png">` will be blocked silently (no console warning in some Electron versions; `<img>.onerror` may or may not fire — empirically it does fire for CSP blocks per MDN, but the user sees nothing).

**Why it happens:** D-133 conflated "the loader reads files at boot" with "the renderer renders files." The renderer's only job today is to consume an IPC payload of plain JS objects.

**How to avoid:** Choose the lower-risk pattern from "How to load local PNGs in renderer" below.

**Warning signs:** First Phase 7 dev-mode test of the modal shows blank rectangles + console CSP errors.

#### How to load local PNGs in renderer (RECOMMENDED — option C)

| Option | What it does | Pros | Cons |
|--------|--------------|------|------|
| **A. Loosen CSP to add `file:`** to img-src | Edit index.html: `img-src 'self' data: file:` | Trivial change. | Contradicts Electron security guidance ("Use a custom protocol instead of `file://`"). Future security reviewers will flag it. file:// in Electron has more privileges than in a browser — broader attack surface. |
| **B. IPC `api.readImageBytes(path) → Uint8Array` + `URL.createObjectURL(blob)`** | Renderer requests bytes; main reads + returns. | Works under sandbox + tightest CSP. | Memory churn (full PNG bytes ferried per region; ~100 KB×200 = 20 MB on complex rig); slower (IPC roundtrip per region). Object URLs need `URL.revokeObjectURL` to free memory — adds lifecycle complexity. |
| **C. `protocol.handle('app-image', ...)` in main + `<img src="app-image:///abs/path">` in renderer (RECOMMENDED)** | Custom scheme served by main from disk via `net.fetch(pathToFileURL(path))`. | Streams bytes lazily from disk (no buffering in main); zero IPC churn; aligns with Electron's official guidance; works under sandbox+secure CSP. | One-time setup: add `registerSchemesAsPrivileged` + `protocol.handle` in `src/main/index.ts`. Need to extend CSP to allow the custom scheme: `img-src 'self' data: app-image:`. |

**Recommended (option C) implementation sketch:**

```ts
// src/main/index.ts (extension)
import { app, BrowserWindow, protocol, net } from 'electron';
import { pathToFileURL } from 'node:url';

// MUST be called BEFORE app.whenReady() resolves — top-level module side effect.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-image',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

app.whenReady().then(() => {
  protocol.handle('app-image', (request) => {
    // request.url shape: 'app-image:///Users/leo/.../images/CIRCLE.png'
    // The triple slash is intentional — 'app-image://' (scheme) + '/' (host empty) + absolute path.
    // We deliberately do NOT validate the path here — the trust boundary is the
    // skeleton load step (Phase 1 loader.ts), which already validated all sibling
    // PNG paths. Defense-in-depth: planner could add a path-prefix allow-list
    // built from the loaded summary's atlasSource.pagePath / sourcePath set.
    const filePath = decodeURIComponent(new URL(request.url).pathname);
    return net.fetch(pathToFileURL(filePath).toString());
  });
  // ... existing createWindow() ...
});
```

```html
<!-- src/renderer/index.html — extend CSP -->
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: app-image:; font-src 'self' data:;" />
```

```tsx
// In renderer when constructing img.src:
const url = `app-image://${encodeURI(absolutePath)}`;  // path already starts with '/' on macOS
img.src = url;
```

[VERIFIED: electronjs.org/docs/latest/api/protocol — current docs confirm `protocol.handle` is the modern replacement for the deprecated `registerFileProtocol`; must run before `app.whenReady()` resolves.]

### Pitfall 2: GlobalMaxRenderPanel does NOT have a jumpTarget consumer today

**What goes wrong:** CONTEXT.md (line 222) says "GlobalMaxRenderPanel — already exposes the jumpTarget consumption pattern (Phase 3 D-72)." A planner who reads this and ships expecting "no panel-side work needed" will produce a modal that calls `onJumpToAttachment` → AppShell sets a focusAttachmentName on the panel → ... but the panel does nothing with it.

**Why it happens:** The Phase 3 D-72 system is one-directional: Source Animation chip in Global panel → click → AppShell's `focusAnimationName` → consumed by `AnimationBreakdownPanel`. The reverse direction (modal → focus row in Global panel) is NEW and has no consumer in `GlobalMaxRenderPanel.tsx` (verified via grep — no `scrollIntoView`, no `focusAttachmentName`, no `isFlashing` state in that file).

**How to avoid:** Plan must include a task for "Add `focusAttachmentName` + `onFocusConsumed` props to `GlobalMaxRenderPanel`, mirror the AnimationBreakdownPanel scroll+flash pattern (panel.tsx:299-325)." See "Pattern 3" above for the sketch.

**Warning signs:** Dev-mode dblclick on a region → modal closes → activeTab='global' → ... no scroll, no flash, the user lands at whatever scroll position they left the panel at.

### Pitfall 3: Tailwind v4 literal-class discipline (CARRY-OVER from Phase 1+ Pitfall 8)

**What goes wrong:** Atlas Preview modal has dynamic content (active toggle button, hover region overlay color). Naïve approach: `className={`bg-${active ? 'accent' : 'panel'} text-fg`}`. Tailwind v4's CSS scanner reads the source as text and emits ONLY classes it sees as literals. `bg-accent` template-interpolated never gets emitted.

**Why it happens:** Tailwind v4 JIT scanner cannot see runtime-computed strings.

**How to avoid:** Use `clsx` with literal-string branches (the project precedent everywhere — see OptimizeDialog.tsx:443-449 for the canonical example). Every class your code can possibly emit MUST appear as a literal string somewhere in the source.

```tsx
import clsx from 'clsx';
// CORRECT
className={clsx('text-xs px-3 py-1', isActive ? 'bg-accent text-panel' : 'bg-panel text-fg-muted')}
// WRONG (template interpolation)
className={`text-xs px-3 py-1 bg-${isActive ? 'accent' : 'panel'} text-${isActive ? 'panel' : 'fg-muted'}`}
```

### Pitfall 4: Image cache leak across modal re-opens

**What goes wrong:** Naïve cache: `const imageCache = new Map<string, HTMLImageElement>();` declared at module scope. Each modal re-open, we keep adding entries; old entries from a now-unmounted modal stay in memory.

**Why it happens:** Module-scope is process-lifetime.

**How to avoid:** Hoist the cache into a `useRef<Map<...>>(new Map())` inside the modal component. On unmount, the Map is GC'd. (Per-session lifecycle matches D-131 snapshot-at-open.)

### Pitfall 5: `<img>.onerror` may NOT fire under CSP block in some Electron versions

**What goes wrong:** D-137 detection: "Detection: renderer attempts `<img src="file://...">` per unique path; `onerror` flips a per-region `sourceMissing: true` flag." If the CSP blocks the load, behavior is browser-version-dependent. MDN says onerror fires for CSP blocks; Chromium has historically been inconsistent here.

**Why it happens:** CSP blocks happen BEFORE the network/decode pipeline. Some browsers emit the error event; others swallow it.

**How to avoid:** Don't rely on CSP blocks (Pitfall 1 + protocol.handle solves this). Use BOTH `onerror` AND a post-load `naturalWidth === 0` check:

```ts
img.onload = () => {
  if (img.naturalWidth === 0) markMissing(path);
  else markLoaded(path);
};
img.onerror = () => markMissing(path);
img.src = `app-image:///${path}`;
```

[CITED: developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement — combined onerror + naturalWidth check is documented best practice.]

### Pitfall 6: maxrects-packer rect.data MUST be a structuredClone-safe shape if it crosses IPC

**What goes wrong:** If the planner ever decides to ship the projection across IPC (option B fallback), `rect.data` will be sent through `structuredClone`. AtlasPreviewInput must be plain primitives + arrays + nested plain objects. `Map`, class instances, `Float32Array` will throw.

**Why it happens:** Phase 1 D-21 lock — every IPC type plain.

**How to avoid:** Even though the recommended path keeps the projection in the renderer (no IPC), define `AtlasPreviewInput` / `PackedRegion` / `AtlasPage` / `AtlasPreviewProjection` as plain shapes from day one. The existing `DisplayRow.atlasSource` shape (`src/shared/types.ts:85-92`) is the precedent.

### Pitfall 7: Smart heuristic + pot/square interaction (NEW finding — not in CONTEXT.md)

**What goes wrong:** maxrects-packer's `MaxRectsBin` defaults are `smart: true, pot: true, square: true`. With those defaults at maxWidth=2048, a small rig that fits in 800×600 reports `bin.width=1024, bin.height=1024`. Per-page efficiency = `(packed area) / (1024 × 1024)`, even though the user expected "what would a 2048×2048 atlas page look like."

**Why it happens:** Smart sizing grows the bin to fit content; pot rounds up to power of 2; square forces aspect ratio.

**How to avoid:** Pass `pot: false, square: false` for the projection. (See "Library Verification" → "Pot/square defaults" recommendation A.) Document the deviation from Spine atlas-pack defaults in the modal footer ("preview assumes 2px padding and no rotation" already covers it; planner may extend the disclaimer if user pushes back).

### Pitfall 8: `useFocusTrap` re-runs on `onEscape` ref-change (CARRY-OVER from OptimizeDialog REVIEW M-02)

**What goes wrong:** If a `useCallback`-wrapped `onClose` lists `props` (the whole object) in its deps, then on every parent render `onClose` is a fresh reference; useFocusTrap's `useEffect` (which lists `onEscape` in deps) tears down + re-runs every parent render, racing against the modal's per-state focus useEffect.

**Why it happens:** `useFocusTrap` lists `onEscape` in its deps so a changed-onEscape value re-mounts the trap.

**How to avoid:** Narrow `onClose`'s `useCallback` deps to ONLY the values it actually reads. Pattern from OptimizeDialog.tsx:235 (`}, [state, props.onClose]);`). The fix has been applied once already; Phase 7 must NOT regress.

### Pitfall 9: Running `buildExportPlan` on every modal open is OK; running it on every toggle is also OK (sub-millisecond)

**What goes wrong:** Planner panics about perf and adds `useMemo` keyed off summary + overrides. Premature optimization — `buildExportPlan` is sub-millisecond on the simple rig, ~few ms on a 200-attachment rig. Modal toggle is human-rate.

**Why it happens:** Looking too hard at the structure.

**How to avoid:** Compute `buildAtlasPreview(summary, overrides, opts)` directly in the modal's `useMemo([summary, overrides, mode, maxPageDim])`. The 4 mode×resolution combinations × N pages each is a few-megabyte working set at most. No precompute-all-on-mount needed.

### Pitfall 10: `data:` URL fallback for missing images is a memory trap

**What goes wrong:** Planner thinks "if `app-image://` returns 404, fall back to `data:image/png;base64,...` placeholder" and inlines a 4 KB SVG/PNG placeholder. Across N missing regions, this is fine — but if the planner builds the fallback dynamically per-region (e.g., encoding a label into the placeholder), each region's `<img>` gets its own data URL, defeating browser cache.

**Why it happens:** Wanting per-region custom placeholders.

**How to avoid:** Use canvas-drawn placeholder (D-137 says "muted placeholder pattern + ⚠ glyph"), drawn at render time inside the canvas context. No `<img>` involved for the fallback.

## Code Examples

### Example 1: Canvas hit-test on dblclick (simple O(N) linear scan)

```tsx
const onDoubleClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  // Convert from CSS pixels (event coords) into the canvas's logical coord system.
  // The canvas's CSS size (canvas.style.width) may be smaller than its backing-store
  // size when fitted via max-width:100%. Convert via the ratio.
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  // Scale CSS coords up to canvas-logical coords (page.width × page.height).
  const x = (cssX / rect.width) * page.width;
  const y = (cssY / rect.height) * page.height;
  // Linear scan — fine for typical N (≤200 regions).
  for (const region of page.regions) {
    if (x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h) {
      props.onJumpToAttachment(region.attachmentName);
      return;
    }
  }
}, [page, props.onJumpToAttachment]);
```

### Example 2: Hover hit-test (mousemove)

```tsx
const onMouseMove = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
  // Same coord transform as above.
  // ...
  let hovered: PackedRegion | null = null;
  for (const region of page.regions) {
    if (x >= region.x && x < region.x + region.w && y >= region.y && y < region.y + region.h) {
      hovered = region;
      break;  // first match wins (overlap is impossible per packer invariants but be defensive)
    }
  }
  setHoveredAttachmentName(hovered?.attachmentName ?? null);
}, [page]);
```

### Example 3: Canvas redraw in response to hover state (rate-limit if needed)

```tsx
useEffect(() => {
  redrawCanvas(canvasRef.current, page, hoveredAttachmentName, imageCache);
}, [page, hoveredAttachmentName, imageCacheVersion]);
```

`imageCacheVersion` is bumped each time an `<img>.onload` flips a region from missing→present, forcing a redraw.

### Example 4: AppShell extension (toolbar button + jump-target dispatch)

```tsx
// src/renderer/src/components/AppShell.tsx — diff sketch

// New state:
const [atlasPreviewOpen, setAtlasPreviewOpen] = useState(false);
const [focusAttachmentName, setFocusAttachmentName] = useState<string | null>(null);

const onClickAtlasPreview = useCallback(() => {
  setAtlasPreviewOpen(true);
}, []);

const onJumpToAttachment = useCallback((name: string) => {
  setActiveTab('global');
  setFocusAttachmentName(name);
  setAtlasPreviewOpen(false);
}, []);

const onFocusAttachmentConsumed = useCallback(() => {
  setFocusAttachmentName(null);
}, []);

// In the header chrome (next to existing Optimize Assets button at line 332-341):
<button
  type="button"
  onClick={onClickAtlasPreview}
  disabled={summary.peaks.length === 0}
  className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
>
  Atlas Preview
</button>

// In the GlobalMaxRenderPanel mount (line 344-351), pass new props:
<GlobalMaxRenderPanel
  summary={summary}
  onJumpToAnimation={onJumpToAnimation}
  overrides={overrides}
  onOpenOverrideDialog={onOpenOverrideDialog}
  focusAttachmentName={focusAttachmentName}      // NEW
  onFocusConsumed={onFocusAttachmentConsumed}    // NEW
/>

// New modal mount alongside the others:
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

**Note:** The AppShell sub-tree is well-organized; expect a +50-line diff covering toolbar button + state + modal mount + Global panel prop forwarding. Existing onJumpToAnimation is left intact (animation chip → Animation Breakdown). The new `focusAttachmentName` is conceptually parallel to `focusAnimationName` (line 59) — same shape, different consumer.

### Example 5: protocol.handle in main/index.ts

```ts
// src/main/index.ts (extension at top of file, BEFORE app.whenReady)
import { app, BrowserWindow, protocol, net } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { registerIpcHandlers } from './ipc.js';

// MUST be called at module load time, BEFORE app.whenReady() resolves.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-image',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
  },
]);

// ... existing createWindow() ...

app.whenReady().then(() => {
  // Register the protocol handler.
  protocol.handle('app-image', (request) => {
    const url = new URL(request.url);
    // Path is the URL pathname (already URL-decoded by browser when constructing the URL,
    // but we explicitly decode for clarity + robustness against double-encoding).
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

[VERIFIED: electronjs.org/docs/latest/api/protocol — `protocol.handle` is the modern API; `registerSchemesAsPrivileged` MUST run before app.whenReady; net.fetch resolves URLs via the standard fetch pipeline.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `protocol.registerFileProtocol(scheme, handler)` | `protocol.handle(scheme, handler)` | Electron 25 (2023) | Old API is deprecated. Phase 7 must use the new one. |
| `webUtils.getPathForFile(file)` (drag-and-drop) | Same — still current | Electron 32 (2024) replaced `file.path` | Phase 1 D-09 already adopted this. Phase 7 untouched. |
| React 18 createRoot | React 19 createRoot | React 19 (2024) | Project on React 19. AtlasPreviewModal uses standard hooks (useState, useEffect, useRef, useCallback, useMemo). |
| Tailwind v3 + tailwind.config.js | Tailwind v4 + `@theme inline` in CSS | Tailwind v4 (2024-2025) | Project on v4. Token names already established (`--color-accent` etc.). Phase 7 may add `--color-success` if planner determines the existing palette doesn't have a green. |
| MaxRectsPacker constructor `(maxWidth, maxHeight, padding, options)` | Same — stable since 2.0.0 (2018) | n/a | Phase 7 uses current API. |

**Deprecated/outdated:**
- `protocol.registerFileProtocol` — replaced by `protocol.handle`. Don't use.
- Loading `file://` images directly under default Electron security — Electron docs explicitly recommend custom protocol instead.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@testing-library/react@^16` is React-19-compatible | Standard Stack | Low — confirmed widely on web. Planner verifies via `npm view` at install time. |
| A2 | `jsdom@^25` is the right pin for vitest 4 + Node 24 | Standard Stack | Low — current stable; planner verifies. |
| A3 | Smart heuristic + `pot: false, square: false` is the correct projection config | Library Verification (Recommendation A) | Medium — user may want pot-aligned pages to match Spine atlas-pack output. Plan-checker should surface this for user confirmation if uncertain. The screenshot is ambiguous. |
| A4 | `<img>.onerror` fires for `app-image://` 404s in Electron | Pitfall 5 | Low — net.fetch returns 404 status; HTMLImageElement spec says error fires. |
| A5 | `protocol.handle` works under `sandbox: true` | Pitfall 1 / Example 5 | Low — Electron docs don't enumerate sandbox restrictions but the documented examples don't disable sandbox. Planner verifies in dev-mode after wiring. |
| A6 | `<img>.onerror` fires for CSP blocks in Electron 41/Chromium | Pitfall 5 | Medium — Chromium has historically been inconsistent. Mitigation: combined `onerror` + `naturalWidth === 0` check. |

**If this table grows during planning** (e.g., user clarifies pot/square preference), the planner should mark superseded rows and reduce open assumptions before locking the plan.

## Open Questions (RESOLVED)

**All three open questions below were de-facto resolved during Plans 01-05's actual implementation. RESOLVED markers reference the SUMMARY files where the resolution lands.**

1. **Pot-aligned vs tight-fit bin sizing for the projection.**
   - What we know: maxrects-packer defaults are `smart: true, pot: true, square: true`. Tight-fit (`pot: false, square: false`) makes efficiency more honest but diverges from Spine atlas-pack output.
   - What's unclear: User preference. CONTEXT.md doesn't address.
   - Recommendation: Default to `pot: false, square: false` (Recommendation A in Library Verification). Surface in plan-checker checkpoint for user confirmation.
   - **RESOLVED (Plan 02, `07-02-SUMMARY.md`):** Recommendation A applied verbatim — MaxRectsPacker hardcoded with `padding: 2, allowRotation: false, smart: true, pot: false, square: false, border: 0`. Tight-fit bin sizing chosen so `efficiency` reads honestly against the per-page cap (D-127 / RESEARCH §Pitfall 7). Verified via `grep -E "pot:\s*false"` + `grep -E "square:\s*false"` against `src/core/atlas-preview.ts` (07-02-SUMMARY.md verification table).

2. **Which `app-image://` URL host segment convention?**
   - What we know: `app-image:///abs/path` (empty host, leading slash) is the most common convention. Some Electron examples use `app-image://[host]/path` where host is a logical namespace.
   - What's unclear: Whether `request.url.pathname` survives `decodeURIComponent` correctly on Windows (drive-letter paths like `C:/...`).
   - Recommendation: macOS-only build per current `package.json:16` (`build: "electron-vite build && electron-builder --mac dmg"`), so paths are `/abs/...`. Defer Windows path handling until Windows target is added (Phase 9). Document this Phase-7 limitation.
   - **RESOLVED (Plan 03, `07-03-SUMMARY.md`):** Empty-host convention adopted — renderer constructs `app-image://${encodeURI(absolutePath)}` (yields `app-image:///Users/.../region.png` triple-slash form on macOS); main parses via `decodeURIComponent(new URL(request.url).pathname)` and streams via `net.fetch(pathToFileURL(filePath).toString())`. macOS-only target preserved (`package.json` `--mac dmg`). Windows drive-letter handling explicitly deferred to Phase 9 per the original recommendation. NOTE: Plan 06 (gap-fix) re-opens this question if Task 1 diagnostics show the empty-host form misparses on the main side — Branch A in Plan 06 has a `app-image://localhost${...}` fallback ready, but that is a defensive contingency, not a resolution change.

3. **Renderer test framework — gate canvas pixel tests behind a feature flag?**
   - What we know: jsdom does NOT implement HTMLCanvasElement's 2D context (returns `null` from `getContext('2d')`). Hit-test specs (modal opens, dblclick fires onJumpToAttachment) work fine in jsdom. Pixel-level drawImage / efficiency calc / region rendering does NOT.
   - What's unclear: Whether the planner needs canvas-pixel tests at all (the projection math is in `src/core/atlas-preview.ts` and tested in pure-TS — efficiency, page count, region positions are all asserted there).
   - Recommendation: Renderer tests cover (1) modal open/close, (2) toggle re-renders, (3) pager bounds-disable, (4) dblclick fires onJumpToAttachment. These need only DOM events + accessible queries — no canvas pixel assertions. Skip pixel-perfect renderer specs entirely; assert via `tests/core/atlas-preview.spec.ts` golden values + a manual checkpoint:human-verify of "the rectangles look right."
   - **RESOLVED (Plan 04, `07-04-SUMMARY.md`):** Recommendation accepted — DOM-only renderer-spec posture. `tests/renderer/atlas-preview-modal.spec.tsx` runs under `// @vitest-environment jsdom` with `@testing-library/react` (16.x); 11 it() blocks across 6 describe blocks assert on `getByRole` / `getByText` / fireEvent.click + doubleClick handler-call counts. `if (!ctx) return` guard inside the canvas useEffect lets the modal mount under jsdom (which returns `null` from `getContext('2d')`). Pixel correctness is locked into `tests/core/atlas-preview.spec.ts` golden values; visual correctness is a human-verify checkpoint (originally Plan 05; re-run in Plan 06 Task 6 after Gap fixes). Two infra surprises captured: vitest needed `esbuild: { jsx: 'automatic' }` to align with tsconfig.web.json's `react-jsx`; `canvas.getBoundingClientRect()` mocked to `2048×2048` in dblclick specs because jsdom defaults return zero-pixel rects (Plan 04 deviation log).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dev tooling | ✓ | 24+ (per Phase 2 lessons) | — |
| npm | install maxrects-packer + test deps | ✓ | bundled | — |
| Electron | renderer + protocol.handle | ✓ | 41.3.0 | — |
| `maxrects-packer` | core projection | ✗ (not installed) | — (will install ^2.7.3) | None — REQUIREMENTS.md F7.1 names this lib. |
| `@testing-library/react` | renderer tests | ✗ (not installed) | — (will install ^16.0.0) | Defer renderer tests entirely; rely on `tests/core/atlas-preview.spec.ts` + checkpoint:human-verify. |
| `jsdom` | vitest renderer environment | ✗ (not installed) | — (will install ^25.0.0) | Same fallback as above. |
| ChromeDevTools (vitest browser mode) | alternative to jsdom | n/a | — | Not needed if jsdom path chosen. |

**Missing dependencies with no fallback:** `maxrects-packer` is named in REQUIREMENTS — there's no fallback aside from hand-rolling the packer (forbidden by Don't Hand-Roll).

**Missing dependencies with fallback:** Renderer test dependencies — fallback to deferring renderer tests + leaning on the core unit tests + manual verification.

## Validation Architecture

> Phase 7 includes this section per the spec (`workflow.nyquist_validation` is absent in `.planning/config.json` — treated as enabled).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4 (already in package.json devDeps) |
| Config file | `vitest.config.ts` (current: `environment: 'node'`, `include: ['tests/**/*.spec.ts']`) |
| Quick run command | `npm run test -- tests/core/atlas-preview.spec.ts` |
| Full suite command | `npm run test` |
| Renderer tests addition | New file pattern `tests/renderer/**/*.spec.tsx` with per-file pragma `// @vitest-environment jsdom`. **Add to `vitest.config.ts:6`'s include list:** `include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx']`. |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F7.1 | Original mode at 2048: SIMPLE_TEST 3 regions packed; pages.length === 1 | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "Original 2048"` | ❌ Wave 0 |
| F7.1 | Optimized mode at 2048: same regions at outW/outH; efficiency strictly higher than Original | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "Optimized 2048"` | ❌ Wave 0 |
| F7.1 | Override 50% on TRIANGLE: Optimized projection's TRIANGLE region has expected packed dims | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "override TRIANGLE"` | ❌ Wave 0 |
| F7.1 | Ghost-fixture: GHOST excluded from BOTH modes (D-109 parity) | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "unused excluded"` | ❌ Wave 0 |
| F7.1 | Atlas-packed fixture: BEFORE uses atlasSource.w/h, not page dims | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "atlas-packed"` | ❌ Wave 0 |
| F7.1 | Multi-page projection at small page cap: pages.length > 1, regions deterministic | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "multi-page"` | ❌ Wave 0 |
| F7.1 | Math.ceil-thousandth on Optimized dims matches Phase 6 D-110 Round 5 | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "ceil-thousandth"` | ❌ Wave 0 |
| F7.2 | dims + page count + per-page efficiency surface in projection | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "metrics surface"` | ❌ Wave 0 |
| F7 (D-130) | Modal opens with default view (Optimized @ 2048, page 1) | renderer | `npm run test -- tests/renderer/atlas-preview-modal.spec.tsx -t "default view"` | ❌ Wave 0 |
| F7 (D-128) | Toggle re-render: switching mode/resolution updates page count | renderer | `npm run test -- tests/renderer/atlas-preview-modal.spec.tsx -t "toggle re-render"` | ❌ Wave 0 |
| F7 (D-128) | Pager bounds-disable correctly | renderer | `npm run test -- tests/renderer/atlas-preview-modal.spec.tsx -t "pager bounds"` | ❌ Wave 0 |
| F7 (D-130) | Dblclick on canvas fires onJumpToAttachment with correct attachmentName | renderer | `npm run test -- tests/renderer/atlas-preview-modal.spec.tsx -t "dblclick jump"` | ❌ Wave 0 |
| F7 (D-137) | Missing-source path: rect outline + ⚠ glyph rendered when img onerror fires | renderer | `npm run test -- tests/renderer/atlas-preview-modal.spec.tsx -t "missing source"` | ❌ Wave 0 (drawImage skipped — see Open Question 3) |
| Layer 3 | `src/core/atlas-preview.ts` does not import sharp / node:fs / electron / DOM | unit | `npm run test -- tests/arch.spec.ts` | ✅ (extend existing file) |
| Layer 3 parity | `src/renderer/src/lib/atlas-preview-view.ts` is byte-identical to core copy | unit | `npm run test -- tests/core/atlas-preview.spec.ts -t "parity"` | ❌ Wave 0 |
| Visual / pixel-correct | Modal renders rectangles correctly on real fixture | manual-only (checkpoint:human-verify) | `npm run dev` then drop SIMPLE_TEST.json + click Atlas Preview | ❌ post-execute |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/core/atlas-preview.spec.ts` (sub-second)
- **Per wave merge:** `npm run test` (full suite ~1-2 s currently; Phase 7 adds maybe 20 specs)
- **Phase gate:** Full suite green + `npx electron-vite build` green + `npm run cli ...` byte-identical (CLI lock D-102) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/atlas-preview.spec.ts` — covers F7.1, F7.2, parity, hygiene grep
- [ ] `tests/renderer/atlas-preview-modal.spec.tsx` — covers D-128/D-130/D-137
- [ ] `tests/arch.spec.ts` — extend Layer 3 grep to include `src/core/atlas-preview.ts` (and the parity grep if inline copy created)
- [ ] `vitest.config.ts` — extend `include` to add `tests/**/*.spec.tsx`
- [ ] `tests/setup-jsdom.ts` (optional) — if testing-library globals need pre-registration; otherwise per-file pragma is sufficient
- [ ] Framework install: `npm install maxrects-packer && npm install --save-dev @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom`
- [ ] Atlas-packed test fixture (Jokerman or synthesized minimal atlas-packed JSON+atlas+PNG) — needed for D-126 test case (e). If Jokerman is in `temp/` it's gitignored; planner must synthesize a minimal atlas-packed fixture into `fixtures/`.

## Security Domain

> Required when `security_enforcement` is enabled (absent = enabled).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | n/a — local desktop app, no auth |
| V3 Session Management | no | n/a |
| V4 Access Control | yes | Trust boundary at the dropped JSON; sibling files are trusted (Phase 1 D-09 + Phase 6 D-122 precedent) |
| V5 Input Validation | yes | `protocol.handle` callback decodes URL pathname; planner SHOULD add a path-prefix allow-list built from the loaded summary (defense-in-depth) |
| V6 Cryptography | no | n/a — no crypto operations |
| V14 Configuration | yes | CSP must be minimally widened (`img-src` adds `app-image:`); MUST NOT widen `script-src` or `default-src` |

### Known Threat Patterns for {Electron renderer + custom protocol}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `app-image:///../../../etc/passwd` | Tampering / Information Disclosure | Defense-in-depth: protocol.handle should validate the requested path is under the loaded skeleton's directory tree (whitelist built from `summary.peaks[].sourcePath` + `summary.peaks[].atlasSource.pagePath`). Phase 1 already validates loader sibling paths; this adds a runtime gate. |
| CSP regression (img-src widened beyond `app-image:`) | Spoofing / Tampering | Phase 7 ONLY adds `app-image:` to `img-src`. Plan-checker MUST grep the new CSP and flag any wider change. |
| `protocol.handle` MIME sniffing | Tampering | `net.fetch` reads file bytes; Chromium sniffs MIME from content. Acceptable for PNG/JPEG/WebP; planner could pin Content-Type via `new Response(..., { headers: { 'Content-Type': 'image/png' } })` if MIME sniffing causes issues. Out of scope for first pass. |
| Cross-origin canvas taint via custom protocol | Information Disclosure | If `app-image:` is registered without `secure: true`, browsers may treat the canvas as tainted (toDataURL throws SecurityError). The recommended `privileges: { secure: true }` config avoids this. **Phase 7 doesn't call canvas.toDataURL** (no atlas export per Deferred Ideas) so this is moot — but locking the privilege stops a future regression. |
| `<img>` element memory leak | DoS | Hoist image cache into a `useRef` inside the modal so unmount frees the cache (Pitfall 4). |
| maxrects-packer prototype pollution via `data` field | Tampering | The `data` field is `any` in the lib type; we pass plain objects only (AtlasPreviewInput). No string-keyed `__proto__`/`constructor` injection surface — verified by audit of dist code (no `Object.assign(target, untrusted)` patterns). |
| User-controlled string in `attachmentName` reaches DOM | XSS | All renderer DOM writes go through React text nodes (XSS-safe). The canvas label overlay uses `ctx.fillText(attachmentName, …)` which renders as pixels, not HTML — XSS-safe. |

## Sources

### Primary (HIGH confidence)
- npm registry — `maxrects-packer@2.7.3`: `npm view maxrects-packer` confirmed `deps: none`, MIT license, last published >1y ago. Tarball downloaded + audited (`/tmp/mrp-probe`, 2026-04-25): zero matches for `node:`/`fs`/`path`/`crypto`/`os`/`stream`/`child_process` across `dist/`, `lib/`, `src/`.
- maxrects-packer `dist/maxrects-packer.d.ts` — full constructor / IOption / IBin / IRectangle declarations transcribed verbatim.
- Project codebase 2026-04-25 — `src/core/export.ts`, `src/shared/types.ts`, `src/renderer/src/modals/{OverrideDialog,OptimizeDialog,ConflictDialog}.tsx`, `src/renderer/src/components/AppShell.tsx`, `src/renderer/src/panels/{GlobalMaxRenderPanel,AnimationBreakdownPanel}.tsx`, `src/renderer/src/hooks/useFocusTrap.ts`, `src/renderer/src/lib/{overrides-view,export-view}.ts`, `src/renderer/index.html`, `src/main/index.ts`, `tests/arch.spec.ts`, `vitest.config.ts`, `package.json`.

### Secondary (MEDIUM-HIGH confidence)
- developer.mozilla.org — `CanvasRenderingContext2D.drawImage()` 9-arg form signature + source-image natural-pixel-space behavior + load-event safety [VERIFIED via WebFetch 2026-04-25].
- developer.mozilla.org — `HTMLImageElement` error event triggers (CSP blocks, network 404, decode failure, malformed metadata, unsupported format) + `complete` + `naturalWidth` fallback pattern [VERIFIED via WebFetch 2026-04-25].
- developer.mozilla.org — `Window.devicePixelRatio` + canvas crisp-render pattern (`canvas.width = size * dpr; canvas.style.width = size + 'px'; ctx.scale(dpr, dpr)`) + drawImage automatically respects `ctx.scale` so destination coords stay in CSS pixels [VERIFIED via WebFetch 2026-04-25].
- electronjs.org/docs/latest/api/protocol — `protocol.handle()` as the modern replacement for `protocol.registerFileProtocol()` (deprecated); MUST run before `app.whenReady()` resolves; `registerSchemesAsPrivileged` config with `standard: true, secure: true, supportFetchAPI: true` [VERIFIED via WebFetch 2026-04-25].
- electronjs.org/docs/latest/tutorial/security — explicit recommendation to "use a custom protocol instead of file://" for serving local pages/files; file:// has more privileges in Electron than in browser [VERIFIED via WebFetch 2026-04-25].

### Tertiary (LOW confidence — needs validation in plan execution)
- Node 24 + jsdom 25 + vitest 4 + @testing-library/react 16 compatibility matrix — versions are current stable as of 2026-04-25, but planner must run `npm view ... version` at install time to confirm and check for any known breakage in changelogs.
- Electron 41 sandbox compatibility with `protocol.handle` — Electron docs don't enumerate sandbox-specific restrictions; recommend dev-mode verification immediately after wiring (early-feedback gate).

## Metadata

**Confidence breakdown:**
- Standard stack (maxrects-packer): HIGH — package audited end-to-end; zero deps, browser-safe.
- Architecture (modal scaffold + Layer 3 inline copy + jump-target consumer): HIGH — patterns exist verbatim in the codebase, just need to clone.
- Pitfalls (CSP file://, GlobalMaxRenderPanel jump-target gap, Tailwind v4 literals, smart+pot interaction): HIGH — verified against codebase + Electron docs.
- Renderer test framework (jsdom + @testing-library/react): MEDIUM — established industry choice; project hasn't done this yet, so first-time setup risk is small.
- Pot/square configuration default: MEDIUM — recommendation made; user may push back. Needs plan-checker checkpoint.
- File-system / OS-level concerns: HIGH — none beyond protocol.handle.

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days; lib choices stable, Electron 41 stable, project rules locked)

## RESEARCH COMPLETE

**Phase:** 7 — Atlas Preview modal
**Confidence:** HIGH

### Key Findings
1. **`maxrects-packer@2.7.3` is browser-safe (verified end-to-end).** Zero Node deps in `dist/`/`lib/`/`src/` — safe to import from `src/core/atlas-preview.ts` without breaking Layer 3. Pure-renderer projection path (D-132 + Layer 3 inline copy) is feasible; no IPC fallback needed.
2. **CONTEXT D-133 is contradicted by the codebase.** The current CSP (`src/renderer/index.html:7`) does NOT permit `file://` images, and the renderer has never decoded a PNG before. **Plan must amend D-133** to use `protocol.handle('app-image', ...)` (Electron's recommended pattern; verified) — minimal impact: adds ~12 lines to `src/main/index.ts` + extends CSP `img-src` by one scheme.
3. **CONTEXT line 222 is incorrect about GlobalMaxRenderPanel.** The jump-target consumer pattern exists ONLY in `AnimationBreakdownPanel.tsx:299-325`. Phase 7 must port that pattern to `GlobalMaxRenderPanel.tsx` (new `focusAttachmentName` + `onFocusConsumed` props + per-row refs + flash effect). Small extension, ~30 lines.
4. **maxrects-packer `pot: true, square: true` defaults will artificially deflate efficiency** for small rigs at 2048/4096 caps. Recommend `pot: false, square: false` for the projection (tight-fit bin sizing, honest efficiency calc); flag for user confirmation if planner wants pot-aligned pages instead.
5. **Renderer test framework: vitest + jsdom + @testing-library/react.** vitest already supports per-file `// @vitest-environment jsdom` pragma — minimal config change. Skip canvas-pixel renderer specs (jsdom can't render canvas); rely on `tests/core/atlas-preview.spec.ts` for projection math + manual checkpoint:human-verify for visual rendering.

### File Created
`.planning/phases/07-atlas-preview-modal/07-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | npm registry verified; tarball audited; zero deps confirmed; existing test framework choice is industry-standard. |
| Architecture | HIGH | Every pattern (ARIA modal, focus-trap, Layer 3 inline copy, jump-target consumer, dpr canvas, drawImage 9-arg) exists verbatim in the codebase or in MDN — Phase 7 clones, doesn't invent. |
| Pitfalls | HIGH | Pitfall 1 (CSP) and Pitfall 2 (GlobalMaxRenderPanel gap) flagged via direct codebase reads. Pitfall 7 (smart+pot interaction) is a first-time finding. |

### Open Questions
1. Pot-aligned vs tight-fit bin sizing (Recommendation A: tight-fit). User confirmation suggested at plan-checker.
2. `app-image://` URL host convention on Windows (defer until Windows target — Phase 9).
3. Atlas-packed test fixture (Jokerman is in `temp/`, gitignored; planner must synthesize a minimal `fixtures/` atlas-packed JSON+atlas+page for D-126 test (e)).

### Ready for Planning
Research complete. Planner can now create PLAN.md files and is expected to:
- Amend D-133 to adopt `protocol.handle('app-image', ...)` instead of raw `file://` URLs.
- Add a task for porting the jump-target consumer pattern from AnimationBreakdownPanel to GlobalMaxRenderPanel.
- Decide pot/square configuration (recommended: tight-fit) — flag for user confirmation if uncertain.
- Confirm renderer test framework adoption (vitest+jsdom+@testing-library/react).
- Synthesize atlas-packed test fixture for D-126 coverage (or descope test (e) until a fixture is available).
