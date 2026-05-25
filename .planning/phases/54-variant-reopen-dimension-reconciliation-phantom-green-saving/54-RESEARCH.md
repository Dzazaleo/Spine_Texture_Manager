# Phase 54: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) - Research

**Researched:** 2026-05-25
**Domain:** Renderer-side read-model / display-derivation bugfix (TypeScript, no DOM math; React panel tint + memo)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (Fix direction = read-model, Option B):** Compute the **displayed Peak demand and the savings signal from TRUE world render demand** — `canonical × peakScale`, **capped at the texture's real pixel size** (`actualSource`) — instead of from the export-clamped value (`canonical × min(peakScale, 1.0)`). The premature `≤ 1.0` clamp in the *display* path is the root cause. **The export-side `≤ 1.0` clamp stays — only the DISPLAYED peak-demand / savings derivation changes.** No exported bytes change. Rejected: Option A (clamp variant PNGs at export) and Option C (safety guard only).
- **D-02 (Universal, not variant-gated):** Apply the corrected peak-demand math to **all rigs**, not just reopened variants. No "is this a variant" detection. Accepted consequence: a few master rows that currently show a false green correctly flip to "no savings." Genuine-savings rows (`peakScale < 1`, or `canonical × peakScale < actualSource`) keep their green. Rejected: variant-only gating.
- **D-03 (Tint matches the displayed integers):** A row is tinted green **only when its DISPLAYED (integer) Peak dimension is strictly smaller than its DISPLAYED (integer) Source dimension.** Sub-pixel-only differences round to equal integers and therefore show **no green**. The Source and Peak integers compared MUST be the exact integers rendered in the two cells.

### Claude's Discretion
- The exact code seam for D-01: add an uncapped "true render-demand" quantity alongside the existing export-clamped `outW/outH` in `computeExportDims`, vs. derive it in the panel. Keep the **export** path byte-identical. Confirm whether the panel's "Peak W×H" should *display* the render-demand value or remain the export-dim value with only the **tint + savings %** rebased (see Research Flags — documented semantic tension).
- Whether the savings-% chip (`AppShell.tsx` `savingsPctMemo`) recomputes by reusing the corrected per-row state or by an independent area sum — pick the path that guarantees chip ≡ sum of per-row states.
- Tolerance handling for D-03 (pure integer compare of the two shown dims vs. an epsilon) — prefer the pure integer compare; avoid an arbitrary epsilon knob.
- Test fixture choice for the automated round-trip.

### Deferred Ideas (OUT OF SCOPE)
- **Option A** — shrink variant textures to `s × canonical` at export. Rejected (touches v1.7-locked export/bake contract).
- **Option C** — re-optimize safety guard. Not needed once the display is honest.
- **"This is a variant — already sized" badge/affordance.** Not built (new UI = its own phase).
- **Sweeping the faint sub-pixel rounding greens beyond the D-03 integer-match rule** (an explicit tolerance/epsilon). Left out — D-03 already resolves the "looks identical" cases.
</user_constraints>

## Summary

This is a **pure renderer read-model bugfix** confined to three already-existing chokepoints on a single data path: `computeExportDims` (`src/renderer/src/lib/export-view.ts`), the `rowState` tint decision + Source/Peak cell render (`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`), and `savingsPctMemo` (`src/renderer/src/components/AppShell.tsx`). No `core/` change, no IPC, no export-worker, no exported bytes. The fix direction is fully locked (Option B). The research resolves the one open semantic question, fixes the exact seam, and de-risks verification with a proven regression guarantee.

The bug: for an attachment whose art is drawn smaller than it renders (`peakScale > 1`), a reopened variant has `actualSource > canonical` (PNG written at `s × master_peak`, JSON baked at `s × master_canonical`). The display path computes Peak demand as `ceil(canonical × min(peakScale, 1))` — the premature `≤ 1.0` clamp discards the `peakScale > 1` signal, so Peak reads `≈ canonical < actualSource` → false green (GRAND 0.846×, L_SKIRT 0.877×). The correct display demand is `min(canonical × peakScale, actualSource)`, which for GRAND yields `min(246, 247) ≈ 247 = source` → no green.

**The two complaints map 1:1 to the two locked decisions:** clearly-green false rows → D-01 (render-demand reframing); "looks identical but green" rows → D-03 (tint matches shown integers). One subtlety the debug doc already established: `peakDisplayW` is *already* an integer and `rowState` *already* compares against the same `actualSourceW` the Source cell renders (`originalSizeLabel`), so D-03 is largely a hardening/contract assertion rather than a behavioral change once D-01 lands — but it MUST be written so the comparison provably uses the two rendered integers, with no float path.

**Primary recommendation:** In `computeExportDims`, add a **new uncapped-at-canonical render-demand pair** (`peakDemandW`, `peakDemandH`) computed as `min(ceil(canonW × safeScale(peakScale × overrideFrac)), actualSource)`; **make the Peak W×H cell DISPLAY this value** (it is the world-demand value the locked invariant `project_peak_anchored_invariants` requires); leave `outW/outH/effScale/displayScale` (the export-dim values) byte-identical; rewrite `rowState` to compare the rendered integers; rebase `savingsPctMemo` onto the corrected per-row demand (or document that it is intentionally the export-plan figure — see §savings-% chip for the decisive recommendation).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| True render-demand derivation (`min(canonical×peakScale, actualSource)`) | Renderer / `lib` pure helper (`computeExportDims`) | — | Already receives `peakScale`, `canonical`, `actualSource`; no new inputs; Layer-3 (no DOM). `core/` must stay pure (arch.spec.ts). |
| Green/yellow tint decision | Renderer / React panel (`rowState` in `GlobalMaxRenderPanel.tsx`) | — | Single chokepoint; compares the two rendered integers. |
| Source / Peak displayed integers | Renderer / React panel + preformatted label (`originalSizeLabel` from `core/analyzer.ts`) | — | Source cell renders `originalSizeLabel`; Peak cell renders `peakDisplayW×peakDisplayH`. |
| Section savings-% chip | Renderer / `AppShell.tsx` memo (`savingsPctMemo`) | — | One place the chip % is computed; must reconcile with per-row state. |
| Export bytes / `outW/outH` | `core/export.ts` `buildExportPlan` (FROZEN) | renderer mirror `export-view.ts buildExportPlan` (FROZEN) | v1.7-locked; must stay byte-identical. The fix adds a parallel display value, never touches this. |

