// Phase 33 Plan 05 — Empirical probe for sharp.rotate(+90) vs sharp.rotate(-90)
// direction lock. Re-run of the probe documented in 33-RESEARCH.md §"Sharp Rotation
// Direction (Empirical)" so Plan 05 has fresh-on-disk evidence before shipping
// production code. Memory: feedback_narrow_before_fixing.
//
// Simulation: a libgdx CCW90-packed atlas region looks like a 90° CCW rotation
// of the canonical (unrotated) source. We build a 8w × 4h canonical pattern with
// distinct corner colors:
//   canonical:  TL=RED, TR=GREEN, BL=BLUE, BR=WHITE
// then synthesize the packed form (4w × 8h after CCW90) by reading what the
// atlas packer would store. After CCW90 of canonical:
//   packed:     TL=GREEN, TR=WHITE, BL=RED, BR=BLUE
// (top edge of canonical → right edge of packed; CCW rotation = "right side goes up").
//
// Then apply sharp.rotate(+90) and sharp.rotate(-90) to the packed buffer and
// check which one restores canonical corners.

import sharpDefault from 'sharp';
const sharp_ = sharpDefault;

// Build canonical 8 wide x 4 tall.
const W = 8, H = 4;
const RED   = [255, 0,   0,   255];
const GREEN = [0,   255, 0,   255];
const BLUE  = [0,   0,   255, 255];
const WHITE = [255, 255, 255, 255];

function makeCanvas(w, h, fill = [128, 128, 128, 255]) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = fill[0]; buf[i + 1] = fill[1]; buf[i + 2] = fill[2]; buf[i + 3] = fill[3];
  }
  return buf;
}
function setPixel(buf, w, x, y, color) {
  const i = (y * w + x) * 4;
  buf[i] = color[0]; buf[i + 1] = color[1]; buf[i + 2] = color[2]; buf[i + 3] = color[3];
}
function getPixel(buf, w, x, y) {
  const i = (y * w + x) * 4;
  return [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]];
}
function colorName(rgba) {
  const [r, g, b] = rgba;
  if (r === 255 && g === 0   && b === 0)   return 'RED';
  if (r === 0   && g === 255 && b === 0)   return 'GREEN';
  if (r === 0   && g === 0   && b === 255) return 'BLUE';
  if (r === 255 && g === 255 && b === 255) return 'WHITE';
  return `rgba(${r},${g},${b},${rgba[3]})`;
}
function corners(buf, w, h) {
  return {
    TL: colorName(getPixel(buf, w, 0,     0)),
    TR: colorName(getPixel(buf, w, w - 1, 0)),
    BL: colorName(getPixel(buf, w, 0,     h - 1)),
    BR: colorName(getPixel(buf, w, w - 1, h - 1)),
  };
}

// 1. Canonical 8x4 with marked corners.
const canonical = makeCanvas(W, H);
setPixel(canonical, W, 0,     0,     RED);
setPixel(canonical, W, W - 1, 0,     GREEN);
setPixel(canonical, W, 0,     H - 1, BLUE);
setPixel(canonical, W, W - 1, H - 1, WHITE);

console.log('Canonical (8w × 4h):', corners(canonical, W, H));

// 2. Build PACKED = CCW90(canonical). libgdx's atlas packer rotates the
//    source 90° CCW before writing into the atlas page. After CCW90:
//      new width  = H = 4
//      new height = W = 8
//      packed(x, y) = canonical(y, packedH - 1 - x) ... no wait.
//    CCW90 mapping: (x_new, y_new) = ( y_old, W - 1 - x_old )
//    inverse: (x_old, y_old) = ( H - 1 - y_new, x_new )  -- canonical pixel at packed (x_new, y_new)
// Easier: use sharp itself to rotate the canonical by +90 OR -90 to simulate
// which direction matches the libgdx CCW90 convention. Per libgdx docs:
// "rotate:true means the region has been rotated 90 degrees counter clockwise".
// Sharp's rotate(angle) — we'll just try BOTH directions of synthesizing the
// packed buffer and pick the one that, when un-rotated by +90, yields canonical.

async function rawCorners(buffer, w, h) {
  const out = await sharp_(buffer, { raw: { width: w, height: h, channels: 4 } })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return corners(out.data, out.info.width, out.info.height);
}

const canonicalCorners = await rawCorners(canonical, W, H);
console.log('Canonical (round-trip raw):', canonicalCorners);

// Synthesize packed via CCW90 of canonical using a manual rotation.
const packedW = H, packedH = W;
const packed = makeCanvas(packedW, packedH);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const px = y;                  // (x_new, y_new) = (y_old, W-1-x_old)  is CCW
    const py = W - 1 - x;
    const c = getPixel(canonical, W, x, y);
    setPixel(packed, packedW, px, py, c);
  }
}
console.log(`Synthesized PACKED (${packedW}w × ${packedH}h, CCW90 of canonical):`, corners(packed, packedW, packedH));

// 3. Apply sharp.rotate(+90) — does the result match canonical?
const plus90 = await sharp_(packed, { raw: { width: packedW, height: packedH, channels: 4 } })
  .rotate(90)
  .raw()
  .toBuffer({ resolveWithObject: true });
console.log(`sharp.rotate(+90) on PACKED → ${plus90.info.width}w × ${plus90.info.height}h:`,
  corners(plus90.data, plus90.info.width, plus90.info.height));

// 4. Apply sharp.rotate(-90) — does the result match canonical?
const minus90 = await sharp_(packed, { raw: { width: packedW, height: packedH, channels: 4 } })
  .rotate(-90)
  .raw()
  .toBuffer({ resolveWithObject: true });
console.log(`sharp.rotate(-90) on PACKED → ${minus90.info.width}w × ${minus90.info.height}h:`,
  corners(minus90.data, minus90.info.width, minus90.info.height));

// 5. Verdict.
const plus90Corners = corners(plus90.data, plus90.info.width, plus90.info.height);
const minus90Corners = corners(minus90.data, minus90.info.width, minus90.info.height);
const matchPlus  = JSON.stringify(plus90Corners)  === JSON.stringify(canonicalCorners);
const matchMinus = JSON.stringify(minus90Corners) === JSON.stringify(canonicalCorners);

console.log('\n=== VERDICT ===');
console.log(`sharp.rotate(+90) restores canonical: ${matchPlus}`);
console.log(`sharp.rotate(-90) restores canonical: ${matchMinus}`);
if (matchPlus && !matchMinus) {
  console.log('CONFIRMED: ship sharp.rotate(+90) — cancels libgdx CCW packing.');
  process.exit(0);
}
if (matchMinus && !matchPlus) {
  console.log('CONFIRMED: ship sharp.rotate(-90).');
  process.exit(0);
}
console.log('AMBIGUOUS — investigate before shipping.');
process.exit(2);
