---
gsd_state_version: 1.0
milestone: v1.4
milestone_name: Spine 4.3 Forward-Compat + Rotated Atlases
status: planning
last_updated: "2026-05-10T13:22:27.797Z"
last_activity: 2026-05-10
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# State

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-10 — Milestone v1.4 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-09 — v1.3.1 shipped)

**Core value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.
**Current focus:** Tag v1.3.1 → CI release build → publish draft Release. Plan v1.4 milestone after.

## Last Roadmap Update

2026-05-09 — v1.3.1 milestone complete. ROADMAP.md: v1.3.1 milestone bullet flipped to ✅ shipped; Phases 29/30/31 collapsed into `<details>` block; Progress table closed for v1.3.1. Phases 29/30/31 directories archived to `.planning/milestones/v1.3.1-phases/`. REQUIREMENTS.md → archived as `milestones/v1.3.1-REQUIREMENTS.md` (20 REQ-IDs all marked complete) + removed from `.planning/`. MILESTONES.md gained a v1.3.1 entry (3 phases / 16 plans / 20 REQs / Phase 29/30/31 accomplishments + late tester-regression fixes 1b5414c/834c975/d86e7b3). PROJECT.md current-state updated; v1.3.1 decisions appended.

## Last completed milestone

**Milestone v1.3.1 — Correctness & Refinements — SHIPPED 2026-05-09.** 3 phases, 16 plans, 20 REQs. Phase 29 closed the per-region dedup correctness gap (path-indirected duplicate rows surfaced post-v1.3 ship — analyzer.ts attachmentName→regionName key flip + RegionRow IPC type + override-region semantics + atlas-preview pack-page accuracy). Phase 30 added the user-configurable safety-buffer % control to the Optimize dialog with NARROW `bufferCapped` predicate per CONTEXT D-06; persisted as additive optional field in `.stmproj` v1 mirroring `sharpenOnExport`. Phase 31 small-fixes batch: source-toggle disabling on missing artifacts (LOAD-05/06/07), Animation Breakdown collapse defaults + bulk Expand/Collapse all (PANEL-08..11; in-memory only), Windows admin DnD fallback advisory (PLATFORM-01), ExtrapolationIcon tooltip primitive (TOOLTIP-01). Late tester-regression fixes 1b5414c (Strip-Whitespace export pipeline) + 834c975 (auto-expand failed Optimize rows) + d86e7b3 (per-frame canonical dims for sequence attachments).

## Deferred Items

Items acknowledged and deferred at v1.3.1 milestone close on 2026-05-09. Combines pre-v1.3.1 carry-forwards (still open from v1.0–v1.3 — most are host-blocked or jsdom-blocked structural gaps) with v1.3.1-era release-time UAT items.

**Pre-v1.3.1 carry-forwards (still open from v1.0–v1.3):**

| Category | Item | Status |
|----------|------|--------|
| debug | phase-0-scale-overshoot | investigating — v1.0-era AABB/rotation tech debt; no regression observed across 6 milestones |
| uat_gaps | Phase 14 14-HUMAN-UAT.md | signed-off — 6 pending auto-update live-observation scenarios; v1.1.x carry-forward |
| uat_gaps | Phase 15 15-HUMAN-UAT.md | signed-off — 12 pending scenarios; v1.1.x carry-forward |
| uat_gaps | Phase 20 20-HUMAN-UAT.md | partial — Doc Builder Windows DnD UAT; host-blocked |
| verification_gaps | Phase 14 14-VERIFICATION.md | human_needed — auto-update live verification; v1.1.x carry-forward |
| verification_gaps | Phase 20 20-VERIFICATION.md | human_needed — Doc Builder Windows DnD; host-deferred |
| verification_gaps | Phase 21 21-VERIFICATION.md | human_needed — atlas-less mode HUMAN-UAT; explicitly deferred per user during Phase 21 execute |
| quick_task | 2026-04-24-phase-4-code-review-follow-up.md | v1.0-era Phase 4 code review todo; long-lived tech debt |
| quick_task | 2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md | Phase 20 Windows DnD UAT; host-blocked. Linux clause obsolete (Linux build dropped in v1.3) |
| uat_gaps | Phase 23 23-HUMAN-UAT.md | partial — 4 pending scenarios; require Electron native folder picker (not jsdom-testable) |
| uat_gaps | Phase 26.1 26.1-HUMAN-UAT.md | partial — 7 pending visual scenarios; require running dev server |
| verification_gaps | Phase 23 23-VERIFICATION.md | human_needed — 7/7 must-haves verified at code level; "human_needed" only because Electron native dialogs cannot run in jsdom. No real implementation gap. |
| verification_gaps | Phase 25 25-VERIFICATION.md | human_needed — 10/13 verified; 3 visual UAT items require running Electron dev server (no implementation gap) |

**v1.3.1-era acknowledgments (release-time UAT — explicitly meant to be done at tag time):**

| Category | Item | Status |
|----------|------|--------|
| uat_gaps | Phase 30 30-HUMAN-UAT.md | partial — 4 pending scenarios; pre-release human verification |
| verification_gaps | Phase 30 30-VERIFICATION.md | human_needed — pre-release verification (visual + integration) |
| verification_gaps | Phase 31 31-VERIFICATION.md | human_needed — Windows admin DnD live observation explicitly deferred to release per commit 623c0a3 |
| pending_todo | 2026-05-08-phase-31-windows-admin-dnd-release-uat.md | release-time UAT recipe for Windows admin DnD fallback — captured in pending todos |
| debug | path-indirected-duplicate-rows | pending_phase_plan — root cause closed by Phase 29 region-dedup fix; debug doc kept as a v1.4 reference for related surfaces (Atlas Preview optimized-mode tile expansion) |
| debug | post-v1-3-tester-regressions | diagnosed — analyzer.ts atlas-region-name vs entry-name key bug; root-fixed by Phase 29 region-keyed dedup; doc retained for v1.4 follow-up surface audits |

**Seeds for v1.4:**

- SEED-003 (Spine 4.3 compatibility) — planted 2026-05-07 (commit `823f490`); primary v1.4 candidate.
- SEED-004 (Rotated atlas regions) — planted 2026-05-08; A=error UX or B=full rotated-region support.
- SEED-005 (RGBA2 + InheritTimeline coverage) — planted 2026-05-08; audit-only or full feature surface.

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, region-keyed dedup contract added in v1.3.1, all locked. See PROJECT.md `## Key Decisions` and `## Constraints` for the full list.)

---

*This file is authored fresh at milestone start. v1.3.1 phases are archived under `.planning/milestones/v1.3.1-phases/` (29, 30, 31).*

**Last Milestone:** v1.3.1 (Correctness & Refinements) — COMPLETE — 2026-05-09 (3 phases, 16 plans, 20 REQs; tag pending).
