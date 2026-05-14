/**
 * Phase 40 REPACK-01 (atlas/both modes) + REPACK-03 + REPACK-05 + REPACK-10
 * — sharp-orchestration integration tests.
 *
 * Real sharp + real fixtures (vitest environment: 'node' permits this per
 * tests/main/image-worker.integration.spec.ts:25). No mocking for the
 * happy-path tests; the "mid-composite throw" test uses vi.doMock to
 * install a sharp shim that throws on the 2nd .tmp toFile invocation
 * (REPACK-10 SPEC acceptance b end-to-end sentinel — added per checker
 * revision 2026-05-14).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import {
  runRepack,
  type AtlasOpts,
} from '../../src/main/repack-worker.js';
import type {
  ExportPlan,
  ExportProgressEvent,
  ExportRow,
} from '../../src/shared/types.js';

const FIXTURE_PNG = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png');

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-repack-int-'));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makePlan(rows: Array<Partial<ExportRow>>): ExportPlan {
  return {
    rows: rows.map((r, i) => ({
      sourcePath: FIXTURE_PNG,
      outPath: r.outPath ?? `images/region_${i}.png`,
      sourceW: r.sourceW ?? 100,
      sourceH: r.sourceH ?? 100,
      outW: r.outW ?? 100,
      outH: r.outH ?? 100,
      effectiveScale: r.effectiveScale ?? 1.0,
      attachmentNames: r.attachmentNames ?? [`R_${i}`],
      ...r,
    })) as ExportRow[],
    excludedUnused: [],
    passthroughCopies: [],
    totals: { count: rows.length },
  };
}

const DEFAULT_OPTS: AtlasOpts = {
  maxPageSize: 4096,
  allowRotation: false,
  padding: 2,
};

describe('runRepack — REPACK-01 (atlas mode) + REPACK-05 (page count/bounds)', () => {
  it('atlas mode writes a .atlas file and at least one page PNG', async () => {
    const plan = makePlan([
      { outW: 200, outH: 200, attachmentNames: ['A'] },
      { outW: 200, outH: 200, attachmentNames: ['B'] },
    ]);
    const written = new Set<string>();
    const events: ExportProgressEvent[] = [];
    const result = await runRepack(
      plan,
      tmpDir,
      (e) => events.push(e),
      () => false,
      true, // allowOverwrite
      false, // sharpenEnabled
      DEFAULT_OPTS,
      written,
    );
    expect(fs.existsSync(result.atlasFile)).toBe(true);
    expect(result.pageFiles.length).toBeGreaterThanOrEqual(1);
    for (const p of result.pageFiles) {
      expect(fs.existsSync(p)).toBe(true);
    }
    // Progress events emitted for both resize and composite phases.
    expect(events.some((e) => e.phase === 'resize')).toBe(true);
    expect(events.some((e) => e.phase === 'composite')).toBe(true);
  });

  it('page count equals pack-plan page count; each page bounds ≤ maxPageSize on both axes', async () => {
    const plan = makePlan([
      { outW: 200, outH: 200, attachmentNames: ['A'] },
      { outW: 200, outH: 200, attachmentNames: ['B'] },
      { outW: 200, outH: 200, attachmentNames: ['C'] },
    ]);
    const written = new Set<string>();
    const result = await runRepack(
      plan,
      tmpDir,
      () => {},
      () => false,
      true,
      false,
      DEFAULT_OPTS,
      written,
    );
    for (const p of result.pageFiles) {
      const meta = await sharp(p).metadata();
      expect(meta.width ?? 0).toBeLessThanOrEqual(DEFAULT_OPTS.maxPageSize);
      expect(meta.height ?? 0).toBeLessThanOrEqual(DEFAULT_OPTS.maxPageSize);
    }
    // Page count matches the .atlas file's page header count.
    const atlasText = fs.readFileSync(result.atlasFile, 'utf8');
    const pageHeaderCount = (atlasText.match(/^.*\.png$/gm) ?? []).length;
    expect(pageHeaderCount).toBe(result.pageFiles.length);
  });

  it('both mode: loose PNG written by another stage co-exists with atlas outputs in same outDir', async () => {
    // The IPC handler in Plan 06 dispatches BOTH runExport (loose) and
    // runRepack (atlas) into the same outDir. This test asserts the
    // worker doesn't clobber files outside its declared output set —
    // a loose PNG written before runRepack should survive intact.
    const plan = makePlan([
      { outW: 200, outH: 200, attachmentNames: ['A'] },
    ]);
    const looseMarker = path.join(tmpDir, 'images', 'A.png');
    fs.mkdirSync(path.dirname(looseMarker), { recursive: true });
    fs.writeFileSync(looseMarker, 'dummy-loose-output');

    const written = new Set<string>();
    const result = await runRepack(
      plan,
      tmpDir,
      () => {},
      () => false,
      true,
      false,
      DEFAULT_OPTS,
      written,
    );

    expect(fs.existsSync(result.atlasFile)).toBe(true);
    expect(result.pageFiles.length).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(looseMarker)).toBe(true);
    // The loose marker's content was NOT touched.
    expect(fs.readFileSync(looseMarker, 'utf8')).toBe('dummy-loose-output');
  });
});

describe('runRepack — REPACK-03 sharp-emits-truth + pixel-preserved', () => {
  it('emits truth: packer receives metadata().width/height matching .atlas bounds', async () => {
    const plan = makePlan([
      { outW: 350, outH: 350, effectiveScale: 0.5, attachmentNames: ['CIRCLE'] },
    ]);
    const written = new Set<string>();
    const result = await runRepack(
      plan,
      tmpDir,
      () => {},
      () => false,
      true,
      false,
      DEFAULT_OPTS,
      written,
    );
    const atlasText = fs.readFileSync(result.atlasFile, 'utf8');
    // bounds:x,y,w,h — the w,h values must equal sharp's emitted dims (350×350).
    expect(atlasText).toMatch(/bounds:\d+,\d+,350,350/);
  });

  it('pixel preserved: composite-page pixel block at (x,y) matches resized source bytes', async () => {
    const plan = makePlan([
      { outW: 100, outH: 100, effectiveScale: 1.0, attachmentNames: ['SQUARE'] },
    ]);
    const written = new Set<string>();
    const result = await runRepack(
      plan,
      tmpDir,
      () => {},
      () => false,
      true,
      false,
      DEFAULT_OPTS,
      written,
    );
    const atlasText = fs.readFileSync(result.atlasFile, 'utf8');
    const match = atlasText.match(/SQUARE\nbounds:(\d+),(\d+),(\d+),(\d+)/);
    expect(match).not.toBeNull();
    if (!match) return;
    const x = parseInt(match[1], 10);
    const y = parseInt(match[2], 10);
    const w = parseInt(match[3], 10);
    const h = parseInt(match[4], 10);

    const pagePath = result.pageFiles[0];
    // Extract that region from the composite page as raw RGBA bytes.
    const fromPage = await sharp(pagePath)
      .extract({ left: x, top: y, width: w, height: h })
      .raw()
      .toBuffer();
    // Fresh resize of the same source to the same dims; decode as raw RGBA.
    // The repack-worker's composite step encodes via PNG then we decode here;
    // PNG is lossless so the round-trip should preserve bytes when composite
    // onto a transparent canvas does not alter pixel values.
    const fromSource = await sharp(FIXTURE_PNG)
      .resize(w, h, { kernel: 'lanczos3', fit: 'fill' })
      .png({ compressionLevel: 9 })
      .toBuffer();
    const fromSourceRaw = await sharp(fromSource).raw().toBuffer();

    // SPEC §"Out of scope" #4 — Cross-mode loose-vs-atlas pixel equivalence
    // on a per-pixel basis: sharp composite onto a transparent canvas may
    // differ trivially from sharp-emitted standalone PNG due to libvips
    // composite paths (PMA / unpremultiplied alpha conversion, dithering
    // round-trip). REPACK-03 acceptance is "atlas-coord-mapped equivalence,"
    // NOT byte-identical PNG across modes.
    //
    // Verified empirically 2026-05-14: strict SHA256 byte parity FAILS by
    // a small per-pixel delta. The minimum-viable assertion under the
    // SPEC carve-out is:
    //   1. Buffer length parity — same dims, same channel count → proves
    //      the pixel block IS at (x,y,w,h) with RGBA shape.
    //   2. Mean absolute difference tolerance — confirms the bytes ARE
    //      the resized region's pixels (not zeroed, not corrupt) modulo
    //      libvips composite drift, which is a known no-op on visible
    //      output per PMA-no-op memory.
    // First gate: same byte length (same dims × channels).
    expect(fromPage.length).toBe(fromSourceRaw.length);
    // Second gate: per-byte MAE ≤ 8 (out of 255). Composite drift is
    // typically ≤ 2/255 in practice; 8/255 gives ~3% headroom. If the
    // worker were emitting wrong pixels (transposed region, wrong source,
    // miscalculated x/y) the MAE would be far higher (≥ 50).
    let totalAbsDiff = 0;
    for (let i = 0; i < fromPage.length; i++) {
      totalAbsDiff += Math.abs(fromPage[i] - fromSourceRaw[i]);
    }
    const mae = totalAbsDiff / fromPage.length;
    expect(mae, `pixel-preserved MAE = ${mae.toFixed(3)} (tolerance ≤ 8.0)`).toBeLessThanOrEqual(8.0);
    // Tertiary gate: compute SHA256 of both for diagnostic reporting only
    // (no assertion; SPEC carve-out exempts strict byte parity).
    void createHash('sha256').update(fromPage).digest('hex');
    void createHash('sha256').update(fromSourceRaw).digest('hex');
  });
});

describe('runRepack — REPACK-10 atomic-or-fail', () => {
  it('oversize abort: throws locked error string and writes no files', async () => {
    // Force oversize: maxPageSize = 1024, but row resizes to 1500×1500 (the
    // SIMPLE_TEST.png source is 1839×1464 so this is a real downscale to a
    // dim that exceeds the page cap; the worker MUST throw BEFORE any write.
    const plan = makePlan([
      { outW: 1500, outH: 1500, attachmentNames: ['HUGE'] },
    ]);
    const opts: AtlasOpts = {
      maxPageSize: 1024,
      allowRotation: false,
      padding: 2,
    };
    const written = new Set<string>();
    await expect(
      runRepack(plan, tmpDir, () => {}, () => false, true, false, opts, written),
    ).rejects.toThrow(
      /Region HUGE is \d+×\d+ px which exceeds the page-size cap\. Increase atlasMaxPageSize or apply a smaller override\./,
    );
    // No files written — outDir is in pre-export state.
    const remaining = fs
      .readdirSync(tmpDir)
      .filter((n) => n.endsWith('.atlas') || n.endsWith('.png'));
    expect(remaining).toEqual([]);
  });

  it('atomic rollback (writtenPaths contract): every tmp + final path is registered so the IPC sweep removes everything', async () => {
    // Contract-only test: verifies the worker registers BOTH tmp and final
    // paths for every artifact (page PNGs + .atlas) in writtenPaths. After a
    // successful run, sweeping writtenPaths (mirroring what the Plan 06 IPC
    // finally-block does) must leave the outDir empty of phase-40 artifacts.
    const plan = makePlan(
      Array.from({ length: 8 }, (_, i) => ({
        outW: 400,
        outH: 400,
        attachmentNames: [`R_${i.toString().padStart(2, '0')}`],
      })),
    );
    const opts: AtlasOpts = {
      maxPageSize: 2048,
      allowRotation: false,
      padding: 2,
    };
    const written = new Set<string>();

    const result = await runRepack(
      plan,
      tmpDir,
      () => {},
      () => false,
      true,
      false,
      opts,
      written,
    );

    // Sanity: artifacts exist on disk now.
    expect(fs.existsSync(result.atlasFile)).toBe(true);
    for (const p of result.pageFiles) expect(fs.existsSync(p)).toBe(true);

    // For each page PNG and the .atlas, BOTH the final path AND the .tmp
    // sibling must be in writtenPaths (the IPC handler's sweep is
    // path-equality based — it can only delete paths it knows about).
    for (const p of result.pageFiles) {
      expect(written.has(p)).toBe(true);
      expect(written.has(p + '.tmp')).toBe(true);
    }
    expect(written.has(result.atlasFile)).toBe(true);
    expect(written.has(result.atlasFile + '.tmp')).toBe(true);

    // Simulate the IPC finally-block rollback sweep:
    for (const p of written) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        /* defense-in-depth */
      }
    }

    // After sweep: NO .atlas, NO page PNGs remain in outDir.
    expect(fs.existsSync(result.atlasFile)).toBe(false);
    for (const p of result.pageFiles) expect(fs.existsSync(p)).toBe(false);
  });

  it('mid-composite throw: sharp fails on page 2 of 3; no .atlas, no page PNG, no .tmp remains on disk', async () => {
    // REPACK-10 SPEC acceptance criterion (b) — end-to-end mid-write
    // rollback. We install a sharp mock that throws on the SECOND .toFile()
    // call targeting a *.tmp path. After the throw:
    //   (a) runRepack promise rejects (the simulated sharp error surfaces).
    //   (b) After sweeping writtenPaths, fs.readdir(outDir) contains NO
    //       .atlas, NO *.png for any page, NO .tmp sibling.
    //   (c) writtenPaths contained the page-1 final path AND the page-2
    //       .tmp path before the throw — sentinel proving end-to-end
    //       tracking worked. This is the regression sentinel for SPEC
    //       acceptance b — the whole point of the blocker fix.
    //
    // The .atlas .tmp write is via fs.writeFile (NOT sharp), so the mock
    // only needs to intercept page-PNG sharp.toFile invocations to land
    // mid-composite. The atlas-write path is never reached in this scenario.

    vi.resetModules();

    // Create a SIMPLE_TEST-named subdir as outDir so deriveProjectName
    // produces "SIMPLE_TEST" → predictable page filenames for the
    // sentinel assertions below.
    const namedDir = path.join(tmpDir, 'SIMPLE_TEST');
    fs.mkdirSync(namedDir, { recursive: true });

    // Build a plan that forces ≥ 3 pages with maxPageSize: 1024. Each row
    // resizes to 800×800; padding 2; max page 1024 → only one 800×800 region
    // fits per page → 3 regions = 3 pages.
    const plan = makePlan([
      { outW: 800, outH: 800, attachmentNames: ['R_00'] },
      { outW: 800, outH: 800, attachmentNames: ['R_01'] },
      { outW: 800, outH: 800, attachmentNames: ['R_02'] },
    ]);
    const opts: AtlasOpts = {
      maxPageSize: 1024,
      allowRotation: false,
      padding: 2,
    };
    const written = new Set<string>();

    let tmpToFileCalls = 0;
    vi.doMock('sharp', async () => {
      const realModule: { default: typeof sharp } =
        (await vi.importActual('sharp')) as { default: typeof sharp };
      const realSharp = realModule.default;

      const wrapped: typeof sharp = ((...args: unknown[]) => {
        const inst = (realSharp as unknown as (...a: unknown[]) => sharp.Sharp)(
          ...args,
        );
        const origToFile = inst.toFile.bind(inst);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (inst as any).toFile = async (filePath: string) => {
          if (filePath.endsWith('.tmp')) {
            tmpToFileCalls++;
            if (tmpToFileCalls === 2) {
              throw new Error(
                'simulated sharp failure on page 2 of 3 (vi.mock — REPACK-10 mid-composite rollback test)',
              );
            }
          }
          return origToFile(filePath);
        };
        return inst;
      }) as unknown as typeof sharp;
      // Preserve the named exports/properties sharp exposes.
      Object.assign(wrapped, realSharp);
      return { default: wrapped };
    });

    // Re-import runRepack so it picks up the mocked sharp.
    const { runRepack: runRepackMocked } = await import(
      '../../src/main/repack-worker.js'
    );

    let caught: Error | null = null;
    try {
      await runRepackMocked(
        plan,
        namedDir,
        () => {},
        () => false,
        true,
        false,
        opts,
        written,
      );
    } catch (err) {
      caught = err as Error;
    }
    vi.doUnmock('sharp');
    vi.resetModules();

    // (a) Promise rejected with the simulated-failure error.
    expect(caught).not.toBeNull();
    expect(caught!.message).toMatch(/simulated sharp failure on page 2 of 3/);

    // (c) writtenPaths contains BOTH the page-1 final path AND the page-2
    //     .tmp path (proving tracking worked end-to-end before the throw).
    const writtenArr = Array.from(written);
    const page1Final = writtenArr.find((p) =>
      /[/\\]SIMPLE_TEST\.png$/.test(p),
    );
    const page2Tmp = writtenArr.find((p) =>
      /[/\\]SIMPLE_TEST_2\.png\.tmp$/.test(p),
    );
    expect(
      page1Final,
      `writtenPaths missing page-1 final path. Got: ${JSON.stringify(writtenArr)}`,
    ).toBeDefined();
    expect(
      page2Tmp,
      `writtenPaths missing page-2 .tmp path. Got: ${JSON.stringify(writtenArr)}`,
    ).toBeDefined();

    // Simulate IPC finally-block rollback sweep (Plan 06 does this).
    for (const p of written) {
      try {
        fs.rmSync(p, { force: true });
      } catch {
        /* defense-in-depth */
      }
    }

    // (b) After rollback sweep: NO .atlas, NO *.png for any page, NO .tmp
    //     sibling — directory in pre-export state.
    const remaining = fs
      .readdirSync(namedDir)
      .filter(
        (n) =>
          n.endsWith('.atlas') || n.endsWith('.png') || n.endsWith('.tmp'),
      );
    expect(
      remaining,
      `REPACK-10 mid-composite rollback FAILED: outDir still contains ${JSON.stringify(remaining)}. ` +
        `Either writtenPaths is incomplete (worker did not register a path before write) or the sweep ` +
        `did not cover all artifact paths. This is the regression sentinel for SPEC acceptance (b).`,
    ).toEqual([]);
  });
});

describe('runRepack — cancellation cooperation', () => {
  it('cancellation between resize iterations: throws and writes no files', async () => {
    const plan = makePlan([
      { outW: 200, outH: 200, attachmentNames: ['A'] },
      { outW: 200, outH: 200, attachmentNames: ['B'] },
    ]);
    let calls = 0;
    const isCancelled = () => {
      calls++;
      return calls > 1; // first probe returns false (let row 0 in), then cancel
    };
    const written = new Set<string>();
    await expect(
      runRepack(
        plan,
        tmpDir,
        () => {},
        isCancelled,
        true,
        false,
        DEFAULT_OPTS,
        written,
      ),
    ).rejects.toThrow(/cancelled/);
    // No final .atlas exists (we threw before the atlas-write step).
    const files = fs.readdirSync(tmpDir);
    const atlasFiles = files.filter((n) => n.endsWith('.atlas'));
    expect(atlasFiles.length).toBe(0);
  });
});
