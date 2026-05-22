# Phase 50 — Deferred / Out-of-Scope Items

Logged by the 50-01 executor per the SCOPE BOUNDARY rule (pre-existing failures in
files NOT touched by this plan). NOT fixed — out of scope for 50-01 (rig-bounds).

## Pre-existing test failures — absent local fixtures (NOT a 50-01 regression)

Discovered during the 50-01 wave-merge regression sweep (`npm run test`). Both
failures are caused by IP-sensitive fixture directories that are **not git-tracked**
and **absent from a fresh worktree** (the worktree was reset to base `bcfeebb`).
Neither failing spec references `setup-bounds`, `computeSetupPoseBounds`, or `bbox`;
both spec files are byte-untouched by the 50-01 commits (`git diff bcfeebb..HEAD`
covers only the 7 plan files + the Rule-3 `documentation.spec.ts` mock fix).

| Spec | Failure | Missing fixture |
|------|---------|-----------------|
| `tests/main/sampler-worker-girl.spec.ts` | warm-up worker run returns `error` (wall-time gate) | `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (absent, not git-tracked) |
| `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` | `SkeletonJsonNotFoundError` at suite import (7 tests skipped) | `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` (absent, not git-tracked) |

**Root cause:** these fixtures carry IP-sensitive painted PNGs and are kept local-only
(CLAUDE.md folder conventions; memory `project_rigs_committable_json_atlas_only_no_png`).
They are present on the developer's machine + CI provisioning, but not in this
isolated agent worktree.

**Disposition:** out of scope for 50-01. The full suite is otherwise GREEN
(144/146 files; 1454 passed). The orchestrator / CI run on the canonical tree (with
the fixtures provisioned) is authoritative for these two specs.
