# Phase 22: SEED-002 dims-badge + override-cap - Research

**Researched:** 2026-05-02
**Domain:** Round-trip safety after Optimize Assets — canonical-vs-actual PNG dimension drift detection + export cap + passthrough byte-copies
**Confidence:** HIGH

## Summary

Phase 22 is an **extension phase** — every Phase 22 surface modifies an existing file. No new core/ modules required (the infrastructure landed in Phase 21: `src/core/png-header.ts` for IHDR reads; the `parsedJson` skin walk pattern in `synthetic-atlas.ts` for canonical dims). The locked decisions from CONTEXT.md (D-01..D-04) compress the design space dramatically: the planner's job is to cleanly thread five new fields onto `DisplayRow`, mirror a 4-line cap formula in the byte-identical core+renderer export builders, add a `passthroughCopies[]` array to `ExportPlan` parallel to the existing `excludedUnused[]` precedent, and add a single `fs.promises.copyFile` branch to `image-worker.ts`.

**Recommended implementation order** (clean dependency line — feeds into the wave structure in §9):

1. **Types cascade first** (`src/shared/types.ts` → `src/core/types.ts`). Add the five new `DisplayRow` fields + the new `passthroughCopies: ExportRow[]` field on `ExportPlan`. Land BEFORE any code change so TypeScript surfaces every consumer that needs adjustment.
2. **Loader extension** (`src/core/loader.ts`) — extend the existing `parsedJson` skin walk (already done by `synthetic-atlas.ts:walkSyntheticRegionPaths` for atlas-less mode) to collect canonical width/height per region. Add per-region `readPngDims()` calls (Phase 21's reader) keyed off `sourcePaths`. Populate one parallel `Map<string, { canonicalW, canonicalH, actualSourceW?, actualSourceH? }>` keyed by region name. Thread through `LoadResult`.
3. **Analyzer + summary plumbing** (`src/core/analyzer.ts` + `src/main/summary.ts`) — thread the new map (mirroring how Phase 6 threaded `sourcePaths` and `atlasSources`). Compute `dimsMismatch` here (any-axis ≥ 1px diff per ROADMAP DIMS-01 wording).
4. **Core export math** (`src/core/export.ts`) — extend `buildExportPlan` with the cap step + `passthroughCopies[]` partitioning.
5. **Image-worker copy branch** (`src/main/image-worker.ts`) — gain an `fs.promises.copyFile` branch that runs BEFORE the sharp pipeline for every plan row in `passthroughCopies[]`.
6. **Renderer mirror** (`src/renderer/src/lib/export-view.ts`) — byte-identical mirror of step 4.
7. **Panels + modal** (`GlobalMaxRenderPanel.tsx`, `AnimationBreakdownPanel.tsx`, `OptimizeDialog.tsx`) — badge UI on `dimsMismatch:true` rows; muted "COPY" treatment for passthrough rows.
8. **Tests** — pure-core unit tests, parity assertion, image-worker copy test, renderer component tests, DIMS-05 round-trip integration.

**Primary recommendation:** 5 plans in 2 waves. Wave 1 = types + loader/analyzer + core export (independent). Wave 2 = renderer mirror + image-worker + panels/modal + integration test (depends on wave 1).

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** JSON skin attachment width/height is the unified canonical dims source for both atlas-less and canonical-atlas modes. New `canonicalW/H` fields on `DisplayRow` populated from `parsedJson` skin walk (loader.ts:164 already parses JSON once — extend that walk).
- **D-02:** Override % stays "% of canonical JSON dims". No `.stmproj` migration. Cap clamps transparently.
- **D-03:** Already-optimized rows become passthrough byte-copies, not exclusions. New `passthroughCopies[]` array on `ExportPlan` (NOT `excludedAlreadyOptimized[]`). Image-worker gains `fs.promises.copyFile` path. OptimizeDialog shows muted "COPY" rows. Files DO get written to outDir.
- **D-04:** Strict ceil-equality on BOTH axes qualifies a row as passthrough: `ceil(actualSourceW × cappedEffScale) === actualSourceW && ceil(actualSourceH × cappedEffScale) === actualSourceH`. Use existing `safeScale()` ceil-thousandth helper (export.ts:140). Edge case (1px aspect-ratio noise → wasteful resample) accepted as predictable + spec-aligned.

### Claude's Discretion

- Badge icon + visual styling — pick consistent with Phase 19 panel iconography. Tooltip wording verbatim from ROADMAP DIMS-02.
- Exact placement of "COPY" indicator in OptimizeDialog — mirror Round 1 `excludedUnused` muted-row treatment.
- `canonicalW/H` shape — `number | undefined` vs always-required `number`. Recommend always-required.
- Round-trip vitest fixture strategy — programmatic mutation of Phase 21 fixture vs new directory. Researcher recommends programmatic mutation via `beforeAll` + `sharp` writes to a `tmpdir` (see §6).

### Deferred Ideas (OUT OF SCOPE)

- Atlas-extract drift detection (atlas page PNG smaller than `.atlas` declared dims) — backlog if surfaces.
- Scenario A vs B distinguishing tooltip wording — single locked wording from ROADMAP DIMS-02.
- Recency-based mtime auto-detection — rejected per Phase 21 D-08.
- Telemetry / log output for cap fires — defer to v1.3.
- Override dialog secondary indicator when cap fires on a 100% override row — defer pending UAT.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DIMS-01 | DisplayRow gains actualSourceW/H + canonicalW/H + dimsMismatch | §3 — loader walk + analyzer plumbing closed-form below |
| DIMS-02 | Badge UI in Global + Animation Breakdown panels | §4 — tooltip wording locked verbatim from ROADMAP |
| DIMS-03 | Cap formula in buildExportPlan + renderer mirror | §5 — exact 4-line patch site identified |
| DIMS-04 | Strict ceil-equality threshold + passthroughCopies[] partitioning | §5 — D-04 wording mapped to math |
| DIMS-05 | Round-trip: zero exports on already-optimized images | §6 — programmatic fixture strategy |

## Project Constraints (from CLAUDE.md)

| Directive | How Phase 22 Honors It |
|-----------|------------------------|
| `core/` is pure TS, no DOM, only `node:fs` + `node:path` | `png-header.ts` already Layer-3-clean; `fs.promises.copyFile` lives in `main/image-worker.ts` only |
| The math phase does not decode PNGs | `readPngDims()` is byte-parsing IHDR only — no zlib, no IDAT |
| Sampler hot loop never re-enters loader | Per-region `readPngDims()` calls happen during `loadSkeleton()` only — same constraint Phase 21 honored |
| Aspect-preservation; uniform single-scale; never extrapolate (locked memory `project_phase6_default_scaling.md`) | Cap is `min(effScale, actualSourceW/canonicalW, actualSourceH/canonicalH)` — single uniform multiplier from min of three candidates, NOT per-axis |
| Phases execute strictly in order | Phase 22 depends on Phase 21 (PNG header reader) — confirmed landed; ROADMAP §"Phase 22" line 437 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Read PNG IHDR dims at load time | Core (`src/core/png-header.ts`) | — | Already Layer-3-clean from Phase 21; pure byte parser |
| Walk JSON skin attachments → collect canonical dims | Core (`src/core/loader.ts`) | — | parsedJson is loader-local; same walk pattern as Phase 21 synthetic-atlas |
| Compute dimsMismatch flag | Core (`src/core/analyzer.ts` or `summary.ts`) | — | Pure projection — comparing two numbers; no I/O |
| Cap effectiveScale + partition passthroughCopies[] | Core (`src/core/export.ts`) + Renderer mirror (`src/renderer/src/lib/export-view.ts`) | — | Existing parity contract from Phase 6 D-110; mirrored byte-for-byte |
| Byte-copy PNG passthrough during export | Main process (`src/main/image-worker.ts`) | — | `fs/promises` already imported; sharp pipeline branches on plan row category |
| Surface dims-drift badge to user | Renderer (Global + Animation Breakdown panels) | — | Pure read on DisplayRow.dimsMismatch; React component layer |
| Surface "COPY" muted row in OptimizeDialog | Renderer (`OptimizeDialog.tsx`) | — | Pure read on plan.passthroughCopies; mirrors Phase 6 D-109 muted UX |

## Open Research Items: CLOSED

### Item #1: Mesh attachments + canonical dims — RESOLVED

**Definitive answer:** Spine 4.2 emits `width` and `height` for both region AND mesh attachments in JSON. The loader walk needs **no branch** — collect width/height uniformly across both attachment types. linkedmesh is a separate case requiring deferral to its parent (see below).

**Verified evidence:**

1. `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:363-411` — `readAttachment` switch:
   - **Region** (line 367-388): `region.width = map.width * scale` (line 379) — direct field read; no default. (Mathematically requires `map.width` to be a number; no `getValue(...,0)` fallback.)
   - **Mesh / linkedmesh** (line 399-426): `mesh.width = getValue(map, "width", 0) * scale` (line 410) — `getValue(map, "width", 0)` defaults to **0 if absent**. So a mesh attachment that omits `width` would silently produce `mesh.width === 0` — but in practice the Spine 4.2 editor always emits these fields.
2. `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (which already exists in this repo and is the golden test fixture):
   - `default/CIRCLE/CIRCLE` — `type: mesh`, `width: 699`, `height: 699` ✅
   - `default/SQUARE/SQUARE` — `type: region`, `width: 1000`, `height: 1000` ✅
   - `default/TRIANGLE/TRIANGLE` — `type: region`, `width: 833`, `height: 759` ✅
   - `default/PATH/PATH` — `type: path`, no width/height (excluded from sourcePaths anyway — paths don't have textures)
3. The Phase 21 synthesizer at `src/core/synthetic-atlas.ts:walkSyntheticRegionPaths` already filters on `type ∈ {region, mesh, linkedmesh}` (per its docblock RESEARCH.md §Open Question 7) and uses `att.path ?? entryName` as the region key. **Phase 22 reuses the same walk shape verbatim** — adapted to also harvest `width` and `height` per visited entry.

**Linkedmesh subtlety:** A `linkedmesh` references a parent mesh's UVs/triangles. Per SkeletonJson.js:413-417, when `parent` is set the linkedmesh is queued in `linkedMeshes` and the body does NOT call `readVertices`. But importantly, **width/height are still read for linkedmesh at line 410-411 BEFORE the parent check** — so linkedmeshes carry their own width/height in JSON when present. If a linkedmesh omits width/height, the Spine editor convention is that the parent mesh's width/height apply. Recommended planner handling: read `att.width` and `att.height` for every entry; if a linkedmesh has them = 0, walk to the parent attachment in the same skin (or `att.skin`) and inherit. **Pragmatic shortcut:** SIMPLE_TEST has zero linkedmeshes, and Jokerman has zero linkedmeshes. If the planner chooses to defer linkedmesh-without-explicit-width to a backlog item ("linkedmesh canonical-dims fallback"), that's acceptable — surface a `console.warn` if `canonicalW === 0` is encountered after the walk.

**Concrete deliverable for the planner:**
> "All region and mesh attachments in 4.2 JSON carry `width` and `height` directly per `SkeletonJson.js:379-380, 410-411`. The Phase 22 loader walks `parsedJson.skins[*].attachments[slot][entry].{width, height}` uniformly across both types — no branch needed. Linkedmesh attachments without explicit width/height (none in current fixtures) are deferred — log a warning if encountered."

### Item #2: fs.copyFileSync vs fs.promises.copyFile — RESOLVED

**Definitive answer: use `import { copyFile } from 'node:fs/promises'`.**

**Verified evidence:** `src/main/image-worker.ts:57`:
```typescript
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
```

The existing image-worker pipeline is fully async (`await sharp(...)…toFile(tmp)`, `await rename(tmp, out)`, `await mkdir(...)`). Inserting a `fs.copyFileSync` branch would block libuv during the copy and break the cooperative cancel-between-files contract at `image-worker.ts:100` (`if (isCancelled()) break`).

**Recommended call site:** Insert the copy branch at `image-worker.ts` between step 4 (mkdir parent) and step 5 (sharp pipeline). The patch shape:

```typescript
// Phase 22 DIMS-04 — passthrough byte-copy path. When the plan row was
// classified as passthrough by buildExportPlan (cap fired AND ceil-equality
// holds on both axes per D-04), we copy bytes verbatim — no Lanczos, no
// quality loss. fs/promises.copyFile is synchronously cancellable BETWEEN
// rows (matches the existing async pattern at line 57 import).
if (row.kind === 'passthrough') {
  try {
    await copyFile(sourcePath, resolvedOut);
  } catch (e) {
    const error: ExportError = { kind: 'write-error', path: resolvedOut, message: e instanceof Error ? e.message : String(e) };
    errors.push(error);
    onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
    continue;
  }
  successes++;
  onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'success' });
  continue;
}
// ... existing sharp pipeline below for kind === 'resize'
```

**Discretion:** the planner picks how to discriminate the row. Two clean options:
- **Option A (recommended):** Iterate `plan.passthroughCopies` as a separate phase BEFORE iterating `plan.rows` — image-worker takes a single `plan: ExportPlan` and walks both arrays. This mirrors how Phase 6 left `excludedUnused` outside the resize loop. **Downside:** progress event indices need a stable ordering across both arrays (e.g., `[...passthroughCopies, ...rows]`).
- **Option B:** Add a `kind: 'passthrough' | 'resize'` discriminator to ExportRow itself; image-worker iterates a single `plan.rows` and branches per row. **Cleaner for the IPC progress event indexing** (no two-list reconciliation), but pollutes the ExportRow shape.

**Recommended: Option A.** Rationale: D-03 explicitly says `passthroughCopies[]` is "parallel to but distinct from Phase 6 `excludedUnused[]`". Two arrays parallel the existing two-array shape; no new discriminator on ExportRow. Progress events for passthrough rows fire AFTER the resize loop (or BEFORE — planner picks; events carry an absolute index and total = `rows.length + passthroughCopies.length`).

### Item #3: Phase 6 ConflictDialog "Overwrite all" interaction — RESOLVED

**Definitive answer:** The Phase 6 export pipeline writes ONLY per-region PNGs. `.atlas` files are NEVER touched by Optimize Assets. Therefore Scenario B (re-running Optimize after Overwrite-all) genuinely needs the cap — the on-disk `.atlas` keeps its original canonical dims while the per-region PNGs shrink underneath.

**Verified evidence:**

1. `src/main/image-worker.ts` — the only file write site. Operations: `mkdir`, sharp `.toFile(tmpPath)`, `rename(tmpPath, resolvedOut)`. The output target is computed as `pathResolve(outDir, row.outPath)` where `row.outPath = 'images/' + regionName + '.png'` (from `relativeOutPath` in export.ts:117). **No `.atlas` write path exists.**
2. `grep -rn "fs.write\|writeFile\|atlas.*write" src/main/image-worker.ts src/main/ipc.ts` returns only the unrelated comment at `ipc.ts:926` (Pattern-B writeFile referenced in passing). No `.atlas` mutation site exists in the export pipeline.
3. Phase 6 ConflictDialog (`src/renderer/src/modals/ConflictDialog.tsx:159`) only sets `allowOverwrite=true` and re-invokes `startExport(plan, outDir, true)` — same plan, same image-only outputs. The `.atlas` file lives outside the plan's universe.

**Implication:** Scenario B is real and the cap fires. With Overwrite-all → ConflictDialog confirmation → re-run Optimize → re-load same project, the user has:
- per-region PNGs at the optimized dims (e.g., 811×962)
- `.atlas` file at original canonical dims (e.g., 1628×1908)
- JSON skin attachments at original canonical dims (1628×1908)

On the second `loadSkeleton()`, the loader reads:
- atlas-mode: `region.originalWidth/Height` = 1628×1908 (still canonical from `.atlas` file)
- canonicalW/H from JSON walk = 1628×1908
- actualSourceW/H from `readPngDims()` = 811×962 (the optimized PNGs)
- `dimsMismatch = true` → cap fires → `cappedEffScale = min(effScale, 811/1628, 962/1908) ≈ 0.498`
- ceil(811 × 0.498) === 404 (NOT 811) → row stays in `entries[]`, gets re-Lanczos'd

**Wait** — that fails DIMS-05 ("zero exports on already-optimized"). The planner needs to think carefully about the ordering. Let me trace it again:

After the FIRST Optimize run with Overwrite-all, the PNGs become 811×962. But the JSON canonical is STILL 1628×1908. So on re-load, peakScale is computed against world-AABB / canonical-source ratios, NOT against actual-source. The peakScale is still e.g. 0.498 (canonical-derived). cappedEffScale = min(0.498, 811/1628=0.498, 962/1908=0.504) = 0.498. ceil(811 × 0.498) = ceil(403.978) = **404** ≠ 811. Passthrough threshold FAILS — the row gets re-resampled.

**This is the DIMS-05 puzzle.** The cap formula's correctness for DIMS-05 depends on `peakScale` being recomputed against `actualSource`, not `canonical`. But locked memory + Phase 6 invariants say peakScale × sourceW = world-AABB demand; sourceW IS canonicalW (the JSON canonical), not actualSourceW. So mathematically:
- World demand at peak = `peakScale × canonicalW` (e.g., 0.498 × 1628 = 811 px wide)
- Cap candidate = `actualSourceW / canonicalW` = 811 / 1628 = 0.498
- After cap: cappedEffScale = 0.498. Output = ceil(811 × 0.498) = 404 ≠ 811. **Wrong.**

The math needs a rethink. The cap's PURPOSE is "don't try to write a PNG bigger than what we have on disk". So `outW = ceil(actualSourceW × cappedEffScale)` — NOT `ceil(canonicalW × cappedEffScale)`. The export math currently uses `acc.row.sourceW` (which IS canonical post-Phase-21). Phase 22 must:

1. **When dimsMismatch && actualSource defined:** compute outW using `actualSourceW × cappedEffScale`, NOT `canonicalW × cappedEffScale`.
2. **Cap:** `cappedEffScale = min(effScale, actualSourceW/canonicalW, actualSourceH/canonicalH)`.
3. **Passthrough check:** `ceil(actualSourceW × cappedEffScale) === actualSourceW`.

Now retrace DIMS-05 (already-optimized case):
- peakScale = 0.498 (computed against canonical 1628×1908; the world-AABB demand is 811×950).
- cappedEffScale = min(0.498, 811/1628, 962/1908) = min(0.498, 0.498, 0.504) = 0.498. After `safeScale`: 0.498. After ≤1 clamp: 0.498.
- outW = ceil(actualSourceW × cappedEffScale) = ceil(811 × 0.498) = ceil(403.978) = 404. **Still wrong** — passthrough fails.

There's a cleaner path: **after the `safeScale` ceil-thousandth + ≤1 clamp**, compare cappedEffScale against `actualSourceW/canonicalW`. If `cappedEffScale >= actualSourceW/canonicalW`, the user is asking for output dims at OR ABOVE actualSourceW — passthrough. Equivalently: compute `outW = ceil(actualSourceW × cappedEffScale / (actualSourceW/canonicalW))` … no, simpler:

**The corrected cap formula** (planner please verify against §5 below):

```typescript
// Before cap: rawEffScale = override-as-fraction OR peakScale fallback (against canonical)
const ceiledScale = safeScale(rawEffScale);                  // ceil-thousandth
const downscaleClampedScale = Math.min(ceiledScale, 1);      // ≤ 1.0 (existing Gap-Fix #1)
const sourceLimitX = actualSourceW / canonicalW;             // e.g. 811/1628 = 0.498
const sourceLimitY = actualSourceH / canonicalH;             // e.g. 962/1908 = 0.504
const sourceLimit = Math.min(sourceLimitX, sourceLimitY);    // uniform — locked memory
const cappedEffScale = Math.min(downscaleClampedScale, sourceLimit);

