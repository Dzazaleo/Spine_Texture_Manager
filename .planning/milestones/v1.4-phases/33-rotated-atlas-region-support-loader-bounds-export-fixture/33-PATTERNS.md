# Phase 33: Rotated atlas region support - Pattern Map

**Mapped:** 2026-05-10
**Files analyzed:** 13 (5 modify / 6 create / 2 delete)
**Analogs found:** 13 / 13 (100%)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/loader.ts` (modify: drop throw at :507-522, add D-01 walk) | core loader / load-time math | request-response (sync) | self (`src/core/sampler.ts:164-263`, `src/core/loader.ts:295-307`) | exact (skin walk pattern) |
| `src/core/errors.ts` (modify: delete `RotatedRegionUnsupportedError` at :164-187) | error-class definition | n/a | self (Phase 22.1 ADD pattern at same lines) | exact (inverse-add) |
| `src/main/ipc.ts` (modify: remove KNOWN_KINDS entry at :134) | IPC error-kind registry | n/a | self (surrounding Set entries at :129-142) | exact |
| `src/shared/types.ts` (modify: remove union arms at :894, :498/523 ExportError) | shared type union | n/a | self (surrounding union arms) | exact |
| `src/main/image-worker.ts` (modify: rotate(+90) in two paths + delete typed-error block) | electron main / sharp pipeline | streaming (file I/O) | self (existing SW `.extend()` at :290-298, :521-541) | exact (SW precedent) |
| `tests/core/loader.spec.ts:231-247` (modify: rephrase no-rotation lock) | core unit test | n/a | self (same describe block, surrounding tests) | exact |
| `tests/main/image-worker.atlas-extract.spec.ts:115-168` (modify: delete sub-test) | main unit test | n/a | self (surrounding sub-tests in same describe) | exact |
| **CREATE** `tests/core/loader-rotation-accept.spec.ts` | core unit test (ATLAS-01) | request-response | `tests/core/loader-strip-whitespace.spec.ts` | exact (fixture-driven loader assert) |
| **CREATE** `tests/core/bounds-rotation-aabb.spec.ts` | core unit test (ATLAS-02 matrix) | n/a | `tests/core/bounds.spec.ts` + spine-core RegionAttachment ctor | role-match (synthetic AABB test) |
| **CREATE** `tests/core/export-rotation-dims.spec.ts` | core unit test (ATLAS-03) | n/a | `tests/core/export.spec.ts:147-220` (synthetic SkeletonSummary) | exact |
| **CREATE** `tests/main/image-worker-rotation.spec.ts` | main unit test (image-worker) | streaming (file I/O) | `tests/main/image-worker.strip-whitespace.spec.ts` | exact (hand-built ExportPlan + sharp meta/raw) |
| **CREATE** `tests/core/no-stale-rotation-error.spec.ts` | arch-grep guard | n/a | `tests/arch.spec.ts:20-33` + `tests/core/loader-version-guard.spec.ts:178-180` (readdir recursive) | role-match (in-process readdir + regex) |
| **DELETE** `tests/core/loader-rotation-rejection.spec.ts` | core unit test | n/a | (deleted in lockstep) | n/a |
| **DELETE** `tests/core/rotated-region-error.spec.ts` | core unit test | n/a | (deleted in lockstep) | n/a |
| **CREATE** `fixtures/spine_rotated/` (Spine source + EXPORT/) | test fixture | n/a | `fixtures/spine_stripWS/` | exact (real-packer fixture) |

## Pattern Assignments

### `src/core/loader.ts` - D-01 walk (after `readSkeletonData`)

**Analog:** `src/core/sampler.ts:164, 228` (skin → entry walk via `getAttachments()`) + `src/core/loader.ts:295-307` (existing skin → slotName attachment iteration on raw JSON).

**Skin walk pattern from sampler.ts (lines 164, 228-238):**
```typescript
for (const skin of load.skeletonData.skins) {
  // ...
  for (const entry of skin.getAttachments()) {
    const slot = skeleton.slots[entry.slotIndex];
    if (slot === undefined) continue; // defensive (skin/skeleton drift)
    const attachment = entry.attachment;
    if (attachment === null || attachment === undefined) continue;
    // ... use attachment ...
  }
}
```

**Adapt:** D-01 runs over `skeletonData.skins` (not the live Skeleton) because it mutates `attachment.offset[]` on the data-side spine-core objects, before any Skeleton instance is constructed. RESEARCH §"D-01 Loader walk" gives the exact form, and `skin.attachments` (data-shape Map) vs `skin.getAttachments()` (instance accessor) is the only divergence — both yield the same `RegionAttachment` references because spine-core's `AtlasAttachmentLoader` returns the same attachment instance across all `SkinEntry` and skin-data lookups.

**Import block to add (lines 32-39 currently):**
```typescript
import {
  AtlasAttachmentLoader,
  SkeletonJson,
  TextureAtlas,
  Texture,
  TextureFilter,
  TextureWrap,
  RegionAttachment,  // NEW — D-01 instanceof guard
} from '@esotericsoftware/spine-core';
```

**Throw block to DELETE (lines 507-522 verbatim):**
```typescript
// G-01b D-03 (Phase 22.1) — atlas-source mode, load-time rejection of
// rotated regions. ...
if (!isAtlasLess) {
  for (const region of atlas!.regions) {
    if (region.degrees !== 0) {
      throw new RotatedRegionUnsupportedError(
        region.name,
        resolvedAtlasPath ?? skeletonPath,
      );
    }
  }
}
```

**Import to DELETE (line 44):** `RotatedRegionUnsupportedError,`

**D-01 walk to ADD** (after `readSkeletonData` at line 546, see RESEARCH §"Code Examples → D-01 Loader walk" for the verified ~30-line direct-offset-write block). Walk applies in atlas-source mode only (`!isAtlasLess`); skipped for atlas-less because the synthetic atlas always emits `rotated:false` (loader.ts:723).

**Notes to mirror vs adapt:**
- **Mirror:** the defensive `attachment === null` skip, the `instanceof RegionAttachment` filter, and the `attachment.region` null guard. All three are established in sampler.ts:228-238 + bounds.ts:64-89.
- **Adapt:** walk `skin.attachments` (raw JSON map, see loader.ts:295-307 below) rather than `skin.getAttachments()` (Skeleton-instance accessor), because no Skeleton has been constructed at this point in the loader. Cross-skin sharing of region instances is non-poisoning because D-01 mutates `attachment.offset[]` (per-attachment), NOT `region.width/height` (shared via AtlasAttachmentLoader); RESEARCH §"Common Pitfalls → Pitfall 1" + §"D-01 Formula Derivation → Caveat" justify the direct-offset-write variant.
- **Adapt:** the loader's existing JSON-walk pattern at lines 295-307 iterates `skin.attachments` as a `for (const slotName in skin.attachments)` loop. D-01 can use the same shape; spine-core's `Skin.attachments` field is the same Map after `readSkeletonData` returns.

**Existing self-walk pattern at loader.ts:295-307 (for reference):**
```typescript
for (const skin of skeletonData.skins) {  // skin is now post-parse Skin instance
  for (const slotName in skin.attachments) {
    const slot = skin.attachments![slotName];
    // slot is { [attachmentName]: Attachment }
    for (const attachmentName in slot) {
      const attachment = slot[attachmentName];
      // ... operate on attachment ...
    }
  }
}
```

---

### `src/core/errors.ts` - delete `RotatedRegionUnsupportedError` (lines 164-187)

**Analog:** Phase 22.1 ADD-pattern at the same line range; the deletion is the inverse-add.

**Block to delete (verbatim from errors.ts:164-187):**
```typescript
/**
 * Phase 22.1 G-01b D-03 — atlas-source mode, load-time rejection of rotated
 * atlas regions. ...
 */
