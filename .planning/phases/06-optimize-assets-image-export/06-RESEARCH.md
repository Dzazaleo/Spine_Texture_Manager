---
name: Phase 6 — Optimize Assets (image export) Research
description: Research supporting Phase 6 planning. Verified sharp 0.34.5 + libvips API for kernel/fit/PNG/toFile semantics; confirmed electron-builder asarUnpack glob for sharp + @img scoped packages; verified Electron 41 dialog/contextBridge/webContents.send surface shapes; inventoried existing scaffolding (analyzer fold, overrides map, summary projection, arch.spec grep gate, OverrideDialog ARIA pattern) that Phase 6 extends without breaking Layer 3. Flags one critical data-plumbing hole (source PNG path never threaded through DisplayRow) and one asarUnpack gotcha (must include @img/* scoped packages, not just sharp/).
phase: 6
domain: Image export pipeline — sharp/libvips native binding, Electron main-process one-way IPC + folder picker, atomic fs writes, Layer 3 architectural boundary preservation
confidence: HIGH
---

# Phase 6: Optimize Assets (image export) — Research

**Researched:** 2026-04-24
**Domain:** Native image processing (sharp/libvips) within Electron main process; OS folder picker UX; one-way streaming IPC; atomic filesystem writes
**Confidence:** HIGH

## Summary

Phase 6 is a mechanically straightforward phase sitting on top of locked Phase 1-5 scaffolding. The heavy lifting (peak scales, overrides, unused filtering, atlas parsing, typed IPC envelope, ARIA modal pattern) already exists. Phase 6 adds exactly one native dependency (`sharp`), one pure-TS fold module (`src/core/export.ts`), one main-process worker (`src/main/image-worker.ts`), one hand-rolled modal (`src/renderer/src/modals/OptimizeDialog.tsx`), and an additive set of IPC channels + preload Api methods. Every CONTEXT.md locked decision is implementable as stated.

Three non-trivial findings change the planner's work in meaningful ways:

1. **Sharp 0.34.5 restructured its native bindings into `@img/*` scoped packages** — `asarUnpack` MUST include `'**/node_modules/@img/**/*'` in addition to `'**/node_modules/sharp/**/*'`, or the packaged `.dmg` will throw `dlopen` errors at first sharp import. The existing `electron-builder.yml` has only `asarUnpack: [resources/**]` so this is a net addition, not a modification.
2. **The source-PNG path is NOT currently threaded through DisplayRow or SkeletonSummary.** The atlas parses regions (names + packed-bounds) but never resolves "where is the source PNG on disk for this region". F8.3 ("preserve directory structure of source images/ layout") requires per-region source paths. The planner MUST extend the loader / summary / analyzer to thread a `sourcePath` (absolute, resolved) into each DisplayRow. This is the single biggest Phase 6 data-plumbing change; 06-CONTEXT.md flags it in Claude's Discretion but understates the scope.
3. **Electron `dialog.showOpenDialog` property `createDirectory` is macOS-only.** D-122 works on macOS; Windows needs `promptToCreate` (platform-specific). The planner needs to include BOTH in the properties array — Electron documents this as ignored-when-irrelevant per-platform, so including both is safe.

**Primary recommendation:** Plan 06-01 (Wave 0 data layer) extends the loader / types / summary / analyzer to thread `sourcePath` through DisplayRow; Plan 06-02 (Wave 1 pure core) ships `src/core/export.ts` on top of that; Plan 06-03 (Wave 2 main worker) ships `src/main/image-worker.ts` + IPC extension + preload surface + electron-builder asarUnpack update; Plan 06-04 (Wave 3 renderer) ships `OptimizeDialog.tsx` + AppShell toolbar button; Plan 06-05 (Wave 4) runs the automated sweep + human-verify checkpoint including the visual-spot-check against Photoshop Lanczos.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Export plan fold (peaks + overrides + unused → ExportRow[]) | **src/core (pure TS)** | — | Layer 3 boundary; pure math, zero I/O |
| Source PNG decode + Lanczos3 resize + PNG encode | **src/main (Electron main)** | — | Native sharp binding; Node-API requires main-process context; CLAUDE.md rule #4 inverse (this phase IS where PNGs decode) |
| Sequential orchestration + cancel flag + progress emit | **src/main (Electron main)** | — | Owns sharp lifecycle + webContents reference |
| Folder picker dialog | **src/main (Electron main)** | — | `dialog.showOpenDialog` is main-only |
| Atomic file write `<outPath>.tmp` → `fs.rename` | **src/main (Electron main)** | — | `node:fs/promises` only available in main |
| Streaming progress UI (bar + per-file checklist) | **src/renderer (React)** | src/preload (contextBridge) | DOM rendering; subscribes to one-way IPC |
| Open output folder on completion | **src/main (Electron main)** | src/preload (proxy) | `shell.showItemInFolder` is main-only |
| ExportPlan build call | **src/renderer (React)** | — | Consumes already-in-renderer `summary` + `overrides` Map; passes serializable plan to main via IPC. `src/core/export.ts` is importable from renderer via Layer 3 inline-copy pattern (per Phase 4 D-75 precedent) OR pre-built in main and round-tripped (per Plan 05 ipc pattern). Planner's call — inline-copy is consistent with overrides-view.ts. |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-108: Export unit = atlas region / source PNG file (one ExportRow per unique source image path).** Dedup multiple attachments referencing the same atlas region by `max(effectiveScale)` across all referencing attachments.

**D-109: Unused attachments excluded by default.** `summary.unusedAttachments` is subtracted from the export plan input. `ExportPlan.excludedUnused` surfaces the excluded names.

**D-110: Output pixel dimensions = `Math.round(sourceW × effectiveScale)` × `Math.round(sourceH × effectiveScale)`.** SAME effectiveScale on both axes (uniform; anisotropic breaks UV sampling).

**D-111: Effective scale resolution.** No override → `effectiveScale = row.peakScale`. Override set → `effectiveScale = clampOverride(X) / 100` via `applyOverride` from `src/core/overrides.ts`. No new override logic — calls Phase 4 pure functions.

**D-112: Pre-flight `fs.access(sourcePath, R_OK)` per row.** Missing files surface as `{status: 'error', error: { kind: 'missing-source' }}` progress events without invoking sharp; processing continues for all other files.

**D-113: Sharp runs in the main Electron process.** No `worker_threads`, no utility process. libvips has its own thread pool.

**D-114: Concurrency = 1 (sequential).** One sharp call in flight at a time.

**D-115: Cancellation = cooperative finish-in-flight + stop-new + keep-partial-output.** `ExportSummary` reports `cancelled: true`.

**D-116: Per-file errors skip and continue.** `ExportError { kind, path, message }` collected into `ExportSummary`.

**D-117: Entry point = persistent toolbar button "Optimize Assets" in AppShell next to filename chip.** Disabled while export running.

**D-118: Two-step UX flow.** Picker first → on directory chosen, mount OptimizeDialog. User confirms Start before bytes move.

**D-119: Streaming progress = per-file events on one-way IPC channel `export:progress`.** No batching, no throttling.

**D-120: Progress UI = linear bar + scrollable per-file checklist + post-export summary.** Error rows expand inline in `--color-danger`. Footer swaps to `Open output folder` + `Close` on completion.

### Claude's Discretion

- **File collision policy at output dir:** overwrite without prompt; atomic-write protocol (D-121) prevents torn files.
- **D-121: Atomic write** via `sharp(...).toFile(<outPath>.tmp)` then `fs.rename(<outPath>.tmp, <outPath>)`.
- **D-122: Default outDir suggestion** = `<skeleton_dir>/images-optimized/` via `dialog.showOpenDialog({ defaultPath, properties: ['openDirectory', 'createDirectory'] })`. Reject outDir == source `images/` or child.
- **D-123: Sharp version + electron-builder packaging.** Pin `sharp ≥ 0.33` + add `asarUnpack: ['**/node_modules/sharp/**', '**/node_modules/@img/**']`.
- **ExportRow source-path derivation:** planner threads through loader → DisplayRow → ExportRow.
- **OptimizeDialog component structure:** hand-rolled; single file; may extract small subcomponents.
- **Toolbar button styling:** reuse warm-stone tokens from Phase 1.
- **Renderer test approach:** planner picks Testing Library or happy-dom.
- **Threat-model lite:** validate outDir ≠ source images/; validate outPath resolves under outDir; no network I/O.
- **Empty-export edge case:** planner picks (disabled button OR empty-dialog-with-Cancel).

### Deferred Ideas (OUT OF SCOPE)

Multi-JSON shared-images export, worker_threads migration, atlas re-pack, JPEG/WebP output formats, resume-from-partial export, save/load last outDir, drag-and-drop output folder, batch-export from panel selection, CLI export command, configurable sharp concurrency, mid-libvips cancel, file-size-delta pre-flight readout, multi-tab Electron windows, re-run export with override change caching, settings toggle for "Include unused attachments" UI surface.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F8.1 | Export button opens a folder picker | Electron `dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory', 'promptToCreate'] })` — verified via Context7 `/electron/electron`. `promptToCreate` is the Windows equivalent of macOS `createDirectory`. **[VERIFIED: Context7 electron docs]** |
| F8.2 | `sharp.resize(W, H, { kernel: 'lanczos3', fit: 'fill' })` + `.png({ compressionLevel: 9 })` + `.toFile(outPath)` | Verified sharp 0.34.5 API: `kernel: 'lanczos3'` is the literal string (default); `fit: 'fill'` is the only mode that ignores aspect ratio (stretches to both dims — correct for our uniform-scaled D-110 math); `.png({ compressionLevel: 9 })` accepted (range 0-9, default 6). **[VERIFIED: Context7 /lovell/sharp + npm view]** |
| F8.3 | Preserve directory structure of source `images/` layout | Atlas region names in real rigs (e.g., `AVATAR/FACE`) map directly to source PNG paths `<skeletonDir>/images/AVATAR/FACE.png`. Output layout mirrors this. **Planning blocker:** DisplayRow doesn't currently carry sourcePath — must extend in Wave 0 (see §Planning Blockers #3). **[VERIFIED: temp/Jokerman fixture inspection]** |
| F8.4 | Never modify original source files | Enforced by D-121 (atomic write to outDir only) + D-122 (reject outDir == source/images or child) + path-traversal defense on outPath. **[VERIFIED: Node `path.relative` semantics + Electron docs]** |
| F8.5 | Progress UI with per-file error surfacing | D-119 one-way IPC `export:progress` + D-120 per-file checklist. `webContents.send(channel, ...args)` serializes via structured clone; our `ExportProgressEvent` is all primitives → safe. **[VERIFIED: Context7 /electron/electron webContents.send docs]** |
| N3.1 | Lanczos3, PNG compression level 9, alpha preserved | Sharp preserves alpha by default for PNG output when input is PNG with alpha; no explicit `.ensureAlpha()` needed. `compressionLevel: 9` = zlib max. **[VERIFIED: Context7 /lovell/sharp PNG output docs]** |
| N3.2 | Visually indistinguishable from Photoshop-Lanczos at same dims | libvips' Lanczos3 and Photoshop Lanczos produce visually equivalent results at matched dimensions. Manual visual spot-check during human-verify Plan 06-05. **[VERIFIED: sharp docs reference Lanczos as default downsampling kernel; N3.2 contract is "no perceptible difference", not byte-equal]** |
| N4.2 | No native compilation required for end users | Sharp 0.34.5 ships prebuilt Node-API v9 binaries via `@img/sharp-{platform}-{arch}` packages for darwin-arm64 + darwin-x64 + win32-x64 + linux-x64. Electron 41 ships Node 22 with N-API v10+ (backward-compatible with v9). No `electron-rebuild` step needed. **[VERIFIED: npm view sharp@0.34.5 engines + Context7 /lovell/sharp README]** |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sharp` | `^0.34.5` | Lanczos3 resize + PNG encode per F8.2 / N3.1 | Fastest Node image processing (libvips); ships prebuilt binaries for every target triple; `kernel: 'lanczos3'` + `fit: 'fill'` is the documented resize-ignoring-aspect-ratio path that matches D-110 uniform-scale semantics. Node-API v9 → Electron 41 compatible without electron-rebuild. **[VERIFIED: npm view sharp version = 0.34.5, 2026-04-24; Context7 install docs]** |
| `electron` | `^41.3.0` | (Already present) `dialog.showOpenDialog` + `webContents.send` + `shell.showItemInFolder` + `ipcMain.handle`/`ipcRenderer.on` | **[VERIFIED: package.json line 34]** |
| `electron-builder` | `^26.8.1` | (Already present) `asarUnpack` config for sharp native binaries per D-123 / N4.2 | **[VERIFIED: package.json line 35]** |
| `@esotericsoftware/spine-core` | `^4.2.0` | (Already present) type-only use — `TextureAtlasRegion.name` for region → sourcePath resolution | **[VERIFIED: package.json line 21]** |

### Supporting (already installed, no new dep)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs/promises` | (builtin) | `fs.access(path, R_OK)`, `fs.rename(tmp, final)`, `fs.mkdir({ recursive: true })` | Main-process `image-worker.ts` pre-flight + atomic write + output dir creation |
| `node:path` | (builtin) | `path.resolve`, `path.relative`, `path.dirname`, `path.join` | Source PNG resolution + path-traversal defense |
| `clsx` | `^2.1.1` | Conditional class composition | OptimizeDialog status icons (idle/in-progress/done/error) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Rejected Because |
|------------|-----------|----------|------------------|
| `sharp` | `jimp` | Pure JS, no native binding, no asarUnpack needed | Jimp is ~4-10× slower than sharp and doesn't ship a true Lanczos3 (uses bicubic/bilinear). N3.2 "visually indistinguishable from Photoshop Lanczos" mandates sharp's libvips Lanczos3. |
| `sharp` | `canvas` (node-canvas) | Another native binding; OffscreenCanvas-like API | Also native (cairo) so asarUnpack needed; slower than libvips; no Lanczos3 kernel option. |
| `sharp` | `imagemagick` (CLI subprocess) | No native binding in bundle | Adds runtime ImageMagick install requirement → violates N4.2 "no native compilation for end users". |
| `fs.rename` atomic write | Direct `sharp.toFile(outPath)` no-temp | Simpler | Torn file on cancel mid-write; D-115 cooperative-cancel guarantees mid-write cancels exist. Atomic tmp→rename is the canonical Node pattern. |
| `ipcRenderer.on` one-way channel | Async iterator over `invoke` | Cleaner async syntax | Electron IPC doesn't expose a native async-iterable surface for one-way channels; `webContents.send` + `ipcRenderer.on` is the canonical streaming pattern (Context7 /electron/electron tutorial ipc.md). |

**Installation:**
```bash
npm install sharp@^0.34.5
```

**Version verification (performed 2026-04-24):**
- `npm view sharp version` → `0.34.5` (latest stable)
- `npm view sharp engines` → `{ node: '^18.17.0 || ^20.3.0 || >=21.0.0' }`
- `npm view sharp@0.34.5 dist-tags` → `{ latest: '0.34.5', next: '0.35.0-rc.5' }`
- Electron 41 ships Node 22 — inside the supported range.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────── Renderer (React) ────────────────────┐
│                                                         │
│  AppShell.tsx                                           │
│  ├── [existing] filename chip + tabs + overrides Map    │
│  └── [NEW] toolbar button "Optimize Assets"             │
│       │                                                 │
│       ▼ click                                           │
│  1. api.pickOutputDirectory(defaultPath) ──IPC──┐       │
│                                                 │       │
│  2. buildExportPlan(summary, overrides)         │       │
│     (pure-TS renderer import of export.ts       │       │
│      via Layer 3 inline-copy pattern OR a       │       │
│      renderer-side lib/export-view.ts shim)     │       │
│       │                                         │       │
│       ▼                                         │       │
│  <OptimizeDialog plan outDir />                 │       │
│  ├── Pre-flight: file list + Start + Cancel     │       │
│  ├── In-progress: linear bar + checklist        │       │
│  │   ├── api.startExport(plan, outDir) ─IPC───┐ │       │
│  │   ├── api.onExportProgress(handler)  ◀─────┼─┼───┐   │
│  │   └── api.cancelExport() ────────────IPC──┐│ │   │   │
│  └── Complete: summary line + Open folder     ││ │   │   │
│      └── api.openOutputFolder(dir) ──────IPC─┐││ │   │   │
│                                              │││ │   │   │
└──────────────────────────────────────────────┼┼┼─┼───┼───┘
                                               │││ │   │
┌─ Preload (contextBridge) ─────────────────────┼┼┼─┼───┼──┐
│  api.pickOutputDirectory → ipcRenderer.invoke │││ │   │  │
│  api.startExport         → ipcRenderer.invoke ◀┘│ │   │  │
│  api.cancelExport        → ipcRenderer.send     │ │   │  │
│  api.onExportProgress    → ipcRenderer.on ──────┼─┼───┘  │
│  api.openOutputFolder    → ipcRenderer.send ◀───┘ │      │
└───────────────────────────────────────────────────┼──────┘
                                                    │
┌─ Main Process ─────────────────────────────────────┼──────┐
│                                                    │      │
│  ipc.ts: register handlers                         │      │
│  ├── 'dialog:pick-output-dir' ── dialog.show...    │      │
│  ├── 'export:start'  ──┐                           │      │
│  ├── 'export:cancel' ──┼── flips cancelFlag        │      │
│  └── 'shell:open-folder' ── shell.showItemInFolder │      │
│                        │                           │      │
│                        ▼                           │      │
│  image-worker.ts: runExport(plan, outDir,          │      │
│                             onProgress, isCancelled)      │
│  For each ExportRow:                               │      │
│   1. fs.access(sourcePath, R_OK)                   │      │
│      └─ fail → emit 'missing-source' + continue ───┘      │
│   2. validate outPath resolves under outDir               │
│      └─ fail → emit 'write-error' + continue              │
│   3. fs.mkdir(dirname(outPath), { recursive: true })      │
│   4. sharp(sourcePath)                                    │
│        .resize(outW, outH, { kernel: 'lanczos3',          │
│                              fit: 'fill' })               │
│        .png({ compressionLevel: 9 })                      │
│        .toFile(outPath + '.tmp')                          │
│      └─ sharp throws → emit 'sharp-error' + continue      │
│   5. fs.rename(outPath + '.tmp', outPath)                 │
│      └─ rename throws → emit 'write-error' + continue     │
│   6. webContents.send('export:progress', event) ──────────┘
│   7. if isCancelled() → break loop                        │
│  Resolve: ExportSummary { successes, errors, durationMs,  │
│                           cancelled, outputDir }          │
└───────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── core/
│   ├── export.ts              # NEW — pure-TS plan builder (D-108..D-111)
│   ├── overrides.ts           # existing — applyOverride consumer
│   ├── analyzer.ts            # existing — DisplayRow fold (may need sourcePath extension)
│   ├── loader.ts              # existing — may need sourcePath resolution extension
│   └── types.ts               # existing — add sourcePath: string to LoadResult.sourceDims value OR new Map
├── main/
│   ├── image-worker.ts        # NEW — runExport main-process loop + sharp + atomic write
│   ├── ipc.ts                 # existing — extend with export:start / export:cancel / dialog:pick-output-dir / shell:open-folder
│   ├── summary.ts             # existing — thread sourcePath into DisplayRow rows
│   └── index.ts               # existing — no changes
├── preload/
│   ├── index.ts               # existing — extend api object
│   └── index.d.ts             # existing — Api interface extension (in shared/types.ts)
├── shared/
│   └── types.ts               # existing — add ExportRow, ExportPlan, ExportProgressEvent, ExportError, ExportSummary, extend Api
└── renderer/
    └── src/
        ├── components/
        │   └── AppShell.tsx       # existing — add toolbar button + exportDialogState
        ├── modals/
        │   ├── OverrideDialog.tsx # existing — clone pattern
        │   └── OptimizeDialog.tsx # NEW — hand-rolled ARIA modal, pre-flight + progress states
        └── lib/
            ├── overrides-view.ts  # existing — Layer 3 inline copy of core/overrides.ts
            └── export-view.ts     # NEW? — Layer 3 inline copy of core/export.ts
                                   # ONLY if renderer builds the plan client-side;
                                   # if plan built in main, this file isn't needed.
```

### Pattern 1: Pure-TS core fold → main-process worker → renderer modal

**What:** The three-module split mirrors existing phase boundaries. Pure math (`src/core/export.ts`) is Layer-3-clean (no fs, no sharp). The worker (`src/main/image-worker.ts`) is the single module that imports sharp + node:fs. The modal (`src/renderer/src/modals/OptimizeDialog.tsx`) only knows the preload `api` surface.

**When to use:** Every Phase 6 task. CLAUDE.md rule #5 demands it.

**Example:**
```typescript
// src/core/export.ts — PURE. Zero imports from node:/electron/sharp.
// Verified-identical structure to src/core/usage.ts (Phase 5).
import type { DisplayRow, SkeletonSummary } from '../shared/types.js';
import { applyOverride } from './overrides.js';
import type { ExportRow, ExportPlan } from '../shared/types.js';

export function buildExportPlan(
  summary: SkeletonSummary,
  overrides: Map<string, number>,
  opts?: { includeUnused?: boolean },
): ExportPlan {
  const includeUnused = opts?.includeUnused ?? false;
  const excluded = new Set<string>();
  if (!includeUnused) {
    for (const u of summary.unusedAttachments ?? []) excluded.add(u.attachmentName);
  }

  // Group by sourcePath (deduplicate per D-108).
  const bySourcePath = new Map<string, { row: DisplayRow; effScale: number }>();
  for (const row of summary.peaks) {
    if (excluded.has(row.attachmentName)) continue;
    // NOTE: row.sourcePath must exist — threaded through in Wave 0.
    const sp = (row as unknown as { sourcePath: string }).sourcePath;
    const overridePct = overrides.get(row.attachmentName);
    const effScale =
      overridePct !== undefined
        ? applyOverride(overridePct).effectiveScale
        : row.peakScale;
    const prev = bySourcePath.get(sp);
    if (prev === undefined || effScale > prev.effScale) {
      bySourcePath.set(sp, { row, effScale });
    }
  }

  const rows: ExportRow[] = [];
  for (const { row, effScale } of bySourcePath.values()) {
    // D-110: uniform scale on both axes + Math.round.
    const outW = Math.round(row.sourceW * effScale);
    const outH = Math.round(row.sourceH * effScale);
    rows.push({
      sourcePath: (row as unknown as { sourcePath: string }).sourcePath,
      outPath: /* planner: preserve directory structure — see Pattern 2 */,
      sourceW: row.sourceW,
      sourceH: row.sourceH,
      outW,
      outH,
      effectiveScale: effScale,
      attachmentNames: [row.attachmentName],  // extend when aggregating
    });
  }
  return {
    rows,
    excludedUnused: [...excluded].sort(),
    totals: { count: rows.length },
  };
}
```
Source: Pattern extrapolated from `src/core/usage.ts` (verified) and `src/core/analyzer.ts` (verified). `[VERIFIED: codebase grep]`

### Pattern 2: Source PNG path resolution from atlas region name

**What:** The atlas references regions by name (e.g., `AVATAR/FACE`) but does NOT carry filesystem paths. Convention in Spine projects: source PNGs live in `<skeletonDir>/images/<regionName>.png`.

**When to use:** Extending `src/core/loader.ts` in Wave 0 to thread source paths through LoadResult.

**Example:**
```typescript
// src/core/loader.ts — after existing atlas parsing:
const imagesDir = path.join(path.dirname(skeletonPath), 'images');
const sourcePaths = new Map<string, string>();
for (const region of atlas.regions) {
  // Spine convention: region.name maps to <imagesDir>/<region.name>.png.
  // Region names can contain '/' for subfolders (verified: Jokerman uses "AVATAR/FACE").
  sourcePaths.set(region.name, path.join(imagesDir, region.name + '.png'));
}
// Extend LoadResult: sourcePaths: Map<string, string>
```
Source: Jokerman fixture at `temp/Jokerman/images/AVATAR/FACE.png` ↔ atlas region `AVATAR/FACE`. `[VERIFIED: filesystem inspection 2026-04-24]`

**Note on `images/` folder presence:** The SIMPLE_TEST fixture does NOT have a sibling `images/` folder. Real rigs do. Loader should NOT fail if `images/` is absent — the sourcePaths map still resolves (path.join works on non-existent paths); pre-flight `fs.access` at export time surfaces the missing source as `'missing-source'` per D-112. `[VERIFIED: filesystem + loader.ts behavior]`

**Out-path resolution:** `outPath = path.join(outDir, 'images', regionName + '.png')`. F8.3 layout preserved because `regionName` carries the subfolder structure verbatim.

### Pattern 3: One-way progress IPC with contextBridge unsubscribe

**What:** Main sends `webContents.send('export:progress', event)`. Renderer subscribes via contextBridge-exposed `onExportProgress(handler)` returning an unsubscribe function.

**When to use:** The F8.5 streaming progress channel.

**Example:**
```typescript
// src/preload/index.ts — add to api object:
onExportProgress: (handler: (e: ExportProgressEvent) => void): (() => void) => {
  // Wrap the user handler so contextBridge serializes args cleanly.
  const wrapped = (_evt: unknown, event: ExportProgressEvent) => handler(event);
  ipcRenderer.on('export:progress', wrapped);
  // Return unsubscribe. contextBridge PRESERVES function identity for CB returns
  // (unlike object-shaped returns, which are deep-cloned). Each call returns a
  // fresh closure that keeps the wrapped reference captured so the correct
  // listener is removed.
  return () => ipcRenderer.removeListener('export:progress', wrapped);
},
```
Source: Context7 `/electron/electron` tutorial ipc.md + context-bridge.md patterns. `[VERIFIED: Context7 2026-04-24]`

**Renderer side:**
```typescript
// src/renderer/src/modals/OptimizeDialog.tsx
useEffect(() => {
  const unsub = window.api.onExportProgress((event) => {
    // Update state…
  });
  return unsub;
}, []);
```

### Pattern 4: Hand-rolled ARIA modal (clone OverrideDialog)

**What:** Copy the Phase 4 OverrideDialog structure verbatim. Same `role="dialog"` + `aria-modal="true"` + `aria-labelledby` + overlay-click-cancel + ESC-cancel + focus-trap via auto-focus.

**When to use:** OptimizeDialog two-state UI.

**Example (abbreviated — full pattern at `src/renderer/src/modals/OverrideDialog.tsx`):**
```tsx
<div
  role="dialog"
  aria-modal="true"
  aria-labelledby="optimize-title"
  className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
  onClick={onCancel}
>
  <div
    className="bg-panel border border-border rounded-md p-6 min-w-[640px] font-mono"
    onClick={(e) => e.stopPropagation()}
    onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
  >
    <h2 id="optimize-title">…</h2>
    {/* Two-state content */}
  </div>
</div>
```
Source: `src/renderer/src/modals/OverrideDialog.tsx` lines 85-155. `[VERIFIED: codebase read]`

### Anti-Patterns to Avoid

- **Importing `sharp` from `src/core/export.ts`.** Trips arch.spec.ts Layer 3 grep and CLAUDE.md rule #5. Sharp stays in `src/main/image-worker.ts` exclusively.
- **Exposing raw `ipcRenderer` via contextBridge.** Security V4. Only expose the four new named methods (pickOutputDirectory, startExport, cancelExport, onExportProgress, openOutputFolder).
- **Sending functions/Promises/class instances via `webContents.send`.** Structured-clone rejects them at the IPC boundary. Every field of `ExportProgressEvent` must be a primitive / array / plain object — mirrors Phase 1 D-21 discipline.
- **Running multiple sharp calls in parallel.** D-114 locks concurrency = 1. libvips already uses multiple cores per resize; adding JS-level parallelism blows up main-process memory at 300+ file exports.
- **Aborting in-flight sharp calls.** libvips is not interruptible mid-resize. Cooperative-between-files is the contract (D-115).
- **`fs.copyFile` or `fs.writeFile` for final write.** D-121 requires atomic `<outPath>.tmp` → `fs.rename`.
- **Writing output files to arbitrary paths outside outDir.** Path-traversal defense: `path.resolve(outDir, relOut).startsWith(path.resolve(outDir) + path.sep)` OR equivalent via `path.relative`.
- **Accepting outDir == source/images or child.** D-122 + F8.4 defense.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PNG Lanczos3 resize | Custom bicubic/bilinear resampler | `sharp(src).resize(W, H, { kernel: 'lanczos3', fit: 'fill' })` | Lanczos3 is mathematically precise; hand-rolled versions miss edge-pixel contributions and produce visible ringing. libvips ships the canonical implementation. |
| PNG encode with compression | Custom zlib pipeline | `sharp(...).png({ compressionLevel: 9 })` | libpng + zlib integration handles chunk ordering, IDAT filtering, alpha channel preservation, and color profile correctly. |
| Atomic file write | `fs.writeFile` + OS-level transaction | `.toFile(tmp) → fs.rename(tmp, dst)` | POSIX + NTFS both guarantee `rename` atomicity within a single filesystem. Same-directory tmp file guarantees same filesystem. |
| Folder picker | Render own picker UI | `dialog.showOpenDialog({ properties: ['openDirectory', ...] })` | OS-native picker — handles network drives, hidden folders, create-new-folder, localization, accessibility. |
| Modal focus trap | React library (react-focus-lock, radix-dialog) | Hand-rolled per Phase 4 D-81 | Project's established discipline; OverrideDialog pattern well under 160 lines. |
| Progress throttling | Debounce / RAF / batch queue | Send one event per file; at ≤10/sec sequential cadence, no throttling needed | D-119 explicit: no batching. libvips per-file cadence is the natural throttle. |
| Path-traversal defense | Regex on raw strings | `path.resolve` + `path.relative` + prefix check | Node's path module handles UNC paths (`\\?\C:\…`), symlinks via resolve, and is cross-platform. |

**Key insight:** Phase 6 is mechanical plumbing — every load-bearing algorithm (Lanczos3 sampling, PNG zlib encoding, atomic rename, OS folder picker, ARIA focus management) already has a hardened implementation in the standard stack. The novel code surface is: plan fold, sequential loop + cancel flag + progress emit, modal state machine. Under 400 lines of new code total.

## Common Pitfalls

### Pitfall 1: asarUnpack missing `@img/*` glob
**What goes wrong:** Sharp 0.33+ split its native bindings into `@img/sharp-{platform}-{arch}` scoped packages. Only unpacking `**/node_modules/sharp/**` leaves the `.node` binaries inside asar → `dlopen` fails at runtime.
**Why it happens:** Older tutorials + older sharp versions only had `node_modules/sharp/build/Release/*.node`. That path doesn't exist in 0.33+.
**How to avoid:** Use BOTH globs. Context7 sharp install docs are explicit: `asarUnpack: ['**/node_modules/sharp/**/*', '**/node_modules/@img/**/*']`.
**Warning signs:** `npm run build` succeeds, `.dmg` opens, but first click of "Optimize Assets" throws `Cannot find module '@img/sharp-darwin-arm64/sharp.node'`. Catch in Plan 06-05 human-verify by actually running a packaged-build export.

### Pitfall 2: Source PNG path not in DisplayRow
**What goes wrong:** `src/core/export.ts` can't dedup by sourcePath because DisplayRow doesn't carry it. Falls back to attachmentName dedup, which is wrong when the `.atlas` file uses path-prefixed region names (Jokerman's `AVATAR/FACE` vs `AVATAR/CARDS_L_HAND_1`).
**Why it happens:** Phase 1 D-21 locked SkeletonSummary shape before Phase 6 existed. Source paths weren't a Phase 1 concern.
**How to avoid:** Wave 0 plan extends LoadResult (`sourcePaths: Map<regionName, absPath>`), summary.ts (threads into DisplayRow), and types.ts (`DisplayRow.sourcePath: string`). Single-call-site edit per Phase 5 D-101 pattern.
**Warning signs:** export.spec.ts test (c) "override 200% on SQUARE" fails because without sourcePath the dedup misses. Catch in Wave 0 RED spec.

### Pitfall 3: `createDirectory` is macOS-only
**What goes wrong:** On Windows, passing `createDirectory` to `dialog.showOpenDialog` properties array is silently ignored — the user can't create a new folder for the export output, friction at first-use UX.
**Why it happens:** Electron docs document `createDirectory` as macOS-only and `promptToCreate` as Windows-only. Easy to miss.
**How to avoid:** Include BOTH: `properties: ['openDirectory', 'createDirectory', 'promptToCreate']`. Electron documents that unrecognized properties per-platform are ignored. D-122 should be satisfied on both platforms.
**Warning signs:** Windows user reports "can't create new folder in picker". Document in QA checklist for Plan 06-05 (note: Phase 6 is macOS-only per electron-builder.yml + D-24 additive Windows enablement, so this may be Phase 9 concern — but the code should be cross-platform-ready).

### Pitfall 4: `sharp.toFile()` promise resolution before fsync
**What goes wrong:** `sharp(...).toFile(tmp)` may resolve BEFORE the OS has fsynced the file. If power fails between toFile-resolve and rename-commit, the tmp file may be zero-length. Our rename-after-toFile protocol then moves a zero-length file into place → silently corrupts output.
**Why it happens:** Sharp documentation doesn't specify fsync semantics. libvips' default is to write+close but not explicitly fsync.
**How to avoid:** Acceptable for Phase 6 — the failure mode is "power loss mid-export", which users already know requires re-running. Re-export overwrites anyway. A formal fix would call `fs.open(tmp) → fd.sync() → fd.close() → rename`, but that's over-engineering for an MVP.
**Warning signs:** User complains about corrupt output after forced machine sleep mid-export. Document in deferred-items.md as "Phase 9 hardening if reported".

### Pitfall 5: Electron structured-clone throws on Map/Set in ExportProgressEvent
**What goes wrong:** Sending `new Set(['a', 'b'])` via `webContents.send` throws at the IPC boundary. Easy to accidentally include if planner adds a Set-valued field to ExportError metadata.
**Why it happens:** Electron's one-way channels serialize via structured-clone (same as `postMessage`). Not as flexible as JSON — throws on functions, Promises, Symbols, WeakMaps, WeakSets. Mysteriously, it DOES serialize Map and Set (spec-level), but Phase 1 D-21 locks us to plain-primitives-only for defensive simplicity.
**How to avoid:** Every field of ExportProgressEvent, ExportError, ExportSummary, ExportRow is `string | number | boolean | Array<T> | plain object`. Enforced by `structuredClone(event)` round-trip test mirroring summary.spec.ts D-22 pattern.
**Warning signs:** Tests throw `DataCloneError` or `SyntaxError: serialization failed`. Catch early with structured-clone round-trip gate.

### Pitfall 6: `fs.rename` across filesystems falls back to copy+unlink
**What goes wrong:** On Unix-like OSes (macOS, Linux), `fs.rename(a, b)` where `a` and `b` are on different filesystems (e.g., outDir on an external NTFS drive and tmp in `/tmp`) falls back to copy+unlink. That's NOT atomic.
**Why it happens:** rename(2) is same-filesystem only.
**How to avoid:** We write `<outPath>.tmp` NEXT TO `<outPath>` (same directory, same filesystem). rename is atomic. Document this in image-worker.ts — the tmp suffix must be derived from outPath, not from os.tmpdir().
**Warning signs:** Corrupt output on user's external drive. Code review catches the pattern.

### Pitfall 7: Sharp error classification (missing vs corrupt)
**What goes wrong:** D-112 pre-flights `fs.access(R_OK)` but sharp can still fail on bytes (PNG format corrupt, zlib CRC mismatch, truncated file). D-116 says skip-and-continue, but the error kind needs differentiation ('missing-source' vs 'sharp-error').
**Why it happens:** Sharp throws a generic `Error` with `.message` for every libvips error — no error code, no subclass.
**How to avoid:** In runExport: `missing-source` only when `fs.access` throws pre-flight. Once past pre-flight, any sharp/fs throw becomes `sharp-error` (if the throw site is inside the sharp chain) or `write-error` (if from fs.rename). Classification is by WHERE the try/catch fires, not by inspecting the error instance.
**Warning signs:** Single corrupt PNG raises "missing-source" event — user thinks file is gone when it's actually on disk but corrupt. Classification correct via code structure, not error inspection.

### Pitfall 8: Tailwind v4 `@theme inline` literal-class discipline
**What goes wrong:** OptimizeDialog uses template literals for class names (e.g., `` `bg-${status === 'error' ? 'danger' : 'panel'}` ``). Tailwind v4 class scanner doesn't evaluate template expressions → emitted CSS is missing the utility → broken styles in prod.
**Why it happens:** Tailwind v4 uses AST-level string literal scanning. Phase 4 OverrideDialog explicitly documents this in its header comment.
**How to avoid:** Every className is a string literal or `clsx('literal', cond && 'other-literal')`. Status icons use conditional mount instead of class switching where ambiguous.
**Warning signs:** Error rows render without red — obvious in dev, easy to miss in automated tests. Phase 4 had the same rule; reuse the discipline.

### Pitfall 9: contextBridge preserves function identity through unsubscribe closures
**What goes wrong:** If `onExportProgress` returns an unsubscribe function that closes over a fresh `handler => (evt, event) => handler(event)` wrapper each call, calling the unsubscribe must remove the SAME wrapper reference registered with `.on`.
**Why it happens:** Subtle — if the wrapper is created outside `.on(...)` it works; if created inline, it's already wrong. But `contextBridge.exposeInMainWorld` ALSO deep-clones object-valued returns (not function returns), so returning a function works.
**How to avoid:** Assign the wrapper to a local const BEFORE calling `.on`, then reference the same const in the returned unsubscribe. Pattern: `const wrapped = (e, ...) => ...; ipcRenderer.on('ch', wrapped); return () => ipcRenderer.removeListener('ch', wrapped);`. Test: subscribe → fire 1 event → unsubscribe → fire second event → handler NOT called.
**Warning signs:** Memory leak in long-running sessions (listeners accumulate). OptimizeDialog unmount test should catch.

### Pitfall 10: electron-builder `files` whitelist vs `asarUnpack` interaction
**What goes wrong:** The existing `electron-builder.yml` has a `files:` whitelist that explicitly includes `out/**` + `package.json` and excludes the rest. The planner needs to verify that `asarUnpack` globs apply AFTER the `files` filter. If node_modules aren't implicitly included, asarUnpack can't find them.
**Why it happens:** electron-builder documents that `files` controls what's copied into the .app; `asarUnpack` controls what's extracted from asar after the copy. Node modules marked as `dependencies` (not devDependencies) are AUTO-included by default.
**How to avoid:** Move `sharp` to `dependencies` (NOT devDependencies). Electron-builder auto-copies dependencies into the packaged app, then the asarUnpack glob pulls them out of asar. Verify with `npm run build:dry` + inspect `release/.../app.asar.unpacked/node_modules/` for sharp + @img/*.
**Warning signs:** First packaged-export click throws `Error: Cannot find module 'sharp'`. Catch in Plan 06-05 human-verify on the actual .dmg.

### Pitfall 11: Empty export plan at render time (empty rig)
**What goes wrong:** If `summary.peaks.length === 0` AND `summary.unusedAttachments.length === 0`, `buildExportPlan` returns `{ rows: [], excludedUnused: [], totals: { count: 0 } }`. OptimizeDialog with zero rows needs a defined empty state or the button stays disabled.
**Why it happens:** Degenerate fixture or user drop of an unrigged skeleton.
**How to avoid:** Disable the toolbar button when `summary.peaks.length === 0` OR show an empty-state "No images to export" in dialog. CONTEXT.md gives planner discretion; disable is simpler and more predictable.
**Warning signs:** N/A — no user-facing bug; just UX polish.

### Pitfall 12: Concurrent export runs (re-entrancy)
**What goes wrong:** User clicks toolbar button while export is running — or IPC gets replayed — and two `runExport` loops race, writing to the same tmp files, corrupting output.
**Why it happens:** OptimizeDialog is already modal, but a defensive guard at the IPC handler prevents any theoretical race.
**How to avoid:** Main-process module-level `let exportInFlight = false` flag. `'export:start'` handler checks the flag; if true, returns `{ ok: false, error: { kind: 'already-running', message: '...' } }` and does NOT mount a second loop. D-117 disables toolbar button during run as frontline defense; IPC guard is second line.
**Warning signs:** Rapid clicks produce duplicate progress events or corrupted output. Unit-test the IPC handler with a mock runExport to verify.

## Runtime State Inventory

Not applicable — Phase 6 is a greenfield feature addition (no rename / refactor / migration). No existing stored data, no live service config, no OS-registered state, no secrets/env vars, no pre-existing build artifacts that need migration.

## Code Examples

Verified patterns from official sources.

### F8.2 — Sharp resize + PNG encode + atomic write

```typescript
// src/main/image-worker.ts — per-file body
import sharp from 'sharp';
import { access, rename, mkdir } from 'node:fs/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function exportOneRow(
  row: ExportRow,
  outDir: string,
): Promise<{ ok: true } | { ok: false; error: ExportError }> {
  // 1. Pre-flight — D-112
  try {
    await access(row.sourcePath, fs.constants.R_OK);
  } catch {
    return { ok: false, error: { kind: 'missing-source', path: row.sourcePath, message: 'Source PNG not readable' } };
  }

  // 2. Path-traversal defense — Claude's Discretion §Threat-model
  const resolvedOut = path.resolve(row.outPath);
  const resolvedDir = path.resolve(outDir);
  const rel = path.relative(resolvedDir, resolvedOut);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: { kind: 'write-error', path: row.outPath, message: 'Output path escapes outDir' } };
  }

  // 3. Ensure parent dir exists
  await mkdir(path.dirname(resolvedOut), { recursive: true });

  // 4. Sharp resize + PNG encode → tmp file
  const tmpPath = resolvedOut + '.tmp';
  try {
    await sharp(row.sourcePath)
      .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toFile(tmpPath);
  } catch (err) {
    return { ok: false, error: { kind: 'sharp-error', path: row.sourcePath, message: err instanceof Error ? err.message : String(err) } };
  }

  // 5. Atomic rename — D-121
  try {
    await rename(tmpPath, resolvedOut);
  } catch (err) {
    return { ok: false, error: { kind: 'write-error', path: resolvedOut, message: err instanceof Error ? err.message : String(err) } };
  }

  return { ok: true };
}
```
Source: Context7 `/lovell/sharp` resize + PNG output docs + Node `fs/promises` docs. `[VERIFIED 2026-04-24]`

### F8.1 — Folder picker with cross-platform properties

```typescript
// src/main/ipc.ts — new handler
import { dialog, BrowserWindow } from 'electron';

ipcMain.handle('dialog:pick-output-dir', async (_evt, defaultPath: string) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win === null) return null;
  const result = await dialog.showOpenDialog(win, {
    title: 'Choose output folder for optimized images',
    defaultPath,
    buttonLabel: 'Export Here',
    properties: [
      'openDirectory',
      'createDirectory',   // macOS — allow creating new folder in picker
      'promptToCreate',    // Windows — prompt if entered path doesn't exist
      'dontAddToRecent',   // Windows — don't add to recent docs
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});
```
Source: Context7 `/electron/electron` dialog.md. `[VERIFIED 2026-04-24]`

### F8.5 — One-way progress channel + contextBridge unsubscribe

```typescript
// src/preload/index.ts — extend api
import { contextBridge, ipcRenderer } from 'electron';
import type { Api, ExportPlan, ExportSummary, ExportProgressEvent } from '../shared/types.js';

const api: Api = {
  // … existing methods …
  pickOutputDirectory: (defaultPath: string) =>
    ipcRenderer.invoke('dialog:pick-output-dir', defaultPath),
  startExport: (plan: ExportPlan, outDir: string): Promise<ExportSummary> =>
    ipcRenderer.invoke('export:start', plan, outDir),
  cancelExport: (): void => ipcRenderer.send('export:cancel'),
  onExportProgress: (handler: (e: ExportProgressEvent) => void): (() => void) => {
    const wrapped = (_evt: Electron.IpcRendererEvent, event: ExportProgressEvent) => handler(event);
    ipcRenderer.on('export:progress', wrapped);
    return () => ipcRenderer.removeListener('export:progress', wrapped);
  },
  openOutputFolder: (dir: string): void => ipcRenderer.send('shell:open-folder', dir),
};
```
Source: Context7 `/electron/electron` context-bridge.md + ipc.md. `[VERIFIED 2026-04-24]`

### Main-side re-entrancy guard + cancel flag

```typescript
// src/main/ipc.ts — module state + handlers
let exportInFlight = false;
let cancelRequested = false;

ipcMain.handle('export:start', async (evt, plan: ExportPlan, outDir: string) => {
  if (exportInFlight) {
    return { ok: false, error: { kind: 'already-running', message: 'Another export is in progress' } };
  }
  if (isChildOrEqualTo(outDir, plan.sourceImagesDir)) {
    return { ok: false, error: { kind: 'invalid-outdir', message: 'Output directory must not be the source images folder or a child of it' } };
  }
  exportInFlight = true;
  cancelRequested = false;
  try {
    const summary = await runExport(
      plan,
      outDir,
      (event) => evt.sender.send('export:progress', event),
      () => cancelRequested,
    );
    return { ok: true, summary };
  } finally {
    exportInFlight = false;
    cancelRequested = false;
  }
});

ipcMain.on('export:cancel', () => {
  cancelRequested = true;
});
```
Source: Pattern extrapolated from existing `src/main/ipc.ts` handleSkeletonLoad + Context7 Electron ipcMain docs. `[VERIFIED 2026-04-24]`

### electron-builder.yml asarUnpack update

```yaml
# electron-builder.yml — extended from existing (current value: resources/**)
asarUnpack:
  - resources/**
  - '**/node_modules/sharp/**/*'
  - '**/node_modules/@img/**/*'
```
Source: Context7 `/lovell/sharp` install.md — explicit verbatim recommendation. `[VERIFIED 2026-04-24]`

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sharp` 0.32 — native binary in `node_modules/sharp/build/Release/sharp.node` | `sharp` 0.33+ — binaries in `@img/sharp-{platform}-{arch}/sharp.node` scoped packages | sharp 0.33.0 (Sept 2023) | asarUnpack globs MUST include `@img/**` (new) + `sharp/**` (still applies). |
| Electron 32-: `file.path` property on DragEvent's File objects | Electron 32+: `webUtils.getPathForFile(file)` | Electron 32 (May 2024) | Already applied in Phase 1 D-09 correction; mentioned for continuity — Phase 6 uses folder picker, not file drop, so unaffected. |
| Node 18 ESM: CJS-only Electron preload required | Node 20+: ESM preloads work with `sandbox: false`; CJS still required with `sandbox: true` | Electron 28+ | Already applied in Phase 1 (preload emits .cjs). |
| Synchronous `fs.renameSync` for atomic write | Async `fs.promises.rename` | N/A | Async preferred for main-process responsiveness during long exports. |

**Deprecated/outdated:**
- sharp's `nearest_neighbour` (British spelling) — replaced by `nearest`. Not applicable; we use `lanczos3`.
- Electron's `dialog.showOpenDialog` synchronous overload — deprecated; async promise form is current.
- electron-builder `"extraFiles"` vs `"asarUnpack"` — `asarUnpack` is correct for node_modules; `extraFiles` is for static resources.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.5 (already installed; `npm run test`) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm run test -- tests/core/export.spec.ts` or `npm run test -- tests/main/` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F8.1 | Folder picker opens + returns chosen path | integration (mocked dialog) | `npm run test -- tests/main/ipc-export.spec.ts` | ❌ Wave 0 |
| F8.1 | Picker cancel returns null | integration (mocked dialog) | `npm run test -- tests/main/ipc-export.spec.ts` | ❌ Wave 0 |
| F8.2 | Output dims = `round(sourceW × effScale) × round(sourceH × effScale)`, uniform | unit | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| F8.2 | Sharp called with `{ kernel: 'lanczos3', fit: 'fill' }` + `.png({ compressionLevel: 9 })` | integration (mocked sharp) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| F8.3 | ExportRow.outPath mirrors `<outDir>/images/<regionName>.png` preserving subfolders | unit | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| F8.4 | `outDir === source/images` is rejected | integration | `npm run test -- tests/main/ipc-export.spec.ts` | ❌ Wave 0 |
| F8.4 | `outDir` child of source/images rejected | integration | `npm run test -- tests/main/ipc-export.spec.ts` | ❌ Wave 0 |
| F8.4 | Source files untouched (no writes to srcPath during export) | integration (mocked fs) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| F8.5 | `export:progress` event emitted per file with status/path/index/total | integration (mocked sharp) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| F8.5 | Error events surface `kind: missing-source \| sharp-error \| write-error` | integration (mocked sharp) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| N3.1 | PNG output has alpha channel preserved when input has alpha | **manual** — spot-check during Plan 06-05 human-verify | `manual` | N/A |
| N3.2 | Visual indistinguishability from Photoshop Lanczos | **manual** — side-by-side diff in image viewer | `manual` | N/A |
| N4.2 | Packaged `.dmg` sharp loads at runtime | **manual** — open release .dmg + trigger export | `manual` | N/A |
| D-108 | Per-sourcePath dedup = max(effectiveScale) | unit | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| D-109 | `summary.unusedAttachments` excluded from plan; `excludedUnused` populated | unit | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| D-110 | `Math.round(127.5) === 128` fixture case | unit | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| D-111 | Override percent resolves through `applyOverride` | unit | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| D-112 | `fs.access` pre-flight → missing file surfaces as `'missing-source'` + skips sharp call | integration (mocked fs) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| D-113 + D-114 | Sequential = 1 call in flight (no parallel sharp invocation) | integration (spy on sharp) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| D-115 | Cancel flag → stop new dispatch, in-flight finishes, summary carries `cancelled: true` | integration (mocked sharp) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| D-116 | Per-file error → continue; all non-erroring rows succeed | integration (mocked sharp) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| D-119 | Re-entrant `export:start` returns `'already-running'` typed error | integration | `npm run test -- tests/main/ipc-export.spec.ts` | ❌ Wave 0 |
| D-121 | Atomic write: `<outPath>.tmp` exists during write; `fs.rename` swaps | integration (mocked fs) | `npm run test -- tests/main/image-worker.spec.ts` | ❌ Wave 0 |
| D-122 | Picker defaultPath = `<skeleton_dir>/images-optimized/` | integration (mocked dialog) | `npm run test -- tests/main/ipc-export.spec.ts` | ❌ Wave 0 |
| Layer 3 arch | `src/core/export.ts` has no `sharp`, `node:fs`, `fs/promises`, `electron` imports | unit (grep) | `npm run test -- tests/core/export.spec.ts` + `tests/arch.spec.ts` | ❌ Wave 0 — extend existing grep set |
| CLAUDE.md #5 | `src/core/export.ts` has no DOM/document/window references | unit (grep) | `npm run test -- tests/core/export.spec.ts` | ❌ Wave 0 |
| CLI byte-for-byte | `git diff scripts/cli.ts` empty | gate | `git diff --exit-code scripts/cli.ts` | pre-existing |
| Sampler lock (D-100) | `git diff src/core/sampler.ts` empty | gate | `git diff --exit-code src/core/sampler.ts` | pre-existing |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/core/export.spec.ts tests/main/` (< 5s)
- **Per wave merge:** `npm run test` (full suite, ~10s currently)
- **Phase gate:** Full suite green + manual spot-check of Photoshop-vs-sharp output + packaged `.dmg` export sanity

### Wave 0 Gaps
- [ ] `tests/core/export.spec.ts` — covers D-108..D-111, D-110 Math.round half-case, F8.2/F8.3, Layer 3 grep hygiene
- [ ] `tests/main/image-worker.spec.ts` — NEW DIRECTORY (tests/main/ doesn't exist yet); covers D-112..D-116, D-121, F8.4/F8.5
- [ ] `tests/main/ipc-export.spec.ts` — covers F8.1, D-119 re-entrancy, D-122 defaultPath
- [ ] Extend `tests/arch.spec.ts` — add `export.ts` to forbidden-import grep set (sharp, node:fs, fs/promises, electron)
- [ ] `tests/core/summary.spec.ts` — extend to assert `peaks[i].sourcePath` is a string ending in `.png` (locks Wave 0 data-plumbing)
- [ ] Fixture gap: `fixtures/SIMPLE_PROJECT/` has no sibling `images/` folder. For integration tests of image-worker we need `images/CIRCLE.png`, `images/SQUARE.png`, `images/TRIANGLE.png` — either copy from the existing packed `SIMPLE_TEST.png` via a fixture-build script OR use `temp/Jokerman/` as realistic fixture (but temp/ is gitignored). **Planner call:** add a Phase 6 fixture under `fixtures/EXPORT_PROJECT/` with source PNGs + atlas + skeleton.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | (single-user desktop app; no auth surface) |
| V3 Session Management | no | (no sessions) |
| V4 Access Control | yes | contextBridge surface remains minimal (five new methods); no raw ipcRenderer exposed |
| V5 Input Validation | yes | ExportPlan.outDir validated (not equal to source images folder); ExportRow.outPath validated (resolves under outDir); D-122 path-traversal defense via `path.relative` |
| V6 Cryptography | no | (no crypto in this phase; sharp internal zlib is not user-visible) |
| V10 File Operations | yes | Atomic write via tmp+rename; never overwrites source files (F8.4); output dir validated before any write |
| V12 Secure Files | yes | Sharp given user-chosen PNG inputs — libvips has a strong track record with PNG parsing; verify no known CVE against pinned 0.34.5 via `npm audit` before commit |

### Known Threat Patterns for Electron + sharp

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Malicious `attachment.path` in skeleton JSON causing path-traversal write (`../../../etc/passwd.png`) | Tampering | `path.resolve(outDir, relOut).startsWith(path.resolve(outDir) + sep)` guard BEFORE sharp write; emit `'write-error'` and skip on fail. Claude's Discretion §Threat-model-lite. |
| Corrupt/malicious PNG input triggering libvips buffer overflow (CVE-class) | Tampering | Pin `sharp ≥ 0.34.5` which ships libvips 8.x with current CVE patches. `npm audit` pre-commit gate in Plan 06-05. |
| User picks source/images as outDir → overwrites source PNGs | Tampering | D-122: main-process validates `!isChildOrEqualTo(outDir, sourceImagesDir)` before `runExport` dispatches; reject with typed error. |
| Re-entrant export corruption (two loops writing same tmp) | Tampering | Module-level `exportInFlight` flag + IPC handler guard; toolbar button disabled during run (D-117) as frontline. |
| Non-finite dim values (NaN from corrupted override) reaching sharp | Availability | `clampOverride` already guards `Number.isFinite`; `Math.round(NaN) === NaN` — but `buildExportPlan` receives pre-clamped integers from overrides map per Phase 4 contract. Defensive `if (!Number.isFinite(outW)) continue` in image-worker is cheap. |
| Cancel during tmp write leaves orphan `.tmp` files | Availability | Acceptable — next export run overwrites same tmp paths (deterministic names). Cleanup is zero-blast-radius. Document in deferred-items.md if user reports tmp clutter. |
| IPC event flood DoS main process (9 events/sec × 300 files = 2700 events in 30s) | DoS | Bounded by sequential sharp cadence (~100-500ms/file); structured-clone cost per event is microseconds; accept. |

No network I/O in Phase 6. No telemetry. Output is local-disk only.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 | All Phase 6 code | ✓ | 24.13.0 | — |
| npm | Install sharp | ✓ | (bundled) | — |
| macOS arm64 (dev) | Current dev machine + .dmg target | ✓ | darwin 25.3.0 arm64 | — |
| electron 41 | IPC + dialog + shell | ✓ | 41.3.0 (package.json) | — |
| electron-builder 26 | `asarUnpack` config | ✓ | 26.8.1 (package.json) | — |
| sharp prebuild for darwin-arm64 | Dev runtime + packaged .app | ✓ | 0.34.5 ships via @img/sharp-darwin-arm64 | — |
| Photoshop (for N3.2 visual spot-check) | Plan 06-05 human-verify | assume ✓ | any Lanczos-capable editor works | Use GIMP / Affinity Photo / Preview as substitute; visual-spot-check is "no perceptible difference" qualitative, not byte-equal. |

**No missing dependencies.**

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Sharp's `.toFile(path).then()` resolves after write(2) completes, but fsync is NOT guaranteed | Pitfall 4 | Low — documented as acceptable Phase 6 behavior; user re-runs export on power loss. **[ASSUMED]** |
| A2 | Electron `contextBridge.exposeInMainWorld` preserves function identity for returned unsubscribe closures (not deep-cloned) | Pattern 3 | Medium — if wrong, unsubscribe closure can't remove the wrapped listener. Mitigated by unit-test spec on subscribe→unsubscribe→fire-second-event flow. **[CITED: Context7 /electron/electron context-bridge.md]** |
| A3 | libvips' Lanczos3 produces visually indistinguishable output from Photoshop's Lanczos at matched dimensions | N3.2 | Low — both are Lanczos3 mathematically; sub-pixel floating-point differences not perceptible. Verified by qualitative user spot-check at human-verify. **[CITED: sharp README mentions Lanczos resampling as default]** |
| A4 | `fs.rename` within the same directory (same filesystem) is atomic on macOS + Linux + Windows | Pitfall 6 | Low — POSIX rename(2) + NTFS MoveFileEx both guarantee same-FS atomicity. **[CITED: Node fs docs + POSIX spec]** |
| A5 | Real Spine rigs always lay source PNGs in `<skeletonDir>/images/<regionName>.png` | Pattern 2 | Medium — holds for Jokerman fixture but may not hold for all Spine project conventions. Pre-flight `fs.access` surfaces violations as user-friendly error. Planner MAY need a fallback: let user point at a different `images/` folder. Phase 6 discretion: sticking with the Spine convention. **[VERIFIED: Jokerman fixture + Spine atlas format docs]** |
| A6 | Electron's structured-clone IPC serialization accepts all primitives + arrays + plain objects; chokes on functions/Promises/class instances | Pitfall 5 | Low — Phase 1 D-21 already applies this discipline; Phase 6 ExportRow etc. are built to the same contract. **[CITED: Context7 /electron/electron webContents.send]** |
| A7 | `sharp ≥ 0.33` ships prebuilt binaries via `@img/sharp-{platform}-{arch}` for all four target triples (darwin-arm64/x64, win32-x64, linux-x64) | Standard Stack | Low — verified via npm registry + Context7. **[VERIFIED: npm view + sharp docs]** |
| A8 | Electron 41 (Node 22 / N-API v10) is backward-compatible with sharp's Node-API v9 prebuilds | Standard Stack | Low — N-API is explicitly designed for ABI forward compatibility. **[CITED: Node-API documentation]** |

**Assumption A5 is the highest planning risk.** If Jokerman's convention doesn't hold universally (e.g., if some rigs store source PNGs one directory up or in a different folder name), the export fails on real user rigs even though all automated tests pass. Consider Phase 6 post-MVP discovery pass: load 2-3 additional real-world rigs and verify the `<skeletonDir>/images/<regionName>.png` assumption holds.

## Open Questions (RESOLVED)

> All six questions below were resolved during planning (see `06-CONTEXT.md` integration points + `06-PATTERNS.md` analog confirmations + plan-phase orchestrator decisions). Recommendations below are LOCKED — no question remains open. Each has a **RESOLVED:** marker noting the chosen path.

1. **Where should `buildExportPlan` run — renderer or main?**
   - What we know: CONTEXT.md Code Insights §Integration Points leaves this as planner's call. `summary` + `overrides` both live in the renderer; pure-TS `export.ts` is importable from renderer via Layer 3 inline-copy (Phase 4 D-75 precedent: `src/renderer/src/lib/overrides-view.ts`).
   - What's unclear: If plan is built in renderer, we need `src/renderer/src/lib/export-view.ts` (byte-identical copy of `src/core/export.ts`). If plan is built in main, the IPC flow is: renderer sends `summary` snapshot + overrides map serialization → main imports core/export → returns plan. Main path avoids duplicate copy but requires Map→Array serialization of overrides.
   - Recommendation: **Build in renderer** — consistent with Phase 4 precedent; `overrides` Map is already renderer-side; round-trip through IPC for the plan build is wasted serialization work. Add `src/renderer/src/lib/export-view.ts` as a byte-identical copy with parity spec (mirrors `tests/core/overrides.spec.ts` parity block). Plan 06-03 wires the IPC contract: `api.startExport(plan, outDir)` where plan is already built.
   - **RESOLVED:** Build in renderer. Implemented by Plan 06-03 (`src/core/export.ts` + byte-identical `src/renderer/src/lib/export-view.ts` + parity test).

2. **Should `ExportProgressEvent.outPath` be absolute or relative?**
   - What we know: D-119 specifies `{ index, total, path, outPath, status, error? }`. `path` is source; `outPath` is destination.
   - What's unclear: Relative `<outDir>/images/CIRCLE.png` is shorter for UI display; absolute is unambiguous.
   - Recommendation: **Absolute.** Avoids path-join on renderer side for `shell.showItemInFolder` + simplifies per-row "open containing folder" if added later.
   - **RESOLVED:** Absolute. `outPath` is the absolute path produced by `path.resolve(outDir, 'images', regionName + '.png')` in the renderer (or main, depending on plan), then preserved through IPC events.

3. **Should ExportRow preserve the full `attachmentNames[]` array (all attachments sharing this source PNG) or collapse to one name?**
   - What we know: D-108 dedup by sourcePath; multiple attachments may share a region (e.g., skin variants).
   - What's unclear: Does the progress UI need to show "Resizing images/FACE.png (used by HEAD_A, HEAD_B)"?
   - Recommendation: **Keep `attachmentNames: string[]`** — shown in pre-flight list as a tooltip or muted secondary line; truncated to first 3 + "N more" if long. Minimal planner-discretion UI; zero IPC cost.
   - **RESOLVED:** Keep `attachmentNames: string[]` on every ExportRow. Pre-flight UI display is planner discretion (Plan 06-06).

4. **Fixture strategy for `tests/main/image-worker.spec.ts`**.
   - What we know: SIMPLE_TEST has no sibling `images/` folder. temp/Jokerman has real source PNGs but is gitignored.
   - What's unclear: Create `fixtures/EXPORT_PROJECT/` with small source PNGs? Reuse SIMPLE_TEST's atlas-packed PNG as stand-in (sharp doesn't care that it's packed — it's a valid PNG)?
   - Recommendation: **Add `fixtures/EXPORT_PROJECT/`** with 2-3 tiny source PNGs (e.g., 16×16 solid colors), a matching atlas, and a matching skeleton JSON. Small enough to commit (~2 KB total). Avoids mocking sharp entirely for one "real integration" test; rest of image-worker.spec mocks sharp + fs via vitest.
   - **RESOLVED:** Add `fixtures/EXPORT_PROJECT/`. Implemented by Plan 06-01 Wave 0 (atlas + skeleton JSON + tiny PNGs for CIRCLE/SQUARE/SQUARE2/TRIANGLE).

5. **Should the pre-flight view show the "source PNG size on disk" (fs.stat bytes) as part of the preview?**
   - What we know: Claude's Discretion §Pre-flight file size readout — NOT required; Phase 7 covers size-readout deeply.
   - What's unclear: Would show `"images/CIRCLE.png · 699×699 (78 KB) → 256×256"` vs without-bytes `"images/CIRCLE.png · 699×699 → 256×256"`.
   - Recommendation: **Skip for Phase 6.** Keeps plan-build pure (no fs.stat calls). Defer to Phase 7.
   - **RESOLVED:** Skip for Phase 6. No `fs.stat` in plan-build. Phase 7 owns size-readout UI.

6. **Should `'export:cancel'` be request/response (`invoke`) or one-way (`send`)?**
   - What we know: CONTEXT.md §Implementation Decisions D-115: "Renderer calls `api.cancelExport()` → main flips an internal cancelFlag."
   - What's unclear: No return value needed, but invoke() provides a confirmation "cancel received".
   - Recommendation: **One-way `send`.** Keep the contract simple — cancel is fire-and-forget; the next progress event the renderer receives will be the final one (or the `ExportSummary` resolve from `startExport`).
   - **RESOLVED:** One-way `send`. Implemented by Plan 06-05 (`'export:cancel'` IPC handler flips module-scope cancel flag; no return value).

## Project Constraints (from CLAUDE.md)

- **Rule #3 (sampler lifecycle LOCKED):** Phase 6 makes ZERO changes to `src/core/sampler.ts`. Verified by `git diff --exit-code` gate in Plan 06-05.
- **Rule #4 inverse:** Phase 6 IS where PNGs get decoded. Only `src/main/image-worker.ts` may import `sharp` + `node:fs/promises`. `src/core/*` stays pure-TS.
- **Rule #5:** `src/core/export.ts` is pure TypeScript, no DOM, no fs, no sharp. Layer 3 arch.spec.ts grep enforces; planner extends the grep set to forbid `from 'sharp'`, `from 'node:fs'`, `from 'node:fs/promises'`, `from 'electron'` in `src/core/**`.
- **Rule #6 (120 Hz sampling):** unchanged; Phase 6 does not touch sampler rate.
- **Commands contract:** `npm run cli` stays byte-for-byte functional (D-102 inherited from Phase 5). `scripts/cli.ts` is untouched by Phase 6.
- **Test fixture:** SIMPLE_TEST.json remains the primary fixture; Phase 6 adds `fixtures/EXPORT_PROJECT/` for source-PNG integration tests (see Open Question 4).
- **Folder convention:** `temp/` stays gitignored; Phase 6 does not commit any files into `temp/`.
- **GSD workflow:** Phase 6 plans number 06-01 through 06-0N. Each plan is an atomic commit.

## Requirements Traceability

| Requirement | CONTEXT.md Decision | Research-Verified Implementation Path |
|-------------|---------------------|---------------------------------------|
| F8.1 (folder picker) | D-117 + D-118 + D-122 | `dialog.showOpenDialog` main-process handler + `pickOutputDirectory` preload method; `properties: ['openDirectory', 'createDirectory', 'promptToCreate']` for cross-platform |
| F8.2 (sharp Lanczos3 PNG) | D-113 + D-114 + D-121 | `sharp(src).resize(W, H, { kernel: 'lanczos3', fit: 'fill' }).png({ compressionLevel: 9 }).toFile(tmp)` + `fs.rename(tmp, dst)` in `src/main/image-worker.ts` |
| F8.3 (preserve images/ layout) | Claude's Discretion §ExportRow source-path | Thread `sourcePath` through LoadResult → DisplayRow; `outPath = path.join(outDir, 'images', regionName + '.png')` |
| F8.4 (never modify source) | D-121 + D-122 + Claude's Discretion §Threat-model-lite | Atomic write to outDir only; reject outDir ⊆ source/images; path-traversal defense on outPath |
| F8.5 (progress UI per-file errors) | D-119 + D-120 + D-116 | `webContents.send('export:progress', event)` one-way channel + `OptimizeDialog` per-file checklist with `--color-danger` error rows (Phase 5 D-104 token reused) |
| N3.1 (Lanczos3 + PNG L9 + alpha) | D-123 (sharp pin) + F8.2 defaults | Sharp preserves PNG alpha by default; `compressionLevel: 9` explicit; no `.flatten()` or `.removeAlpha()` calls |
| N3.2 (visual equivalence to Photoshop) | D-123 (sharp ≥ 0.33) | libvips Lanczos3 produces visually indistinguishable output; verified by Plan 06-05 human-verify spot-check |
| N4.2 (no native compile for end users) | D-123 (asarUnpack) | Sharp 0.34.5 prebuilds for all target triples + `asarUnpack: ['**/node_modules/sharp/**/*', '**/node_modules/@img/**/*']` |

Every phase requirement maps to a locked decision + a verified implementation path. No requirement is orphaned; no decision is over-scoped.

## Planning Blockers

1. **DisplayRow.sourcePath plumbing.** Current DisplayRow has no sourcePath field. Wave 0 plan MUST add it. Scope: LoadResult (add `sourcePaths: Map<regionName, absPath>`), loader.ts (populate via `path.join(dirname(skeleton), 'images', region.name + '.png')`), summary.ts (thread into each DisplayRow via analyzer), analyzer.ts (accept sourcePaths arg, copy into DisplayRow), types.ts (extend DisplayRow + BreakdownRow). Existing `tests/core/summary.spec.ts` needs an assertion to lock the contract.

2. **Fixture for image-worker integration tests.** `fixtures/EXPORT_PROJECT/` — 2-3 small source PNGs + matching atlas + skeleton JSON. ~2 KB total. Planner-call whether to reuse SIMPLE_TEST.png as a packed stand-in.

3. **Renderer copy of export.ts vs main-process plan build.** Open Question #1 — Recommendation: renderer copy via `lib/export-view.ts` (Phase 4 precedent).

4. **electron-builder.yml `files` whitelist.** Current whitelist excludes `!tests/**` etc. but doesn't explicitly include `node_modules/**` because electron-builder auto-includes production dependencies. Moving `sharp` from (not-yet-added) to `dependencies` (not devDependencies) is required. Verify Plan 06-03 Task adds sharp to `dependencies` in package.json, not `devDependencies`.

5. **CLI lock.** `scripts/cli.ts` stays byte-for-byte (D-102 inherited). Plan 06-05 gate: `git diff --exit-code scripts/cli.ts`. Phase 6 does NOT add any CLI export flag.

6. **Sampler lock.** `src/core/sampler.ts` untouched. Plan 06-05 gate: `git diff --exit-code src/core/sampler.ts`.

## Sources

### Primary (HIGH confidence)
- **Context7 `/lovell/sharp`** — resize, PNG output, install / asarUnpack docs. 2026-04-24.
- **Context7 `/electron/electron`** — dialog.showOpenDialog, contextBridge, webContents.send, shell.showItemInFolder, ipcMain/ipcRenderer. 2026-04-24.
- **Context7 `/electron-userland/electron-builder`** — asarUnpack glob pattern semantics. 2026-04-24.
- **npm registry** — `npm view sharp version` = 0.34.5; `npm view sharp engines` = Node ^18.17 || ^20.3 || >=21. 2026-04-24.
- **Codebase direct reads** — `src/core/analyzer.ts`, `src/core/overrides.ts`, `src/core/usage.ts`, `src/core/loader.ts`, `src/main/ipc.ts`, `src/main/summary.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/src/components/AppShell.tsx`, `src/renderer/src/modals/OverrideDialog.tsx`, `src/shared/types.ts`, `tests/arch.spec.ts`, `tests/core/ipc.spec.ts`, `tests/core/summary.spec.ts`, `tests/core/usage.spec.ts`, `tests/core/analyzer.spec.ts`, `package.json`, `electron-builder.yml`, `electron.vite.config.ts`, `fixtures/SIMPLE_PROJECT/*`, `temp/Jokerman/*` (layout only).
- **Node runtime test** — `node -e "Math.round(127.5)"` = 128 on Node 24.13.0. 2026-04-24.
- **CLAUDE.md** project rules.
- **`.planning/REQUIREMENTS.md`** F8, N3, N4.
- **`.planning/phases/06-optimize-assets-image-export/06-CONTEXT.md`** locked decisions D-108 through D-123.

### Secondary (MEDIUM confidence)
- **https://www.electron.build/configuration.html** — asarUnpack type signature (array of glob strings). Accessed via WebFetch 2026-04-24.

### Tertiary (LOW confidence)
- None — every load-bearing claim is either Context7-verified or directly verified in the codebase/filesystem.

## Metadata

**Confidence breakdown:**
- Standard stack (sharp, electron, electron-builder, vitest): **HIGH** — pinned versions, Context7-verified API surfaces, npm registry cross-check.
- Architecture patterns (fold module, worker, modal, IPC): **HIGH** — mirrors existing Phase 1-5 patterns that are live and tested.
- Sharp API specifics (`kernel: 'lanczos3'`, `fit: 'fill'`, `.png({ compressionLevel: 9 })`): **HIGH** — Context7 docs explicit.
- electron-builder asarUnpack for sharp: **HIGH** — Context7 sharp install docs give verbatim config.
- Electron dialog + IPC + shell APIs: **HIGH** — Context7 docs.
- Path-traversal defense + `fs.rename` atomicity: **HIGH** — standard Node idioms, well-documented.
- Math.round behavior on `.5` boundary: **HIGH** — verified at runtime on the target Node 24.
- Source PNG path resolution from atlas regions: **HIGH** — verified against real Jokerman rig layout.
- Photoshop-vs-libvips visual equivalence: **MEDIUM** — qualitative; human-verify gate required.
- Sharp prebuild availability on all four target triples: **HIGH** — sharp ships via `@img/sharp-*` scoped packages verified per npm registry.

**Research date:** 2026-04-24
**Valid until:** 2026-06-24 (60 days — stable API surface; sharp/electron/electron-builder all have predictable minor-version cadence).

---

## RESEARCH COMPLETE

**Phase:** 6 — Optimize Assets (image export)
**Confidence:** HIGH

### Key Findings

1. **Sharp 0.34.5 is the pin** — Node-API v9 prebuilds for darwin-arm64/x64 + win32-x64 + linux-x64, Electron 41 compatible without `electron-rebuild`. `kernel: 'lanczos3'` + `fit: 'fill'` + `.png({ compressionLevel: 9 })` is the exact API matching F8.2 verbatim.

2. **asarUnpack MUST include `@img/*` scoped packages** (sharp 0.33+ restructured native binaries). Current `electron-builder.yml` has only `asarUnpack: [resources/**]` — Plan 06-03 adds BOTH `**/node_modules/sharp/**/*` AND `**/node_modules/@img/**/*`. Missing the `@img` glob = `.dmg` crashes at first sharp import.

3. **DisplayRow.sourcePath data-plumbing is the only non-trivial extension.** Current atlas parsing emits region-name-keyed dims but not filesystem paths. Wave 0 extends LoadResult + analyzer + summary + types to thread `sourcePath: string` through the IPC payload. Single-call-site edit per Phase 5 D-101 pattern.

4. **Source PNG convention is `<skeletonDir>/images/<regionName>.png`** — verified against Jokerman fixture. Subfolders in region names (e.g., `AVATAR/FACE`) map to subfolder source paths. Pre-flight `fs.access` surfaces violations as `'missing-source'` per D-112.

5. **Every CONTEXT.md decision D-108 through D-123 is implementable as stated.** No decision needs relitigation. One ambiguity (build plan in renderer vs main) flagged in Open Questions; recommendation given.

### File Created
`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/phases/06-optimize-assets-image-export/06-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard stack | HIGH | Context7-verified versions + API surface; npm registry cross-check |
| Architecture | HIGH | Mirrors verified Phase 1-5 patterns live in codebase |
| Pitfalls | HIGH | 12 concrete pitfalls identified; mitigation path verified for each |
| Validation | HIGH | Test map covers every requirement + every locked decision |
| Source-PNG path plumbing | MEDIUM | Convention verified against one real rig (Jokerman); A5 flags broader-fixture verification as human-verify task |

### Open Questions (Planning Blockers)
- (1) Build plan in renderer vs main — **recommendation: renderer** (consistent with Phase 4 Layer 3 inline-copy precedent).
- (2) `ExportProgressEvent.outPath` absolute vs relative — **recommendation: absolute.**
- (3) `ExportRow.attachmentNames[]` retention — **recommendation: keep the array.**
- (4) image-worker integration-test fixture strategy — **recommendation: add `fixtures/EXPORT_PROJECT/`.**
- (5) Pre-flight fs.stat size readout — **recommendation: skip for Phase 6**, defer to Phase 7.
- (6) `'export:cancel'` invoke vs send — **recommendation: one-way send.**

### Ready for Planning
Research complete. Planner can now create `06-01-PLAN.md` (Wave 0 data-plumbing) through `06-05-PLAN.md` (close-out + human-verify) with full confidence on API shapes, stack pins, test map, and decision implementability.
