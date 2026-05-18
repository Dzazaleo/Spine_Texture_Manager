# Roadmap: Spine Texture Manager

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 + 08.1 + 08.2 (shipped 2026-04-26) — archive at [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1.x Distribution & Hardening** — Phases 10–15 (shipped 2026-04-29)
- ✅ **v1.2 Expansion** — Phases 16–22.1 (shipped 2026-05-03) — archive at [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Polish & UX** — Phases 23–28 (shipped 2026-05-07) — archive at [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ✅ **v1.3.1 Correctness & Refinements** — Phases 29–31 (shipped 2026-05-09) — archive at [milestones/v1.3.1-ROADMAP.md](milestones/v1.3.1-ROADMAP.md)
- ✅ **v1.4 Spine 4.3 Forward-Compat + Rotated Atlases** — Phases 32–35 (shipped 2026-05-12) — archive at [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)
- ✅ **v1.5 Override Routing + Coverage Hardening + Atlas Repack** — Phases 36–40 (shipped 2026-05-15) — archive at [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md)
- ✅ **v1.5.1 Spine Animation Viewer** — Phase 41 (functionally complete 2026-05-15)
- 🟢 **v1.6 Spine 4.3 Runtime Port (Dual-Runtime)** — Phases 42–47 (in progress, started 2026-05-16)

## Overview

v1.6 ports the skeleton/animation math from a single spine-core 4.2.111 runtime to a **dual-runtime** architecture: `@esotericsoftware/spine-core@4.3.0` is installed side-by-side with `4.2.111` (via a lockfile-pinned npm alias), and the loader routes each skeleton to the runtime matching its detected version. The 4.3.0 surface is a **Pose-architecture rewrite** (verified against the published stable tarballs — SEED-006's beta inventory is falsified by `.planning/research/SUMMARY.md` and is NOT used here): every world-transform and attachment read in `core/bounds.ts` / `core/sampler.ts` moved to `bone.appliedPose` / `slot.pose`. The journey is six dependency-ordered phases with one immovable ordering constraint — the byte-equal 4.2 baseline is captured **before** the npm alias lands, because behavior cannot be baselined after the refactor changes it. A thin `SpineRuntime` adapter facade isolates the version delta so the ~750-line sampler algorithm is never forked; an independent equivalence oracle (same rig exported as both 4.2 and 4.3, diffed within 1e-4) plus a closed-form slider fixture defend against the dominant failure mode: silent systematic undersize that ships visible quality loss with no compiler error and no crash. The spine-player viewer bump is deliberately last and revertible so a player regression cannot gate the core port.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

v1.6 continues phase numbering from v1.5.1 (no `--reset-phase-numbers`). v1.5.1 ended at Phase 41; v1.6 starts at **Phase 42**. Prior phase directories preserved at `.planning/phases/`.

<details>
<summary>✅ v1.0 MVP (Phases 0–9 + 08.1 + 08.2) — SHIPPED 2026-04-26</summary>

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.1.x Distribution & Hardening (Phases 10–15) — SHIPPED 2026-04-29</summary>

Phases 10–15. See `.planning/MILESTONES.md` for v1.1 / v1.1.1 / v1.1.2 / v1.1.3 entries.

</details>

<details>
<summary>✅ v1.2 Expansion (Phases 16–22.1) — SHIPPED 2026-05-03</summary>

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.3 Polish & UX (Phases 23–28) — SHIPPED 2026-05-07</summary>

See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.3.1 Correctness & Refinements (Phases 29–31) — SHIPPED 2026-05-09</summary>

See [milestones/v1.3.1-ROADMAP.md](milestones/v1.3.1-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.4 Spine 4.3 Forward-Compat + Rotated Atlases (Phases 32–35) — SHIPPED 2026-05-12</summary>

See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.5 Override Routing + Coverage Hardening + Atlas Repack (Phases 36–40) — SHIPPED 2026-05-15</summary>

- [x] Phase 36: Split Overrides Per Loader Mode (5/5 plans) — completed 2026-05-13
- [x] Phase 37: Spine 4.2 Timeline Coverage Hardening (3/3 plans) — completed 2026-05-13
- [x] Phase 38: Phase 4 Code-Review Polish Pass (3/3 plans) — completed 2026-05-13
- [x] Phase 39: Windows Host-Blocked UAT Burndown (3/3 plans) — completed 2026-05-13
- [x] Phase 40: Atlas Repack Output (9/9 plans) — completed 2026-05-15

See [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.5.1 Spine Animation Viewer (Phase 41) — functionally COMPLETE 2026-05-15</summary>

- [x] Phase 41: Spine Animation Viewer (3/3 plans) — completed 2026-05-15 (5 visual/host HUMAN-UATs carried to v1.6 PLAYER-02)

</details>

### 🟢 v1.6 Spine 4.3 Runtime Port — Dual-Runtime (Phases 42–47)

**Milestone Goal:** Load and correctly sample both Spine 4.2 and Spine 4.3 skeleton JSON, routed by detected version, with 4.2 behavior byte-frozen and 4.3 correctness independently oracle-proven.

- [x] **Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding** - Capture the byte-equal 4.2 golden BEFORE the alias lands; install 4.3.0 canonical / 4.2.111 aliased; stand up the opaque-handle boundary + CI dual-matrix reproducibility (completed 2026-05-16)
- [x] **Phase 43: Runtime-Adapter Facade + Verified 4.3 API Mapping** - Behavior-neutral `SpineRuntime` facade with the 4.2 path proven byte-green (hard exit gate), then the 4.3 adapter written against the verified-stable Pose API (all 6/6 plans complete incl. 43-06 gap-closure 2026-05-17; GAP-43-PROD-SEAM CLOSED — awaiting orchestrator phase-level re-verification/closure) (completed 2026-05-17)
- [x] **Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring** - Rejecter→dispatcher routing; owner-exported in-repo 4.3 fixtures; same-rig cross-runtime equivalence proof within 1e-4 (completed 2026-05-18)
- [ ] **Phase 45: Dispatcher User-Facing Flip + Copy/Docs Sweep** - Flip the "re-export as 4.2" reject to supported-4.3 only after the path works; sweep every stale surface; invert the 6 guard-test files preserving the narrowed throw cases
- [ ] **Phase 46: Slider Constraint Validation + 4.3 Performance Budget** - Closed-form slider oracle fixture; record a measured 4.3-specific wall-time regression budget against the N2.2 contract
- [ ] **Phase 47: spine-player 4.3.0 Bump + Viewer Regression** - Decoupled, revertible viewer bump; drop removed `MixBlend`/`MixDirection`; re-run the 5 carried Phase 41 HUMAN-UATs on the 4.3 player

## Phase Details

### Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding
**Goal**: De-risk the entire milestone by freezing the existing 4.2 behavior as a committed byte-equal golden *before any code changes*, then landing the lockfile-pinned dual-install and the opaque-handle boundary scaffolding that gates every downstream phase.
**Depends on**: v1.5.1 milestone (Phase 41) functionally complete. First v1.6 phase.
**Requirements**: SAFE-01, RT-01, RT-03, RT-04, CI-01
**Success Criteria** (what must be TRUE):
  1. A deterministic byte-equal golden snapshot of `globalPeaks` / `SamplerOutput` for every in-repo 4.2 fixture is committed in a commit that **predates** the npm-alias commit (verifiable in git history — order is the acceptance test, per SAFE-01). *(SAFE-01)*
  2. From a fresh clone + `npm ci`, `@esotericsoftware/spine-core@4.3.0` (canonical) and `4.2.111` (the lockfile-committed exact-pinned alias) both resolve identically under `tsc`, Vite renderer, Vite main, `worker_threads`, and `vitest`; a runtime-distinctness test asserts `adapter42.version !== adapter43.version` and that `Slider`/`BonePose` exist only in the 4.3 module. *(RT-01)*
  3. A 4.2 runtime object reaching a 4.3 boundary (or vice-versa) is a **compile-time** error: opaque branded handles carry an explicit required runtime tag, and no source file imports both alias specifiers (arch-spec enforced). *(RT-03)*
  4. The new `core/runtime/` module imports no DOM, Electron, or `sharp`; the Layer-3 purity invariant is green under `tests/arch.spec.ts` after the scaffolding lands. *(RT-04)*
  5. CI runs from a fresh clone against both 4.2.x and 4.3.x fixture slots, the npm alias resolves reproducibly under `npm ci`, electron-builder packages both spine-core copies, and a production-bundle smoke job runs the built worker against a 4.2 and a 4.3 fixture (not from `src/`). *(CI-01)*
**Plans**: 5 plans (4 frozen waves + 1 gap-closure follow-up; the 4-commit ordering A->B->C->D is the acceptance test)
- [x] 42-01-PLAN.md — COMMIT A: SAFE-01 byte-equal 4.2 baseline (canonical serializer + auto-discovery + enumeration + freeze-guard) captured BEFORE the alias *(SAFE-01)*
- [x] 42-02-PLAN.md — COMMIT B: RT-01 dual-install (4.3.0 canonical + `spine-core-42` exact-pinned alias) + resolution/distinctness tests; git descendant of COMMIT A *(RT-01)*
- [x] 42-03-PLAN.md — COMMIT C: RT-03/RT-04 opaque-handle scaffolding (branded handles + SpineRuntime signatures + LoadResult.runtime? + arch anchors + compile-negative fixture) *(RT-03, RT-04)*
- [x] 42-04-PLAN.md — COMMIT D: CI-01 `ci.yml` dual-runtime gate + D-13 4.3 load-smoke + Phase-44 owner-fixture guard + `42-OWNER-EXPORT-SPEC.md` *(CI-01)*
- [x] 42-05-PLAN.md — GAP-CLOSURE (additive descendant of D): restore the RT-01 ROADMAP-SC-#2 runtime-distinctness regression test (collaterally dropped by the Option-1 re-plan) + harden the CR-01 D-09 SAFE-01 ancestry resolution (user-decided HARDEN NOW) *(RT-01, SAFE-01)*

### Phase 43: Runtime-Adapter Facade + Verified 4.3 API Mapping
**Goal**: Introduce the `SpineRuntime` adapter facade with the 4.2 path proven behavior-neutral (byte-green — the hard phase-exit gate), then implement the 4.3 adapter against the research-verified stable Pose API so the ~750-line sampler/bounds algorithm is never forked.
**Depends on**: Phase 42 (needs the alias, opaque handles, and the `SpineRuntime` interface signatures + the SAFE-01 baseline to gate against)
**Requirements**: RT-02, SAFE-02, SAFE-03, PORT-01, PORT-02, PORT-03
**Success Criteria** (what must be TRUE):
  1. `core/sampler.ts` and `core/bounds.ts` no longer import `@esotericsoftware/spine-core` directly; both call through `load.runtime.*`, and a new `tests/arch.spec.ts` anchor enforces this. Two adapter implementations (`runtime-42`, `runtime-43`) exist in `core/runtime/`. *(RT-02)*
  2. Every in-repo 4.2 fixture sampled through the new adapter produces output **byte-identical** (strict `toEqual` on canonicalized output, not epsilon) to the Phase 42 pre-v1.6 baseline — this is the phase-exit gate; if it moves, the facade leaks and the port stops. *(SAFE-02)*
  3. A regression test proves each loaded skeleton's attachments resolve `instanceof` (Region / Vertex / Mesh) against the same runtime instance that loaded it — cross-runtime `instanceof` mixing is caught, not silently mis-branched. *(SAFE-03)*
  4. A 4.3 skeleton samples through the 4.3 adapter using the verified-stable API (`setupPose`/`setupPoseSlots`/`setupPoseBones`, overloaded `setAnimation`, `slot.pose.attachment`, `slot.pose.color`, AnimationState `setTrack`/`getTrack`), reading the post-constraint `appliedPose` for all world-transform-relevant state. *(PORT-01)*
  5. `core/bounds.ts` (via the adapter) computes world vertices for 4.3 `RegionAttachment` (`vertexOffsets` as the 2nd arg via `getOffsets(slot.pose)`) and `VertexAttachment` (`skeleton` as the 1st arg), reads bone world scale via `bone.appliedPose.getWorldScaleX/Y()`, and the v1.4 Phase 33 rotated-atlas offset mechanism is re-expressed for 4.3 (no mutable `offset[]`) with the 4.2 rotated-atlas path unchanged and regression-locked. *(PORT-02, PORT-03)*
**Plans**: 6 plans (5 waves; Wave 0 test seams + Q1 additive method -> Wave 1 the two adapter bodies in parallel -> Wave 2 consumer rewire + SAFE-02 byte-equal exit gate -> Wave 3 4.3 own-baseline + A1 empirical rotated-region validation + D-04 heavy-rig close gate -> Wave 4 GAP-CLOSURE: GAP-43-PROD-SEAM production worker adapter-resolution fix)
- [x] 43-01-PLAN.md -- Wave 0: RT-02 arch anchor (RED by design) + Q1 strictly-additive `attachmentTimelineNames` interface method + the 4 ENOENT-tolerant 4.3 test seams *(RT-02, SAFE-03, PORT-01, PORT-03)*
- [x] 43-02-PLAN.md -- Wave 1: `runtime-42.ts` byte-faithful verbatim relocation (SAFE-02-by-construction) + Phase-33 patch relocation + the `pickRuntime` lazy-require body *(RT-02, SAFE-02, PORT-03)*
- [x] 43-04-PLAN.md -- Wave 1: `runtime-43.ts` verified 4.3.0 Pose-API port + D-03 appliedPose-only structural defense + `.region`/`.uvs`->`sequence` routing *(RT-02, PORT-01, PORT-02, PORT-03)*
- [x] 43-03-PLAN.md -- Wave 2: rewire loader/sampler/bounds to `load.runtime.*` (RT-02 anchor -> GREEN; D-02 hard-pick 4.2) + SAFE-02 byte-equal HARD exit gate + SAFE-03 *(RT-02, SAFE-02, SAFE-03)*
- [x] 43-05-PLAN.md -- Wave 3: capture the SEPARATE 4.3 own-baseline + EMPIRICALLY validate A1 rotated-region vs the 4.2-sibling known-good + 4.3-only fixture commit + D-04 documented local heavy-rig SAFE-02 close gate *(PORT-01, PORT-02, PORT-03, SAFE-02)*
- [x] 43-06-PLAN.md -- Wave 4 (GAP-CLOSURE): close GAP-43-PROD-SEAM — emit `runtime-42`/`runtime-43` as resolvable build artifacts (ARCHITECTURE §4/§7 build-order item) + correct the pickRuntime prod require literal to `../runtime-4x.cjs` + a build-required spawn-smoke falsifier; LOCKED Option-A constraints (a)-(d) + SAFE-02 byte-equality preserved *(RT-02, SAFE-02, PORT-01, PORT-02, PORT-03)*

### Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring
**Goal**: Repurpose the loader from rejecter to version dispatcher, acquire the owner-blocked in-repo 4.3 fixtures (scheduled early, off the critical path), and stand up the layered equivalence oracle that gates every 4.3-feature claim before any user-facing flip.
**Depends on**: Phase 43 (the router cannot route to a 4.3 runtime until the 4.3 adapter exists and is byte-neutral on 4.2). Owner-action fixture-export task should start at Phase 42/44 boundary, not when consuming tests need it.
**Requirements**: DISP-01, DISP-02, DISP-03, ORCL-01, ORCL-02, ORCL-03, XTRA-01, XTRA-02
**Success Criteria** (what must be TRUE):
  1. The loader detects the skeleton version and routes 4.2 JSON → 4.2 runtime and 4.3 JSON → 4.3 runtime; the existing `checkSpine43Schema` predicate is repurposed from a rejecter into a routing signal; routing is decided by detected version *before* runtime load, so a 4.2 JSON is never silently loaded by the 4.3 runtime (which would yield zero constraints with no error). *(DISP-01, DISP-03)*
  2. Genuinely unsupported versions still reject with the existing typed-error envelope: the `< 4.2` guard is preserved and a NEW `≥ 4.4` guard arm is added (a hypothetical 4.4 export hits the typed rejecter, not the 4.3 runtime). *(DISP-02)*
  3. An owner-exported SIMPLE_TEST-equivalent rig — exported from a Spine 4.3 editor as **both** "Version 4.3" and "Version 4.2" — is committed in-repo and redistributable; spine-editor#891 (4.3→4.2 downgrade IK-scramble) status is human-verified before the dual-version reference is trusted, with the documented fallback to a non-IK `appliedPose`-canary rig if unresolved. *(ORCL-01, ORCL-03)*
  4. A same-rig cross-runtime equivalence test asserts the 4.3-runtime and 4.2-runtime `globalPeaks` agree within 1e-4 on the ORCL-01 rig (the `TransformConstraint`-on-`SQUARE` is the wrong-pose-undersize canary). *(ORCL-02)*
  5. A 4.3 transform-constraint multi-map fixture (one source → multiple differently-typed targets, local↔world with clamp) and a 4.3 IK `scaleYMode` fixture (Uniform + Volume, with default `None` confirmed 4.2-equivalent) both sample correctly through the adapter. *(XTRA-01, XTRA-02)*
**Plans**: 4 plans (3 waves; Wave 1 fixture+driver foundation -> Wave 2 the dispatch flip + co-required D-04 denylist -> Wave 3 parallel: D-11 reconciliation + 3-entrypoint verify ∥ the ORCL-02 hard gate + XTRA/SLIDER specs)
- [x] 44-01-PLAN.md — Wave 1: commit the ORCL-01 4.2-sibling + 3 owner 4.3 rigs (D-05), add buildLoadXtra01/02 to baseline-driver, bump CURRENT_PHASE 42->44 *(ORCL-01)*
- [x] 44-02-PLAN.md — Wave 2: resolveRuntimeTag dispatch flip (D-06/07/08/09) + SpineVersionUnsupportedError 2->3 branch (D-10) + the CO-REQUIRED D-04 SAFE-01 denylist *(DISP-01, DISP-02, DISP-03)*
- [x] 44-03-PLAN.md — Wave 3: D-11 test-suite reconciliation (4.3 arms->routing, <4.2/>=4.4 throws preserved) + the [BLOCKING] 3-entrypoint Multi-Runtime verification + ORCL-03/Phase-45-split dispositions *(DISP-01, DISP-03)*
- [x] 44-04-PLAN.md — Wave 3: ORCL-02 all-3-maps cross-runtime HARD gate (D-12/13/14) + XTRA-01/02 own-baseline+structural (D-03) + SLIDER smoke (D-02) *(ORCL-02, ORCL-03, XTRA-01, XTRA-02)*

### Phase 45: Dispatcher User-Facing Flip + Copy/Docs Sweep
**Goal**: Flip the user-facing "re-export as Version 4.2" reject into first-class 4.3 support — only now that the 4.3 path works and the oracle proves it — and sweep every stale 4.2-only surface so the app's promise matches its capability.
**Depends on**: Phase 44 (flipping user-facing copy before the 4.3 path is oracle-verified ships a wrong promise)
**Requirements**: UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. For a 4.3 file, the drop-zone copy and the loader error no longer instruct the user to "re-export as Version 4.2"; 4.3 is presented as supported (e.g. drop-zone "v4.2 or v4.3"). *(UX-01)*
  2. Every stale "Spine v4.2 only" / "re-export as 4.2" surface is swept — App.tsx drop-zone, loader/error strings, Documentation Builder HTML template, README/INSTALL/Help — and `git grep -i "version 4.2|re-export"` is clean in renderer/docs. *(UX-02)*
  3. The 6 reject-assertion test files are inverted to assert routing (dispatch target, not exception) for 4.3 inputs, while the `< 4.2` and `≥ 4.4` throw-cases are explicitly preserved (the guard is narrowed, not deleted — a passing test still asserting the old 4.3 reject is a false-green). *(UX-02)*
**Plans**: TBD

### Phase 46: Slider Constraint Validation + 4.3 Performance Budget
**Goal**: Prove the 4.3-only slider constraint propagates correctly via the unchanged `updateWorldTransform(Physics.update)` path using an independently-derived closed-form oracle (the only true slider ground truth), and record a measured 4.3-specific performance budget rather than assuming parity with the 4.2 contract.
**Depends on**: Phase 44 (the slider fixture rides the same owner-export pipeline as the oracle/4.3 fixtures; needs both the bounds and sampler 4.3 surfaces working)
**Requirements**: SLIDER-01, SLIDER-02, PERF-01
**Success Criteria** (what must be TRUE):
  1. A minimal slider rig (a slider drives one bone's X over a known time window) is committed in-repo from a 4.3 editor export. *(SLIDER-01)*
  2. A closed-form test asserts the sampled peak for the slider rig equals the independently-derived analytical value (not a self-referential "it runs"), confirming the slider effect propagates via the existing `updateWorldTransform(Physics.update)` path with no slider-specific sampler code. *(SLIDER-02)*
  3. 4.3 sampler wall-time is measured on a complex 4.3 rig against the N2.2 606 ms contract and a 4.3-specific regression budget is recorded — 4.3's three-pose model is heavier per tick, so parity is not assumed and the budget reflects measured reality. *(PERF-01)*
**Plans**: TBD

### Phase 47: spine-player 4.3.0 Bump + Viewer Regression
**Goal**: Bump the decoupled spine-player viewer to 4.3.0 last and revertibly — a player regression must not gate the core port — migrating the removed apply-model imports and re-running the carried Phase 41 viewer UATs on the 4.3 player.
**Depends on**: Phase 42 only (the alias) — decoupled from the core port (own embedded spine-core via spine-webgl); schedulable in parallel with Phases 43–46, sequenced last so a player-bump regression cannot block the sampler port from shipping.
**Requirements**: PLAYER-01, PLAYER-02
**Success Criteria** (what must be TRUE):
  1. `@esotericsoftware/spine-player` is bumped 4.2.111 → 4.3.0; the removed `MixBlend` / `MixDirection` imports are dropped from `AnimationPlayerModal.tsx` and migrated to the new `apply(fromSetup, add, out, appliedPose)` model. *(PLAYER-01)*
  2. The v1.5.1 viewer renders both a 4.2 and a 4.3 fixture correctly through the 4.3 player, GL straight-alpha is independently re-verified (the sharp/libvips PMA reasoning does NOT transfer to spine-webgl GL — no dark-fringe/double-multiply halo on SIMPLE_TEST), and the 5 carried Phase 41 HUMAN-UATs are re-run on the 4.3 player. *(PLAYER-02)*
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 42 → 43 → 44 → 45 → 46 → 47 (47 depends only on 42's alias and is parallelizable with 43–46 but sequenced last for revertibility).

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 36 | v1.5 | 5/5 | Complete | 2026-05-13 |
| 37 | v1.5 | 3/3 | Complete | 2026-05-13 |
| 38 | v1.5 | 3/3 | Complete | 2026-05-13 |
| 39 | v1.5 | 3/3 | Complete | 2026-05-13 |
| 40 | v1.5 | 9/9 | Complete | 2026-05-15 |
| 41 | v1.5.1 | 3/3 | Complete | 2026-05-15 |
| 42. Pre-v1.6 Baseline + Alias + Scaffolding | v1.6 | 5/5 | Complete    | 2026-05-16 |
| 43. Runtime-Adapter Facade + 4.3 API Mapping | v1.6 | 6/6 | Complete    | 2026-05-17 |
| 44. Loader Dispatch + Equivalence Oracle + 4.3 Fixtures | v1.6 | 5/4 | Complete    | 2026-05-18 |
| 45. Dispatcher Flip + Copy/Docs Sweep | v1.6 | 0/TBD | Not started | - |
| 46. Slider Validation + 4.3 Perf Budget | v1.6 | 0/TBD | Not started | - |
| 47. spine-player 4.3.0 Bump + Viewer Regression | v1.6 | 0/TBD | Not started | - |

(Phases 0–35 are collapsed under their respective milestones above. Per-phase details live in each milestone's archive.)

---

*ROADMAP.md is authored fresh at each milestone start. v1.5 ROADMAP archived at [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md). v1.0–v1.5.1 phase directories preserved at `.planning/phases/` per user choice. v1.6 continues numbering from Phase 42 (no `--reset-phase-numbers`). Phase shape derived from `.planning/research/SUMMARY.md` + ARCHITECTURE.md + PITFALLS.md (HIGH confidence; SEED-006 beta inventory falsified and NOT used). Order-critical: SAFE-01 baseline commit MUST predate the RT-01 alias commit (Phase 42).*
