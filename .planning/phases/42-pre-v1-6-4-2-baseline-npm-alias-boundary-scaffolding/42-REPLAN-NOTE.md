---
artifact: replan-note
version: 2
supersedes: 42-REPLAN-NOTE.md v1 (first defect — bare-spine-core consumer orphan; resolution still valid, see §3)
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
created: 2026-05-16
trigger: SECOND cross-plan planning defect discovered during execute-phase Wave 2 (re-executed plan set)
decision: "Re-plan: narrow the typecheck gate to typecheck:node; hand the typecheck:web spine-player .d.ts 4.3-leak to Phase 47" — user, 2026-05-16 (Option 1)
consumed_by: /gsd-plan-phase 42
---

# Phase 42 Re-Plan Note v2 — READ BEFORE REPLANNING

`/gsd-execute-phase 42` was halted at Wave 2 a **second** time by a **confirmed,
orchestrator-verified** cross-plan contradiction — a *different* failure class
than v1, in a dimension v1's note never modeled. The user chose the clean GSD
path again: re-plan the remaining plans coherently. This note is the
authoritative hand-off and **supersedes v1**. The gsd-planner MUST honor it.
v1's core mandate (bare-`@esotericsoftware/spine-core` consumer repoint via a
**count-free fresh grep**, COMMIT B purity, A→B ancestry) **remains valid and is
restated in §3** — v2 only *adds* the second defect's resolution and freezes one
more commit.

## 1. What is DONE and FROZEN — do NOT regenerate, reorder, amend, or invalidate

Two commits are now immutable ancestry anchors. Re-planning treats BOTH as
completed/frozen. **Re-plan ONLY the still-incomplete work in 42-02 (Task 2
onward), 42-03, 42-04.**

### COMMIT A — SAFE-01 4.2 byte-equal baseline (frozen since v1)
`1b5327d feat(42-01) COMMIT A` (+ `4467d81` D-09 freeze guard, `0ccfbbf`/`c5ef358`
canonical-JSON RED/GREEN, `a0f4d10` SUMMARY, `ce1d373` worktree merge,
`24518d0` post-merge env-robustness fix). ROADMAP `- [x] 42-01-PLAN.md`.
SAFE-01 suite 23 pass / 20 skip. The milestone's de-risking root + RT-01
git-ancestry parent. **Frozen. Do not touch.**

### COMMIT B — RT-01 dual spine-core install (NEW — frozen as of this halt)
`cc5783f feat(42-02): COMMIT B — RT-01 dual spine-core (4.3.0 canonical +
spine-core-42 alias 4.2.111)`.

Orchestrator-verified at halt time:
- **Pure**: exactly 2 files (`package.json`, `package-lock.json`). ✅
- **Ancestry**: `git merge-base --is-ancestor 1b5327d cc5783f` → TRUE
  (COMMIT A is a git ancestor of COMMIT B). ✅
- Exact pins: `@esotericsoftware/spine-core@4.3.0` canonical;
  `spine-core-42` = exact `npm:@esotericsoftware/spine-core@4.2.111`;
  `@esotericsoftware/spine-player` untouched at `4.2.111`. Lockfile
  reproducible (`npm ci` zero churn), verified-live sha512 integrity.
- The Wave-2 executor auto-corrected one Rule-1 deviation in Task 1: npm wrote
  caret ranges; corrected to exact pins (threat T-42-07) before COMMIT B.

**COMMIT B is correct and final. The re-planned 42-02 MUST treat Task 1 /
COMMIT B as already-landed (detect-and-skip on re-execute) — do NOT
regenerate, re-pin, or re-order it.** Research Pitfall 1 (no amend/rebase/
reorder of ancestry commits) applies to BOTH A and B.

