/**
 * Phase 40 REPACK-03 + REPACK-05 + REPACK-10 — sharp orchestration for atlas-mode output.
 *
 * Pipeline:
 *   1. For each ExportPlan row, sharp-resize via shared helper (sharp-resize.ts).
 *   2. Read back sharp's actual emitted dims via metadata() — Sharp-emits-truth
 *      invariant (REPACK-03; RESEARCH §"Reading back sharp-emitted truth").
 *   3. Call computeRepack(actualDimInputs, atlasOpts). If result.oversize is
 *      non-empty, throw the locked REPACK-10 error string BEFORE any file
 *      write. Atomic-or-fail at the pre-flight gate.
 *   4. For each rotated region (region.rotated === true), apply materialize-
 *      then-reload sharp(buf).rotate(-90).png().toBuffer() per RESEARCH §
 *      "Pipeline fusion landmine" (libvips reorders extract→resize→extend→
 *      composite→post-extract regardless of chain order; rotation needs a
 *      buffer boundary). UAT bug 2 (2026-05-15): the WRITE direction is
 *      sharp.rotate(-90), NOT rotate(+90). Phase 33's empirical claim of
 *      "+90 is CCW" was about the READ direction (atlas→canonical, applied
 *      by spine runtime); the WRITE direction (canonical→atlas) is the
 *      inverse. Empirically verified by scripts/probe-sharp-rotate-write.mjs
 *      + tests/main/repack-worker.spec.ts "UAT bug 2: atlas rotation
 *      direction round-trips through spine READ".
 *   5. For each page, sharp { create: ... }.composite(layers).png().toFile(
 *      pagePath.tmp), rename to pagePath. Both paths registered in
 *      writtenPaths BEFORE toFile per RESEARCH §Landmines #7+#8.
 *   6. Build atlas text via buildAtlasText, atomic-write to .atlas.
 *
 * Page naming (REPACK-05 locked): page 0 → {projectName}.png; page N → {projectName}_{N+1}.png.
 *
 * Atomic-or-fail (REPACK-10): every tmp + final path lands in writtenPaths;
 * on throw, ipc.ts finally-block fs.rm-sweeps all entries.
 *
 * Cancellation: between resize iterations + between page composites only.
 * Mid-libvips operations cannot be aborted (CLAUDE.md fact #4 + Phase 6 D-115).
 */
import sharp from 'sharp';
import {
  writeFile,
  readFile,
  rename,
  mkdir,
  access,
  constants as fsConstants,
} from 'node:fs/promises';
import { join, resolve as pathResolve } from 'node:path';

import { computeRepack } from '../core/repack.js';
import type { RepackInput } from '../core/repack.js';
import { buildAtlasText } from './atlas-writer.js';
import { resizeToBuffer } from './sharp-resize.js';

/**
 * Phase 40 CR-01 (BLOCKER) — atlas-source fallback. Mirrors the loose-export
 * path's pre-flight at src/main/image-worker.ts:444-606: if `row.sourcePath`
 * is absent on disk but `row.atlasSource` is populated, extract the region
 * from the atlas page PNG and return a sharp pipeline pre-positioned on
 * those pixels (un-rotated to canonical orientation if the source region
 * was packed rotated). Strip-Whitespace `extend()` reconstitution is NOT
 * applied here — the resize loop below targets `outW/outH` directly, so the
 * resize chain naturally rescales the trimmed region to the requested dims.
 * (Loose mode needs SW extend because it writes a canonical-canvas PNG; the
 * repack-worker writes packed bytes only.)
 *
 * Returns `{ pipeline, isFromAtlasSource }`. The boolean is consumed by the
 * passthrough WR-06 path so it can decide between `readFile(sourcePath)`
 * (loose on-disk source ⇒ byte-parity-to-source) and the atlas-extract
 * fallback (no on-disk loose PNG ⇒ sharp-extract-then-buffer).
 *
 * Inputs: any ExportRow-ish shape carrying `sourcePath` and (optionally)
 * `atlasSource`. Callers narrow to ExportRow at the call site.
 */
type AtlasSourceMeta = {
  pagePath: string;
  x: number;
  y: number;
  packW: number;
  packH: number;
  offsetX: number;
  offsetY: number;
  w: number;
  h: number;
  rotated: boolean;
};

