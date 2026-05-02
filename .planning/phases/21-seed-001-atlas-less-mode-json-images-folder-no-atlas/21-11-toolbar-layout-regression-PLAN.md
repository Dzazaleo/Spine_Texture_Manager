---
phase: 21
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - src/renderer/src/components/AppShell.tsx
autonomous: false
requirements: [LOAD-01]
gap_closure: true
gap_closure_for: [G-03]
tags: [renderer, layout-regression, toolbar, flex, gap-closure, layout-stability]

must_haves:
  truths:
    - "Bisect identifies the commit + change that introduced the layout shift between commit f09c29b (pre-Phase-21) and HEAD"
    - "The hypothesis (flex-shrink discipline missing on toolbar children) is EMPIRICALLY CONFIRMED in the dev app BEFORE applying the fix (per ISSUE-008): the executor reproduces G-03 with the user's exact steps, observes the shift, and confirms the pattern matches a flex-compression regression rather than e.g., sticky-header gymnastics or scrollbar-gutter shift. If the hypothesis does NOT match observed behavior, the executor returns to bisect."
    - "The layout shift triggered by the per-attachment filter operation no longer occurs — panel position is stable across filter-on / filter-off transitions"
    - "The Phase 21 D-08 'Use Images Folder as Source' checkbox is PRESERVED — the fix does NOT revert the loaderMode toggle (gap is layout, not feature)"
    - "If the bisect identifies an AppShell.tsx flex/min-width regression: a minimal CSS fix is applied (e.g., `flex-shrink-0` on the toolbar cluster, `min-w-0` on a flex child, or `flex-wrap` on the header) — preserve all existing functionality"
    - "If the hypothesis is falsified by Step B's empirical verification, the plan is marked SPECULATIVE-FIX-THEN-VERIFY in the SUMMARY and Task 3 HUMAN-UAT routes back to Task 1 bisect with the new evidence (per ISSUE-008)"
    - "If no automated layout regression is reproducible in vitest+jsdom (jsdom does not compute layout), the plan documents the manual repro steps and applies a targeted CSS hardening to the most likely culprit identified by bisect, then HUMAN-UAT confirms in dev app"
    - "The toolbar cluster (`<div className=\"ml-auto flex items-center gap-2\">` at AppShell.tsx:1319) is reviewed for `flex-shrink-0` on its children — buttons and the loaderMode label — to prevent compression-driven shifts on filter-state changes"
  artifacts:
    - path: "src/renderer/src/components/AppShell.tsx"
      provides: "Layout-stable toolbar; filter-on/filter-off does not shift panel position"
      contains: "flex-shrink-0"
  key_links:
    - from: "src/renderer/src/components/AppShell.tsx header"
      to: "GlobalMaxRenderPanel + AnimationBreakdownPanel filter behavior"
      via: "Toolbar layout decoupled from panel content reflow"
      pattern: "flex-shrink-0|flex-wrap|min-w-0"
---

<objective>
Close G-03 — the UI layout regression where the panel slides downward toward the center of the window when the user uses the per-attachment filter feature. This regression was NOT present pre-Phase-21; the most likely cause is the new "Use Images Folder as Source" checkbox added to the toolbar in commit `39b72bb` (Plan 21-08).

The toolbar at `AppShell.tsx:1319` is `<div className="ml-auto flex items-center gap-2">` containing SearchBar + the new checkbox + Atlas Preview + Documentation + Optimize Assets + Save + Open. With the checkbox label adding ~200px of width, the right-aligned cluster may be wider than the available header space when the filter feature triggers a panel reflow (e.g., scrollbar appearance changes the available width). Without `flex-shrink-0` on the toolbar children, flex items compress unevenly when width changes.

**ISSUE-008 hypothesis-honesty note:** The HUMAN-UAT report says the panel "slides toward center" — this is a VERTICAL shift, not horizontal compression. Vertical shifts in a sticky-header layout typically come from:
1. Toolbar height change (text wrap → 2-line label) cascading through `sticky top-0` height computation.
2. Scrollbar gutter appearance/disappearance changing the parent's content height layout.
3. A reflow inside the panel changing scroll position.

