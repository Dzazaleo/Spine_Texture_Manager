# Phase 40: Atlas Repack Output — Research

**Researched:** 2026-05-14
**Domain:** Electron + TypeScript desktop app — sharp/libvips composition + libgdx `.atlas` text emission + `maxrects-packer` orchestration
**Confidence:** HIGH on libgdx format + maxrects-packer API + sharp idioms (all in-tree sources, no version drift); MEDIUM-HIGH on integration shape (existing repo patterns are unambiguous); LOW only on the second-order question of whether `core/repack.ts` and `core/atlas-preview.ts` share a wrapper (D-02a — deferred to planner per CONTEXT).

## Phase Requirements

| ID         | Description                                                                                  | Research Support                                                                                                  |
|------------|----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| REPACK-01  | Additive `loose \| atlas \| both` radio in OptimizeDialog; loose-mode byte-identical baseline | OptimizeDialog Output-card insertion point + onStart wiring (§File-by-File: OptimizeDialog)                       |
| REPACK-02  | `core/repack.ts` pure-TS pack-planning module                                                | MaxRectsPacker API (§maxrects-packer API Reference); core purity reaffirmed in tests/arch.spec.ts:148-160          |
| REPACK-03  | Sharp per-region transforms in `main/`; sharp-emits-truth invariant                          | image-worker.ts:528-631 resize idiom; `.metadata()` for actual emitted dims (§Sharp Composite Pipeline)            |
| REPACK-04  | libgdx `.atlas` text writer (spine-runtimes round-trip)                                      | TextureAtlas.js parser source — exact grammar in §libgdx .atlas Format Reference                                  |
| REPACK-05  | Page-PNG composite writer (multi-page on overflow)                                           | sharp `create` + `composite` pipeline (§Sharp Composite Pipeline); MaxRectsPacker auto-spawn (§API Reference)      |
| REPACK-06  | Rotation handling (user-settable, default off)                                               | maxrects-packer `allowRotation` IOption flag + rect.rot post-pack (§API Reference); sharp.rotate(90) idiom         |
| REPACK-07  | `.stmproj` additive fields (×4, no schema bump)                                              | project-file.ts:174-222 pre-massage idiom (sharpenOnExport, safetyBufferPercent, loaderMode) — §File-by-File       |
| REPACK-08  | atlas-source + atlas-less loaderMode parity on output                                        | Pack-input shape is the (post-quality-knob) ExportRow; loaderMode only gates input — see §Validation Architecture |
| REPACK-09  | Pre-pack quality knobs apply per-region                                                      | buildExportPlan signature unchanged — outW/outH from export.ts:382-438 feed packer; §File-by-File: core/repack.ts  |
| REPACK-10  | Atomic-or-fail (oversize pre-flight + mid-write rollback)                                    | image-worker.ts:295/353 `.tmp + rename` idiom; rollback list in IPC handler (§Landmines, §File-by-File: ipc.ts)    |

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** Output card layout: Stats tiles → **Output card** → Quality card → footer. Output card is a new bordered group, **mirrors** Quality-card pattern at [OptimizeDialog.tsx:437](src/renderer/src/modals/OptimizeDialog.tsx#L437).
- **D-01a** Radio `loose | atlas | both` is the FIRST control inside the Output card.
- **D-01b** 3 atlas knobs (`atlasMaxPageSize`, `atlasAllowRotation`, `atlasPadding`) are **hidden** when `loose` is selected; revealed on `atlas` or `both`. Mechanism (transition vs plain conditional render) is Claude's-discretion (D-01b deferred).
- **D-01c** `atlasMaxPageSize` is a `<select>` with options `1024 / 2048 / 4096 / 8192`, default `4096`.
- **D-01d** `atlasAllowRotation` is a checkbox with hover tooltip "Packer may rotate regions 90° for tighter packing." (Mechanism: existing `title=` attribute — see Landmines §"Tooltip primitive".)
- **D-01e** `atlasPadding` is a number input clamped to 0..16, default 2, suffix "px" — mirrors the safetyBufferPercent pattern at [OptimizeDialog.tsx:450-468](src/renderer/src/modals/OptimizeDialog.tsx#L450-L468).
- **D-02** AtlasPreviewModal stays **decoupled**. The "→ Atlas Preview" cross-nav button keeps current behavior regardless of output mode. Wiring pack-plan preview is explicitly deferred to a future phase.
- **D-03** Sibling module `src/main/repack-worker.ts` instead of inlining into image-worker.ts. image-worker.ts already does one thing (per-region resize + atomic write); atlas mode adds compose + libgdx serialization.
- **D-03a** Per-region sharp-resize step is extracted into a **shared helper** (planner picks: exported from image-worker.ts or new `src/main/sharp-resize.ts`).
- **D-03b** Separate `src/main/atlas-writer.ts` owns libgdx `.atlas` text serialization.
- **D-04** **Extend** `export:start` IPC channel with positional args `outputMode: 'loose' | 'atlas' | 'both'` and `atlasOpts: { maxPageSize, allowRotation, padding }`. Continues positional-arg precedent (`allowOverwrite` Phase 23 round 3 at [ipc.ts:703-711](src/main/ipc.ts#L703-L711); `sharpenEnabled` Phase 28).
- **D-04a** Handler dispatch: `loose → runExport only`; `atlas → runRepack only`; `both → runExport then runRepack` with **shared rollback list** (Claude-discretion: `Set<string>` accumulator + finally-block delete).
- **D-05** `ExportProgressEvent` gains additive `phase: 'resize' | 'composite'` field. Resize-phase events fire 0..N-1 (one per region); composite-phase events fire 0..P-1 (one per page).
- **D-06** Hybrid SHA256 baseline: JSON sidecar at `tests/fixtures/repack-baselines.json` + committed `.atlas` text at `tests/fixtures/repack-expected/{fixtureName}.atlas`. Page PNG bytes NOT committed.
- **D-06a** REPACK-08 parity test loads SIMPLE_TEST.json under both `loaderMode='auto'` and `loaderMode='atlas-less'`; asserts SHA256-identical `.atlas` + page PNG bytes.
- **D-07** Refresh policy: `npm run repack:refresh-baselines` script + `UPDATE_FIXTURES=1` env flag. **CI stays loud** — neither runs in CI.

### Claude's Discretion

- **D-02a** packer-sharing strategy between `core/repack.ts` and `core/atlas-preview.ts` (independent vs shared wrapper). Default lean: stay independent — different input shapes (`AtlasPreviewInput[]` vs post-quality-knob ExportRow dims) and different output shapes.
- **D-03a** Shared resize-helper location (exported from image-worker.ts vs new sibling module).
- **D-04a** Exact rollback list mechanism (`Set<string>` accumulator default).
- **D-03b** Exact `.atlas` whitespace/newline conventions inside the libgdx-compatible format.
- **D-01b** Atlas-knobs reveal mechanism (transition vs plain conditional render).
- **D-01d** Tooltip primitive for `atlasAllowRotation`.

### Deferred Ideas (OUT OF SCOPE)

- Pack-plan preview in AtlasPreviewModal (D-02 explicitly defers).
- `ExportOptions` refactor — keep positional-arg precedent in Phase 40.
- Multi-output-folder selection — atlas+page PNGs always go to same root as loose.
- Atlas filter/format/repeat as `.stmproj` fields — emitted as constants.

## Project Constraints (from CLAUDE.md)

| Directive                                                                                                | Source                  |
|----------------------------------------------------------------------------------------------------------|-------------------------|
| `core/` is pure-TS, no DOM, no sharp, no Electron imports — headless vitest-testable                     | CLAUDE.md Fact #5       |
| The **math phase** does not decode PNGs. (Phase 40 explicitly DOES decode PNGs, but only in `main/`.)    | CLAUDE.md Fact #4       |
| `fixtures/` in-repo; `temp/` is user's Spine .spine projects — gitignored                                | CLAUDE.md "Folder conv" |
| Prerelease tags: dot-separated only (`v1.5.0-rc.1`, NOT `v1.5.0-rc1`)                                    | CLAUDE.md "Release tag" |
| Phases execute strictly in order — Phase 40 closes v1.5 before `/gsd-complete-milestone v1.5`            | CLAUDE.md "GSD workflow"|

`tests/arch.spec.ts:148-160` grep-enforces the `core/` purity rule by scanning for forbidden imports — `core/repack.ts` MUST be clean of `sharp`, `node:fs`, `node:fs/promises`, `electron`. `node:path` is permitted in `core/` (project-file.ts uses it without I/O).

## Overview

Phase 40 lays a second output rail beside the existing loose-PNG path. The math (per-region pixel dims) is unchanged: `buildExportPlan` keeps its current signature, runs the three pre-pack quality knobs (`safetyBufferPercent`, `sharpenOnExport`, D-91 cap), and emits the same `ExportRow[]` shape. The atlas rail consumes those rows, runs sharp `.resize()` to produce per-region buffers, reads back the **actually emitted** width/height from each buffer (`.metadata()`), feeds those dims to a pure-TS `core/repack.ts` packer that wraps `maxrects-packer@2.7.3`, then sharp-composites the buffers onto blank pages at the packer-assigned `(x, y)` coordinates and writes a libgdx-format `.atlas` text sidecar. JSON is **not** rewritten — spine-runtimes' `AtlasReader` resolves region dims from the `.atlas`, and skeleton references are by name (memory: `project_spine_4_2_atlas_json_precedence`).

Three new modules: `src/core/repack.ts` (pack math, pure-TS), `src/main/repack-worker.ts` (sharp orchestration + atomic writes), `src/main/atlas-writer.ts` (text serializer). One module gains an extracted helper: `src/main/sharp-resize.ts` (or an export from `image-worker.ts`) factors out the per-region resize+sharpen step so both workers stay byte-aligned. Four additive `.stmproj` fields land in `ProjectFileV1` with validator pre-massage to defaults — no schema version bump (precedent: `loaderMode`, `sharpenOnExport`, `safetyBufferPercent`). The `export:start` IPC channel gains two positional args (`outputMode`, `atlasOpts`); `ExportProgressEvent` gains an additive `phase` field so resize and composite phases each have a clean 0..N-1 counter for the dialog progress bar.

**Primary recommendation:** Structure execution as Wave 0 (test scaffold + 4 `.stmproj` fields + IPC arg threading) → Wave 1 (`core/repack.ts` + `atlas-writer.ts` pure-TS modules + their vitests) → Wave 2 (`repack-worker.ts` with shared resize helper + atomic-or-fail + multi-page composite) → Wave 3 (OptimizeDialog Output card UI + onStart wiring) → Wave 4 (REPACK-08 cross-loaderMode parity + REPACK-10 oversize/rollback integration tests + SHA256 baseline refresh script). Pure-TS modules land first because they unblock the worker. The worker lands before the UI because the UI's onStart contract closes once the IPC signature is final.

## Architectural Responsibility Map

| Capability                                | Primary Tier         | Secondary Tier         | Rationale                                                                                                                  |
|-------------------------------------------|----------------------|------------------------|----------------------------------------------------------------------------------------------------------------------------|
| OptimizeDialog Output card UI + state     | Renderer (renderer/) | —                      | Pure React state + IPC dispatch. No business logic.                                                                        |
| Output-mode + atlas opts persistence      | Shared (shared/)     | Core (core/)           | Type lives in `shared/types.ts` per `loaderMode`/`sharpenOnExport` precedent; validator in `core/project-file.ts`.          |
| Pre-pack quality-knob math (unchanged)    | Core (core/)         | —                      | `buildExportPlan` in core/export.ts; signature locked.                                                                     |
| Pack-plan math (maxrects-packer)          | Core (core/)         | —                      | Pure-TS, headless-testable. CLAUDE.md Fact #5. Existing precedent: core/atlas-preview.ts.                                  |
| Sharp per-region resize                   | Main (main/)         | —                      | Sharp is a native binding; cannot run in `core/`. Existing precedent: image-worker.ts.                                     |
| Sharp per-page composite                  | Main (main/)         | —                      | Same reason; new code path.                                                                                                |
| `.atlas` text serialization               | Main (main/)         | —                      | Locked to `main/atlas-writer.ts` by D-03b. Pure-TS serializer but lives in main to keep `.atlas` writing co-located with PNG writing. (Could in principle live in `core/`, but D-03b puts it in `main/` for cohesion with the worker.) |
| IPC: `export:start` extension             | Main (main/ipc.ts)   | Preload                | Existing positional-arg precedent at ipc.ts:703.                                                                            |
| IPC: `export:progress` event extension    | Main (main/ipc.ts)   | Renderer (OptimizeDialog) | Existing one-way send pattern.                                                                                          |
| Atomic-or-fail rollback                   | Main (main/ipc.ts)   | repack-worker.ts       | Rollback list owned at IPC handler boundary (single point of truth for `both` mode spanning both workers).                  |
| Vitest pack-math tests                    | Tests (tests/core/)  | —                      | Headless Node env; sharp NOT needed for `core/repack.ts` tests.                                                            |
| Vitest sharp+pack integration tests       | Tests (tests/main/)  | —                      | Use real sharp + real fixtures, mirroring tests/main/image-worker.integration.spec.ts pattern.                              |

## Standard Stack

### Core

| Library              | Version  | Purpose                                          | Why Standard                                                                                                                              |
|----------------------|----------|--------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| `maxrects-packer`    | `2.7.3`  | 2D bin-packing algorithm                          | **Already in `package.json` dependencies.** [VERIFIED: `node_modules/maxrects-packer/package.json` shows `"version": "2.7.3"`.] In-tree consumer at `src/core/atlas-preview.ts`. |
| `sharp`              | `0.34.5` | libvips bindings for image I/O + transform        | **Already in `package.json`.** [VERIFIED] PMA auto-handled at this version + libvips 8.17 (memory: `project_pma_no_op_in_current_stack`). |
| `@esotericsoftware/spine-core` | `4.2.x` | Atlas reader (vitest round-trip test for REPACK-04) | **Already in dependencies.** Use `TextureAtlas` directly in tests to validate emitted `.atlas` parses cleanly. [VERIFIED: tests already import from this in tests/core/loader.spec.ts.] |

### Supporting

| Library      | Version | Purpose                                       | When to Use                                                                                              |
|--------------|---------|-----------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `node:crypto` | bundled | SHA256 hashing for fixture parity tests       | Use in vitest only — `createHash('sha256').update(buf).digest('hex')`. No new dep.                       |
| `node:fs/promises` | bundled | atomic-write (`.tmp` + `rename`) idiom    | Already used in image-worker.ts:295/353. Repack-worker reuses the same pattern.                          |

### Alternatives Considered

| Instead of            | Could Use                       | Tradeoff                                                                                                                       |
|-----------------------|---------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| `maxrects-packer`     | `pixi-packer`, custom bin-pack | Already in tree; pinned version; tested via atlas-preview. Switching costs > zero with no upside.                              |
| sharp `composite`     | manual raw-buffer write         | Sharp `.composite([{input, top, left}])` is the canonical idiom and handles RGBA/PMA invariants. Hand-rolling is anti-pattern. |
| In-process atlas reader  | Hand-rolled libgdx parser    | spine-core ships `TextureAtlas` for free; reusing it gives us the spec-of-record round-trip guarantee.                          |

**Version verification:**
```bash
npm view maxrects-packer version  # → 2.7.3 confirmed in package.json + node_modules
npm view sharp version            # → 0.34.5 confirmed
```

## libgdx .atlas Format Reference

### Canonical example (in-repo, hand-authored)

The repository's authoritative reference is [fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas](fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas):

```text
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

### Grammar (verbatim from spine-core 4.2 parser source)

The parser in [node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js](node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js) defines the EXACT contract our writer must satisfy. Key invariants from lines 31-200:

**Line splitter:** `text.split(/\r\n|\r|\n/)` — any line ending works.

**Page block:**
- First non-blank line of a page block is the page **filename** (no colon).
- Followed by zero or more `key:value` header lines. Known keys:
  - `size: W,H` — page dimensions
  - `filter: MIN,MAG` — filter mode (parser maps to `TextureFilter` enum; we emit `Linear,Linear`)
  - `format: FORMAT` — silently ignored by the parser (line 42-44: `// page.format = Format[tuple[0]]; we don't need format in WebGL`)
  - `repeat: x` / `y` / `xy` / `none` — wrap mode (we emit `none`, achieved by **omitting the line entirely** since `ClampToEdge` is the default at line 233)
  - `pma: true|false` — premultiplied-alpha hint (sharp 0.34 auto-handles PMA; emit `pma: false`)
- The page-fields loop **terminates** on the first line that `readEntry` returns 0 for — meaning **the first line WITHOUT a colon**. That line is then interpreted as a region name, starting the region block.

**Region block:**
- First line is the region **name** (no colon).
- Followed by zero or more `key:value` lines. Recognized region fields (from lines 58-96):
  - `xy: X,Y` — top-left position on page (DEPRECATED grouping; we use `bounds` instead)
  - `size: W,H` — region dimensions on page (DEPRECATED grouping; we use `bounds` instead)
  - `bounds: X,Y,W,H` — **combined xy+size** (modern atlas format; matches SIMPLE_TEST.atlas)
  - `offset: X,Y` — pre-trim offset within the original canvas (DEPRECATED grouping; we use `offsets`)
  - `orig: W,H` — original (pre-trim) canvas dimensions
  - `offsets: X,Y,OW,OH` — combined offset + orig (modern; emit this when offsets or orig differ from bounds)
  - `rotate: true | false | <degrees>` — `true` is normalized to 90; integers other than 0/90 are stored as `degrees`
  - `index: N` — for animation/sequence framing; default 0
- The region-fields loop **terminates** on the first line that `readEntry` returns 0 for — either:
  - A line without a colon (next region name), OR
  - A blank line (which **terminates the page** entirely; the parser sets `page = null` at line 117).

**Blank-line rule:** A blank line between pages **resets `page = null`**. A blank line WITHIN a page block (between page header and region name, or between region name and bounds) **breaks parsing** — the region name on the previous line is treated as a freshly-named page, and the bounds line will appear to be a child of an empty page header. **Therefore: emit a blank line ONLY between pages. NEVER inside a page.**

**Header entries (above first page):** Lines 102-108 silently consume any pre-page key:value lines. Our writer should NOT emit pre-page headers — start the first page line at byte 0.

**originalWidth/originalHeight defaulting:** Lines 152-155: if both `originalWidth == 0 && originalHeight == 0` after parsing, they are set to `width/height`. So omitting `orig` is **equivalent** to emitting `orig:W,H` where W,H match `bounds`. We choose to OMIT `orig`/`offsets` when offsets are 0 AND orig dims == packed dims — produces cleaner files and matches the SIMPLE_TEST.atlas precedent. (In Phase 40 atlas-output, regions are NOT trimmed of whitespace beyond what loose mode already does — D-09 / boundary §"Trimmed-region whitespace optimization beyond what loose mode already does" / SPEC out-of-scope. So `offsets` will almost always be absent.)

### Canonical writer output for Phase 40

For a non-rotated, non-trimmed region at `(x, y)` of size `(w, h)` on `{projectName}.png`:

```text
{projectName}.png
size: {pageW},{pageH}
format: RGBA8888
filter: Linear,Linear
repeat: none
{regionName}
bounds: {x},{y},{w},{h}
```

For a rotated region (when `atlasAllowRotation=true` and the packer rotated this rect):

```text
{regionName}
bounds: {x},{y},{w},{h}
rotate: true
```

⚠️ **Rotation dim convention** (lines 164-169 of TextureAtlas.js): for `degrees == 90`, the parser computes `u2 = (region.x + region.height) / page.width` and `v2 = (region.y + region.width) / page.height` — i.e. the parser reads `bounds:` as POST-rotation dims (width/height on the page after rotation). When emitting, the `bounds: w,h` after rotation are SWAPPED relative to the orig canvas dims. The packer's `rect.width/rect.height` after `rot=true` are ALREADY swapped (per MaxRectsPacker `set rot(value)` at .d.ts:97-98: *"after `rot` is set, `width/height` of this rectangle is swapped"*). So we emit `bounds: x, y, rect.width, rect.height` AS-IS from the packer — they are already post-rotation.

For multi-page output (2nd page onward, in the same `.atlas` file):

```text
{projectName}.png
size: 4096,4096
...
{regionA}
bounds: ...
{regionB}
bounds: ...
                                ← blank line resets parser to page=null
{projectName}_2.png
size: 4096,4096
...
{regionC}
bounds: ...
```

### Whitespace style — recommended (D-03b is Claude-discretion)

Match SIMPLE_TEST.atlas style — `key:value` with **no space after the colon**:

```text
size:1839,1464
filter:Linear,Linear
```

But the parser is also tolerant of `size: 1839, 1464` (with spaces) per [TextureAtlas.js readEntry @ line 222-237] which calls `.trim()` on every entry value. Either style round-trips. **Recommendation:** match SIMPLE_TEST.atlas verbatim (no spaces) for byte-for-byte regression test friendliness with `git diff`.

## maxrects-packer API Reference

Verified against `node_modules/maxrects-packer/dist/maxrects-packer.d.ts` (v2.7.3 installed).

### Constructor

```typescript
new MaxRectsPacker<T extends IRectangle = Rectangle>(
  width?: number,    // page width (default 4096)
  height?: number,   // page height (default 4096)
  padding?: number,  // gap between rects (default 0)
  options?: IOption
)
```

### IOption (with defaults from .d.ts:171-180)

```typescript
interface IOption {
  smart?: boolean;          // smart sizing — default true
  pot?: boolean;            // power-of-2 page sizes — default true
  square?: boolean;         // square page sizes — default false
  allowRotation?: boolean;  // allow 90° rotation — default false
  tag?: boolean;            // group by rect.tag — default false
  exclusiveTag?: boolean;   // tagged rects in separate bin — default true
  border?: number;          // atlas edge spacing — default 0
  logic?: PACKING_LOGIC;    // MAX_AREA | MAX_EDGE — default MAX_EDGE
}
```

### Phase 40 recommended options

```typescript
new MaxRectsPacker(
  atlasMaxPageSize,    // 1024 | 2048 | 4096 | 8192
  atlasMaxPageSize,    // square page (W===H even though `square:false`)
  atlasPadding,        // 0..16 per D-01e
  {
    smart: true,
    allowRotation: atlasAllowRotation,
    pot: false,        // we want hard 4096×4096 caps, not power-of-2 expansion
    square: false,     // we already pass W===H; square would force a different shape
    border: 0,         // padding lives on the inter-rect gap, not page edges
    // logic: PACKING_LOGIC.MAX_EDGE — default; matches atlas-preview.ts:110-116
  }
);
```

**Why `pot:false`:** the user picks `atlasMaxPageSize` as a hard ceiling. With `pot:true` the bin would expand to the next power of 2 ≥ packed extent — making `atlasMaxPageSize` a floor rather than a cap. atlas-preview.ts:113-114 already uses `pot:false, square:false` for the same reason.

### Adding rects

Two overloads on `MaxRectsPacker.add`:

```typescript
add(width: number, height: number, data: any): T;
add(rect: T): T;
```

The repository's existing consumer at [src/core/atlas-preview.ts:117-119](src/core/atlas-preview.ts#L117-L119) uses the `(width, height, data)` form. Recommend the same — passes per-region data through the packer's `data` slot for retrieval after pack.

### Reading back results

After all `.add()` calls complete, `packer.bins` is an array of `MaxRectsBin<T>` where:
- `bin.width`, `bin.height` — final fitted dimensions (≤ constructor width/height)
- `bin.rects` — array of `Rectangle` with: `x`, `y`, `width`, `height`, `rot` (boolean, true when packer rotated this rect), `data` (the `data` arg from `add`)

Reference: [atlas-preview.ts:122-148](src/core/atlas-preview.ts#L122-L148) folds `packer.bins` into the projection.

⚠️ **Rotation read-back:** When `allowRotation:true` and a rect was rotated, `rect.width` and `rect.height` are ALREADY SWAPPED (per .d.ts:97-98 docblock: *"after `rot` is set, `width/height` of this rectangle is swaped"* — typo in the upstream docs). Our `.atlas` writer should emit `bounds: x, y, rect.width, rect.height` directly without re-swapping. The `rotate: true` line in `.atlas` tells spine-runtimes the OPPOSITE: that the on-page dims are post-rotation. The grammar handles it correctly per TextureAtlas.js:164-169.

### Auto-spawn behavior on overflow

[Verified from `node_modules/maxrects-packer/lib/maxrects-packer.js:122-171`]: when a rect doesn't fit in any current bin from `_currentBinIndex` onward, the packer **automatically pushes a new bin** of `(maxWidth × maxHeight)` and adds the rect there. So **multi-page output is implicit** — just call `add()` for every region, then walk `packer.bins`.

**OversizedElementBin marker:** If a rect's `width > maxWidth` OR `height > maxHeight`, the packer creates an `OversizedElementBin` instead of a `MaxRectsBin`. For Phase 40 we **must not rely on this** — REPACK-10 mandates a pre-flight abort with the locked error string BEFORE any packing begins. Pre-flight checks every region's actual (sharp-emitted) dims against `atlasMaxPageSize`.

### Determinism

The packer sorts inputs internally by edge length (default `PACKING_LOGIC.MAX_EDGE`). Within ties, the secondary sort key is `rect.hash` if present (.d.ts:236-240: *"object has `hash` property will have more stable packing result"*). For determinism across runs with the same input set:

1. Sort the input array BEFORE adding to the packer (atlas-preview.ts:104-107 sorts by `sourcePath`, then `regionName`).
2. Optionally pass a `hash` field on each data object as a tiebreaker (low priority — sorting the input is sufficient in practice).

The Phase 40 cross-loaderMode parity test (REPACK-08) depends on this determinism: identical inputs → identical bins → SHA256-identical page PNGs.

## sharp Composite Pipeline

### Canonical idiom (verified against `node_modules/sharp/lib/composite.js`)

Build a blank RGBA8888 page of `(W × H)`, composite N pre-resized region buffers at `(top_i, left_i)`, write as PNG:

```typescript
import sharp from 'sharp';

// Step 1: build blank transparent page
const pageBuffer = await sharp({
  create: {
    width: atlasMaxPageSize,
    height: atlasMaxPageSize,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(layers)  // layers = Array<{ input, top, left }>
  .png({ compressionLevel: 9 })
  .toFile(tmpPath);
```

Where `layers` is built from packer output:

```typescript
const layers = pack.regions.map((region) => ({
  input: regionBuffers.get(region.regionName)!,  // pre-resized RGBA Buffer
  top: region.y,
  left: region.x,
}));
```

### Per-region resize (the shared helper per D-03a)

The existing [image-worker.ts:89-110](src/main/image-worker.ts#L89-L110) `applyResizeAndSharpen` helper is the reuse target:

```typescript
function applyResizeAndSharpen(
  pipeline: sharp.Sharp,
  outW: number,
  outH: number,
  effectiveScale: number,
  sharpenEnabled: boolean,
): sharp.Sharp {
  let p = pipeline.resize(outW, outH, { kernel: 'lanczos3', fit: 'fill' });
  if (sharpenEnabled && Number.isFinite(effectiveScale) && effectiveScale < 1.0) {
    p = p.sharpen({ sigma: SHARPEN_SIGMA });
  }
  return p.png({ compressionLevel: 9 });
}
```

For atlas mode, we DO NOT want `.png(...)` at the end of the pipeline — we want the resized RGBA buffer to feed into the composite step. Two paths for the planner:

**Path A (Claude's recommendation):** Export `applyResizeAndSharpen` from image-worker.ts BUT split the `.png(...)` tail into a separate optional step. Or:

**Path B:** Create `src/main/sharp-resize.ts` with two functions: `resizeRegionToFile(...)` (loose path, includes `.png(...).toFile(...)`) and `resizeRegionToBuffer(...)` (atlas path, returns RGBA `.raw().toBuffer()`). Both share the kernel-lanczos3+sharpen body.

Path B keeps the loose-mode bytes byte-identical (REPACK-01 acceptance) because the new module just absorbs the existing image-worker call. Path A risks subtle drift if any future change to the helper accidentally changes the loose pipeline shape.

### Rotation in the per-region pipeline

When `atlasAllowRotation=true` and the packer rotated rect K, we need the source pixels rotated 90° BEFORE composite. Sharp's `.rotate(90)` does this:

```typescript
const buf = await sharp(sourcePngPath)
  .resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })
  .rotate(90)               // ← only when rect.rot === true
  .png({ compressionLevel: 9 })
  .toBuffer();
```

⚠️ **Rotation direction:** Per [image-worker.ts:308-315 docblock](src/main/image-worker.ts#L308-L315), `sharp.rotate(+90)` produces a CCW (counter-clockwise) rotation per libgdx atlas convention. **Direction VERIFIED EMPIRICALLY** in 33-RESEARCH.md (`scripts/probe-sharp-rotate.mjs`). When writing Phase 40 rotation, treat this as established fact — same `.rotate(90)` call.

### Pipeline fusion landmine

libvips internally reorders pipeline operations. From [image-worker.ts:554-560 docblock](src/main/image-worker.ts#L554-L560):

> Sharp orders pipeline operations as `pre-extract → resize → extend → composite → post-extract` regardless of chain order, so a single `.extract().extend().resize()` pipeline yields (resize_target + 2*padding) — wrong. For SW regions we materialize the extend output to a Buffer first, then re-open as a fresh pipeline.

**Phase 40 implication:** when chaining `resize().rotate()`, libvips may fuse these in unexpected order. The safe pattern is **materialize-then-reload**:

```typescript
// Materialize the resized buffer
const resized = await sharp(sourcePath)
  .resize(targetW, targetH, { kernel: 'lanczos3', fit: 'fill' })
  .png()
  .toBuffer();

// Conditional rotation in a fresh pipeline
const finalBuffer = rotateThisRegion
  ? await sharp(resized).rotate(90).png().toBuffer()
  : resized;

// Composite step uses finalBuffer
```

Phase 33 SW + rotated regions use the same materialize-then-reload pattern at [image-worker.ts:583-606](src/main/image-worker.ts#L583-L606). **Recommend Phase 40 follow this pattern** for atlas rotation to avoid fusion surprises.

### Reading back sharp-emitted truth

```typescript
const buf = await sharp(...).resize(...).png().toBuffer();
const meta = await sharp(buf).metadata();
const actualW = meta.width!;   // ← this is what the packer must see
const actualH = meta.height!;
```

`buildExportPlan` produces `outW`/`outH` from `Math.ceil(canonicalW × effectiveScale)`. Sharp's actual output is normally identical, but **safetyBufferPercent + Math.ceil** can introduce sub-pixel drift in edge cases. The sharp-emits-truth invariant says: **pass `actualW`/`actualH` to the packer, not `outW`/`outH`**. There is no realistic case in current sharp/libvips where the resized PNG comes out at a different size than the requested `.resize(W, H, { fit: 'fill' })` — but the invariant codifies the safety: if it ever does, the packer's layout still maps to bytes that actually exist.

## Validation Architecture

### Test Framework

| Property             | Value                                                      |
|----------------------|------------------------------------------------------------|
| Framework            | **vitest 4.0.0** (already installed; see package.json)     |
| Config file          | `vitest.config.ts` at repo root                            |
| Quick run command    | `npx vitest run tests/core/repack.spec.ts -t "<name>"`     |
| Full suite command   | `npm run test`                                             |
| Env                  | `environment: 'node'` — sharp works in this env (verified at tests/main/image-worker.integration.spec.ts:25) |

### Phase Requirements → Test Map

| Req ID    | Behavior                                                                 | Test Type | Automated Command                                                       | File Exists? |
|-----------|--------------------------------------------------------------------------|-----------|-------------------------------------------------------------------------|--------------|
| REPACK-01 | loose-mode SHA256 byte-identical to pre-Phase-40 baseline                | integration | `npx vitest run tests/main/repack.loose-parity.spec.ts`                  | ❌ Wave 0    |
| REPACK-01 | `atlas` mode writes ≥1 .atlas + ≥1 page PNG                              | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "atlas mode"`        | ❌ Wave 0    |
| REPACK-01 | `both` mode produces loose PNGs + .atlas + page PNGs in same dir         | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "both mode"`         | ❌ Wave 0    |
| REPACK-02 | `core/repack.ts` determinism (same input → same layout)                  | unit      | `npx vitest run tests/core/repack.spec.ts -t "determinism"`              | ❌ Wave 0    |
| REPACK-02 | Output region count equals input region count                            | unit      | `npx vitest run tests/core/repack.spec.ts -t "preserves count"`          | ❌ Wave 0    |
| REPACK-02 | Every output region within its page bounds                               | unit      | `npx vitest run tests/core/repack.spec.ts -t "within bounds"`            | ❌ Wave 0    |
| REPACK-02 | `core/repack.ts` has no sharp / fs / electron imports                    | unit (arch) | extend existing `tests/arch.spec.ts` core-purity grep                   | ✅ extend    |
| REPACK-03 | Sharp-emits-truth: packer receives actual emitted dims                   | unit      | `npx vitest run tests/main/repack-worker.spec.ts -t "emits truth"`       | ❌ Wave 0    |
| REPACK-03 | Composite pixel at (x,y) on page matches loose-mode source pixel         | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "pixel preserved"`   | ❌ Wave 0    |
| REPACK-04 | Output .atlas round-trips through spine-core's `new TextureAtlas(text)`  | unit      | `npx vitest run tests/main/atlas-writer.spec.ts -t "round-trip"`         | ❌ Wave 0    |
| REPACK-04 | All region names, dims, rotation flags match pack-plan                   | unit      | `npx vitest run tests/main/atlas-writer.spec.ts -t "field parity"`       | ❌ Wave 0    |
| REPACK-05 | Page count equals pack-plan page count                                   | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "page count"`        | ❌ Wave 0    |
| REPACK-05 | Each page PNG ≤ atlasMaxPageSize on both axes                            | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "page bounds"`       | ❌ Wave 0    |
| REPACK-05 | PMA sentinel passes against repack output                                | manual+probe | `node scripts/pma-probe.mjs` (gated to repack output path)            | ✅ extend    |
| REPACK-06 | With `atlasAllowRotation=false` no .atlas entry has `rotate: 90`         | integration | `npx vitest run tests/main/atlas-writer.spec.ts -t "no rotate when off"`  | ❌ Wave 0    |
| REPACK-06 | With `atlasAllowRotation=true`, rotated entry round-trips with swapped W/H | unit    | `npx vitest run tests/main/atlas-writer.spec.ts -t "rotated round-trip"` | ❌ Wave 0    |
| REPACK-07 | Pre-Phase-40 .stmproj loads with 4 fields back-filled to defaults        | unit      | `npx vitest run tests/core/project-file.spec.ts -t "atlas defaults"`     | ✅ extend    |
| REPACK-07 | Post-Phase-40 .stmproj with all 4 fields round-trips losslessly          | unit      | `npx vitest run tests/core/project-file.spec.ts -t "atlas round-trip"`   | ✅ extend    |
| REPACK-07 | `project_format_version` unchanged before vs after Phase 40              | unit      | `npx vitest run tests/core/project-file.spec.ts -t "version unchanged"`  | ✅ extend    |
| REPACK-08 | atlas-source + atlas-less produce SHA256-identical .atlas + page PNGs    | integration | `npx vitest run tests/main/repack.parity.spec.ts -t "loaderMode parity"` | ❌ Wave 0    |
| REPACK-09 | Varying `safetyBufferPercent` changes .atlas dims by expected scale      | unit      | `npx vitest run tests/main/atlas-writer.spec.ts -t "buffer dim scaling"` | ❌ Wave 0    |
| REPACK-09 | Toggling `sharpenOnExport` does NOT alter pack layout (SHA256 .atlas same) | integration | `npx vitest run tests/main/repack.parity.spec.ts -t "sharpen invariant"` | ❌ Wave 0  |
| REPACK-10 | Oversize region aborts with locked error string, no files written        | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "oversize abort"`    | ❌ Wave 0    |
| REPACK-10 | Sharp throw on page 2 of 3 leaves NO .atlas or page PNG on disk          | integration | `npx vitest run tests/main/repack-worker.spec.ts -t "atomic rollback"`   | ❌ Wave 0    |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/core/repack.spec.ts tests/main/repack-worker.spec.ts tests/main/atlas-writer.spec.ts -t "<task-related test name>"` — sub-second for unit; ~3-5s for integration that touches sharp.
- **Per wave merge:** `npx vitest run tests/core/ tests/main/repack* tests/main/atlas-writer*` — runs everything Phase-40-touched.
- **Phase gate:** `npm run test` — full suite green before `/gsd-verify-work`.

### Wave 0 Gaps

The following test files **do not yet exist** and must land before / during the first Phase 40 task that needs them:

- [ ] `tests/core/repack.spec.ts` — pack-math determinism, count preservation, page-bounds, page-spawn (REPACK-02)
- [ ] `tests/main/atlas-writer.spec.ts` — libgdx round-trip, rotation, buffer dim scaling (REPACK-04, REPACK-06, REPACK-09)
- [ ] `tests/main/repack-worker.spec.ts` — sharp-emits-truth, page count/bounds, oversize abort, atomic rollback (REPACK-03, REPACK-05, REPACK-10)
- [ ] `tests/main/repack.loose-parity.spec.ts` — loose-mode SHA256 baseline regression (REPACK-01)
- [ ] `tests/main/repack.parity.spec.ts` — cross-loaderMode parity + sharpen-invariant (REPACK-08, REPACK-09)
- [ ] `tests/fixtures/repack-baselines.json` — SHA256 baselines per D-06
- [ ] `tests/fixtures/repack-expected/SIMPLE_TEST.atlas` — committed expected `.atlas` text per D-06
- [ ] `scripts/repack-refresh-baselines.mjs` — manual baseline refresh script per D-07
- [ ] **Extend** `tests/arch.spec.ts` (core-purity grep block at line 148-160) to include `core/repack.ts`
- [ ] **Extend** `tests/core/project-file.spec.ts` for the 4 new fields (REPACK-07)

**Framework install:** none required. vitest 4.0.0, sharp 0.34.5, @esotericsoftware/spine-core 4.2.x, maxrects-packer 2.7.3 are all installed.

## File-by-File Implementation Map

### NEW: `src/core/repack.ts`

**Owns:** Pure-TS pack-planning. Input: post-quality-knob region dims; output: per-page layout with per-region (x, y, rotated).

**Public API (planner can refine):**
```typescript
export interface RepackInput {
  regionName: string;
  packW: number;           // sharp-emits-truth: ACTUAL emitted width
  packH: number;           // sharp-emits-truth: ACTUAL emitted height
  // No buffer or path — those live in main/. Pure dims only.
}

export interface RepackOptions {
  maxPageSize: 1024 | 2048 | 4096 | 8192;
  padding: number;          // 0..16
  allowRotation: boolean;
}

export interface RepackedRegion {
  regionName: string;
  pageIndex: number;        // 0-based; .atlas uses {projectName}{_pageIndex+1 if >0}.png
  x: number;
  y: number;
  w: number;                // post-rotation dim on page
  h: number;                // post-rotation dim on page
  rotated: boolean;
}

export interface RepackPage {
  pageIndex: number;
  width: number;            // bin.width — fitted, may be < maxPageSize
  height: number;
}

export interface RepackResult {
  pages: RepackPage[];
  regions: RepackedRegion[]; // one per input
  oversize: string[];        // regionNames whose packW/packH > maxPageSize — empty on success
}

export function computeRepack(inputs: RepackInput[], opts: RepackOptions): RepackResult;
```

**Key insight:** This module does NOT read pixels or write files. It is **`maxrects-packer` plus sorting plus oversize pre-flight**. The oversize pre-flight populates `result.oversize` with offending region names; `main/repack-worker.ts` reads that list and throws the locked error string (REPACK-10) BEFORE calling sharp.

**Determinism:** Sort `inputs` by `regionName` BEFORE adding to the packer. (atlas-preview.ts sorts by `sourcePath` then `regionName`; for repack we use regionName directly because per-region dedup is already done by `buildExportPlan`.)

**Layer 3 hygiene:** Imports allowed — `maxrects-packer` (already vetted as browser-safe at atlas-preview.ts:36); type-only imports from `../shared/types.js`. Forbidden — `sharp`, `node:fs`, `electron`, DOM types. `tests/arch.spec.ts` core-purity grep block extends to cover this file.

### NEW: `src/main/atlas-writer.ts`

**Owns:** libgdx `.atlas` text serialization. Pure function; no I/O (no `fs.writeFile` inside). Returns a string; `repack-worker.ts` does the atomic-write.

**Public API:**
```typescript
export interface AtlasWriterInput {
  projectName: string;       // base name for {projectName}.png / {projectName}_N.png
  pages: RepackPage[];       // from core/repack.ts
  regions: RepackedRegion[]; // from core/repack.ts
}

/** Returns libgdx-format .atlas text (LF line endings, no trailing newline). */
export function buildAtlasText(input: AtlasWriterInput): string;
```

**Page naming convention (REPACK-05 locked):**
- Page 0 → `{projectName}.png`
- Page N (N ≥ 1) → `{projectName}_{N+1}.png` (so pages 1, 2, … render as `_2.png`, `_3.png`, …)

The 1-indexing for the suffix matches user expectation ("page 2 of 3" → `_2.png`) and aligns with the libgdx convention seen in shipped Spine examples.

**Format details:** See §libgdx .atlas Format Reference for the exact byte-level grammar. Emit `size:`, `format:`, `filter:`, `repeat:` page headers; emit `bounds:` per region; emit `rotate: true` only when `region.rotated === true`. Omit `orig`/`offsets` (no trimming beyond loose mode).

**Layer 3:** This file CAN import `node:path` for joining page filenames; CANNOT import `sharp` or `node:fs`. Pure function; no side effects.

### NEW: `src/main/repack-worker.ts`

**Owns:** sharp orchestration. Mirrors `image-worker.ts` `runExport` in structure but produces `.atlas` + page PNGs instead of N loose PNGs.

**Public API:**
```typescript
export async function runRepack(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  allowOverwrite: boolean,
  sharpenEnabled: boolean,
  atlasOpts: { maxPageSize: number; allowRotation: boolean; padding: number },
  writtenPaths: Set<string>,   // shared rollback accumulator (D-04a)
): Promise<{ pageFiles: string[]; atlasFile: string }>;
```

**Algorithm:**
1. For each `ExportRow` in `plan.rows` + `plan.passthroughCopies`, sharp-resize the source via the shared helper. Read back `metadata().width/height` → `packW/packH`. (Sharp-emits-truth.) Buffer the RGBA result in memory (keyed by `regionName`).
   - On progress: emit `ExportProgressEvent` with `phase: 'resize'`, `index: 0..N-1`.
2. Call `computeRepack(inputs, opts)`. If `result.oversize.length > 0` → throw with the locked error string `"Region {name} is {W}×{H} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override."` for the FIRST oversize region. No file written yet.
3. For each page in `result.pages`:
   - Build `layers` array of `{ input: regionBuffer, top: region.y, left: region.x }` for every region whose `pageIndex` matches.
   - sharp `{ create: { width, height, channels: 4, background: transparent } }`.composite(layers).png({ compressionLevel: 9 }).toFile(`{pagePath}.tmp`).
   - On progress: emit `ExportProgressEvent` with `phase: 'composite'`, `index: 0..P-1`.
   - On success: register `tmpPath` AND `finalPath` in `writtenPaths`. `rename(tmpPath, finalPath)`.
4. Build `.atlas` text via `buildAtlasText(...)`. Write to `{projectName}.atlas.tmp` via `fs.writeFile`, register in `writtenPaths`, then `rename`.
5. Return `{ pageFiles, atlasFile }`.

**Cancellation:** Cooperative between resize iterations + between page composites (mirrors image-worker.ts:380 + 178). Mid-libvips operations cannot be aborted.

**Atomic-or-fail:** All `tmp` paths AND final paths land in `writtenPaths` so the IPC handler's finally-block can `fs.rm` them on any throw. See §Landmines: "Atomic rollback shape".

### MODIFIED: `src/main/image-worker.ts`

- Extract `applyResizeAndSharpen` (or split the loose-PNG `.toFile(...)` tail into a sibling function so both image-worker and repack-worker use the same lanczos+sharpen body without the loose PNG-encode-and-write step). D-03a leaves the exact split to the planner.
- **No other changes.** Loose-mode bytes MUST be byte-identical to pre-Phase-40 (REPACK-01 acceptance).

### MODIFIED: `src/main/ipc.ts`

- `handleStartExport` signature gains 2 args: `outputMode: 'loose'|'atlas'|'both'`, `atlasOpts: { maxPageSize, allowRotation, padding }`. Both default to safe values (`'loose'`, `{maxPageSize: 4096, allowRotation: false, padding: 2}`) so legacy callers still work.
- Add `validateExportOpts(outputMode, atlasOpts)` trust-boundary check next to `validateExportPlan` at [ipc.ts:286-310](src/main/ipc.ts#L286-L310).
- Dispatch (D-04a):
  ```typescript
  const written = new Set<string>();
  try {
    if (outputMode === 'loose' || outputMode === 'both') {
      const summary = await runExport(plan, outDir, ..., written);
    }
    if (outputMode === 'atlas' || outputMode === 'both') {
      const { pageFiles, atlasFile } = await runRepack(plan, outDir, ..., written);
    }
    return { ok: true, summary: ... };
  } catch (err) {
    // Rollback: delete every path we recorded
    for (const p of written) {
      await fs.rm(p, { force: true }).catch(() => {});
    }
    throw err;
  }
  ```
- **`runExport` signature gains the same `written: Set<string>` arg** so its atomic-renamed PNGs land in the shared rollback list. The `image-worker.ts:295/353` atomic-write idiom (`tmp + rename`) means `tmp` files are short-lived; we register both `tmp` and final paths.
- Channel registration at [ipc.ts:703-711](src/main/ipc.ts#L703-L711) gains the two new args (positional after `sharpenEnabled`).

### MODIFIED: `src/shared/types.ts`

Add 4 fields to `ProjectFileV1` AND `AppSessionState` (both shapes mirror per [types.ts:1071-1089](src/shared/types.ts#L1071-L1089)):

```typescript
/** Phase 40 REPACK-07 — atlas output mode. v1.5-era files default to 'loose'. */
atlasOutputMode: 'loose' | 'atlas' | 'both';
/** Phase 40 REPACK-07 — max page dimension. v1.5-era files default to 4096. */
atlasMaxPageSize: 1024 | 2048 | 4096 | 8192;
/** Phase 40 REPACK-07 — allow 90° packer rotation. v1.5-era files default to false. */
atlasAllowRotation: boolean;
/** Phase 40 REPACK-07 — inter-region padding (px). v1.5-era files default to 2. */
atlasPadding: number;
```

Add `phase` to `ExportProgressEvent`:
```typescript
/** Phase 40 D-05 — 'resize' fires per-region; 'composite' fires per-page. Existing single-stream consumers can ignore. */
phase?: 'resize' | 'composite';
```

### MODIFIED: `src/core/project-file.ts`

Add 4 pre-massage blocks in `validateProjectFile`, mirroring the `loaderMode`/`sharpenOnExport`/`safetyBufferPercent` pattern at lines 178-222. Pattern:

```typescript
if (obj.atlasOutputMode === undefined) {
  obj.atlasOutputMode = 'loose';
}
if (obj.atlasOutputMode !== 'loose' && obj.atlasOutputMode !== 'atlas' && obj.atlasOutputMode !== 'both') {
  return { ok: false, error: { kind: 'invalid-shape', message: "atlasOutputMode is not 'loose'|'atlas'|'both'" } };
}
// ... same for atlasMaxPageSize (literal 1024|2048|4096|8192), atlasAllowRotation (boolean), atlasPadding (integer 0..16)
```

Add same defaults in `serializeProjectFile` and `materializeProjectFile` (defense-in-depth `?? defaultValue`). Add 4 fields to `PartialMaterialized`.

**No `project_format_version` bump.** REPACK-07 acceptance explicitly requires `project_format_version` unchanged.

### MODIFIED: `src/renderer/src/modals/OptimizeDialog.tsx`

- New props: `outputMode`, `onOutputModeChange`, `atlasOpts`, `onAtlasOptsChange` (or composed: `atlasMaxPageSize`, `atlasAllowRotation`, `atlasPadding` each with its own setter — mirrors the existing `sharpenOnExport` / `onSharpenChange` pair pattern). AppShell threads these from `.stmproj` state.
- New "Output" card immediately above the existing "Quality" card at [OptimizeDialog.tsx:437](src/renderer/src/modals/OptimizeDialog.tsx#L437). Card outer style: `border border-border rounded-md bg-surface p-3 mb-4` (mirrors Quality card verbatim).
- Inside Output card:
  - First child: radio group `loose | atlas | both` (per D-01a).
  - Conditional render (per D-01b, mechanism: plain conditional render — no transition library in repo; see Landmines): when `outputMode !== 'loose'`, render `<select>` for `atlasMaxPageSize`, checkbox for `atlasAllowRotation` (with `title=` tooltip), number input for `atlasPadding` (suffix "px", clamped 0..16).
- `onStart` callback at [OptimizeDialog.tsx:206-305](src/renderer/src/modals/OptimizeDialog.tsx#L206-L305): pass `outputMode` + `atlasOpts` to `window.api.startExport(...)`. The preload signature gains the new positional args.
- Progress useEffect at [OptimizeDialog.tsx:159-190](src/renderer/src/modals/OptimizeDialog.tsx#L159-L190): handle `event.phase`. Two clean counters in two row-buckets (resize rows + page rows), OR a single combined counter that prefixes the row label with "Resize" / "Composite". Planner's discretion. Default lean: single combined counter, since the user sees a single progress bar today.

### MODIFIED: `package.json`

Add script per D-07:
```json
"scripts": {
  "repack:refresh-baselines": "node scripts/repack-refresh-baselines.mjs"
}
```

## Runtime State Inventory

Phase 40 is a **greenfield additive output mode** — not a rename/refactor/migration. **No runtime state migration required**.

| Category                       | Items Found                                                                                          | Action Required                                              |
|--------------------------------|------------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| Stored data                    | None — `.stmproj` gains 4 additive fields; validator pre-massages absent fields to defaults          | None                                                          |
| Live service config            | None — no external services touched                                                                  | None                                                          |
| OS-registered state            | None — no Task Scheduler / pm2 / launchd registrations                                               | None                                                          |
| Secrets / env vars             | None — `UPDATE_FIXTURES=1` is a new env var per D-07 for test refresh, but it's read by vitest only  | None — document in test refresh script header                |
| Build artifacts / installed packages | None — no new deps; `package.json` gains one `scripts` entry only                              | None                                                          |

## Environment Availability

| Dependency                    | Required By                         | Available | Version  | Fallback |
|-------------------------------|-------------------------------------|-----------|----------|----------|
| `maxrects-packer`             | core/repack.ts                      | ✓         | 2.7.3    | —        |
| `sharp`                       | main/repack-worker.ts               | ✓         | 0.34.5   | —        |
| `@esotericsoftware/spine-core` (TextureAtlas) | tests/main/atlas-writer.spec.ts | ✓ | 4.2.x    | —        |
| `node:crypto` (SHA256)        | tests/main/repack.parity.spec.ts    | ✓         | bundled  | —        |
| `node:fs/promises`            | main/repack-worker.ts, refresh script | ✓       | bundled  | —        |
| `vitest`                      | all tests                           | ✓         | 4.0.0    | —        |

All required dependencies are already installed. **No install step.**

## Open Questions for Planner

1. **D-02a packer-sharing decision.** Recommendation in CONTEXT.md is "stay independent unless a meaningful reduction in code emerges." Once `core/repack.ts` is written, the planner / executor compares its `MaxRectsPacker` setup against atlas-preview.ts:110-119. If the constructor options + add() shape are byte-identical, a shared `core/maxrects-wrapper.ts` is a 10-line win; if they diverge (e.g. atlas-preview uses `maxPageDim: 2048|4096` while repack uses `1024|2048|4096|8192`), keep them separate. **Planner's call after writing repack.ts.**

2. **D-03a resize-helper location.** Two viable paths (Path A: export from image-worker.ts; Path B: new `main/sharp-resize.ts`). Path B is cleaner architecturally; Path A is one fewer file. Planner picks based on whether the helper grows beyond ~30 lines (Path B becomes worth it) or stays trivial (Path A is fine).

3. **D-04a rollback list mechanism.** `Set<string>` accumulator works cleanly for `fs.rm` cleanup. **Open question:** does `runExport` need its signature widened to accept the Set, or do we wrap it with a recording proxy in `handleStartExport`? Recommendation: widen the signature explicitly — it's clearer in the call site and matches `runRepack`'s expected signature.

4. **OptimizeDialog reveal mechanism (D-01b).** No animation library is in repo (zero hits for framer-motion / react-transition-group; existing Tailwind `transition-colors` and `animate-pulse` classes are CSS-only). **Recommendation:** plain conditional render — no transition. Matches the existing modal style; zero added complexity.

5. **`runExport` arg-positional growth.** After Phase 40, `handleStartExport` will have 7 positional args (`evt, plan, outDir, overwrite, sharpenEnabled, outputMode, atlasOpts`). This is already brittle. The CONTEXT.md deferred-ideas section flags an `ExportOptions` refactor for a future hygiene phase. **Open question for planner:** is there low-cost mitigation in Phase 40, e.g. introducing a `Phase40ExportArgs` type alias to at least name the positional pile? Recommendation: no — `ExportOptions` refactor belongs in its own phase per CONTEXT.

6. **Combined-vs-split progress counter UX.** D-05 makes `phase` additive so the existing single-counter renderer ignores it. **Open question:** should the OptimizeDialog rewrite its progress UI to show two phases (resize: 0..N-1, composite: 0..P-1) explicitly, or keep the single combined counter? CONTEXT D-05 rationale ("the indeterminate-spinner-at-end approach would look like a hang on large atlases") suggests user-facing benefit. Recommendation: render two distinct phases in the dialog (small visual delta — phase label above the progress bar swaps from "Resize" to "Composite"). Planner sizes this; could land as one task in Wave 3.

## Landmines & Gotchas

### 1. Sharp pipeline fusion order

libvips reorders `extract → resize → extend → composite → post-extract` regardless of chain order. **Implication for Phase 40:** chaining `.resize(...).rotate(90)` may NOT execute in the order written. Materialize to a Buffer between steps when the order matters (Phase 33 SW + rotated regions use this pattern at [image-worker.ts:583-606](src/main/image-worker.ts#L583-L606)). For Phase 40 atlas rotation, prefer the materialize-then-reload pattern unless a probe confirms the fused pipeline is bit-identical to the staged version.

### 2. Sharp `.rotate(90)` direction

`sharp.rotate(+90)` produces a CCW rotation per libgdx atlas convention. **VERIFIED EMPIRICALLY** by Phase 33 — see [scripts/probe-sharp-rotate.mjs](scripts/probe-sharp-rotate.mjs) and the docblock at [image-worker.ts:308-315](src/main/image-worker.ts#L308-L315). Do NOT relitigate; do NOT use `-90`.

### 3. maxrects-packer rect.width/height swap on rotation

When `allowRotation: true` and a rect gets rotated, the packer's `rect.width` and `rect.height` are **already swapped** vs the input. Per the .d.ts:97-98 setter docblock: *"after `rot` is set, `width/height` of this rectangle is swaped"*. Our `.atlas` writer must emit `bounds: x, y, rect.width, rect.height` AS-IS — spine-runtimes' TextureAtlas reader expects post-rotation dims when `rotate: true` is present (TextureAtlas.js:164-169).

### 4. Atlas-text grammar: blank lines kill pages

Per the parser at TextureAtlas.js:113-130, **a blank line within a page block resets `page = null`**. So a blank line between page header and region name silently corrupts the parse — the region name becomes a freshly-named empty page. **Rule:** emit a blank line ONLY between adjacent pages in a multi-page atlas. NEVER inside a page block. The synthetic-atlas.ts:188-208 implementation gets this right and is the in-repo reference.

### 5. Atlas-text grammar: first non-colon line ends the page-fields loop

`readEntry` returns 0 for any line without a `:`. The parser uses this to detect "transition from page-fields to region block." Implication: do NOT emit the page filename with a `:` in it (e.g. `images/my:atlas.png` — a colon-bearing filename would be interpreted as a key:value page header field with key "images/my" — likely silently ignored, but malformed). The user-facing `projectName` we derive from the output dir / project name must be `:`-free. **Defense-in-depth:** add an assertion at `buildAtlasText` entry that throws if `projectName` contains a `:`.

### 6. spine-runtimes does NOT round-trip `format:` or `repeat:` strictly

TextureAtlas.js:42-44 explicitly ignores `format:` (`// page.format = Format[tuple[0]]; we don't need format in WebGL`). `repeat:` is parsed but the absence of the line defaults to `ClampToEdge` (line 233-234). **Implication for Phase 40 REPACK-04 acceptance:** the round-trip test cannot assert `format:` is preserved on read — the test must round-trip via `new TextureAtlas(text)` and check that *the region count and dims match*, not that the page header fields are byte-identical post-round-trip. (They WILL be byte-identical when written by our writer, but the read side discards them.)

### 7. Atomic rollback shape

The image-worker.ts:295/353 atomic-write idiom is `await sharp(...).toFile(tmp); await rename(tmp, final)`. On a throw between `toFile(tmp)` and `rename(...)`, the `.tmp` file is orphaned. **Implication for the rollback list:** record BOTH `tmp` and `final` for every step, AND have the finally-block `fs.rm` both regardless of which one(s) exist. Order doesn't matter for `fs.rm` with `force: true`. Sketch:
```typescript
const tmpPath = pagePath + '.tmp';
written.add(tmpPath);
written.add(pagePath);
await sharp(...).toFile(tmpPath);
await rename(tmpPath, pagePath);
// On any throw upstream of OR during this step, finally-block sweeps both.
```

### 8. fs.rm caveat on rollback

`fs.rm(path, { force: true })` swallows ENOENT. Use this in the rollback loop so the cleanup is non-fatal when a path was never actually written:
```typescript
for (const p of written) {
  await fs.rm(p, { force: true }).catch(() => { /* defense-in-depth */ });
}
```

### 9. Determinism across two `runRepack` invocations

REPACK-08 (loaderMode parity) and REPACK-02 (determinism) BOTH require two invocations to produce SHA256-identical bytes. The packer is deterministic given identical input order. **Implication:** the `inputs` array passed to `computeRepack` MUST be sorted in a deterministic, mode-independent way. Use **regionName** as the primary sort key (region names are loader-mode-invariant; sourcePath might differ between atlas-source and atlas-less since atlas-source paths come from `.atlas` while atlas-less paths come from synthetic-atlas.ts). **Recommendation:** `inputs.sort((a, b) => a.regionName.localeCompare(b.regionName))` is the canonical pre-pack sort for Phase 40.

### 10. `outputMode='loose'` MUST be byte-identical regression

REPACK-01 acceptance is the strictest test gate in the phase. A bug that changes one byte in any loose-mode PNG breaks the acceptance. **Recommendation for the planner:** make the SHA256 baseline test for loose mode the FIRST integration test that runs in CI for this phase — it's the canary that catches "I accidentally changed `applyResizeAndSharpen`."

### 11. Tooltip primitive — use `title=` (browser-native)

Existing tooltip usage in the repo (verified by grep): the only `title=` attribute is at [OptimizeDialog.tsx:465](src/renderer/src/modals/OptimizeDialog.tsx#L465) on the safety-buffer input. AtlasPreviewModal uses a custom floating `<div role="tooltip">` for hover-on-canvas inspection — that's a heavyweight pattern. **Recommendation for D-01d:** use `title="Packer may rotate regions 90° for tighter packing."` on the checkbox label — zero new dependency, consistent with the safety-buffer pattern.

### 12. Animation reveal — plain conditional render

No animation library in repo (no framer-motion, no react-transition-group). Only `transition-colors` and `animate-pulse` Tailwind utilities are in use. **Recommendation for D-01b:** plain conditional render (`{outputMode !== 'loose' && <atlasKnobs />}`). Consistent with how `PreFlightBody` vs `InProgressBody` toggle at [OptimizeDialog.tsx:492-511](src/renderer/src/modals/OptimizeDialog.tsx#L492-L511).

### 13. Vitest can run sharp — no mocking needed

`tests/main/image-worker.integration.spec.ts:25` imports `sharp` directly and runs the full libvips pipeline in vitest's `environment: 'node'`. **Phase 40 implication:** the SHA256 baseline tests CAN execute the real `runRepack` pipeline end-to-end in vitest, producing real PNG bytes and computing real SHA256. No mocking of sharp required. (The unit tests for `core/repack.ts` need NEITHER sharp NOR fs — they pass dim arrays in, get layouts out.)

### 14. CI flakiness on PNG bytes

SHA256 baselines can flake across libvips minor versions. `package.json` pins `sharp@^0.34.5`. The caret is permissive — patch bumps could theoretically introduce a bit difference. **Recommendation for the planner:** consider tightening `sharp` to an exact `0.34.5` (no caret) before the SHA256 baseline tests land, to prevent silent CI breakage on a future `npm install`. Or document in `tests/fixtures/repack-baselines.json` header the exact sharp/libvips versions the baselines were captured against, and the refresh script (`scripts/repack-refresh-baselines.mjs`) records the current versions on every refresh.

### 15. Sharpen interaction with pack layout

REPACK-09 acceptance: toggling `sharpenOnExport` produces byte-different pixel data BUT byte-identical pack layout (SHA256 of `.atlas` invariant). **Implication:** `core/repack.ts` MUST NOT see the post-sharpen buffer — it sees ONLY the (W, H) dimensions, which are unchanged by sharpen. Sharpen affects pixels, not dims. The test that proves this: run the full pipeline twice (once with sharpen on, once off), assert the two `.atlas` files have identical SHA256 even though the page PNGs differ.

### 16. `projectName` derivation

The `.atlas` file is named `{projectName}.atlas`. **Open question:** what is `projectName`? Two candidate sources:
   - The output directory's basename (e.g. `outDir = "/Users/x/MyAtlas"` → `projectName = "MyAtlas"`).
   - The skeleton JSON basename (e.g. `SIMPLE_TEST.json` → `projectName = "SIMPLE_TEST"`).
The SIMPLE_TEST.atlas fixture shows `SIMPLE_TEST.png` as the page name — matching the **skeleton JSON basename**. **Recommendation:** derive `projectName` from `skeletonPath.replace(/\.json$/, '')`. This is also what Spine's own exporter does. Plan should thread `skeletonBasename` through to `runRepack`.

## Assumptions Log

| #  | Claim                                                                                              | Section                          | Risk if Wrong                                                                          |
|----|----------------------------------------------------------------------------------------------------|----------------------------------|----------------------------------------------------------------------------------------|
| A1 | `projectName` for `.atlas` filename is derived from `skeleton.json` basename                       | Landmines #16, File-by-File      | Wrong filename → user has to rename; trivial fix; no data loss                          |
| A2 | Conditional render (no animation) is the established pattern for OptimizeDialog reveal             | Landmines #12                    | Visually less polished; not a bug                                                       |
| A3 | `title=` attribute is the established tooltip pattern for non-canvas hover hints                   | Landmines #11                    | Tooltip slightly less styled; not a bug                                                 |
| A4 | Path B (new `main/sharp-resize.ts`) is cleaner than Path A (export from image-worker.ts)           | File-by-File, Open Questions     | Stylistic; loose-mode bytes unaffected either way (REPACK-01 acceptance gates this)     |
| A5 | Sharpen does not change emitted PNG dims (only pixel values)                                       | Landmines #15, REPACK-09 test    | If false: REPACK-09 acceptance unmet; would surface in the `sharpen invariant` test     |
| A6 | Page-PNG naming `{projectName}.png` / `{projectName}_2.png` / `{projectName}_N.png` (1-indexed)    | atlas-writer §"Page naming"      | If a downstream consumer expects `_0.png` instead: file rename only; trivial            |

All assumptions are documented as `[ASSUMED]` for the discuss-phase / planner to either confirm or amend before locking. None of the locked decisions in CONTEXT.md depend on any of these assumptions being correct.

## Sources

### Primary (HIGH confidence)
- `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js` (lines 31-269) — canonical libgdx `.atlas` grammar reference
- `node_modules/maxrects-packer/dist/maxrects-packer.d.ts` (lines 154-356) — exact installed API surface
- `node_modules/maxrects-packer/lib/maxrects-packer.js` (lines 47-86, 122-186) — bin-spawn behavior
- `node_modules/sharp/lib/composite.js` (full file) — sharp composite API
- `src/core/atlas-preview.ts` (lines 109-119) — in-repo MaxRectsPacker usage reference
- `src/main/image-worker.ts` (lines 89-110, 254-304, 528-631) — sharp pipeline + atomic-write + materialize-then-reload idiom
- `src/main/ipc.ts` (lines 286-310, 547-684, 700-711) — IPC handler + positional-arg precedent
- `src/core/project-file.ts` (lines 174-222) — validator pre-massage idiom
- `src/core/synthetic-atlas.ts` (lines 159-211) — in-repo libgdx atlas TEXT EMITTER reference
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` — authoritative format example
- `package.json` — verified pinned versions
- `tests/main/image-worker.integration.spec.ts` (lines 1-80) — proven pattern for sharp-in-vitest
- `scripts/pma-probe.mjs` — PMA sentinel applicable to repack output

### Secondary (MEDIUM confidence)
- `vitest.config.ts` — confirmed `environment: 'node'`, sharp can run in test env
- `tests/arch.spec.ts:148-160` — core-purity grep block that needs extending for repack.ts

### Tertiary (LOW confidence)
- None — all factual claims trace to in-tree source files

## Metadata

**Confidence breakdown:**
- libgdx `.atlas` format: **HIGH** — grammar verified against the actual parser source in spine-core 4.2 installed in node_modules
- maxrects-packer API: **HIGH** — verified against installed `.d.ts` + JavaScript source
- Sharp composite pipeline: **HIGH** — verified against installed sharp + in-repo reference at image-worker.ts
- `.stmproj` validator pattern: **HIGH** — three precedent fields (`loaderMode`, `sharpenOnExport`, `safetyBufferPercent`) all use the same idiom
- IPC positional-arg extension: **HIGH** — `allowOverwrite` (Phase 23) and `sharpenEnabled` (Phase 28) are byte-precedent
- Atomic rollback shape: **MEDIUM-HIGH** — established in main/image-worker.ts; new shape for `both` mode (spans two workers) is reasoned from existing patterns
- Sharp-emits-truth invariant: **HIGH** — formally locked in SPEC §Constraints; no realistic case where `metadata().width !== requested W` for `resize(W, H, { fit: 'fill' })`, but the invariant codifies the safety
- Test framework choice: **HIGH** — vitest 4.0.0 installed and running; sharp confirmed to work in `environment: 'node'`

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (30 days — stack is stable; refresh if sharp / maxrects-packer / spine-core minor-bump)

## RESEARCH COMPLETE