export class RotatedRegionUnsupportedError extends SpineLoaderError {
  constructor(
    public readonly regionName: string,
    public readonly atlasPath: string,
  ) {
    super(
      `Rotated atlas regions are not supported. ` +
        `Re-export from Spine with rotation disabled.\n` +
        `  Region: ${regionName}\n  Atlas: ${atlasPath}`,
    );
    this.name = 'RotatedRegionUnsupportedError';
  }
}
```

**Notes to mirror vs adapt:**
- **Mirror:** the docblock comment immediately preceding the class is also deleted (24-line block including the lead `/**` at :164). The `.name` load-bearing constraint (KNOWN_KINDS Set lookup) is preserved on every other class — only this one is removed.
- **Lockstep order:** errors.ts deletion MUST happen in the same atomic commit as loader.ts:44 import removal, ipc.ts:134 KNOWN_KINDS entry removal, and shared/types.ts:894 union arm removal. CONTEXT §"Runtime State Inventory" + RESEARCH §"Lockstep cleanup that mimics state-mutation" lock this.

---

### `src/main/ipc.ts` - remove KNOWN_KINDS entry (line 134)

**Analog:** Surrounding KNOWN_KINDS Set entries at ipc.ts:129-142.

**Block to modify (ipc.ts:129-142 current state):**
```typescript
const KNOWN_KINDS: ReadonlySet<KnownErrorKind> = new Set<KnownErrorKind>([
  'SkeletonJsonNotFoundError',
  'AtlasNotFoundError',
  'AtlasParseError',
  'MissingImagesDirError',   // Phase 21 (LOAD-01) — atlas-less catastrophic case routes through this envelope arm
  'RotatedRegionUnsupportedError', // Phase 22.1 (G-01b D-03) — load-time rotation rejection
  // Phase 12 / Plan 05 (D-21) — F3 Spine version guard. ...
]);
```

**Delete:** the single line `'RotatedRegionUnsupportedError', // Phase 22.1 (G-01b D-03) — load-time rotation rejection`. Leave the surrounding `MissingImagesDirError` line and the SpineVersionUnsupportedError comment block untouched.

**Notes to mirror vs adapt:** Set entry deletion only — no surrounding logic, no comment refactor needed. TypeScript will catch any stale reference to the kind name at compile time (KnownErrorKind union arm in shared/types.ts is deleted in the same commit).

---

### `src/shared/types.ts` - remove `KnownErrorKind` union case (line 894) + ExportError arms

**Analog:** Surrounding union arms at shared/types.ts:888-900 (SerializableError) and :522-526 (ExportError).

**Block to modify (shared/types.ts:888-900 current state):**
```typescript
  | {
      kind:
        | 'SkeletonJsonNotFoundError'
        | 'AtlasNotFoundError'
        | 'AtlasParseError'
        | 'MissingImagesDirError'          // Phase 21 (LOAD-01): atlas-less catastrophic case
        | 'RotatedRegionUnsupportedError'  // Phase 22.1 (G-01b D-03): load-time rotation rejection
        | 'ProjectFileNotFoundError'      // Phase 8 D-149: file missing on disk
        | 'ProjectFileParseError'          // Phase 8 Pitfall 9: JSON.parse SyntaxError
        | 'ProjectFileVersionTooNewError'  // Phase 8 D-151: version > 1
        | 'Unknown';
      message: string;
    }
```

**Delete:** the line `| 'RotatedRegionUnsupportedError'  // Phase 22.1 (G-01b D-03): load-time rotation rejection`.

**Also delete ExportError arm at shared/types.ts:498/523:**
```typescript
//   - 'rotated-region-unsupported': Gap-Fix #2 (2026-04-25) — atlas-only
//     fallback was triggered but the region is rotated (region.degrees
//     !== 0). First-pass refuses to attempt the rotated extract; user
//     must re-export from Spine with rotation disabled or wait for a
//     follow-up phase to add rotation handling.
// ...
export interface ExportError {
  kind: 'missing-source' | 'sharp-error' | 'write-error' | 'rotated-region-unsupported' | 'overwrite-source';
  path: string;
  message: string;
}
```

**Modify to:**
```typescript
export interface ExportError {
  kind: 'missing-source' | 'sharp-error' | 'write-error' | 'overwrite-source';
  path: string;
  message: string;
}
```

Also remove the corresponding `'rotated-region-unsupported'` paragraph from the ExportError docblock at lines ~498-503.

**Notes to mirror vs adapt:**
- **Mirror:** Other ExportRow.atlasSource docblock references at types.ts:107 mention `'rotated-region-unsupported'` (`The image-worker emits 'rotated-region-unsupported' for rotated regions`). Rephrase those docblock mentions to describe the new full-handling pipeline instead of deleting them, per RESEARCH §"State of the Art" pattern (rephrase-not-delete for the loader.spec.ts:231-247 lock; same instinct applies to docblock prose).
- **Mirror:** Other lines at types.ts:107, :395 also mention `rotated-region-unsupported` (similar atlasSource doc). Update those docblocks in lockstep — they describe the OLD refusal contract.

---

### `src/main/image-worker.ts` - passthrough path rotate (lines 274-298)

**Analog:** Existing `.extend()` strip-whitespace reconstitution at the same line range.

**Pattern to mirror (image-worker.ts:274-302 current passthrough):**
```typescript
if (passthroughUseAtlasExtract && row.atlasSource) {
  const a = row.atlasSource;
  // Extract the trimmed rect that physically exists on the page PNG.
  let pipeline = sharp(a.pagePath).extract({
    left: a.x,
    top: a.y,
    width: a.packW,
    height: a.packH,
  });
  // Reconstitute the orig canvas when Strip Whitespace was on.
  if (a.packW !== a.w || a.packH !== a.h) {
    pipeline = pipeline.extend({
      top: a.h - a.offsetY - a.packH,
      bottom: a.offsetY,
      left: a.offsetX,
      right: a.w - a.offsetX - a.packW,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  await pipeline.toFile(tmpPath);
}
```

**Adapt to (per RESEARCH §"Sharp rotation in image-worker (passthrough path)"):**
```typescript
if (passthroughUseAtlasExtract && row.atlasSource) {
  const a = row.atlasSource;
  let pipeline = sharp(a.pagePath).extract({
    left: a.x, top: a.y, width: a.packW, height: a.packH,
  });
  if (a.rotated) {
    // Phase 33 D-03 — un-rotate Spine-CCW-packed region to canonical orientation.
    // Direction VERIFIED EMPIRICALLY (CONTEXT D-03 hypothesis of -90 was falsified):
    // sharp.rotate(+90) cancels CCW packing per libgdx atlas convention.
    pipeline = pipeline.rotate(90);
  }
  // After rotate(+90) the buffer is packH × packW (swapped).
  // SW extend args must use post-rotation canonical orientation.
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
}
```

**Notes to mirror vs adapt:**
- **Mirror:** the order `extract → (rotate) → extend → toFile`. RESEARCH §"Sharp rotation direction (Empirical)" verified the pipeline order with probe `probe-sharp-rotate-extend.mjs`.
- **Adapt:** the `sourceCanvasW/H` swap branches on `a.rotated` so the existing SW math survives unchanged for non-rotated regions. RESEARCH §"Common Pitfalls → Pitfall 3" is the load-bearing reason.

---

### `src/main/image-worker.ts` - resize path rotate (lines 380-470, 519-548)

**Analog:** Two-pipeline SW pattern at image-worker.ts:519-541 (the "materialize extend output, then re-open" workaround for libvips operation reordering).

**Pattern to mirror (image-worker.ts:519-541 current SW two-pipeline):**
```typescript
const a = row.atlasSource;
let pipeline: sharp.Sharp;
if (a.packW !== a.w || a.packH !== a.h) {
  const orig = await sharp(a.pagePath)
    .extract({ left: a.x, top: a.y, width: a.packW, height: a.packH })
    .extend({
      top: a.h - a.offsetY - a.packH,
      bottom: a.offsetY,
      left: a.offsetX,
      right: a.w - a.offsetX - a.packW,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png().toBuffer();
  pipeline = sharp(orig);
} else {
  pipeline = sharp(a.pagePath).extract({
    left: a.x, top: a.y, width: a.packW, height: a.packH,
  });
}
await applyResizeAndSharpen(pipeline, row.outW, row.outH, row.effectiveScale, sharpenEnabled).toFile(tmpPath);
```

**Adapt to (per RESEARCH §"Sharp rotation in image-worker (resize path)"):**
```typescript
const a = row.atlasSource;
let pipeline: sharp.Sharp;
const sourceCanvasW = a.rotated ? a.packH : a.packW;
const sourceCanvasH = a.rotated ? a.packW : a.packH;
if (sourceCanvasW !== a.w || sourceCanvasH !== a.h) {
  // Two-pipeline (SW path): materialize extend output, then re-open.
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
  pipeline = sharp(a.pagePath).extract({ left: a.x, top: a.y, width: a.packW, height: a.packH });
  if (a.rotated) pipeline = pipeline.rotate(90);
}
await applyResizeAndSharpen(pipeline, row.outW, row.outH, row.effectiveScale, sharpenEnabled).toFile(tmpPath);
```

**Typed-error block to DELETE (image-worker.ts:422-438 verbatim):**
```typescript
// Gap-Fix #2: rotated regions are unsupported in this first pass.
if (useAtlasExtract && row.atlasSource && row.atlasSource.rotated) {
  const error: ExportError = {
    kind: 'rotated-region-unsupported',
    path: row.atlasSource.pagePath,
    message:
      `Atlas region for ${row.attachmentNames.join(', ')} is rotated; rotation handling not yet implemented. ` +
      `Re-export from Spine with rotation disabled, or wait for a follow-up phase.`,
  };
  errors.push(error);
  onProgress({ index: i, total, path: sourcePath, outPath: resolvedOut, status: 'error', error });
  continue;
}
```

Also update the docblock at image-worker.ts:35 (current: `- rotated atlasSource refusal              → 'rotated-region-unsupported'`) — delete that bullet from the error-classification list.

**Notes to mirror vs adapt:**
- **Mirror:** the two-pipeline materialize-toBuffer pattern is load-bearing for SW (RESEARCH §"Pitfall 4: Sharp pipeline order"). For SW+rotated, the same `.toBuffer() → re-open as sharp(orig)` survives unchanged; only the `pre` pipeline gains `.rotate(90)`.
- **Mirror:** `applyResizeAndSharpen` helper call (image-worker.ts:542-548) stays unchanged — sharpen logic is downstream of the rotation un-extract.
- **Adapt:** introduce `sourceCanvasW/H` as derived locals on both branches so the SW-trigger predicate uses post-rotation canonical orientation. The existing `a.packW !== a.w` predicate works because for non-rotated regions packW=canonical-W; for rotated, swap-then-compare is the equivalent.

---

### `tests/core/loader-rotation-accept.spec.ts` (CREATE — ATLAS-01)

**Analog:** `tests/core/loader-strip-whitespace.spec.ts` (fixture-driven loadSkeleton + assert on `atlasSources` Map).

**Pattern to mirror (loader-strip-whitespace.spec.ts:24-61):**
```typescript
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const STRIP_WS_FIXTURE = path.resolve('fixtures/spine_stripWS/EXPORT/skeleton.json');

describe('atlasSources — Strip-Whitespace region carries packW/packH/offsetX/offsetY', () => {
  it('Strip Whitespace ON: packW/packH match trimmed bounds; ...', () => {
    const r = loadSkeleton(STRIP_WS_FIXTURE);
    const sq = r.atlasSources.get('square');
    expect(sq).toBeDefined();
    expect(sq?.packW).toBe(64);
    expect(sq?.packH).toBe(64);
    expect(sq?.w).toBe(500);
    expect(sq?.h).toBe(500);
    expect(sq?.offsetX).toBe(218);
    expect(sq?.offsetY).toBe(218);
    expect(sq?.rotated).toBe(false);
  });
});
```

**Adapt for ATLAS-01:**
```typescript
import { describe, expect, it } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';

const ROTATED_FIXTURE = path.resolve('fixtures/spine_rotated/EXPORT/skeleton.json');

describe('loader — accepts rotated atlas regions (ATLAS-01)', () => {
  it('loadSkeleton resolves without throwing on rotate:true regions', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    expect(r.skeletonData).toBeDefined();
    expect(r.atlas).toBeDefined();
    expect(r.atlasPath).not.toBeNull();
  });

  it('at least one atlasSources entry has rotated=true (fixture has a packer-rotated region)', () => {
    const r = loadSkeleton(ROTATED_FIXTURE);
    const rotatedRegions = [...r.atlasSources.entries()].filter(([, s]) => s.rotated);
    expect(rotatedRegions.length, 'fixture must contain at least one rotated region (packer threshold met)').toBeGreaterThanOrEqual(1);
    // Lock the expected count (per CONTEXT §Claude's Discretion recommendation).
    // Fill the exact count once the fixture is built.
    // expect(rotatedRegions.length).toBe(N);
  });
});
```

**Notes to mirror vs adapt:**
- **Mirror:** fixture path resolution via `path.resolve('fixtures/spine_rotated/EXPORT/skeleton.json')`, the `loadSkeleton(FIXTURE)` smoke call, `atlasSources.get(...)` Map lookup pattern.
- **Adapt:** assert `rotated=true` for at least one region; the existing pattern at loader.spec.ts:231-247 asserts the inverse (zero rotated regions for SIMPLE/EXPORT/Jokerman) — this new file is the per-fixture positive lock recommended by CONTEXT §"Claude's Discretion".
- **Lockstep with loader.spec.ts:231-247:** rephrase that test to assert SIMPLE/EXPORT/Jokerman still have zero rotated regions (regression guard against accidental re-pack); the new fixture's positive assertion lives here.

---

### `tests/core/bounds-rotation-aabb.spec.ts` (CREATE — ATLAS-02 16-case matrix)

**Analog:** `tests/core/bounds.spec.ts:140-230` (synthetic-attachment AABB tests using real spine-core types) + spine-core `RegionAttachment` constructor.

**Pattern to mirror (bounds.spec.ts:140-187 — synthetic Region AABB pattern):**
```typescript
import { describe, expect, it } from 'vitest';
import { Skeleton, RegionAttachment, /* ... */ } from '@esotericsoftware/spine-core';
import { attachmentWorldAABB, computeRenderScale } from '../../src/core/bounds.js';

