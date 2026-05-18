---
phase: 46-slider-constraint-validation-4-3-performance-budget
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - tests/runtime43/slider43-closedform.spec.ts
  - tests/runtime43/baseline-driver.ts
  - tests/main/sampler-worker-spineboy43.spec.ts
  - tests/safe01/discover-fixtures.ts
  - fixtures/SLIDER_4_3/NOTES.txt
findings:
  critical: 0
  warning: 2
  info: 3
  total: 5
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 46 is a test-only/fixture phase. The adversarial review confirms the
machine-asserted SC#2 invariant holds: `git diff --name-only 1a2016f..HEAD --
src/core/` returns empty, and the only changed source/fixture files are under
`tests/`, `fixtures/SLIDER_4_3/`, and `fixtures/spineboy_4.3/`. No production
`src/core/` or `src/main/` code was added. The hand-derived closed-form
oracle (`peak == 4.0`) was independently re-derived against the actual
`fixtures/SLIDER_4_3/SLIDER-01.json` (constraint `drive`: slider, scale 0.005,
local; `scale` anim keys scaleX/Y 1->4 over 1s; `slide` anim keys x 0->200
over 1s) and against `node_modules/@esotericsoftware/spine-core@4.3.0`
`dist/Slider.js` `update()` — the derivation is sound. The `execFileSync('git',
[...])` calls use the arg-array form with no shell interpolation: no command
injection. The PERF-01 gate is correctly CI-enabled with a hardcoded integer
`BUDGET` and no `skipIf`. The spineboy-pro fixture stats (4.3.01, 67/52/11/14)
match the spec comment exactly.

Two robustness defects warrant fixing: (1) the `NOTES.txt` scaleX regex
matches the wrong token by accident and is fragile against routine owner
edits, and (2) the SC#2 git scope-check is commit-range-only and is blind to
uncommitted `src/core/` edits, weakening the invariant proof it claims to
machine-assert. Three info items cover dead code and a confusing-failure
diagnostic.

## Warnings

### WR-01: NOTES.txt scaleX regex matches the wrong token by accident; fragile against owner edits

**File:** `tests/runtime43/slider43-closedform.spec.ts:60`
**Issue:**
The parser regex is `/scale\s*x[^0-9-]*(-?[0-9]+(?:\.[0-9]+)?)/i`. Run against
the committed `fixtures/SLIDER_4_3/NOTES.txt`, the JS `String.match` does NOT
anchor on the intended machine-extractable data line 15
(`slider_bone world scaleX = 4.000 ...`). It matches at index 760 — the
**prose** occurrence of `scaleX` on line 13
(`...the SLIDER-02 D-05 arm parses scaleX from here):`). The `[^0-9-]*`
negated character class matches newlines, so it spans
`scaleX from here):\n\n  slider_bone world ` and captures the first digit run
it reaches, which coincidentally is the real `4.000`.

The captured value is correct today only because the next number after the
first `scale x`/`scaleX` token in the file is the real data value. This is
accidental, not by design. Concrete failure modes proven by probing the exact
JS regex:

- Owner adds any digit-bearing prose between the first `scaleX` token and the
  data line (e.g. "scaleX tolerance is 1e-2.\n  slider_bone world scaleX =
  4.000") → regex captures `1`, the `toBeLessThan(1e-2)` triangulation arm
  fails with a misleading message that blames the editor read, not the parser.
- Owner phrases the data line as "scaleX-axis" or "X-axis scale" with a `-`
  adjacent → the `-?` negative-sign handling and `[^0-9-]*` interact to
  capture a wrong/partial number.

A test whose data extraction depends on no digit appearing in the surrounding
prose is a latent verification-integrity hole — the exact failure class the
file's own header (lines 42-47) says it is defending against.

**Fix:** Anchor the parse on the documented machine-extractable line shape and
exclude prose. Match per-line on the explicit `slider_bone world scaleX = N`
form rather than a free-floating `scale x` scan:

```ts
// Match the documented machine-extractable line, not any prose 'scaleX'.
const m = txt.match(
  /slider_bone\s+world\s+scale\s*x\s*=\s*(-?[0-9]+(?:\.[0-9]+)?)/i,
);
```

If the owner-line format must stay flexible, restrict the gap class to
non-newline non-digit (`[^\n0-9-]*`) and require the token to be immediately
followed by an `=`/`:` so a bare prose `scaleX` cannot match:

```ts
const m = txt.match(/scale\s*x\s*[=:]\s*(-?[0-9]+(?:\.[0-9]+)?)/i);
```

Either form makes the throw-on-unparseable guard meaningful instead of
silently extracting a coincidentally-adjacent number.

### WR-02: SC#2 git scope-check is commit-range-only — blind to uncommitted src/core/ changes

**File:** `tests/runtime43/slider43-closedform.spec.ts:160-173`
**Issue:**
The second it-block machine-asserts the SLIDER-02 SC#2 invariant ("this phase
adds ZERO slider-specific src/core/ code") via
`git diff --name-only 1a2016f..HEAD -- src/core/`. The `A..HEAD` form compares
only committed history. It does NOT detect:

- staged-but-uncommitted `src/core/` edits (`git diff --cached`),
- working-tree-modified tracked `src/core/` files (`git diff` with no range),
- untracked new files under `src/core/` (`git status --porcelain`).

An executor running the suite mid-edit with uncommitted slider code in
`src/core/` would see this assertion **pass green** while the invariant it
exists to prove is actually violated until the next commit. The test claims to
be a "machine-checked structural fact" that "the absence of slider code IS the
deliverable"; an invariant proof that a half-finished local edit can defeat is
weaker than its own docstring asserts. (The current tree is clean, so this is
a robustness/proof-strength defect, not an active failure.)

**Fix:** Also assert the working tree and index are clean for `src/core/`, so
the proof cannot be defeated by uncommitted state:

```ts
const committed = execFileSync(
  'git',
  ['diff', '--name-only', PHASE_46_BASE_SHA + '..HEAD', '--', 'src/core/'],
  { cwd: REPO_ROOT, encoding: 'utf8' },
).split('\n').map(s => s.trim()).filter(Boolean);

