---
phase: 47-spine-player-4-3-0-bump-viewer-regression
plan: 03
subsystem: ui
tags: [spine-player, npm-alias, dual-runtime, viewer, react, vitest, runtimeTag]

# Dependency graph
requires:
  - phase: 47-01
    provides: the migrated spine-player@4.3.0 4.3-leg modal (6b3c57e — retained byte-untouched)
  - phase: 42
    provides: the npm-alias scaffolding precedent (spine-core ↔ spine-core-42) DV-1's player/webgl alias replicates
provides:
  - DV-1 npm-alias trio (spine-player-42 + spine-webgl-42 + existing spine-core-42) nesting the whole 4.2.111 player→webgl→core graph off canonical 4.3.0 (pure package.json + lockfile)
  - DV-1a SkeletonSummary.runtimeTag REQUIRED field, populated from load.runtime.tag (explicit-identity routing contract)
  - AnimationPlayerModal42.tsx — the byte-verbatim literal v1.5.1 4.2-leg modal (9f967d2 redirect+seds + 1 owner-sanctioned @ts-nocheck sentinel)
  - AnimationPlayerModalRouter.tsx — the runtimeTag dual-runtime dispatcher (zero re-detection)
  - AppShell mounts the router (not the modal directly)
  - tests/renderer/animation-player-modal-42.spec.tsx — the T-D frozen-modal unit spec (GREEN 22/22)
affects: [47-04, 47-05]

# Tech tracking
tech-stack:
  added: ["spine-player-42 (npm:@esotericsoftware/spine-player@4.2.111)", "spine-webgl-42 (npm:@esotericsoftware/spine-webgl@4.2.111)"]
  patterns:
    - "Dual-runtime renderer via pure npm-alias trio (no Vite/vitest alias, no shim) — mirrors the core pickRuntime split at the renderer layer"
    - "Explicit-identity routing: the dispatcher consumes a core-resolved runtimeTag, never re-detects (locks feedback_explicit_identity_over_inference)"
    - "Frozen-by-redirect artifact recovery: git show <ref>:<path> | sed > <new file> — action == diff-oracle by construction (no transcription drift)"
    - "Owner-sanctioned @ts-nocheck documenting-sentinel for a frozen owner-accepted artifact whose strict-typecheck is the wrong oracle"

key-files:
  created:
    - src/renderer/src/modals/AnimationPlayerModal42.tsx
    - src/renderer/src/modals/AnimationPlayerModalRouter.tsx
    - tests/renderer/animation-player-modal-42.spec.tsx
  modified:
    - package.json
    - package-lock.json
    - src/shared/types.ts
    - src/main/summary.ts
    - src/renderer/src/components/AppShell.tsx
    - tests/renderer/app-shell-animation-viewer.spec.tsx

key-decisions:
  - "GA-1 FALSIFIED: the literal v1.5.1 modal carries 11 strict-TS errors INTRINSIC to its own genuine 4.2.111 surface (NOT 4.3 type-bleed); v1.5.1 shipped green on tests+runtime, never strict typecheck:web"
  - "OWNER DECISION (AskUserQuestion 2026-05-19): @ts-nocheck sentinel — DV-NOTE re-scoped from 'byte-verbatim + 2 seds' to 'byte-verbatim body + 2 seds + 1 sanctioned @ts-nocheck sentinel'; 47-05 owner UAT remains the binding visual gate"
  - "The source-ref 9f967d2: is CORRECT (git proved it never touched the modal → byte-identical shipped v1.5.1)"
  - "The T-D spec needed NO parallel sentinel: test files are vitest-typed, not in tsconfig.web — it never hit the strict-typecheck wall; pure redirect+seds, GREEN 22/22"

patterns-established:
  - "Pattern: dual-runtime renderer dispatch off a REQUIRED core-resolved identity tag (compile-time routing contract)"
  - "Pattern: frozen owner-accepted artifact + documenting @ts-nocheck sentinel when the project's strict gate is anachronistic to that artifact's shipped contract"

requirements-completed: [PLAYER-02]

# Metrics
duration: 32min (continuation: Task 2 + Task 3 + close-out)
completed: 2026-05-19
---

