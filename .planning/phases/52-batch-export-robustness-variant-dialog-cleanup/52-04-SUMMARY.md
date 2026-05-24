---
phase: 52-batch-export-robustness-variant-dialog-cleanup
plan: 04
subsystem: testing
tags: [variant-export, batch, rollback, continue-on-error, token-equivalence, regression-lock, vitest, tsconfig]

# Dependency graph
requires:
  - phase: 52-batch-export-robustness-variant-dialog-cleanup (plan 01)
    provides: "handleExportVariantBatch per-row dup-skip (D-01/WR-02) + exportOneVariant readdir-empty rollback cleanup (D-03/WR-03)"
  - phase: 50-rig-bounds-two-way-scale-dimension-input
    provides: "renderer-local pure tokenFor/displayFactor in src/renderer/src/modals/variant-scale-derive.ts (Layer-3 mirror)"
  - phase: 49-single-scale-variant-export
    provides: "main formatScaleToken canonical token helper"
provides:
  - "Cross-boundary regression lock: tokenFor(x) === formatScaleToken(x) over a shared sample (IEEE-754 + near-collision + canonical anchor) — IN-01"
  - "Tightened orphan assertion: a failed batch variant's freshly-created dir is GONE, not merely empty (locks 52-01 D-03/WR-03)"
  - "Partial-failure regression: two scales colliding on one token both fail with the dup reason; a non-colliding scale exports; the colliding folder is never created (locks 52-01 D-01/WR-02)"
