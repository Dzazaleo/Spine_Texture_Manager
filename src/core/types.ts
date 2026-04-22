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
  /** `"__SETUP__"` for setup-pose pass; animation name otherwise. */
  animationName: string;
  /** Seconds since animation start (Spine's authoritative unit). */
  time: number;
  /** `round(time * 60)` — informational only, per CONTEXT. */
  frame: number;
  scaleX: number;
  scaleY: number;
  /** `max(scaleX, scaleY)` — the single-number "peak scale" per record. */
  scale: number;
  worldW: number;
  worldH: number;
  sourceW: number;
  sourceH: number;
}
