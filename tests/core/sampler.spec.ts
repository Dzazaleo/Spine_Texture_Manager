/**
 * Phase 0 Plans 04 + 05 — Tests for `src/core/sampler.ts`.
 *
 * Requirement coverage matrix (every N-tag appears in at least one test name):
 *   - N1.1 setup-pose sizes — sampler returns peak records for every textured
 *     attachment in the default skin, with finite positive scales.
 *   - N1.2 simple leaf-bone — SQUARE has a plausible setup/animation peak with
 *     correct sourceW/H == 1000 matching the fixture atlas bounds.
 *   - N1.3 bone-chain — CIRCLE mesh's peak `animationName` is a real animation
 *     (not "Setup Pose (Default)"), proving chain-scale animations drive the
 *     mesh vertices via weighted-sum.
 *   - N1.4 weighted-mesh DIFFERENTIAL (Strategy B) — doubling bone index 5
 *     (CHAIN_5, dominant weight for CIRCLE's vertex 0) produces a CIRCLE
 *     worldW > 1.5x baseline. Proves the sampler reads bones via weights.
 *   - N1.5 TransformConstraint (locked per CONTEXT.md) — clone skeletonData,
 *     remove the transform constraint whose bones include SQUARE, compare
 *     constrained vs unconstrained peaks. Strict delta > 1e-6 required.
 *   - N1.6 PhysicsConstraint determinism — two sequential runs on the same
 *     LoadResult produce bit-identical peak values (threat T-00-04-02).
 *   - EASING-CURVE STRETCH — `it.skip` per CONTEXT.md; fixture contains only
 *     "stepped" curves, no non-linear easing to test sub-frame peak capture.
 *   - N2.1 perf gate — full sampler run on SIMPLE_TEST completes in < 500 ms.
 *   - N2.3 no FS in hot loop — src/core/sampler.ts and src/core/bounds.ts
 *     have no node:fs / node:path / sharp imports (grep-enforced at test time).
 *
 * Other behavioral smokes (from plan 00-04, preserved here):
 *   - Map size >= 3, animationName labeling, samplingHz override, default 120 Hz,
 *     record shape, lifecycle ordering via source-grep, Physics.reset before loop.
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

describe('sampler — sampleSkeleton (N1.1–N1.6, N2.1, N2.3)', () => {
  it('N1.1: returns peak records for every textured attachment in the default skin', () => {
    // N1.1 REQUIREMENTS.md: every core/ function has golden tests driven by
    // the SIMPLE_PROJECT fixture. Each PeakRecord must have finite, positive
    // scale with scale == max(scaleX, scaleY).
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    expect(peaks.size).toBeGreaterThanOrEqual(3);
    const names = new Set(
      [...peaks.keys()].map((k) => k.split('/')[2]),
    );
    expect(names.has('CIRCLE')).toBe(true);
    expect(names.has('SQUARE')).toBe(true);
    expect(names.has('TRIANGLE')).toBe(true);
    for (const rec of peaks.values()) {
      expect(Number.isFinite(rec.peakScale)).toBe(true);
      expect(rec.peakScale).toBeGreaterThan(0);
      expect(Number.isFinite(rec.peakScaleX)).toBe(true);
      expect(Number.isFinite(rec.peakScaleY)).toBe(true);
      expect(rec.peakScale).toBe(Math.max(rec.peakScaleX, rec.peakScaleY));
    }
  });

  it('N1.2 simple leaf-bone: SQUARE has a plausible peak with fixture atlas source dims', () => {
    // N1.2: plain region on a leaf bone. The SQUARE slot's attachment is the
    // 1000×1000 region from SIMPLE_TEST.atlas, bound to the SQUARE bone which
    // is a child of CTRL (not deep in the CHAIN_* chain). Peak must be finite
    // and strictly positive; sourceW/H must match the atlas bounds.
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const square = [...peaks.values()].find(
      (r) => r.slotName === 'SQUARE' && r.attachmentName === 'SQUARE',
    );
    expect(square).toBeDefined();
    expect(square!.sourceW).toBe(1000);
    expect(square!.sourceH).toBe(1000);
    expect(square!.peakScale).toBeGreaterThan(0);
    expect(Number.isFinite(square!.peakScale)).toBe(true);
  });

  it('N1.3 bone-chain: CIRCLE mesh peak comes from an animation (chain scale drives the mesh)', () => {
    // N1.3: the CIRCLE mesh is weighted to bones in the CHAIN_* chain. The
    // PATH animation scales CHAIN_2 by 2x, SIMPLE_SCALE scales CHAIN_2 by 2x
    // (with a CHAIN_8 sub-keyframe), and TRANSFORM rotates+scales every
    // CHAIN_* bone. Peak for CIRCLE therefore must come from an animation,
    // not the setup pose — proves chain transforms reach the mesh vertices.
    const load = loadSkeleton(FIXTURE);
    const peaks = sampleSkeleton(load);
    const circle = [...peaks.values()].find(
      (r) => r.attachmentName === 'CIRCLE',
    );
    expect(circle).toBeDefined();
    expect(circle!.animationName).not.toBe('Setup Pose (Default)');
    const animationNames = new Set(
      load.skeletonData.animations.map((a) => a.name),
    );
    expect(animationNames.has(circle!.animationName)).toBe(true);
    // Sanity: peak scale > setup (which would be ~1x for identity chain).
    // With the render-scale formula, CHAIN_2 stepping to 2.0 propagates through
    // the chain so CIRCLE's weighted per-vertex max reaches ≈ 2.0. Plausibility
    // gate only — exact goldens live in the numeric-goldens block below.
    expect(circle!.peakScale).toBeGreaterThan(1);
  });

  it('N1.4 weighted-mesh DIFFERENTIAL (Strategy B): doubling dominant bone scale grows CIRCLE worldW > 1.5x baseline', () => {
    // Fixture inspection: CIRCLE mesh vertex 0 has bones=[4,5] weights=[0.00761, 0.99239].
    // Bone index 5 in the mesh's `bones` array refers to the SKELETON bone ordinal;
    // spine-core resolves `skeleton.bones[5]` which is `CHAIN_5` in SIMPLE_TEST.
    // We mutate `skeletonData.bones[5].scaleX/Y` to 2× BEFORE the sampler instantiates
    // the Skeleton — the bone's setup pose scale is doubled, cascading through the
    // weighted-sum math in computeWorldVertices.
    //
    // If the sampler ignored bone influences (e.g. treated weights as identity),
    // worldW wouldn't change. Observed ratio on the fixture ~1.78×; threshold 1.5×
    // is conservative and well above FP noise / per-vertex weight distribution.
    const baseline = sampleSkeleton(loadSkeleton(FIXTURE));
    const baseCircle = [...baseline.values()].find(
      (r) => r.attachmentName === 'CIRCLE',
    );
    expect(baseCircle).toBeDefined();

    const mutated = loadSkeleton(FIXTURE);
    const targetBoneIndex = 5;
    const boneData = mutated.skeletonData.bones[targetBoneIndex];
    expect(boneData).toBeDefined();
    // Sanity: we're mutating the expected chain bone.
    expect(boneData!.name.startsWith('CHAIN_')).toBe(true);
    boneData!.scaleX = (boneData!.scaleX ?? 1) * 2.0;
    boneData!.scaleY = (boneData!.scaleY ?? 1) * 2.0;

    const scaledPeaks = sampleSkeleton(mutated);
    const scaledCircle = [...scaledPeaks.values()].find(
      (r) => r.attachmentName === 'CIRCLE',
    );
    expect(scaledCircle).toBeDefined();

    // Differential gate — proves weighted-sum path actively reads bone transforms.
    expect(scaledCircle!.worldW).toBeGreaterThan(baseCircle!.worldW * 1.5);
  });

  it('N1.5 TransformConstraint (LOCKED per CONTEXT.md): SQUARE constrained-vs-unconstrained peaks differ strictly', () => {
    // Fixture: transform constraint name="CHAIN_8", bones=["SQUARE"] (driven),
    // target="CHAIN_8", mixScaleX=0.5. Multiple animations scale CHAIN_8 (via
    // its chain ancestors in PATH/SIMPLE_SCALE and directly in TRANSFORM),
    // so the constrained SQUARE's peak receives a 50%-mixed scaleX push from
    // CHAIN_8's animated scale. Cloning skeletonData without the constraint
    // leaves SQUARE at setup scale — the two peaks MUST differ strictly.
    //
    // CONTEXT.md Test Strategy explicitly locks this constrained-vs-unconstrained
    // shape. The > 1e-6 threshold is far below the observed delta (~1.10 on the
    // fixture) but still tight enough to fail on broken constraint wiring.
    const constrainedLoad = loadSkeleton(FIXTURE);
    const constrainedPeaks = sampleSkeleton(constrainedLoad);
    const constrainedSquare = [...constrainedPeaks.values()].find(
      (r) => r.slotName === 'SQUARE' && r.attachmentName === 'SQUARE',
    );
    expect(constrainedSquare).toBeDefined();

    // Fresh load; filter out the transform constraint whose `bones` list
    // contains the SQUARE bone. The selector matches by BoneData.name, which
    // spine-core 4.2's TransformConstraintData exposes as BoneData[] with a
    // string `name` field.
    const uncLoad = loadSkeleton(FIXTURE);
    const before = uncLoad.skeletonData.transformConstraints.length;
    uncLoad.skeletonData.transformConstraints =
      uncLoad.skeletonData.transformConstraints.filter(
        (c) => !c.bones.some((b) => b.name === 'SQUARE'),
      );
    // Fixture shape assertion — fires if the fixture is ever edited to change
    // the constraint layout. Forces a revisit of N1.5 rather than silent pass.
    expect(uncLoad.skeletonData.transformConstraints.length).toBe(before - 1);

    const uncPeaks = sampleSkeleton(uncLoad);
    const unconstrainedSquare = [...uncPeaks.values()].find(
      (r) => r.slotName === 'SQUARE' && r.attachmentName === 'SQUARE',
    );
    expect(unconstrainedSquare).toBeDefined();

    const delta = Math.abs(
      constrainedSquare!.peakScale - unconstrainedSquare!.peakScale,
    );
    expect(delta).toBeGreaterThan(1e-6);
  });

  it.skip('EASING-CURVE STRETCH: 120 Hz catches mid-frame peak within 1% of 480 Hz reference', () => {
    // STRETCH per CONTEXT.md Test Strategy: "flag as a stretch test" when the
    // fixture lacks a suitable non-linear easing. SIMPLE_TEST.json contains
    // only "stepped" curves (verified by inspection — all three "curve" entries
    // are "stepped") — no non-linear bezier easing that would expose sub-frame
    // peak refinement. Un-skip once a bezier-easing animation is added.
    //
    // When enabled the strategy is:
    //   1. Sample at 120 Hz → peak_120.
    //   2. Sample at 480 Hz (reference) → peak_ref.
    //   3. Assert |peak_120 - peak_ref| / peak_ref < 0.01 on the attachment
    //      whose animation path crosses the non-linear curve.
    const load = loadSkeleton(FIXTURE);
    const peaks120 = sampleSkeleton(load, { samplingHz: 120 });
    const peaksRef = sampleSkeleton(load, { samplingHz: 480 });
    const target = '<pending fixture extension>';
    const p120 = [...peaks120.values()].find(
      (r) => r.attachmentName === target,
    );
    const pRef = [...peaksRef.values()].find(
      (r) => r.attachmentName === target,
    );
    expect(p120).toBeDefined();
    expect(pRef).toBeDefined();
    const rel =
      Math.abs(p120!.peakScale - pRef!.peakScale) / pRef!.peakScale;
    expect(rel).toBeLessThan(0.01);
  });

  // Preserved from plan 00-04 — basic Map>=3 smoke (now tagged as a sibling of N1.1).
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

  it('N1.6 PhysicsConstraint determinism: two sequential runs produce bit-identical peak values', () => {
    const load = loadSkeleton(FIXTURE);
    const a = sampleSkeleton(load);
    const b = sampleSkeleton(load);
    expect(a.size).toBe(b.size);
    // Compare every key/value — peak scale must match bit-for-bit.
    for (const [key, recA] of a) {
      const recB = b.get(key);
      expect(recB, `missing key on second run: ${key}`).toBeDefined();
      const rb = recB as PeakRecord;
      expect(rb.peakScale).toBe(recA.peakScale);
      expect(rb.peakScaleX).toBe(recA.peakScaleX);
      expect(rb.peakScaleY).toBe(recA.peakScaleY);
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
      peakScaleX: expect.any(Number),
      peakScaleY: expect.any(Number),
      peakScale: expect.any(Number),
      worldW: expect.any(Number),
      worldH: expect.any(Number),
      sourceW: expect.any(Number),
      sourceH: expect.any(Number),
    });
  });

  it('N2.1 perf gate: full SIMPLE_TEST sampler run completes in <500 ms', () => {
    const load = loadSkeleton(FIXTURE);
    const t0 = performance.now();
    sampleSkeleton(load);
    const elapsed = performance.now() - t0;
    // Log elapsed for plan 00-05 SUMMARY visibility.
    // eslint-disable-next-line no-console
    console.log(`[N2.1] SIMPLE_TEST sampler elapsed: ${elapsed.toFixed(2)} ms`);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('sampler — module hygiene (N2.3 by construction)', () => {
  const src = fs.readFileSync(SAMPLER_SRC, 'utf8');
  const boundsSrc = fs.readFileSync(
    path.resolve('src/core/bounds.ts'),
    'utf8',
  );

  it('N2.3: src/core/sampler.ts does not import node:fs / node:path / node:child_process / node:net / node:http', () => {
    expect(src).not.toMatch(/from ['"]node:fs['"]/);
    expect(src).not.toMatch(/from ['"]node:path['"]/);
    expect(src).not.toMatch(/from ['"]node:child_process['"]/);
    expect(src).not.toMatch(/from ['"]node:net['"]/);
    expect(src).not.toMatch(/from ['"]node:http['"]/);
  });

  it('N2.3: src/core/bounds.ts (called in the hot loop) does not import node:fs / node:path / sharp', () => {
    // The sampler calls bounds.ts every tick × every visible slot; if bounds.ts
    // leaks FS I/O we violate N2.3 transitively. Belt-and-braces coverage on
    // top of bounds.spec.ts's own hygiene tests.
    expect(boundsSrc).not.toMatch(/from ['"]node:fs['"]/);
    expect(boundsSrc).not.toMatch(/from ['"]node:path['"]/);
    expect(boundsSrc).not.toMatch(/from ['"]sharp['"]/);
  });

  it('N2.3: sampler does not reference "sharp" (PNG-decode library belongs in Phase 8)', () => {
    expect(src).not.toMatch(/\bsharp\b/);
  });

  it('never drives sampling from fps (CLAUDE.md rule #1 — fps is editor metadata, not a sampling source)', () => {
    // CLAUDE.md rule #1 bans using fps to drive the SAMPLING rate; it does NOT
    // ban reading fps for DISPLAY (i.e. plumbing `editorFps` through for the
    // `frame` column so animators can cross-reference the editor dopesheet).
    // This grep catches the forbidden pattern — fps feeding dt or samplingHz —
    // not the legitimate display-plumbing of editorFps into the frame field.
    expect(src).not.toMatch(/dt\s*=.*fps|samplingHz\s*=.*fps/);
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
