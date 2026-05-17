---
phase: 43-runtime-adapter-facade-verified-4-3-api-mapping
plan: 05
subsystem: testing
tags: [spine-4.3, runtime-adapter, safe-02, baseline, rotated-region, vitest, git-worktree]

requires:
  - phase: 43-03
    provides: "rewired core (loader/sampler/bounds) reading load.runtime.* + Option A ESM seam; SAFE-02 strict gate"
  - phase: 43-04
    provides: "runtime-43.ts verified 4.3.0 Pose-API adapter (the surface this plan empirically validates)"
provides:
  - "4.3 own-baseline regression sentinel in the SEPARATE tests/runtime43/baselines/ store (D-01, NOT golden-shared with SAFE-01)"
  - "A1 (highest-risk PORT-03 rotated-region assumption) empirically resolved: FALSIFIED → Approach B applied + re-validated within 1e-4"
  - "D-03 SQUARE post-constraint canary (empirical proof runtime-43 reads appliedPose, not pre-constraint pose)"
  - "the committed 4.3 owner-rig fixture triplet (skeleton2.json/.atlas/.png); 4.2 sibling left untracked (D-05/Q2)"
  - "43-VERIFICATION.md with the D-04 hard close gate SATISFIED: 32/32 SAFE-02 byte-equal vs an independent frozen c5ef358 reference"
affects: [phase-44, phase-45, phase-46, runtime-43, sampler, safe-02]

tech-stack:
  added: []
  patterns:
    - "Independent frozen reference via isolated detached git worktree at the recorded golden generatedCommit (D-04 anti-tautology capture)"
    - "Approach-B rotated-region correction: SWAP-form offset math written into 4.3 sequence.offsets[i] (byte-identical to runtime-42)"

key-files:
  created:
    - tests/runtime43/baseline-driver.ts
    - tests/runtime43/baselines/skeleton2.json
    - .planning/phases/43-runtime-adapter-facade-verified-4-3-api-mapping/43-VERIFICATION.md
  modified:
    - src/core/runtime/runtime-43.ts
    - tests/runtime43/runtime43-baseline.spec.ts
    - tests/runtime43/runtime43-d03.spec.ts

key-decisions:
  - "A1 FALSIFIED: 4.3 native Sequence.update→computeUVs does NOT produce correct rotate:90 offsets for this packed-dim layout; Approach B (SWAP-form math into sequence.offsets[i]) applied + empirically re-validated vs the same-hash 4.2-sibling within 1e-4"
  - "D-04 frozen reference captured at c5ef358 (the trusted goldens' _meta.generatedCommit) in an isolated worktree — NOT a post-rewire self-capture, which would be tautological and mask drift"
  - "skeleton2_42.* deliberately NOT baselined/committed (Phase-44 ORCL-01-reserved; excluded from the SAFE-02 frozen set per D-05)"

patterns-established:
  - "Anti-tautology D-04 capture: frozen pre-rewire reference via detached worktree + npm ci + throwaway capture spec; baselines stay gitignored (D-08-R/D-09)"

requirements-completed: [PORT-01, PORT-02, PORT-03, SAFE-02]

duration: ~95min
completed: 2026-05-17
---

# Phase 43 Plan 05: 4.3 Own-Baseline + A1 Empirical Resolution + D-04 Hard Close Gate Summary

**A1 was empirically FALSIFIED (4.3 does NOT natively fix rotate:90 offsets) → Approach B applied to runtime-43 and re-validated within 1e-4; the D-04 hard close gate is SATISFIED — 32/32 SAFE-02 byte-equal (incl. all 5 proprietary rigs) against an independent frozen pre-rewire `c5ef358` reference, zero drift.**

## Performance

- **Duration:** ~95 min (incl. resumption of prior interrupted Task 1 work + the isolated-worktree D-04 frozen capture)
- **Completed:** 2026-05-17
- **Tasks:** 3/3 (Task 1 auto, Task 2 auto, Task 3 checkpoint:human-verify — D-04 gate satisfied via the user-chosen rigorous frozen-capture path)
- **Files modified/created:** 6 (3 created, 3 modified) + the committed 4.3 fixture triplet

