# Phase 54: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) - Context

**Gathered:** 2026-05-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Stop the app from reporting **false "savings"** (green-tinted Peak cell, Scale < 1.000×) for textures that are already sized to their true on-screen render demand. This is a **read-model / display fix only** — it changes how Peak and the savings figure are *computed for display*, and how the green tint *decides*. It changes **NO exported bytes**, does **NOT** touch the v1.7-locked scale-bake or the export sizing math, and does **NOT** re-optimize or shrink any texture.

Two observable symptoms (both from the originating debug session) must be gone after this phase:
1. **Clearly-green false rows** on art drawn smaller than it renders (`peakScale > 1`), e.g. reopened-variant `GRAND` 0.846×, `L_SKIRT` 0.877× (ARMAN @0.5x = 57 such rows; 42 @0.1x = 22). After the fix these read "no savings."
2. **"Looks identical but green"** rows — a row whose displayed Peak and Source integers are the same yet the cell is tinted green.

**In scope:** the displayed Peak-demand computation (`computeExportDims` in `export-view.ts`), the green/yellow tint decision (`rowState` + its inputs in `GlobalMaxRenderPanel.tsx`), and the section "pixel savings %" chip so it recomputes from the corrected per-row state. Applies **universally** (master + variant; atlas-source + atlas-less; 4.2 + 4.3).

**Out of scope (do NOT build here):** any change to exported texture bytes or the `bake()` geometry (that was Option A — explicitly rejected, see Deferred); any "this is a variant" badge/affordance; re-running the optimizer on variants; the faint sub-pixel rounding greens beyond what the integer-match tint rule (D-03) naturally resolves; any new dialog/toolbar/UI surface.

</domain>

<decisions>
## Implementation Decisions

### Fix Direction
- **D-01 (Fix direction = read-model, Option B):** Compute the **displayed Peak demand and the savings signal from TRUE world render demand** — `canonical × peakScale`, **capped at the texture's real pixel size** (`actualSource`) — instead of from the export-clamped value (`canonical × min(peakScale, 1.0)`). The premature `≤ 1.0` clamp in the *display* path is the root cause: it discards the `peakScale > 1` information, so a texture that genuinely renders at (or near) its full pixel size is reported as Peak `= canonical` < `actualSource` → false green. **The export-side `≤ 1.0` clamp stays (textures are never upscaled on export) — only the DISPLAYED peak-demand / savings derivation changes.** No exported bytes change; variant textures stay sharp (`s × peak`). Rejected: Option A (clamp variant PNGs to `s × canonical` at export — smaller files but lower variant quality + edits v1.7-verified export math + needs faithfulness re-verify) and Option C (safety guard only — leaves the confusing display).

### Reach
- **D-02 (Universal, not variant-gated):** Apply the corrected peak-demand math to **all rigs**, not just reopened variants. It is a genuine correctness fix to the peak/savings display and naturally fixes the **same latent false-green on master rigs** with `peakScale > 1` (any rig where `canonical < actualSource ≤ canonical × peakScale`). **No "is this a variant" detection is needed** (no heuristic, no export-time marker) — simpler and more correct. Accepted consequence: a few **master** rows that currently show a false green will correctly flip to "no savings." Genuine-savings rows (`peakScale < 1`, or `canonical × peakScale < actualSource`) keep their (correct) green. Rejected: variant-only gating (needs fragile variant detection; leaves the master bug latent).

