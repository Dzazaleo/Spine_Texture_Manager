# Phase 54 — Deferred / Out-of-Scope Items

Logged during execution of 54-01 (per executor scope-boundary protocol). These
are PRE-EXISTING failures NOT caused by this phase's changes (which touch only
`src/renderer/src/lib/**` + the two panels + the icon + AppShell + the two test
files — zero `src/core/` / `src/main/` / sampler edits). Proven pre-existing by
stashing ALL phase changes and re-running the two files — they fail identically.

## Worktree gitignored-fixture failures (environment, not code)

| File | Cause | Disposition |
|------|-------|-------------|
| `tests/main/sampler-worker-girl.spec.ts` | `fixtures/Girl/` is gitignored (152MB rig); not present in the worktree → the warm-up `runSamplerJob` errors on the missing skeleton JSON (`expected 'error' to be 'complete'`). The project's own PERF gate `skipIf(CI)`s Girl for exactly this reason; in a fresh worktree the fixture is simply absent. | OUT OF SCOPE — environment artifact of the gitignored fixture, not a regression. Do NOT fix. Passes wherever `fixtures/Girl/` is present (the user's main checkout). |
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` is gitignored / not present in the worktree → `SkeletonJsonNotFoundError`. | OUT OF SCOPE — same gitignored-fixture class. Do NOT fix. |

Both are independent of Phase 54 (renderer display-only). They will pass in any
checkout that has the gitignored fixtures on disk. The MixBlend renderer
import-failure baseline (memory `project_renderer_mixblend_preexisting_failure`)
did NOT appear in this worktree's run; the tooltip spec
`extrapolation-icon-tooltip.spec.tsx` is GREEN (9/9) under the new copy and is
NOT part of that baseline.