## Accomplishments

- **A1 (the single highest-risk assumption) empirically resolved.** Approach A (4.3 native rotated-region no-op) was FALSIFIED against the same-session same-hash (`mFDzgNETPHo`) 4.2-sibling known-good; the rotate:90 world AABBs diverged well beyond 1e-4. Approach B was applied to `runtime-43.applyRotatedRegionFix` (allocate `sequence.offsets` via `updateSequence()`, then overwrite each rotated region's 8 floats with the SWAP-form corrected-offset math verbatim from `runtime-42`) and the A1 test now RUNS and PASSES within 1e-4.
- **Two additional [Rule 1 - Bug] cross-runtime defects fixed in runtime-43.ts** (surfaced for review at the checkpoint): `sequenceRegions` `length===0`→`<=1` (4.3's mandatory `HasSequence` had wiped every 4.3 peak); D-03 dev-assertion rewritten against the real 4.3 `Posed.d.ts` contract (the old assertion made the 4.3 sampler unrunnable).
- **4.3 own-baseline sentinel** captured in the SEPARATE `tests/runtime43/baselines/` store (D-01, not golden-shared); **D-03 SQUARE post-constraint canary** green (4.3 SQUARE peak == byte-trusted 4.2-sibling within 1e-4).
- **Exactly the 4.3 triplet committed** by explicit path; the Phase-44-reserved 4.2 sibling left untracked; SAFE-01 enumeration/baseline/freeze-guard stay green with no manifest/baseline change (D-05/Q2/D-09).
- **D-04 hard close gate SATISFIED.** Heavy-rig baselines captured from an independent frozen pre-rewire reference (isolated detached worktree at `c5ef358`); the rewired-tip 4.2 path is byte-identical across **20/20 heavy/proprietary rigs** (Girl/SKINS/CHJ/3Queens/Jokerman + others) **+ 12/12 redistributable = 32/32, 0 drift.**

## Task Commits

1. **Task 1: capture 4.3 own-baseline + A1 empirical validation + D-03 canary** — `bd3f4d0` (fix)
2. **Task 2: commit ONLY the 4.3 triplet (git-narrated)** — `d849726` (test)
3. **Task 2: draft 43-VERIFICATION.md (D-04 template + A1 resolution)** — `f895300` (docs)
4. **Task 3: D-04 hard close gate satisfied + filled 43-VERIFICATION.md + SUMMARY** — (this metadata commit)

## Files Created/Modified

- `src/core/runtime/runtime-43.ts` — Approach B `applyRotatedRegionFix`; `sequenceRegions` `<=1`; D-03 dev-assertion rewrite (3 [Rule 1] deviations)
- `tests/runtime43/baseline-driver.ts` — shared 4.3/4.2-sibling LoadResult driver + setup-pose AABB + SQUARE peak helpers
- `tests/runtime43/runtime43-baseline.spec.ts` — 4.3 own-baseline sentinel + A1 rotated-region empirical proof
- `tests/runtime43/runtime43-d03.spec.ts` — SQUARE post-constraint canary vs byte-trusted 4.2-sibling
- `tests/runtime43/baselines/skeleton2.json` — captured 4.3 own-baseline (SEPARATE store, D-01)
- `.planning/phases/43-.../43-VERIFICATION.md` — D-04 hard close gate record (SATISFIED) + A1 resolution + methodology
- `fixtures/SIMPLE_PROJECT_43/skeleton2.{json,atlas,png}` — committed 4.3 owner rig triplet (D-05/Q2)

## Decisions Made

- **A1 FALSIFIED → Approach B.** The plan anticipated this exact branch (it is `autonomous: false` precisely so a runtime-43 change surfaces for review). Approach B's math is byte-identical to `runtime-42`'s Phase-33 correction; only the write target differs (`sequence.offsets[i]` vs `attachment.offset[]`). The 4.2 path is unchanged (SAFE-02 byte-gates it; confirmed 32/32 byte-equal).
- **D-04 anti-tautology capture.** Capturing heavy baselines on the post-rewire tip would compare the rewired code against itself (a false pass that masks exactly the drift D-04 exists to catch). The frozen reference was instead captured at `c5ef358` (the trusted 12 goldens' recorded `generatedCommit`) in an isolated detached worktree with its own `npm ci` (original `spine-core@4.2.111`), then the gate was re-run on the tip.
- **skeleton2_42.\* intentionally excluded** from baselining/commit (Phase-44 ORCL-01-reserved; not in the frozen SAFE-02 set — D-05). Its `skipIf` skip is correct, designed behavior — not a coverage gap.

## Deviations from Plan

Three `[Rule 1 - Bug]` auto-fixed deviations, all in `src/core/runtime/runtime-43.ts`, all surfaced for review at the Task-3 checkpoint and recorded in `43-VERIFICATION.md`:

### Auto-fixed Issues

1. **[Rule 1 - Bug] A1 FALSIFIED → Approach B applied** — Found during Task 1 | The Plan-04 Approach-A no-op `applyRotatedRegionFix` was empirically disproven (rotate:90 AABBs diverged >1e-4 vs the 4.2-sibling known-good) | Replaced with Approach B (SWAP-form corrected offsets into `sequence.offsets[i]`, byte-identical formula to `runtime-42`) | `src/core/runtime/runtime-43.ts` | A1 test RUNS + PASSES within 1e-4; D-04 32/32 byte-equal | `bd3f4d0`
2. **[Rule 1 - Bug] sequenceRegions peak-wipe** — Found during Task 1 | 4.3's mandatory `HasSequence` gives every plain attachment a degenerate single-region holder; `length===0` returned the lone region → `fanOutSequencePeaks` wiped every 4.3 peak (0 vs the 4.2-sibling's 6) | `length===0` → `length<=1` (matches 4.2's "only genuine multi-frame sequences fan out" semantic) | `src/core/runtime/runtime-43.ts` | 4.3 own-baseline now has the full globalPeaks set; D-03 canary green | `bd3f4d0`
3. **[Rule 1 - Bug] D-03 dev-assertion premise false** — Found during Task 1 | Plan-04's assertion threw on `appliedPose === pose`, but 4.3 `Posed.d.ts:33-35` says that IS the normal state for unconstrained bones → the 4.3 sampler was unrunnable | Rewrote the guard to assert `appliedPose` is a usable `BonePose` (the real silent-undersize risk) | `src/core/runtime/runtime-43.ts` | 4.3 sampler runs; D-03 SQUARE post-constraint canary green vs byte-trusted 4.2-sibling | `bd3f4d0`

**Total deviations:** 3 auto-fixed (all [Rule 1 - Bug], all in runtime-43.ts, all reviewed at the human-verify checkpoint). **Impact:** Approach B is a deliberate, plan-anticipated runtime behavior change for the 4.3 path only; the 4.2 path is provably unchanged (D-04 32/32 byte-equal). Net positive — these fixes make the 4.3 adapter actually correct + runnable.

## Resumption Note

Task 1 was found substantially implemented but uncommitted from a prior interrupted run. Per the resumption + verify-don't-trust protocol, the work was inspected, its verification suite re-run green (A1/D-03/baseline all RAN, not skipped), then committed atomically. The plan executed inline (Pattern C / main context) per user choice; the Task-3 blocking checkpoint was satisfied via the user-selected rigorous frozen-capture path (Option A).

## Self-Check: PASSED

- key-files.created exist on disk: ✓ (`tests/runtime43/baseline-driver.ts`, `tests/runtime43/baselines/skeleton2.json`, `43-VERIFICATION.md`)
- git commits present: ✓ (`bd3f4d0`, `d849726`, `f895300` + this metadata commit)
- All task acceptance_criteria re-run and PASS: ✓ (Task 1: A1/D-03/baseline RUN+green, SAFE-01 untouched; Task 2: 3 tracked / 0 `_42`, manifest unchanged, D-09 clean; Task 3: D-04 32/32 byte-equal)
- Plan `<verification>` commands: ✓ green (`tests/runtime43/*`, `tests/safe01/*`, `git ls-files` scope, D-04 heavy arm RUN)
- No SAFE-01 corpus modification (D-09): ✓ (`git status --porcelain tests/safe01/` empty)