### Green-Tint Rule
- **D-03 (Tint matches the displayed integers):** A row is tinted green **only when its DISPLAYED (integer) Peak dimension is strictly smaller than its DISPLAYED (integer) Source dimension.** Eliminates the "peak and source look the same but it's green" confusion: sub-pixel-only differences round to equal integers and therefore show **no green** (the user can't act on sub-pixel savings anyway). This supersedes the current `rowState(peakDisplayW, actualSourceW ?? sourceW)` comparison, which can tint green off unrounded/`actualSource` values that diverge from what the cell actually shows. The Source and Peak integers compared MUST be the exact integers rendered in the two cells.

### Claude's Discretion
- The exact code seam for D-01: whether to add an uncapped "true render-demand" quantity alongside the existing export-clamped `outW/outH` in `computeExportDims`, vs. derive it in the panel. Keep the **export** path (`outW = ceil(canonicalW × effScale)`, `effScale ≤ 1.0`) byte-identical for the existing export/optimize flow — this phase only adds/ūses a display-demand value. Confirm with the researcher whether the panel's "Peak W×H" should display the render-demand value or remain the export-dim value with only the **tint + savings %** rebased (see Research Flags — there is a documented semantic tension here).
- Whether the savings-% chip (`AppShell.tsx` `savingsPctMemo`, ~`:702-712`) recomputes by reusing the corrected per-row state or by an independent area sum — pick the path that guarantees chip ≡ sum of per-row states.
- Tolerance handling for D-03 (pure integer compare of the two shown dims vs. an epsilon) — prefer the pure integer compare of exactly-what-is-rendered; avoid an arbitrary epsilon knob.
- Test fixture choice for the automated round-trip (see Research Flags / verification).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Root-cause & reproduction (READ FIRST)
- `.planning/debug/variant-peaks-differ-green.md` — full diagnosis, the GRAND/L_SKIRT walk-through, on-disk file evidence, the three fix directions, and the "do NOT re-optimize variants" warning. Status resolved/diagnose-only.

### The display/read-model code this phase changes
- `src/renderer/src/lib/export-view.ts` — `computeExportDims(sourceW, sourceH, peakScale, override?, actualSourceW?, actualSourceH?, canonicalW?, canonicalH?)` (`:178+`). The premature `downscaleClampedScale = Math.min(safeScale(rawEffScale), 1)` (`:219`) + Phase-22 `sourceRatio` cap (`actualSource/canonical`) + `outW = ceil(canonicalW × effScale)` is exactly the path that drops the `peakScale > 1` signal. `safeScale` = `ceil(s*1000)/1000` (`:153`).
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` — `rowState(peakDisplayW, sourceW, isUnused, isMissing)` (`:197-201`: `under`=green when `peakDisplayW < sourceW`, `atLimit`=yellow when equal), called as `rowState(row.peakDisplayW, row.actualSourceW ?? row.sourceW, …)` (`:1013`); Peak cell renders `` `${row.peakDisplayW}×${row.peakDisplayH}` `` (`:565`); Scale cell `row.displayScale.toFixed(3)` (`:595`). This is the tint decision D-03 rewrites and the Peak display D-01 may rebase.
- `src/renderer/src/components/AppShell.tsx` — `savingsPctMemo` (~`:702-712`) feeds the panel's `savingsPct` chip (D-08/09/10); must recompute from the corrected per-row state.

### How "Source" vs "canonical" are derived on load (why variant actualSource > canonical)
- `src/core/loader.ts` — `canonicalW/H` from JSON `width`/`height` (`:1020-1021`, Phase-22 D-01); `actualSourceW/H` from `region.originalWidth/Height` in atlas-source mode (`:853-878`) or the atlas-less synthetic-atlas path; `hasExplicitOrig = origW !== packedW` (`:787`). For a reopened variant, `actualSource = s × master_peak` (supersampled PNG) while `canonical = s × master_canonical` (baked geometry) → `actualSource > canonical` → `dimsMismatch` → the false-green trigger.

### The export sizing that produced the mismatch (READ — but DO NOT change in this phase)
- `src/core/export.ts:185-471` — `buildExportPlan`: per-row `effectiveScale` (override %-of-peak, safety buffer, `≤ 1.0` clamp `:279`, source-ratio cap, `outW/outH = ceil(canonicalW × effScale)` `:403-404`). For variants, `effectiveScale = s × master_effScale`; when `master peakScale > 1`, `s × peakScale` can stay `< 1.0` so the clamp does NOT fire → PNG = `s × peak` > `s × canonical`. **This is correct export behavior (quality-preserving) and stays untouched.**
- `src/main/variant-export.ts` — `buildExportPlan(scaleSummaryPeaks(summary, s), …)` (variant_peak = s × master_peak; L-02). Untouched this phase.

### Locked prior decisions that bound this phase (do NOT relitigate)
- `.planning/phases/49-single-scale-variant-export/49-CONTEXT.md` — **L-01** (bake = full `SkeletonJson.scale` similarity bake), **L-02** (variant_peak = s × master_peak; NEVER re-sample a variant), **L-03** (core/ Layer-3 pure), **D-07** (variant textures sized `s × master_effectiveScale` via unchanged `buildExportPlan`).
- `.planning/phases/48-core-scale-bake-module-regression-oracle/48-CONTEXT.md` — the bake is field-identical to Spine; direction-agnostic (D-09). Option A would have touched this; Option A is rejected, so the bake is out of scope.

### Architecture / test landmines
- `tests/arch.spec.ts` — Layer-3 purity gate. This phase is renderer-side display logic; keep `core/` pure.

### Memory landmines to honor
- [[feedback_renderer_ts_helper_test_breaks_typecheck_node]] — a `.ts` test under `tests/renderer/` importing renderer-src trips `typecheck:node` (TS6307), invisible to the vitest-only self-check. Name new renderer tests `.spec.tsx` or exclude in `tsconfig.node.json`. This phase touches `export-view.ts` + the panel → directly at risk.
- [[project_peak_anchored_invariants]] / [[project_compute_export_dims_canonical_base]] — the canonical-vs-source / override-canonical-relative invariants and the "Peak column = world demand vs export dims" history. The D-01 reframing sits exactly on this seam — verify against these before changing the displayed Peak value vs only the tint/savings.
- [[feedback_new_committed_fixtures_need_safe01_denylist]] / [[feedback_gitignore_fixtures_check_test_refs]] — if an automated round-trip test commits a NEW fixture dir, co-extend `SAFE01_EXCLUDED_PREFIXES` in `tests/safe01/discover-fixtures.ts` and prove it git-tracked.
- [[feedback_verify_whole_ci_surface_locally]] — local green ≠ CI green; run `typecheck:node` + `typecheck:web` + full suite.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`computeExportDims` (`export-view.ts`)** — already receives both `peakScale` AND `actualSourceW`/`canonicalW`; it has everything needed to derive true render demand (`canonical × peakScale` capped at `actualSource`) without new inputs.
- **`rowState` (`GlobalMaxRenderPanel.tsx`)** — single chokepoint for the green/yellow decision; D-03 rewrites its comparison to use the two displayed integers.
- **`savingsPctMemo` (`AppShell.tsx`)** — the one place the chip % is computed; rebasing it on corrected per-row state keeps chip ≡ row sum.

### Established Patterns
- **Display vs export separation** — the export math (`buildExportPlan`, `outW = ceil(canonicalW × effScale)`, `≤ 1.0` clamp) is the contract for written bytes and stays frozen; this phase only adds a *display-demand* derivation. Keep them distinct.
- **Layer-3 purity** — all changes are renderer-side (`src/renderer/...`); `core/` untouched.
- **Per-loaderMode + dual-runtime invariance** — the fix is mode/runtime-agnostic (it operates on already-loaded `peakScale`/`canonical`/`actualSource`), so it must behave identically for atlas-source/atlas-less and 4.2/4.3.

### Integration Points
- `loader.ts` → DisplayRow (`canonicalW`, `actualSourceW`, `peakScale`) → `computeExportDims` (display demand) → `rowState` (tint) + Peak/Scale cells + `savingsPctMemo` (chip). The whole change lives on this renderer read-path; no IPC, no main-process, no export-worker involvement.

</code_context>

<specifics>
## Specific Ideas

- **The precise mechanism to fix (for the planner):** the *display* path computes Peak demand as `canonical × min(peakScale, 1.0)` (export-clamped), but the *correct* display demand is `min(canonical × peakScale, actualSource)`. They only diverge when `peakScale > 1` (texture renders at/above its drawn size). For `peakScale ≤ 1` the two are identical — so genuine-savings rows are provably unaffected. Worked example (reopened ARMAN @0.5x `GRAND`): `canonical ≈ 208.5`, `actualSource ≈ 247`, `peakScale ≈ 1.18`. Current display Peak = `ceil(208.5 × 1.0) = 209` < 247 → false green 0.846×. Fixed display demand = `min(208.5 × 1.18, 247) = min(246, 247) ≈ 247` = source → no green. Master `peakScale < 1` rows (e.g. CROWN 0.44×) keep `Peak = ceil(canonical × 0.44) < source` → green stays correct.
- **The user's two complaints map 1:1 to the two decisions:** the clearly-green false rows → D-01 (render-demand reframing); the "looks identical but green" rows → D-03 (tint matches shown integers).
- **Quality intent:** variant textures are deliberately sharp (sized to `s × peak`) — that is a *feature* of a per-resolution exporter, not waste. The fix makes the readout tell the truth about that, rather than shrinking the asset.

### Research flags (for the phase researcher — not user decisions)
- **Semantic-history check (highest priority):** reconcile [[project_peak_anchored_invariants]] ("Peak column shows world demand, NOT export dims", 2026-05-05) against the current panel/`computeExportDims` comment trail (Phase 22.1 / "Peak W×H matches export dims, clamped ≤ source"). Decide whether the **displayed Peak W×H value** should become the render-demand value, or stay the export-dim value with only the **tint (D-03) + savings basis (D-01)** rebased. Both kill the false green; pick the one consistent with the locked invariants and least surprising.
- Confirm masters with genuine savings (`peakScale < 1`) and the existing override/safety-buffer/source-ratio-cap rows are display-unchanged (regression guard).
- Verify the atlas-source drift case (`project_compute_export_dims_canonical_base`, the NECK repack lineage) is handled correctly by the universal rule — `actualSource > canonical` there is a *real* savings case (`peakScale ≤ 1`) and must stay green.
- Verification: a round-trip automated test — export a variant of a `peakScale > 1` fixture (or synthesize a DisplayRow with `actualSource > canonical`, `peakScale > 1`), assert no false green + savings drops to the genuine residual; plus a master-unaffected regression and a D-03 tint-vs-displayed-integers unit test. Manual UAT: reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json` (GRAND/L_SKIRT no longer green; chip ≈ rounding residual, not 20.6%) and `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json` (L_SKIRT 0.877× gone). Honor the renderer-test naming landmine.

</specifics>

<deferred>
## Deferred Ideas

- **Option A — shrink variant textures to `s × canonical` at export** (smaller variant files at the cost of variant texture quality + re-verifying drop-in faithfulness). Rejected for this phase; revisit only if a future "minimum-file-size variant" mode is wanted. Would touch the v1.7-locked export/bake contract.
- **Option C — re-optimize safety guard** (prevent shrinking a variant below true peak demand). Not needed once the display is honest; could be a cheap belt-and-suspenders later.
- **"This is a variant — already sized" badge/affordance** in the table. Not built — once the numbers read correctly ("no savings"), no extra UI is needed; revisit if users still want explicit signposting (new UI = its own phase).
- **Sweeping the faint sub-pixel rounding greens beyond the D-03 integer-match rule** (e.g. an explicit tolerance/epsilon). Left out — D-03 already resolves the "looks identical" cases; an epsilon risks hiding genuine tiny savings.

</deferred>

---

*Phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving*
*Context gathered: 2026-05-25*
