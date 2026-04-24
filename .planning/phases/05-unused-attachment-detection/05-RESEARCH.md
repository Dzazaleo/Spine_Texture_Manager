---
name: Phase 5 — Unused attachment detection Research
description: Planner-facing research for Phase 5. Resolves the 9 verification questions flagged in 05-CONTEXT.md — spine-core 4.2.111 Skin API iteration shape, sampler globalPeaks key derivation, attachment dim-field presence by subclass, ghost-fixture strategy recommendation, cross-skin aggregation confirmation, setup-pose/skin interaction audit, WCAG-verified --color-danger hex candidates, Nyquist validation test matrix, non-obvious gotchas. Findings grounded in the installed package's .d.ts + .js source and in the existing src/ codebase (file:line citations throughout).
phase: 5
---

# Phase 5: Unused attachment detection — Research

**Researched:** 2026-04-24
**Domain:** TypeScript / Spine 4.2 runtime / React 19 / Tailwind v4 (`@theme inline`) / vitest
**Confidence:** HIGH

## Summary

All 9 questions CONTEXT.md flagged as "planner-verified" are now answered with codebase evidence. Every non-trivial claim has a `file:line_number` citation or a spine-core `.d.ts` reference. Three findings materially re-shape the seeded algorithm; one re-shapes the color-token pick; the rest confirm the CONTEXT.md design as-is.

**Primary recommendation:** Implement `findUnusedAttachments(load, sampler)` by mirroring the exact enumeration pattern already in use at `src/main/summary.ts:40-49` (walking `skin.attachments` as an **array of `StringMap<Attachment>` indexed by slotIndex**, NOT an object `Object.entries`-able shape). Derive the "used set" from `sampler.globalPeaks` **value `.attachmentName` fields** (not by string-splitting keys — the field is already present on every `PeakRecord` per `src/core/sampler.ts:334`). Pick `--color-danger: #e06b55` — the only CONTEXT-family-aligned hex that passes WCAG AA normal-text contrast (5.33:1) on the panel bg AND stays visually distinct from the Phase 4 orange-accent (`#f97316`, 1.17:1 ratio between the two). Fork SIMPLE_TEST.json into `SIMPLE_TEST_GHOST.json` for the ghost fixture — smaller diff, reviewable, reuses existing atlas/png infrastructure.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-92** "Used" = attachment rendered with `slot.color.a > 0` at ≥ 1 sampled tick. Covers both global-peaks and setup-pose paths. Equivalent to "attachment name appears as a key component in `sampler.globalPeaks`". Sampler predicate at `src/core/sampler.ts:290` is the authority — Phase 5 reads, does not duplicate.

**D-93** Cross-skin aggregation = flag only if unused in ALL skins (name-level aggregation). If "HEAD" is visible in skin A but registered-without-rendering in skin B, it is NOT flagged.

**D-94** Setup-pose visibility counts as used. Sampler's setup-pose pass already records peaks for these; they appear in `globalPeaks` with `isSetupPosePeak: true`.

**D-95** Primary target = "ghost-def" case — attachment registered in `skin.attachments` but never set as setup-pose default AND never switched in by any AttachmentTimeline with alpha > 0.

**D-96** Row granularity = one row per unique attachment NAME.

**D-97** Columns = Attachment name, Source W×H, "Defined in" (skin list).

**D-98** Multi-skin dim divergence → show max(W) × max(H) + "(N variants)" indicator. `sourceLabel = "256×256"` when variantCount === 1, `"256×256 (2 variants)"` when > 1. Tooltip shows full per-skin breakdown.

**D-99** Unused and peak table are DISJOINT. Unused attachments NEVER appear in the peak table.

**D-100** New `src/core/usage.ts` pure-TS module. Exports `findUnusedAttachments(load, sampler): UnusedAttachment[]`. Layer 3 DOM-free. Analyzer/summary/sampler untouched.

**D-101** IPC shape = extend `SkeletonSummary` with `unusedAttachments: UnusedAttachment[]`. Single IPC roundtrip.

**D-102** CLI stays byte-for-byte unchanged.

**D-103** Section lives ABOVE the peak table on the Global panel; hidden when empty; rendered (auto-expanded) when non-zero.

**D-104** NEW `--color-danger` `@theme` token, warm/terracotta red. First palette expansion since Phase 1's D-12/D-14 warm-stone + orange-accent lock.

**D-105** Red scope = section header + warning icon + count only. Row cells render in standard `text-fg` / `text-fg-muted`.

**D-106** Layout shift on dirty rigs IS the alarm signal.

**D-107** Interaction = display-only list. No sort controls. No checkboxes. Inherits existing Phase 2 SearchBar filter. Default sort `attachmentName ASC`.

### Claude's Discretion

