---
gsd_state_version: 1.0
milestone: v1.5.1
milestone_name: Spine Animation Viewer
status: executing
last_updated: "2026-05-15T15:23:33.545Z"
last_activity: 2026-05-15 -- Phase 41 planning complete
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 3
  completed_plans: 0
  percent: 0
---

# State

## Current Position

Phase: 41 — Spine Animation Viewer (context gathered)
Plan: —
Status: Ready to execute
Last activity: 2026-05-15 -- Phase 41 planning complete

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-05-15 after v1.5 milestone close).

**Core value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

**Current focus:** v1.5.1 — Spine Animation Viewer (Phase 41; viewer-only scope per user, Phase 40 polish items remain deferred to v1.5.2 / v1.6).

## Last Completed Milestone

**Milestone v1.5 — Override Routing + Coverage Hardening + Atlas Repack — SHIPPED 2026-05-15.** 5 phases (36, 37, 38, 39, 40), 23 plans, 18 documented REQs + 10 REPACK REQs (folded into v1.5-REQUIREMENTS.md archive). Full record in `.planning/MILESTONES.md`; archive at `.planning/milestones/v1.5-ROADMAP.md` + `.planning/milestones/v1.5-REQUIREMENTS.md` + `.planning/milestones/v1.5-MILESTONE-AUDIT.md`. Tag `v1.5.0` pending push.

**v1.5 closures (resolved this milestone):**

| Item | Closure |
|------|---------|
| SEED-005 (RGBA2 + InheritTimeline coverage) | Phase 37 — TIMELINE-01..05 satisfied; SEED frontmatter `status: closed` |
| SEED-007 (Split overrides per loaderMode) | Phase 36 — OVR-01..07 satisfied; SEED frontmatter `status: closed` |
| SEED-008 (Atlas Repack Output) | Phase 40 — REPACK-01..10 satisfied; SEED frontmatter `status: closed` |
| Phase 4 code-review follow-up todo (v1.0-era) | Phase 38 — IN-02 fix landed; 5 no-ops + 1 skip documented in `38-POLISH-AUDIT.md`; todo retired to `resolved/` |
| Phase 20 Win/Linux DnD UAT todo (v1.1.x-era) | Phase 39 — WINUAT-01 `passed` live; Linux scope dropped per `project_linux_deferred`; todo retired to `resolved/` |
| Phase 31 Win admin DnD UAT todo (v1.3.1-era) | Phase 39 — WINUAT-02 `passed` live; todo retired to `resolved/` |
| Window X-button / Cmd+W dirty-save guard | `ef38cd3` during Phase 36 UAT (pre-existing since Phase 8/18, surfaced + fixed in same cycle) |

## Deferred Items

Carried forward from v1.5 milestone close (2026-05-15). Items resolved/addressed in v1.5 are noted above under "v1.5 closures".

**v1.5 user-deferred (Phase 40 polish — `40-REVIEW.md`):**

| Severity | Finding | Description |
|----------|---------|-------------|
| ⚠ Warning | WR-03 | `SkeletonNotFoundOnLoadError` envelope drops 4 atlas fields on locate-skeleton-twice recovery (`src/shared/types.ts:880-917` + `src/main/project-io.ts:936-961`) |
| ⚠ Warning | WR-04 | AppShell does not thread atlas fields into `ResampleArgs` payload — main-side coerce is dead code on happy path (`src/renderer/src/components/AppShell.tsx:1295-1322` + `:1760-1794`) |
| ⚠ Warning | WR-05 | `writtenPaths` rollback lacks defense-in-depth outDir-containment check (`src/main/ipc.ts:974-976`) |
| ⚠ Warning | WR-07 | `regionBuffers.get(r.regionName)!` non-null assertion in composite layers (`src/main/repack-worker.ts:347-351`) |
| ℹ Info | IN-01 | Duplicate `pageFilename` helper in `atlas-paths.ts` AND `atlas-writer.ts` (drift risk on future change) |
| ℹ Info | IN-02 | `regionBuffers` Map never `.clear()`'d after page composite (memory pressure on 100+ MB atlases) |
| ℹ Info | IN-03 | `deriveProjectName` generic error message when basename contains `:` (UX nit) |
| ℹ Info | IN-04 | Duplicate-outPath warning emits `status:'success'` progress event (masks D-108 regression upstream) |

All explicitly deferred per user decision in `40-REVIEW.md`. Backlog candidates for v1.6+ polish phase.

**Still deferred (pre-v1.5 carry-forwards):**

| Category | Item | Status |
|----------|------|--------|
| debug | phase-0-scale-overshoot | investigating — v1.0-era AABB/rotation tech debt; no regression observed across 8 milestones |
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

**Audit-acknowledged at v1.5 close (scanner false-positives, kept for paper trail):**

