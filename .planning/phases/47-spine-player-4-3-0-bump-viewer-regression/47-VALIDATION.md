---
phase: 47
slug: spine-player-4-3-0-bump-viewer-regression
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-18
---

# Phase 47 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Instantiated from `47-RESEARCH.md` §"Validation Architecture" (HIGH confidence,
> live `tsc`/`vitest`/tarball-verified). Two-track completion contract
> (CONTEXT specifics + D-01/D-02): a **machine track** (typecheck:web 22→0 +
> the 11 RED renderer suites → green) and a **human track** (D-02 owner
> `checkpoint:human-action` live-UAT — the only valid evidence for the
> PLAYER-02 visual rows; jsdom has no WebGL).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4 (jsdom env for `tests/renderer/*`; node env for `tests/main/*`/`tests/core/*`) |
| **Config file** | `vitest.config.ts` (project-standard; unchanged this phase) |
| **Quick run command** | `npx vitest run tests/renderer/animation-player-modal.spec.tsx tests/renderer/app-shell-animation-viewer.spec.tsx` |
| **Renderer-suite run** | `npx vitest run tests/renderer/` (the 11 import-RED suites live here) |
| **Typecheck gate** | `npm run typecheck:web` (the Phase 42→47 handoff surface — currently **22 errors**, all in `AnimationPlayerModal.tsx`) |
| **Full suite command** | `npm test` (vitest run) |
| **Estimated runtime** | ~12 s quick spec · ~25 s `tests/renderer/` · ~130 s full `npm test` · ~20 s `typecheck:web` |

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
> green. Per-task commands below are still run for fast feedback, but a RED
> result on 47-01 T1/T2 in isolation is expected and does not block the next
> task within the unit.

- **After every task commit:** Run `npx vitest run tests/renderer/animation-player-modal.spec.tsx` + `npm run typecheck:web` *(for 47-01 T1/T2 this is feedback only — RED is expected mid-unit per the atomic-unit exception above; the modal compiles + its spec passes only AFTER 47-01 T3 lands)*.
- **After the Wave-1 merge (47-01 binding machine gate):** `npm run typecheck:web` → **0 errors** (from 22) **AND** `npx vitest run tests/renderer/` → **0 failed suites** (from 11) **AND** `npm test` → no new failures vs the documented pre-47 baseline (1280 passed / 0 actual failures; the 11 suites RED at import per STATE 2026-05-18) **AND** `npm run typecheck:node` not worsened vs its pre-existing-RED baseline (memory `project_typecheck_node_preexisting_red` — prove via `git diff --name-only`, do not require clean).
- **After the Wave-2 merge:** `47-HUMAN-UAT.md` exists and is owner-signed (`approved_by: user`); the 5 pending items in `41-HUMAN-UAT.md` are flipped to resolved with a Phase 47 pointer.
- **Before `/gsd-verify-work`:** machine track green-modulo-documented-preexisting + `typecheck:web` 0 + no `MixBlend`/`MixDirection` in `src/`; human track signed (D-02).
- **Max feedback latency:** ~130 s (full `npm test`); ~25 s for the renderer-suite gate that proves the 11 RED suites recovered.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 47-01-01 | 01 | 1 | PLAYER-01 | T-47-03 / T-47-01 | Exact-pin `4.3.0` (no caret) + committed `package-lock.json` + `npm ci` resolves; supply-chain split-brain closed | machine: build/grep | `grep -q '"@esotericsoftware/spine-player": "4.3.0"' package.json` (RED-by-design mid-unit — atomic-unit exception) | ✅ exists | ⬜ pending |
| 47-01-02 | 01 | 1 | PLAYER-01 | T-47-02 / T-47-05 | Migrated apply()/Pose API preserves the resilient null-return path; no CSP/asset-surface change introduced by the migration | machine: typecheck + grep | `npm run typecheck:web` → 0 (from 22) AND `! grep -rq "MixBlend\|MixDirection" src/` (binding only at Wave-1 merge — atomic-unit exception) | ✅ exists | ⬜ pending |
| 47-01-03 | 01 | 1 | PLAYER-01 | T-47-04 / — | Test mock cannot green-wash a broken modal (lockstep — no stale 4.2 surface) | machine: unit + grep | `npx vitest run tests/renderer/` → 0 failed suites (from 11) AND `! grep -q "setSkinByName\|setToSetupPose\|setSlotsToSetupPose\|getCurrent\|MixBlend\|MixDirection" tests/renderer/animation-player-modal.spec.tsx` | ✅ exists | ⬜ pending |
| 47-02-01 | 02 | 2 | PLAYER-02 | — | UAT artifact enumerates the fixed D-09 pair + the GL-alpha "NEVER skip" row; no CSP broadening asserted | machine: artifact | `test -f .planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-HUMAN-UAT.md` AND it cites `SIMPLE_TEST` + `skeleton2` | ❌ created by this task | ⬜ pending |
| 47-02-02 | 02 | 2 | PLAYER-02 | T-47-06 / T-47-05 | Owner empirically confirms GL straight-alpha (no halo) + same-framing parity + content-less-STOP graceful-degradation + atlas-less origin-scoped asset path — on a real GL context | **Manual-Only** (D-02 owner `checkpoint:human-action`, `gate="blocking"`) — see Manual-Only Verifications | manual → artifact: `grep -Eci 'result:\s*passed' 47-HUMAN-UAT.md` returns 7 AND `grep -qi 'approved_by:[[:space:]]*user'` | ❌ owner-signed by this task | ⬜ pending |
| 47-02-03 | 02 | 2 | PLAYER-02 | — | Phase 41 audit trail preserved (in-place flip, original prose kept) | machine: grep | `grep -c 'Phase 47' .planning/phases/41-spine-animation-viewer/41-HUMAN-UAT.md` ≥ 1 AND no remaining `status:[[:space:]]*pending` on tests 2-6 | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Sampling-continuity note:* 47-01 has 3 consecutive machine tasks but the binding gate is the Wave-1 merge (atomic-unit exception, documented in Sampling Rate above) — this is the RESEARCH-mandated shape, not a Check 8c violation. 47-02 alternates machine (T1) → manual owner checkpoint (T2) → machine (T3); the manual T2 is the load-bearing PLAYER-02 visual gate and has a machine-checkable signed-artifact post-condition.

