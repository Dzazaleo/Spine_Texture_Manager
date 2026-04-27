---
phase: 09-complex-rig-hardening-polish
plan: 08
type: execute
wave: 6
depends_on: ["09-02", "09-03", "09-04", "09-05", "09-06", "09-07"]
files_modified:
  - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md
  - .planning/STATE.md
  - .planning/ROADMAP.md
autonomous: false
requirements: [N2.2]
tags: [phase-9, wave-6, close-out, n2-2-gate-signoff, manual-uat, roadmap-advance]

must_haves:
  truths:
    - "Full vitest suite GREEN — pre-Phase-9 baseline (≥275 passed + 1 skipped) preserved AND all 18 09-VALIDATION.md behaviors flipped to GREEN"
    - "fixtures/Girl wall-time gate (tests/main/sampler-worker-girl.spec.ts) GREEN with elapsed < 8000 ms (N2.2 contract <10000 ms with 2000 ms margin)"
    - "tests/arch.spec.ts Phase 9 named-anchor block hits real assertions (sampler-worker.ts file exists) and PASSES"
    - "D-102 byte-frozen invariants preserved — `git diff eb97923 -- src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts` is empty"
    - "Manual UAT signed off: 5 reproducer scripts (load Girl + sample completes < 10s + no dropped frames; both panels virtualize > 100 rows; Settings modal Cmd+, → samplingHz change → re-sample; rig-info tooltip shows skeleton.fps with correct wording; Help dialog → Spine docs link opens system browser)"
    - "09-VALIDATION.md `nyquist_compliant: true` and `wave_0_complete: true` set in frontmatter"
    - "STATE.md and ROADMAP.md advanced — Phase 9 marked complete; Phase 9 plan checkboxes flipped to [x]"
  artifacts:
    - path: ".planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md"
      provides: "Per-plan map filled; nyquist_compliant: true; UAT signoff section"
    - path: ".planning/STATE.md"
      provides: "Phase 9 closed; Milestone 1 status updated"
    - path: ".planning/ROADMAP.md"
      provides: "Phase 9 plan list flipped to [x]; status updated"
  key_links: []
---

<objective>
Phase 9 close-out. Run the full vitest suite, the fixtures/Girl wall-time gate, and the locked-file diff sweep; manually verify the 5 UAT reproducers; flip 09-VALIDATION.md to nyquist_compliant + wave_0_complete; advance STATE.md + ROADMAP.md to Phase 9 complete.

This is the LAST plan in Phase 9. After this commit lands:
- The N2.2 exit gate is GREEN
- All 5 ROADMAP deliverables ship (UI virtualization both panels, sampler worker, Settings modal, rig-info tooltip, in-app help)
- The 7 new test files + 2 extensions all carry GREEN assertions for the 18 VALIDATION.md behaviors
- The user can run `/gsd-verify-work 9` to confirm phase signoff

Plan 08 is **NOT autonomous** — it has one `checkpoint:human-verify` task at the end where the user manually walks through the 5 UAT reproducers in a real Electron run and signs off (or describes failures, in which case Plan 08 routes to a follow-up gap-closure phase).

Output:
- Updated `09-VALIDATION.md` with the per-plan map filled, all 18 rows ✅ GREEN, UAT signoff section, nyquist_compliant + wave_0_complete frontmatter flips
- Updated `.planning/STATE.md` reflecting Phase 9 close
- Updated `.planning/ROADMAP.md` with Phase 9 plan list checked off and Goal finalized
- One commit at the end summarizing the close-out
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md
@.planning/phases/09-complex-rig-hardening-polish/09-RESEARCH.md
@.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run automated exit-criteria sweep + locked-file diff sweep + 09-VALIDATION.md per-plan map fill</name>
  <files>.planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md</files>
  <read_first>
    - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (full file — 18 behavior rows + Wave 0 Requirements + Manual-Only Verifications + Validation Sign-Off checklist)
    - .planning/phases/09-complex-rig-hardening-polish/09-CONTEXT.md (§canonical_refs §Locked invariants — list of files that MUST diff to empty vs commit eb97923)
    - .planning/phases/09-complex-rig-hardening-polish/09-01-wave0-scaffold-PLAN.md through 09-07-help-dialog-PLAN.md (the 7 plan summaries — used to fill the per-plan map column "Plan target → Plan ID" in 09-VALIDATION.md)
  </read_first>
  <action>
