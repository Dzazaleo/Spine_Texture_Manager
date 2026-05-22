# Phase 49: Single-Scale Variant Export — Research

**Researched:** 2026-05-22
**Domain:** Reuse of the existing export-sizing + atlas-writer pipeline to emit a scaled-down drop-in rig variant (scaled JSON + resized textures + scaled atlas). First feature in the app's history to write a skeleton JSON.
**Confidence:** HIGH (every claim about existing code is grounded in a file:line citation read this session; the bake fidelity is PROVEN by Phase 48 + spikes 001–003)

This phase is overwhelmingly an **integration / wiring** phase, not a discovery phase. The two hard problems (the faithful bake, the sizing arithmetic) were already solved (Phase 48 `scale-bake.ts`; the existing `buildExportPlan` → worker pipeline). The research below answers exactly *where* to inject `s`, *where* the JSON write lives, and *how* the drop-in package basenames align — all against the real code.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Output Folder Layout & Naming**
- **D-01:** Per-scale subfolder under a user-chosen PARENT folder. Variant lands in `{PARENT}/{NAME}@{s}x/` with **clean basenames** — `{NAME}.json` + (atlas/both) `{NAME}.atlas` + page PNG(s) + (loose/both) `images/`. `{NAME}` = source skeleton basename so a runtime resolves `{NAME}.atlas` + `images/` as siblings of `{NAME}.json`. Forward-compatible with Phase 51 batch (sibling subfolders, no collisions).
- **D-02:** Folder-name token = `{NAME}@{s}x` (e.g. `DEMON@0.5x`, `DEMON@0.26x`). Inner basenames are NOT scale-suffixed.
- **D-03:** Pre-existing target subfolder handled by the **existing overwrite / conflict-reprobe flow** (`handleStartExport` outDir validation + conflict re-probe when `overwrite === false`, `src/main/ipc.ts:736-995`) — no new collision UX.

**Entry Point & Scale-Input Seam**
- **D-04:** NEW "Export Variant…" action, **SEPARATE from "Optimize Assets."** Reuses Optimize's config surface (output mode, atlas opts, sharpen, safety buffer, native folder picker). Shipped Optimize flow untouched.
- **D-05:** Phase 49 ships a **BASIC numeric scale field** wired to the real export so EXPORT-01 is genuinely click-to-export this phase. Phase 50 enriches the SAME control in place (two-way scale↔px). Do not over-build the input now.
- **D-06:** Dialog is a clean **SINGLE PANE** in Phase 49, structured tab-ready (no tabs yet). Rejected: tabs now; unified Optimize|Variant tabbed dialog.

**Variant Sizing & Config Inheritance**
- **D-07:** Variant inherits the user's FULL active export configuration (per-attachment overrides, safety-buffer %, sharpen, output mode, atlas opts). Textures sized at **`s × master_effectiveScale`** (override-%-of-peak applied to the `s×` scaled peak), reusing `buildExportPlan(summary, effectiveOverrides, opts)` (`src/core/export.ts:185-471`) **UNCHANGED**. Active override bucket already follows `loaderMode` via `effectiveOverrides`/`activeOverrides` (`AppShell.tsx:409-412`) — no new routing. *Mental model: a variant is your tuned export, just smaller.* Rejected: clean `s×peak` that ignores overrides/buffer.
  - *Math note:* variant row `effectiveScale = s × (master effectiveScale)`, then existing ≤1.0 clamp (`export.ts:279`) applies — for `s < 1` essentially never hit. `variant_peak = s × master_peak` is exact; **never re-sample**.

**Scale-Direction Policy**
- **D-08:** Export edge accepts `0 < s < 1`; reject `s ≥ 1` with a clear message ("variants are scaled-down — use Optimize Assets for full-size"). Core `bake()` stays direction-agnostic (Phase-48 D-09 preserved). Down-scale constraint lives ONLY at the export/UI edge. Follows `src/core/errors.ts` typed-error culture.

### Claude's Discretion
- Exact `s`-token formatting for edge factors — use the `@0.5x` / `@0.26x` style.
- **Where the bake → JSON-write → `s×`-sizing orchestration physically lives.** Pick the cleanest seam for injecting `s` (scale peak before plan-build vs multiply per-row effectiveScale by `s`) and for where `bake()` + the JSON write run (likely main-process). Keep override-%-of-peak semantics correct.
- New skeleton-JSON writer helper (name/shape) — model on atomic `.tmp` + `fs.rename` (`project-io.ts` / `atlas-writer.ts`), register paths in the shared `written` rollback Set.
- New IPC channel name / whether to extend `export:start` vs add `variant:export`.
- Toolbar placement + icon for "Export Variant…".
- Whether to add a CLI path for variant export (NOT required).

### Deferred Ideas (OUT OF SCOPE — do not research/build)
- Two-way scale↔px input + setup-pose rig-bounds reference — **Phase 50**.
- Batch (N scales → N folders) — **Phase 51**.
- Tabbed variant dialog (`Scale | Output | Batch`) — Phase 50/51.
- Unified Export dialog (Optimize | Variant tabs) — rejected (possible v1.8).
- Cross-SCALE per-attachment override behavior — Future Requirements (L-05).
- Upscaling (`s ≥ 1`) as a user feature — out of v1.7 scope.
- Variant presets / saved scale-sets / "what-if" peak preview — Future Requirements.
- CLI path for variant export — not needed for EXPORT-01.

### Locked Carry-Forwards (SEED-010 + Phase 48 — do NOT relitigate)
- **L-01:** Variant production = `bake()` (full `SkeletonJson.scale` similarity bake), NOT a bone scale. Proven field-identical 4.2 + 4.3.
- **L-02:** `variant_peak = s × master_peak` (exact). Sampler `peakScale` is invariant under the bake (measurement blind spot) — **NEVER size a variant by sampling it.**
- **L-03:** `core/` stays Layer-3 pure; `bake()` returns NEW JSON; source JSON never mutated. **First feature to WRITE a skeleton JSON** — disk-write lives in `main/`.
- **L-04:** Dual-runtime (4.2 + 4.3) + dual-mode (atlas-source + atlas-less) are hard requirements. Bake is atlas-independent; export pipeline already branches on `loaderMode`/`atlasSource`.
- **L-05:** Cross-SCALE override sharing deferred — single-scale inherits the one active config (D-07).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **EXPORT-01** | User can export a single scaled-down variant to a chosen folder as a drop-in package — scaled JSON + resized textures + (per mode) scaled atlas — usable as-is. | Toolbar action + single-pane dialog (mirror `onClickOptimize` `AppShell.tsx:783-792` + `OptimizeDialog`); orchestration extends `handleStartExport` (`ipc.ts:736-995`); §"Drop-in package layout" + §"Integration seam". |
| **EXPORT-02** | Variant texture sizes derived as `s × master_peak` by reusing `buildExportPlan` + image-worker + atlas-writer; source project never modified. | §"Research Flag 1: where to inject `s`" — proves seam (a) scaling `region.peakScale` by `s` pre-plan keeps override-%-of-peak + buffer + clamp + cap correct; source read-only is structural (bake clones, `ipc.ts:809-827` source-collision guard). |
| **EXPORT-03** | Variant export respects output mode (`loose \| atlas \| both`) — scaled JSON always-present; textures/atlas follow mode. | The whole `outputMode` dispatch matrix (`ipc.ts:910-933`) is reused unchanged; the JSON write is mode-independent (always runs). §"Output-mode coherence". |
| **EXPORT-05** | Variant export works for atlas-source + atlas-less, and 4.2 + 4.3 rigs. | §"Research Flag 7: dual-runtime correctness" — write path is runtime-agnostic (no spine-core import below the bake; bake is schema-aware per Phase 48). §"Research Flag 3: atlas-less + atlas/both coherence". |
</phase_requirements>

## Summary

Phase 49 is an orchestration phase that threads one new number (`s`), one new artifact (the baked JSON written to disk), and one new output-folder convention (`{PARENT}/{NAME}@{s}x/`) through machinery that already exists and is proven. There is **no new library, no new algorithm, and no new sizing math** — the sizing math is the existing `buildExportPlan`, and the geometry is the existing Phase-48 `bake`.

Three concrete seam decisions fall out of the code:

