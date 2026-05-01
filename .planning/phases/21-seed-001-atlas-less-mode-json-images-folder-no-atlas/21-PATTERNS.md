# Phase 21: SEED-001 atlas-less mode (json + images folder, no .atlas) — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 11 (4 new core, 3 new tests, 1 new fixture, 6 modified)
**Analogs found:** 11 / 11 (every new file has an in-repo analog; every modified file IS its own analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/png-header.ts` (NEW) | utility (pure-TS byte parser) | file-I/O / transform | `src/core/loader.ts:81-127` (Layer-3 pure-TS reader, sync I/O, typed errors) | role-match (byte-level parse is novel; Layer-3 + error-class shape is identical) |
| `src/core/synthetic-atlas.ts` (NEW) | service (atlas synthesis) | file-I/O / transform | `src/core/loader.ts:236-296` (atlas-region map building) + `src/core/usage.ts:106-114` (skin-attachments walker) | composite (loader gives atlas/sourceDims/sourcePaths/atlasSources idioms; usage gives skin walker idiom) |
| `src/core/errors.ts` (MODIFIED) | model (typed error classes) | request-response | `src/core/errors.ts:27-51` `AtlasNotFoundError` (the file IS its own analog — direct mirror) | exact |
| `src/core/types.ts` (MODIFIED) | model (interface widening) | n/a | `src/core/types.ts:32-46` `LoadResult` shape | exact (one-field type widening) |
| `src/core/loader.ts` (MODIFIED) | service (loader entrypoint) | file-I/O / request-response | `src/core/loader.ts:179-214` (atlas read + parse + AtlasAttachmentLoader construction) | exact (in-place branch insert) |
| `src/main/ipc.ts` (MODIFIED) | controller (IPC trust boundary) | request-response | `src/main/ipc.ts:117-133` `KNOWN_KINDS` set | exact (single-entry append) |
| `src/main/summary.ts` (MODIFIED) | service (summary builder) | request-response | `src/main/summary.ts:113-115` (load.atlasPath passthrough) | exact (null-guard insert) |
| `src/main/project-io.ts` (MODIFIED) | controller (project IPC) | request-response | `src/main/project-io.ts:840` (`typeof a.atlasPath === 'string' ? a.atlasPath : undefined`) | exact (null already routed to undefined) |
| `src/core/project-file.ts` (MODIFIED) | service (schema validate/migrate/serialize) | transform | `src/core/project-file.ts:140-152` (Phase 20 documentation pre-massage) + `:174-180` (atlasPath null permit) | exact (proven pre-massage + nullable-field idiom) |
| `src/renderer/src/components/AppShell.tsx` (MODIFIED) | component (UI state + IPC) | event-driven | `AppShell.tsx:174-176, 249-256, 632` (Phase 20 `documentation` state plumbing) | role-match (per-project field plumbing + Save/Open round-trip; UI surface differs — checkbox vs modal) |
| `src/shared/types.ts` (MODIFIED) | model (cross-process types) | n/a | `src/shared/types.ts:494, 565-602, 670-703` (SkeletonSummary, SerializableError union, ProjectFileV1, AppSessionState) | exact |
| `tests/core/png-header.spec.ts` (NEW) | test | n/a | `tests/core/loader.spec.ts:30-119` | role-match (vitest convention; fixture path resolution; typed-error assertions) |
| `tests/core/synthetic-atlas.spec.ts` (NEW) | test | n/a | `tests/core/loader.spec.ts:32-99` | role-match |
| `tests/core/loader-atlas-less.spec.ts` (NEW) | test | n/a | `tests/core/loader.spec.ts` (entire file) | role-match (extends existing loader.spec idiom) |
| `fixtures/SIMPLE_PROJECT_NO_ATLAS/` (NEW) | fixture | n/a | `fixtures/EXPORT_PROJECT/` (already json + images/ dir, but with `.atlas` — copy minus .atlas) | exact (literally copy SIMPLE_PROJECT JSON + per-region PNGs from EXPORT_PROJECT) |

---

## Pattern Assignments

### `src/core/png-header.ts` (utility, file-I/O / transform) — NEW

**Analog:** `src/core/loader.ts:30-127` for the Layer-3 pure-TS file shape; `src/core/errors.ts:27-51` for the typed-error class shape.

**Layer 3 invariant constraint:** `core/` is pure TS. ONLY `node:fs` + `node:path` allowed. NO `sharp`, NO DOM, NO streaming buffer libraries, NO zlib/decompression. PNG IHDR is parsed via raw byte reads (24 bytes from file head). RESEARCH.md §Pitfall implicit (Layer 3 invariant) and CLAUDE.md fact #4 ("the math phase does not decode PNGs") — IHDR byte-walk is structurally distinct from decoding.

**Imports pattern** (mirror loader.ts:30-46):
```typescript
import * as fs from 'node:fs';
import { SpineLoaderError } from './errors.js';
```
(NO `path` needed; NO spine-core imports; NO main/electron imports.)

**Typed-error pattern** (mirror errors.ts:27-51 — single-field `path` + reason):
```typescript
// errors.ts:27-51 template (AtlasNotFoundError):
export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    super(`Spine projects require an .atlas file beside the .json...`);
    this.name = 'AtlasNotFoundError';
  }
}
```
For PNG header parse error, single-field constructor (path + reason) is sufficient — there's no skeleton context at the byte-parse level. RESEARCH.md provides a copy-pasteable byte walk at lines 207-293 which can be used verbatim.

**Sync-I/O pattern** (mirror loader.ts:144-149 — `try/catch` wrapping `fs.readFileSync` with typed-error rethrow):
```typescript
// loader.ts:144-149:
try {
  jsonText = fs.readFileSync(skeletonPath, 'utf8');
} catch {
  throw new SkeletonJsonNotFoundError(skeletonPath);
}
```
Departure: PNG byte-walk uses `fs.openSync` + `fs.readSync(fd, buf, 0, 24, 0)` (read only 24 bytes — research §Open Question 3 explicitly justifies this over `readFileSync`: PNGs can be hundreds of MB and we only need the head). Wrap with `try/finally` for `fs.closeSync(fd)`.

**Departures from loader.ts analog:**
- New byte-walk routine (no in-repo precedent for big-endian uint32 reads from a file head — Buffer.readUInt32BE is the right method, NOT readUInt32LE).
- New error class (`PngHeaderParseError`) extending `SpineLoaderError`.
- Public API shape: `readPngDims(pngPath: string): { width: number; height: number }` (function-style export; no class wrapper).

**Public API contract (RESEARCH.md INV-1, INV-2):**
- Reads exactly 24 bytes from file head.
- Throws `PngHeaderParseError` on: file unreadable, file < 24 bytes, signature mismatch, non-IHDR first chunk, zero-size IHDR.
- Returns `{ width, height }` for valid IHDRs.

---

### `src/core/synthetic-atlas.ts` (service, file-I/O / transform) — NEW

**Analog (composite):**
- `src/core/loader.ts:236-296` — sourceDims / sourcePaths / atlasSources map construction (the *output shape* of the synthesizer must match what loader.ts produces in canonical mode).
- `src/core/usage.ts:106-114` — skin-attachments walker (the synthesizer walks the JSON BEFORE SkeletonJson.readSkeletonData runs, but the iteration *shape* is identical — see RESEARCH.md §Open Question 5).
- `src/core/errors.ts:27-51` — `AtlasNotFoundError` template, mirrored for `MissingImagesDirError`.

**Layer 3 invariant constraint:** Same as png-header.ts — pure TS, only `node:fs` + `node:path` permitted. Imports `@esotericsoftware/spine-core` for `TextureAtlas` + `AtlasAttachmentLoader` (already imported by loader.ts:32-39, so no new boundary crossing).

**Imports pattern** (mirror loader.ts:30-46 + add MissingImagesDirError):
```typescript
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  TextureAtlas,
  AtlasAttachmentLoader,
  type Attachment,
  type Sequence,
  type Skin,
} from '@esotericsoftware/spine-core';
import { readPngDims, PngHeaderParseError } from './png-header.js';
import { SpineLoaderError } from './errors.js';
```

**Skin-attachments walker** (variant of `usage.ts:106-114` — but walks parsedJson BEFORE SkeletonJson runs, NOT skeletonData.skins after):
```typescript
// usage.ts:106-114 (post-parse walker, AFTER SkeletonJson.readSkeletonData):
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