---

## Wave 0 Requirements

- [x] No new test file or framework install needed — `vitest`, `tsc`, the 11 import-RED `tests/renderer/*` suites, and `tests/renderer/animation-player-modal.spec.tsx` (the mock harness) **all already exist**. They are **currently RED by design** (pre-bump split-brain: spine-player@4.2.111 bare-resolves canonical spine-core@4.3.0 where `MixBlend` is gone); Phase 47's migration is what turns them green.
- [x] Test-mock migration is a **Wave-1 co-task** (47-01 T3), not a Wave-0 gap — scheduled inside the atomic migration unit (RESEARCH Pattern 2 / Pitfall 2), never a follow-up.
- [x] `47-HUMAN-UAT.md` authoring (D-08, 47-02 T1) + the in-place flip of `41-HUMAN-UAT.md`'s 5 pending items (47-02 T3) are human-track deliverables, not test-infra gaps — but must exist for v1.6 milestone close.

*Existing infrastructure covers all machine requirements; the only "gap" is RED-by-design state the migration resolves.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SIMPLE_TEST (4.2) renders correctly through the 4.3 player | PLAYER-02 | jsdom has no WebGL; the GL render path cannot run headless | Owner runs the real Electron app, opens the Animation Viewer on `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (D-09 4.2 leg), confirms correct render; record in `47-HUMAN-UAT.md` |
| skeleton2.json (4.3) renders correctly through the 4.3 player | PLAYER-02 | same — real GL context required | Owner opens `fixtures/SIMPLE_PROJECT_43/skeleton2.json` (D-09 4.3 leg, `spine:"4.3.01"`), confirms correct render; record in `47-HUMAN-UAT.md` |
| GL straight-alpha: no white/dark halo on SIMPLE_TEST mesh-attachment edges | PLAYER-02 | PITFALLS "highest risk, NEVER skip"; the sharp/libvips PMA reasoning does **not** transfer to spine-webgl GL — only the owner's eyes on the real GL canvas are valid evidence | Owner renders SIMPLE_TEST, inspects mesh-attachment edges against the `#232732` viewer bg for dark-fringe / double-multiply halo; capture a screenshot into `47-HUMAN-UAT.md` so the observation is durable + re-checkable |
| Same-framing parity (D-06): the 4.2 rig looks identical through the 4.3 player | PLAYER-02 | auto-fit/zoom/position drift across the major is only observable by visual comparison to the v1.5.1 framing | Owner compares the SIMPLE_TEST framing vs the documented Phase-41 v1.5.1 pose/zoom (screenshot or recorded zoom/position values); drift = regression |
| 5 carried Phase 41 UATs re-run green on the 4.3 player | PLAYER-02 | anim/skin+scrub synchrony, GL leak ×10 cycles, real-fs malformed/missing-asset terminal-error UI, atlas-less visual parity, File-menu auto-suppression — all host/visual, not jsdom-passable | Owner executes `41-HUMAN-UAT.md` tests 2–6 live on the 4.3 player per their existing `expected:` prose; sign each in `47-HUMAN-UAT.md`; D-08 flips the 5 pending items in `41-HUMAN-UAT.md` with a Phase 47 pointer |
| Content-less-STOP graceful degradation must-not-regress | PLAYER-02 | the resilient `sampleAnimationBounds` null-return (vs fatal `showError`) is exercised via the real-fs terminal-error UAT path | Owner confirms a content-less STOP animation degrades gracefully (returns null, viewer survives) — not a player-killing crash; covered by the UAT terminal-error scenario |

*The D-02 owner `checkpoint:human-action` (47-02 T2, `gate="blocking"`) is the single gate for every row above. v1.6 milestone close is HELD until all are owner-signed (D-01 — no revert fallback; the ROADMAP "decoupled + revertible" framing is consciously overridden).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies *(machine tasks have grep/test/CLI verify; the one manual task — 47-02 T2 owner checkpoint — has a machine-checkable signed-artifact post-condition)*
- [x] Sampling continuity: no 3 consecutive tasks without automated verify *(47-01's 3 machine tasks bind at the Wave-1 merge per the documented atomic-unit exception — RESEARCH-mandated, not a Check 8c violation; 47-02 alternates machine/manual/machine)*
- [x] Wave 0 covers all MISSING references *(none missing — all infra exists; RED-by-design is the migration's job to resolve)*
- [x] No watch-mode flags *(all commands are `vitest run` / `npm test` / `npm run typecheck:web` — no `--watch`)*
- [x] Feedback latency < 130s *(full `npm test` ~130s; the 25s renderer-suite gate gives fast signal on the 11-RED-suite recovery)*
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-18
