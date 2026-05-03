/**
 * Phase 22.1 Plan 01 Task 2 (TDD RED → GREEN) — G-01 D-01 loader atlas-source
 * actualDimsByRegion + sourcePaths mode-gating.
 *
 * Behavior gates:
 *   Test 1: Atlas-source mode — actualDimsByRegion populated from
 *     atlas.region.originalWidth/Height (NOT from PNG header reads).
 *   Test 2: Atlas-source mode — readPngDims is NOT called even when images/
 *     PNGs exist on disk (indirect proof: SIMPLE_PROJECT has no images/ folder,
 *     yet actualDimsByRegion is non-empty after G-01 because values come from atlas).
 *   Test 3: Atlas-source mode — sourcePaths is NOT populated from images/ directory
 *     (atlas-extract fallback path in image-worker.ts handles source extraction).
 *   Test 4 (smoke): Atlas-less mode — actualDimsByRegion still comes from PNG headers
 *     (Phase 22 behavior preserved verbatim).
 *
 * The rotation-rejection tests and G-08 tests live in loader-rotation-rejection.spec.ts.
 */
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const ATLAS_SOURCE_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');

describe('Phase 22.1 G-01 D-01 — atlas-source mode actualDimsByRegion from atlas.region.originalWidth/Height', () => {
  it('Test 1 (G-01 D-01 actualSource): atlas-source mode populates actualDimsByRegion from atlas region originalWidth/Height', () => {
    // SIMPLE_TEST.atlas has no orig: lines, so originalWidth === packed width.
    // CIRCLE: 699×699, SQUARE: 1000×1000, TRIANGLE: 833×759
    // SIMPLE_PROJECT has no images/ folder, so PNG header reads would yield nothing;
    // after G-01 the dims come from atlas regions instead.
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    // Must have entries for all atlas regions (proves NOT from failing PNG reads).
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);
    // Each entry must match the atlas region.originalWidth/Height.
    const circle = r.actualDimsByRegion.get('CIRCLE');
    expect(circle).toBeDefined();
    expect(circle?.actualSourceW).toBe(699); // region.originalWidth = region.width (no orig: line)
    expect(circle?.actualSourceH).toBe(699);

    const square = r.actualDimsByRegion.get('SQUARE');
    expect(square).toBeDefined();
    expect(square?.actualSourceW).toBe(1000);
    expect(square?.actualSourceH).toBe(1000);

    const triangle = r.actualDimsByRegion.get('TRIANGLE');
    expect(triangle).toBeDefined();
    expect(triangle?.actualSourceW).toBe(833);
    expect(triangle?.actualSourceH).toBe(759);
  });

  it('Test 2 (G-01 D-01 no PNG read): atlas-source mode actualDimsByRegion is non-empty even when images/ folder is absent', () => {
    // SIMPLE_PROJECT has no images/ folder beside the JSON. In Phase 22 (pre-G-01),
    // the PNG-header read loop would fail for all regions → actualDimsByRegion.size === 0.
    // After G-01 (atlas-source mode reads from atlas.region.originalWidth/Height),
    // actualDimsByRegion is populated from atlas data — no PNG reads needed.
    // This is the indirect proof that readPngDims is NOT called in atlas-source mode.
    const r = loadSkeleton(ATLAS_SOURCE_FIXTURE);
    // Pre-G-01 result was: actualDimsByRegion.size === 0 (PNG files absent → all reads failed).
    // Post-G-01 result must be: actualDimsByRegion.size >= 3 (from atlas).
    expect(r.actualDimsByRegion.size).toBeGreaterThanOrEqual(3);
    // Values match atlas-declared dimensions, not PNG IHDR (which would throw anyway).
    expect(r.actualDimsByRegion.get('CIRCLE')?.actualSourceW).toBe(699);
    expect(r.actualDimsByRegion.get('SQUARE')?.actualSourceW).toBe(1000);
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
