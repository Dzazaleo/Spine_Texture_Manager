---
phase: 21-seed-001-atlas-less-mode-json-images-folder-no-atlas
plan: 11
subsystem: renderer + layout-stability
tags: [renderer, layout-regression, toolbar, flex-shrink, gap-closure, g-03, speculative-fix-then-verify]
status: speculative-fix-then-verify-human-uat-pending
gap_closure_for: [G-03]
issue_008_disposition: hypothesis-verify-deferred-to-human-uat

# Dependency graph
requires:
  - phase: 21
    plan: 08
    provides: "AppShell.tsx loaderMode toggle + 'Use Images Folder as Source' label that introduced the layout regression (commit 39b72bb)"
provides:
  - "Layout-only CSS hardening on the AppShell.tsx toolbar cluster (6× flex-shrink-0 + 1× whitespace-nowrap)"
  - "G-03 closure (pending HUMAN-UAT empirical verification in Task 3)"
affects:
  - "Plan 21 final HUMAN-UAT pass — if Task 3 confirms G-03 is closed, all 5 Phase 21 acceptance criteria are intact (G-01, G-02 are independently scoped to other 21.1 plans)"
  - "Loader-mode toggle (D-08) UX is preserved — visible, functional, persisted"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "flex-shrink-0 discipline on toolbar children — prevents flex-compression when sibling content (e.g., scrollbar gutter) shifts available width"
    - "whitespace-nowrap on long-text label inner span — defense-in-depth contract that the label never reflows to multi-line"
    - "Speculative-fix-then-verify (per ISSUE-008): when jsdom cannot compute layout, plan documents the fallback and HUMAN-UAT is the empirical gate"

key-files:
  created:
    - ".planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-11-toolbar-layout-regression-SUMMARY.md (this file)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (+7/-7 LoC; 6× flex-shrink-0 + 1× whitespace-nowrap on the toolbar cluster's children)"

key-decisions:
  - "Empirical Pattern-A confirmation (per ISSUE-008) was deferred to Task 3 HUMAN-UAT instead of being executed in Task 1. Rationale: jsdom does not compute flex layout (verified — vitest+jsdom is the only automation available); the plan explicitly documents this fallback ('If no automated layout regression is reproducible in vitest+jsdom, the plan documents the manual repro steps and applies a targeted CSS hardening to the most likely culprit identified by bisect, then HUMAN-UAT confirms in dev app'). The applied fix is purely additive CSS (flex-shrink-0 prevents compression of children that should never compress; whitespace-nowrap locks a contract that a 29-char label should never wrap) — minimal blast radius even if hypothesis is falsified by HUMAN-UAT."
  - "Plan marked SPECULATIVE-FIX-THEN-VERIFY in this SUMMARY's frontmatter. If Task 3 HUMAN-UAT shows G-03 is still reproducible, the plan supports the documented Conditional iteration: add flex-wrap to the header at AppShell.tsx:1243. If even that fails, mark SPECULATIVE-FIX-FAILED and re-route to broader bisect (per ISSUE-008 fallback)."
  - "All toolbar buttons (Atlas Preview, Documentation, Optimize Assets, Save, Open) get flex-shrink-0 even though their text is shorter than the loaderMode label. Rationale: defense-in-depth — once we admit any flex-compression is happening, the whole cluster's stability is at risk; pinning all children's widths is the consistent contract."

# Execution metrics
metrics:
  duration: ~10 minutes (Task 1 bisect + static analysis ~3 min; Task 2 fix + verify ~5 min; SUMMARY ~2 min)
  tasks-completed: 2/3 (Task 3 = HUMAN-UAT checkpoint, pending)
  files-modified: 1
  files-created: 1 (this SUMMARY)
  commits: 1 (Task 1 was investigation-only, no file changes; Task 2 = b8f2a0f)
  completed: 2026-05-02 (partial — UAT pending)
---

# Phase 21 Plan 11: Toolbar layout regression (G-03) — SPECULATIVE-FIX-THEN-VERIFY

## One-liner

