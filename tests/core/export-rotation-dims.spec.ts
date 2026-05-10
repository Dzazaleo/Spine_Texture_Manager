// Phase 33 Plan 05 — ATLAS-03 buildExportPlan canonical-dim assertion.
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`):
//   canonicalW=500, canonicalH=100, packW=100, packH=500, offsetX=0, offsetY=0,
//   rotate=90. ExportPlan output dims MUST equal canonical (500×100), NOT the
//   packed-swapped form (100×500).
//
// This spec uses synthetic SkeletonSummary peaks (mirrors tests/core/export.spec.ts
// line 147-220) — no real loader I/O. The math under test is the canonical-relative
// outW/outH derivation in src/core/export.ts:325-326 which already reads canonicalW/H
// when present. The test locks the contract so a future refactor cannot silently
// regress to packed dims for rotated rows.

import { describe, expect, it } from 'vitest';
import { buildExportPlan } from '../../src/core/export.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

describe('buildExportPlan — rotated region canonical out dims (ATLAS-03)', () => {
  it('rotated row with canonicalW=500, canonicalH=100, peakScale=1.0 → outW=500, outH=100 (NOT 100×500 swapped)', () => {
    const summary = {
      peaks: [
        {
          attachmentKey: 'default/rect/rect',
          attachmentName: 'rect',
          skinName: 'default',
          slotName: 'rect',
          animationName: 'static',
          time: 0,
          frame: 0,
          peakScale: 1.0,
          peakScaleX: 1.0,
          peakScaleY: 1.0,
          worldW: 500,
          worldH: 100,
          sourceW: 500,
          sourceH: 100,
          canonicalW: 500,
          canonicalH: 100,
          sourcePath: '/fake/rect.png',
          atlasSource: {
            pagePath: '/fake/page.png',
            x: 2,
            y: 360,
            packW: 100, // PACKED dims (swapped per libgdx CCW90 convention)
            packH: 500,
            offsetX: 0,
            offsetY: 0,
            w: 500, // CANONICAL (unrotated) dims
            h: 100,
            rotated: true,
          },
        },
      ],
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const plan: ExportPlan = buildExportPlan(summary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBe(1);

    const row = allRows[0];
    // Canonical (unrotated) W × H — NOT 100×500 packed-swapped.
    expect(row.outW, 'outW must be canonical (unrotated) W=500, NOT packed W=100').toBe(500);
    expect(row.outH, 'outH must be canonical (unrotated) H=100, NOT packed H=500').toBe(100);
  });

  it('rotated row preserves atlasSource.rotated=true through buildExportPlan', () => {
    const summary = {
      peaks: [
        {
          attachmentKey: 'default/rect/rect',
          attachmentName: 'rect',
          skinName: 'default',
          slotName: 'rect',
          animationName: 'static',
          time: 0,
          frame: 0,
          peakScale: 1.0,
          peakScaleX: 1.0,
          peakScaleY: 1.0,
          worldW: 500,
          worldH: 100,
          sourceW: 500,
          sourceH: 100,
          canonicalW: 500,
          canonicalH: 100,
          sourcePath: '/fake/rect.png',
          atlasSource: {
            pagePath: '/fake/page.png',
            x: 2, y: 360,
            packW: 100, packH: 500,
            offsetX: 0, offsetY: 0,
            w: 500, h: 100,
            rotated: true,
          },
        },
      ],
      orphanedFiles: [],
    } as unknown as SkeletonSummary;

    const plan: ExportPlan = buildExportPlan(summary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    const row = allRows[0];
    expect(row.atlasSource).toBeDefined();
    expect(row.atlasSource!.rotated).toBe(true);
  });
});
