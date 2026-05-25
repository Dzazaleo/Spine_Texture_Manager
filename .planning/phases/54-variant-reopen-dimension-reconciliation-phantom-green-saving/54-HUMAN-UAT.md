---
status: partial
phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
source: [54-VERIFICATION.md]
started: 2026-05-25T16:54:06Z
updated: 2026-05-25T16:54:06Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Reopened variant (peakScale>1 art) — phantom green gone + chip honest
Reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json`.
expected: GRAND and L_SKIRT rows are NO LONGER tinted green (their Peak cell now reads == Source); the section savings-% chip drops from the phantom ~20.6% to the genuine rounding residual (≈0%), not 20.6%.
result: [pending]

### 2. Reopened variant @0.1x — second case
Reopen `/Users/leo/Downloads/42/SKINS_SPINE_V02@0.1x/SKINS_SPINE_V02.json`.
expected: L_SKIRT (0.877×) phantom green is gone; Peak == Source for the previously-false rows.
result: [pending]

### 3. Master rig with genuine savings (peakScale<1) — unchanged
Reopen a master with `peakScale<1` (e.g. `/Users/leo/Downloads/TEST_ARMAN/SYMBOLS.json`).
expected: genuine green rows are UNCHANGED (still green); the section chip is unchanged from prior behavior — the fix did not regress legitimate master-rig savings.
result: [pending]

### 4. ExtrapolationIcon tooltip copy — both tables, identical
Hover an extrapolation-icon row in BOTH the Global Max Render table and the Animation Breakdown table.
expected: tooltip reads "Spine rig peak: X.XX× source" (no "— export capped at canonical"), byte-identical in both tables.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
