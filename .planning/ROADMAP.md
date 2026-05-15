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
- [x] **Phase 37: Spine 4.2 Timeline Coverage Hardening** — Source-audit RGBA2Timeline + InheritTimeline in spine-core 4.2 + InheritTimeline fixture + RGBA2 geometry-invariance test (SEED-005 Level B) (completed 2026-05-13)
- [x] **Phase 38: Phase 4 Code-Review Polish Pass** — Audit IN-01..06 against current code, apply still-applicable findings, resolve long-lived v1.0-era todo (completed 2026-05-13)
- [x] **Phase 39: Windows Host-Blocked UAT Burndown** — Run Phase 20 DocBuilder DnD UAT + Phase 31 admin DnD UAT on real Windows host if available, degrade to `human_needed` if host unavailable (completed 2026-05-13)
- [ ] **Phase 40: Atlas Repack Output** — Optimize Dialog gains additive `loose | atlas | both` output mode (default loose); emits libgdx-format `.atlas` + composite page PNG(s) via `maxrects-packer` (already in deps) + sharp per-region trim/rotate/composition; both atlas-source + atlas-less input loaderModes supported; JSON invariant under repack (source-confirmed spine-ts 4.2.111); 7 additive `.stmproj` fields (no schema bump); `safetyBufferPercent` / `sharpenOnExport` / D-91 cap apply pre-pack per-region (SEED-008)

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
- [x] 37-01-audit-rgba2-inherit-PLAN.md — Source-audit RGBA2Timeline + InheritTimeline; append Items 6 + 7 to SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md; log TIMELINE-02 conditional escalation TRIGGERED
- [x] 37-02-inherit-fixture-and-test-PLAN.md — Create fixtures/INHERIT_TIMELINE/ (JSON + atlas + placeholder PNG) + TIMELINE-03 sampler test asserting strict peak(detached) > peak(baseline)
- [x] 37-03-rgba2-test-and-closure-PLAN.md — TIMELINE-04 RGBA2Timeline synthetic-injection geometry-invariance test + SEED-005 frontmatter status flip (planted → closed) + closure breadcrumb

### Phase 38: Phase 4 Code-Review Polish Pass
**Goal**: Sweep the six v1.0-era Phase 4 deferred IN-* findings against current code, applying only still-applicable ones, and retire the long-lived todo.
**Depends on**: Nothing (independent)
**Requirements**: POLISH-01, POLISH-02, POLISH-03
**Success Criteria** (what must be TRUE):
  1. An audit document at `.planning/phases/38-*/38-POLISH-AUDIT.md` enumerates each of IN-01 through IN-06 from `.planning/phases/04-scale-overrides/04-REVIEW.md` against current source (`src/renderer/src/panels/GlobalMaxRenderPanel.tsx`, `src/renderer/src/modals/OverrideDialog.tsx`) with a verdict per finding: `applies / no-op (swept by Phase X) / skip (intentional per Phase Y)`. WR-03 is recorded as already closed by Phase 27 (functional `setSelected` updater).
  2. Each still-applicable finding lands as an atomic per-finding commit referencing the IN-NN tag: OverrideDialog focus-trap (IN-01) — either reword the misleading comment or land the ~15-line focus-trap implementation; drag-to-cancel guard (IN-02); empty-input guard (IN-03); sort comparator locale options (IN-05) so `CHAIN_10` sorts after `CHAIN_9`; dead `open` prop + early-return guard removal (IN-06) if still present after Phase 27.
  3. IN-04 (DRY-candidate flag — `highlightMatch` duplication from `SearchBar.tsx`) is explicitly skipped per Phase 2 pattern intent, and that decision is documented in the audit with rationale.
  4. `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` moves to `.planning/todos/resolved/` with a closing note referencing Phase 38 and listing the per-finding outcome (closed / skipped / no-op).
