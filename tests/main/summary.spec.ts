// @vitest-environment node
/**
 * Phase 31 LOAD-05/LOAD-06/LOAD-07 — buildSummary filesystem-state probes.
 *
 * Covers the new `hasAtlasFile` and `hasImagesDir` boolean fields on
 * SkeletonSummary. The probes mirror src/core/loader.ts F1.2 sibling-atlas
 * discovery rule (`<basename>.atlas` next to the JSON) and check for an
 * `images/` sibling directory. Both are populated atomically in
 * src/main/summary.ts:buildSummary so the renderer can gate the disabled
 * state of the source-toggle menu item without a separate IPC round-trip.
 *
 * Tests use real fs (mktempdir + fs.copyFileSync) — Pattern S-07 from
 * 31-PATTERNS.md. The probe is a primary I/O contract; mocking
 * `fs.existsSync` would not exercise the real syscall surface.
 *
 * The Layer 3 invariant is preserved: probes live in src/main/summary.ts,
 * NOT src/core/. tests/arch.spec.ts blocks fs imports from src/core/.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const FIXTURE_DIR = path.resolve('fixtures/SIMPLE_PROJECT');
const FIXTURE_JSON = path.join(FIXTURE_DIR, 'SIMPLE_TEST.json');
const FIXTURE_ATLAS = path.join(FIXTURE_DIR, 'SIMPLE_TEST.atlas');
const FIXTURE_PNG = path.join(FIXTURE_DIR, 'SIMPLE_TEST.png');

const tmpDirsToCleanup: string[] = [];

afterEach(() => {
  while (tmpDirsToCleanup.length > 0) {
    const dir = tmpDirsToCleanup.pop()!;
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

/**
 * Create a scratch directory with a SkeletonJSON file copied from the
 * SIMPLE_PROJECT fixture, optionally adding a sibling `.atlas` (with PNG)
 * and/or an `images/` directory containing the per-region PNGs that
 * atlas-less mode needs to resolve. Returns the absolute path to the
 * scratch JSON.
 */
function makeScratchProject(opts: {
  withAtlas: boolean;
  withImagesDir: boolean;
}): string {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'phase31-summary-'));
  tmpDirsToCleanup.push(scratch);

  const scratchJson = path.join(scratch, 'TEST.json');
  fs.copyFileSync(FIXTURE_JSON, scratchJson);

  if (opts.withAtlas) {
    fs.copyFileSync(FIXTURE_ATLAS, path.join(scratch, 'TEST.atlas'));
    // Atlas references the PNG; copy it adjacent so the loader does not
    // throw AtlasReadError on the missing page image.
    fs.copyFileSync(FIXTURE_PNG, path.join(scratch, 'SIMPLE_TEST.png'));
  }

  if (opts.withImagesDir) {
    const imagesDir = path.join(scratch, 'images');
    fs.mkdirSync(imagesDir, { recursive: true });
    // Copy the atlas-less mode per-region PNGs (CIRCLE/SQUARE/TRIANGLE)
    // from the canonical SIMPLE_PROJECT_NO_ATLAS sibling fixture so the
    // loader can resolve atlas-less mode without MissingImagesDirError.
    const noAtlasImages = path.resolve(
      'fixtures/SIMPLE_PROJECT_NO_ATLAS/images',
    );
    if (fs.existsSync(noAtlasImages)) {
      for (const f of fs.readdirSync(noAtlasImages)) {
        fs.copyFileSync(
          path.join(noAtlasImages, f),
          path.join(imagesDir, f),
        );
      }
    }
  }

  return scratchJson;
}

function buildSummaryAt(
  jsonPath: string,
  loaderMode: 'auto' | 'atlas-less' = 'auto',
): SkeletonSummary {
  const load = loadSkeleton(jsonPath, { loaderMode });
  const sampled = sampleSkeleton(load);
  return buildSummary(load, sampled, 0);
}

describe('Phase 31 LOAD-05/06/07 — buildSummary filesystem-state probes', () => {
  it('atlas-source project with .atlas + images/: hasAtlasFile=true, hasImagesDir=true', () => {
    const jsonPath = makeScratchProject({
      withAtlas: true,
      withImagesDir: true,
    });
    const summary = buildSummaryAt(jsonPath, 'auto');
    expect(summary.hasAtlasFile).toBe(true);
    expect(summary.hasImagesDir).toBe(true);
  });

  it('atlas-source project missing images/ on disk: hasAtlasFile=true, hasImagesDir=false', () => {
    const jsonPath = makeScratchProject({
      withAtlas: true,
      withImagesDir: false,
    });
    const summary = buildSummaryAt(jsonPath, 'auto');
    expect(summary.hasAtlasFile).toBe(true);
    expect(summary.hasImagesDir).toBe(false);
  });

  it('atlas-less project (no .atlas) with images/ folder: hasAtlasFile=false, hasImagesDir=true', () => {
    const jsonPath = makeScratchProject({
      withAtlas: false,
      withImagesDir: true,
    });
    const summary = buildSummaryAt(jsonPath, 'atlas-less');
    expect(summary.hasAtlasFile).toBe(false);
    expect(summary.hasImagesDir).toBe(true);
  });

  it('IPC structuredClone safety: both fields round-trip as primitive booleans', () => {
    const jsonPath = makeScratchProject({
      withAtlas: true,
      withImagesDir: true,
    });
    const summary = buildSummaryAt(jsonPath, 'auto');

    // structuredClone is the same algorithm Electron uses to ferry the
    // SkeletonSummary across the IPC boundary. Functions / Symbols would
    // throw DataCloneError; non-primitive values would lose identity.
    const cloned = structuredClone(summary);
    expect(typeof cloned.hasAtlasFile).toBe('boolean');
    expect(typeof cloned.hasImagesDir).toBe('boolean');
    expect(cloned.hasAtlasFile).toBe(summary.hasAtlasFile);
    expect(cloned.hasImagesDir).toBe(summary.hasImagesDir);
  });
});