async function loadRegionSource(row: {
  sourcePath: string;
  atlasSource?: AtlasSourceMeta;
}): Promise<{ pipeline: sharp.Sharp; isFromAtlasSource: boolean }> {
  // Prefer the per-region PNG if it exists on disk. This is the common case
  // in atlas-less mode (and in atlas-source mode when the user kept the
  // pre-export images/ folder alongside the .atlas).
  const looseExists = await access(row.sourcePath, fsConstants.F_OK)
    .then(() => true)
    .catch(() => false);
  if (looseExists) {
    return { pipeline: sharp(row.sourcePath), isFromAtlasSource: false };
  }
  // Fallback: atlas-source projects (no per-region PNGs). Extract the
  // trimmed rect from the page PNG. Mirrors image-worker.ts:582-606 — for
  // rotated regions we un-rotate via .rotate(+90) BEFORE the extract is
  // materialized, then re-open from the buffer so libvips cannot fuse the
  // rotation into a downstream resize/composite step (RESEARCH §"Pipeline
  // fusion landmine").
  if (!row.atlasSource) {
    throw new Error(
      `repack-worker: source PNG missing and no atlasSource fallback available: ${row.sourcePath}`,
    );
  }
  const a = row.atlasSource;
  if (a.rotated) {
    // Materialize the un-rotated trimmed rect so the returned pipeline is
    // pre-positioned on a canonical-orientation buffer. Direction (+90)
    // matches image-worker.ts:588 + scripts/probe-sharp-rotate.mjs (Phase 33
    // empirically verified — the WRITE inverse the repack-worker step 4
    // rotate uses is -90, but this is the READ direction).
    const rotated = await sharp(a.pagePath)
      .extract({ left: a.x, top: a.y, width: a.packW, height: a.packH })
      .rotate(90)
      .png()
      .toBuffer();
    return { pipeline: sharp(rotated), isFromAtlasSource: true };
  }
  return {
    pipeline: sharp(a.pagePath).extract({
      left: a.x,
      top: a.y,
      width: a.packW,
      height: a.packH,
    }),
    isFromAtlasSource: true,
  };
}
// UAT Round 3 (2026-05-15) — deriveProjectName + pageFilename extracted
// to atlas-paths.ts so probeExportConflicts (src/main/ipc.ts) can derive
// the same atlas-mode targets. The two call sites MUST agree byte-for-byte
// or the probe is moot.
import { deriveProjectName, pageFilename } from './atlas-paths.js';
import type {
  ExportPlan,
  ExportProgressEvent,
  ExportSummary,
} from '../shared/types.js';

export interface AtlasOpts {
  maxPageSize: 1024 | 2048 | 4096 | 8192;
  allowRotation: boolean;
  padding: number;
}

/**
 * UAT bug 3 (2026-05-15) — widened with `summary: ExportSummary`. Pre-fix
 * the IPC handler synthesized successes=0 for atlas mode because the
 * worker returned only file paths; the renderer's progress card read
 * literally "0 of N succeeded" despite files being written. The summary
 * carries the real counts so the IPC handler can return them verbatim
 * (atlas mode) or merge them with runExport's summary (both mode).
 *
 *   successes  = unique regionNames packed + composited (= dedup'd input set)
 *   errors     = empty for happy path (oversize aborts atomically; per-row
 *                errors are not currently emitted by the repack worker)
 *   outputDir  = pathResolve(outDir), matching runExport's contract
 *   durationMs = wall-time of the run (Date.now delta)
 *   cancelled  = bailedOnCancel sentinel (CR-02 fix). True ONLY when one
 *                of the cooperative pre-iteration checks fired and threw
 *                'cancelled' — but in that case runRepack throws before
 *                returning, so in practice this is always false on the
 *                success path. Pre-fix read isCancelled() at return time,
 *                which raced post-success cancel-flag flips.
 */
export interface RepackResultPaths {
  pageFiles: string[];
  atlasFile: string;
  summary: ExportSummary;
}

