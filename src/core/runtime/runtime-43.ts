// src/core/runtime/runtime-43.ts — Phase 43 RT-02 / PORT-01 / PORT-02 / PORT-03
//
// Verified 4.3.0 Pose-API port of the SpineRuntime interface. Analog =
// runtime-42.ts (same interface, same wrapper shape). The ONLY differences:
//   (a) Import source: '@esotericsoftware/spine-core' (4.3.0 canonical)
//   (b) Per-method API mapping per 43-RESEARCH.md §"Verified 4.3.0 ↔ 4.2.111"
//   (c) D-03 structural defense: appliedPose-only world reads + dev assertion
//
// Sanctioned import carve-out: this file and runtime-42.ts are the ONLY two
// src/core/ files permitted to import a spine-core package (Phase 43 RT-02
// arch contract; enforced by tests/arch.spec.ts RT-02 anchor).
//
// D-03 (T-43-07): the interface exposes boneAxisScale(slot) only — no
// OpaqueBone ever crosses the facade, so a pre-constraint world-scale read is
// unreachable through the adapter surface by construction. A dev-mode assertion
// additionally guards against an upstream refactor silently collapsing
// appliedPose === pose. See: 43-RESEARCH.md §Pitfall 1, §D-03 structural defense.
//
// PORT-02 (T-43-08): MeshAttachment.region AND RegionAttachment.region are GONE
// in 4.3 (both implement HasSequence, not HasTextureRegion). All
// attachmentRegionMeta / attachmentUVs / sequenceRegions reads route through
// a.sequence.regions[idx] using the pose-independent single-region/setupIndex
// resolution. Zero direct .region member accesses outside comments.

import {
  Skeleton,
  AnimationState,
  AnimationStateData,
  Physics,
  AttachmentTimeline,
  AtlasAttachmentLoader,
  SkeletonJson,
  TextureAtlas,
  FakeTexture,
  RegionAttachment,
  MeshAttachment,
  VertexAttachment,
  BoundingBoxAttachment,
  PathAttachment,
  PointAttachment,
  ClippingAttachment,
} from '@esotericsoftware/spine-core';
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
import { normalizeSpine43ConstraintMixDefaults } from '../../shared/spine43-constraint-mix-normalize.js';

// ─── Internal type aliases ───────────────────────────────────────────────────
//
// These are structural aliases only — they let the body read clearly without
// importing every concrete spine-core 4.3 type. unwrapHandle<T> casts to T;
// the alias documents intent. Use InstanceType or structural shapes.

type Slot43              = InstanceType<typeof Skeleton>['slots'][0];
// Animation43: structural shape matching 4.3 Animation (timelines, duration, name)
type Animation43         = { timelines: unknown[]; duration: number; name: string };
type Skin43              = InstanceType<typeof Skeleton>['data']['skins'][0];
type SkeletonData43      = InstanceType<typeof Skeleton>['data'];
type RegionAttachment43  = InstanceType<typeof RegionAttachment>;
type VertexAttachment43  = InstanceType<typeof VertexAttachment>;
type SkeletonInstance    = InstanceType<typeof Skeleton>;

// ─── Factory ─────────────────────────────────────────────────────────────────

