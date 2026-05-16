---
phase: 42-pre-v1-6-4-2-baseline-npm-alias-boundary-scaffolding
plan: 01
subsystem: testing / regression-gate
tags: [SAFE-01, regression-baseline, canonical-json, git-ancestry, COMMIT-A, v1.6]
requires: []
provides:
  - "SAFE-01 4.2.111 byte-equal golden baseline (full SamplerOutput, 11 git-tracked fixtures)"
  - "tests/safe01/canonical-json.ts deterministic serializer (reusable test utility)"
  - "tests/safe01/discover-fixtures.ts auto-discovery (no hand-list)"
  - "D-09 machine-checked baseline-predates-alias freeze guard (skip-with-reason until RT-01)"
  - "tests/safe01/baselines/_manifest.json — the single git-ancestry-checked artifact"
affects:
  - "Plan 42-02 (RT-01 npm alias) — MUST commit as a git descendant of COMMIT A 4467d81"
  - "CI-01 (ci.yml) — will re-run the SAFE-01 gate + the bare git merge-base ancestry step"
tech-stack:
  added: []
  patterns:
    - "ignore-by-default + explicit redistributable allowlist (.gitignore — D-08-R/T-42-03)"
    - "string-sentinel non-finite serialization (NaN/Infinity/-0 never null/0)"
    - "skip-with-reason-until-artifact-exists git-history guard (arch.spec ENOENT precedent)"
key-files:
  created:
    - tests/safe01/canonical-json.ts
    - tests/safe01/canonical-json.spec.ts
    - tests/safe01/discover-fixtures.ts
    - tests/safe01/safe01-baseline.spec.ts
    - tests/safe01/safe01-enumeration.spec.ts
    - tests/safe01/safe01-freeze-guard.spec.ts
    - tests/safe01/baselines/_manifest.json
    - "tests/safe01/baselines/ (11 per-fixture canonical baseline JSONs)"
  modified:
    - .gitignore
decisions:
  - "Sidecars skeleton.json/skeleton2.json/SIMPLE_TEST_GHOST.json INCLUDED — they genuinely sample through 4.2.111 (predicate-decided, manifest-reviewed; not accidental)"
  - "Capture done via a temporary throwaway vitest spec (deleted pre-commit) — no committed regen script (D-09 anti-pattern avoided)"
  - ".gitignore uses deny-by-default + 12-entry allowlist (strongest T-42-03 mitigation: a heavy rig's local baseline can never be committed)"
metrics:
  duration: ~8 min
  completed: 2026-05-16
  tasks: 3
  files: 18 created + 1 modified
---

# Phase 42 Plan 01: SAFE-01 4.2 Byte Baseline (COMMIT A) Summary

Captured a deterministic, byte-equal golden snapshot of the full `SamplerOutput`
(globalPeaks + perAnimation + setupPosePeaks — D-06) for every git-tracked
in-repo fixture that samples through the **unchanged** spine-core 4.2.111
runtime, and committed it as **COMMIT A** — the git ancestor of the
not-yet-existing RT-01 npm-alias commit. A machine-checked freeze guard makes
"order is the acceptance test" (D-09) enforced by Git's own commit history, not
reviewer memory.

## What shipped

- **`canonical-json.ts`** — pure-Node test serializer (NEVER `core/`): Map →
  recursively sorted-key object; `NaN`/`Infinity`/`-Infinity`/`-0` → distinct
  string sentinels (never `null`/`0` — the T-42-04 silent-corruption guard);
  finite floats clamped to `Number(x.toPrecision(15))` for cross-OS stability;
  `_meta` provenance block first. Proven byte-deterministic by a 7/7 self-test
  (the Nyquist seam) **before** it gates anything.
- **`discover-fixtures.ts`** — auto-discovery (`globSync('fixtures/**/*.json')`
  + `loadSkeleton`→`sampleSkeleton` "samples OK" predicate). No hand-list:
  version-reject fixtures throw at `loadSkeleton` and are naturally excluded
  with a recorded reason. Two-tier git-tracked vs heavy via `git ls-files`.
- **11 committed canonical baselines + `_manifest.json`** (the single
  ancestry-checked artifact, with `_meta.generatedCommit`/`generatedAt`).
- **`safe01-baseline.spec.ts`** — strict full-JSON `toEqual` (D-07
  diagnosability, not a digest); `_meta` excluded as volatile provenance; **no
  env-gated regen branch** (D-09).
