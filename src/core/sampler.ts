/**
 * Phase 0 Plan 04 — Per-attachment peak sampler (the heart of Phase 0).
 *
 * Given a `LoadResult` from the loader, iterate every `(skin, animation)` pair
 * at the configured sampling rate (default 120 Hz per CLAUDE.md rule #6),
 * snapshot every visible attachment's world AABB each tick via `bounds.ts`,
 * and fold samples into a per-attachment peak record. Also run a setup-pose
 * pass per skin so attachments never touched by any animation still get
 * reported as peaks with `animationName = "Setup Pose (Default)"`.
 *
 * Locked lifecycle (per `.planning/phases/00-core-math-spike/00-CONTEXT.md`
 * "Sampler Contract" and CLAUDE.md rule #3 — MUST NOT be reordered):
 *
 *   For each skin:
 *     skeleton.setSkin(skin); skeleton.setSlotsToSetupPose();
 *     1. Setup-pose pass: setToSetupPose → updateWorldTransform(Physics.pose) → snapshot.
 *     2. For each animation:
 *        setToSetupPose; setSlotsToSetupPose;
 *        state.clearTracks; state.setAnimationWith(0, anim, false);
 *        skeleton.updateWorldTransform(Physics.reset);   // ONCE, before the loop
 *        for (t = 0; t <= animation.duration; t += dt) {
 *            state.update(dt);                            // 1
 *            state.apply(skeleton);                       // 2
 *            skeleton.update(dt);                         // 3
 *            skeleton.updateWorldTransform(Physics.update); // 4
 *            snapshot every visible attachment.
 *        }
 *
 * Determinism (N1.6, threat T-00-04-02): `Physics.reset` fires exactly once
 * per (skin, animation) pair before the first tick; the tick body then always
 * calls `Physics.update`. This is the contract that makes two consecutive
 * `sampleSkeleton(loadResult)` calls produce bit-identical peak values.
 *
 * I/O rule (N2.3, threat T-00-04-03): this module imports nothing from
 * `node:fs`, `node:path`, `node:child_process`, `node:net`, `node:http`, or
 * the PNG-decode library — the hot loop is filesystem-free by construction.
 * Enforced by hygiene tests in `tests/core/sampler.spec.ts`.
 *
 * Informational frame number (F2.6): `frame = round(time * load.editorFps)`.
 * `editorFps` is plumbed through from the loader (which reads it from
 * `skeletonData.fps`, default 30 — Spine's editor default). Per CLAUDE.md
 * rule #1, fps must NOT drive the SAMPLING rate (that's locked at
 * `samplingHz`, default 120 Hz); fps is only used for the display-only
 * `frame` field that lets animators cross-reference their editor dopesheet.
 */

import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  Physics,
  AttachmentTimeline,
} from '@esotericsoftware/spine-core';
import type { LoadResult, SampleRecord, SourceDims } from './types.js';
import { attachmentWorldAABB, computeRenderScale } from './bounds.js';

/** CLAUDE.md rule #6 — default 120 Hz. Above typical 60 Hz game render cadence. */
export const DEFAULT_SAMPLING_HZ = 120;

/**
 * Epsilon for peak-comparison ties. Without this, tiny floating-point noise
 * in the bone chain (≈1e-14 accumulated across multi-bone world transforms)
 * lets the peak latch migrate across dozens of frames on rigs where the
 * effective scale is static — e.g. CARDS on a static hand bone would
 * "peak" at f35 instead of f0 because the second frame happened to compute
 * 1.00000000000002 vs the first's 1.00000000000001. 1e-9 is far above FP
 * noise and far below any meaningful scale delta (user-facing goldens use
 * 1e-3 tolerance).
 */
const PEAK_EPSILON = 1e-9;

/**
 * Per-animation "affected" threshold (D-54). Distinct from the 1e-9 peak-latch
 * tolerance above — 1e-6 is well above animator-meaningful bone-scale deltas
 * but still filters out floating-point noise + compensating-constraint residue.
 * Governs only the per-animation emission gate; the 1e-9 peak-latch stays
 * owned by the global-peak fold.
 */
const SCALE_DELTA_EPSILON = 1e-6;

/** Label used for attachments that no animation timeline touches. */
const SETUP_POSE_LABEL = 'Setup Pose (Default)';

export interface SamplerOptions {
  /** Sampling frequency in Hz. Default 120. dt = 1 / samplingHz. */
  samplingHz?: number;
}

