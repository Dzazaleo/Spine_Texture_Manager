import '../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../src/core/loader.ts';
import * as Spine from 'spine-core-42';
import { bake } from './002-json-bake-roundtrip/baker.mjs';
import * as fs from 'node:fs';
const SRC = 'fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json';
const atlas = loadSkeleton(SRC).atlas, orig = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const P = (j, s) => { const sj = new Spine.SkeletonJson(new Spine.AtlasAttachmentLoader(atlas)); sj.scale = s; return sj.readSkeletonData(JSON.parse(JSON.stringify(j))); };
const A = P(bake(orig, 0.5), 1), B = P(orig, 0.5);
const near = (x, y) => Math.abs(x - y) <= 1e-3 * Math.max(1, Math.abs(x), Math.abs(y));
const seen = new Set();
for (const an of A.animations) {
  const bn = B.animations.find((x) => x.name === an.name); if (!bn) continue;
  for (let t = 0; t < an.timelines.length; t++) {
    const ta = an.timelines[t], tb = bn.timelines[t];
    const ca = ta.curves, cb = tb && tb.curves; if (!ca || !cb) continue;
    for (let i = 0; i < Math.min(ca.length, cb.length); i++) if (!near(ca[i], cb[i])) {
      const key = ta.constructor.name + (ta.attachment ? '/' + ta.attachment.constructor.name : '');
      if (!seen.has(key)) { seen.add(key); console.log(`  ${an.name} :: ${key}  curve[${i}] baked=${ca[i].toFixed(3)} ref=${cb[i].toFixed(3)} (baked/ref=${(ca[i] / cb[i]).toFixed(3)})`); }
      break;
    }
  }
}
console.log('timeline types with curve mismatch:', [...seen]);
