// SEED-010 diagnostic 2: does co-scaling the 4.3 transform-constraint SPATIAL
// offsets (world-Y) — while leaving rotate(angle)/scale(ratio)/percent(max:100)
// alone — restore the constrained R_ARM peak to faithful (~s)?
//
//   base       : V02 (CTRL_DEMON 0.1)
//   H_ctrl(s)  : CTRL_DEMON *= s                          (pivot only)
//   H_hybrid(s): CTRL_DEMON *= s  AND  scale world-Y offset/max of the
//                R_IK_HEEL-to-R_IK_WRIST constraint by s  (leave angles/ratios)
//
// Run: npx tsx .planning/debug/_repro_multiscale_hybrid.mjs
import '../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../src/core/loader.ts';
import { sampleSkeleton } from '../../src/core/sampler.ts';
import * as fs from 'node:fs';
import * as path from 'node:path';

const SRC = 'fixtures/DEMON/SKINS_SPINE_V02.json';
const ATLAS = 'fixtures/DEMON/SKINS_SPINE_V02.atlas';
const HZ = 60;
const TMP = [];

function peaksOf(file, atlasPath) {
  const out = sampleSkeleton(loadSkeleton(file, atlasPath ? { atlasPath } : {}), { samplingHz: HZ });
  const m = new Map();
  for (const [k, r] of out.globalPeaks) m.set(k, r.peakScale);
  return m;
}
function variant(label, mutate) {
  const json = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  mutate(json);
  const tmp = path.join('.planning/debug', `_tmp_h_${label}.json`);
  fs.writeFileSync(tmp, JSON.stringify(json)); TMP.push(tmp);
  return peaksOf(tmp, ATLAS);
}
function setScale(json, name, fn) {
  const b = json.bones.find((b) => b.name === name);
  const sx = b.scaleX ?? 1, sy = b.scaleY ?? 1;
  const [nx, ny] = fn(sx, sy); b.scaleX = nx; b.scaleY = ny;
}
// Scale ONLY world-spatial (x/y) offset+max in transform-constraint property maps.
// Heuristic: a mapped target property of x/y is a world length -> scale offset/max.
// rotate/scaleX/scaleY/shearY targets are angles/ratios -> leave. Likewise the
// per-source input `offset` is scaled only for x/y source rows.
let touchedFields = 0;
function scaleSpatialOffsets(json, s) {
  for (const c of json.constraints || []) {
    if (c.type !== 'transform' || !c.properties) continue;
    for (const [srcProp, row] of Object.entries(c.properties)) {
      const spatialSrc = srcProp === 'x' || srcProp === 'y';
      if (spatialSrc && typeof row.offset === 'number') { row.offset *= s; touchedFields++; }
      if (!row.to) continue;
      for (const [tgtProp, m] of Object.entries(row.to)) {
        const spatialTgt = tgtProp === 'x' || tgtProp === 'y';
        if (!spatialTgt || !m) continue;
        if (typeof m.offset === 'number') { m.offset *= s; touchedFields++; }
        if (typeof m.max === 'number')    { m.max    *= s; touchedFields++; }
        // m.scale is a ratio -> leave
      }
    }
  }
}

const ARM = (k) => /\/R_ARM\//.test(k);
function armRows(base, v, s) {
  const out = [];
  for (const [k, bv] of base) {
    if (!ARM(k)) continue;
    const vv = v.get(k); if (vv == null) continue;
    out.push({ k, base: bv, v: vv, ratio: vv / bv, offPct: (((vv / bv) - s) / s) * 100 });
  }
  return out;
}
function faithCount(base, v, s) {
  let f = 0, n = 0;
  for (const [k, bv] of base) { if (bv <= 1e-9) continue; const vv = v.get(k); if (vv == null) continue; n++; if (Math.abs(vv / bv - s) / s < 0.02) f++; }
  return `${f}/${n}`;
}

const base = peaksOf(SRC);
for (const s of [0.5, 0.25]) {
  touchedFields = 0;
  const ctrl = variant(`ctrl_${s}`, (j) => setScale(j, 'CTRL_DEMON', (sx, sy) => [sx * s, sy * s]));
  const hyb = variant(`hyb_${s}`, (j) => { setScale(j, 'CTRL_DEMON', (sx, sy) => [sx * s, sy * s]); scaleSpatialOffsets(j, s); });
  console.log(`\n================  s = ${s}  (target ratio ${s}; spatial fields scaled: ${touchedFields})  ================`);
  console.log(`faithful(<2%):   pivot-only ${faithCount(base, ctrl, s)}    hybrid ${faithCount(base, hyb, s)}`);
  console.log(`R_ARM attachments (ratio should be ${s}):`);
  const a = armRows(base, ctrl, s), b = armRows(base, hyb, s);
  for (let i = 0; i < a.length; i++) {
    console.log(`  ${a[i].k.padEnd(40)}`);
    console.log(`     pivot-only: var=${a[i].v.toFixed(4)} ratio=${a[i].ratio.toFixed(3)} (${a[i].offPct >= 0 ? '+' : ''}${a[i].offPct.toFixed(0)}%)`);
    console.log(`     +offset fix: var=${b[i].v.toFixed(4)} ratio=${b[i].ratio.toFixed(3)} (${b[i].offPct >= 0 ? '+' : ''}${b[i].offPct.toFixed(0)}%)`);
  }
}
for (const t of TMP) { try { fs.unlinkSync(t); } catch {} }
console.log('\n(done)');
