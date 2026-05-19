/**
 * Phase 40 REPACK-04 — libgdx-format `.atlas` text serializer.
 *
 * Pure function: no `fs.writeFile`, no side effects. Returns a string;
 * `src/main/repack-worker.ts` (Plan 05) does the atomic-write.
 *
 * Grammar source of truth: node_modules/@esotericsoftware/spine-core/dist/
 * TextureAtlas.js lines 31-269. The Phase 40 emitter MUST produce text the
 * parser can read back without loss for all REPACK-04 fields (region name,
 * bounds xy/wh, rotation flag).
 *
 * Whitespace style (matches fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas):
 *   - `key:value` with NO space after the colon.
 *   - LF line endings.
 *   - NO trailing newline.
 *   - ONE blank line BETWEEN adjacent pages in multi-page atlases.
 *   - NO blank line INSIDE a page block (RESEARCH §Landmines #4 —
 *     TextureAtlas.js:113-130 resets `page = null` on blank, corrupting
 *     the parse if a blank lands inside).
 *
 * Page naming (REPACK-05 locked):
 *   - Page 0 → `{projectName}.png`
 *   - Page N (N ≥ 1) → `{projectName}_{N+1}.png` (user-facing "page 2 of 3"
 *     → `_2.png`). The 1-indexing matches user expectation and shipped
 *     Spine examples.
 *
 * Rotation invariant (REPACK-06 — corrected 2026-05-15, debug session
 * `atlas-repack-output-bugs`):
 *   - `bounds:x,y,W,H` carries the PRE-rotation canonical width/height,
 *     NOT the post-rotation page-rect extent. Verified against original
 *     Spine-exported `fixtures/SKINS/JOKERMAN_SPINE_ROT.atlas`: rotated
 *     regions there emit `bounds:` + `offsets:originalW,originalH` with
 *     bounds w/h matching pre-rotation canvas dims, plus a `rotate:90`
 *     (or `rotate:true`) line. The TextureAtlas.js:67-71 parser reads
 *     bounds as canonical dims, then applies the rotate flag to derive
 *     UV coordinates that span the page bitmap's post-rotation extent
 *     (TextureAtlas.js:164-167).
 *   - `offsets:offsetX,offsetY,originalW,originalH` is emitted
 *     UNCONDITIONALLY for every region. We emit it explicitly (rather than
 *     relying on the parser's auto-backfill `originalWidth = region.width`
 *     at TextureAtlas.js:152-155) because that backfill propagates POST-
 *     rotation dims when bounds carries them — which then feeds into our
 *     analyzer's `actualSourceW/H` and produces asymmetric sourceRatio /
 *     single-axis shrink on the Global tab.
 *   - When `region.rotated === true`, emit `rotate:true` line. When
 *     `region.rotated === false`, OMIT the rotate line entirely (do NOT
 *     emit a rotate-false line). REPACK-06 acceptance: with rotation off,
 *     NO `.atlas` entry contains a rotate-true line.
 *
 * Strip-whitespace metadata round-trip (REPACK-12 — debug session
 * `atlas-rotation-neck-oversized`, 2026-05-19):
 *   - The `offsets:` line now carries `region.offsetX,region.offsetY,
 *     region.origCanvasW,region.origCanvasH` — the SOURCE atlas's
 *     strip-whitespace metadata, scaled by the same per-axis factor the
 *     region's pixels were resized by (computed in repack-worker.ts
 *     scaleSourceMeta). When the source atlas was Spine-exported WITH
 *     strip-whitespace this preserves the source's original-to-packed
 *     PROPORTION, which the runtime uses to derive render size (JSON dims ÷
 *     originalWidth, per project_spine_4_2_atlas_json_precedence). Dropping
 *     it (the pre-fix `offsets:0,0,packedW,packedH`) collapsed
 *     `originalWidth` onto the trimmed+resized size — the proportion went
 *     from `srcOrig/srcTrim` to 1.0, inflating every strip-whitespace-
 *     trimmed region by its own trim factor (NECK: source proportion
 *     1148/711 ≈ 1.615 → 1.0 ⇒ ~1.6× oversized; observed 1148/609 ≈
 *     1.885× — the visible UAT bug).
 *   - `bounds:` is UNCHANGED — still `x,y,origW,origH` (the PRE-rotation
 *     canonical packed rect). Only the `offsets:` line changed.
 *   - BACK-COMPAT: when the source had no strip-whitespace the worker sets
 *     `origCanvasW===origW`, `origCanvasH===origH`, `offsetX===offsetY===0`
 *     (repack.ts defaults), so this emits the IDENTICAL
 *     `offsets:0,0,origW,origH` line as the pre-REPACK-12 code. The
 *     REPACK-06 rotation byte-baseline and every non-trimmed atlas are
 *     byte-for-byte unchanged.
 *
 * Defensive: throws if `projectName` contains `:` (would corrupt page-
 * header parsing — RESEARCH §Landmines #5).
 */