/**
 * Peak record per `(skin, slot, attachment)` tuple. The returned map is
 * keyed as `${skinName}/${slotName}/${attachmentName}`.
 *
 * Extends `SampleRecord` from `./types.ts` with a boolean flag indicating
 * whether the peak came from the setup-pose pass (i.e. no animation timeline
 * ever touched this attachment).
 */
export interface PeakRecord extends SampleRecord {
  /** True if no animation timeline touched this attachment; scale is from the setup pose. */
  isSetupPosePeak: boolean;
}

/**
 * Phase 3 Plan 01 — Extended sampler output (D-53).
 *
 * - `globalPeaks`: per-(skin, slot, attachment) peak across all animations and
 *   setup-pose passes. Key: `${skinName}/${slotName}/${attachmentName}`.
 *   Phase 2 contract preserved — analyzer's existing `analyze()` consumes
 *   this Map unchanged.
 * - `perAnimation`: per-(animation, skin, slot, attachment) peak, populated
 *   ONLY for attachments passing the "affected" test per D-54 (scale-delta
 *   greater than the 1e-6 threshold OR named by an AttachmentTimeline on the
 *   corresponding slot). The setup-pose pass does not populate this map.
 *   Key: `${animationName}/${skinName}/${slotName}/${attachmentName}`.
 * - `setupPosePeaks`: per-(skin, slot, attachment) peak from the setup-pose
 *   pass only, independent of any animation. Consumed by the breakdown
 *   analyzer to build the static-pose top card (D-60) including attachments
 *   that no animation touches.
 */
export interface SamplerOutput {
  globalPeaks: Map<string, PeakRecord>;
  perAnimation: Map<string, PeakRecord>;
  setupPosePeaks: Map<string, PeakRecord>;
}

/**
 * Run the sampler across every `(skin, animation)` pair in the loaded skeleton
 * and return a map of per-attachment peak records.
 *
 * @param load LoadResult from `loadSkeleton()`.
 * @param opts Sampler options (`samplingHz`, `frameRate`).
 * @returns SamplerOutput — three Maps: globalPeaks (Phase 2 preserved),
 *          perAnimation (D-54 affected-attachment per-animation), setupPosePeaks
 *          (Pass-1-only static pose map for D-60 Setup Pose card coverage).
 */