function primedSkeleton(): Skeleton {
  const { skeletonData } = loadSkeleton(FIXTURE);
  const skeleton = new Skeleton(skeletonData);
  skeleton.setToSetupPose();
  // ... apply animation state ...
  skeleton.updateWorldTransform(Physics.update);
  return skeleton;
}

describe('attachmentWorldAABB (F2.3)', () => {
  it('F2.3 Region path: returns an AABB for a RegionAttachment', () => {
    const skeleton = primedSkeleton();
    // Find a Region slot.
    let found: { slot: Slot; att: RegionAttachment } | null = null;
    for (const slot of skeleton.slots) {
      const att = slot.getAttachment();
      if (att instanceof RegionAttachment) { found = { slot, att }; break; }
    }
    const aabb = attachmentWorldAABB(found.slot!, found.att);
    expect(aabb).not.toBeNull();
    expect(aabb!.maxX).toBeGreaterThan(aabb!.minX);
  });
});
```

**Adapt for ATLAS-02 (matrix pattern per RESEARCH §"ATLAS-02 synthetic test pattern" lines 576-621):**
```typescript
import { describe, expect, it } from 'vitest';
import { RegionAttachment, TextureAtlasRegion, /* Skeleton, Slot, Bone, ... */ } from '@esotericsoftware/spine-core';
import { attachmentWorldAABB } from '../../src/core/bounds.js';

