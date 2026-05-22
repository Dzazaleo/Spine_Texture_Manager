// Spike 002 — JSON→JSON similarity bake, validated by the round-trip oracle.
// bake(json, s) mutates a clone of the raw Spine JSON, mirroring spine-core's
// SkeletonJson.scale field rules. Oracle: parse(bake(orig,s),1) MUST equal
// parse(orig, scale=s) field-by-field (excluding parse-time ids).
// Covers BOTH schemas: 4.3 unified constraints[] and 4.2 split transform/ik/path/physics[].
//
// Run: npx tsx .planning/spikes/002-json-bake-roundtrip/bake.mjs
import '../../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../../src/core/loader.ts';
import * as Spine43 from '@esotericsoftware/spine-core';
import * as Spine42 from 'spine-core-42';
import * as fs from 'node:fs';

const spatial = (p) => p === 'x' || p === 'y';
const clone = (o) => JSON.parse(JSON.stringify(o));
function scaleCurve(curve, s) { if (Array.isArray(curve)) for (let i = 0; i < curve.length; i++) if (i % 4 === 1 || i % 4 === 3) curve[i] *= s; }

function constraintsOf(j) {
  const out = [];
  for (const c of j.constraints || []) out.push([c.type, c]);          // 4.3 unified
  for (const c of j.transform || []) out.push(['transform', c]);       // 4.2 split
  for (const c of j.ik || []) out.push(['ik', c]);
  for (const c of j.path || []) out.push(['path', c]);
  for (const c of j.physics || []) out.push(['physics', c]);
  for (const c of j.slider || []) out.push(['slider', c]);
  return out;
}

function scaleVertices(att, verticesLength, s) {
  const v = att.vertices; if (!Array.isArray(v)) return;
  if (verticesLength === v.length) { for (let i = 0; i < v.length; i++) v[i] *= s; return; } // unweighted
  for (let i = 0; i < v.length;) { const bc = v[i++]; for (let nn = i + bc * 4; i < nn; i += 4) { v[i + 1] *= s; v[i + 2] *= s; } } // weighted: positions only
}

function bake(json, s) {
  const j = clone(json);
  if (!j.skeleton) j.skeleton = {};
  j.skeleton.referenceScale = (typeof j.skeleton.referenceScale === 'number' ? j.skeleton.referenceScale : 100) * s; // (73) scaled default

  for (const b of j.bones || []) for (const f of ['length', 'x', 'y']) if (typeof b[f] === 'number') b[f] *= s; // (87-90)

  for (const [type, c] of constraintsOf(j)) {
    if (type === 'transform') {
      for (const f of ['x', 'y']) if (typeof c[f] === 'number') c[f] *= s;                 // offsets (233-234)
      for (const [srcProp, from] of Object.entries(c.properties || {})) {                  // 4.3 remap
        const fromScale = spatial(srcProp) ? s : 1;
        if (typeof from.offset === 'number' && spatial(srcProp)) from.offset *= s;
        for (const [tgtProp, to] of Object.entries(from.to || {})) {
          const toScale = spatial(tgtProp) ? s : 1;
          if (typeof to.offset === 'number') to.offset *= toScale;                          // (224)
          if (typeof to.max === 'number') to.max *= toScale;                                // (225)
          if (typeof to.scale === 'number') to.scale *= toScale / fromScale;                // (226)
        }
      }
    } else if (type === 'ik') {
      if (typeof c.softness === 'number') c.softness *= s;                                  // (153)
    } else if (type === 'path') {
      if (typeof c.limit === 'number') c.limit *= s;
      if (c.positionMode !== 'percent' && typeof c.position === 'number') c.position *= s;
      if ((c.spacingMode === 'length' || c.spacingMode === 'proportional') && typeof c.spacing === 'number') c.spacing *= s;
    } else if (type === 'physics') {
      for (const f of ['x', 'y']) if (typeof c[f] === 'number') c[f] *= s;
      c.limit = (typeof c.limit === 'number' ? c.limit : 5000) * s;                         // (299) scaled default
    }
  }

  for (const skin of j.skins || []) {
    for (const slotName of Object.keys(skin.attachments || {})) {
      for (const a of Object.values(skin.attachments[slotName])) {
        const type = a.type || 'region';
        if (type === 'region') { for (const f of ['x', 'y', 'width', 'height']) if (typeof a[f] === 'number') a[f] *= s; }
        else if (type === 'mesh') { for (const f of ['width', 'height']) if (typeof a[f] === 'number') a[f] *= s; if (Array.isArray(a.uvs)) scaleVertices(a, a.uvs.length, s); }
        else if (type === 'path') { if (Array.isArray(a.lengths)) for (let i = 0; i < a.lengths.length; i++) a.lengths[i] *= s; scaleVertices(a, (a.vertexCount || 0) * 2, s); }
        else if (type === 'boundingbox' || type === 'clipping') { scaleVertices(a, (a.vertexCount || 0) * 2, s); }
        else if (type === 'point') { for (const f of ['x', 'y']) if (typeof a[f] === 'number') a[f] *= s; }
      }
    }
  }

  for (const anim of Object.values(j.animations || {})) {
    for (const tls of Object.values(anim.bones || {})) {
      for (const [tlName, keys] of Object.entries(tls)) {
        if (!Array.isArray(keys) || !(tlName === 'translate' || tlName === 'translatex' || tlName === 'translatey')) continue;
        for (const k of keys) { for (const f of ['x', 'y', 'value']) if (typeof k[f] === 'number') k[f] *= s; scaleCurve(k.curve, s); }
      }
    }
    for (const skinMap of Object.values(anim.deform || {}))
      for (const slotMap of Object.values(skinMap))
        for (const keys of Object.values(slotMap)) { if (!Array.isArray(keys)) continue; for (const k of keys) { if (Array.isArray(k.vertices)) for (let i = 0; i < k.vertices.length; i++) k.vertices[i] *= s; scaleCurve(k.curve, s); } }
    for (const keys of Object.values(anim.ik || {})) { if (!Array.isArray(keys)) continue; for (const k of keys) if (typeof k.softness === 'number') k.softness *= s; }
  }
  return j;
}

