---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
reviewed: 2026-05-16T22:55:00Z
depth: standard
scope: incremental (plan 42-05 gap-closure delta only)
files_reviewed: 3
files_reviewed_list:
  - tests/runtime/runtime-distinctness.spec.ts
  - .github/workflows/ci.yml
  - tests/safe01/safe01-freeze-guard.spec.ts
findings:
  blocker: 0
  warning: 2
  info: 3
  critical: 0
  total: 5
status: issues_found
note: >
  Incremental review of plan 42-05's three-file delta only. The prior
  full Phase 42 review (32 files, plans 42-01..42-04) is preserved in git
  history at commit 2b57348; those commits are FROZEN ancestry anchors and
  were NOT re-reviewed per scope instruction.
---

# Phase 42 (Plan 42-05 Gap-Closure): Incremental Code Review Report

**Reviewed:** 2026-05-16T22:55:00Z
**Depth:** standard
**Scope:** Incremental — plan 42-05 delta only (3 files)
**Files Reviewed:** 3
**Status:** issues_found (2 warnings, 3 info — no blockers)

## Summary

This is an incremental adversarial review of the plan 42-05 gap-closure
delta only: the restored RT-01 runtime-distinctness regression test, the
CR-01 D-09 hardening in `ci.yml`, and the matching CR-01 hardening in the
vitest freeze guard. Plans 42-01..42-04 are out of scope (frozen ancestry,
prior review preserved at 2b57348).

I traced every changed line, executed both touched/new test files
(`runtime-distinctness.spec.ts`: 4/4 pass; `safe01-freeze-guard.spec.ts`:
2/2 pass), and exercised the shell pickaxe and presence-guard failure
paths against the live repo. **The core CR-01 hardening is correct**: the
`--reverse | head -1` / `[0]` pivot genuinely selects the *oldest* pickaxe
hit (verified against real history — `cc5783f` is the sole introducing
commit), the presence guards fail loudly as designed, and the
shell/JS-injection surface is clean (all git invocations are
`execFileSync` argv-array or fixed YAML literals with zero user-controlled
interpolation). The distinctness assertions correctly read `version` from
the non-forgeable resolved `package.json` rather than a spoofable module
namespace.

No blockers. The findings below are robustness/consistency gaps that
weaken the *forward-fragility* protection the CR-01 hardening explicitly
set out to provide, plus one stale-comment defect introduced by the diff.

## Warnings

### WR-01: `ci.yml` D-09 still uses LAST-add (`tail -1`) for the baseline commit while the alias side was hardened to OLDEST-add — asymmetric robustness reintroduces the exact CR-01 fragility on the other operand

**File:** `.github/workflows/ci.yml:118`

**Issue:** The CR-01 hardening flipped the *alias* resolution from
`git log -S ... | tail -1` to the explicit-oldest
`git log --reverse -S ... | head -1` (line 121), with a comment
explicitly warning "do NOT rely on `tail -1` of an unordered-intent set".
But the immediately-adjacent *baseline* resolution on line 118 was left
unchanged:

```bash
BASE_COMMIT="$(git log --diff-filter=A --format=%H -- tests/safe01/baselines/_manifest.json | tail -1)"
```

`git log` default order is reverse-chronological (newest first), so
`| tail -1` here happens to yield the oldest `--diff-filter=A` (add)
entry *today* — but this is the precise pattern the CR-01 note condemns as
"oldest only while ... never churned". If `_manifest.json` is ever
deleted and re-added (a plausible future SAFE-01 rebaseline), `tail -1`
picks the *most recent* re-add, not the original introduction, silently
inverting the ancestry semantics (a later re-add can no longer be proven
to predate the alias commit, so a genuine violation could pass, or a
valid history could spuriously fail). The vitest-side freeze guard has the
identical asymmetry (see WR-02). This is a real forward-fragility hole
that the CR-01 hardening was specifically chartered to close on *both*
operands of the ancestry comparison, not just one.