// Helper: build a TextureAtlasRegion with packed/canonical dims set.
function buildRegion(opts: { w: number; h: number; origW: number; origH: number; degrees: 0|90 }): TextureAtlasRegion { /* ... */ }

// Helper: build a RegionAttachment with a region + attachment dims.
function buildRegionAttachment(opts: { width: number; height: number; x: number; y: number; scaleX: number; scaleY: number; rotation: number; region: TextureAtlasRegion }): RegionAttachment { /* ... */ }

// Helper: apply the D-01 direct-offset-write cooking (post-readSkeletonData logic, isolated here for the test).
function cookD01Offsets(att: RegionAttachment): void { /* per RESEARCH §"D-01 Loader walk (recommended direct-offset variant)" */ }

// Helper: build a Slot with bone matrix (a, b, c, d, worldX, worldY).
function buildSlot(opts: { a: number; b: number; c: number; d: number }): Slot { /* ... */ }

describe('attachmentWorldAABB — rotated RegionAttachment matrix (ATLAS-02)', () => {
  const c45 = Math.cos(Math.PI / 4);
  const s45 = Math.sin(Math.PI / 4);
  const matrixCases = [
    { name: 'identity',          a: 1, b: 0, c: 0, d: 1 },
    { name: 'rot 45°',           a: c45, b: s45, c: -s45, d: c45 },
    { name: 'rot 90°',           a: 0, b: 1, c: -1, d: 0 },
    { name: 'rot 180°',          a: -1, b: 0, c: 0, d: -1 },
    { name: 'rot -45°',          a: c45, b: -s45, c: s45, d: c45 },
    { name: 'scale 2×0.5',       a: 2, b: 0, c: 0, d: 0.5 },
    { name: 'scale 0.5×2',       a: 0.5, b: 0, c: 0, d: 2 },
    { name: 'rot 30° + scale',   a: 2 * Math.cos(Math.PI / 6), b: 2 * Math.sin(Math.PI / 6), c: -0.5 * Math.sin(Math.PI / 6), d: 0.5 * Math.cos(Math.PI / 6) },
  ];
  const attRotations = [0, 30];

  for (const tc of matrixCases) {
    for (const attRot of attRotations) {
      it(`rotated AABB matches unrotated reference at bone=${tc.name}, attRot=${attRot}°`, () => {
        const rotatedAtt = buildRegionAttachment({
          width: 100, height: 500, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: attRot,
          region: buildRegion({ w: 500, h: 100, origW: 100, origH: 500, degrees: 90 }),
        });
        cookD01Offsets(rotatedAtt);
        const unrotatedRef = buildRegionAttachment({
          width: 100, height: 500, x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: attRot,
          region: buildRegion({ w: 100, h: 500, origW: 100, origH: 500, degrees: 0 }),
        });
        const slotRot = buildSlot(tc);
        const slotUnrot = buildSlot(tc);
        const aabbRot = attachmentWorldAABB(slotRot, rotatedAtt)!;
        const aabbUnrot = attachmentWorldAABB(slotUnrot, unrotatedRef)!;
        expect(Math.abs((aabbRot.maxX - aabbRot.minX) - (aabbUnrot.maxX - aabbUnrot.minX))).toBeLessThan(1e-6);
        expect(Math.abs((aabbRot.maxY - aabbRot.minY) - (aabbUnrot.maxY - aabbUnrot.minY))).toBeLessThan(1e-6);
      });
    }
  }
});
```

**Notes to mirror vs adapt:**
- **Mirror:** `instanceof RegionAttachment` filter, the world-vertices computation via `attachmentWorldAABB`, and tolerance comparison with `expect(...).toBeLessThan(1e-6)` (bounds.spec.ts uses `toBeCloseTo(..., 5)` at lines 226-229; for matrix sub-pixel cross-equality `1e-6` is the conservative bound per RESEARCH §"Bone-Rotation Matrix Specifics → Tolerance").
- **Adapt:** synthetic — no fixture I/O. Build `RegionAttachment` + `TextureAtlasRegion` instances by hand (RESEARCH §"Pattern 2: Bone-rotation AABB matrix synthetic" + §"Code Examples → ATLAS-02 synthetic test pattern").
- **Adapt:** `cookD01Offsets()` helper is a TEST-LOCAL copy of the D-01 swap formula because the loader's D-01 walk is inline at loader.ts (no exported helper). The test must duplicate the formula; alternative is exporting `cookRotatedRegionOffset(att)` from `src/core/loader.ts` and reusing here — planner's discretion.

---

### `tests/core/export-rotation-dims.spec.ts` (CREATE — ATLAS-03)

**Analog:** `tests/core/export.spec.ts:147-220` (synthetic SkeletonSummary pattern — peakScale > 1 clamping cases).

**Pattern to mirror (export.spec.ts:147-220):**
```typescript
import { describe, expect, it } from 'vitest';
import { buildExportPlan } from '../../src/core/export.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

