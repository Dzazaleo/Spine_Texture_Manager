# Phase 22: SEED-002 dims-badge + override-cap - Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 15 (12 modify + 3 new)
**Analogs found:** 15 / 15 (100% — every Phase 22 surface is an extension of an existing file or follows an established sibling pattern)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/shared/types.ts` (MODIFY) | type-only contract | n/a (compile-time erase) | self — extend `DisplayRow` (lines 54-117) + `ExportPlan` (269-273) | exact (this IS the canonical site) |
| `src/core/types.ts` (MODIFY) | type-only contract | n/a | self — extend `LoadResult` (lines 55-154) | exact |
| `src/core/loader.ts` (MODIFY) | loader / file-I/O | request-response (sync, one-shot) | self — extend the `parsedJson` skin walk (line 168) + per-region map population (sourcePaths block lines 405-415); reuse `synthetic-atlas.ts:walkSyntheticRegionPaths` (lines 233-253) as the JSON-walk template; reuse `png-header.ts:readPngDims` for PNG IHDR reads | exact (Phase 21 already established the walk + reader) |
| `src/core/analyzer.ts` (MODIFY) | pure projection | transform | self — extend `analyze()` (line 177) + `analyzeBreakdown()` (line 267) signatures with two new optional Maps mirroring the existing `sourcePaths`/`atlasSources` thread-through pattern | exact |
| `src/main/summary.ts` (MODIFY) | IPC projection | transform | self — extend the `analyze()` invocation at line 74 with two new map args (mirrors how `load.sourcePaths` + `load.atlasSources` are already threaded) | exact |
| `src/core/export.ts` (MODIFY) | pure math | transform | self — extend `buildExportPlan()` (lines 137-232) loop with cap step + passthroughCopies partition | exact |
| `src/renderer/src/lib/export-view.ts` (MODIFY) | renderer-mirror math | transform | self — byte-identical mirror of `src/core/export.ts` (Phase 4 D-75 + Phase 6 D-110 parity contract; lines 1-44 docblock spells the contract out) | exact |
| `src/main/image-worker.ts` (MODIFY) | sharp pipeline / file-I/O | streaming (per-row async) | self — sharp resize block at lines 246-287 (the analog terminal action); `node:fs/promises` import already present at line 57; existing `mkdir` + `rename` atomic pattern at lines 233-244 + 289-304 (passthrough should mirror tmpPath+rename per R4) | exact (same input shape; different terminal: copyFile instead of sharp) |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (MODIFY) | React panel | request-response | self — Source W×H `<td>` at line 424 is the badge insertion site; existing inline-SVG warning pattern at lines 818-823 (unused-attachments triangle) is the badge iconography template | exact |
| `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (MODIFY) | React panel | request-response | self — Source W×H `<td>` at lines 651-653 is the badge insertion site; mirrors GlobalMaxRenderPanel's pattern verbatim per Phase 19 D-06 unification | exact |
| `src/renderer/src/modals/OptimizeDialog.tsx` (MODIFY) | React modal | request-response (event-driven progress) | self — `PreFlightBody` at lines 436-465 is the patch site; the existing `excludedUnused` muted-note treatment at lines 458-462 is the muted-row UX precedent (Phase 6 D-109); `InProgressBody` at lines 467-563 is the corresponding in-progress patch site | exact |
| `tests/core/loader.spec.ts` (MODIFY) | unit test | n/a | self — extends the existing F1.1/F1.2/F2.7 cases with new DIMS-01 cases (use `loadSkeleton(FIXTURE)` shape from line 33) | exact |
| `tests/core/export.spec.ts` (MODIFY) | unit test | n/a | self — extends the parity describe block at lines 595-666 + adds new DIMS-03/DIMS-04 cases following the case-(a)-(f) shape (lines 42-441) | exact |
| `tests/renderer/global-max-virtualization.spec.tsx` (MODIFY) | RTL component test | n/a (jsdom) | self — extends with DIMS-02 conditional-render assertion using the `makeRow(i)` helper (line 89) + jsdom polyfills at lines 43-78 | exact |
| `tests/renderer/anim-breakdown-virtualization.spec.tsx` (MODIFY) | RTL component test | n/a (jsdom) | sibling of `global-max-virtualization.spec.tsx` (same jsdom shape) | exact |
| `tests/main/image-worker.passthrough.spec.ts` (NEW) | main-process unit test | n/a | `tests/main/image-worker.spec.ts` (mocked unit pattern) + `tests/main/image-worker.integration.spec.ts` (real-bytes pattern) — pick one or split | exact |
| `tests/renderer/optimize-dialog-passthrough.spec.tsx` (NEW) | RTL component test | n/a (jsdom) | `tests/renderer/global-max-virtualization.spec.tsx` (jsdom shape) + the OptimizeDialog `PreFlightBody` markup at OptimizeDialog.tsx:436-465 | role-match (no existing OptimizeDialog test in repo — confirmed via `grep -rln OptimizeDialog tests/` returning empty); reuse jsdom polyfill block from global-max spec |
| `tests/core/loader-dims-mismatch.spec.ts` (NEW) | integration test | n/a | `tests/core/loader-atlas-less.spec.ts` (round-trip pattern) — same `loadSkeleton → sampleSkeleton → analyze → buildExportPlan` chain; programmatic `tmpdir + sharp.resize()` fixture mutation per RESEARCH §6 | exact |

---

## Pattern Assignments

### `src/shared/types.ts` (type-only contract)

**Analog:** self — extend the existing `DisplayRow` + `ExportPlan` contracts in place (this is the canonical site for IPC-safe shapes per the file-top docblock).

**Existing `DisplayRow` shape** (lines 54-117) — append the five new fields after `atlasSource?:` (line 117):
```typescript
export interface DisplayRow {
  attachmentKey: string;
  // ... existing 19 fields ...
  atlasSource?: { pagePath: string; x: number; y: number; w: number; h: number; rotated: boolean };
  // Phase 22 DIMS-01 — new fields appended here
}
```