## Research Question 1 [HIGHEST PRIORITY]: Semantic-history reconciliation

**Decision: the displayed Peak W×H value itself SHOULD become the true render-demand value `min(canonical × peakScale, actualSource)` (override-scaled).** Keep the export-dim value (`outW/outH`) as a separate field used only by the export/optimize path. Justification follows. `[VERIFIED: codebase + git comment trail]`

### The tension, resolved

There are two locked-memory positions that appear to conflict:

- **`project_peak_anchored_invariants` (2026-05-05):** *"Peak column shows world demand, NOT export dims."* This is the **design intent** of the 2026-05-05 redesign that moved the tint to the Peak column.
- **The current code comment trail (`export-view.ts:251-264`, `enrich-overrides.ts:26-30`):** *"the panel's 'Peak W×H' column shows EXPORT dims — `Math.ceil(sourceDim × ceil-thousandth-effScale, clamped ≤ source)`."*

These contradict because **a later edit silently drifted the Peak column away from its stated invariant.** The 2026-05-05 redesign said "Peak = world demand," but the implementation routed Peak through `computeExportDims`'s `peakDisplayEff = min(safeScale(peakScale), 1, sourceRatio)` — i.e. it applied the **export `≤ 1.0` clamp to a column that was supposed to show pre-clamp world demand.** That clamp is the *exact* root cause this phase fixes (CONTEXT D-01). So the two positions are not a real design conflict — the current code is the regression, and `project_peak_anchored_invariants` is the canonical intent. **Restoring "Peak = world demand (capped only at the real on-disk source ceiling)" is the change that both kills the false green AND re-aligns the column with its locked invariant.** `[VERIFIED: export-view.ts:251-272 vs the 2026-05-05 memory]`

### Why "display the render demand" beats "keep export-dims, rebase only tint+savings"

| Option | Peak cell shows | False green killed? | Consistent with `project_peak_anchored_invariants`? | User surprise |
|--------|-----------------|--------------------|----|----|
| **(chosen) Peak = render demand** `min(canonical×peakScale, actualSource)` | GRAND: `247×75` (== Source) | Yes (D-03 integer compare) | **Yes** — restores "Peak = world demand" | Lowest — the Peak cell literally reads the same dims as Source for an at-limit row, so "green when Peak < Source" is self-evidently true to the eye |
| Peak = export-dim, rebase tint+savings only | GRAND: `209×63` (< Source 247) but **not** green | Yes (tint rebased) | **No** — Peak stays the export-clamped value, perpetuating the drift the invariant warns against | **High** — the user sees `Peak 209 < Source 247` with NO green tint and `Scale 0.846×`; the numbers say "savings" but the color says "none." This is a *new* "looks-like-savings-but-isn't" confusion — the inverse of the bug we're fixing |

The second option reintroduces exactly the class of confusion (D-03) we are eliminating: a Peak that visibly differs from Source but is not tinted. **Choose option 1.**

### Consequence of the chosen option for what the Peak cell shows

- `peakScale > 1` rows: Peak cell now reads the **render demand capped at source** (e.g. GRAND `247×75`), so for an at-limit variant row **Peak == Source == yellow** — the truthful "this texture is already sized to its render demand" readout. The ExtrapolationIcon (rendered when `row.peakScale > 1`, panel `:566`) already signals "rig peak exceeds source — export capped at canonical"; its tooltip wording should be revisited so it no longer says "capped at canonical" (now the Peak cell shows the source-capped demand, not the canonical clamp). **(Minor copy task — flag for planner, not a behavior change.)**
- `peakScale ≤ 1` rows: **display byte-identical** to today (proven in §Regression-safety, fuzz = 0 divergences in the realistic regime). Genuine green preserved.
- The **export-dim value** (`outW/outH`, the actual written PNG size, the OptimizeDialog pre-flight list, and the Scale column `displayScale = outW / source`) stays exactly as-is. The Scale column (`:595`) keeps showing the on-disk shrink ratio of the *export* — these are different questions ("what will export produce" vs "what does the rig demand") and both stay truthful.

> **One caveat the planner must keep:** the Scale column (`displayScale`) is derived from the **export** `outW`, not the new render demand. Do NOT rebase `displayScale` onto the render demand — that would change the meaning of the Scale column (it answers "how much will the source PNG be reduced on export"). For a `peakScale > 1` row the export Scale legitimately reads `< 1.0` (e.g. GRAND export = `ceil(canonical × 1.0)/source = 209/247 = 0.846×`) because the *export* still downscales to canonical. The fix removes the misleading *green tint* and corrects the *Peak* readout, but the Scale column's number is a separate, still-correct fact about the export. The planner should DECIDE explicitly whether the Scale column stays export-based (recommended — preserves its locked 2026-05-05 contract) or is also rebased; **recommendation: leave Scale column export-based and unchanged**, since CONTEXT scope names only "Peak-demand computation, the tint decision, and the savings chip."

## Research Question 2: Exact code seam

**Recommendation: seam (a) — add the render-demand pair inside `computeExportDims`.** It already receives every input needed (`peakScale`, `override`, `actualSourceW/H`, `canonicalW/H`), it is the single source of truth shared by the panel and OptimizeDialog, and `enrich-overrides.ts` already destructures its return — so the new fields flow to the panel with one extra destructure. Deriving in the panel would duplicate the override/safeScale math and risk drift. `[VERIFIED: export-view.ts:178-275, enrich-overrides.ts:39-67]`

### Exact change in `computeExportDims` (`src/renderer/src/lib/export-view.ts`)

