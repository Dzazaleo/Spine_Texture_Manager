---
phase: 41-spine-animation-viewer
plan: 03
subsystem: renderer-ui
tags: [react, appshell, toolbar, modal-wiring, project-change-cleanup, pitfall-7, pitfall-6]

# Dependency graph
requires:
  - phase: 41-01-foundation
    provides: spine-player npm dep + IPC channel (already landed in Wave 1)
  - phase: 41-02-modal
    provides: AnimationPlayerModal React component + AnimationPlayerModalProps export (parallel worktree — resolves on merge-back; see DEF-41-03-01)
provides:
  - "AppShell.tsx imports AnimationPlayerModal and renders it gated on animationViewerOpen"
  - "Animation Viewer toolbar button between Atlas Preview and Documentation (D-03a)"
  - "animationViewerOpen useState slot + onClickAnimationViewer useCallback (mirrors atlasPreviewOpen lifecycle)"
  - "modalOpen derivation updated in BOTH OR-chain body AND useEffect dep array (Pitfall 7)"
  - "Project-change cleanup useEffect on [summary] closes viewer when summary identity flips (VIEWER-08, Pitfall 6)"
affects: [phase-41-wave-2-merge-back, phase-41-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Animation Viewer button mirrors Atlas Preview byte-for-byte (className identical for Tailwind v4 literal-class scanner discipline)"
    - "Project-change cleanup as a sibling useEffect on [summary] (mirrors localSummary reset pattern at line 281-283); chosen over folding into the existing effect for cleaner audit trail (Plan-PATTERNS Option 1)"

key-files:
  created:
    - "tests/renderer/app-shell-animation-viewer.spec.tsx (13 source-grep tests covering all 7 AppShell insertion sites)"
  modified:
    - "src/renderer/src/components/AppShell.tsx (72 insertions, 0 deletions across 8 surgical edits)"
    - ".planning/phases/41-spine-animation-viewer/deferred-items.md (+1 entry: DEF-41-03-01 cross-plan import unresolved at commit time)"

key-decisions:
  - "Edit 4 — modalOpen OR-chain BODY insertion: positioned `animationViewerOpen ||` BEFORE `documentationBuilderOpen;` (not at the end of the chain as Plan §action suggested). Rationale: Task 1 test (11) regex `/animationViewerOpen\\s*\\|\\|/` requires `animationViewerOpen` to be followed by `||` — which is only true if it's NOT the chain terminator. Letting `documentationBuilderOpen` remain the historical terminator also preserves chronological audit-trail ordering (Phase 20 → Phase 41 follows the original order)."
  - "Edit 8 — project-change cleanup as sibling useEffect: chose Plan-PATTERNS §Site 7 Option 1 (new sibling useEffect on `[summary]`) over Option 2 (fold into existing localSummary effect). Cleaner audit trail; the new effect carries its own VIEWER-08 + Pitfall 6 comment block and is searchable by phase number."
  - "Test 8 + Test 11 regex revisions in Task 2 (Rule 1 deviation): the Plan-§task-1 spec contained regex patterns inconsistent with the actual JSX whitespace format and the OR-chain terminator-vs-comment-semicolon ambiguity. Both fixes are described in the Deviations section below. No invariant intent was relaxed — only the matching mechanism was adjusted to test the real surface."

requirements-completed:
  - VIEWER-04   # button reachable + JSX mount
  - VIEWER-08   # project-change cleanup useEffect (the AppShell-level half; Plan 02 owns the modal-level dispose half)

# Metrics
duration: 7min
completed: 2026-05-15
---

# Phase 41 Plan 03: AppShell Wire-Up Summary

**8 surgical insertions into `AppShell.tsx` make the Animation Viewer modal reachable from the toolbar, participate correctly in the global `modalOpen` derivation (File-menu auto-suppression contract), and close cleanly when the user switches to a different project — without duplicating any work owned by Plan 02 (the modal component itself).**

## Performance

- **Duration:** 7 min (started 15:46:51 UTC, completed 15:54:11 UTC)
- **Tasks:** 2 (RED spec → GREEN implementation, canonical TDD gate)
- **Commits:** 3 atomic (test → feat → chore)
- **Files modified:** 2 source files + 1 deferred-items log
- **Net diff:** +147 (spec, new file), +72 / 0 (AppShell.tsx, additive)

## Accomplishments

- **Toolbar button:** Animation Viewer button rendered between Atlas Preview and Documentation (D-03a). Class string byte-identical to Atlas Preview for Tailwind v4 literal-class scanner discipline (Pitfall 3). Disable predicate mirrors Atlas Preview per D-03c (`effectiveSummary.peaks.length === 0` — no other gating).
- **State + callback:** `animationViewerOpen` boolean useState slot + `onClickAnimationViewer` useCallback mirror the `atlasPreviewOpen` lifecycle exactly. No snapshot state — the modal reads `effectiveSummary + loaderMode` directly on mount (D-04b: no persistence).
- **JSX mount:** `<AnimationPlayerModal summary={effectiveSummary} loaderMode={loaderMode} onClose={() => setAnimationViewerOpen(false)} />` mounted conditionally after the `<AtlasPreviewModal>` block. Position in the modal-mount section preserves the locked rendering order (AtlasPreviewModal → AnimationPlayerModal → DocumentationBuilderDialog → SaveQuitDialog → SettingsDialog → HelpDialog).
- **`modalOpen` derivation:** Both halves of Pitfall 7 satisfied — `animationViewerOpen ||` appears in the OR-chain BODY at AppShell.tsx:1646 (with explanatory comment block) AND `animationViewerOpen` appears in the useEffect dep array at AppShell.tsx:1681. The File menu (Save / Save As / Reload) is now auto-disabled while the viewer is open per the 08.2 D-184 contract.
- **Project-change cleanup:** New sibling useEffect on `[summary]` calls `setAnimationViewerOpen(false)` (VIEWER-08, Pitfall 6). When a fresh `summary` identity arrives (resample, Settings-driven re-sample, locate-skeleton recovery, drop/Open of a different project), the viewer modal flips closed; the modal's conditional mount unmounts; the modal's own `useEffect` cleanup (Plan 02) fires `player.dispose()` — chain of responsibility ends with WebGL teardown.
- **13 source-grep tests:** All 7 insertion sites are now under regression guard. The spec reads `AppShell.tsx` as text and asserts each surgical edit landed at the right place with the right shape; no jsdom render needed (AppShell is too large for stable jsdom mounting).

## Task Commits

Each task atomic; canonical RED → GREEN gate observed:

1. **Task 1 (RED) — `a757e76`:** `test(41-03): add failing source-grep spec for AppShell viewer wiring` — 13 tests, 12 RED (test 7 passes early because the canonical className already appeared twice in the source: Atlas Preview button + Documentation button — `>= 2` is met before insertion).
2. **Task 2 (GREEN) — `e532695`:** `feat(41-03): wire AnimationPlayerModal into AppShell` — 8 surgical insertions + 2 spec regex fixes. 13/13 green; 7/7 existing app-shell-atlas-state spec still green; the 9 transitively-failing renderer specs are documented as DEF-41-03-01.
3. **Chore — `7e2e7b6`:** `chore(41-03): log cross-plan import failures as DEF-41-03-01` — orchestrator visibility log.

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `tests/renderer/app-shell-animation-viewer.spec.tsx` | NEW | 13 source-grep tests; each test maps to one AppShell insertion-site invariant. |
| `src/renderer/src/components/AppShell.tsx` | MODIFY | 8 additive insertions: import (1 line), state slot (5 lines incl. comment), useCallback (5 lines), modalOpen OR-chain entry (5 lines), dep-array entry (1 line), toolbar button (16 lines), JSX mount (8 lines), project-change useEffect (17 lines). Total: +72 lines, 0 deletions. |
| `.planning/phases/41-spine-animation-viewer/deferred-items.md` | MODIFY | +1 entry (DEF-41-03-01) logging the cross-plan import resolution gap. |

## Decisions Made

- **`animationViewerOpen` is positioned in the middle of the OR-chain, not at the end:** Plan-§action-Edit-4 suggested placing it as the final terminator (`animationViewerOpen;`), but Task 1 test (11)'s regex requires `animationViewerOpen ||` — i.e., NOT at the end. Reordered the chain so `documentationBuilderOpen;` remains the visual terminator (preserving the Phase 20 historical position) and `animationViewerOpen ||` sits between `helpOpen ||` and `documentationBuilderOpen;`. The Phase 41 comment block continues to introduce the new entry, with all explanatory text intact.
- **Sibling useEffect (Plan-§PATTERNS Site 7 Option 1) for project-change cleanup:** The viewer-close trigger is its own concern (VIEWER-08) and gets its own audit trail in `AppShell.tsx`. Folding into the existing `[summary]` effect would have been one line shorter but harder to grep by phase number; the locked decision aligns with the Phase 6 / Phase 7 / Phase 20 convention of "one phase = one effect when the trigger is shared but the intent is not."

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Test contract correctness] Test 8 regex didn't match JSX whitespace format**

