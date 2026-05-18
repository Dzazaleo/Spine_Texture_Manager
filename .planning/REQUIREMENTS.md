# Requirements: Spine Texture Manager v1.6 — Spine 4.3 Runtime Port (Dual-Runtime)

**Defined:** 2026-05-16
**Core Value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

**Milestone goal:** Port the skeleton/animation math from a single spine-core 4.2 runtime to a dual-runtime architecture that loads and correctly samples both Spine 4.2 and Spine 4.3 skeleton JSON, routed by detected skeleton version.

**Source seed:** [SEED-006](seeds/SEED-006-spine-4.3-runtime-port.md) — trigger fired 2026-05-16 (`npm view @esotericsoftware/spine-core@latest` → `4.3.0`).

> **⚠ SEED-006's costed inventory (PORT-01..04, beta-built) is SUPERSEDED.** All four research agents independently verified the published `@esotericsoftware/spine-core@4.3.0` / `spine-player@4.3.0` tarballs (HIGH confidence) and falsified SEED-006's beta inventory: 4.3.0 is a Pose-architecture rewrite, not "5 renames + 2 signatures". These requirements use the CORRECTED facts in `.planning/research/SUMMARY.md` (+ STACK/FEATURES/ARCHITECTURE/PITFALLS). The verified mapping tables there are the spec — not SEED-006.

**Locked design facts (do not relitigate — see PROJECT.md `## Current Milestone`):**
1. Dual-runtime (4.2.111 + 4.3.0 side-by-side, routed by detected version) — NOT single-runtime replacement.
2. 4.2 support retained + byte-equal regression-gated.
3. Alias direction is load-bearing: **4.3.0 canonical**, 4.2.111 aliased (`spine-core-42`) — naive direction silently corrupts spine-player.
4. `core/` stays pure-TS (Layer-3 invariant, `tests/arch.spec.ts`).
5. PORT-04 (vendoring) = a `package.json` npm alias (4.3.0 published; no submodule/fork).

---

## v1.6 Requirements

Active scope for this milestone. Each maps to exactly one phase.

### Runtime Dual-Install & Boundary (RT)

- [x] **RT-01**: `@esotericsoftware/spine-core@4.3.0` is the canonical install and `4.2.111` is installed side-by-side via an exact-pinned, lockfile-committed npm alias; both resolve identically under `tsc`, Vite (renderer + main), `worker_threads`, and `vitest` from a fresh clone.
- [x] **RT-02**: A `SpineRuntime` adapter interface in `core/runtime/` has two implementations (`runtime-42`, `runtime-43`); `core/sampler.ts` and `core/bounds.ts` no longer import `@esotericsoftware/spine-core` directly (enforced by a `tests/arch.spec.ts` anchor).
- [x] **RT-03**: Runtime objects cross the adapter boundary as opaque branded handles carrying an explicit runtime tag; a 4.2 object reaching a 4.3 adapter (or vice-versa) is a compile-time error, not a runtime corruption.
- [x] **RT-04**: The `core/runtime/` module imports no DOM, Electron, or `sharp` — the Layer-3 purity invariant is preserved and arch-spec-enforced after the port.

### 4.2 Regression Safety (SAFE)

- [x] **SAFE-01**: A byte-equal golden snapshot of `globalPeaks` / `SamplerOutput` for every in-repo 4.2 fixture is captured and committed **before** the npm alias is added (order is load-bearing — behavior cannot be baselined after it changes).
- [x] **SAFE-02**: Every in-repo 4.2 fixture sampled through the new adapter produces output byte-identical to the pre-v1.6 baseline (strict equality, not epsilon — the 4.2 runtime is unchanged, so any drift is a plumbing bug).
- [x] **SAFE-03**: A regression test proves the cross-runtime `instanceof` invariant — each loaded skeleton's attachments resolve `instanceof` (Region / Vertex / Mesh) against the same runtime instance that loaded it.

### Spine 4.3 API Port (PORT — corrected; supersedes SEED-006 beta inventory)

- [x] **PORT-01**: `core/sampler.ts` correctly samples a 4.3 skeleton via the 4.3 adapter using the verified-stable API (`setupPose`/`setupPoseSlots`/`setupPoseBones`, overloaded `setAnimation`, `slot.pose.attachment`, `slot.pose.color`, `AnimationState` `setTrack`/`getTrack`), reading the post-constraint `appliedPose` for all world-transform-relevant state.
- [x] **PORT-02**: `core/bounds.ts` computes world vertices for 4.3 `RegionAttachment` (`vertexOffsets` as the 2nd arg via `getOffsets(slot.pose)`) and `VertexAttachment` (`skeleton` as the 1st arg), and reads bone world scale via `bone.appliedPose.getWorldScaleX/Y()`.
- [x] **PORT-03**: The v1.4 Phase 33 rotated-atlas offset mechanism is re-expressed for 4.3 (stable 4.3 `RegionAttachment` has no mutable `offset[]`); the 4.2 rotated-atlas path is unchanged and regression-locked.

