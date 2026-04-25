/**
 * Phase 6 Plan 04 — Main-process export worker (F8.2 + F8.4 + F8.5 + N3.1).
 *
 * runExport(plan, outDir, onProgress, isCancelled) walks ExportPlan.rows
 * sequentially, performing per-row:
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
 *      Rotated regions (atlasSource.rotated === true) emit
 *      'rotated-region-unsupported' BEFORE invoking sharp — first-pass
 *      Gap-Fix #2 refuses to attempt the rotated extract.
 *   6. fs.rename(<resolvedOut>.tmp, resolvedOut) per D-121 atomic write.
 *   7. Emit ExportProgressEvent with absolute outPath.
 *   8. Between files: if isCancelled() → break (D-115). In-flight cannot
 *      be aborted mid-libvips; cooperative cancel between files only.
 *
 * Per-file errors are classified by THROW SITE (RESEARCH §Pitfall 7):
 *   - pre-flight access throw + no atlasSource → 'missing-source'
 *   - rotated atlasSource refusal              → 'rotated-region-unsupported'
 *   - sharp chain throw                        → 'sharp-error'
 *   - mkdir / rename throw                     → 'write-error'
 *   - path-traversal reject                    → 'write-error'
 *   - NaN/zero-dim reject                      → 'write-error'
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
 */
import sharp from 'sharp';
import { access, mkdir, rename, constants as fsConstants } from 'node:fs/promises';
import { dirname, resolve as pathResolve, relative as pathRelative, isAbsolute } from 'node:path';
import type {
  ExportError,
  ExportPlan,
  ExportProgressEvent,
  ExportSummary,
} from '../shared/types.js';

export async function runExport(
  plan: ExportPlan,
  outDir: string,
  onProgress: (e: ExportProgressEvent) => void,
  isCancelled: () => boolean,
): Promise<ExportSummary> {
  const t0 = performance.now();
  const errors: ExportError[] = [];
  let successes = 0;
  const total = plan.rows.length;
  const resolvedOutDir = pathResolve(outDir);

  for (let i = 0; i < plan.rows.length; i++) {
    // D-115: cooperative cancel between files. In-flight cannot be aborted
    // mid-libvips; this check at the top of every iteration is the contract.
    if (isCancelled()) break;

    const row = plan.rows[i];
    const sourcePath = row.sourcePath;
    const resolvedOut = pathResolve(outDir, row.outPath);

    // 1. Pre-flight per D-112. Decide which sharp pipeline to use:
    //    - per-region PNG exists  → use sourcePath (existing path)
    //    - per-region PNG missing AND atlasSource present → atlas-extract
    //      fallback (Gap-Fix #2; Jokerman-style atlas-packed projects)
    //    - per-region PNG missing AND no atlasSource → 'missing-source'
    //
    //    'useAtlasExtract' captures the chosen pipeline; the sharp call
    //    in step 5 branches on it.
    let useAtlasExtract = false;
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

    // Gap-Fix #2: rotated regions are unsupported in this first pass.
    // Surface as a clear typed error rather than silently producing
    // 90°-wrong output. Jokerman has 0 rotated regions; if a real
    // rotated asset arrives, a follow-up phase can add rotation
    // handling (sharp.rotate(±90) before resize).
    if (useAtlasExtract && row.atlasSource && row.atlasSource.rotated) {
      const error: ExportError = {
        kind: 'rotated-region-unsupported',
        path: row.atlasSource.pagePath,
        message:
          `Atlas region for ${row.attachmentNames.join(', ')} is rotated; rotation handling not yet implemented. ` +
          `Re-export from Spine with rotation disabled, or wait for a follow-up phase.`,
      };
      errors.push(error);
      onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
      continue;
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
    try {
      if (useAtlasExtract && row.atlasSource) {
        // sharp.extract uses {left, top, width, height}. We pass the
        // SOURCE-orig dims (atlasSource.w/h) as the extract size — for
        // non-rotated regions these match the packed bounds W/H exactly,
        // and rotated regions are blocked above.
        await sharp(row.atlasSource.pagePath)
          .extract({
            left: row.atlasSource.x,
            top: row.atlasSource.y,
            width: row.atlasSource.w,
            height: row.atlasSource.h,
          })
          .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
          .png({ compressionLevel: 9 })
          .toFile(tmpPath);
      } else {
        await sharp(sourcePath)
          .resize(row.outW, row.outH, { kernel: 'lanczos3', fit: 'fill' })
          .png({ compressionLevel: 9 })
          .toFile(tmpPath);
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
    cancelled: isCancelled(),
  };
}
