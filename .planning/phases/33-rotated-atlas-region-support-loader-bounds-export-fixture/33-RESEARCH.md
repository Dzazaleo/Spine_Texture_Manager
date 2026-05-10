# Phase 33: Rotated atlas region support — Research

**Researched:** 2026-05-10
**Domain:** Spine atlas-source pipeline (loader → bounds → export → image-worker), spine-core 4.2 RegionAttachment math, sharp.rotate direction
**Confidence:** HIGH (all critical claims verified by source-read or empirical probe)

## Summary

Phase 33 replaces the v1.0-era `RotatedRegionUnsupportedError` hard-throw with full rotated-region support across the atlas-source pipeline. Five surfaces change: loader (drop throw + add per-RegionAttachment offset override pass), bounds (no edit — pre-cooked offsets flow through unchanged), ExportPlan (no math change — `outW = ceil(canonicalW × effScale)` is already canonical-relative), image-worker (`sharp.rotate(+90)` in both atlas-extract paths), and lockstep removal of the error class + IPC kind + tests.

Two CONTEXT-flagged research targets were resolved empirically (per `feedback_narrow_before_fixing`):

1. **Sharp rotation direction.** CONTEXT D-03 hypothesized `.rotate(-90)` based on libvips doc inference. **Empirical probe FALSIFIES this**: `sharp.rotate(+90)` is the correct un-rotation call for a Spine-CCW-packed region. Documented with cross-check (CW-packed source un-rotated by `.rotate(-90)`, confirming the sign convention).
2. **D-01 canonical-corner formula.** CONTEXT proposed substituting `originalWidth/originalHeight` for `region.width/height`. **Probe shows that formula is CORRECT for non-strip-whitespace cases but BREAKS strip-whitespace + rotation** (it produces canonical-orientation full-region bounds when SW-trimmed bounds are required for parity with non-rotated SW). The **correct formula is to SWAP `region.width ↔ region.height`** in spine-core's existing offset math — this preserves SW trim semantics AND matches the unrotated AABB at every bone state (verified across rotation/scale/attachment-rotation matrix).

**Primary recommendation:** Implement D-01 as a `region.width ↔ region.height` swap in the post-`readSkeletonData` walk; use `sharp.rotate(+90)` (not `-90`) in the image-worker; mirror `fixtures/spine_stripWS/` for `fixtures/spine_rotated/`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: Loader-side per-RegionAttachment offset override (post-readSkeletonData).** After `SkeletonJson.readSkeletonData(parsedJson)`, walk every skin's slot attachments; for each `RegionAttachment` whose `region.degrees !== 0`, manually overwrite the cached `attachment.offset` (8-float array) with canonical-corner positions. Bypasses spine-core's `RegionAttachment.updateRegion()` packed-dim layout for rotated regions only. `computeWorldVertices` then folds bone matrix × canonical offsets → correct world AABB at every bone state.
- **D-02: MeshAttachment code path stays untouched.** Mesh AABBs come from per-vertex `vertices[]` transformed through bones; spine-core's `MeshAttachment.updateRegion` rotation handling at `MeshAttachment.js:80-90` correctly remaps source-region UVs into page-pixel space for rotated regions. World AABB doesn't depend on UVs; `hullAreaRatio` peakScale uses the correctly-rotated UVs as input → already correct.
- **D-03: Full coverage — `sharp.rotate(±90)` in both atlas-extract paths.** Both passthrough (`image-worker.ts:274-298`) and resize (`image-worker.ts:380-470`) paths gain rotation handling. The `'rotated-region-unsupported'` typed ExportError at line 422-438 is removed entirely.
- **D-04: New `fixtures/spine_rotated/` Spine project mirroring `fixtures/spine_stripWS/` precedent.** Real Spine packer output. Tall-narrow region (e.g., 50×400 or 100×500) that the packer will rotate when rotation:true is enabled. Total fixture size target: ≤ 100 KB.
- **D-05: T2 coverage matrix — bone-rotation matrix on ATLAS-02, single-test ATLAS-01/03.** New tests: `loader-rotation-accept.spec.ts`, `bounds-rotation-aabb.spec.ts`, `export-rotation-dims.spec.ts`, `image-worker-rotation.spec.ts`. Delete `loader-rotation-rejection.spec.ts` + `rotated-region-error.spec.ts`. Add stale-reference grep test.

### Claude's Discretion

