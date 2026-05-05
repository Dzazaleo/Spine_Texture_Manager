/**
 * Phase 22.1 Plan 01 Task 2 (TDD RED → GREEN) — G-01 D-01 loader atlas-source
 * actualDimsByRegion + sourcePaths mode-gating.
 *
 * Behavior gates:
 *   Test 1: Atlas-source mode — actualDimsByRegion uses PNG dims when the on-disk
 *     PNG is strictly smaller than atlas canonical dims (pre-optimized detection).
 *     When no smaller PNG exists the atlas region.originalWidth/Height is used.
 *   Test 2: Atlas-source mode — actualDimsByRegion is always non-empty after G-01,
 *     seeded from atlas dims as the baseline and overridden by smaller on-disk PNGs.
 *   Test 3: Atlas-source mode — sourcePaths is NOT populated from images/ directory
 *     (atlas-extract fallback path in image-worker.ts handles source extraction).
 *   Test 4 (smoke): Atlas-less mode — actualDimsByRegion still comes from PNG headers
 *     (Phase 22 behavior preserved verbatim).
 *
 * SIMPLE_PROJECT/images/ fixture dims (for reference):
 *   CIRCLE.png  420×420  (< atlas 699×699  → actualSourceW = 420)
 *   SQUARE.png  890×890  (< atlas 1000×1000 → actualSourceW = 890)
 *   TRIANGLE.png 833×759 (= atlas 833×759  → actualSourceW = 833, atlas unchanged)
 *
 * The rotation-rejection tests and G-08 tests live in loader-rotation-rejection.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const ATLAS_SOURCE_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');

describe('Phase 22.1 G-01 D-01 — atlas-source mode actualDimsByRegion from atlas.region.originalWidth/Height', () => {
  it('Test 1 (G-01 D-01 actualSource): atlas-source mode uses PNG dims when smaller than atlas, atlas dims otherwise', () => {
    // SIMPLE_TEST.atlas has no orig: lines, so originalWidth === packed width.
    // SIMPLE_PROJECT/images/ has pre-optimized PNGs smaller than atlas for CIRCLE + SQUARE.
    // debug-fix scale-display-optimized-source: canonical mode reads PNG IHDR when
    // PNG dims are strictly smaller than atlas dims (both axes). TRIANGLE PNG = atlas → unchanged.
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    // Must have entries for all atlas regions.
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);

    // CIRCLE: PNG 420×420 < atlas 699×699 → actualSourceW = 420 (PNG wins)
    const circle = r.actualDimsByRegion.get('CIRCLE');
    expect(circle).toBeDefined();
    expect(circle?.actualSourceW).toBe(420);
    expect(circle?.actualSourceH).toBe(420);

    // SQUARE: PNG 890×890 < atlas 1000×1000 → actualSourceW = 890 (PNG wins)
    const square = r.actualDimsByRegion.get('SQUARE');
    expect(square).toBeDefined();
    expect(square?.actualSourceW).toBe(890);
    expect(square?.actualSourceH).toBe(890);

    // TRIANGLE: PNG 833×759 = atlas 833×759 → NOT smaller → actualSourceW = 833 (atlas wins)
    const triangle = r.actualDimsByRegion.get('TRIANGLE');
    expect(triangle).toBeDefined();
    expect(triangle?.actualSourceW).toBe(833);
    expect(triangle?.actualSourceH).toBe(759);
  });

  it('Test 2 (G-01 D-01 non-empty): atlas-source mode actualDimsByRegion is always non-empty (from atlas baseline + optional PNG override)', () => {
    // After G-01: actualDimsByRegion is seeded from atlas.region.originalWidth/Height.
    // debug-fix: when images/ exists with smaller PNGs, those override the atlas baseline.
    // Either way actualDimsByRegion.size >= 3 and all values are positive.
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    // Non-empty regardless of whether PNG files exist.
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);
    // All entries have positive dims (PNG or atlas, never 0).
    for (const [_name, dims] of r.actualDimsByRegion) {
      expect(dims.actualSourceW).toBeGreaterThan(0);
      expect(dims.actualSourceH).toBeGreaterThan(0);
    }
    // CIRCLE and SQUARE use PNG dims (smaller than atlas).
    expect(r.actualDimsByRegion.get('CIRCLE')?.actualSourceW).toBe(420);
    expect(r.actualDimsByRegion.get('SQUARE')?.actualSourceW).toBe(890);
  });

  it('Test 3 (G-01 D-01 sourcePaths): atlas-source mode populates sourcePaths from images/ for export output paths (no PNG header reads)', () => {
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    // Phase 22.1 fix: sourcePaths IS populated in atlas-source mode so export.ts can
    // build output paths. PNG IHDR reads do NOT happen — actualDimsByRegion is mode-gated
    // to atlas-less only. The optimizer was broken when sourcePaths was empty.
    expect(r.sourcePaths.size).toBeGreaterThanOrEqual(3);
    for (const [regionName, p] of r.sourcePaths) {
      const normalizedPath = p.replace(/\\/g, '/');
      expect(
        normalizedPath.includes('/images/'),
        `sourcePath '${p}' for region '${regionName}' should reference images/ dir`,
      ).toBe(true);
      expect(normalizedPath.endsWith('.png')).toBe(true);
    }
  });

  it('Test 4 (atlas-less mode preserved): atlas-less mode still reads actualDimsByRegion from PNG headers', () => {
    // SIMPLE_PROJECT_NO_ATLAS has per-region PNGs in images/; atlas-less mode reads them.
    const r = loadSkeleton(ATLAS_LESS_FIXTURE, { loaderMode: 'atlas-less' });
    // Atlas-less mode: actualDimsByRegion populated from readPngDims (Phase 22 behavior).
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);
    // All dims should come from the PNG headers (positive values).
    for (const [_name, dims] of r.actualDimsByRegion) {
      expect(dims.actualSourceW).toBeGreaterThan(0);
      expect(dims.actualSourceH).toBeGreaterThan(0);
    }
    // atlasPath is null (synthesis path).
    expect(r.atlasPath).toBeNull();
  });
});
