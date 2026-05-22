---
status: partial
phase: 49-single-scale-variant-export
source: [49-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-22T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. "Export Variant…" native end-to-end UAT (EXPORT-01) on a 4.2 AND a 4.3 project
expected: In `npm run dev`: click "Export Variant…", enter 0.5, pick a PARENT folder via the native dialog, Export → a `{NAME}@0.5x/` folder appears with the correct artifacts for the active output mode, and the variant renders in the viewer at exactly half the master size (rendered end-state, NOT just "dialog opened").
why_human: Electron native folder picker + real WebGL render cannot be exercised in jsdom; automated coverage stops at the IPC handler (per 49-VALIDATION.md Manual-Only). The full automated layer beneath this (engine, IPC, package layout, faithfulness oracle on the written package) is GREEN.
result: [pending]

### 2. Re-export-into-existing-folder result surfacing (CR-01 partial-failure path)
expected: Export a variant once (fresh folder, succeeds). Export the SAME scale into the SAME parent again. Decide whether the dialog must surface the worker's overwrite-collision errors rather than reporting "0 files exported" as success. (Code review CR-01: VariantDialog judges success solely on a thrown error and ignores `summary.errors[]`; `writeSkeletonJsonAtomic` overwrites `{NAME}.json` unconditionally while images are refused with `overwrite=false`, leaving a mismatched package presented as success.) The happy-path first export to a fresh folder is fully correct and verified.
why_human: Whether this misleading-success-on-re-export is acceptable for shipping, or must be fixed before EXPORT-01 is signed off, is a product/correctness decision — not programmatically resolvable.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
