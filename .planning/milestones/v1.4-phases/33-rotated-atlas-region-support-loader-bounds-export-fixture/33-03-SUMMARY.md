---
phase: 33
plan: 03
subsystem: core+main+tests
tags: [refactor, lockstep, wave-2, rotated-atlas, error-class-removal]
status: complete
completed: 2026-05-11
type: execute
wave: 2
depends_on: [33-02]
requires:
  - tests/core/no-stale-rotation-error.spec.ts (Plan 33-02 Wave 1 RED scaffold to un-skip here)
provides:
  - src/core/loader.ts loader no longer throws on rotated regions (Wave 3 will add proper handling)
  - tests/core/no-stale-rotation-error.spec.ts ACTIVE arch-grep guard
affects:
  - src/core/errors.ts no longer exports RotatedRegionUnsupportedError
  - src/main/ipc.ts KNOWN_KINDS Set shrunk by 1 entry
  - src/shared/types.ts KnownErrorKind union + ExportError.kind union both shrunk by 1 arm
  - src/main/image-worker.ts no longer emits 'rotated-region-unsupported' typed error
  - 2 dedicated spec files deleted (151 + 58 lines)
  - 1 sub-test removed in-place (image-worker.atlas-extract.spec.ts:115-168)
  - 1 spec rephrased (loader.spec.ts:231 — first-pass-scope lock → regression-guard)
key-files:
  created: []
  modified:
    - src/core/errors.ts
    - src/core/loader.ts
    - src/main/image-worker.ts
    - src/main/ipc.ts
    - src/shared/types.ts
    - tests/core/loader.spec.ts
    - tests/core/loader-atlas-source-dims.spec.ts
    - tests/core/no-stale-rotation-error.spec.ts
    - tests/main/image-worker.atlas-extract.spec.ts
  deleted:
    - tests/core/loader-rotation-rejection.spec.ts
    - tests/core/rotated-region-error.spec.ts
decisions: []
metrics:
  duration_minutes: ~8
  completed_date: 2026-05-11
  task_count: 1
  file_count: 11
  commit_count: 1
requirements:
  - ATLAS-01 (throw-site removal partially complete; full ATLAS-01 closure depends on Plan 33-04 D-01 walk)
---

# Phase 33 Plan 03: Lockstep removal of RotatedRegionUnsupportedError + 'rotated-region-unsupported' kind

## One-liner

Atomic lockstep removal of the v1.0-era hard-throw error class and its IPC envelope kind across 9 source/test sites in ONE commit (D-158/D-171 inverse-add precedent); loader no longer throws on rotated regions (Wave 3 plans 04/05 add the actual handling logic — bounds offset override + sharp.rotate).

## What landed

Single atomic commit `a92b07e` — 11 files changed, 62 insertions, 362 deletions.

