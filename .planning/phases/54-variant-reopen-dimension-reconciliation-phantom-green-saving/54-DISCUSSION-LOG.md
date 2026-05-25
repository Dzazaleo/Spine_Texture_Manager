# Phase 54: Variant Reopen Dimension Reconciliation (Phantom Green-Savings Fix) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 54-variant-reopen-dimension-reconciliation-phantom-green-saving
**Areas discussed:** Fix direction, Reach, Green-tint rule

**Origin:** `/gsd-debug` session `.planning/debug/variant-peaks-differ-green.md` (resolved/diagnose-only). User confirmed Phase 54 as a standalone bugfix (v1.7 closed, no active milestone), then ran the discussion to pick the fix direction.

---

## Fix Direction

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the readout (Option B) | Display-layer only. Compute Peak/savings from true render demand (canonical × peakScale, capped at the texture's real pixels) instead of the export-clamped value. False green disappears, variant textures stay sharp, NO exported bytes change. Also fixes the latent false-green on master rigs with peakScale>1. Lowest risk. | ✓ |
| Shrink variant textures (Option A) | Export-side. Clamp variant PNGs to s×geometry so texture==geometry → no green. Smaller variant files but lower texture quality (matches master blur) and edits v1.7-verified export sizing → needs drop-in faithfulness re-verification. | |
| Safety guard only (Option C) | Leave the green; just stop a re-optimize from shrinking a variant below true render demand. Smallest change, but the confusing display remains. | |

**User's choice:** Fix the readout (Option B — Recommended).
**Notes:** Preserves the "a variant is your tuned export, just smaller — but sharp at its resolution" intent. Honors the debug-session warning not to shrink/re-optimize variant textures (blurry in-engine). → CONTEXT D-01.

---

## Reach

| Option | Description | Selected |
|--------|-------------|----------|
| Universal — all rigs | Apply true-render-demand math everywhere. Fixes variants AND the same latent false-green on master rigs (peakScale>1). No variant detection needed — simpler, more correct. A few master rows currently showing a false green correctly flip to "no savings." | ✓ |
| Variants only — conservative | Only change reopened-variant readout; masters byte-identical. Requires detecting "this is a variant" (heuristic or export-time marker) — more fragile, leaves the master bug latent. | |

**User's choice:** Universal — all rigs (Recommended).
**Notes:** No variant-detection machinery; treats the fix as the genuine correctness improvement it is. → CONTEXT D-02.

---

## Green-Tint Rule

| Option | Description | Selected |
|--------|-------------|----------|
| Match the shown numbers | Green only when the DISPLAYED Peak integer is strictly smaller than the DISPLAYED Source integer. Kills the "looks identical but green" confusion; sub-pixel-only deltas round away. | ✓ |
| Keep float-precise tint | Tint stays driven by unrounded floats, so a row can glow green even when Peak and Source display as the same integers (the reported confusion persists). | |

**User's choice:** Match the shown numbers (Recommended).
**Notes:** Directly resolves the user's "sometimes peak and source are the same but the peak is green" observation. → CONTEXT D-03.

---

## Claude's Discretion

- Exact code seam for the render-demand value (add to `computeExportDims` vs derive in the panel); keep the export-dim path byte-identical.
- Whether the displayed Peak W×H value itself changes or only the tint + savings basis rebase (flagged for the researcher against the peak-anchored-invariants semantic history).
- savings-% chip recompute path (reuse corrected per-row state vs independent area sum).
- D-03 implementation (pure integer compare of shown dims, no epsilon).
- Automated-test fixture choice.

## Deferred Ideas

- Option A (shrink variant textures for smaller files) — rejected this phase; revisit only for a future minimum-file-size variant mode.
- Option C (re-optimize safety guard) — unneeded once display is honest; cheap belt-and-suspenders later.
- "This is a variant — already sized" badge — not built; revisit only if users still want signposting (new UI = own phase).
- Sweeping faint sub-pixel rounding greens beyond the D-03 integer-match rule (epsilon/tolerance) — left out; risks hiding genuine tiny savings.
