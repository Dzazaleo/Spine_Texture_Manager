/**
 * Phase 5 Plan 02 — Pure-TS unused-attachment detection (F6.1).
 *
 * Emits the `UnusedAttachment[]` list consumed by the renderer's Unused
 * Attachments panel (Plan 03). An attachment is "unused" when it is
 * registered in at least one skin's slot-attachment dict but never appears
 * as a `PeakRecord.attachmentName` in the sampler's globalPeaks — the
 * sampler's alpha-0 / never-switched-in predicate is the source of truth
 * (D-92). This module performs a pure set-difference and never duplicates
 * the visibility check.
 *
 * Pure TypeScript, zero I/O, zero DOM, zero spine-core value imports
 * (CLAUDE.md #5, N2.3). Types flow transitively through `LoadResult`, so
 * even spine-core types are consumed indirectly — the import surface of
 * this module is exactly three local type-only imports.
 *
 * Algorithm:
 *   1. Used set (D-92, Finding #2) — read `PeakRecord.attachmentName` from
 *      every entry of the sampler's globalPeaks map. The sampler has
 *      already filtered alpha-0 slots, so presence in globalPeaks IS the
 *      "was rendered" signal. NEVER split the composite-key strings on
 *      '/' — region/attachment names can legally contain slashes
 *      (folder-prefixed atlas paths; see sampler.ts:304-309).
 *   2. Defined set (Finding #1, Pitfall 3, Pattern §2) — walk
 *      `load.skeletonData.skins[*].attachments` (the per-slot
 *      `StringMap<Attachment>` keyed by slotIndex). Capture the MAP KEY
 *      as the attachment name (Pitfall 3: map key is authoritative when
 *      skin remapping aliases the reference).
 *   3. Non-textured filter (Finding #3, Pitfall 4) — Path / Clipping /
 *      BoundingBox / Point attachments have no atlas region and thus
 *      `load.sourceDims.get(name) === undefined`. F6's framing is
 *      "right-size TEXTURES before export", so structural attachments
 *      are correctly excluded at enumeration.
 *   4. Name-level D-96 aggregation with D-98 dim divergence — a single
 *      `Map<attachmentName, DefinedEntry>` captures every skin that
 *      registers the name (in JSON-parse order, Pitfall 7) and every
 *      distinct W×H pair seen. Set difference (unused = defined ∖ used)
 *      runs at the name level automatically, so D-93 cross-skin
 *      visibility (rendered in ANY skin → not unused) is an emergent
 *      property, not a separate filter (Finding #5).
 *   5. Output preformatting (D-35, D-45/D-46) — `sourceLabel` is
 *      `${maxW}×${maxH}` for dimVariantCount===1 and
 *      `${maxW}×${maxH} (${N} variants)` otherwise. The × character is
 *      U+00D7 (MULTIPLICATION SIGN), matching the existing DisplayRow
 *      label format. `definedInLabel` is the comma-joined skin list.
 *   6. Sort (D-107, parity with Phase 4 D-91) — rows sorted by
 *      attachmentName ASC via locale-aware comparison. `definedIn` arrays
 *      are NOT sorted; they preserve skin-iteration (JSON parse) order.
 *
 * Callers:
 *   - src/main/summary.ts — single IPC-projection call site (D-101).
 *     Reads `SkeletonSummary.unusedAttachments` on the renderer side via
 *     structuredClone; every field is primitive / string[] / number, so
 *     the IPC contract is structuredClone-safe by construction (D-21).
 *
 * Sampler / loader lock: this module never touches `src/core/sampler.ts`
 * (D-100) or `scripts/cli.ts` (D-102). Verified by Task 3 git-diff gate.
 */
import type { LoadResult } from './types.js';
import type { SamplerOutput } from './sampler.js';
import type { UnusedAttachment } from '../shared/types.js';

/**
 * Module-private accumulator for the per-name defined state. Stays
 * strictly internal — every field of every returned UnusedAttachment is
 * primitive / string[] / number, so this helper type never crosses the
 * return boundary (Pitfall 8: no Set / Map leaks into IPC payloads).
 */
interface DefinedEntry {
  /** Skin names in JSON-parse iteration order. Deduplicated via includes-then-push (Pitfall 7 — preserve order, do NOT sort, do NOT round-trip through a Set). */
  definedIn: string[];
  /** Keyed by `${w}x${h}` so multi-skin same-dims collapse to a single variant; the value carries the numeric pair for D-98 max aggregation in one pass. */
  sourceDimsByVariant: Map<string, { w: number; h: number }>;
}