Step 1. Run the full automated exit-criteria sweep:

```bash
# Test suite — full pass
npm run test 2>&1 | tail -10

# Wall-time gate — explicit run for visibility
npm run test tests/main/sampler-worker-girl.spec.ts 2>&1 | tail -10

# Typecheck both projects
npx tsc --noEmit -p tsconfig.node.json 2>&1 | tail -5
npx tsc --noEmit -p tsconfig.web.json 2>&1 | tail -5

# Production build
npx electron-vite build 2>&1 | tail -10
test -f out/main/sampler-worker.cjs && echo "sampler-worker.cjs OK"
test -f out/main/index.cjs && echo "index.cjs OK"
test -f out/preload/index.cjs && echo "preload/index.cjs OK"

# CLI smoke (D-102 byte-frozen — must remain unchanged)
npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json 2>&1 | tail -20

# Locked-file diff sweep vs Phase 9 baseline (commit eb97923)
echo "=== Locked file diffs (must all be empty) ==="
for f in src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts src/renderer/src/components/DropZone.tsx src/renderer/src/modals/SaveQuitDialog.tsx; do
  echo "--- $f ---"
  git diff eb97923 -- "$f" | wc -l
done
```

Each of the 6 locked files MUST report `0` lines of diff. If any reports non-zero, the offending plan illegally modified a byte-frozen file — STOP, identify the regression, revert.

Step 2. Capture the metrics:

```bash
# Test count delta
echo "=== Test count ==="
npm run test 2>&1 | grep -E "Tests" | tail -3

# Phase 9-specific test files
echo "=== Phase 9 test files ==="
ls tests/main/sampler-worker*.spec.ts tests/renderer/{global-max,anim-breakdown,settings,rig-info,help}-*.spec.tsx 2>/dev/null

# Build size
echo "=== Build size ==="
du -sh out/ 2>/dev/null
```

Step 3. Fill the per-plan map in 09-VALIDATION.md.

The current 09-VALIDATION.md table has 18 behavior rows with the `Plan target` column populated but the `Status` column showing `⬜ pending`. After this task:
- Map each row's `Plan target` to the actual plan ID (09-02 / 09-03 / etc.) by reading 09-VALIDATION.md row's "Wave" column + cross-referencing PLAN.md files. The Wave column already encodes this:
  - Wave 0 → Plan 09-01 (test scaffolds)
  - Wave 1 → Plan 09-02 (sampler-worker + IPC)
  - Wave 2 → Plans 09-03 + 09-04 (virtualization)
  - Wave 3 → Plan 09-06 (settings/tooltip — Wave 3 in VALIDATION.md is referred to as "Wave 4" in the actual plan structure; reconcile by treating the VALIDATION.md "Wave" column as approximate and use the actual plan ID per behavior)

For each of the 18 rows, change Status from `⬜ pending` to `✅ green` (after running the automated test for that row). If any row is still RED, STOP and route to a gap-closure phase.

Add a new column `Plan ID` (or update an existing column) to the table so each row records which plan implemented it. Example:

```markdown
| #  | Plan target | Wave | Plan ID | Requirement / Decision | Behavior | Test Type | Automated Command | File Exists | Status |
| 1  | sampler-worker | 1 | 09-02 | N2.2 | fixtures/Girl wall-time < 8000 ms | integration | vitest run tests/main/sampler-worker-girl.spec.ts | ✅ Wave 0 + Wave 1 | ✅ green |
| 2  | sampler-worker | 1 | 09-02 | D-190/D-193 | byte-identical Map-key parity | integration | vitest run tests/main/sampler-worker.spec.ts -t "byte-identical" | ✅ | ✅ green |
| ... | ... | ... | ... | ... | ... | ... | ... | ... | ... |
```

Step 4. Add an "Exit Criteria Sweep" section at the bottom of 09-VALIDATION.md with the captured outputs:

