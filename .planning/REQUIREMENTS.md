# Requirements: Spine Texture Manager — Milestone v1.5

**Defined:** 2026-05-13
**Milestone:** v1.5 Override Routing + Coverage Hardening
**Core Value:** Animators ship atlases that are as small as they mathematically can be without visible quality loss — driven by the actual world-space transforms the runtime computes, not guesswork.

**Scope statement:** Fix the atlas-source / atlas-less override bleed bug surfaced post-v1.4 (UX-correctness, not math-correctness — math is mode-invariant by construction), close two unverified Spine 4.2 timeline coverage gaps (RGBA2Timeline + InheritTimeline) with audit + fixtures, and burn down three long-lived tech-debt / host-blocked UAT carry-forwards. Explicitly defers SEED-006 (full Spine 4.3 runtime port) — gated on `@esotericsoftware/spine-core@4.3.x` npm publish.

## v1.5 Requirements

### Split Overrides Per Loader Mode (SEED-007)

From `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` (planted 2026-05-12 pre-v1.4-close). The `.stmproj` schema stores a single `overrides: Record<string, number>` map that BOTH `loaderMode` values consume, causing overrides set in one mode to silently leak into the other. **Decisions 1, 2-A, 3-A LOCKED on 2026-05-12 — the planner SHOULD NOT relitigate.** Math verified mode-invariant during seed capture (peak-anchored override math is canonical-relative; no compounding-shrink path). Bug is UX intent-routing only.

