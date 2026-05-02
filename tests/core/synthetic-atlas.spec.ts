/**
 * Phase 21 Plan 04 — Tests for `src/core/synthetic-atlas.ts`.
 *
 * Behavior gates pulled from RESEARCH.md INV-3..INV-6 + Pitfall 2:
 *   - synthesizeAtlasText produces atlas text consumed by spine-core
 *   - Each JSON region/mesh/linkedmesh attachment becomes a synthesized region
 *   - Region keys come from att.path ?? entryName (Pitfall 2)
 *   - Per-region missing PNG → 1x1 stub region emission (D-09 + Plan 21-09 G-01 fix)
 *   - No images/ dir → MissingImagesDirError (D-10 first variant; preserved)
 *   - Empty images/ dir + JSON has regions → all-stubs (D-10 second variant
 *     refined in Plan 21-09 ISSUE-006)
 *   - SilentSkipAttachmentLoader returns null instead of throwing on missing
 *     region (Pitfall 1)
 *
 * Note on the SIMPLE_PROJECT_NO_ATLAS fixture: the JSON references THREE
 * unique region paths (CIRCLE, SQUARE, TRIANGLE) — the SQUARE2 slot's
 * attachment entry has no `path` field and its entry name is `"SQUARE"`,
 * so it lookup-keys to the SQUARE region. The images/ folder also contains
 * a SQUARE2.png orphan that the JSON walker does NOT request. The canonical
 * SIMPLE_TEST.atlas confirms this — three regions: CIRCLE, SQUARE, TRIANGLE
 * (see tests/core/loader.spec.ts F2.7 priority-1 assertion).
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TextureAtlas, Skin } from '@esotericsoftware/spine-core';
import {
  synthesizeAtlasText,
  SilentSkipAttachmentLoader,
} from '../../src/core/synthetic-atlas.js';
import { MissingImagesDirError } from '../../src/core/errors.js';

const FIXTURE_JSON = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');
const FIXTURE_IMAGES_DIR = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images');
// Three unique region paths the JSON walker will produce — see the docblock above.
const FIXTURE_REGION_NAMES = ['CIRCLE', 'SQUARE', 'TRIANGLE'] as const;

describe('synthesizeAtlasText (LOAD-03 happy path; INV-3, INV-4)', () => {
  it('produces atlas text accepted by spine-core TextureAtlas + 3 regions resolvable by name', () => {
    const parsedJson = JSON.parse(fs.readFileSync(FIXTURE_JSON, 'utf8'));
    const synth = synthesizeAtlasText(parsedJson, FIXTURE_IMAGES_DIR, FIXTURE_JSON);
    const atlas = new TextureAtlas(synth.atlasText);
    // One page per region (D-12 / Pitfall 4 — full-path page name).
    expect(atlas.pages.length).toBe(FIXTURE_REGION_NAMES.length);
    for (const name of FIXTURE_REGION_NAMES) {
      const region = atlas.findRegion(name);
      expect(region, `region ${name} should resolve`).not.toBeNull();
      if (region !== null) {
        expect(region.x).toBe(0);
        expect(region.y).toBe(0);
        expect(region.degrees).toBe(0);
        expect(region.width).toBeGreaterThan(0);
        expect(region.height).toBeGreaterThan(0);
        // INV-4: x/y at origin; w/h match the PNG IHDR; originalW/H auto-
        // backfilled by spine-core's TextureAtlas parser at lines 152-155.
        expect(region.originalWidth).toBe(region.width);
        expect(region.originalHeight).toBe(region.height);
      }
    }
    // Plan 21-09 G-01 — happy path: missingPngs is an empty array (the
    // field exists for downstream surfacing even when nothing's missing).
    expect(synth.missingPngs).toEqual([]);
  });

  it('returns SynthResult maps keyed on region name with PNG paths + dims', () => {
    const parsedJson = JSON.parse(fs.readFileSync(FIXTURE_JSON, 'utf8'));
    const synth = synthesizeAtlasText(parsedJson, FIXTURE_IMAGES_DIR, FIXTURE_JSON);
    expect(synth.pngPathsByRegionName.size).toBe(FIXTURE_REGION_NAMES.length);
    expect(synth.dimsByRegionName.size).toBe(FIXTURE_REGION_NAMES.length);
    for (const name of FIXTURE_REGION_NAMES) {
      const pngPath = synth.pngPathsByRegionName.get(name);
      expect(pngPath, `pngPathsByRegionName should have ${name}`).toBeDefined();
      // Absolute path ending in <name>.png on the fixture images dir.
      expect(pngPath!.endsWith(name + '.png')).toBe(true);
      const dims = synth.dimsByRegionName.get(name);
      expect(dims, `dimsByRegionName should have ${name}`).toBeDefined();
      expect(dims!.w).toBeGreaterThan(0);
      expect(dims!.h).toBeGreaterThan(0);
    }
    // Plan 21-09 G-01 — happy path: missingPngs is an empty array.
    expect(synth.missingPngs).toEqual([]);
  });
});

describe('synthesizeAtlasText silent-skip per-region missing PNG (INV-5; D-09; G-01 stub-region fix)', () => {
  it('emits a 1x1 stub region for missing PNG so spine-core can resolve the attachment; remaining regions still resolve with real dims', () => {
    // Construct a tmpdir with JSON referencing 3 region names but only 2 PNGs
    // present. The walker produces 3 paths; readPngDims on the missing one
    // fails; under the G-01 stub-region fix the missing region is emitted as
    // a 1x1 stub so spine-core's animation/skin parser can resolve it without
    // null-deref crashes (exact crash site varies — see plan ISSUE-004 note).
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-stubregion-'));
    fs.mkdirSync(path.join(tmpDir, 'images'), { recursive: true });
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png'),
      path.join(tmpDir, 'images', 'CIRCLE.png'),
    );
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/SQUARE.png'),
      path.join(tmpDir, 'images', 'SQUARE.png'),
    );
    // No TRIANGLE.png — should be stubbed (1x1).
    const fakeJson = {
      skeleton: { spine: '4.2.0' },
      skins: [
        {
          name: 'default',
          attachments: {
            slot1: {
              CIRCLE: { type: 'region' },
              SQUARE: { type: 'region' },
              TRIANGLE: { type: 'region' },
            },
          },
        },
      ],
    };
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(skelPath, JSON.stringify(fakeJson));
    try {
      const synth = synthesizeAtlasText(fakeJson, path.join(tmpDir, 'images'), skelPath);
      const atlas = new TextureAtlas(synth.atlasText);
      // All 3 regions resolve under the stub-region fix.
      const circle = atlas.findRegion('CIRCLE');
      const square = atlas.findRegion('SQUARE');
      const triangle = atlas.findRegion('TRIANGLE');
      expect(circle).not.toBeNull();
      expect(square).not.toBeNull();
      expect(triangle).not.toBeNull();
      // CIRCLE + SQUARE have REAL dims from their PNG IHDR.
      expect(circle!.width).toBeGreaterThan(1);
      expect(square!.width).toBeGreaterThan(1);
      // TRIANGLE has STUB dims — exactly 1x1 (G-01 stub-region grammar).
      expect(triangle!.width).toBe(1);
      expect(triangle!.height).toBe(1);
      // Maps mirror PNG truth: only the 2 real PNGs in pngPathsByRegionName + dimsByRegionName.
      expect(synth.pngPathsByRegionName.size).toBe(2);
      expect(synth.dimsByRegionName.size).toBe(2);
      // missingPngs records the missing one.
      expect(synth.missingPngs).toEqual(['TRIANGLE.png']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('exposes missingPngs on SynthResult for downstream surfacing (G-02 plumbing precondition)', () => {
    // Light test verifying the missingPngs field is present + populated even
    // for the happy-path-with-one-missing case. Sister test of the above but
    // narrower scope (just the missingPngs field shape).
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-missingpngs-shape-'));
    fs.mkdirSync(path.join(tmpDir, 'images'), { recursive: true });
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png'),
      path.join(tmpDir, 'images', 'CIRCLE.png'),
    );
    const fakeJson = {
      skeleton: { spine: '4.2.0' },
      skins: [
        {
          name: 'default',
          attachments: {
            slot1: { CIRCLE: { type: 'region' } },
            slot2: { MISSING: { type: 'mesh' } },
          },
        },
      ],
    };
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(skelPath, JSON.stringify(fakeJson));
    try {
      const synth = synthesizeAtlasText(fakeJson, path.join(tmpDir, 'images'), skelPath);
      expect(Array.isArray(synth.missingPngs)).toBe(true);
      expect(synth.missingPngs).toEqual(['MISSING.png']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('stubs all regions when images/ dir is empty + JSON has region refs (no longer catastrophic under G-01 fix; see plan ISSUE-006 note)', () => {
    // Pre-G-01 contract: this case threw MissingImagesDirError. Post-G-01:
    // every region gets a stub, the load succeeds, all 4 region paths show
    // up in missingPngs for downstream surfacing.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-emptyimg-'));
    fs.mkdirSync(path.join(tmpDir, 'images'), { recursive: true });
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(
      skelPath,
      JSON.stringify({
        skeleton: { spine: '4.2.0' },
        skins: [
          {
            name: 'default',
            attachments: {
              s1: { CIRCLE: { type: 'region' } },
              s2: { SQUARE: { type: 'region' } },
              s3: { TRIANGLE: { type: 'region' } },
              s4: { STAR: { type: 'mesh' } },
            },
          },
        ],
      }),
    );
    try {
      const synth = synthesizeAtlasText(
        JSON.parse(fs.readFileSync(skelPath, 'utf8')),
        path.join(tmpDir, 'images'),
        skelPath,
      );
      const atlas = new TextureAtlas(synth.atlasText);
      // All 4 regions resolve as 1x1 stubs (assertions unrolled per region
      // to match the Plan 21-09 acceptance-criteria literal-count check on
      // `width).toBe(1)` occurrences).
      const circle = atlas.findRegion('CIRCLE');
      const square = atlas.findRegion('SQUARE');
      const triangle = atlas.findRegion('TRIANGLE');
      const star = atlas.findRegion('STAR');
      expect(circle, 'region CIRCLE should be a 1x1 stub').not.toBeNull();
      expect(square, 'region SQUARE should be a 1x1 stub').not.toBeNull();
      expect(triangle, 'region TRIANGLE should be a 1x1 stub').not.toBeNull();
      expect(star, 'region STAR should be a 1x1 stub').not.toBeNull();
      expect(circle!.width).toBe(1);
      expect(circle!.height).toBe(1);
      expect(square!.width).toBe(1);
      expect(square!.height).toBe(1);
      expect(triangle!.width).toBe(1);
      expect(triangle!.height).toBe(1);
      expect(star!.width).toBe(1);
      expect(star!.height).toBe(1);
      expect(synth.missingPngs.length).toBe(4);
      expect(synth.pngPathsByRegionName.size).toBe(0);
      expect(synth.dimsByRegionName.size).toBe(0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('synthesizeAtlasText catastrophic cases (INV-6; D-10, D-11)', () => {
  it('throws MissingImagesDirError when images/ folder is absent + JSON has region refs', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-noimg-'));
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(
      skelPath,
      JSON.stringify({
        skeleton: { spine: '4.2.0' },
        skins: [{ name: 'default', attachments: { s: { CIRCLE: { type: 'region' } } } }],
      }),
    );
    try {
      let caught: unknown;
      try {
        synthesizeAtlasText(
          JSON.parse(fs.readFileSync(skelPath, 'utf8')),
          path.join(tmpDir, 'images'),
          skelPath,
        );
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(MissingImagesDirError);
      const err = caught as MissingImagesDirError;
      expect(err.name).toBe('MissingImagesDirError');
      expect(err.searchedPath.endsWith('images')).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('synthesizeAtlasText path-field handling (Pitfall 2)', () => {
  it('keys synthesized regions on att.path (not entryName)', () => {
    // Construct a JSON where entryName ('foo') differs from path ('AVATAR/bar').
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-synth-pathfield-'));
    fs.mkdirSync(path.join(tmpDir, 'images', 'AVATAR'), { recursive: true });
    // Copy a known-good fixture PNG into the AVATAR subfolder so readPngDims
    // resolves against it.
    fs.copyFileSync(
      path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images/CIRCLE.png'),
      path.join(tmpDir, 'images', 'AVATAR', 'bar.png'),
    );
    const fakeJson = {
      skeleton: { spine: '4.2.0' },
      skins: [
        {
          name: 'default',
          attachments: {
            slot1: {
              foo: { type: 'region', path: 'AVATAR/bar' },
            },
          },
        },
      ],
    };
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.writeFileSync(skelPath, JSON.stringify(fakeJson));
    try {
      const synth = synthesizeAtlasText(fakeJson, path.join(tmpDir, 'images'), skelPath);
      const atlas = new TextureAtlas(synth.atlasText);
      // Region keyed on path, NOT on entry name.
      expect(atlas.findRegion('AVATAR/bar')).not.toBeNull();
      expect(atlas.findRegion('foo')).toBeNull();
      // The SynthResult maps mirror the keying.
      expect(synth.pngPathsByRegionName.has('AVATAR/bar')).toBe(true);
      expect(synth.pngPathsByRegionName.has('foo')).toBe(false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('SilentSkipAttachmentLoader (Pitfall 1; D-09)', () => {
  it('newRegionAttachment returns null on missing region (does not throw)', () => {
    const parsedJson = JSON.parse(fs.readFileSync(FIXTURE_JSON, 'utf8'));
    const synth = synthesizeAtlasText(parsedJson, FIXTURE_IMAGES_DIR, FIXTURE_JSON);
    const atlas = new TextureAtlas(synth.atlasText);
    const loader = new SilentSkipAttachmentLoader(atlas);
    const fakeSkin = new Skin('test');
    // CIRCLE exists in the fixture → non-null attachment.
    const ok = loader.newRegionAttachment(fakeSkin, 'CIRCLE', 'CIRCLE', null);
    expect(ok).not.toBeNull();
    // 'NONEXISTENT_REGION' missing → null return, NOT a throw.
    let caught: unknown = null;
    let result: unknown;
    try {
      result = loader.newRegionAttachment(fakeSkin, 'foo', 'NONEXISTENT_REGION', null);
    } catch (e) {
      caught = e;
    }
    expect(caught, 'should not throw on missing region').toBeNull();
    expect(result).toBeNull();
  });

  it('newMeshAttachment returns null on missing region (does not throw)', () => {
    const parsedJson = JSON.parse(fs.readFileSync(FIXTURE_JSON, 'utf8'));
    const synth = synthesizeAtlasText(parsedJson, FIXTURE_IMAGES_DIR, FIXTURE_JSON);
    const atlas = new TextureAtlas(synth.atlasText);
    const loader = new SilentSkipAttachmentLoader(atlas);
    const fakeSkin = new Skin('test');
    // 'NONEXISTENT_REGION' missing → null return, NOT a throw.
    let caught: unknown = null;
    let result: unknown;
    try {
      result = loader.newMeshAttachment(fakeSkin, 'foo', 'NONEXISTENT_REGION', null);
    } catch (e) {
      caught = e;
    }
    expect(caught, 'should not throw on missing region').toBeNull();
    expect(result).toBeNull();
  });
});
