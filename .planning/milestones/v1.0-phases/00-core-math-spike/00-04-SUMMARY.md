---
phase: 00-core-math-spike
plan: 04
subsystem: core-sampler
tags: [typescript, spine-core, sampler, physics, locked-lifecycle, 120hz, determinism]

# Dependency graph
requires:
  - phase: 00-02
    provides: "src/core/types.ts (SampleRecord, SourceDims, LoadResult) + src/core/loader.ts (loadSkeleton → LoadResult)"
  - phase: 00-03
    provides: "src/core/bounds.ts — attachmentWorldAABB(slot, attachment) + computeScale(aabb, sourceDims)"
provides:
  - "src/core/sampler.ts: sampleSkeleton(load, opts?) → Map<`${skin}/${slot}/${attachment}`, PeakRecord>. Default 120 Hz, configurable via opts.samplingHz. Locked tick order: state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)."
  - "src/core/sampler.ts: PeakRecord interface (extends SampleRecord with isSetupPosePeak: boolean), SamplerOptions interface, DEFAULT_SAMPLING_HZ = 120 const."
  - "Setup-pose pass per skin — any attachment not touched by any animation timeline reports with animationName = 'Setup Pose (Default)' and isSetupPosePeak = true."
  - "Physics.reset called ONCE per (skin, animation) pair before the tick loop → Physics.update every tick — the N1.6 determinism anchor."
  - "tests/core/sampler.spec.ts: 13 specs (6 behavioral + 7 module-hygiene grep tests). Locks N2.3 (no I/O) + locked lifecycle ordering + 120 Hz default + determinism into CI."
affects: [00-05, 00-06, 00-07]

# Tech tracking
tech-stack:
  added: []  # No new deps — uses spine-core (installed in 00-01) + existing vitest
  patterns:
    - "Single Skeleton+AnimationState reused across all (skin, animation) iterations — the locked lifecycle resets them between runs, no per-iteration allocation."
    - "Allocation-free fold: peaks.set(...) only when new scale strictly exceeds stored peak; hot path writes at most once per attachment per tick (CLAUDE.md rule #4 — no growing arrays)."
    - "Terminal-frame guard: `t <= duration + 1e-9` catches endpoint peaks AND handles zero-duration animations (first iteration always runs because 0 <= 0 + 1e-9)."
    - "Physics.pose for setup-pose pass (static, no physics stepping) vs Physics.reset once-per-animation + Physics.update every tick (determinism anchor) — all three Physics enum values used correctly per spine-core 4.2 semantics."
    - "Hygiene greps in spec file enforce N2.3 + lifecycle ordering in CI (not just in plan pre-commit) — same pattern bounds.spec.ts established in plan 00-03."

key-files:
  created:
    - "src/core/sampler.ts (251 lines)"
    - "tests/core/sampler.spec.ts (181 lines)"
  modified:
    - "src/core/types.ts (1-line comment fix — stale '__SETUP__' placeholder replaced with authoritative 'Setup Pose (Default)' label)"

key-decisions:
  - "Used state.setAnimationWith(0, anim, false) instead of setAnimation(0, anim, false) — the plan's interface block conflated these, but the installed spine-core 4.2.111 .d.ts splits them: setAnimation takes a name string, setAnimationWith takes the Animation object. Without this fix tsc --noEmit fails TS2345."
  - "Used Physics.pose (not Physics.update) for the setup-pose pass — setup pose should be static, Physics.pose recomputes world transforms without stepping physics. This matches spine-core semantics: pose=1, reset=1, update=2, pose=3 per Skeleton.d.ts enum."
  - "Committed spec file atomically with sampler.ts (deviation from plan's literal `git add src/core/sampler.ts`). Same reasoning as plan 00-03: the spec file locks N2.3 hygiene + lifecycle ordering into CI — without it, 'enforced by tests' degrades to 'enforced by one-off grep'. Rule 2 (missing critical test coverage)."
  - "Fixed stale types.ts comment. The SampleRecord.animationName JSDoc said `\"__SETUP__\" for setup-pose pass` — plan 00-04 locks the label as `\"Setup Pose (Default)\"` per CONTEXT.md and the plan's must_haves. Updated the comment to match so future maintainers see consistent documentation (Rule 1: stale prose now contradicts authoritative plan decision)."
  - "Reworded two JSDoc comments to avoid the literal token `skeleton.fps`. My initial prose used `skeleton.fps` directly to document CLAUDE.md rule #1; the plan's own grep `! grep -q \"skeleton.fps\" src/core/sampler.ts` would have failed. Reworded to 'skeleton JSON's fps field' / 'property-access expression `<skeleton>.<fps>` does not appear' (Rule 1: self-violating hygiene)."
  - "Commit scope uses `(00-04)` per GSD executor protocol rather than the plan example's `(phase-00)` — consistent with plans 00-02 / 00-03."

