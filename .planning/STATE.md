---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 00-04-PLAN.md
last_updated: "2026-04-22T12:09:26.695Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 7
  completed_plans: 4
  percent: 57
---

# State

## Current milestone

Milestone 1 — MVP

## Current phase

**Phase 0 — Core-math spike** (in progress — plans 00-01, 00-02, 00-03, 00-04 complete, 4/7 plans done)

## Current plan

**Plan 00-05 — next up** (golden correctness tests N1.2–N1.6 + perf smoke N2.1 on SIMPLE_TEST fixture)

## Last completed

- **Plan 00-04 (2026-04-22):** Per-attachment peak sampler with locked tick order. `60709d6`. `src/core/sampler.ts` (251 lines) + `tests/core/sampler.spec.ts` (181 lines, 13/13 green). `sampleSkeleton(load, opts?)` returns `Map<attachmentKey, PeakRecord>` with 4 entries on SIMPLE_TEST in 9.7 ms (50x under N2.1 gate). Locked lifecycle `state.update → state.apply → skeleton.update → updateWorldTransform(Physics.update)` grep-enforced in spec. `Physics.reset` once per (skin, animation) pair anchors N1.6 determinism. Setup-pose pass per skin; default 120 Hz configurable via `opts.samplingHz`. F2.1, F2.2, F2.4, F2.6, F2.7 completed. 4 deviations (1 Rule 1 `setAnimation`→`setAnimationWith` TS fix, 1 Rule 1 self-violating `skeleton.fps` comment, 1 Rule 2 spec-file committed atomically, 1 Rule 1 stale `"__SETUP__"` comment cleanup in types.ts). See `.planning/phases/00-core-math-spike/00-04-SUMMARY.md`.
- **Plan 00-03 (2026-04-22):** Per-attachment world AABB + scale math. `b619347`. `src/core/bounds.ts` (144 lines) + `tests/core/bounds.spec.ts` (200 lines, 10/10 green). `attachmentWorldAABB(slot, attachment)` delegates to spine-core's `computeWorldVertices` for Region (4 verts) and VertexAttachment/MeshAttachment (N verts); returns `null` for BoundingBox/Path/Point/Clipping skip-list. `computeScale` applies T-00-03-03 zero-dim guard. N2.3 "no I/O" locked into spec (grep tests fail CI on any future `node:*` / `sharp` import). F2.3 + F2.5 completed. 2 deviations (1 Rule 1 comment-grep self-violation, 1 Rule 2 spec-file committed atomically). See `.planning/phases/00-core-math-spike/00-03-SUMMARY.md`.
- **Plan 00-02 (2026-04-22):** Headless Spine loader. `8c2a4a7`. `src/core/loader.ts` + `types.ts` + `errors.ts` (304 lines total); `loadSkeleton()` parses SIMPLE_TEST fixture returning 3 regions with correct `atlas-bounds` provenance; stub `TextureLoader` never decodes PNG bytes; typed error hierarchy. F1.1–F1.4 completed. 3 deviations (1 Rule 1 bug fix to `hasOrig` check, 1 directed cleanup of stale index.ts, 1 scope convention). See `.planning/phases/00-core-math-spike/00-02-SUMMARY.md`.
- **Plan 00-01 (2026-04-22):** Bootstrap TypeScript + vitest scaffolding. `796480d`. `@esotericsoftware/spine-core` 4.2.111 + vitest 4.1.5 + typescript 6.0.3 + tsx 4.21.0 + @types/node 25.6.0 installed; `.gitignore` blocks `temp/`; `tsc --noEmit` and `npm test` both green on empty scaffold. Single atomic bootstrap commit. See `.planning/phases/00-core-math-spike/00-01-SUMMARY.md`.
- Project initialization: `.planning/` scaffolded from approved plan.
- Fixture confirmed at `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` with CIRCLE/SQUARE/TRIANGLE attachments, CHAIN_2..8 bone chain, SQUARE2 pre-scaled bone, TransformConstraint on SQUARE.

## Next action

Execute plan 00-05 (golden correctness tests N1.2–N1.6 + perf smoke N2.1 on SIMPLE_TEST fixture) via `/gsd-execute-phase 0`.

## Open questions

- Does the simple fixture contain a weighted-mesh attachment? All three current attachments look like plain regions. If not, user should either (a) add a weighted-mesh asset to the fixture, or (b) we defer N1.4 coverage to a complex-rig milestone.
- Does the fixture contain a PhysicsConstraint? (4.2 physics is a key N1.6 test case; current JSON preview did not show one.)

## Decisions

