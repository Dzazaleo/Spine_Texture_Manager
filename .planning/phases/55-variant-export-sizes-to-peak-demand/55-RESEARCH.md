# Phase 55: Variant Export Sizes to Peak Demand (Up to No-Upscale Ceiling) - Research

**Researched:** 2026-05-26
**Domain:** Export math seam (`src/core/export.ts:279`) — single-line clamp lift + option threading
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-A (Universal `1/s` clamp):** Replace the literal `1` in `Math.min(safeScale(bufferedScale), 1)` at `src/core/export.ts:279` with `1/s` unconditionally. For masters `s = 1` so `1/s = 1` — byte-identical by construction. No `if variant` branch.
- **L-02 (Phase 54 D-02, carries forward):** No "is this a variant" detection. `s` is a pure-math input to the clamp formula, not a categorical flag.
- **D-D (Accept the churn):** No migration tool. Already-exported variants keep old PNGs and may still trip the ExtrapolationIcon until the user re-exports.
- **D-F (Keep Phase 54 tooltip wording unchanged):** `extrapolationTooltip()` in `src/renderer/src/lib/row-state.ts` stays as-is.
- **D-UI:** Ships `--skip-ui`. Pure export-math seam + test updates; no new dialog, toolbar, panel, or copy surface.
- **D-B (Buffer ordering):** Buffer applies BEFORE the clamp (`raw → bufferedScale → safeScale → clamp`). Only the clamp's value changes (`1` → `1/s`). Math order locked verbatim from Phase 30 CONTEXT D-09 step 3.

### Claude's Discretion

