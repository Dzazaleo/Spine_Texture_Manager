---
phase: 48-core-scale-bake-module-regression-oracle
plan: 01
subsystem: core
tags: [scale-bake, json-transform, spine-4.2, spine-4.3, similarity-bake, layer-3-purity, typed-errors]

# Dependency graph
requires:
  - phase: spikes/002-json-bake-roundtrip
    provides: validated baker.mjs JSON->JSON similarity bake (field-identical to SkeletonJson.scale on 4.2+4.3)
provides:
  - "src/core/scale-bake.ts — pure JSON->JSON similarity bake exporting bake(json, s) and ScaleBakeError"
  - "Dual-schema handling (4.2 split transform/ik/path/physics[] + 4.3 unified constraints[]) via constraintsOf"
  - "Scaled-default injections: referenceScale 100xs + physics.limit 5000xs"
  - "D-09 degenerate-s guard (rejects s<=0/NaN/+-Infinity)"
  - "D-10 assert-known guard on attachment.type + constraint.type discriminators"
affects: [48-02 timeline-channel-fixes, 48-04 regression-oracle, 49-export-pipeline, 50-51-export-sizing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure raw-JSON transform: imports NOTHING from spine-core (not even types); typed via Record<string, any>"
    - "Single typed-error class (ScaleBakeError) serving both guards; message string discriminates D-09 vs D-10"
    - "constraintsOf schema-bridge collapses 4.2 split + 4.3 unified constraints into one loop"

key-files:
  created:
    - src/core/scale-bake.ts
    - tests/core/scale-bake.spec.ts
  modified: []

key-decisions:
  - "Co-located ScaleBakeError in scale-bake.ts (not errors.ts) — single-module-scoped, no IPC routing this phase (48-PATTERNS option A)"
  - "Promoted baker.mjs setup-side branches VERBATIM; slider branch + path mode-gating + ik-curve cy fixes deferred to 48-02 per plan scope"
  - "Reworded the deform-walk comment to drop the literal 'anim.deform' substring so the corrected-key acceptance grep returns 0 (semantics unchanged)"

patterns-established:
  - "Layer-3-pure core/ module enforced by the existing tests/arch.spec.ts src/core/** glob with NO carve-out"
  - "Type discriminators (attachment.type, constraint.type) get assert-known guards; timeline names stay allow-listed (no throw on unknowns)"

requirements-completed: [BAKE-01, BAKE-02, BAKE-04]

# Metrics
duration: ~6min
completed: 2026-05-22
---

# Phase 48 Plan 01: Core Scale-Bake Module (Setup-Side) Summary

**Pure JSON->JSON similarity bake `bake(json, s)` promoted from the validated spike baker.mjs into a Layer-3-pure `src/core/scale-bake.ts`, mirroring spine-core `SkeletonJson.scale` for the setup side (bones, constraints, attachments, scaled-default injections) plus D-09 degenerate-`s` and D-10 assert-known typed guards.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-22T13:02Z (RED test)
- **Completed:** 2026-05-22T13:08Z
- **Tasks:** 3 (2 implementation + 1 verification-only)
- **Files modified:** 2 (1 module created, 1 test created)

## Accomplishments
- Promoted the ~80-line validated spike `baker.mjs` body VERBATIM to a TypeScript `core/` module that imports nothing from spine-core (operates on raw parsed JSON), keeping it trivially Layer-3 pure.
- Dual-schema handling through one `constraintsOf` loop: 4.3 unified `constraints[]` and 4.2 split `transform`/`ik`/`path`/`physics[]`.
- Both scaled-default injections wired: `skeleton.referenceScale` 100xs-when-absent / xs-when-present, and physics `limit` 5000xs-when-absent (physics x/y left unscaled per L-03).
- Non-mutating by construction (clone-first, L-05); corrected deform container key `anim.attachments[skin][slot][att].deform`.
- D-09 guard rejects degenerate `s` (s<=0/NaN/±Infinity) with a typed `ScaleBakeError`; direction-agnostic (s=2.0 upscale succeeds).
- D-10 assert-known throws a typed `ScaleBakeError` on unrecognized `attachment.type` and 4.3 `constraint.type` (linkedmesh recognized as no-own-geometry; timeline names stay allow-listed — no throw on unknown timelines).

## Task Commits

Each task was committed atomically:

1. **Task 1: Promote spike bake (setup-side) + ScaleBakeError + D-09 guard** - `6288863` (feat) — module + spec
2. **Task 2: Add D-10 assert-known guard on type discriminators** - `7b60632` (feat)
3. **Task 3: Confirm Layer-3 purity (arch.spec green)** - verification-only, NO code change (no commit; the existing `src/core/**` glob already enforces purity with no carve-out)

_TDD note: Task 1 wrote a RED spec first (module-missing import failure), then the module turned it GREEN; the spec carries both Task-1 (8) and Task-2 (15) behavior gates._

## Files Created/Modified
- `src/core/scale-bake.ts` (178 lines) - Pure JSON->JSON similarity bake; exports `bake(json, s)` + `ScaleBakeError`; D-09 + D-10 guards; dual-schema `constraintsOf`; scaled-default injections; setup-side per-field xs rules + carried-over translate/deform/ik-value animation walks.
- `tests/core/scale-bake.spec.ts` (23 tests) - Non-mutation, bone/referenceScale/physics scaling, D-09 rejection, D-10 attachment/constraint throws + linkedmesh recognition + no-throw-on-unknown-timeline.

## Decisions Made
- **ScaleBakeError co-located in scale-bake.ts** (not promoted to `errors.ts`) per 48-PATTERNS option A — single-module-scoped, no IPC `KNOWN_KINDS` routing need this phase. Extends `Error` directly (a bake error is not a *loader* error, so it does NOT extend `SpineLoaderError`).
- **Promoted setup-side branches VERBATIM** including the spike's `path` branch (`!== 'percent'` / `'proportional'`) — the source-faithful mode-gating fix, slider setup branch, and ik-curve cy timeline fixes are explicitly 48-02's scope, not added here.
- **Single test spec for both tasks** — Task 1 behaviors run under `-t "Task 1"` for the GREEN gate; Task 2 behaviors added the same file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Comment reworded to satisfy the `anim.deform`==0 acceptance grep**
- **Found during:** Task 2 (acceptance-criteria verification)
- **Issue:** The deform-walk explanatory comment, copied verbatim from `baker.mjs:68`, contained the literal substring `anim.deform` ("(NOT anim.deform)"). The Task-1 acceptance criterion requires `grep -c "anim\.deform" src/core/scale-bake.ts` to return 0 — the substring in the comment made it return 1.
- **Fix:** Reworded the comment to "(NOT the legacy top-level deform key — RESEARCH Pitfall 1: baker.mjs is the corrected walk)". The substantive corrected key `anim.attachments[skin][slot][att].deform` (the actual loop iterator) is unchanged; only the explanatory prose lost the literal substring.
- **Files modified:** src/core/scale-bake.ts
- **Verification:** `grep -c "anim\.deform"` -> 0; `grep -c "anim\.attachments"` -> 1; all 23 spec tests still GREEN.
- **Committed in:** 7b60632 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — acceptance-grep compliance, no behavioral change)
**Impact on plan:** Cosmetic comment-only change to satisfy a literal acceptance grep; bake semantics identical to the validated spike. No scope creep.

