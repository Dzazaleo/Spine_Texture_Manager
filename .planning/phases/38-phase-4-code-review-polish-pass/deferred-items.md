# Phase 38 — Deferred Items (out-of-scope discoveries during execution)

Items discovered during plan execution that are not directly caused by the
plan's task changes. Logged per executor scope-boundary policy.

## Discovered during 38-02 execution (2026-05-13)

### Pre-existing test failures unrelated to OverrideDialog

Two test files fail on the **baseline** (verified by `git stash` of the
OverrideDialog patch + re-running just those files):

1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts`
   - `sampler — skin-declared but never-bound attachments are measured (regression for silent-discard at sampler.ts:285)`
   - Symptom: 1 test fails.

2. `tests/main/sampler-worker-girl.spec.ts`
   - `sampler-worker — Wave 1 N2.2 wall-time gate (fixtures/Girl) > fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json samples in <8000 ms`
   - Symptom: warm-up run returns `type === 'error'` instead of `'complete'`.
   - Likely root cause: fixture path / gitignored fixture (per
     `.planning/seeds/.../feedback_gitignore_fixtures_check_test_refs.md` memory —
     fixture may not be available in worktree checkout).

**Not Phase 38 scope.** Neither involves `src/renderer/src/modals/OverrideDialog.tsx`,
`tests/renderer/override-dialog-*`, or any IN-02 surface. Surfacing for the
orchestrator / next milestone planner to triage.

**Reproducibility:**
```bash
git stash push -- src/renderer/src/modals/OverrideDialog.tsx
npm run test -- tests/core/sampler-skin-defined-unbound-attachment.spec.ts tests/main/sampler-worker-girl.spec.ts
# 1 failed | 7 skipped (8) — same on baseline as with patch applied
git stash pop
```
