---
status: partial
phase: 31-loader-ux-small-fixes-batch
source: [31-VERIFICATION.md]
started: 2026-05-08T17:46:00Z
updated: 2026-05-08T17:46:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Windows-admin DnD advisory live UAT
expected: On a real Windows machine, launching the app via 'Run as administrator' produces an idle DropZone showing the verbatim two-sentence advisory. Dragging a `.json` file over the window does NOT toggle the drag-over ring and does NOT load anything. macOS + Linux DnD remain functional.
result: [pending]

### 2. ExtrapolationIcon hover tooltip live UAT
expected: Loading a fixture with `peakScale > 1` rows (e.g. fixtures with extrapolation), hovering the up-arrow icon in BOTH the Global Max Render Source panel AND the Animation Breakdown panel surfaces the verbatim "Spine rig peak: X.XX× source — export capped at canonical" tooltip in a portaled `<div role="tooltip">`. The parent TD's "World AABB at peak" tooltip should NOT appear when hovering the icon.
result: [pending]

### 3. Animation Breakdown Expand/Collapse all visual UAT
expected: Loading a project with multiple animations and switching to the Animation Breakdown tab: all cards (Setup Pose first, all collapsed) render. Clicking 'Expand all' opens every card. Clicking 'Collapse all' closes every card. Reloading the project resets all to collapsed. The two h-8 buttons match the v1.3 unified toolbar style visually.
result: [pending]

### 4. Source-toggle disabled state visual UAT
expected: Loading an atlas-source project where `images/` directory is absent: the loader-mode menu item appears greyed-out (`text-fg-muted`, `cursor-not-allowed` on hover) and shows a native browser tooltip with the verbatim "No images/ folder found in this project's folder" on hover. Symmetric for atlas-less mode missing `.atlas`. When the alternate source IS present, no greying or tooltip surfaces and clicking still toggles.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
