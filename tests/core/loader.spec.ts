/**
 * Phase 0 Plan 05 — Tests for `src/core/loader.ts`.
 *
 * Behavior gates pulled from the plan's `<behavior>` block:
 *   - F1.1 + F1.2: Loading the fixture returns a LoadResult with sourceDims keys
 *     {CIRCLE, SQUARE, TRIANGLE} and the sibling .atlas auto-detected.
 *   - F2.7 (priority 1, atlas-bounds provenance): sourceDims.get('CIRCLE') ==
 *     {w:699, h:699, source:'atlas-bounds'} — fixture has no `orig:` line,
 *     so all three regions report `atlas-bounds`.
 *   - F1.4 (typed errors):
 *       * Non-existent JSON path → SkeletonJsonNotFoundError.
 *       * JSON whose sibling .atlas is absent → AtlasNotFoundError;
 *         error.searchedPath ends with '.atlas'.
 *
 * The loader tests do not duplicate smoke coverage from bounds.spec.ts or
 * sampler.spec.ts — they lock the specific contract surface (sourceDims shape,
 * typed error hierarchy, atlas auto-detect) into CI independently of downstream
 * modules.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  AtlasNotFoundError,
  SkeletonJsonNotFoundError,
} from '../../src/core/errors.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

describe('loader (F1.1, F1.2, F1.4)', () => {
  it('F1.1+F1.2: loads the fixture and auto-detects sibling .atlas', () => {
    const r = loadSkeleton(FIXTURE);
    expect(r.skeletonData).toBeDefined();
    expect(r.atlas).toBeDefined();
    expect(r.atlasPath.endsWith('SIMPLE_TEST.atlas')).toBe(true);
    expect(path.resolve(r.skeletonPath)).toBe(FIXTURE);
  });

  it('F2.7 priority 1: sourceDims populated from .atlas bounds for all 3 regions', () => {
    const r = loadSkeleton(FIXTURE);
    expect(r.sourceDims.size).toBe(3);
    expect([...r.sourceDims.keys()].sort()).toEqual([
      'CIRCLE',
      'SQUARE',
      'TRIANGLE',
    ]);

    // Fixture has `bounds:x,y,w,h` only (no `orig:`), so source='atlas-bounds'.
    const circle = r.sourceDims.get('CIRCLE');
    expect(circle?.w).toBe(699);
    expect(circle?.h).toBe(699);
    expect(circle?.source).toBe('atlas-bounds');

    const square = r.sourceDims.get('SQUARE');
    expect(square?.w).toBe(1000);
    expect(square?.h).toBe(1000);
    expect(square?.source).toBe('atlas-bounds');

    const triangle = r.sourceDims.get('TRIANGLE');
    expect(triangle?.w).toBe(833);
    expect(triangle?.h).toBe(759);
    expect(triangle?.source).toBe('atlas-bounds');
  });

  it('F1.4: throws SkeletonJsonNotFoundError for a missing JSON file', () => {
    const missing = path.join(os.tmpdir(), 'stm-does-not-exist-XYZ.json');
    expect(() => loadSkeleton(missing)).toThrow(SkeletonJsonNotFoundError);
  });

  it('F1.4: throws AtlasNotFoundError when sibling .atlas is absent; searchedPath ends with .atlas', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-'));
    const jsonPath = path.join(tmpDir, 'rig.json');
    // Minimal JSON: loader reads file text BEFORE it tries to parse the skeleton.
    // Atlas resolution happens BEFORE skeleton parsing, so an invalid skeleton
    // here doesn't prevent the AtlasNotFoundError branch from firing.
    fs.writeFileSync(jsonPath, '{}');
    try {
      let caught: unknown;
      try {
        loadSkeleton(jsonPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AtlasNotFoundError);
      const err = caught as AtlasNotFoundError;
      expect(err.searchedPath.endsWith('.atlas')).toBe(true);
      // Expected atlas path is derived from the skeleton's basename minus extension.
      expect(path.basename(err.searchedPath)).toBe('rig.atlas');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('F1.4: AtlasNotFoundError carries the skeletonPath context', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-ctx-'));
    const jsonPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(jsonPath, '{}');
    try {
      let caught: unknown;
      try {
        loadSkeleton(jsonPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AtlasNotFoundError);
      const err = caught as AtlasNotFoundError;
      expect(err.skeletonPath).toBe(jsonPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('loader: sourcePaths map (Phase 6 Plan 02, F8.3, D-108)', () => {
  it('SIMPLE_TEST → sourcePaths includes all atlas regions mapped to <skeletonDir>/images/<regionName>.png', () => {
    const r = loadSkeleton(FIXTURE);
    // SIMPLE_TEST atlas declares 3 regions (CIRCLE, SQUARE, TRIANGLE).
    expect(r.sourcePaths.size).toBeGreaterThanOrEqual(3);
    expect(r.sourcePaths.has('CIRCLE')).toBe(true);
    expect(r.sourcePaths.has('SQUARE')).toBe(true);
    expect(r.sourcePaths.has('TRIANGLE')).toBe(true);
    const circlePath = r.sourcePaths.get('CIRCLE')!;
    // Path-only: SIMPLE_PROJECT has no images/ folder; we still build the
    // expected target without fs.access. Accept either POSIX or Windows
    // separator forms.
    const matchesPosix = circlePath.endsWith('/images/CIRCLE.png');
    const matchesWindows = circlePath.endsWith('\\images\\CIRCLE.png');
    expect(matchesPosix || matchesWindows).toBe(true);
    expect(path.isAbsolute(circlePath)).toBe(true);
  });

  it('EXPORT_PROJECT → sourcePaths point to FILES THAT EXIST (Plan 06-01 fixture)', () => {
    const r = loadSkeleton(path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json'));
    // EXPORT.atlas declares 4 regions (CIRCLE, SQUARE, SQUARE2, TRIANGLE),
    // each backed by a real source PNG under fixtures/EXPORT_PROJECT/images/.
    expect(r.sourcePaths.size).toBe(4);
    for (const [name, p] of r.sourcePaths) {
      expect(fs.existsSync(p), `expected ${p} to exist for region ${name}`).toBe(true);
    }
  });
});
