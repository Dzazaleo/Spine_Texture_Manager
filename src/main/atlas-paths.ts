/**
 * Phase 40 UAT Round 3 (2026-05-15) — shared project-name + page-filename
 * derivation for atlas-mode output.
 *
 * Why a shared module: `probeExportConflicts` (src/main/ipc.ts) and
 * `runRepack` (src/main/repack-worker.ts) must agree byte-for-byte on the
 * filenames atlas-mode writes to `outDir`. Pre-Round-3 the helpers were
 * private to repack-worker, so the probe blind to atlas targets — it only
 * checked the loose-mode `plan.rows[].outPath` paths under
 * `outDir/images/...`. Re-running atlas export against an outDir that
 * already held `{projectName}.png` + `{projectName}.atlas` skipped the
 * ConflictDialog and ran into repack-worker's defensive existence check at
 * write time (locked error `repack-worker: page PNG already exists at ...`).
 *
 * Contract:
 *   - `deriveProjectName(plan, outDir)` — outDir basename preferred (the
 *     renderer-chosen folder name maps naturally to `{projectName}.atlas`);
 *     falls back to skeleton-derived row basename when outDir is unusable
 *     (e.g. `:` on Windows drive roots).
 *   - `pageFilename(projectName, pageIndex)` — page 0 → `{projectName}.png`;
 *     page N (N >= 1) → `{projectName}_{N+1}.png`. Matches REPACK-05 spec
 *     and the spine-runtime atlas convention.
 */
import { basename, resolve as pathResolve } from 'node:path';

import type { ExportPlan } from '../shared/types.js';

/**
 * Derive the project basename used for `{projectName}.atlas` and
 * `{projectName}_N.png`. Preferred source is the outDir basename — the
 * renderer sets outDir, so the user's chosen folder name maps naturally
 * to the atlas filename. Falls back to the first row's sourcePath basename
 * (stripped of `.png` / `.json`) when outDir is unusable.
 *
 * Throws when both sources are unusable; this is a defensive guard — under
 * the IPC contract `outDir` is a non-empty string and `plan.rows` is
 * always present (validated at the trust boundary).
 */
export function deriveProjectName(plan: ExportPlan, outDir: string): string {
  const fromDir = basename(pathResolve(outDir));
  if (fromDir && !fromDir.includes(':')) return fromDir;

  const fromRow = plan.rows[0]?.sourcePath;
  if (fromRow) {
    const name = basename(fromRow).replace(/\.(png|json)$/i, '');
    if (name && !name.includes(':')) return name;
  }

  throw new Error(
    'atlas-paths: could not derive projectName (outDir + skeleton sourcePath both unusable).',
  );
}

/**
 * Derive the per-page filename. Page 0 is `{projectName}.png`; page N
 * (N >= 1) is `{projectName}_{N+1}.png`. Matches REPACK-05 lock and the
 * spine-runtime convention (`{name}.png`, `{name}_2.png`, ...).
 */
export function pageFilename(projectName: string, pageIndex: number): string {
  if (pageIndex === 0) return `${projectName}.png`;
  return `${projectName}_${pageIndex + 1}.png`;
}
