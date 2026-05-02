---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 11
subsystem: renderer + layout-stability
tags: [renderer, layout-regression, panel-virtualization, gap-closure, g-03, speculative-fix-2-then-verify, uat-1-falsified-original-hypothesis]
status: speculative-fix-2-then-verify
gap_closure_for: [G-03]
issue_008_disposition: original-hypothesis-falsified-by-uat-1; revised-diagnosis-applied; uat-2-required

# Dependency graph
requires:
  - phase: 21
    plan: 08
    provides: "AppShell.tsx loaderMode toggle + 'Use Images Folder as Source' label that the original hypothesis suspected (later falsified)"
  - phase: 9
    plan: 03
    provides: "GlobalMaxRenderPanel TanStack Virtual integration with `height: calc(100vh - 200px)` outer scroll container — the actual regression surface (revised diagnosis)"
provides:
  - "Layout-only CSS hardening on the AppShell.tsx toolbar cluster (6× flex-shrink-0 + 1× whitespace-nowrap) — preserved as defense-in-depth even though UAT-1 falsified the toolbar-flex hypothesis"
  - "GlobalMaxRenderPanel.tsx outer <section> pinned to `min-h-[calc(100vh-200px)]` so the panel reserves the same vertical extent across the useVirtual toggle (revised G-03 fix; UAT-2 required)"
affects:
  - "Plan 21 final HUMAN-UAT pass — UAT-2 must re-test G-03 specifically on the Global tab with the per-attachment filter on a >100-row fixture (Girl)"
  - "Loader-mode toggle (D-08) UX preserved — visible, functional, persisted (UAT-1 Test 2 PASSED)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel-level min-height pin to stabilize layout across virtualizer threshold toggles — when a panel has dual render paths (virtualized vs flat-table) with mismatched height contracts, the threshold cross causes a layout collapse; pinning the outer container's min-height to the virtualized path's height eliminates the collapse"
    - "flex-shrink-0 discipline on toolbar children — preserved from the original speculative fix as defense-in-depth even though it did not address the actual root cause"
    - "whitespace-nowrap on long-text label inner span — preserved as defense-in-depth contract"
    - "Speculative-fix-then-verify (per ISSUE-008): when jsdom cannot compute layout, plan documents the manual repro steps and applies a targeted CSS hardening; if HUMAN-UAT falsifies the original hypothesis, executor revises diagnosis and re-applies a targeted fix with SPECULATIVE-FIX-2-THEN-VERIFY status"

key-files:
  created:
    - ".planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-11-toolbar-layout-regression-SUMMARY.md (this file — supersedes the original SUMMARY)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (+7/-7 LoC; 6× flex-shrink-0 + 1× whitespace-nowrap on the toolbar cluster's children — commit b8f2a0f, original speculative fix; PRESERVED as defense-in-depth)"
    - "src/renderer/src/panels/GlobalMaxRenderPanel.tsx (+18/-1 LoC; min-h-[calc(100vh-200px)] on the panel's outer <section> + 16-line explanatory comment block — commit 30ff95f, REVISED fix after UAT-1)"

