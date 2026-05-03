# Phase 22.1 Plan 01 — Deferred Items

## Pre-existing failures (out of scope, not caused by plan 01 changes)

### tests/main/sampler-worker-girl.spec.ts — Girl fixture absent in worktree

**Status:** Pre-existing failure (confirmed via git stash test)
**Test:** `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms`
**Root cause:** The `fixtures/Girl/` directory is gitignored in the worktree environment. The test uses `it.skipIf(process.env.CI)` but the CI env var is not set in the worktree shell, so the test runs and fails when `loadSkeleton` returns `{type: 'error'}` because the fixture file doesn't exist.
**Impact:** Zero — the Girl fixture is present on the developer's machine (main repo). This is a worktree-environment artifact only.
**Action:** None required. The test passes normally in the main repo checkout.
