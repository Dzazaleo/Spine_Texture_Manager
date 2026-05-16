# Phase 43: Runtime-Adapter Facade + Verified 4.3 API Mapping - Research

**Researched:** 2026-05-17
**Domain:** Dual spine-core adapter bodies (4.2.111 + 4.3.0) behind a locked `SpineRuntime` interface; runtime-agnostic `core/sampler.ts` + `core/bounds.ts` + `core/loader.ts` parse seam; SAFE-02 byte-equal 4.2 gate
**Confidence:** HIGH — every API claim below is verified against the **actual installed tarballs** on this machine (`node_modules/@esotericsoftware/spine-core` = 4.3.0 canonical, `node_modules/spine-core-42` = 4.2.111 alias), cited with exact file paths + line numbers.

## Summary

This phase has no greenfield surface. The `SpineRuntime` interface (`src/core/runtime/runtime.ts`, ~40 signatures) and the opaque-handle factory (`src/core/runtime/types.ts`) are **already built and locked** by Phase 42. Phase 43 writes exactly two implementation bodies (`runtime-42.ts` = verbatim relocation, `runtime-43.ts` = the verified Pose-API port), the `pickRuntime` switch, rewires `sampler.ts`/`bounds.ts`/`loader.ts` to call `load.runtime.*`, adds the `tests/arch.spec.ts` no-direct-import anchor, and proves the 4.2 path byte-identical against the frozen Phase-42 SAFE-01 baseline. `loader.ts` hard-picks `pickRuntime('4.2')` unconditionally (D-02 — no version detection until Phase 44).

The four Research Flags in CONTEXT.md are now **source-confirmed** against the installed 4.3.0 `.d.ts` + compiled `.js`:

1. **`RegionAttachment.getOffsets(slot.pose)`** returns `this.sequence.offsets[this.sequence.resolveIndex(pose)]` — a **pre-allocated `number[]` of 8 floats**, NOT a fresh allocation per call (verified `RegionAttachment.js:103-106`). The Phase-33 mutable `offset[]` patch is structurally impossible on 4.3 (`RegionAttachment` has no settable `offset[]`; it `implements HasSequence`, not `HasTextureRegion`). The 4.3 rotated-region fix re-expresses Phase-33's math through the `Sequence` (see PORT-03 finding below).
2. **Cross-runtime `instanceof`** — `bounds.ts` must drop `instanceof` entirely and route through `rt.attachmentKind(a)` (a string discriminant the interface already declares). Each adapter implements `attachmentKind` with `instanceof` against **its own** runtime's classes. SAFE-03 backstops this with an `instanceof`-against-loading-runtime regression.
3. **D-03 structural defense** — 4.3 splits every posed object into `pose` (unconstrained), `constrainedPose`, and `appliedPose` (post-constraint). `runtime-43.ts` reads world transforms **only** via `bone.appliedPose.getWorldScaleX/Y()` and `slot.pose.attachment` (`SlotPose` IS the applied attachment binding — confirmed). The adapter never accepts/returns an `OpaqueBone`, so a raw `bone.pose` read is unreachable through the facade surface by construction (the interface exposes `boneAxisScale(slot)` only). A dev-mode assertion guards it.
4. **Atlas-format-is-editor-driven** — VERIFIED and **largely a non-issue for Phase 43**. The existing frozen 4.2 corpus (`SIMPLE_TEST.atlas` etc.) is **already in the new libgdx format** (`size:W,H`, `bounds:x,y,w,h`, `rotate:90`, no `format:`/`repeat:`). Both 4.2.111 and 4.3.0 `TextureAtlas` parsers read it (SAFE-01 is currently green on this corpus through 4.2.111). The only legacy-format in-repo atlases are version-reject canaries (`SPINE_3_8_TEST`, `SPINE_4_3_TEST`) that never reach `makeAtlas`. The 4.2-sibling `skeleton2_42.atlas` concern is **Phase 44**, not Phase 43.

**Primary recommendation:** Implement `runtime-42.ts` as a byte-faithful relocation of the exact spine-core call shapes in today's `sampler.ts`/`bounds.ts`/`loader.ts` (the SAFE-02 gate is satisfied by construction if you change *nothing* but the import path and the wrapper indirection). Implement `runtime-43.ts` against the verified mapping table below. Make `bounds.ts` `instanceof`-free and `attachment.region`-free (4.3 removed `.region` from both `RegionAttachment` and `MeshAttachment` — both are now `HasSequence`-only). Read world state exclusively from `appliedPose`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (4.3 evidence bar):** The 4.3 owner rig is already in-repo: `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`"spine":"4.3.01"`, top-level `constraints[]`, real atlas with `rotate:90`). Phase 43's 4.3 evidence is **real-rig sampled, not smoke-only**: (a) `runtime-43.ts` samples it without throw; (b) it exercises every API-mapped surface; (c) byte-stable against its **own freshly-captured 4.3 baseline**, captured in Phase 43, stored **separate** from SAFE-01, **NOT golden-shared** with 4.2; (d) its `TransformConstraint` is the `appliedPose` correctness canary; (e) its `rotate:90` regions exercise the PORT-03 4.3 rotated-atlas re-expression. The cross-runtime 1e-4 equivalence proof stays Phase 44. Phase 43's **only HARD exit gate is SAFE-02** (4.2 byte-equal); the 4.3 own-baseline is a Phase-43 deliverable but a regression sentinel, NOT the phase-stop gate. `fixtures/SPINE_4_3_TEST/` is a 1×1-atlas parser-reject canary — NOT a sampling fixture.

- **D-02 (loader scope):** **Full parse-relocation, hard-pick 4.2.** `loader.ts`'s `SkeletonJson`/`TextureAtlas`/`AtlasAttachmentLoader` construction AND the Phase-33 rotated-region patch move into `runtime-42.ts` (`parseSkeleton`/`makeAtlas`/`applyRotatedRegionFix`). `loader.ts` drops its direct `spine-core-42` import and obtains everything via the runtime. The loader **hard-picks `pickRuntime('4.2')` unconditionally** — NO version detection this phase (Phase 44 DISP-01). Consequence: SAFE-02 byte-gates the **entire 4.2 path including parse/atlas/rotated-region** through the adapter.

- **D-03 (wrong-pose defense):** **Structural defense-in-depth.** `runtime-43.ts` exposes **only `appliedPose`-derived world reads** — no raw `bone.pose`/pre-constraint accessor reachable through the adapter surface — plus a dev-mode assertion guarding wrong-pose reads. Closes the existential undersize failure mode inside Phase 43, not after Phase 44's oracle.

- **D-04 (heavy-rig exit rigor):** Phase 43 **cannot CLOSE** until SAFE-02 byte-equal is run **locally against the heavy/proprietary rigs** (`fixtures/Girl/`, `fixtures/SKINS/`, `fixtures/CHJ/`, `fixtures/3Queens/`, `fixtures/Jokerman/` — gitignored, present locally, presence-guarded per Phase-42 D-08-R) **with the result documented in verification**. CI-green over the redistributable subset is necessary but NOT sufficient to close.

- **D-05 (ORCL-01 fixture exclusion):** The new `fixtures/SIMPLE_PROJECT_43/` pair (4.3 `skeleton2.json` + 4.2 `skeleton2_42.json`) is the Phase-44 ORCL-01 oracle pair. It **postdates the Phase-42 frozen SAFE-01 baseline**, so it MUST be **explicitly EXCLUDED** from (i) the SAFE-02 byte-equal regression set and (ii) the Phase-42 D-08 auto-discovery/enumeration assertion. Phase 43 touches **only the 4.3 file** (runtime-43 sampling + its own 4.3 baseline); the 4.2 sibling is reserved **untouched** for Phase 44.

### Claude's Discretion

- SAFE-03 cross-runtime `instanceof` regression mechanics (invariant locked; test shape delegated — but see Research Flags: the invariant needs explicit design — provided below).
- `runtime-42.ts` verbatim-relocation exact boundary (which calls relocate, the `as unknown as Opaque*` boundary-cast shape — quarantined to `brandHandle`/`unwrapHandle`).
- `pickRuntime` sync `require()` vs async (ARCHITECTURE §4 recommends conditional sync `require` under the CJS worker bundle so `loadSkeleton` stays sync — default lean: sync require).
- electron-vite worker chunk-split so `runtime-42`/`runtime-43` emit as separate chunks (only the matched spine-core copy loads per job).
- Fixture internal filenames / any normalization (planner) — directory name `fixtures/SIMPLE_PROJECT_43/` is **locked** (Phase-44 CI guard checks it char-for-char); internal `skeleton2.*` / `skeleton2_42.*` names are fine.

### Deferred Ideas (OUT OF SCOPE)

