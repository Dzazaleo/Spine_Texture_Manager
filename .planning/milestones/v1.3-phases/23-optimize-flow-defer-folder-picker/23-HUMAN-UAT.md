---
status: partial
phase: 23-optimize-flow-defer-folder-picker
source: [23-VERIFICATION.md]
started: 2026-05-03T23:17:00Z
updated: 2026-05-03T23:17:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. OPT-01 — Toolbar click opens dialog immediately (no picker before modal)
expected: Clicking the "Optimize Assets" toolbar button opens OptimizeDialog without any OS folder-picker dialog appearing first
result: [pending]

### 2. OPT-02 cancel path — Cancelling Start's picker stays in pre-flight
expected: When the user clicks Start and then cancels the OS folder picker, the dialog remains open in pre-flight state (does not close)
result: [pending]

### 3. OPT-02 pre-fill — Picker pre-fills at saved lastOutDir from .stmproj
expected: With a previously saved project, clicking Start opens the picker pre-filled at the saved output folder (lastOutDir from .stmproj); on first use it pre-fills at the skeleton's parent directory
result: [pending]

### 4. D-07 round-trip — .stmproj updated with lastOutDir after export
expected: After a successful export, the project file (.stmproj) is silently updated to store the used output folder, so the next session pre-fills the same folder
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