**Existing optional-field shape pattern** (`bytesOnDisk` on `UnusedAttachment`, lines 195-211 — added in Phase 19 with a multi-paragraph docblock + a CLI-fallback note + `?` modifier):
```typescript
/**
 * Phase 19 UI-04 (D-13) — On-disk byte size of the source PNG for this
 * unused attachment. Populated main-side in summary.ts via fs.statSync
 * against load.sourcePaths.get(attachmentName). Absent (or 0) when ...
 *
 * OPTIONAL field (`?` modifier): src/core/usage.ts stays 100% untouched
 * (Layer 3 invariant — core does no file I/O); summary.ts (allowed file
 * I/O) is the SOLE writer. Renderer reads with `(u.bytesOnDisk ?? 0)`
 * fallback. Absence ≡ 0.
 */
bytesOnDisk?: number;
```
**Apply to:** `actualSourceW?` and `actualSourceH?` (`number | undefined`) per CONTEXT D-01 wording — atlas-extract path (Jokerman-style) leaves them undefined.

**Existing always-required-field shape pattern** — every other DisplayRow field (`sourceW`, `sourceH`, `worldW`, etc.) is required; `canonicalW`/`canonicalH` should follow this shape per CONTEXT.md "Recommend always-required" discretion note.

**Existing `ExportPlan` shape** (lines 269-273) — append `passthroughCopies` parallel to `excludedUnused`:
```typescript
export interface ExportPlan {
  rows: ExportRow[];
  excludedUnused: string[];   // Phase 6 D-109 precedent — array-of-strings
  totals: { count: number };
}
```
**Pattern to copy:** the parallel-array shape — `excludedUnused: string[]` is added alongside `rows: ExportRow[]`. `passthroughCopies: ExportRow[]` follows the same posture (parallel array, no breaking shape change for existing consumers).

---

### `src/core/types.ts` (type-only contract)

**Analog:** self — extend `LoadResult` (lines 55-154) with two new map fields.

**Existing map-field shape pattern** (`sourcePaths` lines 79-93, `atlasSources` lines 94-124, `sourceDims` lines 73-78):
```typescript
sourceDims: Map<string, SourceDims>;
sourcePaths: Map<string, string>;
atlasSources: Map<string, { pagePath: string; x: number; y: number; w: number; h: number; rotated: boolean }>;
```

**Existing optional-field precedent** (`skippedAttachments` lines 134-153 — Phase 21 added an optional field with a multi-paragraph docblock):
```typescript
/**
 * Phase 21 Plan 21-09 G-01 fix — attachments whose PNG was missing in
 * atlas-less mode. OPTIONAL: absent in canonical-atlas mode and in
 * atlas-less mode where every referenced PNG resolved successfully.
 * Optional shape follows the existing `unusedAttachments?:` precedent on
 * SkeletonSummary to avoid TS2741 cascades on every existing LoadResult
 * test/mock site (Plan 21-09 ISSUE-007).
 */
skippedAttachments?: { name: string; expectedPngPath: string }[];
```
**Apply to:** new `canonicalDimsByRegion` and `actualDimsByRegion` maps. RESEARCH §3 recommends always-required for `canonicalDimsByRegion` (every JSON has skin attachments) and acceptable-empty for `actualDimsByRegion` (atlas-extract path leaves empty). Consider TS2741 cascade risk — if any existing LoadResult test/mock literal omits the new fields, those break at compile time.

---

### `src/core/loader.ts` (loader, request-response)

**Analog:** self — extend the existing `parsedJson` skin walk + per-region resolution. Phase 21 already landed the JSON-walk pattern in `synthetic-atlas.ts`.

**Imports pattern** (lines 30-50):
```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import { AtlasAttachmentLoader, SkeletonJson, TextureAtlas, Texture, TextureFilter, TextureWrap } from '@esotericsoftware/spine-core';
import type { LoadResult, LoaderOptions, SourceDims } from './types.js';
import { AtlasNotFoundError, AtlasParseError, SkeletonJsonNotFoundError, SpineVersionUnsupportedError } from './errors.js';
import { synthesizeAtlasText, SilentSkipAttachmentLoader } from './synthetic-atlas.js';
```
**Add:** `import { readPngDims } from './png-header.js';` (follows the same `./` relative + `.js` suffix convention).

**parsedJson skin walk pattern** — verbatim from `src/core/synthetic-atlas.ts:233-253` `walkSyntheticRegionPaths`:
```typescript
function walkSyntheticRegionPaths(parsedJson: unknown): Set<string> {
  const paths = new Set<string>();
  const root = parsedJson as {
    skins?: Array<{
      attachments?: Record<string, Record<string, { type?: string; path?: string }>>;
    }>;
  };
  for (const skin of root.skins ?? []) {
    for (const slotName in skin.attachments) {
      const slot = skin.attachments![slotName];
      for (const entryName in slot) {
        const att = slot[entryName];
        const type = att.type ?? 'region'; //                     SkeletonJson.js:366 default
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        const lookupPath = att.path ?? entryName; //              SkeletonJson.js:368, 401
        paths.add(lookupPath);
      }
    }
  }
  return paths;
}
```
**Apply to:** new local walk that ALSO harvests `att.width` and `att.height` per visited entry. Same iteration shape (skins → attachments → slot → entry), same type filter, same `att.path ?? entryName` keying. Differences: (1) collect into `Map<string, { canonicalW, canonicalH }>` instead of `Set<string>`; (2) inline cast type widens to `{ type?: string; path?: string; width?: number; height?: number }`. Insert AFTER the `parsedJson` parse at line 168 and BEFORE atlas resolution at line 198 — the parsed JSON object is already in scope.

**Per-region PNG read pattern** — verbatim from `src/core/synthetic-atlas.ts:158-189`:
```typescript
for (const regionName of regionPaths) {
  const pngPath = path.resolve(path.join(imagesDir, regionName + '.png'));
  let dims;
  try {
    dims = readPngDims(pngPath);
  } catch {
    // ... missing PNG handling
    continue;
  }
  // ... use dims
}
```
**Apply to:** new per-region `readPngDims()` loop AFTER `sourcePaths` is built (line 415). Iterate `sourcePaths` (already absolute paths), call `readPngDims(pngPath)`, populate `actualDimsByRegion`. On try/catch failure leave the entry undefined (atlas-extract path; matches CONTEXT D-01 wording "leave undefined for missing PNGs"). DO NOT throw — atlas-extract rows have no per-region PNG and that's expected.