Return type (line `:208`) gains two fields:
```ts
): { effScale: number; outW: number; outH: number; displayScale: number;
     peakDisplayW: number; peakDisplayH: number;
     peakDemandW: number; peakDemandH: number } {   // <-- NEW (D-01 render demand)
```

After the existing `peakDisplayW/H` block (`:265-272`), add the **uncapped-at-canonical** render demand. Mirror the existing `overrideFrac`/`rawPeakEff` derivation but **drop the `min(…, 1)` canonical clamp** and cap **only** at `actualSource`:
```ts
// Phase 54 D-01 — TRUE render demand for DISPLAY (NOT export).
// peakDemandW/H = min(ceil(canonicalW × safeScale(peakScale × overrideFrac)), actualSource)
// Differs from peakDisplayW/H ONLY by removing the export `≤ 1.0` canonical
// clamp: it preserves the peakScale > 1 signal (the false-green root cause).
// Capped at the real on-disk pixel size (actualSource) — never report demand
// above what the texture physically is. For peakScale ≤ 1 this is byte-
// identical to peakDisplayW/H in the realistic regime (actualSource ≥ canonical);
// see 54-RESEARCH §Regression-safety. Export dims (outW/outH) are UNCHANGED.
const actualSrcW = actualSourceW ?? canonW;   // fall back to canonical when no on-disk dim
const actualSrcH = actualSourceH ?? canonH;
const peakDemandW = Math.min(Math.ceil(canonW * safeScale(rawPeakEff)), actualSrcW);
const peakDemandH = Math.min(Math.ceil(canonH * safeScale(rawPeakEff)), actualSrcH);
```
where `rawPeakEff = peakScale * overrideFrac` already exists at `:266`. Return both new fields.

> **Critical: `safeScale(rawPeakEff)` MUST be kept (do NOT drop it).** Fuzz testing proved that dropping `safeScale` diverges from current display in ~45% of `peakScale ≤ 1` rows (changes genuine-savings rows). With `safeScale` retained, divergence is **0** in the realistic regime (`actualSource ≥ canonical`, integer). See §Regression-safety proofs. `[VERIFIED: node fuzz, 500k cases]`

### Exact change in `enrich-overrides.ts` (`src/renderer/src/lib/enrich-overrides.ts`)

Add `peakDemandW/H` to the `EnrichedRow` type (`:15-23`) and to the destructure + spread (`:45-65`):
```ts
const { effScale, outW, outH, displayScale, peakDisplayW, peakDisplayH,
        peakDemandW, peakDemandH } = computeExportDims( … );  // unchanged args
// …
return { …row, …, peakDisplayW, peakDisplayH, peakDemandW, peakDemandH, override };
```

### Make the Peak cell display the render demand (`GlobalMaxRenderPanel.tsx:565`)

```tsx
<span>{`${row.peakDemandW}×${row.peakDemandH}`}</span>   // was peakDisplayW×peakDisplayH
```

### Export path: confirmed isolated — no leak risk

- **Export bytes** are produced exclusively by `buildExportPlan` (`src/core/export.ts` + the byte-identical renderer mirror `export-view.ts:277-554`). `buildExportPlan` does **not** call `computeExportDims` — it has its own inline `outW = ceil(canonicalW × effScale)` with the `≤ 1.0` clamp (`:364, :485-486`). Adding fields to `computeExportDims`'s return cannot affect `buildExportPlan`. `[VERIFIED: export-view.ts:277-554]`
- **OptimizeDialog pre-flight** consumes `plan.rows[].outW/outH` from `buildExportPlan`, not `computeExportDims` (`OptimizeDialog.tsx:428-434`). Untouched. `[VERIFIED]`
- **Consumers of `computeExportDims`:** only `enrich-overrides.ts` (panel display) and `tests/core/export.spec.ts` (asserts the existing fields). Adding return fields is additive; existing destructures ignore them. `[VERIFIED: grep computeExportDims]`
- **The parity contract** (`export-view.ts:28-32` "byte-identical to the canonical source module") applies to **`buildExportPlan`/`safeScale`**, NOT `computeExportDims` (which is renderer-only — there is no `core/` copy of `computeExportDims`). So adding the render-demand to `computeExportDims` does not break the parity hygiene test. `[VERIFIED: export.spec.ts parity block targets buildExportPlan + safeScale]`

## Research Question 3: D-03 tint rule

### Which integers are actually rendered

- **Peak cell** (`:565`): renders `` `${row.peakDisplayW}×${row.peakDisplayH}` `` today → **becomes `row.peakDemandW`/`peakDemandH`** after D-01. These are `Math.ceil(...)` integers.
- **Source cell** (`:509-510`): renders `row.originalSizeLabel`. From `core/analyzer.ts:132`: `originalSizeLabel = \`${actualSourceW ?? p.sourceW}×${actualSourceH ?? p.sourceH}\``. So the Source integer is **`actualSourceW ?? sourceW`** (string-formatted from the same numeric fields). `[VERIFIED: analyzer.ts:132, GlobalMaxRenderPanel.tsx:509-510]`

This means the *current* `rowState(row.peakDisplayW, row.actualSourceW ?? row.sourceW, …)` (`:1013, :1137`) already compares the same numeric basis the Source cell shows — the debug doc's "Eliminated" section confirms there is no hidden float (`peakDisplayW` is itself a ceil-integer). The "looks identical but green" rows were actually `Source(atlas)=247 vs Peak(canonical-clamp)=209` — **two genuinely different integers that look close to the eye**, not a float-vs-int artifact. D-01 fixes those by making Peak read `247`. **D-03's job is therefore to (a) switch the compared Peak integer to the new `peakDemandW`, and (b) lock the comparison-uses-rendered-integers contract so it can never drift.** `[VERIFIED: debug doc "Eliminated" + Resolution]`

### Exact rewrite of `rowState` and its call sites

