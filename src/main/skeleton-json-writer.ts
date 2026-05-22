import { writeFile, rename, mkdir } from 'node:fs/promises';
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
 */
export async function writeSkeletonJsonAtomic(
  finalPath: string,
  baked: Record<string, unknown>,
  written: Set<string>,
): Promise<void> {
  const tmpPath = finalPath + '.tmp';
  written.add(tmpPath); // rollback completeness FIRST (before any write)
  written.add(finalPath);
  await mkdir(dirname(finalPath), { recursive: true }); // create {NAME}@{s}x/
  await writeFile(tmpPath, JSON.stringify(baked), 'utf8');
  await rename(tmpPath, finalPath); // atomic on POSIX; best-effort on Windows
}
