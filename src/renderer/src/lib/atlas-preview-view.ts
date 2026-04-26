/**
 * Phase 7 Plan 02 — renderer-side inline copy of the canonical atlas-preview
 * projection builder (D-124..D-132 + D-136 + D-137).
 *
 * Layer 3 resolution (inline duplicate — option 1 from 04-PATTERNS.md
 * §"Shared Patterns / Layer 3"; Phase 4 D-75 precedent at
 * src/renderer/src/lib/overrides-view.ts; Phase 6 D-108 precedent at
 * src/renderer/src/lib/export-view.ts). The tests/arch.spec.ts grep at
 * lines 19-34 forbids any renderer file from taking a dependency on the
 * pure-TS math tree at src/core/*. Because AtlasPreviewModal.tsx (Plan 04)
 * calls buildAtlasPreview on every toggle/pager change inside the modal
 * session (D-131 snapshot-at-open), the renderer gets its own byte-identical
 * copy here instead of crossing the IPC bridge on each toggle.
 *
 * Parity contract: the exported function bodies in this file are
 * byte-identical to src/core/atlas-preview.ts. If you modify one, modify
 * the other in the same commit. A parity describe block in
 * tests/core/atlas-preview.spec.ts asserts sameness on representative
 * inputs plus signature greps against both file contents.
 *
 * Imports: type-only from `../../../shared/types.js` (erased at compile
 * time, allowed under the Layer 3 gate); runtime buildExportPlan from
 * sibling renderer copy `./export-view.js` — NEVER from any `core/`
 * relative path (would trip arch.spec.ts:19-34 grep). Runtime maxrects-packer
 * from npm (browser-safe — verified by RESEARCH tarball audit, zero Node deps).
 *
 * Callers (within the renderer tree only):
 *   - src/renderer/src/modals/AtlasPreviewModal.tsx (Plan 04) — modal calls
 *     buildAtlasPreview(summary, overrides, { mode, maxPageDim }) on
 *     mount + every toggle/pager change.
 */
import type {
  AtlasPage,
  AtlasPreviewInput,
  AtlasPreviewProjection,
  PackedRegion,
  SkeletonSummary,
} from '../../../shared/types.js';
import { buildExportPlan } from './export-view.js';   // sibling renderer copy
import { MaxRectsPacker } from 'maxrects-packer';

// ===== BYTE-IDENTICAL FUNCTION BODIES BELOW =====
// Anything below this line MUST match src/core/atlas-preview.ts exactly except
// for whitespace adjustments around the imports above. Parity grep enforces this.

/**
 * Build the per-page atlas-preview projection for the chosen mode + page-dim cap.
 *
 * @param summary  SkeletonSummary with peaks (DisplayRow[]) + unusedAttachments.
 * @param overrides Map<attachmentName, percent> — same shape AppShell owns.
 * @param opts     mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096.
 * @returns AtlasPreviewProjection — structuredClone-safe (Phase 1 D-21).
 */
