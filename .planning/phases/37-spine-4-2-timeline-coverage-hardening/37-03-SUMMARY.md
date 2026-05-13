---
phase: 37-spine-4-2-timeline-coverage-hardening
plan: 03
subsystem: testing
tags: [spine-4.2, sampler, regression-test, RGBA2Timeline, seed-closure, geometry-invariance]

# Dependency graph
requires:
  - phase: 37-spine-4-2-timeline-coverage-hardening
    provides: "Plan 37-01 audit-doc Item 6 PASS finding (RGBA2Timeline geometry-invariance contract) + items-deferred Item 5 closure-line. Plan 37-02 sampler-test landing pattern (TIMELINE-03 it() block + Animation.js/Bone.js source-cite comment style) inside the existing describe('sampler — sampleSkeleton (...)', ...) block."
provides:
  - "tests/core/sampler.spec.ts — TIMELINE-04 RGBA2Timeline geometry-invariance it() block; synthetic in-test injection (no on-disk fixture) per CONTEXT.md D-05/D-06; new named import of RGBA2Timeline from @esotericsoftware/spine-core; strict per-record .toBe() byte-equal globalPeaks Map comparison per CONTEXT.md DC-01"
  - ".planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md — frontmatter status: planted -> closed plus closed_during: 37-spine-4-2-timeline-coverage-hardening and closed: 2026-05-13 keys (SEED-007 precedent); body **Closed:** breadcrumb paragraph between H1 and existing `## The Gap (one-line)` heading naming Phase 37, the satisfied REQ range (TIMELINE-01..TIMELINE-05), audit doc items 6 + 7, fixture, and both tests"
  - "Cross-file traceability: audit doc Item 5 closure-line (from Plan 37-01) + SEED-005 status flip + body breadcrumb together close REQ TIMELINE-05"
