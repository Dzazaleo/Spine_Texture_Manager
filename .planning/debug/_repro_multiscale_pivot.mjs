// SEED-010 diagnostic: is scaling the rig's natural pivot bone (CTRL_DEMON)
// faithful (every peak scales ~uniformly by s), unlike scaling root?
//
// Controlled experiment — net rig scale held identical, only the pivot of the
// extra factor s varies:
//   base       : V02 as authored (CTRL_DEMON scaleX/Y = 0.1)            net 0.1
//   H_ctrl(s)  : CTRL_DEMON *= s                                        net 0.1*s
//   H_root(s)  : root = s, CTRL_DEMON stays 0.1                         net 0.1*s
// Faithful  => variant.peakScale / base.peakScale  ~= s  for every attachment.
//
// Run: npx tsx .planning/debug/_repro_multiscale_pivot.mjs
import '../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../src/core/loader.ts';
import { sampleSkeleton } from '../../src/core/sampler.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = 'fixtures/DEMON/SKINS_SPINE_V02.json';
const ATLAS = 'fixtures/DEMON/SKINS_SPINE_V02.atlas';
const HZ = 60; // diagnostic speed; ratios are robust to rate
const TMP = [];

function peaksOf(loaded) {
  const out = sampleSkeleton(loaded, { samplingHz: HZ });
  const m = new Map();
  for (const [k, r] of out.globalPeaks) m.set(k, r.peakScale);
  return m;
}

function sampleFile(file, atlasPath) {
  const loaded = atlasPath ? loadSkeleton(file, { atlasPath }) : loadSkeleton(file);
  return peaksOf(loaded);
}

function sampleVariant(label, mutate) {
  const json = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  mutate(json);
  const tmp = path.join('.planning/debug', `_tmp_ms_${label}.json`);
  fs.writeFileSync(tmp, JSON.stringify(json));
  TMP.push(tmp);
  return sampleFile(tmp, ATLAS);
}

function setScale(json, boneName, fn) {
  const b = json.bones.find((b) => b.name === boneName);
  if (!b) throw new Error(`bone ${boneName} not found`);
  const sx = b.scaleX ?? 1, sy = b.scaleY ?? 1;
  const [nx, ny] = fn(sx, sy);
  b.scaleX = nx; b.scaleY = ny;
}

// ratio stats of variant vs base against the expected uniform factor `expect`
function report(label, base, variant, expect) {
  const ratios = [];
  for (const [k, bv] of base) {
    if (bv <= 1e-9) continue;
    const vv = variant.get(k);
    if (vv == null) continue;
    ratios.push({ k, base: bv, variant: vv, ratio: vv / bv });
  }
  const dev = ratios.map((r) => Math.abs(r.ratio - expect) / expect);
  const faithful = dev.filter((d) => d < 0.02).length;
  const within10 = dev.filter((d) => d < 0.1).length;
  console.log(`\n--- ${label}  (expect ratio ~= ${expect}) ---`);
  console.log(`  attachments compared: ${ratios.length}`);
  console.log(`  faithful (<2% off):   ${faithful}/${ratios.length}`);
  console.log(`  within 10%:           ${within10}/${ratios.length}`);
  ratios.sort((a, b) => Math.abs(b.ratio - expect) - Math.abs(a.ratio - expect));
  console.log(`  WORST offenders (ratio should be ${expect}):`);
  for (const r of ratios.slice(0, 8)) {
    const off = (((r.ratio - expect) / expect) * 100).toFixed(0);
    console.log(
      `    ${r.k.padEnd(46)} base=${r.base.toFixed(4)} var=${r.variant.toFixed(4)} ratio=${r.ratio.toFixed(3)} (${off > 0 ? '+' : ''}${off}%)`,
    );
  }
}

console.log('=================================================================');
console.log('PART 0 — harness sanity: V02 (pivot 0.1) vs V02b (root 0.1)');
console.log('  Same NET scale (0.1); any difference = pivot artifact.');
console.log('  Expect R_ARM* peaks to differ (~0.18 vs ~0.72 per memory).');
console.log('=================================================================');
const v02 = sampleFile(SRC);
const v02b = sampleFile('fixtures/DEMON/SKINS_SPINE_V02b.json');
report('V02b / V02 (expect 1.0 if no artifact)', v02, v02b, 1.0);

console.log('\n\n=================================================================');
console.log('PART 1 — feature question: scale pivot (CTRL_DEMON) vs root');
console.log('=================================================================');
const base = v02;
for (const s of [0.5, 0.25]) {
  const ctrl = sampleVariant(`ctrl_${s}`, (j) => setScale(j, 'CTRL_DEMON', (sx, sy) => [sx * s, sy * s]));
  const root = sampleVariant(`root_${s}`, (j) => setScale(j, 'root', () => [s, s]));
  report(`H_ctrl  s=${s}  (CTRL_DEMON *= ${s})`, base, ctrl, s);
  report(`H_root  s=${s}  (root = ${s})`, base, root, s);
}

for (const t of TMP) { try { fs.unlinkSync(t); } catch {} }
console.log('\n(done; temp variant JSONs cleaned up)');
