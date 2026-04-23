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
import type { PeakRecord } from './sampler.js';
import type { DisplayRow } from '../shared/types.js';

function toDisplayRow(p: PeakRecord): DisplayRow {
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
 */
function pickHigherPeak(a: DisplayRow, b: DisplayRow): DisplayRow {
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
 */
function dedupByAttachmentName(rows: readonly DisplayRow[]): DisplayRow[] {
  const winners = new Map<string, DisplayRow>();
  for (const r of rows) {
    const prev = winners.get(r.attachmentName);
    winners.set(r.attachmentName, prev === undefined ? r : pickHigherPeak(prev, r));
  }
  return [...winners.values()];
}

/**
 * Fold the sampler's peaks map into a sorted DisplayRow[] with preformatted
 * labels. Dedups by attachmentName (one row per unique texture). Pure,
 * deterministic, zero-I/O.
 */
export function analyze(peaks: Map<string, PeakRecord>): DisplayRow[] {
  const allRows = [...peaks.values()].map(toDisplayRow);
  return dedupByAttachmentName(allRows).sort(byCliContract);
}
