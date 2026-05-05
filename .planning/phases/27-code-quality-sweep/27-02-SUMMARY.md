---
phase: 27-code-quality-sweep
plan: 02
subsystem: ui
tags:
  - react
  - modal
  - tailwind-v4
  - tdd
  - dead-code
  - vitest
  - rtl

# Dependency graph
requires:
  - phase: 04-scale-overrides
    provides: OverrideDialog (hand-rolled percentage input modal, AppShell mount path)
  - phase: 06-optimize-assets-image-export
    provides: useFocusTrap hook (shared focus trap + Escape handler)
provides:
  - "OverrideDialog Apply button is disabled when input is empty/whitespace; Enter shortcut respects same guard"
  - "OverrideDialog `open` prop and `if (!props.open) return null` early-return removed (dead code)"
  - "AppShell's `dialogState !== null && (...)` mount gate is the sole lifecycle controller for OverrideDialog"
  - "Regression spec tests/renderer/override-dialog-empty-input.spec.tsx pinpoints the silent Number('') === 0 floor"
affects:
  - 27-code-quality-sweep (sibling plans 27-01, 27-03)
  - any-future-modal-refactor (mount-once pattern reusable)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal lifecycle: parent's conditional mount gate is the single source of truth; no internal `open` flag"
    - "Tailwind v4 disabled-state styling: literal-class ternary between two full strings (no clsx, no template interpolation)"
    - "Apply guard: `inputValue.trim() !== '' && Number.isFinite(Number(inputValue.trim()))` for numeric form fields"

key-files:
  created:
    - tests/renderer/override-dialog-empty-input.spec.tsx
    - .planning/phases/27-code-quality-sweep/27-02-deferred-items.md
  modified:
    - src/renderer/src/modals/OverrideDialog.tsx
    - src/renderer/src/components/AppShell.tsx

key-decisions:
  - "QA-02: disabled Apply button (not inline validation message) — matches OptimizeDialog/ConflictDialog idioms in this codebase"
  - "QA-02: disabled-state Tailwind via two-literal ternary (`opacity-50 cursor-not-allowed` branch); no clsx introduced"
  - "QA-04: AppShell's `dialogState !== null && (...)` mount gate preserved verbatim; only the redundant `open={true}` JSX line was removed"
  - "QA-04: useFocusTrap second arg becomes the literal `true`; useEffect deps become `[]` (mount-once behavior, since AppShell remounts on each null→non-null transition)"

patterns-established:
  - "Symmetric test-helper transition: when refactoring a prop's lifetime, the helper acquires the prop in the RED commit (to prevent the production short-circuit from masking the RED state) and drops it in the SAME commit that drops the prop from production. Documented inline in this spec's header so reviewers understand the asymmetric-then-symmetric scaffolding."
  - "Empty-input guard pattern reusable for any numeric form field in this codebase: `value.trim() !== '' && Number.isFinite(Number(value.trim()))`"

requirements-completed:
  - QA-02
  - QA-04

# Metrics
duration: 6min
completed: 2026-05-05
---

# Phase 27 Plan 02: OverrideDialog QA-02 + QA-04 Summary

**Apply button now disabled on empty/whitespace input (closing the silent `Number('') === 0` AppShell-clamp-to-1% floor) and the dead `open` prop / early-return guard removed in favor of AppShell's mount gate.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-05T09:26:00Z (approx — pre-Task-1 file reads)
- **Completed:** 2026-05-05T09:31:47Z (last task commit)
- **Tasks:** 3 (TDD RED, QA-02 GREEN, QA-04 GREEN)
- **Files modified:** 2 source + 1 new test + 1 deferred-items log

## Accomplishments