- **`safe01-enumeration.spec.ts`** — discovered git-tracked set == manifest
  (D-08 dropout-is-failure: a fixture that stops sampling fails loudly).
- **`safe01-freeze-guard.spec.ts`** — Assertion 1 `git merge-base
  --is-ancestor` (skips-with-reason now, alias absent; flips to hard-assert
  automatically when Plan 02 lands `spine-core-42` — no edit) + tamper
  cross-check; Assertion 2 hard no-regen meta-test (greps the baseline spec).
- **`.gitignore`** — deny-by-default for `tests/safe01/baselines/*.json` +
  explicit 12-entry redistributable allowlist (T-42-03: a heavy/proprietary
  rig's locally-written baseline can never be committed).

## The intentional included fixture set (`_manifest.json`)

11 git-tracked fixtures, all of which genuinely produce a successful
`SamplerOutput` through 4.2.111 (predicate-decided, reviewed once at capture):

| # | Fixture |
|---|---------|
| 1 | fixtures/Chicken-Min/Chicken-Min.json |
| 2 | fixtures/EXPORT_PROJECT/EXPORT.json |
| 3 | fixtures/INHERIT_TIMELINE/INHERIT_TEST.json |
| 4 | fixtures/SIMPLE_PROJECT_NO_ATLAS_MESH/MeshOnly_TEST.json |
| 5 | fixtures/SIMPLE_PROJECT_NO_ATLAS/SIMPLE_TEST.json |
| 6 | fixtures/SIMPLE_PROJECT/SIMPLE_TEST_GHOST.json |
| 7 | fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json |
| 8 | fixtures/SIMPLE_PROJECT/skeleton.json |
| 9 | fixtures/SIMPLE_PROJECT/skeleton2.json |
| 10 | fixtures/spine_rotated/EXPORT/skeleton.json |
| 11 | fixtures/spine_stripWS/EXPORT/skeleton.json |

**Excluded (by the predicate — no hand-list, exactly as D-08 designed):**

| Fixture | Reason (recorded by discover()) |
|---------|---------------------------------|
| fixtures/SPINE_3_8_TEST/SPINE_3_8_TEST.json | `SpineVersionUnsupportedError` (3.8.99 — below 4.2) at `loadSkeleton` |
| fixtures/SPINE_4_3_TEST/SPINE_4_3_TEST.json | `SpineVersionUnsupportedError` (4.3 strict-cut) at `loadSkeleton` |

**Sidecar decision:** `SIMPLE_PROJECT/skeleton.json`, `skeleton2.json`, and
`SIMPLE_TEST_GHOST.json` are INCLUDED because they genuinely sample through the
4.2.111 runtime (verified at capture). They are intentional members of the
frozen set, not accidental — the predicate decided, and the manifest was
reviewed once per the RESEARCH §Fixture Auto-Discovery sidecar note.

**Heavy/gitignored rigs:** none present in this worktree (they are gitignored
and absent on a fresh clone — exactly the D-08-R Option A two-tier design;
fresh-clone CI is deterministic and green on only the 11-fixture set).

## COMMIT A integrity (the load-bearing invariant)

- **COMMIT A HEAD:** `4467d81b7e719aff34b9ca6982a4f843f4d10ad7`
- **Manifest-introducing commit (the D-09 ancestry source):** `1b5327d`
- **Manifest `_meta.generatedCommit`:** `c5ef358` (an ancestor of `1b5327d` —
  the expected, untampered relationship; the tamper cross-check passes).
- **`package.json` still 4.2.111-only at COMMIT A** — verified: the combined
  diff `166523f..HEAD` touches **zero** `package.json` / `package-lock.json` /
  `src/core/**` files. Only `tests/safe01/**` + `.gitignore`. The npm alias is
  Plan 02's job and must land strictly AFTER this commit.
- **Freeze guard skipped-with-reason as designed** — the `spine-core-42`
  pickaxe on `package.json` is empty (alias absent in COMMIT A), so Assertion 1
  returns vacuously (ancestry vacuously satisfied) and will flip to a hard
  `git merge-base --is-ancestor` assertion automatically the instant Plan 02
  introduces the alias, with no edit to this file.

## Tests

- Full SAFE-01 suite: **4 files, 23 tests, all green**
  (`npx vitest run tests/safe01`).
- Full repo suite: 1238 passed, 22 skipped; 2 pre-existing failures unrelated
  to this plan (see Deferred Issues).
- `npm run typecheck`: SAFE-01 files clean (one pre-existing unrelated error —
  see Deferred Issues).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] No-regen docstring tripped its own freeze-guard meta-test**
