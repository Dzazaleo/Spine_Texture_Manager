---
status: passed
phase: 49-single-scale-variant-export
source: [49-VERIFICATION.md]
started: 2026-05-22T00:00:00Z
updated: 2026-05-25T00:00:00Z
approved_by: user
approved_at: 2026-05-25
---

## Current Test

[complete — Test 1 passed live on both a 4.2 and a 4.3 project 2026-05-25; Test 2 resolved earlier in code]

## Tests

### 1. "Export Variant…" native end-to-end UAT (EXPORT-01) on a 4.2 AND a 4.3 project
expected: In `npm run dev`: click "Export Variant…", enter 0.5, pick a PARENT folder via the native dialog, Export → a `{NAME}@0.5x/` folder appears with the correct artifacts for the active output mode, and the variant renders in the viewer at exactly half the master size (rendered end-state, NOT just "dialog opened").
why_human: Electron native folder picker + real WebGL render cannot be exercised in jsdom; automated coverage stops at the IPC handler (per 49-VALIDATION.md Manual-Only). The full automated layer beneath this (engine, IPC, package layout, faithfulness oracle on the written package) is GREEN.
result: passed — live-confirmed 2026-05-25 in `npm run dev` on BOTH legs. Run A (4.2): SIMPLE_PROJECT/SIMPLE_TEST.json → "Export Variant…" → 0.5 → native parent-folder pick → Export wrote a `SIMPLE_TEST@0.5x/` package with the correct per-mode artifacts; variant rendered at exactly half the master size. Run B (4.3): spineboy_4.3/spineboy-pro.json → same flow → `spineboy-pro@0.5x/` package + half-size render. Rendered end-state confirmed (not an opened≠rendered proxy).

### 2. Re-export-into-existing-folder result surfacing (CR-01 partial-failure path)
expected: Export a variant once (fresh folder, succeeds). Export the SAME scale into the SAME parent again. Decide whether the dialog must surface the worker's overwrite-collision errors rather than reporting "0 files exported" as success. (Code review CR-01: VariantDialog judges success solely on a thrown error and ignores `summary.errors[]`; `writeSkeletonJsonAtomic` overwrites `{NAME}.json` unconditionally while images are refused with `overwrite=false`, leaving a mismatched package presented as success.) The happy-path first export to a fresh folder is fully correct and verified.
why_human: Whether this misleading-success-on-re-export is acceptable for shipping, or must be fixed before EXPORT-01 is signed off, is a product/correctness decision — not programmatically resolvable.
result: resolved — user chose "fix now"; CR-01 fixed in commits 268e8fd + 2b82b82 (writeSkeletonJsonAtomic honors an overwrite gate; VariantDialog surfaces summary.errors[] as a partial failure mirroring OptimizeDialog) plus a discriminating regression test. Re-verification (49-VERIFICATION.md) confirmed CR-01 closed — no maintainer decision needed.

## Summary

total: 2
passed: 1
issues: 0
pending: 0
resolved: 1
skipped: 0
blocked: 0

## Gaps