# Phase 47 Plan 03: DV-1 Dual-Runtime Animation Viewer Summary

**The Animation Viewer is now DUAL-RUNTIME: a pure npm-alias trio (spine-player-42/spine-webgl-42) nests the whole 4.2.111 player→webgl→core graph off canonical 4.3.0, a byte-verbatim frozen v1.5.1 4.2-leg modal + the 47-01 migrated 4.3-leg modal co-exist, and a runtimeTag dispatcher routes per-version off the core's already-resolved identity — closing the proven Phase-47 single-runtime gap.**

## Performance

- **Duration:** ~32 min (continuation agent: Task 2 + Task 3 + close-out; Task 1 landed pre-checkpoint at `325a6d2`)
- **Started:** 2026-05-19T08:00:00Z (approx; continuation spawn)
- **Completed:** 2026-05-19T08:33:00Z
- **Tasks:** 3 (Task 1 verified-not-redone; Tasks 2 + 3 executed this continuation)
- **Files modified:** 9 (8 plan-sanctioned + 1 documented Rule-1 deviation)

## Accomplishments

- **DV-1 npm-alias trio** (Task 1, `325a6d2` — verified intact): `spine-player-42` + `spine-webgl-42` (exact `npm:@esotericsoftware/<pkg>@4.2.111` form) alongside the existing `spine-core-42`. The committed `package-lock.json` resolves `node_modules/spine-player-42/node_modules/@esotericsoftware/spine-core` at **4.2.111** (verified via the AC node check); the canonical `"@esotericsoftware/spine-player": "4.3.0"` + `"@esotericsoftware/spine-core": "4.3.0"` lines byte-unchanged; **NO** bundler/tsconfig resolve-alias added.
- **DV-1a explicit-identity thread** (Task 1, `325a6d2` — verified): `SkeletonSummary.runtimeTag: '4.2' | '4.3'` REQUIRED field in `src/shared/types.ts`; `runtimeTag: rt.tag,` additively in the `buildSummary` return in `src/main/summary.ts` (sourced from the already-bound `load.runtime`, no new import, no JSON sniff).
- **Frozen 4.2-leg modal** (Task 2, `c1a3672`): `AnimationPlayerModal42.tsx` materialized via `git show 9f967d2:… | sed -e 's#@esotericsoftware/spine-player#spine-player-42#' -e 's/AnimationPlayerModal/AnimationPlayerModal42/g' > …`, plus the owner-sanctioned leading 12-line `@ts-nocheck` documenting sentinel. Body byte-identical to the redirect (1000-line body; file 1012 lines incl. sentinel).
- **Dispatcher + AppShell wiring** (Task 2, `c1a3672`): `AnimationPlayerModalRouter.tsx` branches SOLELY on `props.summary.runtimeTag === '4.2'` (no JSON/`.spine`/`resolveRuntime` token); AppShell repointed to mount `<AnimationPlayerModalRouter>` with identical props.
- **T-D frozen-modal unit spec** (Task 3, `85488b7`): `tests/renderer/animation-player-modal-42.spec.tsx` materialized via the 9f967d2 redirect + retarget seds — GREEN **22/22 passed**.
- **All blast-radius gates PASS**: zero `src/core/`; the 4.3 leg (`AnimationPlayerModal.tsx` 6b3c57e + `animation-player-modal.spec.tsx` e08a2a3) byte-untouched; no CSP/CORS; no `vitest.config.ts`/`electron.vite.config.ts`/`tsconfig*` change; `typecheck:web` exits 0; renderer suite 42 files / 323 passed / 1 skipped / 0 failures.

## Task Commits

1. **Task 1: DV-1 alias trio + DV-1a runtimeTag thread** — `325a6d2` (chore) — *landed pre-checkpoint; verified, not redone*
2. **Task 2: frozen 4.2-leg modal + dispatcher + AppShell wiring** — `c1a3672` (feat)
3. **Task 3: T-D frozen 4.2-leg modal unit spec** — `85488b7` (test)
4. **Rule-1 deviation: retarget Phase-41 AppShell wiring guard to the DV-1 router** — `0f83c83` (fix)

