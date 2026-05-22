// Spike 001 — auto-derive Spine's scale field-map.
// Parse DEMON at SkeletonJson.scale = 1 vs s, deep-diff the two parsed
// SkeletonData graphs (cycle-safe), and classify every changed numeric field.
// Kill-switch: is the rule CLEAN (every change ∈ {×s, ×1/s, ×s², ...}) and is each
// generalized field path CONSISTENT — or is there unexplained OTHER chaos?
//
// Run: npx tsx .planning/spikes/001-fieldmap-autoderive/derive.mjs
import '../../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../../src/core/loader.ts';
import * as Spine from '@esotericsoftware/spine-core';
import * as fs from 'node:fs';

const SRC = 'fixtures/DEMON/SKINS_SPINE_V02.json';
const S = 0.5;
const raw = fs.readFileSync(SRC, 'utf8');
const atlas = loadSkeleton(SRC).atlas;

function parseAt(scale) {
  const sj = new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas));
  sj.scale = scale;
  return sj.readSkeletonData(JSON.parse(raw));
}
const d1 = parseAt(1), ds = parseAt(S);

const near = (x, y) => Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y));
function classify(o, n) {
  if (near(o, n)) return '×1';
  if (o === 0) return `0→${n}`;
  const r = n / o;
  if (near(r, S)) return '×s';
  if (near(r, 1 / S)) return '×1/s';
  if (near(r, S * S)) return '×s²';
  if (near(r, 1 / (S * S))) return '×1/s²';
  return `OTHER(${r.toFixed(3)})`;
}

// Reference keys point to other entities — skip to avoid cycles + noise.
// Owned config (properties, to, frames, vertices, color...) is traversed.
const SKIP = new Set([
  'parent', 'children', 'bones', 'bone', 'target', 'source', 'slot', 'skin', 'attachment',
  'page', 'region', 'texture', 'rendererObject', 'renderObject', 'timelineAttachment',
  'data', '_parent', '_bones', '_bone', '_target', '_source', '_slot', '_skin', '_data',
  '_meshAttachment', 'sequence', 'name', 'path', 'id', 'hash', 'assetId',
]);

const seen = new WeakSet();
const agg = new Map(); // generalized path -> Map(classification -> count)
function record(path, o, n) {
  const c = classify(o, n);
  if (c === '×1') return;
  if (!agg.has(path)) agg.set(path, new Map());
  const m = agg.get(path);
  m.set(c, (m.get(c) ?? 0) + 1);
}
function walk(a, b, path) {
  if (typeof a === 'number' && typeof b === 'number') { record(path, a, b); return; }
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return;
  if (seen.has(a)) return; seen.add(a);
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) walk(a[i], b[i], `${path}[]`);
    return;
  }
  for (const k of Object.keys(a)) {
    if (SKIP.has(k) || typeof a[k] === 'function') continue;
    if (k in b) walk(a[k], b[k], path ? `${path}.${k}` : k);
  }
}
walk(d1, ds, '');

// Report
const rows = [...agg.entries()].map(([p, m]) => ({
  p, cls: [...m.entries()].map(([c, n]) => `${c}×${n}`).join(' '),
  other: [...m.keys()].some((c) => c.startsWith('OTHER') || c.startsWith('0→')),
  mixed: m.size > 1,
}));
rows.sort((a, b) => (b.other - a.other) || (b.mixed - a.mixed) || a.p.localeCompare(b.p));

console.log(`=== Spine SkeletonJson.scale field-map: ${SRC} @ s=${S} ===`);
console.log(`changed generalized field-paths: ${rows.length}\n`);
const others = rows.filter((r) => r.other);
const mixed = rows.filter((r) => r.mixed && !r.other);
const clean = rows.filter((r) => !r.other && !r.mixed);
console.log(`UNEXPLAINED (OTHER / 0→x): ${others.length}`);
for (const r of others) console.log(`  ⚠ ${r.p.padEnd(48)} ${r.cls}`);
console.log(`\nCONTEXT-DEPENDENT (same path, multiple ratios — needs semantics, not just path): ${mixed.length}`);
for (const r of mixed) console.log(`  ~ ${r.p.padEnd(48)} ${r.cls}`);
console.log(`\nCLEAN (single explainable ratio per path): ${clean.length}`);
for (const r of clean) console.log(`  ✓ ${r.p.padEnd(48)} ${r.cls}`);

console.log('\n=== KILL-SWITCH READ ===');
console.log(others.length === 0
  ? '✓ No unexplained ratios — every scaled field is ∈ {×s, ×1/s, ×s², ...}. A deterministic rule exists.'
  : `✗ ${others.length} unexplained field-path(s) — investigate before trusting a rule.`);
console.log(mixed.length === 0
  ? '✓ Every generalized path has ONE ratio — a pure path→ratio map suffices.'
  : `~ ${mixed.length} path(s) are context-dependent (e.g. remap slope depends on source/target kind) — expressible, but the bake needs light semantics there.`);
