---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Override Routing + Coverage Hardening + Atlas Repack
status: milestone_complete
last_updated: "2026-05-15T12:00:00.000Z"
last_activity: 2026-05-15 -- Phase 40 complete (atlas-repack-output); v1.5 milestone closure pending
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 23
  completed_plans: 23
  percent: 100
---

# State

## Current Position

Phase: 40 (complete) — final phase of v1.5
Plan: All 9 plans complete (40-01..40-09)
Status: Milestone v1.5 complete; SEED-008 closed. Run `/gsd-complete-milestone v1.5` to archive.
Last activity: 2026-05-15 -- Phase 40 verified passed (10/10 must-haves); 5 code-review fixes applied

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12 — v1.4 shipped, v1.4.0 tag pending push)

**Core value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.
**Current focus:** Phase 40 — atlas-repack-output

## v1.5 Roadmap Summary

5 independent phases (Phase 40 added 2026-05-14 after 36–39 complete):

| Phase | Goal | REQs | Plans (est.) |
|-------|------|------|--------------|
| 36 — Split Overrides Per Loader Mode | Atlas-source / atlas-less modes keep independent override maps | OVR-01..07 | 5 |
| 37 — Spine 4.2 Timeline Coverage Hardening | Source-audit + fixture-lock RGBA2 + InheritTimeline | TIMELINE-01..05 | 3 |
| 38 — Phase 4 Code-Review Polish Pass | Audit IN-01..06 against current code, apply still-applicable findings | POLISH-01..03 | 3 |
| 39 — Windows Host-Blocked UAT Burndown | Run Phase 20 + 31 Win-host UATs OR defer with audit-trail | WINUAT-01..03 | 3 |
| 40 — Atlas Repack Output | Additive `loose | atlas | both` output mode → libgdx `.atlas` + page PNG(s) via maxrects-packer + sharp | REPACK-01..09 (tentative) | TBD |

**Coverage:** 18/18 pre-Phase-40 v1.5 REQs mapped (no orphans, no duplicates); REPACK-01..09 tentative pending `/gsd-spec-phase 40`.

## Last completed milestone

**Milestone v1.4 — Spine 4.3 Forward-Compat + Rotated Atlases — SHIPPED 2026-05-12.** 4 phases (32, 33, 34, 35), 18 plans, 14 REQs (COMPAT-01..02 + ATLAS-01..04 + OPEN-01..05 + DEDUP-04..06). Full record in `.planning/MILESTONES.md`; archive at `.planning/milestones/v1.4-ROADMAP.md`. Tag `v1.4.0` pending push.

## Deferred Items

Carried forward from v1.4 milestone close (2026-05-12). Items resolved/addressed in v1.5 are noted.

**Addressed by v1.5 scope:**

| Category | Item | v1.5 Phase |
|----------|------|------------|
| quick_task | 2026-04-24-phase-4-code-review-follow-up.md | Phase 38 (POLISH-01..03) |
| quick_task | 2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md | Phase 39 (WINUAT-01, WINUAT-03) |
| pending_todo | 2026-05-08-phase-31-windows-admin-dnd-release-uat.md | Phase 39 (WINUAT-02, WINUAT-03) |
| seed | SEED-005 (RGBA2 + InheritTimeline coverage) | Phase 37 (TIMELINE-01..05) |
| seed | SEED-007 (Split overrides per loaderMode) | Phase 36 (OVR-01..07) |

**Still deferred (pre-v1.5 carry-forwards):**

