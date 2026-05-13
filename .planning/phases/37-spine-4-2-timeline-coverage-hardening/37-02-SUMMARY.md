---
phase: 37-spine-4-2-timeline-coverage-hardening
plan: 02
subsystem: testing
tags: [spine-4.2, fixture, InheritTimeline, sampler, regression-test, source-cited]

# Dependency graph
requires:
  - phase: 37-spine-4-2-timeline-coverage-hardening
    provides: Plan 37-01 audit-doc finding (Item 7 PASS + TIMELINE-02 conditional escalation TRIGGERED — locks TIMELINE-03 assertion direction as strict `peak(detached) > peak(baseline)`)
provides:
  - "fixtures/INHERIT_TIMELINE/INHERIT_TEST.json — 3-bone rig (root / PARENT / CHILD) + 1 slot + 1 region + 2 animations (BASELINE + INHERIT_DETACH)"
  - "fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas — single-region 100x100 atlas"
  - "fixtures/INHERIT_TIMELINE/INHERIT_TEST.png — placeholder PNG (copy of SIMPLE_TEST.png per PATTERNS.md S5)"
  - "tests/core/sampler.spec.ts — INHERIT_FIXTURE const + TIMELINE-03 it() block asserting strict peak(INHERIT_DETACH) > peak(BASELINE) on CHILD_SLOT/REGION; load-bearing regression contract for the InheritTimeline NoScale detach flow through state.apply -> bone.inherit -> updateWorldTransform"
affects: [37-03 rgba2-test-and-closure, REQ TIMELINE-03 closure]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spine InheritTimeline JSON shape (per SkeletonJson.js:711-718): per-bone `\"inherit\": [{\"time\": <number>, \"inherit\": \"<Inherit-enum-string>\"}, ...]` block under `animations.<name>.bones.<bone-name>.inherit`"
    - "Sampler peak captures the maximum of (setup-pose pass, animation passes). To force a strict differential between two animations on the same fixture, pin the bone setup-pose scale BELOW the differential point so the setup pass cannot mask the animation's peak (used here: PARENT setup scaleX/Y = 0.4 with both animations holding parent at 0.4 throughout)"
    - "Differential-fixture authoring rule: when asserting `peak(A) > peak(B)` strict, the rig must ensure (a) the differentiator (e.g., InheritTimeline tick) raises the active bone above its inherited-from-parent floor at some sampled tick, AND (b) no setup-pose or alternate-animation peak exceeds the differentiator's value — otherwise the strict-`>` collapses to equality"

key-files:
  created:
    - fixtures/INHERIT_TIMELINE/INHERIT_TEST.json
    - fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas
    - fixtures/INHERIT_TIMELINE/INHERIT_TEST.png
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/deferred-items.md
  modified:
    - tests/core/sampler.spec.ts

key-decisions:
  - "Fixture parent-bone curve flipped from plan's `1.0 -> 0.4 -> 1.0` ramp to constant 0.4 throughout BOTH animations, plus PARENT setup-pose scaleX/scaleY = 0.4 baked into bones[]. Reason: the locked DC-02 assertion direction (peak(detached) > peak(baseline) strict) requires that no setup-pose or alternate-animation tick reaches the InheritTimeline NoScale value (1.0, child's own setup scale). With the original ramp, BOTH animations' peak collapsed to 1.0 (parent peaks at 1.0 at the endpoint keyframes, child inherits -> world=1.0), and the setup-pose pass independently captured world=1.0. Pinning parent to 0.4 everywhere reserves the 1.0 scale exclusively for the NoScale moment, preserving the locked assertion direction while making the fixture mechanics internally consistent. Documented as a Rule 1 (auto-fix bug) deviation in the Task 3 commit body."
  - "Test landing site: inside the existing `describe('sampler — sampleSkeleton (N1.1–N1.6, N2.1, N2.3)', ...)` block (line 44-307), inserted directly after the N2.1 perf-gate `it()` and immediately before the describe's closing `});`. Co-locates with the existing N1.x/N2.x sampler invariants per REQ TIMELINE-03 + plan D-04."

