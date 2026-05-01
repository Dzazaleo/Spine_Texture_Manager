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
    // Phase 21 D-03: LoadResult.atlasPath is `string | null`; canonical-mode
    // load on this fixture must produce a non-null path (sibling .atlas exists).
    expect(r.atlasPath).not.toBeNull();
    expect(r.atlasPath!.endsWith('SIMPLE_TEST.atlas')).toBe(true);
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
    // Loader order-of-operations: readFileSync → version-guard → atlas
    // resolution → skeleton parse. The skeleton.spine field MUST be
    // present and >= 4.2 (Phase 12 Plan 05 / D-21) for the test to reach
    // the AtlasNotFoundError branch — otherwise the version-guard fires
    // first with SpineVersionUnsupportedError. The rest of the JSON
    // body can stay minimal because spine-core's SkeletonJson runs
    // AFTER atlas parsing (which fails first here).
    fs.writeFileSync(jsonPath, '{"skeleton":{"spine":"4.2.43"}}');
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
    // Phase 12 Plan 05 / D-21 — skeleton.spine must be >= 4.2 to reach
    // the atlas-resolution branch (version guard fires first).
    fs.writeFileSync(jsonPath, '{"skeleton":{"spine":"4.2.43"}}');
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

  it('Gap-Fix Round 2 Bug #5: AtlasNotFoundError message explains WHY the atlas is required (re-export hint)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-msg-'));
    const jsonPath = path.join(tmpDir, 'rig.json');
    // Phase 12 Plan 05 / D-21 — skeleton.spine must be >= 4.2 to reach
    // the atlas-resolution branch (version guard fires first).
    fs.writeFileSync(jsonPath, '{"skeleton":{"spine":"4.2.43"}}');
    try {
      let caught: unknown;
      try {
        loadSkeleton(jsonPath);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AtlasNotFoundError);
      const err = caught as AtlasNotFoundError;
      // Locks the new explanatory text. We DO NOT assert byte-for-byte
      // (a future copywriting tweak shouldn't fail this test) — we lock
      // the substantive cues a user needs to act on.
      expect(err.message).toMatch(/Spine projects require an \.atlas file/);
      expect(err.message).toMatch(/Re-export from the Spine editor/);
      // Path context still present (unchanged by the message expansion).
      expect(err.message).toContain(jsonPath);
      expect(err.message).toContain('.atlas');
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

describe('loader: atlasSources map (Phase 6 Gap-Fix #2 — atlas-packed projects)', () => {
  it('SIMPLE_TEST → atlasSources populated for all 3 regions with pagePath/x/y/w/h/rotated', () => {
    const r = loadSkeleton(FIXTURE);
    expect(r.atlasSources.size).toBe(3);
    expect(r.atlasSources.has('CIRCLE')).toBe(true);
    expect(r.atlasSources.has('SQUARE')).toBe(true);
    expect(r.atlasSources.has('TRIANGLE')).toBe(true);

    const circle = r.atlasSources.get('CIRCLE')!;
    // pagePath is absolute and resolves next to the .atlas file (NOT
    // under images/ — atlas pages sit beside the .atlas).
    expect(path.isAbsolute(circle.pagePath)).toBe(true);
    expect(circle.pagePath.endsWith('.png')).toBe(true);
    // x/y/w/h are numeric.
    expect(typeof circle.x).toBe('number');
    expect(typeof circle.y).toBe('number');
    expect(circle.w).toBeGreaterThan(0);
    expect(circle.h).toBeGreaterThan(0);
    // SIMPLE_TEST has no rotated regions.
    expect(circle.rotated).toBe(false);
  });

  it('Jokerman atlas-packed fixture → atlasSources resolves L_EYE to JOKERMAN_SPINE.png at 1032,3235 (171×171, not rotated)', () => {
    const jokermanJson = path.resolve('fixtures/Jokerman/JOKERMAN_SPINE.json');
    if (!fs.existsSync(jokermanJson)) {
      // Skip if the optional Jokerman fixture is not present in this checkout.
      return;
    }
    const r = loadSkeleton(jokermanJson);
    expect(r.atlasSources.has('AVATAR/L_EYE')).toBe(true);
    const lEye = r.atlasSources.get('AVATAR/L_EYE')!;
    // From JOKERMAN_SPINE.atlas: bounds:1032,3235,171,171 on JOKERMAN_SPINE.png
    expect(lEye.pagePath.endsWith('JOKERMAN_SPINE.png')).toBe(true);
    expect(lEye.x).toBe(1032);
    expect(lEye.y).toBe(3235);
    expect(lEye.w).toBe(171);
    expect(lEye.h).toBe(171);
    expect(lEye.rotated).toBe(false);
    // BODY is on JOKERMAN_SPINE_2.png at 2,2,3719×1903.
    const body = r.atlasSources.get('AVATAR/BODY')!;
    expect(body).toBeDefined();
    expect(body.pagePath.endsWith('JOKERMAN_SPINE_2.png')).toBe(true);
    expect(body.x).toBe(2);
    expect(body.y).toBe(2);
    expect(body.rotated).toBe(false);
  });

  it('atlasSources rotated flag — SIMPLE_TEST + EXPORT_PROJECT + Jokerman all have ZERO rotated regions (first-pass scope)', () => {
    // Locks the no-rotation precondition for the Gap-Fix #2 first-pass.
    // If a future fixture introduces a rotated region, this test FAILS to
    // force the contributor to add explicit handling.
    const fixtures = [
      FIXTURE,
      path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json'),
    ];
    const jokerman = path.resolve('fixtures/Jokerman/JOKERMAN_SPINE.json');
    if (fs.existsSync(jokerman)) fixtures.push(jokerman);
    for (const f of fixtures) {
      const r = loadSkeleton(f);
      for (const [name, src] of r.atlasSources) {
        expect(src.rotated, `${path.basename(f)} region ${name} is rotated — first-pass Gap-Fix #2 does not support this`).toBe(false);
      }
    }
  });
});

describe('Phase 21 — atlas-less mode (LOAD-01 + ROADMAP success criterion #5)', () => {
  // Tests cover D-05 / D-06 / D-07 / D-08 — the 4-way branch order in
  // src/core/loader.ts (per RESEARCH.md §Pitfall 9). Branch order is
  // load-bearing: re-ordering causes either AtlasNotFoundError to fire
  // wrongly OR atlas-less synthesis to silently skip when not requested.
  //
  // Branch order (mandated):
  //   1. opts.atlasPath !== undefined → canonical (D-06: throw verbatim
  //      AtlasNotFoundError on read fail; NO fall-through)
  //   2. opts.loaderMode === 'atlas-less' → synthesize (D-08: skip .atlas
  //      read entirely, even if file exists)
  //   3. sibling .atlas readable → canonical (D-07: atlas-by-default)
  //   4. sibling .atlas unreadable → synthesize (D-05: fall-through)

  it('D-06: explicit opts.atlasPath that is unreadable STILL throws AtlasNotFoundError (verbatim message preserved)', () => {
    // ROADMAP success criterion #5: AtlasNotFoundError preserved verbatim for
    // actually-missing-atlas / malformed-project cases. When the user
    // explicitly hands the loader an atlasPath, the loader honors that intent
    // and refuses to fall through to synthesis — even if a sibling .atlas
    // exists or per-region PNGs are present.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-d06-'));
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(skelPath, '{"skeleton":{"spine":"4.2.43"}}');
    const explicitAtlas = path.join(tmpDir, 'nonexistent.atlas');
    try {
      let caught: unknown;
      try {
        loadSkeleton(skelPath, { atlasPath: explicitAtlas });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AtlasNotFoundError);
      const err = caught as AtlasNotFoundError;
      // Verbatim message check — locked from src/core/errors.ts:44-47.
      expect(err.message).toContain(
        'Spine projects require an .atlas file beside the .json',
      );
      expect(err.message).toContain(
        'Re-export from the Spine editor with the atlas included',
      );
      // Typed fields preserved.
      expect(err.searchedPath).toBe(explicitAtlas);
      expect(err.skeletonPath).toBe(skelPath);
      expect(err.name).toBe('AtlasNotFoundError');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('D-05: sibling .atlas absent + valid images/ folder → atlas-less fall-through; LoadResult.atlasPath === null', () => {
    const fixturePath = path.resolve(
      'fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json',
    );
    const result = loadSkeleton(fixturePath);
    expect(result.atlasPath).toBeNull();
    // Atlas synthesized in-memory; spine-core consumed it cleanly.
    expect(result.atlas).toBeDefined();
    expect(result.atlas.regions.length).toBeGreaterThanOrEqual(3);
    // sourceDims populated with 'png-header' provenance.
    let pngHeaderCount = 0;
    for (const dims of result.sourceDims.values()) {
      if (dims.source === 'png-header') pngHeaderCount++;
    }
    expect(pngHeaderCount).toBeGreaterThanOrEqual(3);
  });

  it('D-07: sibling .atlas readable, no loaderMode override → canonical path (atlas-by-default; sourceDims provenance is atlas-*)', () => {
    const fixturePath = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
    const result = loadSkeleton(fixturePath);
    expect(result.atlasPath).not.toBeNull();
    expect(result.atlasPath!.endsWith('.atlas')).toBe(true);
    // sourceDims provenance is 'atlas-orig' or 'atlas-bounds' — NOT 'png-header'.
    for (const dims of result.sourceDims.values()) {
      expect(dims.source).toMatch(/^atlas-(orig|bounds)$/);
    }
  });

  it('D-08: loaderMode: "atlas-less" override skips sibling .atlas read even when file exists; LoadResult.atlasPath === null', () => {
    // Construct a tmpdir with BOTH a JSON + a sibling .atlas + an images/
    // folder of per-region PNGs. Without the override, D-07 would route
    // through canonical path. With loaderMode: 'atlas-less', the loader
    // skips the .atlas read entirely (D-08 override) and synthesizes.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loader-d08-'));
    const sourceFixture = path.resolve(
      'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json',
    );
    const sourceAtlas = path.resolve(
      'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas',
    );
    const sourceImages = path.resolve(
      'fixtures/SIMPLE_PROJECT_NO_ATLAS/images',
    );
    const skelPath = path.join(tmpDir, 'SIMPLE_TEST.json');
    const atlasPath = path.join(tmpDir, 'SIMPLE_TEST.atlas');
    const imagesDir = path.join(tmpDir, 'images');
    // Copy JSON.
    fs.copyFileSync(sourceFixture, skelPath);
    // Copy a real .atlas file (any valid one works — its presence is the test).
    fs.copyFileSync(sourceAtlas, atlasPath);
    // Copy the per-region images.
    fs.mkdirSync(imagesDir, { recursive: true });
    for (const png of fs.readdirSync(sourceImages)) {
      fs.copyFileSync(
        path.join(sourceImages, png),
        path.join(imagesDir, png),
      );
    }
    try {
      const result = loadSkeleton(skelPath, { loaderMode: 'atlas-less' });
      expect(result.atlasPath).toBeNull(); //                              synthesis happened, NOT atlas read
      // Provenance proves synthesis path was taken.
      let pngHeaderCount = 0;
      for (const dims of result.sourceDims.values()) {
        if (dims.source === 'png-header') pngHeaderCount++;
      }
      expect(pngHeaderCount).toBeGreaterThanOrEqual(3);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