**Plan metadata:** committed separately at close-out (this SUMMARY + STATE.md + 47-CONTEXT.md amendment).

## Step-1 Enumerations (recorded per the plan)

**Task 2 — `git show 9f967d2:src/renderer/src/modals/AnimationPlayerModal.tsx | grep -n 'AnimationPlayerModal'`:**
```
60:export interface AnimationPlayerModalProps {
370:export function AnimationPlayerModal(props: AnimationPlayerModalProps) {
```
Decision gate: BOTH hits are the component's own surface (the props interface + the exported function). No comment/`data-testid`/`aria-label`/CSS/label/log string. → the global `s/AnimationPlayerModal/AnimationPlayerModal42/g` is **provably identity-only**; the global sed was used (no line-anchored variant needed). Note: there are 3 `@esotericsoftware/spine-player` occurrences (lines 10, 37 doc-comments + line 53 the import); the non-`g` first sed runs per-line so it rewrites the first match on each of those 3 lines → `grep -c "@esotericsoftware/spine-player" == 0` holds; redirect == diff-oracle (same program).

**Task 3 — `git show 9f967d2:tests/renderer/animation-player-modal.spec.tsx | grep -n "@esotericsoftware/spine-player\|AnimationPlayerModal"`:** 3 spine-specifier hits (L3 + L38 doc-comments, L52 `import { SpinePlayer }`, L68 `vi.mock(...)`) — all import/mock specifier strings/prose; the `AnimationPlayerModal` hits = L51 component import + JSX + `describe()` labels (no non-identifier behavioral string). → global retarget identity-only.

## Decisions Made

- **GA-1 falsified** — see Deviations below. Owner decided the `@ts-nocheck` sentinel option (AskUserQuestion 2026-05-19); DV-NOTE re-scoped accordingly.
- **The T-D spec did NOT need a parallel sentinel.** The conditional same-class authorization was checked and NOT exercised: test files are vitest-typed and excluded from `tsconfig.web.json`'s build graph, so the spec never hit the v1.5.1-intrinsic strict-`typecheck:web` wall. It materialized clean via pure redirect+seds and passes GREEN. (`typecheck:web` re-confirmed 0 with the spec present, zero errors outside `AnimationPlayerModal42.tsx`.)
- **Sed-defect fix on the T-D spec materialization** — see Deviations (Rule 1, plan-authorized adjustment).

## Deviations from Plan

### Decision-Resolved: GA-1 falsification → @ts-nocheck sentinel (LOCKED amendment)

