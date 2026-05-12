/**
 * Phase 29 D-06 — Override-key migration helper.
 *
 * Translates v1.3-era `attachmentName`-keyed overrides into the v1.3.1+
 * `regionName`-keyed contract at every project-io load seam (Open / locate-
 * skeleton recovery / resample). Supersedes the per-seam D-150 stale-key
 * intersect at three sites in src/main/project-io.ts.
 *
 * Algorithm (two-pass; iteration-order independent — see `migrateOverrides`
 * docblock for the falsifying-test rationale):
 *
 *   Pass 1 (Case A — region-key entries from v1.3.1+ saves):
 *     For every saved key that matches a regionName present in the new
 *     summary, write it to `restored[regionName]` directly. These are
 *     authoritative — the user's deliberate per-region override.
 *
 *   Pass 2 (Case B — contributor-key entries from v1.3-era saves):
 *     For every saved key that matches an attachmentName but NOT a
 *     regionName, group by target regionName. If Pass 1 already wrote
 *     a value for that region, every Case B contender for that region is
 *     migrated-and-dropped (Pass 1 wins). Otherwise apply the lex-smallest-
 *     contributor-wins rule (D-05 + REGION-05): sort contenders by saved-key
 *     lex ASC and keep the smallest. All consumed contenders count toward
 *     `migratedKeyCount`.
 *
 *   Pass 3 (Case C — orphans):
 *     Every saved key that matches NEITHER a regionName NOR an
 *     attachmentName lands in `stale[]` (existing D-150 surface — drives
 *     the stale-override banner).
 *
 * Per-key value validation (typeof + isFinite) preserved from the original
 * D-150 `mainOpen` site at project-io.ts:807-812 — bad serialized values
 * silently skipped, NEVER counted as migrated/restored.
 *
 * Layer 3 hygiene: pure-TS, no node:* / electron / sharp / DOM. Used by
 * src/main/project-io.ts (main-process only) but cleanly unit-testable in
 * isolation.
 */
import type { SkeletonSummary } from '../shared/types.js';

/**
 * Phase 29 D-06 — return shape of `migrateOverrides`.
 *
 * `restored` is the regionName-keyed Record the renderer's overrides Map
 * (post-Plan-29-03) seeds from. `stale` mirrors the existing D-150
 * staleOverrideKeys field. `migratedKeyCount` drives the new
 * "Updated N overrides to per-region keys." banner (auto-clears on Save).
 */
export interface OverrideMigrationResult {
  /** Regionname-keyed override Record. Single source of truth post Phase 29. */
  restored: Record<string, number>;
  /** Saved keys that matched no region AND no attachment (Case C). */
  stale: string[];
  /**
   * Count of v1.3-era contributor-keyed entries that the migration step
   * consumed (whether by becoming the winning regionName value, or being
   * silently dropped because a Case A entry already won). Counts Case B
   * entries only — Case A (already region-keyed) and Case C (orphans) do
   * NOT bump this count.
   */
  migratedKeyCount: number;
}

/**
 * Migrate a Record<key, percent> override-store from v1.3-era attachmentName
 * keys to v1.3.1+ regionName keys.
 *
 * Two-pass to ensure determinism:
 *   - Pass 1 writes Case A (region-keyed) entries first; these are
 *     authoritative regardless of `Object.entries` iteration order.
 *   - Pass 2 buckets Case B (contributor-keyed) entries by target region;
 *     when Pass 1 wrote a value for that region, every Case B contender is
 *     migrated-and-dropped; otherwise lex-smallest-saved-key wins.
 *
 * The single-pass version has a defect: if iteration visits a Case B
 * contributor key before its Case A region-key sibling, the Case B branch
 * writes to `restored[regionName]` first, the subsequent Case A iteration's
 * idempotency guard refuses to overwrite, and the user's deliberate
 * v1.3.1+ region-keyed value is silently lost. Test 6 in
 * tests/main/override-migration.spec.ts is the falsifying-regression gate.
 *
 * @param savedOverrides The persisted Record from .stmproj (could be either
 *   v1.3-era attachmentName keys, v1.3.1+ regionName keys, or mixed).
 * @param summary A freshly-built SkeletonSummary. `summary.regions` is the
 *   comprehensive skin-manifest pass (one row per unique regionName across
 *   ALL skins); `summary.peaks` is the per-attachment view limited to the
 *   active skin. Migration MUST source the regionName universe from
 *   `summary.regions` — using `summary.peaks` silently drops overrides on
 *   attachments in non-active skins (e.g. multi-skin rigs where the user
 *   applied an override on a skin that isn't the current display skin).
 */
