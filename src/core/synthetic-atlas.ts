/**
 * Phase 21 Plan 04 (LOAD-03) — Synthetic atlas for atlas-less mode.
 *   Plan 21-09 (G-01 fix) — stub-region for missing PNG.
 *
 * When the loader detects no `.atlas` file beside the `.json` (D-05) or
 * the per-project `loaderMode === 'atlas-less'` override (D-08), this
 * module:
 *   1. Walks parsedJson.skins[*].attachments[slot][entry] to enumerate
 *      region/mesh/linkedmesh attachment paths (D-01, Pitfall 2: keys
 *      on att.path ?? entryName).
 *   2. For each unique path, resolves <imagesDir>/<path>.png and reads
 *      its IHDR dims via png-header.readPngDims (Plan 21-01). If the read
 *      fails (PNG missing), the region is emitted as a 1x1 stub so
 *      spine-core's animation/skin parser can resolve `attachment.bones`
 *      without crashing (G-01). Exact spine-core crash site is not
 *      pinpointed — see SynthResult.missingPngs docblock.
 *   3. Generates libgdx atlas text (one page per region) that spine-core's
 *      TextureAtlas parser consumes — yielding identical downstream
 *      behavior to a canonical .atlas-backed load. (D-13 text-based
 *      approach: emit a string fed to `new TextureAtlas(text)`, NOT direct
 *      TextureAtlasRegion construction.)
 *   4. The SilentSkipAttachmentLoader subclass converts the stock
 *      AtlasAttachmentLoader's "Region not found" throw into a null
 *      return, for any region the synthesizer didn't emit at all (defensive
 *      guard — every walked path now gets a stub-or-real region, but
 *      downstream callers may still pass paths the synthesizer didn't see).
 *
 * Catastrophic case (D-10, refined per Plan 21-09 ISSUE-006): only when
 * imagesDir does not exist as a directory. An imagesDir that exists but is
 * fully empty is NO LONGER catastrophic — each region gets a 1x1 stub and
 * the missing PNGs surface via SynthResult.missingPngs / LoadResult.skippedAttachments
 * (G-02). This is a deliberate refinement of D-10's original
 * "(folder absent OR folder empty AND ≥1 region ref)" contract: with
 * stub-region machinery in place, an empty dir is just "all PNGs missing"
 * — same surfacing path as "one PNG missing".
 *
 * Layer 3 invariant: pure TS, only node:fs / node:path / spine-core /
 * ./png-header / ./errors imports. CLAUDE.md fact #4 honored —
 * png-header reads IHDR bytes only, no decoding.
 *
 * RESEARCH.md §Pitfall 4 — page name = full region path + '.png'
 * (NOT basename) so AVATAR/HEAD vs PROPS/HEAD don't collide.
 *
 * Sequence support (debug-fix spine-sequence-undercount, 2026-05-08):
 * Spine 4.2 sequence attachments declare `sequence: { count, start, digits }`
 * inside a region/mesh/linkedmesh entry. At runtime spine-ts's
 * AtlasAttachmentLoader.loadSequence iterates `i = 0..count-1` and looks up
 * `<basePath><start+i, zero-padded to digits>` via atlas.findRegion. The
 * synthesizer must therefore enumerate those N composed names rather than the
 * single basePath, so each frame's PNG (under `<imagesDir>/<basePath><frame>.png`)
 * is registered + measured + exported independently. Filename rule verbatim
 * from `node_modules/@esotericsoftware/spine-core/dist/attachments/Sequence.js:61-68`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { AtlasAttachmentLoader } from 'spine-core-42';
import { readPngDims } from './png-header.js';
import { MissingImagesDirError } from './errors.js';

export interface SynthResult {
  /** Generated libgdx atlas text — feed to `new TextureAtlas(text)`. */
  atlasText: string;
  /**
   * Map from region.name → absolute PNG path on disk (D-16).
   * REAL PNGs only — does NOT include stubbed missing-PNG regions
   * (Plan 21-09 G-01 fix). The map stays PNG-truthful so the loader's
   * downstream sourceDims/sourcePaths/atlasSources only carry real-PNG
   * entries (T-21-09-04: stubbed regions never reach the export plan).
   */
  pngPathsByRegionName: Map<string, string>;
  /**
   * Map from region.name → PNG IHDR dims (D-15 — for sourceDims construction).
   * REAL PNGs only — does NOT include stubbed missing-PNG regions
   * (Plan 21-09 G-01 fix). Same PNG-truthful posture as
   * pngPathsByRegionName above.
   */
  dimsByRegionName: Map<string, { w: number; h: number }>;
  /**
   * Phase 21 Plan 21-09 G-01 fix — region paths whose PNG read failed; the
   * synthesizer emitted a 1x1 stub region in atlasText for each so spine-core's
   * animation/skin parser can resolve them without crashing on
   * `attachment.bones`. Note: the EXACT spine-core path that reads
   * `attachment.bones` without a null-check is not pinpointed in this
   * docblock — earlier draft language attempted a specific line-number
   * citation that was not verified end-to-end against every reproducer,
   * so we deliberately leave the exact site unstated. The fix works
   * regardless because the stub region makes
   * `skin.getAttachment(...)` return a real (stubbed) MeshAttachment instead
   * of null, satisfying any downstream `attachment.bones` read.
   *
   * Each entry is `<regionName>.png` (matches the file the user would expect
   * on disk relative to imagesDir). The loader threads this list to
   * LoadResult.skippedAttachments for renderer surfacing (Plan 21-10
   * MissingAttachmentsPanel — G-02).
   */
  missingPngs: string[];
}

