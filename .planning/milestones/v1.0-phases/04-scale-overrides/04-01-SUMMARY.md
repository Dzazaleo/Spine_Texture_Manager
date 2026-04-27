---
phase: 04-scale-overrides
plan: 01
subsystem: core-math
tags: [override, clamp, apply-override, pure-ts, layer-3, inline-duplicate, parity-test, vitest]

requires:
  - phase: 00-core-math-spike
    provides: pure-TS core/ discipline and vitest readFileSync hygiene pattern established by bones.ts + bones.spec.ts + bounds.spec.ts
  - phase: 01-electron-react-scaffold
    provides: tests/arch.spec.ts Layer 3 defense — the `from ['"][^'"]*\/core\/|from ['"]@core` regex that forbids renderer files from importing core
  - phase: 02-global-max-render-source-panel
    provides: src/renderer/src/panels/GlobalMaxRenderPanel.tsx (the Scale cell that Plan 04-02 will teach to call applyOverride via the renderer copy)
  - phase: 03-animation-breakdown-panel
    provides: src/renderer/src/panels/AnimationBreakdownPanel.tsx (the D-69 disabled Override Scale button that Plan 04-03 will unlock)

provides:
  - clampOverride(percent) — silent integer-rounded clamp into [1, 100]; non-finite → 1 (D-79)
  - applyOverride(peakScale, overridePercent) — returns {effectiveScale, clamped}; effectiveScale uses clampOverride internally, clamped flag is raw-input `> 100` (D-82, D-84)
  - src/renderer/src/lib/overrides-view.ts — byte-identical renderer-side copy that unblocks Plans 04-02 + 04-03 without touching the Layer 3 arch grep
  - Parity test infrastructure (tests/core/overrides.spec.ts) that locks the two copies against drift via readFileSync + regex greps + 22 sampled inputs

affects:
  - 04-02 (AppShell clamp-on-Apply + GlobalMaxRenderPanel double-click to open dialog + override-aware Scale + Peak W×H cells) — consumes clampOverride + applyOverride from the renderer copy
  - 04-03 (AnimationBreakdownPanel override unlock + Scale cell double-click) — same renderer copy
  - Phase 6 export pipeline — will consume the canonical core copy directly (runs in the main process, no Layer 3 constraint)

tech-stack:
  added: []
  patterns:
    - "Layer 3 option-1 inline-duplicate pattern: one canonical pure-TS module under src/core/ plus a byte-identical renderer copy under src/renderer/src/lib/; a parity describe block in the matching tests/core/*.spec.ts asserts function-body byte-identity on sampled inputs + key-signature greps. First precedent in the project for sharing pure-TS math across the Layer 3 boundary without touching the arch grep."
    - "Grep-literal discipline pattern (continued from 01-01 Dev #4, 01-02 Dev #3/#4, 01-03 Dev #3, 02-01 Dev #3): describe the canonical module path in prose ('canonical source module', 'pure-TS math tree') rather than quoting the literal 'src/core/overrides' in docstrings, so the plan's own verify-greps pass without weakening the documentation."

key-files:
  created:
    - src/core/overrides.ts (88 lines, 2 exports, zero imports)
    - src/renderer/src/lib/overrides-view.ts (51 lines, 2 exports, zero imports)
    - tests/core/overrides.spec.ts (193 lines, 25 passing specs across 4 describe blocks)
    - .planning/phases/04-scale-overrides/deferred-items.md (logs the pre-existing TS2339 in scripts/probe-per-anim.ts)
  modified:
    - tsconfig.node.json (added `src/renderer/src/lib/**/*.ts` to include list — narrowly scoped to the pure-TS lib folder)

key-decisions:
  - "Layer 3 resolution option 1 (inline duplicate) chosen over option 2 (regex lookahead) and option 3 (move to src/shared/). Rationale: 6+4=10 lines of math; arch.spec.ts invariant stays intact; parity test + identical function bodies means the two copies cannot drift silently."
  - "Parity test uses readFileSync + regex greps (not AST compare) — matches the canonical tests/core/bounds.spec.ts and tests/arch.spec.ts pattern in this codebase, keeping the test discipline uniform across Phase 0-4."
  - "Spec collapses export-presence assertions into the hygiene describe block to respect the plan's grep acceptance criterion of exactly 4 top-level describe blocks — the grep-equality gate is load-bearing for CI traceability."
  - "tsconfig.node.json widen to include src/renderer/src/lib/**/*.ts (narrow, targeted) rather than relaxing any existing exclude — the lib folder is pure-TS by construction (no DOM types, no React) so it compiles clean under the node project's ES2022-only lib."