affects: [phase-52-verify, phase-53-persist-variant-state]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-boundary equivalence test in tests/main (node env) importing BOTH the main formatScaleToken AND the renderer-local PURE token helper — locks the Layer-3 mirror without merging into shared/ (ROADMAP SC#4 route)"
    - "Composite-project import requires explicit include: a tsc composite project (tsconfig.node.json) needs an imported file listed in `include`, not just pulled in via the import edge, or it raises TS6307"

key-files:
  created:
    - "tests/main/variant-token-equivalence.spec.ts - D-05 cross-boundary tokenFor ≡ formatScaleToken equivalence lock"
  modified:
    - "tests/main/variant-batch-faithful.spec.ts - D-08(a) tightened orphan-gone assertion + D-08(b) dup partial-failure regression"
    - "tsconfig.node.json - include src/renderer/src/modals/*.ts so the composite node program lists the pure helper imported by the new spec (TS6307 fix)"

key-decisions:
  - "D-05: the equivalence spec lives in tests/main (node env) and imports the renderer-local pure variant-scale-derive helper extensionless (matching variant-twoway.spec.ts); the main formatScaleToken is imported with the .js convention"
  - "tsconfig.node.json include (not exclude): the plan assumed the import-edge alone would typecheck, but the composite project raised TS6307; adding `src/renderer/src/modals/*.ts` to include (single-level *.ts pulls in only the one pure file; React/DOM .tsx siblings do not match) is the minimal fix that KEEPS the test in tests/main — the whole point of D-05"
  - "D-08(b) uses filter-by-token (not positional indexing) because the dup-skip pushes one result PER colliding input row → 3 results for [0.5, 0.50001, 0.36]; assert filter(token==='0.5' && status==='failed').length === 2"
  - "Dup reason asserted VERBATIM: `Duplicate scale token @0.5x — two rows produce the same folder.` (matches the shipped 52-01 copy, per-row token)"

patterns-established:
  - "Regression-test-per-fix: every Phase-52 behavior change ships its lock (D-05 equivalence, D-08a orphan-gone, D-08b partial-failure), reusing committed fixtures with NO new committed fixture dir (D-09)"
  - "Comment-content hygiene in specs: avoid the literal `**/*` glob inside block comments (esbuild's lexer reads the embedded `*/` as the comment terminator); also avoid literal acceptance-grep substrings inside explanatory comments so the gate stays honest"

requirements-completed: [EXPORT-06]

# Metrics
duration: 4min
completed: 2026-05-24
---

# Phase 52 Plan 04: Batch Export Robustness Regression Locks Summary

**Shipped the three Phase-52 regression locks: a tests/main cross-boundary `tokenFor ≡ formatScaleToken` equivalence test (IEEE-754 + near-collision + canonical anchor), a tightened "failed variant's folder is GONE" assertion, and a duplicate-token partial-failure regression (both colliding rows fail with the dup reason, the non-colliding scale exports, the colliding folder is never created) — all reusing committed fixtures with no new fixture dir.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-24T09:32:04Z
- **Completed:** 2026-05-24T09:36:00Z
- **Tasks:** 2
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments
- **D-05 (IN-01, SC#4):** New `tests/main/variant-token-equivalence.spec.ts` (node env) asserts `tokenFor(x) === formatScaleToken(x)` over a shared sample — the canonical anchor `0.5 → '0.5'`, the IEEE-754 step artifact `0.30000000000000004 → '0.3'`, near-collision pairs `0.5/0.50001` and `0.36/0.36001`, ordinary down-scale factors, and a >4-decimal `0.123456`. It imports BOTH the main `formatScaleToken` (`.js`) and the renderer-local PURE `tokenFor`/`displayFactor` (extensionless), locking the Layer-3 mirror via a test rather than a shared-helper merge (the ROADMAP SC#4 route). 5/5 green.
- **D-08 (a) (WR-03 lock, SC#2):** Tightened the Block-2 continue-on-error orphan tolerance in `variant-batch-faithful.spec.ts` — the former folder-exists+empty-readdir tolerance is replaced by a hard `expect(fs.existsSync(folder)).toBe(false)` ("the folder is GONE"), locking the 52-01 D-03 readdir-empty cleanup. The forced-fail (`maxPageSize: 64`) test exercises the D-03 catch on every iteration.
- **D-08 (b) (WR-02 lock, SC#1):** New partial-failure regression — `[0.5, 0.50001, 0.36]` where the first two collapse to token `'0.5'`. Asserts both colliding rows are `failed` with the verbatim dup reason, the non-colliding `0.36` is `exported` and its folder exists, and the `@0.5x` folder is NEVER created (the dup-skip `continue`s before `exportOneVariant`/mkdir). Locks the 52-01 D-01 dup-skip.
- **D-09:** No new committed fixture dir (reuses `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` via `simpleSummary()`); both target specs = 18/18; `typecheck:node` + `typecheck:web` exit 0.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-05 — tests/main cross-boundary tokenFor ≡ formatScaleToken equivalence spec** - `ad3950e` (test)
2. **Task 2: D-08 (a)+(b) — tighten orphan-gone assertion + dup partial-failure regression** - `1b531f8` (test)

_Note: STATE.md / ROADMAP.md are intentionally NOT updated by this worktree agent — the orchestrator owns those writes after the wave merges._

## Files Created/Modified
- `tests/main/variant-token-equivalence.spec.ts` (created) - D-05 cross-boundary equivalence lock; node-env spec importing both the main `formatScaleToken` and the renderer-local pure `tokenFor`/`displayFactor`; pure assertions over a shared sample (no fixtures/fs/electron).
- `tests/main/variant-batch-faithful.spec.ts` (modified) - D-08(a): the Block-2 orphan tolerance is tightened to a hard "folder is GONE" assertion; D-08(b): a new partial-failure `it(...)` in the same continue-on-error describe.
- `tsconfig.node.json` (modified) - added `src/renderer/src/modals/*.ts` to `include` so the composite node program lists the pure helper imported by the new spec (TS6307 fix; React/DOM `.tsx` siblings do not match the single-level `*.ts` glob).

## Decisions Made
- **Equivalence spec placement = `tests/main` (D-05):** Kept the test in the node program (not `tests/renderer`) so it can import both boundaries; imported the renderer module extensionless (matching `variant-twoway.spec.ts`) and the main module with the `.js` convention.
- **Filter-by-token assertions in D-08(b):** Because the dup-skip pushes a result per colliding input row, `[0.5, 0.50001, 0.36]` yields 3 results; asserted via `filter(token==='0.5' && status==='failed').length === 2` rather than positional indexing (per the plan note).
- **Dup reason asserted verbatim:** `Duplicate scale token @0.5x — two rows produce the same folder.` — confirmed against the shipped 52-01 source (`variant-export.ts`, per-row `dupToken`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] esbuild lexer choked on a `**` + `*` glob literal inside the spec's header block comment**
- **Found during:** Task 1 (creating the equivalence spec)
- **Issue:** The file-header comment described the landmine using the literal `tests/**/*.ts` glob; esbuild's comment lexer reads the embedded `*/` (inside `**/*`) as the block-comment terminator → `Unexpected "*"` transform error, so vitest could not even parse the file.
- **Fix:** Reworded the comment to avoid the literal `**/*` glob (now "tests glob"), preserving the explanation. No code/assertion change.
- **Files modified:** tests/main/variant-token-equivalence.spec.ts
- **Verification:** `npx vitest run tests/main/variant-token-equivalence.spec.ts` → 5/5 pass; the only `*/` left is the legitimate block terminator.
- **Committed in:** `ad3950e` (Task 1 commit)

**2. [Rule 3 - Blocking] TS6307 — composite node project did not list the imported renderer helper**
- **Found during:** Task 1 (the `typecheck:node` landmine guard)
- **Issue:** The plan/PATTERNS asserted that importing the zero-import pure `variant-scale-derive.ts` from a `tests/main` file would typecheck cleanly via the import edge with NO tsconfig change. That is false for a `composite: true` project (`tsconfig.node.json:50`): tsc raises **TS6307** because an imported file must be EXPLICITLY in the project's `include` list (the modals dir was not — only `src/renderer/src/lib/**/*.ts` was). This is the inverse of the documented "add an exclude" landmine — the composite project wanted the file INCLUDED.
- **Fix:** Added `src/renderer/src/modals/*.ts` to `tsconfig.node.json` `include` (single-level `*.ts` pulls in ONLY the one pure helper; the sibling React/DOM `.tsx` modal files do not match and stay out of the no-DOM node program). This MIRRORS the existing `src/renderer/src/lib/**/*.ts` include for the same Layer-3 reason and KEEPS the test in `tests/main` (the entire point of D-05). No `exclude` was added.
- **Files modified:** tsconfig.node.json
- **Verification:** `npm run typecheck:node` exit 0; `npm run typecheck:web` exit 0 (no web-program regression); the new spec still 5/5.
- **Committed in:** `ad3950e` (Task 1 commit)

**3. [Rule 3 - Blocking] Acceptance grep `if (fs.existsSync(folder))` returned 1 due to an explanatory comment substring**
- **Found during:** Task 2 (D-08(a) acceptance verification)
- **Issue:** After removing the tolerant code branch, the acceptance grep `grep -c "if (fs.existsSync(folder))"` returned 1 — the leftover match was a literal substring inside my own explanatory comment describing the removed tolerance, not live code. The criterion's intent (the tolerant branch is gone) was met, but the literal gate would read RED.
- **Fix:** Reworded the comment to "the former folder-exists tolerance" so it no longer contains the literal grep substring. No assertion change.
- **Files modified:** tests/main/variant-batch-faithful.spec.ts
- **Verification:** `grep -c "if (fs.existsSync(folder))"` → 0; spec still 13/13; `typecheck:node` exit 0.
- **Committed in:** `1b531f8` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 blocking).
**Impact on plan:** All three are mechanical unblockers (a comment-lexer trap, a composite-project include requirement, and a comment-substring grep collision). None changed the test logic, the asserted behavior, or the D-05 placement intent. No scope creep; the `tsconfig.node.json` include is the minimal correct fix to keep the equivalence test in `tests/main` as D-05 mandates, and adds NO exclude.

## Issues Encountered

**Full-suite pre-existing failures (out of scope, NOT fixed).** `npx vitest run` shows 2 failing test files, BOTH byte-identical to the base commit `a8835a8` (`git diff --stat a8835a8 HEAD` on each is empty) and unrelated to the 52-04 changes:

1. `tests/main/sampler-worker-girl.spec.ts` — wall-time gate; the warm-up errors because `fixtures/Girl/` is absent in this worktree.
2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — throws `SkeletonJsonNotFoundError` for the absent `fixtures/SAMPLER_ALPHA_ZERO/...json`.

Both fail solely because their fixtures (local-only / not committed, per the project's json+atlas-only fixture convention) are not present in this worktree. Logged to `52-batch-export-robustness-variant-dialog-cleanup/deferred-items.md`. Out of scope per SCOPE BOUNDARY — not investigated or fixed; they should pass on a checkout with the full fixture set. The 52-04 target specs + both typechecks are fully green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All three Phase-52 regression locks (D-05 equivalence, D-08a orphan-gone, D-08b partial-failure) are in place and green; combined with sibling plans 52-01/02/03 this completes the EXPORT-06 hardening test coverage. Ready for `/gsd-verify-work 52`.
- One artifact note for the verifier: a `tsconfig.node.json` include line was added (`src/renderer/src/modals/*.ts`) to satisfy the composite project for the D-05 test — a wider edit than the plan's "tests-only" scope anticipated, but the minimal correct fix and behavior-preserving (no exclude, no source change).
- The 2 full-suite fixture-absence failures are environmental to this worktree (see deferred-items.md); re-verify the full suite on a checkout that has the local fixtures.

## Self-Check: PASSED

- FOUND: `tests/main/variant-token-equivalence.spec.ts` (created)
- FOUND: `tests/main/variant-batch-faithful.spec.ts` (modified)
- FOUND: `tsconfig.node.json` (modified)
- FOUND: `.planning/phases/52-batch-export-robustness-variant-dialog-cleanup/52-04-SUMMARY.md`
- FOUND commit: `ad3950e` (Task 1 — D-05 cross-boundary equivalence lock)
- FOUND commit: `1b531f8` (Task 2 — D-08 orphan-gone tightening + dup partial-failure regression)

Verification re-run against the worktree source: both target specs = 18/18 passed; `typecheck:node` exit 0; `typecheck:web` exit 0; grep gates green (`toBe(formatScaleToken`=6, `0.30000000000000004`=6, `0.50001`=3 in equivalence spec; `if (fs.existsSync(folder))`=0, `orphan empty dir survived rollback`=1, `Duplicate scale token`=1 in batch-faithful); no new committed fixture dir.

---
*Phase: 52-batch-export-robustness-variant-dialog-cleanup*
*Completed: 2026-05-24*