key-decisions:
  - "UAT-1 (run by user on merged main with original toolbar-flex fix b8f2a0f in place) falsified the original hypothesis: Test 1 STILL FAILED. The per-attachment filter still causes the panel to slide downward — but ONLY on the Global tab. The Animation Breakdown tab does NOT exhibit the regression. This panel-tab-specific behavior is critically diagnostic information that the original ISSUE-008 deferred-empirical-verify path did not have access to."
  - "Revised diagnosis (this executor): the regression's actual root cause is GlobalMaxRenderPanel's threshold-gated TanStack Virtual integration. When `sorted.length > 100` (Girl fixture, ~200-300 rows), useVirtual is TRUE → panel's main table area is wrapped in a div with inline `height: calc(100vh - 200px)` and `overflow: auto`. When the per-attachment filter narrows `sorted.length` below 100, useVirtual flips FALSE → the fixed-height wrapper is unmounted and replaced by a content-driven bare `<table>`. The panel's vertical extent collapses by hundreds of pixels in a single render. AnimationBreakdownPanel does NOT regress because its virtualizer is per-card with `maxHeight: 600px` (not viewport-relative), and cards stack with content-driven heights — no panel-level height switch ever occurs across the threshold."
  - "Revised fix: pin the GlobalMaxRenderPanel outer `<section>` (line 797) to `min-h-[calc(100vh-200px)]` — the SAME vertical extent as the virtualized scroll container's inline `height` style. This stabilizes the panel's vertical footprint across the useVirtual toggle: when virtualized, content already fills the min-h; when flat-table, the section reserves the same extent and the table renders at the top with empty space below — no collapse, no slide."
  - "Original toolbar-flex fix (commit b8f2a0f) is PRESERVED. Rationale: (a) the user's UAT-1 Tests 2 + 3 PASSED with that fix in place — D-08 loaderMode toggle works, toolbar visual integrity at 900px width is fine. (b) flex-shrink-0 discipline is independently desirable for any toolbar with mixed-text children regardless of whether it caused this specific bug. (c) Reverting it now would re-introduce a latent failure mode (toolbar children compressing under width pressure) without affecting the actual G-03 fix."
  - "Plan re-tagged SPECULATIVE-FIX-2-THEN-VERIFY in this SUMMARY's frontmatter. The revised fix's hypothesis (panel-level useVirtual height-collapse) is well-supported by static code analysis but still requires HUMAN-UAT-2 empirical confirmation (jsdom does not compute flex layout / virtualizer behavior — same automation gap as the original)."

