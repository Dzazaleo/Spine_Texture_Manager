---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
plan: 02
subsystem: dependency-graph / runtime-alias-boundary
tags: [RT-01, SAFE-01, npm-alias, spine-core-42, dual-runtime, COMMIT-B, repoint, v1.6]
requires:
  - "COMMIT A (1b5327d) — SAFE-01 4.2.111 byte-equal golden baseline (42-01)"
provides:
  - "RT-01 dual spine-core install FROZEN at COMMIT B cc5783f (4.3.0 canonical + spine-core-42 = exact npm:@esotericsoftware/spine-core@4.2.111; spine-player untouched at 4.2.111) — detected-and-skipped, not regenerated"
  - "Every pre-existing bare @esotericsoftware/spine-core consumer (src/ + tests/) repointed onto the spine-core-42 alias (specifier-string-only rename, ZERO logic change) — commit 1a8c18b, descendant of frozen COMMIT B"
  - "typecheck:node clean exit 0 on a fresh-clone-equivalent tree (all bare-specifier orphans in node scope eliminated + locked TS6133 folded)"
  - "SAFE-01 byte-equality RE-VERIFIED green after the repoint (4.2.111 runtime unchanged; only the module name moved)"
affects:
  - "Plan 42-03 — loader/sampler/bounds logic untouched; only the import-specifier lines moved (already-moved by this plan's Task 2)"
  - "Plan 42-04 — CI-01 gate asserts typecheck:node (not full typecheck); A→B→repoint ordering must hold end-to-end"
  - "Phase 43 (RT-02) — later migrates the spine-core-42 direct imports → the load.runtime.* facade (clean two-step migration)"
  - "Phase 47 — OWNS the typecheck:web / AnimationPlayerModal.tsx / spine-player Player.d.ts 4.3-leak (spine-player 4.2.111 → 4.3.0 bump + viewer regression, sequenced last + independently revertible)"
tech-stack:
  added: []
  patterns:
    - "count-free fresh-grep repoint-scope discovery at execute time (no hand-list carried forward — feedback_npm_alias_port_orphans_bare_consumers)"
    - "specifier-string-only module-name rename (alias resolves to the identical 4.2.111 install — pure plumbing, SAFE-01 byte-equal preserved)"
    - "explicitly-flagged inline deviation comment for the locked one-token TS6133 reconciliation"
key-files:
  created:
    - .planning/phases/42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding/42-02-SUMMARY.md
  modified:
    - src/core/analyzer.ts
    - src/core/bones.ts
    - src/core/bounds.ts
    - src/core/loader.ts
    - src/core/sampler.ts
    - src/core/synthetic-atlas.ts
    - src/core/types.ts
    - src/main/summary.ts
    - tests/core/analyzer.spec.ts
    - tests/core/bones.spec.ts
    - tests/core/bounds-rotation-aabb.spec.ts
    - tests/core/bounds.spec.ts
    - tests/core/sampler.spec.ts
    - tests/core/synthetic-atlas.spec.ts
    - tests/main/atlas-writer.spec.ts
    - tests/main/image-worker-rotation.spec.ts
decisions:
  - "Task 1 / COMMIT B (cc5783f) detected-and-skipped (frozen ancestry anchor) — no re-pin/re-commit/reorder; research Pitfall 1 honored for BOTH COMMIT A and COMMIT B"
  - "Repoint scope re-derived by a count-free fresh grep at execute time = 15 files (8 production incl. src/main/summary.ts + 7 test files); the re-plan note's '7 src/core' hand-enumeration was NOT followed (it omits src/main/summary.ts + the typecheck-scope tests)"
  - "Comment node_modules/@esotericsoftware/spine-core/... path-references deliberately NOT rewritten — the physical package dir is still @esotericsoftware/spine-core; spine-core-42 is only the npm alias name (quoted-specifier-only sed pattern)"
  - "Task-2 gate is the TWO conditions (SAFE-01 byte-equal RE-VERIFIED + typecheck:node exit 0 on fresh-clone-equivalent tree), NOT a literal full npm run typecheck exit 0 — per locked re-plan note v2 §3"
metrics:
  duration: ~5 min
  completed: 2026-05-16
---

# Phase 42 Plan 02: RT-01 Dual spine-core Alias Boundary + Bare-Consumer Repoint Summary

