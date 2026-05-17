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
  /** Q1 additive (Phase 43, RT-02 — strictly-additive, no reshape; same
   *  escalation pattern as attachmentTimelineNames). The attachment's intrinsic
   *  `Attachment.name` (distinct from the path-indirected region name and from
   *  the SkinEntry name). sampler.ts's snapshotFrame builds the global key
   *  `${skin}/${slot}/${attachment.name}` from this when walking LIVE slots
   *  (no SkinEntry in scope). 4.2 & 4.3: `attachment.name` (base Attachment). */
  attachmentName(a: OpaqueAttachment): string;
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

/** Phase 43 (RT-02) — lazy sync require() switch.
 *
 * Conditional require keeps the unmatched spine-core copy out of the worker.
 * electron-vite emits the worker as CJS (sampler-worker-bridge.ts:71) so
 * `require` is available; sync keeps loadSkeleton() synchronous (no async
 * thread through runSamplerJob → the byte-frozen loader contract).
 *
 * The `require('./runtime-43.js')` arm is a forward reference — runtime-43.ts
 * lands in Plan 04; `tag === '4.2'` is the only arm Phase 43's loader exercises
 * (D-02 hard-pick). Do NOT add a static `import` of either runtime-4x file —
 * that would defeat the lazy single-copy load and pull both spine-core graphs
 * into every worker.
 *
 * 43-03 — Option A (environment-conditional resolution with a bundler-safe test
 * seam). The lazy-`require` design is correct for the PRODUCTION electron-vite
 * CJS worker bundle (Assumptions Log A2 — ambient `require` resolves the
 * sibling adapter chunk there) and is preserved byte-identical below: it keeps
 * the unmatched spine-core copy out of the worker (ARCHITECTURE §4 lazy
 * single-copy). But the SAFE-02 HARD exit gate runs under vitest, where
 * `package.json` is `"type":"module"`: vitest DOES inject a `require` shim
 * (`typeof require !== 'undefined'` is true) but that shim cannot resolve
 * `./runtime-42.js` against vitest's `.ts` transform graph ("Cannot find module
 * './runtime-42.js'"). So the environment discriminator is NOT `typeof require`
 * — it is "has a test resolver been injected?".
 *
 * The production worker bundle NEVER imports the test setupFile, so
 * `__esmAdapterResolver` is ALWAYS null there → the lazy-`require` branch below
 * runs byte-identically to Plan 02 (invariant a preserved; ARCHITECTURE §4
 * lazy-single-copy untouched). The vitest setupFile
 * (`tests/setup/esm-adapter-resolver.ts`, registered via `setupFiles` —
 * test-infra ONLY, runs before every test module) binds the resolver by
 * STATICALLY importing the REAL `runtime-42.ts` / `runtime-43.ts`
 * (resolution-only — the real adapters run; SAFE-02 exercises the real
 * runtime-42.111 path, NOT a mock). When the resolver is bound it takes
 * precedence so the unresolvable `require('./runtime-42.js')` is never reached
 * under vitest. `loadSkeleton` stays SYNCHRONOUS — no `await import()`. If
 * neither a resolver nor a working `require` is available, this throws loudly
 * (never silently returns null — a verification-integrity requirement). */

/** Test-only ESM resolver hook. Bound by the vitest setupFile
 *  (`tests/setup/esm-adapter-resolver.ts`) which statically imports the REAL
 *  runtime-42/runtime-43 modules. Module-scoped + null by default so the
 *  production worker bundle (which never imports the setupFile) keeps the
 *  ambient-`require` branch and the lazy-single-copy guarantee. */
let __esmAdapterResolver: ((tag: RuntimeTag) => SpineRuntime) | null = null;

/** Test-infra ONLY. Registered exclusively from the vitest setupFile. NEVER
 *  call this from `src/` — the production path resolves via ambient `require`. */
export function __setEsmAdapterResolver(
  fn: ((tag: RuntimeTag) => SpineRuntime) | null,
): void {
  __esmAdapterResolver = fn;
}

const cache = new Map<RuntimeTag, SpineRuntime>();
export function pickRuntime(tag: RuntimeTag): SpineRuntime {
  const hit = cache.get(tag);
  if (hit) return hit;
  let rt: SpineRuntime;
  if (__esmAdapterResolver != null) {
    // TEST (vitest ESM) — and ONLY test: the production worker bundle never
    // imports the setupFile, so this is null in production and this branch is
    // dead there. The setupFile statically imported the REAL adapters and bound
    // this resolver; the real runtime-42/runtime-43 `create()` runs
    // (resolution-only; NOT a mock — SAFE-02 exercises the real path). This
    // takes precedence so the vitest-unresolvable `require('./runtime-42.js')`
    // below is never reached under vitest.
    rt = __esmAdapterResolver(tag);
  } else if (typeof require !== 'undefined') {
    // PRODUCTION (electron-vite CJS worker — Assumptions Log A2). BYTE-IDENTICAL
    // to Plan 02: conditional lazy require keeps the unmatched spine-core copy
    // out of the worker (ARCHITECTURE §4 lazy single-copy). DO NOT add a static
    // import of either runtime-4x file — that defeats lazy single-copy.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = tag === '4.2' ? require('./runtime-42.js') : require('./runtime-43.js');
    rt = (mod as { create: () => SpineRuntime }).create();
  } else {
    // Never silently return null: neither a resolver nor a working `require`.
    throw new Error(
      `pickRuntime('${tag}'): no ESM adapter resolver is registered and ` +
        `ambient require is unavailable. Under vitest, ensure ` +
        `tests/setup/esm-adapter-resolver.ts is listed in vitest.config.ts ` +
        `setupFiles. (Production worker resolves via ambient require — A2.)`,
    );
  }
  cache.set(tag, rt);
  return rt;
}