- Loader version detection/dispatch + the `>=4.4` reject arm + `checkSpine43Schema` rejecter→router repurpose (Phase 44 DISP).
- The 6 reject-assertion test-file inversions + copy/docs sweep (Phase 45 UX).
- The cross-runtime **1e-4 equivalence oracle** (Phase 44 ORCL-02, consumes the `SIMPLE_PROJECT_43` pair).
- The closed-form slider oracle + 4.3 perf budget (Phase 46).
- The `spine-player` 4.3 bump (Phase 47 — `package.json` still pins `@esotericsoftware/spine-player@4.2.111`; confirmed, do NOT touch).
- Remaining owner exports SLIDER-01/XTRA-01/XTRA-02 (off Phase-43 critical path).
- Commit of `fixtures/SIMPLE_PROJECT_43/` — folded into Phase 43/44 execution.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RT-02 | `sampler.ts`/`bounds.ts` no longer import spine-core directly; both call `load.runtime.*`; `tests/arch.spec.ts` anchor enforces it; `runtime-42`+`runtime-43` exist in `core/runtime/` | Interface is locked (verified `runtime.ts`); call-site inventory below maps every `from 'spine-core-42'` import + every spine-core call to its `rt.*` method. `loader.ts` parse seam relocates per D-02. Arch.spec extension pattern verified (existing globSync scanner at `arch.spec.ts:148-178`). |
| SAFE-02 | Every pre-v1.6-baselined 4.2 fixture sampled through the new adapter is byte-identical (strict `toEqual`, not epsilon) to the Phase-42 SAFE-01 baseline — HARD PHASE-EXIT GATE | SAFE-01 harness verified (`safe01-baseline.spec.ts`, `discover-fixtures.ts`). `runtime-42.ts` is golden-preserving **by construction** if it relocates the exact call shapes. SAFE-02 = re-run the existing harness through the rewired path; the baseline files stay frozen (D-09 freeze guard verified). |
| SAFE-03 | A regression proves each loaded skeleton's attachments resolve `instanceof` (Region/Vertex/Mesh) against the same runtime instance that loaded it; cross-runtime mixing caught | Explicit invariant design provided (Pitfall 6 section). `attachmentKind` is the discriminant; SAFE-03 asserts the loaded-runtime's `attachmentKind` matches a known classification AND that a deliberately cross-fed handle is detected. |
| PORT-01 | 4.3 skeleton samples via `setupPose`/`setupPoseSlots`/`setupPoseBones`, overloaded `setAnimation`, `slot.pose.attachment`, `slot.pose.color`, AnimationState `setTrack`/`getTrack`, reading post-constraint `appliedPose` | Full verified API mapping table below — every name confirmed in installed 4.3.0 `.d.ts` with line numbers. |
| PORT-02 | `bounds.ts` (via adapter) computes world vertices for 4.3 `RegionAttachment` (`vertexOffsets` 2nd arg via `getOffsets(slot.pose)`) and `VertexAttachment` (`skeleton` 1st arg), reads bone world scale via `bone.appliedPose.getWorldScaleX/Y()` | Signatures verified verbatim from installed `RegionAttachment.d.ts:69`, `Attachment.d.ts:77`, `BonePose.d.ts:113-115`. **NEW finding:** `MeshAttachment.region` is GONE in 4.3 — the `hullAreaRatio` page-dim path needs re-expression via `sequence.regions[]`. |
| PORT-03 | The v1.4 Phase-33 rotated-atlas offset mechanism re-expressed for 4.3 (no mutable `offset[]`) with the 4.2 rotated-atlas path unchanged and regression-locked | `Sequence.update()` (`Sequence.js:83-103`) computes offsets via `RegionAttachment.computeUVs` — the SAME math as Phase-33's patch. The 4.3 re-expression mutates `attachment.sequence.offsets[i]` (or recomputes via `computeUVs`); detailed below. 4.2 path keeps the verbatim Phase-33 `attachment.offset[]` write inside `runtime-42.applyRotatedRegionFix`. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| spine-core API version delta absorption | `core/runtime/runtime-42.ts` + `runtime-43.ts` (Layer 3) | — | The ONLY two files that may import a spine-core package; the entire port scope localizes here |
| Runtime selection (hard-pick 4.2) | `core/loader.ts` (Layer 3) | `core/runtime/runtime.ts` `pickRuntime` | D-02: detection is Phase 44; Phase 43 wires `pickRuntime('4.2')` unconditionally |
| Skeleton parse / atlas parse / rotated-region fix | `core/runtime/runtime-42.ts` (relocated from `loader.ts`) | — | D-02 full parse-relocation; SAFE-02 byte-gates this surface |
| Peak-scale algorithm (sampler ~750 lines) | `core/sampler.ts` (Layer 3) | — | Logic UNCHANGED; only ~12 leaf spine-core calls move behind `rt.*` |
| AABB + render-scale math | `core/bounds.ts` (Layer 3) | — | Logic UNCHANGED; `instanceof` chain → `rt.attachmentKind`; `attachment.region` → adapter meta |
| Cross-runtime type isolation | `core/runtime/types.ts` opaque handles (Layer 3) | TypeScript `unique symbol` brand | Already built Phase 42; the compile-time wall |
| Worker runtime-blindness | `src/main/sampler-worker.ts` (Layer 2) | — | UNCHANGED — runtime selected inside `loadSkeleton`; lazy single-copy load |
| Renderer / spine-player | `src/renderer/` | — | UNTOUCHED in Phase 43 — player stays 4.2.111 (Phase 47) |

## Project Constraints (from CLAUDE.md)

- **`core/` is pure TypeScript, no DOM** — `runtime-42.ts`/`runtime-43.ts` import only a spine-core package (already a sanctioned core dep; `arch.spec.ts:148-178` globSync forbids `sharp`/`node:fs` — adapters pass with NO new carve-out because they import neither).
- **Sampler lifecycle order is LOCKED (rule #3):** `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` — every tick, that order. The adapter wrappers MUST preserve this exact call sequence (the interface already names them `stateUpdate`/`stateApply`/`skeletonUpdate`/`updateWorldTransform` in that semantic order).
- **The math phase does not decode PNGs** — `runtime-43.makeAtlas` uses the same stub-texture pattern as today's `loader.ts:createStubTextureLoader` (4.3 ships a `FakeTexture` in `Texture.d.ts:67`; the project's `StubTexture` subclass pattern relocates verbatim into `runtime-42.ts`).
- **Spine animations are in seconds, sampling rate is our choice (120 Hz default)** — no adapter method touches `skeleton.fps`; `editorFps` plumbing in `loader.ts` is display-only and stays in `loader.ts` (it reads `skeletonData.fps` — `SkeletonData.d.ts:74`, present in both runtimes).
- **Release tag conventions** — N/A this phase (no version bump).
- **`temp/` is gitignored owner source** — N/A; fixtures live in `fixtures/`.

## Standard Stack

No new dependencies. The stack is locked and **already installed at the correct versions** (verified on disk):

| Package | Installed Version | Role | Verified |
|---------|-------------------|------|----------|
| `@esotericsoftware/spine-core` | **4.3.0** (canonical) | The 4.3 Pose-architecture runtime — `runtime-43.ts` imports this | `node_modules/@esotericsoftware/spine-core/package.json` → `"version": "4.3.0"` |
| `spine-core-42` | **4.2.111** (alias → `@esotericsoftware/spine-core@4.2.111`) | The retained regression-gated 4.2 runtime — `runtime-42.ts` imports this | `node_modules/spine-core-42/package.json` → `"name": "@esotericsoftware/spine-core", "version": "4.2.111"` |
| `@esotericsoftware/spine-player` | **4.2.111** (UNCHANGED) | Renderer viewer — **NOT touched in Phase 43** (Phase 47) | `package.json:27` → `"@esotericsoftware/spine-player": "4.2.111"` |
| vitest | 4.x | SAFE-02 / SAFE-03 / 4.3-baseline harness | `package.json:55` |