**One-liner:** COMMIT B (`cc5783f` — `@esotericsoftware/spine-core@4.3.0` canonical + `spine-core-42` = exact `npm:@esotericsoftware/spine-core@4.2.111`) detected-and-skipped as a frozen ancestry anchor; all 15 pre-existing bare `@esotericsoftware/spine-core` consumers (8 production incl. `src/main/summary.ts` + 7 tests) mechanically repointed onto the `spine-core-42` alias in a separate descendant commit (`1a8c18b`) with ZERO logic change, the locked TS6133 reconciliation folded — SAFE-01 RE-VERIFIED byte-equal and `typecheck:node` clean exit 0; the `typecheck:web` spine-player `.d.ts` 4.3-leak is the documented KNOWN/EXPECTED/Phase-47-OWNED consequence (not a Phase-42 defect).

## What Was Built

### Task 1 — COMMIT B detected-and-skipped (FROZEN, no re-pin/re-commit/reorder)

`cc5783f` (`feat(42-02): COMMIT B — RT-01 dual spine-core (4.3.0 canonical + spine-core-42 alias 4.2.111)`) is an immutable ancestry anchor in this worktree's base history. Per the frozen-anchor protocol, Task 1's first action was a detect-and-skip:

| Detection | Result |
|---|---|
| `git cat-file -e cc5783f` | exit 0 — COMMIT B present |
| `git merge-base --is-ancestor 1b5327d cc5783f` | exit 0 — COMMIT A `1b5327d` is already a git ancestor of the frozen COMMIT B (A→B ancestry satisfied at the frozen anchors, NOT re-derived) |
| `package.json` `@esotericsoftware/spine-core` | `4.3.0` (canonical — load-bearing direction) |
| `package.json` `spine-core-42` | `npm:@esotericsoftware/spine-core@4.2.111` (exact-pinned alias) |
| `package.json` `@esotericsoftware/spine-player` | `4.2.111` (NOT bumped — Phase 47 owns it) |
| Most recent `package.json` commit | `cc5783f` (no newer package.json commit; COMMIT B is pure — exactly 2 files) |

No `npm install`, no re-pin, no re-commit, no reorder. Task 1 is complete by virtue of the frozen COMMIT B. Research Pitfall 1 (no amend/rebase/reorder of an ancestry commit) honored for BOTH COMMIT A (`1b5327d`) and COMMIT B (`cc5783f`).

### Task 2 — Consumer-repoint (separate commit `1a8c18b`, descendant of frozen COMMIT B)

**Step 1 — count-free fresh grep at execute time** (`grep -rlE "['\"]@esotericsoftware/spine-core['\"]" src/ tests/`) returned the authoritative repoint set, re-derived now (NO hand-list carried forward):