**Fix:** Apply the same explicit-oldest idiom to the baseline side:

```bash
# OLDEST add of the manifest = the original baseline introduction,
# explicit (do NOT rely on `tail -1` of an unordered-intent set — CR-01,
# same rationale as the alias resolution below).
BASE_COMMIT="$(git log --reverse --diff-filter=A --format=%H -- tests/safe01/baselines/_manifest.json | head -1)"
```

(`--reverse` with `--diff-filter=A` lists adds oldest-first; `head -1` is
then unambiguously the original introduction regardless of later
delete/re-add churn.)

### WR-02: `safe01-freeze-guard.spec.ts` baseline resolution uses `.pop()` (LAST add) with a comment that now contradicts the code — same asymmetric-robustness gap as WR-01, plus a stale-comment defect introduced by this diff

**File:** `tests/safe01/safe01-freeze-guard.spec.ts:54-64`

**Issue:** Two coupled problems in the unchanged baseline block that the
42-05 diff left behind:

1. **Asymmetric robustness (mirror of WR-01).** The alias resolution was
   hardened to `--reverse` + `[0]` (line 76-85), but the baseline
   resolution still uses `git log --diff-filter=A` (default newest-first)
   piped through `.split('\n').filter(Boolean).pop()` — i.e. LAST element
   = newest add. Same delete+re-add inversion risk as WR-01.

