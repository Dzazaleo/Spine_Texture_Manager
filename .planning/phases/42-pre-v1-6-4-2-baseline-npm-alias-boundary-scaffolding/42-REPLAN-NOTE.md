---
artifact: replan-note
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
created: 2026-05-16
trigger: cross-plan planning defect discovered during execute-phase Wave 2
decision: "Re-plan Phase 42 (clean GSD path)" — user, 2026-05-16
consumed_by: /gsd-plan-phase 42
---

# Phase 42 Re-Plan Note — READ BEFORE REPLANNING

`/gsd-execute-phase 42` was halted at Wave 2 by a **confirmed, verified**
cross-plan contradiction. The user chose the clean GSD path: re-plan all
remaining plans coherently rather than amend locked plan scope mid-execution.
This note is the authoritative hand-off — the gsd-planner MUST honor it.

## 1. What is DONE and FROZEN — do NOT regenerate or invalidate

**Plan 42-01 / COMMIT A (SAFE-01 4.2 byte-equal baseline) is LANDED, merged,
post-merge-verified, and tracking-complete.** It is the milestone's immutable
de-risking anchor and the git-ancestry root for RT-01. Re-planning MUST treat
42-01 as a completed, frozen plan:

- Commits in history (on `milestone/v1.6-spine-4.3-dual-runtime`):
  - `0ccfbbf` test(42-01) RED → `c5ef358` GREEN (canonical-JSON serializer)
  - `1b5327d` feat(42-01) **COMMIT A** — SAFE-01 byte baseline (the ancestry root)
  - `4467d81` feat(42-01) **COMMIT A** — D-09 freeze guard
  - `a0f4d10` docs(42-01) SUMMARY · `ce1d373` worktree merge
  - `24518d0` fix(42-01) post-merge: enumeration `testTimeout` 10s→60s
    (env-robustness; `discover()` legitimately ~20s with heavy rigs present
    locally; no baseline/assertion changed; CI fresh-clone always fast)
  - `a0f840b` docs(phase-42) tracking after wave 1
- ROADMAP shows `- [x] 42-01-PLAN.md`. SAFE-01 suite: 23 pass / 20 skip green.
- **Re-plan ONLY 42-02 / 42-03 / 42-04** (plus any new plan the fix needs).
  Do not re-derive, re-order below, or weaken COMMIT A. The
  `git merge-base --is-ancestor COMMIT_A COMMIT_B` constraint still holds and
  is satisfied automatically by sequential wave execution.

## 2. The confirmed defect (verified by the Wave-2 executor, independently re-verified by the orchestrator)

RT-01's **LOCKED, research-verified direction** (CONTEXT.md:62, PROJECT.md:88)
is: `@esotericsoftware/spine-core` (bare) → **4.3.0 canonical**; `4.2.111`
side-by-side via the exact-pinned alias `spine-core-42`. This direction is NOT
up for relitigation.

**The gap:** 7 existing `src/core` files import the **bare** specifier
`@esotericsoftware/spine-core`:

`src/core/sampler.ts`, `src/core/bounds.ts`, `src/core/loader.ts`,
`src/core/types.ts`, `src/core/bones.ts`, `src/core/analyzer.ts`,
`src/core/synthetic-atlas.ts` (8 import sites total in `src/`).

The moment RT-01 makes the bare specifier resolve to **4.3.0**, these
4.2-written consumers compile against 4.3's Pose-architecture rewrite →
**`npm run typecheck` = 58 errors (24 in `src/core` production code)**, where
it was exit 0 at COMMIT A. (Measured by the Wave-2 executor inside its
worktree after a correct exact-pinned `npm ci`; the dual-install itself,
alias direction, lockfile integrity, and `spine-player` staying 4.2.111 were
all verified correct — only the consumer fallout is the problem.)

**Why the research premise didn't catch it:** STACK.md verified 4.2/4.3
*type-universe isolation* under `tsc moduleResolution:bundler` — i.e. the two
modules don't structurally bleed into each other. TRUE. But that says nothing
about **pre-existing consumers orphaned on a version-flipped bare specifier** —
a different failure class the plan set never addressed.

**The internal contradiction across the current plan set:**

| Plan | Constraint (current text) | Conflict |
|------|---------------------------|----------|
| 42-02:149 | "Do NOT modify any `src/**` file in this plan" | can't repoint consumers here |
| 42-02:18,160,234 | `npm run typecheck` MUST exit 0 | impossible while bare consumers ride 4.3 |
| 42-02:162 | COMMIT B = `package.json`+`package-lock.json` ONLY | repoint can't live in COMMIT B itself |
| 42-03:151,167 | Do NOT touch `loader/sampler/bounds`; typecheck green | same impossibility; rewire deferred to Phase 43 |
| 42-04 | CI gate asserts typecheck green | inherits the impossibility |

No plan in {02,03,04} repoints the bare consumers. Phase 43 (RT-02) is where
they stop importing spine-core directly (→ `load.runtime.*` facade) — but the
facade does not exist in Phase 42 (Plan 03 creates signatures only, no bodies).

## 3. The forced resolution shape (the locked direction dictates it)

"4.3 canonical" *definitionally* means **no legacy code may resolve spine-core
bare-as-4.2**. The only Phase-42-valid target that keeps the 4.2 runtime AND
typecheck green is the `spine-core-42` alias. So the re-plan MUST add an
explicit, plan-checked task:

- **Repoint all 7 `src/core` bare `@esotericsoftware/spine-core` imports →
  `spine-core-42`** (mechanical specifier rename; ZERO logic change).
  - SAFE-01 stays byte-equal: identical 4.2.111 runtime, only the module
    *name* changes — re-run the SAFE-01 gate to prove byte-equality holds.
  - The `tests/arch.spec.ts` no-co-mingled-imports anchor stays green: each
    consumer imports exactly ONE specifier (`spine-core-42`), not both.
  - Keep **COMMIT B pure** (`package.json`+`package-lock.json` only, honoring
    42-02:162) — the consumer repoint is a **separate commit, same wave**,
    immediately after COMMIT B, still a git descendant of COMMIT A.
  - Phase 43 (RT-02) later migrates these `spine-core-42` direct imports →
    the `load.runtime.*` facade. Two-step migration is intended and clean.

Re-plan deliverables: amend 42-02 (drop the absolute `src/**` ban; add the
repoint as a discrete post-COMMIT-B task with its own commit + a SAFE-01
re-verify gate), amend 42-03 (its "loader/sampler/bounds untouched" + git-diff
assertions must accommodate the now-already-repointed import lines — the
*logic* is still untouched; only the import specifier moved in 42-02), and keep
42-04's typecheck-green CI gate (now satisfiable). The plan-checker pass must
confirm the 4-commit ordering and the typecheck-green invariant are mutually
consistent end-to-end.

## 4. Rejected alternatives (do not revisit)

- **Re-examine alias direction** — direction is LOCKED + research-verified
  (CONTEXT.md:62, PROJECT.md:88; RESEARCH "Pitfall 3 naive-direction
  split-brain"). Off the table.
- **Ship Phase 42 with typecheck red until Phase 43** — user-rejected;
  weakens the milestone's foundational de-risking phase + CI safety net.