**8 production files:** `src/core/analyzer.ts`, `src/core/bones.ts`, `src/core/bounds.ts`, `src/core/loader.ts`, `src/core/sampler.ts`, `src/core/synthetic-atlas.ts`, `src/core/types.ts`, **`src/main/summary.ts`** (← the file the re-plan note's "7 src/core" hand-enumeration WRONGLY omits — confirmed included; the hand-list was NOT followed).

**7 test files:** `tests/core/analyzer.spec.ts`, `tests/core/bones.spec.ts`, `tests/core/bounds-rotation-aabb.spec.ts`, `tests/core/bounds.spec.ts`, `tests/core/sampler.spec.ts`, `tests/core/synthetic-atlas.spec.ts`, `tests/main/atlas-writer.spec.ts`.

Total **15 files** repointed (matches the orchestrator-verified Wave-2 count; the v1 hand-list defect class — `feedback_npm_alias_port_orphans_bare_consumers` — was NOT reproduced).

**Step 2 — mechanical specifier-string rename, ZERO logic change.** Every quoted bare specifier `'@esotericsoftware/spine-core'` → `'spine-core-42'` on import/from lines, covering value imports, `import type`, and the 2 dynamic `import('...').MeshAttachment` type-positions in `tests/core/bounds.spec.ts`. Diff: 15 files, exactly 17 specifier-token replacements (17 insertions / 17 deletions in the rename set). Comment `node_modules/@esotericsoftware/spine-core/...` path-references (loader.ts:24/534, synthetic-atlas.ts:52/68/73, summary.ts:528) were deliberately **left untouched** — the physical package directory is still named `@esotericsoftware/spine-core`; `spine-core-42` is only the npm alias name. `spine-core-42` resolves to the SAME 4.2.111 install the bare specifier resolved to before COMMIT B → pure module-name rename, identical code, identical runtime.

**Step 3 — the locked TS6133 reconciliation (explicitly-flagged deviation).** `tests/main/image-worker-rotation.spec.ts:190` had a pre-existing `error TS6133: 'data' is declared but its value is never read` (verified verbatim at the 42-01 base commit `166523f4`; `tests/main/**` is in `tsconfig.node.json` `include` → `typecheck:node` scope). Applied the locked one-token fix: `const { data, info }` → `const { data: _data, info }` with the exact inline comment `// repoint deviation: pre-existing TS6133, see 42 deferred-items.md §3`. `info` remains used (lines 192-193); this is the ONLY non-mechanical change in the commit and is explicitly flagged.

## Verification Results

| Gate | Command | Result |
|---|---|---|
| Detect-and-skip | `git cat-file -e cc5783f` | exit 0 ✓ |
| A→B ancestry | `git merge-base --is-ancestor 1b5327d cc5783f` | exit 0 ✓ |
| Repoint completeness | `grep -rlE "['\"]@esotericsoftware/spine-core['\"]" src/ tests/` | ZERO files ✓ |
| **Task-2 gate cond. 1** — SAFE-01 byte-equal RE-VERIFY | `npx vitest run tests/safe01` | 4 files / **23 passed** ✓ (identical 4.2.111 runtime; 42-01 frozen baseline untouched) |
| **Task-2 gate cond. 2** — typecheck:node fresh-clone-equivalent | `npm run typecheck:node` | **exit 0** ✓ (literal clean — zero git-tracked errors; gitignored scratch `scripts/probe-*.ts`/`scripts/diagnose-*.ts`/`tests/_trace_tmp/` not even present in this worktree) |
| No co-mingled specifiers | `npx vitest run tests/arch.spec.ts` | 1 file / **13 passed** ✓ (each consumer imports exactly one `spine-core-42`) |
| TS6133 reconciliation flagged | `grep -n "repoint deviation: pre-existing TS6133" tests/main/image-worker-rotation.spec.ts` | line 190 present ✓; `_data` rename at line 191 ✓ |
| Repoint commit is descendant of COMMIT B | `git merge-base --is-ancestor cc5783f 1a8c18b` | exit 0 ✓ (A→B→repoint ordering holds) |
| Frozen anchor intact | `git log --format=%H -- package.json \| head -1` | `cc5783f` ✓ (Task 2 created NO package.json commit) |
| Repoint commit purity | `git show --stat 1a8c18b` | 16 files (15 repoint + TS6133); NO package.json/package-lock.json, NO src/renderer/**, NO tsconfig.web.json, NO tests/safe01/** source ✓ |

The Task-2 gate is the **two conditions above** (SAFE-01 byte-equal RE-VERIFIED + `typecheck:node` exit 0 on a fresh-clone-equivalent tree), NOT a literal full `npm run typecheck` exit 0 — per the locked re-plan note v2 §3. Both conditions PASS.

## KNOWN / EXPECTED / Phase-47-OWNED — NOT a Phase-42 defect (REQUIRED note for the downstream verifier)

`npm run typecheck:web` is **RED** (~22 errors in `src/renderer/src/modals/AnimationPlayerModal.tsx`). Root cause: `node_modules/@esotericsoftware/spine-player/dist/Player.d.ts:29` imports a **BARE** `@esotericsoftware/spine-core` specifier; spine-player ships at 4.2.111 but its own `.d.ts` rides the bare specifier, so after the frozen COMMIT B that bare specifier resolves to **4.3.0** and spine-player's public types resolve against 4.3's Pose-rewrite, leaking into the git-tracked renderer file `AnimationPlayerModal.tsx`. **Additionally**, the full `npx vitest run` surfaces the same root cause at vitest module-resolution time: 8 `tests/renderer/*.spec.tsx` files fail to collect with `SyntaxError: The requested module '@esotericsoftware/spine-core' does not provide an export named 'MixBlend'`, tracing to `AnimationPlayerModal.tsx:45` (`import { MixBlend, MixDirection, ... } from '@esotericsoftware/spine-core'`). This is the **same `AnimationPlayerModal.tsx` / spine-player surface** as the `typecheck:web` leak, just manifesting in the renderer test layer instead of `tsc`.

**This is the KNOWN, EXPECTED, Phase-47-OWNED consequence of the locked 4.3-canonical alias direction (research Pitfall 3 — "spine-player split-brain", which 42-02's own purpose statement always warned about).** It is **NOT a Phase-42 defect** and is **NOT fixable by this plan's repoint mechanism** — the red surface imports **spine-player** (or bare `spine-core` from a *renderer* file), not the bare `src/core`/`src/main`/`tests` consumers that Task 2 owns. Proof it is not a repoint regression:

- The repoint commit `1a8c18b` touched **zero** `src/renderer/**` and **zero** `tests/renderer/**` files (verified `git diff --name-only`).
- `AnimationPlayerModal.tsx:45` is **byte-identical at the frozen COMMIT B `cc5783f`** (verified `git show cc5783f:...`) — the failure is a direct consequence of the frozen COMMIT-B 4.3 flip, independent of Task 2.
- Renderer files are correctly **NOT in the count-free repoint grep scope** (the plan explicitly forbids touching `src/renderer/**`).

Per the user-locked resolution (Option 1, 2026-05-16; `42-REPLAN-NOTE.md` v2 §3), **Phase 47** (spine-player 4.2.111 → 4.3.0 bump + viewer regression, sequenced last + independently revertible, depends only on Phase 42 — ROADMAP / STATE.md:128) **owns and resolves this**. The rejected Options 2 (type-isolation shim in Phase 42) and 3 (pull Phase 47's bump forward) were **NOT introduced** (`42-REPLAN-NOTE.md` v2 §4). `typecheck:node` — the genuine Phase-44 oracle / 42-04 CI dual-runtime gate scope (`src/main` + `src/core` + `tests`) — is genuinely clean; only the renderer-via-spine-player surface is red, and that is Phase 47's by roadmap design. **The downstream verifier must NOT flag `typecheck:web` red (or the 8 renderer `.spec.tsx` collection failures) as a Phase-42 miss.**

## Deviations from Plan

### Locked Deviation (mandated by the plan — explicitly flagged)

**1. [Plan-mandated] Locked one-token TS6133 reconciliation in `tests/main/image-worker-rotation.spec.ts`**
- **Found during:** Task 2 (pre-existing — verified verbatim at 42-01 base commit `166523f4`, predates Phase 42)
- **Issue:** `tests/main/image-worker-rotation.spec.ts:190` — `error TS6133: 'data' is declared but its value is never read` (in `typecheck:node` scope)
- **Fix:** `const { data, info }` → `const { data: _data, info }` + inline comment `// repoint deviation: pre-existing TS6133, see 42 deferred-items.md §3` (exactly as locked in deferred-items.md §3 — no alternative chosen)
- **Files modified:** `tests/main/image-worker-rotation.spec.ts`
- **Commit:** `1a8c18b`

No other deviations. The repoint itself is a pure mechanical specifier-string rename with ZERO logic change. No Rule 1/2/3/4 deviations were required. No auth gates occurred.

### Out-of-scope items correctly left untouched (per locked re-plan note v2)

- Gitignored scratch (`scripts/probe-*.ts` .gitignore:73, `scripts/diagnose-*.ts` .gitignore:74, `tests/_trace_tmp/` .gitignore:85) — naturally absent on a fresh clone / CI `npm ci`; NOT this plan's to fix (correctly not present in this worktree at all).
- The `typecheck:web` / `AnimationPlayerModal.tsx` / spine-player `Player.d.ts` 4.3-leak — Phase-47-owned (see the KNOWN-ITEM section above).
- `tests/main/sampler-worker-girl.spec.ts` (fixtures/Girl ENOENT — deferred-items.md §1) and `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` (fixtures/SAMPLER_ALPHA_ZERO ENOENT — deferred-items.md §2) — pre-existing local-only gitignored-rig absences, `skipIf(process.env.CI)`-guarded, explicitly excluded by the acceptance criterion; NOT a repoint regression.

## Commits

| Task | Commit | Type | Description |
|---|---|---|---|
| 1 | `cc5783f` (pre-existing, FROZEN — detected-and-skipped, NOT created by this plan) | feat | COMMIT B — RT-01 dual spine-core (4.3.0 canonical + spine-core-42 alias 4.2.111) |
| 2 | `1a8c18b` | fix | repoint 4.2 consumers onto the spine-core-42 nickname (15 files, ZERO logic change + locked TS6133 reconciliation) |

Phase-wide ordering A (`1b5327d`) → B (`cc5783f`, frozen) → repoint (`1a8c18b`) holds; `@esotericsoftware/spine-player` still `4.2.111`.

## Self-Check: PASSED

- `42-02-SUMMARY.md` — FOUND
- Modified files (`src/main/summary.ts`, `src/core/loader.ts`, `tests/main/image-worker-rotation.spec.ts`, +13 others) — FOUND
- `cc5783f` (frozen COMMIT B, detected-and-skipped) — FOUND in history
- `1a8c18b` (Task 2 repoint commit) — FOUND in history
- `1b5327d` (COMMIT A, ancestry parent) — FOUND in history