# Execution metrics
metrics:
  duration: ~25 minutes (UAT-1 review ~3 min; re-investigation of Global vs Breakdown rendering paths ~10 min; revised fix + verify ~5 min; SUMMARY rewrite ~7 min)
  tasks-completed: 2/3 (Tasks 1+2 retroactively re-classified — Task 1 hypothesis was wrong, Task 2 fix was a partial; this UAT-2-pending revision adds a second fix on a different file)
  files-modified: 2 cumulative (AppShell.tsx + GlobalMaxRenderPanel.tsx)
  files-created: 1 (this SUMMARY supersedes the original)
  commits: 3 cumulative on this plan (b8f2a0f original fix, 1063f3a original SUMMARY, 30ff95f revised fix; this SUMMARY's commit will follow)
  completed: 2026-05-02 (revised — UAT-2 pending)
---

# Phase 21 Plan 11: Toolbar layout regression (G-03) — SPECULATIVE-FIX-2-THEN-VERIFY

## One-liner

Original toolbar-flex hypothesis (CSS `flex-shrink-0` on AppShell toolbar children) was FALSIFIED by HUMAN-UAT-1: Test 1 still failed AND the regression is panel-tab-specific (Global only, not Animation Breakdown). Revised diagnosis: GlobalMaxRenderPanel's threshold-gated TanStack Virtual switches between a fixed-height-`calc(100vh-200px)` virtualized path and a content-driven flat-table path; per-attachment filter narrows row count below the 100-row threshold, useVirtual flips false, the panel's vertical extent collapses. Revised fix: pin the panel's outer `<section>` to `min-h-[calc(100vh-200px)]` to stabilize the vertical footprint across the toggle. UAT-2 required to confirm.

## Hypothesis Chain

This is the headline section. The plan's status moved from speculative-fix-then-verify (original) → falsified-by-uat → revised-diagnosis-applied → speculative-fix-2-then-verify. Each link is documented below.

### Link 1: Original speculation (per the plan)

The plan hypothesized that the regression came from CSS flex-compression in the AppShell.tsx toolbar cluster. Specifically: the new "Use Images Folder as Source" label added in Phase 21 Plan 21-08 (commit 39b72bb) had no `flex-shrink-0`. When the per-attachment filter changed panel row count, the panel's vertical scrollbar appeared/disappeared, the available width changed, the toolbar's flex children compressed, the long label wrapped to two lines, the sticky-header height grew, and the panel below shifted downward.

This was a STATIC-ANALYSIS-driven hypothesis: bisect identified 39b72bb as the only meaningfully layout-touching commit since pre-Phase-21; flex-shrink-0 was indeed missing from the toolbar; the long label was the most plausible compression target. The hypothesis was internally consistent.

### Link 2: Original speculative fix (commit b8f2a0f)

`AppShell.tsx`: 6× `flex-shrink-0` on the loaderMode label + 5 toolbar buttons; 1× `whitespace-nowrap` on the loader label's inner span. Layout-only, additive CSS. Marked SPECULATIVE-FIX-THEN-VERIFY in the original SUMMARY because jsdom cannot compute flex layout — empirical verification deferred to HUMAN-UAT.

### Link 3: HUMAN-UAT-1 (run by user on merged main)

UAT-1 was run on the merged main branch (after worktree-agent-af15aefc11e952769 merged commits b8f2a0f + 1063f3a back to main).

**UAT-1 Result:**

> **Test 1: FAILED** — the per-attachment filter STILL causes the panel to slide downward, BUT ONLY ON THE GLOBAL TAB. The Animation Breakdown tab does NOT exhibit the regression.
> **Test 2: PASSED** — D-08 loaderMode toggle still works correctly.
> **Test 3: PASSED** — toolbar visual integrity at 900px width is fine.

This OUTCOME has TWO distinct implications:

1. **The original hypothesis is FALSIFIED.** The toolbar-flex fix is in place; Test 1 still fails. The cause cannot be (or cannot ONLY be) toolbar flex-compression — if it were, the b8f2a0f fix would have closed it.
2. **The regression is panel-tab-specific.** Global tab regresses; Animation Breakdown tab does not. This is critically diagnostic information that the original bisect did NOT have. It REDIRECTS the investigation from "what's different about post-Phase-21 vs pre-Phase-21 in shared layout chrome" to "what's different about how the Global panel renders the filter operation vs how the Animation Breakdown panel renders it."

### Link 4: Revised diagnosis (this executor)

The Global tab renders `GlobalMaxRenderPanel`; the Animation Breakdown tab renders `AnimationBreakdownPanel`. Both panels filter by `query` from a single lifted SearchBar in AppShell. Both panels use TanStack Virtual with a `VIRTUALIZATION_THRESHOLD = 100`. **But the two panels' virtualizers are wired DIFFERENTLY:**

| Panel | Virtualizer outer container | Threshold scope |
|-------|----------------------------|-----------------|
| GlobalMaxRenderPanel | `<div style={{ height: 'calc(100vh - 200px)', overflow: 'auto', overflowAnchor: 'none' }}>` (line 855-865) | Whole-panel: useVirtual = sorted.length > 100 → wraps the ENTIRE peak table in the fixed-height div |
| AnimationBreakdownPanel | `<div style={{ maxHeight: '600px', overflowY: 'auto', overflowAnchor: 'none' }}>` (line 779-787) | Per-card: each animation card's BreakdownTable independently picks virtual or flat based on its own row count; outer panel just stacks cards normally |

**The smoking gun: the Global panel's `useVirtual` is a panel-level boolean tied to total row count.** When the user types in the per-attachment filter on the Girl fixture (~200-300 rows initially → useVirtual TRUE), the filter narrows sorted.length below 100 → useVirtual flips FALSE on the same render. The fixed-height `calc(100vh - 200px)` wrapper is unmounted and replaced by a bare content-driven `<table>`. The panel's vertical footprint collapses from "viewport - 200px" (typically 600-800px) to "filtered-rows × 34px" (typically 50-200px) in one render. This visual collapse is what the user observed as "panel slides downward toward the center."

The AnimationBreakdownPanel does NOT regress because:
1. Its virtualizer's outer container uses `maxHeight: '600px'` — a small fixed cap, NOT viewport-relative.
2. Each card's table independently picks virtual / flat — there is no panel-level height switch.
3. Filter typically narrows individual cards to short row counts, but the outer panel's height was always content-driven (cards stack via `<div className="flex flex-col gap-3">` at line 383); no collapse possible.

The Phase 21 Plan 21-08 toolbar checkbox was a RED HERRING. The actual regression surface is Phase 9 Plan 03's TanStack Virtual integration (introduced ~commit before Phase 21; pre-existing layout fragility that Phase 21 did not introduce — the user simply happened to run the per-attachment filter on a Girl-size fixture during Phase 21 UAT, hitting a latent regression that has likely been present since virtualization landed). The bisect-only approach in the original Task 1 missed this because **the regression is not present in pre-Phase-21 code with respect to the Phase 21 changes** (Phase 21 didn't touch GlobalMaxRenderPanel.tsx; the bisect's 0-result on that file was actually correct — but the bisect target was wrong).

### Link 5: Revised fix (commit 30ff95f)

`src/renderer/src/panels/GlobalMaxRenderPanel.tsx` line 797: append `min-h-[calc(100vh-200px)]` to the panel's outer `<section>` className. The complete className becomes:

```jsx
<section className="border border-border rounded-md bg-panel p-4 mb-4 min-h-[calc(100vh-200px)]">
```

A 16-line explanatory comment block above the section documents the fix's rationale (UAT-1 falsification + revised diagnosis + the AnimationBreakdownPanel-doesn't-regress note for future maintainers).