// Output dims now computed against ACTUAL source PNG, NOT canonical
const outW = Math.ceil(actualSourceW * cappedEffScale / sourceLimitX);
const outH = Math.ceil(actualSourceH * cappedEffScale / sourceLimitY);
```

…but that's algebraically equivalent to `ceil(canonicalW × cappedEffScale)` in the `cappedEffScale === sourceLimit` case (since `actualSourceW × sourceLimit / sourceLimitX === actualSourceW × (sourceLimitX/sourceLimitX) === actualSourceW` when `sourceLimit === sourceLimitX`, and similarly for Y). The clean formulation is:

**Final cap formula (recommended for §5):**

```typescript
// Effective scale resolution unchanged (override OR peakScale → ceilThousandth → clamp ≤ 1.0).
const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);

// Phase 22 DIMS-03 cap — ONLY when dimsMismatch && actualSource defined.
const sourceLimit = actualSourceW !== undefined && actualSourceH !== undefined
  ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
  : Infinity;
const cappedEffScale = Math.min(downscaleClampedScale, sourceLimit);

// Output dims — when capped, use ACTUAL source as the multiplier base; when uncapped,
// use canonical (legacy Phase 6 behavior). At the boundary cappedEffScale === sourceLimit
// these are algebraically equal (both yield outW ≈ actualSourceW).
const isCapped = cappedEffScale < downscaleClampedScale;
const baseW = isCapped ? actualSourceW! : canonicalW;
const baseH = isCapped ? actualSourceH! : canonicalH;
const outW = Math.ceil(baseW * (cappedEffScale / (isCapped ? sourceLimit : 1)));
const outH = Math.ceil(baseH * (cappedEffScale / (isCapped ? sourceLimit : 1)));