patterns-established:
  - "Per-animation isolation via `skeletonData.animations.filter((a) => a.name === target)` immediately after `loadSkeleton(FIXTURE)` — same approach the existing `perAnimationPeaks` helper uses at sampler.spec.ts:349-355. Local in-test helper preferred over hoisting to file scope when only one test uses it"
  - "Source-cite comments in differential tests: every assertion that proves a specific spine-core mutation flow should cite the writer-site (e.g., `Animation.js:755`) AND the reader-site (e.g., `Bone.js:144`) in the test commentary, so future readers can trace from the failing test to the audit-doc evidence chain"

requirements-completed: [TIMELINE-03]

# Metrics
duration: 6min
completed: 2026-05-13
---

# Phase 37 Plan 02: InheritTimeline Fixture + TIMELINE-03 Sampler Test Summary

**Fixture-driven regression contract proves the sampler lifecycle (state.update → state.apply → skeleton.update → updateWorldTransform) propagates the InheritTimeline NoScale detach (Animation.js:755 bone.inherit mutation → Bone.js:144 readback) — observed peak ratio 2.5x (BASELINE=0.4 vs INHERIT_DETACH=1.0).**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-13T12:39:08Z
- **Completed:** 2026-05-13T12:45:19Z
- **Tasks:** 3
- **Files created:** 4 (3 fixture artifacts + 1 deferred-items note)
- **Files modified:** 1 (`tests/core/sampler.spec.ts`)

## Accomplishments

