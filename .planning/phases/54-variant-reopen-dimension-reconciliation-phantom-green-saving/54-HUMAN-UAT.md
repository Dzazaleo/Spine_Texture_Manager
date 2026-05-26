---
status: passed
phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
source: [54-VERIFICATION.md]
started: 2026-05-25T16:54:06Z
updated: 2026-05-26T11:30:00Z
approved_by: user
approved_at: 2026-05-26
---

## Current Test

[all tests resolved]

## Tests

### 1. Reopened variant (peakScale>1 art) — phantom green gone + chip honest
Reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json`.
expected: GRAND and L_SKIRT rows are NO LONGER tinted green (their Peak cell now reads == Source); the section savings-% chip drops from the phantom ~20.6% to ≈0%. With the 2026-05-25 follow-up (1px snap) the lingering 1px-residual green rows are gone too (Peak == Source, amber).
result: passed — owner confirmed live 2026-05-26: Global table working; chip dropped to 1.0% before snap, ≈0% after snap; phantom green is gone.

### 2. Reopened variant @0.1x — second case
Reopen `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json`.
expected: L_SKIRT (0.877×) phantom green is gone; Peak == Source for the previously-false rows.
result: passed — owner confirmed live 2026-05-26 (screenshot of SKINS_SPINE_V02 showing the corrected table); behavior matches the TEST_ARMAN case which was directly verified.

### 3. Master rig with genuine savings (peakScale<1) — unchanged
Reopen a master with `peakScale<1` (e.g. `/Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json`).
expected: genuine green rows are UNCHANGED (still green); the section chip is unchanged from prior behavior — the fix did not regress legitimate master-rig savings.
result: passed — accepted on owner blanket approval. The fix is universal (D-02, no variant detection) and the regression spec R2/R2b prove master peakScale<1 rows have peakDemand === peakDisplay (byte-identical to pre-Phase-54 display); master behavior cannot regress by construction.

### 4. ExtrapolationIcon tooltip copy — both tables, identical
Hover an extrapolation-icon row in BOTH the Global Max Render table and the Animation Breakdown table.
expected: tooltip reads "Spine rig peak: X.XX× source" (no "— export capped at canonical"), byte-identical in both tables.
result: passed — owner confirmed live 2026-05-26 (screenshot of DEMON variant R_HAIR_PIECE row showing "Spine rig peak: 1.07× source"); tooltip helper guarantees byte-identical copy across both panels (spec asserts both call extrapolationTooltip()).

### 5. Animation Breakdown tab — parity with Global (follow-up 2026-05-25)
On the same reopened variant, switch to the Animation Breakdown tab and inspect its Peak W×H column.
expected: it matches the Global tab — no phantom green on reopened peakScale>1 rows; tints by the same rule (Peak vs Source on the displayed integers).
result: passed — accepted on owner blanket approval. The breakdown panel now imports the shared row-state.ts → rowState (verified by both typechecks + the breakdown-virtualization spec); call sites pass row.peakDemandW per the same contract as the Global panel.

### 6. 1px residual snap (follow-up 2026-05-25)
On the reopened variant, look at rows that previously showed a 1px green difference (e.g. 160×161 → 159×160).
expected: they now read Peak == Source (e.g. 160×161 → 160×161), amber/at-limit, not green; genuine multi-px savings rows stay green; section chip ≈0%.
result: passed — owner confirmed live 2026-05-26 (TEST_ARMAN screenshot shows BANGS 19×33→19×33, BODY_TOP 65×110→65×110, BACK_SKIRT 160×161→160×161 etc. amber/at-limit; FACE 50×60→49×58 still green — exactly the documented behavior).

## Follow-up surfaced during UAT (NOT a Phase-54 gap)

The icon-noise question on reopened variants (master rig with peakScale > 1 → variant inherits the icon on every such row, which is non-actionable at the variant level) was diagnosed as a genuine architectural improvement, NOT a Phase-54 regression. Resolution: Phase 55 (Variant Export Sizes to Peak Demand) opens to address it by lifting the variant export's effScale clamp from `min(peak, 1, sourceRatio)` to `min(peak, 1/s, sourceRatio)` — staying within the no-upscale-from-master contract while letting variants actually satisfy the rig's peak demand on reopen. Tracked there, not as a 54 gap.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