/**
 * Walks parsedJson.skins[*].attachments to enumerate region/mesh/linkedmesh
 * paths. For each unique path, attempts to read PNG dims from
 * `<imagesDir>/<path>.png`. Returns synthesized atlas text + per-region
 * metadata for downstream maps.
 *
 *   - D-09 + Plan 21-09 G-01 fix: per-region missing PNG → emit a 1x1 stub
 *     region in the atlas text for that path. spine-core's parser resolves
 *     the stubbed region successfully; the missing-PNG name flows out via
 *     SynthResult.missingPngs for downstream surfacing
 *     (LoadResult.skippedAttachments → MissingAttachmentsPanel in Plan 21-10).
 *   - D-10 catastrophic (refined per Plan 21-09 ISSUE-006): only when
 *     imagesDir does not exist as a directory. An imagesDir that exists but
 *     is fully empty produces a successful synthesis with all-stub regions
 *     (every entry shows up in missingPngs).
 */
export function synthesizeAtlasText(
  parsedJson: unknown,
  imagesDir: string,
  skeletonPath: string,
): SynthResult {
  // Pre-flight images/ folder existence (RESEARCH.md §Pitfall 5).
  let imagesDirExists = false;
  try {
    const stat = fs.statSync(imagesDir);
    imagesDirExists = stat.isDirectory();
  } catch {
    imagesDirExists = false;
  }

  const regionPaths = walkSyntheticRegionPaths(parsedJson);

  // D-10 first variant — folder absent + JSON has region refs.
  if (!imagesDirExists && regionPaths.size > 0) {
    throw new MissingImagesDirError(
      imagesDir,
      skeletonPath,
      [...regionPaths].map((p) => p + '.png'),
    );
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
    } catch {
      // Plan 21-09 G-01 stub-region fix (replaces the pre-G-01 silent-skip-
      // via-drop): emit a 1x1 stub region in the atlas text for the missing
      // PNG so spine-core's atlas parser sees a valid region for this name.
      // The SilentSkipAttachmentLoader will then return a real (stubbed) mesh
      // attachment from newMeshAttachment, which lets spine-core's animation
      // and skin parsers read `attachment.bones` without a null-deref crash.
      // (Exact spine-core crash site varies — see SynthResult.missingPngs
      // docblock for the honest "not pinpointed" note.)
      //
      // The 1x1 stub is intentionally degenerate: the sampler will compute
      // garbage AABBs against this stub, and the renderer filters those out
      // via the `skippedAttachments` cascade (loader.ts → summary.ts →
      // SkeletonSummary → MissingAttachmentsPanel in Plan 21-10).
      //
      // pngPathsByRegionName / dimsByRegionName intentionally NOT updated —
      // they stay PNG-truthful so downstream maps (sourceDims, sourcePaths,
      // atlasSources) only carry real-PNG entries (T-21-09-04 mitigation).
      missingPngs.push(regionName + '.png');
      if (lines.length > 0) lines.push('');
      lines.push(regionName + '.png'); //                       page name (Pitfall 4: full path + .png; G-01 stub)
      lines.push('size: 1,1');
      lines.push('filter: Linear,Linear');
      lines.push(regionName); //                                region name (G-01 stub; first non-`:` line ends page-fields loop)
      lines.push('bounds: 0,0,1,1');
      continue;
    }
    // Atlas text format — one page per region; blank line BETWEEN pages
    // (not within a page). The TextureAtlas parser at TextureAtlas.js:113-130
    // resets `page = null` on a blank line, so a blank line BETWEEN page
    // header and region name would cause the region name to be parsed as
    // a new (empty) page. The canonical SIMPLE_TEST.atlas confirms the
    // grammar: page-name → size:/filter: → region-name (no blank) →
    // bounds: → blank line → next page.
    if (lines.length > 0) lines.push('');
    lines.push(regionName + '.png'); //                         page name (Pitfall 4: full path + .png)
    lines.push(`size: ${dims.width},${dims.height}`);
    lines.push('filter: Linear,Linear');
    lines.push(regionName); //                                  region name on its own line (NOT colon-prefixed; first non-`:` line ends page-fields loop)
    lines.push(`bounds: 0,0,${dims.width},${dims.height}`);
    pngPathsByRegionName.set(regionName, pngPath);
    dimsByRegionName.set(regionName, { w: dims.width, h: dims.height });
  }

  // Plan 21-09 G-01 fix: REMOVED the pre-existing second-variant catastrophic
  // throw that previously fired when the images dir existed but every per-region
  // PNG read failed. An images dir that exists but is fully empty is no longer
  // catastrophic — each region got a 1x1 stub above; the user sees them in
  // skippedAttachments (Plan 21-10 panel). The folder-absent first-variant
  // guard above (line ~96-102) is still catastrophic and remains unchanged.
  // (See Plan 21-09 ISSUE-006 note in the module docblock.)

  return {
    atlasText: lines.join('\n'),
    pngPathsByRegionName,
    dimsByRegionName,
    missingPngs, //                                              Plan 21-09 G-01
  };
}

