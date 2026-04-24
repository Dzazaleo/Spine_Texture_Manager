/**
 * Phase 2 Plan 01 — Per-attachment fold + preformat (D-33, D-34, D-35).
 *
 * Takes the sampler's Map<string, PeakRecord> and emits DisplayRow[] — raw
 * numbers (for sort + selection in the renderer panel, and for byte-for-byte
 * CLI formatting) paired with preformatted string labels (so the renderer
 * does zero formatting; one derivation, tested once in this module).
 *
 * Pure, stateless, zero-I/O. Follows CLAUDE.md rule #5 (core/ is pure TS,
 * no DOM). Enforced by tests/core/analyzer.spec.ts N2.3 grep-hygiene and by
 * the arch.spec.ts Layer 3 defense (which scans renderer/ for core imports;
 * nothing scans core/ for DOM imports because vitest's Node environment
 * would fail on any DOM type at test time anyway).
 *
 * Dedup-by-attachment-name (Plan 02-03 gap-fix B, Rule 4 deviation):
 *   The sampler emits one PeakRecord per unique skin/slot/attachment tuple.
 *   When the same attachment NAME (the user-facing texture name, what the
 *   atlas uses) appears across multiple slots or skins, each instance gets
 *   its own sampler record — correct sampler behavior, but the panel's
 *   purpose is "right-size each TEXTURE before export", so N rows per
 *   variant is noise. This stage folds by attachmentName, keeping the
 *   record with the highest peakScale. The kept row's skinName /
 *   slotName / animationName / time / frame / attachmentKey still point
 *   at the peak-producing instance, so the Source Animation + Frame
 *   columns remain actionable. Tiebreaker on equal peakScale: keep the
 *   record that sorts first by (skinName, slotName) so output is
 *   deterministic across runs.
 *
 * Callers:
 *   - src/main/summary.ts — IPC projection (writes DisplayRow[] into
 *     SkeletonSummary.peaks, which crosses structuredClone to the renderer).
 *   - scripts/cli.ts — CLI (reads analyzer output's raw numeric fields via
 *     .toFixed(3) / .toFixed(1) to preserve its historical column format;
 *     MUST NOT consume the preformatted *Label fields because the CLI and
 *     panel formats legitimately differ per D-45/D-46).
 *
 * Sort key (D-34): (skinName, slotName, attachmentName) — applied AFTER
 * dedup so ordering is stable; the CLI now prints one row per unique
 * attachment name (was: one row per sampler key; changed per gap-fix B).
 *
 * Label spec (D-35, D-45, D-46):
 *   originalSizeLabel = `${sourceW}×${sourceH}`
 *   peakSizeLabel     = `${worldW.toFixed(0)}×${worldH.toFixed(0)}`
 *   scaleLabel        = `${peakScale.toFixed(3)}×`
 *   sourceLabel       = animationName (already the static-pose label or
 *                       animation name as emitted by the sampler)
 *   frameLabel        = String(frame)
 */
import type { SkeletonData, Slot } from '@esotericsoftware/spine-core';
import type { PeakRecord } from './sampler.js';
import type {
  DisplayRow,
  BreakdownRow,
  AnimationBreakdown,
} from '../shared/types.js';
import { boneChainPath } from './bones.js';

/**
 * Bone Path separator — U+2192 right arrow flanked by single spaces. D-67
 * copywriting contract; also the separator the renderer's mid-ellipsis
 * routine joins on.
 */
const BONE_PATH_SEPARATOR = ' → ';

function toDisplayRow(p: PeakRecord, sourcePath: string = ''): DisplayRow {
  return {
    // raw fields (sort + selection in the panel; CLI reads these directly)
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    slotName: p.slotName,
    attachmentName: p.attachmentName,
    animationName: p.animationName,
    time: p.time,
    frame: p.frame,
    peakScaleX: p.peakScaleX,
    peakScaleY: p.peakScaleY,
    peakScale: p.peakScale,
    worldW: p.worldW,
    worldH: p.worldH,
    sourceW: p.sourceW,
    sourceH: p.sourceH,
    isSetupPosePeak: p.isSetupPosePeak,
    // preformatted labels (D-35, D-45, D-46) — single point of truth
    originalSizeLabel: `${p.sourceW}×${p.sourceH}`,
    peakSizeLabel: `${p.worldW.toFixed(0)}×${p.worldH.toFixed(0)}`,
    scaleLabel: `${p.peakScale.toFixed(3)}×`,
    sourceLabel: p.animationName,
    frameLabel: String(p.frame),
    // Phase 6 Plan 02 (D-108 + RESEARCH §Pattern 2) — absolute path to source
    // PNG; empty string when analyzer is invoked without a sourcePaths map
    // (CLI path, D-102 lock).
    sourcePath,
  };
}

