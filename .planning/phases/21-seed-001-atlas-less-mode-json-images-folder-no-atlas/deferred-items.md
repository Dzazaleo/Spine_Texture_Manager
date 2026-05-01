# Phase 21 — Deferred Items

Out-of-scope discoveries logged during plan execution. NOT auto-fixed; follow-up
required by phase verifier or future plan author.

## Plan 21-01 (png-header) — 2026-05-01

### D-21-WORKTREE-1 — fixtures/Girl absent in agent worktree

**Where:** `tests/main/sampler-worker-girl.spec.ts:38`
**Symptom:** `warmup.type` returns `'error'` (not `'complete'`); test fails locally in
the agent worktree but passes in the parent repo.
**Root cause:** `fixtures/Girl/` is gitignored (licensed third-party rig per
`.gitignore:22`); the parallel-executor worktree was created from a fresh checkout
without the fixture present on disk. The test correctly handles the CI case via
`.skipIf(process.env.CI)` but does NOT handle the local-but-fixture-missing case.
**Why deferred:** Pre-existing environmental issue UNRELATED to the Plan 21-01
PNG header reader changes. Reproduces on `main` branch with no Plan 21-01 commits.
**Fix recipe:** Either (a) extend the `.skipIf` predicate to also skip when
`fs.existsSync(SKELETON_PATH)` is false, or (b) document the worktree-execution
caveat in `tests/main/sampler-worker-girl.spec.ts` header comment. Discuss with
phase verifier — this might also affect Plans 21-02..21-08 worktree executions.

## Plan 21-05 (types cascade) — 2026-05-01

### Pre-existing TS6133 warnings

Verified by stashing this plan's diffs and re-running `npm run typecheck` against the base commit `f09c29b`:
- `src/renderer/src/panels/AnimationBreakdownPanel.tsx:286` — `'onQueryChange' is declared but its value is never read.`
- `src/renderer/src/panels/GlobalMaxRenderPanel.tsx:531` — `'onQueryChange' is declared but its value is never read.`

Out of scope for Plan 21-05 (pure type cascade for atlasPath/SourceDims/LoaderOptions); did NOT touch these panel files. Both warnings exist on the unmodified base — not caused by this plan.

### Pre-existing vitest failure (same root cause as D-21-WORKTREE-1)

`tests/main/sampler-worker-girl.spec.ts` — "warm-up run must complete (not error/cancel)". Verified by stashing this plan's diffs and running the spec on the base commit `f09c29b` — same failure. Not caused by Plan 21-05's type widening (the test never touches `atlasPath`, `SourceDims.source`, or `LoaderOptions.loaderMode`). Same root cause as D-21-WORKTREE-1: missing `fixtures/Girl` test fixture in worktree environment.
