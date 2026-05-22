// Spike 002/003 coverage extension — heavy 4.2 rigs (real IK/path/physics/transform).
// Runs the field-identity oracle AND the world-AABB fidelity check on the richest
// 4.2 fixtures, to confirm the bake is as faithful on 4.2 as on 4.3 DEMON.
//
// Run: npx tsx .planning/spikes/002-json-bake-roundtrip/coverage-42.mjs
import '../../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../../src/core/loader.ts';
import { sampleSkeleton } from '../../../src/core/sampler.ts';
import * as Spine42 from 'spine-core-42';
import { bake } from './baker.mjs';
import * as fs from 'node:fs';

const S = 0.5, HZ = 60;
const TARGETS = [
  'fixtures/MON_FILES/EXPORT/TEST_01/4.2/TEST_01.json',   // tf15 ik8 path14 phys51 — all 4 types
  'fixtures/3Queens/TQORW_SYMBOLS.json',                   // tf31 ik12 — transform/ik heavy
  'fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json',          // tf15 ik8 path14 — path+ik+tf
];
const near = (x, y, t = 0.02) => Math.abs(x - y) <= t * Math.max(1e-6, Math.abs(x), Math.abs(y));
const clone = (o) => JSON.parse(JSON.stringify(o));
const SKIP = new Set(['parent', 'children', 'bones', 'bone', 'target', 'source', 'slot', 'skin',
  'attachment', 'page', 'region', 'texture', 'rendererObject', 'renderObject', 'timelineAttachment',
  'data', '_parent', '_bones', '_bone', '_target', '_source', '_slot', '_skin', '_data',
  '_meshAttachment', 'sequence', 'name', 'path', 'id', 'hash', 'assetId']);

function tryLoad(src) {
  try { return loadSkeleton(src); } catch { try { return loadSkeleton(src, { loaderMode: 'atlas-less' }); } catch (e) { return null; } }
}

for (const src of TARGETS) {
  console.log(`\n=== ${src} ===`);
  const load = tryLoad(src);
  if (!load) { console.log('  (could not load — skipping)'); continue; }
  const orig = JSON.parse(fs.readFileSync(src, 'utf8'));

  // (1) ORACLE: parse(bake,1) ≡ parse(orig,s)
  const parseAt = (json, scale) => { const sj = new Spine42.SkeletonJson(new Spine42.AtlasAttachmentLoader(load.atlas)); sj.scale = scale; return sj.readSkeletonData(clone(json)); };
  const A = parseAt(bake(orig, S), 1), B = parseAt(orig, S);
  const seen = new WeakSet(); const mism = new Map();
  (function cmp(a, b, p) {
    if (typeof a === 'number' && typeof b === 'number') { if (!near(a, b, 0.001)) mism.set(p, (mism.get(p) ?? 0) + 1); return; }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
    if (seen.has(a)) return; seen.add(a);
    if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${p}[]`); return; }
    for (const k of Object.keys(a)) { if (SKIP.has(k) || typeof a[k] === 'function') continue; if (k in b) cmp(a[k], b[k], p ? `${p}.${k}` : k); }
  })(A, B, '');
  const rows = [...mism.entries()].sort((a, b) => b[1] - a[1]);
  console.log(rows.length ? `  (1) ORACLE ⚠ ${rows.length} mismatched path(s): ${rows.slice(0, 5).map(([p, n]) => `${p}×${n}`).join(', ')}` : '  (1) ORACLE ✅ FIELD-IDENTICAL');

  // (2) FIDELITY: world-AABB(variant) == s × master
  try {
    const master = new Map(); for (const [k, r] of sampleSkeleton(load, { samplingHz: HZ }).globalPeaks) master.set(k, r);
    const tmp = src.replace(/\.json$/, '') + '__tmpvar.json';
    fs.writeFileSync(tmp, JSON.stringify(bake(orig, S)));
    const vload = loadSkeleton(tmp, { atlasPath: load.atlasPath ?? undefined });
    fs.unlinkSync(tmp);
    let f = 0, n = 0, peak1 = 0; const off = [];
    const vmap = new Map(); for (const [k, r] of sampleSkeleton(vload, { samplingHz: HZ }).globalPeaks) vmap.set(k, r);
    for (const [k, mr] of master) { const vr = vmap.get(k); if (!vr || mr.worldW <= 1e-6) continue; n++; if (near(vr.worldW / mr.worldW, S)) f++; else off.push(`${k}=${(vr.worldW / mr.worldW).toFixed(3)}`); if (mr.peakScale > 1e-9 && near(vr.peakScale / mr.peakScale, 1, 0.03)) peak1++; }
    console.log(`  (2) FIDELITY world-AABB==${S}: ${f}/${n}  | peakScale==1 (blind spot): ${peak1}/${n}` + (off.length ? `  off: ${off.slice(0, 4).join(', ')}` : ''));
  } catch (e) { console.log(`  (2) FIDELITY skipped (${String(e.message || e).slice(0, 60)})`); }
}