function byCliContract(a: DisplayRow, b: DisplayRow): number {
  if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName);
  if (a.slotName !== b.slotName) return a.slotName.localeCompare(b.slotName);
  return a.attachmentName.localeCompare(b.attachmentName);
}

/**
 * Pick the "winner" between two rows for the same attachmentName.
 * Primary: higher peakScale wins. Tiebreaker: the row that sorts first by
 * (skinName, slotName) — deterministic across runs.
 *
 * Generic over any row type that exposes the dedup-relevant fields — both
 * DisplayRow (Phase 2) and BreakdownRow (Phase 3, extends DisplayRow)
 * satisfy the bound so this helper handles both without duplication.
 */
function pickHigherPeak<T extends DisplayRow>(a: T, b: T): T {
  if (b.peakScale > a.peakScale) return b;
  if (a.peakScale > b.peakScale) return a;
  // Equal peakScale: break ties deterministically on (skinName, slotName).
  if (a.skinName !== b.skinName) return a.skinName.localeCompare(b.skinName) <= 0 ? a : b;
  return a.slotName.localeCompare(b.slotName) <= 0 ? a : b;
}

/**
 * Fold rows by attachmentName. One row per unique texture name; the kept
 * row is the one with the highest peakScale (tiebreaker: first by
 * skin/slot). See the header dedup-by-attachment-name docblock for why.
 *
 * Generic over any row type that extends DisplayRow (see pickHigherPeak).
 */
function dedupByAttachmentName<T extends DisplayRow>(rows: readonly T[]): T[] {
  const winners = new Map<string, T>();
  for (const r of rows) {
    const prev = winners.get(r.attachmentName);
    winners.set(r.attachmentName, prev === undefined ? r : pickHigherPeak<T>(prev, r));
  }
  return [...winners.values()];
}

/**
 * Fold the sampler's peaks map into a sorted DisplayRow[] with preformatted
 * labels. Dedups by attachmentName (one row per unique texture). Pure,
 * deterministic, zero-I/O.
 *
 * Phase 6 Plan 02: optional `sourcePaths` argument (Map<regionName, absPath>
 * from `LoadResult.sourcePaths`) threads the source PNG path into every
 * DisplayRow.sourcePath. When omitted, sourcePath defaults to '' on every
 * row — preserves the Phase 5 D-102 byte-for-byte CLI lock (`scripts/cli.ts`
 * does not read sourcePath).
 */
export function analyze(
  peaks: Map<string, PeakRecord>,
  sourcePaths?: ReadonlyMap<string, string>,
): DisplayRow[] {
  const allRows = [...peaks.values()].map((p) =>
    toDisplayRow(p, sourcePaths?.get(p.attachmentName) ?? ''),
  );
  return dedupByAttachmentName(allRows).sort(byCliContract);
}

/**
 * Phase 3 Plan 01 — Convert a PeakRecord to a BreakdownRow.
 *
 * Adds Bone Path fields via src/core/bones.ts (requires an owning Slot from a
 * materialized Skeleton — not recoverable from SkeletonData alone). If the
 * slot is missing (defensive fallback; should never happen in practice), the
 * Bone Path falls back to just `[slotName, attachmentName]`.
 *
 * frameLabel diverges from the Phase 2 DisplayRow: em-dash (U+2014) for
 * setup-pose rows per D-60; `String(frame)` otherwise per D-57.
 */
function toBreakdownRow(
  p: PeakRecord,
  slot: Slot | undefined,
  isSetup: boolean,
  sourcePath: string = '',
): BreakdownRow {
  const bonePath =
    slot !== undefined
      ? boneChainPath(slot, p.attachmentName)
      : [p.slotName, p.attachmentName];
  return {
    // Raw fields — copied from toDisplayRow (15 fields).
    attachmentKey: p.attachmentKey,
    skinName: p.skinName,
    slotName: p.slotName,
    attachmentName: p.attachmentName,
    animationName: p.animationName,
    time: p.time,
    frame: p.frame,
    peakScaleX: p.peakScaleX,
    peakScaleY: p.peakScaleY,
    peakScale: p.peakScale,
    worldW: p.worldW,
    worldH: p.worldH,
    sourceW: p.sourceW,
    sourceH: p.sourceH,
    isSetupPosePeak: p.isSetupPosePeak,
    // Preformatted Phase 2 labels (D-35, D-45, D-46).
    originalSizeLabel: `${p.sourceW}×${p.sourceH}`,
    peakSizeLabel: `${p.worldW.toFixed(0)}×${p.worldH.toFixed(0)}`,
    scaleLabel: `${p.peakScale.toFixed(3)}×`,
    sourceLabel: p.animationName,
    // D-57: em-dash (U+2014) for setup-pose rows, String(frame) for animation rows.
    frameLabel: isSetup ? '—' : String(p.frame),
    // Phase 6 Plan 02 — absolute source PNG path (BreakdownRow extends DisplayRow).
    sourcePath,
    // Phase 3 additions (D-67, F4.3):
    bonePath,
    bonePathLabel: bonePath.join(BONE_PATH_SEPARATOR),
  };
}