`rowState` signature is fine; rewrite the call sites (`:1013` and `:1137`) to pass `peakDemandW`:
```tsx
const state = rowState(row.peakDemandW, row.actualSourceW ?? row.sourceW, false, row.isMissing);
```
`rowState` body (`:197-203`) stays as a **pure integer compare** (no epsilon — honors CONTEXT discretion + Deferred "no epsilon knob"):
```ts
function rowState(peakDisplayW: number, sourceW: number, isUnused: boolean, isMissing?: boolean): RowState {
  if (isMissing) return 'missing';
  if (isUnused) return 'unused';
  if (peakDisplayW < sourceW) return 'under';   // GREEN — strictly smaller integer
  if (peakDisplayW === sourceW) return 'atLimit'; // YELLOW — equal integers
  return 'neutral';
}
```
> **Contract assertion the planner should add:** both arguments are the exact integers rendered in the two cells — Peak = `row.peakDemandW` (rendered at `:565`), Source = `row.actualSourceW ?? row.sourceW` (the numeric form of `originalSizeLabel` rendered at `:509`). Add a code comment binding these, and a unit test (§Validation Architecture, test iii) that drives `rowState` with the exact strings/integers and asserts no green when the rendered integers are equal.

> **Height-axis note:** `rowState` compares only the W axis. Because `peakDemandW/H` use a single uniform `safeScale(rawPeakEff)` multiplier and both axes cap at their respective `actualSource`, the W-axis decision is representative for uniform scaling. This matches the existing single-axis convention — no change needed, but the planner should keep the W-only compare (changing to a two-axis compare is out of scope and could surprise on rotated/aspect-edge rows).

## Research Question 4: savings-% chip (`savingsPctMemo`)

### Current behavior

`savingsPctMemo` (`AppShell.tsx:1187-1203`) calls `buildExportPlan(...)` and computes `(1 - sumOutPixels / sumSourcePixels) * 100` over **`plan.rows` only** (excludes `passthroughCopies`), with `sourceW × sourceH` as the denominator and `outW × outH` as the numerator. This is the **export-plan** figure (formula LOCKED in 20-CONTEXT.md D-18, byte-identical to OptimizeDialog `:436-439`). `[VERIFIED: AppShell.tsx:1180-1203, OptimizeDialog.tsx:428-439]`

### The reconciliation problem

The chip is *not* currently ≡ the sum of the per-row tint states. After D-01, the per-row tint reflects **render demand vs source**, while the chip still reflects **export-out vs source**. For a `peakScale > 1` variant row these diverge: tint says "no savings" (Peak == Source) but the export plan genuinely *would* downscale that PNG to canonical (`outW = 209 < source 247`) and so still counts it as "savings" in the chip. **That is exactly the harmful shrink the debug doc warns against** ("re-optimizing the variant under-sizes peakScale>1 textures"). So the chip, as-is, would still over-report recoverable savings for reopened variants (the 20.6% the user complained about).

### Recommendation: rebase the chip onto the corrected per-row render demand (guarantees chip ≡ sum of per-row states)

Recompute `savingsPctMemo` from the **same enriched per-row demand** the table tints on, so the chip and the row colors can never disagree. Concretely:

```ts
const savingsPctMemo = useMemo<number | null>(() => {
  const enriched = enrichWithEffective(effectiveSummary.regions, activeOverrides);
  // Use the SAME render-demand the panel tints on (Phase 54 D-01).
  // Savings = pixels NOT demanded vs the real on-disk source pixels.
  let sumSource = 0, sumDemand = 0;
  for (const r of enriched) {
    const srcW = r.actualSourceW ?? r.sourceW;
    const srcH = r.actualSourceH ?? r.sourceH;
    sumSource += srcW * srcH;
    sumDemand += r.peakDemandW * r.peakDemandH;   // capped at source, ≤ srcW*srcH
  }
  if (sumSource <= 0) return null;
  if (enriched.length === 0) return null;
  return (1 - sumDemand / sumSource) * 100;
}, [effectiveSummary, activeOverrides]);
```

**Properties this guarantees:**
- For every row `peakDemand ≤ actualSource` (capped), so each row contributes `≥ 0` savings and a row tinted yellow (`peakDemand == source`) contributes **exactly 0** — chip ≡ Σ per-row state by construction. `[VERIFIED: math]`
- For the reopened ARMAN variant, the `peakScale > 1` rows now contribute 0 (Peak == Source) instead of the phantom `(247² − 209²)` → the chip drops from the phantom 20.6% to the **genuine rounding residual** the user expected. `[VERIFIED: matches CONTEXT worked example]`
- For master rigs with genuine savings, `peakDemand < source` for `peakScale < 1` rows → chip unchanged (the per-row demand equals the old export-out in that regime — see §Regression-safety).

> **Decision the planner must make explicit (and a documented divergence from the export figure):** This rebased chip will **differ from OptimizeDialog's savings %** (which stays export-plan-based, locked) for rigs with `peakScale > 1` rows. That is intentional and correct: the section chip answers *"how much of this rig's pixels exceed render demand"* (the honest read-model question), while the Optimize dialog answers *"how much will THIS optimize run shrink the files"* (the export question — and for a variant, that run would harmfully under-size). The planner should add a comment documenting this intentional split and confirm the HTML-export consumer (`doc-export.ts` Optimization Config card, which reads `savingsPctMemo`) is acceptable with the read-model figure. **Alternatively** (lower-churn, leaves the latent over-report): keep `savingsPctMemo` export-based and only fix the per-row tint — but then chip ≠ Σ row states, which the CONTEXT discretion explicitly wants to avoid ("pick the path that guarantees chip ≡ sum of per-row states"). **Recommendation: rebase (first option).** `[ASSUMED: doc-export.ts consumer accepts the new basis — verify the card's wording at plan time]`