/**
 * Compose the per-frame region path for a sequence attachment. Mirrors
 * spine-core's `Sequence.getPath(basePath, index)` verbatim
 * (Sequence.js:61-68): `basePath + (start + index).toString().padStart(digits, '0')`.
 *
 * Defaults match SkeletonJson.js:478 (`start` defaults to 1, `digits` to 0).
 * Caller passes the raw JSON values; this helper handles the padding rule.
 *
 * Exported for use by callers that need the same composition (e.g. the
 * loader's parsedJson walks for canonical/actual dims and atlas-source
 * sourcePaths registration). Pure function — no I/O.
 */
export function composeSequenceFramePath(
  basePath: string,
  index: number,
  start: number,
  digits: number,
): string {
  const frame = (start + index).toString();
  let result = basePath;
  for (let i = digits - frame.length; i > 0; i--) result += '0';
  result += frame;
  return result;
}

/**
 * Walks parsedJson.skins[*].attachments[slot][entry] and returns the set
 * of region paths the synthesizer must produce. A "region path" here is
 * `att.path ?? entryName` (RESEARCH.md §Pitfall 2 — Jokerman fixture has
 * 6 attachments where `path` differs from entryName).
 *
 * Filters on type ∈ {region, mesh, linkedmesh} per RESEARCH.md §Open
 * Question 7 — these are the three attachment types that resolve to a
 * TextureAtlas region (path/point/clipping/boundingbox don't).
 *
 * Sequence support (debug-fix spine-sequence-undercount, 2026-05-08): when an
 * attachment carries a `sequence: { count, start, digits }` block, expand to
 * N composed paths `<basePath><start+i, zero-padded>` instead of the single
 * basePath. spine-ts's AtlasAttachmentLoader.loadSequence at runtime
 * (AtlasAttachmentLoader.js:44-53) demands all N composed names; without
 * this expansion the load fails with `Region not found in atlas: <basePath><frame>`.
 */
