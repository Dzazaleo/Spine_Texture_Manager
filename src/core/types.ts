/**
 * Shared types for the Phase 0 headless core-math module.
 *
 * These shapes are the contracts consumed by plans 00-02..00-06:
 *   - `LoadResult` is the return shape of `loadSkeleton()` in `loader.ts`.
 *   - `SourceDims` is how per-region source (pre-pack) dimensions are exposed.
 *   - `SampleRecord` is the per-tick row the sampler writes into peak tables.
 *   - `AABB` is the world-space box type from `bounds.ts`.
 *   - `LoaderOptions` lets callers override the atlas discovery rule.
 *
 * These interfaces erase at compile time. They are pure type shapes — no runtime
 * code lives in this file.
 */

import type {
  SkeletonData,
  TextureAtlas,
} from '@esotericsoftware/spine-core';

export interface LoaderOptions {
  /** Override the atlas path. Defaults to sibling `.atlas` next to the JSON. */
  atlasPath?: string;
  /**
   * Phase 21 (D-08) — per-project loader mode override.
   *
   * - `'auto'` (default when undefined): try sibling `.atlas` first; fall
   *   through to atlas-less synthesis only if the sibling `.atlas` is
   *   unreadable (D-05).
   * - `'atlas-less'`: skip the sibling `.atlas` read entirely and go
   *   straight to synthesis even if a `.atlas` file exists beside the
   *   JSON. Used for the "post-Optimize-overwrite" workflow where the
   *   on-disk atlas is stale and the per-region PNGs are canonical.
   *
   * Independent of `atlasPath` — when both are provided, `atlasPath` is
   * still tried first per D-06 (explicit user intent wins).
   */
  loaderMode?: 'auto' | 'atlas-less';
}

export interface SourceDims {
  w: number;
  h: number;
  /**
   * Provenance:
   * - `'atlas-orig'`: region supplied an `orig:` line in the .atlas file.
   * - `'atlas-bounds'`: fell back to packed `bounds:` W×H (atlas had no `orig:`).
   * - `'png-header'`: Phase 21 atlas-less mode — dims came from PNG IHDR
   *   bytes via `src/core/png-header.ts:readPngDims` (D-15). No .atlas file
   *   was present at load time; the synthesizer in `src/core/synthetic-atlas.ts`
   *   built the atlas from per-region PNG headers.
   */
  source: 'atlas-orig' | 'atlas-bounds' | 'png-header';
}

