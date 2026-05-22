/**
 * Phase 49 Plan 03 — V3 (EXPORT-01/03) per-mode drop-in package layout +
 * V4 (EXPORT-01) oversize-forced rollback — over the dual-runtime × dual-mode
 * matrix (V7 / EXPORT-05).
 *
 * This proves the OUTPUT of handleExportVariant (Plan 01) is a real, contained,
 * drop-in package:
 *   - the `{NAME}@{s}x/` folder carries the scale token (rendered by Plan-01's
 *     CANONICAL `formatScaleToken`); inner basenames stay clean `{NAME}.*`
 *     (D-02 / Pitfall 4 — never scale-suffix an inner file);
 *   - the baked scaled JSON is present in ALL three output modes
 *     (`loose | atlas | both`) — it is the one always-written new artifact
 *     (EXPORT-03);
 *   - per-mode artifacts: loose → `images/<region>.png`; atlas → `{NAME}.atlas`
 *     + `{NAME}.png`; both → the union;
 *   - the atlas-less + atlas-mode cells repack the per-region PNGs (or the
 *     atlas-page-extraction fallback for 4.3) into a coherent `{NAME}.atlas`
 *     whose region names == the baked JSON `path:` names (EXPORT-03 / Flag 3);
 *   - a forced `runRepack` oversize leaves NO orphan `{NAME}.json` and no
 *     partial textures — the shared written-Set rollback sweeps the JSON
 *     together with any partial artifacts (V4 / Pitfall 2 / T-49-ROLLBACK).
 *
 * MATRIX (V7) — (4.2 + 4.3) × (atlas-source + atlas-less), with EXPLICIT
 * per-cell mode scoping:
 *   - 4.2 SIMPLE_PROJECT HAS images/ → atlas-less runs all three modes.
 *   - 4.3 SLIDER_4_3 has NO images/ dir → its atlas-less cell is ATLAS-mode-only
 *     (loose-mode source-resize requires `images/<region>.png`; only the
 *     atlas/repack path has the page-extraction fallback at
 *     `repack-worker.ts:121-154`). The cell still RUNS (atlas mode) and asserts
 *     the full layout + clean basenames — this is a DELIBERATE, DOCUMENTED
 *     constraint, NOT a silent skip. The 4.3 atlas-less LOAD + s× faithfulness
 *     are additionally covered by Task 2's oracle (which reads no loose pixels).
 *
 * EXECUTION DEVIATION (Rule 3 — documented in 49-03-SUMMARY): SLIDER_4_3 cannot
 * be LOADED via `loadSkeleton(..., { loaderMode: 'atlas-less' })` — the loader's
 * synthetic-atlas synthesizer throws `MissingImagesDirError` because there is no
 * `images/` dir AND no per-region PNGs (synthetic-atlas.ts:134). The
 * atlas-page-extraction fallback the plan refers to (repack-worker.ts:121-154)
 * lives in the EXPORT layer, NOT the LOAD layer: it fires during atlas/repack
 * export when the loose per-region PNG is absent, extracting the region from the
 * page PNG. So the 4.3 "atlas-less" cell is realized as: LOAD atlas-source (which
 * populates the per-row atlasSource page metadata) + EXPORT atlas-mode-only —
 * which forces exactly that page-extraction route (no images/square.png on disk
 * → runRepack extracts `square` from SLIDER-01.png). The cell's `mode` token
 * stays `atlas-less` (the route it exercises); only the LOAD is atlas-source by
 * necessity. This is the only faithful way to cover the 4.3 page-extraction
 * fallback with the committed json+atlas-only fixture.
 *
 * D-06a #3 — NO silent skip: each matrix case hard-fails with a clear
 * `fixture not found` message if the rig `.json` is absent (idiom reused from
 * tests/scale-bake.spec.ts:169-176). A missing committed fixture must be LOUD.
 *
 * Scaffold from tests/main/image-worker.integration.spec.ts:21-67 (mkdtempSync
 * tmpdir + existsSync). The pixel path drives on real PNGs (SIMPLE_TEST.png /
 * SLIDER-01.png). The folder-token assertion imports `formatScaleToken` BY NAME
 * from variant-export.js so the `@0.5x` literal has ONE source of truth (WARN-4).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton } from '../../src/core/sampler.js';
import { buildSummary } from '../../src/main/summary.js';
import {
  handleExportVariant,
  formatScaleToken,
} from '../../src/main/variant-export.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const S = 0.5;

// fakeEvt — the sendProgress closure tolerates a no-op sender (ipc.ts:901-906).
const fakeEvt = { sender: { send: () => {} } };
const defaultAtlasOpts = { maxPageSize: 4096 as const, allowRotation: false, padding: 2 };

type Mode = 'loose' | 'atlas' | 'both';

interface MatrixCell {
  rig: string; // repo-relative, no extension
  name: string; // {NAME} (basename, no .json)
  mode: 'atlas-source' | 'atlas-less';
  // How to LOAD the rig. Usually === mode, EXCEPT the 4.3 atlas-less cell, which
  // must load 'atlas-source' (SLIDER_4_3 has no images/ → the loader cannot
  // synthesize an atlas-less load) yet exercises the atlas-less EXPORT route via
  // the page-extraction fallback (see header DEVIATION note).
  loadMode: 'atlas-source' | 'atlas-less';
  runtime: '4.2' | '4.3';
  exportModes: readonly Mode[];
}

const MATRIX: readonly MatrixCell[] = [
  // 4.2 SIMPLE_PROJECT HAS images/ → atlas-less can run all three modes.
  {
    rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST',
    name: 'SIMPLE_TEST',
    mode: 'atlas-source',
    loadMode: 'atlas-source',
    runtime: '4.2',
    exportModes: ['loose', 'atlas', 'both'] as const,
  },
  {
    rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST',
    name: 'SIMPLE_TEST',
    mode: 'atlas-less',
    loadMode: 'atlas-less',
    runtime: '4.2',
    exportModes: ['loose', 'atlas', 'both'] as const,
  },
  // 4.3 SLIDER_4_3 HAS a packed PNG → atlas-source runs all three.
  {
    rig: 'fixtures/SLIDER_4_3/SLIDER-01',
    name: 'SLIDER-01',
    mode: 'atlas-source',
    loadMode: 'atlas-source',
    runtime: '4.3',
    exportModes: ['loose', 'atlas', 'both'] as const,
  },
  // 4.3 SLIDER_4_3 has NO images/ dir → the atlas-less EXPORT route is
  // ATLAS-mode-only: loose-mode source-resize requires images/<region>.png on
  // disk; only the atlas/repack path has the atlas-page-extraction fallback
  // (repack-worker.ts:121-154). The cell LOADS atlas-source (the loader cannot
  // synthesize an atlas-less load with no images/ — synthetic-atlas.ts:134) but
  // EXPORTS atlas-mode-only, forcing the page-extraction route (no
  // images/square.png on disk → runRepack extracts `square` from SLIDER-01.png).
  // loose-mode source-resize is N/A for this one cell (DELIBERATE, not a skip).
  {
    rig: 'fixtures/SLIDER_4_3/SLIDER-01',
    name: 'SLIDER-01',
    mode: 'atlas-less',
    loadMode: 'atlas-source',
    runtime: '4.3',
    exportModes: ['atlas'] as const,
  },
] as const;

/** Build a real SkeletonSummary headlessly — same chain the existing main tests
 *  use (variant-source-immutable.spec.ts:39-43). atlas-less LOAD cells pass
 *  loaderMode:'atlas-less' so the loader synthesizes from per-region PNG headers
 *  (4.2). The 4.3 atlas-less cell loads atlas-source by necessity (see
 *  MatrixCell.loadMode + the header DEVIATION note). */