import type { RepackPage, RepackedRegion } from '../core/repack.js';

// Re-export so consumers can import the layout types alongside `buildAtlasText`.
export type { RepackPage, RepackedRegion };

export interface AtlasWriterInput {
  projectName: string;
  pages: RepackPage[];
  regions: RepackedRegion[];
}

function pageFilename(projectName: string, pageIndex: number): string {
  if (pageIndex === 0) return `${projectName}.png`;
  return `${projectName}_${pageIndex + 1}.png`;
}

/**
 * Returns libgdx-format .atlas text (LF line endings, no trailing newline).
 *
 * Round-trips losslessly through `new TextureAtlas(text)` from
 * `@esotericsoftware/spine-core` for region name, bounds (x/y/w/h),
 * originalWidth/Height, and rotation flag.
 */
export function buildAtlasText(input: AtlasWriterInput): string {
  if (input.projectName.includes(':')) {
    throw new Error(
      `atlas-writer: projectName must not contain ':' (got "${input.projectName}"). ` +
        `Colon corrupts libgdx page-header parsing (RESEARCH §Landmines #5).`,
    );
  }

  // Sort pages by pageIndex so callers don't have to guarantee ordering.
  // Regions are filtered per-page and emitted in the order provided
  // (core/repack.ts pre-sorts by regionName for deterministic SHA256).
  const sortedPages = input.pages.slice().sort((a, b) => a.pageIndex - b.pageIndex);

  const lines: string[] = [];

  for (let pi = 0; pi < sortedPages.length; pi++) {
    const page = sortedPages[pi];
    // Page header — 5 lines: filename + 4 key:value fields.
    lines.push(pageFilename(input.projectName, page.pageIndex));
    lines.push(`size:${page.width},${page.height}`);
    lines.push('format:RGBA8888');
    lines.push('filter:Linear,Linear');
    lines.push('repeat:none');

    // Region entries for this page — preserve input order (core/repack
    // already sorted by regionName for determinism — RESEARCH §Landmines #9).
    const pageRegions = input.regions.filter((r) => r.pageIndex === page.pageIndex);
    for (const region of pageRegions) {
      lines.push(region.regionName);
      // bounds:X,Y,W,H — W,H are PRE-rotation canonical dims (libgdx
      // convention, verified against Spine-exported rotated atlases). The
      // parser combines bounds with the rotate flag to span the correct
      // page rect (TextureAtlas.js:67-71 + :164-167). UNCHANGED by
      // REPACK-12 — strip-whitespace only affects the offsets line.
      lines.push(`bounds:${region.x},${region.y},${region.origW},${region.origH}`);
      // offsets:offsetX,offsetY,originalW,originalH — REPACK-12: carry the
      // SOURCE atlas's strip-whitespace metadata (scaled by the pixel-resize
      // factor in repack-worker.ts). Equals 0,0,origW,origH when the source
      // had no strip-whitespace (repack.ts defaults srcOrig*→pack*,
      // srcOffset*→0), so this is byte-identical to the pre-fix line for
      // every non-trimmed region (REPACK-06 rotation byte-baseline
      // preserved). For a strip-whitespace source it preserves the source's
      // original-to-packed proportion the runtime uses to derive render
      // size, instead of collapsing originalWidth onto the trimmed+resized
      // packed size. Emitted UNCONDITIONALLY so spine-core does NOT
      // auto-backfill originalWidth from region.width
      // (TextureAtlas.js:152-155).
      lines.push(
        `offsets:${region.offsetX},${region.offsetY},${region.origCanvasW},${region.origCanvasH}`,
      );
      if (region.rotated) {
        lines.push('rotate:true');
      }
      // Intentionally OMIT a rotate-false line when rotated is false —
      // REPACK-06 acceptance: with rotation off, NO `.atlas` entry contains
      // a rotate-true line. The parser default when no rotate line is
      // present is `degrees = 0` (TextureAtlas.js:164-169).
    }

    // ONE blank line between adjacent pages — but NOT after the last page
    // (no trailing newline). RESEARCH §Landmines #4 — blank inside a page
    // block corrupts parse.
    if (pi < sortedPages.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}