**Plans**: 3 plans
- [x] 38-01-PLAN.md — POLISH-01 audit IN-01..IN-06 + WR-03 against current source → `.planning/phases/38-phase-4-code-review-polish-pass/38-POLISH-AUDIT.md` (verdict per finding: 1 applies / 5 no-op swept by Phase 6 + Phase 27 / 1 skip)
- [x] 38-02-PLAN.md — POLISH-02 apply IN-02 drag-to-cancel guard (`onMouseDown` + `e.target === e.currentTarget`) in `src/renderer/src/modals/OverrideDialog.tsx` + new regression spec `tests/renderer/override-dialog-drag-to-cancel.spec.tsx` as two atomic commits (test-first per Phase 27 precedent)
- [x] 38-03-PLAN.md — POLISH-03 git-mv `2026-04-24-phase-4-code-review-follow-up.md` from pending/ to resolved/ + append `## Resolved` close-out section referencing Phase 38 + per-finding outcomes
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
**Plans**: 3 plans
- [x] 39-01-PLAN.md — Host-availability checkpoint + 39-CONTRACT.md (graceful-degradation contract documenting WINUAT-01..02 independence, `human_needed` first-class non-failure, Phase 20 UAT deletion fact + Phase 31 UAT archived-path correction, plan-routing matrix) (WINUAT-01..03 joint gate)
- [x] 39-02-PLAN.md — WINUAT-01 live-execution on Windows OR structured deferral (DocBuilder DnD scenario; outcome recorded in Phase 20 pending-todo since 20-HUMAN-UAT.md was deleted in v1.2 cleanup)
- [x] 39-03-PLAN.md — WINUAT-02 live-execution on Windows OR structured deferral (admin DnD advisory scenario; flips item 1 in `.planning/milestones/v1.3.1-phases/31-loader-ux-small-fixes-batch/31-HUMAN-UAT.md` archived path + handles Phase 31 todo lifecycle = WINUAT-03 Phase-31-half)
**UI hint**: yes

## Progress

**Execution Order:**
Phases are mutually independent — any ordering is correct. Default sequential 36 → 37 → 38 → 39 reflects estimated effort (largest scope first) and lets Win-host availability for Phase 39 surface late in the cycle. Phase 40 was added after Phases 36–39 completed (2026-05-14) and is the v1.5 milestone-close phase; it depends on no earlier v1.5 work.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 36. Split Overrides Per Loader Mode | 5/5 | Complete    | 2026-05-13 |
| 37. Spine 4.2 Timeline Coverage Hardening | 3/3 | Complete    | 2026-05-13 |
| 38. Phase 4 Code-Review Polish Pass | 3/3 | Complete    | 2026-05-13 |
| 39. Windows Host-Blocked UAT Burndown | 3/3 | Complete    | 2026-05-13 |
| 40. Atlas Repack Output | 7/9 | In Progress|  |

### Phase 40: Atlas Repack Output
**Goal**: Optimize Dialog gains an additive `loose | atlas | both` output mode (default `loose`) that emits a libgdx-format `.atlas` + composite page PNG(s), letting animators ship packed atlases directly from optimized regions without round-tripping through the Spine editor.
**Depends on**: Nothing (independent — Optimize Dialog already a v1.4 surface)
**Requirements**: REPACK-01, REPACK-02, REPACK-03, REPACK-04, REPACK-05, REPACK-06, REPACK-07, REPACK-08, REPACK-09, REPACK-10
**Success Criteria** (what must be TRUE):
  1. Optimize Dialog renders a `loose | atlas | both` radio (default `loose`); existing loose-PNG export pipeline is byte-unchanged in the `loose` default. Selecting `atlas` or `both` activates the repack path.
  2. With mode `atlas` or `both`, the export emits a libgdx-format `.atlas` text file + 1..N composite page PNGs at the same output root used by loose export today. Page layout is computed by `maxrects-packer` (already in `package.json`) over the same per-region pixel data loose export would write.
  3. Per-region quality knobs apply **before packing**: `safetyBufferPercent`, `sharpenOnExport`, and the D-91 cap each transform per-region pixel data prior to layout. Pack geometry is purely mechanical; no quality knob interacts with packing.
  4. Both `atlas-source` and `atlas-less` input loaderModes produce identical repack output for the same set of optimized regions. Per [[project_strict_loadermode_separation]], loaderMode gates only the input side; the repack pipeline is mode-agnostic on output.
  5. Skeleton JSON is **not modified** by repack. Source-confirmed against spine-ts 4.2.111 per [[project_spine_4_2_atlas_json_precedence]]: runtime reads region dims from `.atlas`, references are by name, so `.atlas` + page PNGs are the only changed artifacts.
  6. `.stmproj` schema gains up to 7 additive fields for repack settings (no `project_format_version` bump — precedent: `loaderMode`, `sharpenOnExport`, `safetyBufferPercent`). v1.5-era `.stmproj` files written before Phase 40 round-trip losslessly through the validator.
  7. `core/` stays pure-TS (pack math + region planning); sharp invocations + `.atlas` text writing live in `main/`. Vitest covers pack math headlessly with synthetic region inputs.
  8. SEED-008 frontmatter `status:` flips from `dormant` to `closed` at phase close, with closing breadcrumb to Phase 40.
