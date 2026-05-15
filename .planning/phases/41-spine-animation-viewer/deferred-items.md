# Phase 41 — Deferred Items

Out-of-scope items discovered during plan execution. Per executor deviation rules, these are NOT fixed inside the plan that found them.

## DEF-41-01-01 — Worktree-isolated fixtures cause pre-existing test failures (Plan 01 discovery, 2026-05-15)

While running `npm test` (full suite) at the end of Plan 41-01 to confirm no regression, two pre-existing failures surfaced:

| Test File | Failure | Root cause |
|-----------|---------|------------|
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `SkeletonJsonNotFoundError: fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` | Fixture exists in main repo working tree (`/Users/leo/Documents/WORK/CODING/Spine_Texture_Manager/fixtures/SAMPLER_ALPHA_ZERO`) but is NOT in the worktree base commit `63e4a87` — local-only / gitignored asset, not part of the checked-in fixture set. |
| `tests/main/sampler-worker-girl.spec.ts` | warm-up run returns `'error'` instead of `'complete'` against `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` | Same root cause — `fixtures/Girl/` is in main working tree but not in the worktree base commit. |

**Why this is out of scope for Plan 41-01:** Plan 01 only touches `package.json`, `package-lock.json`, `src/shared/types.ts`, `src/preload/index.ts`, `src/main/ipc.ts`, and a new test file under `tests/main/`. None of those changes affect the sampler core, the loader, or the missing fixtures. The failures reproduce against the base commit `63e4a87` before any plan changes land — they are not regressions introduced by this plan.

**Verification:** The plan's own scoped suite `npm test -- tests/main/viewer-asset-feed-ipc.spec.ts` runs 4/4 green. TypeScript compilation (`npx tsc --noEmit`) is clean.

**Resolution path:** Either (1) gitignore the affected specs in worktree mode, (2) commit the missing fixtures into the repo if they're meant to be shared, or (3) the orchestrator's merge-back protocol restores the missing fixtures from the main worktree before re-running the suite post-merge. This is a worktree-tooling concern, not a Phase 41 concern.

## DEF-41-03-01 — Cross-plan import unresolved at Plan 03 commit time (Plan 03 discovery, 2026-05-15)

Plan 03 (`AppShell` wire-up) commits an `import { AnimationPlayerModal } from '../modals/AnimationPlayerModal'` statement that references a file owned by Plan 02 (running in parallel in a separate worktree). The file does not exist in this worktree.

| Consequence | Where |
|-------------|-------|
| `npx tsc --build` reports `error TS2307: Cannot find module '../modals/AnimationPlayerModal'` at `AppShell.tsx:67`. | TypeScript compile in worktree only |
| 9 renderer specs that transitively load `AppShell` fail at Vite-transform time with `Failed to resolve import "../modals/AnimationPlayerModal"`. | `app-elevation.spec.tsx`, `app-quit-subscription.spec.tsx`, `app-update-subscriptions.spec.tsx`, `appshell-mode-switch-divergence.spec.tsx`, `atlas-less-fallback-save-roundtrip.spec.tsx`, `loader-mode-toggle-disabled.spec.tsx`, `override-migration-banner.spec.tsx`, `rig-info-tooltip.spec.tsx`, `save-load.spec.tsx` |

**Why this is expected:** The orchestrator's parallel-execution prompt explicitly notes:

> Plan 02 (running in parallel) creates `src/renderer/src/modals/AnimationPlayerModal.tsx`. Your worktree base predates that file. Your `import { AnimationPlayerModal }` will reference an as-yet-uncreated file — that's expected; the wire-up resolves at merge time on main.

The contract is that Plan 02's modal file ships in its own worktree branch, and the merge-back to main combines both branches such that the import resolves cleanly. Plan 03 cannot reproduce these tests in isolation, by design.

**Verification that Plan 03's own work is correct:**

- `npm test -- tests/renderer/app-shell-animation-viewer.spec.tsx` → 13/13 pass (the spec for this plan).
- `npm test -- tests/renderer/app-shell-atlas-state.spec.tsx` → 7/7 pass (the closest analog spec — read-as-text, no Vite import resolution).
- All grep-based acceptance criteria pass against the modified `AppShell.tsx`.

**Resolution path:** Auto-resolves at merge-back. After both Plan 02 and Plan 03 land on main, `src/renderer/src/modals/AnimationPlayerModal.tsx` will exist, the AppShell import will resolve, all 9 transitively-failing specs will pass, and TypeScript compile will be clean. The orchestrator's verify-work step (after both worktrees merge) is where the post-merge re-run validates this end-to-end.

