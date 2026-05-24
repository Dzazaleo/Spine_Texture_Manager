---
phase: 52-batch-export-robustness-variant-dialog-cleanup
plan: 01
subsystem: export
tags: [variant-export, batch, rollback, continue-on-error, electron-main, node-fs]

# Dependency graph
requires:
  - phase: 51-batch-variant-export
    provides: "handleExportVariantBatch engine, exportOneVariant body, pushResult/variant:result live-red, per-variant written rollback Set (D-07), between-variants cancel (D-09)"
  - phase: 49-single-scale-variant-export
    provides: "formatScaleToken canonical token helper, exportOneVariant write-JSON-first + shared rollback sweep (T-49-ROLLBACK)"
provides:
  - "Per-row duplicate-token continue-on-error in handleExportVariantBatch (one bad token no longer aborts the whole batch)"
  - "readdir-empty outDir cleanup in exportOneVariant rollback catch (a failed variant leaves no orphan empty {NAME}@{s}x/ dir)"
affects: [52-04-batch-export-robustness-tests, phase-53-persist-variant-state]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Continue-on-error dup-skip: build a dupTokens Set, skip colliding rows via pushResult({status:'failed'})+continue (no break/rethrow), export the rest"
    - "Only-if-empty rollback dir removal: readdir(outDir).length===0 guard before recursive force-rm, so a pre-existing non-empty (overwrite=true) folder is never nuked"

key-files:
  created: []
  modified:
    - "src/main/variant-export.ts - per-row dup-skip in handleExportVariantBatch + readdir-empty outDir cleanup in exportOneVariant rollback catch"

key-decisions:
  - "D-01: replaced the whole-batch dedup abort with a dupTokens Set; the loop fails ALL rows sharing a duplicated token (fail-all-on-ambiguous, not keep-first) and exports every non-colliding scale (continue-on-error parity with 51 D-07)"
  - "D-03: rollback removes outDir ONLY if empty after the file sweep (readdir-length-0, the form already used by probeVariantBatchConflicts), preserving a pre-existing non-empty overwrite=true folder"
  - "D-09: all changes confined to error/edge/rollback paths; happy path byte-identical (12/12 faithfulness matrix stays green)"

patterns-established:
  - "dupTokens-Set continue-on-error: an ambiguous token that two+ rows map to fails per-row without ever calling exportOneVariant, so its folder is never created"
  - "readdir-empty rollback cleanup: only-if-empty guard makes the recursive force-rm safe — fires solely on a run-created, failed-to-populate leaf dir"

requirements-completed: [EXPORT-06]

# Metrics
duration: 3min
completed: 2026-05-24
---

# Phase 52 Plan 01: Batch Export Robustness (D-01 dup continue-on-error + D-03 no orphan dir) Summary

