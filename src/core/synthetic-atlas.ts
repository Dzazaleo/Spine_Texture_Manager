/**
 * Phase 21 Plan 04 (LOAD-03) — Synthetic atlas for atlas-less mode.
 *
 * When the loader detects no `.atlas` file beside the `.json` (D-05) or
 * the per-project `loaderMode === 'atlas-less'` override (D-08), this
 * module:
 *   1. Walks parsedJson.skins[*].attachments[slot][entry] to enumerate
 *      region/mesh/linkedmesh attachment paths (D-01, Pitfall 2: keys
 *      on att.path ?? entryName).
 *   2. For each unique path, resolves <imagesDir>/<path>.png and reads
 *      its IHDR dims via png-header.readPngDims (Plan 21-01).
 *   3. Generates libgdx atlas text (one page per PNG, per D-12, D-13) that
 *      spine-core's TextureAtlas parser consumes — yielding identical
 *      downstream behavior to a canonical .atlas-backed load. (D-13
 *      text-based approach: emit a string fed to `new TextureAtlas(text)`,
 *      NOT direct TextureAtlasRegion construction.)
 *   4. The SilentSkipAttachmentLoader subclass converts the stock
 *      AtlasAttachmentLoader's "Region not found" throw into a null
 *      return, so SkeletonJson's existing null-handling path silently
 *      skips orphan attachments (D-09 + Pitfall 1).
 *
 * Layer 3 invariant: pure TS, only node:fs / node:path / spine-core /
 * ./png-header / ./errors imports. CLAUDE.md fact #4 honored —
 * png-header reads IHDR bytes only, no decoding.
 *
 * RESEARCH.md §Pitfall 4 — page name = full region path + '.png'
 * (NOT basename) so AVATAR/HEAD vs PROPS/HEAD don't collide.
 *
 * RESEARCH.md §Pitfall 7 — sequence attachments not supported in this
 * phase (no SIMPLE/EXPORT/Jokerman fixture exercises sequence: blocks;
 * if a real fixture surfaces, file Phase 999 follow-up).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  AtlasAttachmentLoader,
  type Attachment,
  type MeshAttachment,
  type RegionAttachment,
  type Skin,
} from '@esotericsoftware/spine-core';
import { readPngDims } from './png-header.js';
import { MissingImagesDirError } from './errors.js';

// `Sequence` is not re-exported from the spine-core package root (verified
// against node_modules/@esotericsoftware/spine-core/dist/index.d.ts:1-50 —
// only Attachment, AttachmentLoader, BoundingBoxAttachment, ClippingAttachment,
// MeshAttachment, PathAttachment, PointAttachment, RegionAttachment are
// re-exported from `./attachments/`). The AtlasAttachmentLoader signature
// references it nominally but does not surface it. Rather than deep-import
// from `@esotericsoftware/spine-core/dist/attachments/Sequence.js` (couples
// us to internal paths), we use a structural placeholder — the override
// only forwards `sequence` through to `super.*`, never inspecting it, so a
// nominal-type alias is sufficient for the signature contract.
type SpineSequence = unknown;

export interface SynthResult {
  /** Generated libgdx atlas text — feed to `new TextureAtlas(text)`. */
  atlasText: string;
  /** Map from region.name → absolute PNG path on disk (D-16). */
  pngPathsByRegionName: Map<string, string>;
  /** Map from region.name → PNG IHDR dims (D-15 — for sourceDims construction). */
  dimsByRegionName: Map<string, { w: number; h: number }>;
}

/**
 * Walks parsedJson.skins[*].attachments to enumerate region/mesh/linkedmesh
 * paths. For each unique path, attempts to read PNG dims from
 * `<imagesDir>/<path>.png`. Returns synthesized atlas text + per-region
 * metadata for downstream maps.
 *
 *   - D-09 silent-skip: per-region missing PNG → not added to atlas text
 *     (downstream SkeletonJson + SilentSkipAttachmentLoader silently drop
 *     the attachment).
 *   - D-10 catastrophic: imagesDir absent OR every PNG read fails → throw
 *     MissingImagesDirError with the full missingPngs list (D-11).
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
      // D-09: silent skip per-region missing PNG.
      missingPngs.push(regionName + '.png');
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

  // D-10 second variant — folder exists but every PNG read failed.
  if (regionPaths.size > 0 && pngPathsByRegionName.size === 0) {
    throw new MissingImagesDirError(imagesDir, skeletonPath, missingPngs);
  }

  return {
    atlasText: lines.join('\n'),
    pngPathsByRegionName,
    dimsByRegionName,
  };
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
 */
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

/**
 * AttachmentLoader subclass that returns null instead of throwing when a
 * region is missing from the atlas (RESEARCH.md §Pitfall 1). spine-core's
 * SkeletonJson.readAttachment handles null returns gracefully
 * (SkeletonJson.js:371-372, 404-405 + 313-314), so the orphan attachment
 * is silently skipped — D-09.
 *
 * Subclasses spine-core's AtlasAttachmentLoader so happy-path behavior is
 * inherited identically; only the two methods that throw are overridden.
 */
export class SilentSkipAttachmentLoader extends AtlasAttachmentLoader {
  // @ts-expect-error — spine-core's stock signature returns non-nullable
  // RegionAttachment; we narrow to nullable for D-09 silent-skip. The
  // SkeletonJson reader already handles null returns gracefully
  // (SkeletonJson.js:371-372, 404-405). Sequence is also typed
  // non-nullable in stock but `null` is the runtime value when a JSON
  // attachment has no sequence: block (Pitfall 7).
  newRegionAttachment(
    skin: Skin,
    name: string,
    attachmentPath: string,
    sequence: SpineSequence | null,
  ): Attachment | null {
    if (this.atlas.findRegion(attachmentPath) === null) return null;
    return super.newRegionAttachment(
      skin,
      name,
      attachmentPath,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sequence as any,
    ) as RegionAttachment;
  }

  // @ts-expect-error — same nullable-narrowing as newRegionAttachment.
  newMeshAttachment(
    skin: Skin,
    name: string,
    attachmentPath: string,
    sequence: SpineSequence | null,
  ): Attachment | null {
    if (this.atlas.findRegion(attachmentPath) === null) return null;
    return super.newMeshAttachment(
      skin,
      name,
      attachmentPath,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sequence as any,
    ) as MeshAttachment;
  }
}