```markdown
---

## Exit Criteria Sweep — <2026-04-DD>

### Automated test suite

```
$ npm run test
Test Files  XX passed (XX)
Tests       XXX passed (XXX) | 1 skipped
```

### N2.2 wall-time gate

```
[N2.2] Girl sample: <ELAPSED> ms total
```

Budget: <8000 ms (margin from 10000 ms N2.2 contract). Result: GREEN.

### Locked-file invariants (Phase 5 D-102 + Phase 8 D-145 + 8.1 D-171 + 8.1 D-165)

| File | Diff vs eb97923 |
|------|-----------------|
| src/core/sampler.ts | 0 lines |
| scripts/cli.ts | 0 lines |
| src/core/loader.ts | 0 lines |
| src/core/project-file.ts | 0 lines |
| src/renderer/src/components/DropZone.tsx | 0 lines |
| src/renderer/src/modals/SaveQuitDialog.tsx | 0 lines |

### Build

- `npx electron-vite build` exits 0
- `out/main/sampler-worker.cjs` size: ~XX KB
- `out/main/index.cjs` size: ~XX KB
- `out/preload/index.cjs` size: ~XX KB
- Total `out/` size: ~XX MB

### CLI smoke (D-102 byte-frozen output preservation)

```
$ npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json
[CLI output verbatim — should match Phase 5 baseline byte-for-byte]
```

### Phase 9 grep audit (mandatory invariants)

```bash
$ grep -rn "worker_threads\|new Worker" src/ | head -5
src/main/sampler-worker.ts:NN:import { parentPort, workerData } from 'node:worker_threads';
src/main/sampler-worker-bridge.ts:NN:import { Worker } from 'node:worker_threads';
src/main/sampler-worker-bridge.ts:NN:    const worker = new Worker(workerPath, { workerData: params });

$ ! grep -E "from ['\"]electron['\"]|from ['\"]react['\"]" src/main/sampler-worker.ts
[empty — confirms Layer 3 invariant]
```
```

Step 5. Flip frontmatter:
- `nyquist_compliant: true`
- `wave_0_complete: true`
- `status: ready-for-uat` (or whatever the existing status taxonomy uses)

Save 09-VALIDATION.md.
  </action>
  <verify>
    <automated>npm run test 2>&amp;1 | tail -3 | grep -E "passed" &amp;&amp; npm run test tests/main/sampler-worker-girl.spec.ts 2>&amp;1 | grep -E "passed" &amp;&amp; for f in src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts src/renderer/src/components/DropZone.tsx src/renderer/src/modals/SaveQuitDialog.tsx; do test -z "$(git diff eb97923 -- $f)" || (echo "REGRESSION in $f"; exit 1); done &amp;&amp; npx electron-vite build 2>&amp;1 | tail -2 &amp;&amp; grep -q "nyquist_compliant: true" .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - npm run test exits 0; total Tests count >= pre-Phase-9 baseline (275 + 1 skipped) PLUS Phase 9 GREEN additions (estimated ~18-25 new GREEN tests across the 7 new spec files + 2 extensions)
    - tests/main/sampler-worker-girl.spec.ts GREEN; console output includes `[N2.2] Girl sample: <N> ms total` with N < 8000
    - Each of 6 locked files reports 0 lines of diff vs eb97923 baseline
    - npx electron-vite build exits 0; out/main/sampler-worker.cjs exists with size > 0
    - npx tsc --noEmit -p tsconfig.node.json AND -p tsconfig.web.json both exit 0
    - npm run cli -- fixtures/SIMPLE_PROJECT/SIMPLE_TEST.json exits 0; output matches the Phase 5 byte-frozen baseline (CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000)
    - 09-VALIDATION.md frontmatter has `nyquist_compliant: true` and `wave_0_complete: true`
    - 09-VALIDATION.md table has all 18 rows showing `✅ green` in the Status column
    - 09-VALIDATION.md has a new "Exit Criteria Sweep — <date>" section with the captured metrics
  </acceptance_criteria>
  <done>Automated exit-criteria sweep is GREEN; per-plan map filled; 18 VALIDATION behaviors confirmed; locked-file invariants preserved. Ready for manual UAT.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Manual UAT — 5 reproducer scripts</name>
  <what-built>
