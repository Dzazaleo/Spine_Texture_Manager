// Spike 003 — end-to-end fidelity of the baked variant.
// Sample master (scale 1) vs baked variant (s) through the REAL app pipeline
// (loadSkeleton + sampleSkeleton). Prove:
//   (A) world-AABB(variant) == s × world-AABB(master) for EVERY attachment incl R_ARM
//       → the baked rig is a true similarity (identical-but-smaller) — the user's bar.
//   (B) peakScale(variant) == peakScale(master) (ratio ~1) → the measurement BLIND SPOT:
//       bone-world-scale is invariant under a coord bake, so the variant's textures must be
//       sized as s × master_peak (arithmetic), NEVER by sampling the variant.
//
// Run: npx tsx .planning/spikes/003-end-to-end-fidelity/fidelity.mjs
import '../../../scripts/register-esm-adapter-resolver.ts';
import { loadSkeleton } from '../../../src/core/loader.ts';
import { sampleSkeleton } from '../../../src/core/sampler.ts';
import { bake } from '../002-json-bake-roundtrip/baker.mjs';
import * as fs from 'node:fs';

const SRC = 'fixtures/DEMON/SKINS_SPINE_V02.json';
const ATLAS = 'fixtures/DEMON/SKINS_SPINE_V02.atlas';
const S = 0.5, HZ = 60;

function peaks(load) { const m = new Map(); for (const [k, r] of sampleSkeleton(load, { samplingHz: HZ }).globalPeaks) m.set(k, r); return m; }

const master = peaks(loadSkeleton(SRC));
const tmp = '.planning/spikes/003-end-to-end-fidelity/_variant.json';
fs.writeFileSync(tmp, JSON.stringify(bake(JSON.parse(fs.readFileSync(SRC, 'utf8')), S)));
const variant = peaks(loadSkeleton(tmp, { atlasPath: ATLAS }));
fs.unlinkSync(tmp);

const near = (x, y, t = 0.02) => Math.abs(x - y) <= t * Math.max(1e-6, Math.abs(x), Math.abs(y));
let worldFaithful = 0, peakBlind = 0, n = 0;
const worldOff = [], arm = [];
for (const [k, mr] of master) {
  const vr = variant.get(k); if (!vr || mr.worldW <= 1e-6) continue; n++;
  const wRatio = vr.worldW / mr.worldW;                 // expect ~S
  const pRatio = mr.peakScale > 1e-9 ? vr.peakScale / mr.peakScale : 1; // expect ~1 (blind spot)
  if (near(wRatio, S)) worldFaithful++; else worldOff.push({ k, wRatio });
  if (near(pRatio, 1, 0.03)) peakBlind++;
  if (/\/R_ARM\//.test(k)) arm.push({ k, wRatio, pRatio, mPeak: mr.peakScale, vPeak: vr.peakScale });
}

console.log(`=== Spike 003: baked variant (s=${S}) vs master — DEMON 4.3 ===`);
console.log(`attachments compared: ${n}`);
console.log(`\n(A) world-AABB ratio == s (faithful geometry):  ${worldFaithful}/${n} within 2% of ${S}`);
worldOff.sort((a, b) => Math.abs(b.wRatio - S) - Math.abs(a.wRatio - S));
if (worldOff.length) { console.log(`    worst world-AABB deviations:`); for (const o of worldOff.slice(0, 6)) console.log(`      ${o.k.padEnd(44)} ${o.wRatio.toFixed(4)}`); }
console.log(`\n(B) peakScale ratio == 1 (measurement blind spot): ${peakBlind}/${n} within 3% of 1.0`);
console.log(`\nR_ARM spotlight (the bone-scale victim — exploded +300..600% earlier):`);
for (const a of arm) console.log(`    ${a.k.padEnd(40)} worldAABB×${a.wRatio.toFixed(3)}  peakScale: ${a.mPeak.toFixed(4)}→${a.vPeak.toFixed(4)} (×${a.pRatio.toFixed(3)})`);

const aOk = worldFaithful === n, bOk = peakBlind >= n * 0.95;
console.log(`\n=== VERDICT ===`);
console.log(aOk ? `✅ (A) EVERY attachment world-AABB is exactly ${S}× — the baked rig is a true similarity (identical-but-smaller). R_ARM included.` : `⚠ (A) ${worldOff.length} attachments off — investigate.`);
console.log(bOk ? `✅ (B) peakScale stays ~1× under the bake — CONFIRMED blind spot. Build MUST size textures as s×master_peak, never by sampling the variant.` : `~ (B) peakScale moved — re-examine the blind-spot assumption.`);
