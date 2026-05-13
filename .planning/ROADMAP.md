# Roadmap: Spine Texture Manager — Milestone v1.5

## Overview

v1.5 (Override Routing + Coverage Hardening) is a focused tech-debt + correctness milestone, not a feature milestone. Four independent phases burn down accumulated debt: fix the atlas-source / atlas-less override-bleed bug (math is already mode-invariant — only intent-routing is wrong; SEED-007 decisions 1, 2-A, 3-A LOCKED), close two unverified Spine 4.2 timeline coverage gaps with source-audit + fixtures (SEED-005 Level B), audit-and-apply six Phase 4 code-review carry-forwards against current code (some already swept by intervening phases), and burn down three long-lived Windows host-blocked UATs. Phases are mutually independent — any ordering is correct.

## Milestones

- ✅ **v1.0 MVP** — Phases 0–9 + 08.1 + 08.2 (shipped 2026-04-26) — archive at [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md)
- ✅ **v1.1.x Distribution & Hardening** — Phases 10–15 (shipped 2026-04-29)
- ✅ **v1.2 Expansion** — Phases 16–22.1 (shipped 2026-05-03) — archive at [.planning/milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md)
- ✅ **v1.3 Polish & UX** — Phases 23–28 (shipped 2026-05-07) — archive at [.planning/milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md)
- ✅ **v1.3.1 Correctness & Refinements** — Phases 29–31 (shipped 2026-05-09) — archive at [.planning/milestones/v1.3.1-ROADMAP.md](milestones/v1.3.1-ROADMAP.md)
- ✅ **v1.4 Spine 4.3 Forward-Compat + Rotated Atlases** — Phases 32–35 (shipped 2026-05-12) — archive at [.planning/milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md)
- 🚧 **v1.5 Override Routing + Coverage Hardening** — Phases 36–39 (in progress)

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

v1.5 continues phase numbering from v1.4 (which closed at Phase 35).

- [x] **Phase 36: Split Overrides Per Loader Mode** — Schema-additive `overridesAtlasLess` bucket + legacy file routing + per-bucket migration + AppShell threading (SEED-007 decisions 1/2-A/3-A locked) (completed 2026-05-13)
- [ ] **Phase 37: Spine 4.2 Timeline Coverage Hardening** — Source-audit RGBA2Timeline + InheritTimeline in spine-core 4.2 + InheritTimeline fixture + RGBA2 geometry-invariance test (SEED-005 Level B)
- [ ] **Phase 38: Phase 4 Code-Review Polish Pass** — Audit IN-01..06 against current code, apply still-applicable findings, resolve long-lived v1.0-era todo
- [ ] **Phase 39: Windows Host-Blocked UAT Burndown** — Run Phase 20 DocBuilder DnD UAT + Phase 31 admin DnD UAT on real Windows host if available, degrade to `human_needed` if host unavailable

## Phase Details

