/**
 * Phase 51 Plan 01 — the BATCH faithfulness / rollback / cancel proof
 * (EXPORT-04 SC#1 + SC#2, D-07 continue-on-error, D-09 between-variants cancel,
 * L-04 dual-runtime × dual-mode).
 *
 * WHY SC#2 IS BY CONSTRUCTION: handleExportVariantBatch loops the SAME un-guarded
 * exportOneVariant body the single-scale handleExportVariant runs (Plan 01 Task 1).
 * This proof DEMONSTRATES that equivalence empirically: for each scale, the batch
 * output folder is byte-identical to the single-scale path output for that scale.
 *
 * A1 PNG-DETERMINISM CAVEAT (RESEARCH §Q7): we compare the {NAME}.json AND
 * {NAME}.atlas bytes (both deterministic — text artifacts produced by our own
 * writers). We do NOT byte-compare the rendered PNGs: sharp/libvips PNG encoding
 * is not guaranteed byte-stable across two separate composite passes (timestamps,
 * filter heuristics). Existence + the .json/.atlas byte-identity is the faithful
 * SC#2 evidence; the per-region sizing is already proven byte-faithful by
 * Phase-49's variant-dropin-faithful + variant-package-layout suites that this
 * batch reuses verbatim.
 *
 * MATRIX (L-04): (4.2 SIMPLE_TEST + 4.3 SLIDER-01) × (atlas-source + atlas-less),
 * honoring the documented 4.3-atlas-less = atlas-mode-only deviation
 * (variant-package-layout.spec.ts:120-135): that cell LOADS atlas-source (the
 * loader cannot synthesize an atlas-less load with no images/ dir) and EXPORTS
 * atlas-mode-only (the page-extraction fallback route).
 *
 * D-06a #3 — NO silent skip: each matrix cell hard-fails LOUD with a clear
 * `fixture not found` message if the rig .json is absent.
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
  handleExportVariantBatch,
  formatScaleToken,
  setVariantBatchCancelRequested,
} from '../../src/main/variant-export.js';
import type { SkeletonSummary } from '../../src/shared/types.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

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
  // the page-extraction fallback.
  loadMode: 'atlas-source' | 'atlas-less';
  runtime: '4.2' | '4.3';
  // The single mode used for the byte-identity comparison. 'both' for the all-3-mode
  // cells (so an .atlas IS written and comparable); 'atlas' for the 4.3 atlas-less
  // cell (atlas-mode-only deviation).
  compareMode: Mode;
}

const MATRIX: readonly MatrixCell[] = [
  // 4.2 SIMPLE_PROJECT HAS images/ → atlas-less can run all three modes.
  {
    rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST',
    name: 'SIMPLE_TEST',
    mode: 'atlas-source',
    loadMode: 'atlas-source',
    runtime: '4.2',
    compareMode: 'both',
  },
  {
    rig: 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST',
    name: 'SIMPLE_TEST',
    mode: 'atlas-less',
    loadMode: 'atlas-less',
    runtime: '4.2',
    compareMode: 'both',
  },
  // 4.3 SLIDER_4_3 HAS a packed PNG → atlas-source runs all three.
  {
    rig: 'fixtures/SLIDER_4_3/SLIDER-01',
    name: 'SLIDER-01',
    mode: 'atlas-source',
    loadMode: 'atlas-source',
    runtime: '4.3',
    compareMode: 'both',
  },
  // 4.3 SLIDER_4_3 has NO images/ dir → atlas-mode-only deviation (atlas-page
  // extraction fallback). LOAD atlas-source by necessity; EXPORT atlas-mode-only.
  {
    rig: 'fixtures/SLIDER_4_3/SLIDER-01',
    name: 'SLIDER-01',
    mode: 'atlas-less',
    loadMode: 'atlas-source',
    runtime: '4.3',
    compareMode: 'atlas',
  },
] as const;

/** Build a real SkeletonSummary headlessly — same chain the existing main tests
 *  use (variant-package-layout.spec.ts:143-151). */
function buildCellSummary(cell: MatrixCell): SkeletonSummary {
  const skeletonPath = path.resolve(REPO_ROOT, cell.rig + '.json');
  const load =
    cell.loadMode === 'atlas-less'
      ? loadSkeleton(skeletonPath, { loaderMode: 'atlas-less' })
      : loadSkeleton(skeletonPath);
  const sampled = sampleSkeleton(load);
  return buildSummary(load, sampled, 0);
}

function readBytes(p: string): Buffer | null {
  return fs.existsSync(p) ? fs.readFileSync(p) : null;
}

