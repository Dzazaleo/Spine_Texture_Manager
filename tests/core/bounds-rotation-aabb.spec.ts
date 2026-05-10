// Phase 33 Plan 04 — ATLAS-02: 16-case bone-rotation × attachment-rotation matrix.
//
// Wave 1 RED scaffold (Plan 02) → Wave 3 active body (this file).
//
// Synthetic — no fixture dependency. The bone matrix (a, b, c, d, x=0, y=0)
// is set directly on the root bone after Skeleton construction. Each
// iteration builds:
//   (a) a rotated RegionAttachment (canonical 100×500, packed 500×100,
//       region.degrees=90) with the D-01 cooking applied inline, AND
//   (b) an unrotated reference (canonical 100×500, region.degrees=0)
// then asserts attachmentWorldAABB(slot, attachment) width/height equality
// within absolute tolerance < 1e-6.
//
// Reference dims from 33-01-SUMMARY.md, region `rect`:
//   canonicalW=500, canonicalH=100, packedW=100, packedH=500.
//
// Test-local copy of the D-01 formula lives in `cookD01Offsets` so a future
// loader refactor (extract helper, change call site, etc.) does not silently
// break the test's coverage of the offset arithmetic itself.

import { describe, expect, it } from 'vitest';
import {
  RegionAttachment,
  TextureRegion,
  Skeleton,
  SkeletonData,
  SlotData,
  BoneData,
  Skin,
  Slot,
} from '@esotericsoftware/spine-core';
import { attachmentWorldAABB } from '../../src/core/bounds.js';

// Helper: build a TextureRegion-shaped object with packed/canonical dims.
function buildRegion(opts: {
  w: number;
  h: number;
  origW: number;
  origH: number;
  degrees: 0 | 90;
}): TextureRegion {
  const r = new TextureRegion();
  r.width = opts.w;
  r.height = opts.h;
  r.originalWidth = opts.origW;
  r.originalHeight = opts.origH;
  r.offsetX = 0;
  r.offsetY = 0;
  r.degrees = opts.degrees;
  return r;
}

// Helper: build a RegionAttachment with the given dims/rotation/region.
function buildRegionAttachment(opts: {
  width: number;
  height: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  region: TextureRegion;
}): RegionAttachment {
  const att = new RegionAttachment('test', 'test');
  att.width = opts.width;
  att.height = opts.height;
  att.x = opts.x;
  att.y = opts.y;
  att.scaleX = opts.scaleX;
  att.scaleY = opts.scaleY;
  att.rotation = opts.rotation;
  att.region = opts.region;
  att.updateRegion(); // populate offset[] + uvs[] with spine-core defaults
  return att;
}