patterns-established:
  - "Layer 3 option-1 inline-duplicate: applies to any future pure-TS utility shared across the core/renderer boundary (e.g., future format helpers, unit-conversion math)."
  - "4-describe spec structure for pure-TS math modules: behavior × N × (function) + hygiene + parity. 25 specs total is the Phase 4 baseline; future phases can mirror."

requirements-completed:
  - F5.2

duration: 6m 33s
completed: 2026-04-24
---

# Phase 4 Plan 01: Override math module + Layer 3 inline-duplicate resolution Summary

**Pure-TS clamp + apply-override primitives (src/core/overrides.ts) with a byte-identical renderer copy (src/renderer/src/lib/overrides-view.ts), locked against drift by a 4-describe parity spec — unblocks Plans 04-02 + 04-03 without touching the tests/arch.spec.ts Layer 3 grep.**

## Performance

- **Duration:** 6m 33s
- **Started:** 2026-04-24T10:09:10Z
- **Completed:** 2026-04-24T10:15:43Z
- **Tasks:** 3
- **Files created:** 3 (core module, renderer copy, spec) + 1 (deferred-items log)
- **Files modified:** 1 (tsconfig.node.json include expansion)

## Accomplishments

- `clampOverride(percent)` and `applyOverride(peakScale, overridePercent)` now live in `src/core/overrides.ts` as pure-TS, zero-import primitives — the exact arithmetic backbone every Phase 4 feature (clamp-on-Apply, render-time effective-scale, Phase 6 export) is going to reuse.
- `src/renderer/src/lib/overrides-view.ts` exists with function bodies byte-identical to the canonical core module — Plans 04-02 and 04-03 can now import from the renderer copy locally without triggering the Layer 3 arch grep.
- `tests/core/overrides.spec.ts` (193 lines) ships 25 passing specs across exactly 4 describe blocks: 9 clampOverride behavior cases, 6 applyOverride behavior cases, 5 module-hygiene greps (N2.3 + D-75), and 5 parity-invariant assertions (sampled inputs on both copies + zero-imports check on both files + shared Number.isFinite guard signature + shared `> 100` clamped predicate signature). Any drift between the two copies now fails CI.
- Test suite grew 88 → 113 passed + 1 skipped (+25 new, exceeding the plan's +20 threshold). Both typecheck projects clean w.r.t. files this plan touched. `scripts/cli.ts` byte-identical (invariant check). `tests/arch.spec.ts` still 6/6 — renderer→core offenders list stays empty (the renderer copy is NOT an importer of core).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create src/core/overrides.ts — pure-TS clamp + apply-override math** — `f872a41` (feat)
2. **Task 2: Create src/renderer/src/lib/overrides-view.ts — inline renderer-side copy** — `bd802c3` (feat)
3. **Task 3: Create tests/core/overrides.spec.ts — behavior + hygiene + parity (+ tsconfig.node.json widen)** — `ee3e8ab` (test)

**Plan metadata commit:** (final commit below this summary, includes SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md updates).

## Files Created/Modified

- `src/core/overrides.ts` (CREATED, 88 lines) — canonical clampOverride + applyOverride. JSDoc header cites D-75 rationale + enumerates callers (AppShell, both panels, future Phase 6 export). Zero imports.
- `src/renderer/src/lib/overrides-view.ts` (CREATED, 51 lines) — byte-identical function bodies. JSDoc header cites the Layer 3 inline-duplicate resolution and the parity contract. Zero imports.
- `tests/core/overrides.spec.ts` (CREATED, 193 lines) — 25 specs across 4 describe blocks. Pattern analog: tests/core/bones.spec.ts (minimal spec shape) + tests/core/bounds.spec.ts lines 267-298 (richer hygiene block).
- `tsconfig.node.json` (MODIFIED) — added `src/renderer/src/lib/**/*.ts` to include so the spec's renderer-side import typechecks under the node project. No other include/exclude changes.
- `.planning/phases/04-scale-overrides/deferred-items.md` (CREATED) — logs the pre-existing `scripts/probe-per-anim.ts` TS2339 as out-of-scope.

## Decisions Made

- **Layer 3 resolution: option 1 (inline duplicate).** Considered options 2 (loosen arch.spec.ts with a whitelist lookahead) and 3 (move overrides to src/shared/); picked option 1 per the planner's recommendation because (a) the math is 10 lines total, (b) option 2 permanently carves a hole in a locked Phase 1/2/3 architectural invariant, (c) option 3 inverts the core-vs-shared convention established in Phase 1. The parity spec makes the duplication maintenance-safe.
- **Parity assertions use readFileSync + regex greps, not an AST/function-body-byte compare.** Rationale: matches the canonical project contract (tests/arch.spec.ts, tests/core/bounds.spec.ts, tests/core/bones.spec.ts all use readFileSync + regex). Uniform discipline; future agents recognize the shape instantly.
- **Export-presence assertions merged into the hygiene describe.** Rationale: the plan's acceptance criterion `grep -c "^describe(" === 4` is a grep-equality gate — cannot have 5 describe blocks. The export-presence `toMatch` checks live naturally in the hygiene block since they're also content greps on the module source.
- **tsconfig.node.json widened narrowly.** Included `src/renderer/src/lib/**/*.ts` specifically, not `src/renderer/**` — the lib folder is pure-TS by construction (no DOM, no React, DOM-free like all of core/), so it compiles clean under node's ES2022-only lib. The rest of the renderer tree (React components + JSX + DOM-typed code) stays excluded from the node project.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Grep-literal compliance in src/renderer/src/lib/overrides-view.ts docstring**
- **Found during:** Task 2 verification.
- **Issue:** The plan's `<action>` block instructed the docstring to cite the canonical module path literally ("byte-identical to src/core/overrides.ts"), but the plan's own `<verify>` automated command and `<acceptance_criteria>` forbid the literal string `core/overrides` and the regex `from.*core` in this file. First draft contained both tokens in prose ("src/core/overrides.ts", "from reaching into the src-slash-core directory", "parity describe block in tests/core/overrides.spec.ts"), which tripped the grep gate.
- **Fix:** Reworded prose to describe the relationship without the literal tokens — "canonical source module" instead of "src/core/overrides.ts"; "taking a dependency on the pure-TS math tree" instead of "from reaching into the src-slash-core directory"; "the matching test module (in the tests tree, under the overrides spec path)" instead of "tests/core/overrides.spec.ts". Function body and parity semantics unchanged.
- **Files modified:** `src/renderer/src/lib/overrides-view.ts` (docstring only).
- **Verification:** `grep -E "core/overrides|from.*core" src/renderer/src/lib/overrides-view.ts` returns empty; `grep -E "from ['\"]" src/renderer/src/lib/overrides-view.ts` returns empty; arch.spec 6/6 still green.
- **Committed in:** `bd802c3` (Task 2 commit).
- **Pattern class:** Same grep-literal self-consistency deviation as Phase 1 Plans 01-01 Dev #4, 01-02 Dev #3/#4, 01-03 Dev #3, and Phase 2 Plan 02-01 Dev #3. This appears to be a persistent executor hazard whenever plan verify-greps forbid tokens that the plan's action prose wants to cite.

**2. [Rule 3 - Blocking] tsconfig.node.json include missed `src/renderer/src/lib/`**
- **Found during:** Task 3 verification (`npx tsc --noEmit -p tsconfig.node.json` after spec creation).
- **Issue:** `tests/core/overrides.spec.ts` imports both `../../src/core/overrides.js` (canonical) and `../../src/renderer/src/lib/overrides-view.js` (renderer copy) so the parity describe block can exercise both. The spec is covered by `tsconfig.node.json` (which includes `tests/**/*.ts`), but the renderer copy lives under `src/renderer/`, which was previously excluded from the node project entirely. TypeScript emitted TS6307 "File is not listed within the file list of project tsconfig.node.json".
- **Fix:** Added `"src/renderer/src/lib/**/*.ts"` to `tsconfig.node.json` include array — narrowly scoped to the pure-TS `lib/` folder. The rest of `src/renderer/` (React components + JSX + DOM-dependent code) remains out of the node project. Layer 3 arch.spec invariant is UNAFFECTED because arch.spec scans `src/renderer/**` for `from '.../core/'` imports, not for which tsconfig project covers which folders.
- **Files modified:** `tsconfig.node.json` (include array only, one line added).
- **Verification:** `npx tsc --noEmit` on both projects clean w.r.t. my files (only pre-existing unrelated TS2339 in `scripts/probe-per-anim.ts` remains — logged to deferred-items.md). `tests/arch.spec.ts` 6/6. `npm run test` 113 passed + 1 skip.
- **Committed in:** `ee3e8ab` (Task 3 commit, alongside the spec itself).
- **Pattern class:** This is the first instance in the project where a spec under `tests/core/` legitimately needs to import a file under `src/renderer/`. The Layer 3 option-1 inline-duplicate pattern inherently creates this cross-tree dependency (the parity test has to reach both copies). Future Layer 3 option-1 applications will need the same `tsconfig.node.json` include — document this as part of the pattern.

---

**Total deviations:** 2 auto-fixed (1 Rule 1 grep-hygiene, 1 Rule 3 blocking tsconfig include).
**Impact on plan:** Both auto-fixes required by the plan's own gates — neither changed scope, added dependencies, or altered architectural invariants. The grep-literal rewrite preserved the Layer 3 parity documentation exactly; the tsconfig include widen is narrowly scoped to the pure-TS `lib/` subtree.

## Issues Encountered

- None beyond the two deviations above. Behavior cases all passed first time; byte-parity diff empty on both function bodies; arch.spec.ts unchanged.

## User Setup Required

None — no external service configuration needed. (Plan frontmatter `user_setup: []` confirmed.)

## Next Phase Readiness

**Plan 04-02 (Global panel clamp-on-Apply + render-time effective-scale) unblocked.** The renderer can now call `import { clampOverride, applyOverride } from '../../lib/overrides-view.js'` from anywhere under `src/renderer/src/` without tripping the Layer 3 arch grep. The parity spec ensures that any future drift between the canonical and renderer copies fails CI before it hits production.

**Plan 04-03 (Animation Breakdown panel override unlock) unblocked.** Same renderer-copy-import path works for `AnimationBreakdownPanel.tsx` — the D-69 disabled button can now receive an `onClick` that routes through `onOpenOverrideDialog` and the override-aware Scale cell can reuse `applyOverride` locally.

**Phase 6 export pipeline (future phase) unblocked.** The canonical `src/core/overrides.ts` can be imported directly by main-process code — that's the primary Phase 6 consumer, running in the Node electron-main context where Layer 3 does not apply.

**Downstream caveats:**
- Any future edit to `clampOverride` or `applyOverride` body MUST touch both copies in the same commit or the parity spec will fail. The matching `Number.isFinite(...)` regex and the `overridePercent > 100` regex in the spec are deliberately strict to catch even subtle behavior drift.
- The Layer 3 option-1 pattern now has a concrete precedent. Future pure-TS utilities shared across the boundary should follow the same recipe: canonical module under `src/core/`, byte-identical renderer copy under `src/renderer/src/lib/`, parity describe block in the matching `tests/core/*.spec.ts`, and include-widen to `tsconfig.node.json` for the renderer copy path.

## Self-Check: PASSED

Verified artifacts:
- `src/core/overrides.ts` — FOUND (88 lines, 2 named exports, zero imports).
- `src/renderer/src/lib/overrides-view.ts` — FOUND (51 lines, 2 named exports, zero imports, function bodies byte-identical to canonical via `awk` + `diff`).
- `tests/core/overrides.spec.ts` — FOUND (193 lines, 25 passing specs, 4 describe blocks).
- `tsconfig.node.json` — MODIFIED (include array expanded by one entry).
- `.planning/phases/04-scale-overrides/deferred-items.md` — FOUND (logs pre-existing unrelated TS2339).

Verified commits:
- `f872a41` — FOUND in `git log --oneline --all`.
- `bd802c3` — FOUND.
- `ee3e8ab` — FOUND.

All Task 1, Task 2, Task 3 `<acceptance_criteria>` plus `<verification>` items pass:
- `npx tsc --noEmit` clean on both projects w.r.t. files touched by this plan (pre-existing `scripts/probe-per-anim.ts` TS2339 deferred).
- `npm run test` → **113 passed + 1 skip** (baseline 88 + 25 new).
- `npm run test -- tests/arch.spec.ts` → 6/6 passed (Layer 3 intact).
- `grep -rE "from ['\"][^'\"]*\/core\/" src/renderer/` → empty (Layer 3 invariant).
- `git diff --quiet HEAD -- scripts/cli.ts` → exit 0 (cli.ts untouched).

---
*Phase: 04-scale-overrides*
*Completed: 2026-04-24*