Departure (per RESEARCH.md §Open Question 5, lines 374-416): synthesis must walk the **parsed JSON object** (`parsedJson.skins[*].attachments[slotName][entryName]`), not `skeletonData.skins`, because the atlas must EXIST before SkeletonJson runs. Use the JSON-object walker pattern in research lines 399-416 verbatim. Filter on `type ∈ {region, mesh, linkedmesh}` (RESEARCH.md §Open Question 7). Region key is `att.path ?? entryName` (RESEARCH.md §Pitfall 2 — Jokerman fixture has 6 attachments where `path` differs from entry name).

**Atlas-text-builder pattern** (mirror loader.ts:198-202 — feed text to `new TextureAtlas(text)`, then attach stub textures per page):
```typescript
// loader.ts:196-202:
let atlas: TextureAtlas;
try {
  atlas = new TextureAtlas(atlasText);
  const stubLoader = createStubTextureLoader();
  for (const page of atlas.pages) {
    page.setTexture(stubLoader(page.name));
  }
} catch (cause) {
  throw new AtlasParseError(atlasPath, cause);
}
```

The synthesizer constructs `atlasText` per the grammar in RESEARCH.md lines 156-178:
```
<region.name>.png
size: W,H
filter: Linear,Linear

<region.name>
bounds: 0,0,W,H
```
Blank line between pages. Per-page-per-region. RESEARCH.md §Pitfall 4: page name MUST be the full region path + `.png` (not basename — guards against `AVATAR/HEAD` vs `PROPS/HEAD` collision). RESEARCH.md §Pitfall 10: NO leading blank line, NO comments.

**Sourcedims/sourcepaths/atlasSources map shape** (mirror loader.ts:235-296 verbatim — the synthesizer's downstream maps must match the canonical loader's output shape so the rest of the pipeline runs unchanged):
```typescript
// loader.ts:235-247 (sourceDims):
const sourceDims = new Map<string, SourceDims>();
for (const region of atlas.regions) {
  const packedW = region.width;
  const packedH = region.height;
  const origW = region.originalWidth;
  const origH = region.originalHeight;
  const hasExplicitOrig = origW !== packedW || origH !== packedH;
  sourceDims.set(region.name, {
    w: origW,
    h: origH,
    source: hasExplicitOrig ? 'atlas-orig' : 'atlas-bounds',
  });
}

// loader.ts:257-260 (sourcePaths):
const imagesDir = path.join(path.dirname(skeletonPath), 'images');
for (const region of atlas.regions) {
  sourcePaths.set(region.name, path.resolve(path.join(imagesDir, region.name + '.png')));
}

// loader.ts:286-296 (atlasSources):
for (const region of atlas.regions) {
  const rotated = region.degrees !== 0;
  atlasSources.set(region.name, {
    pagePath: path.resolve(path.join(atlasDir, region.page.name)),
    x: region.x,
    y: region.y,
    w: region.originalWidth,
    h: region.originalHeight,
    rotated,
  });
}
```

Departures for atlas-less synthesis (per D-15, D-16, D-17 in CONTEXT.md):
- `sourceDims`: `source: 'png-header'` (new discriminator variant — `types.ts:29` widens to `'atlas-orig' | 'atlas-bounds' | 'png-header'`).
- `sourcePaths`: identical to canonical (`images/<region.name>.png`); region.name now sourced from JSON walk.
- `atlasSources`: `pagePath = images/<region.name>.png` (NOT atlasDir; in atlas-less mode the atlas doesn't exist — page lives at the per-region PNG path); `x=0, y=0, w/h = PNG dims, rotated=false`.

**`MissingImagesDirError` pattern** (direct mirror of `errors.ts:27-51` — paste this verbatim into errors.ts, NOT inside synthetic-atlas.ts; per file-modification list, MissingImagesDirError lives in errors.ts):

```typescript
// Direct template from errors.ts:27-51 (AtlasNotFoundError):
export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
        `Re-export from the Spine editor with the atlas included.\n` +
        `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
    );
    this.name = 'AtlasNotFoundError';
  }
}
```

Mirror for `MissingImagesDirError`: same two-field constructor (`searchedPath: string, skeletonPath: string`) PLUS optional `missingPngs?: string[]` for D-11 ("error message lists ALL missing PNGs"). The `.name = 'MissingImagesDirError'` field is **critical** — IPC routes by `err.name` against `KNOWN_KINDS` (see `ipc.ts` analog below). RESEARCH.md §Implementation Approaches lines 520-536 provides a draftable constructor body.

**`SilentSkipAttachmentLoader` subclass pattern** (RESEARCH.md §Pitfall 1 — REQUIRED, no in-repo analog because this is a novel spine-core extension):
```typescript
// From RESEARCH.md lines 641-650:
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

