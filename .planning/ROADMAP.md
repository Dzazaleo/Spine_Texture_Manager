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
- ✅ **v1.6 Spine 4.3 Runtime Port (Dual-Runtime)** — Phases 42–47 (shipped as v1.6.1 2026-05-19) — archive at [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md)
- 🟢 **v1.7 Multi-Scale Per-Resolution Variant Exporter** — Phases 48–51 (in progress, started 2026-05-22)

## Overview

v1.7 turns one full-size Spine export into a fan-out of faithful, genuinely-smaller rig variants — each a complete drop-in package (scaled skeleton JSON + scaled atlas + resized textures, in its own folder) sized to the peak render demand of *that* smaller rig. The risky core is already de-risked: spikes 001–003 (all VALIDATED) prove a JSON→JSON transform mirroring spine-core `SkeletonJson.scale` is **field-identical** to Spine's own scaling on 4.2 + 4.3 (including DEMON's worst 4.3 constraints), and that the baked variant is geometrically `s×` for every attachment including constraint-driven `R_ARM`. The journey is four dependency-ordered phases. Phase 48 promotes the spike `baker.mjs` into a Layer-3-pure `core/` bake module, finishes the finite remaining work (constraint-timeline curve channels: IK softness curve, PATH position/spacing length-mode), and wires the decisive sampling-free oracle — `parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)` — as a CI test across a fixture matrix that **includes a deform-heavy rig** (DEMON 4.3 has no deform → false confidence). Phase 49 ships the first end-user value: a single scale → one folder, reusing the existing export-sizing + atlas-writer pipeline with `variant_peak = s × master_peak` (the bake is a proven true similarity — never re-sample a variant). Phase 50 adds the setup-pose rig-bounds reference and the two-way scale↔dimension input. Phase 51 fans it out to batch (N scales → N folders). Two hard threads run through every phase: dual-runtime (4.2 + 4.3) and both loader modes (atlas-source + atlas-less), and `core/` stays pure-TS (Layer-3, `tests/arch.spec.ts`). This is the first feature to ever make the app **write** a skeleton JSON; the source JSON is never modified.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

v1.7 continues phase numbering from v1.6 (no `--reset-phase-numbers`). v1.6 ended at Phase 47; v1.7 starts at **Phase 48**. Prior phase directories preserved at `.planning/phases/`.

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

See [milestones/v1.5-ROADMAP.md](milestones/v1.5-ROADMAP.md) for full phase details.

</details>

<details>
<summary>✅ v1.5.1 Spine Animation Viewer (Phase 41) — functionally COMPLETE 2026-05-15</summary>

- [x] Phase 41: Spine Animation Viewer (3/3 plans) — completed 2026-05-15

</details>

<details>
<summary>✅ v1.6 Spine 4.3 Runtime Port — Dual-Runtime (Phases 42–47) — SHIPPED as v1.6.1 2026-05-19</summary>

- [x] Phase 42: Pre-v1.6 4.2 Baseline + npm Alias + Boundary Scaffolding (5/5 plans) — completed 2026-05-16
- [x] Phase 43: Runtime-Adapter Facade + Verified 4.3 API Mapping (6/6 plans) — completed 2026-05-17
- [x] Phase 44: Loader Dispatch + Equivalence Oracle + 4.3 Fixture Authoring (4/4 plans) — completed 2026-05-18
- [x] Phase 45: Dispatcher User-Facing Flip + Copy/Docs Sweep (2/2 plans) — completed 2026-05-18
- [x] Phase 46: Slider Constraint Validation + 4.3 Performance Budget (2/2 plans) — completed 2026-05-18
- [x] Phase 47: spine-player 4.3.0 Bump + Viewer Regression (4/4 plans) — completed 2026-05-19

See [milestones/v1.6-ROADMAP.md](milestones/v1.6-ROADMAP.md) for full phase details.

</details>

### 🟢 v1.7 Multi-Scale Per-Resolution Variant Exporter (Phases 48–51)

**Milestone Goal:** From one full-size Spine export, produce faithful scaled-down rig variants — each a complete drop-in package (scaled skeleton JSON + scaled atlas + resized textures, in its own folder) sized to the peak render demand of that smaller rig, dual-runtime (4.2 + 4.3) and dual-mode (atlas-source + atlas-less).