### Phase 36: Split Overrides Per Loader Mode
**Goal**: Atlas-source and atlas-less modes maintain independent override maps so applying an override in one mode never leaks into the other.
**Depends on**: Nothing (independent)
**Requirements**: OVR-01, OVR-02, OVR-03, OVR-04, OVR-05, OVR-06, OVR-07
**Success Criteria** (what must be TRUE):
  1. A user can apply an override in atlas-source mode, switch to atlas-less mode, and observe the atlas-less bucket is empty (fresh project) or retains its own pre-switch state — the atlas-source override is NOT visible in atlas-less rows; the reverse holds symmetrically.
  2. Loading a legacy v1.3.x / v1.4.x `.stmproj` saved in atlas-less mode routes the entire single-map override set into the atlas-less bucket (atlas-source bucket starts empty); the same file shape saved in atlas-source mode (or with no/`auto` loaderMode) routes the legacy map into the atlas-source bucket (atlas-less bucket starts empty). Implements SEED-007 Decision 2-A.
  3. Saving and reloading a v1.5 `.stmproj` with both buckets populated round-trips losslessly through the `project-file.ts` validator + serializer (missing `overridesAtlasLess` field pre-massaged to `{}`; both buckets serialized).
  4. Override migration runs independently per bucket against the shared mode-invariant `summary.regions`; `migratedKeyCount` sums across buckets and stale keys union for the migration banner.
  5. `buildExportPlan` signature is unchanged, panel prop signatures are unchanged, no `.stmproj` schema version bump is required (pure additive field, follows `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent), and SEED-007 frontmatter `status:` flips from `dormant` to `closed` at phase close.
**Plans**: 5 plans
- [x] 36-01-PLAN.md — Types + validator pre-massage (`overridesAtlasLess` + `restoredOverridesAtlasLess` + `mergedOverridesBuckets` rename in shared/types.ts; project-file.ts pre-massage + serializer + materializer)
- [x] 36-02-PLAN.md — Main-side IO: per-bucket migration at all 3 seams + legacy-routing decision (D-02/L-02) at the Open seam + rename `mergedOverrides` → `mergedOverridesBuckets` at rescue payloads
- [x] 36-03-PLAN.md — AppShell two-Map state + `activeOverrides` memo + thread through 4× `buildExportPlan` + OverrideDialog active-bucket writes + Save dual-bucket + `lastSaved`/dirty + mountOpenResponse/runReload + App.tsx rename + one-shot mode-toggle toast (D-01..D-04)
- [x] 36-04-PLAN.md — Tests: round-trip both buckets + legacy pre-massage path in `project-file.spec.ts`; per-bucket migration + stale-union in `override-migration.spec.ts`
- [x] 36-05-PLAN.md — AppShell mode-switch divergence integration test + SEED-007 status flip (dormant → closed) + phase-wide quality gate
**UI hint**: yes

### Phase 37: Spine 4.2 Timeline Coverage Hardening
**Goal**: Confirm RGBA2Timeline + InheritTimeline are render-scale-irrelevant under spine-core 4.2 by source audit and lock the contract via fixtures and tests.
**Depends on**: Nothing (independent)
**Requirements**: TIMELINE-01, TIMELINE-02, TIMELINE-03, TIMELINE-04, TIMELINE-05
**Success Criteria** (what must be TRUE):
  1. `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` appends source-read findings for `RGBA2Timeline.apply` in `node_modules/@esotericsoftware/spine-core/dist/Animation.js` (audit confirms by inspection that it writes only to `slot.color` / `slot.darkColor`; no geometry / Bone mutation) and `InheritTimeline.apply` in the same file (audit records whether it mutates `Bone.inherit` and whether that flag is read in `Bone.updateWorldTransform`).
  2. A minimal JSON fixture at `fixtures/INHERIT_TIMELINE/` exercises `inheritScale true → false → true` on a rotating child bone, and a unit test in `tests/core/sampler.spec.ts` runs the full sampler lifecycle (`state.update → state.apply → skeleton.update → updateWorldTransform(Physics.update)`) at the project's default 120 Hz and asserts the captured peak scale during the "detached" frame versus the always-inheriting baseline.
  3. **Conditional escalation checkpoint (TIMELINE-02 result drives TIMELINE-03 contract):** if the audit reveals InheritTimeline mutates a Bone field that affects `updateWorldTransform`, the test in (2) MUST assert peak > baseline (load-bearing — real-risk gap fix); if the audit shows no world-transform effect, the test still locks the regression-free invariance contract (precautionary). The phase plan calls this out as a planning checkpoint, not a deferred risk.
  4. A minimal JSON or synthetic-test fixture exercising RGBA2Timeline keyframes on one slot produces world-AABB sampler output that is byte-identical to the same animation without RGBA2 keyframes (geometry-invariance proof — closes the assumption that two-color tinting cannot affect render scale).
  5. `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` reflects items 5/6/7 closed and `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` frontmatter `status:` flips from `planted` to `closed` with closing phase reference.
**Plans**: 3 plans
- [ ] 37-01-audit-rgba2-inherit-PLAN.md — Source-audit RGBA2Timeline + InheritTimeline; append Items 6 + 7 to SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md; log TIMELINE-02 conditional escalation TRIGGERED
- [ ] 37-02-inherit-fixture-and-test-PLAN.md — Create fixtures/INHERIT_TIMELINE/ (JSON + atlas + placeholder PNG) + TIMELINE-03 sampler test asserting strict peak(detached) > peak(baseline)
- [ ] 37-03-rgba2-test-and-closure-PLAN.md — TIMELINE-04 RGBA2Timeline synthetic-injection geometry-invariance test + SEED-005 frontmatter status flip (planted → closed) + closure breadcrumb

### Phase 38: Phase 4 Code-Review Polish Pass
**Goal**: Sweep the six v1.0-era Phase 4 deferred IN-* findings against current code, applying only still-applicable ones, and retire the long-lived todo.
**Depends on**: Nothing (independent)
**Requirements**: POLISH-01, POLISH-02, POLISH-03
**Success Criteria** (what must be TRUE):
  1. An audit document at `.planning/phases/38-*/38-POLISH-AUDIT.md` enumerates each of IN-01 through IN-06 from `.planning/phases/04-scale-overrides/04-REVIEW.md` against current source (`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`, `src/renderer/src/modals/OverrideDialog.tsx`) with a verdict per finding: `applies / no-op (swept by Phase X) / skip (intentional per Phase Y)`. WR-03 is recorded as already closed by Phase 27 (functional `setSelected` updater).
  2. Each still-applicable finding lands as an atomic per-finding commit referencing the IN-NN tag: OverrideDialog focus-trap (IN-01) — either reword the misleading comment or land the ~15-line focus-trap implementation; drag-to-cancel guard (IN-02); empty-input guard (IN-03); sort comparator locale options (IN-05) so `CHAIN_10` sorts after `CHAIN_9`; dead `open` prop + early-return guard removal (IN-06) if still present after Phase 27.
  3. IN-04 (DRY-candidate flag — `highlightMatch` duplication from `SearchBar.tsx`) is explicitly skipped per Phase 2 pattern intent, and that decision is documented in the audit with rationale.
  4. `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` moves to `.planning/todos/resolved/` with a closing note referencing Phase 38 and listing the per-finding outcome (closed / skipped / no-op).
**Plans**: TBD (estimated 3 plans: 38-01 audit IN-01..06 against current code → POLISH-AUDIT.md, 38-02 apply still-applicable findings as atomic commits, 38-03 resolve long-lived todo with close-out note)
**UI hint**: yes

### Phase 39: Windows Host-Blocked UAT Burndown
**Goal**: On a real Windows host with an installed v1.x release binary, run the Phase 20 Documentation Builder DnD UAT and the Phase 31 admin DnD release UAT; degrade gracefully to `human_needed` with audit-trail intact if no Windows host is available this cycle.
**Depends on**: Nothing (independent — purely live-observation UAT)
**Requirements**: WINUAT-01, WINUAT-02, WINUAT-03
**Success Criteria** (what must be TRUE):
  1. On a real Windows host with an installed v1.x binary, UAT scenario 3 from `.planning/phases/20-documentation-builder-feature/20-HUMAN-UAT.md` (open project → DocBuilder modal → Animation Tracks pane → "+ Add Track" → drag-drop an animation onto Track 0; confirm drag image renders, drop creates an entry with `mixTime=0.25` + `loop=false`, no console errors) flips from `deferred` to `passed` or `failed` with the summary table updated. Linux scope is dropped per `project_linux_deferred` memory.
  2. On a real Windows host with an installed v1.x binary, item 1 of `.planning/phases/31-loader-ux-small-fixes-batch/31-HUMAN-UAT.md` (right-click → Run as administrator → UAC confirm → with idle DropZone, verbatim two-sentence advisory renders: *"Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges."* → drag-over ring does NOT appear on file hover → File → Open still works → relaunch normally with no admin → DnD works as before) flips from `deferred` to `passed` or `failed`.
  3. If either UAT executed end-to-end, the corresponding pending todo (`.planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` and/or `.planning/todos/pending/2026-05-08-phase-31-windows-admin-dnd-release-uat.md`) moves to `.planning/todos/resolved/` with a closing note. If a Windows host is NOT available this cycle, phase outcome is `human_needed`, the unexecuted todos stay in `pending/` with an updated note carrying them forward to v1.6+, and phase closure gates on programmatic verification + audit-trail integrity — NOT on host availability.
  4. The phase plan explicitly documents the graceful-degradation contract up front: WINUAT-01 and WINUAT-02 outcomes are independent (one can pass while the other defers), and `human_needed` is a first-class non-failure outcome for this phase.
**Plans**: TBD (estimated 3 plans: 39-01 host-availability check + decision gate documenting graceful-degradation contract, 39-02 WINUAT-01 DocBuilder DnD scenario on Win host OR structured deferral, 39-03 WINUAT-02 admin DnD scenario on Win host OR structured deferral + WINUAT-03 todo resolution)
**UI hint**: yes

## Progress

**Execution Order:**
Phases are mutually independent — any ordering is correct. Default sequential 36 → 37 → 38 → 39 reflects estimated effort (largest scope first) and lets Win-host availability for Phase 39 surface late in the cycle.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 36. Split Overrides Per Loader Mode | 5/5 | Complete    | 2026-05-13 |
| 37. Spine 4.2 Timeline Coverage Hardening | 0/3 | Not started | - |
| 38. Phase 4 Code-Review Polish Pass | 0/3 | Not started | - |
| 39. Windows Host-Blocked UAT Burndown | 0/3 | Not started | - |

---

*Roadmap defined 2026-05-13 at v1.5 milestone start. Continues phase numbering from v1.4 (which closed at Phase 35). v1.4 ROADMAP archived at `.planning/milestones/v1.4-ROADMAP.md`; v1.4 phase directories preserved per MILESTONES.md note.*

*Locked design constraints carried into v1.5 phase planning:*

- *SEED-007 decisions 1 (schema-additive `overridesAtlasLess` field, no version bump), 2-A (legacy file routing by saved `loaderMode`), 3-A (no auto-copy on mode switch) — locked 2026-05-12. The planner SHOULD NOT relitigate during `/gsd-plan-phase 36`. Optional UX nudge (one-shot toast) is planner-decided per SEED-007; defer to v1.6 if scope pressure surfaces.*
- *TIMELINE-02 has a conditional escalation clause — if the InheritTimeline source audit reveals world-transform effects, TIMELINE-03 becomes load-bearing (real-risk gap fix) rather than precautionary (invariance lock). This is a `/gsd-plan-phase 37` checkpoint, not a deferred risk.*
- *Some POLISH IN-* findings may already be no-ops by the time Phase 38 runs (WR-03 already closed in Phase 27 per PROJECT.md Key Decisions). POLISH-01 audit step confirms which still apply.*
- *WINUAT-01..03 are host-blocked. Phase 39 outcome is `human_needed` if no Win host is available this cycle; todos carry forward to v1.6+. Closure gates on programmatic verification + audit-trail integrity, NOT on host availability.*