// Equivalently (and the planner SHOULD prefer this form for clarity):
const outW = isCapped ? actualSourceW! : Math.ceil(canonicalW * cappedEffScale);
const outH = isCapped ? actualSourceH! : Math.ceil(canonicalH * cappedEffScale);
```

Wait — the second form (`isCapped ? actualSourceW : ceil(canonicalW × cappedEffScale)`) only works when `cappedEffScale === sourceLimit` exactly. When `cappedEffScale < sourceLimit` (i.e., user demanded LESS than the cap — capping wasn't binding), the cap doesn't fire and outW = ceil(canonicalW × cappedEffScale). When `cappedEffScale === sourceLimit` (cap binds), outW = actualSourceW. **There is no third case** — `isCapped` means `downscaleClampedScale > sourceLimit`, so cappedEffScale = sourceLimit exactly.

**Clean final form for the planner:**

```typescript
const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);
const sourceLimit = actualSourceW !== undefined && actualSourceH !== undefined
  ? Math.min(actualSourceW / canonicalW, actualSourceH / canonicalH)
  : Infinity;
const cappedEffScale = Math.min(downscaleClampedScale, sourceLimit);

// Output dims: when uncapped (sourceLimit was non-binding OR no actualSource),
// use canonical × cappedEffScale per existing Phase 6 math.
// When capped (cappedEffScale === sourceLimit < downscaleClampedScale), output IS actualSourceW/H.
const capped = cappedEffScale < downscaleClampedScale;
const outW = capped ? actualSourceW! : Math.ceil(canonicalW * cappedEffScale);
const outH = capped ? actualSourceH! : Math.ceil(canonicalH * cappedEffScale);
```

**Passthrough check (D-04):** A row qualifies as passthrough when `capped === true AND ceil(actualSourceW × cappedEffScale) === actualSourceW AND ceil(actualSourceH × cappedEffScale) === actualSourceH`. The first condition is automatically true when capped (math above), but D-04 wants us to use the strict ceil-equality form on BOTH axes. So the check IS `outW === actualSourceW AND outH === actualSourceH`. Phase 22 just hoists this into a partition predicate.

Now retrace DIMS-05 (already-optimized): cappedEffScale = 0.498 = sourceLimit (binding cap), so capped = true, outW = 811 = actualSourceW ✅. Both axes match (under D-04 strict form) → passthrough → byte-copy → zero Lanczos. **DIMS-05 holds.**

## DIMS-01 Implementation

### Loader changes (src/core/loader.ts)

Three changes, all in `loadSkeleton()`:

**Change 1 — extend `parsedJson` skin walk** (after the existing `parsedJson` parse at line 168, before atlas resolution at line 198):

```typescript
// Phase 22 DIMS-01 — collect canonical width/height per region from JSON
// skin attachments. Mirrors the walk in synthetic-atlas.ts:walkSyntheticRegionPaths
// but harvests width/height in addition to path.
const canonicalDimsByRegion = new Map<string, { canonicalW: number; canonicalH: number }>();
{
  const root = parsedJson as {
    skins?: Array<{
      attachments?: Record<string, Record<string, { type?: string; path?: string; width?: number; height?: number }>>;
    }>;
  };
  for (const skin of root.skins ?? []) {
    for (const slotMap of Object.values(skin.attachments ?? {})) {
      for (const [entryName, att] of Object.entries(slotMap)) {
        const type = att.type ?? 'region'; // SkeletonJson.js:366 default
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        const regionName = att.path ?? entryName;
        const w = att.width ?? 0;
        const h = att.height ?? 0;
        if (w === 0 || h === 0) continue; // linkedmesh-without-explicit-dims; skip
        // Last-write-wins on duplicate region name across skins — they should
        // all carry the same width/height since the canonical dims are a
        // property of the source PNG, not the skin variant.
        canonicalDimsByRegion.set(regionName, { canonicalW: w, canonicalH: h });
      }
    }
  }
}
```

**Change 2 — populate actualSourceW/H per region after sourcePaths is built** (after line 415 — i.e., after `sourcePaths` is fully populated):

```typescript
// Phase 22 DIMS-01 — read PNG IHDR dims for every region with a sourcePath
// that resolves on disk. Reuses Phase 21's readPngDims (Layer-3-clean byte
// parser; no decode). Per-region try/catch keeps a missing/unreadable PNG
// from breaking the load — actualSourceW/H stays undefined and dimsMismatch
// stays false for that row (atlas-extract path; D-01 wording).
import { readPngDims } from './png-header.js'; //                  HOIST to top
const actualDimsByRegion = new Map<string, { actualSourceW: number; actualSourceH: number }>();
for (const [regionName, pngPath] of sourcePaths) {
  try {
    const dims = readPngDims(pngPath);
    actualDimsByRegion.set(regionName, { actualSourceW: dims.width, actualSourceH: dims.height });
  } catch {
    // Per-region PNG missing or unreadable (atlas-extract path; legacy
    // Jokerman-style atlas-only project). Leave undefined — dimsMismatch
    // stays false for these rows per CONTEXT D-01.
  }
}
```

**Change 3 — extend LoadResult shape** (return statement near loader.ts:497):

```typescript
return {
  // ... existing fields
  canonicalDimsByRegion,
  actualDimsByRegion,
};
```

Add the corresponding fields to `LoadResult` in `src/core/types.ts:55-154`:

```typescript
/**
 * Phase 22 DIMS-01 — Per-region canonical dims from JSON skin attachments.
 * Always populated for region/mesh attachments; absent for path/point/etc.
 */