| Site | File | Action |
|------|------|--------|
| 1 | `src/core/errors.ts` | Delete `RotatedRegionUnsupportedError` class + preceding 12-line docblock (Phase 22.1 G-01b D-03 prose) |
| 2 | `src/core/loader.ts` | Delete `RotatedRegionUnsupportedError,` from the `./errors.js` import block |
| 3 | `src/core/loader.ts` | Delete the `if (!isAtlasLess) { for region ... throw }` block at ex-:507-522 (16 lines + 6-line preceding comment) |
| 3b | `src/core/loader.ts` | Rephrase ex-:689 atlasSources docblock — "Gap-Fix #2 emits 'rotated-region-unsupported'" → "Phase 33 removed the load-time rotation refusal; downstream consumers handle the swap explicitly" |
| 4 | `src/main/ipc.ts` | Delete `'RotatedRegionUnsupportedError'` entry from `KNOWN_KINDS` Set |
| 5 | `src/shared/types.ts` | Delete `RotatedRegionUnsupportedError` arm from `KnownErrorKind` union (ex-:894) |
| 6 | `src/shared/types.ts` | Delete `'rotated-region-unsupported'` literal from `ExportError.kind` union (ex-:523) |
| 7 | `src/shared/types.ts` | Delete `'rotated-region-unsupported'` paragraph from `ExportError` docblock (ex-:498-503) |
| 8a | `src/shared/types.ts` | Rephrase atlasSource docblock at ex-:107 — emits-error prose → "un-rotated by sharp.rotate(-90) during atlas-extract" |
| 8b | `src/shared/types.ts` | Same rephrase at ex-:395 (second atlasSource docblock; same prose template) |
| 9 | `src/main/image-worker.ts` | Delete `rotated atlasSource refusal → 'rotated-region-unsupported'` bullet from header docblock (also updated the `Rotated regions emit ...` line to describe the future sharp.rotate handling) |
| 10 | `src/main/image-worker.ts` | Delete the 17-line typed-error block at ex-:422-438 (refused rotated atlas-extract with `'rotated-region-unsupported'`) |
| 11 | `tests/core/loader-rotation-rejection.spec.ts` | **DELETE FILE** (151 lines — tested the removed throw) |
| 12 | `tests/core/rotated-region-error.spec.ts` | **DELETE FILE** (58 lines — tested the removed class shape) |
| 13 | `tests/main/image-worker.atlas-extract.spec.ts` | Delete the rotated-region sub-test (ex-:115-168, 54 lines) — preserves outer describe and surrounding sub-tests |
| 14 | `tests/core/loader.spec.ts` | Rephrase the rotation-flag fixture lock at ex-:231 — title + comment + failure-message text now describe regression-guard semantics (not first-pass-scope) |
| 15 | `tests/core/no-stale-rotation-error.spec.ts` | UN-SKIP (`describe.skip` → `describe`) + fill in 2 `it.todo` bodies with globSync + regex arch-grep over `src/**/*.ts` (mirrors `tests/arch.spec.ts:20-33` pattern) |
| ** | `tests/core/loader-atlas-source-dims.spec.ts` | Rule 3 fix: update header comment that pointed to the now-deleted `loader-rotation-rejection.spec.ts` |

## Verification (all PASS)

| Check | Command | Result |
|-------|---------|--------|
| TypeScript compiles | `npx tsc --noEmit` | EXIT=0 |
| Full suite green | `npm test` | `Test Files 90 passed \| 4 skipped (94)` ; `Tests 991 passed \| 3 skipped \| 25 todo (1019)` |
| No-stale-rotation-error.spec.ts active | grep for `describe(...)` not `describe.skip` | PASS — describe(...) active, no describe.skip in file |
| Zero src/ refs to RotatedRegionUnsupportedError | `grep -rn 'RotatedRegionUnsupportedError' src/` | EXIT=1 (no matches) |
| Zero src/ refs to 'rotated-region-unsupported' | `grep -rn "'rotated-region-unsupported'" src/` | EXIT=1 (no matches) |
| Deleted spec files gone | `test -f tests/core/loader-rotation-rejection.spec.ts \|\| test -f tests/core/rotated-region-error.spec.ts` | both GONE |
| Sub-test removed | `grep -c 'rotated atlas region.*emits' tests/main/image-worker.atlas-extract.spec.ts` | 0 |
| Test rephrased | `grep -q 'regression guard against accidental re-pack' tests/core/loader.spec.ts` | EXIT=0 |
| Atomic — single commit | `git log --oneline | head -3` | `a92b07e refactor(33-03): ...` is the only Plan 33-03 commit |

The pre-Plan-03 suite was `91 passed | 5 skipped (96) ; Tests 1000 passed | 3 skipped | 27 todo`. The delta is:
- `-1 test file` (5 skipped → 4 skipped — `no-stale-rotation-error` activated and joined the passing set)
- `-2 test files` (96 → 94 — `loader-rotation-rejection.spec.ts` + `rotated-region-error.spec.ts` deleted)
- `-9 passing tests` (1000 → 991 — 6 from `rotated-region-error.spec.ts` + 2 from `loader-rotation-rejection.spec.ts` + 1 from the deleted image-worker sub-test, minus +2 newly-active assertions in `no-stale-rotation-error.spec.ts`; net `8 deleted - 2 added = 6` removed assertions; actually computed: `-2 + 2` activated + `-9 = -9` matches arithmetically since the activated assertions count IS in the 991 passing count)
- `-2 todo` (27 → 25 — the 2 `it.todo` in `no-stale-rotation-error.spec.ts` became real `it(...)` assertions)