affects: [phase-37 closure / verifier handoff, future RGBA2-related slot-color preview product features (would reference this regression contract)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Synthetic timeline injection pattern (PATTERNS.md S3 + new TIMELINE-04 variant): load fixture twice via loadSkeleton, find slot/animation by name, construct a new Timeline class instance directly (e.g., new RGBA2Timeline(frameCount, bezierCount, slotIndex)), populate keyframes via setFrame, push onto the target animation's timelines array on the injected copy, then sample both and compare globalPeaks Maps. No on-disk fixture mutation; fully test-resident."
    - "Defensive non-null assert on slot.darkColor before injecting a darkColor-writing Timeline class — Animation.js:1041 NPEs on `dark.r = r2` if the JSON slot lacks the `dark` field. Establishes a clear failure-mode diagnostic for the next time someone writes an RGBA2/RGB2-family Timeline injection test."

key-files:
  created:
    - .planning/phases/37-spine-4-2-timeline-coverage-hardening/37-03-SUMMARY.md
  modified:
    - tests/core/sampler.spec.ts
    - .planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md

key-decisions:
  - "TIMELINE-04 target slot switched from SQUARE (plan's recommendation, index 2) to SQUARE2 (index 4). Rule 1 fix: SQUARE has no `dark` field in SIMPLE_TEST.json -> slot.darkColor is null -> RGBA2Timeline.apply NPEs at Animation.js:1041 (`dark.r = r2`). SQUARE2 is the only slot in SIMPLE_TEST with `\"dark\": \"ff0000\"` (SIMPLE_TEST.json:87). Switching preserves the test intent (slot-color injection on a darkColor-bearing slot, geometry-invariance assertion identical) — strict byte-equal globalPeaks Map comparison still works because the SQUARE2 slot's attachment uses the same SQUARE region on a pre-scaled bone (SQUARE2 bone setup scaleX/Y=0.2538), so any geometry leak from RGBA2 would propagate through the same hot loop path."
  - "Added defensive `expect(slots[slotIndex].darkColor).not.toBeNull()` so the failure mode is a clear diagnostic if the fixture ever drops the SQUARE2 dark field. Prevents a future regression where the test would crash with `Cannot set properties of null` instead of producing a precise error message about the missing dark field."
  - "Audit-doc Item 5 closure-line (Plan 37-01) verified in place BEFORE editing SEED-005 — per plan Step A gate. The doc-level closure traceability portion of REQ TIMELINE-05 is owned by Plan 37-01; Plan 37-03 only verifies it and owns the seed-level status flip + body breadcrumb."

patterns-established:
  - "TIMELINE-04 RGBA2Timeline synthetic injection it() block lands inside the same describe('sampler — sampleSkeleton (N1.1–N1.6, N2.1, N2.3)', ...) block as TIMELINE-03 (from Plan 37-02). Co-locates with N1.x/N2.x sampler invariants per REQ TIMELINE-04 + plan D-04 + Plan 37-02 test landing site precedent."
  - "Slot-pick precondition for RGBA2/RGB2-family Timeline injection: before constructing a new Timeline class that writes slot.darkColor (RGBA2Timeline, RGB2Timeline), the target slot's JSON definition must have a non-null `dark` field. Tests targeting slots without `dark` get a null-deref at Animation.js:1041. Documented in TIMELINE-04 body comment + defensive assert."

requirements-completed: [TIMELINE-04, TIMELINE-05]

# Metrics
duration: 4min
completed: 2026-05-13
---

# Phase 37 Plan 03: TIMELINE-04 RGBA2 Test + SEED-005 Closure Summary

**Synthetic RGBA2Timeline injection on SQUARE2 (the only `dark`-bearing slot in SIMPLE_TEST) proves slot-color timelines cannot affect peak render scale — strict byte-equal globalPeaks Map vs baseline; SEED-005 flipped planted -> closed with closure breadcrumb naming Phase 37 + TIMELINE-01..TIMELINE-05.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-13T12:49:41Z
- **Completed:** 2026-05-13T12:53:41Z
- **Tasks:** 2
- **Files modified:** 2 (1 test + 1 seed)

## Accomplishments

- Added `RGBA2Timeline` named import from `@esotericsoftware/spine-core` to `tests/core/sampler.spec.ts` (the only new import — runtime dep already used by loader.ts).
- Added `TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline` it() block inside the existing top-level describe immediately after TIMELINE-03 (from Plan 37-02). Loads SIMPLE_TEST twice, finds the SQUARE2 slot index + the PATH animation, constructs `new RGBA2Timeline(2, 0, slotIndex)`, populates two keyframes (`setFrame(0, 0.0, 1,1,1,1, 0,0,0)` + `setFrame(1, 1.0, 0,0,0,1, 1,1,1)`), pushes onto PATH's timelines array on the injected copy, samples both, and asserts strict `.toBe()` per-record equality on `peakScale` / `peakScaleX` / `peakScaleY` / `worldW` / `worldH` / `time` / `animationName` / `attachmentName` across every key in the globalPeaks Map.
- Closed REQ TIMELINE-04 — the regression contract that slot-color timelines (RGBA2 / RGB2 family) cannot affect peak render scale is now sampler-test-locked.
- Flipped SEED-005 frontmatter: `status: planted` -> `status: closed`; added `closed_during: 37-spine-4-2-timeline-coverage-hardening` and `closed: 2026-05-13` keys per SEED-007 closed-seed precedent (PATTERNS.md S4 — three additive keys, no removals).
- Added body **Closed:** breadcrumb paragraph between the H1 and the existing `## The Gap (one-line)` heading. Names Phase 37, the satisfied REQ range (TIMELINE-01..TIMELINE-05), audit doc items 6 + 7, the InheritTimeline fixture, and both new tests (TIMELINE-03, TIMELINE-04).
- Verified audit-doc Item 5 closure-line from Plan 37-01 is still in place (`.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md:212` — `Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37 — see items 6 + 7 above).`). Cross-file traceability for REQ TIMELINE-05 is complete.
- All 38 sampler tests + 1 pre-existing skip in `tests/core/sampler.spec.ts` pass (was 37/1 before this plan; +1 = new TIMELINE-04). The TIMELINE-03 test from Plan 37-02 and all N1.x/N2.x + numeric goldens + per-animation breakdown extension + module-hygiene tests remain green.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add TIMELINE-04 RGBA2Timeline geometry-invariance test + RGBA2Timeline import to sampler.spec.ts** — `80dcf40` (test). Includes Rule 1 - Bug fix (slot pick switched from SQUARE to SQUARE2 — see Deviations).
2. **Task 2: Flip SEED-005 frontmatter status + add body closure breadcrumb + verify audit doc closure traceability** — `0b63399` (docs)

## Files Created/Modified

- `tests/core/sampler.spec.ts` — Added named import `RGBA2Timeline` from `@esotericsoftware/spine-core` (one new import line). Added one new it() block (`TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline`) inside the existing top-level describe immediately after the TIMELINE-03 block. 84 insertions, 0 deletions.
- `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` — Frontmatter `status: planted` flipped to `status: closed`, added `closed_during: 37-spine-4-2-timeline-coverage-hardening` and `closed: 2026-05-13` keys. Body breadcrumb paragraph inserted between H1 and `## The Gap (one-line)` section. 5 insertions, 1 deletion. Existing body sections (Gap / Why it might matter / Why we deferred today / What it would take to investigate / Pointers / Open question) untouched.

## TIMELINE-04 Test Mechanics (Traceability for Verifier)

- **Test name (exact):** `TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline`
- **Fixture:** `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (the de-facto smoke fixture — CONTEXT.md D-06 says no new `fixtures/RGBA2_TINT/` directory; synthetic injection is fully test-resident).
- **Slot pick:** SQUARE2 (index 4 in `skeletonData.slots`). Switched from the plan's recommended SQUARE (index 2) per Rule 1 fix below.
- **Animation pick:** PATH (drives CHAIN_2 scale + CTRL_PATH translate/rotate/scale per CONTEXT.md D-05; the sampler captures meaningful peaks on this animation).
- **Timeline constructor:** `new RGBA2Timeline(2, 0, slotIndex)` (frameCount=2, bezierCount=0). Constructor at Animation.js:953.
- **Keyframes:** `setFrame(0, 0.0, 1, 1, 1, 1, 0, 0, 0)` (white-tint + black-dark at t=0) + `setFrame(1, 1.0, 0, 0, 0, 1, 1, 1, 1)` (black-tint + white-dark at t=1). Full color sweep; exact values irrelevant — what matters is that the timeline ticks during `state.apply`.
- **Injection step:** `pathAnimation!.timelines.push(rgba2)`.
- **Assertion shape:** `expect(injectedPeaks.size).toBe(baselinePeaks.size)` + per-key for-loop with strict `.toBe()` on `peakScale`, `peakScaleX`, `peakScaleY`, `worldW`, `worldH`, `time`, `animationName`, `attachmentName`. **No `.toBeCloseTo()` or epsilon tolerance** per CONTEXT.md DC-01.
- **Defensive precondition assert:** `expect(slots[slotIndex].darkColor).not.toBeNull()` — clear diagnostic for the fixture-edit failure mode (someone removes SQUARE2's `dark` field).

## SEED-005 Frontmatter Diff (Verbatim)

Three changes per SEED-007 closed-seed precedent (PATTERNS.md S4):

```diff
 id: SEED-005
-status: planted
+status: closed
 planted: 2026-05-08
 planted_during: post-spine-sequence-undercount audit (.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md item 5)
+closed_during: 37-spine-4-2-timeline-coverage-hardening
+closed: 2026-05-13
 trigger_when: (a) we ship a feature that depends on accurate slot tinting (e.g. Atlas Preview color rendering); OR (b) a user reports a rig where animations look different in our app vs. Spine player; OR (c) a fixture surfaces an InheritTimeline-driven bug
 scope: A=Small (audit only — confirm both are render-scale-irrelevant) / B=Medium (add fixture coverage) / C=Large (handle in any product feature that surfaces tint/inheritance)
 proposed_phase: TBD — likely v1.4 or later
```

## SEED-005 Body Breadcrumb (Verbatim — inserted between H1 and `## The Gap (one-line)`)

```markdown
# SEED-005: RGBA2 (two-color tinting) + InheritTimeline coverage gap

**Closed:** 2026-05-13 (Phase 37 — Spine 4.2 Timeline Coverage Hardening shipped; TIMELINE-01..TIMELINE-05 all satisfied; audit doc items 6 + 7 PASS with source-cited evidence; `fixtures/INHERIT_TIMELINE/` + sampler tests `TIMELINE-03` / `TIMELINE-04` green).

## The Gap (one-line)
```

## Audit-Doc Closure Traceability (Cross-File Confirmation)

Verified in place before editing SEED-005 (plan Step A gate):

- `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md:212` — `Item 5 — RGBA2 + InheritTimeline → SEED-005 (closed Phase 37 — see items 6 + 7 above).`

This line was added by Plan 37-01 as part of the items-deferred block update. Plan 37-03 does NOT re-edit the audit doc — it only verifies the line is still in place (avoids merge conflicts with 37-01's edits, per CONTEXT.md plan-coordination notes).

REQ TIMELINE-05 closure is therefore complete across both files:
1. **Seed-level (this plan):** SEED-005 frontmatter `status: closed` + `closed_during` + `closed` keys + body breadcrumb naming Phase 37 + the REQ range + the two tests.
2. **Audit-doc-level (Plan 37-01):** Items-deferred Item 5 line marks it `closed Phase 37 — see items 6 + 7 above`, with Items 6 + 7 themselves containing the PASS verdicts with source-cited evidence.

## Final Test Counts

```
$ npm test -- tests/core/sampler.spec.ts
 Test Files  1 passed (1)
      Tests  38 passed | 1 skipped (39)
```

- **Before Plan 37-03:** 37 passed, 1 skipped (TIMELINE-03 from Plan 37-02 + existing N1.x/N2.x + numeric goldens + per-animation breakdown extension + module hygiene)
- **After Plan 37-03:** 38 passed, 1 skipped (+1 = TIMELINE-04)
- **Skipped:** 1 (pre-existing `EASING-CURVE STRETCH` skip — see file comment lines 189-216; fixture lacks non-linear easing)

## Phase 37 REQ Closure Summary

All 5 phase requirements satisfied:

| REQ | Plan | Status | Artifact |
|---|---|---|---|
| TIMELINE-01 | 37-01 | ✅ | Audit doc Items 6 + 7 with source-cited PASS verdicts |
| TIMELINE-02 | 37-01 | ✅ | Conditional-escalation clause TRIGGERED → TIMELINE-03 strict `peak(detached) > peak(baseline)` assertion direction locked |
| TIMELINE-03 | 37-02 | ✅ | `fixtures/INHERIT_TIMELINE/` 3-bone rig + sampler test `TIMELINE-03 InheritTimeline NoScale detach — peak > inheriting baseline` (observed peak ratio 2.5×) |
| TIMELINE-04 | 37-03 | ✅ | Sampler test `TIMELINE-04 RGBA2Timeline geometry-invariance — identical globalPeaks Map vs baseline` (synthetic in-test injection, no fixture) |
| TIMELINE-05 | 37-03 + 37-01 | ✅ | SEED-005 status flip + body breadcrumb (37-03) + audit doc items-deferred Item 5 closure-line (37-01) |

## Decisions Made

See `key-decisions` in frontmatter. Primary decision: slot pick switched from SQUARE to SQUARE2 (Rule 1 fix detailed under Deviations below). All other mechanics followed the plan and PATTERNS.md verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TIMELINE-04 slot pick crashed RGBA2Timeline.apply on SQUARE (null darkColor)**

- **Found during:** Task 1 (first `npm test` run after inserting the TIMELINE-04 it() block)
- **Issue:** The plan recommended `slotIndex = SQUARE (index 2)`. RGBA2Timeline.apply at `node_modules/@esotericsoftware/spine-core/dist/Animation.js:1041` writes `slot.darkColor.r = r2`. SQUARE has no `dark` field in `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json:82-88`, so `slot.darkColor` is null at load time and the timeline NPEs with `TypeError: Cannot set properties of null (setting 'r')` on the first tick of `state.apply(skeleton)` in the sampler's hot loop.
- **Fix:** Switched the target slot from SQUARE (index 2) to SQUARE2 (index 4). SQUARE2 is the only slot in SIMPLE_TEST with `"dark": "ff0000"` (SIMPLE_TEST.json:87 — visible in the slots array). The switch preserves the test's intent (synthetic RGBA2 injection on a slot that actually carries dark color, asserting geometry-invariance via byte-equal globalPeaks Map) without changing the assertion shape, the test name, the import, or the injection mechanism. SQUARE2's attachment uses the same SQUARE region on a pre-scaled bone (SQUARE2 bone setup scaleX/Y=0.2538), so any geometry leak from RGBA2 would still propagate through the same hot loop path as on the original SQUARE slot.
- **Files modified:** `tests/core/sampler.spec.ts` (slot name string + index reference + 1 defensive assert + body comment block updated to explain the slot pick rationale)
- **Verification:** `npm test -- tests/core/sampler.spec.ts` → 38 passed, 1 skipped, 0 failed. Defensive assert (`expect(slots[slotIndex].darkColor).not.toBeNull()`) added so any future fixture edit that removes SQUARE2's `dark` field produces a clear diagnostic instead of the cryptic `Cannot set properties of null` NPE.
- **Committed in:** `80dcf40` (Task 1 commit body documents the slot-pick fix alongside the test insertion)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** No scope creep — the fix is the smallest change needed to make the plan's slot-pick choice runtime-compatible with RGBA2Timeline's dark-color write semantics. The plan's assertion direction (byte-equal globalPeaks Map, strict `.toBe()`, no epsilon per CONTEXT.md DC-01), test name, import, injection mechanism (constructor args + setFrame keyframes + push onto pathAnimation.timelines), and verification shape (per-record numeric equality loop modeled on N1.6) all match the plan verbatim. Only the target slot's name (SQUARE → SQUARE2) and the related body comment changed.

## Issues Encountered

- One test crash during the initial Task 1 run (root-caused to the SQUARE-slot null darkColor issue described under Deviations). Diagnosed via the stack trace (`Animation.js:1156` in dev sources / Animation.js:1041 in dist) and the SIMPLE_TEST.json slot definitions read. Fixed inline by switching to SQUARE2 — single Edit, single re-test, immediate green.

## User Setup Required

None — no external service configuration required. Plan 37-03 is test + planning-doc-only.

## Next Phase Readiness

**Phase 37 is complete.** All 5 phase requirements (TIMELINE-01..TIMELINE-05) are satisfied across Plans 37-01, 37-02, and 37-03 with sampler-test-locked regression contracts and a closed seed. The phase is ready for `/gsd-verify-work 37` and subsequent advancement to whatever Phase 38 turns out to be on the roadmap.

The synthetic timeline injection pattern established in this plan (load fixture twice, instantiate a Timeline class, populate via setFrame, push onto the target animation's timelines array) is a generalizable test technique for any future Spine timeline class whose runtime behavior we want to verify against the sampler without authoring a dedicated on-disk fixture. The defensive precondition (`expect(slot.darkColor).not.toBeNull()` before injecting a darkColor-writing Timeline) is documented in the test body and the deviation log for the next person who reaches for this technique.

## Self-Check: PASSED

Created files (verified on disk):
- `.planning/phases/37-spine-4-2-timeline-coverage-hardening/37-03-SUMMARY.md` — being written now; will be confirmed by the metadata commit step.

Modified files (verified on disk):
- `tests/core/sampler.spec.ts` — FOUND (committed in `80dcf40`)
- `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` — FOUND (committed in `0b63399`)

Commits (verified via `git log --oneline`):
- `80dcf40` — FOUND (`test(37-03): add TIMELINE-04 RGBA2Timeline geometry-invariance test`)
- `0b63399` — FOUND (`docs(37-03): close SEED-005 — RGBA2 + InheritTimeline coverage hardened`)

---
*Phase: 37-spine-4-2-timeline-coverage-hardening*
*Completed: 2026-05-13*
