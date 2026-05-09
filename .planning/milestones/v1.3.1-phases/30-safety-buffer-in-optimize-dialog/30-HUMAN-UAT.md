---
status: partial
phase: 30-safety-buffer-in-optimize-dialog
source: [30-VERIFICATION.md]
started: 2026-05-08T13:15:00Z
updated: 2026-05-08T13:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live reactive plan rebuild in OptimizeDialog (ROADMAP SC #1)
expected: Open the running Electron app, load fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json, click File → Optimize Assets, dial the Safety buffer input from 0 to 5. Used Files / to Resize / Saving est. pixels tiles update reactively as the user types each digit; Pre-Flight body row dims grow ×1.05 when buffer=5; clicking Start exports textures with the buffered dims actually written to disk.
result: [pending]

### 2. Cross-modal consistency — Atlas Preview reflects buffered values
expected: With buffer=5%, click 'Atlas Preview' from the OptimizeDialog footer (or the toolbar). Atlas page count and tile dims reflect the buffered values; switching to Original mode reverts to source dims (un-buffered, per RESEARCH 'pre-buffer demand' anti-pattern).
result: [pending]

### 3. Live save / quit / reopen round-trip (ROADMAP SC #3)
expected: Save a project with buffer=10%, close the app, reopen, load the project. Buffer input restores to 10; .stmproj on disk contains `safetyBufferPercent: 10` at top-level; schema `version` field still reads `1` (no bump).
result: [pending]

### 4. v1.2-era backward-compat — legacy .stmproj loads with buffer=0
expected: Load a v1.2-era .stmproj that has no safetyBufferPercent field (or has the legacy documentation.safetyBufferPercent set). Buffer input shows 0 (default); legacy documentation field is preserved in round-trip but does not drive export math (Option C); no migration banner.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