- [x] **Phase 48: Core Scale-Bake Module + Regression Oracle** - Promote the spike `baker.mjs` to a Layer-3-pure `core/` JSON→JSON bake mirroring `SkeletonJson.scale`; finish the constraint-timeline curve channels; wire the field-identity oracle as a CI test across a fixture matrix incl. a deform-heavy rig (completed 2026-05-22)
- [x] **Phase 49: Single-Scale Variant Export** - One scale → one folder (scaled JSON + resized textures + scaled atlas), `variant_peak = s × master_peak`, respecting `loose | atlas | both`; dual-runtime + dual-mode; source JSON never modified (completed 2026-05-22)
- [x] **Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input** - Setup-pose bounding box reference (W×H px) + factor↔target-px two-way input binding (frontend / UI phase) (completed 2026-05-22)
- [ ] **Phase 51: Batch Variant Export** - N scales → N folders in one run + folder-naming UX, reusing the single-scale export per scale

## Phase Details

### Phase 48: Core Scale-Bake Module + Regression Oracle
**Goal**: Produce the one substantial new piece — a Layer-3-pure `core/` JSON→JSON bake that mirrors spine-core `SkeletonJson.scale` field-for-field across both schemas, proven by the decisive sampling-free oracle wired into CI. This is the foundation every export phase depends on.
**Depends on**: Nothing (first v1.7 phase). Inputs are spikes 001–003 (VALIDATED), the spike `baker.mjs` prototype, and the MANIFEST field-rule table — use those artifacts, not re-derivation.
**Requirements**: BAKE-01, BAKE-02, BAKE-03, BAKE-04
**Success Criteria** (what must be TRUE):
  1. The bake module produces a scaled skeleton JSON whose parsed `SkeletonData` is **field-identical** (strict equality, excluding parse-assigned `id`/`hash`) to the original parsed at Spine's own `SkeletonJson.scale = s` — verified by the round-trip oracle `parse(bake(orig,s),1)` ≡ `parse(orig, SkeletonJson.scale=s)` running as a CI test. *(BAKE-01)*
  2. The oracle passes on a fixture matrix that covers both schemas (4.2 split `transform/ik/path/physics[]` and 4.3 unified `constraints[]`), **includes a deform-heavy 4.2 rig** (e.g. `fixtures/MON_FILES/EXPORT/TEST_01/4.2` or `fixtures/3Queens` — DEMON 4.3 has zero deform and gives false confidence alone), and includes at least one all-constraint-types rig per runtime. *(BAKE-02, BAKE-04)*
  3. The bake correctly handles every constraint construct including the finite remaining constraint-timeline curve channels — IK `softness` timeline curve (`cy` scaled, paired `mix` channel left unscaled) and PATH `position`/`spacing` timelines in length mode — plus the scaled-default injections (`physics.limit` → 5000×s, `referenceScale` → 100×s when absent; physics `x`/`y` are NOT length-scaled). *(BAKE-03)*
  4. The bake module imports no DOM, Electron, or `sharp` and is green under `tests/arch.spec.ts` (Layer-3 purity); the source JSON is never mutated (the bake is a pure transform returning new JSON). *(BAKE-04)*
**Plans**: 4 plans (3 waves)

Plans:
**Wave 1**
- [x] 48-01-PLAN.md — promote `baker.mjs` → `src/core/scale-bake.ts` (dual-schema setup-side: bones/constraints/attachments + scaled-default injection) + D-09 degenerate-`s` guard + D-10 assert-known guard [wave 1, BAKE-01/02/04]
- [x] 48-02-PLAN.md — fixture-commit-safety (D-06a, explicit task: COPY DEMON+TEST_01+TEST_03 json+atlas-only into new non-ignored dirs, prove tracked) + author the synthetic 4.3 path-Fixed fixture (D-05) [wave 1, BAKE-04]

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 48-03-PLAN.md — finish the 3 constraint-timeline curve channels: slider remap slope + PATH position/spacing length-mode (setup+timeline) + IK softness-curve cy (channel-specific) [wave 2, depends 48-01, BAKE-03]

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 48-04-PLAN.md — wire the field-identity oracle `tests/scale-bake.spec.ts` across the matrix (hard-fail-on-missing, no skipIf) + optional arch-spec Layer-3 anchor + full-suite green [wave 3, depends 48-02+48-03, BAKE-01/02/03/04]