// Also catches staged/working-tree/untracked src/core/ edits the
// commit-range diff is blind to.
const dirty = execFileSync(
  'git',
  ['status', '--porcelain', '--', 'src/core/'],
  { cwd: REPO_ROOT, encoding: 'utf8' },
).split('\n').map(s => s.trim()).filter(Boolean);

expect([...committed, ...dirty], 'Phase 46 must not modify any src/core/ ...').toEqual([]);
```

## Info

### IN-01: Unreachable null-guard dead code in buildLoadXtra

**File:** `tests/runtime43/baseline-driver.ts:290-297`
**Issue:**
`pickRuntime` is typed `pickRuntime(tag: RuntimeTag): SpineRuntime`
(non-nullable) and its documented contract is "Never silently return null...
this throws loudly" (`src/core/runtime/runtime.ts:207-209`). The guard
`if (rt == null) { throw new Error("...pickRuntime('4.3') returned null...") }`
is therefore statically unreachable — `pickRuntime` either returns a
`SpineRuntime` or throws before the assignment completes. This is harmless
defensive code but it is dead, and its error message describes a state that
cannot occur, which can mislead future debugging. (Note: `buildLoadXtra` still
legitimately returns `null` via `resolveRigFiles` for genuine Wave-0
fixture-absence, and the `built == null` skip in
`slider43-closedform.spec.ts:75-82` correctly covers that real path — only the
`rt == null` branch is dead.)

**Fix:** Drop the unreachable branch (the type system + `pickRuntime`'s own
throw already enforce non-null), or add a brief comment marking it as a
defense-in-depth no-op so readers do not treat it as a reachable contract.

### IN-02: Diagnostic divides by a hardcoded foreign-rig magic number (606)

**File:** `tests/main/sampler-worker-spineboy43.spec.ts:111` (also `:104`, `:48-52`)
**Issue:**
The diagnostic `console.log` computes `(elapsed/606).toFixed(2)` against the
4.2 Girl reference rig's 606 ms. `606` is a bare magic number repeated in the
log string, the `BUDGET` derivation comment, and the assertion message. The
comment is explicit that this ratio is "descriptive only — NOT a pass/fail
gate", so this is not a correctness issue, but the unlabeled literal in
executable code (not just a comment) is a maintainability smell — a future
reader cannot tell from line 111 alone what 606 is.

**Fix:** Hoist to a named constant alongside `BUDGET`, e.g.
`const REF_42_GIRL_MS = 606; // Phase-9 N2.2 4.2 reference rig — descriptive
ratio only, NOT a gate (D-08)` and interpolate it.

### IN-03: Wave-0 skip uses `expect(true).toBe(true)` placeholder assertion

**File:** `tests/runtime43/slider43-closedform.spec.ts:80`
**Issue:**
The genuine Wave-0 fixture-absence branch returns after
`expect(true).toBe(true)`. A tautological assertion makes the test report as
"passed" when it actually performed no verification, which can mask a silently
absent fixture in CI summaries. (`fixtures/SLIDER_4_3/` is committed and the
branch is currently unreachable in practice, so this is style/clarity only.)

**Fix:** Prefer an explicit skip so the runner reports the no-op honestly,
e.g. `it.skip`-routing via a guarded `ctx.skip()` (vitest test context) or at
minimum a comment-backed `expect(built, 'Wave-0: SLIDER_4_3 rig
absent').toBeNull()` so the assertion documents intent rather than asserting a
constant truth.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