// ---- ORACLE ----
const near = (x, y) => Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y));
const SKIP = new Set(['parent', 'children', 'bones', 'bone', 'target', 'source', 'slot', 'skin',
  'attachment', 'page', 'region', 'texture', 'rendererObject', 'renderObject', 'timelineAttachment',
  'data', '_parent', '_bones', '_bone', '_target', '_source', '_slot', '_skin', '_data',
  '_meshAttachment', 'sequence', 'name', 'path', 'id', 'hash', 'assetId']);

function runOracle(src, Spine, s, label) {
  const atlas = loadSkeleton(src).atlas;
  const orig = JSON.parse(fs.readFileSync(src, 'utf8'));
  const parseAt = (json, scale) => { const sj = new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas)); sj.scale = scale; return sj.readSkeletonData(clone(json)); };
  const baked = parseAt(bake(orig, s), 1);
  const ref = parseAt(orig, s);
  const seen = new WeakSet(); const mism = new Map();
  (function cmp(a, b, path) {
    if (typeof a === 'number' && typeof b === 'number') { if (!near(a, b)) mism.set(path, (mism.get(path) ?? 0) + 1); return; }
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
    if (seen.has(a)) return; seen.add(a);
    if (Array.isArray(a) && Array.isArray(b)) { for (let i = 0; i < Math.min(a.length, b.length); i++) cmp(a[i], b[i], `${path}[]`); return; }
    for (const k of Object.keys(a)) { if (SKIP.has(k) || typeof a[k] === 'function') continue; if (k in b) cmp(a[k], b[k], path ? `${path}.${k}` : k); }
  })(baked, ref, '');
  const rows = [...mism.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`\n=== ${label}: ${src} @ s=${s} ===`);
  if (!rows.length) console.log('  ✅ FIELD-IDENTICAL — bake reproduces Spine scaling exactly.');
  else { console.log(`  ⚠ ${rows.length} mismatched path(s), ${rows.reduce((a, [, n]) => a + n, 0)} field(s):`); for (const [p, n] of rows) console.log(`    ${p.padEnd(52)} ${n}`); }
  return rows.length === 0;
}

let ok = true;
ok = runOracle('fixtures/DEMON/SKINS_SPINE_V02.json', Spine43, 0.5, '4.3 DEMON (all constraints, mesh, physics, slider)') && ok;
ok = runOracle('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json', Spine42, 0.5, '4.2 SIMPLE_PROJECT (transform constraint, chain)') && ok;
ok = runOracle('fixtures/DEMON/SKINS_SPINE_V02.json', Spine43, 0.26, '4.3 DEMON @ odd factor 0.26') && ok;
console.log(ok ? '\n✅ ALL ORACLES PASSED — faithful in-app JSON scale-bake is FEASIBLE.' : '\n⚠ Some oracles failed — see paths above.');
