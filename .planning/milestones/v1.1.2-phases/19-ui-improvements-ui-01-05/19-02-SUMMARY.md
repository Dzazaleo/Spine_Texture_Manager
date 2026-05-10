---
phase: 19
plan: 02
subsystem: main-process-summary
tags: [main-side-fs, augmentation, layer-3, ui-04]
requires:
  - "Plan 19-01 — UnusedAttachment.bytesOnDisk?: number OPTIONAL field on the interface"
  - "Existing src/main/summary.ts buildSummary() with load.sourcePaths in scope"
  - "Existing src/core/usage.ts findUnusedAttachments(load, sampled) — read-only consumer in this plan"
provides:
  - "Per-row bytesOnDisk number on every UnusedAttachment crossing the IPC boundary (populated via fs.statSync, silent-catch → 0 for D-15 atlas-packed cases)"
affects:
  - "Plan 19-04 (renderer panels — MB-savings callout) — consumes this field via (u.bytesOnDisk ?? 0)"
tech-stack:
  added: []
  patterns:
    - "Star-namespace node:fs import in main process (mirrors loader.ts:30 precedent)"
    - "Silent-catch idiom for non-critical UX state (mirrors recent.ts:32 / project-io.ts:198)"
    - "Spread-with-augment {...u, bytesOnDisk} adapter at the main/core seam (Layer 3 boundary preserved)"
key-files:
  created: []
  modified:
    - "src/main/summary.ts (+30 / -1 — node:fs import + post-findUnusedAttachments map augmentation block)"
decisions:
  - "src/core/usage.ts NOT modified — orchestrator's locked decision: optional field on interface means core stays 100% as-is"
  - "Silent-catch over typed-error-envelope per D-15 — atlas-packed projects legitimately lack per-region PNGs; surfacing errors would dilute export-failure signal"
  - "Synchronous fs.statSync over async — summary.ts is sync today; per-row stat cost is ~µs and bounded by unusedAttachments.length (typically <100)"
metrics:
  duration_minutes: 1
  tasks_completed: 1
  completed_date: "2026-05-01"
---

# Phase 19 Plan 02: Wave 2 Main-Side bytesOnDisk Writer Summary

Wave 2 closes the UI-04 main-side contract: every `UnusedAttachment` row now carries a `bytesOnDisk` numeric value (stat-derived from `load.sourcePaths`, with a silent-catch fallback to `0` for atlas-packed / missing-path cases per D-15). One file modified, one atomic commit, no Layer 3 violation, no test regression.

## Tasks Completed

| Task | Name                                                                          | Commit  | Files               |
| ---- | ----------------------------------------------------------------------------- | ------- | ------------------- |
| 1    | Augment unused rows with `fs.statSync(path).size` in `src/main/summary.ts`    | b438243 | src/main/summary.ts |

## What Landed

### Task 1 — `src/main/summary.ts` augmentation (D-13 / D-15)

Two surgical edits to `src/main/summary.ts`:

**Change A — `node:fs` star-import.** Added `import * as fs from 'node:fs';` immediately after the existing `import { findUnusedAttachments } from '../core/usage.js';` line. Mirrors the only other in-repo star-namespace `node:fs` precedent at `src/core/loader.ts:30`. Main process is allowed file I/O; this import does NOT cross any Layer 3 boundary.

**Change B — Per-row augmentation pattern (verbatim from `19-PATTERNS.md` §"Augmentation pattern").** Replaced the single-line `findUnusedAttachments(load, sampled)` callsite with a two-step pattern:

1. `const rawUnused = findUnusedAttachments(load, sampled);` — core call returns rows without `bytesOnDisk` (Layer 3 invariant — core does no file I/O).
2. `const unusedAttachments = rawUnused.map((u) => { ... return { ...u, bytesOnDisk }; });` — main-side spread-and-augment, using `load.sourcePaths.get(u.attachmentName)` as the path source. Synchronous `fs.statSync(path).size` inside a `try { ... } catch { bytesOnDisk = 0; }` silent-catch (D-15 fallback for atlas-packed cases / ENOENT / EACCES).

The Phase 5 Plan 02 comment block above the call is **preserved verbatim**; the new Phase 19 UI-04 (D-13) comment block is appended beneath it explaining the Layer 3 rationale + the optional-field contract from Plan 19-01.

After the map, every row in `unusedAttachments` satisfies the `UnusedAttachment` interface with a numeric `bytesOnDisk` field; the existing IPC payload assembly downstream is unchanged because the field was already declared OPTIONAL in `src/shared/types.ts` (Plan 19-01).

### `src/core/usage.ts` — UNTOUCHED (orchestrator's locked decision)

