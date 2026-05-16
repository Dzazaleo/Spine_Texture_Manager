# Architecture Research

**Domain:** Dual spine-core runtime (4.2.111 + 4.3.0) integration into a pure-TS `core/` math layer behind a worker_threads sampler
**Researched:** 2026-05-16
**Confidence:** HIGH — verified against the actual published `@esotericsoftware/spine-core@4.3.0` npm tarball `.d.ts` + compiled `.js` (stable, not beta)

---

## Executive Verdict (read this first)

**Recommended dispatch architecture: a thin runtime-adapter facade in `core/` — one `SpineRuntime` interface, two implementations (`runtime-42.ts`, `runtime-43.ts`), selected by the loader from the detected skeleton version. `sampler.ts` and `bounds.ts` become runtime-agnostic by receiving the adapter, never importing `@esotericsoftware/spine-core` directly.**

Rejected alternatives (detailed below): (b) duplicated sampler/bounds per runtime — fails the determinism/maintenance bar; (c) normalized internal skeleton model — re-implements the spine math the project explicitly delegates (CLAUDE.md fact #2), highest trap risk.

**The single most important finding of this research:** SEED-006's costed inventory was built against 4.3-**beta** and is materially wrong for stable 4.3.0. The "5 renames + 2 signature changes" framing **understates the port**. Stable 4.3.0 ships a completed **Pose refactor** that moves `getAttachment()`, `color`, and `getWorldScaleX/Y()` off `Slot`/`Bone` and onto `slot.pose` / `bone.appliedPose`, and **removes the mutable `RegionAttachment.offset` array** that `loader.ts`'s Phase 33 rotated-region patch writes into directly. This is the architectural delta that drives the phase count up. See **§"Beta-vs-Stable Drift"** for the falsification table.

---

## Standard Architecture

### System Overview (target state)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LAYER 3 — core/  (pure TS, no DOM/Electron/sharp)   │
│                                                                        │
│  loader.ts                                                             │
│   ├─ checkSpineVersion()         → DISPATCHER (was rejecter)            │
│   │     4.2.x  → pickRuntime('4.2')                                    │
│   │     4.3.x  → pickRuntime('4.3')                                    │
│   │     <4.2 / ≥4.4 / null → throw SpineVersionUnsupportedError        │
│   │                                                                    │
│   └─ loadSkeleton() → LoadResult { …, runtime: SpineRuntime }          │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────┐        │
│   │  runtime/  (NEW — the adapter seam)                        │        │
│   │  ┌────────────────┐   SpineRuntime interface              │        │
│   │  │ runtime.ts     │   (parse, makeSkeleton, makeState,    │        │
│   │  │  (interface +  │    setupPose, setupPoseSlots,         │        │
│   │  │   pickRuntime) │    setAnimation, slotAttachment,      │        │
│   │  └───┬────────┬───┘    slotColorAlpha, regionAABB,         │        │
│   │      │        │        vertexAABB, boneAxisScale, …)       │        │
│   │  ┌───┴───┐ ┌──┴────┐                                       │        │
│   │  │rt-42  │ │rt-43  │  ← ONLY these two files import        │        │
│   │  │.ts    │ │.ts    │    @esotericsoftware/spine-core(-43)  │        │
│   │  └───┬───┘ └───┬───┘                                       │        │
│   └──────┼─────────┼───────────────────────────────────────────┘       │
│          │         │                                                   │
│  sampler.ts  ──────┴──── reads load.runtime.*  (NO spine-core import)  │
│  bounds.ts   ──────┴──── reads load.runtime.*  (NO spine-core import)  │
└──────────────────────────────────────────────────────────────────────┘
            ▲
            │  loadSkeleton + sampleSkeleton invoked inside the Worker
┌───────────┴──────────────────────────────────────────────────────────┐
│  LAYER 2 — main/  sampler-worker.ts  (worker_threads entrypoint)       │
│   one Worker per job; loads BOTH runtime modules lazily via the        │
│   adapter (only the matched runtime's spine-core copy is import()ed)   │
└───────────────────────────────────────────────────────────────────────┘
            ▲
┌───────────┴──────────────────────────────────────────────────────────┐
│  RENDERER — Spine Animation Viewer (Phase 41)                          │
│   @esotericsoftware/spine-player 4.2.111 → 4.3.0  (single bump;        │
│   player 4.3.0 reads BOTH 4.2 and 4.3 JSON natively — no dual needed)  │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `loader.ts` (modified) | Detect version → select runtime → parse skeleton via the chosen runtime → return `LoadResult` carrying the runtime handle | Repurpose `checkSpineVersion` from throw-on-≥4.3 to branch-on-≥4.3; `checkSpine43Schema` retired as a rejecter, repurposed as the `constraints[]`-array → 4.3 routing fallback |
| `runtime/runtime.ts` (NEW) | The `SpineRuntime` interface + `pickRuntime(tag)` factory. Pure types + a dispatch switch. No spine-core import. | ~1 interface, 1 factory function, ~20 method signatures |
| `runtime/runtime-42.ts` (NEW) | Implements `SpineRuntime` against `@esotericsoftware/spine-core` (the 4.2.111 alias) | Wraps existing 4.2 call shapes verbatim — preserves goldens |
| `runtime/runtime-43.ts` (NEW) | Implements `SpineRuntime` against `@esotericsoftware/spine-core-43` (the 4.3.0 alias) | New Pose-API call shapes |
| `sampler.ts` (modified) | Lifecycle loop unchanged in *shape*; every direct spine-core call replaced with `rt.*` | ~8 call-site edits, no algorithm change |
| `bounds.ts` (modified) | AABB + render-scale math; `computeWorldVertices` + `getWorldScaleX/Y` routed through `rt.*` | ~4 call-site edits |
| `sampler-worker.ts` (modified) | Unchanged orchestration; the runtime is selected inside `loadSkeleton` so the worker stays runtime-blind | Lazy `import()` inside the two runtime modules keeps only one spine-core copy resident per job |

---

## Recommended Project Structure

```
src/core/
├── loader.ts                 # MODIFIED — version → runtime dispatch
├── sampler.ts                # MODIFIED — call sites → rt.*
├── bounds.ts                 # MODIFIED — call sites → rt.*
├── runtime/                  # NEW directory — the dual-runtime seam
│   ├── runtime.ts            # NEW — SpineRuntime interface + pickRuntime()
│   ├── runtime-42.ts         # NEW — 4.2.111 adapter impl
│   ├── runtime-43.ts         # NEW — 4.3.0 adapter impl
│   └── types.ts              # NEW — opaque boundary types (OpaqueSkeleton, …)
├── errors.ts                 # MODIFIED — SpineVersionUnsupportedError keeps the
│                             #            ≥4.4 / <4.2 message; 4.3 message retired
├── types.ts                  # MODIFIED — LoadResult gains `runtime: SpineRuntime`
├── synthetic-atlas.ts        # MODIFIED — SilentSkipAttachmentLoader is 4.2-only;
│                             #            4.3 uses AtlasAttachmentLoader(atlas, true)
└── (analyzer.ts, export.ts, overrides.ts, project-file.ts — UNCHANGED:
     they consume PeakRecord/SkeletonSummary, never spine-core directly)

package.json:
  "@esotericsoftware/spine-core":     "4.2.111"
  "@esotericsoftware/spine-core-43":  "npm:@esotericsoftware/spine-core@4.3.0"   # PORT-04 alias
  "@esotericsoftware/spine-player":   "4.3.0"                                     # bumped
```

### Structure Rationale

- **`runtime/` as a sub-directory of `core/`:** keeps the dispatch abstraction inside Layer 3 (locked decision). `arch.spec.ts`'s existing `globSync('src/core/**/*.ts')` rule already covers it — it must NOT import fs/sharp/electron. The two adapter impls import only spine-core (already a permitted core dependency).
- **Two concrete files, not a parameterised one:** `runtime-42.ts` is a near-verbatim wrapper of today's call shapes. This is what protects the 4.2 golden tests — the 4.2 path's *exact* spine-core calls are preserved byte-for-byte, just relocated behind the interface.
- **Opaque boundary types (`runtime/types.ts`):** `LoadResult` and the sampler must not name `Skeleton`/`Slot`/`Bone` from *either* package (see Type Strategy §3). Branded opaque handles cross the seam.

---

## Architectural Patterns

### Pattern 1 (RECOMMENDED): Thin runtime-adapter facade

**What:** A `SpineRuntime` interface declaring every spine-core operation the math layer needs. `loader.ts` selects the implementation from the detected version and stores it on `LoadResult.runtime`. `sampler.ts`/`bounds.ts` call `load.runtime.foo(...)` instead of `skeleton.foo(...)`.

**Why this one wins:**
- **Layer-3 purity preserved trivially.** The interface is pure TS. Only `runtime-42.ts` / `runtime-43.ts` touch spine-core, and spine-core is already a sanctioned core dependency. `arch.spec.ts` needs no carve-out.
- **4.2 goldens stay valid by construction.** `runtime-42.ts` makes the *identical* spine-core calls today's `sampler.ts`/`bounds.ts` make. Numerically nothing changes on the 4.2 path. (4.3 numerical equivalence analysed in §2 below — it is NOT guaranteed and must be fixture-gated, not golden-shared.)
- **Smallest blast radius.** `sampler.ts`'s ~750-line algorithm (the Pass 1 / 1.5 / 2 / sequence-fan-out machinery, the `project_sampler_visibility_invariant` skin-manifest pass) is untouched in logic — only the leaf spine-core calls move behind `rt.*`.
- **The API deltas localize cleanly.** All five renames, both `computeWorldVertices` signature changes, the Pose-API `slot.pose.attachment`/`slot.pose.color`, AND the unflagged `bone.appliedPose.getWorldScaleX()` move collapse into ~20 method bodies in two files.

**The interface (concrete shape, derived from actual call sites in sampler.ts + bounds.ts):**

```typescript
// core/runtime/runtime.ts
export type RuntimeTag = '4.2' | '4.3';

export interface SpineRuntime {
  readonly tag: RuntimeTag;

  // --- loader-side (parse) ---
  parseSkeleton(parsedJson: unknown, atlas: OpaqueAtlas, atlasLess: boolean): OpaqueSkeletonData;
  makeAtlas(atlasText: string): OpaqueAtlas;        // wraps TextureAtlas + stub texture loader
  applyRotatedRegionFix(data: OpaqueSkeletonData): void;  // 4.2: the Phase 33 offset[] patch
                                                          // 4.3: the getOffsets()-based equivalent (see §"Rotated atlas")

  // --- sampler-side (lifecycle) ---
  makeSkeleton(data: OpaqueSkeletonData): OpaqueSkeleton;
  makeAnimationState(data: OpaqueSkeletonData): OpaqueAnimationState;
  skins(data: OpaqueSkeletonData): OpaqueSkin[];
  animations(data: OpaqueSkeletonData): OpaqueAnimation[];

  setSkin(sk: OpaqueSkeleton, skin: OpaqueSkin): void;
  setupPose(sk: OpaqueSkeleton): void;              // 4.2 setToSetupPose | 4.3 setupPose
  setupPoseSlots(sk: OpaqueSkeleton): void;         // 4.2 setSlotsToSetupPose | 4.3 setupPoseSlots
  clearTracks(st: OpaqueAnimationState): void;
  setAnimation(st: OpaqueAnimationState, track: number, anim: OpaqueAnimation, loop: boolean): void;
                                                    // 4.2 setAnimationWith | 4.3 setAnimation(obj overload)
  stateUpdate(st: OpaqueAnimationState, dt: number): void;
  stateApply(st: OpaqueAnimationState, sk: OpaqueSkeleton): void;
  skeletonUpdate(sk: OpaqueSkeleton, dt: number): void;
  updateWorldTransform(sk: OpaqueSkeleton, mode: 'pose' | 'reset' | 'update'): void;

  // --- visibility / iteration (the project_sampler_visibility_invariant surface) ---
  slots(sk: OpaqueSkeleton): OpaqueSlot[];
  slotAttachment(slot: OpaqueSlot): OpaqueAttachment | null;   // 4.2 slot.getAttachment() | 4.3 slot.pose.attachment
  slotColorAlpha(slot: OpaqueSlot): number;                    // 4.2 slot.color.a | 4.3 slot.pose.color.a
  slotName(slot: OpaqueSlot): string;
  skinEntries(skin: OpaqueSkin): { slotIndex: number; name: string; attachment: OpaqueAttachment }[];

  // --- bounds math (the two computeWorldVertices + bone scale) ---
  attachmentKind(a: OpaqueAttachment): 'region' | 'mesh' | 'vertex' | 'skip';
  regionWorldVertices(slot: OpaqueSlot, a: OpaqueAttachment): Float32Array;   // 8 floats
  vertexWorldVertices(sk: OpaqueSkeleton, slot: OpaqueSlot, a: OpaqueAttachment): Float32Array;
  boneAxisScale(slot: OpaqueSlot): { x: number; y: number };   // 4.2 bone.getWorldScaleX | 4.3 bone.appliedPose.getWorldScaleX
  attachmentRegionMeta(a: OpaqueAttachment): { name?: string; pageW?: number; pageH?: number;
                                               originalW?: number; originalH?: number;
                                               canonW?: number; canonH?: number } | null;
  attachmentUVs(a: OpaqueAttachment): Float32Array | null;
  sequenceRegions(a: OpaqueAttachment): { name: string }[] | null;
}

export function pickRuntime(tag: RuntimeTag): SpineRuntime { /* lazy import switch — see §4 */ }
```

**Trade-offs:** one indirection layer and ~20 wrapper methods to write twice. Acceptable — the wrappers are 1–3 lines each and the 4.2 side is mechanical relocation. The interface surface is the *real* port scope; SEED-006's "5 renames" was the visible tip.

### Pattern 2 (REJECTED): Duplicated sampler/bounds per runtime + switch

**What:** `sampler-42.ts`/`sampler-43.ts`, `bounds-42.ts`/`bounds-43.ts`, dispatched by a top-level switch in the worker.

**Why rejected:** `sampler.ts` is ~750 lines of *algorithm* (peak-latch epsilon, Pass 1.5 skin-manifest invariant per `project_sampler_visibility_invariant`, sequence fan-out, per-animation affected-test D-54). Forking it doubles the maintenance surface for every future correctness fix and makes the determinism contract (N1.6 / `project_compute_export_dims_canonical_base`) impossible to keep in lockstep across two copies. The runtime delta is ~12 leaf calls; duplicating 750 lines to vary 12 calls is the wrong axis of decomposition. CLAUDE.md fact #5 ("UI is a consumer", core is the single math truth) argues for one algorithm.

### Pattern 3 (REJECTED): Normalized internal skeleton model

**What:** Parse both 4.2 and 4.3 into a project-owned neutral skeleton/bone/slot model; sampler runs on the neutral model.

**Why rejected — highest trap risk:** The neutral model would have to re-host the world-transform pipeline (bone chain, IK, Transform/Path/Physics constraints, the new 4.3 Slider constraint, DeformTimelines). CLAUDE.md fact #2 is explicit: *"`computeWorldVertices` after `updateWorldTransform` already handles all of this. We do not reimplement any of this math."* A normalized model either re-implements that math (forbidden, and the Slider constraint is brand-new 4.3 surface with no 4.2 analog — SEED-006 PORT-03) or it just wraps the runtime objects anyway (in which case it *is* Pattern 1 with extra copying). This is SEED-003 Option B's trap class wearing a different hat.

---

## The Seven Resolved Questions

### 1. Dispatch architecture — where detection happens, how core stays runtime-agnostic

**Detection happens in `loader.ts`, exactly where `checkSpineVersion` already runs** (loader.ts:122-143, called at loader.ts:230). Today it *throws* on `major===4 && minor>=3`. The refactor: that branch returns a `RuntimeTag` instead of throwing; only genuinely unsupported versions (`<4.2`, `major>=5`, `major===4 && minor>=4`, `null`/malformed) still throw `SpineVersionUnsupportedError`. The detection logic, the dual-signal pattern (semver field OR `checkSpine43Schema`'s `constraints[]` presence), and the typed-error envelope are all **preserved** — only the 4.3 arm's action changes from throw to route.

`core/` stays runtime-agnostic because `sampler.ts` and `bounds.ts` will no longer have `import { Skeleton, … } from '@esotericsoftware/spine-core'` at all (verified current imports: sampler.ts:47-53, bounds.ts:31-41). They receive `load.runtime` and call through it. Only `runtime-42.ts`/`runtime-43.ts` import a spine-core package.

**Considering the documented API deltas:** all of them — 5 renames, 2 `computeWorldVertices` signature changes, `slot.getAttachment()` → `slot.pose.attachment`, the new `Pose`/`Posed`/`BonePose`/`IkConstraintPose`/`SlotPose` types — are absorbed inside the two adapter files. The math layer never sees a Pose type. **This is the entire point of choosing the facade over duplication.**

### 2. The two `computeWorldVertices` signatures + 4.3↔4.2 numerical equivalence

**Verified stable 4.3.0 signatures (from the published `.d.ts`, NOT beta):**

| Attachment | 4.2.111 (current `bounds.ts` call) | **Stable 4.3.0** (`.d.ts` verbatim) |
|---|---|---|
| Region | `computeWorldVertices(slot, wv, 0, 2)` | `computeWorldVertices(slot, vertexOffsets, worldVertices, offset, stride)` |
| Vertex/Mesh | `computeWorldVertices(slot, 0, n, wv, 0, 2)` | `computeWorldVertices(skeleton, slot, start, count, worldVertices, offset, stride)` |

**FLAG — SEED-006 is wrong on the Region signature.** SEED-006 (built on beta) states Region adds `vertexOffsets` *appended last*: `(slot, wv, offset, stride, vertexOffsets)`. Stable 4.3.0 inserts `vertexOffsets` as the **second** parameter: `(slot, vertexOffsets, worldVertices, offset, stride)`. Worse: in stable 4.3.0 `RegionAttachment` **no longer stores a mutable `offset[]` array** — the caller must supply `vertexOffsets` (8 floats) computed via `attachment.getOffsets(slot.pose)` (which resolves through the attachment's `Sequence`). The Vertex/Mesh signature *does* match SEED-006 (adds `skeleton` as first arg).

**How `bounds.ts` abstracts both cleanly:** it doesn't try to — it never calls `computeWorldVertices` again. `bounds.ts` calls `rt.regionWorldVertices(slot, a)` / `rt.vertexWorldVertices(sk, slot, a)` returning a `Float32Array`. The adapter bodies:

```typescript
// runtime-42.ts
regionWorldVertices(slot, a) { const v=new Float32Array(8); a.computeWorldVertices(slot, v, 0, 2); return v; }
vertexWorldVertices(_sk, slot, a) { const n=a.worldVerticesLength; const v=new Float32Array(n);
                                    a.computeWorldVertices(slot, 0, n, v, 0, 2); return v; }
// runtime-43.ts
regionWorldVertices(slot, a) { const off = a.getOffsets(slot.pose);   // 8 floats from the Sequence
                               const v=new Float32Array(8); a.computeWorldVertices(slot, off, v, 0, 2); return v; }
vertexWorldVertices(sk, slot, a) { const n=a.worldVerticesLength; const v=new Float32Array(n);
                                   a.computeWorldVertices(sk, slot, 0, n, v, 0, 2); return v; }
```

`aabbFromFloat32` and the hull/scale math in `bounds.ts` are byte-unchanged — they consume the returned buffer.

**Numerical equivalence 4.3 vs 4.2 for an equivalent rig — DO NOT ASSUME.** The 4.3 Pose refactor changed *where* world transforms are stored (`bone.appliedPose.a/b/c/d`) but the **math is the same affine composition**; for a rig that uses only 4.2-expressible features, output is expected to match within FP noise. **However:** (a) this is not contractually guaranteed by Esoteric and the refactor touched the constraint solve order; (b) the existing goldens drive from a 4.2 fixture through the 4.2 runtime — they stay valid for the 4.2 path *unconditionally* (same calls). The correct strategy is **NOT** to share goldens across runtimes. Instead: 4.2 fixtures gate the 4.2 path (existing goldens, byte-frozen); a **new 4.3-exported fixture** gates the 4.3 path with its own captured-baseline goldens; a cross-runtime tolerance test (same rig exported as both 4.2 and 4.3) asserts `peakScale` agreement within the user-facing 1e-3 tolerance as a *regression sentinel*, not a hard contract. This is the `feedback_narrow_before_fixing` discipline applied to porting.

### 3. Type-system strategy — two type universes under the npm alias

Both packages export `Skeleton`, `Slot`, `Animation`, `AnimationState`, etc. under identical names. The alias gives them distinct module specifiers (`@esotericsoftware/spine-core` vs `@esotericsoftware/spine-core-43`) so TypeScript treats them as **distinct nominal-by-module types** even though many are structurally similar.

**Strategy: opaque branded boundary types; never let a spine-core type escape an adapter file.**

- `runtime/types.ts` declares branded opaque handles: `type OpaqueSkeleton = { readonly __spine: unique symbol }` (and similarly Slot/Bone/Attachment/AnimationState/SkeletonData/Skin/Animation/Atlas). These are the *only* skeleton-ish types `LoadResult`, `sampler.ts`, and `bounds.ts` ever name.
- `runtime-42.ts` does `import type { Skeleton as Skel42, Slot as Slot42, … } from '@esotericsoftware/spine-core'` and casts at the boundary (`return sk as unknown as OpaqueSkeleton`). `runtime-43.ts` does the same with `import type … from '@esotericsoftware/spine-core-43'`.
- **Structural-typing risk is real and must be defended against.** Because many 4.2 and 4.3 types are structurally compatible, TS would *silently* accept a 4.3 `Skeleton` where a 4.2 one is expected if both leaked into the same scope. The opaque-handle wall makes that a compile error: nothing outside an adapter can construct or unwrap a handle, and the two adapters never import each other. The `unique symbol` brand defeats structural compatibility.
- **`import type` is mandatory** for the spine-core type imports inside adapters where only the type is needed (keeps the type universes from forcing both runtime modules to be eagerly bundled — pairs with §4 lazy loading). Value imports (`new Skeleton(...)`) stay inside the `import()`-gated path.
- `tsconfig` needs no `paths` hack — the npm alias resolves both packages naturally; the second appears in `node_modules/@esotericsoftware/spine-core-43`. The two sets of `.d.ts` coexist without collision because they are different packages on disk.

**Boundary-type location:** `core/runtime/types.ts` (opaque handles) + `core/types.ts` gains `runtime: SpineRuntime` on `LoadResult`. No spine-core type name appears in `core/types.ts`, `sampler.ts`, `bounds.ts`, `analyzer.ts`, `export.ts`, or `shared/types.ts` after the port. This is the compile-time enforcement of the dual-universe separation — stronger than the runtime arch.spec grep, and the right lever per `feedback_explicit_identity_over_inference` (thread identity explicitly via the typed `runtime` field; don't infer it from data shape).

### 4. worker_threads impact — does the Worker load both runtimes?

**The Worker stays runtime-blind, and only ONE spine-core copy loads per job.** `sampler-worker.ts` calls `loadSkeleton(path, opts)` (line 120) then `sampleSkeleton(load, …)` (line 128) — both unchanged. The runtime is selected *inside* `loadSkeleton` via `pickRuntime(tag)`.

**`pickRuntime` uses dynamic `import()` so the unmatched runtime's spine-core copy is never loaded into that worker process:**

```typescript
// runtime/runtime.ts — pickRuntime is async (loader.ts already runs sync; see note)
const cache = new Map<RuntimeTag, SpineRuntime>();
export async function pickRuntime(tag: RuntimeTag): Promise<SpineRuntime> {
  if (cache.has(tag)) return cache.get(tag)!;
  const mod = tag === '4.2'
    ? await import('./runtime-42.js')   // pulls @esotericsoftware/spine-core only
    : await import('./runtime-43.js');  // pulls @esotericsoftware/spine-core-43 only
  const rt = mod.create(); cache.set(tag, rt); return rt;
}
```

**Memory/startup implications:** spine-core 4.3.0's compiled `dist/` is ~5.8 MB on disk (parsed JS footprint far smaller). 4.2.111 is comparable. Eagerly importing both into every worker would roughly double the module-init cost (~tens of ms) and resident JS for no benefit, since any given skeleton is exactly one version. The `import()` gate means a 4.2 job's worker process never instantiates the 4.3 module graph and vice-versa. The Worker is short-lived (spawned per sample, `process.exit(0)` on completion — sampler-worker.ts:212), so there's no long-lived double-resident concern even across mixed jobs.

**One wrinkle — `loadSkeleton` is currently synchronous** and called synchronously by `runSamplerJob`. Two options, in cost order: (a) make `pickRuntime` do a synchronous `require()` of the matched runtime module under the CJS worker bundle (electron-vite emits the worker as `.cjs` — sampler-worker-bridge.ts:71 — so `require` is available and stays lazy/conditional); **recommended**. (b) thread `async` through `loadSkeleton`→`runSamplerJob` (larger diff, touches the byte-frozen-ish loader contract). Recommend (a): a conditional `require('./runtime-43.cjs')` inside the dispatch keeps `loadSkeleton` sync and still avoids loading the unmatched copy. electron-vite must be configured to emit `runtime-42`/`runtime-43` as separate chunks (build-order item, §7).

**arch.spec.ts impact:** the existing Phase-9 named-anchor (arch.spec.ts:208-231) asserts `sampler-worker.ts` imports only worker_threads + core + shared. Unchanged — the worker still imports only `../core/loader.js` + `../core/sampler.js`. The new `runtime/*.ts` files fall under the existing `globSync('src/core/**/*.ts')` rule (arch.spec.ts:148-178) which forbids fs/sharp — adapters import spine-core only, so they pass with no new carve-out. **Add a new named-anchor block** asserting `sampler.ts` and `bounds.ts` no longer import `@esotericsoftware/spine-core` directly (locks the facade in place — same pattern as the existing Phase-18/36 anchors).

### 5. Loader seam — rejecter → dispatcher refactor shape

Current: `checkSpineVersion` (loader.ts:122-143) throws for `<4.2`, `>=4.3`, `>=5`, malformed/null. `checkSpine43Schema` (loader.ts:175-188) throws when a top-level `constraints[]` array is present (the 4.3 schema marker for mis-stamped files).

**Cleanest refactor preserving the typed-error envelope + the v1.4 detect path for genuinely-unsupported files:**

```
function resolveRuntimeTag(version: string|null, parsedJson: unknown, path: string): RuntimeTag {
  // null / malformed / <4.2 / major>=5 / (major==4 && minor>=4)  → throw SpineVersionUnsupportedError  (UNCHANGED v1.4 path)
  // major==4 && minor==2  → '4.2'
  // major==4 && minor==3  → '4.3'
  // version parses to 4.2.x BUT checkSpine43Schema sees top-level constraints[]  → '4.3'  (mis-stamp routing, was a throw)
}
```

- `checkSpineVersion` keeps its exact decision tree; the two arms that currently `throw` for 4.2.x (pass) and 4.3.x (throw) become `return '4.2'` / `return '4.3'`. The `<4.2`, `major>=5`, **and a NEW `major===4 && minor>=4`** arm still `throw SpineVersionUnsupportedError(version, path)` — this is the *correct* future-proofing: a hypothetical 4.4 export must still hit the typed rejecter, not silently route to the 4.3 runtime.
- `checkSpine43Schema` is **repurposed, not deleted**: instead of `throw new SpineVersionUnsupportedError('4.3-schema', …)` it returns a boolean "looks-4.3" used to override a 4.2-stamped-but-4.3-shaped file to the `'4.3'` tag. Its unit tests (referenced loader.ts:169) flip from "asserts throw" to "asserts returns true".
- `SpineVersionUnsupportedError` (errors.ts) keeps the `<4.2` and `≥4.4` messaging. The `'4.3-schema'` / 4.3 semver message arm ("re-export as Version 4.2") is **retired** (PROJECT.md target feature; the advisory is now wrong for 4.3). The error class and its `detectedVersion` field stay — `serializeError` in sampler-worker.ts:156-162 keeps the `SpineVersionUnsupportedError` arm intact for the still-unsupported ranges.
- The discriminated-union typed-error envelope (`shared/types.ts`, D-158/D-171) is **untouched** — same `SpineVersionUnsupportedError` kind, narrower trigger set.

This is a ~30-line change concentrated in loader.ts:122-251, plus the runtime-selection wiring (`const rt = pickRuntime(tag)`), plus threading `rt` into the parse calls (`SkeletonJson`/`TextureAtlas`/`AtlasAttachmentLoader` all move into `rt.parseSkeleton`/`rt.makeAtlas`). **Note:** the 4.3 `AtlasAttachmentLoader` constructor is `(atlas, allowMissingRegions?: boolean)` — the custom `SilentSkipAttachmentLoader` (synthetic-atlas.ts) is **4.2-only**; `runtime-43.ts` uses the native `new AtlasAttachmentLoader(atlas, true)` for atlas-less mode, simplifying that path.

### 6. spine-player 4.3.0 in the renderer — dual-runtime awareness?

**No dual-runtime needed in the renderer. Single bump 4.2.111 → 4.3.0.** Verified: `@esotericsoftware/spine-player@4.3.0` depends on `@esotericsoftware/spine-webgl@4.3.0` (which embeds spine-core 4.3.0). Esoteric's 4.3 runtime reads **both** 4.3 JSON and 4.2-exported JSON (4.2 is a forward-compatible input to the 4.3 loader — SEED-003 compat matrix row "4.3 runtime + 4.2 JSON: Esoteric claims compat"). The Phase 41 viewer therefore needs only the version bump; the player auto-handles both skeleton schemas and both atlas shapes (rotated regions included).

**Integration points with the Phase 41 viewer:** the viewer (`SpinePlayer` config in the renderer, per PROJECT.md v1.5.1 — straight-alpha config, `app-image:` CSP, CORS ACAO) is API-stable across the player bump for the basic-render path. Regression risks to verify (these become the viewer regression-pass scope, not architecture work): (a) `SpinePlayer` constructor/config option renames between player 4.2.111 and 4.3.0 (the Pose refactor is in core, but the player's public config surface should be checked against 4.3.0 `SpinePlayer.d.ts`); (b) the 5 deferred Phase 41 HUMAN-UATs (anim/skin switch synchrony, GL leak cycles) re-run on 4.3.0; (c) confirm a 4.2 fixture still renders through the 4.3.0 player (the forward-compat claim, fixture-verified per SEED-003's "verify against fixture before recommending"). The renderer does **not** consume `core/runtime/*` — the architectural boundary (arch.spec.ts:19-34, renderer ↛ core) is unchanged.

### 7. Suggested build order (phase decomposition input)

Hard dependencies drive this. SEED-006's 4-task estimate is **confirmed low** — the realistic decomposition is 7 ordered work-units (the roadmapper will phase-group these; they are listed as dependency-ordered units, not a 1:1 phase map):

```
UNIT 1  npm alias + types scaffolding             (HARD ROOT — nothing compiles without it)
        package.json alias; runtime/types.ts opaque handles; SpineRuntime interface
        (signatures only, no impls); LoadResult gains runtime field; electron-vite
        config emits runtime-42/runtime-43 as separate worker chunks.
            │  depends on: nothing
            ▼
UNIT 2  runtime-42.ts adapter (the safety net)     (gates everything else)
        Verbatim relocation of today's spine-core calls behind SpineRuntime.
        loader/sampler/bounds rewired to call rt.* for the 4.2 path ONLY.
        Existing 4.2 goldens MUST stay byte-green here — this unit is "no behaviour
        change, just indirection". If goldens move, the facade is wrong; stop.
            │  depends on: UNIT 1
            ▼
UNIT 3  loader dispatch (rejecter → router)         (4.3 inert until UNIT 4)
        checkSpineVersion returns RuntimeTag; new ≥4.4 throw arm; checkSpine43Schema
        repurposed to boolean; SpineVersionUnsupportedError 4.3 message retired;
        4.3 tag routes to a NOT-YET-IMPLEMENTED runtime-43 (throws "not impl" stub).
            │  depends on: UNIT 2  (router needs the interface + 4.2 impl proven)
            ▼
UNIT 4  runtime-43.ts adapter — sampler surface     (the real port)
        Pose API: setupPose/setupPoseSlots, setAnimation(obj), slot.pose.attachment,
        slot.pose.color.a, bone.appliedPose.getWorldScaleX/Y, AnimationState
        lifecycle. Stable-4.3 verified shapes (NOT SEED-006 beta).
            │  depends on: UNIT 3  (needs a 4.3 file to actually route)
            ▼
UNIT 5  runtime-43.ts adapter — bounds surface      (the second port half)
        The two computeWorldVertices signatures (Region: vertexOffsets as 2nd arg
        via getOffsets(slot.pose); Vertex: skeleton as 1st arg). Rotated-region
        fix re-expressed for 4.3 (NO mutable attachment.offset[] — see Pitfall 1).
            │  depends on: UNIT 4  (shares OpaqueAttachment plumbing)
            ▼
UNIT 6  4.3 fixture + slider validation (PORT-03)   (correctness gate)
        New in-repo 4.3-exported fixture (analog of SIMPLE_TEST). Slider-constraint
        fixture: assert updateWorldTransform propagates Slider into the world matrix
        (PORT-03 — likely free via Physics.update path; fixture proves it).
        Cross-runtime tolerance sentinel (same rig as 4.2 + 4.3, peakScale within 1e-3).
            │  depends on: UNIT 5  (needs both bounds + sampler 4.3 working)
            ▼
UNIT 7  spine-player 4.3.0 bump + viewer regression  (INDEPENDENT — can parallel 4-6)
        package.json player bump; SpinePlayer config audit vs 4.3.0 .d.ts; viewer
        regression pass; 4.2-fixture-through-4.3-player forward-compat check;
        drop-zone/error copy update (remove "re-export as 4.2" advisory).
            │  depends on: UNIT 1 only (alias) — NOT on the core port; schedulable in parallel
            ▼
UNIT 8  CI matrix expansion                          (final gate)
        vitest matrix runs 4.2 fixtures (4.2 runtime) AND 4.3 fixtures (4.3 runtime)
        side-by-side; new arch.spec anchor (sampler/bounds ↛ direct spine-core import).
            │  depends on: UNIT 6 (needs the 4.3 fixture to exist)
```

**Hard-dependency summary:** UNIT 1 is the root (alias + interface — nothing typechecks without it). UNIT 2 must prove the facade is behaviour-neutral on 4.2 *before* any 4.3 code exists (this is the de-risking gate — if 4.2 goldens move, the abstraction is leaking and the port stops). UNIT 3 (router) must precede UNIT 4/5 (no 4.3 file routes anywhere until the router exists). UNIT 4 before UNIT 5 (shared OpaqueAttachment/OpaqueSlot plumbing matures in 4). UNIT 6 needs 4+5 complete. UNIT 7 (player) depends only on UNIT 1's alias and is schedulable in parallel with 4–6. UNIT 8 last.

**This is a 4-to-6 phase milestone, not SEED-006's single 4-task phase.** Natural phase boundaries: {1+2} (scaffold + safety-net), {3} (router), {4+5} (the port), {6} (fixtures/slider/sentinel), {7} (player — parallelizable), {8} (CI). The roadmapper should treat UNIT 2's "4.2 goldens stay byte-green" as a phase-exit gate.

## Data Flow

### Load → Sample (target)

```
JSON path
   ↓  loader.ts: JSON.parse → resolveRuntimeTag(version, json) → '4.2' | '4.3' | THROW(<4.2 / ≥4.4)
   ↓  rt = pickRuntime(tag)              [lazy require — only matched spine-core copy loads]
   ↓  rt.makeAtlas() / rt.parseSkeleton()  → LoadResult { …, runtime: rt }
   ↓  (worker boundary — path-based; SkeletonData never crosses postMessage, D-193)
sampler.ts: for skin → rt.setSkin/setupPose; for anim → rt.setAnimation/stateUpdate/…
   ↓  per tick: rt.slots → rt.slotAttachment / rt.slotColorAlpha (visibility invariant)
   ↓  bounds.ts: rt.regionWorldVertices / rt.vertexWorldVertices / rt.boneAxisScale
   ↓  PeakRecord (runtime-agnostic) → analyzer.ts → SkeletonSummary  [UNCHANGED downstream]
```

The boundary line in the dataflow is exactly `rt.*` — everything left of it is runtime-specific (two impls), everything right is the existing runtime-agnostic algorithm.

## Anti-Patterns

### Anti-Pattern 1: Letting a spine-core type name appear in `core/types.ts` or `sampler.ts`

**What people do:** `import type { Skeleton } from '@esotericsoftware/spine-core'` in shared code "just for the type".
**Why it's wrong:** it binds the math layer to one runtime's type universe; the structural-typing overlap then silently accepts the wrong runtime's objects (§3 risk). It also re-introduces a spine-core import into files the new arch.spec anchor forbids.
**Do this instead:** opaque branded handles in `runtime/types.ts`; spine-core type names live only inside the two adapter files.

### Anti-Pattern 2: Sharing 4.2 golden values as the 4.3 path's expected output

**What people do:** reuse `SIMPLE_TEST` goldens to assert the 4.3 runtime.
**Why it's wrong:** the 4.3 Pose refactor changed constraint/transform internals; equivalence is *expected* but **not contractually guaranteed**, and `SIMPLE_TEST` is a 4.2 export the 4.3 loader reads in forward-compat mode (not a native 4.3 rig — won't exercise Slider/4.3 constraints at all).
**Do this instead:** native 4.3 fixture with its own captured baseline (UNIT 6); cross-runtime agreement is a *sentinel within 1e-3 tolerance*, not a shared golden.

### Anti-Pattern 3: Eagerly importing both spine-core copies in the worker

**What people do:** top-level `import` of both runtime modules in `pickRuntime` for simplicity.
**Why it's wrong:** doubles module-init + resident JS in every worker for zero benefit (a skeleton is exactly one version).
**Do this instead:** conditional `require()`/`import()` of only the matched runtime (§4).

## Integration Points

| Boundary | Communication | Notes |
|----------|---------------|-------|
| loader.ts ↔ runtime/* | `pickRuntime(tag)` factory; `SpineRuntime` interface | Detection point unchanged from v1.4; only the 4.3 arm's action flips throw→route |
| sampler.ts/bounds.ts ↔ runtime | `load.runtime.*` calls; opaque handles | The compile-time wall enforcing dual-universe separation |
| runtime-42 ↔ spine-core 4.2.111 | direct import | Verbatim relocation of today's calls — golden-preserving |
| runtime-43 ↔ spine-core-43 (4.3.0 alias) | direct import | Pose API; native `AtlasAttachmentLoader(atlas, true)` for atlas-less |
| worker ↔ runtime | indirect (via loader) | Worker stays runtime-blind; lazy require keeps one copy resident |
| renderer ↔ spine-player 4.3.0 | single version bump | Player handles both 4.2 + 4.3 JSON natively; NOT dual-runtime; renderer ↛ core boundary unchanged |

---

## Beta-vs-Stable Drift (vs SEED-006 inventory) — FLAGGED

Verified against the published `@esotericsoftware/spine-core@4.3.0` tarball (`dist/*.d.ts` + `dist/*.js`), confirmed stable (`package.json` version `4.3.0`, npm `latest`).

| SEED-006 (beta inventory) claim | Stable 4.3.0 reality | Severity |
|---|---|---|
| `setToSetupPose`→`setupPose`, `setSlotsToSetupPose`→`setupPoseSlots` | ✅ Confirmed (`Skeleton.d.ts:115,119`) | matches |
| `setAnimationWith`→`setAnimation` | ✅ Confirmed — 4.3 `setAnimation` has both string + Animation-object overloads (`AnimationState.d.ts:89,98`) | matches |
| `slot.getAttachment()`→`slot.pose.attachment` | ✅ Confirmed AND broader: `slot.color` ALSO moved to `slot.pose.color`. `Slot` declares NO `getAttachment`/`color` — both on `SlotPose` (`Slot.d.ts`, `SlotPose.d.ts:36,41,54`). sampler.ts:609 (`slot.getAttachment()`) AND sampler.ts:615 (`slot.color.a`) BOTH break. | **WIDER than SEED-006** |
| Region `computeWorldVertices` adds `vertexOffsets` **last**: `(slot,wv,off,stride,vertexOffsets)` | ❌ **WRONG.** Stable: `(slot, vertexOffsets, worldVertices, offset, stride)` — `vertexOffsets` is the **2nd** arg. AND `RegionAttachment` no longer has a mutable `offset[]`; caller supplies offsets via `attachment.getOffsets(slot.pose)` (resolves through `Sequence`). (`RegionAttachment.d.ts:69-70`, `.js:79-106`) | **ARCHITECTURAL — SEED-006 signature is incorrect** |
| Vertex `computeWorldVertices` adds `skeleton` first arg | ✅ Confirmed `(skeleton, slot, start, count, worldVertices, offset, stride)` (`Attachment.d.ts:77`) | matches |
| (not in SEED-006) `bone.getWorldScaleX/Y()` | ❌ **MISSING FROM SEED-006.** Moved to `bone.appliedPose.getWorldScaleX/Y()` (`BonePose.d.ts:113,115`; `Bone` declares neither). bounds.ts:396-397 (`slot.bone.getWorldScaleX()`) AND :383-384 (`bone.getWorldScaleX()`) break. | **UNFLAGGED DELTA** |
| (not in SEED-006) `loader.ts` Phase 33 rotated-region patch writes `attachment.offset[0..7]` directly (loader.ts:599-607) | ❌ **MISSING FROM SEED-006.** Stable 4.3 `RegionAttachment` has no settable `offset[]` member; the Phase 33 patch's mechanism does not exist on 4.3. The rotated-region fix must be re-expressed for the 4.3 model (the offsets now flow through `Sequence`/`getOffsets`). 4.2 path unaffected (runtime-42 keeps it verbatim). | **UNFLAGGED DELTA — affects rotated-atlas support on 4.3** |
| `VertexAttachment` is its own module | ❌ Consolidated into `attachments/Attachment.js` (still exported from package index). `import { VertexAttachment }` from the package root still works (`index.d.ts`); bounds.ts:31-41 named imports survive the move. | minor (import-path internal only) |
| `Slider`/`SliderData`/`SliderTimeline`/`SliderMixTimeline` new | ✅ Confirmed (`Slider.d.ts`); `Slider extends Constraint`, `update(skeleton, physics)` — consistent with PORT-03's "propagates via updateWorldTransform" hypothesis (must be fixture-proven, UNIT 6) | matches |
| `AtlasAttachmentLoader` constructor | ⚠ Now `(atlas, allowMissingRegions?: boolean)` — 4.3 has a NATIVE silent-skip; the custom `SilentSkipAttachmentLoader` (synthetic-atlas.ts) is **4.2-only** on the 4.3 path | simplification opportunity |
| SEED-006: "plan as 4-task phase" | ❌ Confirmed low. Stable surface = 5 renames + `slot.color` + `bone.appliedPose` + Region-sig-different + rotated-offset-mechanism-gone + dual-type-universe + lazy-worker-load + new fixture + player bump. 4–6 phases. | **SCOPE FLAG for roadmapper** |

**Net:** SEED-006's PORT-01/PORT-02 inventory is directionally right but **undercounts by three concrete API surfaces** (`slot.color`, `bone.appliedPose.getWorldScaleX/Y`, the gone `RegionAttachment.offset[]` that Phase 33's rotated-atlas patch depends on) and **mis-states the Region `computeWorldVertices` signature**. The facade architecture absorbs all of these in `runtime-43.ts` without touching the math algorithms — which is precisely why the facade is the recommended pattern and why duplication (Pattern 2) would have multiplied this drift across two algorithm copies.

## Sources

- `@esotericsoftware/spine-core@4.3.0` npm tarball — `dist/*.d.ts` + `dist/*.js` (Skeleton, Slot, SlotPose, Bone, BonePose, Posed, PosedActive, RegionAttachment, Attachment[VertexAttachment], MeshAttachment, AnimationState, SkeletonData, SkeletonJson, AtlasAttachmentLoader, Skin, Slider, Physics). **Authoritative stable source — verified, HIGH confidence.** Probed 2026-05-16 via `npm pack @esotericsoftware/spine-core@4.3.0`.
- `@esotericsoftware/spine-player@4.3.0` npm tarball — `package.json` (`@esotericsoftware/spine-webgl@4.3.0` dependency confirming player embeds 4.3 core).
- `npm view @esotericsoftware/spine-core@latest` → `4.3.0`; `@esotericsoftware/spine-player@latest` → `4.3.0` (SEED-006 trigger confirmed fired).
- Project source — `src/core/loader.ts`, `sampler.ts`, `bounds.ts`; `src/main/sampler-worker.ts`, `sampler-worker-bridge.ts`; `tests/arch.spec.ts` (read 2026-05-16).
- `.planning/PROJECT.md`, `SEED-006`, `SEED-003` (locked decisions + beta inventory being corrected).
- CLAUDE.md facts #2 (delegation of spine math — drives Pattern 3 rejection), #3/#5/#6 (Layer-3 invariant, sampler lifecycle).

---
*Architecture research for: dual spine-core runtime port (v1.6)*
*Researched: 2026-05-16*