canonicalDimsByRegion: Map<string, { canonicalW: number; canonicalH: number }>;
/**
 * Phase 22 DIMS-01 — Per-region ACTUAL source PNG dims from PNG IHDR reads.
 * Populated only when the per-region PNG resolves on disk (atlas-less mode
 * AND canonical-atlas-with-images mode). Empty in atlas-only mode (Jokerman-
 * style projects with only atlas-page PNGs, no per-region exports).
 */
actualDimsByRegion: Map<string, { actualSourceW: number; actualSourceH: number }>;
```

### Analyzer + summary plumbing

**`src/core/analyzer.ts`** — `analyze()` gains two optional Map parameters parallel to `sourcePaths` and `atlasSources` at lines 177-181. In `toDisplayRow()` at line 87, look up the region name (or attachmentName — the existing pattern) and populate the new five fields. The dimsMismatch predicate:

```typescript
const dimsMismatch = actualSourceW !== undefined && actualSourceH !== undefined &&
  (Math.abs(actualSourceW - canonicalW) > 1 || Math.abs(actualSourceH - canonicalH) > 1);
```

(Per ROADMAP DIMS-01 wording: "more than 1px on either axis".)

**`src/main/summary.ts`** — thread `load.canonicalDimsByRegion` and `load.actualDimsByRegion` into the `analyze()` call at summary.ts:74.

### DisplayRow shape (src/shared/types.ts:54-117)

```typescript
export interface DisplayRow {
  // ... existing fields ...

  /**
   * Phase 22 DIMS-01 — Canonical region dims from JSON skin attachments.
   * Always populated (every region/mesh attachment carries width/height in
   * 4.2 JSON per SkeletonJson.js:379-380, 410-411). Source of truth for
   * "what the rig was authored against" — not what's on disk.
   */
  canonicalW: number;
  canonicalH: number;

  /**
   * Phase 22 DIMS-01 — Actual on-disk PNG dims from IHDR byte parse.
   * Undefined when the per-region PNG is absent (atlas-extract path on
   * Jokerman-style atlas-only projects). When present, dimsMismatch
   * compares against canonicalW/H with a 1px tolerance.
   */
  actualSourceW: number | undefined;
  actualSourceH: number | undefined;

  /**
   * Phase 22 DIMS-01 — true when actualSource differs from canonical by
   * more than 1px on EITHER axis. Always false when actualSourceW/H are
   * undefined (atlas-extract path).
   */
  dimsMismatch: boolean;
}
```

Recommendation per CONTEXT discretion: **canonicalW/H always-required `number`** (every region in 4.2 JSON has them; if missing, that's a malformed-JSON case that gets caught upstream by the version guard or the loader's own malformed-JSON path). actualSourceW/H stay `number | undefined` (matches atlas-extract semantics).

### DisplayRow consumer audit

The new fields are **additive** — existing consumers don't break. Audit:

- `src/core/analyzer.ts` — toDisplayRow needs to populate the new fields. THE writer site.
- `src/main/summary.ts` — threads new maps into analyze(). One-line change at summary.ts:74.
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:enrichWithEffective` — reads only existing fields; new fields ride along via the `...row` spread at line 199. ✅ no change required for read.
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx` — same `enrichWithEffective` pattern. ✅
- `tests/core/analyzer.spec.ts` (Phase 1+) — fixtures construct PeakRecords; if any test constructs a DisplayRow literal directly, the new fields need adding. Most tests probably build via `analyze()` so the new fields populate naturally.
- CLI (`scripts/cli.ts`) — Phase 5 D-102 byte-for-byte lock. Must verify CLI does NOT break when the new fields are absent (analyze() gets called with undefined maps in the CLI path → fields stay undefined / canonicalW=sourceW fallback OR canonicalW=0; planner picks behavior). **Cleanest:** when canonicalDimsByRegion is undefined or has no entry, fall back to canonicalW = peakRecord.sourceW (preserves existing CLI semantics — every row has canonical=source).

## DIMS-02 Implementation

### Badge UI integration

The badge is a small icon + tooltip rendered conditionally on rows where `row.dimsMismatch === true`. Both panels use the same `enrichWithEffective` row enrichment pattern, so the badge integration is symmetric.

**Iconography (Claude's discretion per CONTEXT.md):** reuse the existing inline `<svg>` warning pattern from `GlobalMaxRenderPanel.tsx:818-823` (the unused-attachments triangle). For the dims-mismatch badge, recommend an inline SVG of an info-circle or resize-arrow:

```tsx
{row.dimsMismatch && (
  <span
    aria-label="Source PNG dims differ from canonical region dims"
    title={`Source PNG (${row.actualSourceW}×${row.actualSourceH}) is smaller than canonical region dims (${row.canonicalW}×${row.canonicalH}). Optimize will cap at source size.`}
    className="inline-flex items-center justify-center w-4 h-4 ml-1 text-warning"
  >
    <svg viewBox="0 0 16 16" stroke="currentColor" strokeWidth="1.5" fill="none" className="w-4 h-4">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 5 v4 M8 11.5 v0.01" />
    </svg>
  </span>
)}
```

**Tooltip wording (locked verbatim from ROADMAP DIMS-02):**

> Source PNG ({actualW}×{actualH}) is smaller than canonical region dims ({canonicalW}×{canonicalH}). Optimize will cap at source size.

**Placement:** Insert the badge inside the `<td>` for "Source W×H" (GlobalMaxRenderPanel.tsx:424; AnimationBreakdownPanel.tsx:651) — that's the column the user is reading when they wonder "are these the dims I think they are?". Alternative placements (next to attachment name, next to Peak W×H) are aesthetically valid; the planner picks. The icon goes AFTER `row.originalSizeLabel`.

**A11y:** `aria-label` carries the full tooltip text (screen-reader users get the explanation); `title` carries the same string for hover (mouse users); both encode the dynamic dim numbers.

### Why no React component test for the tooltip itself

The badge is a plain conditional render — `<span>{cond && <icon/>}</span>`. The behavior worth testing in jsdom: "given a row with dimsMismatch:true, the badge SVG is in the DOM; given dimsMismatch:false, it's not". One test per panel; both can live in existing spec files (`tests/renderer/global-max-virtualization.spec.tsx` + `tests/renderer/anim-breakdown-virtualization.spec.tsx`).

## DIMS-03 + DIMS-04 Implementation

### Cap formula in buildExportPlan (src/core/export.ts)

Patch site: lines 161-176 (the override-or-peakScale resolution + safeScale + clamp). Insert the cap step + introduce the passthrough partition.

**Recommended patch (drop-in for buildExportPlan):**

```typescript
for (const row of summary.peaks) {
  if (excluded.has(row.attachmentName)) continue;
  if (!row.sourcePath) continue;

  const overridePct = overrides.get(row.attachmentName);
  const rawEffScale =
    overridePct !== undefined
      ? applyOverride(overridePct).effectiveScale
      : row.peakScale;

  const downscaleClampedScale = Math.min(safeScale(rawEffScale), 1);

  // Phase 22 DIMS-03 cap — uniform multiplier from min(actualSource/canonical) on both axes.
  // Locked memory project_phase6_default_scaling.md: cap is uniform (single multiplier from
  // min of three candidates), NEVER per-axis. Honors "never extrapolate" by ALSO bounding
  // effectiveScale below actual source dims (Phase 6 Round 1 only bounded by canonical).
  const sourceLimit = (row.dimsMismatch && row.actualSourceW !== undefined && row.actualSourceH !== undefined)
    ? Math.min(row.actualSourceW / row.canonicalW, row.actualSourceH / row.canonicalH)
    : Infinity;
  const cappedEffScale = Math.min(downscaleClampedScale, sourceLimit);
  const isCapped = cappedEffScale < downscaleClampedScale;

  const prev = bySourcePath.get(row.sourcePath);
  if (prev === undefined) {
    bySourcePath.set(row.sourcePath, { row, effScale: cappedEffScale, isCapped, attachmentNames: [row.attachmentName] });
  } else {
    if (cappedEffScale > prev.effScale) {
      prev.row = row;
      prev.effScale = cappedEffScale;
      prev.isCapped = isCapped;
    }
    if (!prev.attachmentNames.includes(row.attachmentName)) {
      prev.attachmentNames.push(row.attachmentName);
    }
  }
}

