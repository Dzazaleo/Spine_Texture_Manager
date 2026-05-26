# Phase 55: Variant Export Sizes to Peak Demand (Up to No-Upscale Ceiling) - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Lift the variant-export `effScale` clamp in [src/core/export.ts:279](src/core/export.ts#L279) from `min(safeScale(peak × (1+buffer)), 1, sourceRatio)` to `min(safeScale(peak × (1+buffer)), 1/s, sourceRatio)` so a variant at scale `s` can size outputs UP TO the **master-source ceiling** — actually satisfying the rig's peak demand at the variant resolution when there is headroom — while still honoring the locked "no upscale relative to the master source PNG" contract. The change is **universal** (no `if variant` branch); for masters `s = 1` so `1/s = 1` and the formula is mathematically equivalent → **master export stays byte-identical by construction**.

**In scope:**
- The `effScale` clamp in `src/core/export.ts` (the surgical lift site).
- Test updates: any test asserting variant output dims for rows where `master peakScale × (1+buffer) > 1` and `1/s` is not the binding clamp. The Phase 48 oracle (`tests/scale-bake.spec.ts`) and the master-side `tests/core/export.spec.ts` rows must stay byte-identical.
- Researcher must verify the `1/s` × `sourceRatio` interaction in the pre-optimized-master case (master `actualSource < canonical`).

**Out of scope (DO NOT build here):**
- No new UI surface (Phase ships `--skip-ui`).
- No "is this a variant" detection / runtime flag / IPC marker — implementation derives from `s ≠ 1` arithmetic, not an explicit branch (L-02 below).
- No migration / one-shot reconciliation tool for already-exported variant folders — accept the churn; existing folders keep their old (smaller) PNGs and the icon will still fire on their reopen until the user re-exports (D-D below).
- No edits to the Phase 54 read-model display path (`computeExportDims`, `peakDemandW/H`, `rowState`, `extrapolationTooltip`, `savingsPctMemo`). Phase 55 is a complement, not a revision.
- No bake/`scale-bake.ts` changes — Option A scoped to the bake stays rejected (Phase 54 D-01). This is the narrower export-only formulation that lifts ONLY the export's `effScale` clamp.

</domain>

<decisions>
## Implementation Decisions