**1. [Owner-decided amendment — GA-1 falsified] The frozen v1.5.1 modal carries 11 strict-TS errors intrinsic to its own 4.2.111 surface**
- **Found during:** Task 2 (the pre-checkpoint attempt; escalated as a `decision` checkpoint)
- **Issue:** The 47-03 plan's `<interfaces>` claim *"the frozen sibling compiles unchanged against 4.2.111 types (GA-1)"* was EMPIRICALLY FALSIFIED and orchestrator-confirmed against the genuine installed `@esotericsoftware/spine-player@4.2.111` `.d.ts`. The source-ref `9f967d2:` is **correct** (git proved `9f967d2` never touched the modal → byte-identical to shipped v1.5.1). But v1.5.1 shipped green on **tests + runtime, never strict `typecheck:web`** (a 47-01-era contract). The literal v1.5.1 modal carries **11 strict-TS errors INTRINSIC to its own genuine 4.2.111 surface — NOT 4.3 type-bleed**. Alias isolation is verified perfect: `typecheck:web` produced exactly 11 errors, ALL inside `AnimationPlayerModal42.tsx`, ZERO elsewhere. The 11: `preserveDrawingBuffer` required-but-missing (×1); `p.skeleton` / `entry.animation` possibly-null unguarded (×8); `p.playTime` private-access (×2).
- **Owner decision:** AskUserQuestion (2026-05-19) → option **"@ts-nocheck sentinel"**. Resolution = add ONE deterministic leading `// @ts-nocheck` documenting-header block as a sanctioned **3rd transform**. Body byte-verbatim; NO logic edits; NO project tsconfig change. **DV-NOTE re-scoped** from *"byte-verbatim + ONLY 2 seds"* → **"byte-verbatim body + 2 seds + 1 sanctioned `@ts-nocheck` sentinel"**. The frozen modal's visual correctness remains gated by the **47-05 owner UAT (CONTEXT D-02)**, not tsc.
- **Fix:** Re-materialized `AnimationPlayerModal42.tsx` deterministically via the exact redirect+2-seds, then prepended the exact owner-sanctioned 12-line `@ts-nocheck` documenting block (which contains NO literal `@esotericsoftware/spine-player` string, so the `grep -c == 0` AC holds).
- **Amended Task-2 binding oracle:** `diff <(git show 9f967d2:… | sed …) src/renderer/src/modals/AnimationPlayerModal42.tsx` == EXACTLY the prepended sentinel and nothing else. Verified output:
  ```
  0a1,12
  > // @ts-nocheck
  > // FROZEN literal v1.5.1 4.2-leg modal — materialized byte-verbatim from
  > //   git show 9f967d2:src/renderer/src/modals/AnimationPlayerModal.tsx
  > // plus the 2 DV-NOTE seds (import specifier -> spine-player-42; component
  > // identifier -> AnimationPlayerModal42). This file carries 11 strict-TS gaps
  > // that are INTRINSIC to the v1.5.1 source (v1.5.1 gated on tests + runtime,
  > // never strict typecheck:web); they are NOT 4.3 type-bleed — alias isolation
  > // is verified (0 typecheck:web errors outside this file). Owner-sanctioned
  > // 3rd transform per the 47-03 GA-1 escalation (AskUserQuestion 2026-05-19):
  > // DV-NOTE re-scoped to "byte-verbatim body + 2 seds + 1 @ts-nocheck sentinel".
  > // Visual correctness is the binding contract of the 47-05 owner UAT
  > // (CONTEXT D-02), not tsc. Zero behavioral drift; body is byte-verbatim.
  ```
  The ~1000-line body is byte-identical (diff is only `0a1,12`). All other Task-2 ACs bind unchanged and PASS: `from 'spine-player-42'`==1; `@esotericsoftware/spine-player`==0; `MixBlend|MixDirection`==3 (≥1); line count 1012 (≥990); router has no version-sniff; 4.3 modal byte-untouched; zero `src/core/`.
- **Files modified:** `src/renderer/src/modals/AnimationPlayerModal42.tsx`
- **Verification:** `npm run typecheck:web` exits 0; zero errors outside `AnimationPlayerModal42.tsx` (alias isolation confirmed — NOT a real regression).
- **Committed in:** `c1a3672` (Task 2)
- **47-CONTEXT.md amendment appended + committed** ("## Amendment 2026-05-19 — GA-1 falsified (47-03 owner decision)"). Downstream 47-04/47-05 MUST consume the amended DV-NOTE wording — no relitigation.

### Auto-fixed Issues