The flex-shrink-discipline hypothesis predicts (1) — text-wrap of the long "Use Images Folder as Source" label causes the toolbar to grow to two rows, the sticky header doubles in height, and the panel slides downward to make room. This is plausible but NOT VERIFIED. Hypotheses (2) and (3) would require different fixes. Per ISSUE-008, this plan now treats the fix as **speculative-then-empirically-verify**: Task 1 reproduces the regression in the dev app and confirms the pattern matches hypothesis (1) before Task 2 applies the fix; if the empirical evidence falsifies (1), Task 1 routes back to broader bisect.

**Investigation strategy** (executor must run in order):
1. **Bisect AppShell.tsx between f09c29b and HEAD.** Identify the specific commit that introduced the regression.
2. **Reproduce the regression in the dev app and verify hypothesis match (per ISSUE-008).** This is a NEW required step. The executor runs `npm run dev`, drag-drops a fixture, uses the filter feature, observes the shift, captures screenshots/notes describing the shift's pattern (vertical shift magnitude, header height before/after, scrollbar appearance), and confirms the pattern matches the flex-shrink-discipline hypothesis. If the pattern does NOT match (e.g., the toolbar height doesn't change, but the panel still shifts), Task 1 routes back to bisect with the falsified-hypothesis evidence.
3. **Apply the minimal CSS fix.** Most likely targets, in order of likelihood:
   - Add `flex-shrink-0` to the toolbar cluster's children (buttons + label).
   - Add `min-w-0` to a flex child that needs to compress (e.g., the search bar wrapper).
   - Add `flex-wrap` to the header to allow the toolbar to wrap to a second row when narrow.
4. **HUMAN-UAT confirms** the fix in the dev app — filter-on / filter-off does not shift panel position.

**Why this is a separate plan** (not bundled with G-01/G-02): G-03 is a regression in a different subsystem (renderer layout) than G-01/G-02 (loader + IPC). Atomic-commit cleanliness keeps the layout fix reviewable independently.

**Why `autonomous: false`**: jsdom does not compute layout (no flex/grid simulation), so the regression is not automated-test-detectable. HUMAN-UAT is the only valid acceptance signal. The hypothesis-verify step in Task 1 (per ISSUE-008) is also a HUMAN-IN-THE-LOOP gate: the executor's "did this match the hypothesis?" judgment determines whether Task 2 proceeds or Task 1 re-runs.

Output: ~5-10 LoC change in `src/renderer/src/components/AppShell.tsx` (CSS class additions) + a HUMAN-UAT checkpoint confirming layout stability + an in-task hypothesis-verify gate (per ISSUE-008).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-CONTEXT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-HUMAN-UAT.md
@.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-08-renderer-roundtrip-SUMMARY.md
@CLAUDE.md

<interfaces>
Pre-Phase-21 AppShell.tsx header (commit f09c29b — recoverable via `git show f09c29b:src/renderer/src/components/AppShell.tsx`):
- Line 1314 (pre-Phase-21 numbering): `<div className="ml-auto flex items-center gap-2">` with these children: SearchBar, Atlas Preview, Documentation, Optimize Assets, Save, Open. ~6 elements.

Post-Phase-21 (commit 39b72bb / HEAD): same toolbar with ONE additional element — the loaderMode `<label>` containing `<input type="checkbox">` + `<span>Use Images Folder as Source</span>`. Inserted between SearchBar and Atlas Preview at line 1330-1344.

Toolbar cluster classes:
```jsx
<div className="ml-auto flex items-center gap-2">  // wrapper
  <SearchBar value={query} onChange={setQuery} />
  <label className="flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer select-none" ... >
    <input type="checkbox" ... className="cursor-pointer" />
    <span>Use Images Folder as Source</span>
  </label>
  <button className="border border-border rounded-md px-3 py-1 text-xs font-semibold ..." ... >Atlas Preview</button>
  <button className="border border-border rounded-md px-3 py-1 text-xs font-semibold ..." ... >Documentation</button>
  <button className="bg-accent text-panel rounded-md px-3 py-1 text-xs font-semibold ..." ... >Optimize Assets</button>
  ...
</div>
```

Header wrapper at line 1243:
```jsx
<header className="sticky top-0 z-20 flex items-center gap-4 px-6 py-3 border-b border-border bg-panel">
```

— `flex items-center gap-4` with NO `flex-wrap`. When children's total width exceeds the viewport, `min-content` width compression kicks in unpredictably.