describe('buildExportPlan — Gap-Fix #1 DOWNSCALE-ONLY invariant', () => {
  it('peakScale 1.5 with no override → effectiveScale = 1.0; outW = sourceW', () => {
    const summary = {
      peaks: [
        {
          attachmentKey: 'default/SLOT/ZOOMED',
          attachmentName: 'ZOOMED',
          skinName: 'default',
          slotName: 'SLOT',
          animationName: 'zoom_in',
          time: 0.5,
          frame: 30,
          peakScale: 1.5,
          peakScaleX: 1.5,
          peakScaleY: 1.5,
          worldW: 150,
          worldH: 150,
          sourceW: 100,
          sourceH: 100,
          sourcePath: '/fake/ZOOMED.png',
        },
      ],
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    expect(plan.passthroughCopies.length).toBe(1);
    const row = plan.passthroughCopies[0];
    expect(row.effectiveScale).toBeCloseTo(1.0, 6);
    expect(row.outW).toBe(100);
    expect(row.outH).toBe(100);
  });
});
```

**Adapt for ATLAS-03:**
```typescript
import { describe, expect, it } from 'vitest';
import { buildExportPlan } from '../../src/core/export.js';
import type { ExportPlan, SkeletonSummary } from '../../src/shared/types.js';

describe('buildExportPlan — rotated region canonical out dims (ATLAS-03)', () => {
  it('rotated row with canonicalW=100, canonicalH=500, peakScale=1.0 → outW=100, outH=500 (NOT swapped)', () => {
    const summary = {
      peaks: [
        {
          attachmentKey: 'default/STRIP/STRIP',
          attachmentName: 'STRIP',
          skinName: 'default',
          slotName: 'STRIP',
          animationName: 'static',
          time: 0,
          frame: 0,
          peakScale: 1.0,
          peakScaleX: 1.0,
          peakScaleY: 1.0,
          worldW: 100,
          worldH: 500,
          sourceW: 100,
          sourceH: 500,
          canonicalW: 100,
          canonicalH: 500,
          sourcePath: '/fake/STRIP.png',
          atlasSource: {
            pagePath: '/fake/page.png',
            x: 0, y: 0,
            packW: 500, packH: 100,  // PACKED dims swapped (rotate:true)
            offsetX: 0, offsetY: 0,
            w: 100, h: 500,  // canonical
            rotated: true,
          },
        },
      ],
      orphanedFiles: [],
    } as unknown as SkeletonSummary;
    const plan: ExportPlan = buildExportPlan(summary, new Map());
    const allRows = [...plan.rows, ...plan.passthroughCopies];
    expect(allRows.length).toBe(1);
    const row = allRows[0];
    // Canonical (unrotated) W×H — NOT 500×100 packed-swapped.
    expect(row.outW).toBe(100);
    expect(row.outH).toBe(500);
    expect(row.atlasSource?.rotated).toBe(true);
  });
});
```

**Notes to mirror vs adapt:**
- **Mirror:** the `as unknown as SkeletonSummary` cast (synthetic PeakRecord construction), `new Map()` empty overrides, and the `rows + passthroughCopies` partition handling.
- **Adapt:** ADD `canonicalW`/`canonicalH` fields explicitly (the existing export.spec.ts tests omit them, falling back to `sourceW/H`; for rotated regions canonical and source dims align but the explicit field makes intent clear).
- **Adapt:** add the `atlasSource: { rotated: true, packW=500 (canonical-H), packH=100 (canonical-W), w=100, h=500 }` block to reflect the post-D-01 atlasSources map shape.

---

### `tests/main/image-worker-rotation.spec.ts` (CREATE — passthrough + resize + pixel-compare)

**Analog:** `tests/main/image-worker.strip-whitespace.spec.ts` (hand-built ExportPlan + sharp metadata + raw pixel compare).

**Pattern to mirror (image-worker.strip-whitespace.spec.ts:24-158):**
```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

const SW_DIR = path.resolve('fixtures/spine_stripWS/EXPORT');
const SW_PAGE = path.join(SW_DIR, 'skeleton.png');

let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-sw-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('runExport — Strip-Whitespace atlas-extract regression', () => {
  it('passthrough branch: SW region byte-emits the orig 500×500 canvas (trimmed pixels at offset)', async () => {
    const syntheticPerRegionPath = path.join(tmpDir, 'src', 'square.png');
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/square.png',
        sourceW: 500, sourceH: 500,
        outW: 500, outH: 500,
        effectiveScale: 1,
        attachmentNames: ['square'],
        atlasSource: { pagePath: SW_PAGE, x: 0, y: 0, packW: 64, packH: 64, offsetX: 218, offsetY: 218, w: 500, h: 500, rotated: false },
      }],
      totals: { count: 1 },
    };
    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors).toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', 'square.png');
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(500);
    expect(meta.height).toBe(500);

    // Pixel spot-check via raw().toBuffer().
    const raw = await sharp(outPath).raw().toBuffer({ resolveWithObject: true });
    const { data, info } = raw;
    const px = (x, y) => { const i = (y * info.width + x) * info.channels; return { r: data[i], g: data[i + 1], b: data[i + 2], a: data[i + 3] }; };
    expect(px(0, 0).a).toBe(0);
    expect(px(250, 250).a).toBeGreaterThan(0);
  });
});
```

**Adapt for ATLAS image-worker-rotation:**
```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as os from 'node:os';
import * as fs from 'node:fs';
import * as path from 'node:path';
import sharp from 'sharp';
import { runExport } from '../../src/main/image-worker.js';
import type { ExportPlan, ExportProgressEvent } from '../../src/shared/types.js';