**Plans**: 9 plans
- [x] 40-01-PLAN.md — `.stmproj` schema extension (REPACK-07): 4 additive ProjectFileV1 + AppSessionState fields, validator pre-massage, ExportProgressEvent.phase
- [x] 40-02-PLAN.md — `core/repack.ts` pure-TS pack planner (REPACK-02, REPACK-06): maxrects-packer wrapper, deterministic regionName sort, oversize pre-flight
- [x] 40-03-PLAN.md — `main/atlas-writer.ts` libgdx text serializer (REPACK-04, REPACK-06): TextureAtlas round-trip, multi-page, rotation flag
- [x] 40-04-PLAN.md — Shared resize helper extraction (`main/sharp-resize.ts`, D-03a): resizeToTmpFile + resizeToBuffer; loose-mode byte parity preserved
- [x] 40-05-PLAN.md — `main/repack-worker.ts` sharp orchestration (REPACK-03, REPACK-05, REPACK-10): emit-truth, materialize-rotate, atomic-or-fail, locked error string
- [x] 40-06-PLAN.md — IPC extension (REPACK-01, REPACK-10, D-04, D-04a, D-05): export:start outputMode + atlasOpts; validateExportOpts; shared writtenPaths rollback
- [x] 40-07-PLAN.md — OptimizeDialog Output card UI (REPACK-01, D-01..D-01e): radio + 3 conditional knobs; AppShell threading; preload bridge
- [ ] 40-08-PLAN.md — SHA256 baselines + regression sentinel (REPACK-01, REPACK-08, REPACK-09): loose-parity gate + cross-loaderMode parity + sharpen-invariant + refresh script
- [ ] 40-09-PLAN.md — SEED-008 closure breadcrumb (REPACK-01..10): status flip dormant→closed; STATE.md update
**UI hint**: yes

---

*Roadmap defined 2026-05-13 at v1.5 milestone start. Continues phase numbering from v1.4 (which closed at Phase 35). v1.4 ROADMAP archived at `.planning/milestones/v1.4-ROADMAP.md`; v1.4 phase directories preserved per MILESTONES.md note.*

*Locked design constraints carried into v1.5 phase planning:*

- *SEED-007 decisions 1 (schema-additive `overridesAtlasLess` field, no version bump), 2-A (legacy file routing by saved `loaderMode`), 3-A (no auto-copy on mode switch) — locked 2026-05-12. The planner SHOULD NOT relitigate during `/gsd-plan-phase 36`. Optional UX nudge (one-shot toast) is planner-decided per SEED-007; defer to v1.6 if scope pressure surfaces.*
- *TIMELINE-02 has a conditional escalation clause — if the InheritTimeline source audit reveals world-transform effects, TIMELINE-03 becomes load-bearing (real-risk gap fix) rather than precautionary (invariance lock). This is a `/gsd-plan-phase 37` checkpoint, not a deferred risk.*
- *Some POLISH IN-* findings may already be no-ops by the time Phase 38 runs (WR-03 already closed in Phase 27 per PROJECT.md Key Decisions). POLISH-01 audit step confirms which still apply.*
- *WINUAT-01..03 are host-blocked. Phase 39 outcome is `human_needed` if no Win host is available this cycle; todos carry forward to v1.6+. Closure gates on programmatic verification + audit-trail integrity, NOT on host availability.*
- *Phase 40 locked design facts from SEED-008: output mode is additive (loose default unchanged), JSON is invariant under repack, both loaderModes supported, 7 additive `.stmproj` fields with no schema bump, `core/` stays pure-TS for pack math, sharp + `.atlas` writing in `main/`, quality knobs apply pre-pack per-region. `/gsd-spec-phase 40` and `/gsd-discuss-phase 40` SHOULD NOT relitigate these.*
