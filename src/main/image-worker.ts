/**
 * Phase 6 Plan 04 — Main-process export worker (F8.2 + F8.4 + F8.5 + N3.1).
 *
 * runExport(plan, outDir, onProgress, isCancelled, allowOverwrite=false,
 *           sharpenEnabled=false, writtenPaths=new Set())
 * walks ExportPlan.rows sequentially, performing per-row:
 *   1. fs.access(R_OK) pre-flight per D-112. If the per-region source
 *      PNG is missing AND row.atlasSource is populated (Gap-Fix #2,
 *      atlas-packed projects like Jokerman), fall back to atlas-page
 *      extraction; otherwise emit 'missing-source'.
 *   2. Path-traversal defense (Threat-Model-Lite) — outPath must resolve
 *      under outDir; failure emits 'write-error'. Uses path.resolve +
 *      path.relative; rejects '..' prefix, absolute escapes, and the
 *      degenerate empty-relative case (outPath equals outDir itself).
 *   3. NaN/zero-dim guard — defensive against future sampler regressions
 *      producing non-finite peakScale; rejects with 'write-error' before
 *      sharp is even invoked.
 *   4. fs.mkdir parent of resolved outPath (recursive: true).
 *   5. Sharp pipeline (F8.2 + N3.1):
 *      - per-region path: sharp(sourcePath).resize(W, H, lanczos3, fill)
 *        .png(level 9).toFile(<resolvedOut>.tmp)
 *      - atlas-extract path: sharp(atlasSource.pagePath)
 *        .extract({left,top,width,height}).resize(W, H, lanczos3, fill)
 *        .png(level 9).toFile(<resolvedOut>.tmp)
 *      Rotated regions (atlasSource.rotated === true) are un-rotated
 *      via sharp.rotate(+90) during atlas-extract so the output PNG is
 *      emitted in canonical orientation matching the unrotated source
 *      W×H (Phase 33). Direction VERIFIED EMPIRICALLY — 33-RESEARCH.md
 *      §"Sharp Rotation Direction (Empirical)" + Plan 05 probe.
 *   6. fs.rename(<resolvedOut>.tmp, resolvedOut) per D-121 atomic write.
 *   7. Emit ExportProgressEvent with absolute outPath.
 *   8. Between files: if isCancelled() → break (D-115). In-flight cannot
 *      be aborted mid-libvips; cooperative cancel between files only.
 *
 * Per-file errors are classified by THROW SITE (RESEARCH §Pitfall 7):
 *   - pre-flight access throw + no atlasSource → 'missing-source'
 *   - sharp chain throw                        → 'sharp-error'
 *   - mkdir / rename throw                     → 'write-error'
 *   - path-traversal reject                    → 'write-error'
 *   - NaN/zero-dim reject                      → 'write-error'
 *   - source-vs-output collision               → 'overwrite-source'
 *     (Gap-Fix Round 2 — defense-in-depth; the IPC layer ALSO pre-flights
 *     the same condition and rejects the entire plan up front. This per-row
 *     check inside runExport guards against any future caller that bypasses
 *     the IPC layer; on hit, the row is skipped per D-116 continuation
 *     while other rows still process.)
 *
 * Layer 3 inverse: this file imports sharp + node:fs/promises +
 * node:path. tests/arch.spec.ts (Plan 06-01) Layer 3 grep allows
 * main-process imports of sharp + node:fs unconditionally; only
 * src/core/* is forbidden.
 *
 * Caller: src/main/ipc.ts handleStartExport (Plan 06-05) wraps runExport
 * with the IPC envelope + webContents.send('export:progress', ...) +
 * cancel-flag closure. Tests invoke runExport DIRECTLY (no Electron),
 * mirroring tests/core/ipc.spec.ts handler-extraction discipline.
 *
 * Phase 40 D-04a (writtenPaths accumulator):
 *   - writtenPaths: optional Set<string> accumulator for atomic rollback.
 *     When supplied (Phase 40 'both' mode dispatch in ipc.ts handleStartExport),
 *     every tmpPath + final resolvedOut is added BEFORE the write attempt at
 *     BOTH atomic-write sites (passthrough copy block + per-region resize
 *     block) so ipc.ts's finally-block can fs.rm-sweep on any subsequent
 *     throw (e.g. runRepack failing AFTER runExport already wrote loose PNGs
 *     in 'both' mode). Default `new Set()` preserves backward compatibility
 *     for ALL existing callers — the Set is mutated in-place but never read
 *     inside runExport, so its presence has no observable effect on loose-
 *     mode PNG bytes (REPACK-01 byte-parity invariant; gated by the within-
 *     run SHA256 test at tests/main/image-worker.integration.spec.ts:106).
 */
