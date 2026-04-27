---
phase: 05-unused-attachment-detection
reviewed: 2026-04-24T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src/core/usage.ts
  - src/main/summary.ts
  - src/renderer/src/index.css
  - src/renderer/src/panels/GlobalMaxRenderPanel.tsx
  - src/shared/types.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues
---

# Phase 5: Code Review Report

**Reviewed:** 2026-04-24
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 5 delivers F6.1 (unused-attachment detection) and F6.2 (UI surface) as a clean, narrow diff: one new pure-TS core module, a single IPC projection call site, one shared-type addition, one CSS token, and a conditional section inside the existing panel. The code is well-documented, type-only imports keep the architecture boundary intact (CLAUDE.md #5 satisfied), and the structuredClone-safety contract (D-21) is preserved — every field of every `UnusedAttachment` is a primitive or array-of-primitives.

No critical issues (no security, crash, or data-loss risks). The review found three warnings — all concerning a latent semantic asymmetry between the "defined" set (keyed by per-slot map key) and the "used" set (keyed by `attachment.name`), the consequence being a narrow class of false-positive rows when a rig uses skin aliasing. Four info items cover minor type-safety / code-quality polish.

## Warnings

### WR-01: "defined" vs "used" key asymmetry can produce false-positive unused rows under skin aliasing

**File:** `src/core/usage.ts:84-144`
**Issue:**
The module builds two sets with different name keys and then does a set difference across them:

- **Used set** (line 86): `peak.attachmentName`, which the sampler populates from `attachment.name` (see `src/core/sampler.ts:334` — the write-site for `PeakRecord.attachmentName`).
- **Defined set** (line 110): the **map key** of `skin.attachments[slotIndex]` (the `attachmentName` destructured from `Object.entries(perSlot)`).

In the 4.2 runtime these two strings *can* differ. `SkeletonJson.readSkin` keeps the slot-attachment dict keyed by the JSON entry name, but `Attachment.name` is read from the nested `"name"` property when present (see spine-core SkeletonJson.js). When a skin uses the `name: "..."` alias form, the map key and `attachment.name` diverge — and this detector will:

1. Register the map-key name in `defined` (e.g. `"mouth_smile"`).
2. Never see it in `usedNames` because the sampler stored `attachment.name` (e.g. `"shared_mouth"`).
3. Emit a false "unused" row for `mouth_smile` even though it was rendered.

The docstring on line 93-94 explicitly acknowledges "Pitfall 3: map key is authoritative when skin remapping aliases the reference" — but to stay consistent, **both** sets need to be keyed the same way. The used set currently is not.

**Fix:** Build the used set from the same source of truth as the defined set — iterate `skeletonData.skins[*].attachments` and mark a map-key as "used" iff any sampled peak record matches its (skinName, slotIndex, mapKey). Alternatively, register BOTH the map key AND `attachment.name` in the used set so the set difference remains safe under either naming convention:

```ts
const usedNames = new Set<string>();
for (const peak of sampler.globalPeaks.values()) {
  usedNames.add(peak.attachmentName);
}
// Also include map-key names for skin-aliased attachments. Walk the
// same skins traversal and mark map-key as used whenever an attachment
// with the matching slotIndex + attachment.name was rendered.
const renderedByKey = new Set<string>(); // `${skinName}/${slotIndex}/${attachment.name}`
for (const peak of sampler.globalPeaks.values()) {
  // We can't reconstruct slotIndex from PeakRecord without skeletonData —
  // instead, widen usedNames to include every map key whose *attachment*
  // is itself rendered.
}
for (const skin of load.skeletonData.skins) {
  for (let slotIndex = 0; slotIndex < skin.attachments.length; slotIndex++) {
    const perSlot = skin.attachments[slotIndex];
    if (!perSlot) continue;
    for (const [mapKey, attachment] of Object.entries(perSlot)) {
      const underlyingName = (attachment as { name?: string }).name ?? mapKey;
      if (usedNames.has(underlyingName)) usedNames.add(mapKey);
    }
  }
}
```

Either approach removes the asymmetry. Recommend adding a test fixture whose JSON aliases an attachment via the `"name"` property to lock the behavior.

---

### WR-02: Per-skin dim divergence reads a type-asserted field that may be zero on unloaded meshes

**File:** `src/core/usage.ts:126-128`
**Issue:**
The width/height read is:

```ts
const perSkin = attachment as unknown as { width?: number; height?: number };
const w = typeof perSkin.width === 'number' && perSkin.width > 0 ? perSkin.width : atlasDims.w;
const h = typeof perSkin.height === 'number' && perSkin.height > 0 ? perSkin.height : atlasDims.h;
```

Two concerns stack here:

1. **Silent field absence:** `Path`, `Clipping`, `BoundingBox`, and `Point` attachments do not have `width`/`height`, but the non-textured filter on line 117-118 already excludes them via `load.sourceDims.get(name) === undefined`. This is fine **iff** the sourceDims map contains every textured attachment's region name. The comment on lines 120-125 correctly notes that nonessential-data-not-exported meshes report `0` and falls back to atlas dims — good.

2. **Silent type coercion via `as unknown as`:** The double-cast disables type checking. If `RegionAttachment` or `MeshAttachment` types change in a future spine-core bump, this silently keeps reading the old field names. Since `@esotericsoftware/spine-core` already exports the attachment classes with `width: number` and `height: number` fields, the cast is unnecessary — you can narrow without escaping the type system.

**Fix:** Replace the `as unknown as` cast with a proper type-guard import, or at minimum narrow via `in` guards:

```ts
let w = atlasDims.w;
let h = atlasDims.h;
if ('width' in attachment && 'height' in attachment) {
  const aw = (attachment as { width: unknown }).width;
  const ah = (attachment as { height: unknown }).height;
  if (typeof aw === 'number' && aw > 0) w = aw;
  if (typeof ah === 'number' && ah > 0) h = ah;
}
```

Or better, import the concrete classes as types (type-only, preserves the architecture gate):

```ts
import type { RegionAttachment, MeshAttachment } from '@esotericsoftware/spine-core';
// ...
if (attachment instanceof RegionAttachment || attachment instanceof MeshAttachment) {
  // attachment.width / attachment.height are typed
}
```

(Note: `instanceof` needs a value import, which trips CLAUDE.md #5. Stick with `in` narrowing.)

---

### WR-03: Per-skin width/height fallback discards anisotropic overrides when only one axis is zero

**File:** `src/core/usage.ts:127-128`
**Issue:**
The fallback logic treats w and h independently:

```ts
const w = typeof perSkin.width === 'number' && perSkin.width > 0 ? perSkin.width : atlasDims.w;
const h = typeof perSkin.height === 'number' && perSkin.height > 0 ? perSkin.height : atlasDims.h;
```

If a mesh legitimately has `width = 256` but `height = 0` (shouldn't happen in a well-formed export, but is theoretically possible if one axis was stripped), this mixes the per-skin width with the atlas height — producing a **synthetic variant** dimension that neither the skin nor the atlas ever declared. The variant count (`dimVariantCount`, D-98) would then be inflated with a row like `256×128` that has no referent.

**Fix:** Fall back to atlas dims atomically — either use both per-skin values or both atlas values, never mix:

```ts
const hasPerSkinDims =
  typeof perSkin.width === 'number' && perSkin.width > 0 &&
  typeof perSkin.height === 'number' && perSkin.height > 0;
const w = hasPerSkinDims ? perSkin.width! : atlasDims.w;
const h = hasPerSkinDims ? perSkin.height! : atlasDims.h;
```

This aligns with the MeshAttachment semantics: the `nonessential`-stripped path returns `0/0` for BOTH fields (per the referenced `MeshAttachment.d.ts:53` note), so the atomic fallback is the correct model.

---

## Info

### IN-01: `filteredUnused` search uses `query` but the search bar is shared with the main peak table — unclear UX contract

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:471-480`
**Issue:**
The unused-attachments filter reuses the single `query` state that drives the main peak table. When the user types to search a peak-table attachment, the unused-attachments section also filters simultaneously. This is noted in the comment (D-107 inherited SearchBar filter) as intentional, but the chrome shows e.g. "0 unused attachments" during a peak-table search — which can mislead an animator into thinking the search cleared the unused list. The current `(no matches)` placeholder in the body partially mitigates this, but the header count changes from the true total to the filtered count unconditionally.

**Fix:** Consider showing the total-vs-filtered split in the header when a filter is active, e.g. `1 of 3 unused attachments`:

```tsx
<span>
  {filteredUnused.length === unusedAttachments.length
    ? (filteredUnused.length === 1 ? '1 unused attachment' : `${filteredUnused.length} unused attachments`)
    : `${filteredUnused.length} of ${unusedAttachments.length} unused attachments`}
</span>
```

Non-blocking. Current behavior is documented and self-consistent.

---

### IN-02: `sortCol === 'sourceW'` comparator ignores `sourceH` tie-breaker

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:174-175`
**Issue:**
Not introduced in Phase 5 — but the review surface includes the full file, and this is a latent ordering-instability bug worth noting for the next Phase-4 style revision:

```ts
case 'sourceW':
  return a.sourceW - b.sourceW;
```

All rows with identical `sourceW` sort in whatever order `.sort()` leaves them (not deterministic across V8 versions in the < 10-element case pre-2019; stable after). Since two rows can share `sourceW=128` but differ on `sourceH` (e.g. 128×128 vs 128×256), the animator sees them jumble. Recommend extending the comparator with an `attachmentName` tie-breaker (which would match Phase 4 D-91's default sort consistency):

```ts
case 'sourceW':
  return a.sourceW - b.sourceW || a.attachmentName.localeCompare(b.attachmentName);
```

Same treatment applies to `worldW`, `peakScale`, and `frame` branches (lines 179, 184, 186). **Out-of-scope for Phase 5** but flagged because it was reviewable in the diff.

---

### IN-03: `⚠` warning glyph is inlined as a text literal — consider a semantic element

**File:** `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:583`
**Issue:**
The U+26A0 warning glyph is used as the unused-attachment section marker with `aria-hidden="true"`:

```tsx
<span aria-hidden="true">⚠</span>
```

This is fine for screen-reader behavior (the `aria-label="Unused attachments"` on the `<section>` carries the accessible name), but across operating systems the glyph renders with variable emoji presentation (iOS/macOS render it color-emoji by default, Linux/Windows often render text-style). On a warm-stone color scheme with `text-danger` coloring, the colorful emoji form is visually discordant.

**Fix:** Force text-style presentation with the variation selector, or swap for a bundled icon:

```tsx
<span aria-hidden="true">⚠︎</span>
```

Non-blocking. Style polish only.

---

### IN-04: `attachment as unknown as { ... }` cast pattern recurs — consider a shared narrowing helper

**File:** `src/core/usage.ts:126` (see also WR-02)
**Issue:**
The `as unknown as T` pattern appears once in this file but is a recurring shape across the core modules (e.g. `sampler.ts:309` uses `as { region?: { name?: string } }`). Extracting a small `readNumeric(attachment, 'width')` / `readString(attachment, 'name')` helper would centralize the narrowing and kill the `as unknown as` idiom.

**Fix:** Opportunistic refactor; not phase-blocking. Something like:

```ts
// src/core/types-runtime.ts (or inline in usage.ts if isolated)
function readPositiveNumber(o: unknown, key: string): number | undefined {
  if (typeof o !== 'object' || o === null) return undefined;
  const v = (o as Record<string, unknown>)[key];
  return typeof v === 'number' && v > 0 ? v : undefined;
}
```

---

_Reviewed: 2026-04-24_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