### Phase 49: Single-Scale Variant Export
**Goal**: Deliver the first end-user value — export one scaled-down variant to a chosen folder as a complete, drop-in package, reusing the existing export-sizing + atlas-writer pipeline and sizing textures arithmetically (`variant_peak = s × master_peak`, never by re-sampling the variant).
**Depends on**: Phase 48 (the variant package's always-present new artifact is the baked scaled JSON; export depends on the bake).
**Requirements**: EXPORT-01, EXPORT-02, EXPORT-03, EXPORT-05
**Success Criteria** (what must be TRUE):
  1. The user can export a single scaled-down variant at a chosen scale to a chosen folder as a drop-in package — baked scaled JSON + resized textures + (per output mode) scaled atlas — usable as-is at that smaller size. *(EXPORT-01)*
  2. Variant texture sizes are derived as `s × master_peak` (each variant sized to its own smaller render demand) by reusing the existing `buildExportPlan` + image-worker + atlas-writer pipeline; the source project is never modified. *(EXPORT-02)*
  3. Variant export respects the existing output mode (`loose | atlas | both`): the scaled JSON is the one always-present new artifact, and textures/atlas follow the chosen mode. *(EXPORT-03)*
  4. Variant export works for both atlas-source and atlas-less projects, and for both Spine 4.2 and 4.3 rigs (the baked variant behaves identically to the master at the smaller size — faithfulness bar). *(EXPORT-05)*
**Plans**: 3 plans (2 waves)
**Note**: Output-folder naming locked at discuss (D-01/D-02 — `{PARENT}/{NAME}@{s}x/` with clean inner basenames). Per-attachment override sharing across scales is deferred (Future Requirements, L-05) — single-scale lands first.

Plans:
**Wave 1**
- [x] 49-01-PLAN.md — variant ENGINE + IPC: pure `scaleSummaryPeaks` (peak-only A1) + `VariantScaleError` (D-08) + first-ever atomic skeleton-JSON writer (L-03) + `handleExportVariant` (bake → `{NAME}@{s}x/` → write-JSON-first → `buildExportPlan` UNCHANGED → dispatch under one rollback Set) + `variant:export` channel + preload binding; Wave-0 tests V1 sizing / V2 source-immutable / V5 guard [wave 1, EXPORT-01/02/03/05]

**Wave 2** *(both depend on 49-01; disjoint files → parallel)*
- [x] 49-02-PLAN.md — renderer: NEW "Export Variant…" toolbar action (D-04) + single-pane tab-ready `VariantDialog` reusing Optimize config controls + a basic numeric scale field (D-05/D-06) inheriting the full active config (D-07); invokes `window.api.exportVariant` [wave 2, depends 49-01, EXPORT-01/03]
- [x] 49-03-PLAN.md — package + faithfulness + matrix: per-mode drop-in layout + clean `{NAME}` basenames + JSON-in-all-modes + oversize-forced rollback (V3/V4), drop-in faithfulness oracle (geometry + cross-resolve + `s×` world-AABB, V6), dual-runtime × dual-mode matrix (V7), Layer-3 arch anchor (V8); reuses committed fixtures, NO new fixture dir [wave 2, depends 49-01, EXPORT-01/03/05]

### Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input
**Goal**: Give the animator an intuitive way to choose a scale — anchor it to the rig's overall setup-pose bounding box and let them enter either a factor or a target pixel dimension and see the other.
**Depends on**: Phase 49 (the scale value drives the single-scale export; the input UI is the front door to that path).
**Requirements**: SCALEUI-01, SCALEUI-02
**Success Criteria** (what must be TRUE):
  1. The user can specify a variant scale either as a factor (e.g. `0.5`) or as a target dimension in pixels; entering one displays the corresponding other value (two-way binding). *(SCALEUI-01)*
  2. The dimension reference shown to the user is the rig's overall **setup-pose bounding box** (width × height in px), computed for both 4.2 and 4.3 rigs. *(SCALEUI-02)*
**Plans**: 2 plans (2 waves)
**UI hint**: yes
**Note**: The two-way-input UX (both-W&H-editable aspect-locked, honor-typed-pixels exactly, enrich-inline / defer tabs to Phase 51) was RESOLVED at discuss — see `50-CONTEXT.md` D-01..D-09. Planned `--skip-ui` (in-place enrichment of the existing `VariantDialog`; no UI-SPEC).

Plans:
**Wave 1**
- [x] 50-01-PLAN.md — `computeSetupPoseBounds` (Layer-3-pure, dual-runtime all-skins setup-pose AABB union, D-05/D-06/D-07) + degenerate `null` guard + additive `SkeletonSummary.bbox` seam in summary.ts/types.ts + V1-V7 [wave 1, SCALEUI-02]

**Wave 2** *(depends on 50-01 — reads `summary.bbox`)*
- [x] 50-02-PLAN.md — enrich the `VariantDialog` Scale card IN PLACE (D-09): bbox W×H reference line + three coupled aspect-locked inputs (factor/W/H, uniform, D-01/D-02/D-03) + over-range allow-but-disable-Export (D-04) + pure `pxFromScale`/`scaleFromPx`/`displayFactor` helpers + V8-V12 [wave 2, depends 50-01, SCALEUI-01]

### Phase 51: Batch Variant Export
**Goal**: Fan one master out to many resolutions in a single operation — N scales → N folders — reusing the single-scale export per scale.
**Depends on**: Phase 49 (batch is N iterations of the proven single-scale export) and Phase 50 (each batch entry is a scale chosen via the same input model).
**Requirements**: EXPORT-04
**Success Criteria** (what must be TRUE):
  1. The user can export multiple scales in one batch run, each variant written to its own folder. *(EXPORT-04)*
  2. Each variant in the batch is a complete drop-in package identical to what the single-scale path would produce for that scale, respecting the chosen output mode and working across dual-runtime + dual-mode. *(EXPORT-04)*
**Plans**: 2 plans
**Note**: Folder naming `{PARENT}/{NAME}@{s}x/` is LOCKED (L-05 / 49-D-01) — it was designed as the no-collision batch fan-out, so the planned 51-02 is the multi-row dialog + per-folder results/progress UI (NOT folder-naming work). Single + batch unify in the ONE Export Variant dialog (1 row = single, 2+ = batch, D-04); single pane, NO tabs (D-06 overturns the 49-D-06/50-D-09 tabs-at-51 expectation).

Plans:
**Wave 1**
- [ ] 51-01-PLAN.md — main-side batch engine: extract `exportOneVariant` (behavior-preserving) + `handleExportVariantBatch` loop (continue-on-error D-07, between-variants cancel D-09) + `BatchVariantResult` type + `variant:exportBatch`/`variant:cancelBatch` channels + the byte-identity/rollback/cancel proof over the 4.2/4.3 × atlas-source/atlas-less matrix [EXPORT-04 SC#1/SC#2, L-03/L-04]

**Wave 2** *(depends on 51-01 — consumes the `variant:exportBatch` IPC shape + `BatchVariantResult`)*
- [ ] 51-02-PLAN.md — renderer multi-row `VariantDialog`: `tokenFor` helper + rows[] list (per-row two-way control, add/remove, dedup gate D-10, invalid gate D-11) + one `exportVariantBatch` call (D-04) + per-folder result list + aggregate (D-08) + batch-progress prefix + Cancel (D-09) + AppShell `variantRows` wiring (reuse `onConfirmStartVariant` D-12, `activeOverrides` D-13) [EXPORT-04 SC#1 UI half]

## Progress

**Execution Order:**
Phases execute in numeric order: 48 → 49 → 50 → 51

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 48. Core Scale-Bake Module + Regression Oracle | v1.7 | 4/4 | Complete    | 2026-05-22 |
| 49. Single-Scale Variant Export | v1.7 | 3/3 | Complete    | 2026-05-22 |
| 50. Rig-Bounds + Two-Way Scale↔Dimension Input | v1.7 | 2/2 | Complete    | 2026-05-23 |
| 51. Batch Variant Export | v1.7 | 0/2 | Not started | - |