function buildCellSummary(cell: MatrixCell): SkeletonSummary {
  const skeletonPath = path.resolve(REPO_ROOT, cell.rig + '.json');
  const load =
    cell.loadMode === 'atlas-less'
      ? loadSkeleton(skeletonPath, { loaderMode: 'atlas-less' })
      : loadSkeleton(skeletonPath);
  const sampled = sampleSkeleton(load);
  return buildSummary(load, sampled, 0);
}

/** Collect every TEXTURED region name referenced by the baked JSON's skins
 *  (path ?? attachmentName). Only region | mesh | linkedmesh attachments carry
 *  an atlas region (matching the loader's filter at synthetic-atlas.ts /
 *  loader.ts:481-489) — path/boundingbox/point/clipping have NO texture and are
 *  excluded. These textured names must each resolve in the repacked .atlas
 *  (Flag 3). A region attachment in the JSON omits `type` (default 'region'). */
function bakedRegionNames(bakedJsonPath: string): Set<string> {
  const TEXTURED = new Set(['region', 'mesh', 'linkedmesh']);
  const baked = JSON.parse(fs.readFileSync(bakedJsonPath, 'utf8')) as {
    skins?: unknown;
  };
  const names = new Set<string>();
  const skins = baked.skins;
  if (!Array.isArray(skins)) return names;
  for (const skin of skins as Array<{
    attachments?: Record<string, Record<string, { type?: string; path?: string }>>;
  }>) {
    const attachmentsBySlot = skin.attachments ?? {};
    for (const slotEntries of Object.values(attachmentsBySlot)) {
      for (const [attachmentName, att] of Object.entries(slotEntries)) {
        const type = att && att.type ? att.type : 'region';
        if (!TEXTURED.has(type)) continue;
        names.add(att && att.path ? att.path : attachmentName);
      }
    }
  }
  return names;
}