export function sampleSkeleton(
  load: LoadResult,
  opts: SamplerOptions = {},
): SamplerOutput {
  const samplingHz = opts.samplingHz ?? DEFAULT_SAMPLING_HZ;
  const editorFps = load.editorFps;
  const dt = 1 / samplingHz;

  // Phase 3: globalPeaks is Phase 2's renamed `peaks` — same semantics.
  const globalPeaks = new Map<string, PeakRecord>();
  // Phase 3 Plan 01 — per-animation affected attachments only (D-54).
  const perAnimation = new Map<string, PeakRecord>();
  // Phase 3 Plan 01 — Pass-1-only static pose peak map; drives the top card
  // so it covers every textured attachment even if no animation touches it.
  const setupPosePeaks = new Map<string, PeakRecord>();
  // Keyed by the global key (`${skin}/${slot}/${attachment}`). Populated during
  // Pass 1 (setup-pose) and read during Pass 2's per-tick affected-check.
  // Never read from globalPeaks mid-flight — see RESEARCH Pitfall 3.
  const setupPoseBaseline = new Map<string, number>();
  // Tracks which attachment keys were seen during any animation tick. Keys
  // present only from the setup-pose pass are labeled `isSetupPosePeak: true`.
  const touchedByAnimation = new Set<string>();

  // Single Skeleton + AnimationState pair reused across all (skin, animation)
  // iterations — the locked lifecycle resets them between runs.
  const skeleton = new Skeleton(load.skeletonData);
  const stateData = new AnimationStateData(load.skeletonData);
  const state = new AnimationState(stateData);

  for (const skin of load.skeletonData.skins) {
    skeleton.setSkin(skin);
    skeleton.setSlotsToSetupPose();

    // Pass 1 (per skin): setup-pose snapshot. Use Physics.pose — world
    // transforms are recomputed without stepping physics (static pose).
    skeleton.setToSetupPose();
    state.clearTracks();
    skeleton.updateWorldTransform(Physics.pose);
    snapshotFrame(
      skeleton,
      skin.name,
      SETUP_POSE_LABEL,
      /*time*/ 0,
      /*frame*/ 0,
      load.sourceDims,
      globalPeaks,
      /*touchedSet*/ null, // setup-pose pass doesn't mark attachments touched
      /*setupPosePeaks*/ setupPosePeaks,
      /*setupPoseBaseline*/ setupPoseBaseline,
      /*perAnimation*/ null,
      /*perAnimationNames*/ null,
    );

    // === Pass 1.5 (per skin) — skin-manifest coverage ===
    //
    // Plan 260505-lk0 (2026-05-05). Fixes silent-discard of skin-declared
    // attachments that no slot binding ever activates.
    //
    // TRUE bug shape (verified against fixtures/SAMPLER_ALPHA_ZERO/
    // TOPSCREEN_ANIMATION_JOKER.json): when an animator declares an
    // attachment in a skin's manifest but turns "visibility off" in setup
    // pose (no `attachment` field on the slot def) AND never animates it,
    // Spine encodes this as `slot.attachment = null` at setup pose with no
    // animation timeline raising it. Pass 1's snapshotFrame walks
    // `skeleton.slots` and correctly skips slots where
    // `slot.getAttachment() === null` (sampler.ts:285) — that guard is
    // correct for the live-binding pass. But it leaves skin-declared
    // attachments that no slot binding ever activates absent from
    // globalPeaks / setupPosePeaks / the export plan / optimized images.
    //
    // The user's locked principle: visibility (slot binding null OR alpha
    // 0) is a runtime-mutable concern. Dev code, player actions, equipment
    // swaps can bind any skin-declared attachment to any slot at any
    // frame. Therefore any attachment the skin manifest declares must be
    // measured for peak scale, optimization, and export — independent of
    // whether any setup-pose binding or animation timeline activates it.
    //
    // Defer rule (no double-emit): only emit for keys absent from
    // globalPeaks. The existing setup-pose pass populates globalPeaks with
    // the live binding; this pass only fills the gap for skin-declared
    // attachments no setup-pose binding activated. Runs strictly after
    // Pass 1 within the same skin scope so the dedupe is structurally
    // correct.
    //
    // World transforms from the Physics.pose call above are still current
    // (no skeleton mutation between then and here). attachmentWorldAABB /
    // computeRenderScale accept arbitrary attachment params (bounds.ts:
    // 59-92, bounds.ts:148-184) — no slot.setAttachment mutation needed.
    //
    // FALSIFIED prior plan: a previous PLAN.md targeted the alpha gate at
    // sampler.ts:291. Empirical fixture probe falsified it — both
    // JOKER-BG and JOKER-FRAME slot defs have no `color` field (default
    // alpha 1.0). The alpha gate at sampler.ts:291 stays unchanged.
    for (const entry of skin.getAttachments()) {
      const slot = skeleton.slots[entry.slotIndex];
      if (slot === undefined) continue; // defensive (skin/skeleton drift)

      const attachment = entry.attachment;
      // Defensive: SkinEntry shouldn't carry null, but the spine-core type
      // declares `attachment: Attachment` and we don't trust the input fully.
      if (attachment === null || attachment === undefined) continue;

      const key = `${skin.name}/${slot.data.name}/${entry.name}`;
      if (globalPeaks.has(key)) continue; // existing setup-pose pass already measured this binding — defer

      const aabb = attachmentWorldAABB(slot, attachment);
      if (aabb === null) continue; // BoundingBox / Path / Point / Clipping — no source texture

      // Region-name resolution mirrors snapshotFrame's logic (sampler.ts:
      // 309-310): prefer attachment.region.name (path indirection), fall
      // back to entry.name. Identical lookup path so atlas-source vs
      // optimized-folder load stays symmetric.
      const regionName = (attachment as { region?: { name?: string } }).region?.name;
      const sd = load.sourceDims.get(regionName ?? entry.name);
      if (sd === undefined || sd.w <= 0 || sd.h <= 0) continue;

      const rs = computeRenderScale(slot, attachment);
      if (rs === null) continue;
      const { scale: peakScale, scaleX: peakScaleX, scaleY: peakScaleY } = rs;
      const worldW = aabb.maxX - aabb.minX;
      const worldH = aabb.maxY - aabb.minY;

      const record: PeakRecord = {
        attachmentKey: key,
        skinName: skin.name,
        slotName: slot.data.name,
        attachmentName: entry.name,
        animationName: SETUP_POSE_LABEL,
        time: 0,
        frame: 0,
        peakScaleX,
        peakScaleY,
        peakScale,
        worldW,
        worldH,
        sourceW: sd.w,
        sourceH: sd.h,
        isSetupPosePeak: true,
      };
      globalPeaks.set(key, record);
      setupPosePeaks.set(key, record); // mirror snapshotFrame's setup-pose-pass dual write
      // D-54 baseline: if a future animation rebinds this attachment via
      // AttachmentTimeline, the per-animation affected-check (Pass 2)
      // computes scaleDelta = abs(peakScale - baseline). Without a
      // baseline entry, that delta starts at peakScale - 0 = peakScale and
      // the attachment becomes "affected by every animation" — false
      // positive. Writing the baseline here ensures the affected-check
      // works correctly for unbound-then-bound attachments.
      setupPoseBaseline.set(key, peakScale);
    }
    // === end Pass 1.5 ===

    // Pass 2 (per skin, per animation): locked tick lifecycle.
    for (const anim of load.skeletonData.animations) {
      // Pre-loop: one-time collection of AttachmentTimeline-named pairs
      // `${slotIndex}/${attachmentName}` for the second arm of D-54's
      // "affected" test. Uses instanceof on each timeline.
      const animAttachmentNames = new Set<string>();
      for (const tl of anim.timelines) {
        if (tl instanceof AttachmentTimeline) {
          for (const name of tl.attachmentNames) {
            if (name !== null) animAttachmentNames.add(`${tl.slotIndex}/${name}`);
          }
        }
      }

      skeleton.setToSetupPose();
      skeleton.setSlotsToSetupPose();
      state.clearTracks();
      // spine-core 4.2 splits the overload: `setAnimation` takes a string name,
      // `setAnimationWith` takes the Animation object. The plan's interface
      // block conflated them; the installed .d.ts confirms the split.
      state.setAnimationWith(0, anim, false);
      // Physics.reset called ONCE per animation — this is the determinism
      // anchor (N1.6 / T-00-04-02).
      skeleton.updateWorldTransform(Physics.reset);

      const duration = anim.duration;
      // `t <= duration + 1e-9` catches terminal-frame peaks and handles the
      // zero-duration (static pose) animation case — the first iteration
      // always runs because `0 <= 0 + 1e-9`.
      for (let t = 0; t <= duration + 1e-9; t += dt) {
        // === LOCKED TICK ORDER (CLAUDE.md rule #3 — do not reorder) ===
        state.update(dt);
        state.apply(skeleton);
        skeleton.update(dt);
        skeleton.updateWorldTransform(Physics.update);
        // ==============================================================
        snapshotFrame(
          skeleton,
          skin.name,
          anim.name,
          t,
          Math.round(t * editorFps),
          load.sourceDims,
          globalPeaks,
          touchedByAnimation,
          /*setupPosePeaks*/ null,
          /*setupPoseBaseline*/ setupPoseBaseline,
          /*perAnimation*/ perAnimation,
          /*perAnimationNames*/ animAttachmentNames,
        );
      }
    }
  }

  // Post-pass: any setup-pose peak that was NOT also seen during an animation
  // stays flagged as a setup-pose peak. The snapshotFrame constructor already
  // sets `isSetupPosePeak` correctly per-insert; this loop normalizes the
  // flag for any key only ever written by the animation pass(es).
  for (const [key, rec] of globalPeaks) {
    if (touchedByAnimation.has(key) && rec.animationName !== SETUP_POSE_LABEL) {
      rec.isSetupPosePeak = false;
    }
  }

  return { globalPeaks, perAnimation, setupPosePeaks };
}

