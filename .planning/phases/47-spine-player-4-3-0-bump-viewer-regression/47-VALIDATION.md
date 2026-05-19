---
phase: 47
slug: spine-player-4-3-0-bump-viewer-regression
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
updated: 2026-05-19
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `47-RESEARCH.md` §"Validation Architecture" + the
> §7 "Validation Architecture — ADDENDUM" (the DV-1..DV-3 dual-runtime gap
> re-discussion). **This file was coherently REWRITTEN 2026-05-19** so the
> superseded single-runtime D-09 rows (the dead Plan-02 Per-Task rows + the
> falsified single-runtime-4.3-player Manual-Only rows) are REPLACED — not
> merely appended — by the dual-runtime T-A..T-D rows + the DV-3 owner
> checkpoint. The genuinely-still-valid 47-01 PLAYER-01 rows are retained
> verbatim (47-01 is COMPLETE). Two-track completion contract (CONTEXT
> specifics + D-01/D-02): a **machine track** (typecheck:web 22→0 + the 11 RED
> renderer suites → green [47-01] + the 4 new T-A..T-D headless guards [47-03/
> 47-04]) and a **human track** (D-02 owner `checkpoint:human-action` live-UAT
> over the DV-3 matrix [47-05] — the only valid evidence for the PLAYER-02
> visual rows; jsdom has no WebGL).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4 (jsdom env for `tests/renderer/*` + the T-B dispatcher arm; node env for `tests/main/*`/`tests/core/*`/`tests/runtime/*`) |
| **Config file** | `vitest.config.ts` (project-standard; unchanged this phase — no `vitest.config.ts`/`electron.vite.config.ts` change is needed or permitted by DV-1) |
| **Quick run command** | `npx vitest run tests/renderer/animation-player-modal.spec.tsx tests/renderer/app-shell-animation-viewer.spec.tsx` |
| **Renderer-suite run** | `npx vitest run tests/renderer/` (the 11 import-RED suites live here) |
| **Gap-guard run** | `npx vitest run tests/runtime/reg4701-buildsummary-handoff.spec.ts tests/runtime/dual-viewer-routing.spec.ts tests/runtime/dv1-42-parse-guard.spec.ts tests/renderer/animation-player-modal-42.spec.tsx` (the 4 T-A..T-D dual-runtime guards) |
| **Typecheck gate** | `npm run typecheck:web` (the Phase 42→47 handoff surface — the @ts-nocheck-sentineled `AnimationPlayerModal42.tsx` is excluded by design; see Wave 0) |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~12 s quick spec · ~25 s `tests/renderer/` · ~2 s the 4 gap-guards · ~130 s full `npm test` · ~20 s `typecheck:web` |

---

## Sampling Rate

> **Atomic-unit exception (binding — read before reading the per-task map).**
> 47-01 is a **single atomic migration unit** (RESEARCH Pattern 1 / PATTERNS
> Shared Pattern): the `package.json` bump + the 8-touchpoint
> `AnimationPlayerModal.tsx` migration + the lockstep test-mock migration have
> **no compilable green intermediate**. Therefore 47-01 Task 1 and Task 2
> intentionally leave the tree RED at their individual commits — this is the
> RESEARCH-mandated shape, **not** a sampling-continuity defect. The binding
> machine sampling point for 47-01 is the **Wave-1 merge gate**, not per-task
> green. The DV-1..DV-3 gap-closure plans (47-03/04/05) each have their own
> per-task automated verify (the 4 T-A..T-D guards are independently green).

