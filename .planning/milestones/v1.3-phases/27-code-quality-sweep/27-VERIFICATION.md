---
phase: 27-code-quality-sweep
verified: 2026-05-05T10:50:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
---

# Phase 27: Code Quality Sweep — Verification Report

**Phase Goal:** Four v1.0-era code-quality carry-forwards (QA-01, QA-02, QA-03, QA-04) resolved with **no functional behavior change** — stale-closure risk on fast selection events eliminated, empty override input guarded, numeric sort ordering corrected in the panel display sort, and the dead `open` prop removed from `OverrideDialog`.

**Verified:** 2026-05-05T10:50:00Z
**Status:** passed
**Re-verification:** No — initial verification.

---

## Goal Achievement

### Observable Truths

| #   | Truth (ROADMAP §Phase 27 Success Criterion)                                                                                                                              | Status     | Evidence                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | QA-01: `handleToggleRow` + `handleRangeToggle` use functional `setSelected(prev => ...)`; rapid keyboard selection produces correct cumulative selection.                | ✓ VERIFIED | `setSelected((prev)` appears 4× at panel lines 773, 793, 806, 816 (1 toggle + 3 range branches). Closure form `setSelected(new Set …)` returns 0 lines. SelectAllCheckbox preserved (`onBulk(next)` at line 592). Regression spec `tests/renderer/global-max-functional-setselected.spec.tsx` GREEN (3/3).                                                                                       |
| 2   | QA-02: Apply disabled when input empty; submitting empty no longer floors via `Number('') = 0`.                                                                           | ✓ VERIFIED | `disabled={!isValid}` at OverrideDialog.tsx:182. `isValid = inputValue.trim() !== '' && Number.isFinite(...)` at line 106. Enter shortcut guarded `e.key === 'Enter' && isValid` at line 116. Regression spec `tests/renderer/override-dialog-empty-input.spec.tsx` GREEN (5/5) — includes explicit `not.toHaveBeenCalledWith(0)` test pinpointing the silent-floor bug.                              |
| 3   | QA-03: `localeCompare` sort comparators pass `{ sensitivity: 'base', numeric: true }`; CHAIN_10 sorts after CHAIN_9.                                                      | ✓ VERIFIED | 3 occurrences of options object in `GlobalMaxRenderPanel.tsx` at lines 255 (attachmentName), 257 (skinName), 259 (animationName). Regression spec `tests/renderer/locale-compare-numeric-sort.spec.tsx` GREEN (2/2) — verifies natural-order render via `tbody td:nth-child(3)`.                                                                                                                |
| 4   | QA-04: `open` prop and `if (!props.open) return null` guard removed from `OverrideDialog`; AppShell mount is the sole lifecycle controller.                                | ✓ VERIFIED | `OverrideDialogProps` (line 55) has 6 fields, no `open`. `props.open` returns 0 lines. `if (!props.open) return null` returns 0 lines. `useFocusTrap(dialogRef, true, ...)` at line 78. AppShell `<OverrideDialog>` mount (lines 1616-1625) wrapped in `{dialogState !== null && (...)}`; `open={true}` removed from this site (other AppShell modals' `open={true}` are out of QA-04 scope). |

**Score:** 4/4 truths verified.

---

### Required Artifacts

| Artifact                                                              | Expected                                                                       | Exists | Substantive | Wired | Data Flows | Status     |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------ | ----------- | ----- | ---------- | ---------- |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx`                    | Functional updaters + numeric `localeCompare` (display sort)                   | ✓      | ✓           | ✓     | ✓          | ✓ VERIFIED |
| `src/renderer/src/modals/OverrideDialog.tsx`                          | Empty-input guard; no dead `open` prop                                         | ✓      | ✓           | ✓     | ✓          | ✓ VERIFIED |
| `src/renderer/src/components/AppShell.tsx`                            | `<OverrideDialog>` mount with `open={true}` removed                            | ✓      | ✓           | ✓     | ✓          | ✓ VERIFIED |
| `tests/renderer/global-max-functional-setselected.spec.tsx`           | Regression spec — closure-vs-functional handler harness + real-panel control   | ✓      | ✓           | n/a   | n/a        | ✓ VERIFIED |
| `tests/renderer/override-dialog-empty-input.spec.tsx`                 | Regression spec — empty/whitespace Apply guard + Enter on empty + pre-fill     | ✓      | ✓           | n/a   | n/a        | ✓ VERIFIED |
| `tests/renderer/locale-compare-numeric-sort.spec.tsx`                 | Regression spec — CHAIN_2 < CHAIN_10 in rendered panel                         | ✓      | ✓           | n/a   | n/a        | ✓ VERIFIED |

---

### Key Link Verification

| From                                                                                  | To                                                       | Via                                                                              | Status     | Details                                                                                                            |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ |
| `GlobalMaxRenderPanel.handleToggleRow` (line 770)                                      | `setSelected` updater                                    | `(prev) => { const next = new Set(prev); ... return next; }`                     | ✓ WIRED    | Line 773: `setSelected((prev) => {`. useCallback deps = `[]`.                                                      |
| `GlobalMaxRenderPanel.handleRangeToggle` (3 branches)                                  | `setSelected` updater                                    | Same functional form, `targetSelected = !prev.has(key)` derived inside updater   | ✓ WIRED    | Lines 793, 806, 816 — all three branches use functional form. useCallback deps = `[lastClicked, visibleKeys]`.    |
| OverrideDialog Apply button (line 180)                                                 | input validity check                                     | `disabled={!isValid}` + class ternary on `isValid`                                | ✓ WIRED    | `disabled={!isValid}` at line 182; class branches at lines 183-187 with `opacity-50 cursor-not-allowed`.           |
| OverrideDialog Enter shortcut (line 115)                                               | `apply()`                                                | `if (e.key === 'Enter' && isValid) apply();`                                     | ✓ WIRED    | Line 116. Empty/whitespace input no longer triggers `apply()`.                                                     |
| AppShell.tsx OverrideDialog mount                                                     | `OverrideDialogProps` (no `open` field)                  | Conditional mount via `dialogState !== null && (<OverrideDialog ... />)`         | ✓ WIRED    | Lines 1616-1625; `open={true}` removed; 6 props passed (scope, currentPercent, anyOverridden, onApply, onClear, onCancel). |
| `compareRows` 3 string-comparator branches                                             | Intl-aware comparison (display sort only)                | `String.prototype.localeCompare(other, undefined, { sensitivity: 'base', numeric: true })` | ✓ WIRED    | Lines 255, 257, 259.                                                                                                |

---

### Data-Flow Trace (Level 4)

| Artifact                                            | Data Variable    | Source                                                       | Produces Real Data | Status      |
| --------------------------------------------------- | ---------------- | ------------------------------------------------------------ | ------------------ | ----------- |
| `GlobalMaxRenderPanel.tsx` selected-row state        | `selected: Set`  | User click/keyboard via `handleToggleRow`/`handleRangeToggle` | Yes — functional updater reads `prev` | ✓ FLOWING   |
| `OverrideDialog.tsx` `isValid` derivation            | `inputValue`     | `useState(String(props.currentPercent))` + onChange handler  | Yes — actual user input drives validity | ✓ FLOWING   |
| `compareRows` table render output                    | `EnrichedRow[]`  | `sortRows(rows, col, dir)` → `rows.slice().sort(...)`        | Yes — display sort feeds tbody render | ✓ FLOWING   |

All three artifacts flow real data. No HOLLOW or DISCONNECTED nodes.

---

### Behavioral Spot-Checks

| Behavior                                                                           | Command                                                                                                       | Result        | Status |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------- | ------ |
| QA-01 regression spec passes                                                       | `npx vitest run tests/renderer/global-max-functional-setselected.spec.tsx`                                    | 3/3 GREEN     | ✓ PASS |
| QA-02 regression spec passes                                                       | `npx vitest run tests/renderer/override-dialog-empty-input.spec.tsx`                                          | 5/5 GREEN     | ✓ PASS |
| QA-03 regression spec passes                                                       | `npx vitest run tests/renderer/locale-compare-numeric-sort.spec.tsx`                                          | 2/2 GREEN     | ✓ PASS |
| All three QA specs combined run                                                     | `npx vitest run tests/renderer/{global-max-functional-setselected,override-dialog-empty-input,locale-compare-numeric-sort}.spec.tsx` | 10/10 GREEN  | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan         | Description                                                                                                          | Status      | Evidence                                                                                       |
| ----------- | ------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| QA-01       | 27-01               | Functional `setSelected` updater on `handleToggleRow` + `handleRangeToggle`                                          | ✓ SATISFIED | 4× `setSelected((prev)` at panel lines 773/793/806/816; spec GREEN.                            |
| QA-02       | 27-02               | OverrideDialog Apply disabled on empty/whitespace input                                                              | ✓ SATISFIED | `disabled={!isValid}` line 182; `isValid` derivation line 106; Enter guard line 116; spec GREEN. |
| QA-03       | 27-03               | `localeCompare` opts `{ sensitivity: 'base', numeric: true }` on display-sort comparators                            | ✓ SATISFIED | 3 occurrences in `GlobalMaxRenderPanel.tsx` at compareRows; spec GREEN.                        |
| QA-04       | 27-02               | `open` prop + early-return guard removed from OverrideDialog                                                          | ✓ SATISFIED | `props.open` 0 hits; `if (!props.open)` 0 hits; AppShell mount `open={true}` deleted from line 1617 site; useFocusTrap takes literal `true`. |

No orphaned requirements. No deferred/blocked items in the QA-NN scope.

---

### Determinism Boundary (D-125) Verification

The phase explicitly preserved the preview↔export byte-identical invariant by **not** touching the determinism-bound files. Verified:

```
$ git diff --name-only main..HEAD -- src/core/ src/renderer/src/lib/atlas-preview-view.ts src/renderer/src/lib/export-view.ts
(empty — confirms zero edits)
```

| File                                                  | Bare `localeCompare(arg)` calls preserved? | `{ sensitivity: 'base', numeric: true }` leaked? | Status     |
| ----------------------------------------------------- | ------------------------------------------ | ------------------------------------------------ | ---------- |
| `src/renderer/src/lib/atlas-preview-view.ts`           | 2 (lines 84, 85 — packer input ordering)   | 0                                                | ✓ PRESERVED |
| `src/renderer/src/lib/export-view.ts`                  | 3 (lines 361, 362, 364 — export-plan rows + passthroughCopies + excludedUnused) | 0 | ✓ PRESERVED |
| `src/core/atlas-preview.ts` / `src/core/export.ts` / `src/core/analyzer.ts` | unchanged (`git diff` empty) | 0 | ✓ PRESERVED |

**D-125 (preview↔export byte-identical) invariant is preserved.** The QA-03 fix is correctly scoped to the `GlobalMaxRenderPanel.compareRows` display sort only — its output feeds `sortRows` → table render and never crosses a packer or export-plan determinism boundary. The renderer-view mirrors of `src/core/*` byte-deterministic comparators kept the bare `localeCompare(a)` form intact.

---

### Anti-Patterns Found

None within the QA-01..QA-04 scope.

| File                                              | Line | Pattern                                                                  | Severity | Impact                                                                |
| ------------------------------------------------- | ---- | ------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------- |
| `src/renderer/src/components/AppShell.tsx`        | various | `open={true}` on `OptimizeDialog`, `ConflictDialog`, `HelpDialog`, etc. | ℹ️ Info  | Other modals retain `open={true}` lifecycle pattern. Out of QA-04 scope (which targets `OverrideDialog` only); explicitly noted in 27-02-SUMMARY as a future-plan template, not a bug. |

---

### Pre-Existing Failures (NOT caused by Phase 27)

Per the phase context and confirmed via `27-01-deferred-items` + `27-02-deferred-items`, the following test/typecheck issues were present on phase base commit `17894cd` and are **not regressions introduced by Phase 27**:

| Failure                                                                                            | Cause                                                            | Phase 27 Plan that confirmed pre-existence |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------ |
| `tests/integration/build-scripts.spec.ts > package.json version is 1.1.3`                          | Stale assertion (real `package.json` version is `1.2.0`)         | 27-01 (stash + rerun verification)         |
| `tests/main/sampler-worker-girl.spec.ts > N2.2 wall-time gate`                                     | Wall-time perf gate flake on local non-CI machine                | 27-01                                      |
| `tests/renderer/atlas-preview-modal.spec.tsx > dblclick on canvas calls onJumpToAttachment`        | Phase 12 D-130 jsdom canvas hit-test fragility                   | 27-01                                      |
| `src/core/export.ts:140` TS6133 unused-binding `opts`                                              | Pre-existing on base                                             | 27-02 (stash + rerun verification)         |
| `src/renderer/src/lib/export-view.ts:205` TS6133 unused-binding `opts`                             | Pre-existing on base                                             | 27-02                                      |
| `tests/core/export.spec.ts:1312` TS6133 unused-binding `plan`                                      | Pre-existing on base                                             | 27-02                                      |
| `scripts/probe-per-anim.ts` TS6133 unused-binding (per phase context)                              | Pre-existing on base                                             | (per phase context)                        |

**Pre-existing failure count is unchanged before/after Phase 27** (3 spec failures + 4 TS6133 unused-binding warnings — same identity, same count). These are tracked as separate tech-debt items, not blockers for Phase 27 verification.

---

### Commits in Phase 27 Scope

```
e0001b3 test(27-03): add failing regression spec for renderer panel natural-order localeCompare (QA-03)
01468e4 fix(27-03): natural-order localeCompare in GlobalMaxRenderPanel.compareRows (QA-03)
36c6687 docs(27-03): complete QA-03 natural-order localeCompare panel-only sweep
d671f60 test(27-01): add divergence regression spec for stale-closure setSelected race (QA-01)
f7668c4 fix(27-01): convert GlobalMaxRenderPanel selection handlers to functional updater form (QA-01)
7249795 docs(27-01): complete QA-01 functional setSelected refactor plan
6a4efe9 test(27-02): add failing regression spec for OverrideDialog empty-input Apply guard (QA-02)
fb3fedc fix(27-02): guard OverrideDialog Apply on empty/whitespace input (QA-02)
cf098e0 refactor(27-02): remove dead OverrideDialog `open` prop and early-return guard (QA-04)
47b56aa docs(27-02): complete OverrideDialog QA-02 + QA-04 plan
7c239bd Merge branch 'worktree-agent-a9550adfad2fb42b9'
```

All TDD cycles (RED → GREEN [→ REFACTOR]) intact for each plan. Each plan committed its own SUMMARY.md.

---

## Verdict

**PASS.**

All four ROADMAP §Phase 27 success criteria are independently satisfied by codebase evidence:
- QA-01 (functional `setSelected`) — 4 functional-updater call sites in `GlobalMaxRenderPanel.tsx`, zero closure-capture form remaining; SelectAllCheckbox `onBulk` surface preserved per scope discipline; 3-test regression spec GREEN.
- QA-02 (Apply disabled on empty input) — `disabled={!isValid}`, `isValid` derivation, and Enter-shortcut guard all wired in `OverrideDialog.tsx`; 5-test regression spec GREEN, including explicit `not.toHaveBeenCalledWith(0)` pinpointing the silent-floor bug.
- QA-03 (numeric `localeCompare` panel sort) — 3 options-object call sites in `compareRows`; D-125 determinism boundary verified untouched (`git diff` empty for `src/core/`, `atlas-preview-view.ts`, `export-view.ts`); bare `localeCompare(a)` preserved in determinism-bound mirrors.
- QA-04 (dead `open` prop removal) — 0 occurrences of `props.open` or the early-return guard in `OverrideDialog.tsx`; `OverrideDialogProps` is the clean 6-field shape; AppShell `<OverrideDialog>` mount no longer passes `open={true}` (other modals' `open={true}` retained as out-of-scope by design).

The combined 10-test QA regression suite passes deterministically (run from clean worktree). The preview↔export byte-identical invariant is preserved by the deliberate scope discipline in plan 27-03. Pre-existing failures noted in the phase context (`build-scripts.spec.ts` 1.1.3 assertion, sampler-worker perf flake, atlas-preview-modal dblclick, 4 TS6133 unused-bindings) remain at unchanged count and identity — they are pre-existing tech debt and do not block Phase 27 verification per the phase brief.

Phase 27 goal — "Four v1.0-era code quality carry-forwards resolved with no functional behavior change" — is achieved.

---

_Verified: 2026-05-05T10:50:00Z_
_Verifier: Claude (gsd-verifier)_