const ROTATED_DIR = path.resolve('fixtures/spine_rotated/EXPORT');
const ROTATED_PAGE = path.join(ROTATED_DIR, 'skeleton.png');

let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stm-export-rot-')); });
afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

describe('runExport — rotated atlas region extract (Phase 33)', () => {
  it('passthrough: rotated region → canonical W×H, NOT packed-swapped', async () => {
    // Hand-built ExportPlan row for a rotated region.
    // Adjust dims to match the actual fixture once it's built.
    const syntheticPerRegionPath = path.join(tmpDir, 'src', 'strip.png');
    const plan: ExportPlan = {
      rows: [],
      excludedUnused: [],
      passthroughCopies: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/strip.png',
        sourceW: 100, sourceH: 500,
        outW: 100, outH: 500,
        effectiveScale: 1,
        attachmentNames: ['strip'],
        atlasSource: {
          pagePath: ROTATED_PAGE,
          x: 0, y: 0,                    // adjust to fixture's actual packed-rect origin
          packW: 500, packH: 100,        // packed (swapped vs canonical)
          offsetX: 0, offsetY: 0,
          w: 100, h: 500,                // canonical
          rotated: true,
        },
      }],
      totals: { count: 1 },
    };
    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors).toEqual([]);
    expect(summary.successes).toBe(1);

    const outPath = path.join(tmpDir, 'images', 'strip.png');
    const meta = await sharp(outPath).metadata();
    expect(meta.width).toBe(100);   // canonical W (NOT packed 500)
    expect(meta.height).toBe(500);  // canonical H (NOT packed 100)
  });

  it('resize: rotated region → downscaled canonical W×H', async () => {
    const syntheticPerRegionPath = path.join(tmpDir, 'src', 'strip.png');
    const plan: ExportPlan = {
      rows: [{
        sourcePath: syntheticPerRegionPath,
        outPath: 'images/strip.png',
        sourceW: 100, sourceH: 500,
        outW: 50, outH: 250,          // 0.5× downscale
        effectiveScale: 0.5,
        attachmentNames: ['strip'],
        atlasSource: { pagePath: ROTATED_PAGE, x: 0, y: 0, packW: 500, packH: 100, offsetX: 0, offsetY: 0, w: 100, h: 500, rotated: true },
      }],
      excludedUnused: [],
      passthroughCopies: [],
      totals: { count: 1 },
    };
    const summary = await runExport(plan, tmpDir, () => {}, () => false);
    expect(summary.errors).toEqual([]);
    expect(summary.successes).toBe(1);
    const meta = await sharp(path.join(tmpDir, 'images', 'strip.png')).metadata();
    expect(meta.width).toBe(50);
    expect(meta.height).toBe(250);
  });

  // Optional 3rd test: pixel-compare against an unrotated reference (per RESEARCH §"Pixel-Compare Strategy").
  // Use sharp(...).raw().toBuffer() and Buffer.compare or per-channel tolerance.
});
```

**Notes to mirror vs adapt:**
- **Mirror:** `beforeEach`/`afterEach` tmpDir setup, `runExport(plan, tmpDir, onProgress, isCancelled)` call shape, `sharp(...).metadata()` for dim assertion, `sharp(...).raw().toBuffer({ resolveWithObject: true })` for pixel check.
- **Mirror:** `passthroughCopies` row in `plan` for passthrough test; `rows` row for resize test (image-worker.passthrough.spec.ts:48-56 + image-worker.strip-whitespace.spec.ts:38-88 are both relevant).
- **Adapt:** assert canonical (NOT packed) dims on the OUTPUT — RESEARCH §"Pixel-Compare Strategy" recommends two-tier (dim equality + pixel content).
- **Adapt:** the `atlasSource.rotated: true` flag is the new behavior surface; the old refusal path at image-worker.atlas-extract.spec.ts:115-168 must be deleted in lockstep (D-05 in CONTEXT).

---

### `tests/core/no-stale-rotation-error.spec.ts` (CREATE — arch-grep guard)

**Analog:** `tests/arch.spec.ts:20-33` (globSync + readFileSync + regex) + `tests/core/loader-version-guard.spec.ts:178-180` (readdirSync recursive walk).

**Pattern to mirror (arch.spec.ts:20-33):**
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';

describe('Architecture boundary: ...', () => {
  it('no renderer file imports from src/core', () => {
    const files = globSync('src/renderer/**/*.{ts,tsx}');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*\/core\/|from ['"]@core/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Renderer files importing core: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

**Adapt for no-stale-rotation-error:**
```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync, globSync } from 'node:fs';

