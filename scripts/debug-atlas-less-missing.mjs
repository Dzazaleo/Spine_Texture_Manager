// Debug repro for atlas-less-export-missing-pngs (2026-05-09).
// Loads the CHJ fixture in atlas-less mode using the actual loader and
// prints exactly which attachments end up in skippedAttachments + which
// region names sourceDims covers vs which don't.
//
// Usage:
//   node scripts/debug-atlas-less-missing.mjs <imagesPathOverride>
// Example (post-export folder):
//   node scripts/debug-atlas-less-missing.mjs fixtures/CHJ/test/images
//
// Note: we only need the synthesizer's region-walk + the orphan inUseNames
// builder. We bypass spine-core's full skeleton parse to avoid pulling in
// the world-transform machinery for this diagnostic.

import * as fs from 'node:fs';
import * as path from 'node:path';

const fixture = 'fixtures/CHJ/CHJWC_SYMBOLS.json';
const imagesPathOverride = process.argv[2] || 'fixtures/CHJ/images';

const json = JSON.parse(fs.readFileSync(fixture, 'utf8'));

// Mimic walkSyntheticRegionPaths (att.path ?? entryName).
const regionPaths = new Set();
for (const skin of json.skins ?? []) {
  for (const slotName in skin.attachments) {
    const slot = skin.attachments[slotName];
    for (const entryName in slot) {
      const att = slot[entryName];
      const type = att.type ?? 'region';
      if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
      const lookupPath = att.path ?? entryName;
      if (att.sequence) {
        const count = att.sequence.count ?? 0;
        const start = att.sequence.start ?? 1;
        const digits = att.sequence.digits ?? 0;
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const frame = (start + i).toString();
            let composed = lookupPath;
            for (let p = digits - frame.length; p > 0; p--) composed += '0';
            composed += frame;
            regionPaths.add(composed);
          }
          continue;
        }
      }
      regionPaths.add(lookupPath);
    }
  }
}

console.log('Synthesizer enumerated', regionPaths.size, 'unique region paths');

// PNG existence check
const missing = [];
const present = [];
for (const r of regionPaths) {
  const pngPath = path.join(imagesPathOverride, r + '.png');
  if (fs.existsSync(pngPath)) present.push(r);
  else missing.push(r);
}
console.log(`Present PNGs: ${present.length} | Missing PNGs: ${missing.length}`);
console.log('--- MISSING ---');
console.log(missing.sort().join('\n'));

// Now mimic the orphan-detector's inUseNames build
const inUseNames = new Set();
for (const skin of json.skins ?? []) {
  for (const slotName in skin.attachments) {
    const slot = skin.attachments[slotName];
    for (const attachmentName in slot) {
      const att = slot[attachmentName];
      const type = att.type ?? 'region';
      if (type !== 'region' && type !== 'mesh' && type !== 'linkedmesh') continue;
      // Sequence-aware (mimics summary.ts:441-463)
      if (att.sequence) {
        const count = att.sequence.count ?? 0;
        const start = att.sequence.start ?? 1;
        const digits = att.sequence.digits ?? 0;
        if (count > 0) {
          for (let i = 0; i < count; i++) {
            const frame = (start + i).toString();
            const lookupPath = att.path ?? attachmentName;
            let composed = lookupPath;
            for (let p = digits - frame.length; p > 0; p--) composed += '0';
            composed += frame;
            // current code: inUseNames.add(region.name)
            inUseNames.add(composed);
          }
          continue;
        }
      }
      // current code: inUseNames.add(attachmentName) -- BUG: should be att.path ?? att.name ?? attachmentName
      inUseNames.add(attachmentName);
    }
  }
}

console.log('\n--- inUseNames (orphan detector keys, current logic) ---');
console.log('Total keys:', inUseNames.size);
console.log('Sample non-default keys (containing LABEL):');
for (const n of [...inUseNames].filter(n => n.includes('LABEL'))) console.log('  ', n);

// Simulate orphan detection against the post-export folder
const filesOnDisk = [];
function walk(dir, base) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(path.join(dir, e.name), base + e.name + '/');
    else if (e.name.endsWith('.png')) filesOnDisk.push(base + e.name.slice(0, -4));
  }
}
walk(imagesPathOverride, '');
console.log('\nFiles in', imagesPathOverride, ':', filesOnDisk.length);

const orphans = filesOnDisk.filter(f => !inUseNames.has(f));
console.log('Orphans flagged:', orphans.length);
console.log(orphans.sort().join('\n'));
