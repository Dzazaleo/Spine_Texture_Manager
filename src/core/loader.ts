/**
 * Headless Spine 4.2 loader — parses a skeleton JSON + its sibling atlas
 * WITHOUT decoding any PNG bytes. The returned `LoadResult` is the single
 * input the Phase 0 sampler needs.
 *
 * Contract (locked in 00-CONTEXT.md — Loader Contract):
 *   1. If `skeletonPath` is not readable → throw `SkeletonJsonNotFoundError`.
 *   2. Otherwise, resolve atlas path:
 *        opts.atlasPath  ??  sibling `<basename>.atlas` next to the JSON.
 *   3. If that atlas file is not readable → throw `AtlasNotFoundError`.
 *   4. Parse the atlas text via `new TextureAtlas(atlasText)` and attach a
 *      stub `Texture` to each page (no pixel data loaded, no fs I/O inside
 *      the stub).
 *   5. Parse the skeleton JSON via `new SkeletonJson(new AtlasAttachmentLoader(atlas))`.
 *   6. Build a `sourceDims` map from atlas regions, preferring
 *      `originalWidth/originalHeight` (`atlas-orig`) and falling back to
 *      `width/height` (`atlas-bounds`) when the atlas has no `orig:` line.
 *
 * Notes:
 *   - This file uses `node:fs` ONLY at load time — sampler hot-loop code in
 *     plans 00-03..00-05 MUST NOT re-enter the loader. Requirement N2.3.
 *   - PNG bytes are never touched. Requirement F1.3.
 *   - spine-core 4.2 ships a `FakeTexture` class already (see
 *     `@esotericsoftware/spine-core/Texture`), but we wrap it with a tiny
 *     named `StubTexture` subclass so the intent is explicit in stack traces
 *     and so the `createStubTextureLoader()` factory stays a stable public
 *     export regardless of whether spine-core reshuffles `FakeTexture`.
 */

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
import type { LoadResult, LoaderOptions, SourceDims } from './types.js';
import {
  AtlasNotFoundError,
  AtlasParseError,
  SkeletonJsonNotFoundError,
} from './errors.js';

/**
 * Headless stub texture. Fabricated from atlas metadata only. Never decodes
 * pixels. All overridable methods are deliberate no-ops — `dispose`, filter
 * setters, and wrap setters have no meaningful effect without a GPU/image
 * backing, and the Phase 0 sampler never calls them.
 *
 * Subclass of spine-core's abstract `Texture` — implements the three abstract
 * methods required by the 4.2 type signature.
 */
class StubTexture extends Texture {
  constructor() {
    // Pass a sentinel null image — spine-core's Texture constructor stores
    // whatever we give it; nothing in the Phase 0 pipeline reads it.
    super(null);
  }
  setFilters(_min: TextureFilter, _mag: TextureFilter): void {
    /* no-op — no GPU backing */
  }
  setWraps(_u: TextureWrap, _v: TextureWrap): void {
    /* no-op — no GPU backing */
  }
  dispose(): void {
    /* no-op — nothing to release */
  }
}

/**
 * Returns a TextureLoader-shaped callback that fabricates a `StubTexture`
 * per atlas page. No filesystem I/O, no PNG decode. This is the headless
 * loading pattern documented in the spine-ts guide.
 *
 * Exported so tests and the CLI can use the exact same stub the loader uses.
 */
export function createStubTextureLoader(): (pageName: string) => Texture {
  return (_pageName: string) => new StubTexture();
}

/**
 * Load a Spine 4.2 skeleton JSON plus its atlas, headlessly.
 *
 * @param skeletonPath - Path (absolute or relative to `process.cwd()`) to the `.json` skeleton file.
 * @param opts         - Optional overrides (e.g. explicit atlas path).
 * @returns A fully-parsed `LoadResult` ready for the sampler.
 * @throws  `SkeletonJsonNotFoundError` if the skeleton file is unreadable.
 * @throws  `AtlasNotFoundError`        if the atlas companion is unreadable.
 * @throws  `AtlasParseError`           if atlas text is malformed.
 */
