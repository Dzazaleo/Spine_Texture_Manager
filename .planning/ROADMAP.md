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
- ✅ **v1.7 Multi-Scale Per-Resolution Variant Exporter** — Phases 48–53 (completed 2026-05-25; tagged `v1.7` locally, not pushed) — archive at [milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md)

## Active Milestone

None. v1.7 is complete + closed (2026-05-25). Start the next milestone with `/gsd-new-milestone` (questioning → research → requirements → roadmap). Candidate v1.8 scope is sketched in `PROJECT.md` → "Next Milestone".

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Phase numbering is continuous across milestones (no `--reset-phase-numbers`). The next milestone continues from **Phase 54**. Prior phase directories preserved at `.planning/phases/`.

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

<details>
<summary>✅ v1.7 Multi-Scale Per-Resolution Variant Exporter (Phases 48–53) — COMPLETE 2026-05-25</summary>

- [x] Phase 48: Core Scale-Bake Module + Regression Oracle (4/4 plans) — completed 2026-05-22
- [x] Phase 49: Single-Scale Variant Export (3/3 plans) — completed 2026-05-22
- [x] Phase 50: Rig-Bounds + Two-Way Scale↔Dimension Input (2/2 plans) — completed 2026-05-23
- [x] Phase 51: Batch Variant Export (2/2 plans) — completed 2026-05-23
- [x] Phase 52: Batch Export Robustness + Variant-Dialog Cleanup (4/4 plans) — completed 2026-05-24
- [x] Phase 53: Persist Variant State in .stmproj (2/2 plans) — completed 2026-05-24

13/13 requirements (BAKE/EXPORT/SCALEUI) satisfied; security verified for all 6 phases. See [milestones/v1.7-ROADMAP.md](milestones/v1.7-ROADMAP.md) for full phase details and the milestone summary.

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 48. Core Scale-Bake Module + Regression Oracle | v1.7 | 4/4 | Complete | 2026-05-22 |
| 49. Single-Scale Variant Export | v1.7 | 3/3 | Complete | 2026-05-22 |
| 50. Rig-Bounds + Two-Way Scale↔Dimension Input | v1.7 | 2/2 | Complete | 2026-05-23 |
| 51. Batch Variant Export | v1.7 | 2/2 | Complete | 2026-05-23 |
| 52. Batch Export Robustness + Variant-Dialog Cleanup | v1.7 | 4/4 | Complete | 2026-05-24 |
| 53. Persist Variant State in .stmproj | v1.7 | 2/2 | Complete | 2026-05-24 |
| 54. Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) | — (standalone bugfix) | 1/1 | Complete   | 2026-05-25 |

_Earlier milestones (Phases 0–47) are archived — see the collapsed sections above and `.planning/milestones/`._

### Phase 54: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix)

**Type:** Standalone bugfix phase (v1.7 closed; no active milestone — continues phase numbering at 54).

**Goal:** Eliminate the false-positive green "savings" readout shown for **reopened exported variants**, without degrading variant texture quality and without breaking the v1.7-LOCKED scale-bake / export-plan contract. **Read-model / DISPLAY fix only** — it changes how Peak and the savings figure are computed FOR DISPLAY and how the green tint decides; it changes NO exported bytes and does NOT touch the v1.7-locked scale-bake or export sizing math.

**Problem (diagnosed):** A reopened variant's geometry JSON is sized **source-based** (`width`/`height` × s in `src/core/scale-bake.ts`) while its texture PNGs are sized **peak-based** (`ceil(canonicalW × s·peakScale)` in `src/core/export.ts`). For art drawn smaller than it renders (`peakScale > 1`, e.g. GRAND, L_SKIRT), the two disagree, so on reopen `computeExportDims` (`src/renderer/src/lib/export-view.ts`) + `rowState` (`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`) compute Peak < Source and tint the cell green (e.g. 0.846×, 0.877×), falsely implying recoverable savings. The premature `≤ 1.0` clamp in the *display* path is the root cause (it discards the `peakScale > 1` signal). Counts: ARMAN @0.5x = 57 false rows; 42 @0.1x = 22. Full root-cause + reproduction: [.planning/debug/variant-peaks-differ-green.md](debug/variant-peaks-differ-green.md) (status: resolved/diagnose-only).

**⚠ Constraint:** Do NOT "fix" by re-optimizing variants — that shrinks PNGs below true render demand → blurry in-engine. Current variant PNGs are correct; only the reopened *display* is wrong.

**Locked fix direction (from `54-CONTEXT.md` + `54-RESEARCH.md`):**
- **D-01 (Option B, read-model):** display Peak demand + savings derived from TRUE world render demand `min(canonical × peakScale, actualSource)` (drop the display path's premature `≤ 1.0` clamp; keep `safeScale`). Export-side `≤ 1.0` clamp + bake stay frozen. Option A (reconcile bake) and Option C (re-optimize guard) rejected.
- **D-02 (Universal):** applies to all rigs (master + variant, atlas-source + atlas-less, 4.2 + 4.3); no "is this a variant" detection.
- **D-03 (Tint matches displayed integers):** green only when the displayed integer Peak dim is strictly smaller than the displayed integer Source dim; pure integer compare, no epsilon.

**Requirements:** TBD (no formal v1.7 REQ — bugfix scoped from debug session; traceability anchored to D-01/D-02/D-03).
**Depends on:** — (standalone; builds on the v1.7 variant/bake/export code from Phases 48–53).
**UI:** `--skip-ui` (read-model/display + renderer lib; no new UI surface).
**Plans:** 1/1 plans complete

Plans:
- [x] 54-01-PLAN.md — read-model peak-demand fix: add `peakDemandW/H` to `computeExportDims` (D-01), rewrite `rowState` to compare the rendered integers (D-03, extracted to `lib/row-state.ts`), rebase `savingsPctMemo` onto per-row demand (chip ≡ rows), tooltip/docblock copy sweep; export bytes frozen, Layer-3 pure (D-02 universal). Single wave, 3 tasks (Wave-0 test + helper, demand math, panel/chip wiring).