// ---------------------------------------------------------------------------
// Block 1 — byte-identity (matrix): batch output ≡ N× single-call (JSON + atlas)
// over the dual-runtime × dual-mode matrix (EXPORT-04 SC#1/SC#2, L-04).
// ---------------------------------------------------------------------------
describe('handleExportVariantBatch — byte-identity (matrix): batch ≡ single-scale per scale', () => {
  let batchDir: string;
  let singleDir: string;
  beforeEach(() => {
    batchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-batch-A-'));
    singleDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-batch-B-'));
  });
  afterEach(() => {
    fs.rmSync(batchDir, { recursive: true, force: true });
    fs.rmSync(singleDir, { recursive: true, force: true });
  });

  const SCALES = [0.5, 0.36];

  for (const cell of MATRIX) {
    const cellLabel = `${cell.name} [${cell.runtime} / ${cell.mode}]`;

    // D-06a #3 — loud-fail if the committed fixture is absent (no silent skip).
    it(`fixture present: ${cellLabel}`, () => {
      const jsonPath = path.resolve(REPO_ROOT, cell.rig + '.json');
      expect(fs.existsSync(jsonPath), `fixture not found: ${cell.rig}.json`).toBe(true);
    });

    it(`matrix cell ${cell.runtime}/${cell.mode}: each batch variant is byte-identity to the single-scale path (JSON + atlas)`, async () => {
      const summary = buildCellSummary(cell);
      const mode = cell.compareMode;

      // 1. Batch run: N scales into batchDir in ONE call.
      const batch = await handleExportVariantBatch(
        fakeEvt,
        summary,
        SCALES,
        batchDir,
        false,
        false,
        mode,
        defaultAtlasOpts,
      );
      expect(batch.results.length, 'one result per scale').toBe(SCALES.length);
      for (const r of batch.results) {
        expect(
          ['exported', 'exported-with-errors'].includes(r.status),
          `batch variant @${r.token}x should land for ${cellLabel}; got status=${r.status} reason=${r.reason ?? ''}`,
        ).toBe(true);
      }

      // 2. Single-scale runs: each scale individually into singleDir.
      for (const s of SCALES) {
        const res = await handleExportVariant(
          fakeEvt,
          summary,
          s,
          singleDir,
          false,
          false,
          mode,
          defaultAtlasOpts,
        );
        expect(
          res.ok,
          `single-scale @${formatScaleToken(s)}x should succeed for ${cellLabel}; got: ${
            res.ok ? 'ok' : (res as { error: { message: string } }).error.message
          }`,
        ).toBe(true);
      }

      // 3. Per scale: compare {NAME}.json (always) + {NAME}.atlas (atlas/both).
      const writesAtlas = mode === 'atlas' || mode === 'both';
      for (const s of SCALES) {
        const token = formatScaleToken(s);
        const folder = `${cell.name}@${token}x`;

        const aJson = readBytes(path.join(batchDir, folder, `${cell.name}.json`));
        const bJson = readBytes(path.join(singleDir, folder, `${cell.name}.json`));
        expect(aJson, `batch JSON missing for ${cellLabel} @${token}x`).not.toBeNull();
        expect(bJson, `single JSON missing for ${cellLabel} @${token}x`).not.toBeNull();
        expect(
          aJson,
          `batch vs single JSON DIFFER for ${cellLabel} @${token}x — SC#2 violated`,
        ).toEqual(bJson);

        if (writesAtlas) {
          const aAtlas = readBytes(path.join(batchDir, folder, `${cell.name}.atlas`));
          const bAtlas = readBytes(path.join(singleDir, folder, `${cell.name}.atlas`));
          expect(aAtlas, `batch .atlas missing for ${cellLabel} @${token}x`).not.toBeNull();
          expect(bAtlas, `single .atlas missing for ${cellLabel} @${token}x`).not.toBeNull();
          expect(
            aAtlas,
            `batch vs single .atlas DIFFER for ${cellLabel} @${token}x — SC#2 violated`,
          ).toEqual(bAtlas);
        }
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Block 2 — continue-on-error (D-07): a forced-fail folder rolls back its OWN
// written Set; the loop continues and returns a result per scale (Pitfall 4).
// ---------------------------------------------------------------------------
describe('handleExportVariantBatch — continue-on-error (D-07)', () => {
  let tmp: string;
  const NAME = 'SIMPLE_TEST';
  const skeletonPath = path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

  function simpleSummary(): SkeletonSummary {
    const load = loadSkeleton(skeletonPath);
    const sampled = sampleSkeleton(load);
    return buildSummary(load, sampled, 0);
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-batch-coe-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('continue-on-error: a forced-fail atlas batch rolls back every failed folder and still returns a result per scale', async () => {
    const summary = simpleSummary();
    const SCALES = [0.5, 0.36, 0.25];
    // maxPageSize:64 — below the smallest scaled region on the capped-at-1000
    // SIMPLE_TEST fixture → runRepack throws oversize for EVERY scale (the
    // Phase-49 V4 idiom; localized `as` cast for the out-of-union value).
    const batch = await handleExportVariantBatch(
      fakeEvt,
      summary,
      SCALES,
      tmp,
      false,
      false,
      'atlas',
      { maxPageSize: 64 as unknown as 1024, allowRotation: false, padding: 2 },
    );

    // The call returned an envelope (never threw across the IPC boundary).
    expect(batch.ok).toBe(true);
    expect(batch.results.length, 'a result per scale even when all fail').toBe(SCALES.length);
    for (const r of batch.results) {
      expect(r.status, `every forced-oversize variant must be failed (got ${r.status})`).toBe('failed');
    }

    // Each failed variant rolled back its OWN written Set → no orphan {NAME}.json,
    // no partial .atlas/.png anywhere (Pitfall 4 — no batch-wide Set deleting
    // earlier work).
    for (const s of SCALES) {
      const folder = path.join(tmp, `${NAME}@${formatScaleToken(s)}x`);
      expect(
        fs.existsSync(path.join(folder, `${NAME}.json`)),
        `orphan {NAME}.json survived rollback for @${formatScaleToken(s)}x`,
      ).toBe(false);
      if (fs.existsSync(folder)) {
        const remaining = fs
          .readdirSync(folder)
          .filter((n) => n.endsWith('.atlas') || n.endsWith('.png') || n.endsWith('.json'));
        expect(remaining, `partial artifacts survived rollback in @${formatScaleToken(s)}x`).toEqual([]);
      }
    }
  });

  it('continue-on-error: a loose batch of valid scales lands every folder', async () => {
    const summary = simpleSummary();
    const SCALES = [0.5, 0.36];
    const batch = await handleExportVariantBatch(
      fakeEvt,
      summary,
      SCALES,
      tmp,
      false,
      false,
      'loose',
      defaultAtlasOpts,
    );
    expect(batch.results.length).toBe(SCALES.length);
    for (const s of SCALES) {
      const idx = batch.results.findIndex((r) => r.token === formatScaleToken(s));
      expect(batch.results[idx].status, `@${formatScaleToken(s)}x should be exported`).toBe('exported');
      expect(
        fs.existsSync(path.join(tmp, `${NAME}@${formatScaleToken(s)}x`, `${NAME}.json`)),
        `landed folder missing for @${formatScaleToken(s)}x`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Block 3 — cancel (D-09): stale-flag reset at batch start (Pitfall 5) +
// between-variants skip (in-flight variant intact, remaining 'skipped').
// ---------------------------------------------------------------------------
describe('handleExportVariantBatch — cancel (D-09)', () => {
  let tmp: string;
  const NAME = 'SIMPLE_TEST';
  const skeletonPath = path.resolve(REPO_ROOT, 'fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');

  function simpleSummary(): SkeletonSummary {
    const load = loadSkeleton(skeletonPath);
    const sampled = sampleSkeleton(load);
    return buildSummary(load, sampled, 0);
  }

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-batch-cancel-'));
  });
  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    // Defense — ensure no test leaves the module flag set for the next describe.
    // (handleExportVariantBatch resets it at start, but be hygienic.)
  });

  it('cancel: a stale flag is reset at batch start (Pitfall 5) — a 1-scale batch still exports', async () => {
    const summary = simpleSummary();
    // Pre-set the flag to simulate a stale `true` from a prior cancelled batch.
    setVariantBatchCancelRequested();
    const batch = await handleExportVariantBatch(
      fakeEvt,
      summary,
      [0.5],
      tmp,
      false,
      false,
      'loose',
      defaultAtlasOpts,
    );
    expect(batch.results.length).toBe(1);
    expect(
      batch.results[0].status,
      'a stale cancel flag must be reset at batch start → the scale still exports',
    ).toBe('exported');
    expect(
      fs.existsSync(path.join(tmp, `${NAME}@${formatScaleToken(0.5)}x`, `${NAME}.json`)),
      'the only variant folder should exist (flag was reset)',
    ).toBe(true);
  });

  it('cancel: setting the flag during variant 0 skips variant 1 and leaves variant 0 intact', async () => {
    const summary = simpleSummary();
    const SCALES = [0.5, 0.36];

    // A sender that flips the cancel flag the FIRST time it fires. The batch loop
    // emits 'variant:batch-progress' for variantIndex 0 AFTER the top-of-loop
    // cancel check for i=0 but BEFORE exportOneVariant(scale 0) — so scale 0 still
    // exports, and the check at the top of iteration 1 sees the flag → scale 1 is
    // skipped. Deterministic.
    let fired = false;
    const cancelOnceEvt = {
      sender: {
        send: () => {
          if (!fired) {
            fired = true;
            setVariantBatchCancelRequested();
          }
        },
      },
    };

    const batch = await handleExportVariantBatch(
      cancelOnceEvt,
      summary,
      SCALES,
      tmp,
      false,
      false,
      'loose',
      defaultAtlasOpts,
    );

    expect(batch.results.length).toBe(2);
    expect(batch.results[0].status, 'variant 0 must export (flag checked before its marker)').toBe('exported');
    expect(batch.results[1].status, 'variant 1 must be skipped (flag set between variants)').toBe('skipped');

    // Variant 0's folder exists; variant 1's folder is absent (never started).
    expect(
      fs.existsSync(path.join(tmp, `${NAME}@${formatScaleToken(0.5)}x`, `${NAME}.json`)),
      'variant 0 folder should be intact',
    ).toBe(true);
    expect(
      fs.existsSync(path.join(tmp, `${NAME}@${formatScaleToken(0.36)}x`)),
      'variant 1 folder should be absent (skipped before start)',
    ).toBe(false);
  });
});