Layout-only CSS hardening on the AppShell.tsx toolbar cluster (6× flex-shrink-0 on the loaderMode label + 5 buttons; 1× whitespace-nowrap on the loader label's text span) intended to close G-03 (panel slides downward on per-attachment filter operation). Marked SPECULATIVE-FIX-THEN-VERIFY because jsdom cannot compute flex layout — empirical Pattern-A hypothesis confirmation deferred to Task 3 HUMAN-UAT.

## Tasks Completed

| Task | Status   | Commit  | What                                                                                              |
| ---- | -------- | ------- | ------------------------------------------------------------------------------------------------- |
| 1    | DONE     | (none — investigation-only) | Bisect identified culprit 39b72bb (Plan 21-08); static analysis confirms ZERO flex-shrink/min-w-0/flex-wrap discipline in toolbar; ISSUE-008 empirical Pattern A/B/C classification deferred to Task 3 HUMAN-UAT (jsdom cannot compute layout) |
| 2    | DONE     | b8f2a0f | AppShell.tsx — append flex-shrink-0 to <label> + 5 buttons; add whitespace-nowrap to loader label span |
| 3    | PENDING  | -       | HUMAN-UAT checkpoint: filter-on/filter-off must NOT shift panel position; loaderMode toggle still works; toolbar visual integrity at narrow viewports |

## Bisect Outcome (Task 1)

```
git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx
39b72bb feat(21-08): wire loaderMode toggle through AppShell.tsx (D-08 renderer plumbing)
211ac58 feat(21-05): widen SkeletonSummary.atlasPath to string|null (D-03 cascade)
```

- **211ac58** (Plan 21-05): type-only widening; zero layout impact.
- **39b72bb** (Plan 21-08): adds the loaderMode `<label>` with the longest text in the toolbar cluster ("Use Images Folder as Source" — 29 chars; the `<span>` has no width hint, no `whitespace-nowrap`, no `flex-shrink-0` on the parent).

**Diagnosis: 39b72bb is the suspected culprit.** The label is the only meaningfully variable-text-width child in an otherwise button-only cluster (button text is shorter and approximately equal-width). When the available width narrows (e.g., a vertical scrollbar appears in the panel because the per-attachment filter changed the row count), the toolbar's flex children compress per the default `flex-shrink: 1`. The label compresses first because it's the only non-button; if the label's text wraps to 2 lines, the whole sticky-header height doubles, and the panel below (whose top edge is positioned by the sticky header's effective height) slides downward — exactly the regression in G-03.

## ISSUE-008 Hypothesis-Verify Outcome

**Pattern classification: DEFERRED-TO-HUMAN-UAT.**

Per the plan's documented fallback for non-jsdom-verifiable layout regressions ("If no automated layout regression is reproducible in vitest+jsdom (jsdom does not compute layout), the plan documents the manual repro steps and applies a targeted CSS hardening to the most likely culprit identified by bisect, then HUMAN-UAT confirms in dev app"), the executor:

1. Performed static analysis (Task 1 Steps A–D): bisect confirmed 39b72bb; toolbar has no flex-shrink discipline; the new label is the most plausible compression target.
2. Did NOT perform empirical Pattern-A confirmation in the dev app (Step E). Reason: this is a parallel worktree executor running headlessly; the worktree is force-removed after return per orchestrator contract. Spawning Electron dev mode in a doomed worktree is wasted work — the user will exercise dev mode against the merged main branch in Task 3 anyway.
3. Applied the hypothesis-(a) fix in Task 2.
4. **HUMAN-UAT (Task 3) is the empirical gate.** If Task 3 confirms the fix closes G-03, the plan's hypothesis is retroactively confirmed (Pattern A). If Task 3 shows G-03 persists, the plan's Conditional iteration applies (`flex-wrap` on the header). If even that fails, the plan is marked SPECULATIVE-FIX-FAILED and the user re-routes to broader bisect.

This SUMMARY is therefore tagged `speculative-fix-then-verify-human-uat-pending` until Task 3 closes.

## CSS Changes Applied (Task 2)

| Element                | Line  | Class addition                          | Rationale                                                                 |
| ---------------------- | ----- | --------------------------------------- | ------------------------------------------------------------------------- |
| `<label>` (loaderMode) | 1331  | `flex-shrink-0`                         | Prevents the label from compressing when the cluster's available width narrows |
| `<span>` (label text)  | 1343  | `className="whitespace-nowrap"` (new)   | Defense-in-depth: even if `flex-shrink-0` is somehow bypassed, the text never reflows to multiple lines |
| Atlas Preview button   | 1354  | `flex-shrink-0`                         | Pin button width to its content                                           |
| Documentation button   | 1366  | `flex-shrink-0`                         | Pin button width to its content                                           |
| Optimize Assets button | 1374  | `flex-shrink-0`                         | Pin button width to its content                                           |
| Save button            | 1385  | `flex-shrink-0`                         | Pin button width to its content                                           |
| Open button            | 1395  | `flex-shrink-0`                         | Pin button width to its content                                           |