**Hardened `handleExportVariantBatch` so a single duplicate `@{s}x` token fails only its own row(s) instead of aborting the whole batch, and extended `exportOneVariant`'s rollback catch to remove a failed variant's freshly-created folder only when it is empty — happy path byte-identical.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-24T09:22:43Z
- **Completed:** 2026-05-24T09:25:33Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- **D-01 (WR-02):** Replaced the whole-batch dedup ABORT with a `dupTokens` Set. The export loop now skips ONLY the colliding rows via `pushResult({ token, status: 'failed', reason })` + `continue` (never calling `exportOneVariant`, so a colliding token's folder is never created), while every non-colliding scale exports normally. ALL rows sharing a duplicated token fail (fail-all-on-ambiguous). The `variantExportInFlight` re-entrancy guard and the between-variants cancel check are preserved unchanged.
- **D-03 (WR-03):** Added `readdir` to the `node:fs/promises` import and extended the `exportOneVariant` rollback catch so, after the existing `written` file sweep, the variant `outDir` is removed ONLY if `readdir(outDir).length === 0`. The only-if-empty guard preserves a pre-existing non-empty folder (the overwrite=true re-export case) — a failed variant leaves no orphan empty `{NAME}@{s}x/` dir.
- **D-09:** Both edits are confined to error/edge/rollback paths; the 12/12 faithfulness matrix (`variant-batch-faithful.spec.ts` Block 1) and the WR-01 degenerate-token regressions (`variant-scale-guard.spec.ts`) stay green, and `typecheck:node` is clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: D-01 — per-row duplicate-token continue-on-error in handleExportVariantBatch** - `01440dc` (fix)
2. **Task 2: D-03 — no orphan empty variant dir (readdir-empty cleanup in exportOneVariant rollback)** - `f6b9115` (fix)

_Note: STATE.md/ROADMAP.md are intentionally NOT updated by this worktree agent — the orchestrator owns those writes after the wave merges._

## Files Created/Modified
- `src/main/variant-export.ts` - (1) `handleExportVariantBatch`: the whole-batch abort is replaced by a `dupTokens` Set + a per-row skip in the export loop; (2) `exportOneVariant` rollback catch: only-if-empty `outDir` removal after the file sweep; `readdir` added to the `node:fs/promises` import.

## Decisions Made
- **D-01 dup reason copy kept verbatim** (`Duplicate scale token @${dupToken}x — two rows produce the same folder.`), now per-row using `dupToken` instead of the deleted block's `collision[0]` (CONTEXT D-01 + specifics).
- **D-03 empty-check form: `readdir(outDir).length === 0`** (not `stat`) — matches the form already used by the `probeVariantBatchConflicts` cousin and the orphan-probe test (CONTEXT/PATTERNS D-03 discretion). The recursive `fsRm(outDir, { recursive: true, force: true })` is bounded to the app-derived, run-created, verified-empty leaf dir (threat T-52-01 mitigated).
- **`outDir` is the correct scope variable** (variant-export.ts:152 `join(parentDir, \`${NAME}@${formatScaleToken(s)}x\`)`) — confirmed the dir that `skeleton-json-writer.ts mkdir` creates but never registers in `written`. `outDir` is deliberately NOT added to the `written` Set (that would risk the happy path); the readdir-empty check is the D-03 form.

## Deviations from Plan

None - plan executed exactly as written. Both tasks were applied verbatim to the specified sites in `src/main/variant-export.ts` with no auto-fixes required.

**Note on one acceptance-criterion grep (informational, not a deviation):**
Task 1's acceptance criterion `grep -c "const collision" src/main/variant-export.ts` expected `0`, but the actual result is `1`. The remaining match is the **pre-existing, unrelated** `const collisionSentinel` (variant-export.ts:212 — the source-path-vs-output collision guard inside `exportOneVariant`), which `grep -c "const collision"` matches as a substring. The criterion's true intent — "the old whole-batch abort is gone" — IS met: the abort's `const collision = [...seen.entries()].find(...)` and its `if (collision) { ... return }` block are fully removed and replaced by the `dupTokens` Set (verified: `dupTokens` count = 2; the deleted block's `[...seen.entries()].find` is gone). This is the documented substring-grep false-positive pattern; no code change is warranted.

## Issues Encountered
- **Working-directory / worktree mismatch (resolved, no damage):** Early Bash calls used the absolute main-repo path (`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager`), which resolves to the MAIN checkout (on branch `main`), not the per-agent worktree. The first Edit-tool changes landed in the main working tree. Detected before any commit; nothing was committed to `main`. Recovered by copying the edited `variant-export.ts` into the worktree, restoring the main working-tree copy to base via a file-specific `git checkout -- src/main/variant-export.ts` (never a blanket reset/clean), and thereafter running all git/test/typecheck operations against the worktree (`git -C <worktree>`, `--root <worktree>`, `-p <worktree>/tsconfig.node.json`; the worktree is nested under the main repo so Node resolves `node_modules` up the tree). Both task commits are on the correct `worktree-agent-*` branch. The pre-existing `.planning/STATE.md` working-tree change in the main repo was left untouched (not this agent's change).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The D-01 + D-03 behaviors are now implemented; Plan 52-04 adds the regression locks (D-08a tightens the orphan tolerance in `variant-batch-faithful.spec.ts:278` to a hard "folder is GONE" assertion; D-08b adds the WR-02 partial-failure regression). The existing `variant-batch-faithful.spec.ts` Block-2 continue-on-error test (which forces every variant to fail via `maxPageSize: 64`) already exercises the new D-03 catch on every iteration and stays green.
- No blockers. The `safetyBufferPercent` coercion (D-04), the equivalence test (D-05), and the dead-prop / onStart cleanups (D-06/D-07) are owned by sibling Plans 52-02/52-03/52-04, not this plan.

## Self-Check: PASSED

- FOUND: `src/main/variant-export.ts` (modified)
- FOUND: `.planning/phases/52-batch-export-robustness-variant-dialog-cleanup/52-01-SUMMARY.md`
- FOUND commit: `01440dc` (Task 1 — D-01 per-row dup continue-on-error)
- FOUND commit: `f6b9115` (Task 2 — D-03 readdir-empty rollback cleanup)

Verification re-run against the worktree source: `variant-batch-faithful.spec.ts` + `variant-scale-guard.spec.ts` = 24/24 passed; `typecheck:node` exit 0; `grep -c dupTokens` = 2; `grep -c readdir` = 2.

---
*Phase: 52-batch-export-robustness-variant-dialog-cleanup*
*Completed: 2026-05-24*
