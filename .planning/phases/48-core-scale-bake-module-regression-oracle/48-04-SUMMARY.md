---
phase: 48-core-scale-bake-module-regression-oracle
plan: 04
subsystem: core
tags: [scale-bake, regression-oracle, field-identity, spine-4.2, spine-4.3, similarity-bake, layer-3-purity, fixture-matrix]

# Dependency graph
requires:
  - phase: 48-01
    provides: src/core/scale-bake.ts setup-side bake (bones, constraints, attachments, scaled-defaults, D-09/D-10 guards)
  - phase: 48-03
    provides: src/core/scale-bake.ts completed BAKE-03 constraint-timeline channels (slider remap, PATH setup+timeline mode-gating, IK softness-curve cy)
  - phase: 48-02
    provides: committed SCALE_BAKE_* oracle fixtures (4.2/4.3/PATH_43) — json+atlas only, tracked
provides:
  - "tests/scale-bake.spec.ts — the decisive field-identity regression oracle: parse(bake(orig,s),1) is field-identical to parse(orig, SkeletonJson.scale=s) across an 8-rig matrix x 3 scales (24 assertions) + an 8-rig standing fixture-existence guard"
  - "tests/arch.spec.ts — optional Phase-48 Layer-3 named anchor for src/core/scale-bake.ts (range-free content-grep, belt-and-suspenders to the existing src/core/** glob)"