- Created `fixtures/INHERIT_TIMELINE/` (atlas-source: JSON + .atlas + .png per CONTEXT.md D-03) with a 3-bone rig (root / PARENT / CHILD), single 100x100 REGION attachment on CHILD_SLOT, and two animations: BASELINE (parent stays at scale 0.4, CHILD inherits Normal) + INHERIT_DETACH (same parent + InheritTimeline keying CHILD Normal → NoScale → Normal at times 0.0 / 0.5 / 1.0). Spine 4.2.43.
- Added `INHERIT_FIXTURE` const + `TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline` it() block inside the existing `describe('sampler — sampleSkeleton (...)', ...)` block in `tests/core/sampler.spec.ts`. Test isolates each animation via `skeletonData.animations.filter(...)` then asserts strict `peak(detached) > peak(baseline)` on the CHILD_SLOT/REGION peak record.
- Observed peak values (deterministic at default 120 Hz): **BASELINE = 0.4** (from setup-pose pass since BASELINE animation holds parent at 0.4 throughout, child inherits → 0.4), **INHERIT_DETACH = 1.0** (animation peak at t ≈ 0.4917, the first tick after the InheritTimeline crosses the t=0.5 NoScale keyframe — child detaches from parent's 0.4, world scale = child's own setup 1.0). Strict ratio 2.5x — well above FP noise.
- Closed REQ TIMELINE-03 per the CONTEXT.md DC-02 locked assertion direction (load-bearing per the TIMELINE-02 conditional-escalation clause TRIGGERED in Plan 37-01 Item 7 audit finding).
- All 37 sampler tests in `tests/core/sampler.spec.ts` pass (1 pre-existing `EASING-CURVE STRETCH` skip preserved). New TIMELINE-03 test runs and passes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fixtures/INHERIT_TIMELINE/INHERIT_TEST.json (3-bone rig + 2 animations)** — `a311727` (test)
2. **Task 2: Create INHERIT_TEST.atlas + INHERIT_TEST.png placeholder bytes** — `7459de8` (test)
3. **Task 3: Add TIMELINE-03 it() block + INHERIT_FIXTURE const to tests/core/sampler.spec.ts (+ Rule 1 fixture mechanics fix)** — `b4c7d81` (test, includes amendment to Task 1's JSON fixture)

## Files Created/Modified

- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` — 3-bone Spine 4.2.43 skeleton with InheritTimeline rig. PARENT setup-pose scaleX/scaleY=0.4 baked into bones[] (Rule 1 fix; see Deviations); both animations hold parent at 0.4 throughout; INHERIT_DETACH keys CHILD inherit Normal → NoScale → Normal at 0.0 / 0.5 / 1.0. (Created in Task 1; mechanics amended in Task 3 to satisfy the locked DC-02 strict-`>` direction.)
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` — single-region atlas (REGION 100×100 at page-pixel 2,2 on a 128×128 page; filter:Linear,Linear; no rotate field).
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` — verbatim copy of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.png` per PATTERNS.md S5 Approach 1 (CLAUDE.md fact #4: math phase does not decode PNGs).
- `tests/core/sampler.spec.ts` — added `INHERIT_FIXTURE` const at file scope (line 41) and the `TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline` it() block at the end of the top-level describe (~lines 308-364). Comments cite `Animation.js:755` (write-site) and `Bone.js:144` (read-site) per PATTERNS.md S2 commentary style.
- `.planning/phases/37-spine-4-2-timeline-coverage-hardening/deferred-items.md` — logs two pre-existing test failures from gitignored missing local fixtures (SAMPLER_ALPHA_ZERO/, Girl/) — NOT caused by Plan 37-02.

## Decisions Made

**Primary decision:** Pin PARENT setup-pose scaleX/scaleY = 0.4 and hold parent at scale 0.4 throughout both animations, replacing the plan's literal `1.0 → 0.4 → 1.0` ramp curve.

**Rationale:** The plan's literal ramp curve would have produced `peak(BASELINE) == peak(INHERIT_DETACH) == 1.0` because:

1. The sampler's setup-pose pass independently captures world scale (PARENT setup=1.0 → CHILD inherits → world=1.0 in the original fixture).
2. BASELINE animation endpoint keyframes (t=0 and t=1.0) put PARENT at scale 1.0 → CHILD inherits → world=1.0.
3. INHERIT_DETACH animation peaks at the NoScale frame (t=0.5) with world=1.0 (CHILD's own setup scale).

All three sources independently hit 1.0, so strict `>` failed. The Rule 1 fix pins PARENT setup to 0.4 and removes the endpoint return-to-1.0 keyframes, so the only source of a 1.0 peak is the InheritTimeline NoScale moment in INHERIT_DETACH. This preserves CONTEXT.md DC-02's locked direction (load-bearing per D-01 TIMELINE-02 escalation TRIGGERED) while making the fixture mechanics internally consistent. Detailed in Task 3 commit body.

**Test landing site:** inside the existing top-level describe (the only top-level describe at line 44; the second describe at line 315 is for numeric-goldens which is a separate concern). Place the new test immediately before the describe's closing `});` (~line 308), after the N2.1 perf gate. Co-locates with the N1.x/N2.x sampler invariants per D-04.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixture parent-scale curve produced equal peaks instead of strict differential**

- **Found during:** Task 3 (running `npm test` after inserting the TIMELINE-03 it() block)
- **Issue:** The plan's literal fixture (parent scale `1.0 → 0.4 → 1.0` ramp; CHILD setup scaleX/Y defaulting to 1.0) produced `peak(BASELINE) == peak(INHERIT_DETACH) == 1.0000000000000018` — strict `>` failed. Three independent sources all hit 1.0: the sampler's setup-pose pass (PARENT setup=1.0 → CHILD inherits → world=1.0), the BASELINE animation endpoints (PARENT animated to 1.0 at t=0 and t=1.0), and the INHERIT_DETACH NoScale frame (CHILD's own setup=1.0). The plan's mechanics were internally inconsistent with the locked DC-02 strict-`>` direction.
- **Fix:** Replaced the parent scale ramp with `[{ x: 0.4, y: 0.4 }, { time: 1.0, x: 0.4, y: 0.4 }]` in BOTH animations (parent stays at 0.4 throughout the animation duration). Also baked PARENT setup-pose `scaleX: 0.4, scaleY: 0.4` into `bones[]` (eliminates the setup-pose pass overshadowing the animation peak). Resulting peaks: BASELINE=0.4 (setup-pose), INHERIT_DETACH=1.0 (animation peak at the NoScale frame). Strict 2.5x ratio, well above FP noise.
- **Files modified:** `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json`
- **Verification:** `npm test -- tests/core/sampler.spec.ts` → 37 passed, 1 skipped, 0 failed. Probe script confirmed observed peaks (BASELINE=0.4, INHERIT_DETACH=1.0).
- **Committed in:** `b4c7d81` (Task 3 commit body documents the mechanics fix alongside the test insertion)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** No scope creep — the fix is the smallest change needed to make the plan's locked assertion direction internally consistent with the fixture's mechanics. The plan's assertion direction (peak(detached) > peak(baseline) strict, load-bearing per TIMELINE-02 escalation TRIGGERED) is preserved verbatim — only the fixture's parent-scale curve and PARENT setup-pose scale were adjusted. Test name, fixture file paths, test landing site, and assertion expression all match the plan verbatim.

## Issues Encountered

- One temporary working-tree state-confusion during full-suite test verification: a `git checkout 56466bc -- .` (used to confirm the two unrelated failures predate Plan 37-02) reverted the working-tree copy of `tests/core/sampler.spec.ts` and `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` to the base-commit state. Recovered immediately via `git restore --source=HEAD --staged --worktree` of those two files — committed work was never at risk (all three task commits stayed in `git log`).

## Observed Peak Values (Traceability for Plan 37-03 + audit doc cross-reference)

Captured at default 120 Hz on the final fixture state:

| Animation | peakScale | peakScaleX | peakScaleY | worldW | worldH | time | animationName |
|---|---|---|---|---|---|---|---|
| BASELINE | 0.4000000000000007 | 0.4 | 0.4000000000000007 | 40.0000... | 40 | 0 | Setup Pose (Default) |
| INHERIT_DETACH | 1.0 | 1.0 | 1.0 | 100 | 100 | 0.4916666... | INHERIT_DETACH |

- **BASELINE peak is from the setup-pose pass** (`animationName === 'Setup Pose (Default)'`) — parent's setup scale 0.4 propagates to child via Normal inherit. The BASELINE animation also samples to 0.4 throughout, so the setup-pose pass and animation pass produce the same value and the setup-pose label wins by ordering.
- **INHERIT_DETACH peak is from the animation pass** at the first tick after the InheritTimeline crosses the t=0.5 NoScale keyframe (sampled tick t ≈ 1/240 + 59/120 = 0.4917). At this tick `bone.inherit = NoScale`, so `Bone.updateLocalToWorld` enters the NoScale branch at Bone.js:144 and uses CHILD's own setup scale (1.0) instead of inheriting parent's 0.4.
- **Ratio: 2.5x**, well above FP noise. Strict `>` assertion holds with substantial margin.

## Pre-existing Test Failures (NOT Plan 37-02 regressions)

Two unrelated test failures surfaced when running the full `npm test` suite. Both reference gitignored fixture directories that do not exist in this fresh worktree. Logged in `.planning/phases/37-spine-4-2-timeline-coverage-hardening/deferred-items.md`:

1. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — missing `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` (gitignored).
2. `tests/main/sampler-worker-girl.spec.ts` — missing `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (gitignored).

Both failures predate Plan 37-02. They reproduce on the base commit `56466bc` (verified by re-running on a clean checkout). Neither test file nor fixture is touched by Plan 37-02. Scope-boundary rule: out-of-scope, logged not fixed.

## Acceptance Criteria — All Pass

Task 1 acceptance criteria (10/10):

- `test -f fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` → PASS
- JSON parses → PASS (`node -e ...` exit 0)
- `animations.BASELINE` exists → PASS
- `animations.INHERIT_DETACH.bones.CHILD.inherit` exists → PASS
- InheritTimeline keyframe[1].inherit === 'NoScale' → PASS
- exactly 3 bones, 1 slot → PASS
- `grep -q '"hash": "INHERIT_42"'` → PASS
- `grep -q '"spine": "4.2.43"'` → PASS
- `grep -q '"INHERIT_DETACH"'` → PASS
- `grep -q '"BASELINE"'` → PASS

Task 2 acceptance criteria (8/8):

- `test -f INHERIT_TEST.atlas` → PASS
- `test -f INHERIT_TEST.png` → PASS
- atlas references `INHERIT_TEST.png` → PASS
- `size:128,128` → PASS
- `filter:Linear,Linear` → PASS
- `REGION` region declaration → PASS
- `bounds:2,2,100,100` matches JSON 100×100 → PASS
- no `rotate` field → PASS (avoids errors.ts:154 hard-fail)
- PNG size > 100 bytes → PASS (42,007 bytes)

Task 3 acceptance criteria (9/9):

- `INHERIT_FIXTURE = path.resolve('fixtures/INHERIT_TIMELINE/INHERIT_TEST.json')` declared → PASS
- `INHERIT_FIXTURE` referenced ≥ 2 times → PASS (count = 2)
- exact test name `TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline` → PASS
- test name occurrences = 1 (no duplicates) → PASS
- `expect(detachedChild!.peakScale).toBeGreaterThan(baselineChild!.peakScale)` present → PASS
- `Animation.js:755` cited in commentary → PASS
- `Bone.js:144` cited in commentary → PASS
- `npm test -- tests/core/sampler.spec.ts` exits 0 → PASS (37 passed, 1 skipped)
- verbose vitest output shows `TIMELINE-03` test ran → PASS (`✓ ... TIMELINE-03 ...`)

## Next Phase Readiness

**Plan 37-03 (RGBA2 test + SEED-005 closure) is unblocked.** Plan 37-01 (audit doc append) and Plan 37-02 (InheritTimeline fixture + test) both ship the source-cited PASS verdicts and locked regression contracts that 37-03 can reference when:

1. Writing the TIMELINE-04 RGBA2Timeline geometry-invariance test (synthetic injection per CONTEXT.md D-05).
2. Closing SEED-005 (`status: planted` → `status: closed`) with breadcrumb pointing at items 6 + 7 of the audit doc.

The fixture path conventions (`fixtures/INHERIT_TIMELINE/INHERIT_TEST.json`) and test-block placement conventions (inside the top-level describe, file-scope `*_FIXTURE` const, source-cite commentary) established here are ready for re-use if any RGBA2-related fixture pattern is needed (CONTEXT.md D-06 says no new fixture dir — synthetic-only — so this is informational).

## Self-Check: PASSED

Created files (verified on disk):
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` — FOUND (committed in `a311727`, amended in `b4c7d81`)
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.atlas` — FOUND (committed in `7459de8`)
- `fixtures/INHERIT_TIMELINE/INHERIT_TEST.png` — FOUND (committed in `7459de8`)
- `.planning/phases/37-spine-4-2-timeline-coverage-hardening/deferred-items.md` — FOUND (uncommitted, will be included in final metadata commit)

Modified files (verified on disk):
- `tests/core/sampler.spec.ts` — FOUND (committed in `b4c7d81`)

Commits (verified via `git log --oneline`):
- `a311727` — FOUND (`test(37-02): add INHERIT_TIMELINE fixture skeleton JSON`)
- `7459de8` — FOUND (`test(37-02): add INHERIT_TIMELINE atlas + placeholder PNG`)
- `b4c7d81` — FOUND (`test(37-02): add TIMELINE-03 InheritTimeline sampler test`)

---
*Phase: 37-spine-4-2-timeline-coverage-hardening*
*Completed: 2026-05-13*