**2. [Rule 1 - Plan sed-defect / authorized adjustment] The plan's 3-sed T-D spec recipe produces a broken `AnimationPlayerModal4242` double-suffixed import path**
- **Found during:** Task 3 (T-D spec materialization)
- **Issue:** The plan's Task-3 recipe specifies 3 seds. The 2nd (`s#from .*modals/AnimationPlayerModal.#from '…/AnimationPlayerModal42'#`) rewrites the L51 import to `…AnimationPlayerModal42'`; the 3rd global `s/AnimationPlayerModal/AnimationPlayerModal42/g` then runs on the SAME line and turns `AnimationPlayerModal42` → `AnimationPlayerModal4242` (double-suffix → broken import to a non-existent module). This is a deterministic collision in the plan's own sed program, NOT a logic/assertion change.
- **Fix:** Dropped the redundant 2nd path-retarget sed. The single global `s/AnimationPlayerModal/AnimationPlayerModal42/g` already retargets the L51 import path `…/modals/AnimationPlayerModal'` → `…/modals/AnimationPlayerModal42'` (single suffix) AND renames the component identifier — one program, no collision. This is explicitly authorized by the plan's Task-3 Step-1 (*"adjust the sed pattern to the actual repo convention if it differs, keeping the redirect and the oracle the SAME program"*). action == oracle verified: `diff` vs the re-run 2-sed program is EMPTY.
- **Files modified:** `tests/renderer/animation-player-modal-42.spec.tsx` (materialized output)
- **Verification:** import line resolves to the real `AnimationPlayerModal42`; `vi.mock('spine-player-42')` at L68; `vi.mock('@esotericsoftware/spine-player')`==0; 4.2 mock surface tokens (`setSkinByName`/`setSlotsToSetupPose`/`setToSetupPose`/`getCurrent`)==26 (≥1); `npx vitest run` GREEN 22/22; 4.3-leg spec byte-untouched.
- **Committed in:** `85488b7` (Task 3)

**3. [Rule 1 - test asserted now-obsolete contract] Phase-41 AppShell wiring guard hard-coded the pre-DV-1 single-runtime mount**
- **Found during:** Task 3 close-out (full renderer suite run)
- **Issue:** `tests/renderer/app-shell-animation-viewer.spec.tsx` (a Phase-41 source-grep guard, NOT in the plan's 8-path blast-radius, byte-untouched by us) asserts at (1) that AppShell `import { AnimationPlayerModal }`, and at (9)/(10) a `<AnimationPlayerModal>` mount. Task 2 Step C — **per the plan's explicit mandate** — repointed AppShell to `<AnimationPlayerModalRouter>` (the entire point of DV-1). This broke exactly those 3 assertions: they encode the OLD wiring contract DV-1 deliberately supersedes. This is a DIRECT consequence of the plan's own mandated rewiring (NOT an out-of-scope pre-existing failure).
- **Fix:** Retargeted assertions (1)/(9)/(10) to `AnimationPlayerModalRouter`. The behavioral invariants are PRESERVED: (9) still asserts the identical `summary={effectiveSummary}`/`loaderMode={loaderMode}`/`onClose` prop pass-through (the router takes the byte-identical prop contract); (10) still asserts mount AFTER `<AtlasPreviewModal>`. The other 10 assertions (state slot, callback, toolbar button, class string, OR-chain, dep arrays, cleanup useEffect) are router-agnostic and byte-UNCHANGED. Added a header doc-comment recording the Phase-47 DV-1 amendment.
- **Files modified:** `tests/renderer/app-shell-animation-viewer.spec.tsx`
- **Verification:** full renderer suite GREEN — 42 files / 323 passed / 1 skipped / 0 failures.
- **Committed in:** `0f83c83`

---

**Total deviations:** 1 owner-decided LOCKED amendment (GA-1 → @ts-nocheck sentinel) + 2 auto-fixed (2× Rule 1 — 1 plan-authorized sed-defect adjustment, 1 task-mandated-rewiring test retarget).
**Impact on plan:** The amendment is owner-locked and re-scopes DV-NOTE without softening any contract (the 47-05 owner UAT remains the binding visual gate; the body is byte-verbatim, zero behavioral drift). Both Rule-1 fixes are necessary correctness consequences of the plan's own mandated changes; neither alters logic/assertions/mock-shape. The 9th touched file (`app-shell-animation-viewer.spec.tsx`) is a documented Rule-1 deviation beyond the plan's 8 sanctioned paths. No scope creep.

## Issues Encountered

- **3 `@esotericsoftware/spine-player` occurrences in the modal source (not 1).** Lines 10 + 37 are doc-comments, line 53 is the import. The plan's non-`g` first sed runs per-line, so it rewrites the first (and only) match on each of those 3 lines → zero remaining occurrences, `grep -c == 0` AC satisfied, redirect == diff-oracle preserved. Resolved by analysis, no recipe change.
- **`vi.mock('spine-player-42'` grep-count is 2, not 1** in the T-D spec — one is the line-38 doc-comment "Mock strategy" prose, one is the real line-68 `vi.mock` factory. The actual mock is exactly 1; the AC `grep -c == 1` undercounts the prose. Not a defect — the real mock is correctly retargeted and the spec passes GREEN.

## User Setup Required

None — no external service configuration required. (The npm-alias trio is restored by `npm ci` from the committed lockfile; no env vars, no dashboard config.)

## Self-Check: PASSED

**Created files exist:**
- `src/renderer/src/modals/AnimationPlayerModal42.tsx` — FOUND (1012 lines)
- `src/renderer/src/modals/AnimationPlayerModalRouter.tsx` — FOUND
- `tests/renderer/animation-player-modal-42.spec.tsx` — FOUND (823 lines)
- `.planning/phases/47-spine-player-4-3-0-bump-viewer-regression/47-03-SUMMARY.md` — FOUND (this file)

**Commits exist:** `325a6d2` (Task 1), `c1a3672` (Task 2), `85488b7` (Task 3), `0f83c83` (Rule-1 fix) — all in `git log`.

**Quoted blast-radius gate** — `git diff --name-only 5b35935..HEAD`:
```
package-lock.json
package.json
src/main/summary.ts
src/renderer/src/components/AppShell.tsx
src/renderer/src/modals/AnimationPlayerModal42.tsx
src/renderer/src/modals/AnimationPlayerModalRouter.tsx
src/shared/types.ts
tests/renderer/animation-player-modal-42.spec.tsx
tests/renderer/app-shell-animation-viewer.spec.tsx   ← documented Rule-1 deviation (plan-mandated-rewiring consequence)
```
- `git diff --name-only 5b35935..HEAD -- src/core/` → **EMPTY** (zero src/core/ change)
- `git diff --name-only 5b35935..HEAD -- src/renderer/src/modals/AnimationPlayerModal.tsx tests/renderer/animation-player-modal.spec.tsx` → **EMPTY** (the 4.3 leg, 6b3c57e/e08a2a3, BYTE-UNTOUCHED)
- `git diff --name-only 5b35935..HEAD -- vitest.config.ts electron.vite.config.ts tsconfig.json tsconfig.web.json` → **EMPTY** (no bundler/tsconfig alias; no CSP/CORS surface added)

**typecheck:web:** `npm run typecheck:web` → EXIT 0; `grep "error TS" | grep -v AnimationPlayerModal42.tsx` → NONE (the @ts-nocheck suppresses only the 11 in-file v1.5.1-intrinsic errors; zero out-of-file errors → alias isolation perfect, no real regression).

**Renderer suite:** `npx vitest run tests/renderer/` → 42 files passed / 323 passed / 1 skipped / **0 failures** (no NEW failed suites vs the post-47-01 baseline). The T-D spec `animation-player-modal-42.spec.tsx` GREEN 22/22.

**typecheck:node:** pre-existingly RED on tracked files (memory `project_typecheck_node_preexisting_red`); NOT worsened — no tracked `scripts/**` or `*.test.ts` baseline files changed by this plan (`git diff --name-only 5b35935..HEAD` touches no typecheck:node-relevant tracked source).

## Next Phase Readiness

- **47-04** (wave 4, depends 47-03) can proceed: the `SkeletonSummary.runtimeTag` thread + the router + the frozen modal/spec are all landed and machine-verified. 47-04's Q4 headless guards (T-A REG-47-01 handoff, T-B dual-runtime routing, T-C 4.2-parse over the 4 DV-3 fixtures) build on the runtimeTag seam and the frozen 4.2 leg this plan delivers.
- **47-05** (wave 5) — the binding visual contract for the frozen modal (CONTEXT D-02; the GA-1 amendment explicitly defers visual correctness to it). v1.6 close stays HELD per D-01 (STRICT, no revert) on the 47-05 owner `checkpoint:human-action`.
- **Concern / hand-off:** the GA-1 amendment is LOCKED in 47-CONTEXT.md. 47-04 must consume the amended DV-NOTE wording ("byte-verbatim body + 2 seds + 1 sanctioned @ts-nocheck sentinel") in any restated truth/AC — do NOT relitigate the `@ts-nocheck` decision.

---
*Phase: 47-spine-player-4-3-0-bump-viewer-regression*
*Plan: 03*
*Completed: 2026-05-19*