affects: [49-export-pipeline, 50-51-export-sizing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Oracle composes 3 existing CI-passing test patterns: Analog A (atlas-from-text single-arg ctor + direct SkeletonJson parse), Analog B (both-specifier co-import, runtime picked per-rig), Analog C (cycle-safe deep-compare promoted verbatim from spike bake.mjs)"
    - "Two-sided LIVE-reference equality (no golden numbers): the reference side is regenerated each run via spine-core's own SkeletonJson.scale, so the bake is proven == Spine's scaling rather than == a frozen snapshot"
    - "D-06a #3 standing fixture-existence guard hard-fails (no skipIf) so a missing freshly-committed fixture is a loud CI failure, never a green-wash"

key-files:
  created:
    - tests/scale-bake.spec.ts
  modified:
    - tests/arch.spec.ts

key-decisions:
  - "Reworded two explanatory comments to drop the literal substrings 'skipIf' and 'stubLoader' to satisfy the Task-1 acceptance greps (==0) — the documented Phase-48 acceptance-grep convention (mirrors the 48-01 'anim.deform' + 48-03 'proportional' comment rewords); zero behavioral change"
  - "Promoted the deep-compare from bake.mjs:96-121 (the ORACLE block) verbatim — baker.mjs has the bake body but NOT the oracle/deep-compare; PATTERNS Analog C cites bake.mjs"
  - "Used commit scope 48-04 (orchestrator + frontmatter authoritative); the plan body's '48-02' depends_on prose for the channel work is satisfied by the merged 48-03"

patterns-established:
  - "A pure-transform module's regression gate re-derives the reference live from the canonical library (spine-core SkeletonJson.scale) — field-identity, not golden snapshots, is the proof"

requirements-completed: [BAKE-01, BAKE-02, BAKE-03, BAKE-04]

# Metrics
duration: ~3min
completed: 2026-05-22
---

# Phase 48 Plan 04: Field-Identity Regression Oracle Summary

**Wired the decisive, sampling-free regression oracle `tests/scale-bake.spec.ts` proving `parse(bake(orig,s),1)` is field-identical to `parse(orig, SkeletonJson.scale=s)` across an 8-rig matrix x 3 scale factors (24 assertions, reference side generated LIVE — no golden numbers), plus an 8-rig D-06a-#3 standing fixture-existence guard that hard-fails on any missing fixture, and an optional range-free Phase-48 Layer-3 purity anchor in `tests/arch.spec.ts`.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-22T12:24:44Z
- **Completed:** 2026-05-22T12:28:04Z
- **Tasks:** 3 (2 implementation + 1 verification, the verification task producing 1 documentation artifact)
- **Files modified:** 2 (1 oracle created, 1 arch anchor added) + 1 deferred-items log appended

## Accomplishments
- **The oracle (BAKE-01..04 proof):** `tests/scale-bake.spec.ts` runs `parse(bake(orig,s),1)` vs `parse(orig, scale=s)` for all 8 matrix rigs at `[0.5, 0.26, 2.0]` = 24 field-identity assertions, all GREEN. Field-identity means the bake IS spine-core's own `SkeletonJson.scale` expressed on the JSON we control.
- **LIVE reference, zero goldens:** the reference side re-parses the original JSON at `scale=s` every run via spine-core's own scaling — so there are no hand-computed golden values to drift, which is exactly why the authored fixtures are low-risk.
- **D-08 two-sided coverage by construction:** because the equality is two-sided and runs at a non-round factor (0.26) AND an upscale (2.0), every must-stay-unscaled negative (IK mix-channel cy, normalized deform mix bezier, physics x/y, percent-default PATH position) is covered with NO separate negative assertions — any wrongly-scaled OR wrongly-unscaled field diverges from the live reference.
- **D-06a #3 standing guard, NO silent skip:** an 8-rig `it('fixture present: ...')` loop hard-fails with a `fixture not found: <rig>.json/.atlas` message if any matrix fixture is absent. The ENOENT-skip/return-null green-wash idiom is deliberately NOT used (the matrix includes freshly-committed fixtures whose tracking must be PROVEN).
- **Atlas-from-text, no PNG probe (D-04 / CLAUDE.md #4):** the parse helper builds `TextureAtlas` from `.atlas` TEXT with the SINGLE-ARG ctor (the current 4.3.0 API; the obsolete two-arg form is stale) and parses directly with `SkeletonJson` — never `loadSkeleton`/the facade, never a pixel byte.
- **Runtime picked per-rig (Analog B):** both spine-core specifiers co-imported (`@esotericsoftware/spine-core` 4.3.0 + `spine-core-42` 4.2.111), the reference parser chosen by each rig's pinned runtime (verified against each fixture's `skeleton.spine`: 4.3.0x→sc43, 4.2.x→sc42). The bake itself is runtime-agnostic.
- **Optional Phase-48 Layer-3 anchor:** `tests/arch.spec.ts` gains a range-free content-grep block naming `src/core/scale-bake.ts` (belt-and-suspenders to the existing `src/core/**` glob which already enforces it with no carve-out). `scale-bake.ts` is enforced pure, NOT exempted.

## Matrix Coverage

All 8 fixtures verified TRACKED + not-ignored (committed in waves 1-2 / 48-02), so the standing guard passes in CI:

| Rig | Runtime | Channel exercised |
|-----|---------|-------------------|
| `fixtures/SCALE_BAKE_4_3/SKINS_SPINE_V02` | 4.3 | DEMON copy — all-types 4.3 + physics + slider(rotate→×1) + mesh |
| `fixtures/SCALE_BAKE_4_2/TEST_01` | 4.2 | deform-heavy all-four-types 4.2 |
| `fixtures/SCALE_BAKE_4_2/TEST_03` | 4.2 | 4.2 IK-softness-curve |
| `fixtures/SCALE_BAKE_PATH_43/PATH_FIXED` | 4.3 | synthetic path-Fixed timeline (the only on-disk source of positionMode/spacingMode Fixed) |
| `fixtures/spineboy_4.3/spineboy-pro` | 4.3 | IK-softness-curve |
| `fixtures/SLIDER_4_3/SLIDER-01` | 4.3 | slider remap (property x → spatial; the rig that exercises the slider slope) |
| `fixtures/SIMPLE_PROJECT_43/skeleton2` | 4.3 | 4.3 path setup |
| `fixtures/SIMPLE_PROJECT/SIMPLE_TEST` | 4.2 | 4.2 baseline |

## Task Commits

Each task was committed atomically:

1. **Task 1: field-identity oracle (matrix x 3 scales) + standing fixture guard** — `c2d08c3` (test)
2. **Task 2: optional Phase-48 Layer-3 named anchor in tests/arch.spec.ts** — `9b8bb6e` (test)
3. **Task 3: full-suite per-wave-merge sample (verification) + deferred-items log** — `30f7622` (chore)

_TDD note: this is a test-authoring plan (the module + fixtures already exist from waves 1-2), so the commits are `test(...)` for the two test artifacts and `chore(...)` for the deferred-items documentation. The oracle was GREEN on first run (32/32) — the bake (48-01/48-03) was already field-identical, which is the whole point: the oracle proves it._

## Files Created/Modified
- `tests/scale-bake.spec.ts` (188 lines) — the field-identity oracle. Imports `bake` from `../src/core/scale-bake.js` + both spine-core specifiers; defines the 8-entry MATRIX + `SCALES=[0.5,0.26,2.0]`; `parseAt` helper (single-arg TextureAtlas, direct SkeletonJson, per-runtime); `fieldMismatches` deep-compare (1e-3 rel tol, full SKIP set incl. id/hash/assetId, WeakSet cycle-break) promoted verbatim from spike `bake.mjs:96-121`; the standing fixture-existence guard (hard-fail, no skipIf); the oracle body (24 field-identity assertions). 32 tests total, all GREEN.
- `tests/arch.spec.ts` (+17 lines) — appended the Phase-48 Layer-3 named anchor (range-free content-grep, ENOENT-tolerant) for `src/core/scale-bake.ts`. 17 tests total (was 16), all GREEN.
- `.planning/phases/48-core-scale-bake-module-regression-oracle/deferred-items.md` (+25 lines) — logged the out-of-scope worktree-absent `fixtures/Girl/` failure surfaced by the Task-3 full-suite sample + a note reconciling the plan's MixBlend baseline.

## Decisions Made
- **Comment rewording for acceptance greps:** Task 1's acceptance criteria require `grep -c "skipIf"` and `grep -c "stubLoader"` to return 0. My explanatory comments initially contained both literal substrings ("NO skipIf", "the two-arg `(text, stubLoader)` form"). Reworded to "never conditionally skip" and "the obsolete two-argument (text + loader) form" respectively — same semantics, no literal substring. This is the established Phase-48 acceptance-grep convention (mirrors the `anim.deform` reword in 48-01-SUMMARY and the `proportional` reword in 48-03-SUMMARY). Zero behavioral change; all 32 oracle tests still GREEN after the reword.
- **Deep-compare source = `bake.mjs`, not `baker.mjs`:** `baker.mjs` carries the bake BODY but NOT the oracle/deep-compare; the `near`/SKIP/`fieldMismatches` block lives in `bake.mjs:96-121` (the `// ---- ORACLE ----` section). PATTERNS Analog C cites `bake.mjs` — promoted that block verbatim.
- **No `loadSkeleton`/facade routing:** the oracle uses the direct atlas-from-text path (D-04) — bulletproof with PNGs absent and keeps the ESM adapter seam off the critical path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment rewording to satisfy the `skipIf`==0 and `stubLoader`==0 acceptance greps**
- **Found during:** Task 1 (acceptance-criteria verification).
- **Issue:** Task 1's acceptance criteria require `grep -c "skipIf" tests/scale-bake.spec.ts` == 0 and `grep -c "stubLoader" tests/scale-bake.spec.ts` == 0. My explanatory header/comment prose contained both literal substrings (describing what the oracle deliberately AVOIDS — "NO skipIf", "the two-arg `(text, stubLoader)` form is stale"), making the greps return 1.
- **Fix:** Reworded the two comments — "never conditionally skip" (was "NO skipIf") and "the obsolete two-argument (text + loader) form" (was "two-arg `(text, stubLoader)` form"). The actual code (no `skipIf` call; single-arg `new Spine.TextureAtlas(atlasText)`) was already correct; only the prose changed.
- **Files modified:** tests/scale-bake.spec.ts
- **Verification:** `grep -c "skipIf"` → 0; `grep -c "stubLoader"` → 0; oracle re-run 32/32 GREEN.
- **Committed in:** `c2d08c3` (Task 1 commit).

(This is the same acceptance-grep comment-adjustment convention documented in 48-01-SUMMARY (`anim.deform`) and 48-03-SUMMARY (`proportional`) — a known Phase-48 pattern, no behavioral change.)

---

**Total deviations:** 1 auto-fixed (1 bug — acceptance-grep compliance, no behavioral change).
**Impact on plan:** Cosmetic comment-only change to satisfy two literal acceptance greps. The oracle's semantics are exactly as planned (no skipIf in code, single-arg TextureAtlas ctor in code). No scope creep.

## Full-Suite Per-Wave-Merge Sample (Task 3)

`npx vitest run` (the 48-VALIDATION.md per-wave-merge sample):
- **Result:** 1402 passed / 1 failed-test / 24 skipped / 2 todo across 139 test files (137 passed, 2 failed files).
- **`tests/scale-bake.spec.ts`:** 32/32 GREEN.
- **`tests/arch.spec.ts`:** 17/17 GREEN.
- **`tests/core/scale-bake.spec.ts` (the wave-1/2 unit spec):** 36/36 GREEN.

**The ONLY two failing files are gitignored-fixture worktree artifacts (NOT regressions):**
1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` → its fixture `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` is gitignored (`.gitignore:36`) and absent from the fresh worktree checkout. Already documented in 48-01-SUMMARY + 48-03-SUMMARY.
2. `tests/main/sampler-worker-girl.spec.ts` → its fixture `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` is gitignored (`.gitignore:22`) and absent from the worktree checkout.

**Proof these are NOT 48-04-caused:** my two test commits changed ONLY `tests/scale-bake.spec.ts` + `tests/arch.spec.ts` (`git diff --name-only c3141f3 HEAD`). Both failing specs are byte-identical to the wave base `c3141f3` (`git diff --quiet c3141f3 HEAD -- <spec>` → unchanged) and neither imports `scale-bake`. They fail purely because their local-only gitignored fixtures don't exist in this worktree. SCOPE BOUNDARY — not fixed, logged to `deferred-items.md`.

**Note on the plan's MixBlend baseline:** the plan cited the pre-existing `tests/renderer/*` MixBlend IMPORT failures as the expected baseline. Those renderer suites did NOT fail in this worktree run; the worktree-absent failures that surfaced instead are the two gitignored-fixture suites above — the SAME class of artifact (gitignored, local-only fixtures missing from a fresh worktree checkout) already documented for waves 1-2. There are ZERO new (non-gitignored-fixture) failures attributable to the oracle or the arch anchor.

**Authoritative-signal caveat:** local green != CI green. The binding signal is the watched per-OS run of BOTH `ci.yml` AND `release.yml` (they diverge — memory `feedback_release_yml_diverges_from_ci_yml`), where the gitignored fixtures' tracking and the all-3-OS behavior are decided. The orchestrator/verifier owns that gate. No tags pushed, no release triggered.

## Issues Encountered
- **`node_modules` absent in the fresh worktree:** the worktree was checked out without `node_modules`. Symlinked the main checkout's `node_modules` into the worktree for verification (`vitest`). The symlink is untracked (`git status` shows `??`), never staged (all commits stage files individually, never `git add .`/`-A`), and `node_modules/` is gitignored — verification-environment convenience only, no source impact. Identical to the 48-03 observation.
- **Two pre-existing gitignored-fixture suite failures** (documented above + in `deferred-items.md`) — out of scope, not regressions.

## TDD Gate Compliance
This is a test-authoring plan (the bake module + fixtures already shipped in waves 1-2), not a `type: tdd` feature cycle, and the per-task `tdd` flag does not apply (there is no production code to RED/GREEN — the oracle TESTS existing code). The oracle was GREEN on first run (32/32), which is the intended outcome: the bake (48-01/48-03) was already field-identical and the oracle proves it. The two test artifacts are committed as `test(...)`; the documentation artifact as `chore(...)`. No `test→feat` gate sequence is expected or required for a test-only plan.

## Known Stubs
None — the oracle drives 8 real, committed fixtures end-to-end with no placeholders, no mock data, no TODO/FIXME. The reference side is the live spine-core parser; the bake side is the real `bake()` import.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **Phase 49+ (export pipeline):** the bake is now CI-gated by a field-identity oracle — any future change to `src/core/scale-bake.ts` that drifts from spine-core's `SkeletonJson.scale` on any of the 8 matrix rigs (across 4 channels x 2 runtimes x 3 scales) fails the oracle loudly. BAKE-01..04 are proven by CI.
- **The variant-export arch (memory `project_multi_scale_peak_bone_world_scale`):** `variant_peak = s × master_peak` paired with the JSON→JSON `bake(orig, s)` is now provably faithful (the oracle is the `baked@1 ≡ orig@SkeletonJson.scale=s` proof, SEED-010's required gate).
- **Orchestrator-owned:** STATE.md / ROADMAP.md / REQUIREMENTS.md writes are deferred to the orchestrator after the wave merges (worktree mode — this executor does NOT touch shared files). The authoritative all-3-OS ci.yml + release.yml signal is also orchestrator/verifier-owned.

## Self-Check: PASSED

- FOUND: tests/scale-bake.spec.ts
- FOUND: tests/arch.spec.ts (Phase 48 Layer 3 anchor present)
- FOUND: .planning/phases/48-core-scale-bake-module-regression-oracle/48-04-SUMMARY.md
- FOUND commit: c2d08c3 (Task 1 — oracle)
- FOUND commit: 9b8bb6e (Task 2 — arch anchor)
- FOUND commit: 30f7622 (Task 3 — deferred-items log)

---
*Phase: 48-core-scale-bake-module-regression-oracle*
*Completed: 2026-05-22*