patterns-established:
  - "Sampler module template: reuse a single Skeleton + AnimationState across all iterations; reset them via setToSetupPose + clearTracks between animations. Future plan-05 peak aggregation can trust this allocation discipline."
  - "Locked-lifecycle documentation: JSDoc header diagrams the four-step tick order literally, with numbered comments in the hot loop marking the lines. Grep tests verify the four calls appear in the exact left-to-right source order (no interleaving)."
  - "Determinism via Physics.reset + Physics.update: the anchor that lets N1.6 assert bit-identical output across two sampleSkeleton runs. Spec includes direct determinism test (comparing maps field-by-field with === equality, not toBeCloseTo)."

requirements-completed: [F2.1, F2.2, F2.4, F2.6, F2.7]

# Metrics
duration: 5min
completed: 2026-04-22
---

# Phase 0 Plan 04: Per-Attachment Peak Sampler Summary

**`sampleSkeleton(loadResult, opts?)` iterates every (skin, animation) pair at 120 Hz default, folds per-tick world AABBs into a per-attachment `Map<attachmentKey, PeakRecord>`, with a setup-pose pass per skin — locked tick order `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` enforced by grep tests; Physics.reset once per animation anchors N1.6 determinism.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-22T12:01:29Z
- **Completed:** 2026-04-22T12:06:34Z
- **Tasks:** 2 (1 TDD implement + 1 atomic commit)
- **Files created:** 2 (sampler.ts 251 lines, sampler.spec.ts 181 lines)
- **Files modified:** 1 (types.ts — 1-line comment fix)
- **Tests:** 23/23 green total (13 sampler + 10 bounds carried forward)

## Accomplishments

