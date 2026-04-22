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
} from '@esotericsoftware/spine-core';
import type { LoadResult, SampleRecord, SourceDims } from './types.js';
import { attachmentWorldAABB, computeRenderScale } from './bounds.js';

/** CLAUDE.md rule #6 — default 120 Hz. Above typical 60 Hz game render cadence. */
export const DEFAULT_SAMPLING_HZ = 120;

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
 * Run the sampler across every `(skin, animation)` pair in the loaded skeleton
 * and return a map of per-attachment peak records.
 *
 * @param load LoadResult from `loadSkeleton()`.
 * @param opts Sampler options (`samplingHz`, `frameRate`).
 * @returns Map keyed `${skin}/${slot}/${attachment}` → `PeakRecord`.
 */
export function sampleSkeleton(
  load: LoadResult,
  opts: SamplerOptions = {},
): Map<string, PeakRecord> {
  const samplingHz = opts.samplingHz ?? DEFAULT_SAMPLING_HZ;
  const editorFps = load.editorFps;
  const dt = 1 / samplingHz;

  const peaks = new Map<string, PeakRecord>();
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
      peaks,
      /*touchedSet*/ null, // setup-pose pass doesn't mark attachments touched
    );

    // Pass 2 (per skin, per animation): locked tick lifecycle.
    for (const anim of load.skeletonData.animations) {
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
          peaks,
          touchedByAnimation,
        );
      }
    }
  }

  // Post-pass: any setup-pose peak that was NOT also seen during an animation
  // stays flagged as a setup-pose peak. The snapshotFrame constructor already
  // sets `isSetupPosePeak` correctly per-insert; this loop normalizes the
  // flag for any key only ever written by the animation pass(es).
  for (const [key, rec] of peaks) {
    if (touchedByAnimation.has(key) && rec.animationName !== SETUP_POSE_LABEL) {
      rec.isSetupPosePeak = false;
    }
  }

  return peaks;
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
  peaks: Map<string, PeakRecord>,
  touchedSet: Set<string> | null,
): void {
  for (const slot of skeleton.slots) {
    const attachment = slot.getAttachment();
    if (attachment === null) continue;
    // Canonical visibility: alpha 0 slots are invisible at runtime.
    if (slot.color.a <= 0) continue;

    const aabb = attachmentWorldAABB(slot, attachment);
    if (aabb === null) continue; // BoundingBox / Path / Point / Clipping

    // Spine skins allow an attachment to use `path` indirection to point at a
    // differently-named atlas region (e.g. slot "CARDS_R_HAND_1" carrying an
    // attachment whose texture lives at atlas region "AVATAR/CARDS_R_HAND_1").
    // Our sourceDims map is keyed by atlas region name, so prefer the
    // attachment's region.name when present and fall back to attachment.name
    // only for attachments without a region (shouldn't happen for pixel-bearing
    // ones at this point — the AABB guard above already filtered them).
    const regionName = (attachment as { region?: { name?: string } }).region?.name;
    const sd = sourceDims.get(regionName ?? attachment.name);
    if (sd === undefined || sd.w <= 0 || sd.h <= 0) continue;

    const rs = computeRenderScale(slot, attachment);
    if (rs === null) continue; // non-textured attachment (defensive; AABB guard above already skipped)
    const { scale: peakScale, scaleX: peakScaleX, scaleY: peakScaleY } = rs;
    const worldW = aabb.maxX - aabb.minX;
    const worldH = aabb.maxY - aabb.minY;

    const key = `${skinName}/${slot.data.name}/${attachment.name}`;
    if (touchedSet !== null) touchedSet.add(key);

    const existing = peaks.get(key);
    if (existing === undefined || peakScale > existing.peakScale) {
      peaks.set(key, {
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
  }
}