### NOT done (re-execution regenerates):
- 42-02 Task 2 (bare-consumer repoint) + Task 3. The Wave-2 executor completed
  the repoint **correctly** in the working tree (fresh count-free grep → 15
  git-tracked files: 8 production incl. `src/main/summary.ts` — the file v1's
  hand-list WRONGLY omitted — + 7 test files; plus the locked TS6133
  reconciliation in `tests/main/image-worker-rotation.spec.ts`) but
  **deliberately did not commit it** (committing would have falsely asserted
  the plan's unmet "literal full `npm run typecheck` exit 0" criterion). The
  orchestrator **discarded** that uncommitted work on purpose: per the v1
  load-bearing lesson the repoint set MUST be re-derived by a **fresh
  count-free grep at re-execute time under the corrected plan**, never carried
  forward as a frozen file list. Re-execution regenerates it deterministically.
- 42-03, 42-04 — not started.

## 2. The SECOND confirmed defect (orchestrator-verified, not just agent-reported)

`npm run typecheck` = `typecheck:node && typecheck:web`. The moment COMMIT B
made bare `@esotericsoftware/spine-core` resolve to **4.3.0** (hoisted
top-level), a transitive type-leak appeared that v1's note (§2/§3) **never
modeled** — it modeled ONLY bare-`spine-core` orphans in `src/core`/`tests`.

**Root cause (research Pitfall 3 — "spine-player split-brain", exactly as
42-02's own purpose statement warned):**
`node_modules/@esotericsoftware/spine-player/dist/Player.d.ts:29` imports a
**BARE** specifier:
`import { Animation, AnimationState, Color, Disposable, Downloader, Skeleton, StringMap, TimeKeeper, TrackEntry } from "@esotericsoftware/spine-core";`
spine-player ships at **4.2.111** but its own `.d.ts` rides the bare specifier.
After COMMIT B, that bare specifier → **4.3.0**, so spine-player's public
types resolve against 4.3's Pose-rewrite and leak into the **git-tracked**
renderer file `src/renderer/src/modals/AnimationPlayerModal.tsx`.

**Orchestrator-verified split (with COMMIT B + the repoint applied):**

| Project | tsc -p | Exit | Errors | Where | git-tracked? | Fresh-clone reality |
|---------|--------|------|--------|-------|--------------|---------------------|
| `typecheck:node` | `tsconfig.node.json` (src/main + src/core + tests) | 1 locally | 140 | **ALL** in `scripts/probe-*.ts`, `scripts/diagnose-*.ts`, `tests/_trace_tmp/` | **NO — all untracked/gitignored** (`.gitignore:73`, `.gitignore:85`) | **exit 0** — these scratch files do not exist on a fresh clone / CI `npm ci` checkout |
| `typecheck:web` | `tsconfig.web.json` (src/renderer) | 1 | 22 | **ALL** in `src/renderer/src/modals/AnimationPlayerModal.tsx` | **YES — tracked** | **exit 1** — fails on CI |

So: `typecheck:node` (the real Phase-44 oracle / 42-04 CI dual-runtime gate
scope) is **clean on any fresh clone**. Only `typecheck:web`, via spine-player's
own bare-`.d.ts` hoist, is red — a surface the v1.6 ROADMAP **already assigns to
Phase 47 by design**: STATE.md:128 — *"47 (spine-player bump + viewer
regression, last+revertible). Phase 47 depends only on Phase 42 (decoupled,
parallelizable, sequenced last)."*

### The internal contradiction (same class as v1, new dimension)

| Locked constraint | Source | Conflict |
|-------------------|--------|----------|
| spine-player stays 4.2.111; **Phase 47 owns the bump** | 42-02 plan ~line 161; v1 note §4 | can't bump to make AnimationPlayerModal compile |
| Don't touch the viewer/player library in Phase 42 | 42-02 plain-English; SEED-009 viewer charter | can't patch AnimationPlayerModal or spine-player `.d.ts` here |
| `npm run typecheck` literal exit 0, **no hedging** (`must_haves.truths`) | 42-02 / 42-03 / 42-04 | impossible while spine-player's bare `.d.ts` hoists 4.3 into typecheck:web |

42-02's repoint mechanism is structurally incapable of fixing this — the red
file imports **spine-player**, not bare `spine-core`. The "literal full
`npm run typecheck` exit 0" criterion overreached into Phase 47's chartered
territory; it was written without modeling spine-player's own `.d.ts` bare
hoist.

## 3. The LOCKED resolution — Option 1 (user-selected 2026-05-16)

**Narrow Phase 42's typecheck assertion to `typecheck:node`; formally hand the
`typecheck:web` spine-player `.d.ts` 4.3-leak to Phase 47.**

This is **NOT** the v1-§4 user-rejected "ship broadly red until Phase 43" —
that was about `src/core` *production* code red. Here `src/core` + `src/main` +
`tests` (`typecheck:node`) are **clean on a fresh clone**; only the
renderer-via-spine-player surface, which **Phase 47 already owns**, is red.
It is a *scoping correction*, not a weakening.

### Re-plan deliverables (the planner MUST produce all of these; plan-checker re-pass on 02 + 04)

**42-02 (amend):**
- Task 1 / COMMIT B (`cc5783f`): mark **DONE + FROZEN**. Plan text must direct
  the re-executor to **detect COMMIT B exists and skip it** (no re-pin, no
  re-commit, no reorder). A→B ancestry already satisfied.
- Task 2 (repoint) — **method unchanged from v1**: discover the repoint set by
  a **count-free FRESH grep over `src/` AND `tests/` at execute time**
  (`grep -rlE "['\"]@esotericsoftware/spine-core['\"]" src/ tests/`), repoint
  every hit bare → `spine-core-42`, ZERO logic change; apply the locked TS6133
  reconciliation in `tests/main/image-worker-rotation.spec.ts`. NEVER a
  hand-enumerated list/count even if a note hands you one
  ([[feedback_npm_alias_port_orphans_bare_consumers]]). Commit as a **separate
  commit, same wave, immediately after COMMIT B**, descendant of COMMIT A/B.
- **Replace the success criterion**: drop "literal full `npm run typecheck`
  exit 0 / no hedging". The Task-2 gate is now:
  1. **SAFE-01 byte-equality re-verifies green** (identical 4.2.111 runtime;
     only the module *name* moved), AND
  2. **`npm run typecheck:node` exits 0 on a fresh-clone-equivalent tree**
     (i.e. ignoring untracked gitignored `scripts/probe-*.ts` /
     `scripts/diagnose-*.ts` / `tests/_trace_tmp/` scratch — these do not
     exist on CI `npm ci`; the plan MUST state fresh-clone semantics so the
     re-executor does NOT try to "fix" gitignored scratch — that is correctly
     out of scope, as the Wave-2 executor logged).
- **Add an explicit, documented known-item**: the `typecheck:web` /
  `AnimationPlayerModal.tsx` / spine-player-`.d.ts` 4.3-leak (22 errors) is a
  **KNOWN, EXPECTED, Phase-47-OWNED** consequence of the locked 4.3-canonical
  direction. Not a Phase-42 defect. Phase 47 (spine-player → 4.3.0 bump +
  viewer regression, sequenced last + independently revertible) resolves it.
  This must be written into 42-02 (and surfaced in its SUMMARY) so the
  verifier does not flag it as a Phase-42 miss.

**42-03 (re-verify, amend only if needed):** any "loader/sampler/bounds
untouched + typecheck green" assertion must (a) accommodate the import-specifier
lines already moved by 42-02 Task 2 (logic still untouched; only the specifier
moved) and (b) scope its typecheck assertion to `typecheck:node` fresh-clone,
consistent with 42-02. No new scope.

**42-04 (amend):** the CI-01 gate (`.github/workflows/ci.yml`) asserts
**`npm run typecheck:node`** (the dual-runtime gate scope), NOT full
`npm run typecheck`. CI runs on a fresh `npm ci` clone so the gitignored
scratch files are naturally absent → `typecheck:node` is genuinely exit 0
there; no scratch-exclusion shim needed in CI. The D-13 4.3 load-smoke,
git-ancestry assertion, 3-OS matrix, Phase-44 fixture-absence guard, and
`42-OWNER-EXPORT-SPEC.md` are unchanged. The plan-checker MUST confirm the
4-commit ordering (A→B→repoint→C→D) and the **`typecheck:node`-green**
invariant are mutually consistent end-to-end (now satisfiable).

## 4. Rejected alternatives (do NOT revisit)

- **Option 2 — spine-player type-isolation shim in Phase 42** (tsconfig `paths`
  redirect / renderer ambient module). Rejected: expands Phase 42's locked
  scope, pre-empts Phase 47's charter, paths-redirect can mask real future
  drift.
- **Option 3 — bring Phase 47's spine-player → 4.3.0 bump forward.** Rejected:
  contradicts the current lock; destroys Phase 47's "sequenced last +
  independently revertible" de-risking intent.
- **Re-examine the alias direction** (bare → 4.3.0 canonical; 4.2.111 via
  `spine-core-42`). LOCKED + research-verified (CONTEXT.md:62, PROJECT.md:88;
  RESEARCH Pitfall 3). Off the table.
- **Ship Phase 42 with full typecheck red.** User-rejected in v1 §4; v2 does
  NOT do this — `typecheck:node` is the asserted, satisfiable gate and it is
  genuinely green on a fresh clone.