- **After every 47-01 task commit:** Run `npx vitest run tests/renderer/animation-player-modal.spec.tsx` + `npm run typecheck:web` *(for 47-01 T1/T2 this is feedback only — RED is expected mid-unit per the atomic-unit exception above; the modal compiles + its spec passes only AFTER 47-01 T3 lands)*.
- **After every 47-03/47-04 task commit:** the task's own `<automated>` command (the T-A..T-D guard or the DV-2 grep set) is green; zero `src/` diff for 47-04 (tests + planning docs only).
- **After the 47-01 Wave merge (binding machine gate):** `npm run typecheck:web` → **0 errors** (from 22) **AND** `npx vitest run tests/renderer/` → **0 failed suites** (from 11) **AND** `npm test` → no new failures vs the documented pre-47 baseline **AND** `npm run typecheck:node` not worsened vs its pre-existing-RED baseline (memory `project_typecheck_node_preexisting_red` — prove via `git diff --name-only`, do not require clean).
- **After the 47-03/47-04 merge:** the 4 T-A..T-D dual-runtime guards green; `typecheck:web` 0 (the frozen `AnimationPlayerModal42.tsx` carries an owner-sanctioned `@ts-nocheck` sentinel — its 11 strict errors are v1.5.1-intrinsic, NOT 4.3 type-bleed; alias isolation verified — zero `typecheck:web` errors outside that file).
- **After the 47-05 merge:** `47-HUMAN-UAT.md` exists and is owner-signed (`approved_by: user`) over the DV-3 matrix; the 5 pending items in `41-HUMAN-UAT.md` are flipped to resolved with a Phase 47 pointer.
- **Before `/gsd-verify-work`:** machine track green-modulo-documented-preexisting + `typecheck:web` 0 + no `MixBlend`/`MixDirection` in `src/` (4.3 leg) + the §1c(a) dual-stack-bundle build-gate (below); human track signed (D-02).
- **Max feedback latency:** ~130 s (full `npm test`); ~25 s for the renderer-suite gate; ~2 s for the 4 gap-guards.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | PLAYER-01 | T-47-03 / T-47-01 | Exact-pin `4.3.0` (no caret) + committed `package-lock.json` + `npm ci` resolves; supply-chain split-brain closed | machine: build/grep | `grep -q '"@esotericsoftware/spine-player": "4.3.0"' package.json` (RED-by-design mid-unit — atomic-unit exception) | ✅ exists | ✅ green |
| 47-01-02 | 01 | 1 | PLAYER-01 | T-47-02 / T-47-05 | Migrated apply()/Pose API preserves the resilient null-return path; no CSP/asset-surface change introduced by the migration | machine: typecheck + grep | `npm run typecheck:web` → 0 (from 22) AND `! grep -rq "MixBlend\|MixDirection" src/` (binding only at Wave-1 merge — atomic-unit exception) | ✅ exists | ✅ green |
| 47-01-03 | 01 | 1 | PLAYER-01 | T-47-04 / — | Test mock cannot green-wash a broken modal (lockstep — no stale 4.2 surface) | machine: unit + grep | `npx vitest run tests/renderer/` → 0 failed suites (from 11) AND `! grep -q "setSkinByName\|setToSetupPose\|setSlotsToSetupPose\|getCurrent\|MixBlend\|MixDirection" tests/renderer/animation-player-modal.spec.tsx` | ✅ exists | ✅ green |
| 47-03-02 | 03 | 3 | PLAYER-02 (DV-NOTE / T-D) | T-47-13 | Frozen `AnimationPlayerModal42` is the literal v1.5.1 source — byte-verbatim body + 2 seds + 1 owner-sanctioned `@ts-nocheck` sentinel (the 11 strict errors are v1.5.1-intrinsic, NOT 4.3 type-bleed; alias isolation verified) | machine: unit | `npx vitest run tests/renderer/animation-player-modal-42.spec.tsx` | ✅ exists (created 47-03 T3) | ✅ green (22/22) |
| 47-04-01 | 04 | 4 | PLAYER-02 (DV-2 / T-A) | T-47-13 | The deleted `_dbg-` REG-47-01 throwaway is now a permanent git-tracked guard: the full `loadSkeleton→sampleSkeleton→buildSummary` chain on the 4.3 fixture does NOT throw `reading 'r'` + `runtimeTag` 4.3; 4.2 control `runtimeTag` 4.2 | machine: integration | `npx vitest run tests/runtime/reg4701-buildsummary-handoff.spec.ts` | ✅ exists (created 47-04 T1) | ✅ green |
| 47-04-02 | 04 | 4 | PLAYER-02 (DV-1a / T-B) | T-47-12 | Routing selects 4.2 vs 4.3 modal off `summary.runtimeTag` (never a re-detection); the alias resolves spine-player-42→spine-core@4.2.111 (lacks Slider/BonePose) distinct from canonical 4.3.0 | machine: unit | `npx vitest run tests/runtime/dual-viewer-routing.spec.ts` | ✅ exists (created 47-04 T2) | ✅ green |
| 47-04-02 | 04 | 4 | PLAYER-02 (DV-RISK-1 / T-C) | T-47-12 | The 4 DV-3 4.2 constraint-mix fixtures parse clean via spine-player-42's bare core AND throw via canonical 4.3.0 (the gap is real → the alias closes it) | machine: integration | `npx vitest run tests/runtime/dv1-42-parse-guard.spec.ts` | ✅ exists (created 47-04 T2) | ✅ green |
| 47-04-03 | 04 | 4 | PLAYER-02 (DV-2) | T-47-11 | The DV-2 rewording REWORDS PLAYER-02 (same ID, no PLAYER-03), the GL-alpha + 5-UAT clauses survive (no silent descope), 47-VALIDATION.md is coherently rewritten | machine: grep | `grep -q 'frozen spine-player@4.2.111' .planning/ROADMAP.md` AND `grep -q 'frozen spine-player@4.2.111' .planning/REQUIREMENTS.md` AND the falsified single-runtime-4.3-player SC phrasing is absent from ROADMAP (`grep -c` of that legacy phrase == 0) AND `grep -c 'PLAYER-03' .planning/REQUIREMENTS.md == 0` | ✅ exists (this task) | ✅ green |
| 47-05-01 | 05 | 5 | PLAYER-02 (DV-3 / D-08) | — | `47-HUMAN-UAT.md` enumerates the DV-3 matrix (4 4.2-leg fixtures via the frozen 4.2.111 path + skeleton2.json via the migrated 4.3.0 path) + the GL-alpha "NEVER skip" row; no CSP broadening asserted; the 5 pending `41-HUMAN-UAT.md` items flipped in-place with a Phase 47 pointer (D-08) | machine: artifact | `test -f .planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-HUMAN-UAT.md` AND it cites `SIMPLE_TEST` + `CHJWC_SYMBOLS` + `TQORW_SYMBOLS` + `TEST_03` + `skeleton2` AND `grep -c 'Phase 47' .planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md` ≥ 1 | ❌ created by 47-05 | ⬜ pending |
| 47-05-02 | 05 | 5 | PLAYER-02 (DV-3 / D-02) | — | Owner empirically confirms (1) routing sends each version to the right player off the core tag, (2) the alias-isolated 4.2 player ACTUALLY loads (DV-RISK-1), (3) GL straight-alpha (no halo) + same-framing parity + content-less-STOP graceful-degradation + the constraint-mix incl. physics — on a real GL context | **Manual-Only** (D-02 owner `checkpoint:human-action`, `gate="blocking"`) — see Manual-Only Verifications | manual → artifact: `grep -qi 'approved_by:[[:space:]]*user' 47-HUMAN-UAT.md` AND zero `result:[[:space:]]*\[pending\]` AND 7× `result:[[:space:]]*passed` | ❌ owner-signed by 47-05 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Sampling-continuity note:* 47-01 has 3 consecutive machine tasks but the binding gate is the Wave-1 merge (atomic-unit exception, documented in Sampling Rate above) — RESEARCH-mandated, not a Check 8c violation. 47-03/47-04 are all machine tasks with independent per-task automated verify. 47-05 is the single manual owner checkpoint (the load-bearing PLAYER-02 visual gate) with a machine-checkable signed-artifact post-condition. The post-rewrite map contains NO dead Plan-02 task token (the superseded single-runtime rows were REPLACED, not appended-past — proven by a zero count of the legacy Plan-02 Per-Task task-id pattern).

