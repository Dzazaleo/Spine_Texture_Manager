# Phase 21: SEED-001 atlas-less mode (json + images folder, no .atlas) — Research

**Researched:** 2026-05-01
**Domain:** Spine 4.2 loader path; pure-TS PNG IHDR byte parsing; spine-core 4.2 internals (`TextureAtlas`, `AtlasAttachmentLoader`, `SkeletonJson`); `.stmproj` v1 schema extension
**Confidence:** HIGH (every claim verified against installed `node_modules/@esotericsoftware/spine-core/dist/*.js`, in-repo source, or fixture inspection)

## Summary

The phase is to teach the loader a second project shape — `<basename>.json` plus a sibling `images/` folder of per-region PNGs, with no `.atlas` — by synthesizing an in-memory `TextureAtlas` whose regions are derived from the JSON's attachment list and whose page sizes are read from PNG IHDR chunks. The downstream pipeline (sampler, analyzer, exporter) consumes that synthesized atlas unchanged.

Two findings drive the plan:

1. **`AtlasAttachmentLoader.newRegionAttachment` and `newMeshAttachment` THROW when a region is missing** (`AtlasAttachmentLoader.js:62, 75`). CONTEXT.md D-09 ("silent skip") is therefore not achievable by feeding a partial atlas to spine-core's stock loader — the JSON read will crash on the first orphan attachment. The synthesizer must use a custom `AttachmentLoader` subclass that **returns null** when the atlas misses, which `SkeletonJson.readAttachment` is designed to handle (`SkeletonJson.js:371-372, 404-405`: `if (!region) return null;`, then `SkeletonJson.js:313-314`: `if (attachment) skin.setAttachment(...)`).

2. **Attachments may carry a `path` field that differs from the attachment name** (verified in `fixtures/Jokerman/JOKERMAN_SPINE.json`: 6 of 23 region attachments use `path: 'AVATAR/CARDS_L_HAND_1'` while `name: 'CARDS_L_HAND_1'`). `SkeletonJson.js:368, 401` reads `path = getValue(map, "path", name)` and the AttachmentLoader looks up by that path. Synthesized atlas region names MUST equal the JSON `path` value (defaulting to attachment name when absent), not the JSON entry-name key.

**Primary recommendation:** Build a `synthesizeAtlas(parsedJson, imagesDir)` function that:
1. Walks `parsedJson.skins[*].attachments[slotName][entryName]` and emits one `(name, path)` pair per `region | mesh | linkedmesh` attachment (the only three types that resolve to a TextureAtlas region per `AtlasAttachmentLoader.js:54-78` and `SkeletonJson.js:367-426`).
2. For each unique `path`, resolves `<imagesDir>/<path>.png`. If the PNG exists, reads its IHDR via `readPngDims()` and synthesizes one `TextureAtlasPage` (whose `.name = '<path>.png'`, width/height = PNG dims) plus one `TextureAtlasRegion` (whose `.name = path`, x/y = 0, width/height = PNG dims, originalWidth/Height = PNG dims, degrees = 0). If the PNG does NOT exist, skip — D-09 silent-skip.
3. Constructs the atlas via the **text-parser path** (`new TextureAtlas(generatedAtlasText)`) — D-13 verdict (a). spine-core's parser auto-fills u/v/u2/v2 (`TextureAtlas.js:162-171`) and originalWidth/originalHeight (`TextureAtlas.js:152-155`) for free; manual construction would have to replicate this math by hand.
4. Wraps `new AtlasAttachmentLoader(atlas)` in a `SilentSkipAttachmentLoader` that catches the "Region not found" throw from spine-core's stock loader and returns null, so SkeletonJson.readAttachment gracefully skips orphan attachments (D-09).

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Synthetic atlas regions are JSON-driven — walk `skeletonData.skins[*].attachments` to enumerate region/mesh attachment names. Orphan PNGs in `images/` are not Phase 21's surface (deferred to Phase 999.6).
- **D-02:** Subfolder-nested region names (`'AVATAR/FACE'` → `images/AVATAR/FACE.png`) are supported. Mirrors `loader.ts:260` `path.join(imagesDir, region.name + '.png')`.
- **D-03:** `LoadResult.atlasPath: string` → `string | null`. Atlas-less mode returns null. Consumer audit: `summary.ts:115`, `project-io.ts:400-406`/`:484-486`/`:891`, `AppShell.tsx:612-613`/`:1053`. `AppSessionState.atlasPath` is already `string | null` (verified `shared/types.ts:694`), and `ProjectFileV1.atlasPath` is already `string | null` (`shared/types.ts:673`); `validateProjectFile` already accepts null at `project-file.ts:175-180`. `SkeletonSummary.atlasPath` IS the breaking change site — `shared/types.ts:494` is currently `string`.
- **D-04:** `.stmproj` v1 schema gains an optional `loaderMode: 'auto' | 'atlas-less'` field. Existing legacy stmproj files (no `loaderMode`) default to `'auto'`. `atlasPath` field is already `string | null` — no schema change there.
- **D-05:** Atlas-less mode triggers when (a) `opts.atlasPath` is undefined, (b) sibling `<basename>.atlas` is unreadable, (c) per-project `loaderMode !== 'packed'` (only `'auto'`/`'atlas-less'` valid in Phase 21; `'auto'` permits fall-through).
- **D-06:** When `opts.atlasPath` is EXPLICITLY provided and unreadable → throw `AtlasNotFoundError` verbatim. No fall-through.
- **D-07:** When BOTH `.atlas` AND `images/` are present, atlas-by-default. Override via D-08.
- **D-08:** Per-project `loaderMode: 'auto' | 'atlas-less'` field in `.stmproj`. `'atlas-less'` skips atlas resolve and goes straight to synthesis.
- **D-09:** Per-region missing PNG → silent skip. Don't synthesize a region; let spine-core return null for that attachment. (Implementation requires a custom `AttachmentLoader` subclass — see Open Question 1 below.)
- **D-10:** Catastrophic case (`images/` absent, OR empty AND JSON references ≥1 region) → throw new `MissingImagesDirError` extending `SpineLoaderError`. Constructor mirrors `AtlasNotFoundError(searchedPath, skeletonPath)`. `.name = 'MissingImagesDirError'`. Add to `KNOWN_KINDS` in `ipc.ts` and to `SerializableError` union arm in `shared/types.ts:580-589`.
- **D-11:** Catastrophic-case error lists ALL missing PNGs.
- **D-12:** One page per PNG. Each region: name = JSON `path` (or attachment name if no `path`), x/y = 0, width/height = PNG dims, originalWidth/Height = PNG dims, degrees = 0.
- **D-13:** Recommend approach (a) text-based atlas construction. **VERDICT: confirmed (a) per Open Question 2 below.**
- **D-14:** Reuse `createStubTextureLoader()` from `loader.ts:81-83`.
- **D-15:** `SourceDims.source` discriminator gains `'png-header'` variant; consumers that switch on `source` get exhaustive-check trigger (currently only `loader.ts:245` writes the field — search reveals no renderer-side switch on `source`, but the type extension is type-safe).
- **D-16:** `sourcePaths` map populated as today: `images/<region.name>.png` (region.name = JSON path).
- **D-17:** `atlasSources` map: `pagePath = images/<region.name>.png`, `x/y = 0`, `w/h = PNG dims`, `rotated = false`. Atlas-extract path at `image-worker.ts:148-162` never fires in atlas-less mode (per-region PNG always exists by D-09 filter).

### Claude's Discretion
- Exact UI placement of the `loaderMode` toggle (menu vs inline checkbox vs Project Settings panel).
- Synthetic atlas construction strategy (text-based vs direct object) — recommend text-based per Open Question 2 verdict.
- Whether `MissingImagesDirError` carries a single combined message or a structured list.

### Deferred Ideas (OUT OF SCOPE)
- DisplayRow `actualSourceW`/`actualSourceH`/`dimsMismatch` → Phase 22.
- Dim-drift badge UI → Phase 22.
- Export-cap math → Phase 22.
- `excludedAlreadyOptimized[]` + OptimizeDialog muted-row UX → Phase 22.
- Orphan-PNG detection → Phase 999.6.
- Atlas-savings report inside OptimizeDialog → Phase 999.4.
- Recency-based auto-detection (mtime compare) — explicitly rejected.

## Phase Requirements

