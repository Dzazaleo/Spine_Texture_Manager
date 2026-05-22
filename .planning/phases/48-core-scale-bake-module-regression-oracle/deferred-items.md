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

## 48-04 (Wave 3)

### [out-of-scope, pre-existing] tests/main/sampler-worker-girl.spec.ts fails in worktree
- **Found during:** 48-04 Task 3 full `npx vitest run` per-wave-merge sample.
- **Why out of scope:** Its fixture `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` is gitignored
  (`.gitignore:22 fixtures/Girl/`; `git check-ignore` matches) and absent from the worktree
  checkout — a local-only, uncommitted fixture (same mechanism as the `SAMPLER_ALPHA_ZERO` item
  above). The warm-up run errors because `loadSkeleton` cannot read the absent JSON; this is a
  worktree-environment artifact, NOT a regression.
- **Proof not 48-04-caused:** the spec is byte-identical to the wave base `c3141f3`
  (`git diff --quiet c3141f3 HEAD -- tests/main/sampler-worker-girl.spec.ts` → unchanged); 48-04's
  two commits touched ONLY `tests/scale-bake.spec.ts` + `tests/arch.spec.ts`. Neither failing
  spec imports `scale-bake`.
- **Action:** none (SCOPE BOUNDARY — pre-existing, unrelated). The full suite is otherwise
  1402 passed / 24 skipped / 2 todo; the ONLY two failing files are these two gitignored-fixture
  worktree artifacts. `tests/scale-bake.spec.ts` (32/32) + `tests/arch.spec.ts` (17/17) are GREEN.

### Note on the plan's MixBlend baseline
The 48-04 plan cited the pre-existing `tests/renderer/*` MixBlend IMPORT failures as the expected
baseline. In this worktree run those renderer suites did NOT fail — the worktree-absent failures
that surfaced instead are the two gitignored-fixture suites above (`SAMPLER_ALPHA_ZERO` + `Girl`),
which are the same CLASS of artifact (gitignored, local-only fixtures missing from a fresh worktree
checkout) already documented for 48-01/48-03. There are ZERO new (non-gitignored-fixture) failures
attributable to the oracle or the arch anchor.