describe('No stale RotatedRegionUnsupportedError reference (Phase 33 lockstep cleanup)', () => {
  it('no src/ file references RotatedRegionUnsupportedError', () => {
    const files = globSync('src/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/RotatedRegionUnsupportedError/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Files still referencing RotatedRegionUnsupportedError: ${offenders.join(', ')}`).toEqual([]);
  });

  it("no src/ file references the ExportError kind 'rotated-region-unsupported'", () => {
    const files = globSync('src/**/*.ts');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/'rotated-region-unsupported'/.test(text)) {
        offenders.push(file);
      }
    }
    expect(offenders, `Files still referencing 'rotated-region-unsupported' ExportError kind: ${offenders.join(', ')}`).toEqual([]);
  });
});
```

**Notes to mirror vs adapt:**
- **Mirror:** `globSync('src/**/*.ts')` + per-file `readFileSync` + regex match, `expect(offenders, msg).toEqual([])` assertion shape.
- **Adapt:** two greps — one for the class identifier `RotatedRegionUnsupportedError` (deleted from errors.ts/loader.ts/ipc.ts/shared/types.ts in lockstep), one for the ExportError kind literal `'rotated-region-unsupported'` (deleted from shared/types.ts ExportError union + image-worker.ts typed-error block + docblock).
- **Adapt:** `tests/` is NOT included in the glob — only `src/**/*.ts`. The deleted test files are explicit deletions; this grep is for SOURCE drift only.
- **Adapt:** include `src/main/image-worker.ts:35` docblock check (the `- rotated atlasSource refusal → 'rotated-region-unsupported'` bullet); the kind-literal grep above catches it.

---

### `tests/core/loader.spec.ts:231-247` (MODIFY — rephrase no-rotation lock)

**Analog:** Same test (`loader.spec.ts:231-247`).

**Current state:**
```typescript
it('atlasSources rotated flag — SIMPLE_TEST + EXPORT_PROJECT + Jokerman all have ZERO rotated regions (first-pass scope)', () => {
  // Locks the no-rotation precondition for the Gap-Fix #2 first-pass.
  // If a future fixture introduces a rotated region, this test FAILS to
  // force the contributor to add explicit handling.
  const fixtures = [
    FIXTURE,
    path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json'),
  ];
  const jokerman = path.resolve('fixtures/Jokerman/JOKERMAN_SPINE.json');
  if (fs.existsSync(jokerman)) fixtures.push(jokerman);
  for (const f of fixtures) {
    const r = loadSkeleton(f);
    for (const [name, src] of r.atlasSources) {
      expect(src.rotated, `${path.basename(f)} region ${name} is rotated — first-pass Gap-Fix #2 does not support this`).toBe(false);
    }
  }
});
```

**Adapt to (per RESEARCH §"Open Questions → Q2 → Recommendation (b)" — keep the 3-fixture lock as regression guard):**
```typescript
it('atlasSources rotated flag — SIMPLE_TEST + EXPORT_PROJECT + Jokerman are not rotated (regression guard against accidental re-pack)', () => {
  // Pre-Phase 33 this asserted "first-pass Gap-Fix #2 cannot handle rotation".
  // Post-Phase 33 the loader handles rotation correctly; this remains as a
  // regression guard against an accidental re-export with rotation:true on
  // any of these three legacy fixtures (their atlases were authored with
  // rotation:false and that authoring choice is part of the fixture contract).
  // Positive rotation-handling assertions live in tests/core/loader-rotation-accept.spec.ts.
  const fixtures = [
    FIXTURE,
    path.resolve('fixtures/EXPORT_PROJECT/EXPORT.json'),
  ];
  const jokerman = path.resolve('fixtures/Jokerman/JOKERMAN_SPINE.json');
  if (fs.existsSync(jokerman)) fixtures.push(jokerman);
  for (const f of fixtures) {
    const r = loadSkeleton(f);
    for (const [name, src] of r.atlasSources) {
      expect(src.rotated, `${path.basename(f)} region ${name} is rotated — these fixtures must remain non-rotated for fixture-contract stability`).toBe(false);
    }
  }
});
```

**Notes to mirror vs adapt:**
- **Mirror:** test scaffolding (`fixtures` array, `for (const f of fixtures)`, `expect(src.rotated).toBe(false)`).
- **Adapt:** rename the test, update the docblock, and rephrase the failure message — the LOCK semantics flip from "rotation not handled" to "fixture-contract stability". The test runs unchanged structurally.

---

### `tests/main/image-worker.atlas-extract.spec.ts:115-168` (DELETE the sub-test)

**Analog:** Surrounding sub-tests at image-worker.atlas-extract.spec.ts:44-113 (success path) and :170-end (other error sub-tests).

**Block to delete (verbatim from image-worker.atlas-extract.spec.ts:115-168):** the entire `it('rotated atlas region → emits "rotated-region-unsupported"...', ...)` block. Leaves the file's other sub-tests untouched.

**Notes to mirror vs adapt:**
- **Mirror:** the deletion preserves the file's `describe('runExport — Gap-Fix #2 atlas-extract integration (Jokerman fixture)', ...)` outer wrapper.
- **Adapt:** the new image-worker-rotation.spec.ts (created above) replaces this test's positive-path coverage; positive rotation handling is asserted in the new file, not here.

---

### `fixtures/spine_rotated/` (CREATE — Spine source + EXPORT folder)

**Analog:** `fixtures/spine_stripWS/` (Spine source `.spine` file + EXPORT folder with skeleton.json + skeleton.atlas + skeleton.png).

**Structure to mirror (fixtures/spine_stripWS/ layout):**
```
fixtures/spine_stripWS/
├── strip.spine             # Spine editor source file
├── images/                 # source PNG(s) used by Spine editor
└── EXPORT/
    ├── skeleton.atlas      # packed atlas (7 lines, rotate:false for stripWS)
    ├── skeleton.json       # exported skeleton
    └── skeleton.png        # 64×64 packed page