- `sampleSkeleton` returns exactly 4 peak entries on SIMPLE_TEST (CIRCLE, SQUARE, TRIANGLE, and SQUARE2 — the slot that shares the SQUARE attachment), correctly excluding the PATH slot (PathAttachment returns null from bounds.ts).
- Smoke run on SIMPLE_TEST completes in **9.7 ms** — 50x under the N2.1 500 ms gate.
- Two sequential `sampleSkeleton(load)` calls produce bit-identical peak values (N1.6 determinism proven via field-by-field `===` equality in the spec).
- Default `samplingHz = 120` locked (CLAUDE.md rule #6); `{ samplingHz: 60 }` override works and returns the same key set.
- `Physics.reset` called ONCE per (skin, animation) pair before the tick loop; `Physics.update` every tick — ordering verified by grep test (`indexOf(reset) < search(forLoop)`).
- Locked tick order `state.update(dt) → state.apply(skeleton) → skeleton.update(dt) → skeleton.updateWorldTransform(Physics.update)` verified by left-to-right `indexOf` chain in the hygiene tests.
- Zero I/O imports (`node:fs|path|child_process|net|http`) — verified by grep. No `sharp` reference. No `skeleton.fps` read (CLAUDE.md rule #1).
- `PeakRecord` shape carries all F2.6 fields: attachmentKey, skinName, slotName, attachmentName, animationName, time, frame, scaleX, scaleY, scale, worldW, worldH, sourceW, sourceH — plus the `isSetupPosePeak` boolean flag.
- `npx tsc --noEmit` exits 0 under strict mode. `npm test` shows 23/23 pass in ~130 ms.

## Task Commits

1. **Task 1: Implement sampleSkeleton (the tick loop) [TDD]** — staged into Task 2's commit. TDD RED→GREEN cycle: wrote sampler.spec.ts first (13 failing tests — `Cannot find module sampler.js`), then sampler.ts (2 iterations to fix `setAnimation`→`setAnimationWith` TS error and `skeleton.fps` self-grep violation), final GREEN 13/13.
2. **Task 2: Commit sampler module** — `60709d6` (feat). Includes sampler.ts + spec + types.ts comment fix.

## Files Created/Modified

- `src/core/sampler.ts` (251 lines) — `sampleSkeleton` + `SamplerOptions` + `PeakRecord` + `DEFAULT_SAMPLING_HZ = 120` + private `snapshotFrame` helper. Imports `Skeleton`, `AnimationState`, `AnimationStateData`, `Physics` (values) from spine-core; `import type` for `LoadResult`, `SampleRecord`, `SourceDims`; `attachmentWorldAABB`, `computeScale` from `./bounds.js`. Zero `node:*` or `sharp` imports.
- `tests/core/sampler.spec.ts` (181 lines) — 13 specs:
  - 7 behavioral: peaks.size ≥ 3, setup-pose labeling, N1.6 determinism, samplingHz override, DEFAULT_SAMPLING_HZ constant, record shape, N2.1 perf smoke (<500 ms).
  - 7 module-hygiene: no node: imports, no sharp, no skeleton.fps, exports present, locked lifecycle ordering, Physics.reset before loop, (compound asserts inside sub-tests).
- `src/core/types.ts` — 1-line JSDoc comment fix for `SampleRecord.animationName` (stale `"__SETUP__"` → authoritative `"Setup Pose (Default)"`).

## Decisions Made

- **`state.setAnimationWith` instead of `setAnimation` for Animation-object overload.** The plan's interface block showed `setAnimation(trackIndex: number, animation: Animation, loop: boolean)`, but the installed spine-core 4.2.111 `AnimationState.d.ts` splits the overload: `setAnimation(trackIndex, animationName: string, loop?)` takes a name string, `setAnimationWith(trackIndex, animation: Animation, loop?)` takes the object. Passing an `Animation` to `setAnimation` causes TS2345. Used `setAnimationWith` — behaviorally identical, typechecks correctly under strict mode.
- **`Physics.pose` (not `Physics.update`) for the setup-pose pass.** Setup pose is static — no physics stepping needed. `Physics.pose` recomputes world transforms from the current pose without integrating physics forward. Matches spine-core enum semantics (Skeleton.d.ts: `none=0, reset=1, update=2, pose=3`). `Physics.reset` would also work here but is semantically wrong (reset is for "zero physics state before animation"); using `pose` is the most precise signal of intent.
- **Committed spec file atomically with sampler.ts (deviation from plan Task 2's literal `git add src/core/sampler.ts`).** Same reasoning as plan 00-03 deviation #2: the spec file locks N2.3 hygiene + lifecycle ordering + determinism into CI. Without it, future edits that break invariants would only be caught by the plan's one-off grep during this execution — strictly weaker guarantee. Rule 2 (missing critical test coverage).
- **Fixed stale `"__SETUP__"` comment in types.ts.** Pre-plan-04 the comment said `"__SETUP__" for setup-pose pass`. Plan 00-04 locks the label as `"Setup Pose (Default)"` per CONTEXT.md and the plan's must_haves. Left uncorrected, the comment would mislead future maintainers. Rule 1 (comment now contradicts authoritative plan decision).
- **Reworded two JSDoc comments to avoid the literal token `skeleton.fps`.** My initial prose explicitly named `skeleton.fps` while documenting that we don't read it — but the plan's own acceptance grep `! grep -q "skeleton.fps" src/core/sampler.ts` would have failed. Reworded to "skeleton JSON's fps field" (header) and "property-access expression `<skeleton>.<fps>` does not appear" (SamplerOptions doc). Semantically identical, grep-safe. Rule 1 (self-violating hygiene — same pattern as plan 00-03 deviation #1 with the word `sharp`).
- **Commit scope `(00-04)` per GSD executor protocol.** The plan's literal example was `feat(phase-00): …`; executor protocol specifies `{phase}-{plan}` = `00-04`. Consistent with 00-02 and 00-03 commits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] `state.setAnimation(0, anim, false)` does not typecheck under strict TypeScript**

- **Found during:** Task 1 (first tsc run after writing sampler.ts — `TS2345: Argument of type 'Animation' is not assignable to parameter of type 'string'`).
- **Issue:** Plan's action block proposed `state.setAnimation(0, anim, false)` where `anim: Animation`. The installed spine-core 4.2.111 splits the overload: `setAnimation` takes a `string` name, `setAnimationWith` takes the `Animation` object. The plan's `<interfaces>` block conflated these.
- **Fix:** Changed to `state.setAnimationWith(0, anim, false)`. Behaviorally identical, strict-TS-clean.
- **Files modified:** `src/core/sampler.ts` (line 139 + updated header JSDoc lifecycle diagram).
- **Verification:** `npx tsc --noEmit` exits 0; 13/13 sampler specs pass.
- **Committed in:** `60709d6`

**2. [Rule 1 — Bug] JSDoc comments containing `skeleton.fps` violated the plan's own hygiene grep**

- **Found during:** Task 1 (first spec run — the module-hygiene test `expect(src).not.toMatch(/skeleton\.fps/)` failed).
- **Issue:** My initial header + SamplerOptions JSDoc explicitly wrote `skeleton.fps` while documenting CLAUDE.md rule #1 ("we do not read `skeleton.fps`"). The text token `skeleton.fps` appears in the comment, breaking both (a) my spec's hygiene regex and (b) the plan's acceptance criterion `! grep -q "skeleton.fps" src/core/sampler.ts`.
- **Fix:** Reworded to "skeleton JSON's fps field" (header) and "property-access expression `<skeleton>.<fps>` does not appear" (SamplerOptions). Same meaning, grep-safe. This is the same self-violating-comment pattern plan 00-03 encountered with the word `sharp`.
- **Files modified:** `src/core/sampler.ts` (two JSDoc blocks).
- **Verification:** `grep -q "skeleton.fps" src/core/sampler.ts` exits 1; hygiene spec passes.
- **Committed in:** `60709d6`

**3. [Rule 2 — Missing critical test coverage] Committed `tests/core/sampler.spec.ts` atomically with sampler.ts**

- **Found during:** Task 2 staging.
- **Issue:** Plan's Task 2 literal `git add src/core/sampler.ts` omits the spec file. Without the spec, N2.3 ("no I/O in hot loop") + locked lifecycle ordering + determinism (N1.6) + 120 Hz default all degrade from "enforced by tests in CI" to "enforced by one-off grep in this plan's execution." Future edits could silently break any of those invariants with no test failure.
- **Fix:** `git add src/core/sampler.ts tests/core/sampler.spec.ts src/core/types.ts` — single atomic commit.
- **Files modified:** staged `tests/core/sampler.spec.ts` alongside the primary sampler.ts.
- **Verification:** `npm test` from `60709d6` checkout shows 13/13 sampler specs + 10/10 bounds specs green.
- **Committed in:** `60709d6`

**4. [Rule 1 — Bug] Stale `"__SETUP__"` comment in types.ts now contradicts the authoritative plan label**

- **Found during:** Task 1 (while reading types.ts to understand the `SampleRecord.animationName` shape).
- **Issue:** types.ts (created in plan 00-02) had a JSDoc comment: `/** "__SETUP__" for setup-pose pass; animation name otherwise. */`. Plan 00-04 locks the label as `"Setup Pose (Default)"` per 00-CONTEXT.md and the plan's must_haves. Leaving the comment would mislead future maintainers.
- **Fix:** 1-line edit — replaced `"__SETUP__"` with `"Setup Pose (Default)"` in the JSDoc. No behavior change, no new code.
- **Files modified:** `src/core/types.ts` (line 62 JSDoc).
- **Verification:** `npx tsc --noEmit` still clean; all 23 tests still pass.
- **Committed in:** `60709d6`

---

**Total deviations:** 4 (2 Rule 1 bugs, 1 Rule 2 missing test coverage, 1 Rule 1 stale-comment cleanup)
**Impact on plan:** Zero scope creep. All deviations are corrections to plan-embedded errors (setAnimation overload conflation, self-violating `skeleton.fps` comment) or strengthen the plan's own invariants (spec lock-in, consistent cross-file documentation). Externally-observable contract (`sampleSkeleton` signature, `PeakRecord` shape, `DEFAULT_SAMPLING_HZ`, locked lifecycle, determinism) matches the plan exactly.

## Exact spine-core 4.2 API calls used

Extracted directly from `node_modules/@esotericsoftware/spine-core/dist/*.d.ts` at install-time (spine-core 4.2.111):

| API | Where | Usage |
|---|---|---|
| `new Skeleton(skeletonData)` | `sampler.ts:109` | Mutable skeleton for sampling. Confirmed `Skeleton.d.ts` constructor. |
| `new AnimationStateData(skeletonData)` | `sampler.ts:110` | State-mixing data. Confirmed in `AnimationStateData.d.ts`. |
| `new AnimationState(stateData)` | `sampler.ts:111` | Per-sampler state machine. Confirmed in `AnimationState.d.ts:76`. |
| `skeletonData.skins: Skin[]` | `sampler.ts:113` | Iterate every skin. Confirmed in `SkeletonData.d.ts:49`. |
| `skeletonData.animations: Animation[]` | `sampler.ts:135` | Iterate every animation. Confirmed in `SkeletonData.d.ts:58`. |
| `skeleton.setSkin(skin)` | `sampler.ts:114` | Apply skin before sampling. Confirmed in `Skeleton.d.ts:131`. |
| `skeleton.setSlotsToSetupPose()` | `sampler.ts:115,137` | Reset slot state between animations. Confirmed in `Skeleton.d.ts:108`. |
| `skeleton.setToSetupPose()` | `sampler.ts:119,136` | Reset bones+slots to setup. Confirmed in `Skeleton.d.ts:104`. |
| `state.clearTracks()` | `sampler.ts:120,140` | Wipe any residual tracks. Confirmed in `AnimationState.d.ts`. |
| `state.setAnimationWith(trackIndex, animation: Animation, loop?: boolean)` | `sampler.ts:143` | Queue Animation object on track 0. Confirmed in `AnimationState.d.ts:93`. **NOTE:** plan's interface block showed the Animation-object overload under `setAnimation`, but `.d.ts` splits it — `setAnimation` takes a name string, `setAnimationWith` takes the object. |
| `skeleton.updateWorldTransform(Physics)` | `sampler.ts:121,146,153` | Triggered with `Physics.pose` (setup pass), `Physics.reset` (once per anim), `Physics.update` (tick). Confirmed in `Skeleton.d.ts` + `Physics` enum. |
| `state.update(dt: number)` / `state.apply(skeleton)` | `sampler.ts:150-151` | Tick pair. Confirmed in `AnimationState.d.ts`. |
| `skeleton.update(dt: number)` | `sampler.ts:152` | Physics integrator. Confirmed in `Skeleton.d.ts`. |
| `anim.duration: number` / `anim.name: string` | `sampler.ts:144,158` | Loop bound + label. Confirmed in `Animation.d.ts`. |
| `skeleton.slots: Slot[]` | `sampler.ts:207` | Iterate every slot per tick. Confirmed in `Skeleton.d.ts`. |
| `slot.getAttachment(): Attachment \| null` | `sampler.ts:208` | Current attachment on this slot. Confirmed in `Slot.d.ts`. |
| `slot.color.a: number` | `sampler.ts:211` | Canonical visibility check. Confirmed in `Slot.d.ts`. |
| `enum Physics { none=0, reset=1, update=2, pose=3 }` | `sampler.ts:121,146,153` | Three values used. Confirmed in `Skeleton.d.ts:184`. |

No speculative APIs used. Every import + call resolved against installed `.d.ts`.

## Known Stubs

None. `sampler.ts` is pure logic — every code path returns real computed values derived from spine-core output + bounds.ts math. Setup-pose pass, animation pass, peak fold — all fully implemented with no placeholders or TODOs.

## Issues Encountered

- **Plan's interface block had `setAnimation` signature wrong for Animation-object overload.** See Deviation #1. The 4.2 runtime splits the method into `setAnimation(name: string, …)` and `setAnimationWith(anim: Animation, …)`. Cost: one tsc round-trip. Worth flagging so future plans that lean on the same interface block don't inherit the same error.
- **My own JSDoc violated my own hygiene grep for `skeleton.fps`.** Same pattern plan 00-03 hit with `sharp`. Cost: one spec-run round-trip to reword. Fixable by future plans preferring "the skeleton's `<fps>` field" over `skeleton.fps` in documentation.
- No other issues. Tests passed 13/13 on second run after the two fixes above; perf smoke came in at 9.7 ms (50x under gate).

## Threat Mitigation Audit

| Threat ID | Disposition | Mitigation Applied |
|-----------|-------------|-------------------|
| T-00-04-01 (DoS via unbounded animation.duration) | accept | Per plan — Phase 0 is a local dev tool, no network exposure. No cap applied. Phase 10 may add one. |
| T-00-04-02 (non-deterministic physics) | mitigate | `Physics.reset` called exactly once per (skin, animation) pair before the tick loop; `Physics.update` every tick with exact `dt = 1/samplingHz`. Dedicated determinism test in `sampler.spec.ts` asserts bit-identical field values across two sequential `sampleSkeleton(load)` calls. ✓ |
| T-00-04-03 (hot-loop I/O info disclosure) | mitigate | `! grep -qE "from ['\"]node:(fs\|path\|child_process\|net\|http)['\"]" src/core/sampler.ts` ✓. Also enforced in spec: `expect(src).not.toMatch(/from ['\"]node:fs['\"]/)` ✓. `! grep -q "sharp" src/core/sampler.ts` ✓. Test file `sampler.spec.ts` reads the module as text via `fs.readFileSync` (which is fine — tests may I/O, the sampler module cannot). |
| T-00-04-04 (huge mesh alloc per tick) | accept | Per plan — bounds.ts allocates per-attachment Float32Array each tick. Phase 10 may pool. No mitigation applied at this plan. |

## Next Phase Readiness

- **Plan 00-05 (golden correctness tests — N1.2–N1.6)** is unblocked. The sampler's `Map<attachmentKey, PeakRecord>` is exactly the shape the golden suite will assert on: keys are `${skin}/${slot}/${attachment}`, values carry peak scale + source animation + time/frame for cross-checks. The determinism spec added here gives 00-05 a template for N1.6.
- **Plan 00-06 (CLI)** can reduce the `Map<attachmentKey, PeakRecord>` directly into Screenshot-1 table columns: `attachmentName | skinName | sourceW×sourceH | worldW×worldH | scale | animationName | frame`. No additional transformation needed.
- **Plan 00-07 (N2.1 perf gate + golden fixture)** inherits a sampler that already smoke-tests under 10 ms on SIMPLE_TEST — the 500 ms gate is not a concern; the real test is complex-rig N2.2 in Phase 10.
- **No blockers.** All acceptance criteria from 00-04-PLAN.md pass.

## Self-Check: PASSED

Verified 2026-04-22T12:06:34Z:

- `[ -f src/core/sampler.ts ]` ✓ (251 lines)
- `[ -f tests/core/sampler.spec.ts ]` ✓ (181 lines)
- `git log --oneline | grep 60709d6` ✓
- `npx tsc --noEmit` exit 0 ✓
- `npm test` 23/23 green (13 sampler + 10 bounds) in ~130 ms ✓
- `grep -q "export function sampleSkeleton" src/core/sampler.ts` ✓
- `grep -q "DEFAULT_SAMPLING_HZ = 120" src/core/sampler.ts` ✓
- `grep -q "Physics.reset" src/core/sampler.ts` ✓
- `grep -q "Physics.update" src/core/sampler.ts` ✓
- `grep -q "state.update(dt)" src/core/sampler.ts` ✓
- `grep -q "state.apply(skeleton)" src/core/sampler.ts` ✓
- `grep -q "skeleton.update(dt)" src/core/sampler.ts` ✓
- `grep -q "skeleton.updateWorldTransform(Physics.update)" src/core/sampler.ts` ✓
- `grep -qE "for \(let t = 0; t <= " src/core/sampler.ts` ✓
- `! grep -qE "from ['\"]node:(fs|path|child_process|net|http)['\"]" src/core/sampler.ts` ✓
- `! grep -q "sharp" src/core/sampler.ts` ✓
- `! grep -q "skeleton.fps" src/core/sampler.ts` ✓
- Smoke run on SIMPLE_TEST fixture: `peaks= 4 elapsed= 9.7 ms` ✓ (size ≥ 3, elapsed < 500 ms — both acceptance criteria met)
- Smoke run keys: `default/CIRCLE/CIRCLE`, `default/SQUARE/SQUARE`, `default/SQUARE2/SQUARE`, `default/TRIANGLE/TRIANGLE` — correct (PATH skipped via bounds.ts null return; SQUARE2 slot uses SQUARE attachment, keyed distinctly by slot name) ✓
- `git status --porcelain src/core/sampler.ts tests/core/sampler.spec.ts src/core/types.ts` empty ✓
- Post-commit deletion check: no unexpected deletions ✓

## TDD Gate Compliance

Plan 00-04 Task 1 declares `tdd="true"`. Sequence followed:

1. **RED gate:** Wrote `tests/core/sampler.spec.ts` first (13 specs, all failing with `Cannot find module sampler.js`). Verified failure before writing implementation.
2. **GREEN gate:** Wrote `src/core/sampler.ts`. Iterated twice (fix `setAnimation`→`setAnimationWith` TS error, fix `skeleton.fps` self-grep violation). All 13 specs pass.
3. **REFACTOR gate:** Not taken — implementation was written to final form after the two bug fixes; no structural rewrite would improve it without adding scope.

Per the plan's explicit Task-2 atomic-commit gate, RED and GREEN commits are collapsed into a single `feat(00-04)` commit. This matches the precedent set by plan 00-03's TDD cycle. `git log --oneline -1` shows `60709d6 feat(00-04): per-attachment peak sampler with locked tick order`.

---
*Phase: 00-core-math-spike*
*Completed: 2026-04-22*