/**
 * Snapshot every visible attachment on every slot and update `peaks` in place.
 * If `touchedSet` is non-null, each visible attachment's key is added to it
 * (used by the animation passes to distinguish animation-touched vs setup-only
 * attachments).
 *
 * Visibility check per 00-CONTEXT.md ("How to detect visible attachment —
 * canonical"): `slot.getAttachment() !== null && slot.color.a > 0`. Invisible
 * slots (alpha 0) contribute nothing to the peak.
 *
 * Allocation-free fold: we only `peaks.set(...)` when the new scale strictly
 * exceeds the stored peak, so the hot path writes at most once per attachment
 * per tick. No growing arrays — CLAUDE.md rule #4.
 */
function snapshotFrame(
  skeleton: Skeleton,
  skinName: string,
  animationName: string,
  time: number,
  frame: number,
  sourceDims: Map<string, SourceDims>,
  globalPeaks: Map<string, PeakRecord>,
  touchedSet: Set<string> | null,
  setupPosePeaks: Map<string, PeakRecord> | null,
  setupPoseBaseline: Map<string, number>,
  perAnimation: Map<string, PeakRecord> | null,
  perAnimationNames: Set<string> | null,
): void {
  let slotIndex = 0;
  for (const slot of skeleton.slots) {
    const attachment = slot.getAttachment();
    if (attachment === null) {
      slotIndex++;
      continue;
    }
    // Canonical visibility: alpha 0 slots are invisible at runtime.
    if (slot.color.a <= 0) {
      slotIndex++;
      continue;
    }

    const aabb = attachmentWorldAABB(slot, attachment);
    if (aabb === null) {
      slotIndex++;
      continue; // BoundingBox / Path / Point / Clipping
    }

    // Spine skins allow an attachment to use `path` indirection to point at a
    // differently-named atlas region (e.g. slot "CARDS_R_HAND_1" carrying an
    // attachment whose texture lives at atlas region "AVATAR/CARDS_R_HAND_1").
    // Our sourceDims map is keyed by atlas region name, so prefer the
    // attachment's region.name when present and fall back to attachment.name
    // only for attachments without a region (shouldn't happen for pixel-bearing
    // ones at this point — the AABB guard above already filtered them).
    const regionName = (attachment as { region?: { name?: string } }).region?.name;
    const sd = sourceDims.get(regionName ?? attachment.name);
    if (sd === undefined || sd.w <= 0 || sd.h <= 0) {
      slotIndex++;
      continue;
    }

    const rs = computeRenderScale(slot, attachment);
    if (rs === null) {
      slotIndex++;
      continue; // non-textured attachment (defensive; AABB guard above already skipped)
    }
    const { scale: peakScale, scaleX: peakScaleX, scaleY: peakScaleY } = rs;
    const worldW = aabb.maxX - aabb.minX;
    const worldH = aabb.maxY - aabb.minY;

    const key = `${skinName}/${slot.data.name}/${attachment.name}`;
    if (touchedSet !== null) touchedSet.add(key);

    const existing = globalPeaks.get(key);
    if (existing === undefined || peakScale > existing.peakScale + PEAK_EPSILON) {
      globalPeaks.set(key, {
        attachmentKey: key,
        skinName,
        slotName: slot.data.name,
        attachmentName: attachment.name,
        animationName,
        time,
        frame,
        peakScaleX,
        peakScaleY,
        peakScale,
        worldW,
        worldH,
        sourceW: sd.w,
        sourceH: sd.h,
        isSetupPosePeak: animationName === SETUP_POSE_LABEL,
      });
    }

    // Phase 3 Plan 01 — Pass 1: record setup-pose baseline + setupPosePeaks.
    // Pass 1 owns these; Pass 2 passes null for setupPosePeaks.
    if (setupPosePeaks !== null) {
      setupPoseBaseline.set(key, peakScale);
      setupPosePeaks.set(key, {
        attachmentKey: key,
        skinName,
        slotName: slot.data.name,
        attachmentName: attachment.name,
        animationName,
        time,
        frame,
        peakScaleX,
        peakScaleY,
        peakScale,
        worldW,
        worldH,
        sourceW: sd.w,
        sourceH: sd.h,
        isSetupPosePeak: true,
      });
    }

    // Phase 3 Plan 01 — Pass 2: per-animation "affected" emission (D-54).
    // Latch on the higher peak within an animation (PEAK_EPSILON tolerance).
    if (perAnimation !== null) {
      const baseline = setupPoseBaseline.get(key) ?? 0;
      const scaleDelta = Math.abs(peakScale - baseline);
      const isAffectedByScale = scaleDelta > SCALE_DELTA_EPSILON;
      const timelineKey = `${slotIndex}/${attachment.name}`;
      const isAffectedByTimeline =
        perAnimationNames !== null && perAnimationNames.has(timelineKey);
      if (isAffectedByScale || isAffectedByTimeline) {
        const perAnimKey = `${animationName}/${key}`;
        const existingPA = perAnimation.get(perAnimKey);
        if (existingPA === undefined || peakScale > existingPA.peakScale + PEAK_EPSILON) {
          perAnimation.set(perAnimKey, {
            attachmentKey: key,
            skinName,
            slotName: slot.data.name,
            attachmentName: attachment.name,
            animationName,
            time,
            frame,
            peakScaleX,
            peakScaleY,
            peakScale,
            worldW,
            worldH,
            sourceW: sd.w,
            sourceH: sd.h,
            isSetupPosePeak: false,
          });
        }
      }
    }

    slotIndex++;
  }
}
