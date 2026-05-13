---
phase: 37-spine-4-2-timeline-coverage-hardening
plan: 01
subsystem: testing
tags: [spine-4.2, audit-doc, timeline, RGBA2Timeline, InheritTimeline, source-cited]

# Dependency graph
requires:
  - phase: 36-split-overrides-per-loader-mode
    provides: prior v1.5 milestone phase (independent — no code-level dependency; this plan is audit-doc-only)
provides:
  - Items 6 + 7 appended to `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` with source-cited PASS verdicts
  - Item 6 (RGBA2Timeline) locks geometry-invariance verdict for TIMELINE-04 test scaffolding
  - Item 7 (InheritTimeline) records TIMELINE-02 conditional-escalation clause as TRIGGERED — locks TIMELINE-03 test assertion direction as strict `peak(detached) > peak(baseline)` for Plan 37-02
  - Audit triage table updated: RGBA2Timeline + InheritTimeline rows flipped from `🟡 Deferred → SEED-005` to `✅ Covered (Phase 37)`
  - Items-deferred block: Item 5 marked "closed Phase 37 — see items 6 + 7 above"
affects: [37-02 inherit-fixture-and-test, 37-03 rgba2-test-and-closure, SEED-005 closure breadcrumb]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Audit-doc append-only edit policy (PATTERNS S5): frontmatter `status: closed` + `closed_date` preserved across follow-up findings; only body appended"
    - "Source-cited verdict format: H3 `### Item N — <title> → <VERDICT>` + bulleted evidence with explicit `File.js:LINE` citations + single `**Verdict:**` summary line"

key-files:
  created: []
  modified:
    - .planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md (appended Items 6 + 7; updated triage rows; updated Items-deferred block)

key-decisions:
  - "TIMELINE-02 conditional escalation clause is TRIGGERED. The InheritTimeline audit confirmed `bone.inherit` IS mutated by `InheritTimeline.apply` (Animation.js:755) AND IS consumed by `Bone.updateLocalToWorld` at the Bone.js:144 `switch (this.inherit)` site. Therefore TIMELINE-03 (Plan 37-02) MUST assert strict `peak(detached) > peak(baseline)` — load-bearing real-risk gap fix rather than precautionary invariance lock."
  - "RGBA2Timeline is geometry-invariant by construction (Animation.js:951-1030 writes only `slot.color` + `slot.darkColor`; no `bone.*` writes; no geometry writes). TIMELINE-04 (Plan 37-03) asserts byte-identical `summary.globalPeaks` Map across baseline vs RGBA2-injected runs, using strict `.toBe()` per CONTEXT D-01 (no epsilon tolerance)."
  - "Audit-doc frontmatter (`status: closed` / `closed_date: 2026-05-08`) preserved verbatim. The doc-level audit task remains closed — Phase 37 only appends follow-up findings (PATTERNS S5)."

patterns-established:
  - "Source-read verification gate before audit-doc edit: every cited line number in PATTERNS.md was confirmed against the actual `node_modules/@esotericsoftware/spine-core@4.2.111` source before the doc was written. No drift detected — all line numbers (Animation.js:755, Animation.js:723-757, Animation.js:951-1030, Animation.js:953, Bone.js:144, Bone.js:271/278/288/299) matched verbatim."

requirements-completed: [TIMELINE-01, TIMELINE-02]

# Metrics
duration: ~5 min
completed: 2026-05-13
---

# Phase 37 Plan 01: Audit Items 6 + 7 (RGBA2Timeline + InheritTimeline) Summary