---

## Wave 0 Requirements

- [x] **4 new test files (T-A..T-D) are owed by RESEARCH §7 — and are created within this gap plan-set, all with direct in-repo analogs, no new framework/fixtures.** This CORRECTS the superseded single-runtime line ("No new test file or framework install needed"): the dual-runtime gap re-discussion (DV-1..DV-3) added 4 owed headless guards, all satisfied within 47-03/47-04 —
  - T-D `tests/renderer/animation-player-modal-42.spec.tsx` — created 47-03 T3 (analog: `tests/renderer/animation-player-modal.spec.tsx` PRE-`e08a2a3`, recovered via `9f967d2:` + retargeted to `spine-player-42`); GREEN 22/22.
  - T-A `tests/runtime/reg4701-buildsummary-handoff.spec.ts` — created 47-04 T1 (analog: `tests/runtime/d13-43-load-smoke.spec.ts` + `tests/core/summary.spec.ts`); GREEN.
  - T-B `tests/runtime/dual-viewer-routing.spec.ts` — created 47-04 T2 (analog: `tests/runtime/runtime-distinctness.spec.ts`); GREEN.
  - T-C `tests/runtime/dv1-42-parse-guard.spec.ts` — created 47-04 T2 (analog: `tests/runtime43/runtime43-d03.spec.ts`); GREEN.
  All DV-3 fixtures are already in-repo; NO `vitest.config.ts` / `electron.vite.config.ts` change required. `wave_0_complete` stays `true` — the owed files are satisfied within this gap plan-set; only the justification text is corrected from the superseded single-runtime "none needed" model.