> **Layer-3 / arch note:** `enrichWithEffective` is already imported by `AppShell.tsx`'s sibling renderer code and is in `src/renderer/src/lib/` (Layer-3 clean, node-program-included). Using it in the memo keeps the change renderer-only. If the planner prefers to keep using `buildExportPlan` for the row set, note that `buildExportPlan`'s `ExportRow` does NOT carry `peakDemandW/H` and dedups by `sourcePath` — so the cleanest "chip ≡ rows" path is `enrichWithEffective` over `effectiveSummary.regions` (the same row set the panel enriches). `[VERIFIED: enrich-overrides.ts is node-included; AppShell already imports buildExportPlan from the same lib]`

## Research Question 5: Regression-safety proofs

All three guards are **proven by fuzz testing** (`node`, 500k cases) plus closed-form reasoning. `[VERIFIED: node fuzz harness, this session]`

### (a) Genuine-savings rows (`peakScale ≤ 1`) are display-UNCHANGED

Claim: `min(ceil(canonW × safeScale(peakScale × overrideFrac)), actualSource)` ≡ current `peakDisplayW = ceil(canonW × min(safeScale(peakScale × overrideFrac), 1, sourceRatio))` whenever `peakScale × overrideFrac ≤ 1` **and** `actualSource ≥ canonW` (the realistic regime).

- When `rawPeakEff ≤ 1`: `min(safeScale(rawPeakEff), 1, sourceRatio) = safeScale(rawPeakEff)` (the `1` clamp and the `sourceRatio ≥ 1` cap are both inert because `actualSource ≥ canonW ⇒ sourceRatio = actualSource/canonW ≥ 1`). So current `peakDisplayW = ceil(canonW × safeScale(rawPeakEff))`.
- New `peakDemandW = min(ceil(canonW × safeScale(rawPeakEff)), actualSource)`. Since `safeScale(rawPeakEff) ≤ ~1` ⇒ `ceil(canonW × safeScale(rawPeakEff)) ≤ ceil(canonW) ≤ actualSource` (as `actualSource ≥ canonW`), the `min` is inert ⇒ `peakDemandW = ceil(canonW × safeScale(rawPeakEff)) = peakDisplayW`. **Identical.**
- **Fuzz result:** 500,000 cases with `peakScale ≤ 1`, `actualSource ≥ canonW` (integer): **0 divergences, 0 green-state changes.** `[VERIFIED]`
- **Worked check** (CONTEXT example, ARMAN CROWN `canonW=478.5, peakScale=0.44, actualSrc=211`): current `211`, fixed `211` — unchanged (yellow at-limit on the variant). `[VERIFIED]`

> **Why `safeScale` must be retained:** the fuzz showed dropping `safeScale` (computing `min(ceil(canonW × rawPeakEff), actualSource)`) diverges in ~45% of `peakScale ≤ 1` cases. Retaining `safeScale` is what makes the genuine-savings regime byte-identical. **This is the single most important implementation detail for regression safety.** `[VERIFIED]`

### (b) Atlas-source drift / NECK-repack case (`actualSource > canonical`, `peakScale ≤ 1`) stays GREEN

This is the `project_compute_export_dims_canonical_base` lineage: a repacked atlas where `sourceW (atlas-orig) ≠ canonicalW (JSON)`, `actualSource > canonical`, but the rig genuinely renders below source (`peakScale < 1`) — a **real** recoverable savings that MUST stay green.

- Fixed `peakDemandW = min(ceil(canonW × safeScale(peakScale)), actualSource)`. With `peakScale < 1` and `actualSource > canonW`: `ceil(canonW × safeScale(peakScale)) < canonW < actualSource` ⇒ `min` is inert ⇒ `peakDemandW < actualSource` ⇒ **green (`under`).** Preserved.
- **Worked check** (`canonW=100, peakScale=0.8, actualSrc=120`): current `80 GREEN`, fixed `80 GREEN`. **Unchanged.** `[VERIFIED]`

### (c) Override / safety-buffer / source-ratio-cap rows unaffected

- **Override rows:** the render demand uses the same `overrideFrac` (`clampOverride(override)/100`) as the current path; a 50%-of-peak override on GRAND yields `min(ceil(208.5 × safeScale(1.182 × 0.5)), 247) = 124 < 247` → **green, correct** (the user explicitly reduced below demand). `[VERIFIED]`
- **Safety-buffer rows:** the safety buffer (`safetyBufferPercent`) lives in **`buildExportPlan` only** (`export.ts:348-350`, `export-view.ts buildExportPlan`), NOT in `computeExportDims` — the buffer never entered the panel's Peak display and still does not. The export figure (and OptimizeDialog) keep the buffer; the render-demand display is buffer-free, exactly as today. **No interaction.** `[VERIFIED: computeExportDims takes no buffer param]`
- **Source-ratio-cap rows:** the export `outW/outH` keep their `sourceRatio` cap (`export-view.ts:231`); the new `peakDemand` caps at `actualSource` directly (equivalent ceiling, no per-axis distortion). For `peakScale > 1` no-drift master rows (`actualSource == canonical`), `peakDemandW = min(ceil(canon × peakScale), canon) = canon == source` → **yellow at-limit, correct** (master GRAND example: `417 → 417`). `[VERIFIED]`

### Exact rows/conditions the regression test MUST lock

