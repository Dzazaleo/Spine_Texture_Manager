/**
 * Phase 40 REPACK-01 — Loose-mode SHA256 byte-identity regression gate.
 *
 * THIS IS THE STRICTEST TEST GATE OF THE ENTIRE PHASE. Per RESEARCH §
 * Landmines #10: a one-byte change to any loose-mode PNG breaks REPACK-01.
 * The same gate also covers the atlas-mode outputs (.atlas text + page PNG)
 * for the same fixture — together these baselines guard every Phase 40
 * output surface against unintended sharp/libvips/maxrects-packer drift.
 *
 * Workflow:
 *   1. Run runExport (loose) + runRepack (atlas) on a synthetic plan
 *      derived from SIMPLE_TEST.json regions into a tmp dir.
 *   2. Compute SHA256 of every loose PNG, the .atlas, and each page PNG.
 *   3. Compare to baselines in tests/fixtures/repack-baselines.json.
 *   4. If UPDATE_FIXTURES=1, write computed hashes in-place instead of
 *      asserting + copy the produced .atlas text to
 *      tests/fixtures/repack-expected/SIMPLE_TEST.atlas (developer-facing
 *      text diff target on future failures).
 *
 * Refresh workflow (D-07): `npm run repack:refresh-baselines` or
 * `UPDATE_FIXTURES=1 npx vitest run tests/main/repack.loose-parity.spec.ts`.
 * NEITHER runs in CI.
 *
 * Why direct worker invocation rather than handleStartExport: importing
 * src/main/ipc.ts brings in `electron` at module-load time, which requires
 * a vi.mock('electron') block and conflicts with the real-sharp execution
 * this test needs. Calling runExport + runRepack directly mirrors the
 * existing tests/main/repack-worker.spec.ts pattern and produces
 * byte-identical output to the 'both' branch of handleStartExport (which
 * is literally `runExport(...); runRepack(...)` with a shared `written`
 * Set — see src/main/ipc.ts:893-925).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import { runExport } from '../../src/main/image-worker.js';
import { runRepack, type AtlasOpts } from '../../src/main/repack-worker.js';
import type { ExportPlan } from '../../src/shared/types.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_PNG = path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png');
const BASELINE_PATH = path.resolve(REPO_ROOT, 'tests/fixtures/repack-baselines.json');
const EXPECTED_ATLAS_PATH = path.resolve(
  REPO_ROOT,
  'tests/fixtures/repack-expected/SIMPLE_TEST.atlas',
);
const SHOULD_UPDATE = process.env.UPDATE_FIXTURES === '1';

const DEFAULT_OPTS: AtlasOpts = {
  maxPageSize: 4096,
  allowRotation: false,
  padding: 2,
};

function sha(p: string): string {
  return createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

interface Baselines {
  _meta?: Record<string, string>;
  SIMPLE_TEST?: {
    loose?: Record<string, string>;
    atlas?: Record<string, string>;
  };
}

function loadBaselines(): Baselines {
  if (!fs.existsSync(BASELINE_PATH)) {
    if (SHOULD_UPDATE) {
      return { SIMPLE_TEST: { loose: {}, atlas: {} } };
    }
    throw new Error(
      `[REPACK-01] Baseline file missing: ${BASELINE_PATH}. ` +
        `Run \`UPDATE_FIXTURES=1 npx vitest run tests/main/repack.loose-parity.spec.ts\` to populate.`,
    );
  }
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as Baselines;
}

function saveBaselines(b: Baselines) {
  fs.mkdirSync(path.dirname(BASELINE_PATH), { recursive: true });
  fs.writeFileSync(BASELINE_PATH, JSON.stringify(b, null, 2) + '\n', 'utf8');
}

function makePlan(): ExportPlan {
  // Synthetic plan derived from SIMPLE_TEST.atlas region dims (CIRCLE 699×699,
  // SQUARE 1000×1000, TRIANGLE 833×759). All rows share the same sourcePath
  // (SIMPLE_TEST.png) so the test is self-contained — sharp resizes the
  // single atlas page PNG to each row's outW×outH, which is the canonical
  // test idiom used by tests/main/repack-worker.spec.ts:28-78.
  return {
    rows: [
      {
        sourcePath: FIXTURE_PNG,
        outPath: 'images/CIRCLE.png',
        sourceW: 699,
        sourceH: 699,
        outW: 699,
        outH: 699,
        effectiveScale: 1.0,
        attachmentNames: ['CIRCLE'],
      },
      {
        sourcePath: FIXTURE_PNG,
        outPath: 'images/SQUARE.png',
        sourceW: 1000,
        sourceH: 1000,
        outW: 1000,
        outH: 1000,
        effectiveScale: 1.0,
        attachmentNames: ['SQUARE'],
      },
      {
        sourcePath: FIXTURE_PNG,
        outPath: 'images/TRIANGLE.png',
        sourceW: 833,
        sourceH: 759,
        outW: 833,
        outH: 759,
        effectiveScale: 1.0,
        attachmentNames: ['TRIANGLE'],
      },
    ],
    excludedUnused: [],
    passthroughCopies: [],
    totals: { count: 3 },
  };
}

describe('REPACK-01 — Loose-mode SHA256 byte-identity (strictest phase gate)', () => {
  let tmpRoot: string;
  let outDir: string;
  beforeAll(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-loose-parity-'));
    // Use a deterministic outDir basename so deriveProjectName (which reads
    // basename(outDir)) yields 'SIMPLE_TEST' on every run — pinning the
    // atlas + page-PNG filenames to `SIMPLE_TEST.atlas` + `SIMPLE_TEST.png`.
    // Without this, the random tmp-dir name leaks into the SHA256 baselines
    // and they cannot round-trip.
    outDir = path.join(tmpRoot, 'SIMPLE_TEST');
    fs.mkdirSync(outDir, { recursive: true });
  });
  afterAll(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('loose-mode + atlas-mode SHA256 matches the committed baseline (or writes on UPDATE_FIXTURES)', async () => {
    const baselines = loadBaselines();
    baselines.SIMPLE_TEST = baselines.SIMPLE_TEST ?? { loose: {}, atlas: {} };
    baselines.SIMPLE_TEST.loose = baselines.SIMPLE_TEST.loose ?? {};
    baselines.SIMPLE_TEST.atlas = baselines.SIMPLE_TEST.atlas ?? {};

    const plan = makePlan();
    const written = new Set<string>();

    // 1. Loose mode — exact byte-equivalent to outputMode='loose' branch of
    //    handleStartExport. runExport writes images/CIRCLE.png + SQUARE.png
    //    + TRIANGLE.png into outDir.
    const looseSummary = await runExport(
      plan,
      outDir,
      () => {},
      () => false,
      true, // allowOverwrite — tmpDir is fresh but the second 'both' branch may overlap
      false, // sharpenEnabled
      written,
    );
    expect(looseSummary.errors).toEqual([]);
    expect(looseSummary.successes).toBe(3);

    // 2. Atlas mode in the same outDir — exact byte-equivalent to the
    //    outputMode='both' branch of handleStartExport (sequential after
    //    runExport, sharing `written`). Writes SIMPLE_TEST.atlas +
    //    SIMPLE_TEST.png (single page expected for this small fixture).
    const repackResult = await runRepack(
      plan,
      outDir,
      () => {},
      () => false,
      true,
      false,
      DEFAULT_OPTS,
      written,
    );
    expect(fs.existsSync(repackResult.atlasFile)).toBe(true);
    expect(repackResult.pageFiles.length).toBeGreaterThanOrEqual(1);

    // 3. Loose PNGs — compare each row's outPath SHA256.
    for (const row of plan.rows) {
      const outPath = path.join(outDir, row.outPath);
      expect(fs.existsSync(outPath), `loose output missing: ${row.outPath}`).toBe(true);
      const computed = sha(outPath);
      if (SHOULD_UPDATE) {
        baselines.SIMPLE_TEST.loose![row.outPath] = computed;
      } else {
        const expected = baselines.SIMPLE_TEST.loose![row.outPath];
        if (!expected) {
          throw new Error(
            `[REPACK-01] Baseline missing for ${row.outPath}. ` +
              `Run \`UPDATE_FIXTURES=1 npx vitest run tests/main/repack.loose-parity.spec.ts\` to populate.`,
          );
        }
        expect(
          computed,
          `[REPACK-01] Loose SHA256 drift for ${row.outPath}. Expected ${expected}, got ${computed}. ` +
            `Either fix the regression OR run \`npm run repack:refresh-baselines\` if the change is intentional.`,
        ).toBe(expected);
      }
    }

    // 4. Atlas .atlas — SHA256 + text-diff guard.
    const atlasPath = repackResult.atlasFile;
    expect(fs.existsSync(atlasPath)).toBe(true);
    const atlasSha = sha(atlasPath);
    const atlasBasename = path.basename(atlasPath);
    if (SHOULD_UPDATE) {
      baselines.SIMPLE_TEST.atlas![atlasBasename] = atlasSha;
      fs.mkdirSync(path.dirname(EXPECTED_ATLAS_PATH), { recursive: true });
      fs.copyFileSync(atlasPath, EXPECTED_ATLAS_PATH);
    } else {
      const expected = baselines.SIMPLE_TEST.atlas![atlasBasename];
      if (!expected) {
        throw new Error(
          `[REPACK-01] .atlas baseline missing for ${atlasBasename}. UPDATE_FIXTURES=1 to populate.`,
        );
      }
      expect(
        atlasSha,
        `[REPACK-01] .atlas SHA256 drift. Expected ${expected}, got ${atlasSha}. ` +
          `text-diff: \`diff ${atlasPath} ${EXPECTED_ATLAS_PATH}\``,
      ).toBe(expected);
      // Text-diff against committed expected file — primary developer-facing
      // debugging surface on failure (D-06 hybrid baseline storage).
      if (fs.existsSync(EXPECTED_ATLAS_PATH) && fs.statSync(EXPECTED_ATLAS_PATH).size > 0) {
        expect(fs.readFileSync(atlasPath, 'utf8')).toBe(
          fs.readFileSync(EXPECTED_ATLAS_PATH, 'utf8'),
        );
      }
    }

    // 5. Atlas page PNG(s) — compare every page PNG SHA256.
    for (const pagePath of repackResult.pageFiles) {
      expect(fs.existsSync(pagePath)).toBe(true);
      const basename = path.basename(pagePath);
      const computed = sha(pagePath);
      if (SHOULD_UPDATE) {
        baselines.SIMPLE_TEST.atlas![basename] = computed;
      } else {
        const expected = baselines.SIMPLE_TEST.atlas![basename];
        if (!expected) {
          throw new Error(`[REPACK-01] page PNG baseline missing for ${basename}.`);
        }
        expect(
          computed,
          `[REPACK-01] page PNG SHA256 drift for ${basename}. Expected ${expected}, got ${computed}.`,
        ).toBe(expected);
      }
    }

    if (SHOULD_UPDATE) {
      baselines._meta = {
        ...baselines._meta,
        generatedAt: new Date().toISOString(),
        note:
          'Regenerated by UPDATE_FIXTURES=1 vitest run. ' +
          'Run `npm run repack:refresh-baselines` to also bump sharp/maxrects-packer/spine-core versions.',
      };
      saveBaselines(baselines);
    }
  });
});
