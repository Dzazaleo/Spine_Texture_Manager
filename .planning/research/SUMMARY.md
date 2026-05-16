# Project Research Summary

**Project:** Spine Texture Manager — v1.6 "Spine 4.3 Runtime Port (Dual-Runtime)"
**Domain:** Dual spine-core runtime (4.2.111 + 4.3.0) integration into a pure-TS `core/` peak-render-scale math layer behind a `worker_threads` sampler (Electron + TS + React desktop app)
**Researched:** 2026-05-16
**Confidence:** HIGH

> **Read this first.** All four researchers independently verified against the **actual published `@esotericsoftware/spine-core@4.3.0` / `@esotericsoftware/spine-player@4.3.0` npm tarballs** (stable, NOT beta) and independently converged at HIGH confidence on one conclusion: **SEED-006's costed inventory (PORT-01..04) is materially wrong.** SEED-006 was built from the 4.3-**beta** tarball. The roadmap and requirements MUST use the corrected facts in this document, not SEED-006's beta inventory. The headline correction is in the table below.

---

## ★ SEED-006 Beta-vs-Stable Falsification (consolidated correction table)

SEED-006 framed the port as **"5 renames + 2 signature changes + a vendoring decision."** Stable 4.3.0 is a **Pose-architecture rewrite**: `Bone`/`Slot` no longer carry the world transform or attachment — those moved to `BonePose`/`SlotPose`, reached via `bone.appliedPose` / `slot.pose`. This is *every world-transform and attachment read in `core/bounds.ts` and `core/sampler.ts`* — the exact code that computes the number this product exists to produce.

| Item | SEED-006 / PORT-0x (beta) said | 4.3.0 STABLE reality (verified in tarball) | Status |
|---|---|---|---|
| `setToSetupPose`->`setupPose`, `setSlotsToSetupPose`->`setupPoseSlots` | rename | confirmed (`Skeleton.d.ts:115,119`); also `setBonesToSetupPose`->`setupPoseBones` | OK + 1 extra |
| `setAnimationWith`->`setAnimation` | rename | confirmed — `setAnimationWith` **does not exist**; `setAnimation` is overloaded (string \| `Animation`). Broader: `setCurrent`->`setTrack`, `getCurrent` deprecated->`getTrack` | WIDER |
| `slot.getAttachment()`->`slot.pose.attachment` | one-line rename | confirmed AND **`slot.color` also moved to `slot.pose.color`** (`Slot` declares neither). The v1.3 visibility invariant reads `slot.color.a` too — SEED-006 never mentioned it. | UNDERCOUNTED |
| Region `computeWorldVertices` adds `vertexOffsets` **appended last** | `(slot, wv, off, stride, vertexOffsets)` | **WRONG.** Stable: `(slot, vertexOffsets, worldVertices, offset, stride)` — `vertexOffsets` is the **2nd** arg. AND `RegionAttachment` no longer stores a mutable `offset[]`; the caller must supply offsets via `attachment.getOffsets(slot.pose)` (resolves through `Sequence`). | SIGNATURE WRONG |
| Vertex `computeWorldVertices` adds `skeleton` first arg | `(skeleton, slot, ...)` | confirmed | OK |
| IK `uniform: bool`->`scaleY: number` (mid-beta @4.3.73) | `scaleY` number | **evolved again.** Stable has NO `scaleY` field — it is `IkConstraintData.scaleYMode: ScaleYMode` enum `{None=0, Uniform=1, Volume=2}`. The exact `uniform->scaleY->scaleYMode` churn SEED-006 cited as the cautionary precedent **happened again** between beta and stable. | STALE |
| `bone.getWorldScaleX/Y()` (used at `bounds.ts:383,396`) | **not mentioned at all** | **OMITTED — the single biggest port surface.** `Bone` has NO `getWorldScaleX/Y`, NO `worldX/Y`, NO `a/b/c/d`. All on `BonePose`, reached via `bone.appliedPose.getWorldScaleX()`. | OMITTED |
| Pose lifecycle "likely-unchanged shape" | unchanged | **understated.** Three poses now exist per object: `pose` (unconstrained), `constrainedPose`, `appliedPose` (post-constraint, what rendering uses). Reading the wrong one compiles fine and silently returns pre-constraint geometry -> systematic undersize. | EXISTENTIAL |
| `loader.ts` Phase 33 rotated-region patch writes `attachment.offset[0..7]` directly | **not mentioned** | Stable 4.3 `RegionAttachment` has **no settable `offset[]`**; the Phase 33 rotated-atlas mechanism does not exist on 4.3. Must be re-expressed via `Sequence`/`getOffsets`. (4.2 path unaffected.) | OMITTED — affects rotated-atlas on 4.3 |
| `MixBlend` / `MixDirection` | not mentioned | **REMOVED entirely** in 4.3.0 (zero `.d.ts` occurrences across spine-core/webgl/player). The v1.5.1 viewer (`AnimationPlayerModal.tsx`) imports both — breaks. `apply()` now takes `(fromSetup, add, out, appliedPose)`. | OMITTED — viewer breakage |
| PORT-04 vendoring (submodule/fork/wait) | 3-option decision | collapses to a **`package.json` npm alias** (4.3.0 published) | TRIVIAL |
| PORT-03 slider | maybe needs sampler apply step | **fixture-only — NO sampler code.** Source-proven: `Slider extends Constraint`, sorted into `_updateCache`, driven by the existing `updateWorldTransform(Physics.update)` exactly like IK/Transform/Path/Physics. | SCOPE SHRINKS |
| "Plan as 4-task phase, ~2-3 weeks" | single phase | **~6 ordered phases (42-47).** Phase 42 must capture the 4.2 baseline BEFORE the alias (order is load-bearing). | SCOPE RESHAPED |