**LoadResult return shape** (lines 497-507):
```typescript
return {
  skeletonPath: path.resolve(skeletonPath),
  atlasPath: resolvedAtlasPath,
  skeletonData,
  atlas: atlas!,
  sourceDims,
  sourcePaths,
  atlasSources,
  editorFps,
  ...(skippedAttachments !== undefined ? { skippedAttachments } : {}),
};
```
**Apply to:** add `canonicalDimsByRegion` and `actualDimsByRegion` to the return literal. Use the conditional-spread idiom (`...(x !== undefined ? { x } : {})`) only for optional fields; required fields (canonical map per always-required recommendation) appear as bare `canonicalDimsByRegion,`.

---

### `src/core/analyzer.ts` (pure projection, transform)

**Analog:** self — extend `analyze()` (line 177) + `analyzeBreakdown()` (line 267) signatures.

**Existing optional-Map signature pattern** (lines 177-181 and 267-274):
```typescript
export function analyze(
  peaks: Map<string, PeakRecord>,
  sourcePaths?: ReadonlyMap<string, string>,
  atlasSources?: ReadonlyMap<string, NonNullable<DisplayRow['atlasSource']>>,
): DisplayRow[] {
  const allRows = [...peaks.values()].map((p) =>
    toDisplayRow(
      p,
      sourcePaths?.get(p.attachmentName) ?? '',
      atlasSources?.get(p.attachmentName),
    ),
  );
  return dedupByAttachmentName(allRows).sort(byCliContract);
}
```
**Apply to:** add two more optional ReadonlyMap params (`canonicalDims?` and `actualDims?`). Mirror the `sourcePaths?.get(p.attachmentName) ?? ''` posture but use `?.get(p.attachmentName)` returning the `{ canonicalW, canonicalH }` (or `{ actualSourceW, actualSourceH }`) record, then thread into `toDisplayRow`.

**Existing toDisplayRow + literal field-mapping** (lines 87-125):
```typescript
function toDisplayRow(
  p: PeakRecord,
  sourcePath: string = '',
  atlasSource?: DisplayRow['atlasSource'],
): DisplayRow {
  return {
    attachmentKey: p.attachmentKey,
    // ... 19 raw + label fields ...
    sourcePath,
    ...(atlasSource ? { atlasSource } : {}),
  };
}
```
**Apply to:** add new params (`canonicalW`, `canonicalH`, `actualSourceW?`, `actualSourceH?`), populate the new DisplayRow fields. Compute `dimsMismatch` here per RESEARCH §3:
```typescript
const dimsMismatch = actualSourceW !== undefined && actualSourceH !== undefined &&
  (Math.abs(actualSourceW - canonicalW) > 1 || Math.abs(actualSourceH - canonicalH) > 1);
```
(per ROADMAP DIMS-01: "more than 1px on either axis").

**CLI fallback pattern** — RESEARCH §3 R5 mitigation: when `canonicalDimsByRegion` is undefined or has no entry for an attachment (CLI path; D-102 byte-for-byte lock), fall back to `canonicalW = p.sourceW` and `canonicalH = p.sourceH`. This preserves "canonical = source" semantics and `dimsMismatch` evaluates false (no actualSource means no comparison).

---

### `src/main/summary.ts` (IPC projection, transform)

**Analog:** self — one-line extension at line 74.

**Existing analyze() invocation pattern** (lines 74 and 85-92):
```typescript
const peaksArrayRaw = analyze(sampled.globalPeaks, load.sourcePaths, load.atlasSources);
// ...
const animationBreakdownRaw = analyzeBreakdown(
  sampled.perAnimation,
  sampled.setupPosePeaks,
  load.skeletonData,
  skeleton.slots,
  load.sourcePaths,
  load.atlasSources,
);
```
**Apply to:** thread `load.canonicalDimsByRegion` and `load.actualDimsByRegion` as the next two args to BOTH `analyze()` and `analyzeBreakdown()`. No other changes needed — the new fields ride along on every `DisplayRow` via the additive contract.

---

### `src/core/export.ts` (pure math, transform)

**Analog:** self — extend `buildExportPlan()` (lines 137-232) loop.

**Imports pattern** (lines 64-70) — type-only from `'../shared/types.js'`, runtime `applyOverride` from `'./overrides.js'`. **Layer 3 invariant** (line 52-56 docblock): NO imports of node:fs / node:path / sharp / electron / @esotericsoftware/spine-core. Phase 22's cap step + passthrough partition adds zero new imports — pure math on existing fields.

**Existing safeScale helper** (lines 133-135) — REUSE in cap pre-step:
```typescript
export function safeScale(s: number): number {
  return Math.ceil(s * 1000) / 1000;
}
```

**Existing accumulator + group loop** (lines 152-193):
```typescript
interface Acc {
  row: DisplayRow;
  effScale: number;
  attachmentNames: string[];
}
const bySourcePath = new Map<string, Acc>();
for (const row of summary.peaks) {
  if (excluded.has(row.attachmentName)) continue;
  if (!row.sourcePath) continue;
  const overridePct = overrides.get(row.attachmentName);
  const rawEffScale =
    overridePct !== undefined
      ? applyOverride(overridePct).effectiveScale
      : row.peakScale;
  const effScale = Math.min(safeScale(rawEffScale), 1);
  const prev = bySourcePath.get(row.sourcePath);
  if (prev === undefined) {
    bySourcePath.set(row.sourcePath, { row, effScale, attachmentNames: [row.attachmentName] });
  } else {
    if (effScale > prev.effScale) {
      prev.row = row;
      prev.effScale = effScale;
    }
    if (!prev.attachmentNames.includes(row.attachmentName)) {
      prev.attachmentNames.push(row.attachmentName);
    }
  }
}
```
**Apply to:** insert the cap step BETWEEN `safeScale + Math.min(...,1)` clamp (line 176) and the dedup-keep-max (line 184). Add `isCapped` to the `Acc` interface. Cap formula per RESEARCH §DIMS-03 (final form):
```typescript
const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);
const sourceLimit = (row.dimsMismatch && row.actualSourceW !== undefined && row.actualSourceH !== undefined)
  ? Math.min(row.actualSourceW / row.canonicalW, row.actualSourceH / row.canonicalH)
  : Infinity;
const cappedEffScale = Math.min(downscaleClampedScale, sourceLimit);
const isCapped = cappedEffScale < downscaleClampedScale;
```

