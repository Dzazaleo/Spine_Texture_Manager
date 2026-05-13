---
phase: 39
title: Phase 39 host-availability decision + graceful-degradation contract
recorded_on: 2026-05-13
host_available: yes
winuat_01_mode: live
winuat_02_mode: live
requirements: [WINUAT-01, WINUAT-02, WINUAT-03]
---

# Phase 39 — Host-availability decision + graceful-degradation contract

This document is the single decision-gate artefact for Phase 39 of the v1.5 (Override Routing + Coverage Hardening) milestone. Plans 39-02 and 39-03 each open this file and read `winuat_01_mode` / `winuat_02_mode` from the frontmatter to choose between LIVE-EXECUTION mode and STRUCTURED-DEFERRAL mode. The body sections lock the operational rules that govern Phase 39 closure regardless of which mode is chosen.

## 1. Decision recorded

On **2026-05-13** (v1.5 milestone cycle), the user confirmed `host_available: yes` — a real Windows host with an installed v1.3.1+ release binary of Spine Texture Manager is available right now for live UAT execution this cycle. Both WINUAT-01 (DocBuilder DnD, Phase 20) and WINUAT-02 (admin DnD advisory, Phase 31) will execute LIVE in plans 39-02 and 39-03 respectively.

Per the derivation matrix in Section 4 below, `host_available: yes` derives `winuat_01_mode: live` and `winuat_02_mode: live`. Both pending todos (`2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` and `2026-05-08-phase-31-windows-admin-dnd-release-uat.md`) are expected to move from `.planning/todos/pending/` to `.planning/todos/resolved/` at phase close, contingent on each UAT executing to `passed` or `failed` (not `human_needed`) per the Todo lifecycle rule in Section 2.

Windows host details to be appended to outcome stanzas in 39-02 + 39-03 at live-execution time (specific Windows version, machine descriptor, and the v1.x installer version actually exercised were not volunteered at decision time; placeholder values to be filled in by the live-execution executor when the user reports observed behavior).

## 2. Graceful-degradation contract

The following invariant is recorded verbatim from `.planning/STATE.md` `v1.5 Locked Constraints` (lines 86-92) and governs Phase 39 closure independent of the Section 1 outcome:

```
WINUAT-01..03 host-blocked graceful degradation: Phase 39 human_needed outcome
is first-class non-failure; todos carry forward to v1.6+ if no Win host available
this cycle. Closure gates on programmatic verification + audit-trail integrity,
NOT on host availability.
```

Three operational clarifications follow. Plans 39-02 and 39-03 read these directly — do NOT paraphrase, do NOT relitigate.

- **Independence invariant.** WINUAT-01 (Phase 20 DocBuilder DnD) and WINUAT-02 (Phase 31 admin DnD advisory) outcomes are INDEPENDENT. One can flip to `passed` / `failed` while the other defers as `human_needed`. The four-way partial-close matrix is reflected by `winuat_01_mode` + `winuat_02_mode` frontmatter fields.
- **Outcome vocabulary.** Each UAT executes to exactly one of `passed`, `failed`, or `human_needed`. `human_needed` is NOT a failure — it records that the test cannot be exercised this cycle. The phase verifier MUST treat `human_needed` as a non-failure outcome per ROADMAP Phase 39 Success Criterion 4.
- **Todo lifecycle.** A todo file moves from `pending/` to `resolved/` ONLY when its corresponding UAT executes to `passed` or `failed`. If the corresponding UAT is `human_needed`, the todo stays in `pending/` with an appended carry-forward note dated 2026-05-13 (or later) referencing Phase 39 and the carry-forward milestone (v1.6+).

## 3. File-correctness facts (read before editing UAT or todo files)

Two path inaccuracies in upstream planning documents (ROADMAP Phase 39 Success Criteria 1 and 2; REQUIREMENTS WINUAT-01 + WINUAT-02) are corrected here so plans 39-02 + 39-03 do not have to rediscover them.

### 3.1 Phase 20 HUMAN-UAT file: DELETED — todo is the audit-trail anchor

The file `.planning/phases/20-documentation-builder-feature/20-HUMAN-UAT.md` no
longer exists. It was created in commit 1095afa (2026-05-01), last updated in
commit d21d26e (test #3 set to `deferred`), and DELETED in commit 0787fe1
(`chore(planning): cleanup v1.1.2/v1.2 plan artifacts + v1.3.1 housekeeping`).

The v1.2 archive at `.planning/milestones/v1.2-phases/20-documentation-builder-feature/`
contains only `20-01-SUMMARY.md` .. `20-04-SUMMARY.md` — no UAT.

Implication for plan 39-02: WINUAT-01 outcome recording happens IN-PLACE in
`.planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md`
(or its `resolved/` counterpart after move), NOT in a UAT markdown file. The
todo body already carries the test-3 scenario verbatim. Do NOT restore the
deleted UAT file — it has no surviving consumer.

### 3.2 Phase 31 HUMAN-UAT file: ARCHIVED location (NOT the ROADMAP path)

ROADMAP Phase 39 Success Criterion 2 and REQUIREMENTS WINUAT-02 both reference
`.planning/phases/31-loader-ux-small-fixes-batch/31-HUMAN-UAT.md`. That path
does NOT exist. The file lives at:

  .planning/milestones/v1.3.1-phases/31-loader-ux-small-fixes-batch/31-HUMAN-UAT.md

Phase 31 was archived to `v1.3.1-phases/` during v1.3.1 milestone close. Plan
39-03 must edit the archived path for the test-1 result flip + summary table
update.

## 4. Plan routing matrix

The following matrix is the canonical lookup used by plans 39-02 and 39-03 to decide between LIVE-EXECUTION and STRUCTURED-DEFERRAL modes. The two `winuat_*_mode` frontmatter fields above are derived from `host_available` per this matrix.

| host_available value         | winuat_01_mode | winuat_02_mode | 39-02 task | 39-03 task |
|------------------------------|----------------|----------------|------------|------------|
| yes                          | live           | live           | LIVE       | LIVE       |
| partial-winuat01-only        | live           | deferred       | LIVE       | DEFER      |
| partial-winuat02-only        | deferred       | live           | DEFER      | LIVE       |
| no                           | deferred       | deferred       | DEFER      | DEFER      |

Plan 39-02 reads `winuat_01_mode` from this contract's frontmatter and chooses
LIVE or DEFER. Plan 39-03 reads `winuat_02_mode` for WINUAT-02 routing and
ALSO reads `winuat_01_mode` (because WINUAT-03 — todo cleanup — must move
the Phase 20 todo to resolved/ only if WINUAT-01 closed live, otherwise carry
it forward in pending/). The 39-03 plan thus has FOUR concrete paths through
its task tree, one per row of the matrix.