## Issues Encountered
- **Pre-existing, out-of-scope worktree test failure (NOT a regression):** `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` fails in this worktree because its fixture `fixtures/SAMPLER_ALPHA_ZERO/TOPSCREEN_ANIMATION_JOKER.json` is gitignored (`git check-ignore` matches) and absent from the worktree checkout. This is a worktree-environment artifact (the fixture is local-only and not committed), unrelated to scale-bake — the scale-bake module imports no fs and reads no fixtures. Not fixed (SCOPE BOUNDARY: out-of-scope, pre-existing); the full `tests/core/` sweep is otherwise 527 passed / 19 skipped / 1 todo, and `tests/core/scale-bake.spec.ts` is 23/23 GREEN.

## TDD Gate Compliance
Plan tasks are `tdd="true"` (per-task), not a plan-level `type: tdd` feature cycle. Each implementation task wrote/extended the spec, ran it (RED for the missing-module import on Task 1), then turned it GREEN with the `feat` commit. No standalone `test(...)` RED-gate commit was created because the spec and the module were authored within the same task commit (the spec is the task's contract); both Task-1 and Task-2 commits are `feat(...)` with their behavior gates GREEN at commit time.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **48-02** can now layer the three constraint-timeline channel fixes (slider remap, path mode-gating, ik softness-curve cy) and the slider setup branch onto this module.
- **48-04** can wire the regression oracle (`parse(bake(orig,s),1) ≡ parse(orig,SkeletonJson.scale=s)`) against this `bake` import.
- The module is type-clean (`tsc --noEmit -p tsconfig.node.json` — no scale-bake errors), Layer-3 pure (`tests/arch.spec.ts` 16/16 GREEN, no carve-out), and the BAKE-01 (setup-side field rules) / BAKE-02 (dual-schema) / BAKE-04 (Layer-3 purity) requirements are satisfied for the setup side. The oracle proof of those rules lands in 48-04.

## Self-Check: PASSED

- FOUND: src/core/scale-bake.ts
- FOUND: tests/core/scale-bake.spec.ts
- FOUND: .planning/phases/48-core-scale-bake-module-regression-oracle/48-01-SUMMARY.md
- FOUND commit: 6288863 (Task 1)
- FOUND commit: 7b60632 (Task 2)

---
*Phase: 48-core-scale-bake-module-regression-oracle*
*Completed: 2026-05-22*
