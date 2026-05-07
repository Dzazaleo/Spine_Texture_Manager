---
status: resolved
phase: 24-panel-semantics-unused-assets-rewrite-atlas-savings-metric
source: [24-VERIFICATION.md]
started: 2026-05-04T12:52:00Z
updated: 2026-05-04T13:00:00Z
---

## Current Test

Completed 2026-05-04 by user.

## Tests

### 1. Orphaned PNG files appear in panel
expected: Panel appears below the Global Max Render Source header area, showing filenames and disk sizes of orphaned PNGs; PNGs used by the rig are absent.
result: PARTIAL — Orphaned files detected and listed correctly, but panel appears at the bottom of the Global panel rather than as a fully independent sibling. Layout issue deferred to Phase 26 tab redesign (Global / Unused / Animation Breakdown tabs).

### 2. Panel position in render tree
expected: Order is GlobalMaxRenderPanel → UnusedAssetsPanel → AnimationBreakdownPanel.
result: FAIL — Panel rendered inside/below Global area rather than as a peer sibling panel. Root cause tied to test 1. Deferred to Phase 26 tab redesign.

### 3. Panel hidden when no orphaned files
expected: No Unused Assets panel visible. No empty-state placeholder.
result: PASS

### 4. savingsPct chip visible and correctly styled
expected: When the export plan computes positive savings, a chip reading `X.X% pixel savings` appears between the "Global Max Render Scale" title and the "N selected / N total" counter. Chip uses a warning/amber color distinct from interactive elements.
result: PASS (atlas mode). Chip absent in atlas-less mode — expected behavior when project peak scales are near 1.0 and no downscaling savings exist. Chip would appear in atlas-less mode for rigs that genuinely use attachments at reduced world-scale.

### 5. AtlasNotFoundError mentions images-folder toggle
expected: The error message contains "Use Images Folder as Source" toggle tip alongside the existing re-export advice.
result: PASS

## Summary

total: 5
passed: 3
issues: 2
pending: 0
skipped: 0
blocked: 0

## Gaps

- Tests 1 & 2: Panel layout / positioning — deferred to Phase 26 tab redesign (Global / Unused / Animation Breakdown tab system replaces current stacked panel layout and frees toolbar space).
