// Phase 40 UAT bug 2 — Empirical probe for the WRITE direction of atlas
// rotation. Complement to scripts/probe-sharp-rotate.mjs (which verified the
// READ direction in Phase 33).
//
// Question: given a canonical source image, which sharp.rotate(±90) produces
// the bytes that the spine runtime + scripts/probe-sharp-rotate.mjs's verdict
// will subsequently INVERSE-rotate back to canonical?
//
// Spine atlas convention (TextureAtlas.js:164-169 + libgdx docs):
//   When `rotate: true` appears in the .atlas:
//     - the on-page bytes are stored rotated 90 degrees from canonical.
//     - the runtime applies CCW90 on read to recover canonical pixels.
//   Therefore the WRITE direction MUST be the inverse of what the runtime
//   applies on READ. Phase 33 confirmed READ = sharp.rotate(+90) (CCW per
//   sharp docs / Phase 33 verification). The WRITE direction is therefore
//   the OPPOSITE — sharp.rotate(-90) (CW).
//
// This script proves the claim empirically: paint a canonical image with
// distinguishable corner colors, rotate both directions, then apply the
// READ-direction rotate(+90) to each output. Whichever direction's
// "round-trip" recovers the original corners is the correct WRITE direction.
//
// Output: prints a verdict line ending in "ROTATE_FOR_ATLAS = rotate(+90)"
// or "ROTATE_FOR_ATLAS = rotate(-90)" so it is greppable from CI.

import sharpDefault from 'sharp';
const sharp_ = sharpDefault;

const W = 8;
const H = 4;
const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const WHITE = [255, 255, 255, 255];

function makeCanvas(w, h, fill = [128, 128, 128, 255]) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = fill[0];
    buf[i + 1] = fill[1];
    buf[i + 2] = fill[2];
    buf[i + 3] = fill[3];
  }
  return buf;
}
function setPixel(buf, w, x, y, color) {
  const i = (y * w + x) * 4;
  buf[i] = color[0];
  buf[i + 1] = color[1];
  buf[i + 2] = color[2];
  buf[i + 3] = color[3];
}
function getPixel(buf, w, x, y) {
  const i = (y * w + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}
function colorName(rgba) {
  const [r, g, b] = rgba;
  if (r === 255 && g === 0 && b === 0) return 'RED';
  if (r === 0 && g === 255 && b === 0) return 'GREEN';
  if (r === 0 && g === 0 && b === 255) return 'BLUE';
  if (r === 255 && g === 255 && b === 255) return 'WHITE';
  return `rgba(${r},${g},${b},${rgba[3]})`;
}
function corners(buf, w, h) {
  return {
    TL: colorName(getPixel(buf, w, 0, 0)),
    TR: colorName(getPixel(buf, w, w - 1, 0)),
    BL: colorName(getPixel(buf, w, 0, h - 1)),
    BR: colorName(getPixel(buf, w, w - 1, h - 1)),
  };
}

// 1. Canonical 8w x 4h with distinct corners.
const canonical = makeCanvas(W, H);
setPixel(canonical, W, 0, 0, RED);
setPixel(canonical, W, W - 1, 0, GREEN);
setPixel(canonical, W, 0, H - 1, BLUE);
setPixel(canonical, W, W - 1, H - 1, WHITE);

const canonicalCorners = corners(canonical, W, H);
console.log('Canonical (8w x 4h):', canonicalCorners);

async function rotate(buf, w, h, angle) {
  const out = await sharp_(buf, { raw: { width: w, height: h, channels: 4 } })
    .rotate(angle)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return out;
}

// 2. Try BOTH write directions, then apply the READ rotation (rotate(+90))
//    and check which one round-trips back to canonical.
const writePlus = await rotate(canonical, W, H, 90); // candidate A: rotate(+90)
const writeMinus = await rotate(canonical, W, H, -90); // candidate B: rotate(-90)
console.log(
  `WRITE rotate(+90) dims: ${writePlus.info.width}w x ${writePlus.info.height}h, corners:`,
  corners(writePlus.data, writePlus.info.width, writePlus.info.height),
);
console.log(
  `WRITE rotate(-90) dims: ${writeMinus.info.width}w x ${writeMinus.info.height}h, corners:`,
  corners(writeMinus.data, writeMinus.info.width, writeMinus.info.height),
);

// 3. Apply READ rotation (rotate(+90), per Phase 33 verdict) to each.
const readBackPlus = await rotate(
  writePlus.data,
  writePlus.info.width,
  writePlus.info.height,
  90,
);
const readBackMinus = await rotate(
  writeMinus.data,
  writeMinus.info.width,
  writeMinus.info.height,
  90,
);
const readBackPlusCorners = corners(
  readBackPlus.data,
  readBackPlus.info.width,
  readBackPlus.info.height,
);
const readBackMinusCorners = corners(
  readBackMinus.data,
  readBackMinus.info.width,
  readBackMinus.info.height,
);
console.log('READ rotate(+90) of WRITE rotate(+90):', readBackPlusCorners);
console.log('READ rotate(+90) of WRITE rotate(-90):', readBackMinusCorners);

const plusMatches = JSON.stringify(readBackPlusCorners) === JSON.stringify(canonicalCorners);
const minusMatches = JSON.stringify(readBackMinusCorners) === JSON.stringify(canonicalCorners);

console.log('\n=== VERDICT ===');
console.log(`WRITE rotate(+90) -> READ rotate(+90) restores canonical: ${plusMatches}`);
console.log(`WRITE rotate(-90) -> READ rotate(+90) restores canonical: ${minusMatches}`);
if (plusMatches && !minusMatches) {
  console.log('ROTATE_FOR_ATLAS = rotate(+90)');
  process.exit(0);
}
if (minusMatches && !plusMatches) {
  console.log('ROTATE_FOR_ATLAS = rotate(-90)');
  process.exit(0);
}
console.log('AMBIGUOUS - both or neither matched. Investigate before shipping.');
process.exit(2);
