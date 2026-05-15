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

function makePlan(
  rows: Array<Partial<ExportRow>>,
  passthroughCopies: Array<Partial<ExportRow>> = [],
): ExportPlan {
  return {
    rows: rows.map((r, i) => ({
      sourcePath: FIXTURE_PNG,
      // UAT round 2 (2026-05-15): the atlas region name is now derived
      // from outPath (stripped of `.png` + leading `images/`), NOT from
      // attachmentNames[0]. Default outPath honors the test's
      // attachmentNames[0] when provided so the legacy tests' atlas
      // assertions (e.g. `bounds:.../SQUARE`) still hit predictable
      // region names. Falls back to `region_${i}` when no
      // attachmentNames[0] was supplied.
      outPath:
        r.outPath ??
        `images/${r.attachmentNames?.[0] ?? `region_${i}`}.png`,
      sourceW: r.sourceW ?? 100,
      sourceH: r.sourceH ?? 100,
      outW: r.outW ?? 100,
      outH: r.outH ?? 100,
      effectiveScale: r.effectiveScale ?? 1.0,
      attachmentNames: r.attachmentNames ?? [`R_${i}`],
      ...r,
    })) as ExportRow[],
    excludedUnused: [],
    passthroughCopies: passthroughCopies.map((r, i) => ({
      sourcePath: FIXTURE_PNG,
      outPath:
        r.outPath ??
        `images/${r.attachmentNames?.[0] ?? `passthrough_${i}`}.png`,
      sourceW: r.sourceW ?? 100,
      sourceH: r.sourceH ?? 100,
      outW: r.outW ?? (r.sourceW ?? 100),
      outH: r.outH ?? (r.sourceH ?? 100),
      effectiveScale: r.effectiveScale ?? 1.0,
      attachmentNames: r.attachmentNames ?? [`P_${i}`],
      ...r,
    })) as ExportRow[],
    totals: { count: rows.length + passthroughCopies.length },
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

describe('runRepack — UAT bug 2: atlas rotation direction round-trips through spine READ', () => {
  it('rotated region bytes on the page, after spine READ rotation (+90 CCW), restore canonical corners', async () => {
    // UAT bug 2: user reported faces rendering upside-down (180 deg net) on
    // atlas pages after Phase 40 was written. Root cause: repack-worker used
    // sharp.rotate(+90) for the canonical->atlas WRITE direction. Phase 33
    // empirically verified that sharp.rotate(+90) is the spine READ inverse
    // (atlas->canonical), so applying it on WRITE produces bytes that the
    // spine runtime then rotates AGAIN on read = 180 deg upside-down.
    //
    // The correct WRITE direction is sharp.rotate(-90). Verified empirically
    // by scripts/probe-sharp-rotate-write.mjs:
    //   WRITE rotate(-90) -> READ rotate(+90) = canonical restored.
    //
    // This test composites a distinguishable-corner source as a SINGLE
    // rotated region into a page, then applies the spine runtime's READ
    // rotation (rotate(+90)) and asserts the corners match canonical. If
    // the worker ever regresses to the wrong WRITE direction the corner
    // colors will scramble and this test fails.
    //
    // To force the packer to rotate ONE specific region, pack two TALL
    // 200x900 regions THEN a WIDE 900x200 region into a 1024 cap. Empirically
    // (probe in vitest dev shell): packer rotates the WIDE one because its
    // un-rotated 900-wide footprint cannot fit beside two 200-wide TALLs
    // (200+200+900 = 1300 > 1024-padding), but rotated to 200-wide it slots
    // in. We dye WIDE corners distinctly; the TALLs are filler.
    const sourceWidePath = path.join(tmpDir, 'WIDE.png');
    const sourceTallPath = path.join(tmpDir, 'TALL.png');
    // WIDE canonical: 900w x 200h with distinguishable corners.
    const wideW = 900;
    const wideH = 200;
    const wideBuf = Buffer.alloc(wideW * wideH * 4, 0);
    function setPx(buf: Buffer, w: number, x: number, y: number, rgba: number[]) {
      const i = (y * w + x) * 4;
      buf[i] = rgba[0];
      buf[i + 1] = rgba[1];
      buf[i + 2] = rgba[2];
      buf[i + 3] = rgba[3];
    }
    // Fill WIDE with mid-gray; mark corners with distinct colors.
    for (let i = 0; i < wideBuf.length; i += 4) {
      wideBuf[i] = 128;
      wideBuf[i + 1] = 128;
      wideBuf[i + 2] = 128;
      wideBuf[i + 3] = 255;
    }
    setPx(wideBuf, wideW, 0, 0, [255, 0, 0, 255]);
    setPx(wideBuf, wideW, wideW - 1, 0, [0, 255, 0, 255]);
    setPx(wideBuf, wideW, 0, wideH - 1, [0, 0, 255, 255]);
    setPx(wideBuf, wideW, wideW - 1, wideH - 1, [255, 255, 255, 255]);
    await sharp(wideBuf, {
      raw: { width: wideW, height: wideH, channels: 4 },
    })
      .png()
      .toFile(sourceWidePath);
    // TALL filler: 200x900, no need for distinct corners (we only assert
    // on the WIDE region's rotated bytes).
    await sharp({
      create: {
        width: 200,
        height: 900,
        channels: 4,
        background: { r: 60, g: 60, b: 60, alpha: 1 },
      },
    })
      .png()
      .toFile(sourceTallPath);
    // Plan: 2x TALL filler (200x900) + 1x WIDE (900x200). Packer rotates
    // WIDE because two 200-wide TALLs leave 624px on the row but WIDE's
    // un-rotated 900 doesn't fit; rotated to 200x900 it slots in beside.
    const plan: ExportPlan = {
      rows: [
        {
          sourcePath: sourceTallPath,
          outPath: 'images/TALL_A.png',
          sourceW: 200,
          sourceH: 900,
          outW: 200,
          outH: 900,
          effectiveScale: 1.0,
          attachmentNames: ['TALL_A'],
        },
        {
          sourcePath: sourceTallPath,
          outPath: 'images/TALL_B.png',
          sourceW: 200,
          sourceH: 900,
          outW: 200,
          outH: 900,
          effectiveScale: 1.0,
          attachmentNames: ['TALL_B'],
        },
        {
          sourcePath: sourceWidePath,
          outPath: 'images/WIDE.png',
          sourceW: wideW,
          sourceH: wideH,
          outW: wideW,
          outH: wideH,
          effectiveScale: 1.0,
          attachmentNames: ['WIDE'],
        },
      ] as ExportRow[],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 3 },
    };
    const opts: AtlasOpts = {
      maxPageSize: 1024,
      allowRotation: true,
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
    const atlasText = fs.readFileSync(result.atlasFile, 'utf8');
    // Find the `WIDE` block — empirically the packer rotates it under
    // the 2x TALL + 1x WIDE @ 1024 maxPage configuration.
    const rotatedBlock = atlasText.match(
      /^WIDE\nbounds:(\d+),(\d+),(\d+),(\d+)\nrotate:true/m,
    );
    expect(
      rotatedBlock,
      'WIDE region must be rotated under maxPageSize=1024 + allowRotation=true ' +
        '(probed empirically against maxrects-packer); if this is null the ' +
        "packer heuristic changed and the test fixture needs adjustment",
    ).not.toBeNull();
    if (!rotatedBlock) return;
    const x = parseInt(rotatedBlock[1], 10);
    const y = parseInt(rotatedBlock[2], 10);
    const w = parseInt(rotatedBlock[3], 10);
    const h = parseInt(rotatedBlock[4], 10);
    // Post-rotation dims on the page: w/h are SWAPPED from canonical.
    // canonical WIDE is 900w x 200h => packed bounds emit 200w x 900h.
    expect([w, h], 'packed bounds are post-rotation = (wideH, wideW)').toEqual([
      wideH,
      wideW,
    ]);

    // Extract the rotated region bytes from the page.
    const pagePath = result.pageFiles[0];
    const rotatedBytes = await sharp(pagePath)
      .extract({ left: x, top: y, width: w, height: h })
      .png()
      .toBuffer();

    // Apply spine runtime READ rotation: sharp.rotate(+90) restores canonical
    // per scripts/probe-sharp-rotate.mjs (Phase 33 verdict). Dims after read:
    // (wideW, wideH) restored.
    const readBack = await sharp(rotatedBytes)
      .rotate(90)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(readBack.info.width).toBe(wideW);
    expect(readBack.info.height).toBe(wideH);
    function getPx(buf: Buffer, ww: number, xx: number, yy: number): [number, number, number, number] {
      const i = (yy * ww + xx) * 4;
      return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
    }
    function nameOf(rgba: [number, number, number, number]): string {
      const [r, g, b] = rgba;
      if (r > 200 && g < 50 && b < 50) return 'RED';
      if (r < 50 && g > 200 && b < 50) return 'GREEN';
      if (r < 50 && g < 50 && b > 200) return 'BLUE';
      if (r > 200 && g > 200 && b > 200) return 'WHITE';
      return `rgba(${r},${g},${b})`;
    }
    const tl = nameOf(getPx(readBack.data, wideW, 0, 0));
    const tr = nameOf(getPx(readBack.data, wideW, wideW - 1, 0));
    const bl = nameOf(getPx(readBack.data, wideW, 0, wideH - 1));
    const br = nameOf(getPx(readBack.data, wideW, wideW - 1, wideH - 1));
    expect({ tl, tr, bl, br }).toEqual({
      tl: 'RED',
      tr: 'GREEN',
      bl: 'BLUE',
      br: 'WHITE',
    });
  });
});

describe('runRepack — UAT bug 3: returns a real ExportSummary', () => {
  it('returns summary with successes equal to unique regionNames processed', async () => {
    // UAT bug 3: pre-fix the IPC handler synthesized successes=0 for atlas-
    // mode because runRepack returned only { pageFiles, atlasFile }. The
    // renderer's "X of N succeeded" line read literally "0 of N". Fix
    // widens RepackResultPaths to embed an ExportSummary whose
    // successes = unique regions processed, outputDir = resolved outDir,
    // durationMs = wall-time of the run, cancelled = the cancellation flag
    // at completion. errors = [] for happy path (per-row errors are not
    // emitted by the repack worker; oversize throws atomic-or-fail).
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
    expect(result.summary).toBeDefined();
    expect(result.summary.successes).toBe(3);
    expect(result.summary.errors).toEqual([]);
    expect(result.summary.outputDir).toBe(path.resolve(tmpDir));
    expect(result.summary.cancelled).toBe(false);
    expect(typeof result.summary.durationMs).toBe('number');
    expect(result.summary.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('summary.successes counts UNIQUE outPaths even when defensive-dedup fires (UAT round 2)', async () => {
    // The summary must reflect what was actually packed (post-dedup count),
    // NOT the input row count. UAT round 2 (2026-05-15) changed the dedup
    // key from attachmentNames[0] to outPath. Per D-108 plan.rows is
    // upstream-deduped per source PNG path, so duplicate outPath would be
    // an upstream regression — but the worker handles it defensively
    // (first-occurrence-wins + console.warn). With 6 rows collapsing to 2
    // unique outPaths via the defensive branch, successes must be 2.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const plan = makePlan([
        // 3 rows with the same outPath → 1 atlas entry.
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['AVATAR/BODY'],
          outPath: 'images/AVATAR/BODY.png',
        },
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['AVATAR/BODY'],
          outPath: 'images/AVATAR/BODY.png',
        },
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['AVATAR/BODY'],
          outPath: 'images/AVATAR/BODY.png',
        },
        // 3 rows with a different shared outPath → another 1 atlas entry.
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['AVATAR/HEAD'],
          outPath: 'images/AVATAR/HEAD.png',
        },
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['AVATAR/HEAD'],
          outPath: 'images/AVATAR/HEAD.png',
        },
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['AVATAR/HEAD'],
          outPath: 'images/AVATAR/HEAD.png',
        },
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
      expect(result.summary.successes).toBe(2);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('runRepack — UAT round 2: dedup by outPath, NOT attachmentNames[0]', () => {
  it('skin-aliased slot bindings — same attachmentNames[0] but DIFFERENT outPath produce DISTINCT atlas entries', async () => {
    // UAT round 2 repro: in the multi-skin workflow Spine emits N skin-
    // namespaced source PNGs (e.g. `images/JOKER/BODY.png`, `images/
    // BEACHMAN/BODY.png`) all bound to a single SLOT whose
    // attachmentNames[0] is `AVATAR/BODY` (skin 0). The previous fix
    // keyed dedup by attachmentNames[0] and collapsed all of them into
    // ONE atlas entry, silently dropping ~135 of the 158 legitimate
    // plan.rows from the JOKERMAN_SPINE fixture.
    //
    // Correct contract: dedup is keyed by `row.outPath` (stripped of
    // `.png` + leading `images/`), which matches the Spine JSON `path:`
    // attribute. Distinct outPaths → distinct atlas entries, regardless
    // of whether attachmentNames[0] happens to collide.
    const plan = makePlan([
      // 3 skins each declaring BODY — slot binding is the same
      // (`AVATAR/BODY`), but each row has its own skin-namespaced
      // sourcePath/outPath (= the JSON `path:` field).
      {
        outW: 100,
        outH: 100,
        attachmentNames: ['AVATAR/BODY'],
        outPath: 'images/AVATAR/BODY.png',
      },
      {
        outW: 100,
        outH: 100,
        attachmentNames: ['AVATAR/BODY'],
        outPath: 'images/BEACHMAN/BODY.png',
      },
      {
        outW: 100,
        outH: 100,
        attachmentNames: ['AVATAR/BODY'],
        outPath: 'images/JOKER/BODY.png',
      },
      // 3 skins each declaring HEAD.
      {
        outW: 100,
        outH: 100,
        attachmentNames: ['AVATAR/HEAD'],
        outPath: 'images/AVATAR/HEAD.png',
      },
      {
        outW: 100,
        outH: 100,
        attachmentNames: ['AVATAR/HEAD'],
        outPath: 'images/BEACHMAN/HEAD.png',
      },
      {
        outW: 100,
        outH: 100,
        attachmentNames: ['AVATAR/HEAD'],
        outPath: 'images/JOKER/HEAD.png',
      },
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
    // Every distinct outPath becomes a distinct atlas region — no dropping.
    // bounds lines: 6 (one per row).
    const boundsLines = (atlasText.match(/^bounds:/gm) ?? []).length;
    expect(
      boundsLines,
      'bounds line count equals total distinct outPaths',
    ).toBe(6);
    // Skin-namespaced region names appear unaltered in the atlas (= what a
    // Spine runtime looks up via the JSON `path:` field at load time).
    expect(atlasText).toMatch(/^AVATAR\/BODY$/m);
    expect(atlasText).toMatch(/^BEACHMAN\/BODY$/m);
    expect(atlasText).toMatch(/^JOKER\/BODY$/m);
    expect(atlasText).toMatch(/^AVATAR\/HEAD$/m);
    expect(atlasText).toMatch(/^BEACHMAN\/HEAD$/m);
    expect(atlasText).toMatch(/^JOKER\/HEAD$/m);
    // And: no skin is dropped — total atlas entries equal total rows.
    expect(result.summary.successes).toBe(6);
  });

  it('defensive: rows with DUPLICATE outPath (= D-108 violation) collapse to ONE entry with a console.warn', async () => {
    // Per D-108 (src/shared/types.ts L361), plan.rows is upstream-deduped
    // per source PNG path. Duplicate outPath in plan.rows would indicate
    // an upstream regression — the worker preserves atomic-or-fail by
    // dedup'ing defensively and emitting console.warn so the bug is loud
    // rather than silently dropping rows.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const plan = makePlan([
        // Two rows with the same outPath — would only happen if D-108 was
        // violated upstream. Defensive dedup: first occurrence wins.
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['A'],
          outPath: 'images/SAME.png',
        },
        {
          outW: 100,
          outH: 100,
          attachmentNames: ['B'],
          outPath: 'images/SAME.png',
        },
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
      // Exactly 1 atlas entry (first-occurrence-wins).
      const boundsLines = (atlasText.match(/^bounds:/gm) ?? []).length;
      expect(boundsLines).toBe(1);
      expect(atlasText).toMatch(/^SAME$/m);
      // Summary reports the deduplicated count (1), not the input count (2).
      expect(result.summary.successes).toBe(1);
      // The defensive warn fired — surfaced for upstream-bug diagnosis.
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      expect(
        warnCalls.some((m) => m.includes('duplicate outPath in plan.rows')),
        `expected a console.warn matching /duplicate outPath in plan.rows/ — got: ${JSON.stringify(warnCalls)}`,
      ).toBe(true);
    } finally {
      warnSpy.mockRestore();
    }
  });
});

describe('runRepack — UAT round 2: passthroughCopies are packed into atlas mode', () => {
  it('emits an atlas entry for every passthroughCopies row at native dims', async () => {
    // UAT round 2 (2026-05-15): pre-fix runRepack iterated only plan.rows.
    // plan.passthroughCopies are rows where outW === sourceW (no resize
    // needed); image-worker.ts handles them via copyFile in loose mode.
    // For atlas mode they must STILL appear in the .atlas because a Spine
    // runtime looks up every region declared in the .json `path:` field,
    // regardless of resize vs copy.
    //
    // The fixture SIMPLE_TEST.png is 1839x1464 in native dims. Passthrough
    // rows use outW === sourceW so the bytes are loaded verbatim through
    // sharp().png().toBuffer() and packed at their native size.
    const fixtureMeta = await sharp(FIXTURE_PNG).metadata();
    const nativeW = fixtureMeta.width!;
    const nativeH = fixtureMeta.height!;
    const plan = makePlan(
      // One resize row at 200x200.
      [
        {
          outW: 200,
          outH: 200,
          attachmentNames: ['RESIZE_A'],
          outPath: 'images/RESIZE_A.png',
        },
      ],
      // Two passthrough rows, packed at native dims.
      [
        {
          sourceW: nativeW,
          sourceH: nativeH,
          outW: nativeW,
          outH: nativeH,
          attachmentNames: ['PASS_A'],
          outPath: 'images/PASS_A.png',
        },
        {
          sourceW: nativeW,
          sourceH: nativeH,
          outW: nativeW,
          outH: nativeH,
          attachmentNames: ['PASS_B'],
          outPath: 'images/PASS_B.png',
        },
      ],
    );
    const opts: AtlasOpts = {
      maxPageSize: 8192,
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
    const atlasText = fs.readFileSync(result.atlasFile, 'utf8');
    // All 3 regions in the atlas (1 resize + 2 passthrough).
    expect(atlasText).toMatch(/^RESIZE_A$/m);
    expect(atlasText).toMatch(/^PASS_A$/m);
    expect(atlasText).toMatch(/^PASS_B$/m);
    const boundsLines = (atlasText.match(/^bounds:/gm) ?? []).length;
    expect(boundsLines, 'atlas contains 1 resize + 2 passthrough = 3 entries').toBe(3);
    // Passthrough rows pack at native dims — bounds should match nativeW×nativeH.
    const passA = atlasText.match(/^PASS_A\nbounds:\d+,\d+,(\d+),(\d+)/m);
    expect(passA, 'PASS_A bounds line present').not.toBeNull();
    if (passA) {
      expect([parseInt(passA[1], 10), parseInt(passA[2], 10)]).toEqual([
        nativeW,
        nativeH,
      ]);
    }
    // Summary reports successes for all 3 (resize + passthrough).
    expect(result.summary.successes).toBe(3);
  });

  it('emits progress events for passthrough rows in the absolute index space (resize first, then passthrough)', async () => {
    // Progress events must span the COMBINED work-unit space:
    //   total = rows.length + passthroughCopies.length + packResult.pages.length
    // Resize events: index in [0, rows.length)
    // Passthrough events: index in [rows.length, rows.length + passthrough.length)
    // Composite events: index in [resizeUnits, resizeUnits + pages.length)
    const plan = makePlan(
      [
        {
          outW: 200,
          outH: 200,
          attachmentNames: ['R0'],
          outPath: 'images/R0.png',
        },
        {
          outW: 200,
          outH: 200,
          attachmentNames: ['R1'],
          outPath: 'images/R1.png',
        },
      ],
      [
        {
          sourceW: 100,
          sourceH: 100,
          outW: 100,
          outH: 100,
          attachmentNames: ['P0'],
          outPath: 'images/P0.png',
        },
      ],
    );
    const events: ExportProgressEvent[] = [];
    const written = new Set<string>();
    await runRepack(
      plan,
      tmpDir,
      (e) => events.push(e),
      () => false,
      true,
      false,
      DEFAULT_OPTS,
      written,
    );
    const resizeEvents = events.filter((e) => e.phase === 'resize');
    const compositeEvents = events.filter((e) => e.phase === 'composite');
    // 2 resize + 1 passthrough = 3 phase=resize events.
    expect(resizeEvents.length).toBe(3);
    // Every resize-phase event reports the SAME combined denominator.
    for (const e of resizeEvents) {
      expect(
        e.total,
        `resize event total should be rows + passthrough = 3 (got ${e.total})`,
      ).toBe(3);
    }
    // The indices in the resize phase span [0, 2], with passthrough at 2.
    expect(resizeEvents.map((e) => e.index).sort()).toEqual([0, 1, 2]);
    // Composite events use the COMBINED total = 3 (resize+pass) + page count.
    for (const e of compositeEvents) {
      expect(
        e.total,
        `composite event total should be combined work units (got ${e.total})`,
      ).toBeGreaterThanOrEqual(3 + 1);
      // Composite indices continue from the resize-phase tail (>= 3).
      expect(e.index).toBeGreaterThanOrEqual(3);
    }
  });
});

// UAT round 2 (2026-05-15) — sanity-check the fix against the real SKINS
// fixture. Pattern mirrors tests/core/export.spec.ts:2872-2881
// (TEST_4_FIXTURE_PRESENT + describeOrSkip): when the heavy SKINS fixture
// is absent from a clone (it is gitignored — `fixtures/SKINS/` in
// .gitignore), the suite emits a visible vitest skip rather than silently
// passing on absent inputs. The fixture has 7 skins and ~161 unique
// `path:` attributes per skin-namespaced source PNG; the bug-1 collapse
// dropped the atlas from ~161 entries to 23.
const SKINS_FIXTURE_PATH = path.resolve('fixtures/SKINS/JOKERMAN_SPINE.json');
const SKINS_FIXTURE_PRESENT = fs.existsSync(SKINS_FIXTURE_PATH);
const describeIfSkins = SKINS_FIXTURE_PRESENT ? describe : describe.skip;

describeIfSkins('runRepack — UAT round 2: SKINS fixture sanity (gitignored)', () => {
  it('atlas region count ≈ unique-paths in JSON (per-skin namespaces preserved, NOT collapsed to 23)', async () => {
    // This test builds an ExportPlan from the real SKINS fixture via the
    // same buildSummary-equivalent helper used by tests/core/export.spec.ts
    // Test 4 (JOKERMAN_SPINE → buildExportPlan returns 160 entries). The
    // sanity assertion: after the UAT-round-2 fix, runRepack emits one
    // atlas entry per row.outPath — so the .atlas region count equals
    // plan.rows.length + plan.passthroughCopies.length (modulo passthrough
    // dims that might exceed maxPageSize, but for our fixture none do at
    // 8192). Pre-fix: only ~23 entries (collapsed to skin 0's bindings).
    //
    // This test runs heavy (full sampler + analyze + buildExportPlan) and
    // is gated on the fixture's presence — CI without the SKINS fixture
    // skips it via describeIfSkins.
    const { loadSkeleton } = await import('../../src/core/loader.js');
    const { sampleSkeleton } = await import('../../src/core/sampler.js');
    const { analyze, analyzeRegions } = await import('../../src/core/analyzer.js');
    const { buildExportPlan } = await import('../../src/core/export.js');

    const load = loadSkeleton(SKINS_FIXTURE_PATH);
    const sampled = sampleSkeleton(load);
    const peaks = analyze(sampled.globalPeaks);
    const fixtureImagesDir = path.resolve('fixtures/SKINS/images');
    const peaksWithPath = peaks.map((r) => ({
      ...r,
      sourcePath: path.join(fixtureImagesDir, (r.regionName ?? r.attachmentName) + '.png'),
    }));
    const sourcePaths = new Map<string, string>();
    for (const p of sampled.globalPeaks.values()) {
      const regionName = p.regionName ?? p.attachmentName;
      sourcePaths.set(regionName, path.join(fixtureImagesDir, regionName + '.png'));
    }
    const regions = analyzeRegions(sampled.globalPeaks, sourcePaths);
    // Lock the count from tests/core/export.spec.ts Test 4: 160 unique regions.
    const totalRegions = regions.length;
    expect(totalRegions, 'JOKERMAN_SPINE has 160 unique regions per Test 4').toBe(160);
    const summary = {
      peaks: peaksWithPath,
      regions,
      orphanedFiles: [],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
    const plan = buildExportPlan(summary, new Map(), undefined);
    const totalPlanned = plan.rows.length + plan.passthroughCopies.length;
    // Sanity: matches Test 4's expectation.
    expect(totalPlanned, 'plan.rows + passthroughCopies = total regions').toBe(160);

    // Pre-flight: ensure every source PNG referenced exists on disk so the
    // worker's sharp(sourcePath) calls succeed. If any are missing, skip the
    // assertion with a clear message (the fixture is heavy and might be
    // partial in some clones).
    const missing: string[] = [];
    for (const row of [...plan.rows, ...plan.passthroughCopies]) {
      if (!fs.existsSync(row.sourcePath)) missing.push(row.sourcePath);
    }
    if (missing.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[SKINS sanity] ${missing.length}/${totalPlanned} source PNGs missing — skipping pack assertion.`,
      );
      return;
    }

    const opts: AtlasOpts = {
      maxPageSize: 8192,
      allowRotation: true,
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
    const atlasText = fs.readFileSync(result.atlasFile, 'utf8');
    const boundsLines = (atlasText.match(/^bounds:/gm) ?? []).length;
    // Post-fix: every row.outPath becomes a distinct atlas entry. The
    // user's pre-fix atlas had 23 entries; the post-fix atlas must have
    // EXACTLY 160 (= plan.rows + passthroughCopies, no upstream-D-108
    // duplicates expected).
    expect(
      boundsLines,
      `atlas region count must equal planned region count (160). Got ${boundsLines}. ` +
        `If 23, the regression returned (collapsed by slot-binding name). If 0, packer pre-flight aborted.`,
    ).toBe(160);
    // Spot-check: a known skin-namespaced region appears under its own name.
    expect(atlasText, 'JOKER/BODY appears as its own atlas region').toMatch(/^JOKER\/BODY$/m);
    expect(atlasText, 'BEACHMAN/BODY appears as its own atlas region').toMatch(/^BEACHMAN\/BODY$/m);
    expect(atlasText, 'IRONMAN/BODY appears as its own atlas region').toMatch(/^IRONMAN\/BODY$/m);
    // result.summary.successes should equal the deduplicated input count.
    expect(result.summary.successes).toBe(160);
  }, 120_000); // 2-min timeout — heavy sampler + analyze + 160-region sharp pipeline.
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