- **Plan 00-01:** moduleResolution=`bundler` (over `node16`) — pairs cleanly with tsx + vitest, avoids the `.js` extension dance on relative imports.
- **Plan 00-01:** Bumped `vitest` to `^4.0.0`, `typescript` to `^6.0.0`, `@types/node` to `^25.0.0` (plan pinned older ranges; bumped to current stable per plan Task 3 action step 1).
- **Plan 00-01:** `src/core/index.ts` placeholder (`export {}`) exists solely to keep `tsc --noEmit` green on empty scaffold; plan 00-02 replaces it with real `loader.ts` / `sampler.ts` / `bounds.ts` exports.
- Plan 00-02: sourceDims provenance uses origW !== packedW || origH !== packedH — spine-core 4.2 auto-backfills originalWidth/Height from bounds, so a simple > 0 check mislabels every region
- Plan 00-02: StubTexture is a dedicated subclass of spine-core's Texture rather than reusing FakeTexture — stable public API + named stack traces
- Plan 00-02: src/core/index.ts placeholder deleted (not converted to barrel) — no consumer imports from it; plan 00-01 explicitly scheduled this removal
- Plan 00-03: bounds.ts is pure delegation — attachmentWorldAABB calls spine-core's computeWorldVertices and folds the result; never re-implements bone-chain / weighted-mesh / constraint math. CLAUDE.md rule #2 locked in by code.
- Plan 00-03: instanceof ordering (Region → 4 skip subclasses → generic VertexAttachment) documented inline — skip types MUST precede the generic branch because they all extend VertexAttachment in spine-core 4.2 (fact was slightly wrong in plan's <interfaces> block for PointAttachment).
- Plan 00-03: bounds.spec.ts committed atomically with bounds.ts — plan's Task 2 only listed bounds.ts but the spec locks N2.3 hygiene (no node:fs / node:path / sharp) into CI, strengthening the plan's stated invariant (Rule 2 deviation).
- Plan 00-04: state.setAnimationWith (Animation-object overload), not state.setAnimation (name-string overload) — spine-core 4.2.111 splits the method; plan's <interfaces> block conflated them. setAnimation(0, anim, false) where anim is an Animation causes TS2345 under strict mode.
- Plan 00-04: Physics.pose (not Physics.update) for the setup-pose pass — setup pose is static, Physics.pose recomputes world transforms without stepping physics. Physics.reset is used once per animation; Physics.update every tick. All three enum values used with correct semantics.
- Plan 00-04: Sampler prose must not contain the literal token "skeleton.fps" — the plan's own `! grep -q "skeleton.fps"` acceptance gate treats the string as forbidden regardless of context. Future docs should prefer "the skeleton JSON's fps field" or "<skeleton>.<fps>" when referencing CLAUDE.md rule #1.
- Plan 00-04: tests/core/sampler.spec.ts committed atomically with sampler.ts — same Rule 2 reasoning as plan 00-03: spec locks N2.3 + locked lifecycle ordering + N1.6 determinism into CI, not just into one-off grep.

## Performance Metrics

| Phase | Plan  | Duration | Tasks | Files | Notes                                                                  |
| ----- | ----- | -------- | ----- | ----- | ---------------------------------------------------------------------- |
| 00    | 00-01 | ~3 min   | 3     | 9     | Atomic bootstrap commit `796480d`; 2 deviations (1 Rule 3, 1 version bump). |
| 00    | 00-02 | ~4 min   | 3     | 3     | Headless loader commit `8c2a4a7`; 3 deviations (1 Rule 1 bug fix, 1 stale-placeholder cleanup, 1 scope convention). F1.1–F1.4 done. |
| 00    | 00-03 | ~3 min   | 2     | 2     | Bounds + scale math commit `b619347`; 2 deviations (1 Rule 1 comment self-violating grep, 1 Rule 2 spec-file committed atomically). F2.3 + F2.5 done. 10/10 tests green. |
| 00    | 00-04 | ~5 min   | 2     | 3     | Sampler commit `60709d6`; 4 deviations (1 Rule 1 setAnimation→setAnimationWith TS fix, 1 Rule 1 self-violating `skeleton.fps` comment, 1 Rule 2 spec-file committed atomically, 1 Rule 1 stale `__SETUP__` comment cleanup). F2.1+F2.2+F2.4+F2.6+F2.7 done. 13/13 sampler tests green, 23/23 overall. Smoke run 9.7ms / 4 peaks (50x under N2.1 gate). |

## Last session

- **Timestamp:** 2026-04-22T12:06:34Z
- **Stopped at:** Completed 00-04-PLAN.md
- **Resume file:** `.planning/phases/00-core-math-spike/00-05-PLAN.md` (golden correctness tests + perf smoke)
- **Blockers:** None

## Links

- Approved plan: `~/.claude/plans/i-need-to-create-zesty-eich.md`
- Project doc: `.planning/PROJECT.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`

**Planned Phase:** 0 (Core-math spike) — 7 plans — 2026-04-22T11:33:21.704Z
