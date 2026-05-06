/**
 * Phase 22.1 G-01 D-01 + debug-fix windows-source-mode-auto-detect (2026-05-06) —
 * loader atlas-source actualDimsByRegion + sourcePaths mode-gating.
 *
 * Strict mode separation (2026-05-06): atlas-source mode is self-contained — atlas
 * region.originalWidth/Height only, no images/ folder peek. The earlier
 * "scale-display-optimized-source" fix had atlas-source override actualSource to
 * smaller on-disk PNG dims; that cross-mode bleed is removed.
 *
 * Behavior gates:
 *   Test 1: Atlas-source mode — actualDimsByRegion = atlas.region.originalWidth/Height
 *     for every region, regardless of any PNGs that happen to exist in images/.
 *   Test 2: Atlas-source mode — actualDimsByRegion is non-empty (one entry per region).
 *   Test 3: Atlas-source mode — sourcePaths IS populated from images/ directory
 *     (export.ts uses these for relative output paths; image-worker falls back to
 *     atlas-page extraction when the file is absent on disk).
 *   Test 4 (smoke): Atlas-less mode — actualDimsByRegion comes from PNG headers
 *     (Phase 22 behavior preserved verbatim).
 *
 * SIMPLE_PROJECT atlas region dims (for reference):
 *   CIRCLE   atlas 699×699   (images/CIRCLE.png is 420×420 — IGNORED in atlas-source mode)
 *   SQUARE   atlas 1000×1000 (images/SQUARE.png is 890×890 — IGNORED in atlas-source mode)
 *   TRIANGLE atlas 833×759   (images/TRIANGLE.png matches)
 *
 * The rotation-rejection tests and G-08 tests live in loader-rotation-rejection.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const ATLAS_SOURCE_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');

describe('Phase 22.1 G-01 D-01 — atlas-source mode actualDimsByRegion from atlas.region.originalWidth/Height (strict)', () => {
  it('Test 1 (strict mode separation): atlas-source mode reads atlas dims only, never peeks at images/', () => {
    // SIMPLE_TEST.atlas has no orig: lines, so originalWidth === packed width.
    // SIMPLE_PROJECT/images/ contains pre-optimized PNGs (smaller than atlas) — those
    // are deliberately ignored in atlas-source mode. To use them, the user must toggle
    // to atlas-less mode.
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);

    // CIRCLE: atlas 699×699 wins; images/CIRCLE.png (420×420) is ignored.
    const circle = r.actualDimsByRegion.get('CIRCLE');
    expect(circle).toBeDefined();
    expect(circle?.actualSourceW).toBe(699);
    expect(circle?.actualSourceH).toBe(699);

    // SQUARE: atlas 1000×1000 wins; images/SQUARE.png (890×890) is ignored.
    const square = r.actualDimsByRegion.get('SQUARE');
    expect(square).toBeDefined();
    expect(square?.actualSourceW).toBe(1000);
    expect(square?.actualSourceH).toBe(1000);

    // TRIANGLE: atlas 833×759 wins; PNG happens to match.
    const triangle = r.actualDimsByRegion.get('TRIANGLE');
    expect(triangle).toBeDefined();
    expect(triangle?.actualSourceW).toBe(833);
    expect(triangle?.actualSourceH).toBe(759);
  });

  it('Test 2 (non-empty): atlas-source mode actualDimsByRegion has one entry per atlas region', () => {
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);
    for (const [_name, dims] of r.actualDimsByRegion) {
      expect(dims.actualSourceW).toBeGreaterThan(0);
      expect(dims.actualSourceH).toBeGreaterThan(0);
    }
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
