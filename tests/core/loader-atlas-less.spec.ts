/**
 * Phase 21 Plan 08 — Atlas-less mode round-trip integration tests (LOAD-04 closure).
 *
 * Behavior gates pulled from RESEARCH.md INV-7, INV-8, INV-9 + ROADMAP
 * success criterion #5 (AtlasNotFoundError preservation):
 *   - D-05 + INV-8: Load fixtures/SIMPLE_PROJECT_NO_ATLAS via the synthesis path;
 *     LoadResult.atlasPath === null + sourceDims source === 'png-header'
 *   - D-10 catastrophic case (no images/ folder) → MissingImagesDirError end-to-end
 *   - D-08: loaderMode: 'atlas-less' explicit opt is byte-equivalent to fall-through
 *   - Success criterion #5: explicit opts.atlasPath that is unreadable STILL throws
 *     AtlasNotFoundError verbatim
 *   - INV-9: Round-trip load → sample → analyze → buildExportPlan succeeds and
 *     produces an ExportPlan whose rows reference fixture PNGs (LOAD-04 closure)
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { analyze } from '../../src/core/analyzer.js';
import { findUnusedAttachments } from '../../src/core/usage.js';
import { buildExportPlan } from '../../src/core/export.js';
import { AtlasNotFoundError, MissingImagesDirError } from '../../src/core/errors.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

const ATLAS_LESS_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json');
const ATLAS_LESS_IMAGES_DIR = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS/images');

describe('Phase 21 atlas-less round-trip (LOAD-01 + LOAD-04)', () => {
  it('D-05 + INV-8: load returns LoadResult with atlasPath: null and sourceDims source: "png-header"', () => {
    const result = loadSkeleton(ATLAS_LESS_FIXTURE);
    expect(result.atlasPath).toBeNull();
    // SIMPLE_PROJECT_NO_ATLAS has 4 attachments (CIRCLE/SQUARE/SQUARE2/TRIANGLE)
    // referencing 3 unique regions (SQUARE2 → SQUARE region). sourceDims keys
    // off region names, so size === 3. (Plan 21-06 SUMMARY confirms ≥3 entries.)
    expect(result.sourceDims.size).toBeGreaterThanOrEqual(3);
    for (const [name, dims] of result.sourceDims) {
      expect(dims.source, `region ${name}`).toBe('png-header');
      expect(dims.w).toBeGreaterThan(0);
      expect(dims.h).toBeGreaterThan(0);
    }
    // sourcePaths populated for each region
    for (const name of result.sourceDims.keys()) {
      expect(result.sourcePaths.get(name)).toBeDefined();
      expect(result.sourcePaths.get(name)?.endsWith('.png')).toBe(true);
    }
    // atlasSources populated with rotated=false (D-17)
    for (const name of result.sourceDims.keys()) {
      const src = result.atlasSources.get(name);
      expect(src).toBeDefined();
      expect(src?.rotated).toBe(false);
      expect(src?.x).toBe(0);
      expect(src?.y).toBe(0);
    }
    // Phase 21 Plan 21-09 G-01 — happy path has all PNGs present;
    // skippedAttachments is undefined or empty (optional field per ISSUE-007).
    expect(result.skippedAttachments ?? []).toEqual([]);
  });

  it('D-10 catastrophic: loaderMode: "atlas-less" override on tmpdir with JSON only (no images/) throws MissingImagesDirError end-to-end', () => {
    // NB: Per Plan 21-06's malformed-project guard (src/core/loader.ts:289-307),
    // a fall-through JSON-only tmpdir without sibling .atlas AND without images/
    // throws AtlasNotFoundError VERBATIM (preserves ROADMAP success criterion #5
    // — this is the behavior locked in tests/core/loader.spec.ts F1.4 tests).
    //
    // To exercise the MissingImagesDirError end-to-end through loadSkeleton, the
    // synthesis branch must be reached unconditionally — that is what
    // loaderMode: 'atlas-less' does (D-08 override; bypasses the malformed-
    // project guard since the user explicitly opted into atlas-less mode).
    // synthetic-atlas.ts:96-101 then throws MissingImagesDirError because
    // images/ doesn't exist while the JSON references regions.
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-cata-'));
    const skelPath = path.join(tmpDir, 'rig.json');
    // Copy a real JSON that references regions (so the catastrophic check fires).
    fs.copyFileSync(ATLAS_LESS_FIXTURE, skelPath);
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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('D-08: explicit loaderMode: "atlas-less" opt is byte-equivalent to fall-through', () => {
    const fallThrough = loadSkeleton(ATLAS_LESS_FIXTURE);
    const explicit = loadSkeleton(ATLAS_LESS_FIXTURE, { loaderMode: 'atlas-less' });
    expect(explicit.atlasPath).toBe(fallThrough.atlasPath); // both null
    expect(explicit.sourceDims.size).toBe(fallThrough.sourceDims.size);
    expect([...explicit.sourceDims.keys()].sort()).toEqual(
      [...fallThrough.sourceDims.keys()].sort(),
    );
    for (const name of explicit.sourceDims.keys()) {
      expect(explicit.sourceDims.get(name)?.source).toBe('png-header');
      expect(explicit.sourceDims.get(name)?.w).toBe(fallThrough.sourceDims.get(name)?.w);
      expect(explicit.sourceDims.get(name)?.h).toBe(fallThrough.sourceDims.get(name)?.h);
    }
  });

  it('Success criterion #5 — explicit opts.atlasPath unreadable STILL throws AtlasNotFoundError verbatim (regression)', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-explicit-'));
    const skelPath = path.join(tmpDir, 'rig.json');
    fs.copyFileSync(ATLAS_LESS_FIXTURE, skelPath);
    // Also seed the images dir so the only failure surface is the explicit
    // atlasPath being unreadable (not a missing-images cascade).
    const imgDir = path.join(tmpDir, 'images');
    fs.mkdirSync(imgDir, { recursive: true });
    for (const png of fs.readdirSync(ATLAS_LESS_IMAGES_DIR)) {
      fs.copyFileSync(
        path.join(ATLAS_LESS_IMAGES_DIR, png),
        path.join(imgDir, png),
      );
    }
    const explicitAtlas = path.join(tmpDir, 'nonexistent.atlas');
    try {
      let caught: unknown;
      try {
        loadSkeleton(skelPath, { atlasPath: explicitAtlas });
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(AtlasNotFoundError);
      // Verbatim message check (locked from src/core/errors.ts:44-47)
      expect((caught as Error).message).toContain(
        'Spine projects require an .atlas file beside the .json',
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ====== ROUND-TRIP INTEGRATION (INV-9) — LOAD-04 closure ======
  // In-process pipeline: loadSkeleton → sampleSkeleton → analyze → buildExportPlan.
  // Mirrors the canonical pattern in tests/core/export.spec.ts:42-69 verbatim.
  // The atlas-less LoadResult drops into this pipeline unchanged because Plan
  // 06 wired sourcePaths/atlasSources/sourceDims to mirror the canonical-mode
  // shape — that's the entire point of the synthesis approach.
  it('INV-9: round-trip load → sample → analyze → buildExportPlan produces non-empty plan with fixture PNG paths', () => {
    const load = loadSkeleton(ATLAS_LESS_FIXTURE);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks, load.sourcePaths, load.atlasSources);
    // Build the minimal SkeletonSummary slice buildExportPlan reads.
    // (Pattern lifted from tests/core/export.spec.ts:49-55.)
    const summary: Pick<SkeletonSummary, 'peaks' | 'unusedAttachments'> = {
      peaks,
      unusedAttachments: findUnusedAttachments(load, sampled),
    };
    const plan: ExportPlan = buildExportPlan(summary as SkeletonSummary, new Map());

    // LOAD-04 assertions: plan exists, has rows, each row references a real
    // fixture PNG via sourcePath.
    expect(plan.rows.length).toBeGreaterThan(0);
    for (const row of plan.rows) {
      expect(
        row.sourcePath,
        `row sourcePath should end with .png: ${row.sourcePath}`,
      ).toMatch(/\.png$/);
      expect(
        row.sourcePath,
        `row sourcePath should reference fixture: ${row.sourcePath}`,
      ).toContain('SIMPLE_PROJECT_NO_ATLAS');
      // sourceDims provenance preserved through the pipeline — the analyzer
      // doesn't mutate the source field; loader's 'png-header' value stays.
      expect(row.sourceW).toBeGreaterThan(0);
      expect(row.sourceH).toBeGreaterThan(0);
    }
  });

  it('G-01: load atlas-less mesh-only project with missing PNG does NOT crash; skippedAttachments surfaces the entry (falsifying regression)', () => {
    // Reproduces the gap surfaced in 21-HUMAN-UAT.md G-01: deleting a single
    // mesh-attachment PNG used to crash with `Cannot read properties of null
    // (reading 'bones')` because spine-core's animation/skin parser reads
    // attachment.bones without null-check when the attachment was silently
    // dropped from the skin. Plan 21-09's stub-region fix synthesizes a 1x1
    // region for missing PNGs so the attachment exists in the skin and the
    // parser succeeds.
    //
    // FALSIFYING: this test uses the new fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/
    // fixture, which was empirically verified to crash pre-fix via
    // scripts/probe-g01-prefix-crash.ts (TypeError: Cannot read properties of
    // null (reading 'bones')). The pre-existing SIMPLE_PROJECT_NO_ATLAS
    // fixture does NOT reproduce G-01 because its SIMPLE_TEST.json has zero
    // animations with deform timelines that read attachment.bones (Plan 21-09
    // ISSUE-001).
    const SRC_FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-aless-g01-'));
    const tmpJson = path.join(tmpDir, 'MeshOnly_TEST.json');
    const tmpImages = path.join(tmpDir, 'images');
    fs.mkdirSync(tmpImages, { recursive: true });
    fs.copyFileSync(path.join(SRC_FIXTURE, 'MeshOnly_TEST.json'), tmpJson);
    // Intentionally do NOT copy MESH_REGION.png — that's the missing-PNG case.
    try {
      let caught: unknown = null;
      let result: ReturnType<typeof loadSkeleton> | undefined;
      try {
        result = loadSkeleton(tmpJson);
      } catch (e) {
        caught = e;
      }
      expect(caught, 'load should not throw — G-01 regression').toBeNull();
      expect(result).toBeDefined();
      // skippedAttachments contains exactly the one missing region.
      expect(result!.skippedAttachments).toBeDefined();
      expect(result!.skippedAttachments!.length).toBe(1);
      expect(result!.skippedAttachments![0].name).toBe('MESH_REGION');
      expect(
        result!.skippedAttachments![0].expectedPngPath.endsWith(
          path.join('images', 'MESH_REGION.png'),
        ),
      ).toBe(true);
      // The MESH_REGION attachment EXISTS in the loaded skeleton (with stub
      // dims) — proving spine-core's animation/skin parser succeeded against a
      // resolved-but-stubbed region. Walk the default skin to find it.
      const defaultSkin = result!.skeletonData.defaultSkin;
      expect(defaultSkin).toBeDefined();
      let meshAttachment: unknown = null;
      for (let slotIdx = 0; slotIdx < defaultSkin!.attachments.length; slotIdx++) {
        const dict = defaultSkin!.attachments[slotIdx];
        if (dict && dict['MESH_REGION']) {
          meshAttachment = dict['MESH_REGION'];
          break;
        }
      }
      expect(
        meshAttachment,
        'MESH_REGION attachment must exist in default skin (stub region)',
      ).not.toBeNull();
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
