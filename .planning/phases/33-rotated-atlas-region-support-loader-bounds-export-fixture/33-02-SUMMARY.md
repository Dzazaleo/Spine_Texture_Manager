---
phase: 33
plan: 02
subsystem: tests
tags: [tdd, red-scaffold, wave-1, rotated-atlas]
status: complete
completed: 2026-05-10
type: execute
wave: 1
depends_on: [33-01]
requires:
  - fixtures/spine_rotated/EXPORT/skeleton.json   # Plan 33-01 fixture
  - fixtures/spine_rotated/EXPORT/skeleton.png    # Plan 33-01 fixture
provides:
  - tests/core/loader-rotation-accept.spec.ts     # ATLAS-01 skipped placeholder
  - tests/core/bounds-rotation-aabb.spec.ts       # ATLAS-02 skipped placeholder (16 todos)
  - tests/core/export-rotation-dims.spec.ts       # ATLAS-03 skipped placeholder
  - tests/main/image-worker-rotation.spec.ts      # ATLAS-03 (worker side) skipped placeholder
  - tests/core/no-stale-rotation-error.spec.ts    # arch-grep guard skipped placeholder (Wave 2 unskip target)
affects:
  - npm test count (5 new test files, 25 new todos, 0 new live assertions, 0 failures)
key-files:
  created:
    - tests/core/loader-rotation-accept.spec.ts
    - tests/core/bounds-rotation-aabb.spec.ts
    - tests/core/export-rotation-dims.spec.ts
    - tests/main/image-worker-rotation.spec.ts
    - tests/core/no-stale-rotation-error.spec.ts
  modified: []
decisions: []
metrics:
  duration_minutes: ~5
  completed_date: 2026-05-10
  task_count: 1
  file_count: 5
requirements:
  - ATLAS-04 (partial — scaffolds in place; ATLAS-01/02/03 spec bodies still pending Waves 2/3)
---

# Phase 33 Plan 02: Wave 1 RED scaffolds — 5 skipped spec files

## One-liner

Pre-installed 5 skipped-placeholder spec files (`describe.skip` + `it.todo`) for ATLAS-01/02/03 + arch-grep guard, so Wave 2's lockstep removal commit can un-skip a single existing spec instead of creating a new file mid-removal, and Wave 3 plans can focus on assertion bodies, not import boilerplate.

## What landed

5 new spec files at the paths below. Every file:
- Has a `// Phase 33 Wave 1 RED scaffold —` header comment naming the downstream plan that will fill it in.
- Uses `describe.skip(...)` to mark the whole group as skipped (vitest reports `skipped`, not failure or pass).
- Has at least one `it.todo('case description')` per planned assertion case from the plan's 33-PATTERNS.md sketch.
- Uses `path.resolve('fixtures/spine_rotated/EXPORT/skeleton.{json,png}')` at module top for files that will load the Plan 33-01 fixture (loader + image-worker scaffolds).
- Compiles cleanly under `npx tsc --noEmit` (no `@ts-ignore`, no unresolved symbols, no live runtime assertions).

| File | REQ | `it.todo` count | Downstream unskip plan |
|------|-----|-----------------|------------------------|
| `tests/core/loader-rotation-accept.spec.ts` | ATLAS-01 | 2 | Plan 33-04 |
| `tests/core/bounds-rotation-aabb.spec.ts` | ATLAS-02 | 16 | Plan 33-04 |
| `tests/core/export-rotation-dims.spec.ts` | ATLAS-03 | 2 | Plan 33-05 |
| `tests/main/image-worker-rotation.spec.ts` | ATLAS-03 (worker side) | 3 | Plan 33-05 |
| `tests/core/no-stale-rotation-error.spec.ts` | arch-grep guard | 2 | Plan 33-03 (lockstep) |
| **Total** | | **25** | |

## Verification (all PASS)

| Check | Command | Result |
|-------|---------|--------|
| All 5 spec files exist | `for f in ... ; do test -f $f; done` | OK (5/5) |
| Each file has Phase 33 Wave 1 RED scaffold header | `grep -l "Phase 33 Wave 1 RED scaffold" <files>` | OK (5/5) |
| At least one skip/todo per file | `grep -c "describe.skip\|it.todo\|it.skip" <files>` | 30 total matches (5 describe.skip + 25 it.todo) |
| TypeScript compiles | `npx tsc --noEmit; echo $?` | `0` |
| Suite green | `npm test` exit | `0` |
| Test counts | `npm test` tail | `Test Files 91 passed \| 5 skipped (96)` ; `Tests 1000 passed \| 3 skipped \| 27 todo (1030)` |
| No new failures | grep for "failed" in test output | 0 lines |
| No `RotatedRegionUnsupportedError` reference in new specs | grep over the 5 scaffold files | (none — would couple to Plan 33-03 deletion timing) |

The "5 skipped" file count maps 1:1 to the 5 new scaffolds. The 25 new `it.todo` entries account for the deltas in the todo column (suite had pre-existing todos; new total 27 todo).

## Note for Plan 33-03

`tests/core/no-stale-rotation-error.spec.ts` is the SOLE Wave 2 unskip target. The lockstep removal commit (Plan 33-03) must:

1. Delete `RotatedRegionUnsupportedError` class from `src/core/errors.ts` (line ~154).
2. Remove the rotated-region throw site from `src/core/loader.ts`.
3. Remove the `'rotated-region-unsupported'` ExportError kind tag (if present).
4. Un-skip `tests/core/no-stale-rotation-error.spec.ts` (flip `describe.skip` → `describe`) AND fill in the `it.todo` bodies with the globSync + regex pattern from `tests/arch.spec.ts:20-33`. The two assertions are: (a) no `src/` file references the identifier `RotatedRegionUnsupportedError`; (b) no `src/` file references the ExportError kind string `'rotated-region-unsupported'`.

All other 4 scaffold files stay `.skip` after Plan 33-03 — Wave 3 (Plans 04/05) un-skips them.

## Deviations from plan

None — plan executed exactly as written. All acceptance criteria met on first pass.

## Self-Check: PASSED

- File `tests/core/loader-rotation-accept.spec.ts` — FOUND
- File `tests/core/bounds-rotation-aabb.spec.ts` — FOUND
- File `tests/core/export-rotation-dims.spec.ts` — FOUND
- File `tests/main/image-worker-rotation.spec.ts` — FOUND
- File `tests/core/no-stale-rotation-error.spec.ts` — FOUND
- Commit `cf2ff56` — FOUND in `git log` (`test(33-02): add 5 RED-scaffold spec files for rotated-atlas work`)
- `npm test` green (91 files pass, 5 skipped, 0 failures)
- `npx tsc --noEmit` exits 0
