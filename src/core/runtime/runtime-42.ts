// src/core/runtime/runtime-42.ts — Phase 43 RT-02 / SAFE-02
//
// Byte-faithful relocation of every spine-core-42 call shape currently in
// sampler.ts / bounds.ts / loader.ts. The ONLY changes are:
//   1. The import path (now 'spine-core-42' consolidated here).
//   2. The wrapper indirection (brandHandle/unwrapHandle boundary casts).
//
// DISCIPLINE (SAFE-02 by construction): every relocated call's argument list,
// order, and buffer shape is IDENTICAL to the originating source line.
// 4.2.111 is unchanged spine-core — any drift here is a plumbing bug, not a
// runtime change. SAFE-02 (Plan 03) byte-gates the full canonicalized
// SamplerOutput to catch any drift at the smallest ${skin}/${slot}/${attachment}
// granularity.
//
// Sanctioned import carve-out: this file and runtime-43.ts are the ONLY two
// src/core/ files permitted to import a spine-core package (Phase 43 RT-02
// arch contract; enforced by tests/arch.spec.ts RT-02 anchor).
//
// Phase-33 rotated-region patch (SAFE-02 regression-lock): the SWAP-form
// offset[0..7] write is relocated VERBATIM from loader.ts:552-613. The
// spine_rotated frozen SAFE-01 baseline byte-gates it in Plan 03.

import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  Physics,
  AttachmentTimeline,
  AtlasAttachmentLoader,
  SkeletonJson,
  TextureAtlas,
  Texture,
  TextureFilter,
  TextureWrap,
  RegionAttachment,
  VertexAttachment,
  MeshAttachment,
  BoundingBoxAttachment,
  PathAttachment,
  PointAttachment,
  ClippingAttachment,
} from 'spine-core-42';
import { brandHandle, unwrapHandle } from './types.js';
import type {
  RuntimeTag,
  OpaqueSkeleton,
  OpaqueSkeletonData,
  OpaqueAnimationState,
  OpaqueSlot,
  OpaqueAttachment,
  OpaqueSkin,
  OpaqueAnimation,
  OpaqueAtlas,
} from './types.js';
import type { SpineRuntime } from './runtime.js';
import { SilentSkipAttachmentLoader } from '../synthetic-atlas.js';

// ─── StubTexture (verbatim from loader.ts:64-79 + :88-89) ───────────────────
//
// CLAUDE.md Fact #4 — the math phase does not decode PNGs. A stub Texture
// populated from .atlas metadata is sufficient. This is the headless pattern.

class StubTexture extends Texture {
  constructor() {
    // Pass a sentinel null image — spine-core's Texture constructor stores
    // whatever we give it; nothing in the Phase 0 pipeline reads it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    super(null as any);
  }
  setFilters(_min: TextureFilter, _mag: TextureFilter): void {
    /* no-op — no GPU backing */
  }
  setWraps(_u: TextureWrap, _v: TextureWrap): void {
    /* no-op — no GPU backing */
  }
  dispose(): void {
    /* no-op — nothing to release */
  }
}