Phase 9 ships:
- Sampler worker_threads worker → fixtures/Girl samples in &lt; 10 s on the main thread
- TanStack Virtual virtualization in BOTH GlobalMaxRender + AnimationBreakdown panels (threshold N=100)
- Settings modal under Edit→Preferences (Cmd/Ctrl+,) for samplingHz with 60/120/240/Custom
- Rig-info tooltip on filename chip showing skeleton.fps with the load-bearing wording
- Help dialog under Help→Documentation with 7 sections + external links to Spine docs
  </what-built>
  <files>n/a — manual verification, no automated artifacts written</files>
  <action>Walk through the 5 reproducer scripts below in a real `npm run dev` Electron run; confirm each behaves as described or report failures.</action>
  <verify><automated>n/a — manual checkpoint; resume on user signal</automated></verify>
  <done>User types "approved" (all reproducers PASS) or describes failures (routes to gap-closure phase).</done>
  <how-to-verify>
**Reproducer 1 — N2.2 wall-time gate (fixtures/Girl)**

1. `npm run dev`
2. Drag `fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json` (or its parent folder) onto the app window
3. Observe: an indeterminate spinner appears in the header during sampling (NOT a determinate progress bar — RESEARCH §Q4)
4. The Global Max Render panel populates within 10 seconds (target: < 8 s after warm-up)
5. Open DevTools → Performance tab; record while loading the rig a second time; verify there are < 3 dropped UI frames during the sampling window (CONTEXT.md §Manual-Only Verifications)

Expected: Sample completes; table populates; no UI freeze during sampling.

**Reproducer 2 — Both panels virtualize at >100 rows**

1. With fixtures/Girl loaded, switch to the Animation Breakdown tab
2. Click an animation card to expand it; if its row count exceeds 100, the inner row list should scroll smoothly
3. Open DevTools → Elements; inspect the expanded card's body; the rendered `<tr>` count should be ≤ 60 (window + overscan)
4. Switch back to Global Max Render tab; if the Girl rig's total row count exceeds 100, the panel virtualizes
5. Open DevTools → Elements; the panel's `<tbody>` should contain ≤ 60 `<tr>` elements at any scroll position
6. Scroll the Global Max Render table; the sticky `<thead>` stays at the top; sort by clicking column headers; type in the search box; toggle row checkboxes — all should function without throwing

Expected: Both panels virtualize correctly; existing interactions preserved.

**Reproducer 3 — Settings modal samplingHz change triggers re-sample**

1. With fixtures/Girl loaded, press Cmd+, (macOS) or Ctrl+, (Win/Linux)
2. The Preferences modal opens
3. Change samplingHz from 120 to 240 via the dropdown (or Custom + 240)
4. Click Apply
5. Observe: the spinner appears again (re-sampling at the new rate)
6. After re-sample completes, peaks may be slightly different (240 Hz catches more sub-frame peaks than 120 Hz)
7. Press Cmd+S — the project saves with samplingHz=240 (verify by reopening the .stmproj and confirming the dropdown defaults to 240)

Expected: Settings modal works cross-platform; re-sample fires; project saves.

**Reproducer 4 — Rig-info tooltip on filename chip**

1. With any rig loaded (SIMPLE_PROJECT or fixtures/Girl), hover the filename chip in the header
2. A multi-line tooltip appears showing:
   - Skeleton name
   - bones / slots / attachments / animations / skins counts
   - `skeleton.fps: <N> (editor metadata — does not affect sampling)`
3. The wording on the skeleton.fps line MUST be exactly as shown (verify by reading verbatim)
4. Move the cursor away — the tooltip dismisses

Expected: Tooltip content correct; load-bearing wording matches src/core/sampler.ts:41-44.

**Reproducer 5 — Help dialog opens external link in system browser**

