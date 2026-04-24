/**
 * Phase 6 Plan 03 — Pure-TS export-plan builder (D-108..D-111).
 *
 * Folds SkeletonSummary.peaks (DisplayRow[]) + Phase 4 overrides Map +
 * Phase 5 unusedAttachments list into a deduped ExportRow[] keyed by
 * source PNG path (D-108).
 *
 * Algorithm:
 *   1. Build excluded set from summary.unusedAttachments (D-109; bypassable
 *      via opts.includeUnused for future Settings toggle).
 *   2. Walk summary.peaks: skip rows whose attachmentName is excluded.
 *      For each survivor compute effectiveScale (D-111: applyOverride or
 *      peakScale fallback); group by sourcePath; per group keep the row
 *      with the highest effectiveScale and union all attachmentNames.
 *   3. Emit ExportRow per group with outW/outH = Math.round(sourceW ×
 *      effectiveScale) (D-110 uniform — anisotropic export breaks Spine UV
 *      sampling; locked memory). outPath is RELATIVE — 'images/' +
 *      regionName + '.png' — image-worker.ts joins with outDir at write
 *      time (image-worker is allowed to import node:path).
 *   4. Sort by sourcePath (deterministic output across runs).
 *
 * Layer 3 hygiene: NO imports of node:fs, node:path, sharp, electron, or
 * @esotericsoftware/spine-core (runtime). Type-only imports from
 * '../shared/types.js' and a runtime import of './overrides.js' are the
 * only allowed dependencies. Enforced by tests/core/export.spec.ts hygiene
 * grep block + tests/arch.spec.ts Layer 3 gate (Plan 06-01).
 *
 * Callers:
 *   - src/main/ipc.ts handleStartExport receives an already-built ExportPlan
 *     from the renderer (Plan 06-05) — main does NOT call this function.
 *   - src/renderer/src/lib/export-view.ts is the byte-identical renderer
 *     copy; AppShell.tsx calls it from the toolbar click handler (Plan 06-06).
 */
import type {
  DisplayRow,
  ExportPlan,
  ExportRow,
  SkeletonSummary,
} from '../shared/types.js';
import { applyOverride } from './overrides.js';

export interface BuildExportPlanOptions {
  /** Default false (D-109). Future Settings toggle path. */
  includeUnused?: boolean;
}

/**
 * Derive the relative output path from a DisplayRow's sourcePath.
 *
 * sourcePath was constructed by `src/core/loader.ts` Plan 06-02 as
 * `path.resolve(<skeletonDir>/images/<regionName>.png)`. Splitting on
 * `/images/` (or the Windows `\images\` equivalent — handle both for
 * cross-platform safety despite Phase 6 being macOS-only at the build
 * layer) and taking the suffix yields `<regionName>.png` (with subfolders
 * preserved if regionName contained '/'). The image-worker (Plan 06-04)
 * joins this with the user's chosen outDir + 'images/' to produce the
 * absolute write path while preserving F8.3 layout.
 */
function relativeOutPath(sourcePath: string): string {
  // Normalize path separators for cross-platform safety. Pure-TS — no node:path.
  const normalized = sourcePath.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/images/');
  const regionPart = idx >= 0 ? normalized.slice(idx + '/images/'.length) : normalized.slice(normalized.lastIndexOf('/') + 1);
  return 'images/' + regionPart;
}

export function buildExportPlan(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts?: BuildExportPlanOptions,
): ExportPlan {
  const includeUnused = opts?.includeUnused ?? false;

  // 1. Excluded set (D-109).
  const excluded = new Set<string>();
  if (!includeUnused && summary.unusedAttachments) {
    for (const u of summary.unusedAttachments) excluded.add(u.attachmentName);
  }

  // 2. Group by sourcePath; per group keep highest-effective-scale row +
  //    union attachmentNames (D-108).
  interface Acc {
    row: DisplayRow;
    effScale: number;
    attachmentNames: string[];
  }
  const bySourcePath = new Map<string, Acc>();
  for (const row of summary.peaks) {
    if (excluded.has(row.attachmentName)) continue;
    if (!row.sourcePath) continue; // defensive — Plan 06-02 guarantees populated, but skip empty rather than emit a bad row.
    // D-111: override-via-applyOverride or fall back to peakScale.
    const overridePct = overrides.get(row.attachmentName);
    const effScale =
      overridePct !== undefined
        ? applyOverride(overridePct).effectiveScale
        : row.peakScale;
    const prev = bySourcePath.get(row.sourcePath);
    if (prev === undefined) {
      bySourcePath.set(row.sourcePath, {
        row,
        effScale,
        attachmentNames: [row.attachmentName],
      });
    } else {
      if (effScale > prev.effScale) {
        prev.row = row;
        prev.effScale = effScale;
      }
      if (!prev.attachmentNames.includes(row.attachmentName)) {
        prev.attachmentNames.push(row.attachmentName);
      }
    }
  }

  // 3. Emit ExportRows. D-110: same effectiveScale on both axes; Math.round
  //    = round-half-away-from-zero (JS spec).
  const rows: ExportRow[] = [];
  for (const acc of bySourcePath.values()) {
    const outW = Math.round(acc.row.sourceW * acc.effScale);
    const outH = Math.round(acc.row.sourceH * acc.effScale);
    rows.push({
      sourcePath: acc.row.sourcePath,
      outPath: relativeOutPath(acc.row.sourcePath),
      sourceW: acc.row.sourceW,
      sourceH: acc.row.sourceH,
      outW,
      outH,
      effectiveScale: acc.effScale,
      attachmentNames: acc.attachmentNames.slice(),
    });
  }

  // 4. Sort by sourcePath for deterministic output.
  rows.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  // excludedUnused: sorted, deduped (Set already dedups).
  const excludedUnused = [...excluded].sort((a, b) => a.localeCompare(b));

  return {
    rows,
    excludedUnused,
    totals: { count: rows.length },
  };
}
