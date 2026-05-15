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
 * Contract (precedence refactored 2026-05-15 round 2 — debug session
 * `atlas-repack-output-bugs`):
 *   - `deriveProjectName(plan, outDir)` — `plan.skeletonPath` basename
 *     PREFERRED (the canonical source identity, threaded explicitly by
 *     `buildExportPlan` from `BuildExportPlanOptions.skeletonPath`). Falls
 *     back to outDir basename only when `plan.skeletonPath` is missing
 *     (synthetic test plans, defensive). The earlier round-1 fix
 *     (commit `e82bc87`) read `plan.rows[0].sourcePath` basename as the
 *     primary, which was wrong in atlas-source mode: row 0's `sourcePath`
 *     carries a per-attachment PNG (e.g. `images/BEACHMAN/BODY.png`), not
 *     the skeleton JSON. That made repack output `BODY.atlas` for a
 *     skeleton called `JOKERMAN_SPINE_ROT.json`. Threading the skeleton
 *     path through the plan removes the ambiguity end-to-end.
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
 * Precedence (refactored 2026-05-15 round 2 — debug session
 * `atlas-repack-output-bugs`):
 *   1. PRIMARY: `plan.skeletonPath` basename (stripped of `.json`). This
 *      is the canonical source identity, threaded explicitly by
 *      `buildExportPlan` from `BuildExportPlanOptions.skeletonPath` at
 *      plan-build time (renderer always knows it via
 *      `summary.skeletonPath`). The `:` guard rejects Windows drive
 *      roots that would corrupt libgdx page-header parsing.
 *   2. FALLBACK: outDir basename (`basename(pathResolve(outDir))`).
 *      Preserves a defensive path for synthetic test plans that omit
 *      `skeletonPath` (production code paths all populate it; the
 *      `ExportPlan.skeletonPath` field is typed required, so this branch
 *      only fires when a test passes a structurally-loose plan).
 *
 * Throws when both sources are unusable; defensive guard for malformed
 * inputs at the IPC trust boundary.
 *
 * History:
 *   - Round 1 (2026-05-15 commit `e82bc87`) read
 *     `basename(plan.rows[0]?.sourcePath).replace(/\\.(png|json)$/, '')`
 *     as primary. The docblock asserted that row 0's `sourcePath` shared
 *     a basename with the JSON in both loader modes; in atlas-source
 *     mode that's FALSE — `sourcePath` is the per-region PNG (e.g.
 *     `images/BEACHMAN/BODY.png`), not the skeleton JSON. Verified
 *     against user-reported `JOKERMAN_SPINE_ROT.json` export which
 *     produced `BODY.atlas` instead.
 *   - Round 2 (2026-05-15) threads `skeletonPath` through ExportPlan
 *     so the source identity is explicit and inferred from nothing.
 */
export function deriveProjectName(plan: ExportPlan, outDir: string): string {
  // PRIMARY: read the skeleton path explicitly threaded onto the plan by
  // buildExportPlan. The renderer always populates this from
  // summary.skeletonPath at plan-build time. Strip `.json` (case-insensitive)
  // and reject Windows drive roots (basename of `C:` is `C:` which would
  // corrupt libgdx page-header parsing).
  const fromSkeleton = plan.skeletonPath;
  if (fromSkeleton) {
    const name = basename(fromSkeleton).replace(/\.json$/i, '');
    if (name && !name.includes(':')) return name;
  }

  // FALLBACK: outDir basename. Preserves a defensive path for synthetic
  // test plans without skeletonPath (production code paths all populate
  // it via the now-required BuildExportPlanOptions.skeletonPath).
  const fromDir = basename(pathResolve(outDir));
  if (fromDir && !fromDir.includes(':')) return fromDir;

  throw new Error(
    'atlas-paths: could not derive projectName (skeletonPath + outDir both unusable).',
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