1. Click Help → Documentation in the menu bar
2. The Documentation dialog opens with 7 sections
3. Scroll through the sections; each is readable and reasonable
4. Section 7 explains samplingHz vs skeleton.fps; the wording matches the rig-info tooltip
5. Click "Spine Runtimes reference" (or any other external link button)
6. Your default system browser opens at the linked Spine docs URL
7. Close the dialog (Close button / Escape / click-outside) — File menu re-enables (08.2 D-184 modalOpen suppression releases)

Expected: Dialog content correct; external link handoff works.

**After verifying all 5 reproducers:** type one of these in your response:

- `approved — all 5 reproducers PASS` → Plan 08 proceeds to Task 3 (close-out commits)
- `failed: <reproducer-N>: <description>` → Plan 08 STOPS; the failure routes to a gap-closure phase (`/gsd-plan-phase 9 --gaps` or a follow-up phase if the gap is large)
  </how-to-verify>
  <resume-signal>Type "approved" or describe failures.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Advance STATE.md and ROADMAP.md; final commit</name>
  <files>.planning/STATE.md, .planning/ROADMAP.md</files>
  <read_first>
    - .planning/STATE.md (current state — last updated post-08.2 close)
    - .planning/ROADMAP.md (Phase 9 entry at lines 333-348 + the Plans subsection that lists `[ ]` plan checkboxes)
    - .planning/phases/09-complex-rig-hardening-polish/09-VALIDATION.md (post-Task-1 — confirms Phase 9 GREEN signoff)
    - 08.2 close-out commit (eb97923) for the precedent commit message structure
  </read_first>
  <action>
Step 1. Update .planning/ROADMAP.md Phase 9 section.

Find the Phase 9 entry (around line 333). Update:

- The Goal line: replace any `[To be planned]` placeholder with the actual finalized goal (paraphrase the 5 ROADMAP deliverables succinctly):
  "Phase 9: Complex-rig hardening + polish. Sampler offloaded to a worker_threads worker (D-190 unconditional); UI virtualization in both panels (D-191/D-192/D-195/D-196 — TanStack Virtual, threshold N=100); Settings modal exposing samplingHz; rig-info tooltip showing skeleton.fps as editor metadata; in-app Documentation dialog with 7 canonical sections. N2.2 GREEN: fixtures/Girl samples in &lt; 10 s on the main thread."

- The Plans count: `**Plans:** 8/8 plans complete`

- The plan checkbox list: flip every `- [ ]` to `- [x]` for the 8 Phase 9 plans:
  - [x] 09-01-wave0-scaffold-PLAN.md — Wave 0 test scaffolds + @tanstack/react-virtual install + arch.spec.ts named anchor
  - [x] 09-02-sampler-worker-PLAN.md — Wave 1 worker_threads worker + IPC + preload + project-io refactor + AppShell spinner; N2.2 gate GREEN
  - [x] 09-03-globalmax-virtualization-PLAN.md — Wave 2 GlobalMaxRenderPanel TanStack Virtual at N=100 (D-191/D-195)
  - [x] 09-04-anim-breakdown-virtualization-PLAN.md — Wave 2 AnimationBreakdownPanel per-card inner virtualization with measureElement (D-196)
  - [x] 09-05-menu-surface-PLAN.md — Wave 3 Edit→Preferences + Help→Documentation menu items + shell:open-external allow-listed bridge
  - [x] 09-06-settings-and-tooltip-PLAN.md — Wave 4 SettingsDialog + samplingHz re-sample useEffect + rig-info tooltip on filename chip + editorFps surfaced through summary
  - [x] 09-07-help-dialog-PLAN.md — Wave 5 HelpDialog static React (no markdown library) + 7 canonical sections + external links via Plan 05 allow-list
  - [x] 09-08-close-out-PLAN.md — Wave 6 close-out: exit-criteria sweep + manual UAT + STATE.md/ROADMAP.md advance

Step 2. Update .planning/STATE.md.

Replace the current `## Current phase` and `## Current plan` sections with:

