/**
 * Atlas-mode output naming — `deriveProjectName` regression coverage.
 *
 * Added 2026-05-15 (debug session `atlas-repack-output-bugs` round 2). The
 * round-1 fix (commit `e82bc87`) inverted the precedence to prefer
 * `plan.rows[0].sourcePath` basename over `outDir` basename — but in
 * atlas-source mode that row's `sourcePath` is a per-region PNG (e.g.
 * `images/BEACHMAN/BODY.png`), not the skeleton JSON. The round-2 fix
 * threads the skeleton path explicitly through `ExportPlan.skeletonPath`
 * (set by `buildExportPlan` from `BuildExportPlanOptions.skeletonPath`) and
 * uses it as the primary derivation source.
 *
 * These tests lock the corrected precedence so a future refactor can't
 * silently regress to either pre-fix behavior:
 *   - PRIMARY: `plan.skeletonPath` basename (stripped of `.json`).
 *   - FALLBACK: `outDir` basename.
 *   - Windows drive-root (`C:`) guard rejects both sources defensively.
 */
import { describe, expect, it } from 'vitest';
import { deriveProjectName, pageFilename } from '../../src/main/atlas-paths.js';
import type { ExportPlan } from '../../src/shared/types.js';

function makeMinimalPlan(skeletonPath: string, rowSourcePath: string): ExportPlan {
  return {
    skeletonPath,
    rows: [
      {
        sourcePath: rowSourcePath,
        outPath: 'images/CIRCLE.png',
        sourceW: 64,
        sourceH: 64,
        outW: 64,
        outH: 64,
        effectiveScale: 1.0,
        attachmentNames: ['CIRCLE'],
      },
    ],
    excludedUnused: [],
    passthroughCopies: [],
    totals: { count: 1 },
  };
}

describe('deriveProjectName — round-2 precedence (skeletonPath PRIMARY)', () => {
  it('returns the JSON basename even when row sourcePath is a per-region PNG (atlas-source mode reproduction)', () => {
    // EXACT user-reported reproduction (debug `atlas-repack-output-bugs`
    // round 2, 2026-05-15): atlas-source mode export of
    // `JOKERMAN_SPINE_ROT.json` produced `BODY.atlas` because the round-1
    // fix read `plan.rows[0].sourcePath` basename as primary — and in
    // atlas-source mode that row is `images/BEACHMAN/BODY.png`, NOT the
    // skeleton JSON. The round-2 fix threads `skeletonPath` explicitly so
    // the per-region PNG no longer drives the project identity.
    const plan = makeMinimalPlan(
      '/abs/path/JOKERMAN_SPINE_ROT.json',
      '/abs/path/images/BEACHMAN/BODY.png',
    );
    expect(deriveProjectName(plan, '/tmp/test_repack')).toBe(
      'JOKERMAN_SPINE_ROT',
    );
  });

  it('returns the JSON basename when outDir basename would also be plausible (atlas-less single-row case)', () => {
    // Atlas-less mode: row.sourcePath happens to share the JSON basename
    // (loader populates `<skeletonDir>/images/<regionName>.png`). The
    // round-2 fix is invariant of this — skeletonPath still wins.
    const plan = makeMinimalPlan(
      '/projects/MY_SKELETON.json',
      '/projects/images/SQUARE.png',
    );
    expect(deriveProjectName(plan, '/tmp/output_dir')).toBe('MY_SKELETON');
  });

  it('strips the `.json` suffix case-insensitively', () => {
    const plan = makeMinimalPlan(
      '/path/Mixed_Case_Skeleton.JSON',
      '/path/images/x.png',
    );
    expect(deriveProjectName(plan, '/tmp/out')).toBe('Mixed_Case_Skeleton');
  });

  it('falls back to outDir basename when skeletonPath is empty (synthetic test plan)', () => {
    const plan = makeMinimalPlan('', '/path/images/x.png');
    expect(deriveProjectName(plan, '/tmp/my_export')).toBe('my_export');
  });

  it('throws when both skeletonPath and outDir are unusable', () => {
    const plan = makeMinimalPlan('', '/path/images/x.png');
    // Windows drive-root `:` guard rejects the outDir fallback too.
    expect(() => deriveProjectName(plan, 'C:')).toThrow(
      /could not derive projectName/,
    );
  });
});

describe('pageFilename — REPACK-05 convention (unchanged by round-2 fix)', () => {
  it('page 0 → {projectName}.png', () => {
    expect(pageFilename('JOKERMAN_SPINE_ROT', 0)).toBe('JOKERMAN_SPINE_ROT.png');
  });

  it('page 1 → {projectName}_2.png (spine-runtime convention is 1-based naming on page >= 1)', () => {
    expect(pageFilename('JOKERMAN_SPINE_ROT', 1)).toBe(
      'JOKERMAN_SPINE_ROT_2.png',
    );
  });

  it('page N → {projectName}_{N+1}.png', () => {
    expect(pageFilename('X', 2)).toBe('X_3.png');
    expect(pageFilename('X', 9)).toBe('X_10.png');
  });
});