- **Found during:** Task 2, first GREEN run.
- **Issue:** Test 8 (button positioning between Atlas Preview and Documentation) searched for literal substrings `>Atlas Preview<`, `>Animation Viewer<`, `>Documentation<`. These substrings don't exist in the actual source — JSX renders button labels with newlines + indentation: `>\n            Atlas Preview\n          </button>`.
- **Fix:** Replaced literal `.indexOf('>X<')` with regex `/>\s*X\s*<\/button>/.exec(src)` and used `.index` for byte-offset comparison. Same positional invariant, whitespace-tolerant matcher.
- **Files modified:** `tests/renderer/app-shell-animation-viewer.spec.tsx` (Test 8 only)
- **Commit:** `e532695`

**2. [Rule 1 — Test contract correctness] Test 11 regex truncated at stray `;` in a comment**

- **Found during:** Task 2, second GREEN run (after fixing Test 8 + reordering modalOpen chain).
- **Issue:** Test 11's regex `/const\s+modalOpen\s*=[\s\S]{0,1000}?;/` used non-greedy `{0,1000}?` to capture the OR-chain block, expecting the FIRST `;` after `const modalOpen =` to be the chain terminator. But the new Phase 41 comment block contains the text `08.2 D-184;` — a stray `;` inside a comment that the regex matched as the terminator, truncating the captured block before `animationViewerOpen` appeared. Result: `/animationViewerOpen\s*\|\|/.test(truncatedBlock)` was false even though the source contained the pattern correctly.
- **Fix:** Replaced the non-greedy `{0,1000}?;` pattern with a line-anchored terminator pattern: search forward from `const modalOpen =` for the first occurrence of `/^[\s\S]*?(?:Open|State|null);\s*$/m` (an identifier ending in Open/State/null followed by `;` and end-of-line). This correctly identifies the OR-chain terminator without confusion with semicolons inside comment blocks. Same invariant (animationViewerOpen-followed-by-`||`-must-appear-in-OR-chain-body), more robust matcher.
- **Files modified:** `tests/renderer/app-shell-animation-viewer.spec.tsx` (Test 11 only)
- **Commit:** `e532695`