export async function runRepack(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  allowOverwrite: boolean,
  sharpenEnabled: boolean,
  atlasOpts: AtlasOpts,
  writtenPaths: Set<string>,
): Promise<RepackResultPaths> {
  const startedAt = Date.now();
  const projectName = deriveProjectName(plan, outDir);
  const resolvedOutDir = pathResolve(outDir);

  // CR-02 (BLOCKER) — `cancelled: isCancelled()` at return time conflated
  // "user clicked Cancel mid-run and we skipped work" (true cancel) with
  // "user clicked Cancel after the last region already succeeded but before
  // the function returned" (race — every region completed; nothing was
  // skipped). The latter incorrectly poisoned the summary's caption even
  // though no work was skipped. Set this flag ONLY at the cooperative
  // pre-iteration checks below — that is the unambiguous "we stopped
  // because of cancel" signal. Pattern mirrors image-worker.ts:139.
  let bailedOnCancel = false;

  // Ensure output dir exists (mirrors image-worker.ts mkdir behavior).
  await mkdir(resolvedOutDir, { recursive: true });

  // -------- Step 1+2: Resize phase + sharp-emits-truth read-back --------
  // Map keyed by regionName = `row.outPath` stripped of `.png` and leading
  // `images/`. This matches the Spine JSON `path:` attribute, which is what
  // the spine runtime uses to look up a region in the atlas.
  //
  // UAT round 2 (2026-05-15): the previous fix used `attachmentNames[0]` as
  // the dedup key. That field is the SLOT-BINDING name, which is SHARED
  // across skins. In the multi-skin (SKINS) workflow Spine emits N skin-
  // namespaced source PNGs (e.g. `images/JOKER/BODY.png`, `images/BEACHMAN/
  // BODY.png`) all bound to a single slot whose attachmentNames[0] is
  // `AVATAR/BODY` (skin 0's name). Keying by attachmentNames[0] collapsed
  // all skins' BODY regions into ONE entry — dropping ~135 of the 158
  // legitimate plan.rows. The corrected key (outPath without extension)
  // is unique per source PNG and matches the JSON `path:` field a Spine
  // runtime will read at load time. Per D-108 (src/shared/types.ts L361),
  // plan.rows is ALREADY deduped per atlas-region source PNG path
  // upstream — so duplicate-outPath entries should be IMPOSSIBLE here.
  // We keep a Map-based safety net + console.warn so an upstream regression
  // is surfaced loudly rather than silently dropping rows. computeRepack's
  // localeCompare sort guarantees pack-order determinism regardless of
  // insertion order.
  const regionBuffers = new Map<string, Buffer>();
  const repackInputsByName = new Map<string, RepackInput>();
  // Hoisted so both the resize loop and the passthrough loop (below) can
  // reference the same array — keeps progress-total math consistent across
  // every onProgress emission in this function.
  const passthroughCopies = plan.passthroughCopies ?? [];

  /**
   * Strip the `images/` prefix + `.png` suffix from an ExportRow.outPath
   * to produce the atlas region name. Matches the Spine JSON `path:`
   * attribute (skin-namespaced, e.g. `JOKER/BODY`). Forward slashes are
   * preserved — Spine's atlas format uses `/` for nested region names.
   *
   * Examples:
   *   `images/JOKER/BODY.png`    → `JOKER/BODY`
   *   `images/CIRCLE.png`        → `CIRCLE`
   *   `images/sub/dir/foo.PNG`   → `sub/dir/foo`  (case-insensitive .png)
   */
  function outPathToRegionName(outPath: string): string {
    const stripped = outPath.replace(/\.png$/i, '');
    return stripped.startsWith('images/') ? stripped.slice('images/'.length) : stripped;
  }

  for (let i = 0; i < plan.rows.length; i++) {
    if (isCancelled()) {
      // CR-02: set bailedOnCancel BEFORE throw so summary.cancelled is true
      // only when we ACTUALLY stopped because of cancel (mirrors image-
      // worker.ts:139 pattern).
      bailedOnCancel = true;
      throw new Error('cancelled');
    }
    const row = plan.rows[i];
    const regionName = outPathToRegionName(row.outPath);

    // Defensive dedup: D-108 (src/shared/types.ts L361) guarantees plan.rows
    // is already deduped per source PNG path — duplicate outPaths would
    // indicate an upstream regression. Warn loudly so the bug surfaces, but
    // do not crash: first occurrence wins to preserve atomic-or-fail.
    if (repackInputsByName.has(regionName)) {
      console.warn(
        `[runRepack] duplicate outPath in plan.rows (upstream bug — D-108 violated): ` +
          `regionName=${regionName}, row index=${i}, outPath=${row.outPath}. ` +
          `First occurrence wins; subsequent rows dropped from atlas.`,
      );
      onProgress({
        index: i,
        total: plan.rows.length + passthroughCopies.length,
        path: regionName,
        outPath: '',
        status: 'success',
        phase: 'resize',
      });
      continue;
    }

    // CR-01: atlas-source fallback. If the per-region PNG is missing on
    // disk, extract from the atlas page (un-rotated to canonical if packed
    // rotated). Mirrors image-worker.ts:444-606.
    const { pipeline: sourcePipeline } = await loadRegionSource(row);
    const resized = await resizeToBuffer(
      sourcePipeline,
      row.outW,
      row.outH,
      row.effectiveScale,
      sharpenEnabled,
    );

    // Sharp-emits-truth: read back what libvips actually produced. The packer
    // cannot lay out a region whose bytes don't match the dims it was told.
    const meta = await sharp(resized).metadata();
    const packW = meta.width ?? row.outW;
    const packH = meta.height ?? row.outH;

    regionBuffers.set(regionName, resized);
    repackInputsByName.set(regionName, { regionName, packW, packH });

    onProgress({
      index: i,
      total: plan.rows.length + passthroughCopies.length,
      path: regionName,
      outPath: '',
      status: 'success',
      phase: 'resize',
    });
  }

  // -------- Step 1b: Passthrough rows — pack at native dims --------
  // UAT round 2 (2026-05-15): plan.passthroughCopies are rows where outW ===
  // sourceW (no resize needed); image-worker.ts handles them via copyFile
  // in loose mode. For atlas mode they must STILL be packed into the atlas
  // (otherwise the spine runtime can't find them — every region declared in
  // the .json `path:` field must have an entry in the .atlas, regardless of
  // whether it was resized or copied byte-identical).
  //
  // Read source bytes verbatim through sharp().png().toBuffer() — NO resize
  // chain — so downstream metadata/rotate/composite see a normalized RGBA
  // buffer matching the resized-row pipeline. Native packW/H are read back
  // from sharp metadata (sharp-emits-truth invariant per REPACK-03).
  //
  // Progress events fire in the absolute index space AFTER the resize loop
  // (offset by plan.rows.length); Task 3 widens denominators to include
  // passthrough rows. `passthroughCopies` hoisted above the resize loop.
  for (let pi = 0; pi < passthroughCopies.length; pi++) {
    if (isCancelled()) {
      // CR-02: set bailedOnCancel BEFORE throw (see resize-loop comment).
      bailedOnCancel = true;
      throw new Error('cancelled');
    }
    const row = passthroughCopies[pi];
    const regionName = outPathToRegionName(row.outPath);
    const absIndex = plan.rows.length + pi;

    if (repackInputsByName.has(regionName)) {
      console.warn(
        `[runRepack] duplicate outPath in passthroughCopies (upstream bug — D-108 violated): ` +
          `regionName=${regionName}, passthrough index=${pi}, outPath=${row.outPath}. ` +
          `First occurrence wins; subsequent rows dropped from atlas.`,
      );
      onProgress({
        index: absIndex,
        total: plan.rows.length + passthroughCopies.length,
        path: regionName,
        outPath: '',
        status: 'success',
        phase: 'resize',
      });
      continue;
    }

    // CR-01 + WR-06: passthrough region bytes.
    //
    // WR-06: loose-mode preserves byte-parity-to-source by `copyFile`
    // (image-worker.ts:337). Atlas-mode pre-fix re-encoded via sharp(...)
    // .png().toBuffer() — a libvips round-trip that drops byte-parity (the
    // emitted PNG has different compression headers, possibly slightly
    // different pixel encoding under PMA paths). When the source PNG is on
    // disk we read it verbatim with readFile and feed those bytes into the
    // composite layer's `input`. Sharp's composite step accepts PNG buffers
    // natively, so this is the byte-parity path.
    //
    // CR-01: when source is NOT on disk (atlas-source mode), there is no
    // "source bytes" to copy verbatim — fall back to sharp-extract-then-
    // buffer (via loadRegionSource). The isFromAtlasSource flag gates this.
    let passthroughBuf: Buffer;
    const loaded = await loadRegionSource(row);
    if (loaded.isFromAtlasSource) {
      // No on-disk loose PNG to verbatim-copy; materialize the extracted
      // region as a PNG buffer (libvips round-trip is unavoidable here).
      passthroughBuf = await loaded.pipeline.png().toBuffer();
    } else {
      // Loose-on-disk source — preserve byte parity by reading PNG bytes
      // verbatim. The packer's packW/packH still comes from sharp metadata
      // on the same buffer (sharp-emits-truth invariant preserved).
      passthroughBuf = await readFile(row.sourcePath);
    }
    const meta = await sharp(passthroughBuf).metadata();
    const packW = meta.width ?? row.sourceW;
    const packH = meta.height ?? row.sourceH;

    regionBuffers.set(regionName, passthroughBuf);
    repackInputsByName.set(regionName, { regionName, packW, packH });

    onProgress({
      index: absIndex,
      total: plan.rows.length + passthroughCopies.length,
      path: regionName,
      outPath: '',
      status: 'success',
      phase: 'resize',
    });
  }

  const repackInputs: RepackInput[] = Array.from(repackInputsByName.values());

  // -------- Step 3: Pack + oversize pre-flight --------
  const packResult = computeRepack(repackInputs, {
    maxPageSize: atlasOpts.maxPageSize,
    padding: atlasOpts.padding,
    allowRotation: atlasOpts.allowRotation,
  });

  if (packResult.oversize.length > 0) {
    const offendingName = packResult.oversize[0];
    const offendingInput = repackInputs.find(
      (x) => x.regionName === offendingName,
    );
    const w = offendingInput?.packW ?? 0;
    const h = offendingInput?.packH ?? 0;
    // LOCKED ERROR STRING (REPACK-10 SPEC) — preserve verbatim. The IPC
    // handler in Plan 06 maps this to the user-facing ExportError.
    throw new Error(
      `Region ${offendingName} is ${w}×${h} px which exceeds the page-size cap. Increase atlasMaxPageSize or apply a smaller override.`,
    );
  }

  // -------- Step 4: Rotation prep (materialize-then-reload per RESEARCH §Landmines #1) --------
  // libvips fuses chained operations in pipeline order (extract → resize →
  // extend → composite → post-extract). To rotate a region BEFORE compositing
  // it onto a page canvas we need a buffer boundary, otherwise libvips fuses
  // the rotation into the wrong slot and the page render is wrong.
  //
  // UAT bug 2 (2026-05-15): the WRITE direction is sharp.rotate(-90).
  // Phase 33's "+90 is CCW" claim was about the READ direction the spine
  // runtime applies (atlas→canonical); the WRITE direction is its inverse.
  // Confirmed by scripts/probe-sharp-rotate-write.mjs:
  //   WRITE rotate(-90) → READ rotate(+90) restores canonical corners.
  // Pre-fix (rotate(+90) on WRITE): page bytes were rotated 90° in the same
  // direction the runtime later rotates → 180° net → upside-down faces.
  for (const region of packResult.regions) {
    // WR-02: cooperative cancellation in the rotation prep loop. Mirrors
    // the resize/passthrough/composite loops + image-worker.ts runExport's
    // rotation step. Each rotation is its own libvips sharp() call, so the
    // pre-iteration check is the same lifecycle the rest of the worker
    // uses.
    if (isCancelled()) {
      bailedOnCancel = true;
      throw new Error('cancelled');
    }
    if (region.rotated) {
      const orig = regionBuffers.get(region.regionName);
      if (!orig) continue;
      const rotated = await sharp(orig).rotate(-90).png().toBuffer();
      regionBuffers.set(region.regionName, rotated);
    }
  }

  // -------- Step 5: Composite phase --------
  const pageFiles: string[] = [];
  for (let pi = 0; pi < packResult.pages.length; pi++) {
    if (isCancelled()) {
      // CR-02: set bailedOnCancel BEFORE throw (see resize-loop comment).
      bailedOnCancel = true;
      throw new Error('cancelled');
    }
    const page = packResult.pages[pi];
    const pagePath = join(
      resolvedOutDir,
      pageFilename(projectName, page.pageIndex),
    );
    const tmpPath = pagePath + '.tmp';

    // Overwrite guard (mirrors image-worker.ts L367-381 access() check).
    if (!allowOverwrite) {
      const exists = await access(pagePath, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        throw new Error(
          `repack-worker: page PNG already exists at ${pagePath}; pass allowOverwrite=true to overwrite.`,
        );
      }
    }

    // Register BOTH paths BEFORE toFile per RESEARCH §Landmines #7+#8.
    // The IPC handler's finally-block (Plan 06) sweeps writtenPaths on
    // ANY throw — for the sweep to be complete, every artifact path must
    // be registered BEFORE the write attempt, not after.
    writtenPaths.add(tmpPath);
    writtenPaths.add(pagePath);

    const layers = packResult.regions
      .filter((r) => r.pageIndex === page.pageIndex)
      .map((r) => ({
        input: regionBuffers.get(r.regionName)!,
        top: r.y,
        left: r.x,
      }));

    await sharp({
      create: {
        width: page.width,
        height: page.height,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite(layers)
      .png({ compressionLevel: 9 })
      .toFile(tmpPath);

    await rename(tmpPath, pagePath);
    pageFiles.push(pagePath);

    // UAT 2026-05-15 — emit composite events in the SAME absolute index
    // space as the resize events (continue past plan.rows.length +
    // passthroughCopies.length). Pre-fix these emitted (index=0, total=1)
    // → the renderer (which uses a global plan.rows-based denominator)
    // snapped progress back to ~0% on the last event. By offsetting we
    // keep the bar monotonic.
    //
    // UAT round 2 (2026-05-15): passthroughCopies are now packed too, so
    // the resize-phase index space spans [0, rows + passthrough). The
    // composite phase continues from there.
    const resizeUnits = plan.rows.length + passthroughCopies.length;
    onProgress({
      index: resizeUnits + pi,
      total: resizeUnits + packResult.pages.length,
      path: pageFilename(projectName, page.pageIndex),
      outPath: pagePath,
      status: 'success',
      phase: 'composite',
    });
  }

  // -------- Step 6: Atlas text write --------
  const atlasText = buildAtlasText({
    projectName,
    pages: packResult.pages,
    regions: packResult.regions,
  });
  const atlasPath = join(resolvedOutDir, `${projectName}.atlas`);
  const atlasTmpPath = atlasPath + '.tmp';

  if (!allowOverwrite) {
    const exists = await access(atlasPath, fsConstants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      throw new Error(
        `repack-worker: .atlas already exists at ${atlasPath}; pass allowOverwrite=true to overwrite.`,
      );
    }
  }

  // Register both atlas paths BEFORE the write attempt (atomic-rollback contract).
  writtenPaths.add(atlasTmpPath);
  writtenPaths.add(atlasPath);

  await writeFile(atlasTmpPath, atlasText, 'utf8');
  await rename(atlasTmpPath, atlasPath);

  // UAT bug 3 (2026-05-15) — surface a real ExportSummary so the IPC
  // handler doesn't fabricate "0 of N succeeded" for atlas mode. Successes
  // count is the number of unique regionNames packed; this is the same
  // count the .atlas file reports (one entry per unique region).
  const summary: ExportSummary = {
    successes: repackInputs.length,
    errors: [],
    outputDir: resolvedOutDir,
    durationMs: Date.now() - startedAt,
    // CR-02: bailedOnCancel is true ONLY when one of the cooperative pre-
    // iteration checks above fired and threw 'cancelled'. On the success
    // path runRepack reaches here, so `cancelled: false` regardless of
    // post-success cancel-flag flips. Pre-fix `isCancelled()` read the
    // live flag → a race where the user clicked Cancel between the last
    // composite and this summary literal poisoned the caption.
    cancelled: bailedOnCancel,
  };

  return { pageFiles, atlasFile: atlasPath, summary };
}