**Source-cited PASS verdicts for RGBA2Timeline (geometry-invariant) and InheritTimeline (lifecycle covers); TIMELINE-02 conditional-escalation clause TRIGGERED locks TIMELINE-03 as strict `peak(detached) > peak(baseline)`.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-13T12:30:00Z (approx)
- **Completed:** 2026-05-13T12:35:03Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Verified all six Spine 4.2 source-cited line numbers from PATTERNS.md against `node_modules/@esotericsoftware/spine-core@4.2.111` — zero drift. Animation.js:755 (`bone.inherit` mutation), Animation.js:951-1030 (RGBA2Timeline class), Animation.js:953 (RGBA2Timeline constructor signature), Bone.js:144 (`switch (this.inherit)` readback), Bone.js:271/278/288/299 (per-mode branches) all match.
- Appended Item 6 (RGBA2Timeline geometry-invariance → PASS) to the audit doc. Verdict locks the contract that slot-color timelines cannot affect peak render scale because the sampler hot loop reads `bone.*` + `attachment.vertices` — never `slot.color` / `slot.darkColor`.
- Appended Item 7 (InheritTimeline detaches `bone.inherit` at runtime → PASS) with source-read evidence that `state.apply → bone.inherit mutation → updateWorldTransform` (CLAUDE.md fact #3 lifecycle) inherently propagates the timeline write into the sampled scale. **TIMELINE-02 conditional-escalation clause TRIGGERED.**
- Flipped both triage-table rows (RGBA2Timeline + InheritTimeline) from `🟡 Deferred → SEED-005` to `✅ Covered (Phase 37)`.
- Updated Items-deferred block: Item 5 now reads `closed Phase 37 — see items 6 + 7 above`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify Spine 4.2 source-read evidence and append Items 6 + 7 to the audit doc** — `fbf354c` (docs)

## Files Created/Modified

- `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` — Appended H3 Items 6 + 7 between the Item 4 verdict and the Items-deferred header. Updated two triage-table rows (RGBA2Timeline + InheritTimeline). Updated Items-deferred bullet for Item 5. Frontmatter (`status: closed` / `closed_date: 2026-05-08`) preserved unchanged.

## Verified Spine 4.2 Source Line Citations

All line numbers cited in PATTERNS.md were verified against `node_modules/@esotericsoftware/spine-core/dist/{Animation,Bone}.js` (spine-core@4.2.111). Zero drift detected.

| Citation | Verified | Notes |
|---|---|---|
| `Animation.js:755` | ✅ exact | `bone.inherit = this.frames[Timeline.search(frames, time, 2 /*ENTRIES*/) + 1 /*INHERIT*/];` |
| `Animation.js:723-757` | ✅ exact | InheritTimeline class declaration to closing brace |
| `Animation.js:951-1030+` | ✅ exact | RGBA2Timeline class (extends CurveTimeline); apply body lines 976-1029; default branch (Bezier) at 1030+ |
| `Animation.js:953` | ✅ exact | `constructor(frameCount, bezierCount, slotIndex) {` |
| `Bone.js:144` | ✅ exact | `switch (this.inherit) {` inside `updateLocalToWorld` |
| `Bone.js:271, 278, 288, 299` | ✅ exact | Per-mode branches (OnlyTranslation @ 271; switch in `updateAppliedTransform` @ 278; NoScale/NoScaleOrReflection @ 288-289; sign-detection branch @ 299) |

## Decisions Made

**TIMELINE-02 conditional escalation TRIGGERED — locks TIMELINE-03 assertion direction as strict `peak(detached) > peak(baseline)` for downstream Plan 37-02.**

This is the load-bearing decision of this plan. The conditional-escalation clause in REQUIREMENTS.md TIMELINE-02 says:

> *"If world transforms are affected, this REQ escalates to a real-risk gap and TIMELINE-03 becomes load-bearing rather than precautionary."*

The audit confirmed world transforms ARE affected: `bone.inherit` written at `Animation.js:755` flows directly into the `switch (this.inherit)` branch at `Bone.js:144` (and the readback-site branches at `Bone.js:271/278/288/299`). Therefore TIMELINE-03 MUST assert strict `peak(detached) > peak(baseline)`. Plan 37-02 will consume this decision when building the `fixtures/INHERIT_TIMELINE/` fixture and the corresponding sampler test.

All other decisions followed the plan + PATTERNS.md verbatim.

## Deviations from Plan

None - plan executed exactly as written, with the single minor textual adjustment described below.

### Minor Textual Adjustment (not a deviation; PATTERNS.md substitution-table compliance)

The Item 7 evidence sentence was written as `mutates 'bone.inherit' directly at Animation.js:755:` (with the explicit `Animation.js:` filename prefix on the line citation) rather than the variant `directly at line 755:` (with implicit filename). Reason: the plan's `<must_haves>` block requires the regex pattern `Animation\.js:755` to be present in the audit doc as a literal substring. The explicit form satisfies the pattern; the implicit form would not. Both forms convey the same information; the explicit form is also more consistent with the surrounding Item 6 citation style (`Animation.js:951-1030`, `Animation.js:953`).

This is not a Rule 1/2/3 deviation — it is direct compliance with the plan's `<must_haves>.key_links.pattern` field.

## Issues Encountered

None.

## Acceptance Criteria — All Pass

All 16 acceptance criteria + the full `<automated>` verify chain pass:

- `grep -q '^### Item 6 — RGBA2Timeline'` → PASS (count = 1)
- `grep -q '^### Item 7 — InheritTimeline'` → PASS (count = 1)
- `grep -q 'Animation\.js:755'` → PASS
- `grep -q 'Animation\.js:951-1030'` → PASS
- `grep -q 'Bone\.js:144'` → PASS
- `grep -q 'closed Phase 37'` → PASS
- `grep -q '✅ Covered (Phase 37)'` → PASS (count = 2)
- `! grep -q '🟡 Deferred → SEED-005'` → PASS (no orphans)
- `grep -c '^status: closed$'` → 1 (frontmatter preserved per PATTERNS S5)
- `grep -q '^closed_date: 2026-05-08$'` → PASS (closure date preserved)
- Item 6 + Item 7 each contain `**Verdict:**` line → PASS
- `grep -q 'TIMELINE-02 conditional escalation clause TRIGGERED'` → PASS

## Next Phase Readiness

Plan 37-02 (InheritTimeline fixture + test) is unblocked. The TIMELINE-03 assertion direction is locked as strict `peak(detached) > peak(baseline)` per the TIMELINE-02 conditional-escalation clause TRIGGERED. Plan 37-02's planner can cite Items 7 + 6 directly when scaffolding `fixtures/INHERIT_TIMELINE/INHERIT_TEST.json` and `tests/core/sampler.spec.ts`.

Plan 37-03 (RGBA2 test + SEED-005 closure) is also unblocked — Item 6 PASS confirms the geometry-invariance contract that TIMELINE-04 will lock with a synthetic RGBA2Timeline injection + byte-equal `globalPeaks` Map comparison.

## Self-Check: PASSED

Created files: none.

Modified files:
- `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` — FOUND (committed in `fbf354c`)

Commits:
- `fbf354c` — FOUND in `git log --oneline` (matches commit-record above)

---
*Phase: 37-spine-4-2-timeline-coverage-hardening*
*Completed: 2026-05-13*