function walkSyntheticRegionPaths(parsedJson: unknown): Set<string> {
  const paths = new Set<string>();
  const root = parsedJson as {
    skins?: Array<{
      attachments?: Record<
        string,
        Record<
          string,
          {
            type?: string;
            name?: string;
            path?: string;
            sequence?: { count?: number; start?: number; digits?: number };
          }
        >
      >;
    }>;
  };
  for (const skin of root.skins ?? []) {
    for (const slotName in skin.attachments) {
      const slot = skin.attachments![slotName];
      for (const entryName in slot) {
        const att = slot[entryName];
        const type = att.type ?? 'region'; //                     SkeletonJson.js:366 default
        if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
        // SkeletonJson.js:365 (`name = map.name ?? entryName`) + 368 (`path = map.path ?? name`).
        // Net: resolvedPath = att.path ?? att.name ?? entryName. The middle `att.name` step
        // covers non-default-skin renames shaped `{ entryKey: { name: "X" } }` (no `path`).
        const lookupPath = att.path ?? att.name ?? entryName;
        // Sequence-aware expansion — see function docblock + Sequence.js:61-68.
        if (att.sequence !== undefined && att.sequence !== null) {
          const count = att.sequence.count ?? 0;
          const start = att.sequence.start ?? 1; // SkeletonJson.js:478 default
          const digits = att.sequence.digits ?? 0; // SkeletonJson.js:479 default
          if (count > 0) {
            for (let i = 0; i < count; i++) {
              paths.add(composeSequenceFramePath(lookupPath, i, start, digits));
            }
            continue;
          }
          // Defensive: sequence with count=0 — fall through to single-path
          // registration below (matches pre-sequence-fix behavior; harmless).
        }
        paths.add(lookupPath);
      }
    }
  }
  return paths;
}

/**
 * AttachmentLoader subclass that returns null instead of throwing when a
 * region is missing from the atlas (RESEARCH.md §Pitfall 1). spine-core's
 * SkeletonJson.readAttachment handles null returns gracefully
 * (SkeletonJson.js:371-372, 404-405 + 313-314), so the orphan attachment
 * is silently skipped — D-09.
 *
 * Subclasses spine-core's AtlasAttachmentLoader so happy-path behavior is
 * inherited identically; only the two methods that throw are overridden.
 *
 * --------------------------------------------------------------------------
 * debug-fix images-src-noop-stmproj-crash (2026-05-19) — DUAL-RUNTIME SEAM.
 *
 * v1.6 is dual-runtime (Spine 4.2 via `spine-core-42`, 4.3 via
 * `@esotericsoftware/spine-core`). This module statically imports the **4.2**
 * `AtlasAttachmentLoader`, but `runtime-43.parseSkeleton(atlasLess=true)`
 * routes the **4.3** `SkeletonJson` through a SilentSkip loader. The 4.2 and
 * 4.3 `AttachmentLoader` method signatures DIVERGE:
 *
 *   4.2  newRegionAttachment(skin, name, path, sequence)              // 4 args
 *   4.3  newRegionAttachment(skin, placeholder, name, path, sequence) // 5 args
 *
 * (Verified: spine-core-42 AtlasAttachmentLoader.js:54 vs
 * @esotericsoftware/spine-core AtlasAttachmentLoader.js:61 +
 * SkeletonJson.js:525/556.) Two consequences, both fixed here:
 *
 *   1. ARG-SHIFT: under the 4.3 reader, the old 4-param override bound its
 *      `sequence` parameter to 4.3's `path` STRING. `string != null`, so the
 *      D-09 null-guard was bypassed and 4.2 `loadSequence` did
 *      `("string").regions.length` → "Cannot read properties of undefined
 *      (reading 'length')". The overrides below are now ARITY-AWARE: they
 *      normalize to `{ attachmentPath, sequence }` for either signature and
 *      forward the ORIGINAL `arguments` to `super.*` so the actual base
 *      class receives the exact shape IT expects.
 *
 *   2. BASE-CLASS MISMATCH: forwarding 4.3-shaped calls (incl. 4.3 `Sequence`
 *      objects) into the **4.2** `super.loadSequence` is still wrong (4.2
 *      `Sequence` ≠ 4.3 `Sequence`). So `SilentSkipAttachmentLoader` is now a
 *      base-parametric FACTORY: `makeSilentSkipAttachmentLoader(Base)` lets
 *      `runtime-43` pass the **4.3** `AtlasAttachmentLoader` (so `super.*` is
 *      the 4.3 base) while `runtime-42` keeps the 4.2 one. The 4.2 leg is
 *      byte-behavior-identical (4-arg in → 4-arg `super`); only the
 *      previously-broken 4.3 atlas-less leg changes.
 * --------------------------------------------------------------------------
 */