### Version Dispatch (DISP)

- [x] **DISP-01**: The loader detects the skeleton version and routes 4.2 JSON → 4.2 runtime and 4.3 JSON → 4.3 runtime; the existing `checkSpine43Schema` predicate is repurposed from a rejecter into a routing signal.
- [x] **DISP-02**: Genuinely unsupported versions still reject with the existing typed-error envelope — the `< 4.2` guard is preserved and a NEW `≥ 4.4` guard arm is added (future-proofing).
- [x] **DISP-03**: A 4.2 JSON is never silently loaded by the 4.3 runtime (which would yield zero constraints with no error); routing is decided by detected version *before* runtime load.

### Correctness Oracle & 4.3 Fixtures (ORCL)

- [x] **ORCL-01**: An owner-exported SIMPLE_TEST-equivalent rig, exported from a Spine 4.3 editor as **both** "Version 4.3" and "Version 4.2", is committed in-repo (redistributable).
- [x] **ORCL-02**: A same-rig cross-runtime equivalence test asserts the 4.3-runtime and 4.2-runtime `globalPeaks` agree within 1e-4 on the ORCL-01 rig.
- [x] **ORCL-03**: spine-editor#891 (4.3→4.2 downgrade IK-scramble) status is human-verified before the dual-version reference is trusted; if unresolved, the oracle degrades to a non-IK reference rig that still exercises the `appliedPose` constraint canary.

### Slider Constraint Validation (SLIDER — PORT-03 reshaped: fixture-only, no sampler code)

