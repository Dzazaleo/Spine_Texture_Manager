# Phase 48 — Deferred Items (out-of-scope discoveries during execution)

## 48-03 (Wave 2)

### [out-of-scope, pre-existing] tests/core/sampler-skin-defined-unbound-attachment.spec.ts fails in worktree
- **Found during:** 48-03 Task 2 full `tests/core/` sweep.
- **Why out of scope:** Its fixture `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json`
  is gitignored (`git check-ignore` matches) and absent from the worktree checkout — a local-only,
  uncommitted fixture. The failure is a worktree-environment artifact, NOT a regression. The
  scale-bake module reads no fs and no fixtures; 48-03 touched only `src/core/scale-bake.ts` +
  `tests/core/scale-bake.spec.ts`.
- **Already documented:** identical observation recorded in 48-01-SUMMARY.md "Issues Encountered".
- **Action:** none (SCOPE BOUNDARY — pre-existing, unrelated). The rest of the `tests/core/` sweep
  is 540 passed / 19 skipped / 1 todo; `tests/core/scale-bake.spec.ts` is 36/36 GREEN.
