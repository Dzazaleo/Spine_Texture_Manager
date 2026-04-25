/**
 * Phase 6 Plan 03 — renderer-side inline copy of the canonical
 * export-plan builder (D-108..D-111).
 *
 * Layer 3 resolution (inline duplicate — option 1 from 04-PATTERNS.md
 * §"Shared Patterns / Layer 3"; Phase 4 D-75 precedent at
 * src/renderer/src/lib/overrides-view.ts). The tests/arch.spec.ts grep
 * forbids any renderer file from taking a dependency on the pure-TS
 * math tree. Because AppShell.tsx (Plan 06-06) builds the plan from
 * local summary + overrides Map BEFORE invoking startExport, the
 * renderer gets its own byte-identical copy here instead of crossing
 * the boundary.
 *
 * Gap-Fix #1 (2026-04-25 human-verify Step 1) — DOWNSCALE-ONLY INVARIANT:
 *   effectiveScale is clamped to ≤ 1.0 after the override/peakScale resolution
 *   and BEFORE the dedup keep-max comparison. Per the user-locked Phase 6
 *   export sizing memory: source dimensions are the ceiling — even if the
 *   sampler computes a peakScale of 15× (e.g. an attachment dramatically
 *   zoomed in animation), the exported output is never larger than the
 *   source PNG. Images can only be reduced, never extrapolated.
 *
 * Parity contract: the exported function bodies in this file are
 * byte-identical to the canonical source module. If you modify one,
 * modify the other in the same commit. A parity describe block in
 * tests/core/export.spec.ts asserts sameness on representative inputs
 * plus signature greps against both file contents.
 *
 * Imports: type-only from '../../../shared/types.js' (erased at compile
 * time, allowed under the Layer 3 gate); runtime applyOverride from
 * the renderer's own overrides-view.ts copy — NEVER from
 * '../../../core/overrides.js' (would trip arch.spec.ts:25 grep).
 *
 * Callers (within the renderer tree only):
 *   - src/renderer/src/components/AppShell.tsx (Plan 06-06) — toolbar
 *     button click handler invokes buildExportPlan(summary, overrides)
 *     to produce the structured-clone-safe plan that gets passed to
 *     window.api.startExport(plan, outDir).
 */
import type {
  DisplayRow,
  ExportPlan,
  ExportRow,
  SkeletonSummary,
} from '../../../shared/types.js';
import { applyOverride } from './overrides-view.js';

export interface BuildExportPlanOptions {
  /** Default false (D-109). Future Settings toggle path. */
  includeUnused?: boolean;
}

/**
 * Build the deduped export plan from a SkeletonSummary + overrides Map.
 *
 * INVARIANT (Gap-Fix #1, user-locked Phase 6 export sizing memory):
 *   For every emitted ExportRow: `effectiveScale ≤ 1.0`. Source dimensions
 *   are the CEILING — exports may downscale (effectiveScale ∈ (0, 1]) but
 *   may NEVER upscale beyond the source PNG's pixel dimensions. A peakScale
 *   of 5× still produces outW=sourceW (clamped to 1.0). This is locked
 *   policy: anisotropic export breaks Spine UV sampling AND extrapolating
 *   pixels libvips never had degrades quality vs simply shipping the source.
 *
 * D-110 uniform sizing: outW = Math.round(sourceW × effectiveScale),
 * outH = Math.round(sourceH × effectiveScale), with the SAME effectiveScale
 * on both axes.
 *
 * D-108 dedup: one ExportRow per unique sourcePath; the kept effectiveScale
 * is max(post-clamp) across all attachments referencing that source.
 *
 * D-109 unused exclusion: summary.unusedAttachments is subtracted by default
 * (opts.includeUnused defaults to false).
 */

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
    const rawEffScale =
      overridePct !== undefined
        ? applyOverride(overridePct).effectiveScale
        : row.peakScale;
    // Gap-Fix #1 (2026-04-25): clamp to ≤ 1.0 BEFORE the dedup keep-max
    // comparison so two attachments sharing one source PNG with peaks
    // 0.8 and 5.0 both fold to 1.0 (the ceiling) rather than the dedup
    // accidentally promoting one to the source ceiling and leaving the
    // other reading the unclamped 5.0 value.
    // User-locked Phase 6 export sizing memory: source dims are the
    // ceiling, never extrapolate.
    const effScale = Math.min(rawEffScale, 1);
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
  // Gap-Fix #2: thread atlasSource through from the winning DisplayRow so
  //    the image-worker can fall back to atlas-page extraction when the
  //    per-region PNG doesn't exist on disk.
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
      ...(acc.row.atlasSource ? { atlasSource: acc.row.atlasSource } : {}),
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