**3. [Rule 4 — declined: not architectural; resolved as Rule 1] modalOpen chain order — `animationViewerOpen` cannot be the chain terminator**

- **Found during:** Task 2, first GREEN run (Test 11 RED).
- **Issue:** Plan-§action-Edit-4 explicitly instructed `animationViewerOpen;` (with `;` terminator) at the END of the chain. But Task 1's Test 11 regex requires `animationViewerOpen ||` — only possible if `animationViewerOpen` is NOT the terminator. Plan instructions contradicted the plan's own RED test.
- **Disposition:** Test wins (it's the locked contract; the plan-§action is descriptive). Rule 1 applies — implementation was wrong relative to the contract.
- **Fix:** Reordered the OR chain so `animationViewerOpen ||` appears between `helpOpen ||` and `documentationBuilderOpen;` (which remains the terminator). Phase 41 explanatory comment block moved with `animationViewerOpen`; Phase 20 explanatory comment block continues to introduce `documentationBuilderOpen`. Visually: chronological insert order (Phase 9 Plan 06 → 9 Plan 07 → Phase 41 → Phase 20) — slightly out of pure chronological order but the test's structural requirement (animationViewerOpen NOT at end) takes precedence over comment-order aesthetics.
- **Files modified:** `src/renderer/src/components/AppShell.tsx` (Edit 4 only)
- **Commit:** `e532695`

### Out-of-scope (DEF-41-03-01 — Worktree visibility log)

9 renderer specs (`app-elevation.spec.tsx`, `app-quit-subscription.spec.tsx`, `app-update-subscriptions.spec.tsx`, `appshell-mode-switch-divergence.spec.tsx`, `atlas-less-fallback-save-roundtrip.spec.tsx`, `loader-mode-toggle-disabled.spec.tsx`, `override-migration-banner.spec.tsx`, `rig-info-tooltip.spec.tsx`, `save-load.spec.tsx`) transitively load AppShell and now fail at Vite-transform time with `Failed to resolve import "../modals/AnimationPlayerModal"` because Plan 02's file (`src/renderer/src/modals/AnimationPlayerModal.tsx`) does not exist in this worktree.

This is **expected per the orchestrator's parallel-execution contract**:

> Plan 02 (running in parallel) creates `src/renderer/src/modals/AnimationPlayerModal.tsx`. Your worktree base predates that file. Your `import { AnimationPlayerModal }` will reference an as-yet-uncreated file — that's expected; the wire-up resolves at merge time on main.

After Plan 02 lands on main, all 9 specs are expected to pass. Logged as DEF-41-03-01 for orchestrator visibility.

## Issues Encountered

**Pre-existing test failures inherited from base commit (Plan 01 already logged)**

The same 2 pre-existing failures from DEF-41-01-01 (`tests/core/sampler-skin-defined-unbound-attachment.spec.ts` + `tests/main/sampler-worker-girl.spec.ts`, both missing-fixture-related) reproduce in this worktree. Plan 03 does not touch the sampler/core, so this is not a regression; flagged in DEF-41-01-01 already.

**TypeScript compile in worktree shows 2 errors (both expected)**

- `src/renderer/src/components/AppShell.tsx(67,38): error TS2307: Cannot find module '../modals/AnimationPlayerModal'` — cross-plan; resolves on merge-back (DEF-41-03-01).
- `tests/main/image-worker-rotation.spec.ts(187,13): error TS6133: 'data' is declared but its value is never read` — pre-existing in base commit (verified by `git stash` + `npx tsc --build` against the worktree base); unrelated to this plan.

Plan 03's own test surface (`tests/renderer/app-shell-animation-viewer.spec.tsx`) runs 13/13 green; the closest analog spec (`tests/renderer/app-shell-atlas-state.spec.tsx`) runs 7/7 green; no logic regression introduced.

## User Setup Required

None. The new toolbar button + JSX mount take effect automatically on `npm run dev` after Plan 02 lands. No env vars, no IPC bridge changes (those landed in Plan 01).

## Next Phase Readiness

- **Wave 2 merge-back unblocked:** Plan 02 (the modal component) and Plan 03 (the AppShell wire-up) merge cleanly because they touch disjoint files (`src/renderer/src/modals/AnimationPlayerModal.tsx` vs `src/renderer/src/components/AppShell.tsx`). The single cross-file edge is the `import` line in AppShell, which the merged main resolves.
- **Verify-work readiness:** After both Wave 2 worktrees merge, `/gsd-verify-work 41` can run the full suite plus the manual UAT scenarios that Plan 03 hands off (see below).

## Manual UAT Handoff (for `41-HUMAN-UAT.md` — created during `/gsd-verify-work 41`)

The following items are NOT covered by automated tests in this plan — they require a live Electron dev server + a real project drop + real GL context:

- **VIEWER-04:** clicking the Animation Viewer toolbar button opens the modal in a live Electron dev server (with a `SkeletonSummary` containing ≥ 1 peak).
- **VIEWER-08 (project-change branch):** with the viewer open, loading a different project (drop new `.json` / Open project) closes the modal cleanly. DevTools Performance Monitor → "GPU Memory" stays flat across the close-then-reopen cycle (no GL context leak).
- **File menu auto-suppression contract (08.2 D-184) post-Phase-41:** with the viewer open, File → Save (Cmd-S) is disabled at the OS level (greyed-out menu item; keyboard accelerator is a no-op).
- **Disable rule (D-03c):** loading the app with no project shows the Animation Viewer button greyed out (`effectiveSummary.peaks.length === 0`). Same predicate as Atlas Preview.

## TDD Gate Compliance

Plan 41-03 followed the canonical RED → GREEN → (no REFACTOR needed) gate:

- **RED commit `a757e76`:** 13 source-grep tests, 12 failing (test 7 passed early due to base-file className count `>= 2`).
- **GREEN commit `e532695`:** 13/13 passing after 8 surgical insertions + 2 spec regex fixes.
- **No REFACTOR commit needed:** the 8 edits are minimal-additive insertions; no code-cleanup pass surfaces useful refactoring opportunities at this scope.

---

## Self-Check: PASSED

- [x] `src/renderer/src/components/AppShell.tsx` contains `import { AnimationPlayerModal } from '../modals/AnimationPlayerModal';` (1 occurrence)
- [x] `AppShell.tsx` contains `const [animationViewerOpen, setAnimationViewerOpen] = useState(false)` (1 occurrence)
- [x] `AppShell.tsx` contains `const onClickAnimationViewer = useCallback` (1 occurrence)
- [x] `AppShell.tsx` contains `onClick={onClickAnimationViewer}` (1 occurrence)
- [x] `AppShell.tsx` contains `<AnimationPlayerModal` (1 occurrence)
- [x] `AppShell.tsx` contains `animationViewerOpen ||` (1 occurrence — in modalOpen OR-chain BODY)
- [x] `AppShell.tsx` contains `setAnimationViewerOpen(false)` (2 occurrences — project-change useEffect + JSX onClose lambda)
- [x] `AppShell.tsx` className `border border-border rounded-md ...flex-shrink-0` byte-identical to Atlas Preview button (count: 3 — Atlas Preview + Animation Viewer + Documentation, all share the same canonical string)
- [x] `tests/renderer/app-shell-animation-viewer.spec.tsx` exists with 13 `it(...)` blocks
- [x] `npm test -- tests/renderer/app-shell-animation-viewer.spec.tsx` → 13/13 passing
- [x] `npm test -- tests/renderer/app-shell-atlas-state.spec.tsx` → 7/7 passing (existing tests unchanged)
- [x] All 3 commits exist in `git log --oneline` of worktree branch: `a757e76`, `e532695`, `7e2e7b6`

---

*Phase: 41-spine-animation-viewer*
*Completed: 2026-05-15*