**No installation step.** The alias direction (4.3 canonical / 4.2 aliased as `spine-core-42`) was landed in Phase 42 and is verified live on disk. `package.json:26` = `"@esotericsoftware/spine-core": "4.3.0"`; `package.json:35` = `"spine-core-42": "npm:@esotericsoftware/spine-core@4.2.111"`.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Thin adapter facade (locked Phase 42) | Duplicated sampler-42/sampler-43 | REJECTED in ARCHITECTURE.md — forks the ~750-line determinism contract; the runtime delta is ~12 leaf calls. Not re-litigated. |
| `appliedPose`-only adapter surface (D-03) | comment + oracle (research-spec'd) | D-03 strengthens to structural: pre-constraint read unreachable through the facade. This IS the locked decision. |
| `rt.attachmentKind` string discriminant | exported-class `instanceof` in `bounds.ts` | Cross-runtime `instanceof` is the #1 correctness hazard (Pitfall 6). The interface already chose the discriminant — implement it. |

## Architecture Patterns

### System Architecture Diagram

```
JSON path
   │
   ▼  loader.ts (D-02: parse seam relocated, hard-pick 4.2)
   │   ├─ JSON.parse → version guard (checkSpineVersion UNCHANGED — still throws <4.2/≥4.3)
   │   ├─ rt = pickRuntime('4.2')         ← HARD-CODED tag; NO detection (Phase 44)
   │   ├─ atlas resolution 4-way branch (UNCHANGED control flow; D-06/07/08/05)
   │   ├─ rt.makeAtlas(atlasText)          ← was: new TextureAtlas(...) + stub loader
   │   ├─ rt.parseSkeleton(json, atlas, isAtlasLess)  ← was: new SkeletonJson(new AtlasAttachmentLoader(...))
   │   ├─ rt.applyRotatedRegionFix(data)   ← was: the loader.ts:552-613 offset[] patch
   │   └─ LoadResult { ..., runtime: rt }  ← types.ts:190 (optional → now populated)
   │
   ▼  (worker boundary — path-based; SkeletonData never crosses postMessage)
   │
sampler.ts  (algorithm byte-unchanged; ~12 leaf calls → rt.*)
   │   ├─ rt.makeSkeleton / rt.makeAnimationState
   │   ├─ for skin: rt.setSkin / rt.setupPose / rt.setupPoseSlots / rt.clearTracks
   │   ├─ Pass 1.5: rt.skinEntries(skin) → rt.slots / rt.slotName
   │   ├─ for anim: rt.setAnimation(st, 0, anim, false)
   │   ├─ LOCKED TICK: rt.stateUpdate → rt.stateApply → rt.skeletonUpdate → rt.updateWorldTransform('update')
   │   └─ per visible slot: rt.slotAttachment / rt.slotColorAlpha
   │
   ▼
bounds.ts  (math byte-unchanged; instanceof-free)
   │   ├─ rt.attachmentKind(a)             ← was: a instanceof RegionAttachment/...
   │   ├─ rt.regionWorldVertices(slot, a)  ← was: a.computeWorldVertices(slot, v, 0, 2)
   │   ├─ rt.vertexWorldVertices(sk, slot, a) ← was: a.computeWorldVertices(slot, 0, n, v, 0, 2)
   │   ├─ rt.boneAxisScale(slot)           ← was: slot.bone.getWorldScaleX/Y()
   │   └─ rt.attachmentRegionMeta(a) / rt.attachmentUVs(a) / rt.sequenceRegions(a)
   │
   ▼
PeakRecord (runtime-agnostic) → analyzer.ts → SkeletonSummary  [UNCHANGED downstream]

         ┌──── runtime-42.ts ────┐        ┌──── runtime-43.ts ────┐
         │ import 'spine-core-42'│        │ import '@esoteric.../  │
         │  (4.2.111)            │        │  spine-core' (4.3.0)   │
         │ VERBATIM call shapes  │        │ Pose API (verified)    │
         │ → SAFE-02 by construction      │ → 4.3 own-baseline     │
         └───────────────────────┘        └────────────────────────┘
              (only these two files import a spine-core package)
```

### Recommended Project Structure

```
src/core/
├── loader.ts          # MODIFIED — drop spine-core-42 import; rt.makeAtlas/parseSkeleton/
│                       #            applyRotatedRegionFix; runtime: pickRuntime('4.2') (D-02)
├── sampler.ts         # MODIFIED — drop spine-core-42 import; ~12 leaf calls → load.runtime.*
├── bounds.ts          # MODIFIED — drop spine-core-42 import; instanceof → rt.attachmentKind;
│                       #            attachment.region/.uvs → rt.attachmentRegionMeta/attachmentUVs
├── runtime/
│   ├── runtime.ts     # MODIFIED — implement the `pickRuntime` body (was `declare`); interface LOCKED
│   ├── types.ts       # UNCHANGED — brandHandle/unwrapHandle/handleRuntime bodies already present
│   ├── runtime-42.ts  # NEW — verbatim 4.2.111 relocation (SAFE-02 by construction)
│   └── runtime-43.ts  # NEW — verified 4.3.0 Pose-API port (D-03 appliedPose-only)
├── types.ts           # UNCHANGED — LoadResult.runtime already declared (types.ts:187-190)
└── synthetic-atlas.ts # UNCHANGED — SilentSkipAttachmentLoader stays 4.2-only; relocated call site
                        #             moves into runtime-42.parseSkeleton's atlas-less branch

tests/
├── arch.spec.ts       # MODIFIED — add named anchor: sampler/bounds/loader ↛ spine-core import
├── safe01/            # MOSTLY UNCHANGED — SAFE-02 re-runs this harness through the rewired path;
│   │                  #                    baselines FROZEN (D-09 guard); D-05 exclusion already
│   │                  #                    holds (SIMPLE_PROJECT_43 not git-tracked → not discovered)
│   └── ...
└── (NEW) 4.3 own-baseline spec  # captures + freezes the runtime-43 SamplerOutput for skeleton2.json
                                  # SEPARATE from SAFE-01 (NOT golden-shared — D-01)
```

### Pattern 1: Verbatim relocation (runtime-42.ts) — SAFE-02 by construction

**What:** Every spine-core call shape currently in `sampler.ts`/`bounds.ts`/`loader.ts` moves into `runtime-42.ts` **unchanged**, wrapped behind the interface, with `brandHandle`/`unwrapHandle` as the only boundary cast.

**When to use:** The 4.2 adapter, entirely. This is the safety net — if the 4.2 calls are byte-identical and only the import path + indirection changed, SAFE-02 cannot move (the 4.2.111 runtime is unchanged spine-core; any drift is a plumbing bug).

**Example (verified shapes from the current code):**
```typescript
// runtime-42.ts — Source: today's bounds.ts:64-89, loader.ts:528-529, sampler.ts:308
import {
  Skeleton, AnimationState, AnimationStateData, Physics, AttachmentTimeline,
  AtlasAttachmentLoader, SkeletonJson, TextureAtlas, Texture, TextureFilter, TextureWrap,
  RegionAttachment, VertexAttachment, MeshAttachment,
  BoundingBoxAttachment, PathAttachment, PointAttachment, ClippingAttachment,
} from 'spine-core-42';
import { brandHandle, unwrapHandle } from './types.js';
import type { OpaqueSkeleton, OpaqueSlot, OpaqueAttachment /* ... */ } from './types.js';

// regionWorldVertices — VERBATIM today's bounds.ts:65-67
regionWorldVertices(slot: OpaqueSlot, a: OpaqueAttachment): Float32Array {
  const s = unwrapHandle<Slot42>(slot);
  const att = unwrapHandle<RegionAttachment>(a);
  const v = new Float32Array(8);
  att.computeWorldVertices(s, v, 0, 2);          // 4.2.111 signature: (slot, wv, 0, 2)
  return v;
}

// setAnimation — VERBATIM today's sampler.ts:308 (4.2.111 split: setAnimationWith for the obj)
setAnimation(st: OpaqueAnimationState, track: number, anim: OpaqueAnimation, loop: boolean): void {
  unwrapHandle<AnimationState>(st).setAnimationWith(track, unwrapHandle<Animation42>(anim), loop);
}

// boneAxisScale — VERBATIM today's bounds.ts:396-397
boneAxisScale(slot: OpaqueSlot): { x: number; y: number } {
  const bone = unwrapHandle<Slot42>(slot).bone;
  return { x: Math.abs(bone.getWorldScaleX()), y: Math.abs(bone.getWorldScaleY()) };
}
```

**Critical detail:** `sampler.ts:308` currently calls `state.setAnimationWith(0, anim, false)` (the 4.2.111 split where `setAnimation` takes a string and `setAnimationWith` takes the `Animation` object — confirmed `node_modules/spine-core-42/dist/AnimationState.d.ts`). The interface method is `setAnimation(st, track, anim, loop)`; `runtime-42` maps it to `.setAnimationWith(...)`; `runtime-43` maps it to the overloaded `.setAnimation(track, Animation, loop?)` (4.3.0 — `AnimationState.d.ts:98`).

### Pattern 2: Verified 4.3 Pose-API port (runtime-43.ts)

**What:** Each interface method maps to the 4.3.0 Pose-architecture API per the verified table below.

**When to use:** The 4.3 adapter, entirely. Written against the installed `.d.ts`, NOT SEED-006.

#### Verified 4.3.0 ↔ 4.2.111 API mapping (every claim cited to an installed file)

| Interface method | 4.2.111 (`runtime-42`) | 4.3.0 (`runtime-43`) | 4.3 citation |
|---|---|---|---|
| `setupPose(sk)` | `sk.setToSetupPose()` | `sk.setupPose()` | `Skeleton.d.ts:115` |
| `setupPoseSlots(sk)` | `sk.setSlotsToSetupPose()` | `sk.setupPoseSlots()` | `Skeleton.d.ts:119` |
| (setup-pose bones — used by `setupPose` chain) | `sk.setBonesToSetupPose()` | `sk.setupPoseBones()` | `Skeleton.d.ts:117` |
| `setAnimation(st,t,anim,loop)` | `st.setAnimationWith(t,anim,loop)` | `st.setAnimation(t, anim, loop)` (Animation overload) | `AnimationState.d.ts:98` |
| `clearTracks(st)` | `st.clearTracks()` | `st.clearTracks()` (identical) | `AnimationState.d.ts:79` |
| `stateUpdate(st,dt)` | `st.update(dt)` | `st.update(dt)` (identical) | `AnimationState.d.ts:59` |
| `stateApply(st,sk)` | `st.apply(sk)` | `st.apply(sk)` (identical, returns boolean) | `AnimationState.d.ts:65` |
| `skeletonUpdate(sk,dt)` | `sk.update(dt)` | `sk.update(dt)` (identical) | `Skeleton.d.ts:199` |
| `updateWorldTransform(sk,mode)` | `sk.updateWorldTransform(Physics.X)` | `sk.updateWorldTransform(Physics.X)` (identical; `Physics` enum unchanged) | `Skeleton.d.ts:113` |
| `setSkin(sk,skin)` | `sk.setSkin(skin)` | `sk.setSkin(skin)` (Skin overload) | `Skeleton.d.ts:141` |
| `slots(sk)` | `sk.slots` | `sk.slots` (`readonly Slot[]`) | `Skeleton.d.ts:56` |
| `slotName(slot)` | `slot.data.name` | `slot.data.name` (`Posed<SlotData,SlotPose>`) | `Slot.d.ts:38`, `Posed.d.ts:38` |
| `slotAttachment(slot)` | `slot.getAttachment()` | **`slot.pose.attachment`** (or `slot.pose.getAttachment()`) | `SlotPose.d.ts:41,54`; `Slot extends Posed`, `pose` from `Posed.d.ts:39` |
| `slotColorAlpha(slot)` | `slot.color.a` | **`slot.pose.color.a`** | `SlotPose.d.ts:36` (`readonly color: Color`); `Slot` declares NO `color` |
| `boneAxisScale(slot)` | `slot.bone.getWorldScaleX/Y()` | **`slot.bone.appliedPose.getWorldScaleX/Y()`** | `BonePose.d.ts:113,115`; `Bone` declares NEITHER (D-03 anchor) |
| `attachmentKind(a)` | `a instanceof RegionAttachment/...` (4.2 classes) | `a instanceof RegionAttachment/...` (4.3 classes) | own-runtime classes; see Pitfall 6 |
| `regionWorldVertices(slot,a)` | `a.computeWorldVertices(slot, v, 0, 2)` | `a.computeWorldVertices(slot, a.getOffsets(slot.pose), v, 0, 2)` — **vertexOffsets is 2nd arg** | `RegionAttachment.d.ts:69`, `.js:79`; `getOffsets` `.js:103-106` |
| `vertexWorldVertices(sk,slot,a)` | `a.computeWorldVertices(slot, 0, n, v, 0, 2)` | `a.computeWorldVertices(sk, slot, 0, n, v, 0, 2)` — **skeleton is 1st arg** | `Attachment.d.ts:77` (VertexAttachment) |
| `parseSkeleton(json,atlas,less)` | `new SkeletonJson(loader).readSkeletonData(json)` | same shape; `new SkeletonJson(loader)` `.readSkeletonData(json)` | `SkeletonJson.d.ts:47,48` (identical signature) |
| `makeAtlas(text)` | `new TextureAtlas(text)` + stub `Texture` per page | `new TextureAtlas(text)` + stub `Texture`/`FakeTexture` per page | `TextureAtlas.d.ts:35`; `Texture.d.ts:67` (`FakeTexture`) |
| `applyRotatedRegionFix(data)` | the loader.ts:552-613 `attachment.offset[]` write (VERBATIM) | re-express via `Sequence` (no `offset[]`; see PORT-03 below) | `RegionAttachment.js:103-106`, `Sequence.js:83-103` |
| `skins(data)` | `data.skins` | `data.skins` (`Skin[]`) | `SkeletonData.d.ts:46` |
| `animations(data)` | `data.animations` | `data.animations` (`Animation[]`) | `SkeletonData.d.ts:55` |
| `skinEntries(skin)` | `skin.getAttachments()` → `{slotIndex,name,attachment}` | `skin.getAttachments()` → `SkinEntry{slotIndex,placeholder→name,attachment}` | `Skin.d.ts:70`, `SkinEntry` `Skin.d.ts:35-41` |
| `attachmentRegionMeta(a)` | `a.region` (TextureRegion: page/originalWidth/Height) | **`a.sequence.regions[a.sequence.resolveIndex(slot.pose)]`** — NO `a.region` in 4.3 | see PORT-02 NEW finding below |
| `attachmentUVs(a)` | `a.uvs` (on Region+Mesh) | `a.sequence.getUVs(idx)` / `a.regionUVs` (Mesh) — NO `a.uvs` in 4.3 | `Sequence.d.ts:63`, `MeshAttachment.d.ts:41` |
| `sequenceRegions(a)` | `a.sequence?.regions` (mapped to `{name}`) | `a.sequence.regions` (`TextureRegion[]`; `TextureAtlasRegion.name`) | `Sequence.d.ts:39`, `TextureAtlas.d.ts:54-67` |

#### PORT-02 NEW FINDING (not in upstream research — surface it to the planner)

In 4.3.0, **`MeshAttachment` no longer has a `region` property** (`MeshAttachment.d.ts:38` → `implements HasSequence`, not `HasTextureRegion`; verified there is no `region:` field; the only region access is via `sequence`). 4.2.111 has `region: TextureRegion | null` on `MeshAttachment` (`node_modules/spine-core-42/dist/attachments/MeshAttachment.d.ts:40`). The same is true for `RegionAttachment` (4.3 `implements HasSequence`, `RegionAttachment.d.ts:39`; 4.2 had `region` via `HasTextureRegion`).

**Impact:** `bounds.ts:219` (`attachment.region as {page?...}`) and `bounds.ts:247` (`attachment.region?.name`) and `bounds.ts:230` (`attachment.uvs`) break the abstraction on 4.3. These are **already routed through interface methods that exist** (`attachmentRegionMeta`, `attachmentUVs`, `sequenceRegions`) — the planner must ensure `bounds.ts`'s `hullAreaRatio` page-dim lookup and the `regionName` resolution go through those adapter methods, NOT direct `attachment.region`. The 4.3 implementation resolves the active region via `sequence.regions[sequence.resolveIndex(slot.pose)]` then reads `.page` / `.originalWidth` / `.originalHeight` off the `TextureAtlasRegion` (`TextureAtlas.d.ts:54-67` — those fields exist on the 4.3 region too). **Note:** `attachmentRegionMeta` currently takes `(a)` only; resolving the 4.3 active region needs the `SlotPose` (`sequence.resolveIndex(pose)`). The planner must decide: either thread `slot` into `attachmentRegionMeta`/`attachmentUVs` (interface is locked — this would be an interface change requiring escalation) OR the 4.3 impl uses `sequence.setupIndex` (the `resolveIndex` fallback when `pose.sequenceIndex === -1` — `Sequence.js:106-108`). For non-sequence attachments (the common case) `sequence.regions` has exactly 1 entry and `resolveIndex` returns 0 regardless of pose, so **`sequence.regions[sequence.regions.length === 1 ? 0 : sequence.setupIndex]` is pose-independent and safe for the locked `(a)`-only signature in the non-sequence case**. Sequence attachments already have a dedicated fan-out post-pass (`sampler.ts:352-405`) that handles per-frame regions separately, so the hull-area path only needs the setup/single region. **Flag this to the planner as the one place the locked interface may be insufficient — recommend the `setupIndex`/single-region resolution to avoid an interface change.**

#### PORT-03: 4.3 rotated-region re-expression (Research Flag 1, fully resolved)

**The Phase-33 mechanism (4.2, verbatim-preserved in `runtime-42.applyRotatedRegionFix`):** `loader.ts:552-613` walks all skins, and for each `RegionAttachment` with `region.degrees !== 0`, computes the corrected world-quad offsets and writes them into `attachment.offset[0..7]` directly (4.2's `RegionAttachment` has a mutable `offset: NumberArrayLike` — `node_modules/spine-core-42/dist/attachments/RegionAttachment.d.ts:62`). This bypasses spine-core 4.2's `RegionAttachment.updateRegion()` packed-dim bug for rotated regions.

**Why it's structurally impossible on 4.3:** 4.3 `RegionAttachment` has **no `offset[]` member at all** (`RegionAttachment.d.ts:39-108` — verified; it `implements HasSequence`). Offsets flow through the `Sequence`: `RegionAttachment.getOffsets(pose)` returns `this.sequence.offsets[this.sequence.resolveIndex(pose)]` (`RegionAttachment.js:103-106`), and `Sequence.update(attachment)` (called via `attachment.updateSequence()` → `Sequence.js:83-103`) populates `this.offsets[i]` by calling `RegionAttachment.computeUVs(this.regions[i], att.x, att.y, att.scaleX, att.scaleY, att.rotation, att.width, att.height, this.offsets[i], this.uvs[i])` for each region.

**The 4.3 re-expression — two viable approaches, recommend (A):**

- **(A) RECOMMENDED — Verify-then-no-op.** Read 4.3's `RegionAttachment.computeUVs` (`RegionAttachment.js:113-168`, verified). It already does the **correct** rotated math: it computes `localX2 = localX + region.width * regionScaleX`, `localY2 = localY + region.height * regionScaleY` using the region's own dims, applies the rotation matrix, AND handles `region.degrees === 90` for the UVs (`RegionAttachment.js:156-167`). This is **structurally the same formula Phase-33's patch re-derived** (compare `loader.ts:576-607` to `RegionAttachment.js:116-140` — they are the same `localX/localY/localX2/localY2 → rotation matrix → offset[0..7]` computation, with Phase-33's "SWAP" being the `region.height`/`region.width` substitution that 4.3's `computeUVs` already does natively via `region.width`/`region.height`). **Hypothesis (must be fixture-verified, not assumed): 4.3's native `Sequence.update` → `computeUVs` already produces correct rotated-region offsets, so `runtime-43.applyRotatedRegionFix` is a NO-OP (or just ensures `updateSequence()` was called).** The 4.3 own-baseline against `skeleton2.json` (which has `rotate:90` regions — verified: `TRIANGLE` and `rect` both have `rotate:90` in `skeleton2.atlas`) is the empirical proof. The Phase-33 bug was specific to 4.2's `RegionAttachment.updateRegion()` packed-dim layout; 4.3 rewrote that path through `computeUVs`/`Sequence` and the bug may not exist. **This is an `[ASSUMED]` claim flagged in the Assumptions Log — the planner must include a task that empirically validates the 4.3 rotated-region offsets against the editor/known-good before declaring the no-op, NOT assume parity.**
- **(B) Fallback if (A) is falsified.** If the 4.3 own-baseline shows rotated-region geometry is wrong, re-express Phase-33's correction by recomputing into `attachment.sequence.offsets[i]` (the array `getOffsets` reads). The corrected-offset math is identical to Phase-33's; the write target changes from `attachment.offset[]` to `attachment.sequence.offsets[sequence.resolveIndex(setupPose)]`. The sequence must be `update()`-d first (so `offsets` is allocated — `Sequence.js:87,90`), then overwritten. This is the same 8-float computation `loader.ts:576-607` performs.

**The 4.2 path is regression-locked unconditionally:** `runtime-42.applyRotatedRegionFix` relocates `loader.ts:552-613` verbatim (the `attachment instanceof RegionAttachment` filter, the `region.degrees === 0` skip, the SWAP-form offset write). SAFE-02 byte-gates it (the `fixtures/spine_rotated/` fixture is in the frozen corpus — `tests/safe01/baselines/spine_rotated__EXPORT__skeleton.json` exists, verified).

### Pattern 3: `pickRuntime` body (was `declare function` in Phase 42)

**What:** Implement the lazy switch. Phase 42 left `export declare function pickRuntime(...)` (`runtime.ts:64`). Phase 43 replaces it with a body.

**Recommended (per Claude's Discretion + ARCHITECTURE §4 — sync require, keeps `loadSkeleton` synchronous):**
```typescript
// runtime.ts — replaces the `declare`
import type { SpineRuntime } from './runtime.js';  // (self-type via the interface)
const cache = new Map<RuntimeTag, SpineRuntime>();
export function pickRuntime(tag: RuntimeTag): SpineRuntime {
  const hit = cache.get(tag);
  if (hit) return hit;
  // Conditional require keeps the unmatched spine-core copy out of the worker.
  // electron-vite emits the worker as CJS (sampler-worker-bridge.ts:71) so
  // `require` is available; sync keeps loadSkeleton() synchronous (no async
  // thread through runSamplerJob → the byte-frozen loader contract).
  const mod = tag === '4.2'
    ? require('./runtime-42.js')
    : require('./runtime-43.js');
  const rt: SpineRuntime = mod.create();
  cache.set(tag, rt);
  return rt;
}
```
**Loader wiring (D-02):** `loader.ts` calls `const rt = pickRuntime('4.2');` **unconditionally** (no `resolveRuntimeTag`, no detection — that is Phase 44). `LoadResult.runtime = rt`. The existing `checkSpineVersion`/`checkSpine43Schema` guards stay **exactly as-is** (still throw on `<4.2`/`≥4.3`/`4.3-schema`) — Phase 43 does NOT repurpose them (Pitfall 6 in upstream research = Phase 45; out of scope here).

**electron-vite chunk-split (Claude's Discretion):** ensure `runtime-42`/`runtime-43` emit as separate worker chunks so a 4.2 job's worker never instantiates the 4.3 module graph. The `require()` form above already achieves lazy single-copy load at runtime; the build-config item is a confirmation, not a blocker (both spine-core copies are externalized in the worker bundle per STACK.md `externalizeDeps:true` — verified pattern).

### Anti-Patterns to Avoid

- **Letting a spine-core type name escape `runtime-42.ts`/`runtime-43.ts`:** `sampler.ts`/`bounds.ts`/`loader.ts`/`types.ts` must name ZERO spine-core types after this phase. Use opaque handles. The new arch.spec anchor enforces it.
- **`instanceof` in `bounds.ts` against an imported class:** a 4.3 attachment is not `instanceof` a 4.2 `RegionAttachment`. ALL `instanceof` in `bounds.ts` (lines 64, 73-77, 83, 153, 158-163, 168, 179) → `rt.attachmentKind(a)`. The `instanceof` lives ONLY inside each adapter, against ITS OWN runtime's classes.
- **Reading `bone.pose` / `slot.getPose()` in `runtime-43.ts`:** returns pre-constraint geometry → silent undersize (the existential failure mode). Read `bone.appliedPose` / `slot.pose` exclusively. D-03 dev-assertion.
- **Sharing 4.2 SAFE-01 goldens as the 4.3 expected output:** the 4.3 own-baseline is captured fresh in Phase 43 and stored SEPARATELY (D-01). Cross-runtime equivalence is Phase 44, within 1e-4, NOT a shared golden.
- **Regenerating SAFE-01 baselines:** the D-09 freeze guard (`safe01-freeze-guard.spec.ts`) fails loudly if the baseline commit is not a git-ancestor of the alias commit, and asserts no env-gated regen path exists. SAFE-02 = re-run the harness through the rewired path; baselines stay byte-frozen.
- **`AttachmentTimeline` instanceof in sampler (`sampler.ts:295`):** this is a *timeline* type, not an attachment. It currently uses `tl instanceof AttachmentTimeline` from `spine-core-42`. Since `sampler.ts` must drop its spine-core import, this needs an adapter method OR the timeline-iteration moves behind `rt.*`. **Flag to planner:** the locked interface has NO `timelineKind`/`attachmentTimelineNames` method. Recommend the 4.3-mapped equivalent be added via the adapter (the interface may need one method, OR sampler keeps a narrowly-scoped carve-out — escalate the interface-completeness gap). See Open Questions Q1.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 4.3 rotated-region offsets | A from-scratch rotated-quad solver | 4.3's native `Sequence.update`→`RegionAttachment.computeUVs` (verify-then-no-op, Approach A) | CLAUDE.md fact #2 — we do NOT reimplement spine math; 4.3 already computes correct rotated UVs+offsets |
| World transform / IK / constraint solve | Any per-bone math | `sk.updateWorldTransform(Physics.update)` then read `bone.appliedPose` | 4.3 `updateWorldTransform` already handles bone chain, IK, Transform/Path/Physics/Slider — read the RESULT off `appliedPose` |
| Cross-runtime type isolation | A custom type-guard zoo | The Phase-42 `OpaqueHandle` brand + `brandHandle`/`unwrapHandle` | Already built, `unique symbol` defeats structural typing — compile error on cross-mix |
| 4.2 byte-equality proof | A new diff harness | The existing SAFE-01 harness (`safe01-baseline.spec.ts` + `discover-fixtures.ts` + `canonical-json.ts`) re-run through the rewired path | D-06/07 full-output canonical JSON already built; SAFE-02 reuses the COMPARISON path |
| Atlas parsing / stub texture | A new TextureAtlas reader | `new TextureAtlas(text)` + the existing `StubTexture extends Texture` pattern relocated into `runtime-42` | Both 4.2.111 and 4.3.0 ship a working `TextureAtlas`; new-format atlases already parse (verified — SAFE-01 green) |

**Key insight:** Phase 43 is a *relocation + verified-rename* exercise, not a math exercise. The single highest-value discipline is making `runtime-42.ts` a **byte-faithful** move (SAFE-02 then cannot move) and writing `runtime-43.ts` strictly against the installed `.d.ts` (cited above), reading world state ONLY from `appliedPose`.

## Common Pitfalls

### Pitfall 1: Reading `bone.pose` instead of `bone.appliedPose` in runtime-43 (THE existential failure mode — D-03)
**What goes wrong:** `bone.pose.getWorldScaleX()`... except `BonePose` is reached via `bone.appliedPose`; reading the unconstrained pose silently returns pre-IK/pre-TransformConstraint geometry. Every constraint-bearing rig (the 4.3 fixture has a `transform` constraint `CHAIN_8` on `SQUARE` — verified) reports a smaller-than-real peak. Compiles fine, no crash, ~8% undersize ships.
**Why it happens:** 4.3 has THREE poses (`pose`/`constrainedPose`/`appliedPose` — `Posed.d.ts:39-41`); `Posed.getPose()` reads as "the pose" but is unconstrained. `Bone` itself has NO `getWorldScaleX/Y`/`worldX`/`a/b/c/d` — only `BonePose` does (`BonePose.d.ts:62-115`).
**How to avoid:** `runtime-43.boneAxisScale` reads `slot.bone.appliedPose.getWorldScaleX()/getWorldScaleY()` ONLY. The interface exposes `boneAxisScale(slot)` (no `OpaqueBone`) — a raw bone never crosses the facade, so a pre-constraint read is unreachable from `bounds.ts`. D-03 dev-assertion (see below). The `TransformConstraint` on `SQUARE` in `skeleton2.json` is the empirical canary in the 4.3 own-baseline.
**Warning signs:** `.pose.` or `.getPose()` anywhere in `runtime-43.ts` world-read paths; 4.3 own-baseline `SQUARE` peak lower than geometrically expected.

### Pitfall 2: Cross-runtime `instanceof` in bounds.ts (Pitfall 6 — highest correctness risk; explicit design below)
**What goes wrong:** `bounds.ts` branches on `attachment instanceof RegionAttachment/VertexAttachment/MeshAttachment` (10 sites). If the class is imported from one runtime and the object came from the other, `instanceof` is `false` → the attachment silently classifies as `skip` → zero peak → undersized/missing texture, no error.
**Why it happens:** Two spine-core module instances; same class names, different identities.
**How to avoid (explicit invariant — SAFE-03 backstop):**
- `bounds.ts` does **ZERO** `instanceof`. Every classification → `rt.attachmentKind(a): 'region'|'mesh'|'vertex'|'skip'`.
- `runtime-42.attachmentKind` does `instanceof` against `spine-core-42`'s classes; `runtime-43.attachmentKind` against 4.3.0's classes. Each adapter only ever sees its OWN runtime's objects (loader stamped the handle).
- The classification ORDER must preserve today's `bounds.ts` semantics: Region first; then the 4 non-textured `VertexAttachment` subclasses (`BoundingBox`/`Path`/`Point`/`Clipping`) → `'skip'`; then `MeshAttachment` → `'mesh'`; then generic `VertexAttachment` → `'vertex'`; else `'skip'`. (See `bounds.ts:49-58` ordering rationale — the skip-list MUST be tested before the generic VertexAttachment branch because they all extend it.)
- **SAFE-03 regression:** load `skeleton2.json` (4.3) → assert every skin-entry attachment's `rt.attachmentKind` equals its expected kind AND that `handleRuntime(handle) === '4.3'`. Add a deliberate cross-feed assertion: take a 4.2-loaded attachment handle, pass it to the 4.3 adapter's `attachmentKind`, assert it does NOT silently misclassify (the brand makes it a compile error; the runtime guard `handleRuntime` is the runtime backstop — assert `handleRuntime` mismatch is detectable).
**Warning signs:** any `instanceof` in `bounds.ts` post-port; `attachmentKind` returning `'skip'` for a known region in the 4.3 baseline.

### Pitfall 3: SAFE-02 captured/compared incorrectly
**What goes wrong:** SAFE-02 uses epsilon (`toBeCloseTo`) instead of strict `toEqual`, OR regenerates the baseline, OR includes `fixtures/SIMPLE_PROJECT_43/` (no pre-v1.6 baseline → false trip).
**Why it happens:** The 4.2.111 runtime is unchanged — ANY drift is a plumbing bug, so the gate MUST be strict byte-equal. The freeze guard forbids regen.
**How to avoid:** SAFE-02 re-runs `safe01-baseline.spec.ts`'s exact comparison (`expect(frozenPart(live)).toEqual(frozenPart(committed))` — `safe01-baseline.spec.ts:77`) through the rewired path. Baselines stay frozen. `fixtures/SIMPLE_PROJECT_43/` is **already excluded** — it is NOT git-tracked (`git ls-files fixtures/SIMPLE_PROJECT_43/` returns empty, verified), so `discover-fixtures.ts`'s `isGitTracked` filter excludes it from the enumeration manifest, and the SAFE-01 baseline spec only asserts git-tracked fixtures unconditionally (`safe01-baseline.spec.ts:58-79`). **The planner must NOT add `SIMPLE_PROJECT_43` to git in Phase 43's SAFE-02-affecting commits before confirming the enumeration manifest exclusion still holds** (D-05). If the 4.3 fixture is committed in Phase 43 (for the 4.3 own-baseline), it WILL be discovered by `discover()` and (a) appear in the enumeration as a new git-tracked fixture → the `safe01-enumeration.spec.ts` deep-equal FAILS unless the manifest is updated, and (b) `discover()` will try to `sampleSkeleton` it through the **4.2-hardpicked** loader → it throws (4.3 schema) → it lands in `excluded`, NOT `included`, so it does NOT trip the SAFE-01 byte gate but DOES need handling in the enumeration. **This is the single trickiest interaction in the phase — see Open Questions Q2 for the precise resolution the planner must choose.**

### Pitfall 4: `attachment.region` / `attachment.uvs` direct access survives into the 4.3 path
**What goes wrong:** `bounds.ts:219` (`attachment.region as {...}`), `:230` (`attachment.uvs`), `:247` (`attachment.region?.name`), `sampler.ts:247` (`attachment.region?.name`) read properties that **do not exist on 4.3 `RegionAttachment`/`MeshAttachment`** (both are `HasSequence`-only in 4.3). On 4.3 these are `undefined` → `hullAreaRatio` returns null → mesh peak collapses to the weighted-sum fallback or wrong scale.
**Why it happens:** 4.3 moved region/uvs onto the `Sequence`. Upstream research flagged the `RegionAttachment.offset[]` removal but NOT the `MeshAttachment.region`/`.uvs` removal — this is a NEW finding from the installed tarball.
**How to avoid:** Route ALL `attachment.region`/`.uvs` access in `bounds.ts`/`sampler.ts` through the interface's `attachmentRegionMeta`/`attachmentUVs`/`sequenceRegions` (already declared). `runtime-43` resolves via `sequence.regions[idx]` (idx = single-region 0 or `sequence.setupIndex` for the pose-independent hull path — see PORT-02 NEW FINDING). `runtime-42` returns `a.region`/`a.uvs` verbatim. `sampler.ts:247`'s `attachment.region?.name` must also route through `rt.attachmentRegionMeta(a)?.name` (or a dedicated `regionName` accessor).
**Warning signs:** any `.region`/`.uvs` member access on an attachment outside `runtime-42.ts`; 4.3 mesh peaks falling back to weighted-sum unexpectedly.

### Pitfall 5: `sampler.ts` keeps a spine-core import for `AttachmentTimeline`/`Skeleton`/`AnimationState` value construction
**What goes wrong:** `sampler.ts:47-53` imports `Skeleton`, `AnimationState`, `AnimationStateData`, `Physics`, `AttachmentTimeline` from `spine-core-42` and constructs `new Skeleton(...)`/`new AnimationState(...)` (lines 160-162) and does `tl instanceof AttachmentTimeline` (line 295). RT-02 requires `sampler.ts` to import NO spine-core package. The interface already has `makeSkeleton`/`makeAnimationState`. But there is **no interface method for the `AttachmentTimeline` iteration** (`sampler.ts:294-300` walks `anim.timelines` for `AttachmentTimeline` instances to build the D-54 affected-attachment set).
**Why it happens:** The Phase-42 interface was derived from the leaf calls but the `AttachmentTimeline`-iteration is a sampler-internal that also touches spine-core.
**How to avoid:** The planner must close this interface gap. Options: (a) add a single adapter method e.g. `attachmentTimelineNames(anim): Set<string>` returning the `${slotIndex}/${name}` pairs (cleanest — keeps `sampler.ts` spine-core-free); (b) a narrowly-scoped arch.spec carve-out for `sampler.ts`'s `AttachmentTimeline`-only import (weaker — violates the clean RT-02 intent). **Recommend (a).** The interface is "locked" but this is a genuine completeness gap, not a redesign — escalate as a minimal additive method, not a reshape. See Open Questions Q1.
**Warning signs:** arch.spec anchor fails because `sampler.ts` still imports `spine-core-42`; OR a carve-out weakens the RT-02 guarantee.

### Pitfall 6: D-04 heavy-rig gate skipped at close
**What goes wrong:** CI is green on the 13 git-tracked fixtures; Phase 43 is declared closed; a subtle plumbing drift in a constraint-heavy proprietary rig (Girl/SKINS/CHJ/3Queens/Jokerman) ships undetected.
**Why it happens:** "subtle drift hides exactly there" — the redistributable subset is small and simple.
**How to avoid:** D-04 makes a **documented local SAFE-02 pass against the heavy rigs a hard close gate**. `safe01-baseline.spec.ts:83-98` already has the presence-guarded heavy-rig arm (`it.skipIf(!existsSync(file))`). The planner MUST include a verification task that runs the full SAFE-02 locally with the gitignored heavy baselines present and records the result in `43-VERIFICATION.md`. CI-subset-green alone does NOT close.
**Warning signs:** `43-VERIFICATION.md` lacks an explicit "heavy-rig SAFE-02 ran locally, N rigs, all byte-equal" record.

## Code Examples

### D-03 structural-defense — runtime-43 appliedPose-only + dev assertion
```typescript
// runtime-43.ts — Source: BonePose.d.ts:113-115, Posed.d.ts:39-41, SlotPose.d.ts:36,41
import { Skeleton, AnimationState, /* ... */ RegionAttachment, MeshAttachment,
         VertexAttachment, BoundingBoxAttachment, PathAttachment,
         PointAttachment, ClippingAttachment } from '@esotericsoftware/spine-core';

// The ONLY world-scale read. Reaches appliedPose explicitly. No OpaqueBone is
// ever returned, so bounds.ts cannot reach a pre-constraint pose through the
// facade — the wrong-pose read is structurally unreachable (D-03).
boneAxisScale(slot: OpaqueSlot): { x: number; y: number } {
  const s = unwrapHandle<Slot43>(slot);
  const ap = s.bone.appliedPose;                 // BonePose — post-constraint
  if (process.env.NODE_ENV !== 'production') {
    // Dev-mode assertion: appliedPose must be a BonePose with world fields.
    // Guards against an upstream refactor silently changing the accessor.
    if (ap === (s.bone as unknown as { pose: unknown }).pose) {
      throw new Error(
        'runtime-43 D-03: bone.appliedPose === bone.pose — reading ' +
        'pre-constraint geometry would silently undersize constraint rigs.',
      );
    }
  }
  return { x: Math.abs(ap.getWorldScaleX()), y: Math.abs(ap.getWorldScaleY()) };
}

slotAttachment(slot: OpaqueSlot): OpaqueAttachment | null {
  const a = unwrapHandle<Slot43>(slot).pose.attachment;   // SlotPose.attachment
  return a == null ? null : brandHandle<OpaqueAttachment>(a, '4.3');
}

slotColorAlpha(slot: OpaqueSlot): number {
  return unwrapHandle<Slot43>(slot).pose.color.a;          // SlotPose.color (Slot has none)
}
```

### regionWorldVertices — the verified 4.3 signature (vertexOffsets 2nd arg)
```typescript
// runtime-43.ts — Source: RegionAttachment.d.ts:69, RegionAttachment.js:79-106
regionWorldVertices(slot: OpaqueSlot, a: OpaqueAttachment): Float32Array {
  const s = unwrapHandle<Slot43>(slot);
  const att = unwrapHandle<RegionAttachment43>(a);
  const off = att.getOffsets(s.pose);   // number[8] from sequence.offsets[resolveIndex(pose)]
                                        // NOT freshly allocated — sequence-owned (.js:103-106)
  const v = new Float32Array(8);
  att.computeWorldVertices(s, off, v, 0, 2);   // (slot, vertexOffsets, worldVertices, offset, stride)
  return v;
}

// runtime-43.ts — Source: Attachment.d.ts:77 (VertexAttachment.computeWorldVertices)
vertexWorldVertices(sk: OpaqueSkeleton, slot: OpaqueSlot, a: OpaqueAttachment): Float32Array {
  const skel = unwrapHandle<Skeleton43>(sk);
  const s = unwrapHandle<Slot43>(slot);
  const att = unwrapHandle<VertexAttachment43>(a);
  const n = att.worldVerticesLength;
  const v = new Float32Array(n);
  att.computeWorldVertices(skel, s, 0, n, v, 0, 2);   // skeleton is the 1st arg
  return v;
}
```

### attachmentKind — own-runtime instanceof (Pitfall 6 invariant)
```typescript
// runtime-43.ts — own-runtime classes ONLY; ordering mirrors bounds.ts:49-58
attachmentKind(a: OpaqueAttachment): 'region' | 'mesh' | 'vertex' | 'skip' {
  const att = unwrapHandle<object>(a);
  if (att instanceof RegionAttachment) return 'region';
  if (att instanceof BoundingBoxAttachment || att instanceof PathAttachment ||
      att instanceof PointAttachment || att instanceof ClippingAttachment) return 'skip';
  if (att instanceof MeshAttachment) return 'mesh';
  if (att instanceof VertexAttachment) return 'vertex';
  return 'skip';
}
// runtime-42.ts is byte-identical EXCEPT the imports come from 'spine-core-42'.
```

### bounds.ts — instanceof-free (the consumer side)
```typescript
// bounds.ts — Source: replaces bounds.ts:64-91 (attachmentWorldAABB)
export function attachmentWorldAABB(rt: SpineRuntime, slot: OpaqueSlot, a: OpaqueAttachment): AABB | null {
  const kind = rt.attachmentKind(a);
  if (kind === 'region') return aabbFromFloat32(rt.regionWorldVertices(slot, a), 4);
  if (kind === 'skip') return null;
  if (kind === 'mesh' || kind === 'vertex') {
    const v = rt.vertexWorldVertices(/*sk*/ ???, slot, a);  // sk threaded from caller
    if (v.length <= 0) return null;
    return aabbFromFloat32(v, v.length / 2);
  }
  return null;
}
```
**Note for planner:** `bounds.ts`'s exported functions currently take `(slot, attachment)`. To call `rt.vertexWorldVertices(sk, slot, a)` they need the `OpaqueSkeleton` threaded through (the sampler has it — `sampler.ts` constructs `skeleton`). This is a `bounds.ts` signature change rippling to `sampler.ts`'s `snapshotFrame`/`computeRenderScale`/`attachmentWorldAABB` call sites. Mechanical but touches the hot loop's call signatures — plan as a single coordinated edit. The interface's `vertexWorldVertices(sk, slot, a)` already anticipates this.

## State of the Art

| Old (4.2.111, current code) | New (4.3.0, runtime-43) | Why it changed | Impact on this phase |
|--------------|------------------|--------------|--------|
| `slot.getAttachment()` / `slot.color` | `slot.pose.attachment` / `slot.pose.color` | Pose-architecture rewrite | `slotAttachment`/`slotColorAlpha` adapter bodies |
| `bone.getWorldScaleX/Y()` | `bone.appliedPose.getWorldScaleX/Y()` | `Bone` no longer carries world transform | `boneAxisScale` — D-03 critical |
| `RegionAttachment.offset[]` (mutable) | `RegionAttachment.getOffsets(pose)` → `sequence.offsets[...]` | offsets flow through `Sequence` | PORT-03 re-expression |
| `RegionAttachment.computeWorldVertices(slot, wv, 0, 2)` | `(slot, vertexOffsets, wv, 0, 2)` — vertexOffsets 2nd | new signature | `regionWorldVertices` |
| `VertexAttachment.computeWorldVertices(slot, 0, n, wv, 0, 2)` | `(skeleton, slot, 0, n, wv, 0, 2)` — skeleton 1st | new signature | `vertexWorldVertices` (needs sk threaded) |
| `MeshAttachment.region` / `.uvs` / `RegionAttachment.region` | GONE — via `sequence.regions[idx]` / `sequence.getUVs(idx)` / `regionUVs` | Pose/Sequence rewrite (**NEW finding**) | `attachmentRegionMeta`/`attachmentUVs`/`sequenceRegions` |
| `state.setAnimationWith(0, anim, false)` | `state.setAnimation(0, anim, false)` (overload) | `setAnimationWith` removed | `setAnimation` adapter body |
| single `pose` per object | `pose` / `constrainedPose` / `appliedPose` | constraint-solve isolation | D-03 — read `appliedPose` only |

**Deprecated/outdated (do NOT target):**
- SEED-006's "5 renames + 2 sig changes" framing — falsified; use the table above.
- SEED-006's "Region adds `vertexOffsets` LAST" — WRONG; it is the 2nd arg (`RegionAttachment.d.ts:69`).
- IK `scaleY: number` — stale; 4.3 uses `IkConstraintData.scaleYMode` enum (not touched this phase — computed inside `updateWorldTransform`; only `appliedPose` reads matter here).

## Validation Architecture

> `nyquist_validation: true` (`.planning/config.json`). This section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.x (`package.json:55`) |
| Config file | `vitest.config.ts` (repo root; node environment for `tests/safe01/**` + `core` specs) |
| Quick run command | `npx vitest run tests/safe01/safe01-baseline.spec.ts tests/arch.spec.ts` |
| Full suite command | `npm run test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SAFE-02 | Every git-tracked 4.2 fixture byte-identical through rewired adapter | regression (strict `toEqual`) | `npx vitest run tests/safe01/safe01-baseline.spec.ts` | ✅ exists (`safe01-baseline.spec.ts`) — re-runs through rewired path; baselines FROZEN |
| SAFE-02 (heavy, D-04) | Heavy/proprietary rigs byte-identical (local) | regression, presence-guarded | `npx vitest run tests/safe01/safe01-baseline.spec.ts` *(with gitignored heavy baselines present locally)* | ✅ exists — `it.skipIf` arm `safe01-baseline.spec.ts:83-98`; **D-04: must run locally + record in 43-VERIFICATION.md** |
| SAFE-02 (enumeration) | No fixture silently dropped out / no undeclared new fixture | regression | `npx vitest run tests/safe01/safe01-enumeration.spec.ts` | ✅ exists — D-05 interaction: see Q2 |
| SAFE-02 (freeze) | Baseline commit predates alias; no env-regen | meta-test | `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` | ✅ exists |
| RT-02 | `sampler.ts`/`bounds.ts`/`loader.ts` import no spine-core package | arch (grep glob) | `npx vitest run tests/arch.spec.ts` | ❌ Wave 0 — ADD named anchor (pattern: `arch.spec.ts:148-178` globSync scanner) |
| SAFE-03 | Each loaded skeleton's attachments `instanceof`/`attachmentKind` resolve against the loading runtime; cross-feed detected | regression | `npx vitest run tests/<new>/safe03-cross-runtime.spec.ts` | ❌ Wave 0 — NEW spec |
| PORT-01/02/03 | 4.3 `skeleton2.json` samples without throw via the verified Pose API; byte-stable vs its OWN 4.3 baseline; rotated-region geometry correct; TransformConstraint canary | regression (own-baseline) | `npx vitest run tests/<new>/runtime43-baseline.spec.ts` | ❌ Wave 0 — NEW spec + freshly-captured 4.3 baseline (SEPARATE from SAFE-01; NOT golden-shared — D-01) |
| D-03 | runtime-43 dev-assertion fires if `appliedPose === pose` | unit | `npx vitest run tests/<new>/runtime43-d03.spec.ts` | ❌ Wave 0 — small unit asserting the guard + (positive) that the `TransformConstraint` rig's `SQUARE` peak is the post-constraint value |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/safe01/safe01-baseline.spec.ts tests/arch.spec.ts` (the SAFE-02 gate + the RT-02 anchor — the two phase-defining invariants; < 30 s on the git-tracked subset).
- **Per wave merge:** `npm run test` (full suite — includes all `core` specs, the existing reject-guard specs which must stay green since Phase 43 does NOT touch loader behavior).
- **Phase gate (close):** Full suite green + **D-04 local heavy-rig SAFE-02 run recorded in 43-VERIFICATION.md** + the 4.3 own-baseline captured & committed (D-01) + `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` green (baseline-predates-alias still holds; the alias commit is already an ancestor — verified the guard flips to a hard ancestry assert now that `spine-core-42` is in `package.json:35`).

### Nyquist rationale (why these sampling points)
The phase's correctness signal is **byte-equality of the 4.2 path** (SAFE-02 — the Nyquist-critical signal: a single drifted `${skin}/${slot}/${attachment}` record is the smallest detectable failure, and strict `toEqual` on canonicalized full output samples it exactly — no aliasing). Per-task sampling of SAFE-02 + the RT-02 anchor catches a leaking facade at the earliest commit. The 4.3 own-baseline is a *sentinel* (regression detector), not the phase-stop gate (D-01) — sampled per-wave. The D-04 heavy-rig gate is the anti-aliasing measure for "subtle drift hides in complex rigs" — sampled once at the phase gate, locally, because the heavy baselines are gitignored.

### Wave 0 Gaps
- [ ] `tests/arch.spec.ts` named anchor — sampler.ts/bounds.ts/loader.ts ↛ direct spine-core/spine-core-42 import (covers RT-02). Pattern: extend the existing globSync scanner; add a named `describe` block (precedent: the Phase-9/18/36 named anchors at `arch.spec.ts:200-231`).
- [ ] `tests/<new>/safe03-cross-runtime.spec.ts` — SAFE-03 invariant (attachmentKind resolves against loading runtime; cross-feed detected via `handleRuntime`).
- [ ] `tests/<new>/runtime43-baseline.spec.ts` + a captured `skeleton2.json` 4.3 SamplerOutput baseline (SEPARATE store from `tests/safe01/baselines/`; NOT golden-shared — D-01). Reuse `canonical-json.ts`'s serializer for byte-stability.
- [ ] `tests/<new>/runtime43-d03.spec.ts` — D-03 dev-assertion unit + the `TransformConstraint`-on-`SQUARE` post-constraint canary.
- [ ] No framework install needed (vitest present).
- [ ] **Interface-completeness gap (escalate, see Q1):** an `attachmentTimelineNames`-style adapter method so `sampler.ts` can drop its `AttachmentTimeline`/`Skeleton`/`AnimationState` spine-core import — OR a planner decision to scope a narrow carve-out (NOT recommended).

## Security Domain

> `security_enforcement` key is **absent** from `.planning/config.json` (absent = enabled). However, Phase 43 is a **pure-TS internal refactor**: no new input parsing, no new IPC, no new file I/O, no network, no auth, no crypto. It relocates existing trusted call paths behind an interface and adds two adapter bodies that consume already-validated `parsedJson` (the `checkSpineVersion`/`checkSpine43Schema` input guards are UNCHANGED and still run before any adapter call).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes (unchanged) | The existing `loader.ts` version-string guard + `checkSpine43Schema` object-shape guard remain the input boundary; Phase 43 does NOT weaken them (Phase 43 hard-picks 4.2 and the guards still throw `<4.2`/`≥4.3`). The 4.3 fixture is a trusted in-repo test artifact, not untrusted user input. |
| V2 Auth / V3 Session / V4 Access Control | no | No auth/session/access surface in `core/`. |
| V6 Cryptography | no | No crypto. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-runtime object corruption (4.2 obj into 4.3 API) → garbage peaks / cryptic deep-spine throw | Tampering | Opaque branded handles (`unique symbol`) + `handleRuntime` runtime backstop + SAFE-03 regression (the threaded-identity discipline — `feedback_explicit_identity_over_inference`) |
| Silent undersize from pre-constraint pose read | Information disclosure (quality loss ships) | D-03 structural defense: `appliedPose`-only, no `OpaqueBone` in the facade, dev-assertion, TransformConstraint canary |
| Malformed `skeleton.spine` routing to wrong runtime | Tampering | N/A this phase — loader hard-picks 4.2 unconditionally (D-02); the existing strict version-parse guard still rejects malformed input before any adapter call |

No new security controls are introduced or required by Phase 43; the existing input-validation boundary is preserved unchanged.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 4.3's native `Sequence.update`→`RegionAttachment.computeUVs` already produces correct rotated-region offsets, so `runtime-43.applyRotatedRegionFix` can be a no-op (Approach A) | PORT-03 | If wrong: 4.3 rotated-region geometry (the `rotate:90` `TRIANGLE`/`rect` in `skeleton2.atlas`) is wrong → undersized rotated textures. **Mitigation: the 4.3 own-baseline against `skeleton2.json` empirically proves/disproves this — the planner MUST include a task that validates rotated-region offsets against a known-good (editor bounds or the 4.2 sibling's geometry) BEFORE declaring the no-op; fallback Approach B re-expresses Phase-33's math into `sequence.offsets[]`.** Source-confirmed that the *mechanism* exists (`computeUVs` `.js:113-168` does rotated math + `degrees===90` UV handling); the *equivalence to a correct result* is the assumed part. |
| A2 | `pickRuntime` sync `require()` under the CJS worker bundle keeps `loadSkeleton` synchronous and lazily loads only the matched spine-core copy | Pattern 3 | If the worker bundle is not CJS or require is unavailable: async thread-through needed (larger diff). Mitigation: ARCHITECTURE §4 verified the worker emits CJS (`sampler-worker-bridge.ts:71`); confirm during planning. Low risk (Claude's Discretion item, fallback is async). |
| A3 | The single-region / `setupIndex` resolution for `attachmentRegionMeta` on 4.3 is pose-independent and correct for the hull-area path (avoids an interface change for the locked `(a)`-only signature) | PORT-02 NEW FINDING | If a rig has a multi-region sequence whose hull-area differs per frame AND is not covered by the sequence fan-out post-pass: wrong mesh peak. Mitigation: sequence attachments have a dedicated fan-out (`sampler.ts:352-405`); the hull path only needs setup/single region. Verified `resolveIndex` returns 0 for single-region (`Sequence.js:106-111`). Flag to planner. |
| A4 | The arch.spec named-anchor pattern (extend globSync + add a named describe) is the right mechanism for the RT-02 no-import anchor | Validation Architecture | Low risk — directly verified the existing precedent (`arch.spec.ts:148-178` + the Phase-9/18/36 named anchors). |

**These four `[ASSUMED]` items need confirmation during planning/execution.** A1 is the highest-risk (must be empirically validated, not assumed — explicitly called out). Everything else in this research is `[VERIFIED]` against the installed tarballs or `[CITED]` to the upstream verified research (SUMMARY/ARCHITECTURE/STACK/PITFALLS/FEATURES).

## Open Questions

1. **Interface-completeness gap for `sampler.ts`'s `AttachmentTimeline` iteration (Q1).**
   - What we know: `sampler.ts:294-300` does `tl instanceof AttachmentTimeline` over `anim.timelines` (from `spine-core-42`) to build the D-54 affected-attachment set. RT-02 requires `sampler.ts` to import no spine-core package. The locked interface has no method covering this.
   - What's unclear: whether to (a) add a minimal additive adapter method (`attachmentTimelineNames(anim): Set<string>` — recommended) or (b) a narrow arch.spec carve-out for sampler's `AttachmentTimeline`-only import (weaker).
   - Recommendation: **(a).** This is a completeness gap, not an interface reshape — a single additive method preserving the clean RT-02 guarantee. Escalate to the planner as "the interface needs one more method; the Phase-42 'locked' status should not block a strictly-additive completion that RT-02 requires." (`Skeleton`/`AnimationState`/`AnimationStateData` value construction is already covered by `makeSkeleton`/`makeAnimationState`; only the timeline-walk is uncovered.)

2. **D-05 ↔ SAFE-01 enumeration interaction when the 4.3 fixture is committed (Q2).**
   - What we know: D-01 requires the 4.3 `skeleton2.json` to be sampled+baselined in Phase 43, which means committing `fixtures/SIMPLE_PROJECT_43/skeleton2.*`. `discover-fixtures.ts` globs `fixtures/**/*.json`, runs `loadSkeleton`→`sampleSkeleton` (4.2-hardpicked). `skeleton2.json` is `"spine":"4.3.01"` → `checkSpineVersion` throws → it lands in `discover()`'s `excluded` (NOT `included`), so it does NOT enter the SAFE-01 byte-gate. BUT `safe01-enumeration.spec.ts` asserts `discovered (git-tracked) deep-equals manifest` — `skeleton2.json` would NOT appear in `discovered` (it's excluded), so the enumeration stays green WITHOUT a manifest change. The 4.2 sibling `skeleton2_42.json` is `"spine":"4.2-from-4.3.01"` → `checkSpineVersion` parses leading `4.2` → **it would PASS the version guard and SAMPLE through 4.2.111** → it WOULD appear in `discovered` as a new git-tracked fixture → `safe01-enumeration.spec.ts` deep-equal **FAILS** unless excluded.
   - What's unclear: the exact mechanism to keep the 4.2 sibling out of the SAFE-01 enumeration without weakening the dropout-is-failure guarantee (D-05 says the 4.2 sibling is Phase-44-reserved, untouched in Phase 43).
   - Recommendation: **Phase 43 commits ONLY the 4.3 files (`skeleton2.json` + `skeleton2.atlas` + `skeleton2.png`), NOT the 4.2 sibling.** D-05 explicitly says "Phase 43 touches only the 4.3 file; the 4.2 sibling is reserved untouched for Phase 44." Committing only the 4.3 file: the enumeration stays green automatically (4.3 file → `excluded` by the version guard, never enters `discovered`). The 4.2 sibling stays uncommitted until Phase 44 (where the enumeration manifest gets its deliberate reviewed update). **This is the clean resolution and aligns with D-05's letter — the planner must scope the fixture commit to 4.3-only.** Verify: after committing only `skeleton2.json`, `git ls-files fixtures/SIMPLE_PROJECT_43/` shows only the 4.3 triplet, and `safe01-enumeration.spec.ts` + `safe01-baseline.spec.ts` stay green (the 4.3 file is `excluded`, the 4.2 sibling is untracked → not discovered).

3. **`bounds.ts` signature ripple (`OpaqueSkeleton` threading) — confirm scope.**
   - What we know: `rt.vertexWorldVertices(sk, slot, a)` needs the skeleton handle; `bounds.ts`'s exported `attachmentWorldAABB(slot, attachment)` / `computeRenderScale(slot, attachment)` do not currently receive it. `sampler.ts` has the skeleton (constructs it at `sampler.ts:160`). The call sites are `sampler.ts:240,251` (Pass 1.5), the `snapshotFrame` body, and `fanOutSequencePeaks`.
   - What's unclear: nothing blocking — it's a mechanical signature change, but it touches the hot loop's call signatures and the Pass-1.5/sequence-fan-out paths.
   - Recommendation: plan it as ONE coordinated edit (bounds.ts signature change + all sampler.ts call sites + the `rt` threading) inside the RT-02 wave, not piecemeal. The interface (`vertexWorldVertices(sk, slot, a)`) already anticipates the skeleton arg, so no interface change here.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@esotericsoftware/spine-core` (4.3.0 canonical) | `runtime-43.ts` | ✓ | 4.3.0 | — (verified on disk) |
| `spine-core-42` (4.2.111 alias) | `runtime-42.ts` | ✓ | 4.2.111 | — (verified on disk) |
| vitest | SAFE-02/SAFE-03/4.3-baseline specs | ✓ | 4.x | — |
| git | SAFE-01 freeze-guard ancestry + `discover-fixtures.ts` `isGitTracked` | ✓ | (repo is git) | — |
| `fixtures/SIMPLE_PROJECT_43/skeleton2.*` (4.3 owner rig) | PORT-01/02/03 own-baseline | ✓ (present locally, untracked) | spine 4.3.01 | none — D-01 hard requirement; already in-repo |
| Heavy/proprietary rigs (`Girl/`, `SKINS/`, `CHJ/`, `3Queens/`, `Jokerman/`) | D-04 close gate | ⚠ gitignored, present LOCALLY (presence-guarded) | various | CI-subset is necessary-not-sufficient; D-04 requires the LOCAL run recorded |

**No missing dependencies block Phase 43.** The heavy rigs are present locally on the maintainer machine (presence-guarded per Phase-42 D-08-R); D-04 makes the local run a documented close gate, not a blocker.

## Sources

### Primary (HIGH confidence) — installed tarballs on this machine, cited by path:line
- `node_modules/@esotericsoftware/spine-core@4.3.0` `dist/*.d.ts` + `dist/*.js`: `RegionAttachment.d.ts:39,69,70`, `RegionAttachment.js:79-106,113-168`, `attachments/Attachment.d.ts:51,77`, `BonePose.d.ts:45,113,115`, `SlotPose.d.ts:33,36,41,54`, `Slot.d.ts:38,39,41`, `Bone.d.ts:40`, `Posed.d.ts:36,39-41,48`, `PosedActive.d.ts:33`, `Skeleton.d.ts:52,56,113,115,117,119,141,199`, `AnimationState.d.ts:59,65,79,89,98,169`, `SkeletonData.d.ts:46,55,70,74`, `SkeletonJson.d.ts:47,48`, `AtlasAttachmentLoader.d.ts:45,46`, `TextureAtlas.d.ts:35,54-67`, `Texture.d.ts:54-67`, `Skin.d.ts:35,70`, `MeshAttachment.d.ts:38,41,71`, `MeshAttachment.js:38-100`, `attachments/Sequence.d.ts:35,39,43,60,63`, `attachments/Sequence.js:83-111`, `attachments/HasSequence.d.ts` — verified 2026-05-17
- `node_modules/spine-core-42` (= `@esotericsoftware/spine-core@4.2.111`): `attachments/RegionAttachment.d.ts:62,76`, `attachments/MeshAttachment.d.ts:40`, `Bone.d.ts:42,123,125`, `Slot.d.ts:41,44,62` — verified 2026-05-17 (the alias's distinct type surface)
- `package.json:26,27,35` (alias direction + spine-player still 4.2.111); `node_modules/*/package.json` version fields — verified on disk 2026-05-17
- Project source: `src/core/runtime/runtime.ts` (locked interface), `src/core/runtime/types.ts` (opaque handles), `src/core/sampler.ts:47-53,160-162,294-300,302-339`, `src/core/bounds.ts:31-41,64-91,148-184,212-290,362-399`, `src/core/loader.ts:32-40,122-188,200-251,507-613`, `src/core/types.ts:186-191`, `tests/arch.spec.ts:148-178,200-231`, `tests/safe01/{safe01-baseline,safe01-enumeration,safe01-freeze-guard,phase44-fixture-guard,discover-fixtures,phase-gate}.spec.ts/.ts` — read 2026-05-17
- `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (4.3.01, 2 constraints incl. `transform` CHAIN_8 on SQUARE, `rotate:90` regions), `skeleton2_42.json` (4.2-from-4.3.01, has `root.transform`), `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.atlas` (new-format) — inspected 2026-05-17
- `.planning/config.json` (`nyquist_validation: true`; `security_enforcement` absent) — read 2026-05-17

### Secondary (CITED — the verified upstream research, supersedes SEED-006)
- `.planning/research/SUMMARY.md`, `ARCHITECTURE.md`, `STACK.md`, `PITFALLS.md`, `FEATURES.md` — the consolidated correction; cross-checked against the installed tarballs above (every API claim independently re-verified on disk in this session — they agree)
- `.planning/phases/43-.../43-CONTEXT.md` (D-01..D-05 + Research Flags), `.planning/phases/42-.../42-CONTEXT.md` (D-06/07/08/09)

### Tertiary (LOW confidence — flagged)
- A1 (4.3 rotated-region no-op equivalence) — the mechanism is source-confirmed but the *correct-result equivalence* is empirically unproven until the 4.3 own-baseline runs; flagged for an explicit Phase-43 validation task.
- spine-editor#891 (4.3→4.2 IK-scramble) — Phase-44 concern only (the 4.2 sibling is Phase-44-reserved); non-IK rig (`skeleton2.json` is TransformConstraint/Path, no IK) → immune by design; not a Phase-43 blocker.

## Metadata

**Confidence breakdown:**
- Standard stack / alias state: HIGH — verified on disk (versions, alias direction, spine-player untouched).
- 4.3 API mapping (PORT-01/02): HIGH — every signature cited to installed `.d.ts:line`.
- Cross-runtime instanceof design (SAFE-03) / D-03 structural defense: HIGH — verified `Posed`/`BonePose`/`SlotPose` shape; explicit invariant + dev-assertion provided.
- PORT-03 rotated-region: HIGH on the mechanism (`getOffsets`/`Sequence`/`computeUVs` source-read), MEDIUM on the no-op equivalence (A1 — must be fixture-validated, explicitly flagged).
- SAFE-02 harness reuse + D-05 enumeration interaction: HIGH — read the actual SAFE-01 specs + verified `SIMPLE_PROJECT_43` is untracked; Q2 gives the precise clean resolution (commit 4.3-only).
- NEW finding (`MeshAttachment.region`/`.uvs` gone in 4.3): HIGH — verified `MeshAttachment.d.ts:38` implements `HasSequence` not `HasTextureRegion`, no `region`/`uvs` member; this was NOT in upstream research and is surfaced for the planner.

**Research date:** 2026-05-17
**Valid until:** 30 days (stable — versions are exact-pinned and verified installed; the spine-core 4.3.0 surface will not drift unless the pin changes).
