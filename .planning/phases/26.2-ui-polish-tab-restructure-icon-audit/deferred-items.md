# Phase 26.2 — Deferred Items

Out-of-scope discoveries logged during 26.2-01 execution per SCOPE BOUNDARY rule
(only auto-fix issues directly caused by the current task's changes).

## Pre-existing test failures (verified against base commit 8347cad — Task 1 only)

These 3 tests were already failing **before** any 26.2 plan changes touched the repo,
verified by `git stash && npm run test` against the immediate parent commit. None of
them touch `AppShell.tsx`, `TabButton`, or the tab-strip DOM. Logged here, not fixed.

| # | File | Failure mode | Likely cause (not investigated) |
|---|------|--------------|---------------------------------|
| 1 | `tests/integration/build-scripts.spec.ts` | "package.json version is 1.1.3" assertion fails | `package.json` is at v1.2.0 (shipped per memory `project_v12_shipped`); test contains a stale literal |
| 2 | `tests/main/sampler-worker-girl.spec.ts` | warm-up run returns `'error'` instead of `'complete'` | Sampler worker spawn issue in the worktree environment (Girl fixture path resolution or worker-thread plumbing) |
| 3 | `tests/renderer/atlas-preview-modal.spec.tsx` | dblclick → `onJumpToAttachment` not called | Atlas preview modal test, unrelated to AppShell tab restructure |

These should be triaged in a separate phase or follow-up todo, not in 26.2.