| Item | Reality |
|------|---------|
| quick_task `260505-lk0-fix-sampler-silent-discard-of-alpha-0-at` | SUMMARY frontmatter shows `status: shipped, shipped_commit: 0832660, shipped_date: 2026-05-05`. Scanner reads `[missing]` due to frontmatter-shape drift; the work shipped 10 days ago. |
| Phase 36 36-HUMAN-UAT.md | Frontmatter shows `status: passed`, `total: 8 / passed: 8 / issues: 0 / pending: 0`. Scanner reads `[unknown]` due to frontmatter-shape mismatch; all 8 scenarios passed 2026-05-13 with user approval. |

## Accumulated Context (carries across milestones)

(Preserved from prior milestones — sampler lifecycle, override semantics, export uniform-only, .stmproj schema, Layer 3 invariant, 5-modal ARIA pattern, distribution + CI surface, region-keyed dedup contract added in v1.3.1, split-overrides-per-loaderMode added in v1.5, additive atlas-repack-output added in v1.5 — all locked. See PROJECT.md `## Key Decisions` and `## Constraints` for the full list.)

### v1.5 Locked Constraints (preserved for future reference)

- **SEED-007 Decision 1:** schema-additive `overridesAtlasLess` field; no `.stmproj` version bump (follows `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent). [LOCKED + SHIPPED Phase 36]
- **SEED-007 Decision 2-A:** legacy v1.3.x/v1.4.x `.stmproj` routes by saved `loaderMode` at the Open seam. [LOCKED + SHIPPED Phase 36]
- **SEED-007 Decision 3-A:** mode-switch leaves inactive bucket untouched; no auto-copy. [LOCKED + SHIPPED Phase 36]
- **TIMELINE-02 conditional escalation:** TRIGGERED — `bone.inherit` mutation at `Animation.js:755` is read by `Bone.updateLocalToWorld switch (this.inherit)` at `Bone.js:144`; TIMELINE-03 became load-bearing; observed 2.5× ratio. [SHIPPED Phase 37]
- **WINUAT-01..03 host-blocked graceful degradation:** Phase 39 `human_needed` outcome was first-class non-failure; in this cycle, `host_available: yes` so both UATs ran live. [SHIPPED Phase 39]
- **SEED-008 (Phase 40) locked design facts:** Output mode is additive (loose default unchanged); JSON invariant under repack (source-confirmed spine-ts 4.2.111); both atlas-source + atlas-less input loaderModes supported on output; 4 additive `.stmproj` fields with no schema bump (NOT 7 as originally documented; spec collapsed at /gsd-spec-phase 40); `core/` stays pure-TS for pack math; sharp + `.atlas` writing in `main/`; `safetyBufferPercent` / `sharpenOnExport` / D-91 cap apply pre-pack per-region. [LOCKED + SHIPPED Phase 40]

### v1.5.1 Locked Design Facts (from SEED-009 — do not relitigate)

1. **Use Esoteric's official `@esotericsoftware/spine-player` library** — no hand-rolled renderer.
2. **`spine-player` is a sibling package to the already-installed `spine-core`** — both coexist; no API drift expected within 4.2.x.
3. **The viewer is read-only** — validation surface, not authoring surface.
4. **The viewer does NOT replace `AtlasPreviewModal`** — static atlas layout vs animation playback; different jobs, both stay.

Open decisions D-01 (npm vs vendor) / D-02 (modal vs split-pane vs tab) / D-03 (mount location) / D-04 (asset feed) are deferred to `/gsd-discuss-phase 41` per SEED-009.

### Roadmap Evolution

- 2026-05-14 — Phase 40 added (`atlas-repack-output`) post-hoc after v1.5 marked `milestone_complete`. v1.5 reopened (`status: in_progress`, `total_phases: 4 → 5`). Phase 40 became the v1.5 milestone-close phase; planted as SEED-008 immediately prior. Branch `experiment/phase-40-atlas-repack` was used.
- 2026-05-15 — v1.5 SHIPPED with all 5 phases verified, milestone audit passed, archives written. Tag `v1.5.0` pending push.
- 2026-05-15 — v1.5.1 STARTED; ROADMAP.md created with single Phase 41 (Spine Animation Viewer) covering all 8 active VIEWER reqs. Continues phase numbering from v1.5 (no `--reset-phase-numbers`). v1.5 phase directories 36–40 retained at `.planning/phases/`.

---

*This file is authored fresh at milestone start. v1.5 phases preserved at `.planning/phases/36-*..40-*/` (per user choice — not archived to `milestones/v1.5-phases/`).*

**Last Milestone:** v1.5 (Override Routing + Coverage Hardening + Atlas Repack) — COMPLETE — 2026-05-15 (5 phases, 23 plans, 18 + 10 REQs; tag `v1.5.0` pending push).
**Current Milestone:** v1.5.1 (Spine Animation Viewer) — PLANNING — Phase 41 roadmapped 2026-05-15; awaiting `/gsd-discuss-phase 41` → `/gsd-plan-phase 41`.