**Net:** SEED-006 is directionally right on 3 items, wrong on the Region signature, stale on IK, omits the three single largest surfaces (`bone.appliedPose` world reads, `slot.color`, the gone `RegionAttachment.offset[]`), and underestimates the phase count by ~5x. The verified mapping tables in STACK.md / FEATURES.md / ARCHITECTURE.md / PITFALLS.md supersede SEED-006 entirely.

---

## Executive Summary

This is **not a greenfield build** — it is a surgical dual-runtime port of an existing, shipped, working math engine whose entire value is *producing one correct number* (peak world-space render scale) with no natural ground truth. The product exists to right-size textures; an 8% silent undersize ships visible quality loss with no compiler error and no crash. Experts approach a port like this by (1) freezing and byte-baselining the existing-runtime behavior *before* touching anything, (2) isolating the version delta behind a typed boundary so the algorithm doesn't fork, and (3) building an independent oracle for the new path because "it runs and the number looks plausible" is the dominant failure mode here.

The recommended approach, on which all four researchers agree, is a **thin runtime-adapter facade** in `core/`: one `SpineRuntime` interface, two implementations (`runtime-42.ts`, `runtime-43.ts`), with `loader.ts` selecting the impl from the detected skeleton version and `sampler.ts`/`bounds.ts` becoming runtime-agnostic (no direct `@esotericsoftware/spine-core` import). Dual-runtime is **mandatory, not a preference**: the 4.3 `SkeletonJson` reads constraints *only* from `root.constraints[]` and never touches `root.ik`/`root.transform`/`root.path`/`root.physics`, so a 4.2 JSON loads in the 4.3 runtime with **zero constraints and no error** -> silently undersized output. SEED-003's "4.3 runtime reads 4.2 JSON" claim is falsified at the source. The npm alias direction is load-bearing and counter-intuitive: **4.3.0 must be the canonical `@esotericsoftware/spine-core`** install and 4.2.111 the aliased `spine-core-42`; the naive direction silently corrupts `spine-player@4.3.0` into a 4.3-renderer/4.2-runtime split-brain (reproduced live).