| # | Row class | Inputs (`canonW, peakScale, actualSrc, override?`) | Expected (current → fixed) | Must assert |
|---|-----------|---|---|---|
| R1 | **The bug** — variant `peakScale>1`, drift | `208.5, 1.182, 247, none` | `209 GREEN → 247 (no green; atLimit)` | peakDemand==source, state==`atLimit` |
| R2 | Genuine master savings `peakScale<1` | `478.5, 0.44, 211, none` | `211 → 211` (unchanged) | display unchanged, state==`atLimit` (variant) / `under` if actualSrc>peakDemand |
| R3 | NECK-repack drift, real savings | `100, 0.8, 120, none` | `80 GREEN → 80 GREEN` (unchanged) | peakDemand<source, state==`under` |
| R4 | Master `peakScale>1` no drift | `417, 1.182, 417, none` | `417 → 417` (unchanged) | peakDemand==source, state==`atLimit` |
| R5 | Clean `peakScale==1` no drift (TRIANGLE) | `153, 1.0, 153, none` | `153 → 153` | state==`atLimit` |
| R6 | Override <100% on `peakScale>1` row | `208.5, 1.182, 247, 50` | `124 → 124` (still green) | peakDemand<source, state==`under` |
| R7 | Rounding asymptote `peakScale≈0.998` | `200, 0.998, 200, none` | `200 → 200` (unchanged) | state==`atLimit`, no green |
| R8 | D-03 contract: equal rendered integers | peakDemand==source after rounding | — | `rowState(N, N) === 'atLimit'` (no green) |

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Render-demand derivation | A new panel-side formula duplicating override/safeScale/cap math | Extend `computeExportDims` (single source of truth) | The panel already consumes it via `enrich-overrides.ts`; duplicating risks drift between Peak demand, Scale, and OptimizeDialog `[VERIFIED]` |
| "Is this a variant" detection | Heuristics on path/`@{s}x`/dims | Nothing — D-02 is universal | CONTEXT D-02 rejects detection; the math is correct for all rigs `[CITED: CONTEXT D-02]` |
| Sub-pixel tint tolerance | An epsilon knob | Pure integer compare of rendered dims | CONTEXT Deferred rejects epsilon; integers are what the user sees `[CITED: CONTEXT D-03 + Deferred]` |
| Reading source dim for the tint | Recomputing from `sourceW` or floats | `row.actualSourceW ?? row.sourceW` (the `originalSizeLabel` basis) | Must compare the exact rendered integer `[VERIFIED: analyzer.ts:132]` |

## Common Pitfalls

### Pitfall 1: Dropping `safeScale` from the render-demand formula
**What goes wrong:** Changes display for ~45% of `peakScale ≤ 1` (genuine-savings) rows.
**Why:** `safeScale` (ceil-to-thousandth) is the rounding the current display uses; omitting it shifts the ceil boundary.
**How to avoid:** Keep `safeScale(rawPeakEff)` exactly as the existing `peakDisplay` path uses it. The ONLY removed operation is the `min(…, 1)` canonical clamp.
**Warning signs:** The regression test (R2/R3/R5/R7) shows any divergence on `peakScale ≤ 1` rows. `[VERIFIED: fuzz]`

### Pitfall 2: Rebasing the Scale column (`displayScale`) onto render demand
**What goes wrong:** Changes the meaning of the Scale column (it answers "how much will export reduce the source PNG"), which is a separate locked contract (2026-05-05).
**How to avoid:** Leave `displayScale = outW / actualSource` (export-based) untouched. The fix only changes Peak W×H, the tint, and the savings chip.
**Warning signs:** Scale column values change on `peakScale > 1` rows.

### Pitfall 3: Leaking the render-demand into the export path
**What goes wrong:** A texture is written at the render-demand size instead of canonical → that IS rejected Option A.
**How to avoid:** Only `enrich-overrides.ts` (display) reads the new fields. `buildExportPlan` (both copies) is untouched. Verify `tests/core/export.spec.ts` byte-parity stays green.
**Warning signs:** Any diff in `outW/outH`, OptimizeDialog pre-flight, or export.spec.ts.

### Pitfall 4 (CI landmine): renderer `.ts` test importing renderer-src trips `typecheck:node` (TS6307)
**What goes wrong:** A `.ts` test under `tests/` importing a renderer module not in `tsconfig.node.json`'s include → TS6307, invisible to vitest-only self-check.
**Why:** `tsconfig.node.json` globs `tests/**/*.ts` into the no-DOM node program.
**How to avoid:** `computeExportDims`/`enrichWithEffective` ARE in the node include (`src/renderer/src/lib/**/*.ts`) → a `.ts` test importing **only those** is safe (existing `tests/regression/path-indirection.spec.ts` and `tests/core/export.spec.ts` do exactly this). But a test importing the **panel** (`rowState` from `GlobalMaxRenderPanel.tsx`) must be `.spec.tsx` (or the panel `.tsx` is auto-excluded and `rowState` must be extracted to a pure `lib/*.ts` helper — see Validation Architecture).
**Warning signs:** `npm run typecheck:node` RED after adding a `.ts` test. `[VERIFIED: tsconfig.node.json + memory feedback_renderer_ts_helper_test_breaks_typecheck_node]`

## Code Examples

### The verified false-green fix (the core math)
```ts
// Source: this session's node verification (matches CONTEXT worked example)
const safeScale = (s: number) => Math.ceil(s * 1000) / 1000;
// rawPeakEff = peakScale × overrideFrac  (already computed at export-view.ts:266)
const peakDemandW = Math.min(Math.ceil(canonW * safeScale(rawPeakEff)), actualSrcW);
// ARMAN GRAND: min(ceil(208.5 × 1.182), 247) = min(247, 247) = 247 == source → atLimit (no green)
// CROWN:       min(ceil(478.5 × 0.44),  211) = min(211, 211) = 211           → atLimit (unchanged)
// NECK repack: min(ceil(100   × 0.8),   120) = min(80, 120)  = 80  < 120     → under (green, preserved)
```

### Source integer the tint must compare against
```ts
// Source: src/core/analyzer.ts:132 — what the Source W×H cell renders
originalSizeLabel: `${actualSourceW ?? p.sourceW}×${actualSourceH ?? p.sourceH}`,
// ⇒ rowState's source arg MUST be (row.actualSourceW ?? row.sourceW)  [already is, :1013/:1137]
```

## Validation Architecture

