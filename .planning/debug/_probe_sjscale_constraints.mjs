// SEED-010: what does Spine's OWN scaling (SkeletonJson.scale) do to the 4.3
// transform-constraint remap params? Parse DEMON at scale 1.0 vs 0.5 and diff
// the R_ARM driver constraint's data fields. This is Spine's authoritative bake.
//
// Run: npx tsx .planning/debug/_probe_sjscale_constraints.mjs
import '../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../src/core/loader.ts';
import * as Spine from '@esotericsoftware/spine-core';
import * as fs from 'node:fs';

const SRC = 'fixtures/DEMON/SKINS_SPINE_V02.json';
const loaded = loadSkeleton(SRC); // reuse the loader's parsed atlas
const atlas = loaded.atlas;
const rawJson = fs.readFileSync(SRC, 'utf8');

function parseAt(scale) {
  const loader = new Spine.AtlasAttachmentLoader(atlas);
  const sj = new Spine.SkeletonJson(loader);
  sj.scale = scale;
  return sj.readSkeletonData(JSON.parse(rawJson));
}

const F = 0.5;
const d1 = parseAt(1.0);
const d05 = parseAt(F);

const near = (x, y) => Math.abs(x - y) <= 1e-4 * Math.max(1, Math.abs(x), Math.abs(y));
function cls(o, n) {
  if (o === 0 && n === 0) return 'zero';
  if (o === 0) return `0→${n}`;
  const r = n / o;
  if (near(r, 1)) return 'unchanged';
  if (near(r, F)) return `×${F} SCALED`;
  return `×${r.toFixed(4)} OTHER`;
}
function* walk(x, y, p = '') {
  if (typeof x === 'number' && typeof y === 'number') { yield { p, o: x, n: y }; return; }
  if (Array.isArray(x) && Array.isArray(y)) { for (let i = 0; i < Math.min(x.length, y.length); i++) yield* walk(x[i], y[i], `${p}[${i}]`); return; }
  if (x && y && typeof x === 'object' && typeof y === 'object') {
    const skip = new Set(['name', 'target', 'source', 'bones', 'bone', 'constructor']);
    for (const k of Object.keys(x)) if (!skip.has(k) && k in y && typeof x[k] !== 'function') { try { yield* walk(x[k], y[k], p ? `${p}.${k}` : k); } catch {} }
  }
}

// 1) sanity: did bone geometry scale?
console.log('=== sanity: bone geometry (first few bones) ===');
const b1 = d1.bones, b05 = d05.bones;
for (let i = 0; i < 4; i++) {
  const a = b1[i], b = b05[i];
  console.log(`  ${a.name.padEnd(12)} x ${cls(a.x, b.x)}  y ${cls(a.y, b.y)}  len ${cls(a.length, b.length)}  scaleX ${cls(a.scaleX, b.scaleX)}`);
}

// 2) the constraint container in 4.3 SkeletonData
const lists = ['transformConstraints', 'ikConstraints', 'pathConstraints', 'physicsConstraints', 'constraints'];
console.log('\n=== constraint lists present on SkeletonData ===');
for (const L of lists) if (Array.isArray(d1[L])) console.log(`  ${L}: ${d1[L].length}`);

function findC(d, name) {
  for (const L of lists) if (Array.isArray(d[L])) { const c = d[L].find((c) => c.name === name); if (c) return c; }
  return null;
}

// 3) THE question: R_IK_HEEL-to-R_IK_WRIST data fields, scale 1 vs 0.5
console.log('\n=== R_IK_HEEL-to-R_IK_WRIST constraint data: scaled fields ===');
const c1 = findC(d1, 'R_IK_HEEL-to-R_IK_WRIST');
const c05 = findC(d05, 'R_IK_HEEL-to-R_IK_WRIST');
if (!c1 || !c05) {
  console.log('  (constraint not found by name; dumping first transform constraint names)');
  for (const L of lists) if (Array.isArray(d1[L])) console.log(`  ${L}:`, d1[L].slice(0, 8).map((c) => c.name));
} else {
  let any = false;
  for (const { p, o, n } of walk(c1, c05)) {
    const c = cls(o, n);
    if (c !== 'unchanged' && c !== 'zero') { console.log(`  ${p.padEnd(34)} ${o} → ${n}   [${c}]`); any = true; }
  }
  if (!any) console.log('  (NO numeric field changed — Spine left this constraint untouched under scale)');
  // also explicitly dump the offsets[] array if present (4.3 transform offsets)
  console.log('\n  raw offsets[] @1.0 :', JSON.stringify(c1.offsets));
  console.log('  raw offsets[] @0.5 :', JSON.stringify(c05.offsets));
}

// 4) broad: across ALL constraints, categorize every changed numeric field
console.log('\n=== ALL constraints: changed-field categories ===');
const cat = {};
for (const L of lists) {
  if (!Array.isArray(d1[L])) continue;
  for (const a of d1[L]) {
    const b = findC(d05, a.name); if (!b) continue;
    for (const { p, o, n } of walk(a, b)) {
      const c = cls(o, n);
      if (c === 'unchanged' || c === 'zero') continue;
      (cat[`${L}.${p}: ${c}`] ??= 0); cat[`${L}.${p}: ${c}`]++;
    }
  }
}
const keys = Object.keys(cat).sort();
if (!keys.length) console.log('  (no constraint field changed anywhere under scale 0.5)');
for (const k of keys) console.log(`  ${k.padEnd(48)} ${cat[k]}×`);