export interface LoadResult {
  /** Absolute path of the loaded skeleton JSON. */
  skeletonPath: string;
  /**
   * Absolute path of the loaded atlas, OR `null` in atlas-less mode (Phase 21
   * D-03). Null indicates the atlas was synthesized in-memory from per-region
   * PNG headers — there's no on-disk `.atlas` file to reference.
   *
   * Consumers of this field (audit list per RESEARCH.md §Pitfall 8):
   * `src/main/summary.ts:115`, `src/main/project-io.ts:400-406, :484-486, :840`,
   * `src/main/sampler-worker.ts:102`, `src/renderer/src/components/AppShell.tsx:612, :1053`.
   * All sites are already null-defensive (verified during Plan 21 planning).
   */
  atlasPath: string | null;
  /** Parsed skeleton data (pre-instanced — sampler will `new Skeleton(skeletonData)` as needed). */
  skeletonData: SkeletonData;
  /** Parsed atlas. */
  atlas: TextureAtlas;
  /**
   * Map from atlas region name → source (pre-pack) dimensions.
   * Uses `originalWidth/originalHeight` if the atlas supplied an `orig:` line,
   * otherwise falls back to the packed `width/height` ("bounds").
   */
  sourceDims: Map<string, SourceDims>;
  /**
   * Phase 6 Plan 02 (D-108 + RESEARCH §Pattern 2) — Map from atlas region
   * name → absolute path to the source PNG on disk. Resolved at load time
   * via `path.resolve(path.join(path.dirname(skeletonPath), 'images', region.name + '.png'))`.
   *
   * NO `fs.access` is performed here — files may legitimately not exist
   * yet (SIMPLE_PROJECT has no images/ folder). Pre-flight in
   * src/main/image-worker.ts surfaces missing files as 'missing-source'
   * progress events per D-112.
   *
   * Region names with '/' (subfolder paths) produce subfolder source paths
   * — `images/AVATAR/FACE.png` for region `AVATAR/FACE`. F8.3 directory
   * structure preservation depends on this.
   */
  sourcePaths: Map<string, string>;
  /**
   * Phase 6 Gap-Fix #2 (2026-04-25 human-verify Step 1) — Map from atlas
   * region name → atlas-page extraction metadata. Populated for EVERY
   * atlas region (regardless of whether a per-region PNG exists in the
   * sibling `images/` folder). The image-worker prefers sourcePaths if
   * the per-region PNG exists; otherwise falls back to atlasSources to
   * extract the region from its atlas page via `sharp.extract({...})`
   * before resize.
   *
   * Required for atlas-packed projects (e.g. fixtures/Jokerman/) where
   * only the atlas page PNGs (`<skeletonDir>/<page.name>`) exist on
   * disk; per-region PNGs are NOT exported by the Spine editor by
   * default. EXPORT_PROJECT-style fixtures with per-region PNGs continue
   * to use sourcePaths-first (they get atlasSources too, but it's
   * unused).
   *
   * - pagePath: absolute path to the atlas page PNG
   * - x, y: top-left of region inside the page
   * - w, h: SOURCE dims (originalWidth/originalHeight from the atlas;
   *   for rotated regions packed-bounds W/H are swapped so we use the
   *   orig dims here and consumers branch on `rotated`)
   * - rotated: true when region.degrees !== 0
   */
  atlasSources: Map<string, {
    pagePath: string;
    x: number;
    y: number;
    w: number;
    h: number;
    rotated: boolean;
  }>;
  /**
   * Editor dopesheet FPS (from `skeleton.fps` in the JSON, default 30 —
   * Spine's own editor default when the field is omitted). DISPLAY-ONLY:
   * drives the `frame` column so animators can cross-reference their
   * dopesheet. CLAUDE.md rule #1 forbids using fps for SAMPLING — sampling
   * rate stays at the configured `samplingHz`.
   */
  editorFps: number;
  /**
   * Phase 21 Plan 21-09 G-01 fix — attachments whose PNG was missing in
   * atlas-less mode. OPTIONAL: absent in canonical-atlas mode and in
   * atlas-less mode where every referenced PNG resolved successfully.
   * Optional shape follows the existing `unusedAttachments?:` precedent on
   * SkeletonSummary to avoid TS2741 cascades on every existing LoadResult
   * test/mock site (Plan 21-09 ISSUE-007).
   *
   * Each entry: `name` = region name (e.g. 'JOKER_FULL_BODY/BODY'),
   * `expectedPngPath` = absolute path the synthesizer tried to read.
   *
   * Renderer (Plan 21-10 MissingAttachmentsPanel) surfaces this list above
   * the Global Max Render Source panel when length > 0. The panel renders
   * conditionally: hidden when undefined or length === 0.
   *
   * Pairs with the synthesizer's stub-region emission: each entry here
   * corresponds to a 1x1 stub region in the parsed atlas (so the loaded
   * skeleton has the attachment present in the skin, but the renderer hides
   * it from the main panels and lists it here for explicit user visibility).
   */
  skippedAttachments?: { name: string; expectedPngPath: string }[];
}

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SampleRecord {
  /** Composite key: `${skin}/${slot}/${attachment}`. */
  attachmentKey: string;
  skinName: string;
  slotName: string;
  attachmentName: string;
  /** `"Setup Pose (Default)"` for setup-pose pass; animation name otherwise. */
  animationName: string;
  /** Seconds since animation start (Spine's authoritative unit). */
  time: number;
  /** `round(time * editorFps)` — informational only, per CONTEXT. */
  frame: number;
  /** Per-axis intrinsic render-scale (from `bone.getWorldScaleX()` or per-vertex weighted sum for meshes). */
  peakScaleX: number;
  peakScaleY: number;
  /** `max(peakScaleX, peakScaleY)` — single-number peak scale used for resize decisions. */
  peakScale: number;
  /** World-space AABB extents — informational (reflects rotation); drives the CLI "Peak W×H" column. */
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
}
