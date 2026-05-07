#!/usr/bin/env node
/**
 * scripts/strip-chicken.mjs — Phase 29 Plan 04 Task 1
 *
 * One-shot generator for `fixtures/Chicken-Min/`: a stripped subset of the
 * full Chicken (`fixtures/Chicken/SYMBOLS.json`, 369KB / 533 atlas regions /
 * 301 attachments — gitignored) that preserves the path-indirection signature
 * across analyzer + atlas-preview + buildExportPlan integration.
 *
 * What survives the strip (REGION-07 + 4-surface invariant):
 *   - 3 attachmentNames resolving to one regionName via path-indirection:
 *       slot=7         attachmentName=5/5/5/7/7    type=mesh path="5/7"
 *       slot=8         attachmentName=5/5/7/7      type=mesh path="5/7"
 *       slot=VOLUME_7  attachmentName=5/7          type=mesh (no path → uses attName)
 *       slot=VOLUME_8  attachmentName=5/7          type=mesh (no path → uses attName)
 *   - Bone chain: root → SYMBOLS → CTRL_5 → 7 → {7_FRONT, VOLUME}
 *   - Animation 5/PRIZE that animates all four target slots and 4 bones
 *   - One additional atlas region 5/BLOOD_DROP for backward-compat coverage
 *     (single-attachment, exercises the non-path-indirected dedup path)
 *
 * What does NOT survive: the other ~530 atlas regions, 226 unrelated bones,
 * 175 unrelated slots, ~95% of the JSON, and the original 152MB of PNGs.
 *
 * Output (all under fixtures/Chicken-Min/):
 *   - Chicken-Min.json   — Spine 4.2 skeleton subset (target <50KB)
 *   - Chicken-Min.atlas  — minimal atlas with 5/7 + 5/BLOOD_DROP regions
 *   - Chicken-Min.png    — 16×16 stub PNG (Option A from 29-04-PLAN §interfaces)
 *
 * Run: `node scripts/strip-chicken.mjs`
 *
 * The script is one-shot and idempotent — it overwrites the output dir if it
 * already exists. Source SYMBOLS.json must be readable at fixtures/Chicken/
 * (worktree mode: tries the parent main tree at the absolute project path
 * if the worktree-relative path is not present, since fixtures/Chicken/ is
 * gitignored and inherits from main).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// 1. Locate the source SYMBOLS.json (worktree-relative OR parent-main-tree).
// ---------------------------------------------------------------------------

const candidates = [
  path.resolve('fixtures/Chicken/SYMBOLS.json'),
  '/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/Chicken/SYMBOLS.json',
];

let sourcePath = null;
for (const c of candidates) {
  if (fs.existsSync(c)) {
    sourcePath = c;
    break;
  }
}

if (sourcePath === null) {
  console.error('FATAL: fixtures/Chicken/SYMBOLS.json not found in worktree or parent tree.');
  console.error('Looked at:');
  for (const c of candidates) console.error('  -', c);
  process.exit(1);
}

console.log(`[strip-chicken] Source: ${sourcePath}`);

// ---------------------------------------------------------------------------
// 2. Build the stripped JSON.
// ---------------------------------------------------------------------------

const src = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));

const targetSlotNames = ['7', '8', 'VOLUME_7', 'VOLUME_8'];
const extraSlotName = 'BLOOD_DROP'; // single-attachment backward-compat probe
const targetBoneNames = new Set(['root', 'SYMBOLS', 'CTRL_5', '7', '7_FRONT', 'VOLUME']);
// BLOOD_DROP slot needs its own bone too (look it up from the source).
const bloodDropSlot = src.slots.find((s) => s.name === extraSlotName);
if (bloodDropSlot && bloodDropSlot.bone) {
  // Walk the chain to root.
  let cur = bloodDropSlot.bone;
  while (cur) {
    targetBoneNames.add(cur);
    const b = src.bones.find((x) => x.name === cur);
    if (!b || !b.parent) break;
    cur = b.parent;
  }
}

// 2a. Bones — preserve original ordering (Spine requires parents before children).
const bones = src.bones.filter((b) => targetBoneNames.has(b.name));

// 2b. Slots — full slot defs from src for the targets.
const targetSlots = [...targetSlotNames];
if (bloodDropSlot) targetSlots.push(extraSlotName);
const slots = src.slots.filter((s) => targetSlots.includes(s.name));

// 2c. Skin "default" — keep only the four target slots' attachments + BLOOD_DROP.
const srcDefault = src.skins.find((s) => s.name === 'default');
const newAttachments = {};
for (const sl of targetSlotNames) {
  if (srcDefault.attachments[sl]) newAttachments[sl] = srcDefault.attachments[sl];
}
if (srcDefault.attachments[extraSlotName]) {
  newAttachments[extraSlotName] = srcDefault.attachments[extraSlotName];
}
const skins = [{ name: 'default', attachments: newAttachments }];

// 2d. Animations — keep only 5/PRIZE; trim its bone tracks to bones we kept.
const srcAnim = src.animations['5/PRIZE'];
if (!srcAnim) {
  console.error('FATAL: source animation 5/PRIZE not found — strip target invalid.');
  process.exit(1);
}
const trimmedBones = {};
for (const [boneName, tracks] of Object.entries(srcAnim.bones || {})) {
  if (targetBoneNames.has(boneName)) trimmedBones[boneName] = tracks;
}
const trimmedSlots = {};
for (const [slotName, tracks] of Object.entries(srcAnim.slots || {})) {
  if (targetSlots.includes(slotName)) trimmedSlots[slotName] = tracks;
}
const animations = {
  '5/PRIZE': {
    ...(Object.keys(trimmedBones).length > 0 && { bones: trimmedBones }),
    slots: trimmedSlots,
  },
};

// 2e. Skeleton metadata — strip absolute paths, preserve spine version.
const skeleton = {
  hash: 'CHKN_MIN',
  spine: src.skeleton.spine,
  images: './images/',
  audio: '',
};

const stripped = {
  skeleton,
  bones,
  slots,
  skins,
  animations,
};

// ---------------------------------------------------------------------------
// 3. Build the minimal .atlas (16×16 stub page; just 2 regions).
// ---------------------------------------------------------------------------

const atlasContent = [
  'Chicken-Min.png',
  'size:16,16',
  'filter:Linear,Linear',
  '5/7',
  'bounds:0,0,4,4',
  '5/BLOOD_DROP',
  'bounds:5,0,3,3',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// 4. Build a 16×16 solid-color stub PNG (deflate raw IDAT manually — no deps).
// ---------------------------------------------------------------------------

function buildStubPng(w, h) {
  // 8-bit RGBA scanlines, filter byte 0 (None) at start of each row.
  const rowLen = 1 + w * 4;
  const raw = Buffer.alloc(rowLen * h);
  for (let y = 0; y < h; y++) {
    const off = y * rowLen;
    raw[off] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const px = off + 1 + x * 4;
      raw[px + 0] = 0xff; // R
      raw[px + 1] = 0xff; // G
      raw[px + 2] = 0xff; // B
      raw[px + 3] = 0xff; // A (opaque)
    }
  }

  const idat = zlib.deflateSync(raw);

  // CRC table for IEND/IHDR/IDAT chunks (PNG spec).
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const png = buildStubPng(16, 16);

// ---------------------------------------------------------------------------
// 5. Write outputs.
// ---------------------------------------------------------------------------

const outDir = path.resolve('fixtures/Chicken-Min');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, 'Chicken-Min.json'), JSON.stringify(stripped, null, 2));
fs.writeFileSync(path.join(outDir, 'Chicken-Min.atlas'), atlasContent);
fs.writeFileSync(path.join(outDir, 'Chicken-Min.png'), png);

// ---------------------------------------------------------------------------
// 6. Verify size + report.
// ---------------------------------------------------------------------------

const stats = {};
let total = 0;
for (const f of fs.readdirSync(outDir)) {
  const s = fs.statSync(path.join(outDir, f)).size;
  stats[f] = s;
  total += s;
}
console.log('[strip-chicken] Output:');
for (const [f, s] of Object.entries(stats)) {
  console.log(`  ${f.padEnd(24)} ${s.toLocaleString().padStart(8)} bytes`);
}
console.log(`  ${'TOTAL'.padEnd(24)} ${total.toLocaleString().padStart(8)} bytes`);

if (total >= 1024 * 1024) {
  console.error(`FATAL: total ${total} bytes >= 1MB — REGION-07 size sentinel would fail.`);
  process.exit(1);
}

console.log(`[strip-chicken] OK — ${total.toLocaleString()} bytes < 1MB.`);
