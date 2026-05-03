/**
 * Phase 22.1 Plan 01 Task 2 (TDD RED → GREEN) — loader G-01b D-03 rotation
 * rejection + G-08 D-09 MissingImagesDirError partition.
 *
 * Behavior gates:
 *   Test 5 (rotation rejection): atlas-source mode with a rotated region throws
 *     RotatedRegionUnsupportedError BEFORE skeleton parse completes.
 *   Test 6 (no false-positive in atlas-less): synthetic atlas never sets
 *     degrees !== 0; load succeeds with no rotation-rejection throw.
 *   Test 7 (G-08 atlas-less + no images/ → MissingImagesDirError): explicit
 *     loaderMode: 'atlas-less' + missing images/ directory surfaces the typed
 *     error (not the misleading AtlasNotFoundError).
 *   Test 8 (G-08 auto + no .atlas + no images/ → AtlasNotFoundError preserved):
 *     same tmpDir without loaderMode; legacy fall-through preserved.
 *
 * Programmatic fixture mutation pattern (per PATTERNS.md §Programmatic fixture
 * mutation): tmpDir copy of fixtures/SIMPLE_PROJECT/ with atlas text mutated
 * in beforeAll; afterAll cleans up (Vitest contract — runs even on test throw).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  RotatedRegionUnsupportedError,
  AtlasNotFoundError,
  MissingImagesDirError,
} from '../../src/core/errors.js';

const FIXTURE_SRC = path.resolve('fixtures/SIMPLE_PROJECT');
const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');

// --- Test 5+6: rotation rejection ---
let rotatedTmpDir: string;
let rotatedAtlasPath: string;
let rotatedJsonPath: string;

beforeAll(() => {
  rotatedTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-rotated-'));
  rotatedJsonPath = path.join(rotatedTmpDir, 'SIMPLE_TEST.json');
  rotatedAtlasPath = path.join(rotatedTmpDir, 'SIMPLE_TEST.atlas');
  // Copy JSON unchanged.
  fs.copyFileSync(path.join(FIXTURE_SRC, 'SIMPLE_TEST.json'), rotatedJsonPath);
  // Copy PNG (needed by TextureAtlas page resolution).
  fs.copyFileSync(path.join(FIXTURE_SRC, 'SIMPLE_TEST.png'), path.join(rotatedTmpDir, 'SIMPLE_TEST.png'));
  // Mutate atlas: inject `rotate: true` on the SQUARE region.
  // In the spine-core 4.2 atlas grammar, `rotate: true` sets degrees = 90.
  const originalAtlas = fs.readFileSync(path.join(FIXTURE_SRC, 'SIMPLE_TEST.atlas'), 'utf8');
  // Insert rotate line after the SQUARE region name line (before bounds:).
  // Original SIMPLE_TEST.atlas format:
  //   SQUARE
  //   bounds:2,462,1000,1000
  const mutatedAtlas = originalAtlas.replace(
    /^(SQUARE\n)(bounds:)/m,
    '$1rotate: true\n$2',
  );
  fs.writeFileSync(rotatedAtlasPath, mutatedAtlas, 'utf8');
});

afterAll(() => {
  if (rotatedTmpDir !== undefined) {
    fs.rmSync(rotatedTmpDir, { recursive: true, force: true });
  }
});

describe('Phase 22.1 G-01b D-03 — load-time rotation rejection', () => {
  it('Test 5 (rotation rejection): atlas-source mode with rotate:true region throws RotatedRegionUnsupportedError', () => {
    let caught: unknown;
    try {
      loadSkeleton(rotatedJsonPath, { atlasPath: rotatedAtlasPath });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(RotatedRegionUnsupportedError);
    const err = caught as RotatedRegionUnsupportedError;
    expect(err.regionName).toBe('SQUARE');
    expect(err.atlasPath.endsWith('SIMPLE_TEST.atlas')).toBe(true);
    expect(err.name).toBe('RotatedRegionUnsupportedError');
    expect(err.message).toContain('Rotated atlas regions are not supported.');
    expect(err.message).toContain('Re-export from Spine with rotation disabled.');
  });

  it('Test 6 (no false-positive in atlas-less): atlas-less mode does not throw rotation rejection', () => {
    // Synthetic atlas (synthesizeAtlasText) always emits rotated:false entries.
    // The rotation-rejection scan skips atlas-less mode.
    let caught: unknown = null;
    let result: ReturnType<typeof loadSkeleton> | undefined;
    try {
      result = loadSkeleton(ATLAS_LESS_FIXTURE, { loaderMode: 'atlas-less' });
    } catch (e) {
      caught = e;
    }
    expect(caught, 'atlas-less load should not throw rotation rejection').toBeNull();
    expect(result).toBeDefined();
    expect(result?.atlasPath).toBeNull();
  });
});

describe('Phase 22.1 G-08 D-09 — MissingImagesDirError vs AtlasNotFoundError partition', () => {
  it('Test 7 (G-08 atlas-less + no images/ → MissingImagesDirError): explicit atlas-less mode with missing images/ throws typed error', () => {
    // JSON-only tmpDir — no .atlas, no images/
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-g08-aless-'));
    const skelPath = path.join(tmpDir, 'SIMPLE_TEST.json');
    fs.copyFileSync(path.join(FIXTURE_SRC, 'SIMPLE_TEST.json'), skelPath);
    try {
      let caught: unknown;
      try {
        loadSkeleton(skelPath, { loaderMode: 'atlas-less' });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(MissingImagesDirError);
      const err = caught as MissingImagesDirError;
      expect(err.name).toBe('MissingImagesDirError');
      expect(err.searchedPath.endsWith('images')).toBe(true);
      expect(err.skeletonPath).toBe(skelPath);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('Test 8 (G-08 auto fall-through → AtlasNotFoundError preserved): no .atlas + no images/ + no loaderMode → legacy error', () => {
    // Same JSON-only tmpDir, but no loaderMode specified — auto fall-through.
    // The legacy malformed-project case: no .atlas AND no images/ → AtlasNotFoundError preserved.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-g08-auto-'));
    const skelPath = path.join(tmpDir, 'SIMPLE_TEST.json');
    fs.writeFileSync(skelPath, '{"skeleton":{"spine":"4.2.43"}}');
    try {
      let caught: unknown;
      try {
        loadSkeleton(skelPath); // no loaderMode → auto fall-through
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AtlasNotFoundError);
      const err = caught as AtlasNotFoundError;
      expect(err.name).toBe('AtlasNotFoundError');
      expect(err.searchedPath.endsWith('.atlas')).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
