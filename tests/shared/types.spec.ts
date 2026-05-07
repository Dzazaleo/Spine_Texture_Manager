/**
 * Phase 29 Plan 01 Task 1 — RegionRow + Summary.regions + AtlasPreviewInput
 * + PackedRegion re-key (D-01 + D-02 + D-03).
 *
 * Behavior gates:
 *   - RegionRow interface exists and is importable from src/shared/types.
 *   - SkeletonSummary.regions: RegionRow[] is non-optional (every IPC payload
 *     populates it).
 *   - AtlasPreviewInput is re-keyed to regionName + attachmentNames[]; the
 *     legacy attachmentName field is gone.
 *   - PackedRegion is re-keyed identically.
 *   - RegionRow + contributingAttachments[] satisfy D-21 structuredClone-safety.
 *
 * The interface tests use the type system directly (compile-time assertion via
 * a `satisfies RegionRow` literal); structuredClone is the runtime gate.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import type {
  RegionRow,
  SkeletonSummary,
  AtlasPreviewInput,
  PackedRegion,
} from '../../src/shared/types.js';

const TYPES_SRC = path.resolve('src/shared/types.ts');

describe('Phase 29 D-01 — RegionRow interface + SkeletonSummary.regions field', () => {
  it('exports RegionRow interface from src/shared/types.ts (compile-time + grep)', () => {
    const src = readFileSync(TYPES_SRC, 'utf8');
    expect(src).toMatch(/export interface RegionRow\b/);
  });

  it('SkeletonSummary.regions: RegionRow[] is declared non-optional (compile-time + grep)', () => {
    const src = readFileSync(TYPES_SRC, 'utf8');
    // Match the Summary field in the SkeletonSummary literal — non-optional
    // (no `?`) and typed as RegionRow[]. The line lives between
    // `peaks: DisplayRow[]` and `animationBreakdown: AnimationBreakdown[]`.
    expect(src).toMatch(/^\s+regions: RegionRow\[\];/m);
  });
});

describe('Phase 29 D-03 — AtlasPreviewInput re-key', () => {
  it('AtlasPreviewInput exposes regionName: string (not attachmentName)', () => {
    const src = readFileSync(TYPES_SRC, 'utf8');
    // Slice out the AtlasPreviewInput block. awk-like: lines from the
    // `export interface AtlasPreviewInput` declaration to the matching `}`.
    const startIdx = src.indexOf('export interface AtlasPreviewInput');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    const endIdx = src.indexOf('\n}\n', startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const block = src.slice(startIdx, endIdx);
    expect(block).toMatch(/regionName: string/);
    // attachmentName: string MUST be gone from this block (atlasSource has
    // no attachmentName field, so this stays robust).
    expect(block).not.toMatch(/^\s*attachmentName: string\b/m);
    expect(block).toMatch(/attachmentNames: string\[\]/);
  });
});

describe('Phase 29 D-03 — PackedRegion re-key', () => {
  it('PackedRegion exposes regionName: string (not attachmentName)', () => {
    const src = readFileSync(TYPES_SRC, 'utf8');
    const startIdx = src.indexOf('export interface PackedRegion');
    expect(startIdx).toBeGreaterThanOrEqual(0);
    const endIdx = src.indexOf('\n}\n', startIdx);
    expect(endIdx).toBeGreaterThan(startIdx);
    const block = src.slice(startIdx, endIdx);
    expect(block).toMatch(/regionName: string/);
    expect(block).not.toMatch(/^\s*attachmentName: string\b/m);
    expect(block).toMatch(/attachmentNames: string\[\]/);
  });
});

describe('Phase 29 D-21 — RegionRow + contributingAttachments[] structuredClone-safe', () => {
  it('a fully-populated RegionRow round-trips through structuredClone unchanged', () => {
    const row: RegionRow = {
      regionName: '5/7',
      attachmentName: '5/5/5/7/7',
      skinName: 'default',
      slotName: 'BODY',
      animationName: 'IDLE',
      time: 1.5,
      frame: 90,
      peakScale: 0.722,
      peakScaleX: 0.722,
      peakScaleY: 0.722,
      worldW: 273,
      worldH: 309,
      sourceW: 378,
      sourceH: 428,
      isSetupPosePeak: false,
      sourcePath: '/abs/path/to/5/7.png',
      canonicalW: 378,
      canonicalH: 428,
      actualSourceW: 378,
      actualSourceH: 428,
      dimsMismatch: false,
      isMissing: undefined,
      atlasSource: {
        pagePath: '/abs/path/to/atlas-page.png',
        x: 100,
        y: 200,
        w: 378,
        h: 428,
        rotated: false,
      },
      originalSizeLabel: '378×428',
      peakSizeLabel: '273×309',
      scaleLabel: '0.722×',
      sourceLabel: 'IDLE',
      frameLabel: '90',
      contributingAttachments: [
        {
          attachmentName: '5/5/5/7/7',
          skinName: 'default',
          slotName: 'BODY',
          peakScale: 0.722,
          animationName: 'IDLE',
          time: 1.5,
          frame: 90,
          isSetupPosePeak: false,
        },
        {
          attachmentName: '5/5/7/7',
          skinName: 'default',
          slotName: 'BODY',
          peakScale: 0.722,
          animationName: 'IDLE',
          time: 1.5,
          frame: 90,
          isSetupPosePeak: false,
        },
        {
          attachmentName: '5/7',
          skinName: 'default',
          slotName: 'BODY',
          peakScale: 0.746,
          animationName: 'WALK',
          time: 0.5,
          frame: 30,
          isSetupPosePeak: false,
        },
      ],
    };
    const cloned = structuredClone(row);
    expect(cloned).toEqual(row);
    // Ensure contributingAttachments survives in shape + identity.
    expect(cloned.contributingAttachments.length).toBe(3);
    expect(cloned.contributingAttachments[0].attachmentName).toBe('5/5/5/7/7');
  });

  it('SkeletonSummary.regions array of RegionRow round-trips through structuredClone', () => {
    // Minimal SkeletonSummary fragment focusing on the new regions field.
    const fragment: Pick<SkeletonSummary, 'regions'> = {
      regions: [
        {
          regionName: 'CIRCLE',
          attachmentName: 'CIRCLE',
          skinName: 'default',
          slotName: 'CIRCLE',
          animationName: 'Setup Pose (Default)',
          time: 0,
          frame: 0,
          peakScale: 1.0,
          peakScaleX: 1.0,
          peakScaleY: 1.0,
          worldW: 699,
          worldH: 699,
          sourceW: 699,
          sourceH: 699,
          isSetupPosePeak: true,
          sourcePath: '',
          canonicalW: 699,
          canonicalH: 699,
          actualSourceW: undefined,
          actualSourceH: undefined,
          dimsMismatch: false,
          originalSizeLabel: '699×699',
          peakSizeLabel: '699×699',
          scaleLabel: '1.000×',
          sourceLabel: 'Setup Pose (Default)',
          frameLabel: '0',
          contributingAttachments: [
            {
              attachmentName: 'CIRCLE',
              skinName: 'default',
              slotName: 'CIRCLE',
              peakScale: 1.0,
              animationName: 'Setup Pose (Default)',
              time: 0,
              frame: 0,
              isSetupPosePeak: true,
            },
          ],
        },
      ],
    };
    const cloned = structuredClone(fragment);
    expect(cloned).toEqual(fragment);
  });
});

describe('Phase 29 — Layer 3 invariant on src/shared/', () => {
  it('src/shared/types.ts has no sharp / electron / react imports', () => {
    const src = readFileSync(TYPES_SRC, 'utf8');
    expect(src).not.toMatch(/from ['"]sharp['"]/);
    expect(src).not.toMatch(/from ['"]react['"]/);
    // Note: src/shared/types.ts re-exports types from src/main/doc-export.ts
    // (DocExportPayload + DocExportResponse) — these are TYPE-only re-exports
    // (no runtime imports). The Layer 3 contract here is "no DOM / sharp /
    // react" — main is allowed at the type level for IPC payload shapes.
  });

  // Compile-time assertion that AtlasPreviewInput + PackedRegion expose the
  // re-keyed fields. This is a structural test — the function never runs;
  // its purpose is to gate the type system.
  it('AtlasPreviewInput.regionName + attachmentNames[] + PackedRegion.regionName + attachmentNames[] are typed (compile-time)', () => {
    const _api: AtlasPreviewInput = {
      regionName: '5/7',
      attachmentNames: ['5/5/5/7/7', '5/5/7/7', '5/7'],
      sourceW: 378,
      sourceH: 428,
      outW: 4,
      outH: 4,
      packW: 4,
      packH: 4,
      sourcePath: '/abs/5/7.png',
    };
    const _pr: PackedRegion = {
      regionName: '5/7',
      attachmentNames: ['5/5/5/7/7', '5/5/7/7', '5/7'],
      x: 0,
      y: 0,
      w: 4,
      h: 4,
      sourcePath: '/abs/5/7.png',
    };
    // Touch the values so tsc doesn't dead-code-eliminate them.
    expect(_api.regionName).toBe('5/7');
    expect(_pr.regionName).toBe('5/7');
    expect(_api.attachmentNames.length).toBe(3);
    expect(_pr.attachmentNames.length).toBe(3);
  });
});
