---
status: partial
phase: 54-variant-reopen-dimension-reconciliation-phantom-green-saving
source: [54-VERIFICATION.md]
started: 2026-05-25T16:54:06Z
updated: 2026-05-25T22:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Reopened variant (peakScale>1 art) — phantom green gone + chip honest
Reopen `/Users/leo/Downloads/TEST_ARMAN/variant/SYMBOLS@0.5x/SYMBOLS.json`.
expected: GRAND and L_SKIRT rows are NO LONGER tinted green (their Peak cell now reads == Source); the section savings-% chip drops from the phantom ~20.6% to ≈0%. With the 2026-05-25 follow-up (1px snap) the lingering 1px-residual green rows are gone too (Peak == Source, amber).
result: [PASS — Global table working; chip 1.0% observed before the snap, re-verify ≈0% after]

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

### 5. Animation Breakdown tab — parity with Global (follow-up 2026-05-25)
On the same reopened variant, switch to the Animation Breakdown tab and inspect its Peak W×H column.
expected: it matches the Global tab — no phantom green on reopened peakScale>1 rows; tints by the same rule (Peak vs Source on the displayed integers).
result: [pending]

### 6. 1px residual snap (follow-up 2026-05-25)
On the reopened variant, look at rows that previously showed a 1px green difference (e.g. 160×161 → 159×160).
expected: they now read Peak == Source (e.g. 160×161 → 160×161), amber/at-limit, not green; genuine multi-px savings rows stay green; section chip ≈0%.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