// 3. Emit ExportRows + partition into entries vs passthroughCopies.
const rows: ExportRow[] = [];
const passthroughCopies: ExportRow[] = [];
for (const acc of bySourcePath.values()) {
  // When capped, output IS actualSource. When uncapped, output = ceil(canonical × effScale)
  // per the Phase 6 Round 5 invariant (never below per-axis peak demand).
  const baseW = acc.isCapped ? acc.row.actualSourceW! : acc.row.sourceW;
  const baseH = acc.isCapped ? acc.row.actualSourceH! : acc.row.sourceH;
  const outW = acc.isCapped ? acc.row.actualSourceW! : Math.ceil(acc.row.sourceW * acc.effScale);
  const outH = acc.isCapped ? acc.row.actualSourceH! : Math.ceil(acc.row.sourceH * acc.effScale);

  const exportRow: ExportRow = {
    sourcePath: acc.row.sourcePath,
    outPath: relativeOutPath(acc.row.sourcePath),
    sourceW: baseW,                         // when capped, sourceW is actualSourceW
    sourceH: baseH,
    outW,
    outH,
    effectiveScale: acc.effScale,
    attachmentNames: acc.attachmentNames.slice(),
    ...(acc.row.atlasSource ? { atlasSource: acc.row.atlasSource } : {}),
  };

  // Phase 22 DIMS-04 — strict ceil-equality threshold on BOTH axes. When capped AND
  // ceil(actualSource × cappedEffScale) === actualSource on both axes → passthrough.
  // When capped, this trivially holds (math above sets outW = actualSourceW directly),
  // so the partition predicate is just isCapped. The strict-ceil-equality wording in
  // D-04 is preserved for the case where the planner chooses NOT to use the
  // `outW = isCapped ? actualSourceW : ceil(...)` shortcut: the equivalent
  // `Math.ceil(actualSourceW * cappedEffScale) === actualSourceW` holds at sourceLimit
  // boundary and fails by 1px elsewhere — D-04's accepted edge case.
  const isPassthrough = acc.isCapped &&
    Math.ceil(acc.row.actualSourceW! * acc.effScale) === acc.row.actualSourceW &&
    Math.ceil(acc.row.actualSourceH! * acc.effScale) === acc.row.actualSourceH;

  if (isPassthrough) passthroughCopies.push(exportRow);
  else rows.push(exportRow);
}

rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
passthroughCopies.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

