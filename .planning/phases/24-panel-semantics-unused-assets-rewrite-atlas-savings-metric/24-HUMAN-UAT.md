---
status: partial
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
source: [24-VERIFICATION.md]
started: 2026-05-04T12:52:00Z
updated: 2026-05-04T12:52:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Orphaned PNG files appear in panel
expected: Panel appears below the Global Max Render Source header area, showing filenames and disk sizes of orphaned PNGs; PNGs used by the rig are absent.
result: [pending]

### 2. Panel position in render tree
expected: Order is GlobalMaxRenderPanel → UnusedAssetsPanel → AnimationBreakdownPanel.
result: [pending]

### 3. Panel hidden when no orphaned files
expected: No Unused Assets panel visible. No empty-state placeholder.
result: [pending]

### 4. savingsPct chip visible and correctly styled
expected: When the export plan computes positive savings, a chip reading `X.X% pixel savings` appears between the "Global Max Render Scale" title and the "N selected / N total" counter. Chip uses a warning/amber color distinct from interactive elements.
result: [pending]

### 5. AtlasNotFoundError mentions images-folder toggle
expected: The error message contains "Use Images Folder as Source" toggle tip alongside the existing re-export advice.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