| Category | Item | Status |
|----------|------|--------|
| debug | phase-0-scale-overshoot | investigating — v1.0-era AABB/rotation tech debt; no regression observed across 7 milestones |
| uat_gaps | Phase 14 14-HUMAN-UAT.md | signed-off — 6 pending auto-update live-observation scenarios; v1.1.x carry-forward |
| uat_gaps | Phase 15 15-HUMAN-UAT.md | signed-off — 12 pending scenarios; v1.1.x carry-forward |
| verification_gaps | Phase 14 14-VERIFICATION.md | human_needed — auto-update live verification; v1.1.x carry-forward |
| verification_gaps | Phase 21 21-VERIFICATION.md | human_needed — atlas-less mode HUMAN-UAT; explicitly deferred per user during Phase 21 execute |
| uat_gaps | Phase 23 23-HUMAN-UAT.md | partial — 4 pending scenarios; require Electron native folder picker (not jsdom-testable) |
| uat_gaps | Phase 26.1 26.1-HUMAN-UAT.md | partial — 7 pending visual scenarios; require running dev server |
| verification_gaps | Phase 23 23-VERIFICATION.md | human_needed — 7/7 must-haves verified at code level; Electron native dialogs cannot run in jsdom |
| verification_gaps | Phase 25 25-VERIFICATION.md | human_needed — 10/13 verified; 3 visual UAT items require running Electron dev server |
| uat_gaps | Phase 30 30-HUMAN-UAT.md | partial — 4 pending scenarios; pre-release human verification |
| verification_gaps | Phase 30 30-VERIFICATION.md | human_needed — pre-release verification (visual + integration) |
| uat_gaps | Phase 34 34-HUMAN-UAT.md | partial — 1 open scenario: macOS/Windows picker rendering parity; host-blocked |
| verification_gaps | Phase 34 34-VERIFICATION.md | human_needed — same root as above |
| seed | SEED-006 (Full Spine 4.3 runtime port) | dormant — trigger: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x OR paying user reports re-export failure |

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, region-keyed dedup contract added in v1.3.1, all locked. See PROJECT.md `## Key Decisions` and `## Constraints` for the full list.)

### v1.5 Locked Constraints (do not relitigate during phase planning)

- **SEED-007 Decision 1:** schema-additive `overridesAtlasLess` field; no `.stmproj` version bump (follows `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent).
- **SEED-007 Decision 2-A:** legacy v1.3.x/v1.4.x `.stmproj` routes by saved `loaderMode` at the Open seam.
- **SEED-007 Decision 3-A:** mode-switch leaves inactive bucket untouched; no auto-copy.
- **TIMELINE-02 conditional escalation:** if InheritTimeline audit reveals world-transform effects, TIMELINE-03 becomes load-bearing (real-risk fix); otherwise precautionary (invariance lock). Phase 37 plan checkpoint, not a deferred risk.
- **WINUAT-01..03 host-blocked graceful degradation:** Phase 39 `human_needed` outcome is first-class non-failure; todos carry forward to v1.6+ if no Win host available this cycle.
- **SEED-008 (Phase 40) locked design facts:** Output mode is additive (loose default unchanged); JSON invariant under repack (source-confirmed spine-ts 4.2.111); both atlas-source + atlas-less input loaderModes supported on output; 7 additive `.stmproj` fields with no schema bump; `core/` stays pure-TS for pack math; sharp + `.atlas` writing in `main/`; `safetyBufferPercent` / `sharpenOnExport` / D-91 cap apply pre-pack per-region. `/gsd-spec-phase 40` and `/gsd-discuss-phase 40` SHOULD NOT relitigate these.

### Roadmap Evolution

- 2026-05-14 — Phase 40 added (`atlas-repack-output`) post-hoc after v1.5 marked `milestone_complete`. v1.5 reopened (`status: in_progress`, `total_phases: 4 → 5`). Phase 40 is the v1.5 milestone-close phase; planted as SEED-008 immediately prior. Branch `experiment/phase-40-atlas-repack` already in use.

---

*This file is authored fresh at milestone start. v1.4 phases preserved at `.planning/phases/32-*..35-*/` (per user choice — not archived to `milestones/v1.4-phases/`).*

**Last Milestone:** v1.4 (Spine 4.3 Forward-Compat + Rotated Atlases) — COMPLETE — 2026-05-12 (4 phases, 18 plans, 14 REQs; tag `v1.4.0` pending push).
**Current Milestone:** v1.5 (Override Routing + Coverage Hardening + Atlas Repack) — IN PROGRESS — 5 phases (36–39 complete; 40 pending spec/plan/execute), 14+TBD plans, 18+REPACK-01..09 REQs.