- [x] The 11 import-RED `tests/renderer/*` MixBlend suites + `tests/renderer/animation-player-modal.spec.tsx` (the 4.3-leg mock harness) already exist; 47-01's migration turned them green (RED-by-design pre-bump). Test-mock migration was a Wave-1 co-task (47-01 T3), not a Wave-0 gap.
- [x] `47-HUMAN-UAT.md` authoring over the DV-3 matrix (47-05) + the in-place flip of `41-HUMAN-UAT.md`'s 5 pending items (47-05) are human-track deliverables, not test-infra gaps — but must exist for v1.6 milestone close.
- [x] **GA-2 build-gate (promote to `/gsd-verify-work`):** a post-`vite build` grep asserting BOTH the 4.3 `root.constraints` marker AND the 4.2 `root.transform`/`root.ik` separate-array marker are present in the renderer bundle (the §1c(a) dual-stack co-bundle check) — proves the alias-isolated 4.2.111 stack is genuinely co-bundled with the canonical 4.3.0 stack and electron-vite did not externalize it.

*Existing infrastructure + the 4 owed-and-satisfied T-A..T-D files cover all machine requirements; the only residual gap is the human-track DV-3 owner UAT (47-05).*

---

## Manual-Only Verifications

> The DV-2-falsified single-runtime "renders correctly via the 4.3-only
> player" rows are REWRITTEN to the DV-3 dual-leg model below (NOT retained —
> spine-core@4.3.0 categorically cannot parse 4.2 split-array constraint JSON).
> The still-valid GL-straight-alpha / same-framing-parity / 5-carried-UAT /
> content-less-STOP rows are KEPT, with their leg references reworded to DV-3.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The 4 DV-3 4.2-leg fixtures render correctly via the **frozen spine-player@4.2.111 path** | PLAYER-02 | jsdom has no WebGL; the GL render path cannot run headless | Owner runs the real Electron app, opens the Animation Viewer on each of `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` + `fixtures/CHJ/CHJWC_SYMBOLS.json` + `fixtures/3Queens/TQORW_SYMBOLS.json` + `fixtures/MON_FILES/EXPORT/TEST_03/4.2/TEST_03.json` (the DV-3 4.2 constraint-mix matrix: path / transform / ik+transform+events / ik+transform+physics) and confirms each renders correctly via the alias-isolated 4.2.111 leg; record in `47-HUMAN-UAT.md`. The UAT's job is proving (1) routing-off-the-tag, (2) the alias-isolated 4.2 player ACTUALLY loads (DV-RISK-1 — the single most likely failure), (3) the constraint-mix incl. physics — NOT re-proving the byte-identical 4.2 renderer. |
| `skeleton2.json` (4.3) renders correctly via the **migrated spine-player@4.3.0 path** | PLAYER-02 | same — real GL context required | Owner opens `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (`spine:"4.3.01"`, the DV-3 4.3 leg), confirms correct render via the 47-01-migrated 4.3 modal; record in `47-HUMAN-UAT.md` |
| GL straight-alpha: no white/dark halo on SIMPLE_TEST mesh-attachment edges | PLAYER-02 | PITFALLS "highest risk, NEVER skip"; the sharp/libvips PMA reasoning does **not** transfer to spine-webgl GL — only the owner's eyes on the real GL canvas are valid evidence | Owner renders SIMPLE_TEST (the GL-alpha hard-floor canary, via the frozen 4.2.111 leg), inspects mesh-attachment edges against the `#232732` viewer bg for dark-fringe / double-multiply halo; capture a screenshot into `47-HUMAN-UAT.md` so the observation is durable + re-checkable |
| Same-framing parity (D-06): the 4.2 rig looks identical via the frozen 4.2.111 leg | PLAYER-02 | auto-fit/zoom/position drift is only observable by visual comparison to the v1.5.1 framing | Owner compares the SIMPLE_TEST framing via the frozen 4.2.111 leg vs the documented Phase-41 v1.5.1 pose/zoom (screenshot or recorded zoom/position values); drift = regression. (The 4.2 leg is byte-verbatim v1.5.1 so parity is expected — the check guards the alias-isolation actually loading the v1.5.1 path.) |
| 5 carried Phase 41 UATs re-run green (DV-3 matrix: the migrated 4.3 leg + the frozen 4.2 leg) | PLAYER-02 | anim/skin+scrub synchrony, GL leak ×10 cycles, real-fs malformed/missing-asset terminal-error UI, atlas-less visual parity, File-menu auto-suppression — all host/visual, not jsdom-passable | Owner executes `41-HUMAN-UAT.md` tests 2–6 live per their existing `expected:` prose, across the DV-3 dual-leg matrix; sign each in `47-HUMAN-UAT.md`; D-08 flips the 5 pending items in `41-HUMAN-UAT.md` with a Phase 47 pointer |
| Content-less-STOP graceful degradation must-not-regress | PLAYER-02 | the resilient `sampleAnimationBounds` null-return (vs fatal `showError`) is exercised via the real-fs terminal-error UAT path | Owner confirms a content-less STOP animation degrades gracefully (returns null, viewer survives) — not a player-killing crash; covered by the UAT terminal-error scenario. (The frozen 4.2 leg keeps the v1.5.1 resilient path verbatim; the 4.3 leg's D-04 1:1 migration preserved it.) |

*The D-02 owner `checkpoint:human-action` (47-05, `gate="blocking"`) is the single gate for every row above. v1.6 milestone close is HELD until all are owner-signed (D-01 — no revert fallback; the ROADMAP "decoupled + revertible" framing is consciously overridden). The frozen `AnimationPlayerModal42.tsx`'s visual correctness is the BINDING contract of this owner UAT (CONTEXT D-02), NOT `tsc` — the owner-sanctioned `@ts-nocheck` sentinel only acknowledges that strict `typecheck:web` is the wrong oracle for a frozen owner-accepted v1.5.1 artifact (the 11 errors are v1.5.1-intrinsic, NOT 4.3 type-bleed; alias isolation verified — 0 `typecheck:web` errors outside that file).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies *(every 47-01/03/04 machine task has grep/test/CLI verify; the one manual task — 47-05 owner checkpoint — has a machine-checkable signed-artifact post-condition)*
- [x] Sampling continuity: no 3 consecutive tasks without automated verify *(47-01's 3 machine tasks bind at the Wave-1 merge per the documented atomic-unit exception — RESEARCH-mandated, not a Check 8c violation; 47-03/04 are all machine with per-task verify; 47-05 is the single manual gate with a machine post-condition)*
- [x] Wave 0 covers all MISSING references *(the 4 owed T-A..T-D files are satisfied within 47-03/47-04, all with in-repo analogs; the GA-2 dual-stack-bundle build-gate is promoted to `/gsd-verify-work`)*
- [x] No watch-mode flags *(all commands are `vitest run` / `npm test` / `npm run typecheck:web` — no `--watch`)*
- [x] Feedback latency < 130s *(full `npm test` ~130s; the 25s renderer-suite gate + the ~2s 4-guard gap-run give fast signal)*
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-18 · **coherently rewritten + re-approved 2026-05-19** (DV-1..DV-3 dual-runtime fold: the superseded single-runtime D-09 Plan-02 Per-Task rows + the falsified single-runtime-4.3-player Manual-Only rows REPLACED by the T-A..T-D rows + the DV-3 owner-checkpoint row; the 47-01 PLAYER-01 rows retained verbatim).