export function migrateOverrides(
  savedOverrides: Record<string, unknown>,
  summary: SkeletonSummary,
): OverrideMigrationResult {
  // Build attachmentName → regionName lookup from summary.regions. Each
  // RegionRow exposes `regionName` plus `contributingAttachments[]` — one
  // entry per spine attachment that resolves to this region (potentially
  // multiple across skins). Sourcing from summary.regions covers all skins
  // via the skin-manifest pass; summary.peaks is active-skin-only and
  // therefore an under-set (root cause for stale-banner false positives on
  // multi-skin rigs).
  const attachmentToRegion = new Map<string, string>();
  const presentRegions = new Set<string>();
  for (const r of summary.regions) {
    presentRegions.add(r.regionName);
    for (const c of r.contributingAttachments) {
      // Last-write-wins matches the original semantics of the prior
      // summary.peaks iteration (`Map.set` overwrites). When the same
      // attachmentName contributes to multiple regions across skins, the
      // mapping picks the last region; Pass 1 (regionName direct match) is
      // the primary path and is unaffected by this ordering.
      attachmentToRegion.set(c.attachmentName, r.regionName);
    }
  }

  const restored: Record<string, number> = {};
  const stale: string[] = [];
  let migratedKeyCount = 0;

  // Per-key value validation closure — preserves the typeof+isFinite guard
  // from the existing D-150 line 807-812 across all three seams. Bad values
  // (strings, NaN, Infinity, undefined) are silently skipped — they NEVER
  // count toward migratedKeyCount and NEVER land in `stale`.
  const isValid = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);

  const entries = Object.entries(savedOverrides);

  // --- Pass 1: Case A (region-key entries — v1.3.1+ saves) -----------------
  for (const [savedKey, percent] of entries) {
    if (!isValid(percent)) continue;
    if (presentRegions.has(savedKey)) {
      // Region key — authoritative. Object.entries returns each key exactly
      // once, but guard idempotently anyway.
      if (!(savedKey in restored)) restored[savedKey] = percent;
    }
  }

  // --- Pass 2: Case B (contributor-key entries — v1.3-era saves) -----------
  // Group all contributor-keyed inputs by their target regionName so the
  // lex-smallest-wins rule can be applied deterministically.
  const contributorWrites = new Map<string, Array<{ savedKey: string; percent: number }>>();
  const orphans: string[] = [];
  for (const [savedKey, percent] of entries) {
    if (!isValid(percent)) continue;
    if (presentRegions.has(savedKey)) continue; // already handled by Pass 1
    const regionName = attachmentToRegion.get(savedKey);
    if (regionName === undefined) {
      orphans.push(savedKey); // Case C — neither region nor attachment
      continue;
    }
    const list = contributorWrites.get(regionName) ?? [];
    list.push({ savedKey, percent });
    contributorWrites.set(regionName, list);
  }

  for (const [regionName, contenders] of contributorWrites) {
    if (regionName in restored) {
      // Pass 1 (Case A) already wrote a region-key entry for this region.
      // Every Case B contender for this region is migrated-and-dropped: the
      // user's deliberate v1.3.1+ region-keyed value is authoritative.
      migratedKeyCount += contenders.length;
      continue;
    }
    // No Pass 1 entry. Apply lex-smallest-contributor-wins (D-05 + REGION-05).
    contenders.sort((a, b) => a.savedKey.localeCompare(b.savedKey));
    restored[regionName] = contenders[0].percent;
    migratedKeyCount += contenders.length; // every contender consumed
  }

  // --- Pass 3: Case C (orphans) -------------------------------------------
  for (const orphan of orphans) stale.push(orphan);

  return { restored, stale, migratedKeyCount };
}
