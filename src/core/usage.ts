/**
 * Phase 24 Plan 01 — Pure orphaned-file detection (PANEL-01, D-01, D-02, D-05).
 *
 * Replaces the old Phase 5 unused-attachment detector with a simpler pure helper
 * that takes pre-collected inputs and performs zero I/O (CLAUDE.md #5).
 * I/O (fs.readdirSync, fs.statSync, path.join) lives exclusively in
 * src/main/summary.ts (D-05 Layer-3 invariant).
 *
 * Algorithm (D-02 step 3): orphaned = imagesFolderFiles NOT IN inUseNames.
 */

/**
 * Phase 24 PANEL-01 — Pure orphaned-file detection (D-01, D-02, D-05).
 *
 * Takes pre-collected inputs; performs zero I/O (CLAUDE.md #5).
 * I/O (fs.readdirSync, fs.statSync) lives exclusively in src/main/summary.ts.
 *
 * @param imagesFolderFiles PNG paths relative to images/ without extension (e.g. ["CIRCLE", "AVATAR/BODY"])
 * @param inUseNames Set of attachment/region names referenced by the rig
 * @returns Relative paths of files in imagesFolderFiles that are NOT in inUseNames
 */
export function findOrphanedFiles(
  imagesFolderFiles: string[],
  inUseNames: Set<string>,
): string[] {
  return imagesFolderFiles.filter((name) => !inUseNames.has(name));
}