```markdown
## Current phase

**Phase 9 COMPLETE — Complex-rig hardening + polish, all 5 ROADMAP deliverables shipped, N2.2 exit gate GREEN, manual UAT signed off <DATE>.** All 8 plans (09-01 through 09-08) executed and closed: greenfield worker_threads sampler in src/main/sampler-worker.ts; TanStack Virtual integration in both panels with threshold N=100; SettingsDialog + samplingHz re-sample wiring; rig-info tooltip with load-bearing skeleton.fps wording; HelpDialog with 7 static sections + allow-listed external links. fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json wall-time gate <8000 ms (warm-up + 2000 ms margin from 10000 ms N2.2 contract). All D-102 byte-frozen invariants preserved (sampler.ts / cli.ts / loader.ts / project-file.ts diffs vs eb97923 all 0 lines). Ready for `/gsd-verify-work 9`; Phase 9 unblocked for milestone v1.0 close.

## Current plan

**Plan 09-08 COMPLETE (close-out, Wave 6).** Full close-out signed off <DATE>. Automated exit-criteria sweep GREEN: full vitest <NEW-TEST-COUNT> passed (surpasses target ≥<expected>); both typecheck projects clean; npx electron-vite build green with out/main/sampler-worker.cjs emitted (~<SIZE> KB); 6 locked-file diffs vs commit eb97923 baseline all 0 lines; npm run cli exits 0 with CIRCLE 2.018 / SQUARE 1.500 / TRIANGLE 2.000 byte-for-byte unchanged from Phase 5 baseline; all 18 09-VALIDATION.md behaviors flipped to ✅ green; 09-VALIDATION.md frontmatter `nyquist_compliant: true` + `wave_0_complete: true`; ROADMAP.md Phase 9 Goal finalized + all 8 plan checkboxes flipped to [x]. Manual UAT signed off <DATE>: (1) N2.2 wall-time PASS — fixtures/Girl samples in <ELAPSED> ms with no dropped UI frames during sampling per DevTools Performance recording; (2) Both panels virtualize correctly above N=100, sticky thead intact, all interactions preserved; (3) Settings modal Cmd/Ctrl+, → samplingHz change triggers re-sample, project saves with new rate; (4) Rig-info tooltip wording matches sampler.ts:41-44 verbatim; (5) HelpDialog → Spine docs link opens system browser via allow-listed shell.openExternal.
```

Update progress numbers in STATE.md frontmatter:
```yaml
progress:
  total_phases: 12
  completed_phases: 12  # was 11; +1 for Phase 9
  total_plans: 62       # was 54; +8 for Phase 9 (09-01 through 09-08)
  completed_plans: 63   # was 55; +8 for Phase 9
  percent: 100
status: phase-9-complete-ready-for-milestone-close
last_updated: "<ISO timestamp>"
```

Step 3. Run final commit:

```bash
git add .planning/phases/09-complex-rig-hardening-polish/ .planning/STATE.md .planning/ROADMAP.md
git commit -m "docs(09): complete Phase 9 — complex-rig hardening + polish (N2.2 GREEN)

8 plans executed (Waves 0-6); all 18 09-VALIDATION.md behaviors GREEN.

Highlights:
- Sampler worker_threads (D-190 unconditional, D-193 path-based protocol)
  → fixtures/Girl/TOPSCREEN_ANIMATION_JOKER.json wall-time <8000 ms
  → N2.2 exit gate GREEN
- TanStack Virtual virtualization in both panels at N=100 threshold
  (D-191/D-192/D-195/D-196)
- SettingsDialog + samplingHz re-sample (Edit→Preferences, Cmd/Ctrl+,)
- Rig-info tooltip with load-bearing skeleton.fps wording aligned to
  sampler.ts:41-44 (CLAUDE.md fact #1)
- HelpDialog static React (no markdown library) with 7 canonical
  sections; external links via shell:open-external allow-list
  (T-09-05-OPEN-EXTERNAL defense)

D-102 byte-frozen invariants preserved (sampler.ts / cli.ts / loader.ts /
project-file.ts diffs vs eb97923 baseline all 0 lines).

Manual UAT signed off — 5 reproducers PASS.

Phase 9 closed; Milestone 1 v1.0 ready for close.
"
```
  </action>
  <verify>
    <automated>grep -q "Phase 9 COMPLETE" .planning/STATE.md &amp;&amp; grep -q "8/8 plans complete" .planning/ROADMAP.md &amp;&amp; git log -1 --oneline | grep -q "Phase 9"</automated>
  </verify>
  <acceptance_criteria>
    - .planning/ROADMAP.md Phase 9 entry has all 8 plan checkboxes flipped to [x]
    - .planning/ROADMAP.md Phase 9 entry shows "**Plans:** 8/8 plans complete"
    - .planning/STATE.md `## Current phase` block reflects Phase 9 COMPLETE with the close-out date and key metrics
    - .planning/STATE.md `## Current plan` block reflects Plan 09-08 COMPLETE
    - .planning/STATE.md frontmatter `progress.completed_phases` incremented; `progress.completed_plans` incremented by 8
    - One git commit lands with subject line `docs(09): complete Phase 9 — complex-rig hardening + polish (N2.2 GREEN)`
    - No uncommitted changes remain in .planning/
  </acceptance_criteria>
  <done>STATE.md and ROADMAP.md advanced; Phase 9 close-out commit lands. Phase 9 is closed; ready for /gsd-verify-work 9.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| n/a — Plan 08 is a documentation/close-out plan | No code surfaces touched. The automated sweep runs read-only commands (npm test / git diff / electron-vite build). Manual UAT is read-only verification by the user. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-08-DIFF | Tampering | Locked-file invariant verification | mitigate | The git diff sweep (Task 1) hard-fails the verify command if ANY locked file (sampler.ts, cli.ts, loader.ts, project-file.ts, DropZone.tsx, SaveQuitDialog.tsx) diffs vs eb97923. This is the canonical D-102 + D-145 + D-165 + D-171 invariant check. |