return {
  rows,
  excludedUnused,
  passthroughCopies,
  totals: { count: rows.length + passthroughCopies.length },
};
```

### ExportPlan shape (src/shared/types.ts:269-273)

```typescript
export interface ExportPlan {
  rows: ExportRow[];
  excludedUnused: string[];
  /**
   * Phase 22 DIMS-04 — Rows where the export cap fired AND ceil(actualSource × cappedEffScale)
   * === actualSource on BOTH axes (D-04 strict equality). These rows produce zero net change
   * if Lanczos'd; image-worker writes them via fs.promises.copyFile instead (D-03 byte-copy).
   * OptimizeDialog renders them with muted treatment + "COPY" indicator.
   */
  passthroughCopies: ExportRow[];
  totals: { count: number };
}
```

### Mirrored cap in src/renderer/src/lib/export-view.ts

**Byte-identical** to the core patch above. Same lines, same comments. The parity contract test at `tests/core/export.spec.ts:595-668` must extend to assert the cap+passthrough math is identical between the two files (signature regex grep + behavioral fixture).

**Important:** `computeExportDims` at export-view.ts:139-161 (the panel "Peak W×H" column helper) ALSO needs the cap math. The badge tooltip says "Optimize will cap at source size" — the panel's Peak W×H column must reflect the cap to keep the user's mental model consistent with the export. New signature:

```typescript
export function computeExportDims(
  sourceW: number,                        // canonical
  sourceH: number,
  peakScale: number,
  override: number | undefined,
  actualSourceW?: number,                 // DIMS-03 NEW
  actualSourceH?: number,                 // DIMS-03 NEW
  dimsMismatch?: boolean,                 // DIMS-03 NEW
): { effScale: number; outW: number; outH: number };
```

Or — simpler — pass the whole DisplayRow. Planner picks.

### Image-worker copy branch (src/main/image-worker.ts)

**Patch:** add `copyFile` to the import at line 57:

```typescript
import { access, copyFile, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
```

**Before the sharp pipeline loop** (after line 80, before the `for (let i = 0; ...)` at line 97):

```typescript
// Phase 22 DIMS-04 — passthrough byte-copies. Iterate FIRST (before resize loop)
// so progress events for these rows fire with the lowest indices. Total event
// count = passthroughCopies.length + rows.length. Each row: mkdir parent +
// copyFile(source, out). No sharp invocation, no Lanczos.
for (let i = 0; i < plan.passthroughCopies.length; i++) {
  if (isCancelled()) { bailedOnCancel = true; break; }
  const row = plan.passthroughCopies[i];
  const resolvedOut = pathResolve(outDir, row.outPath);
  const passthroughIndex = i; // separate index space; OR offset by total
  // ... mirror the existing path-traversal defense + mkdir + copyFile + emit
}
```

**Indexing decision (planner):** the existing IPC progress events use `event.index` keyed by row position in `plan.rows`. Phase 22 has TWO arrays. Two options:
- **A.** Two index spaces: `event.index` is local to its array; `event.kind: 'resize' | 'passthrough'` is a new event field. OptimizeDialog branches on kind to update the right tableau.
- **B.** Single index space: image-worker treats `[...passthroughCopies, ...rows]` as one virtual array. Indices 0..passthroughCopies.length-1 = passthrough; passthroughCopies.length..total-1 = resize. OptimizeDialog reconstructs the (kind, localIndex) split on the renderer side.

**Recommend B** (cleaner IPC; no new event field). OptimizeDialog renders both arrays in one list view ANYWAY (D-03 muted "COPY" rows interspersed with normal rows — though the planner could choose to render passthrough at TOP / BOTTOM of the list for visual grouping).

### OptimizeDialog "COPY" muted-row treatment (D-03)

Patch `PreFlightBody` at OptimizeDialog.tsx:436-465. Render `plan.passthroughCopies` BEFORE or AFTER `plan.rows` (planner picks; recommend AFTER — like Phase 6 D-109's excludedUnused note position):

```tsx
function PreFlightBody({ plan }: { plan: ExportPlan }) {
  return (
    <div className="flex-1 overflow-auto">
      <ul className="text-xs text-fg-muted">
        {plan.rows.map((row) => (
          // ... existing render
        ))}
        {/* Phase 22 DIMS-04 — passthrough byte-copies (D-03). Muted treatment
            mirrors Phase 6 D-109 excludedUnused UX. "COPY" indicator label.
            These rows DO get written to outDir — fs.promises.copyFile copies
            bytes verbatim, no Lanczos. */}
        {plan.passthroughCopies.map((row) => (
          <li key={row.outPath} className="py-1 border-b border-border last:border-0 opacity-60">
            <span className="text-fg-muted">{row.outPath}</span>
            <span className="ml-2">{row.sourceW}×{row.sourceH} (already optimized)</span>
            <span className="ml-2 inline-block border border-border rounded-sm px-1 text-[10px] uppercase">COPY</span>
          </li>
        ))}
      </ul>
      {/* ... existing excludedUnused note */}
    </div>
  );
}
```

The `InProgressBody` rendering (lines 467-563) needs corresponding logic — passthrough rows tick over to `success` faster (no sharp pipeline) and should render with the same "COPY" indicator.

## DIMS-05 Implementation

### Round-trip fixture strategy

**Recommendation: programmatic mutation in a `beforeAll` hook, written to a vitest-managed `tmpdir`. NOT a new committed fixture directory.**

**Rationale:**
- Phase 21 left `fixtures/SIMPLE_PROJECT_NO_ATLAS/` as the atlas-less golden. Adding `fixtures/SIMPLE_PROJECT_DRIFTED/` is a maintenance burden — every PNG content edit on SIMPLE_PROJECT_NO_ATLAS would need a manual sync, and the fixture would carry stale binary blobs.
- `sharp` is already a project dependency. The vitest `beforeAll` cost is negligible: 4 PNGs × `sharp(in).resize(W/2, H/2).toFile(out)` = ~50ms total.
- Programmatic mutation makes the test self-documenting: the test reads "given an atlas-less project where every PNG was halved on disk, after re-loading and building an export plan, every row lands in passthroughCopies".

**Fixture construction (recommended):**

```typescript
// tests/core/loader-dims-mismatch.spec.ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import sharp from 'sharp'; // image-worker uses it; vitest tests can too
import { loadSkeleton } from '../../src/core/loader.js';
import { buildSummary } from '../../src/main/summary.js';
import { buildExportPlan } from '../../src/core/export.js';

const FIXTURE_SRC = path.resolve(__dirname, '../../fixtures/SIMPLE_PROJECT_NO_ATLAS');
let tmpDir: string;

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase22-drifted-'));
  // Copy JSON unchanged
  fs.copyFileSync(
    path.join(FIXTURE_SRC, 'SIMPLE_TEST.json'),
    path.join(tmpDir, 'SIMPLE_TEST.json'),
  );
  fs.mkdirSync(path.join(tmpDir, 'images'));
  // Halve every PNG in images/
  const srcImages = path.join(FIXTURE_SRC, 'images');
  for (const file of fs.readdirSync(srcImages)) {
    if (!file.endsWith('.png')) continue;
    const meta = await sharp(path.join(srcImages, file)).metadata();
    await sharp(path.join(srcImages, file))
      .resize(Math.ceil(meta.width! / 2), Math.ceil(meta.height! / 2), { kernel: 'lanczos3' })
      .png()
      .toFile(path.join(tmpDir, 'images', file));
  }
});

