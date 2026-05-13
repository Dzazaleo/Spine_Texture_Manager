---
gsd_state_version: 1.0
milestone: v1.5
milestone_name: Override Routing + Coverage Hardening
status: planning
last_updated: "2026-05-13T07:45:12.602Z"
last_activity: 2026-05-13
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
Last activity: 2026-05-13 — Milestone v1.5 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-12 — v1.4 shipped, v1.4.0 tag pending push)

**Core value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.
**Current focus:** v1.5 — Override Routing + Coverage Hardening. Scope: SEED-007 (split overrides per loaderMode), SEED-005 Level B (RGBA2 + InheritTimeline coverage), 3 long-lived pending todos.

## Last completed milestone

**Milestone v1.4 — Spine 4.3 Forward-Compat + Rotated Atlases — SHIPPED 2026-05-12.** 4 phases (32, 33, 34, 35), 18 plans, 14 REQs (COMPAT-01..02 + ATLAS-01..04 + OPEN-01..05 + DEDUP-04..06). Phase 32 added 4.3-beta detect-and-warn + drop-zone v4.2 disclosure + planted SEED-006 (full 4.3 runtime port). Phase 33 added rotated atlas region support (loader D-01 attachment-walk for canonical-corner offset override + AABB W↔H swap + `sharp.rotate(+90)` materialization; libgdx atlas convention nuance documented). Phase 34 added File → Open `.json` acceptance via two-IPC-step `'project:open-dialog'` flow with dirty-guard-after-picker (amends Phase 08.2 D-183 for the menu path). Phase 35 migrated `buildExportPlan` from `summary.peaks` to `summary.regions` in both core and renderer parity (closes multi-skin atlas-source undercount: 160 atlas regions previously collapsed to 23 ExportRows on `fixtures/SKINS/JOKERMAN_SPINE.json`; now 160). HUMAN-UAT 1 scenario (Phase 34 picker rendering parity) host-blocked, deferred. Full record in `.planning/MILESTONES.md`; archive at `.planning/milestones/v1.4-ROADMAP.md`.

**Prior milestone:** v1.3.1 (2026-05-09) — 3 phases, 16 plans, 20 REQs (REGION-01..07 + PREVIEW-01 + BUFFER-01..03 + LOAD-05..07 + PANEL-08..11 + PLATFORM-01 + TOOLTIP-01). Six patch tags through v1.3.6.

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

**v1.4-era deferred items (added at close 2026-05-12):**

| Category | Item | Status |
|----------|------|--------|
| uat_gaps | Phase 34 34-HUMAN-UAT.md | partial — 1 open scenario: macOS/Windows picker rendering parity verification; host-blocked |
| verification_gaps | Phase 34 34-VERIFICATION.md | human_needed — same root as the above (picker UI verification requires Electron-on-host) |
| debug | skins-optimize-undercount | resolved — root cause closed by Phase 35 region-keyed export plan migration; doc retained as historical record |

**Seeds (status after v1.4):**

- SEED-003 (Spine 4.3 compatibility) — planted 2026-05-07; **closed in v1.4 Phase 32** (detect-and-warn shipped; full port deferred to SEED-006).
- SEED-004 (Rotated atlas regions) — planted 2026-05-08; **closed in v1.4 Phase 33** (Option B: full rotated-region support).
- SEED-005 (RGBA2 + InheritTimeline coverage) — planted 2026-05-08; **still dormant** (audit-only or full feature surface; not in v1.4 scope).
- SEED-006 (Full Spine 4.3 runtime port) — planted at v1.4 Phase 32 close; **still dormant** (trigger: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x AND/OR a paying user reports they cannot re-export their rig as Version 4.2).
- **SEED-007 (Split overrides per loaderMode)** — planted 2026-05-12 pre-close; **dormant**. atlas-source/atlas-less override-bleed bug; math is mode-invariant (verified during seed-capture) but intent-routing wrong. Locked decisions: schema split (additive, no version bump), legacy file route-by-saved-loaderMode (2-A), inactive bucket stays empty on mode switch (3-A). Trigger: v1.5+ when scoping overrides/loaderMode work or any milestone touching `.stmproj` schema or atlas-less mode ergonomics.

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, region-keyed dedup contract added in v1.3.1, all locked. See PROJECT.md `## Key Decisions` and `## Constraints` for the full list.)

### Roadmap Evolution

- 2026-05-11: Phase 34 added — File > Open menu accepts Spine skeleton JSON files (not only `.stmproj`). Closes asymmetry vs drag-drop surface; reuses Phase 08.1/08.2 wiring. Added manually after `gsd-sdk query phase.add` miscounted (picked 23 instead of 34); per memory `project_gsd_phase_complete_state_miscount`, SDK progress counters will re-derive from ROADMAP.md on next phase op.
- 2026-05-11: Phase 34 context gathered via `/gsd-discuss-phase 34`. 6 decisions locked (D-01..D-06): unified picker filter, main-side suffix-branch, three-arm discriminated envelope, drag-drop loader-cascade reuse, dirty-guard-after-picker (amends Phase 08.2 D-183 for menu path), two-IPC-step architecture (`openProjectPicker` + `loadSkeletonFromPath`). Introduces `OPEN-0x` REQ namespace (planner threads into REQUIREMENTS.md). Ready for `/gsd-plan-phase 34`.
- 2026-05-12: Phase 35 added — Region-keyed export plan (propagate Phase 29 dedup to Optimize modal + Atlas Preview optimized mode). Added manually (ROADMAP.md + STATE.md edits + `.planning/phases/35-region-keyed-export-plan/`) following memory `project_gsd_phase_complete_state_miscount` — SDK had previously marked v1.4 `milestone_complete` after Phase 34; manual edit resets status to `active` and restores accurate v1.4 counters (4 phases / 3 complete / 14 plans complete). Root cause for the underlying bug already closed in `.planning/debug/skins-optimize-undercount.md`: `buildExportPlan` iterates `summary.peaks` (attachment-name-deduped) instead of `summary.regions` (region-keyed); fix is mechanical iteration-source swap mirrored byte-identically in `src/core/export.ts` and `src/renderer/src/lib/export-view.ts` per lockstep parity invariant. Surfaced via testing of new `fixtures/SKINS/JOKERMAN_SPINE.json` multi-skin fixture (7 skins, 160 regions → 23 export rows under current code). Ready for `/gsd-discuss-phase 35`.

---

*This file is authored fresh at milestone start. v1.3.1 phases are archived under `.planning/milestones/v1.3.1-phases/` (29, 30, 31).*

**Last Milestone:** v1.4 (Spine 4.3 Forward-Compat + Rotated Atlases) — COMPLETE — 2026-05-12 (4 phases, 18 plans, 14 REQs; tag `v1.4.0` pending push).
**Current Milestone:** none — awaiting `/gsd-new-milestone` for v1.5 scoping.
