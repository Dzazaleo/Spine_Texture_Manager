/**
 * Phase 1 Plan 02 — Pure projection from Phase 0 outputs to IPC-safe summary.
 *
 * `buildSummary` takes a `LoadResult` from `loadSkeleton()` and a peaks
 * `Map<string, PeakRecord>` from `sampleSkeleton()` (both Phase 0) and returns
 * a plain-JSON `SkeletonSummary` (D-21, D-22) ready to cross the IPC boundary
 * via Electron's Structured Clone algorithm.
 *
 * This module is:
 *   - Pure (no IO, no console, no side effects — enforced by spec).
 *   - Output-deterministic (peaks sorted by skin/slot/attachment — matches
 *     CLI output byte-for-byte per D-16; spec'd in summary.spec.ts).
 *   - structuredClone-safe (no Map, no Float32Array, no class instances —
 *     spec'd in summary.spec.ts).
 *
 * Consumed by `src/main/ipc.ts`. Not imported by the renderer — the renderer
 * sees only the `SkeletonSummary` object on the far side of IPC.
 */
import { Skeleton } from '@esotericsoftware/spine-core';
import type { LoadResult } from '../core/types.js';
import type { SamplerOutput } from '../core/sampler.js';
import type { SkeletonSummary } from '../shared/types.js';
import { analyze, analyzeBreakdown } from '../core/analyzer.js';
import { findUnusedAttachments } from '../core/usage.js';

export function buildSummary(
  load: LoadResult,
  sampled: SamplerOutput,
  elapsedMs: number,
): SkeletonSummary {
  const { skeletonData } = load;

  // Count attachments across skins + bucket by spine-core class name.
  // Walks `skin.attachments` — an array (per slot index) of `StringMap<Attachment>`
  // where `StringMap<T>` is spine-core's plain indexed-object alias
  // (`{ [key: string]: T }`, NOT a JS Map — see node_modules/@esotericsoftware/
  // spine-core/dist/Utils.d.ts:31). We use `Object.values` to enumerate the
  // attachments per slot regardless of key name.
  const byType: Record<string, number> = {};
  let attachmentCount = 0;
  for (const skin of skeletonData.skins) {
    for (const attachmentsPerSlot of skin.attachments) {
      if (attachmentsPerSlot === undefined || attachmentsPerSlot === null) continue;
      for (const attachment of Object.values(attachmentsPerSlot)) {
        attachmentCount++;
        const type = attachment.constructor.name;
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }

  // Fold + sort + preformat delegated to src/core/analyzer.ts (D-33, D-34, D-35).
  // Sort key (skinName, slotName, attachmentName) matches
  // `scripts/cli.ts` renderTable() byte-for-byte — analyzer owns the comparator.
  const peaksArray = analyze(sampled.globalPeaks);

  // Phase 3 Plan 01 — fold the per-animation + setup-pose sampler maps into
  // AnimationBreakdown[] (F4.1/F4.2/F4.3). boneChainPath walks slot.bone.parent
  // so we materialize a Skeleton here — SkeletonData alone does not carry
  // Bone.parent wiring; spine-core's Skeleton constructor resolves it. Cheap
  // (<1 ms on SIMPLE_TEST), runs once per load.
  const skeleton = new Skeleton(load.skeletonData);
  const animationBreakdown = analyzeBreakdown(
    sampled.perAnimation,
    sampled.setupPosePeaks,
    load.skeletonData,
    skeleton.slots,
  );

  // Phase 5 Plan 02 — F6.1 unused-attachment detection. Pure projection per
  // D-35 / D-101: the core module owns the algorithm; summary.ts just
  // threads the result into the IPC payload.
  const unusedAttachments = findUnusedAttachments(load, sampled);

  return {
    skeletonPath: load.skeletonPath,
    atlasPath: load.atlasPath,
    bones: {
      count: skeletonData.bones.length,
      names: skeletonData.bones.map((b) => b.name),
    },
    slots: { count: skeletonData.slots.length },
    attachments: { count: attachmentCount, byType },
    skins: {
      count: skeletonData.skins.length,
      names: skeletonData.skins.map((s) => s.name),
    },
    animations: {
      count: skeletonData.animations.length,
      names: skeletonData.animations.map((a) => a.name),
    },
    peaks: peaksArray,
    animationBreakdown,
    unusedAttachments,
    elapsedMs,
  };
}