```

**Existing atlas-text (fixtures/spine_stripWS/EXPORT/skeleton.atlas):**
```
skeleton.png
size:64,64
filter:Linear,Linear
square
bounds:0,0,64,64
offsets:218,218,500,500
```

**Adapt for spine_rotated (per RESEARCH §"Pattern 1: Real-packer fixture"):**
```
fixtures/spine_rotated/
├── rotated.spine           # Spine editor source — a tall-narrow strip (e.g., 100×500)
├── images/                 # source PNG (the unpacked strip)
└── EXPORT/
    ├── skeleton.atlas      # contains at least one rotate:true region
    ├── skeleton.json
    └── skeleton.png        # packer output (rotated strip)
```

**Expected atlas-text shape (planner-derives exact dims):**
```
skeleton.png
size:[packed-W],[packed-H]
filter:Linear,Linear
strip
rotate: true
bounds:0,0,500,100   ← packedW=canonicalH, packedH=canonicalW
[optional offsets line if SW was on]
```

**Notes to mirror vs adapt:**
- **Mirror:** `.spine` source + EXPORT folder layout; total fixture size ≤ 100K target.
- **Adapt:** the source rig contains a tall-narrow rectangle (recommended 100×500 per CONTEXT §Specifics + RESEARCH §Open Questions Q1 — packer's rotation heuristic only kicks in at ≥ 5:1 aspect ratio).
- **Adapt:** before commit, run `grep -rn 'fixtures/spine_rotated' tests/ src/` + `git check-ignore fixtures/spine_rotated/` per `feedback_gitignore_fixtures_check_test_refs` memory. RESEARCH §"Pitfall 5: Fixture grep hygiene" verified no wildcard shadows `spine_rotated/`.

---

## Shared Patterns

### Cross-cutting: Lockstep multi-file delete (Phase 22.1 inverse-add)

**Source:** Phase 22.1's class-add commit (referenced at errors.ts:164-187, ipc.ts:134, shared/types.ts:894).

**Apply to:** errors.ts + loader.ts + ipc.ts + shared/types.ts + image-worker.ts + 2 test files + 1 sub-test — must drop together in ONE atomic commit. Mid-commit state where shared/types.ts removes the union arm but errors.ts still exports the class is a TypeScript compile error (since IPC forwarder narrowing would expect the kind in KNOWN_KINDS).

**Lockstep set (per CONTEXT §Runtime State Inventory + RESEARCH §Lockstep cleanup):**
```
src/core/errors.ts:164-187   (delete class + docblock)
src/core/loader.ts:44        (delete import)
src/core/loader.ts:507-522   (delete throw block)
src/main/ipc.ts:134          (delete KNOWN_KINDS entry)
src/shared/types.ts:894      (delete KnownErrorKind union arm)
src/shared/types.ts:523      (delete ExportError 'rotated-region-unsupported' arm)
src/shared/types.ts:107,395,498  (rephrase atlasSource docblock prose)
src/main/image-worker.ts:35  (delete docblock bullet)
src/main/image-worker.ts:422-438  (delete typed-error block)
tests/core/loader-rotation-rejection.spec.ts  (delete file)
tests/core/rotated-region-error.spec.ts       (delete file)
tests/main/image-worker.atlas-extract.spec.ts:115-168  (delete sub-test)
tests/core/loader.spec.ts:231-247  (rephrase, do not delete)
```

---

### Cross-cutting: Sharp pipeline with `extract → (rotate) → extend` for SW + rotation

**Source:** `src/main/image-worker.ts:274-302` (passthrough SW) and `:519-541` (resize SW two-pipeline materialize-toBuffer).

**Apply to:** Both image-worker.ts:274-298 (passthrough) and :519-541 (resize) modifications. The pipeline order is **load-bearing** because libvips reorders operations within a single sharp pipeline (RESEARCH §"Pitfall 4"). The two-pipeline workaround on the resize SW path stays; rotation slots BETWEEN extract and extend (RESEARCH §"Sharp Rotation Direction (Empirical)" verified by probe `probe-sharp-rotate-extend.mjs`).

**Verified rotation direction:** `sharp.rotate(+90)` (not `-90`) un-rotates Spine's CCW-packed region. Direction was empirically verified per `feedback_narrow_before_fixing` memory; bake the verification result into the implementation comment.

---

### Cross-cutting: `rotated` flag wiring through atlasSources → ExportRow

**Source:** Existing `loader.ts:699-744` (atlasSources Map construction; `rotated: region.degrees !== 0`) and `export.ts:325` (`outW = ceil((canonicalW ?? sourceW) × effScale)`).

**Apply to:** Verified during planning — NO code change to `loader.ts:699-744` (atlasSources already carries `rotated`), NO code change to `export.ts:325` (outW formula is already canonical-relative). The flag flows verbatim from atlas → loader → analyzer → buildExportPlan → IPC envelope → ExportRow.atlasSource.rotated → image-worker. The math is downstream-correct once D-01 makes peakScale canonical-correct.

---

### Cross-cutting: Layer 3 invariant (core/ no DOM/sharp/Electron)

**Source:** `tests/arch.spec.ts:148-178` (the Layer 3 grep guard for src/core).

**Apply to:** D-01 walk in `src/core/loader.ts` is pure TS object mutation (`attachment.offset[i] = ...`) — no DOM, no sharp, no Electron. RESEARCH §"Architectural Responsibility Map" confirms: load-time, single-pass, no per-tick branching, math-only. Existing Layer 3 carve-out for loader.ts (already imports `node:fs`/`node:path`) covers the file; no new imports outside spine-core needed.

---

## No Analog Found

None. Every new file has a directly applicable analog in the existing codebase. The closest "no exact analog" case is `tests/core/no-stale-rotation-error.spec.ts`, which combines two existing patterns (arch.spec.ts globSync regex + loader-version-guard.spec.ts readdirSync recursive) — both mirrors are documented above.

## Metadata

**Analog search scope:**
- `src/core/` (loader, bounds, errors, export, sampler, synthetic-atlas, analyzer)
- `src/main/` (ipc, image-worker)
- `src/shared/` (types.ts)
- `src/renderer/` (App.tsx — confirmed no rotation arm to remove, per RESEARCH source-read verification)
- `tests/core/` (loader*, bounds, export, arch precedent loader-version-guard)
- `tests/main/` (image-worker.*.spec.ts)
- `tests/arch.spec.ts`
- `fixtures/spine_stripWS/` (fixture-shape precedent)

**Files scanned:** ~30 source files + 15 test files + 1 fixture directory.

**Pattern extraction date:** 2026-05-10
