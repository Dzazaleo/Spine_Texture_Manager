/**
 * Plan 260505-lk0 — Regression spec for sampler silent-discard of skin-declared
 * but never-bound attachments.
 *
 * TRUE bug shape (empirically confirmed against `fixtures/SAMPLER_ALPHA_ZERO/
 * TOPSCREEN_ANIMATION_JOKER.json`):
 *
 *   When a Spine animator declares an attachment in a skin's manifest but turns
 *   "visibility off" in setup pose (no `attachment` field on the slot def) AND
 *   never animates it, Spine encodes this as `slot.attachment = null` at setup
 *   with no animation timeline raising it. The skin's manifest still declares
 *   the binding (e.g. default skin: `JOKER-BG → JOKER/BG`, `JOKER-FRAME →
 *   JOKER/FRAME`) and the attachment is exported into the atlas with real
 *   source dims. But `slot.getAttachment()` returns `null` for these slots
 *   forever — because no setup-pose binding and no animation timeline ever
 *   activates them.
 *
 *   The current sampler walks `skeleton.slots` and skips any slot where
 *   `slot.getAttachment() === null` (sampler.ts:285). This guard is correct in
 *   isolation — but it misses skin-declared attachments that no slot binding
 *   ever activates. Those end up absent from `globalPeaks`, absent from
 *   `setupPosePeaks`, absent from the export plan, and absent from the
 *   optimized images folder.
 *
 * FALSIFIED prior plan (historical context only): a previous PLAN.md targeted
 * the alpha gate at sampler.ts:291. Empirical fixture probe falsified that
 * model — both `JOKER-BG` and `JOKER-FRAME` slot defs have NO `color` field
 * (default alpha 1.0), so the alpha gate never fires. The real bug is upstream
 * of slot iteration: the sampler never iterates skin-declared attachments that
 * no slot binds. See PLAN.md for the falsifying probe details.
 *
 * Regression targets (verified against fixture lines 1127-1128 + 1523-1567):
 *
 *   | skinName | slotName     | attachmentName | sourceW | sourceH |
 *   |----------|--------------|----------------|---------|---------|
 *   | default  | JOKER-BG     | JOKER/BG       | 2660    | 2500    |
 *   | default  | JOKER-FRAME  | JOKER/FRAME    | 2913    | 2763    |
 *
 * Both slots are bound to bone `TOP_JOKER`. Both have `slot.attachment = null`
 * in setup pose. No animation timeline touches them. Default skin defines both
 * bindings.
 */
import { describe, expect, it, beforeAll } from 'vitest';
import * as path from 'node:path';
import { loadSkeleton } from '../../src/core/loader.js';
import { sampleSkeleton, type SamplerOutput } from '../../src/core/sampler.js';

const FIXTURE = path.resolve(
  'fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json',
);
const SETUP_POSE_LABEL = 'Setup Pose (Default)';

const REGRESSION_TARGETS = [
  {
    skinName: 'default',
    slotName: 'JOKER-BG',
    attachmentName: 'JOKER/BG',
    sourceW: 2660,
    sourceH: 2500,
  },
  {
    skinName: 'default',
    slotName: 'JOKER-FRAME',
    attachmentName: 'JOKER/FRAME',
    sourceW: 2913,
    sourceH: 2763,
  },
] as const;

describe('sampler — skin-declared but never-bound attachments are measured (regression for silent-discard at sampler.ts:285)', () => {
  let output: SamplerOutput;

  beforeAll(() => {
    const load = loadSkeleton(FIXTURE);
    output = sampleSkeleton(load);
  });

  it.each(REGRESSION_TARGETS)(
    'globalPeaks contains $skinName/$slotName/$attachmentName',
    ({ skinName, slotName, attachmentName }) => {
      const key = `${skinName}/${slotName}/${attachmentName}`;
      expect(
        output.globalPeaks.has(key),
        `globalPeaks missing key '${key}' (silent-discard bug — fixture skin manifest declares this binding but no slot binding activates it)`,
      ).toBe(true);
      const record = output.globalPeaks.get(key)!;
      expect(Number.isFinite(record.peakScale)).toBe(true);
      expect(record.peakScale).toBeGreaterThan(0);
    },
  );

  it.each(REGRESSION_TARGETS)(
    'setupPosePeaks contains $skinName/$slotName/$attachmentName with isSetupPosePeak === true',
    ({ skinName, slotName, attachmentName }) => {
      const key = `${skinName}/${slotName}/${attachmentName}`;
      expect(
        output.setupPosePeaks.has(key),
        `setupPosePeaks missing key '${key}' (skin-manifest pass should dual-write to setupPosePeaks like the existing setup-pose path)`,
      ).toBe(true);
      const record = output.setupPosePeaks.get(key)!;
      expect(record.isSetupPosePeak).toBe(true);
      expect(record.animationName).toBe(SETUP_POSE_LABEL);
    },
  );

  it.each(REGRESSION_TARGETS)(
    'sourceW/H match skin-manifest dims for $skinName/$slotName/$attachmentName',
    ({ skinName, slotName, attachmentName, sourceW, sourceH }) => {
      const key = `${skinName}/${slotName}/${attachmentName}`;
      expect(output.globalPeaks.has(key)).toBe(true);
      const record = output.globalPeaks.get(key)!;
      expect(record.sourceW).toBe(sourceW);
      expect(record.sourceH).toBe(sourceH);
    },
  );

  it('does not regress visible-attachment peaks — globalPeaks size is greater than the count of regression targets', () => {
    // Sanity guard: the skin-manifest pass MUST NOT replace the existing
    // setup-pose / animation passes — it only fills the gap for skin-declared
    // attachments that no slot binding activates. The fixture has many other
    // attachments (JOKER_FULL_BODY/*, JOKER/HAIR, JOKER/FACE, etc.) that ARE
    // bound at setup pose; their peaks must still flow through.
    expect(output.globalPeaks.size).toBeGreaterThan(REGRESSION_TARGETS.length);
  });
});