- [x] **SLIDER-01**: A minimal slider rig (a slider drives one bone's X over a known time window) is committed in-repo from a 4.3 editor export.
- [x] **SLIDER-02**: A closed-form test asserts the sampled peak for the slider rig equals the independently-derived analytical value, confirming slider effect propagates via the existing `updateWorldTransform(Physics.update)` path with no slider-specific sampler code.

### Optional 4.3-Only Confidence Fixtures (XTRA — user opted in to both, 2026-05-16)

- [x] **XTRA-01**: A 4.3 transform-constraint multi-map fixture (one source property → multiple target properties of different types, local↔world with clamp) samples correctly through the adapter.
- [x] **XTRA-02**: A 4.3 IK `scaleYMode` fixture exercising Uniform and Volume samples correctly; default `None` is confirmed 4.2-equivalent (no regression).

### User-Facing Surface (UX)

- [x] **UX-01**: For a 4.3 file, the drop-zone copy and loader error no longer instruct the user to "re-export as Version 4.2"; 4.3 is presented as supported.
- [x] **UX-02**: Every stale "Spine v4.2 only" / "re-export as 4.2" surface is swept (App.tsx drop-zone, loader/error strings, Documentation Builder HTML, README/INSTALL/Help) and the 6 reject-assertion test files are inverted to assert routing while preserving the `< 4.2` and `≥ 4.4` throw cases.

### spine-player Viewer Bump (PLAYER)

- [ ] **PLAYER-01**: `@esotericsoftware/spine-player` is bumped 4.2.111 → 4.3.0; the removed `MixBlend` / `MixDirection` imports are dropped from `AnimationPlayerModal.tsx` and migrated to the new apply model.
- [ ] **PLAYER-02**: The v1.5.1 viewer renders both a 4.2 and a 4.3 fixture correctly through the 4.3 player, GL straight-alpha is re-verified, and the 5 carried Phase 41 HUMAN-UATs are re-run on the 4.3 player.

### Continuous Integration (CI)

- [x] **CI-01**: The CI matrix runs the full test suite against both 4.2.x and 4.3.x fixtures from a fresh clone; the npm alias resolves reproducibly and electron-builder packages both spine-core copies.

### Performance (PERF)

- [x] **PERF-01**: 4.3 sampler wall-time is measured on a complex 4.3 rig against the N2.2 606 ms contract and a 4.3-specific regression budget is recorded (4.3's three-pose model is heavier per tick — parity is not assumed).

---

## Future Requirements

Tracked but not in the v1.6 roadmap. May ship in v1.7+.

### 4.2 Lifecycle

- **DEPRECATE-01**: Decision + path for eventually deprecating the 4.2 runtime (kept dual in v1.6; revisit once dual-runtime maturity + 4.2-rig usage data exist).

### Carry-Forward From Prior Milestones (not v1.6 scope — tracked)

- **POLISH-WR-03/04/05/07** + **POLISH-IN-01/02/03/04**: 8 Phase 40 polish items deferred at v1.5 close (`40-REVIEW.md`).
- **VIEWER-07**: Split-pane source-vs-exported comparison (deferred at v1.5.1; conditional on SEED-009 D-02).
- **Phase 41 HUMAN-UAT (5 open)**: anim/skin switch + scrub synchrony, GL leak cycles, real-fs error UX, atlas-less parity, File-menu suppression — re-checked on the 4.3 player in PLAYER-02 but full sign-off remains a visual/host UAT carry-forward.

---

## Out of Scope

Explicitly excluded. Documented to prevent scope creep. Anti-features below are flagged with the research trap they avoid.

| Feature | Reason |
|---------|--------|
| 4.3 → 4.2 schema shim / format translation | SEED-003 Option B — HIGH trap risk (brittle vs beta drift, can't model `slider`). v1.6 **routes by version, does not translate**. |
| Single-runtime replacement of 4.2 | Explicitly rejected 2026-05-16 — dual-runtime is locked; the 4.3 runtime silently mis-loads 4.2 JSON (zero constraints, no error). |
| Rendering 4.3 skeletons inside `core/` | `core/` is pure math (Layer-3 invariant); rendering is the spine-player viewer's job. |
| Authoring / writing 4.3 JSON | App is read-only analysis — never mutates skeleton JSON (source-confirmed invariant since v1.0). |
| `.skel` binary loader (4.2 or 4.3) | Carried out of scope since v1.0; JSON-only. |
| Slider as a user-facing UI control | Slider is sampled for peak-scale only, not exposed as an animator control. |
| Combined-skin compositing | Per-individual-skin sampling only (constraint unchanged since v1.0). |

---

## Traceability

Which phases cover which requirements. Populated by gsd-roadmapper.

| Requirement | Phase | Status |
|-------------|-------|--------|
| RT-01 | Phase 42 | Complete |
| RT-02 | Phase 43 | Complete |
| RT-03 | Phase 42 | Complete |
| RT-04 | Phase 42 | Complete |
| SAFE-01 | Phase 42 | Complete |
| SAFE-02 | Phase 43 | Complete |
| SAFE-03 | Phase 43 | Complete |
| PORT-01 | Phase 43 | Complete |
| PORT-02 | Phase 43 | Complete |
| PORT-03 | Phase 43 | Complete |
| DISP-01 | Phase 44 | Complete |
| DISP-02 | Phase 44 | Complete |
| DISP-03 | Phase 44 | Complete |
| ORCL-01 | Phase 44 | Complete |
| ORCL-02 | Phase 44 | Complete |
| ORCL-03 | Phase 44 | Complete |
| SLIDER-01 | Phase 46 | Complete |
| SLIDER-02 | Phase 46 | Complete |
| XTRA-01 | Phase 44 | Complete |
| XTRA-02 | Phase 44 | Complete |
| UX-01 | Phase 45 | Complete |
| UX-02 | Phase 45 | Complete |
| PLAYER-01 | Phase 47 | Pending |
| PLAYER-02 | Phase 47 | Pending |
| CI-01 | Phase 42 | Complete |
| PERF-01 | Phase 46 | Complete |

**Coverage:**
- v1.6 requirements: 26 total
- Mapped to phases: 26 ✓
- Unmapped: 0 ✓

**Per-phase distribution:**

| Phase | Requirements | Count |
|-------|--------------|-------|
| Phase 42 — Pre-v1.6 Baseline + Alias + Scaffolding | SAFE-01, RT-01, RT-03, RT-04, CI-01 | 5 |
| Phase 43 — Runtime-Adapter Facade + 4.3 API Mapping | RT-02, SAFE-02, SAFE-03, PORT-01, PORT-02, PORT-03 | 6 |
| Phase 44 — Loader Dispatch + Equivalence Oracle + 4.3 Fixtures | DISP-01, DISP-02, DISP-03, ORCL-01, ORCL-02, ORCL-03, XTRA-01, XTRA-02 | 8 |
| Phase 45 — Dispatcher Flip + Copy/Docs Sweep | UX-01, UX-02 | 2 |
| Phase 46 — Slider Validation + 4.3 Perf Budget | SLIDER-01, SLIDER-02, PERF-01 | 3 |
| Phase 47 — spine-player 4.3.0 Bump + Viewer Regression | PLAYER-01, PLAYER-02 | 2 |

---
*Requirements defined: 2026-05-16 — after research synthesis (`.planning/research/SUMMARY.md`, HIGH confidence); SEED-006 beta inventory superseded by verified 4.3.0-stable facts.*
*Last updated: 2026-05-16 — traceability populated by gsd-roadmapper; 26/26 mapped, 0 unmapped. Phases 42–47 per the research-verified 6-phase shape. Order-critical: SAFE-01 baseline commit predates RT-01 alias commit (both Phase 42, baseline-first).*
