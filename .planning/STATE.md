---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Override Routing + Coverage Hardening
status: executing
last_updated: "2026-05-13T15:02:23.252Z"
last_activity: 2026-05-13 -- Phase 38 planning complete
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 11
  completed_plans: 8
  percent: 73
---

# State

## Current Position

Phase: 38
Plan: Not started
Status: Ready to execute
Last activity: 2026-05-13 -- Phase 38 planning complete

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12 — v1.4 shipped, v1.4.0 tag pending push)

**Core value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.
**Current focus:** Phase 37 — spine-4-2-timeline-coverage-hardening

## v1.5 Roadmap Summary

4 independent phases (any ordering correct; default 36 → 37 → 38 → 39):

| Phase | Goal | REQs | Plans (est.) |
|-------|------|------|--------------|
| 36 — Split Overrides Per Loader Mode | Atlas-source / atlas-less modes keep independent override maps | OVR-01..07 | 5 |
| 37 — Spine 4.2 Timeline Coverage Hardening | Source-audit + fixture-lock RGBA2 + InheritTimeline | TIMELINE-01..05 | 3 |
| 38 — Phase 4 Code-Review Polish Pass | Audit IN-01..06 against current code, apply still-applicable findings | POLISH-01..03 | 3 |
| 39 — Windows Host-Blocked UAT Burndown | Run Phase 20 + 31 Win-host UATs OR defer with audit-trail | WINUAT-01..03 | 3 |

**Coverage:** 18/18 v1.5 REQs mapped (no orphans, no duplicates).

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

---

*This file is authored fresh at milestone start. v1.4 phases preserved at `.planning/phases/32-*..35-*/` (per user choice — not archived to `milestones/v1.4-phases/`).*

**Last Milestone:** v1.4 (Spine 4.3 Forward-Compat + Rotated Atlases) — COMPLETE — 2026-05-12 (4 phases, 18 plans, 14 REQs; tag `v1.4.0` pending push).
**Current Milestone:** v1.5 (Override Routing + Coverage Hardening) — PLANNING — 4 phases, ~14 plans est., 18 REQs.