- Exact attachment-walking pattern in D-01 (skin × slot × attachment iterator vs spine-core's `Skin.attachments` accessor — both work; planner picks idiomatic).
- Whether the loader's offset-override pass applies to ALL skins or just the default skin. **Recommended: ALL skins** (memory `project_sampler_visibility_invariant` says all skin-declared attachments are sampled).
- The exact 8-float canonical-corner formula in D-01 — derive from `attachment.width/height/x/y/scaleX/scaleY/rotation`. **RESOLVED in this RESEARCH** — use the `region.width ↔ region.height` swap (NOT the `originalWidth/Height` substitution), which preserves SW trim semantics. See §"D-01 Formula Derivation" below.
- ATLAS-01 test asserting exact count of rotated regions. **Recommended: yes** — locks the fixture's expected shape.
- Sharp rotation argument naming and direction — **VERIFIED EMPIRICALLY: `sharp.rotate(+90)`** (NOT `-90` as CONTEXT D-03 hypothesized). See §"Sharp Rotation Direction (Empirical)" below.
- Whether `tests/core/no-stale-rotation-error.spec.ts` uses `fs.readFile` walk or `child_process` grep. **Recommended: in-process readdir + read + regex** (Layer 3-clean, vitest-style; mirrors `tests/arch.spec.ts` patterns).

### Deferred Ideas (OUT OF SCOPE)

- **Rotated MeshAttachment peakScale audit beyond source-read confirmation.** D-02 leaves the mesh code path untouched. Rotated meshes are rare; if a real-world fixture surfaces with peakScale anomalies, audit in a follow-up.
- **`region.degrees == 180 / 270` cases.** Current Spine editor never emits these. D-01 swap formula targets degrees==90; the planner should document this assumption in the loader comment.
- **Rotated region in atlas-less mode.** Out-of-Scope per ROADMAP — rotation branch statically unreachable.
- **In-app atlas re-packing.** Already in v1.0 deferred list.
- **Renderer error UI for `RotatedRegionUnsupportedError`.** Verified by source-read of `App.tsx:660-708`: there's no bespoke arm — only the generic `error.kind: error.message` block at line 698-708. Removing the kind requires NO renderer code change.
- **SPINE_4_2_COVERAGE_AUDIT items 4/5.** Sequence + rotation interaction tracked separately.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ATLAS-01 | Loader accepts atlas regions packed with `rotate: true`. Hard-throw `RotatedRegionUnsupportedError` removed. Rotated regions propagate through `analyzer.ts` like any other region. Atlas-less mode unaffected. | §Implementation Sites — loader.ts:507-522 throw block deletion. §Standard Stack — spine-core 4.2 already parses `region.degrees` correctly (verified at TextureAtlas.js:87-93). |
| ATLAS-02 | `attachmentWorldAABB` in `src/core/bounds.ts` produces canonical world-space AABB for rotated regions matching the runtime at identity scale. | §D-01 Formula Derivation (proven matching across 8-bone-state matrix incl. attachment.rotation). §Architecture — D-01 cooks canonical offsets ONCE at load, bounds.ts hot loop unchanged. |
| ATLAS-03 | ExportPlan output dimensions for rotated regions reflect the unrotated W×H. | §Implementation Sites — export.ts:325 `outW = ceil((canonicalW ?? sourceW) × effScale)` is already canonical-relative; D-01 making peakScale canonical-correct flows through automatically. No math change required. |
| ATLAS-04 | Rotated-atlas regression fixture under `fixtures/spine_rotated/` exercised by core unit tests covering ATLAS-01..03. | §Test Fixture — `fixtures/spine_rotated/` is NOT gitignored (verified by `git check-ignore` and `.gitignore` audit). §Code Examples — fixture composition mirrors `fixtures/spine_stripWS/` (40K precedent). |

## Project Constraints (from CLAUDE.md)

- **Spine animations are stored in seconds** — irrelevant for this phase.
- **`computeWorldVertices` after `updateWorldTransform` already handles** the bone chain, slot scale, weighted-mesh bone influences, IK, TransformConstraints, PathConstraints, PhysicsConstraints, DeformTimelines. **D-01 leverages this**: pre-cooked canonical offsets flow through `computeWorldVertices` unchanged; rotation handling lives entirely at load time.
- **Sampler lifecycle** — irrelevant for this phase (no sampler change).
- **Math phase does not decode PNGs** — D-01 offset override is pure TS object mutation, no PNG reads. **Layer-3 clean.**
- **`core/` is pure TypeScript, no DOM** — D-01 lives in `src/core/loader.ts` (already an established Layer-3 carve-out for load-time `node:fs`). Bounds.ts unchanged.
- **Default sampler rate: 120 Hz** — irrelevant.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Atlas region parsing (region.degrees) | spine-core (vendored) | — | spine-core's `TextureAtlas.parse` already sets `region.degrees = 90` for `rotate:true` (verified at TextureAtlas.js:87-93). Zero work for us. |
| Per-RegionAttachment offset override (D-01) | core/loader.ts | — | Layer 3, load-time-only carve-out. Pure TS, no DOM/sharp/electron. |
| World AABB for rotated regions | core/bounds.ts | core/loader.ts (cooks offsets) | Bounds unchanged at runtime; correctness pre-cooked at load. |
| ExportPlan canonical out dims | core/export.ts | core/analyzer.ts (peakScale source) | `outW = ceil(canonicalW × effScale)` formula already canonical-relative. |
| Sharp rotation un-extraction | main/image-worker.ts | — | Layer 4 (electron main + sharp). Sharp already chains in `extract → resize/extend`; `.rotate(+90)` slots in. |
| `RotatedRegionUnsupportedError` removal | core/errors.ts + main/ipc.ts + shared/types.ts + tests | renderer/App.tsx (none) | Lockstep multi-file delete; renderer has no bespoke UI to remove (generic error block only). |

## Standard Stack

### Core (already in package.json)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @esotericsoftware/spine-core | ^4.2.0 | RegionAttachment / MeshAttachment / TextureAtlas parsing; `region.degrees` already exposed | [VERIFIED: package.json + node_modules] Vendored at install; the project's locked Spine version. Verified at `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:87-93` that `rotate: true` → `region.degrees = 90`. |
| sharp | ^0.34.5 | Image extract / rotate / resize / encode in image-worker | [VERIFIED: package.json + node_modules/sharp/package.json] Existing dependency; `.rotate(N)` for N a multiple of 90 dispatches via `CalculateAngleRotation` to `VIPS_ANGLE_D{N}` (verified at `node_modules/sharp/src/pipeline.cc:1418-1428`). |
| vitest | (existing) | Test runner | [VERIFIED: existing test infrastructure] All Phase 33 tests are vitest-style. |

### Supporting (no new dependencies)

| Library | Purpose | When to Use |
|---------|---------|-------------|
| node:fs | Fixture file reads in tests, image-worker fs.access pre-flights | Test scaffolding only |
| node:path | Cross-platform path joins | Test scaffolding only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sharp.rotate(+90) | Manual buffer rotation in core (Layer 3) | REJECTED — would put pixel manipulation in core/, breaking Layer-3 invariant. Sharp belongs in main/. |
| D-01 (load-time offset override) | Bounds-time AABB recompute (Option C) | REJECTED per CONTEXT — re-implements transform math in the hot loop on every sampler tick. |
| D-01 SWAP | D-01 originalWidth/Height substitution | The substitution variant produces wrong AABB for SW + rotated combinations (proven below). SWAP is correct in all cases. |

**Installation:** No new packages. Use existing `npm test` infrastructure.

## D-01 Formula Derivation

[VERIFIED: empirical probe `probe-d01-formula.mjs` + `probe-sw-nonrot-aabb.mjs` + `probe-bone-rotation-aabb.mjs`]

**Spine-core's existing offset formula** (RegionAttachment.js:82-108):

```js
regionScaleX = this.width / this.region.originalWidth * this.scaleX;
regionScaleY = this.height / this.region.originalHeight * this.scaleY;
localX  = -this.width/2  * scaleX + region.offsetX * regionScaleX;
localY  = -this.height/2 * scaleY + region.offsetY * regionScaleY;
localX2 = localX + region.width  * regionScaleX;   // PACKED W
localY2 = localY + region.height * regionScaleY;   // PACKED H
// ... attachment-local rotation (cos/sin block) into offset[0..7] ...
```

For non-rotated regions (with or without strip-whitespace), `region.width/height` are in canonical orientation, so this produces the correct AABB.

For **rotated regions**, `region.width` is PACKED width = canonical HEIGHT; `region.height` is PACKED height = canonical WIDTH. The math feeds wrong dims into `localX2/localY2`, causing world AABB to be wrong even at identity bone.

**The correct fix is to SWAP `region.width ↔ region.height` for rotated regions only:**

```js
// D-01 implementation sketch (canonical TypeScript form):
for (const skin of skeletonData.skins) {
  for (const slotEntry of skin.attachments) {                  // walk all skins (memory: project_sampler_visibility_invariant)
    for (const [_attachmentName, attachment] of slotEntry) {
      if (!(attachment instanceof RegionAttachment)) continue;
      const region = attachment.region;
      if (!region || region.degrees === 0) continue;
      // Note: spine-ts editor only emits 0 or 90; document the 180/270 omission.

      // Save originals (defensive — region is shared across attachments via spine-core's
      // AtlasAttachmentLoader; mutating it would poison MeshAttachment UVs).
      const packedW = region.width;
      const packedH = region.height;
      // SWAP for offset re-derivation.
      region.width  = packedH;
      region.height = packedW;
      attachment.updateRegion();          // recompute offset[] with swapped dims
      // RESTORE — leave region's authoritative geometry untouched so MeshAttachment
      // and any other consumer sees PACKED dims as before.
      region.width  = packedW;
      region.height = packedH;
    }
  }
}
```

**Verification matrix** (probe output):

| Bone state                     | Rotated AABB w×h | Unrotated reference w×h | Match |
|---|---|---|---|
| identity                        | 100 × 500    | 100 × 500    | YES |
| bone rot 45°                    | 424.26 × 424.26 | 424.26 × 424.26 | YES |
| bone rot 90°                    | 500 × 100    | 500 × 100    | YES |
| bone rot 180°                   | 100 × 500    | 100 × 500    | YES |
| bone rot -45°                   | 424.26 × 424.26 | 424.26 × 424.26 | YES |
| bone scale 2× × 0.5×            | 200 × 250    | 200 × 250    | YES |
| bone rot 30° + scale 2×0.5      | 673.21 × 241.51 | 673.21 × 241.51 | YES |
| attachment.rotation = 30°       | 336.60 × 483.01 | 336.60 × 483.01 | YES |
| attachment.rotation = 30° + bone rot 45° | 226.00 × 508.84 | 226.00 × 508.84 | YES |

**Strip-whitespace + rotation interaction** (probe `probe-sw-nonrot-aabb.mjs`): the SWAP formula matches the unrotated SW reference AABB byte-for-byte (90×480 vs 90×480) for an SW-trimmed rotated region. The alternative `originalWidth/Height` substitution produces canonical 100×500, which would be tighter on the unrotated side and inconsistent with existing non-rotated-SW behavior.

**Caveat:** The SWAP approach mutates `region.width/height` temporarily. Two safety constraints:

1. **Restore after `updateRegion()`** — MeshAttachment's UV remap (D-02) reads PACKED dims via `region.width/height` (verified at MeshAttachment.js:80-90); leaving them swapped would corrupt mesh UVs for any mesh sharing the rotated region.
2. **Walk-order independence** — multiple RegionAttachments may share one TextureAtlasRegion (path-indirected projects). Saving + restoring around each `updateRegion()` call prevents cross-attachment poisoning.

An alternative implementation (recommended for cleanliness — discretion to planner) is to **directly write the 8 canonical floats into `attachment.offset` without calling `updateRegion()`**, eliminating the swap-restore dance. Sketch:

```js
// Direct offset write — no region mutation needed.
const att = attachment;
const region = att.region;
const radians = att.rotation * Math.PI / 180;
const cos = Math.cos(radians), sin = Math.sin(radians);
// Canonical (post-swap) regionScaleX/Y:
const rsX = att.width  / region.originalWidth  * att.scaleX;
const rsY = att.height / region.originalHeight * att.scaleY;
const localX = -att.width  / 2 * att.scaleX + region.offsetX * rsX;
const localY = -att.height / 2 * att.scaleY + region.offsetY * rsY;
// SWAP: localX2 uses region.height (post-swap canonical W); localY2 uses region.width.
const localX2 = localX + region.height * rsX;
const localY2 = localY + region.width  * rsY;
// ... apply cos/sin block as in spine-core ...
const lXc = localX*cos + att.x, lXs = localX*sin;
const lYc = localY*cos + att.y, lYs = localY*sin;
const lX2c = localX2*cos + att.x, lX2s = localX2*sin;
const lY2c = localY2*cos + att.y, lY2s = localY2*sin;
const off = att.offset;
off[0] = lXc - lYs;  off[1] = lYc + lXs;
off[2] = lXc - lY2s; off[3] = lY2c + lXs;
off[4] = lX2c - lY2s; off[5] = lY2c + lX2s;
off[6] = lX2c - lYs; off[7] = lYc + lX2s;
// Note: leave att.uvs untouched — spine-core already wrote correct UVs at parse time.
```

Either approach is correct; planner picks. Both produce identical results for ATLAS-02.

## Sharp Rotation Direction (Empirical)

[VERIFIED: empirical probe `probe-sharp-rotate.mjs` + `probe-rotate-direction-2.mjs`]

**CONTEXT D-03 hypothesized:** `sharp.rotate(-90)` — based on libvips inference that "VIPS_ANGLE_D90 = CCW".

**Falsified.** Probe results:

```
PACKED CCW90 (simulated atlas with rotate:true — 8w×4h):
  packed: TL=GREEN TR=WHITE BL=RED BR=BLUE

sharp.rotate(+90) on packed: TL=RED TR=GREEN BL=BLUE BR=WHITE  ← MATCHES canonical
sharp.rotate(-90) on packed: TL=WHITE TR=BLUE BL=GREEN BR=RED  ← does NOT match
```

**Conclusion:** `sharp.rotate(+90)` rotates **clockwise** (cancels CCW packing). The libvips API headers say `vips_rot()` D90 is CCW, but the convenience function `vips_rotate90()` is CW; sharp's `CalculateAngleRotation` dispatches to `VIPS_ANGLE_D{N}` and the empirical net effect on the user-visible API is CW for positive N. **Trust the probe; do not rely on doc inference.**

**Cross-check** (CW-packed source un-rotation): `sharp.rotate(-90)` on a CW-packed source matches canonical → confirms the sign convention is consistent.

**Spine-ts CCW packing convention** [VERIFIED: libgdx wiki + libgdx TextureAtlas.AtlasRegion JavaDoc]: `When true, the region has been rotated 90 degrees counter clockwise.` So `region.degrees == 90` ⇒ source rotated 90° CCW for packing ⇒ un-rotation requires CW = `sharp.rotate(+90)`. **The libgdx convention and the empirical probe agree.**

**Strip-whitespace + rotation pipeline order** [VERIFIED: probe `probe-sharp-rotate-extend.mjs`]:

```
extract({left:region.x, top:region.y, width:packW, height:packH})  // PACKED dims
  → rotate(+90)                                                     // un-rotate to canonical orientation
  → extend({top, bottom, left, right})                              // re-canvas to canonicalW×canonicalH
```

The `extend()` offsets MUST be in canonical orientation (which is also where Spine emits `offsetX/offsetY/originalWidth/originalHeight` per the libgdx spec). The existing strip-whitespace code at `image-worker.ts:290-298` already uses canonical offsets:

```js
pipeline = pipeline.extend({
  top:    a.h - a.offsetY - a.packH,   // ← canonical offset / packed dim mix; needs review for rotated case
  bottom: a.offsetY,
  left:   a.offsetX,
  right:  a.w - a.offsetX - a.packW,
});
```

**For rotated regions**, the `.extend()` offsets must use **post-rotation canonical-orientation packed dims**: after `sharp.rotate(+90)`, the buffer's effective width is `packH`, height is `packW` (swapped). So the rotated extend args become:

```js
.extend({
  top:    a.h - a.offsetY - a.packW,   // post-rot canonical H delta = packW
  bottom: a.offsetY,
  left:   a.offsetX,
  right:  a.w - a.offsetX - a.packH,   // post-rot canonical W delta = packH
})
```

**Verified by probe**: `extract → rotate(+90) → extend` with this swap produces byte-identical output to the unrotated SW reference.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│  loader.ts:loadSkeleton(skeletonPath)                                │
│   ├─ readSkeletonData(parsedJson)        ← spine-core math (existing)│
│   ├─ NEW: D-01 walk skins/slots/attachments                          │
│   │   └─ for each rotated RegionAttachment: rewrite offset[] (canonical)│
│   └─ atlasSources.set(...)              ← already carries rotated:bool│
│                       │                                                │
│                       v                                                │
│  bounds.ts:attachmentWorldAABB(slot, att)  ← UNCHANGED                │
│   ├─ att.computeWorldVertices(slot, wv, 0, 2)                        │
│   │   uses pre-cooked canonical offset[] → correct AABB              │
│   └─ aabbFromFloat32(wv, 4)                                           │
│                       │                                                │
│                       v                                                │
│  export.ts:buildExportPlan(summary)        ← UNCHANGED                │
│   └─ outW = ceil(canonicalW × effScale)  ← already canonical-relative│
│                       │                                                │
│                       v IPC envelope (ExportRow.atlasSource.rotated)  │
│  image-worker.ts:runExport(plan, outDir)                              │
│   ├─ passthroughCopies path (line 274-298) → NEW: insert rotate(+90)  │
│   └─ rows path (line 380-470) → NEW: insert rotate(+90), drop kind:'rotated-region-unsupported' block (422-438) │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

No structural change. New files:

```
fixtures/spine_rotated/                  # NEW — mirrors fixtures/spine_stripWS/
├── rotated.spine                        # Spine source file
└── EXPORT/
    ├── skeleton.json
    ├── skeleton.atlas                   # contains at least one rotate:true region
    ├── skeleton.png                     # packer output
    └── images/                          # OPTIONAL — if Spine export includes them
tests/core/loader-rotation-accept.spec.ts          # NEW — ATLAS-01
tests/core/bounds-rotation-aabb.spec.ts            # NEW — ATLAS-02
tests/core/export-rotation-dims.spec.ts            # NEW — ATLAS-03
tests/main/image-worker-rotation.spec.ts           # NEW — image-worker rotation
tests/core/no-stale-rotation-error.spec.ts         # NEW — grep guard
tests/core/loader-rotation-rejection.spec.ts       # DELETE
tests/core/rotated-region-error.spec.ts            # DELETE
```

### Pattern 1: Real-packer fixture mirroring `spine_stripWS`

**What:** Tall-narrow rectangle as a single attachment in a minimal Spine project; pack with `Rotation: True` enabled in the Spine editor's Texture Packer.

**Source:** `fixtures/spine_stripWS/EXPORT/skeleton.atlas` — 7-line atlas, single page, single region, 64×64 packed:

```
skeleton.png
size:64,64
filter:Linear,Linear
square
bounds:0,0,64,64
offsets:218,218,500,500
```

For `fixtures/spine_rotated/EXPORT/skeleton.atlas`, the rotated equivalent will look approximately:

```
skeleton.png
size:[packed-dims]
filter:Linear,Linear
narrow_strip
rotate:true
bounds:0,0,[packedW],[packedH]      ← packedW = canonicalH, packedH = canonicalW
[no offsets line if no strip-whitespace, OR offsets line in canonical orientation]
```

Total fixture size: target ≤ 100K (precedent: spine_stripWS at 40K).

### Pattern 2: Bone-rotation AABB matrix (synthetic, no fixture)

**What:** Build synthetic RegionAttachments + Bones in-memory; bypass fixture I/O for fast deterministic tests.

**Source:** `tests/core/bounds.spec.ts` — existing pattern uses real spine-core types instantiated by hand:

```js
import { RegionAttachment, Skeleton, /* ... */ } from '@esotericsoftware/spine-core';
// Build minimal SkeletonData → Skeleton → Slot pair, set bone state, call attachmentWorldAABB.
```

Synthetic test fixtures avoid the packer-quirk failure modes that real fixtures don't expose at unit-test scale.

### Anti-Patterns to Avoid

- **Don't recompute AABB in bounds.ts on every tick.** D-01 cooks offsets once at load — adding a per-tick branch defeats the purpose. (CONTEXT Option C rejected.)
- **Don't use `originalWidth/Height` in the D-01 substitution.** Falsified by SW + rotation probe; produces wrong AABB for SW-trimmed rotated regions. Use SWAP instead.
- **Don't assume sharp.rotate(-90).** CONTEXT D-03 hypothesis falsified empirically. Use `+90` for Spine atlases.
- **Don't put the rotation in core/.** Layer-3 invariant — sharp belongs in main/. Bounds.ts gets pre-cooked offsets only.
- **Don't mutate `region.width/height` permanently.** Multiple RegionAttachments may share one TextureAtlasRegion; permanent swap would poison MeshAttachment UVs for any mesh sharing that region. Either save+restore or use the direct-offset-write variant.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 90° pixel rotation | Manual buffer rotate in core/ | `sharp.rotate(+90)` in image-worker | Layer-3 invariant; sharp/libvips already does this with hardware-accelerated rotation. |
| Atlas-text parsing | Custom `rotate: true` parser | spine-core's `TextureAtlas` already sets `region.degrees = 90` | Verified at TextureAtlas.js:87-93. |
| Mesh UV rotation | Manual UV remap for rotated meshes | spine-core's `MeshAttachment.updateRegion` already handles 90/180/270 | Verified at MeshAttachment.js:80-110. D-02 leverages this. |
| World transform for rotated quads | Re-implement bone × offset multiply for rotated | spine-core's `RegionAttachment.computeWorldVertices` works on whatever offsets we give it | Pre-cook canonical offsets via D-01; let computeWorldVertices do its job. |

**Key insight:** Spine-core 4.2 already handles rotation correctly at every layer EXCEPT the world-quad layout for RegionAttachments (where it uses packed dims). D-01 is a 5-line fix at one specific spot in the loader; everything downstream is unchanged.

## Runtime State Inventory

> Phase 33 is a code-only change with one new in-repo fixture; no rename / refactor / migration semantics.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by code-read of loader.ts; no databases, no `.stmproj` schema fields touch rotation. | none |
| Live service config | None — no external services or n8n / Datadog / etc. in this project. | none |
| OS-registered state | None — no Task Scheduler / launchd / pm2 entries reference rotation. | none |
| Secrets/env vars | None — no env vars or secrets touch this code path. | none |
| Build artifacts | None new — existing `out/` and `dist/` are rebuilt on `npm run build`. The fixture itself is committed source, not built output. | none |

**Lockstep cleanup that mimics state-mutation:** removing `RotatedRegionUnsupportedError` requires touching FIVE source files in one atomic commit (per D-158/D-171 lockstep precedent), or the codebase enters a "type union references missing class" state mid-merge:

- `src/core/errors.ts:164-187` (class definition)
- `src/core/loader.ts:44` (import) + `:507-522` (throw block)
- `src/main/ipc.ts:134` (KNOWN_KINDS Set entry)
- `src/shared/types.ts:894` (KnownErrorKind union arm)
- `src/main/image-worker.ts:422-438` (typed-error block) + `:35` (docblock)
- `src/shared/types.ts:107, :395, :498, :523` (ExportError kind doc + union — `'rotated-region-unsupported'` literal)

Plus three test files:
- `tests/core/loader-rotation-rejection.spec.ts` (delete)
- `tests/core/rotated-region-error.spec.ts` (delete)
- `tests/main/image-worker.atlas-extract.spec.ts:115-168` (delete the rotated-region-unsupported sub-test)
- `tests/core/loader.spec.ts:231-247` (the "no rotated regions" lock — must be REMOVED or REPHRASED post-Phase 33)

## Common Pitfalls

### Pitfall 1: Mutating shared TextureAtlasRegion

**What goes wrong:** SWAP-then-`updateRegion()`-then-don't-restore poisons MeshAttachment UVs for any mesh sharing the rotated region (path-indirected projects).

**Why it happens:** spine-core's `AtlasAttachmentLoader` returns the SAME `TextureAtlasRegion` instance for multiple attachments referencing the same path.

**How to avoid:** Either (a) save packed dims + swap + `updateRegion()` + restore, OR (b) use the direct-offset-write variant that touches NO region state. Recommend (b) for clarity.

**Warning signs:** Mesh-attachment unit tests fail with off-by-90° UVs after the loader walk runs.

### Pitfall 2: `region.degrees == 180 / 270`

**What goes wrong:** D-01 SWAP formula targets `degrees == 90` only. A 180° or 270° atlas region would silently produce wrong AABBs.

**Why it happens:** Current Spine editor only emits 0 or 90 (rotation toggle is binary). Future editor versions or atypical packers might emit 180/270; spine-core handles them at the UV level (MeshAttachment.js:91-110) but our D-01 doesn't.

**How to avoid:** Document the assumption in the loader comment: "D-01 SWAP handles `region.degrees === 90` only. Spine editor never emits 180/270 in 4.2; if a future export surfaces non-90° rotation, this path silently misbehaves." Per CONTEXT Out-of-Scope.

**Warning signs:** A user-reported AABB mismatch on an atlas the user re-packed with a non-Spine packer.

### Pitfall 3: `extend()` offset orientation post-rotation

**What goes wrong:** Strip-whitespace + rotated region renders to wrong canvas position because `extend()` offsets are computed from packed-orientation `packW/packH` without swapping for post-rotation orientation.

**Why it happens:** Existing image-worker.ts:290-298 + 521-541 logic uses `a.h - a.offsetY - a.packH` (top) and `a.w - a.offsetX - a.packW` (right). These are correct ONLY when the buffer at the time of `.extend()` is in canonical orientation AND has dims `packW × packH`. After `.rotate(+90)`, the buffer dims are `packH × packW` (swapped).

**How to avoid:** For rotated regions, swap `packW ↔ packH` in the extend args. Or equivalently: rebuild the extend args based on post-rotation buffer dims.

**Warning signs:** Image-worker rotation test produces correctly-rotated pixels but at wrong (x, y) inside the canvas.

### Pitfall 4: Sharp pipeline order with `.extract().rotate().extend().resize()` chain

**What goes wrong:** [VERIFIED: existing image-worker.ts:509-518 docblock] Sharp orders pipeline operations as `pre-extract → resize → extend → composite → post-extract` regardless of chain order, so a single `.extract().extend().resize()` pipeline yields wrong dims for SW regions. The existing fix materializes the extend output to a Buffer first, then re-opens.

**Why it happens:** libvips operation reordering is per-pipeline; chained ops don't always execute in the order coded.

**How to avoid:** For rotated SW regions, mirror the existing two-pipeline pattern (image-worker.ts:521-541): `extract → rotate → extend → toBuffer → re-open → applyResizeAndSharpen`. This is the safest path; planner can investigate single-pipeline `.rotate(+90)` insertion as an optimization but should default to two-pipeline.

**Warning signs:** "extract_area: bad extract area" libvips error in the resize branch test.

### Pitfall 5: Fixture grep hygiene before commit

**What goes wrong:** A `.gitignore` wildcard like `fixtures/spine_*` could shadow `fixtures/spine_rotated/`, causing the fixture to be excluded from the commit but referenced by tests (post-clone CI breakage).

**Why it happens:** Memory `feedback_gitignore_fixtures_check_test_refs` documents v1.3.1 burning a tag this way.

**How to avoid:** [VERIFIED: `.gitignore` audit + `git check-ignore`] No such wildcard exists. `fixtures/spine_rotated/` is NOT shadowed by current `.gitignore` (only `fixtures/Jokerman/`, `Girl/`, `images/`, `Chicken/`, `3Queens/`, `CHJ/`, `MON_FILES/`, `SAMPLER_ALPHA_ZERO/`, and `test_4.3/` are gitignored individually). If the fixture is committed under a different name in the future, re-run `git check-ignore <path>` before commit.

**Warning signs:** Tests pass locally but fail on a fresh clone / CI runner.

### Pitfall 6: Sharp rotation direction assumption

**What goes wrong:** Implementing `sharp.rotate(-90)` based on libvips doc reading produces 180° wrong output (canonical TL becomes BR after the wrong rotation).

**Why it happens:** [VERIFIED: empirical probe] libvips docs are contradictory: `vips_rot()` says VIPS_ANGLE_D90 is CCW, but `vips_rotate90()` is CW; sharp's `CalculateAngleRotation` dispatches positive int N to `VIPS_ANGLE_D{N}`. The empirical net effect on sharp's user-facing API is **clockwise for positive angles**, so `sharp.rotate(+90)` cancels Spine's CCW packing.

**How to avoid:** Bake the verified direction into the implementation comment. Test pixel-content against an unrotated reference, NOT just dims.

**Warning signs:** Rotated atlas region exports with correct dims (canonical W×H) but visually wrong (e.g., upside-down or mirrored).

## Code Examples

### D-01 Loader walk (recommended direct-offset variant)

```typescript
// src/core/loader.ts (after readSkeletonData, replacing the throw block)
import { RegionAttachment } from '@esotericsoftware/spine-core';

// Phase 33 — D-01: per-RegionAttachment offset override for rotated regions.
// Bypasses spine-core RegionAttachment.updateRegion()'s packed-dim layout
// (which produces wrong world-quad geometry for rotate:true regions).
// Direct-write variant — touches no region state, so MeshAttachment.updateRegion
// downstream still sees PACKED dims as before (D-02 untouched).
//
// Walks ALL skins (memory: project_sampler_visibility_invariant — sampler
// measures all skin-declared attachments, not just default skin).
//
// ASSUMES region.degrees === 90 only. Spine editor never emits 180/270 in
// 4.2; if a future export surfaces non-90° rotation, this path silently
// misbehaves (deferred per CONTEXT Out-of-Scope).
if (!isAtlasLess) {
  for (const skin of skeletonData.skins) {
    for (const slotEntry of skin.attachments) {
      for (const [, attachment] of slotEntry) {
        if (!(attachment instanceof RegionAttachment)) continue;
        const region = attachment.region;
        if (!region || region.degrees === 0) continue;

        const { width: w, height: h, x, y, scaleX, scaleY, rotation } = attachment;
        const radians = rotation * Math.PI / 180;
        const cos = Math.cos(radians), sin = Math.sin(radians);
        // Canonical (post-swap) regionScaleX/Y:
        const rsX = (w / region.originalWidth) * scaleX;
        const rsY = (h / region.originalHeight) * scaleY;
        const localX = -w / 2 * scaleX + region.offsetX * rsX;
        const localY = -h / 2 * scaleY + region.offsetY * rsY;
        // SWAP: localX2 uses region.height (PACKED H = post-rot canonical W);
        //       localY2 uses region.width  (PACKED W = post-rot canonical H).
        const localX2 = localX + region.height * rsX;
        const localY2 = localY + region.width  * rsY;
        const lXc  = localX  * cos + x, lXs  = localX  * sin;
        const lYc  = localY  * cos + y, lYs  = localY  * sin;
        const lX2c = localX2 * cos + x, lX2s = localX2 * sin;
        const lY2c = localY2 * cos + y, lY2s = localY2 * sin;
        const off = attachment.offset;
        off[0] = lXc  - lYs;  off[1] = lYc  + lXs;
        off[2] = lXc  - lY2s; off[3] = lY2c + lXs;
        off[4] = lX2c - lY2s; off[5] = lY2c + lX2s;
        off[6] = lX2c - lYs;  off[7] = lYc  + lX2s;
        // Note: do NOT touch attachment.uvs — spine-core wrote correct
        // rotated-UVs at parse time (RegionAttachment.js:109-117).
      }
    }
  }
}
```

### Sharp rotation in image-worker (passthrough path)

```typescript
// src/main/image-worker.ts (passthrough path, replacing line 279-298)
const a = row.atlasSource!;
let pipeline = sharp(a.pagePath).extract({
  left: a.x, top: a.y, width: a.packW, height: a.packH,
});
if (a.rotated) {
  // Phase 33 D-03 — un-rotate Spine-CCW-packed region back to canonical orientation.
  // Direction VERIFIED EMPIRICALLY (CONTEXT D-03 hypothesis of -90 was falsified):
  // sharp.rotate(+90) cancels CCW packing per libgdx atlas convention.
  pipeline = pipeline.rotate(90);
}
// Strip-whitespace re-canvas. For rotated regions, the buffer is now packH × packW
// (swapped), so extend args use packW ↔ packH swap.
const sourceCanvasW = a.rotated ? a.packH : a.packW;
const sourceCanvasH = a.rotated ? a.packW : a.packH;
if (sourceCanvasW !== a.w || sourceCanvasH !== a.h) {
  pipeline = pipeline.extend({
    top:    a.h - a.offsetY - sourceCanvasH,
    bottom: a.offsetY,
    left:   a.offsetX,
    right:  a.w - a.offsetX - sourceCanvasW,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}
await pipeline.toFile(tmpPath);
```

### Sharp rotation in image-worker (resize path with two-pipeline SW handling)

```typescript
// src/main/image-worker.ts (resize path, replacing line 519-541)
const a = row.atlasSource!;
let pipeline: sharp.Sharp;
const sourceCanvasW = a.rotated ? a.packH : a.packW;
const sourceCanvasH = a.rotated ? a.packW : a.packH;
if (sourceCanvasW !== a.w || sourceCanvasH !== a.h) {
  // Two-pipeline (SW path): materialize extend output, then re-open.
  // Mirrors existing line 521-533 fix for libvips operation reordering.
  let pre = sharp(a.pagePath).extract({ left: a.x, top: a.y, width: a.packW, height: a.packH });
  if (a.rotated) pre = pre.rotate(90);
  const orig = await pre
    .extend({
      top:    a.h - a.offsetY - sourceCanvasH,
      bottom: a.offsetY,
      left:   a.offsetX,
      right:  a.w - a.offsetX - sourceCanvasW,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();
  pipeline = sharp(orig);
} else {
  // No SW — single pipeline.
  pipeline = sharp(a.pagePath).extract({ left: a.x, top: a.y, width: a.packW, height: a.packH });
  if (a.rotated) pipeline = pipeline.rotate(90);
}
await applyResizeAndSharpen(pipeline, row.outW, row.outH, row.effectiveScale, sharpenEnabled).toFile(tmpPath);
```

### ATLAS-02 synthetic test pattern

```typescript
// tests/core/bounds-rotation-aabb.spec.ts (sketch)
import { RegionAttachment, TextureAtlasRegion, /* ... */ } from '@esotericsoftware/spine-core';
import { attachmentWorldAABB } from '../../src/core/bounds.js';

// Build two minimal RegionAttachments with the same canonical dims:
//   (a) rotated region (packed dims swapped, region.degrees = 90)
//   (b) unrotated reference
// Apply D-01 cooking on (a) — for the test, do this inline.
// Then assert AABB equality across the bone-state matrix.

const matrixCases: { name: string; a: number; b: number; c: number; d: number }[] = [
  { name: 'identity',          a: 1, b: 0, c: 0, d: 1 },
  { name: 'rot 45°',           a: c45, b: s45, c: -s45, d: c45 },
  { name: 'rot 90°',           a: 0, b: 1, c: -1, d: 0 },
  { name: 'rot 180°',          a: -1, b: 0, c: 0, d: -1 },
  { name: 'rot -45°',          a: c45, b: -s45, c: s45, d: c45 },
  { name: 'scale 2× × 0.5×',   a: 2, b: 0, c: 0, d: 0.5 },
  { name: 'scale 0.5× × 2×',   a: 0.5, b: 0, c: 0, d: 2 },
];
const attachmentRotations = [0, 30];

for (const tc of matrixCases) {
  for (const attRot of attachmentRotations) {
    const rotatedAtt = buildRegionAttachment({
      width: 100, height: 500, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: attRot,
      region: { width: 500, height: 100, originalWidth: 100, originalHeight: 500, offsetX: 0, offsetY: 0, degrees: 90 },
    });
    cookD01Offsets(rotatedAtt);  // Apply the D-01 swap formula

    const unrotatedRef = buildRegionAttachment({
      width: 100, height: 500, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: attRot,
      region: { width: 100, height: 500, originalWidth: 100, originalHeight: 500, offsetX: 0, offsetY: 0, degrees: 0 },
    });

    const slotRot = buildSlot(tc); // Slot with bone matrix (a, b, c, d, x=0, y=0)
    const slotUnrot = buildSlot(tc);
    const aabbRot = attachmentWorldAABB(slotRot, rotatedAtt)!;
    const aabbUnrot = attachmentWorldAABB(slotUnrot, unrotatedRef)!;

    expect(Math.abs((aabbRot.maxX - aabbRot.minX) - (aabbUnrot.maxX - aabbUnrot.minX))).toBeLessThan(1e-6);
    expect(Math.abs((aabbRot.maxY - aabbRot.minY) - (aabbUnrot.maxY - aabbUnrot.minY))).toBeLessThan(1e-6);
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-throw on rotated regions | Full support via load-time canonical-offset cooking | Phase 33 (this) | Animators with `rotation:true` atlases can now load and Optimize. |
| Image-worker refusal `'rotated-region-unsupported'` | `sharp.rotate(+90)` in atlas-extract pipeline | Phase 33 (this) | Per-region PNG export produces canonical-orientation output. |
| `tests/core/loader.spec.ts:231-247` lock "ZERO rotated regions" | Removed/rephrased — rotated regions are now expected to flow through | Phase 33 (this) | Test must be updated, NOT deleted (it asserts on existing fixtures that DON'T have rotation; the updated form should assert on `fixtures/spine_rotated/` having rotation, AND existing fixtures still having no rotation). |

**Deprecated/outdated:**

- `RotatedRegionUnsupportedError` (errors.ts:175-187) — class deletion, lockstep with KNOWN_KINDS Set + KnownErrorKind union + 2 test files + 1 sub-test in image-worker.atlas-extract.spec.ts.
- `ExportError.kind = 'rotated-region-unsupported'` (shared/types.ts:523) — union arm deletion, lockstep with image-worker.ts:422-438 typed-error block.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Spine editor never emits `region.degrees == 180/270` in 4.2 | Pitfall 2, Project Constraints | LOW — D-01 SWAP would produce wrong AABB for 180/270 rotated regions; deferred per CONTEXT Out-of-Scope. Loader comment must document the assumption. |
| A2 | All skins should receive the D-01 walk (not just default skin) | Claude's Discretion | LOW — `project_sampler_visibility_invariant` is locked memory; this just confirms the recommendation. |
| A3 | The `extend()` post-rotation needs `packW ↔ packH` swap | Sharp Rotation Direction | LOW — verified by probe `probe-sharp-rotate-extend.mjs`. |

**Empty rows table:** Most claims in this research are `[VERIFIED]` (probe + source-read) or `[CITED]` (CONTEXT, libgdx wiki, official docs). The three above are `[ASSUMED]` based on training knowledge or LOW-confidence inferences.

## Open Questions

1. **Real Spine packer rotation thresholds**
   - What we know: Spine packer's rotation heuristic only triggers when rotation improves density.
   - What's unclear: At what aspect ratio does it kick in? 4:1? 5:1? Empirical observations from `feedback_narrow_before_fixing` precedent suggest tall-narrow strips work, but exact threshold is unknown.
   - Recommendation: Use a region of dims ≥ 5:1 (e.g., 50×400 or 100×500) for `fixtures/spine_rotated/` to maximize the chance the packer rotates it. The fixture-builder should re-pack and verify `rotate: true` appears in the resulting `.atlas` text BEFORE committing the fixture.

2. **`tests/core/loader.spec.ts:231-247` rephrase vs delete**
   - What we know: The existing test asserts that 3 fixtures (SIMPLE_TEST, EXPORT_PROJECT, Jokerman) have ZERO rotated regions. Post-Phase-33, the lock semantics flip.
   - What's unclear: Should the test be (a) deleted entirely (because the constraint is no longer load-bearing), (b) rephrased to assert "these specific 3 fixtures have ZERO rotated regions" (pure invariant), or (c) extended to assert that `fixtures/spine_rotated/` has at least 1 rotated region?
   - Recommendation: Option (b) — keep the existing 3-fixture lock as a regression guard against accidentally re-packing them, and add the spine_rotated count assertion as a separate test in `loader-rotation-accept.spec.ts` (per D-05 ATLAS-01 recommendation).

3. **Image-worker rotation pipeline order — single vs two-pipeline for non-SW rotated**
   - What we know: For SW + non-rotated, the existing two-pipeline path (extract → extend → toBuffer → re-open) avoids libvips reordering bugs. For non-SW + non-rotated, single-pipeline works.
   - What's unclear: For non-SW + rotated, does single-pipeline `extract → rotate(+90) → resize` work, or does libvips reorder?
   - Recommendation: Probe at planning time (5-line script). Default to two-pipeline if uncertain — performance is not critical; correctness is.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All tests + image-worker | ✓ | 24.13.0 (verified by probe runs) | — |
| sharp | image-worker | ✓ | 0.34.5 | — |
| @esotericsoftware/spine-core | loader + bounds | ✓ | 4.2.x (per package.json `^4.2.0`) | — |
| vitest | test runner | ✓ | (existing) | — |
| Spine editor (for fixture creation) | D-04 fixture build | OPTIONAL | — | If unavailable, the planner can use a hand-crafted atlas-text fixture (precedent: `fixtures/spine_stripWS/EXPORT/skeleton.atlas` is editable by hand if needed). Real-packer fixture is preferred but not blocking. |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** Spine editor — if user can't re-export from Spine for the fixture, planner uses hand-crafted atlas-text. The packed PNG can be a synthetic CCW-rotated buffer produced by a one-off `sharp` script.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (existing — see `package.json` `"test": "vitest run"` and `"test:watch": "vitest"`) |
| Config file | `vitest.config.ts` (existing) |
| Quick run command | `npm test -- tests/core/bounds-rotation-aabb.spec.ts` (per-test) or `npm test -- tests/core/` (core-only) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ATLAS-01 | Loader accepts rotated atlas, no throw, ≥1 rotated region in result | unit | `npm test -- tests/core/loader-rotation-accept.spec.ts` | Wave 0 |
| ATLAS-01 | (lockstep) `RotatedRegionUnsupportedError` removed — no stale references | unit (grep) | `npm test -- tests/core/no-stale-rotation-error.spec.ts` | Wave 0 |
| ATLAS-02 | World AABB matches unrotated reference across bone-rotation matrix | unit (synthetic) | `npm test -- tests/core/bounds-rotation-aabb.spec.ts` | Wave 0 |
| ATLAS-03 | ExportPlan canonical outW/outH for rotated row | unit (synthetic) | `npm test -- tests/core/export-rotation-dims.spec.ts` | Wave 0 |
| Image-worker rotation (passthrough) | Output PNG dims = canonical W×H AND pixels match unrotated reference | unit (fixture + sharp pixel-compare) | `npm test -- tests/main/image-worker-rotation.spec.ts` | Wave 0 |
| Image-worker rotation (resize) | Output PNG dims = downscaled canonical W×H AND structurally correct | unit (fixture + sharp dim-compare) | `npm test -- tests/main/image-worker-rotation.spec.ts` | Wave 0 |
| ATLAS-04 | Fixture present, in-repo, exercised by ATLAS-01..03 tests | implicit (fixture path read by 3 specs) | covered by ATLAS-01/02/03 tests | Wave 0 (fixture commit) |

### Bone-Rotation Matrix Specifics (ATLAS-02)

**Synthetic-only test** — no fixture I/O. Build `RegionAttachment` and `Slot` instances by hand using spine-core types.

**Region dimensions:** 100w × 500h canonical (5:1 aspect, matches "tall-narrow" intuition); rotated counterpart has `region.width=500, region.height=100, originalWidth=100, originalHeight=500, degrees=90`.

**Bone-rotation angles:** 0° (identity), 45°, 90°, 180°, -45°.

**Bone-scale combinations:** 1×1 (no scale), 2×0.5 (X-stretch + Y-compress), 0.5×2 (X-compress + Y-stretch). 8 cases minimum from the angle × scale cartesian.

**Attachment.rotation values:** 0° (no local rotation) AND 30° (non-zero local rotation). Doubles the matrix — 16 test cases per region pair.

**Tolerance:** AABB width and height equality with `< 1e-6` absolute tolerance (Float64 precision; spine-core uses Float32 internally so 1e-6 is conservative).

**Implementation pattern:**

```typescript
const bones: { name: string; a: number; b: number; c: number; d: number }[] = [
  { name: 'identity',         a: 1, b: 0, c: 0, d: 1 },
  { name: 'rot 45°',          a: Math.cos(Math.PI/4), b: Math.sin(Math.PI/4), c: -Math.sin(Math.PI/4), d: Math.cos(Math.PI/4) },
  { name: 'rot 90°',          a: 0, b: 1, c: -1, d: 0 },
  { name: 'rot 180°',         a: -1, b: 0, c: 0, d: -1 },
  { name: 'rot -45°',         a: Math.cos(-Math.PI/4), b: Math.sin(-Math.PI/4), c: -Math.sin(-Math.PI/4), d: Math.cos(-Math.PI/4) },
  { name: 'scale 2×0.5',      a: 2, b: 0, c: 0, d: 0.5 },
  { name: 'scale 0.5×2',      a: 0.5, b: 0, c: 0, d: 2 },
  { name: 'rot 30° + scale',  a: 2*Math.cos(Math.PI/6), b: 2*Math.sin(Math.PI/6), c: -0.5*Math.sin(Math.PI/6), d: 0.5*Math.cos(Math.PI/6) },
];
const attRots = [0, 30];

for (const bone of bones) for (const attRot of attRots) {
  const aabbRot = attachmentWorldAABB(slotWith(bone, rotatedAtt(attRot)), rotatedAtt(attRot));
  const aabbUnrot = attachmentWorldAABB(slotWith(bone, unrotatedAtt(attRot)), unrotatedAtt(attRot));
  expect(Math.abs((aabbRot.maxX - aabbRot.minX) - (aabbUnrot.maxX - aabbUnrot.minX))).toBeLessThan(1e-6);
  expect(Math.abs((aabbRot.maxY - aabbRot.minY) - (aabbUnrot.maxY - aabbUnrot.minY))).toBeLessThan(1e-6);
}
```

### Pixel-Compare Strategy (Image-Worker Rotation)

**Two-tier strategy:**

1. **Dim equality (cheap):** assert `output.width === canonicalW` and `output.height === canonicalH` via `sharp(outPath).metadata()`. This catches direction-of-rotation mistakes at the dim level (a -90° rotation would produce swapped dims).

2. **Pixel-content match (precise):**
   - Generate the **expected** canonical-orientation PNG by extracting the same region from a hand-built unrotated reference (or from `fixtures/spine_rotated/EXPORT/images/<region>.png` if Spine exports per-region images, OR from the same Spine source re-exported with `rotation:false` as a sibling reference fixture).
   - Read both via `sharp(...).raw().toBuffer()` and `Buffer.compare()`.
   - Use **byte-equal compare** for the passthrough test (no resize, no JPEG-style lossy ops; PNG encoder + libvips rotation should be byte-deterministic for small fixtures).
   - Use **tolerance compare** (ε per channel ≤ 2 of 255) for the resize test if libvips downscale introduces sub-pixel anti-aliasing differences. Mirror the existing pattern at `tests/main/image-worker.strip-whitespace.spec.ts:38-88` (which uses `meta.width/.height` only, no pixel compare — the rotation tests should add pixel compare on top).

**Recommended approach for the passthrough test:**

```typescript
// Build expected canonical buffer by composing in-memory.
const expectedRaw = await sharp(/* in-memory canonical region pixels */).raw().toBuffer();
const actualRaw = await sharp(outPath).raw().toBuffer();
expect(actualRaw.equals(expectedRaw)).toBe(true);
```

**Recommended approach for the resize test:**

```typescript
// Compare dims only; pixel-tolerance compare optional.
const meta = await sharp(outPath).metadata();
expect(meta.width).toBe(canonicalW * effScale);
expect(meta.height).toBe(canonicalH * effScale);
// Optional: load both downscaled buffers, compare with ε tolerance per channel.
```

### Fixture Composition

**Composition:** `fixtures/spine_rotated/` is the **end-to-end** fixture (real packer output, atlas-text + PNG + JSON). Synthetic tests (ATLAS-02 bone matrix) build their own RegionAttachment instances in-memory and DON'T touch the fixture.

**Test mapping:**

| Test | Uses `fixtures/spine_rotated/`? | Builds Synthetic Data? |
|------|--------------------------------|----------------------|
| `loader-rotation-accept.spec.ts` (ATLAS-01) | YES — loads `EXPORT/skeleton.json` | NO |
| `bounds-rotation-aabb.spec.ts` (ATLAS-02) | NO | YES — RegionAttachment + Slot built by hand |
| `export-rotation-dims.spec.ts` (ATLAS-03) | NO | YES — synthetic SkeletonSummary with rotated PeakRecord |
| `image-worker-rotation.spec.ts` | YES — uses `EXPORT/skeleton.png` as atlas page | YES — hand-built ExportPlan with `atlasSource.rotated:true` (mirrors existing pattern at `image-worker.strip-whitespace.spec.ts:48-75`) |
| `no-stale-rotation-error.spec.ts` | NO | NO — pure source grep |

This composition is **identical to the precedent set by `fixtures/spine_stripWS/` + `tests/main/image-worker.strip-whitespace.spec.ts`** (a single fixture-using image-worker test with hand-built ExportPlan).

### Coverage Map

| Test File | ATLAS-01 | ATLAS-02 | ATLAS-03 | ATLAS-04 |
|---|---|---|---|---|
| `tests/core/loader-rotation-accept.spec.ts` | PRIMARY | — | — | partial (uses fixture) |
| `tests/core/bounds-rotation-aabb.spec.ts` | — | PRIMARY (matrix) | — | — |
| `tests/core/export-rotation-dims.spec.ts` | — | — | PRIMARY (synthetic) | — |
| `tests/main/image-worker-rotation.spec.ts` | — | — | partial (canonical out dims) | partial (uses fixture) |
| `tests/core/no-stale-rotation-error.spec.ts` | partial (lockstep) | — | — | — |

### Sampling Rate

- **Per task commit:** `npm test -- tests/core/<spec>.spec.ts -x` (the touched spec only; vitest --bail-on-first-fail).
- **Per wave merge:** `npm test -- tests/core tests/main` (the two affected test trees).
- **Phase gate:** `npm test` full suite green before `/gsd-verify-work`.

### Wave 0 Gaps

All test infrastructure already exists (vitest is in place; multiple spec patterns established). Wave 0 work is the **fixture creation**:

- [ ] `fixtures/spine_rotated/rotated.spine` — Spine source file (build via Spine editor OR symlink from a temp copy of an existing rig with rotation enabled in pack settings).
- [ ] `fixtures/spine_rotated/EXPORT/skeleton.json` — Spine packer output.
- [ ] `fixtures/spine_rotated/EXPORT/skeleton.atlas` — must contain ≥1 line `rotate:true`.
- [ ] `fixtures/spine_rotated/EXPORT/skeleton.png` — packer output.

Test file scaffolding for Wave 1 (touch points, no test logic yet — TDD-RED placeholders):

- [ ] `tests/core/loader-rotation-accept.spec.ts` (new file)
- [ ] `tests/core/bounds-rotation-aabb.spec.ts` (new file)
- [ ] `tests/core/export-rotation-dims.spec.ts` (new file)
- [ ] `tests/main/image-worker-rotation.spec.ts` (new file)
- [ ] `tests/core/no-stale-rotation-error.spec.ts` (new file)

No framework install needed.

## Sources

### Primary (HIGH confidence)

- `node_modules/@esotericsoftware/spine-core/dist/attachments/RegionAttachment.js:66-128` — `updateRegion()` source; verified region.width/height usage at lines 86-87, region.degrees==90 UV branch at line 109.
- `node_modules/@esotericsoftware/spine-core/dist/attachments/MeshAttachment.js:80-110` — mesh UV remap rotation cases (D-02 untouched-path justification).
- `node_modules/@esotericsoftware/spine-core/dist/TextureAtlas.js:87-93` — `regionFields["rotate"]` parser sets `region.degrees = 90` for `rotate:true`.
- `node_modules/sharp/src/pipeline.cc:1418-1428` — `CalculateAngleRotation` dispatches to `VIPS_ANGLE_D{N}` (verifies sharp's rotation API).
- `node_modules/sharp/package.json` — sharp version `0.34.5`.
- `package.json` — sharp `^0.34.5`, spine-core `^4.2.0`, project version `1.3.6`.
- Empirical probes (this research session, all gitignored under `/probe-*.mjs`):
  - `probe-sharp-rotate.mjs` — direction probe (CCW-packed → rotate(+90) match).
  - `probe-rotate-direction-2.mjs` — cross-check (CW-packed → rotate(-90) match).
  - `probe-sharp-rotate-extend.mjs` — extract → rotate → extend pipeline order verification.
  - `probe-d01-formula.mjs` — initial D-01 originalWidth/Height substitution test (showed SW failure).
  - `probe-sw-nonrot-aabb.mjs` — derived correct SWAP formula via SW probe.
  - `probe-bone-rotation-aabb.mjs` — verified D-01 SWAP across bone-state matrix.
- `src/core/loader.ts:507-522` — current throw block (target for deletion).
- `src/core/loader.ts:680-744` — atlasSources construction (already carries `rotated:bool`, no change needed).
- `src/core/bounds.ts:59-92` — `attachmentWorldAABB` (delegates to `computeWorldVertices`; no change needed).
- `src/core/export.ts:325` — `outW = ceil((canonicalW ?? sourceW) × effScale)` (already canonical-relative).
- `src/main/image-worker.ts:274-298` + `:380-470` — both atlas-extract paths (rotation insertion sites).
- `src/main/image-worker.ts:521-541` — existing two-pipeline SW pattern (template for rotated SW).
- `tests/main/image-worker.strip-whitespace.spec.ts` — fixture-test pattern precedent.
- `fixtures/spine_stripWS/EXPORT/` — fixture-shape precedent (40K, in-repo).
- `.gitignore` (verified by `git check-ignore fixtures/spine_rotated/`) — `spine_rotated` is NOT shadowed.

### Secondary (MEDIUM confidence)

- libgdx wiki — TexturePacker rotation direction CCW (cross-references the empirical probe finding).
- libvips API docs (https://www.libvips.org/API/current/method.Image.rot.html) — VIPS_ANGLE_D90 = CCW; supports the empirical probe finding via `vips_rotate90()` (CW alias) explanation.

### Tertiary (LOW confidence)

None. All claims are either empirically verified or sourced from primary docs / actual installed source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified by reading installed `package.json` files; no new dependencies.
- Architecture: HIGH — D-01 SWAP formula proven across the 8-case bone-rotation matrix + attachment.rotation cases; sharp.rotate(+90) direction empirically verified twice (CCW + CW packed sources).
- Pitfalls: HIGH — Pitfalls 1-4 verified by source-read of existing code (image-worker, MeshAttachment, libvips reordering); Pitfall 5 verified by `git check-ignore`; Pitfall 6 verified by probe.
- Validation Architecture: HIGH — vitest existing, fixture pattern exists (spine_stripWS), pixel-compare pattern exists in image-worker.strip-whitespace.spec.ts.

**Research date:** 2026-05-10
**Valid until:** 2026-06-10 (30 days — stable Spine 4.2 + sharp 0.34 stack).