Likely culprits (in order of bisect priority):
1. **The new label spans full text width without `flex-shrink-0`** — when the panel content forces a vertical scrollbar to appear, the available viewport narrows by ~17px, the toolbar cluster's children compress (label first because it's the only non-button), and the layout reflows. **HYPOTHESIS-1 — must be empirically verified per ISSUE-008.**
2. **Filter feature changes panel content height** — could invalidate sticky-header positioning if the header is `sticky top-0` AND a layout-affecting parent rule changed.
3. **An unrelated commit between f09c29b and HEAD** — if the bisect points to a non-21-08 commit, the fix may need to be elsewhere.

git log between f09c29b and HEAD touching AppShell.tsx:
```bash
git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx
```
At time of plan authoring, this returns:
- `39b72bb feat(21-08): wire loaderMode toggle through AppShell.tsx (D-08 renderer plumbing)`
- `211ac58 feat(21-05): widen SkeletonSummary.atlasPath to string|null (D-03 cascade)`

The 21-05 commit only changes type usages — unlikely layout impact.
The 21-08 commit adds the checkbox + a few useEffect deps changes — high layout impact.

Bisect target: 21-08's `+30 LoC` checkbox label addition is the most likely surface.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Bisect + diagnose + EMPIRICALLY verify hypothesis (ISSUE-008 fix)</name>
  <files>(no file changes; investigation-only)</files>
  <read_first>
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-HUMAN-UAT.md (G-03 reproduction + hypothesis)
    - .planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-08-renderer-roundtrip-SUMMARY.md (the commit that's the suspected culprit)
    - src/renderer/src/components/AppShell.tsx (current — header + toolbar at lines 1243-1395)
  </read_first>
  <action>
**Step A — Run the bisect to confirm the culprit commit:**

```bash
git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx
```

This returns the commits that touched AppShell.tsx since pre-Phase-21. Expect 2 commits: 211ac58 (type-only) and 39b72bb (loaderMode plumbing — the suspected culprit per the gap report's hypothesis).

**Step B — Read the diff for the culprit commit:**

```bash
git show 39b72bb -- src/renderer/src/components/AppShell.tsx | head -100
```

Confirm: the diff shows the new `<label>` element added in the toolbar cluster (between SearchBar and Atlas Preview), plus useEffect dep changes, plus the loaderMode state slot. The label is the layout-affecting addition.

**Step C — Check for `flex-shrink` discipline in the toolbar children:**

```bash
grep -n "flex-shrink\|min-w-\|flex-wrap" src/renderer/src/components/AppShell.tsx | head -10
```

Expect: ZERO matches in the header / toolbar area. None of the toolbar children declare `flex-shrink-0`. This is the smoking gun on static analysis — when the parent container's available width changes (e.g., a vertical scrollbar appears in the panel), the flex items compress per the default `flex-shrink: 1`. The text-content-bearing `<label>` (with the longest text in the cluster: "Use Images Folder as Source") will be the first to compress.

**Step D — Check the filter feature for any layout-side-effect:**

```bash
grep -n "query\|focusAttachment\|filter" src/renderer/src/panels/GlobalMaxRenderPanel.tsx | head -20
```

The filter feature changes panel content (rows displayed) which can change the panel's content height. If the panel's content height crosses a threshold (e.g., from no-scrollbar to scrollbar-needed), the available viewport width changes. This propagates to the sticky header.

**Step E — EMPIRICAL HYPOTHESIS VERIFICATION (ISSUE-008 fix; required before Task 2):**

Static analysis predicts a flex-shrink-discipline regression. But the HUMAN-UAT report says the panel "slides toward center" — a VERTICAL shift. Vertical shifts may come from:
  (a) Toolbar height change (label text wrap → 2-line label) increasing sticky-header height.
  (b) Scrollbar gutter appearance changing the parent's layout.
  (c) A reflow inside the panel itself.

Hypothesis (a) matches the static-analysis-predicted flex-compression regression. Hypotheses (b) and (c) would need different fixes. Per ISSUE-008, the executor must EMPIRICALLY verify hypothesis (a) before applying the fix in Task 2:

1. Build dev: `npm run dev` (Electron dev server boots; if not already running)
2. Drag-and-drop a fixture project (any — `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` works)
3. Wait for the panels to populate
4. **CAPTURE BASELINE**: note the toolbar height (the sticky-header strip at top), the panel header Y-position, and whether the panel has a vertical scrollbar
5. **TRIGGER REGRESSION**: use the per-attachment filter feature (focus an attachment, OR type in the search bar to narrow rows)
6. **CAPTURE OBSERVATION**: did the toolbar height change? (Specifically: did the loaderMode label wrap to a second line?) Did the panel's vertical scrollbar appear/disappear? Did the panel header Y-position shift? By how much?
7. **CLASSIFY**:
   - **Pattern A (matches hypothesis)**: toolbar height doubled (label wrapped) → panel shifted by exactly the same amount (the label's line-height) → cause is flex-compression of the toolbar label. **GO TO TASK 2 with hypothesis confirmed.**
   - **Pattern B (falsifies hypothesis)**: toolbar height did NOT change but the panel STILL shifted → the cause is in panel-internal layout, NOT toolbar compression. **STOP. Mark this plan as SPECULATIVE-FIX-THEN-VERIFY in the SUMMARY. Task 2's flex-shrink fix may be a no-op. Re-bisect with the new evidence: search for changes in panel-internal layout between f09c29b and HEAD.** The executor reports back to the user the falsifying evidence and waits for guidance.
   - **Pattern C (different cause)**: toolbar height did NOT change AND panel did NOT shift → the regression is no longer reproducible (intermittent / fixed by an unrelated change). **STOP. Mark G-03 as NOT REPRODUCIBLE in the SUMMARY. Skip Task 2 + Task 3.**

**Step F — Document findings.** Write a brief diagnosis as a comment in this task's verify output (executor uses Bash to print the diagnosis text — no file write needed). Example:

```
DIAGNOSIS:
- Culprit commit: 39b72bb (Phase 21-08 loaderMode toggle).
- Static analysis: the new <label> in the toolbar cluster has no flex-shrink-0.
- Empirical verification (ISSUE-008): {Pattern A | Pattern B | Pattern C}
  - Pattern A details: toolbar height before = Xpx, after = Ypx; label wrap observed = yes/no; panel Y shift = Zpx.
  - Pattern B details: toolbar height stable; panel still shifted by Zpx; suspect = panel-internal layout.
  - Pattern C details: regression no longer reproducible.
- Decision: {Proceed to Task 2 with hypothesis A | Stop and re-bisect | Stop, mark not-reproducible}
- (If Pattern A) Fix plan: add `flex-shrink-0` to the toolbar cluster's child <label> and
  buttons. Optionally add `whitespace-nowrap` to the label's <span> to
  prevent text wrap.
```
  </action>
  <verify>
    <automated>git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx | wc -l</automated>
  </verify>
  <acceptance_criteria>
    - Bisect command runs successfully: `git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx` returns at least 1 commit
    - 39b72bb is in the bisect output: `git log --oneline f09c29b..HEAD -- src/renderer/src/components/AppShell.tsx | grep -q "39b72bb"`
    - Confirmed no flex-shrink discipline currently: `grep -c "flex-shrink-0\|min-w-0" src/renderer/src/components/AppShell.tsx` returns 0 (or 1 if pre-existing in some unrelated area)
    - **Empirical hypothesis verification performed (per ISSUE-008)**: executor reports Pattern A / B / C in their task output WITH specific observations (toolbar height delta, panel Y shift). If Pattern B or C, the executor STOPS and reports back to the user; only Pattern A proceeds to Task 2.
    - Diagnosis text recorded in the executor's output (Step F template above).
  </acceptance_criteria>
  <done>Bisect confirms 39b72bb is the suspected culprit; current AppShell.tsx toolbar lacks flex-shrink discipline; empirical hypothesis verification (ISSUE-008) classifies as Pattern A/B/C; diagnosis recorded in executor's task output for SUMMARY consolidation. Only Pattern A advances to Task 2.</done>
</task>

<task type="auto">
  <name>Task 2: Apply minimal CSS hardening to the toolbar cluster (preserve loaderMode toggle) — gated on Task 1 Pattern A</name>
  <files>src/renderer/src/components/AppShell.tsx</files>
  <read_first>
    - src/renderer/src/components/AppShell.tsx (lines 1243-1395 — header + toolbar; lines 1319-1344 are the toolbar cluster + loaderMode label)
    - Task 1 diagnosis (from the previous task's executor output) — must be Pattern A to proceed
  </read_first>
  <behavior>
    - **PRECONDITION (per ISSUE-008): Task 1 must have classified the regression as Pattern A.** If Task 1 reported Pattern B or C, this task is SKIPPED and the executor reports back to the user before proceeding. The plan supports being marked as SPECULATIVE-FIX-THEN-VERIFY in the SUMMARY if Pattern B forces re-bisect.
    - **Add `flex-shrink-0` to the loaderMode <label>** at line 1330. This prevents the label's text from compressing/wrapping when the viewport narrows. Class becomes:
      `"flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer select-none flex-shrink-0"`
    - **Add `whitespace-nowrap` to the inner `<span>` of the label** (the "Use Images Folder as Source" text span at line 1343) for defense-in-depth — text never wraps regardless of width pressure. (This is redundant with `flex-shrink-0` on the parent but locks down the contract.)
    - **Add `flex-shrink-0` to the toolbar cluster's button children** (Atlas Preview, Documentation, Optimize Assets, Save, Open). These buttons currently have variable-length text content; `flex-shrink-0` keeps their widths stable.
    - **Optionally**: if the bisect/dev-app investigation reveals that the regression persists even with `flex-shrink-0` on all children, add `flex-wrap` to the header at line 1243: change `"sticky top-0 z-20 flex items-center gap-4 px-6 py-3 border-b border-border bg-panel"` to `"sticky top-0 z-20 flex flex-wrap items-center gap-4 px-6 py-3 border-b border-border bg-panel"`. **Only apply this if `flex-shrink-0` alone doesn't fix the regression** — `flex-wrap` is a more aggressive change that affects the header's vertical layout for narrow viewports.
    - **CRITICAL**: do NOT remove or revert the loaderMode toggle. The fix is layout-only.
    - **CRITICAL**: do NOT change the SearchBar component or its wrapper — the search-bar `<input>` is supposed to stretch (it has its own internal `flex-1` shape if applicable; the executor reads SearchBar.tsx to confirm).
  </behavior>
  <action>
**Step PRE — Confirm Task 1 Pattern A (per ISSUE-008):**

If the executor's Task 1 output classified the regression as Pattern B or C, STOP. Report to the user:
- "Task 1 classified the G-03 regression as Pattern {B|C}, falsifying the flex-shrink-discipline hypothesis. Plan 21-11 cannot proceed with the prescribed fix."
- "Pattern B observation summary: {executor's notes from Task 1 Step E}."
- Wait for guidance. Do NOT apply the CSS changes below.

If Task 1 confirmed Pattern A, proceed.

**Step A — Read the toolbar cluster in detail:**

```bash
sed -n '1319,1395p' src/renderer/src/components/AppShell.tsx
```

Confirm the children order: SearchBar → loaderMode label → Atlas Preview → Documentation → Optimize Assets → Save → Open.

**Step B — Apply the fix.** Edit `src/renderer/src/components/AppShell.tsx`:

1. **Loader label at ~line 1330** — append `flex-shrink-0`:

   Before:
   ```jsx
   <label
     className="flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer select-none"
     title="..."
   >
   ```

   After:
   ```jsx
   <label
     className="flex items-center gap-1.5 text-xs text-fg-muted cursor-pointer select-none flex-shrink-0"
     title="..."
   >
   ```

2. **Loader label inner span at ~line 1343** — append `whitespace-nowrap`:

   Before:
   ```jsx
   <span>Use Images Folder as Source</span>
   ```

   After:
   ```jsx
   <span className="whitespace-nowrap">Use Images Folder as Source</span>
   ```

3. **Atlas Preview button at ~line 1350-1357** — append `flex-shrink-0` to the className:

   Before:
   ```jsx
   className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent"
   ```

   After:
   ```jsx
   className="border border-border rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer hover:border-accent hover:text-accent active:bg-accent/10 focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-fg disabled:active:bg-transparent flex-shrink-0"
   ```

4. **Documentation button at ~line 1363-1369** — same pattern (append `flex-shrink-0`).

5. **Optimize Assets button at ~line 1370-1377** — same pattern.

6. **Save button at ~line 1381-1388** — same pattern.

7. **Open button (continues after Save)** — same pattern. Read the actual lines from the file (the sed range above shows the structure) and apply identically.

(The Tailwind v4 literal-class scanner discipline mentioned in earlier plans/comments matters here: append `flex-shrink-0` exactly as shown. The class string must remain a single literal — avoid template literals or computed strings.)

**Step C — Run typecheck + vitest:**

```bash
npm run typecheck
npm run test
```

Expected: green. CSS class additions are not type-checked; existing tests pass.

**Step D — Manual smoke recipe** (executor cannot perform — that's Task 3's HUMAN-UAT). For this task's completion, the file changes + green tests are sufficient.

**Conditional: if HUMAN-UAT in Task 3 reveals the regression PERSISTS after applying the above** — the executor must come back to this task and add `flex-wrap` to the header at line 1243. The plan supports this iteration.
  </action>
  <verify>
    <automated>grep -c "flex-shrink-0" src/renderer/src/components/AppShell.tsx</automated>
  </verify>
  <acceptance_criteria>
    - **PRECONDITION (per ISSUE-008): Task 1 classified Pattern A.** If Pattern B or C, this task is skipped — verify by checking executor's Task 1 output. (Auditor cannot easily grep this, so it relies on executor honesty + Task 3 HUMAN-UAT catching a wrong-fix.)
    - flex-shrink-0 added to multiple toolbar children: `grep -c "flex-shrink-0" src/renderer/src/components/AppShell.tsx` returns 5 or more (loader label + 5 buttons minimum)
    - whitespace-nowrap added to the loader label's span: `grep -q "whitespace-nowrap.*Use Images Folder as Source\|Use Images Folder as Source.*whitespace-nowrap" src/renderer/src/components/AppShell.tsx`
    - The loaderMode toggle is PRESERVED (not reverted): `grep -q "Use Images Folder as Source" src/renderer/src/components/AppShell.tsx` AND `grep -q "loaderMode === 'atlas-less'" src/renderer/src/components/AppShell.tsx`
    - typecheck green: `npm run typecheck 2>&1 | grep "error TS" | grep -v "scripts/probe-per-anim.ts" | wc -l` returns 0
    - Full vitest green: `npm run test 2>&1 | grep -E "Tests Failed|FAIL " | wc -l` returns 0
    - The Phase 21 D-08 toggle still functions: confirmed by Plan 21-08's test surface still passing (covered in npm run test above)
  </acceptance_criteria>
  <done>flex-shrink-0 + whitespace-nowrap applied to toolbar children + loaderMode label; loaderMode toggle preserved; typecheck + vitest green. Visual confirmation deferred to Task 3 HUMAN-UAT. (Gated on Task 1 Pattern A per ISSUE-008.)</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: HUMAN-UAT — confirm filter operation no longer shifts panel position</name>
  <what-built>
    - Bisect identified the suspected culprit (Plan 21-08 commit 39b72bb adding the loaderMode label) and the layout fragility (lack of flex-shrink discipline in the toolbar cluster).
    - Task 1 EMPIRICALLY VERIFIED the flex-shrink-discipline hypothesis matches the observed regression (per ISSUE-008 — Pattern A; if Pattern B/C, Task 2 was skipped and the executor already reported back to the user).
    - Task 2 applied flex-shrink-0 + whitespace-nowrap CSS hardening to the loaderMode label + toolbar buttons in AppShell.tsx.
    - The loaderMode toggle is preserved; Plan 21-08's success criteria still hold.
  </what-built>
  <how-to-verify>
**Test 1 (G-03 regression — filter does NOT shift panel position):**

1. Build dev: `npm run dev` (Electron dev server boots)
2. Drag-and-drop a fixture project (any — `fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json` works; the Girl fixture from Phase 21 UAT works too)
3. Wait for the panels to populate
4. Note the vertical position of the Global Max Render Source panel header (e.g., "Y = ~80px from top of window")
5. Use the per-attachment filter feature in the panel (select an attachment to focus, OR type in the search bar to narrow the displayed rows)
6. **Expected**: panel position is STABLE — Y position does not shift, no visible jump or slide downward
7. Toggle filter off (clear the search / unfocus the attachment) — panel position remains stable
8. Repeat with multiple filter operations — no cumulative drift

**Test 2 (Phase 21 D-08 toggle still functional — regression-of-the-fix check):**

1. With the same fixture loaded, click the "Use Images Folder as Source" checkbox
2. **Expected**: checkbox toggles, a resample fires, panels repopulate (loading spinner brief)
3. Click again to toggle back — panels repopulate via canonical path

**Test 3 (toolbar visual integrity at narrower viewport widths):**

1. Resize the dev window to ~900px wide
2. **Expected**: toolbar children remain visible — buttons may be tightly spaced but no compression-induced text reflow on the loaderMode label
3. Resize to ~600px wide (narrow)
4. **Expected**: toolbar may horizontally overflow (acceptable — sticky header isn't the place for a hamburger menu in this phase) BUT no vertical layout shift on filter operations

**If ANY test fails**: report which test + what was observed. The executor returns to Plan 21-11 Task 2 and adds `flex-wrap` to the header at line 1243 (the iteration mentioned in Task 2's "Conditional" note), then re-runs HUMAN-UAT. **If the filter STILL shifts the panel after `flex-wrap`, the original hypothesis was wrong (despite Task 1 Pattern A classification): mark plan as SPECULATIVE-FIX-FAILED in SUMMARY and re-route to broader bisect (per ISSUE-008 fallback).**

**If all tests pass**: type "approved" and the layout regression is closed.
  </how-to-verify>
  <resume-signal>Type "approved" if all 3 tests pass with no regression observed, OR describe what was observed (panel still shifts on filter / loaderMode toggle broken / toolbar wrapping at expected widths). If iteration is needed, the executor returns to Task 2 with the additional `flex-wrap` change. If even `flex-wrap` doesn't fix it, route back to Task 1 with falsifying evidence (per ISSUE-008).</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| renderer→DOM | Layout regression is a CSS / DOM rendering issue; no untrusted-input crossing |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-21-11-01 | UX confusion | flex-shrink-0 may cause horizontal overflow at very narrow viewport widths | accept | Real-world Spine Texture Manager users run on desktop displays >= 1024px wide; horizontal overflow at <600px is acceptable. If a future user reports this, add `flex-wrap` per Task 2's conditional. |
| T-21-11-02 | Spoofing | None — pure CSS change | accept | No security surface. |
| T-21-11-03 | Tampering | None — pure CSS change | accept | No security surface. |
</threat_model>

<verification>
1. Task 1: bisect confirms the suspected culprit commit + diagnosis recorded + ISSUE-008 hypothesis empirically verified (Pattern A/B/C classification).
2. Task 2 (gated on Task 1 Pattern A): `grep -c "flex-shrink-0" src/renderer/src/components/AppShell.tsx` returns 5+; typecheck + full vitest green; the loaderMode toggle (D-08) is preserved.
3. Task 3 HUMAN-UAT: filter operation does NOT shift panel position; loaderMode toggle still works; toolbar visual integrity is maintained at typical desktop viewport widths. If Task 1 was Pattern B/C or Task 3 fails after iteration, plan is marked SPECULATIVE-FIX-FAILED in SUMMARY (per ISSUE-008).
</verification>

<success_criteria>
- G-03 closed: per-attachment filter operation does not slide the panel toward window center.
- ISSUE-008 hypothesis-verify gate satisfied: Task 1 classified the observed regression as Pattern A (matches flex-shrink-discipline hypothesis) BEFORE Task 2 applied the fix; OR the plan was correctly halted on Pattern B/C with falsifying evidence reported to the user.
- The Phase 21 D-08 loaderMode toggle is preserved (visible, functional, persisted).
- typecheck + full vitest still green.
- HUMAN-UAT confirms the fix in the dev app on macOS (Linux/Windows parity is desktop-CSS-driven; not host-specific).
- If `flex-shrink-0` alone doesn't close G-03, the iteration adds `flex-wrap` to the header — the plan supports the iteration. If even iteration fails, plan is marked SPECULATIVE-FIX-FAILED and re-routes to broader bisect (per ISSUE-008 fallback).
</success_criteria>

<output>
After completion, create `.planning/phases/21-seed-001-atlas-less-mode-json-images-folder-no-atlas/21-11-toolbar-layout-regression-SUMMARY.md` recording: bisect outcome (which commit was the culprit per Task 1's diagnosis), **ISSUE-008 hypothesis-verify outcome (Pattern A/B/C classification + observation details)**, CSS classes added (flex-shrink-0 + whitespace-nowrap counts), whether `flex-wrap` was needed in the iteration, HUMAN-UAT outcome (3 tests pass / fail), any tailwind-token decisions, and (if applicable) the SPECULATIVE-FIX-FAILED route-back notes.
</output>
