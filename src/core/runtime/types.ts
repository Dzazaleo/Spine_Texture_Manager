// src/core/runtime/types.ts
// Phase 42 RT-03/RT-04 — opaque boundary handles. Layer-3 pure: NO spine-core
// import, NO DOM/Electron/sharp. Phase 42 declares these; Phase 43's two
// adapter impls construct/unwrap them. Nothing else may.

/** The runtime identity. Threaded explicitly on every handle — never inferred
 *  from object shape (feedback_explicit_identity_over_inference). */
export type RuntimeTag = '4.2' | '4.3';

/** Per-handle-kind unique brand symbols. `declare const ... : unique symbol`
 *  produces a distinct, uninhabitable nominal type that structural typing
 *  cannot satisfy — a plain object, or a handle of a different kind, or a
 *  raw spine-core Skeleton, is NOT assignable. */
declare const SkeletonHandleBrand: unique symbol;
declare const SkeletonDataHandleBrand: unique symbol;
declare const AnimationStateHandleBrand: unique symbol;
declare const SlotHandleBrand: unique symbol;
declare const AttachmentHandleBrand: unique symbol;
declare const SkinHandleBrand: unique symbol;
declare const AnimationHandleBrand: unique symbol;
declare const AtlasHandleBrand: unique symbol;

/** Base shape: the brand makes it nominal; `__rt` makes runtime identity a
 *  REQUIRED, non-optional field (locked constraint — thread, don't infer). */
interface OpaqueHandle<B extends symbol> {
  readonly [k: symbol]: never;        // structural guard scaffold
  readonly __brand: B;                // nominal brand (phantom — never assigned a real value)
  readonly __rt: RuntimeTag;          // REQUIRED runtime tag — the threaded identity
}

export type OpaqueSkeleton        = OpaqueHandle<typeof SkeletonHandleBrand>;
export type OpaqueSkeletonData    = OpaqueHandle<typeof SkeletonDataHandleBrand>;
export type OpaqueAnimationState  = OpaqueHandle<typeof AnimationStateHandleBrand>;
export type OpaqueSlot            = OpaqueHandle<typeof SlotHandleBrand>;
export type OpaqueAttachment      = OpaqueHandle<typeof AttachmentHandleBrand>;
export type OpaqueSkin            = OpaqueHandle<typeof SkinHandleBrand>;
export type OpaqueAnimation       = OpaqueHandle<typeof AnimationHandleBrand>;
export type OpaqueAtlas           = OpaqueHandle<typeof AtlasHandleBrand>;

/** Factory + unwrap helpers, used ONLY inside the two Phase-43 adapter impls.
 *  Generic over brand so each adapter stamps its own __rt. The `unknown` cast
 *  is the single sanctioned boundary cast — quarantined to these two helpers. */
export function brandHandle<H extends OpaqueHandle<symbol>>(
  raw: unknown,
  rt: RuntimeTag,
): H {
  // The raw spine object carries no __brand/__rt at runtime; the brand is a
  // compile-time phantom. We attach __rt non-enumerably so a guard can read it
  // without polluting the spine object's own keys.
  Object.defineProperty(raw as object, '__rt', { value: rt, enumerable: false, configurable: true });
  return raw as H;
}

export function unwrapHandle<T>(h: OpaqueHandle<symbol>): T {
  return h as unknown as T;
}

/** Runtime-tag guard — lets a consumer ASSERT (not infer) the threaded tag.
 *  A cross-runtime mix is already a COMPILE error via the brand; this guard
 *  is the runtime backstop + the readable identity accessor. */
export function handleRuntime(h: OpaqueHandle<symbol>): RuntimeTag {
  return h.__rt;
}

// --- Phase 42 scope boundary -------------------------------------------------
// `brandHandle`/`unwrapHandle`/`handleRuntime` are DECLARED in Phase 42 — their
// bodies are trivial type-casts over `unknown` with NO spine-core dependency, so
// Phase 43's two adapter impls (runtime-42.ts / runtime-43.ts, RT-02) have the
// factory ready. This file contains NO `@esotericsoftware/spine-core` /
// `spine-core-42` / DOM / Electron / sharp / node:fs import — it operates only
// on `unknown`, keeping `core/runtime/` Layer-3 pure (CLAUDE.md Fact #5). The
// two adapter impls that legitimately import a spine-core package are Phase 43.
