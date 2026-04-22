/**
 * Phase 0 Plan 04 — Tests for `src/core/sampler.ts`.
 *
 * Behavior gates pulled from the plan's `<behavior>` block:
 *   1. `sampleSkeleton(loadResult)` on SIMPLE_TEST returns a Map with >=3 entries
 *      (one per unique (skin, slot, attachment) tuple ever touched).
 *   2. Each PeakRecord's `animationName` is a real animation name OR the literal
 *      string "Setup Pose (Default)".
 *   3. Determinism — two sequential calls with no interleaved state produce
 *      bit-identical peak values (requirement N1.6, threat T-00-04-02).
 *   4. `sampleSkeleton(loadResult, { samplingHz: 60 })` uses dt = 1/60
 *      (smoke: runs to completion with the configurable rate; tick count should
 *      differ from the default-120 run).
 *   5. `DEFAULT_SAMPLING_HZ === 120` (CLAUDE.md rule #6 — locked default).
 *   6. Hot loop uses `Physics.reset` once per animation and `Physics.update`
 *      every tick — enforced by source-grep hygiene tests below (the same
 *      pattern plan 00-03 established for bounds.ts).
 *   7. N2.3: no `node:fs` / `node:path` / `node:child_process` / `node:net` /
 *      `node:http` / `sharp` / `skeleton.fps` in the compiled source — by
 *      construction, the hot loop performs zero I/O.
 *
 * The spec file mirrors bounds.spec.ts's structure so both core modules have
 * the same shape of coverage: behavioral + module-hygiene grep tests.
 */
import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import {
  sampleSkeleton,
  DEFAULT_SAMPLING_HZ,
  type PeakRecord,
} from '../../src/core/sampler.js';

const FIXTURE = path.resolve('fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json');
const SAMPLER_SRC = path.resolve('src/core/sampler.ts');
const SETUP_POSE_LABEL = 'Setup Pose (Default)';

describe('sampler — sampleSkeleton', () => {
  it('returns a Map with >= 3 peak entries on SIMPLE_TEST', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    expect(peaks.size).toBeGreaterThanOrEqual(3);
  });

  it('labels every peak with either an animation name or "Setup Pose (Default)"', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const animationNames = new Set(
      load.skeletonData.animations.map((a) => a.name),
    );
    for (const rec of peaks.values()) {
      const ok =
        rec.animationName === SETUP_POSE_LABEL ||
        animationNames.has(rec.animationName);
      expect(ok, `unexpected animationName: ${rec.animationName}`).toBe(true);
    }
  });

  it('produces bit-identical peak values on two sequential runs (N1.6 determinism)', () => {
    const load = loadSkeleton(FIXTURE);
    const a = sampleSkeleton(load);
    const b = sampleSkeleton(load);
    expect(a.size).toBe(b.size);
    // Compare every key/value — peak scale must match bit-for-bit.
    for (const [key, recA] of a) {
      const recB = b.get(key);
      expect(recB, `missing key on second run: ${key}`).toBeDefined();
      const rb = recB as PeakRecord;
      expect(rb.scale).toBe(recA.scale);
      expect(rb.scaleX).toBe(recA.scaleX);
      expect(rb.scaleY).toBe(recA.scaleY);
      expect(rb.worldW).toBe(recA.worldW);
      expect(rb.worldH).toBe(recA.worldH);
      expect(rb.time).toBe(recA.time);
      expect(rb.animationName).toBe(recA.animationName);
    }
  });

  it('respects opts.samplingHz override (60 Hz smoke)', () => {
    // Default-120 vs explicit-60 should both complete and return the same
    // attachmentKeys; scale values may differ by sub-frame peak sampling, but
    // the key set is stable (same (skin, slot, attachment) tuples).
    const load = loadSkeleton(FIXTURE);
    const peaksDefault = sampleSkeleton(load);
    const peaks60 = sampleSkeleton(load, { samplingHz: 60 });
    expect(peaks60.size).toBe(peaksDefault.size);
    const keysA = [...peaksDefault.keys()].sort();
    const keysB = [...peaks60.keys()].sort();
    expect(keysB).toEqual(keysA);
  });

  it('exposes DEFAULT_SAMPLING_HZ = 120 (CLAUDE.md rule #6)', () => {
    expect(DEFAULT_SAMPLING_HZ).toBe(120);
  });

  it('peak record shape carries all F2.6 fields', () => {
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const first = [...peaks.values()][0] as PeakRecord;
    expect(first).toMatchObject({
      attachmentKey: expect.any(String),
      skinName: expect.any(String),
      slotName: expect.any(String),
      attachmentName: expect.any(String),
      animationName: expect.any(String),
      time: expect.any(Number),
      frame: expect.any(Number),
      scaleX: expect.any(Number),
      scaleY: expect.any(Number),
      scale: expect.any(Number),
      worldW: expect.any(Number),
      worldH: expect.any(Number),
      sourceW: expect.any(Number),
      sourceH: expect.any(Number),
    });
  });

  it('completes the SIMPLE_TEST sampler run in <500 ms (N2.1 perf gate smoke)', () => {
    const load = loadSkeleton(FIXTURE);
    const t0 = performance.now();
    sampleSkeleton(load);
    const elapsed = performance.now() - t0;
    // Loose 500 ms gate — the real N2.1 assertion lives in plan 00-07, this
    // is just a smoke that the sampler is not pathologically slow.
    expect(elapsed).toBeLessThan(500);
  });
});

