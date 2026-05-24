# Phase 53 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during execution (per executor SCOPE BOUNDARY rule).
These are NOT fixed in this plan — they are pre-existing and unrelated to the
`variantRows` data-tier change.

## Pre-existing test failures (proprietary/non-committed fixtures absent in this worktree)

Discovered during the per-wave full `npm run test` run for plan 53-01. All three
failures are caused by the ABSENCE of gitignored proprietary fixture rigs in the
worktree filesystem (not by any code change in this plan). The affected specs read
fixtures via the real `node:fs` loader and error in `beforeAll`/warm-up because the
fixture directory does not exist.

| Spec | Cause | Notes |
|------|-------|-------|
| `tests/main/sampler-worker-girl.spec.ts` | `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` absent in this worktree | Sampler perf gate; warm-up run returns `error` (fixture not found). Unrelated to `.stmproj` / types / project-io. |
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `fixtures/SAMPLER_ALPHA_ZERO/` is gitignored (proprietary Joker rig — `.gitignore` L25-28) | Uses `describe.skipIf(process.env.CI)`; designed to skip on CI and run only where the proprietary fixture exists locally. Absent here → `loadSkeleton` errors in `beforeAll`. |
| `tests/core/documentation-roundtrip.spec.ts` | (RESOLVED in-plan, not deferred) | Initially failed because `makeBaseState` builds a `Partial` `AppSessionState` cast that omits `variantRows`; serialize's `.map` threw. Fixed in serialize with a defensive `?? []` mirroring the existing spread-tolerates-undefined idiom for `overrides`/`overridesAtlasLess`. |

The two sampler-fixture failures are environment-only (missing fixtures), match the
documented gitignore/skipIf design, and are out of scope for this data-tier plan. No
code change attempted.
