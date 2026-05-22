import { writeFile, rename, mkdir, access, constants as fsConstants } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * Phase 49 L-03 — the FIRST feature in the app's history to write a skeleton
 * JSON. Atomic `.tmp`+`rename` (model: src/main/project-io.ts:253-280) with the
 * shared-`written`-set registration discipline (src/main/image-worker.ts:285-292):
 * register BOTH paths BEFORE the write so the orchestrator's rollback sweep is
 * complete even if the write half-lands (force-rm swallows ENOENT).
 *
 * DIVERGENCE from writeProjectFileAtomic (49-PATTERNS): this THROWS on failure
 * (so the orchestrator's shared `catch` sweeps it via the `written` Set) and uses
 * NO JSON indent (drop-in faithfulness — the spine parser ignores whitespace).
 *
 * CR-01: honor the same `overwrite` gate the image/repack workers enforce
 * (image-worker.ts:177-192). Previously the JSON was overwritten UNCONDITIONALLY
 * while the workers refused to overwrite existing textures (overwrite=false) —
 * so re-exporting into an existing {NAME}@{s}x/ folder silently replaced
 * {NAME}.json but kept the OLD textures, producing a mismatched package. With
 * the gate, an existing {NAME}.json + overwrite=false THROWS, which the
 * orchestrator's step-10 catch turns into a rolled-back error envelope (no
 * silent corruption); the renderer surfaces it (CR-01 result-surfacing fix).
 */
export async function writeSkeletonJsonAtomic(
  finalPath: string,
  baked: Record<string, unknown>,
  written: Set<string>,
  allowOverwrite: boolean = true,
): Promise<void> {
  // CR-01 overwrite gate — mirror image-worker.ts:177-192. Refuse (throw) when
  // the target already exists and overwrite was not granted, so the JSON is not
  // replaced while the workers refuse the textures.
  if (!allowOverwrite) {
    const exists = await access(finalPath, fsConstants.F_OK)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      throw new Error(`Refusing to overwrite existing file: ${finalPath}`);
    }
  }
  const tmpPath = finalPath + '.tmp';
  written.add(tmpPath); // rollback completeness FIRST (before any write)
  written.add(finalPath);
  await mkdir(dirname(finalPath), { recursive: true }); // create {NAME}@{s}x/
  await writeFile(tmpPath, JSON.stringify(baked), 'utf8');
  await rename(tmpPath, finalPath); // atomic on POSIX; best-effort on Windows
}