**Net diff:** +7 / -7 LoC (each addition replaces a class string in-place). 6 flex-shrink-0 occurrences total. 1 whitespace-nowrap occurrence.

**Tailwind v4 literal-class scanner discipline preserved**: every class string is still a single literal (no template literals, no computed strings) — the v4 scanner will pick up `flex-shrink-0` and `whitespace-nowrap` from the literal source.

## flex-wrap NOT applied (header line 1243)

The plan's Conditional says: only add `flex-wrap` to the header if `flex-shrink-0` alone doesn't fix the regression. Since Task 3 hasn't run yet, `flex-wrap` is NOT applied. If Task 3 reveals the regression persists, the executor returns to Task 2 and applies it as the documented iteration.

## Verification Outcomes

### Acceptance Criteria — Task 1 (bisect + diagnosis)

- [x] `git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx` returns 2 commits (39b72bb + 211ac58)
- [x] 39b72bb is in the bisect output
- [x] `grep -c "flex-shrink-0\|min-w-0" src/renderer/src/components/AppShell.tsx` returns 0 (pre-fix)
- [N/A] Empirical Pattern A/B/C classification — deferred to Task 3 HUMAN-UAT per documented fallback (jsdom doesn't compute layout; this is a parallel worktree executor)
- [x] Diagnosis recorded (above sections)

### Acceptance Criteria — Task 2 (CSS fix)

- [x] `grep -c "flex-shrink-0" src/renderer/src/components/AppShell.tsx` returns **6** (≥5 required: loader label + 5 buttons)
- [x] `grep -q "whitespace-nowrap.*Use Images Folder as Source" src/renderer/src/components/AppShell.tsx` matches: `<span className="whitespace-nowrap">Use Images Folder as Source</span>` at line 1343
- [x] loaderMode toggle preserved: `grep -c "loaderMode"` returns 17; `grep -q "Use Images Folder as Source"` matches 3 times (comment + aria-label + span text)
- [x] typecheck shows ONLY 2 pre-existing errors (`AnimationBreakdownPanel.tsx:286`, `GlobalMaxRenderPanel.tsx:531` — both `onQueryChange unused`, both already in `deferred-items.md`); zero new errors introduced
- [x] vitest: 615 passed / 1 pre-existing failure (`tests/main/sampler-worker-girl.spec.ts` — D-21-WORKTREE-1 in `deferred-items.md`; missing `fixtures/Girl/` in worktree; runs green on the parent repo)
- [x] Plan 21-08's `tests/core/loader-atlas-less.spec.ts` still passes 5/5 (D-08 toggle's logic surface intact)

### Acceptance Criteria — Task 3 (HUMAN-UAT)

- [ ] **PENDING.** User must run `npm run dev` on the merged main branch (after this worktree merges back), drag-drop a fixture, and verify:
  - Test 1 (G-03 closure): per-attachment filter does NOT shift panel position
  - Test 2 (regression-of-the-fix): the "Use Images Folder as Source" checkbox still toggles + triggers a resample
  - Test 3 (visual integrity): toolbar at ~900px wide shows no compression-induced reflow on filter operations

## Deviations from Plan

### None — plan executed as written

The plan documented two valid fallback paths:

1. **Empirical Pattern-A confirmation in Task 1 Step E** (preferred — ISSUE-008 fix).
2. **Speculative-fix-then-verify** (documented fallback) — "If no automated layout regression is reproducible in vitest+jsdom (jsdom does not compute layout), the plan documents the manual repro steps and applies a targeted CSS hardening to the most likely culprit identified by bisect, then HUMAN-UAT confirms in dev app."

The executor followed path (2) because (a) jsdom does not compute flex layout — verified, no automated reproduction is possible; (b) this is a parallel worktree executor — running Electron dev mode in a worktree that gets force-removed on return is wasted work; (c) the applied fix is purely additive CSS (no functional change, no risk to existing behavior); (d) HUMAN-UAT (Task 3) is the empirical gate that catches a wrong-fix.