**Why this fix works:** The outer `<section>` reserves AT LEAST `calc(100vh - 200px)` of vertical space regardless of inner content. When `useVirtual` is true, the inner `<div>` already fills that height (its inline `height: calc(100vh - 200px)` matches the section's `min-height`). When `useVirtual` is false (filter narrowed rows), the section's `min-height` keeps the panel's vertical footprint identical to the virtualized state — the flat table renders at the top of the section with empty space below, but the SECTION's outer dimensions don't collapse. No layout collapse → no slide.

**Why `min-height` not `height`:** `height: calc(100vh - 200px)` would FORCE the section to exactly that height even when content exceeded it (e.g., a future case where the unused-attachments section + flat table together exceed 100vh-200px). `min-height` is permissive: floor the section at the virtualized-path's extent, but allow it to grow if content needs more.

**Tailwind v4 literal-class scanner discipline preserved:** `min-h-[calc(100vh-200px)]` is a single literal arbitrary-value class (no template literal, no computed string) — the v4 scanner picks it up.

## UAT-1 Result (verbatim from user / orchestrator)

> **Test 1: FAILED** — the per-attachment filter STILL causes the panel to slide downward, BUT ONLY ON THE GLOBAL TAB. The Animation Breakdown tab does NOT exhibit the regression.
> **Test 2: PASSED** — D-08 loaderMode toggle still works correctly.
> **Test 3: PASSED** — toolbar visual integrity at 900px width is fine.

## Revised Diagnosis

**Original hypothesis fault:** The bisect correctly identified Phase 21 Plan 21-08 (commit 39b72bb) as the most-recently-layout-touching commit on AppShell.tsx, but ASSUMED the regression entered the codebase in that bisect window. UAT-1 reveals that assumption was wrong — Test 1 still fails with the toolbar fix in place. The actual root cause exists in code that was UNCHANGED across the bisect window: GlobalMaxRenderPanel's TanStack Virtual integration (which was introduced in Phase 9 Plan 03, well before Phase 21).

**New hypothesis (revised):** GlobalMaxRenderPanel's `useVirtual` is a panel-level boolean tied to total row count. When the user types in the per-attachment filter on a fixture with > 100 rows (Girl fixture qualifies; SIMPLE_PROJECT does not — which explains why the regression is fixture-dependent, possibly missed by users who only test with SIMPLE_PROJECT), the filter narrows row count below the 100-row threshold. `useVirtual` flips false on the same render. The fixed-height `calc(100vh - 200px)` virtualizer wrapper is unmounted; replaced by a content-driven flat `<table>`. The panel's vertical footprint COLLAPSES by hundreds of pixels in a single render — observed by the user as "panel slides downward toward the center."

The Animation Breakdown panel does not exhibit this regression because its virtualizer uses a small fixed `maxHeight: 600px` (not viewport-relative) and is per-card (not panel-level); no panel-level height switch occurs across the threshold.

## Revised Fix

| File | Line | Change | Rationale |
|------|------|--------|-----------|
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 797 | Append `min-h-[calc(100vh-200px)]` to the outer `<section>` className | Pins the panel's vertical footprint to the same extent as the virtualized scroll container's inline `height` style, so the section's outer dimensions do not collapse when `useVirtual` flips false |
| `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` | 781-796 | New 16-line explanatory comment block above the section | Documents UAT-1 falsification + revised diagnosis for future maintainers; explicitly notes AnimationBreakdownPanel does not regress and why |

The original toolbar-flex fix (commit b8f2a0f, 6× `flex-shrink-0` + 1× `whitespace-nowrap` on AppShell.tsx toolbar children) is PRESERVED as defense-in-depth — UAT-1 Tests 2 + 3 PASSED with it in place, and `flex-shrink-0` discipline on a mixed-text toolbar is independently desirable. Reverting it now would re-introduce a latent failure mode without affecting the actual G-03 fix.

## UAT-2 Required

The user must re-run **Test 1 specifically**: Global tab + per-attachment filter on a fixture with > 100 rows (Girl is the canonical Phase 21 fixture).

**Test 1-revised — G-03 closure (filter does NOT shift panel position on the Global tab):**

1. `npm run dev` (Electron dev server boots)
2. Drag-and-drop `fixtures/Girl/` (any of the Girl fixture .json files — the regression manifests when the rig has > 100 attachment rows; SIMPLE_PROJECT has too few rows to trigger the threshold and CANNOT reproduce the bug).
3. Wait for panels to populate; ensure you are on the **Global tab** (the regression-prone tab).
4. Note the Y-position of the Global Max Render Source panel header (or any visual reference inside the panel chrome).
5. Use the per-attachment filter — type something in the search bar that narrows the result list to < 100 rows (e.g., a substring that matches just a few attachments; "armor" or any uncommon attachment-name substring).
6. **Expected**: panel position is STABLE — no visible jump or slide downward, even though the row count drops below the virtualization threshold.
7. Clear the filter — panel position remains stable; row count goes back above 100; virtualization re-engages without any visible shift.
8. Repeat several times — no cumulative drift.

**Test 2 + Test 3 (regression-of-the-fix checks):** unchanged from UAT-1; previously PASSED; should still PASS since the revised fix only modifies GlobalMaxRenderPanel.tsx (not AppShell.tsx, not the loaderMode toggle, not toolbar buttons).

**If Test 1-revised PASSES**: G-03 is closed. The plan's status flips from `speculative-fix-2-then-verify` to `closed`. The original speculative-fix b8f2a0f stays as defense-in-depth.

**If Test 1-revised FAILS**: the revised hypothesis is also wrong. Plan is marked `SPECULATIVE-FIX-FAILED` and the user re-routes to a deeper investigation (likely sitting with Claude in dev mode to do live DOM inspection). At that point, the failure mode is genuinely outside what static analysis can predict, and HUMAN-IN-THE-LOOP investigation is the only path forward.

## Verification Outcomes (Tasks 1+2 + Revised Fix)

### Original Tasks 1+2 (commit b8f2a0f) — UAT-1 disposition

- [x] Bisect identified 39b72bb as the most-recently-layout-touching commit (correct identification, wrong inference about causation)
- [x] flex-shrink-0 + whitespace-nowrap discipline added to AppShell.tsx toolbar children (correctly applied)
- [✗] Hypothesis falsified by UAT-1 — Test 1 still failed with this fix in place
- [x] Original fix PRESERVED as defense-in-depth (UAT-1 Tests 2 + 3 PASSED)

### Revised Fix (commit 30ff95f) — pre-UAT-2

- [x] `grep -c "min-h-\[calc(100vh-200px)\]" src/renderer/src/panels/GlobalMaxRenderPanel.tsx` returns 2 (1 in the comment + 1 in the className literal)
- [x] typecheck: only 2 pre-existing TS6133 warnings (`AnimationBreakdownPanel.tsx:286` + `GlobalMaxRenderPanel.tsx:531`, both already in `deferred-items.md`); zero new errors
- [x] vitest: 624 passed / 1 pre-existing failure (`tests/main/sampler-worker-girl.spec.ts` — D-21-WORKTREE-1, missing `fixtures/Girl/` in the worktree; passes on the parent repo)
- [x] Panel-specific tests pass: `tests/renderer/global-max-virtualization.spec.tsx` (4) + `tests/renderer/missing-attachments-panel.spec.tsx` (4) = 8/8 green
- [x] Tailwind v4 literal-class scanner discipline preserved (single literal `min-h-[calc(100vh-200px)]`, no template/computed strings)
- [ ] **PENDING UAT-2**: empirical confirmation that Test 1-revised passes with the Girl fixture on the Global tab

### Acceptance Criteria — Task 3 (HUMAN-UAT-2)

- [ ] **PENDING.** User must run UAT-2 Test 1 (and ideally re-run Tests 2 + 3 for regression-of-the-fix) on the merged main branch.

## Deviations from Plan

### Major: original hypothesis falsified by UAT-1; revised diagnosis applied

The plan documented this exact fallback: ISSUE-008's "If the hypothesis does NOT match observed behavior, the executor returns to bisect" + "If even iteration fails, plan is marked SPECULATIVE-FIX-FAILED and re-routes to broader bisect (per ISSUE-008 fallback)." This SUMMARY's revised diagnosis is the documented re-investigation path: UAT-1 produced new evidence (panel-tab-specificity) that the original bisect did not have, the executor re-investigated where the Global vs Breakdown rendering paths diverge (TanStack Virtual integration), and applied a targeted fix.

This is a documented fallback, NOT an unauthorized deviation.

### Minor: original fix b8f2a0f preserved (not reverted)

The plan's Task 2 says "If [fix] does not work after iteration, mark SPECULATIVE-FIX-FAILED and re-route to broader bisect" — it does NOT prescribe reverting the original fix. The executor's judgment: keep b8f2a0f as defense-in-depth, since UAT-1 Tests 2+3 PASSED with it in place and `flex-shrink-0` discipline is independently desirable. Reverting would require a clean reason not present here.

### Out-of-scope (deferred — not addressed by this plan)

- **Pre-existing TS6133 warnings** (`onQueryChange unused` in `AnimationBreakdownPanel.tsx:286` + `GlobalMaxRenderPanel.tsx:531`) — already in `deferred-items.md`; this plan touches both files but does NOT modify the unused-prop signatures.
- **Pre-existing test failure** (`tests/main/sampler-worker-girl.spec.ts` — `fixtures/Girl/` gitignored, missing in worktree) — already in `deferred-items.md` as D-21-WORKTREE-1; runs green on the parent repo with the actual Girl fixture present.

## ROADMAP Success Criteria Coverage

This plan is a Phase 21 gap-closure plan for G-03 only. It does NOT touch the Phase 21 functional success criteria (those are owned by Plans 21-01..21-08). The fix is layout-only:

- D-08 loaderMode toggle (Phase 21 success criteria #1, #2, #3) — PRESERVED across both fix iterations. Plan 21-08's tests still pass; the toggle is visible, functional, and persisted (UAT-1 Test 2 PASSED; revised fix doesn't touch AppShell.tsx).
- LOAD-04 round-trip (success criterion #4) — UNCHANGED. No code-path modification.
- Criterion #5 (AtlasNotFoundError verbatim) — UNCHANGED. No loader logic touched.

## Self-Check: PASSED

- File `src/renderer/src/panels/GlobalMaxRenderPanel.tsx` modified (verified `git diff --stat HEAD~1 HEAD`).
- Commit `30ff95f` exists in git log on this worktree branch (verified).
- File `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-11-toolbar-layout-regression-SUMMARY.md` written (this file).
- 1 `min-h-[calc(100vh-200px)]` className literal occurrence in GlobalMaxRenderPanel.tsx (grep — 2 grep matches, 1 in comment + 1 in JSX className literal).
- vitest: 624/625 green (1 pre-existing failure documented).
- typecheck: 2 pre-existing warnings (no new errors).

## Threat Flags

None — pure CSS class additions (`min-h-[calc(100vh-200px)]`, plus the preserved `flex-shrink-0` + `whitespace-nowrap` from b8f2a0f) introduce no new security surface, no IPC payload change, no new file/network access. Threat register T-21-11-01 (UX horizontal overflow at narrow viewports) is unchanged and still ACCEPTED.

## Future-Maintenance Note

If a future fixture or feature increases content height inside the GlobalMaxRenderPanel beyond `calc(100vh - 200px)` (e.g., a very large unused-attachments table), the `min-h` floor remains correct — `min-height` is permissive and the section will grow to fit content. The pin only prevents collapse, not growth. The 16-line comment block above the section explicitly documents this for future maintainers.