The dominant risk is **silent systematic undersize**, which has three independent triggers: (a) reading the unconstrained `pose` instead of `appliedPose` (compiles fine, returns pre-IK/pre-constraint geometry); (b) cross-runtime structural-typing corruption (a 4.2 `Skeleton` is structurally assignable to a 4.3 parameter — `tsc` won't stop it); (c) the 4.2 regression — the alias/adapter indirection touches every path the existing paying 4.2 user base flows through. The named defenses are: a **byte-equal 4.2 regression gate captured BEFORE the alias is added** (order is non-negotiable — you cannot baseline behavior after you change it), opaque branded boundary types that make cross-runtime mixing a compile error, and a **layered equivalence oracle** (same rig exported as 4.2 *and* 4.3, diffed within 1e-4) plus a closed-form slider fixture. A concrete blocker rides this: there is no redistributable in-repo 4.3 fixture and no slider fixture — acquisition is **owner-blocked** (needs a human Spine-editor export) and must be scheduled early off the critical path.

## Key Findings

### Recommended Stack

The existing stack (Electron 41 / electron-vite 5 / electron-builder 26, TS strict + React 19 + Tailwind v4, sharp 0.34.5, vitest 4) is locked and unchanged. The only stack changes are **two `package.json` dependency lines plus a forced v1.5.1 viewer-import refactor**. No new build tooling, no submodule, no fork, no Vite plugin, no tsconfig `paths`, no `npm overrides` (verified no-op). All alias/resolution/bundling claims were reproduced live against the actual 4.3.0 tarballs.

**Core technologies:**
- `@esotericsoftware/spine-core@4.3.0` (**canonical** name, exact-pinned) — the 4.3 skeleton/animation/constraint/physics/slider math. Made canonical specifically so `spine-player`/`spine-webgl` bare-resolve it correctly.
- `spine-core-42` = `npm:@esotericsoftware/spine-core@4.2.111` (exact-pinned alias) — the retained, regression-gated 4.2 runtime. Verified to install side-by-side with a fully distinct type surface under `tsc moduleResolution:bundler` (no `paths` config needed).
- `@esotericsoftware/spine-player@4.3.0` — the v1.5.1 Animation Viewer. Has NO direct `spine-core` dep -> relies on bare-specifier resolution -> **this is why 4.3 must be canonical**. `SpinePlayerConfig` surface is API-stable; the break is the removed `MixBlend`/`MixDirection` imports.

**Exact `package.json` target shape:**
```jsonc
"dependencies": {
  "@esotericsoftware/spine-core": "4.3.0",
  "spine-core-42": "npm:@esotericsoftware/spine-core@4.2.111",
  "@esotericsoftware/spine-player": "4.3.0"
}
```
> Naming nuance: STACK.md uses `spine-core-42`; ARCHITECTURE.md illustrates with `@esotericsoftware/spine-core-43`. **The alias *direction* (4.3 canonical, 4.2 aliased) is the load-bearing decision — the alias key name is a roadmapper choice.** STACK.md's `spine-core-42` (4.3 canonical) is the verified-correct direction; resolve the literal key name during planning. (See STACK.md.)

### Expected Features

"Feature" here = a Spine 4.3 runtime behavior the sampler/bounds layer must handle to keep computing the **correct** peak world-space render scale. (See FEATURES.md.)

**Must have (table stakes — a miss = wrong texture sizing = product broken for 4.3 rigs):**
- **Dual-runtime version router** — 4.2 JSON -> 4.2 runtime; 4.3 JSON -> 4.3 runtime. Mandatory; the load-bearing new component. Reuse + *invert* the existing `checkSpineVersion` + `checkSpine43Schema` predicates (Phase 32) from rejecters into a 3-way `detectRuntime()` dispatcher.
- **PORT-01 sampler API migration** — `setupPose`/`setupPoseSlots`/`setupPoseBones`, `setAnimation` (overload), `slot.pose.attachment`, `slot.pose.color` if touched, AnimationState `setTrack`/`getTrack`.
- **PORT-02 bounds signatures** — Region: `vertexOffsets` is the **2nd** arg via `getOffsets(slot.pose)`; Vertex: `skeleton` is the **1st** arg.
- **4.2 regression gate green** — `SIMPLE_TEST.json` byte-identical (LOCKED design fact 2).
- **PORT-03 slider fixture** — fixture-only; assert `peak(slider-driven) > peak(setup)`. No sampler code (source-proven free via `updateWorldTransform`).
- **Dual CI matrix** — 4.2.x + 4.3.x rigs both green from a fresh clone.

**Should have (competitive confidence — costs a fixture/assertion, not new code):**
- spine-player 4.3.0 viewer bump + Phase 41 basic-render regression (decoupled; separable phase).
- 4.3 transform-constraint multi-map fixture (new typed-routing JSON shape; world math is free).
- IK `scaleYMode` Uniform/Volume fixture (only matters for rigs that author it).

**Defer (post-v1.6):**
- 4.2 deprecation decision (v1.7 candidate — 4.2-rig users still protected).
- `.skel` binary 4.3 loader (out of scope since v1.0).
- Slider driver-bone fixture variant.

**Anti-features (explicitly OUT):** 4.3->4.2 schema shim / format translation (SEED-003 Option B trap — route, don't translate); rendering 4.3 in `core/`; authoring/writing 4.3 JSON; `.skel`; slider-as-UI-control; combined-skin compositing.

### Architecture Approach

A **thin runtime-adapter facade in `core/`**: one `SpineRuntime` interface (~20 method signatures), two impls (`runtime-42.ts` = verbatim relocation of today's calls — golden-preserving by construction; `runtime-43.ts` = new Pose API), selected by `loader.ts` from the detected version and threaded through `LoadResult.runtime`. `sampler.ts` (~750-line algorithm, untouched in logic) and `bounds.ts` call `rt.*` instead of importing spine-core. Opaque branded boundary types (`runtime/types.ts`, `unique symbol`) make cross-runtime mixing a *compile error* — stronger than the arch.spec grep. Rejected: duplicated sampler/bounds per runtime (doubles maintenance of the determinism contract), and a normalized internal model (re-implements the spine math CLAUDE.md fact #2 forbids — highest trap risk). (See ARCHITECTURE.md.)

**Major components:**
1. `loader.ts` (modified) — rejecter -> dispatcher (`resolveRuntimeTag`); keep `<4.2` reject, **add a NEW `>=4.4` reject arm** (future-proofing), repurpose `checkSpine43Schema` from throw to boolean routing signal, retire the "re-export as 4.2" message for the now-supported 4.3 path.
2. `runtime/` (NEW, Layer-3 pure) — `runtime.ts` (interface + lazy `pickRuntime` factory), `runtime-42.ts`, `runtime-43.ts`, `types.ts` (opaque handles). Only the two impls import a spine-core package.
3. `sampler.ts` / `bounds.ts` (modified) — ~12 leaf call-sites move behind `rt.*`; algorithm byte-unchanged. New arch.spec anchor asserts they no longer import `@esotericsoftware/spine-core` directly.
4. Worker stays runtime-blind; lazy `require()`/`import()` of only the matched runtime (one spine-core copy resident per job). spine-player viewer is **decoupled** (own embedded spine-core via spine-webgl; single version bump, no dual-runtime in the renderer).

### Critical Pitfalls

1. **Porting against SEED-006's beta inventory** — it is stale on 4 of 8 line items and omits the 3 largest surfaces. *Avoid:* treat SEED-006 as a falsified hypothesis; the verified mapping tables in this research are the spec. Exact-pin `4.3.0` (not `^`/`x`) — the `uniform->scaleY->scaleYMode` churn proves Esoteric changes APIs in patch-shaped releases.
2. **Reading `pose` instead of `appliedPose` -> silent systematic undersize (the existential failure mode)** — `getPose()` reads as "the pose" but returns pre-constraint geometry; every constraint-bearing rig reports a smaller-than-real peak; visible quality ships with no error. *Avoid:* adapter reads `bone.appliedPose` exclusively with a "WHY appliedPose" comment; the `SIMPLE_TEST` `TransformConstraint`-on-`SQUARE` is the canary in the equivalence oracle.
3. **No known-good oracle for a silently-wrong 4.3 sample** — no compiler error for "undersized by 8%". *Avoid:* layered oracle — (a) same-rig cross-runtime equivalence (same rig exported as 4.2 *and* 4.3, `globalPeaks` agree within ~1e-4 — strongest), (b) editor-bounds cross-check for 4.3-only features, (c) spine-player visual co-render (qualitative), (d) **closed-form slider fixture** (slider drives one bone X 0->100/1s, peak is analytically known — the only true slider oracle).
4. **Dual type-universe corruption** — both packages export `Skeleton`/`Slot`/`Bone`; structural typing silently accepts the wrong runtime's objects, `tsc` passes, runtime garbage. *Avoid:* opaque branded handles; no file imports both alias specifiers (arch-spec test); the runtime tag is a *required field on the handle* (per `feedback_explicit_identity_over_inference` — thread identity, don't infer).
5. **4.2 regression — the highest-blast-radius risk (hits the existing paying user base)** — the alias/dispatch indirection touches every 4.2 path; a re-resolved patch or reordered call silently changes shipped users' texture sizes. *Avoid:* **the byte-equal regression gate, captured on `main` BEFORE any v1.6 change** — strict `toEqual` on canonicalized output (not epsilon; 4.2 runtime is unchanged so *any* drift is a plumbing bug). Order is load-bearing.
6. **The cross-runtime `instanceof` hazard in `bounds.ts`** — `bounds.ts` branches on `attachment instanceof RegionAttachment` / `VertexAttachment` / `MeshAttachment`; a class from runtime A is *not* `instanceof` the class from runtime B. The adapter MUST resolve each skeleton's attachments against the same runtime instance that loaded it. **Highest correctness risk of the dual-runtime shape — needs an explicit invariant.**

## Implications for Roadmap

Phase numbering continues from v1.5.1 — **starts at Phase 42**. The architecture's 8 dependency-ordered work-units group into ~6 phases. The pitfalls research independently arrived at the same Phase 42-47 shape. **Phase 42 must capture the 4.2 baseline BEFORE the alias is added — this ordering is non-negotiable.**

### Phase 42: Alias + Pre-v1.6 Baseline + Boundary Scaffolding
**Rationale:** You cannot baseline 4.2 behavior after the refactor changes it. The alias + opaque-handle scaffolding gates everything downstream. This phase de-risks the entire milestone.
**Delivers:** lockfile-pinned npm alias (4.3.0 canonical / 4.2.111 = `spine-core-42`); **pre-v1.6 byte-equal `globalPeaks`/`SamplerOutput` golden snapshot for every in-repo 4.2 fixture, committed BEFORE the alias**; `runtime/types.ts` opaque handles; `SpineRuntime` interface (signatures only); `LoadResult.runtime` field; runtime-distinctness test (`adapter42.version !== adapter43.version`, `Slider`/`BonePose` present only in 4.3); production-bundle CI smoke; no-co-mingled-imports arch test.
**Avoids:** Pitfall 5 (4.2 regression), Pitfall 8 (npm-alias traps).
**Order-critical:** baseline commit MUST predate the alias add.

### Phase 43: Runtime-Adapter Facade + Verified API Mapping
**Rationale:** The router needs a proven, behavior-neutral facade before any 4.3 code routes anywhere. UNIT 2's "4.2 goldens stay byte-green" is a phase-exit gate — if they move, the facade leaks and the port stops.
**Delivers:** `runtime-42.ts` (verbatim relocation; 4.2 path rewired to `rt.*`, byte-green); `runtime-43.ts` written against the *verified* mapping tables in this research (NOT SEED-006) — `appliedPose`-only world reads, `setupPose*`, `setAnimation` overload, `slot.pose.attachment/.color`, `bone.appliedPose.getWorldScaleX/Y`; the two `computeWorldVertices` signatures (Region `vertexOffsets` 2nd via `getOffsets(slot.pose)`, Vertex `skeleton` first); the rotated-region fix re-expressed for 4.3 (no mutable `offset[]`); the explicit cross-runtime-`instanceof` invariant.
**Uses:** STACK.md alias mechanics, ARCHITECTURE.md facade pattern + interface shape.
**Implements:** `runtime/` adapter seam; new arch.spec anchor (sampler/bounds NOT importing spine-core directly).
**Avoids:** Pitfall 1 (beta drift), 2 (wrong-pose undersize), 4 (type-universe), 6 (`instanceof`).

### Phase 44: Loader Dispatch + 4.2<->4.3 Equivalence Oracle + 4.3 Fixture Authoring
**Rationale:** The router must precede live 4.3 routing; the oracle must exist before any 4.3-feature phase can be trusted. The owner fixture task must be unblocked early (off the critical path).
**Delivers:** `checkSpineVersion` -> `RuntimeTag` (keep `<4.2` throw, add `>=4.4` throw); `checkSpine43Schema` repurposed to boolean; **owner-action fixture acquisition** (recommended path: re-export `SIMPLE_TEST` from a 4.3 editor as both "Version 4.3" and "Version 4.2" -> the same-rig cross-runtime oracle; plus a minimal slider rig); same-rig cross-runtime diff within 1e-4; committed in-repo 4.3 fixture (`fixtures/SLIDER_4_3/` or analog); spine-editor#891 status check before trusting any downgraded fixture.
**Avoids:** Pitfall 3 (no oracle), 9 (fixture blocker), 10 (editor#891).
**Owner-blocked:** fixture acquisition needs a human Spine-editor export — schedule the owner task at Phase 42/44 start, not when the consuming tests need it.

### Phase 45: Dispatcher Flip + Copy/Docs Sweep
**Rationale:** Flip the user-facing reject only after the 4.3 path actually works and the oracle proves it.
**Delivers:** loader/errors/IPC throw->route for 4.3; invert the 6 reject-assertion test files (assert dispatch, **preserve pre-4.2/future-version throw cases — narrow the guard, don't delete it**); drop-zone copy (`App.tsx:676` "v4.2"->"v4.2 or v4.3"); DocumentationBuilder HTML template; README/INSTALL/Help sweep; `git grep -i "version 4.2|re-export"` clean in renderer/docs.
**Avoids:** Pitfall 6 (stale reject surfaces — the inverted predicate tests are a false-green trap; the DocBuilder template + drop-zone tooltip are the easily-missed cosmetic ones).

### Phase 46: Slider Constraint Validation (PORT-03)
**Rationale:** Slider is the one 4.3-only feature with zero cross-runtime analog — needs its own closed-form oracle. Source-proven free via `updateWorldTransform`; this is fixture + assertion only.
**Delivers:** slider fixture (hand-designed: bone X 0->100 over 1s, one square region -> analytically-known peak); assert sampled peak == independently-derived value (NOT a self-referential "it runs"); confirm propagation rides the unchanged `Physics.update` path.
**Addresses:** PORT-03 (fixture-only — NO sampler code).
**Avoids:** Pitfall 3 #4 (slider closed-form oracle mandatory).

### Phase 47: spine-player 4.3.0 Bump + Viewer Regression
**Rationale:** Deliberately last and revertible — a player-bump regression must not block the sampler port from shipping. Depends only on Phase 42's alias, parallelizable with 43-46.
**Delivers:** `@esotericsoftware/spine-player` 4.2.111->4.3.0; **drop the removed `MixBlend`/`MixDirection` imports from `AnimationPlayerModal.tsx`** and migrate to the new `apply(fromSetup, add, out, appliedPose)` model; `SpinePlayerConfig` audit vs 4.3.0 `.d.ts`; GL straight-alpha re-verification (the sharp/libvips PMA memory does NOT transfer to spine-webgl GL); re-run the 5 carried Phase 41 HUMAN-UATs on the 4.3 player; verify a 4.2 fixture renders through the 4.3 player.
**Avoids:** Pitfall 7 (viewer regression in fragile host-blocked code).

### Phase Ordering Rationale
- **Phase 42 is immovable-first:** baseline-before-alias is a hard ordering constraint; capturing it after the refactor makes it useless (~100x costlier recovery).
- **Facade (43) before router (44):** no 4.3 file may route anywhere until a behavior-neutral facade is proven on the 4.2 path (the de-risking gate).
- **Oracle (44) before any 4.3-feature trust:** the equivalence oracle gates the dispatcher flip and slider phases; the owner fixture task is the critical-path blocker — pull it forward.
- **Dispatcher flip (45) after the 4.3 path works:** flipping user-facing copy before correctness is verified ships a wrong promise.
- **Slider (46) needs the Phase 44 fixture/oracle.**
- **Viewer (47) last + revertible by design:** the player bump is decoupled (own embedded spine-core); a regression there must not gate the core port.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 43:** `RegionAttachment.getOffsets(slot.pose)` exact semantics + the 4.3 rotated-region re-expression (Phase 33's `offset[]` mechanism is gone — the offsets now flow through `Sequence`; the new shape needs source-confirmation before the adapter body is written). The cross-runtime `instanceof` invariant needs an explicit design.
- **Phase 44:** spine-editor#891 (4.3->4.2 downgrade IK-scrambling) status against the *current* 4.3.0 editor is **LOW confidence** — un-resolvable from runtime tarballs; must be human-verified before trusting any downgraded fixture (fallback: non-IK oracle rig).
- **Phase 46/perf:** 4.3's three-pose model = more allocations per bone per tick. Performance vs the N2.2 606 ms wall-time contract on `fixtures/Girl/` is **un-quantified** — needs a measured 4.3 wall-time gate, not an assumption.

Phases with standard patterns (lighter research):
- **Phase 42:** alias mechanics fully verified live (HIGH); standard lockfile/CI hygiene.
- **Phase 45:** mechanical surface flip — the Pitfall 6 table is the exhaustive checklist (grep-verified).
- **Phase 47:** `SpinePlayerConfig` surface verified stable; risk is rendering behavior, scoped to the 5 pre-written UATs.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All alias/resolution/bundling claims reproduced live against the actual published 4.3.0 tarballs (naive-split-brain, inverted-clean-tree, overrides no-op, dual ESM import, vitest, vite build, tsc dual-type isolation). |
| Features | HIGH | Verified against compiled `dist/*.js` + `*.d.ts` of `spine-core@4.3.0`/`spine-player@4.3.0` — the exact artifacts the app consumes. Slider "free via updateWorldTransform" is source-proven (`Slider.js` + `Skeleton.updateCache/updateWorldTransform`). |
| Architecture | HIGH | Facade interface derived from actual `sampler.ts`/`bounds.ts` call sites; the beta-vs-stable drift table verified line-by-line against the npm `.d.ts`. |
| Pitfalls | HIGH (one LOW item flagged) | Every API claim verified against the 4.3.0 tarball. **Exception:** spine-editor#891 stable-editor status is LOW (an editor bug, not in spine-ts — un-verifiable from tarballs; flagged for explicit Phase 44 human check). |

**Overall confidence:** HIGH — with four independent verifications converging on the same corrected facts.

### Gaps to Address
- **No redistributable in-repo 4.3 / slider fixture (HARD BLOCKER, owner-action).** Acquisition is owner-blocked (needs the Spine editor + a human export). Plan: owner re-exports `SIMPLE_TEST` from a 4.3 editor as both "Version 4.3" and "Version 4.2" (the highest-value cross-runtime oracle) + a minimal slider rig; no-editor fallback is a hand-authored 4.3 JSON (parser-only, NOT the math oracle). **Schedule at Phase 42/44 start, off the critical path.**
- **spine-editor#891 (4.3->4.2 downgrade IK-scrambling) — LOW confidence on stable status.** Could silently poison the equivalence oracle's 4.2-dialect reference. Handle: spot-check IK timeline keys before trusting any downgraded fixture; fallback to a non-IK oracle rig (TransformConstraint still exercises the appliedPose canary).
- **4.3 three-pose perf vs the N2.2 606 ms contract — un-quantified.** Handle: re-run the wall-time gate on a comparable-complexity 4.3 rig during Phase 46; budget for 4.3 being intrinsically heavier per tick; do not assume parity.
- **Alias key literal name unresolved across research files** (`spine-core-42` in STACK vs `@esotericsoftware/spine-core-43` illustration in ARCHITECTURE). The *direction* is verified (4.3 canonical); the literal key is a Phase 42 planning decision — pick one and use it consistently.
- **`RegionAttachment.getOffsets(slot.pose)` rotated-region re-expression** — the 4.3 replacement for the Phase 33 `offset[]` patch needs source-confirmation before the `runtime-43.ts` body is finalized (Phase 43 research flag).

## Sources

### Primary (HIGH confidence)
- `@esotericsoftware/spine-core@4.3.0` npm tarball — compiled `dist/*.js` + `dist/*.d.ts` (Skeleton, Slot, SlotPose, Bone, BonePose, Posed, RegionAttachment, Attachment[VertexAttachment], AnimationState, SkeletonData, SkeletonJson, AtlasAttachmentLoader, Slider, SliderData, SliderPose, IkConstraintData, Physics, index) — the exact artifact the app consumes, STABLE not beta — verified 2026-05-16
- `@esotericsoftware/spine-player@4.3.0` + `@esotericsoftware/spine-webgl@4.3.0` npm tarballs — `Player.d.ts` `SpinePlayerConfig`, `package.json` dependency chain — verified 2026-05-16
- Live `npm view` dist-tags/versions/time/dependencies + live sandbox installs reproducing the naive-split-brain, inverted-clean-tree, overrides-no-op, dual-ESM-import, vitest, vite-build, and tsc-dual-type-isolation behaviors — verified 2026-05-16
- spine-runtimes `4.3` branch CHANGELOG (https://raw.githubusercontent.com/EsotericSoftware/spine-runtimes/4.3/CHANGELOG.md) — Pose system, MixBlend/MixDirection removal, setupPose* renames, setTrack/getTrack, computeWorldVertices +skeleton, getAppliedPose, Slider — STABLE branch
- Spine Versioning guide (https://en.esotericsoftware.com/spine-versioning) — "major.minor must match between editor export and runtime" — falsifies SEED-003's "4.3 runtime + 4.2 JSON compat"
- Project source — `src/core/{loader,sampler,bounds,errors}.ts`, `src/main/{sampler-worker,sampler-worker-bridge}.ts`, `src/renderer/src/{App.tsx,modals/AnimationPlayerModal.tsx}`, `tests/arch.spec.ts`, 6 reject-assertion test files; `.planning/PROJECT.md`, `CLAUDE.md`, SEED-003/006 — grep-verified 2026-05-16

### Secondary (MEDIUM confidence)
- Context7 `/esotericsoftware/spine-runtimes` (CHANGELOG cross-checked)
- spine-editor#891 — IK timeline scrambling on 4.3->4.2 downgrade (https://github.com/EsotericSoftware/spine-editor/issues/891) — beta-era bug; informs the fixture-downgrade caveat

### Tertiary (LOW confidence)
- spine-editor#891 **stable-release status** — not verifiable from runtime tarballs (it is an editor bug, not in spine-ts); flagged for explicit human check during Phase 44 fixture authoring

---
*Research completed: 2026-05-16*
*Ready for roadmap: yes*
