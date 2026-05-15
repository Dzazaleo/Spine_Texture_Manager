/**
 * Phase 40 REPACK-02 — Pure-TS pack-planning module wrapping maxrects-packer@2.7.3.
 *
 * Layer 3 hygiene (CLAUDE.md rule #5): NO imports of node:fs, sharp, electron,
 * @esotericsoftware/spine-core (runtime), or DOM types. Only `maxrects-packer`
 * (browser-safe per src/core/atlas-preview.ts:36) is permitted at runtime.
 * Enforced by tests/arch.spec.ts:148-176 core-purity grep block (auto-scans
 * src/core/**.ts).
 *
 * Determinism contract (REPACK-02 / REPACK-08):
 *   - Inputs are sorted by codepoint comparison (a<b/a>b) BEFORE adding to
 *     the packer (RESEARCH §Landmines #9). regionName is loader-mode-invariant
 *     (atlas-source and atlas-less produce identical regionName sets per
 *     project_strict_loadermode_separation memory). This guarantees byte-identical
 *     SHA256 layouts across loaderMode for REPACK-08 cross-mode parity AND
 *     across hosts (WR-01 fix: localeCompare respects process locale, which
 *     varies across macOS/Windows/Linux defaults).
 *
 * Sharp-emits-truth invariant (REPACK-03 prerequisite):
 *   - `packW` and `packH` are the dims sharp ACTUALLY emits via metadata()
 *     read-back, not `buildExportPlan`'s target outW/outH. The packer cannot
 *     lay out a region the bytes don't match.
 *
 * Oversize pre-flight (REPACK-10):
 *   - Any input exceeding `opts.maxPageSize` on either axis is captured in
 *     `result.oversize` and NOT added to the packer. The main/repack-worker
 *     consumes `result.oversize[0]` to throw the locked error string BEFORE
 *     any sharp work or file write.
 *
 * Rotation read-back (REPACK-06):
 *   - When `allowRotation: true` and the packer rotated a rect, the packer's
 *     `rect.width` / `rect.height` are ALREADY swapped (maxrects-packer
 *     .d.ts:97-98 — "after `rot` is set, `width/height` of this rectangle
 *     is swaped"). We emit `w/h` AS-IS from the packer (post-rotation).
 */
import { MaxRectsPacker } from 'maxrects-packer';

export interface RepackInput {
  regionName: string;
  packW: number;
  packH: number;
}

export interface RepackOptions {
  maxPageSize: 1024 | 2048 | 4096 | 8192;
  padding: number;
  allowRotation: boolean;
}

export interface RepackedRegion {
  regionName: string;
  pageIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

export interface RepackPage {
  pageIndex: number;
  width: number;
  height: number;
}

export interface RepackResult {
  pages: RepackPage[];
  regions: RepackedRegion[];
  oversize: string[];
}

/**
 * Compute the per-page layout for the given inputs.
 *
 * Algorithm:
 *   1. Oversize pre-flight: any input whose packW/packH exceeds maxPageSize on
 *      either axis is captured in `result.oversize` and NOT added to the packer.
 *   2. Sort remaining inputs by `regionName.localeCompare(...)` — the
 *      loader-mode-invariant deterministic key per RESEARCH §Landmines #9.
 *   3. Construct MaxRectsPacker with smart/pot:false/square:false (tight-fit
 *      bins, matches src/core/atlas-preview.ts:110-119 precedent).
 *   4. Add every region via `packer.add(packW, packH, inp)`.
 *   5. Fold `packer.bins` into `pages` + `regions`. Read `rect.width/height`
 *      AS-IS (post-rotation per .d.ts:97-98) and `rect.rot` as the rotated flag.
 */
export function computeRepack(inputs: RepackInput[], opts: RepackOptions): RepackResult {
  // Step 1: Oversize pre-flight. Inputs exceeding the page-size cap are
  //         captured BEFORE adding to the packer so main/repack-worker can
  //         throw the locked REPACK-10 error string without any sharp work.
  const oversize: string[] = [];
  const packable: RepackInput[] = [];
  for (const inp of inputs) {
    if (inp.packW > opts.maxPageSize || inp.packH > opts.maxPageSize) {
      oversize.push(inp.regionName);
    } else {
      packable.push(inp);
    }
  }
  // WR-01: codepoint compare for host-independent ordering. localeCompare()
  // without an explicit locale uses the host's default collation — macOS
  // (Apple), Windows (ICU), and Linux glibc can flip case-folding /
  // diacritic order, breaking REPACK-08 SHA256 parity across hosts.
  oversize.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  // Step 2: Deterministic sort by regionName (loader-mode-invariant key per
  //         RESEARCH §Landmines #9). This guarantees identical pack output
  //         across atlas-source vs atlas-less inputs for REPACK-08 parity.
  //         WR-01 fix: codepoint compare (a<b/a>b) is byte-equivalent on
  //         every host; localeCompare() respects process locale and can
  //         reorder under different LC_COLLATE / LANG values, defeating
  //         the REPACK-08 cross-host parity contract.
  const sortedInputs = packable.slice().sort((a, b) =>
    a.regionName < b.regionName ? -1 : a.regionName > b.regionName ? 1 : 0,
  );

  // Step 3: Construct packer. pot:false + square:false per RESEARCH (the
  //         user's maxPageSize is a hard ceiling, not a power-of-2 floor;
  //         matches src/core/atlas-preview.ts:110-119 precedent).
  const packer = new MaxRectsPacker(
    opts.maxPageSize,
    opts.maxPageSize,
    opts.padding,
    {
      smart: true,
      allowRotation: opts.allowRotation,
      pot: false,
      square: false,
      border: 0,
    },
  );

  // Step 4: Add each region. (width, height, data) overload — data slot
  //         carries the RepackInput so we can recover regionName during fold.
  for (const inp of sortedInputs) {
    packer.add(inp.packW, inp.packH, inp);
  }

  // Step 5: Fold bins into pages + flat regions array. `rect.width` and
  //         `rect.height` are ALREADY post-rotation per .d.ts:97-98.
  const pages: RepackPage[] = [];
  const regions: RepackedRegion[] = [];
  packer.bins.forEach((bin, pageIndex) => {
    pages.push({ pageIndex, width: bin.width, height: bin.height });
    for (const rect of bin.rects) {
      const inp = (rect as unknown as { data: RepackInput }).data;
      regions.push({
        regionName: inp.regionName,
        pageIndex,
        x: rect.x,
        y: rect.y,
        w: rect.width,
        h: rect.height,
        rotated: (rect as unknown as { rot?: boolean }).rot === true,
      });
    }
  });

  return { pages, regions, oversize };
}
