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
}

export interface SourceDims {
  w: number;
  h: number;
  /** Provenance: 'atlas-orig' when the region supplies an `orig` size; 'atlas-bounds' when we fell back to packed `bounds` W×H. */
  source: 'atlas-orig' | 'atlas-bounds';
}

export interface LoadResult {
  /** Absolute path of the loaded skeleton JSON. */
  skeletonPath: string;
  /** Absolute path of the loaded atlas. */
  atlasPath: string;
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
   * Editor dopesheet FPS (from `skeleton.fps` in the JSON, default 30 —
   * Spine's own editor default when the field is omitted). DISPLAY-ONLY:
   * drives the `frame` column so animators can cross-reference their
   * dopesheet. CLAUDE.md rule #1 forbids using fps for SAMPLING — sampling
   * rate stays at the configured `samplingHz`.
   */
  editorFps: number;
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
