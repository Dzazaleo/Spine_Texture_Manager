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
  SpineVersionUnsupportedError,
} from './errors.js';
import {
  synthesizeAtlasText,
  SilentSkipAttachmentLoader,
} from './synthetic-atlas.js';

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
 * Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
 *
 * Reject Spine JSON exported from versions < 4.2. CLAUDE.md documents
 * 4.2+ as the hard requirement; spine-core 4.2.x's SkeletonJson cannot
 * faithfully read 3.x bone-curve / attachment shapes, leading to silent
 * zero-output runs (Phase 11 §F3 reproduction in
 * `.planning/phases/11-…/11-WIN-FINDINGS.md`). The Optimize Assets path
 * reports success while producing zero usable images — F3 makes that
 * runtime-detectable with an actionable typed error.
 *
 * Lenient on 4.3+ per CONTEXT.md Deferred ("4.3+ is not silently
 * rejected, but it's also not actively supported"); a future phase
 * can split this into a distinct "untested-version" warning surface.
 *
 * Pure string parsing + integer comparison — zero new boundary
 * crossings (Layer-3 invariant: core/ stays pure TS, no DOM/Electron/
 * node:fs additions beyond the existing readFileSync site).
 *
 * Exported so the predicate's seven decision cases can be unit-tested
 * independently of fixture loading
 * (tests/core/loader-version-guard-predicate.spec.ts).
 *
 * @param version  the value of `skeleton.spine` from the parsed JSON, or null if absent.
 * @param skeletonPath  the absolute path to the skeleton JSON (for the error envelope).
 * @throws SpineVersionUnsupportedError if version is null, malformed, or major.minor < 4.2.
 */
export function checkSpineVersion(version: string | null, skeletonPath: string): void {
  if (version === null) {
    // Pre-3.7 had no `skeleton.spine` field. Treat as < 4.2 — reject.
    throw new SpineVersionUnsupportedError('unknown', skeletonPath);
  }
  const parts = version.split('.');
  const major = parseInt(parts[0] ?? '', 10);
  const minor = parseInt(parts[1] ?? '', 10);
  if (Number.isNaN(major) || Number.isNaN(minor)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  if (major < 4 || (major === 4 && minor < 2)) {
    throw new SpineVersionUnsupportedError(version, skeletonPath);
  }
  // 4.2.x and 4.3+ pass.
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

  // Phase 12 / Plan 05 (D-21) — F3 Spine version guard.
  // Inspect skeleton.spine BEFORE atlas resolution so 3.x rigs fail fast
  // with an actionable typed error instead of falling through to spine-core's
  // SkeletonJson (which silently produces zero-output runs at the sampler
  // stage — the F3 reproduction in
  // `.planning/phases/11-…/11-WIN-FINDINGS.md`).
  //
  // JSON.parse is hoisted out of the readSkeletonData call below so the
  // version check + readSkeletonData(parsedJson) share one parse — no
  // double-parse penalty. parsedJson is typed `unknown` and narrowed step
  // by step before reading the version field; spine-core's
  // readSkeletonData accepts unknown-shaped input (it does its own
  // structural read).
  const parsedJson: unknown = JSON.parse(jsonText);
  if (parsedJson !== null && typeof parsedJson === 'object' && 'skeleton' in parsedJson) {
    const skel = (parsedJson as Record<string, unknown>).skeleton;
    if (skel !== null && typeof skel === 'object' && 'spine' in (skel as object)) {
      const spineField = (skel as Record<string, unknown>).spine;
      checkSpineVersion(typeof spineField === 'string' ? spineField : null, skeletonPath);
    } else {
      // skeleton object present but no spine field (pre-3.7 export).
      checkSpineVersion(null, skeletonPath);
    }
  } else {
    // No skeleton object at all — malformed JSON or wrong file type.
    checkSpineVersion(null, skeletonPath);
  }

  // 2. Resolve atlas — Phase 21 (LOAD-01) introduces a 4-way branch
  //    per CONTEXT.md D-05/D-06/D-07/D-08 + RESEARCH.md §Pitfall 9.
  //
  //    Branch order is load-bearing — DO NOT reorder:
  //      1. opts.atlasPath !== undefined → canonical (D-06: throw
  //         AtlasNotFoundError verbatim on read fail; NO fall-through)
  //      2. opts.loaderMode === 'atlas-less' → synthesize (D-08:
  //         skip .atlas read entirely, even if file exists)
  //      3. sibling .atlas readable → canonical (D-07: atlas-by-default)
  //      4. sibling .atlas unreadable → synthesize (D-05: fall-through)
  //
  //    `resolvedAtlasPath` is the value returned in LoadResult.atlasPath
  //    (D-03: nullable). `isAtlasLess` flags downstream branches that
  //    populate sourceDims/sourcePaths/atlasSources from synthesizer
  //    output instead of atlas.regions.
  const siblingAtlasPath = path.join(
    path.dirname(skeletonPath),
    path.basename(skeletonPath, path.extname(skeletonPath)) + '.atlas',
  );

  // Inline the canonical-load + synthesize-now bodies in each of the four
  // branches. Each branch assigns `atlas`, `resolvedAtlasPath`, `isAtlasLess`,
  // and (for synthesis branches) `synthSourcePaths`/`synthDims` directly,
  // so TypeScript's flow analysis can prove every variable is initialized
  // before use below.
  let atlas: TextureAtlas;
  let resolvedAtlasPath: string | null;
  let isAtlasLess: boolean;
  let synthSourcePaths: Map<string, string> | null = null;
  let synthDims: Map<string, { w: number; h: number }> | null = null;
  // Phase 21 Plan 21-09 G-01 — names of regions whose PNG was missing in
  // atlas-less mode. The synthesizer emitted a 1x1 stub region for each so
  // spine-core can resolve the attachment without crashing; this list
  // flows into LoadResult.skippedAttachments below for renderer surfacing.
  let synthMissingPngs: string[] | null = null;

  if (opts.atlasPath !== undefined) {
    // D-06: explicit user-provided atlasPath — try to read; throw verbatim
    // AtlasNotFoundError on fail. NO fall-through to synthesis.
    const explicitAtlasPath = opts.atlasPath;
    let atlasText: string;
    try {
      atlasText = fs.readFileSync(explicitAtlasPath, 'utf8');
    } catch {
      // D-06 — ROADMAP success criterion #5: verbatim AtlasNotFoundError.
      throw new AtlasNotFoundError(explicitAtlasPath, skeletonPath);
    }
    try {
      atlas = new TextureAtlas(atlasText);
      const stubLoader = createStubTextureLoader();
      for (const page of atlas.pages) {
        page.setTexture(stubLoader(page.name));
      }
    } catch (cause) {
      throw new AtlasParseError(explicitAtlasPath, cause);
    }
    resolvedAtlasPath = path.resolve(explicitAtlasPath);
    isAtlasLess = false;
  } else if (opts.loaderMode === 'atlas-less') {
    // D-08: per-project override forces atlas-less even if .atlas exists.
    const dirOfImages = path.join(path.dirname(skeletonPath), 'images');
    const synth = synthesizeAtlasText(parsedJson, dirOfImages, skeletonPath);
    atlas = new TextureAtlas(synth.atlasText);
    const stubLoader = createStubTextureLoader();
    for (const page of atlas.pages) {
      page.setTexture(stubLoader(page.name));
    }
    synthSourcePaths = synth.pngPathsByRegionName;
    synthDims = synth.dimsByRegionName;
    synthMissingPngs = synth.missingPngs; //                                Plan 21-09 G-01
    resolvedAtlasPath = null;
    isAtlasLess = true;
  } else {
    // D-05/D-07 fall-through path: try sibling .atlas first.
    //
    // Note on the double-read of sibling.atlas: the probe below reads the
    // file, and the canonical-mode read in the if-branch below reads it
    // again. The double read is intentional — it keeps the canonical
    // path's error-handling intact (probe failure → fall-through;
    // canonical-load failure → AtlasParseError). The 144-byte
    // SIMPLE_TEST.atlas read takes <1ms; not a perf concern.
    // (T-21-06-02 — accepted per threat register.)
    let siblingReadable = false;
    try {
      fs.readFileSync(siblingAtlasPath, 'utf8'); //                       probe
      siblingReadable = true;
    } catch {
      siblingReadable = false;
    }
    if (siblingReadable) {
      // D-07 — atlas-by-default. Re-read for the actual canonical load.
      let atlasText: string;
      try {
        atlasText = fs.readFileSync(siblingAtlasPath, 'utf8');
      } catch {
        // Probe succeeded but the second read failed (race or transient
        // FS error). Throw verbatim AtlasNotFoundError — same shape as
        // D-06.
        throw new AtlasNotFoundError(siblingAtlasPath, skeletonPath);
      }
      try {
        atlas = new TextureAtlas(atlasText);
        const stubLoader = createStubTextureLoader();
        for (const page of atlas.pages) {
          page.setTexture(stubLoader(page.name));
        }
      } catch (cause) {
        throw new AtlasParseError(siblingAtlasPath, cause);
      }
      resolvedAtlasPath = path.resolve(siblingAtlasPath);
      isAtlasLess = false;
    } else {
      // D-05 — synthesize fall-through, BUT only if a sibling images/
      // folder is present. If neither sibling .atlas NOR images/ exists,
      // this is a malformed-project case (the historical signal): throw
      // AtlasNotFoundError verbatim to preserve ROADMAP success
      // criterion #5 (the legacy "no atlas, no images" contract). This
      // also keeps the pre-Phase-21 AtlasNotFoundError tests in
      // tests/core/loader.spec.ts F1.4 green — the JSON-only tmpdir
      // construction those tests use has no images/ folder either.
      const probeImagesDir = path.join(path.dirname(skeletonPath), 'images');
      let imagesDirExists = false;
      try {
        const stat = fs.statSync(probeImagesDir);
        imagesDirExists = stat.isDirectory();
      } catch {
        imagesDirExists = false;
      }
      if (!imagesDirExists) {
        throw new AtlasNotFoundError(siblingAtlasPath, skeletonPath);
      }
      const synth = synthesizeAtlasText(
        parsedJson,
        probeImagesDir,
        skeletonPath,
      );
      atlas = new TextureAtlas(synth.atlasText);
      const stubLoader = createStubTextureLoader();
      for (const page of atlas.pages) {
        page.setTexture(stubLoader(page.name));
      }
      synthSourcePaths = synth.pngPathsByRegionName;
      synthDims = synth.dimsByRegionName;
      synthMissingPngs = synth.missingPngs; //                              Plan 21-09 G-01
      resolvedAtlasPath = null;
      isAtlasLess = true;
    }
  }

  // 5. Parse skeleton via spine-core's own JSON reader.
  //    `SkeletonJson.readSkeletonData` accepts either a string or a pre-parsed
  //    object; we parse once with V8's JSON.parse (hoisted above for the
  //    Phase 12 F3 version guard) and pass the object so we don't force
  //    spine-core to re-parse.
  //
  //    In atlas-less mode, wrap the AtlasAttachmentLoader in
  //    SilentSkipAttachmentLoader so spine-core silently drops orphan
  //    attachments instead of throwing "Region not found in atlas" (D-09 +
  //    RESEARCH.md §Pitfall 1). In canonical mode, the stock loader is
  //    correct — we want the throw on a malformed atlas.
  //
  //    The cast through `AttachmentLoader` accommodates
  //    SilentSkipAttachmentLoader's narrower-return-type override (it
  //    returns `Attachment | null` where stock returns non-nullable; the
  //    SkeletonJson reader handles null returns gracefully —
  //    SkeletonJson.js:371-372, 404-405). Plan 21-04 SUMMARY documents the
  //    `@ts-expect-error` directives on the override signatures.
  const attachmentLoader = isAtlasLess
    ? (new SilentSkipAttachmentLoader(atlas) as unknown as AtlasAttachmentLoader)
    : new AtlasAttachmentLoader(atlas);
  const skeletonJson = new SkeletonJson(attachmentLoader);
  const skeletonData = skeletonJson.readSkeletonData(parsedJson);

  // 6. Build sourceDims map.
  //    Canonical mode: from atlas.regions (D-15 — source='atlas-orig' if
  //    region.originalWidth/Height differ from packed bounds; else
  //    'atlas-bounds').
  //    Atlas-less mode: from synthDims (D-15 — source='png-header').
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
  const sourceDims = new Map<string, SourceDims>();
  if (isAtlasLess && synthDims) {
    for (const [name, dims] of synthDims) {
      sourceDims.set(name, { w: dims.w, h: dims.h, source: 'png-header' });
    }
  } else {
    for (const region of atlas!.regions) {
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
  }

  // 7. Build sourcePaths map (D-108 + RESEARCH §Pattern 2).
  //    Canonical mode: <imagesDir>/<region.name>.png (existing pattern).
  //    Atlas-less mode: directly from synthSourcePaths (already absolute,
  //    one entry per synthesized region per D-16).
  //
  // Path-only — no fs.access (Phase 6 image-worker pre-flights). Region names
  // may contain '/' (e.g. 'AVATAR/FACE'); the resulting path keeps the
  // subfolder structure intact for F8.3.
  // path.resolve(...) wraps path.join(...) so values are absolute regardless
  // of whether `skeletonPath` was provided as relative or absolute (mirrors
  // the `path.resolve(skeletonPath)` used for the returned skeletonPath).
  const imagesDir = path.join(path.dirname(skeletonPath), 'images');
  const sourcePaths = new Map<string, string>();
  if (isAtlasLess && synthSourcePaths) {
    for (const [name, p] of synthSourcePaths) {
      sourcePaths.set(name, p);
    }
  } else {
    for (const region of atlas!.regions) {
      sourcePaths.set(region.name, path.resolve(path.join(imagesDir, region.name + '.png')));
    }
  }

  // 8. Build atlasSources map.
  //    Canonical mode: pagePath under atlasDir, x/y/w/h from region (existing
  //    Phase 6 Gap-Fix #2 pattern for atlas-packed projects e.g. Jokerman).
  //    Atlas-less mode (D-17): pagePath = per-region PNG, x=0, y=0,
  //    w/h=PNG header dims, rotated=false. The atlas-extract path at
  //    image-worker.ts:148-162 never fires in atlas-less mode (every region
  //    has a sourcePaths entry by D-09 filter), so this map is a metadata-
  //    coherence step.
  //
  // For rotated regions (region.degrees !== 0): the packed bounds W/H
  // are swapped vs the source orig dims (libgdx packer convention). We
  // store originalWidth/originalHeight (the SOURCE dims) here so the
  // image-worker can size its extract correctly — but since the FIRST
  // pass of Gap-Fix #2 emits a 'rotated-region-unsupported' error rather
  // than attempting the rotated-extract, the precise dims don't matter
  // for rotated rows; we still record them for diagnostic clarity.
  const atlasSources = new Map<string, {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  }>();
  if (isAtlasLess && synthSourcePaths && synthDims) {
    for (const [name, dims] of synthDims) {
      atlasSources.set(name, {
        pagePath: synthSourcePaths.get(name)!,
        x: 0,
        y: 0,
        w: dims.w,
        h: dims.h,
        rotated: false,
      });
    }
  } else {
    // Canonical mode: resolvedAtlasPath is non-null (set by loadCanonical).
    const atlasDir = path.dirname(resolvedAtlasPath!);
    for (const region of atlas!.regions) {
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
  }

  // Editor dopesheet FPS for DISPLAY purposes (CLI Frame column). spine-core
  // only populates `skeletonData.fps` when the JSON has a top-level `fps`
  // field (SkeletonJson.js:73). Spine's editor default is 30 — fall back to
  // that silently when the field is absent. NOT used for sampling rate
  // (CLAUDE.md rule #1 forbids fps-driven sampling).
  const editorFps = skeletonData.fps || 30;

  // Phase 21 Plan 21-09 G-01 — surface attachments whose PNGs were missing in
  // atlas-less mode. Each missingPngs entry from the synthesizer is
  // `<regionName>.png`; map back to { name: <regionName>, expectedPngPath:
  // <imagesDir>/<filename> }. Field is OPTIONAL (matches unusedAttachments?:
  // precedent on SkeletonSummary): we leave it absent when there's nothing
  // to surface (canonical mode, or atlas-less mode with all PNGs present).
  // The synthesizer emitted a 1x1 stub region for each entry so spine-core's
  // animation parser resolved them without null-deref crashes; the renderer
  // (Plan 21-10 MissingAttachmentsPanel) hides them from the main panels and
  // surfaces them here for explicit user visibility.
  //
  // Uses imagesDir (declared above for canonical sourcePaths construction;
  // both atlas-less branches compute the same path.dirname(skeletonPath) +
  // '/images' value; canonical mode never has missingPngs entries to surface).
  const skippedAttachments: { name: string; expectedPngPath: string }[] | undefined =
    isAtlasLess && synthMissingPngs !== null && synthMissingPngs.length > 0
      ? synthMissingPngs.map((filename) => ({
          name: filename.endsWith('.png') ? filename.slice(0, -4) : filename,
          expectedPngPath: path.resolve(path.join(imagesDir, filename)),
        }))
      : undefined;

  return {
    skeletonPath: path.resolve(skeletonPath),
    atlasPath: resolvedAtlasPath, //                                      D-03: string | null
    skeletonData,
    atlas: atlas!,
    sourceDims,
    sourcePaths,
    atlasSources,
    editorFps,
    ...(skippedAttachments !== undefined ? { skippedAttachments } : {}), // Plan 21-09 G-01 (optional)
  };
}