// ---------------------------------------------------------------------------
// V3 — per-mode drop-in layout over the dual-runtime × dual-mode matrix.
// ---------------------------------------------------------------------------
describe('handleExportVariant — V3 per-mode package layout (EXPORT-01/03/05)', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-layout-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  for (const cell of MATRIX) {
    const cellLabel = `${cell.name} [${cell.runtime} / ${cell.mode}]`;

    // D-06a #3 — loud-fail if the committed fixture is absent (no silent skip).
    it(`fixture present: ${cellLabel}`, () => {
      const jsonPath = path.resolve(REPO_ROOT, cell.rig + '.json');
      expect(fs.existsSync(jsonPath), `fixture not found: ${cell.rig}.json`).toBe(true);
    });

    for (const mode of cell.exportModes) {
      it(`layout ${mode}: ${cellLabel} → {NAME}@${formatScaleToken(S)}x/ with clean basenames`, async () => {
        const summary = buildCellSummary(cell);
        const res = await handleExportVariant(
          fakeEvt,
          summary,
          S,
          tmpDir,
          false,
          false,
          mode,
          defaultAtlasOpts,
        );
        expect(
          res.ok,
          `export should succeed for ${cellLabel} (${mode}); got: ${
            res.ok ? 'ok' : (res as { error: { message: string } }).error.message
          }`,
        ).toBe(true);

        // Folder token anchored to Plan-01's canonical helper (WARN-4 / D-02).
        const token = formatScaleToken(S);
        const outDir = path.join(tmpDir, `${cell.name}@${token}x`);
        expect(fs.existsSync(outDir), `outDir missing: ${outDir}`).toBe(true);
        expect(path.basename(outDir)).toBe(`${cell.name}@${formatScaleToken(S)}x`);

        // EXPORT-03 — the scaled JSON is present in ALL modes (always-written).
        const jsonPath = path.join(outDir, `${cell.name}.json`);
        expect(fs.existsSync(jsonPath), `scaled JSON missing in ${mode} mode`).toBe(true);

        if (mode === 'loose' || mode === 'both') {
          const imagesDir = path.join(outDir, 'images');
          expect(fs.existsSync(imagesDir), `images/ missing in ${mode} mode`).toBe(true);
          // At least one per-region PNG exists (enumerate from summary regions).
          const regionPngs = summary.regions
            .map((r) => path.join(imagesDir, `${r.regionName}.png`))
            .filter((p) => fs.existsSync(p));
          expect(
            regionPngs.length,
            `expected ≥1 images/<region>.png in ${mode} mode for ${cellLabel}`,
          ).toBeGreaterThanOrEqual(1);
        }

        if (mode === 'atlas' || mode === 'both') {
          expect(
            fs.existsSync(path.join(outDir, `${cell.name}.atlas`)),
            `{NAME}.atlas missing in ${mode} mode`,
          ).toBe(true);
          expect(
            fs.existsSync(path.join(outDir, `${cell.name}.png`)),
            `{NAME}.png (page 0) missing in ${mode} mode`,
          ).toBe(true);
        }

        // Clean basenames (D-02 / Pitfall 4): the FOLDER is the only @-bearing
        // token; every inner entry is clean {NAME}.* or the images/ dir.
        const allowed = new RegExp(`^${cell.name}(\\.json|\\.atlas|\\.png|_\\d+\\.png)$`);
        for (const entry of fs.readdirSync(outDir)) {
          if (entry === 'images') continue;
          expect(entry, `inner basename has an @ (scale-suffix forbidden): ${entry}`).not.toMatch(/@/);
          expect(
            entry,
            `unexpected inner entry "${entry}" in ${outDir} — expected clean ${cell.name}.* basenames`,
          ).toMatch(allowed);
        }
      });
    }

    // Output-mode coherence for atlas-less + atlas mode (EXPORT-03 / Flag 3) —
    // BOTH the 4.2 atlas-less (images/ → repack) AND the 4.3 atlas-less
    // (page-extraction fallback) cell. The repacked .atlas must carry every
    // region name the baked JSON references, proving cross-resolve.
    if (cell.mode === 'atlas-less') {
      it(`atlas coherence (atlas-less): ${cellLabel} repacked .atlas covers every baked-JSON path: region`, async () => {
        const summary = buildCellSummary(cell);
        const res = await handleExportVariant(
          fakeEvt,
          summary,
          S,
          tmpDir,
          false,
          false,
          'atlas',
          defaultAtlasOpts,
        );
        expect(
          res.ok,
          `atlas-mode export should succeed for ${cellLabel}; got: ${
            res.ok ? 'ok' : (res as { error: { message: string } }).error.message
          }`,
        ).toBe(true);

        const outDir = path.join(tmpDir, `${cell.name}@${formatScaleToken(S)}x`);
        const atlasText = fs.readFileSync(path.join(outDir, `${cell.name}.atlas`), 'utf8');
        const regionNames = bakedRegionNames(path.join(outDir, `${cell.name}.json`));
        expect(regionNames.size, 'baked JSON declares at least one region').toBeGreaterThanOrEqual(1);
        for (const region of regionNames) {
          // Region lines in a libgdx .atlas appear on their own line.
          const onItsOwnLine = new RegExp(
            `^${region.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'm',
          );
          expect(
            atlasText,
            `repacked .atlas missing region "${region}" referenced by the baked JSON (${cellLabel})`,
          ).toMatch(onItsOwnLine);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// V4 — partial-failure rollback INCLUDES the JSON (Pitfall 2 / T-49-ROLLBACK).
// Force a runRepack oversize via a tiny maxPageSize so a region exceeds the cap.
// ---------------------------------------------------------------------------
describe('handleExportVariant — V4 oversize-forced rollback leaves no orphan {NAME}.json', () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-variant-rollback-'));
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('leaves no orphan {NAME}.json when runRepack throws oversize', async () => {
    // Chosen fixture+cap combination (documented per the plan's V4 directive):
    //   fixture = SIMPLE_TEST (real PNG; D-91 caps every scaled region at its
    //   canonical dims — CIRCLE 699, SQUARE 1000, TRIANGLE 833 — so at any
    //   0 < s < 1 the LARGEST possible region is 1000px). The repack oversize
    //   check is `inp.packW > maxPageSize` on the SCALED dim alone
    //   (core/repack.ts:176), so even the valid-union minimum maxPageSize:1024
    //   can NEVER trip on this (capped-at-1000) fixture. To get a GENUINE
    //   oversize throw (NO monkeypatch — FORBIDDEN) we must use a cap below the
    //   smallest scaled region; maxPageSize:64 reliably trips
    //   repack-worker.ts:516-522 ("Region <N> is W×H px which exceeds the
    //   page-size cap"). 64 is outside the AtlasOpts literal union
    //   (1024|2048|4096|8192), so a localized `as` cast at the call site is used
    //   (the Phase-48 union-seam idiom) — this is a real, deterministic worker
    //   throw on real bytes, not a stub.
    //
    // The worker throws at the pack pre-flight, BEFORE any .atlas/page write,
    // but the baked {NAME}.json was already written FIRST under the shared
    // rollback Set. The contract this proves: after the throw, the {NAME}.json
    // does NOT survive — it is swept by the same `written` Set as any partial
    // texture (T-49-ROLLBACK / Pitfall 2).
    const skeletonPath = path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
    const load = loadSkeleton(skeletonPath);
    const sampled = sampleSkeleton(load);
    const summary = buildSummary(load, sampled, 0);

    const res = await handleExportVariant(
      fakeEvt,
      summary,
      S,
      tmpDir,
      false,
      false,
      'atlas',
      // maxPageSize:64 — deliberately below the AtlasOpts literal union to force
      // the oversize throw on the capped-at-1000 fixture (see comment above).
      { maxPageSize: 64 as unknown as 1024, allowRotation: false, padding: 2 },
    );

    expect(res.ok, 'oversize repack must fail the variant export').toBe(false);

    const outDir = path.join(tmpDir, `${'SIMPLE_TEST'}@${formatScaleToken(S)}x`);
    // The shared written-Set rollback swept the JSON together with any partials.
    expect(
      fs.existsSync(path.join(outDir, 'SIMPLE_TEST.json')),
      'orphan {NAME}.json survived the oversize rollback',
    ).toBe(false);
    // No partial .atlas / .png survives either: the outDir is empty or absent.
    if (fs.existsSync(outDir)) {
      const remaining = fs
        .readdirSync(outDir)
        .filter((n) => n.endsWith('.atlas') || n.endsWith('.png') || n.endsWith('.json'));
      expect(remaining, `partial artifacts survived rollback: ${JSON.stringify(remaining)}`).toEqual([]);
    }
  });
});
