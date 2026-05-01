---
status: partial
phase: 20-documentation-builder-feature
source: [20-VERIFICATION.md]
started: 2026-05-01T21:15:00Z
updated: 2026-05-01T21:15:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Drag-and-drop animation from side list onto a track container
expected: Click "+ Add Track" to create Track 0; drag any animation from the side list onto Track 0; new entry appears with default mixTime=0.25 + loop=false. The drag image must render consistently with no missing thumbnail (Electron Chromium quirk D-06 — `effectAllowed='copy'` guards this).
why_human: HTML5 native DnD requires a real browser DOM and OS-level drag image rendering; jsdom only dispatches synthetic events (already covered by tests/renderer/documentation-builder-dialog.spec.tsx).
result: [pending]

### 2. Exported HTML opens correctly in a real browser offline
expected: Author at least one bone description + general notes + one tracked animation; click "Export HTML…"; choose a save location; open the resulting `.html` file in Safari/Firefox/Chrome with NO network. Confirm: hero row + 5-chip strip + Optimization Config card + General Notes card + Animation Tracks table (with terracotta track-divider rows) + Control Bones + Skins + Events (when present) all render with no broken refs (no missing icons, no missing fonts, no `file://` 404s).
why_human: Real browser rendering is the contract. Self-containment is regex-asserted in unit tests + golden-file snapshot, but visual fidelity to the locked CHJWC_SYMBOLS reference screenshot needs a human eye.
result: [pending]

### 3. Cross-platform DnD drag-image consistency (Electron release matrix)
expected: Repeat the DnD test on macOS / Windows / Linux per release matrix. Confirm the drag image renders identically (no missing thumbnail) across all three.
why_human: Electron Chromium has a known quirk where dragstart from the side list element renders different (or no) drag image without `effectAllowed='copy'`. `effectAllowed='copy'` is set; only manual cross-platform verification can confirm the visual outcome.
result: [pending]

### 4. Save → close → reopen produces bit-equal documentation in the actual app
expected: Author Documentation content; File → Save (writes `.stmproj`); File → Close → File → Open the same `.stmproj`. Reopen the Documentation Builder modal — every field (animation tracks with mixTime/loop/notes, events, general notes, per-bone descriptions, per-skin descriptions, safety buffer percent) must match exactly what was authored, including drift policy applied (events/skins auto-listed from skeleton; orphaned tracks dropped). Round-trip identity is regression-tested in vitest, but the human path exercises the full IPC + dialog + dirty-flag + materializer chain in the running Electron app.
why_human: Full Electron-app round-trip exercises IPC + main process + dirty-flag UI feedback that vitest cannot replicate without launching the app.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
