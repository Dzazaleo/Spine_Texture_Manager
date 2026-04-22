---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: unknown
stopped_at: Completed 00-05-PLAN.md
last_updated: "2026-04-22T12:24:51.302Z"
progress:
  total_phases: 1
  completed_phases: 0
  total_plans: 7
  completed_plans: 5
  percent: 71
---

# State

## Current milestone

Milestone 1 — MVP

## Current phase

**Phase 0 — Core-math spike** (in progress — plans 00-01, 00-02, 00-03, 00-04, 00-05 complete, 5/7 plans done)

## Current plan

**Plan 00-06 — next up** (CLI scaffolding — `npm run cli -- <path-to-skeleton.json>` prints peak-scale table)

## Last completed

- **Plan 00-05 (2026-04-22):** Golden correctness + perf + I/O test suite. `244782f` + `11492d6` + `470391b`. `tests/core/loader.spec.ts` (NEW, 114 lines, 5 specs) + `tests/core/bounds.spec.ts` augmented (+49/-17, 11 specs) + `tests/core/sampler.spec.ts` augmented (+217/-27, 20 specs incl. 1 skipped stretch). Every Phase 0 requirement ID {F1.1, F1.4, F2.3, F2.5, F2.7, N1.1, N1.2, N1.3, N1.4, N1.5, N1.6, N2.1, N2.3} appears in a named test. N1.4 is a DIFFERENTIAL test (bone index 5 doubled → CIRCLE worldW 1.782× baseline). N1.5 is the LOCKED constrained-vs-unconstrained TransformConstraint comparison on SQUARE (delta 1.10, gate >1e-6). Easing-curve test is `it.skip` with documented un-skip recipe (fixture has only stepped curves). N2.1 observed 2.5 ms (200× under gate). `npm test` 35/35 pass + 1 skip. N1.1–N1.6 + N2.1 + N2.3 completed. 3 deviations (1 Rule 2 AUGMENT-not-overwrite per critical_project_rules, 1 scope convention, 1 structural Task-4 consolidation). See `.planning/phases/00-core-math-spike/00-05-SUMMARY.md`.
- **Plan 00-04 (2026-04-22):** Per-attachment peak sampler with locked tick order. `60709d6`. `src/core/sampler.ts` (251 lines) + `tests/core/sampler.spec.ts` (181 lines, 13/13 green). `sampleSkeleton(load, opts?)` returns `Map<attachmentKey, PeakRecord>` with 4 entries on SIMPLE_TEST in 9.7 ms (50x under N2.1 gate). Locked lifecycle `state.update → state.apply → skeleton.update → updateWorldTransform(Physics.update)` grep-enforced in spec. `Physics.reset` once per (skin, animation) pair anchors N1.6 determinism. Setup-pose pass per skin; default 120 Hz configurable via `opts.samplingHz`. F2.1, F2.2, F2.4, F2.6, F2.7 completed. 4 deviations (1 Rule 1 `setAnimation`→`setAnimationWith` TS fix, 1 Rule 1 self-violating `skeleton.fps` comment, 1 Rule 2 spec-file committed atomically, 1 Rule 1 stale `"__SETUP__"` comment cleanup in types.ts). See `.planning/phases/00-core-math-spike/00-04-SUMMARY.md`.
- **Plan 00-03 (2026-04-22):** Per-attachment world AABB + scale math. `b619347`. `src/core/bounds.ts` (144 lines) + `tests/core/bounds.spec.ts` (200 lines, 10/10 green). `attachmentWorldAABB(slot, attachment)` delegates to spine-core's `computeWorldVertices` for Region (4 verts) and VertexAttachment/MeshAttachment (N verts); returns `null` for BoundingBox/Path/Point/Clipping skip-list. `computeScale` applies T-00-03-03 zero-dim guard. N2.3 "no I/O" locked into spec (grep tests fail CI on any future `node:*` / `sharp` import). F2.3 + F2.5 completed. 2 deviations (1 Rule 1 comment-grep self-violation, 1 Rule 2 spec-file committed atomically). See `.planning/phases/00-core-math-spike/00-03-SUMMARY.md`.
- **Plan 00-02 (2026-04-22):** Headless Spine loader. `8c2a4a7`. `src/core/loader.ts` + `types.ts` + `errors.ts` (304 lines total); `loadSkeleton()` parses SIMPLE_TEST fixture returning 3 regions with correct `atlas-bounds` provenance; stub `TextureLoader` never decodes PNG bytes; typed error hierarchy. F1.1–F1.4 completed. 3 deviations (1 Rule 1 bug fix to `hasOrig` check, 1 directed cleanup of stale index.ts, 1 scope convention). See `.planning/phases/00-core-math-spike/00-02-SUMMARY.md`.
- **Plan 00-01 (2026-04-22):** Bootstrap TypeScript + vitest scaffolding. `796480d`. `@esotericsoftware/spine-core` 4.2.111 + vitest 4.1.5 + typescript 6.0.3 + tsx 4.21.0 + @types/node 25.6.0 installed; `.gitignore` blocks `temp/`; `tsc --noEmit` and `npm test` both green on empty scaffold. Single atomic bootstrap commit. See `.planning/phases/00-core-math-spike/00-01-SUMMARY.md`.
- Project initialization: `.planning/` scaffolded from approved plan.
- Fixture confirmed at `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` with CIRCLE/SQUARE/TRIANGLE attachments, CHAIN_2..8 bone chain, SQUARE2 pre-scaled bone, TransformConstraint on SQUARE.

