// SEED-010: diff the editor's authoritative downscale against the original to
// learn EXACTLY which fields Spine scales (and by what factor) when you export
// at Scale = 0.5 — especially the 4.3 transform-constraint remap offsets.
//
// Usage: npx tsx .planning/debug/_diff_demon_scale.mjs [original.json] [scaled.json] [expectedFactor]
//   defaults: SKINS_SPINE_V02.json  SKINS_SPINE_V02_half.json  0.5
import * as fs from 'node:fs';

const ORIG = process.argv[2] || 'fixtures/DEMON/SKINS_SPINE_V02.json';
const SCALED = process.argv[3] || 'fixtures/DEMON/SKINS_SPINE_V02_half.json';
const F = Number(process.argv[4] || 0.5);

if (!fs.existsSync(SCALED)) {
  console.error(`Scaled export not found: ${SCALED}\nExport DEMON at Scale=${F} from Spine and save it there (or pass a path).`);
  process.exit(1);
}
const a = JSON.parse(fs.readFileSync(ORIG, 'utf8'));
const b = JSON.parse(fs.readFileSync(SCALED, 'utf8'));

const near = (x, y) => Math.abs(x - y) <= 1e-4 * Math.max(1, Math.abs(x), Math.abs(y));
function classify(o, n) {
  if (o === 0 && n === 0) return 'zero';
  if (o === 0) return `0→${n}`;
  const r = n / o;
  if (near(r, 1)) return 'unchanged';
  if (near(r, F)) return `×${F} (scaled)`;
  if (near(r, F * F)) return `×${F}² `;
  return `×${r.toFixed(4)} (OTHER!)`;
}

// Walk two parallel objects; yield {path, oldVal, newVal} for numeric leaves.
function* walk(x, y, path = '') {
  if (typeof x === 'number' && typeof y === 'number') { yield { path, o: x, n: y }; return; }
  if (Array.isArray(x) && Array.isArray(y)) {
    for (let i = 0; i < Math.min(x.length, y.length); i++) yield* walk(x[i], y[i], `${path}[${i}]`);
    return;
  }
  if (x && y && typeof x === 'object' && typeof y === 'object') {
    for (const k of Object.keys(x)) if (k in y) yield* walk(x[k], y[k], path ? `${path}.${k}` : k);
  }
}

function byName(arr) { const m = new Map(); for (const e of arr || []) if (e && e.name != null) m.set(e.name, e); return m; }

console.log(`ORIG  : ${ORIG}`);
console.log(`SCALED: ${SCALED}   (expected factor ${F})\n`);

// --- skeleton header ---
console.log('=== skeleton header ===');
for (const { path, o, n } of walk(a.skeleton, b.skeleton, 'skeleton')) {
  if (!near(o, n)) console.log(`  ${path.padEnd(22)} ${o} → ${n}   [${classify(o, n)}]`);
}

// --- bones (matched by name) ---
console.log('\n=== bones (changed numeric fields, by category) ===');
{
  const oB = byName(a.bones), nB = byName(b.bones);
  const cat = {};
  for (const [name, ob] of oB) {
    const nb = nB.get(name); if (!nb) continue;
    for (const f of ['x', 'y', 'length', 'scaleX', 'scaleY', 'rotation', 'shearX', 'shearY']) {
      const o = ob[f] ?? (f === 'scaleX' || f === 'scaleY' ? 1 : 0);
      const n = nb[f] ?? (f === 'scaleX' || f === 'scaleY' ? 1 : 0);
      if (near(o, n)) continue;
      const c = classify(o, n);
      (cat[`${f}: ${c}`] ??= []).push(name);
    }
  }
  for (const [k, names] of Object.entries(cat).sort()) console.log(`  ${k.padEnd(26)} ${names.length} bones  e.g. ${names.slice(0, 4).join(', ')}`);
}

// --- constraints (matched by name) — THE key question ---
console.log('\n=== constraints: every changed numeric field, classified ===');
{
  const oC = byName(a.constraints), nC = byName(b.constraints);
  const cat = {};
  for (const [name, oc] of oC) {
    const nc = nC.get(name); if (!nc) continue;
    for (const { path, o, n } of walk(oc, nc)) {
      if (near(o, n)) continue;
      (cat[`${path}: ${classify(o, n)}`] ??= []).push(name);
    }
  }
  if (!Object.keys(cat).length) console.log('  (no constraint numeric field changed — editor left ALL constraint params untouched)');
  for (const [k, names] of Object.entries(cat).sort()) console.log(`  ${k.padEnd(40)} (${names.length})  e.g. ${names.slice(0, 3).join(', ')}`);
}

// --- spotlight the R_ARM driver ---
console.log('\n=== spotlight: R_IK_HEEL-to-R_IK_WRIST (the R_ARM driver) ===');
{
  const oc = (a.constraints || []).find((c) => c.name === 'R_IK_HEEL-to-R_IK_WRIST');
  const nc = (b.constraints || []).find((c) => c.name === 'R_IK_HEEL-to-R_IK_WRIST');
  console.log('  ORIG  :', JSON.stringify(oc?.properties));
  console.log('  SCALED:', JSON.stringify(nc?.properties));
}
console.log('\nINTERPRETATION: if constraint world-Y offset/max show "×0.5 (scaled)" and');
console.log('rotate/scale/percent show "unchanged", that IS the bake rule to replicate.');
console.log('If constraint fields are "unchanged" or "OTHER!", the editor handles scale');
console.log('differently (likely re-derives) — faithful in-app bake is the hard path.');