**Existing emit-rows pattern** (lines 205-220):
```typescript
const rows: ExportRow[] = [];
for (const acc of bySourcePath.values()) {
  const outW = Math.ceil(acc.row.sourceW * acc.effScale);
  const outH = Math.ceil(acc.row.sourceH * acc.effScale);
  rows.push({
    sourcePath: acc.row.sourcePath,
    outPath: relativeOutPath(acc.row.sourcePath),
    sourceW: acc.row.sourceW,
    sourceH: acc.row.sourceH,
    outW,
    outH,
    effectiveScale: acc.effScale,
    attachmentNames: acc.attachmentNames.slice(),
    ...(acc.row.atlasSource ? { atlasSource: acc.row.atlasSource } : {}),
  });
}
```
**Apply to:** partition into `rows[]` (lanczos) + `passthroughCopies[]` (byte-copy) per CONTEXT D-04 (REVISED). Per RESEARCH §R6 (D-04 ambiguity flagged), the cleanest interpretation is `isPassthrough = isCapped` (capping IS the no-further-reduction signal — when capped, `outW = actualSourceW` BY CONSTRUCTION). Use this form, with redundant ceil-equality assertions in tests as guards. Output dim shortcut: `outW = isCapped ? actualSourceW! : Math.ceil(canonicalW * cappedEffScale)`.

**Existing sort pattern** (lines 222-225):
```typescript
rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
const excludedUnused = [...excluded].sort((a, b) => a.localeCompare(b));
```
**Apply to:** add `passthroughCopies.sort(...)` with the same comparator (deterministic output across runs).

**Existing return shape** (lines 227-231) — extend with `passthroughCopies` and update `totals.count` to include both arrays:
```typescript
return {
  rows,
  excludedUnused,
  passthroughCopies,
  totals: { count: rows.length + passthroughCopies.length },
};
```

---

### `src/renderer/src/lib/export-view.ts` (renderer-mirror math, transform)

**Analog:** self — byte-identical mirror of `src/core/export.ts` (Phase 6 D-110 parity contract; lines 1-44 + 28-32 docblocks spell it out).

**Parity contract** (lines 28-32):
> "Parity contract: the exported function bodies in this file are byte-identical to the canonical source module. If you modify one, modify the other in the same commit. A parity describe block in tests/core/export.spec.ts asserts sameness on representative inputs plus signature greps against both file contents."

**Apply to:** mirror the entire cap step + passthrough partition byte-identically into `buildExportPlan` here. Comments must be character-for-character identical (the parity test greps function bodies). The `safeScale` helper is already mirrored at line 114; the cap-step inserts in the same position relative to `safeScale + clamp`.

**`computeExportDims` helper** (lines 139-161) — RESEARCH §DIMS-03 calls out that this helper ALSO needs the cap math (the panel "Peak W×H" column must match what the cap produces). Either:
- Add three new optional params (`actualSourceW?`, `actualSourceH?`, `dimsMismatch?`) following the optional-field pattern from `analyze()`, OR
- Pass the whole DisplayRow (planner picks).

**Apply to:** `enrichWithEffective` in both panels (`GlobalMaxRenderPanel.tsx:186-206` + the AnimationBreakdownPanel sibling) calls `computeExportDims` — those call sites need to pass the new fields through. Recommend Option A (preserve existing single-purpose signature shape).

---

### `src/main/image-worker.ts` (sharp pipeline / file-I/O, streaming)

**Analog:** self — sharp resize block (lines 246-287); add a parallel copyFile block for `passthroughCopies[]`.

**Imports pattern** (line 57):
```typescript
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
```
**Apply to:** add `copyFile` to the existing destructure: `import { access, copyFile, mkdir, rename, constants as fsConstants } from 'node:fs/promises';` — matches RESEARCH Item #2 verified evidence (the existing pipeline is fully async via fs/promises).