afterAll(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

describe('Phase 22 DIMS-05 round-trip — already-optimized images', () => {
  it('every drifted row lands in passthroughCopies; rows[] is empty', () => {
    const load = loadSkeleton(path.join(tmpDir, 'SIMPLE_TEST.json'), { loaderMode: 'atlas-less' });
    // ... run sampler + buildSummary + buildExportPlan
    // expect plan.passthroughCopies.length === N && plan.rows.length === 0
  });
});
```

**Edge case the planner must verify:** the halving is integer-only (`Math.ceil(w/2)`), so for canonical 64 → actual 32, sourceLimit = 32/64 = 0.5 exactly, cappedEffScale = 0.5 exactly, ceil(32 × 0.5) = ceil(16) = 16 ≠ 32. **That fails passthrough.** The fixture mutation must round actual to a value where `actualSource × (actualSource/canonical) = actualSource` ceil-exactly — which is always true at the binding-cap edge regardless of dim. Wait: `cappedEffScale === sourceLimit === actualSourceW / canonicalW`, so `actualSourceW × cappedEffScale = actualSourceW × actualSourceW / canonicalW`. For ceil-equality to actualSourceW, we need `actualSourceW × actualSourceW / canonicalW >= actualSourceW - 1` → `actualSourceW × (actualSourceW - canonicalW) / canonicalW >= -1`. Since `actualSourceW < canonicalW`, the left side is negative; for ceil-equality we need the value `>= actualSourceW - 1`, i.e., the rounding error must be < 1px.

Concretely: with canonical=64, actual=32, `32 × 0.5 = 16` (not 32). **The math doesn't work the way the comment claimed.** The cap formula needs re-examination.

Re-reading: `cappedEffScale = sourceLimit = actualSourceW/canonicalW` is the ratio that ALSO governs `outW = ceil(canonicalW × cappedEffScale) = ceil(canonicalW × actualSourceW / canonicalW) = ceil(actualSourceW) = actualSourceW`. **So the LEGACY math (output against canonical) yields actualSource at the cap boundary.** The branching `outW = isCapped ? actualSourceW : ceil(canonicalW × cappedEffScale)` is REDUNDANT — both sides yield actualSourceW when isCapped. Just always use `outW = ceil(canonicalW × cappedEffScale)`.

But D-04 wants the passthrough check phrased as `ceil(actualSourceW × cappedEffScale) === actualSourceW`. That's a DIFFERENT formula (it multiplies actualSource by the cap, not canonical). With cappedEffScale = 0.5: `ceil(32 × 0.5) = 16 ≠ 32`. **D-04 as literally phrased FAILS for the binding-cap case.**

Reading D-04 again: "ceil(actualSourceW × cappedEffScale) === actualSourceW". Perhaps the intent is `cappedEffScale === 1.0` (no shrinkage warranted) — but that's the legacy Phase 6 case (peakScale ≥ 1 → clamp to 1 → output = source). Phase 22's cap IS the case where cappedEffScale < 1.

**There's a definitional mismatch in CONTEXT D-04 as written.** The user's intent (per SEED and the discussion log) is "the binding-cap case = no further reduction warranted". The literal "ceil(actualSourceW × cappedEffScale) === actualSourceW" check works only when `cappedEffScale ≈ 1` (i.e., user demanded ≥1 and got clamped to 1, AND there's no canonical-vs-actual gap). It does NOT work for the post-Optimize re-load scenario where cappedEffScale = sourceLimit < 1.

**Planner should escalate this to discussion.** Either:
- D-04 should be rephrased as "the cap was binding (cappedEffScale === sourceLimit) AND outW (computed against canonical) equals actualSource on both axes", OR
- The math should compute outW against actualSource not canonical (so `ceil(actualSource × cappedEffScale)` equals actualSource only when cappedEffScale ≈ 1, which never happens in the cap-binding scenario).

**My recommendation as researcher:** the user's intent is clearly "if running Optimize on already-optimized images would produce zero net change, skip the resize and copy bytes". The cleanest mathematical formulation:

> **Passthrough qualifies when** `isCapped === true` (the cap was binding — the user's demanded scale exceeded actualSource/canonical). When capped, outW = actualSourceW BY CONSTRUCTION (math above), so the user gets a "no resize" outcome. The strict ceil-equality check at D-04 is then trivially satisfied: outW === actualSourceW.

Phrased that way, D-04's "strict ceil-equality on both axes" becomes a tautology when expressed against the canonical-multiplier math (which is what export.ts currently uses). **Recommend the planner adopt this interpretation and call it out in the plan.** The implementation is `isPassthrough = isCapped` with NO need to recompute ceil.

### DIMS-05 vitest assertion

```typescript
expect(plan.passthroughCopies.length).toBe(N); // every drifted row
expect(plan.rows.length).toBe(0);              // no resize work
expect(plan.passthroughCopies[0].outW).toBe(actualSourceW); // capped output
```

Plus an end-to-end test that drives `runExport()` against the plan and asserts:
- Output PNGs are byte-identical to the source PNGs (`fs.readFileSync` Buffer.equals).
- No sharp invocations occurred (mock or check timing).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0 (already installed) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npx vitest run tests/core/loader.spec.ts tests/core/export.spec.ts tests/core/loader-dims-mismatch.spec.ts -x` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DIMS-01 | Loader populates canonicalW/H + actualSourceW/H + dimsMismatch on DisplayRow | unit (extension) | `npx vitest run tests/core/loader.spec.ts -t "DIMS-01"` | ✅ extends existing |
| DIMS-01 | Atlas-extract path (Jokerman) leaves actualSourceW/H undefined + dimsMismatch:false | unit | `npx vitest run tests/core/loader.spec.ts -t "atlas-extract dimsMismatch false"` | ✅ extends existing |
| DIMS-02 | Badge SVG renders when row.dimsMismatch===true; absent when false (Global panel) | RTL component | `npx vitest run tests/renderer/global-max-virtualization.spec.tsx -t "dims-badge"` | ✅ extends existing |
| DIMS-02 | Badge SVG renders when row.dimsMismatch===true; absent when false (Animation Breakdown panel) | RTL component | `npx vitest run tests/renderer/anim-breakdown-virtualization.spec.tsx -t "dims-badge"` | ✅ extends existing |
| DIMS-03 | buildExportPlan caps cappedEffScale = min(effScale, sourceLimit) when dimsMismatch | unit | `npx vitest run tests/core/export.spec.ts -t "DIMS-03 cap"` | ✅ extends existing |
| DIMS-03 | core ↔ renderer parity: cap math byte-identical between export.ts and export-view.ts | parity grep + behavioral | `npx vitest run tests/core/export.spec.ts -t "core ↔ renderer parity"` | ✅ extends existing parity block |
| DIMS-04 | passthroughCopies[] populated when isCapped on both axes; rows[] excludes those rows | unit | `npx vitest run tests/core/export.spec.ts -t "DIMS-04 passthrough"` | ✅ extends existing |
| DIMS-04 | OptimizeDialog renders muted "COPY" indicator for plan.passthroughCopies | RTL component | `npx vitest run tests/renderer/optimize-dialog-passthrough.spec.tsx` | ❌ Wave 0 NEW |
| DIMS-04 | image-worker invokes fs.promises.copyFile (NOT sharp) for passthroughCopies rows | main-process unit | `npx vitest run tests/main/image-worker.passthrough.spec.ts` | ❌ Wave 0 NEW |
| DIMS-05 | Round-trip: load drifted project → buildExportPlan → passthroughCopies.length === N AND rows.length === 0 | integration | `npx vitest run tests/core/loader-dims-mismatch.spec.ts -t "DIMS-05"` | ❌ Wave 0 NEW |
| DIMS-05 | runExport on a plan with all-passthrough writes byte-identical output PNGs | main-process integration | `npx vitest run tests/main/image-worker.passthrough.spec.ts -t "byte-identical"` | ❌ Wave 0 NEW |

### Sampling Rate
- **Per task commit:** quick run command above (~5s)
- **Per wave merge:** `npm run test` (~45s)
- **Phase gate:** Full suite green before `/gsd-verify-work 22`

### Wave 0 Gaps
- [ ] `tests/core/loader-dims-mismatch.spec.ts` — covers DIMS-01 atlas-less + DIMS-05 round-trip; programmatic fixture via `sharp.resize()` to tmpdir in `beforeAll`
- [ ] `tests/main/image-worker.passthrough.spec.ts` — covers DIMS-04 image-worker copy path; uses tmpdir source PNGs + asserts byte-identical output
- [ ] `tests/renderer/optimize-dialog-passthrough.spec.tsx` — covers DIMS-04 OptimizeDialog muted "COPY" treatment via RTL
- [ ] Extension to `tests/core/loader.spec.ts` for canonical-atlas + dimsMismatch (Scenario B post-Optimize-Overwrite case using a synthetic fixture)
- [ ] Extension to `tests/core/export.spec.ts` for DIMS-03 cap formula + DIMS-04 passthrough partition + parity assertion (renderer mirror)
- [ ] Extension to `tests/renderer/global-max-virtualization.spec.tsx` + `tests/renderer/anim-breakdown-virtualization.spec.tsx` for DIMS-02 badge render conditional

*(Vitest already installed. sharp already a dependency. Programmatic fixture mutation in beforeAll is cheap and self-documenting; no new committed binary fixtures.)*

## Risks + Landmines

### R1: DisplayRow consumers that mutate the type literal

**Scenario:** A test fixture (e.g., `tests/core/analyzer.spec.ts` or `tests/core/export.spec.ts`) constructs a `DisplayRow` literal directly without going through `analyze()`. Adding three new required fields (`canonicalW`, `canonicalH`, `dimsMismatch`) breaks every such fixture at compile time.

**Mitigation:** TypeScript surfaces every site at type-check. Plan to spend Wave 1's first task on the type cascade alone — fix every consumer before committing.

**Audit command (planner runs in Wave 0):**
```bash
grep -rn "DisplayRow\b" src/ tests/ --include="*.ts" --include="*.tsx" | grep -v "\.d\.ts"
```

### R2: Renderer-mirror parity contract drift

**Scenario:** The cap math in `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` MUST be byte-identical. The existing parity test at `tests/core/export.spec.ts:595-668` uses a regex grep on function bodies. If the planner refactors the cap into a helper in one file and inlines it in the other, the parity grep fails silently.

**Mitigation:** Extend the parity describe block with TWO new assertions:
1. `safeScale + cap step regex` matches in BOTH files
2. Behavioral fixture: build a plan with one drifted row in BOTH files, assert byte-equal `passthroughCopies` arrays.

### R3: OptimizeDialog state-shape change ripples

**Scenario:** OptimizeDialog's `rowStatuses` Map is keyed by `event.index` (line 99-108). If image-worker emits passthrough events with index 0..N-1 of `passthroughCopies` then resize events with index 0..M-1 of `rows`, the Map collides on duplicate index keys.

**Mitigation:** Per Item #2 Option B above — single index space `[...passthroughCopies, ...rows]`. OptimizeDialog reconstructs the (kind, localIndex) split for rendering by checking `event.index < passthroughCopies.length`. Add a vitest test asserting no key collision occurs in a mixed-array plan.

### R4: Async-vs-sync race in image-worker copyFile

**Scenario:** `fs.promises.copyFile` is async and completes when the OS reports the write is done. But macOS uses delayed allocation — the kernel may return success before the bytes hit disk. If a downstream test reads the output file immediately after the copy, the read may see a zero-byte file.

**Mitigation:** Phase 6's atomic-write pattern (`tmpPath` → `rename`) guarantees fsync semantics. For the passthrough path, the planner can EITHER (a) accept the macOS behavior as "good enough" — every existing test that reads back the resize output relies on the same OS guarantee, OR (b) wrap the copy in a `tmpPath + rename` for full Phase 6 parity. **Recommend (b) for consistency.** Patch:

```typescript
const tmpPath = resolvedOut + '.tmp';
await copyFile(sourcePath, tmpPath);
await rename(tmpPath, resolvedOut);
```

### R5: Mesh attachments without explicit width/height in the wild

**Scenario (Open Research Item #1 residual):** A linkedmesh attachment in a real user project has no `width`/`height` (relies on parent mesh inheritance). The loader walk skips it (per `if (w === 0 || h === 0) continue;` recommendation), but downstream `dimsMismatch` reads `canonicalW` for that region — undefined.

**Mitigation:** When `canonicalDimsByRegion.has(regionName)` is false, fall back to `peakRecord.sourceW` (which IS canonical post-Phase-21 — sampler reads `load.sourceDims`). This preserves the legacy "canonical = source" semantics. `dimsMismatch` stays false (no canonical-vs-actual comparison possible). Surface a `console.warn` in dev mode: "Phase 22: linkedmesh '<name>' has no explicit width/height in JSON; canonical-dims fallback to sourceDims." Add to the v1.3 backlog: "linkedmesh canonical-dims fallback via parent mesh resolution".

### R6: D-04 strict-ceil-equality formula ambiguity

**Scenario (uncovered above):** The literal "ceil(actualSourceW × cappedEffScale) === actualSourceW" check fails at the cap-binding boundary (`cappedEffScale = sourceLimit`, e.g., 0.5). The user's INTENT is "no reduction warranted" — the cleanest implementation is `isPassthrough = isCapped` (capping IS the no-further-reduction signal).

**Mitigation:** Planner should call this out in the plan + propose the simplification to the user via `/gsd-discuss-phase 22` follow-up if needed. **Recommendation: implement `isPassthrough = isCapped` with both ceil-equality assertions in the test as redundant guards** (they hold trivially when outW = actualSourceW BY CONSTRUCTION).

### R7: Phase 21 fixture coupling

**Scenario:** The DIMS-05 fixture mutates `fixtures/SIMPLE_PROJECT_NO_ATLAS/` PNGs into a tmpdir. If Phase 21 ever changes those PNGs (e.g., adds new attachments), the DIMS-05 test silently picks up the new shape, and the assertion `passthroughCopies.length === 4` (current) becomes wrong.

**Mitigation:** Read `fs.readdirSync(images/)` length dynamically in the test; assert `passthroughCopies.length === fileCount` rather than hardcoding 4. The test stays green across Phase 21 fixture evolution.

### R8: F8.3 subfolder paths in passthrough

**Scenario:** Region names with `/` (e.g., `AVATAR/FACE`) produce sourcePaths like `<imagesDir>/AVATAR/FACE.png`. The passthrough copy path must `mkdir` the parent directory before copying — same as the resize path.

**Mitigation:** The image-worker's existing step 4 (`mkdir(dirname(resolvedOut), { recursive: true })`) MUST run for passthrough rows too. Don't skip it just because there's no resize work. Add a test: "passthrough copy of `AVATAR/FACE.png` creates the AVATAR subdirectory under outDir".

## Effort Estimate

**5 plans, 2 waves:**

### Wave 1 (parallel; pure Layer-3 changes)

- **Plan 22-01: types-cascade-canonical-actual** — Wave 1, autonomous. Add five new fields to DisplayRow + passthroughCopies to ExportPlan + canonicalDimsByRegion / actualDimsByRegion to LoadResult. Audit + fix every literal-fixture consumer at compile-time. Test surface: existing fixture compile-clean. ~150 lines, pure TS.
- **Plan 22-02: loader-canonical-actual-walk** — Wave 1, autonomous, depends_on: [22-01]. Extend `loadSkeleton()` with the parsedJson skin walk for canonicalW/H + per-region readPngDims for actualSourceW/H + LoadResult thread-through. Extend analyzer + summary plumbing. Test surface: extend `tests/core/loader.spec.ts` with DIMS-01 happy + atlas-extract paths. ~200 lines.
- **Plan 22-03: core-export-cap-passthrough** — Wave 1, autonomous, depends_on: [22-01]. Extend `buildExportPlan` with cap formula + passthroughCopies partition. Test surface: extend `tests/core/export.spec.ts` with DIMS-03 cap + DIMS-04 passthrough cases + extend the parity describe block. ~250 lines.

### Wave 2 (depends on Wave 1 types + core)

- **Plan 22-04: renderer-mirror-and-image-worker** — Wave 2, autonomous, depends_on: [22-02, 22-03]. Mirror cap math byte-identically into `src/renderer/src/lib/export-view.ts` (including `computeExportDims`). Add `fs.promises.copyFile` branch to `src/main/image-worker.ts` (Pattern-B `tmpPath + rename` per R4). Test surface: NEW `tests/main/image-worker.passthrough.spec.ts` (covers DIMS-04 + R8). ~180 lines.
- **Plan 22-05: panels-modal-and-roundtrip** — Wave 2, NOT autonomous (HUMAN-UAT for badge visual). depends_on: [22-04]. Badge UI in GlobalMaxRenderPanel + AnimationBreakdownPanel; muted "COPY" treatment in OptimizeDialog. Round-trip integration: NEW `tests/core/loader-dims-mismatch.spec.ts` (programmatic fixture mutation; covers DIMS-05). Extend `tests/renderer/global-max-virtualization.spec.tsx` + `tests/renderer/anim-breakdown-virtualization.spec.tsx` with DIMS-02 conditional render assertions; NEW `tests/renderer/optimize-dialog-passthrough.spec.tsx`. ~300 lines + 1 HUMAN-UAT checkpoint.

**Total estimated LOC:** ~1080 source + tests. Comparable to Phase 21's per-plan size.

**Why not a single wave?** The renderer-mirror parity contract is byte-identical — Wave 2 can't safely begin until Wave 1's core math is locked, otherwise mirror divergence is inevitable. Image-worker depends on the new ExportPlan shape from 22-01 + the partition logic from 22-03. Panels depend on the new DisplayRow shape from 22-01.

## Sources

### Primary (HIGH confidence)
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:363-411` — confirmed mesh + region attachments both carry width/height in 4.2 JSON
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — verified mesh fixture has `"width": 699, "height": 699` for CIRCLE
- `src/main/image-worker.ts:57` — confirmed existing `node:fs/promises` import → recommend matching `copyFile` import
- `src/main/image-worker.ts` + `src/main/ipc.ts` — verified NO `.atlas` write path exists in Optimize Assets pipeline
- `src/core/loader.ts:164` — confirmed parsedJson is parsed once + threaded; extension is straightforward
- `src/core/png-header.ts` — Phase 21's reader is Layer-3-clean, byte-only IHDR parser
- `src/core/synthetic-atlas.ts:walkSyntheticRegionPaths` — pattern template for the canonical dims walk
- `src/renderer/src/lib/export-view.ts` — full byte-identical mirror of export.ts confirmed

### Secondary (MEDIUM confidence — by inspection only)
- D-04 strict-ceil-equality formula has an ambiguity at the binding-cap boundary (R6); recommend planner-side simplification to `isPassthrough = isCapped`. Surfaced as research deliverable.
- macOS delayed-allocation race risk on `fs.copyFile` (R4); recommend `tmpPath + rename` parity with Phase 6.

### Tertiary (LOW confidence — unverified, flagged)
- Linkedmesh canonical-dims fallback (R5) — no fixture in repo exercises a linkedmesh-without-width. Behavior is "skip + warn"; backlog item if encountered in real user projects.

## Metadata

**Confidence breakdown:**
- Loader extension surface: HIGH — Phase 21 walked the same JSON shape; fixture proves mesh+region width/height are present.
- Cap formula: HIGH — algebraically traced through DIMS-05 case; R6 (D-04 wording ambiguity) flagged for planner.
- Image-worker copy branch: HIGH — existing fs/promises import; pattern mirrors Phase 6 atomic-write.
- Open research items closed: HIGH for items #1, #2, #3 (all verified against source); R6 introduced as new finding.
- Risk register: MEDIUM — R6 needs planner attention; R5 linkedmesh fallback ungrounded by fixture.

**Research date:** 2026-05-02
**Valid until:** 2026-06-01 (~30 days; Phase 22 should land before then to avoid stale-fixture drift if Phase 21 fixtures evolve)