/**
 * Phase 3 Plan 01 — Build the Animation Breakdown card list (F4).
 *
 * Returns AnimationBreakdown[] with static-pose card FIRST (cardId === 'setup-pose')
 * followed by one card per animation in skeletonData.animations order (D-58).
 * Each card's rows are deduped by attachmentName (D-56) and sorted Scale DESC
 * (D-59). Empty `rows: []` is the "No assets referenced" renderer state (D-62).
 *
 * The Setup Pose card lists EVERY textured attachment in the skeleton — read
 * from `setupPosePeaks` which the sampler populates during its Pass 1
 * independently of which animations touch which attachments (D-60).
 *
 * @param perAnimation    SamplerOutput.perAnimation — per-animation filtered peaks.
 * @param setupPosePeaks  SamplerOutput.setupPosePeaks — Pass-1-only static-pose map.
 * @param skeletonData    For anim.name ordering per D-58.
 * @param skeletonSlots   Materialized Skeleton.slots (required for boneChainPath's
 *                        Bone.parent traversal; SkeletonData alone lacks it).
 */
export function analyzeBreakdown(
  perAnimation: Map<string, PeakRecord>,
  setupPosePeaks: Map<string, PeakRecord>,
  skeletonData: SkeletonData,
  skeletonSlots: readonly Slot[],
  sourcePaths?: ReadonlyMap<string, string>,
): AnimationBreakdown[] {
  const findSlot = (name: string): Slot | undefined =>
    skeletonSlots.find((s) => s.data.name === name);
  // Phase 6 Plan 02 — resolve a row's sourcePath by attachmentName lookup;
  // empty string when sourcePaths is undefined (preserves legacy callers).
  const resolveSourcePath = (rec: PeakRecord): string =>
    sourcePaths?.get(rec.attachmentName) ?? '';

  const cards: AnimationBreakdown[] = [];

  // 1. Setup Pose top card (D-60). Every textured attachment gets a row;
  //    dedupe by attachmentName per D-56; sort Scale DESC per D-59.
  const setupRows = [...setupPosePeaks.values()].map((rec) =>
    toBreakdownRow(rec, findSlot(rec.slotName), /*isSetup*/ true, resolveSourcePath(rec)),
  );
  const setupDeduped = dedupByAttachmentName<BreakdownRow>(setupRows);
  setupDeduped.sort((a, b) => b.peakScale - a.peakScale);
  cards.push({
    cardId: 'setup-pose',
    animationName: 'Setup Pose (Default)',
    isSetupPose: true,
    uniqueAssetCount: setupDeduped.length,
    rows: setupDeduped,
  });

  // 2. One card per animation in skeletonData.animations order (D-58).
  //    Group by rec.animationName rather than parsing the compound
  //    perAnimation key — Spine animation names legally contain '/' for
  //    namespacing (e.g. 'CHAR/BLINK', 'LOOK/AROUND'), so first-slash
  //    parsing misroutes every such animation's rows to an empty card.
  const rowsByAnim = new Map<string, BreakdownRow[]>();
  for (const rec of perAnimation.values()) {
    const bucket = rowsByAnim.get(rec.animationName);
    const row = toBreakdownRow(rec, findSlot(rec.slotName), /*isSetup*/ false, resolveSourcePath(rec));
    if (bucket === undefined) rowsByAnim.set(rec.animationName, [row]);
    else bucket.push(row);
  }
  for (const anim of skeletonData.animations) {
    const rowsForAnim = rowsByAnim.get(anim.name) ?? [];
    const deduped = dedupByAttachmentName<BreakdownRow>(rowsForAnim);
    deduped.sort((a, b) => b.peakScale - a.peakScale);
    cards.push({
      cardId: `anim:${anim.name}`,
      animationName: anim.name,
      isSetupPose: false,
      uniqueAssetCount: deduped.length,
      rows: deduped,
    });
  }

  return cards;
}
