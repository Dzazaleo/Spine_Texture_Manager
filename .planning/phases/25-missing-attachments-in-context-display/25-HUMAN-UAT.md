---
status: partial
phase: 25-missing-attachments-in-context-display
source: [25-VERIFICATION.md]
started: 2026-05-04T14:24:49Z
updated: 2026-05-04T14:24:49Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Missing row visible in Global Max Render Source panel
expected: Load a project with a missing PNG (atlas-less mode, "Use Images Folder as Source" ON, one PNG deleted). The missing attachment row IS visible in the Global Max Render Source panel — not filtered out — with a red left-border accent stripe, ⚠ icon before the attachment name, and a danger-tinted ratio cell.
result: [pending]

### 2. Missing row visible in Animation Breakdown setup-pose card
expected: Same project as above — expand the setup-pose card in the Animation Breakdown panel and confirm the same red left-border accent stripe and ⚠ icon appear for the missing attachment row. (Per-animation non-setup-pose cards intentionally do not show stub rows.)
result: [pending]

### 3. MissingAttachmentsPanel and in-context rows visible simultaneously
expected: Both the MissingAttachmentsPanel summary (above the Global panel) AND the red-accented in-context rows in the Global panel are visible at the same time — the two panels are additive, not mutually exclusive.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
