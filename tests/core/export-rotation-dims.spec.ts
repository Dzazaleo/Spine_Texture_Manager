// Phase 33 Plan 05 — ATLAS-03 buildExportPlan canonical-dim assertion.
//
// Fixture shape (per 33-01-SUMMARY.md, region `rect`, libgdx convention):
//   canonicalW=100, canonicalH=500 (vertical strip drawn in Spine editor),
//   page-pixel W=500, page-pixel H=100 (post-pack horizontal slice),
//   offsetX=0, offsetY=0, rotate=90.
//
// ExportPlan output dims MUST equal canonical (100×500), NOT page-pixel (500×100).
// This spec uses synthetic SkeletonSummary peaks (mirrors tests/core/export.spec.ts
// line 147-220) — no real loader I/O. The math under test is the canonical-relative
// outW/outH derivation in src/core/export.ts:325-326 which already reads canonicalW/H
// when present. The test locks the contract so a future refactor cannot silently
// regress to page-pixel dims for rotated rows.

import { describe, expect, it } from 'vitest';
import { buildExportPlan } from '../../src/core/export.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

describe('buildExportPlan — rotated region canonical out dims (ATLAS-03)', () => {
  it('rotated row with canonicalW=100, canonicalH=500, peakScale=1.0 → outW=100, outH=500 (NOT 500×100 page-pixel)', () => {
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
          worldW: 100,
          worldH: 500,
          sourceW: 100,
          sourceH: 500,
          canonicalW: 100,
          canonicalH: 500,
          sourcePath: '/fake/rect.png',
          atlasSource: {
            pagePath: '/fake/page.png',
            x: 2,
            y: 360,
            packW: 500, // page-pixel W (= libgdx bounds H for rotated)
            packH: 100, // page-pixel H (= libgdx bounds W for rotated)
            offsetX: 0,
            offsetY: 0,
            w: 100, // canonical (unrotated) W — matches real fixture
            h: 500, // canonical (unrotated) H
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
    // Canonical (unrotated) W × H — NOT 500×100 page-pixel.
    expect(row.outW, 'outW must be canonical W=100, NOT page-pixel W=500').toBe(100);
    expect(row.outH, 'outH must be canonical H=500, NOT page-pixel H=100').toBe(500);
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
          worldW: 100,
          worldH: 500,
          sourceW: 100,
          sourceH: 500,
          canonicalW: 100,
          canonicalH: 500,
          sourcePath: '/fake/rect.png',
          atlasSource: {
            pagePath: '/fake/page.png',
            x: 2, y: 360,
            packW: 500, packH: 100,
            offsetX: 0, offsetY: 0,
            w: 100, h: 500,
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