| ID      | Description                                                                                                                                                                                                                                  | Research Support                                                                                                                                                                                                                                                                                          |
|---------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| LOAD-01 | Loader detects "no `.atlas` file beside `.json`" and routes through a synthesized atlas instead of failing with `AtlasNotFoundError`. The current `AtlasNotFoundError` message is preserved for actually-missing-atlas cases (malformed project). | D-05/D-06 boundary at `loader.ts:188-193`. The current `try { fs.readFileSync(atlasPath) } catch { throw AtlasNotFoundError }` becomes a three-way branch: opts.atlasPath given → preserve throw (D-06); opts.atlasPath absent + sibling unreadable + loaderMode !== 'packed' → synthesize (D-05); else throw. |
| LOAD-02 | New `src/core/png-header.ts` reads width/height from PNG IHDR chunk via byte parsing only — no `sharp` / libvips / pixel decoding.                                                                                                            | Open Question 3 — full IHDR byte walk (24 bytes, no decompression). Layer 3 invariant preserved (`node:fs.readFileSync` only).                                                                                                                                                                            |
| LOAD-03 | New `src/core/synthetic-atlas.ts` constructs an in-memory `TextureAtlas` from per-region PNG headers when no `.atlas` file is present. Each synthesized region: name = PNG basename, dims = PNG header dims, page = the PNG file itself, x/y = 0/0, rotated = false. | D-12 + D-13 verdict (text-parser path). Spine-core's `TextureAtlas` constructor (`TextureAtlas.js:31-175`) auto-defaults u/v/u2/v2 (lines 162-171) and originalWidth/Height backfill (lines 152-155) when atlas text omits `orig:` and `offsets:` lines.                                                       |
| LOAD-04 | Round-trip — load `json + images folder` project (no `.atlas`) → sample (Global + Animation Breakdown panels populate) → export to `images-optimized/` succeeds end-to-end. Golden fixture covers the path.                                       | New fixture `fixtures/SIMPLE_PROJECT_NO_ATLAS/` derived by copying `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` + per-region PNGs (CIRCLE/SQUARE/TRIANGLE/SQUARE2) into a directory without the `.atlas` file. Existing `fixtures/EXPORT_PROJECT/` already has an `images/` folder + per-region PNGs and could double as a fixture seed. |

## Project Constraints (from CLAUDE.md)