- **Found during:** Task 2 (acceptance check), surfaced before Task 3 ran
- **Issue:** `safe01-baseline.spec.ts`'s docstring spelled out the literal
  tokens `UPDATE_FIXTURES` / `process.env` / `SHOULD_UPDATE` while explaining
  their deliberate absence. The Task 3 freeze guard greps the file SOURCE with
  `.not.toMatch(/UPDATE_FIXTURES|process\.env|SHOULD_UPDATE/)` — the prose would
  have FALSE-FAILED the D-09 no-regen meta-test (the guard checks source bytes,
  not authorial intent).
- **Fix:** Reworded the docstring to convey the same constraint without the
  literal trigger tokens; the no-regen grep is now clean and Assertion 2 passes
  hard. (No tests added — the existing freeze-guard meta-test IS the test.)
- **Files modified:** tests/safe01/safe01-baseline.spec.ts
- **Commit:** 1b5327d (folded into the Task 2 COMMIT-A commit before Task 3)

**2. [Rule 1 - Bug] merge-base/--is-ancestor split across array lines failed the AC grep**
- **Found during:** Task 3 acceptance check
- **Issue:** Task 3 AC requires `grep -cE "merge-base.*--is-ancestor" >= 1`
  (the machine-readable proof the topological primitive is present). My initial
  `execFileSync('git', ['merge-base','--is-ancestor', a, b])` placed each array
  element on its own line, so the single-line regex matched 0 — the D-09
  acceptance criterion would have been unverifiable by its own grep.
- **Fix:** Collapsed both `merge-base --is-ancestor` `execFileSync` calls onto
  one line each (with `// prettier-ignore`); grep count now 4. Behavior
  unchanged; 2/2 freeze-guard tests still pass.
- **Files modified:** tests/safe01/safe01-freeze-guard.spec.ts
- **Commit:** 4467d81

### Process note (not a code deviation)

Sandbox denied `rm` on the temporary capture spec; resolved by `mv`-ing it out
of the repo tree (`tests/safe01/_capture.spec.ts` was never committed — verified
absent from all four plan commits). The capture pattern (throwaway vitest spec,
deleted pre-commit) deliberately avoids creating a committed
`scripts/safe01-refresh-*.mjs` (the D-09 anti-pattern).

## Deferred Issues (out of scope — SCOPE BOUNDARY)

All pre-existing, NOT caused by this plan (which adds only `tests/safe01/**` +
a `.gitignore` rule). Logged in
`.planning/phases/42-.../deferred-items.md`:

1. `tests/main/sampler-worker-girl.spec.ts` — fails locally only (drives
   gitignored `fixtures/Girl/`; `it.skipIf(process.env.CI)` — green on CI).
2. `tests/core/sampler-skin-defined-unbound-attachment.spec.ts` — fails locally
   only (drives gitignored `fixtures/SAMPLER_ALPHA_ZERO/`;
   `describe.skipIf(process.env.CI)` — green on CI).
3. `tests/main/image-worker-rotation.spec.ts(190,13)` TS6133 `data` unused —
   verified verbatim at the plan base commit `166523f`; the only typecheck
   error; not a `tests/safe01/` file. Out of Phase 42 scope.

## TDD Gate Compliance

Task 1 followed RED→GREEN:
- RED: `0ccfbbf` `test(42-01): add failing canonical-JSON serializer self-test`
  (failed because `canonical-json.ts` did not exist — a true RED, not a
  passing-by-accident).
- GREEN: `c5ef358` `feat(42-01): implement deterministic canonical-JSON serializer`
  (7/7 self-test green).
- REFACTOR: not needed (implementation already minimal).

Both required gate commits present in git log.

## Commits

- `0ccfbbf` test(42-01): add failing canonical-JSON serializer self-test (RED)
- `c5ef358` feat(42-01): implement deterministic canonical-JSON serializer (GREEN)
- `1b5327d` feat(42-01): COMMIT A — SAFE-01 4.2 byte baseline captured BEFORE the npm alias
- `4467d81` feat(42-01): COMMIT A — SAFE-01 D-09 freeze guard (order is the acceptance test)

## Self-Check: PASSED

All 9 created files verified present on disk; all 4 commits verified present in
git history; the temporary `_capture.spec.ts` confirmed NEVER committed (0
occurrences across all history).