**Existing per-row pre-flight + write pattern** — full row processing pipeline (lines 97-308):
```typescript
for (let i = 0; i < plan.rows.length; i++) {
  if (isCancelled()) { bailedOnCancel = true; break; }
  const row = plan.rows[i];
  const sourcePath = row.sourcePath;
  const resolvedOut = pathResolve(outDir, row.outPath);

  // 0. Overwrite guard (Round 4 — F_OK probe)
  // 1. Pre-flight access check (R_OK on sourcePath; atlas-extract fallback)
  // 2. Path-traversal defense (rel.startsWith('..') || isAbsolute(rel) || rel === '')
  // 3. NaN/zero-dim guard
  // 4. mkdir(dirname(resolvedOut), { recursive: true })
  // 5. sharp pipeline → tmpPath
  // 6. rename(tmpPath, resolvedOut) — atomic per D-121
  // 7. Success: emit progress
}
```
**Apply to:** new passthrough loop with steps 0, 1 (R_OK only — no atlas-extract fallback for passthroughCopies; fall through to error on miss), 2, 4, then `copyFile(sourcePath, tmpPath) + rename(tmpPath, resolvedOut)` (skip step 3 NaN guard because passthrough doesn't depend on outW/outH math; skip step 5 sharp pipeline). Per RESEARCH §R4: use `tmpPath + rename` for fsync-equivalent semantics (matches Phase 6 D-121 atomic-write contract). Per RESEARCH Item #2 Option B: single index space `[...passthroughCopies, ...rows]` — image-worker iterates passthroughCopies FIRST, then rows; progress events fire with absolute index; total = `passthroughCopies.length + rows.length`.

**Existing atomic-rename pattern** (lines 254-304):
```typescript
const tmpPath = resolvedOut + '.tmp';
try {
  // ... write to tmpPath
  await sharp(sourcePath).resize(...).png(...).toFile(tmpPath);
} catch (e) {
  const error: ExportError = { kind: 'sharp-error', path: sourcePath, message: e instanceof Error ? e.message : String(e) };
  errors.push(error);
  onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
  continue;
}
try {
  await rename(tmpPath, resolvedOut);
} catch (e) {
  const error: ExportError = { kind: 'write-error', path: resolvedOut, message: e instanceof Error ? e.message : String(e) };
  errors.push(error);
  onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
  continue;
}
successes++;
onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'success' });
```
**Apply to:** passthrough copy block uses `await copyFile(sourcePath, tmpPath)` instead of the sharp chain. Error kind: `'write-error'` (passthrough has no sharp-specific error class). Same `onProgress` event shape — emits `success` after rename completes. Per RESEARCH §R8: `mkdir(dirname(resolvedOut), { recursive: true })` MUST run for passthrough rows too (subfolder support; F8.3 invariant).

---

### `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (React panel, request-response)

**Analog:** self — Source W×H `<td>` at line 424 is the badge insertion site; existing inline-SVG warning pattern at lines 818-823 is the iconography template.

**Imports pattern** (line 65):
```typescript
import { computeExportDims } from '../lib/export-view.js';
```
No new imports needed — the badge is plain JSX + Tailwind classes.

**Existing inline-SVG warning pattern** (lines 818-823, the unused-attachments triangle):
```tsx
<span aria-hidden="true" className="inline-flex items-center justify-center w-5 h-5">
  <svg viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="w-5 h-5">
    <path d="M10 3 L18 16 L2 16 Z" />
    <path d="M10 8 v4 M10 14.5 v0.01" />
  </svg>
</span>
```
**Apply to:** new dims-mismatch badge (info-circle or resize-arrow icon). Per CONTEXT.md "Claude's Discretion": pick small (w-4 h-4) info-circle since the warning triangle is already taken for unused-attachments. Place INSIDE the Source W×H `<td>` AFTER `row.originalSizeLabel`.

**Existing tooltip-via-title pattern** (lines 435, 453-457, 688):
```tsx
<td title={`World AABB at peak: ${row.worldW.toFixed(0)}×${row.worldH.toFixed(0)}`}>
  ...
</td>
```
**Apply to:** the dims-badge `<span>` carries `title` + `aria-label` with the locked verbatim ROADMAP DIMS-02 wording: `"Source PNG (${row.actualSourceW}×${row.actualSourceH}) is smaller than canonical region dims (${row.canonicalW}×${row.canonicalH}). Optimize will cap at source size."`. Both `title` (mouse hover) AND `aria-label` (screen reader) carry the full sentence.

**Existing conditional-render pattern** (line 460 — override percent badge):
```tsx
{row.override !== undefined && <span> • {row.override}%</span>}
```
**Apply to:** wrap the dims-badge in `{row.dimsMismatch && (<span ...>...</span>)}` — single conditional, no else branch, identical render-when-truthy posture.

**Patch site** — Source W×H `<td>` at line 424:
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">{row.originalSizeLabel}</td>
```
**Apply to:** widen to:
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">
  {row.originalSizeLabel}
  {row.dimsMismatch && (<span aria-label="..." title="..." className="..."><svg .../></span>)}
</td>
```

---

### `src/renderer/src/panels/AnimationBreakdownPanel.tsx` (React panel, request-response)

**Analog:** self — sibling of GlobalMaxRenderPanel (Phase 19 D-06 unification: identical visual treatments across both panels).

**Patch site** — Source W×H `<td>` at lines 651-653:
```tsx
<td className="py-2 px-3 font-mono text-sm text-fg text-right">
  {row.originalSizeLabel}
</td>
```
**Apply to:** identical badge insertion as GlobalMaxRenderPanel above. The two panels' badge JSX should be byte-identical (Phase 19 D-06 visual unification contract).

---

### `src/renderer/src/modals/OptimizeDialog.tsx` (React modal, event-driven progress)

**Analog:** self — `PreFlightBody` at lines 436-465 is the pre-flight patch site; existing `excludedUnused` muted-note treatment at lines 458-462 is the muted-row UX precedent (Phase 6 D-109).

**Imports + types** (lines 4-15) — `ExportPlan` type already imported. No new imports needed for the muted-row treatment.

**Existing `PreFlightBody` row render pattern** (lines 440-456):
```tsx
{plan.rows.map((row) => {
  const ratio = row.outW > 0 ? row.sourceW / row.outW : 1;
  return (
    <li key={row.outPath} className="py-1 border-b border-border last:border-0">
      <span className="text-fg">{row.outPath}</span>
      <span className="ml-2">
        {row.sourceW}×{row.sourceH} → {row.outW}×{row.outH}
      </span>
      {ratio > 1.05 && <span className="ml-2">~{ratio.toFixed(1)}x smaller</span>}
    </li>
  );
})}
```
**Apply to:** add a parallel `plan.passthroughCopies.map(...)` block AFTER the rows block. Per CONTEXT D-03 muted treatment: add `opacity-60` (or `text-fg-muted`) to the `<li>` className. Append a `"COPY"` indicator label as a small bordered badge:
```tsx
{plan.passthroughCopies.map((row) => (
  <li key={row.outPath} className="py-1 border-b border-border last:border-0 opacity-60">
    <span className="text-fg-muted">{row.outPath}</span>
    <span className="ml-2">{row.sourceW}×{row.sourceH} (already optimized)</span>
    <span className="ml-2 inline-block border border-border rounded-sm px-1 text-[10px] uppercase">COPY</span>
  </li>
))}
```

**Existing muted-note pattern** (lines 458-462 — Phase 6 D-109 excludedUnused note):
```tsx
{plan.excludedUnused.length > 0 && (
  <p className="mt-3 text-xs text-fg-muted">
    {plan.excludedUnused.length} unused attachments excluded — see Global panel.
  </p>
)}
```
**Apply to:** the muted "COPY" indicator borrows the `text-fg-muted` color contract. The "COPY" label is a small bordered chip rather than a sentence-end note (because it's a per-row indicator, not a summary-line note).

**Existing `InProgressBody` row render pattern** (lines 467-553) — keyed by `rowIndex` from `props.rowStatuses.get(rowIndex)`:
```tsx
{props.plan.rows.map((row, rowIndex) => {
  const status = (props.rowStatuses.get(rowIndex) ?? 'idle') as RowStatus;
  // ... render with status icon (✓/⚠/·/○) + outPath + sourceW×sourceH → outW×outH
})}
```
**Apply to:** per RESEARCH Item #2 Option B (single index space), iterate `[...plan.passthroughCopies, ...plan.rows]` so progress events at index 0..passthroughCopies.length-1 land on passthrough rows; render passthrough rows with the muted treatment + "COPY" badge AND the same status icon (✓/⚠/·/○). Total = `passthroughCopies.length + plan.rows.length`. The IPC progress event index already carries the absolute position; OptimizeDialog reconstructs (kind, localIndex) by checking `event.index < plan.passthroughCopies.length`.

---

### `tests/core/loader.spec.ts` (unit test — extension)

**Analog:** self — extend with DIMS-01 cases following the existing F1.1/F1.2/F2.7 shape.

**Existing test pattern** (lines 32-68):
```typescript
describe('loader (F1.1, F1.2, F1.4)', () => {
  it('F1.1+F1.2: loads the fixture and auto-detects sibling .atlas', () => {
    const r = loadSkeleton(FIXTURE);
    expect(r.skeletonData).toBeDefined();
    // ...
  });
  it('F2.7 priority 1: sourceDims populated from .atlas bounds for all 3 regions', () => {
    const r = loadSkeleton(FIXTURE);
    expect(r.sourceDims.size).toBe(3);
    // ...
  });
});
```
**Apply to:** new `describe('loader (DIMS-01 canonical-vs-actual dim mapping)')` block with cases:
- `DIMS-01: canonical-atlas mode populates canonicalDimsByRegion from JSON skin attachments` — assert SQUARE = 1000×1000, TRIANGLE = 833×759, CIRCLE = 699×699 (from SIMPLE_TEST.json).
- `DIMS-01: canonical-atlas mode with PNGs in images/ populates actualDimsByRegion from readPngDims` — extends fixture with images/ folder OR uses EXPORT_PROJECT.
- `DIMS-01: atlas-extract path leaves actualDimsByRegion empty for missing PNGs` — covers Jokerman-style projects.
- `DIMS-01: dimsMismatch:false when canonical === actual` — happy-path baseline.

---

### `tests/core/export.spec.ts` (unit test — extension)

**Analog:** self — extend the parity describe block at lines 595-666 + add new DIMS-03/DIMS-04 cases.

**Existing parity describe pattern** (lines 595-666):
```typescript
describe('export — core ↔ renderer parity (Layer 3 inline-copy invariant)', () => {
  it('renderer view exports buildExportPlan by name', () => {
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    expect(viewText).toMatch(/export\s+function\s+buildExportPlan/);
  });
  it('both files share the same Math.ceil uniform sizing pattern (Round 5 — ceil replaces round)', () => {
    const coreText = readFileSync(EXPORT_SRC, 'utf8');
    const viewText = readFileSync(VIEW_SRC, 'utf8');
    const sig = /Math\.ceil\([^)]*sourceW\s*\*/;
    expect(coreText).toMatch(sig);
    expect(viewText).toMatch(sig);
  });
  it('renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs', async () => {
    // ... build summary, run both copies, assert toEqual
  });
});
```
**Apply to:** add two new parity assertions per RESEARCH §R2:
- `both files share the cap-step regex` — `/Math\.min\([^)]*actualSourceW\s*\/\s*canonicalW/` matches in BOTH files.
- `both files emit passthroughCopies on a drifted row` — behavioral fixture: build summary with one drifted row in BOTH files; assert byte-equal `passthroughCopies` arrays.

**Existing case-(a)-(f) shape** (lines 42-441) — pure unit cases driving `buildExportPlan(summary, overrides)` and asserting on `plan.rows[0].outW`/`outH`/`effectiveScale`:
```typescript
describe('buildExportPlan — case (a) baseline (D-108, D-110, D-111)', () => {
  it('baseline (no overrides) yields 3 rows with peakScale-driven effScale', () => {
    const summary = makeSummary(...);
    const plan = buildExportPlan(summary, new Map());
    expect(plan.rows).toHaveLength(3);
    expect(plan.rows[0].effectiveScale).toBeCloseTo(...);
  });
});
```
**Apply to:** new DIMS-03 + DIMS-04 cases:
- `DIMS-03: cap fires when dimsMismatch && actualSource defined` — set `actualSourceW=811, canonicalW=1628`; assert `cappedEffScale === 0.498` and `outW === 811`.
- `DIMS-04: passthrough partition — capped row lands in passthroughCopies, not rows[]` — drifted row → passthroughCopies.length === 1, rows.length === 0.
- `DIMS-04: ceil-equality redundant guard holds when isCapped` — assert `Math.ceil(actualSourceW × cappedEffScale) === actualSourceW` AND `Math.ceil(actualSourceH × cappedEffScale) === actualSourceH` per CONTEXT D-04 (REVISED) tautology.

---

### `tests/renderer/global-max-virtualization.spec.tsx` (RTL component test — extension)

**Analog:** self — extend with DIMS-02 conditional-render assertions using the existing `makeRow(i)` helper.

**Existing `makeRow` helper** (lines 89-114):
```typescript
function makeRow(i: number): DisplayRow {
  const name = `attachment-${String(i).padStart(4, '0')}`;
  return {
    attachmentKey: `default::slot-${i}::${name}`,
    skinName: 'default',
    slotName: `slot-${i}`,
    attachmentName: name,
    // ... 19 fields ...
    sourcePath: `/fake/${name}.png`,
  };
}
```
**Apply to:** extend with new fields (`canonicalW`, `canonicalH`, `actualSourceW`, `actualSourceH`, `dimsMismatch`). For default rows: `canonicalW=64, canonicalH=64, actualSourceW=64, actualSourceH=64, dimsMismatch=false`. Add a `makeDriftedRow(i)` variant with `actualSourceW=32, actualSourceH=32, dimsMismatch=true` for the badge-on assertion.

**Existing test pattern** (lines 163-183):
```typescript
describe('GlobalMaxRenderPanel — Wave 2 D-191 / D-195', () => {
  it('below threshold (50 rows): getAllByRole("row").length === 51 (header + 50 data rows)', () => {
    renderPanel(50);
    expect(screen.getAllByRole('row').length).toBe(51);
  });
});
```
**Apply to:** new `describe('GlobalMaxRenderPanel — DIMS-02 dims-mismatch badge')` with:
- `it('renders dims-mismatch badge when row.dimsMismatch === true')` — render with `makeDriftedRow(0)`; query for the `aria-label="Source PNG dims differ..."` element via `screen.getByLabelText(/source png dims/i)`; assert `toBeInTheDocument()`.
- `it('does NOT render badge when row.dimsMismatch === false')` — render with default `makeRow(0)`; `screen.queryByLabelText(/source png dims/i)` returns null.

---

### `tests/renderer/anim-breakdown-virtualization.spec.tsx` (RTL component test — extension)

**Analog:** sibling of `global-max-virtualization.spec.tsx` (same jsdom shape).

**Apply to:** identical DIMS-02 conditional-render assertions adapted to the AnimationBreakdownPanel's `BreakdownRow` (extends DisplayRow — same fields, plus `bonePath` + `bonePathLabel`). Mirror the `makeRow` / `makeDriftedRow` helpers from the global-max spec, adding the BreakdownRow-only fields.

---

### `tests/main/image-worker.passthrough.spec.ts` (NEW)

**Analog:** mocked unit pattern from `tests/main/image-worker.spec.ts:1-130` + real-bytes integration pattern from `tests/main/image-worker.integration.spec.ts:1-87`.

**Imports + setup pattern** (image-worker.spec.ts:29-43):
```typescript
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';
```

**Real-bytes pattern** (image-worker.integration.spec.ts:38-86):
```typescript
it('CIRCLE.png 699×699 → 350×350 output is a valid PNG with correct dims', async () => {
  const sourcePath = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
  const plan: ExportPlan = { rows: [{...}], excludedUnused: [], totals: { count: 1 } };
  const events: ExportProgressEvent[] = [];
  const summary = await runExport(plan, tmpDir, (e) => events.push(e), () => false);
  expect(summary.successes).toBe(1);
  expect(summary.errors).toEqual([]);
  // ... validate output PNG via sharp().metadata()
});
```
**Apply to:** new spec file using **real bytes** (not mocked sharp) — the goal is to verify byte-identical copy, which mocks can't prove. Build `ExportPlan` with empty `rows: []` and one entry in `passthroughCopies: [...]`. Run `runExport`; assert:
- `summary.successes === 1` and `summary.errors === []`.
- Output PNG byte buffer === source PNG byte buffer (`Buffer.equals(fs.readFileSync(out), fs.readFileSync(src))`).
- Per RESEARCH §R8: `tests/main/image-worker.passthrough.spec.ts` MUST include a "passthrough copy of `AVATAR/FACE.png` creates the AVATAR subdirectory under outDir" test.
- Per RESEARCH §R4 (atomic write parity): assert `fs.existsSync(outPath + '.tmp') === false` after copy completes (rename atomic).

---

### `tests/renderer/optimize-dialog-passthrough.spec.tsx` (NEW)

**Analog:** jsdom polyfill block from `tests/renderer/global-max-virtualization.spec.tsx:43-78` + the `PreFlightBody` markup at `OptimizeDialog.tsx:436-465`.

**Existing jsdom polyfill pattern** (global-max-virtualization.spec.tsx:43-78) — reuse verbatim if useVirtualizer or any layout-dependent component is involved; for OptimizeDialog the modal does NOT use virtualization, so this polyfill may be unnecessary (verify before importing).

**Existing render pattern** (global-max-virtualization.spec.tsx:159-161):
```typescript
function renderPanel(rowCount: number) {
  return render(<PanelTestHarness rowCount={rowCount} />);
}
```
**Apply to:** render `<OptimizeDialog ... />` (note: `tests/renderer/` has zero existing OptimizeDialog tests — confirmed via `grep -rln OptimizeDialog tests/`). Build a fake `ExportPlan` with `passthroughCopies: [{ outPath: 'images/CIRCLE.png', sourceW: 699, sourceH: 699, outW: 350, outH: 350, ... }]` and `rows: []`. Assertions:
- "COPY" indicator badge rendered for passthrough rows: `screen.getByText('COPY')` exists.
- Muted styling applied: the parent `<li>` has `opacity-60` (or whatever the planner picked — assert via className regex).
- The same `outPath` rendered on a normal `plan.rows[]` entry does NOT have the COPY badge (negative case).

---

### `tests/core/loader-dims-mismatch.spec.ts` (NEW)

**Analog:** `tests/core/loader-atlas-less.spec.ts` — round-trip pattern (lines 1-130).

**Existing round-trip pattern** (loader-atlas-less.spec.ts:30-58):
```typescript
const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');

describe('Phase 21 atlas-less round-trip (LOAD-01 + LOAD-04)', () => {
  it('D-05 + INV-8: load returns LoadResult with atlasPath: null and sourceDims source: "png-header"', () => {
    const result = loadSkeleton(ATLAS_LESS_FIXTURE);
    expect(result.atlasPath).toBeNull();
    expect(result.sourceDims.size).toBeGreaterThanOrEqual(3);
    for (const [name, dims] of result.sourceDims) {
      expect(dims.source, `region ${name}`).toBe('png-header');
    }
  });
});
```

**Existing chained call pattern** (loader-atlas-less.spec.ts further down):
```typescript
const load = loadSkeleton(...);
const sampled = sampleSkeleton(load);
const peaks = analyze(sampled.globalPeaks);
const plan = buildExportPlan(summary, new Map());
```
**Apply to:** programmatic fixture mutation per RESEARCH §6:
```typescript
import sharp from 'sharp'; // already a project dep
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
import { buildExportPlan } from '../../src/core/export.js';

const FIXTURE_SRC = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS');
let tmpDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-drifted-'));
  fs.copyFileSync(path.join(FIXTURE_SRC, 'SIMPLE_TEST.json'), path.join(tmpDir, 'SIMPLE_TEST.json'));
  fs.mkdirSync(path.join(tmpDir, 'images'));
  for (const file of fs.readdirSync(path.join(FIXTURE_SRC, 'images'))) {
    if (!file.endsWith('.png')) continue;
    const meta = await sharp(path.join(FIXTURE_SRC, 'images', file)).metadata();
    await sharp(path.join(FIXTURE_SRC, 'images', file))
      .resize(Math.ceil(meta.width! / 2), Math.ceil(meta.height! / 2), { kernel: 'lanczos3' })
      .png()
      .toFile(path.join(tmpDir, 'images', file));
  }
});

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('Phase 22 DIMS-05 round-trip — already-optimized images', () => {
  it('every drifted row lands in passthroughCopies; rows[] is empty', () => {
    const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'), { loaderMode: 'atlas-less' });
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 0);
    const plan = buildExportPlan(summary, new Map());
    const drifted = fs.readdirSync(path.join(tmpDir, 'images')).filter((f) => f.endsWith('.png'));
    expect(plan.passthroughCopies.length).toBe(drifted.length);  // R7 mitigation: dynamic count
    expect(plan.rows.length).toBe(0);
  });
});
```
Per RESEARCH §R7: read fixture file count dynamically (`fs.readdirSync().length`) — never hardcode `4`; the test stays green if Phase 21 fixtures evolve.

---

## Shared Patterns

### Layer 3 invariant
**Source:** `tests/arch.spec.ts:19-34` (Layer 3 grep gate) + module-top docblocks
**Apply to:** `src/core/types.ts`, `src/core/loader.ts`, `src/core/analyzer.ts`, `src/core/export.ts`
**Rule:** core/* MUST NOT import sharp, electron, DOM types, or anything outside `node:fs` / `node:path` / `@esotericsoftware/spine-core` / sibling core modules. Phase 22's cap step is pure math — adds zero new imports.

### Renderer ↔ core math parity contract
**Source:** `src/renderer/src/lib/export-view.ts:28-32` docblock + `tests/core/export.spec.ts:595-666` describe block
**Apply to:** `src/core/export.ts` ↔ `src/renderer/src/lib/export-view.ts`
**Rule:** function bodies are byte-identical. Comments must match character-for-character (the parity test greps function bodies). Modify both in the same commit.

### Optional-field cascade-safety pattern
**Source:** `src/core/types.ts:134-153` (`skippedAttachments?` Phase 21 ISSUE-007) + `src/shared/types.ts:195-211` (`bytesOnDisk?` Phase 19 UI-04)
**Apply to:** new `actualSourceW?`, `actualSourceH?` fields on DisplayRow + new `actualDimsByRegion?` on LoadResult
**Rule:** use `?:` modifier when consumers may not always have a value (atlas-extract path leaves actualSource undefined). Fallback in reads: `(row.actualSourceW ?? 0)` or `dimsMismatch === false` when undefined.

### Atomic-write contract (Phase 6 D-121)
**Source:** `src/main/image-worker.ts:255 + 289-304` (sharp pipeline writes to `tmpPath` then renames)
**Apply to:** new passthrough copyFile path
**Rule:** `await copyFile(src, tmpPath); await rename(tmpPath, resolvedOut);` per RESEARCH §R4 to match Phase 6 atomic-write semantics + macOS delayed-allocation safety.

### Conditional-spread literal pattern
**Source:** `src/core/loader.ts:506` + `src/core/analyzer.ts:123` + `tests/core/export.spec.ts` baseline
```typescript
...(skippedAttachments !== undefined ? { skippedAttachments } : {})
...(atlasSource ? { atlasSource } : {})
```
**Apply to:** any optional-field population in object literals — preserves the "field absent vs field undefined" distinction for `Object.keys()` consumers.

### Inline SVG icon + tooltip pattern (Phase 19)
**Source:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:818-823` (unused-attachments triangle)
**Apply to:** new dims-mismatch badge in both panels
**Rule:** inline `<svg viewBox="0 0 16 16" ... className="w-4 h-4">` (size down from the section header's w-5 h-5 since it's per-row); `<span aria-label=... title=...>` wrapper with the verbatim ROADMAP DIMS-02 wording.

### Phase 6 D-109 muted-row UX precedent
**Source:** `src/renderer/src/modals/OptimizeDialog.tsx:458-462` (excludedUnused note) + Phase 19 muted-color tokens
**Apply to:** new "COPY" muted-row treatment for `passthroughCopies[]`
**Rule:** muted opacity (`opacity-60`) + `text-fg-muted` + small bordered uppercase chip (`border border-border rounded-sm px-1 text-[10px] uppercase`) for the "COPY" indicator label.

### CLI byte-for-byte preservation (Phase 5 D-102)
**Source:** `scripts/cli.ts` + `src/core/analyzer.ts:177-189` (`analyze()` accepts optional sourcePaths/atlasSources — CLI passes nothing)
**Apply to:** new `analyze()` params for canonical/actual dim maps
**Rule:** new params MUST be optional. CLI fallback: `canonicalW = p.sourceW`, `canonicalH = p.sourceH`, `actualSource* = undefined`, `dimsMismatch = false` (R5 mitigation).

---

## No Analog Found

None. Every Phase 22 surface has a clean analog in the existing codebase — Phase 22 is structurally an extension phase. The three NEW test files all have analog test files (`image-worker.spec.ts` for mocked, `image-worker.integration.spec.ts` for real bytes, `loader-atlas-less.spec.ts` for round-trip) that establish the patterns.

---

## Metadata

**Analog search scope:** `src/core/`, `src/main/`, `src/renderer/`, `src/shared/`, `tests/core/`, `tests/main/`, `tests/renderer/`, `tests/integration/`.
**Files scanned:** 50+ source files, 30+ test files (selectively read — non-overlapping ranges per CRITICAL_RULES no-re-read invariant).
**Pattern extraction date:** 2026-05-02
**Phase:** 22-seed-002-dims-badge-override-cap-depends-on-phase-21