export function findUnusedAttachments(
  load: LoadResult,
  sampler: SamplerOutput,
): UnusedAttachment[] {
  // --- Used set (Finding #2) ---------------------------------------------
  // Read PeakRecord.attachmentName directly. Do NOT split globalPeaks
  // composite keys on '/' — attachment names can legally contain slashes
  // (folder-prefixed atlas paths; see sampler.ts:304-309).
  const usedNames = new Set<string>();
  for (const peak of sampler.globalPeaks.values()) {
    usedNames.add(peak.attachmentName);
  }

  // --- Defined set (Finding #1 — mirrors src/main/summary.ts:40-49) ------
  // skin.attachments is Array<StringMap<Attachment>> keyed by slotIndex.
  // Capture the MAP KEY as the attachment name (Pitfall 3: map key is
  // authoritative when skin remapping aliases the reference; in 99% of
  // rigs the map key matches attachment.name).
  //
  // Per-skin dim divergence source (Plan-01 spec gate, test case d):
  //   `load.sourceDims` is a name-level atlas map — one value per region
  //   name, shared across all skins. Per-skin divergence cannot come from
  //   there. It comes from the attachment object's own `.width`/`.height`
  //   (populated by `SkeletonJson` from the per-skin JSON entry at
  //   SkeletonJson.js:379-380 for regions, :410-411 for meshes). We read
  //   those fields off each attachment instance so the D-98 aggregator
  //   sees distinct variants when two skins register different dims for
  //   the same attachment name. `load.sourceDims` remains the authoritative
  //   NON-TEXTURED FILTER only (Finding #3, Pitfall 4).
  const defined = new Map<string, DefinedEntry>();
  for (const skin of load.skeletonData.skins) {
    for (let slotIndex = 0; slotIndex < skin.attachments.length; slotIndex++) {
      const perSlot = skin.attachments[slotIndex];
      if (perSlot === undefined || perSlot === null) continue;
      for (const [attachmentName, attachment] of Object.entries(perSlot)) {
        // Filter non-textured attachments (Path / Clipping / BoundingBox /
        // Point). load.sourceDims is populated from atlas regions only —
        // non-textured attachments have no region so get() returns
        // undefined. Framing: F6 is "right-size TEXTURES before export";
        // structural attachments cannot ship as textures. (Finding #3,
        // Pitfall 4.)
        const atlasDims = load.sourceDims.get(attachmentName);
        if (atlasDims === undefined) continue;

        // Read per-skin dims directly off the attachment object. Only
        // textured attachments (Region / Mesh) reach this point, and both
        // carry numeric `width` / `height` fields. Fall back to atlas dims
        // if the per-skin values are missing (nonessential-data-not-exported
        // meshes report 0 per MeshAttachment.d.ts:53 — treat that as "use
        // atlas").
        const perSkin = attachment as unknown as { width?: number; height?: number };
        const w = typeof perSkin.width === 'number' && perSkin.width > 0 ? perSkin.width : atlasDims.w;
        const h = typeof perSkin.height === 'number' && perSkin.height > 0 ? perSkin.height : atlasDims.h;

        let entry = defined.get(attachmentName);
        if (entry === undefined) {
          entry = { definedIn: [], sourceDimsByVariant: new Map() };
          defined.set(attachmentName, entry);
        }
        if (!entry.definedIn.includes(skin.name)) {
          entry.definedIn.push(skin.name);
        }
        const variantKey = `${w}x${h}`;
        if (!entry.sourceDimsByVariant.has(variantKey)) {
          entry.sourceDimsByVariant.set(variantKey, { w, h });
        }
      }
    }
  }

  // --- Set difference + D-98 aggregation ---------------------------------
  const rows: UnusedAttachment[] = [];
  for (const [name, entry] of defined) {
    // D-93 cross-skin semantics are automatic: usedNames is a name-level
    // Set, so any skin rendering the name excludes it globally (Finding
    // #5).
    if (usedNames.has(name)) continue;

    let maxW = 0;
    let maxH = 0;
    for (const v of entry.sourceDimsByVariant.values()) {
      if (v.w > maxW) maxW = v.w;
      if (v.h > maxH) maxH = v.h;
    }
    const dimVariantCount = entry.sourceDimsByVariant.size;
    const sourceLabel =
      dimVariantCount === 1
        ? `${maxW}×${maxH}`
        : `${maxW}×${maxH} (${dimVariantCount} variants)`;
    const definedInLabel = entry.definedIn.join(', ');

    rows.push({
      attachmentName: name,
      sourceW: maxW,
      sourceH: maxH,
      // Defensive copy — prevents callers from mutating the internal
      // DefinedEntry.definedIn by reference.
      definedIn: entry.definedIn.slice(),
      dimVariantCount,
      sourceLabel,
      definedInLabel,
    });
  }

  // D-107: sort by attachmentName ASC (parity with Phase 4 D-91).
  rows.sort((a, b) => a.attachmentName.localeCompare(b.attachmentName));
  return rows;
}