import sharp from 'sharp';
import { access, copyFile, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
import { dirname, resolve as pathResolve, relative as pathRelative, isAbsolute } from 'node:path';
import type {
  ExportError,
  ExportPlan,
  ExportProgressEvent,
  ExportSummary,
} from '../shared/types.js';
// Phase 40 REPACK-03 / D-03a — shared resize+sharpen helper. Extracted
// 2026-05-14 from this file's former local helpers (applyResizeAndSharpen
// + SHARPEN_SIGMA constant, both removed). Both image-worker resize call
// sites now delegate to resizeToTmpFile so the loose-export and
// atlas-repack workers share ONE source of truth for the resize kernel
// + conditional sharpen gate. REPACK-01 byte-parity invariant: changing
// this helper changes loose-mode export bytes.
import { resizeToTmpFile } from './sharp-resize.js';

export async function runExport(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
  // Gap-Fix Round 3 (2026-04-25) — When true, the per-row source-vs-output
  // defense-in-depth check below is bypassed. The renderer drives this
  // intentionally after the user clicks "Overwrite all" in ConflictDialog;
  // the IPC layer (handleStartExport) forwards the same flag. Defaults to
  // false so direct test invocations and any future caller that bypasses
  // the IPC layer still get the round-2 source-protection behaviour.
  allowOverwrite: boolean = false,
  // Phase 28 SHARP-02 — opt-in unsharp-mask post-resize. Default false
  // preserves the neutral baseline for direct test invocations and any
  // caller bypassing the IPC layer (mirrors allowOverwrite default).
  sharpenEnabled: boolean = false,
  // Phase 40 D-04a — shared rollback accumulator passed in by ipc.ts when
  // dispatching outputMode='both'. Every tmpPath + final resolvedOut is
  // registered BEFORE the atomic write at both atomic-write sites
  // (passthrough copy + per-region resize) so the IPC handler's finally-
  // block can fs.rm-sweep every entry on any throw downstream (e.g. when
  // runRepack throws AFTER runExport already wrote some loose PNGs).
  // Default `new Set()` preserves backward compatibility — every existing
  // caller (direct test invocations, pre-Phase-40 IPC paths, anyone
  // bypassing the IPC layer) continues to work unchanged. The Set is
  // mutated in-place; nothing is read from it inside runExport.
  // RESEARCH §Landmines #7+#8: register BOTH tmpPath AND final path so
  // the sweep is complete regardless of which one landed on disk.
  writtenPaths: Set<string> = new Set(),
): Promise<ExportSummary> {
  const t0 = performance.now();
  const errors: ExportError[] = [];
  let successes = 0;
  // Phase 22 DIMS-04 (Plan 22-04) — single index space across passthrough +
  // resize rows per RESEARCH Item #2 Option B. Total event count = both
  // arrays combined; passthrough rows fire FIRST with index 0..N-1, then
  // resize rows fire with index N..total-1.
  const total = plan.passthroughCopies.length + plan.rows.length;
  const resolvedOutDir = pathResolve(outDir);
  // Phase 6 REVIEW M-03 (2026-04-25) — track whether the loop ACTUALLY
  // broke out of cancellation rather than completing naturally. The
  // previous `cancelled: isCancelled()` at return time conflated "user
  // clicked Cancel mid-run and we skipped rows" (true cancel — D-115)
  // with "user clicked Cancel after the last row already succeeded but
  // before the function returned" (race — every row completed; nothing
  // was skipped). The latter incorrectly poisoned the summary's caption
  // ("N succeeded, 0 failed in Xs — cancelled") even though no work was
  // skipped. Set this flag ONLY when the cooperative pre-iteration
  // check below fires — that is the unambiguous "we stopped because of
  // cancel" signal.
  let bailedOnCancel = false;

  // ---------------------------------------------------------------------
  // Phase 22 DIMS-04 — passthrough byte-copies (D-03). Iterate FIRST so
  // progress events for these rows carry absolute indices 0..N-1 where
  // N = plan.passthroughCopies.length. Resize rows then carry indices
  // N..total-1. Single index space per RESEARCH Item #2 Option B (cleaner
  // for IPC progress event indexing and matches the byte-copy-before-Lanczos
  // user mental model — fast pass-through rows complete first).
  //
  // Steps mirror the resize loop where applicable:
  //   1. Cooperative cancel check (D-115).
  //   2. Pre-flight access(R_OK) on sourcePath. Passthrough has NO
  //      atlas-extract fallback — drift detection requires the per-region
  //      PNG to exist, otherwise dimsMismatch wouldn't have been set in
  //      the first place. Failure → 'missing-source' error.
  //   3. Path-traversal defense (rel.startsWith('..') || isAbsolute || empty).
  //   4. mkdir-recursive parent dir for R8 subfolder support (e.g.
  //      AVATAR/FACE.png needs AVATAR/ created first).
  //   5. copyFile sourcePath → tmpPath, then rename tmpPath → resolvedOut.
  //      Atomic write per Phase 6 D-121 + R4 macOS delayed-allocation safety:
  //      output path only appears when fully written.
  //
  // SKIP the sharp resize pipeline entirely — D-03 contract is "byte-copy,
  // no double Lanczos." The cap formula in buildExportPlan guarantees these
  // rows are at-or-below source ratio, so re-Lanczos would be wasteful AND
  // degrade quality vs simply shipping the source bytes.
  // ---------------------------------------------------------------------
  for (let pi = 0; pi < plan.passthroughCopies.length; pi++) {
    if (isCancelled()) {
      bailedOnCancel = true;
      break;
    }
    const row = plan.passthroughCopies[pi];
    const sourcePath = row.sourcePath;
    const resolvedOut = pathResolve(outDir, row.outPath);
    const i = pi; // absolute event index (passthrough rows fire FIRST)

    // 0. Defense-in-depth overwrite guard (parity with resize loop step 0).
    if (!allowOverwrite) {
      const exists = await access(resolvedOut, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const error: ExportError = {
          kind: 'overwrite-source',
          path: resolvedOut,
          message: `Refusing to overwrite existing file: ${resolvedOut}`,
        };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
    }

    // 1. Pre-flight access(R_OK) on sourcePath. Mirror the resize-loop
    //    atlas-extract fallback (Gap-Fix #2): if the per-region PNG is
    //    absent but atlasSource is present, extract the region from the
    //    atlas page at its native size (no resize). This covers atlas-packed
    //    projects (atlas-source mode) where sourcePath points to images/ but
    //    no individual PNGs exist on disk.
    //
    // Phase 33 WR-03: for ROTATED atlas-source regions, force atlas-extract
    // even when a per-region PNG happens to exist on disk. Per-region PNGs
    // in atlas-source mode are NOT guaranteed canonical-oriented (the atlas
    // page is the authoritative source), so copyFile would silently emit
    // unrotated content. Honors memory `project_strict_loadermode_separation`.
    let passthroughUseAtlasExtract = false;
    if (row.atlasSource?.rotated === true) {
      try {
        await access(row.atlasSource.pagePath, fsConstants.R_OK);
        passthroughUseAtlasExtract = true;
      } catch {
        const error: ExportError = {
          kind: 'missing-source',
          path: row.atlasSource.pagePath,
          message: `Atlas page not readable: ${row.atlasSource.pagePath}`,
        };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
    } else {
    try {
      await access(sourcePath, fsConstants.R_OK);
    } catch {
      if (row.atlasSource) {
        try {
          await access(row.atlasSource.pagePath, fsConstants.R_OK);
          passthroughUseAtlasExtract = true;
        } catch {
          const error: ExportError = {
            kind: 'missing-source',
            path: row.atlasSource.pagePath,
            message: `Atlas page not readable: ${row.atlasSource.pagePath}`,
          };
          errors.push(error);
          onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
          continue;
        }
      } else {
        const error: ExportError = {
          kind: 'missing-source',
          path: sourcePath,
          message: `Source file not readable: ${sourcePath}`,
        };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
    }
    }

    // 2. Path-traversal defense — same shape as resize loop step 2.
    const relPassthrough = pathRelative(resolvedOutDir, resolvedOut);
    if (relPassthrough.startsWith('..') || isAbsolute(relPassthrough) || relPassthrough === '') {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: `Output path escapes outDir or equals outDir: ${row.outPath}`,
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 3. mkdir parent for R8 subfolder paths (e.g. AVATAR/FACE.png).
    try {
      await mkdir(dirname(resolvedOut), { recursive: true });
    } catch (e) {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: `Failed to create output directory: ${e instanceof Error ? e.message : String(e)}`,
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 4. Write to tmpPath, then rename — atomic write per Phase 6 D-121
    //    + R4 macOS delayed-allocation safety. The output path only appears
    //    when fully written.
    //    Two sub-paths:
    //    (a) per-region PNG on disk → copyFile (byte-identical, fast)
    //    (b) atlas-extract fallback → sharp extract at native region size
    const tmpPath = resolvedOut + '.tmp';
    // Phase 40 D-04a: register both paths for atomic rollback (RESEARCH §
    // Landmines #7+#8 — tmp may orphan if rename throws; final may exist if
    // copyFile/toFile succeeded; sweeping both with { force: true } is safe).
    // Default empty Set when called outside the Phase 40 'both' dispatch
    // makes this a no-op for every pre-Phase-40 caller.
    writtenPaths.add(tmpPath);
    writtenPaths.add(resolvedOut);
    try {
      if (passthroughUseAtlasExtract && row.atlasSource) {
        const a = row.atlasSource;
        // Extract the trimmed rect that physically exists on the page PNG.
        // For Strip-Whitespace regions packW/H < w/h; for non-SW regions
        // packW/H === w/h and the extract dims match exactly.
        let pipeline = sharp(a.pagePath).extract({
          left: a.x,
          top: a.y,
          width: a.packW,
          height: a.packH,
        });
        if (a.rotated) {
          // Phase 33 D-03 — un-rotate Spine-CCW-packed region back to
          // canonical orientation. Direction VERIFIED EMPIRICALLY in
          // 33-RESEARCH.md §"Sharp Rotation Direction (Empirical)" (CONTEXT
          // D-03 hypothesis of -90 was falsified): sharp.rotate(+90) cancels
          // CCW packing per libgdx atlas convention. Re-probed for Plan 05
          // via scripts/probe-sharp-rotate.mjs before shipping.
          pipeline = pipeline.rotate(90);
        }
        // Reconstitute the orig canvas when Strip Whitespace was on. Output
        // becomes a w×h canvas with the trimmed pixels positioned at
        // offsetX/Y from the bottom-left — matches a plain Spine export of
        // the same PNG with Strip Whitespace OFF. Passthrough is 1:1 (no
        // resize), so chaining .extend() before .toFile() is correct here.
        //
        // For rotated regions the buffer is now packH × packW (swapped by
        // the rotate above), so extend args MUST use post-rotation canonical
        // orientation. Derived locals encode the swap; non-rotated rows are
        // mathematically equivalent to the previous code.
        const sourceCanvasW = a.rotated ? a.packH : a.packW;
        const sourceCanvasH = a.rotated ? a.packW : a.packH;
        if (sourceCanvasW !== a.w || sourceCanvasH !== a.h) {
          pipeline = pipeline.extend({
            top: a.h - a.offsetY - sourceCanvasH,
            bottom: a.offsetY,
            left: a.offsetX,
            right: a.w - a.offsetX - sourceCanvasW,
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          });
        }
        await pipeline.toFile(tmpPath);
      } else {
        await copyFile(sourcePath, tmpPath);
      }
    } catch (e) {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: e instanceof Error ? e.message : String(e),
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }
    try {
      await rename(tmpPath, resolvedOut);
    } catch (e) {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: e instanceof Error ? e.message : String(e),
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 5. Success.
    successes++;
    onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'success' });
  }

  // Phase 22 DIMS-04 — resize loop now uses absolute event index =
  // plan.passthroughCopies.length + ri. The base counter `ri` is the
  // resize-row local index; `i` is the absolute IPC event index. This
  // preserves the single-index-space contract (RESEARCH Item #2 Option B)
  // for IPC consumers without changing the resize loop's per-row logic.
  const passthroughOffset = plan.passthroughCopies.length;
  for (let ri = 0; ri < plan.rows.length; ri++) {
    const i = passthroughOffset + ri;
    // D-115: cooperative cancel between files. In-flight cannot be aborted
    // mid-libvips; this check at the top of every iteration is the contract.
    if (isCancelled()) {
      bailedOnCancel = true;
      break;
    }

    const row = plan.rows[ri];
    const sourcePath = row.sourcePath;
    const resolvedOut = pathResolve(outDir, row.outPath);

    // 0. Gap-Fix Round 4 (2026-04-25) — defense-in-depth overwrite guard.
    //    Collision = "the resolved output path currently exists on disk".
    //    The earlier round-2/3 synchronous string-match check against
    //    sourcePath / atlasSource.pagePath false-positived: the loader
    //    constructs sourcePath as <skeletonDir>/images/<regionName>.png even
    //    for atlas-only projects, so any outDir landing on the same path
    //    string triggered the alarm even when the file was already deleted.
    //    Existence on disk (F_OK) is the only correct gate.
    //
    //    Gated on `allowOverwrite`: when the renderer's ConflictDialog
    //    "Overwrite all" branch invoked startExport with overwrite=true,
    //    the IPC layer forwards allowOverwrite=true here and we skip the
    //    check entirely. Default false preserves the safe behaviour for
    //    direct test invocations and any caller bypassing the IPC pre-flight.
    if (!allowOverwrite) {
      const exists = await access(resolvedOut, fsConstants.F_OK)
        .then(() => true)
        .catch(() => false);
      if (exists) {
        const error: ExportError = {
          kind: 'overwrite-source',
          path: resolvedOut,
          message: `Refusing to overwrite existing file: ${resolvedOut}`,
        };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
    }

    // 1. Pre-flight per D-112. Decide which sharp pipeline to use:
    //    - per-region PNG exists  → use sourcePath (existing path)
    //    - per-region PNG missing AND atlasSource present → atlas-extract
    //      fallback (Gap-Fix #2; Jokerman-style atlas-packed projects)
    //    - per-region PNG missing AND no atlasSource → 'missing-source'
    //
    //    'useAtlasExtract' captures the chosen pipeline; the sharp call
    //    in step 5 branches on it.
    //
    // Phase 33 WR-03: for ROTATED atlas-source regions, force atlas-extract
    // even when a per-region PNG happens to exist on disk (atlas page is
    // authoritative; per-region PNGs not guaranteed canonical-oriented).
    let useAtlasExtract = false;
    if (row.atlasSource?.rotated === true) {
      try {
        await access(row.atlasSource.pagePath, fsConstants.R_OK);
        useAtlasExtract = true;
      } catch {
        const error: ExportError = {
          kind: 'missing-source',
          path: row.atlasSource.pagePath,
          message: `Atlas page not readable: ${row.atlasSource.pagePath}`,
        };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
    } else {
    try {
      await access(sourcePath, fsConstants.R_OK);
    } catch {
      if (row.atlasSource) {
        // Validate the atlas page is itself readable before committing
        // to the extract path; if the page is also missing, surface as
        // 'missing-source' against the page path so the user knows
        // which file to find/restore.
        try {
          await access(row.atlasSource.pagePath, fsConstants.R_OK);
          useAtlasExtract = true;
        } catch {
          const error: ExportError = {
            kind: 'missing-source',
            path: row.atlasSource.pagePath,
            message: `Atlas page not readable: ${row.atlasSource.pagePath}`,
          };
          errors.push(error);
          onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
          continue;
        }
      } else {
        const error: ExportError = {
          kind: 'missing-source',
          path: sourcePath,
          message: `Source file not readable: ${sourcePath}`,
        };
        errors.push(error);
        onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
        continue;
      }
    }
    }

    // 2. Path-traversal defense. Resolves outPath against outDir and
    //    rejects any escape via '..', absolute paths, or the degenerate
    //    case where rel === '' (outPath equals outDir itself).
    const rel = pathRelative(resolvedOutDir, resolvedOut);
    if (rel.startsWith('..') || isAbsolute(rel) || rel === '') {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: `Output path escapes outDir or equals outDir: ${row.outPath}`,
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 3. NaN / zero-dim guard. Defensive against future sampler regressions
    //    producing non-finite peakScale; rejects with 'write-error' BEFORE
    //    sharp is invoked so the user sees a clean dimension error rather
    //    than a libvips internal complaint.
    if (
      !Number.isFinite(row.outW) || !Number.isFinite(row.outH) ||
      row.outW <= 0 || row.outH <= 0
    ) {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: `Invalid output dimensions: outW=${row.outW}, outH=${row.outH}`,
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 4. Ensure parent dir exists. mkdir failure → 'write-error'.
    try {
      await mkdir(dirname(resolvedOut), { recursive: true });
    } catch (e) {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: `Failed to create output directory: ${e instanceof Error ? e.message : String(e)}`,
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 5. Sharp resize + PNG encode → tmp file. F8.2 verbatim:
    //    Per-region path:
    //      sharp(srcPath).resize(W, H, lanczos3, fill)
    //        .png(level 9).toFile(tmpPath)
    //    Atlas-extract path (Gap-Fix #2):
    //      sharp(atlasPagePath).extract({left,top,width,height})
    //        .resize(W, H, lanczos3, fill)
    //        .png(level 9).toFile(tmpPath)
    //    Tmp suffix derived from resolvedOut (same dir → rename atomic).
    const tmpPath = resolvedOut + '.tmp';
    // Phase 40 D-04a: register both paths for atomic rollback (RESEARCH §
    // Landmines #7+#8 — tmp may orphan if rename throws; final may exist if
    // toFile succeeded; sweeping both with { force: true } is safe). Default
    // empty Set when called outside the Phase 40 'both' dispatch makes this
    // a no-op for every pre-Phase-40 caller; loose-mode PNG bytes are
    // unaffected (REPACK-01 byte-parity invariant).
    writtenPaths.add(tmpPath);
    writtenPaths.add(resolvedOut);
    try {
      if (useAtlasExtract && row.atlasSource) {
        // sharp.extract uses {left, top, width, height} in PAGE-PNG coords.
        // We pass the trimmed page bounds (atlasSource.packW/H — the actual
        // pixel rect on disk). Strip Whitespace regions then need extend()
        // to reconstitute the orig canvas before resize — downstream
        // outW/outH are computed from canonicalW (orig dims) per
        // computeExportDims, so the resize input must also be orig-sized.
        // Phase 28 SHARP-02 / Phase 40 D-03a: both branches collapse onto
        // resizeToTmpFile (sharp-resize.ts) so the downscale-only sharpen
        // gate (D-07) + sigma constant (D-05) live in ONE place; D-08
        // enforces both call sites covered.
        //
        // 2026-05-08 fix (debug session export-extract-area-bad-area):
        // previously passed atlasSource.w/h directly which overshot the
        // page on Strip-Whitespace regions → libvips "extract_area: bad
        // extract area". Sharp orders pipeline operations as
        //   pre-extract → resize → extend → composite → post-extract
        // regardless of chain order, so a single .extract().extend().resize()
        // pipeline yields (resize_target + 2*padding) — wrong. For SW
        // regions we materialize the extend output to a Buffer first, then
        // re-open as a fresh pipeline that contains only the orig-canvas
        // pixels, and feed that to resizeToTmpFile.
        const a = row.atlasSource;
        let pipeline: sharp.Sharp;
        // Phase 33 D-03 — post-rotation canonical orientation. For rotated
        // rows the buffer becomes packH × packW (swapped) after .rotate(+90);
        // SW extend args MUST use post-rotation dims. Non-rotated rows are
        // mathematically equivalent to the prior code (sourceCanvasW=packW,
        // sourceCanvasH=packH), so existing SW + atlas-extract tests stay green.
        const sourceCanvasW = a.rotated ? a.packH : a.packW;
        const sourceCanvasH = a.rotated ? a.packW : a.packH;
        if (sourceCanvasW !== a.w || sourceCanvasH !== a.h) {
          // Two-pipeline (SW path): materialize extend output, then re-open.
          // Mirrors the original SW fix for libvips operation reordering
          // (RESEARCH §"Pitfall 4: Sharp pipeline order"). Rotation slots
          // into the pre-pipeline BEFORE .toBuffer() so the materialized
          // canvas is in canonical orientation when resizeToTmpFile
          // sees it.
          let pre = sharp(a.pagePath).extract({
            left: a.x, top: a.y, width: a.packW, height: a.packH,
          });
          if (a.rotated) {
            // Phase 33 D-03 — direction VERIFIED EMPIRICALLY (see passthrough
            // comment + scripts/probe-sharp-rotate.mjs).
            pre = pre.rotate(90);
          }
          const orig = await pre
            .extend({
              top: a.h - a.offsetY - sourceCanvasH,
              bottom: a.offsetY,
              left: a.offsetX,
              right: a.w - a.offsetX - sourceCanvasW,
              background: { r: 0, g: 0, b: 0, alpha: 0 },
            })
            .png()
            .toBuffer();
          pipeline = sharp(orig);
        } else if (a.rotated) {
          // No SW + rotated — two-pipeline. Libvips fuses extract().rotate(90).resize()
          // and validates the extract rect against the POST-rotate canvas dims
          // (axes swapped), so any region where `a.x + a.packW > pageHeight` trips
          // `extract_area: bad extract area`. Materializing the rotated buffer to PNG
          // bytes breaks the fusion. Mirrors the SW path's materialize-then-resize.
          const rotated = await sharp(a.pagePath)
            .extract({ left: a.x, top: a.y, width: a.packW, height: a.packH })
            .rotate(90)
            .png()
            .toBuffer();
          pipeline = sharp(rotated);
        } else {
          // No SW + non-rotated — single pipeline.
          pipeline = sharp(a.pagePath).extract({
            left: a.x,
            top: a.y,
            width: a.packW,
            height: a.packH,
          });
        }
        await resizeToTmpFile(
          pipeline,
          row.outW,
          row.outH,
          row.effectiveScale,
          sharpenEnabled,
        ).toFile(tmpPath);
      } else {
        await resizeToTmpFile(
          sharp(sourcePath),
          row.outW,
          row.outH,
          row.effectiveScale,
          sharpenEnabled,
        ).toFile(tmpPath);
      }
    } catch (e) {
      const error: ExportError = {
        kind: 'sharp-error',
        path: useAtlasExtract && row.atlasSource ? row.atlasSource.pagePath : sourcePath,
        message: e instanceof Error ? e.message : String(e),
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 6. Atomic rename per D-121. Same-filesystem so rename is atomic
    //    (RESEARCH §Pitfall 6 — cross-filesystem rename falls back to
    //    copy+unlink which is NOT atomic; we avoid this by writing tmp
    //    next to the final path).
    try {
      await rename(tmpPath, resolvedOut);
    } catch (e) {
      const error: ExportError = {
        kind: 'write-error',
        path: resolvedOut,
        message: e instanceof Error ? e.message : String(e),
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
    }

    // 7. Success.
    successes++;
    onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'success' });
  }

  const durationMs = performance.now() - t0;
  return {
    successes,
    errors,
    outputDir: resolvedOutDir,
    durationMs,
    // Phase 6 REVIEW M-03 (2026-04-25) — return the loop-internal
    // bailedOnCancel flag, NOT a fresh isCancelled() probe. A Cancel
    // click that arrives AFTER the last row already succeeded but BEFORE
    // the function returns must NOT poison the summary as cancelled —
    // every row completed and no work was skipped (D-115 contract:
    // cooperative cancel BETWEEN files; not a post-hoc retroactive flag).
    cancelled: bailedOnCancel,
  };
}
