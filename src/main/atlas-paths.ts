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
 * Contract (precedence inverted 2026-05-15 — debug session
 * `atlas-repack-output-bugs`):
 *   - `deriveProjectName(plan, outDir)` — JSON / first-row sourcePath
 *     basename PREFERRED (the source identity the user expects to see
 *     in the output, and what the spine-player will use to find the
 *     sibling .atlas under app-image://). Falls back to outDir basename
 *     when the row's sourcePath is unusable. Pre-2026-05-15 the
 *     precedence was reversed, which produced `test_repack.atlas` +
 *     `test_repack.png` for any user who exported to a folder named
 *     `test_repack/` (regardless of the input JSON's actual name).
 *   - `pageFilename(projectName, pageIndex)` — page 0 → `{projectName}.png`;
 *     page N (N >= 1) → `{projectName}_{N+1}.png`. Matches REPACK-05 spec
 *     and the spine-runtime atlas convention.
 */
import { basename, resolve as pathResolve } from 'node:path';

import type { ExportPlan } from '../shared/types.js';

/**
 * Derive the project basename used for `{projectName}.atlas` and
 * `{projectName}_N.png`.
 *
 * Precedence (inverted 2026-05-15 — debug session
 * `atlas-repack-output-bugs`):
 *   1. PRIMARY: first row's `sourcePath` basename (stripped of `.json` /
 *      `.png`). This is the source identity the user expects to see in
 *      the output — naming the atlas `JOKERMAN_SPINE_ROT` for a JSON of
 *      that name is what the Animation Viewer needs to find sibling
 *      `.atlas` references via `app-image://`. The renderer always
 *      populates `plan.rows[0].sourcePath` at plan-build time.
 *   2. FALLBACK: outDir basename (`basename(pathResolve(outDir))`).
 *      Preserves a defensive path for synthetic plans missing rows
 *      (every shipping codepath has rows, but the guard avoids a hard
 *      crash on edge cases).
 *
 * Throws when both sources are unusable; this is a defensive guard — under
 * the IPC contract `outDir` is a non-empty string and `plan.rows` is
 * always present (validated at the trust boundary).
 */
export function deriveProjectName(plan: ExportPlan, outDir: string): string {
  // PRIMARY: derive from the first row's sourcePath basename. The renderer
  // populates plan.rows[0] from the loaded skeleton's JSON path (atlas-less
  // mode) or first region PNG (atlas-source mode); both share the same
  // basename root (`JOKERMAN_SPINE_ROT.json` and `JOKERMAN_SPINE_ROT.png`
  // both yield `JOKERMAN_SPINE_ROT`). The `:` guard rejects Windows drive
  // roots that would corrupt libgdx page-header parsing.
  const fromRow = plan.rows[0]?.sourcePath;
  if (fromRow) {
    const name = basename(fromRow).replace(/\.(png|json)$/i, '');
    if (name && !name.includes(':')) return name;
  }

  // FALLBACK: outDir basename. Preserves the legacy defensive path for
  // synthetic plans without rows (none in production, but a hard crash
  // on edge cases is worse than a folder-derived name).
  const fromDir = basename(pathResolve(outDir));
  if (fromDir && !fromDir.includes(':')) return fromDir;

  throw new Error(
    'atlas-paths: could not derive projectName (skeleton sourcePath + outDir both unusable).',
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