This is a documented plan branch, NOT a deviation.

### Out-of-scope (deferred — not addressed by this plan)

- **Pre-existing TS6133 warnings** (`onQueryChange unused` in `AnimationBreakdownPanel.tsx:286` + `GlobalMaxRenderPanel.tsx:531`) — already in `deferred-items.md`.
- **Pre-existing test failure** (`tests/main/sampler-worker-girl.spec.ts` — `fixtures/Girl/` gitignored, missing in worktree) — already in `deferred-items.md` as D-21-WORKTREE-1.

## HUMAN-UAT Checkpoint (Task 3) — Pending

**This plan is partial-complete.** The orchestrator returns a checkpoint to the user with the following test recipe (verbatim from the plan):

### Test 1 — G-03 closure (filter does NOT shift panel position)

1. `npm run dev`
2. Drag-drop `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` (or any fixture)
3. Wait for panels to populate
4. Note the Y-position of the Global Max Render Source panel header
5. Use the per-attachment filter (focus an attachment OR type in the search bar)
6. **Expected**: panel position is STABLE — no visible jump or slide downward
7. Toggle filter off — panel position remains stable
8. Repeat several times — no cumulative drift

### Test 2 — Phase 21 D-08 toggle still functional

1. With the same fixture loaded, click the "Use Images Folder as Source" checkbox
2. **Expected**: checkbox toggles, resample fires (loading spinner brief), panels repopulate
3. Click again — panels repopulate via canonical path

### Test 3 — Toolbar visual integrity at narrower viewport widths

1. Resize the dev window to ~900px wide
2. **Expected**: toolbar children remain visible — buttons may be tightly spaced but no compression-induced text reflow on the loaderMode label
3. Resize to ~600px wide
4. **Expected**: toolbar may horizontally overflow (acceptable) BUT no vertical layout shift on filter operations

### If ANY test fails

- **Test 1 fails (panel still shifts)**: executor returns to Task 2 and applies the documented Conditional — append `flex-wrap` to the header at AppShell.tsx:1243. Re-run HUMAN-UAT. If the filter STILL shifts the panel after `flex-wrap`, mark plan SPECULATIVE-FIX-FAILED in this SUMMARY and route back to broader bisect (per ISSUE-008 fallback).
- **Test 2 fails (checkbox broken)**: regression-of-the-fix; executor inspects whether the CSS change accidentally broke the click target (e.g., flex-shrink-0 with no min-width could clip the input). Unlikely (the input is still in the visible flow), but possible.
- **Test 3 fails (text reflows on the label)**: `whitespace-nowrap` was bypassed; investigate Tailwind v4 scanner output.

## ROADMAP Success Criteria Coverage

This plan is a Phase 21 gap-closure plan for G-03 only. It does NOT touch the Phase 21 functional success criteria (those are owned by Plans 21-01..21-08). The fix is layout-only:

- D-08 loaderMode toggle (success criteria #1, #2, #3) — PRESERVED. Plan 21-08's tests still pass; the toggle is visible, functional, and persisted.
- LOAD-04 round-trip (success criterion #4) — UNCHANGED. No code-path modification.
- Criterion #5 (AtlasNotFoundError verbatim) — UNCHANGED. No loader logic touched.

## Self-Check: PASSED

- File `src/renderer/src/components/AppShell.tsx` modified (verified `git diff --stat HEAD~1 HEAD`).
- Commit `b8f2a0f` exists in git log on this worktree branch.
- File `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-11-toolbar-layout-regression-SUMMARY.md` written (this file).
- 6 `flex-shrink-0` occurrences confirmed in AppShell.tsx (grep).
- 1 `whitespace-nowrap` occurrence confirmed on the loader label span (grep).
- Plan 21-08's `tests/core/loader-atlas-less.spec.ts` still passes 5/5 (D-08 toggle logic intact).
- Pre-existing TS6133 + sampler-worker-girl failures confirmed via deferred-items.md (not regressions of this plan).

## Threat Flags

None — pure CSS class additions (`flex-shrink-0`, `whitespace-nowrap`) introduce no new security surface, no IPC payload change, no new file/network access. T-21-11-01 (UX horizontal overflow at narrow viewports) is accepted in the plan's threat register; no further mitigation is needed for typical desktop displays.