// Structural shape of an AtlasAttachmentLoader-like base. Both spine-core-42
// and @esotericsoftware/spine-core 4.3 satisfy this nominally; the override
// only needs `.atlas.findRegion` + the two `new*Attachment` supers.
interface AtlasAttachmentLoaderLike {
  atlas: { findRegion(path: string): unknown };
  newRegionAttachment(...args: unknown[]): unknown;
  newMeshAttachment(...args: unknown[]): unknown;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AtlasAttachmentLoaderCtor = new (atlas: any) => AtlasAttachmentLoaderLike;

/**
 * Normalize a `new{Region,Mesh}Attachment` call to `{ attachmentPath,
 * sequence }` regardless of which spine-core major invoked it.
 *
 *   4.2 (4 args): (skin, name, path, sequence)
 *   4.3 (5 args): (skin, placeholder, name, path, sequence)
 *
 * Discriminated purely on `args.length` — 4.3's reader ALWAYS passes 5
 * positional args (SkeletonJson.js:525/556), 4.2's ALWAYS passes 4
 * (AtlasAttachmentLoader.js:54). `sequence` is the trailing arg in both.
 */
function normalizeAttachmentArgs(args: unknown[]): {
  attachmentPath: string;
  sequence: unknown;
} {
  if (args.length >= 5) {
    // 4.3 — (skin, placeholder, name, path, sequence)
    return { attachmentPath: args[3] as string, sequence: args[4] };
  }
  // 4.2 — (skin, name, path, sequence)
  return { attachmentPath: args[2] as string, sequence: args[3] };
}

/**
 * Base-parametric SilentSkip factory. `runtime-42` passes the 4.2
 * `AtlasAttachmentLoader`; `runtime-43` passes the 4.3 one. The returned
 * class subclasses the supplied base so `super.*` (incl. `loadSequence` /
 * `findRegions`) is always the matching-major implementation.
 */
export function makeSilentSkipAttachmentLoader(Base: AtlasAttachmentLoaderCtor) {
  return class SilentSkipAttachmentLoaderImpl extends (Base as AtlasAttachmentLoaderCtor) {
    // Variadic to accept BOTH the 4.2 (4-arg) and 4.3 (5-arg) signatures.
    // Forwards the ORIGINAL arguments to `super.*` so the matching-major
    // base gets the exact shape it expects (Sequence object identity is
    // preserved per-major because `Base` is the same-major loader).
    newRegionAttachment(...args: unknown[]): unknown {
      const { attachmentPath, sequence } = normalizeAttachmentArgs(args);
      // D-09 silent-skip: only when there is NO sequence (a plain region
      // whose single PNG is genuinely absent). With a sequence, the
      // synthesizer registered all N composed frame paths — defer to super
      // and let it resolve them (the synthetic atlas always has stub
      // regions for missing PNGs, so super does not throw).
      if (sequence === null || sequence === undefined) {
        if (this.atlas.findRegion(attachmentPath) === null) return null;
      }
      return (super.newRegionAttachment as (...a: unknown[]) => unknown)(
        ...args,
      );
    }

    newMeshAttachment(...args: unknown[]): unknown {
      const { attachmentPath, sequence } = normalizeAttachmentArgs(args);
      if (sequence === null || sequence === undefined) {
        if (this.atlas.findRegion(attachmentPath) === null) return null;
      }
      return (super.newMeshAttachment as (...a: unknown[]) => unknown)(
        ...args,
      );
    }
  };
}

/**
 * 4.2-bound default — preserves the historical import surface for
 * `runtime-42.ts` and existing tests (tests/core/synthetic-atlas.spec.ts).
 * Byte-behavior-identical to the pre-2026-05-19 class for the 4.2 (4-arg)
 * call path.
 */
export const SilentSkipAttachmentLoader = makeSilentSkipAttachmentLoader(
  AtlasAttachmentLoader as unknown as AtlasAttachmentLoaderCtor,
);