Why subclass: stock `AtlasAttachmentLoader.newRegionAttachment` THROWS on missing region (`AtlasAttachmentLoader.js:62`). `SkeletonJson.readAttachment` natively handles null returns (`SkeletonJson.js:371-372, 404-405`). The subclass converts throw → null at the right boundary.

**Departures from analog (loader.ts):**
- Walks parsedJson, not skeletonData.skins (chicken-and-egg — atlas must exist BEFORE SkeletonJson runs).
- Region name = JSON `path` field (not entry-name key) — RESEARCH.md §Pitfall 2.
- Page-per-region (one synthetic page per PNG) instead of one page per atlas image.
- `'png-header'` source discriminator (new variant in `SourceDims.source`).
- `atlasSources.pagePath` resolves to per-region PNG, not atlas-page PNG.
- `SilentSkipAttachmentLoader` wraps stock `AtlasAttachmentLoader` to honor D-09 silent-skip.

---

### `src/core/errors.ts` (model, request-response) — MODIFIED

**Analog (the file IS its own analog):** `src/core/errors.ts:27-51` `AtlasNotFoundError`.

**Direct-mirror excerpt** (paste this verbatim shape, swap names/message):
```typescript
// errors.ts:27-51 — paste this template:
export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    super(
      `Spine projects require an .atlas file beside the .json (carries region metadata that the skeleton JSON alone does not have). ` +
        `Re-export from the Spine editor with the atlas included.\n` +
        `  Skeleton: ${skeletonPath}\n  Expected atlas at: ${searchedPath}`,
    );
    this.name = 'AtlasNotFoundError';
  }
}
```

**For `MissingImagesDirError`:**
- Same constructor shape: `(searchedPath: string, skeletonPath: string)` (D-10 explicitly mandates this — CONTEXT.md line 52).
- Optional third arg `missingPngs?: string[]` for the D-11 catastrophic-list case.
- Two-line message body matching `AtlasNotFoundError`'s tone: explanation + actionable hint + `Skeleton:` and `Searched:` two-line trailer.
- `.name = 'MissingImagesDirError'` — load-bearing for IPC routing.

**Departures from analog:**
- New `missingPngs` optional field for D-11 multi-PNG diagnostic.
- Different message body (atlas-less workflow explanation, not atlas re-export hint).

---

### `src/core/types.ts` (model) — MODIFIED

**Analog (the file IS its own analog):** `src/core/types.ts:32-46` `LoadResult`.

**Excerpt of current shape** (lines 32-46):
```typescript
export interface LoadResult {
  /** Absolute path of the loaded skeleton JSON. */
  skeletonPath: string;
  /** Absolute path of the loaded atlas. */
  atlasPath: string;
  /** Parsed skeleton data ... */
  skeletonData: SkeletonData;
  /** Parsed atlas. */
  atlas: TextureAtlas;
  /** Map from atlas region name → source (pre-pack) dimensions. */
  sourceDims: Map<string, SourceDims>;
  // ...
}
```

**Modifications (per D-03 + D-15):**
- Line 36: `atlasPath: string` → `atlasPath: string | null` (D-03).
- Line 29: `source: 'atlas-orig' | 'atlas-bounds'` → `source: 'atlas-orig' | 'atlas-bounds' | 'png-header'` (D-15).
- Update accompanying JSDoc to note the null branch represents atlas-less mode.

**Departures from analog:** none — this is a pure type-widening (additive variant on a string union, nullability addition on an existing field).

---

### `src/core/loader.ts` (service, file-I/O / request-response) — MODIFIED

**Analog (the file IS its own analog):** `src/core/loader.ts:179-214` (atlas-resolve + atlas-parse + AtlasAttachmentLoader construction).

**Existing branch (lines 179-214) — the modification site:**
```typescript
// loader.ts:179-193 (atlas resolve + read; the AtlasNotFoundError throw site):
const atlasPath =
  opts.atlasPath ??
  path.join(
    path.dirname(skeletonPath),
    path.basename(skeletonPath, path.extname(skeletonPath)) + '.atlas',
  );

// 3. Read atlas text
let atlasText: string;
try {
  atlasText = fs.readFileSync(atlasPath, 'utf8');
} catch {
  throw new AtlasNotFoundError(atlasPath, skeletonPath);
}

// 4. Parse atlas + attach stub textures per page (no PNG decode)
let atlas: TextureAtlas;
try {
  atlas = new TextureAtlas(atlasText);
  const stubLoader = createStubTextureLoader();
  for (const page of atlas.pages) {
    page.setTexture(stubLoader(page.name));
  }
} catch (cause) {
  throw new AtlasParseError(atlasPath, cause);
}

// 5. Parse skeleton via spine-core's own JSON reader.
const attachmentLoader = new AtlasAttachmentLoader(atlas);
const skeletonJson = new SkeletonJson(attachmentLoader);
const skeletonData = skeletonJson.readSkeletonData(parsedJson);
```

**Branch order to preserve** (per CONTEXT.md D-05/D-06/D-08 and RESEARCH.md §Pitfall 9):
```
if (opts.atlasPath !== undefined)
    → canonical (D-06: throw AtlasNotFoundError verbatim on read fail; NO fall-through)
else if (opts.loaderMode === 'atlas-less')
    → synthesize (D-08: skip .atlas read entirely, even if file exists)
else if (sibling .atlas readable)
    → canonical (D-07: atlas-by-default when both exist)
else
    → synthesize (D-05: fall-through on sibling .atlas unreadable)
```

**Synthesis branch shape** (RESEARCH.md lines 660-708 — paste-able):
```typescript
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

// SkeletonJson uses SilentSkipAttachmentLoader in atlas-less mode (RESEARCH.md §Pitfall 1)
const attachmentLoader = isAtlasLess
  ? new SilentSkipAttachmentLoader(atlas)
  : new AtlasAttachmentLoader(atlas);
const skeletonJson = new SkeletonJson(attachmentLoader);
const skeletonData = skeletonJson.readSkeletonData(parsedJson);
```