> `workflow.nyquist_validation` is not disabled in `.planning/config.json` for this repo (the project runs Nyquist gates); this section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.x (run via `npm run test`) `[VERIFIED: vitest.config.ts present]` |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/regression/variant-phantom-green.spec.ts` (new file) |
| Full suite command | `npm run test` |
| Typecheck gates | `npm run typecheck:node` **and** `npm run typecheck:web` (both must pass — CI-surface landmine) |

### Phase Requirements → Test Map
(No formal REQ IDs — REQUIREMENTS.md was git-rm'd at v1.7 close. Must-haves derived from D-01/D-02/D-03.)

| Must-have | Behavior | Test Type | Automated Command | File Exists? |
|-----------|----------|-----------|-------------------|--------------|
| D-01 false-green killed | `peakScale>1, actualSource>canonical` row → peakDemand == source, no green, savings → genuine residual | unit (pure helper) | `npx vitest run tests/regression/variant-phantom-green.spec.ts -t "D-01"` | ❌ Wave 0 |
| D-01 master regression | `peakScale<1` master → display unchanged, green preserved | unit | same file, `-t "regression"` | ❌ Wave 0 |
| D-02 universal | NECK-repack `peakScale≤1, actualSource>canonical` stays green | unit | same file, `-t "drift"` | ❌ Wave 0 |
| D-03 tint integers | `rowState` green only when rendered integers strictly differ; equal → atLimit | unit | same file, `-t "D-03"` | ❌ Wave 0 |
| chip ≡ rows | `savingsPctMemo` (rebased) == Σ per-row demand savings | unit | same file, `-t "savings"` | ❌ Wave 0 |
| No export leak | `tests/core/export.spec.ts` byte-parity still green | existing | `npx vitest run tests/core/export.spec.ts` | ✅ |

### Recommended test design (fixture choice: SYNTHETIC DisplayRow/RegionRow — no committed fixture)

**Synthesize `RegionRow`/`DisplayRow` objects in the test** rather than committing a reopened-variant fixture. Rationale:
- The fix operates purely on already-loaded scalars (`peakScale`, `canonicalW/H`, `actualSourceW/H`, `dimsMismatch`). A synthetic row with `{canonicalW: 208.5, actualSourceW: 247, peakScale: 1.182, dimsMismatch: true}` exercises the exact GRAND condition deterministically — no atlas/PNG parse, no sampler, no rig.
- **Avoids the SAFE-01 denylist co-requirement entirely** (no new committed fixture dir). `[VERIFIED: a synthetic test commits no fixture]`
- A real round-trip would need `loadSkeleton → sampleSkeleton → buildSummary → enrichWithEffective`, which is slow and re-tests already-covered upstream layers; the bug is in the read-model derivation, so test it there.

**Three test cases (all drive `enrichWithEffective` + `rowState` directly):**
1. **(i) Phantom-green killed:** synthetic row GRAND `{canonicalW:208.5, canonicalH:63, actualSourceW:247, actualSourceH:75, peakScale:1.182, dimsMismatch:true, sourceW:247, sourceH:75}` → assert `peakDemandW === 247`, `rowState(peakDemandW, actualSourceW) === 'atLimit'` (NOT `'under'`), and (savings memo helper) the row contributes 0 savings.
2. **(ii) Master regression:** synthetic row CROWN `{canonicalW:478.5, actualSourceW:211, peakScale:0.44, dimsMismatch:true}` → assert `peakDemandW` equals the **current** `peakDisplayW` (call both, assert equality), green/at-limit state preserved.
3. **(iii) D-03 tint unit:** call `rowState(N, N, false)` and `rowState(N-1, N, false)` for representative N → assert `'atLimit'` and `'under'` respectively; assert no float path (inputs are the integers from `peakDemandW` and `actualSourceW ?? sourceW`).

**File naming + location (CI landmine handling):**
- Tests (i) and (ii) import `enrichWithEffective`/`computeExportDims` from `src/renderer/src/lib/` only → **safe as `.spec.ts`** under `tests/regression/` (both modules are in `tsconfig.node.json`'s `src/renderer/src/lib/**/*.ts` include; precedent: `tests/regression/path-indirection.spec.ts`). `[VERIFIED]`
- Test (iii) needs `rowState`, which is **not exported** and lives in the panel `.tsx`. **Recommendation: extract `rowState` to a pure helper `src/renderer/src/lib/row-state.ts`** (zero React/DOM — it is already pure) and import it from the panel + the test. That keeps the whole spec a single `.spec.ts` in the node program and avoids both the `.tsx`-test path and a `tsconfig.node.json` exclusion. If extraction is undesired, the alternative is a `.spec.tsx` that imports the panel — but `rowState` is still unexported, so extraction (or exporting it) is required regardless. **Extract to `lib/row-state.ts` — cleanest, Layer-3 pure, node-included.** `[VERIFIED: rowState body is pure; lib/ is node-included]`

### Sampling Rate
- **Per task commit:** `npx vitest run tests/regression/variant-phantom-green.spec.ts && npm run typecheck:node && npm run typecheck:web`
- **Per wave merge:** `npm run test`
- **Phase gate:** full suite green + both typechecks green before `/gsd-verify-work`; manual UAT (below) before phase close.

### Wave 0 Gaps
- [ ] `tests/regression/variant-phantom-green.spec.ts` — covers D-01/D-02/D-03 + chip≡rows (synthetic rows, no fixture)
- [ ] `src/renderer/src/lib/row-state.ts` — extract pure `rowState` from `GlobalMaxRenderPanel.tsx` so test (iii) imports it cleanly (Layer-3, node-included)
- [ ] No framework install needed (vitest present)
- [ ] No new committed fixture dir ⇒ **no SAFE-01 denylist change required** (synthetic-row approach). If the planner instead chooses a real round-trip fixture, note `fixtures/spineboy_4.3/` and `fixtures/SCALE_BAKE_*` prefixes are ALREADY in `SAFE01_EXCLUDED_PREFIXES` — only a *brand-new* dir would need a denylist entry.

### Manual UAT (owner, post-merge — local paths, not committed)
- Reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json` → GRAND/L_SKIRT no longer green; section chip ≈ rounding residual, not 20.6%.
- Reopen `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json` → L_SKIRT 0.877× green gone.
- Reopen a **master** with `peakScale<1` (e.g. `/Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json`) → genuine green unchanged; chip unchanged.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| vitest | all tests | ✓ | 3.x (`vitest.config.ts` present) | — |
| TypeScript / tsc | `typecheck:node` + `typecheck:web` gates | ✓ | repo-pinned | — |
| node | fuzz/repro (research-time only) | ✓ | local | — |

