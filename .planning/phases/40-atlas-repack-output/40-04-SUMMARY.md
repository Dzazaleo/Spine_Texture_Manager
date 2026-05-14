---
phase: 40-atlas-repack-output
plan: 04
subsystem: main/image-pipeline
tags: [helper-extraction, sharp-resize, loose-byte-parity, refactor, repack-03, d-03a]
requires:
  - existing: src/main/image-worker.ts:89-110 (applyResizeAndSharpen helper)
  - existing: src/main/image-worker.ts:616 + 624 (call sites)
provides:
  - module: src/main/sharp-resize.ts (resizeToTmpFile, resizeToBuffer, SHARPEN_SIGMA)
  - test: tests/main/image-worker.integration.spec.ts "REPACK-01 — runExport within-run byte parity"
affects:
  - src/main/image-worker.ts (delegates resize chain to shared helper; local applyResizeAndSharpen + SHARPEN_SIGMA removed)
tech-stack:
  added: []
  patterns:
    - "Shared helper with terminal-action split (`resizeToTmpFile` returns chained sharp.Sharp, `resizeToBuffer` returns Promise<Buffer>) — same internal chain, two entry points by output-shape"
    - "Within-run byte-parity SHA256 test as cheap regression canary before stronger cross-baseline test (Plan 08)"
key-files:
  created:
    - src/main/sharp-resize.ts
  modified:
    - src/main/image-worker.ts
    - tests/main/image-worker.integration.spec.ts
decisions:
  - "D-03a confirmed in implementation: internal chain function (`applyResizeAndSharpenChain`) is NOT exported — both public entries delegate, guaranteeing single source of truth for resize+sharpen body"
  - "Local `applyResizeAndSharpen` function and `SHARPEN_SIGMA` constant DELETED from image-worker.ts (not aliased) — DRY removal is preferred per plan; no other call site referenced them (grep-verified)"
  - "Byte-parity test uses CIRCLE.png 699→350 @ effectiveScale 0.5 — same fixture as the existing integration smoke test, exercises BOTH resize and sharpen branches (downscale < 1.0)"
metrics:
  duration: ~10 min
  tasks: 3
  files_created: 1
  files_modified: 2
  commits: 3
  completed: 2026-05-14T16:54:58Z
---

# Phase 40 Plan 04: Sharp Resize Helper Extraction — Summary

Extracted `src/main/image-worker.ts`'s `applyResizeAndSharpen` helper into a sibling module `src/main/sharp-resize.ts` exporting two entry points by terminal action (`resizeToTmpFile` for the loose-export path, `resizeToBuffer` for the upcoming Plan 05 atlas-composite path). Loose-mode export bytes remain SHA256-identical, verified by a new within-run byte-parity test that gates the refactor before Plan 08's stronger cross-baseline test even runs.

## What Was Built

### Task 04.1 — Create `src/main/sharp-resize.ts`
**Commit:** `83ca914`
**Files:** `src/main/sharp-resize.ts` (new, 112 lines)

New module exports:
- `resizeToTmpFile(pipeline, outW, outH, effectiveScale, sharpenEnabled): sharp.Sharp` — loose-path; returns chained sharp pipeline ending at `.png({ compressionLevel: 9 })` for caller to `.toFile(tmpPath)`.
- `resizeToBuffer(pipeline, outW, outH, effectiveScale, sharpenEnabled): Promise<Buffer>` — atlas-path; internally calls `.toBuffer()` and returns the PNG-encoded bytes.
- `SHARPEN_SIGMA = 0.5` — co-located constant.

Internal private `applyResizeAndSharpenChain(...)` is the shared body; both public entries delegate so the resize kernel (`lanczos3` + `fit: 'fill'`) and conditional sharpen gate (`sharpenEnabled && Number.isFinite(effectiveScale) && effectiveScale < 1.0`) live in ONE place — the single-source-of-truth invariant that REPACK-01 byte-parity depends on.

### Task 04.2 — Wire `image-worker.ts` to the shared helper
**Commit:** `34ef852`
**Files:** `src/main/image-worker.ts` (16 insertions, 51 deletions)

- Added `import { resizeToTmpFile } from './sharp-resize.js';` near the top of the file.
- Replaced both call sites (formerly `applyResizeAndSharpen(...).toFile(tmpPath)` at L616 + L624; now `resizeToTmpFile(...).toFile(tmpPath)` at L579 + L587 in the modified file).
- **Deleted** the local `applyResizeAndSharpen` function and the local `const SHARPEN_SIGMA = 0.5` — no other call site in `image-worker.ts` referenced either (grep-verified before deletion). DRY removal preferred per plan over "thin alias" path.
- Updated in-code comments at the call sites to reference the new helper name.
- No behavioural change: identical resize kernel, identical sharpen gate, identical `.png({ compressionLevel: 9 })` terminal.