export function create(): SpineRuntime {
  return {
    tag: '4.3' as RuntimeTag,

    // ── loader-side (parse) ──────────────────────────────────────────────────

    makeAtlas(atlasText: string): OpaqueAtlas {
      // Source: TextureAtlas.d.ts:35; Texture.d.ts:67 (FakeTexture).
      // CLAUDE.md Fact #4 — math phase does not decode PNGs. FakeTexture is the
      // 4.3.0-native no-op stub (no-arg constructor, all methods are no-ops).
      const atlas = new TextureAtlas(atlasText);
      for (const page of atlas.pages) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        page.setTexture(new FakeTexture(null as any));
      }
      return brandHandle<OpaqueAtlas>(atlas, '4.3');
    },

    parseSkeleton(parsedJson: unknown, atlas: OpaqueAtlas, atlasLess: boolean): OpaqueSkeletonData {
      // Source: SkeletonJson.d.ts:47,48 — readSkeletonData signature identical to 4.2.
      // SilentSkipAttachmentLoader extends the 4.2 AtlasAttachmentLoader; the
      // 4.3 AtlasAttachmentLoader interface is structurally compatible for our
      // use (atlas-less branch is not exercised by the 4.3 owner rig). The
      // `as unknown as AtlasAttachmentLoader` cast mirrors runtime-42.ts and is
      // the single sanctioned boundary cast (RESEARCH §Pattern 1 note).
      const rawAtlas = unwrapHandle<InstanceType<typeof TextureAtlas>>(atlas);
      const loader = atlasLess
        ? (new SilentSkipAttachmentLoader(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            rawAtlas as any,
          ) as unknown as AtlasAttachmentLoader)
        : new AtlasAttachmentLoader(rawAtlas);
      // debug-fix viewer-43-42-constraint-parse (2026-05-19): mirror
      // spine-core@4.3.0 SkeletonJson chained mix{Y,ScaleY} <- mix{X,ScaleX}
      // defaults at the JSON level so a secondary-axis-only transform
      // constraint (y/scaleY output, no x/scaleX output, no explicit mixY/
      // mixScaleY) does not collapse to mix=0 and silently kill the IK chain
      // it drives. Shared chokepoint with the 4.3 viewer leg
      // (AnimationPlayerModal.tsx) so the Scale table and viewer cannot
      // diverge. In-place, idempotent, never overwrites an author-set mix;
      // a non-4.3 / constraints-array-less parsedJson is a structural no-op.
      normalizeSpine43ConstraintMixDefaults(parsedJson);
      const data = new SkeletonJson(loader).readSkeletonData(parsedJson);
      return brandHandle<OpaqueSkeletonData>(data, '4.3');
    },

    applyRotatedRegionFix(data: OpaqueSkeletonData): void {
      // PORT-03 Approach B (Assumptions Log A1 — Approach A FALSIFIED by 43-05).
      //
      // Approach A (verify-then-no-op) HYPOTHESIZED that 4.3's native
      // Sequence.update → computeUVs already produces correct rotated-region
      // offsets, making this a no-op. 43-05's empirical rotated-region
      // validation FALSIFIED that: the 4.3 native offsets for the rotate:90
      // TRIANGLE region diverged from the same-hash same-geometry 4.2-sibling
      // known-good by ~32px in worldY/worldH (well beyond the 1e-4 ground
      // truth) — exactly the Phase-33-class rotated-region undersize bug, NOT
      // fixed natively in 4.3 for this packed-dim layout.
      //
      // Approach B (RESEARCH §PORT-03 (B)): re-express Phase-33's correction
      // through the Sequence. 4.3 RegionAttachment has NO mutable offset[]
      // member — offsets flow through getOffsets(pose) →
      // sequence.offsets[resolveIndex(pose)] (RegionAttachment.js:103-106).
      // So we (1) call attachment.updateSequence() to ALLOCATE
      // sequence.offsets (Sequence.js:83-103 populates offsets[i] per region),
      // then (2) OVERWRITE the 8 floats in EVERY sequence.offsets[i] with the
      // SAME corrected-offset SWAP-form math as runtime-42.applyRotatedRegionFix
      // (loader.ts:552-613 verbatim) — only the write TARGET changes
      // (sequence.offsets[i] instead of attachment.offset[]); the formula is
      // byte-identical. getOffsets(pose) then returns the corrected array for
      // every pose/index. The 4.2 path is UNCHANGED (runtime-42 still does the
      // verbatim Phase-33 offset[] write; SAFE-02 byte-gates it).
      const skeletonData = unwrapHandle<SkeletonData43>(data);
      for (const skin of skeletonData.skins) {
        // skin.attachments: StringMap<Attachment>[] — array indexed by slot.
        for (const slotMap of skin.attachments) {
          if (!slotMap) continue;
          for (const attachmentName in slotMap) {
            const attachment = slotMap[attachmentName];
            if (!(attachment instanceof RegionAttachment)) continue;
            const ra = attachment as RegionAttachment43;
            const seq = ra.sequence;
            if (!seq || !seq.regions || seq.regions.length === 0) continue;

            // Allocate sequence.offsets[i]/uvs[i] for every region (no-op-safe
            // if already updated). Sequence.update(attachment) computes the
            // native (incorrect-for-rotated) offsets we are about to overwrite.
            ra.updateSequence();
            const offsets = (seq as unknown as { offsets?: number[][] }).offsets;
            if (!offsets) continue;

            for (let i = 0; i < seq.regions.length; i++) {
              const region = seq.regions[i] as unknown as {
                degrees: number;
                width: number;
                height: number;
                originalWidth: number;
                originalHeight: number;
                offsetX: number;
                offsetY: number;
              } | null;
              // Same skip semantic as runtime-42: only rotated regions need
              // the correction (region.degrees !== 0). degrees === 0 keeps
              // 4.3's native (correct, non-rotated) offsets untouched.
              if (!region || region.degrees === 0) continue;
              const off = offsets[i];
              if (!off || off.length < 8) continue;

              // ── SWAP-form corrected-offset math — VERBATIM from
              // runtime-42.applyRotatedRegionFix (loader.ts:552-613). DO NOT
              // alter a single argument, variable, or formula: SAFE-02 +
              // the A1 1e-4 ground truth gate this byte-for-byte against the
              // 4.2 path.
              const w = ra.width;
              const h = ra.height;
              const x = ra.x;
              const y = ra.y;
              const scaleX = ra.scaleX;
              const scaleY = ra.scaleY;
              const rotation = ra.rotation;

              const radians = (rotation * Math.PI) / 180;
              const cos = Math.cos(radians);
              const sin = Math.sin(radians);

              const rsX = (w / region.originalWidth) * scaleX;
              const rsY = (h / region.originalHeight) * scaleY;

              const localX = (-w / 2) * scaleX + region.offsetX * rsX;
              const localY = (-h / 2) * scaleY + region.offsetY * rsY;

              // SWAP — localX2 uses region.height (PACKED H = post-rot
              // canonical W); localY2 uses region.width (PACKED W = post-rot
              // canonical H). Verified 33-RESEARCH.md §"D-01 Formula".
              // BYTE-FAITHFUL to runtime-42.applyRotatedRegionFix: same
              // packed-bounds fields (region.height / region.width), NOT
              // originalWidth/Height (they coincide only when strip-whitespace
              // is off; the 4.2 path uses the packed dims, so we must too).
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

              off[0] = lXc - lYs;
              off[1] = lYc + lXs;
              off[2] = lXc - lY2s;
              off[3] = lY2c + lXs;
              off[4] = lX2c - lY2s;
              off[5] = lY2c + lX2s;
              off[6] = lX2c - lYs;
              off[7] = lYc + lX2s;
            }
          }
        }
      }
    },

    // ── sampler-side (lifecycle) ─────────────────────────────────────────────

    makeSkeleton(data: OpaqueSkeletonData): OpaqueSkeleton {
      // Source: Skeleton.d.ts — constructor takes SkeletonData (identical to 4.2).
      const sk = new Skeleton(unwrapHandle<SkeletonData43>(data));
      return brandHandle<OpaqueSkeleton>(sk, '4.3');
    },

    makeAnimationState(data: OpaqueSkeletonData): OpaqueAnimationState {
      // Source: AnimationState.d.ts — AnimationStateData + AnimationState (identical names).
      const stateData = new AnimationStateData(unwrapHandle<SkeletonData43>(data));
      const st = new AnimationState(stateData);
      return brandHandle<OpaqueAnimationState>(st, '4.3');
    },

    skins(data: OpaqueSkeletonData): OpaqueSkin[] {
      // Source: SkeletonData.d.ts:46 — data.skins (Skin[]).
      return unwrapHandle<SkeletonData43>(data).skins.map(
        (s) => brandHandle<OpaqueSkin>(s, '4.3'),
      );
    },

    animations(data: OpaqueSkeletonData): OpaqueAnimation[] {
      // Source: SkeletonData.d.ts:55 — data.animations (Animation[]).
      return unwrapHandle<SkeletonData43>(data).animations.map(
        (a) => brandHandle<OpaqueAnimation>(a, '4.3'),
      );
    },

    animationDuration(anim: OpaqueAnimation): number {
      return (unwrapHandle<{ duration: number }>(anim)).duration;
    },

    animationName(anim: OpaqueAnimation): string {
      return (unwrapHandle<{ name: string }>(anim)).name;
    },

    attachmentTimelineNames(anim: OpaqueAnimation): Set<string> {
      // Source: Animation.d.ts:390-393 — AttachmentTimeline.slotIndex (number),
      // AttachmentTimeline.attachmentNames (Array<string | null>). Shape identical to 4.2.
      // Returns the `${slotIndex}/${attachmentName}` pairs for the D-54 affected set.
      // Lets sampler.ts drop its spine-core AttachmentTimeline import (RT-02 Q1).
      const a = unwrapHandle<Animation43>(anim);
      const out = new Set<string>();
      for (const tl of (a as unknown as { timelines: unknown[] }).timelines) {
        if (tl instanceof AttachmentTimeline) {
          for (const name of tl.attachmentNames) {
            if (name !== null) out.add(`${tl.slotIndex}/${name}`);
          }
        }
      }
      return out;
    },

    skinName(skin: OpaqueSkin): string {
      // Source: Skin.d.ts — skin.name (identical to 4.2).
      return (unwrapHandle<{ name: string }>(skin)).name;
    },

    setSkin(sk: OpaqueSkeleton, skin: OpaqueSkin): void {
      // Source: Skeleton.d.ts:141 — setSkin(skin: Skin | null) overload.
      unwrapHandle<SkeletonInstance>(sk).setSkin(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        unwrapHandle<Skin43>(skin) as any,
      );
    },

    setupPose(sk: OpaqueSkeleton): void {
      // Source: Skeleton.d.ts:115 — setupPose() (4.3 name; 4.2 used setToSetupPose).
      unwrapHandle<SkeletonInstance>(sk).setupPose();
    },

    setupPoseSlots(sk: OpaqueSkeleton): void {
      // Source: Skeleton.d.ts:119 — setupPoseSlots() (4.3 name; 4.2 used setSlotsToSetupPose).
      unwrapHandle<SkeletonInstance>(sk).setupPoseSlots();
    },

    clearTracks(st: OpaqueAnimationState): void {
      // Source: AnimationState.d.ts:79 — clearTracks() (identical name to 4.2).
      unwrapHandle<AnimationState>(st).clearTracks();
    },

    setAnimation(st: OpaqueAnimationState, track: number, anim: OpaqueAnimation, loop: boolean): void {
      // Source: AnimationState.d.ts:98 — the overloaded setAnimation(trackIndex, animation, loop?)
      // that takes an Animation object (NOT a string). This is the 4.3 unified overload;
      // the 4.2 split method (which took the object) no longer exists in 4.3.
      unwrapHandle<AnimationState>(st).setAnimation(
        track,
        unwrapHandle<Animation43>(anim) as unknown as Parameters<AnimationState['setAnimation']>[1],
        loop,
      );
    },

    stateUpdate(st: OpaqueAnimationState, dt: number): void {
      // Source: AnimationState.d.ts:59 — update(delta) (identical to 4.2).
      unwrapHandle<AnimationState>(st).update(dt);
    },

    stateApply(st: OpaqueAnimationState, sk: OpaqueSkeleton): void {
      // Source: AnimationState.d.ts:65 — apply(skeleton) (identical to 4.2).
      unwrapHandle<AnimationState>(st).apply(unwrapHandle<SkeletonInstance>(sk));
    },

    skeletonUpdate(sk: OpaqueSkeleton, dt: number): void {
      // Source: Skeleton.d.ts:199 — update(delta) (identical to 4.2).
      unwrapHandle<SkeletonInstance>(sk).update(dt);
    },

    updateWorldTransform(sk: OpaqueSkeleton, mode: 'pose' | 'reset' | 'update'): void {
      // Source: Skeleton.d.ts:113 — updateWorldTransform(physics: Physics) (identical to 4.2).
      // Physics enum is unchanged between 4.2 and 4.3.
      const physicsMode =
        mode === 'pose'   ? Physics.pose   :
        mode === 'reset'  ? Physics.reset  :
                            Physics.update;
      unwrapHandle<SkeletonInstance>(sk).updateWorldTransform(physicsMode);
    },

    // ── visibility / iteration ───────────────────────────────────────────────

    slots(sk: OpaqueSkeleton): OpaqueSlot[] {
      // Source: Skeleton.d.ts:56 — readonly slots: Array<Slot>.
      return unwrapHandle<SkeletonInstance>(sk).slots.map(
        (s) => brandHandle<OpaqueSlot>(s, '4.3'),
      );
    },

    slotName(slot: OpaqueSlot): string {
      // Source: Slot.d.ts:38, Posed.d.ts:38 — slot.data.name.
      return (unwrapHandle<{ data: { name: string } }>(slot)).data.name;
    },

    slotAttachment(slot: OpaqueSlot): OpaqueAttachment | null {
      // Source: SlotPose.d.ts:41 — slot.pose.attachment (SlotPose.attachment).
      // In 4.3, Slot extends Posed<SlotData,SlotPose>; slot.pose is the unconstrained
      // SlotPose. The attachment binding IS the applied slot attachment (SlotPose is
      // the applied attachment binding — confirmed). Note: NO slot.getAttachment() in 4.3.
      const a = unwrapHandle<Slot43>(slot).pose.attachment;
      return a == null ? null : brandHandle<OpaqueAttachment>(a, '4.3');
    },

    slotColorAlpha(slot: OpaqueSlot): number {
      // Source: SlotPose.d.ts:36 — slot.pose.color.a.
      // In 4.3, Slot itself declares NO color — only SlotPose does (D-03 parallel).
      return (unwrapHandle<Slot43>(slot).pose as unknown as { color: { a: number } }).color.a;
    },

    attachmentName(a: OpaqueAttachment): string {
      // Source: Attachment.d.ts — attachment.name (base Attachment, identical
      // to 4.2). Q1 strictly-additive accessor (RT-02); no reshape.
      return (unwrapHandle<{ name: string }>(a)).name;
    },

    skinEntries(skin: OpaqueSkin): { slotIndex: number; name: string; attachment: OpaqueAttachment }[] {
      // Source: Skin.d.ts:70 — getAttachments() → Array<SkinEntry>;
      // SkinEntry (Skin.d.ts:35-41) has fields: slotIndex, placeholder, attachment.
      // NOTE: In 4.3 the field is `placeholder` not `name` (verified Skin.d.ts:38).
      // We normalize to `name` here per the interface contract.
      return (unwrapHandle<Skin43>(skin) as unknown as {
        getAttachments: () => Array<{ slotIndex: number; placeholder: string; attachment: object }>;
      })
        .getAttachments()
        .map((e) => ({
          slotIndex: e.slotIndex,
          name: e.placeholder,       // 4.3: SkinEntry.placeholder → normalized to .name
          attachment: brandHandle<OpaqueAttachment>(e.attachment, '4.3'),
        }));
    },

    // ── bounds math ──────────────────────────────────────────────────────────

    attachmentKind(a: OpaqueAttachment): 'region' | 'mesh' | 'vertex' | 'skip' {
      // Own-runtime instanceof in the LOCKED ORDER (bounds.ts:49-58 rationale).
      // Skip-list MUST be tested BEFORE the generic VertexAttachment branch
      // because BoundingBox/Path/Point/Clipping all extend VertexAttachment.
      // These are 4.3.0's own classes — each adapter only ever sees ITS OWN
      // runtime's objects (the loader stamped the handle via brandHandle(.,'4.3')).
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
      // Source: RegionAttachment.d.ts:69 — computeWorldVertices(slot, vertexOffsets, wv, offset, stride).
      // The vertexOffsets is the 2nd arg in 4.3 (NOT in 4.2 where it was the 1st positional).
      // getOffsets(pose) returns sequence.offsets[resolveIndex(pose)] — a pre-allocated
      // number[8] that is sequence-owned (RegionAttachment.js:103-106), NOT freshly allocated.
      const s   = unwrapHandle<Slot43>(slot);
      const att = unwrapHandle<RegionAttachment43>(a);
      const off = att.getOffsets(s.pose as unknown as Parameters<RegionAttachment43['getOffsets']>[0]);
      const v   = new Float32Array(8);
      att.computeWorldVertices(s as unknown as Parameters<RegionAttachment43['computeWorldVertices']>[0], off, v, 0, 2);
      return v;
    },

    vertexWorldVertices(sk: OpaqueSkeleton, slot: OpaqueSlot, a: OpaqueAttachment): Float32Array {
      // Source: Attachment.d.ts:77 — VertexAttachment.computeWorldVertices(skeleton, slot, start, count, wv, offset, stride).
      // In 4.3, skeleton is the 1st arg (not in 4.2 where slot was the 1st arg).
      const skel = unwrapHandle<SkeletonInstance>(sk);
      const s    = unwrapHandle<Slot43>(slot);
      const att  = unwrapHandle<VertexAttachment43>(a);
      const n    = att.worldVerticesLength;
      if (n <= 0) return new Float32Array(0);
      const v    = new Float32Array(n);
      att.computeWorldVertices(
        skel as unknown as Parameters<VertexAttachment43['computeWorldVertices']>[0],
        s    as unknown as Parameters<VertexAttachment43['computeWorldVertices']>[1],
        0, n, v, 0, 2,
      );
      return v;
    },

    boneAxisScale(slot: OpaqueSlot): { x: number; y: number } {
      // D-03 structural defense (the user's most-emphasized correctness lever).
      // Source: BonePose.d.ts:113-115 — getWorldScaleX/Y() on BonePose ONLY.
      // In 4.3, Bone itself has NO getWorldScaleX/Y — only BonePose does.
      // The interface exposes boneAxisScale(slot) (no OpaqueBone), so a raw
      // bone.pose read is unreachable through the facade BY CONSTRUCTION.
      // NEVER call bone.pose.getWorldScaleX — that reads pre-constraint geometry
      // and silently undersizes constraint rigs (Pitfall 1, T-43-07).
      const s           = unwrapHandle<Slot43>(slot);
      const appliedPose = s.bone.appliedPose;  // BonePose — render pose (post-constraint)
      if (process.env.NODE_ENV !== 'production') {
        // [Rule 1 - Bug] Plan-04's original dev-assertion threw when
        // `appliedPose === pose`. That premise is FALSIFIED by the upstream
        // 4.3 contract — `Posed` docstring (node_modules/@esotericsoftware/
        // spine-core/dist/Posed.d.ts:33-35, verified 2026-05-17):
        //
        //   "appliedPose: The pose to use for rendering. If no constraints
        //    modify this pose, this is the same as pose. Otherwise it is a
        //    copy of pose modified by constraints."
        //
        // So `appliedPose === pose` is the NORMAL, CORRECT state for every
        // bone NOT touched by a constraint (the common case — CIRCLE, the
        // root, etc.). The old assertion threw on every unconstrained bone,
        // making the 4.3 sampler unrunnable (Task-1 blocker). The D-03
        // structural defense is NOT "appliedPose must differ from pose" — it
        // is "ALWAYS read the render pose (`appliedPose`), NEVER the
        // unconstrained `pose`", which the facade already guarantees by
        // construction (it exposes only boneAxisScale(slot); no OpaqueBone
        // ⇒ a raw `bone.pose` read is unreachable from bounds.ts/sampler.ts).
        //
        // The retained guard verifies the structural invariant that actually
        // matters: we read `appliedPose` (the render pose) and it is a usable
        // BonePose exposing the world-scale accessors. A regression that
        // collapsed `appliedPose` to `undefined`/`null` (an upstream API
        // break) is the real silent-undersize risk this catches.
        if (
          appliedPose == null ||
          typeof appliedPose.getWorldScaleX !== 'function' ||
          typeof appliedPose.getWorldScaleY !== 'function'
        ) {
          throw new Error(
            'runtime-43 D-03: bone.appliedPose is not a usable BonePose ' +
              '(missing getWorldScaleX/Y) — the render-pose world-scale read ' +
              'is broken; constraint rigs would silently undersize.',
          );
        }
      }
      return { x: Math.abs(appliedPose.getWorldScaleX()), y: Math.abs(appliedPose.getWorldScaleY()) };
    },

    attachmentRegionMeta(a: OpaqueAttachment): {
      name?: string; pageW?: number; pageH?: number;
      originalW?: number; originalH?: number; canonW?: number; canonH?: number;
    } | null {
      // PORT-02 NEW FINDING: MeshAttachment.region AND RegionAttachment.region are
      // GONE in 4.3. Both implement HasSequence (not HasTextureRegion). All region
      // access routes through a.sequence.regions[idx].
      //
      // Pose-independent single-region/setupIndex resolution (RESEARCH PORT-02 +
      // Assumptions Log A3): for non-sequence attachments (the common case in the
      // hull-area path), sequence.regions has exactly 1 entry and idx=0 is correct.
      // For setup-index (multi-region), setupIndex is the pose-independent default.
      // Sequence attachments have a dedicated fan-out post-pass in sampler.ts
      // (sampler.ts:352-405) that handles per-frame regions separately, so the
      // hull path only needs the setup/single region. This keeps the locked
      // (a)-only interface signature valid — NO interface change required.
      const att = unwrapHandle<{
        sequence: {
          regions: Array<{ name?: string; page?: { width?: number; height?: number }; originalWidth?: number; originalHeight?: number } | null>;
          setupIndex: number;
        };
        width?: number;
        height?: number;
      }>(a);
      const seq = att.sequence;
      if (!seq || !seq.regions || seq.regions.length === 0) return null;
      const idx = seq.regions.length === 1 ? 0 : seq.setupIndex;
      const reg = seq.regions[idx];
      if (!reg) return null;
      return {
        name:      reg.name,
        pageW:     reg.page?.width,
        pageH:     reg.page?.height,
        originalW: reg.originalWidth,
        originalH: reg.originalHeight,
        canonW:    att.width,
        canonH:    att.height,
      };
    },

    attachmentUVs(a: OpaqueAttachment): Float32Array | null {
      // PORT-02: NO att.uvs in 4.3. Route through sequence.
      // For RegionAttachment: use sequence.getUVs(idx) (Sequence.d.ts:63) —
      //   already PAGE-space (Sequence.update → RegionAttachment.computeUVs);
      //   this branch is CORRECT and UNTOUCHED.
      // For MeshAttachment: see the page-space correction below.
      // Detect RegionAttachment vs MeshAttachment via instanceof.
      const att = unwrapHandle<object>(a);
      if (att instanceof RegionAttachment) {
        const ra = att as RegionAttachment43;
        const seq = ra.sequence;
        if (!seq) return null;
        const idx = seq.regions.length === 1 ? 0 : seq.setupIndex;
        try {
          return seq.getUVs(idx) as Float32Array;
        } catch {
          return null;
        }
      }
      if (att instanceof MeshAttachment) {
        // [Rule 1 - Bug] ORCL-02 silent-undersize defect (Phase-44 HARD gate).
        //
        // 4.3.0 `MeshAttachment.regionUVs` is "normalized WITHIN the texture
        // region" — region-space [0,1] inside the sub-rect (verified:
        // node_modules/@esotericsoftware/spine-core/dist/attachments/
        // MeshAttachment.d.ts:41 + the computeUVs impl, MeshAttachment.js:118).
        // bounds.ts `hullAreaRatio` (bounds.ts:223-226) requires PAGE-space
        // UVs (`sv[i] = uvs[i] * pageW`). runtime-42 satisfies this by
        // returning `att.uvs` — spine-core-42's parse-time PAGE-space UVs
        // (runtime-42.ts:433-437). 4.3.0's MeshAttachment has NO `.uvs`
        // field; returning the RAW region-space `regionUVs` inflated the
        // hull-area sourceArea by ~(page/region)² → every weighted/region
        // mesh through runtime-43 was ~2.25× UNDERSIZED (the exact
        // silent-undersize-ships class this product exists to prevent).
        //
        // FIX: produce the PAGE-space UVs the same way spine-core itself does
        // for a sequence frame (Sequence.update → MeshAttachment.computeUVs,
        // Sequence.js:94-101): `MeshAttachment.computeUVs(region, regionUVs,
        // out)` maps region-space → page-space (out[i] = region.u +
        // regionUVs[i] * (region.originalWidth / page.width), and the
        // rotation-aware variants for degrees 90/180/270). The resolved
        // page-space UVs are equivalent to runtime-42's `att.uvs`.
        //
        // Region resolution: MeshAttachment has NO `.region` member in 4.3
        // (it implements HasSequence, not HasTextureRegion). Resolve it via
        // `sequence.regions[idx]` using the SAME pose-independent
        // single-region/setupIndex resolution `attachmentRegionMeta`
        // (runtime-43.ts:522-526) and the RegionAttachment branch above use
        // (Sequence attachments get a dedicated per-frame fan-out in
        // sampler.ts; the hull path only needs the setup/single region).
        const ma = att as InstanceType<typeof MeshAttachment>;
        const regionUVs = ma.regionUVs;
        if (!regionUVs || regionUVs.length === 0) return null;
        const seq = (ma as unknown as {
          sequence?: {
            regions: Array<unknown | null>;
            setupIndex: number;
          };
        }).sequence;
        if (!seq || !seq.regions || seq.regions.length === 0) return null;
        const idx = seq.regions.length === 1 ? 0 : seq.setupIndex;
        const region = seq.regions[idx];
        if (region == null) return null;
        const out = new Float32Array(regionUVs.length);
        try {
          // MeshAttachment.computeUVs(region, regionUVs, out): page-space
          // (MeshAttachment.d.ts — static computeUVs(region, regionUVs, uvs)).
          (MeshAttachment as unknown as {
            computeUVs: (
              region: unknown,
              regionUVs: ArrayLike<number>,
              uvs: Float32Array,
            ) => void;
          }).computeUVs(region, regionUVs as ArrayLike<number>, out);
        } catch {
          return null;
        }
        return out;
      }
      return null;
    },

    sequenceRegions(a: OpaqueAttachment): { name: string }[] | null {
      // Source: Sequence.d.ts:39 — sequence.regions (Array<TextureRegion | null>).
      // TextureAtlasRegion.name (TextureAtlas.d.ts:54-67).
      //
      // [Rule 1 - Bug] CROSS-RUNTIME SEMANTIC DIVERGENCE (Plan-04 defect found
      // empirically in 43-05; the existential-undersize / total-peak-wipe
      // failure mode for the 4.3 path).
      //
      // 4.2: `RegionAttachment`/`MeshAttachment` only carry a `.sequence` when
      //   the JSON declares a `sequence:` block (a GENUINE multi-frame animated
      //   flipbook). Plain attachments have `att.sequence === undefined` →
      //   4.2's sequenceRegions returns null → fanOutSequencePeaks SKIPS them
      //   (correct: a plain attachment is not a sequence).
      //
      // 4.3: EVERY RegionAttachment/MeshAttachment `implements HasSequence` and
      //   ALWAYS has a non-optional `readonly sequence: Sequence`
      //   (HasSequence.d.ts:40, RegionAttachment.d.ts:40). For a PLAIN
      //   attachment that Sequence is a degenerate single-region HOLDER
      //   (`regions.length === 1`), NOT an animated flipbook. The Plan-04
      //   implementation returned that lone region, so fanOutSequencePeaks
      //   treated EVERY 4.3 attachment as a sequence: it re-keyed the base
      //   record onto an identical fannedKey and then `globalPeaks.delete`d
      //   the baseKey (sampler.ts:573-579) → every 4.3 peak was wiped → 0
      //   globalPeaks (verified: 4.2-sibling produced 6, 4.3 produced 0).
      //
      // Correct semantic (matches 4.2 by construction): a GENUINE animated
      // sequence has MORE THAN ONE frame region. `regions.length <= 1` is the
      // 4.3 single-region holder for a non-sequence attachment and MUST map to
      // null — exactly what 4.2 returns for the same plain attachment. Real
      // flipbooks (`sequence: { count: N>=2 }`) still fan out correctly.
      const att = unwrapHandle<{
        sequence?: {
          regions?: Array<{ name?: string } | null | undefined> | null;
        } | null;
      }>(a);
      const seq = att.sequence;
      if (!seq || !seq.regions || seq.regions.length <= 1) return null;
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