// D-01 direct-offset-write cooking (test-local copy of the loader formula
// at src/core/loader.ts §"Phase 33 — D-01"). Mutates attachment.offset[] in place.
// Only applies when region.degrees !== 0 (matches loader walk filter).
function cookD01Offsets(attachment: RegionAttachment): void {
  const region = attachment.region;
  if (!region || region.degrees === 0) return;
  const w = attachment.width;
  const h = attachment.height;
  const x = attachment.x;
  const y = attachment.y;
  const scaleX = attachment.scaleX;
  const scaleY = attachment.scaleY;
  const rotation = attachment.rotation;
  const radians = (rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rsX = (w / region.originalWidth) * scaleX;
  const rsY = (h / region.originalHeight) * scaleY;
  const localX = (-w / 2) * scaleX + region.offsetX * rsX;
  const localY = (-h / 2) * scaleY + region.offsetY * rsY;
  // SWAP: localX2 uses region.height (post-rot canonical W);
  //       localY2 uses region.width  (post-rot canonical H).
  const localX2 = localX + region.height * rsX;
  const localY2 = localY + region.width * rsY;
  const lXc = localX * cos + x;
  const lXs = localX * sin;
  const lYc = localY * cos + y;
  const lYs = localY * sin;
  const lX2c = localX2 * cos + x;
  const lX2s = localX2 * sin;
  const lY2c = localY2 * cos + y;
  const lY2s = localY2 * sin;
  const off = attachment.offset;
  off[0] = lXc - lYs;
  off[1] = lYc + lXs;
  off[2] = lXc - lY2s;
  off[3] = lY2c + lXs;
  off[4] = lX2c - lY2s;
  off[5] = lY2c + lX2s;
  off[6] = lX2c - lYs;
  off[7] = lYc + lX2s;
}

// Helper: build a minimal Slot whose bone has the given world-matrix
// (a, b, c, d, x=0, y=0). Constructs a SkeletonData with one BoneData +
// SlotData, instantiates Skeleton (auto-constructs the corresponding Bone +
// Slot), then overwrites the world matrix directly.
function buildSlotWithBoneMatrix(opts: {
  a: number;
  b: number;
  c: number;
  d: number;
}): Slot {
  const skelData = new SkeletonData();
  const boneData = new BoneData(0, 'root', null);
  skelData.bones.push(boneData);
  const slotData = new SlotData(0, 'slot', boneData);
  skelData.slots.push(slotData);
  // Skeleton constructor requires a default skin to exist for updateCache.
  skelData.defaultSkin = new Skin('default');
  const skeleton = new Skeleton(skelData);
  const bone = skeleton.bones[0];
  bone.a = opts.a;
  bone.b = opts.b;
  bone.c = opts.c;
  bone.d = opts.d;
  bone.worldX = 0;
  bone.worldY = 0;
  return skeleton.slots[0];
}

const c45 = Math.cos(Math.PI / 4);
const s45 = Math.sin(Math.PI / 4);
const c30 = Math.cos(Math.PI / 6);
const s30 = Math.sin(Math.PI / 6);

const matrixCases: {
  name: string;
  a: number;
  b: number;
  c: number;
  d: number;
}[] = [
  { name: 'identity', a: 1, b: 0, c: 0, d: 1 },
  { name: 'rot 45deg', a: c45, b: s45, c: -s45, d: c45 },
  { name: 'rot 90deg', a: 0, b: 1, c: -1, d: 0 },
  { name: 'rot 180deg', a: -1, b: 0, c: 0, d: -1 },
  { name: 'rot -45deg', a: c45, b: -s45, c: s45, d: c45 },
  { name: 'scale 2x0.5', a: 2, b: 0, c: 0, d: 0.5 },
  { name: 'scale 0.5x2', a: 0.5, b: 0, c: 0, d: 2 },
  {
    name: 'rot 30deg + scale 2x0.5',
    a: 2 * c30,
    b: 2 * s30,
    c: -0.5 * s30,
    d: 0.5 * c30,
  },
];

const attRotations = [0, 30];

describe('attachmentWorldAABB — rotated RegionAttachment matrix (ATLAS-02)', () => {
  for (const tc of matrixCases) {
    for (const attRot of attRotations) {
      it(`bone=${tc.name}, attRot=${attRot}deg: rotated AABB width/height matches unrotated reference`, () => {
        const rotatedAtt = buildRegionAttachment({
          width: 100,
          height: 500,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: attRot,
          region: buildRegion({
            w: 500,
            h: 100,
            origW: 100,
            origH: 500,
            degrees: 90,
          }),
        });
        cookD01Offsets(rotatedAtt);

        const unrotatedRef = buildRegionAttachment({
          width: 100,
          height: 500,
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
          rotation: attRot,
          region: buildRegion({
            w: 100,
            h: 500,
            origW: 100,
            origH: 500,
            degrees: 0,
          }),
        });

        const slotRot = buildSlotWithBoneMatrix(tc);
        const slotUnrot = buildSlotWithBoneMatrix(tc);

        const aabbRot = attachmentWorldAABB(slotRot, rotatedAtt);
        const aabbUnrot = attachmentWorldAABB(slotUnrot, unrotatedRef);

        expect(aabbRot, 'rotated AABB must not be null').not.toBeNull();
        expect(aabbUnrot, 'unrotated AABB must not be null').not.toBeNull();

        const wRot = aabbRot!.maxX - aabbRot!.minX;
        const hRot = aabbRot!.maxY - aabbRot!.minY;
        const wUnrot = aabbUnrot!.maxX - aabbUnrot!.minX;
        const hUnrot = aabbUnrot!.maxY - aabbUnrot!.minY;

        expect(
          Math.abs(wRot - wUnrot),
          `width mismatch at bone=${tc.name}, attRot=${attRot}`,
        ).toBeLessThan(1e-6);
        expect(
          Math.abs(hRot - hUnrot),
          `height mismatch at bone=${tc.name}, attRot=${attRot}`,
        ).toBeLessThan(1e-6);
      });
    }
  }
});