### Clamp Lift (the core change)
- **D-A (Universal `1/s` clamp):** Replace the literal `1` in `Math.min(safeScale(bufferedScale), 1)` at [src/core/export.ts:279](src/core/export.ts#L279) with `1/s` unconditionally — no `if variant` branch. For masters `s = 1` so `1/s = 1` and the formula is mathematically equivalent → byte-identical master export by construction (no `Phase 48 oracle` regression). For variants `s < 1` so `1/s > 1`, giving headroom to size outputs up to the master-source ceiling. The seam needs `s` to reach `buildExportPlan`; the cleanest threading is via a new `BuildExportPlanOptions.variantScale?: number` (defaults to 1.0 / master); `src/main/variant-export.ts` passes `s` when calling `buildExportPlan(scaleSummaryPeaks(summary, s), …)`. Rejected: gated `if (s !== 1) …` branch (reads as variant detection, borderline on L-02 below, mathematically identical to the universal form).

### Reach & Variant Detection
- **L-02 (Phase 54 D-02) carries forward:** No "is this a variant" detection. `s` is a *pure-math* input to the clamp formula, not a categorical flag. The universal `1/s` form respects this — there is one formula, one math contract, and masters get the same answer they always got because `1/s = 1` when `s = 1`.

### Backward Compatibility
- **D-D (Accept the churn — re-export to fix; no migration tool):** Already-exported variant folders (from pre-Phase-55 exports) will keep their old PNGs and may still trip the ExtrapolationIcon on reopen. The user can re-run Export Variant to get the new sizing. Rejected: a one-shot reconciliation tool / `/gsd-reoptimize-variant` (out of scope for Phase 55; revisits Phase 54's "do NOT re-optimize variants" stance; adds new IPC + UI surface). Deferred-but-noted: a reconciliation tool *may* be revisited in a future phase if user demand surfaces; not committed here.

### ExtrapolationIcon Tooltip
- **D-F (Keep Phase 54 wording unchanged):** `extrapolationTooltip()` in [src/renderer/src/lib/row-state.ts](src/renderer/src/lib/row-state.ts#L56-L68) stays as-is. Phase 55 reduces how often the icon fires on variants (variant resampled `peakScale ≤ 1` after Phase 55), but the `capped at source dims` branch remains useful for the rare master-with-pre-optimized-source case (`actualSource < canonical × peakScale`). The tooltip already reads correctly in both regimes; no UI/copy work in this phase.

### UI Scope
- **D-UI:** Ships `--skip-ui`. Pure export-math seam + test updates; no new dialog, toolbar, panel, or copy surface.

### Researcher / Planner Directives (codified — not user decisions)
- **D-B (Buffer ordering):** Buffer applies BEFORE the clamp (`raw → bufferedScale → safeScale → clamp`) — matches current code order in [src/core/export.ts:263-279](src/core/export.ts#L263-L279). Only the clamp's value changes (`1` → `1/s`). Math order locked verbatim from Phase 30 CONTEXT D-09 step 3.
- **D-C (sourceRatio + 1/s interaction in the `dimsMismatch` master case):** `sourceRatio = min(actualSourceW/canonicalW, actualSourceH/canonicalH)` already binds at the master's on-disk source dim ([src/core/export.ts:300-303](src/core/export.ts#L300-L303)). Researcher MUST verify that `min(safeScale(buffered), 1/s, sourceRatio)` stays correct when **both** `1/s` and `sourceRatio` could bind — specifically in the pre-optimized-master case where `actualSource < canonical` (so `sourceRatio < 1`) and a variant exports against it. The expected behavior: `sourceRatio` is the tighter ceiling and binds; `1/s` is harmless headroom. No regression to the NECK repack lineage / `compute_export_dims_canonical_base` invariant.
- **D-E (Master byte-identity verification):** Phase 48 oracle `tests/scale-bake.spec.ts` (`parse(bake(orig,s),1) ≡ parse(orig, SkeletonJson.scale=s)`) pins the bake. `tests/core/export.spec.ts` rows for `s = 1` (master) pin the export. Both MUST stay green unchanged. Planner must enumerate the existing tests that WILL need updating (any test asserting variant output dims for a row where `s × master_peakScale > 1` AND `1/s` was not the binding clamp) vs. the tests that stay byte-identical (every master-`s=1` row + every variant row where `master_peakScale ≤ 1`).

### Claude's Discretion
- **Threading `s` into `buildExportPlan`:** Whether to add `BuildExportPlanOptions.variantScale?: number` (default 1.0, master = omit), OR to compute the clamp at the call site and pass it in, OR to factor the clamp into a small pure helper that takes `s`. Prefer the path that keeps the test surface (~tests for `buildExportPlan(masterSummary, overrides, opts)`) intact and the call sites (`runExport`, variant-export, repack) minimally edited. Researcher to recommend; planner to pick.
- **Test fixture choice for the new variant-with-`peakScale>1` row coverage:** TEST_ARMAN (80×40 / 1.02×) is the named worked example, but committing TEST_ARMAN as a fixture is a separate decision (memory `feedback_new_committed_fixtures_need_safe01_denylist` applies if a new fixture dir is committed). Researcher may propose synthesizing a `DisplayRow`/`SkeletonSummary` test double instead of committing a new rig, to avoid the SAFE-01 denylist churn — same pattern Phase 54 used.
- **`computeExportDims` (renderer) parity:** [src/renderer/src/lib/export-view.ts](src/renderer/src/lib/export-view.ts) mirrors `buildExportPlan`'s math for the panel display. After Phase 55 changes the export math, the renderer-display path should remain on the Phase 54 read-model (true render demand, not export-clamped) — they SHOULD stay distinct here. Researcher to confirm no parity test breaks.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root-cause & origin (Phase 54 close-out UAT, 2026-05-26)
- `.planning/phases/54-variant-reopen-dimension-reconciliation-phantom-green-saving/54-CONTEXT.md` — Phase 54 D-01 (display-path fix), D-02 (universal, no variant detection — carried forward verbatim), D-03 (integer-match tint). Documents the explicit Option-A rejection rationale that Phase 55 now revisits scoped to the export's effScale formula only (NOT the bake).
- `.planning/debug/variant-peaks-differ-green.md` — the dim-base mismatch root cause; the GRAND/L_SKIRT walk-through; on-disk file evidence; the original three fix directions.
- `.planning/ROADMAP.md` § "Phase 55: Variant Export Sizes to Peak Demand" — the canonical phase entry with the worked TEST_ARMAN 80×40 / 1.02× example, the D-A..D-F list, and the locked constraints.

### The export-math seam this phase changes
- [src/core/export.ts](src/core/export.ts) — `buildExportPlan`. The lift site is line 279: `const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1);` → `Math.min(safeScale(bufferedScale), 1/s)`. The full pipeline is `raw → bufferedScale (≥263) → safeScale → clamp (279) → sourceRatio cap (304) → outW = ceil(canonicalW × effScale) (403)`. The no-upscale-from-source contract is documented at lines 120-128 (the master-source invariant) — `1/s` honors it as a master-source ceiling, not a canonical ceiling.
- [src/main/variant-export.ts](src/main/variant-export.ts) — `exportOneVariant` calls `buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, …)` at lines 191-202. The `s` value flows into the new `BuildExportPlanOptions.variantScale` here (one call site for variants; master path leaves the option unset).
- [src/core/scale-summary-peaks.ts](src/core/scale-summary-peaks.ts) — `scaleSummaryPeaks(summary, s)` scales `peakScale * s` and keeps `canonical/actualSource` at master size. Untouched by Phase 55; it's the upstream that produces the scaled peak the new `1/s` clamp respects.

### Locked prior decisions that bound this phase (do NOT relitigate)
- `.planning/phases/48-core-scale-bake-module-regression-oracle/48-CONTEXT.md` — the bake is field-identical to Spine's `SkeletonJson.scale`; the oracle `parse(bake(orig,s),1) ≡ parse(orig, SkeletonJson.scale=s)` pins it. Option A scoped to the bake stays rejected (Phase 54 D-01). This phase touches export only, not bake.
- `.planning/phases/49-single-scale-variant-export/49-CONTEXT.md` — **L-01** (bake = full `SkeletonJson.scale` similarity bake), **L-02** (variant_peak = s × master_peak; NEVER re-sample), **L-03** (core/ Layer-3 pure), **D-07** (variant inherits FULL active export config). All preserved.
- `.planning/phases/54-variant-reopen-dimension-reconciliation-phantom-green-saving/54-CONTEXT.md` — **D-02** universal/no-variant-detection (carried into Phase 55 D-A's universal `1/s`). The Phase 54 read-model display path (D-01/D-03) stays as-is.
- `.planning/spikes/MANIFEST.md` and SEED-010 spikes 001-003 — proven similarity invariance: `variant_peak = s × master_peak` exact; world-AABB scales by `s` faithfully. The "variant resampled peakScale drops to ≤ 1 after Phase 55" claim relies on this invariance.

### Architecture / test landmines
- `tests/arch.spec.ts` — Layer-3 purity gate on `src/core/`. `buildExportPlan` already has no DOM/fs imports; adding `variantScale?: number` to `BuildExportPlanOptions` keeps the gate green.
- `tests/core/export.spec.ts` — every `s = 1` (master) row MUST stay byte-identical. Tests for variant-call paths (via `scaleSummaryPeaks(summary, s)` indirectly) may need updates where the new `1/s` clamp changes the output dims.
- `tests/scale-bake.spec.ts` — Phase 48 oracle. Stays green unchanged (bake is not touched).
- `tests/variant-export*.spec.ts` (and the dual-runtime × dual-mode matrix from Phase 49) — these will need updates for the new variant dims on rows where master `peakScale × (1+buffer) > 1`.
- `tests/safe01/discover-fixtures.ts` — `SAFE01_EXCLUDED_PREFIXES`. If Phase 55 commits a new variant-with-`peakScale>1` fixture dir, extend this denylist (memory `feedback_new_committed_fixtures_need_safe01_denylist`). Preferred: synthesize a `SkeletonSummary` test double in-suite to avoid the denylist churn (matches Phase 54).

### Memory landmines to honor
- `[[feedback_renderer_ts_helper_test_breaks_typecheck_node]]` — `.ts` tests under `tests/renderer/` importing renderer-src trip `typecheck:node` (TS6307). Phase 55 is a `src/core/` change; if any new test imports renderer code (e.g., to verify the display path is unchanged), use `.spec.tsx` or update `tsconfig.node.json` excludes.
- `[[feedback_verify_whole_ci_surface_locally]]` — local green ≠ CI green; run `typecheck:node` + `typecheck:web` + full suite + the dual-runtime × dual-mode variant matrix from Phase 49.
- `[[project_peak_anchored_invariants]]` / `[[project_compute_export_dims_canonical_base]]` — the canonical-vs-source / override-canonical-relative invariants. Phase 55's `1/s` ceiling refers to the master's on-disk source dim, not its canonical; researcher must verify D-C (the `dimsMismatch` master case) preserves these invariants.
- `[[feedback_gsd_sdk_commit_stages_all_untracked]]` — `gsd-sdk query commit` is NOT a dry run and stages all untracked files. Use manual scoped `git add <file>` + `git commit` for the docs commit.
- `[[project_42leg_byteverbatim_broken_frame_readout]]` — the 4.2-leg byte-verbatim invariant is broken for the AnimationPlayerModal42 only. Export math (`src/core/export.ts`) is NOT subject to that contract; standard edit + test updates apply.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`buildExportPlan` (`src/core/export.ts`)** — already receives `BuildExportPlanOptions` (currently with `skeletonPath`, `safetyBufferPercent`). Adding `variantScale?: number` (default `1.0`) threads `s` to the clamp without restructuring callers. The lift site is one line (279); the option is the cleanest, most-additive seam.
- **`scaleSummaryPeaks` (`src/core/scale-summary-peaks.ts`)** — produces the scaled `peakScale = s × master_peak` that the new clamp respects. Stays unchanged.
- **`safeScale` helper (`src/core/export.ts:181-183`)** — `Math.ceil(s × 1000) / 1000`. Mirrored byte-identically in `src/renderer/src/lib/export-view.ts`. Stays unchanged. Only applied to the bufferedScale, NOT to `1/s` (the clamp value is a ceiling, not a rounded-up demand).
- **`runExport` / `runRepack` (workers)** — read `ExportRow.outW/outH` from `buildExportPlan`. No worker changes; the plan it consumes simply emits different (correct, larger) dims for variant-with-`peakScale > 1` rows.

### Established Patterns
- **Pure-math options threading** — `BuildExportPlanOptions.safetyBufferPercent` (Phase 30) is the precedent for adding a pure-math knob to `buildExportPlan`. `variantScale` follows the same shape: optional, default-no-op, validated at the trust boundary (`variant-export.ts` already clamps `s` to `(0, 1)` exclusive via `VariantScaleError`, and `safeBuffer` to `[0, 25]`).
- **Display vs export separation (Phase 54)** — the renderer's `computeExportDims` is the *display* path (Phase 54 read-model: true render demand, NOT export-clamped). The `src/core/export.ts` lift is the *export* path. They stay distinct; the renderer is not touched by Phase 55.
- **Layer-3 purity** — all changes are in `src/core/`; no DOM/fs/spine-core imports added. `tests/arch.spec.ts` stays green.
- **Per-loaderMode + dual-runtime invariance** — the lift is mode/runtime-agnostic (the math operates on already-loaded `peakScale`/`canonicalW`/`actualSourceW`), so it MUST behave identically for atlas-source/atlas-less and 4.2/4.3. Test matrix to mirror Phase 49's 12-cell × 3-scale grid where applicable.

### Integration Points
- `summary` (from loader) → `scaleSummaryPeaks(summary, s)` (peakScale ×s) → `buildExportPlan(scaledSummary, overrides, { variantScale: s, … })` → ExportRow.outW/outH → `runExport` / `runRepack`. The only edit is at the seam between `scaleSummaryPeaks` and `buildExportPlan`: pass `s` to the new option; let `buildExportPlan` use it for the clamp value.
- Master path (`handleStartExport` in `src/main/ipc.ts`) does NOT thread `s` — omits the option, defaults to `variantScale = 1.0` → `1/s = 1` → byte-identical behavior. **No master-side edit needed**.

</code_context>

<specifics>
## Specific Ideas

- **The precise mechanism to lift (for the planner):** the *export* path computes `downscaleClampedScale = Math.min(safeScale(bufferedScale), 1)`. Replace `1` with `1 / opts.variantScale` (default 1 → equivalent for master). For the variant with master `peakScale = 1.02` at `s = 0.5`: `bufferedScale = 0.5 × 1.02 = 0.51` (no buffer) — actually the clamp does NOT bind here (0.51 < 1). Where it DOES matter is when `s × master_peakScale > 1`, e.g. master `peakScale = 2.5` at `s = 0.5`: today `bufferedScale = 1.25`, clamps to `1` → variant_output = `ceil(canonicalW × 1)`; Phase 55: clamps to `1/0.5 = 2` → variant_output = `ceil(canonicalW × 1.25)`. The variant grows from "canonical-only" to "canonical × s × master_peak" = "canonical × variant_peak". For very high master peakScales (e.g. master `peakScale = 5` at `s = 0.5`: `bufferedScale = 2.5 > 1/s = 2` → clamp binds at 2 → variant_output = `ceil(canonicalW × 2)` = master_source). The `1/s` ceiling correctly enforces "no upscale relative to master source PNG".
- **The TEST_ARMAN 80×40 / 1.02× worked example (verifying user intent):** master canonical 80×40, master `peakScale = 1.02`, variant `s = 0.5`. Scaled `peakScale = 0.51`; `bufferedScale = 0.51`; clamp `1/s = 2` (does not bind, 0.51 < 2); `sourceRatio = 1` (no master drift, does not bind); `effScale = 0.51`; **variant output = `ceil(80 × 0.51) = 41 × ceil(40 × 0.51) = 21`** (NB: not 40.8 truncated). On reopen, variant peakScale (similarity-invariant) inherits `master_peakScale = 1.02`; baked canonical = `s × 80 = 40`; resampled = `world_demand / 41 ≈ 40.5/41 ≈ 0.988 ≤ 1` → ExtrapolationIcon does NOT fire. ✓
- **High-peakScale variant verification:** master `peakScale = 5` at `s = 0.5` → today: `effScale = min(2.5, 1) = 1` → variant_output = `ceil(80 × 1) = 80` (same as master source). Phase 55: `effScale = min(2.5, 1/0.5 = 2) = 2` → variant_output = `ceil(80 × 2) = 160`. **BUT** `sourceRatio = min(80/80, 40/40) = 1` if no master drift → `effScale = min(2, 1) = 1` → variant_output = `80`. The `sourceRatio` cap binds at master source (the no-upscale-from-source contract). For an atlas-source case where actualSource < canonical (rare; pre-optimized master), `sourceRatio < 1` and binds even tighter — verify in research (D-C).
- **Master byte-identity confirmation:** master `s = 1` → `1/s = 1` → formula equivalent to today's `min(safeScale(bufferedScale), 1, sourceRatio)`. Phase 48 oracle stays green; `tests/core/export.spec.ts` master rows stay byte-identical.

### Research flags (for the phase researcher — not user decisions)
- **D-C verification:** confirm `min(safeScale(buffered), 1/s, sourceRatio)` is correct when both `1/s` and `sourceRatio` could bind. Specifically: master with `actualSource < canonical × peakScale` (pre-optimized) AND variant `s < 1`. Expected: `sourceRatio` is the tighter ceiling (binds first); `1/s` is harmless headroom above. No regression to the NECK / `compute_export_dims_canonical_base` invariant.
- **D-E test matrix:** enumerate (a) tests that MUST stay byte-identical (master `s = 1` rows + variant rows where `s × master_peakScale ≤ 1`); (b) tests that WILL need updates (variant rows where `s × master_peakScale > 1` AND `1/s` is not the binding clamp); (c) the Phase 48 oracle (untouched, must stay green). Produce a CI-anchored manifest in the plan.
- **Threading recommendation:** decide between `BuildExportPlanOptions.variantScale?: number` (preferred — additive, matches `safetyBufferPercent` precedent), passing `s` positionally, or factoring the clamp into a `clampForVariant(s)` helper. Researcher to confirm + planner to pick. Constraint: all `s` flowing into `buildExportPlan` MUST be validated at the trust boundary; today `src/main/variant-export.ts` already guards `0 < s < 1` exclusive (via `VariantScaleError`). Master path passes `undefined` → defaults to 1.
- **`computeExportDims` (renderer) parity check:** the renderer's `computeExportDims` is the Phase 54 read-model display path (NOT the export-clamped path). After Phase 55, the renderer still shows `peakDemandW/H` from true world render demand. Confirm no display-side parity test breaks (e.g. tests that asserted "renderer-display matches export math after the `≤ 1` clamp"). The renderer-display vs export-math separation is deliberate post-Phase-54.
- **Verification: live UAT plan.** Reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json` (after re-exporting from master with the new code): 80×40 / 1.02× row should now show variant source = 41×21, resampled peakScale ≤ 1, ExtrapolationIcon NOT firing. Counter-test: a master with `peakScale > 1` and pre-optimized source still shows the icon + the Phase 54 "capped at source dims" tooltip suffix → confirms D-F is correct.

</specifics>

<deferred>
## Deferred Ideas

- **One-shot variant reconciliation tool (`/gsd-reoptimize-variant` or similar):** walk a variant folder and re-resize its PNGs to the new ceiling without re-running the bake. Touches the Phase 54 "do NOT re-optimize variants" stance; revisits a previously-rejected pattern. Revisit in a future phase ONLY if user demand surfaces after Phase 55 lands.
- **Sweep of the ExtrapolationIcon tooltip wording for variants:** Phase 55 drops the icon's fire rate on variants but `extrapolationTooltip()` text stays unchanged. Could be revisited in a future copy-sweep phase if the suffix wording feels misleading once the variant noise drops live.
- **A "variant export ceiling" debug HUD / dev-toggle** to show the binding clamp (canonical, `1/s`, or `sourceRatio`) per row. Useful for QA on complex rigs; not user-facing; out of scope for Phase 55.

</deferred>

---

*Phase: 55-variant-export-sizes-to-peak-demand*
*Context gathered: 2026-05-26*
