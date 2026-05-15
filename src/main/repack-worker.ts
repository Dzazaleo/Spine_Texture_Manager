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
  rename,
  mkdir,
  access,
  constants as fsConstants,
} from 'node:fs/promises';
import { basename, join, resolve as pathResolve } from 'node:path';

import { computeRepack } from '../core/repack.js';
import type { RepackInput } from '../core/repack.js';
import { buildAtlasText } from './atlas-writer.js';
import { resizeToBuffer } from './sharp-resize.js';
import type { ExportPlan, ExportProgressEvent } from '../shared/types.js';

export interface AtlasOpts {
  maxPageSize: 1024 | 2048 | 4096 | 8192;
  allowRotation: boolean;
  padding: number;
}

export interface RepackResultPaths {
  pageFiles: string[];
  atlasFile: string;
}

/**
 * Derive the project basename used for {projectName}.atlas and
 * {projectName}_N.png. Per RESEARCH §Landmines #16 / Assumption A1:
 * preferred source is the per-row sourcePath basename (matches Spine's
 * exporter convention where the per-region PNG basename is the region
 * name; the *project* basename is derived from the outDir or the
 * skeleton path). Falls back to outDir basename if no row exists.
 *
 * The Phase 40 IPC handler (Plan 06) will eventually thread an explicit
 * skeleton basename through ExportPlan. Until then the contract is:
 * derive from outDir basename, which the renderer can name freely
 * (typical pattern: user picks {project}-export/ as the output folder).
 */
function deriveProjectName(plan: ExportPlan, outDir: string): string {
  // Prefer outDir basename — the renderer sets outDir, so the user's
  // chosen folder name maps naturally to {projectName}.atlas. Strips
  // common suffixes that would produce ugly atlas names.
  const fromDir = basename(pathResolve(outDir));
  if (fromDir && !fromDir.includes(':')) return fromDir;

  // Fallback: skeleton basename via first row's sourcePath.
  const fromRow = plan.rows[0]?.sourcePath;
  if (fromRow) {
    const name = basename(fromRow).replace(/\.(png|json)$/i, '');
    if (name && !name.includes(':')) return name;
  }

  throw new Error(
    'repack-worker: could not derive projectName (outDir + skeleton sourcePath both unusable).',
  );
}

function pageFilename(projectName: string, pageIndex: number): string {
  if (pageIndex === 0) return `${projectName}.png`;
  return `${projectName}_${pageIndex + 1}.png`;
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
  const projectName = deriveProjectName(plan, outDir);
  const resolvedOutDir = pathResolve(outDir);

  // Ensure output dir exists (mirrors image-worker.ts mkdir behavior).
  await mkdir(resolvedOutDir, { recursive: true });

  // -------- Step 1+2: Resize phase + sharp-emits-truth read-back --------
  // Map keyed by regionName (= attachmentNames[0]) — the loader-mode-invariant
  // identifier per project_strict_loadermode_separation memory + RESEARCH
  // §Landmines #9. computeRepack uses the SAME key for its sort.
  //
  // UAT bug 1 (2026-05-15): when N skeletons share source PNGs (the SKINS
  // workflow), plan.rows can contain N entries with the same
  // attachmentNames[0]. WITHOUT dedup the packer received N copies of the
  // same regionName and laid them out at N different positions → the .atlas
  // contained duplicate entries (e.g. AVATAR/BODY × 7) and the page PNG
  // had overlapping regions. Fix: dedup repackInputs by regionName, FIRST
  // OCCURRENCE WINS (deterministic — preserves row-0's resize result). The
  // regionBuffers Map already deduped naturally (Map by key); we mirror the
  // same key discipline on the inputs array. computeRepack's localeCompare
  // sort guarantees pack-order determinism regardless of insertion order.
  const regionBuffers = new Map<string, Buffer>();
  const repackInputsByName = new Map<string, RepackInput>();

  for (let i = 0; i < plan.rows.length; i++) {
    if (isCancelled()) {
      throw new Error('cancelled');
    }
    const row = plan.rows[i];
    const regionName = row.attachmentNames?.[0] ?? row.outPath;

    // Dedup: skip subsequent rows for the same regionName. First occurrence
    // wins (its resized buffer + packW/H is what lands in the atlas).
    if (repackInputsByName.has(regionName)) {
      onProgress({
        index: i,
        total: plan.rows.length,
        path: regionName,
        outPath: '',
        status: 'success',
        phase: 'resize',
      });
      continue;
    }

    const resized = await resizeToBuffer(
      sharp(row.sourcePath),
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
      total: plan.rows.length,
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

    onProgress({
      index: pi,
      total: packResult.pages.length,
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

  return { pageFiles, atlasFile: atlasPath };
}