2. **Stale/incorrect comment (defect introduced by this diff's
   neighborhood).** Line 54 reads:

   ```ts
   // OLDEST add (tail/.pop()) of the manifest — the original introduction,
   // robust against a later delete+re-add.
   const baselineCommit = sh([...]).split('\n').filter(Boolean).pop();
   ```

   The comment asserts `.pop()` yields the OLDEST add and is "robust
   against a later delete+re-add". That is precisely backwards: with
   `git log`'s default newest-first ordering, `.pop()` (last array
   element) is the OLDEST *only today*; after a delete+re-add it returns
   the NEWEST add and is the opposite of robust. The CR-01 hardening
   added the correct rationale to the *alias* block (lines 71-75:
   "`.pop()` is the oldest only while the literal is added exactly once
   and never churned") but left this directly-contradictory comment on
   the baseline block 20 lines above it. A future maintainer reading the
   two blocks side-by-side gets mutually-contradictory guidance about
   what `.pop()` does, and the wrong block is the one feeding the
   ancestry assertion's first operand.

**Fix:** Harden the baseline side symmetrically and correct the comment:

```ts
// OLDEST add of the manifest — the original introduction, taken
// EXPLICITLY via `--reverse` + first element ([0]), robust against a
// later delete+re-add (CR-01, same rationale as the alias block below;
// `git log` default order is newest-first, so `.pop()` would be the
// oldest ONLY while the manifest is never churned).
const baselineCommit = sh([
  'log',
  '--reverse',
  '--diff-filter=A',
  '--format=%H',
  '--',
  MANIFEST_REL,
])
  .split('\n')
  .filter(Boolean)[0];
```

## Info

### IN-01: CI grep presence-guard uses substring match — a hypothetical longer alias key (`spine-core-420`) would satisfy the guard while the pickaxe literal still targets `spine-core-42`

**File:** `.github/workflows/ci.yml:116` and `tests/safe01/safe01-freeze-guard.spec.ts:45`

**Issue:** Both presence guards test for the literal as an unanchored
substring (`grep -q "spine-core-42"` / `pkgJsonText.includes('spine-core-42')`).
The pickaxe (`git log -S 'spine-core-42'`) is *also* a substring match, so
the guard and the pickaxe are consistent with each other — this is not a
correctness bug today (the alias key is exactly `"spine-core-42"`,
verified the sole occurrence in package.json). Flagged as info only: if
the project ever introduces a sibling alias whose name contains
`spine-core-42` as a prefix (e.g. a future `spine-core-420`), the guard
would pass on the wrong dependency. Low likelihood given the naming
convention, but a quoted-key match (`'"spine-core-42"'`) would make both
the guard and the pickaxe precise and self-documenting.

**Fix:** Match the JSON key including its quotes in both sites, e.g.
`grep -q '"spine-core-42"' package.json` and
`pkgJsonText.includes('"spine-core-42"')`. (The pickaxe `-S` argument
could likewise be `'"spine-core-42"'` for symmetry, though that is
optional and outside this finding's necessity.)

### IN-02: `runtime-distinctness.spec.ts` top-level `console.log` (lines 82-101) runs unconditionally on every `npm run test` invocation, including the green-path CI run

**File:** `tests/runtime/runtime-distinctness.spec.ts:81-101`

**Issue:** The diagnostic `console.log` is intentional and well-reasoned
(the inline comment explains it surfaces a future upstream export rename
as a visible diff rather than a mystery `toBeUndefined` failure — a
legitimate forward-fragility aid). It is correctly eslint-suppressed.
Flagged as info, not warning, because it is a deliberate design choice
consistent with the file's stated purpose and matches the sanctioned
`tests/` diagnostic idiom. The only note: it executes at module-eval
time (outside any `it`), so it prints on *every* suite run regardless of
pass/fail, adding noise to the otherwise-quiet green CI log. If log
hygiene on the happy path is desired, move it inside a `beforeAll` or the
first `it` so vitest's reporter can group/suppress it; otherwise no
action needed — the trade-off (always-visible export surface) is
defensible as-is.

**Fix:** Optional — relocate the diagnostic into a `beforeAll(() => {...})`
within the `describe` block so it is associated with the suite lifecycle
and can be suppressed by reporter verbosity settings. No correctness
impact either way.

### IN-03: Stale parenthetical "(tail/.pop())" residue in the corrected-fix region — track alongside WR-02

**File:** `tests/safe01/safe01-freeze-guard.spec.ts:54`

**Issue:** Sub-item of WR-02, called out separately for fix-tracking
granularity: the parenthetical `(tail/.pop())` on line 54 is a
copy-paste artifact describing the *implementation mechanism* in a
comment that also makes a *semantic* claim ("OLDEST add"). Even after
WR-02's logic fix, ensure the mechanism parenthetical is removed rather
than mechanically updated — comments should state the invariant ("the
original introduction"), not narrate the array operation, which is the
exact pattern that produced this contradiction.

**Fix:** Covered by the WR-02 fix snippet (the replacement comment states
the invariant and the rationale without naming `.pop()`/`tail`). No
separate action.

---

## Verification performed

- Executed `npx vitest run tests/runtime/runtime-distinctness.spec.ts` → 4/4 pass.
- Executed `npx vitest run tests/safe01/safe01-freeze-guard.spec.ts` → 2/2 pass.
- Confirmed `--reverse -S 'spine-core-42' -- package.json` resolves to the
  single introducing commit `cc5783f` (CR-01 hardening is correct on the
  alias operand).
- Confirmed the presence-guard failure paths fire loudly (`grep -q` exit 1
  → `::error::` + `exit 1`; `!includes` → thrown `Error`).
- Confirmed the empty-pickaxe skip-with-reason path: `git log -S` with no
  hits exits 0 with empty stdout → `.filter(Boolean)[0]` is `undefined` →
  early `return` (vacuous-pass-before-alias-exists semantics preserved).
- Confirmed the tamper cross-check ancestry holds for the live manifest
  (`_meta.generatedCommit` `c5ef358` IS an ancestor of baseline `1b5327d`)
  — no spurious failure introduced.
- Shell/JS-injection: all git calls are `execFileSync` argv arrays or
  fixed YAML string literals; **no user-controlled interpolation** reaches
  any shell or git argument. Clean.
- Confirmed `tsconfig.node.json` `include` covers `tests/**/*.ts`, so the
  new spec is in the `typecheck:node` CI gate scope.

_Reviewed: 2026-05-16T22:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard (incremental — plan 42-05 delta only)_