## Deviations from plan

**[Rule 3 — Blocking inconsistency] Updated stale doc-comment in `tests/core/loader-atlas-source-dims.spec.ts:25`**

- **Found during:** post-edit grep sweep for surviving references to the deleted spec files.
- **Issue:** The header comment in `loader-atlas-source-dims.spec.ts` ended with "The rotation-rejection tests and G-08 tests live in loader-rotation-rejection.spec.ts." — pointing to a file that no longer exists after this commit. Stale comments are minor but they are exactly the kind of breadcrumb that wastes future-developer minutes ("I'll go read that linked spec... wait, it doesn't exist").
- **Fix:** Rephrased to "The rotation-acceptance tests live in loader-rotation-accept.spec.ts. (The Phase 22.1 rotation-rejection + G-08 specs were removed in Phase 33-03 when load-time rotation rejection was lifted in favor of full handling.)"
- **Files modified:** `tests/core/loader-atlas-source-dims.spec.ts`
- **Commit:** Same atomic commit `a92b07e` (the comment fix is part of the lockstep; landing it in a separate commit would mean the suite passes mid-PR with a documentation gap pointing to a deleted file).

No other deviations — Rules 1, 2, 4 did not trigger.

## Auth gates encountered

None.

## Notes for downstream

- **Plan 33-04** can now safely add the D-01 attachment-walk + offset override in `src/core/loader.ts` post-`readSkeletonData`. The throw block is gone; rotated regions propagate through without bailing. `src/core/loader.ts` does NOT yet import `RegionAttachment` from `@esotericsoftware/spine-core` — Plan 04 adds the import alongside the walk pass.
- **Plan 33-05** can now safely add `sharp.rotate(-90)` in `src/main/image-worker.ts` atlas-extract paths (passthrough at ~:274-298 + resize at ~:380-470). The typed-error gate that previously rejected `row.atlasSource.rotated === true` is gone; the rows flow through to sharp. Rotation direction must still be probe-verified per CONTEXT §"Sharp rotation argument naming and direction".
- **`tests/core/no-stale-rotation-error.spec.ts`** is now ACTIVE and will FAIL if any future commit reintroduces a reference to `RotatedRegionUnsupportedError` or `'rotated-region-unsupported'` in `src/`. This is the lockstep guard for the removal — do not skip it again.
- The 4 remaining Wave 1 RED scaffolds (`loader-rotation-accept.spec.ts`, `bounds-rotation-aabb.spec.ts`, `export-rotation-dims.spec.ts`, `image-worker-rotation.spec.ts`) stay `describe.skip` — Plans 33-04 + 33-05 un-skip them.

## Self-Check: PASSED

- File `.planning/phases/33-rotated-atlas-region-support-loader-bounds-export-fixture/33-03-SUMMARY.md` — created
- Commit `a92b07e` — FOUND in `git log` (`refactor(33-03): lockstep removal of RotatedRegionUnsupportedError + 'rotated-region-unsupported' kind`)
- `npx tsc --noEmit` exits 0
- `npm test` exits 0 (90 files pass, 4 skipped, 0 failures)
- `grep -rn 'RotatedRegionUnsupportedError' src/` returns 0 lines
- `grep -rn "'rotated-region-unsupported'" src/` returns 0 lines
- `tests/core/loader-rotation-rejection.spec.ts` no longer exists
- `tests/core/rotated-region-error.spec.ts` no longer exists
- `tests/core/no-stale-rotation-error.spec.ts` has no `describe.skip` and 2 active `it(...)` assertions