No external services, no IPC, no PNG/atlas decode required for the fix or its tests (synthetic-row approach). The phase is code-only on the renderer read-path.

## Security Domain

> `security_enforcement` is not disabled in config; included for completeness. This is a renderer-side display-math change with **no new input surface, no IPC, no file I/O, no untrusted-data parsing.**

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | no (new) | The fix consumes already-validated, already-loaded numeric scalars (`peakScale`, dims) produced by the existing loader/sampler; no new external input is parsed. The existing path-traversal guard (`relativeOutPath`, `export-view.ts:136`) is in the FROZEN export path and untouched. |
| V6 Cryptography | no | n/a |
| V2/V3/V4 (auth/session/access) | no | Desktop app, no auth surface in scope |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Integer/float overflow in dim math | Tampering | Inputs are loader-bounded image dims (≤ a few thousand px); `Math.ceil`/`Math.min` are safe in JS Number range. No change in attack surface vs current `computeExportDims`. |

No new threat surface introduced.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Peak column = world demand (intent) | Peak column = export-clamped dims (drifted impl) | post-2026-05-05 (silent drift via `computeExportDims` `peakDisplayEff` clamp) | The drift is the bug; this phase restores the original intent |

**Deprecated/outdated:** the comment trail at `export-view.ts:251-264` and `enrich-overrides.ts:26-30` ("Peak W×H shows EXPORT dims") becomes stale once D-01 lands — update those docblocks to "Peak W×H shows render demand capped at source; outW/outH remain the export dims."

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The HTML-export Optimization Config card (`doc-export.ts`) consuming `savingsPctMemo` is acceptable with the rebased read-model figure | RQ4 savings chip | LOW — if the card must show the export figure, keep a second export-based memo for the card only; verify the card's wording at plan time |
| A2 | `workflow.nyquist_validation` is enabled (config not read this session) | Validation Architecture | LOW — if disabled, the section is still good guidance; planner should confirm via `.planning/config.json` |
| A3 | The single-axis (W-only) `rowState` compare remains acceptable post-fix | RQ3 | LOW — matches existing convention; a two-axis compare is out of scope |

## Open Questions

1. **ExtrapolationIcon tooltip wording** (`GlobalMaxRenderPanel.tsx:575`: "export capped at canonical")
   - What we know: it renders for `peakScale > 1`; after D-01 the Peak cell shows source-capped demand, not the canonical clamp.
   - What's unclear: exact replacement copy.
   - Recommendation: update to e.g. "Spine rig peak: {x}× source — already sized to render demand" (a copy-only task; no behavior change). Flag for planner.

2. **Scale column (`displayScale`) treatment**
   - What we know: it is export-based (`outW/actualSource`) and CONTEXT scope names only Peak/tint/chip.
   - Recommendation: leave unchanged (export-based). Decided in RQ1; planner should confirm explicitly.

## Sources

### Primary (HIGH confidence)
- Codebase (read this session): `src/renderer/src/lib/export-view.ts` (computeExportDims + buildExportPlan), `src/renderer/src/lib/enrich-overrides.ts`, `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` (rowState, cells, call sites), `src/renderer/src/components/AppShell.tsx` (savingsPctMemo, override dialog), `src/renderer/src/modals/OptimizeDialog.tsx` (savings formula), `src/renderer/src/components/DimsBadge.tsx`, `src/core/analyzer.ts` (originalSizeLabel, toRegionRow), `src/core/loader.ts` (canonical/actualSource derivation), `src/shared/types.ts` (DisplayRow/RegionRow), `tsconfig.node.json`, `tests/safe01/discover-fixtures.ts`, `tests/regression/path-indirection.spec.ts`, `tests/core/export.spec.ts`.
- `.planning/debug/variant-peaks-differ-green.md` — root-cause diagnosis, GRAND/L_SKIRT walk-through, "do NOT re-optimize variants" warning, eliminated hypotheses.
- `.planning/phases/54-.../54-CONTEXT.md` — locked D-01/D-02/D-03, canonical refs, research flags.
- **Node fuzz verification (this session):** 500k-case proof that `min(ceil(canonW × safeScale(rawPeakEff)), actualSource)` ≡ current display for `peakScale ≤ 1, actualSource ≥ canonical` (0 divergences); and that dropping `safeScale` diverges in ~45% of cases.

### Secondary (MEDIUM confidence)
- Project memories: `project_peak_anchored_invariants`, `project_compute_export_dims_canonical_base`, `feedback_renderer_ts_helper_test_breaks_typecheck_node`, `feedback_new_committed_fixtures_need_safe01_denylist`, `feedback_verify_whole_ci_surface_locally`, `project_multi_scale_peak_bone_world_scale`.

## Metadata

**Confidence breakdown:**
- Code seam (RQ2): HIGH — every consumer of `computeExportDims` enumerated; export path proven isolated.
- Semantic reconciliation (RQ1): HIGH — the invariant-vs-comment conflict resolved by identifying the silent drift; chosen option is least-surprising and restores the locked invariant.
- D-03 (RQ3): HIGH — verified the exact rendered integers (`originalSizeLabel` = `actualSourceW`); the current compare already uses the right basis.
- savings chip (RQ4): MEDIUM-HIGH — rebase approach guarantees chip≡rows; one assumption (A1) about the doc-export consumer to confirm at plan time.
- Regression safety (RQ5): HIGH — fuzz-proven (500k cases, 0 divergences in realistic regime) + closed-form.
- Validation Architecture: HIGH — framework present, synthetic-row approach sidesteps fixture/SAFE-01 risk, CI landmine handled via `lib/row-state.ts` extraction.

**Research date:** 2026-05-25
**Valid until:** ~2026-06-24 (stable — renderer read-model logic; no fast-moving deps). Re-verify if `computeExportDims`, `enrich-overrides.ts`, or `tsconfig.node.json` change before planning.
