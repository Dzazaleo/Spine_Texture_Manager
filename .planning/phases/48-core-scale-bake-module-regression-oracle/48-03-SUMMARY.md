---
phase: 48-core-scale-bake-module-regression-oracle
plan: 03
subsystem: core
tags: [scale-bake, json-transform, spine-4.3, constraint-timelines, slider-remap, path-mode-gating, ik-softness-curve, similarity-bake]

# Dependency graph
requires:
  - phase: 48-01
    provides: src/core/scale-bake.ts setup-side bake (bones, constraints, attachments, scaled-defaults, D-09/D-10 guards, carried translate/deform/ik-value walks)
provides:
  - "src/core/scale-bake.ts — completed BAKE-03 constraint-timeline channels: 4.3 slider remap slope, source-faithful PATH setup mode-gating, IK softness-timeline curve cy (channel-specific), mode-gated PATH position/spacing timeline walk"
affects: [48-04 regression-oracle, 49-export-pipeline, 50-51-export-sizing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Channel-specific bezier cy scaling: for multi-channel (IK) timelines scale only the scalable channel's cy by raw index (5/7), NOT the generic scaleCurve (which would corrupt the mix channel)"
    - "Mode-gate via case-normalized enum compare (.toLowerCase()) mirroring spine-core Utils.enumValue case-insensitivity; defaults positionMode=percent, spacingMode=length"
    - "Path-timeline owning-constraint resolution across the dual schema (4.3 j.constraints[] type==='path' OR 4.2 j.path[]) by name"

key-files:
  created: []
  modified:
    - src/core/scale-bake.ts
    - tests/core/scale-bake.spec.ts

key-decisions:
  - "Used the existing spatial() helper for slider propertyScale (x/y -> s, else 1) — identical to spine-core propertyScale(type, scale)"
  - "Dropped the stray physics-only c.limit no-op from the PATH setup branch (limit is never present on a path constraint; SkeletonJson.js:282/299)"
  - "Used commit scope 48-03 (orchestrator + frontmatter authoritative designation) — the plan body prose's '48-02' references are stale"

patterns-established:
  - "Generic scaleCurve stays bound ONLY to single-channel timelines (bone translate, path position/spacing); multi-channel IK uses explicit channel cy indexing"

requirements-completed: [BAKE-03]

# Metrics
duration: ~3min
completed: 2026-05-22
---

# Phase 48 Plan 03: BAKE-03 Constraint-Timeline Curve Channels Summary

**Completed the three constraint-timeline curve channels the spike left incomplete — the 4.3 slider remap slope (`from ×s`, `scale ÷ps`), the source-faithful PATH setup mode-gating (position iff Fixed, spacing iff Length||Fixed, case-normalized), the IK softness-timeline curve cy scaled on the softness channel ONLY (index 5/7, mix cy untouched), and a new mode-gated PATH position/spacing timeline walk — all transcribed field-identically from `SkeletonJson.js` and verified against the installed spine-core source.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-22T12:16:56Z
- **Completed:** 2026-05-22
- **Tasks:** 2 (both implementation, both `tdd="true"`)
- **Files modified:** 2 (1 module extended, 1 spec extended) + 1 deferred-items log created

## Accomplishments
- **Slider remap branch (BAKE-03 channel 3/3, Pitfall 4):** added the 4.3-only `slider` branch to the `constraintsOf` loop. When a bone is bound, `propertyScale` = `s` for spatial `x`/`y` (via the existing `spatial()` helper) else `1`; `from *= ps` and `scale /= ps` (slope). SLIDER_4_3 (`property:"x"`) is the tracked rig that exercises this; DEMON's `rotate` slider is `ps=1` (no spatial effect) — which is why the spike's missing branch went unnoticed.
- **PATH setup mode-gating correction (BAKE-03 channel 2/3 setup half, Pitfall 3):** replaced the spike's paraphrased `!== 'percent'` / `'proportional'` gates with the source-faithful, case-normalized `pm === 'fixed'` (position) and `sm === 'length' || sm === 'fixed'` (spacing). Proportional spacing is now correctly NOT scaled; percent-default position correctly stays ×1.
- **IK softness-timeline curve cy (BAKE-03 channel 1/3, Pitfall 2):** the IK keyframe `curve` is a flat 8-float, 2-channel array `[mixCx,mixCy,mixCx2,mixCy2, softCx,softCy,softCx2,softCy2]`. Scaled ONLY the softness-channel cy (`curve[5]`, `curve[7]`); the mix-channel cy (`curve[1]`, `curve[3]`) stays ×1. Guarded on `length >= 8` so stepped/short curves are untouched. Did NOT use the generic `scaleCurve` (it would corrupt the mix channel — RESEARCH Anti-Patterns).
- **PATH position/spacing timeline walk (BAKE-03 channel 2/3 timeline half):** added a new `anim.path[constraintName][channel]` walk (the spike never walked `anim.path`). Gated by the owning constraint's mode (case-normalized), resolving the constraint by name across the dual schema (4.3 `j.constraints[]` where `type==='path'`, OR 4.2 split `j.path[]`). Position channel scales value+cy iff `pm==='fixed'`; spacing iff `sm` in `length`/`fixed`; mix channel never scaled. These timelines are single-channel, so the generic `scaleCurve` is correct here.

## Source-Fidelity Verification

Each fix was cross-checked against the installed `node_modules/@esotericsoftware/spine-core@4.3.0/dist/SkeletonJson.js` before transcription:
- Slider: lines 327-337 (`propertyScale = this.propertyScale(property, scale)`, `from * propertyScale`, `scale / propertyScale`); `propertyScale(type, scale)` at 510-516 returns `scale` for `x`/`y` else `1`.
- PATH setup: lines 269-278 (`positionMode` default "Percent", `spacingMode` default "Length"; position scaled iff `Fixed`; spacing iff `Length || Fixed`).
- PATH timelines: lines 994/999 (`positionMode === Fixed ? scale : 1`, `spacingMode === Length || Fixed ? scale : 1`).
- IK timeline: lines 916-921 (`readCurve(..., 0, ..., 1)` mix channel scale=1; `readCurve(..., 1, ..., scale)` softness channel); `readCurve` at 1370-1382 (`i = value << 2`, cy at `curve[i+1]`/`curve[i+3]`) → softness (value-index 1) cy = `curve[5]`/`curve[7]`.

## Task Commits

Each task was committed atomically:

1. **Task 1: slider remap branch + source-faithful PATH setup mode-gating** — `30a8c72` (feat)
2. **Task 2: IK softness-timeline curve cy + PATH position/spacing timeline walk** — `22a7f8c` (feat)

_TDD note: both tasks are per-task `tdd="true"`. Each task added its behavior gates to `tests/core/scale-bake.spec.ts`, ran them RED (Task 1: 3 fails — slider untouched, percent-default scaled, fixed-spacing skipped; Task 2: 4 fails — IK cy unscaled, path position/spacing/4.2-split unscaled), then turned them GREEN with the `feat` commit. The spec is the task's contract, so spec+impl are authored in the same `feat` commit (no standalone `test(...)` RED-gate commit), matching the 48-01 convention._

## Files Created/Modified
- `src/core/scale-bake.ts` (224 lines, was 178) — added the `slider` branch, rewrote the `path` setup branch (case-normalized Fixed / Length||Fixed gates, dropped the dead `c.limit` no-op), extended the `anim.ik` walk with channel-specific curve cy (index 5/7), and added the mode-gated `anim.path` timeline walk.
- `tests/core/scale-bake.spec.ts` (added 2 describe blocks, 36 tests total, was 23) — slider spatial/non-spatial/no-bone, path Fixed/percent-default/Length/Fixed/proportional + case-insensitivity (Task 1); IK channel-specific cy + short-curve guard + path position/spacing/mix gating + 4.2-split resolution (Task 2).
- `.planning/phases/48-core-scale-bake-module-regression-oracle/deferred-items.md` (created) — logged the out-of-scope worktree-absent sampler fixture.

## Decisions Made
- **Reused the existing `spatial()` helper** (`p === 'x' || p === 'y'`) for the slider propertyScale rather than re-inlining the comparison — identical to spine-core's `propertyScale(type, scale)` semantics and already used by the transform branch.
- **Dropped the stray `c.limit` line** from the PATH setup branch (it was promoted verbatim from `baker.mjs:42` in 48-01). `limit` is a physics-only field (SkeletonJson.js:282/299), never present on a path constraint, so the line was a harmless dead no-op; the source-faithful path branch scales only `position`/`spacing`.
- **Commit scope `48-03`** per the orchestrator prompt + the plan frontmatter/objective (the authoritative designation for the BAKE-03 channels). The plan body prose contains stale `48-02` references inherited from an earlier numbering; the work delivered is unambiguously this plan's BAKE-03 scope.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment reworded to satisfy the `proportional`==0 acceptance grep**
- **Found during:** Task 1 (acceptance-criteria verification).
- **Issue:** Task 1's acceptance criterion requires `grep -c "proportional" src/core/scale-bake.ts` to return 0. My explanatory comment for the corrected gate contained the literal substring "Proportional ... `proportional` gates", making the grep return 1.
- **Fix:** Reworded the comment to "the percent-default position mode and the non-length/non-fixed spacing mode both stay x1" — same semantics, no literal `proportional` substring. The behavioral gate (`sm === 'length' || sm === 'fixed'`) is unchanged.
- **Files modified:** src/core/scale-bake.ts
- **Verification:** `grep -c "proportional"` → 0; all 36 tests still GREEN.
- **Committed in:** `30a8c72` (Task 1 commit).

(This mirrors the identical comment-grep adjustment documented in 48-01-SUMMARY for the `anim.deform` substring — a known acceptance-grep convention in this phase, no behavioral change.)

---

**Total deviations:** 1 auto-fixed (1 bug — acceptance-grep compliance, no behavioral change).
**Impact on plan:** Cosmetic comment-only change to satisfy a literal acceptance grep; bake semantics are exactly the RESEARCH-verified source transcription. No scope creep.

## Issues Encountered
- **Pre-existing, out-of-scope worktree test failure (NOT a regression):** `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` fails in this worktree because its fixture `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` is gitignored (`git check-ignore` matches) and absent from the worktree checkout — a local-only, uncommitted fixture. Identical to the observation already recorded in 48-01-SUMMARY. The scale-bake module reads no fs and no fixtures; 48-03 touched only `scale-bake.ts` + its spec. Not fixed (SCOPE BOUNDARY — pre-existing, unrelated). Logged to `deferred-items.md`. The rest of the `tests/core/` sweep is 540 passed / 19 skipped / 1 todo; `tests/core/scale-bake.spec.ts` is 36/36 GREEN.
- **`node_modules` absent in the worktree:** the worktree was checked out without `node_modules`. Symlinked the main checkout's `node_modules` into the worktree for verification (`tsc` + `vitest`). The symlink is untracked and never staged (root `.gitignore` covers `node_modules/`; all commits stage files individually). This is a verification-environment convenience only — no source impact.

## TDD Gate Compliance
Plan tasks are `tdd="true"` (per-task), not a plan-level `type: tdd` feature cycle. Each task wrote its behavior gates to the spec, ran them RED (Task 1: 3 fails; Task 2: 4 fails), then turned them GREEN with the `feat` commit. Per the 48-01 convention, spec+impl are authored in the same `feat` commit (the spec is the task's contract), so no standalone `test(...)` RED-gate commit exists — the RED run was observed and reported pre-implementation in both tasks.

## Known Stubs
None — the bake is a complete pure transform. All four channels are fully wired (no placeholders, no TODO/FIXME, no hardcoded empties). The 48-04 oracle is the field-identity proof across the fixture matrix.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- **48-04** can now wire the regression oracle (`parse(bake(orig,s),1) ≡ parse(orig,SkeletonJson.scale=s)`) against this completed `bake` — all three BAKE-03 channels are present, so the oracle's slider (SLIDER_4_3), IK-softness-curve (spineboy_4.3/TEST_03), and synthetic PATH-Fixed fixtures will field-match.
- The module type-checks (`tsc --noEmit -p tsconfig.node.json` exits 0), stays Layer-3 pure (imports nothing from spine-core; auto-enforced by the `tests/arch.spec.ts src/core/**` glob), and preserves all 48-01 setup-side behavior + the D-09/D-10 guards.
- BAKE-03 is satisfied. The plan's `<verification>` checks all pass: slider branch present, source-faithful path setup gate, IK softness curve cy (index 5/7 only — no mix-channel cy scaling), new mode-gated path-timeline walk; old paraphrased gates (`!== 'percent'`, `'proportional'`) removed.

## Self-Check: PASSED

- FOUND: src/core/scale-bake.ts
- FOUND: tests/core/scale-bake.spec.ts
- FOUND: .planning/phases/48-core-scale-bake-module-regression-oracle/deferred-items.md
- FOUND commit: 30a8c72 (Task 1)
- FOUND commit: 22a7f8c (Task 2)

---
*Phase: 48-core-scale-bake-module-regression-oracle*
*Completed: 2026-05-22*