export function buildAtlasPreview(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  opts: { mode: 'original' | 'optimized'; maxPageDim: 2048 | 4096 },
): AtlasPreviewProjection {
  // 1. D-109 parity (Phase 5): always exclude unusedAttachments from BOTH modes.
  const excluded = new Set<string>();
  if (summary.unusedAttachments) {
    for (const u of summary.unusedAttachments) excluded.add(u.attachmentName);
  }

  // 2. Derive AtlasPreviewInput[] per mode.
  const allInputs: AtlasPreviewInput[] = deriveInputs(summary, overrides, opts.mode, excluded);

  // 2a. D-139 follow-up: filter inputs whose packed dims exceed maxPageDim on
  // either axis. The packer would otherwise expand the bin past the cap to fit
  // them — masking a real export failure and producing a misleading preview.
  // Collected attachmentNames bubble up to the renderer as a warning banner.
  const oversize: string[] = [];
  const inputs: AtlasPreviewInput[] = [];
  for (const inp of allInputs) {
    if (inp.packW > opts.maxPageDim || inp.packH > opts.maxPageDim) {
      oversize.push(inp.attachmentName);
    } else {
      inputs.push(inp);
    }
  }
  oversize.sort();

  // 3. Determinism: sort by sourcePath then attachmentName so two runs over the
  //    same summary produce byte-identical packer output (matches src/core/export.ts:223).
  inputs.sort((a, b) => {
    const cmp = a.sourcePath.localeCompare(b.sourcePath);
    return cmp !== 0 ? cmp : a.attachmentName.localeCompare(b.attachmentName);
  });

  // 4. D-132 hardcoded packer params + RESEARCH Recommendation A (pot:false, square:false).
  const packer = new MaxRectsPacker(opts.maxPageDim, opts.maxPageDim, 2, {
    smart: true,
    allowRotation: false,
    pot: false,        // tight-fit bin sizing (RESEARCH Pitfall 7)
    square: false,     // tight-fit bin sizing (RESEARCH Pitfall 7)
    border: 0,
  });
  for (const inp of inputs) {
    packer.add(inp.packW, inp.packH, inp);
  }

  // 5. Fold packer.bins[] → AtlasPage[] with per-page efficiency.
  const pages: AtlasPage[] = packer.bins.map((bin, pageIndex) => {
    const regions: PackedRegion[] = bin.rects.map((r) => {
      const inp = (r as unknown as { data: AtlasPreviewInput }).data;
      return {
        attachmentName: inp.attachmentName,
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
        sourcePath: inp.sourcePath,
        ...(inp.atlasSource ? { atlasSource: inp.atlasSource } : {}),
      };
    });
    const usedPixels = regions.reduce((sum, reg) => sum + reg.w * reg.h, 0);
    const totalPixels = bin.width * bin.height;
    const efficiency = totalPixels > 0 ? (usedPixels / totalPixels) * 100 : 0;
    return {
      pageIndex,
      width: bin.width,
      height: bin.height,
      regions,
      usedPixels,
      totalPixels,
      efficiency,
    };
  });

  // 6. D-136: degenerate empty input → emit at least one page.
  if (pages.length === 0) {
    pages.push({
      pageIndex: 0,
      width: 0,
      height: 0,
      regions: [],
      usedPixels: 0,
      totalPixels: 0,
      efficiency: 0,
    });
  }

  return {
    mode: opts.mode,
    maxPageDim: opts.maxPageDim,
    pages,
    totalPages: pages.length,
    oversize,
  };
}

/**
 * Derive the per-mode input list. Excludes unused attachments (D-109 parity).
 * For 'optimized', delegates to buildExportPlan so atlas-preview's outW/outH
 * are byte-identical with Phase 6's export pipeline (D-125).
 * For 'original', reads sourceW/H from DisplayRow OR atlasSource.w/h for
 * atlas-packed regions (D-124 + D-126).
 */
function deriveInputs(
  summary: SkeletonSummary,
  overrides: ReadonlyMap<string, number>,
  mode: 'original' | 'optimized',
  excluded: Set<string>,
): AtlasPreviewInput[] {
  if (mode === 'optimized') {
    // D-125: outW/outH come from buildExportPlan — single source of truth with Phase 6.
    // buildExportPlan ALREADY excludes summary.unusedAttachments per D-109, but we
    // re-apply the filter here for symmetry with the 'original' branch.
    //
    // ExportRow is deduped per sourcePath (D-108) and carries attachmentNames[] —
    // we need to emit one AtlasPreviewInput per attachment so the user can hit-test
    // every region in the modal canvas. Walk every attachmentName in the row and
    // resolve dims from the matching DisplayRow (peak record) so the input shape
    // carries both source AND output dims regardless of mode.
    const plan = buildExportPlan(summary, overrides);
    const out: AtlasPreviewInput[] = [];
    for (const row of plan.rows) {
      for (const attachmentName of row.attachmentNames) {
        if (excluded.has(attachmentName)) continue;
        const peak = summary.peaks.find((p) => p.attachmentName === attachmentName);
        if (!peak) continue;  // defensive — buildExportPlan rows mirror peaks
        out.push({
          attachmentName,
          sourceW: peak.sourceW,
          sourceH: peak.sourceH,
          outW: row.outW,
          outH: row.outH,
          packW: row.outW,
          packH: row.outH,
          sourcePath: row.sourcePath,
          ...(row.atlasSource ? { atlasSource: row.atlasSource } : {}),
        });
      }
    }
    return out;
  }

  // mode === 'original': read sourceW/H from DisplayRow.peaks (D-124),
  //   OR atlasSource.w/atlasSource.h for atlas-packed (D-126).
  const out: AtlasPreviewInput[] = [];
  for (const peak of summary.peaks) {
    if (excluded.has(peak.attachmentName)) continue;
    const packW = peak.atlasSource ? peak.atlasSource.w : peak.sourceW;
    const packH = peak.atlasSource ? peak.atlasSource.h : peak.sourceH;
    out.push({
      attachmentName: peak.attachmentName,
      sourceW: peak.sourceW,
      sourceH: peak.sourceH,
      outW: packW,        // 'original' mode: output dims === source dims
      outH: packH,
      packW,
      packH,
      sourcePath: peak.sourcePath,
      ...(peak.atlasSource ? { atlasSource: peak.atlasSource } : {}),
    });
  }
  return out;
}