`git diff src/core/usage.ts` returns empty. Confirmed at every step. The field is OPTIONAL on the interface (Plan 19-01: `bytesOnDisk?: number`), so core's existing `rows.push({ attachmentName, sourceW, sourceH, definedIn, dimVariantCount, sourceLabel, definedInLabel })` continues to satisfy `UnusedAttachment[]` without any narrowing — the `?` modifier means absence of the field is type-valid. Layer 3 invariant preserved by absence of any change.

## Verification

All plan-level acceptance gates green:

| Gate                                                                        | Result    |
| --------------------------------------------------------------------------- | --------- |
| `grep -F "import * as fs from 'node:fs';" src/main/summary.ts`              | PASS      |
| `grep -F 'fs.statSync(path).size' src/main/summary.ts`                      | PASS      |
| `grep -F 'Phase 19 UI-04 (D-13)' src/main/summary.ts`                       | PASS      |
| `grep -F 'load.sourcePaths.get(u.attachmentName)' src/main/summary.ts`      | PASS      |
| `grep -F 'rawUnused.map' src/main/summary.ts`                               | PASS      |
| `grep -F '{ ...u, bytesOnDisk }' src/main/summary.ts`                       | PASS      |
| `try { ... fs.statSync ... } catch { ... }` silent-catch present            | PASS      |
| `npx tsc --noEmit`                                                          | PASS      |
| `npm test -- tests/arch.spec.ts` (Layer 3 grep gate)                        | PASS 12/12|
| `npm test -- tests/core/summary.spec.ts tests/core/usage.spec.ts`           | PASS 19/19|
| `git diff src/core/usage.ts` returns empty (core untouched)                 | PASS      |

Full vitest suite: **534 passing / 1 pre-existing fail / 2 skipped / 2 todo** (539 total). Identical headline counts to the Plan 19-01 baseline. The single failure is `tests/main/sampler-worker-girl.spec.ts` ("warm-up run must complete"), verified pre-existing by re-running on the worktree-base commit `a19a75c` (also fails there with the same `expected 'error' to be 'complete'`). Plan 19-02 modifies only `src/main/summary.ts`; nothing in this change touches the sampler-worker code path.

## Deviations from Plan

None — plan executed exactly as written. The augmentation block matches `19-PATTERNS.md` §"Augmentation pattern" verbatim including the exact comment cadence, the `path` local var shadow naming, the `if (path !== undefined)` guard, the silent-catch idiom, and the `{ ...u, bytesOnDisk }` spread-with-add field shape.

## Pre-existing Test Failure (Out of Scope)

`tests/main/sampler-worker-girl.spec.ts` — same failure as recorded in `19-01-SUMMARY.md` ("warm-up run must complete (not error/cancel): expected 'error' to be 'complete'"). Verified pre-existing by `git stash && npm test -- tests/main/sampler-worker-girl.spec.ts` on the clean Wave 2 base — identical failure. This plan touches only `src/main/summary.ts` and introduces zero new test failures. Logged here for traceability; this is not a Plan 19-02 deviation.

## Hand-off Notes for Downstream Plans

- **Plan 19-04 (renderer panels — MB-savings callout):** The renderer can now safely use `(u.bytesOnDisk ?? 0)` to compute aggregate bytes across all unused rows. The `?? 0` fallback handles both:
  - Type-narrowing on the optional field (`bytesOnDisk?: number` declares possibly-undefined).
  - The structural-zero case (`bytesOnDisk === 0` for atlas-packed / missing-path rows per D-15) — this propagates correctly through `aggregateBytes === 0` strict-equality fallthrough to count-only copy in the unused callout.
- **Plan 19-04 specifically:** Remember the D-15 strict `=== 0` threshold for the count-only fallback; any non-zero aggregate (even 1 byte) renders as `"0 B potential savings"` per `formatBytes` (defensive, unlikely path).
- **Future plans:** `src/main/summary.ts` is now the **sole writer** of `bytesOnDisk`. If a future plan needs to recompute (e.g., on override change), the recomputation must happen here in the main process — `src/core/usage.ts` MUST stay file-I/O-free (Layer 3 invariant; `tests/arch.spec.ts` grep gate enforces).

## Self-Check: PASSED

Verified file modification and commit:
- FOUND: `src/main/summary.ts` contains `import * as fs from 'node:fs';`
- FOUND: `src/main/summary.ts` contains `fs.statSync(path).size`
- FOUND: `src/main/summary.ts` contains `{ ...u, bytesOnDisk }` spread
- FOUND: `src/main/summary.ts` contains `Phase 19 UI-04 (D-13)` comment
- FOUND: `git diff src/core/usage.ts` returns empty (Layer 3 untouched)
- FOUND commit: `b438243` — feat(19-02): write bytesOnDisk per unused attachment via fs.statSync