## Next action

Execute plan 00-06 (CLI scaffolding — `npm run cli -- <path-to-skeleton.json>` prints peak-scale table) via `/gsd-execute-phase 0`.

## Open questions

- **RESOLVED (00-05):** Fixture DOES contain a weighted-mesh attachment (`CIRCLE`: `"type": "mesh"`, weights=[0.00761, 0.99239] on bones[4,5] for vertex 0, weights spread across CHAIN_3..CHAIN_8 for other vertices). N1.4 is covered via a differential test — doubling `skeletonData.bones[5].scaleX/Y` (CHAIN_5, dominant weight on vertex 0) produces a 1.782× CIRCLE worldW vs baseline.
- **RESOLVED (00-05):** Fixture DOES contain PhysicsConstraints on CHAIN_2..CHAIN_8 (7 chained physics constraints). N1.6 determinism test passes — two successive `sampleSkeleton(load)` calls produce bit-identical peak values.

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
- Plan 00-05: AUGMENT existing spec files rather than overwriting — critical_project_rules directive; preserves plan-03/plan-04 lifecycle/determinism/hygiene coverage while adding N-tagged assertions on top
- Plan 00-05: N1.4 via Strategy B (differential bone-scale mutation), not hand-computed weighted-sum: doubling bones[5] produces observable 1.782x CIRCLE worldW — robust against future spine-core math tweaks that Strategy A would be fragile against
- Plan 00-05: N1.5 locked per CONTEXT.md: constrained-vs-unconstrained TransformConstraint comparison on SQUARE. Fixture-shape assertion (expect before-1) catches silent fixture drift that would otherwise no-op the filter
- Plan 00-05: Easing-curve test as it.skip with inlined un-skip recipe — CONTEXT.md explicitly permits stretch flag when fixture lacks non-linear easing (SIMPLE_TEST only has stepped curves)
- Plan 00-05: Every Phase 0 requirement ID (F1.1/F1.4/F2.3/F2.5/F2.7/N1.1-N1.6/N2.1/N2.3) tagged in a test name — grep-anchored traceability from REQUIREMENTS.md to exact assertion. Makes verify-work trivial

## Performance Metrics

| Phase | Plan  | Duration | Tasks | Files | Notes                                                                  |
| ----- | ----- | -------- | ----- | ----- | ---------------------------------------------------------------------- |
| 00    | 00-01 | ~3 min   | 3     | 9     | Atomic bootstrap commit `796480d`; 2 deviations (1 Rule 3, 1 version bump). |
| 00    | 00-02 | ~4 min   | 3     | 3     | Headless loader commit `8c2a4a7`; 3 deviations (1 Rule 1 bug fix, 1 stale-placeholder cleanup, 1 scope convention). F1.1–F1.4 done. |
| 00    | 00-03 | ~3 min   | 2     | 2     | Bounds + scale math commit `b619347`; 2 deviations (1 Rule 1 comment self-violating grep, 1 Rule 2 spec-file committed atomically). F2.3 + F2.5 done. 10/10 tests green. |
| 00    | 00-04 | ~5 min   | 2     | 3     | Sampler commit `60709d6`; 4 deviations (1 Rule 1 setAnimation→setAnimationWith TS fix, 1 Rule 1 self-violating `skeleton.fps` comment, 1 Rule 2 spec-file committed atomically, 1 Rule 1 stale `__SETUP__` comment cleanup). F2.1+F2.2+F2.4+F2.6+F2.7 done. 13/13 sampler tests green, 23/23 overall. Smoke run 9.7ms / 4 peaks (50x under N2.1 gate). |
| 00    | 00-05 | ~7 min   | 4     | 3     | Golden test suite commits `244782f` (loader) + `11492d6` (bounds augment) + `470391b` (sampler augment); 3 deviations (1 Rule 2 AUGMENT-not-overwrite, 1 scope convention, 1 structural Task-4 consolidation). N1.1–N1.6 + N2.1 + N2.3 completed. 35/35 tests green + 1 documented skip (easing-curve stretch). N2.1 perf observed at 2.5 ms (200× under 500 ms gate). N1.4 observed ratio 1.782×; N1.5 observed delta 1.10. |

## Last session

- **Timestamp:** 2026-04-22T12:20:43Z
- **Stopped at:** Completed 00-05-PLAN.md
- **Resume file:** `.planning/phases/00-core-math-spike/00-06-PLAN.md` (CLI scaffolding)
- **Blockers:** None

## Links

- Approved plan: `~/.claude/plans/i-need-to-create-zesty-eich.md`
- Project doc: `.planning/PROJECT.md`
- Requirements: `.planning/REQUIREMENTS.md`
- Roadmap: `.planning/ROADMAP.md`

**Planned Phase:** 0 (Core-math spike) — 7 plans — 2026-04-22T11:33:21.704Z