**`createStubTextureLoader()` reuse pattern** (loader.ts:81-83, D-14 — verbatim, no modification):
```typescript
export function createStubTextureLoader(): (pageName: string) => Texture {
  return (_pageName: string) => new StubTexture();
}
```
synthetic-atlas.ts (or the loader's synthesis branch) calls this verbatim — D-14 mandates no new texture handling.

**Map-construction branches in atlas-less mode** (per D-15, D-16, D-17):
- `sourceDims` populated from `synth.dimsByRegionName` with `source: 'png-header'` (NOT iterated from `atlas.regions` because the synthesizer already has the dims; iterating from atlas.regions would just round-trip the same numbers).
- `sourcePaths` = `synth.pngPathsByRegionName` directly.
- `atlasSources` synthesized from synth maps: `pagePath = pngPathsByRegionName.get(name)`, `x=0, y=0, w/h = dimsByRegionName.get(name), rotated=false`.

Branch this BELOW the existing canonical-mode map-construction so canonical paths are unchanged.

**LoaderOptions extension** (types.ts:20-23 — add `loaderMode` field):
```typescript
// types.ts:20-23 (current):
export interface LoaderOptions {
  /** Override the atlas path. Defaults to sibling `.atlas` next to the JSON. */
  atlasPath?: string;
}
```
Add: `loaderMode?: 'auto' | 'atlas-less'` (optional, defaults to 'auto' when undefined).

**Return statement update** (loader.ts:305-314):
```typescript
return {
  skeletonPath: path.resolve(skeletonPath),
  atlasPath: path.resolve(atlasPath),  // ← becomes resolvedAtlasPath (string | null)
  skeletonData,
  atlas,
  sourceDims,
  sourcePaths,
  atlasSources,
  editorFps,
};
```
In atlas-less mode, return `atlasPath: null` (D-03).

**Departures from analog:**
- 4-way branch (canonical-explicit / atlas-less-forced / canonical-fallthrough / atlas-less-fallthrough) replaces the current 1-way read.
- New `synthesizeAtlasText` invocation in two of the four branches.
- Conditional `SilentSkipAttachmentLoader` wrapping vs stock `AtlasAttachmentLoader`.
- `atlasPath: null` return value in atlas-less branches.
- `'png-header'` source discriminator in synthesized rows.

**Layer 3 invariant constraint:** all new code stays pure TS — `node:fs` for atlas read (already present at line 190), no new boundary crossings.

---

### `src/main/ipc.ts` (controller, request-response) — MODIFIED

**Analog (the file IS its own analog):** `src/main/ipc.ts:117-133` `KNOWN_KINDS` set.

**Excerpt of current shape:**
```typescript
// ipc.ts:117-133:
type KnownErrorKind = Exclude<
  SerializableError['kind'],
  'SkeletonNotFoundOnLoadError' | 'SpineVersionUnsupportedError'
>;

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
  // 'SpineVersionUnsupportedError' — INTENTIONALLY excluded (handled by dedicated branch).
]);
```

**Modification (per D-10):**
- Add `'MissingImagesDirError'` literal to the Set.
- The `KnownErrorKind` type is auto-derived from `SerializableError['kind']` — no manual type change required IF `SerializableError` in shared/types.ts gains `'MissingImagesDirError'` as a kind (see shared/types.ts modification below). The `Exclude` chain at line 117-120 stays unchanged (MissingImagesDirError has no extra typed fields beyond message; it's a vanilla `{kind, message}` arm).

**Departures from analog:** none — single set-entry append.

---

### `src/main/summary.ts` (service, request-response) — MODIFIED

**Analog (the file IS its own analog):** `src/main/summary.ts:113-115`.

**Excerpt of current shape:**
```typescript
// summary.ts:113-115:
return {
  skeletonPath: load.skeletonPath,
  atlasPath: load.atlasPath,    // ← currently typed `string`; becomes `string | null`
  // ...
};
```

**Modification (per D-03):**
- Line 115: `atlasPath: load.atlasPath` already passes through; the TYPE change at `shared/types.ts:494` (`SkeletonSummary.atlasPath: string` → `string | null`) propagates the null automatically.
- No code change needed at this site (the assignment is type-transparent). Verify TypeScript compiles after the type widening.

**Departures from analog:** none — pure type-widening cascade. RESEARCH.md §Pitfall 8 confirms this site is null-transparent.

---

### `src/main/project-io.ts` (controller, request-response) — MODIFIED

**Analog (the file IS its own analog):** `src/main/project-io.ts:840` (atlasPath null-routing) + `:400-406` (loadSkeleton invocation) + `:484-486` (atlasRoot threading).

**Excerpt of current shape:**
```typescript
// project-io.ts:840 — already null-aware via typeof check:
const atlasPath = typeof a.atlasPath === 'string' ? a.atlasPath : undefined;

// project-io.ts:400-406:
load = loadSkeleton(
  materialized.skeletonPath,
  materialized.atlasPath !== null ? { atlasPath: materialized.atlasPath } : {},
);

// project-io.ts:484-486:
atlasRoot: materialized.atlasPath !== null ? materialized.atlasPath : undefined,
```

**Modifications (per D-03 + D-08):**
- The three null-guards above are already in place (RESEARCH.md §Pitfall 8 confirms — no modification needed). Verify TypeScript compiles after the `MaterializedProject.atlasPath` widens.
- NEW: thread `loaderMode` into `loadSkeleton` opts — when `materialized.loaderMode === 'atlas-less'`, pass `{ loaderMode: 'atlas-less' }` (or merge with existing atlasPath). Add the field to `MaterializedProject` in shared/types.ts and to `PartialMaterialized` in core/project-file.ts:305-345 (see project-file.ts modification below).
- NEW: `validateProjectFile` already accepts `atlasPath: null` per project-file.ts:174-180 (already string|null). The new `loaderMode` field needs its own pre-massage + per-field validator branch (see project-file.ts).

**Departures from analog:** none for atlasPath; new `loaderMode` plumbing appended to existing materialize+thread idiom.

---

### `src/core/project-file.ts` (service, transform) — MODIFIED

**Analog (the file IS its own analog):** `src/core/project-file.ts:140-152` (Phase 20 documentation pre-massage) + `:174-180` (nullable-field shape guard) + `:267-287` (serialize) + `:355-381` (materialize).

**Phase 20 documentation pre-massage pattern** (lines 140-152 — direct template for `loaderMode` migration):
```typescript
// project-file.ts:140-152 (Phase 20 D-148 forward-compat pre-massage):
// Phase 20 D-148 forward-compat — Phase 8-era .stmproj files have either no
// `documentation` key OR `documentation: {}` (D-148 reserved slot). Pre-massage
// so the strict per-field validator below sees a known-shape default. Without
// this pre-massage the validator REJECTS Phase 8-era files at the entry point
// and the materializer back-fill never runs.
if (
  obj.documentation == null ||
  (typeof obj.documentation === 'object' &&
    !Array.isArray(obj.documentation) &&
    Object.keys(obj.documentation as object).length === 0)
) {
  obj.documentation = { ...DEFAULT_DOCUMENTATION };
}
```

**Mirror for `loaderMode`** (RESEARCH.md §Pitfall 6 lines 822-832 — paste-able):
```typescript
// Phase 21 D-08 forward-compat — Phase 8/20-era .stmproj files have no
// `loaderMode` field; default to 'auto' so legacy projects load through the
// canonical (atlas-by-default) path unchanged.
if (obj.loaderMode === undefined) {
  obj.loaderMode = 'auto';
}
// Then validate the now-present field:
if (obj.loaderMode !== 'auto' && obj.loaderMode !== 'atlas-less') {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: "loaderMode is not 'auto' | 'atlas-less'" },
  };
}
```
Insert this block AFTER the documentation pre-massage (line 152) and BEFORE the `obj.atlasPath` shape check (line 175).

**Nullable-field shape-guard analog** (lines 174-180 — `atlasPath` already string|null, no modification):
```typescript
// project-file.ts:174-180:
if (obj.atlasPath !== null && typeof obj.atlasPath !== 'string') {
  return {
    ok: false,
    error: { kind: 'invalid-shape', message: 'atlasPath is not string|null' },
  };
}
```
RESEARCH.md confirms this site already handles null cleanly. CONTEXT.md D-04 line 39 states: "atlasPath field already permitted by validateProjectFile per project-io.ts:840 — confirm no schema change needed". **No modification needed at lines 174-180.**

**`serializeProjectFile` pattern** (lines 267-286 — add `loaderMode` field):
```typescript
// project-file.ts:267-286 (current):
export function serializeProjectFile(
  state: AppSessionState,
  projectFilePath: string,
): ProjectFileV1 {
  const basedir = path.dirname(projectFilePath);
  return {
    version: 1,
    skeletonPath: relativizePath(state.skeletonPath, basedir),
    atlasPath: state.atlasPath !== null ? relativizePath(state.atlasPath, basedir) : null,
    imagesDir: state.imagesDir !== null ? relativizePath(state.imagesDir, basedir) : null,
    overrides: { ...state.overrides },
    samplingHz: state.samplingHz,
    lastOutDir: state.lastOutDir,
    sortColumn: state.sortColumn,
    sortDir: state.sortDir,
    documentation: state.documentation,
  };
}
```
Add: `loaderMode: state.loaderMode ?? 'auto',` (or just `state.loaderMode` if AppSessionState always has it after Phase 21).

**`materializeProjectFile` pattern** (lines 355-381 — add `loaderMode` field):
```typescript
// project-file.ts:355-381 (current — abridged):
export function materializeProjectFile(
  file: ProjectFileV1,
  projectFilePath: string,
): PartialMaterialized {
  const basedir = path.dirname(projectFilePath);
  return {
    skeletonPath: absolutizePath(file.skeletonPath, basedir),
    atlasPath: file.atlasPath !== null ? absolutizePath(file.atlasPath, basedir) : null,
    // ...
    documentation: { ...DEFAULT_DOCUMENTATION, ...file.documentation },
    projectFilePath,
  };
}
```
Add: `loaderMode: file.loaderMode ?? 'auto',` (with the `??` fallback as defence-in-depth — the validator pre-massage already substitutes 'auto', so this is redundant but matches the documentation back-fill idiom on line 377).

**`PartialMaterialized` interface extension** (lines 305-345 — add `loaderMode` field):
```typescript
// project-file.ts:305-345 (current):
export interface PartialMaterialized {
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  documentation: Documentation;
  projectFilePath: string;
  summary?: SkeletonSummary;
}
```
Add: `loaderMode: 'auto' | 'atlas-less';` (required, defaulted by materializer).

**Departures from analog:**
- New string-literal-union field validation (no in-repo precedent for this exact pattern, but `sortDir: 'asc' | 'desc'` at lines 205-209 is the closest analog — paste that idiom).
- Pre-massage default-to-'auto' pattern is a direct copy of the Phase 20 documentation idiom.

---

### `src/renderer/src/components/AppShell.tsx` (component, event-driven) — MODIFIED

**Analog (the file IS its own analog):** Phase 20 `documentation` plumbing — `AppShell.tsx:174-176` (modal lifecycle), `:249-256` (lazy state init from materialized project), `:609-633` (buildSessionState includes documentation), `:794-797` (intersect-against-summary on Open), `:1051-1061` (resampleProject IPC payload).

**Documentation state plumbing — full lifecycle excerpt:**

(1) **State init** (lines 249-256 — lazy initializer reads `initialProject.documentation`):
```typescript
const [documentation, setDocumentation] = useState<Documentation>(() =>
  intersectDocumentationWithSummary(
    initialProject?.documentation ?? DEFAULT_DOCUMENTATION,
    summary,
  ),
);
```

(2) **buildSessionState includes the field** (lines 609-633):
```typescript
const buildSessionState = useCallback(
  (): AppSessionState => ({
    skeletonPath: summary.skeletonPath,
    atlasPath: summary.atlasPath ?? null,    // ← null-guard already in place
    imagesDir: null,
    overrides: Object.fromEntries(overrides),
    samplingHz: samplingHzLocal,
    lastOutDir: null,
    sortColumn: 'attachmentName',
    sortDir: 'asc',
    documentation,                              // ← per-project field threaded into save state
  }),
  [summary.skeletonPath, summary.atlasPath, overrides, samplingHzLocal, documentation],
);
```

(3) **Open path re-intersect** (lines 794-797):
```typescript
setDocumentation(
  intersectDocumentationWithSummary(project.documentation, project.summary),
);
```

(4) **Resample IPC payload** (lines 1051-1061):
```typescript
const resp = await window.api.resampleProject({
  skeletonPath: summary.skeletonPath,
  atlasPath: summary.atlasPath,    // ← null-tolerant per D-03
  samplingHz: samplingHzLocal,
  overrides: Object.fromEntries(overrides),
  lastOutDir: null,
  sortColumn: 'attachmentName',
  sortDir: 'asc',
  projectFilePath: currentProjectPath,
});
```

**Mirror for `loaderMode`** (per D-08):
- Add a `useState<'auto' | 'atlas-less'>('auto')` slot near the `documentation` state (line ~256). Lazy initializer reads `initialProject?.loaderMode ?? 'auto'`.
- Add `loaderMode` field to the `buildSessionState` return object (line ~632) so Save round-trips the field.
- Add `loaderMode` to the resample IPC payload at line ~1061 so the resampler honors the override.
- UI surface (Claude's discretion per CONTEXT.md line 66): the simplest pattern matching existing project-level state is an inline checkbox or menu item in a Project Settings area. The `documentationBuilderOpen` modal pattern (line 176) is OVERKILL for a binary toggle — use a simple checkbox in the existing AppShell toolbar/header area.

**Null-guard cascade (per D-03 + RESEARCH.md §Pitfall 8):**
- Line 612 `summary.atlasPath ?? null` — already defensive ✅
- Line 1053 `atlasPath: summary.atlasPath` — passes through; `project-io.ts:840`'s `typeof === 'string'` check coerces null to undefined cleanly ✅
- No code modification needed at these sites; the type widening propagates correctly.

**Departures from analog:**
- Simpler UI surface (checkbox vs modal — `documentation` uses a full modal at lines 1508-1509, but `loaderMode` is binary).
- No "intersect-against-summary" drift logic needed — `loaderMode` is a single enum, not a per-attachment record subject to drift.

---

### `src/shared/types.ts` (model, cross-process types) — MODIFIED

**Analog (the file IS its own analog):** lines 494 (`SkeletonSummary.atlasPath`), 565-602 (`SerializableError` union), 670-703 (`ProjectFileV1` + `AppSessionState`).

**`SkeletonSummary.atlasPath` widening** (line 494 — D-03):
```typescript
// shared/types.ts:494 (current):
atlasPath: string;
```
Modification: `atlasPath: string | null;`

**`SerializableError` union arm** (lines 580-589 — add `MissingImagesDirError`):
```typescript
// shared/types.ts:580-589 (current):
| {
    kind:
      | 'SkeletonJsonNotFoundError'
      | 'AtlasNotFoundError'
      | 'AtlasParseError'
      | 'ProjectFileNotFoundError'
      | 'ProjectFileParseError'
      | 'ProjectFileVersionTooNewError'
      | 'Unknown';
    message: string;
  }
```
Modification: append `| 'MissingImagesDirError'` to the kind union. No new type fields beyond `message` — vanilla arm.

**`ProjectFileV1` extension** (lines 670-682 — add `loaderMode` field):
```typescript
// shared/types.ts:670-682 (current):
export interface ProjectFileV1 {
  version: 1;
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number | null;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  documentation: Documentation;
}
```
Add: `loaderMode: 'auto' | 'atlas-less';` (RESEARCH.md confirms `'auto'` is the legacy-default value).

**`AppSessionState` extension** (lines 692-703 — same field):
```typescript
// shared/types.ts:692-703 (current):
export interface AppSessionState {
  skeletonPath: string;
  atlasPath: string | null;
  imagesDir: string | null;
  overrides: Record<string, number>;
  samplingHz: number | null;
  lastOutDir: string | null;
  sortColumn: string | null;
  sortDir: 'asc' | 'desc' | null;
  documentation: Documentation;
}
```
Add: `loaderMode: 'auto' | 'atlas-less';`

**Departures from analog:**
- New `loaderMode` enum field on both `ProjectFileV1` and `AppSessionState` (mirrors `sortDir: 'asc' | 'desc' | null` shape).
- `'MissingImagesDirError'` added to vanilla-arm kind union (mirrors existing `'AtlasNotFoundError'` etc.).
- `SkeletonSummary.atlasPath` widening (single field, additive `| null`).

---

### `tests/core/png-header.spec.ts` (test) — NEW

**Analog:** `tests/core/loader.spec.ts:1-30` (header docblock + import shape) + `:67-98` (typed-error assertion idiom).

**Imports + fixture-path pattern** (mirror loader.spec.ts:20-30):
```typescript
// loader.spec.ts:20-30:
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  AtlasNotFoundError,
  SkeletonJsonNotFoundError,
} from '../../src/core/errors.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
```

**Mirror for png-header.spec:**
```typescript
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { readPngDims, PngHeaderParseError } from '../../src/core/png-header.js';

const PNG_FIXTURE = path.resolve('fixtures/EXPORT_PROJECT/images/CIRCLE.png');
```

**Typed-error assertion pattern** (mirror loader.spec.ts:67-98):
```typescript
// loader.spec.ts:72-98 (typed-error pattern):
it('F1.4: throws AtlasNotFoundError when sibling .atlas is absent; searchedPath ends with .atlas', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-'));
  const jsonPath = path.join(tmpDir, 'rig.json');
  fs.writeFileSync(jsonPath, '{"skeleton":{"spine":"4.2.43"}}');
  try {
    let caught: unknown;
    try {
      loadSkeleton(jsonPath);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(AtlasNotFoundError);
    const err = caught as AtlasNotFoundError;
    expect(err.searchedPath.endsWith('.atlas')).toBe(true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
```

**Test cases (per RESEARCH.md INV-1, INV-2):**
- Happy path: `readPngDims(EXPORT_PROJECT/images/CIRCLE.png)` returns the expected dims (verify via `sips -g pixelWidth -g pixelHeight` or pre-known fixture dims).
- Negative: empty file (< 24 bytes) → `PngHeaderParseError`.
- Negative: non-PNG bytes (signature mismatch) → `PngHeaderParseError`.
- Negative: truncated PNG (24 bytes but bytes 12-15 ≠ 'IHDR') → `PngHeaderParseError`.
- Negative: zero-size IHDR → `PngHeaderParseError`.

**Departures from analog:** byte-level fixtures via `Buffer.from(...)` writes to tmpdir for negative cases; happy-path uses real fixture PNGs from `fixtures/EXPORT_PROJECT/images/`.

---

### `tests/core/synthetic-atlas.spec.ts` (test) — NEW

**Analog:** `tests/core/loader.spec.ts:32-65` (LoadResult shape assertions) + the `JOKERMAN_SPINE.json` fixture for path-field testing (RESEARCH.md §Pitfall 2).

**Imports pattern** (mirror loader.spec.ts:20-30):
```typescript
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextureAtlas } from '@esotericsoftware/spine-core';
import {
  synthesizeAtlasText,
  SilentSkipAttachmentLoader,
  MissingImagesDirError,
} from '../../src/core/synthetic-atlas.js';
```

**Test cases (per RESEARCH.md INV-3, INV-4, INV-5, INV-6):**
- INV-3: `synthesizeAtlasText(parsedJson, imagesDir, skeletonPath)` produces text that `new TextureAtlas(text)` accepts without throw (using SIMPLE_PROJECT JSON + EXPORT_PROJECT images/).
- INV-4: every region/mesh/linkedmesh in JSON whose PNG exists has a corresponding region in the synthesized atlas; `atlas.findRegion(path)` returns non-null for each.
- Subfolder paths preserve forward slashes (Jokerman fixture exercises this).
- INV-5: per-region missing PNG → silent skip; `findRegion` returns null; SkeletonJson does NOT throw.
- INV-6: missing imagesDir → throws `MissingImagesDirError` with `.name === 'MissingImagesDirError'`.

**Path-field test (RESEARCH.md §Pitfall 2):** use Jokerman JSON to verify region keys come from `att.path` not `entryName`.

---

### `tests/core/loader-atlas-less.spec.ts` (test) — NEW

**Analog:** `tests/core/loader.spec.ts` (entire file — round-trip integration with full fixture).

**Test cases (per RESEARCH.md INV-7, INV-8, INV-9):**
- D-05 fall-through: load `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json` → no throw, `atlasPath: null`, `sourceDims` populated with `source: 'png-header'`.
- D-06 explicit-atlas-throw: when `opts.atlasPath` is provided and unreadable → still throws `AtlasNotFoundError` (regression guard for ROADMAP success criterion #5).
- D-08 force-atlas-less: load with `loaderMode: 'atlas-less'` even when `.atlas` is present → atlas-less path used, `atlasPath: null`.
- D-10 catastrophic: `images/` dir absent + JSON has region refs → throws `MissingImagesDirError`.
- INV-9 round-trip: load → sample → exportPlan against the new fixture; non-empty `globalPeaks` for each animation; non-empty plan.

**Fixture setup pattern** (mirror loader.spec.ts:73-96 — `fs.mkdtempSync` for negative cases):
```typescript
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-atlasless-'));
// ... write JSON without atlas ...
try {
  const result = loadSkeleton(skelPath);
  // ... assertions ...
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

---

### `fixtures/SIMPLE_PROJECT_NO_ATLAS/` (golden fixture) — NEW

**Analog:** `fixtures/EXPORT_PROJECT/` (already json + images/ dir + per-region PNGs; only difference is the presence of `.atlas` — atlas-less fixture omits it).

**Construction (per CONTEXT.md line 153 + RESEARCH.md INV-9):**
- Copy `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` → `fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json`.
- Copy `fixtures/EXPORT_PROJECT/images/{CIRCLE,SQUARE,SQUARE2,TRIANGLE}.png` → `fixtures/SIMPLE_PROJECT_NO_ATLAS/images/`.
- Do NOT copy SIMPLE_TEST.atlas.
- The fixture exercises load → sample → export round-trip on the atlas-less code path.

**Departures from analog:** absence of `.atlas` (the entire point) + absence of pre-existing `.stmproj` (round-trip tests construct one in tmpdir).

---

## Shared Patterns

### Layer 3 invariant (core/ pure-TS)

**Source:** CLAUDE.md fact #5 + tests/arch.spec.ts forbidden-import grep.
**Apply to:** `src/core/png-header.ts`, `src/core/synthetic-atlas.ts`, all changes to `src/core/loader.ts`, `src/core/errors.ts`, `src/core/types.ts`, `src/core/project-file.ts`.

**Constraint:** ONLY `node:fs` + `node:path` permitted. NO `sharp`, NO DOM, NO `electron`, NO streaming buffer libraries, NO zlib/decompression. `@esotericsoftware/spine-core` already imported by core/loader.ts so synthesis can re-use.

```typescript
// loader.ts:30-39 (canonical core/ import block):
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  TextureAtlas,
  Texture,
  TextureFilter,
  TextureWrap,
} from '@esotericsoftware/spine-core';
```

### Typed-error class shape

**Source:** `src/core/errors.ts:13-51` `SpineLoaderError` + `AtlasNotFoundError`.
**Apply to:** new `MissingImagesDirError` (in errors.ts) + new `PngHeaderParseError` (can live in errors.ts OR png-header.ts — RESEARCH.md line 226 puts it in png-header.ts; either is acceptable but errors.ts is the established home for IPC-routed errors).

```typescript
// errors.ts:13-18 (root class):
export class SpineLoaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpineLoaderError';
  }
}

// errors.ts:27-51 (subclass template — two-field constructor + .name override):
export class AtlasNotFoundError extends SpineLoaderError {
  constructor(
    public readonly searchedPath: string,
    public readonly skeletonPath: string,
  ) {
    super(`...message body referencing both fields...`);
    this.name = 'AtlasNotFoundError';   // ← LOAD-BEARING for IPC routing
  }
}
```

**Critical:** `.name` field is load-bearing — `src/main/ipc.ts:117-133` `KNOWN_KINDS` Set routes by `err.name` against the SerializableError union. Forgetting `.name = 'MissingImagesDirError'` means the error surfaces as `kind: 'Unknown'` instead of routing through its own envelope arm.

### IPC error-routing (`KNOWN_KINDS` registration)

**Source:** `src/main/ipc.ts:117-133`.
**Apply to:** every new typed error class meant to surface in the renderer with a typed envelope.

```typescript
// ipc.ts:117-133:
type KnownErrorKind = Exclude<
  SerializableError['kind'],
  'SkeletonNotFoundOnLoadError' | 'SpineVersionUnsupportedError'
>;

const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
]);
```

For `MissingImagesDirError`: append `'MissingImagesDirError'` to the Set, AND extend the `SerializableError['kind']` union in `shared/types.ts:580-589`. The `Exclude<>` type derivation propagates automatically.

### `.stmproj` schema-extension recipe (validate / migrate / serialize / materialize)

**Source:** Phase 20 documentation field — `src/core/project-file.ts:140-152` (pre-massage), `:174-180` (per-field validate), `:267-286` (serialize), `:355-381` (materialize); + `src/shared/types.ts:670-703` (ProjectFileV1 + AppSessionState).
**Apply to:** new `loaderMode` field per D-04 + D-08.

**Five-step recipe:**
1. Add field to `ProjectFileV1` interface (shared/types.ts:670-682).
2. Add field to `AppSessionState` interface (shared/types.ts:692-703).
3. Add pre-massage block in `validateProjectFile` defaulting `obj.loaderMode = 'auto'` when undefined (project-file.ts ~line 152).
4. Add per-field validator branch (project-file.ts ~line 180).
5. Add field to `serializeProjectFile` return + `materializeProjectFile` return + `PartialMaterialized` interface (project-file.ts:267-286, 305-345, 355-381).

**Why pre-massage matters:** legacy stmproj files (Phase 8/20-vintage) have NO `loaderMode` field. Without pre-massage, the per-field validator rejects them with `'invalid-shape'` and the materializer back-fill never runs. RESEARCH.md §Pitfall 6 documents this trap explicitly.

### Null-guard cascade for `LoadResult.atlasPath: string | null`

**Source:** `src/main/project-io.ts:840` (`typeof a.atlasPath === 'string' ? a.atlasPath : undefined`) + `:400-406` (`materialized.atlasPath !== null ? { atlasPath: ... } : {}`).
**Apply to:** every consumer of `LoadResult.atlasPath` per CONTEXT.md D-03 audit list.

```typescript
// project-io.ts:840 (the canonical null-routing idiom — already in place):
const atlasPath = typeof a.atlasPath === 'string' ? a.atlasPath : undefined;

