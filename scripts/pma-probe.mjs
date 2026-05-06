// Decisive PMA test: render the same RED CIRCLE as both PMA and straight,
// resize through sharp's default, composite over white, and check whether
// the visible result differs.
//
// If sharp auto-premultiplies (Photoshop-like, no bug):
//   PMA input  → resize → unpremultiplied output → looks identical to ground truth
//   Straight   → resize → looks identical too
//
// If sharp does naive RGB resize (the bullet's claim):
//   PMA input  → edges darken because (128,0,0,128) averages with (0,0,0,0)
//                 → boundary pixel becomes (64,0,0,64) → composited on white → pink
//   Straight   → also weird but in different ways

import sharp from 'sharp';

const SIZE = 64;

// Build a soft-edged red disk in BOTH encodings.
function buildDisk(encoding /* 'pma' | 'straight' */) {
  const buf = Buffer.alloc(SIZE * SIZE * 4);
  const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 2;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      let a = 0;
      if (d <= r - 4) a = 255;
      else if (d <= r) a = Math.round(((r - d) / 4) * 255);
      else a = 0;
      const o = (y * SIZE + x) * 4;
      if (encoding === 'pma') {
        // PMA: RGB pre-multiplied by alpha
        buf[o + 0] = Math.round(255 * (a / 255));
        buf[o + 1] = 0;
        buf[o + 2] = 0;
        buf[o + 3] = a;
      } else {
        // Straight: RGB always 255 red, alpha varies
        buf[o + 0] = a > 0 ? 255 : 0;
        buf[o + 1] = 0;
        buf[o + 2] = 0;
        buf[o + 3] = a;
      }
    }
  }
  return buf;
}

async function processCheck(encoding) {
  const raw = buildDisk(encoding);
  const png = await sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 4 } })
    .png({ compressionLevel: 0 }).toBuffer();

  // EXACT image-worker.ts:447-451 chain — resize to half size.
  const resized = await sharp(png)
    .resize(SIZE / 2, SIZE / 2, { kernel: 'lanczos3', fit: 'fill' })
    .raw().toBuffer();

  // Composite over white background and report the visible RGB.
  const composited = [];
  for (let i = 0; i < (SIZE / 2) * (SIZE / 2); i++) {
    const o = i * 4;
    let r = resized[o + 0], g = resized[o + 1], b = resized[o + 2], a = resized[o + 3];
    if (encoding === 'pma') {
      // PMA composite over white: out = src.rgb + (1 - src.a) * white
      r = r + Math.round((1 - a / 255) * 255);
      g = g + Math.round((1 - a / 255) * 255);
      b = b + Math.round((1 - a / 255) * 255);
    } else {
      // Straight composite over white: out = src.rgb * src.a + (1 - src.a) * white
      r = Math.round(r * (a / 255) + (1 - a / 255) * 255);
      g = Math.round(g * (a / 255) + (1 - a / 255) * 255);
      b = Math.round(b * (a / 255) + (1 - a / 255) * 255);
    }
    composited.push([r, g, b]);
  }
  // Sample 3 pixels: center, mid-radius, near-edge.
  const W = SIZE / 2;
  const center = composited[(W / 2) * W + W / 2];
  const midR   = composited[(W / 2) * W + W / 2 + 6];
  const edge   = composited[(W / 2) * W + W - 2];
  return { center, midR, edge };
}

const pma = await processCheck('pma');
const str = await processCheck('straight');

console.log('After resize → composite over white → visible RGB:');
console.log(`  encoding=PMA       center=${pma.center}  mid=${pma.midR}  edge=${pma.edge}`);
console.log(`  encoding=Straight  center=${str.center}  mid=${str.midR}  edge=${str.edge}`);
console.log('\nIf both rows are nearly identical → sharp preserves PMA correctly. NO BUG.');
console.log('If PMA "edge" pixel is much greener/bluer than Straight → fringing exists. BUG.');
