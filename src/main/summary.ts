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
import type { LoadResult } from '../core/types.js';
import type { PeakRecord } from '../core/sampler.js';
import type { SkeletonSummary } from '../shared/types.js';
import { analyze } from '../core/analyzer.js';

export function buildSummary(
  load: LoadResult,
  peaks: Map<string, PeakRecord>,
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
  const peaksArray = analyze(peaks);

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
    elapsedMs,
  };
}
