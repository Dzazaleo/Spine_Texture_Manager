// src/core/runtime/runtime.ts — Phase 42: SIGNATURES ONLY. No bodies, no
// spine-core import. Phase 43 (RT-02) adds runtime-42.ts / runtime-43.ts impls.
//
// RESEARCH §SpineRuntime Interface refinement APPLIED: keep ONLY
// `boneAxisScale(slot)`; the bone-of-slot accessor is intentionally NOT
// exposed — a bone has no opaque handle type and exposing it would force an
// `OpaqueBone` the math layer never needs (the bone's world-scale is reached
// entirely via `boneAxisScale(slot)`).
import type {
  RuntimeTag, OpaqueSkeleton, OpaqueSkeletonData, OpaqueAnimationState,
  OpaqueSlot, OpaqueAttachment, OpaqueSkin, OpaqueAnimation, OpaqueAtlas,
} from './types.js';

export interface SpineRuntime {
  readonly tag: RuntimeTag;

  // --- loader-side (parse) ---
  makeAtlas(atlasText: string): OpaqueAtlas;
  parseSkeleton(parsedJson: unknown, atlas: OpaqueAtlas, atlasLess: boolean): OpaqueSkeletonData;
  applyRotatedRegionFix(data: OpaqueSkeletonData): void;          // 4.2: Phase-33 offset[] patch; 4.3: getOffsets() equivalent (Phase 43)

  // --- sampler-side (lifecycle) ---
  makeSkeleton(data: OpaqueSkeletonData): OpaqueSkeleton;
  makeAnimationState(data: OpaqueSkeletonData): OpaqueAnimationState;
  skins(data: OpaqueSkeletonData): OpaqueSkin[];
  animations(data: OpaqueSkeletonData): OpaqueAnimation[];
  animationDuration(anim: OpaqueAnimation): number;
  animationName(anim: OpaqueAnimation): string;
  /** Q1 additive (Phase 43, RT-02): the `${slotIndex}/${attachmentName}` pairs
   *  named by every AttachmentTimeline in this animation (D-54 affected set).
   *  4.2: `tl instanceof AttachmentTimeline` over `anim.timelines`; 4.3 maps
   *  the same. Lets sampler.ts drop its spine-core AttachmentTimeline import. */
  attachmentTimelineNames(anim: OpaqueAnimation): Set<string>;
  skinName(skin: OpaqueSkin): string;

  setSkin(sk: OpaqueSkeleton, skin: OpaqueSkin): void;
  setupPose(sk: OpaqueSkeleton): void;                            // 4.2 setToSetupPose | 4.3 setupPose
  setupPoseSlots(sk: OpaqueSkeleton): void;                       // 4.2 setSlotsToSetupPose | 4.3 setupPoseSlots
  clearTracks(st: OpaqueAnimationState): void;
  setAnimation(st: OpaqueAnimationState, track: number, anim: OpaqueAnimation, loop: boolean): void;
                                                                  // 4.2 setAnimationWith | 4.3 setAnimation(obj overload)
  stateUpdate(st: OpaqueAnimationState, dt: number): void;
  stateApply(st: OpaqueAnimationState, sk: OpaqueSkeleton): void;
  skeletonUpdate(sk: OpaqueSkeleton, dt: number): void;
  updateWorldTransform(sk: OpaqueSkeleton, mode: 'pose' | 'reset' | 'update'): void;

  // --- visibility / iteration (the project_sampler_visibility_invariant surface) ---
  slots(sk: OpaqueSkeleton): OpaqueSlot[];
  slotName(slot: OpaqueSlot): string;
  slotAttachment(slot: OpaqueSlot): OpaqueAttachment | null;      // 4.2 slot.getAttachment() | 4.3 slot.pose.attachment
  slotColorAlpha(slot: OpaqueSlot): number;                       // 4.2 slot.color.a | 4.3 slot.pose.color.a
  skinEntries(skin: OpaqueSkin): { slotIndex: number; name: string; attachment: OpaqueAttachment }[];

  // --- bounds math (the two computeWorldVertices + bone scale + attachment meta) ---
  attachmentKind(a: OpaqueAttachment): 'region' | 'mesh' | 'vertex' | 'skip';
  regionWorldVertices(slot: OpaqueSlot, a: OpaqueAttachment): Float32Array;        // 8 floats
  vertexWorldVertices(sk: OpaqueSkeleton, slot: OpaqueSlot, a: OpaqueAttachment): Float32Array;
  boneAxisScale(slot: OpaqueSlot): { x: number; y: number };      // 4.2 bone.getWorldScaleX/Y | 4.3 bone.appliedPose.getWorldScaleX/Y
  attachmentRegionMeta(a: OpaqueAttachment): {
    name?: string; pageW?: number; pageH?: number;
    originalW?: number; originalH?: number; canonW?: number; canonH?: number;
  } | null;
  attachmentUVs(a: OpaqueAttachment): Float32Array | null;
  sequenceRegions(a: OpaqueAttachment): { name: string }[] | null;
}

/** Phase 42 declares the signature; Phase 43 (RT-02) implements the lazy
 *  require()/import() switch. Body intentionally absent in Phase 42. */
export declare function pickRuntime(tag: RuntimeTag): SpineRuntime;