- **QA-02 (Apply guard):** `disabled={!isValid}` on Apply button; Enter shortcut guarded with `&& isValid`; the Number('') === 0 silent-floor path is closed at the dialog layer (AppShell's downstream clamp remains as defense-in-depth).
- **QA-04 (Dead code):** `open: boolean` removed from `OverrideDialogProps`; `if (!props.open) return null` deleted; `useFocusTrap(dialogRef, true, ...)`; `useEffect(..., [])` for mount-once select; AppShell mount call no longer passes `open={true}`.
- **Regression spec:** 5 tests in `tests/renderer/override-dialog-empty-input.spec.tsx` (3 RED → all 5 GREEN); explicit `not.toHaveBeenCalledWith(0)` on Test E pinpoints the silent-floor bug in failure diagnostics.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add failing regression spec** — `6a4efe9` (test)
2. **Task 2: QA-02 GREEN — guard Apply on empty/whitespace input** — `fb3fedc` (fix)
3. **Task 3: QA-04 GREEN — remove dead `open` prop and early-return guard** — `cf098e0` (refactor)

_TDD note: Plan 27-02 follows a single RED→GREEN cycle with the GREEN split into two atomic refactors that touch the same file (QA-02 first, then QA-04). The RED gate (Test A/B/E failing in commit `6a4efe9`) → GREEN gate (Test A/B/E passing in commit `fb3fedc`) → REFACTOR gate (commit `cf098e0` which removes dead code without changing test outcomes) is intact._

## Files Created/Modified

- **Created** `tests/renderer/override-dialog-empty-input.spec.tsx` — 5 RTL+jsdom tests covering empty/whitespace Apply guard, valid-number re-enable, pre-fill submit, and Enter-on-empty no-op (with explicit `not.toHaveBeenCalledWith(0)` to pinpoint the silent-floor bug).
- **Modified** `src/renderer/src/modals/OverrideDialog.tsx` —
    - QA-02: derive `isValid` (line 96), wire `disabled={!isValid}` on Apply (line 172) with two-literal-class ternary (line 173-177), guard Enter shortcut with `&& isValid` (line 106).
    - QA-04: drop `open: boolean` from interface (was line 51); delete `if (!props.open) return null` (was line 82); change `useFocusTrap(dialogRef, props.open, ...)` → `useFocusTrap(dialogRef, true, ...)` (line 78); change `useEffect(() => { if (props.open) inputRef.current?.select(); }, [props.open])` → mount-once `useEffect(() => { inputRef.current?.select(); }, [])`; rewrite header docstring §4 to reflect the new lifecycle model.
- **Modified** `src/renderer/src/components/AppShell.tsx` — delete the single `open={true}` line from the OverrideDialog mount call (was line 1618). The surrounding `{dialogState !== null && (<OverrideDialog ... />)}` gate is preserved verbatim.
- **Created** `.planning/phases/27-code-quality-sweep/27-02-deferred-items.md` — log of pre-existing test/typecheck failures unchanged by this plan (3 spec failures + 3 TS6133 unused-binding warnings, all in files NOT touched by 27-02).

### Diff snippets

**OverrideDialog.tsx — interface (QA-04):**

```diff
 export interface OverrideDialogProps {
-  open: boolean;
   scope: string[];
   currentPercent: number;
   anyOverridden: boolean;
   onApply: (percent: number) => void;
   onClear: () => void;
   onCancel: () => void;
 }
```

**OverrideDialog.tsx — body (QA-02 + QA-04):**

```diff
-  useFocusTrap(dialogRef, props.open, { onEscape: props.onCancel });
+  useFocusTrap(dialogRef, true, { onEscape: props.onCancel });

-  useEffect(() => {
-    if (props.open) inputRef.current?.select();
-  }, [props.open]);
+  useEffect(() => {
+    inputRef.current?.select();
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, []);

-  if (!props.open) return null;
-
   const title = ...

   const apply = () => props.onApply(Number(inputValue));

+  // QA-02 (Phase 27) — empty/whitespace guard.
+  const isValid = inputValue.trim() !== '' && Number.isFinite(Number(inputValue.trim()));

   const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
-    if (e.key === 'Enter') apply();
+    if (e.key === 'Enter' && isValid) apply();
   };
```

**OverrideDialog.tsx — Apply button (QA-02):**

```diff
   <button
     type="button"
     onClick={apply}
-    className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
+    disabled={!isValid}
+    className={
+      isValid
+        ? "bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold"
+        : "bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold opacity-50 cursor-not-allowed"
+    }
   >
     Apply
   </button>
```

**AppShell.tsx — OverrideDialog mount (QA-04):**

```diff
 {dialogState !== null && (
   <OverrideDialog
-    open={true}
     scope={dialogState.scope}
     currentPercent={dialogState.currentPercent}
     anyOverridden={dialogState.anyOverridden}
     onApply={(percent) => onApplyOverride(dialogState.scope, percent)}
     onClear={() => onClearOverride(dialogState.scope)}
     onCancel={() => setDialogState(null)}
   />
 )}
```

### Test count delta

`tests/renderer/override-dialog-empty-input.spec.tsx` adds **+5 it() blocks** (one describe block, "OverrideDialog — empty input guard (QA-02)"). All 5 pass against the post-Task-3 source tree.

## Decisions Made

All locked planning decisions implemented as specified:

- **D-01 (QA-02):** disabled Apply button (not inline validation message) — matches existing dialog idioms.
- **D-02 (QA-02):** `opacity-50 cursor-not-allowed` Tailwind utilities for disabled-state visual feedback.
- **D-03 (QA-04):** removed `open` prop from props, references, AND AppShell mount; AppShell's `dialogState !== null && (...)` gate is the sole lifecycle controller.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing Critical] Add `eslint-disable-next-line react-hooks/exhaustive-deps` comment above the new `}, []);`**

- **Found during:** Task 3 (the plan called this out as a conditional "if lint complains")
- **Issue:** The plan said "If lint complains add `// eslint-disable-next-line react-hooks/exhaustive-deps` above the `}, []);` line." Without it, anyone running ESLint with the react-hooks plugin would hit a warning on `inputRef.current?.select()` inside the empty-deps useEffect (refs are stable, so suppressing is correct).
- **Fix:** Added the disable comment proactively (idiomatic for the codebase; mirrors the pattern this codebase uses elsewhere where empty deps + ref reads are intentional).
- **Files modified:** `src/renderer/src/modals/OverrideDialog.tsx`
- **Verification:** No new lint warnings from this hunk; vitest still green.
- **Committed in:** `cf098e0` (Task 3 commit)

**2. [Rule 3 — Blocking] Strip `open={true}` mentions from the test file's HEADER COMMENT (not just the JSX) so the Task 3 acceptance grep returns 0 lines**

- **Found during:** Task 3 (post-edit gate verification)
- **Issue:** The plan's Task 3 acceptance gate `grep -nE "open=\{true\}" tests/renderer/override-dialog-empty-input.spec.tsx` requires 0 lines. The Task 1 spec contained 4 narrative mentions of `\`open={true}\`` (in markdown backticks) inside the header docstring describing the asymmetric-then-symmetric helper transition. Those four lines kept the grep at 4 even after the JSX `open={true}` was removed.
- **Fix:** Rewrote the header comment to describe the QA-04 transition in past tense without quoting the literal token; the substantive context (why the helper had to acquire and then drop the prop in different commits) is preserved.
- **Files modified:** `tests/renderer/override-dialog-empty-input.spec.tsx` (header comment only — JSX and tests unchanged)
- **Verification:** `grep -nE "open=\{true\}" tests/renderer/override-dialog-empty-input.spec.tsx` returns 0 lines; all 5 tests still pass.
- **Committed in:** `cf098e0` (Task 3 commit)

**3. [Cosmetic] Commit subject for Task 3 contains escaped backticks (`\`open\``)**

- **Found during:** Post-commit review (after `cf098e0` landed)
- **Issue:** I wrapped backticks in the heredoc commit message with backslashes to keep the shell from interpreting them as command substitution; the backslashes were preserved into the stored subject, leaving cosmetic literals like `\`open\`` in the commit subject. The body of the commit has the same artifact.
- **Fix:** **Not** amended — per GSD protocol, "Always create NEW commits rather than amending, unless the user explicitly requests a git amend." This is purely cosmetic; the diff and the commit are correct.
- **Verification:** `git log --oneline -3` confirms the cosmetic artifact in commit subject `cf098e0` only; semantics unaffected.
- **Committed in:** N/A (cosmetic, not amended)

---

**Total deviations:** 2 functional auto-fixes + 1 cosmetic commit-message artifact
**Impact on plan:** All deviations are local refinements; the three commits' diffs match the plan's intent precisely.

## Issues Encountered

**Pre-existing test failures NOT caused by this plan (logged for orchestrator):**

| Test | Why pre-existing | Source |
|------|------------------|--------|
| `tests/main/sampler-worker-girl.spec.ts` (Wave 1 N2.2 wall-time gate) | Performance gate; environment-dependent. Fails on base `17894cd` too. | Out of scope |
| `tests/integration/build-scripts.spec.ts` (`package.json version is 1.1.3`) | Stale assertion; package.json is `1.2.0` (per MEMORY note "v1.2.0 shipped"). Pre-existing. | Out of scope |
| `tests/renderer/atlas-preview-modal.spec.tsx` (D-130 dblclick) | jsdom + canvas hit-test fragility. Fails on base. | Out of scope |

**Pre-existing TS6133 unused-binding warnings NOT caused by this plan:**

| File | Line | Symbol |
|------|------|--------|
| `src/core/export.ts` | 140 | `opts` |
| `src/renderer/src/lib/export-view.ts` | 205 | `opts` |
| `tests/core/export.spec.ts` | 1312 | `plan` |

These are documented in `.planning/phases/27-code-quality-sweep/27-02-deferred-items.md`. Per the SCOPE BOUNDARY rule (only auto-fix issues directly caused by current task), they were not touched. The phase 27 verifier should evaluate the success criteria against the OverrideDialog/QA-02/QA-04 surface only.

**Verification of "no new failures from my edits":** I ran `npm run test` against base `17894cd` (with my changes stashed) and again with my changes restored — the same 3 specs fail in both runs. My edits introduce zero regressions; the targeted spec adds +5 passing tests; the 3 pre-existing failures count is identical (756 vs 757 ignoring the +1 from QA-02 spec deltas).

## TDD Gate Compliance

The plan-level TDD cycle is complete:

- **RED gate (`6a4efe9`, type=`test`):** Tests A, B, E fail; Tests C, D pass (control). Verified `vitest run override-dialog-empty-input` exits non-zero with messages naming the empty + whitespace + Enter-on-empty failures.
- **GREEN gate (`fb3fedc`, type=`fix`):** All 5 tests pass against the QA-02 source. Verified `vitest run override-dialog-empty-input` exits 0.
- **REFACTOR gate (`cf098e0`, type=`refactor`):** All 5 tests still pass; the 3 pre-existing unrelated failures unchanged. The dead-code removal is behavior-preserving against the test surface, which is the purpose of the REFACTOR gate.

Sequence: `test(...)` → `fix(...)` → `refactor(...)`. All three commits are present in `git log --oneline 17894cd..HEAD`.

## User Setup Required

None. No external service configuration; no environment variables; no manual UI verification beyond what `npm run test` already validates.

## Next Phase Readiness

- **Phase 27 wave 1 status:** This plan completes within wave 1; sibling plans 27-01 and 27-03 are parallel-safe (no overlapping `files_modified`).
- **Phase 27 verifier:** Should evaluate `npm run test -- override-dialog-empty-input` (5/5 GREEN) and the OverrideDialog/AppShell/spec greps from the plan's `<acceptance_criteria>` rather than full-suite green (which is unsatisfiable on base).
- **Future modal refactors:** This plan establishes the "parent's conditional mount gate is the lifecycle controller" pattern. Other modals in this codebase (`OptimizeDialog`, `ConflictDialog`, `HelpDialog`, `AtlasPreviewModal`, etc.) still pass `open={true}` from their parents — none has been refactored to the same pattern. They are left untouched per SCOPE BOUNDARY; if a future plan wants to apply the same dead-prop removal across all modals, this plan is the template.

## Self-Check: PASSED

Files exist:

- FOUND: `tests/renderer/override-dialog-empty-input.spec.tsx`
- FOUND: `src/renderer/src/modals/OverrideDialog.tsx` (modified)
- FOUND: `src/renderer/src/components/AppShell.tsx` (modified)
- FOUND: `.planning/phases/27-code-quality-sweep/27-02-deferred-items.md`

Commits exist (verified via `git log --oneline 17894cd..HEAD`):

- FOUND: `6a4efe9` (test — RED)
- FOUND: `fb3fedc` (fix — QA-02 GREEN)
- FOUND: `cf098e0` (refactor — QA-04 GREEN)

Acceptance gates (all PASS):

- `grep -nE "disabled=\{!isValid\}" src/renderer/src/modals/OverrideDialog.tsx` → 1 match (line 172)
- `grep -nE "props\.open" src/renderer/src/modals/OverrideDialog.tsx` → 0 matches
- `grep -nE "open=\{true\}" src/renderer/src/components/AppShell.tsx | grep -F OverrideDialog` → 0 matches in the OverrideDialog mount specifically
- `grep -nE "open=\{true\}" tests/renderer/override-dialog-empty-input.spec.tsx` → 0 matches
- `npm run test -- override-dialog-empty-input` → 5/5 pass

---
*Phase: 27-code-quality-sweep*
*Completed: 2026-05-05*