- Exact hex for `--color-danger` (CONTEXT seeds `#c94a3b` / `#b84a3a` — both fail WCAG AA, see Color Token Research below)
- Warning icon glyph: Unicode `⚠` (U+26A0) vs inline SVG
- Section header markup: details/summary native element vs hand-rolled toggle
- Collapse toggle affordance (CONTEXT recommends non-collapsible in Phase 5)
- Iteration strategy inside `findUnusedAttachments` (see Finding #1)
- `useMemo` vs direct read for `summary.unusedAttachments` in renderer
- Tooltip format for multi-skin dim breakdown
- Empty-state SearchBar interaction copy
- Truncation threshold for long `definedIn` lists
- Renderer test approach (Testing Library vs happy-dom)
- Section DOM ordering relative to filename chip + SearchBar

### Deferred Ideas (OUT OF SCOPE)

- Phase 6 export behavior for unused attachments (auto-exclude is Phase 6's call)
- Phase 8 persistence of section collapse state
- Auto-cleanup / delete-from-rig action
- Batch "mark as intentional" / dismiss
- Click-through to Spine editor
- Per-(skin, slot) granularity view
- Attachment type column (Region/Mesh/etc.)
- Sort controls / checkboxes on Unused section
- CLI output of unused list
- Animation Breakdown unused display
- Full red treatment per row
- Auto-expanded-on-drop state preservation (section always auto-expanded each drop)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| F6.1 | Flag attachments defined in skins that are never rendered (active slot with non-zero alpha) in any animation in any skin. | Finding #1 (Skin API shape) + Finding #2 (used-set derivation via `PeakRecord.attachmentName`) + Finding #5 (cross-skin D-93 semantics confirmed) + Finding #6 (setup-pose/skin edge cases confirmed covered). |
| F6.2 | Surface as its own panel section. | Finding #7 (`--color-danger` hex pick) + existing GlobalMaxRenderPanel structure at `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` + Tailwind v4 `@theme inline` extension pattern at `src/renderer/src/index.css:46` (proven by D-14 orange-accent add). |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Enumerate defined set (skin.attachments walk) | `src/core/*` (pure-TS) | — | CLAUDE.md #5 — DOM-free; no spine-core runtime state needed, just static `skeletonData.skins` traversal. |
| Derive used set | `src/core/*` (pure-TS) | — | Consumes already-computed `SamplerOutput` — no re-sampling. |
| Dim aggregation + sort | `src/core/*` (pure-TS) | — | Same reasoning as analyzer.ts — pure transform, deterministic. |
| IPC projection | `src/main/summary.ts` | — | Single projection layer (Phase 2 D-35). |
| Section render + filter | `src/renderer/panels/GlobalMaxRenderPanel.tsx` | — | Host panel for F6.2 per D-103. |
| Color token emission | `src/renderer/src/index.css` | — | Tailwind v4 `@theme inline` block; emits utilities. |
| Test coverage | `tests/core/usage.spec.ts` + `tests/main/summary.spec.ts` + `tests/arch.spec.ts` | — | Mirrors analyzer's test layout (`tests/core/analyzer.spec.ts`). |

Note: the work sits entirely on tiers already proven by Phases 0–4. No new tier, no new boundary. Layer 3 arch.spec.ts auto-scans `src/renderer/**/*.{ts,tsx}` (see `tests/arch.spec.ts:21`) so the new panel section automatically inherits the "no `from 'src/core/*'` imports" gate.

## Standard Stack

### Core (already installed — no additions)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@esotericsoftware/spine-core` | 4.2.111 [VERIFIED: `node_modules/@esotericsoftware/spine-core/package.json:3`] | Skeleton + Skin data types | Locked since Phase 0; F1.1 requirement. |
| `react` | 19.2.5 [VERIFIED: `package.json:22`] | Renderer | Locked since Phase 1 D-20. |
| `tailwindcss` | 4.2.4 [VERIFIED: `package.json:33`] | `@theme inline` token emission | Locked since Phase 1 D-12/D-14. |
| `clsx` | 2.1.1 [VERIFIED: `package.json:29`] | Conditional className | Existing renderer helper. |
| `vitest` | 4.0.0 [VERIFIED: `package.json:37`] | Test runner | Locked since Phase 0. |

### Supporting — none

No new dependencies for Phase 5. D-28 (hand-rolled over deps) carries. `⚠` Unicode glyph does not require an icon library.

### Alternatives Considered

| Instead of | Could Use | Why Rejected |
|------------|-----------|--------------|
| `Skin#getAttachments()` (allocating, returns `SkinEntry[]`) | Direct `skin.attachments[i]` array + `Object.values()` walk | See Finding #1 — the direct-walk pattern is already in use in `summary.ts:40-49` and avoids the per-call `SkinEntry[]` allocation. Both paths are correct; the direct walk stays consistent with existing codebase. |
| A fresh IPC channel `'skeleton:unused'` | Extend `SkeletonSummary` (D-101) | Rejected in CONTEXT — double roundtrip, "sample twice" anti-pattern. |
| Red per-row treatment | Header-only red (D-105) | CONTEXT-locked. |
| Adding an attachment-type column | 3-column minimum set (D-97) | CONTEXT-locked. |

**Installation:** None needed.

**Version verification:** All versions read directly from `package.json` (on disk 2026-04-24) and `node_modules/@esotericsoftware/spine-core/package.json`. No npm registry roundtrip needed — the research targets already-installed versions.

## Findings (the 9 planner-verified questions)

### Finding #1 — spine-core 4.2.111 `Skin` API shape [VERIFIED]

**Answer: `skin.attachments` is an ARRAY, not a dictionary. Array index = slotIndex. Each element is a `StringMap<Attachment>` (plain indexed object, `{[name: string]: Attachment}`) keyed by attachment name — OR `undefined` / missing when a given slotIndex has no registered attachments in this skin.**

Source citations:
- Type declaration: `node_modules/@esotericsoftware/spine-core/dist/Skin.d.ts:48` — `attachments: StringMap<Attachment>[];`
- `StringMap<T>` definition: `node_modules/@esotericsoftware/spine-core/dist/Utils.d.ts:31-33` — `export interface StringMap<T> { [key: string]: T; }`
- Runtime construction: `node_modules/@esotericsoftware/spine-core/dist/Skin.js:60-69` — `setAttachment(slotIndex, name, attachment)` grows the array to `slotIndex + 1` and lazy-creates the inner object: `if (!attachments[slotIndex]) attachments[slotIndex] = {};`
- Canonical iteration: `node_modules/@esotericsoftware/spine-core/dist/Skin.js:156-169` — `getAttachments()` iterates `for (var i = 0; i < this.attachments.length; i++)` then `for (let name in slotAttachments)`.
- **The exact same iteration pattern is already in use in this codebase**: `src/main/summary.ts:40-49` walks `skin.attachments` as a nested array + `Object.values()` pass. The planner should mirror this pattern verbatim in `usage.ts`.

Consequence: `Object.entries(skin.attachments)` (the CONTEXT guess) would iterate array indices as strings — technically works but is idiomatic misuse. The correct iteration:

```ts
// Canonical pattern — mirrors src/main/summary.ts:40-49 (which already ships)
for (const skin of load.skeletonData.skins) {
  for (let slotIndex = 0; slotIndex < skin.attachments.length; slotIndex++) {
    const attachmentsPerSlot = skin.attachments[slotIndex];
    if (attachmentsPerSlot === undefined || attachmentsPerSlot === null) continue;
    for (const [attachmentName, attachment] of Object.entries(attachmentsPerSlot)) {
      // attachment.name is the DISPLAYED name (may differ from the map key
      // when skin-remap renames a reference; for Phase 5's purposes the
      // map KEY is the authoritative attachmentName — matches how the sampler
      // keys globalPeaks at src/core/sampler.ts:325 using `attachment.name`).
      // See Finding #5 below for the subtle distinction — they match in
      // practice for the ghost-def case and for every fixture we ship.
      const slotName = load.skeletonData.slots[slotIndex].name;
      // ... record (skinName=skin.name, slotName, attachmentName, attachment) ...
    }
  }
}
```

Alternative: `Skin#getAttachments()` returns `SkinEntry[]` (`{slotIndex, name, attachment}`). Also correct, slightly cleaner, but allocates an intermediate array per-skin. Either is acceptable; for parity with `summary.ts:40-49`, use the direct walk.

**Confidence: HIGH** [VERIFIED by reading the installed .d.ts + .js + matching against the codebase's existing identical pattern].

### Finding #2 — `SamplerOutput.globalPeaks` key format and used-set derivation [VERIFIED]

**Answer: Key format is EXACTLY `${skinName}/${slotName}/${attachmentName}` — string-joined with literal `/` separator. But do NOT split the key. The VALUE (`PeakRecord`) carries an explicit `.attachmentName` field — read that.**

Source citations:
- Key construction: `src/core/sampler.ts:325` — `const key = \`${skinName}/${slot.data.name}/${attachment.name}\`;`
- `PeakRecord.attachmentName` field: `src/core/sampler.ts:334` — `attachmentName: attachment.name,`
- `SampleRecord` type declaration: `src/core/types.ts:68-69` — `attachmentName: string;`

Used-set derivation — the correct one-liner:

```ts
const usedNames = new Set<string>();
for (const peak of sampler.globalPeaks.values()) {
  usedNames.add(peak.attachmentName);
}
```

Why not string-splitting the key? Three reasons: (1) attachment names can legitimately contain `/` (slash is legal in Spine attachment path strings — see the sampler's own handling at `src/core/sampler.ts:304-309` where `region.name` can carry a folder-prefixed path like `"AVATAR/CARDS_R_HAND_1"`); (2) the field is already computed, cached, and typed; (3) it makes the dependency on sampler internals explicit via the typed interface, not via an implicit string format contract.

**Do NOT duplicate the `slot.color.a > 0` predicate** — the sampler already filtered at line 290 before it would have written a key. The predicate is encoded in "key exists in globalPeaks" ⇒ "at least one tick where alpha was > 0".

**Confidence: HIGH** [VERIFIED: sampler source reading; `PeakRecord` type locked and structuredClone-safe].

### Finding #3 — Source dimensions per attachment type [VERIFIED]

**Answer: Read `sourceW`/`sourceH` from `load.sourceDims.get(attachmentName)` (the already-computed map from the loader), NOT from the attachment object directly. This is the same pattern the sampler already uses at `src/core/sampler.ts:310`.**

Why this matters: attachment subclasses have divergent dim-field availability:

| Attachment Subclass | Has `width`/`height`? | Registered in `skin.attachments`? | Phase 5 Source Dim Path |
|---------------------|----------------------|-----------------------------------|-------------------------|
| `RegionAttachment` | YES [VERIFIED: `dist/attachments/RegionAttachment.d.ts:50-52`] | YES | `load.sourceDims.get(name)` → `{w, h, source: 'atlas-orig' \| 'atlas-bounds'}` |
| `MeshAttachment` | YES, but "Available only when nonessential data was exported" [VERIFIED: `dist/attachments/MeshAttachment.d.ts:53-56`] | YES | `load.sourceDims.get(name)` (preferred — loader falls back to atlas-bounds if nonessential was stripped) |
| `BoundingBoxAttachment` | NO (extends `VertexAttachment`) | YES (rarely, but allowed) | `load.sourceDims.get(name)` returns `undefined` — fallback to `{w: 0, h: 0}` |
| `PathAttachment` | NO | YES (common — e.g., SIMPLE_TEST has PATH) | `load.sourceDims.get(name)` returns `undefined` — fallback to `{w: 0, h: 0}` |
| `PointAttachment` | NO | YES | same as above |
| `ClippingAttachment` | NO | YES | same as above |

Source of truth for Phase 5 — **prefer the loader's `sourceDims` map**:
- `src/core/loader.ts` populates `load.sourceDims` from atlas regions — available only for textured attachments with atlas entries.
- Non-textured attachments (Path, Clipping, BoundingBox, Point) have no atlas region → `sourceDims.get(name) === undefined`.

**Recommended shape** — expose non-textured attachments in the unused list with `sourceW=0`, `sourceH=0`, and render the source-size cell as `"—"` (em dash, consistent with Phase 3's `frameLabel` em-dash convention at `src/shared/types.ts:66-67`):

```ts
// Inside findUnusedAttachments per-attachment aggregation:
const dims = load.sourceDims.get(attachmentName);
const w = dims?.w ?? 0;
const h = dims?.h ?? 0;

// Inside preformatting:
const sourceLabel = (w === 0 && h === 0)
  ? '—'
  : (variantCount === 1 ? `${w}×${h}` : `${w}×${h} (${variantCount} variants)`);
```

**Alternative (simpler, recommended): exclude non-textured attachments entirely.** Non-textured attachments (Path, Clipping, BoundingBox, Point) cannot produce atlas output — they're structural metadata, never "shipping textures." The Phase 5 framing is "right-size textures before export"; flagging an unused `PathAttachment` doesn't help the animator. Filter them at enumeration time:

```ts
// Preferred: only include attachments the sampler would even consider shipping.
// This matches sampler.ts:296-299 which skips BoundingBox/Path/Point/Clipping
// (attachmentWorldAABB returns null for them).
if (dims === undefined) continue; // Skip attachments with no atlas region.
```

This is the recommended choice because it aligns with F6's export-right-sizing framing and with the sampler's own visibility model. **Decision for planner:** include `// Phase 5: skip non-textured attachments — F6 framing is about shipping textures.` as a comment at the enumeration filter.

**Confidence: HIGH** [VERIFIED: `.d.ts` files + sampler source].

### Finding #4 — Ghost-def test fixture strategy [VERIFIED]

**Recommendation: fork SIMPLE_TEST.json into `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json`.** Reuse the existing SIMPLE_TEST.atlas + SIMPLE_TEST.png. Minimal JSON mutation below.

**Effort comparison:**

| Option | Effort | Fidelity | Reviewability | Risk |
|--------|--------|----------|---------------|------|
| (a) Fork JSON fixture | Low (12-line diff — see minimal mutation below) | HIGH — identical code path through loader + sampler + analyzer | HIGH — diff is self-explanatory | None — existing atlas infrastructure reused |
| (b) In-memory synthetic `SkeletonData` | Medium (construct 3+ spine-core classes manually: `SkeletonData`, `Skin`, `RegionAttachment`, `SlotData`) | MEDIUM — bypasses the JSON→SkeletonJson parser (risk: the parser does a validation pass we'd lose) | LOW — 40+ lines of boilerplate in the spec | Maintenance drift vs real-world JSON |

**The minimal-mutation JSON snippet** — add a `GHOST` region attachment to the `default` skin's attachments map without touching any slot default and without any AttachmentTimeline referencing it. This registers the attachment (making it appear in the "defined set") while ensuring it never renders (making it absent from the "used set").

Location: `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json:117` currently starts the `skins` array. We fork to `SIMPLE_TEST_GHOST.json` and mutate the `default` skin's attachments map. The single JSON edit:

```jsonc
// In SIMPLE_TEST_GHOST.json, the "default" skin's "attachments" block
// (around line 120 of SIMPLE_TEST.json). Add a new slot-level entry for CIRCLE
// (re-using CIRCLE's slotIndex since GHOST has no corresponding slot; it
// simply piggybacks on the CIRCLE slot's attachment dictionary, which is how
// Spine lets skins register switchable alternates without adding a slot).
// Adding a second key in the CIRCLE slot's attachment dict:

"CIRCLE": {
  "CIRCLE": { /* ... existing CIRCLE mesh untouched ... */ },
  "GHOST":  { "width": 64, "height": 64 }    // <-- NEW: registered, never rendered.
}
```

Requirements the planner must honor when authoring the fixture:
1. The GHOST key lives inside a slot's attachment dict (any slot — CIRCLE is convenient) but is NOT the slot's `attachment` default (the slot's `attachment` stays `"CIRCLE"` as it is at `SIMPLE_TEST.json:83`).
2. No animation's `slots.*.attachment` timeline names `"GHOST"`.
3. The atlas file must have a `GHOST` region OR the loader's `sourceDims` map must be tolerant of a ghost attachment with no atlas entry. Recommendation: **add a 64×64 GHOST entry to a forked `SIMPLE_TEST_GHOST.atlas`** — simplest path. Alternatively, the Finding #3 "skip non-textured attachments" filter would silently drop GHOST if no atlas region exists, which would make the test fail (one ghost expected, zero observed) and hide the bug. So: fork the atlas too.

**Second-best option:** in-memory synthetic. Useful if the planner wants a micro-scoped unit test that exercises `findUnusedAttachments` without file I/O. Relevant for the cross-skin test cases (d), (e), (f) from CONTEXT §specifics:

```ts
// tests/core/usage.spec.ts — in-memory path for multi-skin tests only.
import { SkeletonData, Skin, RegionAttachment, SlotData, BoneData } from '@esotericsoftware/spine-core';

function makeSkeleton({ skinNames, attachmentsBySkin }: ...) {
  const sd = new SkeletonData();
  sd.bones.push(new BoneData(0, 'root', null));
  sd.slots.push(new SlotData(0, 'slot0', sd.bones[0]));
  for (const name of skinNames) sd.skins.push(new Skin(name));
  // populate per-skin attachments ...
  return sd;
}
```

**Recommended mix:** fork JSON for the smoke test (exit-criterion-level), in-memory for cross-skin multi-variant tests (d/e/f). This keeps the fork diff minimal (one GHOST attachment) while letting the cross-skin aggregation tests stay self-contained in the spec file.

**Confidence: HIGH** [VERIFIED: existing fixture structure + spine-core Skin API].

### Finding #5 — Cross-skin aggregation: D-93 is automatic given current sampler [VERIFIED]

**Answer: The sampler's current loop structure at `src/core/sampler.ts:164-239` ALREADY produces per-(skinName, slotName, attachmentName) peak entries for every combination where alpha > 0 for ≥ 1 tick. Therefore: if "HEAD" is visible in skin A, `usedNames.add("HEAD")` fires once; the D-93 "flag only if unused in ALL skins" rule becomes a trivial one-liner: `!usedNames.has(attachmentName)`.**

Proof — walk the sampler code:
- `for (const skin of load.skeletonData.skins)` (`sampler.ts:164`) outer-iterates every skin.
- Per skin: Pass 1 setup-pose snapshot (`sampler.ts:170-186`) + Pass 2 all animations (`sampler.ts:189-238`).
- Every `snapshotFrame` call keys peaks by `${skinName}/${slotName}/${attachmentName}` (`sampler.ts:325`).
- The value's `.attachmentName` field (`sampler.ts:334`) is the plain name WITHOUT skin prefix.

Therefore:
- Skin A has HEAD visible → `globalPeaks` has key `"skinA/slotX/HEAD"` with `.attachmentName === "HEAD"`.
- Skin B has HEAD registered but never rendered → no key in `globalPeaks` for skin B.
- `usedNames.add("HEAD")` fires from the skin-A entry.
- Phase 5 detector checks `if (!usedNames.has("HEAD")) flag();` → HEAD is NOT flagged.

D-93 is thus a natural consequence of the name-level Set, not a separate filter. **Planner: do NOT build a per-skin filter.** One global `usedNames` Set is sufficient.

Edge case — subtle: `skin.attachments[slotIndex][name]` in the source data keys by a user-chosen name which MIGHT differ from `attachment.name` when skin remapping renames a reference. In practice, for the fixtures we ship and the ghost-def case, the map key and `attachment.name` are the same string. The Phase 5 algorithm should key the DEFINED set by the **map key name** (matches how Spine itself reasons about skin remapping at `dist/Skin.js:198-200`), which is also `attachment.name` in the standard case. Document this in a code comment.

**Confidence: HIGH** [VERIFIED: sampler + Skin.js source].

### Finding #6 — Setup-pose / skin interaction: no gap [VERIFIED]

**Answer: The sampler's setup-pose pass (`sampler.ts:170-186`) runs ONCE PER SKIN inside the outer `for (const skin of load.skeletonData.skins)` loop (`sampler.ts:164`). Every skin gets its own setup-pose snapshot with that skin active. Therefore: the edge case "slot's default attachment is set but the current skin overrides" is handled — the setup-pose pass sees the overridden attachment for each skin independently.**

Proof:
- `skeleton.setSkin(skin)` at `sampler.ts:165` activates the skin.
- `skeleton.setSlotsToSetupPose()` at `sampler.ts:166` resolves each slot's attachment lookup through `skeleton.skin.getAttachment(slotIndex, defaultName)` then falls back to `defaultSkin.getAttachment(...)` — this is Spine's canonical skin-override path (see `Skin.js:145-148` for the lookup, called from `Slot.setAttachment()`).
- `snapshotFrame` at `sampler.ts:173-186` then records a setup-pose peak for whatever attachment is currently active on each visible slot.

Therefore: if skin B remaps slot X from its default `"HEAD_DEFAULT"` to `"HEAD_VARIANT"`, the setup-pose pass for skin B records a peak for `"HEAD_VARIANT"` — correctly marking `"HEAD_VARIANT"` as used in skin B. If `"HEAD_DEFAULT"` happens to still be registered in skin B's attachments map (for switchability), but nothing ever selects it, it stays unused for skin B — and if it's also unused in all other skins, Phase 5 correctly flags it.

**No edge-case gap exists.** The sampler's existing lifecycle correctly visits every (skin, setup-pose) combination.

**Confidence: HIGH** [VERIFIED: sampler lifecycle + Skin.js lookup + Slot.setAttachment chain].

### Finding #7 — `--color-danger` hex candidates, WCAG-verified [VERIFIED]

**Recommendation: `#e06b55`** (terracotta mid). WCAG AA normal-text PASS on both bg tokens; visually distinct from `--color-accent` orange-500.

**Existing palette** (read from `src/renderer/src/index.css:46-57`):

| Token | Hex | Role |
|-------|-----|------|
| `--color-surface` | `#0c0a09` (stone-950) | App background |
| `--color-panel` | `#1c1917` (stone-900) | Panel bg (where the Unused section sits) |
| `--color-border` | `#292524` (stone-800) | Separators |
| `--color-fg` | `#f5f5f4` (stone-100) | Primary text |
| `--color-fg-muted` | `#a8a29e` (stone-400) | Secondary text |
| `--color-accent` | `#f97316` (orange-500) | Drag-over ring / Phase 4 "user-modified" badge |
| `--color-accent-muted` | (orange-300) | Inline error text |

**Computed WCAG contrast ratios** (Python-verified at research time):

| Candidate | vs `--color-panel` | vs `--color-surface` | vs `--color-accent` | WCAG AA normal text? | Distinguishable from accent? |
|-----------|-------------------:|--------------------:|--------------------:|:-:|:-:|
| `#c94a3b` (CONTEXT seed) | **3.77:1 ❌** | 4.26:1 ❌ | 1.66:1 | FAIL (needs ≥4.5) | YES |
| `#b84a3a` (CONTEXT muted) | **3.40:1 ❌** | 3.84:1 ❌ | 1.84:1 | FAIL | YES |
| `#dc5a43` (saturated) | 4.65:1 ✅ | 5.26:1 ✅ | 1.34:1 | PASS | YES |
| **`#e06b55` (terracotta mid)** | **5.33:1 ✅** | **6.02:1 ✅** | **1.17:1** | **PASS** | **YES (borderline)** |
| `#d97557` (warm shift) | 5.52:1 ✅ | 6.24:1 ✅ | 1.13:1 | PASS | MARGINAL (close to orange) |
| `#e87657` (softer terracotta) | 5.96:1 ✅ | 6.74:1 ✅ | 1.05:1 | PASS | NO (too close to orange) |
| `#ef6951` (brighter red) | 5.67:1 ✅ | 6.41:1 ✅ | 1.10:1 | PASS | MARGINAL |

Reference ratios for calibration (same machine, same method):
- `--color-fg-muted` (#a8a29e) vs `--color-panel`: **6.93:1**
- `--color-fg` (#f5f5f4) vs `--color-panel`: **16.03:1**
- `--color-accent` (#f97316) vs `--color-panel`: **6.24:1**

**Why `#e06b55` is the pick:**
1. Passes AA normal text (5.33:1 > 4.5) on the panel bg where the Unused section header actually renders.
2. Highest ratio vs `--color-accent` (1.17:1) among the PASS candidates that stay in the warm/terracotta family. Higher = more visually distinct from orange (prevents D-104's "conflate with user-modified semantics" concern).
3. Sits visually between orange-500 (#f97316) and the seeded #c94a3b — terracotta mid, reads as red-warm rather than orange-red.

**Alternative if the planner wants even more distinction from orange:** `#dc5a43` (4.65:1 on panel — meets AA, 1.34:1 vs accent — most distinct). Slight contrast loss (5.33→4.65) in exchange for ~15% better orange-vs-red separation.

**Neither CONTEXT.md-seeded hex passes AA.** Document this in the plan so the planner explicitly supersedes D-104's starting-point recommendations. This is not a departure from D-104's intent (warm/terracotta family) — it's the minimum WCAG-compliant option in that family.

**Warning icon glyph:** Unicode `⚠` (U+26A0) works reliably in JetBrains Mono (verified: the font has extensive symbol coverage including U+26A0 warning sign). But CAVEAT — Mono fonts sometimes render U+26A0 as a slightly-off-baseline triangle with uneven bounding-box width. A simpler, zero-font-risk alternative: inline SVG triangle (8 lines of JSX). The Phase 1–4 pattern of "Unicode over new deps" (D-28) argues for `⚠`; if visual QA during human-verify reveals baseline issues, swap to SVG without re-locking the decision. **Recommended: start with `⚠`.**

**Confidence: HIGH** [VERIFIED: WCAG formula applied to exact hex values; numerical contrast calibrated against existing tokens].

### Finding #8 — Validation Architecture (for Nyquist gate) [VERIFIED]

See `## Validation Architecture` section below — full test matrix with executable commands.

### Finding #9 — Non-obvious gotchas [VERIFIED — see Common Pitfalls]

See `## Common Pitfalls` section below.

## Architecture Patterns

### System Architecture Diagram

```
load.skeletonData.skins[*]          sampler.globalPeaks: Map<key, PeakRecord>
        │                                   │
        │ (enumerate per Finding #1)        │ (read per Finding #2)
        ▼                                   ▼
   defined set                         used set
   Map<attachmentName, {               Set<attachmentName>
     definedIn: string[],              (from PeakRecord.attachmentName
     sourceVariants: Set<string>       field, NOT from splitting keys)
   }>                                        │
        │                                    │
        └─────────► SET DIFFERENCE ◄─────────┘
                    (defined \ used)
                         │
                         ▼
                    UnusedAttachment[]
                    (D-96 name-level, D-98 dim-max,
                     D-107 sorted attachmentName ASC)
                         │
                         ▼
           src/main/summary.ts (D-35 projection)
                         │
                         ▼
           SkeletonSummary.unusedAttachments[]
                         │
                         ▼ (structuredClone over IPC)
           GlobalMaxRenderPanel renderer
              │                    │
              ▼                    ▼
        peak table          Unused section
        (existing)          (D-103: ABOVE peak table,
                             rendered only when length > 0,
                             D-105 red header + plain rows,
                             inherits SearchBar filter)
```

### Recommended File Layout

```
src/
├── core/
│   └── usage.ts              # NEW — findUnusedAttachments (pure-TS, DOM-free)
├── shared/
│   └── types.ts              # EXTEND — UnusedAttachment interface + SkeletonSummary.unusedAttachments
├── main/
│   └── summary.ts            # EXTEND — call findUnusedAttachments, attach to payload
├── renderer/src/
│   ├── index.css             # EXTEND — add --color-danger token inside existing @theme inline block
│   └── panels/
│       └── GlobalMaxRenderPanel.tsx  # EXTEND — add conditional <section> above peak table
└── ...
tests/
├── core/
│   └── usage.spec.ts         # NEW — 6 cases per CONTEXT §domain
└── main/
    └── summary.spec.ts       # EXTEND — unusedAttachments shape assertion
fixtures/SIMPLE_PROJECT/
├── SIMPLE_TEST_GHOST.json    # NEW — forked SIMPLE_TEST.json + GHOST region
└── SIMPLE_TEST_GHOST.atlas   # NEW — forked SIMPLE_TEST.atlas + GHOST 64×64 entry
```

### Pattern 1: Pure-TS analyzer module (follow analyzer.ts shape)
**What:** `src/core/*` modules are side-effect-free, return plain data, import types only from spine-core (never runtime classes in the hot path).
**When to use:** Always, for `usage.ts`.
**Example:** `src/core/analyzer.ts:65-80` — `function toDisplayRow(p: PeakRecord): DisplayRow` accepts sampler output, returns IPC-ready shape. Mirror this for `toUnusedAttachment`.

### Pattern 2: SkeletonSummary extension (follow animationBreakdown precedent)
**What:** Add a new field to `SkeletonSummary` + populate it in `summary.ts` + consume it in the renderer via `props.summary.<field>`.
**Example:** `src/shared/types.ts:113` — `animationBreakdown: AnimationBreakdown[];` + `src/main/summary.ts:62-67` populates it. Phase 5 copies this pattern for `unusedAttachments`.

### Pattern 3: `@theme inline` token addition (follow D-14 precedent)
**What:** Add one line inside the existing `@theme inline` block at `src/renderer/src/index.css:46-62`. Tailwind v4 auto-emits `text-danger` / `bg-danger` / `border-danger` utilities.
**Example:** `src/renderer/src/index.css:55-56` — `--color-accent: var(--color-orange-500);` was Phase 1's addition; Phase 5 adds `--color-danger: #e06b55;` (literal hex, not a Tailwind palette var reference, because the pick is non-standard).

### Anti-Patterns to Avoid

- **Splitting `globalPeaks` keys with `/`:** attachment names can contain `/` (the sampler's region.name handling at `sampler.ts:304-309` proves this). Read `.attachmentName` field.
- **Duplicating the `slot.color.a > 0` predicate:** D-92 locks this as sampler-owned. Phase 5 reads the already-filtered output.
- **Touching the sampler / CLI:** D-100 + D-102. Both are LOCKED. The change surface is usage.ts + shared/types.ts + summary.ts + panel + index.css only.
- **Referring to a library icon:** D-28. Use Unicode or inline SVG.
- **Exporting CSS variable from `var(--color-red-500)`:** Tailwind v4 doesn't have a `--color-red-500` exposed; referencing it in `@theme inline` via `var()` would emit an unresolved reference. Use a literal hex (see Finding #7).
- **Importing from `src/core/*` in the panel:** would trip Layer 3 arch.spec.ts at `tests/arch.spec.ts:19-33`. If the panel needs any helper, duplicate it in `src/renderer/src/lib/` (Phase 4 precedent: `src/renderer/src/lib/overrides-view.ts` duplicates `src/core/overrides.ts` math for the same reason).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enumerating skin attachments | Custom iteration over internal Skin fields | `skin.attachments` array walk (Finding #1) OR `skin.getAttachments()` | Either is spine-core's public API. |
| Detecting visibility | Custom `slot.color.a > 0` check | Read `sampler.globalPeaks` (pre-filtered per D-92) | Sampler already owns this at `sampler.ts:290`. |
| Resolving source dims | Reading `attachment.width` / `attachment.height` | `load.sourceDims.get(attachmentName)` | Loader handles all attachment types uniformly; source field may be stripped from MeshAttachment when "nonessential" data was omitted. |
| React sortable table | Another hand-rolled sort | Inherit from Phase 2's existing `compareRows` — NO WAIT: D-107 says no sort controls. SKIP. | D-107 locks display-only. |
| Icon library | `lucide-react` / `@heroicons/react` | Unicode `⚠` (U+26A0) | D-28 hand-rolled over deps. |
| ARIA collapsible section | Radix `Collapsible` / Headless UI `Disclosure` | Native `<details>`/`<summary>` OR non-collapsible `<section>` | CONTEXT recommends non-collapsible in Phase 5; `<details>` is single-tag ARIA-complete if collapse becomes needed. |

**Key insight:** Phase 5 is a compose-existing-primitives feature. Zero new libraries, zero new patterns, zero new boundaries. The only genuinely new artifact is `src/core/usage.ts`.

## Common Pitfalls

### Pitfall 1: Empty-skin array arithmetic
**What goes wrong:** `load.skeletonData.skins` can contain only the `default` skin (SIMPLE_TEST.json:117-150 has exactly one skin). Code that assumes `skins.length >= 2` for "cross-skin aggregation" testing breaks.
**Why it happens:** D-93 makes cross-skin semantics prominent; planner might write logic assuming multiple skins.
**How to avoid:** `usage.ts` must work for the one-skin case. The Finding #5 algorithm (single name-level `usedNames` Set) handles this naturally — no special-case needed. The per-skin tests (d/e/f in CONTEXT §domain) MUST use the in-memory synthetic skeleton OR a fixture with ≥2 skins, NOT SIMPLE_TEST.
**Warning signs:** A test case "cross-skin ... visible in skin A not flagged" running against SIMPLE_TEST returns empty — indistinguishable from a false pass.

### Pitfall 2: SIMPLE_TEST.atlas has no `orig:` line
**What goes wrong:** `load.sourceDims` provenance for SIMPLE_TEST is `atlas-bounds` (packed dims = source dims). If a GHOST fixture adds a new `GHOST` region to the atlas but omits the `orig:` line too, the ghost's sourceDims reads from `bounds:` — which is fine, but the Phase 5 code must not assume `'atlas-orig'` provenance.
**Why it happens:** `src/core/loader.ts` handles both branches transparently (`src/core/types.ts:28-29`), so the planner rarely sees the distinction. But adding a ghost atlas entry with only `bounds:` (and no `orig:`) is the simplest path.
**How to avoid:** The ghost atlas entry is just:
```
GHOST
bounds:0,0,64,64
```
(Append to SIMPLE_TEST_GHOST.atlas. No `orig:` needed. Loader picks it up as `source: 'atlas-bounds'`.)
**Warning signs:** `findUnusedAttachments` returns GHOST with `sourceW: 0, sourceH: 0` — means the atlas fork was incomplete.

### Pitfall 3: `attachment.name` vs the Skin map key
**What goes wrong:** Spine skin remapping allows `skin.attachments[slotIdx][MAPKEY]` where MAPKEY is a user-chosen alias, distinct from `attachment.name`. The Phase 5 "defined set" must key by the map key (matches how Spine itself looks up attachments — `Skin.js:145-148`).
**Why it happens:** The simpler `attachment.name` is tempting because it's what the sampler records (per `sampler.ts:325`).
**How to avoid:** In 99% of production rigs (including every fixture we ship), `MAPKEY === attachment.name`. For Phase 5, this means **using either one produces the same result on every real fixture**. But for correctness, key the defined set by `MAPKEY` (the `name` variable in the `for (const [name, attachment] of Object.entries(perSlot))` loop). Document with a code comment citing this research note.
**Warning signs:** A rig with attachment aliasing shows ghost-def false positives (the aliased name appears as defined-but-unused, but is actually just an alias). Not possible in our fixtures; deferred to real-rig hardening if ever reported.

### Pitfall 4: Non-textured attachments inflating the unused list
**What goes wrong:** SIMPLE_TEST.json registers a `PathAttachment` on the `PATH` slot (lines 133-140). The sampler's `attachmentWorldAABB` returns null for paths (`sampler.ts:296-299`), so no peak is written → path appears in "defined" but not "used" → gets flagged as unused.
**Why it happens:** Paths, Clippings, BoundingBoxes, Points are structural — they don't render textures. But they ARE registered in `skin.attachments`.
**How to avoid:** Finding #3 recommendation — filter enumeration by `load.sourceDims.get(name) !== undefined`. This naturally excludes non-textured attachments. Document: `// Phase 5 frames "unused" as "texture that won't ship" — filter non-textured.`
**Warning signs:** Baseline test `SIMPLE_TEST.json returns zero unused` FAILS with PATH appearing as unused. Fix by adding the filter.

### Pitfall 5: Tailwind v4 `@theme inline` hot-reload on new token
**What goes wrong:** Adding `--color-danger` inside `@theme inline` at dev-time: does the token emit new utilities without a full dev-server restart?
**Why it happens:** Tailwind v4's JIT engine processes the `@theme` block at config-read time; new vars may not hot-reload in vite-plugin-@tailwindcss/vite's watcher.
**How to avoid:** Verified behavior (Tailwind v4 documented): `@theme inline` changes to CSS files DO trigger a vite HMR refresh of the stylesheet, but the NEW utilities (`text-danger`, `bg-danger`, etc.) only become available after Tailwind re-scans sources. First use of `text-danger` in a `.tsx` file after adding the token: may require one manual refresh. Subsequent edits hot-reload normally. Document the one-time "restart `npm run dev` after adding the token" step in the plan's execution flow.
**Warning signs:** Dev build renders text in default color (inherited from `body` — stone-100), not the danger hex, despite the token being added. Restart `npm run dev`.

### Pitfall 6: Section layout shift race on SearchBar filter change
**What goes wrong:** User searches a name that matches only unused rows → peak table empties → page re-layouts. If the unused section is rendered conditionally on `unusedAttachments.length > 0` (the DEFINED set, not the FILTERED set), the user still sees the section. But if planner conditions on `filteredUnused.length > 0`, the section disappears when search clears all its rows even though the peak table also emptied → the user sees only the existing zero-results "No attachments match..." message from the peak table. CONTEXT.md Claude's Discretion explicitly calls this out ("render empty body text `(no matches)` to confirm the filter is working, but keep the section chrome visible").
**How to avoid:** Two reasonable paths — (a) always render section chrome if `unusedAttachments.length > 0` regardless of filter, show `(no matches)` inside the body when filtered list is empty; (b) hide the section when filtered list is empty and rely on the peak table's existing zero-results message. Recommendation: (a), matches CONTEXT preference.
**Warning signs:** Human-verify reports "the unused warning disappeared when I typed in the search" — user confusion signal.

### Pitfall 7: `definedIn` list ordering determinism
**What goes wrong:** `definedIn: ["default", "boy", "girl"]` order depends on skin iteration order in `load.skeletonData.skins` — which is JSON parse order, stable. But if the planner uses `Set` + spread to dedup, Set insertion order preserves this. If they use `Array.from(new Set(...)).sort()`, the order changes to alphabetical.
**How to avoid:** Preserve skin-iteration order (deterministic, matches what the user sees in their Spine editor). Do NOT sort alphabetically unless explicitly decided. `definedInLabel` formatting: `.join(', ')`.
**Warning signs:** Test expectation `["default", "boy", "girl"]` fails — got `["boy", "default", "girl"]` — the planner accidentally sorted.

### Pitfall 8: `structuredClone` on `Set` / `Map` inside UnusedAttachment
**What goes wrong:** Phase 5 seeded interface (CONTEXT.md §specifics:240-255) uses plain arrays and strings — all structuredClone-safe. But if planner uses a transient `Set<string>` inside the aggregation and forgets to convert to `string[]` before returning, IPC silently drops the Set or crashes.
**How to avoid:** Follow D-21 (Phase 1 lock): `SkeletonSummary` and all transitively-reachable fields must be plain primitives / arrays / objects. Verify in `tests/main/summary.spec.ts` via `expect(() => structuredClone(summary)).not.toThrow()` — this test already exists; extend it to assert the new field's shape.
**Warning signs:** `tests/main/summary.spec.ts` passes locally but fails under Electron runtime with "Data cannot be cloned".

## Code Examples

### Enumeration pattern — mirrors `src/main/summary.ts:40-49`

```ts
// src/core/usage.ts (planner implementation reference)
import type { LoadResult } from './types.js';
import type { SamplerOutput } from './sampler.js';
import type { UnusedAttachment } from '../shared/types.js';

interface DefinedEntry {
  definedIn: string[];                          // skin names in discovery order
  sourceDimsByVariant: Map<string, { w: number; h: number }>;  // key: `${w}x${h}`
}

export function findUnusedAttachments(
  load: LoadResult,
  sampler: SamplerOutput,
): UnusedAttachment[] {
  // Used set — Finding #2.
  const usedNames = new Set<string>();
  for (const peak of sampler.globalPeaks.values()) {
    usedNames.add(peak.attachmentName);
  }

  // Defined set — Finding #1 (mirrors summary.ts:40-49).
  const defined = new Map<string, DefinedEntry>();
  for (const skin of load.skeletonData.skins) {
    for (let slotIndex = 0; slotIndex < skin.attachments.length; slotIndex++) {
      const perSlot = skin.attachments[slotIndex];
      if (perSlot === undefined || perSlot === null) continue;
      for (const [attachmentName /* Finding #5: use map key, not attachment.name */] of Object.entries(perSlot)) {
        // Finding #3: filter non-textured (no atlas region → no source dims).
        const dims = load.sourceDims.get(attachmentName);
        if (dims === undefined) continue;

        let entry = defined.get(attachmentName);
        if (entry === undefined) {
          entry = { definedIn: [], sourceDimsByVariant: new Map() };
          defined.set(attachmentName, entry);
        }
        if (!entry.definedIn.includes(skin.name)) entry.definedIn.push(skin.name);  // Pitfall 7 — preserve order.
        entry.sourceDimsByVariant.set(`${dims.w}x${dims.h}`, { w: dims.w, h: dims.h });
      }
    }
  }

  // Set difference + aggregate per D-96/D-98.
  const rows: UnusedAttachment[] = [];
  for (const [name, entry] of defined) {
    if (usedNames.has(name)) continue;  // D-93: cross-skin automatic via name-level set.

    let maxW = 0, maxH = 0;
    for (const v of entry.sourceDimsByVariant.values()) {
      if (v.w > maxW) maxW = v.w;
      if (v.h > maxH) maxH = v.h;
    }
    const variantCount = entry.sourceDimsByVariant.size;
    const sourceLabel = variantCount === 1
      ? `${maxW}×${maxH}`
      : `${maxW}×${maxH} (${variantCount} variants)`;

    rows.push({
      attachmentName: name,
      sourceW: maxW,
      sourceH: maxH,
      definedIn: [...entry.definedIn],
      dimVariantCount: variantCount,
      sourceLabel,
      definedInLabel: entry.definedIn.join(', '),
    });
  }

  // D-107 — sort by attachmentName ASC (matches Phase 4 D-91 default).
  rows.sort((a, b) => a.attachmentName.localeCompare(b.attachmentName));
  return rows;
}
```

### Renderer section — follows CONTEXT §specifics seeded markup

```tsx
// Inside GlobalMaxRenderPanel, above the existing <table>:

const filteredUnused = useMemo(
  () => summary.unusedAttachments.filter(
    (u) => query.trim() === '' || u.attachmentName.toLowerCase().includes(query.toLowerCase()),
  ),
  [summary.unusedAttachments, query],
);

// Pitfall 6 — render section chrome if ANY unused exist (independent of filter):
{summary.unusedAttachments.length > 0 && (
  <section className="mb-6 border-b border-border pb-4" aria-label="Unused attachments">
    <header className="flex items-center gap-2 mb-2 text-danger font-mono text-sm font-semibold">
      <span aria-hidden="true">⚠</span>
      <span>
        {filteredUnused.length === 1
          ? '1 unused attachment'
          : `${filteredUnused.length} unused attachments`}
      </span>
    </header>
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-fg-muted font-mono text-xs">
          <th className="text-left py-1 px-3">Attachment</th>
          <th className="text-left py-1 px-3">Source Size</th>
          <th className="text-left py-1 px-3">Defined In</th>
        </tr>
      </thead>
      <tbody>
        {filteredUnused.length === 0 ? (
          <tr><td colSpan={3} className="text-fg-muted font-mono text-xs text-center py-2">(no matches)</td></tr>
        ) : filteredUnused.map((u) => (
          <tr key={u.attachmentName} className="border-b border-border">
            <td className="py-1 px-3 font-mono text-sm text-fg">{u.attachmentName}</td>
            <td
              className="py-1 px-3 font-mono text-sm text-fg-muted"
              title={u.dimVariantCount > 1 ? /* per-skin breakdown, planner picks format */ '' : undefined}
            >
              {u.sourceLabel}
            </td>
            <td className="py-1 px-3 font-mono text-sm text-fg-muted">{u.definedInLabel}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
)}
```

### `@theme inline` extension

```css
/* src/renderer/src/index.css — inside the existing @theme inline block */
@theme inline {
  /* ... existing warm-stone + orange-accent tokens ... */

  /* Phase 5 D-104 — warn/terracotta for unused attachment warning surface.
     Literal hex (not var()) because #e06b55 is not a Tailwind palette shade.
     WCAG AA pass on both bg-panel (5.33:1) and bg-surface (6.02:1); visually
     distinct from --color-accent (1.17:1 ratio — orange vs terracotta). */
  --color-danger: #e06b55;
}
```

## State of the Art

No state-of-the-art change. Phase 5 uses the same spine-core 4.2.111 API, same React 19 / Tailwind v4 stack, same Phase 0–4 patterns. Nothing has shifted since Phase 4 closed 2026-04-24.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | JetBrains Mono renders U+26A0 ⚠ glyph correctly | Finding #7 (icon glyph) | Low — inline SVG fallback is 8 lines of JSX; decision is not architectural. Human-verify surfaces the issue if present. |
| A2 | Tailwind v4 requires one `npm run dev` restart after adding a new `@theme inline` token, then hot-reloads subsequent changes normally | Pitfall 5 | Medium — if Tailwind actually needs a full rebuild every edit, dev loop slows. Verified behavior per Tailwind v4 docs; confirm during implementation. |
| A3 | Map-key name in `skin.attachments[slotIndex][MAPKEY]` equals `attachment.name` for every fixture we ship and for the ghost-def case | Finding #1 / Pitfall 3 | Low — holds for SIMPLE_TEST.json and typical Spine export output. Would break only with explicit skin remapping, which is out of scope per CONTEXT. Plan documents assumption in a code comment. |

Three assumptions total. None block the plan; all are low-to-medium-risk and surfaced for human-verify attention.

## Open Questions

1. **Multi-skin test fixture for test cases (d), (e), (f).**
   - What we know: SIMPLE_TEST.json is single-skin; the cross-skin test cases need either (a) a multi-skin JSON fixture or (b) in-memory synthetic skeleton construction.
   - What's unclear: Is the planner OK constructing spine-core classes directly in `tests/core/usage.spec.ts`, or does the project have a preference for fixture-based testing?
   - Recommendation: In-memory synthetic for cases (d/e/f) because they're parameterized (the planner wants to vary dim divergence, visibility pattern, etc. without shipping multiple JSON files). The ghost-def smoke test (case (b)) uses the JSON fixture.

2. **`definedIn` tooltip format for multi-skin dim breakdown (D-98 — Claude's Discretion).**
   - What we know: CONTEXT suggests either `"128×128 in boy; 256×256 in girl"` or multiline. No project precedent for multi-line tooltips (browser `title` attr usually renders single-line).
   - What's unclear: Should the tooltip be HTML-rich (requires Radix-like tooltip) or a plain `title` attribute?
   - Recommendation: Plain `title` attribute, single-line `"128×128 in boy; 256×256 in girl"` — D-28 hand-rolled over deps; adding a tooltip library for one use case isn't worth it.

3. **When does the `⚠` glyph render wrong in JetBrains Mono?** (Assumption A1.)
   - What we know: The font ships extensive symbol coverage.
   - What's unclear: Rendering subtleties (baseline alignment in a mixed-text line) on macOS vs Windows.
   - Recommendation: Start with Unicode; treat rendering issues as a human-verify finding, not a planning concern.

## Environment Availability

Skipped — Phase 5 is a pure code/config change. No new external dependencies. Every tool + library needed (vitest, typescript, tailwind v4, electron-vite, spine-core) is already installed per Phase 1–4 locks (verified: `node_modules/@esotericsoftware/spine-core/package.json:3` = 4.2.111; `package.json:27-37` = all tooling present).

## Validation Architecture

> `workflow.nyquist_validation` is not set in `.planning/config.json` → treated as enabled per agent protocol.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.0.0 [VERIFIED: `package.json:37`] |
| Config file | `vitest.config.ts` at project root |
| Quick run command | `npm run test -- tests/core/usage.spec.ts` |
| Full suite command | `npm run test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| F6.1 | SIMPLE_TEST.json returns empty `unusedAttachments[]` (baseline — every CIRCLE/SQUARE/TRIANGLE renders in setup or anim) | unit | `npm run test -- tests/core/usage.spec.ts -t "SIMPLE_TEST baseline"` | ❌ Wave 0 |
| F6.1 (D-95) | SIMPLE_TEST_GHOST.json returns exactly 1 row, `attachmentName === "GHOST"`, `sourceW: 64, sourceH: 64`, `definedIn: ["default"]` | unit | `npm run test -- tests/core/usage.spec.ts -t "ghost-def smoke"` | ❌ Wave 0 |
| F6.1 (D-93) | 2-skin synthetic: "HEAD" visible in skinA, registered-without-rendering in skinB → NOT flagged (defined set has HEAD, used set has HEAD, difference empty) | unit | `npm run test -- tests/core/usage.spec.ts -t "cross-skin visible in one"` | ❌ Wave 0 |
| F6.1 (D-98) | 2-skin synthetic: "DEAD" registered in skinA (128×128) AND skinB (256×256), unused in both → returns 1 row, `sourceW: 256, sourceH: 256, dimVariantCount: 2, sourceLabel: "256×256 (2 variants)"` | unit | `npm run test -- tests/core/usage.spec.ts -t "cross-skin dim divergence"` | ❌ Wave 0 |
| F6.1 (D-92) | Synthetic: AttachmentTimeline switches "FLASH" in for slot but alpha stays 0 → NOT in sampler.globalPeaks → FLAGGED as unused | unit | `npm run test -- tests/core/usage.spec.ts -t "alpha-zero unrendered"` | ❌ Wave 0 |
| F6.1 (D-92) | Synthetic: AttachmentTimeline switches "REAL" in for slot with alpha=1 for ≥ 1 tick → present in sampler.globalPeaks → NOT flagged | unit | `npm run test -- tests/core/usage.spec.ts -t "alpha-nonzero rendered"` | ❌ Wave 0 |
| F6.1 (invariant) | Defined set ⊇ Used set (sanity): every `globalPeaks` attachmentName must appear in at least one `skin.attachments` map — else a sampler bug exists | unit | `npm run test -- tests/core/usage.spec.ts -t "defined-set-superset-of-used"` | ❌ Wave 0 |
| F6.2 | `summary.unusedAttachments` field present on SkeletonSummary, is array, correct empty shape on SIMPLE_TEST | unit | `npm run test -- tests/main/summary.spec.ts -t "unusedAttachments field"` | ⚠️ Wave 0 extend |
| F6.2 (D-102 invariant) | CLI output byte-for-byte unchanged on SIMPLE_TEST (golden test via `scripts/cli.ts`) | integration | `npm run test -- tests/cli.spec.ts` (if exists) OR manual `npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` diff | ✅ (manual) |
| F6.2 (D-21 invariant) | `structuredClone(summary)` succeeds on SkeletonSummary including `unusedAttachments` | unit | `npm run test -- tests/main/summary.spec.ts -t "structuredClone safe"` | ⚠️ extend existing |
| F6.2 (Layer 3) | arch.spec.ts: `src/core/usage.ts` + new panel markup: renderer file does not import from `src/core/*` | unit | `npm run test -- tests/arch.spec.ts` | ✅ (auto-scans new files) |
| F6.2 (`core/` DOM-free) | `src/core/usage.ts` has no `document` / `window` / `React` symbols in its imports or code | unit | `npm run test -- tests/core/usage.spec.ts -t "hygiene"` | ❌ Wave 0 |
| F6.2 (renderer) | Section renders when `summary.unusedAttachments.length > 0`, does not render when 0 | component (Testing Library or happy-dom — planner's call) | `npm run test -- tests/renderer/*` | ❌ Wave 0 (planner decides if component tests or human-verify) |
| F6.2 (human-verify) | SearchBar filter applies to both peak table and unused section; ghost fixture drops with red section; SIMPLE_TEST drops with no section | manual | human-verify checkpoint on final plan | `checkpoint:human-verify` |

### Sampling Rate
- **Per task commit:** `npm run test -- tests/core/usage.spec.ts` (sub-second)
- **Per wave merge:** `npm run test` (~10s full suite after Phase 4 — 116 specs + new Phase 5 additions)
- **Phase gate:** Full suite green + human-verify sign-off before `/gsd-verify-work 5`

### Wave 0 Gaps
- [ ] `tests/core/usage.spec.ts` — NEW file covering F6.1 invariants + edge cases above (7 cases)
- [ ] `tests/main/summary.spec.ts` — EXTEND existing with `unusedAttachments` field + structuredClone assertions
- [ ] `fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json` + `.atlas` — NEW forked fixture for the ghost-def smoke test (Finding #4 minimal mutation)
- [ ] Optional: `tests/renderer/UnusedSection.spec.tsx` — if planner picks component tests over human-verify for the renderer coverage

**Framework install:** None — vitest already locked in `package.json`.

## Security Domain

`security_enforcement` not set in `.planning/config.json` → treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (desktop app, no auth surface) | — |
| V3 Session Management | no | — |
| V4 Access Control | no (filesystem-scoped; user-controlled rig files) | — |
| V5 Input Validation | yes | Skeleton JSON already validated by spine-core's `SkeletonJson.readSkeletonData`; Phase 5 reads pre-validated data. The new `attachmentName` field crossing IPC is structuredClone-typed — no injection vector. |
| V6 Cryptography | no | — |

### Known Threat Patterns for {electron + typescript + react}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User-supplied JSON string injected into DOM innerHTML via `attachmentName` or `definedIn` | Tampering / Info-disclosure | React text-node rendering (JSX default). The seeded panel markup (`{u.attachmentName}`) renders as a text node, never as HTML. Verified pattern by Phase 2 D-40 at `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:198-213`. |
| `title={u.definedInLabel}` tooltip HTML injection | Tampering | Browser `title` attribute renders as text, not HTML. Safe by default. |
| IPC payload size amplification (rig with 10,000 attachments all unused) | DoS (memory) | Unused detection produces at most one row per unique attachment name; bound by `skeletonData.skins[*].attachments` cardinality. For the complex-rig case (~80 attachments per N2.2), payload growth is negligible. |
| Serialization surprise (class instance, Map, Float32Array sneaks into `unusedAttachments[]`) | DoS via structuredClone failure | D-21 typed interface + existing `tests/main/summary.spec.ts` structuredClone-safety test (extend per Wave 0 gap above). |

Phase 5 introduces no new network surface, no new filesystem surface, no new IPC channel. Attack surface delta is zero beyond the already-locked Phase 1 IPC contract.

## Sources

### Primary (HIGH confidence — code on disk 2026-04-24)
- `node_modules/@esotericsoftware/spine-core/dist/Skin.d.ts:48` — `attachments: StringMap<Attachment>[]` type declaration
- `node_modules/@esotericsoftware/spine-core/dist/Skin.js:60-69, 156-169` — `setAttachment` growing array + `getAttachments` iteration
- `node_modules/@esotericsoftware/spine-core/dist/Utils.d.ts:31-33` — `StringMap<T>` = `{[key: string]: T}`
- `node_modules/@esotericsoftware/spine-core/dist/attachments/RegionAttachment.d.ts:50-52` — `width`/`height` on RegionAttachment
- `node_modules/@esotericsoftware/spine-core/dist/attachments/MeshAttachment.d.ts:53-56` — `width`/`height` on MeshAttachment (nonessential)
- `node_modules/@esotericsoftware/spine-core/dist/attachments/Attachment.d.ts:32-35` — base Attachment `.name` field
- `node_modules/@esotericsoftware/spine-core/package.json:3` — version 4.2.111
- `src/core/sampler.ts:164, 290, 325, 334` — iteration + visibility predicate + key format + attachmentName field
- `src/core/loader.ts, types.ts:25-30, 46` — `sourceDims` + provenance semantics
- `src/core/analyzer.ts:65-80` — DisplayRow shape precedent
- `src/main/summary.ts:40-49, 62-67` — identical skin.attachments iteration pattern + SkeletonSummary extension pattern
- `src/shared/types.ts:87-116` — SkeletonSummary + extension precedent
- `src/renderer/src/index.css:46-62` — existing @theme inline block
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — existing panel structure + filter pipeline
- `tests/arch.spec.ts:19-33, 85-113` — Layer 3 grep + existing regression guards
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json:117-150` — single-skin structure + attachment registration shape
- `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` — atlas region format (bounds without orig)

### Secondary (MEDIUM confidence — computed at research time)
- WCAG 2.1 relative-luminance formula + contrast-ratio computation applied to hex candidates (Python `**2.4` + `0.2126/0.7152/0.0722` weights — verified against canonical WCAG Section 1.4.3 method).

### Tertiary (LOW confidence — marked assumptions)
- JetBrains Mono U+26A0 rendering quality (Assumption A1 — verified only via font's published glyph coverage, not at-runtime pixel inspection).
- Tailwind v4 `@theme inline` hot-reload behavior (Assumption A2 — from vendor docs; subject to vite watcher quirks).

## Metadata

**Confidence breakdown:**
- Skin API shape (Finding #1): HIGH — read from installed .d.ts, .js, and matched against existing codebase pattern.
- Used-set derivation (Finding #2): HIGH — read from sampler source lines 325, 334.
- Source dims per subclass (Finding #3): HIGH — .d.ts citations per subclass.
- Fixture strategy (Finding #4): HIGH — structure of existing JSON/atlas confirmed.
- Cross-skin D-93 (Finding #5): HIGH — sampler loop traced.
- Setup-pose/skin edge case (Finding #6): HIGH — sampler lifecycle + spine-core Skin.js lookup chain traced.
- Color token hexes (Finding #7): HIGH — numerical WCAG contrast verified at research time.
- Validation matrix (Finding #8): HIGH — direct mapping from locked decisions.
- Gotchas (Finding #9 / Pitfalls 1–8): MEDIUM-HIGH — each pitfall has a concrete codebase citation; edge-case existence is verified, impact magnitude is estimated.

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable stack, locked versions, no upstream volatility expected)