1. **Inject `s` by scaling each region's `peakScale` by `s` BEFORE plan-build** (a deep-cloned, `s`-scaled `SkeletonSummary`), then call `buildExportPlan(scaledSummary, effectiveOverrides, opts)` UNCHANGED. This is the *only* seam that keeps override-%-of-peak, the safety buffer, the ≤1.0 clamp, AND the source-ratio cap all simultaneously correct (proven below). The "multiply per-row `effectiveScale` by `s` after" alternative breaks the source-ratio cap and the passthrough partition.
2. **Write the baked JSON in `main/`** with a new helper modeled byte-for-byte on the `project-io.ts:233-281` atomic `.tmp`+`rename` idiom, registering both paths in the shared `written: Set<string>` (the integration point is `handleStartExport`'s rollback block at `ipc.ts:900` + `:981-984`).
3. **Align all on-disk basenames to `{NAME}` by setting `plan.skeletonPath` to a path whose basename is the source skeleton basename** and pointing the workers at the `{NAME}@{s}x/` subfolder as `outDir`. `deriveProjectName(plan, outDir)` (`atlas-paths.ts:69-90`) already keys page/atlas basenames off `plan.skeletonPath`'s basename — so the variant gets clean `{NAME}.png`/`{NAME}.atlas` for free, in BOTH loader modes, with **zero atlas-writer changes**.

**Primary recommendation:** Add a new `variant:export` IPC channel (cleaner than overloading `export:start`'s already-6-arg signature) whose handler: (1) `s`-guards (D-08, typed `VariantScaleError`), (2) reads source JSON + `bake(json, s)`, (3) computes the `{NAME}@{s}x/` subfolder under the user-picked parent, (4) writes the baked JSON atomically into it, (5) builds an `s`-scaled summary and calls `buildExportPlan` UNCHANGED, (6) dispatches `runExport`/`runRepack` into that subfolder under one shared `written` set that also covers the JSON. The renderer adds a separate "Export Variant…" toolbar button + a single-pane dialog reusing Optimize's config controls + a basic numeric scale field.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Numeric scale input (`s`) + "Export Variant…" trigger | Renderer (React) | — | UI surface; mirrors the existing Optimize button/dialog. D-04/D-05/D-06. |
| `s`-direction guard (`0 < s < 1`) | Main (IPC edge) | Renderer (cheap pre-check ok) | D-08: lives at the export edge, NOT in core. Typed error per `errors.ts`. |
| `bake(json, s)` (geometry) | Core (`scale-bake.ts`, pure) | — | L-01/L-03. Already exists, Layer-3 pure, schema-aware (4.2+4.3). |
| Reading source JSON from disk | Main | — | I/O. Core never touches fs (`arch.spec.ts:148-178`). |
| Writing baked variant JSON to disk | **Main (NEW helper)** | — | L-03: first-ever skeleton-JSON write; atomic `.tmp`+rename like `project-io.ts`. |
| `s`-scaled texture sizing | Core (`buildExportPlan`, reused) | Renderer (parity copy `export-view.ts`) | D-07: reuse `buildExportPlan` UNCHANGED via an `s`-scaled summary. |
| Texture resize / atlas pack / `.atlas` write | Main (image-worker, repack-worker, atlas-writer) | — | sharp + fs live in main. Reused unchanged. |
| `{NAME}`-keyed basename alignment | Main (`deriveProjectName` + outDir) | — | Already keyed off `plan.skeletonPath` basename. |
| Rollback of a partial variant export | Main (shared `written` Set) | — | Reuse `handleStartExport` rollback; extend to cover the JSON. |

## Standard Stack

No new dependencies. Everything required is already installed and version-pinned.

### Core (already present — verified `package.json`)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sharp` | `^0.34.5` `[VERIFIED: package.json]` | Texture resize / atlas page composite | Already the export image engine (`image-worker.ts`, `repack-worker.ts`). |
| `@esotericsoftware/spine-core` | `4.3.0` `[VERIFIED: package.json]` | 4.3 parse/sample runtime | Dual-runtime facade; **NOT touched by the variant write path** (see Flag 7). |
| `spine-core-42` (alias → `@esotericsoftware/spine-core@4.2.111`) | `4.2.111` `[VERIFIED: package.json]` | 4.2 parse/sample runtime | Ditto. |
| `node:fs/promises` (`writeFile`/`rename`/`mkdir`) | Node built-in | Atomic JSON write | Same idiom as `project-io.ts:233-281`. |

### Supporting (reused modules — no new code in these)
| Module | file:line | Reused For |
|--------|-----------|-----------|
| `bake` / `ScaleBakeError` | `src/core/scale-bake.ts:88,36` | Produce the scaled JSON (the new artifact). |
| `buildExportPlan` | `src/core/export.ts:185-471` (renderer parity `export-view.ts:277-554`) | `s`-scaled texture sizing — **call UNCHANGED**. |
| `applyOverride` | `src/core/overrides.ts:126-133` | Override-%-of-peak math (linear; see Flag 1). |
| `handleStartExport` dispatch + rollback | `src/main/ipc.ts:736-995` | Output-mode matrix + shared `written` rollback (model / partial reuse). |
| `runExport` | `src/main/image-worker.ts:89-685` | Loose PNG resize/copy into `images/`. |
| `runRepack` | `src/main/repack-worker.ts:257-680` | Atlas pack + `.atlas` write. |
| `buildAtlasText` | `src/main/atlas-writer.ts:102-170` | libgdx `.atlas` serialization — **no change needed**. |
| `deriveProjectName` / `pageFilename` | `src/main/atlas-paths.ts:69-100` | `{NAME}`-keyed basenames — **no change needed**. |
| atomic write idiom | `src/main/project-io.ts:233-281` | Model for the new JSON writer. |
| `activeOverrides` selector | `src/renderer/src/components/AppShell.tsx:409-412` | Mode-aware override bucket — reuse verbatim. |
| `OptimizeDialog` config controls | `src/renderer/src/modals/OptimizeDialog.tsx` | Output mode / atlas opts / sharpen / buffer / picker — reuse pattern. |

**Version verification:** No package added or bumped this phase, so no `npm view` needed. Installed versions confirmed via `package.json` read this session (sharp 0.34.5, spine-core 4.3.0, spine-core-42 = 4.2.111).

## Architecture Patterns

### System Architecture Diagram (variant export data flow)

```
User clicks "Export Variant…"        [renderer: AppShell toolbar — NEW button beside Optimize]
        │
        ▼
Single-pane VariantDialog            [renderer: reuse OptimizeDialog config controls + a numeric s field]
   • basic numeric scale s (D-05)
   • output mode / atlas opts / sharpen / buffer  (inherited)
        │  user clicks Export → pick PARENT folder (native picker, reuse pickOutputDir)
        ▼
window.api.exportVariant(            [preload: NEW one channel — discretion D]
   summary, s, parentDir,
   overwrite, sharpen, outputMode, atlasOpts )
        │  IPC
        ▼
handleExportVariant(...)             [main: NEW handler, models handleStartExport]
   1. guard 0<s<1 ........................ throw VariantScaleError (D-08, errors.ts culture)
   2. read source JSON (fs) ............. main only (core never reads fs)
   3. baked = bake(sourceJson, s) ....... [core: scale-bake.ts — PURE, unchanged]
   4. outDir = parentDir/{NAME}@{s}x/ ... {NAME}=basename(summary.skeletonPath)
   5. scaledSummary = scaleSummaryPeaks(summary, s)   ← Flag 1 seam (a)
   6. plan = buildExportPlan(           [core/export.ts — UNCHANGED]
        scaledSummary, effectiveOverrides,
        { skeletonPath: <NAME>.json, safetyBufferPercent })
        │
        ▼  one shared  written:Set<string>  (rollback covers ALL artifacts incl. JSON)
   7. writeSkeletonJsonAtomic(outDir/{NAME}.json, baked, written)  ← NEW, models project-io.ts
   8. dispatch by outputMode (REUSED, ipc.ts:910-933):
        loose → runExport  → outDir/images/{region}.png        [main: image-worker]
        atlas → runRepack  → outDir/{NAME}.png + {NAME}.atlas   [main: repack-worker]
        both  → runExport THEN runRepack (same written set)
        │  on ANY throw → sweep written (rm -f) → JSON rolled back too
        ▼
ExportResponse {ok, summary}  → dialog "complete" → "Open output folder" (reveal {NAME}@{s}x/)
```

The diagram's only *new* boxes are: the dialog, the IPC channel, the `s`-guard, the JSON read, the `scaleSummaryPeaks` clone, and `writeSkeletonJsonAtomic`. Every other box is existing, proven code.

### Recommended structure (where new code lands)
```
src/
├── core/
│   └── scale-bake.ts            # EXISTS (Phase 48) — bake(json,s); NO change
│   └── (no new core file needed — peak-scaling is a trivial pure transform;
│         can live in core as a pure helper OR be done in main on the summary copy)
├── main/
│   ├── variant-export.ts        # NEW (suggested) — handleExportVariant orchestration
│   ├── skeleton-json-writer.ts  # NEW (suggested) — writeSkeletonJsonAtomic (.tmp+rename)
│   ├── ipc.ts                   # register 'variant:export' channel
│   ├── errors.ts OR core/errors.ts  # VariantScaleError (D-08) — see Flag 6
│   ├── image-worker.ts          # REUSED unchanged
│   ├── repack-worker.ts         # REUSED unchanged
│   ├── atlas-writer.ts          # REUSED unchanged
│   └── atlas-paths.ts           # REUSED unchanged (deriveProjectName off skeletonPath)
├── preload/index.ts             # expose window.api.exportVariant
└── renderer/src/
    ├── modals/VariantDialog.tsx # NEW — single-pane, reuses Optimize controls + s field
    └── components/AppShell.tsx  # NEW toolbar button + onClickExportVariant + plan/scale wiring
```

### Pattern 1: Atomic same-directory `.tmp` + `fs.rename` write (the JSON writer)
**What:** Write to `<finalPath>.tmp` then `rename` to the final path; the final path only appears fully-written. Same-directory tmp avoids EXDEV cross-device rename failures.
**When to use:** The new skeleton-JSON writer (L-03) — and it MUST register both paths in `written` before the write so the rollback sweep is complete.
**Example (the model to copy):**
```typescript
// Source: src/main/project-io.ts:253-280 (and image-worker.ts:285-360 for the written-set variant)
const tmpPath = finalPath + '.tmp';
writtenPaths.add(tmpPath);          // register BEFORE write (rollback completeness)
writtenPaths.add(finalPath);
await writeFile(tmpPath, json, 'utf8');
await rename(tmpPath, finalPath);   // atomic on POSIX; best-effort on Windows (acceptable)
```
The JSON serialization is just `JSON.stringify(baked)` (the bake returns plain JSON; no relativize/migrate step — unlike `.stmproj`). Match the source file's formatting expectation: Spine editor exports are compact, but the runtime parses either; `JSON.stringify(baked)` (no indent) is the safe drop-in choice. *(ASSUMED: indentation is cosmetic and runtime-irrelevant — the spine parser ignores whitespace. Confirm only if a faithfulness diff cares about byte-shape, which it should not.)*

### Pattern 2: Shared `written: Set<string>` atomic-or-fail rollback
**What:** All workers register tmp + final paths in one `Set` before each write; the orchestrator's `catch` sweeps every entry with `fs.rm(p, { force: true })` (force swallows ENOENT, so sweeping a path whose tmp landed but final didn't, or vice-versa, is safe).
**When to use:** The variant orchestration — the JSON write joins the same set so a mid-export failure (e.g. `runRepack` oversize throw) rolls back the already-written JSON too.
**Example (the integration point):**
```typescript
// Source: src/main/ipc.ts:900 (set created) + :981-984 (sweep)
const written = new Set<string>();
try {
  // writeSkeletonJsonAtomic(jsonPath, baked, written)   ← add the JSON here, FIRST
  // if (mode==='loose'||'both') await runExport(plan, outDir, ..., written)
  // if (mode==='atlas'||'both') await runRepack(plan, outDir, ..., written)
} catch (innerErr) {
  for (const p of written) await fsRm(p, { force: true }).catch(() => {});
  throw innerErr;
}
```

### Pattern 3: `{NAME}`-keyed basenames via `deriveProjectName`
**What:** `runRepack` derives every page + `.atlas` basename from `deriveProjectName(plan, outDir)`, which reads `basename(plan.skeletonPath).replace(/\.json$/i,'')` (preferred) and falls back to the outDir basename.
**When to use:** To get clean `{NAME}.png`/`{NAME}.atlas` in the variant folder, set `plan.skeletonPath` to a path whose basename is `{NAME}` (the source skeleton basename, e.g. `DEMON.json`). Loose-mode PNGs already write to `outDir/images/{region}.png` (`image-worker.ts` joins `outDir` + `row.outPath` where `outPath = 'images/'+regionName`), so they're correct by construction.
**Example:**
```typescript
// Source: src/main/atlas-paths.ts:75-78 — basename keying
const name = basename(fromSkeleton).replace(/\.json$/i, '');  // 'DEMON' for DEMON.json
// → repack-worker writes outDir/DEMON.png + outDir/DEMON.atlas (atlas-paths.ts:97-99)
```
**Critical implication:** Pass `plan.skeletonPath = summary.skeletonPath` (the SOURCE path). Its basename is exactly `{NAME}`. Do NOT invent a scale-suffixed basename — D-02 says inner basenames are clean. The folder `{NAME}@{s}x/` carries the scale, the files do not.

### Anti-Patterns to Avoid
- **Re-sampling the baked variant to size its textures** — L-02 forbids it. `peakScale` is invariant under the bake (the bake is a similarity; the world-space ratio doesn't change), so sampling the variant returns the *master's* peakScale and would size textures at full resolution. **The arithmetic `s × master_peak` is the only correct path.**
- **Multiplying each row's `effectiveScale` by `s` AFTER plan-build.** Breaks the source-ratio cap and passthrough partition (see Flag 1 falsification). Use the pre-plan peak-scaling seam.
- **Mutating `summary` in place to scale peaks.** Must deep-clone — the live summary drives the panels and the master Optimize flow. (`scale-bake.ts` itself clones; mirror that discipline for the summary copy.)
- **Writing the JSON outside the `written` set.** A `runRepack` oversize throw would then leave an orphan `{NAME}.json` in the folder — violates atomic-or-fail.
- **Putting the `s≥1` guard in core `bake()`.** D-08 + Phase-48 D-09: core stays direction-agnostic. Guard at the export edge only.
- **Putting fs reads/writes in `core/`.** `arch.spec.ts:148-178` forbids `node:fs`/`sharp` in `src/core/**` (only `loader.ts`/`png-header.ts`/`synthetic-atlas.ts` are carved out, and those are load-time read-only). The JSON writer MUST be in `main/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scaled-down geometry | A bone/root scaler | `bake()` `scale-bake.ts:88` | Bone scaling falsified (root explodes, pivot residual) — SEED-010. |
| Texture sizing for the variant | A new `s×` sizing routine | `buildExportPlan` with an `s`-scaled summary | D-07: reuse UNCHANGED; the math (override/buffer/clamp/cap) is subtle and already correct. |
| `.atlas` text + page basenames | A variant-specific atlas writer | `buildAtlasText` + `deriveProjectName` | Already key off `plan.skeletonPath`; libgdx grammar landmines (blank-line, colon, rotate, offsets) already handled (`atlas-writer.ts:11-77`). |
| Atomic file write | `fs.writeFile` to the final path directly | `.tmp`+`rename` (`project-io.ts:253-280`) | A crash mid-write must not leave a half-written `{NAME}.json`. |
| Rollback on partial failure | Manual per-artifact cleanup | shared `written` Set sweep (`ipc.ts:900,981-984`) | force-rm swallows ENOENT; one sweep covers JSON + PNGs + atlas. |
| Output-mode dispatch | A new loose/atlas/both switch | `handleStartExport` dispatch matrix (`ipc.ts:910-933`) | Already handles all three + the merged summary + the source-collision guard. |
| Conflict/overwrite UX | New collision dialog | existing probe + ConflictDialog (`ipc.ts:859-881`, `OptimizeDialog onConfirmStart` `AppShell.tsx:814-873`) | D-03 reuses it. |

**Key insight:** The variant export is the existing export pipeline with three injected primitives (a scale `s`, a baked JSON, a subfolder name). Resist re-implementing any sizing, packing, naming, or rollback — every one already exists and is hardened by prior UAT rounds.

## Research Flags (the three named open questions + four additional)

### Research Flag 1 — Where/how to inject `s` so override-%-of-peak stays correct  [PROVEN]

**The arithmetic.** The per-row effective scale in `buildExportPlan` is (`export.ts:254-304`):
```
raw   = override !== undefined ? (clampOverride(pct)/100) * region.peakScale   // applyOverride, overrides.ts:132
                              : region.peakScale
buffered = bufferPct===0 ? raw : raw * (1 + bufferPct/100)                      // export.ts:264-265
clamped  = min(safeScale(buffered), 1)                                          // export.ts:279  (≤1.0)
sourceRatio = dimsMismatch ? min(actualSourceW/canonicalW, actualSourceH/canonicalH) : Infinity  // export.ts:300-303
effScale = min(clamped, sourceRatio)                                            // export.ts:304  (cap)
outW = ceil(canonicalW * effScale)                                             // export.ts:403
```

**We want the variant's textures sized to `s × master_peak`, with override-%-of-peak applied to the SCALED peak**, i.e. variant raw scale = `(pct/100) × (s × peak)`. Because `applyOverride` is a *linear* multiply (`overrides.ts:132`: `(safe/100) * peakScale`), the following are algebraically identical for the **raw** stage:

- Seam (a): scale `region.peakScale → s·peak` BEFORE plan-build → raw = `(pct/100)·(s·peak)`
- Seam (b): multiply post-plan `effScale` by `s` → `s·(pct/100)·peak`

Both equal `(pct/100)·s·peak`. **But the clamp and the cap are NON-linear**, so the seams diverge after the raw stage:

| Stage | Seam (a) pre-scale peak | Seam (b) post-multiply effScale | Correct? |
|-------|------------------------|--------------------------------|----------|
| raw (incl. override) | `(pct/100)·s·peak` | `(pct/100)·s·peak` | both ✓ |
| buffer | `raw·(1+b/100)` applied to scaled raw | same factor, but applied to the ALREADY-clamped/capped master effScale | (a) ✓ — buffer belongs on the scaled demand |
| ≤1.0 clamp | `min(safeScale(s·buffered), 1)` — clamps the SCALED demand (for s<1, won't bind) | `s · min(safeScale(buffered),1)` — clamps the MASTER demand first, THEN shrinks | **(a) ✓**, (b) wrong: a master row clamped to 1.0 would yield `s·1.0`, but the scaled demand might be `< s` (or `> s` if master peak > 1 and s·peak still > 1) |
| sourceRatio cap | computed from `actualSourceW/canonicalW` of the **scaled** summary — see below | computed from the MASTER summary, then the result multiplied by `s` — **double-counts / mismatched base** | **(a) ✓**, (b) wrong |
| outW | `ceil(canonicalW · effScale_a)` | `ceil(canonicalW · s · effScale_master)` — but canonicalW is the MASTER's, not scaled | needs care — see below |

**The decisive factor is the source-ratio cap + canonical base.** `buildExportPlan` computes `outW = ceil(canonicalW × effScale)` and the cap from `actualSourceW/canonicalW` (`export.ts:300-303,403`). For a faithful variant, the *texture* should be `s ×` the master's exported texture — i.e. `outW_variant = ceil((s·canonicalW_master) × effScale_master_demand)` capped by the SAME `actualSourceW/canonicalW` ratio (which is scale-invariant: `(s·actualSourceW)/(s·canonicalW) = actualSourceW/canonicalW`). Seam (a), where we scale `canonicalW`, `actualSourceW`, `sourceW`, AND `peakScale` all by `s` on the cloned summary, makes `buildExportPlan` produce exactly this — every internal base is consistently the scaled base, the cap ratio is preserved, and the clamp acts on the scaled demand. Seam (b) cannot reproduce the cap because the cap was already resolved against the master's bases.

> **NOTE on the ≤1.0 clamp & the cap for a faithful drop-in.** There is a subtlety the planner must lock with care: the master's exported PNG is itself already clamped to the master's canonical/source ceiling. A *faithful* `s×` variant wants the variant texture = `s ×` the master's *exported* dims (so it renders identically at the smaller size). That is achieved by scaling `peakScale` by `s` **and leaving canonicalW/actualSourceW at MASTER size** so the clamp/cap bind at the same absolute pixel ceiling, then the variant texture is `outW_master`-derived and the *variant's JSON* (baked at `s`) references it at `s×` smaller world dims — the proportion `JSON_dim ÷ texture_dim` is what the runtime renders, and bake scales JSON dims by `s` while leaving the texture demand to the existing clamp. **Both interpretations (scale-everything vs scale-peak-only) are defensible and produce subtly different texture sizes near the clamp/cap edges.** For `s < 1` with typical rigs the clamp/cap rarely bind (D-07 math note: "for s<1 it is essentially never hit"), so in the common case they coincide. The planner SHOULD pick ONE interpretation explicitly, write the arithmetic assertion for it (see Validation Architecture EXPORT-02), and document it. **Recommended:** scale **only `peakScale` by `s`** on the summary clone (leaving canonicalW/sourceW/actualSourceW at master size), because (i) it is the literal reading of D-07's "variant row effectiveScale = s × master effectiveScale" + "the existing ≤1.0 clamp applies", (ii) it keeps the texture at `s×` the master's *demand* clamped by the *same* source ceiling (you can never ship pixels the source PNG never had, at any scale), and (iii) the baked JSON already encodes the `s×` world-size, so the runtime render is faithful. This is `[ASSUMED — A1]`: validate against the spike fidelity bar before locking.

**Exact call site.** In the NEW main handler (or a thin pure helper), build:
```typescript
// scaledSummary = structuredClone(summary); for each row in scaledSummary.regions (and .peaks):
//   row.peakScale  *= s;  row.peakScaleX *= s;  row.peakScaleY *= s;
//   (recommended interpretation: leave canonicalW/H, sourceW/H, actualSourceW/H unchanged)
const plan = buildExportPlan(scaledSummary, effectiveOverrides, {
  skeletonPath: summary.skeletonPath,            // basename = {NAME}; drives deriveProjectName
  safetyBufferPercent,
});
```
`buildExportPlan` is called **UNCHANGED** (D-07). The override bucket is `activeOverrides` (`AppShell.tsx:409-412`), already mode-correct. **The override Map keys are `regionName` (`export.ts:252`), which are invariant under the bake** — so the same override applies to the same region in the variant.

**Where the peak-scaling runs:** It can be a pure helper in `core/` (it's a trivial JSON transform, Layer-3 safe) OR done inline in `main/` on the cloned summary. Either is fine; a tiny pure `scaleSummaryPeaks(summary, s)` in core is cleanest and unit-testable. **`[ASSUMED — A2]`: the renderer can build the `s`-scaled plan itself (mirroring `onClickOptimize`) and pass it over IPC, OR main builds it. Recommendation:** main builds it (the bake + JSON write are already main-side; building the plan there keeps `s` in one place and avoids a renderer parity copy of the peak-scaling). The planner decides (discretion).

### Research Flag 2 — Drop-in package completeness / basename alignment  [PROVEN]

**Does the baked JSON reference anything that needs rewriting? NO.** The bake (`scale-bake.ts`) scales numeric geometry (bone lengths/positions, attachment dims/vertices, constraint offsets, timeline values) and the scaled-default injections. It does **not** touch region *names* or attachment `path` strings — those are identifiers, and `constraintsOf`/the skin walk only read `.type` and scale numeric fields (`scale-bake.ts:50-59,139-162`). **Region names are invariant**, confirmed by reading the bake: there is no string rewrite anywhere. The JSON's `path:` field (the atlas region lookup key) is untouched — so it resolves against the (same-named) regions in the variant's atlas / `images/`.

**What controls on-disk basenames today?** `deriveProjectName(plan, outDir)` (`atlas-paths.ts:69-90`): PRIMARY = `basename(plan.skeletonPath)` minus `.json`; FALLBACK = outDir basename. `runRepack` uses it for `{projectName}.png`/`{projectName}_{N+1}.png` (`atlas-paths.ts:97-99`, called `repack-worker.ts:268,567,640`) and `{projectName}.atlas` (`repack-worker.ts:640`). Loose PNGs write to `outDir/images/{regionName}.png` (the `relativeOutPath` = `'images/'+regionPart`, `export.ts:167`; joined with outDir in `image-worker.ts`).

**What must be set so JSON/atlas/page basenames all align to `{NAME}`?**
1. Write the baked JSON to `outDir/{NAME}.json` where `{NAME} = basename(summary.skeletonPath, '.json')` and `outDir = parentDir/{NAME}@{s}x/`.
2. Pass `plan.skeletonPath = summary.skeletonPath` so `deriveProjectName` yields `{NAME}` → atlas mode writes `outDir/{NAME}.png` + `outDir/{NAME}.atlas`. **No atlas-writer change.**
3. Loose mode writes `outDir/images/{region}.png` automatically.

Result for `both` mode on `DEMON.json` at `s=0.5`: `parent/DEMON@0.5x/DEMON.json` + `parent/DEMON@0.5x/DEMON.png` + `parent/DEMON@0.5x/DEMON.atlas` + `parent/DEMON@0.5x/images/*.png`. All siblings.

**Runtime sibling-resolution of `images/` and the atlas page — confirmed.** A real Spine atlas's page line is a bare basename relative to the `.atlas` location: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` opens with `SIMPLE_TEST.png` (read this session). The runtime loads the page texture as a sibling of the `.atlas`. So `{NAME}.atlas` (page line `{NAME}.png`) + `{NAME}.png` co-located resolve correctly. For loose/atlas-less consumption, the JSON `path:` field maps to `images/<path>.png` (synthetic-atlas convention `synthetic-atlas.ts:147,171,186`: `<imagesDir>/<regionName>.png`), so the `images/` folder beside the JSON resolves. **Both resolutions are by-construction satisfied because the variant uses the same names + the same sibling layout as a Spine export.**

> The page name in the variant atlas is `{NAME}.png` (NOT the source's page name). `buildAtlasText` always writes `pageFilename(projectName, …)` (`atlas-writer.ts:120`), and `projectName = {NAME}`. This is correct and desired: a self-contained `{NAME}.atlas` whose page is `{NAME}.png`. The source atlas's original page name is irrelevant to the variant.

### Research Flag 3 — atlas-less + atlas/both output-mode coherence  [PROVEN]

A variant of an atlas-less source CAN repack into an atlas — this is existing behavior. `runRepack`'s `loadRegionSource` (`repack-worker.ts:108-155`) prefers the per-region PNG on disk (the atlas-less common case, `:115-120`) and falls back to atlas-page extraction only when the loose PNG is absent (`:127-154`). For an atlas-less source, the per-region PNGs exist in the source `images/`, so repack resizes them and packs a fresh `{NAME}.atlas` + `{NAME}.png`. The scaled JSON (region names invariant) + the repacked atlas (region names from `outPathToRegionName(row.outPath)`, `repack-worker.ts:323-326`, which equals the JSON `path:` field) cross-resolve.

**All three modes produce a self-consistent `{NAME}@{s}x/`:**
- `loose`: `{NAME}.json` + `images/{region}.png` (every region the JSON references is written by `runExport`).
- `atlas`: `{NAME}.json` + `{NAME}.atlas` + `{NAME}.png[ _N.png]` (every region packed; `runRepack` packs both `plan.rows` AND `plan.passthroughCopies` — `repack-worker.ts:328-500` — so no region is dropped).
- `both`: union of the above (the JSON appears once; textures appear loose AND in the atlas — same as the master's `both` behavior).

The scaled JSON is **always written** regardless of mode (it's the one always-present new artifact, EXPORT-03) — it is NOT gated on `outputMode`. The mode only gates the texture/atlas branch.

**Atlas-less + `atlas`/`both` caveat:** `runRepack` may throw the locked oversize error (`repack-worker.ts:520-522`) if a region exceeds `maxPageSize`. Because variant textures are `s×` SMALLER (s<1), oversize is *less* likely than the master — but the path is unchanged and the error rolls back via `written`. No new handling needed.

### Research Flag 4 — The new skeleton-JSON disk-write layer  [PROVEN — needs implementation]

**Where it lives:** `main/` (L-03). Confirmed there is **no skeleton-JSON write anywhere today** — the only `writeFile` calls writing JSON in main are `recent.ts:94` (recent.json), `project-io.ts:255` (.stmproj), `update-state.ts:143` (update state). None is a skeleton. This is genuinely the first.

**Model:** `project-io.ts:233-281` `writeProjectFileAtomic` (`.tmp`+`rename`) for the idiom; `image-worker.ts:285-360` for the `written`-set registration variant (register tmp + final BEFORE write).

**Shape (suggested):**
```typescript
// src/main/skeleton-json-writer.ts (NEW)
export async function writeSkeletonJsonAtomic(
  finalPath: string, baked: Record<string, unknown>, written: Set<string>,
): Promise<void> {
  const tmpPath = finalPath + '.tmp';
  written.add(tmpPath); written.add(finalPath);          // rollback completeness
  await mkdir(dirname(finalPath), { recursive: true });  // create {NAME}@{s}x/
  await writeFile(tmpPath, JSON.stringify(baked), 'utf8');
  await rename(tmpPath, finalPath);
}
```

**Exact rollback-set integration point in the orchestration:** Mirror `handleStartExport` `ipc.ts:900` (`const written = new Set<string>()`) and `:981-984` (the `catch` sweep `for (const p of written) await fsRm(p, { force: true }).catch(()=>{})`). Call `writeSkeletonJsonAtomic(jsonPath, baked, written)` **inside the same `try` that wraps `runExport`/`runRepack`, BEFORE them** (write JSON first so a texture failure rolls it back; if the JSON write itself throws, no textures were attempted). The single `catch` sweeps all.

> **Overwrite handling for the JSON:** `runExport`/`runRepack` already do per-artifact existence checks gated on `allowOverwrite` (`image-worker.ts:178-192,400-414`; `repack-worker.ts:572-581,643-652`). The JSON writer should mirror this — when `overwrite===false`, check `{NAME}.json` existence and surface the same `overwrite-source` shape (or rely on the upstream conflict probe being widened to include the JSON path; see Flag 3's D-03 reuse). **Recommendation:** widen the conflict probe to also report `{NAME}.json` so the existing ConflictDialog covers it uniformly, OR add a JSON existence check in the writer. The planner picks one; the probe-widen is more consistent with D-03.

### Research Flag 5 — Seam for `bake()` execution + IPC channel  [PROVEN — discretion]

**Where `bake(json, s)` runs:** main-process, after reading the source JSON from disk (core can't read fs). The source JSON path is `summary.skeletonPath` (`types.ts:758`), an absolute path the renderer already holds. So: `const sourceJson = JSON.parse(await readFile(summary.skeletonPath, 'utf8')); const baked = bake(sourceJson, s);`

**IPC: extend `export:start` vs add `variant:export`?**

| Option | Pros | Cons |
|--------|------|------|
| Extend `export:start` (7th+ args: `s`, `mode='variant'`) | One channel; reuses `handleStartExport` validation | `export:start` is already a 6-arg positional signature with a documented coercion ladder (`ipc.ts:1030-1047`); adding variant semantics overloads a hardened, shipped path (D-04 says "shipped Optimize flow untouched"); the variant needs the bake + JSON write + subfolder derivation that the Optimize path must NOT do |
| **NEW `variant:export` channel** (recommended) | Clean separation (D-04 "semantically different"); own validation incl. the `s`-guard; reuses `runExport`/`runRepack`/`written` internally without touching `handleStartExport`; the Optimize path stays byte-identical | One more channel + preload binding (trivial) |

**Recommendation: add `variant:export`.** It honors D-04's "separate action / shipped Optimize untouched", isolates the `s`-guard + bake + JSON write, and still reuses the worker functions (`runExport`/`runRepack` are exported and take a `written` set — `image-worker.ts:89`, `repack-worker.ts:257`). The new handler is a focused composition, not a fork of `handleStartExport`. **Final call left to the planner (discretion).**

### Research Flag 6 — Scale-direction guard (D-08)  [PROVEN]

**Where:** the export/UI edge (the new `variant:export` handler), NOT core. Core `bake()` keeps its direction-agnostic `s>0` guard (`scale-bake.ts:90`) — Phase-48 D-09 preserved.

**Typed-error shape (follow `errors.ts` culture):** `errors.ts` defines a root `SpineLoaderError extends Error` with `.name` set, and subclasses carry typed readonly fields + a human message (`errors.ts:13-18,117-179`). `ScaleBakeError` (`scale-bake.ts:36-41`) follows the same minimal shape (extend Error, set `.name`, message discriminates). For D-08:
```typescript
export class VariantScaleError extends Error {            // or extend SpineLoaderError if routed via KNOWN_KINDS
  constructor(public readonly scale: number) {
    super(`Variants are scaled-down only (0 < scale < 1). Got ${scale}. ` +
          `Use Optimize Assets to export at full size.`);
    this.name = 'VariantScaleError';
  }
}
// in handler, FIRST:
if (!Number.isFinite(s) || s <= 0 || s >= 1) {
  return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };
}
```
> **IPC routing note:** the IPC envelope routes errors by `err.name` against a `KNOWN_KINDS` set (`errors.ts:106-108` references `src/main/ipc.ts` routing). If you want a distinct renderer-visible `kind`, add `'VariantScaleError'` to that union; otherwise surface it under `kind:'Unknown'` with the typed message (the renderer displays `.message`, `errors.ts:113-115` precedent). Either is acceptable; the message is the user-facing artifact. The renderer can ALSO cheaply pre-validate the field (disable the Export button when `s<=0 || s>=1`) so the user gets immediate feedback — but the authoritative gate is main-side (defense-in-depth, mirrors `validateExportOpts` at `ipc.ts:777`).

### Research Flag 7 — Dual-runtime correctness  [PROVEN]

**Does the variant write path touch `loadSkeleton` / the runtime facade? NO.** The bake operates on the **raw parsed JSON** (`bake(json, s)` takes `Record<string, any>`, `scale-bake.ts:88`) — it imports nothing from spine-core (it can't; `arch.spec.ts:384-394` enforces purity). The write path reads the source JSON (`fs.readFile` + `JSON.parse`), bakes (pure), writes (fs), and sizes textures (`buildExportPlan` — pure, no spine-core). **`runExport`/`runRepack` use sharp on PNG pixels, not spine-core.** So the variant export **never instantiates a `Skeleton`, never calls `updateWorldTransform`, never routes through `pickRuntime`/the facade.**

**Therefore the per-runtime-entrypoint verification landmine ([[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]]) does NOT apply to the write path** — there is no runtime-pinned seam there. The 4.2-vs-4.3 difference is entirely absorbed by the bake's schema-awareness (`constraintsOf` handles both 4.3 unified `constraints[]` and 4.2 split `transform/ik/path/physics[]`, `scale-bake.ts:50-59`), which Phase 48 proved field-identical on both schemas across 8 fixtures × 3 scales.

**The ONE place a runtime IS exercised is the validation/oracle** (the faithfulness bar), which *parses* the variant JSON to assert geometric equivalence. That parse goes through the runtime facade and IS subject to the per-entrypoint concern — but it's *test* code, and the Phase-48 oracle (`tests/scale-bake.spec.ts`) already drives both runtimes (it parses via `parseAt` with the dual-runtime union, per STATE.md). Reuse that harness; no new entrypoint risk introduced by the export path itself.

> **Source-never-modified is structural, not just guarded:** `bake` clones first (`scale-bake.ts:91`, `JSON.parse(JSON.stringify(json))`), so the in-memory source object is untouched; and we only ever `readFile` the source path, never write it. The variant `outDir` is a NEW subfolder under a user-picked parent; `handleStartExport`'s existing source-collision guard (`ipc.ts:809-827` — rejects outDir === source images dir) is inherited if you reuse that validation. A test asserting source-JSON byte-equality before/after (Validation Architecture EXPORT-02) makes it explicit.

## Common Pitfalls

### Pitfall 1: Choosing the post-multiply `effScale` seam for `s`
**What goes wrong:** Multiplying each row's `effectiveScale` by `s` after `buildExportPlan` silently mis-sizes rows where the master row hit the ≤1.0 clamp or the source-ratio cap, because those non-linear operations already resolved against the master's bases.
**Why it happens:** The raw override math is linear so the seams *look* equivalent on the happy path; the divergence only appears at clamp/cap edges.
**How to avoid:** Inject `s` by scaling the summary's `peakScale` (the recommended interpretation: peak-only) BEFORE plan-build; call `buildExportPlan` unchanged. Write the arithmetic assertion in Validation Architecture.
**Warning signs:** A variant texture whose dims ≠ exactly `s × (master exported dims)` (within ceil tolerance) for a row near the clamp/cap.

### Pitfall 2: Orphan `{NAME}.json` after a texture failure
**What goes wrong:** JSON written outside the `written` set survives a `runRepack` oversize throw — the folder is left with a JSON but no/partial textures.
**Why it happens:** The JSON write is a new artifact the original rollback didn't know about.
**How to avoid:** Register the JSON's tmp+final in the SAME `written` set, write it inside the same `try`. The `catch` sweep covers it.
**Warning signs:** Manual test: force an oversize (tiny `maxPageSize`) on `atlas` mode and confirm the folder is empty afterward.

### Pitfall 3: Mutating the live `summary` to scale peaks
**What goes wrong:** The panels and the master Optimize flow read the same `summary`; scaling its peaks in place corrupts the displayed numbers and the next master export.
**Why it happens:** `summary.regions`/`summary.peaks` are object arrays; a shallow loop mutates shared objects.
**How to avoid:** Deep-clone (`structuredClone(summary)`) before scaling; or build the scaled rows into fresh objects.
**Warning signs:** Panel Peak W×H columns change after an Export Variant action.

### Pitfall 4: Scale-suffixing the inner basenames
**What goes wrong:** Writing `DEMON@0.5x.json`/`DEMON@0.5x.atlas` breaks the drop-in convention (D-02: inner basenames are clean) and the `path:`/page resolution if they drift.
**Why it happens:** Over-eager encoding of the scale into the filename.
**How to avoid:** Pass `plan.skeletonPath = summary.skeletonPath` (basename `{NAME}`). The folder `{NAME}@{s}x/` carries the scale; files stay `{NAME}.*`.
**Warning signs:** `deriveProjectName` returns a `@`-bearing name; atlas page line is `DEMON@0.5x.png`.

### Pitfall 5: Committing a new test fixture without extending the SAFE-01 denylist
**What goes wrong:** Any newly git-tracked fixture dir (e.g. a variant placeholder-PNG rig) leaks into the frozen SAFE-01 enumeration + baseline gates → post-merge RED with no golden. ([[feedback_new_committed_fixtures_need_safe01_denylist]])
**Why it happens:** SAFE-01 enumerates all tracked fixtures and demands a baseline; a new dir has none. Hit unplanned in Phases 44/46/48.
**How to avoid:** If Phase 49 commits ANY new fixture dir, add its path prefix to `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts` AS A CO-REQUIRED task in the same plan. **Prefer reusing existing committed fixtures** (DEMON, SIMPLE_PROJECT, the SCALE_BAKE_* oracle rigs, SLIDER_4_3, XTRA01/02) to avoid this entirely — they cover 4.2+4.3 and atlas-source+atlas-less.
**Warning signs:** A `git add fixtures/NEW/` in the plan without a matching denylist edit.

### Pitfall 6: Sizing the variant by sampling it (L-02 violation)
**What goes wrong:** Re-running the sampler on the baked variant returns the master's `peakScale` (invariant under the bake), sizing textures at full resolution — the variant atlas is `s×` too big.
**Why it happens:** It feels "more correct" to measure than to multiply.
**How to avoid:** NEVER sample the variant. `variant_peak = s × master_peak` arithmetic only. The bake produces the JSON; the *sizing* is pure arithmetic on the master's summary.
**Warning signs:** Any `sampleSkeleton`/`runSamplerInWorker` call in the variant export path.

## Code Examples

### Building the `s`-scaled plan (recommended seam, main-side)
```typescript
// Source pattern: src/renderer/src/components/AppShell.tsx:787-790 (onClickOptimize)
//                 + src/core/export.ts:185 (buildExportPlan, called UNCHANGED)
// Pure helper (core-safe — no fs/spine-core):
function scaleSummaryPeaks(summary: SkeletonSummary, s: number): SkeletonSummary {
  const c = structuredClone(summary);
  for (const r of c.regions) { r.peakScale *= s; r.peakScaleX *= s; r.peakScaleY *= s; }
  for (const p of c.peaks)   { p.peakScale *= s; p.peakScaleX *= s; p.peakScaleY *= s; }
  return c;  // canonicalW/H, sourceW/H, actualSourceW/H left at master size (peak-only interpretation A1)
}
const plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, {
  skeletonPath: summary.skeletonPath, safetyBufferPercent,
});
```

### The variant orchestration skeleton (main, NEW handler)
```typescript
// Source patterns: src/main/ipc.ts:736-995 (handleStartExport dispatch + rollback),
//                  src/core/scale-bake.ts:88 (bake), src/main/project-io.ts:253-280 (atomic write)
export async function handleExportVariant(evt, summary, s, parentDir, overwrite, sharpen, outputMode, atlasOpts) {
  if (!Number.isFinite(s) || s <= 0 || s >= 1)                       // D-08 guard (edge, not core)
    return { ok: false, error: { kind: 'Unknown', message: new VariantScaleError(s).message } };
  const NAME = basename(summary.skeletonPath).replace(/\.json$/i, '');
  const outDir = join(parentDir, `${NAME}@${formatScaleToken(s)}x`); // D-01/D-02 e.g. DEMON@0.5x
  const sourceJson = JSON.parse(await readFile(summary.skeletonPath, 'utf8'));
  const baked = bake(sourceJson, s);                                 // core, pure (L-01/L-03)
  const plan = buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides,
                               { skeletonPath: summary.skeletonPath, safetyBufferPercent }); // UNCHANGED (D-07)
  const written = new Set<string>();                                 // shared rollback (ipc.ts:900)
  try {
    await writeSkeletonJsonAtomic(join(outDir, `${NAME}.json`), baked, written); // NEW, FIRST
    if (outputMode === 'loose' || outputMode === 'both')
      await runExport(plan, outDir, sendProgress, () => cancel, overwrite, sharpen, written); // REUSED
    if (outputMode === 'atlas' || outputMode === 'both')
      await runRepack(plan, outDir, sendProgress, () => cancel, overwrite, sharpen, atlasOpts, written); // REUSED
    return { ok: true, summary: /* merged, ipc.ts:948-972 pattern */ };
  } catch (e) {
    for (const p of written) await fsRm(p, { force: true }).catch(() => {}); // sweep incl. JSON
    return { ok: false, error: { kind: 'Unknown', message: e instanceof Error ? e.message : String(e) } };
  }
}
```
*(Note: `effectiveOverrides`/`safetyBufferPercent`/`sendProgress`/cancel-flag plumbing mirrors `handleStartExport`; if the renderer builds the plan instead, it passes the plan over IPC and main skips `scaleSummaryPeaks`.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Scale a bone (root/pivot) to make a variant | Full `SkeletonJson.scale` similarity bake | SEED-010 (2026-05-21) | Bone scaling falsified; bake is the only faithful path. |
| Measure the variant to size textures | `variant_peak = s × master_peak` arithmetic | SEED-010 / Phase 48 | peakScale invariant-under-bake; sampling the variant is a blind spot. |
| App never writes skeleton JSON | First skeleton-JSON write (this phase, in main/) | Phase 49 | New atomic-write helper; rollback-set integration. |

**Deprecated/outdated:** none relevant — this is greenfield wiring on top of stable v1.6 export infrastructure.

## Project Constraints (from CLAUDE.md)

- **`core/` is pure TypeScript, no DOM** (Fact #5) — the bake + any peak-scaling helper stay pure; the JSON writer + bake-execution + sizing-orchestration live in `main/`. Enforced by `tests/arch.spec.ts` (`src/core/**` no `node:fs`/`sharp`/`electron`).
- **Export sizing is uniform-only on both axes** (memory `project_phase6_default_scaling`) — `buildExportPlan` already enforces this (D-110); the variant inherits it (same effScale both axes, ceil per-axis). Do not introduce anisotropic scaling.
- **`peakScale` is an invariant world-space measurement** (memory `project_peak_anchored_invariants`) — the `s`-scaling multiplies it; never re-derive by sampling.
- **The math/sizing phase does not decode PNGs** (Fact #4) — texture bytes are only touched by sharp in `runExport`/`runRepack`. The variant adds no new PNG decode.
- **Atlas-pack options are atlas-source-only / export-sizing is proportion not pixel-dimension** (memory `project_atlas_pack_options_atlas_source_only`) — the variant atlas (when an atlas-less source repacks) follows the same proportion semantics; `buildAtlasText`/`scaleSourceMeta` already handle strip-whitespace proportion.
- **Strict loaderMode separation** (memory `project_strict_loadermode_separation`) — the variant uses `activeOverrides` (the active bucket) only; no cross-bucket logic.
- **Release tags dot-separated** (CLAUDE.md) — not relevant this phase (no release work).
- **Tests: `npm run test` (vitest)** — the validation harness is vitest; the oracle reuses the Phase-48 dual-runtime parse harness.

## Runtime State Inventory

Not applicable — Phase 49 is a feature-add (writing NEW files to a NEW user-chosen folder), not a rename/refactor/migration. No stored data, live service config, OS-registered state, secrets, or build artifacts carry a string that needs migrating. The source project is read-only; the only new state is the variant package the user explicitly exports.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `sharp` (libvips) | texture resize / atlas composite | ✓ | 0.34.5 | — (already the export engine) |
| `@esotericsoftware/spine-core` | oracle parse (4.3) | ✓ | 4.3.0 | — |
| `spine-core-42` | oracle parse (4.2) | ✓ | 4.2.111 | — |
| Node `fs/promises` | JSON write | ✓ | built-in | — |
| Electron native folder picker | parent-folder pick | ✓ | (existing `pickOutputDir`) | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. No new dependency required.

## Validation Architecture

**Test framework:** vitest (`npm run test` / `npm run test:watch`). Core + main + oracle suites run headless in Node; renderer suites in jsdom. The Phase-48 oracle harness (`tests/scale-bake.spec.ts`, dual-runtime `parseAt`) is the reuse anchor for the fidelity bar.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest (run via `npm run test`) `[VERIFIED: CLAUDE.md Commands + package.json]` |
| Config file | `vitest.config.*` (existing; 141 test files green per STATE.md) |
| Quick run command | `npx vitest run tests/<targeted>.spec.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated assertion / oracle | Falsifier | File Exists? |
|--------|----------|-----------|------------------------------|-----------|--------------|
| **EXPORT-02** | `variant_peak = s × master_peak` exact (texture sizing) | unit (core) | Build master plan via `buildExportPlan(summary, ovr, opts)`; build variant plan via `buildExportPlan(scaleSummaryPeaks(summary, s), ovr, opts)`. Assert for every row: `variant.effectiveScale === safeScale(s × master_rawDemand)`-clamped per the locked interpretation; AND `variant.outW === ceil(canonicalW × variant.effScale)`. With overrides set, assert `effScale` reflects `(pct/100) × s × peak` not `s × clamp((pct/100)×peak)` only where they differ. **NO re-sampling anywhere in the path.** | A variant row whose `outW ≠` the asserted `s×` value, OR any `sampleSkeleton` call in the variant path | ❌ Wave 0 — `tests/core/variant-sizing.spec.ts` |
| **EXPORT-02** | source project never modified | integration (main) | Read source `{skeleton}.json` bytes (sha256) before; run `handleExportVariant`; read after; assert byte-identical. Assert the `bake` input object is unchanged (it clones). | Source bytes differ; or source object mutated | ❌ Wave 0 — `tests/main/variant-source-immutable.spec.ts` |
| **EXPORT-01 + EXPORT-03** | drop-in package layout per mode | integration (main, tmp outDir) | Run `handleExportVariant` for `loose`/`atlas`/`both` into a tmp parent. Assert files exist: `loose` → `{NAME}@{s}x/{NAME}.json` + `{NAME}@{s}x/images/<region>.png`×N; `atlas` → `{NAME}.json` + `{NAME}.atlas` + `{NAME}.png`; `both` → union. Assert the scaled JSON is present in ALL three. Assert NO `@`-suffix on inner basenames; folder name == `{NAME}@{s}x`. | A missing artifact for a mode; a scale-suffixed basename; JSON absent in any mode | ❌ Wave 0 — `tests/main/variant-package-layout.spec.ts` |
| **EXPORT-01** | drop-in faithfulness (cross-resolve + geometric `s×`) | oracle (dual-runtime) | (a) **Geometry:** reuse Phase-48 oracle — `parse(baked, scale=1)` field-equiv `parse(source, scale=s)` (excluding parse ids). (b) **Cross-resolve:** load the written `{NAME}@{s}x/` package via `loadSkeleton` (atlas mode: `{NAME}.atlas` page `{NAME}.png` resolves as siblings; loose: `images/` resolves) WITHOUT error; assert region names in JSON `path:` all resolve in the atlas. (c) **`s×` world-AABB:** sample the LOADED variant and assert each attachment's world-AABB == `s ×` master world-AABB (the spike 003 bar) — this samples the *package* to PROVE faithfulness, distinct from sizing (which never samples). | Geometry diverges; package fails to load / a region doesn't resolve; world-AABB ≠ `s×` master | reuse `tests/scale-bake.spec.ts` harness; ❌ new `tests/main/variant-dropin-faithful.spec.ts` |
| **EXPORT-05** | dual-runtime × dual-mode coverage | matrix (the above tests, parameterized) | Run the package-layout + faithfulness tests over the matrix below. | Any cell fails | drive existing fixtures |
| **EXPORT-03** | output-mode coherence (atlas-less repacks coherently) | integration | atlas-less source + `atlas` mode → `{NAME}.atlas` packs the per-region PNGs; scaled JSON region names == atlas region names == `outPathToRegionName`. | A region in JSON not in the atlas | covered by package-layout test on an atlas-less fixture |
| **EXPORT-01** | `s≥1` rejected (D-08) | unit (main) | `handleExportVariant(..., s=1.0)` and `s=2.0` return `ok:false` with the `VariantScaleError` message; `s=0.5` proceeds; core `bake(json, 1.0)` still SUCCEEDS (direction-agnostic, D-09 preserved). | `s≥1` accepted by the edge; or core bake rejects `s≥1` | ❌ Wave 0 — `tests/main/variant-scale-guard.spec.ts` |
| **EXPORT-01** | partial-failure rollback incl. JSON | integration | Force `runRepack` oversize (tiny `maxPageSize`) on `atlas` mode; assert the `{NAME}@{s}x/` folder contains NO `{NAME}.json` (and no partial PNG/atlas) after the throw. | Orphan `{NAME}.json` survives | ❌ Wave 0 — fold into `variant-package-layout.spec.ts` |

### Fixture Matrix (EXPORT-05) — reuse committed fixtures, NO new dirs
| | atlas-source | atlas-less (drive loaderMode='atlas-less') |
|---|---|---|
| **4.2** | `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (CIRCLE/SQUARE/TRIANGLE, TransformConstraint) | same fixture, atlas-less mode (per-region PNGs in `images/`) — **needs PNGs**; see note |
| **4.3** | a committed 4.3 rig: `fixtures/SLIDER_4_3` or `fixtures/XTRA01_4_3`/`XTRA02_4_3` (json+atlas) | same, atlas-less mode — **needs PNGs** |

> **Fixture-PNG note:** Per memory `project_rigs_committable_json_atlas_only_no_png`, the committed oracle/4.3 fixtures are json+atlas-only (no PNGs) — the math/oracle never read PNG bytes in atlas-source mode (`loader.ts` atlas-source path). BUT the **texture-resize integration tests (`runExport`/`runRepack`) DO read PNG pixels via sharp.** Two options for the planner: (1) drive the resize/package tests on `fixtures/SIMPLE_PROJECT` which HAS a real `.png` (atlas-source page extraction works), and assert sizing/geometry/cross-resolve on the json+atlas-only fixtures via the oracle (no pixel read); OR (2) add minimal placeholder PNGs for ONE 4.3 fixture **and co-extend the SAFE-01 denylist** (Pitfall 5). **Recommendation: option 1** — `SIMPLE_PROJECT` (4.2, atlas-source, real PNG) exercises the full pixel path; the 4.3 + atlas-less coverage rides the oracle/layout assertions that don't need pixels. This avoids a new committed fixture dir entirely. If full 4.3-pixel coverage is wanted, the export phases 49-51 were already flagged (memory `project_v131_shipped`) as possibly needing placeholder PNGs — that is a deliberate, denylist-co-required choice.

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/variant-sizing.spec.ts tests/main/variant-*.spec.ts` (the targeted variant suites, < 30s).
- **Per wave merge:** `npm run test` (full suite — must stay green; note the ~11 pre-existing `tests/renderer/*` MixBlend IMPORT failures are Phase-47-owned, NOT regressions, per memory `project_renderer_mixblend_preexisting_failure`).
- **Phase gate:** Full suite green (modulo the documented pre-existing renderer import failures) + `typecheck:node` 0 before `/gsd-verify-work`. CI is the authoritative signal (memory `feedback_verify_whole_ci_surface_locally`).

### Wave 0 Gaps
- [ ] `tests/core/variant-sizing.spec.ts` — covers EXPORT-02 (the `s × master_peak` exact arithmetic assertion, with + without overrides, clamp/cap edges).
- [ ] `tests/main/variant-source-immutable.spec.ts` — covers EXPORT-02 source-never-modified (sha256 before/after).
- [ ] `tests/main/variant-package-layout.spec.ts` — covers EXPORT-01/03 (per-mode files exist; clean basenames; JSON always present; rollback-leaves-nothing).
- [ ] `tests/main/variant-dropin-faithful.spec.ts` — covers EXPORT-01 faithfulness (load the package + sample + assert `s×` world-AABB; reuse Phase-48 oracle for geometry).
- [ ] `tests/main/variant-scale-guard.spec.ts` — covers EXPORT-01 D-08 (`s≥1` reject; `s=0.5` proceed; core bake still direction-agnostic).
- [ ] Possibly a `tests/arch.spec.ts` named anchor asserting the new JSON writer lives in `main/` (no `node:fs` creeps into core) — defense-in-depth, matches the Phase-48 anchor precedent (`arch.spec.ts:384-394`).
- [ ] **If any new fixture dir is committed:** co-extend `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts` in the SAME plan (Pitfall 5). *(Prefer reusing existing fixtures to avoid this.)*

## Project Skills Check

Checked `.claude/skills/` and `.agents/skills/` — **neither directory exists** in this repo (verified via the git status snapshot + no `SKILL.md` under those paths). No project-skill patterns to account for. The governing conventions are CLAUDE.md + the `tests/arch.spec.ts` purity gates + the memory landmines, all incorporated above.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The "peak-only" interpretation (scale `peakScale` by `s`, leave canonicalW/sourceW/actualSourceW at master size) is the correct reading of D-07 for the faithfulness bar. The "scale-everything" alternative differs only at clamp/cap edges (which "for s<1 essentially never bind" per D-07). | Research Flag 1 + Validation EXPORT-02 | If the alternative is intended, texture dims near a clamped/capped row would be off; the validation assertion would catch it. **Planner should lock ONE interpretation explicitly and write its assertion.** Low risk for typical s<1 rigs (clamp/cap rarely bind). |
| A2 | The renderer MAY build the `s`-scaled plan (mirroring `onClickOptimize`) and pass it over IPC, OR main builds it — both are viable; main-side is recommended. | Research Flag 1 / Flag 5 | None functional — it's a code-organization choice (discretion). If renderer builds it, a parity copy of `scaleSummaryPeaks` is needed (mirrors the `export-view.ts` parity contract). |
| A3 | `JSON.stringify(baked)` (no indentation) is an acceptable on-disk form for the baked skeleton JSON; the spine runtime ignores whitespace. | Pattern 1 / writer | Negligible — the parser is whitespace-insensitive. If a byte-shape faithfulness check is ever added (it should not be), indentation could matter. |
| A4 | Reusing `fixtures/SIMPLE_PROJECT` (real PNG) for the pixel-path tests + the json+atlas-only 4.3 fixtures for oracle/layout gives sufficient EXPORT-05 coverage without a new committed fixture dir. | Validation / Fixture Matrix | If full 4.3-pixel resize coverage is mandated, a placeholder-PNG fixture + SAFE-01 denylist edit is needed (a known, bounded cost — Pitfall 5). |
| A5 | A new `variant:export` IPC channel is cleaner than extending `export:start`; final call is the planner's (discretion D). | Research Flag 5 | None — both work; extending `export:start` risks coupling the variant's bake/JSON-write into the shipped Optimize path (which D-04 says to leave untouched). |

## Open Questions

1. **Which `s`-injection interpretation (peak-only vs scale-everything) does the faithfulness bar require?**
   - What we know: linear override math makes the raw stage identical; clamp/cap diverge; "for s<1 the clamp essentially never binds" (D-07).
   - What's unclear: whether D-07's "variant row effectiveScale = s × master effectiveScale" means scale the *demand* (peak-only, recommended A1) or scale the *post-clamp result* (scale-everything).
   - Recommendation: lock peak-only (literal reading + faithful render), write the EXPORT-02 assertion for it, and verify against the spike `s×` world-AABB bar. The planner should state the chosen interpretation in the plan's `must_haves.truths` and cite D-07.

2. **Should the conflict probe be widened to report `{NAME}.json`, or should the JSON writer do its own existence check?**
   - What we know: D-03 reuses the existing overwrite/conflict-reprobe flow; `runExport`/`runRepack` do per-artifact `allowOverwrite`-gated checks.
   - What's unclear: the probe (`probeExportConflicts`) currently enumerates loose/atlas targets, not a skeleton JSON.
   - Recommendation: widen the probe to include `{NAME}.json` for uniform ConflictDialog coverage (most consistent with D-03); OR add a JSON existence check in the writer mirroring the worker pattern. Either satisfies D-03; the planner picks one.

3. **CLI path for variant export?** (discretion) — not required for EXPORT-01 (the basic UI covers it). If it falls out cheaply (the orchestration is main-side and pure-composable), a `npm run cli` variant subcommand is possible — but it would route through `loadSkeleton` to build a summary, re-introducing the per-entrypoint verification concern ([[feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam]]) for the CLI. Recommend deferring unless trivial.

## Sources

### Primary (HIGH confidence — read this session, file:line cited inline)
- `src/core/scale-bake.ts` — `bake(json,s)` + `ScaleBakeError`; clone-first, schema-aware, pure.
- `src/core/export.ts:185-471` — `buildExportPlan`; effScale/buffer/clamp/cap/outW derivation; `skeletonPath` field.
- `src/core/overrides.ts:90-133` — `clampOverride` + `applyOverride` (linear override-%-of-peak).
- `src/core/errors.ts` — typed-error culture (root class, `.name`, typed fields).
- `src/main/ipc.ts:736-1052` — `handleStartExport` dispatch matrix + shared `written` rollback + `export:start` registration + source-collision guard.
- `src/main/image-worker.ts:89-685` — `runExport`; `written`-set registration; atomic `.tmp`+rename; atlas-extract fallback.
- `src/main/repack-worker.ts:108-680` — `runRepack`; `loadRegionSource` (loose-preferred, atlas fallback); `deriveProjectName`/`pageFilename` usage; oversize throw; `.atlas` write.
- `src/main/atlas-writer.ts:84-170` — `buildAtlasText`; page naming `{projectName}.png`/`_{N+1}.png`.
- `src/main/atlas-paths.ts:69-100` — `deriveProjectName` (basename of `plan.skeletonPath`) + `pageFilename`.
- `src/main/project-io.ts:233-281` — atomic `.tmp`+rename JSON write idiom (the model).
- `src/renderer/src/lib/export-view.ts:277-554` — renderer parity `buildExportPlan` + `computeExportDims`.
- `src/renderer/src/components/AppShell.tsx:392-412,783-792,937-938,1074-1075,2176-2180` — override buckets, `activeOverrides`, `onClickOptimize` plan-build, toolbar "Optimize Assets" button mount.
- `src/renderer/src/modals/OptimizeDialog.tsx:55-118,258-359` — config prop surface + `onConfirmStart`/`startExport` invoke.
- `src/shared/types.ts:756-878` — `SkeletonSummary` (incl. `skeletonPath:758`, `runtimeTag:801`, `peaks`/`regions`, `editorFps`).
- `tests/arch.spec.ts:148-178,384-394` — Layer-3 purity gates (core no fs/sharp; scale-bake anchor).
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (page line `SIMPLE_TEST.png`, sibling resolution) + `package.json` (sharp 0.34.5 / spine-core 4.3.0 / spine-core-42=4.2.111).
- `.planning/spikes/MANIFEST.md` — `variant_peak = s × master_peak`; peakScale invariant-under-bake; faithfulness bar (world-AABB == s×).
- `.planning/STATE.md` — Phase 48 deliverable + oracle harness + the pre-existing-renderer-failure caveat.

### Secondary (MEDIUM)
- Memory entries (landmines) incorporated: `feedback_new_committed_fixtures_need_safe01_denylist`, `feedback_verify_all_entrypoint_runtimes_of_a_perruntime_seam`, `project_rigs_committable_json_atlas_only_no_png`, `project_phase6_default_scaling`, `project_peak_anchored_invariants`, `project_strict_loadermode_separation`, `project_renderer_mixblend_preexisting_failure`, `feedback_verify_whole_ci_surface_locally`.

### Tertiary (LOW — flagged as ASSUMED)
- Interpretation choice A1 (peak-only vs scale-everything) — needs the planner's explicit lock + the spike-bar assertion. Not verifiable without running the fidelity oracle on a built variant package.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all reused modules read at file:line.
- Architecture / seam choices: HIGH — the three seam decisions are grounded in the actual control flow (deriveProjectName basename keying, written-set rollback, linear override math + non-linear clamp/cap).
- Sizing arithmetic (Flag 1): HIGH on the mechanism, MEDIUM on the interpretation lock (A1) — both interpretations coincide for typical s<1; the planner must pick one explicitly.
- Pitfalls / fixtures: HIGH — the SAFE-01 denylist + no-resample + rollback pitfalls are recurring, code-confirmed landmines.

**Research date:** 2026-05-22
**Valid until:** 2026-06-21 (30 days — stable internal infrastructure; no fast-moving external deps). Re-verify only if `buildExportPlan`/`deriveProjectName`/`handleStartExport` signatures change before planning.

## RESEARCH COMPLETE