### Task 04.3 — Add within-run SHA256 byte-parity test
**Commit:** `6d30605`
**Files:** `tests/main/image-worker.integration.spec.ts` (79 insertions)

New describe block: `REPACK-01 — runExport within-run byte parity (post-Plan-04 helper extraction)`.

Test runs `runExport` twice on the same plan (CIRCLE.png 699×699 → 350×350 at `effectiveScale: 0.5`), computes SHA256 of each output, asserts equality. The fixture choice deliberately crosses the sharpen gate (< 1.0) so the test exercises BOTH the resize and the conditional sharpen branches of `resizeToTmpFile` — any non-determinism in either branch will fail this test.

Necessary precondition for REPACK-01's stronger cross-baseline acceptance in Plan 08; failure here surfaces helper-extraction-induced byte drift at the cheapest test gate.

## Verification Results

| Check | Result |
|------|--------|
| `npx tsc --noEmit` | Exit 0 (clean) |
| `npx vitest run tests/main/image-worker.integration.spec.ts` | 2 passed (existing smoke + new byte-parity) |
| `npx vitest run tests/main/image-worker.spec.ts` | 11 passed |
| `npx vitest run tests/main/image-worker.sharpen.spec.ts` | 5 passed |
| `npm run test -- <all three test files>` | 18 passed |
| `grep -c "from './sharp-resize" src/main/image-worker.ts` | 1 |
| `grep -c "resizeToTmpFile" src/main/image-worker.ts` | 7 (1 import + 2 call sites + comment refs) |
| `grep -c "applyResizeAndSharpen" src/main/image-worker.ts` | 1 (only the historical-context comment in the import block; the helper itself is gone) |
| `grep -c "REPACK-01" tests/main/image-worker.integration.spec.ts` | 5 |
| `grep -c "createHash('sha256')" tests/main/image-worker.integration.spec.ts` | 2 |

## Decisions Made

1. **Internal chain not exported** — `applyResizeAndSharpenChain` is module-private; both `resizeToTmpFile` and `resizeToBuffer` delegate to it. This is the structural enforcement of the single-source-of-truth invariant: a future contributor cannot accidentally diverge the two callers' resize bodies.

2. **DRY removal over aliasing** — Plan offered a choice between "delete the local helper" vs "keep it as a thin alias." Deletion chosen because grep confirmed no other call site in `image-worker.ts` referenced `applyResizeAndSharpen` or `SHARPEN_SIGMA`. The remaining references are pure comments (now updated to point at `resizeToTmpFile`).

3. **Byte-parity test uses CIRCLE.png @ scale 0.5** — same fixture as the existing integration smoke test (consistent infra, beforeEach/afterEach tmpdirs), AND crosses the `effectiveScale < 1.0` sharpen gate. A test at `effectiveScale = 1.0` (identity) would skip sharpen entirely and miss any non-determinism introduced specifically in the sharpen branch.

## Deviations from Plan

None — plan executed exactly as written. The plan's `<action>` provided the full module body; Tasks 04.2 and 04.3 followed the documented "Modification 1/2/3" procedure verbatim. The only refinement was updating three in-code comments in `image-worker.ts` that still said "applyResizeAndSharpen" (now reference `resizeToTmpFile`) — this is a cleanup consistent with the plan's intent (the helper is gone, the comments should reflect the new name).

## Out-of-Scope Discoveries

`tests/main/sampler-worker-girl.spec.ts` fails on the current worktree base — verified pre-existing by stashing all Plan-04 changes and reproducing the failure on the clean tree. Logged to `.planning/phases/40-atlas-repack-output/deferred-items.md` for a future triage; NOT a Plan 04 regression.

## REPACK-01 Acceptance Status

**Necessary precondition satisfied:** Within-run SHA256 byte parity confirmed by the new test in `image-worker.integration.spec.ts`. The full REPACK-01 acceptance (cross-baseline SHA256 against pre-Phase-40 fixtures) is Plan 08's responsibility — this plan establishes the deterministic-output gate that Plan 08's stronger test depends on.

## Commits

| Hash | Task | Type | Subject |
|------|------|------|---------|
| `83ca914` | 04.1 | feat | extract sharp resize+sharpen pipeline to sharp-resize.ts |
| `34ef852` | 04.2 | refactor | delegate resize chain to sharp-resize.resizeToTmpFile |
| `6d30605` | 04.3 | test | add within-run SHA256 byte-parity test for runExport loose-path |

## Self-Check: PASSED

- `src/main/sharp-resize.ts` exists (verified).
- `src/main/image-worker.ts` modified, imports `resizeToTmpFile` from `./sharp-resize.js`.
- `tests/main/image-worker.integration.spec.ts` modified, contains new `REPACK-01` describe block.
- All three commits present in `git log` (`83ca914`, `34ef852`, `6d30605`).
- `npx tsc --noEmit` exits 0.
- 18/18 image-worker-related tests pass.