- [ ] **OVR-01**: `ProjectFileV1` in `src/shared/types.ts` gains `overridesAtlasLess: Record<string, number>` alongside the preserved `overrides` field. Pure additive change — **no schema version bump** (follows the `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent). Validator pre-massage in `src/core/project-file.ts` treats missing `overridesAtlasLess` as `{}`. Implements SEED-007 Decision 1.
- [ ] **OVR-02**: Loading a legacy v1.3.x / v1.4.x `.stmproj` (single `overrides` map) routes by saved `loaderMode` at the Open seam (`src/main/project-io.ts`): if saved `loaderMode === 'atlas-less'`, entire legacy map → `overridesAtlasLess` (atlas-source bucket starts empty); otherwise legacy map stays in `overrides` (atlas-less bucket starts empty). Implements SEED-007 Decision 2-A.
- [ ] **OVR-03**: Toggling `loaderMode` in a fresh session does NOT auto-copy from the active bucket. Inactive bucket retains whatever state it has (empty for fresh project; previously-saved values otherwise). Implements SEED-007 Decision 3-A. Aligns with `project_strict_loadermode_separation` (locked 2026-05-06).
- [ ] **OVR-04**: `migrateOverrides` in `src/main/override-migration.ts` runs independently per bucket against the shared (mode-invariant) `summary.regions`. `migratedKeyCount` summed across both buckets; stale keys unioned for the migration banner. No change to `summary.regions` derivation (skin-manifest pass is JSON-only — mode-invariant by construction).
- [ ] **OVR-05**: `AppShell.tsx` holds two `Map<string, number>` in state; the active-mode slice is selected for the 4 `buildExportPlan` call sites, the `OverrideDialog` apply handler, `GlobalMaxRenderPanel`, and `AnimationBreakdownPanel`. **`buildExportPlan` signature unchanged**; **panel props signature unchanged**. Save serializes both buckets.
- [ ] **OVR-06**: Round-trip integrity — `tests/core/project-file.spec.ts` proves both buckets serialize + deserialize losslessly; legacy pre-massage path (missing `overridesAtlasLess` → `{}`); per-bucket migration in `tests/main/override-migration.spec.ts` (atlas-source bucket migrated independently of atlas-less bucket); legacy-routing fixture asserting `loaderMode === 'atlas-less'` routes the entire legacy map into `overridesAtlasLess`.
- [ ] **OVR-07**: AppShell mode-switch divergence test — apply override in atlas-source mode, switch to atlas-less, assert atlas-less bucket is empty; apply in atlas-less, switch to atlas-source, assert atlas-source bucket retains its pre-switch value.

### Spine 4.2 Timeline Coverage Hardening (SEED-005 Level B)

From `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` (planted 2026-05-08). Two Spine 4.2 features that `spine-ts` handles but no fixture in our suite exercises: RGBA2Timeline (two-color slot tinting) and InheritTimeline (per-animation bone inheritance toggle). Both are *likely* render-scale-irrelevant but unverified. User chose Level B: source audit + fixture coverage.

- [ ] **TIMELINE-01**: Source audit of `RGBA2Timeline.apply` in `node_modules/@esotericsoftware/spine-core/dist/Animation.js` confirms by inspection that it only writes to `slot.color` / `slot.darkColor` (no geometry mutation; no `Bone.*` writes). Audit findings written to `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` (existing audit doc — append items 6/7).
- [ ] **TIMELINE-02**: Source audit of `InheritTimeline.apply` in the same file confirms whether it mutates `Bone.inherit` and whether that flag is read in `Bone.updateWorldTransform`. **If world transforms are affected, this REQ escalates to a real-risk gap and TIMELINE-03 becomes load-bearing rather than precautionary.** Findings appended to the same audit doc.
- [ ] **TIMELINE-03**: A minimal JSON fixture under `fixtures/INHERIT_TIMELINE/` toggles `inheritScale` from `true → false → true` on a rotating child bone. A unit test in `tests/core/sampler.spec.ts` runs the full sampler lifecycle (`state.update → state.apply → skeleton.update → updateWorldTransform(Physics.update)`) at the project's default 120 Hz and asserts the sampler captures a peak scale during the "detached" frame greater than the always-inheriting baseline. If TIMELINE-02 surfaces no world-transform effect, this test still locks the regression-free contract.
- [ ] **TIMELINE-04**: A minimal JSON or synthetic-test fixture exercises RGBA2Timeline on one slot. A unit test asserts that running the sampler over the animation produces **identical** world-AABB output to running the same animation without RGBA2 keyframes (geometry-invariance proof). Closes the assumption that two-color tinting cannot affect render scale.
- [ ] **TIMELINE-05**: `.planning/SPINE-4-2-COVERAGE-AUDIT-2026-05-08.md` is updated to reflect SEED-005 closure (items 5 + 6 + 7 closed) and the seed file's `status:` frontmatter flips from `planted` to `closed` with the closing phase reference.

### Phase 4 Code-Review Polish (long-lived todo)

From `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md`. v1.0-era Phase 4 code review surfaced 9 findings; WR-01 + WR-02 fixed inline at phase close, **WR-03 already fixed in Phase 27 (functional `setSelected` updater)**. Remaining 6 IN-* findings are deferred polish items — none are correctness bugs.

- [ ] **POLISH-01**: Audit Phase 4 deferred findings against current code (IN-01 through IN-06 from `04-REVIEW.md`); enumerate which are still applicable. Some may have been swept by intervening phases (e.g. Phase 27 already closed WR-03 — confirm IN-06 dead-guard, IN-05 sort comparator, etc. against current `GlobalMaxRenderPanel.tsx` + `OverrideDialog.tsx`). Audit output → `.planning/phases/[N]-polish-pass/[N]-POLISH-AUDIT.md`.
- [ ] **POLISH-02**: Apply the still-applicable findings with atomic per-finding commits (OverrideDialog focus-trap comment / focus-trap implementation; drag-to-cancel guard; empty-input guard; sort comparator locale options; dead-guard removal if still present). Skip IN-04 (DRY-candidate flag only — intentional per Phase 2 pattern).
- [ ] **POLISH-03**: Move `.planning/todos/pending/2026-04-24-phase-4-code-review-follow-up.md` to `.planning/todos/resolved/` with closing note referencing the v1.5 polish-pass phase.

### Windows Host-Blocked UAT Burndown (long-lived todos)

From `.planning/todos/pending/2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` + `.planning/todos/pending/2026-05-08-phase-31-windows-admin-dnd-release-uat.md`. Both require a real Windows host with the installed v1.x binary; deferred since v1.1.x and v1.3.1 respectively. Linux clause from the Phase 20 todo is obsolete (Linux dropped at v1.3 ship — per memory `project_linux_deferred`). **These REQs ship if a Windows host is available this cycle; otherwise carry forward to v1.6+ again** — the phase plan can degrade gracefully into a `human_needed` outcome with the audit-trail intact.

- [ ] **WINUAT-01**: Phase 20 Documentation Builder cross-platform DnD UAT — on a real Windows host with the installed v1.x release binary, repeat UAT scenario 3 from `20-HUMAN-UAT.md` (open project → DocBuilder modal → Animation Tracks pane → "+ Add Track" → drag an animation onto Track 0 → confirm drag image renders, drop succeeds with `mixTime=0.25` + `loop=false`, no console errors). Flip test #3 in `20-HUMAN-UAT.md` from `deferred` to `passed`/`failed` + update summary table. (Linux scope dropped — out per memory `project_linux_deferred`.)
- [ ] **WINUAT-02**: Phase 31 Windows admin DnD release UAT — on a real Windows host with the installed v1.x release binary, right-click → "Run as administrator" → confirm UAC → with idle DropZone, verbatim two-sentence advisory renders (`"Drag-and-drop is unavailable while running as administrator. Use File → Open instead, or relaunch the app without administrator privileges."`) → drag-over ring does NOT appear → File → Open still works → relaunch normally → DnD works as before. Flip item 1 in `31-HUMAN-UAT.md` from `deferred` to `passed`/`failed`.
- [ ] **WINUAT-03**: Resolve both pending todos (`2026-05-01-phase-20-windows-linux-dnd-cross-platform-uat.md` + `2026-05-08-phase-31-windows-admin-dnd-release-uat.md`) — move to `.planning/todos/resolved/` with closing notes referencing the v1.5 UAT phase. If WINUAT-01 / WINUAT-02 outcomes are `human_needed` (host unavailable this cycle), the todos remain in `pending/` with an updated note and carry forward to v1.6+.

## Future Requirements

Deferred to a future milestone. Tracked but not in current roadmap.

### Full Spine 4.3 Runtime Port (SEED-006)

Costed inventory carried forward verbatim from v1.4. Trigger condition: `npm view @esotericsoftware/spine-core@latest` returns 4.3.x OR a paying user reports they cannot re-export their rig as Version 4.2.

- **PORT-01**: Migrate `core/sampler.ts` from spine-core 4.2 to 4.3 (`setToSetupPose` → `setupPose`; `setSlotsToSetupPose` → `setupPoseSlots`; `state.setAnimationWith` → `state.setAnimation`; `slot.getAttachment()` → `slot.pose.attachment`).
- **PORT-02**: Migrate `core/bounds.ts` `computeWorldVertices` call sites to the 4.3 signatures (`RegionAttachment`: adds `vertexOffsets`; `VertexAttachment`: adds `skeleton` first arg).
- **PORT-03**: Validate `slider` constraint timelines sample correctly via the existing `updateWorldTransform` propagation path with a dedicated fixture.
- **PORT-04**: Decide vendoring strategy (git submodule + tsc, npm fork, or wait-for-publish) and publish a build pipeline change.

### Optional UX Nudge (SEED-007 Optional)

Planner-decided during v1.5 phase planning; deferred here if scope pressure surfaces:

- One-shot toast first time per session the user toggles `loaderMode` after applying an override: *"Overrides are tracked per loader mode."* Suppressable with "don't show again". Cheap signal preventing future confusion. Routed to v1.6 patch if the v1.5 phase scopes it out.

### Cross-Mode Override Copy (SEED-007 deferred escape hatch)

Decision 3-C (empty inactive bucket + "Copy from X mode" button) was explicitly rejected at SEED-007 capture in favor of 3-A. The planner MAY revisit this if user-feedback after 2-A/3-A ship indicates the friction is real. Until then, out of scope.

## Out of Scope

Explicit exclusions with reasoning.

- **Full Spine 4.3 runtime port (SEED-006)** — gated on `@esotericsoftware/spine-core@4.3.x` npm publish. As of 2026-05-13, latest npm tag is still 4.2.x. Premature porting would burn engineering hours that get rewritten when stable + npm publish converge. **Trigger:** `npm view @esotericsoftware/spine-core@latest` returns 4.3.x OR paying-user report.
- **Cross-mode override copy/sync feature** — modes are self-contained per `project_strict_loadermode_separation` (locked 2026-05-06). Deliberately not built.
- **`buildExportPlan` signature change or core export math change** — math is verified mode-invariant during SEED-007 capture; the bug is intent-routing only. Signature unchanged.
- **Schema version bump** — SEED-007 schema change is pure additive (`overridesAtlasLess` field). Follows the `loaderMode` / `sharpenOnExport` / `safetyBufferPercent` precedent; no version bump.
- **Linux UAT or build target re-enablement** — Linux dropped from CI/release at v1.3 (no UAT). Per memory `project_linux_deferred`. WINUAT-01 explicitly scopes to Windows only.
- **`.skel` binary loader** — still deferred (carried since v1.0). Not in v1.5 scope.
- **RGBA2 product feature (slot-color preview, colored Atlas Preview thumbnails)** — SEED-005 Level B scopes RGBA2 to audit + geometry-invariance proof only. Any product feature surfacing slot colors becomes its own milestone scope item.
- **Phase 0 scale-overshoot debug session** — long-lived tech debt; no regression observed across 7 milestones. Stays `investigating`.

## Traceability

Each REQ-ID maps to exactly one phase in `.planning/ROADMAP.md`. 18/18 v1.5 REQs mapped (no orphans, no duplicates).

| REQ-ID | Phase |
|--------|-------|
| OVR-01 | Phase 36 — Split Overrides Per Loader Mode |
| OVR-02 | Phase 36 — Split Overrides Per Loader Mode |
| OVR-03 | Phase 36 — Split Overrides Per Loader Mode |
| OVR-04 | Phase 36 — Split Overrides Per Loader Mode |
| OVR-05 | Phase 36 — Split Overrides Per Loader Mode |
| OVR-06 | Phase 36 — Split Overrides Per Loader Mode |
| OVR-07 | Phase 36 — Split Overrides Per Loader Mode |
| TIMELINE-01 | Phase 37 — Spine 4.2 Timeline Coverage Hardening |
| TIMELINE-02 | Phase 37 — Spine 4.2 Timeline Coverage Hardening |
| TIMELINE-03 | Phase 37 — Spine 4.2 Timeline Coverage Hardening |
| TIMELINE-04 | Phase 37 — Spine 4.2 Timeline Coverage Hardening |
| TIMELINE-05 | Phase 37 — Spine 4.2 Timeline Coverage Hardening |
| POLISH-01 | Phase 38 — Phase 4 Code-Review Polish Pass |
| POLISH-02 | Phase 38 — Phase 4 Code-Review Polish Pass |
| POLISH-03 | Phase 38 — Phase 4 Code-Review Polish Pass |
| WINUAT-01 | Phase 39 — Windows Host-Blocked UAT Burndown |
| WINUAT-02 | Phase 39 — Windows Host-Blocked UAT Burndown |
| WINUAT-03 | Phase 39 — Windows Host-Blocked UAT Burndown |

---

*Sourced from `.planning/seeds/SEED-005-rgba2-inherittimeline-coverage.md` + `.planning/seeds/SEED-007-split-overrides-per-loader-mode.md` + the three carry-forward todos in `.planning/todos/pending/`. SEED-007 decisions 1, 2-A, 3-A are LOCKED — do not relitigate during phase planning. TIMELINE-02 conditional escalation clause: if InheritTimeline audit reveals world-transform effects, TIMELINE-03 becomes load-bearing — Phase 37 planning checkpoint, not deferred risk. WINUAT-01..03 host-blocked: Phase 39 outcome is `human_needed` if no Win host available this cycle; todos carry forward to v1.6+.*