export function loadSkeleton(
  skeletonPath: string,
  opts: LoaderOptions = {},
): LoadResult {
  // 1. Read skeleton JSON
  let jsonText: string;
  try {
    jsonText = fs.readFileSync(skeletonPath, 'utf8');
  } catch {
    throw new SkeletonJsonNotFoundError(skeletonPath);
  }

  // 2. Resolve atlas path (sibling <basename>.atlas by default)
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
  //    `SkeletonJson.readSkeletonData` accepts either a string or a pre-parsed
  //    object; we parse once with V8's JSON.parse and pass the object so we
  //    don't force spine-core to re-parse.
  const attachmentLoader = new AtlasAttachmentLoader(atlas);
  const skeletonJson = new SkeletonJson(attachmentLoader);
  const skeletonData = skeletonJson.readSkeletonData(JSON.parse(jsonText));

  // 6. Build sourceDims map from atlas regions.
  //
  //    spine-core 4.2 auto-backfills `originalWidth/Height` from packed
  //    `width/height` when the atlas has no `orig:` / `offsets:` line
  //    (TextureAtlas.js lines 152–155 in the installed version). So
  //    `region.originalWidth > 0` is always true after parsing and cannot
  //    distinguish an atlas-supplied `orig` from a bounds-fallback.
  //
  //    Best available signal: compare originals to packed dims. If they
  //    differ, the atlas whitespace-stripped and supplied real source dims —
  //    tag 'atlas-orig'. If they're equal, either the atlas shipped an
  //    identity `orig:` line (rare) or spine-core backfilled from bounds;
  //    in both cases the number we return IS the packed W×H, so 'atlas-bounds'
  //    is the honest label.
  //
  //    For the Phase 0 SIMPLE_TEST fixture (bounds-only atlas) this yields
  //    `source: 'atlas-bounds'` for all three regions, matching the plan's
  //    intent; for atlases that ship real `orig:` lines with whitespace-
  //    stripped packed regions, it correctly flags 'atlas-orig'.
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

  // Phase 6 Plan 02 — sourcePaths map (D-108 + RESEARCH §Pattern 2).
  // Resolves each atlas region name to its source PNG path under the
  // sibling `images/` folder. Path-only — no fs.access (Phase 6 image-worker
  // pre-flights). Region names may contain '/' (e.g. 'AVATAR/FACE'); the
  // resulting path keeps the subfolder structure intact for F8.3.
  // path.resolve(...) wraps path.join(...) so values are absolute regardless
  // of whether `skeletonPath` was provided as relative or absolute (mirrors
  // the `path.resolve(skeletonPath)` used for the returned skeletonPath).
  const imagesDir = path.join(path.dirname(skeletonPath), 'images');
  const sourcePaths = new Map<string, string>();
  for (const region of atlas.regions) {
    sourcePaths.set(region.name, path.resolve(path.join(imagesDir, region.name + '.png')));
  }

  // Phase 6 Gap-Fix #2 (2026-04-25) — atlasSources map for atlas-packed
  // projects (e.g. fixtures/Jokerman/). Resolved relative to the atlas
  // file's own directory because atlas page PNGs sit beside the .atlas
  // file on disk, NOT under the sibling images/ folder. For SIMPLE_TEST
  // and EXPORT_PROJECT (atlas + per-region PNGs in images/) this map is
  // populated but the image-worker prefers sourcePaths first.
  //
  // For rotated regions (region.degrees !== 0): the packed bounds W/H
  // are swapped vs the source orig dims (libgdx packer convention). We
  // store originalWidth/originalHeight (the SOURCE dims) here so the
  // image-worker can size its extract correctly — but since the FIRST
  // pass of Gap-Fix #2 emits a 'rotated-region-unsupported' error rather
  // than attempting the rotated-extract, the precise dims don't matter
  // for rotated rows; we still record them for diagnostic clarity.
  const atlasDir = path.dirname(atlasPath);
  const atlasSources = new Map<string, {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  }>();
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

  // Editor dopesheet FPS for DISPLAY purposes (CLI Frame column). spine-core
  // only populates `skeletonData.fps` when the JSON has a top-level `fps`
  // field (SkeletonJson.js:73). Spine's editor default is 30 — fall back to
  // that silently when the field is absent. NOT used for sampling rate
  // (CLAUDE.md rule #1 forbids fps-driven sampling).
  const editorFps = skeletonData.fps || 30;

  return {
    skeletonPath: path.resolve(skeletonPath),
    atlasPath: path.resolve(atlasPath),
    skeletonData,
    atlas,
    sourceDims,
    sourcePaths,
    atlasSources,
    editorFps,
  };
}