- **Threading `s` into `buildExportPlan`:** Whether to add `BuildExportPlanOptions.variantScale?: number` (default 1.0, master = omit), OR compute the clamp at the call site and pass it in, OR factor the clamp into a small pure helper. Researcher to recommend; planner to pick.
- **Test fixture choice for the new variant-with-`peakScale>1` row coverage:** Synthesize a `DisplayRow`/`SkeletonSummary` test double in-suite (Phase 54's approach — avoids SAFE-01 denylist churn) rather than committing TEST_ARMAN.
- **`computeExportDims` (renderer) parity:** Confirm the renderer-display path stays as the Phase 54 read-model (true render demand, NOT export-clamped) and no parity tests break.

### Deferred Ideas (OUT OF SCOPE)

- One-shot variant reconciliation tool (`/gsd-reoptimize-variant` or similar).
- Sweep of the ExtrapolationIcon tooltip wording for variants.
- A "variant export ceiling" debug HUD / dev-toggle showing the binding clamp per row.
</user_constraints>

---

## Summary

Phase 55 is a **one-line change** with a **test update surface**. The lift site is `src/core/export.ts:279` where `Math.min(safeScale(bufferedScale), 1)` becomes `Math.min(safeScale(bufferedScale), 1 / variantScale)`, with `variantScale` arriving via a new optional field on `BuildExportPlanOptions` (default `1.0`). For masters `s = 1` → `1/s = 1` → math is equivalent → zero byte change to any master export. The renderer's `computeExportDims` is unchanged (Phase 54 read-model is deliberately separate from the export path). The parity test block in `tests/core/export.spec.ts` asserts structural identity between `src/core/export.ts` and its renderer mirror `src/renderer/src/lib/export-view.ts`; BOTH files must receive the identical change + the new option field. The `tests/core/variant-sizing.spec.ts` file is the primary test requiring updates: its `BIG` region (peakScale 2.0) currently asserts the old `min(..., 1)` ceiling; after the lift a variant at `s = 0.5` may exceed 1.0 but is still capped at `1/s = 2` (which still clamps via `sourceRatio` for clean-atlas rows where `sourceRatio = 1`). Read carefully: the new headroom only matters when `s × master_peakScale > 1` AND `sourceRatio > 1` (i.e., the variant PNG has grown beyond canonical), which only occurs for pre-Phase-55 imports of summaries with pre-existing `actualSourceW > canonicalW` drift.

**Primary recommendation:** Add `BuildExportPlanOptions.variantScale?: number` (default `1.0`). Edit exactly two files with identical function-body changes: `src/core/export.ts` and `src/renderer/src/lib/export-view.ts`. Thread `variantScale: s` from `src/main/variant-export.ts:193`. Update `tests/core/variant-sizing.spec.ts` test comments and assertion formula. Add a new `tests/core/variant-sizing.spec.ts` test block for the `peakScale > 1/s` ceiling scenario. All other test files stay byte-identical.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `effScale` clamp lift | Core (`src/core/export.ts`) | Renderer mirror (`src/renderer/src/lib/export-view.ts`) | Pure math; Layer-3 enforced by arch.spec.ts |
| `s` threading / trust-boundary validation | Main (`src/main/variant-export.ts`) | — | Already owns the `VariantScaleError` guard and `safeBuffer` coercion |
| Export plan consumption (runExport/runRepack) | Main workers | — | Read `ExportRow.outW/outH` from the plan; no worker changes needed |
| Display read-model (`computeExportDims`) | Renderer (`src/renderer/src/lib/export-view.ts`) | — | Phase 54 D-01 separated display (true demand) from export (clamped) — NOT touched |
| Test coverage for the new ceiling | Core spec (`tests/core/variant-sizing.spec.ts`) | — | Synthetic test-double approach (Phase 54 precedent) |

---

## Standard Stack

No new libraries. This phase edits existing source files only.

| Component | File | Role in Phase 55 |
|-----------|------|-------------------|
| `buildExportPlan` | `src/core/export.ts` | Lift site; add `variantScale` to `BuildExportPlanOptions` |
| Renderer mirror | `src/renderer/src/lib/export-view.ts` | Byte-identical mirror of `buildExportPlan` — must receive IDENTICAL edit |
| `scaleSummaryPeaks` | `src/core/scale-summary-peaks.ts` | Upstream of the change; untouched |
| `exportOneVariant` | `src/main/variant-export.ts` | Only variant call site; adds `variantScale: s` to `buildExportPlan` opts |
| Phase 48 oracle | `tests/scale-bake.spec.ts` | Pinned — zero bake changes, stays byte-identical |

---

## D-C Verification: `1/s` and `sourceRatio` Interaction

**Finding: VERIFIED [CITED: src/core/export.ts:279-320 — read directly]**

The current pipeline at lines 279-320 is:

```
downscaleClampedScale = Math.min(safeScale(bufferedScale), 1)       // line 279
sourceRatio = actualSourceW/canonicalW (when dimsMismatch)            // lines 300-303
cappedEffScale = Math.min(downscaleClampedScale, sourceRatio)         // line 304
isCapped = downscaleClampedScale > sourceRatio                        // line 305
```

After Phase 55 the pipeline becomes:

```
const vs = opts.variantScale ?? 1.0;
downscaleClampedScale = Math.min(safeScale(bufferedScale), 1 / vs)   // lift site
sourceRatio = ... (unchanged)                                          // unchanged
cappedEffScale = Math.min(downscaleClampedScale, sourceRatio)         // unchanged
isCapped = downscaleClampedScale > sourceRatio                        // unchanged
```

**Case analysis for the pre-optimized-master (dimsMismatch) scenario:**

Scenario: master `actualSource < canonical × peakScale` — a NECK-repack-style row where the on-disk PNG was already shrunk below canonical. Example: canonical 100px, actualSource 80px → `sourceRatio = 0.8`. Variant at `s = 0.5`, master peakScale 0.6 → scaled peakScale 0.3 → `bufferedScale = 0.3` → `downscaleClampedScale = min(safeScale(0.3), 1/0.5=2) = 0.3`. Then `cappedEffScale = min(0.3, 0.8) = 0.3`. The `sourceRatio` cap is NOT hit (0.3 < 0.8). No regression.

Scenario: master `peakScale = 5`, variant `s = 0.5` → scaled peak = 2.5 → `downscaleClampedScale = min(safeScale(2.5), 2) = 2`. Then `sourceRatio` for a clean-atlas (no dimsMismatch) row = `Infinity` → `cappedEffScale = min(2, Infinity) = 2`. The `sourceRatio` cap is NOT hit. But `outW = ceil(canonicalW × 2)` → output is 2× canonical. **This is correct for a variant whose master source is 1× canonical**: the master source IS 1× canonical so the master PNG at 1× maps to canonical dims, and the variant at 2× STILL does not exceed the master source (because `1/s = 2 = 1/0.5`). The "no-upscale relative to master source" contract is honored: `outW = ceil(canonicalW × 2) = 2 × canonicalW = 2 × masterSourceW`. The variant output is exactly the master source size — which IS the ceiling. Correct.

Scenario: master with actualSource drift (NECK-type). Canonical 100, actualSource 80, master peakScale 0.6. `sourceRatio = 0.8`. Variant `s = 0.5`, scaled peak = 0.3. `downscaleClampedScale = min(0.3, 2) = 0.3`. `cappedEffScale = min(0.3, 0.8) = 0.3`. `isCapped = false`. The `1/s` ceiling does not bind (0.3 << 2); `sourceRatio` is the tighter ceiling — as expected. No regression.

Scenario: master with actualSource drift AND high master peakScale. Canonical 100, actualSource 80, master peakScale 2.0. `sourceRatio = 0.8`. Variant `s = 0.5`, scaled peak = 1.0. `downscaleClampedScale = min(safeScale(1.0), 2) = 1.0`. `cappedEffScale = min(1.0, 0.8) = 0.8`. `isCapped = true` (because `1.0 > 0.8`). `outW = ceil(100 × 0.8) = 80 = actualSourceW`. **Correct**: `sourceRatio` is the tighter ceiling (0.8 < 2) and binds. The `1/s = 2` is harmless headroom. No regression to the NECK repack / `compute_export_dims_canonical_base` invariant.

**Conclusion:** `sourceRatio` is always ≤ `1/s` when it makes physical sense to bind (when the on-disk source is already smaller than canonical). The `Math.min(downscaleClampedScale, sourceRatio)` at line 304 — which is UNCHANGED — correctly enforces "never exceed actualSource dims" without any interaction with the `1/s` lift. D-C is verified. [VERIFIED: read src/core/export.ts:279-320 directly]

---

## D-E Test Matrix: Byte-Identity vs Update Manifest

### Category A: MUST Stay Byte-Identical (No Changes)

These tests assert master (`s = 1`) behavior or variant rows where `s × master_peakScale ≤ 1`. Since `1/1 = 1`, all master assertions are unaffected by construction.

| File | Test (describe / it) | Why Byte-Identical |
|------|----------------------|--------------------|
| `tests/core/export.spec.ts` | All master-only tests (case a, b, c, d, e, f, g, Round 5, DIMS-03, BUFFER-01..03, parity block) | `s = 1` default → `1/s = 1` → no change |
| `tests/core/export.spec.ts` | Gap-Fix #1: peakScale 1.5, 5.0, dedup-0.8-5.0 tests | Master path; `variantScale` = 1 (default) → `1/s = 1` → clamp to 1 still fires |
| `tests/core/variant-sizing.spec.ts` | `'no overrides: variant row demand = min(safeScale(s × master_peak), 1)'` for SMALL (peak 0.4, s=0.5 → 0.2 < 1) | `s × master_peakScale = 0.2 ≤ 1`; clamp never binds either way |
| `tests/core/variant-sizing.spec.ts` | Override test for BIG (peak 2.0) with pct 150, s = 0.5: `expectedEff = min(safeScale(1.5), 1) = 1.0` | Clamp value is 1 today AND is `1/s = 2` after — `safeScale(1.5) = 1.5` clamps to `min(1.5, 2) = 1.5` → **this assertion CHANGES**; see Category B |
| `tests/scale-bake.spec.ts` | ALL tests (8 rigs × 3 scales) | Bake not touched; stays green unchanged |
| `tests/regression/variant-phantom-green.spec.ts` | ALL (R1–R10) | Tests `computeExportDims` (display path); export path untouched |
| `tests/main/variant-dropin-faithful.spec.ts` | ALL | Tests geometric oracle + cross-resolve; does not assert specific export dims |
| `tests/main/variant-batch-faithful.spec.ts` | ALL | Same oracle pattern |
| `tests/main/variant-package-layout.spec.ts` | ALL | Tests folder/file layout, not dims |
| `tests/main/variant-scale-guard.spec.ts` | ALL | Tests the `VariantScaleError` guard |
| `tests/main/variant-source-immutable.spec.ts` | ALL | Tests non-mutation of source |
| `tests/main/variant-token-equivalence.spec.ts` | ALL | Tests `formatScaleToken` |
| `tests/renderer/variant-*.spec.tsx` | ALL | Renderer component tests; no export-math assertions |

### Category B: WILL Need Updates

These tests assert variant output dims for rows where `s × master_peakScale > 1` AND the old clamp of `1` was the binding constraint but the new `1/s` ceiling gives more headroom.

| File | Test | What Changes |
|------|------|--------------|
| `tests/core/variant-sizing.spec.ts` | `'no overrides: variant row demand...'` for BIG (peak 2.0, s=0.5 → scaled 1.0) | The test's `expectedEff = Math.min(safeScale(s * master.peakScale), 1)` formula hardcodes `1` as the clamp. After Phase 55, the correct formula is `Math.min(safeScale(s * master.peakScale), 1/s)`. For BIG at `s = 0.5`: `safeScale(0.5 × 2.0) = safeScale(1.0) = 1.0`, then `min(1.0, 1/0.5=2.0) = 1.0`. Result is the **same** (1.0 < 2.0 so the `1/s` ceiling still does not bind in this particular case). The comment `'BIG: master clamps to 1.0; variant 0.5× → 1.0'` remains accurate. The assertion formula changes semantically but yields the same number for this specific fixture. **However**, the test's comment `'buildExportPlan's <=1.0 clamp acts on the SCALED demand'` becomes inaccurate for the new ceiling. The comment should be updated to reference `1/s`. |
| `tests/core/variant-sizing.spec.ts` | Override test: `expectedEff = Math.min(safeScale(linearDemand), 1)` for BIG, s=0.5, pct=150 → linearDemand=1.5 | Today: `min(safeScale(1.5), 1) = 1.0`. After Phase 55: `min(safeScale(1.5), 1/0.5=2) = min(1.5, 2) = 1.5`. **This assertion CHANGES.** The expected `effectiveScale` changes from `1.0` to `1.5`. The negative proof `wrong = s × clamp((pct/100)×peak) = 0.5 × 1.0 = 0.5` still diverges from the new `1.5`, so the negative guard remains valid. The description line '`expectedEff = 1.0`' and the comment that proves the linear interpretation still hold structurally — but the expected value and the actual `outW` assertion change. |
| `tests/core/variant-sizing.spec.ts` | New test block needed | A new test proving `s × master_peakScale > 1` produces `outW = ceil(canonicalW × s × master_peakScale)` (i.e., the demand, not the canonical ceiling) for clean-atlas rows, AND proves `1/s` still caps at master-source when `s × master_peakScale > 1/s`. |

### Category C: Phase 48 Oracle (untouched, must stay green)

| File | Status |
|------|--------|
| `tests/scale-bake.spec.ts` | Bake is completely untouched. Oracle stays green by construction. |

### Renderer Parity Block — Critical Subtlety

The parity block in `tests/core/export.spec.ts` asserts structural identity between `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` via regex greps. The critical parity tests:

1. `'Phase 30 BUFFER-01 — both files declare safetyBufferPercent on BuildExportPlanOptions'` — the regex is `/safetyBufferPercent\?\s*:\s*number/`. Adding `variantScale?: number` does NOT break this.
2. `'renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs'` — this dynamic-import test builds with MASTER summaries (no `variantScale` option). The test passes `{ skeletonPath: ... }` without `variantScale` → defaults to 1.0 → byte-identical. **SAFE**.
3. `'Gap-Fix #1 parity: peakScale 1.5 produces outW = sourceW in BOTH'` — uses `buildExportPlan(summary, new Map(), { skeletonPath })` with no `variantScale`. Default 1.0 → `1/1 = 1` → clamp still fires at 1.0 → `outW = sourceW`. **SAFE**.
4. The Phase 22 behavioral parity tests all use the 4-arg (or opts-without-variantScale) call shape. **SAFE** because of the default.

**Conclusion:** All existing parity tests stay byte-identical. The new `variantScale?: number` option must appear in BOTH `BuildExportPlanOptions` declarations (one in each file) to satisfy any future grep for the field. No existing parity grep will fail.

---

## Threading Recommendation (Claude's Discretion)

**Recommendation: `BuildExportPlanOptions.variantScale?: number` (default 1.0)**

Rationale:
- Matches the `safetyBufferPercent?: number` precedent (Phase 30) exactly — same shape, same position in `opts`, same trust-boundary validation pattern (main validates before threading).
- The trust boundary is already validated: `src/main/variant-export.ts:96` guards `s <= 0 || s >= 1` via `VariantScaleError`. The option receives a value that has already passed that guard.
- Master path omits the option entirely → `opts.variantScale ?? 1.0` → `1/1.0 = 1` → byte-identical. No master-side edit needed.
- One call-site edit: `src/main/variant-export.ts:193` where `buildExportPlan(scaleSummaryPeaks(summary, s), effectiveOverrides, { skeletonPath: ..., safetyBufferPercent: safeBuffer })` gains `variantScale: s`.
- Layer-3 clean: `variantScale` is a pure number; no fs/DOM/spine-core import added.

**Rejected alternatives:**
- Positional `s` parameter: breaks every existing call site's argument count. Invasive.
- `clampForVariant(s)` helper: the clamp value (`1/s`) is trivial; factoring it adds a file without reducing complexity.

---

## Architecture Patterns

### The Lift (one line, two files)

The canonical edit in `src/core/export.ts`:

```typescript
// BEFORE (line 279):
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1);

// AFTER:
const vs = opts.variantScale ?? 1.0;
const downscaleClampedScale = Math.min(safeScale(bufferedScale), 1 / vs);
```

The `opts.variantScale ?? 1.0` computation is placed BEFORE line 279 (e.g., just before the loop body, alongside `const bufferPct = opts.safetyBufferPercent ?? 0`). The renderer mirror `src/renderer/src/lib/export-view.ts` receives the BYTE-IDENTICAL change to its `buildExportPlan` body.

### Worked Example: TEST_ARMAN 80×40, peakScale 1.02, s=0.5

Inputs to variant `buildExportPlan`: `scaleSummaryPeaks(summary, 0.5)` → scaled peakScale = 0.51; canonical 80×40; no dimsMismatch; `variantScale = 0.5`.

```
rawEffScale    = 0.51 (no override)
bufferedScale  = 0.51 (no buffer)
safeScale(0.51) = 0.51
vs             = 0.5 → 1/vs = 2.0
downscaleClampedScale = min(0.51, 2.0) = 0.51  ← NOT clamped by 1/s
sourceRatio    = Infinity (no dimsMismatch)
cappedEffScale = min(0.51, Infinity) = 0.51
outW           = ceil(80 × 0.51) = 41
outH           = ceil(40 × 0.51) = 21
```

On reopen, `actualSourceW = 41`, `canonicalW = 40` (baked), `peakDemandW = min(ceil(40 × 1.02), 41) = 42` → snap: 42 - 41 = 1 → snapped to 41 → `atLimit`. No ExtrapolationIcon. Correct.

### Worked Example: High-peakScale with sourceRatio (D-C case)

Master: canonical 100, actualSource 80, peakScale 2.0, dimsMismatch true. Variant s=0.5.

```
scaled peakScale   = 1.0
rawEffScale        = 1.0
bufferedScale      = 1.0
safeScale(1.0)     = 1.0
vs                 = 0.5 → 1/vs = 2.0
downscaleClampedScale = min(1.0, 2.0) = 1.0  ← not clamped by 1/s
sourceRatio        = min(80/100, 80/100) = 0.8   ← tighter ceiling
cappedEffScale     = min(1.0, 0.8) = 0.8          ← sourceRatio binds
isCapped           = true (1.0 > 0.8)
outW               = ceil(100 × 0.8) = 80 = actualSourceW
```

No upscale beyond actual source PNG. D-C confirmed: `sourceRatio` is the tighter ceiling.

### Anti-Patterns to Avoid

- **Do NOT apply safeScale to `1/vs`**: `1/vs` is a ceiling value, not a demand value. Only `bufferedScale` goes through `safeScale`.
- **Do NOT add `if (variantScale !== 1)` branch**: violates D-A (universal) and L-02 (no variant detection).
- **Do NOT change `src/renderer/src/lib/export-view.ts`'s `computeExportDims` function**: that function is the Phase 54 display read-model. It does NOT clamp at `≤ 1` (it removed that clamp in Phase 54 to fix the phantom green). It must NOT receive the `variantScale` option or any Phase 55 math changes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Trust-boundary validation for `variantScale` | Custom validator in `buildExportPlan` | None needed: `variant-export.ts` already guards `0 < s < 1`; `s = 1` master never passes the option; the `?? 1.0` default in `buildExportPlan` handles the omitted case |
| Test fixture for high-peakScale variant | Commit TEST_ARMAN fixture | Synthesize a `SkeletonSummary` test double (Phase 54 pattern); avoids `SAFE01_EXCLUDED_PREFIXES` churn |

---

## Renderer Display Path: computeExportDims Parity Confirmation

**Finding: renderer display path is DELIBERATELY SEPARATE from export path. No parity test will break.** [VERIFIED: read `src/renderer/src/lib/export-view.ts:178-329` directly]

`computeExportDims` in the renderer has TWO separate outputs:
1. `outW/outH / effScale` — the EXPORT-clamped dims (still uses `Math.min(safeScale(rawEffScale), 1)` with canonical `1` clamp). Phase 55 does NOT change this function.
2. `peakDemandW/peakDemandH` — the TRUE render demand (no `≤ 1` clamp; Phase 54 D-01 addition). Phase 55 does NOT change this either.

The parity test `'renderer view buildExportPlan produces IDENTICAL ExportPlan to canonical for representative inputs'` compares `buildExportPlan` (the plan builder, not `computeExportDims`). This test uses master-only summaries (no `variantScale` option) → default 1.0 → same result. SAFE.

There are NO tests that assert "`computeExportDims` produces the same dims as `buildExportPlan`" — the Phase 54 work deliberately made them diverge for the peakScale > 1 display case. The post-Phase-54 design is: `computeExportDims.outW` tracks the export-plan's clamped dims, and `computeExportDims.peakDemandW` tracks true render demand. Phase 55 only changes `buildExportPlan` (the export path), not `computeExportDims` (the display path). The deliberate separation is preserved.

---

## Common Pitfalls

### Pitfall 1: Editing Only One of the Two Files

**What goes wrong:** `src/core/export.ts` is updated but `src/renderer/src/lib/export-view.ts` is not (or vice versa). The parity tests catch the structural divergence, but the behavioral test `'renderer view buildExportPlan produces IDENTICAL ExportPlan'` only runs master-path cases — it will NOT catch variant-path divergence.

**How to avoid:** Edit both files in the same commit. The parity block's regex greps enforce structural identity; add a new regex for the `variantScale` option in `BuildExportPlanOptions`.

### Pitfall 2: Changing `computeExportDims` Instead of `buildExportPlan`

**What goes wrong:** The renderer `computeExportDims` and the core `buildExportPlan` look similar; editing the wrong function changes the display-mode while leaving the export unchanged (or breaks the Phase 54 read-model).

**How to avoid:** Only edit the `buildExportPlan` function body in both files. Leave `computeExportDims` completely untouched.

### Pitfall 3: Placing `const vs = opts.variantScale ?? 1.0` Inside the Region Loop

**What goes wrong:** `variantScale` is a plan-level option, not a per-region value. Reading it inside the `for (const region of summary.regions)` loop on every iteration is wasteful. It also makes the code harder to read — readers expect options to be extracted once at function start.

**How to avoid:** Extract `const vs = opts.variantScale ?? 1.0` once, before the loop, alongside `const bufferPct = opts.safetyBufferPercent ?? 0` (line 263 in `src/core/export.ts`).

### Pitfall 4: Adding `variantScale` Only to Core, Not to Renderer's `BuildExportPlanOptions`

**What goes wrong:** TypeScript compiles the renderer with its OWN `BuildExportPlanOptions` interface (no cross-import). Missing the field in the renderer's interface means the `variantScale: s` call at `variant-export.ts` (which imports from `src/core/export.js`) works fine — but the renderer's `buildExportPlan` copy has no idea about the option, so it silently ignores it via `opts.variantScale ?? 1.0` once that fallback is correct.

**Wait — is this actually a problem?** Yes: the renderer's `buildExportPlan` is called from `AppShell.tsx` for the MASTER export preview panel. It never passes `variantScale`. The option is not needed in the renderer's interface at all for behavioral correctness. BUT: the parity tests check that `BuildExportPlanOptions` in both files are identical. If the core adds the field and the renderer does not, any future regex grep for `variantScale\?` in both files would fail. Add the field to both.

### Pitfall 5: Forgetting `variantScale` in `BuildExportPlanOptions` Docblock

**What goes wrong:** The existing options have JSDoc comments explaining their purpose and validation contract. A bare field with no comment is an orphan.

**How to avoid:** Add a JSDoc comment parallel to `safetyBufferPercent`'s comment, explaining: "Phase 55 — variant scale factor (range (0,1]; default 1.0 for master exports). Used to lift the `effScale` ceiling from `1` to `1/s` so a variant at scale `s` can size outputs up to the master-source ceiling."

### Pitfall 6: Testing with `s = 1` Only

**What goes wrong:** All existing tests use `opts` without `variantScale` (or with `variantScale: 1.0`). A test accidentally passing with the new code because `1/1 = 1` does not validate the new behavior.

**How to avoid:** The new test block MUST use `s < 1` (e.g., `s = 0.5`) AND a master peakScale where `s × master_peakScale > 1` (e.g., master peak 2.5). This is the only combination that exercises the new ceiling being higher than 1.

---

## Runtime State Inventory

> Omitted — this is a greenfield code change, not a rename/refactor/migration phase. No runtime state is involved.

---

## Environment Availability

> Step 2.6: SKIPPED — this is a pure `src/core/` code change with no external dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (config: `vitest.config.ts`) |
| Config file | `vitest.config.ts` |
| Quick run command | `npm test -- tests/core/variant-sizing.spec.ts tests/core/export.spec.ts` |
| Full suite command | `npm test` |
| Typecheck commands | `npm run typecheck:node && npm run typecheck:web` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Status |
|--------|----------|-----------|-------------------|-------------|
| D-A (Universal clamp) | `buildExportPlan` with `variantScale: 0.5`, master peak 2.5 → `outW = ceil(canonicalW × 1.25)` (not clamped at 1) | unit | `npm test -- tests/core/variant-sizing.spec.ts` | ❌ new test needed |
| D-A (Master byte-identity) | `buildExportPlan` without `variantScale` → same dims as today | unit | `npm test -- tests/core/export.spec.ts` | ✅ existing (no change) |
| D-C (sourceRatio tighter) | drifted row (actualSource < canonical), variant `s < 1` → `sourceRatio` binds, not `1/s` | unit | `npm test -- tests/core/variant-sizing.spec.ts` | ❌ new test needed |
| D-E (Override-test update) | variant override row, `s = 0.5`, pct 150, peak 2.0 → `effScale = 1.5` (not 1.0) | unit | `npm test -- tests/core/variant-sizing.spec.ts` | ❌ existing test formula update |
| Phase 48 oracle | `parse(bake(orig,s),1) ≡ parse(orig,SkeletonJson.scale=s)` — bake untouched | unit | `npm test -- tests/scale-bake.spec.ts` | ✅ existing (no change) |
| Renderer display parity | `computeExportDims` unchanged; parity tests pass | unit | `npm test -- tests/core/export.spec.ts` | ✅ existing (no change) |
| Layer-3 purity | `buildExportPlan` imports no fs/DOM/spine-core | hygiene grep | `npm test -- tests/core/export.spec.ts` | ✅ existing |
| CI full surface | all 1574 tests pass | integration | `npm test && npm run typecheck:node && npm run typecheck:web` | ✅ (must stay green) |

### Sampling Rate

- **Per-task commit:** `npm test -- tests/core/variant-sizing.spec.ts tests/core/export.spec.ts tests/scale-bake.spec.ts`
- **Pre-merge gate:** `npm test && npm run typecheck:node && npm run typecheck:web`
- **Phase gate:** Full suite green before `/gsd-verify-work 55`

### Wave 0 Gaps (tests to create or update)

- [ ] `tests/core/variant-sizing.spec.ts` — UPDATE existing `'no overrides'` test: change `expectedEff` formula from `Math.min(safeScale(s * master.peakScale), 1)` to `Math.min(safeScale(s * master.peakScale), 1 / s)`. For the BIG/0.5 case the number is still 1.0 (because `safeScale(1.0) = 1.0 < 2.0`), so only the comment changes.
- [ ] `tests/core/variant-sizing.spec.ts` — UPDATE existing override test: `expectedEff = min(safeScale(1.5), 1/s=2) = 1.5` (was 1.0). `outW = ceil(1000 × 1.5) = 1500` (was 1000). The negative proof `wrong = 0.5 × min(safeScale(3.0), 1) = 0.5` still ≠ 1.5 → negative guard still valid.
- [ ] `tests/core/variant-sizing.spec.ts` — ADD new describe block: `'Phase 55 — 1/s ceiling (variant with s × master_peakScale > 1/s clamps at master-source)'` with:
  - T1: clean-atlas, master peak 2.5, s=0.5 → `effScale = min(safeScale(1.25), 2) = 1.25`; `outW = ceil(canonicalW × 1.25)` (NOT clamped at 1).
  - T2: clean-atlas, master peak 5.0, s=0.5 → `bufferedScale = 2.5 > 1/s = 2` → clamps at 2; `outW = ceil(canonicalW × 2) = 2 × canonicalW = masterSourceW`. Master-source ceiling.
  - T3: drifted-atlas (actualSource < canonical), master peak 2.0, s=0.5 → `sourceRatio = actualSource/canonical < 1` → `sourceRatio` is tighter, binds; `1/s = 2` is harmless headroom.
- [ ] `tests/core/variant-sizing.spec.ts` — UPDATE `BuildExportPlanOptions` call sites to pass `variantScale: s` where appropriate in the new tests.
- [ ] `tests/core/export.spec.ts` — If the planner adds a new regex parity test for `variantScale?`, this file is the home. (Optional — existing tests don't require it but it would be good hygiene.)

---

## Security Domain

Phase 55 adds `variantScale?: number` to `BuildExportPlanOptions`. The trust boundary for this value is `src/main/variant-export.ts` (IPC boundary), which already validates `0 < s < 1` via `VariantScaleError`. The new `opts.variantScale ?? 1.0` in `buildExportPlan` computes `1 / vs`. Edge cases:
- `vs = 0`: guarded by `VariantScaleError` (rejects `s <= 0`). Division by zero cannot reach `buildExportPlan`.
- `vs = 1` (master, default): `1/1 = 1` — behaves identically to the current code.
- `vs = Infinity` / `NaN`: guarded by `Number.isFinite(s)` check in `exportOneVariant:96`. Cannot reach `buildExportPlan`.
- Master path: never passes `variantScale`. The `?? 1.0` default is the only path; no IPC exposure from the master side.

No new ASVS categories apply. This is a pure arithmetic transform on already-validated data.

---

## Sources

### Primary (HIGH confidence)

- `src/core/export.ts` — read in full (lines 1–472); lift site confirmed at line 279; `BuildExportPlanOptions` at lines 76-112; pipeline at lines 259-320; emit loop at 400-456. [VERIFIED]
- `src/renderer/src/lib/export-view.ts` — read in full; parity confirmed byte-identical to core export; `computeExportDims` (lines 178-329) is distinct and untouched. [VERIFIED]
- `src/main/variant-export.ts` — read in full; `buildExportPlan` call site at lines 191-202; `VariantScaleError` guard at line 96; `safeBuffer` coercion at lines 135-137. [VERIFIED]
- `src/core/scale-summary-peaks.ts` — read in full; confirmed untouched by Phase 55. [VERIFIED]
- `tests/core/export.spec.ts` — read lines 1-1700; all test cases enumerated for D-E matrix. [VERIFIED]
- `tests/core/variant-sizing.spec.ts` — read in full; existing assertions identified for update. [VERIFIED]
- `tests/regression/variant-phantom-green.spec.ts` — read in full; confirmed no export-math assertions. [VERIFIED]
- `tests/safe01/discover-fixtures.ts` — read in full; `SAFE01_EXCLUDED_PREFIXES` enumerated; confirmed no new fixture dir is needed if using synthetic test doubles. [VERIFIED]
- `.planning/phases/55-variant-export-sizes-to-peak-demand/55-CONTEXT.md` — source of locked decisions. [CITED]

### Secondary (MEDIUM confidence)

- `tests/main/variant-dropin-faithful.spec.ts` — scanned for export-dim assertions; none found; oracle pattern confirmed. [VERIFIED]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `outW = ceil(canonicalW × 1.25) = 1250` for canonicalW=1000, s=0.5, peak=2.5 (no dimsMismatch) | D-E / Wave 0 gap T1 | Low: pure arithmetic; verifiable by plugging into formula |

**All other claims were directly verified by reading source files.**

---

## Open Questions

1. **Renderer `buildExportPlan` call site in `AppShell.tsx`:** Does AppShell ever call the renderer's `buildExportPlan` for variant previews (which would need `variantScale`)? Based on CONTEXT.md: no — the renderer builds plans for master exports only. Variant export is triggered via IPC from `variant-export.ts`. Planner should grep `AppShell.tsx` for `buildExportPlan` calls and confirm none pass variant data.

2. **Live UAT sequence:** The TEST_ARMAN folder at `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/` must be re-exported AFTER Phase 55 lands to observe the corrected dims. The UAT involves:
   a. Load the master SYMBOLS.json.
   b. Export Variant at 0.5× (with Phase 55 code active).
   c. Re-open the variant.
   d. Observe: 80×40 / 1.02× row shows variant source = 41×21, resampled peakScale ≤ 1, ExtrapolationIcon does NOT fire.
   e. Counter-test: a master with peakScale > 1 and pre-optimized source (actualSource < canonical) still shows the icon + "capped at source dims" suffix.
   This is a HUMAN-UAT item; it cannot be automated in CI.

---

## Metadata

**Confidence breakdown:**
- Lift site identification: HIGH — read source directly
- D-C math analysis: HIGH — algebraic reasoning on read source
- D-E test matrix: HIGH — enumerated from read test files
- Threading recommendation: HIGH — matches established Phase 30 precedent
- Renderer parity: HIGH — confirmed display vs export separation from Phase 54

**Research date:** 2026-05-26
**Valid until:** 2026-07-26 (stable code domain; single-digit change scope)