describe('sampler — module hygiene (N2.3 by construction)', () => {
  const src = fs.readFileSync(SAMPLER_SRC, 'utf8');

  it('does not import node:fs / node:path / node:child_process / node:net / node:http', () => {
    expect(src).not.toMatch(/from ['"]node:fs['"]/);
    expect(src).not.toMatch(/from ['"]node:path['"]/);
    expect(src).not.toMatch(/from ['"]node:child_process['"]/);
    expect(src).not.toMatch(/from ['"]node:net['"]/);
    expect(src).not.toMatch(/from ['"]node:http['"]/);
  });

  it('does not reference "sharp" (PNG-decode library belongs in Phase 8)', () => {
    expect(src).not.toMatch(/\bsharp\b/);
  });

  it('never reads skeleton.fps (CLAUDE.md rule #1 — editor metadata only)', () => {
    expect(src).not.toMatch(/skeleton\.fps/);
  });

  it('exports sampleSkeleton, DEFAULT_SAMPLING_HZ, PeakRecord, SamplerOptions', () => {
    expect(src).toMatch(/export\s+function\s+sampleSkeleton/);
    expect(src).toMatch(/DEFAULT_SAMPLING_HZ\s*=\s*120/);
    expect(src).toMatch(/PeakRecord/);
    expect(src).toMatch(/SamplerOptions/);
  });

  it('calls the locked lifecycle in order: state.update → state.apply → skeleton.update → updateWorldTransform(Physics.update)', () => {
    // Source-order check: the four calls must appear in this exact sequence
    // (left-to-right, nothing else between them in the tick body).
    const stateUpdate = src.indexOf('state.update(dt)');
    const stateApply = src.indexOf('state.apply(skeleton)');
    const skelUpdate = src.indexOf('skeleton.update(dt)');
    const skelWorld = src.indexOf(
      'skeleton.updateWorldTransform(Physics.update)',
    );
    expect(stateUpdate).toBeGreaterThan(-1);
    expect(stateApply).toBeGreaterThan(stateUpdate);
    expect(skelUpdate).toBeGreaterThan(stateApply);
    expect(skelWorld).toBeGreaterThan(skelUpdate);
  });

  it('calls Physics.reset (once per animation) before the tick loop', () => {
    expect(src).toMatch(/Physics\.reset/);
    // `Physics.reset` must appear BEFORE the tick loop declaration — i.e.
    // lexically to the left of the `for (let t = 0; t <= ` token.
    const reset = src.indexOf('Physics.reset');
    const forLoop = src.search(/for \(let t = 0; t <= /);
    expect(reset).toBeGreaterThan(-1);
    expect(forLoop).toBeGreaterThan(-1);
    expect(reset).toBeLessThan(forLoop);
  });
});