| T-09-08-UAT-FALSE-POSITIVE | Authorization (false approval) | Manual UAT signoff | accept | The user is the sole approver. If a reproducer fails but the user types "approved" anyway, that's the user's call. The 5 reproducers are deliberately structured to surface obvious regressions; subtle issues may slip through manual UAT but will surface in the automated test suite (which is the primary gate). |
| T-09-08-COMMIT | Tampering | Final close-out commit | accept | The commit is reviewed by the user. No external code paths affected. |
</threat_model>

<verification>
After Task 3:
1. git log --oneline | head -3 — top commit is the Phase 9 close-out
2. grep "Phase 9 COMPLETE" .planning/STATE.md — match found
3. grep "8/8 plans complete" .planning/ROADMAP.md — match found
4. .planning/phases/09-complex-rig-hardening-polish/ contains 8 plans + 8 SUMMARYs (one per plan) + the original CONTEXT/RESEARCH/PATTERNS/VALIDATION/DISCUSSION-LOG files
5. /gsd-verify-work 9 (manual; not part of this plan) — when invoked by the user, validates phase signoff against ROADMAP requirement coverage
</verification>

<success_criteria>
- [ ] Automated exit-criteria sweep GREEN (vitest + typecheck + build + locked-file diffs + CLI smoke)
- [ ] 09-VALIDATION.md per-plan map filled; all 18 behaviors ✅ green; nyquist_compliant: true + wave_0_complete: true
- [ ] Manual UAT signed off — 5 reproducers PASS
- [ ] STATE.md advanced — Phase 9 marked complete; Milestone 1 status updated
- [ ] ROADMAP.md advanced — Phase 9 Goal finalized; 8 plan checkboxes flipped to [x]
- [ ] Final close-out git commit lands
- [ ] D-102 byte-frozen invariants preserved (`git diff eb97923 -- src/core/sampler.ts scripts/cli.ts src/core/loader.ts src/core/project-file.ts` empty)
- [ ] Ready for /gsd-verify-work 9
- [ ] `<threat_model>` block present (above)
</success_criteria>

<output>
After completion, create `.planning/phases/09-complex-rig-hardening-polish/09-08-SUMMARY.md` summarizing:
- Final test count (pre-Phase-9 baseline + Phase 9 GREEN delta)
- Wall-time measurement against fixtures/Girl
- Locked-file invariant verification (6 files × 0 lines diff)
- Manual UAT signoff details (5 reproducers; date)
- STATE.md + ROADMAP.md updates
- Pointer to /gsd-verify-work 9 next
</output>