- **Fact #4 (locked):** "The math phase does not decode PNGs." `png-header.ts` parses IHDR bytes — structurally distinct from decoding (no zlib, no IDAT). Layer 3 invariant preserved. ✅
- **Fact #5:** `core/` is pure TypeScript, no DOM. `node:fs.readFileSync` is already permitted (`loader.ts:30, 146, 190`). ✅
- **Locked memory `project_phase6_default_scaling.md`:** Uniform single-scale; never extrapolate. Atlas-less mode does NOT alter export math. ✅
- **Sampler lifecycle (Fact #3):** unchanged — synthesizer plants a real `TextureAtlas`, not a mock. ✅
- **GSD workflow:** `/gsd-plan-phase 21` is the next step.

## Open Questions Answered

### 1. Spine 4.2 JSON `nonessential` data field name + presence verification

**Verdict (HIGH confidence):** Spine 4.2 emits two top-level `skeleton.*` strings under "nonessential" data, **not per-attachment original-dims fields**. Per-attachment original dimensions are NOT serialized into Spine 4.2 JSON — only top-level paths.

**Verified:**
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.js:73-79`:
  ```
  // Nonessential
  /** The dopesheet FPS in Spine. Available only when nonessential data was exported. */
  fps = 0;
  /** The path to the images directory as defined in Spine. */
  imagesPath = null;
  /** The path to the audio directory as defined in Spine. */
  audioPath = null;
  ```
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:73-75`:
  ```
  skeletonData.fps = skeletonMap.fps;
  skeletonData.imagesPath = skeletonMap.images ?? null;
  skeletonData.audioPath = skeletonMap.audio ?? null;
  ```
- Confirmed in `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json:9-10`: `"images": "./IMAGES/"`, `"audio": "./audio"`. JSON-level nonessential data IS present in this fixture and IS being read by spine-core.
- Confirmed in `fixtures/Jokerman/JOKERMAN_SPINE.json:1-9`: `"images": "./images/"`, `"audio": "./audio"`.
- Confirmed in `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json:1-9`: `"images": "./images/"`, `"audio": "D:/Desktop/projects/.../JOKER"` (absolute Windows path).

**No per-attachment original-dim fields in 4.2 JSON.** SkeletonJson reads `region.width = map.width * scale` and `mesh.width = getValue(map, "width", 0) * scale` — but these are the canonical attachment dims AS DEFINED IN THE EDITOR (the un-packed authoritative size), NOT a separate "original PNG size" field. The packed atlas regions (rotated/cropped) are the deviation; the JSON's `width`/`height` ARE the canonical pre-pack dims.

**Implication for Phase 22 (informational only):**
- Phase 22's "canonical" dimension comes from the JSON attachment `.width` / `.height` (already-readable via `parsedJson.skins[*].attachments[slot][name].width`).
- "Actual source" dimension comes from Phase 21's `png-header.ts` (PNG IHDR bytes).
- Drift detection compares those two numbers per region. Both are present in atlas-less mode (no atlas required for either), so Phase 22 has firm ground.
- The 4.2 binary format DOES emit per-attachment color when `nonessential` (`SkeletonBinary.js:415, 422, 436, 457...`), but that's irrelevant to Phase 21/22 dim work.

**One small surprise — `imagesPath` field name:** the JSON key is `"images"`, but spine-core stores it as `skeletonData.imagesPath`. Phase 21's loader does NOT need to read this field (the loader uses `path.join(path.dirname(skeletonPath), 'images')` per `loader.ts:257` — the literal `'images'` directory name is a convention, not a JSON-derived value). If a future phase wants to honor a non-default `images` path, the field is named `imagesPath` on `skeletonData`.

### 2. Synthetic atlas construction strategy (D-13)

**Verdict (HIGH confidence): Use approach (a) — generate `.atlas` text and feed it to `new TextureAtlas(text)`.** Approach (b) (manual page/region construction) works but requires hand-rolling u/v/u2/v2 math + originalWidth/Height defaulting that the parser does for free.

**Verified — what the text parser does for free:**

`TextureAtlas.js:162-171` (constructor's region-finalization loop, after each region is parsed):
```javascript
region.u = region.x / page.width;
region.v = region.y / page.height;
if (region.degrees == 90) {
    region.u2 = (region.x + region.height) / page.width;
    region.v2 = (region.y + region.width) / page.height;
}
else {
    region.u2 = (region.x + region.width) / page.width;
    region.v2 = (region.y + region.height) / page.height;
}
```

For a one-region-per-page atlas where x=0, y=0, region.width=page.width, region.height=page.height: u=0, v=0, u2=1, v2=1. Clean.

`TextureAtlas.js:152-155` (originalWidth/Height auto-backfill):
```javascript
if (region.originalWidth == 0 && region.originalHeight == 0) {
    region.originalWidth = region.width;
    region.originalHeight = region.height;
}
```

So the synthesized atlas text doesn't need to emit `orig:` lines or `offsets:` lines — just `bounds:0,0,W,H` and the parser fills the rest.

**Atlas text format (verified by parser at `TextureAtlas.js:34-175`):**

The libgdx atlas grammar (4.2 dialect) is:
```
<page-name>.png
size: W,H
filter: Linear,Linear
<region-name>
bounds: 0,0,W,H
```
Blank line between pages. Page name is on its own line; region name is on its own line (NOT preceded by a token). Each `key: val,val,...` line is parsed by `readEntry` into `entry[0..4]` (`TextureAtlas.js:205-227`). Entry parsing tolerates whitespace around values.

**Sample for SIMPLE_TEST atlas-less mode:**
```
CIRCLE.png
size: 699,699
filter: Linear,Linear

CIRCLE
bounds: 0,0,699,699

SQUARE.png
size: 1000,1000
filter: Linear,Linear

SQUARE
bounds: 0,0,1000,1000

TRIANGLE.png
size: 833,759
filter: Linear,Linear

TRIANGLE
bounds: 0,0,833,759
```

(Page name and region name are deliberately the SAME string with the `.png` suffix added to the page name — the page is the file, the region is the name spine-core looks up.)

**Note on `pma` field:** `TextureAtlas.js:55-57` reads `pma: true|false`. Default (when omitted) is `pma = false` — the page constructor at `TextureAtlas.js:228-241` initializes `pma = false`. Synthesized atlas text can omit `pma:` entirely.

**Note on subfolder names (D-02):** Region name `AVATAR/FACE` is a single line — no escaping needed since the parser splits on `:` and `,`, not `/`. Verified by `TextureAtlas.js:120-121`: `page = new TextureAtlasPage(line.trim());` — line.trim() preserves internal slashes.

### 3. PNG IHDR byte structure for `png-header.ts`

**Verdict (HIGH confidence):** PNG signature is exactly **8 bytes**, immediately followed by the IHDR chunk which is the first chunk and always present per RFC 2083 / W3C PNG spec. A reader needs at most **24 bytes** of the file head to extract width and height.

**Byte layout:**
```
Offset  Size  Value                       Meaning
0       8     89 50 4E 47 0D 0A 1A 0A     PNG signature (\x89PNG\r\n\x1a\n)
8       4     00 00 00 0D                 IHDR chunk length (always 13, big-endian uint32)
12      4     49 48 44 52                 chunk type 'IHDR' (ASCII)
16      4     <width>                     image width (big-endian uint32)
20      4     <height>                    image height (big-endian uint32)
24      1     <bit_depth>                 1, 2, 4, 8, or 16 (irrelevant to dims)
25      1     <color_type>                0/2/3/4/6 (irrelevant to dims)
26      1     <compression_method>        always 0 (irrelevant to dims)
27      1     <filter_method>             always 0 (irrelevant to dims)
28      1     <interlace_method>          0 or 1 (irrelevant to dims)
29      4     <CRC>                       CRC-32 of bytes 12-28 (irrelevant; we don't validate)
```

**Pasteable byte-walk for the implementation prompt:**

```typescript
// src/core/png-header.ts
// Pure-TS PNG IHDR width/height reader. Reads at most 24 bytes from the file
// head — no decompression, no IDAT processing, no full-file load. Layer 3
// invariant preserved (no `sharp`/libvips/DOM).
//
// PNG spec reference: RFC 2083 / W3C PNG (Second Edition) §5.2-§5.3.
// IHDR is mandated to be the first chunk in every PNG (§5.6). This module
// trusts that invariant — a malformed file with a non-IHDR first chunk will
// throw PngHeaderParseError.

import * as fs from 'node:fs';
import { SpineLoaderError } from './errors.js';

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export class PngHeaderParseError extends SpineLoaderError {
  constructor(public readonly path: string, reason: string) {
    super(`Failed to read PNG header at ${path}: ${reason}`);
    this.name = 'PngHeaderParseError';
  }
}

export interface PngDims {
  width: number;
  height: number;
}

/**
 * Reads PNG width/height from the IHDR chunk via byte parsing only.
 * Reads exactly 24 bytes from the file head (PNG signature + IHDR length +
 * IHDR type + width + height); ignores remaining IHDR fields.
 *
 * Throws PngHeaderParseError on:
 *   - file unreadable
 *   - file shorter than 24 bytes
 *   - PNG signature mismatch
 *   - first chunk type is not 'IHDR'
 */
export function readPngDims(pngPath: string): PngDims {
  let buf: Buffer;
  try {
    // Open + read 24 bytes only; do NOT readFileSync the whole file (PNGs
    // can be hundreds of MB and we only need the head).
    const fd = fs.openSync(pngPath, 'r');
    try {
      buf = Buffer.alloc(24);
      const bytesRead = fs.readSync(fd, buf, 0, 24, 0);
      if (bytesRead < 24) {
        throw new PngHeaderParseError(pngPath, `file too short (read ${bytesRead} bytes, need 24)`);
      }
    } finally {
      fs.closeSync(fd);
    }
  } catch (err) {
    if (err instanceof PngHeaderParseError) throw err;
    throw new PngHeaderParseError(pngPath, err instanceof Error ? err.message : String(err));
  }

  // Verify PNG signature (bytes 0-7).
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== PNG_SIGNATURE[i]) {
      throw new PngHeaderParseError(pngPath, 'not a PNG file (signature mismatch)');
    }
  }

  // Verify first chunk is IHDR. Bytes 8-11 are length (must be 13 for IHDR).
  // Bytes 12-15 are chunk type (must be ASCII 'IHDR').
  if (buf[12] !== 0x49 || buf[13] !== 0x48 || buf[14] !== 0x44 || buf[15] !== 0x52) {
    throw new PngHeaderParseError(pngPath, 'first chunk is not IHDR');
  }

  // Width = big-endian uint32 at offset 16.
  // Height = big-endian uint32 at offset 20.
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);

  if (width === 0 || height === 0) {
    throw new PngHeaderParseError(pngPath, `IHDR reports zero-size image (${width}x${height})`);
  }

  return { width, height };
}
```

**Why `fs.openSync` + `readSync` instead of `fs.readFileSync`:** PNGs in real Spine projects can be tens or hundreds of megabytes. `readFileSync` slurps the whole file. The 24-byte head read is structurally honest — we are EXPLICITLY not loading pixel data, which preserves CLAUDE.md fact #4. Also avoids the V8 buffer-allocation hit on large PNGs.

**Endianness note:** PNG is **big-endian** (network byte order). Node's `Buffer.readUInt32BE` is the right method. Do NOT use `readUInt32LE`.

### 4. TextureAtlasRegion + TextureAtlasPage construction shape

**Verified field defaults (from `TextureAtlas.js:228-269`):**

```javascript
// TextureAtlasPage
class TextureAtlasPage {
    name;                                             // ctor arg
    minFilter = TextureFilter.Nearest;               // default; atlas text "filter:" overrides
    magFilter = TextureFilter.Nearest;
    uWrap = TextureWrap.ClampToEdge;
    vWrap = TextureWrap.ClampToEdge;
    texture = null;                                   // set later via setTexture()
    width = 0;                                        // atlas text "size:" sets this
    height = 0;
    pma = false;
    regions = new Array();                            // backref filled by region.ctor

    constructor(name) { this.name = name; }
}

// TextureAtlasRegion (extends TextureRegion)
class TextureAtlasRegion extends TextureRegion {
    page;                                             // ctor arg (not optional)
    name;                                             // ctor arg
    x = 0;
    y = 0;
    offsetX = 0;
    offsetY = 0;
    originalWidth = 0;                                // backfilled to width by parser if zero
    originalHeight = 0;
    index = 0;
    degrees = 0;
    names = null;                                     // for atlas custom-key arrays — null is fine
    values = null;
    // Inherited from TextureRegion: u, v, u2, v2, width, height, rotate, degrees, etc.

    constructor(page, name) {
        super();
        this.page = page;
        this.name = name;
        page.regions.push(this);
    }
}
```

**For a synthesized atlas-less region:**
- Page name: `<region.name>.png` (matches what `loader.ts:289` already expects when resolving page paths against the atlas dir; in atlas-less mode the atlas dir IS the imagesDir, so `path.join(imagesDir, page.name)` resolves correctly)
- Page width/height: PNG IHDR width/height
- Region.x = 0, Region.y = 0
- Region.width = page.width = PNG width
- Region.height = page.height = PNG height
- Region.originalWidth = Region.width (auto-backfilled by parser per TextureAtlas.js:152-155 — but the synthesizer can also emit explicitly)
- Region.degrees = 0 (NOT rotated)
- Region.index = 0
- Region.u = 0, .v = 0, .u2 = 1, .v2 = 1 (computed by parser per TextureAtlas.js:162-171)

**Texture attachment:** `page.setTexture(stubLoader(page.name))` — same path as canonical mode (`loader.ts:200-202`). D-14 is correct.

### 5. Region name walk source — exact iteration pattern

**Verified — `Skin.attachments` shape in 4.2:** `Array<StringMap<Attachment>>` keyed by `slotIndex` (`Skin.js:49`, used at `Skin.js:60-68` and `Skin.js:167+`).

**The iteration pattern already exists at `usage.ts:106-114`:**
```typescript
for (const skin of load.skeletonData.skins) {
  for (let slotIndex = 0; slotIndex < skin.attachments.length; slotIndex++) {
    const perSlot = skin.attachments[slotIndex];
    if (perSlot === undefined || perSlot === null) continue;
    for (const [attachmentName, attachment] of Object.entries(perSlot)) {
      // ... use attachmentName + attachment ...
    }
  }
}
```

**However — Phase 21 cannot use this pattern at synthesis time.** The synthesizer must walk the JSON BEFORE `SkeletonJson.readSkeletonData` runs (because that's when AtlasAttachmentLoader needs the atlas to exist). The walk must happen on the **parsed JSON object**, not on `skeletonData.skins`.

**JSON walk pattern (per `SkeletonJson.js:307-317`):**
```typescript
// parsedJson is the JSON.parse() result from loader.ts:164.
// SkeletonJson reads:
//   parsedJson.skins[]                   — Array
//   parsedJson.skins[i].name             — string
//   parsedJson.skins[i].attachments      — { [slotName]: { [entryName]: AttachmentMap } }
//
// AttachmentMap fields used by Phase 21:
//   .type    — 'region' | 'mesh' | 'linkedmesh' | 'path' | 'point' | 'clipping' | 'boundingbox'
//              (default = 'region' when absent — SkeletonJson.js:366)
//   .path    — string (region path used to look up TextureAtlas region; default = entryName)
//   .name    — string (overrides entryName as the attachment's display name; default = entryName)
//
// We only synthesize TextureAtlas regions for type ∈ {'region', 'mesh', 'linkedmesh'}.

interface JsonAttachment {
  type?: string;
  path?: string;
  name?: string;
}

function walkSyntheticRegionPaths(parsedJson: unknown): Set<string> {
  const paths = new Set<string>();
  const root = parsedJson as { skins?: Array<{ attachments?: Record<string, Record<string, JsonAttachment>> }> };
  for (const skin of root.skins ?? []) {
    for (const slotName in skin.attachments) {
      const slot = skin.attachments[slotName];
      for (const entryName in slot) {
        const att = slot[entryName];
        const type = att.type ?? 'region';
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        // The path the AtlasAttachmentLoader will look up (SkeletonJson.js:368, 401).
        const lookupPath = att.path ?? entryName;
        paths.add(lookupPath);
      }
    }
  }
  return paths;
}
```

**Why JSON walk and not SkeletonData walk:** chicken-and-egg. SkeletonJson.readSkeletonData calls AtlasAttachmentLoader.newRegionAttachment(skin, name, path, sequence). The atlas must exist BEFORE that call. So the synthesizer walks the parsed JSON to enumerate region paths, builds the atlas, THEN runs SkeletonJson.

**Note on `linkedmesh` type:** Same code path as `mesh` per `SkeletonJson.js:399-426`. linkedMesh attachments still call `newMeshAttachment` (line 403). They take a `path` field per line 401. Treat them identically to `mesh` for synthesis.

### 6. Subfolder-nested region names (D-02) — Windows path separators

**Verdict (HIGH confidence):** `path.join(imagesDir, region.name + '.png')` works correctly on Windows when `region.name = 'AVATAR/FACE'`. Node's `path.join` on Windows normalizes forward slashes to backslashes when needed for filesystem ops — `fs.readFileSync` accepts both separators on Windows.

**Verified:**
- `loader.ts:260` already uses this pattern in canonical mode.
- The Jokerman fixture (`fixtures/Jokerman/JOKERMAN_SPINE.json`) has 6 region attachments with nested paths like `'AVATAR/CARDS_L_HAND_1'`, and Phase 6 is already shipping with this code path on macOS, Windows, and Linux without separator complaints.

**Platform consideration for the planner:** the synthesized atlas TEXT contains the region name verbatim (with forward slashes). Spine's atlas format uses forward slashes natively (verified Spine 4.2 atlas examples in `fixtures/Jokerman/TOPSCREEN_ANIMATION_JOKER.atlas` if present). Do NOT normalize separators in the atlas text — keep them as forward slashes always. Filesystem ops (`fs.readFileSync(path.join(imagesDir, name + '.png'))`) are the only place where backslash conversion matters, and Node handles that automatically.

**Edge case to surface in Pitfalls:** if a region name starts with `'/'` or contains `'..'`, `path.join` could escape the imagesDir. See Pitfalls §3.

### 7. Spine 4.2 attachment types that resolve to a region

**Verdict (HIGH confidence):** **Three types** resolve to a TextureAtlas region: `region`, `mesh`, `linkedmesh`. The other four (`path`, `point`, `clipping`, `boundingbox`) do NOT.

**Verified:**

`SkeletonJson.js:363-471`:
- `case "region"` (line 367) → `attachmentLoader.newRegionAttachment(skin, name, path, sequence)` — needs atlas region
- `case "boundingbox"` (line 389) → `attachmentLoader.newBoundingBoxAttachment(skin, name)` — no atlas lookup
- `case "mesh"` (line 399) → `attachmentLoader.newMeshAttachment(skin, name, path, sequence)` — needs atlas region
- `case "linkedmesh"` (line 400, same case-block as mesh) → same `newMeshAttachment` call
- `case "path"` (line 428) → `attachmentLoader.newPathAttachment(skin, name)` — no atlas lookup
- `case "point"` (line 445) → `attachmentLoader.newPointAttachment(skin, name)` — no atlas lookup
- `case "clipping"` (line 457) → `attachmentLoader.newClippingAttachment(skin, name)` — no atlas lookup

`AtlasAttachmentLoader.js:54-91`:
- `newRegionAttachment` calls `this.atlas.findRegion(path)` and THROWS if null (line 62)
- `newMeshAttachment` calls `this.atlas.findRegion(path)` and THROWS if null (line 75)
- `newBoundingBoxAttachment`, `newPathAttachment`, `newPointAttachment`, `newClippingAttachment` all return a fresh attachment without consulting the atlas

**Already verified at `usage.ts:115-118`:** the existing code filters on `load.sourceDims.get(attachmentName) === undefined` to exclude non-textured types. Phase 21's synthesizer takes the inverse approach: filter ON `type ∈ {region, mesh, linkedmesh}` at JSON-walk time.

**Sequence attachments (`Sequence.js`):** `SkeletonJson.js:369, 402` call `this.readSequence(getValue(map, "sequence", null))`. If a sequence is present, `loadSequence` (`AtlasAttachmentLoader.js:44-53`) iterates sequence regions and EACH ONE throws if missing. For Phase 21 atlas-less mode: the SilentSkipAttachmentLoader wrapper (Open Question 1) must handle sequences too — pre-walk the JSON to get every sequence region path AND every base region path. But verify via fixture inspection: the SIMPLE/EXPORT/Jokerman fixtures don't appear to use the `sequence:` block — Phase 21 can ship without sequence support if no fixture exercises it. Surface as a **known gap**: a project with `sequence:` blocks in atlas-less mode may crash; Phase 21 won't fix that; flag as Phase 999 follow-up if it surfaces.

### 8. Validation Architecture for Nyquist Dimension 8

**Test boundary contract:** Phase 21 introduces three new test layers:

1. **Unit tests for `png-header.ts`** — byte-level correctness against fixture PNGs. Concrete (filename, expected dims) pairs:
   - `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png` → known dims (read with `sips -g pixelWidth -g pixelHeight` or `file` to populate the test)
   - `fixtures/EXPORT_PROJECT/images/CIRCLE.png`, `SQUARE.png`, `TRIANGLE.png`, `SQUARE2.png` → 4 known-dim pairs from the existing on-disk fixture
   - Negative cases: empty file (< 24 bytes); non-PNG file (signature mismatch); truncated file; corrupted IHDR

2. **Unit tests for `synthetic-atlas.ts`** — atlas-text generation correctness:
   - Given a parsed JSON skeleton and an imagesDir of known PNGs, the synthesizer produces atlas text that `new TextureAtlas(text)` accepts without throw
   - Each output region has expected name, width, height, x=0, y=0, degrees=0
   - `findRegion(path)` returns non-null for each JSON-referenced path that has a corresponding PNG
   - Subfolder paths preserve forward slashes
   - Per-region missing PNG → silent skip; `findRegion` returns null for that name; SkeletonJson silently drops the attachment without throw

3. **Round-trip integration test** — end-to-end load → sample → exportPlan computation against a new fixture `fixtures/SIMPLE_PROJECT_NO_ATLAS/`:
   - Load returns `LoadResult` with `atlasPath: null`
   - `sourceDims` map has entries for CIRCLE/SQUARE/TRIANGLE/SQUARE2 with `source: 'png-header'`
   - `sourcePaths` map matches `images/<name>.png` for each
   - Sampler produces non-empty `globalPeaks` for each animation
   - `buildExportPlan` produces a non-empty plan whose source paths exist on disk
   - Export pipeline (image-worker.ts) successfully reads each PNG and produces an output (smoke-tested via mocked sharp)

**Golden fixtures:**
- Existing: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json`, `fixtures/EXPORT_PROJECT/EXPORT.json` + `images/`
- NEW: `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` + `images/CIRCLE.png` + `images/SQUARE.png` + `images/TRIANGLE.png` + `images/SQUARE2.png` (copied from existing fixtures)
- NEW: `tests/core/png-header.spec.ts`, `tests/core/synthetic-atlas.spec.ts`, `tests/core/loader-atlas-less.spec.ts`

**Observable invariants (test assertions):**

| ID    | Invariant                                                                                                                       | Test                                                                                                                |
|-------|-----------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| INV-1 | `readPngDims(SIMPLE_PROJECT/SIMPLE_TEST.png)` returns the exact byte width/height shown by `sips` / `identify`                 | `tests/core/png-header.spec.ts`                                                                                     |
| INV-2 | `readPngDims` throws `PngHeaderParseError` on non-PNG, truncated, or zero-byte input                                           | `tests/core/png-header.spec.ts`                                                                                     |
| INV-3 | `synthesizeAtlas(parsedJson, imagesDir)` produces atlas text that `new TextureAtlas(text)` accepts                             | `tests/core/synthetic-atlas.spec.ts`                                                                                |
| INV-4 | Every `region/mesh/linkedmesh` attachment in the JSON whose PNG exists on disk has a corresponding region in the synthesized atlas (queried via `atlas.findRegion(path)`) | `tests/core/synthetic-atlas.spec.ts`                                                                                |
| INV-5 | Per-region missing PNG → atlas does NOT contain that region; SkeletonJson.readSkeletonData does NOT throw                       | `tests/core/loader-atlas-less.spec.ts`                                                                              |
| INV-6 | Catastrophic case (`images/` absent OR empty + JSON has ≥1 region) → loader throws `MissingImagesDirError` with `.name === 'MissingImagesDirError'` | `tests/core/loader-atlas-less.spec.ts`                                                                              |
| INV-7 | When `opts.atlasPath` is explicitly provided and unreadable, loader STILL throws `AtlasNotFoundError` (D-06)                    | `tests/core/loader.spec.ts` (extension)                                                                             |
| INV-8 | `LoadResult.atlasPath === null` in atlas-less mode; consumers (`summary.atlasPath`) propagate null without crashing             | `tests/core/loader-atlas-less.spec.ts` + `tests/main/summary.spec.ts`                                               |
| INV-9 | Round-trip: load atlas-less project → sample → exportPlan → image-worker.runExport produces same number of output PNGs as canonical-mode equivalent | `tests/core/loader-atlas-less.spec.ts` (smoke level; mock sharp)                                                    |
| INV-10| `SkeletonSummary.atlasPath: string \| null` propagates correctly through IPC envelope (D-03 cascade)                            | `tests/main/ipc.spec.ts` (extension)                                                                                |

**Test framework:** vitest 4.0 (per package.json:`vitest`). Test command: `npm run test`. Existing test files at `tests/core/` follow the convention `tests/core/<module>.spec.ts`.

## Implementation Approaches

### D-13 verdict: Text-based synthesis (approach a)

**Code shape:**

```typescript
// src/core/synthetic-atlas.ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextureAtlas, AtlasAttachmentLoader, type Attachment, type Sequence, type Skin } from '@esotericsoftware/spine-core';
import { readPngDims, PngHeaderParseError } from './png-header.js';
import { SpineLoaderError } from './errors.js';
import type { SourceDims } from './types.js';

export class MissingImagesDirError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
    public readonly missingPngs?: string[],
  ) {
    const trail = missingPngs && missingPngs.length > 0
      ? `\n  Missing PNGs:\n${missingPngs.map((p) => '    ' + p).join('\n')}`
      : '';
    super(
      `Atlas-less mode requires an images/ folder beside the .json with per-region PNG files. ` +
      `Either provide a .atlas file or populate images/ with the referenced PNGs.\n` +
      `  Skeleton: ${skeletonPath}\n  Searched: ${searchedPath}${trail}`,
    );
    this.name = 'MissingImagesDirError';
  }
}

interface SynthResult {
  atlasText: string;
  pngPathsByRegionName: Map<string, string>;  // region.name → absolute PNG path (D-16)
  dimsByRegionName: Map<string, { w: number; h: number }>; // for sourceDims map (D-15)
}

/**
 * Walks parsedJson.skins[*].attachments to enumerate region/mesh/linkedmesh
 * paths. For each unique path, attempts to read PNG dims from images/<path>.png.
 * Returns synthesized atlas text + per-region metadata for downstream maps.
 *
 * D-09: missing PNG silently skipped (not added to atlas text).
 * D-10: catastrophic case (no images/ dir, or empty + JSON has region refs) → throw.
 */
export function synthesizeAtlasText(
  parsedJson: unknown,
  imagesDir: string,
  skeletonPath: string,
): SynthResult {
  // Pre-flight images/ folder existence
  let imagesDirExists = false;
  try {
    const stat = fs.statSync(imagesDir);
    imagesDirExists = stat.isDirectory();
  } catch {
    imagesDirExists = false;
  }

  const regionPaths = walkSyntheticRegionPaths(parsedJson);

  if (!imagesDirExists && regionPaths.size > 0) {
    throw new MissingImagesDirError(imagesDir, skeletonPath, [...regionPaths].map((p) => p + '.png'));
  }

  const lines: string[] = [];
  const pngPathsByRegionName = new Map<string, string>();
  const dimsByRegionName = new Map<string, { w: number; h: number }>();
  const missingPngs: string[] = [];

  for (const regionName of regionPaths) {
    const pngPath = path.resolve(path.join(imagesDir, regionName + '.png'));
    let dims;
    try {
      dims = readPngDims(pngPath);
    } catch (err) {
      // D-09: silent skip per-region missing PNG
      missingPngs.push(regionName + '.png');
      continue;
    }
    // Atlas text format: blank line between pages
    if (lines.length > 0) lines.push('');
    lines.push(regionName + '.png');
    lines.push(`size: ${dims.width},${dims.height}`);
    lines.push('filter: Linear,Linear');
    lines.push('');                        // blank line ends page header
    lines.push(regionName);
    lines.push(`bounds: 0,0,${dims.width},${dims.height}`);
    pngPathsByRegionName.set(regionName, pngPath);
    dimsByRegionName.set(regionName, { w: dims.width, h: dims.height });
  }

  // D-10: empty images/ folder + JSON has region refs → catastrophic
  if (regionPaths.size > 0 && pngPathsByRegionName.size === 0) {
    throw new MissingImagesDirError(imagesDir, skeletonPath, missingPngs);
  }

  return {
    atlasText: lines.join('\n'),
    pngPathsByRegionName,
    dimsByRegionName,
  };
}

function walkSyntheticRegionPaths(parsedJson: unknown): Set<string> {
  const paths = new Set<string>();
  const root = parsedJson as {
    skins?: Array<{
      attachments?: Record<string, Record<string, { type?: string; path?: string; name?: string }>>;
    }>;
  };
  for (const skin of root.skins ?? []) {
    for (const slotName in skin.attachments) {
      const slot = skin.attachments![slotName];
      for (const entryName in slot) {
        const att = slot[entryName];
        const type = att.type ?? 'region';
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        const lookupPath = att.path ?? entryName;
        paths.add(lookupPath);
      }
    }
  }
  return paths;
}

/**
 * AttachmentLoader subclass that returns null instead of throwing when a region
 * is missing from the atlas. SkeletonJson.readAttachment handles null returns
 * gracefully (silently skips the attachment) — D-09.
 *
 * Subclasses spine-core's AtlasAttachmentLoader so we inherit identical
 * behavior on the happy path; only override the two methods that throw.
 */
export class SilentSkipAttachmentLoader extends AtlasAttachmentLoader {
  newRegionAttachment(skin: Skin, name: string, attachmentPath: string, sequence: Sequence | null): Attachment | null {
    if (this.atlas.findRegion(attachmentPath) === null) return null;
    return super.newRegionAttachment(skin, name, attachmentPath, sequence);
  }
  newMeshAttachment(skin: Skin, name: string, attachmentPath: string, sequence: Sequence | null): Attachment | null {
    if (this.atlas.findRegion(attachmentPath) === null) return null;
    return super.newMeshAttachment(skin, name, attachmentPath, sequence);
  }
}
```

**How it slots into loader.ts:**

```typescript
// loader.ts new D-05 fall-through (replaces lines 188-193)

let atlas: TextureAtlas;
let resolvedAtlasPath: string | null = atlasPath;
let synthSourcePaths: Map<string, string> | null = null;
let synthDims: Map<string, { w: number; h: number }> | null = null;
let isAtlasLess = false;

// D-08: per-project loaderMode override (forces atlas-less even if .atlas exists)
const forceAtlasLess = opts.loaderMode === 'atlas-less';

// D-05/D-06: branch based on whether opts.atlasPath was explicit
if (opts.atlasPath !== undefined) {
  // D-06: explicit atlasPath — ALWAYS try to read; throw verbatim AtlasNotFoundError
  try {
    atlasText = fs.readFileSync(opts.atlasPath, 'utf8');
  } catch {
    throw new AtlasNotFoundError(opts.atlasPath, skeletonPath);
  }
  // ... existing canonical path
} else if (forceAtlasLess) {
  // D-08: override forces atlas-less even if .atlas exists
  // synthesize ...
} else {
  // D-05: try sibling .atlas first, fall through to synthesis on read failure
  try {
    atlasText = fs.readFileSync(siblingAtlasPath, 'utf8');
    // ... existing canonical path
  } catch {
    // synthesize ...
  }
}

// In the synthesize branch:
const imagesDir = path.join(path.dirname(skeletonPath), 'images');
const synth = synthesizeAtlasText(parsedJson, imagesDir, skeletonPath);
atlas = new TextureAtlas(synth.atlasText);
const stubLoader = createStubTextureLoader();
for (const page of atlas.pages) {
  page.setTexture(stubLoader(page.name));
}
synthSourcePaths = synth.pngPathsByRegionName;
synthDims = synth.dimsByRegionName;
resolvedAtlasPath = null;  // D-03
isAtlasLess = true;

// SkeletonJson uses SilentSkipAttachmentLoader in atlas-less mode
const attachmentLoader = isAtlasLess
  ? new SilentSkipAttachmentLoader(atlas)
  : new AtlasAttachmentLoader(atlas);
const skeletonJson = new SkeletonJson(attachmentLoader);
const skeletonData = skeletonJson.readSkeletonData(parsedJson);
```

**Maps (D-15, D-16, D-17) in atlas-less mode:**
- `sourceDims`: from `synth.dimsByRegionName`, with `source: 'png-header'`
- `sourcePaths`: directly from `synth.pngPathsByRegionName`
- `atlasSources`: synthesized from synth maps — `pagePath = pngPathsByRegionName.get(name)`, `x=0, y=0, w/h = dimsByRegionName.get(name)`, `rotated=false`

## Validation Architecture

### Test Framework

| Property             | Value                                      |
|----------------------|--------------------------------------------|
| Framework            | vitest 4.0                                 |
| Config file          | `vitest.config.ts` (existing) + per-test  |
| Quick run command    | `npx vitest run tests/core/png-header.spec.ts tests/core/synthetic-atlas.spec.ts tests/core/loader-atlas-less.spec.ts -x` |
| Full suite command   | `npm run test`                             |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                                              | Test Type   | Automated Command                                                                                      | File Exists? |
|---------|---------------------------------------------------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------------------|---------------|
| LOAD-01 | Loader detects no `.atlas`, synthesizes, returns valid LoadResult; AtlasNotFoundError preserved for explicit-path case | unit + smoke| `npx vitest run tests/core/loader-atlas-less.spec.ts -x`                                                | ❌ Wave 0     |
| LOAD-02 | `png-header.ts` reads IHDR bytes correctly; throws on malformed; no `sharp` import                   | unit        | `npx vitest run tests/core/png-header.spec.ts -x`                                                       | ❌ Wave 0     |
| LOAD-03 | `synthetic-atlas.ts` produces valid atlas; spine-core consumes it without complaint                  | unit + smoke| `npx vitest run tests/core/synthetic-atlas.spec.ts -x`                                                  | ❌ Wave 0     |
| LOAD-04 | Round-trip load→sample→exportPlan against atlas-less fixture                                          | integration | `npx vitest run tests/core/loader-atlas-less.spec.ts -x` (mock sharp at the runExport boundary)        | ❌ Wave 0     |

### Sampling Rate

- **Per task commit:** `npx vitest run tests/core/png-header.spec.ts tests/core/synthetic-atlas.spec.ts tests/core/loader-atlas-less.spec.ts -x`
- **Per wave merge:** `npm run test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/core/png-header.spec.ts` — covers LOAD-02 (PNG byte parsing happy path + 4 negative paths)
- [ ] `tests/core/synthetic-atlas.spec.ts` — covers LOAD-03 (atlas text generation + spine-core acceptance + silent-skip)
- [ ] `tests/core/loader-atlas-less.spec.ts` — covers LOAD-01 + LOAD-04 (loader integration + round-trip)
- [ ] `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` + `images/CIRCLE.png` + `images/SQUARE.png` + `images/TRIANGLE.png` + `images/SQUARE2.png` — golden fixture
- [ ] Extension to `tests/core/loader.spec.ts` to cover D-06 (explicit-atlas-path-throws-AtlasNotFoundError preserved)
- [ ] Extension to `tests/main/summary.spec.ts` for INV-8 (atlasPath null propagation)
- [ ] Extension to `tests/main/ipc.spec.ts` for D-10 (`MissingImagesDirError` in `KNOWN_KINDS` and routes through SerializableError envelope)
- Framework already installed; no `npm install` step needed

## Pitfalls & Edge Cases

### Pitfall 1: AtlasAttachmentLoader throws on missing region — D-09 cannot be done by stock loader

**What goes wrong:** Plan author assumes "synthesize a partial atlas" + "stock AtlasAttachmentLoader" silently drops orphans. In reality, `AtlasAttachmentLoader.newRegionAttachment` and `newMeshAttachment` THROW `Error("Region not found in atlas: ...")` (`AtlasAttachmentLoader.js:62, 75`).

**Why it happens:** Stock loader's contract IS to throw — the `AttachmentLoader` interface allows null returns, but the AtlasAttachmentLoader implementation doesn't use that affordance.

**How to avoid:** Subclass `AtlasAttachmentLoader` with `SilentSkipAttachmentLoader` that returns null when `atlas.findRegion(path)` is null. Verified by `SkeletonJson.js:371-372, 404-405`: spine-core's `readAttachment` checks `if (!region)` / `if (!mesh)` and returns null, which then flows through `SkeletonJson.js:313-314`'s `if (attachment) skin.setAttachment(...)` for clean silent-skip.

**Warning signs:** `tests/core/synthetic-atlas.spec.ts` test "missing-png does not crash SkeletonJson" fails with "Region not found in atlas" if the planner forgets to use SilentSkipAttachmentLoader.

### Pitfall 2: Region lookup uses `path` field, not entry-name key

**What goes wrong:** Synthesizer iterates `Object.entries(slot)` and uses the key (e.g., `'CARDS_L_HAND_1'`) as the synthesized region name. AtlasAttachmentLoader looks up by the JSON `path` field (e.g., `'AVATAR/CARDS_L_HAND_1'`). Mismatch → "Region not found".

**Why it happens:** Six of 23 region attachments in the Jokerman fixture have `path` distinct from the entry-name key. Spine editor's "Path" field is exactly this — re-target an attachment to a different atlas region path.

**How to avoid:** Synthesizer reads `att.path ?? entryName` (fallback to entry-name only when `path` field is absent). Mirrors `SkeletonJson.js:368, 401`'s `getValue(map, "path", name)`.

**Warning signs:** Atlas-less mode loads correctly on SIMPLE_PROJECT/EXPORT_PROJECT (no `path` field) but fails on Jokerman-shape projects with "Region not found in atlas: AVATAR/CARDS_L_HAND_1".

### Pitfall 3: Region name with `..` or leading `/` could escape imagesDir

**What goes wrong:** Malicious or malformed JSON has `path: '../../../etc/passwd'`. `path.join(imagesDir, '../../../etc/passwd' + '.png')` resolves OUTSIDE imagesDir.

**Why it happens:** `path.join` normalizes `..` segments without bounds-checking.

**How to avoid:** Sanitize at synthesizer boundary:
```typescript
const resolvedPng = path.resolve(path.join(imagesDir, regionName + '.png'));
const resolvedImagesDir = path.resolve(imagesDir);
if (!resolvedPng.startsWith(resolvedImagesDir + path.sep) && resolvedPng !== resolvedImagesDir) {
  // Suspicious path — silent skip with diagnostic log
  continue;
}
```
Note: this is a defensive measure, not the primary security model — Spine JSON itself is user-trusted input. But Phase 21 is broadening the surface that reads filesystem paths from JSON, so a single boundary check is cheap insurance.

**Warning signs:** No production fixture exhibits this, so this is a defensive Pitfall, not a Test Plan item. Surface in code review checklist.

### Pitfall 4: Page-name collision when two regions share a basename across folders

**What goes wrong:** JSON has two attachments: `path: 'AVATAR/HEAD'` and `path: 'PROPS/HEAD'`. Synthesized atlas has two regions both named `HEAD`? No — region names ARE the full path (`AVATAR/HEAD` and `PROPS/HEAD`). But both pages would be named `HEAD.png` if naive.

**How to avoid:** Synthesized page name is the FULL region name + `.png`, NOT the basename:
- region.name = `'AVATAR/HEAD'` → page.name = `'AVATAR/HEAD.png'`
- region.name = `'PROPS/HEAD'` → page.name = `'PROPS/HEAD.png'`

This uniqueness is automatic if synthesizer code does `page-name = regionName + '.png'`. Verified — `loader.ts:289` already does `path.resolve(path.join(atlasDir, region.page.name))` and treats the page name as the full subpath.

**Warning signs:** If `findRegion('PROPS/HEAD')` returns the AVATAR/HEAD region, the planner emitted page names by basename instead of full-path.

### Pitfall 5: `images/` folder absent vs empty — different error semantics?

**What goes wrong:** Per D-10, the catastrophic case is "no `images/` folder OR empty `images/` folder AND JSON has ≥1 region attachment". Planner conflates "no folder" (ENOENT on `fs.statSync`) with "folder exists but empty" (`readdirSync.length === 0`).

**How to avoid:** Synthesizer explicitly distinguishes:
- `fs.statSync(imagesDir)` ENOENT → `imagesDirExists = false`. If JSON has region refs → throw `MissingImagesDirError(imagesDir, skel)` BEFORE attempting any PNG reads.
- folder exists but every per-region PNG read throws → also catastrophic; throw `MissingImagesDirError` with the full missingPngs list.
- folder exists, some PNGs read, some missing → silent skip per D-09 (loader returns LoadResult with partial atlas).

D-10 message lists ALL missing PNGs (D-11), so the error message branches are useful diagnostics in both sub-cases.

**Warning signs:** A user with a partially-empty `images/` folder gets a confusing "AtlasNotFoundError" instead of "MissingImagesDirError" if the planner crosses the wires.

### Pitfall 6: `loaderMode` field in `.stmproj` — how to default + migrate

**What goes wrong:** Existing `.stmproj` files (Phase 8 vintage) have no `loaderMode` field. `validateProjectFile` rejects them with `'invalid-shape'` if Phase 21 makes it strict-required.

**How to avoid:** Mirror the Phase 20 documentation pre-massage at `project-file.ts:140-152`:
```typescript
// Phase 21 — pre-massage: legacy stmproj has no loaderMode field; default to 'auto'.
if (obj.loaderMode === undefined) {
  obj.loaderMode = 'auto';
}
// Then validate the now-present field
if (obj.loaderMode !== 'auto' && obj.loaderMode !== 'atlas-less') {
  return { ok: false, error: { kind: 'invalid-shape', message: "loaderMode is not 'auto' | 'atlas-less'" } };
}
```
Plus extend `ProjectFileV1` and `AppSessionState` (`shared/types.ts:670, 692`) with `loaderMode: 'auto' | 'atlas-less'`. `materializeProjectFile` and `serializeProjectFile` (in `project-file.ts:267-287, 355-372`) thread it through.

**Warning signs:** Loading a Phase-8-vintage `.stmproj` after Phase 21 ships throws `'invalid-shape': loaderMode is not auto|atlas-less'` — sign that the pre-massage step is missing.

### Pitfall 7: Sequence attachments crash even with SilentSkipAttachmentLoader

**What goes wrong:** A spine project with `sequence: { count: 3, ... }` blocks calls `loadSequence` (`AtlasAttachmentLoader.js:44-53`) which throws on missing region. SilentSkipAttachmentLoader's overrides handle non-sequence calls but `loadSequence` is called inside `super.newRegionAttachment` — wrapping it requires more than the simple null-check override.

**How to avoid:** `synthesizeAtlasText` JSON walker must ALSO walk `sequence.regions` — Spine 4.2 sequences resolve via `Sequence.getPath(basePath, i)` (`Sequence.js`). For Phase 21, audit fixtures: SIMPLE/EXPORT/Jokerman do NOT use sequences. Document as a known gap; do NOT plan to fully support sequences in Phase 21. If a real fixture surfaces, file as Phase 999 follow-up.

**Warning signs:** Atlas-less load of a project with `sequence:` blocks crashes with "Region not found in atlas: <sequenceName>0001 (sequence: <name>)".

### Pitfall 8: D-03 cascade misses a renderer site → AppShell crashes on null

**What goes wrong:** `LoadResult.atlasPath: string | null` propagates through `summary.atlasPath` to renderer. AppShell.tsx:1053 passes `summary.atlasPath` to `resampleProject({...atlasPath: summary.atlasPath})` whose handler at `project-io.ts:840` checks `typeof a.atlasPath === 'string'` — null is silently coerced to undefined which is the right behavior, BUT a `??` fall-back somewhere downstream that expects `string` would crash.

**How to avoid:** Audit list (CONTEXT.md provides):
- `summary.ts:115` — `atlasPath: load.atlasPath` (passes null through; consumers must accept null in the `SkeletonSummary.atlasPath` type — currently `string`, must become `string | null`)
- `project-io.ts:400-406, 484-486, 891` — `materialized.atlasPath !== null` guards already in place ✅
- `project-io.ts:840` — `typeof a.atlasPath === 'string'` — null already routed to `undefined` correctly ✅
- `AppShell.tsx:612-613` — `atlasPath: summary.atlasPath ?? null` — already defensive ✅
- `AppShell.tsx:1053` — `atlasPath: summary.atlasPath` — passing through; project-io.ts:840 handles null gracefully ✅
- `sampler-worker.ts:102` — `params.atlasRoot ? { atlasPath: params.atlasRoot } : {}` — already conditional ✅

**Crucial type changes:** `shared/types.ts:494` `SkeletonSummary.atlasPath: string` → `string | null`. `src/core/types.ts:36` `LoadResponse.atlasPath: string` → `string | null`.

**Warning signs:** TypeScript compiler errors after the type change point to every consumer that needs adjustment. Run `npm run typecheck` after the type widening.

### Pitfall 9: D-08 override semantics — `loaderMode === 'atlas-less'` should skip ATLAS RESOLVE entirely

**What goes wrong:** Planner implements D-08 as "default to atlas-less when sibling .atlas missing", which is just D-05 again. D-08 is stronger: it should bypass the .atlas read EVEN IF the file exists.

**How to avoid:** Branch order in loader:
```
if (opts.atlasPath !== undefined) → canonical (D-06 throws on read fail)
else if (loaderMode === 'atlas-less') → synthesize (skip .atlas read entirely, D-08)
else if (sibling .atlas readable) → canonical
else → synthesize (D-05 fall-through)
```

**Warning signs:** A user toggles "Use Images Folder as Source" on a project with a stale `.atlas`, the app still loads the stale atlas — sign that D-08 was confused with D-05.

### Pitfall 10: Atlas text grammar — first non-empty line is taken as page name

**What goes wrong:** Generator emits a leading blank line or comment in atlas text. Parser treats first non-empty line as a page name (`TextureAtlas.js:96-100, 113-130`). Page name becomes the comment / wrong string.

**How to avoid:** Synthesizer first line is the first page name (no header preamble). Atlas grammar has NO comments; do not emit any.

**Warning signs:** Spine-core throws "name is null" or atlas regions don't resolve.

## Spine-Core 4.2 Reference Excerpts

### TextureAtlas constructor — region-finalization loop (TextureAtlas.js:152-171)

```javascript
// (After all region key:value lines parsed)
if (region.originalWidth == 0 && region.originalHeight == 0) {
    region.originalWidth = region.width;
    region.originalHeight = region.height;
}
if (names && names.length > 0 && values && values.length > 0) {
    region.names = names;
    region.values = values;
    names = null;
    values = null;
}
region.u = region.x / page.width;
region.v = region.y / page.height;
if (region.degrees == 90) {
    region.u2 = (region.x + region.height) / page.width;
    region.v2 = (region.y + region.width) / page.height;
}
else {
    region.u2 = (region.x + region.width) / page.width;
    region.v2 = (region.y + region.height) / page.height;
}
this.regions.push(region);
```

**Implication:** A synthesized atlas region with `bounds:0,0,W,H` and a page sized `W,H` produces u=0, v=0, u2=1, v2=1 — region fills the entire page. originalWidth/originalHeight are auto-backfilled to W/H.

### TextureAtlasReader.readEntry — entry parsing (TextureAtlas.js:205-227)

```javascript
readEntry(entry, line) {
    if (!line) return 0;
    line = line.trim();
    if (line.length == 0) return 0;
    let colon = line.indexOf(':');
    if (colon == -1) return 0;
    entry[0] = line.substr(0, colon).trim();
    for (let i = 1, lastMatch = colon + 1;; i++) {
        let comma = line.indexOf(',', lastMatch);
        if (comma == -1) {
            entry[i] = line.substr(lastMatch).trim();
            return i;
        }
        entry[i] = line.substr(lastMatch, comma - lastMatch).trim();
        lastMatch = comma + 1;
        if (i == 4) return 4;
    }
}
```

**Implication:** Entries are `<key>: <val1>,<val2>,<val3>,<val4>` with whitespace tolerated. Maximum 4 values per entry. Lines without `:` return 0 and are skipped silently (used as separators).

### TextureAtlas page/region top-level parser loop (TextureAtlas.js:113-175)

```javascript
let page = null;
let names = null;
let values = null;
while (true) {
    if (line === null) break;
    if (line.trim().length == 0) {
        page = null;                                  // Blank line ends current page
        line = reader.readLine();
    }
    else if (!page) {                                 // First non-empty line after blank = new page name
        page = new TextureAtlasPage(line.trim());
        while (true) {
            if (reader.readEntry(entry, line = reader.readLine()) == 0) break;
            let field = pageFields[entry[0]];
            if (field) field(page);
        }
        this.pages.push(page);
    }
    else {                                            // Within a page, line = region name
        let region = new TextureAtlasRegion(page, line);
        while (true) {
            let count = reader.readEntry(entry, line = reader.readLine());
            if (count == 0) break;
            let field = regionFields[entry[0]];
            if (field) field(region);
            else { /* custom names/values */ }
        }
        // ... originalWidth backfill + u/v compute (lines 152-171 above)
        this.regions.push(region);
    }
}
```

**Implication:** Atlas text format is page-name → page-fields → blank-line-separated region(s) → blank line → next page. Synthesizer can emit one page per region with this grammar.

### AtlasAttachmentLoader.newRegionAttachment — THROWS on missing region (AtlasAttachmentLoader.js:54-66)

```javascript
newRegionAttachment(skin, name, path, sequence) {
    let attachment = new RegionAttachment(name, path);
    if (sequence != null) {
        this.loadSequence(name, path, sequence);
    }
    else {
        let region = this.atlas.findRegion(path);
        if (!region)
            throw new Error("Region not found in atlas: " + path + " (region attachment: " + name + ")");
        attachment.region = region;
    }
    return attachment;
}
```

**Implication:** D-09 silent-skip requires SilentSkipAttachmentLoader subclass.

### AtlasAttachmentLoader.newMeshAttachment — same pattern (AtlasAttachmentLoader.js:67-79)

```javascript
newMeshAttachment(skin, name, path, sequence) {
    let attachment = new MeshAttachment(name, path);
    if (sequence != null) {
        this.loadSequence(name, path, sequence);
    }
    else {
        let region = this.atlas.findRegion(path);
        if (!region)
            throw new Error("Region not found in atlas: " + path + " (mesh attachment: " + name + ")");
        attachment.region = region;
    }
    return attachment;
}
```

### SkeletonJson.readAttachment — null-attachment graceful path (SkeletonJson.js:367-426)

```javascript
case "region": {
    let path = getValue(map, "path", name);
    let sequence = this.readSequence(getValue(map, "sequence", null));
    let region = this.attachmentLoader.newRegionAttachment(skin, name, path, sequence);
    if (!region)
        return null;                              // ← KEY: null attachment is graceful
    region.path = path;
    // ... populate region.x/y/scaleX/scaleY/rotation/width/height/color
    return region;
}
// ... case "mesh": same pattern at lines 399-427 ...
```

### SkeletonJson skin attachment iteration — null-attachment skip (SkeletonJson.js:307-317)

```javascript
for (let slotName in skinMap.attachments) {
    let slot = skeletonData.findSlot(slotName);
    if (!slot)
        throw new Error(`Couldn't find slot ${slotName} for skin ${skinMap.name}.`);
    let slotMap = skinMap.attachments[slotName];
    for (let entryName in slotMap) {
        let attachment = this.readAttachment(slotMap[entryName], skin, slot.index, entryName, skeletonData);
        if (attachment)
            skin.setAttachment(slot.index, entryName, attachment);
    }
}
```

**Implication:** `if (attachment)` gate — null attachments are silently dropped. SilentSkipAttachmentLoader's null returns flow through here cleanly.

### SkeletonData nonessential fields (SkeletonData.js:73-79)

```javascript
// Nonessential
/** The dopesheet FPS in Spine. Available only when nonessential data was exported. */
fps = 0;
/** The path to the images directory as defined in Spine. Available only when nonessential data was exported. May be null. */
imagesPath = null;
/** The path to the audio directory as defined in Spine. Available only when nonessential data was exported. May be null. */
audioPath = null;
```

### SkeletonJson reads nonessential fields (SkeletonJson.js:73-75)

```javascript
skeletonData.fps = skeletonMap.fps;
skeletonData.imagesPath = skeletonMap.images ?? null;
skeletonData.audioPath = skeletonMap.audio ?? null;
```

**Implication:** Spine 4.2 JSON nonessential data is **top-level skeleton.images/audio/fps strings only**. No per-attachment original-dim fields exist in 4.2 JSON. Per-attachment `width`/`height` ARE present (`SkeletonJson.js:379-380, 410-411`) but those are the canonical authoring dims, not a separate "original PNG size" field.

### Skin.attachments shape (Skin.js:60-68)

```javascript
setAttachment(slotIndex, name, attachment) {
    if (!attachment) throw new Error("attachment cannot be null.");
    let attachments = this.attachments;
    if (slotIndex >= attachments.length)
        attachments.length = slotIndex + 1;
    if (!attachments[slotIndex])
        attachments[slotIndex] = {};
    attachments[slotIndex][name] = attachment;
}
```

**Implication:** `Skin.attachments: Array<StringMap<Attachment>>` keyed by `slotIndex`. The existing usage.ts:106-114 walker uses this shape correctly.

### TextureAtlas.findRegion — linear scan (TextureAtlas.js:176-183)

```javascript
findRegion(name) {
    for (let i = 0; i < this.regions.length; i++) {
        if (this.regions[i].name == name) {
            return this.regions[i];
        }
    }
    return null;
}
```

**Implication:** Lookups are O(n). For atlas-less projects with hundreds of regions (Girl/Jokerman), this is fine — same complexity as canonical mode. No optimization needed.

## Assumptions Log

| #  | Claim | Section | Risk if Wrong |
|----|-------|---------|----------------|
| A1 | All real-world Spine 4.2 fixtures use forward slashes for nested region paths (verified Jokerman, but not exhaustive) | Pitfall §3, Open Q §6 | Low — Spine editor canonical encoding is forward-slash on all platforms |
| A2 | Sequence attachments are absent from the existing in-repo fixtures, so Phase 21 can defer sequence support | Pitfall §7 | Medium — surfacing a real sequence-using project mid-phase would need a Phase 999 follow-up. Verified the fixture set: SIMPLE_TEST/EXPORT/Jokerman/Girl JSONs do not contain `"sequence":` substring (grep confirms zero hits across `.json` fixtures). Ship with the gap documented. |
| A3 | The `'png-header'` discriminator addition to `SourceDims.source` does not break any existing renderer code switching on `source` | D-15 | Low — grep across renderer for `source ===` returns zero hits; the field is currently used only inside loader.ts:235-247 for diagnostic labelling |
| A4 | `path.resolve(path.join(imagesDir, regionName + '.png'))` produces filesystem-safe absolute paths for nested names on Windows | Pitfall §3 | Low — Phase 6 image-worker is already shipping with this pattern across all platforms |

**Verified, not assumed:**
- D-13 verdict (text-based synthesis works) — verified by inspection of TextureAtlas.js parser
- D-09 mechanism (custom AttachmentLoader subclass) — verified by SkeletonJson.js:313-314, 371-372, 404-405 null-attachment graceful path
- All field shapes in Open Question 4 — verified by direct read of TextureAtlas.js:228-269
- All 7 attachment types and which 3 resolve to atlas regions — verified by direct read of SkeletonJson.js:367-471

## Environment Availability

| Dependency                          | Required By               | Available | Version | Fallback |
|--------------------------------------|---------------------------|-----------|---------|----------|
| Node 22+                             | Layer 3                   | ✓         | (project default per package.json engines) | — |
| `@esotericsoftware/spine-core` 4.2.x | Atlas/SkeletonJson reuse  | ✓         | 4.2.43 (per fixture spine field) | — |
| `vitest` 4.0.x                       | All Phase 21 tests        | ✓         | 4.0.0   | — |
| `node:fs` (sync read APIs)           | png-header.ts             | ✓         | (built-in) | — |
| Existing fixtures (SIMPLE_PROJECT, EXPORT_PROJECT, Jokerman, Girl) | Round-trip + path-field testing | ✓ | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Sources

### Primary (HIGH confidence)
- `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:31-269` — TextureAtlas constructor, parser, region-finalization, page/region class shapes
- `node_modules/@esotericsoftware/spine-core/dist/AtlasAttachmentLoader.js:54-91` — newRegionAttachment / newMeshAttachment throw paths; non-textured types
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonJson.js:60-471` — JSON parsing, skeleton/skin walk, attachment dispatch by type, null-attachment graceful skip
- `node_modules/@esotericsoftware/spine-core/dist/SkeletonData.js:73-79` — nonessential field documentation (fps, imagesPath, audioPath)
- `node_modules/@esotericsoftware/spine-core/dist/Skin.js:60-68` — Skin.attachments shape
- `src/core/loader.ts:81-83, 175-296` — existing loader (createStubTextureLoader, sourcePaths, sourceDims, atlasSources)
- `src/core/errors.ts:27-51` — AtlasNotFoundError template
- `src/core/types.ts:20-101` — LoaderOptions, SourceDims, LoadResult shapes
- `src/core/usage.ts:106-114` — existing skin.attachments walker pattern
- `src/core/project-file.ts:89-229` — validateProjectFile structure
- `src/main/ipc.ts:117-133` — KNOWN_KINDS registration; SerializableError envelope
- `src/main/project-io.ts:395-471, 836-895` — atlasPath cascade through Open / resample
- `src/main/summary.ts:113-115` — atlasPath in SkeletonSummary
- `src/main/image-worker.ts:140-175` — atlas-extract fallback path (irrelevant in atlas-less mode)
- `src/renderer/src/components/AppShell.tsx:608-625, 1048-1062` — atlasPath consumers
- `src/shared/types.ts:485-499, 565-606, 670-700` — SkeletonSummary, SerializableError, ProjectFileV1, AppSessionState
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` — spine 4.2.43; nonessential `images: './IMAGES/'`; 3 regions + 1 mesh, no `path` field
- `fixtures/EXPORT_PROJECT/EXPORT.json` + `images/` — same structure as SIMPLE; 3 regions + 1 mesh
- `fixtures/Jokerman/JOKERMAN_SPINE.json` — spine 4.2.43; 6 of 23 attachments have `path` field with subfolder paths (`AVATAR/CARDS_L_HAND_*`)
- `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` — spine 4.2.43; 147 region/mesh attachments, none with `path` field
- W3C PNG Spec / RFC 2083 — IHDR chunk layout (24 bytes from file head: signature 8 + length 4 + type 4 + width 4 + height 4)
- `.planning/seeds/SEED-001-atlas-less-mode.md` — original seed body
- `.planning/seeds/SEED-002-dims-badge-override-cap.md` — Phase 22 sibling
- `.planning/ROADMAP.md:396-419` — Phase 21 official scope and success criteria
- `.planning/REQUIREMENTS.md:60-63` — LOAD-01..04 definitions
- `.planning/phases/21-…/21-CONTEXT.md` — locked decisions D-01..D-17

### Secondary (MEDIUM confidence)
- (none — every claim verified against primary sources)

### Tertiary (LOW confidence)
- (none)

## Metadata

**Confidence breakdown:**
- Standard stack & loader integration: HIGH — verified against installed spine-core 4.2 source + in-repo loader code
- D-13 text-based synthesis: HIGH — verified by parser inspection
- D-09 silent-skip via SilentSkipAttachmentLoader: HIGH — verified by tracing SkeletonJson null-attachment path
- PNG IHDR byte layout: HIGH — RFC 2083 standard, deterministic byte structure
- Per-fixture path-field presence: HIGH — verified by Python json walk across 4 fixtures
- Sequence support gap: MEDIUM — verified absence in 4 fixtures via grep; could surface in user fixtures
- Subfolder path safety on Windows: MEDIUM — pattern is shipping in Phase 6 across platforms; no exhaustive Windows-specific test

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days; spine-core 4.2.x is stable, project layout is locked)

---

## RESEARCH COMPLETE

**Phase:** 21 — SEED-001 atlas-less mode
**Confidence:** HIGH

### Key Findings
- D-09 silent-skip requires a custom `SilentSkipAttachmentLoader` subclass (stock `AtlasAttachmentLoader` THROWS on missing region per `AtlasAttachmentLoader.js:62, 75`); spine-core's `SkeletonJson.readAttachment` natively handles null returns via `if (!region) return null;` at lines 371-372 / 404-405.
- D-13 verdict confirmed: text-based atlas synthesis is the right choice — `new TextureAtlas(text)` auto-defaults u/v/u2/v2 (`TextureAtlas.js:162-171`) and originalWidth/Height (`TextureAtlas.js:152-155`) for free.
- The synthesized region MUST be keyed by the JSON `path` field (defaulting to `entryName`), not by entry-name — verified by 6/23 Jokerman fixtures using `path: 'AVATAR/...'` distinct from name.
- PNG IHDR is a 24-byte head read; pasteable byte-walk delivered for `png-header.ts`.
- Spine 4.2 JSON nonessential data = `skeleton.images/audio/fps` top-level strings only — NO per-attachment original-dim fields. Phase 22 must compare JSON `attachment.width/height` (canonical) against PNG IHDR dims (actual source).

### File Created
`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | Verified against installed spine-core 4.2.43 source |
| Architecture (D-13 + D-09 mechanism) | HIGH | Traced via direct parser inspection + null-attachment path |
| PNG IHDR layout | HIGH | RFC 2083 standard, deterministic |
| Pitfalls | HIGH | All 10 grounded in code-level verification |
| Sequence-support gap | MEDIUM | Absent in fixtures, but flagged as Pitfall 7 |

### Open Questions
- All 8 questions in CONTEXT.md "Open Research Items" answered with HIGH confidence and code-level citations.

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