// project-io.ts:400-406 (the canonical null-conditional opts shape):
load = loadSkeleton(
  materialized.skeletonPath,
  materialized.atlasPath !== null ? { atlasPath: materialized.atlasPath } : {},
);
```

**Audit sites (RESEARCH.md §Pitfall 8 confirms each is null-tolerant or needs no change):**
- `src/main/summary.ts:115` — `atlasPath: load.atlasPath` passes null through; type widening at SkeletonSummary cascades automatically.
- `src/main/project-io.ts:400-406, 484-486, 891` — null-guards already in place ✅.
- `src/main/sampler-worker.ts:102` — `params.atlasRoot ? { atlasPath: params.atlasRoot } : {}` already conditional ✅.
- `src/renderer/src/components/AppShell.tsx:612-613, 1053` — `summary.atlasPath ?? null` defensive ✅.

### vitest test-file convention

**Source:** `tests/core/loader.spec.ts:1-30` (header docblock + imports + fixture-path pattern).
**Apply to:** new tests/core/{png-header,synthetic-atlas,loader-atlas-less}.spec.ts.

```typescript
// loader.spec.ts:1-30 (canonical test-file structure):
/**
 * Phase 0 Plan 05 — Tests for `src/core/loader.ts`.
 * Behavior gates pulled from the plan's `<behavior>` block:
 *   - F1.1 + F1.2: ...
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  AtlasNotFoundError,
  SkeletonJsonNotFoundError,
} from '../../src/core/errors.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
```

Three idioms locked: header docblock with phase/req refs, `describe('module (req IDs)', () => { ... })` grouping, fixture-path resolution via `path.resolve('fixtures/...')`.

### Tmpdir-based negative test fixture pattern

**Source:** `tests/core/loader.spec.ts:73-97`.
**Apply to:** `tests/core/png-header.spec.ts` (negative cases like empty file, truncated bytes), `tests/core/loader-atlas-less.spec.ts` (D-10 catastrophic case with absent images/ dir).

```typescript
// loader.spec.ts:73-97 (canonical tmpdir pattern):
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-'));
const jsonPath = path.join(tmpDir, 'rig.json');
fs.writeFileSync(jsonPath, '{"skeleton":{"spine":"4.2.43"}}');
try {
  let caught: unknown;
  try {
    loadSkeleton(jsonPath);
  } catch (e) {
    caught = e;
  }
  expect(caught).toBeInstanceOf(AtlasNotFoundError);
  // ... per-error-class assertions ...
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
```

---

## No Analog Found

No new files lack an in-repo analog. The closest "novel" patterns — PNG IHDR byte-walk and `SilentSkipAttachmentLoader` — are documented end-to-end in RESEARCH.md §Open Question 3 (lines 207-293) and §Pitfall 1 / §Implementation Approaches (lines 641-650), which the planner consumes in lieu of an in-repo analog.

| Pseudo-Gap | Resolution |
|------------|------------|
| PNG IHDR byte parsing | RESEARCH.md provides paste-able 80-line implementation at lines 207-293; Layer-3 invariant + typed-error shape from `src/core/loader.ts` + `src/core/errors.ts`. |
| `SilentSkipAttachmentLoader` subclass | RESEARCH.md provides paste-able 10-line subclass at lines 641-650; subclasses spine-core's `AtlasAttachmentLoader`, no in-repo precedent needed. |
| Atlas-text grammar | RESEARCH.md provides full grammar + sample at lines 144-178. |

---

## Metadata

**Analog search scope:** `src/core/`, `src/main/`, `src/renderer/src/components/`, `src/shared/`, `tests/core/`, `fixtures/`.
**Files scanned:** 23 (8 src/core/*, 7 src/main/*, 1 AppShell.tsx, 1 shared/types.ts, 6 tests/core/*, 4 fixture dirs).
**Pattern extraction date:** 2026-05-01

**Cross-references:**
- CONTEXT.md decisions D-01..D-17 → file modifications above
- RESEARCH.md Pitfalls 1, 2, 3, 4, 5, 6, 8, 9, 10 → constraints applied
- RESEARCH.md INV-1..INV-10 → test cases
- RESEARCH.md Open Questions 1-7 → resolved (planner consumes verdicts directly)
