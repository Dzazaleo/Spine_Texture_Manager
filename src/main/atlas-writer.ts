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
 * Rotation invariant (REPACK-06):
 *   - When `region.rotated === true`, emit the rotate-true line. The
 *     `bounds:w,h` ARE ALREADY post-rotation (maxrects-packer .d.ts:97-98
 *     — packer swaps width/height when `rot` is set; src/core/repack.ts
 *     forwards them as-is). Per TextureAtlas.js:164-169, the parser reads
 *     `bounds:` as post-rotation dims when the rotate-true line is present.
 *   - When `region.rotated === false`, OMIT the rotate line entirely
 *     (do NOT emit a rotate-false line). REPACK-06 acceptance: with
 *     rotation off, NO `.atlas` entry contains a rotate-true line.
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
 * `@esotericsoftware/spine-core` for region name, bounds (x/y/w/h), and
 * rotation flag.
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
      lines.push(`bounds:${region.x},${region.y},${region.w},${region.h}`);
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