function createStubTextureLoader(): (pageName: string) => Texture {
  return (_pageName: string) => new StubTexture();
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function create(): SpineRuntime {
  return {
    tag: '4.2' as RuntimeTag,

    // ── loader-side (parse) ──────────────────────────────────────────────────

    makeAtlas(atlasText: string): OpaqueAtlas {
      // Verbatim from loader.ts:402-407 / :494-498 / :852-857.
      const atlas = new TextureAtlas(atlasText);
      const stub = createStubTextureLoader();
      for (const page of atlas.pages) {
        page.setTexture(stub(page.name));
      }
      return brandHandle<OpaqueAtlas>(atlas, '4.2');
    },

    parseSkeleton(parsedJson: unknown, atlas: OpaqueAtlas, atlasLess: boolean): OpaqueSkeletonData {
      // Verbatim from loader.ts:525-529.
      // In atlas-less mode, wrap the AtlasAttachmentLoader in
      // SilentSkipAttachmentLoader so spine-core silently drops orphan
      // attachments instead of throwing "Region not found in atlas" (D-09 +
      // RESEARCH.md §Pitfall 1). In canonical mode, the stock loader is
      // correct — we want the throw on a malformed atlas.
      const rawAtlas = unwrapHandle<TextureAtlas>(atlas);
      const loader = atlasLess
        ? (new SilentSkipAttachmentLoader(rawAtlas) as unknown as AtlasAttachmentLoader)
        : new AtlasAttachmentLoader(rawAtlas);
      const data = new SkeletonJson(loader).readSkeletonData(parsedJson);
      return brandHandle<OpaqueSkeletonData>(data, '4.2');
    },

    applyRotatedRegionFix(data: OpaqueSkeletonData): void {
      // Verbatim from loader.ts:531-614 (the Phase-33 rotated-region patch).
      // Regression-locked — SAFE-02 byte-gates this via the spine_rotated
      // frozen baseline. DO NOT alter a single argument, variable, or formula.
      //
      // This method always performs the fix when called. The caller (loader.ts)
      // already provides the !isAtlasLess gate before calling.
      //
      // ASSUMES region.degrees === 90 only. Spine editor never emits 180/270
      // in 4.2; if a future export surfaces non-90° rotation, this path
      // silently misbehaves (deferred per CONTEXT Out-of-Scope).
      const skeletonData = unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>>(data);
      for (const skin of skeletonData.skins) {
        // skin.attachments: StringMap<Attachment>[] — array indexed by slot.
        // Each entry (when present) is a plain object: { [attachmentName]: Attachment }.
        for (const slotMap of skin.attachments) {
          if (!slotMap) continue;
          for (const attachmentName in slotMap) {
            const attachment = slotMap[attachmentName];
            if (!(attachment instanceof RegionAttachment)) continue;
            const region = attachment.region;
            if (!region || region.degrees === 0) continue;

            const w = attachment.width;
            const h = attachment.height;
            const x = attachment.x;
            const y = attachment.y;
            const scaleX = attachment.scaleX;
            const scaleY = attachment.scaleY;
            const rotation = attachment.rotation;

            const radians = (rotation * Math.PI) / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);

            // Canonical (post-swap) regionScaleX/Y. originalWidth/originalHeight
            // are canonical per libgdx convention (verified: TextureAtlas.js:87-93).
            const rsX = (w / region.originalWidth) * scaleX;
            const rsY = (h / region.originalHeight) * scaleY;

            const localX = (-w / 2) * scaleX + region.offsetX * rsX;
            const localY = (-h / 2) * scaleY + region.offsetY * rsY;

            // SWAP — verified at 33-RESEARCH.md §"D-01 Formula Derivation" probe:
            //   localX2 uses region.height (PACKED H = post-rot canonical W);
            //   localY2 uses region.width  (PACKED W = post-rot canonical H).
            const localX2 = localX + region.height * rsX;
            const localY2 = localY + region.width * rsY;

            const lXc = localX * cos + x;
            const lXs = localX * sin;
            const lYc = localY * cos + y;
            const lYs = localY * sin;
            const lX2c = localX2 * cos + x;
            const lX2s = localX2 * sin;
            const lY2c = localY2 * cos + y;
            const lY2s = localY2 * sin;

            const off = attachment.offset;
            off[0] = lXc - lYs;
            off[1] = lYc + lXs;
            off[2] = lXc - lY2s;
            off[3] = lY2c + lXs;
            off[4] = lX2c - lY2s;
            off[5] = lY2c + lX2s;
            off[6] = lX2c - lYs;
            off[7] = lYc + lX2s;
            // Note: do NOT touch attachment.uvs — spine-core wrote correct
            // rotated-UVs at parse time (RegionAttachment.js:109-117).
          }
        }
      }
    },

    // ── sampler-side (lifecycle) ─────────────────────────────────────────────

    makeSkeleton(data: OpaqueSkeletonData): OpaqueSkeleton {
      // Verbatim from sampler.ts:160: new Skeleton(load.skeletonData)
      const sk = new Skeleton(unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>>(data));
      return brandHandle<OpaqueSkeleton>(sk, '4.2');
    },

    makeAnimationState(data: OpaqueSkeletonData): OpaqueAnimationState {
      // Verbatim from sampler.ts:161-162: new AnimationState(new AnimationStateData(load.skeletonData))
      const stateData = new AnimationStateData(
        unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>>(data),
      );
      const st = new AnimationState(stateData);
      return brandHandle<OpaqueAnimationState>(st, '4.2');
    },

    skins(data: OpaqueSkeletonData): OpaqueSkin[] {
      return unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>>(data).skins.map(
        (s) => brandHandle<OpaqueSkin>(s, '4.2'),
      );
    },

    animations(data: OpaqueSkeletonData): OpaqueAnimation[] {
      return unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>>(data).animations.map(
        (a) => brandHandle<OpaqueAnimation>(a, '4.2'),
      );
    },

    animationDuration(anim: OpaqueAnimation): number {
      return (unwrapHandle<{ duration: number }>(anim)).duration;
    },

    animationName(anim: OpaqueAnimation): string {
      return (unwrapHandle<{ name: string }>(anim)).name;
    },

    attachmentTimelineNames(anim: OpaqueAnimation): Set<string> {
      // VERBATIM from sampler.ts:294-300.
      // Returns the `${slotIndex}/${attachmentName}` pairs named by every
      // AttachmentTimeline in this animation (D-54 affected set). Lets
      // sampler.ts drop its spine-core AttachmentTimeline import (RT-02 Q1).
      const a = unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>['animations'][0]>(anim);
      const out = new Set<string>();
      for (const tl of a.timelines) {
        if (tl instanceof AttachmentTimeline) {
          for (const name of tl.attachmentNames) {
            if (name !== null) out.add(`${tl.slotIndex}/${name}`);
          }
        }
      }
      return out;
    },

    skinName(skin: OpaqueSkin): string {
      return (unwrapHandle<{ name: string }>(skin)).name;
    },

    setSkin(sk: OpaqueSkeleton, skin: OpaqueSkin): void {
      // Verbatim from sampler.ts:165: skeleton.setSkin(skin)
      // unwrapHandle returns unknown cast to the generic; cast to the 4.2 Skin type.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      unwrapHandle<Skeleton>(sk).setSkin(unwrapHandle<any>(skin));
    },

    setupPose(sk: OpaqueSkeleton): void {
      // Verbatim from sampler.ts:170: skeleton.setToSetupPose()
      unwrapHandle<Skeleton>(sk).setToSetupPose();
    },

    setupPoseSlots(sk: OpaqueSkeleton): void {
      // Verbatim from sampler.ts:166: skeleton.setSlotsToSetupPose()
      unwrapHandle<Skeleton>(sk).setSlotsToSetupPose();
    },

    clearTracks(st: OpaqueAnimationState): void {
      unwrapHandle<AnimationState>(st).clearTracks();
    },

    setAnimation(st: OpaqueAnimationState, track: number, anim: OpaqueAnimation, loop: boolean): void {
      // CRITICAL 4.2 split (RESEARCH § Pattern 1): `setAnimation` takes a string
      // in 4.2.111; `setAnimationWith` takes the Animation object. The interface
      // maps `setAnimation(st,track,anim,loop)` → this method; the 4.2 body
      // MUST call `setAnimationWith` (not `setAnimation`).
      // Verbatim from sampler.ts:308: state.setAnimationWith(0, anim, false)
      unwrapHandle<AnimationState>(st).setAnimationWith(
        track,
        unwrapHandle<ReturnType<SkeletonJson['readSkeletonData']>['animations'][0]>(anim),
        loop,
      );
    },

    stateUpdate(st: OpaqueAnimationState, dt: number): void {
      // Verbatim from sampler.ts:319: state.update(dt)
      unwrapHandle<AnimationState>(st).update(dt);
    },

    stateApply(st: OpaqueAnimationState, sk: OpaqueSkeleton): void {
      // Verbatim from sampler.ts:320: state.apply(skeleton)
      unwrapHandle<AnimationState>(st).apply(unwrapHandle<Skeleton>(sk));
    },

    skeletonUpdate(sk: OpaqueSkeleton, dt: number): void {
      // Verbatim from sampler.ts:321: skeleton.update(dt)
      unwrapHandle<Skeleton>(sk).update(dt);
    },

    updateWorldTransform(sk: OpaqueSkeleton, mode: 'pose' | 'reset' | 'update'): void {
      // Verbatim from sampler.ts:172/311/322: skeleton.updateWorldTransform(Physics.X)
      const physicsMode =
        mode === 'pose'   ? Physics.pose   :
        mode === 'reset'  ? Physics.reset  :
                            Physics.update;
      unwrapHandle<Skeleton>(sk).updateWorldTransform(physicsMode);
    },

    // ── visibility / iteration ───────────────────────────────────────────────

    slots(sk: OpaqueSkeleton): OpaqueSlot[] {
      // Verbatim: skeleton.slots
      return unwrapHandle<Skeleton>(sk).slots.map(
        (s) => brandHandle<OpaqueSlot>(s, '4.2'),
      );
    },

    slotName(slot: OpaqueSlot): string {
      // Verbatim: slot.data.name
      return (unwrapHandle<{ data: { name: string } }>(slot)).data.name;
    },

    slotAttachment(slot: OpaqueSlot): OpaqueAttachment | null {
      // Verbatim from sampler.ts snapshotFrame:608: slot.getAttachment()
      const a = (unwrapHandle<{ getAttachment: () => { name: string } | null }>(slot)).getAttachment();
      return a == null ? null : brandHandle<OpaqueAttachment>(a, '4.2');
    },

    slotColorAlpha(slot: OpaqueSlot): number {
      // Verbatim from sampler.ts snapshotFrame:615: slot.color.a
      return (unwrapHandle<{ color: { a: number } }>(slot)).color.a;
    },

    attachmentName(a: OpaqueAttachment): string {
      // Verbatim from sampler.ts snapshotFrame: attachment.name (base
      // Attachment.name). Q1 strictly-additive accessor (RT-02).
      return (unwrapHandle<{ name: string }>(a)).name;
    },

    skinEntries(skin: OpaqueSkin): { slotIndex: number; name: string; attachment: OpaqueAttachment }[] {
      // Verbatim from sampler.ts:228: skin.getAttachments()
      return (unwrapHandle<{
        getAttachments: () => Array<{ slotIndex: number; name: string; attachment: object }>;
      }>(skin))
        .getAttachments()
        .map((e) => ({
          slotIndex: e.slotIndex,
          name: e.name,
          attachment: brandHandle<OpaqueAttachment>(e.attachment, '4.2'),
        }));
    },

    // ── bounds math ──────────────────────────────────────────────────────────

    attachmentKind(a: OpaqueAttachment): 'region' | 'mesh' | 'vertex' | 'skip' {
      // Own-runtime instanceof in the LOCKED ORDER (bounds.ts:49-58 rationale).
      // Skip-list MUST be tested BEFORE the generic VertexAttachment branch
      // because BoundingBox/Path/Point/Clipping all extend VertexAttachment.
      const att = unwrapHandle<object>(a);
      if (att instanceof RegionAttachment)       return 'region';
      if (
        att instanceof BoundingBoxAttachment ||
        att instanceof PathAttachment ||
        att instanceof PointAttachment ||
        att instanceof ClippingAttachment
      )                                           return 'skip';
      if (att instanceof MeshAttachment)          return 'mesh';
      if (att instanceof VertexAttachment)        return 'vertex';
      return 'skip';
    },

    regionWorldVertices(slot: OpaqueSlot, a: OpaqueAttachment): Float32Array {
      // VERBATIM from bounds.ts:65-67.
      const s   = unwrapHandle<Parameters<RegionAttachment['computeWorldVertices']>[0]>(slot);
      const att = unwrapHandle<RegionAttachment>(a);
      const v   = new Float32Array(8);
      att.computeWorldVertices(s, v, 0, 2);
      return v;
    },

    vertexWorldVertices(sk: OpaqueSkeleton, slot: OpaqueSlot, a: OpaqueAttachment): Float32Array {
      // VERBATIM from bounds.ts:84-88.
      // NOTE: `sk` is threaded in but NOT used in the 4.2.111 call shape —
      // 4.2's VertexAttachment.computeWorldVertices takes
      // (slot, start, count, wv, offset, stride). The `sk` argument is accepted
      // here to match the interface; 4.3 needs it as the first arg. 4.2 ignores it.
      void sk; // intentionally unused — 4.2 call shape does not take skeleton
      const s   = unwrapHandle<Parameters<VertexAttachment['computeWorldVertices']>[0]>(slot);
      const att = unwrapHandle<VertexAttachment>(a);
      const n   = att.worldVerticesLength;
      if (n <= 0) return new Float32Array(0);
      const v = new Float32Array(n);
      att.computeWorldVertices(s, 0, n, v, 0, 2);
      return v;
    },

    boneAxisScale(slot: OpaqueSlot): { x: number; y: number } {
      // VERBATIM from bounds.ts:395-397 (boneAxisScales function).
      const bone = (unwrapHandle<{ bone: { getWorldScaleX: () => number; getWorldScaleY: () => number } }>(slot)).bone;
      return { x: Math.abs(bone.getWorldScaleX()), y: Math.abs(bone.getWorldScaleY()) };
    },

    attachmentRegionMeta(a: OpaqueAttachment): {
      name?: string; pageW?: number; pageH?: number;
      originalW?: number; originalH?: number; canonW?: number; canonH?: number;
    } | null {
      // VERBATIM from bounds.ts:219-227 + :274-279.
      // Returns null if the attachment has no region.
      const att = unwrapHandle<{
        region?: {
          name?: string;
          page?: { width?: number; height?: number };
          texture?: { page?: { width?: number; height?: number } };
          originalWidth?: number;
          originalHeight?: number;
        } | null;
        width?: number;
        height?: number;
      }>(a);
      const region = att.region;
      if (!region) return null;
      const page = region.page ?? region.texture?.page;
      return {
        name:      region.name,
        pageW:     page?.width,
        pageH:     page?.height,
        originalW: region.originalWidth,
        originalH: region.originalHeight,
        canonW:    att.width,
        canonH:    att.height,
      };
    },

    attachmentUVs(a: OpaqueAttachment): Float32Array | null {
      // VERBATIM from bounds.ts:230: attachment.uvs
      const att = unwrapHandle<{ uvs?: Float32Array | null }>(a);
      return att.uvs ?? null;
    },

    sequenceRegions(a: OpaqueAttachment): { name: string }[] | null {
      // From sampler.ts:352-405 fan-out reads a.sequence?.regions
      const att = unwrapHandle<{
        sequence?: {
          regions?: ReadonlyArray<{ name?: string } | null | undefined> | null;
        } | null;
      }>(a);
      const seq = att.sequence;
      if (!seq || !seq.regions || seq.regions.length === 0) return null;
      const result: { name: string }[] = [];
      for (const r of seq.regions) {
        if (r && r.name != null && r.name !== '') {
          result.push({ name: r.name });
        }
      }
      return result.length > 0 ? result : null;
    },
  };
}
